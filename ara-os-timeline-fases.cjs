// ============================================================
// ARA OS — Timeline de fases por obra · v0.2.0 (17/05/2026)
//
// v0.2.0 — Umbrales configurables desde UI:
//   · Tabla nueva `ara_os_umbrales_fase` (fase, aviso, critico,
//     actualizado_en, actualizado_por). Al primer arranque se
//     siembra con los DEFAULTS hardcodeados aquí abajo.
//   · GET /api/ara-os/umbrales-fase   → devuelve mapa { fase → {aviso, critico} }
//   · POST /api/ara-os/umbrales-fase  → actualiza una fase, invalida cache
//   · Cache en memoria del proceso (TTL infinito; se invalida en
//     POST y al reiniciar).
//
// v0.1.0 — Sprint Timeline base.
// Trackea el histórico de cambios de fase de cada obra:
//   - Cuándo entra a cada fase
//   - Cuántos días pasa en cada fase
//   - KPI principal: días desde primer 12_INICIO_OBRA hasta primer
//     17_COBRO_EMASESA
//
// require("./ara-os-timeline-fases.cjs")(app);
//
// Endpoints expuestos:
//   GET  /api/ara-os/timeline?ccpp_id=XXX           (timeline de 1 obra)
//   GET  /api/ara-os/obras/metricas                 (métricas de todas)
//   POST /api/ara-os/admin/timeline-stamping-inicial (one-shot inicial)
//
// HOOKS desde otros módulos:
//   Este módulo expone `registrarEventoFase` en module.exports.
//   ara-os-panel-obras.cjs lo importa y llama en los endpoints
//   /ot/avanzar-fase y /ot/retroceder-fase y al crear la OT.
//
//   Patrón de uso:
//     const timelineFases = require("./ara-os-timeline-fases.cjs");
//     await timelineFases.registrarEventoFase({
//       ccpp_id: "...", comunidad: "...",
//       fase_origen: "12_INICIO_OBRA",   // null/"" si es evento inicial
//       fase_destino: "13_EN_EJECUCION",
//       tipo: "avance",   // "avance" | "retroceso" | "inicial" | "stamping"
//     });
//
//   NO BLOQUEANTE: si Sheets falla, solo loggea warning, no lanza.
//
// Tabla nueva en Sheet: `obra_fase_historial`
//   ccpp_id | comunidad | fase_origen | fase_destino | fecha_evento
//   | tipo_evento | usuario
//
// Filosofía: append-only. Nunca se borra ni edita. Los retrocesos
// quedan como un evento más. El "estado actual" se deduce del último
// evento.
// ============================================================

const HISTORIAL_HEADERS = [
  "ccpp_id",
  "comunidad",
  "fase_origen",
  "fase_destino",
  "fecha_evento",
  "tipo_evento",   // avance | retroceso | inicial | stamping
  "usuario",
];

// ============================================================
// v0.2.0 — Umbrales por fase (configurables desde UI)
// ============================================================
const UMBRALES_HEADERS = [
  "fase",
  "aviso",
  "critico",
  "actualizado_en",
  "actualizado_por",
];

// Defaults iniciales — se siembran en la tabla si está vacía al
// primer arranque del backend. Tras la siembra, son la base que el
// usuario puede editar desde la UI.
const UMBRALES_DEFAULTS = {
  "01_CONTACTO":           { aviso: 7,  critico: 14 },
  "02_VISITA":             { aviso: 3,  critico: 7  },
  "03_ENVIO_PTO":          { aviso: 14, critico: 30 },
  "04_ACEPTACION_PTO":     { aviso: 30, critico: 60 },
  "05_DOCUMENTACION":      { aviso: 7,  critico: 14 },
  "06_VISITA_EMASESA":     { aviso: 14, critico: 30 },
  "07_PTE_CYCP":           { aviso: 30, critico: 90 },
  "08_CYCP":               { aviso: 14, critico: 30 },
  "09_FINANCIACION":       { aviso: 14, critico: 30 },
  "10_BLOQUEOS":           { aviso: 7,  critico: 14 },
  "11_PREPARADA":          { aviso: 7,  critico: 14 },
  "12_INICIO_OBRA":        { aviso: 5,  critico: 14 },
  "13_EN_EJECUCION":       { aviso: 21, critico: 45 },
  "14_FINALIZADA":         { aviso: 14, critico: 30 },
  "15_VISITA_INSPECTOR":   { aviso: 14, critico: 30 },
  "16_MONTAJE_CONTADORES": { aviso: 14, critico: 30 },
  "17_COBRO_EMASESA":      { aviso: 30, critico: 60 },
  "19_INCIDENCIAS":        { aviso: 7,  critico: 14 },
};

const SECUENCIA_OT_LOCAL = [
  "12_INICIO_OBRA",
  "13_EN_EJECUCION",
  "14_FINALIZADA",
  "15_VISITA_INSPECTOR",
  "16_MONTAJE_CONTADORES",
  "17_COBRO_EMASESA",
  "18_COBRADA",
];

// Cliente Sheets (factory perezoso, igual que el resto de módulos)
let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const { google } = require("googleapis");
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

function colLetterFromIdx(i) {
  let s = ""; let n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

async function leerHojaSafe(rango) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return res.data.values || [];
  } catch (err) {
    console.warn("[timeline-fases/leerHojaSafe]", rango, err.message);
    return [];
  }
}

let _pestanaHistorialOK = null;
async function asegurarPestanaHistorial() {
  if (_pestanaHistorialOK === true) return true;
  try {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    });
    const existe = (meta.data.sheets || []).some(s =>
      s.properties && s.properties.title === "obra_fase_historial"
    );
    const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);

    if (!existe) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "obra_fase_historial" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `obra_fase_historial!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [HISTORIAL_HEADERS] },
      });
      console.log("[timeline-fases] Tab obra_fase_historial creada");
    } else {
      // Verificar headers
      const headersActuales = await leerHojaSafe(`obra_fase_historial!A1:${lastCol}1`);
      const filaActual = headersActuales[0] || [];
      const desactualizada = filaActual.length < HISTORIAL_HEADERS.length ||
        HISTORIAL_HEADERS.some((h, i) => filaActual[i] !== h);
      if (desactualizada) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `obra_fase_historial!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [HISTORIAL_HEADERS] },
        });
        console.log("[timeline-fases] Headers de obra_fase_historial actualizados");
      }
    }
    _pestanaHistorialOK = true;
    return true;
  } catch (err) {
    console.warn("[timeline-fases/asegurarPestanaHistorial]", err.message);
    _pestanaHistorialOK = null;
    return false;
  }
}

// ============================================================
// API PÚBLICA: registrarEventoFase
// Llamado desde panel-obras (avanzar/retroceder/crear OT) y desde
// el endpoint admin de stamping inicial.
// NO BLOQUEANTE: si falla, solo loggea warning.
// ============================================================
async function registrarEventoFase({ ccpp_id, comunidad, fase_origen, fase_destino, tipo, usuario }) {
  if (!ccpp_id || !fase_destino) {
    console.warn("[timeline-fases/registrarEventoFase] Faltan campos obligatorios:",
      { ccpp_id, fase_destino });
    return false;
  }
  if (tipo && !["avance", "retroceso", "inicial", "stamping"].includes(tipo)) {
    console.warn("[timeline-fases/registrarEventoFase] Tipo desconocido:", tipo);
  }
  try {
    await asegurarPestanaHistorial();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);
    const ahora = new Date().toISOString();
    const fila = [
      String(ccpp_id),
      String(comunidad || ""),
      String(fase_origen || ""),
      String(fase_destino),
      ahora,
      String(tipo || "avance"),
      String(usuario || "ARA OS"),
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `obra_fase_historial!A:${lastCol}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });
    return true;
  } catch (err) {
    console.warn("[timeline-fases/registrarEventoFase] No se pudo registrar:",
      ccpp_id, fase_destino, err.message);
    return false;
  }
}

// ============================================================
// HELPER: leer todo el historial filtrado por ccpp_id
// ============================================================
async function leerHistorialObra(ccpp_id) {
  await asegurarPestanaHistorial();
  const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);
  const rows = await leerHojaSafe(`obra_fase_historial!A2:${lastCol}`);
  const eventos = [];
  for (const row of rows) {
    if (String(row[0] || "").trim() !== String(ccpp_id).trim()) continue;
    const obj = {};
    for (let i = 0; i < HISTORIAL_HEADERS.length; i++) {
      obj[HISTORIAL_HEADERS[i]] = row[i] || "";
    }
    eventos.push(obj);
  }
  eventos.sort((a, b) => String(a.fecha_evento).localeCompare(String(b.fecha_evento)));
  return eventos;
}

// ============================================================
// HELPER: leer historial COMPLETO (todas las obras) y agruparlo
// por ccpp_id para procesar todas las métricas de una vez.
// ============================================================
async function leerHistorialAgrupado() {
  await asegurarPestanaHistorial();
  const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);
  const rows = await leerHojaSafe(`obra_fase_historial!A2:${lastCol}`);
  const mapa = new Map();
  for (const row of rows) {
    const ccpp = String(row[0] || "").trim();
    if (!ccpp) continue;
    const obj = {};
    for (let i = 0; i < HISTORIAL_HEADERS.length; i++) {
      obj[HISTORIAL_HEADERS[i]] = row[i] || "";
    }
    if (!mapa.has(ccpp)) mapa.set(ccpp, []);
    mapa.get(ccpp).push(obj);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => String(a.fecha_evento).localeCompare(String(b.fecha_evento)));
  }
  return mapa;
}

// ============================================================
// v0.2.0 — TABLA UMBRALES (configurable desde UI)
// ============================================================

let _pestanaUmbralesOK = null;
async function asegurarPestanaUmbrales() {
  if (_pestanaUmbralesOK === true) return true;
  try {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    });
    const existe = (meta.data.sheets || []).some(s =>
      s.properties && s.properties.title === "ara_os_umbrales_fase"
    );
    const lastCol = colLetterFromIdx(UMBRALES_HEADERS.length - 1);

    if (!existe) {
      // Crear pestaña + sembrar con defaults
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "ara_os_umbrales_fase" } } }],
        },
      });
      const ahora = new Date().toISOString();
      const filasSiembra = Object.entries(UMBRALES_DEFAULTS).map(([fase, u]) => [
        fase,
        String(u.aviso),
        String(u.critico),
        ahora,
        "ARA OS · default",
      ]);
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_umbrales_fase!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [UMBRALES_HEADERS] },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_umbrales_fase!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: filasSiembra },
      });
      console.log("[timeline-fases] Tab ara_os_umbrales_fase creada y sembrada con defaults");
    } else {
      // Verificar headers
      const headersActuales = await leerHojaSafe(`ara_os_umbrales_fase!A1:${lastCol}1`);
      const filaActual = headersActuales[0] || [];
      const desactualizada = filaActual.length < UMBRALES_HEADERS.length ||
        UMBRALES_HEADERS.some((h, i) => filaActual[i] !== h);
      if (desactualizada) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `ara_os_umbrales_fase!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [UMBRALES_HEADERS] },
        });
        console.log("[timeline-fases] Headers de ara_os_umbrales_fase actualizados");
      }
    }
    _pestanaUmbralesOK = true;
    return true;
  } catch (err) {
    console.warn("[timeline-fases/asegurarPestanaUmbrales]", err.message);
    _pestanaUmbralesOK = null;
    return false;
  }
}

// Cache en memoria. Se invalida con cualquier escritura.
let _umbralesCache = null;
async function leerUmbrales() {
  if (_umbralesCache) return _umbralesCache;
  await asegurarPestanaUmbrales();
  const lastCol = colLetterFromIdx(UMBRALES_HEADERS.length - 1);
  const rows = await leerHojaSafe(`ara_os_umbrales_fase!A2:${lastCol}`);
  const out = {};
  for (const row of rows) {
    const fase = String(row[0] || "").trim();
    if (!fase) continue;
    const aviso = parseInt(row[1], 10);
    const critico = parseInt(row[2], 10);
    if (Number.isFinite(aviso) && Number.isFinite(critico)) {
      out[fase] = { aviso, critico };
    }
  }
  // Si la tabla está vacía o le faltan fases, completar con defaults
  // (defensivo: nunca devolvemos null/incompleto para una fase conocida).
  for (const [fase, u] of Object.entries(UMBRALES_DEFAULTS)) {
    if (!out[fase]) out[fase] = { ...u };
  }
  _umbralesCache = out;
  return out;
}

async function actualizarUmbral(fase, aviso, critico, usuario) {
  if (!fase) throw new Error("Falta fase");
  const a = parseInt(aviso, 10);
  const c = parseInt(critico, 10);
  if (!Number.isFinite(a) || a < 0) throw new Error("Aviso inválido");
  if (!Number.isFinite(c) || c < 0) throw new Error("Crítico inválido");
  if (a >= c) throw new Error("El umbral de aviso debe ser menor que el crítico");

  await asegurarPestanaUmbrales();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(UMBRALES_HEADERS.length - 1);
  const rows = await leerHojaSafe(`ara_os_umbrales_fase!A2:${lastCol}`);
  const ahora = new Date().toISOString();

  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() === String(fase).trim()) {
      rowIndex = i + 2;
      break;
    }
  }
  const fila = [
    String(fase),
    String(a),
    String(c),
    ahora,
    String(usuario || "ARA OS"),
  ];

  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `ara_os_umbrales_fase!A${rowIndex}:${lastCol}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `ara_os_umbrales_fase!A:${lastCol}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });
  }
  // Invalidar cache (próximo GET la repuebla)
  _umbralesCache = null;
  return { fase, aviso: a, critico: c, actualizado_en: ahora };
}

// ============================================================
// CÁLCULO DE MÉTRICAS para una obra dada sus eventos cronológicos
//
// Devuelve:
// {
//   fase_actual: "13_EN_EJECUCION",
//   fecha_entrada_fase_actual: "2026-05-10T...",
//   dias_en_fase_actual: 6,
//   dias_hasta_cobro: 42,        // si llegó a 17 desde 12
//   dias_hasta_cobro_pendiente: 30, // si NO llegó pero pasó por 12 (días desde 12)
//   duraciones_por_fase: { "12_INICIO_OBRA": 5, "13_EN_EJECUCION": 12, ... },
//   tiene_historial: true,
// }
// ============================================================
function calcularMetricas(eventos, fechaReferencia) {
  const ref = fechaReferencia ? new Date(fechaReferencia) : new Date();
  const out = {
    fase_actual: null,
    fecha_entrada_fase_actual: null,
    dias_en_fase_actual: null,
    dias_hasta_cobro: null,
    dias_hasta_cobro_pendiente: null,
    duraciones_por_fase: {},
    eventos_totales: eventos.length,
    tiene_historial: eventos.length > 0,
  };
  if (!eventos.length) return out;

  // Estado actual = última fase_destino
  const ultimo = eventos[eventos.length - 1];
  out.fase_actual = ultimo.fase_destino;
  out.fecha_entrada_fase_actual = ultimo.fecha_evento;
  out.dias_en_fase_actual = diasEntre(ultimo.fecha_evento, ref);

  // Duraciones por fase: sumar todos los tramos
  // Cada evento marca la entrada a `fase_destino`. El tramo dura hasta
  // el siguiente evento (o hasta `ref` si es el último).
  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    const inicio = ev.fecha_evento;
    const fin = (i + 1 < eventos.length) ? eventos[i + 1].fecha_evento : ref.toISOString();
    const dias = diasEntre(inicio, fin);
    out.duraciones_por_fase[ev.fase_destino] =
      (out.duraciones_por_fase[ev.fase_destino] || 0) + dias;
  }

  // KPI días hasta cobro: PRIMERA entrada a 12 → PRIMERA entrada a 17
  const primerInicio = eventos.find(e => e.fase_destino === "12_INICIO_OBRA");
  const primerCobro  = eventos.find(e => e.fase_destino === "17_COBRO_EMASESA");
  if (primerInicio && primerCobro) {
    out.dias_hasta_cobro = diasEntre(primerInicio.fecha_evento, primerCobro.fecha_evento);
  } else if (primerInicio && !primerCobro) {
    // Aún en proceso: días desde inicio hasta ahora
    out.dias_hasta_cobro_pendiente = diasEntre(primerInicio.fecha_evento, ref);
  }

  return out;
}

function diasEntre(fechaA, fechaB) {
  const a = new Date(fechaA);
  const b = new Date(fechaB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

// ============================================================
// FACTORY · monta los endpoints sobre el app de Express
// ============================================================
function install(app) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";
  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  const express = require("express");
  const jsonBodyParser = express.json({ limit: "1mb" });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/timeline?ccpp_id=XXX
  // Devuelve el timeline de una obra + métricas calculadas.
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/timeline", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/timeline", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const eventos = await leerHistorialObra(ccpp_id);
      const metricas = calcularMetricas(eventos);

      res.json({
        ok: true,
        version: "0.1.0",
        ccpp_id,
        eventos,
        metricas,
      });
    } catch (err) {
      console.error("[timeline]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/obras/metricas
  // Devuelve un mapa ccpp_id → métricas para todas las obras con
  // historial. Útil para enriquecer el panel/kanban.
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/obras/metricas", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras/metricas", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const mapa = await leerHistorialAgrupado();
      const out = {};
      for (const [ccpp_id, eventos] of mapa.entries()) {
        out[ccpp_id] = calcularMetricas(eventos);
      }
      res.json({
        ok: true,
        version: "0.1.0",
        total_obras_con_historial: Object.keys(out).length,
        metricas: out,
      });
    } catch (err) {
      console.error("[obras/metricas]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/ara-os/admin/timeline-stamping-inicial
  // ONE-SHOT: para todas las obras que NO tengan eventos en el
  // historial, crea una fila tipo=stamping con la fase_actual de
  // ordenes_trabajo y fecha=ahora. Idempotente: si ya hay eventos
  // para una obra, no se hace nada.
  //
  // Body opcional: { dry_run: true } para ver qué haría sin escribir.
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/admin/timeline-stamping-inicial", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/admin/timeline-stamping-inicial", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const dryRun = !!(req.body && req.body.dry_run);

      // 1) Leer ordenes_trabajo: comunidad + fase_actual
      // Columnas: A=comunidad, B=fase_ot
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:K");
      // 2) Leer comunidades para resolver ccpp_id a partir de comunidad
      // Columna A es comunidad/direccion, depende del setup. Replicar
      // la lógica de panel-obras: ccpp_id se deriva de la dirección.
      const rowsCom = await leerHojaSafe("comunidades!A2:BD");
      const mapaCom = new Map();   // comunidad → {ccpp_id, direccion}
      for (const r of rowsCom) {
        const comunidad = String(r[0] || "").trim();
        if (!comunidad) continue;
        // ccpp_id se calcula desde la dirección normalizada (igual que
        // panel-obras hace con ccppId()). Aquí lo recalculamos.
        const direccion = String(r[1] || comunidad);
        mapaCom.set(comunidad, { comunidad, direccion });
      }

      // 3) Leer historial agrupado para saber cuáles ya tienen eventos
      const historialMapa = await leerHistorialAgrupado();

      const acciones = []; // { ccpp_id, comunidad, fase, ya_tenia }
      for (const row of rowsOT) {
        const comunidad = String(row[0] || "").trim();
        const fase = String(row[1] || "").trim();
        if (!comunidad || !fase) continue;

        // Calcular ccpp_id usando misma normalización que panel-obras
        const datosCom = mapaCom.get(comunidad);
        const direccion = datosCom?.direccion || comunidad;
        const ccpp_id = ccppId(direccion);

        const yaTeniaEventos = historialMapa.has(ccpp_id) &&
                               historialMapa.get(ccpp_id).length > 0;

        acciones.push({
          ccpp_id,
          comunidad,
          fase_actual: fase,
          ya_tenia_historial: yaTeniaEventos,
          se_creara_stamping: !yaTeniaEventos,
        });
      }

      let stamped = 0;
      if (!dryRun) {
        for (const a of acciones) {
          if (a.se_creara_stamping) {
            const ok = await registrarEventoFase({
              ccpp_id: a.ccpp_id,
              comunidad: a.comunidad,
              fase_origen: "",
              fase_destino: a.fase_actual,
              tipo: "stamping",
              usuario: "ADMIN · stamping-inicial",
            });
            if (ok) stamped++;
          }
        }
      }

      res.json({
        ok: true,
        version: "0.1.0",
        dry_run: dryRun,
        total_obras_revisadas: acciones.length,
        obras_con_historial_previo: acciones.filter(a => a.ya_tenia_historial).length,
        obras_a_stampear: acciones.filter(a => a.se_creara_stamping).length,
        obras_stampedas: stamped,
        detalles: acciones.slice(0, 200),   // límite para no devolver 1000 filas
      });
    } catch (err) {
      console.error("[admin/timeline-stamping-inicial]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // v0.2.0 — GET /api/ara-os/umbrales-fase
  // Devuelve un mapa { fase → {aviso, critico} } leyendo desde
  // la tabla ara_os_umbrales_fase (con cache en memoria).
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/umbrales-fase", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/umbrales-fase", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const umbrales = await leerUmbrales();
      res.json({ ok: true, version: "0.2.0", umbrales });
    } catch (err) {
      console.error("[umbrales-fase GET]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // v0.2.0 — POST /api/ara-os/umbrales-fase
  // Body: { fase: "04_ACEPTACION_PTO", aviso: 30, critico: 60, usuario? }
  // Actualiza o crea la fila para esa fase. Invalida cache.
  // ─────────────────────────────────────────────────────────────
  app.post("/api/ara-os/umbrales-fase", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { fase, aviso, critico, usuario } = req.body || {};
      const r = await actualizarUmbral(fase, aviso, critico, usuario || "ARA OS");
      res.json({ ok: true, version: "0.2.0", ...r });
    } catch (err) {
      console.error("[umbrales-fase POST]", err);
      res.status(400).json({ error: err.message });
    }
  });

  console.log("[timeline-fases] Endpoints montados (v0.2.0)");
}

// Helper de normalización ccpp_id, COPIA EXACTA de panel-obras.cjs
// para mantener consistencia entre módulos.
function ccppId(direccion) {
  const crypto = require("crypto");
  const slug = String(direccion || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const hash = crypto
    .createHash("md5")
    .update(direccion || "")
    .digest("hex")
    .slice(0, 6);
  return `ccpp_${slug}_${hash}`;
}

// ============================================================
// EXPORT
// ============================================================
// El módulo se usa de dos formas:
//   1) require("...")(app)         → install(app), monta endpoints
//   2) require("...").registrarEventoFase(...) → hook desde otros módulos
//
// Para soportar ambas, exportamos una función que actúa como factory
// pero con métodos adjuntos.
module.exports = install;
module.exports.registrarEventoFase = registrarEventoFase;
module.exports.calcularMetricas = calcularMetricas;
module.exports.leerHistorialObra = leerHistorialObra;
module.exports.HISTORIAL_HEADERS = HISTORIAL_HEADERS;
// v0.2.0
module.exports.leerUmbrales = leerUmbrales;
module.exports.actualizarUmbral = actualizarUmbral;
module.exports.UMBRALES_DEFAULTS = UMBRALES_DEFAULTS;
