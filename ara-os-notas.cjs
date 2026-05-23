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

  const { validToken } = require("./lib/auth.cjs");
  function tokenValido(req) { return validToken(req.query.token); }
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
  const COLS = ["fecha", "actor", "comunidad", "nota", "hecho", "hecho_en"];
  // Posiciones (0-based) usadas en código:
  const COL_FECHA     = 0;
  const COL_ACTOR     = 1;
  const COL_COMUNIDAD = 2;
  const COL_NOTA      = 3;
  const COL_HECHO     = 4;
  const COL_HECHO_EN  = 5;
  const RANGO_FILA    = "A:F"; // 6 columnas

  // ----------------------------------------------------------
  // Asegurar que la pestaña existe Y tiene las 6 columnas.
  //
  // Migración silenciosa v0.3.0:
  //   - Si la pestaña tiene 4 columnas (versión vieja), añadimos
  //     las 2 cabeceras nuevas (hecho, hecho_en) sin perder datos.
  //   - Si tiene >=6 columnas, no tocamos nada.
  //   - Si no existe, la creamos directamente con las 6.
  // ----------------------------------------------------------
  async function asegurarPestana() {
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEETS_ID;

    try {
      // Leemos la primera fila para diagnosticar el estado
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${HOJA}!A1:Z1`,
      });
      const filas = res.data.values || [];
      const cabeceraActual = (filas[0] || []).map(c => (c || "").toString().trim());

      // Caso 1: pestaña existe pero sin cabeceras → escribir las 6
      if (cabeceraActual.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${HOJA}!A1:F1`,
          valueInputOption: "RAW",
          requestBody: { values: [COLS] },
        });
        return;
      }

      // Caso 2: pestaña con cabeceras pero le faltan columnas
      // (versión 0.1.0 tenía 4: fecha, actor, comunidad, nota).
      // Detectamos por longitud y por ausencia de "hecho".
      const tieneHecho = cabeceraActual.some(
        h => h.toLowerCase() === "hecho"
      );
      if (!tieneHecho) {
        // Añadimos las cabeceras que falten en sus posiciones correctas
        // (E1 = "hecho", F1 = "hecho_en"). No tocamos las existentes.
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${HOJA}!E1:F1`,
          valueInputOption: "RAW",
          requestBody: { values: [["hecho", "hecho_en"]] },
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

    // Escribir cabeceras (6 columnas)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${HOJA}!A1:F1`,
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
      // Fila completa con las 6 columnas. hecho y hecho_en vacíos.
      const fila  = [fecha, actor, comunidad, nota, "", ""];

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA}!${RANGO_FILA}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({
        ok: true,
        nota: { fecha, actor, comunidad, nota, hecho: "", hecho_en: "" },
        meta: {
          guardado_en: new Date().toISOString(),
          version: "0.3.0",
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
          range: `${HOJA}!${RANGO_FILA}`,
        });
        rows = r.data.values || [];
      } catch (err) {
        // Pestaña no existe todavía → respuesta vacía
        const msg = (err.message || "").toLowerCase();
        if (msg.includes("unable to parse range") || msg.includes("not found")) {
          return res.json({
            notas: [],
            meta: { total: 0, version: "0.3.0", pestana_existe: false },
          });
        }
        throw err;
      }

      const notas = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[COL_FECHA]) continue;
        const obj = {
          fecha:     (r[COL_FECHA]     || "").trim(),
          actor:     (r[COL_ACTOR]     || "").trim(),
          comunidad: (r[COL_COMUNIDAD] || "").trim(),
          nota:      (r[COL_NOTA]      || "").trim(),
          hecho:     (r[COL_HECHO]     || "").trim(),
          hecho_en:  (r[COL_HECHO_EN]  || "").trim(),
          // _rowIndex es el número de fila REAL en Sheets (1-based,
          // contando la cabecera). Lo devolvemos al cliente para que
          // pueda llamar al endpoint de marcar/desmarcar de forma
          // robusta sin tener que recalcular nada.
          _rowIndex: i + 1,
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
          version:      "0.3.0",
        },
      });

    } catch (err) {
      console.error("[ara-os-notas] Error GET:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------------
  // POST · marcar/desmarcar nota como hecha
  // ----------------------------------------------------------
  // Body JSON:
  // {
  //   "rowIndex": 23,           // fila en Sheets (la devuelve el GET)
  //   "fecha":    "2026-05-09 17:42",  // fallback si rowIndex no llega
  //   "actor":    "José Manuel",       // fallback
  //   "hecho":    true                 // true = marcar, false = desmarcar
  // }
  //
  // Estrategia:
  //   - Preferimos rowIndex (más rápido, una sola lectura no necesaria).
  //   - Si no viene, buscamos por (fecha + actor + nota) — clave única
  //     en la práctica.
  //   - Update granular SOLO de las celdas E (hecho) y F (hecho_en).
  //   - hecho=true → escribimos "si" + timestamp.
  //   - hecho=false → escribimos "" + "" (limpieza).
  //
  // Este endpoint es idempotente: marcar dos veces hecho=true no
  // cambia nada visible (timestamp se actualiza, eso sí).
  // ----------------------------------------------------------
  app.options("/api/ara-os/nota/marcar", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.post("/api/ara-os/nota/marcar", jsonParser, async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });

    try {
      const body     = req.body || {};
      const rowIndex = parseInt(body.rowIndex, 10);
      const hecho    = body.hecho === true || body.hecho === "true" || body.hecho === "si";

      let filaAEscribir = null;

      if (Number.isFinite(rowIndex) && rowIndex > 1) {
        // Caso ideal: el cliente nos pasa la fila exacta
        filaAEscribir = rowIndex;
      } else {
        // Fallback: buscar por (fecha + actor + nota). Estos tres
        // juntos son únicos en la práctica (mismo segundo + mismo
        // autor + mismo texto exacto es prácticamente imposible).
        const fecha     = (body.fecha     || "").trim();
        const actor     = (body.actor     || "").trim();
        const notaTexto = (body.nota      || "").trim();

        if (!fecha || !actor) {
          return res.status(400).json({
            error: "Faltan campos: necesito 'rowIndex' o ('fecha' + 'actor' [+ 'nota'])",
          });
        }

        const sheets = getSheetsClient();
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA}!${RANGO_FILA}`,
        });
        const rows = r.data.values || [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const fechaFila = (row[COL_FECHA] || "").trim();
          const actorFila = (row[COL_ACTOR] || "").trim();
          const notaFila  = (row[COL_NOTA]  || "").trim();
          if (fechaFila === fecha && actorFila === actor &&
              (!notaTexto || notaFila === notaTexto)) {
            filaAEscribir = i + 1;
            break;
          }
        }

        if (!filaAEscribir) {
          return res.status(404).json({
            error: "Nota no encontrada por (fecha + actor [+ nota])",
            fecha, actor,
          });
        }
      }

      // Update granular: solo E y F de la fila concreta
      const valorHecho     = hecho ? "si" : "";
      const valorHechoEn   = hecho ? ahora() : "";

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            {
              range: `${HOJA}!E${filaAEscribir}`,
              values: [[valorHecho]],
            },
            {
              range: `${HOJA}!F${filaAEscribir}`,
              values: [[valorHechoEn]],
            },
          ],
        },
      });

      res.json({
        ok: true,
        rowIndex: filaAEscribir,
        hecho:    valorHecho,
        hecho_en: valorHechoEn,
        meta: {
          actualizado_en: new Date().toISOString(),
          version: "0.3.0",
        },
      });

    } catch (err) {
      console.error("[ara-os-notas] Error MARCAR:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-notas] v0.3.0 · POST /nota · GET /notas · POST /nota/marcar");
};
