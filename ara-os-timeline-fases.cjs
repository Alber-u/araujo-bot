// ============================================================
// ARA OS — Timeline de fases por obra · v0.3.0 (17/05/2026)
//
// v0.3.0 — Stamping inteligente con fechas reales:
//   · /admin/timeline-stamping-inicial acepta `forzar: true` que
//     borra el historial y reescribe el stamping de cada obra con
//     la fecha REAL del hito de su fase actual (mismo criterio que
//     `atascado_humano` del panel: fecha_envio_pto para fase 04,
//     fecha_aceptacion_pto para fase 05, etc.).
//   · Para fases JM (09/10/11) sin hito fechado, se usa
//     ultima_modificacion del Sheet o, en último caso, "hoy".
//   · Sin `forzar`, el endpoint sigue siendo idempotente:
//     solo crea stamping para obras SIN historial previo.
//
// v0.2.0 — Umbrales configurables desde UI.
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
// v0.3.0 — Resolución de fecha real de entrada en fase
//
// Replica la misma lógica que ara-os-panel-obras.cjs usa para
// `atascado_humano`: cada fase tiene un hito documentado en el
// Sheet (fecha_envio_pto, fecha_aceptacion_pto, etc.).
//
// Si la fecha del hito no existe (campo vacío) o no aplica para
// esa fase, devuelve null (el caller decidirá fallback).
// ============================================================
function resolverFechaEntradaReal(obraComunidades, fase) {
  if (!obraComunidades || !fase) return null;
  const get = (k) => {
    const v = obraComunidades[k];
    if (!v) return null;
    const s = String(v).trim();
    return s ? s : null;
  };
  switch (fase) {
    case "01_CONTACTO":
    case "02_VISITA":
    case "03_ENVIO_PTO":
      return get("fecha_solicitud_pto");
    case "04_ACEPTACION_PTO":
      return get("fecha_envio_pto");
    case "05_DOCUMENTACION":
      return get("fecha_aceptacion_pto");
    case "06_VISITA_EMASESA":
    case "07_PTE_CYCP":
      return get("fecha_documentacion_completa");
    case "08_CYCP":
      // Si la CYCP está cerrada, ese es el hito; si no, contratos
      return get("fecha_cycp_completa") || get("fecha_envio_contratos_pagos");
    // Fases JM (09, 10, 11) no tienen hito fechado en comunidades;
    // se usará ultima_modificacion o fallback al caller.
    case "09_FINANCIACION":
    case "10_BLOQUEOS":
    case "11_PREPARADA":
      return get("ultima_modificacion") || null;
    // Fases OT (12+) viven en ordenes_trabajo, no en comunidades.
    // El caller debe usar la fila de ordenes_trabajo.
    default:
      return null;
  }
}

// Convierte fecha en formato variado del Sheet a ISO. Acepta:
// - ISO ya hecho: "2026-05-10T..."
// - YYYY-MM-DD
// - DD/MM/YYYY
// - DD-MM-YYYY
function normalizarFechaAISO(fechaRaw) {
  if (!fechaRaw) return null;
  const s = String(fechaRaw).trim();
  if (!s) return null;
  // ISO ya
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString();
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T12:00:00.000Z");
    return isNaN(d) ? null : d.toISOString();
  }
  // DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, dd, mm, yyyy] = m;
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    const iso = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}T12:00:00.000Z`;
    const d = new Date(iso);
    return isNaN(d) ? null : d.toISOString();
  }
  // Último intento: que JS lo parsee
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}

// Borra TODAS las filas de obra_fase_historial (preserva headers).
// Se usa solo cuando forzar=true en el stamping.
async function borrarTodoElHistorial() {
  await asegurarPestanaHistorial();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);
  // Estrategia: clear todo el rango excepto fila 1 (headers).
  await sheets.spreadsheets.values.clear({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `obra_fase_historial!A2:${lastCol}`,
  });
  return true;
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
  //
  // v0.3.0 — Soporta dos modos:
  //
  //   Modo IDEMPOTENTE (default):
  //     · Solo procesa obras sin historial previo.
  //     · Crea una fila tipo=stamping con la fase actual y la fecha
  //       REAL del hito de esa fase (fecha_envio_pto, etc.). Si no
  //       hay fecha real, usa "ahora".
  //
  //   Modo FORZAR (body: { forzar: true }):
  //     · BORRA todo obra_fase_historial (preserva headers).
  //     · Vuelve a stampear TODAS las obras desde cero con las
  //       fechas reales del Sheet.
  //     · Útil tras un primer stamping con fechas=hoy para corregir.
  //
  //   Modo DRY_RUN ({ dry_run: true }):
  //     · No escribe nada. Devuelve qué haría.
  //     · Compatible con forzar para previsualizar el borrado.
  //
  // Lee TANTO comunidades (fases 01-11) COMO ordenes_trabajo (12+).
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/admin/timeline-stamping-inicial", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/admin/timeline-stamping-inicial", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const dryRun = !!(req.body && req.body.dry_run);
      const forzar = !!(req.body && req.body.forzar);

      // 1) Leer comunidades (fases 01-11) con headers para tener acceso
      //    a fecha_envio_pto, fecha_aceptacion_pto, etc.
      const rowsComRaw = await leerHojaSafe("comunidades!A1:BD");
      const headersCom = rowsComRaw[0] || [];
      const dataCom = rowsComRaw.slice(1);
      function rowToObjCom(row) {
        const out = {};
        for (let i = 0; i < headersCom.length; i++) {
          out[String(headersCom[i] || "").trim()] = row[i];
        }
        return out;
      }

      // 2) Leer ordenes_trabajo (fases 12+) con headers
      const rowsOTRaw = await leerHojaSafe("ordenes_trabajo!A1:AA");
      const headersOT = rowsOTRaw[0] || [];
      const dataOT = rowsOTRaw.slice(1);
      function rowToObjOT(row) {
        const out = {};
        for (let i = 0; i < headersOT.length; i++) {
          out[String(headersOT[i] || "").trim()] = row[i];
        }
        return out;
      }

      // Mapa comunidad → fila OT (para detectar obras que ya están en OT)
      const mapaOT = new Map();
      for (const row of dataOT) {
        const o = rowToObjOT(row);
        const comunidad = String(o.comunidad || row[0] || "").trim();
        if (comunidad) mapaOT.set(comunidad, o);
      }

      // 3) Leer historial agrupado para detectar obras con eventos previos
      const historialMapa = forzar
        ? new Map()   // si forzar, ignoramos historial (vamos a borrarlo)
        : await leerHistorialAgrupado();

      // 4) Construir lista de obras a procesar
      // Estrategia:
      //   - Para cada comunidad, su fase REAL es:
      //       · si tiene fila OT con fase_ot rellena → la fase OT (12+)
      //       · si no → la fase_presupuesto de comunidades (01-11)
      //   - Si la obra no tiene NI fila OT NI fase_presupuesto → se ignora.
      const acciones = [];
      for (const row of dataCom) {
        const obra = rowToObjCom(row);
        const comunidad = String(obra.comunidad || row[0] || "").trim();
        if (!comunidad) continue;
        const direccion = obra.direccion || comunidad;
        const ccpp_id = ccppId(direccion);

        const otRow = mapaOT.get(comunidad);
        const faseOT = otRow ? String(otRow.fase_ot || "").trim() : "";
        const fasePresup = String(obra.fase_presupuesto || "").trim();
        const fase = faseOT || fasePresup;
        if (!fase) continue;

        // Resolver fecha real:
        //   - Si fase es OT (12+), usar fila OT (fecha_inicio_obra o ultima_modificacion)
        //   - Si fase es 01-11, usar resolverFechaEntradaReal sobre `obra`
        let fechaRealRaw = null;
        if (faseOT && otRow) {
          // Para fase 12 INICIO_OBRA preferimos fecha_inicio_obra
          fechaRealRaw = otRow.fecha_inicio_obra || otRow.ultima_modificacion || null;
        } else {
          fechaRealRaw = resolverFechaEntradaReal(obra, fase);
        }
        const fechaISO = normalizarFechaAISO(fechaRealRaw);

        const yaTeniaEventos = !forzar && historialMapa.has(ccpp_id) &&
                               historialMapa.get(ccpp_id).length > 0;

        acciones.push({
          ccpp_id,
          comunidad,
          fase,
          fecha_real_raw: fechaRealRaw || null,
          fecha_iso: fechaISO || null,
          usa_fallback_hoy: !fechaISO,
          ya_tenia_historial: yaTeniaEventos,
          se_creara_stamping: !yaTeniaEventos,
        });
      }

      let borradas = 0;
      let stamped = 0;
      let conFechaReal = 0;
      let conFechaHoy = 0;

      if (!dryRun) {
        // 5) Si forzar: borrar todo el historial primero
        if (forzar) {
          await borrarTodoElHistorial();
          borradas = 1;   // flag, no contamos filas exactas
        }
        // 6) Crear stampings
        for (const a of acciones) {
          if (!a.se_creara_stamping) continue;
          // Construir fila DIRECTAMENTE (no usamos registrarEventoFase
          // porque éste fija fecha=ahora; aquí necesitamos fecha custom)
          try {
            await asegurarPestanaHistorial();
            const sheets = getSheetsClient();
            const lastCol = colLetterFromIdx(HISTORIAL_HEADERS.length - 1);
            const fechaEvento = a.fecha_iso || new Date().toISOString();
            const fila = [
              String(a.ccpp_id),
              String(a.comunidad),
              "",   // fase_origen (vacío para stamping)
              String(a.fase),
              fechaEvento,
              "stamping",
              forzar ? "ADMIN · stamping-forzado v0.3.0" : "ADMIN · stamping-inicial",
            ];
            await sheets.spreadsheets.values.append({
              spreadsheetId: process.env.GOOGLE_SHEETS_ID,
              range: `obra_fase_historial!A:${lastCol}`,
              valueInputOption: "RAW",
              insertDataOption: "INSERT_ROWS",
              requestBody: { values: [fila] },
            });
            stamped++;
            if (a.fecha_iso) conFechaReal++; else conFechaHoy++;
          } catch (errStamp) {
            console.warn("[stamping] Falló para", a.ccpp_id, errStamp.message);
          }
        }
      } else {
        // En dry_run, contar lo que pasaría
        for (const a of acciones) {
          if (!a.se_creara_stamping) continue;
          if (a.fecha_iso) conFechaReal++; else conFechaHoy++;
        }
      }

      res.json({
        ok: true,
        version: "0.3.0",
        dry_run: dryRun,
        forzar: forzar,
        historial_borrado_antes: forzar && !dryRun,
        total_obras_revisadas: acciones.length,
        obras_con_historial_previo: acciones.filter(a => a.ya_tenia_historial).length,
        obras_a_stampear: acciones.filter(a => a.se_creara_stamping).length,
        obras_stampedas: stamped,
        con_fecha_real: conFechaReal,
        con_fecha_hoy_fallback: conFechaHoy,
        detalles: acciones.slice(0, 200),   // límite para no devolver miles de filas
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

  console.log("[timeline-fases] Endpoints montados (v0.3.0)");
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
