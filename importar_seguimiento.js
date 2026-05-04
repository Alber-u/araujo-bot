// ===================================================================
// importar_seguimiento.js
// ===================================================================
// Importa SEGUIMIENTO.xlsm al Sheet en una sola pasada:
//   1. BORRA el contenido actual de "comunidades" (manteniendo cabecera).
//   2. BORRA el contenido actual de "pisos"        (manteniendo cabecera).
//   3. Importa "1-RESUMEN" -> 204 filas en "comunidades" (cols A-AH).
//   4. Por cada hoja individual de CCPP (40 hojas):
//      a. Lee los 9 estados del CCPP (filas 3-4) y los escribe en
//         comunidades cols AQ-AY de la fila correspondiente.
//      b. Lee los pisos (filas 5+) y por cada uno crea una fila en
//         "pisos" con datos del piso + 17 estados (cols AC-AS).
//
// USO LOCAL:
//   node importar_seguimiento.js [ruta_al_xlsm]
//
// REQUISITOS DE ENTORNO (igual que el resto de la app):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//   GOOGLE_REFRESH_TOKEN, GOOGLE_SHEETS_ID
// ===================================================================

const { google } = require("googleapis");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// =================================================================
// Cargar variables de entorno desde .env (sin depender de la
// librería 'dotenv', por compatibilidad con cualquier setup)
// =================================================================
(function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, "utf-8");
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let valor = m[2].trim();
    // Quitar comillas envolventes si las hay
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = valor;
  }
})();

// =================================================================
// Auth (idéntico a importadores antiguos / index.cjs)
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
// Mapeo estados Excel -> fase nueva (heredado del importador viejo,
// con los retoques aplicados en presupuestos.cjs durante la migración)
// =================================================================
const MAPA_ESTADO_FASE = {
  "00-SOLICITUD ACTA PTO": "01_CONTACTO",
  "00-PTE VISITA":         "02_VISITA",
  "01-ENVIO PTO":          "03_ENVIO",
  "01-PERSIGO PTO":        "04_SEGUIMIENTO",
  "01-SOLICITUD ACTA PTO": "01_CONTACTO",
  "02-PTE VISITA":         "02_VISITA",
  "03-ENVIO PTO":          "03_ENVIO",
  "03-ENVÍO PTO":          "03_ENVIO",
  "04-SEGUIMIENTO PTO":    "04_SEGUIMIENTO",
  "05-RESOLUCION PTO":     "04_SEGUIMIENTO",
  "05-RESOLUCIÓN PTO":     "04_SEGUIMIENTO",
  "ZZ-RECHAZADA":          "ZZ_RECHAZADO",
  "ZZ-RECHAZADO":          "ZZ_RECHAZADO",
  "06-ENVIO DOC":          "05_DOCUMENTACION",
  "02-PERSIGO CYCP":       "05_DOCUMENTACION",
  "02-PERSIGO DOC":        "05_DOCUMENTACION",
  "02-EMASESA CYCP":       "05_DOCUMENTACION",
  "02-EMASESA TECNICO":    "05_DOCUMENTACION",
  "02-TRADICIONAL":        "05_DOCUMENTACION",
  "03-TRAMITADA":          "05_DOCUMENTACION",
  "04-EJECUTADA":          "05_DOCUMENTACION",
};

// =================================================================
// Helpers
// =================================================================
function fmtFechaIso(v) {
  if (v == null || v === "") return "";
  if (v === "---" || v === "----") return "";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
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
function tlfNorm(s) {
  if (s == null) return "";
  const str = String(s).trim();
  if (!str || str === "---" || str === "----") return "";
  let d = str.replace(/\D/g, "");
  if (d.length === 9) d = "34" + d;
  if (d.length >= 11 && d.startsWith("34")) return "+" + d;
  if (d.length >= 9) return "+" + d;
  return "";
}
// Estado de documento: aceptamos solo los 8 valores conocidos.
// Cualquier otra cosa (incluido vacío) se queda como "".
const ESTADOS_VALIDOS = new Set(["OK", "F", "NP", "OP", "6", "12", "18", "CCPP"]);
function estadoDoc(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (ESTADOS_VALIDOS.has(s)) return s;
  // Algunas celdas tienen comas, espacios, "Fª" como texto, etc. Nada de eso es estado.
  return "";
}

// =================================================================
// Posiciones FIJAS de los 9 documentos del CCPP en cada hoja individual
// (son 1-indexadas: row=fila, col=columna)
// Ya las verificamos contigo durante la sesión.
// =================================================================
const POS_DOCS_CCPP = [
  // Orden coincide con AQ..AY de comunidades (las 9 cabeceras est_ccpp_*)
  { campo: "ccpp_contrato_firmado",   row: 3, col: 13 }, // M3
  { campo: "ccpp_toma_datos",         row: 3, col: 18 }, // R3
  { campo: "ccpp_nif",                row: 3, col: 20 }, // T3
  { campo: "ccpp_acta_pte",           row: 4, col: 9  }, // I4
  { campo: "ccpp_acta_pto",           row: 4, col: 13 }, // M4
  { campo: "ccpp_renuncia_gp",        row: 4, col: 18 }, // R4
  { campo: "ccpp_factura_emasesa",    row: 4, col: 20 }, // T4
  { campo: "ccpp_contrato",           row: 3, col: 21 }, // U3 (combinada U3:U4)
  { campo: "ccpp_pago",               row: 3, col: 22 }, // V3 (combinada V3:V4)
];

// Las columnas F-V (6-22) del Excel son los 17 documentos del piso, en orden:
// F=Toma datos, G=NIF toma datos, ..., V=Pago
// Están en el mismo orden que las cabeceras AC-AS del Sheet, así que basta
// recorrer las cols 6..22 en orden.

// =================================================================
// MAIN
// =================================================================
async function main() {
  console.log("========================================");
  console.log("Importador SEGUIMIENTO.xlsm -> Sheet");
  console.log("========================================\n");

  // 1. Verificaciones previas
  for (const k of ["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","GOOGLE_REFRESH_TOKEN","GOOGLE_SHEETS_ID"]) {
    if (!process.env[k]) { console.error("Falta variable de entorno: " + k); process.exit(1); }
  }
  const xlsxPath = process.argv[2] || "SEGUIMIENTO.xlsm";
  if (!fs.existsSync(xlsxPath)) {
    console.error("No encuentro " + xlsxPath);
    process.exit(1);
  }
  console.log("Leyendo " + xlsxPath + " ...");
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  if (!wb.SheetNames.includes("1-RESUMEN")) {
    console.error("El Excel no tiene pestaña 1-RESUMEN");
    process.exit(1);
  }

  // 2. BORRAR contenido actual (mantener cabecera)
  console.log("\n[1/4] Limpiando filas existentes en comunidades y pisos...");
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: "comunidades!A2:ZZ" });
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: "pisos!A2:ZZ" });
  console.log("  · comunidades: filas borradas (cabecera intacta)");
  console.log("  · pisos: filas borradas (cabecera intacta)");

  // 3. IMPORTAR 1-RESUMEN -> comunidades A-AH
  console.log("\n[2/4] Importando 1-RESUMEN -> comunidades ...");
  const wsResumen = wb.Sheets["1-RESUMEN"];
  const filasResumen = XLSX.utils.sheet_to_json(wsResumen, { header: 1, raw: true, defval: "" });

  // Mapa direccion -> índice de fila en filasComunidades (para luego escribir los estados CCPP)
  const indicePorDireccion = new Map();
  const filasComunidades = [];

  for (let i = 2; i < filasResumen.length; i++) {
    const r = filasResumen[i];
    if (!r || !r[1]) continue;
    const direccion = texto(r[1]);
    if (!direccion) continue;

    const tipoVia        = texto(r[0]);
    const earth          = texto(r[2]);
    const adminNombre    = texto(r[3]);
    const adminTlf       = String(r[4] == null ? "" : r[4]).replace(/\D/g, "");
    const adminEmail     = texto(r[5]);
    const presiNombre    = texto(r[6]);
    const presiTlf       = String(r[7] == null ? "" : r[7]).replace(/\D/g, "");
    const presiEmail     = texto(r[8]);
    const fSolicitud     = fmtFechaIso(r[9]);
    const fVisita        = fmtFechaIso(r[10]);
    const fEnvio         = fmtFechaIso(r[11]);
    const fSeguimiento   = fmtFechaIso(r[13]);
    const notas          = texto(r[14]);
    const estadoExcel    = texto(r[15]);
    const fase           = MAPA_ESTADO_FASE[estadoExcel] || "01_CONTACTO";
    let decision = "";
    let fDecision = "";
    if (fase === "ZZ_RECHAZADO") decision = "RECHAZADO";
    else if (["05_DOCUMENTACION","06_VISITA_EMASESA","07_CONTRATOS_PAGOS","08_TRAMITADA"].includes(fase)) decision = "ACEPTADO";

    const ptoTotal = num(r[30]);
    const moPrev   = num(r[31]);
    const moReal   = num(r[32]);
    const matPrev  = num(r[33]);
    const matReal  = num(r[34]);
    const benPrev  = num(r[35]);
    const benReal  = num(r[36]);
    const benDesv  = num(r[37]);
    const tPrev    = num(r[27]);
    const tReal    = num(r[28]);
    const tDesv    = num(r[29]);

    // 51 columnas (A-AY). Las 17 últimas (AI-AY) inicialmente vacías.
    // AQ..AY (índices 42..50) se rellenan en el paso 3 (estados CCPP).
    const fila = new Array(51).fill("");
    fila[0]  = direccion;        // A  comunidad (clave humana = misma que dirección)
    fila[1]  = direccion;        // B  direccion
    fila[2]  = presiNombre;      // C  presidente
    fila[3]  = presiTlf;         // D  telefono_presidente
    fila[4]  = presiEmail;       // E  email_presidente
    fila[5]  = "activa";         // F  estado_comunidad
    // G,H,I  fechas vacías
    fila[9]  = notas;            // J  observaciones
    fila[10] = tipoVia;          // K  tipo_via
    fila[11] = earth;            // L  earth
    fila[12] = adminNombre;      // M  administrador
    fila[13] = adminTlf;         // N  telefono_administrador
    fila[14] = adminEmail;       // O  email_administrador
    fila[15] = fase;             // P  fase_presupuesto
    fila[16] = fSolicitud;       // Q  fecha_solicitud_pto
    fila[17] = fVisita;          // R  fecha_visita_pto
    fila[18] = fEnvio;           // S  fecha_envio_pto
    fila[19] = fSeguimiento;     // T  fecha_ultimo_seguimiento_pto
    fila[20] = decision;         // U  decision_pto
    fila[21] = fDecision;        // V  fecha_decision_pto
    fila[22] = ptoTotal;         // W  pto_total
    fila[23] = moPrev;           // X
    fila[24] = moReal;           // Y
    fila[25] = matPrev;          // Z
    fila[26] = matReal;          // AA
    fila[27] = benPrev;          // AB
    fila[28] = benReal;          // AC
    fila[29] = benDesv;          // AD
    fila[30] = tPrev;            // AE
    fila[31] = tReal;            // AF
    fila[32] = tDesv;            // AG
    // AH notas_pto vacío
    // AI..AP vacíos (mails, fechas EMASESA, modo doc -> se rellenarán al operar)
    // AQ..AY estados CCPP -> se rellenarán abajo, paso 3
    indicePorDireccion.set(direccion, filasComunidades.length);
    filasComunidades.push(fila);
  }
  console.log("  · " + filasComunidades.length + " comunidades preparadas");

  // 4. IMPORTAR estados CCPP + pisos (recorrer hojas individuales)
  console.log("\n[3/4] Procesando hojas individuales (estados CCPP + pisos) ...");
  const TECNICAS = new Set(["1-RESUMEN", "2-MODELO", "PROCESO", "DNI-NIF"]);
  const hojasInd = wb.SheetNames.filter(n => !TECNICAS.has(n));

  const filasPisos = [];
  let estadosCcppEscritos = 0;
  let pisosCreados = 0;
  let ccppEnExcelNoEnResumen = [];

  for (const nombreHoja of hojasInd) {
    const ws = wb.Sheets[nombreHoja];
    // sheet_to_json con range para acceso directo a celdas
    // pero mejor leer crudo con cell_address para leer M3, R3, etc.
    function celda(r, c) {
      // r y c en 1-index. xlsx usa formato A1.
      const addr = XLSX.utils.encode_cell({ r: r-1, c: c-1 });
      const cell = ws[addr];
      return cell ? cell.v : null;
    }

    // 4a. Estados CCPP (9 valores) -> insertar en filasComunidades[idx][42..50]
    const idxCom = indicePorDireccion.get(nombreHoja);
    if (idxCom == null) {
      ccppEnExcelNoEnResumen.push(nombreHoja);
      // Aún así seguimos procesando los pisos por si el usuario quiere verlos
    } else {
      POS_DOCS_CCPP.forEach((p, k) => {
        const v = estadoDoc(celda(p.row, p.col));
        filasComunidades[idxCom][42 + k] = v; // AQ=42, AR=43, ...
        if (v) estadosCcppEscritos++;
      });
    }

    // 4b. Pisos -> añadir filas a filasPisos
    // Filas 5+ hasta donde haya datos en col B (PISO).
    const ref = ws["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    for (let r = 5; r <= range.e.r + 1; r++) {
      const piso        = celda(r, 2); // B  PISO
      if (piso == null || String(piso).trim() === "") continue;
      const tlfRaw      = celda(r, 3); // C  TELEFONO
      const nombre      = celda(r, 4); // D  NOTA SIMPLE - en realidad nombre/nota
      // ATENCIÓN: por la estructura del Excel, col D del piso es "NOTA SIMPLE"
      // Tu modelo en el sistema actual usa col D como "nombre".
      // Se usa lo que haya en col D como string libre.
      // Si más adelante decides separar nota_simple del nombre, se hace en una sesión aparte.

      // Construir fila de pisos. Estructura A-AS (45 columnas).
      const fila = new Array(45).fill("");
      fila[0]  = tlfNorm(tlfRaw);                    // A  telefono
      fila[1]  = nombreHoja;                         // B  comunidad
      fila[2]  = String(piso).trim();                // C  vivienda
      fila[3]  = texto(nombre);                      // D  nombre
      // E tipo_expediente -> se infiere de col E del Excel (titularidad T/I/U/C)
      const titularidad = String(celda(r, 5) || "").trim().toUpperCase();
      let tipoExp = "propietario";
      if (titularidad.startsWith("(I)") || titularidad === "I") tipoExp = "inquilino";
      fila[4]  = tipoExp;                            // E  tipo_expediente
      fila[5]  = "historico";                        // F  paso_actual  (clave: el bot lo ignora)
      // G documento_actual vacío
      fila[7]  = "documentacion_base_completa";      // H  estado_expediente
      // I,J,K,L,M fechas vacías
      // N documentos_completos -> "SI" si col A del Excel es COMPLETO
      const estadoA = String(celda(r, 1) || "").trim().toUpperCase();
      fila[13] = (estadoA === "COMPLETO") ? "SI" : "NO";  // N
      fila[14] = "ok";                               // O  alerta_plazo
      // P, Q, R: documentos_recibidos / pendientes / opcionales pendientes -> vacíos
      //         (los datos del bot, no se mezclan con el sistema manual)
      // S..Z varios -> vacíos
      fila[21] = "esperando_input_administrador";    // V motivo_bloqueo_actual
      fila[22] = "baja";                             // W prioridad_expediente
      fila[23] = "si";                               // X requiere_intervencion_humana
      // Y, Z, AA, AB columnas del bot añadidas en sesiones anteriores -> vacías

      // AC..AS (índices 28..44) -> 17 estados del piso (cols F..V del Excel)
      for (let c = 6; c <= 22; c++) {
        const v = estadoDoc(celda(r, c));
        fila[28 + (c - 6)] = v; // AC=28
      }

      filasPisos.push(fila);
      pisosCreados++;
    }
  }

  console.log("  · " + estadosCcppEscritos + " estados CCPP rellenados");
  console.log("  · " + pisosCreados + " pisos preparados");
  if (ccppEnExcelNoEnResumen.length) {
    console.log("  · " + ccppEnExcelNoEnResumen.length + " hojas de Excel SIN entrada en 1-RESUMEN:");
    ccppEnExcelNoEnResumen.forEach(n => console.log("      - " + n));
  }

  // 5. SUBIR todo
  console.log("\n[4/4] Subiendo al Sheet ...");

  // 5a. comunidades en lotes de 100
  const LOTE = 100;
  for (let i = 0; i < filasComunidades.length; i += LOTE) {
    const lote = filasComunidades.slice(i, i + LOTE);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "comunidades!A:AY",
      valueInputOption: "RAW",
      requestBody: { values: lote },
    });
    console.log("  · comunidades subidas " + Math.min(i + LOTE, filasComunidades.length) + " / " + filasComunidades.length);
  }

  // 5b. pisos en lotes de 100
  for (let i = 0; i < filasPisos.length; i += LOTE) {
    const lote = filasPisos.slice(i, i + LOTE);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "pisos!A:AS",
      valueInputOption: "RAW",
      requestBody: { values: lote },
    });
    console.log("  · pisos subidos       " + Math.min(i + LOTE, filasPisos.length) + " / " + filasPisos.length);
  }

  // 6. Resumen final
  console.log("\n========================================");
  console.log("HECHO");
  console.log("========================================");
  console.log("Comunidades: " + filasComunidades.length);
  console.log("Pisos:       " + filasPisos.length);
  console.log("Estados CCPP rellenados: " + estadosCcppEscritos);
  console.log("\nLos pisos se han marcado como paso_actual='historico'");
  console.log("y requiere_intervencion_humana='si' para que el bot");
  console.log("automatico los ignore. El sistema MANUAL los gestionará.");
}

main().catch(e => {
  console.error("\nERROR:", e.message);
  if (e.response && e.response.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
