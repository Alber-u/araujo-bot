/**
 * ara-os-tags-holded.cjs
 * --------------------------------------------------------------
 * Gestión de tags Holded para comunidades Plan 5.
 *
 * Pestaña: comunidades_tags_holded
 *   tag_id          (string único)
 *   ccpp_id         (FK comunidades.ccpp_id)
 *   tag             (texto exacto del tag en Holded)
 *   created_at
 *   created_by
 *   borrado         ("TRUE" | "FALSE")
 *
 * Endpoints:
 *   GET    /api/ara-os/comunidades/tags-holded                  → todos
 *   GET    /api/ara-os/comunidades/:ccpp_id/tags-holded         → de una comunidad
 *   POST   /api/ara-os/comunidades/:ccpp_id/tags-holded         → crear tag
 *   DELETE /api/ara-os/comunidades/tags-holded/:tag_id          → borrar (soft)
 *   GET    /api/ara-os/comunidades/tags-holded/ping             → diagnóstico
 *
 * v0.1.0 (21/05/2026) — Primera versión, replica patrón
 *   obras-otras-entradas-cuenta para comunidades de Plan 5.
 * --------------------------------------------------------------
 *
 * Uso (en index.cjs):
 *   require("./ara-os-tags-holded.cjs")(app);
 */
"use strict";

const { google } = require("googleapis");

const SHEET_ID = process.env.SHEET_ID || "1Fj94YDpFinL8HL7VX2zgzrF8-FQPvtLShxOaxZW3Mps";
const TAB_TAGS = "comunidades_tags_holded";
const TAGS_HEADERS = [
  "tag_id",       // A
  "ccpp_id",      // B
  "tag",          // C
  "created_at",   // D
  "created_by",   // E
  "borrado",      // F  ("TRUE" | "FALSE")
];

// ============================================================
// Cliente Google Sheets (lazy)
// ============================================================
let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth: oauth2 });
  return _sheetsClient;
}

function colLetterFromIdx(i) {
  let s = "";
  let n = i;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

function filaAObjeto(fila, headers) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = fila[i] != null ? String(fila[i]) : "";
  });
  return obj;
}

function objetoAFila(obj, headers) {
  return headers.map((h) => (obj[h] != null ? String(obj[h]) : ""));
}

function nowIso() {
  return new Date().toISOString();
}

function genTagId() {
  return `TH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Asegurar pestaña (idempotente)
// ============================================================
let _pestanaOk = false;

async function asegurarPestana() {
  if (_pestanaOk) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existentes = (meta.data.sheets || []).map((s) => s.properties.title);

  if (!existentes.includes(TAB_TAGS)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB_TAGS } } }],
      },
    });
  }

  // Asegurar cabecera
  const lastCol = colLetterFromIdx(TAGS_HEADERS.length - 1);
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_TAGS}!A1:${lastCol}1`,
  });
  if (!head.data.values || head.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_TAGS}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [TAGS_HEADERS] },
    });
  }
  _pestanaOk = true;
}

// ============================================================
// Caché en memoria (TTL 5s)
// ============================================================
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5_000;

function invalidarCache() {
  _cache = null;
  _cacheTs = 0;
}

async function leerTags(ccpp_id = null) {
  if (_cache && (Date.now() - _cacheTs) < CACHE_TTL_MS) {
    if (ccpp_id) return _cache.filter((t) => t.ccpp_id === ccpp_id);
    return _cache;
  }
  await asegurarPestana();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(TAGS_HEADERS.length - 1);
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_TAGS}!A2:${lastCol}`,
    });
    const filas = r.data.values || [];
    const todas = filas
      .map((fila, i) => {
        const obj = filaAObjeto(fila, TAGS_HEADERS);
        obj._rowIndex = i + 2;
        return obj;
      })
      .filter((t) => t.tag_id && t.borrado !== "TRUE");

    _cache = todas;
    _cacheTs = Date.now();

    if (ccpp_id) return todas.filter((t) => t.ccpp_id === ccpp_id);
    return todas;
  } catch (e) {
    // Fallback: caché vieja si quota
    if (_cache) {
      if (ccpp_id) return _cache.filter((t) => t.ccpp_id === ccpp_id);
      return _cache;
    }
    throw e;
  }
}

async function crearTag({ ccpp_id, tag, usuario }) {
  if (!ccpp_id) throw new Error("Falta ccpp_id");
  const limpio = (tag || "").trim();
  if (!limpio) throw new Error("Falta tag");

  // Evitar duplicados (case-insensitive) en la misma comunidad
  const existentes = await leerTags(ccpp_id);
  if (existentes.some((t) => t.tag.toLowerCase() === limpio.toLowerCase())) {
    throw new Error("Ese tag ya está añadido a esta comunidad");
  }

  await asegurarPestana();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(TAGS_HEADERS.length - 1);

  const nuevo = {
    tag_id: genTagId(),
    ccpp_id,
    tag: limpio,
    created_at: nowIso(),
    created_by: usuario || "ara-os",
    borrado: "FALSE",
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_TAGS}!A:${lastCol}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [objetoAFila(nuevo, TAGS_HEADERS)] },
  });
  invalidarCache();
  return nuevo;
}

async function borrarTag(tag_id) {
  if (!tag_id) throw new Error("Falta tag_id");
  await asegurarPestana();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(TAGS_HEADERS.length - 1);

  // Buscar la fila
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_TAGS}!A2:${lastCol}`,
  });
  const filas = r.data.values || [];
  let rowIdx = -1;
  for (let i = 0; i < filas.length; i++) {
    if (filas[i][0] === tag_id) {
      rowIdx = i + 2;
      break;
    }
  }
  if (rowIdx === -1) {
    return { error: "Tag no encontrado", status: 404 };
  }
  // Soft delete: marcar borrado = TRUE
  const colBorrado = colLetterFromIdx(TAGS_HEADERS.indexOf("borrado"));
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB_TAGS}!${colBorrado}${rowIdx}`,
    valueInputOption: "RAW",
    requestBody: { values: [["TRUE"]] },
  });
  invalidarCache();
  return { ok: true };
}

// ============================================================
// CORS
// ============================================================
function responderCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-ara-pin");
  res.setHeader("Access-Control-Max-Age", "0");
}

// ============================================================
// Registro de endpoints
// ============================================================
module.exports = function setupAraOsTagsHolded(app) {
  const bodyParser = require("body-parser");
  const jsonBodyParser = bodyParser.json({ limit: "256kb" });

  // ---------- PING ----------
  app.options("/api/ara-os/comunidades/tags-holded/ping", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/comunidades/tags-holded/ping", async (req, res) => {
    responderCORS(res);
    try {
      const tags = await leerTags();
      res.json({
        ok: true,
        modulo: "ara-os-tags-holded",
        version: "v0.1.0",
        ts: nowIso(),
        pestana: TAB_TAGS,
        total_tags: tags.length,
        ccpps_con_tags: new Set(tags.map((t) => t.ccpp_id)).size,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- LISTAR TODOS ----------
  app.options("/api/ara-os/comunidades/tags-holded", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/comunidades/tags-holded", async (req, res) => {
    responderCORS(res);
    try {
      const tags = await leerTags();
      res.json({ ok: true, tags });
    } catch (e) {
      console.error("[tags-holded GET all]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- LISTAR DE UNA COMUNIDAD ----------
  app.options("/api/ara-os/comunidades/:ccpp_id/tags-holded", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/comunidades/:ccpp_id/tags-holded", async (req, res) => {
    responderCORS(res);
    try {
      const tags = await leerTags(req.params.ccpp_id);
      res.json({ ok: true, ccpp_id: req.params.ccpp_id, tags });
    } catch (e) {
      console.error("[tags-holded GET ccpp]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- CREAR TAG ----------
  app.post("/api/ara-os/comunidades/:ccpp_id/tags-holded", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const ccpp_id = req.params.ccpp_id;
      const { tag, usuario } = req.body || {};
      const nuevo = await crearTag({ ccpp_id, tag, usuario });
      res.json({ ok: true, tag: nuevo });
    } catch (e) {
      console.error("[tags-holded POST]", e);
      const code = /ya est|Falta/.test(e.message) ? 400 : 500;
      res.status(code).json({ ok: false, error: e.message });
    }
  });

  // ---------- BORRAR TAG ----------
  app.delete("/api/ara-os/comunidades/tags-holded/:tag_id", async (req, res) => {
    responderCORS(res);
    try {
      const r = await borrarTag(req.params.tag_id);
      if (r.error) return res.status(r.status || 500).json({ ok: false, error: r.error });
      res.json({ ok: true });
    } catch (e) {
      console.error("[tags-holded DELETE]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-tags-holded v0.1.0] Módulo cargado. 5 endpoints. Pestaña: comunidades_tags_holded");
};
