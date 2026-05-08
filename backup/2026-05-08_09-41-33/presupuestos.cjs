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
const { getThemeCss } = require("./estilo-visual.cjs");

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
  const RANGO_COMUNIDADES = "comunidades!A:BC"; // ... + mails_manuales (BB) + fecha_limite_documentacion_vecinos (BC)
  const RANGO_MAIL_PLANTILLAS = "mail_plantillas!A:J"; // A..I como antes + J = cuenta_envio
  const RANGO_MAIL_HISTORICO = "mail_historico!A:I";
  const RANGO_MAIL_CUENTAS   = "mail_cuentas!A:E";   // A id | B email | C password | D host | E puerto

  // Fases del proceso de presupuesto (módulo CCPP)
  // - codigo:        número visible (01, 02, ..., ZZ)
  // - nombre:        forma corta para filtros y línea de tiempo
  // - nombreLargo:   forma larga en MAYÚSCULAS para botones y cabeceras de ficha
  const PTO_FASES = {
    "01_CONTACTO":       { codigo: "01", nombre: "Contacto",    nombreLargo: "CONTACTO",         color: "azul",     siguiente: "02_VISITA",          accionLabel: "Contacto registrado",  plantilla: "primer_contacto", cadenciaDias: 30 },
    "02_VISITA":         { codigo: "02", nombre: "Visita",      nombreLargo: "VISITA",           color: "azul",     siguiente: "03_ENVIO_PTO",       accionLabel: "Programar visita",     plantilla: null },
    "03_ENVIO_PTO":      { codigo: "03", nombre: "Envío",       nombreLargo: "ENVIO PTO",        color: "azul",     siguiente: "04_ACEPTACION_PTO",  accionLabel: "Enviar presupuesto",   plantilla: "envio_pto" },
    "04_ACEPTACION_PTO": { codigo: "04", nombre: "Aceptación",  nombreLargo: "ACEPTACION PTO",   color: "amarillo", siguiente: "05_DOCUMENTACION",   accionLabel: "Aceptación",           plantilla: "seguimiento", cadenciaDias: 15, cadenciaInicialDias: 3 },
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
  function fmtFecha(f) {
    if (!f || f === "") return "—";
    const d = new Date(f.length > 10 ? f : f + "T00:00:00");
    if (isNaN(d)) return f;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }
  function fmtMoneda(n) {
    if (n == null || n === "") return "—";
    const num = parseFloat(String(n).replace(',', '.'));
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
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
  //   7. quitar guiones y barras
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
    r = r.replace(/[-/]/g, "");
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
  //  AP modo_documentacion     (MANUAL | BOT — defecto MANUAL, irreversible MANUAL→BOT)
  //  AQ-AY estados manuales CCPP (gestionados por documentacion.cjs)
  //  AZ fecha_envio_contratos_pagos
  //  BA fecha_cycp_completa
  //  BB mails_manuales (JSON, paralelo a mails_enviados)

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_aceptacion_pto",
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
    // AP — modo de gestión documental del CCPP
    "modo_documentacion",         // "MANUAL" (defecto) | "BOT" (irreversible MANUAL → BOT)
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
  ];

  function rowToObj(row) {
    const o = {};
    for (let i = 0; i < COLS.length; i++) o[COLS[i]] = row[i] || "";
    // Generar id virtual estable a partir de la dirección (si existe) o comunidad
    const clave = o.direccion || o.comunidad || "";
    o.ccpp_id = clave ? ccppId(clave) : "";
    // Compatibilidad con el código antiguo: alias 'tipo' = tipo_via, 'fase' = fase_presupuesto
    o.tipo = o.tipo_via || "";
    o.fase = normalizarFase(o.fase_presupuesto);
    o.importe = o.pto_total || "";
    o.notas = o.notas_pto || "";
    return o;
  }
  function objToRow(o) {
    return COLS.map(c => {
      const v = o[c];
      if (v == null) return "";
      return String(v);
    });
  }

  async function leerComunidades() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_COMUNIDADES,
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
  async function actualizarComunidad(rowIndex, datos) {
    const sheets = getSheetsClient();
    // Recalcular campos derivados antes de guardar
    const W  = parseFloat(String(datos.pto_total || "").replace(',','.'));
    const X  = parseFloat(String(datos.mano_obra_previsto || "").replace(',','.'));
    const Y  = parseFloat(String(datos.mano_obra_real || "").replace(',','.'));
    const Z  = parseFloat(String(datos.material_previsto || "").replace(',','.'));
    const AA = parseFloat(String(datos.material_real || "").replace(',','.'));
    const AE = parseFloat(String(datos.tiempo_previsto || "").replace(',','.'));
    const AF = parseFloat(String(datos.tiempo_real || "").replace(',','.'));
    if (!isNaN(W) && !isNaN(X) && !isNaN(Z))   datos.beneficio_previsto = (W - X - Z - 150).toFixed(2);
    if (!isNaN(W) && !isNaN(Y) && !isNaN(AA))  datos.beneficio_real     = (W - Y - AA).toFixed(2);
    if (datos.beneficio_real !== "" && datos.beneficio_previsto !== "" &&
        !isNaN(parseFloat(datos.beneficio_real)) && !isNaN(parseFloat(datos.beneficio_previsto))) {
      datos.beneficio_desvio = (parseFloat(datos.beneficio_real) - parseFloat(datos.beneficio_previsto)).toFixed(2);
    }
    if (!isNaN(AE) && AE !== 0 && !isNaN(AF))  datos.tiempo_desvio = (1 - AF/AE).toFixed(4);

    const row = objToRow(datos);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `comunidades!A${rowIndex}:BC${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
  async function crearComunidad(datos) {
    const sheets = getSheetsClient();
    if (!datos.fase_presupuesto) datos.fase_presupuesto = "01_CONTACTO";
    if (!datos.fecha_contacto) datos.fecha_contacto = new Date().toISOString().slice(0, 10);
    if (!datos.estado_comunidad) datos.estado_comunidad = "activa";
    const row = objToRow(datos);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGO_COMUNIDADES,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
  async function actualizarCampoComunidad(rowIndex, campo, valor) {
    if (!COLS.includes(campo)) throw new Error("Campo no permitido: " + campo);
    // Para campos calculados o que afectan a calculados, leer la fila completa,
    // actualizar el campo y reescribir la fila entera (para que se recalculen los derivados)
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `comunidades!A${rowIndex}:BC${rowIndex}`,
    });
    const row = (res.data.values && res.data.values[0]) || [];
    const obj = rowToObj(row);
    obj[campo] = valor;
    await actualizarComunidad(rowIndex, obj);
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

  // Envía un mail real vía SMTP usando la cuenta indicada.
  // - cuentaId: id de la fila en mail_cuentas (ej. "administracion").
  // - destinatario: email del destinatario principal ("To").
  // - cco: array o string ("a@b.com, c@d.com") — destinatarios en BCC.
  // - asunto, mensaje (texto plano).
  // - adjuntosUrls: array de URLs (no se descargan; se añaden como links al final del mensaje).
  // Lanza error si falla. Devuelve el messageId.
  async function enviarMailReal({ cuentaId, destinatario, cco, asunto, mensaje, adjuntosUrls }) {
    if (!destinatario) throw new Error("Falta destinatario");
    const cuenta = await buscarCuentaMail(cuentaId);
    if (!cuenta) throw new Error(`Cuenta de envío "${cuentaId}" no encontrada en mail_cuentas`);
    if (!cuenta.email || !cuenta.password || !cuenta.host) {
      throw new Error(`Cuenta "${cuentaId}" mal configurada (faltan email/password/host)`);
    }

    // Adjuntos como links al final del cuerpo (de momento sin descargar/adjuntar)
    let cuerpo = String(mensaje || "");
    const urls = Array.isArray(adjuntosUrls)
      ? adjuntosUrls.filter(u => u && String(u).trim())
      : String(adjuntosUrls || "").split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (urls.length) {
      cuerpo += "\n\n— Adjuntos —\n" + urls.join("\n");
    }

    // Pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D)
    try {
      const pie = await leerPlantillaMail("_PIE_GLOBAL");
      const textoPie = pie && pie.mensaje ? String(pie.mensaje).trim() : "";
      if (textoPie) cuerpo += "\n\n" + textoPie;
    } catch (e) { /* si falla, no se añade pie */ }

    // CCO: aceptar string o array. Acepta separadores ||, comas, ;, saltos de línea.
    let bcc = "";
    if (Array.isArray(cco)) bcc = cco.filter(Boolean).join(", ");
    else if (cco) bcc = String(cco).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");

    const transporter = nodemailer.createTransport({
      host: cuenta.host,
      port: cuenta.puerto,
      secure: cuenta.puerto === 465, // true para 465, false para otros (TLS STARTTLS)
      auth: { user: cuenta.email, pass: cuenta.password },
    });

    const info = await transporter.sendMail({
      from: cuenta.email,
      to: destinatario,
      bcc: bcc || undefined,
      subject: asunto || "",
      text: cuerpo,
    });
    return info.messageId;
  }

  // Envía un aviso interno a la cuenta administrativa cuando un CCPP llega al
  // tope de reenvíos automáticos en una fase con automatización. La idea es
  // que el bot avise para que se decida manualmente (aceptar / rechazar /
  // descartar) en vez de descartar el expediente automáticamente.
  //
  // Se envía DESDE la primera cuenta disponible en mail_cuentas (la cuenta
  // "administracion" típicamente) HACIA la misma cuenta. Si no hay cuentas
  // configuradas, simplemente loggea y vuelve sin error (no debe romper el
  // cron).
  async function enviarMailAvisoCompletado({ comu, fase, faseLargo, numEnvios, maxEnvios }) {
    try {
      const cuentas = await leerCuentasMail();
      if (!cuentas.length) {
        console.warn("[presupuestos][aviso] No hay cuentas en mail_cuentas, no se envía aviso");
        return;
      }
      const cuenta = cuentas[0]; // primera cuenta = "administracion"
      const direccion = `${comu.tipo_via || ""} ${comu.direccion || comu.comunidad || ""}`.trim();
      const asunto = `[Araujo Bot] Reenvíos completados — ${direccion} (fase ${faseLargo})`;
      const mensaje =
        `El expediente ${direccion} ha agotado los reenvíos automáticos.\n\n` +
        `· Fase actual: ${faseLargo}\n` +
        `· Reenvíos: ${numEnvios}/${maxEnvios}\n` +
        `· Administrador: ${comu.administrador || "—"}\n` +
        `· Email: ${comu.email_administrador || "—"}\n` +
        `· Teléfono: ${comu.telefono_administrador || "—"}\n\n` +
        `El bot ha dejado de enviar mails automáticos. Decide manualmente:\n` +
        `  - Aceptar el presupuesto si el cliente ha confirmado.\n` +
        `  - Rechazar si el cliente ha dicho que no.\n` +
        `  - Descartar si no responde / no se puede continuar.\n` +
        `  - Reenviar presupuesto revisado para reiniciar el ciclo.\n\n` +
        `Abre el expediente en el bot para gestionarlo.`;

      const transporter = nodemailer.createTransport({
        host: cuenta.host,
        port: cuenta.puerto,
        secure: cuenta.puerto === 465,
        auth: { user: cuenta.email, pass: cuenta.password },
      });
      await transporter.sendMail({
        from: cuenta.email,
        to: cuenta.email, // se manda a sí misma
        subject: asunto,
        text: mensaje,
      });
      // Registrar en histórico para tener traza
      await registrarMailEnHistorico({
        fecha: new Date().toISOString(),
        ccpp_id: comu.ccpp_id || comu._rowIndex,
        direccion,
        fase,
        destinatario: cuenta.email,
        asunto,
        mensaje,
        adjuntos: "",
        tipo: "aviso_admin_completado",
      }).catch(() => {});
    } catch (e) {
      console.error("[presupuestos][aviso] error enviando aviso:", e.message);
    }
  }

  async function leerPlantillaMail(fase) {
    const sheets = getSheetsClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_PLANTILLAS,
      });
      const rows = res.data.values || [];
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
    } catch (e) {
      // Pestaña no existe → usar defaults
      console.warn("[presupuestos] mail_plantillas no disponible, usando defaults:", e.message);
    }
    // Default
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
  }

  async function registrarMailEnHistorico(datos) {
    // datos: { fecha, ccpp_id, direccion, fase, destinatario, asunto, mensaje, adjuntos, tipo }
    const sheets = getSheetsClient();
    const fila = [
      datos.fecha || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      datos.destinatario || "",
      datos.asunto || "",
      datos.mensaje || "",
      datos.adjuntos || "",
      datos.tipo || "manual",
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

  function parsearMailJson(s) {
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
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
      // {{fecha_limite_doc_vecinos}} → fecha guardada en col BC.
      // Se rellena al enviar el mail de fase 05_ACEPTACION_PTO (hoy + 20 días).
      // En el Sheet está en formato YYYY-MM-DD; aquí la convertimos a DD/MM/AAAA.
      .replace(/\{\{fecha_limite_doc_vecinos\}\}/g, () => {
        const f = comu.fecha_limite_documentacion_vecinos || "";
        const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
      })
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
      if (faseActual === "ZZ_RECHAZADO") return "rechazado";
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
    // Etiquetas alternativas para modo compacto (listados): solo cambia la
    // de 05-Documentación porque es la más larga y rompe el layout.
    function nombreMostrar(p) {
      if (compacto && p.faseId === "05_DOCUMENTACION") return "05-Doc";
      return p.nombre;
    }
    return `<div class="ptl-timeline">
      ${Object.entries(grupos).map(([procName, pts]) => `
        <div class="ptl-grupo">
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
        </div>
      `).join('')}
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
  function pageHtml(titulo, breadcrumbs, content, token) {
    const bc = breadcrumbs && breadcrumbs.length > 1
      ? `<div class="ptl-breadcrumb">${breadcrumbs.map((b, i) => {
          if (i < breadcrumbs.length - 1)
            return `<a href="${esc(b.url)}">${esc(b.label)}</a><span class="ptl-sep">/</span>`;
          return `<span>${esc(b.label)}</span>`;
        }).join("")}</div>`
      : "";
    const homeUrl = urlT(token, "/presupuestos");
    return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(titulo)} · Araujo Presupuestos</title>
  <style>${getThemeCss()}${CSS}</style>
</head><body>
  <nav class="ptl-nav">
    <a href="${homeUrl}" class="ptl-nav-brand">
      <div class="ptl-logo">A</div>
      <div class="ptl-nav-text"><strong>Araujo Presupuestos</strong><span>CCPP · Individualización contadores</span></div>
    </a>
  </nav>
  <div class="ptl-page">
    ${bc}
    ${content}
  </div>
</body></html>`;
  }
  function sendHtml(res, html, status = 200) {
    res.status(status).set("Content-Type", "text/html; charset=utf-8").send(html);
  }
  function sendError(res, html, status = 500) {
    sendHtml(res, pageHtml("Error", [], `<div class="ptl-empty"><h3>${esc(html)}</h3></div>`), status);
  }

  const CSS = `
    /* ===== Específico de presupuestos (lo común está en estilo-visual.cjs) ===== */

    /* Botón único de fase 03: ocupa toda la altura de la barra (no se centra,
       se estira). El texto del botón sí se centra dentro. */
    .ptl-btn-enviar-avanzar{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;padding:3px 12px;gap:0;align-self:stretch;height:auto;white-space:normal;font-size:10.5px}
    .ptl-btn-enviar-avanzar .ln{display:block;font-size:10.5px;font-weight:600}
    /* Botón mail en 3 líneas: misma estética que ptl-btn-secondary pero altura ajustada a la columna */
    .ptl-btn-mail-3l{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;padding:2px 8px;gap:0;align-self:stretch;height:auto}
    .ptl-btn-mail-3l .ln{display:block;font-size:10.5px;font-weight:600}
    /* Mini-bloque "Fecha visita" (fase 02) y "Próximo mail" (fase 04): no son botones,
       tienen un input dentro */
    .ptl-mini-fecha{cursor:default;gap:2px;padding:3px 6px;min-width:120px}
    .ptl-mini-fecha:hover{background:white}
    .ptl-mini-fecha input{cursor:text}
  `;

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

    // Completado: reenvíos automáticos al tope
    if (mx > 0 && numAutomaticos >= mx) {
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
    } else if (!fechaUltimo && di > 0 && comu.fecha_ultimo_seguimiento_pto) {
      const fb = new Date(comu.fecha_ultimo_seguimiento_pto);
      if (!isNaN(fb.getTime())) {
        fb.setDate(fb.getDate() + di);
        fechaProx = fb.toISOString().slice(0, 10);
      }
    }
    const fechaProxFmt = fechaProx ? formatearFechaDDMMYYYY(fechaProx) : "pendiente";
    return {
      texto: `📧 ${xy} - próximo reenvío ${fechaProxFmt}`,
      estado: "en_curso",
      completado: false,
    };
  }

  // YYYY-MM-DD → DD/MM/AAAA (para mostrar)
  function formatearFechaDDMMYYYY(fechaIso) {
    if (!fechaIso) return "";
    const m = String(fechaIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(fechaIso);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  // Fases que tienen automatización de reenvíos (las que el cron procesa).
  // Se usa en el listado para sondear cuáles tienen "decidir pendiente" y en
  // la ficha para pintar el indicador de envíos automáticos. La fase 03 NO
  // está aquí: tiene plantilla, pero es un envío manual único (el presupuesto)
  // que avanza directamente a 04, no hay reenvíos automáticos en 03.
  const FASES_CON_REENVIOS = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION"];

  // Mapeo fase → clave de plantilla y de contadores. Por defecto coinciden,
  // pero fase 05_DOCUMENTACION usa la plantilla 05_ENVIO_DOC (los reenvíos
  // automáticos durante la espera de documentación de los vecinos).
  function plantillaDeFase(fase) {
    if (fase === "05_DOCUMENTACION") return "05_ENVIO_DOC";
    return fase;
  }

  // =================================================================
  // VISTA: LISTADO DE PRESUPUESTOS
  // =================================================================
  async function vistaListado(comunidades, query, token) {
    const filtroFase = query.fase || "";
    const busqueda = (query.q || "").toLowerCase().trim();
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
    ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP","ZZ_RECHAZADO","ZZ_DESCARTADO"].forEach(f => counts[f] = 0);
    // Activos = todo lo que sigue vivo en el negocio (presupuestos + documentación).
    //   Incluye 08_CYCP porque sigue siendo trabajo en curso (recepción de
    //   contratos firmados), PERO si la fase 08 está finalizada
    //   (fecha_cycp_completa rellena) ya no cuenta como activo.
    //   NO incluye ZZ_RECHAZADO ni ZZ_DESCARTADO (terminales de fracaso).
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
    // Por defecto (sin filtro explícito) mostramos solo activos.
    // Si quieres ver todo, usa filtroFase="TODOS"; si quieres ver ZZ pincha en su fase concreta.
    const filtroEfectivo = filtroFase || "ACTIVOS";
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
    if (busqueda) {
      lista = lista.filter(c => {
        const hay = `${c.direccion} ${c.comunidad} ${c.administrador || ''} ${c.presidente || ''} ${c.telefono_administrador || ''} ${c.telefono_presidente || ''}`.toLowerCase();
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

    const filtroBtn = (faseId, label, extra = "") => {
      const activo = filtroEfectivo === faseId ? "on" : "";
      const params = {};
      if (faseId) params.fase = faseId;
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      let n;
      if (faseId === "HOY") n = counts.hoy;
      else if (faseId === "ACTIVOS") n = counts.activos;
      else if (faseId === "TRAMITE") n = counts.en_tramite;
      else if (faseId === "TODOS") n = counts.todos;
      else n = faseId ? counts[faseId] : counts.todos;
      return `<a href="${url}" class="ptl-filtro ${activo} ${extra}">${label} <span style="opacity:.7;margin-left:3px">${n}</span></a>`;
    };

    const filas = lista.map(c => {
      // Badge "⚠ Decidir" cuando el CCPP está en una fase con reenvíos completados
      // (envíos automáticos llegados al tope max_envios). Sirve para saber de un
      // vistazo qué expedientes hay que aceptar/rechazar/descartar manualmente.
      let badgeDecidirHtml = '';
      const faseC = normalizarFase(c.fase_presupuesto);
      if (FASES_CON_REENVIOS.includes(faseC)) {
        const plt = plantillasReenvios[faseC];
        if (plt) {
          const info = calcularInfoEnvioAuto(c, faseC, plt);
          if (info.completado) {
            badgeDecidirHtml = `<span class="ptl-fila-badge ptl-fila-badge-decidir" title="Reenvíos completados — pendiente de decidir">⚠ Decidir</span>`;
          }
        }
      }
      return `
      <a href="${urlT(token, "/presupuestos/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info">
          <span class="ptl-fila-tipo">${esc(c.tipo_via || '')}</span>
          <span class="ptl-fila-dir">${esc(c.direccion || c.comunidad || '—')}</span>
          ${badgeDecidirHtml}
        </div>
        ${lineaTiempoHtml(c, true)}
        <span class="ptl-fila-importe">${fmtMoneda(c.pto_total)}</span>
      </a>
    `;
    }).join("");

    const sumaProcesos = counts["01_CONTACTO"]+counts["02_VISITA"]+counts["03_ENVIO_PTO"]+counts["04_ACEPTACION_PTO"]+counts["05_DOCUMENTACION"]+counts["06_VISITA_EMASESA"]+counts["07_PTE_CYCP"]+counts["08_CYCP"]+counts["ZZ_RECHAZADO"]+counts["ZZ_DESCARTADO"];
    const cuadra = sumaProcesos === counts.todos;

    return `
      <div class="ptl-lista-header">
        <div style="display:flex;gap:8px;align-items:stretch">
          <div class="ptl-search-wrap" style="flex:1">
            <span class="ptl-search-icon">🔍</span>
            <input class="ptl-search-input" id="ptl-buscador" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(busqueda)}" oninput="ptlFiltrar()"/>
          </div>
          ${(() => {
            const params = {};
            if (filtroFase) params.fase = filtroFase;
            if (busqueda) params.q = busqueda;
            let proximo, label;
            if (ordenEf === "az") { proximo = "za"; label = "↓ Z-A"; }
            else if (ordenEf === "za") { proximo = "urg"; label = "⏱ Urgencia"; }
            else { proximo = "az"; label = "↑ A-Z"; }
            if (proximo && proximo !== "az") params.orden = proximo;
            const url = urlT(token, "/presupuestos", params);
            return `<a href="${url}" class="ptl-btn-orden">${label}</a>`;
          })()}
          <a href="${urlT(token, "/presupuestos/plantillas")}" class="ptl-btn-orden" style="background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE">📧 Plantillas mail</a>
          <button type="button" id="ptl-btn-cron-manual" class="ptl-btn-orden" style="background:#FEF3C7;color:#92400E;border-color:#FDE68A;cursor:pointer" title="Forzar la ejecución del cron de envíos automáticos ahora mismo">⚡ Ejecutar cron</button>
        </div>
        <script>
          (function(){
            var btn = document.getElementById('ptl-btn-cron-manual');
            if (!btn) return;
            btn.addEventListener('click', function(){
              if (!confirm('¿Ejecutar el cron de envíos automáticos ahora?\\n\\nRevisará todas las CCPPs y enviará los mails que correspondan a hoy.')) return;
              var orig = btn.textContent;
              btn.textContent = '⏳ Ejecutando...';
              btn.disabled = true;
              fetch(${JSON.stringify(urlT(token, "/presupuestos/cron-run"))}, { method: 'POST' })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok && data.resumen) {
                    var r = data.resumen;
                    alert('✓ Cron ejecutado.\\n\\n' +
                          'Revisadas: ' + r.revisadas + '\\n' +
                          'Enviadas: ' + r.enviadas + '\\n' +
                          'Omitidas por margen: ' + r.omitidas_margen + '\\n' +
                          'Errores: ' + r.errores);
                    location.reload();
                  } else {
                    alert('✗ Error ejecutando cron:\\n' + (data && data.error ? data.error : 'desconocido'));
                  }
                })
                .catch(function(e){ alert('✗ Error de red: ' + e.message); })
                .finally(function(){ btn.textContent = orig; btn.disabled = false; });
            });
          })();
        </script>
        <div class="ptl-filtros ptl-filtros-rapidos">
          ${(() => {
            // Activos = sustituye al antiguo "Todos". Es el filtro por defecto.
            // Mantenemos el aviso de "no cuadra" como indicador de fases mal escritas.
            const activo = filtroEfectivo === "ACTIVOS" ? "on" : "";
            const params = {};
            params.fase = "ACTIVOS";
            if (busqueda) params.q = busqueda;
            if (orden) params.orden = orden;
            const url = urlT(token, "/presupuestos", params);
            const aviso = cuadra ? "" : ` style="border-color:var(--ptl-danger);color:var(--ptl-danger)" title="No cuadra"`;
            return `<a href="${url}" class="ptl-filtro ptl-filtro-tramite ${activo}"${aviso}>Activos <span style="opacity:.7;margin-left:3px">${counts.activos}${cuadra ? '' : ' ⚠'}</span></a>`;
          })()}
          ${filtroBtn("TRAMITE", "En trámite", "ptl-filtro-tramite")}
          ${filtroBtn("HOY", "⏰ Hoy", counts.hoy > 0 ? "ptl-filtro-hoy" : "")}
          <a href="${urlT(token, "/presupuestos/nuevo")}" class="ptl-filtro ptl-filtro-nuevo">+ Nuevo</a>
        </div>
        <div class="ptl-filtros ptl-filtros-fases">
          ${filtroBtn("01_CONTACTO", "01-CONTACTO", "ptl-fase-activa")}
          ${filtroBtn("02_VISITA", "02-VISITA", "ptl-fase-activa")}
          ${filtroBtn("03_ENVIO_PTO", "03-ENVIO PTO", "ptl-fase-activa")}
          ${filtroBtn("04_ACEPTACION_PTO", "04-ACEPTACION PTO", "ptl-fase-activa")}
        </div>
        <div class="ptl-filtros ptl-filtros-fases">
          ${filtroBtn("05_DOCUMENTACION", "05-DOCUMENTACION", "ptl-fase-activa")}
          ${filtroBtn("06_VISITA_EMASESA", "06-VISITA EMASESA", "ptl-fase-activa")}
          ${filtroBtn("07_PTE_CYCP", "07-PTE CYCP", "ptl-fase-activa")}
          ${filtroBtn("08_CYCP", "08-CYCP", "ptl-fase-activa")}
          ${filtroBtn("ZZ_RECHAZADO", "ZZ-RECHAZADO", "ptl-fase-zz")}
          ${filtroBtn("ZZ_DESCARTADO", "ZZ-DESCARTADO", "ptl-fase-zz")}
        </div>
      </div>
      <div>
        ${filas || `<div class="ptl-empty"><h3>Sin resultados</h3><p>No hay presupuestos que cumplan los filtros</p></div>`}
      </div>
      <script>
        let ptlT;
        function ptlFiltrar() {
          clearTimeout(ptlT);
          ptlT = setTimeout(() => {
            const q = document.getElementById('ptl-buscador').value;
            const url = new URL(window.location);
            if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
            window.location = url.toString();
          }, 400);
        }
      </script>
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
    const enFaseDoc = FASES_DOCUMENTACION.includes(fase);

    // Botón cuadradito ↶ "volver a fase anterior" (32x32). Solo se renderiza si
    // existe una fase anterior real (cualquier fase activa salvo 01 y los ZZ).
    // Las ramas que muestran cabecera de fase normal lo insertan a la izquierda
    // del icono "→" del título de la fase. Las ramas finales (ZZ) lo dejan en "".
    let btnRetrocederHtml = '';
    {
      const faseAnt = calcularFaseAnterior(fase);
      if (faseAnt) {
        const defAnt = PTO_FASES[faseAnt] || FASES_DOCUMENTACION_DEF[faseAnt];
        const labelAnt = defAnt ? `${defAnt.codigo}-${(defAnt.nombreLargo || defAnt.nombre || '').toUpperCase()}` : faseAnt;
        btnRetrocederHtml = `
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/retroceder")}" style="display:inline" id="ptlFormRetroceder_${esc(comu.ccpp_id)}">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="conservar" value=""/>
            <button type="button"
              class="ptl-btn ptl-btn-secondary ptl-btn-sm"
              style="width:32px;height:32px;padding:0;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;margin-right:8px"
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
        <div class="ptl-na-right">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a 01-CONTACTO con los contadores reseteados.')">↻ Reactivar expediente</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
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
        <div class="ptl-na-right">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a 01-CONTACTO con los contadores reseteados.')">↻ Reactivar expediente</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/eliminar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Eliminar definitivamente este expediente? Esta acción NO se puede deshacer.')">🗑 ELIMINAR</button>
          </form>
        </div>
      </div>`;
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
          const colorTxt = info.completado
            ? '#B45309'                                  // ámbar (decidir)
            : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
          infoEnvioAuto04Html = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
        }
      } catch (e) { /* si falla la lectura de plantilla, no se pinta el indicador */ }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>${esc(labelFase04)}</span>
            ${infoEnvioAuto04Html}
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln" style="font-size:9px;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;font-weight:700">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            style="border:1px solid var(--ptl-gray-200);border-radius:4px;padding:1px 4px;font-size:11px;font-family:inherit;background:white;width:100%;text-align:center"/>
        </div>
        <div class="ptl-na-right">
          <button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-sm"
            onclick="ptlIntentarReenviarFase04('${esc(comu.ccpp_id)}')"
            title="Abre el modal para reenviar el presupuesto con los cambios realizados">
            📧 Reenviar presupuesto revisado
          </button>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/aceptar")}" style="display:inline" id="ptl-form-aceptar">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="button" class="ptl-btn ptl-btn-success ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_ACEPTACION_PTO', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de aceptación. Al confirmar, también pasa a fase 05-DOCUMENTACION.">✓ ACEPTADO</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/rechazar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Rechazar este presupuesto?')">✕ RECHAZADO</button>
          </form>
        </div>
      </div>`;
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
          <span class="ln" style="font-size:9px;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;font-weight:700">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita-emasesa" value="${esc(fve)}"
            onchange="ptlSyncFechaVisitaEmasesa(this.value)"
            style="border:1px solid var(--ptl-gray-200);border-radius:4px;padding:1px 4px;font-size:11px;font-family:inherit;background:white;width:100%;text-align:center"/>
        </div>`;
      }

      // Botón de avance:
      //  - Si hay siguiente fase definida: botón normal de paso a la siguiente.
      //  - Si NO hay siguiente (08_CYCP sin fecha de cierre): botón "Cerrar fase 08".
      //  - Si NO hay siguiente y ya cerrada: sin botón.
      let botonAvanzarHtml = '';
      if (labelSigDoc) {
        botonAvanzarHtml = `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">${esc(labelSigDoc)}</button>
          </form>`;
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        botonAvanzarHtml = `<form method="POST" action="${urlT(token, "/presupuestos/expediente/cerrar-cycp")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Cerrar la fase 08-CYCP? Significa que ya están firmados todos los contratos.')">✓ Cerrar fase 08-CYCP</button>
          </form>`;
      }

      // Indicador de reenvíos automáticos (segunda línea bajo el título de la fase).
      // Solo en fase 05_DOCUMENTACION (las demás fases doc no tienen reenvíos).
      let infoEnvioAutoDocHtml = '';
      if (fase === "05_DOCUMENTACION") {
        try {
          const plantilla05 = await leerPlantillaMail("05_ENVIO_DOC");
          const info = calcularInfoEnvioAuto(comu, "05_DOCUMENTACION", plantilla05);
          if (info.texto) {
            const colorTxt = info.completado
              ? '#B45309'
              : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
            infoEnvioAutoDocHtml = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla */ }
      }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>${esc(labelFaseDoc)}</span>
            ${infoEnvioAutoDocHtml}
          </div>
        </div>
        ${miniBloqueDocHtml}
        <div class="ptl-na-right">
          ${botonAvanzarHtml}
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
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
            const colorTxt = info.completado
              ? '#B45309'                                  // ámbar (decidir)
              : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
            infoEnvioAutoHtml = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
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
          <span class="ln" style="font-size:9px;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;font-weight:700">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita" value="${esc(fv)}"
            onchange="ptlSyncFechaVisita(this.value)"
            style="border:1px solid var(--ptl-gray-200);border-radius:4px;padding:1px 4px;font-size:11px;font-family:inherit;background:white;width:100%;text-align:center"/>
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
              <span>${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-enviar-avanzar"
            onclick="ptlIntentarEnviarFase03('${esc(fase)}', '${esc(comu.ccpp_id)}')"
            title="Abre el modal para revisar y enviar el presupuesto. Al confirmar, también pasa a fase 04-ACEPTACION PTO.">
            <span class="ln">📧 Enviar presupuesto</span>
            <span class="ln">Y paso a 04-ACEPTACION PTO</span>
          </button>
        </div>`;
      } else {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span>${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          ${miniBloqueHtml || btnMailHtml || '<div></div>'}
          <div class="ptl-na-right">
            <form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">${esc(labelSig)}</button>
            </form>
            <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
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
    const previstoEditable = !["01_CONTACTO","02_VISITA","ZZ_RECHAZADO","ZZ_DESCARTADO"].includes(fasePtl);
    // Los campos "real" se desbloquean al entrar en fase 08_CYCP y siguen
    // editables a partir de ahí (decisión sesión 04/05/2026: por ahora no se
    // vuelven a bloquear con el cierre de fase, ya se decidirá en el futuro).
    const realEditable = (fasePtl === "08_CYCP");
    const roPrevisto = !previstoEditable;
    const roReal = !realEditable;

    const expDataJson = JSON.stringify({
      direccion: comu.direccion || "", comunidad: comu.comunidad || "", tipo_via: comu.tipo_via || "", earth: comu.earth || "",
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

        <div class="ptl-card" style="padding:6px 12px">
          <div class="ptl-card-title" style="margin-bottom:2px">Datos CCPP</div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-1">
              <label class="ptl-form-label">Tipo vía</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" value="${esc(comu.tipo_via || '')}" data-orig="${esc(comu.tipo_via || '')}" placeholder="C" autocomplete="off"/>
              </div>
            </div>
            <div class="col-7">
              <label class="ptl-form-label">Dirección</label>
              <input name="direccion" value="${esc(comu.direccion || '')}" data-orig="${esc(comu.direccion || '')}"/>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">Earth</label>
              <select name="earth" data-orig="${esc(comu.earth || '')}">
                <option value="" ${!comu.earth ? 'selected' : ''}>—</option>
                <option value="SI" ${comu.earth === 'SI' ? 'selected' : ''}>Sí</option>
                <option value="NO" ${comu.earth === 'NO' ? 'selected' : ''}>No</option>
              </select>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">Comunidad (clave)</label>
              <input name="comunidad" value="${esc(comu.comunidad || '')}" data-orig="${esc(comu.comunidad || '')}" title="Clave humana usada en pestañas vecinos_base/expedientes"/>
            </div>
          </div>

          <div class="ptl-form-section-title" style="margin:2px 0 0">Administrador</div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Nombre</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" value="${esc(comu.administrador || '')}" data-orig="${esc(comu.administrador || '')}" autocomplete="off"/>
              </div>
            </div>
            ${inp("telefono_administrador", fmtTlf(comu.telefono_administrador), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_administrador",    comu.email_administrador, { col: 4, type: "email", label: "Email" })}
          </div>

          <div class="ptl-form-section-title" style="margin:2px 0 0">Presidente</div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Nombre</label>
              <input name="presidente" value="${esc(comu.presidente || '')}" data-orig="${esc(comu.presidente || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_presidente", fmtTlf(comu.telefono_presidente), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_presidente",    comu.email_presidente, { col: 4, type: "email", label: "Email" })}
          </div>
        </div>

        <div class="ptl-card">
          <div class="ptl-card-title">Notas</div>
          <textarea name="notas_pto" data-orig="${esc(comu.notas_pto || '')}" rows="8" style="width:100%;padding:5px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;resize:vertical">${esc(comu.notas_pto || '')}</textarea>
        </div>

        ${(fase !== "01_CONTACTO" && fase !== "02_VISITA") ? `<div class="ptl-card">
          <div class="ptl-card-title">Datos económicos</div>
          <div class="ptl-form-grid">
            ${inp("pto_total", comu.pto_total, { type: "number", formato: "euros", col: 12, label: "PTO total (€)", readonly: roPrevisto })}
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
        const ptlHist = [];
        let ptlIntercept = true;

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
            const v = String(ptlValor(k) ?? '');
            const orig = String(ptlOrig[k] ?? '');
            // Comparación numérica SOLO para campos numéricos (euros, días).
            // No usar parseFloat en cualquier campo: una nota como "-09/04/26..."
            // parsea a -9 igual que "-09/04/26 + nuevo texto", y se perdería el cambio.
            const el = ptlForm.querySelector('[name="'+k+'"]');
            const esNumerico = el && (el.classList.contains('campo-euros') || el.classList.contains('campo-dias'));
            if (esNumerico) {
              const vn = parseFloat(v), on = parseFloat(orig);
              if (!isNaN(vn) && !isNaN(on)) {
                if (vn !== on) d[k] = v;
              } else if (v !== orig) {
                d[k] = v;
              }
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
          // Botón Deshacer eliminado de la UI; función mantenida vacía
          // para no tocar el resto del flujo que la llama.
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
              return false;
            }
            ptlOrig[name] = valor;
            ptlSetPill('saved', '✓ Guardado');
            return true;
          } catch (e) {
            console.error('[ptlGuardarCampo] '+name+' excepción:', e);
            ptlSetPill('error', '✕ Error de red');
            return false;
          }
        }
        function ptlOnCambio(ev) {
          const el = ev.target; const name = el.name;
          if (!name) return;
          const newV = el.value, oldV = el.dataset.orig || '';
          if (newV === oldV) return;
          ptlHist.push({ name, oldVal: oldV, newVal: newV });
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
          if (ptlHist.length === 0) return;
          const c = ptlHist.pop();
          const el = ptlForm.querySelector('[name="'+c.name+'"]');
          if (el) { el.value = c.oldVal; el.dataset.orig = c.oldVal; el.focus(); }
          ptlActUndo(); ptlActPill();
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
        window.addEventListener('beforeunload', (ev) => {
          if (window.ptlEliminando) return;
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
          const bp = (pto!=null && mop!=null && map_!=null) ? (pto - mop - map_ - 150) : null;
          const br = (pto!=null && mor!=null && mar!=null) ? (pto - mor - mar) : null;
          setCalc('f_ben_prev', bp); setCalc('f_ben_real', br);
          setCalc('f_ben_desv', (bp!=null && br!=null) ? (br - bp) : null);
        }
        ['tiempo_previsto','tiempo_real','pto_total','mano_obra_previsto','mano_obra_real','material_previsto','material_real']
          .forEach(name => { const el = ptlForm.querySelector('[name="'+name+'"]'); if (el) el.addEventListener('input', recalc); });
        recalc();

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
        // ============================================================
        function ptlCrearModalMailHtml() {
          if (document.getElementById('ptl-modal-mail')) return;
          const div = document.createElement('div');
          div.id = 'ptl-modal-mail';
          div.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:20px';
          div.innerHTML = \`
            <div style="background:white;border-radius:10px;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.2)">
              <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
                <h3 id="ptl-mm-titulo" style="margin:0;font-size:16px;font-weight:700">📧 Enviar email</h3>
                <button type="button" id="ptl-mm-cerrar" style="background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af;padding:0 4px">×</button>
              </div>
              <div style="padding:16px 20px">
                <div id="ptl-mm-aviso" style="display:none;padding:8px 12px;background:#FEF3C7;border-radius:6px;margin-bottom:12px;font-size:12px;color:#92400e"></div>
                <div style="margin-bottom:10px">
                  <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:3px">Para</label>
                  <input id="ptl-mm-destinatario" type="email" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:3px">Asunto</label>
                  <input id="ptl-mm-asunto" type="text" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:3px">Mensaje</label>
                  <textarea id="ptl-mm-mensaje" rows="10" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
                </div>
                <div style="margin-bottom:10px">
                  <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:3px">Adjuntos (uno por línea, descripción del archivo)</label>
                  <textarea id="ptl-mm-adjuntos" rows="2" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical" placeholder="Ej: presupuesto.pdf"></textarea>
                </div>
                <div id="ptl-mm-estado" style="font-size:11px;color:#6b7280;margin-top:8px"></div>
              </div>
              <div style="padding:12px 20px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
                <button type="button" id="ptl-mm-saltar" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="display:none;margin-right:auto">→ Saltar envío y pasar a 04</button>
                <button type="button" id="ptl-mm-cancelar" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
                <button type="button" id="ptl-mm-enviar" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Confirmar envío</button>
              </div>
            </div>
          \`;
          document.body.appendChild(div);
          document.getElementById('ptl-mm-cerrar').addEventListener('click', ptlCerrarModalMail);
          document.getElementById('ptl-mm-cancelar').addEventListener('click', ptlCerrarModalMail);
          div.addEventListener('click', (ev) => { if (ev.target === div) ptlCerrarModalMail(); });
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
          m.style.display = 'flex';
          // Limpiar
          document.getElementById('ptl-mm-aviso').style.display = 'none';
          document.getElementById('ptl-mm-asunto').value = 'Cargando...';
          document.getElementById('ptl-mm-mensaje').value = '';
          document.getElementById('ptl-mm-adjuntos').value = '';
          document.getElementById('ptl-mm-destinatario').value = '';
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
            document.getElementById('ptl-mm-asunto').value = data.plantilla.asunto || '';
            document.getElementById('ptl-mm-mensaje').value = data.plantilla.mensaje || '';
            document.getElementById('ptl-mm-adjuntos').value = String(data.plantilla.adjuntos_fijos || '').split('||').map(s => s.trim()).filter(Boolean).join('\\n');
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
              aviso.textContent = '⚠ Esta CCPP no tiene email de administrador configurado. Añádelo en la ficha antes de enviar.';
            }
            // Botón "Saltar envío" — solo visible en fase 03_ENVIO_PTO Y NO en reenvío
            const btnSaltar = document.getElementById('ptl-mm-saltar');
            if (fase === '03_ENVIO_PTO' && !esReenvio) {
              btnSaltar.style.display = 'inline-flex';
              btnSaltar.onclick = async () => {
                if (!confirm('¿Avanzar a fase 04 sin enviar el mail desde el sistema?\\n\\nSe asume que el presupuesto ya se envió por otro medio.')) return;
                btnSaltar.disabled = true; btnSaltar.textContent = 'Avanzando...';
                try {
                  const fd = new URLSearchParams();
                  fd.append('id', ccppId);
                  fd.append('fase', fase);
                  fd.append('skip', '1');
                  const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                  const dd = await resp.json();
                  if (!resp.ok) throw new Error(dd.error || 'HTTP ' + resp.status);
                  alert('→ Expediente avanzado a 04-ACEPTACION PTO sin envío de mail.');
                  ptlCerrarModalMail();
                  window.location.reload();
                } catch (e) {
                  alert('Error: ' + e.message);
                  btnSaltar.disabled = false; btnSaltar.textContent = '→ Saltar envío y pasar a 04';
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
              try {
                const fd = new URLSearchParams();
                fd.append('id', ccppId);
                fd.append('fase', fase);
                fd.append('destinatario', document.getElementById('ptl-mm-destinatario').value);
                fd.append('asunto', document.getElementById('ptl-mm-asunto').value);
                fd.append('mensaje', document.getElementById('ptl-mm-mensaje').value);
                fd.append('adjuntos', document.getElementById('ptl-mm-adjuntos').value);
                fd.append('tipo', esReenvio ? 'reenvio_fase04' : 'manual_inicial');
                if (esReenvio) fd.append('reenvio', '1');
                const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                const dd = await resp.json();
                if (!resp.ok) throw new Error(dd.error || 'HTTP ' + resp.status);
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
                alert('Error: ' + e.message);
                btn.disabled = false; btn.textContent = '📧 Confirmar envío';
              }
            };
          } catch (e) {
            alert('Error cargando plantilla: ' + e.message);
            ptlCerrarModalMail();
          }
        }
        // Exponer globalmente para usar desde onclick="..."
        window.ptlAbrirModalMail = ptlAbrirModalMail;

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

        // Si el expediente acaba de crearse o reactivarse, preguntar si activar envíos automáticos
        ${reciencreado ? `
        setTimeout(() => {
          if (confirm('¿Activar envíos automáticos?\\n\\nSe enviará ahora el primer email solicitando aprobación del presupuesto, y a partir de ahí el sistema gestionará los envíos según las reglas de la plantilla.')) {
            ptlAbrirModalMail('${esc(comu.fase || 'fase')}', '${esc(comu.ccpp_id)}');
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
  function vistaNuevo(error, token, tiposVia, admins, presis, calles, direccionPrev) {
    const acDataNuevoJson = JSON.stringify({
      tipos:  tiposVia || [],
      admins: admins || [],
      presis: presis || [],
      calles: calles || [],
    }).replace(/</g, "\\u003c");
    const dirVal = esc(direccionPrev || "");
    return `
      <h1 style="font-size:22px;font-weight:700;margin-bottom:14px">+ Nuevo expediente</h1>
      ${error ? `<div class="ptl-next-action urgent"><div class="ico">⚠</div><div class="text">${esc(error)}</div></div>` : ''}
      <form method="POST" action="${urlT(token, "/presupuestos/nuevo")}" id="ptl-form-nuevo">
        <div class="ptl-card">
          <div class="ptl-card-title">Datos de la nueva CCPP</div>
          <div class="ptl-form-grid">
            <div class="col-2"><label class="ptl-form-label">Tipo vía</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" autofocus placeholder="C" value="" autocomplete="off"/>
              </div>
            </div>
            <div class="col-8"><label class="ptl-form-label">Dirección *</label>
              <div class="ptl-ac-wrap">
                <input name="direccion" data-ac="calles" required placeholder="Ej. Doctor Fedriani 39" value="${dirVal}" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Earth</label>
              <select name="earth"><option value="NO">No</option><option value="SI">Sí</option></select>
            </div>
          </div>
          <div class="ptl-form-section-title">Administrador</div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Nombre</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_administrador" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_administrador" type="email"/></div>
          </div>
          <div class="ptl-form-section-title">Presidente</div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Nombre</label>
              <input name="presidente" autocomplete="off"/>
            </div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_presidente" type="tel"/></div>
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
  function vistaPlantillas(plantillas, token, cuentas, pieGlobal) {
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
      let nombre;
      if (fase === "04_ACEPTACION_PTO") {
        nombre = "04-SEGUIMIENTO PTO";
      } else if (fase === "04_REENVIO") {
        nombre = "04-REENVIO PTO REVISADO";
      } else if (fase === "05_ACEPTACION_PTO") {
        nombre = "05-ACEPTACION PTO";
      } else if (fase === "05_ENVIO_DOC") {
        nombre = "05-ENVIO DOC";
      } else if (def) {
        nombre = `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;
      } else {
        nombre = fase;
      }
      const activoChecked = p.activo ? 'checked' : '';
      const cuentasList = Array.isArray(cuentas) ? cuentas : [];
      const cuentaSel = (p.cuenta_envio || "").trim();
      const optsCuenta = cuentasList.length === 0
        ? '<option value="">— No hay cuentas configuradas en mail_cuentas —</option>'
        : '<option value="">— Selecciona una cuenta —</option>' +
          cuentasList.map(c => `<option value="${esc(c.id)}" ${c.id === cuentaSel ? 'selected' : ''}>${esc(c.id)} (${esc(c.email)})</option>`).join('');
      return `
        <div class="ptl-card" style="margin-bottom:16px">
          <div class="ptl-card-title">📧 Fase ${esc(nombre)}</div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" style="padding:12px">
            <input type="hidden" name="fase" value="${esc(fase)}"/>

            <label style="font-size:13px;display:block;margin-bottom:12px">
              <div style="margin-bottom:4px;font-weight:600">Enviar desde</div>
              <select name="cuenta_envio" style="width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px">
                ${optsCuenta}
              </select>
              <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:2px">Cuentas definidas en la pestaña <code>mail_cuentas</code> del Sheet</div>
            </label>

            <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                <input type="checkbox" name="activo" value="SI" ${activoChecked}/>
                <span><strong>Activa</strong> (si está desactivada no se enviarán emails de esta fase)</span>
              </label>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <label style="font-size:13px">
                <div style="margin-bottom:4px;font-weight:600">Días entre envíos</div>
                <input type="number" name="dias_recurrente" value="${p.dias_recurrente || 0}" min="0" max="365"
                  style="width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px"/>
                <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:2px">0 = sin reenvíos automáticos</div>
              </label>
              <label style="font-size:13px">
                <div style="margin-bottom:4px;font-weight:600">Máximo de envíos</div>
                <input type="number" name="max_envios" value="${p.max_envios || 1}" min="1" max="10"
                  style="width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px"/>
                <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:2px">Al alcanzar el tope, el cron descarta tras N días sin pasar de fase</div>
              </label>
            </div>

            <label style="font-size:13px;display:block;margin-bottom:12px">
              <div style="margin-bottom:4px;font-weight:600">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required
                style="width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px"/>
            </label>

            <label style="font-size:13px;display:block;margin-bottom:12px">
              <div style="margin-bottom:4px;font-weight:600">Cuerpo del mensaje</div>
              <textarea name="mensaje" rows="8" maxlength="5000" required
                style="width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit">${esc(p.mensaje || '')}</textarea>
              <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:2px">Texto literal — el destinatario es siempre el email del administrador de la CCPP</div>
            </label>

            <div style="margin-bottom:4px;font-weight:600;font-size:13px">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">
              <input type="email" name="cco_1" value="${esc(p._cco_1 || '')}" maxlength="200"
                placeholder="email CCO 1"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
              <input type="email" name="cco_2" value="${esc(p._cco_2 || '')}" maxlength="200"
                placeholder="email CCO 2"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
              <input type="email" name="cco_3" value="${esc(p._cco_3 || '')}" maxlength="200"
                placeholder="email CCO 3"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin-bottom:12px">Si se rellena alguno, esos destinatarios reciben copia oculta de cada envío de esta plantilla (sin acentos)</div>

            <div style="margin-bottom:4px;font-weight:600;font-size:13px">Adjuntos fijos (opcional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">
              <input type="text" name="adjunto_1" value="${esc(p._adjunto_1 || '')}" maxlength="500"
                placeholder="Título: https://..."
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
              <input type="text" name="adjunto_2" value="${esc(p._adjunto_2 || '')}" maxlength="500"
                placeholder="Título: https://..."
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
              <input type="text" name="adjunto_3" value="${esc(p._adjunto_3 || '')}" maxlength="500"
                placeholder="Título: https://..."
                style="padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:12px"/>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin-bottom:12px">Hasta 3 adjuntos. Formato: <code>Título: https://enlace</code> — aparecerán tal cual en el cuerpo del mail.</div>

            <input type="hidden" name="dias_primer_envio" value="${p.dias_primer_envio || 0}"/>

            <div style="display:flex;justify-content:flex-end">
              <button type="submit" class="ptl-btn ptl-btn-primary">💾 Guardar cambios</button>
            </div>
          </form>
        </div>
      `;
    }).join("");

    return `
      <div style="max-width:880px;margin:0 auto;padding:14px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">⚙ Plantillas de mail</h1>
        <p style="color:var(--ptl-gray-600);font-size:13px;margin-bottom:16px">
          Configura aquí los textos de los emails y las reglas de envío automático para cada fase.
          Los cambios se aplican inmediatamente — no hay que reiniciar nada.
        </p>
        ${tarjetas}

        <div class="ptl-card" style="margin-bottom:16px;border-color:var(--ptl-gray-300)">
          <div class="ptl-card-title">📝 Pie de página global</div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar-pie-global")}" style="padding:12px">
            <div style="font-size:12px;color:var(--ptl-gray-500);margin-bottom:6px">
              Texto que se añadirá al final de TODOS los mails (después del cuerpo y los adjuntos). Si lo dejas vacío, no se añade nada.
            </div>
            <textarea name="pie_global" rows="5" style="width:100%;padding:8px 10px;border:1px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:13px;resize:vertical">${esc(pieGlobal || "")}</textarea>
            <div style="text-align:right;margin-top:10px">
              <button type="submit" class="ptl-btn ptl-btn-primary">💾 Guardar pie</button>
            </div>
          </form>
        </div>

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:12px">
          Los datos se guardan en la pestaña <code>mail_plantillas</code> del Sheet.
        </div>
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
    const token = req.query.token;
    if (!process.env.ADMIN_TOKEN) {
      // Si no hay ADMIN_TOKEN definido en el entorno, permitir acceso (modo dev)
      return true;
    }
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(403).type("text/plain").send("No autorizado. Añade ?token=TUTOKEN a la URL.");
      return false;
    }
    return true;
  }

  // =================================================================
  // RUTAS HTTP
  // =================================================================

  // GET /presupuestos — listado
  app.get("/presupuestos", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const comunidades = await leerComunidades();
      const html = pageHtml("Presupuestos",
        [{ label: "Presupuestos", url: "#" }],
        await vistaListado(comunidades, req.query, token),
        token);
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
    let admins = [], presis = [], calles = [];
    try {
      const comunidades = await leerComunidades();
      const dl = construirDatalists(comunidades);
      const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
      tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
      admins = dl.admins;
      presis = dl.presis;
      calles = dl.calles;
    } catch (e) {
      console.warn("[presupuestos] no se pudieron leer datos:", e.message);
    }
    sendHtml(res, pageHtml("Nuevo expediente",
      [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
      vistaNuevo(req.query.error || "", token, tiposVia, admins, presis, calles, req.query.dir || ""),
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
        let admins = [], presis = [], calles = [];
        try {
          const comunidades = await leerComunidades();
          const dl = construirDatalists(comunidades);
          const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
          tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
          admins = dl.admins; presis = dl.presis; calles = dl.calles;
        } catch (e) {}
        sendHtml(res, pageHtml("Nuevo expediente",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
          vistaNuevo(mensaje, token, tiposVia, admins, presis, calles, datos),
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
        earth: req.body.earth || "NO",
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
      const faseActual = normalizarFase(comu.fase_presupuesto);
      if (FASES_DOCUMENTACION.includes(faseActual)) {
        return res.redirect(urlT(token, "/documentacion/expediente", { id }));
      }
      const datalists = construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";
      sendHtml(res, pageHtml(titulo,
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        await vistaFicha(comu, datalists, token, reciencreado),
        token));
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
        else { const n = parseFloat(String(valor).replace(',', '.')); valor = isNaN(n) ? "" : String(n); }
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
      comu[campo] = valor;
      await actualizarComunidad(comu._rowIndex, comu);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /campo:", e.message);
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
        if (fase === "02_VISITA")          { comu.fecha_visita = ""; }
        if (fase === "03_ENVIO_PTO")       { comu.fecha_envio_pto = ""; }
        if (fase === "04_ACEPTACION_PTO")  {
          comu.fecha_aceptacion_pto = "";
          comu.fecha_ultimo_seguimiento_pto = "";
          comu.fecha_ultimo_reenvio_pto = "";
          comu.fecha_proximo_mail_manual = "";
        }
        if (fase === "05_DOCUMENTACION")   { comu.fecha_documentacion_completa = ""; }
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
      comu.fase_presupuesto = "ZZ_RECHAZADO";
      comu.decision_pto = "RECHAZADO";
      comu.fecha_aceptacion_pto = new Date().toISOString().slice(0, 10);
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
      const token = req.query.token || "";
      // Redirigir al listado (la ficha ya no existe)
      res.redirect(urlT(token, "/presupuestos"));
    } catch (e) {
      console.error("[presupuestos] /eliminar:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/reactivar — vuelve a 01_CONTACTO reseteando contadores
  // Equivalente a "crear de cero" pero conservando los datos de la ficha.
  // Acepta como fase de origen ZZ_RECHAZADO o ZZ_DESCARTADO.
  app.post("/presupuestos/expediente/reactivar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const faseActual = normalizarFase(comu.fase_presupuesto);
      // Solo permitir reactivar si está rechazada o descartada
      if (faseActual !== "ZZ_DESCARTADO" && faseActual !== "ZZ_RECHAZADO") {
        return sendError(res, "Solo se pueden reactivar expedientes rechazados o descartados");
      }
      comu.fase_presupuesto = "01_CONTACTO";
      comu.fecha_contacto = new Date().toISOString().slice(0, 10);
      // Resetear todas las fechas posteriores
      comu.fecha_visita = "";
      comu.fecha_envio_pto = "";
      comu.fecha_ultimo_seguimiento_pto = "";
      comu.fecha_aceptacion_pto = "";
      comu.decision_pto = "";
      // Resetear contadores de mail
      comu.mails_enviados = "";
      comu.mails_manuales = "";
      comu.mails_ultimo_envio = "";
      await actualizarComunidad(comu._rowIndex, comu);
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
      // Sustituir variables
      const asunto = sustituirVariables(plantilla.asunto, comu);
      const mensaje = sustituirVariables(plantilla.mensaje, comu);
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
          dias_recurrente: plantilla.dias_recurrente,
          max_envios: plantilla.max_envios,
        },
        destinatario: {
          nombre: comu.administrador || "",
          email: comu.email_administrador || "",
        },
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

  // POST /presupuestos/expediente/enviar-mail
  // body: id, fase, asunto, mensaje, destinatario, adjuntos, tipo
  // tipo: "manual_inicial" (1er envío del confirm) | "automatico" (cron) | "manual" (legacy)
  // Envío REAL via SMTP (nodemailer). La cuenta de salida la indica la plantilla
  // (col J `cuenta_envio` de mail_plantillas) referenciando una fila de mail_cuentas.
  // NOTA: el descarte por tope NO lo hace este endpoint — lo hace el cron diario 30 días después.
  app.post("/presupuestos/expediente/enviar-mail", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "");
      const fase = String(req.body.fase || "");
      const skip = String(req.body.skip || "") === "1";
      const reenvio = String(req.body.reenvio || "") === "1";
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });

      // Modo "saltar envío": solo permitido en fase 03_ENVIO_PTO.
      // No registra en histórico, no incrementa contador, solo avanza la fase.
      if (skip) {
        if (fase !== "03_ENVIO_PTO" || normalizarFase(comu.fase_presupuesto) !== "03_ENVIO_PTO") {
          return res.status(400).json({ error: "El modo 'saltar envío' solo está disponible en fase 03-ENVIO PTO." });
        }
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_envio_pto = hoy;
        comu.fase_presupuesto = "04_ACEPTACION_PTO";
        if (!comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        await actualizarComunidad(comu._rowIndex, comu);
        return res.json({ ok: true, skipped: true, avanzado: true });
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

        const destinatarioR = req.body.destinatario || comu.email_administrador || "";
        if (!destinatarioR) return res.status(400).json({ error: "El expediente no tiene email_administrador configurado." });
        const asuntoR  = req.body.asunto  || sustituirVariables(plantillaR.asunto, comu)  || "";
        const mensajeR = req.body.mensaje || sustituirVariables(plantillaR.mensaje, comu) || "";
        const adjuntosR = req.body.adjuntos || plantillaR.adjuntos_fijos || "";

        // Envío real
        try {
          await enviarMailReal({
            cuentaId: plantillaR.cuenta_envio,
            destinatario: destinatarioR,
            cco: plantillaR.cco,
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
          asunto: asuntoR,
          mensaje: mensajeR,
          adjuntos: adjuntosR,
          tipo: "reenvio_fase04",
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
        if (numAutomActual + 1 > plantilla.max_envios) {
          return res.status(400).json({
            error: `Se alcanzó el máximo de reenvíos automáticos (${plantilla.max_envios}).`,
          });
        }
      }

      const destinatario = req.body.destinatario || comu.email_administrador || "";
      if (!destinatario) return res.status(400).json({ error: "El expediente no tiene email_administrador configurado." });

      // Fase 05_ACEPTACION_PTO: calcular y guardar la fecha límite para que vecinos
      // entreguen documentación (hoy + 20 días). Esta fecha la queda guardada
      // y se reutiliza en mails posteriores como {{fecha_limite_doc_vecinos}}.
      // Solo se rellena si aún no hay valor (no se sobrescribe en re-envíos).
      if (fase === "05_ACEPTACION_PTO" && !comu.fecha_limite_documentacion_vecinos) {
        const f = new Date();
        f.setDate(f.getDate() + 20);
        comu.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      }

      const asuntoF  = req.body.asunto  || sustituirVariables(plantilla.asunto, comu)  || "";
      const mensajeF = req.body.mensaje || sustituirVariables(plantilla.mensaje, comu) || "";
      const adjuntosF = req.body.adjuntos || plantilla.adjuntos_fijos || "";

      // Envío real
      try {
        await enviarMailReal({
          cuentaId: plantilla.cuenta_envio,
          destinatario,
          cco: plantilla.cco,
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
        asunto: asuntoF,
        mensaje: mensajeF,
        adjuntos: adjuntosF,
        tipo: tipoEnvio,
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

      res.json({
        ok: true,
        envios: nuevoCount,
        max_envios: plantilla.max_envios,
        avanzado,
        avanzadoA05,
      });
    } catch (e) {
      console.error("[presupuestos] /enviar-mail:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

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
  const CRON_FASES_AUTO = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION"];
  const CRON_MARGEN_DIAS = 7;
  const cronStatus = { ultimoTick: null, ultimoResumen: null, ultimoError: null };

  async function ejecutarCronEnviosAutomaticos() {
    const inicio = new Date();
    const resumen = { revisadas: 0, enviadas: 0, descartadas: 0, omitidas_margen: 0, errores: 0 };
    try {
      const comunidades = await leerComunidades();
      for (const comu of comunidades) {
        const fase = normalizarFase(comu.fase_presupuesto);
        if (!CRON_FASES_AUTO.includes(fase)) continue;
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
        const numAutomaticos = Math.max(0, numEnvios - numManualesAct);

        // ----- FASE 01: requiere primer envío manual previo -----
        if (fase === "01_CONTACTO") {
          if (numEnvios < 1) continue; // cron no activado (no hay envío manual previo)
          const fechaUltimo = ultimo[fase];
          if (!fechaUltimo) continue;
          resumen.revisadas++;
          let plantilla;
          try { plantilla = await leerPlantillaMail(fase); } catch (e) { resumen.errores++; continue; }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 0;
          const mx = plantilla.max_envios || 0; // tope de REENVÍOS AUTOMÁTICOS
          if (dr <= 0 || mx <= 0) continue;
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const fu = new Date(fechaUltimo); fu.setHours(0,0,0,0);
          const diasDesde = Math.floor((hoy - fu) / 86400000);
          if (diasDesde < dr) continue;
          // ¿Ya estaba en tope de automáticos? El cron NO descarta
          // automáticamente: se queda esperando decisión humana (el aviso
          // ya se envió cuando se alcanzó el tope).
          if (numAutomaticos >= mx) {
            continue;
          }
          // Margen
          const diasVencido = diasDesde - dr;
          if (diasVencido > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
          // Enviar automático
          try {
            const dest = comu.email_administrador || "";
            if (!dest) { resumen.errores++; continue; }
            if (!plantilla.cuenta_envio) {
              console.warn(`[presupuestos][cron][01] plantilla sin cuenta_envio: ${comu.direccion}`);
              resumen.errores++; continue;
            }
            const asuntoSus  = sustituirVariables(plantilla.asunto, comu)  || "";
            const mensajeSus = sustituirVariables(plantilla.mensaje, comu) || "";
            await enviarMailReal({
              cuentaId: plantilla.cuenta_envio,
              destinatario: dest,
              cco: plantilla.cco,
              asunto: asuntoSus,
              mensaje: mensajeSus,
              adjuntosUrls: String(plantilla.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
            });
            await registrarMailEnHistorico({
              fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
              direccion: comu.direccion || comu.comunidad, fase,
              destinatario: dest,
              asunto: asuntoSus, mensaje: mensajeSus,
              adjuntos: plantilla.adjuntos_fijos || "", tipo: "automatico",
            });
            // Solo se incrementa el total (mails_enviados); manuales NO se toca.
            // El número de automáticos se deduce: numEnvios - numManuales.
            const nuevoNum = numEnvios + 1;
            enviados[fase] = nuevoNum;
            // Si el CCPP era antiguo y no tenía mails_manuales, ahora lo
            // sembramos para que la cuenta sea coherente desde aquí en adelante.
            if (manuales[fase] === undefined) {
              manuales[fase] = numManualesAct;
              comu.mails_manuales = JSON.stringify(manuales);
            }
            ultimo[fase] = new Date().toISOString().slice(0, 10);
            comu.mails_enviados = JSON.stringify(enviados);
            comu.mails_ultimo_envio = JSON.stringify(ultimo);
            await actualizarComunidad(comu._rowIndex, comu);
            resumen.enviadas++;
            // ¿Este envío fue el último automático permitido?
            // numAutomaticos pasa a ser numAutomaticos + 1.
            const nuevosAuto = numAutomaticos + 1;
            if (nuevosAuto >= mx) {
              const defF = PTO_FASES[fase];
              const faseLargo = defF ? `${defF.codigo}-${(defF.nombreLargo || defF.nombre || '').toUpperCase()}` : fase;
              await enviarMailAvisoCompletado({
                comu, fase, faseLargo, numEnvios: nuevosAuto, maxEnvios: mx,
              });
            }
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
          }
          continue;
        }

        // ----- FASE 04: primer envío automático + tope opcional + fecha manual -----
        // Si la plantilla tiene max_envios > 0, el cron PARA al alcanzarlo y avisa
        // al admin (no descarta automáticamente: queda en fase 04 esperando que
        // se decida manualmente — aceptar / rechazar / descartar / reenviar).
        // Si max_envios == 0 → sin tope (comportamiento histórico).
        if (fase === "04_ACEPTACION_PTO" || fase === "05_DOCUMENTACION") {
          let plantilla;
          try { plantilla = await leerPlantillaMail(plantillaDeFase(fase)); } catch (e) { resumen.errores++; continue; }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 30;
          const di = plantilla.cadenciaInicialDias || 3;
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
            // Si ya está en tope de AUTOMÁTICOS, no envía y no toca nada
            // (queda esperando decisión humana; el aviso ya se envió).
            if (mx > 0 && numAutomaticos >= mx) continue;
            let fechaBase, dias;
            if (numAutomaticos < 1) {
              // Aún no hay reenvíos automáticos → primer reenvío a 'di' días.
              // Base preferente: último envío (manual). Si no hay (CCPP nuevo
              // recién entrado en fase 04 sin envío inicial todavía),
              // fallback a fecha_ultimo_seguimiento_pto.
              fechaBase = ultimo[fase] || comu.fecha_ultimo_seguimiento_pto;
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
              const dest04 = comu.email_administrador || "";
              if (!dest04) { resumen.errores++; continue; }
              if (!plantilla.cuenta_envio) {
                console.warn(`[presupuestos][cron][04] plantilla sin cuenta_envio: ${comu.direccion}`);
                resumen.errores++; continue;
              }
              const asuntoSus04  = sustituirVariables(plantilla.asunto, comu)  || "";
              const mensajeSus04 = sustituirVariables(plantilla.mensaje, comu) || "";
              await enviarMailReal({
                cuentaId: plantilla.cuenta_envio,
                destinatario: dest04,
                cco: plantilla.cco,
                asunto: asuntoSus04,
                mensaje: mensajeSus04,
                adjuntosUrls: String(plantilla.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
              });
              await registrarMailEnHistorico({
                fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                direccion: comu.direccion || comu.comunidad, fase,
                destinatario: dest04,
                asunto: asuntoSus04, mensaje: mensajeSus04,
                adjuntos: plantilla.adjuntos_fijos || "", tipo: "automatico",
              });
              // Incrementa el TOTAL (mails_enviados); manuales no se toca.
              // Si llega de "fecha manual" (consumirManual), reseteamos los
              // automáticos: tras la cita, la nueva ronda arranca limpia.
              if (consumirManual) {
                // Este envío cuenta como el primero AUTOMÁTICO de la nueva
                // ronda (los manuales se mantienen tal cual).
                enviados[fase] = numManualesAct + 1;
                nuevosAuto04 = 1;
              } else {
                enviados[fase] = (enviados[fase] || 0) + 1;
                nuevosAuto04 = numAutomaticos + 1;
              }
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
            // ¿Este reenvío automático fue el último permitido?
            if (debeEnviar && mx > 0 && nuevosAuto04 !== null && nuevosAuto04 >= mx) {
              const defF = PTO_FASES[fase];
              const faseLargo = defF ? `${defF.codigo}-${(defF.nombreLargo || defF.nombre || '').toUpperCase()}` : fase;
              await enviarMailAvisoCompletado({
                comu, fase, faseLargo, numEnvios: nuevosAuto04, maxEnvios: mx,
              });
            }
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
          }
          continue;
        }
      }
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoResumen = resumen;
      cronStatus.ultimoError = null;
      console.log(`[presupuestos][cron] ${inicio.toISOString()} - revisadas:${resumen.revisadas} enviadas:${resumen.enviadas} descartadas:${resumen.descartadas} omitidas_margen:${resumen.omitidas_margen} errores:${resumen.errores}`);
      return resumen;
    } catch (e) {
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoError = e.message;
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

  // GET /presupuestos/cron-status — diagnóstico del cron
  app.get("/presupuestos/cron-status", async (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      ok: true,
      ultimoTick: cronStatus.ultimoTick,
      ultimoResumen: cronStatus.ultimoResumen,
      ultimoError: cronStatus.ultimoError,
      proximoTick: "cada 24h desde el arranque",
      fases_automaticas: CRON_FASES_AUTO,
      margen_dias: CRON_MARGEN_DIAS,
    });
  });

  // POST /presupuestos/cron-run — ejecutar cron manualmente (para pruebas)
  app.post("/presupuestos/cron-run", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const resumen = await ejecutarCronEnviosAutomaticos();
      res.json({ ok: true, resumen });
    } catch (e) {
      res.status(500).json({ error: e.message });
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
      const fasesConPlantilla = ["01_CONTACTO", "03_ENVIO_PTO", "04_ACEPTACION_PTO", "04_REENVIO", "05_ACEPTACION_PTO", "05_ENVIO_DOC"];
      const plantillas = [];
      for (const f of fasesConPlantilla) {
        const p = await leerPlantillaMail(f);
        if (p) {
          plantillas.push(p);
        } else {
          // Plantilla no creada todavía: fila vacía para que el usuario la rellene
          plantillas.push({
            fase: f,
            activo: true,
            asunto: "",
            mensaje: "",
            adjuntos_fijos: "",
            dias_primer_envio: 0,
            dias_recurrente: 0,
            max_envios: 0,
            cco: "",
          });
        }
      }
      // Cargar cuentas configuradas en mail_cuentas para el selector "Enviar desde"
      const cuentas = await leerCuentasMail(true); // forzar lectura sin caché
      // Cargar pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D=mensaje)
      const pieRow = await leerPlantillaMail("_PIE_GLOBAL");
      const pieGlobal = pieRow ? (pieRow.mensaje || "") : "";
      sendHtml(res, pageHtml("Plantillas de mail",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas", url: "#" }],
        vistaPlantillas(plantillas, token, cuentas, pieGlobal),
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
      const adjuntosFijos = [a1, a2, a3].join("||"); // siempre 3 trozos, vacío = ""
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
      const cco = [c1, c2, c3].join("||");
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
      await guardarPlantillaMail(datos);
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
    // Expuestos para sandbox de tests (no usados por otros módulos en producción)
    PTO_FASES,
    fechaHito,
    lineaTiempoHtml,
    COLS,
    rowToObj,
    objToRow,
  };

}; // end module.exports

// reinicio render 1778199437
