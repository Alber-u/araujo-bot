// ============================================================
// ARA OS — Obras Otras (NO Plan 5) · v0.2.0 (19/05/2026)
// ============================================================
// Sprint "Otras Órdenes Completas".
//
// v0.2.0 — Cambios desde v0.1.0:
//   - Nuevas columnas U-Z en obras_otras:
//       U subtotal_eur
//       V iva_eur
//       W total_eur     (alias canónico de 'importe' a partir de aquí)
//       X tags_holded   (JSON array, ej: ["oo2026001","tag-x"])
//       Y facturada     (TRUE / FALSE)
//       Z cobrada       (TRUE / FALSE)
//   - Campo 'importe' (G) se mantiene como alias de total_eur para
//     compatibilidad con datos antiguos. Las nuevas obras escriben
//     ambos campos. Las antiguas siguen funcionando porque
//     total_eur cae al string vacío y el frontend hace fallback.
//   - Validación: subtotal + iva pueden estar vacíos. Si están,
//     intentamos derivar de total. Cero ambigüedad: total siempre
//     prevalece como número final visible.
//   - tags_holded acepta:
//       * array          ["oo2026001","x"]
//       * string CSV     "oo2026001,x"
//       * string pipe    "oo2026001|x"
//     Se normaliza a JSON array al guardar.
//   - Nuevo endpoint:
//       GET /obras-otras/:id/economico
//       Cruza con Holded por tags y devuelve:
//         { coste_real, num_facturas, facturas:[...], margen,
//           presupuestado, pagado, pendiente }
//   - PATCH soporta los nuevos campos.
//   - Tipos: añadido 'mantenimientos' al catálogo.
//
// Compatibilidad: las obras existentes en la hoja NO se tocan.
// Si una fila no tiene columnas U-Z, salen como string vacío.
// El frontend hace fallback: total_eur || importe.
// ============================================================

const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const TAB_OBRAS = "obras_otras";
const TAB_HISTORIAL = "obras_otras_historial";

// Cabeceras (orden importa — las columnas se mapean por índice)
const OB_HEADERS = [
  "obra_id",            // A
  "nombre",             // B
  "cliente",            // C
  "telefono",           // D
  "direccion",          // E
  "tipo",               // F  bajantes | instalaciones | averias | mantenimientos | otros
  "importe",            // G  (legacy, alias de total_eur)
  "fase",               // H  INICIO_OBRA | EN_EJECUCION | FINALIZADA | FACTURADA | COBRADA
  "fecha_inicio",       // I
  "fecha_fin_estimada", // J
  "fecha_fin_real",     // K
  "fecha_facturada",    // L
  "fecha_cobrada",      // M
  "holded_invoice_id",  // N  (legacy: id único — sigue funcionando)
  "notas",              // O
  "created_at",         // P
  "created_by",         // Q
  "updated_at",         // R
  "updated_by",         // S
  "borrado",            // T
  // v0.2.0:
  "subtotal_eur",       // U
  "iva_eur",            // V
  "total_eur",          // W  (canónico)
  "tags_holded",        // X  (JSON array)
  "facturada",          // Y  TRUE/FALSE
  "cobrada",            // Z  TRUE/FALSE
];

const HIST_HEADERS = [
  "id",
  "obra_id",
  "accion",         // creada | editada | fase_cambiada | borrada
  "snapshot_json",
  "cambios_json",
  "fecha",
  "usuario",
];

const FASES_VALIDAS = [
  "INICIO_OBRA",
  "EN_EJECUCION",
  "FINALIZADA",
  "FACTURADA",
  "COBRADA",
];

const TIPOS_VALIDOS = [
  "bajantes",
  "instalaciones",
  "averias",
  "mantenimientos",
  "otros",
];

// Fases consideradas "activas" (visibles en drawer/registros)
const FASES_ACTIVAS = ["INICIO_OBRA", "EN_EJECUCION"];

// ============================================================
// Cliente Google Sheets (lazy)
// ============================================================
let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth: oauth2 });
  return _sheetsClient;
}

// ============================================================
// Helpers
// ============================================================
function nowIso() {
  return new Date().toISOString();
}

function colLetterFromIdx(idx) {
  let s = "";
  let n = idx;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) return s;
  }
}

function objetoAFila(obj, headers) {
  return headers.map((h) => {
    const v = obj[h];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

function filaAObjeto(fila, headers) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = fila[i] !== undefined ? fila[i] : "";
  }
  return obj;
}

// Normaliza tags_holded a JSON array string para guardar
function normalizarTags(input) {
  if (!input) return "[]";
  if (Array.isArray(input)) {
    return JSON.stringify(input.map(t => String(t).trim()).filter(Boolean));
  }
  if (typeof input === "string") {
    // Si ya es JSON array válido, parsearlo y re-serializar (limpieza)
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          return JSON.stringify(arr.map(t => String(t).trim()).filter(Boolean));
        }
      } catch (e) { /* fallthrough */ }
    }
    // Split por comas, pipes o punto-y-coma
    const arr = trimmed.split(/[|,;]/).map(t => t.trim()).filter(Boolean);
    return JSON.stringify(arr);
  }
  return "[]";
}

// Parsea tags_holded de la celda Sheets a array
function parsearTags(celda) {
  if (!celda) return [];
  if (Array.isArray(celda)) return celda;
  const s = String(celda).trim();
  if (!s) return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(t => String(t)).filter(Boolean);
    } catch (e) { /* fallthrough */ }
  }
  return s.split(/[|,;]/).map(t => t.trim()).filter(Boolean);
}

// Normaliza bool a TRUE/FALSE string
function boolStr(v) {
  if (v === true || v === "TRUE" || v === "true" || v === 1 || v === "1") return "TRUE";
  return "FALSE";
}

// Parsea bool desde celda
function parsearBool(celda) {
  if (celda === true) return true;
  if (typeof celda === "string") {
    const u = celda.toUpperCase().trim();
    return u === "TRUE" || u === "1" || u === "SI" || u === "SÍ";
  }
  if (typeof celda === "number") return celda !== 0;
  return false;
}

async function genObraId() {
  // OO-YYYY-NNN secuencial dentro del año
  const sheets = getSheetsClient();
  const year = new Date().getFullYear();
  const prefix = `OO-${year}-`;
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_OBRAS}!A:A`,
    });
    const vals = r.data.values || [];
    let max = 0;
    for (const row of vals) {
      const id = row[0];
      if (id && id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  } catch (e) {
    return `${prefix}001`;
  }
}

async function genHistId() {
  return `OH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Asegurar pestañas (idempotente) + AMPLIAR cabeceras si faltan
// ============================================================
let _pestanasOk = false;

async function asegurarPestanas() {
  if (_pestanasOk) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existentes = (meta.data.sheets || []).map((s) => s.properties.title);

  const requests = [];
  if (!existentes.includes(TAB_OBRAS)) {
    requests.push({
      addSheet: { properties: { title: TAB_OBRAS } },
    });
  }
  if (!existentes.includes(TAB_HISTORIAL)) {
    requests.push({
      addSheet: { properties: { title: TAB_HISTORIAL } },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
  }

  // Asegurar cabeceras (escribir si la primera fila está vacía o incompleta)
  const lastColObras = colLetterFromIdx(OB_HEADERS.length - 1);
  const lastColHist = colLetterFromIdx(HIST_HEADERS.length - 1);

  const [obrasHead, histHead] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_OBRAS}!A1:${lastColObras}1`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_HISTORIAL}!A1:${lastColHist}1`,
    }),
  ]);

  const obrasHeadFila = (obrasHead.data.values && obrasHead.data.values[0]) || [];

  // Si la fila de cabeceras no tiene todas las columnas v0.2.0,
  // re-escribirla. NO toca las filas de datos.
  if (obrasHeadFila.length < OB_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_OBRAS}!A1:${lastColObras}1`,
      valueInputOption: "RAW",
      requestBody: { values: [OB_HEADERS] },
    });
    console.log(`[obras-otras] Cabeceras ampliadas a v0.2.0 (${OB_HEADERS.length} columnas)`);
  }

  if (!histHead.data.values || histHead.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_HISTORIAL}!A1:${lastColHist}1`,
      valueInputOption: "RAW",
      requestBody: { values: [HIST_HEADERS] },
    });
  }

  _pestanasOk = true;
}

// ============================================================
// Lectura de obras
// ============================================================
async function leerObras() {
  await asegurarPestanas();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_OBRAS}!A2:${lastCol}`,
  });
  const filas = r.data.values || [];
  return filas.map((fila, i) => {
    const obj = filaAObjeto(fila, OB_HEADERS);
    obj._rowIndex = i + 2; // fila absoluta en el sheet

    // Enriquecer para consumo del frontend
    // total_eur prevalece, con fallback a importe legacy
    const totalNum = parseFloat(obj.total_eur) || parseFloat(obj.importe) || 0;
    const subtotalNum = parseFloat(obj.subtotal_eur) || 0;
    const ivaNum = parseFloat(obj.iva_eur) || 0;

    obj.total_eur = totalNum > 0 ? totalNum.toFixed(2) : "";
    obj.subtotal_eur = subtotalNum > 0 ? subtotalNum.toFixed(2) : "";
    obj.iva_eur = ivaNum > 0 ? ivaNum.toFixed(2) : "";
    obj.tags_holded_array = parsearTags(obj.tags_holded);
    obj.facturada_bool = parsearBool(obj.facturada);
    obj.cobrada_bool = parsearBool(obj.cobrada);

    // 'importe' legacy: si el frontend antiguo lo lee, devolver total
    obj.importe = obj.total_eur || obj.importe;

    return obj;
  }).filter(o => o.obra_id && o.borrado !== "TRUE");
}

async function obraPorId(id) {
  const todas = await leerObras();
  return todas.find(o => o.obra_id === id) || null;
}

// ============================================================
// Append a historial (append-only, no bloqueante)
// ============================================================
async function tryHistorial(accion, snapshot, cambios, usuario) {
  try {
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(HIST_HEADERS.length - 1);
    const fila = {
      id: await genHistId(),
      obra_id: snapshot?.obra_id || "",
      accion,
      snapshot_json: snapshot ? JSON.stringify(snapshot) : "",
      cambios_json: cambios ? JSON.stringify(cambios) : "",
      fecha: nowIso(),
      usuario: usuario || "sistema",
    };
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB_HISTORIAL}!A:${lastCol}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [objetoAFila(fila, HIST_HEADERS)] },
    });
  } catch (e) {
    console.error("[obras-otras historial]", e.message);
  }
}

// ============================================================
// Validadores
// ============================================================
function validarCrear(body) {
  const errs = [];
  if (!body.nombre || !body.nombre.trim()) errs.push("Falta 'nombre'");
  if (body.tipo && !TIPOS_VALIDOS.includes(body.tipo)) {
    errs.push(`tipo inválido (válidos: ${TIPOS_VALIDOS.join(", ")})`);
  }
  if (body.fase && !FASES_VALIDAS.includes(body.fase)) {
    errs.push(`fase inválida (válidas: ${FASES_VALIDAS.join(", ")})`);
  }
  const numericos = ["importe", "subtotal_eur", "iva_eur", "total_eur"];
  for (const k of numericos) {
    if (body[k] !== undefined && body[k] !== "" && body[k] !== null && isNaN(parseFloat(body[k]))) {
      errs.push(`${k} debe ser número`);
    }
  }
  return errs;
}

// ============================================================
// API pública (consumida por otros módulos)
// ============================================================
async function getObrasOtrasActivas() {
  const todas = await leerObras();
  return todas
    .filter(o => FASES_ACTIVAS.includes(o.fase))
    .map(o => ({
      obra_id: o.obra_id,
      nombre: o.nombre,
      tipo: o.tipo,
      fase: o.fase,
      importe: parseFloat(o.total_eur || o.importe) || 0,
      source: "otras",  // distinguir de Plan 5
    }));
}

// ============================================================
// REGISTRO DE ENDPOINTS
// ============================================================
function registrar(app) {
  const bodyParser = require("body-parser");
  const jsonBodyParser = bodyParser.json({ limit: "1mb" });

  // CORS helper
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Cargar lazy el módulo de holded para el endpoint /economico
  // (evita ciclos de require si holded importa esto algún día)
  let _holdedMod = null;
  function getHoldedMod() {
    if (!_holdedMod) {
      try {
        _holdedMod = require("./ara-os-holded.cjs");
      } catch (e) {
        console.error("[obras-otras] No se pudo cargar ara-os-holded:", e.message);
      }
    }
    return _holdedMod;
  }

  // ---------- 1. GET /obras-otras/ping ----------
  app.options("/api/ara-os/obras-otras/ping", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras/ping", async (req, res) => {
    responderCORS(res);
    try {
      await asegurarPestanas();
      const obras = await leerObras();
      const porFase = {};
      const porTipo = {};
      for (const o of obras) {
        porFase[o.fase] = (porFase[o.fase] || 0) + 1;
        porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1;
      }
      res.json({
        ok: true,
        modulo: "ara-os-obras-otras",
        version: "v0.2.0",
        ts: nowIso(),
        sheets: {
          obras_otras: {
            filas: obras.length,
            por_fase: porFase,
            por_tipo: porTipo,
          },
        },
        fases_validas: FASES_VALIDAS,
        tipos_validos: TIPOS_VALIDOS,
        fases_activas: FASES_ACTIVAS,
      });
    } catch (e) {
      console.error("[GET /obras-otras/ping]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 2. GET /obras-otras/tipos ----------
  app.options("/api/ara-os/obras-otras/tipos", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras/tipos", async (req, res) => {
    responderCORS(res);
    res.json({
      ok: true,
      tipos: TIPOS_VALIDOS.map(t => ({
        tipo: t,
        etiqueta: {
          bajantes: "Bajantes",
          instalaciones: "Instalaciones",
          averias: "Averías",
          mantenimientos: "Mantenimientos",
          otros: "Otros",
        }[t],
      })),
    });
  });

  // ---------- 3. GET /obras-otras/fases ----------
  app.options("/api/ara-os/obras-otras/fases", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras/fases", async (req, res) => {
    responderCORS(res);
    res.json({
      ok: true,
      fases: FASES_VALIDAS.map(f => ({
        fase: f,
        etiqueta: {
          INICIO_OBRA: "Inicio de obra",
          EN_EJECUCION: "En ejecución",
          FINALIZADA: "Finalizada",
          FACTURADA: "Facturada",
          COBRADA: "Cobrada",
        }[f],
        orden: FASES_VALIDAS.indexOf(f),
        color: {
          INICIO_OBRA: "#dbeafe",
          EN_EJECUCION: "#fef3c7",
          FINALIZADA: "#fed7aa",
          FACTURADA: "#bfdbfe",
          COBRADA: "#dcfce7",
        }[f],
      })),
    });
  });

  // ---------- 4. GET /obras-otras (lista con filtros) ----------
  app.options("/api/ara-os/obras-otras", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras", async (req, res) => {
    responderCORS(res);
    try {
      const { fase, tipo, activas } = req.query;
      let obras = await leerObras();

      if (fase) obras = obras.filter(o => o.fase === fase);
      if (tipo) obras = obras.filter(o => o.tipo === tipo);
      if (activas === "true") obras = obras.filter(o => FASES_ACTIVAS.includes(o.fase));

      // Agrupar por fase para retornar tipo kanban
      const grupos = {};
      for (const f of FASES_VALIDAS) grupos[f] = [];
      for (const o of obras) {
        if (grupos[o.fase]) grupos[o.fase].push(o);
      }

      const importeTotal = obras.reduce((s, o) => s + (parseFloat(o.total_eur || o.importe) || 0), 0);

      res.json({
        ok: true,
        total: obras.length,
        importe_total: importeTotal,
        grupos,
        obras,  // por si se prefiere lista plana
        generated_at: nowIso(),
      });
    } catch (e) {
      console.error("[GET /obras-otras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 5. GET /obras-otras/:id ----------
  app.options("/api/ara-os/obras-otras/:id", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras/:id", async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      res.json({ ok: true, obra });
    } catch (e) {
      console.error("[GET /obras-otras/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 5b. GET /obras-otras/:id/economico ----------
  // Cruza tags_holded con compras Holded → coste real, margen, lista facturas
  app.options("/api/ara-os/obras-otras/:id/economico", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/obras-otras/:id/economico", async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });

      const tagsObra = parsearTags(obra.tags_holded);
      const totalPresup = parseFloat(obra.total_eur || obra.importe) || 0;
      const subtotalPresup = parseFloat(obra.subtotal_eur) || 0;
      const ivaPresup = parseFloat(obra.iva_eur) || 0;

      if (tagsObra.length === 0) {
        // Sin tags → no podemos cruzar
        return res.json({
          ok: true,
          obra_id: obra.obra_id,
          tags_configurados: [],
          aviso: "Esta orden no tiene tags Holded configurados. Edítala y añade al menos un tag para cruzar gastos.",
          presupuestado: {
            subtotal: subtotalPresup,
            iva: ivaPresup,
            total: totalPresup,
          },
          coste_real: 0,
          margen_eur: totalPresup,
          margen_pct: totalPresup > 0 ? 100 : 0,
          num_facturas: 0,
          facturas: [],
          pagado_eur: 0,
          pendiente_eur: 0,
        });
      }

      const mod = getHoldedMod();
      if (!mod || !mod.obtenerPurchases) {
        return res.status(500).json({
          ok: false,
          error: "Módulo Holded no disponible",
        });
      }

      const r = await mod.obtenerPurchases();
      if (r.error) {
        return res.status(502).json({
          ok: false,
          error: `Holded: ${r.error}`,
          tags_configurados: tagsObra,
        });
      }

      const tagsSet = new Set(tagsObra);
      const facturas = (r.docs || []).filter(d => {
        const tags = Array.isArray(d.tags) ? d.tags : [];
        return tags.some(t => tagsSet.has(t));
      });

      // Ordenar de más reciente a más antigua
      facturas.sort((a, b) => {
        const fa = a.fecha || "";
        const fb = b.fecha || "";
        return fb.localeCompare(fa);
      });

      const costeReal = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);
      const costeRealSubtotal = facturas.reduce((s, f) => s + (Number(f.subtotal) || 0), 0);
      const costeRealIva = facturas.reduce((s, f) => s + (Number(f.iva) || 0), 0);
      const pagadoEur = facturas.reduce((s, f) => s + (Number(f.pagado_eur) || 0), 0);
      const pendienteEur = facturas.reduce((s, f) => s + (Number(f.pendiente_eur) || 0), 0);

      const margenEur = totalPresup - costeReal;
      const margenPct = totalPresup > 0 ? (margenEur / totalPresup) * 100 : 0;

      // Desglose por proveedor (top 10)
      const porProveedor = {};
      for (const f of facturas) {
        const p = f.proveedor || "(sin proveedor)";
        if (!porProveedor[p]) porProveedor[p] = { proveedor: p, num: 0, total: 0 };
        porProveedor[p].num += 1;
        porProveedor[p].total += Number(f.total) || 0;
      }
      const desglose_proveedores = Object.values(porProveedor)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      res.json({
        ok: true,
        obra_id: obra.obra_id,
        tags_configurados: tagsObra,
        presupuestado: {
          subtotal: subtotalPresup,
          iva: ivaPresup,
          total: totalPresup,
        },
        coste_real: costeReal,
        coste_real_subtotal: costeRealSubtotal,
        coste_real_iva: costeRealIva,
        margen_eur: margenEur,
        margen_pct: margenPct,
        num_facturas: facturas.length,
        facturas,
        pagado_eur: pagadoEur,
        pendiente_eur: pendienteEur,
        desglose_proveedores,
        cached: !!r.cached,
        edad_ms: r.edad_ms || 0,
        generated_at: nowIso(),
      });
    } catch (e) {
      console.error("[GET /obras-otras/:id/economico]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 6. POST /obras-otras (crear) ----------
  app.post("/api/ara-os/obras-otras", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const body = req.body || {};
      const errs = validarCrear(body);
      if (errs.length > 0) {
        return res.status(400).json({ ok: false, error: errs.join("; ") });
      }

      // Calcular total/subtotal/iva con tolerancia
      let total = body.total_eur !== undefined && body.total_eur !== ""
        ? parseFloat(body.total_eur)
        : (body.importe !== undefined && body.importe !== "" ? parseFloat(body.importe) : NaN);
      let subtotal = body.subtotal_eur !== undefined && body.subtotal_eur !== ""
        ? parseFloat(body.subtotal_eur) : NaN;
      let iva = body.iva_eur !== undefined && body.iva_eur !== ""
        ? parseFloat(body.iva_eur) : NaN;

      // Si tenemos subtotal + iva pero NO total → derivar
      if (isNaN(total) && !isNaN(subtotal) && !isNaN(iva)) {
        total = subtotal + iva;
      }
      // Si tenemos total + subtotal pero NO iva → derivar
      if (isNaN(iva) && !isNaN(total) && !isNaN(subtotal)) {
        iva = total - subtotal;
      }
      // Si tenemos total + iva pero NO subtotal → derivar
      if (isNaN(subtotal) && !isNaN(total) && !isNaN(iva)) {
        subtotal = total - iva;
      }

      const totalStr = !isNaN(total) ? total.toFixed(2) : "";
      const subtotalStr = !isNaN(subtotal) ? subtotal.toFixed(2) : "";
      const ivaStr = !isNaN(iva) ? iva.toFixed(2) : "";

      const obra = {
        obra_id: await genObraId(),
        nombre: (body.nombre || "").trim(),
        cliente: (body.cliente || "").trim(),
        telefono: (body.telefono || "").trim(),
        direccion: (body.direccion || "").trim(),
        tipo: body.tipo || "otros",
        importe: totalStr,  // legacy = total
        fase: body.fase || "INICIO_OBRA",
        fecha_inicio: body.fecha_inicio || "",
        fecha_fin_estimada: body.fecha_fin_estimada || "",
        fecha_fin_real: "",
        fecha_facturada: "",
        fecha_cobrada: "",
        holded_invoice_id: body.holded_invoice_id || "",
        notas: (body.notas || "").trim().slice(0, 1000),
        created_at: nowIso(),
        created_by: body.usuario || "ARA OS",
        updated_at: nowIso(),
        updated_by: body.usuario || "ARA OS",
        borrado: "FALSE",
        // v0.2.0
        subtotal_eur: subtotalStr,
        iva_eur: ivaStr,
        total_eur: totalStr,
        tags_holded: normalizarTags(body.tags_holded),
        facturada: boolStr(body.facturada),
        cobrada: boolStr(body.cobrada),
      };

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${TAB_OBRAS}!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [objetoAFila(obra, OB_HEADERS)] },
      });

      tryHistorial("creada", obra, null, obra.created_by);
      res.json({ ok: true, obra });
    } catch (e) {
      console.error("[POST /obras-otras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 7. PATCH /obras-otras/:id (editar / avanzar fase) ----------
  app.patch("/api/ara-os/obras-otras/:id", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });

      const body = req.body || {};
      const cambios = {};
      const previa = { ...obra };

      // Campos editables (incluye los nuevos v0.2.0)
      const editables = [
        "nombre", "cliente", "telefono", "direccion", "tipo",
        "importe", "fase", "fecha_inicio", "fecha_fin_estimada",
        "fecha_fin_real", "fecha_facturada", "fecha_cobrada",
        "holded_invoice_id", "notas",
        // v0.2.0
        "subtotal_eur", "iva_eur", "total_eur",
        "tags_holded", "facturada", "cobrada",
      ];

      const numericos = new Set(["importe", "subtotal_eur", "iva_eur", "total_eur"]);
      const booleanos = new Set(["facturada", "cobrada"]);

      for (const k of editables) {
        if (body[k] === undefined) continue;

        let nuevoVal;
        if (k === "tags_holded") {
          nuevoVal = normalizarTags(body[k]);
        } else if (booleanos.has(k)) {
          nuevoVal = boolStr(body[k]);
        } else if (numericos.has(k)) {
          if (body[k] === "" || body[k] === null) {
            nuevoVal = "";
          } else if (isNaN(parseFloat(body[k]))) {
            return res.status(400).json({ ok: false, error: `${k} debe ser número` });
          } else {
            nuevoVal = parseFloat(body[k]).toFixed(2);
          }
        } else {
          if (k === "tipo" && body[k] && !TIPOS_VALIDOS.includes(body[k])) {
            return res.status(400).json({ ok: false, error: `tipo inválido` });
          }
          if (k === "fase" && body[k] && !FASES_VALIDAS.includes(body[k])) {
            return res.status(400).json({ ok: false, error: `fase inválida` });
          }
          nuevoVal = body[k];
        }

        if (nuevoVal !== obra[k]) {
          obra[k] = nuevoVal;
          cambios[k] = { antes: previa[k], despues: obra[k] };
        }
      }

      // Si cambia total_eur, también cambiar 'importe' legacy
      if (cambios.total_eur !== undefined && body.importe === undefined) {
        obra.importe = obra.total_eur;
        cambios.importe = { antes: previa.importe, despues: obra.importe };
      }
      // Si cambia 'importe' legacy y NO se tocó total_eur, sincronizar
      if (cambios.importe !== undefined && body.total_eur === undefined) {
        obra.total_eur = obra.importe;
        cambios.total_eur = { antes: previa.total_eur, despues: obra.total_eur };
      }

      // Si facturada=TRUE y no había fecha_facturada → setearla
      if (cambios.facturada && obra.facturada === "TRUE" && !obra.fecha_facturada) {
        obra.fecha_facturada = nowIso().slice(0, 10);
        cambios.fecha_facturada = { antes: "", despues: obra.fecha_facturada };
      }
      // Si cobrada=TRUE y no había fecha_cobrada → setearla
      if (cambios.cobrada && obra.cobrada === "TRUE" && !obra.fecha_cobrada) {
        obra.fecha_cobrada = nowIso().slice(0, 10);
        cambios.fecha_cobrada = { antes: "", despues: obra.fecha_cobrada };
      }

      // Auto-rellenar fechas según fase si no estaban
      if (cambios.fase) {
        if (obra.fase === "FINALIZADA" && !obra.fecha_fin_real) {
          obra.fecha_fin_real = nowIso().slice(0, 10);
          cambios.fecha_fin_real = { antes: "", despues: obra.fecha_fin_real };
        }
        if (obra.fase === "FACTURADA" && !obra.fecha_facturada) {
          obra.fecha_facturada = nowIso().slice(0, 10);
          cambios.fecha_facturada = { antes: "", despues: obra.fecha_facturada };
        }
        if (obra.fase === "COBRADA" && !obra.fecha_cobrada) {
          obra.fecha_cobrada = nowIso().slice(0, 10);
          cambios.fecha_cobrada = { antes: "", despues: obra.fecha_cobrada };
        }
        // También: marcar facturada/cobrada automáticamente al avanzar fase
        if ((obra.fase === "FACTURADA" || obra.fase === "COBRADA") && obra.facturada !== "TRUE") {
          obra.facturada = "TRUE";
          cambios.facturada = { antes: previa.facturada, despues: "TRUE" };
        }
        if (obra.fase === "COBRADA" && obra.cobrada !== "TRUE") {
          obra.cobrada = "TRUE";
          cambios.cobrada = { antes: previa.cobrada, despues: "TRUE" };
        }
      }

      if (Object.keys(cambios).length === 0) {
        return res.json({ ok: true, obra, sin_cambios: true });
      }

      obra.updated_at = nowIso();
      obra.updated_by = body.usuario || "ARA OS";

      // Limpiar campos derivados antes de escribir
      delete obra._rowIndex;
      delete obra.tags_holded_array;
      delete obra.facturada_bool;
      delete obra.cobrada_bool;
      const rowIdx = previa._rowIndex;

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${TAB_OBRAS}!A${rowIdx}:${lastCol}${rowIdx}`,
        valueInputOption: "RAW",
        requestBody: { values: [objetoAFila(obra, OB_HEADERS)] },
      });

      const accion = cambios.fase ? "fase_cambiada" : "editada";
      tryHistorial(accion, obra, cambios, obra.updated_by);

      res.json({ ok: true, obra, cambios });
    } catch (e) {
      console.error("[PATCH /obras-otras/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 8. DELETE /obras-otras/:id (soft delete) ----------
  app.delete("/api/ara-os/obras-otras/:id", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });

      const rowIdx = obra._rowIndex;
      obra.borrado = "TRUE";
      obra.updated_at = nowIso();
      obra.updated_by = (req.body && req.body.usuario) || "ARA OS";

      // Limpiar campos derivados antes de escribir
      delete obra._rowIndex;
      delete obra.tags_holded_array;
      delete obra.facturada_bool;
      delete obra.cobrada_bool;

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${TAB_OBRAS}!A${rowIdx}:${lastCol}${rowIdx}`,
        valueInputOption: "RAW",
        requestBody: { values: [objetoAFila(obra, OB_HEADERS)] },
      });

      tryHistorial("borrada", obra, null, obra.updated_by);
      res.json({ ok: true, obra_id: obra.obra_id });
    } catch (e) {
      console.error("[DELETE /obras-otras/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-obras-otras v0.2.0] Módulo cargado. 9 endpoints: ping + CRUD + tipos + fases + economico");
}

module.exports = registrar;
module.exports.getObrasOtrasActivas = getObrasOtrasActivas;
