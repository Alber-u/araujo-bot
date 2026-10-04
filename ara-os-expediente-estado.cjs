// ============================================================
// ara-os-expediente-estado.cjs — estado del expediente de cada obra para
// Planificación («Lista para empezar»), encargo del 04/10/2026.
// SOLO LECTURA de la hoja de Guillermo (comunidades y pisos): no escribe nada.
//   GET /api/ara-os/expediente-estado?token=          → todas las obras
//   GET /api/ara-os/expediente-estado/:ccpp_id?token= → una
// Ocho lecturas de Sheets para todas las obras (nunca Holded), con caché de
// 10 min y una sola lectura a la vez. ?refresh=1 vuelve a leer.
// ============================================================
"use strict";

const { validToken } = require("./lib/auth.cjs");
const { getSheetsClient } = require("./lib/sheets-tabla.cjs");
const { estadosExpedientes, aplicarAliasExpedientes } = require("./lib/expediente-estado.cjs");
const { leerAlias } = require("./lib/ccpp-alias.cjs");
const { unaALaVez } = require("./lib/cache-respuesta.cjs");

const TTL_MS = 10 * 60 * 1000;
let _cache = null;   // { ts, data }

module.exports = function (app) {
  const cors = (res) => { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "Content-Type, Authorization"); res.set("Access-Control-Allow-Methods", "GET, OPTIONS"); };

  const leer = unaALaVez(async () => {
    const id = process.env.GOOGLE_SHEETS_ID;
    if (!id) throw new Error("Falta GOOGLE_SHEETS_ID en entorno");
    const s = getSheetsClient().spreadsheets.values;
    const P = app.locals?.presupuestos;
    // «Faltan N de M»: el contador del panel de Guillermo con sus mismos datos (docs manuales
    // activos, pisos con los campos del bot, bot_documentos y bot_expedientes). Solo lectura.
    const conPanel = typeof P?._contarFaltanBot === "function" && typeof P?._leerDocsManuales === "function" && typeof P?._leerBotDatosHoyIndex === "function";
    const [com, pis, docs, sab, cfg, bot, ots] = await Promise.all([
      s.get({ spreadsheetId: id, range: "comunidades!A:BO", valueRenderOption: "UNFORMATTED_VALUE" }),
      s.get({ spreadsheetId: id, range: "pisos!A:AX" }),
      conPanel ? P._leerDocsManuales() : s.get({ spreadsheetId: id, range: "documentos_manuales!A:G" }),
      s.get({ spreadsheetId: id, range: "financiaciones_sabadell!A2:L" }).catch(() => ({ data: { values: [] } })),
      s.get({ spreadsheetId: id, range: "config_dinero!A:B" }).catch(() => ({ data: { values: [] } })),
      conPanel ? P._leerBotDatosHoyIndex().catch(() => ({})) : Promise.resolve({}),
      s.get({ spreadsheetId: id, range: "ordenes_trabajo!A2:B" }).catch(() => ({ data: { values: [] } })),
    ]);
    let piso = [], ccpp = [];
    if (conPanel) ({ docsPiso: piso, docsCcpp: ccpp } = docs);
    else {
      // documentos_manuales: codigo, nivel, label, orden, permite_financiacion, activo, notas (como documentacion.cjs)
      for (const r of (docs.data.values || []).slice(1)) {
        const codigo = String(r[0] || "").trim(), nivel = String(r[1] || "").trim().toUpperCase();
        if (!codigo || String(r[5] || "").trim().toUpperCase() !== "SI") continue;
        const d = { codigo, orden: parseFloat(r[3]) || 999 };
        if (nivel === "PISO") piso.push(d); else if (nivel === "CCPP") ccpp.push(d);
      }
      piso.sort((a, b) => a.orden - b.orden); ccpp.sort((a, b) => a.orden - b.orden);
    }
    const contarFaltan = conPanel ? (estC, dC, ps, dP, fase, clave) => P._contarFaltanBot(estC, dC, ps, dP, fase, bot[P._normDirBot(clave)] || null)
      : typeof P?._contarFaltan === "function" ? P._contarFaltan : null;
    const filaAlias = (cfg.data.values || []).find((r) => String(r[0] || "").trim().toLowerCase() === "ccpp_alias");
    const data = aplicarAliasExpedientes(estadosExpedientes({ comunidades: com.data.values || [], pisos: pis.data.values || [], docs: { piso, ccpp }, sabadell: sab.data.values || [], contarFaltan, ots: ots.data.values || [] }),
      leerAlias(filaAlias ? filaAlias[1] : ""));
    _cache = { ts: Date.now(), data };
    return _cache;
  });
  const obtener = async (refresh) => (!refresh && _cache && Date.now() - _cache.ts < TTL_MS ? _cache : leer());
  // Para los demás módulos (bloqueos de contrato y pago, lib/bloqueos-expediente.cjs): la misma caché
  app.locals = app.locals || {};
  app.locals.expedienteEstado = async () => (await obtener(false)).data;

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
