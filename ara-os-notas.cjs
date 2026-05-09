// ============================================================
// ARA OS — Notas operativas (captura cruda)
// v0.1.0
//
// Añadir en index.cjs (junto a los otros require de ara-os):
//   require("./ara-os-notas.cjs")(app);
//
// POST /api/ara-os/nota?token=araujo2026
//   Body JSON:
//     {
//       "actor":     "José Manuel",   // requerido
//       "nota":      "texto libre",   // requerido
//       "comunidad": "C/ Bami 4"      // OPCIONAL — fricción cero
//     }
//   Crea la pestaña "notas_jm" si no existe (con cabeceras).
//   Hace append y devuelve la nota guardada con su timestamp.
//
// GET /api/ara-os/notas?token=araujo2026&actor=José+Manuel&desde=2026-05-09
//   Devuelve notas filtradas por actor (opcional) y fecha desde (opcional).
//   Las más recientes primero.
//
// --------------------------------------------------------------
// FILOSOFÍA
// --------------------------------------------------------------
// Esta es la pieza más simple posible para externalizar la
// memoria operativa de JM. SIN tipos, SIN estados, SIN owner,
// SIN workflows. Texto libre + comunidad opcional + timestamp.
//
// Durante 2-3 semanas se observa qué patrones aparecen en uso
// real. SOLO entonces se decide si tipificar, automatizar o
// inferir bloqueos a partir de notas.
//
// Decisiones de diseño:
//
//   1. Comunidad OPCIONAL. Si JM se acuerda de algo en el coche
//      y no sabe la comunidad exacta, escribe la nota igual.
//      Fricción cero gana sobre datos perfectos.
//
//   2. Pestaña SE AUTOCREA si no existe. JM no tiene que tocar
//      Sheets ni recordar crear nada. La primera nota crea la
//      tabla automáticamente.
//
//   3. Append-only. NO se editan ni borran notas desde aquí.
//      Si hay que corregir, se hace a mano en Sheets.
//      (En v0.1.0; cuando aparezca el patrón "borrar nota" lo
//      añadimos. No antes.)
//
//   4. Sin paginación. El GET devuelve todas. 207 comunidades
//      x N notas/semana es manejable durante meses. Cuando
//      empiece a doler, paginamos.
// ============================================================

module.exports = function setupAraOSNotas(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";
  function tokenValido(req) { return req.query.token === ADMIN_TOKEN; }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Parser JSON local — el index.cjs no monta express.json() global
  const express = require("express");
  const jsonParser = express.json();

  const { google } = require("googleapis");
  function getSheetsClient() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.sheets({ version: "v4", auth });
  }

  const HOJA = "notas_jm";
  const COLS = ["fecha", "actor", "comunidad", "nota"];

  // ----------------------------------------------------------
  // Asegurar que la pestaña existe.
  // Estrategia:
  //   1. Intentar leer A1 de la pestaña.
  //   2. Si Google devuelve "Unable to parse range" → no existe.
  //      La creamos con batchUpdate y escribimos cabeceras.
  //   3. Si existe pero está vacía (sin cabeceras), las añadimos.
  // ----------------------------------------------------------
  async function asegurarPestana() {
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEETS_ID;

    try {
      // Intento de lectura: si la pestaña no existe, falla con error específico
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${HOJA}!A1:D1`,
      });
      const filas = res.data.values || [];
      // Existe pero sin cabeceras → escribirlas
      if (filas.length === 0 || (filas[0] || []).length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${HOJA}!A1:D1`,
          valueInputOption: "RAW",
          requestBody: { values: [COLS] },
        });
      }
      return;
    } catch (err) {
      // "Unable to parse range" típicamente significa pestaña inexistente
      const msg = (err.message || "").toLowerCase();
      const noExiste = msg.includes("unable to parse range") ||
                       msg.includes("not found");
      if (!noExiste) throw err;
    }

    // Crear pestaña nueva
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: HOJA } },
        }],
      },
    });

    // Escribir cabeceras
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${HOJA}!A1:D1`,
      valueInputOption: "RAW",
      requestBody: { values: [COLS] },
    });
  }

  function ahora() {
    // ISO recortado a minutos: "2026-05-09 17:42"
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }

  // ----------------------------------------------------------
  // POST · guardar nota
  // ----------------------------------------------------------
  app.options("/api/ara-os/nota", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.post("/api/ara-os/nota", jsonParser, async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });

    try {
      const body = req.body || {};
      const actor     = (body.actor     || "").trim();
      const nota      = (body.nota      || "").trim();
      const comunidad = (body.comunidad || "").trim(); // OPCIONAL

      if (!actor) return res.status(400).json({ error: "Falta campo: actor" });
      if (!nota)  return res.status(400).json({ error: "Falta campo: nota" });

      await asegurarPestana();

      const fecha = ahora();
      const fila  = [fecha, actor, comunidad, nota];

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA}!A:D`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({
        ok: true,
        nota: { fecha, actor, comunidad, nota },
        meta: {
          guardado_en: new Date().toISOString(),
          version: "0.1.0",
        },
      });

    } catch (err) {
      console.error("[ara-os-notas] Error POST:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------------
  // GET · leer notas
  // ----------------------------------------------------------
  app.options("/api/ara-os/notas", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.get("/api/ara-os/notas", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });

    try {
      const filtroActor = (req.query.actor || "").trim();
      const filtroDesde = (req.query.desde || "").trim(); // "2026-05-09"
      // limite: número máximo de notas a devolver (más recientes primero).
      // Si no viene o es inválido, devuelve todas.
      const limiteRaw = parseInt(req.query.limite, 10);
      const limite = (Number.isFinite(limiteRaw) && limiteRaw > 0) ? limiteRaw : null;

      const sheets = getSheetsClient();
      let rows;
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA}!A:D`,
        });
        rows = r.data.values || [];
      } catch (err) {
        // Pestaña no existe todavía → respuesta vacía
        const msg = (err.message || "").toLowerCase();
        if (msg.includes("unable to parse range") || msg.includes("not found")) {
          return res.json({
            notas: [],
            meta: { total: 0, version: "0.1.0", pestana_existe: false },
          });
        }
        throw err;
      }

      const notas = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const obj = {
          fecha:     (r[0] || "").trim(),
          actor:     (r[1] || "").trim(),
          comunidad: (r[2] || "").trim(),
          nota:      (r[3] || "").trim(),
        };
        if (filtroActor && obj.actor !== filtroActor) continue;
        // filtroDesde compara prefijo "YYYY-MM-DD" — el campo fecha es "YYYY-MM-DD HH:MM"
        if (filtroDesde && obj.fecha.slice(0, 10) < filtroDesde) continue;
        notas.push(obj);
      }

      // Más recientes primero (orden lexicográfico funciona porque el
      // formato es ISO "YYYY-MM-DD HH:MM").
      notas.sort((a, b) => b.fecha.localeCompare(a.fecha));

      const total = notas.length;
      const recortadas = limite ? notas.slice(0, limite) : notas;

      res.json({
        notas: recortadas,
        meta: {
          total,                       // total tras filtrar (sin recortar por limite)
          devueltas:    recortadas.length,
          filtro_actor: filtroActor || null,
          filtro_desde: filtroDesde || null,
          limite:       limite,
          generado:     new Date().toISOString(),
          version:      "0.2.0",
        },
      });

    } catch (err) {
      console.error("[ara-os-notas] Error GET:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-notas] v0.2.0 · POST /api/ara-os/nota · GET /api/ara-os/notas (?limite=N)");
};
