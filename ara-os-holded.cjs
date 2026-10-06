// ============================================================
// ARA OS — Integración Holded (lectura) · v0.5.0 (19/05/2026)
//
// Cambios v0.5.0 [CRÍTICO - corrige bug de datos truncados]:
//   · obtenerPurchases() reescrita por completo. Holded /documents/
//     purchase IGNORA los parámetros `page` y `limit` y devuelve
//     SIEMPRE los últimos ~340 docs. Esto provocaba que ARA OS
//     mostrara datos incompletos por obra y la rentabilidad real
//     fuera incorrecta.
//   · Nueva estrategia: ventanas temporales con starttmp/endtmp.
//     Recorremos de hoy hacia atrás en saltos de 31 días, hasta
//     36 meses (3 años). Dedupe por id.
//   · /gastos-recibidos devuelve `ventanas_leidas` y
//     `ventanas_con_datos` (sustituye paginas_leidas).
//
// Cambios v0.4.1:
//   · /gastos-por-obra y /rentabilidad-obra: rango ilimitado por
//     defecto. Si no se pasa `desde`, ya NO se filtra por fecha
//     mínima (antes era fecha de DOCUMENTACIÓN o 2025-01-01).
//     La paginación trae todas las facturas de Holded.
//   · /rentabilidad-obra: material real se calcula SIN IVA
//     (subtotal_eur) para coste. Se devuelve también el total
//     con IVA para info.
//   · /rentabilidad-obra: nuevo campo `real.presupuesto_real` y
//     `real.presupuesto_fuente` con prioridad de fuente:
//     "contratado" (hoy) | "facturado" (futuro) | "cobrado" (futuro).
//     Hoy siempre devuelve "contratado" = previsto.
//   · Coste real, beneficio real y desvío recalculados con esos
//     valores nuevos.
//
// Cambios v0.4.0:
//   · Nuevo endpoint GET /rentabilidad-obra/:obra_id que combina:
//       - presupuesto (de comunidades o obras_otras)
//       - material real (Holded, suma de gastos por tag)
//       - mano de obra real (registros_tiempo × personas.coste_hora,
//         tipos "trabajo" y "extra", excluye ZZ_ y borrados)
//     Devuelve {previsto, real, desvio, flags} listo para UI.
//   · Helpers nuevos: leerCostesPorPersona, calcularManoObraReal,
//     leerEconomicoObra.
//   · Lectura cruza por nombre_comunidad (igual que registros_tiempo).
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
// P&L del mes (posicion-neta-real): comercial que factura la comisión de las
// obras Plan 5, su % por defecto y etiquetas que nunca son de obra.
const RE_COMISION_COMERCIAL = /hogarko/i;
const COMISION_COMERCIAL_PCT_DEF = 0.20;
const ETIQUETAS_NO_OBRA = new Set(["oficina", "seguros", "seguro", "asesoria", "gestoria", "telefonia", "telefono", "ibi",
  "gasolina", "combustible", "herramientas", "herramienta", "general", "generales", "gastosgenerales",
  "alquiler", "software", "banco", "comisiones", "prl", "vehiculos", "furgoneta", "furgonetas", "itv", "renting", "dietas", "formacion"]);
// Cabeceras y fusión de tags compartidas con ara-os-tags-holded.cjs (ficha)
const {
  ETIQUETAS_HEADERS,
  parseTagsCSV,
  serializeTagsCSV,
  fechaCorta,
  fusionarEtiquetasEnFila,
} = require("./lib/etiquetas-obra.cjs");

// Nóminas reales por mes (coste empresa total). Las introduce el usuario;
// Holded no las expone por la API de facturación. Sirven para calcular el
// coste real por hora del mes (nómina ÷ horas trabajadas).
const HOJA_NOMINAS = "nominas_mes";
const NOMINAS_HEADERS = ["periodo", "importe", "updated_at", "updated_by", "indirectos_eur", "detalle_json"];
// Trabajadores que NO son producción: su nómina va a costes indirectos,
// no a Coste MO. Cada entrada es un conjunto de tokens que deben aparecer
// (en cualquier orden) en el nombre. Alberto Araujo (CEO) y Jose Manuel
// Mendoza (comercial).
const NOMINA_INDIRECTOS = [["araujo", "puerta"], ["mendoza", "terrero"]];
function _normNombre(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function esIndirectoNomina(nombre) {
  const n = _normNombre(nombre);
  return NOMINA_INDIRECTOS.some(toks => toks.every(t => n.includes(t)));
}

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
// HOJA nominas_mes · asegurar pestaña + lectura
// ============================================================
let _hojaNominasOK = false;
async function asegurarHojaNominas() {
  if (_hojaNominasOK) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
  const existentes = new Set((meta.data.sheets || [])
    .map(s => s.properties && s.properties.title).filter(Boolean));
  const lastCol = colLetterFromIdx(NOMINAS_HEADERS.length - 1);
  if (!existentes.has(HOJA_NOMINAS)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: HOJA_NOMINAS } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${HOJA_NOMINAS}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [NOMINAS_HEADERS] },
    });
    console.log(`[holded] Tab ${HOJA_NOMINAS} creada`);
  } else {
    const filaActual = (await leerHojaSafe(`${HOJA_NOMINAS}!A1:${lastCol}1`))[0] || [];
    const desactualizada = filaActual.length < NOMINAS_HEADERS.length ||
      NOMINAS_HEADERS.some((h, i) => filaActual[i] !== h);
    if (desactualizada) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA_NOMINAS}!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [NOMINAS_HEADERS] },
      });
      console.log(`[holded] Headers ${HOJA_NOMINAS} actualizados`);
    }
  }
  _hojaNominasOK = true;
}

function periodoStr(año, mes) {
  return `${año}-${String(mes).padStart(2, "0")}`;
}

function _parseEurFlexible(v) {
  if (v == null || String(v).trim() === "") return null;
  let s = String(v).trim();
  if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.indexOf(",") >= 0) s = s.replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// Fila completa de nómina del mes: { importe(operarios), indirectos, detalle[] } o null.
async function leerNominaRow(año, mes) {
  try {
    await asegurarHojaNominas();
    const filas = await leerTabla(HOJA_NOMINAS, NOMINAS_HEADERS);
    const periodo = periodoStr(año, mes);
    const fila = filas.find(f => String(f.periodo).trim() === periodo);
    if (!fila) return null;
    let detalle = [];
    if (fila.detalle_json && String(fila.detalle_json).trim()) {
      try { const p = JSON.parse(fila.detalle_json); if (Array.isArray(p)) detalle = p; } catch {}
    }
    return {
      importe: _parseEurFlexible(fila.importe),
      indirectos: _parseEurFlexible(fila.indirectos_eur) || 0,
      detalle,
    };
  } catch (e) {
    console.warn("[holded] leerNominaRow falló:", e.message);
    return null;
  }
}

// Devuelve el importe de nómina (operarios) del mes (número) o null.
async function leerNominaMes(año, mes) {
  try {
    const row = await leerNominaRow(año, mes);
    return row ? row.importe : null;
  } catch (e) {
    console.warn("[holded] leerNominaMes falló:", e.message);
    return null;
  }
}

// Extrae de un PDF de resumen de nóminas (base64) el periodo y el coste
// empresa por trabajador usando Claude (mismo patrón que ara-facturas).
async function extraerNominasPDF(base64) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  const prompt = `Eres un asistente que extrae datos de un resumen o "listado de imputación de costes" de nóminas.
Devuelve ÚNICAMENTE JSON válido, sin markdown ni texto extra, con este formato exacto:
{"año":2026,"mes":5,"trabajadores":[{"nombre":"APELLIDOS NOMBRE","coste_empresa":0.00}],"total_coste_empresa":0.00}
Reglas:
- El periodo suele aparecer como "DEL dd/mm/aa AL dd/mm/aa". Usa el MES y AÑO de ese periodo (aa de dos dígitos = 20aa).
- coste_empresa de cada trabajador = valor de su fila "COSTE EMPRESA".
- total_coste_empresa = suma de los coste_empresa de TODOS los trabajadores.
- Números en formato español: "2.759,21" = 2759.21 (punto = miles, coma = decimales).
- Incluye TODOS los trabajadores aunque haya varias páginas.`;
  const body = {
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: prompt },
    ] }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map(c => c.text || "").join("").trim();
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(clean);
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
    "09_FINANCIACION","09_TRAMITADA","10_BLOQUEOS","11_PREPARADA",
    "12_INICIO_OBRA","13_EN_EJECUCION","14_FINALIZADA",
    "15_VISITA_INSPECTOR","16_MONTAJE_CONTADORES","17_COBRO_EMASESA","19_INCIDENCIAS",
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

// v0.4.0: lee `personas` para coste_hora (col U). Devuelve mapa id → coste_hora numérico.

// ============================================================
// obtenerPurchaseRefunds · rectificativas de compra
// Mismo patrón que obtenerPurchases pero endpoint /documents/purchaserefund
// Devuelve docs con total NEGATIVO para restar del coste real
// ============================================================
let _cacheRefunds = null;
let _cacheRefundsTs = 0;

async function obtenerPurchaseRefunds({ force = false, mesesHaciaAtras = 36 } = {}) {
  const ahora = Date.now();
  if (!force && _cacheRefunds && (ahora - _cacheRefundsTs) < CACHE_TTL_MS) {
    return { docs: _cacheRefunds, cached: true };
  }
  const SEC_DAY = 86400;
  const seenIds = new Set();
  const docs = [];
  let endCursor = Math.floor(Date.now() / 1000) + SEC_DAY;
  let cortadaRef = null;
  for (let i = 0; i < mesesHaciaAtras; i++) {
    const startCursor = endCursor - (31 * SEC_DAY);
    const r = await fetchHolded("/documents/purchaserefund", {
      starttmp: startCursor,
      endtmp: endCursor,
    });
    if (!r.ok) { if (i === 0) return { error: r.error }; cortadaRef = r.error || "error"; break; }
    const lote = Array.isArray(r.data) ? r.data : (r.data?.documents || []);
    for (const d of lote) {
      const id = d && d.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      docs.push(d);
    }
    endCursor = startCursor - 1;
  }
  // Lectura cortada a medias (Holded 503…): no se guarda, se reintenta en la siguiente
  if (!cortadaRef) {
    _cacheRefunds = docs;
    _cacheRefundsTs = Date.now();   // desde que TERMINA la lectura
  }
  return { docs, cached: false };
}

// v0.6.1 (11/09/2026): rectificativas de compra en NEGATIVO, marcadas.
// Los abonos de proveedor (p. ej. devoluciones de material a Aquatubo) restan
// coste a la obra de su etiqueta. Antes solo gastos-por-obra, rentabilidad-obra
// y posicion-neta-real los leían; el listado, el resumen por obra y el
// económico de obras «otras» los ignoraban (8.105 € ene-ago 2026).
function refundsEnNegativo(docs) {
  return (docs || []).map((d) => ({
    ...d,
    subtotal: -Math.abs(Number(d.subtotal || 0)),
    tax: -Math.abs(Number(d.tax || 0)),
    total: -Math.abs(Number(d.total || 0)),
    _tipo: "rectificativa",
  }));
}

async function obtenerComprasConRectificativas(opts = {}) {
  const [r, rRef] = await Promise.all([obtenerPurchases(opts), obtenerPurchaseRefunds(opts)]);
  if (r.error) return r;
  const refunds = rRef.error ? [] : refundsEnNegativo(rRef.docs);
  return { ...r, docs: [...r.docs, ...refunds], refunds_count: refunds.length, refunds_error: rRef.error || null };
}

async function leerCostesPorPersona() {
  let filas;
  try {
    filas = await leerHojaSafe("personas!A2:U");
  } catch (e) {
    console.warn("[holded] personas no accesible:", e.message);
    return {};
  }
  const mapa = {};
  const nombres = {};
  for (const r of filas) {
    const id = r[0] || "";
    const nombre = r[1] || id; // col B = nombre
    const fecha_baja = r[9] || "";
    const coste_raw = r[20]; // col U
    if (!id) continue;
    nombres[id] = nombre;
    if (fecha_baja) continue; // ignorar dadas de baja
    // toNum local (mismo patrón que en certificaciones)
    let s = String(coste_raw == null ? "" : coste_raw).trim();
    if (!s) { mapa[id] = 0; continue; }
    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.indexOf(",") >= 0) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    mapa[id] = isFinite(n) ? n : 0;
  }
  mapa.__nombres = nombres;
  return mapa;
}

// v0.4.0: lee `registros_tiempo` y agrega horas por obra (clave = nombre comunidad).
// Devuelve { mano_obra_eur: number, horas_total: number, registros: number }
//   nombre_comunidad: nombre exacto como aparece en la columna E de registros_tiempo
// extra: [{ nombre, factor }] · otros nombres con que se ficha esta obra y la parte que le toca (Urbano Orad:
// lo fichado en «Urbano Orad 13-15», la mitad para cada OO; 06/10/2026)
async function calcularManoObraReal(nombre_comunidad, costesPorPersona, extra = []) {
  if (!nombre_comunidad) return { mano_obra_eur: 0, horas_total: 0, registros: 0 };
  let filas;
  try {
    filas = await leerHojaSafe("registros_tiempo!A2:N");
  } catch (e) {
    console.warn("[holded] registros_tiempo no accesible:", e.message);
    return { mano_obra_eur: 0, horas_total: 0, registros: 0 };
  }
  let mano_obra_eur = 0;
  let horas_total = 0;
  let registros = 0;
  const porPersona = {};
  for (const r of filas) {
    const persona_id = r[2] || "";
    const tipo = r[3] || "";
    const obra_id = r[4] || "";
    const horas_raw = r[5];
    const fecha = r[0] || "";
    const borrado = String(r[13] || "").toUpperCase() === "TRUE";
    if (borrado) continue;
    if (tipo !== "trabajo" && tipo !== "extra") continue;
    const ex = obra_id === nombre_comunidad ? null : extra.find((x) => x.nombre === obra_id);
    if (obra_id !== nombre_comunidad && !ex) continue;
    if (persona_id.startsWith("ZZ_")) continue;
    let h = Number(String(horas_raw || "").replace(",", "."));
    if (!isFinite(h) || h <= 0) continue;
    if (ex) h *= ex.factor;
    horas_total += h;
    registros += 1;
    // Usar snapshot coste_hora del registro (col O, idx 14) si existe, si no el actual
    const coste_hora_snap = r[14] ? Number(String(r[14]).replace(",", ".")) : null;
    const tarifa = (coste_hora_snap && coste_hora_snap > 0) ? coste_hora_snap : (costesPorPersona[persona_id] || 0);
    const coste = h * tarifa;
    mano_obra_eur += coste;
    const nombre_persona = costesPorPersona.__nombres?.[persona_id] || persona_id;
    if (!porPersona[persona_id]) porPersona[persona_id] = { persona_id, nombre: nombre_persona, horas: 0, coste: 0 };
    porPersona[persona_id].horas += h;
    porPersona[persona_id].coste += coste;
  }
  const desglose = Object.values(porPersona);
  return { mano_obra_eur, horas_total, registros, desglose_personas: desglose };
}

// config_dinero «presupuesto_provisional» (excepción temporal, caché 5 min)
let _provCache = null, _provTs = 0;
async function presupuestosProvisionales() {
  if (_provCache && Date.now() - _provTs < 5 * 60 * 1000) return _provCache;
  try {
    const CD = require("./lib/config-dinero.cjs");
    const fila = CD.valorConfig((await CD.leerConfigDinero()).filas, "presupuesto_provisional");
    _provCache = require("./lib/presupuesto-provisional.cjs").leerProvisionales(fila?.valor);
  } catch (e) { console.warn("[presupuesto_provisional]", e.message); _provCache = _provCache || {}; }
  _provTs = Date.now();
  return _provCache;
}

// v0.4.0: lee `comunidades` y devuelve el presupuesto previsto + nombre comunidad por ccpp_id.
// Para obras_otras devuelve importe.
// coste_hora_eur de config_dinero (1 min de caché): coste previsto de mano de obra de las obras privadas
let _costeHora = { v: null, ts: 0 };
async function costeHoraConfig() {
  if (_costeHora.ts && Date.now() - _costeHora.ts < 60 * 1000) return _costeHora.v;
  try {
    const CD = require("./lib/config-dinero.cjs");
    _costeHora = { v: CD.numConfig((await CD.leerConfigDinero()).filas, "coste_hora_eur"), ts: Date.now() };
  } catch (e) { console.warn("[rentabilidad-obra] config_dinero:", e.message); return _costeHora.v; }
  return _costeHora.v;
}

async function leerEconomicoObra(obra_id, obrasPlan5, obrasOtras) {
  const esPlan5 = !obra_id.startsWith("OO-");
  if (esPlan5) {
    // Buscar fila en comunidades por ccpp_id
    const plan5 = obrasPlan5.find(o => o.obra_id === obra_id);
    if (!plan5) return null;
    // Leer fila completa de comunidades para esa direccion
    const filas = await leerHojaSafe("comunidades!A2:BG");
    for (const r of filas) {
      const direccion = r[1] || "";
      if (!direccion) continue;
      // Reconstruir ccpp_id desde direccion y comparar
      const crypto = require("crypto");
      const slug = String(direccion).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const hash = crypto.createHash("md5").update(direccion).digest("hex").slice(0, 6);
      const id = `ccpp_${slug}_${hash}`;
      if (id !== obra_id) continue;
      // r[22] = pto_total (col W idx 22)
      // r[23] = mano_obra_previsto
      // r[24] = mano_obra_real
      // r[25] = material_previsto
      // r[26] = material_real
      // r[27] = beneficio_previsto
      function parseImporte(s) {
        if (s == null || s === "") return 0;
        let v = String(s).trim();
        if (v.indexOf(",") >= 0 && v.indexOf(".") >= 0) v = v.replace(/\./g, "").replace(",", ".");
        else if (v.indexOf(",") >= 0) v = v.replace(",", ".");
        const n = Number(v);
        return isFinite(n) ? n : 0;
      }
      // pto_total vacío o a 0: el provisional de config_dinero si lo hay (manda el panel)
      const prov = require("./lib/presupuesto-provisional.cjs").importeConProvisional(obra_id, parseImporte(r[22]), await presupuestosProvisionales());
      return {
        nombre_comunidad: plan5.nombre,
        pto_total: prov.importe,
        pto_provisional: prov.provisional, pto_provisional_ref: prov.ref,
        mano_obra_previsto: parseImporte(r[23]),
        material_previsto: parseImporte(r[25]),
        beneficio_previsto: parseImporte(r[27]),
      };
    }
    return { nombre_comunidad: plan5.nombre, pto_total: 0, mano_obra_previsto: 0, material_previsto: 0, beneficio_previsto: 0 };
  } else {
    // obras_otras (06/10/2026): presupuesto SIN IVA (subtotal_eur; si no, total ÷ 1,21) y coste previsto del
    // presupuesto: horas_previstas × coste_hora_eur (config_dinero) + material_previsto_eur. Antes: el importe con
    // IVA y coste previsto 0 (Urbano Orad salía en D11 sin coste y con un «beneficio» mayor que su presupuesto).
    const otra = obrasOtras.find(o => o.obra_id === obra_id);
    if (!otra) return null;
    const filas = await leerHojaSafe("obras_otras!A1:AQ");
    const cab = (filas[0] || []).map((h) => String(h || "").trim());
    for (const r of filas.slice(1)) {
      if (r[0] !== obra_id) continue;
      const o = Object.fromEntries(cab.map((h, i) => [h, r[i] == null ? "" : String(r[i])]));
      const PP = require("./lib/presupuesto-privado.cjs");
      const num = (v) => { let t = String(v ?? "").trim(); if (t.indexOf(",") >= 0 && t.indexOf(".") >= 0) t = t.replace(/\./g, "").replace(",", "."); else t = t.replace(",", "."); const n = Number(t); return isFinite(n) ? n : 0; };
      const pv = PP.calcularPrevision({ ...o, total_eur: o.total_eur || o.importe }, { coste_hora_eur: await costeHoraConfig() });
      const pto = pv.subtotal || 0;
      const mo = pv.coste_mano_obra || 0, mat = num(o.material_previsto_eur);
      return {
        nombre_comunidad: otra.nombre,
        pto_total: Math.round(pto * 100) / 100,
        mano_obra_previsto: mo,
        material_previsto: mat,
        beneficio_previsto: mo || mat ? Math.round((pto - mo - mat) * 100) / 100 : 0,
      };
    }
    return { nombre_comunidad: otra.nombre, pto_total: 0, mano_obra_previsto: 0, material_previsto: 0, beneficio_previsto: 0 };
  }
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
let _cachePurchasesMeses = 0; // meses que cubre la caché: no se sirve a quien pide más
// 04/10/2026: 60 s → 15 min. Cada lectura son 36 ventanas de 31 días; con 60 s
// (contados desde que EMPEZABA la lectura) la caché casi nunca servía y cada
// obra de posicion-neta-real volvía a leer las 72 ventanas de compras.
const CACHE_TTL_MS = 15 * 60 * 1000;

async function obtenerPurchases({ force = false, mesesHaciaAtras = 36 } = {}) {
  const ahora = Date.now();
  if (!force && _cachePurchases && (ahora - _cachePurchasesTs) < CACHE_TTL_MS && _cachePurchasesMeses >= mesesHaciaAtras) {
    return { docs: _cachePurchases, cached: true, edad_ms: ahora - _cachePurchasesTs };
  }
  // v0.5.0: La API de Holded /documents/purchase IGNORA page y limit.
  // Devuelve siempre los últimos ~340 docs. Para traer todo, usamos
  // ventanas temporales con starttmp/endtmp (Unix segundos), mes a mes
  // hacia atrás. Cada ventana puede devolver hasta el tope (~340), pero
  // como son ventanas cortas (1 mes), casi nunca lo llenan en su totalidad.
  //
  // Estrategia: empezamos en hoy y vamos 1 mes hacia atrás cada iteración
  // hasta `mesesHaciaAtras`. Dedupe por id.

  const SEC_DAY = 86400;
  const seenIds = new Set();
  const docs = [];
  let ventanas = 0;
  let ventanasConDatos = 0;

  // Cursor: empezamos en mañana (hoy+1d) para incluir cualquier doc de hoy
  let endCursor = Math.floor(Date.now() / 1000) + SEC_DAY;

  let cortadaCompras = null;
  for (let i = 0; i < mesesHaciaAtras; i++) {
    // Cada ventana: ~31 días. Excedernos un poco está bien (Holded usa fecha exacta).
    const startCursor = endCursor - (31 * SEC_DAY);
    const r = await fetchHolded("/documents/purchase", {
      starttmp: startCursor,
      endtmp: endCursor,
    });
    ventanas += 1;
    if (!r.ok) {
      if (i === 0) {
        return { error: r.error, status: r.status, body_raw: r.body_raw };
      }
      console.warn(`[holded] ventana ${i+1}/${mesesHaciaAtras} cortada: ${r.error}`);
      cortadaCompras = r.error || "error";
      break;
    }
    const lote = Array.isArray(r.data) ? r.data : (r.data?.documents || []);
    let nuevos = 0;
    if (Array.isArray(lote) && lote.length > 0) {
      for (const d of lote) {
        const id = d && d.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        docs.push(d);
        nuevos += 1;
      }
      if (nuevos > 0) ventanasConDatos += 1;
    }
    // Avanza el cursor hacia atrás (-1s para no solapar)
    endCursor = startCursor - 1;
  }

  console.log(`[holded] ventanas: ${ventanas} totales · ${ventanasConDatos} con datos · ${docs.length} docs únicos`);
  // Lectura cortada a medias (Holded 503…): no se guarda, se reintenta en la siguiente
  if (!cortadaCompras) {
    _cachePurchases = docs;
    _cachePurchasesTs = Date.now();   // desde que TERMINA la lectura
    _cachePurchasesMeses = mesesHaciaAtras;
  }
  return { docs, cached: false, edad_ms: 0, ventanas_leidas: ventanas, ventanas_con_datos: ventanasConDatos };
}

// ============================================================
// obtenerInvoices · v0.6.0 (19/05/2026)
// Clon de obtenerPurchases pero para /documents/invoice (facturas
// de venta emitidas a clientes). Misma estrategia de paginación
// por ventanas temporales + caché propia + dedupe por id.
// Devuelve docs normalizados con normalizarInvoice (similar a
// normalizarPurchase pero adaptado a campos de invoice).
// ============================================================
let _cacheInvoices = null;
let _cacheInvoicesTs = 0;
let _cacheInvoicesMeses = 0;

async function obtenerInvoices({ force = false, mesesHaciaAtras = 36, soloCache = false } = {}) {
  const ahora = Date.now();
  if (!force && _cacheInvoices && (ahora - _cacheInvoicesTs) < CACHE_TTL_MS && _cacheInvoicesMeses >= mesesHaciaAtras) {
    return { docs: _cacheInvoices, cached: true, edad_ms: ahora - _cacheInvoicesTs };
  }
  // soloCache: nunca dispara la paginación contra Holded. Devuelve lo que haya
  // en caché (aunque esté algo vieja) o vacío. Lo usan endpoints que solo
  // quieren enriquecer si el dato ya está cargado, sin añadir carga a Holded.
  if (soloCache) {
    return { docs: _cacheInvoices || [], cached: !!_cacheInvoices, soloCache: true, edad_ms: _cacheInvoices ? ahora - _cacheInvoicesTs : null };
  }

  const SEC_DAY = 86400;
  const seenIds = new Set();
  const docs = [];
  let ventanas = 0;
  let ventanasConDatos = 0;

  let endCursor = Math.floor(Date.now() / 1000) + SEC_DAY;
  let cortada = null;

  for (let i = 0; i < mesesHaciaAtras; i++) {
    const startCursor = endCursor - (31 * SEC_DAY);
    const r = await fetchHolded("/documents/invoice", {
      starttmp: startCursor,
      endtmp: endCursor,
    });
    ventanas += 1;
    if (!r.ok) {
      if (i === 0) {
        return { error: r.error, status: r.status, body_raw: r.body_raw };
      }
      console.warn(`[holded invoices] ventana ${i+1}/${mesesHaciaAtras} cortada: ${r.error}`);
      cortada = r.error || `HTTP ${r.status}`;
      break;
    }
    const lote = Array.isArray(r.data) ? r.data : (r.data?.documents || []);
    let nuevos = 0;
    if (Array.isArray(lote) && lote.length > 0) {
      for (const d of lote) {
        const id = d && d.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        docs.push(normalizarInvoice(d));
        nuevos += 1;
      }
      if (nuevos > 0) ventanasConDatos += 1;
    }
    endCursor = startCursor - 1;
  }

  console.log(`[holded invoices] ventanas: ${ventanas} · ${ventanasConDatos} con datos · ${docs.length} facturas`);
  // Lectura cortada a medias (Holded 503…): se devuelve lo leído pero no se
  // guarda en caché, para que la siguiente petición lo vuelva a intentar.
  if (!cortada) {
    _cacheInvoices = docs;
    _cacheInvoicesTs = Date.now();   // desde que TERMINA la lectura
    _cacheInvoicesMeses = mesesHaciaAtras;
  }
  return { docs, cached: false, edad_ms: 0, ventanas_leidas: ventanas, ventanas_con_datos: ventanasConDatos, ...(cortada ? { incompleto: true, error_parcial: cortada } : {}) };
}

// Normaliza una factura de venta de Holded
// Estructura similar a normalizarPurchase pero el "proveedor" pasa
// a ser "cliente" y los importes representan lo que cobramos a clientes.
function normalizarInvoice(d) {
  const total = Number(d.total || 0);
  // Pagado / Pendiente: misma lógica que purchases (Holded los maneja igual
  // para ambos tipos de documento)
  let cobrado_eur = Number(
    d.paymentsTotal !== undefined ? d.paymentsTotal :
    (d.paid_amount !== undefined ? d.paid_amount : 0)
  );
  let pdte_cobro_eur = Number(
    d.pending !== undefined ? d.pending :
    (d.paymentsPending !== undefined ? d.paymentsPending : null)
  );
  if (!Number.isFinite(cobrado_eur) || cobrado_eur === 0) {
    if (d.status === 2 || d.paid === true) cobrado_eur = total;
  }
  if (!Number.isFinite(pdte_cobro_eur) || pdte_cobro_eur === null) {
    pdte_cobro_eur = Math.max(0, total - cobrado_eur);
  }

  // Estado lógico de la factura
  let estado_logico;
  if (cobrado_eur <= 0) estado_logico = "emitida_pdte";
  else if (pdte_cobro_eur <= 0.01) estado_logico = "cobrada";
  else estado_logico = "cobro_parcial";

  return {
    id: d.id || null,
    numero: d.docNumber || d.number || "",
    fecha: d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : null,
    fecha_vto: d.dueDate ? new Date(d.dueDate * 1000).toISOString().slice(0, 10) : null,
    cliente: d.contactName || d.contact || "",
    cliente_id: d.contact || null,
    descripcion: d.description || d.desc || "",
    subtotal: Number(d.subtotal || 0),
    iva: Number(d.tax || 0),
    total,
    cobrado_eur,
    pdte_cobro_eur,
    estado: d.status || "",
    estado_logico,
    pagado: !!d.paid,
    tags: Array.isArray(d.tags) ? d.tags : [],
  };
}

// obtenerInvoices() devuelve facturas YA normalizadas (fecha ISO, iva,
// cobrado_eur). balance-anual e iva-trimestre filtraban y sumaban con los
// campos crudos de Holded (date, tax, paymentsTotal), que ahí no existen,
// y daban las ventas a 0. Este adaptador devuelve esos campos crudos.
function invoiceComoCruda(f) {
  if (f && f.date !== undefined) return f; // ya es cruda
  const ts = f && f.fecha ? Math.floor(new Date(f.fecha + "T00:00:00Z").getTime() / 1000) : 0;
  return { ...f, date: ts, tax: Number(f.iva || 0), total: Number(f.total || 0), paymentsTotal: Number(f.cobrado_eur || 0) };
}

// ============================================================
// v0.7.0 (19/05/2026) — Funciones adicionales para Sprint
// "Rediseño Ficha OT" — contactos, series, impuestos, crear
// factura borrador en Holded.
// ============================================================

let _cacheContactos = null;
let _cacheContactosTs = 0;
let _cacheSeries = null;
let _cacheSeriesTs = 0;
let _cacheTaxes = null;
let _cacheTaxesTs = 0;
const CACHE_LARGA_MS = 5 * 60 * 1000; // 5 min para datos que cambian poco

// Lista contactos Holded.
// Holded paginа con ?page=N. Iteramos hasta que devuelva vacío.
// Tope de seguridad: 30 páginas (~30.000 contactos como máximo).
async function obtenerContactos({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && _cacheContactos && (ahora - _cacheContactosTs) < CACHE_LARGA_MS) {
    return { contactos: _cacheContactos, cached: true };
  }

  const todos = [];
  const seen = new Set();
  for (let page = 1; page <= 30; page++) {
    const r = await fetchHolded("/contacts", { page });
    if (!r.ok) {
      if (page === 1) return { error: r.error, status: r.status };
      break;
    }
    const lote = Array.isArray(r.data) ? r.data : (r.data?.contacts || r.data?.items || []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    let nuevos = 0;
    for (const c of lote) {
      const id = c?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      todos.push(normalizarContacto(c));
      nuevos += 1;
    }
    if (nuevos === 0) break;
  }

  _cacheContactos = todos;
  _cacheContactosTs = ahora;
  return { contactos: todos, cached: false };
}

function normalizarContacto(c) {
  return {
    id: c.id || null,
    nombre: c.name || c.tradeName || "",
    cif: c.code || c.vatnumber || "",
    email: c.email || "",
    tlf: c.phone || c.mobile || "",
    direccion: c.billAddress?.address || c.address || "",
    cp: c.billAddress?.postalCode || c.cp || "",
    ciudad: c.billAddress?.city || c.city || "",
    provincia: c.billAddress?.province || c.province || "",
    pais: c.billAddress?.country || c.country || "ES",
    es_persona: c.isperson === true || c.isperson === 1,
    es_cliente: c.iscustomer === true || c.iscustomer === 1,
    es_proveedor: c.issupplier === true || c.issupplier === 1,
  };
}

// Crear contacto nuevo en Holded
async function crearContacto({ nombre, cif, email, tlf, direccion, cp, ciudad, provincia, pais, es_persona }) {
  if (!nombre || !nombre.trim()) {
    return { error: "Falta nombre / razón social", status: 400 };
  }

  const KEY = getApiKey();
  if (!KEY) return { error: "Falta HOLDED_API_KEY en entorno", status: 500 };

  const body = {
    name: nombre.trim(),
    code: (cif || "").trim() || undefined,
    email: (email || "").trim() || undefined,
    phone: (tlf || "").trim() || undefined,
    isperson: es_persona ? 1 : 0,
    iscustomer: 1,  // por defecto se crea como cliente
    billAddress: (direccion || cp || ciudad) ? {
      address: (direccion || "").trim() || undefined,
      postalCode: (cp || "").trim() || undefined,
      city: (ciudad || "").trim() || undefined,
      province: (provincia || "").trim() || undefined,
      country: (pais || "ES").trim(),
    } : undefined,
  };

  // Limpiar undefined
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
  if (body.billAddress) {
    Object.keys(body.billAddress).forEach(k => body.billAddress[k] === undefined && delete body.billAddress[k]);
  }

  try {
    const startedAt = Date.now();
    const r = await fetch(`${HOLDED_API_BASE}/contacts`, {
      method: "POST",
      headers: {
        "key": KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - startedAt;
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    if (!r.ok) {
      console.error("[holded crear contacto] status", r.status, "body:", text.slice(0, 300));
      return {
        error: data?.error || data?.info || `Holded respondió ${r.status}`,
        status: r.status,
        body_raw: text.slice(0, 500),
      };
    }

    // Invalidar caché de contactos
    _cacheContactos = null;
    _cacheContactosTs = 0;

    return {
      contacto_id: data?.id || data?.contactId || null,
      raw: data,
      latency,
    };
  } catch (e) {
    return { error: e.message, status: 500 };
  }
}

// Obtener series de facturación de Holded para invoice
async function obtenerSeriesFactura({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && _cacheSeries && (ahora - _cacheSeriesTs) < CACHE_LARGA_MS) {
    return { series: _cacheSeries, cached: true };
  }

  const r = await fetchHolded("/numberingseries/invoice", {});
  if (!r.ok) return { error: r.error, status: r.status };

  const lote = Array.isArray(r.data) ? r.data : (r.data?.series || r.data?.items || []);
  const series = (lote || []).map(s => ({
    id: s.id || null,
    nombre: s.name || s.shortname || "",
    prefijo: s.prefix || "",
    ultimo_numero: Number(s.lastNumber || s.last_number || 0),
    activa: s.active !== false,
    default: s.default === true || s.default === 1,
  }));

  _cacheSeries = series;
  _cacheSeriesTs = ahora;
  return { series, cached: false };
}

// Obtener impuestos disponibles en Holded.
// Necesario porque al crear factura por API, el IVA NO se pasa
// como porcentaje sino como ID del impuesto.
async function obtenerTaxes({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && _cacheTaxes && (ahora - _cacheTaxesTs) < CACHE_LARGA_MS) {
    return { taxes: _cacheTaxes, cached: true };
  }

  const r = await fetchHolded("/taxes", {});
  if (!r.ok) return { error: r.error, status: r.status };

  const lote = Array.isArray(r.data) ? r.data : (r.data?.taxes || r.data?.items || []);
  const taxes = (lote || []).map(t => ({
    id: t.id || null,
    nombre: t.name || "",
    porcentaje: Number(t.value || t.percent || 0),
    tipo: t.type || "",
    activo: t.disabled !== true,
  }));

  _cacheTaxes = taxes;
  _cacheTaxesTs = ahora;
  return { taxes, cached: false };
}

// Resolver ID de impuesto por porcentaje
function buscarTaxIdPorPorcentaje(taxes, porcentaje) {
  if (!Array.isArray(taxes)) return null;
  // Buscar el de tipo "iva" (sale) y porcentaje exacto
  const exacto = taxes.find(t =>
    t.activo &&
    Math.abs(t.porcentaje - porcentaje) < 0.01 &&
    (t.tipo === "" || t.tipo === "sale" || t.tipo === "general")
  );
  if (exacto) return exacto.id;
  // Fallback: cualquier activo con ese porcentaje
  const fallback = taxes.find(t => t.activo && Math.abs(t.porcentaje - porcentaje) < 0.01);
  return fallback?.id || null;
}

// Crear factura BORRADOR en Holded (POST /documents/invoice)
// IMPORTANTE: el campo "tax" en items recibe el PORCENTAJE como string
// ("21", "10", "0"), NO el ID de impuesto. Confirmado experimentalmente
// y en ejemplos públicos del package vshopes/holded.
// Holded crea las facturas en BORRADOR por defecto si la cuenta tiene
// "modo borrador" activado en sus preferencias.
async function crearInvoiceBorrador({
  contactId,
  numSerieId,
  desc,
  subtotal,
  ivaPct = 21,
  tags = [],
  fecha = null,  // unix segundos, default = ahora
}) {
  if (!contactId) return { error: "Falta contactId", status: 400 };
  if (!Number.isFinite(Number(subtotal)) || Number(subtotal) <= 0) {
    return { error: "Subtotal debe ser mayor que 0", status: 400 };
  }

  const KEY = getApiKey();
  if (!KEY) return { error: "Falta HOLDED_API_KEY en entorno", status: 500 };

  // Una sola línea: "Trabajos realizados según descripción"
  const descripcionFinal = (desc || "").trim() || "Trabajos realizados según descripción";

  const body = {
    contactId,
    desc: descripcionFinal,
    date: fecha || Math.floor(Date.now() / 1000),
    notes: "Creada desde ARA·OS",
    items: [
      {
        name: descripcionFinal.slice(0, 90),
        desc: descripcionFinal,
        units: 1,
        subtotal: Number(subtotal),       // precio sin IVA
        tax: String(ivaPct),              // PORCENTAJE como string ("21","10","0")
      },
    ],
    tags: Array.isArray(tags) && tags.length > 0 ? tags : undefined,
    numSerieId: numSerieId || undefined,
  };

  // Limpiar undefined
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

  try {
    const startedAt = Date.now();
    const r = await fetch(`${HOLDED_API_BASE}/documents/invoice`, {
      method: "POST",
      headers: {
        "key": KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - startedAt;
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    if (!r.ok) {
      console.error("[holded crear invoice] status", r.status, "body:", text.slice(0, 400));
      return {
        error: data?.error || data?.info || `Holded respondió ${r.status}`,
        status: r.status,
        body_raw: text.slice(0, 500),
      };
    }

    // Invalidar caché de invoices
    _cacheInvoices = null;
    _cacheInvoicesTs = 0;

    return {
      invoice_id: data?.id || data?.invoiceId || null,
      numero: data?.docNumber || data?.number || "",
      raw: data,
      latency,
      iva_pct_usado: ivaPct,
    };
  } catch (e) {
    return { error: e.message, status: 500 };
  }
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
    tipo: d._tipo || "compra",
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

// v0.3.0: tags por obra separados por "|" → parseTagsCSV / serializeTagsCSV
// en lib/etiquetas-obra.cjs.

// ============================================================
// v0.6 (11/09/2026) · COMPRAS DE VARIAS OBRAS
// Una factura de proveedor puede llevar la etiqueta de varias obras
// (p. ej. Mellado 462: puertas y armarios para 6 obras en una factura).
// Antes cada obra se cargaba el importe ENTERO. Ahora se reparte:
//   1) por líneas de la factura, si el texto de cada línea nombra su obra
//      (nombre sin «plan cinco/ccpp/comunidad», con su número de portal);
//   2) si no se puede (factura de una sola línea), a partes iguales.
// mapaTagObra: { tag → { obra_id, nombre } } construido de holded_etiquetas.
// ============================================================
function _normTxt(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function _compacto(s) { return _normTxt(s).replace(/ /g, ""); }
function _clavesObra(nombre) {
  // Sirve igual para nombres con espacios («Betis 20») y para las etiquetas
  // pegadas de Fixner («comunidaddepropietariosavdciudadjardin85»).
  let c = _compacto(nombre)
    .replace(/(ot|o)\d{2}ara\d{5}/g, "")
    .replace(/fixner$/, "")
    .replace(/^(plancinco|cccpp|ccpp|cp|comunidaddepropietarios?|comunidadcalle|comunidad|edificio|barriada|bda|calle|avda|avd|av|c)+/g, "")
    .replace(/(plancinco|ccpp)/g, "")
    .replace(/g$/, "");
  const numeros = c.match(/\d+/g) || [];
  const letras = c.replace(/\d+/g, "");
  return { numeros, letras };
}
function _subcadenaComun(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    let k = 0; while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
    if (k > best) best = k;
  }
  return best;
}
function _puntuacionLineaObra(textoLinea, claves) {
  const t = _compacto(textoLinea);
  if (claves.letras.length < 4) return 0;
  const comun = _subcadenaComun(claves.letras, t);
  const ratio = comun / claves.letras.length;
  if (!(ratio >= 0.7 || comun >= 9)) return 0;
  const numsLinea = t.match(/\d+/g) || [];
  const bonus = claves.numeros.some(n => numsLinea.includes(n)) ? 0.5 : 0;
  return ratio + bonus;
}
function cuotaCompraObra(doc, obra_id, mapaTagObra) {
  const tags = Array.isArray(doc && doc.tags) ? doc.tags : [];
  const obras = new Map();
  for (const t of tags) { const o = mapaTagObra[t]; if (o && o.obra_id) obras.set(o.obra_id, o); }
  if (obras.size <= 1) return { cuota: 1, metodo: "unica" };
  const lineas = (Array.isArray(doc.products) && doc.products) || (Array.isArray(doc.items) && doc.items) || [];
  const importeLinea = l => {
    if (l.subtotal != null && isFinite(Number(l.subtotal))) return Math.abs(Number(l.subtotal));
    const u = Number(l.units != null ? l.units : 1) || 0, pr = Number(l.price || 0) || 0, dto = Number(l.discount || 0) || 0;
    return Math.abs(u * pr * (1 - dto / 100));
  };
  if (lineas.length > 1) {
    const total = lineas.reduce((s, l) => s + importeLinea(l), 0);
    if (total > 0) {
      const asignado = {}; let sinAsignar = 0;
      for (const l of lineas) {
        const txt = [l.name, l.desc, l.description].filter(Boolean).join(" ");
        const punt = [...obras.values()].map(o => ({ o, p: _puntuacionLineaObra(txt, _clavesObra(o.nombre)) }))
          .filter(x => x.p > 0).sort((a, b) => b.p - a.p);
        if (punt.length && (punt.length === 1 || punt[0].p > punt[1].p)) {
          const id = punt[0].o.obra_id;
          asignado[id] = (asignado[id] || 0) + importeLinea(l);
        } else sinAsignar += importeLinea(l);
      }
      // Solo se usa el reparto por líneas si casi todo quedó asignado (≥ 90 %)
      if (sinAsignar / total <= 0.10 && asignado[obra_id] != null) {
        return { cuota: asignado[obra_id] / (total - sinAsignar), metodo: "lineas", obras: obras.size };
      }
    }
  }
  return { cuota: 1 / obras.size, metodo: "partes_iguales", obras: obras.size };
}
function mapaTagObraDesdeFilas(filasEtiquetas, nombrePorObra = {}) {
  const m = {};
  for (const e of filasEtiquetas || []) {
    if (String(e.activa).toUpperCase() !== "TRUE") continue;
    const nombre = nombrePorObra[e.obra_id] || e.nombre_comunidad || e.obra_id;
    for (const t of parseTagsCSV(e.etiqueta_holded)) m[t] = { obra_id: e.obra_id, nombre };
  }
  return m;
}

// ============================================================
// AÑADIR ETIQUETAS A OBRAS (fusionando, nunca reemplazando)
// Lo usan el "+ Crear tag" de la ficha (ara-os-tags-holded.cjs) y el
// backfill. POST /etiquetas sigue reemplazando la lista (es la pantalla
// de Etiquetas, que puede quitar tags a propósito).
//   lista: [{ obra_id, tags: [..], nombre_comunidad?, tipo_obra? }]
// Lee holded_etiquetas una vez y escribe sólo las filas que cambian.
// Lanza error si no puede escribir (el que llama lo tiene que devolver).
// ============================================================
const _invalidadoresEtiquetas = new Set();
function invalidarCachesEtiquetas() {
  for (const f of _invalidadoresEtiquetas) { try { f(); } catch {} }
}

async function anadirEtiquetasObras(lista, { origen = "ficha" } = {}) {
  await asegurarPestanas();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(ETIQUETAS_HEADERS.length - 1);
  const filas = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
  const ahora = new Date();
  const hoyCorta = fechaCorta(ahora);
  let nombres = null;   // obra_id → nombre (sólo si hace falta crear filas)
  const resultados = [];

  for (const item of lista || []) {
    const obra_id = String(item.obra_id || "").trim();
    if (!obra_id) continue;
    const idx = filas.findIndex(f => String(f.obra_id || "").trim() === obra_id);
    let nombre_comunidad = item.nombre_comunidad || "";
    if (idx < 0 && !nombre_comunidad) {
      if (!nombres) {
        nombres = {};
        try {
          for (const o of [...await leerObrasPlan5(), ...await leerObrasOtras()]) nombres[o.obra_id] = o.nombre;
        } catch (e) { console.warn("[holded/etiquetas] sin nombres de obra:", e.message); }
      }
      nombre_comunidad = nombres[obra_id] || "";
    }
    const r = fusionarEtiquetasEnFila(idx >= 0 ? filas[idx] : null, {
      obra_id, tags: item.tags, nombre_comunidad, tipo_obra: item.tipo_obra,
      hoyISO: hoyISO(), hoyCorta, origen,
    });
    if (r.accion !== "ya_estaba") {
      const valores = ETIQUETAS_HEADERS.map(h => r.fila[h] != null ? String(r.fila[h]) : "");
      if (idx >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_ETIQUETAS}!A${idx + 2}:${lastCol}${idx + 2}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
        filas[idx] = r.fila;
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_ETIQUETAS}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [valores] },
        });
        filas.push(r.fila);
      }
    }
    resultados.push({ obra_id, accion: r.accion, añadidas: r.añadidas, etiquetas: r.etiquetas });
  }
  if (resultados.some(r => r.accion !== "ya_estaba")) invalidarCachesEtiquetas();
  return resultados;
}

async function anadirEtiquetaObra(obra_id, tag, opts = {}) {
  const [r] = await anadirEtiquetasObras([{ obra_id, tags: [tag], ...opts }], opts);
  return r;
}

// Etiquetas activas de una obra en holded_etiquetas (lo que ve la rentabilidad)
async function leerEtiquetasObra(obra_id) {
  const filas = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
  const fila = filas.find(f => String(f.obra_id || "").trim() === String(obra_id || "").trim());
  if (!fila || String(fila.activa).toUpperCase() !== "TRUE") return [];
  return parseTagsCSV(fila.etiqueta_holded);
}

// Una sola lectura a la vez de compras, rectificativas y facturas (04/10/2026).
// Siempre se leen 36 meses: así quien pide 24 (balance-anual) comparte la
// lectura y la caché con quien pide 36, en vez de lanzar otra.
function unaLecturaHolded(fn) {
  let vuelo = null;
  return (o = {}) => {
    if (o.soloCache) return fn(o);
    const opts = { ...o, mesesHaciaAtras: Math.max(36, Number(o.mesesHaciaAtras) || 36) };
    if (vuelo && !o.force) return vuelo;
    const p = Promise.resolve().then(() => fn(opts)).finally(() => { if (vuelo === p) vuelo = null; });
    vuelo = p;
    return p;
  };
}
obtenerPurchases = unaLecturaHolded(obtenerPurchases);
obtenerPurchaseRefunds = unaLecturaHolded(obtenerPurchaseRefunds);
obtenerInvoices = unaLecturaHolded(obtenerInvoices);

// ============================================================
// MÓDULO
// ============================================================
module.exports = function setupAraOSHolded(app) {

  // JSON body parser scoped only to Holded routes (no afecta resto)
  app.use("/api/ara-os/holded", express.json({ limit: "1mb" }));

  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) {
    return validToken(req.query.token);
  }

  // Endpoints pesados: caché y una sola ejecución a la vez (lib/cache-respuesta.cjs)
  const { cacheRespuesta } = require("./lib/cache-respuesta.cjs");
  const mesCerrado = (año, mes) => { const h = new Date(); return año * 12 + mes < h.getFullYear() * 12 + (h.getMonth() + 1); };
  const pesado = (clave, ttl) => cacheRespuesta({ clave, ttl, autorizado: (req) => tokenValido(req), cors: (res) => responderCORS(res) });
  const cacheRentab = pesado((req) => String(req.params.obra_id), () => 30 * 60e3);
  const cachePNR = pesado((req) => { const h = new Date(); return `${parseInt(req.query.año || h.getFullYear())}-${parseInt(req.query.mes || h.getMonth() + 1)}`; },
    (req) => { const h = new Date(); return mesCerrado(parseInt(req.query.año || h.getFullYear()), parseInt(req.query.mes || h.getMonth() + 1)) ? 12 * 3600e3 : 15 * 60e3; });
  const cacheAnual = pesado((req) => String(parseInt(req.query.año || new Date().getFullYear())), (req) => (parseInt(req.query.año || new Date().getFullYear()) < new Date().getFullYear() ? 12 * 3600e3 : 60 * 60e3));
  const cacheBalance = pesado((req) => String(req.query.año || ""), () => 15 * 60e3);
  const cacheGastosObras = pesado(() => "todo", () => 15 * 60e3);

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
      ok: true, version: "0.5.0",
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
  // GET /probe-team  · DIAGNÓSTICO (solo lectura)
  // Prueba endpoints candidatos de la API de Team de Holded para
  // descubrir si las nóminas (payrolls · "coste empresa") son accesibles.
  // Devuelve status y una muestra del cuerpo de cada candidato.
  // ============================================================
  app.options("/api/ara-os/holded/probe-team", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/probe-team", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    const KEY = getApiKey();
    if (!KEY) return res.status(500).json({ ok: false, error: "Falta HOLDED_API_KEY" });
    const BASE = "https://api.holded.com/api/team/v1";
    const get = async (url) => {
      try {
        const r = await fetch(url, { headers: { "key": KEY, "Accept": "application/json" } });
        const text = await r.text();
        const esHtml = text.trim().startsWith("<");
        let parsed = null; if (!esHtml) { try { parsed = JSON.parse(text); } catch {} }
        return { url, status: r.status, ok: r.ok, html: esHtml, parsed, muestra: esHtml ? "(HTML · no es API)" : text.slice(0, 500) };
      } catch (e) { return { url, error: e.message }; }
    };

    // 1) Empleados (sabemos que funciona) → sacar un id real
    const empRes = await get(`${BASE}/employees`);
    let empId = null, empNombre = null, empKeys = null, contrato = null;
    const lista = empRes.parsed && (empRes.parsed.employees || empRes.parsed);
    if (Array.isArray(lista) && lista[0]) {
      empId = lista[0].id || null;
      empNombre = `${lista[0].name || ""} ${lista[0].lastName || ""}`.trim();
      empKeys = Object.keys(lista[0]).slice(0, 50);
      contrato = lista[0].currentContract || null;
    }

    // 2) Probar rutas de nóminas POR EMPLEADO (la app usa /employees/{id}/payrolls)
    const candidatos = empId ? [
      `${BASE}/employees/${empId}/payrolls`,
      `${BASE}/employees/${empId}/payslips`,
      `${BASE}/employees/${empId}/payroll`,
      `${BASE}/employees/${empId}`,
      `${BASE}/payrolls?employeeId=${empId}`,
    ] : [];
    const resultados = [];
    for (const url of candidatos) resultados.push(await get(url));

    res.json({
      ok: true,
      empleados: { status: empRes.status, n: Array.isArray(lista) ? lista.length : null, empId, empNombre, empKeys, contrato },
      resultados,
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

    // v0.6.1: incluye rectificativas en negativo salvo ?rectificativas=0
    const conRefunds = String(req.query.rectificativas || "1") !== "0";
    const r = conRefunds ? await obtenerComprasConRectificativas() : await obtenerPurchases();
    if (r.error) {
      return res.status(502).json({
        ok: false, version: "0.5.0",
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
      ok: true, version: "0.5.0",
      ts: new Date().toISOString(),
      rango: { desde, hasta },
      count_total_holded: r.docs.length,
      paginas_leidas: r.paginas_leidas,         // legacy compat
      ventanas_leidas: r.ventanas_leidas,
      ventanas_con_datos: r.ventanas_con_datos,
      count: gastos.length,
      count_rectificativas: gastos.filter((g) => g.tipo === "rectificativa").length,
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
    if (r.error) return res.status(502).json({ ok: false, version: "0.5.0", error: r.error });

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
      ok: true, version: "0.5.0",
      ts: new Date().toISOString(),
      total_purchases: r.docs.length,
      total_tags: tags.length,
      cached: r.cached,
      tags,
    });
  });

  // ============================================================
  // GET /etiquetas-asignables
  // Lista de etiquetas que se pueden asignar a una compra:
  //   · obras   → etiquetas de obra activas (de la hoja holded_etiquetas)
  //   · generales → tags de compras que NO son de obra (gasolina, etc.)
  // ============================================================
  app.options("/api/ara-os/holded/etiquetas-asignables", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/etiquetas-asignables", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      await asegurarPestanas();
      const [etiquetasRaw, obrasPlan5, obrasOtras, rPur] = await Promise.all([
        leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS),
        leerObrasPlan5(),
        leerObrasOtras(),
        obtenerPurchases(),
      ]);
      const nombrePorObra = {};
      for (const o of [...obrasPlan5, ...obrasOtras]) nombrePorObra[o.obra_id] = o.nombre;
      const obraTagSet = new Set();
      const obras = [];
      for (const e of (etiquetasRaw || [])) {
        if (String(e.activa).toUpperCase() !== "TRUE") continue;
        for (const t of parseTagsCSV(e.etiqueta_holded)) {
          if (!t || obraTagSet.has(t)) continue;
          obraTagSet.add(t);
          obras.push({ etiqueta: t, obra: nombrePorObra[e.obra_id] || e.nombre_comunidad || e.obra_id });
        }
      }
      obras.sort((a, b) => String(a.obra).localeCompare(String(b.obra)));
      // Categorías generales: tags de compras que no son de obra
      const genSet = new Set();
      for (const d of ((rPur && rPur.docs) || [])) {
        for (const t of (Array.isArray(d.tags) ? d.tags : [])) {
          if (t && typeof t === "string" && !obraTagSet.has(t)) genSet.add(t);
        }
      }
      const generales = Array.from(genSet).sort((a, b) => a.localeCompare(b));
      res.json({ ok: true, obras, generales });
    } catch (e) {
      console.error("[etiquetas-asignables]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // POST /compra/:id/etiqueta
  // Añade una etiqueta a una factura de compra en Holded (escritura).
  // Body: { etiqueta: "nombre del tag" }
  // ============================================================
  app.options("/api/ara-os/holded/compra/:id/etiqueta", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/holded/compra/:id/etiqueta", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const id    = decodeURIComponent(req.params.id || "");
      const nueva = String((req.body && req.body.etiqueta) || "").trim();
      if (!id)    return res.status(400).json({ ok: false, error: "Falta id de compra" });
      if (!nueva) return res.status(400).json({ ok: false, error: "Falta etiqueta" });
      const KEY = getApiKey();
      if (!KEY) return res.status(500).json({ ok: false, error: "Falta HOLDED_API_KEY" });

      // Tags actuales de la compra (desde caché)
      const r = await obtenerPurchases();
      const doc = ((r && r.docs) || []).find(d => d.id === id);
      if (!doc) return res.status(404).json({ ok: false, error: "Compra no encontrada" });
      const actuales = Array.isArray(doc.tags) ? doc.tags.filter(t => typeof t === "string") : [];
      if (actuales.includes(nueva)) {
        return res.json({ ok: true, sin_cambios: true, tags: actuales });
      }
      const tags = [...actuales, nueva];

      // PUT a Holded · actualiza las etiquetas del documento de compra
      const upd = await fetch(`${HOLDED_API_BASE}/documents/purchase/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "key": KEY, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ tags }),
      });
      const text = await upd.text();
      let data = null; try { data = JSON.parse(text); } catch {}
      if (!upd.ok || (data && (data.status === 0 || data.status === "0"))) {
        console.error("[compra etiqueta] status", upd.status, "body:", text.slice(0, 300));
        return res.status(502).json({
          ok: false,
          error: (data && (data.info || data.error)) || `Holded respondió ${upd.status}`,
          body_raw: text.slice(0, 400),
        });
      }
      // Invalidar caché de compras para que el panel refleje el cambio
      _cachePurchases = null; _cachePurchasesTs = 0;
      res.json({ ok: true, id, tags });
    } catch (e) {
      console.error("[compra etiqueta]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // GET /nomina-mes?año=&mes=   ·   POST /nomina-mes  { año, mes, importe }
  // Nómina real (coste empresa total) del mes. Persistente en hoja.
  // ============================================================
  app.options("/api/ara-os/holded/nomina-mes", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/nomina-mes", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const hoy = new Date();
      const año = parseInt(req.query.año || hoy.getFullYear());
      const mes = parseInt(req.query.mes || (hoy.getMonth() + 1));
      const importe = await leerNominaMes(año, mes);
      res.json({ ok: true, periodo: periodoStr(año, mes), importe });
    } catch (e) {
      console.error("[nomina-mes GET]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.post("/api/ara-os/holded/nomina-mes", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const body = req.body || {};
      const año = parseInt(body.año);
      const mes = parseInt(body.mes);
      if (!año || !mes || mes < 1 || mes > 12) return res.status(400).json({ ok: false, error: "año/mes inválidos" });
      // importe: null/"" → borra el registro (vuelve a estimación).
      // Acepta número JS (p.ej. 18037.02) o string en formato ES o EN.
      let importe = null;
      if (body.importe != null && String(body.importe).trim() !== "") {
        if (typeof body.importe === "number") {
          importe = isFinite(body.importe) ? body.importe : null;
        } else {
          let s = String(body.importe).trim();
          if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.replace(/\./g, "").replace(",", "."); // 18.037,02
          else if (s.indexOf(",") >= 0) s = s.replace(",", ".");                                       // 18037,02
          // si solo tiene ".", se asume separador decimal (18037.02) → no tocar
          const n = Number(s);
          importe = isFinite(n) ? n : null;
        }
      }
      await asegurarHojaNominas();
      const periodo = periodoStr(año, mes);
      const filas = await leerTabla(HOJA_NOMINAS, NOMINAS_HEADERS);
      const idx = filas.findIndex(f => String(f.periodo).trim() === periodo);
      const filaExist = idx >= 0 ? filas[idx] : null;
      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(NOMINAS_HEADERS.length - 1);
      // Edición manual del total de operarios: preserva indirectos y detalle.
      const valores = [periodo, importe != null ? importe : "", hoyISO(), "panel",
        filaExist && filaExist.indirectos_eur != null ? filaExist.indirectos_eur : "",
        filaExist && filaExist.detalle_json != null ? filaExist.detalle_json : ""];
      if (idx >= 0) {
        const filaSheet = idx + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_NOMINAS}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_NOMINAS}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      }
      res.json({ ok: true, periodo, importe });
    } catch (e) {
      console.error("[nomina-mes POST]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // POST /nomina-importar-pdf  (multipart, campo "pdf")
  // Lee un PDF de resumen de nóminas con Claude y devuelve el periodo
  // + coste empresa por trabajador + total. No guarda (lo confirma el
  // usuario y se guarda con POST /nomina-mes).
  // ============================================================
  const _uploadNomina = require("multer")({ storage: require("multer").memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.options("/api/ara-os/holded/nomina-importar-pdf", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/holded/nomina-importar-pdf", _uploadNomina.single("pdf"), async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      if (!req.file || !req.file.buffer) return res.status(400).json({ ok: false, error: "Falta el PDF (campo 'pdf')" });
      const parsed = await extraerNominasPDF(req.file.buffer.toString("base64"));
      const año = parseInt(parsed.año) || null;
      const mes = parseInt(parsed.mes) || null;
      const trabajadores = Array.isArray(parsed.trabajadores)
        ? parsed.trabajadores.map(t => {
            const nombre = String(t.nombre || "").trim();
            return {
              nombre,
              coste_empresa: Math.round((Number(t.coste_empresa) || 0) * 100) / 100,
              categoria: esIndirectoNomina(nombre) ? "indirecto" : "operario",
            };
          })
        : [];
      const total_operarios   = Math.round(trabajadores.filter(t => t.categoria === "operario").reduce((s, t) => s + t.coste_empresa, 0) * 100) / 100;
      const total_indirectos  = Math.round(trabajadores.filter(t => t.categoria === "indirecto").reduce((s, t) => s + t.coste_empresa, 0) * 100) / 100;
      res.json({
        ok: true, año, mes, periodo: (año && mes) ? periodoStr(año, mes) : null,
        total_coste_empresa: Math.round((total_operarios + total_indirectos) * 100) / 100,
        total_operarios, total_indirectos, trabajadores,
      });
    } catch (e) {
      console.error("[nomina-importar-pdf]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // POST /nomina-detalle  { año, mes, trabajadores:[{nombre,categoria,coste_empresa}] }
  // Guarda el detalle por trabajador del mes. importe = suma operarios
  // (Coste MO), indirectos_eur = suma indirectos (van a costes fijos).
  // ============================================================
  app.options("/api/ara-os/holded/nomina-detalle", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/holded/nomina-detalle", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const body = req.body || {};
      const año = parseInt(body.año);
      const mes = parseInt(body.mes);
      if (!año || !mes || mes < 1 || mes > 12) return res.status(400).json({ ok: false, error: "año/mes inválidos" });
      const trabajadores = (Array.isArray(body.trabajadores) ? body.trabajadores : []).map(t => {
        const nombre = String(t.nombre || "").trim();
        const categoria = (t.categoria === "indirecto" || esIndirectoNomina(nombre)) ? "indirecto" : "operario";
        return { nombre, categoria, coste_empresa: Math.round((Number(t.coste_empresa) || 0) * 100) / 100 };
      });
      if (!trabajadores.length) return res.status(400).json({ ok: false, error: "Sin trabajadores" });
      const importe    = Math.round(trabajadores.filter(t => t.categoria === "operario").reduce((s, t) => s + t.coste_empresa, 0) * 100) / 100;
      const indirectos = Math.round(trabajadores.filter(t => t.categoria === "indirecto").reduce((s, t) => s + t.coste_empresa, 0) * 100) / 100;

      await asegurarHojaNominas();
      const periodo = periodoStr(año, mes);
      const filas = await leerTabla(HOJA_NOMINAS, NOMINAS_HEADERS);
      const idx = filas.findIndex(f => String(f.periodo).trim() === periodo);
      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(NOMINAS_HEADERS.length - 1);
      const valores = [periodo, importe, hoyISO(), "panel-pdf", indirectos, JSON.stringify(trabajadores)];
      if (idx >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_NOMINAS}!A${idx + 2}:${lastCol}${idx + 2}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_NOMINAS}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      }
      res.json({ ok: true, periodo, importe, indirectos, n_trabajadores: trabajadores.length });
    } catch (e) {
      console.error("[nomina-detalle POST]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
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
        ok: true, version: "0.5.0",
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

      invalidarCachesEtiquetas();
      res.json({
        ok: true, version: "0.5.0",
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
  // POST /etiquetas/backfill-desde-ficha?token=…[&dry_run=1]
  // Una vez: pasa a holded_etiquetas los tags de la ficha
  // (comunidades_tags_holded, borrado = FALSE) que falten. Fusiona, no
  // reemplaza, y no duplica. Con dry_run=1 sólo lista lo que haría.
  // ============================================================
  app.options("/api/ara-os/holded/etiquetas/backfill-desde-ficha", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/holded/etiquetas/backfill-desde-ficha", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    const dryRun = ["1", "true", "si"].includes(String(req.query.dry_run || "").toLowerCase());
    try {
      const filasFicha = await leerHojaSafe("comunidades_tags_holded!A2:F");
      const porObra = new Map();
      for (const f of filasFicha) {
        const [tag_id, ccpp_id, tag, , , borrado] = f;
        if (!tag_id || !ccpp_id || !String(tag || "").trim()) continue;
        if (String(borrado || "").toUpperCase() === "TRUE") continue;
        if (!porObra.has(ccpp_id)) porObra.set(ccpp_id, []);
        porObra.get(ccpp_id).push(String(tag).trim());
      }
      const lista = [...porObra].map(([obra_id, tags]) => ({ obra_id, tags }));

      let resultados;
      if (dryRun) {
        const filas = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
        resultados = lista.map(item => {
          const fila = filas.find(f => String(f.obra_id || "").trim() === item.obra_id) || null;
          const r = fusionarEtiquetasEnFila(fila, { ...item, hoyISO: hoyISO(), hoyCorta: fechaCorta() });
          return { obra_id: item.obra_id, accion: r.accion, añadidas: r.añadidas, etiquetas: r.etiquetas };
        });
      } else {
        resultados = await anadirEtiquetasObras(lista, { origen: "ficha (backfill)" });
      }
      const cambios = resultados.filter(r => r.accion !== "ya_estaba");
      res.json({
        ok: true, dry_run: dryRun,
        obras_revisadas: resultados.length,
        obras_cambiadas: cambios.length,
        cambios,
      });
    } catch (e) {
      console.error("[holded/etiquetas/backfill-desde-ficha]", e);
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
          ok: true, version: "0.5.0", obra_id,
          etiqueta_holded: null,
          etiquetas: [],
          mensaje: "Obra sin etiqueta asignada.",
          count: 0, total_eur: 0, desglose: [], gastos: [],
        });
      }
      const tagsObraSet = new Set(tagsObra);

      const [obrasPlan5, obrasOtras] = await Promise.all([leerObrasPlan5(), leerObrasOtras()]);
      // v0.4.1: sin límite hacia atrás por defecto. Si no se pasa `desde`,
      // no se filtra por fecha desde (trae todas las facturas de Holded).
      const desde = req.query.desde ? String(req.query.desde) : null;
      const hasta = String(req.query.hasta || hoyISO());
      const ts_desde = desde ? fechaAUnix(desde) : 0;
      const ts_hasta = fechaAUnix(hasta);

      const r = await obtenerPurchases();
      if (r.error) return res.status(502).json({ ok: false, error: r.error });

      // Rectificativas de compra
      const rRef = await obtenerPurchaseRefunds();
      const refundDocs = rRef.error ? [] : (rRef.docs || []);

      const gastosFiltrados = [...r.docs, ...refundDocs.map(d => ({
        ...d,
        subtotal: -(Math.abs(Number(d.subtotal || 0))),
        tax: -(Math.abs(Number(d.tax || 0))),
        total: -(Math.abs(Number(d.total || 0))),
        _tipo: 'rectificativa',
      }))].filter((d) => {
        const ts = Number(d.date || 0);
        if (ts_desde && ts < ts_desde) return false;
        if (ts > (ts_hasta + 86400)) return false;
        const tags = Array.isArray(d.tags) ? d.tags : [];
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
        ok: true, version: "0.5.0",
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
  app.get("/api/ara-os/holded/gastos-resumen-obras", cacheGastosObras, async (req, res) => {
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

      const r = await obtenerComprasConRectificativas(); // v0.6.1: abonos restan
      if (r.error) return res.status(502).json({ ok: false, error: r.error });

      const nombrePorObra = {};
      for (const o of [...obrasPlan5, ...obrasOtras]) nombrePorObra[o.obra_id] = o.nombre;
      const mapaTagObra = mapaTagObraDesdeFilas(etiquetas, nombrePorObra);

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
          total_eur += Number(d.total || 0) * cuotaCompraObra(d, e.obra_id, mapaTagObra).cuota;
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
        ok: true, version: "0.5.0",
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

  // ============================================================
  // GET /rentabilidad-obra/:obra_id (v0.4.0)
  //   Combina:
  //     · presupuesto (de comunidades o obras_otras)
  //     · material real (Holded, suma de gastos por tag)
  //     · mano de obra real (registros_tiempo × personas.coste_hora)
  //   Y calcula beneficio real + desvío vs previsto.
  // ============================================================
  app.options("/api/ara-os/holded/rentabilidad-obra/:obra_id", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  // Rentabilidad de una obra (presupuesto, material de Holded por etiqueta y mano de obra de registros_tiempo);
  // null si no existe. query: { desde, hasta }
  async function calcularRentabilidad(obra_id, query = {}) {
      const [obrasPlan5, obrasOtras] = await Promise.all([leerObrasPlan5(), leerObrasOtras()]);

      const eco = await leerEconomicoObra(obra_id, obrasPlan5, obrasOtras);
      if (!eco) return null;

      const etiquetas = await leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS);
      const fila = etiquetas.find(e => e.obra_id === obra_id);
      const tagsObra = fila ? parseTagsCSV(fila.etiqueta_holded) : [];
      let material_real_sin_iva = 0;  // v0.4.1: usar sin IVA para coste
      let material_real_con_iva = 0;  // total con IVA (informativo)
      let material_iva = 0;
      let facturas_count = 0;
      let facturas_compartidas = 0; // v0.6: compras repartidas con otras obras
      let etiqueta_asignada = false;
      const mapaTagObra = mapaTagObraDesdeFilas(etiquetas,
        Object.fromEntries([...obrasPlan5, ...obrasOtras].map(o => [o.obra_id, o.nombre])));
      if (tagsObra.length > 0) {
        etiqueta_asignada = true;
        const tagsObraSet = new Set(tagsObra);
        // v0.4.1: sin límite hacia atrás por defecto (mismo cambio que /gastos-por-obra).
        const desde = query.desde ? String(query.desde) : null;
        const hasta = String(query.hasta || hoyISO());
        const ts_desde = desde ? fechaAUnix(desde) : 0;
        const ts_hasta = fechaAUnix(hasta);
        const r = await obtenerPurchases();
        if (r.error) throw Object.assign(new Error(r.error), { status: 502 });
        for (const d of r.docs) {
          const ts = Number(d.date || 0);
          if (ts_desde && ts < ts_desde) continue;
          if (ts > (ts_hasta + 86400)) continue;
          const tags = Array.isArray(d.tags) ? d.tags : [];
          if (!tags.some(t => tagsObraSet.has(t))) continue;
          const { cuota } = cuotaCompraObra(d, obra_id, mapaTagObra);
          material_real_sin_iva += Number(d.subtotal || 0) * cuota;
          material_iva           += Number(d.tax || 0) * cuota;
          material_real_con_iva  += Number(d.total || 0) * cuota;
          facturas_count += 1;
          if (cuota < 1) facturas_compartidas += 1;
        }
        // Rectificativas de compra (restan del coste)
        const rRef2 = await obtenerPurchaseRefunds();
        if (!rRef2.error) {
          for (const d of rRef2.docs) {
            const ts = Number(d.date || 0);
            if (ts_desde && ts < ts_desde) continue;
            if (ts > (ts_hasta + 86400)) continue;
            const tags = Array.isArray(d.tags) ? d.tags : [];
            if (!tags.some(t => tagsObraSet.has(t))) continue;
            const { cuota } = cuotaCompraObra(d, obra_id, mapaTagObra);
            material_real_sin_iva -= Math.abs(Number(d.subtotal || 0)) * cuota;
            material_iva           -= Math.abs(Number(d.tax || 0)) * cuota;
            material_real_con_iva  -= Math.abs(Number(d.total || 0)) * cuota;
            facturas_count += 1;
          }
        }
      }

      const costesPorPersona = await leerCostesPorPersona();
      // obra de un grupo (OO-2026-142 de Urbano Orad): también su parte de lo fichado con el nombre del grupo
      const OCg = require("./lib/orden-cartera.cjs");
      const grupo = OCg.GRUPOS_OO.find((g) => g.ids.includes(obra_id)) || null;
      let extraMO = [];
      if (grupo) {
        const ptos = grupo.ids.map((id) => Number(obrasOtras.find((o) => o.obra_id === id)?.pto_total) || 0);
        const tot = ptos.reduce((t, x) => t + x, 0);
        extraMO = [{ nombre: grupo.nombre, factor: tot > 0 ? ptos[grupo.ids.indexOf(obra_id)] / tot : 1 / grupo.ids.length }];
      }
      const mo = await calcularManoObraReal(eco.nombre_comunidad, costesPorPersona, extraMO);

      // v0.4.1: coste real = mano de obra + material SIN IVA
      const coste_real = mo.mano_obra_eur + material_real_sin_iva;

      // v0.4.1: presupuesto_real con badge de fuente.
      // Prioridad 1 (cobrado bancario): pendiente — se enchufa cuando llegue pago EMASESA.
      // Prioridad 2 (facturado Holded ventas): no implementado todavía.
      // Prioridad 3 (contratado = previsto): es lo que aplicamos hoy.
      const presupuesto_real = eco.pto_total;
      const presupuesto_fuente = "contratado";  // futuro: "cobrado" | "facturado" | "contratado"

      const beneficio_real = presupuesto_real - coste_real;
      const desvio_eur = beneficio_real - eco.beneficio_previsto;
      const desvio_pct = eco.beneficio_previsto !== 0
        ? (desvio_eur / Math.abs(eco.beneficio_previsto)) * 100
        : null;
      const margen_pct = presupuesto_real !== 0
        ? (beneficio_real / presupuesto_real) * 100
        : null;

      const respuesta = {
        ok: true,
        version: "0.5.0",
        ts: new Date().toISOString(),
        obra_id,
        nombre_comunidad: eco.nombre_comunidad,
        previsto: {
          pto_total: eco.pto_total,
          pto_provisional: !!eco.pto_provisional, pto_provisional_ref: eco.pto_provisional_ref || null,   // config_dinero presupuesto_provisional
          mano_obra_previsto: eco.mano_obra_previsto,
          material_previsto: eco.material_previsto,
          beneficio_previsto: eco.beneficio_previsto,
        },
        real: {
          presupuesto_real,
          presupuesto_fuente,                // "contratado" hoy
          mano_obra_real: mo.mano_obra_eur,
          mano_obra_horas: mo.horas_total,
          mano_obra_registros: mo.registros,
          mano_obra_desglose: mo.desglose_personas || [],
          material_real: material_real_sin_iva,        // v0.4.1: SIN IVA (para coste)
          material_real_con_iva,                       // con IVA (informativo)
          material_iva,
          material_facturas_count: facturas_count,
          material_facturas_compartidas: facturas_compartidas,
          coste_real,
          beneficio_real,
          margen_pct,
        },
        desvio: {
          eur: desvio_eur,
          pct: desvio_pct,
        },
        flags: {
          tiene_etiqueta_holded: etiqueta_asignada,
          tiene_registros_tiempo: mo.registros > 0,
          tiene_presupuesto: eco.pto_total > 0,
        },
      };
      return respuesta;
  }
  // varias OO de una obra (Urbano Orad 13-15): sumas de presupuesto, horas, material y costes; márgenes recalculados
  function sumarRentabilidades(obra_id, rs) {
    if (rs.some((r) => !r)) return null;
    const suma = (f) => rs.reduce((t, r) => t + (Number(f(r)) || 0), 0);
    const g = require("./lib/orden-cartera.cjs").GRUPOS_OO.find((x) => obra_id.split("+").every((id) => x.ids.includes(id)));
    const pto = suma((r) => r.real.presupuesto_real), coste = suma((r) => r.real.coste_real), benef = pto - coste, benPrev = suma((r) => r.previsto.beneficio_previsto);
    const porPersona = {};
    for (const r of rs) for (const d of r.real.mano_obra_desglose || []) { const x = porPersona[d.persona_id] || (porPersona[d.persona_id] = { ...d, horas: 0, coste: 0 }); x.horas += d.horas; x.coste += d.coste; }
    return { ...rs[0], obra_id, nombre_comunidad: g ? g.nombre : rs.map((r) => r.nombre_comunidad).join(" + "), partes: rs.map((r) => ({ obra_id: r.obra_id, nombre_comunidad: r.nombre_comunidad })),
      previsto: { ...rs[0].previsto, pto_total: suma((r) => r.previsto.pto_total), mano_obra_previsto: suma((r) => r.previsto.mano_obra_previsto), material_previsto: suma((r) => r.previsto.material_previsto), beneficio_previsto: benPrev },
      real: { ...rs[0].real, presupuesto_real: pto, mano_obra_real: suma((r) => r.real.mano_obra_real), mano_obra_horas: suma((r) => r.real.mano_obra_horas), mano_obra_registros: suma((r) => r.real.mano_obra_registros),
        mano_obra_desglose: Object.values(porPersona), material_real: suma((r) => r.real.material_real), material_real_con_iva: suma((r) => r.real.material_real_con_iva), material_iva: suma((r) => r.real.material_iva),
        material_facturas_count: suma((r) => r.real.material_facturas_count), material_facturas_compartidas: suma((r) => r.real.material_facturas_compartidas), coste_real: coste, beneficio_real: benef, margen_pct: pto ? (benef / pto) * 100 : null },
      desvio: { eur: benef - benPrev, pct: benPrev ? ((benef - benPrev) / Math.abs(benPrev)) * 100 : null },
      flags: { tiene_etiqueta_holded: rs.some((r) => r.flags.tiene_etiqueta_holded), tiene_registros_tiempo: rs.some((r) => r.flags.tiene_registros_tiempo), tiene_presupuesto: pto > 0 } };
  }
  // Caché rentabilidad 3 min
  const _cacheRent = {};
  app.get("/api/ara-os/holded/rentabilidad-obra/:obra_id", cacheRentab, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const cacheKey = obra_id;
      const ahora = Date.now();
      if (!req.query.refresh && _cacheRent[cacheKey] && (ahora - _cacheRent[cacheKey].ts) < 180_000) {
        return res.json(_cacheRent[cacheKey].data);
      }

      // obra de varias OO («OO-2026-142+OO-2026-143», 06/10/2026): la suma de cada una
      const respuesta = obra_id.includes("+") ? sumarRentabilidades(obra_id, await Promise.all(obra_id.split("+").map((id) => calcularRentabilidad(id, req.query)))) : await calcularRentabilidad(obra_id, req.query);
      if (!respuesta) return res.status(404).json({ ok: false, error: `Obra ${obra_id} no encontrada` });
      _cacheRent[cacheKey] = { ts: Date.now(), data: respuesta };
      res.json(respuesta);
    } catch (e) {
      console.error("[holded/rentabilidad-obra]", e);
      res.status(e.status || 500).json({ ok: false, error: e.message });
    }
  });


  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/rentabilidad-ordenes
  // Rentabilidad real de TODAS las órdenes: Plan5 (comunidades) + obras_otras.
  // Plan5 vía /rentabilidad-obra, OO vía /economico. Ordenado por registro de
  // tiempo más reciente. Cacheado 5 min (cálculo pesado).
  // ─────────────────────────────────────────────────────────────
  // Cálculo en función aparte: el handler responde al instante con la última
  // caché y recalcula en segundo plano (tarda ~40 s en frío; antes la tabla
  // de Órdenes pintaba "—" mientras tanto).
  let _cacheRentOrdenes = { ts: 0, data: null };
  // Al cambiar etiquetas: la próxima petición recalcula (sirve la anterior mientras)
  _invalidadoresEtiquetas.add(() => { _cacheRentOrdenes.ts = 0; });
  let _calculandoRentOrdenes = null;
  async function calcularRentOrdenes(token) {
    const BASE = `http://localhost:${process.env.PORT || 10000}`;
    const http = require("http");
    const fetchLocal = (path) => new Promise((resolve) => {
      http.get(BASE + path, (r) => { let raw = ""; r.on("data", d => raw += d); r.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } }); }).on("error", () => resolve(null));
    });

    // Último registro de tiempo por obra (col A=fecha, E=obra_id que guarda el nombre/código)
    const ultimoRegistro = {};
    try {
      const regs = await leerHojaSafe("registros_tiempo!A2:N");
      for (const r of regs) {
        if (String(r[13] || "").toUpperCase() === "TRUE") continue;
        const key = r[4] || "";
        const fecha = r[0] || "";
        if (!key || !fecha) continue;
        if (!ultimoRegistro[key] || fecha > ultimoRegistro[key]) ultimoRegistro[key] = fecha;
      }
    } catch (e) { console.warn("[rentabilidad-ordenes] registros:", e.message); }
    const fechaUltima = (o) => ultimoRegistro[o.nombre] || ultimoRegistro[o.obra_id] || "";
    const conRegistro = (o) => !!(ultimoRegistro[o.nombre] || ultimoRegistro[o.obra_id]);

    // Candidatos. obras_otras: TODAS las no borradas (cualquier fase salvo
    // presupuesto), no solo activas, para no perder las facturadas/cobradas.
    const plan5 = await leerObrasPlan5();
    let otras = [];
    try {
      const filasOO = await leerHojaSafe("obras_otras!A2:T");
      for (const r of filasOO) {
        const obra_id = r[0] || "", nombre = r[1] || "", fase = r[7] || "";
        if (!obra_id || !nombre) continue;
        if (String(r[19] || "").toUpperCase() === "TRUE") continue;
        if (fase === "PRESUPUESTO") continue;
        otras.push({ obra_id, nombre, tipo: r[5] || "otros", fase });
      }
    } catch (e) { console.warn("[rentabilidad-ordenes] obras_otras:", e.message); }

    // Solo las que tienen registro de tiempo (lo pedido y mucho más eficiente)
    const plan5Reg = plan5.filter(conRegistro);
    const otrasReg = otras.filter(conRegistro);

    // Procesar en lotes para no saturar
    const lote = async (items, fn, n = 4) => {
      const out = [];
      for (let i = 0; i < items.length; i += n) out.push(...await Promise.all(items.slice(i, i + n).map(fn)));
      return out;
    };

    const ordenesPlan5 = await lote(plan5Reg, async (o) => {
      const d = await fetchLocal(`/api/ara-os/holded/rentabilidad-obra/${encodeURIComponent(o.obra_id)}?token=${encodeURIComponent(token)}`);
      const real = (d && d.real) || {};
      const prev = (d && d.previsto) || {};
      const presupuesto = real.presupuesto_real != null ? real.presupuesto_real : (prev.pto_total || 0);
      return {
        obra_id: o.obra_id, nombre: o.nombre, tipo: "Plan 5", fase: o.fase || "",
        presupuesto: Math.round((presupuesto || 0) * 100) / 100,
        coste_mo_real: Math.round((real.mano_obra_real || 0) * 100) / 100,
        coste_material_real: Math.round((real.material_real || 0) * 100) / 100,
        coste_total: Math.round((real.coste_real || 0) * 100) / 100,
        beneficio: real.beneficio_real != null ? Math.round(real.beneficio_real * 100) / 100 : 0,
        margen_pct: real.margen_pct != null ? Math.round(real.margen_pct * 10) / 10 : null,
        horas: real.mano_obra_horas || 0,
        material_previsto: prev.material_previsto != null ? Math.round(prev.material_previsto * 100) / 100 : null,
        // Dinero › Rentabilidad por obra: beneficio previsto del presupuesto (col AB de comunidades)
        beneficio_previsto: Number(prev.beneficio_previsto) ? Math.round(prev.beneficio_previsto * 100) / 100 : null,
        material_facturas: real.material_facturas_count || 0,
        tiene_etiqueta: !!(d && d.flags && d.flags.tiene_etiqueta_holded),
        ultimo_registro: fechaUltima(o),
      };
    });

    const ordenesOtras = await lote(otrasReg, async (o) => {
      const e = await fetchLocal(`/api/ara-os/obras-otras/${encodeURIComponent(o.obra_id)}/economico?token=${encodeURIComponent(token)}`);
      const bv = (e && e.beneficio_vivo) || {};
      const presupuesto = bv.pvp_estimado != null ? bv.pvp_estimado : ((e && e.presupuestado ? e.presupuestado.total : 0) || 0);
      const costeMO = bv.coste_mano_obra_real || 0, costeMat = bv.coste_material_real || 0;
      return {
        obra_id: o.obra_id, nombre: o.nombre, tipo: o.tipo || "otros", fase: o.fase || "",
        presupuesto: Math.round(presupuesto * 100) / 100,
        coste_mo_real: Math.round(costeMO * 100) / 100,
        coste_material_real: Math.round(costeMat * 100) / 100,
        coste_total: Math.round((costeMO + costeMat) * 100) / 100,
        beneficio: bv.beneficio_eur != null ? Math.round(bv.beneficio_eur * 100) / 100 : Math.round((presupuesto - costeMO - costeMat) * 100) / 100,
        margen_pct: bv.margen_pct != null ? bv.margen_pct : (presupuesto > 0 ? Math.round(((presupuesto - costeMO - costeMat) / presupuesto) * 1000) / 10 : null),
        horas: bv.horas_reales || 0,
        material_previsto: null, // el presupuesto de otras órdenes no separa material
        beneficio_previsto: null, // ni el beneficio previsto
        material_facturas: e ? (e.num_facturas || 0) : 0,
        tiene_etiqueta: !!(e && Array.isArray(e.tags_configurados) && e.tags_configurados.length),
        ultimo_registro: fechaUltima(o),
      };
    });

    // Solo órdenes con algún registro de tiempo. Orden: más reciente primero.
    const ordenes = [...ordenesPlan5, ...ordenesOtras]
      .filter(o => o.ultimo_registro || o.horas > 0)
      .sort((a, b) => {
        if (a.ultimo_registro && b.ultimo_registro) return b.ultimo_registro.localeCompare(a.ultimo_registro);
        if (a.ultimo_registro) return -1;
        if (b.ultimo_registro) return 1;
        return b.presupuesto - a.presupuesto;
      });
    const data = { ok: true, n: ordenes.length, ordenes, generated_at: new Date().toISOString() };
    _cacheRentOrdenes = { ts: Date.now(), data };
    return data;
  }
  function recalcularRentOrdenes(token) {
    if (!_calculandoRentOrdenes) {
      _calculandoRentOrdenes = calcularRentOrdenes(token)
        .catch(e => { console.error("[holded/rentabilidad-ordenes]", e); throw e; })
        .finally(() => { _calculandoRentOrdenes = null; });
    }
    return _calculandoRentOrdenes;
  }
  app.options("/api/ara-os/holded/rentabilidad-ordenes", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/rentabilidad-ordenes", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    const token = req.query.token || "";
    try {
      const cache = _cacheRentOrdenes.data;
      if (cache && !req.query.refresh) {
        if (Date.now() - _cacheRentOrdenes.ts >= 5 * 60 * 1000) recalcularRentOrdenes(token).catch(() => {});
        return res.json(cache);
      }
      res.json(await recalcularRentOrdenes(token));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/tesoreria
  // Saldos bancarios en vivo desde Holded Treasury API
  // ─────────────────────────────────────────────────────────────
  // lastSyncAt de una cuenta de tesorería (Unix en segundos o ms, o ISO) → ISO
  // «AAAA-MM-DDTHH:MM» en hora UTC, o null si Holded no lo da.
  function fechaSyncTesoreria(c) {
    const v = c && (c.lastSyncAt ?? c.lastSync ?? c.lastSyncDate ?? c.syncedAt ?? null);
    if (v == null || v === "" || v === 0) return null;
    const n = Number(v);
    const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(v));
    return isNaN(d) ? null : d.toISOString().slice(0, 16);
  }
  app.options("/api/ara-os/holded/tesoreria", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/tesoreria", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const KEY = getApiKey();
      if (!KEY) return res.status(500).json({ ok: false, error: "Falta HOLDED_API_KEY" });
      const r = await fetch("https://api.holded.com/api/invoicing/v1/treasury", {
        headers: { "key": KEY, "Accept": "application/json" },
      });
      const cuentas = await r.json();
      // Cuentas tesorería:
      //   57000003 = CAJA*
      //   bbva_emp = BBVA ARA CORPORATE
      //   57200001 = Santander cuenta corriente (también tesorería)
      //   57200006 = Santander segunda cuenta corriente
      // Póliza:
      //   57200007 = CREDITO NEGOCIO Santander → saldo = disponible de la póliza
      const CUENTA_POLIZA      = 57200007;  // CREDITO NEGOCIO = póliza
      const CUENTAS_TESORERIA  = [57200001, 57200006]; // Santander cta corriente x2

      const filtradas   = cuentas.filter(c => CUENTAS_TESORERIA.includes(c.accountNumber));
      const polizaCuenta = cuentas.find(c => c.accountNumber === CUENTA_POLIZA) || null;
      const total = filtradas.reduce((s, c) => s + (c.balance || 0), 0);

      res.json({
        ok: true,
        total_eur: Math.round(total * 100) / 100,
        cuentas: filtradas.map(c => ({
          id: c.id,
          cuenta: c.accountNumber != null ? String(c.accountNumber) : null,   // 572xxxxx (cuadre con la contabilidad)
          nombre: c.name,
          tipo: c.type,
          banco: c.treasuryName || null,
          saldo: Math.round((c.balance || 0) * 100) / 100,
          iban: c.iban || null,
          // Fecha de la última sincronización con el banco (lastSyncAt). Es la
          // que dice si el banco está al día, no la del último apunte.
          ultima_sincronizacion: fechaSyncTesoreria(c),
        })),
        // Pleo (tarjeta de empresa): se busca por nombre porque no tiene un
        // número de cuenta fijo. null = Holded no la tiene → quien la use debe
        // tratarla como «sin dato», no como 0.
        pleo: (() => {
          const p = Array.isArray(cuentas) ? cuentas.find(c => /pleo/i.test(`${c.name || ""} ${c.treasuryName || ""}`)) : null;
          return p ? { nombre: p.name, cuenta: p.accountNumber || null, saldo: Math.round((p.balance || 0) * 100) / 100 } : null;
        })(),
        poliza_holded: polizaCuenta ? {
          nombre: polizaCuenta.name,
          banco: polizaCuenta.treasuryName,
          disponible_eur: Math.round((polizaCuenta.balance || 0) * 100) / 100,
        } : null,
      });
    } catch (e) {
      console.error("[holded/tesoreria]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/compras-pendientes
  // Facturas de compra con pago pendiente
  // ─────────────────────────────────────────────────────────────
  // ¿Una compra que Holded da por pendiente ya se pagó con Pleo? (Alberto,
  // 03/10: D6 contaba 217 € de compras pagadas con la tarjeta.) Dos casos:
  //  a) la propia compra dice Pleo (etiqueta, notas, forma de pago): el pago
  //     de Pleo no se ha registrado contra la factura;
  //  b) es la factura del proveedor duplicada con el gasto que exporta Pleo
  //     (ya pagado): mismo proveedor, mismo total (± 0,01) y ± 45 días.
  const _txtPleo = (f) => [f.tags, f.notes, f.desc, f.description, f.paymentMethod, f.paymentMethodName,
    f.customFields, f.payments, f.paymentsDetail].map(x => (x == null ? "" : typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  const _esPleo = (f) => /pleo/i.test(_txtPleo(f));
  const _normProv = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(s\.?l\.?u?|s\.?a\.?u?)\b/g, "").replace(/[^a-z0-9]/g, "");
  function marcaPleo(f, todas) {
    if (_esPleo(f)) return { pagada_con_pleo: true, motivo_pleo: "la compra es de Pleo" };
    const prov = _normProv(f.contactName), total = Number(f.total) || 0;
    if (!prov || !total) return {};
    const pdte = Number(f.paymentsPending) || 0;
    // El gasto de Pleo puede cubrir la factura entera o solo lo que queda pendiente
    const dup = (todas || []).find(g => g.id !== f.id && _esPleo(g) && !(Number(g.paymentsPending) > 0.005)
      && _normProv(g.contactName) === prov
      && (Math.abs((Number(g.total) || 0) - total) <= 0.01 || (pdte > 0 && Math.abs((Number(g.total) || 0) - pdte) <= 0.01))
      && Math.abs((Number(g.date) || 0) - (Number(f.date) || 0)) <= 60 * 86400);
    return dup ? { pagada_con_pleo: true, motivo_pleo: `duplicada con el gasto de Pleo ${dup.docNumber || dup.id}` } : {};
  }
  app.options("/api/ara-os/holded/compras-pendientes", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/compras-pendientes", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const KEY = getApiKey();
      if (!KEY) return res.status(500).json({ ok: false, error: "Falta HOLDED_API_KEY" });
      const [rPurch, rRefund] = await Promise.all([
        fetch("https://api.holded.com/api/invoicing/v1/documents/purchase?limit=200", {
          headers: { "key": KEY, "Accept": "application/json" },
        }),
        fetch("https://api.holded.com/api/invoicing/v1/documents/purchaserefund?limit=200", {
          headers: { "key": KEY, "Accept": "application/json" },
        }),
      ]);
      const todas = await rPurch.json();
      const todasRefund = rRefund.ok ? await rRefund.json() : [];
      const hoyTs = Math.floor(Date.now() / 1000);

      function mapFactura(f, esRectificativa = false) {
        const vto = f.dueDate || null;
        const vencida = vto ? vto < hoyTs : false;
        const diasVto = vto ? Math.round((vto - hoyTs) / 86400) : null;
        const pendiente = Math.round((f.paymentsPending || 0) * 100) / 100;
        return {
          id: f.id,
          num: f.docNumber || "—",
          proveedor: f.contactName || "—",
          total: esRectificativa ? -Math.abs(Math.round((f.total || 0) * 100) / 100) : Math.round((f.total || 0) * 100) / 100,
          pendiente: esRectificativa ? -Math.abs(pendiente) : pendiente,
          fecha: f.date ? new Date(f.date * 1000).toISOString().slice(0, 10) : null,
          fecha_vto: vto ? new Date(vto * 1000).toISOString().slice(0, 10) : null,
          vencida,
          dias_vto: diasVto,
          tags: f.tags || [],
          tipo: esRectificativa ? 'rectificativa' : 'factura',
        };
      }

      const pendientes = [
        ...todas.filter(f => Math.round((f.paymentsPending || 0) * 100) / 100 > 0).map(f => ({ ...mapFactura(f, false), ...marcaPleo(f, todas) })),
        ...(Array.isArray(todasRefund) ? todasRefund.filter(f => Math.round((f.paymentsPending || 0) * 100) / 100 > 0).map(f => mapFactura(f, true)) : []),
      ].sort((a, b) => (a.dias_vto ?? 9999) - (b.dias_vto ?? 9999));
      const total_pendiente = pendientes.reduce((s, f) => s + f.pendiente, 0);
      const pleo = pendientes.filter(f => f.pagada_con_pleo);
      // Diagnóstico (solo lectura): ?diagnostico_proveedor=riesgo → todas las
      // compras de ese proveedor con sus campos tal cual los da Holded, para
      // ver cómo marca Holded lo pagado con Pleo.
      const diag = String(req.query.diagnostico_proveedor || "").trim();
      if (diag) {
        const q = _normProv(diag);
        return res.json({ ok: true, diagnostico_proveedor: diag,
          compras: todas.filter(f => _normProv(f.contactName).includes(q)),
          rectificativas: (Array.isArray(todasRefund) ? todasRefund : []).filter(f => _normProv(f.contactName).includes(q)),
          con_pleo_en_algun_campo: todas.filter(_esPleo).length });
      }
      res.json({
        ok: true,
        total_pendiente_eur: Math.round(total_pendiente * 100) / 100,
        // Pendientes en Holded pero ya pagadas con la tarjeta Pleo (no son deuda)
        pagadas_con_pleo_eur: Math.round(pleo.reduce((s, f) => s + f.pendiente, 0) * 100) / 100,
        num_pagadas_con_pleo: pleo.length,
        num_pendientes: pendientes.length,
        num_vencidas: pendientes.filter(f => f.vencida).length,
        facturas: pendientes,
      });
    } catch (e) {
      console.error("[holded/compras-pendientes]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/balance-anual
  // Resumen financiero anual: ingresos, gastos, margen por mes
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/holded/balance-anual", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/balance-anual", cacheBalance, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const año = parseInt(req.query.año || new Date().getFullYear());

      // Rango timestamps del año
      const inicio = Math.floor(new Date(`${año}-01-01`).getTime() / 1000);
      const fin    = Math.floor(new Date(`${año}-12-31T23:59:59`).getTime() / 1000);

      // Obtener facturas venta y compra (con caché)
      const [resInv2, resPur2] = await Promise.all([
        obtenerInvoices({ mesesHaciaAtras: 24 }),
        obtenerPurchases({ mesesHaciaAtras: 24 }),
      ]);
      const invoices  = (resInv2?.docs || []).map(invoiceComoCruda);
      const purchases = resPur2?.docs  || [];

      // Filtrar por año
      const ventasAño   = invoices.filter(f => f.date >= inicio && f.date <= fin);
      const gastosAño   = purchases.filter(f => f.date >= inicio && f.date <= fin);

      // Nóminas reales por mes (coste empresa). Holded no las expone por API;
      // se introducen en el panel y se guardan en la hoja nominas_mes. Se
      // suman a los gastos de cada mes para que el margen sea real.
      const nominaPorMes = {};
      let nominaAñoTotal = 0;
      try {
        await asegurarHojaNominas();
        for (const fn of (await leerTabla(HOJA_NOMINAS, NOMINAS_HEADERS))) {
          const per = String(fn.periodo || "").trim();
          if (!per.startsWith(`${año}-`)) continue;
          const m = parseInt(per.slice(5, 7));
          if (!m || m < 1 || m > 12) continue;
          // Coste empresa total del mes = operarios (importe) + indirectos.
          const n = (_parseEurFlexible(fn.importe) || 0) + (_parseEurFlexible(fn.indirectos_eur) || 0);
          if (!n) continue;
          nominaPorMes[m] = (nominaPorMes[m] || 0) + n;
          nominaAñoTotal += n;
        }
      } catch (e) { console.warn("[balance-anual] nóminas:", e.message); }

      // Totales globales
      const totalFacturado  = ventasAño.reduce((s, f) => s + (f.total || 0), 0);
      const totalCobrado    = ventasAño.reduce((s, f) => s + (f.paymentsTotal || 0), 0);
      const totalPdteCobro  = totalFacturado - totalCobrado;
      const totalGastos     = gastosAño.reduce((s, f) => s + (f.total || 0), 0) + nominaAñoTotal;
      const totalPagado     = gastosAño.reduce((s, f) => s + (f.paymentsTotal || 0), 0) + nominaAñoTotal;
      const totalPdtePago   = totalGastos - totalPagado;
      const margenBruto     = totalFacturado - totalGastos;
      const margenPct       = totalFacturado > 0 ? (margenBruto / totalFacturado) * 100 : 0;

      // Por mes
      const meses = {};
      for (let m = 1; m <= 12; m++) {
        meses[m] = { mes: m, facturado: 0, cobrado: 0, gastos: 0, pagado: 0, compras: 0, presupuestos_aceptados: 0 };
      }
      for (const f of ventasAño) {
        const m = new Date(f.date * 1000).getMonth() + 1;
        meses[m].facturado += f.total || 0;
        meses[m].cobrado   += f.paymentsTotal || 0;
      }
      for (const f of gastosAño) {
        const m = new Date(f.date * 1000).getMonth() + 1;
        meses[m].gastos   += f.total || 0;          // compras + (nóminas añadidas abajo)
        meses[m].compras  += f.total || 0;          // solo facturas de compra
        meses[m].pagado   += f.paymentsTotal || 0;
      }
      // Sumar nóminas reales a los gastos (y pagado) de cada mes
      for (let m = 1; m <= 12; m++) {
        if (nominaPorMes[m]) { meses[m].gastos += nominaPorMes[m]; meses[m].pagado += nominaPorMes[m]; }
      }
      // Presupuestos aceptados por mes (comunidades: fecha_aceptacion_pto + pto_total)
      try {
        const filasCom = await leerHojaSafe("comunidades!A2:BG");
        for (const r of filasCom) {
          const fAcept = String(r[21] || "").trim();   // V = fecha_aceptacion_pto
          if (!fAcept) continue;
          const d = new Date(fAcept);
          if (isNaN(d) || d.getFullYear() !== año) continue;
          const m = d.getMonth() + 1;
          let s = String(r[22] || "").trim();           // W = pto_total
          if (!s) continue;
          if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.replace(/\./g, "").replace(",", ".");
          else if (s.indexOf(",") >= 0) s = s.replace(",", ".");
          const v = parseFloat(s.replace(/[^0-9.\-]/g, ""));
          if (isFinite(v)) meses[m].presupuestos_aceptados += v;
        }
      } catch (e) { console.warn("[balance-anual] presupuestos aceptados:", e.message); }

      // Gastos por categoría (tags)
      const porCategoria = {};
      for (const f of gastosAño) {
        const tags = (f.tags && f.tags.length) ? f.tags : ['sin categoría'];
        for (const tag of tags) {
          porCategoria[tag] = (porCategoria[tag] || 0) + (f.total || 0);
        }
      }
      if (nominaAñoTotal > 0) porCategoria['Nóminas'] = (porCategoria['Nóminas'] || 0) + nominaAñoTotal;
      const categorias = Object.entries(porCategoria)
        .map(([tag, total]) => ({ tag, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Mes actual
      const mesActual = new Date().getMonth() + 1;
      const dataMesActual = meses[mesActual];

      res.json({
        ok: true,
        año,
        // Totales anuales
        facturado_eur:    Math.round(totalFacturado * 100) / 100,
        cobrado_eur:      Math.round(totalCobrado * 100) / 100,
        pdte_cobro_eur:   Math.round(totalPdteCobro * 100) / 100,
        gastos_eur:       Math.round(totalGastos * 100) / 100,
        pagado_eur:       Math.round(totalPagado * 100) / 100,
        pdte_pago_eur:    Math.round(totalPdtePago * 100) / 100,
        margen_bruto_eur: Math.round(margenBruto * 100) / 100,
        margen_pct:       Math.round(margenPct * 10) / 10,
        num_facturas:     ventasAño.length,
        num_gastos:       gastosAño.length,
        // Mes actual
        mes_actual: {
          mes: mesActual,
          facturado: Math.round((dataMesActual?.facturado || 0) * 100) / 100,
          cobrado:   Math.round((dataMesActual?.cobrado || 0) * 100) / 100,
          gastos:    Math.round((dataMesActual?.gastos || 0) * 100) / 100,
        },
        // Por mes (para gráfico futuro)
        por_mes: Object.values(meses).map(m => ({
          mes: m.mes,
          facturado: Math.round(m.facturado * 100) / 100,
          cobrado:   Math.round(m.cobrado * 100) / 100,
          gastos:    Math.round(m.gastos * 100) / 100,
          compras:   Math.round(m.compras * 100) / 100,
          pagado:    Math.round(m.pagado * 100) / 100,
          presupuestos_aceptados: Math.round(m.presupuestos_aceptados * 100) / 100,
        })),
        // Gastos por categoría
        gastos_por_categoria: categorias,
      });
    } catch (e) {
      console.error("[holded/balance-anual]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/resultado-real-anual?año=
  // Serie mensual del P&L real (reutiliza posicion-neta-real por mes).
  // Cálculo pesado → cacheado 10 min por año. El beneficio real de cada mes
  // es beneficio_real_eur de posicion-neta-real (sin préstamos).
  // ─────────────────────────────────────────────────────────────
  const _cacheResultadoAnual = {};
  app.options("/api/ara-os/holded/resultado-real-anual", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/resultado-real-anual", cacheAnual, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const año = parseInt(req.query.año || new Date().getFullYear());
      const token = req.query.token || "";
      const cache = _cacheResultadoAnual[año];
      if (cache && Date.now() - cache.ts < 10 * 60 * 1000) return res.json(cache.data);

      const hoy = new Date();
      const mesMax = (año === hoy.getFullYear()) ? (hoy.getMonth() + 1) : 12;
      const BASE = `http://localhost:${process.env.PORT || 10000}`;
      const http = require("http");
      const fetchLocal = (path) => new Promise((resolve) => {
        http.get(BASE + path, (r) => { let raw = ""; r.on("data", d => raw += d); r.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } }); }).on("error", () => resolve(null));
      });

      const por_mes = [];
      for (let m = 1; m <= mesMax; m++) {
        const d = await fetchLocal(`/api/ara-os/holded/posicion-neta-real?año=${año}&mes=${m}&token=${encodeURIComponent(token)}`);
        if (!d || !d.ok) { por_mes.push({ mes: m, sin_datos: true }); continue; }
        por_mes.push({
          mes: m,
          trabajo_realizado:          d.ingreso_mes_eur || 0,
          gastos_materiales:          d.gastos_materiales_eur || 0,
          coste_mo:                   d.coste_mo_eur || 0,
          nomina_indirectos:          d.nomina_indirectos_eur || 0,
          nomina_indirectos_estimado: !!d.nomina_indirectos_estimado,
          costes_generales:           d.costes_generales_eur || 0,
          beneficio_antes_indirectos: d.beneficio_antes_indirectos || 0,
          beneficio_real:             d.beneficio_real_eur != null ? d.beneficio_real_eur : null,   // la misma cifra que Mi panel
          comision_comercial:         d.comision_comercial_devengada_eur || 0,
          horas_obra:                 d.total_horas_mo || 0,              // horas en obra (tipo trabajo/extra)
          horas_pagadas:              d.horas_pagadas || 0,               // todas (obra, vacaciones, festivos…)
          coste_mo_fuente:            d.coste_mo_fuente || null,
          // v0.6: cuadran con la contabilidad de Holded
          contraste_obra_menos_gastos_contables: d.contraste_obra_menos_gastos_contables_eur,
          resultado_contable:         d.resultado_contable_eur,
          gastos_contables:           d.contabilidad && d.contabilidad.ok ? d.contabilidad.gastos : null,
          ventas_contables:           d.contabilidad && d.contabilidad.ok ? d.contabilidad.grupos.ventas : null,
        });
      }
      const data = { ok: true, año, por_mes };
      _cacheResultadoAnual[año] = { ts: Date.now(), data };
      res.json(data);
    } catch (e) {
      console.error("[holded/resultado-real-anual]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/posicion-neta-real
  //
  // Replica la lógica del Excel EMPRESA:
  //   Trabajo realizado (avance × importe, avance = horas_registradas / horas_previstas)
  //   − Materiales      (Holded compras por etiqueta de obra)
  //   − Coste MO        (registros-tiempo → horas × coste/hora)
  //   − Costes fijos    (pasados por el cliente via query: costes_fijos_eur)
  //   = Beneficio real del mes
  //
  // Avance automático: horas acumuladas registradas / (dias_estimados × 16h)
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/holded/posicion-neta-real", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/posicion-neta-real", cachePNR, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const hoy    = new Date();
      const año    = parseInt(req.query.año  || hoy.getFullYear());
      const mes    = parseInt(req.query.mes  || (hoy.getMonth() + 1));
      const token  = req.query.token || "";
      const BASE   = `http://localhost:${process.env.PORT || 10000}`;

      const mesStr  = String(mes).padStart(2, "0");
      const desde   = `${año}-${mesStr}-01`;
      const diasMes = new Date(año, mes, 0).getDate();
      const hasta   = `${año}-${mesStr}-${diasMes}`;

      const http = require("http");
      function fetchLocal(path) {
        return new Promise((resolve, reject) => {
          http.get(BASE + path, (r) => {
            let raw = "";
            r.on("data", d => raw += d);
            r.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
          }).on("error", reject);
        });
      }

      // ── Cargar todas las obras activas (Plan5 + obras_otras) ────
      const crypto = require("crypto");
      function ccppId(direccion) {
        const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
        return `ccpp_${slug}_${hash}`;
      }
      // Plan5: todas las fases activas (05-19) — registros-tiempo permite imputar desde fase 05
      const FASES_EJECUCION_PLAN5 = new Set([
        "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP",
        "09_FINANCIACION","09_TRAMITADA","10_BLOQUEOS","11_PREPARADA",
        "12_INICIO_OBRA","13_EN_EJECUCION","14_FINALIZADA",
        "15_VISITA_INSPECTOR","16_MONTAJE_CONTADORES","17_COBRO_EMASESA",
        "18_COBRADA", // v0.6: sin ella, una obra ya cobrada desaparecía del ingreso de los meses en que se ejecutó
        "19_INCIDENCIAS",
      ]);
      // Fases donde la obra está terminada → devengado = 100% del importe
      const FASES_TERMINADAS_PLAN5 = new Set([
        "14_FINALIZADA","15_VISITA_INSPECTOR","16_MONTAJE_CONTADORES","17_COBRO_EMASESA","18_COBRADA",
      ]);
      const filasComun = await leerHojaSafe("comunidades!A2:BG");
      const obrasMapAll = {}; // obra_id → {nombre, importe, horas_previstas}
      for (const r of filasComun) {
        const nombre    = r[0] || "";
        const direccion = r[1] || "";
        const fase      = r[15] || "";
        if (!nombre || !direccion || !FASES_EJECUCION_PLAN5.has(fase)) continue;
        const oid = ccppId(direccion);
        function parseNum(s) { if (!s) return 0; let v = String(s).trim(); if (v.includes(',') && v.includes('.')) { v = v.replace(/\./g,'').replace(',','.'); } else if (v.includes(',')) { v = v.replace(',','.'); } return parseFloat(v)||0; }
        const pto_total      = parseNum(r[22]); // col W
        const tiempo_previsto = parseNum(r[30]); // col AE — días cuadrilla (1d=16h)
        obrasMapAll[oid] = { obra_id: oid, nombre, importe: pto_total, horas_previstas: tiempo_previsto * 16, fase, tipo: "plan5" };
        obrasMapAll[nombre] = obrasMapAll[oid];
      }
      // obras_otras: todas las fases excepto PRESUPUESTO (pueden tener registros de tiempo)
      const FASES_OO_CON_HORAS = new Set(["INICIO_OBRA","EN_EJECUCION","FINALIZADA","FACTURADA","COBRADA","INCIDENCIAS"]);
      // Devengado 100%: obra terminada físicamente
      const FASES_OO_DEVENGADO_100 = new Set(["FINALIZADA","FACTURADA","COBRADA"]);
      // Para obras_otras sin tiempo estimado: TODAS las fases generan ingreso si hay horas.
      // Solo INCIDENCIAS corta el ingreso (trabajo de garantía post-fin).
      // FASES_OO_SIN_INGRESO solo aplica a obras CON tiempo estimado (como Plan5).
      const filasOO = await leerHojaSafe("obras_otras!A2:AH");
      for (const r of filasOO) {
        const oid   = r[0] || "";
        const nombre = r[1] || "";
        const fase   = r[7] || "";
        const borrado = String(r[19] || "").toUpperCase() === "TRUE";
        if (!oid || !nombre || borrado) continue;
        if (!FASES_OO_CON_HORAS.has(fase)) continue;
        function parseNumOO(s) { if (!s) return 0; let v = String(s).trim(); if (v.includes(',') && v.includes('.')) { v = v.replace(/\./g,'').replace(',','.'); } else if (v.includes(',')) { v = v.replace(',','.'); } return parseFloat(v)||0; }
        // v0.6 (11/09/2026): el ingreso va SIEMPRE SIN IVA.
        // Antes se tomaba total_eur (col W, CON IVA) y las órdenes «otras»
        // inflaban el ingreso un 10-21 %. Orden ahora:
        //   subtotal_eur (col U) → total_eur − iva_eur (W − V) → importe legacy (col G, sin garantía)
        const subtotalOO = parseNumOO(r[20]);
        const ivaOO      = parseNumOO(r[21]);
        const totalOO    = parseNumOO(r[22]);
        let importe, importeFuente;
        if (subtotalOO > 0)                 { importe = subtotalOO;       importeFuente = "subtotal"; }
        else if (totalOO > 0 && ivaOO > 0)  { importe = totalOO - ivaOO;  importeFuente = "total-iva"; }
        else if (totalOO > 0)               { importe = totalOO;          importeFuente = "total_sin_desglose"; }
        else                                { importe = parseNumOO(r[6]); importeFuente = "legacy"; }
        const dias_estimados = parseNumOO(r[27]); // col AB
        // Fechas de cierre (ISO): fin real (K) → facturada (L) → cobrada (M)
        const isoOO = s => { const v = String(s || "").trim(); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ""; };
        let fechaFinOO = isoOO(r[10]) || isoOO(r[11]) || isoOO(r[12]);
        // v0.6: órdenes importadas de Fixner (17-27/05/2026). Sus fechas de fin/
        // factura/cobro son la FECHA DE LA IMPORTACIÓN, no la real: 32 de 47
        // traen «cobrada 2026-05-21». Usarlas metía en mayo-2026 el ingreso de
        // obras hechas en 2025. Si la obra empezó antes de la importación, esas
        // fechas se ignoran y manda el último día con horas (o se da por cerrada).
        const esImportFixner = String(r[16] || "").trim() === "import-fixner" || /importado de fixner/i.test(String(r[14] || ""));
        const inicioOO = isoOO(r[8]);
        const enVentanaImport = f => f && f >= "2026-05-15" && f <= "2026-05-31";
        if (esImportFixner && fechaFinOO && enVentanaImport(fechaFinOO) && !(inicioOO && inicioOO >= "2026-05-01")) {
          const alternativas = [isoOO(r[10]), isoOO(r[11]), isoOO(r[12])].filter(f => f && !enVentanaImport(f));
          fechaFinOO = alternativas[0] || "";
        }
        // AG (idx 32) = id factura emitida desde ARA·OS · N (idx 13) = legacy.
        // Permite recuperar el importe de órdenes facturadas con factura
        // VINCULADA directamente (sin etiqueta/tag), como hace la ficha.
        const invoiceEmitidaId = String(r[32] || r[13] || "").trim();
        obrasMapAll[oid] = { obra_id: oid, nombre, importe, importe_fuente: importeFuente, horas_previstas: dias_estimados * 16, fase, tipo: "otras", invoiceEmitidaId, fecha_fin: fechaFinOO, import_fixner: esImportFixner };
        obrasMapAll[nombre] = obrasMapAll[oid];
      }

      // ── Horas acumuladas hasta fin del mes consultado (para delta devengado correcto) ──
      // hastaFinMes  = horas registradas desde siempre hasta el último día del mes
      // hastaFinMesAnterior = horas hasta el día antes del mes (para calcular delta)
      const hastaFinMes = hasta; // ya calculado arriba
      const diaAntesMes = new Date(año, mes - 1, 0); // último día del mes anterior
      const hastaFinMesAnterior = `${diaAntesMes.getFullYear()}-${String(diaAntesMes.getMonth()+1).padStart(2,'0')}-${String(diaAntesMes.getDate()).padStart(2,'0')}`;

      let horasAcumMap = {};          // acumulado hasta fin del mes consultado
      let horasAcumMapAntes = {};     // acumulado hasta fin del mes anterior
      let horasTotalMap = {};         // total all-time (denominador para obras sin tiempo estimado)
      let ultimaFechaMap = {};        // v0.6: último día con horas por obra → mes de cierre real
      try {
        const rt = require("./ara-os-registros-tiempo.cjs");
        [horasAcumMap, horasAcumMapAntes, horasTotalMap, ultimaFechaMap] = await Promise.all([
          rt.getHorasAcumuladasMapHasta(hastaFinMes),
          rt.getHorasAcumuladasMapHasta(hastaFinMesAnterior),
          rt.getHorasAcumuladasMap(),
          rt.getUltimaFechaHorasMap ? rt.getUltimaFechaHorasMap() : Promise.resolve({}),
        ]);
      } catch (e) {
        console.warn("[posicion-neta-real] getHorasAcumuladasMapHasta falló:", e.message);
      }

      const MARGEN_MATERIALES = 0.30; // margen sobre materiales que se cobra al cliente

      // Facturas Holded por obra: fallback de importe para obras sin precio en la hoja
      let importeFacturadoXObra = {};
      try {
        const [resInv, etiquetasRaw] = await Promise.all([
          obtenerInvoices({ mesesHaciaAtras: 36 }),
          leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS),
        ]);
        const invoiceDocs = resInv?.docs || [];
        for (const e of etiquetasRaw) {
          if (String(e.activa).toUpperCase() !== "TRUE") continue;
          const tagsObra = parseTagsCSV(e.etiqueta_holded);
          if (!tagsObra.length) continue;
          const tagsSet = new Set(tagsObra);
          let totalFacturado = 0;
          for (const inv of invoiceDocs) {
            const tags = Array.isArray(inv.tags) ? inv.tags : [];
            if (tags.some(t => tagsSet.has(t))) totalFacturado += inv.subtotal || 0;
          }
          if (totalFacturado > 0) importeFacturadoXObra[e.obra_id] = totalFacturado;
        }
        // Fallback adicional: órdenes "otras" FACTURADAS con factura
        // VINCULADA directamente por ID (no por etiqueta). Replica la fuente
        // de la ficha (FichaOrdenOtra): subtotal (sin IVA) de la factura
        // emitida. Solo se aplica si la etiqueta no aportó ya un importe.
        const invoiceById = new Map(invoiceDocs.map(d => [d.id, d]));
        for (const info of Object.values(obrasMapAll)) {
          if (info.tipo !== "otras" || !info.invoiceEmitidaId) continue;
          if (importeFacturadoXObra[info.obra_id]) continue;
          const doc = invoiceById.get(info.invoiceEmitidaId);
          const sub = doc ? (Number(doc.subtotal) || 0) : 0;
          if (sub > 0) importeFacturadoXObra[info.obra_id] = sub;
        }
      } catch (e) {
        console.warn("[posicion-neta-real] importeFacturadoXObra falló:", e.message);
      }

      const [dataRT, dataBalance, dataGastosObras] = await Promise.all([
        fetchLocal(`/api/ara-os/registros-tiempo?desde=${desde}&hasta=${hasta}&token=${token}`),
        fetchLocal(`/api/ara-os/holded/balance-anual?año=${año}&token=${token}`),
        fetchLocal(`/api/ara-os/holded/gastos-resumen-obras?desde=${desde}&hasta=${hasta}&token=${token}`),
      ]);

      // ── Cobros del mes (Holded balance) ────────────────────────
      const mesDatos      = (dataBalance?.por_mes || []).find(m => m.mes === mes);
      const facturadoMes  = mesDatos?.facturado || 0;
      const cobradoMes    = mesDatos?.cobrado    || 0;

      // ── Gastos materiales por obra (Holded etiquetas) ──────────
      const gastosMapObra = {};
      let gastosMatFinal = 0;
      for (const o of (dataGastosObras?.obras || [])) {
        gastosMapObra[o.obra_id] = parseFloat(o.total_eur) || 0;
        gastosMatFinal += gastosMapObra[o.obra_id];
      }
      if (gastosMatFinal === 0) {
        gastosMatFinal = (dataBalance?.gastos_por_categoria || [])
          .reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
      }

      // ── Coste MO del mes (SOLO operarios de producción) ────────
      // Coste MO incluye únicamente al personal operario. El personal
      // indirecto (Alberto, Jose Manuel) se lleva a costes fijos.
      // Si hay NÓMINA real registrada, el coste de cada operario sale de su
      // "coste empresa" del PDF (detalle); el €/h por trabajador = coste ÷
      // horas. Sin detalle/nómina → reparto por horas o estimación.
      const nominaRow = await leerNominaRow(año, mes);
      const usaNomina = nominaRow && nominaRow.importe != null && nominaRow.importe > 0;
      // Detalle operarios del PDF, con tokens para casar por nombre (el orden
      // apellidos/nombre puede diferir entre el PDF y la hoja personas).
      const detalleOps = (nominaRow && Array.isArray(nominaRow.detalle) ? nominaRow.detalle : [])
        .filter(t => (t.categoria || "operario") === "operario")
        .map(t => ({ tokens: new Set(_normNombre(t.nombre).split(" ").filter(Boolean)), coste: Number(t.coste_empresa) || 0 }));
      function costeRealOperario(nombre) {
        const toks = _normNombre(nombre).split(" ").filter(Boolean);
        if (!toks.length) return null;
        let best = null, bestScore = 0;
        for (const d of detalleOps) {
          let inter = 0; for (const t of toks) if (d.tokens.has(t)) inter++;
          const score = inter / Math.max(toks.length, d.tokens.size);
          if (score > bestScore) { bestScore = score; best = d; }
        }
        return (best && bestScore >= 0.6) ? best.coste : null;
      }
      // Horas: las PAGADAS (todo lo registrado por los operarios: obra,
      // vacaciones, festivos, formación…) y las de OBRA (tipo trabajo/extra,
      // las que llevan obra). El €/h de la mano de obra productiva se saca
      // sobre las de obra (Alberto, 03/10: sept 872 h pagadas, 760 en obra →
      // 16,8 €/h y no 14,6).
      const TIPOS_HORA_OBRA = new Set(["trabajo", "extra"]);
      const porOperario = {};
      let horasOperarios = 0, horasObraOperarios = 0;
      for (const r of (dataRT?.registros || [])) {
        if (!r.persona_id) continue;
        const pnombre = (r.persona && r.persona.nombre) || r.persona_id;
        if (esIndirectoNomina(pnombre)) continue; // indirectos fuera de Coste MO
        if (!porOperario[r.persona_id]) porOperario[r.persona_id] = { nombre: pnombre, horas: 0, horas_obra: 0, coste_estimado: 0 };
        const enObra = TIPOS_HORA_OBRA.has(r.tipo || "trabajo") && !!r.obra_id;
        porOperario[r.persona_id].horas += r.horas || 0;
        if (enObra) porOperario[r.persona_id].horas_obra += r.horas || 0;
        porOperario[r.persona_id].coste_estimado += r.coste_calculado || 0;
        horasOperarios += r.horas || 0;
        if (enObra) horasObraOperarios += r.horas || 0;
      }
      const costeMOEstimado = Math.round(Object.values(porOperario).reduce((s, op) => s + op.coste_estimado, 0) * 100) / 100;
      let costeMO = usaNomina ? nominaRow.importe : costeMOEstimado;
      const horasPagadas = Math.round(horasOperarios * 100) / 100;
      const totalHoras = Math.round(horasObraOperarios * 100) / 100;   // horas en obra

      // ── v0.6 (11/09/2026) · CONTABILIDAD DE HOLDED ─────────────────
      // Gastos y ventas del mes leídos del libro diario (API v2). Sirven para:
      //  1) Meses pasados SIN nómina importada: el coste de personal sale
      //     de la 640+642 contabilizada (may-jun 2026 cuadran al céntimo con
      //     el PDF), repartida entre operarios e indirectos con la última
      //     nómina conocida. Antes se usaba horas × 30 €/h —tarifa que YA
      //     incluye indirectos— y el panel restaba además indirectos y
      //     gastos generales: doble conteo y meses no comparables.
      //  2) Dar el resultado real y el contable del mes en la respuesta.
      let contabilidad = null;
      let usaContable = false;
      const _hoyC = new Date();
      const esMesEnCursoC = (año === _hoyC.getFullYear() && mes === (_hoyC.getMonth() + 1));
      try {
        const { leerPyGMes } = require("./ara-os-resultado-mensual.cjs");
        contabilidad = await leerPyGMes(año, mes);
        if (contabilidad && !contabilidad.ok) contabilidad = { ok: false, error: contabilidad.error || "sin datos" };
      } catch (e) {
        contabilidad = { ok: false, error: e.message };
      }
      let indirectosDesdeContable = null;
      if (!usaNomina && !esMesEnCursoC && contabilidad && contabilidad.ok && contabilidad.grupos.personal > 1000) {
        // Indirectos de referencia: la nómina importada más cercana en el
        // tiempo (antes o después). Una sola lectura de la hoja `nominas`.
        let refInd = null;
        try {
          await asegurarHojaNominas();
          const filasNom = await leerTabla(HOJA_NOMINAS, NOMINAS_HEADERS);
          const objetivo = año * 12 + mes;
          let mejorDist = Infinity;
          for (const f of filasNom) {
            const mm = /^(\d{4})-(\d{2})$/.exec(String(f.periodo || "").trim());
            const ind = _parseEurFlexible(f.indirectos_eur) || 0;
            if (!mm || ind <= 0) continue;
            const dist = Math.abs(Number(mm[1]) * 12 + Number(mm[2]) - objetivo);
            if (dist < mejorDist) { mejorDist = dist; refInd = ind; }
          }
        } catch (e) {
          console.warn("[posicion-neta-real] indirectos de referencia:", e.message);
        }
        const personal = contabilidad.grupos.personal;
        indirectosDesdeContable = Math.round(Math.min(refInd || 0, personal) * 100) / 100;
        costeMO = Math.round((personal - indirectosDesdeContable) * 100) / 100;
        usaContable = true;
      }
      // €/h productivo (sobre horas en obra) y €/h pagado (sobre todas las horas,
      // para repartir el coste de la nómina entre operarios).
      const costeHoraReal = totalHoras > 0 ? Math.round((costeMO / totalHoras) * 100) / 100 : 0;
      const costeHoraPagada = horasPagadas > 0 ? Math.round((costeMO / horasPagadas) * 100) / 100 : 0;
      // Coste y €/h por operario
      for (const op of Object.values(porOperario)) {
        const real = costeRealOperario(op.nombre);
        if (usaNomina && real != null) {
          op.coste = Math.round(real * 100) / 100;            // coste empresa real del PDF
          op.fuente = "nomina";
        } else if (usaContable) {
          op.coste = Math.round(op.horas * costeHoraPagada * 100) / 100; // contabilidad repartida por horas pagadas
          op.fuente = "contabilidad";
        } else if (usaNomina) {
          op.coste = Math.round(op.horas * costeHoraPagada * 100) / 100; // reparto por horas pagadas
          op.fuente = "reparto";
        } else {
          op.coste = Math.round(op.coste_estimado * 100) / 100; // estimación
          op.fuente = "estimado";
        }
        op.coste_hora = op.horas > 0 ? Math.round((op.coste / op.horas) * 100) / 100 : 0;
        op.coste_hora_obra = op.horas_obra > 0 ? Math.round((op.coste / op.horas_obra) * 100) / 100 : 0;
      }
      const moDesglose = Object.values(porOperario)
        .sort((a, b) => b.horas - a.horas)
        .map(o => ({ nombre: o.nombre, horas: o.horas, horas_obra: Math.round(o.horas_obra * 100) / 100, coste: o.coste, coste_hora: o.coste_hora, coste_hora_obra: o.coste_hora_obra, fuente: o.fuente }));
      let nominaIndirectosEur = (nominaRow && nominaRow.indirectos) || (indirectosDesdeContable || 0);
      let nominaIndirectosDetalle = (nominaRow && Array.isArray(nominaRow.detalle) ? nominaRow.detalle : [])
        .filter(t => t.categoria === "indirecto")
        .map(t => ({ nombre: t.nombre, coste_empresa: Math.round((Number(t.coste_empresa) || 0) * 100) / 100 }))
        .sort((a, b) => b.coste_empresa - a.coste_empresa);
      // Mes EN CURSO sin nómina importada → estimar la parte proporcional
      // (días transcurridos) usando la última nómina disponible como referencia.
      let nominaIndirectosEstimado = false;
      let nominaIndirectosFraccion = null;
      const _hoyD = new Date();
      const esMesEnCurso = (año === _hoyD.getFullYear() && mes === (_hoyD.getMonth() + 1));
      if (nominaIndirectosEur <= 0 && esMesEnCurso) {
        let refDetalle = null;
        for (let back = 1; back <= 12 && !refDetalle; back++) {
          let m2 = mes - back, a2 = año;
          while (m2 < 1) { m2 += 12; a2 -= 1; }
          const rr = await leerNominaRow(a2, m2);
          if (rr && rr.indirectos > 0 && Array.isArray(rr.detalle)) {
            const ind = rr.detalle.filter(t => t.categoria === "indirecto");
            if (ind.length) refDetalle = ind;
          }
        }
        if (refDetalle) {
          const diasMes = new Date(año, mes, 0).getDate();
          const frac = Math.min(_hoyD.getDate(), diasMes) / diasMes;
          nominaIndirectosFraccion = Math.round(frac * 1000) / 10;
          nominaIndirectosEstimado = true;
          nominaIndirectosDetalle = refDetalle
            .map(t => ({ nombre: t.nombre, coste_empresa: Math.round((Number(t.coste_empresa) || 0) * frac * 100) / 100 }))
            .sort((a, b) => b.coste_empresa - a.coste_empresa);
          nominaIndirectosEur = Math.round(nominaIndirectosDetalle.reduce((s, t) => s + t.coste_empresa, 0) * 100) / 100;
        }
      }

      // ── Obras tocadas este mes (registros-tiempo del mes) ───────
      const obrasMesTocadas = new Set();
      const horasMesXObra   = {};
      const costeMOXObra    = {}; // coste MO del mes por obra (horas × tarifa operario)
      for (const r of (dataRT?.registros || [])) {
        if (r.obra_id && (r.tipo === "trabajo" || r.tipo === "extra")) {
          obrasMesTocadas.add(r.obra_id);
          horasMesXObra[r.obra_id]  = (horasMesXObra[r.obra_id]  || 0) + (r.horas || 0);
          costeMOXObra[r.obra_id]   = (costeMOXObra[r.obra_id]   || 0) + (r.coste_calculado || 0);
        }
      }

      // ── Devengado: obras activas (todas) + obras tocadas este mes ─
      // Unión: todas las obras activas del mapa, ordenadas por tocadas este mes primero
      const obrasSeen = new Set();
      const obrasActivas = [];
      // Primero las tocadas este mes
      for (const oid of obrasMesTocadas) {
        const info = obrasMapAll[oid];
        if (info && !obrasSeen.has(info.obra_id)) {
          obrasSeen.add(info.obra_id);
          obrasActivas.push({ ...info, tocada_mes: true });
        }
      }
      // Luego el resto de obras activas (no tocadas este mes)
      for (const info of Object.values(obrasMapAll)) {
        if (!info.obra_id || obrasSeen.has(info.obra_id)) continue;
        obrasSeen.add(info.obra_id);
        obrasActivas.push({ ...info, tocada_mes: false });
      }

      // ── Gastos materiales filtrados por mes (Holded purchases del mes) ──
      // gastos-resumen-obras devuelve compras de todos los tiempos.
      // Para el P&L mensual usamos las compras del mes desde balance-anual.
      let gastosMatMes = mesDatos?.gastos || 0; // gastos Holded del mes (se ajusta abajo a neto con rectificativas)

      let ingresoDevengado = 0;
      let ingresoMes = 0; // delta ingreso este mes = Σ horas_mes × (importe/horas_previstas)
      // % de comisión comercial: config_dinero (comision_comercial_pct), 20 por defecto
      let comisionPct = COMISION_COMERCIAL_PCT_DEF;
      // config_dinero «presupuesto_provisional»: importe de obras sin pto_total en el panel (excepción temporal)
      let provisionales = {};
      try {
        const CD = require("./lib/config-dinero.cjs");
        const cfg = await CD.leerConfigDinero();
        const fila = CD.valorConfig(cfg.filas, "comision_comercial_pct");
        const v = fila ? _parseEurFlexible(fila.valor) : null;
        if (v != null && v > 0) comisionPct = v > 1 ? v / 100 : v;
        const filaProv = CD.valorConfig(cfg.filas, "presupuesto_provisional");
        provisionales = require("./lib/presupuesto-provisional.cjs").leerProvisionales(filaProv?.valor);
      } catch (e) { console.warn("[posicion-neta-real] config_dinero:", e.message); }
      let comisionDevengadaMes = 0;
      const obrasSinFechaFin = []; // v0.6: terminadas sin fecha de cierre → no se reconocen (aviso)
      const obrasDesglose = obrasActivas.map(o => {
        // Importe SIN IVA: hoja (ya normalizada) > factura Holded (subtotal).
        // v0.6: en órdenes «otras» cuyo importe de la hoja no trae desglose de IVA,
        // manda la factura emitida (subtotal) si existe.
        const importeFacturado = importeFacturadoXObra[o.obra_id] || 0;
        const prov = require("./lib/presupuesto-provisional.cjs").importeConProvisional(o.obra_id, o.importe, provisionales);
        let importe = prov.importe || importeFacturado;
        if (o.tipo === "otras" && importeFacturado > 0 &&
            (o.importe_fuente === "total_sin_desglose" || o.importe_fuente === "legacy")) {
          importe = importeFacturado;
        }
        const horasPrevistas = o.horas_previstas || 0;
        // horasAcum = horas hasta fin del mes consultado
        // horasAcumAntes = horas hasta fin del mes anterior (delta real del mes)
        const horasAcum      = horasAcumMap[o.obra_id]      || horasAcumMap[o.nombre]      || 0;
        const horasAcumAntes = horasAcumMapAntes[o.obra_id] || horasAcumMapAntes[o.nombre] || 0;
        const horasMes       = horasMesXObra[o.obra_id]     || horasMesXObra[o.nombre]     || 0;
        const horasTotalReal = horasTotalMap[o.obra_id] || horasTotalMap[o.nombre] || 0;
        // Obra sin tiempo estimado (solo obras_otras sin dias_estimados)
        const sinTiempoEstimado = horasPrevistas === 0 && o.tipo === "otras";
        // Terminada: fase de finalización. INCIDENCIAS implica que pasó por FINALIZADA antes.
        const esIncidenciaFase = (o.tipo === "plan5" && o.fase === "19_INCIDENCIAS")
                              || (o.tipo === "otras" && o.fase === "INCIDENCIAS");
        const faseTerminada = (o.tipo === "plan5" && FASES_TERMINADAS_PLAN5.has(o.fase))
                           || (o.tipo === "otras" && FASES_OO_DEVENGADO_100.has(o.fase));

        // ── v0.6 (11/09/2026) · MES DE CIERRE REAL ──────────────────────
        // La fase es la de HOY. Antes, una obra que hoy está finalizada se
        // trataba como finalizada en todos los meses pasados, y además el
        // «tramo pendiente» (1 − horas antes/horas previstas) se volvía a
        // reconocer cada mes si la obra acabó con menos horas de las
        // previstas o sin horas. Resultado ene-ago 2026: 28.367 € de ingreso
        // repetido (Chiva 7 extras 17.559 € sobre 2.352 €, Maracaibo 2
        // ampliación, Guardabosques extras, Hostales La Negrilla).
        // Ahora el cierre tiene fecha: fin real / facturada / cobrada de la
        // orden, o el último día con horas registradas.
        //   fecha_fin > fin de este mes  → este mes la obra seguía en curso
        //   fecha_fin dentro de este mes → se reconoce el tramo pendiente
        //   fecha_fin < inicio de mes    → ya reconocida: 0
        //   sin fecha                    → 0 y aviso
        const fechaFin = o.fecha_fin
          || ultimaFechaMap[o.obra_id] || ultimaFechaMap[o.nombre] || "";
        // Cobradas sin horas ni fechas = obras antiguas (anteriores al registro de horas): ya cerradas, sin aviso.
        const cobradaAntigua    = faseTerminada && !fechaFin && (o.fase === "18_COBRADA" || o.fase === "COBRADA" || o.import_fixner);
        const cerradaAntesDeMes = faseTerminada && ((fechaFin && fechaFin < desde) || cobradaAntigua);
        const cierraEsteMes     = faseTerminada && fechaFin && fechaFin >= desde && fechaFin <= hasta;
        const sinFechaFin       = faseTerminada && !fechaFin && !cobradaAntigua;
        const terminada = esIncidenciaFase || cerradaAntesDeMes || cierraEsteMes || sinFechaFin;
        const devengado100 = cerradaAntesDeMes || cierraEsteMes;
        if (sinFechaFin && importe > 0) obrasSinFechaFin.push({ obra_id: o.obra_id, nombre: o.nombre, fase: o.fase, importe });

        // horasTotal = total all-time de esta obra (denominador para reparto proporcional)
        // Se busca por obra_id Y por nombre para cubrir ambos formatos en registros-tiempo
        const horasTotalObra = horasTotalReal || horasMes || 1;

        const avanceReal = horasPrevistas > 0
          ? Math.round(horasAcum / horasPrevistas * 10000) / 100
          : (sinTiempoEstimado ? Math.round(Math.min(horasAcum, horasTotalObra) / horasTotalObra * 10000) / 100 : 0);
        const avance = devengado100 ? 100 : Math.min(100, avanceReal);
        const devengado = Math.round(importe * avance / 100 * 100) / 100;

        // Ingreso del mes
        let ingresoObraMes;
        if (esIncidenciaFase || cerradaAntesDeMes || sinFechaFin) {
          ingresoObraMes = 0; // garantía, ya reconocida o sin fecha de cierre
        } else if (cierraEsteMes) {
          // Tramo que faltaba hasta el 100 %, UNA sola vez (el mes del cierre).
          let ratioAntes;
          if (horasPrevistas > 0)       ratioAntes = horasAcumAntes / horasPrevistas;
          else if (horasTotalReal > 0)  ratioAntes = horasAcumAntes / horasTotalReal;
          else                          ratioAntes = 0; // sin horas: todo el importe en el mes de cierre
          ingresoObraMes = Math.round(importe * (1 - Math.min(1, ratioAntes)) * 100) / 100;
        } else if (sinTiempoEstimado) {
          // Directo: importe × horasMes / horasTotal (evita problemas de clave en horasAcumMap)
          ingresoObraMes = Math.round(importe * Math.min(1, horasMes / horasTotalObra) * 100) / 100;
        } else {
          const ratioAcum  = Math.min(1, horasPrevistas > 0 ? horasAcum      / horasPrevistas : 0);
          const ratioAntes = Math.min(1, horasPrevistas > 0 ? horasAcumAntes  / horasPrevistas : 0);
          ingresoObraMes = Math.round((importe * ratioAcum - importe * ratioAntes) * 100) / 100;
        }
        const materiales    = gastosMapObra[o.obra_id] || gastosMapObra[o.nombre] || 0;
        // Coste neto de materiales = coste compra × (1 − margen_materiales)
        const costeNetoMat  = Math.round(materiales * (1 - MARGEN_MATERIALES) * 100) / 100;
        // Margen bruto = devengado − coste_neto_mat (los costes MO y fijos van en el P&L global)
        const margenNeto    = Math.round((devengado - costeNetoMat) * 100) / 100;
        ingresoDevengado += devengado;
        ingresoMes += ingresoObraMes;
        return {
          obra_id:          o.obra_id,
          nombre:           o.nombre,
          importe,
          sin_importe:      o.importe === 0 && importeFacturado === 0 && o.tipo === "otras",
          importe_de_factura: o.importe === 0 && importeFacturado > 0,
          horas_previstas:  horasPrevistas,
          horas_registradas: Math.round(horasAcum * 100) / 100,
          horas_mes:        Math.round(horasMes * 100) / 100,
          avance_pct:       avance,
          avance_real_pct:  Math.round(avanceReal * 100) / 100,
          terminada,
          fecha_fin:        fechaFin || null,
          cierra_este_mes:  !!cierraEsteMes,
          importe_fuente:   prov.provisional ? "presupuesto_provisional" : (o.importe_fuente || (o.tipo === "plan5" ? "pto_total" : null)),
          importe_provisional: prov.provisional, importe_provisional_ref: prov.ref, provisional_sobra: prov.sobra,
          es_incidencia:    esIncidenciaFase,
          sin_tiempo_estimado: sinTiempoEstimado,
          fase:             o.fase || "",
          devengado,
          ingreso_mes:      ingresoObraMes,
          comision_comercial_mes: 0,       // se rellena abajo con el beneficio REAL
          tipo_obra:        o.tipo,
          materiales_eur:   Math.round(materiales * 100) / 100,
          margen_bruto:     margenNeto,                            // devengado − mat×0.70
          tocada_mes:       o.tocada_mes || obrasMesTocadas.has(o.nombre),
        };
      }).sort((a, b) => {
        // Obras tocadas este mes primero, luego por horas del mes desc
        if (a.tocada_mes !== b.tocada_mes) return a.tocada_mes ? -1 : 1;
        return b.horas_mes - a.horas_mes;
      });

      // ── Desglose de compras (materiales) del mes, AGRUPADO por etiqueta/obra ──
      // Incluye rectificativas de compra (total negativo) → el neto por
      // etiqueta deduce los abonos. Cada doc va a un único grupo (su conjunto
      // de etiquetas), por lo que la suma de grupos = neto del mes y cuadra
      // con gastos_materiales_eur (que se ajusta a este neto).
      let materialesGrupos = [];
      let materialesMesNeto = null;
      const comisionFacturadaMes = [];
      let costesGeneralesEur = 0;
      let costesGeneralesGrupos = [];
      try {
        const [resPur, resRef, etiquetasMat] = await Promise.all([
          obtenerPurchases(),
          obtenerPurchaseRefunds(),
          leerTabla(HOJA_ETIQUETAS, ETIQUETAS_HEADERS),
        ]);
        // tag → nombre de obra (para el sumario por obra)
        const tagToObra = {};
        for (const e of (etiquetasMat || [])) {
          for (const t of parseTagsCSV(e.etiqueta_holded)) {
            tagToObra[t] = (obrasMapAll[e.obra_id] && obrasMapAll[e.obra_id].nombre) || e.nombre_comunidad || e.obra_id || t;
          }
        }
        // Detección de obra más allá de la hoja: por slug del nombre de obra
        // y por código de OT (ot + dígitos). Evita meter material de obra en
        // costes generales cuando la etiqueta no está dada de alta en la hoja.
        const slugAlfa = s => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
        const obraSlugs = [];
        const slugVistos = new Set();
        for (const info of Object.values(obrasMapAll)) {
          if (!info || !info.nombre) continue;
          const sl = slugAlfa(info.nombre);
          if (sl.length < 5 || slugVistos.has(sl)) continue;
          slugVistos.add(sl);
          obraSlugs.push({ slug: sl, nombre: info.nombre });
        }
        // Toda etiqueta que no es de obra es coste general (no hay lista cerrada
        // de generales). Para no confundir una etiqueta general con una obra:
        //  · las de ETIQUETAS_NO_OBRA nunca son obra (oficina, seguros…);
        //  · por nombre, solo si la etiqueta ES el nombre de la obra o lo
        //    contiene entero y el nombre es largo (≥ 8 letras): «asesoria»
        //    contenía «soria» y se iba a material de obra.
        const resolverObraNombre = (tag) => {
          const ts = slugAlfa(tag);
          if (ETIQUETAS_NO_OBRA.has(ts)) return null;
          if (tagToObra[tag]) return tagToObra[tag];
          if (ts.length >= 5) {
            for (const o of obraSlugs) {
              if (ts === o.slug || (o.slug.length >= 8 && ts.includes(o.slug))) return o.nombre;
            }
          }
          return null;
        };
        const esObraTag = (tag) => !!resolverObraNombre(tag) || /^ot\d/i.test(String(tag || "").trim());
        const docsMes = [];
        const addDoc = (f, tipo, signo) => {
          const fch = new Date((Number(f.date) || 0) * 1000);
          if (fch.getFullYear() !== año || (fch.getMonth() + 1) !== mes) return;
          // v0.6: los recibos de la Seguridad Social que entran como «compra»
          // son gasto de PERSONAL (642), ya incluido en el coste MO/indirectos.
          // Contarlos también como gasto general los duplicaba (ago-2026: 5.222,65 €).
          if (/tesorer[ií]a\s+general\s+de\s+la\s+(seg|s\.?\s?s)/i.test(String(f.contactName || f.contact || ""))) return;
          // Facturas del comercial (comisión de las obras Plan 5): no se cargan
          // enteras el mes en que llegan; se devenga la comisión por obra (arriba).
          if (RE_COMISION_COMERCIAL.test(String(f.contactName || f.contact || ""))) {
            comisionFacturadaMes.push({ id: f.id || null, fecha: f.date ? fch.toISOString().slice(0, 10) : null, proveedor: f.contactName || f.contact || "",
              concepto: f.docNumber || "", total: Math.round(signo * Math.abs(Number(f.subtotal) || Number(f.total) || 0) * 100) / 100 });
            return;
          }
          docsMes.push({
            id:        f.id || null,
            fecha:     f.date ? fch.toISOString().slice(0, 10) : null,
            proveedor: f.contactName || f.contact || "",
            concepto:  f.docNumber || f.description || f.desc || "",
            // v0.6: el P&L va SIN IVA (el IVA soportado no es gasto). Antes se
            // sumaba el total con IVA y el material salía un 21 % más caro.
            total:     Math.round(signo * Math.abs(Number(f.subtotal) || Number(f.total) || 0) * 100) / 100,
            total_con_iva: Math.round(signo * Math.abs(Number(f.total) || 0) * 100) / 100,
            etiquetas: Array.isArray(f.tags) ? f.tags : [],
            tipo,
          });
        };
        for (const f of (resPur?.docs || [])) addDoc(f, "compra", 1);
        for (const f of ((resRef && !resRef.error && resRef.docs) || [])) addDoc(f, "rectificativa", -1);

        // Agrupar por conjunto de etiquetas (clave única → sin doble conteo)
        const grupos = {};
        let neto = 0;
        for (const d of docsMes) {
          const key = d.etiquetas.length ? d.etiquetas.slice().sort().join(" · ") : "__sin__";
          if (!grupos[key]) {
            const obra   = d.etiquetas.map(resolverObraNombre).find(Boolean) || null;
            const esObra = !!obra || d.etiquetas.some(esObraTag);
            grupos[key] = {
              etiqueta: d.etiquetas.length ? d.etiquetas.join(" · ") : null,
              obra,
              esObra,
              total: 0,
              compras: [],
            };
          }
          grupos[key].total = Math.round((grupos[key].total + d.total) * 100) / 100;
          grupos[key].compras.push(d);
          neto += d.total;
        }
        materialesGrupos = Object.values(grupos).map(g => ({
          etiqueta:  g.etiqueta,
          obra:      g.obra,
          // Categoría superior: obra detectada (hoja, slug de nombre o código
          // de OT) → material de obra; resto (gasolina/herramientas/sin
          // etiqueta) → coste general.
          categoria: g.esObra ? "obra" : "general",
          // Etiqueta sin asignar → "Gastos generales" por defecto.
          label:     g.obra || g.etiqueta || "Gastos generales",
          total:     g.total,
          n_compras: g.compras.length,
          compras:   g.compras.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
        })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
        // Separar costes generales (no-obra) → van a costes fijos indirectos,
        // no a materiales. Materiales = solo material imputado a obra.
        costesGeneralesGrupos = materialesGrupos.filter(g => g.categoria === "general");
        const gruposObra = materialesGrupos.filter(g => g.categoria !== "general");
        costesGeneralesEur = Math.round(costesGeneralesGrupos.reduce((s, g) => s + g.total, 0) * 100) / 100;
        materialesGrupos = gruposObra;
        materialesMesNeto = Math.round(gruposObra.reduce((s, g) => s + g.total, 0) * 100) / 100;
      } catch (e) {
        console.warn("[posicion-neta-real] materialesGrupos falló:", e.message);
      }
      // ── Comisión comercial (Plan 5) devengada este mes ──────────────
      // Su % del BENEFICIO REAL de la obra (el de rentabilidad-obra, el mismo
      // que D14 de la escalera), en proporción a lo ejecutado este mes. Se
      // devenga con la obra, no el mes en que llega la factura del comercial.
      // Obra sin beneficio real (rentabilidad sin respuesta, o aún sin coste
      // real: ni horas ni material) → 0 y aviso; nunca el presupuestado.
      const avisos = [];
      const obrasComision = obrasDesglose.filter(o => o.tipo_obra === "plan5" && o.importe > 0 && o.ingreso_mes);
      const rentabs = await Promise.all(obrasComision.map(o =>
        fetchLocal(`/api/ara-os/holded/rentabilidad-obra/${encodeURIComponent(o.obra_id)}?token=${encodeURIComponent(token)}`).catch(() => null)));
      obrasComision.forEach((o, i) => {
        const re = rentabs[i] && rentabs[i].ok ? rentabs[i].real || {} : null;
        const ben = re ? Number(re.beneficio_real) : NaN;
        const conReal = re && Number.isFinite(ben) && Number(re.coste_real) > 0;
        if (!conReal) {
          avisos.push({ nivel: "ambar", texto: `Comisión sin beneficio real: ${o.nombre}` });
          return;
        }
        o.comision_comercial_mes = Math.round(comisionPct * Math.max(0, ben) * (o.ingreso_mes / o.importe) * 100) / 100;
        o.beneficio_real_obra = Math.round(ben * 100) / 100;
        comisionDevengadaMes += o.comision_comercial_mes;
      });

      // Ajustar el gasto de materiales del mes al neto de obra (sin generales)
      if (materialesMesNeto != null) gastosMatMes = materialesMesNeto;

      // P&L mensual: ingreso del mes (delta) vs gastos del mes
      const beneficioAntesIndirectos = ingresoMes - gastosMatMes - costeMO;
      // BENEFICIO REAL DEL MES: una sola cifra, la misma en Mi panel y aquí.
      //   antes de indirectos − personal de gestión − costes generales
      //   − comisión comercial devengada
      // El personal de gestión estimado (mes en curso sin nómina) no se resta:
      // ya está dentro del coste MO estimado. Los préstamos NO son gasto (la
      // cuota que ARA pasa a Instalaciones es un préstamo, 54200001): fuera.
      const nominaIndirectosComputable = nominaIndirectosEstimado ? 0 : nominaIndirectosEur;
      const comisionDevengada = Math.round(comisionDevengadaMes * 100) / 100;
      const beneficioReal = beneficioAntesIndirectos - nominaIndirectosComputable - costesGeneralesEur - comisionDevengada;

      res.json({
        ok: true,
        año, mes,
        // P&L mensual (datos del mes)
        ingreso_mes_eur:              Math.round(ingresoMes * 100) / 100,
        gastos_materiales_eur:        Math.round(gastosMatMes * 100) / 100,
        coste_mo_eur:                 Math.round(costeMO * 100) / 100,
        coste_mo_fuente:              usaNomina ? "nomina" : (usaContable ? "contabilidad" : "estimado"),
        coste_hora_real:              costeHoraReal,
        nomina_mes:                   usaNomina ? Math.round(costeMO * 100) / 100 : null,
        nomina_indirectos_eur:        Math.round(nominaIndirectosEur * 100) / 100,
        nomina_indirectos_detalle:    nominaIndirectosDetalle,
        nomina_indirectos_estimado:   nominaIndirectosEstimado,
        nomina_indirectos_fraccion:   nominaIndirectosFraccion,
        materiales_grupos:            materialesGrupos,
        costes_generales_eur:         Math.round(costesGeneralesEur * 100) / 100,
        costes_generales_grupos:      costesGeneralesGrupos,
        total_horas_mo:               Math.round(totalHoras * 100) / 100,   // horas en obra (trabajo/extra)
        horas_pagadas:                horasPagadas,                         // todas las registradas por operarios
        coste_hora_pagada:            costeHoraPagada,
        beneficio_antes_indirectos:   Math.round(beneficioAntesIndirectos * 100) / 100,
        comision_comercial_pct:       comisionPct,
        comision_comercial_devengada_eur: comisionDevengada,
        comision_comercial_facturada_mes: comisionFacturadaMes,             // informativo: lo facturado este mes
        nomina_indirectos_computable_eur: Math.round(nominaIndirectosComputable * 100) / 100,
        beneficio_real_eur:           Math.round(beneficioReal * 100) / 100,
        margen_real_pct:              ingresoMes > 0 ? Math.round(beneficioReal / ingresoMes * 1000) / 10 : null,
        // v0.6: contabilidad del mes y los dos resultados que cuadran con ella
        contabilidad:                 contabilidad,
        nomina_indirectos_fuente:     (nominaRow && nominaRow.indirectos) ? "nomina" : (usaContable ? "ultima_nomina_conocida" : (nominaIndirectosEstimado ? "estimado_mes_en_curso" : null)),
        // Contraste, NO es el beneficio: obra ejecutada del mes − todos los gastos
        // contables (incluye la factura entera del comercial y nóminas tal cual
        // las contabiliza Holded). Antes se llamaba resultado_real_eur y se
        // confundía con beneficio_real_eur (Alberto, 03/10).
        contraste_obra_menos_gastos_contables_eur: (contabilidad && contabilidad.ok) ? Math.round((ingresoMes - contabilidad.gastos) * 100) / 100 : null,
        resultado_contable_eur:       (contabilidad && contabilidad.ok) ? contabilidad.resultado : null,
        obras_terminadas_sin_fecha:   obrasSinFechaFin,
        avisos,
        mo_desglose:                  moDesglose,
        // Facturación Holded (referencia)
        facturado_mes_eur:            Math.round(facturadoMes * 100) / 100,
        cobrado_mes_eur:              Math.round(cobradoMes * 100) / 100,
        // Devengado acumulado (total a fecha)
        ingreso_devengado_eur:        Math.round(ingresoDevengado * 100) / 100,
        ingreso_pendiente_eur:        Math.round((ingresoDevengado - cobradoMes) * 100) / 100,
        obras:                        obrasDesglose,
        n_obras_activas:              obrasActivas.length,
        n_obras_mes:                  obrasMesTocadas.size,
      });
    } catch (e) {
      console.error("[holded/posicion-neta-real]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // ─────────────────────────────────────────────────────────────
  // GET /api/ara-os/holded/iva-trimestre
  // IVA pendiente del trimestre en curso (repercutido - soportado)
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/holded/iva-trimestre", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/holded/iva-trimestre", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      // Calcular trimestre en curso
      const hoy    = new Date();
      const mes    = hoy.getMonth(); // 0-11
      const año    = hoy.getFullYear();
      const trim   = Math.floor(mes / 3); // 0,1,2,3
      const mesIni = trim * 3;
      let tsIni    = Math.floor(new Date(año, mesIni, 1).getTime() / 1000);
      let tsHoy    = Math.floor(hoy.getTime() / 1000);
      // Opcional: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD para otro periodo (p. ej.
      // el trimestre anterior aún sin liquidar, o el año para cuadrar con Holded).
      const _iso = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null;
      const desdeQ = _iso(req.query.desde), hastaQ = _iso(req.query.hasta);
      if (desdeQ) tsIni = Math.floor(new Date(desdeQ + "T00:00:00Z").getTime() / 1000);
      if (hastaQ) tsHoy = Math.floor(new Date(hastaQ + "T23:59:59Z").getTime() / 1000);
      const mesesAtras = Math.max(6, Math.ceil((Date.now() / 1000 - tsIni) / (30 * 86400)) + 1);

      const [resInvoices, resPurchases] = await Promise.all([
        obtenerInvoices({ mesesHaciaAtras: mesesAtras }),
        obtenerPurchases({ mesesHaciaAtras: mesesAtras }),
      ]);
      // obtenerInvoices/obtenerPurchases devuelven { docs: [...] }
      const invoices  = (resInvoices?.docs || []).map(invoiceComoCruda);
      const purchases = resPurchases?.docs || [];

      // IVA repercutido (ventas del trimestre)
      const ventasTrim = invoices.filter(f => f.date >= tsIni && f.date <= tsHoy);
      const ivaRepercutido = ventasTrim.reduce((s, f) => s + (f.tax || 0), 0);

      // IVA soportado (compras del trimestre)
      const comprasTrim = purchases.filter(f => f.date >= tsIni && f.date <= tsHoy);
      const ivaSoportado = comprasTrim.reduce((s, f) => s + (f.tax || 0), 0);

      const ivaResultado = ivaRepercutido - ivaSoportado;

      const nombresTrim = ['1T', '2T', '3T', '4T'];

      const _ivaResp = {
        ok: true,
        trimestre: desdeQ || hastaQ ? "periodo" : `${nombresTrim[trim]} ${año}`,
        periodo_inicio: new Date(tsIni * 1000).toISOString().slice(0, 10),
        periodo_fin: new Date(Math.min(tsHoy * 1000, Date.now())).toISOString().slice(0, 10),
        iva_repercutido: Math.round(ivaRepercutido * 100) / 100,
        iva_soportado:   Math.round(ivaSoportado * 100) / 100,
        iva_resultado:   Math.round(ivaResultado * 100) / 100,
        num_facturas_venta:  ventasTrim.length,
        num_facturas_compra: comprasTrim.length,
      };
      res.json(_ivaResp);
    } catch (e) {
      console.error("[holded/iva-trimestre]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


};

// v0.6.0: exportar funciones para que otros módulos (ara-os-obras-otras)
// puedan reutilizar la lógica de Holded con su caché.
module.exports.obtenerPurchases = obtenerPurchases;
module.exports.obtenerPurchaseRefunds = obtenerPurchaseRefunds;
module.exports.obtenerComprasConRectificativas = obtenerComprasConRectificativas;
module.exports.obtenerInvoices = obtenerInvoices;

// v0.7.0: nuevas funciones para Sprint "Rediseño Ficha OT"
module.exports.obtenerContactos = obtenerContactos;
module.exports.crearContacto = crearContacto;
module.exports.obtenerSeriesFactura = obtenerSeriesFactura;
module.exports.obtenerTaxes = obtenerTaxes;
module.exports.crearInvoiceBorrador = crearInvoiceBorrador;
// Etiquetas de obra (holded_etiquetas): las usa el "+ Crear tag" de la ficha
module.exports.anadirEtiquetaObra = anadirEtiquetaObra;
module.exports.anadirEtiquetasObras = anadirEtiquetasObras;
module.exports.leerEtiquetasObra = leerEtiquetasObra;
