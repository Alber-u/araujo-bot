// ============================================================
// Parser de plantillas Excel de visita de obra.
//
// La plantilla "PLANTILLA_PROGRESO_OBRAS_N.xlsx" tiene celdas
// estructuradas — al contrario que el PDF, podemos extraer TODO
// con 100% de fiabilidad incluyendo horas por operario por partida.
//
// Layout esperado (sheet "02_01" o primera hoja):
//   A1            → nombre obra (texto)
//   F1            → fecha (serial Excel)
//   Fila 3        → fila de totales con cabeceras de operarios en L-P
//   L-P (idx 11-15) → cabeceras de operarios (miguel angel, LOLO, MIGUEL H,
//                     ANTONIO, CRISTIAN) en la fila 3
//   Filas 4-N     → partidas y capítulos intercalados
//     A           → nombre partida o capítulo
//     B           → tiempo previsto (h)
//     G           → progreso (0-1 → multiplicar por 100)
//     H           → certif horas
//     I           → real horas
//     J           → restante / estado control
//     K           → motivo retraso (texto)
//     L-P         → horas por operario
//
// Tipo de visita: el .xlsx no lo guarda en celda visible. Se
// deduce por heurística: todas a 0% → INICIO, todas a 100%
// → FINAL, resto → SEGUIMIENTO. El usuario puede sobreescribirlo
// en el preview de la UI.
// ============================================================
const XLSX = require("xlsx");

const CABECERAS_BLOQUE = [
  "TUBO DE CONEXION",
  "TUBO DE ALIMENTACION",
  "CUARTO DE CONTADORES",
  "MONTANTES",
  "GRUPO DE PRESION",
  "OTROS TIEMPOS",
  "2.6 OTROS TRABAJOS",
  "MANO DE OBRA DE FONTANERIA",
];

function esCabecera(s) {
  const n = String(s || "").trim().toUpperCase();
  return CABECERAS_BLOQUE.some((c) => n.startsWith(c));
}

// Excel serial date → ISO YYYY-MM-DD
// Excel epoch = 1899-12-30 (con bug del año 1900).
function serialAIso(serial) {
  if (!serial || typeof serial !== "number") return null;
  const ms = (serial - 25569) * 86400 * 1000; // 25569 = días entre 1900-01-01 y 1970-01-01
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function deducirTipoVisita(filas) {
  const conPrevisto = filas.filter((f) => f.previsto > 0);
  if (conPrevisto.length === 0) return "SEGUIMIENTO";
  const todas100 = conPrevisto.every((f) => f.progreso_pct >= 100);
  const todas0 = conPrevisto.every((f) => f.progreso_pct === 0);
  if (todas100) return "FINAL";
  if (todas0) return "INICIO";
  return "SEGUIMIENTO";
}

function celdaTxt(ws, addr) {
  const c = ws[addr];
  return c ? String(c.v).trim() : "";
}
function celdaNum(ws, addr) {
  const c = ws[addr];
  if (!c) return 0;
  const n = typeof c.v === "number" ? c.v : parseFloat(String(c.v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------
// Encuentra la fila que contiene las cabeceras de operarios.
// Es la primera fila donde las columnas L-P tienen texto
// (nombres de personas, no números).
// ------------------------------------------------------------
function detectarFilaOperarios(ws, range) {
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    const ops = [];
    for (let c = 11; c <= 15; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const val = ws[addr]?.v;
      if (typeof val === "string" && val.trim() && Number.isNaN(parseFloat(val))) {
        ops.push({ idx: c, nombre: val.trim() });
      }
    }
    if (ops.length >= 2) return { fila: r, operarios: ops };
  }
  return null;
}

async function parsearVisitaXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  // Elegir primera hoja con datos
  const sheetName = wb.SheetNames.find((n) => {
    const ws = wb.Sheets[n];
    return ws && ws["!ref"] && ws["A1"];
  }) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"]) throw new Error("Excel sin datos");
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // Cabecera: nombre en A1, fecha (serial Excel) en algún sitio de la fila 1.
  // En la plantilla actual está en G1, pero la posición exacta puede variar:
  // buscamos cualquier celda de la fila 1 que sea un número en rango razonable
  // de fecha (40000..60000 cubre 2009-2064).
  const obra_nombre = celdaTxt(ws, "A1");
  if (!obra_nombre) throw new Error("Falta nombre de obra en A1");

  let fecha_iso = null;
  for (let c = 1; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (!cell) continue;
    if (typeof cell.v === "number" && cell.v >= 40000 && cell.v <= 60000) {
      fecha_iso = serialAIso(cell.v);
      break;
    }
    if (typeof cell.v === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.v)) {
      fecha_iso = cell.v.slice(0, 10);
      break;
    }
  }
  if (!fecha_iso) throw new Error("No se encontró fecha (serial Excel) en la fila 1");

  // Operarios
  const det = detectarFilaOperarios(ws, range);
  if (!det) throw new Error("No se detectaron cabeceras de operarios en columnas L-P");
  const operarios = det.operarios; // [{idx, nombre}, ...]

  // Filas de partida — desde fila después de la cabecera de operarios.
  const filas = [];
  for (let r = det.fila + 1; r <= range.e.r; r++) {
    const nombre = celdaTxt(ws, XLSX.utils.encode_cell({ r, c: 0 }));
    if (!nombre || esCabecera(nombre)) continue;

    const previsto = celdaNum(ws, XLSX.utils.encode_cell({ r, c: 1 }));
    const progreso = celdaNum(ws, XLSX.utils.encode_cell({ r, c: 6 })); // 0-1
    const certif = celdaNum(ws, XLSX.utils.encode_cell({ r, c: 7 }));
    const real = celdaNum(ws, XLSX.utils.encode_cell({ r, c: 8 }));
    const restante = celdaNum(ws, XLSX.utils.encode_cell({ r, c: 9 }));
    const motivo = celdaTxt(ws, XLSX.utils.encode_cell({ r, c: 10 }));

    const horas_por_operario = {};
    for (const op of operarios) {
      const h = celdaNum(ws, XLSX.utils.encode_cell({ r, c: op.idx }));
      if (h > 0) horas_por_operario[op.nombre] = h;
    }

    // Saltar filas vacías (sin previsto, sin progreso, sin horas)
    if (previsto === 0 && progreso === 0 && Object.keys(horas_por_operario).length === 0) continue;

    filas.push({
      nombre,
      previsto,
      progreso_pct: Math.round(progreso * 100),
      certif,
      real,
      restante,
      motivo,
      horas_por_operario,
    });
  }

  return {
    tipo_visita: deducirTipoVisita(filas),
    obra_nombre,
    fecha_iso,
    fecha_dmy: `${fecha_iso.slice(8, 10)}/${fecha_iso.slice(5, 7)}/${fecha_iso.slice(0, 4)}`,
    filas,
    operarios: operarios.map((o) => o.nombre),
  };
}

module.exports = { parsearVisitaXLSX };
