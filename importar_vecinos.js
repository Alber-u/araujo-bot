// ===================================================================
// importar_vecinos.js — Importa vecinos antiguos a la pestaña "expedientes"
// ===================================================================
// USO:
//   node importar_vecinos.js
//
// Salvaguardas:
//   - Solo importa vecinos cuyo teléfono NO esté ya en "expedientes"
//   - paso_actual = "historico" → el job de seguimiento los ignora
//   - documentos_pendientes vacío para los completos → 2ª capa de protección
//   - requiere_intervencion_humana = "si" → 3ª capa
//   - estado_expediente = "documentacion_base_completa" para los OK del Excel
//   - El index.cjs los lee y los muestra, pero NO les manda WhatsApps
//
// Pestaña expedientes, columnas A-Z (26 columnas).
// ===================================================================

const { google } = require("googleapis");
const XLSX = require("xlsx");
const fs = require("fs");

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
// Helpers
// =================================================================
function tlfNorm(s) {
  if (s == null) return "";
  const str = String(s).trim();
  if (!str || str === "---" || str === "----") return "";
  // Normaliza a +34XXXXXXXXX (igual que index.cjs:normalizarTelefono)
  let d = str.replace(/\D/g, "");
  if (d.length === 9) d = "34" + d;
  if (d.length === 11 && d.startsWith("34")) return "+" + d;
  if (d.length === 12 && d.startsWith("34")) return "+" + d.slice(0); // ya con código
  if (d.length >= 9) return "+" + d;
  return "";
}

function texto(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "---" || s === "----") return "";
  return s;
}

function detectarTipo(tipoCelda) {
  // Excel col E: "(T)Adolfo...", "(I)Pedro...", "(U)Maria...", "(C)Contacto...", "Disidente..."
  if (!tipoCelda) return "propietario";
  const t = String(tipoCelda).trim().toUpperCase();
  if (t.startsWith("(I)")) return "inquilino";
  if (t.includes("DISIDENTE")) return "propietario";
  return "propietario";
}

// =================================================================
// MAIN
// =================================================================
async function main() {
  console.log("=== Importador de vecinos antiguos a 'expedientes' ===\n");

  // 1. Verificar entorno
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_SHEETS_ID) {
    console.error("❌ Faltan variables de entorno (GOOGLE_CLIENT_ID, _SECRET, _REFRESH_TOKEN, _SHEETS_ID)");
    process.exit(1);
  }

  // 2. Verificar Excel
  const xlsxPath = process.argv[2] || "SEGUIMIENTO.xlsm";
  if (!fs.existsSync(xlsxPath)) {
    console.error("❌ No encuentro " + xlsxPath);
    process.exit(1);
  }

  // 3. Leer "expedientes" actual para evitar duplicados
  console.log("✓ Leyendo pestaña 'expedientes' actual...");
  const resExp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: "expedientes!A:Z",
  });
  const rowsExp = resExp.data.values || [];
  const telefonosExistentes = new Set();
  for (let i = 1; i < rowsExp.length; i++) {
    const t = (rowsExp[i] && rowsExp[i][0]) || "";
    if (t) {
      // Normalizar para comparar
      const d = String(t).replace(/\D/g, "");
      if (d) telefonosExistentes.add(d);
    }
  }
  console.log(`  · ${rowsExp.length - 1} vecinos ya existen en expedientes`);

  // 4. Leer Excel
  console.log("✓ Leyendo Excel: " + xlsxPath);
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const TECNICAS = new Set(["1-RESUMEN", "2-MODELO", "PROCESO", "DNI-NIF"]);
  const hojas = wb.SheetNames.filter(n => !TECNICAS.has(n));
  console.log(`  · ${hojas.length} comunidades en el Excel`);

  // 5. Extraer vecinos
  const filasASubir = [];
  let totalEnExcel = 0;
  let omitidosDuplicados = 0;
  let omitidosSinDatos = 0;

  for (const nombreHoja of hojas) {
    const ws = wb.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    // Datos desde fila 5 (índice 4)
    for (let r = 4; r < Math.min(filas.length, 50); r++) {
      const fila = filas[r] || [];
      const estadoA = texto(fila[0]);   // COMPLETO / FALTA
      const vivienda = texto(fila[1]);
      const tlfRaw = fila[2];
      const nombre = texto(fila[3]);
      const tipoE = texto(fila[4]);
      
      if (!vivienda && !nombre) continue;
      const telefono = tlfNorm(tlfRaw);
      if (!nombre && !telefono) { omitidosSinDatos++; continue; }
      totalEnExcel++;

      // Saltar si ya existe en expedientes (por teléfono)
      const tDigits = telefono.replace(/\D/g, "");
      if (tDigits && telefonosExistentes.has(tDigits)) {
        omitidosDuplicados++;
        continue;
      }

      const tipoExp = detectarTipo(tipoE);
      const completo = estadoA.toUpperCase() === "COMPLETO";

      // Documentos según tipo
      const REQUIRED = {
        propietario: { obligatorios: ["solicitud_firmada", "dni_delante", "dni_detras"], opcionales: ["empadronamiento"] },
        inquilino:   { obligatorios: ["solicitud_firmada", "dni_inquilino_delante", "dni_inquilino_detras", "dni_propietario_delante", "dni_propietario_detras", "contrato_alquiler"], opcionales: ["empadronamiento"] },
      };
      const reglas = REQUIRED[tipoExp] || REQUIRED.propietario;
      const recibidos = completo ? reglas.obligatorios.join(",") : "";
      const pendientes = completo ? "" : reglas.obligatorios.join(",");

      // ESTRUCTURA EXACTA que usa index.cjs (26 columnas A:Z)
      const filaSheet = [
        telefono,                              // A  telefono
        nombreHoja,                            // B  comunidad (igual que el nombre de la pestaña Excel)
        vivienda,                              // C  vivienda
        nombre,                                // D  nombre
        tipoExp,                               // E  tipo_expediente
        "historico",                           // F  paso_actual ← clave: el job lo ignora
        "",                                    // G  documento_actual
        "documentacion_base_completa",         // H  estado_expediente
        "",                                    // I  fecha_inicio
        "",                                    // J  fecha_primer_contacto
        "",                                    // K  fecha_ultimo_contacto
        "",                                    // L  fecha_limite_documentacion
        "",                                    // M  fecha_limite_firma
        completo ? "SI" : "NO",                // N  documentos_completos
        "ok",                                  // O  alerta_plazo
        recibidos,                             // P  documentos_recibidos
        pendientes,                            // Q  documentos_pendientes
        "empadronamiento",                     // R  documentos_opcionales_pendientes
        "",                                    // S  ultimo_documento_fallido
        "",                                    // T  fecha_ultimo_fallo
        "",                                    // U  reintento_hasta
        "esperando_input_administrador",       // V  motivo_bloqueo_actual
        "baja",                                // W  prioridad_expediente
        "si",                                  // X  requiere_intervencion_humana ← clave: doble protección
        "",                                    // Y  documentos_opcionales_descartados
        "",                                    // Z  notificacion_financiacion_enviada
      ];
      filasASubir.push(filaSheet);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  · Total en Excel: ${totalEnExcel}`);
  console.log(`  · Omitidos por sin datos: ${omitidosSinDatos}`);
  console.log(`  · Omitidos por ya existir en 'expedientes': ${omitidosDuplicados}`);
  console.log(`  · A subir: ${filasASubir.length}`);

  if (filasASubir.length === 0) {
    console.log("\nNo hay nada que subir.");
    return;
  }

  // 6. Subir en lotes de 100
  console.log("\n⏳ Subiendo a 'expedientes' (paso_actual=historico, requiere_intervencion_humana=si)...");
  const LOTE = 100;
  for (let i = 0; i < filasASubir.length; i += LOTE) {
    const lote = filasASubir.slice(i, i + LOTE);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "expedientes!A:Z",
      valueInputOption: "RAW",
      requestBody: { values: lote },
    });
    console.log(`  ✓ Subidos ${Math.min(i + LOTE, filasASubir.length)} / ${filasASubir.length}`);
  }

  console.log(`\n✅ HECHO. ${filasASubir.length} vecinos importados como históricos.`);
  console.log("Estos vecinos:");
  console.log("  - SE VEN en /presupuestos al abrir cada CCPP");
  console.log("  - NO reciben WhatsApps automáticos (paso_actual=historico)");
  console.log("  - Son ignorados por el job de seguimiento");
  console.log("\nPara revertir: borra de la pestaña 'expedientes' las filas con paso_actual='historico'");
}

main().catch(e => {
  console.error("\n❌ Error:", e.message);
  if (e.response && e.response.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
