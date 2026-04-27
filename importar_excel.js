// ===================================================================
// importar_excel.js — Importa SEGUIMIENTO.xlsm a la pestaña "comunidades"
// ===================================================================
// USO:
//   1. Coloca este archivo en la misma carpeta que index.cjs (~/Desktop/araujo-bot)
//   2. Coloca SEGUIMIENTO.xlsm en la misma carpeta
//   3. Asegúrate de que la pestaña "comunidades" del Sheet está VACÍA
//      (solo cabeceras en la fila 1)
//   4. Ejecuta:  node importar_excel.js
//
// Lee las variables de entorno del propio Render si despliegas allí,
// o del archivo .env local. Mismo sistema que index.cjs.
//
// Pestaña "comunidades", columnas A-AH (10 + 24).
// ===================================================================

const { google } = require("googleapis");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// =================================================================
// Configuración (idéntica a index.cjs)
// =================================================================
function getGoogleAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}
const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

// =================================================================
// Mapeos
// =================================================================
const MAPA_ESTADO_FASE = {
  "00-SOLICITUD ACTA PTO": "01_SOLICITUD",
  "00-PTE VISITA":         "02_VISITA",
  "01-ENVIO PTO":          "03_ENVIO",
  "01-PERSIGO PTO":        "04_SEGUIMIENTO",
  "01-SOLICITUD ACTA PTO": "01_SOLICITUD",
  "02-PTE VISITA":         "02_VISITA",
  "03-ENVIO PTO":          "03_ENVIO",
  "03-ENVÍO PTO":          "03_ENVIO",
  "04-SEGUIMIENTO PTO":    "04_SEGUIMIENTO",
  "05-RESOLUCION PTO":     "05_RESOLUCION",
  "05-RESOLUCIÓN PTO":     "05_RESOLUCION",
  "ZZ-RECHAZADA":          "ZZ_RECHAZADO",
  "ZZ-RECHAZADO":          "ZZ_RECHAZADO",
  "06-ENVIO DOC":          "ENTREGADO",
  "02-PERSIGO CYCP":       "ENTREGADO",
  "02-PERSIGO DOC":        "ENTREGADO",
  "02-EMASESA CYCP":       "ENTREGADO",
  "02-EMASESA TECNICO":    "ENTREGADO",
  "02-TRADICIONAL":        "ENTREGADO",
  "03-TRAMITADA":          "ENTREGADO",
  "04-EJECUTADA":          "ENTREGADO",
};

// =================================================================
// Helpers
// =================================================================
function fmtFechaIso(v) {
  if (v == null || v === "") return "";
  if (v === "---" || v === "----") return "";
  // Si es una fecha de Excel (número serial), convertir
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  // Si es texto que parece fecha
  const str = String(v).trim();
  if (!str) return "";
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}
function texto(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "---" || s === "----") return "";
  return s;
}
function num(v) {
  if (v == null || v === "") return "";
  if (v === "---" || v === "----") return "";
  if (typeof v === "number") return String(v);
  const n = parseFloat(String(v).replace(",", "."));
  if (isNaN(n)) return "";
  return String(n);
}
function tlf(v) {
  if (v == null) return "";
  return String(v).replace(/\D/g, "");
}

// =================================================================
// Función principal
// =================================================================
async function main() {
  console.log("=== Importador Excel → Sheet 'comunidades' ===\n");

  // 1. Verificar variables de entorno
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_SHEETS_ID) {
    console.error("❌ Faltan variables de entorno:");
    console.error("   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SHEETS_ID");
    console.error("\nAsegúrate de tener estas variables en tu .env o exportadas.");
    console.error("Si despliegas en Render, las tomarás de allí.");
    process.exit(1);
  }

  // 2. Verificar que existe el Excel
  const xlsxPath = process.argv[2] || "SEGUIMIENTO.xlsm";
  if (!fs.existsSync(xlsxPath)) {
    console.error("❌ No encuentro " + xlsxPath);
    console.error("Uso: node importar_excel.js [ruta_al_xlsm]");
    process.exit(1);
  }
  console.log("✓ Leyendo Excel: " + xlsxPath);

  // 3. Leer Excel (pestaña 1-RESUMEN)
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  if (!wb.SheetNames.includes("1-RESUMEN")) {
    console.error("❌ El Excel no tiene pestaña '1-RESUMEN'");
    process.exit(1);
  }
  const ws = wb.Sheets["1-RESUMEN"];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  console.log("✓ " + (filas.length - 2) + " filas en 1-RESUMEN");

  // 4. Verificar que la pestaña "comunidades" del Sheet está vacía o con solo cabeceras
  console.log("✓ Comprobando pestaña 'comunidades' del Sheet...");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "comunidades!A:AH",
  });
  const rowsActuales = res.data.values || [];
  if (rowsActuales.length > 1) {
    console.error("⚠️  La pestaña 'comunidades' YA TIENE " + (rowsActuales.length - 1) + " filas de datos.");
    console.error("   Para evitar duplicados, esto requiere borrar antes los datos manualmente.");
    console.error("   O ejecuta con --force para añadir igualmente al final:");
    console.error("       node importar_excel.js SEGUIMIENTO.xlsm --force\n");
    if (!process.argv.includes("--force")) {
      process.exit(1);
    }
    console.log("⚠️  --force activado, añadiendo al final de las filas existentes\n");
  }

  // 5. Construir filas para insertar (saltando fila 1 cabecera + fila 2 sub-cabecera)
  const filasASubir = [];
  for (let i = 2; i < filas.length; i++) {
    const r = filas[i];
    if (!r || !r[1]) continue; // sin dirección, saltar
    const direccion = texto(r[1]);
    if (!direccion) continue;

    const tipoVia = texto(r[0]);
    const earth = texto(r[2]);
    const adminNombre = texto(r[3]);
    const adminTlf = tlf(r[4]);
    const adminEmail = texto(r[5]);
    const presiNombre = texto(r[6]);
    const presiTlf = tlf(r[7]);
    const presiEmail = texto(r[8]);
    const fSolicitud = fmtFechaIso(r[9]);
    const fVisita = fmtFechaIso(r[10]);
    const fEnvio = fmtFechaIso(r[11]);
    const fSeguimiento = fmtFechaIso(r[13]);
    const notas = texto(r[14]);
    const estadoExcel = texto(r[15]);
    const fase = MAPA_ESTADO_FASE[estadoExcel] || "01_SOLICITUD";
    let decision = "";
    let fDecision = "";
    if (fase === "ZZ_RECHAZADO") decision = "RECHAZADO";
    else if (fase === "ENTREGADO") decision = "ACEPTADO";

    const ptoTotal = num(r[30]);
    const moPrev = num(r[31]);
    const moReal = num(r[32]);
    const matPrev = num(r[33]);
    const matReal = num(r[34]);
    const benPrev = num(r[35]);
    const benReal = num(r[36]);
    const benDesv = num(r[37]);
    const tPrev = num(r[27]);
    const tReal = num(r[28]);
    const tDesv = num(r[29]);

    // 34 columnas (A-AH)
    const fila = [
      direccion,                  // A  comunidad (clave humana = misma que dirección)
      direccion,                  // B  direccion
      presiNombre,                // C  presidente
      presiTlf,                   // D  telefono_presidente
      presiEmail,                 // E  email_presidente
      "activa",                   // F  estado_comunidad
      "",                         // G  fecha_inicio
      "",                         // H  fecha_limite_documentacion
      "",                         // I  fecha_limite_firma
      notas,                      // J  observaciones
      tipoVia,                    // K  tipo_via
      earth,                      // L  earth
      adminNombre,                // M  administrador
      adminTlf,                   // N  telefono_administrador
      adminEmail,                 // O  email_administrador
      fase,                       // P  fase_presupuesto
      fSolicitud,                 // Q  fecha_solicitud_pto
      fVisita,                    // R  fecha_visita_pto
      fEnvio,                     // S  fecha_envio_pto
      fSeguimiento,               // T  fecha_ultimo_seguimiento_pto
      decision,                   // U  decision_pto
      fDecision,                  // V  fecha_decision_pto
      ptoTotal,                   // W  pto_total
      moPrev,                     // X  mano_obra_previsto
      moReal,                     // Y  mano_obra_real
      matPrev,                    // Z  material_previsto
      matReal,                    // AA material_real
      benPrev,                    // AB beneficio_previsto
      benReal,                    // AC beneficio_real
      benDesv,                    // AD beneficio_desvio
      tPrev,                      // AE tiempo_previsto
      tReal,                      // AF tiempo_real
      tDesv,                      // AG tiempo_desvio
      "",                         // AH notas_pto
    ];
    filasASubir.push(fila);
  }
  console.log("✓ " + filasASubir.length + " expedientes preparados para subir");

  // Stats
  const porFase = {};
  filasASubir.forEach(f => { porFase[f[15]] = (porFase[f[15]] || 0) + 1; });
  console.log("\nDistribución por fase:");
  for (const [k, v] of Object.entries(porFase).sort()) console.log("  " + k + ": " + v);

  // 6. Subir en lotes de 100
  console.log("\n⏳ Subiendo al Sheet...");
  const LOTE = 100;
  for (let i = 0; i < filasASubir.length; i += LOTE) {
    const lote = filasASubir.slice(i, i + LOTE);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "comunidades!A:AH",
      valueInputOption: "RAW",
      requestBody: { values: lote },
    });
    console.log("  ✓ Subidas " + Math.min(i + LOTE, filasASubir.length) + " / " + filasASubir.length);
  }

  console.log("\n✅ HECHO. Importadas " + filasASubir.length + " comunidades.");
  console.log("Abre: /presupuestos?token=TU_TOKEN para verlas.");
}

main().catch(e => {
  console.error("\n❌ Error:", e.message);
  if (e.response && e.response.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
