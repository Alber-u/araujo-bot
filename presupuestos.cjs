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
  const RANGO_COMUNIDADES = "comunidades!A:AH"; // 10 + 24 columnas
  const RANGO_VECINOS_BASE = "vecinos_base!A:F";
  const RANGO_EXPEDIENTES = "expedientes!A:Y";

  // Fases del proceso de presupuesto (módulo CCPP)
  const PTO_FASES = {
    "01_SOLICITUD":     { codigo: "01", nombre: "Solicitud",   color: "azul",     siguiente: "02_VISITA",       accionLabel: "Solicitud registrada", plantilla: "primer_contacto", cadenciaDias: 30 },
    "02_VISITA":        { codigo: "02", nombre: "Pte. visita", color: "azul",     siguiente: "03_ENVIO",        accionLabel: "Programar visita",     plantilla: null },
    "03_ENVIO":         { codigo: "03", nombre: "Envío",       color: "azul",     siguiente: "04_SEGUIMIENTO",  accionLabel: "Enviar presupuesto",   plantilla: "envio_pto" },
    "04_SEGUIMIENTO":   { codigo: "04", nombre: "Seguim.",     color: "amarillo", siguiente: "05_RESOLUCION",   accionLabel: "Seguimiento",          plantilla: "seguimiento", cadenciaDias: 15, cadenciaInicialDias: 3 },
    "05_RESOLUCION":    { codigo: "05", nombre: "Resol.",      color: "naranja",  siguiente: null,              accionLabel: "Decisión cliente",     plantilla: null },
    "ENTREGADO":        { codigo: "06", nombre: "Entregado",   color: "verde",    siguiente: null,              accionLabel: "Entregado",            plantilla: null },
    "ZZ_RECHAZADO":     { codigo: "ZZ", nombre: "Rechazado",   color: "rojo",     siguiente: null,              accionLabel: "Rechazado",            plantilla: null },
  };

  // Mapeo de estados antiguos del Excel -> fase nueva (compat con SEGUIMIENTO.xlsm)
  const MAPA_ESTADO_FASE = {
    "00-SOLICITUD ACTA PTO": "01_SOLICITUD",
    "00-PTE VISITA":         "02_VISITA",
    "01-ENVIO PTO":          "03_ENVIO",
    "01-PERSIGO PTO":        "04_SEGUIMIENTO",
    "01-SOLICITUD ACTA PTO": "01_SOLICITUD",
    "02-PTE VISITA":         "02_VISITA",
    "03-ENVIO PTO":          "03_ENVIO",
    "03-ENVÍO PTO":          "03_ENVIO",
    "04-SEGUIMIENTO PTO":    "04_SEGUIMIENTO",
    "05-RESOLUCION PTO":     "05_RESOLUCION",
    "05-RESOLUCIÓN PTO":     "05_RESOLUCION",
    "ZZ-RECHAZADA":          "ZZ_RECHAZADO",
    "ZZ-RECHAZADO":          "ZZ_RECHAZADO",
    "06-ENVIO DOC":          "ENTREGADO",
    "02-PERSIGO CYCP":       "ENTREGADO",
    "02-PERSIGO DOC":        "ENTREGADO",
    "02-EMASESA CYCP":       "ENTREGADO",
    "02-EMASESA TECNICO":    "ENTREGADO",
    "02-TRADICIONAL":        "ENTREGADO",
    "03-TRAMITADA":          "ENTREGADO",
    "04-EJECUTADA":          "ENTREGADO",
  };

  function normalizarFase(fase) {
    if (!fase) return "01_SOLICITUD";
    if (PTO_FASES[fase]) return fase;
    return MAPA_ESTADO_FASE[fase] || "01_SOLICITUD";
  }

  // Documentos requeridos por tipo (espejo de index.cjs:REQUIRED_DOCS)
  // Solo lo necesitamos para mostrar la cajita de vecinos correctamente.
  const REQUIRED_DOCS = {
    propietario: { obligatorios: ["solicitud_firmada", "dni_delante", "dni_detras"], opcionales: ["empadronamiento"] },
    familiar:    { obligatorios: ["solicitud_firmada", "dni_familiar_delante", "dni_familiar_detras", "dni_propietario_delante", "dni_propietario_detras", "libro_familia", "autorizacion_familiar"], opcionales: ["empadronamiento"] },
    inquilino:   { obligatorios: ["solicitud_firmada", "dni_inquilino_delante", "dni_inquilino_detras", "dni_propietario_delante", "dni_propietario_detras", "contrato_alquiler"], opcionales: ["empadronamiento"] },
    sociedad:    { obligatorios: ["solicitud_firmada", "dni_administrador_delante", "dni_administrador_detras", "nif_sociedad", "escritura_constitucion", "poderes_representante"], opcionales: [] },
    local:       { obligatorios: ["solicitud_firmada", "dni_propietario_delante", "dni_propietario_detras", "licencia_o_declaracion"], opcionales: [] },
    financiacion:{ obligatorios: ["dni_pagador_delante", "dni_pagador_detras", "justificante_ingresos", "titularidad_bancaria"], opcionales: [] },
  };
  const DOC_LABELS = {
    solicitud_firmada: "Solicitud de EMASESA firmada",
    dni_delante: "DNI por la parte delantera",
    dni_detras: "DNI por la parte trasera",
    dni_familiar_delante: "DNI del familiar por delante",
    dni_familiar_detras: "DNI del familiar por detrás",
    dni_propietario_delante: "DNI del propietario por delante",
    dni_propietario_detras: "DNI del propietario por detrás",
    dni_inquilino_delante: "DNI del inquilino por delante",
    dni_inquilino_detras: "DNI del inquilino por detrás",
    dni_administrador_delante: "DNI del administrador por delante",
    dni_administrador_detras: "DNI del administrador por detrás",
    libro_familia: "Libro de familia",
    autorizacion_familiar: "Documento de autorización",
    contrato_alquiler: "Contrato de alquiler completo y firmado",
    empadronamiento: "Certificado de empadronamiento",
    nif_sociedad: "NIF/CIF de la sociedad",
    escritura_constitucion: "Escritura de constitución",
    poderes_representante: "Poderes del representante",
    licencia_o_declaracion: "Licencia de apertura o declaración responsable",
    dni_pagador_delante: "DNI del pagador por delante",
    dni_pagador_detras: "DNI del pagador por detrás",
    justificante_ingresos: "Justificante de ingresos",
    titularidad_bancaria: "Documento de titularidad bancaria",
  };
  function labelDoc(c) { return DOC_LABELS[c] || c || "—"; }

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
    let prefijo = "";
    if (d.length === 11 && d.startsWith("34")) { prefijo = "+34 "; d = d.slice(2); }
    if (d.length === 9) return prefijo + `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }
  function splitList(s) { return String(s || "").split(",").map(x => x.trim()).filter(Boolean); }
  function ahoraISO() { return new Date().toISOString(); }
  function ccppId(direccion) {
    const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // Construye una URL añadiendo automáticamente el token si existe.
  // params puede ser un objeto { fase: "01_SOLICITUD", q: "alberche" }
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
  //  Q  fecha_solicitud_pto
  //  R  fecha_visita_pto
  //  S  fecha_envio_pto
  //  T  fecha_ultimo_seguimiento_pto
  //  U  decision_pto
  //  V  fecha_decision_pto
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

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_decision_pto",
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio",
    "tiempo_previsto","tiempo_real","tiempo_desvio","notas_pto",
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
      range: `comunidades!A${rowIndex}:AH${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
  async function crearComunidad(datos) {
    const sheets = getSheetsClient();
    if (!datos.fase_presupuesto) datos.fase_presupuesto = "01_SOLICITUD";
    if (!datos.fecha_solicitud_pto) datos.fecha_solicitud_pto = new Date().toISOString().slice(0, 10);
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
      range: `comunidades!A${rowIndex}:AH${rowIndex}`,
    });
    const row = (res.data.values && res.data.values[0]) || [];
    const obj = rowToObj(row);
    obj[campo] = valor;
    await actualizarComunidad(rowIndex, obj);
  }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base + expedientes (solo LECTURA)
  // =================================================================
  async function leerVecinosBase() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        comunidad: r[0] || "",
        bloque: r[1] || "",
        vivienda: r[2] || "",
        nombre: r[3] || "",
        telefono: r[4] || "",
        presentacion_enviada: r[5] || "",
      });
    }
    return out;
  }

  async function leerExpedientes() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        telefono: r[0] || "", comunidad: r[1] || "", vivienda: r[2] || "", nombre: r[3] || "",
        tipo_expediente: r[4] || "", paso_actual: r[5] || "", documento_actual: r[6] || "",
        estado_expediente: r[7] || "", fecha_inicio: r[8] || "", fecha_primer_contacto: r[9] || "",
        fecha_ultimo_contacto: r[10] || "", fecha_limite_documentacion: r[11] || "",
        fecha_limite_firma: r[12] || "", documentos_completos: r[13] || "",
        alerta_plazo: r[14] || "", documentos_recibidos: r[15] || "",
        documentos_pendientes: r[16] || "", documentos_opcionales_pendientes: r[17] || "",
      });
    }
    return out;
  }

  // Devuelve los vecinos (de pestaña "expedientes") cuya comunidad coincide
  // con la dirección o el código de comunidad del expediente CCPP.
  function vecinosDeComunidad(expedientes, comu) {
    if (!expedientes || !comu) return [];
    const norm = s => String(s || "").trim().toLowerCase();
    const claves = [norm(comu.comunidad), norm(comu.direccion)].filter(Boolean);
    return expedientes.filter(v => claves.includes(norm(v.comunidad)));
  }

  // =================================================================
  // LÓGICA DE NEGOCIO — disparadores, transiciones, línea de tiempo
  // =================================================================
  function calcularDisparador(comu) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    if (!def || !def.plantilla) return null;
    let baseFecha = null;
    let dias = def.cadenciaDias || 30;
    if (fase === "04_SEGUIMIENTO") {
      baseFecha = comu.fecha_ultimo_seguimiento_pto || comu.fecha_envio_pto;
      if (!baseFecha) return null;
      if (!comu.fecha_ultimo_seguimiento_pto) dias = def.cadenciaInicialDias || 3;
    } else if (fase === "01_SOLICITUD") {
      baseFecha = comu.fecha_solicitud_pto;
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
    const ORDEN = ["01_SOLICITUD","02_VISITA","03_ENVIO","04_SEGUIMIENTO","05_RESOLUCION"];
    const idx = ORDEN.indexOf(fase);
    return [
      { proceso: "Presupuesto", nombre: "Solicit.", faseId: "01_SOLICITUD",   estado: estadoHito("01_SOLICITUD",   fase, idx) },
      { proceso: "Presupuesto", nombre: "Visita",   faseId: "02_VISITA",      estado: estadoHito("02_VISITA",      fase, idx) },
      { proceso: "Presupuesto", nombre: "Envío",    faseId: "03_ENVIO",       estado: estadoHito("03_ENVIO",       fase, idx) },
      { proceso: "Presupuesto", nombre: "Seguim.",  faseId: "04_SEGUIMIENTO", estado: estadoHito("04_SEGUIMIENTO", fase, idx) },
      { proceso: "Presupuesto", nombre: "Resol.",   faseId: "05_RESOLUCION",  estado: estadoHito("05_RESOLUCION",  fase, idx) },
      { proceso: "Recogida",    nombre: "DNIs",     faseId: null, estado: fase === "ENTREGADO" ? "actual" : "pendiente" },
      { proceso: "Recogida",    nombre: "Solicit.", faseId: null, estado: "pendiente" },
      { proceso: "Recogida",    nombre: "Contrato", faseId: null, estado: "pendiente" },
      { proceso: "Recogida",    nombre: "Final",    faseId: null, estado: "pendiente" },
      { proceso: "Ejecución",   nombre: "EMASESA",  faseId: null, estado: "pendiente" },
      { proceso: "Ejecución",   nombre: "Instal.",  faseId: null, estado: "pendiente" },
      { proceso: "Ejecución",   nombre: "Cert.",    faseId: null, estado: "pendiente" },
    ];
    function estadoHito(hitoId, faseActual, idxFaseActual) {
      if (faseActual === "ZZ_RECHAZADO") return "rechazado";
      const ordenHito = ORDEN.indexOf(hitoId);
      if (ordenHito === -1) return "pendiente";
      if (faseActual === "ENTREGADO") return "completo";
      if (ordenHito < idxFaseActual) return "completo";
      if (ordenHito === idxFaseActual) return "actual";
      return "pendiente";
    }
  }

  function fechaHito(comu, hitoId) {
    if (hitoId === "01_SOLICITUD")   return comu.fecha_solicitud_pto;
    if (hitoId === "02_VISITA")      return comu.fecha_visita_pto;
    if (hitoId === "03_ENVIO")       return comu.fecha_envio_pto;
    if (hitoId === "04_SEGUIMIENTO") return comu.fecha_ultimo_seguimiento_pto;
    if (hitoId === "05_RESOLUCION")  return comu.fecha_decision_pto;
    return "";
  }

  // Genera HTML de la línea de tiempo
  function lineaTiempoHtml(comu) {
    const puntos = calcularLineaTiempo(comu);
    const grupos = {};
    puntos.forEach(p => { (grupos[p.proceso] ||= []).push(p); });
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
                <div class="ptl-label">${esc(p.nombre)}</div>
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
  <style>${CSS}</style>
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
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F9FAFB;color:#111827;font-size:14px;line-height:1.5}
    a{text-decoration:none;color:inherit}
    :root{--ptl-brand:#4F46E5;--ptl-brand-light:#EEF2FF;--ptl-success:#10B981;--ptl-success-light:#D1FAE5;--ptl-warning:#F59E0B;--ptl-warning-light:#FEF3C7;--ptl-danger:#EF4444;--ptl-danger-light:#FEE2E2;--ptl-gray-50:#F9FAFB;--ptl-gray-100:#F3F4F6;--ptl-gray-200:#E5E7EB;--ptl-gray-400:#9CA3AF;--ptl-gray-500:#6B7280;--ptl-gray-700:#374151;--ptl-gray-900:#111827}
    .ptl-nav{position:sticky;top:0;background:white;border-bottom:1px solid var(--ptl-gray-200);padding:8px 20px;display:flex;align-items:center;gap:14px;z-index:200;height:60px}
    .ptl-nav-brand{display:flex;align-items:center;gap:10px;flex:1}
    .ptl-logo{width:34px;height:34px;border-radius:8px;background:var(--ptl-brand);color:white;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
    .ptl-nav-text{display:flex;flex-direction:column;line-height:1.2}
    .ptl-nav-text strong{font-size:14px;color:var(--ptl-gray-900)}
    .ptl-nav-text span{font-size:11px;color:var(--ptl-gray-500)}
    .ptl-page{max-width:1200px;margin:0 auto;padding:14px 20px}
    .ptl-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ptl-gray-500);margin-bottom:8px;flex-wrap:wrap}
    .ptl-breadcrumb a{color:var(--ptl-brand)}
    .ptl-breadcrumb a:hover{text-decoration:underline}
    .ptl-breadcrumb .ptl-sep{color:#D1D5DB}
    .ptl-breadcrumb > span:last-child{font-size:16px;font-weight:600;color:var(--ptl-gray-900)}

    .ptl-card{background:white;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05);border:1px solid var(--ptl-gray-200);margin-bottom:6px}
    .ptl-card-title{font-size:10px;font-weight:700;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px}
    .ptl-card-title-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px}

    .ptl-empty{text-align:center;padding:50px 20px;color:var(--ptl-gray-500)}
    .ptl-empty h3{color:var(--ptl-gray-700);font-size:17px;margin-bottom:6px}

    /* Filtros */
    .ptl-filtros{display:flex;flex-wrap:wrap;gap:6px}
    .ptl-filtro{padding:5px 12px;border-radius:20px;border:1.5px solid var(--ptl-gray-200);background:white;font-size:12px;font-weight:500;color:var(--ptl-gray-700);transition:all .15s}
    .ptl-filtro:hover,.ptl-filtro.on{background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}
    .ptl-filtro.ptl-filtro-hoy{border-color:var(--ptl-warning);color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-hoy:hover,.ptl-filtro.ptl-filtro-hoy.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}

    /* Búsqueda */
    .ptl-search-wrap{position:relative;flex:1}
    .ptl-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ptl-gray-400);font-size:13px}
    .ptl-search-input{width:100%;padding:7px 12px 7px 32px;border:1.5px solid var(--ptl-gray-200);border-radius:8px;font-size:13px;outline:none;background:white;font-family:inherit}
    .ptl-search-input:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-btn-orden{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);border-radius:8px;padding:0 14px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .ptl-btn-orden:hover{background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}

    .ptl-lista-header{position:sticky;top:60px;z-index:100;background:var(--ptl-gray-50);padding:10px 0 8px;margin-bottom:6px;border-bottom:1px solid var(--ptl-gray-200);display:flex;flex-direction:column;gap:8px}

    /* Filas de lista */
    .ptl-fila{background:white;border:1px solid var(--ptl-gray-200);border-radius:8px;padding:3px 12px;margin-bottom:3px;display:flex;align-items:center;gap:12px;color:inherit;transition:all .15s}
    .ptl-fila:hover{border-color:var(--ptl-brand);box-shadow:0 2px 6px rgba(79,70,229,.08)}
    .ptl-fila-info{flex:0 0 auto;min-width:0;max-width:38%;display:flex;align-items:baseline;gap:6px;overflow:hidden}
    .ptl-fila-tipo{color:var(--ptl-gray-500);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0}
    .ptl-fila-dir{font-size:13px;font-weight:600;color:var(--ptl-gray-900);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-fila-importe{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptl-gray-500);flex-shrink:0;min-width:80px;text-align:right}
    .ptl-fila .ptl-timeline{flex:1;justify-content:flex-end;padding:0}

    /* Timeline */
    .ptl-timeline{display:flex;align-items:stretch;gap:0;padding:2px 0 1px;overflow-x:auto;scrollbar-width:thin}
    .ptl-grupo{flex:0 0 auto;display:flex;flex-direction:column;padding:0 6px}
    .ptl-grupo-titulo{font-size:9px;font-weight:700;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:2px}
    .ptl-puntos{display:flex;gap:0;padding:0 4px}
    .ptl-punto{display:flex;flex-direction:column;align-items:center;position:relative;min-width:50px}
    .ptl-punto:not(:last-child)::after{content:'';position:absolute;top:4px;right:-50%;width:100%;height:6px;background:var(--ptl-gray-200);z-index:0;border-radius:3px}
    .ptl-punto.completo:not(:last-child)::after{background:var(--ptl-success)}
    .ptl-circulo{width:10px;height:10px;border-radius:50%;background:var(--ptl-gray-200);border:2px solid var(--ptl-gray-200);z-index:1;position:relative}
    .ptl-punto.completo .ptl-circulo{background:var(--ptl-success);border-color:var(--ptl-success)}
    .ptl-punto.actual .ptl-circulo{background:var(--ptl-warning);border-color:var(--ptl-warning);box-shadow:0 0 0 3px rgba(245,158,11,.2);animation:ptlPulso 2s ease-in-out infinite}
    .ptl-punto.rechazado .ptl-circulo{background:var(--ptl-danger);border-color:var(--ptl-danger)}
    @keyframes ptlPulso{0%,100%{box-shadow:0 0 0 3px rgba(245,158,11,.2)}50%{box-shadow:0 0 0 6px rgba(245,158,11,.1)}}
    .ptl-label{font-size:9px;color:var(--ptl-gray-500);margin-top:3px;font-weight:500;text-align:center;line-height:1.1;max-width:56px}
    .ptl-fecha{font-size:9px;color:var(--ptl-gray-400);margin-top:0;font-variant-numeric:tabular-nums;text-align:center;line-height:1}
    .ptl-punto.actual .ptl-label{color:var(--ptl-warning);font-weight:700}
    .ptl-punto.completo .ptl-label{color:var(--ptl-success);font-weight:600}
    .ptl-punto.rechazado .ptl-label{color:var(--ptl-danger);font-weight:700}
    .ptl-fila .ptl-grupo-titulo{display:none}
    .ptl-fila .ptl-punto{min-width:44px}
    .ptl-fila .ptl-label,.ptl-fila .ptl-fecha{font-size:8px}

    /* Badges */
    .ptl-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
    .ptl-badge-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-badge-amarillo{background:var(--ptl-warning-light);color:var(--ptl-warning)}
    .ptl-badge-naranja{background:#FED7AA;color:#C2410C}
    .ptl-badge-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger)}
    .ptl-badge-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-badge-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-700)}

    /* Botones */
    .ptl-btn{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid transparent;font-family:inherit;transition:all .12s;display:inline-flex;align-items:center;gap:5px}
    .ptl-btn-sm{padding:4px 10px;font-size:11px}
    .ptl-btn-primary{background:var(--ptl-brand);color:white}
    .ptl-btn-primary:hover{background:#4338CA}
    .ptl-btn-success{background:var(--ptl-success);color:white}
    .ptl-btn-danger{background:var(--ptl-danger);color:white}
    .ptl-btn-secondary{background:white;color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}

    /* Acción ahora */
    .ptl-next-action{background:var(--ptl-brand-light);border:1.5px solid #C7D2FE;border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
    .ptl-next-action .ico{font-size:18px}
    .ptl-next-action .text{font-size:12px;font-weight:600;color:#3730A3}
    .ptl-next-action .sub{font-size:11px;color:var(--ptl-brand);margin-top:1px}
    .ptl-next-action.urgent{background:var(--ptl-danger-light);border-color:#FECACA}
    .ptl-next-action.urgent .text{color:var(--ptl-danger)}
    .ptl-next-action.warn{background:var(--ptl-warning-light);border-color:#FDE68A}
    .ptl-next-action.warn .text{color:var(--ptl-warning)}

    /* Form grid */
    .ptl-form-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px 6px}
    .ptl-form-grid input,.ptl-form-grid select,.ptl-form-grid textarea{width:100%;padding:4px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;outline:none;background:white;height:26px}
    .ptl-form-grid textarea{height:auto}
    .ptl-form-grid input:focus,.ptl-form-grid select:focus,.ptl-form-grid textarea:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-form-grid .col-1{grid-column:span 1}.ptl-form-grid .col-2{grid-column:span 2}.ptl-form-grid .col-3{grid-column:span 3}.ptl-form-grid .col-4{grid-column:span 4}.ptl-form-grid .col-5{grid-column:span 5}.ptl-form-grid .col-6{grid-column:span 6}.ptl-form-grid .col-7{grid-column:span 7}.ptl-form-grid .col-8{grid-column:span 8}.ptl-form-grid .col-12{grid-column:span 12}
    .ptl-form-label{font-size:9px;font-weight:600;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px;display:block;line-height:1.2}
    .ptl-form-section-title{font-size:9px;font-weight:700;color:var(--ptl-gray-700);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 2px;padding-bottom:1px;border-bottom:1px solid var(--ptl-gray-100)}
    .ptl-form-grid input.calc-field{background:#E5E7EB;color:var(--ptl-gray-700);cursor:not-allowed;border-color:#D1D5DB;font-weight:600}

    /* Save bar */
    .ptl-save-bar{position:fixed;bottom:18px;right:18px;z-index:100;display:flex;gap:10px;align-items:center}
    .ptl-save-pill{background:white;border:1.5px solid var(--ptl-gray-200);border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;color:var(--ptl-gray-500);box-shadow:0 4px 12px rgba(0,0,0,.10);display:inline-flex;align-items:center;gap:6px}
    .ptl-save-pill.saving{color:var(--ptl-warning);border-color:#FDE68A;background:var(--ptl-warning-light)}
    .ptl-save-pill.saved{color:var(--ptl-success);border-color:#A7F3D0;background:var(--ptl-success-light)}
    .ptl-save-pill.error{color:var(--ptl-danger);border-color:#FECACA;background:var(--ptl-danger-light)}
    .ptl-btn-undo{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .ptl-btn-undo:hover:not(:disabled){background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}
    .ptl-btn-undo:disabled{opacity:.4;cursor:not-allowed}

    /* Tabla vecinos */
    .ptl-vecinos-stats{display:flex;gap:6px;flex-wrap:wrap}
    .ptl-stat-pill{font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}
    .ptl-stat-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-stat-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-stat-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-700)}
    .ptl-stat-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger)}
    .ptl-tabla-vecinos{width:100%;border-collapse:collapse;font-size:12px}
    .ptl-tabla-vecinos thead th{background:var(--ptl-gray-50);color:var(--ptl-gray-500);font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:5px 8px;text-align:left;border-bottom:1px solid var(--ptl-gray-200);white-space:nowrap}
    .ptl-tabla-vecinos tbody td{padding:4px 8px;border-bottom:1px solid var(--ptl-gray-100);vertical-align:middle}
    .ptl-tabla-vecinos tbody tr:hover{background:var(--ptl-gray-50);cursor:pointer}
    .ptl-num-cell{font-variant-numeric:tabular-nums;color:var(--ptl-gray-700);white-space:nowrap}

    /* Datalist */
    .ptl-form-grid input[list]::-webkit-calendar-picker-indicator{opacity:.4}

    @media (max-width:900px){.ptl-form-grid{grid-template-columns:repeat(6,1fr)}.ptl-form-grid [class*=col-]{grid-column:span 6}}
  `;

  // =================================================================
  // VISTA: LISTADO DE PRESUPUESTOS
  // =================================================================
  function vistaListado(comunidades, query, token) {
    const filtroFase = query.fase || "";
    const busqueda = (query.q || "").toLowerCase().trim();
    const orden = query.orden || "";

    const counts = { todos: 0, hoy: 0 };
    ["01_SOLICITUD","02_VISITA","03_ENVIO","04_SEGUIMIENTO","05_RESOLUCION","ENTREGADO","ZZ_RECHAZADO"].forEach(f => counts[f] = 0);
    comunidades.forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      counts.todos++;
      if (counts[f] !== undefined) counts[f]++;
      const d = calcularDisparador(c);
      if (d && (d.urgencia === "vencido" || d.diasRestantes === 0)) counts.hoy++;
    });

    let lista = comunidades.slice();
    if (filtroFase === "HOY") {
      lista = lista.filter(c => {
        const d = calcularDisparador(c);
        return d && (d.urgencia === "vencido" || d.diasRestantes === 0);
      });
    } else if (filtroFase) {
      lista = lista.filter(c => normalizarFase(c.fase_presupuesto) === filtroFase);
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
      lista.sort((a, b) => dir * String(a.direccion || a.comunidad || "").localeCompare(String(b.direccion || b.comunidad || ""), "es", { sensitivity: "base" }));
    } else if (ordenEf === "urg") {
      lista.sort((a, b) => {
        const da = calcularDisparador(a), db = calcularDisparador(b);
        return (da ? da.diasRestantes : 9999) - (db ? db.diasRestantes : 9999);
      });
    }

    const filtroBtn = (faseId, label, extra = "") => {
      const activo = filtroFase === faseId ? "on" : "";
      const params = {};
      if (faseId) params.fase = faseId;
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      let n = faseId === "HOY" ? counts.hoy : (faseId ? counts[faseId] : counts.todos);
      return `<a href="${url}" class="ptl-filtro ${activo} ${extra}">${label} <span style="opacity:.7;margin-left:3px">${n}</span></a>`;
    };

    const filas = lista.map(c => `
      <a href="${urlT(token, "/presupuestos/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info">
          <span class="ptl-fila-tipo">${esc(c.tipo_via || '')}</span>
          <span class="ptl-fila-dir">${esc(c.direccion || c.comunidad || '—')}</span>
        </div>
        ${lineaTiempoHtml(c)}
        <span class="ptl-fila-importe">${fmtMoneda(c.pto_total)}</span>
      </a>
    `).join("");

    const sumaProcesos = counts["01_SOLICITUD"]+counts["02_VISITA"]+counts["03_ENVIO"]+counts["04_SEGUIMIENTO"]+counts["05_RESOLUCION"]+counts["ENTREGADO"]+counts["ZZ_RECHAZADO"];
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
        </div>
        <div class="ptl-filtros">
          <a href="${urlT(token, "/presupuestos/nuevo")}" class="ptl-filtro" style="background:var(--ptl-brand);color:white;border-color:var(--ptl-brand);font-weight:600">+ Nuevo</a>
          ${filtroBtn("HOY", "⏰ Hoy", counts.hoy > 0 ? "ptl-filtro-hoy" : "")}
          ${(() => {
            const activo = filtroFase === "" ? "on" : "";
            const params = {};
            if (busqueda) params.q = busqueda;
            if (orden) params.orden = orden;
            const url = urlT(token, "/presupuestos", params);
            const aviso = cuadra ? "" : ` style="border-color:var(--ptl-danger);color:var(--ptl-danger)" title="No cuadra"`;
            return `<a href="${url}" class="ptl-filtro ${activo}"${aviso}>Todos <span style="opacity:.7;margin-left:3px">${counts.todos}${cuadra ? '' : ' ⚠'}</span></a>`;
          })()}
          ${filtroBtn("01_SOLICITUD", "01-Solicitud acta")}
          ${filtroBtn("02_VISITA", "02-Pte visita")}
          ${filtroBtn("03_ENVIO", "03-Envío pto")}
          ${filtroBtn("04_SEGUIMIENTO", "04-Seguimiento pto")}
          ${filtroBtn("05_RESOLUCION", "05-Resolución pto")}
          ${filtroBtn("ENTREGADO", "06-Envío doc")}
          ${filtroBtn("ZZ_RECHAZADO", "ZZ-Rechazado")}
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
  function vistaFicha(comu, vecinos, datalists, token) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    const disp = calcularDisparador(comu);

    let accionHtml = "";
    if (fase === "ZZ_RECHAZADO") {
      accionHtml = `<div class="ptl-next-action" style="background:var(--ptl-gray-50);border-color:var(--ptl-gray-200)">
        <div class="ico">✕</div>
        <div style="flex:1"><div class="text" style="color:var(--ptl-gray-700)">Expediente rechazado</div></div>
      </div>`;
    } else if (fase === "ENTREGADO") {
      accionHtml = `<div class="ptl-next-action" style="background:var(--ptl-success-light);border-color:#A7F3D0">
        <div class="ico">✓</div>
        <div style="flex:1"><div class="text" style="color:var(--ptl-success)">Aceptado · En Recogida de documentos</div></div>
      </div>`;
    } else if (fase === "05_RESOLUCION") {
      accionHtml = `<div class="ptl-next-action">
        <div class="ico">⚖</div>
        <div style="flex:1"><div class="text">Decisión del cliente</div></div>
        <form method="POST" action="${urlT(token, "/presupuestos/expediente/aceptar")}" style="display:inline">
          <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
          <button type="submit" class="ptl-btn ptl-btn-success ptl-btn-sm">✓ ACEPTADO</button>
        </form>
        <form method="POST" action="${urlT(token, "/presupuestos/expediente/rechazar")}" style="display:inline">
          <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
          <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Rechazar este presupuesto?')">✕ RECHAZADO</button>
        </form>
      </div>`;
    } else if (fase === "04_SEGUIMIENTO") {
      const urgCls = disp && disp.urgencia === "vencido" ? "urgent" : disp && disp.urgencia === "proximo" ? "warn" : "";
      accionHtml = `<div class="ptl-next-action ${urgCls}">
        <div class="ico">⏰</div>
        <div style="flex:1"><div class="text">Seguimiento en curso</div>
        ${disp ? `<div class="sub">Próximo email: ${fmtFecha(disp.vence)} (${disp.diasRestantes <= 0 ? `vencido ${Math.abs(disp.diasRestantes)}d` : `en ${disp.diasRestantes}d`})</div>` : ''}</div>
        <form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
          <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
          <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">→ Pasar a Resolución</button>
        </form>
      </div>`;
    } else if (def && def.siguiente) {
      accionHtml = `<div class="ptl-next-action">
        <div class="ico">→</div>
        <div style="flex:1"><div class="text">${esc(def.accionLabel)}</div></div>
        <form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
          <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
          <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">${esc(def.accionLabel)} →</button>
        </form>
      </div>`;
    }

    // Helper inputs
    const inp = (name, val, opts = {}) => {
      const tipo = opts.type || "text";
      const inputType = tipo === "number" ? "number" : (tipo === "email" ? "email" : (tipo === "tel" ? "tel" : "text"));
      const col = opts.col || 3;
      const lbl = opts.label || name;
      const step = tipo === "number" ? ' step="0.01"' : '';
      const cls = tipo === "tel" ? ' class="campo-tlf"' : '';
      const list = opts.list ? ` list="${opts.list}"` : '';
      return `<div class="col-${col}">
        <label class="ptl-form-label">${esc(lbl)}</label>
        <input type="${inputType}" name="${name}" value="${esc(val == null ? '' : val)}" data-orig="${esc(val == null ? '' : val)}"${step}${cls}${list}/>
      </div>`;
    };

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

    return `
      <div class="ptl-card" style="display:flex;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">${lineaTiempoHtml(comu)}</div>
        <button type="button" class="ptl-btn-undo" id="ptl-btn-undo" disabled onclick="ptlUndo()">↶ Deshacer</button>
      </div>

      ${accionHtml}

      <form id="ptl-ficha-form" data-id="${esc(comu.ccpp_id)}" onsubmit="return false">
        <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>

        <datalist id="ptl-dl-admins">${(datalists.admins || []).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <datalist id="ptl-dl-presis">${(datalists.presis || []).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <datalist id="ptl-dl-tipos"><option value="(C)"></option><option value="(Av)"></option><option value="(Bª)"></option><option value="(Pz)"></option><option value="(Pza)"></option><option value="(Rª)"></option><option value="(Ur)"></option></datalist>

        <div class="ptl-card">
          <div class="ptl-card-title">Datos CCPP</div>
          <div class="ptl-form-grid">
            <div class="col-1">
              <label class="ptl-form-label">Tipo vía</label>
              <input name="tipo_via" list="ptl-dl-tipos" value="${esc(comu.tipo_via || '')}" data-orig="${esc(comu.tipo_via || '')}" placeholder="(C)"/>
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

          <div class="ptl-form-section-title">Administrador</div>
          <div class="ptl-form-grid">
            <div class="col-4">
              <label class="ptl-form-label">Nombre</label>
              <input name="administrador" list="ptl-dl-admins" value="${esc(comu.administrador || '')}" data-orig="${esc(comu.administrador || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_administrador", fmtTlf(comu.telefono_administrador), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_administrador",    comu.email_administrador, { col: 6, type: "email", label: "Email" })}
          </div>

          <div class="ptl-form-section-title">Presidente</div>
          <div class="ptl-form-grid">
            <div class="col-4">
              <label class="ptl-form-label">Nombre</label>
              <input name="presidente" list="ptl-dl-presis" value="${esc(comu.presidente || '')}" data-orig="${esc(comu.presidente || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_presidente", fmtTlf(comu.telefono_presidente), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_presidente",    comu.email_presidente, { col: 6, type: "email", label: "Email" })}
          </div>
        </div>

        <div class="ptl-card">
          <div class="ptl-card-title">Datos económicos · Presupuesto</div>
          <div class="ptl-form-grid">
            ${inp("tiempo_previsto", comu.tiempo_previsto, { type: "number", col: 4, label: "Tiempo previsto (días)" })}
            ${inp("tiempo_real",     comu.tiempo_real,     { type: "number", col: 4, label: "Tiempo real (días)" })}
            <div class="col-4">
              <label class="ptl-form-label">Desvío tiempo</label>
              <input type="text" name="tiempo_desvio" id="f_tiempo_desvio" readonly class="calc-field" value="${esc(comu.tiempo_desvio || '')}"/>
            </div>
            ${inp("pto_total", comu.pto_total, { type: "number", col: 12, label: "PTO total (€)" })}
            ${inp("mano_obra_previsto", comu.mano_obra_previsto, { type: "number", col: 6, label: "Mano de obra previsto" })}
            ${inp("mano_obra_real",     comu.mano_obra_real,     { type: "number", col: 6, label: "Mano de obra real" })}
            ${inp("material_previsto",  comu.material_previsto,  { type: "number", col: 6, label: "Material previsto" })}
            ${inp("material_real",      comu.material_real,      { type: "number", col: 6, label: "Material real" })}
            <div class="col-4">
              <label class="ptl-form-label">Beneficio previsto</label>
              <input type="text" name="beneficio_previsto" id="f_ben_prev" readonly class="calc-field" value="${esc(comu.beneficio_previsto || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Beneficio real</label>
              <input type="text" name="beneficio_real" id="f_ben_real" readonly class="calc-field" value="${esc(comu.beneficio_real || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Desvío beneficio</label>
              <input type="text" name="beneficio_desvio" id="f_ben_desv" readonly class="calc-field" value="${esc(comu.beneficio_desvio || '')}"/>
            </div>
          </div>
        </div>

        ${cajitaVecinosHtml(comu, vecinos)}

        <div class="ptl-card">
          <div class="ptl-card-title">Notas internas</div>
          <textarea name="notas_pto" data-orig="${esc(comu.notas_pto || '')}" rows="2" style="width:100%;padding:5px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;resize:vertical">${esc(comu.notas_pto || '')}</textarea>
        </div>
      </form>

      <div class="ptl-save-bar">
        <span class="ptl-save-pill" id="ptl-save-pill">Sin cambios</span>
      </div>

      <script>
        const ptlForm = document.getElementById('ptl-ficha-form');
        const ptlId = ptlForm.dataset.id;
        const ptlPill = document.getElementById('ptl-save-pill');
        const ptlBtnUndo = document.getElementById('ptl-btn-undo');
        const ptlOrig = ${expDataJson};
        const ptlHist = [];
        let ptlIntercept = true;

        function ptlSetPill(estado, txt) { ptlPill.className = 'ptl-save-pill ' + estado; ptlPill.textContent = txt; }
        function ptlValor(name) { const el = ptlForm.querySelector('[name="'+name+'"]'); return el ? el.value : ''; }
        function ptlDiff() {
          const d = {};
          for (const k of Object.keys(ptlOrig)) {
            const v = String(ptlValor(k) ?? '');
            if (v !== String(ptlOrig[k] ?? '')) d[k] = v;
          }
          return d;
        }
        function ptlActPill() {
          const n = Object.keys(ptlDiff()).length;
          if (n === 0) ptlSetPill('', 'Sin cambios');
          else ptlSetPill('saving', n + (n === 1 ? ' cambio sin guardar' : ' cambios sin guardar'));
        }
        function ptlActUndo() {
          ptlBtnUndo.disabled = ptlHist.length === 0;
          ptlBtnUndo.textContent = ptlHist.length > 0 ? '↶ Deshacer ('+ptlHist.length+')' : '↶ Deshacer';
        }
        async function ptlGuardar() {
          const d = ptlDiff();
          if (Object.keys(d).length === 0) return true;
          try {
            for (const [campo, valor] of Object.entries(d)) {
              const fd = new URLSearchParams();
              fd.append('id', ptlId); fd.append('campo', campo); fd.append('valor', valor);
              const r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
              if (!r.ok) throw new Error('HTTP '+r.status);
              ptlOrig[campo] = valor;
            }
            ptlSetPill('saved', '✓ Guardado');
            return true;
          } catch (e) { ptlSetPill('error', '✕ Error'); return false; }
        }
        function ptlOnCambio(ev) {
          const el = ev.target; const name = el.name;
          if (!name) return;
          const newV = el.value, oldV = el.dataset.orig || '';
          if (newV === oldV) return;
          ptlHist.push({ name, oldVal: oldV, newVal: newV });
          el.dataset.orig = newV;
          ptlActUndo(); ptlActPill();
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
          if (r) await ptlGuardar();
          ptlIntercept = false;
          window.location = href;
        }, true);
        window.addEventListener('beforeunload', (ev) => {
          if (Object.keys(ptlDiff()).length > 0) { ev.preventDefault(); ev.returnValue = ''; }
        });
        document.querySelectorAll('form[action^="/presupuestos/expediente/"]').forEach(f => {
          f.addEventListener('submit', async (ev) => {
            if (Object.keys(ptlDiff()).length > 0) {
              ev.preventDefault();
              const r = confirm('Hay cambios sin guardar.\\n\\n  Aceptar = Guardar y continuar\\n  Cancelar = Descartar y continuar');
              if (r) await ptlGuardar();
              ptlIntercept = false; f.submit();
            }
          });
        });

        // Formato teléfono
        function ptlFmtTlf(s) {
          if (!s) return '';
          let d = String(s).replace(/\\D/g, '');
          let p = '';
          if (d.length === 11 && d.startsWith('34')) { p = '+34 '; d = d.slice(2); }
          if (d.length === 9) return p + d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
          return s;
        }
        ptlForm.querySelectorAll('.campo-tlf').forEach(el => {
          el.addEventListener('blur', () => { const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; } });
          el.addEventListener('focus', () => { el.value = String(el.value).replace(/\\D/g, ''); });
          const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; }
        });

        // Cálculos en vivo
        function n(name) { const el = ptlForm.querySelector('[name="'+name+'"]'); if (!el) return null; const v = parseFloat(String(el.value).replace(',','.')); return isNaN(v) ? null : v; }
        function setCalc(id, val, fmt) {
          const el = document.getElementById(id);
          if (!el) return;
          if (val == null) { el.value = ''; return; }
          if (fmt === 'pct') el.value = (val * 100).toFixed(1) + ' %';
          else el.value = val.toFixed(2);
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
      </script>
    `;
  }

  // Cajita de vecinos dentro de la ficha del expediente
  function cajitaVecinosHtml(comu, vecinos) {
    if (!vecinos || vecinos.length === 0) return "";
    const total = vecinos.length;
    const completos = vecinos.filter(v => v.estado_expediente === "documentacion_base_completa").length;
    const enProceso = vecinos.filter(v => v.estado_expediente === "en_proceso").length;
    const sinClasif = vecinos.filter(v => v.estado_expediente === "pendiente_clasificacion").length;

    const filas = vecinos.map(v => {
      const docActual = v.documento_actual ? labelDoc(v.documento_actual) : "—";
      const pendientes = (v.documentos_pendientes || "").split(",").filter(Boolean).length;
      const tlf = fmtTlf(v.telefono);
      // Si existe ruta /vecino del index.cjs, enlazamos ahí (token requerido en index.cjs)
      const tk = process.env.ADMIN_TOKEN ? `&token=${encodeURIComponent(process.env.ADMIN_TOKEN)}` : "";
      const url = `/vecino?t=${encodeURIComponent(v.telefono)}${tk}`;
      const badgeEstado = badgeEstadoVecino(v.estado_expediente);
      return `<tr onclick="window.location='${url}'">
        <td><strong>${esc(v.vivienda || '—')}</strong></td>
        <td>${esc(v.nombre || '—')}</td>
        <td class="ptl-num-cell">${esc(tlf)}</td>
        <td>${badgeEstado}</td>
        <td>${esc(docActual)}</td>
        <td class="ptl-num-cell">${pendientes} doc.</td>
      </tr>`;
    }).join("");

    return `
      <div class="ptl-card">
        <div class="ptl-card-title-row">
          <div class="ptl-card-title" style="margin-bottom:0">Vecinos · Documentación (${total})</div>
          <div class="ptl-vecinos-stats">
            ${completos > 0 ? `<span class="ptl-stat-pill ptl-stat-verde">✓ ${completos} completos</span>` : ''}
            ${enProceso > 0 ? `<span class="ptl-stat-pill ptl-stat-azul">⏳ ${enProceso} en proceso</span>` : ''}
            ${sinClasif > 0 ? `<span class="ptl-stat-pill ptl-stat-gris">📋 ${sinClasif} sin clasificar</span>` : ''}
          </div>
        </div>
        <div style="overflow-x:auto;border-radius:6px;border:1px solid var(--ptl-gray-100)">
          <table class="ptl-tabla-vecinos">
            <thead><tr><th>Vivienda</th><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Doc. actual</th><th>Pendientes</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function badgeEstadoVecino(estado) {
    const map = {
      en_proceso: { txt: "En proceso", cls: "ptl-badge-azul" },
      pendiente_clasificacion: { txt: "Pdte. clasificación", cls: "ptl-badge-gris" },
      pendiente_estudio_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      pendiente_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      documentacion_base_completa: { txt: "Doc. completa", cls: "ptl-badge-verde" },
      expediente_con_revision_pendiente: { txt: "Revisión pendiente", cls: "ptl-badge-naranja" },
      completo_revision_final: { txt: "Rev. final", cls: "ptl-badge-naranja" },
    };
    const def = map[estado] || { txt: estado || "—", cls: "ptl-badge-gris" };
    return `<span class="ptl-badge ${def.cls}">${esc(def.txt)}</span>`;
  }

  // =================================================================
  // VISTA: NUEVO EXPEDIENTE
  // =================================================================
  function vistaNuevo(error, token) {
    return `
      <h1 style="font-size:22px;font-weight:700;margin-bottom:14px">+ Nuevo expediente</h1>
      ${error ? `<div class="ptl-next-action urgent"><div class="ico">⚠</div><div class="text">${esc(error)}</div></div>` : ''}
      <form method="POST" action="${urlT(token, "/presupuestos/nuevo")}">
        <div class="ptl-card">
          <div class="ptl-card-title">Datos de la nueva CCPP</div>
          <div class="ptl-form-grid">
            <div class="col-12"><label class="ptl-form-label">Dirección *</label><input name="direccion" required autofocus placeholder="Ej. Doctor Fedriani 39"/></div>
            <div class="col-3"><label class="ptl-form-label">Tipo de vía</label><input name="tipo_via" placeholder="(C), (Av)..." value="(C)"/></div>
            <div class="col-3"><label class="ptl-form-label">Earth</label>
              <select name="earth"><option value="NO">No</option><option value="SI">Sí</option></select>
            </div>
            <div class="col-6"><label class="ptl-form-label">Comunidad (clave)</label><input name="comunidad" placeholder="ej. ESTRELLA ALDEBARAN 4"/></div>
          </div>
          <div class="ptl-form-section-title">Administrador (opcional)</div>
          <div class="ptl-form-grid">
            <div class="col-4"><label class="ptl-form-label">Nombre</label><input name="administrador"/></div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_administrador" type="tel"/></div>
            <div class="col-6"><label class="ptl-form-label">Email</label><input name="email_administrador" type="email"/></div>
          </div>
          <div class="ptl-form-section-title">Presidente (opcional)</div>
          <div class="ptl-form-grid">
            <div class="col-4"><label class="ptl-form-label">Nombre</label><input name="presidente"/></div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_presidente" type="tel"/></div>
            <div class="col-6"><label class="ptl-form-label">Email</label><input name="email_presidente" type="email"/></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="submit" class="ptl-btn ptl-btn-primary">Crear expediente</button>
          <a href="${urlT(token, "/presupuestos")}" class="ptl-btn ptl-btn-secondary">Cancelar</a>
        </div>
      </form>
    `;
  }

  // =================================================================
  // CONSTRUIR DATALISTS de admins/presidentes (autocompletado)
  // =================================================================
  function construirDatalists(comunidades) {
    const admins = new Set(), presis = new Set();
    comunidades.forEach(c => {
      if (c.administrador && String(c.administrador).trim()) admins.add(String(c.administrador).trim());
      if (c.presidente && String(c.presidente).trim()) presis.add(String(c.presidente).trim());
    });
    return { admins: [...admins].sort(), presis: [...presis].sort() };
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
        vistaListado(comunidades, req.query, token),
        token);
      sendHtml(res, html);
    } catch (e) {
      console.error("[presupuestos] /presupuestos error:", e.message);
      sendError(res, "Error cargando presupuestos: " + e.message);
    }
  });

  // GET /presupuestos/nuevo — formulario nuevo
  app.get("/presupuestos/nuevo", (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    sendHtml(res, pageHtml("Nuevo expediente",
      [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
      vistaNuevo(req.query.error || "", token),
      token));
  });

  // POST /presupuestos/nuevo — crear
  app.post("/presupuestos/nuevo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const dir = String(req.body.direccion || "").trim();
      if (!dir) {
        return sendHtml(res, pageHtml("Nuevo expediente",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
          vistaNuevo("La dirección es obligatoria", token),
          token));
      }
      const datos = {
        comunidad: req.body.comunidad || dir,
        direccion: dir,
        tipo_via: req.body.tipo_via || "(C)",
        earth: req.body.earth || "NO",
        administrador: req.body.administrador || "",
        telefono_administrador: String(req.body.telefono_administrador || "").replace(/\D/g, ""),
        email_administrador: req.body.email_administrador || "",
        presidente: req.body.presidente || "",
        telefono_presidente: String(req.body.telefono_presidente || "").replace(/\D/g, ""),
        email_presidente: req.body.email_presidente || "",
        fase_presupuesto: "01_SOLICITUD",
        fecha_solicitud_pto: new Date().toISOString().slice(0, 10),
      };
      await crearComunidad(datos);
      res.redirect(urlT(token, "/presupuestos/expediente", { id: ccppId(dir) }));
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
      // Vecinos (de pestaña "expedientes" de index.cjs)
      let vecinos = [];
      try {
        const todos = await leerExpedientes();
        vecinos = vecinosDeComunidad(todos, comu);
      } catch (e) {
        console.warn("[presupuestos] no se pudieron leer expedientes:", e.message);
      }
      const datalists = construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      sendHtml(res, pageHtml(titulo,
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        vistaFicha(comu, vecinos, datalists, token),
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
      const def = PTO_FASES[fase];
      if (def && def.siguiente) {
        comu.fase_presupuesto = def.siguiente;
        const hoy = new Date().toISOString().slice(0, 10);
        if (def.siguiente === "02_VISITA"     && !comu.fecha_visita_pto)             comu.fecha_visita_pto = hoy;
        if (def.siguiente === "03_ENVIO"      && !comu.fecha_envio_pto)              comu.fecha_envio_pto  = hoy;
        if (def.siguiente === "04_SEGUIMIENTO" && !comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        await actualizarComunidad(comu._rowIndex, comu);
      }
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) {
      console.error("[presupuestos] /avanzar:", e.message);
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
      comu.fase_presupuesto = "ENTREGADO";
      comu.decision_pto = "ACEPTADO";
      comu.fecha_decision_pto = new Date().toISOString().slice(0, 10);
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
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
      comu.fecha_decision_pto = new Date().toISOString().slice(0, 10);
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  console.log("[presupuestos] Módulo cargado. Rutas: /presupuestos, /presupuestos/nuevo, /presupuestos/expediente");

}; // end module.exports
