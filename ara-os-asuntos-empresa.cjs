// ============================================================
// ARA OS · Asuntos generales empresa · v0.1.0 · 27/05/2026
//
// Pseudo-obra al inicio de "Mis obras" con tracking de:
//   - Reconocimientos medicos (anuales)
//   - ITV furgoneta (bianual)
//   - Revision herramientas (semestral)
//   - Otros (libre)
//
// Pestana: asuntos_empresa
// Cols: id · categoria · label · fecha_ultima · periodicidad_dias ·
//       nota · created_at · created_by · updated_at · updated_by
//
// GET  /api/ara-os/asuntos-empresa
// POST /api/ara-os/asuntos-empresa  (requiere PIN)
// ============================================================

const ASUNTOS_HEADERS = [
  "id", "categoria", "label", "fecha_ultima", "periodicidad_dias",
  "nota", "created_at", "created_by", "updated_at", "updated_by",
];

const ITEMS_DEFAULT = [
  { categoria: "medicos",      label: "Reconocimientos médicos",  periodicidad_dias: 365 },
  { categoria: "itv",          label: "ITV furgoneta",            periodicidad_dias: 730 },
  { categoria: "herramientas", label: "Revisión herramientas",    periodicidad_dias: 180 },
];

module.exports = function setupAsuntosEmpresa(app) {
  const { google } = require("googleapis");
  const express = require("express");
  const crypto  = require("crypto");
  const { validToken } = require("./lib/auth.cjs");
  const jsonBodyParser = express.json({ limit: "100kb" });

  function tokenValido(req) { return validToken(req.query.token); }

  function pinValido(pin) {
    if (!pin) return false;
    const pinStr = String(pin).trim();
    if (!pinStr) return false;
    if (process.env.ADMIN_PIN) return pinStr === String(process.env.ADMIN_PIN).trim();
    return validToken(pinStr);
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  function getAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheets() { return google.sheets({ version: "v4", auth: getAuth() }); }

  async function leerHojaSafe(rango) {
    try {
      const sheets = getSheets();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: rango,
      });
      return r.data.values || [];
    } catch (err) {
      console.warn("[asuntos-empresa/leer]", rango, err.message);
      return [];
    }
  }

  let _pestanaOK = null;
  async function asegurarPestana() {
    if (_pestanaOK) return true;
    try {
      const sheets = getSheets();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "asuntos_empresa"
      );
      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "asuntos_empresa" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: "asuntos_empresa!A1:J1",
          valueInputOption: "RAW",
          requestBody: { values: [ASUNTOS_HEADERS] },
        });
        const ahora = new Date().toISOString();
        const filas = ITEMS_DEFAULT.map(item => ([
          crypto.randomBytes(4).toString("hex"),
          item.categoria,
          item.label,
          "",
          String(item.periodicidad_dias),
          "",
          ahora,
          "AUTO",
          ahora,
          "AUTO",
        ]));
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: "asuntos_empresa!A:J",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: filas },
        });
        console.log("[asuntos-empresa] Pestana creada con", filas.length, "items default");
      }
      _pestanaOK = true;
      return true;
    } catch (err) {
      console.warn("[asuntos-empresa/asegurarPestana]", err.message);
      return false;
    }
  }

  function parseFecha(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;
    let d;
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let dd = m[1]; let mm = m[2]; let yy = m[3];
      if (yy.length === 2) yy = "20" + yy;
      d = new Date(yy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0") + "T12:00:00Z");
    } else {
      d = new Date(str);
    }
    return isNaN(d.getTime()) ? null : d;
  }

  function calcularEstado(fechaUltima, periodicidadDias) {
    if (!fechaUltima) return { estado: "sin_fecha", dias_para_vencer: null, fecha_proxima: null };
    const dUltima = parseFecha(fechaUltima);
    if (!dUltima) return { estado: "sin_fecha", dias_para_vencer: null, fecha_proxima: null };
    const periodicidad = Number(periodicidadDias) || 365;
    const dProxima = new Date(dUltima);
    dProxima.setDate(dProxima.getDate() + periodicidad);
    const dias_para_vencer = Math.floor((dProxima.getTime() - Date.now()) / 86400000);
    let estado;
    if (dias_para_vencer < 0) estado = "vencido";
    else if (dias_para_vencer <= 30) estado = "aviso";
    else estado = "ok";
    return {
      estado,
      dias_para_vencer,
      fecha_proxima: dProxima.toISOString().slice(0, 10),
    };
  }

  async function leerItems() {
    await asegurarPestana();
    const rows = await leerHojaSafe("asuntos_empresa!A2:J");
    const items = [];
    for (const row of rows) {
      const id = String(row[0] || "").trim();
      if (!id) continue;
      const fechaUltima  = String(row[3] || "").trim();
      const periodicidad = Number(row[4]) || 365;
      const estadoCalc = calcularEstado(fechaUltima, periodicidad);
      items.push({
        id,
        categoria: String(row[1] || "").trim(),
        label:     String(row[2] || "").trim(),
        fecha_ultima:      fechaUltima,
        periodicidad_dias: periodicidad,
        nota:       String(row[5] || ""),
        created_at: String(row[6] || "").trim(),
        created_by: String(row[7] || "").trim(),
        updated_at: String(row[8] || "").trim(),
        updated_by: String(row[9] || "").trim(),
        estado:             estadoCalc.estado,
        dias_para_vencer:   estadoCalc.dias_para_vencer,
        fecha_proxima:      estadoCalc.fecha_proxima,
      });
    }
    return items;
  }

  app.options("/api/ara-os/asuntos-empresa", (req, res) => {
    responderCORS(res); res.status(204).end();
  });

  app.get("/api/ara-os/asuntos-empresa", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const items = await leerItems();
      const conteo = {
        total:     items.length,
        vencidos:  items.filter(i => i.estado === "vencido").length,
        aviso:     items.filter(i => i.estado === "aviso").length,
        ok:        items.filter(i => i.estado === "ok").length,
        sin_fecha: items.filter(i => i.estado === "sin_fecha").length,
      };
      res.json({ ok: true, version: "0.1.0", items, conteo });
    } catch (err) {
      console.error("[asuntos-empresa/get]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ara-os/asuntos-empresa", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const body = req.body || {};
      if (!pinValido(body.pin)) {
        return res.status(403).json({ error: "PIN invalido" });
      }
      const id      = String(body.id || "").trim();
      const actor   = String(body.actor || "JM");
      const fechaUlt = (body.fecha_ultima != null) ? String(body.fecha_ultima).trim() : null;
      const nota     = (body.nota != null) ? String(body.nota) : null;

      await asegurarPestana();
      const sheets = getSheets();
      const allRows = await leerHojaSafe("asuntos_empresa!A2:J");
      const ahora = new Date().toISOString();

      // Update existente
      if (id) {
        const rowIndex = allRows.findIndex(r => String(r[0] || "").trim() === id);
        if (rowIndex < 0) return res.status(404).json({ error: "Item no existe" });
        const current = allRows[rowIndex];
        const filaUpd = [
          current[0],
          current[1],
          body.label != null ? String(body.label) : (current[2] || ""),
          fechaUlt != null ? fechaUlt : (current[3] || ""),
          body.periodicidad_dias != null ? String(Number(body.periodicidad_dias) || 365) : (current[4] || "365"),
          nota != null ? nota : (current[5] || ""),
          current[6] || ahora,
          current[7] || actor,
          ahora,
          actor,
        ];
        const rangoRow = `asuntos_empresa!A${rowIndex + 2}:J${rowIndex + 2}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: rangoRow,
          valueInputOption: "RAW",
          requestBody: { values: [filaUpd] },
        });
        return res.json({ ok: true, version: "0.1.0", id, updated: true });
      }

      // Crear nuevo
      const nuevoId = crypto.randomBytes(4).toString("hex");
      const categoria = String(body.categoria || "custom").trim();
      const label = String(body.label || "Sin nombre").trim();
      const periodicidad = Number(body.periodicidad_dias) || 365;
      const fila = [
        nuevoId,
        categoria,
        label,
        fechaUlt || "",
        String(periodicidad),
        nota || "",
        ahora,
        actor,
        ahora,
        actor,
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "asuntos_empresa!A:J",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });
      res.json({ ok: true, version: "0.1.0", id: nuevoId, created: true });
    } catch (err) {
      console.error("[asuntos-empresa/post]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[asuntos-empresa] v0.1.0 cargado");
};
