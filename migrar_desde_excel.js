// =====================================================================
// migrar_desde_excel.js
// ---------------------------------------------------------------------
// Script ÚNICO de migración. Borra y rehace todo desde el Excel.
//
// Hace en orden:
//   1. Borra contenido de las pestañas `comunidades` y `pisos`.
//   2. Importa hoja `1-RESUMEN` -> filas en `comunidades` con sus 8 fechas
//      mapeadas a sus columnas correctas y la col P (fase) calculada
//      según la última fecha rellena.
//   3. Por cada hoja individual (40 CCPPs):
//        - filas 3-4 -> 9 estados manuales CCPP en cols AQ-AY
//        - filas 5+  -> pisos con sus 17 estados manuales en cols AC-AS
//
// Todas las escrituras agrupadas en pocas llamadas (1-2 por pestaña).
//
// Uso:
//   cd C:\Users\Guille\Desktop\araujo-bot
//   node migrar_desde_excel.js
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

// ---------- Utilidades ----------
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
function normalizarTxt(s) {
  return (s || "").toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
// ¿Una celda de fecha tiene una fecha válida? Solo cuenta si es ISO yyyy-mm-dd
// (las celdas con texto tipo "JM", "PTE", etc. NO cuentan como fecha rellena
// para el cálculo de fase).
function esFechaIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }

// Calcula la fase actual de un CCPP a partir de la col P del Excel y sus
// 8 fechas. Reglas:
//  - Si col P del Excel marca rechazado (ZZ-RECHAZADA o variantes) -> ZZ_RECHAZADO
//  - Si no, "Última fecha rellena = fin de fase X, CCPP está en fase X+1"
function calcularFase(fechas, estadoExcelP) {
  // 1) Detectar rechazado por la col P del Excel (texto literal del usuario).
  //    Aceptamos variantes con/sin tilde, guion bajo, mayúsculas, etc.
  const p = (estadoExcelP || "").toString().trim().toUpperCase()
    .replace(/[\s_]+/g, "-");
  if (p === "ZZ-RECHAZADA" || p === "ZZ-RECHAZADO" ||
      p === "RECHAZADA"    || p === "RECHAZADO") {
    return "ZZ_RECHAZADO";
  }
  // 2) Última fecha rellena -> fase siguiente.
  // Orden de detección de la fase actual (decisión sesión 04/05/2026):
  //   T del Excel rellena -> 08_CYCP (mail de contratos+pagos enviado).
  //   U del Excel rellena -> 08_CYCP también (legacy: era cierre de la antigua 07
  //                          en el modelo viejo; equivalente a la nueva 08).
  //   S del Excel rellena (visita EMASESA hecha) y nada después -> 07_PTE_CYCP.
  //   R del Excel rellena (documentación cerrada) y nada después -> 06_VISITA_EMASESA.
  //   Q del Excel rellena (aceptación) y nada después -> 05_DOCUMENTACION.
  //   L del Excel rellena (envío PTO) y nada después -> 04_ACEPTACION_PTO.
  //   K del Excel rellena (visita) y nada después -> 03_ENVIO_PTO.
  //   J del Excel rellena (solicitud) y nada después -> 01_CONTACTO (decisión:
  //     no se usa 02_VISITA en la importación).
  //   ninguna fecha -> 01_CONTACTO.
  if (esFechaIso(fechas.T))  return "08_CYCP";
  if (esFechaIso(fechas.U))  return "08_CYCP";
  if (esFechaIso(fechas.S))  return "07_PTE_CYCP";
  if (esFechaIso(fechas.R))  return "06_VISITA_EMASESA";
  if (esFechaIso(fechas.Q))  return "05_DOCUMENTACION";
  if (esFechaIso(fechas.L))  return "04_ACEPTACION_PTO";
  if (esFechaIso(fechas.K))  return "03_ENVIO_PTO";
  if (esFechaIso(fechas.J))  return "01_CONTACTO";
  return "01_CONTACTO";
}

// =====================================================================
// MAIN
// =====================================================================
(async () => {
  const sheets = getSheets();

  console.log("==========================================");
  console.log("MIGRACIÓN COMPLETA DESDE EXCEL");
  console.log("==========================================\n");

  // ----- 1. Leer Excel completo -----
  console.log("[1/4] Leyendo Excel SEGUIMIENTO.xlsm ...");
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });

  const hojaResumen = wb.Sheets["1-RESUMEN"];
  if (!hojaResumen) { console.error("No hay hoja 1-RESUMEN"); process.exit(1); }
  const filasResumen = XLSX.utils.sheet_to_json(hojaResumen, { header: 1, raw: true, defval: "" });

  const hojasIndividuales = wb.SheetNames.filter(n =>
    n !== "1-RESUMEN" && n !== "PROCESO" && n !== "2-MODELO"
  );
  console.log(`     Hojas individuales: ${hojasIndividuales.length}`);

  // ----- 2. Borrar contenido actual -----
  console.log("\n[2/4] Borrando contenido actual de comunidades y pisos ...");
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: "comunidades!A2:BA",
  });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: "pisos!A2:AS",
  });
  console.log("     OK");

  // ----- 3. Construir e importar comunidades -----
  console.log("\n[3/4] Construyendo filas de comunidades ...");
  // Cabeceras (52 cols, hasta AZ). Solo rellenamos las que tenemos del Excel.
  // Resto se queda vacío.
  const filasComunidades = [];
  // Indexar por dirección normalizada para luego cruzar con hojas individuales
  const comusByDir = new Map();
  for (let i = 2; i < filasResumen.length; i++) {
    const r = filasResumen[i];
    if (!r || !r[1]) continue;
    const direccion = texto(r[1]);
    if (!direccion) continue;

    const tipoVia = texto(r[0]);   // A
    const earth   = texto(r[2]);   // C
    const admin   = texto(r[3]);   // D
    const tlfAdm  = texto(r[4]);   // E
    const mlAdm   = texto(r[5]);   // F
    const presi   = texto(r[6]);   // G
    const tlfPre  = texto(r[7]);   // H
    const mlPre   = texto(r[8]);   // I
    const fechas = {
      J: fmtFechaIso(r[9]),
      K: fmtFechaIso(r[10]),
      L: fmtFechaIso(r[11]),
      // M, N, O, P del Excel se ignoran (notas, observaciones libres)
      Q: fmtFechaIso(r[16]),
      R: fmtFechaIso(r[17]),
      S: fmtFechaIso(r[18]),
      T: fmtFechaIso(r[19]),
      U: fmtFechaIso(r[20]),
    };
    const observaciones = texto(r[14]); // O del Excel
    const estadoExcelP  = texto(r[15]); // P del Excel — texto que el usuario manejaba a mano (incluye "ZZ-RECHAZADA")

    // Datos económicos del Excel (mapeo confirmado sesión 04/05/2026):
    //   AB (idx 27) -> tiempo_previsto       (Sheet AE, fila[30])
    //   AC (idx 28) -> tiempo_real           (Sheet AF, fila[31])
    //   AE (idx 30) -> pto_total             (Sheet W,  fila[22])
    //   AF (idx 31) -> mano_obra_previsto    (Sheet X,  fila[23])
    //   AG (idx 32) -> mano_obra_real        (Sheet Y,  fila[24])
    //   AH (idx 33) -> material_previsto     (Sheet Z,  fila[25])
    //   AI (idx 34) -> material_real         (Sheet AA, fila[26])
    // (Los desvíos y beneficios NO se importan: los recalcula el programa.)
    const tiempoPrev      = texto(r[27]);
    const tiempoReal      = texto(r[28]);
    const ptoTotal        = texto(r[30]);
    const manoObraPrev    = texto(r[31]);
    const manoObraReal    = texto(r[32]);
    const materialPrev    = texto(r[33]);
    const materialReal    = texto(r[34]);

    // Calcular fase actual según fechas + col P del Excel (rechazado)
    const fase = calcularFase(fechas, estadoExcelP);

    // Construir fila (53 cols A..BA)
    const fila = new Array(53).fill("");
    fila[0]  = direccion;          // A comunidad
    fila[1]  = direccion;          // B direccion
    fila[2]  = presi;              // C presidente
    fila[3]  = tlfPre;             // D telefono_presidente
    fila[4]  = mlPre;              // E email_presidente
    fila[5]  = "activa";           // F estado_comunidad
    // G fecha_inicio, H fecha_limite_documentacion, I fecha_limite_firma -> vacío
    fila[9]  = observaciones;      // J observaciones
    fila[10] = tipoVia;            // K tipo_via
    fila[11] = earth;              // L earth
    fila[12] = admin;              // M administrador
    fila[13] = tlfAdm;             // N telefono_administrador
    fila[14] = mlAdm;              // O email_administrador
    fila[15] = fase;               // P fase_presupuesto (calculada)
    fila[16] = fechas.J;           // Q fecha_contacto
    fila[17] = fechas.K;           // R fecha_visita
    fila[18] = fechas.L;           // S fecha_envio_pto
    // T fecha_ultimo_seguimiento_pto -> vacío
    // U decision_pto -> vacío
    fila[21] = fechas.Q;           // V fecha_aceptacion_pto
    fila[22] = ptoTotal;           // W  pto_total
    fila[23] = manoObraPrev;       // X  mano_obra_previsto
    fila[24] = manoObraReal;       // Y  mano_obra_real
    fila[25] = materialPrev;       // Z  material_previsto
    fila[26] = materialReal;       // AA material_real
    // AB beneficio_previsto, AC beneficio_real, AD beneficio_desvio -> los calcula el programa
    fila[30] = tiempoPrev;         // AE tiempo_previsto
    fila[31] = tiempoReal;         // AF tiempo_real
    // AG tiempo_desvio -> lo calcula el programa
    // AH notas_pto -> vacío
    // AI mails_enviados, AJ mails_ultimo_envio, AK fecha_proximo_mail_manual,
    // AL fecha_ultimo_reenvio_pto -> vacíos
    fila[38] = fechas.S;           // AM fecha_visita_emasesa
    fila[39] = fechas.R;           // AN fecha_documentacion_completa
    // AO fecha_contratos_pagos_completa -> ya legacy, no rellenar
    // AP modo_documentacion -> vacío (defecto MANUAL)
    // AQ-AY estados manuales CCPP -> se rellenarán abajo desde hojas individuales
    fila[51] = fechas.T;           // AZ fecha_envio_contratos_pagos
    fila[52] = fechas.U;           // BA fecha_cycp_completa (Excel col U; en el modelo viejo era "tramitada", equivalente al cierre actual)

    filasComunidades.push(fila);
    comusByDir.set(normalizarTxt(direccion), { rowIndex: filasComunidades.length + 1, fila });
  }
  console.log(`     ${filasComunidades.length} CCPPs preparados`);

  // ----- 4. Procesar hojas individuales: estados CCPP + pisos -----
  console.log("\n[4/4] Procesando hojas individuales ...");
  const filasPisos = [];
  let estadosCcppRellenados = 0;
  let estadosPisoRellenados = 0;
  let hojasHuerfanas = 0;

  for (const nombreHoja of hojasIndividuales) {
    const ws = wb.Sheets[nombreHoja];
    if (!ws) continue;
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

    // Estados CCPP: posiciones del Excel (1-indexed)
    //   M3 = ccpp_contrato_firmado (idx 0)   -> col M = 13, fila 3 -> filas[2][12]
    //   R3 = ccpp_toma_datos       (idx 1)   -> R = 18 -> filas[2][17]
    //   T3 = ccpp_nif              (idx 2)   -> T = 20 -> filas[2][19]
    //   I4 = ccpp_acta_pte         (idx 3)   -> I = 9  -> filas[3][8]
    //   M4 = ccpp_acta_pto         (idx 4)   -> filas[3][12]
    //   R4 = ccpp_renuncia_gp      (idx 5)   -> filas[3][17]
    //   T4 = ccpp_factura_emasesa  (idx 6)   -> filas[3][19]
    //   U3 = ccpp_contrato         (idx 7)   -> U = 21 -> filas[2][20]
    //   V3 = ccpp_pago             (idx 8)   -> V = 22 -> filas[2][21]
    const estadosCcpp = ["", "", "", "", "", "", "", "", ""];
    if (filas.length >= 4) {
      const f3 = filas[2] || [];
      const f4 = filas[3] || [];
      estadosCcpp[0] = texto(f3[12]);
      estadosCcpp[1] = texto(f3[17]);
      estadosCcpp[2] = texto(f3[19]);
      estadosCcpp[3] = texto(f4[8]);
      estadosCcpp[4] = texto(f4[12]);
      estadosCcpp[5] = texto(f4[17]);
      estadosCcpp[6] = texto(f4[19]);
      estadosCcpp[7] = texto(f3[20]);
      estadosCcpp[8] = texto(f3[21]);
    }
    estadosCcppRellenados += estadosCcpp.filter(e => e).length;

    // Cruzar con la fila de comunidades correspondiente para meter los estados
    const claveComu = normalizarTxt(nombreHoja);
    const matchComu = comusByDir.get(claveComu);
    if (matchComu) {
      // Cols AQ..AY = índices 42..50 dentro de la fila
      for (let k = 0; k < 9; k++) matchComu.fila[42 + k] = estadosCcpp[k];
    } else {
      hojasHuerfanas++;
      console.log(`     ! Hoja sin CCPP en 1-RESUMEN: "${nombreHoja}"`);
    }

    // Pisos: filas 5+ del Excel
    //   B = vivienda (col 2 -> idx 1)
    //   C = telefono (col 3 -> idx 2)
    //   D = nombre   (col 4 -> idx 3)
    //   E = tipo_expediente (col 5 -> idx 4)
    //   F..V = 17 estados manuales del piso (cols 6..22 -> idx 5..21)
    for (let i = 4; i < filas.length; i++) {
      const r = filas[i] || [];
      const vivienda = texto(r[1]);
      if (!vivienda) continue;
      const tlf      = texto(r[2]);
      const nombre   = texto(r[3]);
      const tipoExp  = texto(r[4]);

      // Construir fila de piso (45 cols A..AS)
      const fila = new Array(45).fill("");
      fila[0] = tlf;             // A telefono
      fila[1] = nombreHoja;      // B comunidad (= nombre de la hoja)
      fila[2] = vivienda;        // C vivienda
      fila[3] = nombre;          // D nombre
      fila[4] = tipoExp;         // E tipo_expediente
      fila[5] = "historico";     // F paso_actual (para que el bot lo ignore)
      // G..N campos del bot -> vacíos
      // O documentos_recibidos, P pendientes, etc. -> vacíos
      fila[23] = "si";           // X requiere_intervencion_humana
      // Cols AC-AS = 17 estados manuales (idx 28..44)
      let cnt = 0;
      for (let k = 0; k < 17; k++) {
        const val = texto(r[5 + k]);
        fila[28 + k] = val;
        if (val) cnt++;
      }
      estadosPisoRellenados += cnt;

      filasPisos.push(fila);
    }
  }
  console.log(`     Pisos preparados: ${filasPisos.length}`);
  console.log(`     Estados CCPP rellenados: ${estadosCcppRellenados}`);
  console.log(`     Estados piso rellenados: ${estadosPisoRellenados}`);
  if (hojasHuerfanas) console.log(`     ! Hojas huérfanas: ${hojasHuerfanas}`);

  // ----- 5. Escritura masiva: comunidades -----
  console.log("\nEscribiendo comunidades ...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `comunidades!A2:BA${filasComunidades.length + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: filasComunidades },
  });
  console.log("     OK");

  // ----- 6. Escritura masiva: pisos -----
  console.log("Escribiendo pisos ...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `pisos!A2:AS${filasPisos.length + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: filasPisos },
  });
  console.log("     OK");

  console.log("\n==========================================");
  console.log("RESUMEN");
  console.log("==========================================");
  console.log(`  CCPPs importados:           ${filasComunidades.length}`);
  console.log(`  Pisos importados:           ${filasPisos.length}`);
  console.log(`  Estados CCPP escritos:      ${estadosCcppRellenados}`);
  console.log(`  Estados piso escritos:      ${estadosPisoRellenados}`);
  console.log(`  Hojas huérfanas:            ${hojasHuerfanas}`);
  console.log("\nMigración completada.\n");
})().catch(e => {
  console.error("\n!! ERROR EN MIGRACIÓN !!");
  console.error(e);
  process.exit(1);
});
