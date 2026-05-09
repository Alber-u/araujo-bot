// ============================================================
// ARA OS — Acciones humanas sobre bloqueos_operativos
// v0.1.0
//
// Añadir en index.cjs (junto a los otros require de ara-os):
//   require("./ara-os-acciones.cjs")(app);
//
// POST /api/ara-os/bloqueo/actualizar?token=araujo2026
//
// Body JSON:
// {
//   "comunidad":     "C/ Ejemplo 12",     // requerido (clave)
//   "tipo_bloqueo":  "DOC_PENDIENTE",     // requerido (clave)
//   "estado":        "revisado" | "en_seguimiento" | "pendiente_tercero" | "resuelto",
//   "comentario":    "texto libre",       // opcional, se concatena
//   "actor":         "José Manuel",       // opcional, default desde body o "humano"
//   "esperar_hasta": "2026-05-15",        // opcional, override manual
//   "proxima_revision": "2026-05-12"      // opcional, override manual
// }
//
// Devuelve la fila actualizada para que el frontend repinte sin recargar.
//
// Diseño:
// - Update granular por columna (NO pisa la fila entera).
// - Marca override_por + override_en con timestamp automático.
// - "resuelto" pone resuelto="si" + resuelto_en=hoy (la inferencia lo respeta).
// - "en_seguimiento" empuja proxima_revision +3 días si no viene explícita.
// - "pendiente_tercero" empuja esperar_hasta +7 días si no viene explícita.
// - "revisado" solo añade comentario y override_en (queda visible que JM lo vio).
// ============================================================

module.exports = function setupAraOSAcciones(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";
  function tokenValido(req) { return req.query.token === ADMIN_TOKEN; }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return res.data.values || [];
  }

  // Mismas columnas que en panel/inferencia — fuente única
  const COLS_BLOQUEO = [
    "comunidad","tipo_bloqueo","severidad","pelota_en","impacto",
    "vecinos_afectados","accion_exacta","detectado_por","detectado_en",
    "ultimo_movimiento_humano","dias_sin_movimiento","override_por","override_en",
    "override_comentario","esperar_hasta","proxima_revision","resuelto","resuelto_en",
    "owner","owner_override","owner_override_por","comentario_operativo"
  ];

  // Índice columna (1-based para A1 notation): A=1, B=2, ...
  function colLetra(idx0) {
    // idx0 0..25 → A..Z; suficiente para 22 columnas (A..V)
    return String.fromCharCode(65 + idx0);
  }
  function colDeCampo(campo) {
    const i = COLS_BLOQUEO.indexOf(campo);
    if (i < 0) throw new Error("Campo desconocido: " + campo);
    return colLetra(i);
  }

  function hoy() { return new Date().toISOString().slice(0,10); }
  function ahora() { return new Date().toISOString().slice(0,16).replace("T"," "); }
  function sumarDias(fechaStr, dias) {
    const d = fechaStr ? new Date(fechaStr) : new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0,10);
  }

  // Localiza la fila por (comunidad, tipo_bloqueo). Devuelve _rowIndex y la fila.
  async function localizarFila(comunidad, tipo_bloqueo) {
    const rows = await leerHoja("bloqueos_operativos!A:V");
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      if ((r[0] || "").trim() === comunidad.trim() &&
          (r[1] || "").trim() === tipo_bloqueo.trim()) {
        const obj = {};
        COLS_BLOQUEO.forEach((k, j) => { obj[k] = (r[j] || "").trim(); });
        return { rowIndex: i + 1, fila: obj };
      }
    }
    return null;
  }

  // Update granular: lista de {campo, valor} → batchUpdate por celdas concretas
  async function actualizarCampos(rowIndex, cambios) {
    const sheets = getSheetsClient();
    const data = cambios.map(({ campo, valor }) => ({
      range: `bloqueos_operativos!${colDeCampo(campo)}${rowIndex}`,
      values: [[valor]],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: { valueInputOption: "RAW", data },
    });
  }

  // Mapea estado humano a cambios concretos sobre el sheet
  function calcularCambios(estado, fila, body) {
    const actor    = (body.actor || "humano").trim();
    const ts       = ahora();
    const fhoy     = hoy();
    const cambios  = [];

    // Trazabilidad: SIEMPRE registramos quién y cuándo tocó la fila
    cambios.push({ campo: "override_por", valor: actor });
    cambios.push({ campo: "override_en",  valor: ts });

    // Comentario operativo: concatenamos al existente (no pisamos histórico)
    if (body.comentario && body.comentario.trim()) {
      const previo = fila.comentario_operativo || "";
      const linea  = `[${fhoy} ${actor}] ${body.comentario.trim()}`;
      const nuevo  = previo ? `${previo}\n${linea}` : linea;
      cambios.push({ campo: "comentario_operativo", valor: nuevo });
    }

    // Override comentario corto (texto del estado)
    cambios.push({ campo: "override_comentario", valor: estado });

    switch (estado) {
      case "revisado":
        // Solo deja huella de revisión, no cambia plazos
        break;

      case "en_seguimiento":
        cambios.push({
          campo: "proxima_revision",
          valor: body.proxima_revision || sumarDias(null, 3),
        });
        break;

      case "pendiente_tercero":
        cambios.push({
          campo: "esperar_hasta",
          valor: body.esperar_hasta || sumarDias(null, 7),
        });
        break;

      case "resuelto":
        cambios.push({ campo: "resuelto",    valor: "si" });
        cambios.push({ campo: "resuelto_en", valor: fhoy });
        break;

      default:
        throw new Error(
          "Estado no válido: " + estado +
          " (usa: revisado, en_seguimiento, pendiente_tercero, resuelto)"
        );
    }

    return cambios;
  }

  // Construye la fila resultante (en memoria) tras aplicar cambios — sin releer Sheets
  function aplicarEnMemoria(fila, cambios) {
    const out = { ...fila };
    for (const { campo, valor } of cambios) out[campo] = valor;
    return out;
  }

  app.options("/api/ara-os/bloqueo/actualizar", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.post("/api/ara-os/bloqueo/actualizar", jsonParser, async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });

    try {
      const body = req.body || {};
      const { comunidad, tipo_bloqueo, estado } = body;

      if (!comunidad || !tipo_bloqueo) {
        return res.status(400).json({
          error: "Faltan campos requeridos: comunidad, tipo_bloqueo"
        });
      }
      if (!estado) {
        return res.status(400).json({
          error: "Falta campo requerido: estado (revisado | en_seguimiento | pendiente_tercero | resuelto)"
        });
      }

      const localizada = await localizarFila(comunidad, tipo_bloqueo);
      if (!localizada) {
        return res.status(404).json({
          error: "Bloqueo no encontrado",
          comunidad, tipo_bloqueo,
        });
      }

      const cambios = calcularCambios(estado, localizada.fila, body);
      await actualizarCampos(localizada.rowIndex, cambios);

      const filaActualizada = aplicarEnMemoria(localizada.fila, cambios);

      res.json({
        ok: true,
        rowIndex: localizada.rowIndex,
        cambios,
        bloqueo: filaActualizada,
        meta: {
          actualizado_en: new Date().toISOString(),
          version: "0.1.0",
        },
      });

    } catch (err) {
      console.error("[ara-os-acciones] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-acciones] v0.1.0 · POST /api/ara-os/bloqueo/actualizar");
};
