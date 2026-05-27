// ============================================================
// ARA OS · Hitos JM por obra · v0.2.1 · 27/05/2026
//
// Panel "Mis obras" para JM. Cada obra = paciente. JM marca hitos
// por fase (09_FINANCIACION → 11_PREPARADA en este MVP).
//
// v0.2.1 — Hotfix: regex con escapes unicode explicitos
//          (̀-ͯ) para evitar parse error en runtime.
// v0.2.0 — Tambien detecta obras por campo fase_jm.
// v0.1.0 — MVP inicial.
//
// Endpoints:
//   GET  /api/ara-os/hitos-jm/catalogo            -> catalogo
//   GET  /api/ara-os/hitos-jm/obras[?debug=1]     -> lista obras
//   POST /api/ara-os/hitos-jm/marcar              -> marca/desmarca
//
// Datos en pestana `obras_hitos_jm`:
//   ccpp_id | fase | hito_id | hecho_en | hecho_por | nota
// Append-only. Latest-wins por (ccpp_id, hito_id).
// ============================================================

const HITOS_HEADERS = ["ccpp_id", "fase", "hito_id", "hecho_en", "hecho_por", "nota"];

const CATALOGO_HITOS = {
  "09_FINANCIACION": [
    { id: "09_revisar_pisos",       label: "Revisar pisos · contado vs financiación", orden: 1 },
    { id: "09_solicitar_sabadell",  label: "Solicitar financiación Sabadell",          orden: 2 },
    { id: "09_aprobacion_sabadell", label: "Aprobada financiación Sabadell",           orden: 3 },
    { id: "09_cobros_contado",      label: "Cobros al contado recibidos",              orden: 4 },
    { id: "09_docs_emasesa",        label: "Documentación enviada a EMASESA",          orden: 5 },
  ],
  "10_BLOQUEOS": [
    { id: "10_motivo",   label: "Motivo identificado", orden: 1 },
    { id: "10_resuelto", label: "Bloqueo resuelto",    orden: 2 },
  ],
  "11_PREPARADA": [
    { id: "11_pisos_ok",  label: "Pisos confirmados (todos cerrados)", orden: 1 },
    { id: "11_ot_creada", label: "OT creada · pasa a 12",              orden: 2 },
  ],
};

// Normaliza valor de fase_jm (Guille usa "financiacion", "bloqueo",
// "preparada", con o sin tildes) -> codigo canonico de fase 09/10/11.
function normalizarFaseJm(valor) {
  const s = String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (!s) return "";
  if (s.indexOf("financi") === 0) return "09_FINANCIACION";
  if (s.indexOf("bloqu")   === 0) return "10_BLOQUEOS";
  if (s.indexOf("prepar")  === 0) return "11_PREPARADA";
  return "";
}

module.exports = function setupHitosJM(app) {
  const { google } = require("googleapis");
  const express = require("express");
  const crypto = require("crypto");
  const { validToken } = require("./lib/auth.cjs");
  const jsonBodyParser = express.json({ limit: "100kb" });

  let umbralesMod = null;
  try { umbralesMod = require("./ara-os-timeline-fases.cjs"); } catch (e) {}

  function tokenValido(req) { return validToken(req.query.token); }
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

  function ccppIdDe(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  async function leerHojaSafe(rango) {
    try {
      const sheets = getSheets();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: rango,
      });
      return r.data.values || [];
    } catch (err) {
      console.warn("[hitos-jm/leerHojaSafe]", rango, err.message);
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
        s.properties && s.properties.title === "obras_hitos_jm"
      );
      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "obras_hitos_jm" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: "obras_hitos_jm!A1:F1",
          valueInputOption: "RAW",
          requestBody: { values: [HITOS_HEADERS] },
        });
        console.log("[hitos-jm] Pestana obras_hitos_jm creada");
      } else {
        const cur = await leerHojaSafe("obras_hitos_jm!A1:F1");
        const fila = cur[0] || [];
        const desactualizada = fila.length < HITOS_HEADERS.length ||
          HITOS_HEADERS.some((h, i) => fila[i] !== h);
        if (desactualizada) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: "obras_hitos_jm!A1:F1",
            valueInputOption: "RAW",
            requestBody: { values: [HITOS_HEADERS] },
          });
          console.log("[hitos-jm] Headers actualizados");
        }
      }
      _pestanaOK = true;
      return true;
    } catch (err) {
      console.warn("[hitos-jm/asegurarPestana]", err.message);
      return false;
    }
  }

  async function leerHitosEstadoActual() {
    await asegurarPestana();
    const rows = await leerHojaSafe("obras_hitos_jm!A2:F");
    const mapa = new Map();
    for (const row of rows) {
      const ccpp = String(row[0] || "").trim();
      const hito = String(row[2] || "").trim();
      if (!ccpp || !hito) continue;
      if (!mapa.has(ccpp)) mapa.set(ccpp, new Map());
      mapa.get(ccpp).set(hito, {
        fase:      String(row[1] || "").trim(),
        hito_id:   hito,
        hecho_en:  String(row[3] || "").trim(),
        hecho_por: String(row[4] || "").trim(),
        nota:      String(row[5] || ""),
      });
    }
    return mapa;
  }

  function diasDesde(fechaISOoFecha) {
    if (!fechaISOoFecha) return null;
    const s = String(fechaISOoFecha).trim();
    if (!s) return null;
    let d;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let dd = m[1]; let mm = m[2]; let yy = m[3];
      if (yy.length === 2) yy = "20" + yy;
      d = new Date(yy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0") + "T12:00:00Z");
    } else {
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }

  // GET /api/ara-os/hitos-jm/catalogo
  app.options("/api/ara-os/hitos-jm/catalogo", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/catalogo", (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    res.json({ ok: true, version: "0.2.1", catalogo: CATALOGO_HITOS });
  });

  // GET /api/ara-os/hitos-jm/obras[?debug=1]
  app.options("/api/ara-os/hitos-jm/obras", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const debug = String(req.query.debug || "") === "1";
      const FASES_JM = new Set(Object.keys(CATALOGO_HITOS));

      const rowsCom = await leerHojaSafe("comunidades!A1:BD");
      const headers = rowsCom[0] || [];
      const data    = rowsCom.slice(1);
      const idxBy   = {};
      for (let i = 0; i < headers.length; i++) {
        idxBy[String(headers[i] || "").trim()] = i;
      }

      const idxComunidad   = (idxBy["comunidad"]            != null) ? idxBy["comunidad"]            : 0;
      const idxDireccion   = (idxBy["direccion"]            != null) ? idxBy["direccion"]            : 1;
      const idxFase        = idxBy["fase_presupuesto"];
      const idxFaseJm      = idxBy["fase_jm"];
      const idxUltMod      = idxBy["ultima_modificacion"];
      const idxFechaCycp   = idxBy["fecha_cycp_completa"];
      const idxAdmin       = idxBy["administrador"];
      const idxTelPres     = idxBy["telefono_presidente"];
      const idxPresidente  = idxBy["presidente"];

      let umbrales = {};
      if (umbralesMod && typeof umbralesMod.leerUmbrales === "function") {
        try { umbrales = await umbralesMod.leerUmbrales(); } catch (e) {}
      }

      const hitosMapa = await leerHitosEstadoActual();

      const stats = {
        total_filas:         data.length,
        sin_comunidad:       0,
        match_por_presup:    0,
        match_por_fase_jm:   0,
        sin_fase:            0,
        fase_jm_valores:     {},
        fase_presup_valores: {},
      };

      const obras = [];
      for (const row of data) {
        const comunidad = String(row[idxComunidad] || "").trim();
        if (!comunidad) { stats.sin_comunidad++; continue; }

        const fasePresup = (idxFase   != null) ? String(row[idxFase]   || "").trim() : "";
        const faseJmRaw  = (idxFaseJm != null) ? String(row[idxFaseJm] || "").trim() : "";

        if (fasePresup) stats.fase_presup_valores[fasePresup] = (stats.fase_presup_valores[fasePresup] || 0) + 1;
        if (faseJmRaw)  stats.fase_jm_valores[faseJmRaw]      = (stats.fase_jm_valores[faseJmRaw]      || 0) + 1;

        let fase = "";
        let origen = "";
        if (FASES_JM.has(fasePresup)) {
          fase = fasePresup;
          origen = "fase_presupuesto";
          stats.match_por_presup++;
        } else {
          const normJm = normalizarFaseJm(faseJmRaw);
          if (normJm) {
            fase = normJm;
            origen = "fase_jm";
            stats.match_por_fase_jm++;
          }
        }
        if (!fase) { stats.sin_fase++; continue; }

        const direccion = String(row[idxDireccion] || "").trim() || comunidad;
        const ccpp_id   = ccppIdDe(direccion);
        const ultMod    = (idxUltMod    != null) ? String(row[idxUltMod]    || "").trim() : "";
        const fCycp     = (idxFechaCycp != null) ? String(row[idxFechaCycp] || "").trim() : "";

        const fechaRef = (fase === "09_FINANCIACION" && fCycp) ? fCycp : (ultMod || fCycp);
        const diasEnFase = diasDesde(fechaRef);

        const u = umbrales[fase] || {};
        let semaforo = "verde";
        if (diasEnFase != null && u.critico && diasEnFase >= u.critico) semaforo = "rojo";
        else if (diasEnFase != null && u.aviso && diasEnFase >= u.aviso) semaforo = "amarillo";

        const subm = hitosMapa.get(ccpp_id) || new Map();
        const hitosHechos = {};
        for (const [hito_id, info] of subm.entries()) {
          if (info.hecho_en) {
            hitosHechos[hito_id] = {
              hecho_en:  info.hecho_en,
              hecho_por: info.hecho_por,
              nota:      info.nota,
            };
          }
        }

        const lista = CATALOGO_HITOS[fase] || [];
        const totalHitos = lista.length;
        const hechos     = lista.filter(h => hitosHechos[h.id]).length;
        const pct        = totalHitos > 0 ? Math.round((hechos / totalHitos) * 100) : 0;

        obras.push({
          ccpp_id:        ccpp_id,
          comunidad:      comunidad,
          direccion:      direccion,
          fase:           fase,
          fase_origen:    origen,
          fase_jm_raw:    faseJmRaw,
          fase_presup:    fasePresup,
          presidente:     (idxPresidente != null) ? String(row[idxPresidente] || "").trim() : "",
          telefono:       (idxTelPres    != null) ? String(row[idxTelPres]    || "").trim() : "",
          administrador:  (idxAdmin      != null) ? String(row[idxAdmin]      || "").trim() : "",
          fecha_ref:      fechaRef || null,
          dias_en_fase:   diasEnFase,
          umbral_aviso:   (u.aviso   != null) ? u.aviso   : null,
          umbral_critico: (u.critico != null) ? u.critico : null,
          semaforo:       semaforo,
          hitos_total:    totalHitos,
          hitos_hechos_n: hechos,
          pct_completo:   pct,
          hitos_hechos:   hitosHechos,
        });
      }

      const peso = { rojo: 0, amarillo: 1, verde: 2 };
      obras.sort((a, b) => {
        const dr = peso[a.semaforo] - peso[b.semaforo];
        if (dr !== 0) return dr;
        return (b.dias_en_fase || 0) - (a.dias_en_fase || 0);
      });

      const respuesta = {
        ok: true,
        version: "0.2.1",
        total: obras.length,
        catalogo: CATALOGO_HITOS,
        umbrales: umbrales,
        obras: obras,
      };
      if (debug) respuesta.debug = stats;

      res.json(respuesta);
    } catch (err) {
      console.error("[hitos-jm/obras]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ara-os/hitos-jm/marcar
  app.options("/api/ara-os/hitos-jm/marcar", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/hitos-jm/marcar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const body = req.body || {};
      const ccpp_id = body.ccpp_id;
      const fase    = body.fase;
      const hito_id = body.hito_id;
      const marcado = body.marcado;
      const actor   = body.actor;
      const nota    = body.nota;
      if (!ccpp_id || !fase || !hito_id) {
        return res.status(400).json({ error: "Faltan ccpp_id, fase o hito_id" });
      }
      const lista = CATALOGO_HITOS[fase] || [];
      if (!lista.some(h => h.id === hito_id)) {
        return res.status(400).json({ error: "Hito " + hito_id + " no existe en fase " + fase });
      }
      await asegurarPestana();
      const ahora = new Date().toISOString();
      const fila = [
        String(ccpp_id),
        String(fase),
        String(hito_id),
        marcado === false ? "" : ahora,
        String(actor || "JM"),
        String(nota || ""),
      ];
      const sheets = getSheets();
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "obras_hitos_jm!A:F",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });

      try {
        require("./ara-os-actividad.cjs").logActividad({
          actor: actor || "JM",
          tipo: marcado === false ? "hito_jm_desmarcado" : "hito_jm_marcado",
          ccpp_id: ccpp_id,
          detalle: (marcado === false ? "Desmarcado" : "Marcado") + " hito " + hito_id + " en " + fase,
          payload: { fase: fase, hito_id: hito_id, marcado: marcado !== false },
        });
      } catch (e) {}

      res.json({
        ok: true,
        version: "0.2.1",
        ccpp_id: ccpp_id,
        fase: fase,
        hito_id: hito_id,
        marcado: marcado !== false,
        hecho_en: marcado === false ? "" : ahora,
      });
    } catch (err) {
      console.error("[hitos-jm/marcar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[hitos-jm] v0.2.1 cargado · GET /obras /catalogo · POST /marcar");
};

module.exports.CATALOGO_HITOS = CATALOGO_HITOS;
module.exports.normalizarFaseJm = normalizarFaseJm;
