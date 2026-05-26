// ============================================================
// ARA OS · Actividad del sistema · v0.1.0 · 2026-05-26
//
// Registra eventos atómicos del sistema en el sheet
// `actividad_sistema` para que /alberto pueda mostrar "qué ha
// hecho JM cada día" con trazabilidad real (no solo Cuaderno).
//
// El helper `logActividad()` es FIRE-AND-FORGET: nunca lanza
// excepción, nunca bloquea la respuesta del endpoint que lo
// invoca. Si Google Sheets cae, se pierde el evento pero el
// flujo normal sigue funcionando.
//
// Tipos de evento que se loggean (a 26/05/2026):
//   - cert_generados          (/fase14/generar-certificados)
//   - factura_emitida         (/fase14/marcar-emitida)
//   - factura_firmada         (/fase14/marcar-firmada)
//   - factura_firmada_pdf     (/fase14/subir-pdf-firmado)
//   - rt_subido               (/fase14/subir-relacion-emasesa)
//   - rotulo_subido           (/fase14/subir-rotulo-bateria)
//   - rotulo_corregido        (/fase14/guardar-rotulo-celdas)
//   - toma_revisada           (/fase14/marcar-toma-revisada)
//
// Para añadir un evento nuevo basta con llamar al helper desde
// donde sea. No requiere cambios aquí.
// ============================================================

const { google } = require("googleapis");

const SHEET_NAME = "actividad_sistema";
const COLS = [
  "evento_id",
  "creado_en",
  "actor",
  "tipo",
  "comunidad",
  "ccpp_id",
  "detalle",
  "payload_json",
];

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: "v4", auth });
}

let _sheetReady = null;
async function ensureSheet() {
  if (_sheetReady) return _sheetReady;
  _sheetReady = (async () => {
    const sheets = getSheetsClient();
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${SHEET_NAME}!A1:A1`,
      });
      return true;
    } catch (e) {
      // Crear la hoja con headers
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${SHEET_NAME}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [COLS] },
        });
      } catch (e2) {
        // Si falla la creación (carrera, permisos…), no tira al sistema
        _sheetReady = null;
        throw e2;
      }
      return true;
    }
  })();
  return _sheetReady;
}

// ============================================================
// logActividad · helper público que invocan otros módulos
// ============================================================
async function logActividad({
  actor = "sistema",
  tipo,
  comunidad = "",
  ccpp_id = "",
  detalle = "",
  payload = null,
} = {}) {
  if (!tipo) return; // sin tipo, no log
  try {
    await ensureSheet();
    const sheets = getSheetsClient();
    const row = {
      evento_id: uuidv4(),
      creado_en: new Date().toISOString(),
      actor: String(actor || "sistema").trim() || "sistema",
      tipo: String(tipo).trim(),
      comunidad: String(comunidad || "").trim(),
      ccpp_id: String(ccpp_id || "").trim(),
      detalle: String(detalle || "").trim(),
      payload_json: payload ? JSON.stringify(payload) : "",
    };
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: "RAW",
      requestBody: { values: [COLS.map(c => row[c] || "")] },
    });
  } catch (e) {
    // Fire-and-forget · solo log a consola, nunca bloquea
    console.warn("[actividad] log fallo:", e.message);
  }
}

// ============================================================
// mount(app) · expone GET /api/ara-os/actividad para el feed
// ============================================================
function mount(app) {
  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) {
    return validToken(req.query.token || req.body?.token);
  }
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  app.options("/api/ara-os/actividad", (req, res) => {
    responderCORS(res);
    res.status(204).end();
  });

  app.get("/api/ara-os/actividad", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { actor = "", desde = "", limite = "500" } = req.query;
      await ensureSheet();
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${SHEET_NAME}!A2:H`,
      });
      const rows = r.data.values || [];
      const eventos = [];
      for (const row of rows) {
        const o = {};
        COLS.forEach((c, i) => {
          o[c] = (row[i] || "").toString();
        });
        if (actor && o.actor !== actor) continue;
        if (desde && String(o.creado_en).slice(0, 10) < desde) continue;
        eventos.push(o);
      }
      eventos.sort((a, b) => (b.creado_en || "").localeCompare(a.creado_en || ""));
      res.json({
        ok: true,
        total: eventos.length,
        eventos: eventos.slice(0, parseInt(limite) || 500),
      });
    } catch (e) {
      console.error("[actividad GET]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log(
    `[actividad] v0.1.0 cargado · GET /api/ara-os/actividad · helper logActividad disponible`,
  );
}

module.exports = mount;
module.exports.logActividad = logActividad;
