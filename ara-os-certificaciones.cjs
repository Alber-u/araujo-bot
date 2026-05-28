// ============================================================
// ARA OS — Certificaciones de obra (avance presupuesto vs real)
// v0.11.0 — Sprint 18/05/2026
//   · GET /obra/:obra_id/visitas ahora devuelve también `desgloses[]`
//     por visita (horas operario × partida en ese tramo). Permite al
//     frontend construir vistas históricas tipo tabla pivote
//     partida × visita y detectar dónde se quedaron retrasos.
//   · Sin cambios en otros endpoints. Solo lectura.
//
// v0.10.2 — Sprint 18/05/2026
//   · Una visita por día por obra (máximo). Si JM cerró una visita y
//     entra el mismo día al móvil:
//       - /visita-iniciar la REABRE (estado: cerrada → abierta) y
//         devuelve el cuadre existente.
//       - /visita devuelve 409 si ya existe del mismo día.
//     Evita el bug de tramo vacío [hoy → hoy) cuando hay 2+ visitas
//     del mismo día.
//
// v0.10.1 — KPIs ejecutado, estado_control, restante.
// v0.10.0 — Modelo JM-first.
//   · GET /obra/:obra_id ahora devuelve en totales:
//     - ejecutado_horas: suma de ejecutado_segun_cert_horas de todas
//       las partidas (= previsto × progreso%, lo que vale el trabajo
//       certificado a fecha de hoy).
//     - estado_control_horas: ejecutado - real_horas (positivo = vas
//       más adelantado certificando que las horas reales fichadas,
//       negativo = retraso).
//     - restante_horas: previsto - ejecutado.
//   · Replica los KPIs del Excel viejo de Araujo.
//
// v0.10.0 — Modelo JM-first.
//   · CAMBIO CONCEPTUAL: JM hace toda la certificación en obra desde
//     móvil (progresos + reparto de horas operario × partida). Guille
//     solo mira en desktop, no edita.
//   · rangoTramo: ahora `hasta` SIEMPRE es la fecha de la visita actual
//     (exclusivo). Las horas del día de la visita y posteriores caen en
//     el tramo de la siguiente visita. Esto evita que JM dependa de que
//     terminen los fichajes del día para poder certificar.
//   · Nuevo POST /visita/:visita_id/cerrar: JM cierra manualmente.
//   · POST /visita/:id/desglose ya no auto-cierra al cuadrar.
//
// v0.9.1 — Histórico en /visita-abierta.
// v0.9.0 — Modelo tramos.
//   · GET /obra/:obra_id/visita-abierta ahora devuelve también `historico`:
//     suma de horas imputadas por (partida, persona) en visitas ANTERIORES
//     (no la actual). El frontend usa esto para mostrar el acumulado de
//     visitas pasadas en gris (no editable) junto a las celdas editables
//     del tramo actual.
//
// v0.9.0 — Modelo tramos.
//   · CAMBIO DE MODELO: cada visita = corte estanco de certificación.
//     Estado "abierta" (faltan horas por repartir) | "cerrada" (cuadrada).
//     Solo UNA abierta por obra a la vez.
//   · certif_desglose ahora tiene visita_id: cada imputación pertenece
//     a un tramo concreto (no es una pizarra global).
//   · Nuevos helpers: rangoTramo(), registrosDelTramo(), calcularCuadreVisita(),
//     cerrarVisitaSiCuadra().
//   · Nuevo GET /obra/:obra_id/visita-abierta: cuadre completo de la abierta.
//   · POST /obra/:obra_id/visita y /visita-iniciar bloquean si hay otra abierta.
//   · /desglose movido a /visita/:visita_id/desglose. Tras cada UPSERT,
//     intenta cerrar la visita automáticamente.
//   · GET /obras y /obra/:obra_id devuelven visita_abierta_id|fecha.
//
// v0.8.0 — Avance global ponderado + alarma visita 32h.
// v0.7.0 — Fase C móvil JM.
// v0.6.0 — /importar-drive.
// v0.5.0 — DELETE /obra/:obra_id.
// v0.4.0 — UPSERT en /desglose.
// v0.3.x — GET /obras + CORS + locale ES.
// v0.2.x — Reescritura OAuth2.
// v0.1.0 — Parser presupuesto + 4 tablas.
//
// MODELO
//   - Unidad interna: HORAS-PERSONA. Conversión solo para display.
//     1 día/cuadrilla (Excel) = 16 h-persona (2 personas × 8h, estándar).
//     En obra puede haber 2..5 personas: las horas reales se acumulan
//     en horas-persona directamente (sin asumir tamaño de cuadrilla).
//   - Partidas: extraídas del Excel de presupuesto, hoja "Toma de datos",
//     filtro tipo='MO' & cantidad>0, agrupadas por bloque.
//   - Visitas: append-only de JM. Cada visita es una foto del estado de
//     cada partida (5 pasos de progreso: 0/25/50/75/100).
//   - Desglose: imputación operario→partida hecha a posteriori al certificar.
//     El operario solo ficha obra+horas (no partida).
//
// HOJAS (en el Master Sheet, env GOOGLE_SHEETS_ID)
//   - certif_partidas        (presupuesto descompuesto por obra)
//   - certif_visitas         (append-only, una fila por visita)
//   - certif_visita_estado   (append-only, estado partida x visita)
//   - certif_desglose        (imputación horas operario→partida)
//
// ENDPOINTS
//   GET  /api/certificaciones/init                        → crea hojas si faltan
//   POST /api/certificaciones/importar                    → multipart .xlsm + obra_id
//   GET  /api/certificaciones/obra/:obra_id               → vista completa
//   GET  /api/certificaciones/obra/:obra_id/visitas       → historial visitas
//   POST /api/certificaciones/obra/:obra_id/visita        → registra visita + estados
//   POST /api/certificaciones/obra/:obra_id/desglose      → imputa horas op→partida
//   GET  /api/certificaciones/obra/:obra_id/cuadre        → calcula descuadres
//
// require("./ara-os-certificaciones.cjs")(app);
// ============================================================

const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { google } = require("googleapis");
const { parsearVisitaPDF, matchPartidaFuzzy } = require("./lib/visita-pdf-parser.cjs");
const { parsearVisitaXLSX } = require("./lib/visita-xlsx-parser.cjs");
const { calcularChecklistFisico, checklistPermiteFinalizar } = require("./lib/checklist-fisico.cjs");

// Fuzzy match simple persona PDF/XLSX → persona del catálogo.
// Normaliza acentos, lowercase, y compara que el nombre del Excel esté
// contenido en el nombre completo de la persona (o viceversa).
function matchPersonaFuzzy(nombreExcel, personas) {
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const ne = norm(nombreExcel);
  if (!ne) return null;
  for (const p of personas) {
    const np = norm(p.nombre);
    if (np === ne || np.includes(ne) || ne.includes(np)) return p;
    // Match por iniciales (e.g. "MIGUEL H" → "Miguel Hernández ...")
    const partesE = ne.split(/\s+/).filter(Boolean);
    const partesP = np.split(/\s+/).filter(Boolean);
    if (partesE.length >= 2 && partesP.length >= 2) {
      if (partesE[0] === partesP[0] && partesE[1][0] === partesP[1][0]) return p;
    }
  }
  return null;
}

// Fase oficial de "obra terminada físicamente". Ya existe en el catálogo
// de fases de ara-os-holded.cjs (junto a 12_INICIO_OBRA / 13_EN_EJECUCION),
// así que reusamos en lugar de crear "12_FINALIZADA" como pensábamos.
const FASE_FINALIZADA = "14_FINALIZADA";

// ------------------------------------------------------------
// Actualiza la columna fase_presupuesto de una obra en sheet
// `comunidades` (col P, índice 15). Usado por el cierre de obra
// vía certificación final.
//
// Devuelve { ok: true, fase_anterior } o lanza error.
// ------------------------------------------------------------
async function actualizarFaseObra(obra_id, nueva_fase) {
  const sheets = getSheetsClient();
  const filas = await leerHojaSafe("comunidades!A2:P");
  const idx = filas.findIndex((f) => (f[0] || "").trim() === obra_id);
  if (idx < 0) {
    throw new Error(`Obra "${obra_id}" no encontrada en sheet 'comunidades'`);
  }
  const fase_anterior = (filas[idx][15] || "").trim();
  const filaSheet = 2 + idx;
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `comunidades!P${filaSheet}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nueva_fase]] },
  });
  return { ok: true, fase_anterior };
}

// ============================================================
// CONSTANTES
// ============================================================
const DIA_CUADRILLA_HORAS = 16; // 1 día/cuadrilla = 2 personas × 8h (solo display)

// Umbral para alarma "toca visitar": horas reales fichadas desde la última visita.
// Configurable en el futuro por obra (TODO: campo en certif_partidas o tabla aparte).
// 32 = 2 días/cuadrilla — JM debería visitar cada ~2 días de trabajo efectivo.
const UMBRAL_VISITA_HORAS = 32;
const UMBRAL_VISITA_CRITICO_HORAS = 48; // 50% más → bandera roja

const HOJA_PARTIDAS = "certif_partidas";
const HOJA_VISITAS = "certif_visitas";
const HOJA_VISITA_ESTADO = "certif_visita_estado";
const HOJA_DESGLOSE = "certif_desglose";

const PARTIDAS_HEADERS = [
  "partida_id", "obra_id", "bloque", "nombre",
  "tiempo_previsto_dias", "tiempo_previsto_horas", "orden",
  "created_at",
];
const VISITAS_HEADERS = [
  "visita_id", "obra_id", "fecha", "autor",
  "notas_generales", "estado", "tipo_visita", "created_at",
  // estado: "abierta" (faltan horas por repartir) | "cerrada" (todas repartidas)
  // tipo_visita: "INICIO" | "SEGUIMIENTO" | "FINAL"
  //   SEGUIMIENTO es el default (visitas intermedias). INICIO es la primera
  //   (todo a 0%). FINAL marca el cierre de obra → al cerrarse, la obra pasa
  //   a fase 14_FINALIZADA si el checklist físico está OK.
];
const TIPOS_VISITA = new Set(["INICIO", "SEGUIMIENTO", "FINAL"]);
const VISITA_ESTADO_HEADERS = [
  "estado_id", "visita_id", "partida_id",
  "progreso_pct", "motivo_retraso", "created_at",
];
const DESGLOSE_HEADERS = [
  "desglose_id", "visita_id", "obra_id", "partida_id", "persona_id",
  "horas_imputadas", "fecha_imputacion", "imputado_por",
  // visita_id liga cada imputación a una visita = a un tramo concreto.
  // UPSERT key cambió: ahora es (visita_id, partida_id, persona_id), no
  // (obra_id, partida_id, persona_id). Permite acumular horas en distintos
  // tramos para la misma partida×persona.
];

// ============================================================
// PARSER PRESUPUESTO (.xlsm "Toma de datos")
// ============================================================
const CABECERAS_BLOQUE = new Set([
  "TUBO DE CONEXION",
  "TUBO DE ALIMENTACION",
  "CUARTO DE CONTADORES",
  "MONTANTES",
  "GRUPO DE PRESION",
  "OTROS TIEMPOS / TRABAJOS (ESPECIFICADOS ARRIBA)",
]);
const ZONA_INICIO = 100;
const ZONA_FIN = 215;
const COL_NOMBRE = 1;
const COL_CANTIDAD = 3;
const COL_TIPO = 11;

function esCabecera(nombre, tipo) {
  if (!nombre) return false;
  const n = String(nombre).trim().toUpperCase();
  if (tipo && String(tipo).includes("TIT")) return true;
  for (const cab of CABECERAS_BLOQUE) if (n.includes(cab)) return true;
  const base = n.split("(")[0].trim();
  return CABECERAS_BLOQUE.has(base);
}

function normalizaCabecera(nombre) {
  return String(nombre).trim().toUpperCase().split("(")[0].trim();
}

function extraerValor(v) {
  if (v == null) return null;
  if (typeof v === "object") {
    if ("v" in v) return v.v;
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
  }
  return v;
}

async function parsearPresupuesto(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets["Toma de datos"];
  if (!ws) throw new Error("Hoja 'Toma de datos' no encontrada en el Excel");

  // sheet_to_json con header:1 + defval:null nos da una matriz 0-indexada
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const bloques = [];
  let bloqueActual = null;
  let ordenGlobal = 0;

  // Mapeo: Excel R100..R215 (1-indexed) → matriz[99..214]
  const idxInicio = ZONA_INICIO - 1;
  const idxFin = Math.min(ZONA_FIN - 1, matriz.length - 1);

  for (let r = idxInicio; r <= idxFin; r++) {
    const fila = matriz[r] || [];
    const nombre = extraerValor(fila[COL_NOMBRE - 1]);
    const cantidadRaw = extraerValor(fila[COL_CANTIDAD - 1]);
    const tipo = extraerValor(fila[COL_TIPO - 1]);

    if (esCabecera(nombre, tipo)) {
      bloqueActual = { nombre: normalizaCabecera(nombre), partidas: [] };
      bloques.push(bloqueActual);
      continue;
    }

    if (tipo === "MO") {
      if (!bloqueActual) {
        bloqueActual = { nombre: "SIN BLOQUE", partidas: [] };
        bloques.push(bloqueActual);
      }
      const dias = typeof cantidadRaw === "number" ? cantidadRaw : 0;
      ordenGlobal += 1;
      bloqueActual.partidas.push({
        nombre: String(nombre).trim(),
        tiempo_previsto_dias: Math.round(dias * 10000) / 10000,
        tiempo_previsto_horas: Math.round(dias * DIA_CUADRILLA_HORAS * 100) / 100,
        orden: ordenGlobal,
      });
    }
  }
  return bloques;
}

// ============================================================
// CLIENTE SHEETS (mismo patrón que ara-os-registros-tiempo)
// ============================================================
let _sheetsClient = null;
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

function colLetterFromIdx(i) {
  let s = "";
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

async function leerHojaSafe(rango) {
  const MAX_INTENTOS = 3;
  let ultimoError = null;
  for (let i = 0; i < MAX_INTENTOS; i++) {
    try {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: rango,
      });
      return res.data.values || [];
    } catch (err) {
      ultimoError = err;
      const msg = (err && err.message) || "";
      const esRateLimit =
        msg.includes("Quota exceeded") ||
        msg.includes("rateLimitExceeded") ||
        msg.includes("429") ||
        (err && err.code === 429);
      if (!esRateLimit) {
        console.error("[certif/leerHojaSafe] ERROR", rango, msg);
        throw err;
      }
      const esperaMs = 1000 * Math.pow(2, i);
      console.warn(`[certif/leerHojaSafe] rate-limit ${rango}, reintento ${i+1}/${MAX_INTENTOS} en ${esperaMs}ms`);
      await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  console.error("[certif/leerHojaSafe] rate-limit persistente:", rango);
  throw ultimoError || new Error(`Rate limit persistente al leer ${rango}`);
}

function filasAObjetos(filas, headers) {
  return filas.map((f) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = f[i] !== undefined ? f[i] : ""; });
    return o;
  });
}

// Convierte a número manejando:
//   - números nativos
//   - strings con coma decimal (locale ES: "2,15" → 2.15)
//   - strings con punto decimal ("2.15" → 2.15)
//   - vacíos, null, undefined, "" → 0
//   - strings con separador de miles ("1.234,56" → 1234.56)
function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  // Caso "1.234,56" (ES con miles) → quitar puntos, sustituir coma
  if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.indexOf(",") >= 0) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

async function leerTabla(nombre, headers) {
  const lastCol = colLetterFromIdx(headers.length - 1);
  const filas = await leerHojaSafe(`${nombre}!A2:${lastCol}`);
  return filasAObjetos(filas, headers);
}

async function appendTabla(nombre, headers, valuesObjs) {
  if (!valuesObjs || valuesObjs.length === 0) return;
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(headers.length - 1);
  const values = valuesObjs.map((o) => headers.map((h) => (o[h] !== undefined ? o[h] : "")));
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${nombre}!A:${lastCol}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

// ============================================================
// ASEGURAR HOJAS
// ============================================================
let _pestanasOK = false;
async function asegurarPestanas() {
  if (_pestanasOK) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  });
  const existentes = new Set((meta.data.sheets || [])
    .map(s => s.properties && s.properties.title)
    .filter(Boolean));

  async function asegurar(nombre, headers) {
    const lastCol = colLetterFromIdx(headers.length - 1);
    if (!existentes.has(nombre)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: nombre } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${nombre}!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      console.log(`[certif] Tab ${nombre} creada`);
    } else {
      const filaActual = (await leerHojaSafe(`${nombre}!A1:${lastCol}1`))[0] || [];
      const desactualizada = filaActual.length < headers.length ||
        headers.some((h, i) => filaActual[i] !== h);
      if (desactualizada) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${nombre}!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
        console.log(`[certif] Headers de ${nombre} actualizados`);
      }
    }
  }

  await asegurar(HOJA_PARTIDAS, PARTIDAS_HEADERS);
  await asegurar(HOJA_VISITAS, VISITAS_HEADERS);
  await asegurar(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS);
  await asegurar(HOJA_DESGLOSE, DESGLOSE_HEADERS);
  _pestanasOK = true;
}

// ============================================================
// IDS
// ============================================================
function nuevoId(prefijo) {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefijo}_${ts}_${r}`;
}

// ============================================================
// REGISTROS_TIEMPO: agregación horas reales por obra
// ============================================================
const RT_HEADERS = [
  "registro_id", "fecha", "persona_id", "tipo", "obra_id", "horas",
  "motivo", "nota", "source", "created_at", "created_by",
  "updated_at", "updated_by", "borrado",
];
const PERS_HEADERS = [
  "id", "nombre", "dni", "fecha_nacimiento", "puesto", "rol",
  "telefono", "email", "fecha_alta", "fecha_baja", "pin",
  "carpeta_drive", "emergencia_nombre", "emergencia_telefono",
  "iban", "talla_calzado", "talla_pantalon", "talla_camiseta",
  "vehiculo_asignado", "notas", "coste_hora",
];

async function horasRealesPorObra(obra_id) {
  const registros = await leerTabla("registros_tiempo", RT_HEADERS);
  return registros.filter((r) =>
    r.obra_id === obra_id &&
    (r.tipo === "trabajo" || r.tipo === "extra") &&
    String(r.borrado).toUpperCase() !== "TRUE"
  );
}

// Calcula el % de avance ponderado por horas previstas.
// Σ(progreso_pct × previsto_h) / Σ(previsto_h)
//   - partidas: lista de {tiempo_previsto_horas, progreso_pct}
//   - Excluye partidas con previsto<=0 (no tienen peso).
function avancePctPonderado(partidas) {
  let num = 0, den = 0;
  for (const p of partidas) {
    const prev = toNum(p.tiempo_previsto_horas);
    if (prev <= 0) continue;
    const pct = toNum(p.progreso_pct);
    num += pct * prev;
    den += prev;
  }
  if (den === 0) return 0;
  return Math.round((num / den) * 10) / 10; // 1 decimal
}

// Calcula la alarma de visita pendiente para una obra.
//   - registros: registros_tiempo filtrados para esa obra (output de horasRealesPorObra)
//   - ultimaVisitaFecha: ISO string YYYY-MM-DD o null
// Devuelve: { horas_desde_visita, nivel: 'ok'|'pendiente'|'critica' }
function alarmaVisita(registros, ultimaVisitaFecha) {
  // Si no hay visita previa, "horas desde" = todas las horas de la obra
  // Si hay, solo las posteriores (>=) a la fecha de la última visita
  const desde = ultimaVisitaFecha ? String(ultimaVisitaFecha).slice(0, 10) : null;
  let horas = 0;
  for (const r of registros) {
    const fechaR = String(r.fecha || "").slice(0, 10);
    if (!fechaR) continue;
    if (desde && fechaR < desde) continue; // anteriores a la visita: no cuentan
    horas += toNum(r.horas);
  }
  horas = Math.round(horas * 10) / 10;
  let nivel = "ok";
  if (horas >= UMBRAL_VISITA_CRITICO_HORAS) nivel = "critica";
  else if (horas >= UMBRAL_VISITA_HORAS) nivel = "pendiente";
  return {
    horas_desde_visita: horas,
    umbral: UMBRAL_VISITA_HORAS,
    nivel,
  };
}

async function getPersonasMap() {
  const personas = await leerTabla("personas", PERS_HEADERS);
  const map = {};
  for (const p of personas) map[p.id] = p.nombre || p.id;
  return map;
}

// ============================================================
// VISITAS COMO TRAMOS DE CERTIFICACIÓN
// ============================================================
// Cada visita es un corte estanco con dos partes:
//   1. Progresos (% de avance por partida) ← certif_visita_estado
//   2. Reparto de horas reales del tramo entre partidas ← certif_desglose
//
// Estado:
//   "abierta" → todavía hay horas del tramo sin repartir
//   "cerrada" → todas las horas del tramo están en desglose
//
// Tramo = registros_tiempo desde la fecha de la visita anterior (o desde
// el inicio si es la primera) hasta hoy (porque pueden seguir entrando
// fichajes posteriores a la fecha de la visita).
//
// REGLA: solo UNA visita abierta por obra a la vez. No se puede crear
// nueva si hay otra abierta.
// ============================================================

// Ordena visitas por fecha ascendente (la primera de la obra es la primera del array)
function visitasOrdenadas(visitas, obra_id) {
  return visitas
    .filter((v) => v.obra_id === obra_id)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

// Devuelve la visita abierta de una obra o null.
function visitaAbiertaDe(visitas, obra_id) {
  const ordenadas = visitasOrdenadas(visitas, obra_id);
  for (const v of ordenadas) {
    if (String(v.estado || "").toLowerCase() === "abierta") return v;
  }
  return null;
}

// Computa el rango de fechas [desde, hasta] que cubre el tramo de una visita.
//   desde = fecha de la visita anterior (exclusivo, las horas de ese día NO se incluyen)
//   hasta = fecha de la visita actual (exclusivo, las horas de ese día NO se incluyen)
//
// Modelo (v0.10.0): el tramo SIEMPRE termina el día anterior a la visita.
// Las horas del día de la visita y posteriores caen en el siguiente tramo.
// Esto evita que JM tenga que esperar a que terminen los fichajes del día
// para poder certificar.
function rangoTramo(visitas, visita_id) {
  const visitaActual = visitas.find((x) => x.visita_id === visita_id);
  if (!visitaActual) return { desde: null, hasta: null };
  const obra_id = visitaActual.obra_id;
  const ordenadasObra = visitas
    .filter((v) => v.obra_id === obra_id)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const idx = ordenadasObra.findIndex((v) => v.visita_id === visita_id);
  if (idx < 0) return { desde: null, hasta: null };
  const anterior = idx > 0 ? ordenadasObra[idx - 1] : null;
  return {
    desde: anterior ? String(anterior.fecha).slice(0, 10) : null, // exclusivo
    hasta: String(visitaActual.fecha).slice(0, 10),               // exclusivo (00:00 del día de la visita)
  };
}

// Devuelve los registros de tiempo que caen dentro del tramo de una visita.
//   desde EXCLUSIVO (no incluido), hasta EXCLUSIVO (no incluido).
//   Si desde=null → desde el inicio.
//   Si hasta=null → hasta el infinito (hoy).
function registrosDelTramo(registros, obra_id, desde, hasta) {
  return registros.filter((r) => {
    if (r.obra_id !== obra_id) return false;
    if (r.tipo !== "trabajo" && r.tipo !== "extra") return false;
    if (String(r.borrado).toUpperCase() === "TRUE") return false;
    const f = String(r.fecha || "").slice(0, 10);
    if (!f) return false;
    if (desde && f < desde) return false;   // incluye el día de inicio del tramo
    if (hasta && f >= hasta) return false;   // exclusivo hasta (día de la visita actual no incluido)
    return true;
  });
}

// Devuelve {horas_totales, horas_imputadas, horas_pendientes, por_persona[]}
// para una visita concreta.
function calcularCuadreVisita(visita, visitas, registros, desgloses) {
  const obra_id = visita.obra_id;
  const { desde, hasta } = rangoTramo(visitas, visita.visita_id);
  const regs = registrosDelTramo(registros, obra_id, desde, hasta);

  // Horas reales por persona en el tramo
  const realPorPersona = {};
  for (const r of regs) {
    const pid = r.persona_id;
    if (!pid) continue;
    realPorPersona[pid] = (realPorPersona[pid] || 0) + toNum(r.horas);
  }

  // Horas imputadas en esta visita por persona
  const imputadoPorPersona = {};
  for (const d of desgloses) {
    if (d.visita_id !== visita.visita_id) continue;
    const pid = d.persona_id;
    imputadoPorPersona[pid] = (imputadoPorPersona[pid] || 0) + toNum(d.horas_imputadas);
  }

  let totalReal = 0, totalImputado = 0;
  const personas = new Set([...Object.keys(realPorPersona), ...Object.keys(imputadoPorPersona)]);
  const por_persona = [];
  for (const pid of personas) {
    const real = Math.round((realPorPersona[pid] || 0) * 100) / 100;
    const imp = Math.round((imputadoPorPersona[pid] || 0) * 100) / 100;
    totalReal += real;
    totalImputado += imp;
    por_persona.push({
      persona_id: pid,
      horas_reales: real,
      horas_imputadas: imp,
      horas_pendientes: Math.round((real - imp) * 100) / 100,
    });
  }
  totalReal = Math.round(totalReal * 100) / 100;
  totalImputado = Math.round(totalImputado * 100) / 100;
  return {
    desde, hasta,
    horas_totales: totalReal,
    horas_imputadas: totalImputado,
    horas_pendientes: Math.round((totalReal - totalImputado) * 100) / 100,
    por_persona,
  };
}

// Cierra la visita si está cuadrada (todas las horas repartidas).
// Devuelve true si la cerró ahora, false si ya estaba cerrada o sigue abierta.
async function cerrarVisitaSiCuadra(visita_id) {
  const [visitasAll, registros, desgloses] = await Promise.all([
    leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
    leerTabla("registros_tiempo", RT_HEADERS),
    leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
  ]);
  const idx = visitasAll.findIndex((v) => v.visita_id === visita_id);
  if (idx < 0) return false;
  const visita = visitasAll[idx];
  if (String(visita.estado || "").toLowerCase() === "cerrada") return false;

  const cuadre = calcularCuadreVisita(visita, visitasAll, registros, desgloses);
  // Si pendientes son <= 0.01 (errores de redondeo), cuadrada
  if (cuadre.horas_pendientes <= 0.01) {
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(VISITAS_HEADERS.length - 1);
    const filaSheet = 2 + idx;
    const actualizada = { ...visita, estado: "cerrada" };
    const valores = VISITAS_HEADERS.map((h) => actualizada[h] !== undefined ? actualizada[h] : "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${HOJA_VISITAS}!A${filaSheet}:${lastCol}${filaSheet}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [valores] },
    });
    console.log(`[certif] Visita ${visita_id} cerrada (cuadrada)`);
    return true;
  }
  return false;
}

// ============================================================
// DRIVE: buscar y descargar Excel de presupuesto de una obra Plan 5.
// Reutiliza el mismo patrón que ara-os-fase14-presupuesto.cjs:
//   1. La obra está en `comunidades` (col A = comunidad, col B = direccion,
//      col K = tipo_via).
//   2. La carpeta Drive de la obra se llama "${tipo_via} ${direccion}" y
//      vive bajo DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES.
//   3. Dentro, busca subcarpeta "Presupuestos" si existe; si no, raíz.
//   4. Toma el .xlsm/.xlsx más reciente, preferentemente con "Presupuesto"
//      o "Rev-N" en el nombre.
// ============================================================
function getDriveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth });
}

async function buscarObraComunidad(nombreComunidad) {
  // Lee `comunidades!A2:K` (suficiente para nombre, dirección y tipo_via)
  const filas = await leerHojaSafe("comunidades!A2:K");
  for (const row of filas) {
    if (!row[0]) continue;
    if (String(row[0]).trim() === String(nombreComunidad).trim()) {
      return {
        comunidad: row[0] || "",
        direccion: row[1] || "",
        tipo_via: row[10] || "",
      };
    }
  }
  return null;
}

async function buscarExcelEnCarpeta(drive, carpetaId) {
  // Subcarpeta "Presupuestos" si existe
  const sub = await drive.files.list({
    q: `'${carpetaId}' in parents and mimeType='application/vnd.google-apps.folder' and name='Presupuestos' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
  });
  let carpetaBuscar = carpetaId;
  if (sub.data.files && sub.data.files.length > 0) {
    carpetaBuscar = sub.data.files[0].id;
  }
  const files = await drive.files.list({
    q: `'${carpetaBuscar}' in parents and trashed=false and (name contains '.xlsm' or name contains '.xlsx')`,
    fields: "files(id,name,mimeType,size,modifiedTime)",
    pageSize: 20,
    orderBy: "modifiedTime desc",
  });
  if (!files.data.files || files.data.files.length === 0) return null;
  const items = files.data.files;
  const prefer = items.find(f => /presupuesto|rev-?\d+/i.test(f.name));
  return prefer || items[0];
}

async function descargarArchivoDrive(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

// Inserta partidas para una obra a partir de los bloques parseados.
// Devuelve {bloques, partidas_importadas}. NO valida nada — el caller
// hace la validación previa (existencia, borrado, etc.).
async function insertarPartidas(obra_id, bloques) {
  const nowIso = new Date().toISOString();
  const filas = [];
  for (const bloque of bloques) {
    for (const p of bloque.partidas) {
      filas.push({
        partida_id: nuevoId("part"),
        obra_id,
        bloque: bloque.nombre,
        nombre: p.nombre,
        tiempo_previsto_dias: p.tiempo_previsto_dias,
        tiempo_previsto_horas: p.tiempo_previsto_horas,
        orden: p.orden,
        created_at: nowIso,
      });
    }
  }
  if (filas.length > 0) await appendTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS, filas);
  return { bloques: bloques.length, partidas_importadas: filas.length };
}

// Borra todas las partidas existentes de una obra (helper común para
// /importar e /importar-drive). Mantiene atomicidad de "actualizar".
async function borrarPartidasObra(obra_id) {
  const partidasExistentes = await leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS);
  const restantes = partidasExistentes.filter((p) => p.obra_id !== obra_id);
  if (restantes.length === partidasExistentes.length) return 0;
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(PARTIDAS_HEADERS.length - 1);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${HOJA_PARTIDAS}!A2:${lastCol}`,
  });
  if (restantes.length > 0) {
    await appendTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS, restantes);
  }
  return partidasExistentes.length - restantes.length;
}

// ============================================================
// MÓDULO EXPORTADO
// ============================================================
module.exports = function (app) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  // ----------------------------------------------------------
  // Middleware CORS para todas las rutas /api/certificaciones/*
  // Patrón consistente con otros módulos del proyecto (ara-os-acciones,
  // ara-catalogo, etc.). Responde a preflight OPTIONS aquí mismo.
  // ----------------------------------------------------------
  app.use("/api/certificaciones", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin, X-Pin, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/init
  // ----------------------------------------------------------
  app.get("/api/certificaciones/init", async (_req, res) => {
    try {
      await asegurarPestanas();
      res.json({
        ok: true,
        hojas: [HOJA_PARTIDAS, HOJA_VISITAS, HOJA_VISITA_ESTADO, HOJA_DESGLOSE],
      });
    } catch (e) {
      console.error("[certif/init]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/importar
  // multipart: archivo=<.xlsm>, obra_id=<id>
  // ----------------------------------------------------------
  app.post("/api/certificaciones/importar", upload.single("archivo"), async (req, res) => {
    try {
      await asegurarPestanas();
      const { obra_id } = req.body;
      if (!obra_id) return res.status(400).json({ ok: false, error: "Falta obra_id" });
      if (!req.file) return res.status(400).json({ ok: false, error: "Falta archivo" });

      const bloques = await parsearPresupuesto(req.file.buffer);
      await borrarPartidasObra(obra_id);
      const r = await insertarPartidas(obra_id, bloques);
      res.json({ ok: true, obra_id, source: "upload", ...r });
    } catch (e) {
      console.error("[certif/importar]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/importar-drive
  // Body JSON: { obra_id }  → busca el .xlsm en Drive y lo importa.
  // Solo aplica a obras Plan 5 (las únicas con carpeta Drive con presupuesto).
  // ----------------------------------------------------------
  app.post("/api/certificaciones/importar-drive", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const { obra_id } = req.body || {};
      if (!obra_id) return res.status(400).json({ ok: false, error: "Falta obra_id" });

      // 1. Resolver comunidad en hoja `comunidades`
      const obra = await buscarObraComunidad(obra_id);
      if (!obra) {
        return res.status(404).json({
          ok: false,
          error: `Obra "${obra_id}" no encontrada en hoja 'comunidades' (¿es obra Plan 5?)`,
        });
      }

      // 2. Construir nombre de carpeta Drive
      const carpetaNombre = `${obra.tipo_via || ""} ${obra.direccion || ""}`.trim();
      if (!carpetaNombre) {
        return res.status(400).json({
          ok: false,
          error: `La obra "${obra_id}" no tiene tipo_via/direccion en comunidades`,
        });
      }

      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) {
        return res.status(500).json({
          ok: false,
          error: "Falta env DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES",
        });
      }

      // 3. Buscar carpeta Drive
      const drive = getDriveClient();
      const nombreSafe = carpetaNombre.replace(/'/g, "\\'");
      const busq = await drive.files.list({
        q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1,
      });
      if (!busq.data.files || busq.data.files.length === 0) {
        return res.status(404).json({
          ok: false,
          error: `Carpeta '${carpetaNombre}' no encontrada en Drive`,
        });
      }
      const carpetaId = busq.data.files[0].id;

      // 4. Buscar el .xlsm más reciente
      const archivo = await buscarExcelEnCarpeta(drive, carpetaId);
      if (!archivo) {
        return res.status(404).json({
          ok: false,
          error: `No hay .xlsm/.xlsx en la carpeta '${carpetaNombre}'`,
        });
      }

      // 5. Descargar y parsear
      const buf = await descargarArchivoDrive(drive, archivo.id);
      const bloques = await parsearPresupuesto(buf);

      // 6. Reemplazar partidas
      await borrarPartidasObra(obra_id);
      const r = await insertarPartidas(obra_id, bloques);

      res.json({
        ok: true,
        obra_id,
        source: "drive",
        archivo: {
          id: archivo.id,
          nombre: archivo.name,
          modificado: archivo.modifiedTime,
        },
        ...r,
      });
    } catch (e) {
      console.error("[certif/importar-drive]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/obras
  // Lista de obras que tienen presupuesto importado, con KPIs ligeros.
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obras", async (_req, res) => {
    try {
      await asegurarPestanas();
      const [partidasRaw, visitasRaw, estadosRaw, registrosRaw, desglosesRaw] = await Promise.all([
        leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
        leerTabla("registros_tiempo", RT_HEADERS),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
      ]);

      // Filtrar solo trabajo+extra, no borrados — agrupar por obra
      const registrosPorObra = {};
      for (const r of registrosRaw) {
        if (r.tipo !== "trabajo" && r.tipo !== "extra") continue;
        if (String(r.borrado).toUpperCase() === "TRUE") continue;
        if (!registrosPorObra[r.obra_id]) registrosPorObra[r.obra_id] = [];
        registrosPorObra[r.obra_id].push(r);
      }

      // Agrupar partidas por obra_id
      const porObra = {};
      for (const p of partidasRaw) {
        if (!porObra[p.obra_id]) {
          porObra[p.obra_id] = {
            obra_id: p.obra_id,
            partidas_total: 0,
            partidas_activas: 0,
            previsto_horas: 0,
          };
        }
        porObra[p.obra_id].partidas_total += 1;
        const h = toNum(p.tiempo_previsto_horas);
        porObra[p.obra_id].previsto_horas += h;
        if (h > 0) porObra[p.obra_id].partidas_activas += 1;
      }

      // Última visita por obra
      const ultimaPorObra = {};
      for (const v of visitasRaw) {
        const prev = ultimaPorObra[v.obra_id];
        if (!prev || String(v.fecha) > String(prev.fecha)) {
          ultimaPorObra[v.obra_id] = v;
        }
      }

      // Contar visitas por obra
      const visitasPorObra = {};
      for (const v of visitasRaw) {
        visitasPorObra[v.obra_id] = (visitasPorObra[v.obra_id] || 0) + 1;
      }

      // Avance global = media ponderada de progreso × horas previstas (última visita)
      const partidaObraMap = {};
      const partidaPrevMap = {};
      for (const p of partidasRaw) {
        partidaObraMap[p.partida_id] = p.obra_id;
        partidaPrevMap[p.partida_id] = toNum(p.tiempo_previsto_horas);
      }
      const ultimaVisitaIdsPorObra = {};
      for (const [obraId, v] of Object.entries(ultimaPorObra)) {
        ultimaVisitaIdsPorObra[obraId] = v.visita_id;
      }
      const acumPorObra = {};
      for (const e of estadosRaw) {
        const obraId = partidaObraMap[e.partida_id];
        if (!obraId) continue;
        if (ultimaVisitaIdsPorObra[obraId] !== e.visita_id) continue;
        const prevH = partidaPrevMap[e.partida_id] || 0;
        if (prevH <= 0) continue;
        const pct = toNum(e.progreso_pct);
        if (!acumPorObra[obraId]) acumPorObra[obraId] = { sumProg: 0, sumPrev: 0 };
        acumPorObra[obraId].sumProg += (prevH * pct) / 100;
        acumPorObra[obraId].sumPrev += prevH;
      }

      const obras = Object.values(porObra).map((o) => {
        const acum = acumPorObra[o.obra_id];
        const avance = acum && acum.sumPrev > 0
          ? Math.round((acum.sumProg / acum.sumPrev) * 100)
          : 0;
        const ult = ultimaPorObra[o.obra_id];
        const regs = registrosPorObra[o.obra_id] || [];
        const alarma = alarmaVisita(regs, ult ? ult.fecha : null);
        const abierta = visitaAbiertaDe(visitasRaw, o.obra_id);

        // v0.12.1 — Cálculo de retraso por obra (KPI principal):
        //   retraso = horas_certificadas − horas_esperadas
        //   horas_esperadas = previsto_total × (avance / 100)
        //   horas_certificadas = SUM(horas_imputadas) de TODOS los desgloses
        //                       de partidas de esta obra
        //
        // Color (mismo umbral que el KPI "Retraso horas" en la ficha):
        //   rojo   = retraso > +0.5h (vamos lentos)
        //   verde  = retraso < -0.5h (eficientes)
        //   azul   = en línea (entre ±0.5h)
        //   gris   = sin datos (no hay visitas todavía)
        const horasEsperadas = o.previsto_horas * (avance / 100);
        const horasCertificadas = desglosesRaw
          .filter(d => partidaObraMap[d.partida_id] === o.obra_id)
          .reduce((s, d) => s + toNum(d.horas_imputadas), 0);
        const retrasoH = horasCertificadas - horasEsperadas;
        let estadoColor = 'gris';
        if (avance > 0 && o.previsto_horas > 0) {
          if (retrasoH > 0.5) estadoColor = 'rojo';
          else if (retrasoH < -0.5) estadoColor = 'verde';
          else estadoColor = 'azul';
        }

        return {
          obra_id: o.obra_id,
          partidas_total: o.partidas_total,
          partidas_activas: o.partidas_activas,
          previsto_horas: Math.round(o.previsto_horas * 100) / 100,
          previsto_dias: Math.round((o.previsto_horas / DIA_CUADRILLA_HORAS) * 100) / 100,
          total_visitas: visitasPorObra[o.obra_id] || 0,
          ultima_visita_fecha: ult ? ult.fecha : null,
          avance_pct: avance,
          alarma_visita: alarma,
          visita_abierta_id: abierta ? abierta.visita_id : null,
          visita_abierta_fecha: abierta ? abierta.fecha : null,
          // v0.12.1: Retraso y color para la tarjeta
          horas_esperadas: Math.round(horasEsperadas * 100) / 100,
          horas_certificadas: Math.round(horasCertificadas * 100) / 100,
          retraso_horas: Math.round(retrasoH * 100) / 100,
          retraso_dias: Math.round((retrasoH / DIA_CUADRILLA_HORAS) * 100) / 100,
          estado_color: estadoColor, // 'rojo' | 'azul' | 'verde' | 'gris'
        };
      }).sort((a, b) => String(a.obra_id).localeCompare(String(b.obra_id)));

      res.json({ ok: true, obras });
    } catch (e) {
      console.error("[certif/obras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/obra/:obra_id
  // Vista completa: bloques + partidas + última visita + desglose + horas reales
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obra/:obra_id", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);

      const [partidasRaw, visitasRaw, estadosRaw, desgloseRaw, horasReales, personasMap] =
        await Promise.all([
          leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
          leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
          leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
          horasRealesPorObra(obra_id),
          getPersonasMap(),
        ]);

      const partidas = partidasRaw
        .filter((p) => p.obra_id === obra_id)
        .sort((a, b) => toNum(a.orden) - toNum(b.orden));

      const visitas = visitasRaw
        .filter((v) => v.obra_id === obra_id)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const ultimaVisita = visitas[0] || null;

      // v0.11.1 — Para el progreso_pct heredado de cada partida usamos la
      // última visita CERRADA, no la abierta. Si hay una visita abierta
      // vacía (recién creada), no debe pisar el % de la última cerrada.
      const ultimaVisitaCerrada = visitas.find((v) => v.estado === "cerrada") || null;
      const visitaParaHerencia = ultimaVisitaCerrada || ultimaVisita;

      const estadoUltimaVisita = visitaParaHerencia
        ? estadosRaw.filter((e) => e.visita_id === visitaParaHerencia.visita_id)
        : [];
      const estadoMap = {};
      for (const e of estadoUltimaVisita) estadoMap[e.partida_id] = e;

      // estadoAbiertoMap no disponible en este endpoint (sin visita abierta específica)
      const estadoAbiertoMap = {};

      const desglose = desgloseRaw.filter((d) => d.obra_id === obra_id);
      const desgloseMap = {};
      for (const d of desglose) {
        if (!desgloseMap[d.partida_id]) desgloseMap[d.partida_id] = [];
        desgloseMap[d.partida_id].push(d);
      }

      // Horas reales agrupadas por persona
      const horasPorPersona = {};
      for (const r of horasReales) {
        const pid = r.persona_id;
        const h = toNum(r.horas);
        if (!horasPorPersona[pid]) horasPorPersona[pid] = 0;
        horasPorPersona[pid] += h;
      }
      const operariosReales = Object.entries(horasPorPersona).map(([pid, h]) => ({
        persona_id: pid,
        nombre: personasMap[pid] || pid,
        horas_reales: Math.round(h * 100) / 100,
      })).sort((a, b) => b.horas_reales - a.horas_reales);

      // Agrupar partidas por bloque preservando orden
      const bloqueOrden = [];
      const bloques = {};
      let totalEjecutadoSegunCert = 0;
      for (const p of partidas) {
        if (!bloques[p.bloque]) {
          bloques[p.bloque] = { nombre: p.bloque, partidas: [] };
          bloqueOrden.push(p.bloque);
        }
        const estado = estadoMap[p.partida_id];
        const desg = desgloseMap[p.partida_id] || [];
        const horasImputadas = desg.reduce((s, d) => s + toNum(d.horas_imputadas), 0);
        const progreso = estado ? toNum(estado.progreso_pct) : 0;
        const previstoH = toNum(p.tiempo_previsto_horas);
        const ejecutadoSegunCert = (previstoH * progreso) / 100;
        totalEjecutadoSegunCert += ejecutadoSegunCert;
        const previstoD = toNum(p.tiempo_previsto_dias);

        bloques[p.bloque].partidas.push({
          partida_id: p.partida_id,
          nombre: p.nombre,
          orden: toNum(p.orden),
          tiempo_previsto_dias: previstoD,
          tiempo_previsto_horas: previstoH,
          progreso_pct: progreso,
          motivo_retraso: estado ? estado.motivo_retraso || "" : "",
          ejecutado_segun_cert_horas: Math.round(ejecutadoSegunCert * 100) / 100,
          horas_imputadas: Math.round(horasImputadas * 100) / 100,
          desviacion_horas: Math.round((ejecutadoSegunCert - horasImputadas) * 100) / 100,
          desglose_operarios: desg.map((d) => ({
            persona_id: d.persona_id,
            nombre: personasMap[d.persona_id] || d.persona_id,
            horas: toNum(d.horas_imputadas),
            fecha: d.fecha_imputacion,
          })),
        });
      }

      const totalPrevistoH = partidas.reduce((s, p) => s + toNum(p.tiempo_previsto_horas), 0);
      const totalImputado = desglose.reduce((s, d) => s + toNum(d.horas_imputadas), 0);
      const totalRealH = Object.values(horasPorPersona).reduce((s, h) => s + h, 0);

      // v0.11.4 — calcular avancePct ANTES de usarlo en horasEsperadas (fix)
      const partidasParaAvance = [];
      for (const n of bloqueOrden) {
        for (const p of bloques[n].partidas) {
          partidasParaAvance.push({
            tiempo_previsto_horas: p.tiempo_previsto_horas,
            progreso_pct: p.progreso_pct,
          });
        }
      }
      const avancePct = avancePctPonderado(partidasParaAvance);

      // v0.11.4 — RETRASO DE HORAS (renombrado desde "Balance MO").
      //
      // Pregunta: ¿estamos consumiendo MÁS horas certificadas de las que
      // tocaban para el % de obra avanzado?
      //
      // Fórmula:
      //   horas_esperadas = previsto_total × (avance_pct_real / 100)
      //   horas_certificadas = SUM(horas_imputadas) en partidas (excluye
      //       horas fichadas que JM aún no ha repartido en partidas)
      //   retraso_horas = horas_certificadas − horas_esperadas
      //
      //   retraso > 0 → vamos lentos (gastamos más horas que las planificadas)
      //   retraso < 0 → eficientes (gastamos menos)
      //
      // Coherencia: la suma de las desviaciones por partida (columna
      // "desviacion" de la tabla) = -retraso_horas. Si en la tabla las
      // desviaciones suman +20.3h (eficiente), retraso = -20.3h.
      const horasEsperadas = totalPrevistoH * (avancePct / 100);
      const horasCertificadas = totalImputado; // ya calculado arriba
      const retrasoHorasNum = horasCertificadas - horasEsperadas;

      // Ranking de partidas que CONSUMEN MÁS de lo previsto para su % avance
      // Una partida con previsto=10h al 50% → debería llevar 5h. Si lleva 8h
      // imputadas, desviacion=+3h (retraso en esa partida).
      const partidasRanking = [];
      for (const n of bloqueOrden) {
        for (const p of bloques[n].partidas) {
          const horasEsperadasP = p.tiempo_previsto_horas * (p.progreso_pct / 100);
          const desviacionP = p.horas_imputadas - horasEsperadasP;
          if (desviacionP > 0.5 || desviacionP < -0.5) { // umbral 30min
            partidasRanking.push({
              partida_id: p.partida_id,
              nombre: p.nombre,
              bloque: n,
              previsto_horas: p.tiempo_previsto_horas,
              progreso_pct: p.progreso_pct,
              horas_esperadas: Math.round(horasEsperadasP * 100) / 100,
              horas_imputadas: p.horas_imputadas,
              desviacion_horas: Math.round(desviacionP * 100) / 100,
              tipo: desviacionP > 0 ? "retraso" : "eficiente",
            });
          }
        }
      }
      // Ordenar: primero los que más retraso meten, luego eficientes
      partidasRanking.sort((a, b) => b.desviacion_horas - a.desviacion_horas);
      const partidasConRetraso = partidasRanking.filter(p => p.tipo === "retraso");
      const partidasEficientes = partidasRanking.filter(p => p.tipo === "eficiente");

      // v0.11.3 - cálculo viejo del Balance MO (lo dejo para compatibilidad
      // pero ya no se muestra como tal — ahora "retraso_horas" es el KPI).
      // estadoControlH = totalEjecutadoSegunCert − totalRealH_cerradas;
      const ultimaVisitaCerrada_ctrl = visitas.find(v =>
        String(v.estado || "").toLowerCase() === "cerrada"
      );
      let totalRealH_cerradas = 0;
      let horasFueraCorte = 0;
      let fechaCorteCerradas = null;
      if (ultimaVisitaCerrada_ctrl) {
        fechaCorteCerradas = String(ultimaVisitaCerrada_ctrl.fecha).slice(0, 10);
        for (const r of horasReales) {
          const f = String(r.fecha || "").slice(0, 10);
          if (!f) continue;
          if (f <= fechaCorteCerradas) {
            totalRealH_cerradas += toNum(r.horas);
          } else {
            horasFueraCorte += toNum(r.horas);
          }
        }
      }
      totalRealH_cerradas = Math.round(totalRealH_cerradas * 100) / 100;
      horasFueraCorte = Math.round(horasFueraCorte * 100) / 100;
      const abiertaParaControl = visitas.find((v) =>
        String(v.estado || "").toLowerCase() === "abierta"
      );
      const estadoControlH = ultimaVisitaCerrada_ctrl
        ? totalEjecutadoSegunCert - totalRealH_cerradas
        : 0;

      // Avance ponderado por horas previstas:
      // recompongo lista plana de partidas con sus progresos para usar el helper
      const alarma = alarmaVisita(horasReales, ultimaVisita?.fecha);
      const abierta = visitaAbiertaDe(visitas, obra_id);

      res.json({
        ok: true,
        obra_id,
        bloques: bloqueOrden.map((n) => bloques[n]),
        ultima_visita: ultimaVisita,
        total_visitas: visitas.length,
        operarios_reales: operariosReales,
        visita_abierta_id: abierta ? abierta.visita_id : null,
        visita_abierta_fecha: abierta ? abierta.fecha : null,
        totales: {
          // Horas (siguen disponibles para compatibilidad)
          previsto_horas: Math.round(totalPrevistoH * 100) / 100,
          previsto_dias: Math.round((totalPrevistoH / DIA_CUADRILLA_HORAS) * 100) / 100,
          imputado_horas: Math.round(totalImputado * 100) / 100,
          real_horas: Math.round(totalRealH * 100) / 100,
          por_imputar: Math.round((totalRealH - totalImputado) * 100) / 100,
          avance_pct: avancePct,
          ejecutado_horas: Math.round(totalEjecutadoSegunCert * 100) / 100,
          // v0.11.4: RETRASO DE HORAS (KPI principal)
          //   horas_esperadas para el % real avanzado
          //   horas_certificadas = total imputado en partidas
          //   retraso = certificadas − esperadas (POSITIVO = retraso)
          horas_esperadas: Math.round(horasEsperadas * 100) / 100,
          horas_certificadas: Math.round(horasCertificadas * 100) / 100,
          retraso_horas: Math.round(retrasoHorasNum * 100) / 100,
          retraso_dias: Math.round((retrasoHorasNum / DIA_CUADRILLA_HORAS) * 100) / 100,
          // Compat: KPI viejo (estado control con horas fichadas) - dejo por compatibilidad
          estado_control_horas: Math.round(estadoControlH * 100) / 100,
          estado_control_dias: Math.round((estadoControlH / DIA_CUADRILLA_HORAS) * 100) / 100,
          real_horas_cerradas: totalRealH_cerradas,
          real_dias_cerradas: Math.round((totalRealH_cerradas / DIA_CUADRILLA_HORAS) * 100) / 100,
          // Restante
          restante_horas: Math.round((totalPrevistoH - totalEjecutadoSegunCert) * 100) / 100,
          restante_dias: Math.round(((totalPrevistoH - totalEjecutadoSegunCert) / DIA_CUADRILLA_HORAS) * 100) / 100,
          // Equivalentes en DÍAS de cuadrilla (16h)
          ejecutado_dias: Math.round((totalEjecutadoSegunCert / DIA_CUADRILLA_HORAS) * 100) / 100,
          real_dias: Math.round((totalRealH / DIA_CUADRILLA_HORAS) * 100) / 100,
          // v0.11.3: Info de horas sin certificar
          hay_visita_abierta: !!abiertaParaControl,
          hay_horas_sin_certificar: horasFueraCorte > 0.01,
          horas_sin_certificar: horasFueraCorte,
          fecha_corte_cerradas: fechaCorteCerradas,
          horas_tramo_abierto: horasFueraCorte,
        },
        // v0.11.4: Ranking de partidas con desviación significativa
        partidas_con_retraso: partidasConRetraso,
        partidas_eficientes: partidasEficientes,
        alarma_visita: alarma,
      });
    } catch (e) {
      console.error("[certif/obra]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/obra/:obra_id/visitas
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obra/:obra_id/visitas", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      // v0.11.0: añadida lectura de certif_desglose para devolver
      // por visita el reparto horas operario × partida.
      const [visitasRaw, estadosRaw, desglosesRaw] = await Promise.all([
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
      ]);
      const visitas = visitasRaw
        .filter((v) => v.obra_id === obra_id)
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
        .map((v) => ({
          ...v,
          estados:   estadosRaw.filter((e) => e.visita_id === v.visita_id),
          desgloses: desglosesRaw.filter((d) => d.visita_id === v.visita_id),
        }));
      res.json({ ok: true, obra_id, visitas });
    } catch (e) {
      console.error("[certif/visitas]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/obra/:obra_id/visita-abierta
  //
  // Devuelve la visita abierta de una obra con su cuadre completo:
  //   - Datos básicos (id, fecha, autor)
  //   - Progresos por partida ya marcados
  //   - Cuadre: horas del tramo, ya imputadas, pendientes, por persona
  //   - Desglose actual: filas existentes en certif_desglose para esta visita
  //
  // Si no hay visita abierta → 404
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obra/:obra_id/visita-abierta", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const [visitas, estados, registros, desgloses, personasMap] = await Promise.all([
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
        leerTabla("registros_tiempo", RT_HEADERS),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
        getPersonasMap(),
      ]);
      const abierta = visitaAbiertaDe(visitas, obra_id);
      if (!abierta) {
        return res.status(404).json({ ok: false, error: "No hay visita abierta", obra_id });
      }

      const cuadre = calcularCuadreVisita(abierta, visitas, registros, desgloses);
      cuadre.por_persona = cuadre.por_persona.map((p) => ({
        ...p,
        nombre: personasMap[p.persona_id] || p.persona_id,
      })).sort((a, b) => (b.horas_reales || 0) - (a.horas_reales || 0));

      const estadosVisita = estados
        .filter((e) => e.visita_id === abierta.visita_id)
        .map((e) => ({
          partida_id: e.partida_id,
          progreso_pct: toNum(e.progreso_pct),
          motivo_retraso: e.motivo_retraso || "",
        }));

      const desgloseVisita = desgloses
        .filter((d) => d.visita_id === abierta.visita_id)
        .map((d) => ({
          partida_id: d.partida_id,
          persona_id: d.persona_id,
          nombre: personasMap[d.persona_id] || d.persona_id,
          horas: toNum(d.horas_imputadas),
        }));

      // Histórico: desglose acumulado de visitas anteriores (no esta)
      // Estructura: [{ partida_id, persona_id, horas }] con la SUMA de todas
      // las visitas que NO son la abierta actual.
      const historicoMap = {}; // `${partida_id}|${persona_id}` → horas
      for (const d of desgloses) {
        if (d.obra_id !== obra_id) continue;
        if (d.visita_id === abierta.visita_id) continue;
        const k = `${d.partida_id}|${d.persona_id}`;
        historicoMap[k] = (historicoMap[k] || 0) + toNum(d.horas_imputadas);
      }
      const historico = Object.entries(historicoMap).map(([k, horas]) => {
        const [partida_id, persona_id] = k.split("|");
        return {
          partida_id,
          persona_id,
          nombre: personasMap[persona_id] || persona_id,
          horas: Math.round(horas * 100) / 100,
        };
      });

      // v0.11.0 — Stats por partida: acumulado histórico + esta visita,
      //           restante, % cert acumulado, % cert con esta visita.
      // Necesitamos las partidas de la obra para conocer tiempo_previsto_horas.
      const partidas = await leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS);
      const partidasObra = partidas.filter(p => p.obra_id === obra_id);

      // pct_cert histórico: última visita cerrada antes de la abierta
      const visitasObra = visitas.filter(v => v.obra_id === obra_id).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)));
      const ultimaCerrada = visitasObra.find(v => v.estado === 'cerrada' && v.visita_id !== abierta.visita_id) || null;
      const estadoMap = {};
      if (ultimaCerrada) {
        for (const e of estados.filter(e => e.visita_id === ultimaCerrada.visita_id)) {
          estadoMap[e.partida_id] = e;
        }
      }
      const estadoAbiertoMap = {};
      for (const e of estados.filter(e => e.visita_id === abierta.visita_id)) {
        estadoAbiertoMap[e.partida_id] = e;
      }

      // Acumulados por partida (todas las visitas, incluida la abierta)
      const horasPorPartidaTodas = {};
      // Acumulados por partida (solo visitas anteriores, NO la abierta)
      const horasPorPartidaHist = {};
      for (const d of desgloses) {
        if (d.obra_id !== obra_id) continue;
        const h = toNum(d.horas_imputadas);
        horasPorPartidaTodas[d.partida_id] = (horasPorPartidaTodas[d.partida_id] || 0) + h;
        if (d.visita_id !== abierta.visita_id) {
          horasPorPartidaHist[d.partida_id] = (horasPorPartidaHist[d.partida_id] || 0) + h;
        }
      }

      const por_partida = partidasObra.map(p => {
        const previsto = toNum(p.tiempo_previsto_horas);
        const acumTodas = Math.round((horasPorPartidaTodas[p.partida_id] || 0) * 100) / 100;
        const acumHist = Math.round((horasPorPartidaHist[p.partida_id] || 0) * 100) / 100;
        const enEstaVisita = Math.round((acumTodas - acumHist) * 100) / 100;
        const restante = Math.round((previsto - acumTodas) * 100) / 100;
        const pctHist = previsto > 0 ? Math.round((acumHist / previsto) * 1000) / 10 : 0;
        const pctTodas = previsto > 0 ? Math.round((acumTodas / previsto) * 1000) / 10 : 0;
        const pctCertHist    = toNum(estadoMap[p.partida_id]?.progreso_pct) || 0;
        const pctCertActual  = toNum(estadoAbiertoMap[p.partida_id]?.progreso_pct) || pctCertHist;
        return {
          partida_id: p.partida_id,
          previsto_horas: previsto,
          horas_acumuladas_hist: acumHist,
          horas_en_esta_visita: enEstaVisita,
          horas_acumuladas_total: acumTodas,
          horas_restantes: restante,
          pct_acumulado_hist: pctHist,
          pct_acumulado_total: pctTodas,
          pct_cert_hist:   pctCertHist,
          pct_cert_actual: pctCertActual,
          pct_cert_nuevo:  pctCertActual - pctCertHist,
        };
      });

      // Resumen obra (suma de horas previstas, imputadas, restantes)
      const obra_resumen = por_partida.reduce((acc, p) => {
        acc.previsto_horas += p.previsto_horas;
        acc.horas_acumuladas_total += p.horas_acumuladas_total;
        acc.horas_restantes += p.horas_restantes;
        return acc;
      }, { previsto_horas: 0, horas_acumuladas_total: 0, horas_restantes: 0 });
      obra_resumen.previsto_horas = Math.round(obra_resumen.previsto_horas * 100) / 100;
      obra_resumen.horas_acumuladas_total = Math.round(obra_resumen.horas_acumuladas_total * 100) / 100;
      obra_resumen.horas_restantes = Math.round(obra_resumen.horas_restantes * 100) / 100;
      obra_resumen.pct_acumulado_total = obra_resumen.previsto_horas > 0
        ? Math.round((obra_resumen.horas_acumuladas_total / obra_resumen.previsto_horas) * 1000) / 10
        : 0;

      res.json({
        ok: true,
        visita_id: abierta.visita_id,
        obra_id: abierta.obra_id,
        fecha: abierta.fecha,
        autor: abierta.autor,
        notas_generales: abierta.notas_generales || "",
        estado: "abierta",
        progresos: estadosVisita,
        cuadre,
        desglose: desgloseVisita,
        historico,
        por_partida,       // v0.11.0
        obra_resumen,      // v0.11.0
      });
    } catch (e) {
      console.error("[certif/visita-abierta]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // v0.12.0 — GET /api/certificaciones/partida/:partida_id/diagnostico
  // Para una partida concreta, devuelve la cronología de TODAS sus
  // visitas con:
  //   - Progreso% en esa visita (snapshot)
  //   - Horas esperadas para ese progreso (previsto × progreso/100)
  //   - Horas imputadas EN ESA VISITA
  //   - Horas imputadas ACUMULADAS hasta esa visita
  //   - Desviación acumulada (imputado_acumulado − esperado_acumulado)
  //   - Operarios imputados a la partida en esa visita (de desgloses)
  //   - Operarios que ficharon en obra durante el tramo de la visita
  //     (de registros_tiempo, aunque no estén imputados a la partida)
  //   - motivo_retraso anotado en esa visita
  // ----------------------------------------------------------
  app.get("/api/certificaciones/partida/:partida_id/diagnostico", async (req, res) => {
    try {
      await asegurarPestanas();
      const partida_id = decodeURIComponent(req.params.partida_id);

      const [partidasRaw, visitasRaw, estadosRaw, desglosesRaw, registros, personasMap] =
        await Promise.all([
          leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
          leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
          leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
          leerTabla("registros_tiempo", RT_HEADERS),
          getPersonasMap(),
        ]);

      const partida = partidasRaw.find(p => p.partida_id === partida_id);
      if (!partida) {
        return res.status(404).json({ ok: false, error: "Partida no encontrada" });
      }

      const obra_id = partida.obra_id;
      const previstoH = toNum(partida.tiempo_previsto_horas);

      // Visitas de la obra ordenadas ASC por fecha (cronología natural)
      const visitas = visitasRaw
        .filter(v => v.obra_id === obra_id)
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

      // Construir cronología visita a visita
      const cronologia = [];
      let horasImputadasAcum = 0;

      for (const v of visitas) {
        // Progreso registrado en esta visita para esta partida
        const estado = estadosRaw.find(e => e.visita_id === v.visita_id && e.partida_id === partida_id);
        const progresoPct = estado ? toNum(estado.progreso_pct) : null;
        const motivoRetraso = estado ? (estado.motivo_retraso || "") : "";

        // Desgloses (reparto operario × partida) DE ESTA VISITA
        const desglosesVisita = desglosesRaw.filter(d =>
          d.visita_id === v.visita_id && d.partida_id === partida_id
        );
        const horasEnVisita = desglosesVisita.reduce((s, d) => s + toNum(d.horas_imputadas), 0);
        horasImputadasAcum += horasEnVisita;

        const operariosImputados = desglosesVisita
          .filter(d => toNum(d.horas_imputadas) > 0)
          .map(d => ({
            persona_id: d.persona_id,
            nombre: personasMap[d.persona_id] || d.persona_id,
            horas: toNum(d.horas_imputadas),
          }))
          .sort((a, b) => b.horas - a.horas);

        // Operarios que ficharon en obra durante el tramo de esta visita
        const { desde, hasta } = rangoTramo(visitas, v.visita_id);
        const regsTramo = registros.filter(r => {
          if (r.obra_id !== obra_id) return false;
          if (r.tipo !== "trabajo" && r.tipo !== "extra") return false;
          if (String(r.borrado).toUpperCase() === "TRUE") return false;
          const f = String(r.fecha || "").slice(0, 10);
          if (!f) return false;
          if (desde && f <= desde) return false;
          if (hasta && f >= hasta) return false;
          return true;
        });
        // Suma horas fichadas por persona en el tramo
        const fichadasPorPersona = {};
        for (const r of regsTramo) {
          const pid = r.persona_id;
          if (!pid) continue;
          fichadasPorPersona[pid] = (fichadasPorPersona[pid] || 0) + toNum(r.horas);
        }
        const operariosFichadosEnObra = Object.entries(fichadasPorPersona)
          .map(([pid, h]) => ({
            persona_id: pid,
            nombre: personasMap[pid] || pid,
            horas_fichadas: Math.round(h * 100) / 100,
            horas_imputadas_partida: Math.round(
              (desglosesVisita.find(d => d.persona_id === pid)?.horas_imputadas || 0) * 100
            ) / 100,
          }))
          .sort((a, b) => b.horas_fichadas - a.horas_fichadas);

        // Horas esperadas para el progreso registrado en ESTA visita
        const horasEsperadasAcum = progresoPct !== null
          ? Math.round(previstoH * (progresoPct / 100) * 100) / 100
          : null;
        // Desviación acumulada a fin de esta visita
        const desviacionAcum = progresoPct !== null
          ? Math.round((horasImputadasAcum - horasEsperadasAcum) * 100) / 100
          : null;

        cronologia.push({
          visita_id: v.visita_id,
          fecha: v.fecha,
          autor: v.autor,
          estado: v.estado,
          notas_generales: v.notas_generales || "",
          tramo_desde: desde,
          tramo_hasta: hasta,
          progreso_pct: progresoPct,
          motivo_retraso: motivoRetraso,
          horas_en_visita: Math.round(horasEnVisita * 100) / 100,
          horas_imputadas_acum: Math.round(horasImputadasAcum * 100) / 100,
          horas_esperadas_acum: horasEsperadasAcum,
          desviacion_acum: desviacionAcum,
          operarios_imputados: operariosImputados,
          operarios_fichados_en_obra: operariosFichadosEnObra,
        });
      }

      // Estado actual de la partida (foto final)
      const progresoActual = cronologia.length > 0
        ? cronologia[cronologia.length - 1].progreso_pct
        : null;
      const horasEsperadasFinal = progresoActual !== null
        ? Math.round(previstoH * (progresoActual / 100) * 100) / 100
        : null;

      res.json({
        ok: true,
        partida: {
          partida_id: partida.partida_id,
          obra_id: partida.obra_id,
          nombre: partida.nombre,
          bloque: partida.bloque,
          tiempo_previsto_horas: previstoH,
          tiempo_previsto_dias: toNum(partida.tiempo_previsto_dias),
          progreso_actual: progresoActual,
          horas_imputadas_total: Math.round(horasImputadasAcum * 100) / 100,
          horas_esperadas_total: horasEsperadasFinal,
          desviacion_total: progresoActual !== null
            ? Math.round((horasImputadasAcum - horasEsperadasFinal) * 100) / 100
            : null,
        },
        cronologia,
      });
    } catch (e) {
      console.error("[certif/diagnostico-partida]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // v0.13.0 — GET /api/certificaciones/operarios/ranking
  // Ranking global de operarios cruzando 3 métricas:
  //   A) Eficiencia de imputación:
  //      Para cada partida donde el operario imputó horas:
  //        cuota = horas_imputadas_op × (horas_esperadas_partida /
  //                                      horas_imputadas_total_partida)
  //        desviacion = horas_imputadas_op − cuota
  //      Suma de desviaciones de TODAS las partidas donde trabajó.
  //      Negativo = eficiente (avanzó más con menos). Positivo = retraso.
  //   B) No imputado (horas fichadas SIN repartir a partidas):
  //      horas_fichadas_total − horas_imputadas_total
  //   C) Ratio de visitas donde la obra quedó en retraso:
  //      visitas con desviacion_acum > 0 / total visitas donde participó
  //
  // También: desglose por obra para drill-down.
  // ----------------------------------------------------------
  app.get("/api/certificaciones/operarios/ranking", async (_req, res) => {
    try {
      await asegurarPestanas();
      const [partidasRaw, visitasRaw, estadosRaw, desglosesRaw, registros, personasMap] =
        await Promise.all([
          leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
          leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
          leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
          leerTabla("registros_tiempo", RT_HEADERS),
          getPersonasMap(),
        ]);

      // Índice rápido: partida_id → partida
      const partidaIdx = {};
      for (const p of partidasRaw) {
        partidaIdx[p.partida_id] = {
          partida_id: p.partida_id,
          obra_id: p.obra_id,
          nombre: p.nombre,
          previsto_h: toNum(p.tiempo_previsto_horas),
        };
      }
      // Índice rápido: visita_id → visita
      const visitaIdx = {};
      for (const v of visitasRaw) {
        visitaIdx[v.visita_id] = v;
      }
      // Estado actual de cada partida (últimos % por visita más reciente)
      // Para A) calculamos horas_esperadas_partida usando el progreso final
      // de la partida (suma de todos los estados a fecha de hoy).
      // Más simple: usar el % más alto registrado (que es el progreso actual).
      const progresoActualPartida = {};
      for (const e of estadosRaw) {
        const v = visitaIdx[e.visita_id];
        if (!v) continue;
        const key = e.partida_id;
        const fechaActual = String(v.fecha || "");
        const prev = progresoActualPartida[key];
        if (!prev || String(prev.fecha) < fechaActual) {
          progresoActualPartida[key] = {
            fecha: fechaActual,
            progreso_pct: toNum(e.progreso_pct),
          };
        }
      }

      // ── A) Eficiencia de imputación ──
      // Por partida: sum_imputado_partida = SUM(desgloses.horas) en ESA partida
      const sumImpPorPartida = {};
      for (const d of desglosesRaw) {
        const k = d.partida_id;
        sumImpPorPartida[k] = (sumImpPorPartida[k] || 0) + toNum(d.horas_imputadas);
      }

      // Acumular por operario × obra
      // operariosObras[persona_id][obra_id] = {
      //   horas_imputadas, desviacion_a, horas_fichadas,
      //   visitas_set (Set), visitas_con_retraso_set (Set),
      // }
      const operariosObras = {};
      function getOpObra(persona_id, obra_id) {
        if (!operariosObras[persona_id]) operariosObras[persona_id] = {};
        if (!operariosObras[persona_id][obra_id]) {
          operariosObras[persona_id][obra_id] = {
            horas_imputadas: 0,
            desviacion_a: 0,
            horas_fichadas: 0,
            visitas: new Set(),
            visitas_con_retraso: new Set(),
          };
        }
        return operariosObras[persona_id][obra_id];
      }

      // Procesar desgloses (métrica A)
      for (const d of desglosesRaw) {
        const persona_id = d.persona_id;
        const partida = partidaIdx[d.partida_id];
        if (!persona_id || !partida) continue;
        const obra_id = partida.obra_id;
        const horasOp = toNum(d.horas_imputadas);
        if (horasOp <= 0) continue;
        const progActual = progresoActualPartida[d.partida_id]?.progreso_pct || 0;
        const esperadasPartida = partida.previsto_h * (progActual / 100);
        const totalImputadoPartida = sumImpPorPartida[d.partida_id] || 0;
        const cuota = totalImputadoPartida > 0
          ? horasOp * (esperadasPartida / totalImputadoPartida)
          : 0;
        const desviacion = horasOp - cuota;
        const slot = getOpObra(persona_id, obra_id);
        slot.horas_imputadas += horasOp;
        slot.desviacion_a += desviacion;
        slot.visitas.add(d.visita_id);
      }

      // Procesar fichajes (métrica B y agregar visitas asociadas)
      for (const r of registros) {
        const persona_id = r.persona_id;
        const obra_id = r.obra_id;
        if (!persona_id || !obra_id) continue;
        if (r.tipo !== "trabajo" && r.tipo !== "extra") continue;
        if (String(r.borrado).toUpperCase() === "TRUE") continue;
        const slot = getOpObra(persona_id, obra_id);
        slot.horas_fichadas += toNum(r.horas);
      }

      // Para métrica C: por cada visita, calcular desviacion_acum de la obra
      // hasta esa fecha. Si > 0 → la obra acabó en retraso tras esa visita.
      // Lo precalculamos por obra para todas sus visitas (orden ASC fecha).
      const obraVisitasRetraso = {}; // { obra_id: { visita_id: bool } }
      const obraIds = [...new Set(partidasRaw.map(p => p.obra_id))];
      for (const obra_id of obraIds) {
        const visitasObra = visitasRaw
          .filter(v => v.obra_id === obra_id)
          .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
        if (visitasObra.length === 0) continue;
        const partidasObra = partidasRaw.filter(p => p.obra_id === obra_id);
        const prevTotal = partidasObra.reduce((s, p) => s + toNum(p.tiempo_previsto_horas), 0);
        const partidaPrevMap = {};
        for (const p of partidasObra) partidaPrevMap[p.partida_id] = toNum(p.tiempo_previsto_horas);

        obraVisitasRetraso[obra_id] = {};
        // Acumulado por partida progreso×visita
        let acumImpHasta = 0;
        for (const v of visitasObra) {
          // Imputado hasta esta visita (inclusive)
          const impHastaAhora = desglosesRaw
            .filter(d => {
              const part = partidaIdx[d.partida_id];
              if (!part || part.obra_id !== obra_id) return false;
              const vis = visitaIdx[d.visita_id];
              if (!vis) return false;
              return String(vis.fecha) <= String(v.fecha);
            })
            .reduce((s, d) => s + toNum(d.horas_imputadas), 0);

          // Avance ponderado hasta esta visita
          const estadosAcum = estadosRaw
            .filter(e => {
              const vis = visitaIdx[e.visita_id];
              if (!vis || vis.obra_id !== obra_id) return false;
              return String(vis.fecha) <= String(v.fecha);
            });
          // Última progreso_pct por partida hasta esa fecha
          const ultProgPorPart = {};
          for (const e of estadosAcum) {
            const vis = visitaIdx[e.visita_id];
            const f = String(vis.fecha);
            const prev = ultProgPorPart[e.partida_id];
            if (!prev || prev.fecha < f) {
              ultProgPorPart[e.partida_id] = { fecha: f, pct: toNum(e.progreso_pct) };
            }
          }
          let sumProg = 0, sumPrev = 0;
          for (const pid of Object.keys(partidaPrevMap)) {
            const prev = partidaPrevMap[pid];
            const pct = ultProgPorPart[pid]?.pct || 0;
            sumProg += prev * pct;
            sumPrev += prev;
          }
          const avancePct = sumPrev > 0 ? (sumProg / sumPrev) : 0;
          const esperadasObra = prevTotal * (avancePct / 100);
          const desviacionAcum = impHastaAhora - esperadasObra;
          obraVisitasRetraso[obra_id][v.visita_id] = desviacionAcum > 0.5;
        }
      }

      // Acumular visitas con retraso por operario × obra
      for (const persona_id of Object.keys(operariosObras)) {
        for (const obra_id of Object.keys(operariosObras[persona_id])) {
          const slot = operariosObras[persona_id][obra_id];
          for (const vid of slot.visitas) {
            if (obraVisitasRetraso[obra_id]?.[vid]) {
              slot.visitas_con_retraso.add(vid);
            }
          }
        }
      }

      // Componer ranking final
      const ranking = [];
      for (const persona_id of Object.keys(operariosObras)) {
        const obras = operariosObras[persona_id];
        let totalImp = 0, totalDesvA = 0, totalFich = 0, totalVis = 0, totalVisRetraso = 0;
        const desgloseObras = [];
        for (const obra_id of Object.keys(obras)) {
          const o = obras[obra_id];
          totalImp += o.horas_imputadas;
          totalDesvA += o.desviacion_a;
          totalFich += o.horas_fichadas;
          totalVis += o.visitas.size;
          totalVisRetraso += o.visitas_con_retraso.size;
          desgloseObras.push({
            obra_id,
            horas_imputadas: Math.round(o.horas_imputadas * 100) / 100,
            horas_fichadas: Math.round(o.horas_fichadas * 100) / 100,
            desviacion_a: Math.round(o.desviacion_a * 100) / 100,
            no_imputado_b: Math.round((o.horas_fichadas - o.horas_imputadas) * 100) / 100,
            visitas_total: o.visitas.size,
            visitas_con_retraso: o.visitas_con_retraso.size,
            ratio_retraso_c: o.visitas.size > 0
              ? Math.round((o.visitas_con_retraso.size / o.visitas.size) * 100)
              : 0,
          });
        }
        desgloseObras.sort((a, b) => Math.abs(b.desviacion_a) - Math.abs(a.desviacion_a));
        // Tendencia: combinar A normalizado, B y C
        // - A_norm = desv_a / horas_imp (porcentaje)
        // - score = ponderación simple para clasificar
        const aNorm = totalImp > 0 ? totalDesvA / totalImp : 0;
        const ratioC = totalVis > 0 ? totalVisRetraso / totalVis : 0;
        const noImpB = totalFich - totalImp;
        // Score global (más bajo = mejor):
        //   pondera A (50%), B (20%), C (30%)
        const score = (aNorm * 50) + (noImpB / Math.max(totalFich, 1)) * 20 + (ratioC * 30);
        let tendencia = '🔵';
        if (totalImp > 1) {
          if (score > 8) tendencia = '🔴';
          else if (score < -3) tendencia = '🟢';
        }

        ranking.push({
          persona_id,
          nombre: personasMap[persona_id] || persona_id,
          // Métrica A: eficiencia de imputación
          desviacion_a_horas: Math.round(totalDesvA * 100) / 100,
          // Métrica B: no imputado
          no_imputado_b_horas: Math.round(noImpB * 100) / 100,
          // Métrica C: ratio retraso
          visitas_total: totalVis,
          visitas_con_retraso: totalVisRetraso,
          ratio_retraso_c_pct: totalVis > 0 ? Math.round(ratioC * 100) : 0,
          // Totales
          horas_imputadas_total: Math.round(totalImp * 100) / 100,
          horas_fichadas_total: Math.round(totalFich * 100) / 100,
          obras_total: desgloseObras.length,
          tendencia,
          score: Math.round(score * 100) / 100,
          // Desglose por obra
          obras: desgloseObras,
        });
      }
      // Ordenar: peores (rojos) arriba, neutros, mejores (verdes) abajo
      // dentro de cada grupo por score descendente (más score = peor)
      const orden = { '🔴': 0, '🔵': 1, '🟢': 2 };
      ranking.sort((a, b) => {
        const t = (orden[a.tendencia] ?? 1) - (orden[b.tendencia] ?? 1);
        if (t !== 0) return t;
        return b.score - a.score;
      });

      res.json({
        ok: true,
        ranking,
        total_operarios: ranking.length,
        notas: {
          metrica_a: "Eficiencia de imputación. Negativo = gasta menos horas de las esperadas para el % avanzado de las partidas (eficiente).",
          metrica_b: "Horas fichadas no imputadas a partidas. Alto = el JM no ha repartido sus horas.",
          metrica_c: "% de visitas donde la obra quedó en retraso tras esa visita.",
          tendencia: "🟢 mejor, 🔵 neutro, 🔴 peor (basado en score combinado).",
        },
      });
    } catch (e) {
      console.error("[certif/operarios-ranking]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // v0.11.0 — GET /api/certificaciones/visita/:visita_id/debug
  // Endpoint de auditoría para investigar descuadres de horas.
  // ----------------------------------------------------------
  app.get("/api/certificaciones/visita/:visita_id/debug", async (req, res) => {
    try {
      await asegurarPestanas();
      const visita_id = decodeURIComponent(req.params.visita_id);
      const [visitas, registros, desgloses, partidas, personasMap] = await Promise.all([
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla("registros_tiempo", RT_HEADERS),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
        leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
        getPersonasMap(),
      ]);
      const visita = visitas.find(v => v.visita_id === visita_id);
      if (!visita) return res.status(404).json({ ok: false, error: "Visita no encontrada" });

      const obra_id = visita.obra_id;
      const visitasObra = visitas.filter(v => v.obra_id === obra_id);
      const { desde, hasta } = rangoTramo(visitasObra, visita_id);
      const regsTramo = registrosDelTramo(registros, obra_id, desde, hasta);
      const partidasObra = partidas.filter(p => p.obra_id === obra_id);
      const partidasMap = Object.fromEntries(partidasObra.map(p => [p.partida_id, p]));

      const desglosesEstaVisita = desgloses
        .filter(d => d.visita_id === visita_id)
        .map(d => {
          const part = partidasMap[d.partida_id];
          return {
            partida_id: d.partida_id,
            partida_nombre: part ? part.nombre : "(NO ENCONTRADA)",
            partida_previsto_horas: part ? toNum(part.tiempo_previsto_horas) : null,
            persona_id: d.persona_id,
            persona_nombre: personasMap[d.persona_id] || d.persona_id,
            horas_imputadas: toNum(d.horas_imputadas),
            fecha_imputacion: d.fecha_imputacion || null,
            imputado_por: d.imputado_por || null,
            partida_no_existe: !part,
            partida_sin_previsto: part ? toNum(part.tiempo_previsto_horas) === 0 : null,
          };
        });

      const fichadoPorPersona = {};
      for (const r of regsTramo) {
        const pid = r.persona_id;
        if (!pid) continue;
        fichadoPorPersona[pid] = (fichadoPorPersona[pid] || 0) + toNum(r.horas);
      }

      const imputadoPorPersona = {};
      for (const d of desglosesEstaVisita) {
        const pid = d.persona_id;
        if (!imputadoPorPersona[pid]) {
          imputadoPorPersona[pid] = {
            persona_id: pid,
            persona_nombre: d.persona_nombre,
            total: 0,
            en_partidas_con_previsto: 0,
            en_partidas_sin_previsto: 0,
            en_partidas_no_existentes: 0,
          };
        }
        const o = imputadoPorPersona[pid];
        o.total += d.horas_imputadas;
        if (d.partida_no_existe) o.en_partidas_no_existentes += d.horas_imputadas;
        else if (d.partida_sin_previsto) o.en_partidas_sin_previsto += d.horas_imputadas;
        else o.en_partidas_con_previsto += d.horas_imputadas;
      }

      const comparacion = [];
      const todasPersonas = new Set([
        ...Object.keys(fichadoPorPersona),
        ...Object.keys(imputadoPorPersona),
      ]);
      for (const pid of todasPersonas) {
        const fichado = Math.round((fichadoPorPersona[pid] || 0) * 100) / 100;
        const imp = imputadoPorPersona[pid] || { total: 0, en_partidas_con_previsto: 0, en_partidas_sin_previsto: 0, en_partidas_no_existentes: 0 };
        comparacion.push({
          persona_id: pid,
          persona_nombre: personasMap[pid] || pid,
          fichado_en_tramo: fichado,
          imputado_total: Math.round(imp.total * 100) / 100,
          imputado_en_partidas_con_previsto: Math.round(imp.en_partidas_con_previsto * 100) / 100,
          imputado_en_partidas_sin_previsto: Math.round(imp.en_partidas_sin_previsto * 100) / 100,
          imputado_en_partidas_no_existentes: Math.round(imp.en_partidas_no_existentes * 100) / 100,
          desfase: Math.round((imp.total - fichado) * 100) / 100,
        });
      }
      comparacion.sort((a, b) => Math.abs(b.desfase) - Math.abs(a.desfase));

      res.json({
        ok: true,
        visita_id,
        obra_id,
        visita: {
          fecha: visita.fecha,
          autor: visita.autor,
          estado: visita.estado,
        },
        tramo: { desde, hasta },
        registros_tramo_count: regsTramo.length,
        desgloses_esta_visita_count: desglosesEstaVisita.length,
        comparacion,
        desgloses_huerfanos: desglosesEstaVisita.filter(d =>
          d.partida_no_existe || d.partida_sin_previsto
        ),
        desgloses_esta_visita: desglosesEstaVisita,
      });
    } catch (e) {
      console.error("[certif/debug]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/obra/:obra_id/visita
  // body: { fecha, autor, notas_generales, estados:[{partida_id,progreso_pct,motivo_retraso}] }
  //
  // Crea visita en estado "abierta". Si ya hay otra abierta para esa obra,
  // devuelve error 409 con el visita_id de la abierta (cliente debe cerrar
  // o continuar esa otra antes de crear nueva).
  // ----------------------------------------------------------
  app.post("/api/certificaciones/obra/:obra_id/visita", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const { fecha, autor, notas_generales = "", estados = [], tipo_visita } = req.body || {};
      if (!fecha || !autor) return res.status(400).json({ ok: false, error: "Falta fecha o autor" });
      if (!Array.isArray(estados)) return res.status(400).json({ ok: false, error: "estados debe ser array" });
      const tipo = tipo_visita && TIPOS_VISITA.has(tipo_visita) ? tipo_visita : "SEGUIMIENTO";

      // Comprobar que no haya visita abierta
      const visitas = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
      const abierta = visitaAbiertaDe(visitas, obra_id);
      if (abierta) {
        return res.status(409).json({
          ok: false,
          error: "Ya hay una visita abierta para esta obra",
          visita_abierta_id: abierta.visita_id,
          fecha_abierta: abierta.fecha,
        });
      }
      // Tampoco se permite crear otra del mismo día (incluso cerrada)
      const mismaFecha = visitas.find((v) =>
        v.obra_id === obra_id && String(v.fecha).slice(0, 10) === String(fecha).slice(0, 10)
      );
      if (mismaFecha) {
        return res.status(409).json({
          ok: false,
          error: `Ya existe una visita del ${fecha} para esta obra. Usa /visita-iniciar para reabrirla.`,
          visita_existe_id: mismaFecha.visita_id,
          estado: mismaFecha.estado,
        });
      }

      const visita_id = nuevoId("visita");
      const nowIso = new Date().toISOString();

      await appendTabla(HOJA_VISITAS, VISITAS_HEADERS, [{
        visita_id, obra_id, fecha, autor, notas_generales,
        estado: "abierta", tipo_visita: tipo, created_at: nowIso,
      }]);

      if (estados.length > 0) {
        const filas = estados.map((e) => ({
          estado_id: nuevoId("est"),
          visita_id,
          partida_id: e.partida_id,
          progreso_pct: Number(e.progreso_pct || 0),
          motivo_retraso: e.motivo_retraso || "",
          created_at: nowIso,
        }));
        await appendTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS, filas);
      }

      res.json({ ok: true, visita_id, estado: "abierta", tipo_visita: tipo, estados_registrados: estados.length });
    } catch (e) {
      console.error("[certif/visita]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/obra/:obra_id/visita/importar-pdf
  // multipart: archivo=<PDF de visita exportado del Excel>
  //
  // Parsea el PDF y devuelve un PREVIEW JSON (no guarda nada).
  // El cliente revisa, edita si hace falta, y luego llama al endpoint
  // estándar POST /visita con los datos confirmados.
  //
  // Respuesta:
  // {
  //   ok: true,
  //   preview: {
  //     tipo_visita, obra_nombre_pdf, fecha_iso,
  //     filas: [{
  //       nombre_pdf,                    // tal como aparece en el PDF
  //       partida_id,                    // match en catálogo (null si no encontró)
  //       nombre_catalogo,               // nombre del catálogo si hubo match
  //       match_score,                   // 0-1, fiabilidad del match
  //       progreso_pct, motivo,
  //       previsto, certif, real, restante   // informativos
  //     }],
  //     no_matcheadas: [...]             // filas sin match en catálogo
  //   },
  //   aviso: "..."
  // }
  // ----------------------------------------------------------
  app.post(
    "/api/certificaciones/obra/:obra_id/visita/importar-pdf",
    upload.single("archivo"),
    async (req, res) => {
      try {
        await asegurarPestanas();
        const obra_id = decodeURIComponent(req.params.obra_id);
        if (!req.file) return res.status(400).json({ ok: false, error: "Falta archivo" });

        // Detectar formato por extensión (más fiable que mimetype)
        const fname = String(req.file.originalname || "").toLowerCase();
        const esXlsx = fname.endsWith(".xlsx") || fname.endsWith(".xlsm");
        const esPdf = fname.endsWith(".pdf");
        if (!esXlsx && !esPdf) {
          return res.status(400).json({ ok: false, error: "Formato no soportado. Usa .pdf, .xlsx o .xlsm" });
        }

        const parsed = esXlsx
          ? await parsearVisitaXLSX(req.file.buffer)
          : await parsearVisitaPDF(req.file.buffer);

        const partidasObra = (await leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS))
          .filter((p) => p.obra_id === obra_id);
        if (partidasObra.length === 0) {
          return res.status(400).json({
            ok: false,
            error: "Esta obra no tiene partidas en el catálogo. Importa el presupuesto primero.",
          });
        }

        // Cargar personas solo si vamos a procesar desgloses (xlsx)
        const personas = esXlsx ? await leerTabla("personas", PERS_HEADERS) : [];

        const filasMatcheadas = parsed.filas.map((fila) => {
          const match = matchPartidaFuzzy(fila.nombre, partidasObra);
          return {
            nombre_pdf: fila.nombre,
            partida_id: match.partida_id,
            nombre_catalogo: match.nombre_catalogo,
            match_score: match.score,
            progreso_pct: fila.progreso_pct,
            motivo: fila.motivo,
            previsto: fila.previsto,
            certif: fila.certif,
            real: fila.real,
            restante: fila.restante,
          };
        });

        // Solo xlsx: construir desgloses (partida × persona → horas)
        const desgloses = [];
        const operarios_no_matcheados = new Set();
        if (esXlsx) {
          for (let i = 0; i < parsed.filas.length; i++) {
            const fila = parsed.filas[i];
            const partida_id = filasMatcheadas[i].partida_id;
            if (!partida_id) continue;
            for (const [nombreOp, horas] of Object.entries(fila.horas_por_operario || {})) {
              const persona = matchPersonaFuzzy(nombreOp, personas);
              if (!persona) {
                operarios_no_matcheados.add(nombreOp);
                continue;
              }
              desgloses.push({
                partida_id,
                partida_nombre: filasMatcheadas[i].nombre_catalogo,
                persona_id: persona.id,
                persona_nombre: persona.nombre,
                nombre_excel: nombreOp,
                horas_imputadas: horas,
              });
            }
          }
        }

        const no_matcheadas = filasMatcheadas.filter((f) => !f.partida_id).map((f) => f.nombre_pdf);

        res.json({
          ok: true,
          formato: esXlsx ? "xlsx" : "pdf",
          preview: {
            tipo_visita: parsed.tipo_visita,
            obra_nombre_pdf: parsed.obra_nombre,
            fecha_iso: parsed.fecha_iso,
            fecha_dmy: parsed.fecha_dmy,
            filas: filasMatcheadas,
            no_matcheadas,
            desgloses,
            operarios_no_matcheados: [...operarios_no_matcheados],
          },
          aviso: esXlsx
            ? undefined
            : parsed.aviso,
        });
      } catch (e) {
        console.error("[certif/importar-pdf]", e);
        res.status(500).json({ ok: false, error: e.message });
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/certificaciones/obra/:obra_id/checklist-fisico
  //
  // Devuelve los items físicos verificables de la obra (auto-detectados
  // por patrones sobre nombres de partida) con su estado actual:
  //   ok        → todas las partidas que matchean están al 100%
  //   pendiente → alguna no llega al 100%
  //   na        → ninguna partida de la obra matchea el patrón
  //
  // El checklist sirve como GATE para certificación final: si hay
  // items en "pendiente", no se puede cerrar la obra.
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obra/:obra_id/checklist-fisico", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const [partidas, visitas, estados] = await Promise.all([
        leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
      ]);
      const partidasObra = partidas.filter((p) => p.obra_id === obra_id);
      // Progreso actual = el % de la última visita (abierta o cerrada) que
      // tenga estado registrado para cada partida.
      const visitasObra = visitas
        .filter((v) => v.obra_id === obra_id)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const progresoMap = {};
      for (const p of partidasObra) {
        for (const v of visitasObra) {
          const e = estados.find((x) => x.visita_id === v.visita_id && x.partida_id === p.partida_id);
          if (e) {
            progresoMap[p.partida_id] = Number(e.progreso_pct || 0);
            break;
          }
        }
      }
      const items = calcularChecklistFisico(partidasObra, progresoMap);
      res.json({
        ok: true,
        items,
        permite_finalizar: checklistPermiteFinalizar(items),
      });
    } catch (e) {
      console.error("[certif/checklist-fisico]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/visita/:visita_id/certificar-final
  //
  // Marca la visita como CERTIFICACIÓN FINAL (tipo_visita=FINAL),
  // la cierra (estado=cerrada), y cambia la fase de la obra a
  // 12_FINALIZADA en sheet `comunidades`.
  //
  // VALIDACIONES (todas requeridas):
  //   1. Visita debe existir y estar abierta.
  //   2. Todas las partidas con previsto > 0 deben estar a 100%
  //      en esta visita.
  //   3. Checklist físico: todos los items aplicables deben estar OK.
  //
  // Si alguna falla, devuelve 400 con detalle de qué falta.
  // ----------------------------------------------------------
  app.post(
    "/api/certificaciones/visita/:visita_id/certificar-final",
    express.json(),
    async (req, res) => {
      try {
        await asegurarPestanas();
        const visita_id = req.params.visita_id;

        const [visitas, partidas, estados] = await Promise.all([
          leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
          leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
        ]);
        const idxVisita = visitas.findIndex((v) => v.visita_id === visita_id);
        if (idxVisita < 0) return res.status(404).json({ ok: false, error: "Visita no encontrada" });
        const visita = visitas[idxVisita];
        if (String(visita.estado).toLowerCase() !== "abierta") {
          return res.status(400).json({ ok: false, error: "Solo se puede certificar como final una visita ABIERTA" });
        }

        const obra_id = visita.obra_id;
        const partidasObra = partidas.filter((p) => p.obra_id === obra_id);
        const estadosVisita = estados.filter((e) => e.visita_id === visita_id);

        // Progreso de esta visita por partida
        const progresoMap = {};
        for (const e of estadosVisita) progresoMap[e.partida_id] = Number(e.progreso_pct || 0);

        // Validación 1: todas las partidas con previsto > 0 al 100%
        const incompletas = partidasObra.filter((p) => {
          const previsto = Number(p.tiempo_previsto_horas || 0);
          if (previsto <= 0) return false;
          return (progresoMap[p.partida_id] || 0) < 100;
        });
        if (incompletas.length > 0) {
          return res.status(400).json({
            ok: false,
            error: "No todas las partidas están al 100%",
            partidas_pendientes: incompletas.map((p) => ({
              partida_id: p.partida_id, nombre: p.nombre,
              progreso: progresoMap[p.partida_id] || 0,
            })),
          });
        }

        // Validación 2: checklist físico OK
        const items = calcularChecklistFisico(partidasObra, progresoMap);
        if (!checklistPermiteFinalizar(items)) {
          return res.status(400).json({
            ok: false,
            error: "El checklist físico tiene items pendientes",
            items_pendientes: items.filter((i) => i.status === "pendiente"),
          });
        }

        // Actualizar visita: tipo_visita=FINAL, estado=cerrada
        const nowIso = new Date().toISOString();
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(VISITAS_HEADERS.length - 1);
        const filaSheet = 2 + idxVisita;
        const actualizada = { ...visita, tipo_visita: "FINAL", estado: "cerrada" };
        const valores = VISITAS_HEADERS.map((h) => actualizada[h] !== undefined ? actualizada[h] : "");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_VISITAS}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });

        // Actualizar fase obra → 12_FINALIZADA
        let fase_anterior = null;
        try {
          const r = await actualizarFaseObra(obra_id, FASE_FINALIZADA);
          fase_anterior = r.fase_anterior;
        } catch (e) {
          // No abortamos: la visita ya está cerrada como FINAL. Solo avisamos.
          console.error("[certif/certificar-final] no se pudo actualizar fase obra:", e.message);
        }

        res.json({
          ok: true,
          visita_id,
          tipo_visita: "FINAL",
          estado: "cerrada",
          obra_id,
          fase_anterior,
          fase_nueva: FASE_FINALIZADA,
          cerrado_at: nowIso,
        });
      } catch (e) {
        console.error("[certif/certificar-final]", e);
        res.status(500).json({ ok: false, error: e.message });
      }
    },
  );

  // ----------------------------------------------------------
  // POST /api/certificaciones/obra/:obra_id/visita-iniciar
  // body: { autor, fecha? (default hoy) }
  //
  // Si hay visita ABIERTA en la obra: la devuelve (no crea nueva).
  // Si no hay abierta: crea visita nueva como "abierta".
  //
  // Regla: solo UNA visita abierta por obra. Si JM intenta crear otra
  // mientras hay una abierta, le devolvemos la abierta para que la cierre.
  // ----------------------------------------------------------
  app.post("/api/certificaciones/obra/:obra_id/visita-iniciar", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const { autor, fecha } = req.body || {};
      if (!autor) return res.status(400).json({ ok: false, error: "Falta autor" });

      const fechaFinal = fecha || new Date().toISOString().slice(0, 10);

      // ¿Hay ya una abierta en esta obra? → devolverla
      const visitas = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
      const abierta = visitaAbiertaDe(visitas, obra_id);

      if (abierta) {
        const [estados, registros, desgloses] = await Promise.all([
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
          leerTabla("registros_tiempo", RT_HEADERS),
          leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
        ]);
        const estadosVisita = estados.filter((e) => e.visita_id === abierta.visita_id);
        const cuadre = calcularCuadreVisita(abierta, visitas, registros, desgloses);
        return res.json({
          ok: true,
          visita_id: abierta.visita_id,
          fecha: abierta.fecha,
          autor: abierta.autor,
          notas_generales: abierta.notas_generales || "",
          estado: "abierta",
          reabierta: true,
          estados: estadosVisita.map((e) => ({
            estado_id: e.estado_id,
            partida_id: e.partida_id,
            progreso_pct: toNum(e.progreso_pct),
            motivo_retraso: e.motivo_retraso || "",
          })),
          cuadre,
        });
      }

      // ¿Hay una visita CERRADA del mismo día? → reabrirla
      // Regla: máximo una visita por día por obra. Si JM cerró y vuelve a
      // entrar el mismo día (vio algo más, se equivocó, etc), reabrimos
      // la del día en lugar de crear otra (que tendría tramo vacío).
      const idxCerradaDia = visitas.findIndex((v) =>
        v.obra_id === obra_id &&
        String(v.fecha).slice(0, 10) === fechaFinal &&
        String(v.estado || "").toLowerCase() === "cerrada"
      );
      if (idxCerradaDia >= 0) {
        const visitaCerrada = visitas[idxCerradaDia];
        // Reabrir: estado → "abierta"
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(VISITAS_HEADERS.length - 1);
        const filaSheet = 2 + idxCerradaDia;
        const reabierta = { ...visitaCerrada, estado: "abierta" };
        const valores = VISITAS_HEADERS.map((h) => reabierta[h] !== undefined ? reabierta[h] : "");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_VISITAS}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
        console.log(`[certif] Visita ${visitaCerrada.visita_id} reabierta (mismo día)`);
        // Recargar visitas y devolver cuadre
        const visitasAct = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
        const [estados, registros, desgloses] = await Promise.all([
          leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
          leerTabla("registros_tiempo", RT_HEADERS),
          leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
        ]);
        const estadosVisita = estados.filter((e) => e.visita_id === visitaCerrada.visita_id);
        const cuadre = calcularCuadreVisita(reabierta, visitasAct, registros, desgloses);
        return res.json({
          ok: true,
          visita_id: visitaCerrada.visita_id,
          fecha: visitaCerrada.fecha,
          autor: visitaCerrada.autor,
          notas_generales: visitaCerrada.notas_generales || "",
          estado: "abierta",
          reabierta: true,
          estados: estadosVisita.map((e) => ({
            estado_id: e.estado_id,
            partida_id: e.partida_id,
            progreso_pct: toNum(e.progreso_pct),
            motivo_retraso: e.motivo_retraso || "",
          })),
          cuadre,
        });
      }

      // No hay abierta ni cerrada del día: crear visita nueva
      const visita_id = nuevoId("visita");
      const nowIso = new Date().toISOString();
      await appendTabla(HOJA_VISITAS, VISITAS_HEADERS, [{
        visita_id, obra_id, fecha: fechaFinal, autor,
        notas_generales: "", estado: "abierta", created_at: nowIso,
      }]);
      // Calcular cuadre inicial (todo pendiente)
      const [registros, desgloses] = await Promise.all([
        leerTabla("registros_tiempo", RT_HEADERS),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
      ]);
      const visitasConNueva = [...visitas, { visita_id, obra_id, fecha: fechaFinal, autor, estado: "abierta" }];
      const cuadre = calcularCuadreVisita(
        { visita_id, obra_id, fecha: fechaFinal },
        visitasConNueva,
        registros,
        desgloses
      );
      res.json({
        ok: true,
        visita_id,
        fecha: fechaFinal,
        autor,
        notas_generales: "",
        estado: "abierta",
        reabierta: false,
        estados: [],
        cuadre,
      });
    } catch (e) {
      console.error("[certif/visita-iniciar]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/visita/:visita_id/estado-partida
  // body: { partida_id, progreso_pct, motivo_retraso }
  //
  // UPSERT del estado de UNA partida en UNA visita. Pensado para
  // auto-guardado: cada vez que JM toca un botón de progreso o
  // escribe motivo, se llama aquí con debounce. Una fila por
  // (visita_id, partida_id).
  // ----------------------------------------------------------
  app.post("/api/certificaciones/visita/:visita_id/estado-partida", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const visita_id = decodeURIComponent(req.params.visita_id);
      const { partida_id, progreso_pct, motivo_retraso } = req.body || {};
      if (!partida_id) return res.status(400).json({ ok: false, error: "Falta partida_id" });

      const pct = toNum(progreso_pct);
      if (pct < 0 || pct > 100) {
        return res.status(400).json({ ok: false, error: "progreso_pct debe estar entre 0 y 100" });
      }

      const estados = await leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS);
      const idxObjetivo = estados.findIndex(
        (e) => e.visita_id === visita_id && e.partida_id === partida_id
      );
      const nowIso = new Date().toISOString();

      if (idxObjetivo >= 0) {
        // UPDATE in-place
        const fila = estados[idxObjetivo];
        const actualizada = {
          ...fila,
          progreso_pct: pct,
          motivo_retraso: motivo_retraso || "",
          created_at: nowIso, // re-uso como last_update
        };
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(VISITA_ESTADO_HEADERS.length - 1);
        const filaSheet = 2 + idxObjetivo;
        const valores = VISITA_ESTADO_HEADERS.map((h) => actualizada[h] !== undefined ? actualizada[h] : "");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_VISITA_ESTADO}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
        return res.json({ ok: true, accion: "update", estado_id: fila.estado_id });
      }

      // INSERT
      const estado_id = nuevoId("est");
      await appendTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS, [{
        estado_id,
        visita_id,
        partida_id,
        progreso_pct: pct,
        motivo_retraso: motivo_retraso || "",
        created_at: nowIso,
      }]);
      res.json({ ok: true, accion: "insert", estado_id });
    } catch (e) {
      console.error("[certif/estado-partida]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/visita/:visita_id/cerrar
  //
  // Cierra una visita manualmente (acción explícita de JM al terminar).
  // En el modelo v0.10.0 JM hace toda la certificación en obra: marca
  // progresos + reparte horas por operario × partida. Cuando termina,
  // pulsa "Cerrar visita" y queda cerrada. Las horas del día de la
  // visita y posteriores caerán en el tramo de la siguiente visita.
  // ----------------------------------------------------------
  app.post("/api/certificaciones/visita/:visita_id/cerrar", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const visita_id = decodeURIComponent(req.params.visita_id);
      const visitas = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
      const idx = visitas.findIndex((v) => v.visita_id === visita_id);
      if (idx < 0) {
        return res.status(404).json({ ok: false, error: "Visita no encontrada" });
      }
      const visita = visitas[idx];
      if (String(visita.estado || "").toLowerCase() === "cerrada") {
        return res.json({ ok: true, visita_id, estado: "cerrada", noop: true });
      }

      const sheets = getSheetsClient();
      const lastCol = colLetterFromIdx(VISITAS_HEADERS.length - 1);
      const filaSheet = 2 + idx;
      const actualizada = { ...visita, estado: "cerrada" };
      const valores = VISITAS_HEADERS.map((h) => actualizada[h] !== undefined ? actualizada[h] : "");
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA_VISITAS}!A${filaSheet}:${lastCol}${filaSheet}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [valores] },
      });
      console.log(`[certif] Visita ${visita_id} cerrada manualmente`);
      res.json({ ok: true, visita_id, estado: "cerrada" });
    } catch (e) {
      console.error("[certif/cerrar]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/visita/:visita_id/desglose
  // body: { partida_id, persona_id, horas_imputadas, imputado_por }
  //
  // UPSERT del reparto de horas en UNA visita (= UN tramo).
  // Una fila por (visita_id, partida_id, persona_id).
  //   - Si NO existe → INSERT
  //   - Si existe → UPDATE in-place
  //   - Si horas == 0 → DELETE
  // Después de cada UPSERT, intenta cerrar la visita si cuadra (pendientes ≤ 0).
  // ----------------------------------------------------------
  app.post("/api/certificaciones/visita/:visita_id/desglose", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const visita_id = decodeURIComponent(req.params.visita_id);
      const { partida_id, persona_id, horas_imputadas, imputado_por } = req.body || {};
      if (!partida_id || !persona_id || horas_imputadas == null) {
        return res.status(400).json({ ok: false, error: "Faltan campos (partida_id, persona_id, horas_imputadas)" });
      }
      const horas = toNum(horas_imputadas);
      if (horas < 0) {
        return res.status(400).json({ ok: false, error: "horas_imputadas inválido" });
      }

      // Verificar visita existe y está abierta
      const visitas = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
      const visita = visitas.find((v) => v.visita_id === visita_id);
      if (!visita) {
        return res.status(404).json({ ok: false, error: "Visita no encontrada" });
      }
      if (String(visita.estado || "").toLowerCase() === "cerrada") {
        return res.status(400).json({ ok: false, error: "La visita está cerrada, no se puede modificar" });
      }

      const obra_id = visita.obra_id;
      const existentes = await leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS);
      const idxObjetivo = existentes.findIndex((d) =>
        d.visita_id === visita_id && d.partida_id === partida_id && d.persona_id === persona_id
      );

      // Caso 1: horas == 0 → borrar
      if (horas === 0) {
        if (idxObjetivo < 0) {
          return res.json({ ok: true, accion: "noop" });
        }
        const restantes = existentes.filter((_, i) => i !== idxObjetivo);
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(DESGLOSE_HEADERS.length - 1);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_DESGLOSE}!A2:${lastCol}`,
        });
        if (restantes.length > 0) {
          await appendTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS, restantes);
        }
        // No intentamos cerrar tras un delete (deja la visita abierta)
        return res.json({ ok: true, accion: "delete", visita_id, estado: "abierta" });
      }

      // Caso 2: existe → UPDATE
      if (idxObjetivo >= 0) {
        const fila = existentes[idxObjetivo];
        const actualizada = {
          ...fila,
          horas_imputadas: horas,
          fecha_imputacion: new Date().toISOString(),
          imputado_por: imputado_por || fila.imputado_por || "",
        };
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(DESGLOSE_HEADERS.length - 1);
        const filaSheet = 2 + idxObjetivo;
        const valores = DESGLOSE_HEADERS.map((h) => actualizada[h] !== undefined ? actualizada[h] : "");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_DESGLOSE}!A${filaSheet}:${lastCol}${filaSheet}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [valores] },
        });
      } else {
        // Caso 3: no existe → INSERT
        await appendTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS, [{
          desglose_id: nuevoId("desg"),
          visita_id,
          obra_id,
          partida_id,
          persona_id,
          horas_imputadas: horas,
          fecha_imputacion: new Date().toISOString(),
          imputado_por: imputado_por || "",
        }]);
      }

      // En v0.10.0 ya no se cierra automáticamente. JM cierra con POST /cerrar.
      res.json({
        ok: true,
        accion: idxObjetivo >= 0 ? "update" : "insert",
        visita_id,
        estado: "abierta",
      });
    } catch (e) {
      console.error("[certif/visita-desglose]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // GET /api/certificaciones/obra/:obra_id/cuadre
  // ----------------------------------------------------------
  app.get("/api/certificaciones/obra/:obra_id/cuadre", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);

      const [horasReales, desgloseRaw, personasMap] = await Promise.all([
        horasRealesPorObra(obra_id),
        leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS),
        getPersonasMap(),
      ]);

      const realPorOp = {};
      for (const r of horasReales) {
        const pid = r.persona_id;
        realPorOp[pid] = (realPorOp[pid] || 0) + toNum(r.horas);
      }
      const desglose = desgloseRaw.filter((d) => d.obra_id === obra_id);
      const imputadoPorOp = {};
      for (const d of desglose) {
        const pid = d.persona_id;
        imputadoPorOp[pid] = (imputadoPorOp[pid] || 0) + toNum(d.horas_imputadas);
      }

      const operarios = new Set([...Object.keys(realPorOp), ...Object.keys(imputadoPorOp)]);
      const desviaciones = [];
      for (const op of operarios) {
        const real = realPorOp[op] || 0;
        const imp = imputadoPorOp[op] || 0;
        const dif = real - imp;
        if (Math.abs(dif) > 0.01) {
          desviaciones.push({
            persona_id: op,
            nombre: personasMap[op] || op,
            horas_reales: Math.round(real * 100) / 100,
            horas_imputadas: Math.round(imp * 100) / 100,
            por_imputar: Math.round(dif * 100) / 100,
          });
        }
      }
      desviaciones.sort((a, b) => Math.abs(b.por_imputar) - Math.abs(a.por_imputar));

      res.json({ ok: true, obra_id, desviaciones, cuadrado: desviaciones.length === 0 });
    } catch (e) {
      console.error("[certif/cuadre]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // DELETE /api/certificaciones/obra/:obra_id
  // Borra TODO lo relacionado con una obra: partidas, visitas, estados, desgloses.
  // Operación destructiva e irreversible. Útil para limpiar importaciones erróneas.
  // ----------------------------------------------------------
  app.delete("/api/certificaciones/obra/:obra_id", async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const sheets = getSheetsClient();

      // 1. Partidas: filtrar y reescribir
      const partidas = await leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS);
      const partidasObra = partidas.filter((p) => p.obra_id === obra_id);
      const partidasResto = partidas.filter((p) => p.obra_id !== obra_id);
      const partidaIdsObra = new Set(partidasObra.map((p) => p.partida_id));

      // 2. Visitas
      const visitas = await leerTabla(HOJA_VISITAS, VISITAS_HEADERS);
      const visitasObra = visitas.filter((v) => v.obra_id === obra_id);
      const visitasResto = visitas.filter((v) => v.obra_id !== obra_id);
      const visitaIdsObra = new Set(visitasObra.map((v) => v.visita_id));

      // 3. Visita estados: filtramos por visita_id de esta obra
      const estados = await leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS);
      const estadosResto = estados.filter((e) => !visitaIdsObra.has(e.visita_id));

      // 4. Desglose
      const desgloses = await leerTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS);
      const desglosesResto = desgloses.filter((d) => d.obra_id !== obra_id);

      // Reescribir cada hoja (clear + append si hay restantes)
      async function reescribir(hoja, headers, resto) {
        const lastCol = colLetterFromIdx(headers.length - 1);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${hoja}!A2:${lastCol}`,
        });
        if (resto.length > 0) {
          await appendTabla(hoja, headers, resto);
        }
      }

      await reescribir(HOJA_PARTIDAS, PARTIDAS_HEADERS, partidasResto);
      await reescribir(HOJA_VISITAS, VISITAS_HEADERS, visitasResto);
      await reescribir(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS, estadosResto);
      await reescribir(HOJA_DESGLOSE, DESGLOSE_HEADERS, desglosesResto);

      res.json({
        ok: true,
        obra_id,
        borrado: {
          partidas: partidasObra.length,
          visitas: visitasObra.length,
          estados: estados.length - estadosResto.length,
          desgloses: desgloses.length - desglosesResto.length,
        },
      });
    } catch (e) {
      console.error("[certif/delete-obra]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-certificaciones] v0.13.0 cargado · ranking operarios con 3 metricas + desglose por obra");
};
