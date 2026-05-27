// ============================================================
// ARA OS · Hitos JM por obra · v0.7.0 · 27/05/2026
//
// v0.7.0 — Detecta custodia automaticamente leyendo
//          financiaciones_sabadell. Si obra no tiene custodia,
//          oculta el hito "abono custodia" (no entra en total).
// v0.6.1 — Hitos 11_PREPARADA: custodia + doc RT + doc inicio.
// v0.6.0 — Replica clasificacion exacta de panel-obras.
// ============================================================

const HITOS_HEADERS = ["ccpp_id", "fase", "hito_id", "hecho_en", "hecho_por", "nota"];

const CATALOGO_HITOS = {
  "09_FINANCIACION": [
    { id: "09_revisar_pisos",       label: "Revisar pisos · contado vs financiacion", orden: 1 },
    { id: "09_solicitar_sabadell",  label: "Solicitar financiacion Sabadell",          orden: 2 },
    { id: "09_aprobacion_sabadell", label: "Aprobada financiacion Sabadell",           orden: 3 },
    { id: "09_cobros_contado",      label: "Cobros al contado recibidos",              orden: 4 },
    { id: "09_docs_emasesa",        label: "Documentacion enviada a EMASESA",          orden: 5 },
  ],
  "10_BLOQUEOS": [
    { id: "10_motivo",   label: "Motivo identificado", orden: 1 },
    { id: "10_resuelto", label: "Bloqueo resuelto",    orden: 2 },
  ],
  "11_PREPARADA": [
    { id: "11_abono_custodia",  label: "Abono de custodia realizado",                  orden: 1, condicional: "tiene_custodia" },
    { id: "11_doc_rt",          label: "Documento RT recibido",                         orden: 2 },
    { id: "11_doc_inicio_obra", label: "Documento Inicio de obra EMASESA recibido",     orden: 3 },
  ],
};

const VALORES_FINANCIA = new Set(["6", "12", "18", "FFCC"]);

// Columnas de financiaciones_sabadell (replica de panel-obras FS_COLS)
const FS_TIPOS_COBRADO  = new Set(["piso", "comunidad"]);
const FS_TIPO_ENTREGADO = "entrega_emasesa";

function clasificarFasesObra(fasePresup, tieneFinReal, tienePendienteF) {
  if (!fasePresup || fasePresup.indexOf("ZZ_") === 0) return [];
  if (fasePresup === "08_CYCP") {
    if (!tienePendienteF && !tieneFinReal) return ["11_PREPARADA"];
    const cols = ["08_CYCP"];
    if (tieneFinReal) cols.push("09_FINANCIACION");
    return cols;
  }
  if (fasePresup === "09_TRAMITADA") {
    return tieneFinReal ? ["09_FINANCIACION"] : ["11_PREPARADA"];
  }
  return [];
}

const FASES_JM_VISIBLES = new Set(["09_FINANCIACION", "10_BLOQUEOS", "11_PREPARADA"]);

function claveComunidad(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[áàâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function parseImporteSimple(v) {
  if (v == null) return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
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
    return "ccpp_" + slug + "_" + hash;
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

  async function leerComunidadesConOT() {
    const rows = await leerHojaSafe("ordenes_trabajo!A2:B");
    const mapa = new Map();
    for (const row of rows) {
      const com = String(row[0] || "").trim();
      const fase = String(row[1] || "").trim();
      if (!com) continue;
      if (!fase) continue;
      mapa.set(claveComunidad(com), fase);
    }
    return mapa;
  }

  async function leerPagosPorComunidad() {
    const rows = await leerHojaSafe("pisos!A2:AS");
    const mapa = new Map();
    for (const row of rows) {
      const com = String(row[1] || "").trim();
      if (!com) continue;
      const key = claveComunidad(com);
      if (!mapa.has(key)) mapa.set(key, { financia: 0, pendiente_f: 0, total: 0 });
      const stats = mapa.get(key);
      stats.total++;
      const v = String(row[44] || "").trim().toUpperCase();
      if (VALORES_FINANCIA.has(v))     stats.financia++;
      else if (v === "F")              stats.pendiente_f++;
    }
    return mapa;
  }

  // v0.7.0 — Lee financiaciones_sabadell → Map<claveCom, custodia_eur>
  // Replica calculo de panel-obras: custodia = cobrado - entregado
  // (cobrado = filas tipo "piso"/"comunidad", entregado = "entrega_emasesa")
  async function leerCustodiaPorComunidad() {
    const rows = await leerHojaSafe("financiaciones_sabadell!A2:L");
    const mapa = new Map();
    for (const row of rows) {
      const tipo    = String(row[1] || "").trim().toLowerCase();
      const com     = String(row[2] || "").trim();
      const importe = parseImporteSimple(row[5]);
      if (!com) continue;
      const key = claveComunidad(com);
      if (!mapa.has(key)) mapa.set(key, { cobrado: 0, entregado: 0 });
      const stats = mapa.get(key);
      if (FS_TIPOS_COBRADO.has(tipo)) stats.cobrado += importe;
      else if (tipo === FS_TIPO_ENTREGADO) stats.entregado += importe;
    }
    const out = new Map();
    for (const [k, v] of mapa.entries()) {
      out.set(k, v.cobrado - v.entregado);
    }
    return out;
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

  app.options("/api/ara-os/hitos-jm/catalogo", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/catalogo", (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    res.json({ ok: true, version: "0.7.0", catalogo: CATALOGO_HITOS });
  });

  app.options("/api/ara-os/hitos-jm/obras", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/hitos-jm/obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const debug = String(req.query.debug || "") === "1";

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

      const conOT         = await leerComunidadesConOT();
      const pagosPorCom   = await leerPagosPorComunidad();
      const custodiaCom   = await leerCustodiaPorComunidad();
      const hitosMapa     = await leerHitosEstadoActual();

      const stats = {
        total_filas:        data.length,
        sin_comunidad:      0,
        no_clasificadas:    0,
        no_jm:              0,
        excluidas_por_ot:   0,
        visibles:           0,
        con_custodia:       0,
        ot_total:           conOT.size,
        pisos_total:        pagosPorCom.size,
        custodia_total:     custodiaCom.size,
        clasif_fases:       {},
      };

      const obras = [];
      for (const row of data) {
        const comunidad = String(row[idxComunidad] || "").trim();
        if (!comunidad) { stats.sin_comunidad++; continue; }

        const fasePresup = (idxFase != null) ? String(row[idxFase] || "").trim() : "";
        const claveCom = claveComunidad(comunidad);
        const pagos = pagosPorCom.get(claveCom) || { financia: 0, pendiente_f: 0 };
        const tieneFinReal    = pagos.financia    > 0;
        const tienePendienteF = pagos.pendiente_f > 0;

        const fasesPanel = clasificarFasesObra(fasePresup, tieneFinReal, tienePendienteF);
        if (!fasesPanel.length) { stats.no_clasificadas++; continue; }

        const faseJm = fasesPanel.find(f => FASES_JM_VISIBLES.has(f));
        if (!faseJm) { stats.no_jm++; continue; }

        const faseOT = conOT.get(claveCom);
        if (faseOT) {
          stats.excluidas_por_ot++;
          continue;
        }

        stats.visibles++;
        stats.clasif_fases[faseJm] = (stats.clasif_fases[faseJm] || 0) + 1;

        // Detectar custodia
        const custodiaEur = custodiaCom.get(claveCom) || 0;
        const tieneCustodia = custodiaEur > 0;
        if (tieneCustodia) stats.con_custodia++;

        const direccion = String(row[idxDireccion] || "").trim() || comunidad;
        const ccpp_id   = ccppIdDe(direccion);
        const ultMod    = (idxUltMod    != null) ? String(row[idxUltMod]    || "").trim() : "";
        const fCycp     = (idxFechaCycp != null) ? String(row[idxFechaCycp] || "").trim() : "";

        const fechaRef = fCycp || ultMod;
        const diasEnFase = diasDesde(fechaRef);

        const u = umbrales[faseJm] || umbrales["09_FINANCIACION"] || {};
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

        // Filtrar hitos condicionales
        const listaCompleta = CATALOGO_HITOS[faseJm] || [];
        const lista = listaCompleta.filter(h => {
          if (h.condicional === "tiene_custodia" && !tieneCustodia) return false;
          return true;
        });
        const hitosAplicables = lista.map(h => h.id);

        const totalHitos = lista.length;
        const hechos     = lista.filter(h => hitosHechos[h.id]).length;
        const pct        = totalHitos > 0 ? Math.round((hechos / totalHitos) * 100) : 0;

        obras.push({
          ccpp_id:          ccpp_id,
          comunidad:        comunidad,
          direccion:        direccion,
          fase:             faseJm,
          fase_presup:      fasePresup,
          pisos_financia:   pagos.financia,
          pisos_pendienteF: pagos.pendiente_f,
          tiene_custodia:   tieneCustodia,
          custodia_eur:     custodiaEur,
          hitos_aplicables: hitosAplicables,
          presidente:       (idxPresidente != null) ? String(row[idxPresidente] || "").trim() : "",
          telefono:         (idxTelPres    != null) ? String(row[idxTelPres]    || "").trim() : "",
          administrador:    (idxAdmin      != null) ? String(row[idxAdmin]      || "").trim() : "",
          fecha_ref:        fechaRef || null,
          dias_en_fase:     diasEnFase,
          umbral_aviso:     (u.aviso   != null) ? u.aviso   : null,
          umbral_critico:   (u.critico != null) ? u.critico : null,
          semaforo:         semaforo,
          hitos_total:      totalHitos,
          hitos_hechos_n:   hechos,
          pct_completo:     pct,
          hitos_hechos:     hitosHechos,
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
        version: "0.7.0",
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
        version: "0.7.0",
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

  console.log("[hitos-jm] v0.7.0 cargado · custodia automatica");
};

module.exports.CATALOGO_HITOS = CATALOGO_HITOS;
module.exports.clasificarFasesObra = clasificarFasesObra;
module.exports.claveComunidad = claveComunidad;
module.exports.FASES_JM_VISIBLES = FASES_JM_VISIBLES;
