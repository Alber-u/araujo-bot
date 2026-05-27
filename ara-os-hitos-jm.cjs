// ============================================================
// ARA OS · Hitos JM por obra · v0.1.0 · 27/05/2026
//
// Panel "Mis obras" para JM. Cada obra = paciente. JM marca hitos
// por fase (09_FINANCIACION → 11_PREPARADA en este MVP).
//
// Endpoints:
//   GET  /api/ara-os/hitos-jm/catalogo   → catálogo de hitos por fase
//   GET  /api/ara-os/hitos-jm/obras      → lista obras 09-11 + hitos hechos
//   POST /api/ara-os/hitos-jm/marcar     → marca/desmarca un hito
//
// Datos en pestaña nueva `obras_hitos_jm`:
//   ccpp_id | fase | hito_id | hecho_en | hecho_por | nota
// Append-only. Latest-wins por (ccpp_id, hito_id).
// hecho_en = "" significa "desmarcado" (último estado).
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

module.exports = function setupHitosJM(app) {
  const { google } = require("googleapis");
  const express = require("express");
  const crypto = require("crypto");
  const { validToken } = require("./lib/auth.cjs");
  const jsonBodyParser = express.json({ limit: "100kb" });

  let umbralesMod = null;
  try { umbralesMod = require("./ara-os-timeline-fases.cjs"); } catch {}

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
        console.log("[hitos-jm] Pestaña obras_hitos_jm creada");
      } else {
        // Verificar headers
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
          console.log("[hitos-jm] Headers obras_hitos_jm actualizados");
        }
      }
      _pestanaOK = true;
      return true;
    } catch (err) {
      console.warn("[hitos-jm/asegurarPestana]", err.message);
      return false;
    }
  }

  // Lee TODOS los eventos, ordenados en append, y reduce a estado
  // actual por (ccpp_id, hito_id). El último evento gana.
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
    // Normalizar formato DD/MM/YYYY
    let d;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let [, dd, mm, yy] = m;
      if (yy.length === 2) yy = "20" + yy;
      d = new Date(`${yy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}T12:00:00Z`);
    } else {
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/hitos-jm/catalogo
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/hitos-jm/catalogo", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/catalogo", (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    res.json({ ok: true, version: "0.1.0", catalogo: CATALOGO_HITOS });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/hitos-jm/obras
  // Lista obras en fase 09/10/11 con hitos hechos + semáforo.
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/hitos-jm/obras", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const FASES_JM = new Set(Object.keys(CATALOGO_HITOS));

      // Leer comunidades con headers
      const rowsCom = await leerHojaSafe("comunidades!A1:BD");
      const headers = rowsCom[0] || [];
      const data    = rowsCom.slice(1);
      const idxBy   = {};
      for (let i = 0; i < headers.length; i++) {
        idxBy[String(headers[i] || "").trim()] = i;
      }

      const idxComunidad   = idxBy["comunidad"] ?? 0;
      const idxDireccion   = idxBy["direccion"] ?? 1;
      const idxFase        = idxBy["fase_presupuesto"];
      const idxFaseJm      = idxBy["fase_jm"];
      const idxUltMod      = idxBy["ultima_modificacion"];
      const idxFechaCycp   = idxBy["fecha_cycp_completa"];
      const idxAdmin       = idxBy["administrador"];
      const idxTelPres     = idxBy["telefono_presidente"];
      const idxPresidente  = idxBy["presidente"];

      // Umbrales (si el módulo timeline-fases está disponible)
      let umbrales = {};
      if (umbralesMod && typeof umbralesMod.leerUmbrales === "function") {
        try { umbrales = await umbralesMod.leerUmbrales(); } catch {}
      }

      const hitosMapa = await leerHitosEstadoActual();

      const obras = [];
      for (const row of data) {
        const comunidad = String(row[idxComunidad] || "").trim();
        if (!comunidad) continue;
        const fase = String(row[idxFase ?? -1] || "").trim();
        if (!FASES_JM.has(fase)) continue;
        const direccion = String(row[idxDireccion] || "").trim() || comunidad;
        const ccpp_id   = ccppIdDe(direccion);
        const ultMod    = idxUltMod    != null ? String(row[idxUltMod]    || "").trim() : "";
        const fCycp     = idxFechaCycp != null ? String(row[idxFechaCycp] || "").trim() : "";

        // Fecha de referencia para "días en fase":
        //  · 09: usa fecha_cycp_completa (entrada a 09)
        //  · 10/11: ultima_modificacion
        const fechaRef = (fase === "09_FINANCIACION" && fCycp) ? fCycp : (ultMod || fCycp);
        const diasEnFase = diasDesde(fechaRef);

        const u = umbrales[fase] || {};
        let semaforo = "verde";
        if (diasEnFase != null && u.critico && diasEnFase >= u.critico) semaforo = "rojo";
        else if (diasEnFase != null && u.aviso && diasEnFase >= u.aviso) semaforo = "amarillo";

        // Hitos hechos de esta obra
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

        // % completo según catálogo de su fase
        const lista = CATALOGO_HITOS[fase] || [];
        const totalHitos = lista.length;
        const hechos     = lista.filter(h => hitosHechos[h.id]).length;
        const pct        = totalHitos > 0 ? Math.round((hechos / totalHitos) * 100) : 0;

        obras.push({
          ccpp_id,
          comunidad,
          direccion,
          fase,
          fase_jm:        idxFaseJm     != null ? String(row[idxFaseJm]     || "").trim() : "",
          presidente:     idxPresidente != null ? String(row[idxPresidente] || "").trim() : "",
          telefono:       idxTelPres    != null ? String(row[idxTelPres]    || "").trim() : "",
          administrador:  idxAdmin      != null ? String(row[idxAdmin]      || "").trim() : "",
          fecha_ref:      fechaRef || null,
          dias_en_fase:   diasEnFase,
          umbral_aviso:   u.aviso   ?? null,
          umbral_critico: u.critico ?? null,
          semaforo,
          hitos_total:    totalHitos,
          hitos_hechos_n: hechos,
          pct_completo:   pct,
          hitos_hechos:   hitosHechos,
        });
      }

      // Orden: semáforo (rojo > amarillo > verde), luego más días primero
      const peso = { rojo: 0, amarillo: 1, verde: 2 };
      obras.sort((a, b) => {
        const dr = peso[a.semaforo] - peso[b.semaforo];
        if (dr !== 0) return dr;
        return (b.dias_en_fase || 0) - (a.dias_en_fase || 0);
      });

      res.json({
        ok: true,
        version: "0.1.0",
        total: obras.length,
        catalogo: CATALOGO_HITOS,
        umbrales,
        obras,
      });
    } catch (err) {
      console.error("[hitos-jm/obras]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/ara-os/hitos-jm/marcar
  // Body: { ccpp_id, fase, hito_id, marcado: true|false, actor?, nota? }
  // Append fila. marcado=false → hecho_en="" (desmarcado).
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/hitos-jm/marcar", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/hitos-jm/marcar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, fase, hito_id, marcado, actor, nota } = req.body || {};
      if (!ccpp_id || !fase || !hito_id) {
        return res.status(400).json({ error: "Faltan ccpp_id, fase o hito_id" });
      }
      const lista = CATALOGO_HITOS[fase] || [];
      if (!lista.some(h => h.id === hito_id)) {
        return res.status(400).json({ error: `Hito ${hito_id} no existe en fase ${fase}` });
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

      // Log fire-and-forget en actividad_sistema
      try {
        require("./ara-os-actividad.cjs").logActividad({
          actor: actor || "JM",
          tipo: marcado === false ? "hito_jm_desmarcado" : "hito_jm_marcado",
          ccpp_id,
          detalle: `${marcado === false ? "Desmarcado" : "Marcado"} hito ${hito_id} en ${fase}`,
          payload: { fase, hito_id, marcado: marcado !== false },
        });
      } catch {}

      res.json({
        ok: true,
        version: "0.1.0",
        ccpp_id,
        fase,
        hito_id,
        marcado: marcado !== false,
        hecho_en: marcado === false ? "" : ahora,
      });
    } catch (err) {
      console.error("[hitos-jm/marcar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[hitos-jm] v0.1.0 cargado · GET /obras /catalogo · POST /marcar");
};

module.exports.CATALOGO_HITOS = CATALOGO_HITOS;
