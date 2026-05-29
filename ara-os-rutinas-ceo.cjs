/**
 * ara-os-rutinas-ceo.cjs · v1.0.0 (29/05/2026)
 * --------------------------------------------------------------
 * Persiste en Google Sheets el estado y la configuración de las
 * rutinas administrativas del CEO (Sala de Mando · bloque 03).
 *
 * Antes vivía en localStorage del navegador — se perdía al cambiar
 * de dispositivo. Ahora se sincroniza al backend para que Alberto
 * vea el mismo estado en móvil, escritorio y donde sea.
 *
 * Pestaña Sheet: `ara_os_rutinas_ceo`
 *   A: clave       (estado · config)
 *   B: valor_json  (JSON string)
 *   C: updated_at  (ISO 8601)
 *
 * Endpoints:
 *   GET  /api/ara-os/rutinas-ceo
 *        → { ok, estado, config }
 *   POST /api/ara-os/rutinas-ceo
 *        body { estado?, config? }
 *        → { ok }
 *
 * Ambos protegidos por validToken (PIN).
 * --------------------------------------------------------------
 */
const { google } = require("googleapis");
const { validToken } = require("./lib/auth.cjs");
const express = require("express");

const TAB = "ara_os_rutinas_ceo";
const HEADERS = ["clave", "valor_json", "updated_at"];

module.exports = function(app) {
  const jsonBodyParser = express.json({ limit: "256kb" });

  // ── Cliente Sheets reutilizado del patrón OAuth2 ──────────
  let _sheetsClient = null;
  function getSheets() {
    if (_sheetsClient) return _sheetsClient;
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    _sheetsClient = google.sheets({ version: "v4", auth: oauth2 });
    return _sheetsClient;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // Asegura que la pestaña existe y tiene cabeceras
  let _pestanaOk = false;
  async function asegurarPestana() {
    if (_pestanaOk) return;
    const sheets = getSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
    const existe = meta.data.sheets.some(s => s.properties.title === TAB);
    if (!existe) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
      });
    }
    // Cabeceras (idempotente)
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${TAB}!A1:C1`,
    });
    const fila = r.data.values?.[0] || [];
    const necesita = fila.length < HEADERS.length || HEADERS.some((h, i) => fila[i] !== h);
    if (necesita) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${TAB}!A1:C1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
    }
    _pestanaOk = true;
  }

  async function leerPares() {
    await asegurarPestana();
    const sheets = getSheets();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${TAB}!A2:C`,
    });
    const filas = r.data.values || [];
    const out = {};
    for (const [clave, valor] of filas) {
      if (!clave) continue;
      try { out[clave] = valor ? JSON.parse(valor) : null; }
      catch { out[clave] = null; }
    }
    return out;
  }

  async function escribirPar(clave, valor) {
    await asegurarPestana();
    const sheets = getSheets();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${TAB}!A2:C`,
    });
    const filas = r.data.values || [];
    const json = JSON.stringify(valor || {});
    const ts = new Date().toISOString();
    const idx = filas.findIndex(f => f[0] === clave);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${TAB}!A${idx + 2}:C${idx + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[clave, json, ts]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${TAB}!A:C`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[clave, json, ts]] },
      });
    }
  }

  // ─── GET · devolver estado + config ──────────────────────
  app.options("/api/ara-os/rutinas-ceo", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/rutinas-ceo", async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      const pares = await leerPares();
      res.json({
        ok: true,
        estado: pares.estado || {},
        config: pares.config || {},
      });
    } catch (e) {
      console.error("[rutinas-ceo GET]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── POST · actualizar estado y/o config ──────────────────
  app.post("/api/ara-os/rutinas-ceo", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      const body = req.body || {};
      if (body.estado !== undefined) await escribirPar("estado", body.estado);
      if (body.config !== undefined) await escribirPar("config", body.config);
      res.json({ ok: true });
    } catch (e) {
      console.error("[rutinas-ceo POST]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-rutinas-ceo v1.0.0] montado");
};
