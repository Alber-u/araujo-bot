// ============================================================
// Parser de PDFs de visita de obra (exportados desde Excel)
//
// Extrae de un PDF de visita:
//   - tipo_visita: INICIO | SEGUIMIENTO | FINAL  (detectado del título)
//   - obra_nombre: string  (cabecera)
//   - fecha: ISO YYYY-MM-DD  (cabecera, convertido desde DD/MM/YYYY)
//   - filas: [{ nombre, previsto, progreso_pct, certif, real, restante, motivo }]
//     donde nombre = nombre de partida tal como aparece en el PDF
//     (sin matchear todavía contra el catálogo de la obra — eso lo hace el endpoint)
//
// LIMITACIÓN CONOCIDA (MVP): no extrae horas por operario por fila.
// pdf-parse no preserva coordenadas y las columnas de operarios quedan
// fusionadas al final de cada fila como números sin separador. Para
// extraerlas habría que migrar a pdfjs-dist (V2).
// ============================================================
const pdfParse = require("pdf-parse");

const RX_FECHA_HEADER = /([A-ZÁÉÍÓÚÑ0-9 .\-]+?)(\d{2})\/(\d{2})\/(\d{4})/;
const RX_TIPO_FINAL = /\bFINALIZADA\b/i;
const RX_TIPO_INICIO = /\bINICIO\s+DE\s+OBRA\b/i;

// Cabeceras de bloque (capítulos). Filas con estos nombres no son partidas.
const CABECERAS_BLOQUE = [
  "TUBO DE CONEXION",
  "TUBO DE ALIMENTACION",
  "CUARTO DE CONTADORES",
  "MONTANTES",
  "GRUPO DE PRESION",
  "OTROS TIEMPOS",
  "2.6 OTROS TRABAJOS",
  "MANO DE OBRA DE FONTANERIA",
  "HORAS EJECUCION PERSONAL",
];

// Filas que el PDF mete como ruido y no debemos procesar.
const FILAS_IGNORADAS = [
  "TIEMPO PREVISTO",
  "PROGRESO",
  "EJECUTADO SEGÚN",
  "CERTIFICACION",
  "TIEMPO REAL",
  "EMPLEADO",
  "ESTADO",
  "CONTROL",
  "MOTIVO DEL RETRASO",
  "TIEMPO",
  "RESTANTE",
];

function esCabeceraDeBloque(nombre) {
  const n = String(nombre || "").trim().toUpperCase();
  return CABECERAS_BLOQUE.some((c) => n.startsWith(c));
}

function esFilaIgnorada(nombre) {
  const n = String(nombre || "").trim().toUpperCase();
  return FILAS_IGNORADAS.some((c) => n === c || n.startsWith(c + " "));
}

function parseNum(s) {
  if (s == null || s === "") return 0;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------
// Detecta tipo de visita por título del PDF.
// El título aparece arriba (primeras líneas no vacías) antes
// de la cabecera "OBRA + FECHA".
// ------------------------------------------------------------
function detectarTipoVisita(texto) {
  const cabeza = texto.slice(0, 500); // primeras N chars
  if (RX_TIPO_FINAL.test(cabeza)) return "FINAL";
  if (RX_TIPO_INICIO.test(cabeza)) return "INICIO";
  return "SEGUIMIENTO";
}

// ------------------------------------------------------------
// Extrae cabecera "PALMA DEL RIO 1212/05/2026":
//   - nombre obra: "PALMA DEL RIO 12"
//   - fecha:       "12/05/2026" → ISO "2026-05-12"
// ------------------------------------------------------------
function extraerCabecera(texto) {
  // Buscar línea con patrón "NOMBRE_OBRA + DD/MM/YYYY" pegados.
  for (const linea of texto.split("\n")) {
    const m = linea.match(RX_FECHA_HEADER);
    if (!m) continue;
    const obra = m[1].trim();
    const dd = m[2], mm = m[3], yyyy = m[4];
    // Validación básica
    if (!obra || obra.length < 3) continue;
    return {
      obra_nombre: obra,
      fecha_iso: `${yyyy}-${mm}-${dd}`,
      fecha_dmy: `${dd}/${mm}/${yyyy}`,
    };
  }
  return null;
}

// ------------------------------------------------------------
// Parsea una línea de fila de partida.
//
// Formato típico (texto pegado, sin separadores fiables):
//   {nombre}{previsto},{XX}{progreso}%[espacios]{certif},{XX}{real}{restante}[motivo]
//
// Ejemplos reales:
//   "Fontanero (tubo conexión)0,4050%    0,200,1250,082"
//   "Fontanero (PEINE H - H-INT y H-EXT)1,00100%    1,001,4375-0,44 VIGA /FARMACIA12110"
//   "Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)0%    0,0000,00"
//   "Otros tiempos de montaje (especificar)0%0,0000,00"
//
// Estrategia: el separador fiable es "%". Lo localizamos:
//   - Antes del %: nombre + previsto (último número decimal-coma + entero del %)
//   - Después del %: bloque numérico de [certif, real, restante] + motivo opcional
//
// El previsto puede no existir (línea "0%..." sin previsto). Detectamos.
// ------------------------------------------------------------
function parsearFilaPartida(linea) {
  // Previsto en formato Excel = exactamente 2 decimales (\d+,\d{2}).
  // Progreso = entero 0-100. Restringir \d{2} para previsto evita que
  // "1,0075%" se coma como previsto="1,0075" + progreso="5".
  const m = linea.match(/^(.*?)(\d+,\d{2})?(\d+)%\s*(.*)$/);
  if (!m) return null;

  const nombre = m[1].replace(/\s+$/, "");
  const previsto = parseNum(m[2] || "0");
  const progreso_pct = parseInt(m[3], 10);
  let cola = m[4];

  // Cola: "0,200,1250,082" o "1,001,4375-0,44 VIGA /FARMACIA12110"
  // Extraemos los 3 primeros números (certif, real, restante).
  // Real puede tener más decimales que certif (1,4375 vs 0,20).
  // Restante puede ser negativo.
  //
  // Regex permisiva: 3 grupos de número (entero o con coma).
  // Después del 3º grupo, lo que queda hasta un posible número-de-cierre
  // (horas operario aglutinadas) es el motivo (texto libre).
  const rxNum = /(-?\d+(?:,\d+)?)/g;
  const nums = [];
  let mm;
  while ((mm = rxNum.exec(cola)) !== null) {
    nums.push({ valor: parseNum(mm[1]), inicio: mm.index, fin: mm.index + mm[0].length });
    if (nums.length === 3) break;
  }
  if (nums.length < 3) {
    // Fila degenerada (0%, sin datos), guardamos lo posible.
    return {
      nombre,
      previsto,
      progreso_pct,
      certif: nums[0]?.valor ?? 0,
      real: nums[1]?.valor ?? 0,
      restante: nums[2]?.valor ?? 0,
      motivo: "",
    };
  }
  // Motivo: texto entre el final del 3º número y el siguiente número/fin de línea.
  const trasRestante = cola.slice(nums[2].fin);
  // Si hay texto antes de números aglutinados, ese es el motivo.
  const mMotivo = trasRestante.match(/^([^\d]+?)(?=\d|$)/);
  const motivo = mMotivo ? mMotivo[1].trim() : "";

  return {
    nombre,
    previsto,
    progreso_pct,
    certif: nums[0].valor,
    real: nums[1].valor,
    restante: nums[2].valor,
    motivo,
  };
}

// ------------------------------------------------------------
// API principal: dado un Buffer con un PDF de visita, devuelve
// { tipo_visita, obra_nombre, fecha_iso, fecha_dmy, filas }.
// Lanza Error si el PDF no es parseable o falta cabecera.
// ------------------------------------------------------------
async function parsearVisitaPDF(buffer) {
  const out = await pdfParse(buffer);
  const texto = out.text || "";

  const tipo_visita = detectarTipoVisita(texto);
  const cabecera = extraerCabecera(texto);
  if (!cabecera) {
    throw new Error("No se pudo detectar obra + fecha en el PDF (cabecera no encontrada)");
  }

  const filas = [];
  for (const lineaCruda of texto.split("\n")) {
    const linea = lineaCruda.trim();
    if (!linea) continue;
    if (esCabeceraDeBloque(linea)) continue;
    if (esFilaIgnorada(linea)) continue;
    // Solo procesar líneas que tengan al menos un '%' (las filas de partida lo tienen).
    if (!linea.includes("%")) continue;
    const fila = parsearFilaPartida(linea);
    if (!fila) continue;
    // Filtrar nombre vacío o que sea ruido residual.
    if (!fila.nombre || fila.nombre.length < 3) continue;
    filas.push(fila);
  }

  return {
    tipo_visita,
    obra_nombre: cabecera.obra_nombre,
    fecha_iso: cabecera.fecha_iso,
    fecha_dmy: cabecera.fecha_dmy,
    filas,
    aviso: "Horas por operario no se importan automáticamente (limitación de pdf-parse). Deben imputarse manualmente.",
  };
}

// ------------------------------------------------------------
// Fuzzy match: dado un nombre de partida del PDF, lo busca en
// el catálogo de partidas de la obra y devuelve el partida_id
// del mejor match (si la similitud supera el umbral).
//
// Algoritmo: similitud token-set + Levenshtein normalizado, sobre
// strings normalizados (lowercase, sin acentos, sin paréntesis dobles,
// espacios colapsados).
//
// Devuelve { partida_id, nombre_catalogo, score }.
// Si no hay match con score >= UMBRAL_MATCH, devuelve { partida_id: null, score: 0 }.
// ------------------------------------------------------------
const UMBRAL_MATCH = 0.7;

function normalizarNombre(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // sin acentos
    .replace(/[^a-z0-9 ()/+\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const dp = Array(lb + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= lb; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[lb];
}

function similitud(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

function matchPartidaFuzzy(nombrePdf, partidasCatalogo) {
  let mejor = { partida_id: null, nombre_catalogo: null, score: 0 };
  for (const p of partidasCatalogo) {
    const score = similitud(nombrePdf, p.nombre);
    if (score > mejor.score) {
      mejor = { partida_id: p.partida_id, nombre_catalogo: p.nombre, score };
    }
  }
  if (mejor.score < UMBRAL_MATCH) {
    return { partida_id: null, nombre_catalogo: null, score: mejor.score };
  }
  return mejor;
}

module.exports = {
  parsearVisitaPDF,
  matchPartidaFuzzy,
  // Exportados para test:
  detectarTipoVisita,
  extraerCabecera,
  parsearFilaPartida,
  esCabeceraDeBloque,
  esFilaIgnorada,
  similitud,
  normalizarNombre,
};
