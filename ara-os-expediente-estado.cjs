// ============================================================
// ara-os-expediente-estado.cjs — estado del expediente de cada obra para
// Planificación («Lista para empezar»), encargo del 04/10/2026.
// SOLO LECTURA de la hoja de Guillermo (comunidades y pisos): no escribe nada.
//   GET /api/ara-os/expediente-estado?token=          → todas las obras
//   GET /api/ara-os/expediente-estado/:ccpp_id?token= → una
// Cuatro lecturas de Sheets para todas las obras (nunca Holded), con caché de
// 10 min y una sola lectura a la vez. ?refresh=1 vuelve a leer.
// ============================================================
"use strict";

const { validToken } = require("./lib/auth.cjs");
const { getSheetsClient } = require("./lib/sheets-tabla.cjs");
const { estadosExpedientes } = require("./lib/expediente-estado.cjs");
const { unaALaVez } = require("./lib/cache-respuesta.cjs");

const TTL_MS = 10 * 60 * 1000;
let _cache = null;   // { ts, data }

module.exports = function (app) {
  const cors = (res) => { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "Content-Type, Authorization"); res.set("Access-Control-Allow-Methods", "GET, OPTIONS"); };

  const leer = unaALaVez(async () => {
    const id = process.env.GOOGLE_SHEETS_ID;
    if (!id) throw new Error("Falta GOOGLE_SHEETS_ID en entorno");
    const s = getSheetsClient().spreadsheets.values;
    const [com, pis, docs, sab] = await Promise.all([
      s.get({ spreadsheetId: id, range: "comunidades!A:BO", valueRenderOption: "UNFORMATTED_VALUE" }),
      s.get({ spreadsheetId: id, range: "pisos!A:AX" }),
      s.get({ spreadsheetId: id, range: "documentos_manuales!A:G" }),
      s.get({ spreadsheetId: id, range: "financiaciones_sabadell!A2:L" }).catch(() => ({ data: { values: [] } })),
    ]);
    // documentos_manuales: codigo, nivel, label, orden, permite_financiacion, activo, notas (como documentacion.cjs)
    const piso = [], ccpp = [];
    for (const r of (docs.data.values || []).slice(1)) {
      const codigo = String(r[0] || "").trim(), nivel = String(r[1] || "").trim().toUpperCase();
      if (!codigo || !String(r[2] || "").trim() || String(r[5] || "SI").trim().toUpperCase() === "NO") continue;
      const d = { codigo, orden: parseInt(String(r[3] || "0"), 10) || 0, permiteFinanciacion: String(r[4] || "").trim().toUpperCase() === "SI" };
      if (nivel === "PISO") piso.push(d); else if (nivel === "CCPP") ccpp.push(d);
    }
    piso.sort((a, b) => a.orden - b.orden); ccpp.sort((a, b) => a.orden - b.orden);
    const P = app.locals?.presupuestos;
    const data = estadosExpedientes({ comunidades: com.data.values || [], pisos: pis.data.values || [], docs: { piso, ccpp }, sabadell: sab.data.values || [],
      contarFaltan: typeof P?._contarFaltan === "function" ? P._contarFaltan : null });
    _cache = { ts: Date.now(), data };
    return _cache;
  });
  const obtener = async (refresh) => (!refresh && _cache && Date.now() - _cache.ts < TTL_MS ? _cache : leer());

  app.options("/api/ara-os/expediente-estado", (req, res) => { cors(res); res.status(204).end(); });
  app.options("/api/ara-os/expediente-estado/:ccpp_id", (req, res) => { cors(res); res.status(204).end(); });
  app.get("/api/ara-os/expediente-estado", async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try { const c = await obtener(!!req.query.refresh); res.json({ ok: true, generado: new Date(c.ts).toISOString(), obras: c.data }); }
    catch (e) { console.error("[expediente-estado]", e); res.status(500).json({ ok: false, error: e.message }); }
  });
  app.get("/api/ara-os/expediente-estado/:ccpp_id", async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try {
      const c = await obtener(!!req.query.refresh);
      const o = c.data[String(req.params.ccpp_id)];
      if (!o) return res.status(404).json({ ok: false, error: "obra no encontrada en la hoja de comunidades" });
      res.json({ ok: true, generado: new Date(c.ts).toISOString(), ...o });
    } catch (e) { console.error("[expediente-estado]", e); res.status(500).json({ ok: false, error: e.message }); }
  });
  console.log("[ara-os-expediente-estado] /api/ara-os/expediente-estado (solo lectura)");
};
