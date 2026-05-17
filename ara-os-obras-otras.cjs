// ============================================================
// ARA OS — Obras Otras (NO Plan 5) · v0.1.0 (17/05/2026)
// ============================================================
// Módulo independiente del flujo Plan 5. Maneja órdenes de
// trabajo simples: reformas, averías, instalaciones, etc.
// 5 fases lineales (vs las 9 del Plan 5).
//
// Comparte `registros_tiempo` con Plan 5 — la `obra_id` es
// solo otro string. El módulo de registros lee ambas
// hojas indirectamente (las obras "otras" salen como
// cualquier otra obra activa).
//
// v0.1.0 — Versión inicial:
//   - Auto-crea pestañas obras_otras + obras_otras_historial
//   - 5 fases hardcoded: INICIO_OBRA, EN_EJECUCION, FINALIZADA,
//     FACTURADA, COBRADA
//   - 4 tipos: bajantes, instalaciones, averias, otros
//   - 8 endpoints CRUD con CORS
//   - Append-only en historial (igual patrón que registros-tiempo)
//   - API pública: getObrasOtrasActivas() para el drawer
// ============================================================

const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const TAB_OBRAS = "obras_otras";
const TAB_HISTORIAL = "obras_otras_historial";

// Cabeceras
const OB_HEADERS = [
  "obra_id",            // A
  "nombre",             // B
  "cliente",            // C
  "telefono",           // D
  "direccion",          // E
  "tipo",               // F  bajantes | instalaciones | averias | otros
  "importe",            // G
  "fase",               // H  INICIO_OBRA | EN_EJECUCION | FINALIZADA | FACTURADA | COBRADA
  "fecha_inicio",       // I
  "fecha_fin_estimada", // J
  "fecha_fin_real",     // K
  "fecha_facturada",    // L
  "fecha_cobrada",      // M
  "holded_invoice_id",  // N
  "notas",              // O
  "created_at",         // P
  "created_by",         // Q
  "updated_at",         // R
  "updated_by",         // S
  "borrado",            // T
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
// Asegurar pestañas (idempotente)
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

  // Asegurar cabeceras (escribir si la primera fila está vacía)
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

  if (!obrasHead.data.values || obrasHead.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_OBRAS}!A1:${lastColObras}1`,
      valueInputOption: "RAW",
      requestBody: { values: [OB_HEADERS] },
    });
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
  if (body.importe !== undefined && body.importe !== "" && isNaN(parseFloat(body.importe))) {
    errs.push("importe debe ser número");
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
      importe: parseFloat(o.importe) || 0,
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
        version: "v0.1.0",
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
        etiqueta: { bajantes: "Bajantes", instalaciones: "Instalaciones", averias: "Averías", otros: "Otros" }[t],
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

      const importeTotal = obras.reduce((s, o) => s + (parseFloat(o.importe) || 0), 0);

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

  // ---------- 6. POST /obras-otras (crear) ----------
  app.post("/api/ara-os/obras-otras", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const body = req.body || {};
      const errs = validarCrear(body);
      if (errs.length > 0) {
        return res.status(400).json({ ok: false, error: errs.join("; ") });
      }

      const obra = {
        obra_id: await genObraId(),
        nombre: (body.nombre || "").trim(),
        cliente: (body.cliente || "").trim(),
        telefono: (body.telefono || "").trim(),
        direccion: (body.direccion || "").trim(),
        tipo: body.tipo || "otros",
        importe: body.importe ? parseFloat(body.importe).toFixed(2) : "",
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

      // Campos editables
      const editables = ["nombre", "cliente", "telefono", "direccion", "tipo",
                         "importe", "fase", "fecha_inicio", "fecha_fin_estimada",
                         "fecha_fin_real", "fecha_facturada", "fecha_cobrada",
                         "holded_invoice_id", "notas"];

      for (const k of editables) {
        if (body[k] !== undefined && body[k] !== obra[k]) {
          // Validar tipo y fase
          if (k === "tipo" && !TIPOS_VALIDOS.includes(body[k])) {
            return res.status(400).json({ ok: false, error: `tipo inválido` });
          }
          if (k === "fase" && !FASES_VALIDAS.includes(body[k])) {
            return res.status(400).json({ ok: false, error: `fase inválida` });
          }
          obra[k] = k === "importe" && body[k] !== ""
            ? parseFloat(body[k]).toFixed(2)
            : body[k];
          cambios[k] = { antes: previa[k], despues: obra[k] };
        }
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
      }

      if (Object.keys(cambios).length === 0) {
        return res.json({ ok: true, obra, sin_cambios: true });
      }

      obra.updated_at = nowIso();
      obra.updated_by = body.usuario || "ARA OS";

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${TAB_OBRAS}!A${obra._rowIndex}:${lastCol}${obra._rowIndex}`,
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

      obra.borrado = "TRUE";
      obra.updated_at = nowIso();
      obra.updated_by = (req.body && req.body.usuario) || "ARA OS";

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(OB_HEADERS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${TAB_OBRAS}!A${obra._rowIndex}:${lastCol}${obra._rowIndex}`,
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

  console.log("[ara-os-obras-otras v0.1.0] Módulo cargado. 8 endpoints: ping + CRUD + tipos + fases");
}

module.exports = registrar;
module.exports.getObrasOtrasActivas = getObrasOtrasActivas;
