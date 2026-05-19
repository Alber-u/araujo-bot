// ============================================================
// ARA OS — Integración Holded (lectura) · v0.3.2 (19/05/2026)
//
// Cambios v0.3.2:
//   · normalizarPurchase devuelve también `pagado_eur` y
//     `pendiente_eur` (deriva de paymentsTotal/pending o, en su
//     defecto, de status/paid).
//   · /gastos-por-obra devuelve además agregado `totales` con
//     subtotal_eur, iva_eur, total_eur, pagado_eur, pendiente_eur.
//     Compat: `total_eur` sigue presente al mismo nivel.
//
// Cambios v0.3.1:
//   · obtenerPurchases() ahora pagina /documents/purchase iterando
//     page=1,2,3... hasta agotar (tope duro 50 páginas).
//     Holded a veces silenciosamente trunca a 100/página y a veces
//     a 500; sin paginar, se perdían docs antiguos.
//   · Dedupe por id (algunos endpoints Holded repiten el último
//     doc al pasar el tope).
//   · GET /gastos-recibidos devuelve también `paginas_leidas`
//     para diagnóstico.
//
// Cambios v0.3.0:
//   · Soporte de MULTI-TAG por obra. El campo `etiqueta_holded`
//     en la pestaña `holded_etiquetas` ahora puede contener
//     varios tags separados por "|". Ejemplo:
//       "ot25ara00077plancincoccppagata7g|ot25ara00077__plan_cinco_ccpp_agata_7_g"
//     Holded a veces genera dos códigos distintos para el mismo
//     concepto (con/sin guiones bajos). Esto permite asignar
//     ambos a la misma obra y agregarlos.
//   · GET /etiquetas devuelve además `etiquetas: string[]` por obra.
//   · POST /etiquetas acepta `etiqueta_holded` string con "|" o
//     `etiquetas: string[]` (lo serializa con "|").
//   · /gastos-por-obra y /gastos-resumen-obras matchean si ALGUNO
//     de los tags coincide.
//   · Compat total con v0.2.0: 1 tag sigue funcionando.
//
// Cambios v0.2.0:
//   · Nueva pestaña Sheet `holded_etiquetas` (auto-creada).
//   · Endpoints diccionario + cruce gastos-por-obra.
// ============================================================

const { google } = require("googleapis");
const express = require("express");

const HOLDED_API_BASE = "https://api.holded.com/api/invoicing/v1";

const HOJA_ETIQUETAS = "holded_etiquetas";
const ETIQUETAS_HEADERS = [
  "obra_id",
  "etiqueta_holded",
  "nombre_comunidad",
  "tipo_obra",
  "fecha_asignacion",
  "activa",
  "notas",
];

// ============================================================
// CLIENTE SHEETS
// ============================================================
let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

function colLetterFromIdx(i) {
  let s = "";
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

async function leerHojaSafe(rango) {
  const MAX_INTENTOS = 3;
  let ultimoError = null;
  for (let i = 0; i < MAX_INTENTOS; i++) {
    try {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: rango,
      });
      return res.data.values || [];
    } catch (err) {
      ultimoError = err;
      const msg = (err && err.message) || "";
      const esRateLimit =
        msg.includes("Quota exceeded") ||
        msg.includes("rateLimitExceeded") ||
        msg.includes("429") ||
        (err && err.code === 429);
      if (!esRateLimit) throw err;
      const esperaMs = 1000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  throw ultimoError || new Error(`Rate limit persistente al leer ${rango}`);
}

function filasAObjetos(filas, headers) {
  return filas.map((f) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = f[i] !== undefined ? f[i] : ""; });
    return o;
  });
}

async function leerTabla(nombre, headers) {
  const lastCol = colLetterFromIdx(headers.length - 1);
  const filas = await leerHojaSafe(`${nombre}!A2:${lastCol}`);
  return filasAObjetos(filas, headers);
}

// ============================================================
// ASEGURAR PESTAÑA holded_etiquetas
// ============================================================
let _pestanasOK = false;
async function asegurarPestanas() {
  if (_pestanasOK) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  });
  const existentes = new Set((meta.data.sheets || [])
    .map(s => s.properties && s.properties.title)
    .filter(Boolean));

  const lastCol = colLetterFromIdx(ETIQUETAS_HEADERS.length - 1);
  if (!existentes.has(HOJA_ETIQUETAS)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: HOJA_ETIQUETAS } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${HOJA_ETIQUETAS}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [ETIQUETAS_HEADERS] },
    });
    console.log(`[holded] Tab ${HOJA_ETIQUETAS} creada`);
  } else {
    const filaActual = (await leerHojaSafe(`${HOJA_ETIQUETAS}!A1:${lastCol}1`))[0] || [];
    const desactualizada = filaActual.length < ETIQUETAS_HEADERS.length ||
      ETIQUETAS_HEADERS.some((h, i) => filaActual[i] !== h);
    if (desactualizada) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA_ETIQUETAS}!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [ETIQUETAS_HEADERS] },
      });
      console.log(`[holded] Headers ${HOJA_ETIQUETAS} actualizados`);
    }
  }
  _pestanasOK = true;
}

// ============================================================
// LECTURA OBRAS
// ============================================================
async function leerObrasPlan5() {
  const crypto = require("crypto");
  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }
  const FASES_OK = new Set([
    "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP",
    "09_FINANCIACION","10_BLOQUEOS","11_PREPARADA",
  ]);
  const filas = await leerHojaSafe("comunidades!A2:BG");
  const obras = [];
  for (const r of filas) {
    const comunidad = r[0] || "";
    const direccion = r[1] || "";
    const fase = r[15] || "";
    if (!comunidad || !direccion) continue;
    if (!FASES_OK.has(fase)) continue;
    obras.push({
      obra_id: ccppId(direccion),
      nombre: comunidad,
      tipo_obra: "plan5",
      fase,
      direccion,
    });
  }
  return obras;
}

async function leerObrasOtras() {
  let filas;
  try {
    filas = await leerHojaSafe("obras_otras!A2:T");
  } catch (e) {
    console.warn("[holded] obras_otras no accesible:", e.message);
    return [];
  }
  const FASES_OK = new Set(["INICIO_OBRA", "EN_EJECUCION", "FINALIZADA"]);
  const obras = [];
  for (const r of filas) {
    const obra_id = r[0] || "";
    const nombre = r[1] || "";
    const fase = r[7] || "";
    const fecha_inicio = r[8] || "";
    const borrado = String(r[19] || "").toUpperCase() === "TRUE";
    if (!obra_id || !nombre || borrado) continue;
    if (!FASES_OK.has(fase)) continue;
    obras.push({
      obra_id, nombre,
      tipo_obra: "otras",
      fase,
      fecha_inicio,
    });
  }
  return obras;
}

async function leerFechaDocumentacion(obrasPlan5, obrasOtras) {
  const out = {};
  try {
    const filas = await leerHojaSafe("obra_fase_historial!A2:G");
    const primerEntrada = {};
    for (const r of filas) {
      const ccpp = r[0] || "";
      const fase_destino = r[3] || "";
      const fecha = r[4] || "";
      if (fase_destino !== "05_DOCUMENTACION") continue;
      if (!primerEntrada[ccpp] || fecha < primerEntrada[ccpp]) {
        primerEntrada[ccpp] = fecha;
      }
    }
    for (const o of obrasPlan5) {
      if (primerEntrada[o.obra_id]) {
        out[o.obra_id] = String(primerEntrada[o.obra_id]).slice(0, 10);
      }
    }
  } catch (e) {
    console.warn("[holded] obra_fase_historial no accesible:", e.message);
  }
  for (const o of obrasOtras) {
    if (o.fecha_inicio) {
      out[o.obra_id] = String(o.fecha_inicio).slice(0, 10);
    }
  }
  return out;
}

// ============================================================
// HOLDED API
// ============================================================
function getApiKey() {
  return process.env.HOLDED_API_KEY || "";
}

async function fetchHolded(path, params = {}) {
  const key = getApiKey();
  if (!key) {
    return { ok: false, status: 500, error: "Falta HOLDED_API_KEY en entorno" };
  }
  let url = `${HOLDED_API_BASE}${path}`;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const qsStr = qs.toString();
  if (qsStr) url += `?${qsStr}`;
  try {
    const t0 = Date.now();
    const r = await fetch(url, {
      method: "GET",
      headers: { "key": key, "Accept": "application/json" },
    });
    const latency = Date.now() - t0;
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* */ }
    if (!r.ok) {
      return {
        ok: false, status: r.status,
        error: `Holded respondió ${r.status}`,
        body_raw: text.slice(0, 500),
        latency,
      };
    }
    return { ok: true, status: r.status, data, latency };
  } catch (e) {
    return { ok: false, status: 500, error: e.message };
  }
}

let _cachePurchases = null;
let _cachePurchasesTs = 0;
const CACHE_TTL_MS = 60 * 1000;

async function obtenerPurchases({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && _cachePurchases && (ahora - _cachePurchasesTs) < CACHE_TTL_MS) {
    return { docs: _cachePurchases, cached: true, edad_ms: ahora - _cachePurchasesTs };
  }
  // v0.4.0: paginar /documents/purchase hasta agotar.
  // Holded a veces devuelve 100/página, a veces más, dependiendo del plan.
  // Iteramos page=1,2,3... hasta que llegue una página vacía o repetida.
  const MAX_PAGES = 50;          // tope duro de seguridad (5000+ docs)
  const PAGE_LIMIT_HINT = 500;   // sugerencia a Holded por si lo respeta
  const seenIds = new Set();
  const docs = [];
  let paginasLeidas = 0;
  let ultimoConteo = -1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetchHolded("/documents/purchase", { page, limit: PAGE_LIMIT_HINT });
    if (!r.ok) {
      // si la primera página falla → error fatal; si una posterior falla → corte
      if (page === 1) {
        return { error: r.error, status: r.status, body_raw: r.body_raw };
      }
      console.warn(`[holded] paginación cortada en page=${page}: ${r.error}`);
      break;
    }
    const lote = Array.isArray(r.data) ? r.data : (r.data?.documents || []);
    if (!Array.isArray(lote) || lote.length === 0) break; // fin natural

    // Dedupe por id (algunos endpoints Holded devuelven el último doc repetido al pasar de tope)
    let nuevos = 0;
    for (const d of lote) {
      const id = d && d.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      docs.push(d);
      nuevos += 1;
    }
    paginasLeidas = page;
    // Si esta página no aportó NUEVOS docs, asumimos final/loop y salimos
    if (nuevos === 0) break;
    // Si la API devolvió menos del límite, probablemente es la última página
    if (lote.length < PAGE_LIMIT_HINT) break;
    // Protección extra: si dos páginas seguidas tienen el mismo conteo exacto
    // y son < límite, asumir fin
    if (lote.length === ultimoConteo && lote.length < PAGE_LIMIT_HINT) break;
    ultimoConteo = lote.length;
  }
  console.log(`[holded] paginación: ${paginasLeidas} página(s), ${docs.length} docs únicos`);
  _cachePurchases = docs;
  _cachePurchasesTs = ahora;
  return { docs, cached: false, edad_ms: 0, paginas_leidas: paginasLeidas };
}

function normalizarPurchase(d) {
  const total = Number(d.total || 0);
  // v0.3.2: importes Pagado / Pendiente.
  // Holded suele exponer paymentsTotal y pending; si no existen,
  // derivamos de status (2 = pagado) o paid boolean.
  let pagado_eur = Number(
    d.paymentsTotal !== undefined ? d.paymentsTotal :
    (d.paid_amount !== undefined ? d.paid_amount : 0)
  );
  let pendiente_eur = Number(
    d.pending !== undefined ? d.pending :
    (d.paymentsPending !== undefined ? d.paymentsPending : null)
  );
  // Si ninguno de esos campos vino, fallback por status
  if (!Number.isFinite(pagado_eur) || pagado_eur === 0) {
    if (d.status === 2 || d.paid === true) pagado_eur = total;
  }
  if (!Number.isFinite(pendiente_eur) || pendiente_eur === null) {
    pendiente_eur = Math.max(0, total - pagado_eur);
  }
  return {
    id: d.id || null,
    numero: d.docNumber || d.number || "",
    fecha: d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : null,
    fecha_vto: d.dueDate ? new Date(d.dueDate * 1000).toISOString().slice(0, 10) : null,
    proveedor: d.contactName || d.contact || "",
    proveedor_id: d.contact || null,
    descripcion: d.description || d.desc || "",
    subtotal: Number(d.subtotal || 0),
    iva: Number(d.tax || 0),
    total,
    pagado_eur,
    pendiente_eur,
    estado: d.status || "",
    pagado: !!d.paid,
    tags: Array.isArray(d.tags) ? d.tags : [],
  };
}

function fechaAUnix(fecha_iso) {
  if (!fecha_iso) return null;
  const d = new Date(`${fecha_iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

function rangoDefaultMesYAnterior() {
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
  const toISO = d => d.toISOString().slice(0, 10);
  return { desde: toISO(desde), hasta: toISO(hasta) };
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// v0.3.0: tags por obra separados por "|". Tolerante a coma y
// punto-y-coma como separadores secundarios, espacios extra, etc.
function parseTagsCSV(s) {
  if (!s) return [];
  return String(s)
    .split(/[|,;]/)
    .map(t => t.trim())
    .filter(Boolean);
}

function serializeTagsCSV(arr) {
  return (arr || []).map(t => String(t).trim()).filter(Boolean).join("|");
}

// ============================================================
// MÓDULO
// ============================================================
module.exports = function setupAraOSHolded(app) {

  // JSON body parser scoped only to Holded routes (no afecta resto)
  app.use("/api/ara-os/holded", express.json({ limit: "1mb" }));

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // ============================================================
  // GET /ping
  // ============================================================
  app.options("/api/ara-os/holded/ping", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/ping", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const r = await fetchHolded("/contacts", { page: 1 });
    res.json({
      ok: true, version: "0.3.2",
      ts: new Date().toISOString(),
      holded_ok: r.ok, holded_status: r.status,
      holded_latency_ms: r.latency,
      holded_error: r.ok ? null : r.error,
      sample_count: r.ok && Array.isArray(r.data) ? r.data.length : null,
      sample_first: r.ok && Array.isArray(r.data) && r.data[0]
        ? { name: r.data[0].name || null, id: r.data[0].id || null }
        : null,
      key_presente: !!getApiKey(),
    });
  });

  // ============================================================
  // GET /gastos-recibidos
  // ============================================================
  app.options("/api/ara-os/holded/gastos-recibidos", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/gastos-recibidos", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const def = rangoDefaultMesYAnterior();
    const desde = String(req.query.desde || def.desde);
    const hasta = String(req.query.hasta || def.hasta);
    const ts_desde = fechaAUnix(desde);
    const ts_hasta = fechaAUnix(hasta);
    if (!ts_desde || !ts_hasta) {
      return res.status(400).json({ ok: false, error: "Fechas inválidas (esperado YYYY-MM-DD)" });
    }

    const r = await obtenerPurchases();
    if (r.error) {
      return res.status(502).json({
        ok: false, version: "0.3.2",
        error: r.error, holded_status: r.status,
        body_raw: r.body_raw || null,
      });
    }
    const docsFiltrados = r.docs.filter((d) => {
      const ts = Number(d.date || 0);
      return ts >= ts_desde && ts <= (ts_hasta + 86400);
    });
    const gastos = docsFiltrados.map(normalizarPurchase);

    res.json({
      ok: true, version: "0.3.2",
      ts: new Date().toISOString(),
      rango: { desde, hasta },
      count_total_holded: r.docs.length,
      paginas_leidas: r.paginas_leidas,
      count: gastos.length,
      total_eur: gastos.reduce((s, g) => s + g.total, 0),
      cached: r.cached, cache_edad_ms: r.edad_ms,
      gastos,
    });
  });

  // ============================================================
  // GET /tags-disponibles
  // ============================================================
  app.options("/api/ara-os/holded/tags-disponibles", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/tags-disponibles", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const r = await obtenerPurchases();
    if (r.error) return res.status(502).json({ ok: false, version: "0.3.2", error: r.error });

    const tagsMap = {};
    for (const d of r.docs) {
      const tags = Array.isArray(d.tags) ? d.tags : [];
      const total = Number(d.total || 0);
      for (const t of tags) {
        if (!t || typeof t !== "string") continue;
        if (!tagsMap[t]) tagsMap[t] = { tag: t, count: 0, total_eur: 0 };
        tagsMap[t].count += 1;
        tagsMap[t].total_eur += total;
      }
    }
    const tags = Object.values(tagsMap).sort((a, b) => b.total_eur - a.total_eur);

    res.json({
      ok: true, version: "0.3.2",
      ts: new Date().toISOString(),
      total_purchases: r.docs.length,
      total_tags: tags.length,
      cached: r.cached,
      tags,
    });
  });

  // ============================================================
  // GET /etiquetas
  // ============================================================
  app.options("/api/ara-os/holded/etiquetas", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/etiquetas", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      await asegurarPestanas();
      const [etiquetasRaw, obrasPlan5, obrasOtras] = await Promise.all([
        leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS),
        leerObrasPlan5(),
        leerObrasOtras(),
      ]);
      const fechasDoc = await leerFechaDocumentacion(obrasPlan5, obrasOtras);

      const idxEtiquetas = {};
      for (const e of etiquetasRaw) {
        if (e.obra_id) idxEtiquetas[e.obra_id] = e;
      }

      const todasObras = [...obrasPlan5, ...obrasOtras];
      const obras = todasObras.map((o) => {
        const e = idxEtiquetas[o.obra_id] || null;
        const etiquetaStr = e ? (e.etiqueta_holded || "") : "";
        const etiquetas = parseTagsCSV(etiquetaStr);
        return {
          obra_id: o.obra_id,
          nombre: o.nombre,
          tipo_obra: o.tipo_obra,
          fase: o.fase,
          fecha_documentacion: fechasDoc[o.obra_id] || null,
          etiqueta_holded: etiquetaStr,
          etiquetas,                         // v0.3.0: array
          activa: e ? (String(e.activa).toUpperCase() === "TRUE") : false,
          fecha_asignacion: e ? (e.fecha_asignacion || "") : "",
          notas: e ? (e.notas || "") : "",
          tiene_etiqueta: etiquetas.length > 0,
        };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));

      const asignadas = obras.filter(o => o.tiene_etiqueta).length;

      res.json({
        ok: true, version: "0.3.2",
        ts: new Date().toISOString(),
        total_obras: obras.length,
        asignadas,
        pendientes: obras.length - asignadas,
        obras,
      });
    } catch (e) {
      console.error("[holded/etiquetas GET]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // POST /etiquetas
  // ============================================================
  app.post("/api/ara-os/holded/etiquetas", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const body = req.body || {};
      const obra_id = String(body.obra_id || "").trim();
      // v0.3.0: aceptar string "tag1|tag2" o array ["tag1","tag2"]
      let etiquetaStr = "";
      if (Array.isArray(body.etiquetas)) {
        etiquetaStr = serializeTagsCSV(body.etiquetas);
      } else if (body.etiqueta_holded !== undefined) {
        etiquetaStr = serializeTagsCSV(parseTagsCSV(body.etiqueta_holded));
      }
      const tipo_obra = String(body.tipo_obra || "").trim() || "plan5";
      const nombre_comunidad = String(body.nombre_comunidad || "").trim();
      const notas = String(body.notas || "").trim();
      if (!obra_id) {
        return res.status(400).json({ ok: false, error: "Falta obra_id" });
      }

      await asegurarPestanas();
      const existentes = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
      const filaIdx = existentes.findIndex(e => e.obra_id === obra_id);
      const valores = [
        obra_id,
        etiquetaStr,
        nombre_comunidad,
        tipo_obra,
        hoyISO(),
        etiquetaStr ? "TRUE" : "FALSE",
        notas,
      ];

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(ETIQUETAS_HEADERS.length - 1);
      if (filaIdx >= 0) {
        const filaSheet = filaIdx + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_ETIQUETAS}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_ETIQUETAS}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      }

      res.json({
        ok: true, version: "0.3.2",
        accion: filaIdx >= 0 ? "actualizada" : "creada",
        obra_id,
        etiqueta_holded: etiquetaStr,
        etiquetas: parseTagsCSV(etiquetaStr),
      });
    } catch (e) {
      console.error("[holded/etiquetas POST]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // GET /gastos-por-obra/:obra_id
  // ============================================================
  app.options("/api/ara-os/holded/gastos-por-obra/:obra_id", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/gastos-por-obra/:obra_id", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);

      const etiquetas = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
      const fila = etiquetas.find(e => e.obra_id === obra_id);
      const tagsObra = fila ? parseTagsCSV(fila.etiqueta_holded) : [];
      if (!tagsObra.length) {
        return res.json({
          ok: true, version: "0.3.2", obra_id,
          etiqueta_holded: null,
          etiquetas: [],
          mensaje: "Obra sin etiqueta asignada.",
          count: 0, total_eur: 0, desglose: [], gastos: [],
        });
      }
      const tagsObraSet = new Set(tagsObra);

      const [obrasPlan5, obrasOtras] = await Promise.all([leerObrasPlan5(), leerObrasOtras()]);
      const fechasDoc = await leerFechaDocumentacion(obrasPlan5, obrasOtras);
      const desde_default = fechasDoc[obra_id] || "2025-01-01";
      const desde = String(req.query.desde || desde_default);
      const hasta = String(req.query.hasta || hoyISO());
      const ts_desde = fechaAUnix(desde);
      const ts_hasta = fechaAUnix(hasta);

      const r = await obtenerPurchases();
      if (r.error) return res.status(502).json({ ok: false, error: r.error });

      const gastosFiltrados = r.docs.filter((d) => {
        const ts = Number(d.date || 0);
        if (ts < ts_desde || ts > (ts_hasta + 86400)) return false;
        const tags = Array.isArray(d.tags) ? d.tags : [];
        // v0.3.0: cualquier tag del documento debe estar en tagsObraSet
        return tags.some(t => tagsObraSet.has(t));
      }).map(normalizarPurchase);

      // v0.3.2: agregados por columna (subtotal, IVA, total, pagado, pendiente)
      const totales = {
        subtotal_eur:  gastosFiltrados.reduce((s, g) => s + g.subtotal, 0),
        iva_eur:       gastosFiltrados.reduce((s, g) => s + g.iva, 0),
        total_eur:     gastosFiltrados.reduce((s, g) => s + g.total, 0),
        pagado_eur:    gastosFiltrados.reduce((s, g) => s + (g.pagado_eur || 0), 0),
        pendiente_eur: gastosFiltrados.reduce((s, g) => s + (g.pendiente_eur || 0), 0),
      };
      const total_eur = totales.total_eur; // compat con v0.3.1

      // Desglose: por tags secundarios (los que NO son tags-de-obra)
      const desglose = {};
      for (const g of gastosFiltrados) {
        const tagsExtra = g.tags.filter(t => !tagsObraSet.has(t));
        const cat = tagsExtra[0] || "sin_categoria";
        if (!desglose[cat]) desglose[cat] = { categoria: cat, count: 0, total_eur: 0 };
        desglose[cat].count += 1;
        desglose[cat].total_eur += g.total;
      }
      const desglose_arr = Object.values(desglose).sort((a, b) => b.total_eur - a.total_eur);

      res.json({
        ok: true, version: "0.3.2",
        ts: new Date().toISOString(),
        obra_id,
        etiqueta_holded: fila.etiqueta_holded || "",
        etiquetas: tagsObra,
        nombre_comunidad: fila.nombre_comunidad || "",
        rango: { desde, hasta },
        count: gastosFiltrados.length,
        total_eur,
        totales,
        desglose: desglose_arr,
        cached: r.cached,
        gastos: gastosFiltrados,
      });
    } catch (e) {
      console.error("[holded/gastos-por-obra]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // GET /gastos-resumen-obras
  // ============================================================
  app.options("/api/ara-os/holded/gastos-resumen-obras", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/gastos-resumen-obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      await asegurarPestanas();
      const [etiquetas, obrasPlan5, obrasOtras] = await Promise.all([
        leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS),
        leerObrasPlan5(),
        leerObrasOtras(),
      ]);
      const fechasDoc = await leerFechaDocumentacion(obrasPlan5, obrasOtras);

      const r = await obtenerPurchases();
      if (r.error) return res.status(502).json({ ok: false, error: r.error });

      const nombrePorObra = {};
      for (const o of [...obrasPlan5, ...obrasOtras]) nombrePorObra[o.obra_id] = o.nombre;

      const desde = req.query.desde ? String(req.query.desde) : null;
      const hasta = req.query.hasta ? String(req.query.hasta) : null;
      const ts_hasta_param = hasta ? fechaAUnix(hasta) : null;

      const obras = [];
      let total_general = 0;
      for (const e of etiquetas) {
        const tagsObra = parseTagsCSV(e.etiqueta_holded);
        if (!tagsObra.length) continue;
        if (String(e.activa).toUpperCase() !== "TRUE") continue;
        const tagsObraSet = new Set(tagsObra);
        const desde_obra = desde || fechasDoc[e.obra_id] || "2025-01-01";
        const ts_desde_obra = fechaAUnix(desde_obra);
        const ts_hasta_obra = ts_hasta_param || fechaAUnix(hoyISO());
        let count = 0, total_eur = 0;
        for (const d of r.docs) {
          const ts = Number(d.date || 0);
          if (ts < ts_desde_obra || ts > (ts_hasta_obra + 86400)) continue;
          const tags = Array.isArray(d.tags) ? d.tags : [];
          if (!tags.some(t => tagsObraSet.has(t))) continue;
          count += 1;
          total_eur += Number(d.total || 0);
        }
        obras.push({
          obra_id: e.obra_id,
          nombre: nombrePorObra[e.obra_id] || e.nombre_comunidad || "",
          etiqueta_holded: e.etiqueta_holded,
          etiquetas: tagsObra,
          desde: desde_obra,
          hasta: hasta || hoyISO(),
          count,
          total_eur,
        });
        total_general += total_eur;
      }
      obras.sort((a, b) => b.total_eur - a.total_eur);

      res.json({
        ok: true, version: "0.3.2",
        ts: new Date().toISOString(),
        total_obras: obras.length,
        total_general,
        cached: r.cached,
        obras,
      });
    } catch (e) {
      console.error("[holded/resumen-obras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

};
