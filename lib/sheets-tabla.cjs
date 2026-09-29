// ============================================================
// lib/sheets-tabla.cjs — leer una pestaña de GOOGLE_SHEETS_ID como
// lista de objetos, creándola (solo cabecera) si no existe.
// Mismo cliente OAuth que el resto del backend.
// ============================================================
"use strict";

const { google } = require("googleapis");

let _sheets = null;
function getSheetsClient() {
  if (_sheets) return _sheets;
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheets = google.sheets({ version: "v4", auth: oauth2 });
  return _sheets;
}

function colLetra(i) {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

const _creadas = new Set();

// Crea la pestaña con su cabecera si no existe (crear=false: solo comprueba).
// No toca una pestaña que ya existe. Devuelve true si la pestaña existe.
async function asegurarPestana(nombre, headers, crear = true) {
  if (_creadas.has(nombre)) return true;
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("Falta GOOGLE_SHEETS_ID en entorno");
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" });
  const existe = (meta.data.sheets || []).some((s) => s.properties.title === nombre);
  if (!existe && !crear) return false;
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: nombre } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${nombre}!A1:${colLetra(headers.length - 1)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
  _creadas.add(nombre);
  return true;
}

// Lee la pestaña. Las columnas se mapean por el NOMBRE de la cabecera de la
// fila 1 (no por posición), así da igual el orden de las columnas.
// Devuelve { filas, faltan } — `faltan` = cabeceras esperadas que no están.
async function leerPestana(nombre, headers, { crear = true } = {}) {
  if (!(await asegurarPestana(nombre, headers, crear))) return { filas: [], faltan: headers, no_existe: true };
  const r = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${nombre}!A1:ZZ`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const valores = r.data.values || [];
  const cab = (valores[0] || []).map((h) => String(h || "").trim().toLowerCase());
  const filas = valores.slice(1).map((fila) => {
    const o = {};
    cab.forEach((h, i) => { if (h) o[h] = fila[i] != null ? fila[i] : ""; });
    return o;
  });
  return { filas, faltan: headers.filter((h) => !cab.includes(h)) };
}

module.exports = { getSheetsClient, asegurarPestana, leerPestana };
