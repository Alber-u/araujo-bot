// ===================================================================
// MÓDULO PRESUPUESTOS — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Presupuestos (CCPP) al index.cjs.
// Lee/escribe en la pestaña "comunidades" del Sheet de producción.
// Solo lee (no modifica) las pestañas existentes: vecinos_base,
// expedientes, documentos.
//
// Uso desde index.cjs:
//   require("./presupuestos.cjs")(app);
//
// Variables de entorno usadas (las mismas que ya usa index.cjs):
//   - GOOGLE_CLIENT_ID
//   - GOOGLE_CLIENT_SECRET
//   - GOOGLE_REFRESH_TOKEN
//   - GOOGLE_SHEETS_ID
//   - ADMIN_TOKEN
// ===================================================================

const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const { getThemeCss } = require("./estilo-visual.cjs");
const { validToken } = require("./lib/auth.cjs");

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN (mismo patrón que index.cjs)
  // =================================================================
  function getGoogleAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }

  // =================================================================
  // CONSTANTES
  // =================================================================
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const RANGO_COMUNIDADES = "comunidades!A:BN"; // ... + fecha_limite_documentacion_vecinos (BC) + motivo_rechazo (BD) + fecha_cobro (BE) + en_hoy (BF) + visto_hoy (BG)
  const RANGO_MAIL_PLANTILLAS = "mail_plantillas!A:J"; // A..I como antes + J = cuenta_envio
  const RANGO_BOT_PLANTILLAS = "bot_plantillas!A:H"; // A clave|B destinatario|C tipo|D texto|E twilio_sid|F variables|G activo|H notas (textos del bot WhatsApp, v18.79)
  const RANGO_DOC_PLANTILLAS = "doc_plantillas!A:D"; // A clave | B titulo | C cuerpo | D activo (plantillas de documentos EMASESA, v17.82)
  const RANGO_MAIL_HISTORICO = "mail_historico!A:J";   // ... + J = message_id (Message-ID del envío SMTP)
  const RANGO_MAIL_CUENTAS   = "mail_cuentas!A:G";   // A id | B email | C password | D host | E puerto | F host_imap | G puerto_imap
  const RANGO_MAILS_PENDIENTES = "mails_pendientes!A:L"; // bandeja de mails IMAP entrantes sin clasificar
  const RANGO_DOCS_MANUALES  = "documentos_manuales!A:G"; // codigo | nivel | label | orden | permite_financiacion | activo | notas
  const RANGO_PISOS          = "pisos!A:AX" /* v18.90: +bot_piso_activo(AV) piso_tipo(AW) acordeon(AX) */;   // pisos con est_piso_* (AC..AS) + v17.52: en_hoy (AT) + notas_piso (AU)

  // Fases del proceso de presupuesto (módulo CCPP)
  // - codigo:        número visible (01, 02, ..., ZZ)
  // - nombre:        forma corta para filtros y línea de tiempo
  // - nombreLargo:   forma larga en MAYÚSCULAS para botones y cabeceras de ficha
  const PTO_FASES = {
    "01_CONTACTO":       { codigo: "01", nombre: "Contacto",    nombreLargo: "CONTACTO",         color: "azul",     siguiente: "02_VISITA",          accionLabel: "Contacto registrado",  plantilla: "primer_contacto", cadenciaDias: 30 },
    "02_VISITA":         { codigo: "02", nombre: "Visita",      nombreLargo: "VISITA",           color: "azul",     siguiente: "03_ENVIO_PTO",       accionLabel: "Programar visita",     plantilla: null },
    "03_ENVIO_PTO":      { codigo: "03", nombre: "Envío",       nombreLargo: "ENVIO PTO",        color: "azul",     siguiente: "04_ACEPTACION_PTO",  accionLabel: "Enviar presupuesto",   plantilla: "envio_pto" },
    "04_ACEPTACION_PTO": { codigo: "04", nombre: "Aceptación",  nombreLargo: "ACEPTACION PTO",   color: "amarillo", siguiente: "05_DOCUMENTACION",   accionLabel: "Aceptación",           plantilla: "seguimiento", cadenciaDias: 15, cadenciaInicialDias: 3 },
    "09_TRAMITADA":      { codigo: "09", nombre: "Tramitados",   nombreLargo: "TRAMITADOS",        color: "verde",    siguiente: null,                 accionLabel: "Tramitados",            plantilla: null },
    "ZZ_RECHAZADO":      { codigo: "ZZ", nombre: "Rechazado",   nombreLargo: "RECHAZADO",        color: "rojo",     siguiente: null,                 accionLabel: "Rechazado",            plantilla: null },
    "ZZ_DESCARTADO":     { codigo: "ZZ", nombre: "Descartado",  nombreLargo: "DESCARTADO",       color: "rojo",     siguiente: null,                 accionLabel: "Descartado",           plantilla: null },
  };

  // Mapeo de estados antiguos (Excel SEGUIMIENTO.xlsm + Sheet con nombres antiguos) -> fase nueva
  const MAPA_ESTADO_FASE = {
    // Identificadores antiguos del Sheet (compat con datos ya guardados)
    "01_SOLICITUD":          "01_CONTACTO",
    "ENTREGADO":             "05_DOCUMENTACION",
    "05_RESOLUCION":         "04_ACEPTACION_PTO",   // si quedara alguno colgado, lo mandamos a aceptación
    // Compat: la antigua fase 05_ENVIO_DOC pasa a ser 05_DOCUMENTACION (ya no es de presupuestos)
    "05_ENVIO_DOC":          "05_DOCUMENTACION",
    // Compat: nombres antiguos de fases ya renombradas (sesión 04/05/2026):
    //   03_ENVIO          -> 03_ENVIO_PTO
    //   04_SEGUIMIENTO    -> 04_ACEPTACION_PTO
    // Esto permite leer CCPPs ya escritos en el Sheet con los códigos antiguos
    // y normalizarlos en cada lectura. Cuando avancen de fase, se reescriben
    // con el nombre nuevo y la migración es automática.
    "03_ENVIO":              "03_ENVIO_PTO",
    "04_SEGUIMIENTO":        "04_ACEPTACION_PTO",
    // Compat: cambio estructural sesión 04/05/2026 — el flujo final cambió:
    //   07_CONTRATOS_PAGOS -> 08_CYCP (renombrado)
    //   08_TRAMITADA       -> 08_CYCP (fusionado en la fase 08)
    //   (07_PTE_CYCP es nueva, no migra de nada)
    "07_CONTRATOS_PAGOS":    "08_CYCP",
    "08_TRAMITADA":          "08_CYCP",
    // Estados del Excel SEGUIMIENTO.xlsm
    "00-SOLICITUD ACTA PTO": "01_CONTACTO",
    "00-PTE VISITA":         "02_VISITA",
    "01-ENVIO PTO":          "03_ENVIO_PTO",
    "01-PERSIGO PTO":        "04_ACEPTACION_PTO",
    "01-SOLICITUD ACTA PTO": "01_CONTACTO",
    "02-PTE VISITA":         "02_VISITA",
    "03-ENVIO PTO":          "03_ENVIO_PTO",
    "03-ENVÍO PTO":          "03_ENVIO_PTO",
    "04-SEGUIMIENTO PTO":    "04_ACEPTACION_PTO",
    "05-RESOLUCION PTO":     "04_ACEPTACION_PTO",   // expediente sin decisión todavía
    "05-RESOLUCIÓN PTO":     "04_ACEPTACION_PTO",
    "ZZ-RECHAZADA":          "ZZ_RECHAZADO",
    "ZZ-RECHAZADO":          "ZZ_RECHAZADO",
    "06-ENVIO DOC":          "05_DOCUMENTACION",
    "02-PERSIGO CYCP":       "05_DOCUMENTACION",
    "02-PERSIGO DOC":        "05_DOCUMENTACION",
    "02-EMASESA CYCP":       "05_DOCUMENTACION",
    "02-EMASESA TECNICO":    "05_DOCUMENTACION",
    "02-TRADICIONAL":        "05_DOCUMENTACION",
    "03-TRAMITADA":          "08_CYCP",
    "04-EJECUTADA":          "08_CYCP",
  };

  // Fases de OTROS módulos que presupuestos debe reconocer pero no gestionar.
  // Cuando un CCPP está en una de estas fases, ya no es "asunto de presupuestos"
  // pero la ficha tiene que pintar el timeline correctamente y no tratarlo
  // como un 01_CONTACTO recién creado.
  const FASES_DOCUMENTACION = ["05_DOCUMENTACION", "06_VISITA_EMASESA", "07_PTE_CYCP", "08_CYCP"];
  const PLAZO_DOC_INICIAL = 20; // días contractuales fijos de entrega de documentación (motor, no editable)
  const PLAZO_CYCP_INICIAL = 10; // días contractuales fijos de firma de contratos y cartas de pago (fase 08, motor)

  // Definiciones de las fases de documentación (mismo formato que PTO_FASES).
  // Presupuestos las usa SOLO para pintar la barra de acción azul oscura
  // y los botones de avance cuando un CCPP está en una de ellas. La lógica
  // de gestión real vive en documentacion.cjs.
  const FASES_DOCUMENTACION_DEF = {
    "05_DOCUMENTACION":   { codigo: "05", nombre: "Documentación",   nombreLargo: "DOCUMENTACION",     siguiente: "06_VISITA_EMASESA" },
    "06_VISITA_EMASESA":  { codigo: "06", nombre: "Visita EMASESA",  nombreLargo: "VISITA EMASESA",    siguiente: "07_PTE_CYCP" },
    "07_PTE_CYCP":        { codigo: "07", nombre: "Pte CYCP",        nombreLargo: "PTE CYCP",          siguiente: "08_CYCP" },
    "08_CYCP":            { codigo: "08", nombre: "CYCP",            nombreLargo: "CYCP",              siguiente: null },
  };

  function normalizarFase(fase) {
    if (!fase) return "01_CONTACTO";
    if (PTO_FASES[fase]) return fase;
    if (FASES_DOCUMENTACION.includes(fase)) return fase; // módulo doc: respetar valor
    return MAPA_ESTADO_FASE[fase] || "01_CONTACTO";
  }

  // Devuelve el nombre amigable de una plantilla a partir de su código de fase.
  // Ej: "02_PTE_VISITA_CON_ACTA" -> "02-PTE VISITA (CON ACTA)"
  // Usado en pantalla de plantillas y en desplegable de "Añadir mail manual".
  function nombrePlantillaAmigable(fase) {
    if (fase === "02_PTE_VISITA_CON_ACTA") return "02-PTE VISITA (CON ACTA)";
    if (fase === "02_PTE_VISITA_SIN_ACTA") return "02-PTE VISITA (SIN ACTA)";
    if (fase === "04_ACEPTACION_PTO")      return "04-SEGUIMIENTO PTO";
    if (fase === "04_REENVIO")             return "04-REVISION PTO";
    if (fase === "05_ACEPTACION_PTO")      return "05-INICIO DOC";
    if (fase === "05_SEGUIMIENTO_DOC")     return "05-SEGUIMIENTO DOC";
    if (fase === "05_ULTIMATUM_DOC")       return "05-ULTIMÁTUM DOC";
    if (fase === "05_ULT_RESOLVER")        return "05-RESOLUCIÓN DE CONTRATO";
    if (fase === "08_ULTIMATUM_CYCP")      return "08-ULTIMÁTUM CYCP";
    if (fase === "08_ULT_RESOLVER")        return "08-RESOLUCIÓN DE CONTRATO";
    if (fase === "05_FIN_DOC")             return "05-FIN DOC";
    if (fase === "08_INICIO_CYCP")         return "08-INICIO CYCP";
    if (fase === "08_SEGUIMIENTO_CYCP")    return "08-SEGUIMIENTO CYCP";
    if (fase === "08_FIN_CYCP")            return "08-FIN CYCP";
    const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
    if (def) return `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;
    return fase;
  }

  // Devuelve la fase inmediatamente anterior (busca quién tiene `fase` como `siguiente`).
  // Devuelve null si no hay fase anterior (01_CONTACTO, ZZ_*, o fase desconocida).
  function calcularFaseAnterior(fase) {
    if (!fase) return null;
    // Recorrer ambos catálogos buscando quién tiene esta fase como "siguiente"
    for (const [k, v] of Object.entries(PTO_FASES)) {
      if (v.siguiente === fase) return k;
    }
    for (const [k, v] of Object.entries(FASES_DOCUMENTACION_DEF)) {
      if (v.siguiente === fase) return k;
    }
    return null;
  }

  // =================================================================
  // HELPERS GENÉRICOS
  // =================================================================
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  // Renderiza el cuerpo de un mail dividiéndolo en "nuevo" (azul) e "histórico
  // arrastrado" (gris apagado, más pequeño). Detecta el primer marcador de cita
  // habitual y todo lo que venga después se pinta como histórico. Si no
  // detecta marcador, todo el cuerpo va como "nuevo".
  // Patrones detectados (orden):
  //   1. Línea que empieza con ">" (quote universal)
  //   2. "----- Mensaje original -----" / "----- Original Message -----" (Outlook)
  //   3. "---------- Mensaje reenviado ----------" / "---------- Forwarded message ----------" (Gmail)
  //   4. "El ... escribió:" / "On ... wrote:" (clientes en es/en)
  //   5. "De: ..." / "From: ..." al inicio de línea (Outlook compacto)
  // escFn = función de escape HTML (puede ser esc o _esc según el contexto)
  //
  // Adicionalmente, el bloque "nuevo" se reflowea: los saltos de línea simples
  // que parecen artificiales (cliente antiguo cortando a ~72 chars) se sustituyen
  // por un espacio, conservando los párrafos (\n\n) y las listas/despedidas.
  // El bloque histórico NO se reflowea (los > son señal visual útil).
  function _reflowearTexto(texto) {
    const lineas = String(texto || "").split("\n");
    const out = [];
    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i];
      const siguiente = lineas[i + 1];
      // Si la siguiente línea está vacía o es la última → mantener salto
      if (siguiente === undefined || siguiente.trim() === "") {
        out.push(actual);
        continue;
      }
      // Si la actual está vacía → mantener salto (es un párrafo)
      if (actual.trim() === "") {
        out.push(actual);
        continue;
      }
      const actTrim = actual.trimEnd();
      const sigTrim = siguiente.trimStart();
      // Si la línea actual termina en puntuación fuerte → mantener salto (nueva frase)
      if (/[.!?:;]$/.test(actTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea siguiente empieza por viñeta/quote/guion → mantener salto (lista)
      if (/^[-*•>–—]/.test(sigTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea siguiente empieza por mayúscula o número → mantener salto
      // (asumimos nueva frase, dirección, dato, despedida...)
      if (/^[A-ZÁÉÍÓÚÑ0-9]/.test(sigTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea actual es corta (<40 chars) → mantener salto (probablemente fue intencional)
      if (actTrim.length < 40) {
        out.push(actual);
        continue;
      }
      // Si la línea actual es muy larga (>90 chars) → mantener salto (no parece corte artificial)
      if (actTrim.length > 90) {
        out.push(actual);
        continue;
      }
      // Resto: corte artificial a ~60-80 chars con minúscula en la siguiente → unir
      out.push(actTrim + " " + sigTrim);
      i++; // saltar la siguiente porque ya la consumimos
    }
    return out.join("\n");
  }

  function _renderCuerpoMail(cuerpo, escFn) {
    const raw = String(cuerpo || "");
    if (!raw.trim()) return "";
    const lineas = raw.split(/\r?\n/);
    const patrones = [
      /^\s*>/,
      /^\s*-{3,}\s*Mensaje\s+original\s*-{3,}/i,
      /^\s*-{3,}\s*Original\s+Message\s*-{3,}/i,
      /^\s*-{3,}\s*Mensaje\s+reenviado\s*-{3,}/i,
      /^\s*-{3,}\s*Forwarded\s+message\s*-{3,}/i,
      /^\s*El\s+.{5,120}\s+escribió\s*:?\s*$/i,
      /^\s*On\s+.{5,120}\s+wrote\s*:?\s*$/i,
      /^\s*De\s*:\s*.+/i,
      /^\s*From\s*:\s*.+/i,
    ];
    let idxCorte = -1;
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      for (const p of patrones) {
        if (p.test(l)) { idxCorte = i; break; }
      }
      if (idxCorte >= 0) break;
    }
    const azul = "var(--ptl-brand)";
    const gris = "var(--ptl-gray-500)";
    if (idxCorte < 0) {
      return `<span style="color:${azul}">${escFn(_reflowearTexto(raw))}</span>`;
    }
    const nuevoRaw = lineas.slice(0, idxCorte).join("\n").replace(/\s+$/g, "");
    const nuevo = _reflowearTexto(nuevoRaw);
    const histo = lineas.slice(idxCorte).join("\n");
    const nuevoHtml = nuevo ? `<span style="color:${azul}">${escFn(nuevo)}</span>` : "";
    const histoHtml = `<span style="color:${gris};font-size:11px">${escFn(histo)}</span>`;
    return nuevo ? `${nuevoHtml}\n\n${histoHtml}` : histoHtml;
  }

  function fmtFecha(f) {
    if (!f || f === "") return "—";
    const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
    // Fallback para otros formatos: intentar Date y formatear con guiones.
    const d = new Date(f.length > 10 ? f : f + "T00:00:00");
    if (isNaN(d)) return f;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const aa = String(d.getFullYear()).slice(2);
    return `${dd}-${mm}-${aa}`;
  }
  function fmtMoneda(n) {
    if (n == null || n === "") return "—";
    const num = parseFloat(String(n).replace(',', '.'));
    if (isNaN(num)) return "—";
    // v17.43: forzamos separador de miles también para números de 4 dígitos
    // (1.000–9.999). El locale es-ES por defecto NO los pone (norma RAE), pero
    // para uniformidad visual con números mayores los añadimos manualmente.
    const formatted = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(num);
    // Si el entero es de 4 dígitos (sin separador), insertamos el punto a mano.
    // Intl los da como "8802,45"; nosotros queremos "8.802,45".
    const parts = formatted.split(',');
    const intPart = parts[0];
    const intAbs = intPart.replace('-', '');
    let intFixed = intPart;
    if (intAbs.length === 4 && !intAbs.includes('.')) {
      const sign = intPart.startsWith('-') ? '-' : '';
      intFixed = `${sign}${intAbs[0]}.${intAbs.slice(1)}`;
    }
    return `${intFixed},${parts[1]} €`;
  }
  function fmtTlf(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }
  function splitList(s) { return String(s || "").split(",").map(x => x.trim()).filter(Boolean); }
  function ahoraISO() { return new Date().toISOString(); }

  // Validación de email: formato razonable, sin acentos ni espacios.
  // Acepta caracteres ASCII básicos. Si está vacío, devuelve true (campo opcional).
  function esEmailValido(s) {
    if (!s) return true;
    const v = String(s).trim();
    if (!v) return true;
    // Sin caracteres acentuados ni espacios
    if (/[áéíóúüñçÁÉÍÓÚÜÑÇ\s]/.test(v)) return false;
    // Formato básico: algo@algo.algo (todo ASCII imprimible salvo @ ni espacios)
    return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v);
  }
  // Validación de lista de emails separados por coma (para CCO).
  // Acepta hasta `max` direcciones (default 3). Si está vacío, válido.
  function esListaEmailsValida(s, max) {
    if (!s) return true;
    const lista = String(s).split(",").map(x => x.trim()).filter(Boolean);
    if (lista.length > (max || 3)) return false;
    return lista.every(esEmailValido);
  }
  function ccppId(direccion) {
    const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // Construye una URL añadiendo automáticamente el token si existe.
  // params puede ser un objeto { fase: "01_CONTACTO", q: "alberche" }
  function urlT(token, path, params) {
    const usp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== "") usp.set(k, v);
      }
    }
    if (token) usp.set("token", token);
    const qs = usp.toString();
    return path + (qs ? "?" + qs : "");
  }

  // =================================================================
  // NORMALIZADORES DE PISOS — usados por la plantilla de vecinos
  // =================================================================
  // Se exportan vía app.locals.presupuestos para que documentacion.cjs
  // los use con la misma lógica. La validación de duplicados, el orden
  // de la tabla y la importación del histórico aplican estas reglas.
  // (Probadas en sandbox /home/claude/sandbox-vecinos/)

  // Normalización del CÓDIGO DE PISO (7 reglas):
  //   1. trim
  //   2. mayúsculas
  //   3. quitar paréntesis
  //   4. eliminar TODOS los espacios
  //   5. quitar acentos en vocales (Ñ se mantiene)
  //   6. quitar º y ª
  //   7. quitar barras `/` (los guiones `-` SÍ se conservan literalmente)
  function normalizarCodigoPiso(s) {
    if (s == null) return "";
    let r = String(s);
    r = r.trim();
    r = r.toUpperCase();
    r = r.replace(/[()]/g, "");
    r = r.replace(/\s+/g, "");
    r = r.replace(/Á/g, "A").replace(/É/g, "E").replace(/Í/g, "I")
         .replace(/Ó/g, "O").replace(/Ú/g, "U").replace(/Ü/g, "U");
    r = r.replace(/[ºª]/g, "");
    r = r.replace(/\//g, "");
    return r;
  }

  // Normalización del NOMBRE: solo trim + colapsar dobles espacios.
  function normalizarNombrePiso(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  // Normalización del TELÉFONO: devuelve { ok, valor, error? }.
  // Resultado válido: "" (vacío) o "+34" + 9 dígitos.
  // Compatible con el formato que usa el bot WhatsApp (normalizarTelefono
  // de index.cjs), de modo que el bot encuentra al vecino al recibir un
  // mensaje y la sincronización vecinos_base ↔ expedientes funciona.
  function normalizarTelefonoPiso(s) {
    if (s == null || String(s).trim() === "") return { ok: true, valor: "" };
    let r = String(s).trim().replace(/[^\d+]/g, "");
    if (r.startsWith("+")) {
      if (/^\+34\d{9}$/.test(r)) return { ok: true, valor: r };
      return { ok: false, valor: r, error: "El teléfono debe ser +34 seguido de 9 dígitos" };
    }
    if (/^34\d{9}$/.test(r)) return { ok: true, valor: "+" + r };
    if (/^\d{9}$/.test(r))   return { ok: true, valor: "+34" + r };
    return { ok: false, valor: r, error: "El teléfono debe ser un móvil/fijo español de 9 dígitos" };
  }

  // Comparador de orden NATURAL para códigos de piso: 9A < 10A.
  // Los trozos numéricos se comparan como números, los alfabéticos como letras.
  function comparadorNaturalPiso(a, b) {
    const re = /(\d+)|(\D+)/g;
    const aParts = String(a || "").match(re) || [];
    const bParts = String(b || "").match(re) || [];
    const n = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < n; i++) {
      const ap = aParts[i], bp = bParts[i];
      const aNum = /^\d+$/.test(ap), bNum = /^\d+$/.test(bp);
      if (aNum && bNum) {
        const da = parseInt(ap, 10), db = parseInt(bp, 10);
        if (da !== db) return da - db;
      } else {
        if (ap !== bp) return ap < bp ? -1 : 1;
      }
    }
    return aParts.length - bParts.length;
  }

  // =================================================================
  // CAPA DE ACCESO A DATOS — pestaña "comunidades"
  // =================================================================
  // Estructura de columnas (10 originales + 24 nuevas):
  //  A  comunidad (clave humana, ej "ESTRELLA ALDEBARAN 4")
  //  B  direccion
  //  C  presidente
  //  D  telefono_presidente
  //  E  email_presidente
  //  F  estado_comunidad
  //  G  fecha_inicio
  //  H  fecha_limite_documentacion
  //  I  fecha_limite_firma
  //  J  observaciones
  //  K  tipo_via
  //  L  earth
  //  M  administrador
  //  N  telefono_administrador
  //  O  email_administrador
  //  P  fase_presupuesto
  //  Q  fecha_contacto
  //  R  fecha_visita
  //  S  fecha_envio_pto
  //  T  fecha_ultimo_seguimiento_pto
  //  U  decision_pto
  //  V  fecha_aceptacion_pto
  //  W  pto_total
  //  X  mano_obra_previsto
  //  Y  mano_obra_real
  //  Z  material_previsto
  //  AA material_real
  //  AB beneficio_previsto    (calculado: W - X - Z - 150)
  //  AC beneficio_real        (calculado: W - Y - AA)
  //  AD beneficio_desvio      (calculado: AC - AB)
  //  AE tiempo_previsto
  //  AF tiempo_real
  //  AG tiempo_desvio         (calculado: 1 - AF/AE)
  //  AH notas_pto
  //  AI mails_enviados (JSON)
  //  AJ mails_ultimo_envio (JSON)
  //  AK fecha_proximo_mail_manual
  //  AL fecha_ultimo_reenvio_pto
  //  AM fecha_visita_emasesa   (fase 06_VISITA_EMASESA)
  //  AN fecha_documentacion_completa  (fase 05_DOCUMENTACION cerrada)
  //  AO fecha_contratos_pagos_completa (legacy: era el cierre de la antigua fase 07_CONTRATOS_PAGOS)
  //  AP bot_comunidad_activo   (BOT_WHATSAPP = bot activo en esta comunidad | MANUAL/vacío = manual, defecto)
  //  AQ-AY estados manuales CCPP (gestionados por documentacion.cjs)
  //  AZ fecha_envio_contratos_pagos
  //  BA fecha_cycp_completa
  //  BB mails_manuales (JSON, paralelo a mails_enviados)

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_aceptacion_pto",  // ⚠ OJO NOMBRE: la col V del Sheet se TITULA "fecha_decision_pto", pero el código la mapea y la usa SIEMPRE como `fecha_aceptacion_pto` (lee por posición, el título del Sheet da igual). Mismo dato. NO leer comu.fecha_decision_pto (no existe en el objeto) -> usar comu.fecha_aceptacion_pto.
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio",
    "tiempo_previsto","tiempo_real","tiempo_desvio","notas_pto",
    // AI, AJ — tracking de mails (JSON)
    "mails_enviados",        // JSON: { "01_CONTACTO": 3, "03_ENVIO_PTO": 1, ... }
    "mails_ultimo_envio",    // JSON: { "01_CONTACTO": "2026-04-27", ... }
    // AK, AL — fase 04
    "fecha_proximo_mail_manual",  // fecha YYYY-MM-DD que el usuario escribe cuando habla con el cliente
    "fecha_ultimo_reenvio_pto",   // fecha YYYY-MM-DD del último reenvío de presupuesto desde fase 04
    // AM — fase 06
    "fecha_visita_emasesa",       // fecha YYYY-MM-DD de la visita de EMASESA al CCPP
    // AN — cierre fase 05
    "fecha_documentacion_completa", // fecha YYYY-MM-DD en que se cerró la fase 05_DOCUMENTACION
    // AO — cierre fase 07
    "fecha_contratos_pagos_completa", // legacy: era el cierre de la antigua fase 07_CONTRATOS_PAGOS. Ya no se usa para definir fechas de hito (se mantiene en el Sheet por si hay datos históricos importados).
    // AP — interruptor del bot WhatsApp a nivel de comunidad.
    //   "BOT_WHATSAPP" = el bot gestiona la documentación de esta comunidad.
    //   "MANUAL" o vacío = gestión manual (defecto). Reversible.
    //   (Antes se llamaba modo_documentacion con valores MANUAL/BOT, nunca llegó
    //   a usarse porque el bot estaba aparcado. Renombrado el 31-05-2026.)
    "bot_comunidad_activo",
    // AQ–AY — Estados manuales del CCPP (los gestiona documentacion.cjs).
    //   Se declaran aquí solo como placeholders para que rowToObj/objToRow no
    //   los pisen al leer/escribir filas. Mantienen su orden exacto en el Sheet.
    "est_ccpp_contrato_firmado",  // AQ
    "est_ccpp_toma_datos",        // AR
    "est_ccpp_nif",               // AS
    "est_ccpp_acta_pte",          // AT
    "est_ccpp_acta_pto",          // AU
    "est_ccpp_renuncia_gp",       // AV
    "est_ccpp_factura_emasesa",   // AW
    "est_ccpp_contrato",          // AX
    "est_ccpp_pago",              // AY
    // AZ — fecha de paso de fase 07-PTE CYCP a 08-CYCP (cuando se pulsa el
    //      botón "paso a 08-CYCP" y se envía el mail con los contratos a clientes).
    "fecha_envio_contratos_pagos",
    // BA — fecha de cierre final de fase 08-CYCP (cuando se pulsa "cerrar fase 08";
    //      indica que ya se han recibido y firmado todos los contratos).
    "fecha_cycp_completa",
    // BB — JSON con los envíos MANUALES por fase (paralelo a mails_enviados).
    //      Formato: { "01_CONTACTO": 1, "04_ACEPTACION_PTO": 2 }
    //      - mails_enviados   = total de envíos (manuales + automáticos del cron)
    //      - mails_manuales   = solo los hechos por la persona (incluye el inicial
    //                           y los "Reenviar presupuesto revisado")
    //      - reenvíos automáticos = mails_enviados - mails_manuales
    //      Para CCPPs antiguos sin este campo se asume que el primer envío fue
    //      manual (manuales = 1 si mails_enviados >= 1, sino 0).
    "mails_manuales",
    // BC — fecha límite para que los vecinos entreguen la documentación.
    //      Se calcula cuando se envía el mail de fase 05_ACEPTACION_PTO (hoy + 20 días)
    //      y se reutiliza en mails posteriores como variable {{fecha_limite_doc_vecinos}}.
    //      Formato YYYY-MM-DD.
    "fecha_limite_documentacion_vecinos",
    // BD motivo_rechazo: solo se rellena si fase pasa a ZZ_RECHAZADO. Valores
    // posibles: "POR PRECIO MÁS BAJO DE LA COMPETENCIA" o "PORQUE NO SE VA A
    // HACER DE MOMENTO" (los dos botones del modal).
    "motivo_rechazo",
    // BE fecha_cobro: fecha en que Instalaciones Araujo cobró la obra al cliente.
    // Formato YYYY-MM-DD. Solo se rellena manualmente desde la ficha en fase
    // 09_TRAMITADA. Si está rellena → cobrado; si vacía → pendiente de cobro.
    // Se usa para distinguir en la caja TOTAL TRAMITADO del panel HOY los
    // expedientes cobrados de los pendientes de cobro.
    "fecha_cobro",
    // BF en_hoy: "1" si el expediente está marcado para aparecer en HOY (reloj
    // activo junto al campo Notas de la ficha del expediente). Vacío en otro caso.
    // El cambio lo controla el endpoint /presupuestos/expediente/campo (toggle
    // 1/"" desde el botón reloj). En HOY se muestra una caja "Expedientes en HOY"
    // bajo "Mails pendientes" con las CCPPs que tengan en_hoy="1".
    "en_hoy",
    // BG visto_hoy: "1" si el expediente está marcado como REVISADO HOY (check
    // manual a la izquierda de las notas en la caja "Expedientes HOY"). Vacío si no.
    // Uso: repaso diario de expedientes; Guille marca los que va revisando y al
    // final del día ve de un vistazo los gestionados. Se DESMARCAN A MANO (uno a
    // uno) — no hay limpieza automática ni botón de limpiar (decisión Guille:
    // son pocos). Toggle 1/"" desde el endpoint /presupuestos/expediente/campo
    // (mismo que en_hoy y notas_pto, con releído de verificación).
    "visto_hoy",
    // BH fecha_pte_cobro: fecha en que la obra TERMINA y queda pendiente de
    // cobrar (fin de ejecucion). Junto con fecha_cobro (BE) define los 3
    // estados de la fase 09: sin ambas = En ejecucion; con esta y sin cobro =
    // Pendiente de cobro; con fecha_cobro = Cobrado. Formato YYYY-MM-DD.
    "fecha_pte_cobro",
    // BI poblacion / BJ cp: datos postales del expediente (los rellena Guille a
    // mano en la pestaña comunidades). Plan 5 los arrastra a la Toma de datos.
    "poblacion",
    "cp",
    // BK–BN — columnas añadidas (Tanda 1, flujo ultimátum fase 05). Se escriben
    //         SOLO con actualizarCampoComunidad (una celda). actualizarComunidad
    //         NO las toca: su tramoH está acotado a :BJ (ver row.slice(33,62)).
    "fase_antes_descarte",           // BK — fase previa a rechazo/descarte (arreglo reactivar exacto)
    "fecha_ultimatum_ampliado",      // BL — marca: se envió ULTIMÁTUM AVISO (ampliación activada)
    "fecha_disidentes_solicitados",  // BM — marca: se envió ULTIMÁTUM RESOLUCIÓN (disidentes solicitados)
    "fecha_contrato_resuelto",       // BN — marca: se envió RESOLVER CONTRATO
  ];

  function rowToObj(row) {
    const o = {};
    for (let i = 0; i < COLS.length; i++) o[COLS[i]] = row[i] || "";
    // Generar id virtual estable a partir de la dirección (si existe) o comunidad
    const clave = o.direccion || o.comunidad || "";
    o.ccpp_id = clave ? ccppId(clave) : "";
    // v17.23: regularización progresiva 08_CYCP -> 09_TRAMITADA.
    // Si una CCPP tiene fase 08_CYCP y fecha_cycp_completa rellena, la tratamos
    // como 09_TRAMITADA en memoria. La primera vez que esa CCPP pase por
    // actualizarComunidad (al editar y guardar) se escribirá 09_TRAMITADA en el
    // Sheet. Sin script de migración: regularización automática.
    if (o.fase_presupuesto === "08_CYCP" && o.fecha_cycp_completa) {
      o.fase_presupuesto = "09_TRAMITADA";
    }
    // Compatibilidad con el código antiguo: alias 'tipo' = tipo_via, 'fase' = fase_presupuesto
    o.tipo = o.tipo_via || "";
    o.fase = normalizarFase(o.fase_presupuesto);
    o.importe = o.pto_total || "";
    o.notas = o.notas_pto || "";
    return o;
  }
  // v17.26: nombres de columnas que deben escribirse como NÚMERO nativo, no String.
  // Importes (€) con 2 decimales; tiempos (días) con 1 decimal.
  // Si el valor es vacío/null se escribe "" (deja la celda vacía).
  // El parseo es tolerante: acepta string con coma o punto y números nativos.
  const COLS_NUM_IMPORTE = new Set(["pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real"]);
  const COLS_NUM_TIEMPO  = new Set(["tiempo_previsto","tiempo_real"]);
  function _toNumOrEmpty(v, decimales) {
    if (v == null || v === "") return "";
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    if (!isFinite(n)) return "";
    // Redondear a los decimales pedidos sin que aparezcan números tipo 12855.199999
    return Math.round(n * Math.pow(10, decimales)) / Math.pow(10, decimales);
  }
  function objToRow(o) {
    return COLS.map(c => {
      const v = o[c];
      if (v == null) return "";
      if (COLS_NUM_IMPORTE.has(c)) return _toNumOrEmpty(v, 2);
      if (COLS_NUM_TIEMPO.has(c))  return _toNumOrEmpty(v, 1);
      return String(v);
    });
  }

  async function leerComunidades() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGO_COMUNIDADES,
      // v17.28: UNFORMATTED_VALUE para que los números vengan como Number nativo
      // y no como strings formateados con coma decimal y separador de miles ('99.999,99').
      // Las celdas de texto (fases, fechas ISO string, JSON) llegan tal cual.
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (!r[0] && !r[1])) continue; // saltar vacías
      const o = rowToObj(r);
      o._rowIndex = i + 1; // fila real en el Sheet (1-based, header en 1)
      out.push(o);
    }
    return out;
  }
  async function buscarComunidadPorId(id) {
    const todas = await leerComunidades();
    return todas.find(c => c.ccpp_id === id) || null;
  }
  // ¿Este expediente tiene ficha en Plan 5? (existe fila en plan5_toma_datos,
  // localizada por ccpp_id -col B- o, de respaldo, por direccion -col A-).
  // Se usa para BLOQUEAR en la ficha los 4 importes "previstos": cuando hay
  // Plan 5, esos valores los graba el boton Congelar y no se tocan a mano.
  // Lectura ligera (solo A:B). Si falla (sin pestaña/permeso) devuelve false:
  // no bloquea y no rompe la ficha.
  async function _expedienteTienePlan5(comu) {
    try {
      if (!comu) return false;
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: "plan5_toma_datos!A:B",
      });
      const rows = (r.data && r.data.values) || [];
      const id = String(comu.ccpp_id || "").trim();
      const norm = (x) => String(x == null ? "" : x).trim().toLowerCase().replace(/\s+/g, " ");
      const dirComu = norm(comu.direccion || ((comu.tipo_via ? comu.tipo_via + " " : "") + (comu.direccion_calle || "")));
      for (let i = 1; i < rows.length; i++) {
        const ri = rows[i] || [];
        if (id && String(ri[1] || "").trim() === id) return true;
        if (dirComu && norm(ri[0]) === dirComu) return true;
      }
    } catch (e) {
      console.error("[ficha] check Plan 5:", e.message);
    }
    return false;
  }
  async function actualizarComunidad(rowIndex, datos) {
    const sheets = getSheetsClient();
    // v17.21: los campos AB beneficio_previsto, AC beneficio_real, AD beneficio_desvio
    // y AG tiempo_desvio se calculan ahora con FÓRMULAS NATIVAS del Sheet.
    // Por eso ya no los calculamos aquí (lo hacía el código de v17.20 y anteriores)
    // y, sobre todo, NO los escribimos en la fila — escribir un valor o "" sobre
    // esas celdas borraría la fórmula que el Sheet usa para calcularlas.
    //
    // Las columnas son contiguas: AB-AD y AG. Por tanto la fila se escribe en
    // 3 rangos separados (A:AA, AE:AF, AH:BD) dentro de un solo batchUpdate.
    // Forzamos el valor "" para los 4 índices saltados en el row generado,
    // no se usa para escribir pero queda explícito que no se incluyen.
    const row = objToRow(datos);
    // Índices de las 4 columnas saltadas (0-based, según orden de COLS):
    //   AB beneficio_previsto = 27
    //   AC beneficio_real     = 28
    //   AD beneficio_desvio   = 29
    //   AG tiempo_desvio      = 32
    const tramoA  = row.slice(0, 27);   // A..AA (cols 0..26)
    const tramoEF = row.slice(30, 32);  // AE..AF (cols 30..31)
    const tramoH  = row.slice(33, 62);  // AH..BJ (acotado: las cols BK+ se escriben aparte, celda a celda)  // AH..BH (cols 33..59) — incluye en_hoy (BF), visto_hoy (BG) y fecha_pte_cobro (BH)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `comunidades!A${rowIndex}:AA${rowIndex}`,  values: [tramoA]  },
          { range: `comunidades!AE${rowIndex}:AF${rowIndex}`, values: [tramoEF] },
          { range: `comunidades!AH${rowIndex}:BJ${rowIndex}`, values: [tramoH]  },
        ],
      },
    });
  }
  async function crearComunidad(datos) {
    const sheets = getSheetsClient();
    if (!datos.fase_presupuesto) datos.fase_presupuesto = "01_CONTACTO";
    if (!datos.fecha_contacto) datos.fecha_contacto = new Date().toISOString().slice(0, 10);
    if (!datos.estado_comunidad) datos.estado_comunidad = "activa";
    // v17.21: asegurar que las 4 columnas calculadas se crean VACÍAS en el append
    // (luego un segundo update las pone con fórmulas USER_ENTERED).
    datos.beneficio_previsto = "";
    datos.beneficio_real     = "";
    datos.beneficio_desvio   = "";
    datos.tiempo_desvio      = "";
    const row = objToRow(datos);
    const apRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGO_COMUNIDADES,
      valueInputOption: "RAW",
      includeValuesInResponse: false,
      requestBody: { values: [row] },
    });
    // v17.21: tras el append, inyectar las 4 fórmulas nativas en la fila creada.
    // updatedRange devuelve algo como "comunidades!A210:BD210" → extraemos el nº fila.
    try {
      const m = String(apRes.data.updates && apRes.data.updates.updatedRange || "")
        .match(/!([A-Z]+)(\d+):/);
      if (m) {
        const n = parseInt(m[2], 10);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: [
              { range: `comunidades!AC${n}`, values: [[`=IF(OR(W${n}="";Y${n}="";AA${n}="");"";W${n}-Y${n}-AA${n})`]] },
              { range: `comunidades!AD${n}`, values: [[`=IF(AC${n}="";"";AC${n}-AB${n})`]] },
              { range: `comunidades!AG${n}`, values: [[`=IF(OR(AE${n}="";AF${n}="";AE${n}=0);"";1-AF${n}/AE${n})`]] },
            ],
          },
        });
      }
    } catch (e) {
      console.warn("[presupuestos] No se pudieron inyectar fórmulas en la nueva CCPP:", e.message);
    }
  }
  async function actualizarCampoComunidad(rowIndex, campo, valor) {
    if (!COLS.includes(campo)) throw new Error("Campo no permitido: " + campo);
    const sheets = getSheetsClient();

    // v17.76 — ESCRITURA "SOLO LA CELDA" (modelo Excel). Antes se leía la fila
    // entera, se cambiaba un campo y se reescribían ~56 celdas. Eso (a) reformateaba
    // de pasada otros campos que el usuario no había tocado (posible causa de
    // "se modifican solos") y (b) aplicaba una regularización heredada 08->09 que
    // ya no afecta a ninguna CCPP. Ahora se escribe ÚNICAMENTE la celda del campo.
    //
    // PROTECCIÓN: las 4 columnas calculadas por fórmula nativa del Sheet
    // (beneficio_previsto/real/desvio, tiempo_desvio) NO se pueden escribir desde
    // aquí: hacerlo borraría la fórmula. Si llega una, se rechaza.
    const CAMPOS_FORMULA = new Set(["beneficio_previsto","beneficio_real","beneficio_desvio","tiempo_desvio"]);
    if (CAMPOS_FORMULA.has(campo)) {
      throw new Error(`El campo "${campo}" es calculado por el Sheet y no se escribe directamente.`);
    }

    const colIdx = COLS.indexOf(campo);
    const letra = _colNumALetra(colIdx);
    // Formato del valor a escribir: número nativo para importes (2 dec) y tiempos
    // (1 dec), texto para el resto. Mismo criterio que objToRow para una celda.
    let valorCelda;
    if (COLS_NUM_IMPORTE.has(campo))      valorCelda = _toNumOrEmpty(valor, 2);
    else if (COLS_NUM_TIEMPO.has(campo))  valorCelda = _toNumOrEmpty(valor, 1);
    else                                  valorCelda = (valor == null ? "" : String(valor));

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `comunidades!${letra}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[valorCelda]] },
    });

    // v17.75 — RELEÍDO DE VERIFICACIÓN. Releemos ESA celda y comparamos con lo
    // que se quiso guardar. Si no coincide, lanzamos error: el endpoint /campo
    // lo convierte en respuesta de fallo y el front pinta el campo en ROJO. Así
    // el verde solo aparece si el dato está de verdad en el Sheet.
    const rel = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `comunidades!${letra}${rowIndex}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const leido = (rel.data.values && rel.data.values[0] && rel.data.values[0][0] != null)
      ? rel.data.values[0][0] : "";
    if (!_mismoValorGuardado(campo, valor, leido)) {
      console.error(`[actualizarCampoComunidad] VERIFICACIÓN FALLIDA ${campo} (fila ${rowIndex}): se quiso "${valor}" pero el Sheet tiene "${leido}"`);
      throw new Error(`El campo "${campo}" no quedó guardado en el Sheet (se intentó "${valor}", quedó "${leido}").`);
    }
  }

  // v17.75 — Convierte índice 0-based de columna a letra(s) de Sheet (0→A, 25→Z, 26→AA...).
  function _colNumALetra(n) {
    let s = "";
    n = n + 1; // a 1-based
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // v17.75 — Compara, con tolerancia según el tipo de campo, el valor que se
  // quiso guardar contra el que quedó en el Sheet. Devuelve true si son "el
  // mismo dato" (aunque difiera el formato), para no dar falsos rojos.
  function _mismoValorGuardado(campo, quiso, leido) {
    const sQ = String(quiso == null ? "" : quiso).trim();
    const sL = String(leido == null ? "" : leido).trim();
    if (sQ === sL) return true;            // idénticos como texto → OK
    if (sQ === "" && sL === "") return true;
    // Números (importes y tiempos): comparar por valor numérico.
    if (COLS_NUM_IMPORTE.has(campo) || COLS_NUM_TIEMPO.has(campo)) {
      const nQ = parseFloat(sQ.replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, ""));
      const nL = parseFloat(String(sL).replace(",", "."));
      if (isNaN(nQ) && isNaN(nL)) return true;
      if (isNaN(nQ) || isNaN(nL)) return sQ === sL;
      // tolerancia mínima por redondeo de coma flotante
      return Math.abs(nQ - nL) < 0.005;
    }
    // Fechas (YYYY-MM-DD): comparar la parte de fecha normalizada.
    if (/^fecha_/.test(campo)) {
      const dQ = _normFechaCmp(sQ), dL = _normFechaCmp(sL);
      if (dQ && dL) return dQ === dL;
    }
    // Texto: comparación ya hecha arriba (sQ === sL). Distinto → no coincide.
    return false;
  }

  // v17.75 — Normaliza una fecha a YYYY-MM-DD para comparar (acepta ISO con hora,
  // serial de Sheets, o ya formateada). Devuelve "" si no se puede interpretar.
  function _normFechaCmp(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Serial de fecha de Sheets (número de días desde 1899-12-30)
    if (/^\d+(\.\d+)?$/.test(s)) {
      const dias = parseInt(s, 10);
      const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  }

  // =================================================================
  // CAPA DE ACCESO — mail_plantillas (lectura) y mail_historico (insertar)
  // =================================================================
  // Estructura mail_plantillas (columnas A-J):
  //   A fase | B activo (SI/NO) | C asunto | D mensaje | E adjuntos_fijos
  //   F dias_primer_envio (no usado: el primero es manual)
  //   G dias_recurrente | H max_envios | I cco | J cuenta_envio (id de mail_cuentas)
  //
  // El contenido de las plantillas (asuntos, cuerpos, parámetros) vive
  // ÍNTEGRAMENTE en la pestaña `mail_plantillas` del Sheet. Aquí no hay
  // valores por defecto: si una plantilla no existe en el Sheet,
  // `leerPlantillaMail` devuelve null y el endpoint /enviar-mail responde
  // con error 400 "Sin plantilla para esa fase".
  //
  // Estructura mail_cuentas (columnas A-E):
  //   A id | B email | C password | D host | E puerto
  // Cada fila es una cuenta de envío SMTP. La plantilla referencia una
  // cuenta por su id en col J. Si una plantilla no tiene cuenta_envio,
  // /enviar-mail devuelve error claro.
  const MAIL_PLANTILLAS_DEFAULT = {};

  // ─────────────────────────────────────────────────────────────────
  // CACHÉ DE mail_plantillas (v17.20)
  // Antes: cada llamada a leerPlantillaMail / leerListaPlantillas /
  // verificarAdjuntosDePlantillasCron / guardarPlantillaMail leía el
  // rango entero (mail_plantillas!A:J) independientemente. El cron
  // diario disparaba ~50 lecturas por ejecución; /plantillas (admin)
  // disparaba 13 secuenciales. Eso saturaba la cuota de 60 reads/min.
  //
  // Ahora: una sola lectura del rango cubre TODAS las funciones
  // durante TTL_MS. Se invalida automáticamente al guardar una
  // plantilla (guardarPlantillaMail) para que cualquier lectura
  // posterior vea los datos nuevos al instante.
  //
  // Las filas se cachean en crudo (array de arrays, tal cual las
  // devuelve Sheets), porque las distintas funciones consumidoras
  // hacen parseos distintos (objeto completo, lista de fases, set
  // de URLs de adjuntos, etc.).
  // ─────────────────────────────────────────────────────────────────
  let _mailPlantillasRowsCache = null;
  let _mailPlantillasRowsCacheTs = 0;
  const MAIL_PLANTILLAS_CACHE_TTL_MS = 60_000; // 1 minuto

  // Devuelve las filas crudas de mail_plantillas (array de arrays, sin
  // cabecera filtrada — el consumidor salta la fila 0). Usa caché TTL.
  // Si forzar=true, ignora el caché y vuelve a leer del Sheet.
  // En caso de error, devuelve null (no cachea el fallo) para que la
  // siguiente llamada reintente y no se queden datos vacíos pegados.
  async function _leerFilasMailPlantillas(forzar = false) {
    const ahora = Date.now();
    if (!forzar && _mailPlantillasRowsCache &&
        (ahora - _mailPlantillasRowsCacheTs) < MAIL_PLANTILLAS_CACHE_TTL_MS) {
      return _mailPlantillasRowsCache;
    }
    const sheets = getSheetsClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_PLANTILLAS,
      });
      const rows = res.data.values || [];
      _mailPlantillasRowsCache = rows;
      _mailPlantillasRowsCacheTs = ahora;
      return rows;
    } catch (e) {
      // No cacheamos el fallo: dejamos el caché previo (si lo hay)
      // o devolvemos null para que el consumidor caiga a defaults.
      console.warn("[presupuestos] mail_plantillas no disponible, usando defaults:", e.message);
      throw e;
    }
  }

  // Invalida el caché de mail_plantillas. Llamar tras guardar/borrar
  // una fila para que la próxima lectura vea los cambios sin esperar
  // al TTL.
  function _invalidarCacheMailPlantillas() {
    _mailPlantillasRowsCache = null;
    _mailPlantillasRowsCacheTs = 0;
  }

  // Caché en memoria de cuentas. Se refresca al cargar y se invalida si falla auth.
  let _cuentasCache = null;
  let _cuentasCacheTs = 0;
  const CUENTAS_CACHE_TTL_MS = 60_000; // 1 minuto

  async function leerCuentasMail(forzar = false) {
    const ahora = Date.now();
    if (!forzar && _cuentasCache && (ahora - _cuentasCacheTs) < CUENTAS_CACHE_TTL_MS) {
      return _cuentasCache;
    }
    const sheets = getSheetsClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_CUENTAS,
      });
      const rows = res.data.values || [];
      // Saltar cabecera (fila 1). Cada fila restante es una cuenta.
      const cuentas = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[1]) continue;
        const id = String(r[0]).trim();
        if (!id) continue;
        cuentas.push({
          id,
          email:    String(r[1] || "").trim(),
          password: String(r[2] || ""),  // sin trim por si la pass tiene espacios
          host:     String(r[3] || "").trim(),
          puerto:   parseInt(r[4]) || 465,
          host_imap:   String(r[5] || "").trim(),
          puerto_imap: parseInt(r[6]) || 993,
        });
      }
      _cuentasCache = cuentas;
      _cuentasCacheTs = ahora;
      return cuentas;
    } catch (e) {
      console.warn("[presupuestos] mail_cuentas no disponible:", e.message);
      _cuentasCache = [];
      _cuentasCacheTs = ahora;
      return [];
    }
  }

  // Devuelve la cuenta con ese id, o null si no existe.
  async function buscarCuentaMail(id) {
    if (!id) return null;
    const cuentas = await leerCuentasMail();
    return cuentas.find(c => c.id === String(id).trim()) || null;
  }

  // Devuelve { to, cc } para una CCPP combinando email_administrador y email_presidente.
  // Reglas:
  //   - Solo admin           -> { to: admin,           cc: "" }
  //   - Solo presi           -> { to: presi,           cc: "" }
  //   - Ambos                -> { to: admin,           cc: presi }
  //   - Ninguno              -> { to: "",              cc: "" }
  //   - Ambos iguales        -> { to: admin,           cc: "" }   (no duplica)
  function _destinatariosCcpp(comu) {
    const a = String((comu && comu.email_administrador) || "").trim();
    const p = String((comu && comu.email_presidente)   || "").trim();
    if (a && p) {
      if (a.toLowerCase() === p.toLowerCase()) return { to: a, cc: "" };
      return { to: a, cc: p };
    }
    if (a) return { to: a, cc: "" };
    if (p) return { to: p, cc: "" };
    return { to: "", cc: "" };
  }

  // Envía un mail real vía SMTP usando la cuenta indicada.
  // - cuentaId: id de la fila en mail_cuentas (ej. "administracion").
  // - destinatario: email(s) del destinatario principal ("To"). Acepta varios separados por coma.
  // =================================================================
  // ADJUNTOS REALES (descarga de Drive y adjunto al mail)
  // =================================================================
  // Cache en memoria de links Drive verificados (rotos detectados por la última
  // ronda de verificación o por intento de envío fallido). Esto alimenta al
  // futuro botón HOY → subtarea "Adjuntos rotos".
  // Estructura: Map<url, { ultimaComprobacion: Date, motivo: string }>
  const _adjuntosRotos = new Map();

  // Extrae el ID de un link de Drive en cualquier formato común.
  function extraerIdDrive(url) {
    if (!url) return null;
    const s = String(url).trim();
    let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    // v18.122 — Google Docs/Sheets/Slides nativos: /document/d/ID, /spreadsheets/d/ID, /presentation/d/ID
    m = s.match(/\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  }

  // v18.122 — tipo de documento nativo de Google a partir del link (o null si es archivo normal).
  // Sirve para saber si hay que EXPORTAR (Docs no se descargan, se exportan a PDF).
  function tipoGoogleNativo(url) {
    const s = String(url || "");
    if (/\/document\/d\//.test(s)) return "document";
    if (/\/spreadsheets\/d\//.test(s)) return "spreadsheets";
    if (/\/presentation\/d\//.test(s)) return "presentation";
    return null;
  }

  // Dada una entrada "LABEL: url" devuelve { label, url }.
  function parsearEntradaAdjunto(s) {
    const str = String(s || "").trim();
    if (!str) return null;
    const idxHttp = str.search(/https?:\/\//i);
    if (idxHttp < 0) {
      return { label: str.replace(/:\s*$/, "").trim(), url: "" };
    }
    const label = str.slice(0, idxHttp).replace(/[:\s]+$/, "").trim();
    const url = str.slice(idxHttp).trim();
    return { label, url };
  }

  // Parsea texto completo de adjuntos ("LABEL: url || LABEL: url || ...").
  // Devuelve array de { label, url }. Las entradas con URL vacía se mantienen
  // (representan huecos sin link, que se ignoran en el envío).
  function parsearAdjuntosTexto(texto) {
    if (!texto) return [];
    const partes = String(texto).split(/\|\||[\r\n]+/);
    const out = [];
    for (const p of partes) {
      const entry = parsearEntradaAdjunto(p);
      if (!entry) continue;
      if (!entry.url && !entry.label) continue;
      out.push(entry);
    }
    return out;
  }

  // Descarga binaria con soporte de redirects (3xx).
  function _descargarConRedirects(url, maxRedirects) {
    return new Promise((resolve, reject) => {
      let u;
      try { u = new URL(url); } catch (e) { return reject(new Error("URL inválida: " + url)); }
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (maxRedirects <= 0) return reject(new Error("Demasiados redirects"));
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          _descargarConRedirects(next, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}${res.statusMessage ? " " + res.statusMessage : ""}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({
          buffer: Buffer.concat(chunks),
          headers: res.headers,
        }));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.setTimeout(20000, () => req.destroy(new Error("Timeout descargando " + url)));
    });
  }

  // Descarga un archivo público de Drive. Devuelve { buffer, filename, mimeType, size }.
  // Lanza error si falla.
  async function descargarDeDrive(driveUrl) {
    const id = extraerIdDrive(driveUrl);
    if (!id) throw new Error("URL de Drive no reconocida: " + driveUrl);
    // v18.122 — Google Docs/Sheets/Slides nativos: NO se descargan con uc?export=download
    //   (no son archivos, son documentos). Se EXPORTAN a PDF con la API autenticada.
    const tipoNativo = tipoGoogleNativo(driveUrl);
    if (tipoNativo) {
      try {
        const drive = getDriveClient();
        // nombre real del documento (para el filename del adjunto)
        let nombreDoc = "documento";
        try {
          const meta = await drive.files.get({ fileId: id, fields: "name" });
          if (meta && meta.data && meta.data.name) nombreDoc = meta.data.name;
        } catch (_) {}
        const exp = await drive.files.export(
          { fileId: id, mimeType: "application/pdf" },
          { responseType: "arraybuffer" }
        );
        const buffer = Buffer.from(exp.data);
        return { buffer, filename: nombreDoc.replace(/\.(docx?|xlsx?|pptx?)$/i, "") + ".pdf", mimeType: "application/pdf", size: buffer.length };
      } catch (e) {
        throw new Error("No se pudo exportar el documento de Google a PDF: " + (e && e.message ? e.message : e));
      }
    }
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    const { buffer, headers } = await _descargarConRedirects(downloadUrl, 5);
    let filename = "archivo";
    const cd = headers["content-disposition"] || "";
    let m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m) {
      try { filename = decodeURIComponent(m[1]); } catch (_) { filename = m[1]; }
    } else {
      m = cd.match(/filename="?([^";]+)"?/i);
      if (m) filename = m[1];
    }
    const mimeType = (headers["content-type"] || "application/octet-stream").split(";")[0].trim();
    // Detección de "Google Drive can't scan" cuando archivo > 100MB: devuelve HTML.
    if (mimeType.startsWith("text/html") && buffer.length < 1024 * 1024) {
      const txt = buffer.toString("utf8");
      if (/can't scan|virus|too large/i.test(txt)) {
        throw new Error("Drive bloqueó la descarga (archivo demasiado grande para escaneo antivirus)");
      }
    }
    return { buffer, filename, mimeType, size: buffer.length };
  }

  // Verifica si un link de Drive está accesible. Devuelve { ok, motivo }.
  async function verificarLinkDrive(driveUrl) {
    const id = extraerIdDrive(driveUrl);
    if (!id) return { ok: false, motivo: "URL no reconocida" };
    // v18.122 — Google Docs/Sheets/Slides: uc?export=download NO vale para verificar
    //   (dan HTML/redirección). Se comprueba con la API autenticada que el doc existe.
    if (tipoGoogleNativo(driveUrl)) {
      try {
        const drive = getDriveClient();
        await drive.files.get({ fileId: id, fields: "id" });
        return { ok: true, motivo: "" };
      } catch (e) {
        return { ok: false, motivo: (e && e.message) ? e.message : "no accesible" };
      }
    }
    const checkUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    return new Promise((resolve) => {
      try {
        const req = https.get(checkUrl, (res) => {
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          res.resume();
          resolve({
            ok,
            motivo: ok ? "" : `HTTP ${res.statusCode}`,
          });
        });
        req.on("error", (e) => resolve({ ok: false, motivo: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, motivo: "Timeout" }); });
      } catch (e) {
        resolve({ ok: false, motivo: e.message });
      }
    });
  }

  // Devuelve cliente de Drive autenticado (reutiliza el OAuth2 del bot).
  function getDriveClient() {
    return google.drive({ version: "v3", auth: getGoogleAuth() });
  }

  // Busca (o crea si no existe) una subcarpeta para un expediente dentro
  // de la carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES.
  // Nombre de la carpeta: "tipo_via direccion" (ej. "C Alberche 17").
  // Devuelve el id de la carpeta. Si no hay configurada la carpeta padre,
  // devuelve null sin lanzar error (no debe bloquear la creación del expediente).
  // Asegura la subcarpeta "00 imagenes" dentro de la carpeta del expediente (no debe bloquear).
  async function _ensureSubImagenes(drive, parentId) {
    try {
      const sub = "00 imagenes";
      const q = await drive.files.list({
        q: `name='${sub}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1,
      });
      if (q.data.files && q.data.files.length > 0) return q.data.files[0].id;
      const sc = await drive.files.create({
        requestBody: { name: sub, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id",
      });
      console.log(`[presupuestos] subcarpeta Drive creada: "${sub}" (id=${sc.data.id})`);
      return sc.data.id;
    } catch (e) {
      console.warn("[presupuestos] no se pudo crear la subcarpeta 00 imagenes:", e && e.message);
      return null;
    }
  }
  async function getOrCreateCarpetaExpediente(tipoVia, direccion) {
    const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
    if (!parentId) {
      console.warn("[presupuestos] DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES no configurada, se omite creación de carpeta");
      return null;
    }
    const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
    if (!nombre) {
      console.warn("[presupuestos] getOrCreateCarpetaExpediente: nombre vacío, se omite");
      return null;
    }
    // Escapar comillas simples del nombre para la query de Drive.
    const nombreSafe = nombre.replace(/'/g, "\\'");
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      console.log(`[presupuestos] carpeta Drive ya existe: "${nombre}" (id=${busq.data.files[0].id})`);
      const _expId = busq.data.files[0].id; await _ensureSubImagenes(drive, _expId); return _expId;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: nombre,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos] carpeta Drive creada: "${nombre}" (id=${nueva.data.id})`);
    const _expId = nueva.data.id; await _ensureSubImagenes(drive, _expId); return _expId;
  }
  // Lee 01.png..11.png de la subcarpeta "00 imagenes" del expediente Plan 5 y las devuelve como data URLs (array de 11; null donde falte). Nunca lanza.
  async function getImagenesExpediente(tipoVia, direccion) {
    const out = new Array(11).fill(null);
    try {
      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) return out;
      const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
      if (!nombre) return out;
      const drive = getDriveClient();
      const findFolder = async (name, parent) => {
        const safe = String(name).replace(/'/g, "\\'");
        const r = await drive.files.list({
          q: `name='${safe}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id,name)", pageSize: 1,
        });
        return (r.data.files && r.data.files[0]) ? r.data.files[0].id : null;
      };
      const expId = await findFolder(nombre, parentId);
      if (!expId) return out;
      const imgId = await findFolder("00 imagenes", expId);
      if (!imgId) return out;
      const lst = await drive.files.list({
        q: `'${imgId}' in parents and trashed=false`,
        fields: "files(id,name)", pageSize: 100,
      });
      const byName = {};
      (lst.data.files || []).forEach(function (fl) { byName[String(fl.name).toLowerCase()] = fl.id; });
      for (let k = 1; k <= 11; k++) {
        const fid = byName[("0" + k).slice(-2) + ".png"];
        if (!fid) continue;
        try {
          const dl = await drive.files.get({ fileId: fid, alt: "media" }, { responseType: "arraybuffer" });
          out[k - 1] = "data:image/png;base64," + Buffer.from(dl.data).toString("base64");
        } catch (e2) { console.warn("[presupuestos] no se pudo descargar " + ("0"+k).slice(-2) + ".png:", e2 && e2.message); }
      }
      return out;
    } catch (e) {
      console.warn("[presupuestos] getImagenesExpediente:", e && e.message);
      return out;
    }
  }
  // Sirve UNA foto suelta (n=1..11) del expediente, para carga lazy en el navegador. Devuelve Buffer o null.
  async function getImagenExpediente(tipoVia, direccion, n) {
    try {
      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) return null;
      const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
      if (!nombre) return null;
      const k = parseInt(n, 10); if (!(k >= 1 && k <= 12)) return null;
      const drive = getDriveClient();
      const findFolder = async (name, parent) => {
        const safe = String(name).replace(/'/g, "\\'");
        const r = await drive.files.list({ q: `name='${safe}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id,name)", pageSize: 1 });
        return (r.data.files && r.data.files[0]) ? r.data.files[0].id : null;
      };
      const expId = await findFolder(nombre, parentId); if (!expId) return null;
      const imgId = await findFolder("00 imagenes", expId); if (!imgId) return null;
      const fname = ("0" + k).slice(-2) + ".png";
      const safe = fname.replace(/'/g, "\\'");
      const lst = await drive.files.list({ q: `name='${safe}' and '${imgId}' in parents and trashed=false`, fields: "files(id,name)", pageSize: 1 });
      const fid = (lst.data.files && lst.data.files[0]) ? lst.data.files[0].id : null;
      if (!fid) return null;
      const dl = await drive.files.get({ fileId: fid, alt: "media" }, { responseType: "arraybuffer" });
      return Buffer.from(dl.data);
    } catch (e) { console.warn("[presupuestos] getImagenExpediente:", e && e.message); return null; }
  }

  // ===================================================================
  // IMAP — Lectura de mails entrantes
  // ===================================================================
  // Las dependencias imapflow y mailparser se cargan perezosamente para no
  // romper el arranque si por alguna razón no están instaladas.
  let _ImapFlow = null;
  let _simpleParser = null;
  function _cargarDepsImap() {
    if (!_ImapFlow) {
      try { _ImapFlow = require("imapflow").ImapFlow; }
      catch (e) { throw new Error("Falta dependencia 'imapflow'. Instalar con: npm install imapflow"); }
    }
    if (!_simpleParser) {
      try { _simpleParser = require("mailparser").simpleParser; }
      catch (e) { throw new Error("Falta dependencia 'mailparser'. Instalar con: npm install mailparser"); }
    }
  }

  // Devuelve el cuerpo entero del mail SIN recortar el hilo de respuestas.
  // (Antes recortaba en el primer "El X escribió:" / "On X wrote:" / etc.
  //  Cambiado en v17.3 a petición de Guille: queremos el hilo completo.)
  function _limpiarCuerpoMail(texto) {
    if (!texto) return "";
    return String(texto).trim();
  }

  // Sube un buffer a Drive dentro de la carpeta indicada y devuelve el webViewLink.
  async function _subirBufferADrive(buffer, filename, mimeType, carpetaId) {
    const { Readable } = require("stream");
    const drive = getDriveClient();
    const file = await drive.files.create({
      requestBody: { name: filename, parents: [carpetaId] },
      media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
      fields: "id, name, webViewLink",
    });
    return file.data;
  }

  // [v17.13] Función clasificarMailEntrante eliminada por completo.
  // No se calculan ni almacenan sugerencias automáticas.


  // Garantiza que existe la carpeta IMAP "Descargados a plataforma" y devuelve
  // su nombre exacto. Si no existe, la crea.
  async function _asegurarCarpetaImap(client) {
    const NOMBRE = "Descargados a plataforma";
    try {
      const lista = await client.list();
      const existe = lista.some(box => box.path === NOMBRE || box.name === NOMBRE);
      if (!existe) {
        await client.mailboxCreate(NOMBRE);
        console.log(`[presupuestos][imap] Carpeta IMAP creada: ${NOMBRE}`);
      }
    } catch (e) {
      console.warn(`[presupuestos][imap] No se pudo asegurar carpeta IMAP "${NOMBRE}":`, e.message);
    }
    return NOMBRE;
  }

  // [v18.138] Devuelve (o crea) la subcarpeta "00 ARCHIVOS MAILS PENDIENTES"
  // dentro de la carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES. Es el
  // destino temporal de los adjuntos entrantes hasta que se clasifica el mail.
  async function _getOrCreateCarpetaMailsPendientes() {
    const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES || null;
    if (!parentId) return null;
    const NOMBRE = "00 ARCHIVOS MAILS PENDIENTES";
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='${NOMBRE}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: NOMBRE,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos][imap] Subcarpeta '${NOMBRE}' creada (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  // [v17.13] Sube los adjuntos del mail a la carpeta padre
  // DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES. Las sugerencias automáticas se
  // eliminaron, así que SIEMPRE se sube a la carpeta padre (quedan "sueltos"
  // hasta que el usuario clasifique el mail manualmente).
  // Devuelve string formato "LABEL: url || LABEL: url" igual que mail_historico.
  async function _subirAdjuntosEntrantes(adjuntos) {
    if (!adjuntos || adjuntos.length === 0) return "";
    const carpetaId = await _getOrCreateCarpetaMailsPendientes();
    if (!carpetaId) {
      console.warn("[presupuestos][imap] No hay carpeta destino para adjuntos, se omiten");
      return "";
    }
    const links = [];
    for (const adj of adjuntos) {
      try {
        const subida = await _subirBufferADrive(adj.content, adj.filename, adj.contentType, carpetaId);
        const label = (adj.filename || "ADJUNTO").replace(/\|/g, "_");
        const url = subida.webViewLink || `https://drive.google.com/file/d/${subida.id}/view`;
        links.push(`${label}: ${url}`);
      } catch (e) {
        console.error(`[presupuestos][imap] Error subiendo adjunto "${adj.filename}":`, e.message);
      }
    }
    return links.join(" || ");
  }

  // Guarda un mail entrante en la pestaña mails_pendientes del Sheet.
  async function _guardarMailPendiente(datos) {
    const sheets = getSheetsClient();
    const fila = [
      datos.id || "",
      datos.fecha_recepcion || new Date().toISOString(),
      datos.message_id || "",
      datos.in_reply_to || "",
      datos.references || "",
      datos.remitente || "",
      datos.asunto || "",
      datos.cuerpo || "",
      datos.adjuntos || "",
      JSON.stringify(datos.sugerencias || []),
      datos.estado || "pendiente",
      datos.clasificado_a || "",
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGO_MAILS_PENDIENTES,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });
  }

  // Lee mails_pendientes y devuelve todas las filas que están "en HOY".
  // Esto incluye:
  //   - estado="pendiente"   → mail recién llegado, sin clasificar.
  //   - estado="clasificado" → mail ya asignado a un expediente pero
  //                            que el usuario quiere mantener visible en HOY.
  // NO devuelve filas con estado="descartado" (compat por si quedaran).
  async function leerMailsPendientes() {
    const sheets = getSheetsClient();
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
      });
      const rows = r.data.values || [];
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const estado = String(row[10] || "pendiente");
        if (estado === "descartado") continue;
        // [v17.13] La columna J (sugerencias) ya no se lee: lógica eliminada.
        out.push({
          _rowIndex: i + 1, // 1-based en Sheet
          id: row[0] || "",
          fecha_recepcion: row[1] || "",
          message_id: row[2] || "",
          in_reply_to: row[3] || "",
          references: row[4] || "",
          remitente: row[5] || "",
          asunto: row[6] || "",
          cuerpo: row[7] || "",
          adjuntos: row[8] || "",
          sugerencias: [],
          estado,
          clasificado_a: row[11] || "",
        });
      }
      // Ordenar ascendente por fecha_recepcion (más antiguos arriba).
      out.sort((a, b) => {
        const ta = Date.parse(a.fecha_recepcion);
        const tb = Date.parse(b.fecha_recepcion);
        if (isNaN(ta) && isNaN(tb)) return 0;
        if (isNaN(ta)) return 1;
        if (isNaN(tb)) return -1;
        return ta - tb;
      });
      return out;
    } catch (e) {
      console.error("[presupuestos][imap] Error leyendo mails_pendientes:", e.message);
      return [];
    }
  }

  // Devuelve un Set con los message_id que están actualmente "en HOY"
  // (presentes en mails_pendientes con estado != descartado). Usado en
  // la cajita Comunicaciones para pintar el reloj encendido/apagado.
  async function leerMessageIdsEnHoy() {
    const lista = await leerMailsPendientes();
    const ids = new Set();
    for (const m of lista) {
      if (m.message_id) ids.add(String(m.message_id).trim());
    }
    return ids;
  }

  // Marca un mail pendiente como "clasificado" o "descartado" en el Sheet.
  // No borra la fila — queda como auditoría.
  async function _actualizarEstadoMailPendiente(id, nuevoEstado, clasificadoA) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
    });
    const rows = r.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "") === String(id)) {
        const filaSheet = i + 1; // 1-based
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `mails_pendientes!K${filaSheet}:L${filaSheet}`,
          valueInputOption: "RAW",
          requestBody: { values: [[nuevoEstado, clasificadoA || ""]] },
        });
        return true;
      }
    }
    return false;
  }

  // Extrae los IDs de Drive de un texto "LABEL: url || LABEL: url".
  function _extraerIdsDriveDeTexto(texto) {
    const ids = [];
    if (!texto) return ids;
    const partes = String(texto).split(/\s*\|\|\s*/);
    for (const p of partes) {
      // Buscar URL de Drive en cada parte
      const m = p.match(/\/d\/([a-zA-Z0-9_-]{20,})|id=([a-zA-Z0-9_-]{20,})/);
      if (m) ids.push(m[1] || m[2]);
    }
    return ids;
  }

  // Manda a la papelera de Drive los archivos referenciados en una cadena
  // de adjuntos. No bloquea, solo logea errores.
  async function _papelearAdjuntosDeTexto(texto) {
    const ids = _extraerIdsDriveDeTexto(texto);
    if (ids.length === 0) return 0;
    const drive = getDriveClient();
    let okCount = 0;
    for (const fileId of ids) {
      try {
        await drive.files.update({ fileId, requestBody: { trashed: true } });
        okCount++;
      } catch (e) {
        console.warn(`[presupuestos] No se pudo papelear archivo Drive ${fileId}:`, e.message);
      }
    }
    return okCount;
  }

  // Devuelve (o crea) la subcarpeta "adjuntos" dentro de la carpeta del
  // expediente. Se crea la primera vez que llega un adjunto a clasificar.
  async function _getOrCreateCarpetaAdjuntosExpediente(tipoVia, direccion) {
    const carpetaExp = await getOrCreateCarpetaExpediente(tipoVia, direccion);
    if (!carpetaExp) return null;
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='adjuntos' and '${carpetaExp}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: "adjuntos",
        mimeType: "application/vnd.google-apps.folder",
        parents: [carpetaExp],
      },
      fields: "id",
    });
    console.log(`[presupuestos] Subcarpeta 'adjuntos' creada en expediente "${tipoVia} ${direccion}" (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  // Mueve los archivos de Drive referenciados en `texto` a la subcarpeta
  // `adjuntos` del expediente indicado. Devuelve el texto actualizado con
  // los nuevos links (o el original si nada cambió).
  async function _moverAdjuntosACarpetaExpediente(texto, comu) {
    if (!texto || !comu) return texto;
    const ids = _extraerIdsDriveDeTexto(texto);
    if (ids.length === 0) return texto;
    let carpetaDestId;
    try {
      carpetaDestId = await _getOrCreateCarpetaAdjuntosExpediente(comu.tipo_via, comu.direccion);
    } catch (e) {
      console.warn("[presupuestos] No se pudo obtener subcarpeta adjuntos:", e.message);
      return texto;
    }
    if (!carpetaDestId) return texto;
    const drive = getDriveClient();
    // Reescribir el texto sustituyendo URLs viejas por las nuevas (que cambia
    // poco porque el ID no cambia al mover, solo cambian los parents).
    let textoOut = texto;
    for (const fileId of ids) {
      try {
        // Obtener parents actuales para quitarlos.
        const meta = await drive.files.get({ fileId, fields: "parents, webViewLink, name" });
        const parentsActuales = (meta.data.parents || []).join(",");
        await drive.files.update({
          fileId,
          addParents: carpetaDestId,
          removeParents: parentsActuales,
          fields: "id, parents",
        });
        console.log(`[presupuestos] Adjunto "${meta.data.name}" movido a carpeta adjuntos del expediente`);
      } catch (e) {
        console.warn(`[presupuestos] No se pudo mover archivo ${fileId} a carpeta expediente:`, e.message);
      }
    }
    return textoOut; // los webViewLink siguen funcionando aunque se haya movido
  }

  // Borra físicamente la fila de mails_pendientes y manda los adjuntos a la
  // papelera de Drive. Devuelve true si encontró y borró la fila.
  async function _borrarMailPendiente(id) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
    });
    const rows = r.data.values || [];
    let filaIdx = -1;
    let adjuntosTexto = "";
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "") === String(id)) {
        filaIdx = i;
        adjuntosTexto = rows[i][8] || "";
        break;
      }
    }
    if (filaIdx < 0) return false;
    // Papelear adjuntos primero.
    try {
      const n = await _papelearAdjuntosDeTexto(adjuntosTexto);
      if (n > 0) console.log(`[presupuestos] Mail ${id}: ${n} adjuntos enviados a papelera Drive`);
    } catch (e) {
      console.warn("[presupuestos] Error papeleando adjuntos:", e.message);
    }
    // Borrar fila físicamente.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const hoja = meta.data.sheets.find(s => s.properties.title === "mails_pendientes");
    if (!hoja) throw new Error("Pestaña mails_pendientes no encontrada");
    const sheetId = hoja.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: filaIdx,
              endIndex: filaIdx + 1,
            },
          },
        }],
      },
    });
    return true;
  }

  // Función principal: lee no leídos del IMAP, procesa cada uno, guarda
  // pendiente en Sheet, mueve a "Descargados a plataforma". Devuelve resumen.
  async function ejecutarLecturaImap() {
    _cargarDepsImap();
    const cuentas = await leerCuentasMail();
    if (!cuentas || cuentas.length === 0) {
      return { ok: false, error: "No hay cuentas en mail_cuentas" };
    }
    const cuenta = cuentas[0]; // primera cuenta = administracion
    if (!cuenta.host_imap) {
      return { ok: false, error: "Falta host_imap en mail_cuentas col F" };
    }
    const client = new _ImapFlow({
      host: cuenta.host_imap,
      port: cuenta.puerto_imap || 993,
      secure: true,
      auth: { user: cuenta.email, pass: cuenta.password },
      logger: false,
    });
    let procesados = 0;
    let errores = 0;
    const detalle_errores = [];
    try {
      await client.connect();
      const carpetaDestino = await _asegurarCarpetaImap(client);
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Buscar no leídos.
        const uids = await client.search({ seen: false }, { uid: true });
        console.log(`[presupuestos][imap] No leídos en INBOX: ${uids.length}`);
        for (const uid of uids) {
          try {
            const { content } = await client.download(uid, undefined, { uid: true });
            // Parsear el mail con mailparser.
            const parsed = await _simpleParser(content);
            const mail = {
              remitente: (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address) || "",
              asunto: parsed.subject || "",
              cuerpo: _limpiarCuerpoMail(
                parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")
              ),
              message_id: parsed.messageId || "",
              inReplyTo: parsed.inReplyTo || "",
              references: parsed.references || "",
              adjuntos: (parsed.attachments || []).map(a => ({
                filename: a.filename || "adjunto",
                content: a.content,
                contentType: a.contentType || "application/octet-stream",
              })),
            };
            // Sugerencias automáticas eliminadas: siempre se guarda sin asignar.
            // Subir adjuntos a carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES.
            const adjuntosStr = await _subirAdjuntosEntrantes(mail.adjuntos);
            // Guardar como pendiente
            const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await _guardarMailPendiente({
              id: idPendiente,
              fecha_recepcion: new Date().toISOString(),
              message_id: mail.message_id,
              in_reply_to: mail.inReplyTo,
              references: Array.isArray(mail.references) ? mail.references.join(" ") : mail.references,
              remitente: mail.remitente,
              asunto: mail.asunto,
              cuerpo: (mail.cuerpo || "").slice(0, 5000), // recortar por si es enorme
              adjuntos: adjuntosStr,
              sugerencias: [],
              estado: "pendiente",
            });
            // Marcar como leído + mover a carpeta procesados.
            try {
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              await client.messageMove(uid, carpetaDestino, { uid: true });
            } catch (eMove) {
              console.warn(`[presupuestos][imap] No se pudo mover uid=${uid}:`, eMove.message);
            }
            procesados++;
          } catch (errMail) {
            errores++;
            detalle_errores.push(`uid=${uid}: ${errMail.message}`);
            console.error(`[presupuestos][imap] Error procesando uid=${uid}:`, errMail.message);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      try { await client.logout(); } catch (_) {}
    }
    return { ok: true, procesados, errores, detalle_errores };
  }

  // ===================================================================
  // Importar .eml sueltos desde una carpeta de Drive
  // ===================================================================
  // Lee todos los .eml de la carpeta DRIVE_FOLDER_EML_IMPORTAR, los parsea
  // igual que el cron IMAP (stripping, clasificación, adjuntos, pendientes)
  // y los mueve a una subcarpeta "Procesados" para no reprocesarlos.
  // Útil cuando alguien reenvía un .eml como adjunto o cuando hay mails de
  // otra cuenta sin IMAP configurado.
  async function _getOrCreateSubcarpetaProcesados(parentId) {
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='Procesados' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: "Procesados",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos][eml] subcarpeta "Procesados" creada (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  async function importarEmlsDeDrive() {
    _cargarDepsImap();
    const parentId = process.env.DRIVE_FOLDER_EML_IMPORTAR;
    if (!parentId) {
      return { ok: false, error: "Falta variable DRIVE_FOLDER_EML_IMPORTAR en Render" };
    }
    const drive = getDriveClient();
    // Listar .eml de la carpeta (no incluye Procesados porque filtramos por parents).
    // mimeType de los .eml suele ser "message/rfc822", pero a veces se sube como
    // application/octet-stream, así que también filtramos por extensión.
    const lista = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: "files(id,name,mimeType)",
      pageSize: 200,
    });
    const archivos = (lista.data.files || []).filter(f => {
      const n = String(f.name || "").toLowerCase();
      return n.endsWith(".eml") || f.mimeType === "message/rfc822";
    });
    console.log(`[presupuestos][eml] archivos .eml encontrados: ${archivos.length}`);
    if (archivos.length === 0) {
      return { ok: true, procesados: 0, errores: 0, detalle_errores: [] };
    }
    let procesadosCarpeta = null;
    try {
      procesadosCarpeta = await _getOrCreateSubcarpetaProcesados(parentId);
    } catch (e) {
      console.error("[presupuestos][eml] no se pudo crear/obtener subcarpeta Procesados:", e.message);
      return { ok: false, error: "No se pudo crear subcarpeta Procesados: " + e.message };
    }
    let procesados = 0;
    let errores = 0;
    const detalle_errores = [];
    for (const f of archivos) {
      try {
        // Descargar el .eml como buffer.
        const dl = await drive.files.get(
          { fileId: f.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const buf = Buffer.from(dl.data);
        // Parsear con mailparser.
        const parsed = await _simpleParser(buf);
        const remitenteEml = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address) || "";
        // Si es saliente (lo enviamos nosotros), capturar destinatario del To:
        // y prefijarlo al cuerpo con marcador [TO:...] para que al clasificar
        // se pueda extraer sin tocar el esquema de mails_pendientes.
        const esSalienteImp = remitenteEml.toLowerCase().includes("administracion@instalacionesaraujo.com");
        let destinatarioEml = "";
        if (esSalienteImp && parsed.to && parsed.to.value && parsed.to.value.length) {
          destinatarioEml = parsed.to.value.map(t => t.address).filter(Boolean).join(", ");
        }
        let cuerpoBase = _limpiarCuerpoMail(
          parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")
        );
        if (esSalienteImp && destinatarioEml) {
          cuerpoBase = `[TO:${destinatarioEml}]\n${cuerpoBase}`;
        }
        const mail = {
          remitente: remitenteEml,
          asunto: parsed.subject || "",
          cuerpo: cuerpoBase,
          message_id: parsed.messageId || "",
          inReplyTo: parsed.inReplyTo || "",
          references: parsed.references || "",
          adjuntos: (parsed.attachments || []).map(a => ({
            filename: a.filename || "adjunto",
            content: a.content,
            contentType: a.contentType || "application/octet-stream",
          })),
        };
        // Sugerencias automáticas eliminadas: siempre se guarda sin asignar.
        const adjuntosStr = await _subirAdjuntosEntrantes(mail.adjuntos);
        // Fecha real del mail (cabecera Date). Si no viene, caemos a "ahora".
        let fechaMail;
        try {
          if (parsed.date) {
            const d = (parsed.date instanceof Date) ? parsed.date : new Date(parsed.date);
            if (!isNaN(d.getTime())) fechaMail = d.toISOString();
          }
        } catch (_) {}
        if (!fechaMail) fechaMail = new Date().toISOString();
        // Guardar como pendiente
        const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await _guardarMailPendiente({
          id: idPendiente,
          fecha_recepcion: fechaMail,
          message_id: mail.message_id,
          in_reply_to: mail.inReplyTo,
          references: Array.isArray(mail.references) ? mail.references.join(" ") : mail.references,
          remitente: mail.remitente,
          asunto: mail.asunto,
          cuerpo: (mail.cuerpo || "").slice(0, 5000),
          adjuntos: adjuntosStr,
          sugerencias: [],
          estado: "pendiente",
        });
        // Mover el .eml a subcarpeta Procesados.
        try {
          const meta = await drive.files.get({ fileId: f.id, fields: "parents" });
          const prevParents = (meta.data.parents || []).join(",");
          await drive.files.update({
            fileId: f.id,
            addParents: procesadosCarpeta,
            removeParents: prevParents,
            fields: "id, parents",
          });
        } catch (eMove) {
          console.warn(`[presupuestos][eml] no se pudo mover "${f.name}":`, eMove.message);
        }
        procesados++;
        console.log(`[presupuestos][eml] procesado "${f.name}" → mails_pendientes (${idPendiente})`);
      } catch (errEml) {
        errores++;
        detalle_errores.push(`${f.name}: ${errEml.message}`);
        console.error(`[presupuestos][eml] error procesando "${f.name}":`, errEml.message);
      }
    }
    return { ok: true, procesados, errores, detalle_errores };
  }

  // Cron interno cada 5 minutos. Se inicia al cargar el módulo.
  let _imapCronEnMarcha = false;
  function _arrancarCronImap() {
    const INTERVALO_MS = 30 * 60 * 1000;
    async function tick() {
      if (_imapCronEnMarcha) return;
      _imapCronEnMarcha = true;
      try {
        const r = await ejecutarLecturaImap();
        if (r.procesados > 0 || r.errores > 0) {
          console.log(`[presupuestos][imap][cron] procesados=${r.procesados} errores=${r.errores}`);
        }
      } catch (e) {
        console.error("[presupuestos][imap][cron] error:", e.message);
      } finally {
        _imapCronEnMarcha = false;
      }
    }
    // Primer tick al minuto de arrancar; después cada 5 min.
    setTimeout(tick, 60 * 1000);
    setInterval(tick, INTERVALO_MS);
    console.log(`[presupuestos][imap] Cron arrancado (intervalo ${INTERVALO_MS / 1000}s)`);
  }
  // Arrancar cron solo si la variable está habilitada (para poder desactivar
  // en dev). Por defecto, activado.
  if (process.env.IMAP_CRON_DISABLED !== "1") {
    _arrancarCronImap();
  }

  // Procesa una lista de adjuntos: descarga los que tienen URL, devuelve
  // { attachments, rotos, ignorados }.
  //   attachments: array para nodemailer ({ filename, content, contentType })
  //   rotos: array de { label, url, motivo } — links que fallaron
  //   ignorados: array de labels que no tenían URL (huecos)
  async function procesarAdjuntos(textoAdjuntos) {
    const entradas = parsearAdjuntosTexto(textoAdjuntos);
    const attachments = [];
    const rotos = [];
    const ignorados = [];
    for (const e of entradas) {
      if (!e.url) {
        ignorados.push(e.label);
        continue;
      }
      // Si no es Drive, lo ignoramos (no sabemos descargarlo) — más adelante se podría ampliar.
      if (!extraerIdDrive(e.url)) {
        rotos.push({ label: e.label, url: e.url, motivo: "No es un link de Drive válido" });
        continue;
      }
      try {
        const f = await descargarDeDrive(e.url);
        attachments.push({
          filename: f.filename,
          content: f.buffer,
          contentType: f.mimeType,
        });
        // Si previamente estaba marcado como roto, lo limpiamos.
        _adjuntosRotos.delete(e.url);
      } catch (err) {
        rotos.push({ label: e.label, url: e.url, motivo: err.message });
        _adjuntosRotos.set(e.url, { ultimaComprobacion: new Date(), motivo: err.message });
      }
    }
    return { attachments, rotos, ignorados };
  }

  // Devuelve la lista actual de adjuntos rotos detectados (en memoria).
  function listarAdjuntosRotos() {
    const out = [];
    for (const [url, info] of _adjuntosRotos.entries()) {
      out.push({ url, ultimaComprobacion: info.ultimaComprobacion, motivo: info.motivo });
    }
    return out;
  }

  // =================================================================
  // ENVÍO REAL DE MAILS
  // =================================================================

  // Función central de envío.
  // - cuentaId: id de fila en mail_cuentas (típicamente "administracion").
  // - destinatario: string ("a@b.com" o "a@b.com, c@d.com").
  // - cc: array o string — destinatarios en CC (visible).
  // - cco: array o string — destinatarios en BCC.
  // - asunto, mensaje (texto plano).
  // - adjuntosUrls: array de strings con formato "LABEL: url" (separados por
  //   || antes de llegar aquí) O un texto crudo "LABEL: url || LABEL: url".
  //   Las URLs de Drive se DESCARGAN y se adjuntan como adjuntos reales.
  //   Si algún link falla, se LANZA error y NO se envía el mail (regla del usuario:
  //   ningún mail debe salir sin sus adjuntos). El error indica qué link está roto
  //   para que se pueda diagnosticar.
  // Lanza error si falla. Devuelve el messageId.
  async function enviarMailReal({ cuentaId, destinatario, cc, cco, asunto, mensaje, adjuntosUrls }) {
    if (!destinatario) throw new Error("Falta destinatario");
    const cuenta = await buscarCuentaMail(cuentaId);
    if (!cuenta) throw new Error(`Cuenta de envío "${cuentaId}" no encontrada en mail_cuentas`);
    if (!cuenta.email || !cuenta.password || !cuenta.host) {
      throw new Error(`Cuenta "${cuentaId}" mal configurada (faltan email/password/host)`);
    }

    let cuerpo = String(mensaje || "");

    // Procesar adjuntos: si recibimos array, lo unimos con "||" para reusar el parser único.
    let textoAdj = "";
    if (Array.isArray(adjuntosUrls)) {
      textoAdj = adjuntosUrls.filter(Boolean).join(" || ");
    } else if (adjuntosUrls) {
      textoAdj = String(adjuntosUrls);
    }
    const { attachments, rotos, ignorados } = await procesarAdjuntos(textoAdj);
    if (rotos.length > 0) {
      const detalle = rotos.map(r => `· ${r.label || "(sin label)"}: ${r.motivo}`).join("\n");
      throw new Error(
        `No se envía el mail: ${rotos.length} adjunto(s) con link roto.\n${detalle}\n` +
        `URLs afectadas:\n${rotos.map(r => "  " + r.url).join("\n")}`
      );
    }
    // (los huecos sin link, "ignorados", se descartan en silencio — son labels
    // de adjuntos no rellenados por el usuario, comportamiento histórico.)

    // Pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D)
    try {
      const pie = await leerPlantillaMail("_PIE_GLOBAL");
      const textoPie = pie && pie.mensaje ? String(pie.mensaje).trim() : "";
      if (textoPie) cuerpo += "\n\n" + textoPie;
    } catch (e) { /* si falla, no se añade pie */ }

    // CC: aceptar string o array. Acepta separadores ||, comas, ;, saltos de línea.
    let ccStr = "";
    if (Array.isArray(cc)) ccStr = cc.filter(Boolean).join(", ");
    else if (cc) ccStr = String(cc).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");

    // CCO: aceptar string o array. Acepta separadores ||, comas, ;, saltos de línea.
    let bcc = "";
    if (Array.isArray(cco)) bcc = cco.filter(Boolean).join(", ");
    else if (cco) bcc = String(cco).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");

    const transporter = nodemailer.createTransport({
      host: cuenta.host,
      port: cuenta.puerto,
      secure: cuenta.puerto === 465, // true para 465, false para otros (TLS STARTTLS)
      auth: { user: cuenta.email, pass: cuenta.password },
      // Timeouts: si el SMTP se atasca, falla en vez de colgarse sin fin.
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });

    const info = await transporter.sendMail({
      from: cuenta.email,
      to: destinatario,
      cc:  ccStr || undefined,
      bcc: bcc   || undefined,
      subject: asunto || "",
      text: cuerpo,
      attachments: attachments.length ? attachments : undefined,
    });
    return info.messageId;
  }

  async function leerPlantillaMail(fase) {
    let rows;
    try {
      // v17.20: una sola lectura cacheada cubre todas las llamadas
      // dentro del TTL (60s). Antes era 1 lectura por llamada.
      rows = await _leerFilasMailPlantillas();
    } catch (e) {
      // Pestaña no existe o error de cuota → caer a defaults
      const def = MAIL_PLANTILLAS_DEFAULT[fase];
      return def ? Object.assign({ fase, activo: def.activo === "SI" }, def) : null;
    }
    // Header: A fase | B activo | C asunto | D mensaje | E adjuntos | F dias_primer | G dias_recurrente | H max_envios | I cco | J cuenta_envio
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      if (String(r[0]).trim() === fase) {
        return {
          fase,
          activo:           (r[1] || "SI").toUpperCase() === "SI",
          asunto:           r[2] || "",
          mensaje:          r[3] || "",
          adjuntos_fijos:   r[4] || "",
          dias_primer_envio: parseInt(r[5]) || 0,
          dias_recurrente:  parseInt(r[6]) || 0,
          max_envios:       parseInt(r[7]) || 0,
          cco:              r[8] || "",
          cuenta_envio:     (r[9] || "").trim(),
          _rowIndex:        i + 1, // fila real en el Sheet (1-based)
        };
      }
    }
    // Fase no encontrada → default si lo hay, null si no
    const def = MAIL_PLANTILLAS_DEFAULT[fase];
    return def ? Object.assign({ fase, activo: def.activo === "SI" }, def) : null;
  }

  // Guarda una plantilla en mail_plantillas. Si la fila existe, la actualiza; si no, la añade.
  async function guardarPlantillaMail(datos) {
    const sheets = getSheetsClient();
    const fila = [
      datos.fase || "",
      datos.activo === "SI" ? "SI" : "NO",
      datos.asunto || "",
      datos.mensaje || "",
      datos.adjuntos_fijos || "",
      String(datos.dias_primer_envio || 0),
      String(datos.dias_recurrente || 0),
      String(datos.max_envios || 0),
      datos.cco || "",
      datos.cuenta_envio || "",
    ];
    // Buscar si ya existe
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAIL_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === datos.fase) {
        rowIndex = i + 1; break;
      }
    }
    if (rowIndex > 0) {
      // Update
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `mail_plantillas!A${rowIndex}:J${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      // Append
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_MAIL_PLANTILLAS,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }
    // v17.20: invalidar caché para que la próxima lectura traiga la
    // plantilla recién guardada sin esperar al TTL de 60s.
    _invalidarCacheMailPlantillas();
  }

  // =================================================================
  // PLANTILLAS DE DOCUMENTOS (EMASESA) — tab `doc_plantillas` (v17.82)
  // Estructura: A clave | B titulo | C cuerpo | D activo
  // Mismo patrón que mail_plantillas pero más simple: el documento solo
  // tiene título y cuerpo (no asunto, ni días, ni cuenta de envío).
  // Filas especiales: _ENCABEZADO_GLOBAL y _PIE_GLOBAL (comunes a todos
  // los documentos, igual que el _PIE_GLOBAL de los mails).
  // =================================================================

  // Devuelve TODAS las filas de doc_plantillas como array de objetos
  // {clave, titulo, cuerpo, activo}. Sin caché (se edita poco; lectura directa).
  // ---- bot_plantillas (textos del bot WhatsApp) — patron calcado de doc_plantillas (v18.79) ----
  // PUNTO 1 (v18.83): lee el TEXTO real de una plantilla aprobada de Twilio desde su
  // Content API. Cache 10min + timeout 4s + fallback a "" (si falla o faltan credenciales).
  // Solo lectura; no envia nada.
  const _twilioTextoCache = new Map();
  const _TWILIO_TEXTO_TTL = 10 * 60 * 1000;
  function _extraerBodyTwilio(content) {
    try {
      const types = (content && content.types) ? content.types : {};
      for (const k of Object.keys(types)) {
        const t = types[k];
        if (t && typeof t.body === "string" && t.body.trim()) return t.body;
      }
      for (const k of Object.keys(types)) {
        const t = types[k];
        if (t && typeof t.title === "string" && t.title.trim()) return t.title;
      }
    } catch (e) {}
    return "";
  }
  function obtenerTextoTwilio(sid) {
    return new Promise((resolve) => {
      const id = String(sid || "").trim();
      if (!id) return resolve("");
      const cached = _twilioTextoCache.get(id);
      if (cached && (Date.now() - cached.ts) < _TWILIO_TEXTO_TTL) return resolve(cached.texto);
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      if (!SID || !TOKEN) return resolve("");
      const auth = Buffer.from(SID + ":" + TOKEN).toString("base64");
      const opts = {
        hostname: "content.twilio.com",
        path: "/v1/Content/" + encodeURIComponent(id),
        method: "GET",
        headers: { Authorization: "Basic " + auth },
        timeout: 4000,
      };
      const reqT = https.request(opts, (resp) => {
        let data = "";
        resp.on("data", (c) => { data += c; });
        resp.on("end", () => {
          let texto = "";
          try { texto = _extraerBodyTwilio(JSON.parse(data)); } catch (e) {}
          _twilioTextoCache.set(id, { texto, ts: Date.now() });
          resolve(texto);
        });
      });
      reqT.on("error", () => resolve(""));
      reqT.on("timeout", () => { try { reqT.destroy(); } catch (e) {} resolve(""); });
      reqT.end();
    });
  }

  async function leerPlantillasBot() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const act = (r[6] === undefined || r[6] === null || String(r[6]).trim() === "")
        ? true
        : ["SI", "1", "TRUE"].includes(String(r[6]).trim().toUpperCase());
      out.push({
        clave:        String(r[0]).trim(),
        destinatario: r[1] || "",
        tipo:         r[2] || "",
        texto:        r[3] || "",
        twilio_sid:   r[4] || "",
        variables:    r[5] || "",
        activo:       act,
        notas:        r[7] || "",
        _rowIndex:    i + 1,
      });
    }
    return out;
  }

  // Guarda una plantilla del bot por su clave. Para tipo 'twilio' toca el SID (E) y activo (G);
  // para el resto toca texto (D) y activo (G). Conserva las demas columnas. No crea filas.
  async function guardarPlantillaBot(datos) {
    const sheets = getSheetsClient();
    const clave = String(datos.clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    let fila = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) {
        rowIndex = i + 1; fila = rows[i]; break;
      }
    }
    if (rowIndex < 0) throw new Error("clave no encontrada: " + clave);
    const nueva = [];
    for (let c = 0; c < 8; c++) nueva[c] = (fila[c] != null ? fila[c] : "");
    nueva[0] = clave;
    if (String(datos.tipo || "").trim().toLowerCase() === "twilio") {
      nueva[4] = String(datos.twilio_sid != null ? datos.twilio_sid : ""); // col E: SID
    } else {
      nueva[3] = String(datos.texto != null ? datos.texto : ""); // col D: texto
    }
    nueva[6] = datos.activo ? "SI" : "NO";
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `bot_plantillas!A${rowIndex}:H${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [nueva] },
    });
  }

  // Guarda un AJUSTE del bot (fila tipo "ajuste") en bot_plantillas. Si la fila
  // (por clave) existe, actualiza su valor (col D); si no, la crea. v18.82
  async function guardarAjusteBot(clave, valor, activo) {
    const sheets = getSheetsClient();
    clave = String(clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1, fila = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) { rowIndex = i + 1; fila = rows[i]; break; }
    }
    if (rowIndex > 0) {
      const nueva = [];
      for (let c = 0; c < 8; c++) nueva[c] = (fila[c] != null ? fila[c] : "");
      nueva[0] = clave;
      nueva[3] = String(valor);
      if (!String(nueva[2]).trim()) nueva[2] = "ajuste";
      if (!String(nueva[6]).trim()) nueva[6] = "SI";
      if (activo !== undefined) nueva[6] = activo ? "SI" : "NO";
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: `bot_plantillas!A${rowIndex}:H${rowIndex}`,
        valueInputOption: "RAW", requestBody: { values: [nueva] },
      });
    } else {
      const nueva = [clave, "", "ajuste", String(valor), "", "", (activo === undefined ? "SI" : (activo ? "SI" : "NO")), "control de la pantalla Plantillas bot"];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
        valueInputOption: "RAW", requestBody: { values: [nueva] },
      });
    }
  }

  async function leerPlantillasDoc() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOC_PLANTILLAS,
    });
    const rows = res.data.values || [];
    const out = [];
    // Fila 0 = cabeceras; empezamos en la 1
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        clave:   String(r[0]).trim(),
        titulo:  r[1] || "",
        cuerpo:  r[2] || "",
        activo:  (r[3] === undefined || r[3] === null || String(r[3]).trim() === "") ? true
                  : (String(r[3]).trim() === "1" || String(r[3]).trim().toUpperCase() === "SI"),
        _rowIndex: i + 1, // fila real en el Sheet (1-based)
      });
    }
    return out;
  }

  // Devuelve UNA plantilla de documento por su clave, o null si no existe.
  async function leerPlantillaDoc(clave) {
    const todas = await leerPlantillasDoc();
    return todas.find(p => p.clave === clave) || null;
  }

  // Guarda una plantilla de documento. Si la fila (por clave) existe, la
  // actualiza; si no, la añade. Solo escribe título y cuerpo: la clave es el
  // identificador y la columna `activo` se respeta (no se toca desde aquí).
  async function guardarPlantillaDoc(datos) {
    const sheets = getSheetsClient();
    const clave = String(datos.clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    // Buscar si ya existe
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOC_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    let activoExistente = "1";
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) {
        rowIndex = i + 1;
        // conservar el valor de `activo` que ya tuviera la fila
        if (rows[i][3] !== undefined && rows[i][3] !== null && String(rows[i][3]).trim() !== "") {
          activoExistente = String(rows[i][3]).trim();
        }
        break;
      }
    }
    const fila = [
      clave,
      String(datos.titulo || ""),
      String(datos.cuerpo || ""),
      activoExistente, // se mantiene tal cual estaba (1 por defecto)
    ];
    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `doc_plantillas!A${rowIndex}:D${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_DOC_PLANTILLAS,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }
  }

  // =================================================================
  // GENERACIÓN DE DOCUMENTOS PDF (Sprint A — Bloque 2, v17.83)
  // =================================================================

  // Clasificación de documentos: GENERAL (de la comunidad, no pide piso)
  // o PARTICULAR (pide elegir un piso de la comunidad).
  const DOCS_GENERALES   = ["mantener_presion", "renunciar_presion"];
  const DOCS_PARTICULARES = ["paso_instalaciones", "usufructo", "piso_disidente", "contador_unico"];
  // Orden de presentación de los documentos (compartido por el menú de
  // impresión y la pantalla de plantillas) — decisión Guille:
  const ORDEN_DOCS = ["mantener_presion", "renunciar_presion", "usufructo", "piso_disidente", "contador_unico", "paso_instalaciones"];
  const _ordenDoc = c => { const i = ORDEN_DOCS.indexOf(c); return i === -1 ? 999 : i; };

  // Para cada documento, qué HUECOS tiene y de dónde se precarga cada uno.
  // origen: 'comunidad:<campo>' | 'piso:<campo>' | 'manual' | 'auto'
  // (los 'manual' salen vacíos para rellenar a mano; 'auto' = fecha de hoy).
  // El campo `tipo` (general/particular) decide si el menú pide piso.
  const DOC_HUECOS = {
    paso_instalaciones: { tipo: "particular", huecos: [
      { clave: "propietario",     label: "Propietario",         origen: "piso:nota_simple" },
      { clave: "nif_propietario", label: "NIF del propietario", origen: "manual" },
      { clave: "piso",            label: "Piso/local/trastero", origen: "piso:vivienda" },
      { clave: "comunidad",       label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
    ]},
    usufructo: { tipo: "particular", huecos: [
      { clave: "propietario",       label: "Propietario",           origen: "piso:nota_simple" },
      { clave: "nif_propietario",   label: "NIF del propietario",   origen: "manual" },
      { clave: "piso",              label: "Piso",                  origen: "piso:vivienda" },
      { clave: "comunidad",         label: "Comunidad (CCPP)",      origen: "comunidad:direccion_completa" },
      { clave: "usufructuario",     label: "Usufructuario",         origen: "piso:nombre" },
      { clave: "nif_usufructuario", label: "NIF del usufructuario", origen: "manual" },
    ]},
    mantener_presion: { tipo: "general", huecos: [
      { clave: "presidente",     label: "Presidente",          origen: "comunidad:presidente" },
      { clave: "nif_presidente", label: "NIF del presidente",  origen: "manual" },
      { clave: "comunidad",      label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
      { clave: "nif_comunidad",  label: "NIF de la comunidad", origen: "manual" },
    ]},
    renunciar_presion: { tipo: "general", huecos: [
      { clave: "presidente",     label: "Presidente",          origen: "comunidad:presidente" },
      { clave: "nif_presidente", label: "NIF del presidente",  origen: "manual" },
      { clave: "comunidad",      label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
      { clave: "nif_comunidad",  label: "NIF de la comunidad", origen: "manual" },
    ]},
    contador_unico: { tipo: "particular", huecos: [
      { clave: "propietario",     label: "Propietario",         origen: "piso:nota_simple" },
      { clave: "nif_propietario", label: "NIF del propietario", origen: "manual" },
      { clave: "pisos",           label: "Pisos (unidos)",      origen: "piso:vivienda" },
      { clave: "comunidad",       label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
    ]},
    piso_disidente: { tipo: "particular", huecos: [
      { clave: "comunidad", label: "Comunidad (CCPP)", origen: "comunidad:direccion_completa" },
      { clave: "piso",      label: "Piso",             origen: "piso:vivienda" },
      { clave: "titular",   label: "Titular",          origen: "piso:nota_simple" },
    ]},
  };

  // Devuelve el valor precargado de un hueco a partir de comu y piso.
  function _valorHueco(origen, comu, piso) {
    if (!origen || origen === "manual" || origen === "auto") return "";
    const [tipo, campo] = origen.split(":");
    if (tipo === "comunidad") {
      if (campo === "direccion_completa") {
        const tv = String(comu && comu.tipo_via || "").trim();
        const dir = String(comu && comu.direccion || "").trim();
        return (tv ? tv + " " : "") + dir;
      }
      return String((comu && comu[campo]) || "").trim();
    }
    if (tipo === "piso") {
      return String((piso && piso[campo]) || "").trim();
    }
    return "";
  }

  // Lista simple de los pisos de una comunidad (por id) para el menú de
  // selección. Empareja por dirección (como _leerPisosDeCcpp) pero sin
  // depender de la matriz de documentación. Devuelve {vivienda, propietario, usufructuario}.
  async function _pisosParaDocumentos(ccppId) {
    const comu = await buscarComunidadPorId(ccppId);
    if (!comu) return { comu: null, pisos: [] };
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return { comu, pisos: [] };
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    const idxNota = hdr.indexOf("nota_simple"); // propietario
    const idxNom = hdr.indexOf("nombre");       // usufructuario
    const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const objetivo = norm(comu.direccion);
    const pisos = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) !== objetivo) continue;
      pisos.push({
        vivienda:     idxViv  >= 0 ? String(f[idxViv]  || "").trim() : "",
        nota_simple:  idxNota >= 0 ? String(f[idxNota] || "").trim() : "",
        nombre:       idxNom  >= 0 ? String(f[idxNom]  || "").trim() : "",
      });
    }
    return { comu, pisos };
  }

  // Fecha de hoy en español, mes en palabra: "24 de mayo de 2026".
  function _fechaHoyLarga() {
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
                   "agosto","septiembre","octubre","noviembre","diciembre"];
    const d = new Date();
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // Sustituye los [huecos] de un texto por sus valores. Los que no tengan
  // valor se dejan como una línea de subrayado para rellenar a mano.
  // v17.87: normaliza saltos de línea — quita los retornos de carro (CR) que
  // vienen del Sheet/Windows (CRLF) y que pdfkit dibujaba como un símbolo raro "Đ".
  function _rellenarHuecos(texto, valores) {
    const limpio = String(texto || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return limpio.replace(/\[([a-z_]+)\]/gi, (m, clave) => {
      const v = valores[clave];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      return "__________"; // hueco sin dato → línea para rellenar a mano
    });
  }

  // Genera el PDF (Buffer) con una PÁGINA por documento seleccionado.
  // docs = [{ clave, valores }]  (valores ya incluye lo que el usuario confirmó/editó)
  // encabezado/pie son los textos globales de la tab.
  async function generarPdfDocumentos(docs, encabezadoTxt, pieTxt) {
    const PDFDocument = require("pdfkit");
    return await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margins: { top: 70, bottom: 70, left: 70, right: 70 } });
        const chunks = [];
        doc.on("data", c => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const fecha = _fechaHoyLarga();
        docs.forEach((d, i) => {
          if (i > 0) doc.addPage();
          // Encabezado general (común) — alineado a la DERECHA (v17.86)
          if (encabezadoTxt && encabezadoTxt.trim()) {
            const encabLimpio = encabezadoTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
            doc.font("Helvetica").fontSize(12).fillColor("#000");
            doc.text(encabLimpio, { align: "right" });
            doc.moveDown(0.6);
            // Línea horizontal continua justo bajo el encabezado (de margen a margen)
            const xIzq = doc.page.margins.left;
            const xDer = doc.page.width - doc.page.margins.right;
            doc.moveTo(xIzq, doc.y).lineTo(xDer, doc.y).lineWidth(1).strokeColor("#000").stroke();
            doc.moveDown(2.5); // v17.88: ~2 retornos de carro de separación bajo la línea
          }
          // Cuerpo del documento, con huecos rellenados — Helvetica 14pt (v17.86)
          const cuerpo = _rellenarHuecos(d.cuerpo, d.valores);
          doc.font("Helvetica").fontSize(14).fillColor("#000");
          doc.text(cuerpo, { align: "justify", lineGap: 4 });
          const yTrasCuerpo = doc.y; // dónde acabó el cuerpo
          // Pie general (común), con [fecha] automática — Helvetica 14pt
          // v17.89: el pie se ancla al FONDO de la página (estilo carta formal).
          if (pieTxt && pieTxt.trim()) {
            const pieFinal = _rellenarHuecos(pieTxt, { fecha });
            doc.font("Helvetica").fontSize(14).fillColor("#000");
            const anchoPie = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const altoPie = doc.heightOfString(pieFinal, { width: anchoPie, lineGap: 4 });
            const yFondo = doc.page.height - doc.page.margins.bottom - altoPie;
            // Si el cuerpo no llega tan abajo, pegamos el pie al fondo; si el
            // documento es muy largo y el pie no cabe, lo ponemos justo tras el
            // cuerpo con una separación mínima (nunca se solapa).
            const yPie = (yFondo > yTrasCuerpo + 24) ? yFondo : (yTrasCuerpo + 24);
            doc.text(pieFinal, doc.page.margins.left, yPie, { align: "left", lineGap: 4, width: anchoPie });
          }
        });
        doc.end();
      } catch (e) { reject(e); }
    });
  }

  // v17.96: compone el campo "destinatario" del histórico juntando Para + CC + CCO
  // en una sola celda (decisión Guille: "todo junto"). Formato:
  //   "Para: a@x.com | CC: b@y.com | CCO: c@z.com"
  // Las partes vacías se omiten (si no hay CC, no sale "CC:"). Normaliza cada lista
  // (acepta separadores ||, coma, ;, saltos de línea) a "x, y". Si NO se pasan cc ni
  // cco (llamadas antiguas), devuelve solo el destinatario tal cual -> compatible.
  function _componerDestinatarioHist(dest, cc, cco) {
    const norm = (v) => {
      if (!v) return "";
      if (Array.isArray(v)) return v.filter(Boolean).join(", ");
      return String(v).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");
    };
    const para = norm(dest);
    const ccN  = norm(cc);
    const ccoN = norm(cco);
    // Si no hay CC ni CCO, mantener el formato simple de siempre (solo el email).
    if (!ccN && !ccoN) return para;
    const partes = [];
    if (para) partes.push("Para: " + para);
    if (ccN)  partes.push("CC: " + ccN);
    if (ccoN) partes.push("CCO: " + ccoN);
    return partes.join(" | ");
  }

  async function registrarMailEnHistorico(datos) {
    // datos: { fecha, ccpp_id, direccion, fase, destinatario, cc, cco, asunto, mensaje, adjuntos, tipo, message_id }
    // cc y cco son OPCIONALES; si se pasan, se guardan junto al destinatario en la
    // misma celda (ver _componerDestinatarioHist). Si no, se guarda solo el destinatario.
    const sheets = getSheetsClient();
    const fila = [
      datos.fecha || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      _componerDestinatarioHist(datos.destinatario, datos.cc, datos.cco),
      datos.asunto || "",
      datos.mensaje || "",
      datos.adjuntos || "",
      datos.tipo || "manual",
      datos.message_id || "",
    ];
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_MAIL_HISTORICO,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } catch (e) {
      console.error("[presupuestos] No se pudo registrar en mail_historico:", e.message);
      throw e;
    }
  }

  // v18.35 — Registra un mail en mail_historico EVITANDO DUPLICADOS por message_id.
  // Un mail entrante tiene un Message-ID único e irrepetible. Si ese message_id YA
  // está en el histórico (porque el mail se clasificó antes, quizá a otro expediente),
  // en vez de AÑADIR otra fila (que es lo que duplicaba), se MUEVE la fila existente
  // al nuevo expediente: se actualiza la fila entera (ccpp_id, dirección, fase,
  // adjuntos, etc.) y, si por arrastres anteriores hubiera VARIAS filas con ese mismo
  // message_id, se conserva una sola (la primera) y se borran las demás. Si el
  // message_id está vacío o no existe en el histórico, hace el append normal.
  // datos: mismas claves que registrarMailEnHistorico.
  async function _reclasificarOInsertarHistorico(datos) {
    const mid = String(datos.message_id || "").trim();
    // Sin message_id no podemos identificar el mail de forma fiable -> insertar normal.
    if (!mid) { await registrarMailEnHistorico(datos); return; }
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      // Si no podemos leer, caemos al append normal (mejor registrar que perder).
      console.error("[presupuestos] _reclasificar: no se pudo leer histórico:", e.message);
      await registrarMailEnHistorico(datos);
      return;
    }
    // Índices (0-based dentro de rows; en el Sheet es i+1) de las filas con ese message_id.
    const idx = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][9] || "").trim() === mid) idx.push(i);
    }
    if (idx.length === 0) { await registrarMailEnHistorico(datos); return; }
    // Construir la fila nueva (mismo formato que registrarMailEnHistorico). Conserva
    // la fecha original si la fila existente la tenía y datos no trae una distinta.
    const filaExistente = rows[idx[0]] || [];
    const filaNueva = [
      datos.fecha || filaExistente[0] || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      _componerDestinatarioHist(datos.destinatario, datos.cc, datos.cco),
      datos.asunto || filaExistente[5] || "",
      datos.mensaje || filaExistente[6] || "",
      datos.adjuntos || "",
      datos.tipo || filaExistente[8] || "manual",
      mid,
    ];
    // 1) Actualizar la PRIMERA fila existente con los datos nuevos (mover el mail).
    const filaSheet = idx[0] + 1; // 1-based
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `mail_historico!A${filaSheet}:J${filaSheet}`,
      valueInputOption: "RAW",
      requestBody: { values: [filaNueva] },
    });
    // 2) Si había duplicados (≥2 filas con el mismo message_id), borrar las demás.
    //    Se borran de ABAJO hacia ARRIBA para que los índices no se desplacen.
    const sobrantes = idx.slice(1).map(i => i + 1).sort((a, b) => b - a); // 1-based, desc
    if (sobrantes.length) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const hoja = meta.data.sheets.find(s => s.properties.title === "mail_historico");
      if (hoja) {
        const sheetId = hoja.properties.sheetId;
        const requests = sobrantes.map(f => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: f - 1, endIndex: f },
          },
        }));
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID, requestBody: { requests },
        });
      }
    }
  }

  // Lee mail_historico filtrando por CCPP. Identifica filas por ccpp_id (col B);
  // si la fila no lo tiene (envíos antiguos `manual_externo`), cae a coincidencia
  // por `direccion` (col C). Devuelve ordenado ascendente por fecha.
  async function leerMailHistoricoDeCcpp(ccpp_id, direccion) {
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      console.error("[presupuestos] No se pudo leer mail_historico:", e.message);
      return [];
    }
    const out = [];
    const dirNorm = String(direccion || "").trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const rowId = String(r[1] || "").trim();
      const rowDir = String(r[2] || "").trim().toLowerCase();
      const matchPorId = ccpp_id && rowId === ccpp_id;
      const matchPorDir = !rowId && dirNorm && rowDir === dirNorm;
      if (!matchPorId && !matchPorDir) continue;
      out.push({
        fecha: r[0] || "",
        ccpp_id: r[1] || "",
        direccion: r[2] || "",
        fase: r[3] || "",
        destinatario: r[4] || "",
        asunto: r[5] || "",
        mensaje: r[6] || "",
        adjuntos: r[7] || "",
        tipo: r[8] || "",
        message_id: r[9] || "",
      });
    }
    // Ordenar ascendente por fecha. Las fechas vienen mezcladas:
    //   - ISO string: "2026-05-10T09:49:48.560Z"
    //   - Date legacy: "2025-04-01 00:00:00" o "01/04/2025"
    // Date.parse() come ambas; las que no parsea quedan al final.
    out.sort((a, b) => {
      const ta = Date.parse(a.fecha);
      const tb = Date.parse(b.fecha);
      const va = isNaN(ta) ? Infinity : ta;
      const vb = isNaN(tb) ? Infinity : tb;
      return va - vb;
    });
    return out;
  }

  // Devuelve la lista de códigos de plantilla activos (sin _PIE_GLOBAL).
  async function leerListaPlantillas() {
    let rows;
    try {
      // v17.20: usa el mismo caché que leerPlantillaMail
      rows = await _leerFilasMailPlantillas();
    } catch (e) {
      console.warn("[presupuestos] No se pudo leer mail_plantillas:", e.message);
      return [];
    }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const fase = String(r[0]).trim();
      if (fase.startsWith("_")) continue; // _PIE_GLOBAL fuera
      const activo = (r[1] || "SI").toUpperCase() === "SI";
      if (!activo) continue;
      out.push(fase);
    }
    return out;
  }

  // Borra una fila concreta de mail_historico.
  // Identifica la fila por: fecha + ccpp_id + direccion + fase + asunto + tipo.
  // Devuelve true si borró exactamente una.
  async function borrarMailHistoricoFila(criterios) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
    });
    const rows = r.data.values || [];
    const idx = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const eqFecha = String(row[0] || "") === String(criterios.fecha || "");
      const eqId    = String(row[1] || "") === String(criterios.ccpp_id || "");
      const eqDir   = String(row[2] || "") === String(criterios.direccion || "");
      const eqFase  = String(row[3] || "") === String(criterios.fase || "");
      const eqAsun  = String(row[5] || "") === String(criterios.asunto || "");
      const eqTipo  = String(row[8] || "") === String(criterios.tipo || "");
      if (eqFecha && eqId && eqDir && eqFase && eqAsun && eqTipo) {
        idx.push(i); // 0-based en rows; en Sheet es i+1
      }
    }
    if (idx.length !== 1) {
      throw new Error(`No se pudo identificar fila única (matches=${idx.length})`);
    }
    const fila = idx[0] + 1; // 1-based para Sheets API
    // Necesitamos sheetId numérico para batchUpdate
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const hoja = meta.data.sheets.find(s => s.properties.title === "mail_historico");
    if (!hoja) throw new Error("Pestaña mail_historico no encontrada");
    const sheetId = hoja.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: fila - 1, // 0-based, inclusive
              endIndex: fila,        // 0-based, exclusive
            },
          },
        }],
      },
    });
    return true;
  }

  // v17.29: lee TODO mail_historico (sin filtrar por CCPP) para construir
  // índices globales como el de F1 (calcular badge "👎 Retrasado").
  async function leerMailHistoricoCompleto() {
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      console.error("[presupuestos] No se pudo leer mail_historico (completo):", e.message);
      return [];
    }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      out.push({
        fecha: r[0] || "",
        ccpp_id: r[1] || "",
        direccion: r[2] || "",
        fase: r[3] || "",
        destinatario: r[4] || "",
        asunto: r[5] || "",
        mensaje: r[6] || "",
        adjuntos: r[7] || "",
        tipo: r[8] || "",
        message_id: r[9] || "",
      });
    }
    return out;
  }

  function parsearMailJson(s) {
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  }

  // ----------- Helpers para variables {{DOC_CCPP}}, {{DOC_PISOS}}, {{PCT_PISOS}} -----------
  // Leen documentos_manuales + pisos del Sheet, replican la regla calcularResumenManual
  // de documentacion.cjs y devuelven los textos de las variables del mail.

  // Lee la pestaña documentos_manuales y devuelve solo los activos, separados por nivel.
  async function _leerDocsManuales() {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_DOCS_MANUALES });
    const rows = r.data.values || [];
    const docsCcpp = [];
    const docsPiso = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f || !f[0]) continue;
      if (String(f[5] || "").trim().toUpperCase() !== "SI") continue;
      const codigo = String(f[0]).trim();
      const nivel  = String(f[1] || "").trim().toUpperCase();
      const label  = String(f[2] || "").trim();
      const orden  = parseFloat(f[3]) || 999;
      if (nivel === "CCPP") docsCcpp.push({ codigo, label, orden });
      else if (nivel === "PISO") docsPiso.push({ codigo, label, orden });
    }
    docsCcpp.sort((a, b) => a.orden - b.orden);
    docsPiso.sort((a, b) => a.orden - b.orden);
    return { docsCcpp, docsPiso };
  }

  // Lee los pisos de una CCPP concreta. Devuelve [{vivienda, estados:[]}] alineado con docsPiso.
  async function _leerPisosDeCcpp(direccionComunidad, docsPiso) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return [];
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    const idxNom = hdr.indexOf("nombre");
    const idxTlf = hdr.indexOf("telefono");
    // v17.52: columnas nuevas para reloj y notas por piso. -1 si no existen.
    const idxEnHoy = hdr.indexOf("en_hoy");
    const idxNotasP = hdr.indexOf("notas_piso");
    // v18.90 — columnas del bot por piso, para el conteo bot-aware (misma regla que la ficha).
    const idxBotPiso = hdr.indexOf("bot_piso_activo");
    const idxPisoTipo = hdr.indexOf("piso_tipo");
    const idxAcordeon = hdr.indexOf("acordeon");
    // Mapeo doc.codigo (ej "piso_toma_datos") → columna est_piso_toma_datos
    const colByCod = {};
    for (const d of docsPiso) {
      const colName = "est_" + d.codigo;
      const ci = hdr.indexOf(colName);
      if (ci >= 0) colByCod[d.codigo] = ci;
    }
    function norm(s) {
      return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    const objetivo = norm(direccionComunidad);
    const pisos = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) !== objetivo) continue;
      const estados = docsPiso.map(d => {
        const ci = colByCod[d.codigo];
        return ci !== undefined ? String(f[ci] || "").trim() : "";
      });
      pisos.push({
        vivienda: String(f[idxViv] || "").trim(),
        nombre: idxNom >= 0 ? String(f[idxNom] || "").trim() : "",
        telefono: idxTlf >= 0 ? String(f[idxTlf] || "").trim() : "",
        en_hoy: idxEnHoy >= 0 ? String(f[idxEnHoy] || "").trim() : "",
        notas_piso: idxNotasP >= 0 ? String(f[idxNotasP] || "").trim() : "",
        estados,
        _rowIndex: i + 1, // 1-based para Sheets
        comunidad: String(f[idxCom] || "").trim(),
        // v18.90 — campos del bot para decidir si el piso se cuenta bot-aware.
        bot_piso_activo: idxBotPiso >= 0 ? String(f[idxBotPiso] || "").trim() : "",
        piso_tipo: idxPisoTipo >= 0 ? String(f[idxPisoTipo] || "").trim() : "",
        acordeon: idxAcordeon >= 0 ? String(f[idxAcordeon] || "").trim() : "",
      });
    }
    return pisos;
  }

  // v17.52: actualiza una sola celda de la pestaña `pisos` para un piso concreto.
  // Se usa desde los endpoints de toggle reloj-hoy y guardar notas_piso. Solo
  // permite escribir las columnas neutrales en_hoy y notas_piso para no
  // invadir las que controla documentacion.cjs (Alberto).
  async function _actualizarCampoPiso(rowIndex, campo, valor) {
    // v17.67: añadido nota_simple (columna D de pisos).
    // v18.77: añadido bot_piso_activo (columna AV) para el switch del bot.
    const CAMPOS_PERMITIDOS = new Set(["en_hoy", "notas_piso", "nota_simple", "bot_piso_activo"]);
    if (!CAMPOS_PERMITIDOS.has(campo)) {
      throw new Error("Campo no permitido en pisos: " + campo);
    }
    const sheets = getSheetsClient();
    // Necesitamos la letra de columna real leyendo la cabecera (en_hoy y
    // notas_piso son columnas nuevas, no sabemos su letra sin leer).
    const cab = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: "pisos!1:1",
    });
    const hdr = (cab.data.values && cab.data.values[0]) || [];
    const idx = hdr.indexOf(campo);
    if (idx < 0) throw new Error(`Columna '${campo}' no encontrada en pestaña pisos (¿la has añadido al Sheet?)`);
    // Convertir índice 0-based a letra de columna A..AZ..
    const letra = (() => {
      let s = "", n = idx + 1;
      while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
      return s;
    })();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `pisos!${letra}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[valor]] },
    });

    // v17.77 — RELEÍDO DE VERIFICACIÓN (mismo protocolo que actualizarCampoComunidad).
    // Releemos esa celda y comparamos con lo que se quiso guardar. Si no coincide,
    // lanzamos error: el endpoint lo convierte en respuesta de fallo y el front
    // pinta el campo en ROJO. Los campos de piso (en_hoy, notas_piso, nota_simple)
    // son de texto, así que comparamos como texto (trim). Así el verde de estos
    // campos también significa "está de verdad en el Sheet".
    const rel = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `pisos!${letra}${rowIndex}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const leido = (rel.data.values && rel.data.values[0] && rel.data.values[0][0] != null)
      ? rel.data.values[0][0] : "";
    if (String(valor == null ? "" : valor).trim() !== String(leido).trim()) {
      console.error(`[_actualizarCampoPiso] VERIFICACIÓN FALLIDA ${campo} (fila ${rowIndex}): se quiso "${valor}" pero el Sheet tiene "${leido}"`);
      throw new Error(`El campo "${campo}" del piso no quedó guardado en el Sheet (se intentó "${valor}", quedó "${leido}").`);
    }
  }

  // v17.52: dada una direccion de comunidad y una vivienda, devuelve el
  // _rowIndex del piso en la pestaña `pisos`, o null si no existe.
  async function _buscarRowIndexPiso(direccionComunidad, vivienda) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return null;
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    function norm(s) {
      return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    const objetivoCom = norm(direccionComunidad);
    const objetivoViv = norm(vivienda);
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) === objetivoCom && norm(f[idxViv]) === objetivoViv) {
        return i + 1; // 1-based
      }
    }
    return null;
  }

  // Replica calcularResumenManual de documentacion.cjs:
  //   OP, NP, vacío  → no cuentan
  //   F              → cuenta en total (pendiente)
  //   OK/6/12/18/FFCC/IPREM → cuenta en total y en hechos
  // v18.71 — Listas de estados del conteo como FUENTE ÚNICA. Las usa _resumenManual
  // (servidor: HOY y ficha) y se inyectan en la página para que el JS cliente de
  // documentacion lea de aquí en vez de tener su propia copia. Cambiar la regla
  // aquí la cambia en los tres sitios a la vez.
  const _ESTADOS_IGNORA = ["OP", "NP", ""];                       // no cuentan ni en total ni en hechos
  const _ESTADOS_HECHO  = ["OK", "6", "12", "18", "FFCC", "IPREM"]; // cuentan como hechos
  const _SET_IGNORA = new Set(_ESTADOS_IGNORA);
  const _SET_HECHO  = new Set(_ESTADOS_HECHO);
  function _resumenManual(estados) {
    let hechos = 0, totalRel = 0;
    for (const raw of estados) {
      const e = (raw || "").trim();
      if (_SET_IGNORA.has(e)) continue;
      totalRel++;
      if (_SET_HECHO.has(e)) hechos++;
    }
    return { hechos, totalRel };
  }

  // v18.55 — Conjuntos para el filtro de docs por fase (IDÉNTICOS a documentacion.cjs
  // v17.38, para que el contador "Faltan X de Y" de la ficha y de HOY cuenten lo
  // mismo: son el mismo expediente). En modo 08/09/ZZ la fila CCPP/piso solo
  // cuenta contrato+pago; en modo 05/06/07 esos se ocultan y cuenta el resto.
  const _FASES_MODO_07 = new Set(["08_CYCP", "09_TRAMITADA", "ZZ_RECHAZADO", "ZZ_DESCARTADO"]);
  const _COD_CONTRATO_PAGO = new Set(["ccpp_contrato", "ccpp_pago", "piso_contrato", "piso_pago"]);

  // Devuelve los índices de docs VISIBLES (los que cuentan en el pill) según la
  // fase. estados/docs vienen alineados; docs[i].codigo identifica el documento.
  function _idxDocsVisibles(docs, fase) {
    const modo07 = _FASES_MODO_07.has((fase || "").trim());
    const idx = [];
    for (let i = 0; i < docs.length; i++) {
      const esCP = _COD_CONTRATO_PAGO.has(docs[i].codigo);
      if (modo07) { if (esCP) idx.push(i); }      // modo 08/09/ZZ: solo contrato+pago
      else        { if (!esCP) idx.push(i); }      // modo 05/06/07: todo menos contrato+pago
    }
    return idx;
  }

  // _resumenManual aplicado SOLO a los docs visibles para la fase dada.
  function _resumenFase(estados, docs, fase) {
    const idx = _idxDocsVisibles(docs, fase);
    return _resumenManual(idx.map(i => estados[i]));
  }

  // v18.122 — CCPP que NO contrata agua: en modo 08/09/ZZ, si ccpp_contrato Y ccpp_pago
  //   están AMBOS vacíos, la comunidad no contrata suministro comunitario y su fila
  //   NO cuenta (es como si no existiera). Si le correspondiese, tendría F u OK.
  const _FASES_MODO_08_CP = new Set(["08_CYCP", "09_TRAMITADA", "ZZ_RECHAZADO", "ZZ_DESCARTADO"]);
  function _ccppNoContrata(estadosCcpp, docsCcpp, fase) {
    if (!_FASES_MODO_08_CP.has(String(fase || "").trim())) return false;
    let vistoContrato = false, vistoPago = false, algunoConValor = false;
    for (let i = 0; i < (docsCcpp || []).length; i++) {
      const cod = String((docsCcpp[i] && (docsCcpp[i].codigo || docsCcpp[i].code)) || "").trim();
      if (cod !== "ccpp_contrato" && cod !== "ccpp_pago") continue;
      if (cod === "ccpp_contrato") vistoContrato = true;
      if (cod === "ccpp_pago") vistoPago = true;
      if (String((estadosCcpp || [])[i] || "").trim() !== "") algunoConValor = true;
    }
    return vistoContrato && vistoPago && !algunoConValor;
  }

  // Cuenta "Faltan X de Y" para un expediente igual que la ficha: filas (CCPP +
  // pisos) con docs filtrados por fase; una fila sin docs pedidos (totalRel===0)
  // NO cuenta. Devuelve { totalFilas, pend }.
  function _contarFaltan(estadosCcpp, docsCcpp, pisos, docsPiso, fase) {
    let totalFilas = 0, completas = 0;
    if (!_ccppNoContrata(estadosCcpp, docsCcpp, fase)) {
      const rC = _resumenFase(estadosCcpp, docsCcpp, fase);
      if (rC.totalRel > 0) { totalFilas++; if (rC.hechos >= rC.totalRel) completas++; }
    }
    for (const p of pisos) {
      const r = _resumenFase(p.estados, docsPiso, fase);
      if (r.totalRel === 0) continue;
      totalFilas++;
      if (r.hechos >= r.totalRel) completas++;
    }
    return { totalFilas, pend: totalFilas > 0 ? (totalFilas - completas) : 0 };
  }

  // ==================================================================
  // v18.90 — CONTEO "Faltan X de Y" BOT-AWARE (misma regla que la ficha)
  // ------------------------------------------------------------------
  // La ficha (documentacion.cjs: refrescarContadores + botContarPiso) es la
  // AUTORIDAD del badge. Aqui se replica su calculo en servidor para que HOY
  // de EXACTAMENTE el mismo numero. Los pisos gestionados por el bot
  // (acordeonBot) se cuentan por su TIPO (docs requeridos/opcionales,
  // financiacion, disidente); la comunidad y los pisos manuales, con est_*
  // via _resumenFase (sin cambios). A diferencia de _contarFaltan, cada fila
  // (CCPP + cada piso) cuenta SIEMPRE en el total, igual que la ficha.
  // Validado contra el Sheet real:
  //   Otelo 8 -> 7/9 . Doctor Fedriani 17 -> 14/21 . Diego Puerta 5 -> 26/63.
  // OJO: si cambia la regla del bot en documentacion.cjs (botContarPiso),
  // reflejarlo aqui (y viceversa) para que HOY y la ficha no se separen.
  const _FIN_DOCS_BOT = [{ code: "dni_pagador", faces: true }, { code: "justificante_ingresos" }, { code: "titularidad_bancaria" }];
  const _TIPOS_BOT = {
    propietario: { docs: [{ code: "solicitud_firmada" }, { code: "dni_propietario", faces: true }, { code: "empadronamiento", opc: true }], fin: true },
    familiar:    { docs: [{ code: "solicitud_firmada" }, { code: "dni_propietario", faces: true }, { code: "dni_familiar", faces: true }, { code: "autorizacion_familiar" }, { code: "libro_familia" }, { code: "empadronamiento", opc: true }], fin: true },
    inquilino:   { docs: [{ code: "solicitud_firmada" }, { code: "dni_propietario", faces: true }, { code: "dni_inquilino", faces: true }, { code: "contrato_alquiler" }, { code: "empadronamiento", opc: true }], fin: true },
    sociedad:    { docs: [{ code: "solicitud_firmada" }, { code: "dni_administrador", faces: true }, { code: "nif_sociedad" }, { code: "escritura_constitucion" }, { code: "poderes_representante", opc: true }], fin: false },
    local:       { docs: [{ code: "solicitud_firmada" }, { code: "dni_propietario", faces: true }, { code: "licencia_o_declaracion" }], fin: true },
  };
  const _BOT_DOC_CODES = {
    solicitud_firmada: ["solicitud_firmada"], autorizacion_familiar: ["autorizacion_familiar"],
    libro_familia: ["libro_familia"], contrato_alquiler: ["contrato_alquiler"],
    empadronamiento: ["empadronamiento"], nif_sociedad: ["nif_sociedad"],
    escritura_constitucion: ["escritura_constitucion"], poderes_representante: ["poderes_representante"],
    licencia_o_declaracion: ["licencia_o_declaracion", "licencia_apertura", "declaracion_responsable"],
    justificante_ingresos: ["justificante_ingresos"], titularidad_bancaria: ["titularidad_bancaria"],
  };
  const _BOT_FACE_CODES = {
    dni_propietario: [["dni_propietario_delante", "dni_delante"], ["dni_propietario_detras", "dni_detras"]],
    dni_inquilino: [["dni_inquilino_delante"], ["dni_inquilino_detras"]],
    dni_familiar: [["dni_familiar_delante"], ["dni_familiar_detras"]],
    dni_administrador: [["dni_administrador_delante"], ["dni_administrador_detras"]],
    dni_pagador: [["dni_pagador_delante"], ["dni_pagador_detras"]],
  };
  const _RANK_BOT = { F: 3, INCORRECTO: 2, REVISAR: 1, OK: 0 };
  function _normEstadoBot(v) { v = String(v || "").trim().toUpperCase(); if (v === "OK") return "OK"; if (v === "REVISAR") return "REVISAR"; if (v === "INCORRECTO" || v === "REPETIR") return "INCORRECTO"; if (v === "VACIO") return "VACIO"; return "F"; }
  function _peorBot(a, b) { return _RANK_BOT[a] >= _RANK_BOT[b] ? a : b; }
  function _indexBotDocs(dp) {
    const idx = {};
    (Array.isArray(dp.botDocs) ? dp.botDocs : []).forEach(r => {
      const c = String(r.code || "").trim(); if (!c) return;
      if (!idx[c] || String(r.fecha || "") >= String(idx[c].fecha || "")) idx[c] = { estado: r.estado, url: r.url, fecha: r.fecha || "" };
    });
    (Array.isArray(dp.descartadosBot) ? dp.descartadosBot : []).forEach(c => { c = String(c || "").trim(); if (c && !idx[c]) idx[c] = { estado: "VACIO", url: "", fecha: "" }; });
    return idx;
  }
  function _estadoSwitchBot(code, idx) {
    if (code === "empadronamiento") return idx[code] ? _normEstadoBot(idx[code].estado) : "VACIO";
    const faces = _BOT_FACE_CODES[code];
    if (faces) {
      let acc = "OK", algo = false, fFaces = "";
      faces.forEach(grp => { let st = "F", fe = ""; for (let i = 0; i < grp.length; i++) { if (idx[grp[i]]) { st = _normEstadoBot(idx[grp[i]].estado); fe = idx[grp[i]].fecha || ""; algo = true; break; } } acc = _peorBot(acc, st); if (fe > fFaces) fFaces = fe; });
      const ov = idx[code];
      if (ov && (!algo || String(ov.fecha || "") >= fFaces)) return _normEstadoBot(ov.estado);
      return algo ? acc : "F";
    }
    if (idx[code]) return _normEstadoBot(idx[code].estado);
    const docs = _BOT_DOC_CODES[code];
    if (docs) { for (let i = 0; i < docs.length; i++) { if (idx[docs[i]]) return _normEstadoBot(idx[docs[i]].estado); } return "F"; }
    return "F";
  }
  function _botContarPiso(dp) {
    const tipo = String(dp.pisoTipo || dp.tipoBot || "").trim().toLowerCase();
    const cfg = _TIPOS_BOT[tipo]; if (!cfg) return { hechos: 0, total: 0, aplica: false };
    const idx = _indexBotDocs(dp); const mapEst = dp.mapEst || {};
    let total = 0, hechos = 0;
    cfg.docs.forEach(d => { const e = _estadoSwitchBot(d.code, idx); if (d.opc && e === "VACIO") return; total++; if (e === "OK") hechos++; });
    if (cfg.fin) {
      const fv = String(mapEst["piso_meses_financiar"] || "").trim();
      if (fv === "6" || fv === "12" || fv === "18") { _FIN_DOCS_BOT.forEach(d => { total++; if (_estadoSwitchBot(d.code, idx) === "OK") hechos++; }); }
      else { total++; hechos++; }
    }
    if (String(mapEst["piso_disidente"] || "").trim().toUpperCase() === "OK") { total++; hechos++; }
    return { hechos, total, aplica: true };
  }
  function _normDirBot(x) { return String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function _normVivBot(x) { return String(x == null ? "" : x).trim().toLowerCase(); }
  // Lee bot_documentos + bot_expedientes UNA vez y los indexa por
  // comunidad(normDir) -> vivienda. Tablas pequenas; 1 llamada por render de HOY.
  async function _leerBotDatosHoyIndex() {
    const sheets = getSheetsClient();
    const idx = {};
    const ensure = k => (idx[k] = idx[k] || { docsByPiso: {}, tipoByPiso: {}, descByPiso: {} });
    try {
      const rd = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_documentos!A:L" });
      const rows = rd.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const k = _normDirBot(r[1]); if (!k) continue;
        const code = String(r[3] || "").trim(); if (!code) continue;
        const viv = _normVivBot(r[2]); const g = ensure(k);
        (g.docsByPiso[viv] = g.docsByPiso[viv] || []).push({ code, estado: String(r[8] || "").trim(), url: String(r[6] || "").trim(), fecha: String(r[5] || "") });
      }
    } catch (e) { console.warn("[presupuestos][hoy] botDocs:", e.message); }
    try {
      const re = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:Y" });
      const rows = re.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const k = _normDirBot(r[1]); if (!k) continue;
        const viv = _normVivBot(r[2]); const g = ensure(k);
        g.tipoByPiso[viv] = String(r[4] || "").trim();
        g.descByPiso[viv] = String(r[24] || "").split(",").map(x => x.trim()).filter(Boolean);
      }
    } catch (e) { console.warn("[presupuestos][hoy] botExp:", e.message); }
    return idx;
  }
  // Igual que _contarFaltan pero BOT-AWARE y contando TODAS las filas (como la ficha).
  // pisos[i] debe traer: vivienda, estados (alineado a docsPiso), bot_piso_activo,
  // piso_tipo, acordeon. botDatos = indice de _leerBotDatosHoyIndex para esa comunidad.
  function _contarFaltanBot(estadosCcpp, docsCcpp, pisos, docsPiso, fase, botDatos) {
    const bd = botDatos || { docsByPiso: {}, tipoByPiso: {}, descByPiso: {} };
    const _verdesBot = {}; // v18.99h — viviendas con toda su documentación (verde)
    let totalFilas = 0, completas = 0;
    if (!_ccppNoContrata(estadosCcpp, docsCcpp, fase)) {
      const rC = _resumenFase(estadosCcpp, docsCcpp, fase);
      totalFilas++;
      if (rC.totalRel > 0 && rC.hechos >= rC.totalRel) completas++;
    }
    for (const p of (pisos || [])) {
      const viv = _normVivBot(p.vivienda);
      const tipoBot = bd.tipoByPiso[viv] || "";
      const acordeonBot =
        (String(p.acordeon || "").trim().toUpperCase() === "BOT") ||
        (String(p.bot_piso_activo || "").toUpperCase() === "BOT_WHATSAPP") ||
        (!!String(p.piso_tipo || "").trim()) ||
        (!!tipoBot);
      totalFilas++;
      if (acordeonBot) {
        const mapEst = {};
        for (let i = 0; i < docsPiso.length; i++) mapEst[docsPiso[i].codigo] = String((p.estados || [])[i] || "");
        const c = _botContarPiso({ pisoTipo: p.piso_tipo || "", tipoBot, botDocs: bd.docsByPiso[viv] || [], descartadosBot: bd.descByPiso[viv] || [], mapEst });
        if (c.aplica && c.hechos >= c.total) { completas++; if (c.total > 0) _verdesBot[viv] = true; }
      } else {
        const r = _resumenFase(p.estados, docsPiso, fase);
        if (r.totalRel > 0 && r.hechos >= r.totalRel) { completas++; _verdesBot[viv] = true; }
      }
    }
    return { totalFilas, pend: totalFilas > 0 ? (totalFilas - completas) : 0, verdes: _verdesBot };
  }

  // Devuelve { lista_doc_ccpp, lista_doc_pisos, pct_pisos } para una CCPP.
  // Los textos siguen el formato pedido por el usuario:
  //   - DOC_CCPP: "- Falta: Etiqueta\n- Falta: Etiqueta" o "COMPLETA"
  //   - DOC_PISOS: "Faltan 0A, 1B, 2C" o "COMPLETA"
  //   - PCT_PISOS: porcentaje redondeado de pisos completos
  async function calcularResumenDocumentacion(comu) {
    try {
      const { docsCcpp, docsPiso } = await _leerDocsManuales();
      // Estados CCPP: leer las columnas est_ccpp_* de la propia comu
      const estadosCcpp = docsCcpp.map(d => String(comu["est_" + d.codigo] || "").trim());
      const faltanCcpp = [];
      for (let i = 0; i < docsCcpp.length; i++) {
        if (estadosCcpp[i] === "F") faltanCcpp.push(docsCcpp[i].label);
      }
      const lista_doc_ccpp = faltanCcpp.length === 0
        ? "COMPLETA"
        : faltanCcpp.map(l => "- Falta: " + l).join("\n");

      // Pisos
      const direccion = comu.direccion || comu.comunidad || "";
      const pisos = await _leerPisosDeCcpp(direccion, docsPiso);
      let completos = 0;
      const faltanPisos = [];
      const faltanSinMovil = []; // v18.99l — pisos que faltan Y sin móvil
      for (const p of pisos) {
        const r = _resumenManual(p.estados);
        const ok = r.totalRel > 0 && r.hechos >= r.totalRel;
        if (ok) completos++;
        else {
          faltanPisos.push(p.vivienda || "?");
          if (!String(p.telefono || "").trim()) faltanSinMovil.push(p.vivienda || "?");
        }
      }
      // v18.99j — orden natural por planta y puerta (3B antes que 10A; 0-2 antes que 0-3).
      faltanPisos.sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" }));
      faltanSinMovil.sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" }));
      const lista_doc_pisos = faltanPisos.length === 0 && pisos.length > 0
        ? "COMPLETA"
        : (pisos.length === 0 ? "COMPLETA" : "Faltan " + faltanPisos.join(", "));
      const pct_pisos = pisos.length > 0
        ? Math.round((completos / pisos.length) * 100) + "%"
        : "0%";
      // v18.99l — renglón autocontenido: solo aparece si hay pisos que faltan y sin móvil.
      const lista_doc_pisos_sin_movil = faltanSinMovil.length > 0
        ? "No disponemos de n\u00famero de WhatsApp de los pisos " + faltanSinMovil.join(", ") + ", por lo que intentaremos contactar, si nos es posible, por fijo o mail si disponemos de ellos"
        : "";
      return { lista_doc_ccpp, lista_doc_pisos, pct_pisos, lista_doc_pisos_sin_movil };
    } catch (e) {
      console.warn("[presupuestos] calcularResumenDocumentacion falló:", e.message);
      return { lista_doc_ccpp: "(no disponible)", lista_doc_pisos: "(no disponible)", pct_pisos: "—", lista_doc_pisos_sin_movil: "" };
    }
  }

  // Devuelve la fecha de envío del último mail de la fase 05_ACEPTACION_PTO
  // para esta CCPP, leyendo de mails_ultimo_envio (col AJ). Formato DD/MM/AAAA.
  // Devuelve la fecha de aceptación del presupuesto / entrada en fase 05
  // (el día en que se pidió la documentación a la CCPP), en formato DD/MM/AAAA.
  // OJO AL NOMBRE (causa del bug histórico del "mail con la fecha en blanco"):
  // la columna V del Sheet se TITULA "fecha_decision_pto", pero el código la
  // mapea (en COLS) como `fecha_aceptacion_pto` y la lee/escribe SIEMPRE con ese
  // nombre. Por eso aquí el campo bueno es comu.fecha_aceptacion_pto (que es
  // donde de verdad llega el valor de esa columna). Antes este helper leía
  // comu.fecha_decision_pto —nombre que NO existe en el objeto comu— y por eso
  // devolvía vacío aunque el Sheet tuviera la fecha. Se deja fecha_decision_pto
  // como último fallback por pura red de seguridad, pero el que funciona es el
  // primero. Orden: (1) fecha del mail 05_ACEPTACION_PTO si se registró;
  // (2) fecha_aceptacion_pto (la columna V, sellada al aceptar o al "saltar");
  // (3) fecha_decision_pto por si acaso.
  function _fechaAceptacionPto(comu) {
    try {
      const ult = comu.mails_ultimo_envio ? JSON.parse(comu.mails_ultimo_envio) : {};
      const f = ult["05_ACEPTACION_PTO"] || comu.fecha_aceptacion_pto || comu.fecha_decision_pto || "";
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    } catch { return comu.fecha_aceptacion_pto || comu.fecha_decision_pto || ""; }
  }

  // Devuelve la fecha de paso a fase 08_CYCP (envío de contratos y pagos
  // a la CCPP). Equivalente a _fechaAceptacionPto pero para el mail
  // 08_INICIO_CYCP. Lee de mails_ultimo_envio["08_INICIO_CYCP"] como
  // referencia primaria, con fallback a fecha_envio_contratos_pagos.
  // Formato DD/MM/AAAA.
  // Fecha tope inicial de la fase 08 (firma de contratos/cartas): envío contratos + PLAZO_CYCP_INICIAL (10) días.
  // Equivalente a _fechaLimiteDocBot pero para la fase 8 (sin bot, ancla en fecha_envio_contratos_pagos).
  // v18.94 — Coletilla UNICA para todas las fechas limite (fase 05 y 08): devuelve
  // "DD/MM/AAAA" y, cuando la fecha es hoy o ya paso, aclara "(que es hoy)" /
  // "(la cual cumplio hace X dias)". Misma redaccion que llevaba la 05 original.
  // Acepta ISO "YYYY-MM-DD" o un objeto Date. Si no es valida, devuelve "".
  function _fmtFechaLimite(fecha) {
    let d = fecha;
    if (typeof fecha === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
      if (!m) return "";
      d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    }
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    d = new Date(d.getTime()); d.setHours(0, 0, 0, 0);
    const fechaStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy - d) / 86400000);
    if (dias === 0) return `${fechaStr} (que es hoy)`;
    if (dias > 0) return `${fechaStr} (la cual cumplió hace ${dias} día${dias === 1 ? "" : "s"})`;
    return fechaStr;
  }
  // v18.122: variante SIN sufijo de dias, para fechas donde no queremos "(hace X dias)".
  function _fmtFechaLimpia(fecha) {
    let d = fecha;
    if (typeof fecha === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
      if (!m) return "";
      d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    }
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    d = new Date(d.getTime()); d.setHours(0, 0, 0, 0);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  function _fechaTopeCycp(comu) {
    try {
      const base = String((comu && comu.fecha_envio_contratos_pagos) || "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
      const d = new Date(base + "T00:00:00"); d.setDate(d.getDate() + PLAZO_CYCP_INICIAL);
      const yy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${da}`;
    } catch (e) { return ""; }
  }
  function _fechaInicioCycp(comu) {
    try {
      const ult = comu.mails_ultimo_envio ? JSON.parse(comu.mails_ultimo_envio) : {};
      const f = ult["08_INICIO_CYCP"] || comu.fecha_envio_contratos_pagos || "";
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    } catch { return comu.fecha_envio_contratos_pagos || ""; }
  }

  // Versión async de sustituirVariables: acepta las mismas que la síncrona
  // y además resuelve {{DOC_CCPP}}, {{DOC_PISOS}}, {{PCT_PISOS}} y
  // {{fecha_aceptacion_pto}} consultando el Sheet. Solo se usa para plantillas
  // que necesiten estas variables (como 05_SEGUIMIENTO_DOC).
  // {{fecha_limite_doc_vecinos}} NO usa BC. La fecha límite se deriva del PRIMER
  // contacto del bot con algún vecino de la CCPP (fecha_primer_contacto en
  // bot_expedientes, col J) + 20 días. Si aún no hay ningún contacto, devuelve "".
  async function _fechaLimiteDocBot(comu) {
    try {
      // Sistema MANUAL/antiguo: si la comunidad NO está gestionada por el bot,
      // la fecha límite es la de siempre (BC). Así no se rompen los expedientes
      // antiguos, que ya tienen su plazo corriendo y nunca pasaron por el bot.
      const esBot = String(comu.bot_comunidad_activo || "").trim().toUpperCase() === "BOT_WHATSAPP";
      if (!esBot) {
        return String(comu.fecha_limite_documentacion_vecinos || "").trim();
      }
      const nombreCcpp = String(comu.comunidad || comu.direccion || "").trim().toLowerCase();
      if (!nombreCcpp) return "";
      const sheets = getSheetsClient();
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:J" });
      const rows = resp.data.values || [];
      let minMs = null;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        if (String(r[1] || "").trim().toLowerCase() !== nombreCcpp) continue; // col B = comunidad
        const fpc = String(r[9] || "").trim(); // col J = fecha_primer_contacto (ISO)
        if (!fpc) continue;
        const dd = new Date(fpc);
        if (isNaN(dd.getTime())) continue;
        if (minMs === null || dd.getTime() < minMs) minMs = dd.getTime();
      }
      if (minMs === null) return ""; // ningún vecino contactado aún
      const lim = new Date(minMs); lim.setDate(lim.getDate() + PLAZO_DOC_INICIAL);
      const yy = lim.getFullYear(), mm = String(lim.getMonth() + 1).padStart(2, "0"), da = String(lim.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${da}`;
    } catch (e) { console.error("[presupuestos] _fechaLimiteDocBot:", e.message); return ""; }
  }

  // Igual que el mapa _contactoBotPorCcpp de HOY, pero para UN expediente:
  // devuelve la fecha_primer_contacto mas antigua (col J de bot_expedientes)
  // de la comunidad. Asi la ficha usa EXACTAMENTE la misma fecha que HOY.
  async function _fechaContactoBot(comu) {
    try {
      const nombreCcpp = String(comu.comunidad || comu.direccion || "").trim().toLowerCase();
      if (!nombreCcpp) return "";
      const sheets = getSheetsClient();
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:J" });
      const rows = resp.data.values || [];
      let minFpc = "";
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        if (String(r[1] || "").trim().toLowerCase() !== nombreCcpp) continue;
        const fpc = String(r[9] || "").trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fpc)) continue;
        if (!minFpc || fpc < minFpc) minFpc = fpc;
      }
      return minFpc;
    } catch (e) { console.error("[presupuestos] _fechaContactoBot:", e.message); return ""; }
  }
  async function sustituirVariablesAsync(texto, comu) {
    // {{bloque_seguimiento}} → elige el sub-texto según el bot ANTES de resolver el resto:
    //   - Sin contacto del bot en la CCPP → plantilla 05_SEG_ESPERA (falta listado, sin fecha).
    //   - Con contacto → plantilla 05_SEG_FECHA (correo completo con {{fecha_limite_doc_vecinos}}).
    // Los tiempos del cron los lleva SOLO la plantilla contenedora (05_SEGUIMIENTO_DOC).
    if (texto && /\{\{bloque_seguimiento\}\}/.test(texto)) {
      const _limISO = await _fechaLimiteDocBot(comu);
      const _claveSub = _limISO ? "05_SEG_FECHA" : "05_SEG_ESPERA";
      let _sub = "";
      try { const _p = await leerPlantillaMail(_claveSub); _sub = (_p && _p.mensaje) || ""; } catch (_) {}
      texto = String(texto).replace(/\{\{bloque_seguimiento\}\}/g, _sub);
    }
    let t = sustituirVariables(texto, comu);
    if (!t) return "";
    const necesitaResumen = /\{\{(DOC_CCPP|DOC_PISOS|PCT_PISOS|DOC_PISOS_SIN_MOVIL)\}\}/.test(t);
    if (necesitaResumen) {
      const r = await calcularResumenDocumentacion(comu);
      t = t
        .replace(/\{\{DOC_CCPP\}\}/g, r.lista_doc_ccpp)
        .replace(/\{\{DOC_PISOS\}\}/g, r.lista_doc_pisos)
        .replace(/\{\{PCT_PISOS\}\}/g, r.pct_pisos);
      // v18.99l — renglón "sin móvil": si está vacío, se come también su salto de línea.
      if (String(r.lista_doc_pisos_sin_movil || "").trim()) {
        t = t.replace(/\{\{DOC_PISOS_SIN_MOVIL\}\}/g, r.lista_doc_pisos_sin_movil);
      } else {
        t = t.replace(/\r?\n[ \t]*\{\{DOC_PISOS_SIN_MOVIL\}\}/g, "")
             .replace(/\{\{DOC_PISOS_SIN_MOVIL\}\}[ \t]*\r?\n/g, "")
             .replace(/\{\{DOC_PISOS_SIN_MOVIL\}\}/g, "");
      }
    }
    // {{fecha_aceptacion_pto}} → VARIABLE OFICIAL (nombre lógico: coincide con la
    // fase 04-ACEPTACIÓN PTO). Es el día en que se aceptó el presupuesto / se pidió
    // la documentación a la CCPP (entrada en fase 05). La usan las plantillas
    // 05_FIN_DOC y 05_SEGUIMIENTO_DOC.
    if (/\{\{fecha_aceptacion_pto\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_aceptacion_pto\}\}/g, _fechaAceptacionPto(comu));
    }
    // {{fecha_decision_pto}} → ALIAS de la anterior (MISMA fecha, mismo helper).
    // Se mantiene por compatibilidad / red de seguridad: es como se titula la
    // columna V en el Sheet y como estaban escritas las plantillas antes de
    // unificar a {{fecha_aceptacion_pto}}. Si alguna plantilla aún lo usa, sigue
    // funcionando igual. NO es una fecha distinta: aceptacion_pto == decision_pto.
    if (/\{\{fecha_decision_pto\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_decision_pto\}\}/g, _fechaAceptacionPto(comu));
    }
    if (/\{\{fecha_inicio_cycp\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_inicio_cycp\}\}/g, _fechaInicioCycp(comu));
    }
    // v18.122: {{fecha_contacto_vecinos}} -> dia en que el bot escribio al PRIMER vecino
    //   (minimo fecha_primer_contacto, bot_expedientes col J). Es el ANCLA real del plazo de
    //   la fase 05: esta fecha + 20 = {{fecha_limite_doc_vecinos}}. Si el bot aun no contacto,
    //   sale un texto de respaldo (NO se inventa fecha).
    if (/\{\{fecha_contacto_vecinos\}\}/.test(t)) {
      const _fcv = await _fechaContactoBot(comu);
      const _valFcv = /^\d{4}-\d{2}-\d{2}$/.test(String(_fcv)) ? _fmtFechaLimite(_fcv) : "la fecha en que contactemos con los vecinos";
      t = t.replace(/\{\{fecha_contacto_vecinos\}\}/g, _valFcv);
    }
    // {{fecha_limite_doc_vecinos}} → depende de si el bot ya contactó a algún vecino.
    if (/\{\{fecha_limite_doc_vecinos\}\}/.test(t)) {
      const limISO = await _fechaLimiteDocBot(comu);
      let val;
      if (!limISO) {
        val = "20 días naturales a contar desde que contactemos con los vecinos";
      } else {
        val = _fmtFechaLimite(limISO);
      }
      t = t.replace(/\{\{fecha_limite_doc_vecinos\}\}/g, val);
    }
    // {{fecha_limite_ultimatum}} → plazo del vecino (contacto+20) + 20 días = DD/MM/AAAA.
    //   Es la fecha hasta la que se amplía en el ULTIMÁTUM AVISO. Si el bot aún no
    //   contactó, texto de respaldo. (Determinista, no necesita estado guardado.)
    if (/\{\{fecha_limite_ultimatum\}\}/.test(t)) {
      let valU;
      try {
        const limU = await _fechaLimiteDocBot(comu);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(limU))) {
          valU = "20 días naturales tras el vencimiento del plazo anterior";
        } else {
          const _plAmpU = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
          const _Xu = (function(){ const n = parseInt(_plAmpU && _plAmpU.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 20; })(); // prórroga (casilla Ampliación)
          const dU = new Date(limU + "T00:00:00"); dU.setDate(dU.getDate() + _Xu); // = contacto + 20 fijo + prórroga
          valU = _fmtFechaLimite(dU);
        }
      } catch (e) { valU = "20 días naturales tras el vencimiento del plazo anterior"; }
      t = t.replace(/\{\{fecha_limite_ultimatum\}\}/g, valU);
    }
    // v18.122: {{fecha_limite_ultimatum_limpia}} = misma fecha que arriba pero SIN "(hace X dias)".
    if (/\{\{fecha_limite_ultimatum_limpia\}\}/.test(t)) {
      let valUL;
      try {
        const limUL = await _fechaLimiteDocBot(comu);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(limUL))) {
          valUL = "20 días naturales tras el vencimiento del plazo anterior";
        } else {
          const _plAmpUL = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
          const _XuL = (function(){ const n = parseInt(_plAmpUL && _plAmpUL.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 20; })();
          const dUL = new Date(limUL + "T00:00:00"); dUL.setDate(dUL.getDate() + _XuL);
          valUL = _fmtFechaLimpia(dUL);
        }
      } catch (e) { valUL = "20 días naturales tras el vencimiento del plazo anterior"; }
      t = t.replace(/\{\{fecha_limite_ultimatum_limpia\}\}/g, valUL);
    }
    // {{fecha_limite_disidentes}} → día de envío + 5 = DD/MM/AAAA (equivale a {{FECHA+5}}).
    if (/\{\{fecha_limite_disidentes\}\}/.test(t)) {
      const _plRes = await leerPlantillaMail("05_ULT_RESOLVER").catch(() => null);
      const _R = (function(){ const n = parseInt(_plRes && _plRes.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 5; })();
      const dD = new Date(); dD.setHours(0,0,0,0); dD.setDate(dD.getDate() + _R);
      const valD = _fmtFechaLimite(dD);
      t = t.replace(/\{\{fecha_limite_disidentes\}\}/g, valD);
    }
    // {{plazo_doc}} → plazo inicial CONTRACTUAL fijo (20 días). Para INICIO DOC / SEGUIMIENTO.
    if (/\{\{plazo_doc\}\}/.test(t)) {
      t = t.replace(/\{\{plazo_doc\}\}/g, String(PLAZO_DOC_INICIAL));
    }
    // {{plazo_ampliacion}} → días de prórroga que decide el usuario (casilla "Ampliación de plazo").
    //   Para el ULTIMÁTUM AVISO ("ampliar el plazo otros X días más").
    if (/\{\{plazo_ampliacion\}\}/.test(t)) {
      const _pa = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
      const _na = (function(){ const n = parseInt(_pa && _pa.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 20; })();
      t = t.replace(/\{\{plazo_ampliacion\}\}/g, String(_na));
    }
    // {{plazo_resolucion}} → nº de días para nombrar disidentes (casilla "Resolución" = 05_ULT_RESOLVER.dias_primer_envio).
    if (/\{\{plazo_resolucion\}\}/.test(t)) {
      const _pr = await leerPlantillaMail("05_ULT_RESOLVER").catch(() => null);
      const _nr = (function(){ const n = parseInt(_pr && _pr.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 5; })();
      t = t.replace(/\{\{plazo_resolucion\}\}/g, String(_nr));
    }
    // ===== VARIABLES DE FASE 08 (contratos y cartas de pago) =====
    // {{plazo_doc_cycp}} → plazo inicial contractual fijo de fase 08 (10 días).
    if (/\{\{plazo_doc_cycp\}\}/.test(t)) {
      t = t.replace(/\{\{plazo_doc_cycp\}\}/g, String(PLAZO_CYCP_INICIAL));
    }
    // {{plazo_ampliacion_cycp}} → prórroga que decide el usuario (casilla Ampliación de fase 08 = 08_ULT_AVISO.dias_primer_envio).
    if (/\{\{plazo_ampliacion_cycp\}\}/.test(t)) {
      const _p = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
      const _n = (function(){ const x = parseInt(_p && _p.dias_primer_envio, 10); return (Number.isFinite(x) && x > 0) ? x : 10; })();
      t = t.replace(/\{\{plazo_ampliacion_cycp\}\}/g, String(_n));
    }
    // {{plazo_resolucion_cycp}} → días para la resolución (casilla Resolución de contrato de fase 08 = 08_ULT_RESOLVER.dias_primer_envio).
    if (/\{\{plazo_resolucion_cycp\}\}/.test(t)) {
      const _p = await leerPlantillaMail("08_ULT_RESOLVER").catch(() => null);
      const _n = (function(){ const x = parseInt(_p && _p.dias_primer_envio, 10); return (Number.isFinite(x) && x > 0) ? x : 5; })();
      t = t.replace(/\{\{plazo_resolucion_cycp\}\}/g, String(_n));
    }
    // {{fecha_limite_cycp}} → fecha tope inicial de fase 08 (envío contratos + 10), FIJA. Para 08-INICIO/SEGUIMIENTO.
    if (/\{\{fecha_limite_cycp\}\}/.test(t)) {
      const iso = _fechaTopeCycp(comu);
      t = t.replace(/\{\{fecha_limite_cycp\}\}/g, _fmtFechaLimite(iso));
    }
    // {{fecha_limite_ultimatum_cycp}} → tope inicial (env+10) + prórroga (casilla). Para 08-AVISO.
    if (/\{\{fecha_limite_ultimatum_cycp\}\}/.test(t)) {
      let val = "";
      try {
        const iso = _fechaTopeCycp(comu);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          const _p = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
          const _x = (function(){ const n = parseInt(_p && _p.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 10; })();
          const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + _x);
          val = _fmtFechaLimite(d);
        }
      } catch (e) { val = ""; }
      t = t.replace(/\{\{fecha_limite_ultimatum_cycp\}\}/g, val);
    }
    // v18.122: {{fecha_limite_ultimatum_cycp_limpia}} = misma fecha SIN "(hace X dias)".
    if (/\{\{fecha_limite_ultimatum_cycp_limpia\}\}/.test(t)) {
      let valL = "";
      try {
        const isoL = _fechaTopeCycp(comu);
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoL)) {
          const _pL = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
          const _xL = (function(){ const n = parseInt(_pL && _pL.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 10; })();
          const dL = new Date(isoL + "T00:00:00"); dL.setDate(dL.getDate() + _xL);
          valL = _fmtFechaLimpia(dL);
        }
      } catch (e) { valL = ""; }
      t = t.replace(/\{\{fecha_limite_ultimatum_cycp_limpia\}\}/g, valL);
    }
    // {{fecha_limite_disidentes_cycp}} → día de envío + resolución (casilla). Para 08-RESOLUCIÓN.
    if (/\{\{fecha_limite_disidentes_cycp\}\}/.test(t)) {
      const _p = await leerPlantillaMail("08_ULT_RESOLVER").catch(() => null);
      const _x = (function(){ const n = parseInt(_p && _p.dias_primer_envio, 10); return (Number.isFinite(n) && n > 0) ? n : 5; })();
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + _x);
      t = t.replace(/\{\{fecha_limite_disidentes_cycp\}\}/g, _fmtFechaLimite(d));
    }
    return t;
  }

  function sustituirVariables(texto, comu) {
    if (!texto) return "";
    return String(texto)
      .replace(/\{\{direccion\}\}/g, comu.direccion || "")
      .replace(/\{\{comunidad\}\}/g, comu.comunidad || "")
      .replace(/\{\{administrador\}\}/g, comu.administrador || "")
      .replace(/\{\{presidente\}\}/g, comu.presidente || "")
      .replace(/\{\{tipo_via\}\}/g, comu.tipo_via || "")
      .replace(/\{\{pto_total\}\}/g, comu.pto_total || "")
      // {{compensacion}} → 10% del TOTAL CON IVA. pto_total es la BASE (sin IVA), por eso x1.10 antes.
      //   Coincide con la cláusula 8 hardcodeada: (totP5Iva) * 0.10, donde totP5Iva = base * 1.10.
      .replace(/\{\{compensacion\}\}/g, (function(){ const _n = parseFloat(String(comu.pto_total || "").replace(",", ".")); return (isFinite(_n) && _n > 0) ? fmtMoneda(_n * 1.10 * 0.10) : ""; })())
      // {{FECHA+N}} → fecha de hoy + N días en formato DD/MM/AAAA. Útil para
      // marcar plazos relativos en plantillas (ej: "fecha límite {{FECHA+20}}").
      // N puede ser positivo o negativo (FECHA-5 → hace 5 días).
      .replace(/\{\{FECHA([+-]\d+)\}\}/g, (_m, dias) => {
        const f = new Date();
        f.setDate(f.getDate() + parseInt(dias, 10));
        const dd = String(f.getDate()).padStart(2, '0');
        const mm = String(f.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${f.getFullYear()}`;
      })
      // {{fecha_envio_contratos_pagos}} → fecha guardada en col AZ, sellada el día
      // que el expediente entra en fase 08 (07->08). En el Sheet está en formato
      // YYYY-MM-DD; aquí la convertimos a DD/MM/AAAA. La usan las plantillas
      // 08_FIN_CYCP y 08_SEGUIMIENTO_CYCP, que se envían cuando el expediente ya
      // está en fase 08 (la fecha ya está sellada). Si por lo que sea estuviera
      // vacía, se sustituye por cadena vacía (no deja el {{...}} literal).
      .replace(/\{\{fecha_envio_contratos_pagos\}\}/g, () => {
        const f = comu.fecha_envio_contratos_pagos || "";
        const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return f; // si no es YYYY-MM-DD, devolver tal cual (o "" si vacío)
        return `${m[3]}/${m[2]}/${m[1]}`;
      })
      // {{FECHA}} → fecha de hoy en DD/MM/AAAA
      .replace(/\{\{FECHA\}\}/g, () => {
        const f = new Date();
        const dd = String(f.getDate()).padStart(2, '0');
        const mm = String(f.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${f.getFullYear()}`;
      });
  }

  // =================================================================
  // (BLOQUE ELIMINADO) — La capa de acceso a vecinos_base/expedientes
  // y la lógica de emparejado vecino↔CCPP se traslada a documentacion.cjs.
  // Presupuestos ya no lee/muestra vecinos.
  // =================================================================

  // =================================================================
  // LÓGICA DE NEGOCIO — disparadores, transiciones, línea de tiempo
  // =================================================================
  function calcularDisparador(comu) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    if (!def || !def.plantilla) return null;
    let baseFecha = null;
    let dias = def.cadenciaDias || 30;
    if (fase === "04_ACEPTACION_PTO") {
      baseFecha = comu.fecha_ultimo_seguimiento_pto || comu.fecha_envio_pto;
      if (!baseFecha) return null;
      if (!comu.fecha_ultimo_seguimiento_pto) dias = def.cadenciaInicialDias || 3;
    } else if (fase === "01_CONTACTO") {
      baseFecha = comu.fecha_contacto;
      if (!baseFecha) return null;
    } else { return null; }
    const desde = new Date(baseFecha.length > 10 ? baseFecha : baseFecha + "T00:00:00");
    if (isNaN(desde)) return null;
    const vence = new Date(desde); vence.setDate(vence.getDate() + dias);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const dRest = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
    let urg = "lejano";
    if (dRest <= 0) urg = "vencido";
    else if (dRest <= 3) urg = "proximo";
    return { vence: vence.toISOString().slice(0,10), diasRestantes: dRest, urgencia: urg };
  }

  // Calcula el estado de plazo de un expediente para mostrar el badge
  // 👍 En plazo / ⚠️ Decidir / 👎 Retrasado (X días).
  //
  // Se basa en calcularInfoEnvioAuto() para mantener una única fuente de verdad
  // sobre cuándo toca el próximo reenvío. Aplica a las 4 fases con reenvíos:
  // 01, 04, 05 y 08.
  //
  // Reglas:
  //   - info.estado "no_iniciado"  → null (no marcamos hasta el primer envío)
  //   - info.estado "completado"   → "decidir" (reenvíos automáticos agotados)
  //   - info.estado "en_curso":
  //       hoy < fecha_próximo_reenvío                         → "en_plazo"
  //       hoy ≥ fecha_próximo_reenvío:
  //         si hay fecha_proximo_mail_manual rellena         → "retrasado" (pactó día y no envió)
  //         si no                                             → "decidir" (toca enviar siguiente reenvío)
  //   - info.estado "desactivado"  → null
  //   - resto                       → null
  //
  // diasRetraso = hoy - fecha_próximo_reenvío (solo en "retrasado").
  //
  // Parámetros:
  //   - comu: el expediente
  //   - plantilla: la plantilla de su fase (ya cargada en el cache local del handler)
  //
  // Devuelve null o { estado, fechaAviso, diasRetraso }.
  // v17.30: índice F1 (fecha del último reenvío automático del PRIMER ciclo
  // por CCPP+fase). Se calcula recorriendo los CCPPs y mirando sus CONTADORES
  // (numAutomaticos del JSON mails_enviados/mails_manuales) — NO el histórico —
  // para decidir si están ampliados. El histórico solo se usa para localizar
  // la fecha F1 del envío automático nº mx-ésimo. Si la desincronización
  // entre historico y contadores impide localizarlo, fallback a
  // mails_ultimo_envio (aproximación: la fecha del último envío).
  //
  // Estructura: { "ccpp_id__fase": "2026-04-15T..." }
  //
  // comus: array de comunidades ya leídas (con ccpp_id, fase_presupuesto,
  //   mails_enviados, mails_manuales, mails_ultimo_envio).
  // historicoCompleto: array de mail_historico (con ccpp_id, fase, tipo, fecha).
  // plantillas: mapa fase -> objeto plantilla (al menos max_envios).
  function _indexarF1PorCcppFase(comus, historicoCompleto, plantillas) {
    if (!Array.isArray(comus) || comus.length === 0) return {};

    // 1) Para cada CCPP, determinar si está ampliado en su fase actual.
    //    v17.33: AMPLIADO es:
    //      (a) numAutomaticos > mx (el cron ya disparó nuevo ciclo)
    //      O
    //      (b) numAutomaticos >= mx Y hay fecha_proximo_mail_manual rellena
    //          (ya he decidido reactivar, aún sin disparar)
    const ampliadosKeys = []; // array de { ccpp_id, fase, mx, ultimoEnvio, casoB }
    for (const c of comus) {
      if (!c || !c.ccpp_id) continue;
      const fase = normalizarFase(c.fase_presupuesto);
      const pl = plantillas[fase];
      if (!pl) continue;
      const mx = parseInt(pl.max_envios) || 0;
      if (mx <= 0) continue;
      let enviados = {}, manuales = {};
      try { enviados = JSON.parse(c.mails_enviados || "{}"); } catch (_) { enviados = {}; }
      try { manuales = JSON.parse(c.mails_manuales || "{}"); } catch (_) { manuales = {}; }
      const totalEnvios = parseInt(enviados[fase]) || 0;
      let numManuales;
      if (manuales[fase] !== undefined) {
        numManuales = parseInt(manuales[fase]) || 0;
      } else {
        numManuales = totalEnvios >= 1 ? 1 : 0;
      }
      const numAutomaticos = Math.max(0, totalEnvios - numManuales);
      const hayFechaManual = !!(c.fecha_proximo_mail_manual || "").trim();
      // Caso A: cron ya disparó nuevo ciclo
      const casoA = numAutomaticos > mx;
      // Caso B: justo agotado pero ya hay decisión de ampliar
      const casoB = numAutomaticos === mx && hayFechaManual;
      if (casoA || casoB) {
        let ultimoEnvio = null;
        try {
          const ultJson = JSON.parse(c.mails_ultimo_envio || "{}");
          if (ultJson[fase]) ultimoEnvio = ultJson[fase];
        } catch (_) {}
        ampliadosKeys.push({ ccpp_id: c.ccpp_id, fase, mx, ultimoEnvio, casoB });
      }
    }
    if (ampliadosKeys.length === 0) return {};

    // 2) Para cada ampliado, obtener F1.
    //    - Caso B (numAuto == mx + fecha manual): mails_ultimo_envio[fase] ES
    //      el último auto del primer ciclo. Usar directo.
    //    - Caso A (numAuto > mx): buscar en histórico el envío automático nº mx
    //      filtrado por ccpp+fase, ordenado asc. Fallback a mails_ultimo_envio
    //      si el histórico está desincronizado.
    const out = {};
    for (const a of ampliadosKeys) {
      const k = a.ccpp_id + "__" + a.fase;
      if (a.casoB) {
        if (a.ultimoEnvio) out[k] = a.ultimoEnvio;
        continue;
      }
      // Caso A
      const candidatos = (historicoCompleto || [])
        .filter(m =>
          m && String(m.tipo || "").toLowerCase() === "automatico" &&
          m.ccpp_id === a.ccpp_id &&
          m.fase === a.fase
        )
        .slice()
        .sort((x, y) => {
          const tx = Date.parse(x.fecha), ty = Date.parse(y.fecha);
          return (isNaN(tx) ? Infinity : tx) - (isNaN(ty) ? Infinity : ty);
        });
      if (candidatos.length >= a.mx) {
        out[k] = candidatos[a.mx - 1].fecha;
      } else if (a.ultimoEnvio) {
        out[k] = a.ultimoEnvio;
      }
    }
    return out;
  }

  function calcularEstadoPlazo(comu, plantilla, f1Map) {
    // FRENO ULTIMATUM: en fases 05/08, si ya se entro al circuito de ultimatum
    // (prorroga/disidentes/resuelto sellados), el seguimiento automatico se
    // detiene: sin badge de reenvio y fuera de HOY (no se reenvia).
    {
      const _fUlt = String(comu.fase_presupuesto || "").trim();
      if ((_fUlt === "05_DOCUMENTACION" || _fUlt === "08_CYCP") &&
          (String(comu.fecha_ultimatum_ampliado || "").trim() ||
           String(comu.fecha_disidentes_solicitados || "").trim() ||
           String(comu.fecha_contrato_resuelto || "").trim())) {
        return null;
      }
    }
    // v17.50 — LÓGICA basada en ESTADO DEL CRON + fecha límite.
    //
    // Definida con Guille tras descartar v17.49 (que solo miraba hoy vs fLim
    // y daba rojo a CCPPs con cron parado, lo cual era incorrecto: si el
    // cron está parado, hay que DECIDIR, no señalar retraso).
    //
    // El cron tiene 3 estados:
    //   - ACTIVO: ciclo en curso, hay envíos automáticos por hacer.
    //   - DORMIDO: ciclo agotado PERO hay fecha_proximo_mail_manual rellena
    //              (despertará en esa fecha y mandará el mail, reiniciando ciclo).
    //   - PARADO: ciclo agotado y NO hay fecha manual → espera decisión humana.
    //
    // Reglas del badge:
    //
    //   🟡 Ámbar "Decidir"  → cron PARADO (independientemente de fLim).
    //                          La decisión es humana: el sistema ya hizo lo
    //                          que podía hacer automáticamente.
    //
    //   🟢 Verde "En plazo" → cron ACTIVO o DORMIDO y hoy < fLim.
    //                          (Aún no ha llegado la fecha prometida al cliente).
    //
    //   🔴 Rojo "Retrasado (N días)" → cron ACTIVO o DORMIDO y hoy >= fLim.
    //                                   N = días desde fLim hasta hoy.
    //                                   (Cliente ya en retraso, pero el sistema
    //                                   sigue trabajando: o reenviando, o
    //                                   esperando una fecha manual futura).
    //
    // Sin badge (null):
    //   - Sin plantilla / plantilla desactivada / sin automatización configurada.
    //   - totalEnvios == 0 (no iniciado: aún no hay mail inicial, no hay
    //     compromiso con el cliente todavía).
    //   - fLim vacía Y sin último envío para fallback al vuelo.
    //
    // Cálculo de fLim:
    //   - Lectura directa de comu.fecha_limite_documentacion_vecinos (BC).
    //   - Fallback si BC vacía: mails_ultimo_envio[fase] + di + dr × mx.
    //     Cubre a CCPPs antiguos sin migrar.
    //
    // El parámetro f1Map se conserva en la firma por compatibilidad con
    // las llamadas existentes (listado, HOY, ficha), pero ya no se usa.
    if (!plantilla) return null;
    if (!plantilla.activo) return null;
    const mx = parseInt(plantilla.max_envios) || 0;
    const dr = parseInt(plantilla.dias_recurrente) || 0;
    const di = parseInt(plantilla.dias_primer_envio) || 0;
    if (mx <= 0 && dr <= 0) return null;

    const fase = normalizarFase(comu.fase_presupuesto);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    // Verificar que hay actividad (totalEnvios > 0)
    let enviados;
    try { enviados = JSON.parse(comu.mails_enviados || "{}"); } catch (_) { enviados = {}; }
    const totalEnvios = parseInt(enviados[fase]) || 0;
    if (totalEnvios === 0) return null;

    // Detectar estado del cron usando calcularInfoEnvioAuto (única fuente de
    // verdad sobre el ciclo del cron, ya en uso en la ficha y el HOY).
    // info.estado puede ser: "no_iniciado", "desactivado", "sin_plantilla",
    //                        "en_curso" (activo o dormido) o "completado" (parado).
    const info = calcularInfoEnvioAuto(comu, fase, plantilla);
    if (info.estado === "no_iniciado" || info.estado === "desactivado" || info.estado === "sin_plantilla") {
      return null;
    }

    // 🟡 Cron PARADO → Decidir. Hay que ampliar manualmente.
    if (info.estado === "completado") {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }

    // info.estado === "en_curso": cron activo o dormido. Decidir entre verde
    // y rojo según F-final.
    //
    // v18.42: F-FINAL = fecha del PRIMER envío de la fase + di + dr×(mx-1).
    // Cambios respecto a la versión anterior:
    //   (a) FÓRMULA: antes di + dr×mx (un ciclo de más). Con mx envíos del cron,
    //       el ÚLTIMO cae en di + dr×(mx-1) (envíos en +di, +di+dr, +di+2dr...).
    //       Ej fase 04 (di=3,dr=30,mx=4): envíos +3,+33,+63,+93 -> último=+93=di+dr×3.
    //   (b) ANCLA: antes mails_ultimo_envio[fase] (se MUEVE con cada cron/ciclo).
    //       Ahora la fecha de ENTRADA a la fase (= primer envío, fija): para 04
    //       fecha_envio_pto, 05 fecha_aceptacion_pto, 08 fecha_envio_contratos_pagos.
    //       Para 01 no hay columna fiable -> fallback al primer dato disponible;
    //       si no hay ancla, no se pinta badge (regla: sin primer envío, sin badge).
    //   (c) EN VIVO: se calcula siempre desde la plantilla actual, NO se lee la
    //       columna BC congelada. Así un cambio de plantilla (di/dr/mx) reajusta
    //       el badge de TODOS los expedientes con un único criterio.
    const _anclaFase = {
      "01_CONTACTO": comu.fecha_solicitud_pto,
      "04_ACEPTACION_PTO": comu.fecha_envio_pto,
      "05_DOCUMENTACION": comu.fecha_aceptacion_pto,
      "08_CYCP": comu.fecha_envio_contratos_pagos,
    };
    let fechaAncla = (_anclaFase[fase] || "").toString().trim();
    if (!fechaAncla) {
      // Fallback: primer (= único conocido) envío registrado en la clave de la fase.
      let ultimo;
      try { ultimo = JSON.parse(comu.mails_ultimo_envio || "{}"); } catch (_) { ultimo = {}; }
      fechaAncla = (ultimo[fase] || "").toString().trim();
    }
    if (!fechaAncla) return null; // sin ancla -> sin badge
    const tAncla = Date.parse(fechaAncla);
    if (isNaN(tAncla)) return null;
    const fFinal = new Date(tAncla); fFinal.setHours(0, 0, 0, 0);
    const sumDias = di + dr * Math.max(0, mx - 1); // fórmula corregida
    fFinal.setDate(fFinal.getDate() + sumDias);
    const fechaLimiteIso = fFinal.toISOString().slice(0, 10);

    const fLim = fFinal; // ya normalizada a 00:00

    if (hoy < fLim) {
      return { estado: "en_plazo", fechaAviso: fechaLimiteIso.slice(0, 10), diasRetraso: 0 };
    }
    // hoy >= fLim → 🔴 Retrasado con N días desde fLim
    const diasRetraso = Math.round((hoy - fLim) / 86400000);
    return { estado: "retrasado", fechaAviso: fechaLimiteIso.slice(0, 10), diasRetraso };
  }

  // Helper: devuelve {estado:"retrasado", diasRetraso:N} desde F1 hasta hoy.
  // Si F1 falta o no parsea, fallback a "decidir" (no rompe nada).
  function _retrasadoConF1(f1Iso, hoy) {
    if (!f1Iso) {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }
    const tF1 = Date.parse(f1Iso);
    if (isNaN(tF1)) {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }
    const fF1 = new Date(tF1); fF1.setHours(0, 0, 0, 0);
    const diasRetraso = Math.max(0, Math.round((hoy - fF1) / 86400000));
    return { estado: "retrasado", fechaAviso: f1Iso.slice(0, 10), diasRetraso };
  }

  // Devuelve el HTML del badge correspondiente al estado de plazo.
  // estadoPlazo = { estado, fechaAviso, diasRetraso } o null.
  function renderBadgePlazo(estadoPlazo) {
    if (!estadoPlazo) return "";
    if (estadoPlazo.estado === "en_plazo") {
      return `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="En plazo">👍 En plazo</span>`;
    }
    if (estadoPlazo.estado === "decidir") {
      return `<span class="ptl-fila-badge ptl-fila-badge-decidir" title="Plazo cumplido — pendiente de decidir">⚠️ Decidir</span>`;
    }
    if (estadoPlazo.estado === "retrasado") {
      const d = estadoPlazo.diasRetraso || 0;
      return `<span class="ptl-fila-badge ptl-fila-badge-retrasado" title="Plazo ampliado — retraso acumulado">👎 Retrasado (${d} día${d === 1 ? '' : 's'})</span>`;
    }
    return "";
  }

  // ===== TANDA 2 — BADGE DEL ULTIMÁTUM (fase 05, pantalla HOY) =====
  // Devuelve el HTML del badge/botón según el estado. Determinista a partir de:
  //   contactoIso = fecha del 1er contacto del bot (prefetch de bot_expedientes),
  //   y las marcas selladas BL/BM/BN (fecha_ultimatum_ampliado / _disidentes / _resuelto).
  // Los ⚠️ son <button class="ptl-ult-btn"> que el cliente cablea al endpoint.
  function _badgeUltimatumHoy(c, contactoIso, pl, cfg, soloEstado, retrasadoSeg) {
    cfg = cfg || {};
    const _plazoIni  = cfg.plazoIni  || PLAZO_DOC_INICIAL;                 // 20 (fase 5) | 10 (fase 8)
    const _acc       = cfg.acc       || { ampliar: "ampliar", disidentes: "disidentes", resolver: "resolver", recordar: "recordar" };
    const _txtFinal  = cfg.txtFinal  || "Resolver el contrato";             // "Resolver el contrato" en fase 8
    const _txtNeutro = cfg.txtNeutro || "Contrato resuelto";               // "Contrato resuelto" en fase 8
    const _txtEnPlazo= cfg.txtEnPlazo|| "Doc solicitada";                  // "Contratos solicitados" en fase 8
    const _defAmp    = cfg.defAmp    || 20;
    const _defRes    = cfg.defRes    || 5;
    const _defRec    = cfg.defRec    || 10;                       // recordatorio (Aviso prórroga 2)
    const _flagRec   = cfg.flagRec   || "05_ULT_RECORDATORIO";    // clave en mails_enviados
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const dsince = (iso) => {
      const s = String(iso || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const d = new Date(s + "T00:00:00"); if (isNaN(d.getTime())) return null;
      return Math.round((hoy0 - d) / 86400000);
    };
    const esBot = String(c.bot_comunidad_activo || "").trim().toUpperCase() === "BOT_WHATSAPP";
    const BL = String(c.fecha_ultimatum_ampliado || "").slice(0, 10);
    const BM = String(c.fecha_disidentes_solicitados || "").slice(0, 10);
    const BN = String(c.fecha_contrato_resuelto || "").slice(0, 10);
    const idc = String(c.ccpp_id || "");
    // v18.99n — color por paso del tiempo: Ampliar=amarillo, Disidentes=naranja, Resolver=rojo.
    const btn = (accion, txt) => {
      // v18.122 — color por clase (estilo-visual .ptl-ubtn-*). Naranja=disidentes por defecto.
      let _cls = "ptl-ubtn-naranja";
      if (/^ampliar/.test(accion) || /^recordar/.test(accion)) _cls = "ptl-ubtn-amarillo"; // prórroga 1 y 2
      else if (/^resolver/.test(accion)) _cls = "ptl-ubtn-rojo";                            // resolver
      return `<button type="button" class="ptl-ult-btn ptl-btn ptl-btn-sm ${_cls}" data-ccpp-id="${idc}" data-accion="${accion}" title="Pulsar: abre el correo para revisarlo y enviarlo" style="flex:0 0 auto;cursor:pointer">⚠️ ${txt}</button>`;
    };
    // v18.122 — colores centralizados en estilo-visual.cjs (.ptl-badge-*).
    const _COLB = { verde:"ptl-ubadge-verde", naranja:"ptl-ubadge-naranja", ambar:"ptl-ubadge-ambar", rojo:"ptl-ubadge-rojo", gris:"ptl-ubadge-gris" };
    const est = (color, txt) => `<span class="ptl-fila-badge ${_COLB[color] || _COLB.naranja}" style="flex:0 0 150px">${txt}</span>`;
    const _plz = (v, def) => { const n = parseInt(v, 10); return (Number.isFinite(n) && n > 0) ? n : def; };
    const pAmpliar    = _plz(pl && pl.ampliar,    _defAmp); // prórroga (casilla)
    const pDisidentes = _plz(pl && pl.disidentes, 20); // días desde AMPLIAR (BL)
    const pResolver   = _plz(pl && pl.resolver,    _defRes); // días desde DISIDENTES (BM)
    const pRecordatorio = _plz(pl && pl.recordatorio, _defRec); // días desde AMPLIAR (BL) hasta el recordatorio
    let _recEnviado = false;
    try { const _jeR = JSON.parse(c.mails_enviados || "{}"); _recEnviado = !!_jeR[_flagRec]; } catch (_) {}
    const dC = dsince(contactoIso); // días desde el 1er contacto del bot
    const dBL = dsince(BL);         // días desde que se pulsó Ampliar
    // 1) Contrato resuelto (BN)
    if (BN) return est("gris", `📛 ${_txtNeutro} hace ${dsince(BN)} días`);
    // 2) Disidentes solicitados (BM) → a los +5 aparece "Resolver contrato"
    if (BM) {
      const dm = dsince(BM);
      if (dm != null && dm >= pResolver) return soloEstado ? est("rojo", " Toca resolver el contrato") : btn(_acc.resolver, _txtFinal);
      return est("verde", `📛 Disidentes solicitados hace ${dm != null ? dm : 0} días`);
    }
    // 3) Plazo ampliado (BL) → Solicitud de disidentes a los 2*pAmpliar días DESDE EL CONTACTO
    //    (plazo inicial X + prórroga X = 2X), coincide con la fecha que promete el AVISO.
    if (BL) {
      if (dC != null && dC >= (_plazoIni + pAmpliar)) return soloEstado ? est("ambar", " Toca solicitar disidentes") : btn(_acc.disidentes, "Solicitar disidentes");
      if (!_recEnviado && dBL != null && dBL >= pRecordatorio) return soloEstado ? est("ambar", " Toca enviar prórroga 2") : btn(_acc.recordar, "Enviar prórroga 2");
      return est("verde", `📨 Plazo ampliado · doc solicitada hace ${dC != null ? dC : "?"} días`);
    }
    // 4) Bot ya contactó (hay fecha) → doc; al +20 aparece "Ampliar plazo"
    if (contactoIso) {
      if (dC != null && dC >= _plazoIni) return soloEstado ? est("ambar", " Toca enviar prórroga 1") : btn(_acc.ampliar, "Enviar prórroga 1");
      return est("verde", `👍 ${_txtEnPlazo} · hace ${dC != null ? dC : 0} días`); // v18.122: color por plazo, no por retraso de seguimientos
    }
    // 5) Sin contacto aún (solo comunidades bot) → esperando listado
    if (esBot) {
      const dl = dsince(c.fecha_aceptacion_pto);
      if (dl != null) {
        return est("verde", `👍 Listado solicitado · hace ${dl} días`);
      }
    }
    return est("ambar", " Pendiente de iniciar");
  }
  // ===== FIN helper badge ultimátum =====

  function calcularLineaTiempo(comu) {
    const fase = normalizarFase(comu.fase_presupuesto);
    // Las 7 fases activas del ciclo completo (presupuestos + documentación).
    // Presupuestos solo gestiona 01-04 y ZZ; las fases 05-07 son del módulo
    // documentacion.cjs, pero el timeline las pinta para que el usuario vea
    // siempre el mapa completo del expediente.
    const ORDEN = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const idx = ORDEN.indexOf(fase);
    return [
      { proceso: "Presupuesto",   nombre: "01-Contacto",          faseId: "01_CONTACTO",        estado: estadoHito("01_CONTACTO",        fase, idx) },
      { proceso: "Presupuesto",   nombre: "02-Visita",            faseId: "02_VISITA",          estado: estadoHito("02_VISITA",          fase, idx) },
      { proceso: "Presupuesto",   nombre: "03-Envío PTO",         faseId: "03_ENVIO_PTO",           estado: estadoHito("03_ENVIO_PTO",           fase, idx) },
      { proceso: "Presupuesto",   nombre: "04-Aceptación PTO",   faseId: "04_ACEPTACION_PTO",     estado: estadoHito("04_ACEPTACION_PTO",     fase, idx) },
      { proceso: "Documentación", nombre: "05-Documentación",     faseId: "05_DOCUMENTACION",   estado: estadoHito("05_DOCUMENTACION",   fase, idx) },
      { proceso: "Documentación", nombre: "06-Visita EMASESA",    faseId: "06_VISITA_EMASESA",  estado: estadoHito("06_VISITA_EMASESA",  fase, idx) },
      { proceso: "Documentación", nombre: "07-PTE CYCP",          faseId: "07_PTE_CYCP", estado: estadoHito("07_PTE_CYCP", fase, idx) },
      { proceso: "Documentación", nombre: "08-CYCP",              faseId: "08_CYCP",     estado: estadoHito("08_CYCP",     fase, idx) },
    ];
    function estadoHito(hitoId, faseActual, idxFaseActual) {
      // Para rechazados: las 4 fases del proceso de presupuesto (01-04) se
      // marcan como COMPLETADAS (con sus fechas reales). Las fases de
      // documentación (05-08) ya no se pintan: el grupo "Documentación"
      // entero se sustituye por el cartel del motivo (ver lineaTiempoHtml).
      if (faseActual === "ZZ_RECHAZADO") {
        const FASES_PRESUPUESTO = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO"];
        if (FASES_PRESUPUESTO.includes(hitoId)) return "completo";
        return "rechazado";
      }
      // v17.23: 09_TRAMITADA = todos los hitos del ciclo completados (verde).
      if (faseActual === "09_TRAMITADA") return "completo";
      const ordenHito = ORDEN.indexOf(hitoId);
      if (ordenHito === -1) return "pendiente";
      if (ordenHito < idxFaseActual) return "completo";
      // Caso especial fase 08: si está en fase 08 y ya cerrada
      // (fecha_cycp_completa rellena), pintamos el círculo en verde aunque el
      // CCPP siga marcado como 08_CYCP (no hay fase posterior).
      if (hitoId === "08_CYCP" && faseActual === "08_CYCP" && comu.fecha_cycp_completa) return "completo";
      if (ordenHito === idxFaseActual) return "actual";
      return "pendiente";
    }
  }

  function fechaHito(comu, hitoId) {
    if (hitoId === "01_CONTACTO")     return comu.fecha_contacto;
    if (hitoId === "02_VISITA")       return comu.fecha_visita;
    if (hitoId === "03_ENVIO_PTO")        return comu.fecha_envio_pto;
    if (hitoId === "04_ACEPTACION_PTO")  return comu.fecha_aceptacion_pto;
    if (hitoId === "05_DOCUMENTACION") return comu.fecha_documentacion_completa;
    if (hitoId === "06_VISITA_EMASESA") return comu.fecha_visita_emasesa;
    // Decisión sesión 04/05/2026:
    //  - 07_PTE_CYCP -> fecha_envio_contratos_pagos: se rellena al pulsar
    //    el botón "paso a 08-CYCP" (con envío de mail tipo fase 03→04).
    //  - 08_CYCP -> fecha_cycp_completa: se rellena al pulsar el botón
    //    "cerrar fase 08" cuando todos los contratos están firmados.
    //    Mientras el CCPP esté en 08 sin haber cerrado, el círculo 08 sale vacío.
    if (hitoId === "07_PTE_CYCP") return comu.fecha_envio_contratos_pagos;
    if (hitoId === "08_CYCP")     return comu.fecha_cycp_completa;
    return "";
  }

  // Genera HTML de la línea de tiempo.
  // compacto=true: variante para listados (.ptl-fila), con etiquetas más cortas.
  function lineaTiempoHtml(comu, compacto = false) {
    const puntos = calcularLineaTiempo(comu);
    const grupos = {};
    puntos.forEach(p => { (grupos[p.proceso] ||= []).push(p); });
    function nombreMostrar(p) {
      if (compacto && p.faseId === "05_DOCUMENTACION") return "05-Doc";
      return p.nombre;
    }
    // Si la CCPP está rechazada, sustituimos el grupo "DOCUMENTACIÓN" (fases
    // 05-08) por un cartel con el motivo del rechazo en rojo. El grupo
    // "PRESUPUESTO" (01-04) se mantiene tal cual con sus fechas.
    const esRechazado = normalizarFase(comu.fase_presupuesto) === "ZZ_RECHAZADO";
    // Mapear el valor crudo del Sheet a texto formateado para mostrar en el listado.
    const MOTIVOS_FMT = {
      "POR PRECIO MÁS BAJO DE LA COMPETENCIA": "RECHAZADA: PRECIO MAS BAJO DE LA COMPETENCIA",
      "PORQUE NO SE VA A HACER DE MOMENTO":    "RECHAZADA: NO SE VA A HACER DE MOMENTO",
    };
    const motivoRaw = esRechazado ? String(comu.motivo_rechazo || "").trim() : "";
    let motivoRech;
    if (!motivoRaw) {
      motivoRech = "RECHAZADA (sin motivo)";
    } else if (MOTIVOS_FMT[motivoRaw]) {
      motivoRech = MOTIVOS_FMT[motivoRaw];
    } else if (motivoRaw.toUpperCase().startsWith("RECHAZADA")) {
      // Ya viene preformateado en el Sheet, no añadir prefijo
      motivoRech = motivoRaw;
    } else {
      motivoRech = "RECHAZADA: " + motivoRaw;
    }
    return `<div class="ptl-timeline">
      ${Object.entries(grupos).map(([procName, pts]) => {
        const esGrupoDoc = procName.toUpperCase().includes("DOCUMENTACI");
        if (esRechazado && esGrupoDoc) {
          // Para que el cartel ocupe EXACTAMENTE el mismo espacio que el
          // grupo "Documentación" en una fila no rechazada (4 puntos), lo
          // renderizamos como ese mismo grupo de 4 puntos pero invisibles
          // (visibility:hidden, NO display:none, así reservan tamaño), y
          // encima superponemos el cartel rojo con position:absolute.
          // Etiquetas reales para que la anchura coincida con las otras filas.
          const etiquetasDoc = compacto
            ? ["05-Doc", "06-Visita EMASESA", "07-PTE CYCP", "08-CYCP"]
            : ["05-Documentación", "06-Visita EMASESA", "07-PTE CYCP", "08-CYCP"];
          const puntosInvisibles = etiquetasDoc.map(lbl => `
            <div class="ptl-punto pendiente" style="visibility:hidden">
              <div class="ptl-circulo"></div>
              <div class="ptl-label">${esc(lbl)}</div>
              <div class="ptl-fecha">·</div>
            </div>`).join('');
          return `
            <div class="ptl-grupo" style="position:relative">
              <div class="ptl-grupo-titulo" style="visibility:hidden">${esc(procName)}</div>
              <div class="ptl-puntos">${puntosInvisibles}</div>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ptl-danger);font-weight:700;font-size:9px;line-height:1.15;overflow:hidden;padding:0 6px;text-align:center" title="${esc(motivoRech)}">
                ${esc(motivoRech)}
              </div>
            </div>`;
        }
        const wStyleNorm = "";
        return `
          <div class="ptl-grupo" style="${wStyleNorm}">
            <div class="ptl-grupo-titulo">${esc(procName)}</div>
            <div class="ptl-puntos">
              ${pts.map(p => {
                const f = fechaHito(comu, p.faseId);
                const ff = fmtFecha(f);
                return `<div class="ptl-punto ${p.estado}" title="${esc(procName)} · ${esc(p.nombre)}${f ? ' · ' + ff : ''}">
                  <div class="ptl-circulo"></div>
                  <div class="ptl-label">${esc(nombreMostrar(p))}</div>
                  <div class="ptl-fecha">${f ? ff : '·'}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  }

  function badgeFase(faseId) {
    const fase = normalizarFase(faseId);
    const def = PTO_FASES[fase];
    if (!def) return `<span class="ptl-badge ptl-badge-gris">—</span>`;
    return `<span class="ptl-badge ptl-badge-${def.color}">${def.codigo}-${esc(def.nombre)}</span>`;
  }

  // =================================================================
  // LAYOUT HTML (CSS embebido, prefijo "ptl-" para no chocar con index.cjs)
  // =================================================================
  function pageHtml(titulo, breadcrumbs, content, token, opts) {
    opts = opts || {};
    const bc = breadcrumbs && breadcrumbs.length > 1
      ? `<div class="ptl-breadcrumb">${breadcrumbs.map((b, i) => {
          if (i < breadcrumbs.length - 1)
            return `<a href="${esc(b.url)}">${esc(b.label)}</a><span class="ptl-sep">/</span>`;
          return `<span>${esc(b.label)}</span>`;
        }).join("")}</div>`
      : "";
    const homeUrl = urlT(token, "/presupuestos");
    // Cabecera unificada (estilo Plan 5): nombre de pantalla + hamburguesa con las pantallas reales.
    const _navTop = [
      ["LISTADO DE PRESUPUESTOS", urlT(token, "/presupuestos")],
      ["🗺️ MAPA", urlT(token, "/presupuestos/mapa", opts.expedienteId ? { focus: opts.expedienteId } : {})],
    ];
    const _navPlant = [
      ["📧 PLANTILLAS MAIL", urlT(token, "/presupuestos/plantillas")],
      ["📄 PLANTILLAS DOC", urlT(token, "/presupuestos/plantillas-doc")],
      ["🤖 FLUJO BOT", urlT(token, "/presupuestos/plantillas-bot-flujo")],
    ];
    const _plan5Item = opts.expedienteId
      ? `<a class="menu-item" href="${esc(urlT(token, "/plan5", { dir: opts.expedienteDir || "", id: opts.expedienteId }))}">📋 PRESUPUESTO PLAN 5</a>`
      : "";
    // Item del menu que reutiliza el boton "IMPRIMIR DOCUMENTOS" de la ficha (caja Datos CCPP).
    // Solo aparece dentro de un expediente; dispara el mismo modal (no duplica logica).
    const _imprimirDocsItem = (opts.expedienteId && (parseInt(opts.expedienteFase, 10) >= 5))
      ? `<a class="menu-item" href="#" onclick="event.preventDefault();var m=document.getElementById(&quot;ptlMenuList&quot;);if(m)m.hidden=true;if(window.ptlAbrirDocsModal){window.ptlAbrirDocsModal();}else{alert(&quot;Abre la ficha de un expediente para imprimir sus documentos.&quot;);}">📄 IMPRIMIR DOCUMENTOS</a>`
      : "";
    let _menuItems = _navTop.map(([t, u], _i) => `<a class="menu-item" href="${esc(u)}">${esc(t)}</a>` + (_i === 0 ? _plan5Item + _imprimirDocsItem : "")).join("")
      + `<div class="menu-sep"></div>`
      + _navPlant.map(([t, u]) => `<a class="menu-item menu-item-sm" href="${esc(u)}">${esc(t)}</a>`).join("");
    return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="theme-color" content="#004178"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
  <meta name="apple-mobile-web-app-title" content="Araujo"/>
  <link rel="manifest" href="/manifest.webmanifest"/>
  <link rel="apple-touch-icon" href="/araujo-icon-192.png"/>
  <link rel="icon" type="image/png" sizes="192x192" href="/araujo-icon-192.png"/>
  <title>${esc(titulo)} · Araujo Presupuestos</title>
  <style>${getThemeCss()}${CSS}</style>
  <style>
    .ptl-nav-search{flex:0 1 440px;min-width:0}
    .ptl-nav-search .ptl-search-input{width:100%}
    @media (max-width:640px){
      .ptl-nav{position:relative;flex-wrap:nowrap}
      .ptl-nav-search{flex:0 0 auto}
      .ptl-nav-search .ptl-search-input{display:none}
      .ptl-search-icon{cursor:pointer}
      .ptl-nav-search.ptl-search-open{position:static}
      .ptl-nav-search.ptl-search-open .ptl-search-input{display:block;position:absolute;left:8px;right:8px;top:100%;width:auto;margin-top:4px;z-index:60}
    }
  </style>
</head><body>
  <nav class="ptl-nav">
    <a href="${homeUrl}" class="ptl-nav-brand ptl-nav-brand-fix">
      <div class="ptl-logo">A</div>
      <div class="ptl-nav-text"><strong>Araujo Presupuestos</strong><span class="ptl-nav-screen">${esc(titulo)}</span></div>
    </a>
    ${opts.search ? `<div class="ptl-search-wrap ptl-nav-search"><span class="ptl-search-icon" onclick="ptlAbrirBuscador(this)">🔍</span><input class="ptl-search-input" id="ptl-buscador-comun" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(opts.searchValue||'')}" autocomplete="off" oninput="ptlFiltrarComun()"/></div>` : ''}
    <span class="ptl-nav-spacer"></span>
    ${opts.undo ? `<button id="ptlBtnUndo" class="menu-btn hdr-undo" type="button" onclick="ptlUndo()" title="Deshacer" disabled>↶</button><button id="ptlBtnRedo" class="menu-btn hdr-undo" type="button" onclick="ptlRedo()" title="Rehacer" disabled>↷</button>` : ''}
    ${opts.cron ? `<button id="ptl-btn-cron-manual" class="menu-btn hdr-cron" type="button" title="Ejecutar cron">⚡</button>` : ''}
    <button class="menu-btn hdr-reload" type="button" onclick="location.reload(true)" title="Recargar (Ctrl+F5)">🔄</button>
    <a class="menu-btn hdr-hoy" href="${urlT(token, "/presupuestos/hoy")}" title="HOY">⏰</a>
    <div class="menu-wrap">
      <button id="ptlMenuBtn" class="menu-btn" type="button" aria-label="Menú">&#9776;</button>
      <div id="ptlMenuList" class="menu-list" hidden>${_menuItems}</div>
    </div>
  </nav>
  <div class="ptl-page">
    ${content}
  </div>
  <script>function ptlAbrirBuscador(ic){var w=ic.closest('.ptl-nav-search');if(!w)return;var open=w.classList.toggle('ptl-search-open');if(open){var i=w.querySelector('.ptl-search-input');if(i)i.focus();}}(function(){var b=document.getElementById('ptlMenuBtn'),l=document.getElementById('ptlMenuList');if(b&&l){b.addEventListener('click',function(e){e.stopPropagation();l.hidden=!l.hidden;});document.addEventListener('click',function(e){if(e.target!==b&&!l.contains(e.target))l.hidden=true;});}})();</script>
</body></html>`;
  }
  function sendHtml(res, html, status = 200) {
    res.status(status).set("Content-Type", "text/html; charset=utf-8").send(html);
  }
  function sendError(res, html, status = 500) {
    sendHtml(res, pageHtml("Error", [], `<div class="ptl-empty"><h3>${esc(html)}</h3></div>`), status);
  }

  // v17.69: TODAS las reglas CSS de la cinta de fase (que vivían aquí) se han
  // migrado a estilo-visual.cjs v1.13. Esta constante se mantiene vacía como
  // placeholder por si en el futuro hace falta añadir CSS específico que NO
  // sea reutilizable desde otros módulos. Si está vacía mucho tiempo, se podrá
  // borrar junto con su uso en pageHtml.
  const CSS = ``;

  // =================================================================
  // HELPER: información sobre los envíos automáticos de una fase
  // =================================================================
  // Devuelve un objeto con:
  //   - texto:     string que se pinta en la UI (ej: "📧 1+0/3 - próximo reenvío 12/05/2026")
  //   - estado:    "no_iniciado" | "en_curso" | "completado" | "desactivado" | "sin_plantilla"
  //   - completado: boolean (true cuando reenvíos automáticos >= max_envios)
  //
  // Formato del texto: "📧 X+Y/Z" donde:
  //   - X = envíos manuales hechos (incluye el inicial + cada "Reenviar revisado")
  //   - Y = reenvíos automáticos hechos (los que dispara el cron)
  //   - Z = max_envios (tope de reenvíos automáticos definido en la plantilla)
  //
  // Inputs:
  //   - comu:      ficha completa (lee mails_enviados, mails_manuales, mails_ultimo_envio,
  //                fecha_proximo_mail_manual, fecha_ultimo_seguimiento_pto)
  //   - fase:      código de fase (01_CONTACTO, 04_ACEPTACION_PTO, ...)
  //   - plantilla: objeto plantilla del Sheet (puede ser null si no existe).
  //                Debe traer al menos: activo, dias_recurrente, max_envios, dias_primer_envio.
  //
  // Reglas de estado:
  //   - Sin plantilla / sin automatización → estado "sin_plantilla", texto vacío.
  //   - Plantilla inactiva → estado "desactivado", texto "📧 reenvío desactivado".
  //   - X==0 e Y==0 → "📧 0+0/Z - reenvío no iniciado".
  //   - Y >= max_envios → "📧 X+Y/Z - reenvío completado".
  //   - En curso → "📧 X+Y/Z - próximo reenvío DD/MM/AAAA".
  //
  // CÁLCULO DE MANUALES Y AUTOMÁTICOS:
  //   - Total envíos = mails_enviados[fase]
  //   - Manuales     = mails_manuales[fase]  (si el campo no existe en datos
  //                    antiguos: se asume 1 si total >= 1, sino 0)
  //   - Automáticos  = total - manuales (mínimo 0)
  function calcularInfoEnvioAuto(comu, fase, plantilla) {
    if (!plantilla) {
      return { texto: "", estado: "sin_plantilla", completado: false };
    }
    const mx = parseInt(plantilla.max_envios) || 0;
    const dr = parseInt(plantilla.dias_recurrente) || 0;
    const di = parseInt(plantilla.dias_primer_envio) || 0;
    // Sin automatización configurada → no se pinta nada
    if (mx <= 0 && dr <= 0) {
      return { texto: "", estado: "sin_plantilla", completado: false };
    }
    if (!plantilla.activo) {
      return { texto: "📧 reenvío desactivado", estado: "desactivado", completado: false };
    }

    const enviados = (() => { try { return JSON.parse(comu.mails_enviados || "{}"); } catch { return {}; } })();
    const manuales = (() => { try { return JSON.parse(comu.mails_manuales || "{}"); } catch { return {}; } })();
    const ultimo   = (() => { try { return JSON.parse(comu.mails_ultimo_envio || "{}"); } catch { return {}; } })();
    const totalEnvios = enviados[fase] || 0;
    // Compat: si hay envíos pero no hay tracking de manuales (CCPP antiguo),
    // asumir que el primero fue manual.
    let numManuales;
    if (manuales[fase] !== undefined) {
      numManuales = parseInt(manuales[fase]) || 0;
    } else {
      numManuales = totalEnvios >= 1 ? 1 : 0;
    }
    const numAutomaticos = Math.max(0, totalEnvios - numManuales);
    const fechaUltimo = ultimo[fase] || null;
    const totalLabel = mx > 0 ? mx : "∞";
    const xy = `${numManuales}+${numAutomaticos}/${totalLabel}`;

    // No iniciado: ningún envío de ningún tipo
    if (numManuales === 0 && numAutomaticos === 0) {
      return {
        texto: `📧 ${xy} - reenvío no iniciado`,
        estado: "no_iniciado",
        completado: false,
      };
    }

    // Completado: reenvíos automáticos al tope del CICLO ACTUAL.
    // v17.29: el ciclo se reinicia con cada fecha manual ampliatoria.
    // Si numAutomaticos > 0 y es múltiplo exacto de mx → ciclo agotado.
    //   - Sin fecha manual nueva → estado "completado".
    //   - Con fecha manual nueva → estado "en_curso" (próximo = fecha manual).
    const cicloAgotado = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
    const hayFechaManualNueva = !!(comu.fecha_proximo_mail_manual || "").trim();
    if (cicloAgotado && !hayFechaManualNueva) {
      return {
        texto: `📧 ${xy} - reenvío completado`,
        estado: "completado",
        completado: true,
      };
    }

    // En curso: calcular fecha del próximo reenvío automático
    let fechaProx = null;
    const fechaManual = (comu.fecha_proximo_mail_manual || "").trim();
    if (fechaManual) {
      fechaProx = fechaManual;
    } else if (fechaUltimo && dr > 0) {
      // Si ya hay automáticos previos, la cadencia recurrente es 'dr' días desde
      // el último envío. Si no hay automáticos pero sí hay manual reciente, el
      // primer reenvío automático es a 'di' días (cadencia inicial) desde el
      // último envío manual.
      const fu = new Date(fechaUltimo);
      if (!isNaN(fu.getTime())) {
        const sumDias = numAutomaticos > 0 ? dr : (di > 0 ? di : dr);
        fu.setDate(fu.getDate() + sumDias);
        fechaProx = fu.toISOString().slice(0, 10);
      }
    }
    // v18.41: ELIMINADO el fallback a comu.fecha_ultimo_seguimiento_pto que
    // existía aquí (gemelo del fallback del cron). Tras la siembra de la clave 04
    // (cambio en /enviar-mail), un expediente "en_curso" SIEMPRE tiene
    // fechaUltimo en su clave, así que la rama de fallback era además código
    // muerto. Coherencia total: si el cron no va a disparar (clave 04 vacía),
    // el indicador no debe inventar una fecha de "próximo" -> mostraría
    // "pendiente", pero en realidad ese caso ya devuelve "no iniciado" antes.
    const fechaProxFmt = fechaProx ? formatearFechaDDMMYYYY(fechaProx) : "pendiente";
    return {
      texto: `📧 ${xy} - próximo reenvío ${fechaProxFmt}`,
      estado: "en_curso",
      completado: false,
      fechaProxIso: fechaProx || null,
    };
  }

  // YYYY-MM-DD → DD-MM-AA (para mostrar). El nombre histórico se mantiene
  // por compatibilidad; el formato real es ahora DD-MM-AA (año 2 dígitos).
  function formatearFechaDDMMYYYY(fechaIso) {
    if (!fechaIso) return "";
    const m = String(fechaIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(fechaIso);
    return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
  }

  // Fases que tienen automatización de reenvíos (las que el cron procesa).
  // Se usa en el listado para sondear cuáles tienen "decidir pendiente" y en
  // la ficha para pintar el indicador de envíos automáticos. La fase 03 NO
  // está aquí: tiene plantilla, pero es un envío manual único (el presupuesto)
  // que avanza directamente a 04, no hay reenvíos automáticos en 03.
  const FASES_CON_REENVIOS = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"];

  // Mapeo fase → clave de plantilla y de contadores. Por defecto coinciden,
  // pero fase 05_DOCUMENTACION usa la plantilla 05_SEGUIMIENTO_DOC (los reenvíos
  // automáticos durante la espera de documentación de los vecinos).
  function plantillaDeFase(fase) {
    if (fase === "05_DOCUMENTACION") return "05_SEGUIMIENTO_DOC";
    if (fase === "08_CYCP") return "08_SEGUIMIENTO_CYCP";
    return fase;
  }

  // =================================================================
  // VISTA: LISTADO DE PRESUPUESTOS
  // =================================================================
  async function vistaListado(comunidades, query, token) {
    const filtroFase = query.fase || "";
    // v17.61 — Búsqueda insensible a mayúsculas Y acentos.
    // _normTexto aplica NFD + strip diacríticos para que "brujula" encuentre "Brújula".
    const _normTexto = s => String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const busqueda = _normTexto(query.q || "").trim();
    const orden = query.orden || "";

    // Cargar plantillas de las fases con reenvíos (en paralelo, una sola vez para
    // todo el listado) para detectar qué CCPPs tienen los reenvíos completados
    // y marcarlos visualmente con un badge "⚠ Decidir".
    const plantillasReenvios = {};
    try {
      const arr = await Promise.all(FASES_CON_REENVIOS.map(f => leerPlantillaMail(plantillaDeFase(f)).catch(() => null)));
      FASES_CON_REENVIOS.forEach((f, i) => { plantillasReenvios[f] = arr[i] || null; });
    } catch (e) { /* si falla, simplemente no se pintan los badges */ }

    const counts = { todos: 0, hoy: 0, activos: 0, en_tramite: 0 };
    ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP","09_TRAMITADA","ZZ_RECHAZADO","ZZ_DESCARTADO"].forEach(f => counts[f] = 0);
    // Activos = todo lo que sigue vivo en el negocio (presupuestos + documentación).
    //   Incluye 08_CYCP porque sigue siendo trabajo en curso (recepción de
    //   contratos firmados), PERO si la fase 08 está finalizada
    //   (fecha_cycp_completa rellena) ya no cuenta como activo.
    //   NO incluye 09_TRAMITADA (terminal de éxito), ZZ_RECHAZADO ni ZZ_DESCARTADO (terminales de fracaso).
    // En trámite = solo las fases del módulo documentación que siguen abiertas
    //   (05/06/07/08), con la misma exclusión: 08 finalizada no cuenta.
    const FASES_ACTIVAS = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const FASES_EN_TRAMITE = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    comunidades.forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      counts.todos++;
      if (counts[f] !== undefined) counts[f]++;
      // Una 08_CYCP con fecha_cycp_completa rellena se considera finalizada y
      // ya no cuenta como activo ni en trámite.
      const ochoFinalizada = (f === "08_CYCP" && !!c.fecha_cycp_completa);
      if (FASES_ACTIVAS.includes(f) && !ochoFinalizada) counts.activos++;
      if (FASES_EN_TRAMITE.includes(f) && !ochoFinalizada) counts.en_tramite++;
      const d = calcularDisparador(c);
      if (d && (d.urgencia === "vencido" || d.diasRestantes === 0)) counts.hoy++;
    });

    let lista = comunidades.slice();
    // v17.61/62 — filtroEfectivo se declara FUERA del if porque se usa más
    // abajo para resaltar la pestaña activa (líneas ~3124 y ~3286). En v17.61
    // se metió por error dentro del if y rompía el listado con ReferenceError.
    // Si hay búsqueda activa, IGNORAMOS el filtro de fase: la búsqueda
    // siempre opera sobre todo el Sheet. Sin búsqueda, se aplica el filtro normal
    // (Activos por defecto, o la fase clicada).
    const filtroEfectivo = filtroFase || "ACTIVOS";
    if (!busqueda) {
      if (filtroEfectivo === "HOY") {
        lista = lista.filter(c => {
          const d = calcularDisparador(c);
          return d && (d.urgencia === "vencido" || d.diasRestantes === 0);
        });
      } else if (filtroEfectivo === "ACTIVOS") {
        lista = lista.filter(c => {
          const f = normalizarFase(c.fase_presupuesto);
          if (!FASES_ACTIVAS.includes(f)) return false;
          // Excluir 08_CYCP finalizadas (con fecha_cycp_completa)
          if (f === "08_CYCP" && c.fecha_cycp_completa) return false;
          return true;
        });
      } else if (filtroEfectivo === "TRAMITE") {
        lista = lista.filter(c => {
          const f = normalizarFase(c.fase_presupuesto);
          if (!FASES_EN_TRAMITE.includes(f)) return false;
          if (f === "08_CYCP" && c.fecha_cycp_completa) return false;
          return true;
        });
      } else if (filtroEfectivo === "TODOS") {
        // sin filtro
      } else {
        lista = lista.filter(c => normalizarFase(c.fase_presupuesto) === filtroEfectivo);
      }
    }
    if (busqueda) {
      lista = lista.filter(c => {
        const hay = _normTexto(`${c.direccion} ${c.comunidad} ${c.administrador || ''} ${c.presidente || ''} ${c.telefono_administrador || ''} ${c.telefono_presidente || ''}`);
        return hay.includes(busqueda);
      });
    }

    const ordenEf = orden || "az";
    if (ordenEf === "az" || ordenEf === "za") {
      const dir = ordenEf === "az" ? 1 : -1;
      lista.sort((a, b) => {
        const dirA = String(a.direccion || a.comunidad || "");
        const dirB = String(b.direccion || b.comunidad || "");
        // 1º: comparar por calle (sin número/escalera)
        const calleA = extraerNombreCalle(dirA);
        const calleB = extraerNombreCalle(dirB);
        const cmpCalle = calleA.localeCompare(calleB, "es", { sensitivity: "base", numeric: true });
        if (cmpCalle !== 0) return dir * cmpCalle;
        // 2º: misma calle → tipo_via desempata
        const tvA = String(a.tipo_via || "");
        const tvB = String(b.tipo_via || "");
        const cmpTv = tvA.localeCompare(tvB, "es", { sensitivity: "base", numeric: true });
        if (cmpTv !== 0) return dir * cmpTv;
        // 3º: mismo tipo_via → ordenar por dirección completa (número, escalera...)
        return dir * dirA.localeCompare(dirB, "es", { sensitivity: "base", numeric: true });
      });
    } else if (ordenEf === "urg") {
      lista.sort((a, b) => {
        const da = calcularDisparador(a), db = calcularDisparador(b);
        return (da ? da.diasRestantes : 9999) - (db ? db.diasRestantes : 9999);
      });
    }

    // v17.64 — Cabecera unificada. Antes había ~140 líneas inline (buscador,
    // botón orden A-Z/Z-A/Urg, Plantillas mail, Ejecutar cron + script,
    // Ctrl+F5, HOY, Activos con aviso ⚠, En trámite, Tramitados, ZZ,
    // +Nuevo y fases 01-08). Todo eso ahora vive en renderCabeceraComun.
    // Le pasamos los opts necesarios para que se comporte como antes:
    //   - filtroActivo: la pestaña marcada como "on"
    //   - busqueda: para precargar el input
    //   - orden: para que el botón de orden gire al próximo estado
    //   - mostrarOrden: true (este es el único sitio donde el botón gira)
    //   - cuadra: para el aviso ⚠ en Activos si los contadores no cuadran
    const sumaProcesos = counts["01_CONTACTO"]+counts["02_VISITA"]+counts["03_ENVIO_PTO"]+counts["04_ACEPTACION_PTO"]+counts["05_DOCUMENTACION"]+counts["06_VISITA_EMASESA"]+counts["07_PTE_CYCP"]+counts["08_CYCP"]+counts["09_TRAMITADA"]+counts["ZZ_RECHAZADO"]+counts["ZZ_DESCARTADO"];
    const cuadra = sumaProcesos === counts.todos;

    const filas = lista.map(c => {
      // v17.23: badges 👍/⚠️/👎 quitados del listado.
      // v17.42: en el listado, las CCPP en fase 09_TRAMITADA que tengan
      // fecha_cobro rellena muestran un badge verde "💶 Cobrada DD-MM-AA".
      // v17.43: el slot del badge se renderiza SIEMPRE (vacío o con badge)
      // con min-width fijo para que todas las filas mantengan alineadas
      // sus líneas de fases.
      // v17.44: el slot del badge pasa de ir DESPUÉS del timeline a ir ANTES,
      // replicando la posición histórica de los badges 👍/⚠️/👎 (hasta v17.22).
      // Además se añade un spacer elástico (flex:1) tras .ptl-fila-info para
      // empujar el bloque [badge+timeline+importe] hacia la derecha, ya que
      // .ptl-fila .ptl-timeline pasa a flex:0 0 auto en estilo-visual v1.4
      // (deja de estirarse para ocupar su ancho natural).
      const faseFila = normalizarFase(c.fase_presupuesto);
      const fechaCobroFila = String(c.fecha_cobro || "").trim();
      const fechaPteCobroFila = String(c.fecha_pte_cobro || "").trim();
      // v18.49 — badge de estado para TODA la fase 09 (3 estados, mismas clases
      // que el resto): Cobrado (en-plazo/verde) > Pte. cobro (decidir/ambar) >
      // En ejecucion (ejecucion/azul claro). Antes solo salia el de Cobrada.
      let badgeCobroInner = "";
      if (faseFila === "09_TRAMITADA") {
        if (/^\d{4}-\d{2}-\d{2}/.test(fechaCobroFila)) {
          const fLab = formatearFechaDDMMYYYY(fechaCobroFila);
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="Cobrado el ${esc(fLab)}">💶 Cobrado</span>`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(fechaPteCobroFila)) {
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-decidir" title="Obra terminada, pendiente de cobro">⏳ Pte. cobro</span>`;
        } else {
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-ejecucion" title="Obra en ejecucion">🔨 En ejecución</span>`;
        }
      }
      return `
      <a href="${urlT(token, "/presupuestos/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info" title="${esc(((c.tipo_via || '') + ' ' + (c.direccion || c.comunidad || '—')).trim())}">
          <span class="ptl-fila-tipo">${esc(c.tipo_via || '')}</span>
          <span class="ptl-fila-dir">${esc(c.direccion || c.comunidad || '—')}</span>
        </div>
        <div class="ptl-fila-badge-slot">${badgeCobroInner}</div>
        ${lineaTiempoHtml(c, true)}
        <span class="ptl-fila-importe">${fmtMoneda(c.pto_total)}</span>
      </a>
    `;
    }).join("");

    return `
      ${renderCabeceraComun(token, comunidades, {
        filtroActivo: filtroEfectivo,
        busqueda,
        orden: ordenEf,
        mostrarOrden: true,
        searchInHeader: true,
        cuadra,
      })}
      <div>
        ${filas || `<div class="ptl-empty"><h3>Sin resultados</h3><p>No hay presupuestos que cumplan los filtros</p></div>`}
      </div>
    `;
  }

  // =================================================================
  // VISTA: FICHA DE EXPEDIENTE CCPP
  // =================================================================
  // opts (opcional):
  //   - extraHtmlFinal: HTML extra que se inserta al final de la ficha
  //     (lo usa documentacion.cjs para añadir la cajita de vecinos).
  async function vistaFicha(comu, datalists, token, reciencreado, opts) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    const disp = calcularDisparador(comu);
    const extraHtmlFinal = (opts && opts.extraHtmlFinal) || "";
    const extraHtmlInicial = (opts && opts.extraHtmlInicial) || "";
    const enFaseDoc = FASES_DOCUMENTACION.includes(fase);

    // Histórico de comunicaciones (mails) de esta CCPP — ascendente por fecha.
    // Si la lectura falla, seguimos con [] para no romper la ficha.
    let comuHistorico = [];
    try {
      comuHistorico = await leerMailHistoricoDeCcpp(comu.ccpp_id, comu.direccion);
    } catch (_) { comuHistorico = []; }
    // Set de message_id que están en HOY (para pintar el reloj encendido/apagado).
    let messageIdsEnHoy = new Set();
    try {
      messageIdsEnHoy = await leerMessageIdsEnHoy();
    } catch (_) { messageIdsEnHoy = new Set(); }
    let comuPlantillas = [];
    try {
      comuPlantillas = await leerListaPlantillas();
    } catch (_) { comuPlantillas = []; }
    // Pie de página global para responder/reenviar.
    let pieGlobal = "";
    try {
      const pieRow = await leerPlantillaMail("_PIE_GLOBAL");
      pieGlobal = pieRow ? (pieRow.mensaje || "") : "";
    } catch (_) { pieGlobal = ""; }

    // Plantilla de la fase actual (para el badge de estado de plazo en "Datos CCPP").
    // Solo se carga si la fase tiene reenvíos configurados. Si falla, badge no aparece.
    let plantillaFichaActual = null;
    try {
      const faseActual = normalizarFase(comu.fase_presupuesto);
      if (FASES_CON_REENVIOS.includes(faseActual)) {
        plantillaFichaActual = await leerPlantillaMail(plantillaDeFase(faseActual));
      }
    } catch (_) { plantillaFichaActual = null; }

    // v17.30: índice F1 para esta ficha. Pasamos solo este CCPP en el array
    // y el comuHistorico (que ya solo contiene mails de este CCPP). El
    // indexador detecta ampliación SOLO con los contadores del CCPP, no con
    // el conteo del histórico.
    let f1MapFicha = {};
    try {
      if (plantillaFichaActual) {
        const plMapFicha = {};
        plMapFicha[normalizarFase(comu.fase_presupuesto)] = plantillaFichaActual;
        f1MapFicha = _indexarF1PorCcppFase([comu], comuHistorico, plMapFicha);
      }
    } catch (_) { f1MapFicha = {}; }

    // Botón cuadradito ↶ "volver a fase anterior" (32x32). Solo se renderiza si
    // existe una fase anterior real (cualquier fase activa salvo 01 y los ZZ).
    // Las ramas que muestran cabecera de fase normal lo insertan a la izquierda
    // del icono "→" del título de la fase. Las ramas finales (ZZ) y 01_CONTACTO
    // lo dejan en "".
    // v17.69: eliminado el botón ⏰ HOY que iba apilado encima del ↶. El acceso
    // a HOY ya está en la pestaña ⏰ HOY de la cabecera unificada (v17.63).
    let btnRetrocederHtml = '';
    {
      const faseAnt = calcularFaseAnterior(fase);
      if (faseAnt) {
        const defAnt = PTO_FASES[faseAnt] || FASES_DOCUMENTACION_DEF[faseAnt];
        const labelAnt = defAnt ? `${defAnt.codigo}-${(defAnt.nombreLargo || defAnt.nombre || '').toUpperCase()}` : faseAnt;
        btnRetrocederHtml = `
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/retroceder")}" style="display:inline-flex;margin:0 8px 0 0;vertical-align:middle" id="ptlFormRetroceder_${esc(comu.ccpp_id)}">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="conservar" value=""/>
            <button type="button"
              class="ptl-btn ptl-btn-sm"
              style="width:32px;height:32px;padding:0;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;background:var(--ptl-danger);color:#fff;border:1px solid var(--ptl-danger);font-weight:bold"
              title="Volver a ${esc(labelAnt)}"
              onclick="ptlRetroceder('${esc(comu.ccpp_id)}', '${esc(labelAnt)}')">↶</button>
          </form>`;
      }
    }

    let accionHtml = "";
    if (fase === "ZZ_RECHAZADO") {
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col" style="background:var(--ptl-gray-50);border-color:var(--ptl-gray-200)">
        <div class="ptl-na-left">
          <div class="ico">✕</div>
          <div class="text" style="color:var(--ptl-gray-700)">Expediente rechazado por el cliente</div>
        </div>
        <div class="ptl-na-right ptl-na-igual-altura">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="modo" value="ultimo"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('Reactivar al ÚLTIMO ESTADO: vuelve a la fase en la que estaba y CONSERVA todas las fechas y contadores. ¿Continuar?')">↻ Reactivar (último estado)</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="modo" value="principio"/>
            <button type="submit" class="ptl-btn ptl-btn-sm" onclick="return confirm('Reactivar DESDE EL PRINCIPIO: vuelve a 01-CONTACTO y BORRA fechas y contadores de mail. ¿Seguro?')">⟲ Reactivar (desde el principio)</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Pasar este expediente a ZZ-DESCARTADOS?')">→ A ZZ-DESCARTADOS</button>
          </form>
        </div>
      </div>`;
    } else if (fase === "ZZ_DESCARTADO") {
      // Ficha descartada: Reactivar + Eliminar (borrado físico definitivo)
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col" style="background:var(--ptl-gray-50);border-color:var(--ptl-gray-200)">
        <div class="ptl-na-left">
          <div class="ico">✕</div>
          <div class="text" style="color:var(--ptl-gray-700)">Expediente descartado</div>
        </div>
        <div class="ptl-na-right ptl-na-igual-altura">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="modo" value="ultimo"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('Reactivar al ÚLTIMO ESTADO: vuelve a la fase en la que estaba y CONSERVA todas las fechas y contadores. ¿Continuar?')">↻ Reactivar (último estado)</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="modo" value="principio"/>
            <button type="submit" class="ptl-btn ptl-btn-sm" onclick="return confirm('Reactivar DESDE EL PRINCIPIO: vuelve a 01-CONTACTO y BORRA fechas y contadores de mail. ¿Seguro?')">⟲ Reactivar (desde el principio)</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/eliminar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Eliminar definitivamente este expediente? Esta acción NO se puede deshacer.')">🗑 ELIMINAR</button>
          </form>
        </div>
      </div>`;
    } else if (fase === "09_TRAMITADA") {
      // v18.48: fase terminal con TRES estados, calculados por DOS fechas:
      //   - sin fecha_pte_cobro y sin fecha_cobro  -> En ejecucion (obra en curso)
      //   - con fecha_pte_cobro y sin fecha_cobro  -> Pendiente de cobro (obra fin)
      //   - con fecha_cobro                         -> Cobrado
      // Dos cajitas de fecha (PTE COBRO + COBRADO), mismo estilo que el resto.
      // fecha_cobro (BE) ya existia; fecha_pte_cobro (BH) es nueva.
      const fco = comu.fecha_cobro || '';
      const fpc = comu.fecha_pte_cobro || '';
      // v18.50 — el estado se muestra como BADGE (mismas clases que el resto de
      // fases), no como texto plano: Cobrado=en-plazo(verde), Pendiente=decidir
      // (ambar), En ejecucion=ejecucion(azul claro).
      let estado09Cls, estado09Txt;
      if (fco) {
        estado09Cls = 'ptl-fila-badge-en-plazo';
        estado09Txt = '💶 Cobrado el ' + esc(formatearFechaDDMMYYYY(fco));
      } else if (fpc) {
        estado09Cls = 'ptl-fila-badge-decidir';
        estado09Txt = '⏳ Pendiente de cobro desde ' + esc(formatearFechaDDMMYYYY(fpc));
      } else {
        estado09Cls = 'ptl-fila-badge-ejecucion';
        estado09Txt = '🔨 En ejecución';
      }
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          <div class="ico" style="color:var(--ptl-success)">✓</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>09-TRAMITADO</span>
            <div style="margin-top:4px"><span class="ptl-fila-badge ${estado09Cls}">${estado09Txt}</span></div>
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha en que la obra TERMINA y queda pendiente de cobrar. Dejala vacia mientras la obra esta en ejecucion.">
          <span class="ln ptl-label-mini">Pte cobro</span>
          <input type="date" id="ptl-mini-fecha-pte-cobro" value="${esc(fpc)}"
            onchange="ptlSyncFechaPteCobro(this.value)"
            class="ptl-input-num"/>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha en que se cobro la obra al cliente. Dejala vacia si todavia no se ha cobrado.">
          <span class="ln ptl-label-mini">Cobrado</span>
          <input type="date" id="ptl-mini-fecha-cobro" value="${esc(fco)}"
            onchange="ptlSyncFechaCobro(this.value)"
            class="ptl-input-num"/>
        </div>
      </div>
      <script>
        (function(){
          async function _ptlGuardarFecha09(campo, v) {
            try {
              const fd = new URLSearchParams();
              fd.append('id', ${JSON.stringify(comu.ccpp_id)});
              fd.append('campo', campo);
              fd.append('valor', v || '');
              const r = await fetch(${JSON.stringify(urlT(token, "/presupuestos/expediente/campo"))}, { method: 'POST', body: fd });
              if (r.ok) {
                window.ptlRecargaLimpia();
              } else {
                alert('Error guardando la fecha: ' + r.status);
              }
            } catch (e) {
              alert('Error de red: ' + e.message);
            }
          }
          window.ptlSyncFechaCobro    = function(v){ _ptlGuardarFecha09('fecha_cobro', v); };
          window.ptlSyncFechaPteCobro = function(v){ _ptlGuardarFecha09('fecha_pte_cobro', v); };
        })();
      </script>`;
    } else if (fase === "04_ACEPTACION_PTO") {
      // Texto fase actual igual que el resto (sin la fecha, que ya se ve en el timeline)
      const labelFase04 = `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;
      const fpm = comu.fecha_proximo_mail_manual || '';

      // Indicador de reenvíos automáticos (segunda línea bajo el título de la fase)
      let infoEnvioAuto04Html = '';
      try {
        const plantilla04 = await leerPlantillaMail(fase);
        const info = calcularInfoEnvioAuto(comu, fase, plantilla04);
        if (info.texto) {
          infoEnvioAuto04Html = `<div class="sub">${esc(info.texto)}</div>`;
        }
      } catch (e) { /* si falla la lectura de plantilla, no se pinta el indicador */ }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span class="ptl-fase-titulo">${esc(labelFase04)}</span>
            ${infoEnvioAuto04Html}
            <div style="margin-top:4px">${renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha))}</div>
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>
        <div class="ptl-na-right">
          <button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-sm"
            onclick="ptlIntentarReenviarFase04('${esc(comu.ccpp_id)}')"
            title="Abre el modal para reenviar el presupuesto con los cambios realizados">
            📧 Reenviar presupuesto revisado
          </button>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/aceptar")}" class="ptl-inline" id="ptl-form-aceptar">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="button" class="ptl-btn ptl-btn-success ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_ACEPTACION_PTO', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de aceptación. Al confirmar, también pasa a fase 05-DOCUMENTACION.">✓ ACEPTADO</button>
          </form>
          <button type="button" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="ptlAbrirModalRechazo('${esc(comu.ccpp_id)}')">✕ RECHAZADO</button>
        </div>
      </div>
      <div id="ptl-modal-rechazo" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">
        <div style="background:var(--ptl-general-flotante);border-radius:8px;padding:20px;max-width:480px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2)">
          <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:var(--ptl-danger-dark)">✕ Rechazar presupuesto</h3>
          <p style="margin:0 0 14px 0;font-size:13px;color:var(--ptl-gray-600)">Indica el motivo del rechazo:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" id="ptl-rech-precio" class="ptl-btn ptl-btn-danger" style="text-align:left;padding:10px 14px">POR PRECIO MÁS BAJO DE LA COMPETENCIA</button>
            <button type="button" id="ptl-rech-momento" class="ptl-btn ptl-btn-danger" style="text-align:left;padding:10px 14px">PORQUE NO SE VA A HACER DE MOMENTO</button>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px">
            <button type="button" id="ptl-rech-cancel" class="ptl-btn" style="background:var(--ptl-gray-100)">Cancelar</button>
          </div>
        </div>
      </div>
      <script>
        (function(){
          var modal = document.getElementById('ptl-modal-rechazo');
          var ccppIdRech = null;
          window.ptlAbrirModalRechazo = function(id){
            ccppIdRech = id;
            modal.style.display = 'flex';
          };
          function cerrar(){ modal.style.display = 'none'; ccppIdRech = null; }
          async function rechazar(motivo){
            if (!ccppIdRech) return;
            // Si hay cambios sin guardar en la ficha, los guardamos primero
            // para no perderlos. Si falla, abortamos el rechazo.
            try {
              if (typeof ptlDiff === 'function' && Object.keys(ptlDiff()).length > 0) {
                const ok = await ptlGuardar();
                if (!ok) {
                  alert('No se pudieron guardar los cambios pendientes. Rechazo cancelado.');
                  return;
                }
              }
            } catch (e) { /* si ptlDiff/ptlGuardar no existen aquí, seguimos */ }
            // Ahora POST al endpoint de rechazo con fetch.
            try {
              const body = new URLSearchParams({ id: ccppIdRech, motivo: motivo });
              const res = await fetch(${JSON.stringify(urlT(token, "/presupuestos/expediente/rechazar"))}, {
                method: 'POST',
                headers: {'Content-Type':'application/x-www-form-urlencoded'},
                body: body.toString()
              });
              if (!res.ok) {
                const t = await res.text();
                alert('No se pudo rechazar: ' + t);
                return;
              }
              window.ptlRecargaLimpia(); // v18.36 — recarga limpia (NO reload)
            } catch (e) {
              alert('Error: ' + e.message);
            }
          }
          document.getElementById('ptl-rech-precio').onclick   = function(){ rechazar('POR PRECIO MÁS BAJO DE LA COMPETENCIA'); };
          document.getElementById('ptl-rech-momento').onclick  = function(){ rechazar('PORQUE NO SE VA A HACER DE MOMENTO'); };
          document.getElementById('ptl-rech-cancel').onclick   = cerrar;
          modal.addEventListener('click', function(e){ if (e.target === modal) cerrar(); });
        })();
      </script>`;
    } else if (enFaseDoc) {
      // Fases del módulo documentación (05/06/07): barra azul oscura con
      // un botón principal de avance + descartar. Misma estructura visual
      // que las fases 01/02. La definición de la fase está en
      // FASES_DOCUMENTACION_DEF (más abajo en el archivo).
      const defDoc = FASES_DOCUMENTACION_DEF[fase];
      const labelFaseDoc = defDoc
        ? `${defDoc.codigo}-${(defDoc.nombreLargo || defDoc.nombre || '').toUpperCase()}`
        : fase;
      const sigDoc = defDoc && defDoc.siguiente ? FASES_DOCUMENTACION_DEF[defDoc.siguiente] : null;
      const labelSigDoc = sigDoc
        ? `→ Paso a ${sigDoc.codigo}-${(sigDoc.nombreLargo || sigDoc.nombre || '').toUpperCase()}`
        : null;

      // Caso especial fase 06_VISITA_EMASESA: clon estructural de la fase
      // 02_VISITA. Lleva un mini-bloque "FECHA VISITA" en el centro que
      // edita directamente el campo `fecha_visita_emasesa` del Sheet.
      let miniBloqueDocHtml = '<div></div>';
      if (fase === "06_VISITA_EMASESA") {
        const fve = comu.fecha_visita_emasesa || '';
        miniBloqueDocHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha real en que EMASESA visitó el CCPP">
          <span class="ln ptl-label-mini">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita-emasesa" value="${esc(fve)}"
            onchange="ptlSyncFechaVisitaEmasesa(this.value)"
            class="ptl-input-num"/>
        </div>`;
      } else if (fase === "05_DOCUMENTACION" || (fase === "08_CYCP" && !comu.fecha_cycp_completa)) {
        // Casilla "Próximo mail" — clon de la fase 04. Permite forzar la
        // próxima fecha en que el cron disparará el mail recurrente
        // (05_SEGUIMIENTO_DOC o 08_SEGUIMIENTO_CYCP). Al rellenarla, el
        // cron en su próximo tick verá que toca y lo enviará. La cadencia
        // normal se reanuda desde ahí.
        const fpm = comu.fecha_proximo_mail_manual || '';
        miniBloqueDocHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>`;
      }

      // Botón de avance:
      //  - Si hay siguiente fase definida: botón normal de paso a la siguiente.
      //  - Si NO hay siguiente (08_CYCP sin fecha de cierre): botón "Cerrar fase 08".
      //  - Si NO hay siguiente y ya cerrada: sin botón.
      let botonAvanzarHtml = '';
      if (labelSigDoc) {
        if (fase === "05_DOCUMENTACION") {
          // Al pulsar "→ Paso a 06-VISITA EMASESA" se abre el modal del mail
          // 05_FIN_DOC. El avance a fase 06 lo hace el endpoint /enviar-mail
          // al confirmar el envío (caso especial avanzadoA06).
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_FIN_DOC', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de fin de documentación. Al confirmar, también pasa a fase 06-VISITA EMASESA.">${esc(labelSigDoc)}</button>`;
        } else if (fase === "07_PTE_CYCP") {
          // Al pulsar "→ Paso a 08-CYCP" se abre el modal del mail
          // 08_INICIO_CYCP. El avance a fase 08 lo hace el endpoint /enviar-mail
          // al confirmar el envío (caso especial avanzadoA08).
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
              onclick="ptlAbrirModalMail('08_INICIO_CYCP', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de inicio de fase 08-CYCP (solicitud de contratos firmados y pagos). Al confirmar, también pasa a fase 08-CYCP.">${esc(labelSigDoc)}</button>`;
        } else {
          botonAvanzarHtml = `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" class="ptl-inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-avanzar ptl-btn-sm">${esc(labelSigDoc)}</button>
            </form>`;
        }
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        // Cierre de fase 08: abre modal del mail 08_FIN_CYCP. El cierre real
        // (fecha_cycp_completa = hoy) lo hace el endpoint /enviar-mail al
        // confirmar el envío (caso especial cerradoFase08). El endpoint
        // legacy /cerrar-cycp se mantiene por compatibilidad pero ya no se
        // usa desde la UI.
        botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
            onclick="ptlAbrirModalMail('08_FIN_CYCP', '${esc(comu.ccpp_id)}')"
            title="Abre el modal para enviar el mail de cierre de fase 08-CYCP. Al confirmar, también cierra la fase (fecha_cycp_completa = hoy) y pasa a 09-TRAMITADA.">✓ Tramitados</button>`;
      }

      // Indicador de reenvíos automáticos (segunda línea bajo el título de la fase).
      // Solo en fases con cron de seguimiento: 05_DOCUMENTACION y 08_CYCP.
      // === BADGE UNICO DE LA FICHA (05/08): MISMA fuente que HOY (_badgeUltimatumHoy en
      // modo solo-estado). Asi ficha y HOY muestran SIEMPRE el mismo aviso. El boton vive
      // solo en HOY; aqui, donde HOY pone boton, la ficha pone un badge "Toca ...".
      let _badgeFichaDoc = '';
      if (fase === "05_DOCUMENTACION" || (fase === "08_CYCP" && !comu.fecha_cycp_completa)) {
        try {
          let _contactoF = "", _plazosF = null, _cfgF = undefined;
          if (fase === "05_DOCUMENTACION") {
            _contactoF = await _fechaContactoBot(comu);
            const _pA = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
            const _pR = await leerPlantillaMail("05_ULT_RESOLUCION").catch(() => null);
            const _pV = await leerPlantillaMail("05_ULT_RESOLVER").catch(() => null);
            _plazosF = { ampliar: _pA && _pA.dias_primer_envio, recordatorio: _pA && _pA.dias_recurrente, disidentes: _pR && _pR.dias_primer_envio, resolver: _pV && _pV.dias_primer_envio };
          } else {
            _contactoF = String(comu.fecha_envio_contratos_pagos || "").slice(0, 10);
            const _pA = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
            const _pR = await leerPlantillaMail("08_ULT_RESOLUCION").catch(() => null);
            const _pV = await leerPlantillaMail("08_ULT_RESOLVER").catch(() => null);
            _plazosF = { ampliar: _pA && _pA.dias_primer_envio, recordatorio: _pA && _pA.dias_recurrente, disidentes: _pR && _pR.dias_primer_envio, resolver: _pV && _pV.dias_primer_envio };
            _cfgF = { plazoIni: PLAZO_CYCP_INICIAL, acc: { ampliar: "ampliar8", disidentes: "disidentes8", resolver: "resolver8", recordar: "recordar8" }, txtFinal: "Resolver el contrato", txtNeutro: "Contrato resuelto", txtEnPlazo: "Contratos solicitados", defAmp: 10, defRes: 5, defRec: 10, flagRec: "08_ULT_RECORDATORIO" };
          }
          let _retSeg = false;
          try { const _eSeg = calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha); _retSeg = !!(_eSeg && _eSeg.estado === "retrasado"); } catch (e2) {}
          _badgeFichaDoc = _badgeUltimatumHoy(comu, _contactoF, _plazosF, _cfgF, true, _retSeg) || "";
        } catch (e) { _badgeFichaDoc = ""; }
        if (!_badgeFichaDoc) _badgeFichaDoc = renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha));
      } else {
        _badgeFichaDoc = renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha));
      }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span class="ptl-fase-titulo">${esc(labelFaseDoc)}</span>
            <div style="margin-top:4px">${_badgeFichaDoc}</div>
          </div>
        </div>
        ${miniBloqueDocHtml}
        <div class="ptl-na-right ptl-na-igual-altura">
          ${botonAvanzarHtml}
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" class="ptl-inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Descartar este expediente? Pasará a ZZ-DESCARTADO y no podrá enviarse más.')">✕ A ZZ-DESCARTADOS</button>
          </form>
        </div>
      </div>`;
    } else if (def && def.siguiente) {
      // Fases activas con email asociado: 01_CONTACTO, 03_ENVIO_PTO
      const tienePlantilla = !!def.plantilla;
      const enviados = (() => { try { return JSON.parse(comu.mails_enviados || "{}"); } catch { return {}; } })();
      const numEnviosFase = enviados[fase] || 0;

      // Texto indicador con código + nombre (la fecha se ve en el timeline debajo)
      const labelFaseActual = `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;

      // ----- INDICADOR de envíos automáticos (segunda línea bajo el título) -----
      // Se pinta SOLO en las fases que tienen reenvíos automáticos vía cron
      // (FASES_CON_REENVIOS). Muestra "no iniciado" si está en 0, "en curso"
      // con fecha del próximo, "completado" o "desactivado". La fase 03 tiene
      // plantilla pero es un envío manual único que avanza a 04, no hay
      // reenvíos: ahí no se pinta.
      let infoEnvioAutoHtml = "";
      if (tienePlantilla && FASES_CON_REENVIOS.includes(fase)) {
        try {
          const plantillaSheet = await leerPlantillaMail(fase);
          const info = calcularInfoEnvioAuto(comu, fase, plantillaSheet);
          if (info.texto) {
            infoEnvioAutoHtml = `<div class="sub">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla la lectura */ }
      }

      // Texto botón siguiente
      const sig = PTO_FASES[def.siguiente];
      const labelSig = sig
        ? `→ Paso a ${sig.codigo}-${(sig.nombreLargo || sig.nombre || '').toUpperCase()}`
        : `→ ${esc(def.accionLabel)}`;

      // Botón mail: estilo secondary original (gris claro). Solo si la plantilla está activa.
      // Cuando ya hay envíos, se oculta (lo gestiona el cron).
      let btnMailHtml = '';
      if (tienePlantilla && numEnviosFase === 0) {
        btnMailHtml = `<button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l"
          onclick="ptlAbrirModalMail('${esc(fase)}', '${esc(comu.ccpp_id)}')"
          title="Enviar el primer mail y dejar el resto al cron automático">
          <span class="ln">📧 Activar</span>
          <span class="ln">mail</span>
          <span class="ln">automático</span>
        </button>`;
      }

      // Mini-bloque "FECHA VISITA" en fase 02_VISITA (sustituye al hueco del botón mail).
      // El input edita directamente el campo fecha_visita del formulario principal,
      // así que aprovecha el sistema de "guardar al cambiar" que ya existe.
      let miniBloqueHtml = '';
      if (fase === "02_VISITA") {
        const fv = comu.fecha_visita || '';
        miniBloqueHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha real en que se hizo la visita">
          <span class="ln ptl-label-mini">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita" value="${esc(fv)}"
            onchange="ptlSyncFechaVisita(this.value)"
            class="ptl-input-num"/>
        </div>`;
      } else if (fase === "01_CONTACTO") {
        // Casilla "Próximo mail" — clon de la fase 04. Permite forzar la
        // próxima fecha en que el cron disparará el reenvío automático de
        // fase 01. Al rellenarla, el cron en su próximo tick verá que toca y
        // lo enviará. Tras el envío se borra y la cadencia normal se reanuda.
        const fpm = comu.fecha_proximo_mail_manual || '';
        miniBloqueHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>`;
      }

      // Caso especial fase 03_ENVIO_PTO: un único botón grande "Enviar presupuesto y Paso a 04"
      // que ocupa la columna derecha (donde antes iban los dos botones apilados).
      // No hay botón rojo de descartar en esta fase.
      // Antes de abrir el modal, valida que estén rellenos los datos económicos previstos.
      if (fase === "03_ENVIO_PTO") {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span class="ptl-fase-titulo">${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          <div class="ptl-na-right ptl-na-igual-altura">
            <button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm ptl-btn-enviar-avanzar"
              onclick="ptlIntentarEnviarFase03('${esc(fase)}', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para revisar y enviar el presupuesto. Al confirmar, también pasa a fase 04-ACEPTACION PTO.">
              <span class="ln">📧 Enviar presupuesto</span>
              <span class="ln">Y paso a 04-ACEPTACION PTO</span>
            </button>
          </div>
        </div>`;
      } else {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span class="ptl-fase-titulo">${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
              <div style="margin-top:4px">${renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha))}</div>
            </div>
          </div>
          ${btnMailHtml || miniBloqueHtml || '<div></div>'}
          <div class="ptl-na-right ptl-na-igual-altura">
            ${ fase === "01_CONTACTO"
              ? `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
                  onclick="ptlPreguntarActaPaso02('${esc(comu.ccpp_id)}')"
                  title="Pregunta si han enviado el acta y abre el modal del mail correspondiente. Al confirmar, también pasa a fase 02-VISITA (pendiente de visita).">${esc(labelSig)}</button>`
              : `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" class="ptl-inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-avanzar ptl-btn-sm">${esc(labelSig)}</button>
            </form>` }
            <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" class="ptl-inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Descartar este expediente? Pasará a ZZ-DESCARTADO y no podrá enviarse más.')">✕ A ZZ-DESCARTADOS</button>
            </form>
          </div>
        </div>`;
      }
    }

    // Helper inputs
    const inp = (name, val, opts = {}) => {
      const tipo = opts.type || "text";
      // Para campos numéricos, usamos type=text + clase para formatearlos con JS
      const esEuros = tipo === "number" && (opts.formato === "euros" || /pto_total|mano_obra|material|beneficio/.test(name));
      const esDias  = tipo === "number" && (opts.formato === "dias" || /tiempo/.test(name));
      let inputType = tipo === "email" ? "email" : (tipo === "tel" ? "tel" : "text");
      if (tipo === "number" && !esEuros && !esDias) inputType = "number";
      const col = opts.col || 3;
      const lbl = opts.label || name;
      const step = (tipo === "number" && inputType === "number") ? ' step="0.01"' : '';
      let cls = "";
      if (tipo === "tel") cls = ' class="campo-tlf"';
      else if (esEuros) cls = ' class="campo-euros"' + (opts.readonly ? '' : ' inputmode="decimal"');
      else if (esDias)  cls = ' class="campo-dias"'  + (opts.readonly ? '' : ' inputmode="decimal"');
      // Si el campo es readonly, le aplicamos la clase calc-field para que tenga la sombra gris
      // de los campos bloqueados (igual que Desvío tiempo / Desvío beneficio).
      if (opts.readonly) {
        cls = cls.replace('class="', 'class="calc-field ');
        if (!cls.includes('class="')) cls = ' class="calc-field"';
      }
      const ro = opts.readonly ? ' readonly' : '';
      const list = opts.list ? ` list="${opts.list}"` : '';
      return `<div class="col-${col}">
        <label class="ptl-form-label">${esc(lbl)}</label>
        <input type="${inputType}" name="${name}" value="${esc(val == null ? '' : val)}" data-orig="${esc(val == null ? '' : val)}"${step}${cls}${list}${ro}/>
      </div>`;
    };

    // Determinar qué campos económicos están bloqueados según la fase actual.
    // Reglas:
    //  - Fases 01_CONTACTO y 02_VISITA: TODOS los campos económicos editables bloqueados.
    //  - Fases 03_ENVIO_PTO en adelante: solo los 4 "previstos" desbloqueados.
    //  - Los campos REAL siguen bloqueados de momento (más adelante se decidirá cuándo activarlos).
    //  - Calculados (desvíos, beneficios) están siempre bloqueados (se renderizan aparte).
    const fasePtl = normalizarFase(comu.fase_presupuesto);
    // Los campos "previstos" siguen editables aunque el CCPP ya esté en una
    // fase del módulo documentacion (05+), por si hay que retocar importes.
    // Si el expediente tiene Plan 5, los importes "previstos" (PTO total, tiempo,
    // mano de obra y material) los manda el boton Congelar -> en la ficha se
    // muestran BLOQUEADOS (gris calc-field), no se editan a mano. (sesion 27/06)
    const tienePlan5 = await _expedienteTienePlan5(comu);
    const previstoEditable = !tienePlan5 && !["01_CONTACTO","02_VISITA","ZZ_RECHAZADO","ZZ_DESCARTADO"].includes(fasePtl);
    // Los campos "real" se desbloquean SOLO en fase 09_TRAMITADA; bloqueados en
    // 01-08 (cambio sesion 07/06/2026: antes se abrian en 08_CYCP).
    const realEditable = (fasePtl === "09_TRAMITADA");
    const roPrevisto = !previstoEditable;
    const roReal = !realEditable;
    // Los campos REALES (tiempo/mano_obra/material/beneficio real) y los DESVIOS
    // (tiempo y beneficio) solo tienen sentido con la obra hecha: se MUESTRAN
    // unicamente en 09_TRAMITADA. En el resto de fases la caja ensena solo los
    // PREVISTOS. (sesion 27/06)
    const enTramitada = (fasePtl === "09_TRAMITADA");

    const expDataJson = JSON.stringify({
      direccion: comu.direccion || "", comunidad: comu.comunidad || "", tipo_via: comu.tipo_via || "", earth: comu.earth || "",
      poblacion: comu.poblacion || "", cp: comu.cp || "",
      administrador: comu.administrador || "", telefono_administrador: fmtTlf(comu.telefono_administrador),
      email_administrador: comu.email_administrador || "",
      presidente: comu.presidente || "", telefono_presidente: fmtTlf(comu.telefono_presidente),
      email_presidente: comu.email_presidente || "",
      pto_total: comu.pto_total || "", mano_obra_previsto: comu.mano_obra_previsto || "", mano_obra_real: comu.mano_obra_real || "",
      material_previsto: comu.material_previsto || "", material_real: comu.material_real || "",
      tiempo_previsto: comu.tiempo_previsto || "", tiempo_real: comu.tiempo_real || "",
      notas_pto: comu.notas_pto || "",
    }).replace(/</g, "\\u003c");

    // Info de administradores existentes para autocompletar tel/email
    const adminInfoJson = JSON.stringify(datalists.adminInfo || {}).replace(/</g, "\\u003c");
    const ccppIdActual = comu.ccpp_id || "";

    // Listas para autocompletado custom (tipos via + admins + presidentes)
    const tiposViaPredef = ["C","Av","Bª","Pz","Pza","Rª","Ur"];
    const tiposViaBd = (datalists.tiposVia || []);
    const tiposViaUnion = Array.from(new Set([...tiposViaPredef, ...tiposViaBd])).filter(Boolean);
    const acDataJson = JSON.stringify({
      admins: datalists.admins || [],
      presis: datalists.presis || [],
      tipos:  tiposViaUnion,
    }).replace(/</g, "\\u003c");

    return `
      ${accionHtml}

      <div class="ptl-card">
        ${lineaTiempoHtml(comu)}
      </div>

      <form id="ptl-ficha-form" data-id="${esc(comu.ccpp_id)}" onsubmit="return false">
        <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
        ${extraHtmlInicial}

        <div class="ptl-card ptl-card-compact" style="padding:6px 12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
            <div class="ptl-flex-c-g8">
              <div class="ptl-card-title ptl-m0">Datos CCPP</div>
            </div>
            <div class="ptl-flex-c-g6">
              <button type="button" id="ptlBtnCarpetaDrive"
                class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme"
                title="Abrir la carpeta de este expediente en Google Drive">📁 CARPETA DRIVE</button>
            </div>
          </div>
          <div class="ptl-form-grid ptl-gap26">
            <div class="col-1">
              <label class="ptl-form-label">Tipo via</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" value="${esc(comu.tipo_via || '')}" data-orig="${esc(comu.tipo_via || '')}" placeholder="C" autocomplete="off"/>
              </div>
            </div>
            <div class="col-6">
              <label class="ptl-form-label">Direccion</label>
              <input name="direccion" value="${esc(comu.direccion || '')}" data-orig="${esc(comu.direccion || '')}" class="ptl-w100"/>
            </div>
            <div class="col-3">
              <label class="ptl-form-label">Poblacion</label>
              <input name="poblacion" value="${esc(comu.poblacion || '')}" data-orig="${esc(comu.poblacion || '')}" class="ptl-w100"/>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">CP</label>
              <input name="cp" value="${esc(comu.cp || '')}" data-orig="${esc(comu.cp || '')}" class="ptl-w100"/>
            </div>
            <!-- v18.03: "Comunidad (clave)" se oculta de la vista (no se edita aquí;
                 la usa el bot de WhatsApp y pestañas vecinos_base/expedientes). Se
                 mantiene como hidden para no perder el dato al guardar la fila. -->
            <input type="hidden" name="comunidad" value="${esc(comu.comunidad || '')}" data-orig="${esc(comu.comunidad || '')}"/>
          </div>

          <div class="ptl-form-grid ptl-gap26">
            <div class="col-6">
              <label class="ptl-form-label">Administrador</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" value="${esc(comu.administrador || '')}" data-orig="${esc(comu.administrador || '')}" autocomplete="off"/>
              </div>
            </div>
            ${inp("telefono_administrador", fmtTlf(comu.telefono_administrador), { col: 2, type: "tel", label: "Telefono" })}
            ${inp("email_administrador",    comu.email_administrador, { col: 4, type: "email", label: "Email" })}
          </div>

          <div class="ptl-form-grid ptl-gap26">
            <div class="col-6">
              <label class="ptl-form-label">Presidente</label>
              <input name="presidente" value="${esc(comu.presidente || '')}" data-orig="${esc(comu.presidente || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_presidente", fmtTlf(comu.telefono_presidente), { col: 2, type: "tel", label: "Telefono" })}
            ${inp("email_presidente",    comu.email_presidente, { col: 4, type: "email", label: "Email" })}
          </div>
        </div>

        ${["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","ZZ_RECHAZADO","ZZ_DESCARTADO"].includes(fase) ? `<div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="ptl-card-title ptl-m0">Notas</div>
            <button type="button"
                    class="ptl-vec-btn ptl-exp-reloj ${(String(comu.en_hoy || '').trim() === '1') ? 'ptl-btn-reloj' : 'ptl-btn-reloj-off'}"
                    data-ccpp-id="${esc(comu.ccpp_id || '')}"
                    data-enhoy="${(String(comu.en_hoy || '').trim() === '1') ? '1' : '0'}"
                    title="${(String(comu.en_hoy || '').trim() === '1') ? 'Quitar de HOY' : 'Añadir a HOY'}">⏰</button>
          </div>
          <textarea name="notas_pto" data-orig="${esc(comu.notas_pto || '')}" rows="1" autocomplete="off" class="ptl-input-modal ptl-textarea-grow" style="resize:vertical;overflow:hidden">${esc(comu.notas_pto || '')}</textarea>
        </div>` : ''}

        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title ptl-m0">Comunicaciones</div>
            <div class="ptl-flex-g6">
              <button type="button" id="ptlComSendBtn"
                class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme"
                title="Enviar mail manual">📧 Enviar mail manual</button>
            </div>
          </div>
          <style>
            /* Cajita Comunicaciones — filas compactas (scoped) */
            /* v18.24 — el texto de las filas va sobre fondo blanco/gris (zebra),
               así que NO hereda el azul claro de la caja: se fuerza a NEGRO. */
            .ptl-com-list{color:var(--ptl-gray-900)}
            .ptl-com-list .ptl-vec-btn{width:18px;height:18px;font-size:9px}
            .ptl-com-list .ptl-com-grid{padding:0 6px;line-height:1.1}
            .ptl-com-list .ptl-com-row:nth-child(even){background:var(--ptl-general-2)}
            .ptl-com-list .ptl-com-row:nth-child(odd){background:var(--ptl-general-3)}
            .ptl-com-list .hoy-asunto-clic:hover{color:#000;font-weight:700}
          </style>
          ${(() => {
            // Formatea fecha del histórico a "dd/mm/aa hh:mm" o "dd/mm/aa".
            // Usa zona horaria Europe/Madrid: el servidor (Render) corre en UTC,
            // así que sin TZ explícita las horas saldrían 1-2h por debajo.
            const fmtFecha = (s) => {
              if (!s) return "";
              const t = Date.parse(s);
              if (isNaN(t)) return String(s);
              const d = new Date(t);
              const partes = new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
              }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
              const dd = partes.day, mm = partes.month, aa = partes.year;
              const hh = partes.hour === '24' ? '00' : partes.hour;
              const mi = partes.minute;
              const tieneHora = (hh !== "00" || mi !== "00");
              return tieneHora ? `${dd}-${mm}-${aa} ${hh}:${mi}` : `${dd}-${mm}-${aa}`;
            };
            // Quita el prefijo "C [tipo_via] [direccion] -" del asunto si coincide con la CCPP actual.
            // El patrón típico es "C Ciudad de Carcagente 2 -Presupuesto..." (con o sin espacio tras el guión).
            const tipoVia = String(comu.tipo_via || "").trim();
            const direccionCcpp = String(comu.direccion || "").trim();
            const prefijos = [];
            if (tipoVia && direccionCcpp) prefijos.push(`${tipoVia} ${direccionCcpp}`);
            if (direccionCcpp) prefijos.push(direccionCcpp);
            const limpiarAsunto = (a) => {
              let s = String(a || "").trim();
              for (const p of prefijos) {
                // intenta eliminar "PREFIJO -" o "PREFIJO-" al inicio (case-insensitive)
                const re = new RegExp("^" + p.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&") + "\\\\s*-\\\\s*", "i");
                if (re.test(s)) { s = s.replace(re, ""); break; }
              }
              return s;
            };
            const renderAdjuntos = (raw) => {
              const s = String(raw || "").trim();
              if (!s) return "";
              const conLinks = esc(s).replace(
                /(https?:\/\/[^\s<>"]+)/g,
                '<a href="$1" target="_blank" rel="noopener" style="color:var(--ptl-brand);text-decoration:underline">$1</a>'
              ).replace(/ \|\| /g, "\n");
              return `<div style="margin-top:6px;font-size:11px;color:var(--ptl-gray-700);white-space:pre-wrap;word-break:break-word">${conLinks}</div>`;
            };
            if (!comuHistorico.length) {
              return `<div class="ptl-empty-msg">— Sin comunicaciones registradas —</div>`;
            }
            // Deduce dirección a partir del tipo. Por convención:
            //   tipos con sufijo "_entrada" o que contengan "entrada" → ↓ (entrante)
            //   resto → ↑ (saliente)
            const esEntrante = (tipo) => /entrada/i.test(String(tipo || ""));
            // Categorías visibles: Manual (todos los manual_*) | Automático (automatico/cron)
            const categoriaDe = (tipo) => {
              const t = String(tipo || "").toLowerCase();
              if (t.startsWith("manual") || t === "reenvio_fase04") return { label: "Manual", cls: "ptl-fila-badge-neutro" };
              if (t === "automatico") return { label: "Automático", cls: "ptl-fila-badge-success" };
              return { label: t || "—", cls: "ptl-fila-badge-neutro" };
            };
            const filas = comuHistorico.map((m, idx) => {
              const fechaTxt = fmtFecha(m.fecha);
              const asuntoLimpio = limpiarAsunto(m.asunto);
              const asuntoHtml = asuntoLimpio
                ? esc(asuntoLimpio)
                : `<span style="color:var(--ptl-gray-400);font-style:italic">— envío externo —</span>`;
              const entrante = esEntrante(m.tipo);
              const flecha = entrante ? '▼' : '▲';
              const colorFlecha = entrante ? 'var(--ptl-danger)' : 'var(--ptl-brand)';
              const labelDest = entrante ? 'Remitente' : 'Destinatario';
              const cat = categoriaDe(m.tipo);
              const destTxt = String(m.destinatario || "").trim() || "—";
              const fasePlantilla = String(m.fase || "").trim() || "—";
              const cuerpo = String(m.mensaje || "").replace(/\\n/g, "\n");
              // Datos para identificar la fila al borrar (los pasamos al backend).
              const dataAttrs = `data-fecha="${esc(m.fecha)}" data-id="${esc(m.ccpp_id)}" data-dir="${esc(m.direccion)}" data-fase="${esc(m.fase)}" data-asunto="${esc(m.asunto)}" data-tipo="${esc(m.tipo)}"`;
              // Botón reloj: solo para mails entrantes con message_id (los únicos
              // que tienen sentido en HOY). Encendido (color) si está actualmente
              // en HOY; apagado (gris) si no.
              const mid = String(m.message_id || "").trim();
              const enHoy = mid && messageIdsEnHoy.has(mid);
              const mostrarReloj = entrante && mid;
              const btnReloj = mostrarReloj
                ? `<button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-hoy ${enHoy ? 'ptl-btn-reloj' : 'ptl-btn-reloj-off'}" data-mid="${esc(mid)}" data-enhoy="${enHoy ? '1' : '0'}" title="${enHoy ? 'Quitar de HOY' : 'Añadir a HOY'}">⏰</button>`
                : `<span class="ptl-vec-btn" style="visibility:hidden">⏰</span>`;
              // Datos para Responder/Reenviar (los pasamos al JS por data-*).
              // El cuerpo puede ser largo: lo codificamos en base64 para evitar
              // problemas con saltos de línea y comillas dentro del HTML.
              const cuerpoB64 = Buffer.from(String(m.mensaje || ""), "utf8").toString("base64");
              const asuntoB64 = Buffer.from(String(m.asunto || ""), "utf8").toString("base64");
              // v17.96: el campo destinatario del histórico puede venir en formato
              // nuevo "Para: x | CC: y | CCO: z" (todo junto) o en formato antiguo
              // (solo el email). Para el botón Responder necesitamos SOLO el email del
              // "Para" (no queremos meter CC/CCO ni la etiqueta como destinatario).
              const _soloPara = (txt) => {
                const s = String(txt || "");
                const m1 = s.match(/Para:\s*([^|]+)/i);   // formato nuevo
                if (m1) return m1[1].trim();
                // formato antiguo: si por si acaso trae " | CC:..." sin "Para:", corta antes del primer "|"
                return s.split("|")[0].trim();
              };
              const destB64   = Buffer.from(_soloPara(m.destinatario), "utf8").toString("base64");
              const dataRR = `data-fecha="${esc(m.fecha)}" data-dest="${destB64}" data-asunto="${asuntoB64}" data-cuerpo="${cuerpoB64}" data-entrante="${entrante ? '1' : '0'}" data-adjuntos="${esc(m.adjuntos || '')}" data-mid="${esc(mid)}"`;
              return `
                <div class="ptl-com-row" data-idx="${idx}" style="border-bottom:1px solid var(--ptl-gray-100)">
                  <div class="ptl-com-grid" style="display:grid;grid-template-columns:90px 18px 78px 1fr 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px">
                    <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${esc(fechaTxt)}</div>
                    <div style="text-align:center;color:${colorFlecha};font-weight:600">${flecha}</div>
                    <div style="text-align:center"><span class="ptl-fila-badge ${cat.cls}">${esc(cat.label)}</span></div>
                    <div class="hoy-asunto-clic ptl-com-toggle" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-900)" title="${esc(m.asunto || '')}">${asuntoHtml}</div>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-responder" ${dataRR} title="Responder" style="color:var(--ptl-brand);font-weight:bold">↩</button>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-reenviar" ${dataRR} title="Reenviar" style="color:var(--ptl-brand);font-weight:bold">↪</button>
                    ${btnReloj}
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar ptl-com-delete" ${dataAttrs} title="Borrar este registro">✕</button>
                  </div>
                  <div class="ptl-com-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
                    <div class="ptl-mb4"><strong>${labelDest}:</strong> ${esc(destTxt)}</div>
                    <div class="ptl-mb4"><strong>Plantilla:</strong> ${esc(fasePlantilla)}</div>
                    <div class="ptl-mb4"><strong>Mensaje:</strong></div>
                    <div style="white-space:pre-line;word-break:break-word;background:var(--ptl-general-3);padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800)">${_renderCuerpoMail(cuerpo, esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
                    ${renderAdjuntos(m.adjuntos)}
                  </div>
                </div>
              `;
            }).join("");
            return `
              <div class="ptl-com-list" id="ptlComList" style="border:1px solid var(--ptl-gray-200);border-radius:5px;background:var(--ptl-general-3)">
                ${filas}
              </div>
              <script>(function(){function f(){var el=document.getElementById('ptlComList');if(el)el.scrollTop=el.scrollHeight;}if(document.readyState!=='loading'){requestAnimationFrame(f);}else{document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(f);});}})();</script>
            `;
          })()}
        </div>

        <!-- Modal enviar mail manual (compositor tipo Gmail) -->
        <!-- v17.70: convertido en ventana flotante arrastrable estilo Windows.
             v17.71: usa las clases compartidas .ptl-floating-* de estilo-visual.cjs v1.14
             y se inicializa con el helper ptlMakeDraggable (mismo helper que el otro modal). -->
        <div id="ptlComSendModal" class="ptl-floating-wrapper">
          <div id="ptlComSendBox" class="ptl-floating-window" style="width:680px">
            <div id="ptlComSendTitle" class="ptl-floating-title">
              <span class="ptl-floating-title-text">📧 Enviar mail manual</span>
              <button type="button" id="ptlComSxclose" class="ptl-floating-close" title="Cerrar">✕</button>
            </div>
            <div class="ptl-floating-body">
            <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">
              <div>
                <label class="ptl-form-label">Asunto</label>
                <input type="text" id="ptlComSasunto" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">Destinatario (email)</label>
                <input type="text" id="ptlComSdest" placeholder="ejemplo@dominio.com" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">CC (opcional)</label>
                <input type="text" id="ptlComScc" placeholder="separar con coma" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">CCO (opcional)</label>
                <input type="text" id="ptlComScco" placeholder="separar con coma" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">Cuerpo del mensaje</label>
                <textarea id="ptlComScuerpo" rows="10" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;resize:vertical"></textarea>
              </div>
              <div>
                <label class="ptl-form-label">Adjuntos (links de Drive, hasta 3)</label>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <div class="ptl-flex-g6">
                    <input type="text" id="ptlComSadj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj1url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
                  </div>
                  <div class="ptl-flex-g6">
                    <input type="text" id="ptlComSadj2lbl" placeholder="Etiqueta" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj2url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
                  </div>
                  <div class="ptl-flex-g6">
                    <input type="text" id="ptlComSadj3lbl" placeholder="Etiqueta" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj3url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
                  </div>
                </div>
                <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:4px">
                  Los archivos se descargan de Drive y se adjuntan al mail. En el histórico solo se guardan los links.
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
              <button type="button" id="ptlComScancel" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
              <button type="button" id="ptlComSsend" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Enviar</button>
            </div>
            </div>
          </div>
        </div>

        <script>
          (function(){
            // ============================================================
            // v17.71: Helpers globales para ventanas flotantes arrastrables.
            //         Usados por ptlComSendModal (mail manual) y por
            //         ptl-modal-mail (mail con plantilla). Las clases CSS
            //         viven en estilo-visual.cjs v1.14 (.ptl-floating-*).
            // ============================================================
            // ptlMakeDraggable(boxEl, titleEl, closeEl?)
            //   - boxEl:   la ventana (la .ptl-floating-window).
            //   - titleEl: la cabecera arrastrable (.ptl-floating-title).
            //   - closeEl: opcional, el botón ✕; si se clica, no arrastra.
            // Aplica drag por mousedown en titleEl, sigue al cursor con
            // clamping para que la ventana no salga del viewport (margen 4px).
            // v18.39 — window.ptlRecargaLimpia se define AQUÍ (script global que
            // SIEMPRE se renderiza, sea cual sea la fase del expediente). En
            // v18.36 quedó por error dentro del bloque "else if (fase ===
            // '09_TRAMITADA')" -> en cualquier otra fase la función no
            // existía y los handlers que la llaman (envío de mail manual,
            // borrar mail, rechazar, toggle-HOY, avanzar fase, fecha cobro)
            // reventaban con "ptlRecargaLimpia is not a function" (caso real
            // 27/05: Arcangel San Miguel 6 en fase 02).
            //
            // QUÉ HACE: location.replace(href) fuerza carga FRESCA sin la
            // form-restoration del navegador (que en location.reload()
            // restaura los inputs cacheados y puede dejar vacíos campos
            // económicos -> ptlGuardar los escribe vacíos al salir ->
            // PÉRDIDA DE DATOS). Marca window.ptlReloading para que el
            // beforeunload no muestre el aviso de salida.
            window.ptlRecargaLimpia = window.ptlRecargaLimpia || function(){
              window.ptlReloading = true;
              location.replace(location.href);
            };
            // Sondeo del estado de un envío encolado (envío asíncrono anti-cuelgue).
            // Resuelve {ok:true, payload} cuando el servidor terminó el envío, o
            // {ok:false, payload} si dio error. Rechaza con Error('TIMEOUT') si tras
            // 3 min no hay respuesta (el mail puede haber salido igual: el usuario
            // refresca y comprueba en COMUNICACIONES antes de reenviar).
            window.ptlSondearEnvio = window.ptlSondearEnvio || function(envioId){
              return new Promise(function(resolve, reject){
                var base = '${urlT(token, "/presupuestos/expediente/envio-estado")}';
                var t0 = Date.now();
                var MAX = 3 * 60 * 1000;
                function tick(){
                  fetch(base + '&envioId=' + encodeURIComponent(envioId))
                    .then(function(r){ return r.json(); })
                    .then(function(j){
                      if (j.estado === 'ok') { resolve({ ok:true, status:j.status, isJson:j.isJson, payload:j.payload }); return; }
                      if (j.estado === 'error' || j.estado === 'error_http') { resolve({ ok:false, status:j.status, isJson:j.isJson, payload:j.payload }); return; }
                      if (Date.now() - t0 > MAX) { reject(new Error('TIMEOUT')); return; }
                      setTimeout(tick, 1500);
                    })
                    .catch(function(){
                      // Red intermitente: reintentar hasta el tope.
                      if (Date.now() - t0 > MAX) { reject(new Error('TIMEOUT')); return; }
                      setTimeout(tick, 1500);
                    });
                }
                tick();
              });
            };
            window.ptlMakeDraggable = window.ptlMakeDraggable || function(boxEl, titleEl, closeEl){
              if (!boxEl || !titleEl) return;
              let arrastrando = false;
              let offX = 0, offY = 0;
              titleEl.addEventListener('mousedown', function(e){
                if (closeEl && e.target.closest && e.target === closeEl) return;
                if (closeEl && e.target.closest && e.target.closest('.ptl-floating-close')) return;
                arrastrando = true;
                const rect = boxEl.getBoundingClientRect();
                offX = e.clientX - rect.left;
                offY = e.clientY - rect.top;
                e.preventDefault();
              });
              document.addEventListener('mousemove', function(e){
                if (!arrastrando) return;
                let x = e.clientX - offX;
                let y = e.clientY - offY;
                const maxX = window.innerWidth  - boxEl.offsetWidth  - 4;
                const maxY = window.innerHeight - boxEl.offsetHeight - 4;
                if (x < 4) x = 4; if (x > maxX) x = maxX;
                if (y < 4) y = 4; if (y > maxY) y = maxY;
                boxEl.style.left = x + 'px';
                boxEl.style.top  = y + 'px';
              });
              document.addEventListener('mouseup', function(){ arrastrando = false; });
            };
            // ptlCentrarVentana(boxEl): coloca top/left para centrar boxEl en el viewport.
            // Llamar DESPUÉS de mostrarla (necesita offsetWidth/Height reales).
            window.ptlCentrarVentana = window.ptlCentrarVentana || function(boxEl){
              if (!boxEl) return;
              const w = boxEl.offsetWidth || 680;
              const h = boxEl.offsetHeight || 500;
              const left = Math.max(0, Math.round((window.innerWidth - w) / 2));
              const top  = Math.max(0, Math.round((window.innerHeight - h) / 2));
              boxEl.style.left = left + 'px';
              boxEl.style.top  = top + 'px';
            };

            // Toggle desplegable
            document.querySelectorAll('.ptl-com-toggle').forEach(btn => {
              btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const det = document.querySelector('.ptl-com-detail[data-idx="' + idx + '"]');
                if (!det) return;
                const abierto = det.style.display !== 'none';
                // Acordeon: cerrar TODOS los detalles antes de abrir el clicado
                document.querySelectorAll('.ptl-com-detail').forEach(d => { d.style.display = 'none'; });
                // Si el clicado estaba cerrado, abrirlo; si estaba abierto, queda cerrado
                det.style.display = abierto ? 'none' : 'block';
              });
            });
            // Botón reloj: alterna presencia del mail en HOY
            document.querySelectorAll('.ptl-com-hoy').forEach(btn => {
              btn.addEventListener('click', async () => {
                const mid = btn.dataset.mid || '';
                if (!mid) return;
                btn.disabled = true;
                try {
                  const body = new URLSearchParams({ message_id: mid });
                  const res = await fetch('${urlT(token, "/presupuestos/mail-toggle-hoy")}', {
                    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { const t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  window.ptlRecargaLimpia(); // v18.36 — recarga limpia (NO reload)
                } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // Pie global para responder/reenviar (precargado desde el server).
            const PIE_GLOBAL = ${JSON.stringify(pieGlobal || "")};

            // Helper: decodifica base64 con soporte UTF-8.
            function _b64dec(s) {
              try { return decodeURIComponent(escape(atob(s || ''))); } catch (_) { return ''; }
            }
            // Helper: formato fecha "El 12 de mayo de 2026 a las 14:32"
            function _fmtFechaCita(fechaStr) {
              const t = Date.parse(fechaStr);
              if (isNaN(t)) return String(fechaStr || '');
              const d = new Date(t);
              const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
              const dia = d.getDate();
              const mes = meses[d.getMonth()];
              const anio = d.getFullYear();
              const hh = String(d.getHours()).padStart(2,'0');
              const mi = String(d.getMinutes()).padStart(2,'0');
              return 'El ' + dia + ' de ' + mes + ' de ' + anio + ' a las ' + hh + ':' + mi;
            }
            // Helper: añade "> " delante de cada línea del cuerpo (estilo Gmail).
            function _citar(texto) {
              return String(texto || '').split('\\n').map(l => '> ' + l).join('\\n');
            }
            // Helper: quita prefijos "Re:"/"Fwd:" repetidos y añade el nuevo.
            function _prefijar(prefix, asunto) {
              let s = String(asunto || '').trim();
              // Quitar prefijos previos (Re:, RE:, Fwd:, FW:, Rv:) varias veces.
              for (let i = 0; i < 5; i++) {
                const m = s.match(/^(re|fwd|fw|rv|aw)\\s*:\\s*/i);
                if (!m) break;
                s = s.slice(m[0].length);
              }
              return prefix + s;
            }

            // === Responder ===
            document.querySelectorAll('.ptl-com-responder').forEach(btn => {
              btn.addEventListener('click', () => {
                const fecha = btn.dataset.fecha || '';
                const dest = _b64dec(btn.dataset.dest || '');
                const asunto = _b64dec(btn.dataset.asunto || '');
                const cuerpo = _b64dec(btn.dataset.cuerpo || '');
                const entrante = btn.dataset.entrante === '1';
                // Destinatario: si era entrante, contestamos al remitente
                // (lo guardamos en col "destinatario" tras clasificar); si era
                // saliente, contestamos al destinatario original.
                sAbrir();
                sDest.value = dest;
                sAs.value = _prefijar('Re: ', asunto);
                const cita = _fmtFechaCita(fecha) + ', escribió:\\n' + _citar(cuerpo);
                sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL + '\\n\\n' : '') + cita;
                // Cursor al principio para que escriba arriba.
                setTimeout(() => { sCu.focus(); sCu.setSelectionRange(0, 0); }, 100);
              });
            });

            // === Reenviar ===
            document.querySelectorAll('.ptl-com-reenviar').forEach(btn => {
              btn.addEventListener('click', () => {
                const fecha = btn.dataset.fecha || '';
                const dest = _b64dec(btn.dataset.dest || '');
                const asunto = _b64dec(btn.dataset.asunto || '');
                const cuerpo = _b64dec(btn.dataset.cuerpo || '');
                const adjuntos = btn.dataset.adjuntos || '';
                sAbrir();
                sDest.value = '';   // destinatario vacío
                sAs.value = _prefijar('Fwd: ', asunto);
                const cabecera = '---------- Mensaje reenviado ----------\\n'
                  + 'De: ' + dest + '\\n'
                  + 'Fecha: ' + _fmtFechaCita(fecha) + '\\n'
                  + 'Asunto: ' + asunto + '\\n\\n';
                sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL + '\\n\\n' : '') + cabecera + cuerpo;
                // Rellenar adjuntos si vienen como "LABEL: url || LABEL: url".
                if (adjuntos) {
                  const partes = adjuntos.split('||').map(s => s.trim()).filter(Boolean);
                  partes.slice(0, 3).forEach((p, i) => {
                    const idx = i + 1;
                    const sep = p.indexOf(':');
                    if (sep < 0) return;
                    const lbl = p.slice(0, sep).trim();
                    const url = p.slice(sep + 1).trim();
                    const elLbl = document.getElementById('ptlComSadj' + idx + 'lbl');
                    const elUrl = document.getElementById('ptlComSadj' + idx + 'url');
                    if (elLbl) elLbl.value = lbl;
                    if (elUrl) elUrl.value = url;
                  });
                }
                setTimeout(() => sDest.focus(), 100);
              });
            });

            // Auto-disparo: si la URL trae ?accion_mail=responder|reenviar&mid=...
            // significa que llegamos desde HOY → buscar el botón con ese mid y
            // simular un clic, para abrir el modal precargado.
            // v17.66: tras disparar (o intentarlo), LIMPIAMOS accion_mail y mid
            // de la URL del navegador con history.replaceState. Antes esos
            // parámetros se quedaban pegados a la URL y cualquier recarga
            // (Ctrl+F5, reloj ⏰, location.reload de cualquier handler)
            // volvía a re-abrir el modal. Con replaceState no se recarga,
            // solo se sustituye la URL visible; el modal sigue abierto.
            (function(){
              try {
                var qp = new URLSearchParams(window.location.search);
                var accion = qp.get('accion_mail');
                var mid = qp.get('mid');
                if (!accion || !mid) return;
                var clase = accion === 'reenviar' ? '.ptl-com-reenviar' : '.ptl-com-responder';
                var sel = clase + '[data-mid="' + mid.replace(/"/g, '\\"') + '"]';
                var btn = document.querySelector(sel);
                if (btn) {
                  setTimeout(() => btn.click(), 200);
                } else {
                  console.warn('No se encontró botón para auto-disparar:', sel);
                }
                // v17.66 — limpiar URL para que próximos reloads no re-disparen.
                qp.delete('accion_mail');
                qp.delete('mid');
                var nuevaUrl = window.location.pathname + (qp.toString() ? '?' + qp.toString() : '') + window.location.hash;
                history.replaceState(null, '', nuevaUrl);
              } catch (e) { console.error('Auto-disparo accion_mail:', e); }
            })();
            // Borrar fila
            document.querySelectorAll('.ptl-com-delete').forEach(btn => {
              btn.addEventListener('click', async () => {
                if (!confirm('¿Borrar este registro de comunicaciones?\\n\\nEl mail enviado NO se desenvía — solo se borra el registro.')) return;
                btn.disabled = true;
                try {
                  const body = new URLSearchParams({
                    id: ${JSON.stringify(comu.ccpp_id)},
                    fecha: btn.dataset.fecha || '',
                    ccpp_id: btn.dataset.id || '',
                    direccion: btn.dataset.dir || '',
                    fase: btn.dataset.fase || '',
                    asunto: btn.dataset.asunto || '',
                    tipo: btn.dataset.tipo || ''
                  });
                  const res = await fetch('${urlT(token, "/presupuestos/expediente/mail-borrar")}', {
                    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) {
                    const t = await res.text();
                    alert('No se pudo borrar: ' + t);
                    btn.disabled = false;
                    return;
                  }
                  // v18.34/v18.36 — recarga limpia (NO reload): evita que la
                  // restauración de formulario del navegador descuadre los inputs
                  // (cambio fantasma / borrado de datos al salir). Unificado en
                  // window.ptlRecargaLimpia (location.replace + ptlReloading).
                  window.ptlRecargaLimpia();
                } catch(e) {
                  alert('Error: ' + e.message);
                  btn.disabled = false;
                }
              });
            });
            // ===== Botón Carpeta Drive (cabecera DATOS CCPP) =====
            const btnDrive = document.getElementById('ptlBtnCarpetaDrive');
            if (btnDrive) {
              btnDrive.addEventListener('click', async () => {
                const orig = btnDrive.textContent;
                btnDrive.disabled = true;
                btnDrive.textContent = '⏳ Abriendo...';
                try {
                  const url = '${urlT(token, "/presupuestos/expediente/carpeta-drive")}' + '&id=' + encodeURIComponent(${JSON.stringify(comu.ccpp_id)});
                  const r = await fetch(url);
                  const data = await r.json();
                  if (!r.ok || !data.url) {
                    alert('No se pudo abrir la carpeta: ' + (data.error || 'error desconocido'));
                    return;
                  }
                  window.open(data.url, '_blank', 'noopener');
                } catch (e) {
                  alert('Error: ' + e.message);
                } finally {
                  btnDrive.disabled = false;
                  btnDrive.textContent = orig;
                }
              });
            }

            // ===== Modal "Imprimir documentos" (Sprint A — Bloque 2) =====
            // Flujo: (paso 1) elegir documentos + piso (si hay particulares) ->
            // (paso 2) formulario de huecos precargados/editables -> generar PDF.
            (function(){
              const CCPP_ID = ${JSON.stringify(comu.ccpp_id)};
              const TOKEN_GEN = '${urlT(token, "/presupuestos/docs/generar")}';
              const URL_MENU = '${urlT(token, "/presupuestos/docs/menu")}';
              const URL_HUECOS = '${urlT(token, "/presupuestos/docs/huecos")}';

              let estado = { menu: null, seleccion: [], vivienda: '', campos: [] };

              function cerrar(){ const m = document.getElementById('ptlDocModal'); if (m) m.remove(); }

              function escH(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

              function crearVentana(titulo, contenidoHtml){
                cerrar();
                const wrap = document.createElement('div');
                wrap.id = 'ptlDocModal';
                wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:block';
                wrap.innerHTML =
                  '<div id="ptlDocBox" style="position:fixed;top:8%;left:50%;transform:translateX(-50%);width:560px;max-width:94vw;max-height:86vh;background:var(--ptl-general-flotante);border:1px solid var(--ptl-gray-300);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden">'
                  + '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--ptl-warning-light);padding:10px 14px;border-bottom:1px solid var(--ptl-warning-light)">'
                  + '<strong style="color:var(--ptl-warning-dark)">📄 ' + escH(titulo) + '</strong>'
                  + '<button type="button" id="ptlDocClose" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--ptl-warning-dark);line-height:1">✕</button>'
                  + '</div>'
                  + '<div id="ptlDocBody" style="padding:14px;overflow-y:auto">' + contenidoHtml + '</div>'
                  + '</div>';
                document.body.appendChild(wrap);
                document.getElementById('ptlDocClose').addEventListener('click', cerrar);
              }

              // ---- PASO 1: menú de documentos + piso ----
              async function abrirMenu(){
                crearVentana('Imprimir documentos', '<div style="text-align:center;color:var(--ptl-gray-500);padding:20px">Cargando…</div>');
                let data;
                try {
                  const r = await fetch(URL_MENU + '&id=' + encodeURIComponent(CCPP_ID));
                  data = await r.json();
                  if (!r.ok) throw new Error(data.error || 'Error');
                } catch(e){
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:var(--ptl-danger)">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.menu = data;
                pintarMenu();
              }

              function pintarMenu(){
                const data = estado.menu;
                let html = '<div style="font-size:13px;color:var(--ptl-gray-700);margin-bottom:10px">Expediente: <strong>' + escH(data.comunidad) + '</strong></div>';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:6px">Marca los documentos a imprimir:</div>';
                html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
                data.documentos.forEach(d => {
                  const et = d.tipo === 'particular' ? ' <span style="font-size:11px;color:var(--ptl-warning-dark)">(de un piso)</span>' : ' <span style="font-size:11px;color:var(--ptl-gray-500)">(general)</span>';
                  html += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">'
                       + '<input type="checkbox" class="ptlDocChk" value="' + escH(d.clave) + '" data-tipo="' + escH(d.tipo) + '"/>'
                       + '<span>' + escH(d.titulo) + et + '</span></label>';
                });
                html += '</div>';
                // Selector de piso (solo si hay pisos). Se mostrará/ocultará según haga falta.
                html += '<div id="ptlDocPisoWrap" style="display:none;margin-bottom:12px">';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:4px">Piso (para los documentos de un piso):</div>';
                if (data.pisos && data.pisos.length){
                  html += '<select id="ptlDocPiso" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:13px">';
                  html += '<option value="">— Elige un piso —</option>';
                  data.pisos.forEach(p => {
                    const etq = p.vivienda + (p.propietario ? ' · ' + p.propietario : '');
                    html += '<option value="' + escH(p.vivienda) + '">' + escH(etq) + '</option>';
                  });
                  html += '</select>';
                } else {
                  html += '<div style="font-size:12px;color:var(--ptl-danger)">Este expediente no tiene pisos cargados. Los documentos de un piso saldrán con los datos en blanco.</div>';
                }
                html += '</div>';
                html += '<div style="text-align:right"><button type="button" id="ptlDocSiguiente" class="ptl-btn ptl-btn-primary" style="padding:6px 14px">Siguiente →</button></div>';
                document.getElementById('ptlDocBody').innerHTML = html;

                const chks = Array.from(document.querySelectorAll('.ptlDocChk'));
                const pisoWrap = document.getElementById('ptlDocPisoWrap');
                function refrescarPiso(){
                  const hayParticular = chks.some(c => c.checked && c.dataset.tipo === 'particular');
                  pisoWrap.style.display = hayParticular ? 'block' : 'none';
                }
                chks.forEach(c => c.addEventListener('change', refrescarPiso));
                document.getElementById('ptlDocSiguiente').addEventListener('click', () => {
                  const sel = chks.filter(c => c.checked).map(c => c.value);
                  if (sel.length === 0){ alert('Marca al menos un documento.'); return; }
                  const hayParticular = chks.some(c => c.checked && c.dataset.tipo === 'particular');
                  const pisoSel = document.getElementById('ptlDocPiso');
                  const viv = pisoSel ? pisoSel.value : '';
                  if (hayParticular && !viv){ alert('Elige el piso para los documentos de un piso.'); return; }
                  estado.seleccion = sel;
                  estado.vivienda = viv;
                  abrirFormulario();
                });
              }

              // ---- PASO 2: formulario de huecos ----
              async function abrirFormulario(){
                document.getElementById('ptlDocBody').innerHTML = '<div style="text-align:center;color:var(--ptl-gray-500);padding:20px">Cargando datos…</div>';
                let data;
                try {
                  const body = new URLSearchParams({
                    id: CCPP_ID,
                    claves: JSON.stringify(estado.seleccion),
                    vivienda: estado.vivienda
                  });
                  const r = await fetch(URL_HUECOS, {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  data = await r.json();
                  if (!r.ok) throw new Error(data.error || 'Error');
                } catch(e){
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:var(--ptl-danger)">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.campos = data.campos || [];
                let html = '<div style="font-size:13px;color:var(--ptl-gray-700);margin-bottom:10px">Revisa los datos. Los precargados puedes corregirlos; los vacíos puedes rellenarlos o dejarlos en blanco para rellenar a mano.</div>';
                if (estado.campos.length === 0){
                  html += '<div style="font-size:12px;color:var(--ptl-gray-500);margin-bottom:10px">Estos documentos no tienen datos que rellenar.</div>';
                }
                html += '<div style="border:1px solid var(--ptl-gray-200);border-radius:8px;padding:10px;margin-bottom:10px">';
                estado.campos.forEach(c => {
                  html += '<label style="display:block;font-size:12px;margin-bottom:8px">'
                       + '<span style="display:block;color:var(--ptl-gray-700);margin-bottom:2px">' + escH(c.label) + (c.manual ? ' <span style="color:var(--ptl-gray-400)">(a mano)</span>' : '') + '</span>'
                       + '<input type="text" data-hueco="' + escH(c.clave) + '" value="' + escH(c.valor) + '" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:13px"/>'
                       + '</label>';
                });
                html += '</div>';
                html += '<div style="display:flex;justify-content:space-between;gap:8px">'
                     + '<button type="button" id="ptlDocAtras" class="ptl-btn" style="padding:6px 14px;background:var(--ptl-gray-100);border:1px solid var(--ptl-gray-300)">← Atrás</button>'
                     + '<button type="button" id="ptlDocGenerar" class="ptl-btn ptl-btn-primary" style="padding:6px 14px">📄 Generar PDF</button>'
                     + '</div>';
                document.getElementById('ptlDocBody').innerHTML = html;
                document.getElementById('ptlDocAtras').addEventListener('click', pintarMenu);
                document.getElementById('ptlDocGenerar').addEventListener('click', generar);
              }

              // ---- PASO 3: generar y descargar ----
              async function generar(){
                const btnG = document.getElementById('ptlDocGenerar');
                btnG.disabled = true; btnG.textContent = '⏳ Generando…';
                // Recoger los valores de la lista única
                const valores = {};
                document.querySelectorAll('#ptlDocBody input[data-hueco]').forEach(inp => {
                  valores[inp.dataset.hueco] = inp.value;
                });
                try {
                  const body = new URLSearchParams({
                    id: CCPP_ID,
                    claves: JSON.stringify(estado.seleccion),
                    vivienda: estado.vivienda,
                    valores: JSON.stringify(valores)
                  });
                  const r = await fetch(TOKEN_GEN, {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!r.ok){ const t = await r.json().catch(()=>({error:'Error'})); throw new Error(t.error || 'Error'); }
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'documentos.pdf';
                  document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(()=>URL.revokeObjectURL(url), 4000);
                  cerrar();
                } catch(e){
                  alert('Error generando el PDF: ' + e.message);
                  btnG.disabled = false; btnG.textContent = '📄 Generar PDF';
                }
              }

              window.ptlAbrirDocsModal = abrirMenu;
            })();

            // ===== Modal "Enviar mail manual" (compositor tipo Gmail) =====
            // v17.70: ventana flotante arrastrable estilo Windows. Sin overlay
            // translúcido; la pantalla de detrás queda totalmente interactiva
            // (puedes seleccionar, copiar, scrollear). Se mueve por la cabecera.
            const sModal = document.getElementById('ptlComSendModal');
            const sBox   = document.getElementById('ptlComSendBox');
            const sTitle = document.getElementById('ptlComSendTitle');
            const sBtn = document.getElementById('ptlComSendBtn');
            const sCancel = document.getElementById('ptlComScancel');
            const sXclose = document.getElementById('ptlComSxclose');
            const sSend = document.getElementById('ptlComSsend');
            const sDest = document.getElementById('ptlComSdest');
            const sCc = document.getElementById('ptlComScc');
            const sCco = document.getElementById('ptlComScco');
            const sAs = document.getElementById('ptlComSasunto');
            const sCu = document.getElementById('ptlComScuerpo');
            function sLimpiar() {
              sDest.value = ''; sCc.value = ''; sCco.value = '';
              sAs.value = ''; sCu.value = '';
              ['ptlComSadj1lbl','ptlComSadj1url','ptlComSadj2lbl','ptlComSadj2url','ptlComSadj3lbl','ptlComSadj3url']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            }
            function sAbrir() {
              sLimpiar();
              sModal.style.display = 'block';
              // v17.71: usa helper global window.ptlCentrarVentana.
              window.ptlCentrarVentana(sBox);
              setTimeout(() => sDest.focus(), 50);
            }
            function sCerrar() { sModal.style.display = 'none'; }
            // v17.95: al abrir el compositor EN BLANCO desde el botón "Enviar mail
            // manual", precargamos el pie/firma global (igual que ya hacían Responder
            // y Reenviar). Escribes arriba y el pie queda debajo; el cursor se coloca
            // arriba del todo. No se toca sAbrir() (compartido) para no duplicar el pie
            // en responder/reenviar, que ya lo ponen ellos al sobrescribir el cuerpo.
            function sAbrirNuevo() {
              sAbrir();
              sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL : '');
              setTimeout(() => { sCu.focus(); sCu.setSelectionRange(0, 0); }, 100);
            }
            if (sBtn) sBtn.addEventListener('click', sAbrirNuevo);
            if (sCancel) sCancel.addEventListener('click', sCerrar);
            if (sXclose) sXclose.addEventListener('click', sCerrar);
            // v17.71: drag&drop unificado via window.ptlMakeDraggable (helper
            // global definido más arriba, también lo usa ptl-modal-mail).
            window.ptlMakeDraggable(sBox, sTitle, sXclose);
            if (sSend) sSend.addEventListener('click', async () => {
              const dest = (sDest.value || '').trim();
              const cc = (sCc.value || '').trim();
              const cco = (sCco.value || '').trim();
              const asun = (sAs.value || '').trim();
              const cuer = sCu.value || '';
              if (!dest) { alert('Falta el destinatario'); return; }
              if (!asun) { alert('Falta el asunto'); return; }
              const adjs = [];
              for (let i = 1; i <= 3; i++) {
                const lbl = (document.getElementById('ptlComSadj' + i + 'lbl').value || '').trim();
                const url = (document.getElementById('ptlComSadj' + i + 'url').value || '').trim();
                if (url) adjs.push((lbl || 'ADJUNTO_' + i) + ': ' + url);
              }
              const adjuntos = adjs.join(' || ');
              sSend.disabled = true;
              sSend.textContent = '⏳ Enviando...';
              const envioId = 'e' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
              try {
                const body = new URLSearchParams({
                  envioId: envioId,
                  id: ${JSON.stringify(comu.ccpp_id)},
                  destinatario: dest,
                  cc, cco,
                  asunto: asun,
                  mensaje: cuer,
                  adjuntos: adjuntos
                });
                const res = await fetch('${urlT(token, "/presupuestos/expediente/mail-enviar-manual")}', {
                  method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                  body: body.toString()
                });
                const d0 = await res.json().catch(() => null);
                if (d0 && d0.encolado) {
                  const r = await window.ptlSondearEnvio(envioId);
                  if (!r.ok) {
                    const t = (typeof r.payload === 'string') ? r.payload
                            : ((r.payload && r.payload.error) || ('HTTP ' + (r.status || '?')));
                    alert('No se pudo enviar:\\n\\n' + t);
                    sSend.disabled = false;
                    sSend.textContent = '📧 Enviar';
                    return;
                  }
                  // v18.36 — recarga limpia (NO reload).
                  window.ptlRecargaLimpia();
                  return;
                }
                // Compat síncrono (sin encolar).
                if (!res.ok) {
                  const t = (d0 && typeof d0 === 'object') ? JSON.stringify(d0) : await res.text();
                  alert('No se pudo enviar:\\n\\n' + t);
                  sSend.disabled = false;
                  sSend.textContent = '📧 Enviar';
                  return;
                }
                window.ptlRecargaLimpia();
              } catch(e) {
                if (e.message === 'TIMEOUT') {
                  alert('El envío está tardando más de lo normal. Puede que ya se haya enviado.\\n\\nCierra, refresca y comprueba en COMUNICACIONES antes de volver a enviar (para no duplicar).');
                  window.location.reload();
                  return;
                }
                alert('Error: ' + e.message);
                sSend.disabled = false;
                sSend.textContent = '📧 Enviar';
              }
            });
          })();
        </script>

        ${!["01_CONTACTO","02_VISITA"].includes(fase) ? `<div class="ptl-card ptl-card-compact">
          <div class="ptl-card-title">Datos económicos</div>
          <div class="ptl-form-grid">
            ${ enTramitada ? `
            ${inp("pto_total", comu.pto_total, { type: "number", formato: "euros", col: 4, label: "PTO total (€)", readonly: roPrevisto })}
            <div class="col-8"></div>
            ${inp("tiempo_previsto", comu.tiempo_previsto, { type: "number", formato: "dias", col: 4, label: "Tiempo previsto (días/cuadrilla × 2)", readonly: roPrevisto })}
            ${inp("tiempo_real",     comu.tiempo_real,     { type: "number", formato: "dias", col: 4, label: "Tiempo real (días/cuadrilla × 2)", readonly: roReal })}
            <div class="col-4">
              <label class="ptl-form-label">Desvío tiempo</label>
              <input type="text" name="tiempo_desvio" id="f_tiempo_desvio" readonly class="calc-field campo-pct" value="${esc(comu.tiempo_desvio || '')}"/>
            </div>
            ${inp("mano_obra_previsto", comu.mano_obra_previsto, { type: "number", formato: "euros", col: 4, label: "Mano de obra previsto", readonly: roPrevisto })}
            ${inp("mano_obra_real",     comu.mano_obra_real,     { type: "number", formato: "euros", col: 8, label: "Mano de obra real", readonly: roReal })}
            ${inp("material_previsto",  comu.material_previsto,  { type: "number", formato: "euros", col: 4, label: "Material previsto", readonly: roPrevisto })}
            ${inp("material_real",      comu.material_real,      { type: "number", formato: "euros", col: 8, label: "Material real", readonly: roReal })}
            <div class="col-4">
              <label class="ptl-form-label">Beneficio previsto</label>
              <input type="text" name="beneficio_previsto" id="f_ben_prev" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_previsto || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Beneficio real</label>
              <input type="text" name="beneficio_real" id="f_ben_real" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_real || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Desvío beneficio</label>
              <input type="text" name="beneficio_desvio" id="f_ben_desv" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_desvio || '')}"/>
            </div>
            ` : `
            ${inp("pto_total", comu.pto_total, { type: "number", formato: "euros", col: 4, label: "PTO total (€)", readonly: roPrevisto })}
            <div class="col-8"></div>
            ${inp("tiempo_previsto", comu.tiempo_previsto, { type: "number", formato: "dias", col: 4, label: "Tiempo previsto (días/cuadrilla × 2)", readonly: roPrevisto })}
            <div class="col-8"></div>
            ${inp("mano_obra_previsto", comu.mano_obra_previsto, { type: "number", formato: "euros", col: 4, label: "Mano de obra previsto", readonly: roPrevisto })}
            <div class="col-8"></div>
            ${inp("material_previsto",  comu.material_previsto,  { type: "number", formato: "euros", col: 4, label: "Material previsto", readonly: roPrevisto })}
            <div class="col-8"></div>
            <div class="col-4">
              <label class="ptl-form-label">Beneficio previsto</label>
              <input type="text" name="beneficio_previsto" id="f_ben_prev" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_previsto || '')}"/>
            </div>
            <div class="col-8"></div>
            ` }
          </div>
        </div>` : ''}
      </form>

      ${extraHtmlFinal}

      <script>
        // Saneamiento global: elimina acentos y caracteres no ASCII en cualquier input[type=email].
        // Mantiene el cursor lo más cerca posible de su posición original.
        document.querySelectorAll('input[type="email"]').forEach(el => {
          el.addEventListener('input', () => {
            const before = el.value;
            const sanitized = before
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
              .replace(/[^A-Za-z0-9._%+\-@]/g, ''); // quita cualquier carácter raro
            if (sanitized !== before) {
              const pos = el.selectionStart - (before.length - sanitized.length);
              el.value = sanitized;
              try { el.setSelectionRange(pos, pos); } catch(e) {}
            }
          });
        });
        const ptlForm = document.getElementById('ptl-ficha-form');
        const ptlId = ptlForm.dataset.id;
        const ptlPill = document.getElementById('ptl-save-pill');
        const ptlOrig = ${expDataJson};
        var ptlUH = [], ptlUP = -1, ptlUndoing = false;
        function ptlUhEditable(el){ return el && el.matches && el.matches('input,textarea,select') && !el.readOnly && !el.disabled && el.type!=='hidden' && el.type!=='button' && el.type!=='submit' && el.type!=='checkbox' && el.type!=='radio'; }
        document.addEventListener('focusin', function(e){ var el=e.target; if(ptlUhEditable(el) && el.dataset.uhorig===undefined) el.dataset.uhorig=el.value; }, true);
        function ptlUhRecord(el){ if(ptlUndoing || !ptlUhEditable(el)) return; var old=(el.dataset.uhorig===undefined?'':el.dataset.uhorig); if(el.value===old) return; ptlUH=ptlUH.slice(0,ptlUP+1); ptlUH.push({el:el, prev:old, next:el.value}); ptlUP=ptlUH.length-1; el.dataset.uhorig=el.value; ptlActUndo(); }
        document.addEventListener('change', function(e){ ptlUhRecord(e.target); }, true);
        document.addEventListener('focusout', function(e){ ptlUhRecord(e.target); }, true);
        function ptlUhApply(el, val){ ptlUndoing=true; try{ el.value=val; el.dataset.uhorig=val; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }finally{ ptlUndoing=false; } }
        let ptlIntercept = true;

        // v18.56 — Auto-grow de la caja Notas (textarea .ptl-textarea-grow): la
        // altura se ajusta al contenido al cargar y al escribir, como las notas
        // de HOY (es la misma nota notas_pto). El guardado lo sigue gestionando el
        // formulario (ptlDiff por name/data-orig), aquí solo la altura visual.
        (function ptlTextareaGrow(){
          const _grow = (ta) => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight) + 'px'; };
          ptlForm.querySelectorAll('.ptl-textarea-grow').forEach(function(ta){
            _grow(ta);
            ta.addEventListener('input', function(){ _grow(ta); });
          });
        })();

        // ============================================================
        // AUTOCOMPLETE CUSTOM (sustituye al <datalist> nativo)
        // Filtra por SUBSTRING (no solo prefijo), insensible a tildes/mayúsc.
        // ============================================================
        const ptlAcData = ${acDataJson};
        function ptlNormStr(s) {
          return String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
        }
        function ptlAcInit(input) {
          if (!input || input.dataset.acReady) return;
          input.dataset.acReady = "1";
          const wrap = input.closest('.ptl-ac-wrap');
          if (!wrap) return;
          const opciones = ptlAcData[input.dataset.ac] || [];
          // Crear lista
          const lista = document.createElement('div');
          lista.className = 'ptl-ac-list';
          wrap.appendChild(lista);
          let activeIdx = -1;
          function render(filtro) {
            const f = ptlNormStr(filtro);
            const matches = !f
              ? opciones.slice(0, 20)
              : opciones.filter(o => ptlNormStr(o).includes(f)).slice(0, 30);
            if (matches.length === 0) {
              lista.innerHTML = '<div class="ptl-ac-empty">Sin coincidencias (puedes escribir un valor nuevo)</div>';
              lista.classList.add('show');
              activeIdx = -1;
              return;
            }
            lista.innerHTML = matches.map((o, i) => {
              // Resaltar el match
              let html = ptlEscHtml(o);
              if (f) {
                const idx = ptlNormStr(o).indexOf(f);
                if (idx !== -1) {
                  const before = ptlEscHtml(o.substring(0, idx));
                  const match  = ptlEscHtml(o.substring(idx, idx + filtro.length));
                  const after  = ptlEscHtml(o.substring(idx + filtro.length));
                  html = before + '<mark>' + match + '</mark>' + after;
                }
              }
              return '<div class="ptl-ac-item" data-idx="'+i+'" data-val="'+ptlEscHtml(o)+'">'+html+'</div>';
            }).join('');
            lista.classList.add('show');
            activeIdx = -1;
          }
          function ocultar() { lista.classList.remove('show'); activeIdx = -1; }
          function elegir(val) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            ocultar();
            // Disparar blur lógico (autocomplete admin → rellenar tel/email)
            input.dispatchEvent(new Event('blur', { bubbles: true }));
          }

          input.addEventListener('focus', () => render(input.value));
          input.addEventListener('input', () => render(input.value));
          input.addEventListener('keydown', (ev) => {
            const items = lista.querySelectorAll('.ptl-ac-item');
            if (ev.key === 'ArrowDown') {
              ev.preventDefault();
              activeIdx = Math.min(activeIdx + 1, items.length - 1);
              items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
              if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (ev.key === 'ArrowUp') {
              ev.preventDefault();
              activeIdx = Math.max(activeIdx - 1, 0);
              items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
              if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (ev.key === 'Enter' || ev.key === 'Tab') {
              if (activeIdx >= 0 && items[activeIdx]) {
                ev.preventDefault();
                elegir(items[activeIdx].dataset.val);
              } else if (items.length === 1) {
                // Si solo hay 1 sugerencia, Tab/Enter la elige
                ev.preventDefault();
                elegir(items[0].dataset.val);
              } else {
                ocultar();
              }
            } else if (ev.key === 'Escape') {
              ocultar();
            }
          });
          lista.addEventListener('mousedown', (ev) => {
            const item = ev.target.closest('.ptl-ac-item');
            if (item) { ev.preventDefault(); elegir(item.dataset.val); }
          });
          // Cerrar al hacer click fuera
          document.addEventListener('click', (ev) => {
            if (!wrap.contains(ev.target)) ocultar();
          });
        }
        function ptlEscHtml(s) {
          return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
        }
        // Inicializar todos los inputs con data-ac
        ptlForm.querySelectorAll('input[data-ac]').forEach(ptlAcInit);

        // Helpers de formato numérico (definidos arriba para usarlos en ptlValor)
        function ptlNum(s) {
          if (s == null) return null;
          let txt = String(s).trim();
          if (!txt) return null;
          txt = txt.replace(/€|\\s/g, '');
          if (txt.indexOf('.') !== -1 && txt.indexOf(',') !== -1) {
            txt = txt.replace(/\\./g, '').replace(',', '.');
          } else {
            txt = txt.replace(',', '.');
          }
          const v = parseFloat(txt);
          return isNaN(v) ? null : v;
        }
        function ptlFmtEuros(s) {
          const v = ptlNum(s);
          if (v == null) return '';
          return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) + ' €';
        }
        function ptlFmtDias(s) {
          const v = ptlNum(s);
          if (v == null) return '';
          return v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true });
        }
        function ptlValorPlano(s) {
          const v = ptlNum(s);
          return v == null ? '' : String(v);
        }

        function ptlSetPill(estado, txt) { if (!ptlPill) return; ptlPill.className = 'ptl-save-pill ' + estado; ptlPill.textContent = txt; }
        function ptlValor(name) {
          const el = ptlForm.querySelector('[name="'+name+'"]');
          if (!el) return '';
          // Si es euros, días o teléfono → guardamos valor plano (sin formato)
          if (el.classList.contains('campo-euros') || el.classList.contains('campo-dias')) {
            return ptlValorPlano(el.value);
          }
          if (el.classList.contains('campo-tlf')) {
            // Devolver en el MISMO formato que fmtTlf usa para ptlOrig:
            // 9 dígitos formateados como "XXX-XXX-XXX". Si no hay 9 dígitos
            // limpios, devolvemos el valor tal cual (no podemos formatear).
            // Esto evita falsos diffs entre lo mostrado y lo guardado.
            let d = String(el.value).replace(/\\D/g, '');
            if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
            return el.value;
          }
          return el.value;
        }
        function ptlDiff() {
          const d = {};
          for (const k of Object.keys(ptlOrig)) {
            // v18.02 — earth (coordenadas del mapa) NUNCA se edita desde la ficha:
            // se gestiona arrastrando en el mapa. No tiene input en la ficha, así
            // que el detector lo veía como "cambio fantasma" (leía '' vs la coord
            // real) y al "Guardar y salir" BORRABA las coordenadas. Lo ignoramos
            // siempre aquí.
            if (k === 'earth') continue;
            const el = ptlForm.querySelector('[name="'+k+'"]');
            // v17.80 — FIX falso positivo + borrado de datos. Si el campo de la
            // foto (ptlOrig) NO tiene input en el formulario en esta fase, el
            // usuario NO ha podido tocarlo -> NO es un cambio. Hay que saltarlo.
            // Sin esta guarda, ptlValor(k) devolvía '' (input inexistente) y se
            // comparaba contra el valor real de la foto, marcando un cambio
            // fantasma; al "Guardar y salir" se escribía '' y se BORRABA el dato
            // (que pudo haberse puesto desde otra pantalla). Casos afectados:
            // notas_pto en fases 05-09/ZZ (sin caja Notas) y los económicos
            // pto_total/mano_obra/material/tiempo en fases 01-02 (sin caja Datos
            // económicos).
            if (!el) continue;
            const v = String(ptlValor(k) ?? '');
            const orig = String(ptlOrig[k] ?? '');
            // Comparación numérica SOLO para campos numéricos (euros, días).
            // No usar parseFloat en cualquier campo: una nota como "-09/04/26..."
            // parsea a -9 igual que "-09/04/26 + nuevo texto", y se perdería el cambio.
            const esNumerico = el && (el.classList.contains('campo-euros') || el.classList.contains('campo-dias'));
            if (esNumerico) {
              // v18.47 — normalizar el ORIGINAL por el MISMO formateador del campo
              // (dias=1 decimal, euros=2), igual que ptlValor normaliza el valor
              // actual. Asi un dato del Sheet con mas decimales (p.ej. tiempo_real
              // 28.25, que el campo muestra 28,3) NO se ve como cambio fantasma:
              // ambos lados pasan por ptlFmt*->ptlValorPlano y quedan a la misma
              // precision antes de comparar.
              const fmtNum = el.classList.contains('campo-dias') ? ptlFmtDias : ptlFmtEuros;
              const origNorm = ptlValorPlano(fmtNum(orig));
              if (v !== origNorm) d[k] = v;
            } else if (v !== orig) {
              d[k] = v;
            }
          }
          return d;
        }
        function ptlActPill() {
          const n = Object.keys(ptlDiff()).length;
          if (n === 0) ptlSetPill('', 'Sin cambios');
          else ptlSetPill('saving', n + (n === 1 ? ' cambio sin guardar' : ' cambios sin guardar'));
        }
        function ptlActUndo() {
          var bu = document.getElementById('ptlBtnUndo');
          var br = document.getElementById('ptlBtnRedo');
          if (bu) bu.disabled = (ptlUP < 0);
          if (br) br.disabled = (ptlUP >= ptlUH.length - 1);
        }
        async function ptlGuardar() {
          const d = ptlDiff();
          if (Object.keys(d).length === 0) return true;
          const errores = [];
          for (const [campo, valor] of Object.entries(d)) {
            try {
              const fd = new URLSearchParams();
              fd.append('id', ptlId); fd.append('campo', campo); fd.append('valor', valor);
              // keepalive: la petición sobrevive aunque el navegador cambie de página inmediatamente.
              const r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd, keepalive: true });
              if (!r.ok) {
                let msg = 'HTTP '+r.status;
                try {
                  const j = await r.json();
                  if (j && j.error) msg = j.error;
                } catch (_) {
                  try { msg = await r.text(); } catch (__) {}
                }
                console.error('[ptlGuardar] '+campo+' →', r.status, msg);
                errores.push(campo+': '+msg);
              } else {
                ptlOrig[campo] = valor;
              }
            } catch (e) {
              console.error('[ptlGuardar] '+campo+' excepción:', e);
              errores.push(campo+': '+e.message);
            }
          }
          if (errores.length > 0) {
            ptlSetPill('error', '✕ Error');
            alert('NO se guardaron los siguientes cambios:\\n\\n• '+errores.join('\\n• ')+'\\n\\nRevise la consola (F12) para más detalle.');
            return false;
          }
          ptlSetPill('saved', '✓ Guardado');
          return true;
        }
        // v17.74 — Feedback de guardado por campo (recuadro verde 5s al OK /
        // rojo permanente al fallo hasta el siguiente OK del mismo campo).
        // Usa las clases compartidas .ptl-guardado-ok / .ptl-guardado-error de
        // estilo-visual.cjs v1.15. Localiza el input por su name. Reemplaza a la
        // píldora global como feedback visible principal (la píldora sigue por
        // dentro para el flujo "salir con cambios sin guardar").
        function ptlFlashGuardado(name, ok) {
          const el = ptlForm.querySelector('[name="'+name+'"]');
          if (!el) return;
          if (el._ptlFlashTimer) { clearTimeout(el._ptlFlashTimer); el._ptlFlashTimer = null; }
          el.classList.remove('ptl-guardado-ok', 'ptl-guardado-error');
          if (ok) {
            el.classList.add('ptl-guardado-ok');
            el._ptlFlashTimer = setTimeout(function(){
              el.classList.remove('ptl-guardado-ok');
              el._ptlFlashTimer = null;
            }, 5000);
          } else {
            el.classList.add('ptl-guardado-error');
            // Sin timer: rojo permanente hasta el siguiente guardado OK del campo.
          }
        }
        // Guardar UN solo campo. Se llama desde ptlOnCambio (blur).
        // Devuelve true si OK, false si falló. Actualiza ptlOrig[name] si OK.
        async function ptlGuardarCampo(name, valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId); fd.append('campo', name); fd.append('valor', valor);
            const r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!r.ok) {
              let msg = 'HTTP '+r.status;
              try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) {
                try { msg = await r.text(); } catch (__) {}
              }
              console.error('[ptlGuardarCampo] '+name+' →', r.status, msg);
              ptlSetPill('error', '✕ Error guardando '+name);
              ptlFlashGuardado(name, false);
              return false;
            }
            ptlOrig[name] = valor;
            ptlSetPill('saved', '✓ Guardado');
            ptlFlashGuardado(name, true);
            return true;
          } catch (e) {
            console.error('[ptlGuardarCampo] '+name+' excepción:', e);
            ptlSetPill('error', '✕ Error de red');
            ptlFlashGuardado(name, false);
            return false;
          }
        }
        function ptlOnCambio(ev) {
          const el = ev.target; const name = el.name;
          if (!name) return;
          const newV = el.value, oldV = el.dataset.orig || '';
          if (newV === oldV) return;
          el.dataset.orig = newV;
          ptlActUndo(); ptlActPill();
          // Guardar inmediatamente este campo (sin esperar a salir de la ficha).
          // El valor que mandamos es el VALOR CRUDO del campo, no ptlValor (que reformatea).
          // Para campos numéricos (euros, días) y teléfonos, reusamos ptlValor para enviar
          // el formato canónico que espera el servidor.
          let valorEnvio = newV;
          if (el.classList.contains('campo-euros') || el.classList.contains('campo-dias') || el.classList.contains('campo-tlf')) {
            valorEnvio = ptlValor(name);
          }
          ptlGuardarCampo(name, valorEnvio);
        }
        function ptlUndo() {
          if (ptlUP < 0) return;
          var e = ptlUH[ptlUP]; ptlUP--; ptlActUndo();
          if (e.el) { try { e.el.focus(); } catch(_){} ptlUhApply(e.el, e.prev); }
        }
        function ptlRedo() {
          if (ptlUP >= ptlUH.length - 1) return;
          ptlUP++; var e = ptlUH[ptlUP]; ptlActUndo();
          if (e.el) { try { e.el.focus(); } catch(_){} ptlUhApply(e.el, e.next); }
        }
        ptlForm.querySelectorAll('input, textarea').forEach(el => {
          el.addEventListener('blur', ptlOnCambio);
          el.addEventListener('input', () => ptlActPill());
        });
        ptlForm.querySelectorAll('select').forEach(el => el.addEventListener('change', ptlOnCambio));

        document.addEventListener('click', async (ev) => {
          const a = ev.target.closest('a');
          if (!a || !ptlIntercept) return;
          if (Object.keys(ptlDiff()).length === 0) return;
          ev.preventDefault();
          const href = a.getAttribute('href');
          const r = confirm('Hay cambios sin guardar.\\n\\n  Aceptar = Guardar y salir\\n  Cancelar = Descartar y salir');
          if (r) {
            const ok = await ptlGuardar();
            if (!ok) {
              if (!confirm('No se pudo guardar todos los cambios. ¿Salir igualmente?')) return;
            }
          }
          ptlIntercept = false;
          window.location = href;
        }, true);
        // v18.38 — FIX form-restoration por VUELTA ATRÁS / bfcache.
        // El navegador puede restaurar la página entera desde su back-forward cache
        // (bfcache) cuando el usuario pulsa "atrás" (p.ej. tras ir al mapa y volver).
        // Esa restauración trae los inputs con sus valores cacheados, NO con los
        // value="" frescos del servidor; en algunos campos esto APLANA los saltos
        // de línea (notas_pto pierde sus saltos) o descoloca valores económicos. Al
        // salir, ptlDiff lo ve como cambio y ptlGuardar lo escribe -> DAÑO.
        // event.persisted=true indica que la página viene de bfcache; en ese caso
        // forzamos una recarga limpia (location.replace) para traer el HTML fresco.
        // Casos cubiertos: vuelta atrás desde mapa, desde otra pantalla, swipe back
        // en móvil, etc. (El fix v18.36 solo cubría reloads disparados por JS.)
        window.addEventListener('pageshow', (ev) => {
          if (ev.persisted) {
            window.ptlReloading = true;
            location.replace(location.href);
          }
        });
        window.addEventListener('beforeunload', (ev) => {
          if (window.ptlEliminando) return;
          if (window.ptlReloading) return;
          if (Object.keys(ptlDiff()).length > 0) { ev.preventDefault(); ev.returnValue = ''; }
        });
        document.querySelectorAll('form[action^="/presupuestos/expediente/"]').forEach(f => {
          // El form de descartar elimina el expediente — no tiene sentido avisar de cambios sin guardar
          if (f.getAttribute('action').includes('/descartar')) return;
          f.addEventListener('submit', async (ev) => {
            if (Object.keys(ptlDiff()).length > 0) {
              ev.preventDefault();
              const r = confirm('Hay cambios sin guardar.\\n\\n  Aceptar = Guardar y continuar\\n  Cancelar = Descartar y continuar');
              if (r) await ptlGuardar();
              ptlIntercept = false; f.submit();
            }
          });
        });

        // Formato teléfono (XXX-XXX-XXX, sin código de país)
        function ptlFmtTlf(s) {
          if (!s) return '';
          let d = String(s).replace(/\\D/g, '');
          if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
          if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
          if (d.length === 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
          return s;
        }
        ptlForm.querySelectorAll('.campo-tlf').forEach(el => {
          el.addEventListener('blur', () => { const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; } });
          el.addEventListener('focus', () => { el.value = String(el.value).replace(/\\D/g, ''); });
          const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; }
        });

        // Aplicar formato a campos de euros (editables y readonly)
        ptlForm.querySelectorAll('.campo-euros').forEach(el => {
          if (el.readOnly) {
            const f = ptlFmtEuros(el.value); if (f !== el.value) el.value = f;
            return;
          }
          el.addEventListener('focus', () => { const v = ptlNum(el.value); el.value = v == null ? '' : String(v).replace('.', ','); });
          el.addEventListener('blur',  () => { const f = ptlFmtEuros(el.value); el.value = f; el.dataset.orig = ptlValorPlano(f); });
          // Formateo inicial al cargar
          const f = ptlFmtEuros(el.value);
          if (f) { el.value = f; el.dataset.orig = ptlValorPlano(f); }
        });
        // Aplicar formato a campos de días
        ptlForm.querySelectorAll('.campo-dias').forEach(el => {
          if (el.readOnly) {
            const f = ptlFmtDias(el.value); if (f !== el.value) el.value = f;
            return;
          }
          el.addEventListener('focus', () => { const v = ptlNum(el.value); el.value = v == null ? '' : String(v).replace('.', ','); });
          el.addEventListener('blur',  () => { const f = ptlFmtDias(el.value); el.value = f; el.dataset.orig = ptlValorPlano(f); });
          const f = ptlFmtDias(el.value);
          if (f) { el.value = f; el.dataset.orig = ptlValorPlano(f); }
        });

        // Cálculos en vivo
        function n(name) { const el = ptlForm.querySelector('[name="'+name+'"]'); if (!el) return null; const v = ptlNum(el.value); return v; }
        function setCalc(id, val, fmt) {
          const el = document.getElementById(id);
          if (!el) return;
          if (val == null) { el.value = ''; return; }
          if (fmt === 'pct') el.value = (val * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }) + ' %';
          else el.value = val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) + ' €';
        }
        function recalc() {
          const tp = n('tiempo_previsto'), tr = n('tiempo_real');
          if (tp != null && tr != null && tp !== 0) setCalc('f_tiempo_desvio', 1 - (tr/tp), 'pct'); else setCalc('f_tiempo_desvio', null);
          const pto = n('pto_total');
          const mop = n('mano_obra_previsto'), mor = n('mano_obra_real');
          const map_ = n('material_previsto'), mar = n('material_real');
          // beneficio_previsto NO se calcula en pantalla: lo pone el Sheet (formula
          // heredada en los expedientes antiguos) o el boton Congelar de Plan 5 (nuevos).
          // La ficha SOLO muestra el valor del Sheet (ya formateado arriba); aqui se lee
          // unicamente para el desvio en vivo, no se reescribe.
          const bp = n('beneficio_previsto');
          const br = (pto!=null && mor!=null && mar!=null) ? (pto - mor - mar) : null;
          setCalc('f_ben_real', br);
          setCalc('f_ben_desv', (bp!=null && br!=null) ? (br - bp) : null);
        }
        ['tiempo_previsto','tiempo_real','pto_total','mano_obra_previsto','mano_obra_real','material_previsto','material_real']
          .forEach(name => { const el = ptlForm.querySelector('[name="'+name+'"]'); if (el) el.addEventListener('input', recalc); });
        recalc();

        // ============================================================
        // v17.54 — Handler reloj "Añadir a HOY" del expediente.
        // Hay dos botones .ptl-exp-reloj en la ficha:
        //   - En la esquina superior derecha del bloque NOTAS (replicado en v17.54).
        //   - En la fila "Comunidad de propietarios" de DATOS DOCUMENTACION
        //     (la renderiza documentacion.cjs, en pres.cjs solo si llegan los
        //     datos via app.locals.documentacion).
        // Al pulsar uno se actualizan ambos visualmente para que estén siempre
        // sincronizados (representan el mismo campo: comunidades.en_hoy).
        // El handler de documentacion.cjs hace lo mismo, así que cualquiera de
        // los dos puede inicializar el clic; pero registramos aquí para los
        // casos en que solo se renderiza el de NOTAS (módulo presupuestos puro).
        (function() {
          document.querySelectorAll('.ptl-exp-reloj').forEach(function(btn){
            // Evitamos doble-handler si documentacion.cjs ya lo ha enganchado.
            if (btn.dataset.relojBound === '1') return;
            btn.dataset.relojBound = '1';
            btn.addEventListener('click', async function(){
              var ccppId = btn.dataset.ccppId;
              var yaActivo = btn.dataset.enhoy === '1';
              var nuevoValor = yaActivo ? '' : '1';
              btn.disabled = true;
              try {
                var body = new URLSearchParams({ id: ccppId, campo: 'en_hoy', valor: nuevoValor });
                var r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                  method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                  body: body.toString()
                });
                if (!r.ok) {
                  var t = await r.text();
                  alert('Error: ' + t); btn.disabled = false; return;
                }
                // Sincronizar TODOS los .ptl-exp-reloj con el mismo ccpp_id.
                document.querySelectorAll('.ptl-exp-reloj[data-ccpp-id="' + ccppId + '"]').forEach(function(b){
                  b.dataset.enhoy = nuevoValor === '1' ? '1' : '0';
                  b.title = nuevoValor === '1' ? 'Quitar de HOY' : 'Añadir a HOY';
                  b.classList.toggle('ptl-btn-reloj', nuevoValor === '1');
                  b.classList.toggle('ptl-btn-reloj-off', nuevoValor !== '1');
                });
                btn.disabled = false;
              } catch (e) {
                alert('Error de red: ' + e.message);
                btn.disabled = false;
              }
            });
          });
        })();

        // ============================================================
        // AUTOCOMPLETADO DE ADMINISTRADOR (nombre → tel + email)
        // ============================================================
        const ptlAdminInfo = ${adminInfoJson};
        const ptlCcppIdActual = ${JSON.stringify(ccppIdActual)};

        function ptlNormNombre(s) { return String(s || "").trim(); }
        function ptlBuscarAdmin(nombre) {
          const n = ptlNormNombre(nombre);
          if (!n) return null;
          // Coincidencia exacta primero
          if (ptlAdminInfo[n]) return Object.assign({ nombre: n }, ptlAdminInfo[n]);
          // Coincidencia case-insensitive
          const nl = n.toLowerCase();
          for (const k of Object.keys(ptlAdminInfo)) {
            if (k.toLowerCase() === nl) return Object.assign({ nombre: k }, ptlAdminInfo[k]);
          }
          return null;
        }

        const inpAdminNombre = ptlForm.querySelector('[name="administrador"]');
        const inpAdminTel    = ptlForm.querySelector('[name="telefono_administrador"]');
        const inpAdminEmail  = ptlForm.querySelector('[name="email_administrador"]');

        // Cuando el usuario sale del campo NOMBRE administrador y ese nombre existe en BD:
        // si tel o email están vacíos, los rellena automáticamente
        if (inpAdminNombre && inpAdminTel && inpAdminEmail) {
          inpAdminNombre.addEventListener('blur', () => {
            const found = ptlBuscarAdmin(inpAdminNombre.value);
            if (!found) return;
            // Asegurar que el nombre quede con la capitalización oficial de BD
            if (inpAdminNombre.value !== found.nombre) {
              inpAdminNombre.value = found.nombre;
              inpAdminNombre.dataset.orig = found.nombre;
            }
            // Si TEL vacío → rellenar
            if (!inpAdminTel.value.trim() && found.telefono) {
              const f = (typeof ptlFmtTlf === 'function') ? ptlFmtTlf(found.telefono) : found.telefono;
              inpAdminTel.value = f;
              inpAdminTel.dataset.orig = f;
              ptlActPill();
            }
            // Si EMAIL vacío → rellenar
            if (!inpAdminEmail.value.trim() && found.email) {
              inpAdminEmail.value = found.email;
              inpAdminEmail.dataset.orig = found.email;
              ptlActPill();
            }
          });

          // Cuando se cambia tel o email del admin, ofrecer propagar a otras CCPPs
          async function ptlPreguntarPropagarAdmin(campo) {
            const nombreAdmin = ptlNormNombre(inpAdminNombre.value);
            if (!nombreAdmin) return;
            const info = ptlAdminInfo[nombreAdmin];
            if (!info || !info.ccpps || info.ccpps.length <= 1) return;
            // Hay más CCPPs con este admin → preguntar
            const otras = info.ccpps.filter(x => x.ccpp_id !== ptlCcppIdActual);
            if (otras.length === 0) return;
            const nuevoValor = (campo === 'telefono')
              ? (typeof ptlValor === 'function' ? ptlValor('telefono_administrador') : inpAdminTel.value.replace(/\\D/g, ''))
              : inpAdminEmail.value.trim();
            const r = confirm(
              'Has cambiado el ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + nombreAdmin + '.\\n\\n' +
              'Este administrador está en ' + info.ccpps.length + ' CCPPs.\\n\\n' +
              '¿Aplicar el cambio en TODAS sus ' + info.ccpps.length + ' CCPPs?\\n\\n' +
              '  Aceptar = Actualizar todas\\n' +
              '  Cancelar = Solo en esta CCPP'
            );
            if (!r) return;
            // Llamar al endpoint de propagación
            try {
              const fd = new URLSearchParams();
              fd.append('nombre_admin', nombreAdmin);
              fd.append('campo', campo);
              fd.append('valor', nuevoValor);
              const resp = await fetch('${urlT(token, "/presupuestos/admin/actualizar")}', { method: 'POST', body: fd });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const data = await resp.json();
              alert('Actualizado ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + nombreAdmin + ' en ' + data.actualizadas + ' CCPPs.');
              // Actualizar también la cache local de ptlAdminInfo
              if (campo === 'telefono') ptlAdminInfo[nombreAdmin].telefono = nuevoValor;
              else ptlAdminInfo[nombreAdmin].email = nuevoValor;
            } catch (e) {
              alert('Error actualizando: ' + e.message);
            }
          }
          inpAdminTel.addEventListener('blur', () => {
            // Solo preguntar si el valor cambió respecto al original
            if (inpAdminTel.dataset.orig !== inpAdminTel.value) {
              setTimeout(() => ptlPreguntarPropagarAdmin('telefono'), 100);
            }
          });
          inpAdminEmail.addEventListener('blur', () => {
            if (inpAdminEmail.dataset.orig !== inpAdminEmail.value) {
              setTimeout(() => ptlPreguntarPropagarAdmin('email'), 100);
            }
          });
        }

        // ============================================================
        // MODAL ENVIAR MAIL (fase con plantilla)
        // v17.71: convertido en ventana flotante arrastrable (igual que
        // ptlComSendModal). Sin overlay translúcido; usa las clases
        // compartidas .ptl-floating-* de estilo-visual.cjs v1.14.
        // ============================================================
        function ptlCrearModalMailHtml() {
          if (document.getElementById('ptl-modal-mail')) return;
          const div = document.createElement('div');
          div.id = 'ptl-modal-mail';
          div.className = 'ptl-floating-wrapper';
          div.innerHTML = \`
            <div id="ptl-mm-box" class="ptl-floating-window" style="width:680px">
              <div id="ptl-mm-title" class="ptl-floating-title">
                <span id="ptl-mm-titulo" class="ptl-floating-title-text">📧 Enviar email</span>
                <button type="button" id="ptl-mm-cerrar" class="ptl-floating-close" title="Cerrar">✕</button>
              </div>
              <div class="ptl-floating-body">
                <div id="ptl-mm-aviso" style="display:none;padding:8px 12px;background:var(--ptl-warning-light);border-radius:6px;margin-bottom:12px;font-size:12px;color:var(--ptl-warning-dark)"></div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">Asunto</label>
                  <input id="ptl-mm-asunto" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">Para <span style="color:var(--ptl-gray-400);font-weight:normal">(varios separados por coma)</span></label>
                  <input id="ptl-mm-destinatario" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">CC <span style="color:var(--ptl-gray-400);font-weight:normal">(con copia visible — vacío si no procede)</span></label>
                  <input id="ptl-mm-cc" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">CCO <span style="color:var(--ptl-gray-400);font-weight:normal">(con copia oculta — separar con coma)</span></label>
                  <input id="ptl-mm-cco" type="text" placeholder="separar con coma" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">Mensaje</label>
                  <textarea id="ptl-mm-mensaje" rows="10" style="width:100%;padding:8px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
                </div>
                <div class="ptl-mb10">
                  <label class="ptl-label-2nd">Adjuntos (links de Drive, hasta 3)</label>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <div class="ptl-flex-g6">
                      <input type="text" id="ptl-mm-adj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" class="ptl-select-200"/>
                      <input type="text" id="ptl-mm-adj1url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/>
                    </div>
                    <div class="ptl-flex-g6">
                      <input type="text" id="ptl-mm-adj2lbl" placeholder="Etiqueta" class="ptl-select-200"/>
                      <input type="text" id="ptl-mm-adj2url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/>
                    </div>
                    <div class="ptl-flex-g6">
                      <input type="text" id="ptl-mm-adj3lbl" placeholder="Etiqueta" class="ptl-select-200"/>
                      <input type="text" id="ptl-mm-adj3url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/>
                    </div>
                  </div>
                  <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:4px">
                    Los archivos se descargan de Drive y se adjuntan al mail. En el histórico solo se guardan los links.
                  </div>
                </div>
                <div id="ptl-mm-estado" style="font-size:11px;color:var(--ptl-gray-500);margin-top:8px"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--ptl-gray-200)">
                  <button type="button" id="ptl-mm-saltar" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="display:none;margin-right:auto">→ Saltar envío</button>
                  <button type="button" id="ptl-mm-cancelar" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
                  <button type="button" id="ptl-mm-enviar" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Confirmar envío</button>
                </div>
              </div>
            </div>
          \`;
          document.body.appendChild(div);
          const cerrarBtn = document.getElementById('ptl-mm-cerrar');
          document.getElementById('ptl-mm-cerrar').addEventListener('click', ptlCerrarModalMail);
          document.getElementById('ptl-mm-cancelar').addEventListener('click', ptlCerrarModalMail);
          // v17.71: drag&drop arrastrable; NO se cierra al pulsar fuera (no hay overlay).
          window.ptlMakeDraggable(
            document.getElementById('ptl-mm-box'),
            document.getElementById('ptl-mm-title'),
            cerrarBtn
          );
        }
        function ptlCerrarModalMail() {
          const m = document.getElementById('ptl-modal-mail');
          if (m) m.style.display = 'none';
        }
        async function ptlAbrirModalMail(fase, ccppId, opts) {
          opts = opts || {};
          const esReenvio = !!opts.reenvio;
          ptlCrearModalMailHtml();
          const m = document.getElementById('ptl-modal-mail');
          m.style.display = 'block';
          // v17.71: centramos la ventana en el viewport tras mostrarla.
          window.ptlCentrarVentana(document.getElementById('ptl-mm-box'));
          // Limpiar
          document.getElementById('ptl-mm-aviso').style.display = 'none';
          document.getElementById('ptl-mm-asunto').value = 'Cargando...';
          document.getElementById('ptl-mm-mensaje').value = '';
          document.getElementById('ptl-mm-destinatario').value = '';
          document.getElementById('ptl-mm-cc').value = '';
          document.getElementById('ptl-mm-cco').value = '';
          ['ptl-mm-adj1lbl','ptl-mm-adj1url','ptl-mm-adj2lbl','ptl-mm-adj2url','ptl-mm-adj3lbl','ptl-mm-adj3url']
            .forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
          document.getElementById('ptl-mm-estado').textContent = '';
          // Cargar plantilla del servidor
          try {
            const r = await fetch('${urlT(token, "/presupuestos/plantilla-mail")}&fase=' + encodeURIComponent(fase) + '&id=' + encodeURIComponent(ccppId));
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              alert('Error: ' + (err.error || ('HTTP ' + r.status)));
              ptlCerrarModalMail();
              return;
            }
            const data = await r.json();
            document.getElementById('ptl-mm-titulo').textContent = esReenvio
              ? '📧 Reenviar presupuesto revisado'
              : '📧 Email · Fase ' + fase;
            document.getElementById('ptl-mm-destinatario').value = data.destinatario.email || '';
            document.getElementById('ptl-mm-cc').value = data.destinatario.cc || '';
            document.getElementById('ptl-mm-asunto').value = data.plantilla.asunto || '';
            document.getElementById('ptl-mm-mensaje').value = data.plantilla.mensaje || '';
            // CCO: viene de la plantilla del Sheet con los 3 huecos separados por '||'
            // (p.ej. "comercial@...||||"). Lo limpiamos a una lista separada por comas
            // (sin huecos vacíos) para mostrarlo en la casilla. Si el usuario lo edita,
            // el envío respeta lo que quede escrito (ya soportado desde v17.73).
            document.getElementById('ptl-mm-cco').value = String(data.plantilla.cco || '')
              .split('||').map(function(s){ return s.trim(); }).filter(Boolean).join(', ');
            // Repartir adjuntos_fijos en las 3 filas Etiqueta+URL. Se guía SOLO
            // por la presencia de http(s): si el trozo NO tiene URL es una etiqueta
            // sola (recordatorio para pegar el link al enviar) -> va al campo Etiqueta,
            // tal cual (conservando los ':' si los tuviera). Si tiene URL, se separa
            // la etiqueta (quitando el ': ' separador previo) de la URL.
            // Acepta separación por " || " o por saltos de línea.
            (function(){
              var partes = String(data.plantilla.adjuntos_fijos || '')
                .split(/\\s*\\|\\|\\s*|[\\r\\n]+/).map(function(s){ return s.trim(); }).filter(Boolean);
              for (var i = 0; i < 3; i++) {
                var lblEl = document.getElementById('ptl-mm-adj' + (i+1) + 'lbl');
                var urlEl = document.getElementById('ptl-mm-adj' + (i+1) + 'url');
                if (!lblEl || !urlEl) continue;
                var p = partes[i] || '';
                if (!p) { lblEl.value = ''; urlEl.value = ''; continue; }
                var idx = p.search(/https?:\\/\\//);
                if (idx === -1) {
                  // Sin URL -> etiqueta sola (recordatorio), tal cual.
                  lblEl.value = p; urlEl.value = '';
                } else {
                  urlEl.value = p.slice(idx).trim();
                  lblEl.value = p.slice(0, idx).replace(/:\\s*$/, '').trim();
                }
              }
            })();
            const enviados = data.estado.enviados || 0;
            const max = data.plantilla.max_envios || 0;
            const stEl = document.getElementById('ptl-mm-estado');
            if (max > 0) {
              // 'enviados' aquí es el total (manuales + automáticos). Para el
              // primer envío manual de la fase será 0. max_envios es el tope
              // de reenvíos automáticos. Mostramos info útil sin mezclar.
              if (enviados === 0) {
                stEl.textContent = 'Primer envío de la fase. Tras enviarlo, el cron mandará hasta ' + max + ' reenvíos automáticos.';
              } else {
                stEl.textContent = 'Envíos previos en esta fase: ' + enviados + '. Tope de reenvíos automáticos: ' + max + '.';
              }
              if (enviados + 1 >= max && fase === '03_ENVIO_PTO') {
                const aviso = document.getElementById('ptl-mm-aviso');
                aviso.style.display = 'block';
                aviso.innerHTML = 'ℹ Al confirmar el envío, el expediente pasará automáticamente a <strong>04-ACEPTACION PTO</strong>.';
              }
            } else {
              stEl.textContent = 'Envíos previos: ' + enviados + '.';
            }
            // Si no hay destinatario, avisar
            if (!data.destinatario.email) {
              const aviso = document.getElementById('ptl-mm-aviso');
              aviso.style.display = 'block';
              aviso.textContent = '⚠ Esta CCPP no tiene email de administrador ni de presidente configurado. Añade al menos uno en la ficha antes de enviar.';
            }
            // Botón "Saltar envío" — visible en todas las fases de envío que provocan avance
            // (excepto en reenvío de fase 04, que no avanza).
            const btnSaltar = document.getElementById('ptl-mm-saltar');
            const fasesSaltables = ['02_PTE_VISITA_CON_ACTA','02_PTE_VISITA_SIN_ACTA','03_ENVIO_PTO','05_ACEPTACION_PTO','05_FIN_DOC','08_INICIO_CYCP'];
            if (fasesSaltables.includes(fase) && !esReenvio) {
              btnSaltar.style.display = 'inline-flex';
              btnSaltar.onclick = async () => {
                if (!confirm('¿Avanzar a la siguiente fase sin enviar el mail desde el sistema?\\n\\nSe asume que ya enviaste el mail por otra vía (WhatsApp, teléfono, etc).\\n\\nEl expediente avanzará a la siguiente fase.')) return;
                btnSaltar.disabled = true; btnSaltar.textContent = 'Avanzando...';
                try {
                  const fd = new URLSearchParams();
                  fd.append('id', ccppId);
                  fd.append('fase', fase);
                  fd.append('skip', '1');
                  const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                  const dd = await resp.json();
                  if (!resp.ok) throw new Error(dd.error || 'HTTP ' + resp.status);
                  alert('→ Expediente avanzado sin envío de mail.');
                  ptlCerrarModalMail();
                  // v18.36 — recarga limpia (NO reload)
                  window.ptlRecargaLimpia();
                } catch (e) {
                  alert('Error: ' + e.message);
                  btnSaltar.disabled = false; btnSaltar.textContent = '→ Saltar envío';
                }
              };
            } else {
              btnSaltar.style.display = 'none';
            }
            // Botón confirmar
            const btn = document.getElementById('ptl-mm-enviar');
            if (esReenvio) btn.textContent = '📧 Confirmar reenvío';
            btn.onclick = async () => {
              btn.disabled = true; btn.textContent = esReenvio ? 'Reenviando...' : 'Enviando...';
              const envioId = 'e' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
              try {
                const fd = new URLSearchParams();
                fd.append('envioId', envioId);
                fd.append('id', ccppId);
                fd.append('fase', fase);
                fd.append('destinatario', document.getElementById('ptl-mm-destinatario').value);
                fd.append('cc', document.getElementById('ptl-mm-cc').value);
                fd.append('cco', document.getElementById('ptl-mm-cco').value);
                fd.append('asunto', document.getElementById('ptl-mm-asunto').value);
                fd.append('mensaje', document.getElementById('ptl-mm-mensaje').value);
                // Adjuntos: 3 filas Etiqueta+URL -> "LABEL: url || LABEL: url"
                // (mismo formato que el modal de mail manual).
                var _adjs = [];
                for (var _i = 1; _i <= 3; _i++) {
                  var _lbl = (document.getElementById('ptl-mm-adj' + _i + 'lbl').value || '').trim();
                  var _url = (document.getElementById('ptl-mm-adj' + _i + 'url').value || '').trim();
                  if (_url) _adjs.push((_lbl || 'ADJUNTO_' + _i) + ': ' + _url);
                }
                fd.append('adjuntos', _adjs.join(' || '));
                fd.append('tipo', esReenvio ? 'reenvio_fase04' : 'manual_inicial');
                if (esReenvio) fd.append('reenvio', '1');
                const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                const dd0 = await resp.json();
                if (!resp.ok) throw new Error(dd0.error || 'HTTP ' + resp.status);
                let dd;
                if (dd0 && dd0.encolado) {
                  const r = await window.ptlSondearEnvio(envioId);
                  if (!r.ok) {
                    const motivo = (r.isJson && r.payload && r.payload.error) ? r.payload.error
                                  : (typeof r.payload === 'string' ? r.payload : ('HTTP ' + (r.status || '?')));
                    throw new Error(motivo);
                  }
                  dd = r.payload || {};
                } else {
                  dd = dd0;
                }
                let msg;
                if (esReenvio) {
                  msg = '✓ Presupuesto reenviado.\\n\\nCuenta como un nuevo envío manual. El cron arranca el ciclo de reenvíos automáticos desde cero.';
                } else {
                  msg = '✓ Email enviado.';
                  if (dd.avanzado) {
                    msg += '\\n\\n→ Expediente avanzado a 04-ACEPTACION PTO.';
                  } else if (dd.avanzadoA05) {
                    msg += '\\n\\n→ Expediente avanzado a 05-DOCUMENTACION.';
                  } else if (fase === '01_CONTACTO') {
                    msg += '\\n\\nEl sistema gestionará los reenvíos automáticos.';
                  }
                }
                alert(msg);
                ptlCerrarModalMail();
                // Si avanzó a 05, redirigir al módulo de documentación
                if (dd.avanzadoA05) {
                  const ccppId = '${esc(comu.ccpp_id)}';
                  window.location.href = '${urlT(token, "/documentacion/expediente")}&id=' + encodeURIComponent(ccppId);
                  return;
                }
                // Recargar quitando flags creado/reactivado para que no vuelva a preguntar
                const url = new URL(window.location.href);
                url.searchParams.delete('creado');
                url.searchParams.delete('reactivado');
                window.location.href = url.toString();
              } catch (e) {
                if (e.message === 'TIMEOUT') {
                  alert('El envío está tardando más de lo normal. Puede que ya se haya enviado.\\n\\nCierra esta ventana, refresca y comprueba en COMUNICACIONES antes de volver a enviar (para no duplicar).');
                  ptlCerrarModalMail();
                  window.location.reload();
                  return;
                }
                alert('Error: ' + e.message);
                btn.disabled = false; btn.textContent = esReenvio ? '📧 Confirmar reenvío' : '📧 Confirmar envío';
              }
            };
          } catch (e) {
            alert('Error cargando plantilla: ' + e.message);
            ptlCerrarModalMail();
          }
        }
        // Exponer globalmente para usar desde onclick="..."
        window.ptlAbrirModalMail = ptlAbrirModalMail;

        // Mini-diálogo "¿Recibimos mail con acta?" antes de abrir el modal
        // del mail de paso a fase 02. Según lo que pulse el usuario, se abre
        // el modal con la plantilla 02_PTE_VISITA_CON_ACTA o 02_PTE_VISITA_SIN_ACTA.
        window.ptlPreguntarActaPaso02 = function(ccppId) {
          // Si ya hay un diálogo abierto, ignorar
          if (document.getElementById('ptl-dlg-acta')) return;
          const dlg = document.createElement('div');
          dlg.id = 'ptl-dlg-acta';
          dlg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px';
          dlg.innerHTML = \`
            <div style="background:var(--ptl-general-flotante);border-radius:10px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);padding:20px">
              <h3 style="margin:0 0 14px;font-size:16px;color:var(--ptl-gray-900)">¿Recibimos mail con acta?</h3>
              <p style="margin:0 0 18px;font-size:13px;color:var(--ptl-gray-700);line-height:1.4">
                Selecciona la plantilla a enviar según hayan adjuntado el acta de la asamblea o no.
              </p>
              <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
                <button type="button" id="ptl-dlg-acta-cancel" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
                <button type="button" id="ptl-dlg-acta-sin"    class="ptl-btn ptl-btn-secondary ptl-btn-sm">Sin acta</button>
                <button type="button" id="ptl-dlg-acta-con"    class="ptl-btn ptl-btn-primary ptl-btn-sm">Con acta</button>
              </div>
            </div>
          \`;
          document.body.appendChild(dlg);
          function cerrar() { const d = document.getElementById('ptl-dlg-acta'); if (d) d.remove(); }
          dlg.addEventListener('click', ev => { if (ev.target === dlg) cerrar(); });
          document.getElementById('ptl-dlg-acta-cancel').onclick = cerrar;
          document.getElementById('ptl-dlg-acta-con').onclick = () => {
            cerrar();
            window.ptlAbrirModalMail('02_PTE_VISITA_CON_ACTA', ccppId);
          };
          document.getElementById('ptl-dlg-acta-sin').onclick = () => {
            cerrar();
            window.ptlAbrirModalMail('02_PTE_VISITA_SIN_ACTA', ccppId);
          };
        };

        // Validación previa al envío de fase 03: comprueba que los 4 campos económicos
        // previstos estén rellenos. Si falta alguno, pide confirmación. Si el usuario
        // confirma, abre el modal. Si cancela, vuelve a la pantalla a rellenar.
        window.ptlIntentarEnviarFase03 = function(fase, ccppId) {
          const requeridos = [
            { name: 'pto_total',          label: 'PTO TOTAL' },
            { name: 'tiempo_previsto',    label: 'TIEMPO PREVISTO' },
            { name: 'mano_obra_previsto', label: 'MANO DE OBRA PREVISTO' },
            { name: 'material_previsto',  label: 'MATERIAL PREVISTO' },
          ];
          const faltan = [];
          for (const r of requeridos) {
            const el = ptlForm.querySelector('input[name="' + r.name + '"]');
            const v = (el && el.value || '').trim();
            if (!v) faltan.push(r.label);
          }
          if (faltan.length > 0) {
            const msg = 'No se han rellenado todos los datos económicos previstos:\\n\\n  • ' + faltan.join('\\n  • ') + '\\n\\n¿Continuar a fase 04 igualmente?';
            if (!confirm(msg)) return;
          }
          ptlAbrirModalMail(fase, ccppId);
        };

        // Sincroniza el mini-input "FECHA VISITA" de la barra de acciones con el campo
        // principal del formulario (fecha_visita). Así reutiliza el sistema de
        // "guardar al cambiar" que ya existe (ptlMarcarCambios + autosave).
        window.ptlSyncFechaVisita = function(valor) {
          const main = ptlForm.querySelector('input[name="fecha_visita"]');
          if (!main) return;
          main.value = valor;
          // Disparar el evento que recalcula el diff y guarda
          main.dispatchEvent(new Event('input', { bubbles: true }));
          main.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Sincronización de la fecha de visita EMASESA (fase 06).
        // No usa el sistema del formulario (la columna no aparece como input
        // editable en el form). Hace una llamada al endpoint /campo directamente.
        window.ptlSyncFechaVisitaEmasesa = async function(valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId);
            fd.append('campo', 'fecha_visita_emasesa');
            fd.append('valor', valor || '');
            const resp = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              alert('Error guardando fecha: ' + (err.error || resp.status));
            }
          } catch (e) {
            alert('Error guardando fecha: ' + e.message);
          }
        };

        // Sincronización de la fecha "Próximo mail manual" (fase 04).
        // No usa el sistema del formulario (porque la columna no aparece como input
        // editable en el form). Hace una llamada al endpoint /campo directamente.
        window.ptlSyncFechaProximoMail = async function(valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId);
            fd.append('campo', 'fecha_proximo_mail_manual');
            fd.append('valor', valor || '');
            const resp = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              alert('Error guardando próxima fecha: ' + (err.error || resp.status));
            }
          } catch (e) {
            alert('Error guardando próxima fecha: ' + e.message);
          }
        };

        // Reenviar presupuesto desde fase 04: valida los 4 económicos previstos y abre el modal.
        // El modal usa la plantilla "envio_pto" (la misma que en fase 03).
        // Al confirmar el envío, el endpoint /enviar-mail con flag reenvio=1 hace:
        //   - Actualiza fecha_ultimo_reenvio_pto = hoy
        //   - Resetea fecha_ultimo_seguimiento_pto = hoy
        //   - Borra contador de mails fase 04 y fecha_proximo_mail_manual
        //   - Registra en histórico
        window.ptlIntentarReenviarFase04 = function(ccppId) {
          const requeridos = [
            { name: 'pto_total',          label: 'PTO TOTAL' },
            { name: 'tiempo_previsto',    label: 'TIEMPO PREVISTO' },
            { name: 'mano_obra_previsto', label: 'MANO DE OBRA PREVISTO' },
            { name: 'material_previsto',  label: 'MATERIAL PREVISTO' },
          ];
          const faltan = [];
          for (const r of requeridos) {
            const el = ptlForm.querySelector('input[name="' + r.name + '"]');
            const v = (el && el.value || '').trim();
            if (!v) faltan.push(r.label);
          }
          if (faltan.length > 0) {
            const msg = 'No se han rellenado todos los datos económicos previstos:\\n\\n  • ' + faltan.join('\\n  • ') + '\\n\\n¿Continuar con el reenvío igualmente?';
            if (!confirm(msg)) return;
          }
          // Abre el modal con la fase '04_REENVIO' (plantilla exclusiva del reenvío de fase 04)
          // y le pasa el flag reenvio para que el endpoint sepa qué hacer (no avanza fase, etc.).
          ptlAbrirModalMail('04_REENVIO', ccppId, { reenvio: true });
        };

        // Retroceder a fase anterior: única confirmación con conservar/borrar datos.
        //   Aceptar  = conservar | Cancelar = borrar (vuelta limpia)
        window.ptlRetroceder = function(ccppId, labelAnt) {
          const conservar = confirm(
            'Volver a ' + labelAnt + '.\\n\\n' +
            'Datos de la fase actual (fechas y contadores de mails de esa fase):\\n\\n' +
            '  • Aceptar  = CONSERVAR los datos (se quedan por si avanzas otra vez)\\n' +
            '  • Cancelar = BORRARLOS (vuelta limpia)'
          );
          const form = document.getElementById('ptlFormRetroceder_' + ccppId);
          if (!form) { alert('Error: formulario no encontrado'); return; }
          form.querySelector('input[name="conservar"]').value = conservar ? '1' : '0';
          form.submit();
        };

        // Si el expediente acaba de crearse o reactivarse, preguntar si activar envíos automáticos.
        // v17.73: (Bug A) se limpia el flag creado/reactivado de la URL ANTES de preguntar, con
        // history.replaceState, para que el aviso se muestre UNA sola vez. Antes el flag se quedaba
        // pegado si se cancelaba, y cualquier recarga posterior (avanzar de fase, reloj, Ctrl+F5)
        // lo re-disparaba en fases donde no aplica (p.ej. 02_VISITA). (Bug B) se pasa la fase REAL
        // (${esc(fase)}, que tras crear/reactivar siempre es 01_CONTACTO) en vez de comu.fase, que
        // no existe como propiedad (valía undefined -> fallback 'fase' -> el modal no cargaba plantilla).
        ${reciencreado ? `
        setTimeout(() => {
          const _u = new URL(window.location.href);
          _u.searchParams.delete('creado');
          _u.searchParams.delete('reactivado');
          history.replaceState(null, '', _u.toString());
          if (confirm('¿Activar envíos automáticos?\\n\\nSe enviará ahora el primer email solicitando aprobación del presupuesto, y a partir de ahí el sistema gestionará los envíos según las reglas de la plantilla.')) {
            ptlAbrirModalMail('${esc(fase)}', '${esc(comu.ccpp_id)}');
          }
        }, 300);
        ` : ''}
      </script>
    `;
  }

  // (BLOQUE ELIMINADO) — La cajita de vecinos y el badge de estado vecino se
  // trasladan a documentacion.cjs.

  // =================================================================
  // VISTA: NUEVO EXPEDIENTE
  // =================================================================
  function vistaNuevo(error, token, tiposVia, admins, presis, calles, direccionPrev, adminInfo) {
    const acDataNuevoJson = JSON.stringify({
      tipos:  tiposVia || [],
      admins: admins || [],
      presis: presis || [],
      calles: calles || [],
    }).replace(/</g, "\\u003c");
    const adminInfoNuevoJson = JSON.stringify(adminInfo || {}).replace(/</g, "\\u003c");
    const dirVal = esc(direccionPrev || "");
    return `
      <h1 style="font-size:22px;font-weight:700;margin-bottom:14px">+ Nuevo expediente</h1>
      ${error ? `<div class="ptl-next-action urgent"><div class="ico">⚠</div><div class="text">${esc(error)}</div></div>` : ''}
      <form method="POST" action="${urlT(token, "/presupuestos/nuevo")}" id="ptl-form-nuevo">
        <div class="ptl-card">
          <div class="ptl-card-title">Datos de la nueva CCPP</div>
          <div class="ptl-form-grid ptl-gap26">
            <div class="col-1"><label class="ptl-form-label">Tipo via</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" autofocus placeholder="C" value="" autocomplete="off"/>
              </div>
            </div>
            <div class="col-6"><label class="ptl-form-label">Direccion *</label>
              <div class="ptl-ac-wrap">
                <input name="direccion" data-ac="calles" required placeholder="Ej. Doctor Fedriani 39" value="${dirVal}" autocomplete="off"/>
              </div>
            </div>
            <div class="col-3"><label class="ptl-form-label">Poblacion</label>
              <input name="poblacion" value="" class="ptl-w100"/>
            </div>
            <div class="col-2"><label class="ptl-form-label">CP</label>
              <input name="cp" value="" class="ptl-w100"/>
            </div>
          </div>
          <div class="ptl-form-grid ptl-gap26">
            <div class="col-6"><label class="ptl-form-label">Administrador</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Telefono</label><input name="telefono_administrador" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_administrador" type="email"/></div>
          </div>
          <div class="ptl-form-grid ptl-gap26">
            <div class="col-6"><label class="ptl-form-label">Presidente</label>
              <input name="presidente" autocomplete="off"/>
            </div>
            <div class="col-2"><label class="ptl-form-label">Telefono</label><input name="telefono_presidente" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_presidente" type="email"/></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="submit" class="ptl-btn ptl-btn-primary">Crear expediente</button>
          <a href="${urlT(token, "/presupuestos")}" class="ptl-btn ptl-btn-secondary">Cancelar</a>
        </div>
      </form>
      <script>
        // Saneamiento global: elimina acentos en inputs email
        document.querySelectorAll('input[type="email"]').forEach(el => {
          el.addEventListener('input', () => {
            const before = el.value;
            const sanitized = before
              .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
              .replace(/[^A-Za-z0-9._%+\\-@]/g, '');
            if (sanitized !== before) {
              const pos = el.selectionStart - (before.length - sanitized.length);
              el.value = sanitized;
              try { el.setSelectionRange(pos, pos); } catch(e) {}
            }
          });
        });
        (function() {
          const form = document.getElementById('ptl-form-nuevo');
          if (!form) return;
          const acData = ${acDataNuevoJson};
          // Mapa administrador -> { telefono, email, ccpps:[...] } para autorrellenar.
          const adminInfoNuevo = ${adminInfoNuevoJson};
          const inpAdminNombre = form.querySelector('[name="administrador"]');
          const inpAdminTel    = form.querySelector('[name="telefono_administrador"]');
          const inpAdminEmail  = form.querySelector('[name="email_administrador"]');
          function buscarAdminNuevo(nombre) {
            const n = String(nombre || '').trim();
            if (!n) return null;
            if (adminInfoNuevo[n]) return Object.assign({ nombre: n }, adminInfoNuevo[n]);
            const nl = n.toLowerCase();
            for (const k of Object.keys(adminInfoNuevo)) {
              if (k.toLowerCase() === nl) return Object.assign({ nombre: k }, adminInfoNuevo[k]);
            }
            return null;
          }
          // El administrador manda: al elegirlo/cambiarlo se SOBRESCRIBEN siempre
          // teléfono y email con los suyos (aunque vengan vacíos en la BD).
          function rellenarAdmin(nombre) {
            const f = buscarAdminNuevo(nombre);
            if (!f) return;
            if (inpAdminNombre && inpAdminNombre.value !== f.nombre) inpAdminNombre.value = f.nombre;
            if (inpAdminTel)   { inpAdminTel.value   = f.telefono || ''; inpAdminTel.dataset.orig   = inpAdminTel.value; }
            if (inpAdminEmail) { inpAdminEmail.value = f.email    || ''; inpAdminEmail.dataset.orig = inpAdminEmail.value; }
          }
          // Propagar a las demás CCPPs del administrador cuando se edita su tel/email a mano.
          async function preguntarPropagarAdmin(campo) {
            const found = buscarAdminNuevo(inpAdminNombre ? inpAdminNombre.value : '');
            if (!found) return; // administrador nuevo (no en BD) -> nada que propagar
            const info = adminInfoNuevo[found.nombre];
            if (!info || !info.ccpps || info.ccpps.length < 1) return;
            const nuevoValor = (campo === 'telefono')
              ? (inpAdminTel.value.replace(/\\D/g, ''))
              : inpAdminEmail.value.trim();
            const r = confirm(
              'Has cambiado el ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + found.nombre + '.\\n\\n' +
              'Este administrador está en ' + info.ccpps.length + ' CCPP(s).\\n\\n' +
              '¿Aplicar el cambio en TODAS sus CCPPs?\\n\\n' +
              '  Aceptar = Actualizar todas\\n' +
              '  Cancelar = Dejarlo solo en este expediente nuevo'
            );
            if (!r) { return; }
            try {
              const fd = new URLSearchParams();
              fd.append('nombre_admin', found.nombre);
              fd.append('campo', campo);
              fd.append('valor', nuevoValor);
              const resp = await fetch('${urlT(token, "/presupuestos/admin/actualizar")}', { method: 'POST', body: fd });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const data = await resp.json();
              alert('Actualizado ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + found.nombre + ' en ' + (data.actualizadas != null ? data.actualizadas : '?') + ' CCPP(s).');
              if (adminInfoNuevo[found.nombre]) {
                if (campo === 'telefono') adminInfoNuevo[found.nombre].telefono = nuevoValor;
                else adminInfoNuevo[found.nombre].email = nuevoValor;
              }
              if (campo === 'telefono' && inpAdminTel) inpAdminTel.dataset.orig = inpAdminTel.value;
              if (campo === 'email' && inpAdminEmail) inpAdminEmail.dataset.orig = inpAdminEmail.value;
            } catch (e) {
              alert('Error actualizando: ' + e.message);
            }
          }
          if (inpAdminNombre) {
            // Al salir del campo nombre con un administrador que existe, traer sus datos.
            inpAdminNombre.addEventListener('blur', () => { rellenarAdmin(inpAdminNombre.value); });
          }
          if (inpAdminTel) inpAdminTel.addEventListener('blur', () => {
            if (inpAdminTel.dataset.orig !== inpAdminTel.value) setTimeout(() => preguntarPropagarAdmin('telefono'), 100);
          });
          if (inpAdminEmail) inpAdminEmail.addEventListener('blur', () => {
            if (inpAdminEmail.dataset.orig !== inpAdminEmail.value) setTimeout(() => preguntarPropagarAdmin('email'), 100);
          });
          function normStr(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); }
          function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
          form.querySelectorAll('input[data-ac]').forEach(input => {
            const wrap = input.closest('.ptl-ac-wrap');
            if (!wrap) return;
            const opciones = acData[input.dataset.ac] || [];
            const lista = document.createElement('div');
            lista.className = 'ptl-ac-list';
            wrap.appendChild(lista);
            let activeIdx = -1;
            function render(filtro) {
              const f = normStr(filtro);
              const matches = !f
                ? opciones.slice(0, 20)
                : opciones.filter(o => normStr(o).includes(f)).slice(0, 30);
              if (matches.length === 0) {
                lista.innerHTML = '<div class="ptl-ac-empty">Sin coincidencias (puedes escribir un valor nuevo)</div>';
                lista.classList.add('show');
                activeIdx = -1;
                return;
              }
              lista.innerHTML = matches.map((o, i) => {
                let html = escHtml(o);
                if (f) {
                  const idx = normStr(o).indexOf(f);
                  if (idx !== -1) {
                    const before = escHtml(o.substring(0, idx));
                    const match  = escHtml(o.substring(idx, idx + filtro.length));
                    const after  = escHtml(o.substring(idx + filtro.length));
                    html = before + '<mark>' + match + '</mark>' + after;
                  }
                }
                return '<div class="ptl-ac-item" data-idx="'+i+'" data-val="'+escHtml(o)+'">'+html+'</div>';
              }).join('');
              lista.classList.add('show');
              activeIdx = -1;
            }
            function ocultar() { lista.classList.remove('show'); activeIdx = -1; }
            function elegir(val) {
              // Si es el campo dirección, añadimos un espacio para que el usuario siga escribiendo el número
              if (input.dataset.ac === 'calles') {
                input.value = val + ' ';
                input.focus();
                // Mover cursor al final
                const len = input.value.length;
                input.setSelectionRange(len, len);
              } else {
                input.value = val;
              }
              ocultar();
              // Al elegir un ADMINISTRADOR, traer su teléfono y email de la BD.
              if (input.dataset.ac === 'admins') rellenarAdmin(val);
            }
            input.addEventListener('focus', () => render(input.value));
            input.addEventListener('input', () => render(input.value));
            input.addEventListener('keydown', (ev) => {
              const items = lista.querySelectorAll('.ptl-ac-item');
              if (ev.key === 'ArrowDown') { ev.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('active', i === activeIdx)); if (items[activeIdx]) items[activeIdx].scrollIntoView({block:'nearest'}); }
              else if (ev.key === 'ArrowUp') { ev.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('active', i === activeIdx)); if (items[activeIdx]) items[activeIdx].scrollIntoView({block:'nearest'}); }
              else if (ev.key === 'Enter' || ev.key === 'Tab') {
                if (activeIdx >= 0 && items[activeIdx]) { ev.preventDefault(); elegir(items[activeIdx].dataset.val); }
                else if (items.length === 1) { ev.preventDefault(); elegir(items[0].dataset.val); }
                else { ocultar(); }
              }
              else if (ev.key === 'Escape') ocultar();
            });
            lista.addEventListener('mousedown', (ev) => {
              const item = ev.target.closest('.ptl-ac-item');
              if (item) { ev.preventDefault(); elegir(item.dataset.val); }
            });
            document.addEventListener('click', (ev) => { if (!wrap.contains(ev.target)) ocultar(); });
          });
        })();
      </script>
    `;
  }

  // =================================================================
  // VISTA: PLANTILLAS DE MAIL (editor)
  // =================================================================
  function vistaPlantillas(plantillas, token, cuentas, pieGlobal, segTextos) {
    // Config única: qué fases muestran CCO y cuáles adjuntos en la tarjeta.
    const _FASES_CCO = ["01_CONTACTO","03_ENVIO_PTO","04_REENVIO","05_ACEPTACION_PTO","05_FIN_DOC","08_INICIO_CYCP","08_FIN_CYCP"];
    const _FASES_ADJ = ["03_ENVIO_PTO","04_REENVIO","05_ACEPTACION_PTO","08_INICIO_CYCP","05_ULTIMATUM_DOC","08_ULTIMATUM_CYCP"];
    // Plazos reales para el esquema de tiempos (se leen de las plantillas)
    const _n05 = (v, d) => { const n = parseInt(v, 10); return (Number.isFinite(n) && n > 0) ? n : d; };
    // v18.122: _n05z admite el CERO (n >= 0). Solo para dias_primer_envio del seguimiento 05,
    //   donde 0 = "el mismo dia del ancla". El resto sigue con _n05 (0 -> valor por defecto).
    const _n05z = (v, d) => { const n = parseInt(v, 10); return (Number.isFinite(n) && n >= 0) ? n : d; };
    const _seg05 = (plantillas || []).find(p => p.fase === "05_SEGUIMIENTO_DOC") || {};
    const _res05 = (plantillas || []).find(p => p.fase === "05_ULT_RESOLVER") || {};
    const _segDi = _n05z(_seg05.dias_primer_envio, 5);
    const _segDr = _n05(_seg05.dias_recurrente, 5);
    const _segMx = _n05(_seg05.max_envios, 3);
    const _pAmp = _n05(segTextos && segTextos.aviso && segTextos.aviso.dias_primer_envio, 20);
    const _pRec = _n05(segTextos && segTextos.aviso && segTextos.aviso.dias_recurrente, 10);
    const _pDis = _pAmp; // disidentes = mismo plazo que Ampliación (prórroga = X)
    const _pRes = _n05(_res05.dias_primer_envio, 5);
    const _esqRows = [["0", "05-INICIO DOC", "envío manual", "👍 Inicio doc"]];
    for (let i = 0; i < _segMx; i++) { const dia = _segDi + i * _segDr; _esqRows.push([String(dia), "05-SEGUIMIENTO LISTADO", "automático (cron)", "👍 Listado solicitado<br>hace " + dia + " días del inicio"]); }
    // v18.95 — último envío REAL del seguimiento (di + dr×(mx-1)); ya no se inventa
    // una fila extra. La tabla muestra exactamente una fila por envío real.
    const _diaUltListado = _segDi + _segDr * Math.max(0, _segMx - 1);
    _esqRows.push(["—", "1er bot-whatsapp", "anula LISTADO y arranca DOC (reloj desde el contacto)", "(re-anclado al contacto)"]);
    for (let i = 0; i < _segMx; i++) { const dia = _segDi + i * _segDr; _esqRows.push(["contacto +" + dia, "05-SEGUIMIENTO DOC", "automático (cron)", "👍 Doc solicitada<br>hace " + dia + " días del contacto"]); }
    _esqRows.push(["contacto +" + PLAZO_DOC_INICIAL, "05-ULTIMÁTUM DOC (PRÓRROGA)", "botón «Aviso prórroga 1»", "⚠️ Aviso prórroga 1<br>📨 Plazo ampliado"]);
    _esqRows.push(["contacto +" + (PLAZO_DOC_INICIAL + _pRec), "05-ULTIMÁTUM DOC (PRÓRROGA)", "botón «Aviso prórroga 2»", "⚠️ Aviso prórroga 2<br>📨 Plazo ampliado"]);
    _esqRows.push(["contacto +" + (PLAZO_DOC_INICIAL + _pAmp), "05-ULTIMÁTUM DOC (DISIDENTES)", "botón «Solicitar disidentes»", "⚠️ Solicitar disidentes<br>📛 Disidentes solicitados"]);
    _esqRows.push(["disidentes +" + _pRes, "05-RESOLUCIÓN DE CONTRATO", "botón «Resolución de contrato»", "⚠️ Resolución de contrato<br>📛 Contrato resuelto"]);
    _esqRows.push(["cualquier momento", "05-FIN DOC", "al entregar todo", "✅ Doc completa"]);
    const _esqRowsStr = JSON.stringify(_esqRows);
    const _totUlt = PLAZO_DOC_INICIAL + _pAmp + _pRes; // 20 inicial + prórroga + resolución
    const _totMax = _diaUltListado + _totUlt;
    // Datos del esquema de tiempos de FASE 08 (contratos y cartas de pago). Reloj = envío de contratos; sin fase de LISTADO ni bot.
    const _seg08 = (plantillas || []).find(p => p.fase === "08_SEGUIMIENTO_CYCP") || {};
    const _res08 = (plantillas || []).find(p => p.fase === "08_ULT_RESOLVER") || {};
    const _segDi8 = _n05(_seg08.dias_primer_envio, 5);
    const _segDr8 = _n05(_seg08.dias_recurrente, 5);
    const _segMx8 = _n05(_seg08.max_envios, 3);
    const _pAmp8 = _n05(segTextos && segTextos.aviso8 && segTextos.aviso8.dias_primer_envio, 10);
    const _pRec8 = _n05(segTextos && segTextos.aviso8 && segTextos.aviso8.dias_recurrente, 10);
    const _pDis8 = _pAmp8;
    const _pRes8 = _n05(_res08.dias_primer_envio, 5);
    const _esqRows8 = [["0", "08-INICIO CYCP", "envío manual (contratos y cartas)", "👍 Inicio CYCP"]];
    for (let i = 0; i < _segMx8; i++) { const dia = _segDi8 + i * _segDr8; _esqRows8.push([String(dia), "08-SEGUIMIENTO CYCP", "automático (cron)", "👍 Contratos solicitados<br>hace " + dia + " días del inicio"]); }
    _esqRows8.push([String(PLAZO_CYCP_INICIAL), "08-ULTIMÁTUM CYCP (PRÓRROGA)", "botón «Aviso prórroga 1»", "⚠️ Aviso prórroga 1<br>📨 Plazo ampliado"]);
    _esqRows8.push([String(PLAZO_CYCP_INICIAL + _pRec8), "08-ULTIMÁTUM CYCP (PRÓRROGA)", "botón «Aviso prórroga 2»", "⚠️ Aviso prórroga 2<br>📨 Plazo ampliado"]);
    _esqRows8.push([String(PLAZO_CYCP_INICIAL + _pAmp8), "08-ULTIMÁTUM CYCP (DISIDENTES)", "botón «Solicitar disidentes»", "⚠️ Solicitar disidentes<br>📛 Disidentes solicitados"]);
    _esqRows8.push([String(PLAZO_CYCP_INICIAL + _pAmp8 + _pRes8), "08-RESOLUCIÓN DE CONTRATO", "botón «Resolución de contrato»", "⚠️ Resolución de contrato<br>📛 Contrato resuelto"]);
    _esqRows8.push(["cualquier momento", "08-FIN CYCP", "al firmar todo", "✅ CYCP completa"]);
    const _esqRowsStr8 = JSON.stringify(_esqRows8);
    const _totUlt8 = PLAZO_CYCP_INICIAL + _pAmp8 + _pRes8; // 10 inicial + prórroga + resolución
    const tarjetas = plantillas.map(p => {
      // Separar adjuntos_fijos en _adjunto_1, _adjunto_2, _adjunto_3 para el formulario
      const partes = String(p.adjuntos_fijos || "").split("||");
      p._adjunto_1 = (partes[0] || "").trim();
      p._adjunto_2 = (partes[1] || "").trim();
      p._adjunto_3 = (partes[2] || "").trim();
      // Lo mismo para CCO: separar en _cco_1, _cco_2, _cco_3
      const partesCco = String(p.cco || "").split("||");
      p._cco_1 = (partesCco[0] || "").trim();
      p._cco_2 = (partesCco[1] || "").trim();
      p._cco_3 = (partesCco[2] || "").trim();
      const fase = p.fase;
      const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
      const nombre = nombrePlantillaAmigable(fase);
      const activoChecked = p.activo ? 'checked' : '';
      const cuentasList = Array.isArray(cuentas) ? cuentas : [];
      const cuentaSel = (p.cuenta_envio || "").trim();
      const optsCuenta = cuentasList.length === 0
        ? '<option value="">— No hay cuentas configuradas en mail_cuentas —</option>'
        : '<option value="">— Selecciona una cuenta —</option>' +
          cuentasList.map(c => `<option value="${esc(c.id)}" ${c.id === cuentaSel ? 'selected' : ''}>${esc(c.id)} (${esc(c.email)})</option>`).join('');
      // Descripción del disparador (qué desencadena el envío de esta plantilla)
      const DESCR_PLANTILLA = {
        "01_CONTACTO":             'Envío manual al pulsar "📧 Activar mail automático" en fase 01.',
        "02_PTE_VISITA_CON_ACTA":  'Envío manual al pulsar "→ Paso a 02-VISITA" en fase 01 cuando han enviado el acta de la asamblea.',
        "02_PTE_VISITA_SIN_ACTA":  'Envío manual al pulsar "→ Paso a 02-VISITA" en fase 01 cuando NO han enviado el acta (la respuesta vale como interés).',
        "03_ENVIO_PTO":            'Envío manual al pulsar "📧 Enviar presupuesto" en fase 03.',
        "04_ACEPTACION_PTO":  'Envío automático de seguimiento al pulsar "📧 Enviar presupuesto" en fase 03.',
        "04_REENVIO":         'Envío manual al pulsar "📧 Reenviar presupuesto revisado" en fase 04.',
        "05_ACEPTACION_PTO":  'Envío manual al pulsar "✓ ACEPTADO" en fase 04.',
        "05_SEGUIMIENTO_DOC": 'Envío automático de seguimiento al pulsar "✓ ACEPTADO" en fase 04.',
        "05_ULTIMATUM_DOC":   'Ultimátum de documentación (fase 05). Un solo cron; dos textos (AVISO / RESOLUCIÓN). La lógica de disparo se conecta en un paso posterior.',
        "05_FIN_DOC":         'Envío manual al pulsar "→ Paso a 06-VISITA EMASESA" en fase 05.',
        "08_INICIO_CYCP":     'Envío manual al pulsar "→ Paso a 08-CYCP" en fase 07.',
        "08_SEGUIMIENTO_CYCP":'Envío automático de seguimiento al pulsar "→ Paso a 08-CYCP" en fase 07.',
        "08_FIN_CYCP":        'Envío manual al pulsar "✓ Cerrar fase 08-CYCP" en fase 08.',
      };
      const descripcion = DESCR_PLANTILLA[fase] || "";
      if (fase === "02_PTE_VISITA_CON_ACTA") {
        const _txtCon = esc(p.mensaje || "");
        const _txtSin = esc((segTextos && segTextos.actaSin && segTextos.actaSin.mensaje) || "");
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="02_PTE_VISITA_CON_ACTA">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 02-Pte visita</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="02_PTE_VISITA_CON_ACTA"/>
            <input type="hidden" name="mensaje" value="pte-visita"/>
            <input type="hidden" name="max_envios" value="1"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>
            <div class="ptl-fs12-mb8">Pendiente de visita (fase 02). Al pulsar «→ Paso a 02-VISITA» eliges CON ACTA o SIN ACTA y se envía el texto correspondiente. Aquí editas los dos.</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">TEXTO CON ACTA <span class="ptl-fw400-gray">(cuando han enviado el acta de la asamblea)</span></div>
              <textarea name="mensaje_con" rows="9" maxlength="5000" required class="ptl-input-full">${_txtCon}</textarea>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">TEXTO SIN ACTA <span class="ptl-fw400-gray">(cuando NO han enviado el acta; la respuesta vale como interés)</span></div>
              <textarea name="mensaje_sin" rows="9" maxlength="5000" required class="ptl-input-full">${_txtSin}</textarea>
            </label>
          </form>
        </div>
      `;
      }
      // Tarjeta ÚNICA de seguimiento doc: un cron + dos cuadros de texto
      // (SEGUIMIENTO LISTADO -> 05_SEG_ESPERA, SEGUIMIENTO DOC -> 05_SEG_FECHA).
      if (fase === "05_SEGUIMIENTO_DOC") {
        const _txtEspera = esc((segTextos && segTextos.espera && segTextos.espera.mensaje) || "");
        const _txtFecha  = esc((segTextos && segTextos.fecha  && segTextos.fecha.mensaje)  || "");
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 05-Seguimiento doc</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="05_SEGUIMIENTO_DOC"/>
            <input type="hidden" name="mensaje" value="{{bloque_seguimiento}}"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>

            <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:6px;align-items:center">
              <label class="ptl-fs12-lh">Primer envío de <input type="number" name="dias_primer_envio" value="${p.dias_primer_envio || 0}" min="0" max="99" class="ptl-input-sm ptl-w46c"/> días desde INICIO DOC (fase 05)</label>
              <label class="ptl-fs12-lh"><input type="number" name="dias_recurrente" value="${p.dias_recurrente || 0}" min="0" max="99" class="ptl-input-sm ptl-w46c"/> días entre envíos</label>
              <label class="ptl-fs12-lh"><input type="number" name="max_envios" value="${p.max_envios || 1}" min="1" max="10" class="ptl-input-sm ptl-w46c"/> envíos máximo</label>
            </div>
            <div class="ptl-fs12-mb8">Envío automático (fase 05). Un solo cron: usa SEGUIMIENTO LISTADO si el bot aún no ha contactado con los vecinos; si ya lo hizo, SEGUIMIENTO DOC.</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">SEGUIMIENTO LISTADO <span class="ptl-fw400-gray">(sólo bot — cuando el bot aún no ha contactado con los vecinos)</span></div>
              <textarea name="mensaje_listado" rows="7" maxlength="5000" required class="ptl-input-full">${_txtEspera}</textarea>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">SEGUIMIENTO DOC <span class="ptl-fw400-gray">(manual y bot — cuando el bot ya ha contactado con los vecinos; cada uno lleva su fecha límite)</span></div>
              <textarea name="mensaje_doc" rows="9" maxlength="5000" required class="ptl-input-full">${_txtFecha}</textarea>
            </label>
          </form>
        </div>
      `;
      }
      // Tarjeta ÚNICA de ultimátum doc: un cron + dos cuadros de texto
      // (ULTIMÁTUM AVISO -> 05_ULT_AVISO, ULTIMÁTUM RESOLUCIÓN -> 05_ULT_RESOLUCION).
      // Gemela de la de seguimiento. OJO: solo es la VENTANA (textos + cron).
      // La lógica que decide cuándo sale cada texto se conecta en un paso posterior.
      if (fase === "05_ULTIMATUM_DOC") {
        const _txtAviso = esc((segTextos && segTextos.aviso && segTextos.aviso.mensaje) || "");
        const _txtResol = esc((segTextos && segTextos.resolucion && segTextos.resolucion.mensaje) || "");
        const _ccoUltPart = String((segTextos && segTextos.aviso && segTextos.aviso.cco) || "").split("||");
        const _ccoUlt1 = esc((_ccoUltPart[0] || "").trim());
        const _ccoUlt2 = esc((_ccoUltPart[1] || "").trim());
        const _ccoUlt3 = esc((_ccoUltPart[2] || "").trim());
        const _pAmpliar = (segTextos && segTextos.aviso && parseInt(segTextos.aviso.dias_primer_envio,10) > 0) ? parseInt(segTextos.aviso.dias_primer_envio,10) : 20;
        const _pRecord  = (segTextos && segTextos.aviso && parseInt(segTextos.aviso.dias_recurrente,10) > 0) ? parseInt(segTextos.aviso.dias_recurrente,10) : 10;
        const _pDisid   = (segTextos && segTextos.resolucion && parseInt(segTextos.resolucion.dias_primer_envio,10) > 0) ? parseInt(segTextos.resolucion.dias_primer_envio,10) : 20;
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 05-Ultimátum doc</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="05_ULTIMATUM_DOC"/>
            <input type="hidden" name="mensaje" value="{{bloque_ultimatum}}"/>
            <input type="hidden" name="max_envios" value="1"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>

            <div class="ptl-fs12-mb8">Ultimátum de documentación (fase 05). Usa ULTIMÁTUM PRÓRROGA (Aviso prórroga 1 y 2) y ULTIMÁTUM DISIDENTES para solicitar disidentes.</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">ULTIMÁTUM PRÓRROGA <span class="ptl-fw400-gray">(aviso de prórroga; se envía con «Aviso prórroga 1» y «Aviso prórroga 2»)</span></div>
              <div style="margin:2px 0 4px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center">
                <label style="font-size:12px;line-height:1.4;display:block">Ampliación de plazo de <input type="number" name="plazo_ampliar" value="${_pAmpliar}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días de prórroga (sobre los 20 días iniciales)</label>
                <label style="font-size:12px;line-height:1.4;display:block">Recordatorio de <input type="number" name="plazo_recordatorio" value="${_pRecord}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días desde que ampliamos el plazo</label>
              </div>
              <textarea name="mensaje_aviso" rows="9" maxlength="5000" required class="ptl-input-full">${_txtAviso}</textarea>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">ULTIMÁTUM DISIDENTES <span class="ptl-fw400-gray">(se envía con «Solicitar disidentes»: solo se solicitan disidentes; la resolución y la indemnización van en «05 resolución contrato»)</span></div>
              <div style="margin:2px 0 4px;font-size:12px;line-height:1.4">Solicitud de disidentes de <strong>${_pAmpliar}</strong> días tras el plazo inicial</div>
              <textarea name="mensaje_resolucion" rows="9" maxlength="5000" required class="ptl-input-full">${_txtResol}</textarea>
            </label>

            <div class="ptl-h-tight13">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${_ccoUlt1}" maxlength="200" placeholder="email CCO 1" class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${_ccoUlt2}" maxlength="200" placeholder="email CCO 2" class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${_ccoUlt3}" maxlength="200" placeholder="email CCO 3" class="ptl-input-sm"/>
            </div>

            <div class="ptl-h-tight13">Adjuntos fijos (opcional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <input type="text" name="adjunto_1" value="${esc(p._adjunto_1 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
              <input type="text" name="adjunto_2" value="${esc(p._adjunto_2 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
              <input type="text" name="adjunto_3" value="${esc(p._adjunto_3 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
            </div>
          </form>
        </div>
      `;
      }
      if (fase === "05_ULT_RESOLVER") {
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 05-Resolución de contrato</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="05_ULT_RESOLVER"/>
            <input type="hidden" name="dias_recurrente" value="0"/>
            <input type="hidden" name="max_envios" value="1"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>
            <div class="ptl-fs12-mb8">Correo final: se envía al pulsar el botón «Resolución de contrato».</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>
            <label class="ptl-lbl-field">
              <div style="font-size:12px;line-height:1.4">Resolución de contrato de <input type="number" name="dias_primer_envio" value="${p.dias_primer_envio || 5}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días desde que solicitamos los disidentes</div>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Cuerpo del mensaje</div>
              <textarea name="mensaje" rows="10" maxlength="5000" required class="ptl-input-full">${esc(p.mensaje || '')}</textarea>
            </label>

            <div class="ptl-h-tight13">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${esc(((String(p.cco||"").split("||"))[0]||"").trim())}" maxlength="200" placeholder="email CCO 1" class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${esc(((String(p.cco||"").split("||"))[1]||"").trim())}" maxlength="200" placeholder="email CCO 2" class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${esc(((String(p.cco||"").split("||"))[2]||"").trim())}" maxlength="200" placeholder="email CCO 3" class="ptl-input-sm"/>
            </div>
          </form>
        </div>
        `;
      }
      if (fase === "08_ULTIMATUM_CYCP") {
        const _txtAviso = esc((segTextos && segTextos.aviso8 && segTextos.aviso8.mensaje) || "");
        const _txtResol = esc((segTextos && segTextos.resolucion8 && segTextos.resolucion8.mensaje) || "");
        const _ccoUltPart = String((segTextos && segTextos.aviso8 && segTextos.aviso8.cco) || "").split("||");
        const _ccoUlt1 = esc((_ccoUltPart[0] || "").trim());
        const _ccoUlt2 = esc((_ccoUltPart[1] || "").trim());
        const _ccoUlt3 = esc((_ccoUltPart[2] || "").trim());
        const _pAmpliar = (segTextos && segTextos.aviso8 && parseInt(segTextos.aviso8.dias_primer_envio,10) > 0) ? parseInt(segTextos.aviso8.dias_primer_envio,10) : 10;
        const _pRecord  = (segTextos && segTextos.aviso8 && parseInt(segTextos.aviso8.dias_recurrente,10) > 0) ? parseInt(segTextos.aviso8.dias_recurrente,10) : 10;
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 08-Ultimátum CYCP</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="08_ULTIMATUM_CYCP"/>
            <input type="hidden" name="mensaje" value="{{bloque_ultimatum}}"/>
            <input type="hidden" name="max_envios" value="1"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>
            <div class="ptl-fs12-mb8">Ultimátum de contratos y cartas de pago (fase 08). Usa ULTIMÁTUM PRÓRROGA (Aviso prórroga 1 y 2) y ULTIMÁTUM DISIDENTES para solicitar disidentes.</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">ULTIMÁTUM PRÓRROGA <span class="ptl-fw400-gray">(aviso de prórroga; se envía con «Aviso prórroga 1» y «Aviso prórroga 2»)</span></div>
              <div style="margin:2px 0 4px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center">
                <label style="font-size:12px;line-height:1.4;display:block">Ampliación de plazo de <input type="number" name="plazo_ampliar" value="${_pAmpliar}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días de prórroga (sobre los 10 días iniciales)</label>
                <label style="font-size:12px;line-height:1.4;display:block">Recordatorio de <input type="number" name="plazo_recordatorio" value="${_pRecord}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días desde que ampliamos el plazo</label>
              </div>
              <textarea name="mensaje_aviso" rows="9" maxlength="5000" required class="ptl-input-full">${_txtAviso}</textarea>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">ULTIMÁTUM DISIDENTES <span class="ptl-fw400-gray">(se envía con «Solicitar disidentes»: solo se solicitan disidentes; la resolución y la indemnización van en «05 resolución contrato»)</span></div>
              <div style="margin:2px 0 4px;font-size:12px;line-height:1.4">Solicitud de disidentes de <strong>${_pAmpliar}</strong> días tras el plazo inicial</div>
              <textarea name="mensaje_resolucion" rows="9" maxlength="5000" required class="ptl-input-full">${_txtResol}</textarea>
            </label>
            <div class="ptl-h-tight13">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${_ccoUlt1}" maxlength="200" placeholder="email CCO 1" class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${_ccoUlt2}" maxlength="200" placeholder="email CCO 2" class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${_ccoUlt3}" maxlength="200" placeholder="email CCO 3" class="ptl-input-sm"/>
            </div>

            <div class="ptl-h-tight13">Adjuntos fijos (opcional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <input type="text" name="adjunto_1" value="${esc(p._adjunto_1 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
              <input type="text" name="adjunto_2" value="${esc(p._adjunto_2 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
              <input type="text" name="adjunto_3" value="${esc(p._adjunto_3 || '')}" maxlength="500" placeholder="Título: https://..." class="ptl-input-sm"/>
            </div>
          </form>
        </div>
      `;
      }
      if (fase === "08_ULT_RESOLVER") {
        return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase 08-Resolución de contrato</span>
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="08_ULT_RESOLVER"/>
            <input type="hidden" name="dias_recurrente" value="0"/>
            <input type="hidden" name="max_envios" value="1"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>
            <div class="ptl-fs12-mb8">Correo final: se envía al pulsar el botón «Resolución de contrato».</div>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">${optsCuenta}</select>
            </label>
            <label class="ptl-lbl-field">
              <div style="font-size:12px;line-height:1.4">Resolución de contrato de <input type="number" name="dias_primer_envio" value="${p.dias_primer_envio || 5}" min="1" max="99" class="ptl-input-sm ptl-w46c"/> días desde que solicitamos los disidentes</div>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required class="ptl-input-sm ptl-w100"/>
            </label>
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Cuerpo del mensaje</div>
              <textarea name="mensaje" rows="10" maxlength="5000" required class="ptl-input-full">${esc(p.mensaje || '')}</textarea>
            </label>
            <div class="ptl-h-tight13">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${esc(((String(p.cco||"").split("||"))[0]||"").trim())}" maxlength="200" placeholder="email CCO 1" class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${esc(((String(p.cco||"").split("||"))[1]||"").trim())}" maxlength="200" placeholder="email CCO 2" class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${esc(((String(p.cco||"").split("||"))[2]||"").trim())}" maxlength="200" placeholder="email CCO 3" class="ptl-input-sm"/>
            </div>
          </form>
        </div>
        `;
      }
      const _esAutoDef = ["01_CONTACTO","04_ACEPTACION_PTO","08_SEGUIMIENTO_CYCP"].includes(fase);
      const _ctxEnv = fase === "01_CONTACTO" ? "desde que activamos el mail automático (fase 01)" : fase === "04_ACEPTACION_PTO" ? "desde que enviamos el presupuesto (fase 03)" : fase === "08_SEGUIMIENTO_CYCP" ? "desde que pasamos a 08-CYCP (fase 07)" : "";
      const _pfxEnv = fase === "01_CONTACTO" ? "Primer reenvío" : "Primer envío";
      return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📧 Fase ${esc(nombre)}</span>
                ${fase === "05_ACEPTACION_PTO" ? `<button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="padding:1px 8px;font-size:12px" title="Ver tiempos de la fase 05-Doc" onclick="ptlAbrirEsquema05(event)">📋 Tiempos Fase 05-Doc</button>` : ""}
                ${fase === "08_INICIO_CYCP" ? `<button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="padding:1px 8px;font-size:12px" title="Ver tiempos de la fase 08-CYCP" onclick="ptlAbrirEsquemaCycp(event)">📋 Tiempos Fase 08-CYCP</button>` : ""}
              </div>
            </div>
            <label class="ptl-acordeon-activa ptl-acc-activa-lbl" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="fase" value="${esc(fase)}"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real ptl-hidden" ${activoChecked}/>

            ${_esAutoDef ? `<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;align-items:center"><label class="ptl-fs12-lh">${_pfxEnv} de <input type="number" name="dias_primer_envio" value="${p.dias_primer_envio || 0}" min="0" max="99" class="ptl-input-sm ptl-w46c"/> días ${_ctxEnv}</label><label class="ptl-fs12-lh"><input type="number" name="dias_recurrente" value="${p.dias_recurrente || 0}" min="0" max="99" class="ptl-input-sm ptl-w46c"/> días entre envíos</label><label class="ptl-fs12-lh"><input type="number" name="max_envios" value="${p.max_envios || 1}" min="1" max="10" class="ptl-input-sm ptl-w46c"/> envíos máximo</label></div>` : `<div class="ptl-fs12-mb8">${esc(descripcion || "Envío manual.")}</div><input type="hidden" name="dias_recurrente" value="0"/><input type="hidden" name="max_envios" value="1"/>`}
            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm ptl-w100">
                ${optsCuenta}
              </select>
            </label>


            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required
                class="ptl-input-sm ptl-w100"/>
            </label>

            <label class="ptl-lbl-field">
              <div class="ptl-h-tight">Cuerpo del mensaje</div>
              <textarea name="mensaje" rows="8" maxlength="5000" required
                class="ptl-input-full">${esc(p.mensaje || '')}</textarea>
            </label>

            ${_FASES_CCO.includes(fase) ? `
            <div class="ptl-h-tight13">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${esc(p._cco_1 || '')}" maxlength="200"
                placeholder="email CCO 1"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${esc(p._cco_2 || '')}" maxlength="200"
                placeholder="email CCO 2"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${esc(p._cco_3 || '')}" maxlength="200"
                placeholder="email CCO 3"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
            </div>
            ` : ""}

            ${_FASES_ADJ.includes(fase) ? `
            <div class="ptl-h-tight13">Adjuntos fijos (opcional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <input type="text" name="adjunto_1" value="${esc(p._adjunto_1 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
              <input type="text" name="adjunto_2" value="${esc(p._adjunto_2 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
              <input type="text" name="adjunto_3" value="${esc(p._adjunto_3 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
            </div>` : ""}
          </form>
        </div>
      `;
    }).join("");

    return `
      <div style="max-width:880px;margin:0 auto;padding:14px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">⚙ Plantillas de mail</h1>
        <p style="color:var(--ptl-gray-600);font-size:13px;margin-bottom:4px">
          Configura aquí los textos de los emails y las reglas de envío automático para cada fase.
          Los cambios se aplican inmediatamente — no hay que reiniciar nada.
        </p>
        ${tarjetas}

        <div class="ptl-card ptl-acordeon" data-fase="_PIE_GLOBAL" style="border-color:var(--ptl-gray-300)">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📝 Pie de página global</span>
              </div>
              <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que se añadirá al final de TODOS los mails (después del cuerpo y los adjuntos).</div>
            </div>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar-pie-global")}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <textarea name="pie_global" rows="5" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(pieGlobal || "")}</textarea>
          </form>
        </div>

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:12px">
          Los datos se guardan en la pestaña <code>mail_plantillas</code> del Sheet.
        </div>

        <script>
          (function(){
            // Modal del esquema de la fase 05 (se abre desde el ℹ️ de la tarjeta Ultimátum).
            window.ptlAbrirEsquema05 = function(ev){
              if(ev){ ev.stopPropagation(); ev.preventDefault(); }
              var ex=document.getElementById("ptl-esquema05"); if(ex){ ex.style.display="flex"; return; }
              var rows=${_esqRowsStr};
              var d=document.createElement("div"); d.id="ptl-esquema05"; d.style.cssText="position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px";
              var h="";
              h+='<div id="ptl-esq-box" class="ptl-floating-window" style="width:900px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;background:var(--ptl-general-flotante,#fff);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.3)">';
              h+='<div id="ptl-esq-title" class="ptl-floating-title"><span class="ptl-floating-title-text">📋 Tiempos · Fase 05-Doc</span><button type="button" id="ptl-esq-cerrar" class="ptl-floating-close" title="Cerrar">✕</button></div>';
              h+='<div class="ptl-floating-body" style="max-height:72vh;overflow:auto;color:#111">';
              h+='<table style="width:100%;border-collapse:collapse;font-size:12px">';
              h+='<thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--ptl-gray-300);width:34px">#</th><th class="ptl-th-left">Día</th><th class="ptl-th-left">Plantilla</th><th class="ptl-th-left">Acción</th><th class="ptl-th-left">Badge en HOY</th></tr></thead><tbody>';
              for(var i=0;i<rows.length;i++){ h+='<tr><td style="padding:5px 8px;border-bottom:1px solid var(--ptl-gray-100);color:var(--ptl-gray-500);text-align:center">'+(i+1)+"</td>"; for(var j=0;j<4;j++){ h+='<td style="padding:5px 8px;border-bottom:1px solid var(--ptl-gray-100)'+(j===3?';white-space:nowrap;line-height:1.5':'')+'">'+rows[i][j]+"</td>"; } h+="</tr>"; }
              h+="</tbody></table>";
              h+='<div style="margin-top:14px;padding:10px 12px;background:var(--ptl-warning-light);border-radius:6px;font-size:12px;line-height:1.7">';
              h+="<strong>Tiempos máximos (sin ninguna respuesta) hasta RESOLVER el contrato</strong>";
              h+='<table style="width:auto;border-collapse:collapse;margin-top:6px;font-size:12px">';
              h+='<tr><td class="ptl-pad3-0">LISTADO (desde aceptación, sin listado)</td><td class="ptl-td-right34">hasta <strong>${_diaUltListado}</strong></td></tr>';
              h+='<tr><td class="ptl-pad3-0">Plazo inicial de documentación (contractual)</td><td class="ptl-td-right34"><strong>${PLAZO_DOC_INICIAL}</strong></td></tr>';
              h+='<tr><td class="ptl-pad3-0">Ampliación / prórroga (tu casilla)</td><td class="ptl-td-right34"><strong>${_pAmp}</strong></td></tr>';
              h+='<tr><td class="ptl-pad3-0">Resolución de contrato (desde disidentes)</td><td class="ptl-td-right34"><strong>${_pRes}</strong></td></tr>';
              h+='<tr style="border-top:1px solid var(--ptl-gray-300)"><td style="padding:4px 0"><strong>TOTAL desde el contacto del bot</strong></td><td style="text-align:right;padding:4px 0 4px 34px;white-space:nowrap"><strong>${_totUlt} días</strong></td></tr>';
              h+='<tr><td style="padding:4px 0"><strong>TOTAL aprox. (con LISTADO de ${_diaUltListado} d)</strong></td><td style="text-align:right;padding:4px 0 4px 34px;white-space:nowrap"><strong>${_totMax} días</strong></td></tr>';
              h+='</table>';
              h+="</div>";
              h+='<div style="font-size:11px;color:var(--ptl-gray-500);margin-top:10px;line-height:1.7"><strong>contacto</strong> = desde el contacto del bot<br><strong>ampliación</strong> = desde que pulsas «Ampliación de plazo»<br><strong>disidentes</strong> = desde que pulsas «Solicitud de disidentes»<br>Los cuatro plazos (${_pAmp}/${_pRec}/${_pDis}/${_pRes}) son EDITABLES y el esquema se recalcula solo.<br>Si se piden disidentes antes del recordatorio, este se suprime.<br>Fechas selladas: BL/BM/BN.</div>';
              h+="</div></div>";
              d.innerHTML=h; document.body.appendChild(d);
              function _cerrarEsq(){ var m=document.getElementById("ptl-esquema05"); if(m) m.style.display="none"; }
              document.getElementById("ptl-esq-cerrar").addEventListener("click", _cerrarEsq);
              d.addEventListener("click", function(e){ if(e.target===d) _cerrarEsq(); });
            };
            window.ptlAbrirEsquemaCycp = function(ev){
              if(ev){ ev.stopPropagation(); ev.preventDefault(); }
              var ex=document.getElementById("ptl-esquemaCycp"); if(ex){ ex.style.display="flex"; return; }
              var rows=${_esqRowsStr8};
              var d=document.createElement("div"); d.id="ptl-esquemaCycp"; d.style.cssText="position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px";
              var h="";
              h+='<div class="ptl-floating-window" style="width:900px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;background:var(--ptl-general-flotante,#fff);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.3)">';
              h+='<div class="ptl-floating-title"><span class="ptl-floating-title-text">📋 Tiempos · Fase 08-CYCP</span><button type="button" id="ptl-esq8-cerrar" class="ptl-floating-close" title="Cerrar">✕</button></div>';
              h+='<div class="ptl-floating-body" style="max-height:72vh;overflow:auto;color:#111">';
              h+='<table style="width:100%;border-collapse:collapse;font-size:12px">';
              h+='<thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--ptl-gray-300);width:34px">#</th><th class="ptl-th-left">Día</th><th class="ptl-th-left">Plantilla</th><th class="ptl-th-left">Acción</th><th class="ptl-th-left">Badge en HOY</th></tr></thead><tbody>';
              for(var i=0;i<rows.length;i++){ h+='<tr><td style="padding:5px 8px;border-bottom:1px solid var(--ptl-gray-100);color:var(--ptl-gray-500);text-align:center">'+(i+1)+"</td>"; for(var j=0;j<4;j++){ h+='<td style="padding:5px 8px;border-bottom:1px solid var(--ptl-gray-100)'+(j===3?';white-space:nowrap;line-height:1.5':'')+'">'+rows[i][j]+"</td>"; } h+="</tr>"; }
              h+="</tbody></table>";
              h+='<div style="margin-top:14px;padding:10px 12px;background:var(--ptl-warning-light);border-radius:6px;font-size:12px;line-height:1.7">';
              h+="<strong>Tiempos máximos (sin ninguna respuesta) hasta RESOLVER el contrato</strong>";
              h+='<table style="width:auto;border-collapse:collapse;margin-top:6px;font-size:12px">';
              h+='<tr><td class="ptl-pad3-0">Plazo inicial de firma (contractual)</td><td class="ptl-td-right34"><strong>${PLAZO_CYCP_INICIAL}</strong></td></tr>';
              h+='<tr><td class="ptl-pad3-0">Ampliación / prórroga (tu casilla)</td><td class="ptl-td-right34"><strong>${_pAmp8}</strong></td></tr>';
              h+='<tr><td class="ptl-pad3-0">Resolución de contrato (desde disidentes)</td><td class="ptl-td-right34"><strong>${_pRes8}</strong></td></tr>';
              h+='<tr style="border-top:1px solid var(--ptl-gray-300)"><td style="padding:4px 0"><strong>TOTAL desde el envío de contratos</strong></td><td style="text-align:right;padding:4px 0 4px 34px;white-space:nowrap"><strong>${_totUlt8} días</strong></td></tr>';
              h+='</table>';
              h+="</div>";
              h+='<div style="font-size:11px;color:var(--ptl-gray-500);margin-top:10px;line-height:1.7"><strong>envío</strong> = desde el envío de contratos y cartas de pago (paso a 08-CYCP)<br><strong>disidentes</strong> = desde que pulsas «Solicitud de disidentes»<br>Los plazos (${_pAmp8}/${_pRec8}/${_pDis8}/${_pRes8}) son EDITABLES y el esquema se recalcula solo.<br>Fechas selladas: BL/BM/BN (se reutilizan, se limpian al entrar en fase 08).</div>';
              h+="</div></div>";
              d.innerHTML=h; document.body.appendChild(d);
              function _cerrarEsq8(){ var m=document.getElementById("ptl-esquemaCycp"); if(m) m.style.display="none"; }
              document.getElementById("ptl-esq8-cerrar").addEventListener("click", _cerrarEsq8);
              d.addEventListener("click", function(e){ if(e.target===d) _cerrarEsq8(); });
            };
            // Auto-abrir la ventana de tiempos si se llega desde HOY con ?tiempos=05/08.
            (function(){ try { var _tq = new URLSearchParams(location.search).get('tiempos'); if(_tq==='05' && window.ptlAbrirEsquema05){ ptlAbrirEsquema05(); } else if(_tq==='08' && window.ptlAbrirEsquemaCycp){ ptlAbrirEsquemaCycp(); } } catch(e){} })();
            // Acordeón de plantillas: clic en cabecera para abrir/cerrar.
            // El botón "Guardar" solo se muestra cuando la plantilla está abierta.
            document.querySelectorAll('.ptl-acordeon').forEach(function(card){
              var cab     = card.querySelector('.ptl-acordeon-cab');
              var cuerpo  = card.querySelector('.ptl-acordeon-cuerpo');
              var flecha  = card.querySelector('.ptl-acordeon-flecha');
              var btnGuardar = card.querySelector('.ptl-acordeon-guardar');
              var chkVisible = card.querySelector('.ptl-acordeon-activa-chk');
              var chkReal    = card.querySelector('.ptl-acordeon-activa-real');
              if (!cab || !cuerpo || !flecha || !btnGuardar) return;

              function toggle(forzarAbierto){
                var abierto = (forzarAbierto !== undefined) ? forzarAbierto : (cuerpo.style.display === 'none');
                cuerpo.style.display = abierto ? 'block' : 'none';
                flecha.textContent = abierto ? '▼' : '▶';
                btnGuardar.style.display = abierto ? 'inline-block' : 'none';
              }

              cab.addEventListener('click', function(e){
                if (e.target.closest('.ptl-acordeon-guardar')) return;
                if (e.target.closest('.ptl-acordeon-activa')) return;
                toggle();
              });

              btnGuardar.addEventListener('click', function(){
                cuerpo.requestSubmit ? cuerpo.requestSubmit() : cuerpo.submit();
              });

              // Sincronizar el checkbox visible con el oculto del form (es el que se envía).
              if (chkVisible && chkReal) {
                chkVisible.addEventListener('change', function(){
                  chkReal.checked = chkVisible.checked;
                });
              }
            });
          })();
        </script>
      </div>
    `;
  }

  // =================================================================
  // VISTA: pantalla de plantillas de DOCUMENTOS (v17.82)
  // Calcada en estética a vistaPlantillas (mail): acordeones que se
  // despliegan al hacer clic, con su botón "Guardar". Diferencias:
  //  - cada documento solo tiene TÍTULO + CUERPO (sin asunto/días/cuenta)
  //  - NO hay interruptor "Activa" (la selección se hace al imprimir)
  //  - hay DOS cajas especiales: encabezado general (arriba) y pie (abajo)
  // Reutiliza las MISMAS clases .ptl-acordeon* y el MISMO script de toggle
  // que la pantalla de mail.
  // =================================================================
  function vistaPlantillasBotFlujo(plantillas, token) {
    const P = {}; plantillas.forEach(p => { P[p.clave] = p; });
    function claveOf(code) {
      if (code === "solicitud_firmada") return "pide_solicitud_firmada";
      if (code === "empadronamiento") return "pide_empadronamiento";
      const m = String(code).match(/^dni_(?:([a-z]+)_)?(delante|detras)$/);
      if (m) return "pide_dni_" + m[2];
      if (code.indexOf("bienvenida_") === 0 || code.indexOf("flujo_") === 0 || code.indexOf("aviso_") === 0 || code.indexOf("error_") === 0 || code === "doc_recibido" || code === "seguir_expediente") return code;
      return "pide_" + code;
    }
    const COMPARTIDAS = { pide_solicitud_firmada:1, pide_dni_delante:1, pide_dni_detras:1, pide_empadronamiento:1 };
    let _i = 0;
    function card(code, titulo, opts) {
      opts = opts || {};
      const clave = claveOf(code);
      const p = P[clave] || { clave: clave, texto: "", activo: true };
      const id = "fbf-" + clave + "-" + (_i++);
      const checked = p.activo ? "checked" : "";
      const compart = COMPARTIDAS[clave] ? `<div class="pbf-compart">✏️ Plantilla compartida</div>` : "";
      const opc = opts.opcional ? ` <span class="pbf-opc">opcional</span>` : "";
      return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g6">
                <span class="ptl-acordeon-flecha">▶</span>
                <span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}${opc}</span>
              </div>
            </div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap">
                <input type="checkbox" name="activo" value="1" form="${id}" ${checked}/><span>Activa</span>
              </label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="clave" value="${esc(clave)}"/>
            <input type="hidden" name="vista" value="flujo"/>
            ${compart}
            <label style="font-size:13px;display:block">
              <div class="ptl-h-tight">Texto del mensaje</div>
              <textarea name="texto" rows="6" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(p.texto || "")}</textarea>
            </label>
          </form>
        </div>`;
    }
    function twcard(clave, titulo) {
      const p = P[clave] || { clave: clave, twilio_sid:"", textoTwilio:"", activo:true, destinatario:"", variables:"" };
      const id = "fbf-tw-" + clave + "-" + (_i++);
      const checked = p.activo ? "checked" : "";
      return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="activo" value="1" form="${id}" ${checked}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="clave" value="${esc(clave)}"/>
            <input type="hidden" name="tipo" value="twilio"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:13px;display:block"><div class="ptl-fw600-lh">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 El texto lo gestiona Twilio (solo lectura).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : `<div style="color:var(--ptl-gray-400);font-style:italic;font-size:12px">(texto no disponible)</div>`}
          </form>
        </div>`;
    }
    const stack = (list) => list.map(([c,t]) => card(c, t, {})).join("");

    const HEAD = ["01 Propietario","02 Familiar","03 Inquilino","04 Local","05 Sociedad"];
    const ITEMS = [
      ["flujo_pregunta_tipo","Tipo expediente","1 / -1",2,{}],
      ["bienvenida_propietario","Bienvenida","1",3,{}],
      ["bienvenida_familiar","Bienvenida","2",3,{}],
      ["bienvenida_inquilino","Bienvenida","3",3,{}],
      ["bienvenida_local","Bienvenida","4",3,{}],
      ["bienvenida_sociedad","Bienvenida","5",3,{}],
      ["solicitud_firmada","Solicitud EMASESA","1 / -1",4,{}],
      ["dni_delante","DNI propietario · delante","1 / 5",5,{}],
      ["dni_detras","DNI propietario · detrás","1 / 5",6,{}],
      ["dni_administrador_delante","DNI administrador · delante","5",5,{}],
      ["dni_administrador_detras","DNI administrador · detrás","5",6,{}],
      ["dni_familiar_delante","DNI familiar · delante","2",7,{}],
      ["dni_inquilino_delante","DNI inquilino · delante","3",7,{}],
      ["licencia_o_declaracion","Licencia / declaración","4",9,{}],
      ["nif_sociedad","NIF sociedad","5",9,{}],
      ["dni_familiar_detras","DNI familiar · detrás","2",8,{}],
      ["dni_inquilino_detras","DNI inquilino · detrás","3",8,{}],
      ["escritura_constitucion","Escritura constitución","5",10,{}],
      ["autorizacion_familiar","Autorización familiar","2",9,{}],
      ["contrato_alquiler","Contrato alquiler","3",9,{}],
      ["poderes_representante","Poderes representante","5",11,{}],
      ["libro_familia","Libro familia","2",10,{}],
      ["empadronamiento","Empadronamiento","1 / 4",11,{opcional:true}],
    ];
    const heads = HEAD.map((h,idx) => `<div class="pbf-colhd" style="grid-column:${idx+1};grid-row:1">${esc(h)}</div>`).join("");
    const celdas = ITEMS.map(([code,titulo,col,row,opts]) =>
      `<div style="grid-column:${col};grid-row:${row}">${card(code, titulo, opts)}</div>`).join("");

    const finCards = [
      card("dni_pagador_delante","DNI pagador · delante",{}),
      card("dni_pagador_detras","DNI pagador · detrás",{}),
      card("justificante_ingresos","Justificante ingresos",{}),
      card("titularidad_bancaria","Titularidad bancaria",{}),
    ];
    // Financiacion integrada en la rejilla: bandas a lo ancho de 1-4 (Sociedad fuera: no se financia)
    const finFlujo = `
          <div style="grid-column:1 / 5;grid-row:12">${card("flujo_pregunta_financiacion","Forma de pago",{})}</div>
          <div style="grid-column:1 / 5;grid-row:13">${card("flujo_estudiar_financiacion","Bienvenida financiación",{})}</div>
          <div style="grid-column:1 / 5;grid-row:14">${finCards[0]}</div>
          <div style="grid-column:1 / 5;grid-row:15">${finCards[1]}</div>
          <div style="grid-column:1 / 5;grid-row:16">${finCards[2]}</div>
          <div style="grid-column:1 / 5;grid-row:17">${finCards[3]}</div>
          <div style="grid-column:1 / -1;grid-row:18">${card("flujo_base_completo","Expediente completo",{})}</div>`;

    const flujoEnvia = [
      card("seguir_expediente","doc - página siguiente",{}),
      card("flujo_falta_enviar","doc - falta enviar",{}),
      card("flujo_seguimos_largo","Doc - varias paginas",{}),
      card("flujo_documento_completo","doc - validado",{}),
      card("flujo_sin_opcional","doc - seguir sin opcional",{}),
    ].map(c => "<div>" + c + "</div>").join("");
    const erroresCards = stack([["error_mensaje","error - mensaje"],["error_documento","error - doc"]]);
    const _NIV = ["muy_tolerante","tolerante","normal","estricto","muy_estricto"];
    const _ETI = ["Muy tolerante","Tolerante","Normal","Estricto","Muy estricto"];
    const _filaEx = plantillas.find(p => p.clave === "exigencia_fotos");
    let _idxEx = _filaEx ? _NIV.indexOf(String(_filaEx.texto || "").trim().toLowerCase()) : 2;
    if (_idxEx < 0) _idxEx = 2;
    const exigencia = `
      <div style="border:1px solid var(--ptl-gray-200);border-radius:8px;background:var(--ptl-general-1,#1f3a5f);padding:12px 14px;max-width:760px;margin:0 auto;color:#fff">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="font-weight:600;font-size:14px">🎚️ Exigencia con los DNI en jpg</div>
          <button type="submit" form="ex-form" class="ptl-btn ptl-btn-primary ptl-shrink0">💾 Guardar</button>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.85);margin:4px 0 12px">Cómo de exigente es el bot al revisar la calidad de los DNI. Si rechaza DNI que están bien, deslízalo hacia la izquierda.</div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/exigencia")}" id="ex-form">
          <input type="hidden" name="vista" value="flujo"/>
          <input type="hidden" name="nivel" id="ex-nivel" value="${esc(_NIV[_idxEx])}"/>
          <input type="range" min="0" max="4" step="1" value="${_idxEx}" id="ex-range" class="ptl-w100"/>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.7);margin-top:2px"><span>Muy tolerante</span><span>Tolerante</span><span>Normal</span><span>Estricto</span><span>Muy estricto</span></div>
          <div style="font-size:13px;text-align:center;margin-top:8px">Seleccionado: <strong id="ex-label">${esc(_ETI[_idxEx])}</strong></div>
        </form>
        <script>
          (function(){ var r=document.getElementById("ex-range"),lbl=document.getElementById("ex-label"),hid=document.getElementById("ex-nivel");
            var NN=["muy_tolerante","tolerante","normal","estricto","muy_estricto"],EE=["Muy tolerante","Tolerante","Normal","Estricto","Muy estricto"];
            if(r)r.addEventListener("input",function(){var i=parseInt(r.value,10)||0;if(lbl)lbl.textContent=EE[i];if(hid)hid.value=NN[i];}); })();
        </script>
      </div>`;

    // v18.121: tiempos + on/off de los avisos automaticos por plazo (ajustes en bot_plantillas)
    const _avVal = (clave, def) => { const f = plantillas.find(x => x.clave === clave); if (!f) return { val: def, on: true }; const n = parseFloat(String(f.texto || "").replace(",", ".").trim()); return { val: (isNaN(n) ? def : n), on: (f.activo !== false) }; };
    const _AVDEF = {
      msg_plazo_1: "Recordatorio - Tu expediente lleva varios dias esperando:\n\n• {documento}\n\nPuedes enviarlo directamente por aqui.{extra}",
      msg_plazo_urgente: "Aviso importante - Queda poco tiempo.\n\n• {documento}\n\nEnvialo ahora por este WhatsApp para no perder el plazo.",
      msg_plazo_fuera: "ULTIMO AVISO - El plazo para tu expediente ha finalizado.\n\n• {documento}\n\nEnvialo URGENTEMENTE por este WhatsApp o tu expediente puede quedar bloqueado.",
    };
    const _avMsg = (msgClave) => { const f = plantillas.find(x => x.clave === msgClave); return (f && String(f.texto || "").trim() !== "") ? f.texto : (_AVDEF[msgClave] || ""); };
    const avcard = (tClave, msgClave, titulo, unidad, def) => { const a = _avVal(tClave, def); const id = "fbf-av-" + tClave + "-" + (_i++); return `
        <div class="ptl-card ptl-acordeon${a.on ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(tClave)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="on" value="1" form="${id}" ${a.on ? "checked" : ""}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/avisos-tiempos")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="clave" value="${esc(tClave)}"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="ptl-fw600">Cada</span><input type="number" name="val" value="${a.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-family:inherit;font-size:12px;text-align:right"/><span class="ptl-c-gray500">${unidad}</span></label>
            <label style="font-size:12px;display:block"><div class="ptl-fw600-lh">Texto del aviso</div>
              <textarea name="msg" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(_avMsg(msgClave))}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {documento} (lo que falta) y {extra} (coletilla automatica).</div>
          </form>
        </div>`; };
    const presentcard = () => { const p = P["presentacion"] || { twilio_sid:"", textoTwilio:"", destinatario:"" }; const a1 = _avVal("t_presentacion_1", 2); const a2 = _avVal("t_presentacion_2", 4); const id = "fbf-present-" + (_i++); const inactiva = (!a1.on && !a2.on) ? " ptl-acordeon-inactiva" : ""; return `
        <div class="ptl-card ptl-acordeon${inactiva}" data-clave="presentacion">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Twilio - reenvío presentación (${a1.val} y ${a2.val} días)">Twilio - reenvío presentación (${a1.val} y ${a2.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/presentacion")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Reenvío a quien no responde a la presentación</div>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="on1" value="1" ${a1.on?"checked":""}/><span class="ptl-fw600">1er reenvío a los</span><input type="number" name="val1" value="${a1.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">días</span></label>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><input type="checkbox" name="on3" value="1" ${a2.on?"checked":""}/><span class="ptl-fw600">2º reenvío a los</span><input type="number" name="val3" value="${a2.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">días</span></label>
            <label style="font-size:13px;display:block;margin-bottom:4px"><div class="ptl-fw600-lh">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 Reenvía la misma plantilla de presentación (texto gestionado por Twilio).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : ``}
          </form>
        </div>`; };
    const sleepcard = () => { const p = P["recordatorio"] || { twilio_sid:"", textoTwilio:"", destinatario:"" }; const a1 = _avVal("t_inactividad_1", 1); const a3 = _avVal("t_inactividad_2", 3); const id = "fbf-sleep-" + (_i++); const inactiva = (!a1.on && !a3.on) ? " ptl-acordeon-inactiva" : ""; return `
        <div class="ptl-card ptl-acordeon${inactiva}" data-clave="recordatorio">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Twilio - Sleep (${a1.val} y ${a3.val} días)">Twilio - Sleep (${a1.val} y ${a3.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/sleep")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Plazos en que se manda al vecino callado</div>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="on1" value="1" ${a1.on?"checked":""}/><span class="ptl-fw600">1er aviso a los</span><input type="number" name="val1" value="${a1.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">días</span></label>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><input type="checkbox" name="on3" value="1" ${a3.on?"checked":""}/><span class="ptl-fw600">2º aviso a los</span><input type="number" name="val3" value="${a3.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">días</span></label>
            <label style="font-size:13px;display:block;margin-bottom:4px"><div class="ptl-fw600-lh">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 El texto lo gestiona Twilio (solo lectura).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : `<div style="color:var(--ptl-gray-400);font-style:italic;font-size:12px">(texto no disponible)</div>`}
          </form>
        </div>`; };
    const wakecard = () => { const f = plantillas.find(x => x.clave === "msg_inactividad_1"); const texto = (f && String(f.texto || "").trim() !== "") ? f.texto : "Hola de nuevo {nombre},\n\npara completar tu expediente todavía faltan:\n{lista}\n\nRecuerda que quedan {dias} días para entregarlos.\n\nEnvíalos lo antes posible por este WhatsApp."; const on = !f || f.activo !== false; const id = "fbf-wake-" + (_i++); return `
        <div class="ptl-card ptl-acordeon${on ? "" : " ptl-acordeon-inactiva"}" data-clave="msg_inactividad_1">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Automático - Wake up">Automático - Wake up</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="activo" value="1" form="${id}" ${on ? "checked" : ""}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="clave" value="msg_inactividad_1"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:13px;display:block"><div class="ptl-fw600-lh">Texto del mensaje</div>
              <textarea name="texto" rows="6" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(texto)}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {nombre}, {lista} (lo que falta) y {dias} (dias que quedan hasta el plazo).</div>
          </form>
        </div>`; };
    const plazocard = () => { const a1 = _avVal("t_plazo_1", 10); const aU = _avVal("t_plazo_urgente", 18); const aF = _avVal("t_plazo_fuera", 20); const f = plantillas.find(x => x.clave === "msg_plazo_1"); const texto = (f && String(f.texto || "").trim() !== "") ? f.texto : "Recordatorio: tu expediente sigue pendiente.\n\n{lista}\n\nQuedan {dias} días para entregarlo todo.\nEnvíalo cuanto antes por este WhatsApp."; const on = (a1.on || aU.on || aF.on); const id = "fbf-plazo-" + (_i++); const fila = (lab, nval, nchk, a) => `<label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="${nchk}" value="1" ${a.on?"checked":""}/><span class="ptl-fw600">${lab}</span><input type="number" name="${nval}" value="${a.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">días</span></label>`; return `
        <div class="ptl-card ptl-acordeon${on ? "" : " ptl-acordeon-inactiva"}" data-clave="t_plazo_1">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Plazo - Sleep (${a1.val}, ${aU.val} y ${aF.val} días)">Plazo - Sleep (${a1.val}, ${aU.val} y ${aF.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/plazo")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Plazos (dias totales desde el inicio)</div>
            ${fila("Recordatorio a los", "val1", "on1", a1)}
            ${fila("Urgente a los", "valU", "onU", aU)}
            ${fila("Fuera de plazo a los", "valF", "onF", aF)}
            <label style="font-size:13px;display:block;margin-top:4px"><div class="ptl-fw600-lh">Texto del aviso</div>
              <textarea name="texto" rows="5" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(texto)}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {nombre}, {lista} y {dias} (dias que quedan hasta el ultimo plazo). En chat es uno solo para los tres; al vecino callado lo manda Twilio.</div>
          </form>
        </div>`; };
    const _avFinanc = `<div style="font-size:11px;color:var(--ptl-gray-500);background:#fff;border:1px solid var(--ptl-gray-200);border-radius:6px;padding:6px 8px;margin-top:6px">&bull; <strong>Listo para financiacion</strong> (financiacion_lista): mensaje directo con enlace, no es plantilla Twilio.</div>`;
    const _col = (color, titulo, contenido) => `<div><div class="pbf-av-h" style="background:var(--ptl-general-1,#1f3a5f);color:var(--ptl-titulo)">${titulo}</div>${contenido}</div>`;
    const _miniH = (color, t) => `<div style="font-weight:700;font-size:10.5px;color:${color};margin:8px 0 3px">${t}</div>`;
    // v18.99 — Tarjetas de aviso MANUAL (M1/M2): texto de WhatsApp + día de aparición.
    const wamanualcard = (which, titulo, defDias, sinDia) => {
      const a = _avVal("t_wa_" + which, defDias);
      const f = plantillas.find(x => x.clave === "msg_wa_" + which);
      const texto = (f && String(f.texto || "").trim() !== "") ? f.texto : "";
      const id = "fbf-wa" + which + "-" + (_i++);
      return `
        <div class="ptl-card ptl-acordeon" data-clave="t_wa_${which}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1"><div class="ptl-card-title ptl-flex-c-g6">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="${sinDia ? titulo : (titulo + " (día " + a.val + ")")}">${sinDia ? titulo : (titulo + " (día " + a.val + ")")}</span></div></div>
            <div class="ptl-acordeon-acciones ptl-acc-acciones-hidden">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-shrink0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/wa-manual")}" id="${id}" class="ptl-acordeon-cuerpo ptl-acc-body8">
            <input type="hidden" name="vista" value="flujo"/>
            <input type="hidden" name="which" value="${which}"/>
            ${sinDia ? `<input type="hidden" name="dias" value="0"/><div style="font-size:11px;color:var(--ptl-gray-500);margin-bottom:6px">Mensaje para el resto de avisos (atascado, pide ayuda, completo).</div>` : `<label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><span class="ptl-fw600">Aparece el día</span><input type="number" name="dias" value="${a.val}" min="0" step="1" class="ptl-input-62r"/><span class="ptl-c-gray500">desde la presentación</span></label>`}
            <label style="font-size:13px;display:block;margin-top:4px"><div class="ptl-fw600-lh">Mensaje de WhatsApp (se abre ya escrito)</div>
              <textarea name="texto" rows="5" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(texto)}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Variables: {nombre}, {comunidad}, {piso}.</div>
          </form>
        </div>`;
    };
    const cols5 =
      _col("var(--ptl-gray-500)", "📨 Avisos de flujo", flujoEnvia) +
      _col("var(--ptl-gray-500)", "📋 Avisos de resultado",
        _miniH("var(--ptl-titulo)", "📩 Acuse de recibo") + card("doc_recibido","aviso - doc recibido",{}) +
        _miniH("#2e9e5b", "✅ OK · válido") + stack([["aviso_ok","aviso - doc ok"],["aviso_ok_fin","aviso - doc ok (último)"]]) +
        _miniH("#d99a00", "⚠️ REVISAR · con dudas") + stack([["aviso_revisar","aviso - doc revisar"],["aviso_revisar_fin","aviso - doc revisar (último)"]]) +
        _miniH("#d23f3f", "❌ REPETIR · no válido") + stack([["aviso_repetir","aviso - doc repetir"],["aviso_ayuda_2","aviso - doc repetir 2"],["aviso_ayuda_3","aviso - doc repetir 3"]])) +
      _col("var(--ptl-gray-500)", "⚠️ Avisos de error", erroresCards) +
      _col("var(--ptl-gray-500)", "📲 A pisos",
        _miniH("var(--ptl-titulo)", `<span class="ptl-bot-switch ptl-bot-switch-w" style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-width:1px;border-style:solid;border-radius:3px;font-size:8px;line-height:1;vertical-align:middle;margin-right:4px">W</span>A pisos (automáticos)`) +
        presentcard() + sleepcard() + plazocard() + wakecard() +
        _miniH("var(--ptl-titulo)", `<span class="ptl-bot-switch ptl-bot-switch-m" style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-width:1px;border-style:solid;border-radius:3px;font-size:8px;line-height:1;vertical-align:middle;margin-right:4px">M</span>A pisos (manuales)`) +
        wamanualcard("m1", "Aviso M1", 5) + wamanualcard("m2", "Aviso M2", 20) + wamanualcard("m3", "Aviso M3", 0, true)) +
      _col("var(--ptl-gray-500)", "🛟 Al equipo (por evento)",
        twcard("equipo_revisar_documento","Twilio - doc a revisar") + twcard("equipo_intervencion","Twilio - falla 3 veces") + twcard("equipo_atencion_humana","Twilio - necesita un humano") + twcard("equipo_expediente_completo","Twilio - expediente completo") + _avFinanc);

    return `
      <div class="pbotflujo" style="max-width:1000px;margin:0 auto;padding:8px">
        <h2 style="font-size:18px;margin:8px 0 4px">🤖 Plantillas del bot — por flujo</h2>
        <p style="font-size:13px;color:var(--ptl-gray-500);margin:0 0 10px">El recorrido real del vecino. Lo común va en banda a lo ancho; lo propio de cada tipo, en su columna. Cada casilla se abre y se edita aquí mismo; las marcadas <em>compartida</em> cambian en todos los caminos a la vez.</p>
        <style>
          .pbotflujo .ptl-card{padding:0;margin:0 0 var(--ptl-card-gap);overflow:hidden;border:1px solid var(--ptl-gray-200);border-radius:7px;background:#fff}
          .pbotflujo .ptl-card-title{margin:0;padding:5px 8px;border-radius:0}
          .pbotflujo .ptl-acordeon-cab{padding:0}
          .pbotflujo .ptl-acordeon-inactiva,.pbotflujo .ptl-acordeon-inactiva>.ptl-acordeon-cab{background:var(--ptl-danger-light)!important;border-color:var(--ptl-danger)}
          .pbotflujo .pbf-ttl{font-size:8.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;flex:1;min-width:0;letter-spacing:.2px}
          .pbotflujo .pbf-opc{font-size:8px;border:1px solid var(--ptl-gray-300);border-radius:20px;padding:0 5px;color:var(--ptl-gray-500);font-weight:500}
          .pbf-scroll{overflow-x:auto;padding-bottom:8px}
          .pbf-grid{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:0 7px;align-items:start;min-width:760px;max-width:1000px;margin:0 auto}
          .pbf-colhd{text-align:center;font-weight:700;font-size:11px;color:#fff;background:var(--ptl-general-1,#1f3a5f);border-radius:6px;padding:5px}
          .pbf-grp{max-width:980px;margin:20px auto 8px;font-weight:700;font-size:12px;color:var(--ptl-titulo);background:var(--ptl-general-1,#1f3a5f);text-transform:uppercase;letter-spacing:.05em;border-radius:6px;padding:6px 10px;border-bottom:2px solid var(--ptl-titulo)}
          .pbf-banda-full{max-width:1000px;margin:0 auto 8px}
          .pbf-avisos3{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;max-width:900px;margin:0 auto}
          .pbf-av-col{flex:1;min-width:230px}
          .pbf-av-h{color:var(--ptl-titulo);font-weight:700;font-size:11.5px;border-radius:6px;padding:5px 8px;margin-bottom:6px}
          .pbotflujo .pbf-compart{background:var(--ptl-general-1,#1f3a5f);color:#fff;font-weight:700;font-size:11px;padding:4px 8px;border-radius:5px;margin-bottom:8px;display:inline-block}
          .pbotflujo .ptl-acordeon-activa{color:#111}
          .pbotflujo .ptl-acordeon-cuerpo label>div{color:#111}
          .pbf-subband{background:var(--ptl-general-1,#1f3a5f);color:#fff;font-weight:700;font-size:12px;border-radius:7px;padding:7px 10px;margin:0 auto 10px;max-width:980px}
          .pbf-flujo5{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;max-width:980px;margin:0 auto}
          .pbf-flujo5>div{flex:1;min-width:160px}
        </style>

        <div class="pbf-grp">Flujo</div>
        <div class="pbf-banda-full">${twcard("presentacion","Twilio - presentación")}</div>
        <div class="pbf-scroll"><div class="pbf-grid">${heads}${celdas}${finFlujo}</div></div>

        <div class="pbf-grp">Avisos</div>
        <div class="pbf-flujo5">${cols5}</div>

        <div class="pbf-grp">Exigencia con los DNI en jpg</div>
        ${exigencia}

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:14px">Todo se guarda en <code>bot_plantillas</code>.</div>

        <script>
          (function(){
            document.querySelectorAll('.pbotflujo .ptl-acordeon').forEach(function(card){
              var cab=card.querySelector('.ptl-acordeon-cab'),cuerpo=card.querySelector('.ptl-acordeon-cuerpo'),flecha=card.querySelector('.ptl-acordeon-flecha'),btnGuardar=card.querySelector('.ptl-acordeon-guardar'),acciones=card.querySelector('.ptl-acordeon-acciones');
              if(!cab||!cuerpo||!flecha||!btnGuardar)return;
              function toggle(f){var ab=(f!==undefined)?f:(cuerpo.style.display==='none');cuerpo.style.display=ab?'block':'none';flecha.textContent=ab?'▼':'▶';if(acciones)acciones.style.display=ab?'flex':'none';}
              cab.addEventListener('click',function(e){if(e.target.closest('.ptl-acordeon-guardar'))return;if(e.target.closest('.ptl-acordeon-activa'))return;toggle();});
              btnGuardar.addEventListener('click',function(){cuerpo.requestSubmit?cuerpo.requestSubmit():cuerpo.submit();});
            });
          })();
        </script>
      </div>`;
  }
  function vistaPlantillasDoc(plantillas, token) {
    // Reparte: encabezado, pie y el resto (cuerpos de documento) en su orden.
    const encab = plantillas.find(p => p.clave === "_ENCABEZADO_GLOBAL");
    const pie   = plantillas.find(p => p.clave === "_PIE_GLOBAL");
    const cuerpos = plantillas
      .filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL")
      .sort((a, b) => _ordenDoc(a.clave) - _ordenDoc(b.clave)); // v17.91: mismo orden que el menú

    const tarjetas = cuerpos.map(p => {
      const clave  = p.clave;
      const titulo = p.titulo || clave;
      return `
        <div class="ptl-card ptl-acordeon" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div class="ptl-flex-1">
              <div class="ptl-card-title ptl-flex-c-g8">
                <span class="ptl-acordeon-flecha">▶</span>
                <span>📄 ${esc(titulo)}</span>
              </div>
            </div>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body68">
            <input type="hidden" name="clave" value="${esc(clave)}"/>

            <label style="font-size:13px;display:block;margin-bottom:6px">
              <div class="ptl-h-tight">Título</div>
              <input type="text" name="titulo" value="${esc(p.titulo || "")}" class="ptl-input-sm ptl-w100"/>
            </label>

            <label style="font-size:13px;display:block">
              <div class="ptl-h-tight">Cuerpo del documento</div>
              <textarea name="cuerpo" rows="8" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(p.cuerpo || "")}</textarea>
            </label>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:4px 0 0 0">
              Los huecos entre corchetes (por ejemplo <code>[propietario]</code>, <code>[comunidad]</code>) se rellenarán al generar el documento.
            </div>
          </form>
        </div>
      `;
    }).join("");

    // Caja especial: ENCABEZADO GENERAL (arriba)
    const cajaEncab = `
      <div class="ptl-card ptl-acordeon" data-clave="_ENCABEZADO_GLOBAL" style="border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab">
          <div class="ptl-flex-1">
            <div class="ptl-card-title ptl-flex-c-g8">
              <span class="ptl-acordeon-flecha">▶</span>
              <span>📝 Encabezado general</span>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que aparecerá al PRINCIPIO de TODOS los documentos (antes del cuerpo).</div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
        </div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body8">
          <input type="hidden" name="clave" value="_ENCABEZADO_GLOBAL"/>
          <input type="hidden" name="titulo" value="${esc(encab ? encab.titulo : "Encabezado general")}"/>
          <textarea name="cuerpo" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(encab ? encab.cuerpo : "")}</textarea>
        </form>
      </div>
    `;

    // Caja especial: PIE GENERAL (abajo)
    const cajaPie = `
      <div class="ptl-card ptl-acordeon" data-clave="_PIE_GLOBAL" style="border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab">
          <div class="ptl-flex-1">
            <div class="ptl-card-title ptl-flex-c-g8">
              <span class="ptl-acordeon-flecha">▶</span>
              <span>📝 Pie general</span>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que aparecerá al FINAL de TODOS los documentos (después del cuerpo). El hueco <code>[fecha]</code> se rellena solo con la fecha de hoy.</div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar ptl-acc-guardar-hidden">💾 Guardar</button>
        </div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo ptl-acc-body8">
          <input type="hidden" name="clave" value="_PIE_GLOBAL"/>
          <input type="hidden" name="titulo" value="${esc(pie ? pie.titulo : "Pie general")}"/>
          <textarea name="cuerpo" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(pie ? pie.cuerpo : "")}</textarea>
        </form>
      </div>
    `;

    return `
      <div style="max-width:760px;margin:0 auto;padding:8px">
        <h2 style="font-size:18px;margin:8px 0 4px">📄 Plantillas de documentos</h2>
        <p style="font-size:13px;color:var(--ptl-gray-500);margin:0 0 12px">
          Aquí editas los textos de los documentos de EMASESA. El <strong>encabezado</strong> y el <strong>pie</strong> son comunes a todos; cada documento tiene su propio <strong>cuerpo</strong>.
          Los cambios se aplican inmediatamente — no hay que reiniciar nada.
        </p>
        ${cajaEncab}
        ${tarjetas}
        ${cajaPie}

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:12px">
          Los datos se guardan en la pestaña <code>doc_plantillas</code> del Sheet.
        </div>

        <script>
          (function(){
            // Acordeón: clic en cabecera abre/cierra; "Guardar" solo visible si está abierto.
            document.querySelectorAll('.ptl-acordeon').forEach(function(card){
              var cab     = card.querySelector('.ptl-acordeon-cab');
              var cuerpo  = card.querySelector('.ptl-acordeon-cuerpo');
              var flecha  = card.querySelector('.ptl-acordeon-flecha');
              var btnGuardar = card.querySelector('.ptl-acordeon-guardar');
              if (!cab || !cuerpo || !flecha || !btnGuardar) return;

              function toggle(forzarAbierto){
                var abierto = (forzarAbierto !== undefined) ? forzarAbierto : (cuerpo.style.display === 'none');
                cuerpo.style.display = abierto ? 'block' : 'none';
                flecha.textContent = abierto ? '▼' : '▶';
                btnGuardar.style.display = abierto ? 'inline-block' : 'none';
              }

              cab.addEventListener('click', function(e){
                if (e.target.closest('.ptl-acordeon-guardar')) return;
                toggle();
              });

              btnGuardar.addEventListener('click', function(){
                cuerpo.requestSubmit ? cuerpo.requestSubmit() : cuerpo.submit();
              });
            });
          })();
        </script>
      </div>
    `;
  }

  // =================================================================
  // Extrae el "nombre de calle" de una dirección quitando el número/escalera del final.
  // Ejemplos:
  //   "Alberche 17"          → "Alberche"
  //   "Alberche 6C"          → "Alberche"
  //   "Doctor Marañón 11, esc. A" → "Doctor Marañón"
  //   "Estrella Aldebaran 4" → "Estrella Aldebaran"
  //   "Plaza España s/n"     → "Plaza España"
  function extraerNombreCalle(direccion) {
    if (!direccion) return "";
    let s = String(direccion).trim();
    if (!s) return "";
    // Cortar por la primera coma (todo lo que viene después suele ser escalera/portal/etc)
    const comaIdx = s.indexOf(",");
    if (comaIdx > 0) s = s.slice(0, comaIdx).trim();
    // Quitar tokens del final mientras contengan dígitos o sean palabras tipo s/n, esc, bloque, portal, bis
    const tokens = s.split(/\s+/);
    const palabrasNumericas = /^(s\/n|s\.n\.|esc\.?|escalera|bloque|portal|bis|nº|nro\.?|num\.?|num)$/i;
    while (tokens.length > 1) {
      const ult = tokens[tokens.length - 1];
      if (/\d/.test(ult) || palabrasNumericas.test(ult)) {
        tokens.pop();
      } else {
        break;
      }
    }
    return tokens.join(" ").trim();
  }

  function construirDatalists(comunidades) {
    const admins = new Set(), presis = new Set(), tiposVia = new Set(), calles = new Set();
    // adminInfo: { "Nombre Admin": { telefono: "...", email: "...", ccpps: [{ ccpp_id, direccion }, ...] } }
    const adminInfo = {};
    comunidades.forEach(c => {
      if (c.administrador && String(c.administrador).trim()) {
        const nombre = String(c.administrador).trim();
        admins.add(nombre);
        if (!adminInfo[nombre]) {
          adminInfo[nombre] = { telefono: "", email: "", ccpps: [] };
        }
        // El primer telefono/email no vacío que encontremos se queda como "el del admin"
        if (!adminInfo[nombre].telefono && c.telefono_administrador) {
          adminInfo[nombre].telefono = String(c.telefono_administrador).trim();
        }
        if (!adminInfo[nombre].email && c.email_administrador) {
          adminInfo[nombre].email = String(c.email_administrador).trim();
        }
        adminInfo[nombre].ccpps.push({ ccpp_id: c.ccpp_id, direccion: c.direccion || c.comunidad });
      }
      if (c.presidente && String(c.presidente).trim()) presis.add(String(c.presidente).trim());
      if (c.tipo_via && String(c.tipo_via).trim()) tiposVia.add(String(c.tipo_via).trim());
      // Extraer nombre de calle (sin número/escalera)
      const calle = extraerNombreCalle(c.direccion);
      if (calle) calles.add(calle);
    });
    return {
      admins: [...admins].sort(),
      presis: [...presis].sort(),
      tiposVia: [...tiposVia].sort(),
      calles: [...calles].sort(),
      adminInfo,
    };
  }

  // =================================================================
  // GUARD: ADMIN_TOKEN (igual que index.cjs)
  // =================================================================
  function checkToken(req, res) {
    if (!process.env.ADMIN_TOKEN) {
      // Si no hay ADMIN_TOKEN definido en el entorno, permitir acceso (modo dev)
      return true;
    }
    // Token desde la URL o, si no viene, desde la cookie (para la app instalada / PWA sin token en la URL).
    let token = req.query.token;
    if (!token && req.headers && req.headers.cookie) {
      const _m = /(?:^|;\s*)ara_token=([^;]+)/.exec(req.headers.cookie);
      if (_m) { try { token = decodeURIComponent(_m[1]); } catch (e) { token = _m[1]; } }
    }
    if (!validToken(token)) {
      res.status(403).type("text/plain").send("No autorizado. Añade ?token=TUTOKEN a la URL.");
      return false;
    }
    // Si el token vino por la URL y es valido, lo recordamos en una cookie (1 año) para que la app instalada abra sin token en la URL.
    if (req.query.token && res && !res.headersSent) {
      try { res.setHeader("Set-Cookie", "ara_token=" + encodeURIComponent(req.query.token) + "; Path=/; Max-Age=31536000; SameSite=Lax"); } catch (e) {}
    }
    return true;
  }

  // =================================================================
  // RUTAS HTTP
  // =================================================================

  // GET /presupuestos — listado
  // ===== PWA: abrir como app a pantalla completa en tablet/movil =====
  // Iconos y manifest son publicos (no llevan checkToken). El manifest refleja el token
  // recibido en start_url para que, al instalar desde una sesion con token, la app abra autenticada.
  const _ARA_ICON_192 = Buffer.from("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", "base64");
  const _ARA_ICON_512 = Buffer.from("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", "base64");
  app.get("/araujo-icon-192.png", (req, res) => { res.set("Cache-Control", "public, max-age=31536000"); res.type("png").send(_ARA_ICON_192); });
  app.get("/araujo-icon-512.png", (req, res) => { res.set("Cache-Control", "public, max-age=31536000"); res.type("png").send(_ARA_ICON_512); });
  app.get("/manifest.webmanifest", (req, res) => {
    res.type("application/manifest+json").send(JSON.stringify({
      name: "Araujo Presupuestos",
      short_name: "Araujo",
      description: "Gestor de presupuestos Araujo",
      start_url: "/presupuestos",
      scope: "/",
      display: "standalone",
      orientation: "any",
      background_color: "#ffffff",
      theme_color: "#004178",
      icons: [
        { src: "/araujo-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/araujo-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/araujo-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    }));
  });

  app.get("/presupuestos", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const comunidades = await leerComunidades();
      const html = pageHtml("Listado de presupuestos",
        [{ label: "Presupuestos", url: "#" }],
        await vistaListado(comunidades, req.query, token),
        token, { search: true, searchValue: (req.query.q || ""), cron: true });
      sendHtml(res, html);
    } catch (e) {
      console.error("[presupuestos] /presupuestos error:", e.message);
      sendError(res, "Error cargando presupuestos: " + e.message);
    }
  });

  // GET /presupuestos/nuevo — formulario nuevo
  app.get("/presupuestos/nuevo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    let tiposVia = ["C", "Av", "Bª", "Pz", "Pza", "Rª", "Ur", "Cm", "Pje", "Bda", "Crta"];
    let admins = [], presis = [], calles = [], adminInfo = {};
    try {
      const comunidades = await leerComunidades();
      const dl = construirDatalists(comunidades);
      const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
      tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
      admins = dl.admins;
      presis = dl.presis;
      calles = dl.calles;
      adminInfo = dl.adminInfo;
    } catch (e) {
      console.warn("[presupuestos] no se pudieron leer datos:", e.message);
    }
    sendHtml(res, pageHtml("Nuevo expediente",
      [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
      vistaNuevo(req.query.error || "", token, tiposVia, admins, presis, calles, req.query.dir || "", adminInfo),
      token));
  });

  // POST /presupuestos/nuevo — crear (con validación de duplicado)
  app.post("/presupuestos/nuevo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    const errPage = (mensaje, datos) => {
      // Recargar listas para reconstruir el formulario
      return (async () => {
        let tiposVia = ["C", "Av", "Bª", "Pz", "Pza", "Rª", "Ur"];
        let admins = [], presis = [], calles = [], adminInfo = {};
        try {
          const comunidades = await leerComunidades();
          const dl = construirDatalists(comunidades);
          const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
          tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
          admins = dl.admins; presis = dl.presis; calles = dl.calles; adminInfo = dl.adminInfo;
        } catch (e) {}
        sendHtml(res, pageHtml("Nuevo expediente",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
          vistaNuevo(mensaje, token, tiposVia, admins, presis, calles, datos, adminInfo),
          token));
      })();
    };
    try {
      const dir = String(req.body.direccion || "").trim();
      if (!dir) {
        return errPage("La dirección es obligatoria", "");
      }
      // Validar duplicado: comparar normalizado (insensible a tildes/mayúsculas y espacios extra)
      const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      const dirNorm = norm(dir);
      const comunidades = await leerComunidades();
      const duplicado = comunidades.find(c => norm(c.direccion) === dirNorm);
      if (duplicado) {
        return errPage(`Ya existe un expediente con la dirección "${duplicado.direccion}". Cambia la dirección (añade número, escalera, portal, etc.) para diferenciarlo.`, dir);
      }
      // Validación de emails (sin acentos, formato correcto)
      const emailAdmin = String(req.body.email_administrador || "").trim();
      const emailPresi = String(req.body.email_presidente || "").trim();
      if (!esEmailValido(emailAdmin)) {
        return errPage(`Email del administrador no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld`, dir);
      }
      if (!esEmailValido(emailPresi)) {
        return errPage(`Email del presidente no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld`, dir);
      }
      const datos = {
        comunidad: dir,                    // Auto-rellenado con la dirección
        direccion: dir,
        tipo_via: req.body.tipo_via || "",
        poblacion: String(req.body.poblacion || "").trim(),
        cp: String(req.body.cp || "").trim(),
        earth: "",   // v18.02: nace SIN coordenada (antes ponía "NO"). Se geocodificará/ubicará en el mapa.
        administrador: req.body.administrador || "",
        telefono_administrador: String(req.body.telefono_administrador || "").replace(/\D/g, ""),
        email_administrador: emailAdmin,
        presidente: req.body.presidente || "",
        telefono_presidente: String(req.body.telefono_presidente || "").replace(/\D/g, ""),
        email_presidente: emailPresi,
        fase_presupuesto: "01_CONTACTO",
        fecha_contacto: new Date().toISOString().slice(0, 10),
      };
      await crearComunidad(datos);
      // Crear carpeta del expediente en Drive (no bloqueante).
      try {
        await getOrCreateCarpetaExpediente(datos.tipo_via, datos.direccion);
      } catch (errDrive) {
        console.error("[presupuestos] Error creando carpeta Drive (no bloquea creación expediente):", errDrive.message);
      }
      res.redirect(urlT(token, "/presupuestos/expediente", { id: ccppId(dir), creado: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /nuevo:", e.message);
      sendError(res, "Error creando: " + e.message);
    }
  });

  // GET /presupuestos/expediente?id=...
  app.get("/presupuestos/expediente", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const id = req.query.id;
      const comunidades = await leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) {
        return sendHtml(res, pageHtml("No encontrado",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "—", url: "#" }],
          `<div class="ptl-empty"><h3>Expediente no encontrado</h3></div>`,
          token));
      }
      // Si el CCPP ya está en una fase del módulo documentación, redirigir allí.
      // v17.52: excepción si vienen accion_mail + mid (clic en ↩/↪ desde HOY):
      // la ficha de presupuestos es la única que tiene listado de
      // comunicaciones con el modal de responder/reenviar, así que la
      // renderizamos aunque la CCPP esté en fase 05+. El auto-disparo abrirá
      // el modal y al guardar/cancelar el usuario navegará normalmente.
      const faseActual = normalizarFase(comu.fase_presupuesto);
      // v17.65: también redirigimos en 09_TRAMITADA para que se inyecte la tabla DATOS DOCUMENTACION.
      if ((FASES_DOCUMENTACION.includes(faseActual) || faseActual === "09_TRAMITADA") && !req.query.accion_mail) {
        return res.redirect(urlT(token, "/documentacion/expediente", { id }));
      }
      const datalists = construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";
      const cabecera = renderCabeceraComun(token, comunidades, { mapaId: comu.ccpp_id, searchInHeader: true });
      sendHtml(res, pageHtml(titulo,
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        cabecera + (await vistaFicha(comu, datalists, token, reciencreado)),
        token, { expedienteId: comu.ccpp_id, expedienteDir: labelExp, expedienteFase: normalizarFase(comu.fase_presupuesto), search: true, searchValue: (req.query.q || ""), cron: true, undo: true }));
    } catch (e) {
      console.error("[presupuestos] /expediente:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/campo — auto-guardado de un campo
  app.post("/presupuestos/expediente/campo", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const campo = req.body.campo;
      let valor = req.body.valor;
      if (!COLS.includes(campo)) return res.status(400).send("Campo no permitido");
      // Numéricos
      const numericos = new Set(["pto_total","mano_obra_previsto","mano_obra_real",
        "material_previsto","material_real","beneficio_previsto","beneficio_real","beneficio_desvio",
        "tiempo_previsto","tiempo_real","tiempo_desvio"]);
      if (numericos.has(campo)) {
        if (valor === "" || valor == null) valor = "";
        else {
          // v17.38 BUG 1: parser robusto formato ES.
          // El caso normal: el cliente (ptlValorPlano) envía un número plano "1234.56" o
          // un número nativo. Pero si por cualquier vía llega "1.234,56" (formato ES con
          // separador de miles + decimal con coma), el parseFloat ingenuo lo trunca a 1.23.
          // Aplicamos la misma lógica que ptlNum del frontend:
          //   - si hay '.' y ',' → quitar puntos (miles) y cambiar coma por punto
          //   - si solo hay coma → cambiarla por punto
          //   - si solo hay puntos → dejarlos (es decimal o entero ya correcto)
          let txt = String(valor).trim().replace(/€|\s/g, "");
          if (txt.indexOf('.') !== -1 && txt.indexOf(',') !== -1) {
            txt = txt.replace(/\./g, '').replace(',', '.');
          } else {
            txt = txt.replace(',', '.');
          }
          const n = parseFloat(txt);
          if (isNaN(n)) {
            valor = "";
          } else {
            // v17.38 BUG 3: validación de rango razonable. Evita el caso Diego Puerta
            // donde se coló tiempo_previsto = 16298.1 por error de tecleo, sin que nada
            // saltara. Rangos amplios pensados para no entorpecer trabajo legítimo.
            const RANGOS = {
              pto_total:           [0, 500000],
              mano_obra_previsto:  [0, 500000],
              mano_obra_real:      [0, 500000],
              material_previsto:   [0, 500000],
              material_real:       [0, 500000],
              beneficio_previsto:  [-50000, 500000],
              beneficio_real:      [-50000, 500000],
              beneficio_desvio:    [-500000, 500000],
              tiempo_previsto:     [0, 365],
              tiempo_real:         [0, 365],
              tiempo_desvio:       [-1, 1],
            };
            const r = RANGOS[campo];
            if (r && (n < r[0] || n > r[1])) {
              return res.status(400).json({
                error: `Valor fuera de rango para ${campo}: ${n}. Rango permitido: ${r[0]} a ${r[1]}. ` +
                       `Si quieres meter ese valor de verdad, avisa para ampliar el rango.`
              });
            }
            valor = n;
          }
        }
      }
      // Teléfonos: solo dígitos
      if (campo === "telefono_administrador" || campo === "telefono_presidente") {
        valor = String(valor || "").replace(/\D/g, "");
      }
      // Emails: validar formato (sin acentos, sin espacios)
      if (campo === "email_administrador" || campo === "email_presidente") {
        valor = String(valor || "").trim();
        if (!esEmailValido(valor)) {
          return res.status(400).json({ error: "Email no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld" });
        }
      }
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      // v17.79 — Guardado de UN campo suelto: usar actualizarCampoComunidad, que
      // escribe SOLO esa celda y RELEE para verificar (lanza error si no cuajó).
      // Antes usaba actualizarComunidad (reescribía la fila entera, sin verificar):
      // por eso un campo podía salir verde en el front pero no quedar en el Sheet.
      // Los guardados que cambian VARIOS campos a la vez (avance de fase, cron, etc.)
      // siguen usando actualizarComunidad (pendiente: blindarlos en una 2ª fase).
      await actualizarCampoComunidad(comu._rowIndex, campo, valor);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /campo:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.52: POST /presupuestos/piso/toggle-hoy
  // Body: { ccpp_id, vivienda }
  // Alterna en_hoy del piso entre "1" y "". Side-effect: si pasa a "1" y el
  // expediente padre no tiene en_hoy="1", lo activa también (regla: activar un
  // piso obliga a activar su expediente para que aparezca en HOY como cabecera).
  // Quitar un piso NO desactiva al expediente padre (el padre puede seguir
  // estando activo por sí mismo o por otros pisos).
  app.post("/presupuestos/piso/toggle-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      // Leer el valor actual de en_hoy para alternarlo
      const sheets = getSheetsClient();
      const cab = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "pisos!1:1" });
      const hdr = (cab.data.values && cab.data.values[0]) || [];
      const idxEnHoy = hdr.indexOf("en_hoy");
      if (idxEnHoy < 0) return res.status(500).json({ error: "Columna 'en_hoy' no encontrada en pisos (¿añadida al Sheet?)" });
      const letra = (() => {
        let s = "", n = idxEnHoy + 1;
        while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
        return s;
      })();
      const cellRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `pisos!${letra}${rowIdx}` });
      const valorActual = ((cellRes.data.values || [[]])[0] || [])[0] || "";
      const nuevoValor = String(valorActual).trim() === "1" ? "" : "1";
      await _actualizarCampoPiso(rowIdx, "en_hoy", nuevoValor);
      // Si encendemos un piso y el expediente padre no estaba en HOY, lo activamos.
      if (nuevoValor === "1" && String(comu.en_hoy || "").trim() !== "1") {
        comu.en_hoy = "1";
        try {
          await actualizarComunidad(comu._rowIndex, comu);
        } catch (e) {
          console.warn("[piso/toggle-hoy] no se pudo activar expediente padre:", e.message);
        }
      }
      res.json({ ok: true, en_hoy: nuevoValor });
    } catch (e) {
      console.error("[presupuestos] /piso/toggle-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v18.77: POST /presupuestos/piso/modo-bot
  // Body: { ccpp_id, vivienda, modo }  (modo = "MANUAL" | "BOT_WHATSAPP")
  // Cambia el interruptor del bot WhatsApp de un piso (columna AV bot_piso_activo).
  app.post("/presupuestos/piso/modo-bot", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const modo = String(req.body.modo || "").toUpperCase();
      const enviarPresentacion = ["1","true","si","sí","on","yes"].includes(String(req.body.enviar_presentacion || "").toLowerCase());
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      if (modo !== "MANUAL" && modo !== "BOT_WHATSAPP") {
        return res.status(400).json({ error: "Valor no válido (MANUAL | BOT_WHATSAPP)" });
      }
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "bot_piso_activo", modo);

      // Automático: al poner un vecino en BOT (W), la comunidad pasa a BOT sola,
      // para que nunca queden descuadrados (el candado impide el caso inverso).
      if (modo === "BOT_WHATSAPP" && String(comu.bot_comunidad_activo || "").toUpperCase() !== "BOT_WHATSAPP" && comu._rowIndex) {
        try { await actualizarCampoComunidad(comu._rowIndex, "bot_comunidad_activo", "BOT_WHATSAPP"); }
        catch (e) { console.error("[piso/modo-bot] auto-flip comunidad:", e.message); }
      }

      // v18.78: si se activa el bot (M->W) y se pidio, enviar la presentacion a
      // ESE piso (lo hace bot-whatsapp.cjs via app.locals; no reenvia si ya hay ficha).
      let presentacion = null;
      if (modo === "BOT_WHATSAPP" && enviarPresentacion) {
        const bot = app.locals.botWhatsapp;
        if (bot && typeof bot.enviarPresentacionPiso === "function") {
          try {
            const sheetsP = getSheetsClient();
            const relP = await sheetsP.spreadsheets.values.get({
              spreadsheetId: SHEET_ID, range: `pisos!A${rowIdx}:E${rowIdx}`,
            });
            const filaP = (relP.data.values && relP.data.values[0]) || [];
            const telefono = filaP[0] || "";
            const nombre = filaP[4] || "";
            presentacion = await bot.enviarPresentacionPiso(telefono, {
              comunidad: comu.direccion || comu.comunidad, vivienda, nombre,
            });
          } catch (e) {
            presentacion = { ok: false, estado: "error", error: e.message };
          }
        } else {
          presentacion = { ok: false, estado: "bot_no_disponible" };
        }
      }
      res.json({ ok: true, modo, presentacion });
    } catch (e) {
      console.error("[presupuestos] /piso/modo-bot:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.52: POST /presupuestos/piso/guardar-notas-hoy
  // Body: { ccpp_id, vivienda, notas }
  // Guarda notas_piso para un piso concreto. Llamado en blur desde la caja
  // "Expedientes en HOY" cuando el usuario edita las notas inline.
  app.post("/presupuestos/piso/guardar-notas-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const notas = String(req.body.notas == null ? "" : req.body.notas);
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "notas_piso", notas);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /piso/guardar-notas-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.67: POST /presupuestos/piso/guardar-nota-simple
  // Body: { ccpp_id, vivienda, nota_simple }
  // Guarda nota_simple (columna D de pestaña pisos) para un piso concreto.
  // Usado desde el acordeón de la fila piso en DATOS DOCUMENTACION
  // (documentacion.cjs v17.23+).
  app.post("/presupuestos/piso/guardar-nota-simple", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const nota_simple = String(req.body.nota_simple == null ? "" : req.body.nota_simple);
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "nota_simple", nota_simple);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /piso/guardar-nota-simple:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/expediente/avanzar
  app.post("/presupuestos/expediente/avanzar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      // Buscar definición de la fase actual: primero en PTO_FASES, luego
      // en las fases del módulo documentación.
      const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
      if (def && def.siguiente) {
        comu.fase_presupuesto = def.siguiente;
        const hoy = new Date().toISOString().slice(0, 10);
        // Si se sale de 02_VISITA sin fecha de visita rellenada, ponemos la de hoy como fallback
        if (fase === "02_VISITA" && !comu.fecha_visita) comu.fecha_visita = hoy;
        // Mismo fallback al salir de 06_VISITA_EMASESA
        if (fase === "06_VISITA_EMASESA" && !comu.fecha_visita_emasesa) comu.fecha_visita_emasesa = hoy;
        // Al salir de 05_DOCUMENTACION marcamos la fecha de cierre = hoy
        if (fase === "05_DOCUMENTACION" && !comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
        // Al salir de 07_PTE_CYCP (paso a 08_CYCP) marcamos fecha_envio_contratos_pagos = hoy.
        // Esa fecha representa el día en que se envió el mail de contratos y cartas de pago,
        // y es la fecha que pinta el círculo 07 en la línea de tiempo.
        if (fase === "07_PTE_CYCP" && !comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
        // Al entrar en 08_CYCP limpiamos las fechas selladas del ultimátum (BL/BM/BN)
        // para reutilizarlas en el ultimátum de fase 08. Las de fase 05 ya no valen.
        if (fase === "07_PTE_CYCP") {
          comu.fecha_ultimatum_ampliado = "";
          comu.fecha_disidentes_solicitados = "";
          comu.fecha_contrato_resuelto = "";
        }
        // fecha_envio_pto YA NO se rellena al entrar en 03_ENVIO_PTO: se rellena al confirmar el envío del mail
        if (def.siguiente === "04_ACEPTACION_PTO" && !comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        await actualizarComunidad(comu._rowIndex, comu);
        // Inicializar estados manuales al ENTRAR en fase 05 o al entrar en 08_CYCP
        // (en 08 es cuando aparecen ccpp_contrato/pago y piso_contrato/pago como
        // activos en la cajita). 07_PTE_CYCP es solo una fase de espera, sin docs.
        if (def.siguiente === "05_DOCUMENTACION" || def.siguiente === "08_CYCP") {
          try {
            const D = app.locals.documentacion;
            if (D && D.inicializarEstadosFase) {
              await D.inicializarEstadosFase(comu, def.siguiente);
            }
          } catch (e) {
            console.warn("[presupuestos] inicializarEstadosFase " + def.siguiente + " falló:", e.message);
          }
        }
      }
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) {
      console.error("[presupuestos] /avanzar:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/retroceder
  // Retrocede el expediente a la fase anterior. body: id, conservar ("1"|"0").
  // Si conservar="0", limpia las fechas/contadores asociados a la fase ACTUAL
  // (la que se está abandonando). Si conservar="1", solo cambia la fase.
  app.post("/presupuestos/expediente/retroceder", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const conservar = String(req.body.conservar || "1") === "1";
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      const faseAnt = calcularFaseAnterior(fase);
      if (!faseAnt) {
        const token = req.query.token || "";
        return res.redirect(urlT(token, "/presupuestos/expediente", { id }));
      }
      comu.fase_presupuesto = faseAnt;

      if (!conservar) {
        // Limpiar datos asociados a la fase de la que se sale.
        // Mapeo conservador: solo se borran campos directamente ligados a esa fase.
        // v17.49: también se borra `fecha_limite_documentacion_vecinos` al
        // retroceder DE 02 (vuelve a 01) y DE 04 (vuelve a 03). El campo se
        // rellena al iniciar 01 (primer mail manual) y al iniciar 04 (envío
        // del presupuesto desde 03). Si retrocedes, hay que borrarlo para
        // que al volver a iniciar la fase se recalcule con la fecha real.
        if (fase === "01_CONTACTO")        { comu.fecha_proximo_mail_manual = ""; }
        if (fase === "02_VISITA")          {
          comu.fecha_visita = "";
          // v17.49: al volver a 01, borramos también BC (la fecha límite que
          // se calculó al iniciar 01). Al rehacer el primer mail en 01 se
          // recalculará con la fecha actual.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "03_ENVIO_PTO")       { comu.fecha_envio_pto = ""; }
        if (fase === "04_ACEPTACION_PTO")  {
          comu.fecha_aceptacion_pto = "";
          comu.fecha_ultimo_seguimiento_pto = "";
          comu.fecha_ultimo_reenvio_pto = "";
          comu.fecha_proximo_mail_manual = "";
          // v17.49: al volver a 03, borramos también BC (la fecha límite que
          // se calculó al pasar de 03 a 04 vía envío del presupuesto). Al
          // reenviar el presupuesto se recalculará con la fecha actual.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "05_DOCUMENTACION")   {
          comu.fecha_documentacion_completa = "";
          // Importante: al retroceder de 05, hay que borrar también la fecha
          // límite calculada al pulsar ACEPTADO (hoy+20). Si no, al volver a
          // entrar a 05 el cron no la recalcula porque la guardia
          // `if (!comu.fecha_limite_documentacion_vecinos)` la conserva, y el
          // mail saldría con una fecha más cercana de lo previsto.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "06_VISITA_EMASESA")  { comu.fecha_visita_emasesa = ""; }
        if (fase === "07_PTE_CYCP")        { comu.fecha_envio_contratos_pagos = ""; }
        if (fase === "08_CYCP")            { comu.fecha_cycp_completa = ""; }

        // Borrar contadores de mails de esa fase
        try {
          const enviados = parsearMailJson(comu.mails_enviados);
          const manuales = parsearMailJson(comu.mails_manuales);
          const ultimo   = parsearMailJson(comu.mails_ultimo_envio);
          if (enviados[fase] !== undefined) { delete enviados[fase]; comu.mails_enviados = JSON.stringify(enviados); }
          if (manuales[fase] !== undefined) { delete manuales[fase]; comu.mails_manuales = JSON.stringify(manuales); }
          if (ultimo[fase] !== undefined)   { delete ultimo[fase];   comu.mails_ultimo_envio = JSON.stringify(ultimo); }
          // v18.41: caso especial 04 -> 03. El envío del presupuesto siembra DOS
          // claves: 03_ENVIO_PTO (su etapa de origen, rastro histórico) y
          // 04_ACEPTACION_PTO (manual nº1 del seguimiento). Al retroceder de 04
          // borramos arriba la clave 04, pero la 03 quedaba huérfana: si luego se
          // reenviaba el presupuesto, nuevoCount = enviados["03"]+1 = 2 -> conteo
          // descuadrado. Al volver a 03 limpiamos también la clave 03 en las tres
          // columnas, para que el reenvío del presupuesto arranque limpio en 1.
          if (fase === "04_ACEPTACION_PTO") {
            if (enviados["03_ENVIO_PTO"] !== undefined) { delete enviados["03_ENVIO_PTO"]; comu.mails_enviados = JSON.stringify(enviados); }
            if (manuales["03_ENVIO_PTO"] !== undefined) { delete manuales["03_ENVIO_PTO"]; comu.mails_manuales = JSON.stringify(manuales); }
            if (ultimo["03_ENVIO_PTO"] !== undefined)   { delete ultimo["03_ENVIO_PTO"];   comu.mails_ultimo_envio = JSON.stringify(ultimo); }
          }
        } catch (e) { /* nada */ }
      }

      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) {
      console.error("[presupuestos] /retroceder:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/aceptar
  app.post("/presupuestos/expediente/aceptar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      // El CCPP sale de presupuestos y entra en el módulo documentacion.
      // 05_DOCUMENTACION es la primera fase de ese módulo.
      comu.fase_presupuesto = "05_DOCUMENTACION";
      comu.decision_pto = "ACEPTADO";
      comu.fecha_aceptacion_pto = new Date().toISOString().slice(0, 10);
      await actualizarComunidad(comu._rowIndex, comu);
      // Inicializar estados manuales al entrar en la fase. Se hace después
      // de actualizar para que la fase nueva ya esté guardada.
      try {
        const D = app.locals.documentacion;
        if (D && D.inicializarEstadosFase) {
          await D.inicializarEstadosFase(comu, "05_DOCUMENTACION");
        }
      } catch (e) {
        console.warn("[presupuestos] inicializarEstadosFase 05 falló:", e.message);
      }
      const token = req.query.token || "";
      // El CCPP ya pertenece al módulo documentación: redirigir allí.
      res.redirect(urlT(token, "/documentacion/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/rechazar
  app.post("/presupuestos/expediente/rechazar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      // Guardar la fase en la que estaba para poder restaurarla al reactivar (col BK fase_antes_descarte).
      // (Igual que descartar: sin esto, al reactivar no había "a dónde volver" y se perdían las fechas.)
      try {
        const _fa = normalizarFase(comu.fase_presupuesto);
        if (_fa && _fa !== "ZZ_DESCARTADO" && _fa !== "ZZ_RECHAZADO") {
          const _sh = getSheetsClient();
          await _sh.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `comunidades!BK${comu._rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [[_fa]] },
          });
        }
      } catch (_) {}
      comu.fase_presupuesto = "ZZ_RECHAZADO";
      comu.decision_pto = "RECHAZADO";
      comu.fecha_aceptacion_pto = new Date().toISOString().slice(0, 10);
      comu.motivo_rechazo = String(req.body.motivo || "").trim();
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/cerrar-cycp — cierra la fase 08-CYCP (final).
  // Solo válido si el CCPP está en fase 08_CYCP.
  // Acción: rellena fecha_cycp_completa = hoy.
  // El CCPP se mantiene en 08_CYCP (no hay fase posterior); el cierre solo se
  // refleja en que ya tiene fecha en el círculo 08.
  app.post("/presupuestos/expediente/cerrar-cycp", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      if (fase !== "08_CYCP") {
        return sendError(res, "Solo se puede cerrar fase 08-CYCP cuando el CCPP está en esa fase. Fase actual: " + fase);
      }
      if (!comu.fecha_cycp_completa) comu.fecha_cycp_completa = new Date().toISOString().slice(0, 10);
      comu.fase_presupuesto = "09_TRAMITADA"; // v17.23
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/descartar — pasa a ZZ_DESCARTADO (manual)
  app.post("/presupuestos/expediente/descartar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      // Guardar la fase en la que estaba para poder restaurarla al reactivar (col BK fase_antes_descarte)
      try {
        const _fa = normalizarFase(comu.fase_presupuesto);
        if (_fa && _fa !== "ZZ_DESCARTADO" && _fa !== "ZZ_RECHAZADO") {
          const _sh = getSheetsClient();
          await _sh.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `comunidades!BK${comu._rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [[_fa]] },
          });
        }
      } catch (_) {}
      comu.fase_presupuesto = "ZZ_DESCARTADO";
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/eliminar — BORRADO FÍSICO de la fila del Sheet.
  // Solo permitido si la fase es ZZ_DESCARTADO (los rechazados deben pasar primero
  // por DESCARTADO antes de poder eliminarse, así hay una "papelera" intermedia).
  // Usa batchUpdate con deleteDimension para que la fila desaparezca físicamente.
  app.post("/presupuestos/expediente/eliminar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      if (fase !== "ZZ_DESCARTADO") {
        return sendError(res, "Solo se pueden eliminar expedientes en fase ZZ-DESCARTADO");
      }
      // Obtener el sheetId numérico de la pestaña 'comunidades'
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const tab = (meta.data.sheets || []).find(s => s.properties && s.properties.title === "comunidades");
      if (!tab) throw new Error("No se encontró la pestaña 'comunidades' en el Sheet");
      const tabId = tab.properties.sheetId;
      // _rowIndex es 1-based con cabecera; deleteDimension usa 0-based, por eso restamos 1
      const startIndex = comu._rowIndex - 1;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: tabId,
                dimension: "ROWS",
                startIndex,
                endIndex: startIndex + 1,
              },
            },
          }],
        },
      });
      // Mover carpeta de Drive a la papelera (no bloqueante).
      try {
        const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
        if (parentId) {
          const nombre = `${comu.tipo_via || ""} ${comu.direccion || ""}`.trim();
          if (nombre) {
            const nombreSafe = nombre.replace(/'/g, "\\'");
            const drive = getDriveClient();
            const busq = await drive.files.list({
              q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: "files(id,name)",
              pageSize: 1,
            });
            if (busq.data.files && busq.data.files.length > 0) {
              await drive.files.update({
                fileId: busq.data.files[0].id,
                requestBody: { trashed: true },
              });
              console.log(`[presupuestos] carpeta Drive enviada a papelera: "${nombre}"`);
            } else {
              console.log(`[presupuestos] carpeta Drive no encontrada para "${nombre}" (nada que borrar)`);
            }
          }
        }
      } catch (errDrive) {
        console.error("[presupuestos] Error enviando carpeta a papelera (no bloquea eliminación):", errDrive.message);
      }
      const token = req.query.token || "";
      // Redirigir al listado (la ficha ya no existe)
      res.redirect(urlT(token, "/presupuestos"));
    } catch (e) {
      console.error("[presupuestos] /eliminar:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // Infiere la fase "más avanzada" alcanzada a partir de las fechas presentes.
  // Solo se usa como RESPALDO al reactivar expedientes ANTIGUOS que no tienen
  // guardada la fase previa (col BK). Nunca borra datos; solo elige una fase.
  function _inferirFaseDesdeData(comu) {
    const has = k => comu[k] && String(comu[k]).trim() !== "";
    if (has("fecha_cycp_completa") || has("fecha_envio_contratos_pagos")) return "08_CYCP";
    if (has("fecha_documentacion_completa") || has("fecha_visita_emasesa")) return "06_VISITA_EMASESA";
    if (has("fecha_envio_pto")) return "04_ACEPTACION_PTO";
    if (has("fecha_visita_pto")) return "03_ENVIO_PTO";
    return "01_CONTACTO";
  }

  // POST /presupuestos/expediente/reactivar — saca el expediente de ZZ con dos modos:
  //   modo="ultimo"    → vuelve a la fase en la que estaba, CONSERVANDO fechas y contadores.
  //   modo="principio" → vuelve a 01_CONTACTO, RESETEANDO fechas y contadores.
  // Acepta como fase de origen ZZ_RECHAZADO o ZZ_DESCARTADO.
  app.post("/presupuestos/expediente/reactivar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const modo = String(req.body.modo || "ultimo").toLowerCase(); // "ultimo" | "principio"
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const faseActual = normalizarFase(comu.fase_presupuesto);
      // Solo permitir reactivar si está rechazada o descartada
      if (faseActual !== "ZZ_DESCARTADO" && faseActual !== "ZZ_RECHAZADO") {
        return sendError(res, "Solo se pueden reactivar expedientes rechazados o descartados");
      }

      if (modo === "principio") {
        // EMPEZAR DE NUEVO (acción explícita): 01_CONTACTO reseteando fechas y contadores.
        comu.fase_presupuesto = "01_CONTACTO";
        comu.fecha_contacto = new Date().toISOString().slice(0, 10);
        comu.fecha_visita = "";
        comu.fecha_envio_pto = "";
        comu.fecha_ultimo_seguimiento_pto = "";
        comu.fecha_aceptacion_pto = "";
        comu.decision_pto = "";
        comu.motivo_rechazo = "";
        comu.mails_enviados = "";
        comu.mails_manuales = "";
        comu.mails_ultimo_envio = "";
        await actualizarComunidad(comu._rowIndex, comu);
      } else {
        // ÚLTIMO ESTADO: volver a la fase previa SIN borrar fechas ni contadores.
        // Fase destino = la guardada en BK; si no existe (expedientes antiguos), se infiere de los datos.
        let _fasePrevia = "";
        try {
          const _sh = getSheetsClient();
          const _r = await _sh.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `comunidades!BK${comu._rowIndex}` });
          _fasePrevia = normalizarFase((((_r.data.values || [])[0] || [])[0]) || "");
        } catch (_) { _fasePrevia = ""; }
        const destino = (_fasePrevia && _fasePrevia !== "ZZ_DESCARTADO" && _fasePrevia !== "ZZ_RECHAZADO")
          ? _fasePrevia
          : _inferirFaseDesdeData(comu);
        comu.fase_presupuesto = destino;
        // Limpiar los artefactos del rechazo para que no arrastre "RECHAZADO".
        comu.decision_pto = "";
        comu.motivo_rechazo = "";
        // Si se vuelve a 04 o antes, la fecha_aceptacion_pto era el sello del rechazo: se limpia.
        if (["01_CONTACTO", "02_VISITA", "03_ENVIO_PTO", "04_ACEPTACION_PTO", "04_REENVIO"].includes(destino)) {
          comu.fecha_aceptacion_pto = "";
        }
        await actualizarComunidad(comu._rowIndex, comu);
        // Limpiar la marca BK ya usada.
        try {
          const _sh2 = getSheetsClient();
          await _sh2.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `comunidades!BK${comu._rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [[""]] },
          });
        } catch (_) {}
      }
      const token = req.query.token || "";
      // Redirigir con flag "reactivado=1" para que la UI muestre el confirm de envío inicial
      res.redirect(urlT(token, "/presupuestos/expediente", { id, reactivado: "1" }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // GET /presupuestos/plantilla-mail?fase=01_CONTACTO&id=...
  // Devuelve JSON con la plantilla aplicada al expediente (variables sustituidas)
  app.get("/presupuestos/plantilla-mail", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const fase = String(req.query.fase || "");
      const id = String(req.query.id || "");
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const plantilla = await leerPlantillaMail(fase);
      if (!plantilla || !plantilla.activo) {
        return res.status(404).json({ error: "Plantilla no disponible para esta fase" });
      }
      // v18.99i — Los sub-mails de ultimátum (AVISO/RESOLUCION) no tienen asunto propio:
      // usan el ASUNTO COMÚN del contenedor de su fase (05_ULTIMATUM_DOC / 08_ULTIMATUM_CYCP).
      if (!String(plantilla.asunto || "").trim() || !String(plantilla.adjuntos_fijos || "").trim()) {
        const _contUlt = { "05_ULT_AVISO": "05_ULTIMATUM_DOC", "05_ULT_RESOLUCION": "05_ULTIMATUM_DOC", "08_ULT_AVISO": "08_ULTIMATUM_CYCP", "08_ULT_RESOLUCION": "08_ULTIMATUM_CYCP" }[fase];
        if (_contUlt) { try { const _pc = await leerPlantillaMail(_contUlt); if (_pc) { if (!String(plantilla.asunto || "").trim() && String(_pc.asunto || "").trim()) plantilla.asunto = _pc.asunto; if (!String(plantilla.adjuntos_fijos || "").trim() && String(_pc.adjuntos_fijos || "").trim()) plantilla.adjuntos_fijos = _pc.adjuntos_fijos; } } catch (e) {} }
      }
      // Para la previsualización del mail de fase 05_ACEPTACION_PTO, si la
      // CCPP aún no tiene fecha_limite_documentacion_vecinos, mostramos en la
      // preview la fecha que se calculará al confirmar el envío (hoy + 20).
      // No tocamos el Sheet aquí: eso lo hace el endpoint de envío real (POST
      // /presupuestos/expediente/enviar-mail). Trabajamos sobre una copia.
      const comuPreview = Object.assign({}, comu);
      if (fase === "05_ACEPTACION_PTO" && !comuPreview.fecha_limite_documentacion_vecinos) {
        const f = new Date();
        f.setDate(f.getDate() + 20);
        comuPreview.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      }
      // Idem para 08_INICIO_CYCP: en la preview el expediente aún está en fase 07
      // y fecha_envio_contratos_pagos NO está sellada. La sembramos con HOY (lo
      // mismo que hará el envío real al pasar a 08), para que {{fecha_limite_cycp}}
      // (= envío + 10) y {{fecha_envio_contratos_pagos}} salgan bien en el mail.
      // v18.93 — Antes se rellenaba por error fecha_limite_documentacion_vecinos
      // (campo de fase 05), por lo que {{fecha_limite_cycp}} salía vacío y solo
      // quedaba el texto fijo "(10 DÍAS NATURALES)".
      if (fase === "08_INICIO_CYCP" && normalizarFase(comuPreview.fase_presupuesto) === "07_PTE_CYCP") {
        if (!comuPreview.fecha_envio_contratos_pagos) {
          comuPreview.fecha_envio_contratos_pagos = new Date().toISOString().slice(0, 10);
        }
      }
      // Sustituir variables (async porque puede incluir {{DOC_CCPP}}/{{DOC_PISOS}}/{{PCT_PISOS}})
      const asunto = await sustituirVariablesAsync(plantilla.asunto, comuPreview);
      const mensaje = await sustituirVariablesAsync(plantilla.mensaje, comuPreview);
      // Estado actual de envíos
      const enviados = parsearMailJson(comu.mails_enviados);
      const ultimo = parsearMailJson(comu.mails_ultimo_envio);
      res.json({
        ok: true,
        fase,
        plantilla: {
          asunto,
          mensaje,
          adjuntos_fijos: plantilla.adjuntos_fijos || "",
          cco: plantilla.cco || "",
          dias_recurrente: plantilla.dias_recurrente,
          max_envios: plantilla.max_envios,
        },
        destinatario: (function() {
          const d = _destinatariosCcpp(comu);
          return {
            nombre: comu.administrador || "",
            email: d.to,
            cc:    d.cc,
          };
        })(),
        estado: {
          enviados: enviados[fase] || 0,
          ultimo: ultimo[fase] || "",
        },
      });
    } catch (e) {
      console.error("[presupuestos] /plantilla-mail:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/expediente/carpeta-drive?id=...
  // Devuelve la URL de la carpeta Drive del expediente (la crea si no existe).
  app.get("/presupuestos/expediente/carpeta-drive", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const folderId = await getOrCreateCarpetaExpediente(comu.tipo_via, comu.direccion);
      if (!folderId) return res.status(500).json({ error: "No se pudo obtener carpeta Drive" });
      res.json({ ok: true, url: `https://drive.google.com/drive/folders/${folderId}` });
    } catch (e) {
      console.error("[presupuestos] /carpeta-drive:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/expediente/mail-borrar
  // body: id, fecha, ccpp_id, direccion, fase, asunto, tipo
  // Borra una fila de mail_historico identificada por (fecha, ccpp_id, direccion, fase, asunto, tipo).
  app.post("/presupuestos/expediente/mail-borrar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      await borrarMailHistoricoFila({
        fecha: String(req.body.fecha || ""),
        ccpp_id: String(req.body.ccpp_id || ""),
        direccion: String(req.body.direccion || ""),
        fase: String(req.body.fase || ""),
        asunto: String(req.body.asunto || ""),
        tipo: String(req.body.tipo || ""),
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-borrar:", e.message);
      res.status(500).send(e.message);
    }
  });

  // POST /presupuestos/expediente/mail-enviar-manual
  // body: id, destinatario, cc, cco, asunto, mensaje, adjuntos
  // Compositor libre tipo Gmail: envía REAL por SMTP usando la primera cuenta
  // (administracion) y registra en mail_historico como tipo "manual_externo"
  // (mismo tipo que los demás manuales). En `adjuntos` se guardan los links
  // tal cual; los archivos NO se almacenan en el Sheet.
  // =================================================================
  // ENVÍO ASÍNCRONO DE MAILS (anti-cuelgue + anti-duplicado)
  // -----------------------------------------------------------------
  // enviarMailReal descarga adjuntos de Drive y manda por SMTP; con
  // adjuntos eso tarda y el navegador perdía la respuesta -> el modal se
  // quedaba en "Enviando..." aunque el mail SÍ salía. Ahora el endpoint
  // responde al instante {encolado} con un envioId, hace el trabajo por
  // detrás y guarda el resultado en _enviosJobs; el modal sondea
  // /envio-estado hasta tener el resultado. Idempotente por envioId: el
  // mismo id NO reenvía, devuelve el resultado ya calculado (protege de
  // duplicados por re-clic o reconexión).
  // =================================================================
  const _enviosJobs = new Map(); // envioId -> { estado, status, isJson, payload, error, ts }

  function _podarEnviosJobs() {
    const lim = Date.now() - 10 * 60 * 1000; // 10 min
    for (const [k, v] of _enviosJobs.entries()) {
      if ((v.ts || 0) < lim) _enviosJobs.delete(k);
    }
  }

  // Res "falso" que captura status/json/send en vez de escribir a la red.
  function _crearFakeRes() {
    const r = { _status: 200, _payload: null, _isJson: false };
    r.status = (c) => { r._status = c; return r; };
    r.type = () => r;
    r.json = (o) => { r._payload = o; r._isJson = true; return r; };
    r.send = (t) => { r._payload = t; r._isJson = false; return r; };
    return r;
  }

  // Envuelve un core(req,res) para ejecutarlo en segundo plano con idempotencia.
  // Sin envioId en el body -> ejecuta el core de forma SÍNCRONA (compat: p.ej.
  // "Saltar envío", que no manda correo y es rápido).
  function _envolverEnvioAsync(coreFn) {
    return async function (req, res) {
      const envioId = String((req.body && req.body.envioId) || "").trim();
      if (!envioId) return coreFn(req, res);
      if (!checkToken(req, res)) return;
      _podarEnviosJobs();
      if (_enviosJobs.has(envioId)) {
        // Idempotente: NO se reenvía. El modal verá el resultado al sondear.
        return res.json({ encolado: true, envioId, yaExistia: true });
      }
      _enviosJobs.set(envioId, { estado: "en_curso", ts: Date.now() });
      res.json({ encolado: true, envioId }); // responde YA, sin esperar al envío
      (async () => {
        const fake = _crearFakeRes();
        try {
          await coreFn(req, fake);
          const st = fake._status || 200;
          _enviosJobs.set(envioId, {
            estado: st >= 200 && st < 300 ? "ok" : "error_http",
            status: st,
            isJson: fake._isJson,
            payload: fake._payload,
            ts: Date.now(),
          });
        } catch (e) {
          const m = String((e && e.message) || e);
          _enviosJobs.set(envioId, { estado: "error", status: 500, isJson: false, payload: m, error: m, ts: Date.now() });
        }
      })();
    };
  }

  // GET /presupuestos/expediente/envio-estado?envioId=...
  app.get("/presupuestos/expediente/envio-estado", (req, res) => {
    if (!checkToken(req, res)) return;
    const envioId = String(req.query.envioId || "").trim();
    const job = _enviosJobs.get(envioId);
    if (!job) return res.json({ estado: "desconocido" });
    res.json({
      estado: job.estado,
      status: job.status || null,
      isJson: !!job.isJson,
      payload: job.payload != null ? job.payload : null,
    });
  });

  const _coreMailManual = async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const destinatario = String(req.body.destinatario || "").trim();
      const cc = String(req.body.cc || "").trim();
      const cco = String(req.body.cco || "").trim();
      const asunto = String(req.body.asunto || "").trim();
      const mensaje = String(req.body.mensaje || "");
      const adjuntos = String(req.body.adjuntos || "").trim();
      if (!id) return res.status(400).send("Falta id");
      if (!destinatario) return res.status(400).send("Falta destinatario");
      if (!asunto) return res.status(400).send("Falta asunto");
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      // Cuenta = primera de mail_cuentas (administracion).
      const cuentas = await leerCuentasMail();
      if (!cuentas.length) return res.status(500).send("No hay cuentas en mail_cuentas");
      const cuentaId = cuentas[0].id;
      // Envío real (descarga adjuntos de Drive, los adjunta, registra error si link roto).
      let msgIdEnviado = "";
      try {
        msgIdEnviado = await enviarMailReal({
          cuentaId,
          destinatario,
          cc,
          cco,
          asunto,
          mensaje,
          adjuntosUrls: adjuntos,
        });
      } catch (errEnv) {
        console.error("[presupuestos] /mail-enviar-manual envío falló:", errEnv.message);
        return res.status(500).send("No se envió:\n" + errEnv.message);
      }
      // Registrar en histórico (solo links, no archivos).
      await registrarMailEnHistorico({
        fecha: new Date().toISOString(),
        ccpp_id: comu.ccpp_id,
        direccion: comu.direccion || "",
        fase: "00_MANUAL",
        destinatario,
        cc,
        cco,
        asunto,
        mensaje,
        adjuntos,
        tipo: "manual_externo",
        message_id: msgIdEnviado,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-enviar-manual:", e.message);
      res.status(500).send(e.message);
    }
  };
  app.post("/presupuestos/expediente/mail-enviar-manual", _envolverEnvioAsync(_coreMailManual));

  // POST /presupuestos/expediente/enviar-mail
  // body: id, fase, asunto, mensaje, destinatario, adjuntos, tipo
  // tipo: "manual_inicial" (1er envío del confirm) | "automatico" (cron) | "manual" (legacy)
  // Envío REAL via SMTP (nodemailer). La cuenta de salida la indica la plantilla
  // (col J `cuenta_envio` de mail_plantillas) referenciando una fila de mail_cuentas.
  // NOTA: el descarte por tope NO lo hace este endpoint — lo hace el cron diario 30 días después.
  const _coreEnviarMail = async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "");
      const fase = String(req.body.fase || "");
      const skip = String(req.body.skip || "") === "1";
      const reenvio = String(req.body.reenvio || "") === "1";
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });

      // Modo "saltar envío": no envía mail ni registra en histórico ni toca contadores
      // del cron, solo aplica el avance de fase (y sellado de fechas) propio de la fase.
      // Para fases con cron (05, 08), siembra los contadores con fecha=hoy para que
      // el cron espere los días configurados antes del siguiente envío.
      if (skip) {
        const faseActual = normalizarFase(comu.fase_presupuesto);
        const hoy = new Date().toISOString().slice(0, 10);
        // 01 -> 02 (sin sellar fechas, sin cron)
        if ((fase === "02_PTE_VISITA_CON_ACTA" || fase === "02_PTE_VISITA_SIN_ACTA") && faseActual === "01_CONTACTO") {
          comu.fase_presupuesto = "02_VISITA";
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 03 -> 04 (sella fecha_envio_pto, sin cron específico)
        if (fase === "03_ENVIO_PTO" && faseActual === "03_ENVIO_PTO") {
          comu.fecha_envio_pto = hoy;
          comu.fase_presupuesto = "04_ACEPTACION_PTO";
          if (!comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 04 -> 05 (sella fecha_aceptacion_pto, siembra cron de 05 con fecha hoy)
        if (fase === "05_ACEPTACION_PTO" && faseActual === "04_ACEPTACION_PTO") {
          comu.fase_presupuesto = "05_DOCUMENTACION";
          comu.decision_pto = "ACEPTADO";
          comu.fecha_aceptacion_pto = hoy;
          const enviados05 = parsearMailJson(comu.mails_enviados);
          const manuales05 = parsearMailJson(comu.mails_manuales);
          const ultimo05 = parsearMailJson(comu.mails_ultimo_envio);
          enviados05["05_DOCUMENTACION"] = 1;
          manuales05["05_DOCUMENTACION"] = 1;
          ultimo05["05_DOCUMENTACION"] = hoy;
          comu.mails_enviados = JSON.stringify(enviados05);
          comu.mails_manuales = JSON.stringify(manuales05);
          comu.mails_ultimo_envio = JSON.stringify(ultimo05);
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 05 -> 06 (sella fecha_documentacion_completa, sin cron específico)
        if (fase === "05_FIN_DOC" && faseActual === "05_DOCUMENTACION") {
          comu.fase_presupuesto = "06_VISITA_EMASESA";
          if (!comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 07 -> 08 (sella fecha_envio_contratos_pagos, siembra cron de 08 con fecha hoy)
        if (fase === "08_INICIO_CYCP" && faseActual === "07_PTE_CYCP") {
          comu.fase_presupuesto = "08_CYCP";
          if (!comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
          const enviados08 = parsearMailJson(comu.mails_enviados);
          const manuales08 = parsearMailJson(comu.mails_manuales);
          const ultimo08 = parsearMailJson(comu.mails_ultimo_envio);
          enviados08["08_CYCP"] = 1;
          manuales08["08_CYCP"] = 1;
          ultimo08["08_CYCP"] = hoy;
          comu.mails_enviados = JSON.stringify(enviados08);
          comu.mails_manuales = JSON.stringify(manuales08);
          comu.mails_ultimo_envio = JSON.stringify(ultimo08);
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        return res.status(400).json({ error: "El modo 'saltar envío' no está disponible para esta fase/plantilla en este expediente." });
      }

      // Modo "reenvío" (fase 04): mismo flujo de envío que un mail normal pero:
      //  - Registra en histórico con tipo 'reenvio_fase04'
      //  - Actualiza fecha_ultimo_reenvio_pto = hoy
      //  - Resetea fecha_ultimo_seguimiento_pto = hoy (el ciclo empieza de cero)
      //  - Borra contadores de mails fase 04 (cron empezará otra vez)
      //  - Borra fecha_proximo_mail_manual
      //  - NO avanza de fase (sigue en 04)
      if (reenvio) {
        if (normalizarFase(comu.fase_presupuesto) !== "04_ACEPTACION_PTO") {
          return res.status(400).json({ error: "El reenvío solo está disponible en fase 04-ACEPTACION PTO." });
        }
        // Plantilla 04_REENVIO (exclusiva del reenvío de presupuesto modificado)
        const plantillaR = await leerPlantillaMail("04_REENVIO");
        if (!plantillaR) return res.status(400).json({ error: "Sin plantilla 04_REENVIO configurada en mail_plantillas." });
        if (!plantillaR.activo) return res.status(400).json({ error: "Plantilla 04_REENVIO desactivada." });
        if (!plantillaR.cuenta_envio) return res.status(400).json({ error: "Plantilla 04_REENVIO sin cuenta de envío configurada." });

        // Si el body trae destinatario, respetar lo que escribió el usuario
        // (incluyendo el CC que haya puesto). Si no, usar el helper.
        const _destR = req.body.destinatario
          ? { to: String(req.body.destinatario).trim(), cc: String(req.body.cc || "").trim() }
          : _destinatariosCcpp(comu);
        const destinatarioR = _destR.to;
        const ccR = _destR.cc;
        if (!destinatarioR) return res.status(400).json({ error: "El expediente no tiene email de administrador ni de presidente configurado." });
        const asuntoR  = req.body.asunto  || (await sustituirVariablesAsync(plantillaR.asunto, comu))  || "";
        const mensajeR = req.body.mensaje || (await sustituirVariablesAsync(plantillaR.mensaje, comu)) || "";
        const adjuntosR = req.body.adjuntos || plantillaR.adjuntos_fijos || "";
        // CCO: si el usuario lo escribió en el modal de reenvío, se respeta;
        // si viene vacío, cae al de la plantilla (igual que el envío normal).
        const ccoR = (req.body.cco != null && String(req.body.cco).trim() !== "")
          ? String(req.body.cco).trim()
          : plantillaR.cco;

        // Envío real
        let msgIdEnviado = "";
        try {
          msgIdEnviado = await enviarMailReal({
            cuentaId: plantillaR.cuenta_envio,
            destinatario: destinatarioR,
            cc:  ccR,
            cco: ccoR,
            asunto: asuntoR,
            mensaje: mensajeR,
            adjuntosUrls: String(adjuntosR).split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
          });
        } catch (errEnv) {
          console.error("[presupuestos] enviarMailReal (reenvío) falló:", errEnv.message);
          return res.status(502).json({ error: "Fallo al enviar el mail: " + errEnv.message });
        }

        await registrarMailEnHistorico({
          fecha: new Date().toISOString(),
          ccpp_id: id,
          direccion: comu.direccion || comu.comunidad,
          fase: "04_ACEPTACION_PTO",
          destinatario: destinatarioR,
          cc:  ccR,
          cco: ccoR,
          asunto: asuntoR,
          mensaje: mensajeR,
          adjuntos: adjuntosR,
          tipo: "reenvio_fase04",
          message_id: msgIdEnviado,
        });
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_ultimo_reenvio_pto = hoy;
        comu.fecha_ultimo_seguimiento_pto = hoy;
        comu.fecha_proximo_mail_manual = "";
        // Opción A (sesión 07/05/2026): el reenvío revisado cuenta como un
        // NUEVO envío manual. Se suman:
        //   - manuales[04_ACEPTACION_PTO] += 1
        //   - automáticos se resetean: mails_enviados[04] = manuales[04]
        //     (de modo que numAutomáticos = 0 → cuenta atrás de cron empieza
        //      desde cero con la nueva cadencia inicial 'cadenciaInicialDias').
        // En la UI esto pasa de 1+0/3 a 2+0/3 (segundo manual, 0 reenvíos).
        const enviadosR = parsearMailJson(comu.mails_enviados);
        const manualesR = parsearMailJson(comu.mails_manuales);
        const ultimoR = parsearMailJson(comu.mails_ultimo_envio);
        // Compat con CCPPs antiguos: si nunca se trackearon manuales pero
        // ya había envíos, asumimos que al menos 1 fue manual (el inicial).
        let prevMan = manualesR["04_ACEPTACION_PTO"];
        if (prevMan === undefined) {
          const total = enviadosR["04_ACEPTACION_PTO"] || 0;
          prevMan = total >= 1 ? 1 : 0;
        }
        const nuevoMan = parseInt(prevMan) + 1;
        manualesR["04_ACEPTACION_PTO"] = nuevoMan;
        // Total = manuales (los automáticos quedan a 0 hasta que el cron mande
        // el siguiente)
        enviadosR["04_ACEPTACION_PTO"] = nuevoMan;
        ultimoR["04_ACEPTACION_PTO"] = hoy;
        comu.mails_enviados  = JSON.stringify(enviadosR);
        comu.mails_manuales  = JSON.stringify(manualesR);
        comu.mails_ultimo_envio = JSON.stringify(ultimoR);
        await actualizarComunidad(comu._rowIndex, comu);
        return res.json({ ok: true, reenvio: true });
      }

      const plantilla = await leerPlantillaMail(fase);
      if (!plantilla) return res.status(400).json({ error: "Sin plantilla para esa fase" });
      if (!plantilla.activo) return res.status(400).json({ error: "Plantilla desactivada para esta fase" });
      if (!plantilla.cuenta_envio) return res.status(400).json({ error: "Plantilla sin cuenta de envío configurada." });

      const enviados = parsearMailJson(comu.mails_enviados);
      const manuales = parsearMailJson(comu.mails_manuales);
      const ultimo = parsearMailJson(comu.mails_ultimo_envio);
      const nuevoCount = (enviados[fase] || 0) + 1;

      // Comprobar tope: max_envios = nº máximo de REENVÍOS AUTOMÁTICOS.
      // El envío manual nunca está limitado por max_envios; este check solo
      // aplica cuando alguien intenta forzar más automáticos vía endpoint
      // (que no debería pasar porque el endpoint manual los marca como
      // "manual" y no incrementa el contador de automáticos).
      // Mantenemos el check como red de seguridad por si llega un envío
      // de tipo "automatico" (ej. cron manual).
      const tipoEnvio = req.body.tipo || "manual";
      const esManual = tipoEnvio === "manual" || tipoEnvio === "manual_inicial" || tipoEnvio === "reenvio_fase04";
      if (!esManual && plantilla.max_envios > 0) {
        const numAutomActual = Math.max(0, (enviados[fase] || 0) - (manuales[fase] || 0));
        // v17.29: aceptar mientras estemos DENTRO del ciclo actual.
        // El ciclo se completa al alcanzar un múltiplo exacto de max_envios.
        const automEnCicloActual = numAutomActual % plantilla.max_envios;
        if (automEnCicloActual === 0 && numAutomActual > 0) {
          return res.status(400).json({
            error: `Se alcanzó el máximo de reenvíos automáticos del ciclo (${plantilla.max_envios}). Mete fecha de próximo mail manual para arrancar un nuevo ciclo.`,
          });
        }
      }

      // Si el body trae destinatario, respetar lo que escribió el usuario
      // (incluyendo el CC que haya puesto). Si no, usar el helper.
      const _dest2 = req.body.destinatario
        ? { to: String(req.body.destinatario).trim(), cc: String(req.body.cc || "").trim() }
        : _destinatariosCcpp(comu);
      const destinatario = _dest2.to;
      const ccManual = _dest2.cc;
      if (!destinatario) return res.status(400).json({ error: "El expediente no tiene email de administrador ni de presidente configurado." });

      // v17.49: Cálculo de fecha_limite_documentacion_vecinos basado en la
      // plantilla del cron de la fase destino. La fórmula es:
      //   fecha_limite = hoy + di + dr × mx
      // donde di, dr, mx son los parámetros del cron de la fase DESTINO.
      // Esta fecha coincide con el día en que el cron, siguiendo cadencia
      // normal, habría agotado el ciclo inicial. Es la misma fecha que se
      // muestra en {{fecha_limite_doc_vecinos}} en los mails y la que usa
      // calcularEstadoPlazo para los badges 👍/⚠️/👎.
      //
      // Helper para calcular plazo desde una plantilla:
      const _calcPlazoDesdePlantilla = (pl) => {
        if (!pl) return null;
        const _di = parseInt(pl.dias_primer_envio) || 0;
        const _dr = parseInt(pl.dias_recurrente) || 0;
        const _mx = parseInt(pl.max_envios) || 0;
        if (_mx <= 0 && _dr <= 0) return null;
        return _di + _dr * _mx;
      };
      // Helper para guardar la fecha límite (hoy + N días):
      const _guardarFechaLimite = (nDias) => {
        const f = new Date();
        f.setDate(f.getDate() + nDias);
        comu.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      };

      // FASE 01_CONTACTO: al enviar el primer mail manual de inicio,
      // calcular fecha límite con plantilla 01_CONTACTO. Solo si aún
      // no hay valor (no se sobrescribe en re-envíos manuales).
      if (fase === "01_CONTACTO" && !comu.fecha_limite_documentacion_vecinos) {
        const plazo01 = _calcPlazoDesdePlantilla(plantilla);
        if (plazo01 != null) _guardarFechaLimite(plazo01);
      }
      // FASE 03_ENVIO_PTO: al enviar el presupuesto (paso a 04), calcular
      // fecha límite con plantilla 04_ACEPTACION_PTO (la fase DESTINO),
      // SOBRESCRIBIENDO el valor anterior (que sería de fase 01 y ya no aplica).
      if (fase === "03_ENVIO_PTO" && normalizarFase(comu.fase_presupuesto) === "03_ENVIO_PTO") {
        try {
          const pl04 = await leerPlantillaMail("04_ACEPTACION_PTO");
          const plazo04 = _calcPlazoDesdePlantilla(pl04);
          if (plazo04 != null) _guardarFechaLimite(plazo04);
        } catch (_) { /* si falla la lectura, no rellenamos; el badge usará el fallback */ }
      }
      // FASE 05_ACEPTACION_PTO: al pulsar ACEPTADO en fase 04 (paso a 05),
      // calcular fecha límite con plantilla 05_SEGUIMIENTO_DOC (la fase
      // DESTINO). Solo si aún no hay valor.
      if (fase === "05_ACEPTACION_PTO" && !comu.fecha_limite_documentacion_vecinos) {
        try {
          const pl05 = await leerPlantillaMail("05_SEGUIMIENTO_DOC");
          const plazo05 = _calcPlazoDesdePlantilla(pl05);
          if (plazo05 != null) _guardarFechaLimite(plazo05);
        } catch (_) { /* idem */ }
      }
      // FASE 08_INICIO_CYCP: al enviar contratos y pagos (paso a 08),
      // calcular fecha límite con plantilla 08_SEGUIMIENTO_CYCP (la fase
      // DESTINO). SOBRESCRIBE el valor anterior (que sería de fase 05).
      if (fase === "08_INICIO_CYCP" && normalizarFase(comu.fase_presupuesto) === "07_PTE_CYCP") {
        try {
          const pl08 = await leerPlantillaMail("08_SEGUIMIENTO_CYCP");
          const plazo08 = _calcPlazoDesdePlantilla(pl08);
          if (plazo08 != null) _guardarFechaLimite(plazo08);
        } catch (_) { /* idem */ }
      }

      const asuntoF  = req.body.asunto  || (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
      const mensajeF = req.body.mensaje || (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
      const adjuntosF = req.body.adjuntos || plantilla.adjuntos_fijos || "";
      // CCO: si el usuario escribió uno en el modal, se respeta; si no, cae al
      // de la plantilla (col I `cco`). El cron/reenvíos sin body siguen usando
      // plantilla.cco como hasta ahora.
      const ccoF = (req.body.cco != null && String(req.body.cco).trim() !== "")
        ? String(req.body.cco).trim()
        : plantilla.cco;

      // Envío real
      let msgIdEnviado = "";
      try {
        msgIdEnviado = await enviarMailReal({
          cuentaId: plantilla.cuenta_envio,
          destinatario,
          cc:  ccManual,
          cco: ccoF,
          asunto: asuntoF,
          mensaje: mensajeF,
          adjuntosUrls: String(adjuntosF).split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
        });
      } catch (errEnv) {
        console.error("[presupuestos] enviarMailReal falló:", errEnv.message);
        return res.status(502).json({ error: "Fallo al enviar el mail: " + errEnv.message });
      }

      // Registrar en histórico
      await registrarMailEnHistorico({
        fecha: new Date().toISOString(),
        ccpp_id: id,
        direccion: comu.direccion || comu.comunidad,
        fase,
        destinatario,
        cc:  ccManual,
        cco: ccoF,
        asunto: asuntoF,
        mensaje: mensajeF,
        adjuntos: adjuntosF,
        tipo: tipoEnvio,
        message_id: msgIdEnviado,
      });

      // Actualizar contador y fecha
      enviados[fase] = nuevoCount;
      ultimo[fase] = new Date().toISOString().slice(0, 10);
      // Si es envío manual, también incrementamos el contador de manuales.
      // Compat con CCPPs antiguos: si todavía no hay entrada en `manuales`
      // pero ya había envíos, asumimos que el primero (los previos) eran
      // manuales y partimos de ahí.
      if (esManual) {
        let prevManuales = manuales[fase];
        if (prevManuales === undefined) {
          // Antes de este envío había `enviados[fase] - 1` envíos en total.
          // Asumimos que al menos uno fue manual si había alguno.
          prevManuales = (enviados[fase] - 1) >= 1 ? 1 : 0;
        }
        manuales[fase] = parseInt(prevManuales) + 1;
        comu.mails_manuales = JSON.stringify(manuales);
      }
      comu.mails_enviados = JSON.stringify(enviados);
      comu.mails_ultimo_envio = JSON.stringify(ultimo);

      // Caso especial fase 03: el envío del presupuesto avanza automáticamente a 04
      // y rellena fecha_envio_pto con la fecha real del envío.
      let avanzado = false;
      if (fase === "03_ENVIO_PTO" && normalizarFase(comu.fase_presupuesto) === "03_ENVIO_PTO") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_envio_pto = hoy;
        comu.fase_presupuesto = "04_ACEPTACION_PTO";
        if (!comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        // v18.41: SIEMBRA de la fase 04. El mail del presupuesto (plantilla 03)
        // es el PRIMER MANUAL de la cadena de seguimiento de la fase 04. Hasta
        // ahora solo se anotaba bajo la clave 03_ENVIO_PTO (su etapa de origen)
        // y la clave 04 quedaba vacía -> el indicador nacía 0+0/3 "no iniciado"
        // y el cron solo arrancaba de chiripa vía el fallback de fecha. Ahora
        // sembramos la clave 04 como manual nº1, con la MISMA fecha del envío
        // real (ultimo["03_ENVIO_PTO"]), idéntico patrón al de 04->05 y 07->08.
        // Resultado: nace 1+0/3 y el cron de la 04 arranca limpio desde la clave.
        // Las variables enviados/manuales/ultimo siguen vivas (se serializaron
        // arriba, líneas ~8047-8064); las reutilizamos y volvemos a serializar.
        enviados["04_ACEPTACION_PTO"] = 1;
        manuales["04_ACEPTACION_PTO"] = 1;
        ultimo["04_ACEPTACION_PTO"] = ultimo["03_ENVIO_PTO"] || hoy;
        comu.mails_enviados = JSON.stringify(enviados);
        comu.mails_manuales = JSON.stringify(manuales);
        comu.mails_ultimo_envio = JSON.stringify(ultimo);
        avanzado = true;
      }

      // Caso especial fase 05_ACEPTACION_PTO: el mail de aceptación avanza
      // automáticamente a 05-DOCUMENTACION (igual que el botón ACEPTADO).
      let avanzadoA05 = false;
      if (fase === "05_ACEPTACION_PTO" && normalizarFase(comu.fase_presupuesto) === "04_ACEPTACION_PTO") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "05_DOCUMENTACION";
        comu.decision_pto = "ACEPTADO";
        comu.fecha_aceptacion_pto = hoy;
        // Sembrar contadores de fase 05 con este envío como el primer manual,
        // para que el cron de fase 05 arranque la cadencia desde aquí.
        const enviados05 = parsearMailJson(comu.mails_enviados);
        const manuales05 = parsearMailJson(comu.mails_manuales);
        const ultimo05 = parsearMailJson(comu.mails_ultimo_envio);
        enviados05["05_DOCUMENTACION"] = 1;
        manuales05["05_DOCUMENTACION"] = 1;
        ultimo05["05_DOCUMENTACION"] = hoy;
        comu.mails_enviados = JSON.stringify(enviados05);
        comu.mails_manuales = JSON.stringify(manuales05);
        comu.mails_ultimo_envio = JSON.stringify(ultimo05);
        avanzadoA05 = true;
      }

      // Caso especial fase 05_FIN_DOC: mail de fin de documentación. Al confirmar,
      // Caso especial fase 02 (paso 01 -> 02): mail de transición. Se activa con
      // cualquiera de las dos plantillas (CON_ACTA o SIN_ACTA). Al confirmar, se
      // avanza la CCPP de 01_CONTACTO a 02_VISITA. NO se sella ninguna fecha aquí:
      // `fecha_visita` se rellena al salir de la fase 02 (cuando la visita ya ocurrió).
      let avanzadoA02 = false;
      if ((fase === "02_PTE_VISITA_CON_ACTA" || fase === "02_PTE_VISITA_SIN_ACTA")
          && normalizarFase(comu.fase_presupuesto) === "01_CONTACTO") {
        comu.fase_presupuesto = "02_VISITA";
        // Al pasar de fase 01 limpiamos la fecha del próximo mail manual
        // para que no se arrastre si más tarde se vuelve a una fase con
        // reenvíos automáticos (04/05/08).
        comu.fecha_proximo_mail_manual = "";
        avanzadoA02 = true;
      }

      // se avanza la CCPP de 05_DOCUMENTACION a 06_VISITA_EMASESA y se sella la
      // fecha (fecha_documentacion_completa = hoy).
      let avanzadoA06 = false;
      if (fase === "05_FIN_DOC" && normalizarFase(comu.fase_presupuesto) === "05_DOCUMENTACION") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "06_VISITA_EMASESA";
        if (!comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
        avanzadoA06 = true;
      }

      // Caso especial fase 08_INICIO_CYCP: mail de inicio de fase 08. Al confirmar,
      // se avanza la CCPP de 07_PTE_CYCP a 08_CYCP y se sella la fecha
      // (fecha_envio_contratos_pagos = hoy). Además se siembran los contadores
      // de la fase 08 con este envío como primer manual, para que el cron de
      // fase 08 arranque la cadencia desde aquí (igual que el paso 04→05).
      let avanzadoA08 = false;
      if (fase === "08_INICIO_CYCP" && normalizarFase(comu.fase_presupuesto) === "07_PTE_CYCP") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "08_CYCP";
        if (!comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
        const enviados08 = parsearMailJson(comu.mails_enviados);
        const manuales08 = parsearMailJson(comu.mails_manuales);
        const ultimo08 = parsearMailJson(comu.mails_ultimo_envio);
        enviados08["08_CYCP"] = 1;
        manuales08["08_CYCP"] = 1;
        ultimo08["08_CYCP"] = hoy;
        comu.mails_enviados = JSON.stringify(enviados08);
        comu.mails_manuales = JSON.stringify(manuales08);
        comu.mails_ultimo_envio = JSON.stringify(ultimo08);
        avanzadoA08 = true;
      }

      // Caso especial fase 08_FIN_CYCP: mail de cierre de fase 08. Al confirmar,
      // se cierra la fase (fecha_cycp_completa = hoy) y se pasa a 09_TRAMITADA
      // (v17.23). La CCPP marcada como 09_TRAMITADA ya no aparece en Activos
      // ni en En trámite ni en el cron de envíos.
      let cerradoFase08 = false;
      if (fase === "08_FIN_CYCP" && normalizarFase(comu.fase_presupuesto) === "08_CYCP" && !comu.fecha_cycp_completa) {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_cycp_completa = hoy;
        comu.fase_presupuesto = "09_TRAMITADA";
        cerradoFase08 = true;
      }

      await actualizarComunidad(comu._rowIndex, comu);

      // Si avanzó a 05, inicializar estados manuales (igual que el endpoint /aceptar)
      if (avanzadoA05) {
        try {
          const D = app.locals.documentacion;
          if (D && D.inicializarEstadosFase) {
            await D.inicializarEstadosFase(comu, "05_DOCUMENTACION");
          }
        } catch (e) {
          console.warn("[presupuestos] inicializarEstadosFase 05 (desde mail) falló:", e.message);
        }
      }

      // Si avanzó a 08, inicializar estados manuales: marca como "F" los
      // documentos contrato y pago (CCPP y piso) que es lo que se solicita
      // en esta fase. El resto de docs ya estaban en OK desde fase 05.
      if (avanzadoA08) {
        try {
          const D = app.locals.documentacion;
          if (D && D.inicializarEstadosFase) {
            await D.inicializarEstadosFase(comu, "08_CYCP");
          }
        } catch (e) {
          console.warn("[presupuestos] inicializarEstadosFase 08 (desde mail) falló:", e.message);
        }
      }

      res.json({
        ok: true,
        envios: nuevoCount,
        max_envios: plantilla.max_envios,
        avanzado,
        avanzadoA05,
        avanzadoA06,
        avanzadoA08,
        cerradoFase08,
      });
    } catch (e) {
      console.error("[presupuestos] /enviar-mail:", e.message);
      res.status(500).json({ error: e.message });
    }
  };
  app.post("/presupuestos/expediente/enviar-mail", _envolverEnvioAsync(_coreEnviarMail));

  // ===== TANDA 1 — BOTONES DEL ULTIMÁTUM (fase 05) =====
  // Cada botón manda su plantilla concreta clonando el camino de envío manual
  // (enviarMailReal + registrarMailEnHistorico), tipo "manual" para NO tocar los
  // contadores del cron automático. Tras enviar, sella una MARCA de fecha en su
  // columna (BL/BM/BN) con actualizarCampoComunidad (una sola celda, reverificada).
  // El sellado es best-effort: si la columna aún no existe en el Sheet, el mail
  // ya se envió y la marca simplemente se omite con aviso (nunca rompe el envío).
  // NO toca el cron vivo ni el bot.
  // v18.99o — sella la marca del botón de ultimátum. Si campoFecha empieza por
  // "@flag:", marca una clave en el JSON mails_enviados (para "Aviso prórroga 2",
  // que no tiene columna propia); si no, sella la columna de fecha como siempre.
  async function _sellarUltimatum(comu, campoFecha) {
    if (String(campoFecha).startsWith("@flag:")) {
      const _k = String(campoFecha).slice(6);
      let _je = {}; try { _je = JSON.parse(comu.mails_enviados || "{}"); } catch (_) { _je = {}; }
      if (!_je[_k]) { _je[_k] = new Date().toISOString().slice(0, 10); await actualizarCampoComunidad(comu._rowIndex, "mails_enviados", JSON.stringify(_je)); }
    } else {
      const _ya = String(comu[campoFecha] || "").trim();
      if (!_ya) await actualizarCampoComunidad(comu._rowIndex, campoFecha, new Date().toISOString().slice(0, 10));
    }
  }
  async function _coreBotonUltimatum(req, res, codigoPlantilla, campoFecha, fasePermitida) {
    fasePermitida = fasePermitida || "05_DOCUMENTACION";
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "");
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      if (normalizarFase(comu.fase_presupuesto) !== fasePermitida) {
        return res.status(400).json({ error: "Esta acción no está disponible en la fase actual del expediente." });
      }
      // "Continuar sin enviar": marca el paso (sella la fecha) SIN mandar correo.
      if (String(req.body.skip || "") === "1") {
        let selloSkip = "ok";
        try {
          await _sellarUltimatum(comu, campoFecha);
        } catch (e) { selloSkip = "omitido"; console.warn("[presupuestos][ultimatum][skip] no se pudo sellar " + campoFecha + ":", e.message); }
        return res.json({ ok: true, skipped: true, sello: selloSkip });
      }
      const plantilla = await leerPlantillaMail(codigoPlantilla);
      if (!plantilla)          return res.status(400).json({ error: "Sin plantilla " + codigoPlantilla + " en mail_plantillas." });
      if (!plantilla.activo)   return res.status(400).json({ error: "Plantilla " + codigoPlantilla + " desactivada." });

      const _d = _destinatariosCcpp(comu);
      // Valores de plantilla (variables resueltas).
      // v18.99i — Los sub-mails de ultimátum (AVISO/RESOLUCION) heredan del contenedor
      // los campos que no tengan propios: asunto y cuenta_envio (remitente). El mensaje
      // y el cco ya son propios, pero se heredan también si estuvieran vacíos.
      {
        const _cU = { "05_ULT_AVISO": "05_ULTIMATUM_DOC", "05_ULT_RESOLUCION": "05_ULTIMATUM_DOC", "08_ULT_AVISO": "08_ULTIMATUM_CYCP", "08_ULT_RESOLUCION": "08_ULTIMATUM_CYCP" }[codigoPlantilla];
        const _falta = !String(plantilla.asunto || "").trim() || !String(plantilla.cuenta_envio || "").trim() || !String(plantilla.cco || "").trim() || !String(plantilla.adjuntos_fijos || "").trim();
        if (_cU && _falta) {
          try {
            const _pcU = await leerPlantillaMail(_cU);
            if (_pcU) {
              if (!String(plantilla.asunto || "").trim() && String(_pcU.asunto || "").trim()) plantilla.asunto = _pcU.asunto;
              if (!String(plantilla.cuenta_envio || "").trim() && String(_pcU.cuenta_envio || "").trim()) plantilla.cuenta_envio = _pcU.cuenta_envio;
              if (!String(plantilla.cco || "").trim() && String(_pcU.cco || "").trim()) plantilla.cco = _pcU.cco;
              if (!String(plantilla.adjuntos_fijos || "").trim() && String(_pcU.adjuntos_fijos || "").trim()) plantilla.adjuntos_fijos = _pcU.adjuntos_fijos;
            }
          } catch (e) {}
        }
      }
      // v18.99o — la comprobación del remitente va AQUÍ, DESPUÉS de heredar del
      // contenedor (antes iba antes y rechazaba los sub-mails de ultimátum, que
      // tienen el remitente vacío en el Sheet y lo heredan del contenedor).
      if (!plantilla.cuenta_envio) return res.status(400).json({ error: "Plantilla " + codigoPlantilla + " sin cuenta de envío (ni propia ni heredada del contenedor)." });
      const _asuT = (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
      const _msgT = (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
      // OVERRIDES del modal: si el usuario editó los campos, se respetan; si no, plantilla.
      const _has = (v) => (v != null && String(v).trim() !== "");
      const dest    = _has(req.body.destinatario) ? String(req.body.destinatario).trim() : _d.to;
      const destCc  = (req.body.cc  != null) ? String(req.body.cc).trim()  : _d.cc;
      const ccoF    = (req.body.cco != null) ? String(req.body.cco).trim() : (plantilla.cco || "");
      const asuntoF  = _has(req.body.asunto)  ? String(req.body.asunto)  : _asuT;
      const mensajeF = _has(req.body.mensaje) ? String(req.body.mensaje) : _msgT;
      const adjF     = (req.body.adjuntos != null) ? String(req.body.adjuntos) : String(plantilla.adjuntos_fijos || "");
      if (!dest) return res.status(400).json({ error: "El expediente no tiene email de administrador ni de presidente configurado." });

      let msgId = "";
      try {
        msgId = await enviarMailReal({
          cuentaId: plantilla.cuenta_envio,
          destinatario: dest,
          cc:  destCc,
          cco: ccoF,
          asunto: asuntoF,
          mensaje: mensajeF,
          adjuntosUrls: String(adjF).split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
        });
      } catch (errEnv) {
        console.error("[presupuestos][ultimatum] enviarMailReal falló (" + codigoPlantilla + "):", errEnv.message);
        return res.status(502).json({ error: "Fallo al enviar el mail: " + errEnv.message });
      }

      await registrarMailEnHistorico({
        fecha: new Date().toISOString(), ccpp_id: id,
        direccion: comu.direccion || comu.comunidad, fase: "05_DOCUMENTACION",
        destinatario: dest, cc: destCc, cco: ccoF,
        asunto: asuntoF, mensaje: mensajeF,
        adjuntos: adjF, tipo: "manual",
        message_id: msgId,
      });

      // Sellar la MARCA de fecha (solo la primera vez; no se pisa si ya estaba).
      let sello = "ok";
      try {
        await _sellarUltimatum(comu, campoFecha);
      } catch (errSello) {
        sello = "omitido";
        console.warn("[presupuestos][ultimatum] no se pudo sellar " + campoFecha + " (¿falta la columna en el Sheet?):", errSello.message);
      }
      return res.json({ ok: true, enviado: codigoPlantilla, sello });
    } catch (e) {
      console.error("[presupuestos][ultimatum] error:", e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  // Botón "⚠️ Ampliar plazo"  → manda 05_ULT_AVISO, marca BL.
  app.post("/presupuestos/ultimatum/ampliar",  (req, res) => _coreBotonUltimatum(req, res, "05_ULT_AVISO",      "fecha_ultimatum_ampliado"));
  // Botón "⚠️ Nombrar disidentes" → manda 05_ULT_RESOLUCION, marca BM.
  app.post("/presupuestos/ultimatum/disidentes", (req, res) => _coreBotonUltimatum(req, res, "05_ULT_RESOLUCION", "fecha_disidentes_solicitados"));
  // Botón "⚠️ Resolver contrato" → manda 05_ULT_RESOLVER (plantilla nueva), marca BN.
  app.post("/presupuestos/ultimatum/resolver",  (req, res) => _coreBotonUltimatum(req, res, "05_ULT_RESOLVER",   "fecha_contrato_resuelto"));
  // Botón "Aviso prórroga 2" (recordatorio) → REENVÍA 05_ULT_AVISO; marca flag en mails_enviados (no sella columna).
  app.post("/presupuestos/ultimatum/recordar",  (req, res) => _coreBotonUltimatum(req, res, "05_ULT_AVISO",      "@flag:05_ULT_RECORDATORIO"));
  app.post("/presupuestos/ultimatum8/ampliar",   (req, res) => _coreBotonUltimatum(req, res, "08_ULT_AVISO",      "fecha_ultimatum_ampliado",     "08_CYCP"));
  app.post("/presupuestos/ultimatum8/disidentes",(req, res) => _coreBotonUltimatum(req, res, "08_ULT_RESOLUCION", "fecha_disidentes_solicitados", "08_CYCP"));
  app.post("/presupuestos/ultimatum8/resolver", (req, res) => _coreBotonUltimatum(req, res, "08_ULT_RESOLVER",   "fecha_contrato_resuelto",       "08_CYCP"));
  app.post("/presupuestos/ultimatum8/recordar", (req, res) => _coreBotonUltimatum(req, res, "08_ULT_AVISO",      "@flag:08_ULT_RECORDATORIO",     "08_CYCP"));
  // ===== FIN TANDA 1 =====

  // POST /presupuestos/admin/actualizar — Propaga tel/email del administrador a todas sus CCPPs
  app.post("/presupuestos/admin/actualizar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const nombreAdmin = String(req.body.nombre_admin || "").trim();
      const campo       = String(req.body.campo || "").trim();          // "telefono" o "email"
      const valor       = String(req.body.valor || "").trim();
      if (!nombreAdmin) return res.status(400).json({ error: "nombre_admin requerido" });
      if (!["telefono", "email"].includes(campo)) {
        return res.status(400).json({ error: "campo debe ser 'telefono' o 'email'" });
      }
      // Mapear campo cliente → columna sheet
      const campoSheet = campo === "telefono" ? "telefono_administrador" : "email_administrador";
      const valorLimpio = campo === "telefono" ? valor.replace(/\D/g, "") : valor;

      const comunidades = await leerComunidades();
      const nombreNorm = nombreAdmin.toLowerCase();
      const afectadas = comunidades.filter(c =>
        String(c.administrador || "").trim().toLowerCase() === nombreNorm
      );
      let actualizadas = 0;
      for (const c of afectadas) {
        if (String(c[campoSheet] || "") === valorLimpio) continue; // ya tiene ese valor
        c[campoSheet] = valorLimpio;
        await actualizarComunidad(c._rowIndex, c);
        actualizadas++;
      }
      console.log(`[presupuestos] Admin "${nombreAdmin}" - ${campo} actualizado en ${actualizadas} CCPPs`);
      res.json({ ok: true, actualizadas, totalConEseAdmin: afectadas.length });
    } catch (e) {
      console.error("[presupuestos] /admin/actualizar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // CRON INTERNO: revisa fichas en 01_CONTACTO y 04_ACEPTACION_PTO para enviar mails automáticos
  // =================================================================
  // Filosofía:
  //  - Solo actúa sobre fichas en CRON_FASES_AUTO con al menos 1 envío manual previo
  //  - max_envios de la plantilla = nº máximo de REENVÍOS AUTOMÁTICOS (no de envíos totales)
  //  - Cuando se alcanza el tope: NO descarta automáticamente. Para los envíos y manda
  //    aviso al admin (administracion@instalacionesaraujo.com) para que decida manualmente.
  //  - Margen 7 días: si está vencido más de 7 días, NO se envía atrasado, se reanuda en próxima fecha
  //  - Para 01_CONTACTO: requiere primer envío manual; cuando llega al tope → para y avisa
  //  - Para 04_ACEPTACION_PTO: el primer envío manual lo hace el botón "Enviar presupuesto"
  //    de fase 03 que pasa a 04. El cron arranca la cadencia 'cadenciaInicialDias' (3) desde
  //    el último envío; siguientes cada 'dias_recurrente' (30); para al alcanzar max_envios.
  //    Si fecha_proximo_mail_manual está rellena, sustituye al cálculo: envía en esa fecha
  //    exacta y resetea solo los automáticos (los manuales se mantienen).
  const CRON_FASES_AUTO = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"];
  const CRON_MARGEN_DIAS = 7;
  const cronStatus = { ultimoTick: null, ultimoResumen: null, ultimoError: null, ultimosErrores: [] };

  async function ejecutarCronEnviosAutomaticos() {
    const inicio = new Date();
    const resumen = { revisadas: 0, enviadas: 0, descartadas: 0, omitidas_margen: 0, errores: 0, detalleErrores: [] };
    try {
      const comunidades = await leerComunidades();

      // v17.20: precargar las 4 plantillas que usa el cron UNA SOLA VEZ
      // (antes se leía la pestaña entera dentro del bucle por cada CCPP).
      // Con el caché de _leerFilasMailPlantillas esto ya solo dispara 1
      // lectura del Sheet aunque haya 50 CCPPs. Pasamos las plantillas
      // como mapa para evitar incluso esa lectura repetida.
      const _plantillasCron = {};
      try {
        const _fases = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_SEGUIMIENTO_DOC", "08_SEGUIMIENTO_CYCP"];
        const _arr = await Promise.all(_fases.map(f => leerPlantillaMail(f).catch(() => null)));
        _fases.forEach((f, i) => { _plantillasCron[f] = _arr[i]; });
      } catch (_) { /* si falla la precarga, el bucle hará fallback a leerPlantillaMail por CCPP */ }

      for (const comu of comunidades) {
        const fase = normalizarFase(comu.fase_presupuesto);
        if (!CRON_FASES_AUTO.includes(fase)) continue;
        // Una 08_CYCP ya cerrada (con fecha_cycp_completa) no entra al cron:
        // su trabajo está hecho, no hay reenvíos que disparar.
        if (fase === "08_CYCP" && comu.fecha_cycp_completa) continue;
        const enviados = parsearMailJson(comu.mails_enviados);
        const manuales = parsearMailJson(comu.mails_manuales);
        const ultimo   = parsearMailJson(comu.mails_ultimo_envio);
        const numEnvios = enviados[fase] || 0;
        // Compat con CCPPs antiguos (sin tracking de manuales): asumimos que
        // el primer envío fue manual.
        let numManualesAct;
        if (manuales[fase] !== undefined) {
          numManualesAct = parseInt(manuales[fase]) || 0;
        } else {
          numManualesAct = numEnvios >= 1 ? 1 : 0;
        }

        // ===================================================================
        // ESQUEMA DE LA FASE 05 (documentación) — secuencia, mensajes y días
        // ===================================================================
        //  Día | Nº | Mensaje / Acción                         | Badge en HOY
        //  ----+----+------------------------------------------+---------------------------
        //   0  | 1  | INICIO DOC (05_ACEPTACION_PTO)           | 👍 Inicio doc
        //   5  | 2  | SEGUIMIENTO LISTADO (05_SEG_ESPERA)      | 👍 Listado solicitado · hace 5 d
        //  10  | 3  | SEGUIMIENTO LISTADO (05_SEG_ESPERA)      | 👍 Listado solicitado · hace 10 d
        //  15  | 4  | SEGUIMIENTO LISTADO (05_SEG_ESPERA)      | 👍 Listado solicitado · hace 15 d
        //  20  | -- | (sin listado, sin envío)                 | (aviso) Listado solicitado · hace 20 d
        //  ----  1er bot-whatsapp: anula LISTADO y arranca DOC reanclado al contacto  ----
        //  +5  | 5  | SEGUIMIENTO DOC (05_SEG_FECHA)           | 👍 Doc solicitada · hace X d
        //  +10 | 6  | SEGUIMIENTO DOC (05_SEG_FECHA)           | 👍 Doc solicitada · hace X d
        //  +15 | 7  | SEGUIMIENTO DOC (05_SEG_FECHA)           | 👍 Doc solicitada · hace X d
        //  +20 | 8  | BOTON -> 05_ULT_AVISO (sella BL, para)   | Ampliar plazo -> Plazo ampliado · hace X d
        //  +30 | 9  | 05_ULT_AVISO recordatorio (AUTOMATICO 1x)| Plazo ampliado · hace X d
        //  +40 | 10 | BOTON -> 05_ULT_RESOLUCION (sella BM)    | Nombrar disidentes -> Disidentes solicitados hace X d
        //  +45 | 11 | BOTON -> 05_ULT_RESOLVER (sella BN)      | Resolver contrato -> Contrato resuelto hace X d
        //  cualq| -- | FIN DOC (si entregan todo)               | Doc completa
        //  -------------------------------------------------------------------
        //  TIEMPOS MÁXIMOS (sin ninguna respuesta) hasta RESOLVER el contrato:
        //    LISTADO (desde aceptación):   5+5+5 .................. = 15 d (+aviso a 20)
        //    DOC+ULTIMÁTUM (desde bot-wa): 5+5+5+5+10+10+5 ........ = 45 d
        //    TOTAL si el listado llega al día 20: 20 + 45 ......... = 65 días
        //    (si el listado tarda más, se suma esa espera extra)
        //
        //  Notas: los "+N" del tramo DOC cuentan desde el 1er bot-whatsapp (no desde
        //  la aceptacion). Tope 3 en LISTADO y 3 en DOC. Si se piden disidentes antes
        //  del +30, el recordatorio automatico se suprime. Fechas selladas: BL/BM/BN.
        //  Botones = endpoints /presupuestos/ultimatum/{ampliar,disidentes,resolver}.
        // ===================================================================
        // ===== TANDA 4 — MANEJADOR DEDICADO FASE 05 (comunidades BOT) =====
        // Reanclaje fino + split 3+3. Solo comunidades bot; las manuales (05 no
        // bot, congeladas) caen al tronco compartido de abajo SIN cambios.
        // ===== RECORDATORIO automático del ULTIMÁTUM de FASE 08 (one-shot), calcado del de fase 05 =====
        // Ancla = envío de contratos y cartas (fecha_envio_contratos_pagos) + PLAZO_CYCP_INICIAL (10) + recordatorio.
        if (fase === "08_CYCP") {
          const hoy08 = new Date(); hoy08.setHours(0, 0, 0, 0);
          const hoyISO08 = hoy08.toISOString().slice(0, 10);
          const envio08 = String(comu.fecha_envio_contratos_pagos || "").slice(0, 10);
          const BL08 = String(comu.fecha_ultimatum_ampliado || "").slice(0, 10);
          const BM08 = String(comu.fecha_disidentes_solicitados || "").slice(0, 10);
          const BN08 = String(comu.fecha_contrato_resuelto || "").slice(0, 10);
          if (BL08 && !BM08 && !BN08 && !ultimo["08_ULT_RECORD"] && /^\d{4}-\d{2}-\d{2}$/.test(envio08)) {
            const _plA8 = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
            const _pRec8 = (function(){ const n = parseInt(_plA8 && _plA8.dias_recurrente, 10); return (Number.isFinite(n) && n > 0) ? n : 10; })();
            const _gat8 = new Date(envio08 + "T00:00:00"); _gat8.setDate(_gat8.getDate() + PLAZO_CYCP_INICIAL + _pRec8); // 10 fijo + recordatorio
            if (!isNaN(_gat8.getTime()) && hoy08 >= _gat8) {
              const _dA8 = _destinatariosCcpp(comu);
              if (_plA8 && _plA8.activo && _plA8.cuenta_envio && _dA8.to) {
                const _asuA8 = (await sustituirVariablesAsync(_plA8.asunto, comu)) || "";
                const _msgA8 = (await sustituirVariablesAsync(_plA8.mensaje, comu)) || "";
                const _midA8 = await enviarMailReal({
                  cuentaId: _plA8.cuenta_envio, destinatario: _dA8.to, cc: _dA8.cc, cco: _plA8.cco,
                  asunto: _asuA8, mensaje: _msgA8,
                  adjuntosUrls: String(_plA8.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
                });
                await registrarMailEnHistorico({
                  fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                  direccion: comu.direccion || comu.comunidad, fase: "08_CYCP",
                  destinatario: _dA8.to, cc: _dA8.cc, cco: _plA8.cco, asunto: _asuA8, mensaje: _msgA8,
                  adjuntos: _plA8.adjuntos_fijos || "", tipo: "automatico", message_id: _midA8,
                });
                ultimo["08_ULT_RECORD"] = hoyISO08;
                comu.mails_ultimo_envio = JSON.stringify(ultimo);
                await actualizarComunidad(comu._rowIndex, comu);
                resumen.enviadas++;
                continue;
              }
            }
          }
          // Si ya se entró en el ultimátum de fase 08, el seguimiento automático PARA (lo llevan los botones + el recordatorio).
          if (BL08 || BM08 || BN08) continue;
        }
        if (fase === "05_DOCUMENTACION" && String(comu.bot_comunidad_activo || "").trim().toUpperCase() === "BOT_WHATSAPP") {
          try {
            const hoy05 = new Date(); hoy05.setHours(0, 0, 0, 0);
            const hoyISO05 = hoy05.toISOString().slice(0, 10);
            // Plantilla contenedora (cuenta_envio, asunto, cco, di/dr). El texto
            // ESPERA/FECHA lo elige {{bloque_seguimiento}} al sustituir variables.
            let pl05 = _plantillasCron["05_SEGUIMIENTO_DOC"];
            if (!pl05) { try { pl05 = await leerPlantillaMail("05_SEGUIMIENTO_DOC"); } catch (_) { pl05 = null; } }
            // Fecha límite del bot (= contacto + 20). "" si el bot aún no contactó.
            const lim05 = await _fechaLimiteDocBot(comu);
            let contacto05 = "";
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(lim05))) {
              const _dc = new Date(lim05 + "T00:00:00"); _dc.setDate(_dc.getDate() - 20);
              contacto05 = _dc.toISOString().slice(0, 10);
            }
            const BL05 = String(comu.fecha_ultimatum_ampliado || "").slice(0, 10);
            const BM05 = String(comu.fecha_disidentes_solicitados || "").slice(0, 10);
            const BN05 = String(comu.fecha_contrato_resuelto || "").slice(0, 10);

            // (1) RECORDATORIO (one-shot): ampliación activa, sin disidentes ni
            //     resolución. Se manda a los (X + pRecord) días DESDE EL CONTACTO,
            //     donde X = plazo (AVISO.dias_primer_envio) y pRecord = AVISO.dias_recurrente.
            //     Fijo desde el contacto, no desde cuándo se pulsó Ampliar.
            if (BL05 && !BM05 && !BN05 && !ultimo["05_ULT_RECORD"] && contacto05) {
              const _plA = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
              const _pRec = (function(){ const n = parseInt(_plA && _plA.dias_recurrente, 10); return (Number.isFinite(n) && n > 0) ? n : 10; })();
              const _gat = new Date(contacto05 + "T00:00:00"); _gat.setDate(_gat.getDate() + PLAZO_DOC_INICIAL + _pRec); // 20 fijo + recordatorio
              if (!isNaN(_gat.getTime()) && hoy05 >= _gat) {
                const _dA = _destinatariosCcpp(comu);
                if (_plA && _plA.activo && _plA.cuenta_envio && _dA.to) {
                  const _asuA = (await sustituirVariablesAsync(_plA.asunto, comu)) || "";
                  const _msgA = (await sustituirVariablesAsync(_plA.mensaje, comu)) || "";
                  const _midA = await enviarMailReal({
                    cuentaId: _plA.cuenta_envio, destinatario: _dA.to, cc: _dA.cc, cco: _plA.cco,
                    asunto: _asuA, mensaje: _msgA,
                    adjuntosUrls: String(_plA.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
                  });
                  await registrarMailEnHistorico({
                    fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                    direccion: comu.direccion || comu.comunidad, fase: "05_DOCUMENTACION",
                    destinatario: _dA.to, cc: _dA.cc, cco: _plA.cco, asunto: _asuA, mensaje: _msgA,
                    adjuntos: _plA.adjuntos_fijos || "", tipo: "automatico", message_id: _midA,
                  });
                  ultimo["05_ULT_RECORD"] = hoyISO05;
                  comu.mails_ultimo_envio = JSON.stringify(ultimo);
                  await actualizarComunidad(comu._rowIndex, comu);
                  resumen.enviadas++;
                  continue;
                }
              }
            }

            // (2) Si ya se entró en ultimátum, el seguimiento automático PARA:
            //     los correos los llevan los botones (+ el recordatorio de arriba).
            if (BL05 || BM05 || BN05) continue;

            // (3) SEGUIMIENTO con split y reanclaje.
            // v18.122: dias_primer_envio = 0 significa "el mismo dia del ancla" (antes 0||5 => 5).
            const di05 = (function(){ const n = parseInt(pl05 && pl05.dias_primer_envio, 10); return (Number.isFinite(n) && n >= 0) ? n : 5; })();
            const dr05 = (pl05 && pl05.dias_recurrente) || 5;
            // v18.122: el tope por tramo lo manda la casilla max_envios de 05_SEGUIMIENTO_DOC (antes fijo a 3).
            const CAP05 = (function(){ const n = parseInt(pl05 && pl05.max_envios, 10); return (Number.isFinite(n) && n > 0) ? n : 3; })();
            let anchor05, cntKey05;
            if (contacto05) { anchor05 = contacto05;                              cntKey05 = "05_DOC_N"; }
            else            { anchor05 = String(comu.fecha_aceptacion_pto || "").slice(0, 10); cntKey05 = "05_LISTADO_N"; }
            const cnt05 = parseInt(enviados[cntKey05] || 0) || 0;

            const fechaManual05 = (comu.fecha_proximo_mail_manual || "").trim();
            let debe05 = false, consumir05 = false;
            if (fechaManual05) {
              const fm05 = new Date(fechaManual05); fm05.setHours(0, 0, 0, 0);
              if (isNaN(fm05.getTime())) { comu.fecha_proximo_mail_manual = ""; await actualizarComunidad(comu._rowIndex, comu); continue; }
              if (hoy05 >= fm05) { debe05 = true; consumir05 = true; } else { continue; }
            } else {
              if (cnt05 >= CAP05) continue; // sub-tramo agotado → badge/botón toma el relevo
              if (!/^\d{4}-\d{2}-\d{2}$/.test(String(anchor05))) continue;
              const _base = new Date(anchor05 + "T00:00:00");
              const _target = new Date(_base); _target.setDate(_target.getDate() + di05 + dr05 * cnt05);
              if (hoy05 < _target) continue;
              const _venc = Math.floor((hoy05 - _target) / 86400000);
              if (_venc > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
              debe05 = true;
            }

            resumen.revisadas++;
            if (!debe05) continue;
            if (!pl05 || !pl05.activo || !pl05.cuenta_envio) continue;
            const _d05 = _destinatariosCcpp(comu);
            if (!_d05.to) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Falta email del administrador y del presidente" }); continue; }
            const _asu05 = (await sustituirVariablesAsync(pl05.asunto, comu)) || "";
            const _msg05 = (await sustituirVariablesAsync(pl05.mensaje, comu)) || "";
            const _mid05 = await enviarMailReal({
              cuentaId: pl05.cuenta_envio, destinatario: _d05.to, cc: _d05.cc, cco: pl05.cco,
              asunto: _asu05, mensaje: _msg05,
              adjuntosUrls: String(pl05.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
            });
            await registrarMailEnHistorico({
              fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
              direccion: comu.direccion || comu.comunidad, fase: "05_DOCUMENTACION",
              destinatario: _d05.to, cc: _d05.cc, cco: pl05.cco, asunto: _asu05, mensaje: _msg05,
              adjuntos: pl05.adjuntos_fijos || "", tipo: "automatico", message_id: _mid05,
            });
            // Contador total (compat ficha) + sub-contador del tramo.
            enviados["05_DOCUMENTACION"] = (enviados["05_DOCUMENTACION"] || 0) + 1;
            if (manuales["05_DOCUMENTACION"] === undefined) { manuales["05_DOCUMENTACION"] = numManualesAct; comu.mails_manuales = JSON.stringify(manuales); }
            ultimo["05_DOCUMENTACION"] = hoyISO05;
            enviados[cntKey05] = cnt05 + 1;
            if (consumir05) comu.fecha_proximo_mail_manual = "";
            comu.mails_enviados = JSON.stringify(enviados);
            comu.mails_ultimo_envio = JSON.stringify(ultimo);
            await actualizarComunidad(comu._rowIndex, comu);
            resumen.enviadas++;
            continue;
          } catch (e05) {
            console.warn("[presupuestos][cron][05bot] " + (comu.direccion || comu.comunidad) + ":", e05.message);
            continue; // ante error NO caemos al tronco viejo (evita doble envío)
          }
        }
        // ===== FIN manejador 05 BOT =====

        const numAutomaticos = Math.max(0, numEnvios - numManualesAct);

        // ----- FASE 01: requiere primer envío manual previo -----
        if (fase === "01_CONTACTO") {
          if (numEnvios < 1) continue; // cron no activado (no hay envío manual previo)
          const fechaUltimo = ultimo[fase];
          if (!fechaUltimo) continue;
          resumen.revisadas++;
          // v17.20: plantilla precargada al inicio; si la precarga falló, fallback.
          let plantilla = _plantillasCron[fase];
          if (!plantilla) {
            try { plantilla = await leerPlantillaMail(fase); } catch (e) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error leyendo plantilla: " + e.message }); continue; }
          }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 0;
          const mx = plantilla.max_envios || 0; // tope de REENVÍOS AUTOMÁTICOS
          if (dr <= 0 || mx <= 0) continue;
          const hoy = new Date(); hoy.setHours(0,0,0,0);

          // Modo "fecha manual": si está rellena, sustituye a la cadencia
          // normal. Cuando hoy >= fm → envía y consume (resetea automáticos).
          // Cuando hoy < fm → no envía aún (espera).
          const fechaManual01 = (comu.fecha_proximo_mail_manual || "").trim();
          let debeEnviar01 = false;
          let consumirManual01 = false;
          if (fechaManual01) {
            const fm = new Date(fechaManual01); fm.setHours(0,0,0,0);
            if (isNaN(fm.getTime())) {
              // Fecha mal formada → limpiar y seguir con cadencia normal
              consumirManual01 = true;
            } else if (hoy >= fm) {
              debeEnviar01 = true;
              consumirManual01 = true;
            } else {
              // Hay fecha manual futura → bloquea cadencia normal, no enviar todavía
              continue;
            }
          } else {
            // Modo cadencia normal (comportamiento histórico)
            const fu = new Date(fechaUltimo); fu.setHours(0,0,0,0);
            // v: el PRIMER reenvío automático usa dias_primer_envio (si > 0);
            //    a partir del segundo, dias_recurrente. numAutomaticos===0 => primero.
            const _di01 = parseInt(plantilla.dias_primer_envio, 10) || 0;
            const _umbral01 = (numAutomaticos === 0 && _di01 > 0) ? _di01 : dr;
            const diasDesde = Math.floor((hoy - fu) / 86400000);
            if (diasDesde < _umbral01) continue;
            // Margen
            const diasVencido = diasDesde - _umbral01;
            if (diasVencido > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
            debeEnviar01 = true;
          }
          // ¿Ya estaba en tope de automáticos? El cron NO descarta
          // automáticamente: se queda esperando decisión humana (el aviso
          // ya se envió cuando se alcanzó el tope).
          // v17.29: nuevo concepto de "ciclo". Cada ciclo tiene mx reenvíos.
          // Si está en final de ciclo (numAutomaticos % mx === 0 con >0):
          //   - Si viene de fecha manual → SE PERMITE: arranca nuevo ciclo.
          //   - Si es cadencia normal → se para esperando decisión humana.
          const enCicloAgotado01 = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
          if (debeEnviar01 && enCicloAgotado01 && !consumirManual01) {
            continue;
          }
          if (!debeEnviar01 && !consumirManual01) continue;
          // Enviar automático
          try {
            let nuevosAuto = numAutomaticos;
            if (debeEnviar01) {
              const _d = _destinatariosCcpp(comu);
              const dest = _d.to;
              const destCc = _d.cc;
              if (!dest) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Falta email del administrador y del presidente" }); continue; }
              if (!plantilla.cuenta_envio) {
                console.warn(`[presupuestos][cron][01] plantilla sin cuenta_envio: ${comu.direccion}`);
                resumen.errores++;
                resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Plantilla sin cuenta de envío configurada" });
                continue;
              }
              const asuntoSus  = (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
              const mensajeSus = (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
              const msgIdEnviado = await enviarMailReal({
                cuentaId: plantilla.cuenta_envio,
                destinatario: dest,
                cc:  destCc,
                cco: plantilla.cco,
                asunto: asuntoSus,
                mensaje: mensajeSus,
                adjuntosUrls: [], // 01-CONTACTO no lleva adjuntos
              });
              await registrarMailEnHistorico({
                fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                direccion: comu.direccion || comu.comunidad, fase,
                destinatario: dest,
                cc:  destCc,
                cco: plantilla.cco,
                asunto: asuntoSus, mensaje: mensajeSus,
                adjuntos: "", tipo: "automatico",
                message_id: msgIdEnviado,
              });
              // v17.29: NO reseteamos los automáticos al consumir fecha manual.
              // Sumamos siempre: así si max_envios=2 y luego ampliamos con otro
              // ciclo más, queda numAutomaticos=4 > 2 → detectable como ampliado
              // (para el badge "👎 Retrasado" permanente).
              enviados[fase] = numEnvios + 1;
              nuevosAuto = numAutomaticos + 1;
              // Sembrar manuales si era CCPP antiguo (compat)
              if (manuales[fase] === undefined) {
                manuales[fase] = numManualesAct;
                comu.mails_manuales = JSON.stringify(manuales);
              }
              ultimo[fase] = new Date().toISOString().slice(0, 10);
              comu.mails_enviados = JSON.stringify(enviados);
              comu.mails_ultimo_envio = JSON.stringify(ultimo);
              resumen.enviadas++;
            }
            if (consumirManual01) {
              comu.fecha_proximo_mail_manual = "";
            }
            await actualizarComunidad(comu._rowIndex, comu);
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
            resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error al enviar: " + e.message });
          }
          continue;
        }

        // ----- FASE 04: primer envío automático + tope opcional + fecha manual -----
        // Si la plantilla tiene max_envios > 0, el cron PARA al alcanzarlo y avisa
        // al admin (no descarta automáticamente: queda en fase 04 esperando que
        // se decida manualmente — aceptar / rechazar / descartar / reenviar).
        // Si max_envios == 0 → sin tope (comportamiento histórico).
        if (fase === "04_ACEPTACION_PTO" || fase === "05_DOCUMENTACION" || fase === "08_CYCP") {
          // v17.20: plantilla precargada al inicio; si la precarga falló, fallback.
          let plantilla = _plantillasCron[plantillaDeFase(fase)];
          if (!plantilla) {
            try { plantilla = await leerPlantillaMail(plantillaDeFase(fase)); } catch (e) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error leyendo plantilla: " + e.message }); continue; }
          }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 30;
          const di = plantilla.dias_primer_envio || 3;
          const mx = plantilla.max_envios || 0;

          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const fechaManual = (comu.fecha_proximo_mail_manual || "").trim();
          let debeEnviar = false;
          let consumirManual = false;

          if (fechaManual) {
            // Modo fecha manual: solo se envía cuando hoy >= fecha manual
            const fm = new Date(fechaManual); fm.setHours(0,0,0,0);
            if (isNaN(fm.getTime())) {
              // Fecha mal formada → ignorar y borrar
              consumirManual = true;
            } else if (hoy >= fm) {
              debeEnviar = true;
              consumirManual = true;
            }
          } else {
            // Modo cadencia normal: primer reenvío automático a 'di' días desde
            // el último envío manual; siguientes reenvíos cada 'dr' días.
            // v17.29: nuevo concepto de "ciclo". Cada ciclo permite hasta mx
            // reenvíos automáticos. Cuando se completa un ciclo (numAutomaticos
            // múltiplo de mx) y NO hay fecha manual nueva → para. Si se mete
            // fecha manual → arranca nuevo ciclo (el envío disparado por la
            // fecha manual cuenta como el primero del ciclo nuevo, y a partir
            // de ahí siguen cadencia 'dr' hasta completar mx más).
            const enCicloAgotado = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
            if (enCicloAgotado) continue;
            let fechaBase, dias;
            if (numAutomaticos < 1) {
              // Primer reenvío automático a 'di' días desde el último envío
              // MANUAL registrado en la clave de la fase. v18.41: ELIMINADO el
              // fallback a comu.fecha_ultimo_seguimiento_pto. Antes, un expediente
              // que entraba en 04 SIN enviar mail (botón "Saltar envío" o avance
              // genérico) tenía la fecha de seguimiento sellada y el cron
              // arrancaba SOLO, mandando seguimientos no deseados (la clave 04
              // estaba vacía pero el fallback la suplía). Regla acordada: el cron
              // de la 04 SOLO arranca si hay un envío real registrado en la clave
              // 04 (envío del presupuesto, reenvío revisado o fecha manual). Sin
              // clave 04 poblada -> ultimo[fase] es undefined -> no dispara
              // (queda en espera hasta que el usuario actúe). El modo "fecha
              // manual" de arriba sigue intacto: marcar fecha SÍ arranca el cron.
              fechaBase = ultimo[fase];
              dias = di;
            } else {
              // Ya hay reenvíos automáticos → 'dr' días desde el último envío
              fechaBase = ultimo[fase];
              dias = dr;
            }
            if (!fechaBase) continue;
            const fb = new Date(fechaBase); fb.setHours(0,0,0,0);
            if (isNaN(fb.getTime())) continue;
            const diasDesde = Math.floor((hoy - fb) / 86400000);
            if (diasDesde < dias) continue;
            const diasVencido = diasDesde - dias;
            if (diasVencido > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
            debeEnviar = true;
          }

          resumen.revisadas++;
          if (!debeEnviar && !consumirManual) continue;

          try {
            let nuevosAuto04 = null;
            if (debeEnviar) {
              const _d04 = _destinatariosCcpp(comu);
              const dest04 = _d04.to;
              const destCc04 = _d04.cc;
              if (!dest04) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Falta email del administrador y del presidente" }); continue; }
              if (!plantilla.cuenta_envio) {
                console.warn(`[presupuestos][cron][04] plantilla sin cuenta_envio: ${comu.direccion}`);
                resumen.errores++;
                resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Plantilla sin cuenta de envío configurada" });
                continue;
              }
              const asuntoSus04  = (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
              const mensajeSus04 = (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
              const msgIdEnviado04 = await enviarMailReal({
                cuentaId: plantilla.cuenta_envio,
                destinatario: dest04,
                cc:  destCc04,
                cco: plantilla.cco,
                asunto: asuntoSus04,
                mensaje: mensajeSus04,
                adjuntosUrls: String(plantilla.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
              });
              await registrarMailEnHistorico({
                fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                direccion: comu.direccion || comu.comunidad, fase,
                destinatario: dest04,
                cc:  destCc04,
                cco: plantilla.cco,
                asunto: asuntoSus04, mensaje: mensajeSus04,
                adjuntos: plantilla.adjuntos_fijos || "", tipo: "automatico",
                message_id: msgIdEnviado04,
              });
              // v17.29: NO reseteamos los automáticos al consumir fecha manual.
              // Sumamos siempre: numAutomaticos crece más allá de max_envios,
              // lo que permite detectar ampliación (badge "👎 Retrasado" permanente).
              enviados[fase] = (enviados[fase] || 0) + 1;
              nuevosAuto04 = numAutomaticos + 1;
              // Sembrar manuales si era CCPP antiguo (compat)
              if (manuales[fase] === undefined) {
                manuales[fase] = numManualesAct;
                comu.mails_manuales = JSON.stringify(manuales);
              }
              ultimo[fase] = new Date().toISOString().slice(0, 10);
              comu.mails_enviados = JSON.stringify(enviados);
              comu.mails_ultimo_envio = JSON.stringify(ultimo);
              resumen.enviadas++;
            }
            if (consumirManual) {
              comu.fecha_proximo_mail_manual = "";
            }
            await actualizarComunidad(comu._rowIndex, comu);
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
            resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error al enviar: " + e.message });
          }
          continue;
        }
      }
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoResumen = resumen;
      cronStatus.ultimoError = null;
      cronStatus.ultimosErrores = resumen.detalleErrores || [];
      console.log(`[presupuestos][cron] ${inicio.toISOString()} - revisadas:${resumen.revisadas} enviadas:${resumen.enviadas} descartadas:${resumen.descartadas} omitidas_margen:${resumen.omitidas_margen} errores:${resumen.errores}`);
      return resumen;
    } catch (e) {
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoError = e.message;
      cronStatus.ultimosErrores = [{ direccion: "(global)", fase: "-", motivo: e.message }];
      console.error("[presupuestos][cron] error global:", e.message);
      throw e;
    }
  }

  // Programar el cron interno: 1 vez al día (24h)
  // Primera ejecución a los 60s del arranque (para que la app esté lista)
  if (typeof setInterval === "function") {
    setTimeout(() => {
      ejecutarCronEnviosAutomaticos().catch(() => {});
    }, 60 * 1000);
    setInterval(() => {
      ejecutarCronEnviosAutomaticos().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }

  // Job de verificación de adjuntos de plantillas CRON: cada hora comprueba
  // que los links de Drive de plantillas con cadencia automática (dr > 0)
  // siguen accesibles. Alimenta _adjuntosRotos para el botón HOY.
  // Es muy ligero (solo cabeceras HTTP), no descarga nada.
  async function verificarAdjuntosDePlantillasCron() {
    try {
      // v17.20: usa el caché compartido en vez de leer directamente
      const rows = await _leerFilasMailPlantillas();
      // Cabecera: A fase | B activo | C asunto | D mensaje | E adjuntos | F dpe | G dr | H max | ...
      const urls = new Set();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const fase = String(row[0]).trim();
        if (fase.startsWith("_")) continue;
        const activo = (row[1] || "SI").toUpperCase() === "SI";
        if (!activo) continue;
        const dr = parseInt(row[6], 10);
        if (!(dr > 0)) continue; // solo plantillas con cadencia automática
        const adj = row[4] || "";
        for (const e of parsearAdjuntosTexto(adj)) {
          if (e.url && extraerIdDrive(e.url)) urls.add(e.url);
        }
      }
      // Verificar cada URL
      for (const url of urls) {
        const { ok, motivo } = await verificarLinkDrive(url);
        if (ok) {
          _adjuntosRotos.delete(url);
        } else {
          _adjuntosRotos.set(url, { ultimaComprobacion: new Date(), motivo });
        }
      }
    } catch (e) {
      console.warn("[presupuestos] verificarAdjuntosDePlantillasCron falló:", e.message);
    }
  }
  if (typeof setInterval === "function") {
    setTimeout(() => { verificarAdjuntosDePlantillasCron().catch(() => {}); }, 90 * 1000);
    setInterval(() => { verificarAdjuntosDePlantillasCron().catch(() => {}); }, 60 * 60 * 1000);
  }

  // GET /presupuestos/cron-status — diagnóstico del cron
  // GET /presupuestos/adjuntos-rotos
  // Devuelve los links de Drive que han fallado en el último intento de envío
  // o en la última verificación periódica. Para el botón HOY.
  app.get("/presupuestos/adjuntos-rotos", async (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      ok: true,
      rotos: listarAdjuntosRotos(),
    });
  });

  app.get("/presupuestos/cron-status", async (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      ok: true,
      ultimoTick: cronStatus.ultimoTick,
      ultimoResumen: cronStatus.ultimoResumen,
      ultimoError: cronStatus.ultimoError,
      ultimosErrores: cronStatus.ultimosErrores || [],
      proximoTick: "cada 24h desde el arranque",
      fases_automaticas: CRON_FASES_AUTO,
      margen_dias: CRON_MARGEN_DIAS,
    });
  });

  // POST /presupuestos/cron-run — ejecutar cron manualmente (para pruebas).
  // Protegido contra doble disparo:
  //   - Mutex: si ya hay un cron corriendo, devuelve 409 sin lanzar otro.
  //   - Throttle: si el último cron terminó hace menos de 2 min, rebota con 429.
  let _cronEnMarcha = false;
  const _CRON_THROTTLE_MS = 2 * 60 * 1000;
  app.post("/presupuestos/cron-run", async (req, res) => {
    if (!checkToken(req, res)) return;
    if (_cronEnMarcha) {
      return res.status(409).json({ error: "Ya hay un cron en marcha. Espera a que termine." });
    }
    if (cronStatus.ultimoTick) {
      const dt = Date.now() - new Date(cronStatus.ultimoTick).getTime();
      if (dt < _CRON_THROTTLE_MS) {
        const seg = Math.ceil((_CRON_THROTTLE_MS - dt) / 1000);
        return res.status(429).json({ error: `El cron se ejecutó hace muy poco. Espera ${seg}s antes de volver a lanzarlo.` });
      }
    }
    _cronEnMarcha = true;
    try {
      const resumen = await ejecutarCronEnviosAutomaticos();
      res.json({ ok: true, resumen });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      _cronEnMarcha = false;
    }
  });

  // =================================================================
  // ENDPOINTS IMAP (mails entrantes)
  // =================================================================

  // POST /presupuestos/imap-run — ejecutar una pasada manual del IMAP.
  app.post("/presupuestos/imap-run", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const r = await ejecutarLecturaImap();
      res.json(r);
    } catch (e) {
      console.error("[presupuestos] /imap-run:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/imap-importar-drive — importar .eml sueltos de Drive.
  // Lee la carpeta DRIVE_FOLDER_EML_IMPORTAR, procesa cada .eml igual que
  // el cron IMAP (parseo, stripping, clasificación, adjuntos, pendientes)
  // y mueve cada .eml a la subcarpeta "Procesados".
  app.post("/presupuestos/imap-importar-drive", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const r = await importarEmlsDeDrive();
      res.json(r);
    } catch (e) {
      console.error("[presupuestos] /imap-importar-drive:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/mails-pendientes — devuelve los mails pendientes en JSON.
  app.get("/presupuestos/mails-pendientes", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const lista = await leerMailsPendientes();
      res.json({ ok: true, total: lista.length, mails: lista });
    } catch (e) {
      console.error("[presupuestos] /mails-pendientes:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-clasificar — asigna un mail pendiente a un expediente.
  // body: id (id del mail pendiente), ccpp_id (expediente destino)
  app.post("/presupuestos/mail-clasificar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      if (!id || !ccpp_id) return res.status(400).json({ error: "Faltan id o ccpp_id" });
      // Recuperar mail pendiente
      const pendientes = await leerMailsPendientes();
      const mail = pendientes.find(p => p.id === id);
      if (!mail) return res.status(404).json({ error: "Mail pendiente no encontrado" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      // Mover adjuntos a la subcarpeta "adjuntos" del expediente (si los hay).
      // No bloquea: si falla Drive, seguimos con la clasificación.
      let adjuntosFinales = mail.adjuntos;
      try {
        adjuntosFinales = await _moverAdjuntosACarpetaExpediente(mail.adjuntos, comu);
      } catch (eMov) {
        console.warn("[presupuestos] No se pudieron mover adjuntos al clasificar:", eMov.message);
      }
      // Detectar si es saliente (remitente = nuestra cuenta).
      // Si lo es: tipo "manual_externo", extraer destinatario real del prefijo
      // [TO:...] que añadió el importador al cuerpo, y limpiar ese prefijo del mensaje.
      const esSalienteCl = String(mail.remitente || "").toLowerCase().includes("administracion@instalacionesaraujo.com");
      let destinatarioCl = mail.remitente;
      let mensajeCl = mail.cuerpo || "";
      if (esSalienteCl) {
        const mTo = mensajeCl.match(/^\[TO:([^\]]+)\]\s*\n?/);
        if (mTo) {
          destinatarioCl = mTo[1].trim();
          mensajeCl = mensajeCl.slice(mTo[0].length);
        }
      }
      // Registrar en mail_historico — v18.35: vía _reclasificarOInsertarHistorico,
      // que evita duplicados por message_id (si el mail ya estaba clasificado, MUEVE
      // la fila existente a este expediente en vez de añadir otra; y limpia copias
      // sobrantes si las hubiera de arrastres anteriores).
      await _reclasificarOInsertarHistorico({
        fecha: mail.fecha_recepcion,
        ccpp_id: comu.ccpp_id,
        direccion: comu.direccion,
        fase: normalizarFase(comu.fase_presupuesto),
        destinatario: destinatarioCl,
        asunto: mail.asunto,
        mensaje: mensajeCl,
        adjuntos: adjuntosFinales,
        tipo: esSalienteCl ? "manual_externo" : "manual_entrada",
        message_id: mail.message_id,
      });
      // Actualizar fila en mails_pendientes con estado=clasificado.
      // NO se borra: el mail sigue apareciendo en HOY hasta que el usuario
      // pulse el reloj para sacarlo. Esto es lo que permite "seguir trabajando
      // el mail desde HOY incluso después de clasificarlo".
      await _actualizarEstadoMailPendiente(id, "clasificado", ccpp_id);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-clasificar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-descartar — borra físicamente el mail pendiente
  // (fila + adjuntos a papelera Drive). El nombre se mantiene por compat con
  // el frontend, pero ahora borra de verdad.
  app.post("/presupuestos/mail-descartar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const ok = await _borrarMailPendiente(id);
      if (!ok) return res.status(404).json({ error: "Mail pendiente no encontrado" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-descartar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-toggle-hoy — alterna la presencia de un mail en HOY.
  // Hay dos puntos de entrada:
  //   - Desde HOY (con id de mails_pendientes): siempre quita de HOY (borra fila).
  //   - Desde Comunicaciones del expediente (con message_id de mail_historico):
  //       si el mail está en HOY → lo saca (borra fila de pendientes).
  //       si NO está → lo añade (crea fila nueva en pendientes con estado=clasificado).
  // body: message_id (preferente) o id (id de pendientes)
  app.post("/presupuestos/mail-toggle-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const messageId = String(req.body.message_id || "").trim();
      if (!id && !messageId) return res.status(400).json({ error: "Falta id o message_id" });

      // Buscar si existe ya una fila en mails_pendientes
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
      });
      const rows = r.data.values || [];
      let filaIdx = -1;
      let filaId = "";
      let adjuntosFila = "";
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const estado = String(row[10] || "pendiente");
        if (estado === "descartado") continue;
        if (id && String(row[0] || "") === id) { filaIdx = i; filaId = row[0]; adjuntosFila = row[8] || ""; break; }
        if (messageId && String(row[2] || "").trim() === messageId) { filaIdx = i; filaId = row[0]; adjuntosFila = row[8] || ""; break; }
      }

      if (filaIdx >= 0) {
        // Está en HOY → quitar. Borrar fila SIN papelear adjuntos
        // (porque están enlazados desde mail_historico del expediente).
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        const hoja = meta.data.sheets.find(s => s.properties.title === "mails_pendientes");
        if (!hoja) throw new Error("Pestaña mails_pendientes no encontrada");
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: hoja.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: filaIdx,
                  endIndex: filaIdx + 1,
                },
              },
            }],
          },
        });
        return res.json({ ok: true, accion: "quitado" });
      }

      // No está en HOY → añadir. Necesitamos los datos del mail desde mail_historico.
      if (!messageId) {
        return res.status(400).json({ error: "Para añadir a HOY se necesita message_id" });
      }
      const rH = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      const rowsH = rH.data.values || [];
      let filaH = null;
      for (let i = 1; i < rowsH.length; i++) {
        if (String(rowsH[i][9] || "").trim() === messageId) {
          filaH = rowsH[i];
          break;
        }
      }
      if (!filaH) return res.status(404).json({ error: "Mail no encontrado en mail_historico" });
      const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await _guardarMailPendiente({
        id: idPendiente,
        fecha_recepcion: filaH[0] || new Date().toISOString(),
        message_id: filaH[9] || "",
        in_reply_to: "",
        references: "",
        remitente: filaH[4] || "",   // en entrantes, destinatario es el remitente original
        asunto: filaH[5] || "",
        cuerpo: filaH[6] || "",
        adjuntos: filaH[7] || "",
        sugerencias: [],
        estado: "clasificado",
        clasificado_a: filaH[1] || "",
      });
      res.json({ ok: true, accion: "anadido" });
    } catch (e) {
      console.error("[presupuestos] /mail-toggle-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // PANTALLA HOY — bandejas de tareas pendientes
  // =================================================================
  // Tres cajitas: Mails pendientes, Decidir, Adjuntos rotos.
  app.get("/presupuestos/hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      // 1) Mails pendientes
      const mailsPendientes = await leerMailsPendientes();
      // 2) Avisos de plazo: CCPPs en estado "decidir" o "retrasado"
      //    (incluye fases 01, 04, 05 y 08 — ver calcularEstadoPlazo).
      let avisosPlazo = [];
      // v17.31: estos dos se usan para avisosPlazo y para los badges de plazo de HOY.
      // Por eso se declaran FUERA del try interno.
      const plantillasHoy = {};
      let f1MapHoy = {};
      try {
        // Cargar plantillas de las 4 fases con reenvíos (una sola vez)
        try {
          const arr = await Promise.all(FASES_CON_REENVIOS.map(f => leerPlantillaMail(plantillaDeFase(f)).catch(() => null)));
          FASES_CON_REENVIOS.forEach((f, i) => { plantillasHoy[f] = arr[i] || null; });
        } catch (_) { /* ignore */ }
        // v17.30: leer mail_historico completo UNA vez y construir índice F1
        // a partir de los CONTADORES de cada CCPP (no del histórico).
        const comus = await leerComunidades();
        try {
          const histo = await leerMailHistoricoCompleto();
          f1MapHoy = _indexarF1PorCcppFase(comus, histo, plantillasHoy);
        } catch (_) { /* ignore */ }
        for (const c of comus) {
          const fase = normalizarFase(c.fase_presupuesto);
          if (fase === "ZZ_RECHAZADO" || fase === "ZZ_DESCARTADO") continue;
          const ep = calcularEstadoPlazo(c, plantillasHoy[fase] || null, f1MapHoy);
          if (ep && (ep.estado === "decidir" || ep.estado === "retrasado")) {
            avisosPlazo.push({
              ccpp_id: c.ccpp_id,
              direccion: c.direccion || c.comunidad || "",
              tipo_via: c.tipo_via || "",
              fase,
              estado: ep.estado,
              fechaAviso: ep.fechaAviso,
              diasRetraso: ep.diasRetraso,
            });
          }
        }
        // Orden: más antiguos arriba (fechaAviso ascendente)
        avisosPlazo.sort((a, b) => String(a.fechaAviso).localeCompare(String(b.fechaAviso)));
      } catch (e) { console.warn("[presupuestos][hoy] avisos_plazo:", e.message); }
      // 3) Adjuntos rotos: usa la lista en memoria.
      let adjRotos = [];
      try { adjRotos = listarAdjuntosRotos(); } catch (_) { adjRotos = []; }

      // Helper para escapar HTML
      const _esc = s => String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

      // Para el desplegable "cambiar a otro expediente"
      let comusListado = [];
      try {
        comusListado = await leerComunidades();
      } catch (_) { comusListado = []; }
      const comusActivos = comusListado.filter(c => {
        const f = normalizarFase(c.fase_presupuesto);
        return f !== "ZZ_RECHAZADO" && f !== "ZZ_DESCARTADO";
      });
      // Ordenar alfabéticamente por dirección
      comusActivos.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
      // Rechazados/descartados: NO van en la lista normal, pero sí se ofrecen (abajo,
      // agrupados y etiquetados) para poder asignarles un mail entrante sin tener que
      // reactivarlos antes.
      const comusZZ = comusListado.filter(c => {
        const f = normalizarFase(c.fase_presupuesto);
        return f === "ZZ_RECHAZADO" || f === "ZZ_DESCARTADO";
      });
      comusZZ.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
      const optsExpedientes = comusActivos
        .map(c => `<option value="${_esc(c.ccpp_id)}">${_esc(c.direccion || c.ccpp_id)}</option>`)
        .join("");
      // Mapa ccpp_id -> direccion (para resolver `clasificado_a` y mostrarlo).
      const mapaCcpp = {};
      for (const c of comusListado) {
        if (c.ccpp_id) mapaCcpp[c.ccpp_id] = c.direccion || c.ccpp_id;
      }

      // Formato fecha "dd-mm-aa hh:mm" zona Madrid (igual que cajita Comunicaciones)
      const fmtFechaHoy = (s) => {
        if (!s) return "";
        const t = Date.parse(s);
        if (isNaN(t)) return String(s);
        const d = new Date(t);
        const partes = new Intl.DateTimeFormat('es-ES', {
          timeZone: 'Europe/Madrid',
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        const dd = partes.day, mm = partes.month, aa = partes.year;
        const hh = partes.hour === '24' ? '00' : partes.hour;
        const mi = partes.minute;
        return `${dd}-${mm}-${aa} ${hh}:${mi}`;
      };

      const renderMailPendiente = (m, idx) => {
        const fechaTxt = fmtFechaHoy(m.fecha_recepcion);
        const remitenteTxt = String(m.remitente || "—").trim();
        const asuntoTxt = String(m.asunto || "").trim() || "(sin asunto)";
        const cuerpo = String(m.cuerpo || "");
        const adjTxt = String(m.adjuntos || "").trim();
        // Detectar si es saliente: el remitente coincide con nuestra cuenta.
        const esSaliente = remitenteTxt.toLowerCase().includes("administracion@instalacionesaraujo.com");
        const flechaTxt = esSaliente ? "▲" : "▼";
        const flechaColor = esSaliente ? "var(--ptl-brand)" : "var(--ptl-danger)";

        // Desplegable UNIFICADO (sin sugerencias automáticas):
        //   - Si el mail está ASIGNADO → fondo verde, "✓ <direccion>" seleccionado.
        //   - Si NO está asignado → fondo amarillo, "— elegir expediente —" seleccionado.
        // Al cambiar la selección a un expediente distinto, el JS confirma y
        // llama a /presupuestos/mail-clasificar.
        const dirAsignadaSel = m.clasificado_a ? mapaCcpp[m.clasificado_a] : null;
        let selectBgStyle;
        let opcionInicialHtml;
        let valorInicial = "";
        let excluirCcpp = "";
        if (m.clasificado_a && dirAsignadaSel) {
          selectBgStyle = "background:var(--ptl-success-light);color:var(--ptl-success-dark);font-weight:600";
          opcionInicialHtml = `<option value="${_esc(m.clasificado_a)}" selected>✓ ${_esc(dirAsignadaSel)}</option>`;
          valorInicial = m.clasificado_a;
          excluirCcpp = m.clasificado_a;
        } else {
          // Sin asignar: fondo amarillo y "— elegir expediente —".
          selectBgStyle = "background:var(--ptl-warning-light);color:var(--ptl-warning-dark);font-weight:600";
          opcionInicialHtml = `<option value="" selected>— elegir expediente —</option>`;
        }
        const optsActivosF = comusActivos
          .filter(c => c.ccpp_id !== excluirCcpp)
          .map(c => `<option value="${_esc(c.ccpp_id)}">${_esc(c.direccion || c.ccpp_id)}</option>`)
          .join("");
        const optsZZF = comusZZ
          .filter(c => c.ccpp_id !== excluirCcpp)
          .map(c => {
            const etq = normalizarFase(c.fase_presupuesto) === "ZZ_RECHAZADO" ? "RECHAZADO" : "DESCARTADO";
            return `<option value="${_esc(c.ccpp_id)}">${_esc(c.direccion || c.ccpp_id)} [${etq}]</option>`;
          })
          .join("");
        const optsFiltrados = optsActivosF + (optsZZF ? `<optgroup label="Rechazados / Descartados">${optsZZF}</optgroup>` : "");
        const selectAsignar = `<select class="hoy-select-unif" data-mail-id="${_esc(m.id)}" data-valor-inicial="${_esc(valorInicial)}" title="Asignar a expediente" style="padding:2px 4px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:11px;max-width:220px;${selectBgStyle}">${opcionInicialHtml}${optsFiltrados}</select>`;

        const renderAdj = adjTxt
          ? `<div style="margin-top:6px"><strong>Adjuntos:</strong><div style="font-size:11px;color:var(--ptl-gray-700);white-space:pre-wrap;word-break:break-word">${_esc(adjTxt).replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--ptl-brand);text-decoration:underline">$1</a>').replace(/ \|\| /g, "\n")}</div></div>`
          : "";

        const bgFilaMail = (idx % 2 === 1) ? "background:var(--ptl-general-2);" : "background:var(--ptl-general-3);";
        return `
          <div class="ptl-com-row" data-idx="${idx}" style="${bgFilaMail}border-bottom:1px solid var(--ptl-gray-100)">
            <div class="ptl-com-grid" style="display:grid;grid-template-columns:75px 18px 1fr auto 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px;padding:0 6px;line-height:1.1">
              <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${_esc(fechaTxt)}</div>
              <div style="text-align:center;color:${flechaColor};font-weight:600">${flechaTxt}</div>
              <div class="hoy-toggle-detail hoy-asunto-clic" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-800)" title="${_esc(remitenteTxt)} — ${_esc(asuntoTxt)}">${_esc(asuntoTxt)}</div>
              <div>${selectAsignar}</div>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-responder" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Responder (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↩</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reenviar" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Reenviar (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↪</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reloj ptl-btn-reloj" data-mail-id="${_esc(m.id)}" data-enhoy="1" title="Quitar de HOY">⏰</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar hoy-descartar" data-mail-id="${_esc(m.id)}" title="Borrar este mail (incluidos sus adjuntos en Drive)">✕</button>
            </div>
            <div class="hoy-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
              <div class="ptl-mb4"><strong>Remitente:</strong> ${_esc(remitenteTxt)}</div>
              <div class="ptl-mb4"><strong>Asunto:</strong> ${_esc(asuntoTxt)}</div>
              <div class="ptl-mb4"><strong>Mensaje:</strong></div>
              <div style="white-space:pre-line;word-break:break-word;background:var(--ptl-general-3);padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800);max-height:200px;overflow-y:auto">${_renderCuerpoMail(cuerpo, _esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
              ${renderAdj}
            </div>
          </div>
        `;
      };

      const cajaMails = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title ptl-m0">📥 Mails pendientes (${mailsPendientes.length})</div>
            <div class="ptl-flex-g6">
              <button type="button" id="hoy-imap-run" class="ptl-btn ptl-btn-secondary ptl-btn-sm">📥 Leer correo ahora</button>
              <button type="button" id="hoy-imap-importar-drive" class="ptl-btn ptl-btn-secondary ptl-btn-sm">📂 Importar correo de Drive</button>
            </div>
          </div>
          <style>
            .hoy-mails-list .ptl-vec-btn{width:18px;height:18px;font-size:9px}
          </style>
          ${mailsPendientes.length === 0
            ? `<div class="ptl-empty-msg">— Sin mails pendientes —</div>`
            : `<div class="hoy-mails-list" style="overflow:visible;border-radius:5px;background:var(--ptl-general-3)">${mailsPendientes.map((m, i) => renderMailPendiente(m, i)).join("")}</div>`
          }
        </div>
      `;

      // ============================================================
      // v18.162 — Caja "Sin responder a la presentacion": pisos en pregunta_tipo
      // que llevan >= t_presentacion_2 dias (def 5) sin elegir su situacion (1-5).
      // ============================================================
      const _fmtTel = (tel) => { let n = String(tel || "").replace(/[^0-9]/g, ""); if (n.length === 11 && n.startsWith("34")) n = n.slice(2); if (n.length === 13 && n.startsWith("0034")) n = n.slice(4); if (n.length === 9) return n.slice(0, 3) + "-" + n.slice(3, 6) + "-" + n.slice(6); return n || ""; };
      let _avisosArr = [];
      try {
        const _sheetsSR = getSheetsClient();
        let _umbralPresent = 5;
        let _t1Present = 2; // v18.98 — 1er reenvío de presentación (para el "0-t1-t2")
        let _diaM1 = 5, _diaM2 = 20, _msgWaM1 = "", _msgWaM2 = "", _msgWaM3 = ""; // v18.99 — avisos manuales
        try {
          const _pl = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS });
          const _plr = (_pl.data.values || []);
          for (let i = 1; i < _plr.length; i++) {
            const _k = _plr[i] && String(_plr[i][0] || "").trim();
            const _rawv = _plr[i] ? String(_plr[i][3] || "") : "";
            const _n = parseFloat(_rawv.replace(",", ".").trim());
            if (_k === "t_presentacion_2" && !isNaN(_n) && _n >= 0) _umbralPresent = _n;
            else if (_k === "t_presentacion_1" && !isNaN(_n) && _n >= 0) _t1Present = _n;
            else if (_k === "t_wa_m1" && !isNaN(_n) && _n >= 0) _diaM1 = _n;
            else if (_k === "t_wa_m2" && !isNaN(_n) && _n >= 0) _diaM2 = _n;
            else if (_k === "msg_wa_m1") _msgWaM1 = _rawv;
            else if (_k === "msg_wa_m2") _msgWaM2 = _rawv;
            else if (_k === "msg_wa_m3") _msgWaM3 = _rawv;
          }
        } catch (e) {}
        const _exp = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:AF" });
        const _erows = (_exp.data.values || []);
        // v18.99d — nombres MAESTROS desde la pestaña "pisos" (donde el usuario los edita).
        // bot_expedientes puede tener copias antiguas con "(?)". Mapa comunidad|vivienda -> nombre.
        const _pisosNombre = {};
        const _pisosModo = {}; // v18.99f — bot_piso_activo (AV): MANUAL silencia los avisos de HOY
        try {
          const _piR = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "pisos!A:AV" });
          const _piRows = (_piR.data.values || []);
          for (let i = 1; i < _piRows.length; i++) {
            const _pr = _piRows[i]; if (!_pr) continue;
            const _com = String(_pr[1] || "").trim().toLowerCase();
            const _viv = String(_pr[2] || "").trim().toLowerCase();
            if (!_com || !_viv) continue;
            const _k = _com + "|" + _viv;
            const _nom = String(_pr[4] || "").replace(/^\s*\(\?\)\s*/, "").trim();
            if (_nom) _pisosNombre[_k] = _nom;
            _pisosModo[_k] = String(_pr[47] || "").trim().toUpperCase();
          }
        } catch (e) {}
        // v18.122 — mapa comunidad -> tipo_via (columna K=10 de "comunidades"), para {tipo_via} en los avisos WA.
        const _tipoViaMap = {};
        try {
          const _coR = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "comunidades!A:K" });
          const _coRows = (_coR.data.values || []);
          for (let i = 1; i < _coRows.length; i++) {
            const _cr = _coRows[i]; if (!_cr) continue;
            const _cn = String(_cr[1] || "").trim().toLowerCase();
            if (_cn) _tipoViaMap[_cn] = String(_cr[10] || "").trim();
          }
        } catch (e) {}
        let _prorroga05 = 20; // v18.99e — prórroga (05_ULT_AVISO.dias_primer_envio) para {fecha_prorroga}
        try { const _avPl = await leerPlantillaMail("05_ULT_AVISO"); const _np = parseFloat(String((_avPl && _avPl.dias_primer_envio) || "").replace(",", ".")); if (!isNaN(_np) && _np >= 0) _prorroga05 = _np; } catch (e) {}
        const _hoyMs = Date.now();
        const _docLabel = (c) => ({ solicitud_firmada:"Solicitud EMASESA", dni_delante:"DNI \u00b7 delante", dni_detras:"DNI \u00b7 detr\u00e1s", empadronamiento:"Empadronamiento", escritura:"Escritura", nota_simple:"Nota simple", contrato_alquiler:"Contrato de alquiler", recibo_ibi:"Recibo IBI" }[String(c||"").trim()] || (String(c||"").trim() ? String(c).replace(/_/g," ") : ""));
        const _fFecha = (v) => { const _d = new Date(v); if (isNaN(_d.getTime())) return { ts: Infinity, txt: "" }; const _p2 = (x) => String(x).padStart(2, "0"); return { ts: _d.getTime(), txt: _p2(_d.getDate()) + "/" + _p2(_d.getMonth() + 1) + "/" + String(_d.getFullYear()).slice(-2) }; };
        // v18.99h — verde = piso con TODA su documentación marcada (misma cuenta que la ficha).
        let _docsPisoAv = [], _botIdxAv = {};
        try { _docsPisoAv = (await _leerDocsManuales()).docsPiso || []; } catch (e) {}
        try { _botIdxAv = await _leerBotDatosHoyIndex(); } catch (e) {}
        const _verdeCache = {};
        const _pisoVerde = async (comu, viv) => {
          const key = _normDirBot(comu);
          if (!(key in _verdeCache)) {
            let set = {};
            try {
              const pisosV = await _leerPisosDeCcpp(comu, _docsPisoAv);
              const rV = _contarFaltanBot([], [], pisosV, _docsPisoAv, "", _botIdxAv[key] || null);
              set = rV.verdes || {};
            } catch (e) {}
            _verdeCache[key] = set;
          }
          return !!_verdeCache[key][_normVivBot(viv)];
        };
        for (let i = 1; i < _erows.length; i++) {
          const r = _erows[i]; if (!r || !r[0]) continue;
          const _paso = String(r[5] || "").trim();
          const _interv = String(r[23] || "").trim().toLowerCase() === "si" && String(r[18] || "").trim() !== "";
          // v18.99d — nombre desde "pisos" (maestro que edita el usuario); respaldo: bot_expedientes. Siempre sin "(?)".
          const _nomKey = String(r[1] || "").trim().toLowerCase() + "|" + String(r[2] || "").trim().toLowerCase();
          const _nomLimpio = _pisosNombre[_nomKey] || String(r[3] || "").replace(/^\s*\(\?\)\s*/, "").trim();
          const _base = { comunidad: r[1] || "", vivienda: r[2] || "", nombre: _nomLimpio, telefono: r[0] || "" };
          // v18.99k — variables del WhatsApp disponibles para TODOS los avisos (para la M3).
          const _fCont = r[9] || r[10] || "";
          const _dCont = new Date(_fCont);
          let _flimM = "", _fprorr = "";
          if (!isNaN(_dCont.getTime())) {
            const _dl = new Date(_dCont.getTime()); _dl.setDate(_dl.getDate() + PLAZO_DOC_INICIAL);
            _flimM = String(_dl.getDate()).padStart(2, "0") + "/" + String(_dl.getMonth() + 1).padStart(2, "0") + "/" + _dl.getFullYear();
            const _dp = new Date(_dCont.getTime()); _dp.setDate(_dp.getDate() + PLAZO_DOC_INICIAL + _prorroga05);
            _fprorr = String(_dp.getDate()).padStart(2, "0") + "/" + String(_dp.getMonth() + 1).padStart(2, "0") + "/" + _dp.getFullYear();
          }
          const _tipoViaRaw = (_tipoViaMap[String(r[1] || "").trim().toLowerCase()] || "").trim(); const _tipoViaM = _tipoViaRaw ? (_tipoViaRaw + " ") : "";
          const _subVars = (t) => String(t || "").replace(/\{\{1\}\}/g, _base.nombre).replace(/\{nombre\}/g, _base.nombre).replace(/\{tipo_via\}/g, _tipoViaM).replace(/\{comunidad\}/g, r[1] || "").replace(/\{piso\}/g, r[2] || "").replace(/\{vivienda\}/g, r[2] || "").replace(/\{fecha_limite\}/g, _flimM).replace(/\{fecha_prorroga\}/g, _fprorr);
          const _waM3 = _subVars(_msgWaM3);
          if (_interv) {
            // 3er fallo: falta validar un documento (tiene PRIORIDAD sobre "completa")
            if (String(r[29] || "").trim() === "1") continue; // ya revisado -> no mostrar
            const _fF = _fFecha(r[19] || r[10]);
            _avisosArr.push(Object.assign({ tipo: "faltan", dias: 0, flag: false, waMsg: _waM3, doc: _docLabel(r[18]), fecha: _fF.txt, ts: _fF.ts }, _base));
          } else if (_paso === "pregunta_tipo") {
            // v18.99h — SOLO el aviso "Mudo" se silencia si el piso está en MANUAL o
            // si tiene toda su documentación (verde). Los de atascado/ayuda/completo NO:
            // esos solo los quitas tú marcando su check.
            if ((_nomKey in _pisosModo) && _pisosModo[_nomKey] !== "BOT_WHATSAPP") continue;
            if (await _pisoVerde(r[1] || "", r[2] || "")) continue;
            // v18.97 — Aviso "Mudo" en DOS momentos fijos, contando desde el ENVÍO
            // del bot (fecha_primer_contacto, r[9]), en días ABSOLUTOS (da igual el
            // día que lo marques): 1er aviso al llegar al umbral (casilla, def 5),
            // 2º y último al día 20 (fijo). Cada aviso se oculta al marcarlo (flag
            // propio: AA=r[26] el 1º, AF=r[31] el 2º) y el 2º reaparece aunque
            // marcaras el 1º. Deja de avisar tras marcar el 2º.
            const _fIni = r[9] || r[10] || "";
            const _d = new Date(_fIni);
            const _dias = isNaN(_d.getTime()) ? 0 : Math.floor((_hoyMs - _d.getTime()) / 86400000);
            const _fF = _fFecha(_fIni);
            const _m1 = String(r[26] || "").trim(); // fecha ISO del marcado del 1er aviso (M1), o ""
            let _xM1 = null; // día del M1 respecto a la presentación (para "(0-t1-t2-X)")
            if (/^\d{4}-\d{2}-\d{2}/.test(_m1) && !isNaN(_d.getTime())) {
              _xM1 = Math.floor((new Date(_m1).getTime() - _d.getTime()) / 86400000);
            }
            if (_dias >= _diaM2) {
              if (String(r[31] || "").trim() === "1") continue; // 2º aviso ya atendido
              _avisosArr.push(Object.assign({ tipo: "presentacion", subtipo: 2, dias: _dias, flag: false, t1: _t1Present, t2: _umbralPresent, xM1: _xM1, waMsg: _subVars(_msgWaM2), fecha: _fF.txt, ts: _fF.ts }, _base));
            } else if (_dias >= _diaM1) {
              if (_m1 !== "") continue; // 1er aviso ya atendido (tiene fecha de marcado)
              _avisosArr.push(Object.assign({ tipo: "presentacion", subtipo: 1, dias: _dias, flag: false, t1: _t1Present, t2: _umbralPresent, waMsg: _subVars(_msgWaM1), fecha: _fF.txt, ts: _fF.ts }, _base));
            }
          } else if (_paso === "finalizado") {
            if (String(r[27] || "").trim() === "1") continue; // ya revisado -> no mostrar
            const _fF = _fFecha(r[10]);
            _avisosArr.push(Object.assign({ tipo: "completo", dias: 0, flag: false, waMsg: _waM3, fin: String(r[25] || "").trim().toUpperCase() === "SI", fecha: _fF.txt, ts: _fF.ts }, _base));
          }
          // Pide ayuda (independiente del paso): AC=texto (idx28), AE=revisado (idx30)
          const _ayuda = String(r[28] || "").trim();
          if (_ayuda && String(r[30] || "").trim() !== "1") {
            const _fA = _fFecha(r[10]);
            _avisosArr.push(Object.assign({ tipo: "ayuda", dias: 0, flag: false, waMsg: _waM3, mensaje: _ayuda, fecha: _fA.txt, ts: _fA.ts }, _base));
          }
        }
        _avisosArr.sort((a, b) => (a.ts == null ? Infinity : a.ts) - (b.ts == null ? Infinity : b.ts));
      } catch (e) { console.error("[presupuestos] HOY avisos:", e.message); _avisosArr = []; }

      const _normComu = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      const _ccppPorDir = {};
      try {
        for (const c of comusListado) {
          const cid = c.ccpp_id || "";
          if (!cid) continue;
          const k1 = _normComu(c.direccion || "");
          const k2 = _normComu(c.comunidad || "");
          if (k1 && !_ccppPorDir[k1]) _ccppPorDir[k1] = cid;
          if (k2 && !_ccppPorDir[k2]) _ccppPorDir[k2] = cid;
        }
      } catch (e) {}

      const _notaPorPiso = {};
      try {
        const _pr = await getSheetsClient().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
        const _prr = _pr.data.values || [];
        const _ph = _prr[0] || [];
        const _ic = _ph.indexOf("comunidad"), _iv = _ph.indexOf("vivienda"), _in = _ph.indexOf("notas_piso");
        if (_ic >= 0 && _iv >= 0 && _in >= 0) {
          for (let i = 1; i < _prr.length; i++) {
            const f = _prr[i]; if (!f) continue;
            _notaPorPiso[_normComu(f[_ic] || "") + "||" + String(f[_iv] || "").trim().toLowerCase()] = String(f[_in] || "");
          }
        }
      } catch (e) {}

      const renderAviso = (p) => {
        const _ccpp = _ccppPorDir[_normComu(p.comunidad)] || "";
        const _urlPiso = _ccpp ? (urlT(token, "/documentacion/expediente", { id: _ccpp }) + "#piso-" + encodeURIComponent(p.vivienda || "")) : "";
        const _dir = _esc(p.comunidad || "");
        const _dirSty = "flex:0 0 160px;font-weight:700;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        const _dirHtml = _urlPiso
          ? `<a href="${_esc(_urlPiso)}" class="hoy-exp-titulo" style="${_dirSty};text-decoration:none" title="${_dir}">${_dir}</a>`
          : `<span class="hoy-exp-titulo" style="${_dirSty}" title="${_dir}">${_dir}</span>`;
        const _nota = _esc(_notaPorPiso[_normComu(p.comunidad) + "||" + String(p.vivienda || "").trim().toLowerCase()] || "");
        const _notaHtml = _ccpp
          ? `<textarea class="hoy-piso-notas" data-ccpp-id="${_esc(_ccpp)}" data-vivienda="${_esc(p.vivienda || "")}" data-orig="${_nota}" rows="1" placeholder="(notas del piso)" style="flex:1;margin:0 8px;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${_nota}</textarea>`
          : `<span style="flex:1;margin:0 8px;color:var(--ptl-gray-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_nota}</span>`;
        let _campo, _chkTitle, _badge;
        if (p.tipo === "presentacion") {
          _campo = (p.subtipo === 2) ? "llamado2" : "llamado"; _chkTitle = "Marcar (recordatorio manual enviado)";
          // v18.99b — icono circular VERDE de la M (mismo switch de gestión manual). W y M van como letra normal; solo la M pendiente lleva icono.
          const _icM = (n) => `<span class="ptl-bot-switch ptl-bot-switch-m" style="display:inline-flex;align-items:center;justify-content:center;height:16px;min-width:16px;padding:0 4px;border-width:1px;border-style:solid;border-radius:999px;font-size:9px;line-height:1;vertical-align:middle">M${n}</span>`;
          const _seqW = "0W-" + p.t1 + "W-" + p.t2 + "W";
          const _cuerpo = (p.subtipo === 2)
            ? `(${_seqW + (p.xM1 != null ? "-" + p.xM1 + "M" : "")} d\u00edas) - <strong>Recordatorio-${_icM("2")} pendiente</strong>`
            : `(${_seqW} d\u00edas) - <strong>Recordatorio-${_icM("1")} pendiente</strong>`;
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-danger" style="flex:0 0 150px">${p.dias} d\u00edas desde Presentaci\u00f3n ${_cuerpo}</span>`;
        } else if (p.tipo === "faltan") {
          _campo = "revisado_faltan"; _chkTitle = "Marcar como revisado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-danger" style="flex:0 0 150px">${p.fecha ? _esc(p.fecha) + " \u00b7 " : ""}Atascado${p.doc ? " \u00b7 " + _esc(p.doc) : ""}</span>`;
        } else if (p.tipo === "ayuda") {
          _campo = "revisado_ayuda"; _chkTitle = "Marcar como revisado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-danger" style="flex:0 0 150px">${p.fecha ? _esc(p.fecha) + " \u00b7 " : ""}Pide ayuda${p.mensaje ? " \u00b7 " + _esc(String(p.mensaje).slice(0,60)) : ""}</span>`;
        } else {
          _campo = "revisado"; _chkTitle = "Marcar como revisado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-decidir" style="flex:0 0 150px">${p.fecha ? _esc(p.fecha) + " \u00b7 " : ""}Completo${p.fin ? " + financiaci\u00f3n" : ""} \u00b7 revisar</span>`;
        }
        // Bot\u00f3n WhatsApp (abre WhatsApp Web/app con el chat del vecino, desde TU n\u00famero) \u2014 mudo, atascado y pide ayuda
        const _waNum = String(p.telefono || "").replace(/[^0-9]/g, "").replace(/^0+/, "");
        const _wa = (_waNum.length === 9) ? "34" + _waNum : _waNum;
        const _waHtml = _wa
          ? `<a href="https://web.whatsapp.com/send?phone=${_wa}${p.waMsg ? "&text=" + encodeURIComponent(p.waMsg) : ""}" onclick="var u=this.href;var w=window.__waWin;try{if(w&&!w.closed){w.location.replace(u);w.focus();return false;}}catch(e){}try{window.__waWin=window.open(u);if(window.__waWin)window.__waWin.focus();}catch(e){}return false;" title="Escribir por WhatsApp (tu n\u00famero de empresa)" style="flex:0 0 auto;text-decoration:none;font-size:13px;line-height:1">\uD83D\uDCAC</a>`
          : "";
        return `
        <div class="hoy-exp-fila" style="display:flex;align-items:center;gap:8px;padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:var(--ptl-general-3)">
          ${_dirHtml}
          <input type="checkbox" class="hoy-bot-llamado" data-tel="${_esc(p.telefono || "")}" data-campo="${_campo}" title="${_chkTitle}"${p.flag ? " checked" : ""}>
          <span class="hoy-piso-num" style="flex:0 0 auto;font-weight:600;color:var(--ptl-gray-700)">${_esc(p.vivienda || "")}</span>
          <span class="hoy-piso-nombre" style="flex:0 1 auto;max-width:180px;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nombre || "")}</span>
          <span class="hoy-piso-tlf" style="flex:0 0 auto;color:var(--ptl-gray-500);white-space:nowrap">${_esc(_fmtTel(p.telefono))}</span>
          ${_notaHtml}
          ${_badge}
          ${_waHtml}
        </div>`;
      };
      const cajaSinRespuesta = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title ptl-m0">🔔 Avisos (${_avisosArr.length})</div>
          </div>
          ${_avisosArr.length === 0
            ? `<div class="ptl-empty-msg">— Sin avisos —</div>`
            : `<div style="overflow:visible;border-radius:5px;background:var(--ptl-general-3)">${_avisosArr.map(renderAviso).join("")}</div>`
          }
        </div>
      `;

      // ============================================================
      // v17.51 — Caja "Expedientes en HOY"
      // v17.52 — Ampliada con sub-filas de pisos con reloj activo.
      //
      // Lista las CCPPs con campo en_hoy === "1". Para cada una, debajo,
      // muestra los pisos (de pestaña `pisos`) con en_hoy === "1" de esa CCPP.
      // Un expediente puede aparecer sin pisos (solo cabecera) si solo se
      // activó el reloj del expediente pero ningún piso.
      //
      // Filas:
      //   - Cabecera CCPP:  [tipo_via direccion] | [notas_pto editable] | [⏰]
      //   - Fila piso:      [   piso] [nombre] [tel] [docs N/M] [notas_piso editable] [⏰]
      //
      // El reloj del expediente "quita de HOY" la CCPP (en_hoy=""). NOTA: si
      // hay pisos con reloj activo, el código del cliente AVISARÁ antes de
      // quitar; no los desactiva en cascada (los pisos quedan con en_hoy="1"
      // y el expediente se reactivará automáticamente al pulsar cualquier reloj
      // de piso, o si tú lo reactivas).
      // El reloj del piso "quita ese piso de HOY".
      // ============================================================
      // TANDA 2 — prefetch (1 lectura) del 1er contacto del bot por comunidad,
      // para los badges del ultimátum (fase 05). Clave = comunidad en minúsculas
      // (igual que _fechaLimiteDocBot). Valor = fecha_primer_contacto más antigua.
      const _contactoBotPorCcpp = {};
      try {
        const _sCB = getSheetsClient();
        const _rCB = await _sCB.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:J" });
        const _rowsCB = _rCB.data.values || [];
        for (let i = 1; i < _rowsCB.length; i++) {
          const rr = _rowsCB[i]; if (!rr) continue;
          const key = String(rr[1] || "").trim().toLowerCase();      // col B = comunidad
          const fpc = String(rr[9] || "").trim().slice(0, 10);       // col J = fecha_primer_contacto
          if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(fpc)) continue;
          const prev = _contactoBotPorCcpp[key];
          if (!prev || fpc < prev) _contactoBotPorCcpp[key] = fpc;   // mínimo (compara ISO como texto)
        }
      } catch (e) { console.warn("[presupuestos][hoy] bot_expedientes para badges ultimátum:", e.message); }

      // Plazos del ultimátum (editables): se leen de los "días" de cada plantilla.
      // Por defecto: Ampliar 20 (desde contacto), Recordatorio 10 y Disidentes 20
      // (desde Ampliar), Resolver 5 (desde Disidentes). Lectura cacheada.
      const _plAvisoHoy    = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
      const _plResolHoy    = await leerPlantillaMail("05_ULT_RESOLUCION").catch(() => null);
      const _plResolverHoy = await leerPlantillaMail("05_ULT_RESOLVER").catch(() => null);
      const _plazosUlt = {
        ampliar:    _plAvisoHoy    && _plAvisoHoy.dias_primer_envio,
        recordatorio: _plAvisoHoy  && _plAvisoHoy.dias_recurrente,
        disidentes: _plResolHoy    && _plResolHoy.dias_primer_envio,
        resolver:   _plResolverHoy && _plResolverHoy.dias_primer_envio,
      };
      const _plAviso8Hoy    = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
      const _plResol8Hoy    = await leerPlantillaMail("08_ULT_RESOLUCION").catch(() => null);
      const _plResolver8Hoy = await leerPlantillaMail("08_ULT_RESOLVER").catch(() => null);
      const _plazosUltCycp = {
        ampliar:    _plAviso8Hoy    && _plAviso8Hoy.dias_primer_envio,
        recordatorio: _plAviso8Hoy  && _plAviso8Hoy.dias_recurrente,
        disidentes: _plResol8Hoy    && _plResol8Hoy.dias_primer_envio,
        resolver:   _plResolver8Hoy && _plResolver8Hoy.dias_primer_envio,
      };
      const _CFG_ULT8 = { plazoIni: PLAZO_CYCP_INICIAL, acc: { ampliar: "ampliar8", disidentes: "disidentes8", resolver: "resolver8", recordar: "recordar8" }, txtFinal: "Resolver el contrato", txtNeutro: "Contrato resuelto", txtEnPlazo: "Contratos solicitados", defAmp: 10, defRes: 5, defRec: 10, flagRec: "08_ULT_RECORDATORIO" };
      const expedientesEnHoy = comusListado
        .filter(c => String(c.en_hoy || "").trim() === "1")
        .sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));

      // v17.55 — Leer TODOS los pisos en una sola pasada. Además de
      // nombre/telefono/en_hoy/notas_piso, se extraen los estados manuales
      // (est_piso_*) y se calcula el contador docs N/M reusando _resumenManual
      // (la misma regla que calcularResumenManual de doc.cjs). Así evitamos
      // hacer una llamada a Sheets por cada CCPP en HOY.
      // Hace falta docsPiso (lista de documentos manuales nivel PISO) para
      // saber qué columnas extraer y aplicar _resumenManual con el orden correcto.
      const pisosEnHoyPorCcpp = {};
      try {
        const dm = await _leerDocsManuales();
        const docsPisoHoy = dm.docsPiso || [];
        const sheetsHoy = getSheetsClient();
        const r = await sheetsHoy.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
        const rowsP = r.data.values || [];
        if (rowsP.length >= 2) {
          const hdr = rowsP[0];
          const idxCom = hdr.indexOf("comunidad");
          const idxViv = hdr.indexOf("vivienda");
          const idxNom = hdr.indexOf("nombre");
          const idxTlf = hdr.indexOf("telefono");
          const idxEnHoy = hdr.indexOf("en_hoy");
          const idxNotasP = hdr.indexOf("notas_piso");
          // Columnas est_piso_* en el orden de docsPisoHoy. -1 si falta.
          const idxEstByCod = {};
          for (const d of docsPisoHoy) idxEstByCod[d.codigo] = hdr.indexOf("est_" + d.codigo);
          const normDir = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
          if (idxEnHoy >= 0) {
            for (let i = 1; i < rowsP.length; i++) {
              const f = rowsP[i];
              if (!f) continue;
              const enHoyV = String(f[idxEnHoy] || "").trim();
              if (enHoyV !== "1") continue;
              const dir = normDir(f[idxCom] || "");
              if (!pisosEnHoyPorCcpp[dir]) pisosEnHoyPorCcpp[dir] = [];
              // Extraer estados en el orden de docsPisoHoy.
              const estados = docsPisoHoy.map(d => {
                const ci = idxEstByCod[d.codigo];
                return ci >= 0 ? String(f[ci] || "").trim() : "";
              });
              // Reusar _resumenManual: misma lógica que doc.cjs.
              let docsTxt = "";
              try {
                const r2 = _resumenManual(estados);
                docsTxt = (r2.totalRel > 0) ? (r2.hechos + "/" + r2.totalRel) : "";
              } catch (_) {}
              pisosEnHoyPorCcpp[dir].push({
                vivienda: String(f[idxViv] || "").trim(),
                nombre:   idxNom >= 0 ? String(f[idxNom] || "").trim() : "",
                telefono: idxTlf >= 0 ? String(f[idxTlf] || "").trim() : "",
                notas_piso: idxNotasP >= 0 ? String(f[idxNotasP] || "").trim() : "",
                docs: docsTxt,
              });
            }
          }
        }
      } catch (e) {
        console.warn("[presupuestos][hoy] pisosEnHoy:", e.message);
      }
      const normDir2 = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

      // v17.55 — Estilo unificado con las cajitas 02/04/05/08:
      //   - font 11px, line-height 1.1, padding 0 6px, min-height 22px
      //   - cebra blanco / #E0E2E6
      //   - botones reloj tamaño estándar (igual que el de mails pendientes)
      //   - flex layout con celdas piso/nombre/teléfono/docs/notas/⏰
      // No usamos la clase ptl-lista-fila genérica para no chocar con la cebra
      // global; pegamos los mismos colores inline para que el orden visual sea
      // exp / piso / piso / exp / piso / ... y no orden de DOM par/impar.
      const renderFilaPiso = (p, ccppId, filaIdx) => {
        const notas = _esc(p.notas_piso || "");
        // v17.59 — Las filas de piso van SIEMPRE blancas. La cebra ya no
        // alterna por filaIdx; el color uniforme blanco contrasta con la
        // cabecera gris fija del bloque CCPP padre.
        const bgPiso = "var(--ptl-general-3)";
        // v18.74 — El nombre del piso es un enlace a la ficha de DOCUMENTACIÓN
        // (único sitio con el acordeón de pisos) anclado a ese piso: al abrir,
        // la página baja hasta la fila del piso (#piso-<vivienda>). El piso NO
        // existe en la ficha de presupuesto, por eso va a /documentacion.
        const _urlPisoDoc = urlT(token, "/documentacion/expediente", { id: ccppId })
                          + "#piso-" + encodeURIComponent(String(p.vivienda || ""));
        return `
          <div class="hoy-piso-fila" data-ccpp-id="${_esc(ccppId)}" data-vivienda="${_esc(p.vivienda)}" style="display:flex;align-items:center;gap:4px;padding:0 6px 0 22px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgPiso}">
            <a href="${_esc(_urlPisoDoc)}" class="hoy-piso-num" title="Ir a la documentación de este piso" style="flex:0 0 50px;font-weight:600;color:var(--ptl-gray-700);text-decoration:none">${_esc(p.vivienda || "")}</a>
            <span class="hoy-piso-nombre" style="flex:0 0 170px;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nombre || "")}</span>
            <span class="hoy-piso-tlf" style="flex:0 0 90px;color:var(--ptl-gray-500);white-space:nowrap">${_esc(_fmtTel(p.telefono))}</span>
            <span class="hoy-piso-docs" style="flex:0 0 32px;color:var(--ptl-gray-500);text-align:center;font-weight:600">${_esc(p.docs || "")}</span>
            <textarea class="hoy-piso-notas"
                      data-ccpp-id="${_esc(ccppId)}"
                      data-vivienda="${_esc(p.vivienda)}"
                      data-orig="${notas}"
                      rows="1"
                      placeholder="(sin notas)"
                      style="flex:1;margin-left:8px;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>
            <button type="button"
                    class="ptl-vec-btn hoy-piso-reloj ptl-btn-reloj"
                    data-ccpp-id="${_esc(ccppId)}"
                    data-vivienda="${_esc(p.vivienda)}"
                    data-enhoy="1"
                    title="Quitar piso de HOY"
                    style="flex:0 0 auto;width:18px;height:18px;font-size:9px">⏰</button>
          </div>
        `;
      };

      // v18.11 — Pre-cálculo de "Faltan X de Y" para los expedientes de HOY.
      // (CCPP cuenta como 1 fila + cada piso; "completa" = resumen manual con
      // hechos>=totalRel).
      // Se hace AQUÍ (antes de pintar la caja) porque el cálculo es async (lee
      // los pisos de cada CCPP) y el render del HTML es síncrono. Guardamos el
      // texto ya resuelto en un mapa ccpp_id -> {clase,texto} para leerlo en el render.
      const faltanHoyPorCcpp = {};
      try {
        const { docsCcpp: _dCc, docsPiso: _dPi } = await _leerDocsManuales();
        const _botIdx = await _leerBotDatosHoyIndex(); // v18.90 datos del bot para conteo bot-aware
        await Promise.all(expedientesEnHoy.map(async (c) => {
          try {
            const estadosCcpp = _dCc.map(d => String(c["est_" + d.codigo] || "").trim());
            const pisos = await _leerPisosDeCcpp(c.direccion || c.comunidad || "", _dPi);
            // v18.55 — Cuenta IGUAL que la ficha: filtro de docs por fase (helper
            // _contarFaltan), de modo que el mismo expediente da el mismo "Faltan
            // X de Y" en HOY y en la ficha. Antes HOY contaba TODOS los docs CCPP
            // (sin filtrar por fase), p.ej. Sextante 4 metía sus 6 docs previos en
            // la fila CCPP y daba "de 11" en vez de "de 10".
            const { totalFilas, pend } = _contarFaltanBot(estadosCcpp, _dCc, pisos, _dPi, c.fase_presupuesto, _botIdx[_normDirBot(c.direccion || c.comunidad || "")] || null);
            if (totalFilas === 0)      faltanHoyPorCcpp[c.ccpp_id] = { clase: "sinpisos", texto: "sin pisos" };
            else if (pend === 0)       faltanHoyPorCcpp[c.ccpp_id] = { clase: "completo", texto: "✓ Completo" };
            else                       faltanHoyPorCcpp[c.ccpp_id] = { clase: "faltan",   texto: `Faltan ${pend} de ${totalFilas}` };
          } catch (_) { /* sin dato -> sin pill */ }
        }));
      } catch (e) { console.warn("[presupuestos][hoy] faltanHoy:", e.message); }

      const renderExpedienteEnHoy = (c, bloqueIdx, conReloj = true) => {
        const titulo = `${_esc(c.tipo_via || "")} ${_esc(c.direccion || "")}`.trim();
        const notas = _esc(c.notas_pto || "");
        const urlFicha = `/presupuestos/expediente?id=${encodeURIComponent(c.ccpp_id)}&token=${encodeURIComponent(token)}`;
        const pisos = pisosEnHoyPorCcpp[normDir2(c.direccion || c.comunidad)] || [];
        const filasPisos = pisos.map((p, i) => renderFilaPiso(p, c.ccpp_id, i)).join("");
        // v17.59 — Cebra fija: TODAS las cabeceras de CCPP en gris #E0E2E6
        // (independiente del bloqueIdx). Las filas de piso van siempre blancas.
        // Decisión Guille: identificar el bloque por color uniforme.
        const bgCab = "var(--ptl-general-2)";
        // v18.10 — Banner de plazo 👍/⚠️/👎. Se calcula con calcularEstadoPlazo +
        // renderBadgePlazo reutilizando plantillasHoy y f1MapHoy (ya cargados
        // arriba). Va ENTRE las notas
        // y el reloj. Si la fase no genera badge (null), no se muestra nada.
        // v18.18 — faseC se declara AQUÍ (fuera del try) para que esté disponible
        // tanto en el cálculo del badge como en la condición del pill de abajo.
        // (En v18.16/17 estaba dentro del try -> "faseC is not defined" al usarlo
        // fuera. Causaba pantalla de Error al cargar /presupuestos/hoy.)
        const faseC = normalizarFase(c.fase_presupuesto);
        let badgeHoy = "";
        try {
          const ep = calcularEstadoPlazo(c, plantillasHoy[faseC] || null, f1MapHoy);
          badgeHoy = renderBadgePlazo(ep) || "";
        } catch (_) { badgeHoy = ""; }
        // v18.16 — El pill "Faltan X de Y" SOLO tiene sentido en fases con
        // documentación (05_DOCUMENTACION y 08_CYCP), donde se cuentan CCPP + pisos.
        // En el resto de fases (01/02/03/04/06/07...) no hay docs que contar, así que
        // NO se muestra (antes salía "Faltan 1 de 1" / "✓ Completo" sin sentido, p.ej.
        // en un expediente de fase 03 marcado con reloj).
        let pillFaltanHoy = "";
        const _esFaseConDocs = (faseC === "05_DOCUMENTACION" || faseC === "08_CYCP");
        const _f = _esFaseConDocs ? faltanHoyPorCcpp[c.ccpp_id] : null;
        if (_f) {
          const _cls = _f.clase === "completo" ? "ptl-fila-badge-success"
                     : _f.clase === "sinpisos" ? "ptl-fila-badge-neutro"
                     : "ptl-fila-badge-danger";
          pillFaltanHoy = `<span class="ptl-fila-badge ptl-fila-badge-fijo ${_cls}">${_esc(_f.texto)}</span>`;
        }
        if (faseC === "07_PTE_CYCP") {
          const _fve = String(c.fecha_visita_emasesa || "").slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}/.test(_fve)) {
            const _dv = new Date(_fve + "T00:00:00");
            const _h0 = new Date(); _h0.setHours(0, 0, 0, 0);
            const _dias = Math.round((_h0 - _dv) / 86400000);
            const _pp = _fve.split("-");
            const _lab = _pp[2] + "/" + _pp[1] + "/" + _pp[0];
            pillFaltanHoy = `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="Esperando CyCP (visita EMASESA el ${_esc(_lab)})">Visita el ${_esc(_lab)} - hace ${_dias} día${_dias === 1 ? "" : "s"}</span>`;
          }
        }
        if (faseC === "06_VISITA_EMASESA") {
          const _fdc = String(c.fecha_documentacion_completa || "").slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}/.test(_fdc)) {
            const _dv6 = new Date(_fdc + "T00:00:00");
            const _h06 = new Date(); _h06.setHours(0, 0, 0, 0);
            const _dias6 = Math.round((_h06 - _dv6) / 86400000);
            const _pp6 = _fdc.split("-");
            const _lab6 = _pp6[2] + "/" + _pp6[1] + "/" + _pp6[0];
            pillFaltanHoy = `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="Esperando visita de EMASESA (doc. enviada el ${_esc(_lab6)})">Doc. el ${_esc(_lab6)} - hace ${_dias6} día${_dias6 === 1 ? "" : "s"}</span>`;
          }
        }
        const _esBotHoy = String(c.bot_comunidad_activo || "").trim().toUpperCase() === "BOT_WHATSAPP";
        const _modoBadgeHoy = (faseC === "05_DOCUMENTACION" || faseC === "08_CYCP")
          ? `<button type="button" disabled class="ptl-vec-btn ptl-bot-switch ${_esBotHoy ? 'ptl-bot-switch-w' : 'ptl-bot-switch-m'}" title="${_esBotHoy ? 'Gestión por bot WhatsApp' : 'Gestión manual'}" style="flex:0 0 auto;cursor:default;width:18px;height:18px;font-size:9px">${_esBotHoy ? 'W' : 'M'}</button>`
          : "";
        return `
          <div class="hoy-exp-bloque" data-ccpp-id="${_esc(c.ccpp_id)}">
            <div class="hoy-exp-fila" data-ccpp-id="${_esc(c.ccpp_id)}" style="display:grid;grid-template-columns:repeat(8,1fr);align-items:center;gap:6px;padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgCab}">
              <div style="grid-column:1 / span 2;display:flex;align-items:center;gap:5px;min-width:0">
                ${_modoBadgeHoy}
                <a href="${_esc(urlFicha)}" class="hoy-exp-titulo" style="flex:1;min-width:0;font-weight:700;color:var(--ptl-gray-700);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${titulo}</a>
                <input type="checkbox" class="hoy-exp-visto" data-ccpp-id="${_esc(c.ccpp_id)}" title="Marcar como revisado hoy"${String(c.visto_hoy || "").trim() === "1" ? " checked" : ""}>
              </div>
              ${(() => {
                const _est = faseC === "05_DOCUMENTACION" ? _badgeUltimatumHoy(c, _contactoBotPorCcpp[String(c.comunidad || c.direccion || "").trim().toLowerCase()] || "", _plazosUlt, undefined, false, /Retrasado/.test(badgeHoy)) : faseC === "08_CYCP" ? _badgeUltimatumHoy(c, String(c.fecha_envio_contratos_pagos || "").slice(0, 10), _plazosUltCycp, _CFG_ULT8, false, /Retrasado/.test(badgeHoy)) : "";
                const _reloj = conReloj
                  ? `<button type="button" class="ptl-vec-btn hoy-exp-reloj ptl-btn-reloj" data-ccpp-id="${_esc(c.ccpp_id)}" data-pisos-activos="${pisos.length}" data-enhoy="1" title="Quitar de HOY" style="width:18px;height:18px;font-size:9px">⏰</button>`
                  : "";
                // v18.x  UN solo estado por fila: para 05/08 manda el badge/boton del ultimatum (_est);
                // el de reenvio (badgeHoy) queda solo de reserva si _est viniera vacio (evita huecos).
                const _esFaseUlt = (faseC === "05_DOCUMENTACION" || faseC === "08_CYCP");
                const _estadoUnico = _esFaseUlt ? (_est || badgeHoy || "") : (badgeHoy || "");
                const _badges = [_estadoUnico, pillFaltanHoy || ""].filter(b => b && String(b).trim());
                const _notas = `<textarea class="hoy-exp-notas" data-ccpp-id="${_esc(c.ccpp_id)}" data-orig="${notas}" rows="1" placeholder="(sin notas)" style="flex:1;min-width:0;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>`;
                return `<div style="grid-column:3 / -1;display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap">`
                  + _notas
                  + _badges.map(b => `<span style="flex:0 0 130px">${b}</span>`).join("")
                  + _reloj
                  + `</div>`;
              })()}
            </div>
            ${filasPisos}
          </div>
        `;
      };

      // v18.09 — Agrupar los expedientes de HOY POR FASE, dentro de la MISMA caja.
      // Orden lógico de fases y su etiqueta legible. Cualquier fase no listada
      // (rara) cae en un grupo "Otros" al final. La clave se normaliza con
      // normalizarFase para tolerar variantes del Sheet.
      const _ORDEN_FASES_HOY = [
        ["01_CONTACTO",        "01 · Contacto"],
        ["02_VISITA",          "02 · Visita"],
        ["03_ENVIO_PTO",       "03 · Envío PTO"],
        ["04_ACEPTACION_PTO",  "04 · Aceptación PTO"],
        ["05_DOCUMENTACION",   "05 · Documentación"],
        ["06_VISITA_EMASESA",  "06 · Visita EMASESA"],
        ["07_PTE_CYCP",        "07 · Pte CYCP"],
        ["08_CYCP",            "08 · CYCP"],
        ["09_TRAMITADA",       "09 · Tramitados"],
        ["ZZ_RECHAZADO",       "ZZ · Rechazado"],
        ["ZZ_DESCARTADO",      "ZZ · Descartado"],
      ];
      const _faseDe = (c) => {
        try { return normalizarFase(c.fase_presupuesto) || ""; } catch { return String(c.fase_presupuesto || ""); }
      };
      // Construir los grupos en orden; cada expediente va a su fase.
      // Cada item lleva { c, conReloj }: conReloj=true si está marcado (en_hoy="1"),
      // false si entra automáticamente por su badge.
      // v18.15 — Fases que se AUTO-RELLENAN por badge (además de los marcados con reloj):
      // 01_CONTACTO, 04_ACEPTACION_PTO, 05_DOCUMENTACION y 08_CYCP — las cuatro que
      // tienen sistema de badge de plazo. Solo entran las que tienen aviso accionable
      // (⚠️ Decidir / 👎 Retrasado). Las fases sin badge (02/03/06/07) NO se auto-rellenan
      // (siguen mostrando solo lo marcado con reloj). Las cajitas de fase de abajo se
      // mantienen de momento (no se eliminan).
      const _FASES_AUTO_BADGE = new Set(["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"]);
      const _gruposHoy = [];
      const _yaEnHoy = new Set(expedientesEnHoy.map(c => c.ccpp_id));
      for (const [clave, etiqueta] of _ORDEN_FASES_HOY) {
        // Marcados con reloj de esta fase (llevan reloj).
        let items = expedientesEnHoy.filter(c => _faseDe(c) === clave).map(c => ({ c, conReloj: true }));
        // Auto-relleno por badge en las fases configuradas.
        if (_FASES_AUTO_BADGE.has(clave)) {
          for (const c of comusListado) {
            if (_faseDe(c) !== clave) continue;
            if (_yaEnHoy.has(c.ccpp_id)) continue; // ya está (marcado) -> no duplicar
            // Fase 08: excluir los ya cerrados (fecha_cycp_completa), igual que la cajita 08 de abajo.
            if (clave === "08_CYCP" && c.fecha_cycp_completa) continue;
            let ep = null;
            try { ep = calcularEstadoPlazo(c, plantillasHoy[clave] || null, f1MapHoy); } catch (_) { ep = null; }
            // v18.17 — Solo entran AUTOMÁTICAMENTE los ⚠️ Decidir (ámbar). Los
            // 👎 Retrasado NO se auto-rellenan: un retrasado es uno que ya se
            // decidió seguir empujando, así que no necesita volver a saltar a HOY
            // hasta que su ciclo se agote y vuelva a "Decidir". (Si el usuario lo
            // marca con el reloj a mano, sí saldrá — eso entra por la otra vía.)
            if (ep && ep.estado === "decidir") {
              items.push({ c, conReloj: false });
            }
          }
        }
        if (items.length) {
          // v18.23 — total real de la fase (Y del "X de Y"): todos los expedientes
          // del listado activo que están en esta fase (mismo criterio que el número
          // de los botones de fase de arriba). X = items.length (los mostrados en HOY).
          const totalFase = comusListado.filter(c => _faseDe(c) === clave).length;
          _gruposHoy.push({ etiqueta, items, total: totalFase });
        }
      }
      // "Otros": cualquier fase que no esté en la lista de arriba (solo marcados).
      const _clavesConocidas = new Set(_ORDEN_FASES_HOY.map(x => x[0]));
      const _otros = expedientesEnHoy.filter(c => !_clavesConocidas.has(_faseDe(c))).map(c => ({ c, conReloj: true }));
      if (_otros.length) _gruposHoy.push({ etiqueta: "Otros", items: _otros, total: _otros.length });

      // v18.15 — Calcular "Faltan X de Y" también para los AUTOMÁTICOS de fases que
      // llevan documentación (05 y 08). Las fases 01 y 04 no llevan docs, así que no
      // necesitan este cálculo. Los marcados con reloj ya están en faltanHoyPorCcpp.
      const _FASES_CON_DOCS = new Set(["05_DOCUMENTACION", "08_CYCP"]);
      try {
        const _pendientesFaltan = [];
        for (const g of _gruposHoy) {
          for (const it of g.items) {
            if (!it.conReloj && _FASES_CON_DOCS.has(_faseDe(it.c)) && !faltanHoyPorCcpp[it.c.ccpp_id]) {
              _pendientesFaltan.push(it.c);
            }
          }
        }
        if (_pendientesFaltan.length) {
          const { docsCcpp: _dCc2, docsPiso: _dPi2 } = await _leerDocsManuales();
          const _botIdx2 = await _leerBotDatosHoyIndex(); // v18.90 datos del bot para conteo bot-aware
          await Promise.all(_pendientesFaltan.map(async (c) => {
            try {
              const estadosCcpp = _dCc2.map(d => String(c["est_" + d.codigo] || "").trim());
              const pisos = await _leerPisosDeCcpp(c.direccion || c.comunidad || "", _dPi2);
              // v18.55 — cuenta igual que la ficha (filtro por fase). Ver bloque arriba.
              const { totalFilas, pend } = _contarFaltanBot(estadosCcpp, _dCc2, pisos, _dPi2, c.fase_presupuesto, _botIdx2[_normDirBot(c.direccion || c.comunidad || "")] || null);
              if (totalFilas === 0)      faltanHoyPorCcpp[c.ccpp_id] = { clase: "sinpisos", texto: "sin pisos" };
              else if (pend === 0)       faltanHoyPorCcpp[c.ccpp_id] = { clase: "completo", texto: "✓ Completo" };
              else                       faltanHoyPorCcpp[c.ccpp_id] = { clase: "faltan",   texto: `Faltan ${pend} de ${totalFilas}` };
            } catch (_) {}
          }));
        }
      } catch (e) { console.warn("[presupuestos][hoy] faltanHoy auto-05:", e.message); }

      // v18.72 — ORDEN de los expedientes dentro de las fases 04, 05 y 08 (petición Guille).
      // Prioridad de grupos y, dentro de cada grupo, criterio de ordenación:
      //   1º Retrasado  -> de MÁS a MENOS días de retraso.
      //   2º Decidir    -> de MÁS a MENOS X de "Faltan X de Y".
      //   3º En plazo   -> de MÁS a MENOS X.
      //   4º Sin badge de estado -> de MÁS a MENOS X (sin "Faltan" -> al final).
      //   Desempate en CUALQUIER grupo: orden alfabético de la dirección.
      // El estado sale de calcularEstadoPlazo (mismo que pinta el badge) y la X
      // de faltanHoyPorCcpp (mismo "Faltan X de Y" que se muestra). Solo reordena;
      // no añade ni quita expedientes.
      const _FASES_ORDEN_BADGE = new Set(["04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"]);
      // rango de grupo: 0=retrasado, 1=decidir, 2=en plazo, 3=sin badge
      const _rangoEstadoHoy = (c, clave) => {
        let ep = null;
        try { ep = calcularEstadoPlazo(c, plantillasHoy[clave] || null, f1MapHoy); } catch (_) { ep = null; }
        if (ep && ep.estado === "retrasado") return { g: 0, dias: ep.diasRetraso || 0 };
        if (ep && ep.estado === "decidir")   return { g: 1, dias: 0 };
        if (ep && ep.estado === "en_plazo")  return { g: 2, dias: 0 };
        return { g: 3, dias: 0 };
      };
      // X de "Faltan X de Y" para ordenar. Devuelve null si la fila NO tiene
      // "Faltan X de Y" (completo / sin pisos / fase sin docs): esas van SIEMPRE
      // al final de su grupo, tanto en orden ascendente como descendente.
      const _faltanXHoy = (c) => {
        const f = faltanHoyPorCcpp[c.ccpp_id];
        if (!f || f.clase !== "faltan") return null;
        const m = /Faltan\s+(\d+)\s+de/.exec(f.texto || "");
        return m ? parseInt(m[1], 10) : null;
      };
      const _dirOrden = (c) => String(c.direccion || c.comunidad || "").toLowerCase();
      for (const g of _gruposHoy) {
        const clave = (_ORDEN_FASES_HOY.find(([, et]) => et === g.etiqueta) || [])[0]
                   || (g.items[0] ? _faseDe(g.items[0].c) : "");
        if (clave === "07_PTE_CYCP") {
          g.items.sort((A, B) => {
            const fa = String(A.c.fecha_visita_emasesa || "").slice(0, 10);
            const fb = String(B.c.fecha_visita_emasesa || "").slice(0, 10);
            const va = /^\d{4}-\d{2}-\d{2}/.test(fa), vb = /^\d{4}-\d{2}-\d{2}/.test(fb);
            if (va && vb) { if (fa !== fb) return fa < fb ? -1 : 1; }
            else if (va !== vb) return va ? -1 : 1;
            return String(A.c.direccion || A.c.comunidad || "").toLowerCase().localeCompare(String(B.c.direccion || B.c.comunidad || "").toLowerCase());
          });
          continue;
        }
        if (clave === "06_VISITA_EMASESA") {
          g.items.sort((A, B) => {
            const fa = String(A.c.fecha_documentacion_completa || "").slice(0, 10);
            const fb = String(B.c.fecha_documentacion_completa || "").slice(0, 10);
            const va = /^\d{4}-\d{2}-\d{2}/.test(fa), vb = /^\d{4}-\d{2}-\d{2}/.test(fb);
            if (va && vb) { if (fa !== fb) return fa < fb ? -1 : 1; }
            else if (va !== vb) return va ? -1 : 1;
            return String(A.c.direccion || A.c.comunidad || "").toLowerCase().localeCompare(String(B.c.direccion || B.c.comunidad || "").toLowerCase());
          });
          continue;
        }
        // v18.92 (peticion Guille) — Fases 05 y 08: ordenar por FECHA DE ENVIO de la
        // fase, de MAS a MENOS (mas reciente primero) y, si coinciden, por direccion.
        //   05_DOCUMENTACION -> fecha_aceptacion_pto (entrada a la fase = 1er envio)
        //   08_CYCP          -> fecha_envio_contratos_pagos (envio de contratos y pagos)
        // Los que no tienen fecha valida van al final del grupo. Solo reordena.
        if (clave === "05_DOCUMENTACION" || clave === "08_CYCP") {
          const _campoEnvio = clave === "05_DOCUMENTACION" ? "fecha_aceptacion_pto" : "fecha_envio_contratos_pagos";
          g.items.sort((A, B) => {
            const fa = String(A.c[_campoEnvio] || "").slice(0, 10);
            const fb = String(B.c[_campoEnvio] || "").slice(0, 10);
            const va = /^\d{4}-\d{2}-\d{2}/.test(fa), vb = /^\d{4}-\d{2}-\d{2}/.test(fb);
            if (va && vb) { if (fa !== fb) return fa < fb ? -1 : 1; } // ASC: mas antiguo primero (mas dias enviados)
            else if (va !== vb) return va ? -1 : 1;                   // con fecha antes que sin fecha
            return String(A.c.direccion || A.c.comunidad || "").toLowerCase().localeCompare(String(B.c.direccion || B.c.comunidad || "").toLowerCase(), "es");
          });
          continue;
        }
        if (!_FASES_ORDEN_BADGE.has(clave)) continue;
        g.items.sort((A, B) => {
          const ra = _rangoEstadoHoy(A.c, clave), rb = _rangoEstadoHoy(B.c, clave);
          if (ra.g !== rb.g) return ra.g - rb.g;                 // grupo: retrasado < decidir < en plazo < sin badge
          if (ra.g === 0 && ra.dias !== rb.dias) return rb.dias - ra.dias; // retrasados: más días primero
          if (ra.g !== 0) {                                      // resto: MÁS X primero (de más a menos)
            const xa = _faltanXHoy(A.c), xb = _faltanXHoy(B.c);
            // los que no tienen "Faltan" (null) van al final del grupo
            if (xa === null && xb !== null) return 1;
            if (xa !== null && xb === null) return -1;
            if (xa !== null && xb !== null && xa !== xb) return xb - xa; // descendente
          }
          return _dirOrden(A.c).localeCompare(_dirOrden(B.c), "es"); // desempate alfabético
        });
      }

      // Cabecerita de grupo de fase (una línea fina, no es un expediente).
      // v18.23 — fondo AZUL OSCURO + texto AZUL CLARO (sistema de 2 azules). El
      // contador pasa a "X de Y": X = expedientes mostrados en HOY de esa fase,
      // Y = total de expedientes de esa fase (mismo número que el botón de fase).
      const _subcabFase = (etiqueta, n, total, clave) => {
        // v18.75 — El contador "(X de Y)" se pinta de rojo (--ptl-danger) cuando
        // X != Y (faltan expedientes de esa fase por sacar a HOY). Si X == Y
        // (están todos) se queda en --ptl-general-2 como el título.
        const _colNum = (n === total) ? "var(--ptl-general-2)" : "var(--ptl-danger)";
        // Botón "Tiempos" (solo fases 05 y 08): lleva a Plantillas y abre ahí la ventana de tiempos.
        const _btnTiempos = (clave === "05_DOCUMENTACION" || clave === "08_CYCP")
          ? `<a href="${urlT(token, "/presupuestos/plantillas", { tiempos: clave === "05_DOCUMENTACION" ? "05" : "08" })}" title="Ver los tiempos de esta fase" style="margin-left:auto;font-size:10px;font-weight:600;color:var(--ptl-general-2);text-decoration:none;border:1px solid var(--ptl-general-2);border-radius:3px;padding:0 6px;text-transform:none;letter-spacing:0;white-space:nowrap">📋 Tiempos</a>`
          : "";
        return `
        <div style="display:flex;align-items:center;gap:6px;margin-left:-10px;padding:5px 8px 2px 2px;background:var(--ptl-general-1);border-bottom:1px solid var(--ptl-gray-200);font-size:10px;font-weight:700;color:var(--ptl-general-2);text-transform:uppercase;letter-spacing:.4px">
          ${_esc(etiqueta)} <span style="font-weight:600;color:${_colNum};opacity:.85">(${n} de ${total})</span>${_btnTiempos}
        </div>`;
      };

      // Pintar: por cada grupo, su subcabecera + sus expedientes (que mantienen
      // exactamente el mismo render de antes, con notas, reloj y sub-filas de pisos).
      let _bloqueIdx = 0;
      const _listaHoyHtml = _gruposHoy.map(g => {
        const _clFase = (_ORDEN_FASES_HOY.find(([, et]) => et === g.etiqueta) || [])[0] || (g.items[0] ? _faseDe(g.items[0].c) : "");
        return _subcabFase(g.etiqueta, g.items.length, g.total, _clFase) +
          g.items.map(it => renderExpedienteEnHoy(it.c, _bloqueIdx++, it.conReloj)).join("");
      }).join("");

      // v18.13 — total real = suma de items de todos los grupos (marcados + automáticos por badge).
      const _totalHoy = _gruposHoy.reduce((acc, g) => acc + g.items.length, 0);
      const cajaExpedientesHoy = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title ptl-m0">📋 Expedientes HOY (${_totalHoy})</div>
          </div>
          ${_totalHoy === 0
            ? `<div style="padding:8px 4px;color:var(--ptl-gray-500);font-size:11px;font-style:italic">— Sin expedientes marcados —</div>`
            : `<div class="hoy-exp-list" style="border-radius:5px;background:var(--ptl-general-3)">${_listaHoyHtml}</div>`
          }
        </div>
      `;

      // Formato fecha aviso "DD/MM/AA"
      const fmtFechaAviso = (s) => {
        const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return "";
        return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
      };
      // Etiqueta corta de fase
      const labelFaseCorta = (f) => {
        if (f === "01_CONTACTO") return "01-Contacto";
        if (f === "04_ACEPTACION_PTO") return "04-Aceptación";
        if (f === "05_DOCUMENTACION") return "05-Documentación";
        if (f === "08_CYCP") return "08-CYCP";
        return f;
      };
      // v17.31: la caja "Avisos de plazo" ya no se usa; los badges se integran
      // dentro de las cajas 01/04/05/08. Se conserva el cálculo de avisosPlazo
      // arriba por si otra parte del código lo consume (no detectada hoy).


      // v17.39: cajita "DATOS ECONÓMICOS" — refinamiento visual + media mensual.
      // 4 cajas en UNA SOLA FILA, todas misma estructura (nº exp / importe / tiempo / beneficio).
      // Subconjuntos:
      //   1) TOTAL PRESUPUESTADO       → todos los expedientes (incl. ZZ_*) — sin beneficio
      //      + LÍNEA EXTRA: media mensual presupuestada (desde fecha_envio_pto más antigua a hoy)
      //   2) TOTAL ACEPTADO            → fases 05/06/07/08/09
      //   3) PENDIENTE DE TRAMITAR     → fases 05/06/07/08
      //   4) TOTAL TRAMITADO           → fase 09
      // Reglas "real si hay, si no previsto" para tiempo y beneficio.
      // Visual:
      //   - SUBTÍTULOS en negrita, VALORES sin negrita, todo en la misma línea
      //   - La coletilla de fases va dentro del paréntesis tras el título de la caja
      //   - La coletilla "(cuadrilla 5)" va dentro del paréntesis tras "Tiempo"
      const FASES_ACEPTADAS = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP","09_TRAMITADA"];
      const FASES_PENDIENTE_TRAMITAR = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
      const _num = (x) => {
        if (x == null || x === "") return 0;
        const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
        return isFinite(n) ? n : 0;
      };
      const _grupo = () => ({ n: 0, importe: 0, tiempo: 0, beneficio: 0 });
      const G = {
        presupuestado: _grupo(),
        aceptado: _grupo(),
        pendiente: _grupo(),
        tramitado: _grupo(),
        // v18.51: sub-grupos de tramitado por los 3 estados de la fase 09
        // (En ejecución / Pendiente de cobro / Cobrado). Acumulan importe y
        // beneficio (real si > 0, si no previsto — misma regla que el grupo padre).
        tramitadoEjecucion:  { importe: 0, beneficio: 0, tiempo: 0 },
        tramitadoPteCobro:   { importe: 0, beneficio: 0, tiempo: 0 },
        tramitadoCobrado:    { importe: 0, beneficio: 0, tiempo: 0 },
      };
      // Para la media mensual: localizar la fecha_envio_pto más antigua.
      // El campo es ISO "YYYY-MM-DD" string; comparación lexicográfica funciona.
      let fechaEnvioMin = null;
      for (const c of comusListado) {
        const fase = normalizarFase(c.fase_presupuesto);
        const importe = _num(c.pto_total);
        const tprev   = _num(c.tiempo_previsto);
        const treal   = _num(c.tiempo_real);
        const bprev   = _num(c.beneficio_previsto);
        const breal   = _num(c.beneficio_real);
        const tiempoCuadrilla = ((treal > 0 ? treal : tprev) * 2) / 5;
        // v17.81 — Beneficio (Opción A acordada con Guille):
        //   - Si la obra YA tiene beneficio_real (campo no vacío): usar el real,
        //     pero si es NEGATIVO (pérdida) se cuenta como 0 (nunca resta del total).
        //   - Si aún NO tiene real (campo vacío): usar el previsto.
        // Distinguimos "real vacío" de "real = 0/negativo" mirando el dato CRUDO
        // (c.beneficio_real), porque _num convierte vacío en 0 y no permitiría
        // diferenciarlos. Antes la regla era (breal > 0 ? breal : bprev), que
        // ante un real negativo caía al previsto positivo y ocultaba la pérdida.
        const _tieneReal = !(c.beneficio_real == null || String(c.beneficio_real).trim() === "");
        const beneficio = _tieneReal ? Math.max(breal, 0) : bprev;
        // fecha_envio_pto más antigua (para el inicio del cómputo de la media)
        const fep = String(c.fecha_envio_pto || "").trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(fep)) {
          if (fechaEnvioMin == null || fep < fechaEnvioMin) fechaEnvioMin = fep;
        }
        // 1) Presupuestado: TODOS (incl. ZZ_*)
        G.presupuestado.n++;
        G.presupuestado.importe   += importe;
        G.presupuestado.tiempo    += tiempoCuadrilla;
        G.presupuestado.beneficio += beneficio;
        if (FASES_ACEPTADAS.includes(fase)) {
          G.aceptado.n++;
          G.aceptado.importe   += importe;
          G.aceptado.tiempo    += tiempoCuadrilla;
          G.aceptado.beneficio += beneficio;
        }
        if (FASES_PENDIENTE_TRAMITAR.includes(fase)) {
          G.pendiente.n++;
          G.pendiente.importe   += importe;
          G.pendiente.tiempo    += tiempoCuadrilla;
          G.pendiente.beneficio += beneficio;
        }
        if (fase === "09_TRAMITADA") {
          G.tramitado.n++;
          G.tramitado.importe   += importe;
          G.tramitado.tiempo    += tiempoCuadrilla;
          G.tramitado.beneficio += beneficio;
          // Sub-distribución por los 3 estados de la fase 09 (misma lógica que
          // la ficha): fecha_cobro -> Cobrado; si no, fecha_pte_cobro -> Pte
          // cobro; si no -> En ejecución.
          const fco = String(c.fecha_cobro || "").trim();
          const fpc = String(c.fecha_pte_cobro || "").trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(fco)) {
            G.tramitadoCobrado.importe   += importe;
            G.tramitadoCobrado.beneficio += beneficio;
            G.tramitadoCobrado.tiempo    += tiempoCuadrilla;
          } else if (/^\d{4}-\d{2}-\d{2}/.test(fpc)) {
            G.tramitadoPteCobro.importe   += importe;
            G.tramitadoPteCobro.beneficio += beneficio;
            G.tramitadoPteCobro.tiempo    += tiempoCuadrilla;
          } else {
            G.tramitadoEjecucion.importe   += importe;
            G.tramitadoEjecucion.beneficio += beneficio;
            G.tramitadoEjecucion.tiempo    += tiempoCuadrilla;
          }
        }
      }
      // v17.81 — Tiempo mostrado en MESES (no días). g.tiempo viene en días de
      // cuadrilla-5 (ya con la fórmula ×2/5 aplicada). 1 mes = 22 días laborables.
      // 1 decimal. El sufijo " meses" deja claro la unidad (antes era " días").
      const fmtMeses = (n) => (n / 22).toFixed(1).replace(".", ",") + " meses";

      // Cálculo media mensual presupuestada.
      // mesesTranscurridos = diferencia en meses entre fechaEnvioMin y hoy.
      //   - Aproximación: días/30.4375 (días promedio del mes en año gregoriano).
      //   - Si <1 mes, ponemos 1 para evitar divisiones absurdas.
      let mediaMensual = 0;
      let labelFechaInicio = "";
      if (fechaEnvioMin) {
        const [yi, mi, di] = fechaEnvioMin.split("-").map(Number);
        const dIni = new Date(Date.UTC(yi, mi - 1, di));
        const dNow = new Date();
        const diasTrans = (dNow.getTime() - dIni.getTime()) / (1000 * 60 * 60 * 24);
        const mesesTrans = Math.max(1, diasTrans / 30.4375);
        mediaMensual = G.presupuestado.importe / mesesTrans;
        labelFechaInicio = `${String(di).padStart(2,"0")}-${String(mi).padStart(2,"0")}-${String(yi).slice(2)}`;
      }

      // Genera una caja con paleta de colores parametrizada y estructura uniforme.
      // - titulo: el nombre de la caja
      // - colFases: texto entre paréntesis bajo el título (2ª línea)
      // - g: objeto con n/importe/tiempo/beneficio
      // - paleta: colores
      // - opts: { showBeneficio?: boolean, extraHTML?: string }
      // v17.41: textos en negro (var(--ptl-gray-900)) — solo los BORDES de cada caja
      // conservan el color identificativo de la paleta. El espacio del extra
      // de la caja 1 se compacta (sin border-top dashed para reducir hueco).
      const NEGRO = "var(--ptl-gray-900)";
      const _cajaEconomica = (titulo, colFases, g, paleta, opts) => {
        opts = opts || {};
        const showBeneficio = opts.showBeneficio !== false;
        // v17.58 — sufijo opcional dentro del valor, p.ej. "(19,1%)"; se
        // renderiza más pequeño y a la izquierda del número para no confundirlo.
        const _linea = (label, valor, sufijo) => `
          <div style="display:flex;align-items:center;margin-top:5px;font-size:12px;color:${NEGRO};line-height:1.3;gap:6px">
            <strong class="ptl-nowrap">${label}</strong>
            <span class="ptl-hr-soft"></span>
            ${sufijo ? `<span style="white-space:nowrap;font-size:10px;font-style:italic;color:var(--ptl-gray-500)">${sufijo}</span>` : ""}
            <span class="ptl-nowrap">${valor}</span>
          </div>`;
        // v17.56: la cajita es flex-column. extraHTML se empuja al fondo
        // (margin-top:auto en el wrapper) para que las cajitas alineen sus
        // bloques inferiores.
        // v17.57: opts.lineaSustitutivaBeneficio permite a la caja 1 (sin
        // beneficio) renderizar OTRA línea en el sitio donde iría "Beneficio"
        // (en caja 1 es "Media mensual"). Así las 4 cajitas tienen 4 líneas
        // de datos y el extraHTML arranca todas a la misma altura.
        const lineaCuarta = showBeneficio
          ? _linea("Beneficio", fmtMoneda(g.beneficio))
          : (opts.lineaSustitutivaBeneficio || "");
        return `
          <div style="background:var(--ptl-general-3);border:1px solid ${paleta.border};border-radius:6px;padding:9px;color:${NEGRO};display:flex;flex-direction:column;min-height:100%">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700">
              ${titulo}
            </div>
            ${colFases ? `<div style="font-size:10px;margin-top:2px;font-weight:500">(${colFases})</div>` : ""}
            ${_linea("Nº expedientes", g.n, opts.pctN)}
            ${_linea("Importe", fmtMoneda(g.importe), opts.pctImporte)}
            ${_linea(`Tiempo <span style="font-weight:500">(cuadrilla 5)</span>`, fmtMeses(g.tiempo))}
            ${lineaCuarta}
            ${opts.extraHTML ? `<div style="margin-top:auto">${opts.extraHTML}</div>` : ""}
          </div>
        `;
      };
      const PAL = {
        gris:    { border:"var(--ptl-gray-200)" },
        verde:   { border:"var(--ptl-success-light)" },
        azul:    { border:"var(--ptl-general-2)" },
        amarillo:{ border:"var(--ptl-warning-light)" },
      };
      // v17.57 — Caja 1: la línea "Media mensual" ocupa la posición de
      // "Beneficio" (las otras cajas tienen Beneficio ahí). Se pasa como
      // lineaSustitutivaBeneficio. El extra de la caja 1 queda reducido a
      // "inicio del cómputo" (anclado al fondo de la cajita).
      const lineaMediaMensualCaja1 = fechaEnvioMin ? `
        <div style="display:flex;align-items:center;margin-top:5px;font-size:12px;color:${NEGRO};line-height:1.3;gap:6px">
          <strong class="ptl-nowrap">Media mensual</strong>
          <span class="ptl-hr-soft"></span>
          <span class="ptl-nowrap">${fmtMoneda(mediaMensual)}</span>
        </div>
      ` : "";
      // v17.58 / v18.52 — Para que el extra de caja 1 quede a la misma altura
      // que cajas 2/3/4, debe tener las mismas líneas. La caja 4 tiene 6 líneas
      // de extra (Total + 5), así que caja 1 = "inicio del cómputo" + 5 huecos.
      const extraPresupuestado = fechaEnvioMin ? `
        <div class="ptl-caja-sep">
          <div style="font-size:10px;font-style:italic;color:${NEGRO};line-height:1.3">
            inicio del cómputo: ${labelFechaInicio}
          </div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
        </div>
      ` : "";

      // v17.56 — Línea extra para la caja 4 (Total tramitado): 3 líneas Total/
      // Cobrado/Por cobrar con BENEFICIO × 20%. Tipografía igualada a la
      // línea "inicio del cómputo" de caja 1 (font-size:10px, itálica).
      const PCT_BENEF = 0.20;
      const _lineaExtra = (label, valor) => `
        <div style="display:flex;align-items:center;margin-top:2px;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
          <strong style="white-space:nowrap;font-style:normal">${label}</strong>
          <span class="ptl-hr-soft"></span>
          <span class="ptl-nowrap">${valor}</span>
        </div>
      `;
      // Hueco invisible con la misma altura que una línea extra (para alinear
      // cajas 2 y 3 con caja 4: ellas solo tienen Total (20%), caja 4 tiene
      // además Cobrado y Por cobrar).
      const _huecoExtra = `<div class="ptl-hueco-extra">·</div>`;
      // v18.52 / v18.53 — Trabajo por delante y fecha "sin trabajo" (cuadrilla 5).
      // Días laborables de trabajo AÚN NO consumido. Se proyecta sobre el
      // calendario saltando sábados y domingos (festivos no se contemplan, son
      // insignificantes) para dar el día en que la cuadrilla se queda sin trabajo.
      // Helper: dado un nº de días laborables, devuelve la fecha DD-MM-AAAA
      // resultante de sumarlos a HOY saltando fines de semana.
      const _fechaSinTrabajoDesde = (dias) => {
        if (!(dias > 0)) return "—";
        const _d = new Date();
        let _restan = dias;
        while (_restan > 0) {
          _d.setDate(_d.getDate() + 1);
          const _dow = _d.getDay();          // 0=domingo, 6=sábado
          if (_dow !== 0 && _dow !== 6) _restan--;
        }
        const _dd = String(_d.getDate()).padStart(2, "0");
        const _mm = String(_d.getMonth() + 1).padStart(2, "0");
        return `${_dd}-${_mm}-${_d.getFullYear()}`;
      };
      // Tiempo ya CONSUMIDO = obras terminadas (Pte cobro + Cobrado), solo en 09.
      const _tiempoConsumido = G.tramitadoPteCobro.tiempo + G.tramitadoCobrado.tiempo;
      // TRAMITADO: por delante = solo lo EN EJECUCIÓN (lo tramitado no consumido).
      const _diasPorDelante  = Math.round(G.tramitadoEjecucion.tiempo);
      const _mesesPorDelante = (G.tramitadoEjecucion.tiempo / 22).toFixed(1).replace(".", ",");
      const _fechaSinTrabajo = _fechaSinTrabajoDesde(_diasPorDelante);
      // ACEPTADO (fases 05-09): por delante = TODO su tiempo MENOS lo consumido
      // (las obras terminadas, que están dentro de la fase 09). Equivale a
      // "pendiente de tramitar + tramitado en ejecución".
      const _diasPorDelanteAcept  = Math.round(G.aceptado.tiempo - _tiempoConsumido);
      const _mesesPorDelanteAcept = ((G.aceptado.tiempo - _tiempoConsumido) / 22).toFixed(1).replace(".", ",");
      const _fechaSinTrabajoAcept = _fechaSinTrabajoDesde(_diasPorDelanteAcept);
      const extraTramitado = `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span class="ptl-nowrap">${fmtMoneda(G.tramitado.beneficio * PCT_BENEF)}</span>
          </div>
          ${_lineaExtra("En ejecución", fmtMoneda(G.tramitadoEjecucion.beneficio * PCT_BENEF))}
          ${_lineaExtra("Pte cobro", fmtMoneda(G.tramitadoPteCobro.beneficio * PCT_BENEF))}
          ${_lineaExtra("Cobrado", fmtMoneda(G.tramitadoCobrado.beneficio * PCT_BENEF))}
          ${_lineaExtra("Por delante", `${_diasPorDelante} días (${_mesesPorDelante} meses)`)}
          ${_lineaExtra("Sin trabajo", _fechaSinTrabajo)}
        </div>
      `;

      // v17.57 / v18.52 — Huecos invisibles para que las cajas 2 y 3 igualen la
      // altura de la caja 4, que bajo "Total (20%)" lleva 5 líneas: En ejecución,
      // Pte cobro, Cobrado, Por delante y Sin trabajo.
      const _extraTotal20 = (g) => `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span class="ptl-nowrap">${fmtMoneda(g.beneficio * PCT_BENEF)}</span>
          </div>
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
        </div>
      `;
      // v18.53 — Aceptado: además del Total (20%), muestra "Por delante" y
      // "Sin trabajo" (mismo concepto que Tramitado pero con TODO el trabajo
      // aceptado no consumido). Lleva 3 huecos donde Tramitado tiene En
      // ejecución/Pte cobro/Cobrado, para que las 2 líneas queden alineadas.
      const extraAceptado = `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span class="ptl-nowrap">${fmtMoneda(G.aceptado.beneficio * PCT_BENEF)}</span>
          </div>
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_lineaExtra("Por delante", `${_diasPorDelanteAcept} días (${_mesesPorDelanteAcept} meses)`)}
          ${_lineaExtra("Sin trabajo", _fechaSinTrabajoAcept)}
        </div>
      `;
      const extraPendiente = _extraTotal20(G.pendiente);

      // v17.58 — Porcentajes para caja 2 (Aceptado): expedientes e importe
      // como fracción del Presupuestado (caja 1). Formato "(X,X%)" o "" si la
      // base es 0.
      const _fmtPct = (num, den) => {
        if (!den || den === 0) return "";
        const p = (num / den) * 100;
        const txt = p.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return "(" + txt + "%)";
      };
      const pctNAceptado       = _fmtPct(G.aceptado.n,       G.presupuestado.n);
      const pctImporteAceptado = _fmtPct(G.aceptado.importe, G.presupuestado.importe);

      const cajaEconomicos = `
        <div class="ptl-card">
          <div class="ptl-card-title">💶 Datos económicos</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px">
            ${_cajaEconomica("Total presupuestado",   "todas las fases", G.presupuestado, PAL.gris,     { showBeneficio: false, extraHTML: extraPresupuestado, lineaSustitutivaBeneficio: lineaMediaMensualCaja1 })}
            ${_cajaEconomica("Total aceptado",        "fases 05-09",     G.aceptado,      PAL.verde,    { showBeneficio: true, extraHTML: extraAceptado, pctN: pctNAceptado, pctImporte: pctImporteAceptado })}
            ${_cajaEconomica("Pendiente de tramitar", "fases 05-08",     G.pendiente,     PAL.azul,     { showBeneficio: true, extraHTML: extraPendiente })}
            ${_cajaEconomica("Total tramitado",       "fase 09",         G.tramitado,     PAL.amarillo, { showBeneficio: true, extraHTML: extraTramitado })}
          </div>
        </div>
      `;

      // ============================================================
      // Caja 02-VISITA en HOY (lista de expedientes en fase de visita).
      // ============================================================
      let cajaVisita = "";
      try {
        // Filtrar CCPPs de fase 02-VISITA (única caja de fase que queda en HOY)
        const en02 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "02_VISITA");
        en02.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));


        // Formatea teléfono español a xxx-xxx-xxx (mantiene tal cual si no encajan 9 dígitos).
        function _fmtTel(tel) {
          let s = String(tel || "").replace(/\D/g, "");
          if (s.length === 11 && s.startsWith("34")) s = s.slice(2);
          if (s.length === 13 && s.startsWith("0034")) s = s.slice(4);
          if (s.length === 9) return s.slice(0,3) + "-" + s.slice(3,6) + "-" + s.slice(6,9);
          return s || String(tel || "");
        }

        // Renderiza una fila de la cajita 02-VISITA:
        //   Línea 1: **tipo_via direccion** (negrita)
        //   Línea 2 (si hay admin): Nombre (admin) xxx-xxx-xxx
        //   Línea 3 (si hay presidente): Nombre (pres) xxx-xxx-xxx
        function _renderFilaExp02(c) {
          const url = urlT(token, "/presupuestos/expediente", { id: c.ccpp_id });
          const tipoVia = String(c.tipo_via || "").trim();
          const direccion = String(c.direccion || c.ccpp_id || "").trim();
          const tituloTxt = (tipoVia ? tipoVia + " " : "") + direccion;
          const admin = String(c.administrador || "").trim();
          const telAdmin = String(c.telefono_administrador || "").trim();
          const pres = String(c.presidente || "").trim();
          const telPres = String(c.telefono_presidente || "").trim();
          const lineas = [];
          if (admin) {
            lineas.push(`<div style="font-size:11px;color:var(--ptl-gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(admin)} (admin)${telAdmin ? " " + _esc(_fmtTel(telAdmin)) : ""}</div>`);
          }
          if (pres) {
            lineas.push(`<div style="font-size:11px;color:var(--ptl-gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(pres)} (presi)${telPres ? " " + _esc(_fmtTel(telPres)) : ""}</div>`);
          }
          return `
            <div class="ptl-lista-fila" style="display:block">
              <a href="${url}" style="font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(tituloTxt)}">${_esc(tituloTxt)}</a>
              ${lineas.join("")}
            </div>
          `;
        }

        const filas02 = en02.map(c => _renderFilaExp02(c));


        cajaVisita = `
          <div class="ptl-card">
            <div class="ptl-card-title">🚪 02-VISITA (${en02.length})</div>
            ${en02.length === 0
              ? `<div class="ptl-empty-msg">— Sin expedientes en esta fase —</div>`
              : `<div class="ptl-lista-filas hoy-lista-02">${filas02.join("")}</div>`}
          </div>
        `;
      } catch (eFases) {
        console.warn("[presupuestos][hoy] cajitas fases:", eFases.message);
        cajaVisita = `<div class="ptl-card"><div class="ptl-card-title">🚪 02-VISITA</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
      }

      const body = `
        <style>
          /* Asunto clicable de Mails pendientes: hover azul + negrita. */
          .hoy-asunto-clic:hover { color: #000; font-weight: 700; }
          /* Separación vertical entre filas de la cajita 02-VISITA
             (3 líneas por fila se agolpan). */
          .hoy-lista-02 .ptl-lista-fila { padding-bottom: 8px; }
        </style>
        <div class="hoy-page" style="display:grid;gap:0;align-items:start">
          <div>${cajaSinRespuesta}</div>
          <div>${cajaMails}</div>
          <div>${cajaExpedientesHoy}</div>
          <div>${cajaEconomicos}</div>
          <div>${cajaVisita}</div>
        </div>
        <script>
          (function(){
            var URL_CLASIF = ${JSON.stringify(urlT(token, "/presupuestos/mail-clasificar"))};
            var URL_DESC   = ${JSON.stringify(urlT(token, "/presupuestos/mail-descartar"))};
            var URL_IMAP_RUN = ${JSON.stringify(urlT(token, "/presupuestos/imap-run"))};
            var URL_IMAP_IMPORTAR_DRIVE = ${JSON.stringify(urlT(token, "/presupuestos/imap-importar-drive"))};

            // Acordeón: mostrar/ocultar detalle al pulsar 📄
            document.querySelectorAll('.hoy-toggle-detail').forEach(function(btn){
              btn.addEventListener('click', function(){
                var idx = btn.dataset.idx;
                var det = document.querySelector('.hoy-detail[data-idx="' + idx + '"]');
                if (!det) return;
                det.style.display = (det.style.display === 'none' || !det.style.display) ? 'block' : 'none';
              });
            });

            // Responder / Reenviar: redirige al expediente con un parámetro
            // que el frontend del expediente reconoce para abrir el modal
            // precargado. Si el mail no está clasificado, avisa.
            function _hoyAccionMail(btn, accion) {
              var ccpp = btn.dataset.ccpp || '';
              var mid = btn.dataset.mid || '';
              if (!ccpp) {
                alert('Este mail aún no está asignado a ningún expediente.\\n\\nUsa el desplegable "elegir expediente" para asignarlo primero, y luego entra al expediente para responder o reenviar.');
                return;
              }
              if (!mid) {
                alert('Este mail no tiene message_id (probablemente un mail antiguo). Entra al expediente y responde manualmente.');
                return;
              }
              var base = ${JSON.stringify(urlT(token, "/presupuestos/expediente"))};
              var sep = base.indexOf('?') >= 0 ? '&' : '?';
              window.location.href = base + sep + 'id=' + encodeURIComponent(ccpp) + '&accion_mail=' + accion + '&mid=' + encodeURIComponent(mid);
            }
            document.querySelectorAll('.hoy-responder').forEach(function(btn){
              btn.addEventListener('click', function(){ _hoyAccionMail(btn, 'responder'); });
            });
            document.querySelectorAll('.hoy-reenviar').forEach(function(btn){
              btn.addEventListener('click', function(){ _hoyAccionMail(btn, 'reenviar'); });
            });

            // Reloj: en HOY, siempre encendido. Al pulsar, lo quita de HOY.
            document.querySelectorAll('.hoy-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var mailId = btn.dataset.mailId;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId });
                  var res = await fetch('${urlT(token, "/presupuestos/mail-toggle-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v17.51 — Reloj de "Expedientes en HOY": quita la CCPP de HOY
            // (pone en_hoy = "" vía /presupuestos/expediente/campo).
            // v17.52 — Si la CCPP tiene pisos activos, avisa antes.
            document.querySelectorAll('.hoy-exp-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var ccppId = btn.dataset.ccppId;
                var nPisos = parseInt(btn.dataset.pisosActivos || '0', 10) || 0;
                if (nPisos > 0) {
                  var ok = confirm('Este expediente tiene ' + nPisos + ' piso(s) con reloj activo. Si quitas el expediente de HOY, los pisos seguirán marcados pero NO se verán hasta que reactives el expediente. ¿Continuar?');
                  if (!ok) return;
                }
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'en_hoy', valor: '' });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v18.21 — Check "visto hoy": al marcar/desmarcar guarda al instante
            // visto_hoy = "1" / "" vía /presupuestos/expediente/campo (mismo endpoint
            // y guardado seguro que el reloj y las notas). Sin recargar la página.
            // Desmarcado manual uno a uno (decisión Guille: no hay limpieza masiva).
            // Si el guardado falla, se revierte el check y se avisa.
            document.querySelectorAll('.hoy-exp-visto').forEach(function(chk){
              chk.addEventListener('change', async function(){
                var ccppId = chk.dataset.ccppId;
                var valor = chk.checked ? '1' : '';
                chk.disabled = true;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'visto_hoy', valor: valor });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) {
                    chk.checked = !chk.checked;
                    var t = await res.text(); alert('No se pudo guardar: ' + t);
                  }
                } catch(e){
                  chk.checked = !chk.checked;
                  alert('No se pudo guardar: ' + e.message);
                } finally {
                  chk.disabled = false;
                }
              });
            });

            // TANDA 2b — botones ⚠️ del ultimátum: abren el MISMO compositor de correo
            // (mismas clases visuales ptl-floating-*, previsualizar/editar/CC/CCO/Cancelar/Confirmar).
            // Carga la plantilla de /plantilla-mail y envía al endpoint del ultimátum (que sella la fecha).
            var _URL_ULT = { ampliar:'${urlT(token, "/presupuestos/ultimatum/ampliar")}', disidentes:'${urlT(token, "/presupuestos/ultimatum/disidentes")}', resolver:'${urlT(token, "/presupuestos/ultimatum/resolver")}', ampliar8:'${urlT(token, "/presupuestos/ultimatum8/ampliar")}', disidentes8:'${urlT(token, "/presupuestos/ultimatum8/disidentes")}', resolver8:'${urlT(token, "/presupuestos/ultimatum8/resolver")}', recordar:'${urlT(token, "/presupuestos/ultimatum/recordar")}', recordar8:'${urlT(token, "/presupuestos/ultimatum8/recordar")}' };
            var _FASE_ULT = { ampliar:'05_ULT_AVISO', disidentes:'05_ULT_RESOLUCION', resolver:'05_ULT_RESOLVER', ampliar8:'08_ULT_AVISO', disidentes8:'08_ULT_RESOLUCION', resolver8:'08_ULT_RESOLVER', recordar:'05_ULT_AVISO', recordar8:'08_ULT_AVISO' };
            var _TIT_ULT = { ampliar:'📧 Ampliación de plazo (envía PRÓRROGA · 1er envío)', disidentes:'📧 Solicitud de disidentes (envía SOLICITUD DISIDENTES)', resolver:'📧 Resolución de contrato (envía SOLICITUD RESOLUCIÓN)', ampliar8:'📧 Ampliación de plazo (envía PRÓRROGA · 1er envío)', disidentes8:'📧 Solicitud de disidentes (envía SOLICITUD DISIDENTES)', resolver8:'📧 Resolución de contrato (envía SOLICITUD RESOLUCIÓN)', recordar:'📧 Ampliación de plazo (envía PRÓRROGA · 2º envío)', recordar8:'📧 Ampliación de plazo (envía PRÓRROGA · 2º envío)' };
            var _PREV_ULT = '${urlT(token, "/presupuestos/plantilla-mail")}';
            window.ptlMakeDraggable = window.ptlMakeDraggable || function(boxEl, titleEl, closeEl){
              if (!boxEl || !titleEl) return;
              let arrastrando = false;
              let offX = 0, offY = 0;
              titleEl.addEventListener('mousedown', function(e){
                if (closeEl && e.target.closest && e.target === closeEl) return;
                if (closeEl && e.target.closest && e.target.closest('.ptl-floating-close')) return;
                arrastrando = true;
                const rect = boxEl.getBoundingClientRect();
                offX = e.clientX - rect.left;
                offY = e.clientY - rect.top;
                e.preventDefault();
              });
              document.addEventListener('mousemove', function(e){
                if (!arrastrando) return;
                let x = e.clientX - offX;
                let y = e.clientY - offY;
                const maxX = window.innerWidth  - boxEl.offsetWidth  - 4;
                const maxY = window.innerHeight - boxEl.offsetHeight - 4;
                if (x < 4) x = 4; if (x > maxX) x = maxX;
                if (y < 4) y = 4; if (y > maxY) y = maxY;
                boxEl.style.left = x + 'px';
                boxEl.style.top  = y + 'px';
              });
              document.addEventListener('mouseup', function(){ arrastrando = false; });
            };
            window.ptlCentrarVentana = window.ptlCentrarVentana || function(boxEl){
              if (!boxEl) return;
              const w = boxEl.offsetWidth || 680;
              const h = boxEl.offsetHeight || 500;
              const left = Math.max(0, Math.round((window.innerWidth - w) / 2));
              const top  = Math.max(0, Math.round((window.innerHeight - h) / 2));
              boxEl.style.left = left + 'px';
              boxEl.style.top  = top + 'px';
            };
            function _ultCerrar(){ var m=document.getElementById('ptl-modal-ult'); if(m) m.style.display='none'; }
            function _ultCrearModal(){
              if(document.getElementById('ptl-modal-ult')) return;
              var d=document.createElement('div'); d.id='ptl-modal-ult'; d.className='ptl-floating-wrapper';
              var s='width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px';
              var h='';
              h+='<div id="ptl-ult-box" class="ptl-floating-window" style="width:680px">';
              h+='<div id="ptl-ult-title" class="ptl-floating-title"><span id="ptl-ult-titulo" class="ptl-floating-title-text">📧 Ultimátum</span><button type="button" id="ptl-ult-cerrar" class="ptl-floating-close" title="Cerrar">✕</button></div>';
              h+='<div class="ptl-floating-body">';
              h+='<div id="ptl-ult-aviso" style="display:none;padding:8px 12px;background:var(--ptl-warning-light);border-radius:6px;margin-bottom:12px;font-size:12px;color:var(--ptl-warning-dark)"></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">Asunto</label><input id="ptl-ult-asunto" type="text" style="'+s+'"/></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">Para</label><input id="ptl-ult-dest" type="text" style="'+s+'"/></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">CC</label><input id="ptl-ult-cc" type="text" style="'+s+'"/></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">CCO <span style="color:var(--ptl-gray-400);font-weight:normal">(oculta, separar con coma)</span></label><input id="ptl-ult-cco" type="text" style="'+s+'"/></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">Mensaje</label><textarea id="ptl-ult-mensaje" rows="10" style="width:100%;padding:8px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea></div>';
              h+='<div class="ptl-mb10"><label class="ptl-label-2nd">Adjuntos (links de Drive, hasta 3)</label><div style="display:flex;flex-direction:column;gap:6px">';
              h+='<div class="ptl-flex-g6"><input type="text" id="ptl-ult-adj1lbl" placeholder="Etiqueta (ej: DISIDENTES)" class="ptl-select-200"/><input type="text" id="ptl-ult-adj1url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/></div>';
              h+='<div class="ptl-flex-g6"><input type="text" id="ptl-ult-adj2lbl" placeholder="Etiqueta" class="ptl-select-200"/><input type="text" id="ptl-ult-adj2url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/></div>';
              h+='<div class="ptl-flex-g6"><input type="text" id="ptl-ult-adj3lbl" placeholder="Etiqueta" class="ptl-select-200"/><input type="text" id="ptl-ult-adj3url" placeholder="https://drive.google.com/..." class="ptl-input-flex"/></div>';
              h+='</div></div>';
              h+='<div id="ptl-ult-estado" style="font-size:11px;color:var(--ptl-gray-500);margin-top:8px"></div>';
              h+='<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid var(--ptl-gray-200)">';
            h+='<button type="button" id="ptl-ult-saltar" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="margin-right:auto">→ Continuar sin enviar</button>';
              h+='<button type="button" id="ptl-ult-cancelar" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>';
              h+='<button type="button" id="ptl-ult-enviar" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Confirmar envío</button>';
              h+='</div></div></div>';
              d.innerHTML=h; document.body.appendChild(d);
              document.getElementById('ptl-ult-cerrar').addEventListener('click', _ultCerrar);
              document.getElementById('ptl-ult-cancelar').addEventListener('click', _ultCerrar);
              if(typeof window.ptlMakeDraggable==='function'){ window.ptlMakeDraggable(document.getElementById('ptl-ult-box'), document.getElementById('ptl-ult-title'), document.getElementById('ptl-ult-cerrar')); }
            }
            async function ptlAbrirModalUltimatum(accion, ccppId){
              var fase=_FASE_ULT[accion]; if(!fase) return;
              _ultCrearModal();
              var m=document.getElementById('ptl-modal-ult'); m.style.display='block';
              if(typeof window.ptlCentrarVentana==='function'){ window.ptlCentrarVentana(document.getElementById('ptl-ult-box')); }
              document.getElementById('ptl-ult-titulo').textContent=_TIT_ULT[accion]||'📧 Ultimátum';
              document.getElementById('ptl-ult-aviso').style.display='none';
              document.getElementById('ptl-ult-asunto').value='Cargando...';
              document.getElementById('ptl-ult-mensaje').value=''; document.getElementById('ptl-ult-dest').value='';
              document.getElementById('ptl-ult-cc').value=''; document.getElementById('ptl-ult-cco').value='';
              ['ptl-ult-adj1lbl','ptl-ult-adj1url','ptl-ult-adj2lbl','ptl-ult-adj2url','ptl-ult-adj3lbl','ptl-ult-adj3url'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
              document.getElementById('ptl-ult-estado').textContent='';
              var btn=document.getElementById('ptl-ult-enviar'); btn.disabled=false; btn.textContent='📧 Confirmar envío';
            var btnS=document.getElementById('ptl-ult-saltar'); if(btnS){ btnS.disabled=false; btnS.textContent='→ Continuar sin enviar'; }
              try{
                var r=await fetch(_PREV_ULT+'&fase='+encodeURIComponent(fase)+'&id='+encodeURIComponent(ccppId));
                if(!r.ok){ var e=await r.json().catch(function(){return {};}); alert('Error: '+(e.error||('HTTP '+r.status))); _ultCerrar(); return; }
                var data=await r.json();
                document.getElementById('ptl-ult-dest').value=(data.destinatario&&data.destinatario.email)||'';
                document.getElementById('ptl-ult-cc').value=(data.destinatario&&data.destinatario.cc)||'';
                document.getElementById('ptl-ult-asunto').value=(data.plantilla&&data.plantilla.asunto)||'';
                document.getElementById('ptl-ult-mensaje').value=(data.plantilla&&data.plantilla.mensaje)||'';
                document.getElementById('ptl-ult-cco').value=String((data.plantilla&&data.plantilla.cco)||'').split('||').map(function(x){return x.trim();}).filter(Boolean).join(', ');
                (function(){ var partes=String((data.plantilla&&data.plantilla.adjuntos_fijos)||'').split('||').map(function(x){return x.trim();}).filter(Boolean); for(var i=0;i<3;i++){ var l=document.getElementById('ptl-ult-adj'+(i+1)+'lbl'), u=document.getElementById('ptl-ult-adj'+(i+1)+'url'); if(!l||!u)continue; var pp=partes[i]||''; if(!pp){l.value='';u.value='';continue;} var ix=pp.indexOf('http'); if(ix===-1){l.value=pp;u.value='';}else{u.value=pp.slice(ix).trim(); var lbl=pp.slice(0,ix).trim(); if(lbl.charAt(lbl.length-1)===':')lbl=lbl.slice(0,-1).trim(); l.value=lbl;} } })();
                if(!(data.destinatario&&data.destinatario.email)){ var a=document.getElementById('ptl-ult-aviso'); a.style.display='block'; a.textContent='⚠ Esta CCPP no tiene email configurado. Añade uno en la ficha antes de enviar.'; }
              }catch(e){ alert('Error cargando plantilla: '+e.message); _ultCerrar(); return; }
              if(btnS){ btnS.onclick=async function(){
              if(!confirm('¿Continuar sin enviar el correo?\\n\\nSe marca el paso como hecho (se sella la fecha) pero NO se envía ningún email.')) return;
              btnS.disabled=true; btnS.textContent='Guardando...';
              try{
                var fd2=new URLSearchParams(); fd2.append('id', ccppId); fd2.append('skip','1');
                var resp2=await fetch(_URL_ULT[accion], {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: fd2.toString()});
                var dd2=await resp2.json();
                if(!resp2.ok) throw new Error(dd2.error||('HTTP '+resp2.status));
                _ultCerrar(); location.reload();
              }catch(e){ alert('Error: '+e.message); btnS.disabled=false; btnS.textContent='→ Continuar sin enviar'; }
            }; }
            btn.onclick=async function(){
                btn.disabled=true; btn.textContent='Enviando...';
                try{
                  var fd=new URLSearchParams();
                  fd.append('id', ccppId);
                  fd.append('destinatario', document.getElementById('ptl-ult-dest').value);
                  fd.append('cc', document.getElementById('ptl-ult-cc').value);
                  fd.append('cco', document.getElementById('ptl-ult-cco').value);
                  fd.append('asunto', document.getElementById('ptl-ult-asunto').value);
                  fd.append('mensaje', document.getElementById('ptl-ult-mensaje').value);
                  var _adjs=[]; for(var _i=1;_i<=3;_i++){ var _lbl=(document.getElementById('ptl-ult-adj'+_i+'lbl').value||'').trim(); var _url=(document.getElementById('ptl-ult-adj'+_i+'url').value||'').trim(); if(_url)_adjs.push((_lbl||'ADJUNTO_'+_i)+': '+_url); } fd.append('adjuntos', _adjs.join(' || '));
                  var resp=await fetch(_URL_ULT[accion], {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: fd.toString()});
                  var dd=await resp.json();
                  if(!resp.ok) throw new Error(dd.error||('HTTP '+resp.status));
                  alert('✓ Email enviado.'); _ultCerrar(); location.reload();
                }catch(e){ alert('Error: '+e.message); btn.disabled=false; btn.textContent='📧 Confirmar envío'; }
              };
            }
            document.addEventListener('click', function(ev){
              var b = (ev.target && ev.target.closest) ? ev.target.closest('.ptl-ult-btn') : null;
              if (b) { ev.preventDefault(); ptlAbrirModalUltimatum(b.dataset.accion, b.dataset.ccppId); }
            });
            
            
            document.querySelectorAll('.hoy-bot-llamado').forEach(function(chk){
              chk.addEventListener('change', async function(){
                var tel = chk.dataset.tel;
                var campo = chk.dataset.campo || 'llamado';
                var valor = chk.checked ? '1' : '';
                chk.disabled = true;
                try {
                  var body = new URLSearchParams({ tel: tel, campo: campo, valor: valor });
                  var res = await fetch('${urlT(token, "/presupuestos/hoy-bot-llamado")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { chk.checked = !chk.checked; var tx = await res.text(); alert('No se pudo guardar: ' + tx); }
                  else if ((campo === 'revisado' || campo === 'revisado_faltan' || campo === 'revisado_ayuda') && chk.checked) { var _fila = chk.closest('.hoy-exp-fila'); if (_fila) _fila.remove(); }
                } catch(e){ chk.checked = !chk.checked; alert('No se pudo guardar: ' + e.message); }
                finally { chk.disabled = false; }
              });
            });


            // v17.78 — Helper unificado de feedback de guardado.
            // OK   → recuadro verde (borde+relleno) 5s y vuelve al normal.
            // FAIL → recuadro rojo PERMANENTE hasta el próximo guardado OK.
            // Usa las clases compartidas .ptl-guardado-ok / .ptl-guardado-error de
            // estilo-visual.cjs v1.16 (mismo aspecto que la ficha del expediente y
            // la tabla de documentación). Antes ponía el color con border inline,
            // solo borde y a 2s, por eso aquí no se veía el relleno.
            function _flashGuardado(el, ok) {
              if (el._flashTimer) { clearTimeout(el._flashTimer); el._flashTimer = null; }
              el.classList.remove('ptl-guardado-ok', 'ptl-guardado-error');
              if (ok) {
                el.classList.add('ptl-guardado-ok');
                el._flashTimer = setTimeout(function(){
                  el.classList.remove('ptl-guardado-ok');
                  el._flashTimer = null;
                }, 5000);
              } else {
                el.classList.add('ptl-guardado-error');
                // No timer: se queda rojo hasta el siguiente _flashGuardado(el, true).
              }
            }

            // v17.51 — Edición inline de notas_pto desde la caja "Expedientes en HOY"
            // Guarda en blur si el valor cambió (igual patrón que la ficha).
            // v17.67 — Usa _flashGuardado (verde 2s / rojo permanente).
            document.querySelectorAll('.hoy-exp-notas').forEach(function(ta){
              ta.addEventListener('blur', async function(){
                var ccppId = ta.dataset.ccppId;
                var nuevo = ta.value;
                var orig = ta.dataset.orig || '';
                if (nuevo === orig) return;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'notas_pto', valor: nuevo });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { _flashGuardado(ta, false); return; }
                  ta.dataset.orig = nuevo;
                  _flashGuardado(ta, true);
                } catch(e){ _flashGuardado(ta, false); }
              });
            });

            // v17.52 — Reloj de piso: quita el piso de HOY.
            document.querySelectorAll('.hoy-piso-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var ccppId = btn.dataset.ccppId;
                var vivienda = btn.dataset.vivienda;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ ccpp_id: ccppId, vivienda: vivienda });
                  var res = await fetch('${urlT(token, "/presupuestos/piso/toggle-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v17.52 — Edición inline de notas_piso.
            // v17.67 — Usa _flashGuardado (verde 2s / rojo permanente).
            document.querySelectorAll('.hoy-piso-notas').forEach(function(ta){
              ta.addEventListener('blur', async function(){
                var ccppId = ta.dataset.ccppId;
                var vivienda = ta.dataset.vivienda;
                var nuevo = ta.value;
                var orig = ta.dataset.orig || '';
                if (nuevo === orig) return;
                try {
                  var body = new URLSearchParams({ ccpp_id: ccppId, vivienda: vivienda, notas: nuevo });
                  var res = await fetch('${urlT(token, "/presupuestos/piso/guardar-notas-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { _flashGuardado(ta, false); return; }
                  ta.dataset.orig = nuevo;
                  _flashGuardado(ta, true);
                } catch(e){ _flashGuardado(ta, false); }
              });
            });

            // Desplegable unificado: combina chip+select de antes.
            // - Si el usuario no cambia la opción inicial → no se hace nada.
            // - Si cambia → confirma y asigna al expediente nuevo.
            document.querySelectorAll('.hoy-select-unif').forEach(function(sel){
              sel.addEventListener('change', async function(){
                var valorInicial = sel.dataset.valorInicial || '';
                if (sel.value === valorInicial) return; // no ha cambiado nada
                if (!sel.value) { sel.value = valorInicial; return; }
                var mailId = sel.dataset.mailId;
                var ccpp = sel.value;
                sel.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId, ccpp_id: ccpp });
                  var res = await fetch(URL_CLASIF, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); sel.disabled = false; sel.value = valorInicial; return; }
                  // v17.57 — En vez de location.reload(), actualizamos solo la
                  // fila en el DOM:
                  //  - select pasa a fondo verde con la opción seleccionada
                  //    marcada con "✓ " delante (como las filas ya clasificadas)
                  //  - los botones ↩/↪ ahora pueden funcionar (data-ccpp se rellena)
                  //  - el reloj sigue como estaba
                  // Esto evita la recarga completa de HOY que tardaba 1-3s.
                  var opt = sel.options[sel.selectedIndex];
                  var labelExp = (opt ? (opt.textContent || '') : '').replace(/^✓\\s*/, '');
                  // Mover la opción seleccionada al primer puesto con prefijo ✓.
                  // Limpiamos otros prefijos ✓ por si quedaba uno suelto.
                  Array.prototype.forEach.call(sel.options, function(o){
                    if (o.value && o.textContent.indexOf('✓ ') === 0 && o !== opt) {
                      o.textContent = o.textContent.replace(/^✓\\s*/, '');
                    }
                  });
                  if (opt && opt.textContent.indexOf('✓ ') !== 0) {
                    opt.textContent = '✓ ' + labelExp;
                  }
                  // Quitar opción "elegir expediente" si existe.
                  Array.prototype.forEach.call(sel.options, function(o){
                    if (!o.value && o.textContent.indexOf('elegir') >= 0) {
                      o.parentNode.removeChild(o);
                    }
                  });
                  sel.dataset.valorInicial = ccpp;
                  // Estilo "asignado": fondo verde claro.
                  sel.style.background = 'var(--ptl-success-light)';
                  sel.style.color = 'var(--ptl-success-dark)';
                  sel.style.fontWeight = '600';
                  // Actualizar data-ccpp de los botones ↩/↪ de esta fila para
                  // que puedan funcionar inmediatamente sin recargar.
                  var fila = sel.closest('.ptl-com-row');
                  if (fila) {
                    var btResp = fila.querySelector('.hoy-responder');
                    var btReen = fila.querySelector('.hoy-reenviar');
                    if (btResp) btResp.dataset.ccpp = ccpp;
                    if (btReen) btReen.dataset.ccpp = ccpp;
                  }
                  sel.disabled = false;
                } catch(e){ alert('Error: ' + e.message); sel.disabled = false; sel.value = valorInicial; }
              });
            });

            // Descartar = borrar el mail Y sus adjuntos en Drive
            document.querySelectorAll('.hoy-descartar').forEach(function(btn){
              btn.addEventListener('click', async function(){
                if (!confirm('¿Borrar este mail definitivamente?\\n\\nSe eliminará la fila y los adjuntos asociados (a la papelera de Drive).\\n\\nEsta acción no se puede deshacer desde aquí.')) return;
                var mailId = btn.dataset.mailId;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId });
                  var res = await fetch(URL_DESC, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // Botón "Leer IMAP ahora"
            var btnRun = document.getElementById('hoy-imap-run');
            if (btnRun) {
              btnRun.addEventListener('click', async function(){
                btnRun.disabled = true;
                var orig = btnRun.textContent;
                btnRun.textContent = '⏳ Leyendo IMAP...';
                try {
                  var res = await fetch(URL_IMAP_RUN, { method:'POST' });
                  var data = await res.json();
                  if (!res.ok) { alert('Error: ' + (data.error || res.status)); btnRun.disabled=false; btnRun.textContent=orig; return; }
                  alert('IMAP: procesados=' + data.procesados + ' errores=' + data.errores);
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btnRun.disabled=false; btnRun.textContent=orig; }
              });
            }

            // Botón "Importar mails de Drive"
            var btnImp = document.getElementById('hoy-imap-importar-drive');
            if (btnImp) {
              btnImp.addEventListener('click', async function(){
                btnImp.disabled = true;
                var orig = btnImp.textContent;
                btnImp.textContent = '⏳ Importando...';
                try {
                  var res = await fetch(URL_IMAP_IMPORTAR_DRIVE, { method:'POST' });
                  var data = await res.json();
                  if (!res.ok || data.ok === false) {
                    alert('Error: ' + (data.error || res.status));
                    btnImp.disabled=false; btnImp.textContent=orig;
                    return;
                  }
                  var msg = 'Drive: procesados=' + data.procesados + ' errores=' + data.errores;
                  if (data.errores > 0 && data.detalle_errores && data.detalle_errores.length) {
                    msg += '\\n\\n' + data.detalle_errores.join('\\n');
                  }
                  alert(msg);
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btnImp.disabled=false; btnImp.textContent=orig; }
              });
            }
          })();
        </script>
      `;

      // v17.64 — Cabecera unificada. Antes había ~95 líneas inline (count
      // de fases, _filtroBtnHoy, buscador con ptlFiltrarHoy, script del cron,
      // pestañas duplicadas). Ahora todo eso vive en renderCabeceraComun.
      // No pasamos filtroActivo: en HOY ninguna pestaña va resaltada.
      const cabecera = renderCabeceraComun(token, comusListado, { searchInHeader: true });

      sendHtml(res, pageHtml("HOY",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "HOY", url: "#" }],
        cabecera + body,
        token, { search: true, searchValue: (req.query.q || ""), cron: true }));
    } catch (e) {
      console.error("[presupuestos] /hoy:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // =================================================================
  // PANTALLA DE PLANTILLAS DE MAIL (CRUD via Sheet)
  // =================================================================
  // GET /presupuestos/plantillas — listado/edición
  app.get("/presupuestos/plantillas", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      // Construir filas: una por cada fase con botón de email (plantilla en PTO_FASES)
      // + 04_REENVIO (plantilla virtual, sin fase real, usada por el botón "Reenviar
      // presupuesto modificado" desde fase 04).
      // Si la plantilla no existe en el Sheet, mostramos una fila VACÍA para crearla.
      const fasesConPlantilla = ["01_CONTACTO", "02_PTE_VISITA_CON_ACTA", "03_ENVIO_PTO", "04_ACEPTACION_PTO", "04_REENVIO", "05_ACEPTACION_PTO", "05_SEGUIMIENTO_DOC", "05_ULTIMATUM_DOC", "05_ULT_RESOLVER", "05_FIN_DOC", "08_INICIO_CYCP", "08_SEGUIMIENTO_CYCP", "08_ULTIMATUM_CYCP", "08_ULT_RESOLVER", "08_FIN_CYCP"];
      // v17.20: paralelizar las 12 lecturas. Con el caché de filas
      // todas resuelven contra una sola lectura del Sheet (antes era
      // un for secuencial que disparaba 12 peticiones).
      const _plantillasArr = await Promise.all(
        fasesConPlantilla.map(f => leerPlantillaMail(f).catch(() => null))
      );
      const plantillas = fasesConPlantilla.map((f, i) => {
        const p = _plantillasArr[i];
        if (p) return p;
        // Plantilla no creada todavía: fila vacía para que el usuario la rellene
        return {
          fase: f,
          activo: true,
          asunto: "",
          mensaje: "",
          adjuntos_fijos: "",
          dias_primer_envio: 0,
          dias_recurrente: 0,
          max_envios: 0,
          cco: "",
        };
      });
      // Cargar cuentas configuradas en mail_cuentas para el selector "Enviar desde"
      const cuentas = await leerCuentasMail(true); // forzar lectura sin caché
      // Cargar pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D=mensaje)
      const pieRow = await leerPlantillaMail("_PIE_GLOBAL");
      const pieGlobal = pieRow ? (pieRow.mensaje || "") : "";
      const _segEspera = await leerPlantillaMail("05_SEG_ESPERA").catch(() => null);
      const _segFecha  = await leerPlantillaMail("05_SEG_FECHA").catch(() => null);
      const _actaSin   = await leerPlantillaMail("02_PTE_VISITA_SIN_ACTA").catch(() => null);
      const _ultAviso  = await leerPlantillaMail("05_ULT_AVISO").catch(() => null);
      const _ultResol  = await leerPlantillaMail("05_ULT_RESOLUCION").catch(() => null);
      const _ultAviso8 = await leerPlantillaMail("08_ULT_AVISO").catch(() => null);
      const _ultResol8 = await leerPlantillaMail("08_ULT_RESOLUCION").catch(() => null);
      sendHtml(res, pageHtml("Plantillas mail",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas", url: "#" }],
        vistaPlantillas(plantillas, token, cuentas, pieGlobal, { espera: _segEspera, fecha: _segFecha, aviso: _ultAviso, resolucion: _ultResol, aviso8: _ultAviso8, resolucion8: _ultResol8, actaSin: _actaSin }),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas/guardar — guarda una fila en mail_plantillas
  app.post("/presupuestos/plantillas/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const fase = String(req.body.fase || "").trim();
      if (!fase) return sendError(res, "Fase requerida");
      // Adjuntos: 3 campos separados (adjunto_1, adjunto_2, adjunto_3) que se
      // concatenan con '||' al guardar en la única columna `adjuntos_fijos`.
      const a1 = String(req.body.adjunto_1 || "").trim();
      const a2 = String(req.body.adjunto_2 || "").trim();
      const a3 = String(req.body.adjunto_3 || "").trim();
      const adjuntosFijos = (a1 || a2 || a3) ? [a1, a2, a3].join("||") : ""; // vacío = "" limpio
      // CCO: 3 campos separados (cco_1, cco_2, cco_3) que se concatenan con '||'
      // en la única columna `cco`.
      const c1 = String(req.body.cco_1 || "").trim();
      const c2 = String(req.body.cco_2 || "").trim();
      const c3 = String(req.body.cco_3 || "").trim();
      // Validar cada CCO individual (formato email, sin acentos)
      for (const [idx, val] of [[1, c1], [2, c2], [3, c3]]) {
        if (val && !esEmailValido(val)) {
          return sendError(res, `CCO ${idx} no válido. Debe ser un email correcto sin acentos ni espacios.`);
        }
      }
      const cco = (c1 || c2 || c3) ? [c1, c2, c3].join("||") : "";
      const datos = {
        fase,
        activo:           (req.body.activo === "SI" || req.body.activo === "on" || req.body.activo === "true") ? "SI" : "NO",
        asunto:           String(req.body.asunto || "").trim(),
        mensaje:          String(req.body.mensaje || "").trim(),
        adjuntos_fijos:   adjuntosFijos,
        dias_primer_envio: parseInt(req.body.dias_primer_envio) || 0,
        dias_recurrente:  parseInt(req.body.dias_recurrente) || 0,
        max_envios:       parseInt(req.body.max_envios) || 0,
        cco,
        cuenta_envio:     String(req.body.cuenta_envio || "").trim(),
      };
      // Validaciones básicas
      if (datos.asunto.length < 1 || datos.asunto.length > 200) {
        return sendError(res, "Asunto debe tener entre 1 y 200 caracteres");
      }
      if (datos.mensaje.length < 1 || datos.mensaje.length > 5000) {
        return sendError(res, "Mensaje debe tener entre 1 y 5000 caracteres");
      }
      if (datos.dias_recurrente < 0 || datos.dias_recurrente > 365) {
        return sendError(res, "Días entre envíos debe estar entre 0 y 365");
      }
      if (datos.max_envios < 1 || datos.max_envios > 10) {
        return sendError(res, "Máximo de envíos debe estar entre 1 y 10");
      }
      if (fase === "02_PTE_VISITA_CON_ACTA" && (req.body.mensaje_con != null || req.body.mensaje_sin != null)) {
        // Tarjeta unificada fase 02: guarda los dos textos en sus claves (CON/SIN acta),
        // compartiendo asunto, cuenta y estado activo.
        const msgCon = String(req.body.mensaje_con || "").trim();
        const msgSin = String(req.body.mensaje_sin || "").trim();
        if (msgCon.length < 1 || msgCon.length > 5000) return sendError(res, "El texto CON ACTA debe tener entre 1 y 5000 caracteres");
        if (msgSin.length < 1 || msgSin.length > 5000) return sendError(res, "El texto SIN ACTA debe tener entre 1 y 5000 caracteres");
        datos.mensaje = msgCon;
        await guardarPlantillaMail(datos); // CON ACTA (asunto/cuenta/activo + texto CON)
        await guardarPlantillaMail({ fase: "02_PTE_VISITA_SIN_ACTA", activo: datos.activo, asunto: datos.asunto, mensaje: msgSin, adjuntos_fijos: "", dias_primer_envio: 0, dias_recurrente: 0, max_envios: 0, cco: "", cuenta_envio: datos.cuenta_envio });
      } else if (fase === "05_SEGUIMIENTO_DOC") {
        // Tarjeta única: guarda el contenedor (cron) + los dos textos en sus claves.
        const msgListado = String(req.body.mensaje_listado || "").trim();
        const msgDoc = String(req.body.mensaje_doc || "").trim();
        if (msgListado.length < 1 || msgListado.length > 5000) return sendError(res, "El texto de SEGUIMIENTO LISTADO debe tener entre 1 y 5000 caracteres");
        if (msgDoc.length < 1 || msgDoc.length > 5000) return sendError(res, "El texto de SEGUIMIENTO DOC debe tener entre 1 y 5000 caracteres");
        datos.mensaje = "{{bloque_seguimiento}}"; // el contenedor siempre lleva el interruptor
        await guardarPlantillaMail(datos);
        await guardarPlantillaMail({ fase: "05_SEG_ESPERA", activo: "SI", asunto: "", mensaje: msgListado, adjuntos_fijos: "", dias_primer_envio: 0, dias_recurrente: 0, max_envios: 0, cco: "", cuenta_envio: "" });
        await guardarPlantillaMail({ fase: "05_SEG_FECHA", activo: "SI", asunto: "", mensaje: msgDoc, adjuntos_fijos: "", dias_primer_envio: 0, dias_recurrente: 0, max_envios: 0, cco: "", cuenta_envio: "" });
      } else if (fase === "05_ULTIMATUM_DOC") {
        // Tarjeta única: guarda el contenedor (cron) + los dos textos en sus claves.
        const msgAviso = String(req.body.mensaje_aviso || "").trim();
        const msgResol = String(req.body.mensaje_resolucion || "").trim();
        if (msgAviso.length < 1 || msgAviso.length > 5000) return sendError(res, "El texto de ULTIMÁTUM AVISO debe tener entre 1 y 5000 caracteres");
        if (msgResol.length < 1 || msgResol.length > 5000) return sendError(res, "El texto de ULTIMÁTUM RESOLUCIÓN debe tener entre 1 y 5000 caracteres");
        const _clp = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : def; };
        const _pA = _clp(req.body.plazo_ampliar, 20);       // Ampliar: días desde contacto
        const _pR = _clp(req.body.plazo_recordatorio, 10);  // Recordatorio: días desde Ampliar
        const _pD = _pA;                                    // Disidentes = mismo plazo que Ampliación (prórroga)
        datos.mensaje = "{{bloque_ultimatum}}"; // el contenedor siempre lleva el interruptor
        await guardarPlantillaMail(datos);
        const _ccoUlt = [String(req.body.cco_1 || "").trim(), String(req.body.cco_2 || "").trim(), String(req.body.cco_3 || "").trim()];
        const _ccoUltStr = (_ccoUlt[0] || _ccoUlt[1] || _ccoUlt[2]) ? _ccoUlt.join("||") : "";
        await guardarPlantillaMail({ fase: "05_ULT_AVISO", activo: "SI", asunto: "", mensaje: msgAviso, adjuntos_fijos: "", dias_primer_envio: _pA, dias_recurrente: _pR, max_envios: 0, cco: _ccoUltStr, cuenta_envio: "" });
        await guardarPlantillaMail({ fase: "05_ULT_RESOLUCION", activo: "SI", asunto: "", mensaje: msgResol, adjuntos_fijos: "", dias_primer_envio: _pD, dias_recurrente: 0, max_envios: 0, cco: _ccoUltStr, cuenta_envio: "" });
      } else if (fase === "08_ULTIMATUM_CYCP") {
        // Igual que 05_ULTIMATUM_DOC pero para fase 08 (contratos y cartas de pago).
        const msgAviso = String(req.body.mensaje_aviso || "").trim();
        const msgResol = String(req.body.mensaje_resolucion || "").trim();
        if (msgAviso.length < 1 || msgAviso.length > 5000) return sendError(res, "El texto de ULTIMÁTUM AVISO debe tener entre 1 y 5000 caracteres");
        if (msgResol.length < 1 || msgResol.length > 5000) return sendError(res, "El texto de ULTIMÁTUM RESOLUCIÓN debe tener entre 1 y 5000 caracteres");
        const _clp = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : def; };
        const _pA = _clp(req.body.plazo_ampliar, 10);       // Ampliar (prórroga)
        const _pR = _clp(req.body.plazo_recordatorio, 10);  // Recordatorio
        const _pD = _pA;                                    // Disidentes = mismo plazo que Ampliación
        datos.mensaje = "{{bloque_ultimatum}}";
        await guardarPlantillaMail(datos);
        const _ccoUlt = [String(req.body.cco_1 || "").trim(), String(req.body.cco_2 || "").trim(), String(req.body.cco_3 || "").trim()];
        const _ccoUltStr = (_ccoUlt[0] || _ccoUlt[1] || _ccoUlt[2]) ? _ccoUlt.join("||") : "";
        await guardarPlantillaMail({ fase: "08_ULT_AVISO", activo: "SI", asunto: "", mensaje: msgAviso, adjuntos_fijos: "", dias_primer_envio: _pA, dias_recurrente: _pR, max_envios: 0, cco: _ccoUltStr, cuenta_envio: "" });
        await guardarPlantillaMail({ fase: "08_ULT_RESOLUCION", activo: "SI", asunto: "", mensaje: msgResol, adjuntos_fijos: "", dias_primer_envio: _pD, dias_recurrente: 0, max_envios: 0, cco: _ccoUltStr, cuenta_envio: "" });
      } else {
        await guardarPlantillaMail(datos);
      }
      res.redirect(urlT(token, "/presupuestos/plantillas", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas/guardar-pie-global
  // Guarda el pie de página global en una fila especial _PIE_GLOBAL de mail_plantillas
  // (usa el campo `mensaje` para el texto del pie). El resto de columnas quedan vacías.
  app.post("/presupuestos/plantillas/guardar-pie-global", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      await guardarPlantillaMail({
        fase: "_PIE_GLOBAL",
        activo: "SI",
        asunto: "",
        mensaje: String(req.body.pie_global || "").trim(),
        adjuntos_fijos: "",
        dias_primer_envio: 0,
        dias_recurrente: 0,
        max_envios: 0,
        cco: "",
        cuenta_envio: "",
      });
      res.redirect(urlT(token, "/presupuestos/plantillas", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas/guardar-pie-global:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // =================================================================
  // PLANTILLAS DE DOCUMENTOS (v17.82) — pantalla de edición + guardado
  // Mismo esquema que /presupuestos/plantillas (mail) pero para la tab
  // doc_plantillas. Bloque 1 del Sprint A (no necesita pdfkit).
  // =================================================================

  // GET /presupuestos/mapa — mapa con los expedientes geolocalizados (Leaflet + OSM)
  // Lee la columna `earth` (col L) de cada comunidad, que contiene "lat, lng".
  // Pinta una chincheta por expediente con coordenada, coloreada por grupo de fase.
  // Las coordenadas se cargaron desde el KMZ (ver coordenadas_earth.xlsx, v17.97).
  app.get("/presupuestos/mapa", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    const focusId = String(req.query.focus || "").trim(); // v18.03: centrar en este ccpp_id si viene de la ficha
    try {
      const comunidades = await leerComunidades();
      // Agrupación de fases en bloques de color (para no marear con 11 colores).
      // Devuelve { grupo, color, label } para una fase normalizada.
      const grupoDeFase = (faseRaw) => {
        const f = normalizarFase(faseRaw);
        if (f === "01_CONTACTO" || f === "02_VISITA")
          return { grupo: "contacto", color: "var(--ptl-gray-500)", label: "Contacto / Visita" };
        if (f === "03_ENVIO_PTO" || f === "04_ACEPTACION_PTO")
          return { grupo: "presupuesto", color: "var(--ptl-general-1)", label: "Presupuesto enviado / aceptación" };
        if (f === "05_DOCUMENTACION" || f === "06_VISITA_EMASESA" || f === "07_PTE_CYCP" || f === "08_CYCP")
          return { grupo: "tramite", color: "var(--ptl-warning)", label: "En tramitación" };
        if (f === "09_TRAMITADA")
          return { grupo: "tramitada", color: "var(--ptl-success-dark)", label: "Tramitada" };
        if (f === "ZZ_RECHAZADO" || f === "ZZ_DESCARTADO")
          return { grupo: "rechazado", color: "var(--ptl-danger)", label: "Rechazado / Descartado" };
        return { grupo: "otro", color: "var(--ptl-general-1)", label: "Otros" };
      };
      // Parsear "lat, lng" de la columna earth. Devuelve [lat,lng] o null.
      const parseEarth = (val) => {
        if (!val) return null;
        const m = String(val).match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
        if (!m) return null;
        const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
        if (isNaN(lat) || isNaN(lng)) return null;
        // Sanidad: descartar 0,0 y valores fuera de rango terrestre
        if (lat === 0 && lng === 0) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return [lat, lng];
      };
      // v18.05 — municipio para geocodificar: por defecto Sevilla capital, salvo
      // que el tipo_via lleve el pueblo entre paréntesis (ej. "C (Alcalá de Guadaíra)",
      // "C (Dos Hermanas)", "C (S.Juan)"=San Juan de Aznalfarache). OJO: "(Bellavista)"
      // es barrio de Sevilla capital, no pueblo -> se trata como Sevilla.
      const _municipioGeo = (tipoVia) => {
        const m = String(tipoVia || "").match(/\(([^)]*)\)/);
        if (!m) return "Sevilla";
        let p = m[1].trim();
        if (/bellavista/i.test(p)) return "Sevilla";          // barrio de Sevilla capital
        if (/^s\.?\s*juan/i.test(p)) return "San Juan de Aznalfarache";
        return p; // Alcalá de Guadaíra, Dos Hermanas, etc.
      };
      // Construir los puntos para el front + la lista de PENDIENTES (sin coordenada)
      // que se pueden geocodificar (excluye los "Z SIN DIRECCION", que son relleno).
      const puntos = [];
      const pendientes = [];   // v18.05: para el botón "Ubicar las que faltan"
      const faltan = [];       // todas las sin coordenada (para el listado "ubicar a mano")
      let sinCoord = 0;
      for (const c of comunidades) {
        const ll = parseEarth(c.earth);
        const dirFull = (c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || c.comunidad || "");
        if (!ll) {
          sinCoord++;
          // Geocodificable solo si tiene dirección real (no los "Z SIN DIRECCION")
          const dirReal = String(c.direccion || "").trim();
          const _geocodable = !!(dirReal && !/^z\s+sin\s+direccion/i.test(dirReal));
          if (c.ccpp_id) faltan.push({ id: c.ccpp_id, dir: dirFull, geo: _geocodable });
          if (_geocodable) {
            // Query para Nominatim. NO incluimos el prefijo de vía abreviado
            // (C/Pz/Av/Ur/Bª/NR...): Nominatim casa mejor con "calle número, ciudad"
            // que con la abreviatura delante. Limpiamos "???" y los "Bloque.." sobrantes.
            const dirLimpia = dirReal.replace(/\?+/g, "").replace(/,?\s*bloques?\b.*$/i, "").replace(/\s+/g, " ").trim();
            const muni = _municipioGeo(c.tipo_via);
            pendientes.push({
              id: c.ccpp_id,
              dir: dirFull,
              query: `${dirLimpia}, ${muni}, España`.replace(/\s+/g, " ").trim(),
            });
          }
          continue;
        }
        const g = grupoDeFase(c.fase_presupuesto);
        puntos.push({
          id: c.ccpp_id,
          lat: ll[0], lng: ll[1],
          dir: dirFull,
          fase: normalizarFase(c.fase_presupuesto),
          color: g.color, grupo: g.grupo,
          url: urlT(token, "/presupuestos/expediente", { id: c.ccpp_id }),
        });
      }
      // Leyenda: grupos presentes
      const leyenda = [
        { grupo: "contacto", color: "var(--ptl-gray-500)", label: "Contacto / Visita" },
        { grupo: "presupuesto", color: "var(--ptl-general-1)", label: "Presupuesto / aceptación" },
        { grupo: "tramite", color: "var(--ptl-warning)", label: "En tramitación" },
        { grupo: "tramitada", color: "var(--ptl-success-dark)", label: "Tramitada" },
        { grupo: "rechazado", color: "var(--ptl-danger)", label: "Rechazado / Descartado" },
        // v18.05 — chinchetas geocodificadas SIN confirmar (amarillo + borde negro):
        { grupo: "provisional", color: "var(--ptl-warning)", label: "Sin confirmar (geolocalizada)", borde: "#000" },
      ];
      const leyendaHtml = leyenda.map(l =>
        `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
           <input type="checkbox" checked data-grupo="${l.grupo}" class="mapa-filtro"/>
           <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${l.color};border:${l.borde ? "2px solid " + l.borde : "1px solid rgba(0,0,0,.2)"}"></span>
           ${esc(l.label)}
         </label>`).join("");

      const content = `
        <div class="ptl-mb10">
          <span style="font-size:15px;font-weight:600">
            ${puntos.length} expedientes en el mapa · <span id="mapa-sincoord">${sinCoord}</span> sin coordenada
          </span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:8px 12px;background:var(--ptl-gray-50,var(--ptl-gray-50));border:1px solid var(--ptl-gray-200);border-radius:8px;margin-bottom:10px">
          <button type="button" id="mapa-todas" style="padding:3px 10px;border:1px solid var(--ptl-gray-300);background:var(--ptl-general-flotante);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">✓ Mostrar todas</button>
          <button type="button" id="mapa-ninguna" style="padding:3px 10px;border:1px solid var(--ptl-gray-300);background:var(--ptl-general-flotante);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">✗ Ocultar todas</button>
          <span style="width:1px;align-self:stretch;background:var(--ptl-gray-300)"></span>
          ${leyendaHtml}
        </div>
        ${faltan.length ? `
        <details id="mapa-faltan-panel" style="margin-bottom:10px;border:1px solid var(--ptl-gray-200);border-radius:8px;background:var(--ptl-gray-50)">
          <summary style="cursor:pointer;padding:8px 12px;font-size:13px;font-weight:600">📍 Ubicar las que faltan (${faltan.length})</summary>
          <div style="max-height:300px;overflow:auto;padding:2px 12px 10px">
            ${pendientes.length ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:2px solid var(--ptl-gray-200);font-size:13px">
               <span><strong>⚡ Automático</strong> — busca por internet las ${pendientes.length} que tienen dirección</span>
               <button id="mapa-ubicar" type="button" style="flex:0 0 auto;padding:4px 12px;border:1px solid var(--ptl-warning-dark);background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Ejecutar</button>
             </div>` : ""}
            ${faltan.map((f,i)=>`<div id="falta-row-${i}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--ptl-gray-100);font-size:13px">
               <span class="falta-dir">${esc(f.dir)}${f.geo ? "" : ' <span style=\"color:var(--ptl-gray-400)\">(sin dirección)</span>'}</span>
               <button type="button" class="mapa-amano" data-i="${i}" style="flex:0 0 auto;padding:4px 10px;border:1px solid var(--ptl-warning-dark);background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">📍 A mano</button>
             </div>`).join("")}
          </div>
        </details>
        <div id="mapa-manual-aviso" style="display:none;padding:8px 12px;margin-bottom:8px;background:var(--ptl-warning-light);border:1px solid var(--ptl-warning-dark);color:var(--ptl-warning-dark);border-radius:8px;font-size:13px;font-weight:600"></div>` : ""}
        <div style="position:relative;margin-bottom:8px">
          <input id="mapa-buscar" type="text" autocomplete="off"
            placeholder="🔍 Buscar dirección en el mapa (ej: Doña Clarines)..."
            style="width:100%;max-width:420px;padding:8px 12px;border:1px solid var(--ptl-gray-300);border-radius:8px;font-size:14px"/>
          <div id="mapa-buscar-res" style="position:absolute;z-index:1000;background:var(--ptl-general-flotante);border:1px solid var(--ptl-gray-300);border-radius:8px;max-width:420px;width:100%;max-height:240px;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,.12);display:none"></div>
        </div>
        <div id="mapa-ara" style="width:100%;height:72vh;border:1px solid var(--ptl-gray-300);border-radius:8px"></div>
        <div style="font-size:12px;color:var(--ptl-gray-500);margin-top:6px">
          💡 Pasa el ratón por una chincheta para ver su dirección. Arrástrala para corregir su ubicación (se pedirá confirmación antes de guardar).
        </div>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
        <script>
          (function(){
            var PUNTOS = ${JSON.stringify(puntos)};
            var PENDIENTES = ${JSON.stringify(pendientes)};   // v18.05: sin coordenada, geocodificables
            var FALTAN = ${JSON.stringify(faltan)};   // todas las sin coordenada (para ubicar a mano)
            var GUARDAR_URL = ${JSON.stringify(urlT(token, "/presupuestos/mapa/guardar-coord"))};
            var FOCUS_ID = ${JSON.stringify(focusId)};
            // Aviso si venimos de una ficha SIN coordenada (no se puede centrar).
            var FOCUS_SIN_COORD = ${JSON.stringify(
              focusId && !puntos.some(p => p.id === focusId)
                ? (() => {
                    const c = comunidades.find(x => x.ccpp_id === focusId);
                    return c ? ((c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || c.comunidad || "")) : "";
                  })()
                : ""
            )};
            var map = L.map('mapa-ara', {
              zoomSnap: 0,               // sin "imán" a niveles enteros: zoom continuo
              zoomDelta: 0.3,            // v18.06: pasos más finos (era 0.4) -> más suave
              wheelPxPerZoomLevel: 30,   // v18.06: más rápido aún (era 40 en v18.05); con zoomDelta 0.3 sube rápido pero suave
              wheelDebounceTime: 20,     // v18.33: era 60 -> metía ~60ms de delay entre girar la rueda y reaccionar; a 20 responde casi al instante sin saltar
              zoomAnimation: true
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19, attribution: '© OpenStreetMap'
            }).addTo(map);
            var markersPorGrupo = {};
            var bounds = [];
            // Icono de color por fase: un círculo CSS dentro de un divIcon.
            // Usamos L.marker (no circleMarker) porque solo los marker normales
            // soportan draggable. El divIcon nos deja mantener el color por fase.
            function iconoColor(color, borde){
              // borde: color del borde (por defecto blanco). Las provisionales usan negro.
              var b = borde || '#fff';
              return L.divIcon({
                className: 'mapa-pin',
                html: '<span style="display:block;width:16px;height:16px;border-radius:50%;'
                  + 'background:'+color+';border:2px solid '+b+';box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
                iconSize: [16,16], iconAnchor: [8,8], popupAnchor: [0,-8], tooltipAnchor: [0,-8]
              });
            }
            PUNTOS.forEach(function(p){
              var marker = L.marker([p.lat, p.lng], {
                icon: iconoColor(p.color),
                draggable: true   // arrastrable siempre
              });
              // Hover: muestra la dirección sin hacer clic (tooltip permanente al pasar)
              marker.bindTooltip(p.dir || '(sin dirección)', { direction: 'top', offset: [0,-6] });
              // Clic: globo completo con fase y enlace a la ficha
              var html = '<div style="font-size:13px;line-height:1.5">'
                + '<strong>' + (p.dir || '(sin dirección)') + '</strong><br/>'
                + '<span class="ptl-c-gray500">Fase: ' + (p.fase || '-') + '</span><br/>'
                + '<a href="' + p.url + '" style="color:var(--ptl-general-1);font-weight:600">Abrir ficha →</a>'
                + '</div>';
              marker.bindPopup(html);
              // Arrastre: al soltar, pedir confirmación y guardar (o revertir).
              marker._posOrig = [p.lat, p.lng];
              marker.on('dragend', function(){
                var ll = marker.getLatLng();
                var ok = confirm('¿Guardar nueva ubicación de "' + (p.dir||'') + '"?\\n\\n'
                  + 'Nueva coordenada:\\n' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6));
                if (!ok) { marker.setLatLng(marker._posOrig); return; }
                // El backend usa bodyParser.urlencoded (NO multipart/FormData),
                // así que enviamos los datos como x-www-form-urlencoded, igual que
                // el resto del módulo (ver fix análogo v17.84). Con FormData,
                // req.body llegaba vacío -> "Falta id".
                var body = 'id=' + encodeURIComponent(p.id)
                  + '&lat=' + encodeURIComponent(ll.lat)
                  + '&lng=' + encodeURIComponent(ll.lng);
                fetch(GUARDAR_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body
                })
                  .then(function(r){ return r.json(); })
                  .then(function(data){
                    if (data && data.ok) {
                      marker._posOrig = [ll.lat, ll.lng]; // nueva posición confirmada
                      // Parpadeo de "guardado OK": CIAN (var(--ptl-general-1)), color que NO
                      // usamos para ninguna fase (magenta de antes se confundía con
                      // el rojo de "Rechazado"). Parpadea 3 veces y vuelve a su color.
                      var destellos = 6; // 6 cambios = 3 parpadeos completos
                      var n = 0;
                      var iv = setInterval(function(){
                        marker.setIcon(iconoColor(n % 2 === 0 ? 'var(--ptl-general-1)' : p.color));
                        n++;
                        if (n >= destellos) { clearInterval(iv); marker.setIcon(iconoColor(p.color)); }
                      }, 220);
                    } else {
                      alert('No se pudo guardar: ' + (data && data.error ? data.error : 'error'));
                      marker.setLatLng(marker._posOrig);
                    }
                  })
                  .catch(function(e){
                    alert('Error de red al guardar: ' + e.message);
                    marker.setLatLng(marker._posOrig);
                  });
              });
              if (!markersPorGrupo[p.grupo]) markersPorGrupo[p.grupo] = [];
              markersPorGrupo[p.grupo].push(marker);
              p._marker = marker;   // referencia para el buscador
              marker.addTo(map);
              bounds.push([p.lat, p.lng]);
            });
            // v18.33: si venimos de una ficha (FOCUS_ID) y su chincheta existe,
            // centramos SOLO en ella (setView 17) y NOS SALTAMOS el fitBounds general.
            // Antes ambos se lanzaban en el mismo tick: la animación del fitBounds
            // (vista general) pisaba al setView y el mapa se quedaba en vista general
            // "ignorando" el foco. Ahora un único movimiento, sin carrera.
            var pf = FOCUS_ID ? PUNTOS.filter(function(p){ return p.id === FOCUS_ID; })[0] : null;
            if (pf) {
              map.setView([pf.lat, pf.lng], 17, { animate: true });
              if (pf._marker) setTimeout(function(){ pf._marker.openPopup(); }, 300);
            } else {
              if (bounds.length) map.fitBounds(bounds, { padding: [30,30] });
              else map.setView([37.3886, -5.9823], 12); // Sevilla por defecto
              // FOCUS_ID sin chincheta: la dirección de la ficha aún no tiene coordenada.
              if (FOCUS_ID && FOCUS_SIN_COORD) {
                setTimeout(function(){
                  alert('"' + FOCUS_SIN_COORD + '" aún no está ubicada en el mapa '
                    + '(no tiene coordenada). Puedes ubicarla cuando esté disponible la geolocalización automática.');
                }, 400);
              }
            }
            // Filtros por categoría (leyenda con checkboxes): muestra/oculta grupos
            document.querySelectorAll('.mapa-filtro').forEach(function(chk){
              chk.addEventListener('change', function(){
                var g = chk.dataset.grupo;
                (markersPorGrupo[g] || []).forEach(function(m){
                  if (chk.checked) m.addTo(map); else map.removeLayer(m);
                });
              });
            });
            // v: mostrar / ocultar todas las fases de golpe
            function _mapaSetTodas(mostrar){
              document.querySelectorAll('.mapa-filtro').forEach(function(chk){
                chk.checked = mostrar;
                (markersPorGrupo[chk.dataset.grupo] || []).forEach(function(m){
                  if (mostrar) m.addTo(map); else map.removeLayer(m);
                });
              });
            }
            var _bTodas = document.getElementById('mapa-todas');
            var _bNinguna = document.getElementById('mapa-ninguna');
            if (_bTodas) _bTodas.addEventListener('click', function(){ _mapaSetTodas(true); });
            if (_bNinguna) _bNinguna.addEventListener('click', function(){ _mapaSetTodas(false); });
            // ---- BUSCADOR ----
            // Filtra los puntos por dirección (sin acentos, ignora mayúsculas) y
            // al elegir uno centra el mapa, hace zoom y abre su globo.
            var inp = document.getElementById('mapa-buscar');
            var box = document.getElementById('mapa-buscar-res');
            function quitarAcentos(s){
              return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
            }
            function irAPunto(p){
              box.style.display = 'none';
              inp.value = p.dir;
              map.setView([p.lat, p.lng], 17, { animate: true });
              if (p._marker) p._marker.openPopup();
            }
            inp.addEventListener('input', function(){
              var q = quitarAcentos(inp.value.trim());
              if (!q) { box.style.display='none'; return; }
              var matches = PUNTOS.filter(function(p){ return quitarAcentos(p.dir).indexOf(q) !== -1; }).slice(0, 12);
              if (!matches.length) { box.innerHTML = '<div style="padding:8px 12px;color:var(--ptl-gray-400);font-size:13px">Sin resultados</div>'; box.style.display='block'; return; }
              box.innerHTML = matches.map(function(p,i){
                return '<div class="mapa-res-item" data-i="'+PUNTOS.indexOf(p)+'" style="padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--ptl-gray-100)">'
                  + '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+p.color+';margin-right:6px"></span>'
                  + p.dir + '</div>';
              }).join('');
              box.style.display = 'block';
              box.querySelectorAll('.mapa-res-item').forEach(function(el){
                el.addEventListener('mouseenter', function(){ el.style.background='var(--ptl-general-2)'; });
                el.addEventListener('mouseleave', function(){ el.style.background='#fff'; });
                el.addEventListener('click', function(){ irAPunto(PUNTOS[parseInt(el.dataset.i)]); });
              });
            });
            // Enter: ir al primer resultado
            inp.addEventListener('keydown', function(ev){
              if (ev.key === 'Enter') {
                var q = quitarAcentos(inp.value.trim());
                var m = PUNTOS.filter(function(p){ return quitarAcentos(p.dir).indexOf(q) !== -1; });
                if (m.length) irAPunto(m[0]);
              }
            });
            // Cerrar la lista al hacer clic fuera
            document.addEventListener('click', function(ev){
              if (ev.target !== inp && !box.contains(ev.target)) box.style.display='none';
            });

            // ---- FASE 2: GEOCODIFICAR LAS QUE FALTAN ----
            // El servidor (Render) no puede salir a internet, así que geocodifica
            // el NAVEGADOR contra Nominatim (OpenStreetMap), 1 petición/segundo.
            // Cada resultado se pinta como chincheta AMARILLA con BORDE NEGRO en el
            // grupo "provisional" (filtrable). El usuario la confirma ARRASTRÁNDOLA:
            // al soltar se guarda igual que cualquier otra (mismo dragend/endpoint).
            // Nominatim acierta la calle pero falla el portal y a veces el pueblo,
            // por eso NUNCA se auto-guarda: solo se ubica y el usuario confirma.
            var btnUbicar = document.getElementById('mapa-ubicar');
            if (btnUbicar) {
              // Crea una chincheta provisional (amarilla, borde negro) ya arrastrable
              // y con el mismo guardado que las normales. Al confirmarla (dragend OK)
              // deja de ser provisional: borde blanco + parpadeo cian (se recolorea a
              // su fase real al recargar; aquí basta con marcarla como confirmada).
              function pinProvisional(item, lat, lng){
                var marker = L.marker([lat, lng], { icon: iconoColor('var(--ptl-warning)', '#000'), draggable: true });
                marker.bindTooltip('⚠ ' + (item.dir || '') + ' (sin confirmar)', { direction:'top', offset:[0,-6] });
                marker.bindPopup('<div style="font-size:13px;line-height:1.5">'
                  + '<strong>' + (item.dir || '') + '</strong><br/>'
                  + '<span style="color:var(--ptl-warning-dark)">⚠ Ubicación aproximada sin confirmar.</span><br/>'
                  + '<span class="ptl-c-gray500">Arrástrala a su sitio para guardarla.</span></div>');
                marker._posOrig = [lat, lng];
                marker._confirmada = false;
                marker.on('dragend', function(){
                  var ll = marker.getLatLng();
                  var ok = confirm('¿Guardar ubicación de "' + (item.dir||'') + '"?\\n\\n'
                    + 'Coordenada:\\n' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6));
                  if (!ok) { marker.setLatLng(marker._posOrig); return; }
                  var body = 'id=' + encodeURIComponent(item.id)
                    + '&lat=' + encodeURIComponent(ll.lat) + '&lng=' + encodeURIComponent(ll.lng);
                  fetch(GUARDAR_URL, { method:'POST',
                    headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: body })
                    .then(function(r){ return r.json(); })
                    .then(function(data){
                      if (data && data.ok) {
                        marker._posOrig = [ll.lat, ll.lng];
                        if (!marker._confirmada) {
                          marker._confirmada = true;
                          marker.setIcon(iconoColor('var(--ptl-general-1)'));  // confirmada: borde blanco
                          marker.setTooltipContent(item.dir || '');
                          var s = document.getElementById('mapa-sincoord');
                          if (s) s.textContent = Math.max(0, (parseInt(s.textContent,10)||0) - 1);
                        } else {
                          marker.setIcon(iconoColor('var(--ptl-general-1)'));
                        }
                      } else {
                        alert('No se pudo guardar: ' + (data && data.error ? data.error : 'error'));
                        marker.setLatLng(marker._posOrig);
                      }
                    })
                    .catch(function(e){ alert('Error de red al guardar: ' + e.message); marker.setLatLng(marker._posOrig); });
                });
                if (!markersPorGrupo['provisional']) markersPorGrupo['provisional'] = [];
                markersPorGrupo['provisional'].push(marker);
                marker.addTo(map);
                return marker;
              }
              btnUbicar.addEventListener('click', function(){
                if (!PENDIENTES.length) return;
                if (!confirm('Voy a ubicar automáticamente ' + PENDIENTES.length + ' direccion(es) sin coordenada.\\n\\n'
                  + 'Tardaré ~1 segundo por cada una (servicio gratuito). Saldrán en AMARILLO con borde negro;\\n'
                  + 'luego arrástralas a su sitio exacto para guardarlas. ¿Empezar?')) return;
                btnUbicar.disabled = true;
                var i = 0, okN = 0, falloN = 0, primera = null;
                function siguiente(){
                  if (i >= PENDIENTES.length){
                    btnUbicar.textContent = '📍 Ubicadas: ' + okN + ' (revisa y arrastra)';
                    btnUbicar.style.background = 'var(--ptl-success-light)'; btnUbicar.style.borderColor = 'var(--ptl-success)'; btnUbicar.style.color = 'var(--ptl-success-dark)';
                    if (primera) map.setView(primera, 15, { animate:true });
                    if (falloN) alert('Listo. ' + okN + ' ubicadas. ' + falloN + ' no se encontraron (las ubicas a mano cuando quieras).');
                    return;
                  }
                  var item = PENDIENTES[i];
                  btnUbicar.textContent = '📍 Ubicando ' + (i+1) + '/' + PENDIENTES.length + '…';
                  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q='
                    + encodeURIComponent(item.query);
                  fetch(url, { headers: { 'Accept':'application/json' } })
                    .then(function(r){ return r.json(); })
                    .then(function(arr){
                      if (arr && arr.length){
                        var lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
                        if (!isNaN(lat) && !isNaN(lng)){
                          var mk = pinProvisional(item, lat, lng);
                          if (!primera) primera = [lat, lng];
                          okN++;
                        } else { falloN++; }
                      } else { falloN++; }
                    })
                    .catch(function(){ falloN++; })
                    .finally(function(){ i++; setTimeout(siguiente, 1100); });  // 1.1s: respeta el límite de Nominatim
                }
                siguiente();
              });
            }
            // ---- UBICAR A MANO: tocar el sitio en el mapa para colocar una que falta ----
            function ubicarManual(item, idx){
              if (!item || !item.id) return;
              var cont = map.getContainer();
              cont.style.cursor = 'crosshair';
              var aviso = document.getElementById('mapa-manual-aviso');
              if (aviso){ aviso.innerHTML = '👆 Toca en el mapa el sitio de <strong>' + (item.dir || '') + '</strong> (o pulsa Esc para cancelar)'; aviso.style.display = 'block'; }
              function limpiar(){ cont.style.cursor=''; if (aviso) aviso.style.display='none'; map.off('click', alColocar); document.removeEventListener('keydown', escH); }
              function escH(ev){ if (ev.key === 'Escape') limpiar(); }
              function guardar(lat, lng, onOK){
                var body = 'id=' + encodeURIComponent(item.id) + '&lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng);
                fetch(GUARDAR_URL, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: body })
                  .then(function(r){ return r.json(); })
                  .then(function(data){ if (data && data.ok){ onOK(); } else { alert('No se pudo guardar: ' + (data && data.error ? data.error : 'error')); } })
                  .catch(function(e){ alert('Error de red al guardar: ' + e.message); });
              }
              function alColocar(e){
                limpiar();
                var lat = e.latlng.lat, lng = e.latlng.lng;
                var marker = L.marker([lat, lng], { icon: iconoColor('var(--ptl-warning)', '#000'), draggable: true });
                marker.bindTooltip('⚠ ' + (item.dir || '') + ' (sin confirmar)', { direction:'top', offset:[0,-6] });
                marker._posOrig = [lat, lng]; marker._conf = false;
                function marcarOK(la, ln){
                  marker._posOrig = [la, ln];
                  if (!marker._conf){
                    marker._conf = true;
                    marker.setIcon(iconoColor('var(--ptl-general-1)'));
                    marker.setTooltipContent(item.dir || '');
                    var sc = document.getElementById('mapa-sincoord'); if (sc) sc.textContent = Math.max(0, (parseInt(sc.textContent,10)||0) - 1);
                    var fila = document.getElementById('falta-row-' + idx);
                    if (fila){ fila.style.opacity='.45'; var t=fila.querySelector('.falta-dir'); if (t) t.style.textDecoration='line-through'; var bb=fila.querySelector('button'); if (bb){ bb.textContent='✓ Ubicada'; bb.disabled=true; bb.style.cursor='default'; } }
                  } else { marker.setIcon(iconoColor('var(--ptl-general-1)')); }
                }
                marker.on('dragend', function(){
                  var ll = marker.getLatLng();
                  if (!confirm('¿Guardar ubicación de "' + (item.dir||'') + '" aquí?  ' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6))){ marker.setLatLng(marker._posOrig); return; }
                  guardar(ll.lat, ll.lng, function(){ marcarOK(ll.lat, ll.lng); });
                });
                if (!markersPorGrupo['provisional']) markersPorGrupo['provisional'] = [];
                markersPorGrupo['provisional'].push(marker);
                marker.addTo(map);
                map.setView([lat, lng], 17, { animate:true });
                if (confirm('¿Guardar "' + (item.dir||'') + '" en este punto?  ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '   (Luego puedes arrastrarla para afinar.)')){
                  guardar(lat, lng, function(){ marcarOK(lat, lng); });
                }
              }
              map.on('click', alColocar);
              document.addEventListener('keydown', escH);
            }
            document.querySelectorAll('.mapa-amano').forEach(function(b){
              b.addEventListener('click', function(ev){
                ev.preventDefault();
                var det = document.getElementById('mapa-faltan-panel'); if (det) det.open = false;
                ubicarManual(FALTAN[parseInt(b.dataset.i,10)], parseInt(b.dataset.i,10));
              });
            });
          })();
        </script>
      `;
      sendHtml(res, pageHtml("Mapa",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Mapa", url: "#" }],
        content, token));
    } catch (e) {
      console.error("[presupuestos] GET /mapa:", e.message);
      sendError(res, "Error generando el mapa: " + e.message);
    }
  });

  // POST /presupuestos/mapa/guardar-coord — guarda la coordenada de un expediente
  // (se llama al soltar una chincheta arrastrada, tras confirmar). Body: { id, lat, lng }
  // Escribe "lat, lng" en la columna `earth` con la escritura segura (relee y verifica).
  app.post("/presupuestos/mapa/guardar-coord", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "Coordenadas no válidas" });
      // Sanidad geográfica: descartar 0,0 y fuera de rango terrestre
      if (lat === 0 && lng === 0) return res.status(400).json({ error: "Coordenada 0,0 no válida" });
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return res.status(400).json({ error: "Coordenada fuera de rango" });
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const valor = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      await actualizarCampoComunidad(comu._rowIndex, "earth", valor);
      res.json({ ok: true, earth: valor });
    } catch (e) {
      console.error("[presupuestos] /mapa/guardar-coord:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/plantillas-doc — pantalla de edición de plantillas de documento
  // GET /presupuestos/plantillas-bot — pantalla de edicion de textos del bot WhatsApp
  // GET /presupuestos/plantillas-bot-flujo — misma data, vista por flujo (5 caminos)
  app.get("/presupuestos/plantillas-bot-flujo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const plantillas = await leerPlantillasBot();
      await Promise.all(
        plantillas.filter(p => String(p.tipo).trim().toLowerCase() === "twilio")
          .map(async (p) => { p.textoTwilio = await obtenerTextoTwilio(p.twilio_sid); })
      );
      sendHtml(res, pageHtml("Flujo bot",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas bot (flujo)", url: "#" }],
        vistaPlantillasBotFlujo(plantillas, token),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas-bot-flujo:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/guardar — guarda texto + activo en bot_plantillas
  app.post("/presupuestos/plantillas-bot/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const clave = String(req.body.clave || "").trim();
      if (!clave) return sendError(res, "Clave requerida");
      const tipo = String(req.body.tipo || "").trim().toLowerCase();
      const texto = String(req.body.texto || "");
      if (texto.length > 5000) return sendError(res, "El texto no puede superar los 5000 caracteres");
      const twilio_sid = String(req.body.twilio_sid || "").trim();
      if (tipo === "twilio" && twilio_sid && !/^HX[0-9a-fA-F]{32}$/.test(twilio_sid)) {
        return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      }
      const activo = !!req.body.activo; // checkbox: presente => activa
      await guardarPlantillaBot({ clave, tipo, texto, twilio_sid, activo });
      const _destino = String(req.body.vista || "").trim() === "flujo" ? "/presupuestos/plantillas-bot-flujo" : "/presupuestos/plantillas-bot-flujo";
      res.redirect(urlT(token, _destino, { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/exigencia — fija el nivel de exigencia de fotos
  app.post("/presupuestos/plantillas-bot/exigencia", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const NIV = ["muy_tolerante", "tolerante", "normal", "estricto", "muy_estricto"];
      let nivel = String(req.body.nivel || "").trim().toLowerCase();
      if (!NIV.includes(nivel)) nivel = "normal";
      await guardarAjusteBot("exigencia_fotos", nivel);
      const _dx = String(req.body.vista || "").trim() === "flujo" ? "/presupuestos/plantillas-bot-flujo" : "/presupuestos/plantillas-bot-flujo";
      res.redirect(urlT(token, _dx, { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/exigencia:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/avisos-tiempos - guarda tiempos + on/off de los avisos por plazo (v18.121)
  app.post("/presupuestos/plantillas-bot/avisos-tiempos", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const MAP = { t_plazo_1: ["msg_plazo_1", 10], t_plazo_urgente: ["msg_plazo_urgente", 18], t_plazo_fuera: ["msg_plazo_fuera", 20] };
      const clave = String(req.body.clave || "").trim();
      if (MAP[clave]) {
        const [msgClave, def] = MAP[clave];
        let v = parseFloat(String(req.body.val || "").replace(",", ".").trim());
        if (isNaN(v) || v < 0) v = def;
        const on = req.body.on ? true : false;
        await guardarAjusteBot(clave, v, on);
        const msg = String(req.body.msg || "").replace(/\r\n/g, "\n").trim();
        if (msg !== "") await guardarAjusteBot(msgClave, msg);
      }
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/avisos-tiempos:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/sleep - guarda los DOS plazos del Sleep (t_inactividad_1/2) + SID Twilio (v18.146)
  app.post("/presupuestos/plantillas-bot/sleep", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_inactividad_1", parseDia(req.body.val1, 1), !!req.body.on1);
      await guardarAjusteBot("t_inactividad_2", parseDia(req.body.val3, 3), !!req.body.on3);
      const sid = String(req.body.twilio_sid || "").trim();
      if (sid && !/^HX[0-9a-fA-F]{32}$/.test(sid)) return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      if (sid) await guardarPlantillaBot({ clave: "recordatorio", tipo: "twilio", twilio_sid: sid, activo: true });
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/sleep:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/presentacion - guarda los DOS plazos del reenvio de presentacion (t_presentacion_1/2) + SID Twilio (v18.161)
  app.post("/presupuestos/plantillas-bot/presentacion", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_presentacion_1", parseDia(req.body.val1, 2), !!req.body.on1);
      await guardarAjusteBot("t_presentacion_2", parseDia(req.body.val3, 4), !!req.body.on3);
      const sid = String(req.body.twilio_sid || "").trim();
      if (sid && !/^HX[0-9a-fA-F]{32}$/.test(sid)) return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      if (sid) await guardarPlantillaBot({ clave: "presentacion", tipo: "twilio", twilio_sid: sid, activo: true });
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/presentacion:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/hoy-bot-llamado - marca "Llamado" de un piso (caja Sin responder) en bot_expedientes col AA, por telefono (v18.163)
  app.post("/presupuestos/hoy-bot-llamado", async (req, res) => {
    if (!checkToken(req, res)) return;
    const _err = (msg) => res.status(400).type("text/plain; charset=utf-8").send(String(msg || "error"));
    try {
      const tel = String(req.body.tel || "").trim();
      const valor = String(req.body.valor || "").trim();
      const campo = String(req.body.campo || "llamado").trim();
      if (!tel) return _err("tel requerido");
      // El bot solo usa A:Z; los flags de la caja Avisos se guardan en AA (llamado) y AB (revisado).
      const _col = campo === "revisado" ? "AB" : (campo === "revisado_faltan" ? "AD" : (campo === "revisado_ayuda" ? "AE" : (campo === "llamado2" ? "AF" : "AA")));
      const _need = campo === "revisado" ? 28 : (campo === "revisado_faltan" ? 30 : (campo === "revisado_ayuda" ? 31 : (campo === "llamado2" ? 32 : 27)));
      const sheets = getSheetsClient();
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))" });
        const sh = (meta.data.sheets || []).find(s => s.properties && s.properties.title === "bot_expedientes");
        const cc = (sh && sh.properties.gridProperties && sh.properties.gridProperties.columnCount) || 0;
        if (sh && cc > 0 && cc < _need) {
          await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ appendDimension: { sheetId: sh.properties.sheetId, dimension: "COLUMNS", length: _need - cc } }] } });
        }
      } catch (e2) { console.error("[presupuestos] hoy-bot-llamado expandir col:", e2.message); }
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:A" });
      const rows = r.data.values || [];
      const norm = (s) => String(s || "").replace(/[^0-9]/g, "");
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) { if (rows[i] && norm(rows[i][0]) === norm(tel)) { rowIndex = i + 1; break; } }
      if (rowIndex < 0) return _err("expediente no encontrado");
      const _valW = (campo === "llamado") ? (valor === "1" ? new Date().toISOString().slice(0, 10) : "") : valor; // v18.98 M1 guarda fecha
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: "bot_expedientes!" + _col + rowIndex, valueInputOption: "RAW", requestBody: { values: [[_valW]] } });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] POST /hoy-bot-llamado:", e.message);
      _err("Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/plazo - guarda los 3 plazos (t_plazo_1/urgente/fuera) + el texto unico (msg_plazo_1) (v18.150)
  app.post("/presupuestos/plantillas-bot/plazo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_plazo_1", parseDia(req.body.val1, 10), !!req.body.on1);
      await guardarAjusteBot("t_plazo_urgente", parseDia(req.body.valU, 18), !!req.body.onU);
      await guardarAjusteBot("t_plazo_fuera", parseDia(req.body.valF, 20), !!req.body.onF);
      const msg = String(req.body.texto || "").replace(/\r\n/g, "\n").trim();
      if (msg !== "") await guardarAjusteBot("msg_plazo_1", msg);
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/plazo:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/wa-manual - guarda texto + día de los avisos manuales M1/M2 (v18.99)
  app.post("/presupuestos/plantillas-bot/wa-manual", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const which = ["m1", "m2", "m3"].includes(String(req.body.which || "").trim()) ? String(req.body.which).trim() : "m1";
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_wa_" + which, parseDia(req.body.dias, which === "m2" ? 20 : 5), true);
      const msg = String(req.body.texto || "").replace(/\r\n/g, "\n").trim();
      await guardarAjusteBot("msg_wa_" + which, msg);
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/wa-manual:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  app.get("/presupuestos/plantillas-doc", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const plantillas = await leerPlantillasDoc();
      sendHtml(res, pageHtml("Plantillas doc",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas documentos", url: "#" }],
        vistaPlantillasDoc(plantillas, token),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas-doc:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-doc/guardar — guarda una fila en doc_plantillas
  app.post("/presupuestos/plantillas-doc/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const clave = String(req.body.clave || "").trim();
      if (!clave) return sendError(res, "Clave requerida");
      const titulo = String(req.body.titulo || "").trim();
      const cuerpo = String(req.body.cuerpo || "").trim();
      // Validaciones básicas (mismo espíritu que mail)
      if (cuerpo.length > 5000) {
        return sendError(res, "El cuerpo no puede superar los 5000 caracteres");
      }
      if (titulo.length > 200) {
        return sendError(res, "El título no puede superar los 200 caracteres");
      }
      await guardarPlantillaDoc({ clave, titulo, cuerpo });
      res.redirect(urlT(token, "/presupuestos/plantillas-doc", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-doc/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // =================================================================
  // IMPRIMIR DOCUMENTOS (Sprint A — Bloque 2, v17.83)
  // 3 endpoints que alimentan el flujo del modal:
  //  1) /docs/menu     -> lista de documentos disponibles + pisos del expediente
  //  2) /docs/huecos   -> para los documentos elegidos (y piso, si aplica), los
  //                       campos a rellenar con su valor precargado
  //  3) /docs/generar  -> genera el PDF (una página por documento) y lo descarga
  // =================================================================

  // 1) GET /presupuestos/docs/menu?id=<ccpp_id>
  app.get("/presupuestos/docs/menu", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.query.id || "").trim();
      if (!ccppId) return res.status(400).json({ error: "Falta id" });
      const plantillas = await leerPlantillasDoc();
      // documentos = todas las plantillas que NO son encabezado/pie
      const documentos = plantillas
        .filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL")
        .sort((a, b) => _ordenDoc(a.clave) - _ordenDoc(b.clave))
        .map(p => ({
          clave: p.clave,
          titulo: p.titulo || p.clave,
          tipo: DOCS_GENERALES.includes(p.clave) ? "general"
              : DOCS_PARTICULARES.includes(p.clave) ? "particular"
              : (DOC_HUECOS[p.clave] ? DOC_HUECOS[p.clave].tipo : "particular"),
        }));
      const { comu, pisos } = await _pisosParaDocumentos(ccppId);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      res.json({
        ccpp_id: ccppId,
        comunidad: (comu.tipo_via ? comu.tipo_via + " " : "") + (comu.direccion || ""),
        documentos,
        pisos: pisos.map(p => ({ vivienda: p.vivienda, propietario: p.nota_simple, usufructuario: p.nombre })),
      });
    } catch (e) {
      console.error("[presupuestos] GET /docs/menu:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 2) POST /presupuestos/docs/huecos  body: { id, claves:[], vivienda }
  // Devuelve, por documento, la lista de huecos con su valor precargado.
  app.post("/presupuestos/docs/huecos", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.body.id || "").trim();
      let claves = [];
      try { claves = JSON.parse(req.body.claves || "[]"); } catch (_) { claves = []; }
      if (!Array.isArray(claves)) claves = [];
      const vivienda = String(req.body.vivienda || "").trim();
      if (!ccppId || claves.length === 0) return res.status(400).json({ error: "Faltan datos" });
      const { comu, pisos } = await _pisosParaDocumentos(ccppId);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const piso = vivienda ? pisos.find(p => p.vivienda === vivienda) : null;
      // v17.90: el formulario muestra UNA SOLA LISTA de campos sin duplicar.
      // Se excluyen "comunidad" (la pone el programa) y "piso"/"pisos" (ya se
      // eligió el piso en el menú). Cada campo aparece una vez aunque lo usen
      // varios documentos; se recuerda qué claves de documento lo usan para
      // repartir el valor al generar.
      const OCULTOS = new Set(["comunidad", "piso", "pisos"]);
      const porCampo = new Map(); // clave_hueco -> { clave, label, valor, manual, docs:[] }
      claves.forEach(claveDoc => {
        const def = DOC_HUECOS[claveDoc];
        if (!def) return;
        def.huecos.forEach(h => {
          if (OCULTOS.has(h.clave)) return;
          if (!porCampo.has(h.clave)) {
            porCampo.set(h.clave, {
              clave: h.clave,
              label: h.label,
              valor: _valorHueco(h.origen, comu, piso),
              manual: h.origen === "manual",
              docs: [claveDoc],
            });
          } else {
            porCampo.get(h.clave).docs.push(claveDoc);
          }
        });
      });
      const campos = Array.from(porCampo.values());
      res.json({ campos });
    } catch (e) {
      console.error("[presupuestos] POST /docs/huecos:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 3) POST /presupuestos/docs/generar
  // body: { id, claves:[], vivienda, valores:{} }
  // valores = lista ÚNICA de campos rellenados por el usuario (sin piso ni
  // comunidad). El servidor reparte cada valor a los documentos que lo usan y
  // añade piso/pisos (del piso elegido) y comunidad (del expediente).
  app.post("/presupuestos/docs/generar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.body.id || "").trim();
      let claves = [];
      try { claves = JSON.parse(req.body.claves || "[]"); } catch (_) { claves = []; }
      if (!Array.isArray(claves)) claves = [];
      const vivienda = String(req.body.vivienda || "").trim();
      let valoresComunes = {};
      try { valoresComunes = JSON.parse(req.body.valores || "{}"); } catch (_) { valoresComunes = {}; }
      if (!valoresComunes || typeof valoresComunes !== "object") valoresComunes = {};
      if (claves.length === 0) return res.status(400).json({ error: "No hay documentos" });
      const plantillas = await leerPlantillasDoc();
      const encab = plantillas.find(p => p.clave === "_ENCABEZADO_GLOBAL");
      const pie   = plantillas.find(p => p.clave === "_PIE_GLOBAL");
      const porClave = {};
      plantillas.forEach(p => { porClave[p.clave] = p; });
      // Datos que NO vienen del formulario, los calcula el servidor:
      const comu = await buscarComunidadPorId(ccppId);
      const comunidadTxt = comu
        ? ((comu.tipo_via ? String(comu.tipo_via).trim() + " " : "") + String(comu.direccion || "").trim()).trim()
        : "";
      const { pisos } = await _pisosParaDocumentos(ccppId);
      const piso = vivienda ? pisos.find(p => p.vivienda === vivienda) : null;
      const pisoTxt = piso ? String(piso.vivienda || "") : "";
      // Para cada documento, reconstruir SUS valores: los comunes del formulario
      // + piso/pisos/comunidad según lo que cada documento necesite.
      const docs = claves.map(claveDoc => {
        const pl = porClave[claveDoc];
        const def = DOC_HUECOS[claveDoc];
        if (!pl || !def) return null;
        const valores = {};
        def.huecos.forEach(h => {
          if (h.clave === "comunidad") valores.comunidad = comunidadTxt;
          else if (h.clave === "piso" || h.clave === "pisos") valores[h.clave] = pisoTxt;
          else valores[h.clave] = (valoresComunes[h.clave] !== undefined) ? valoresComunes[h.clave] : "";
        });
        return { clave: claveDoc, cuerpo: pl.cuerpo, valores };
      }).filter(d => d && d.cuerpo);
      if (docs.length === 0) return res.status(400).json({ error: "Documentos no encontrados en plantillas" });
      const pdf = await generarPdfDocumentos(docs, encab ? encab.cuerpo : "", pie ? pie.cuerpo : "");
      // Nombre de archivo a partir de la comunidad
      const base = (comu ? (comu.direccion || "documentos") : "documentos")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="documentos_${base || "ccpp"}.pdf"`);
      res.send(pdf);
    } catch (e) {
      console.error("[presupuestos] POST /docs/generar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // v17.26 — ENDPOINT DE SANEO ÚNICO DE LA PESTAÑA "comunidades"
  // =================================================================
  // GET /admin/sanear-comunidades?token=...&dryrun=1
  // Recorre las filas de "comunidades" y arregla 3 cosas:
  //   1) Numéricos guardados como string → Number nativo redondeado
  //      (W,X,Y,Z,AA con 2 dec; AE,AF con 1 dec).
  //   2) En columnas de fecha, los valores literales "---" se vacían.
  //   3) Cualquier celda en notas_pto (AH) que empiece por "=" (interpretada
  //      como fórmula por error de tecleo) se vacía.
  //
  // Idempotente: se puede ejecutar varias veces sin efecto adicional.
  // Con ?dryrun=1 informa qué tocaría sin escribir. Sin dryrun, aplica.
  // El saneo se hace EN BLOQUES de hasta 50 celdas por batchUpdate para no
  // saturar la cuota de Sheets API.
  // =================================================================
  app.get("/admin/sanear-comunidades", async (req, res) => {
    if (!checkToken(req, res)) return;
    const dryrun = String(req.query.dryrun || "") === "1";

    // Columnas (letras del Sheet) y su tipo de saneo.
    const COL_LETTER = {
      pto_total: "W", mano_obra_previsto: "X", mano_obra_real: "Y",
      material_previsto: "Z", material_real: "AA",
      tiempo_previsto: "AE", tiempo_real: "AF",
      notas_pto: "AH",
      fecha_contacto: "Q", fecha_visita: "R", fecha_envio_pto: "S",
      fecha_ultimo_seguimiento_pto: "T", fecha_aceptacion_pto: "V",
      fecha_proximo_mail_manual: "AK", fecha_ultimo_reenvio_pto: "AL",
      fecha_visita_emasesa: "AM", fecha_documentacion_completa: "AN",
      fecha_envio_contratos_pagos: "AZ", fecha_cycp_completa: "BA",
      fecha_limite_documentacion_vecinos: "BC",
      fecha_cobro: "BE",
      fecha_pte_cobro: "BH",
    };
    const COL_IMPORTE = ["pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real"];
    const COL_TIEMPO  = ["tiempo_previsto","tiempo_real"];
    const COL_FECHA   = ["fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
                         "fecha_aceptacion_pto","fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto",
                         "fecha_visita_emasesa","fecha_documentacion_completa","fecha_envio_contratos_pagos",
                         "fecha_cycp_completa","fecha_limite_documentacion_vecinos","fecha_cobro","fecha_pte_cobro"];

    function _saneaNumero(v, decimales) {
      if (v == null || v === "") return { tocar: false };
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      if (!isFinite(n)) return { tocar: false };
      const redondeado = Math.round(n * Math.pow(10, decimales)) / Math.pow(10, decimales);
      // Si el valor original ya era exactamente número y coincide con el redondeo, no tocar.
      if (typeof v === "number" && v === redondeado) return { tocar: false };
      return { tocar: true, valor: redondeado };
    }

    try {
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: RANGO_COMUNIDADES,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      const rows = r.data.values || [];
      // Mapa rapido nombre_columna → indice columnas en COLS
      const idx = {};
      for (let i = 0; i < COLS.length; i++) idx[COLS[i]] = i;

      const cambios = []; // { fila, col, letra, antes, despues, motivo }
      for (let i = 1; i < rows.length; i++) {
        const fila = i + 1; // 1-based
        const row = rows[i] || [];
        if (!row[0] && !row[1]) continue; // saltar vacías

        // 1) Importes (2 dec)
        for (const c of COL_IMPORTE) {
          const v = row[idx[c]];
          const s = _saneaNumero(v, 2);
          if (s.tocar) cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: s.valor, motivo: "num-2dec" });
        }
        // 2) Tiempos (1 dec)
        for (const c of COL_TIEMPO) {
          const v = row[idx[c]];
          const s = _saneaNumero(v, 1);
          if (s.tocar) cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: s.valor, motivo: "num-1dec" });
        }
        // 3) Fechas: solo limpiar "---"
        for (const c of COL_FECHA) {
          const v = row[idx[c]];
          if (typeof v === "string" && v.trim() === "---") {
            cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: "", motivo: "fecha-vacia" });
          }
        }
        // 4) notas_pto: limpiar cualquier celda que empiece por "="
        const vAH = row[idx["notas_pto"]];
        if (typeof vAH === "string" && vAH.startsWith("=")) {
          cambios.push({ fila, col: "notas_pto", letra: "AH", antes: vAH, despues: "", motivo: "formula-accidental" });
        }
      }

      // Resumen
      const resumen = { totalCambios: cambios.length, porMotivo: {}, porColumna: {} };
      for (const ch of cambios) {
        resumen.porMotivo[ch.motivo] = (resumen.porMotivo[ch.motivo] || 0) + 1;
        resumen.porColumna[ch.letra + " " + ch.col] = (resumen.porColumna[ch.letra + " " + ch.col] || 0) + 1;
      }

      if (dryrun) {
        // Devuelve resumen + los primeros 50 cambios como muestra
        return res.json({
          ok: true,
          dryrun: true,
          mensaje: "DRY-RUN: nada se ha escrito. Revisa los cambios propuestos y vuelve a llamar SIN &dryrun=1 para aplicar.",
          resumen,
          muestra: cambios.slice(0, 50),
        });
      }

      // APLICAR — batchUpdate en bloques de 50 celdas
      const CHUNK = 50;
      let aplicados = 0;
      for (let i = 0; i < cambios.length; i += CHUNK) {
        const bloque = cambios.slice(i, i + CHUNK);
        const data = bloque.map(ch => ({
          range: `comunidades!${ch.letra}${ch.fila}`,
          values: [[ch.despues]],
        }));
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: { valueInputOption: "RAW", data },
        });
        aplicados += bloque.length;
      }

      return res.json({
        ok: true,
        dryrun: false,
        mensaje: `Saneo completado. ${aplicados} celdas escritas.`,
        resumen,
      });
    } catch (e) {
      console.error("[presupuestos] /admin/sanear-comunidades:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // CABECERA COMÚN (buscador + A-Z + Plantillas mail + Ejecutar cron
  // + filtros rápidos + filtros fase). Idéntica a la del HOY.
  // Usada en: HOY (en el propio handler), /presupuestos/expediente
  // y /documentacion/expediente.
  //
  // Devuelve un string HTML. Necesita `token` y la lista completa de
  // comunidades (`comusListado`) para calcular los contadores.
  // El buscador, al teclear, redirige a /presupuestos?q=...
  // ============================================================
  // v17.64 — Cabecera UNIFICADA. Antes había 3 cabeceras inline casi idénticas
  // (vistaListado, /presupuestos/hoy, ficha vía renderCabeceraComun). Ahora todas
  // las pantallas pasan por esta función.
  //
  // opts (todos opcionales):
  //   - filtroActivo: clave de la pestaña marcada como "on" (ej. "ACTIVOS",
  //     "TRAMITE", "05_DOCUMENTACION", "ZZ_RECHAZADO"). Si no se pasa, ninguna
  //     pestaña va resaltada (caso típico: estás en la ficha o en HOY).
  //   - busqueda: texto a precargar en el input. Por defecto "".
  //   - orden: estado actual del orden ("az", "za", "urg"). Influye en el
  //     botón de orden (próximo estado al pulsar) y se propaga en los links
  //     de pestañas para no perderlo al cambiar de filtro.
  //   - mostrarOrden: bool. true → muestra el botón de orden con el próximo
  //     estado. false → muestra solo "↑ A-Z" como link al listado. Por
  //     defecto false (que era el comportamiento de la cabecera común antes).
  //   - cuadra: bool. Si false → la pestaña Activos lleva borde rojo + ⚠.
  //     Por defecto true.
  function renderCabeceraComun(token, comusListado, opts) {
    const _opts = opts || {};
    const filtroActivo = _opts.filtroActivo || "";
    const busqueda = _opts.busqueda || "";
    const orden = _opts.orden || "";
    const mostrarOrden = !!_opts.mostrarOrden;
    const cuadra = _opts.cuadra !== false; // por defecto true
    // v18.03: si se pasa mapaId (solo desde la ficha del expediente), el botón
    // Mapa lleva ?focus=<ccpp_id> para que el mapa abra centrado en esa chincheta.
    const mapaId = _opts.mapaId || "";
    const countsHoy = { todos: 0, activos: 0, en_tramite: 0 };
    const TODAS_FASES = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO",
      "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP",
      "09_TRAMITADA","ZZ_RECHAZADO","ZZ_DESCARTADO"];
    TODAS_FASES.forEach(f => countsHoy[f] = 0);
    const FASES_ACTIVAS = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO",
      "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const FASES_EN_TRAMITE = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    (comusListado || []).forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      countsHoy.todos++;
      if (countsHoy[f] !== undefined) countsHoy[f]++;
      const ochoFin = (f === "08_CYCP" && !!c.fecha_cycp_completa);
      if (FASES_ACTIVAS.includes(f) && !ochoFin) countsHoy.activos++;
      if (FASES_EN_TRAMITE.includes(f) && !ochoFin) countsHoy.en_tramite++;
    });
    // v17.64 — los links de pestaña conservan busqueda/orden para no perderlos
    // al cambiar de filtro desde el listado.
    const _filtroBtn = (faseId, label, extra = "") => {
      const activo = filtroActivo === faseId ? "on" : "";
      const params = {};
      if (faseId) params.fase = faseId;
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      let n;
      if (faseId === "ACTIVOS") n = countsHoy.activos;
      else if (faseId === "TRAMITE") n = countsHoy.en_tramite;
      else if (faseId === "TODOS") n = countsHoy.todos;
      else n = faseId ? countsHoy[faseId] : countsHoy.todos;
      return `<a href="${url}" class="ptl-filtro ${activo} ${extra}">${label} <span style="opacity:.7;margin-left:3px">${n}</span></a>`;
    };
    // v17.64 — botón Activos especial: aviso ⚠ si los contadores no cuadran
    // (heredado de vistaListado: detecta fases mal escritas en el Sheet).
    const _btnActivos = (() => {
      const activo = filtroActivo === "ACTIVOS" ? "on" : "";
      const params = { fase: "ACTIVOS" };
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      const aviso = cuadra ? "" : ` style="border-color:var(--ptl-danger);color:var(--ptl-danger)" title="No cuadra"`;
      return `<a href="${url}" class="ptl-filtro ptl-filtro-nuevo ${activo}"${aviso}>Activos <span style="opacity:.7;margin-left:3px">${countsHoy.activos}${cuadra ? '' : ' ⚠'}</span></a>`;
    })();
    // v17.64 — botón de orden. Si mostrarOrden=true (caso /presupuestos), gira
    // entre az/za/urg conservando filtro y búsqueda. Si false, es solo un link
    // a /presupuestos con la flecha A-Z (caso HOY/ficha).
    const _btnOrden = (() => {
      if (!mostrarOrden) {
        return `<a href="${urlT(token, "/presupuestos")}" class="ptl-btn-orden">↑ A-Z</a>`;
      }
      const params = {};
      if (filtroActivo) params.fase = filtroActivo;
      if (busqueda) params.q = busqueda;
      let proximo, label;
      if (orden === "az" || !orden) { proximo = "za"; label = "↓ Z-A"; }
      else if (orden === "za") { proximo = "urg"; label = "⏱ Urgencia"; }
      else { proximo = "az"; label = "↑ A-Z"; }
      if (proximo && proximo !== "az") params.orden = proximo;
      const url = urlT(token, "/presupuestos", params);
      return `<a href="${url}" class="ptl-btn-orden">${label}</a>`;
    })();
    return `
      <div class="ptl-lista-header">
        <div style="display:flex;gap:8px;align-items:stretch">
          ${_opts.searchInHeader ? "" : `<div class="ptl-search-wrap" style="flex:1">
            <span class="ptl-search-icon">🔍</span>
            <input class="ptl-search-input" id="ptl-buscador-comun" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(busqueda)}" oninput="ptlFiltrarComun()"/>
          </div>`}
        </div>
        <script>
          (function(){
            var btn = document.getElementById('ptl-btn-cron-manual');
            if (!btn) return;
            var STATUS_URL = ${JSON.stringify(urlT(token, "/presupuestos/cron-status"))};
            var RUN_URL    = ${JSON.stringify(urlT(token, "/presupuestos/cron-run"))};
            var modo = 'verde';
            var erroresActuales = [];
            function pintarVerde() {
              modo = 'verde'; erroresActuales = [];
              btn.classList.remove('hdr-cron-err');
              btn.textContent = '⚡'; btn.title = 'Ejecutar cron';
            }
            function pintarRojo(nErrores, detalles) {
              modo = 'rojo'; erroresActuales = detalles || [];
              btn.classList.add('hdr-cron-err');
              btn.textContent = '⚠️'; btn.title = nErrores + ' error' + (nErrores === 1 ? '' : 'es') + ' · Ejecutar cron';
            }
            fetch(STATUS_URL).then(function(r){ return r.json(); }).then(function(data){
              if (!data || !data.ok) return;
              var r = data.ultimoResumen;
              if (r && r.errores > 0) pintarRojo(r.errores, data.ultimosErrores || r.detalleErrores || []);
              else pintarVerde();
            }).catch(function(){});
            btn.addEventListener('click', function(){
              if (modo === 'rojo') {
                var msg = '⚠️ Errores del último cron (' + erroresActuales.length + '):';
                if (erroresActuales.length) {
                  erroresActuales.forEach(function(e){
                    msg += '\\n• ' + (e.direccion || '?') + ' [' + (e.fase || '?') + ']: ' + (e.motivo || '?');
                  });
                } else { msg += '\\n(sin detalle disponible)'; }
                msg += '\\n\\nRevisa estas CCPPs y, cuando estén corregidas, vuelve a pulsar para ejecutar el cron.';
                alert(msg); pintarVerde(); return;
              }
              if (!confirm('¿Ejecutar el cron de envíos automáticos ahora?\\n\\nRevisará todas las CCPPs y enviará los mails que correspondan a hoy.')) return;
              btn.textContent = '⏳ Ejecutando...'; btn.disabled = true;
              fetch(RUN_URL, { method: 'POST' })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok && data.resumen) {
                    var r = data.resumen;
                    var msg = '✓ Cron ejecutado.\\n\\nRevisadas: ' + r.revisadas + '\\nEnviadas: ' + r.enviadas + '\\nOmitidas por margen: ' + r.omitidas_margen + '\\nErrores: ' + r.errores;
                    alert(msg);
                    if (r.errores > 0) pintarRojo(r.errores, r.detalleErrores || []);
                    else pintarVerde();
                  } else {
                    alert('✗ Error ejecutando cron:\\n' + (data && data.error ? data.error : 'desconocido'));
                    pintarRojo(1, [{ direccion: '(global)', fase: '-', motivo: (data && data.error) || 'desconocido' }]);
                  }
                })
                .catch(function(e){ alert('✗ Error de red: ' + e.message); })
                .finally(function(){ btn.disabled = false; });
            });
          })();
          // v17.64 — Buscador unificado con debounce 400ms. Redirige al
          // listado con q=... (también si ya estás en el listado: la propia
          // recarga aplica el filtro).
          var ptlTcomun;
          function ptlFiltrarComun() {
            clearTimeout(ptlTcomun);
            ptlTcomun = setTimeout(function(){
              var q = document.getElementById('ptl-buscador-comun').value;
              var base = ${JSON.stringify(urlT(token, "/presupuestos"))};
              var url = new URL(base, window.location.origin);
              if (q && q.trim()) url.searchParams.set('q', q.trim());
              window.location.href = url.toString();
            }, 400);
          }
        </script>
        <div class="ptl-filtros ptl-filtros-rapidos">
          ${_btnActivos}
          ${_filtroBtn("TRAMITE", "En trámite", "ptl-filtro-en-tramite")}
          ${_filtroBtn("09_TRAMITADA", "Tramitados", "ptl-fase-tramitada")}
          ${_filtroBtn("ZZ_RECHAZADO", "ZZ-RECHAZADO", "ptl-fase-zz")}
          ${_filtroBtn("ZZ_DESCARTADO", "ZZ-DESCARTADO", "ptl-fase-zz")}
        </div>
        <div class="ptl-filtros ptl-filtros-fases">
          <a href="${urlT(token, "/presupuestos/nuevo")}" class="ptl-filtro ptl-filtro-nuevo">+ Nuevo</a>
          ${_filtroBtn("01_CONTACTO", "01-CONTACTO", "ptl-fase-activa")}
          ${_filtroBtn("02_VISITA", "02-VISITA", "ptl-fase-activa")}
          ${_filtroBtn("03_ENVIO_PTO", "03-ENVIO PTO", "ptl-fase-activa")}
          ${_filtroBtn("04_ACEPTACION_PTO", "04-ACEPTACION PTO", "ptl-fase-activa")}
          ${_filtroBtn("05_DOCUMENTACION", "05-DOCUMENTACION", "ptl-fase-activa")}
          ${_filtroBtn("06_VISITA_EMASESA", "06-VISITA EMASESA", "ptl-fase-activa")}
          ${_filtroBtn("07_PTE_CYCP", "07-PTE CYCP", "ptl-fase-activa")}
          ${_filtroBtn("08_CYCP", "08-CYCP", "ptl-fase-activa")}
        </div>
      </div>
    `;
  }

  console.log("[presupuestos] Módulo cargado. Rutas: /presupuestos, /presupuestos/nuevo, /presupuestos/expediente, /presupuestos/plantillas, /presupuestos/cron-status");

  // Exportar helpers internos para que documentacion.cjs reuse la vista de
  // ficha (ahora la ficha de un CCPP es la misma esté en presupuestos o en
  // documentación; cambia solo lo que se pinta encima/debajo).
  app.locals.presupuestos = {
    leerComunidades,
    buscarComunidadPorId,
    construirDatalists,
    vistaFicha,
    pageHtml,
    sendHtml,
    sendError,
    urlT,
    esc,
    normalizarFase,
    renderCabeceraComun,
    // Helpers para módulo documentación (plantilla de pisos)
    fmtTlf,
    actualizarComunidad,
    actualizarCampoComunidad,
    normalizarCodigoPiso,
    normalizarNombrePiso,
    normalizarTelefonoPiso,
    comparadorNaturalPiso,
    // Constantes que documentación necesita
    SHEET_ID,
    getSheetsClient,
    getImagenesExpediente,
    getImagenExpediente,
    // Expuestos para sandbox de tests (no usados por otros módulos en producción)
    PTO_FASES,
    fechaHito,
    lineaTiempoHtml,
    COLS,
    rowToObj,
    objToRow,
    // Conteo de docs "Faltan X de Y" — fuente ÚNICA compartida con documentacion.cjs
    // (antes la regla estaba duplicada; ver pendiente unificado v18.70).
    _resumenManual,
    _contarFaltan,
    _contarFaltanBot, // v18.90 conteo bot-aware (HOY = ficha)
    // Listas de estados del conteo (para inyectar al cliente de documentacion)
    _ESTADOS_IGNORA,
    _ESTADOS_HECHO,
  };

}; // end module.exports

// reinicio render 1778199437
