// ============================================================
// ARA OS · Fase 14 · Edición manual del rótulo
// v0.1.0 · 2026-05-26 · Sprint "rotulo OCR fixable"
//
// El endpoint /subir-rotulo-bateria ya existente re-lanza la IA
// Vision en cada subida. Cuando JM ya tiene la foto buena pero el
// OCR se equivocó en 2-3 celdas (ej. lee "J.3" donde dice "2'3"),
// queremos poder corregir esas celdas manualmente SIN re-subir
// nada. Este módulo añade un solo endpoint para eso.
//
// POST /api/ara-os/fase14/guardar-rotulo-celdas
//   Body JSON: { ccpp_id, bateria_orden, celdas:[], num_filas, num_cols }
//   Hace UPDATE atómico de 3 columnas en emasesa_relacion_tomas:
//     rotulo_celdas_json · rotulo_num_filas · rotulo_num_cols
//   El resto de campos (tomas, url_foto_rotulo, etc.) intactos.
//
// Para activarlo, en index.cjs añadir UNA línea:
//   require("./ara-os-fase14-rotulo-edit.cjs")(app);
//
// El módulo es completamente independiente: tiene su propia auth a
// Sheets, resuelve ccpp_id por sí mismo y solo lee/escribe columnas
// concretas del sheet. Cero dependencias de ara-os-fase14-certificados.cjs.
// ============================================================

module.exports = function setupRotuloEdit(app) {
  const { validToken } = require("./lib/auth.cjs");
  const { google } = require("googleapis");
  const crypto = require("crypto");
  const express = require("express");
  const jsonBodyParser = express.json({ limit: "100kb" });

  function tokenValido(req) { return validToken(req.query.token); }
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  function getAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheets() { return google.sheets({ version: "v4", auth: getAuth() }); }

  function normOrden(orden) {
    const n = parseInt(orden, 10);
    return (n >= 1 && n <= 99) ? n : 1;
  }

  // ccppId() · misma fórmula que ara-os-fase14-certificados.cjs L215
  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // Misma lógica que resolverComunidadPorCcpp (L224) pero sin importar
  // la función. Lee comunidades!A:B (nombre + direccion).
  async function resolverComunidadPorCcpp(ccpp_id) {
    const sheets = getSheets();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "comunidades!A2:B",
    });
    const rows = r.data.values || [];
    for (const row of rows) {
      const nombre = row[0] || "";
      const direccion = row[1] || "";
      if (!nombre) continue;
      const clave = direccion || nombre;
      if (ccppId(clave) === ccpp_id) {
        return { comunidad: nombre, direccion };
      }
    }
    return null;
  }

  // Columnas en emasesa_relacion_tomas (índices según EMASESA_RT_HEADERS
  // en ara-os-fase14-certificados.cjs L1999).
  // A=comunidad B=bateria_orden ... N=rotulo_celdas_json O=rotulo_num_filas
  // P=rotulo_num_cols ... W=ultima_modificacion
  const COL_LETTER = {
    rotulo_celdas_json: "N",
    rotulo_num_filas:   "O",
    rotulo_num_cols:    "P",
    ultima_modificacion: "W",
  };

  app.options("/api/ara-os/fase14/guardar-rotulo-celdas", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/guardar-rotulo-celdas", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, bateria_orden, celdas, num_filas, num_cols } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!Array.isArray(celdas)) return res.status(400).json({ error: "'celdas' debe ser un array" });

      const filas = parseInt(num_filas, 10);
      const cols  = parseInt(num_cols, 10);
      if (!(filas >= 1 && filas <= 20)) return res.status(400).json({ error: "num_filas inválido (1-20)" });
      if (!(cols  >= 1 && cols  <= 20)) return res.status(400).json({ error: "num_cols inválido (1-20)" });
      if (celdas.length !== filas * cols) {
        return res.status(400).json({
          error: `celdas.length=${celdas.length} no coincide con ${filas}×${cols}=${filas*cols}`,
        });
      }

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada para ese ccpp_id" });
      const orden = normOrden(bateria_orden);

      // Localizar fila exacta en emasesa_relacion_tomas
      const sheets = getSheets();
      const lectura = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "emasesa_relacion_tomas!A2:B",
      });
      const rt = lectura.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rt.length; i++) {
        const f = rt[i];
        if (String(f[0] || "").trim() !== com.comunidad.trim()) continue;
        if (normOrden(f[1] || "1") !== orden) continue;
        rowIndex = i + 2;       // +2 por header + base-1
        break;
      }
      if (rowIndex < 0) {
        return res.status(404).json({
          error: `Sin fila en emasesa_relacion_tomas para "${com.comunidad}" batería ${orden}. Sube primero el PDF RT.`,
        });
      }

      // Normalizar celdas a strings trimmed
      const celdasLimpias = celdas.map(c => String(c == null ? "" : c).trim());
      const ahora = new Date().toISOString();

      // Update atómico de 4 cells (3 datos + timestamp) en una sola llamada
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `emasesa_relacion_tomas!${COL_LETTER.rotulo_celdas_json}${rowIndex}`,
              values: [[JSON.stringify(celdasLimpias)]] },
            { range: `emasesa_relacion_tomas!${COL_LETTER.rotulo_num_filas}${rowIndex}`,
              values: [[String(filas)]] },
            { range: `emasesa_relacion_tomas!${COL_LETTER.rotulo_num_cols}${rowIndex}`,
              values: [[String(cols)]] },
            { range: `emasesa_relacion_tomas!${COL_LETTER.ultima_modificacion}${rowIndex}`,
              values: [[ahora]] },
          ],
        },
      });

      console.log(`[rotulo-edit] ${com.comunidad} bat${orden}: ${celdasLimpias.length} celdas actualizadas (${filas}×${cols})`);
      res.json({
        ok: true,
        version: "0.1.0",
        comunidad: com.comunidad,
        bateria_orden: orden,
        celdas: celdasLimpias,
        num_filas: filas,
        num_cols: cols,
      });
    } catch (err) {
      console.error("[rotulo-edit]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[rotulo-edit] v0.1.0 cargado · POST /api/ara-os/fase14/guardar-rotulo-celdas");
};
