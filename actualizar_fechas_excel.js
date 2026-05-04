// =====================================================================
// actualizar_fechas_excel.js
// ---------------------------------------------------------------------
// Lee las fechas del Excel SEGUIMIENTO.xlsm y las escribe en el Sheet
// `comunidades`. Hace UNA SOLA escritura masiva (rango Q:AZ completo)
// para evitar el rate limit de Google (60 writes/min por usuario).
//
// Estrategia:
//   1. Lee TODO el rango comunidades!A:AZ del Sheet en una llamada.
//   2. Construye en memoria la matriz nueva con las fechas del Excel
//      machacando solo las posiciones objetivo (Q, R, S, V, AM, AN, AO, AZ)
//      y respetando todas las demás celdas.
//   3. Escribe TODO el rango Q:AZ en una sola llamada update.
//
// Decisión sesión 04/05/2026: machacar siempre con el valor del Excel.
// Excepción: las cols T (fecha_ultimo_seguimiento_pto) y U (decision_pto)
// se respetan, no las tocamos porque no vienen del Excel.
//
// Uso:
//   cd C:\Users\Guille\Desktop\araujo-bot
//   node actualizar_fechas_excel.js
// =====================================================================

const fs = require("fs");
const path = require("path");

function cargarEnv() {
  const ruta = path.join(__dirname, ".env");
  if (!fs.existsSync(ruta)) return;
  const txt = fs.readFileSync(ruta, "utf8");
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
}
cargarEnv();

const { google } = require("googleapis");
const XLSX = require("xlsx");

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const EXCEL_PATH = path.join(__dirname, "SEGUIMIENTO.xlsm");

if (!SHEET_ID) { console.error("Falta GOOGLE_SHEETS_ID en .env"); process.exit(1); }
if (!fs.existsSync(EXCEL_PATH)) { console.error("No se encuentra " + EXCEL_PATH); process.exit(1); }

function getSheets() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: "v4", auth });
}

function fmtFechaIso(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  if (!s) return "";
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [_, dd, mm, yy] = m;
    if (yy.length === 2) yy = (parseInt(yy, 10) > 50 ? "19" : "20") + yy;
    return `${yy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  return s;
}

function texto(v) { return v == null ? "" : String(v).trim(); }

function normalizarDir(s) {
  return (s || "").toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

// Posiciones (0-based) dentro del slice Q..AZ (36 columnas):
//   Q=0  R=1  S=2  T=3  U=4  V=5
//   W..AL = 6..21
//   AM=22 AN=23 AO=24
//   AP=25
//   AQ..AY = 26..34
//   AZ=35
const RANGO_TOTAL_LEN = 36;
const POS = {
  Q: 0, R: 1, S: 2, T: 3, U: 4, V: 5,
  AM: 22, AN: 23, AO: 24,
  AZ: 35,
};

(async () => {
  const sheets = getSheets();

  // 1. LEER EXCEL
  console.log("Leyendo Excel SEGUIMIENTO.xlsm ...");
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  const wsResumen = wb.Sheets["1-RESUMEN"];
  if (!wsResumen) { console.error("No hay hoja 1-RESUMEN en el Excel"); process.exit(1); }
  const filasResumen = XLSX.utils.sheet_to_json(wsResumen, { header: 1, raw: true, defval: "" });

  const mapaExcel = new Map();
  for (let i = 2; i < filasResumen.length; i++) {
    const r = filasResumen[i];
    if (!r || !r[1]) continue;
    const direccion = texto(r[1]);
    if (!direccion) continue;
    mapaExcel.set(normalizarDir(direccion), {
      direccion,
      fContacto:               fmtFechaIso(r[9]),
      fVisita:                 fmtFechaIso(r[10]),
      fEnvioPto:               fmtFechaIso(r[11]),
      fAceptacionPto:          fmtFechaIso(r[16]),
      fDocumentacionCompleta:  fmtFechaIso(r[17]),
      fVisitaEmasesa:          fmtFechaIso(r[18]),
      fEnvioContratosPagos:    fmtFechaIso(r[19]),
      fContratosPagosCompleta: fmtFechaIso(r[20]),
    });
  }
  console.log(`  ${mapaExcel.size} CCPPs en Excel`);

  // 2. LEER SHEET COMPLETO
  console.log("Leyendo Sheet comunidades (rango A:AZ) ...");
  const resSheet = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: "comunidades!A:AZ",
  });
  const rowsSheet = resSheet.data.values || [];
  const ultimaFila = rowsSheet.length;
  console.log(`  ${ultimaFila} filas en el Sheet (incluida cabecera)`);

  // 3. CONSTRUIR EN MEMORIA LA MATRIZ NUEVA Q..AZ
  let actualizados = 0, sinExcel = 0;
  const matrizNueva = [];
  for (let i = 1; i < ultimaFila; i++) {
    const filaSheet = rowsSheet[i] || [];
    const slice = new Array(RANGO_TOTAL_LEN).fill("");
    for (let k = 0; k < RANGO_TOTAL_LEN; k++) {
      slice[k] = (filaSheet[16 + k] != null) ? String(filaSheet[16 + k]) : "";
    }
    const a = filaSheet[0] || "";
    const b = filaSheet[1] || "";
    const fila = mapaExcel.get(normalizarDir(a)) || mapaExcel.get(normalizarDir(b));
    if (!fila) {
      if (a || b) sinExcel++;
      matrizNueva.push(slice);
      continue;
    }
    slice[POS.Q]  = fila.fContacto;
    slice[POS.R]  = fila.fVisita;
    slice[POS.S]  = fila.fEnvioPto;
    // T y U se respetan (no las pisamos)
    slice[POS.V]  = fila.fAceptacionPto;
    slice[POS.AM] = fila.fVisitaEmasesa;
    slice[POS.AN] = fila.fDocumentacionCompleta;
    slice[POS.AO] = fila.fContratosPagosCompleta;
    slice[POS.AZ] = fila.fEnvioContratosPagos;
    matrizNueva.push(slice);
    actualizados++;
  }

  // 4. ESCRITURA MASIVA — UNA SOLA LLAMADA
  console.log(`Escribiendo ${matrizNueva.length} filas en una sola llamada ...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `comunidades!Q2:AZ${ultimaFila}`,
    valueInputOption: "RAW",
    requestBody: { values: matrizNueva },
  });

  console.log(`\n=== RESUMEN ===`);
  console.log(`CCPPs actualizados con datos del Excel:        ${actualizados}`);
  console.log(`Filas del Sheet sin correspondencia en Excel: ${sinExcel}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
