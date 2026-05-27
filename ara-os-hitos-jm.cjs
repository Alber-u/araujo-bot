// ============================================================
// ARA OS · Hitos JM por obra · v0.10.4 · 27/05/2026
//
// v0.10.4 — La alerta critica en fase 13 es por certificaciones
//           pendientes (cada 32h trabajadas debe haber una cert).
//           Quitada alerta "sin horas trabajadas" (no es critico).
//           1 cert atrasada → aviso. 2+ → critico.
// v0.10.3 — Alerta cuando obra en 13 sin horas (deshecho en v0.10.4).
// v0.10.2 — Certificaciones de obra (cada 32h trabajadas).
// ============================================================

const HITOS_HEADERS = ["ccpp_id", "fase", "hito_id", "hecho_en", "hecho_por", "nota"];
const HITO_NOTA_OBRA = "_nota_obra";

// v0.10.2 — Cada cuantas horas trabajadas se debe emitir una cert
const HORAS_POR_CERT_OBRA = 32;

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
  "12_INICIO_OBRA": [
    { id: "12_operarios",     label: "Operarios asignados",       orden: 1, auto: true },
    { id: "12_materiales",    label: "Materiales pedidos",        orden: 2, auto: true },
    { id: "12_presidente",    label: "Presidente avisado",        orden: 3, auto: true },
    { id: "12_llaves",        label: "Llaves obtenidas",          orden: 4, auto: true },
    { id: "12_fecha_inicio",  label: "Fecha de inicio asignada",  orden: 5, auto: true },
  ],
  "13_EN_EJECUCION": [
    { id: "13_arrancada",      label: "Obra arrancada (fecha real)",        orden: 1, auto: true },
    { id: "13_certif_obra",    label: "Certificacion de obra · cada 32h",   orden: 2, auto: true },
    { id: "13_finalizada",     label: "Obra finalizada al 100%",            orden: 3, auto: true },
  ],
  "14_FINALIZADA": [
    { id: "14_factura",        label: "Factura emitida",            orden: 1, auto: true },
    { id: "14_certificados",   label: "Certificados entregados",    orden: 2, auto: true },
  ],
  "15_VISITA_INSPECTOR": [
    { id: "15_fecha_visita",   label: "Fecha visita inspector",     orden: 1, auto: true },
    { id: "15_visto_bueno",    label: "Visto bueno recibido",       orden: 2, auto: true },
  ],
  "16_MONTAJE_CONTADORES": [
    { id: "16_fecha_montaje",  label: "Fecha montaje fijada",       orden: 1, auto: true },
    { id: "16_contadores",     label: "Contadores montados",        orden: 2, auto: true },
  ],
  "17_COBRO_EMASESA": [
    { id: "17_fecha_cobro",    label: "Fecha cobro EMASESA",        orden: 1, auto: true },
    { id: "17_transferencia",  label: "Transferencia recibida",     orden: 2, auto: true },
  ],
  "OO_PRESUPUESTO": [
    { id: "oo_pto_enviado",    label: "Presupuesto enviado al cliente", orden: 1 },
    { id: "oo_pto_aceptado",   label: "Presupuesto aceptado",           orden: 2 },
  ],
  "OO_INICIO_OBRA": [
    { id: "oo_operarios",      label: "Operarios asignados",   orden: 1 },
    { id: "oo_materiales",     label: "Materiales pedidos",    orden: 2 },
    { id: "oo_cliente_avisado",label: "Cliente avisado",       orden: 3 },
    { id: "oo_fecha_inicio",   label: "Fecha inicio fijada",   orden: 4, auto: true },
  ],
  "OO_EN_EJECUCION": [
    { id: "oo_finalizada",     label: "Obra finalizada",       orden: 1, auto: true },
  ],
  "OO_FINALIZADA": [
    { id: "oo_factura",        label: "Factura emitida",       orden: 1, auto: true },
    { id: "oo_cobro",          label: "Cobro recibido",        orden: 2, auto: true },
  ],
  "OO_FACTURADA": [
    { id: "oo_cobro",          label: "Cobro recibido",        orden: 1, auto: true },
  ],
  "OO_INCIDENCIAS": [
    { id: "oo_inc_resuelta",   label: "Incidencia resuelta",   orden: 1 },
  ],
};

const UMBRALES_OO = {
  "OO_PRESUPUESTO":  { aviso: 7,  critico: 30 },
  "OO_INICIO_OBRA":  { aviso: 3,  critico: 7  },
  "OO_EN_EJECUCION": { aviso: 7,  critico: 21 },
  "OO_FINALIZADA":   { aviso: 1,  critico: 3  },
  "OO_FACTURADA":    { aviso: 7,  critico: 30 },
  "OO_INCIDENCIAS":  { aviso: 3,  critico: 7  },
};

const VALORES_FINANCIA = new Set(["6", "12", "18", "FFCC"]);
const FS_TIPOS_COBRADO  = new Set(["piso", "comunidad"]);
const FS_TIPO_ENTREGADO = "entrega_emasesa";

const OT_C = {
  comunidad:               0,
  fase_ot:                 1,
  fecha_creacion:          2,
  creado_por:              3,
  fecha_inicio_obra:       4,
  materiales_pedidos:      5,
  presidente_avisado:      6,
  llaves_obtenidas:        7,
  operarios_asignados:     8,
  ultima_modificacion:     9,
  fecha_inicio_real:       11,
  pct_avance:              14,
  num_certificaciones:     16,
  factura_emitida:         18,
  certificados_entregados: 19,
  visita_inspector_fecha:  20,
  visto_bueno:             21,
  contadores_montados:     22,
  cobro_emasesa_fecha:     23,
  transferencia_recibida:  26,
  fecha_montaje:           27,
  fecha_factura_emitida:   34,
};

const OO_C = {
  obra_id:           0,
  nombre:            1,
  cliente:           2,
  telefono:          3,
  direccion:         4,
  tipo:              5,
  importe_legacy:    6,
  fase:              7,
  fecha_inicio:      8,
  fecha_fin_estim:   9,
  fecha_fin_real:    10,
  fecha_facturada:   11,
  fecha_cobrada:     12,
  notas:             14,
  created_at:        15,
  updated_at:        17,
  borrado:           19,
  total_eur:         22,
  facturada:         24,
  cobrada:           25,
  codigo_ot:         26,
};

const FASES_OT_FUERA = new Set(["18_COBRADA"]);
const FASES_OO_FUERA = new Set(["COBRADA"]);

function autoMarcarHitosOT(otRow, horasTrabajadas) {
  const v = (col) => String((otRow && otRow[col]) || "").trim();
  const isOK = (col) => v(col).toUpperCase() === "OK";
  const hasDate = (col) => v(col).length > 0;
  const num = (col) => {
    const n = parseFloat(v(col).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const out = {};
  if (isOK(OT_C.materiales_pedidos))      out["12_materiales"]   = true;
  if (isOK(OT_C.presidente_avisado))      out["12_presidente"]   = true;
  if (isOK(OT_C.llaves_obtenidas))        out["12_llaves"]       = true;
  if (v(OT_C.operarios_asignados))        out["12_operarios"]    = true;
  if (hasDate(OT_C.fecha_inicio_obra))    out["12_fecha_inicio"] = true;
  const horas = Number(horasTrabajadas) || 0;
  if (hasDate(OT_C.fecha_inicio_real) || horas > 0) out["13_arrancada"] = true;

  const numCertsEmitidas = num(OT_C.num_certificaciones);
  const numCertsEsperadas = Math.floor(horas / HORAS_POR_CERT_OBRA);
  if (numCertsEmitidas >= numCertsEsperadas && (numCertsEsperadas > 0 || numCertsEmitidas > 0)) {
    out["13_certif_obra"] = true;
  }

  if (num(OT_C.pct_avance) >= 100)        out["13_finalizada"]   = true;
  if (hasDate(OT_C.fecha_factura_emitida) || isOK(OT_C.factura_emitida)) out["14_factura"] = true;
  if (isOK(OT_C.certificados_entregados)) out["14_certificados"] = true;
  if (hasDate(OT_C.visita_inspector_fecha)) out["15_fecha_visita"] = true;
  if (isOK(OT_C.visto_bueno))               out["15_visto_bueno"]  = true;
  if (hasDate(OT_C.fecha_montaje))          out["16_fecha_montaje"] = true;
  if (isOK(OT_C.contadores_montados))       out["16_contadores"]    = true;
  if (hasDate(OT_C.cobro_emasesa_fecha))    out["17_fecha_cobro"]    = true;
  if (isOK(OT_C.transferencia_recibida))    out["17_transferencia"]  = true;
  return out;
}

function detalleCertObra(otRow, horasTrabajadas) {
  const horas = Number(horasTrabajadas) || 0;
  const numCertsEmitidas = Number(String((otRow && otRow[OT_C.num_certificaciones]) || "0").replace(",", ".")) || 0;
  const numCertsEsperadas = Math.floor(horas / HORAS_POR_CERT_OBRA);
  const horasDesdeUltima = horas - (numCertsEmitidas * HORAS_POR_CERT_OBRA);
  const horasParaProxima = Math.max(0, HORAS_POR_CERT_OBRA - horasDesdeUltima);

  if (numCertsEmitidas < numCertsEsperadas) {
    const falta = numCertsEsperadas - numCertsEmitidas;
    return `⚠ ${numCertsEmitidas}/${numCertsEsperadas} · faltan ${falta} cert · ${Math.round(horas)}h trabajadas`;
  }
  if (numCertsEsperadas === 0 && horas > 0) {
    return `${Math.round(horas)}h trabajadas · primera cert a las ${HORAS_POR_CERT_OBRA}h (faltan ${Math.round(horasParaProxima)}h)`;
  }
  if (numCertsEsperadas === 0) {
    return `Sin horas trabajadas aun`;
  }
  return `${numCertsEmitidas}/${numCertsEsperadas} · proxima en ${Math.round(horasParaProxima)}h`;
}

function detalleArrancada(otRow, horasTrabajadas) {
  const horas = Number(horasTrabajadas) || 0;
  const fechaInicioReal = String((otRow && otRow[OT_C.fecha_inicio_real]) || "").trim();
  if (horas > 0) return `${Math.round(horas)}h trabajadas hasta hoy`;
  if (fechaInicioReal) return `Inicio: ${fechaInicioReal} · sin horas aun`;
  return `Sin horas trabajadas aun`;
}

function autoMarcarHitosOO(ooRow) {
  const v = (col) => String((ooRow && ooRow[col]) || "").trim();
  const isTrue = (col) => v(col).toUpperCase() === "TRUE" || v(col).toUpperCase() === "OK" || v(col) === "1";
  const hasDate = (col) => v(col).length > 0;

  const out = {};
  if (hasDate(OO_C.fecha_inicio))    out["oo_fecha_inicio"] = true;
  if (hasDate(OO_C.fecha_fin_real))  out["oo_finalizada"]   = true;
  if (isTrue(OO_C.facturada) || hasDate(OO_C.fecha_facturada)) out["oo_factura"] = true;
  if (isTrue(OO_C.cobrada)   || hasDate(OO_C.fecha_cobrada))   out["oo_cobro"]   = true;
  return out;
}

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

const FASES_JM_COMERCIAL = new Set(["09_FINANCIACION", "10_BLOQUEOS", "11_PREPARADA"]);
const FASES_OT_VISIBLES  = new Set([
  "12_INICIO_OBRA", "13_EN_EJECUCION", "14_FINALIZADA",
  "15_VISITA_INSPECTOR", "16_MONTAJE_CONTADORES", "17_COBRO_EMASESA",
]);

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
  let registrosMod = null;
  try { registrosMod = require("./ara-os-registros-tiempo.cjs"); } catch (e) {}

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

  async function leerOTPorComunidad() {
    const rows = await leerHojaSafe("ordenes_trabajo!A2:AI");
    const mapa = new Map();
    for (const row of rows) {
      const com = String(row[OT_C.comunidad] || "").trim();
      if (!com) continue;
      mapa.set(claveComunidad(com), row);
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

  async function leerHorasPorComunidad() {
    if (!registrosMod || typeof registrosMod.getHorasAcumuladasMap !== "function") {
      return {};
    }
    try {
      return await registrosMod.getHorasAcumuladasMap();
    } catch (e) {
      console.warn("[hitos-jm/leerHorasPorComunidad]", e.message);
      return {};
    }
  }

  async function leerObrasOtrasActivas() {
    const rows = await leerHojaSafe("obras_otras!A2:AG");
    const activas = [];
    for (const row of rows) {
      const obraId = String(row[OO_C.obra_id] || "").trim();
      if (!obraId) continue;
      const borrado = String(row[OO_C.borrado] || "").trim().toUpperCase();
      if (borrado === "TRUE") continue;
      const fase = String(row[OO_C.fase] || "").trim().toUpperCase();
      if (!fase) continue;
      if (FASES_OO_FUERA.has(fase)) continue;
      activas.push(row);
    }
    return activas;
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

  async function leerEstadoActual() {
    await asegurarPestana();
    const rows = await leerHojaSafe("obras_hitos_jm!A2:F");
    const hitosPorObra = new Map();
    const notaPorObra  = new Map();
    for (const row of rows) {
      const ccpp = String(row[0] || "").trim();
      const hito = String(row[2] || "").trim();
      if (!ccpp || !hito) continue;

      if (hito === HITO_NOTA_OBRA) {
        notaPorObra.set(ccpp, {
          nota:      String(row[5] || ""),
          fecha:     String(row[3] || "").trim(),
          actor:     String(row[4] || "").trim(),
        });
        continue;
      }

      if (!hitosPorObra.has(ccpp)) hitosPorObra.set(ccpp, new Map());
      hitosPorObra.get(ccpp).set(hito, {
        fase:      String(row[1] || "").trim(),
        hito_id:   hito,
        hecho_en:  String(row[3] || "").trim(),
        hecho_por: String(row[4] || "").trim(),
        nota:      String(row[5] || ""),
      });
    }
    return { hitosPorObra, notaPorObra };
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
    res.json({ ok: true, version: "0.10.4", catalogo: CATALOGO_HITOS });
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
      const idxUltMod      = idxBy["ultima_modificacion"];
      const idxFechaCycp   = idxBy["fecha_cycp_completa"];
      const idxAdmin       = idxBy["administrador"];
      const idxTelPres     = idxBy["telefono_presidente"];
      const idxPresidente  = idxBy["presidente"];

      let umbrales = {};
      if (umbralesMod && typeof umbralesMod.leerUmbrales === "function") {
        try { umbrales = await umbralesMod.leerUmbrales(); } catch (e) {}
      }
      const umbralesCombinados = { ...UMBRALES_OO, ...umbrales };

      const otPorCom     = await leerOTPorComunidad();
      const pagosPorCom  = await leerPagosPorComunidad();
      const custodiaCom  = await leerCustodiaPorComunidad();
      const horasPorCom  = await leerHorasPorComunidad();
      const oorRows      = await leerObrasOtrasActivas();
      const { hitosPorObra, notaPorObra } = await leerEstadoActual();

      const stats = {
        total_filas:         data.length,
        sin_comunidad:       0,
        descartadas:         0,
        visibles_emasesa:    0,
        visibles_oo:         0,
        en_ot:               0,
        en_comercial:        0,
        excluidas_cobrada:   0,
        clasif_fases:        {},
      };

      const obras = [];

      for (const row of data) {
        const comunidad = String(row[idxComunidad] || "").trim();
        if (!comunidad) { stats.sin_comunidad++; continue; }

        const fasePresup = (idxFase != null) ? String(row[idxFase] || "").trim() : "";
        const claveCom = claveComunidad(comunidad);
        const otRow = otPorCom.get(claveCom);
        const faseOT = otRow ? String(otRow[OT_C.fase_ot] || "").trim() : "";

        let fase = "";
        let origenFase = "";
        let fechaRef = "";

        if (faseOT && FASES_OT_FUERA.has(faseOT)) {
          stats.excluidas_cobrada++;
          continue;
        }

        if (faseOT && FASES_OT_VISIBLES.has(faseOT)) {
          fase = faseOT;
          origenFase = "ot";
          fechaRef = String(otRow[OT_C.ultima_modificacion] || "").trim();
          stats.en_ot++;
        } else {
          const pagos = pagosPorCom.get(claveCom) || { financia: 0, pendiente_f: 0 };
          const tieneFinReal    = pagos.financia    > 0;
          const tienePendienteF = pagos.pendiente_f > 0;
          const fasesPanel = clasificarFasesObra(fasePresup, tieneFinReal, tienePendienteF);
          const faseJm = fasesPanel.find(f => FASES_JM_COMERCIAL.has(f));
          if (!faseJm) { stats.descartadas++; continue; }
          fase = faseJm;
          origenFase = "comercial";
          const ultMod = (idxUltMod    != null) ? String(row[idxUltMod]    || "").trim() : "";
          const fCycp  = (idxFechaCycp != null) ? String(row[idxFechaCycp] || "").trim() : "";
          fechaRef = fCycp || ultMod;
          stats.en_comercial++;
        }

        stats.visibles_emasesa++;
        stats.clasif_fases[fase] = (stats.clasif_fases[fase] || 0) + 1;

        const custodiaEur = custodiaCom.get(claveCom) || 0;
        const tieneCustodia = custodiaEur > 0;

        const direccion = String(row[idxDireccion] || "").trim() || comunidad;
        const ccpp_id   = ccppIdDe(direccion);
        const diasEnFase = diasDesde(fechaRef);

        const u = umbralesCombinados[fase] || {};
        let semaforo = "verde";
        if (diasEnFase != null && u.critico && diasEnFase >= u.critico) semaforo = "rojo";
        else if (diasEnFase != null && u.aviso && diasEnFase >= u.aviso) semaforo = "amarillo";

        const horasObra = Number(horasPorCom[comunidad.trim()] || 0);

        // v0.10.4 — Alerta critica por certificaciones pendientes (cada 32h)
        let alertaCritica = null;
        if (fase === "13_EN_EJECUCION" && otRow) {
          const numCertsEmitidas = parseFloat(
            String(otRow[OT_C.num_certificaciones] || "0").replace(",", ".")
          ) || 0;
          const numCertsEsperadas = Math.floor(horasObra / HORAS_POR_CERT_OBRA);
          const certsFaltan = numCertsEsperadas - numCertsEmitidas;

          if (certsFaltan >= 2) {
            alertaCritica = {
              tipo: "cert_pendiente",
              criticidad: "critico",
              mensaje: `Faltan ${certsFaltan} certificaciones de obra · ${Math.round(horasObra)}h trabajadas`,
            };
            semaforo = "rojo";
          } else if (certsFaltan === 1) {
            alertaCritica = {
              tipo: "cert_pendiente",
              criticidad: "aviso",
              mensaje: `Falta 1 certificacion de obra · ${Math.round(horasObra)}h trabajadas`,
            };
            if (semaforo === "verde") semaforo = "amarillo";
          }
        }

        const subm = hitosPorObra.get(ccpp_id) || new Map();
        const hitosHechos = {};
        for (const [hito_id, info] of subm.entries()) {
          if (info.hecho_en) {
            hitosHechos[hito_id] = {
              hecho_en:  info.hecho_en,
              hecho_por: info.hecho_por,
              nota:      info.nota,
              fuente:    "manual",
            };
          }
        }

        const hitosAuto = otRow ? autoMarcarHitosOT(otRow, horasObra) : {};
        for (const id of Object.keys(hitosAuto)) {
          if (!hitosHechos[id]) {
            hitosHechos[id] = {
              hecho_en:  String(otRow[OT_C.ultima_modificacion] || "").trim(),
              hecho_por: "AUTO",
              nota:      "",
              fuente:    "auto",
            };
          }
        }

        const detalles_hitos = {};
        if (fase === "13_EN_EJECUCION" && otRow) {
          detalles_hitos["13_arrancada"]   = detalleArrancada(otRow, horasObra);
          detalles_hitos["13_certif_obra"] = detalleCertObra(otRow, horasObra);
        }

        const listaCompleta = CATALOGO_HITOS[fase] || [];
        const lista = listaCompleta.filter(h => {
          if (h.condicional === "tiene_custodia" && !tieneCustodia) return false;
          return true;
        });
        const hitosAplicables = lista.map(h => h.id);

        const totalHitos = lista.length;
        const hechos     = lista.filter(h => hitosHechos[h.id]).length;
        const pct        = totalHitos > 0 ? Math.round((hechos / totalHitos) * 100) : 0;

        const notaInfo = notaPorObra.get(ccpp_id);
        const notaLibre = notaInfo && notaInfo.nota ? notaInfo.nota : "";

        obras.push({
          ccpp_id:          ccpp_id,
          tipo:             "emasesa",
          comunidad:        comunidad,
          direccion:        direccion,
          fase:             fase,
          fase_origen:      origenFase,
          fase_presup:      fasePresup,
          fase_ot:          faseOT || "",
          tiene_custodia:   tieneCustodia,
          custodia_eur:     custodiaEur,
          horas_trabajadas: horasObra,
          hitos_aplicables: hitosAplicables,
          presidente:       (idxPresidente != null) ? String(row[idxPresidente] || "").trim() : "",
          telefono:         (idxTelPres    != null) ? String(row[idxTelPres]    || "").trim() : "",
          administrador:    (idxAdmin      != null) ? String(row[idxAdmin]      || "").trim() : "",
          fecha_ref:        fechaRef || null,
          dias_en_fase:     diasEnFase,
          umbral_aviso:     (u.aviso   != null) ? u.aviso   : null,
          umbral_critico:   (u.critico != null) ? u.critico : null,
          semaforo:         semaforo,
          alerta_critica:   alertaCritica,
          hitos_total:      totalHitos,
          hitos_hechos_n:   hechos,
          pct_completo:     pct,
          hitos_hechos:     hitosHechos,
          detalles_hitos:   detalles_hitos,
          nota_libre:       notaLibre,
          nota_libre_fecha: notaInfo ? notaInfo.fecha : "",
          nota_libre_actor: notaInfo ? notaInfo.actor : "",
        });
      }

      for (const row of oorRows) {
        const v = (col) => String((row && row[col]) || "").trim();
        const obraId  = v(OO_C.obra_id);
        const nombre  = v(OO_C.nombre)   || obraId;
        const fase    = "OO_" + v(OO_C.fase).toUpperCase();
        const ccpp_id = obraId;
        const updated = v(OO_C.updated_at);
        const created = v(OO_C.created_at);
        const fechaRef = updated || created || v(OO_C.fecha_inicio);

        const diasEnFase = diasDesde(fechaRef);
        const u = umbralesCombinados[fase] || {};
        let semaforo = "verde";
        if (diasEnFase != null && u.critico && diasEnFase >= u.critico) semaforo = "rojo";
        else if (diasEnFase != null && u.aviso && diasEnFase >= u.aviso) semaforo = "amarillo";

        const subm = hitosPorObra.get(ccpp_id) || new Map();
        const hitosHechos = {};
        for (const [hito_id, info] of subm.entries()) {
          if (info.hecho_en) {
            hitosHechos[hito_id] = {
              hecho_en:  info.hecho_en,
              hecho_por: info.hecho_por,
              nota:      info.nota,
              fuente:    "manual",
            };
          }
        }

        const hitosAuto = autoMarcarHitosOO(row);
        for (const id of Object.keys(hitosAuto)) {
          if (!hitosHechos[id]) {
            hitosHechos[id] = {
              hecho_en:  updated || created || new Date().toISOString(),
              hecho_por: "AUTO",
              nota:      "",
              fuente:    "auto",
            };
          }
        }

        const listaCompleta = CATALOGO_HITOS[fase] || [];
        const lista = listaCompleta.slice();
        const hitosAplicables = lista.map(h => h.id);

        const totalHitos = lista.length;
        const hechos     = lista.filter(h => hitosHechos[h.id]).length;
        const pct        = totalHitos > 0 ? Math.round((hechos / totalHitos) * 100) : 0;

        const notaInfo = notaPorObra.get(ccpp_id);
        const notaLibre = notaInfo && notaInfo.nota ? notaInfo.nota : "";

        const totalEur = parseImporteSimple(row[OO_C.total_eur] || row[OO_C.importe_legacy]);

        stats.visibles_oo++;

        obras.push({
          ccpp_id:          ccpp_id,
          tipo:             "otra",
          comunidad:        nombre,
          direccion:        v(OO_C.direccion),
          fase:             fase,
          fase_origen:      "oo",
          fase_presup:      "",
          fase_ot:          "",
          tiene_custodia:   false,
          custodia_eur:     0,
          hitos_aplicables: hitosAplicables,
          presidente:       v(OO_C.cliente),
          telefono:         v(OO_C.telefono),
          administrador:    "",
          codigo_ot:        v(OO_C.codigo_ot),
          tipo_obra:        v(OO_C.tipo),
          importe_eur:      totalEur,
          fecha_ref:        fechaRef || null,
          dias_en_fase:     diasEnFase,
          umbral_aviso:     (u.aviso   != null) ? u.aviso   : null,
          umbral_critico:   (u.critico != null) ? u.critico : null,
          semaforo:         semaforo,
          alerta_critica:   null,
          hitos_total:      totalHitos,
          hitos_hechos_n:   hechos,
          pct_completo:     pct,
          hitos_hechos:     hitosHechos,
          detalles_hitos:   {},
          nota_libre:       notaLibre,
          nota_libre_fecha: notaInfo ? notaInfo.fecha : "",
          nota_libre_actor: notaInfo ? notaInfo.actor : "",
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
        version: "0.10.4",
        total: obras.length,
        total_emasesa: stats.visibles_emasesa,
        total_oo: stats.visibles_oo,
        horas_por_cert_obra: HORAS_POR_CERT_OBRA,
        catalogo: CATALOGO_HITOS,
        umbrales: umbralesCombinados,
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
        version: "0.10.4",
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

  app.options("/api/ara-os/hitos-jm/nota-obra", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/hitos-jm/nota-obra", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const body = req.body || {};
      const ccpp_id = body.ccpp_id;
      const nota    = body.nota != null ? String(body.nota) : "";
      const actor   = body.actor;
      if (!ccpp_id) {
        return res.status(400).json({ error: "Falta ccpp_id" });
      }
      await asegurarPestana();
      const ahora = new Date().toISOString();
      const fila = [
        String(ccpp_id),
        "",
        HITO_NOTA_OBRA,
        ahora,
        String(actor || "JM"),
        nota,
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
          tipo:  "nota_obra_jm",
          ccpp_id: ccpp_id,
          detalle: nota ? ("Nota: " + nota.slice(0, 80)) : "Nota borrada",
        });
      } catch (e) {}

      res.json({
        ok: true,
        version: "0.10.4",
        ccpp_id: ccpp_id,
        nota: nota,
        fecha: ahora,
        actor: actor || "JM",
      });
    } catch (err) {
      console.error("[hitos-jm/nota-obra]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[hitos-jm] v0.10.4 cargado · alerta cert pendiente");
};

module.exports.CATALOGO_HITOS = CATALOGO_HITOS;
module.exports.UMBRALES_OO = UMBRALES_OO;
module.exports.HORAS_POR_CERT_OBRA = HORAS_POR_CERT_OBRA;
module.exports.clasificarFasesObra = clasificarFasesObra;
module.exports.claveComunidad = claveComunidad;
module.exports.autoMarcarHitosOT = autoMarcarHitosOT;
module.exports.autoMarcarHitosOO = autoMarcarHitosOO;
module.exports.detalleCertObra = detalleCertObra;
module.exports.detalleArrancada = detalleArrancada;
