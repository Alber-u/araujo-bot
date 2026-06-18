// ============================================================
// ARA OS — Registros de Tiempo · v0.4.0 (18/05/2026)
//
// Módulo Panel 1: sustituye a Fixner para registro de horas
// trabajadas por operario × día. Una persona puede tener varios
// registros el mismo día (varias obras + extras + ausencias).
//
// v0.4.0 — validarObra ampliada a 3 fuentes: ordenes_trabajo (fases 12-17),
//          comunidades/Plan5 (fases 05_DOCUMENTACION..11_PREPARADA) y
//          obras_otras (INICIO_OBRA, EN_EJECUCION). Antes solo buscaba en
//          ordenes_trabajo → error "Obra X no existe" al imputar obras en
//          fase pre-ejecución. Frontend ya las mostraba desde v0.10.x;
//          el backend ahora las acepta. 0 cambios en otros módulos.
//
// v0.3.1 — Fix bug crítico en leerHojaSafe: cuando Google Sheets
//          saturaba transitoriamente (rate-limit), devolvía [] silencioso,
//          provocando falsos "Persona pX no existe" en endpoints que
//          dependen de la lista de personas (drawer, import-historico).
//          Ahora reintenta hasta 3 veces con backoff (1s, 2s, 4s) y si
//          persiste lanza error real (el endpoint devuelve 500 honesto).
//
// v0.3.0 — Endpoint admin /admin/registros-tiempo/import-historico para
//          cargar datos del CSV Fixner. Bypassea validación de fase
//          de obra y de persona activa. Idempotente por hash de fila.
//          Marca registros con source="fixner_import".
//
// v0.2.2 — Fix orden de endpoints: /tipos-jornada movido ANTES de /:id
//          para que Express no lo capture como :id (404). Bug encontrado
//          en frontend al cargar el modal.
//
// v0.2.1 — Fix CORS: añadidos headers Access-Control-Allow-* y endpoints
//          OPTIONS preflight. Mismo patrón que ara-os-timeline-fases.cjs.
//
// v0.2.0 — Tipos de jornada y ausencias:
//   · Campo `tipo` en cada registro:
//     - trabajo            (en obra, 100% coste)
//     - extra              (hora extra en obra, 150% coste)
//     - baja_it            (enfermedad, sin obra, 100%)
//     - vacaciones         (sin obra, 100%)
//     - festivo            (sin obra, 100%)
//     - falta_justificada  (sin obra, 100%, motivo obligatorio)
//     - falta_injustificada(sin obra, 0%, motivo obligatorio)
//     - permiso_sin_sueldo (sin obra, 0%, motivo obligatorio)
//     - asuntos_propios    (sin obra, 100%, motivo obligatorio)
//     - formacion          (sin obra, 100%)
//   · Multiplicadores configurables en hoja `tipos_jornada`
//   · `obra_id` solo obligatorio si tipo ∈ {trabajo, extra}
//
// v0.1.0 — Base CRUD con append-only historial.
//
// require("./ara-os-registros-tiempo.cjs")(app);
//
// Endpoints expuestos:
//   GET    /api/ara-os/registros-tiempo/ping             (diagnóstico)
//   GET    /api/ara-os/registros-tiempo                  (listado + filtros)
//   GET    /api/ara-os/registros-tiempo/dia/:fecha       (agrupado día×persona)
//   POST   /api/ara-os/registros-tiempo                  (crear)
//   GET    /api/ara-os/registros-tiempo/:id              (uno)
//   PATCH  /api/ara-os/registros-tiempo/:id              (editar)
//   DELETE /api/ara-os/registros-tiempo/:id              (soft-delete)
//   GET    /api/ara-os/registros-tiempo/tipos-jornada    (catálogo tipos)
//
// API PÚBLICA:
//   const registrosTiempo = require("./ara-os-registros-tiempo.cjs");
//   await registrosTiempo.getHorasAcumuladasPorObra("Generalife 13");
//     → suma solo registros tipo `trabajo` y `extra` (los que tienen obra)
//
// Tablas usadas (Google Sheet maestro):
//   - personas (existente, columna U `coste_hora`)
//   - registros_tiempo (NUEVA, autoridad)
//   - registros_tiempo_historial (NUEVA, append-only)
//   - tipos_jornada (NUEVA, catálogo configurable)
//   - ordenes_trabajo (lectura, identifica obras activas)
//
// Patrón inspirado en ara-os-timeline-fases.cjs v0.3.0
// ============================================================

const { google } = require("googleapis");

// ============================================================
// CONFIG
// ============================================================
const RT_HEADERS = [
  "registro_id",      // A  RT-YYYYMMDD-NNN
  "fecha",            // B  YYYY-MM-DD
  "persona_id",       // C  FK personas.id
  "tipo",             // D  trabajo|extra|baja_it|vacaciones|festivo|falta_justificada|falta_injustificada|permiso_sin_sueldo|asuntos_propios|formacion
  "obra_id",          // E  comunidad (FK ordenes_trabajo). Vacío si tipo != trabajo|extra
  "horas",            // F  decimal
  "motivo",           // G  texto libre (obligatorio en ausencias justificables)
  "nota",             // H  texto libre 500 caracteres
  "source",           // I  manual | fixner_import
  "created_at",       // J
  "created_by",       // K
  "updated_at",       // L
  "updated_by",       // M
  "borrado",          // N  TRUE/FALSE
  "coste_hora",       // O  snapshot del coste/h en el momento del registro
];

const HIST_HEADERS = [
  "evento_id",        // A  EV-YYYYMMDD-NNN
  "registro_id",      // B  FK
  "tipo_evento",      // C  creado | editado | borrado
  "snapshot_json",    // D
  "cambios_json",     // E
  "evento_at",        // F
  "evento_by",        // G
];

const TIPOS_JORNADA_HEADERS = [
  "tipo",                  // A  identificador (ej: trabajo, baja_it)
  "etiqueta",              // B  nombre humano ("Trabajo en obra", "Baja IT")
  "necesita_obra",         // C  TRUE/FALSE
  "motivo_obligatorio",    // D  TRUE/FALSE
  "multiplicador_coste",   // E  decimal (1.0 = 100%, 1.5 = horas extra, 0 = no se paga)
  "color",                 // F  hex color para UI
  "icono",                 // G  emoji/icono identificador
];

// Defaults sembrados al primer arranque si la hoja está vacía
const TIPOS_DEFAULTS = [
  { tipo: "trabajo",             etiqueta: "Trabajo en obra",  necesita_obra: "TRUE",  motivo_obligatorio: "FALSE", multiplicador_coste: "1.0", color: "#d1fae5", icono: "🔧" },
  { tipo: "extra",               etiqueta: "Hora extra",       necesita_obra: "TRUE",  motivo_obligatorio: "FALSE", multiplicador_coste: "1.5", color: "#fef3c7", icono: "⚡" },
  { tipo: "baja_it",             etiqueta: "Baja IT",          necesita_obra: "FALSE", motivo_obligatorio: "TRUE",  multiplicador_coste: "1.0", color: "#fecaca", icono: "🏥" },
  { tipo: "vacaciones",          etiqueta: "Vacaciones",       necesita_obra: "FALSE", motivo_obligatorio: "FALSE", multiplicador_coste: "1.0", color: "#bfdbfe", icono: "🏖️" },
  { tipo: "festivo",             etiqueta: "Festivo",          necesita_obra: "FALSE", motivo_obligatorio: "FALSE", multiplicador_coste: "1.0", color: "#e9d5ff", icono: "🎉" },
  { tipo: "falta_justificada",   etiqueta: "Falta justificada", necesita_obra: "FALSE", motivo_obligatorio: "TRUE",  multiplicador_coste: "1.0", color: "#fde68a", icono: "📋" },
  { tipo: "falta_injustificada", etiqueta: "Falta injustificada", necesita_obra: "FALSE", motivo_obligatorio: "TRUE",  multiplicador_coste: "0",   color: "#fca5a5", icono: "⛔" },
  { tipo: "permiso_sin_sueldo",  etiqueta: "Permiso sin sueldo", necesita_obra: "FALSE", motivo_obligatorio: "TRUE",  multiplicador_coste: "0",   color: "#d1d5db", icono: "✋" },
  { tipo: "asuntos_propios",     etiqueta: "Asuntos propios",  necesita_obra: "FALSE", motivo_obligatorio: "TRUE",  multiplicador_coste: "1.0", color: "#fed7aa", icono: "👤" },
  { tipo: "formacion",           etiqueta: "Formación",        necesita_obra: "FALSE", motivo_obligatorio: "FALSE", multiplicador_coste: "1.0", color: "#a5f3fc", icono: "📚" },
];

// Fases en las que se permite registrar horas en obra (formato "12_INICIO_OBRA")
const FASES_OT_VALIDAS = [
  "12_INICIO_OBRA",
  "13_EN_EJECUCION",
  "14_FINALIZADA",
  "15_VISITA_INSPECTOR",
  "16_MONTAJE_CONTADORES",
  "17_COBRO_EMASESA",
];

// Fases Plan5 pre-ejecución (sheet comunidades, col fase_presupuesto)
const FASES_PANEL_VALIDAS = [
  "05_DOCUMENTACION",
  "06_CYCP",
  "07_FIRMA",
  "08_ENTREGA_EMASESA",
  "09_ESPERA_EMASESA",
  "10_APROBADA",
  "11_PREPARADA",
];

// Fases obras no-Plan5 (sheet obras_otras, col fase)
//
// FASES_OTRAS_VALIDAS: en qué fases una obra "otra" admite REGISTROS de
// tiempo (validarObra). Incluye FACTURADA para permitir regularizaciones
// y reasignaciones de registros sobre obras ya cerradas (caso: corregir
// una hora que se imputó a la obra equivocada después de facturar).
//
// FASES_OTRAS_ACTIVAS: cuáles aparecen por defecto en el combobox cuando
// el usuario CREA un registro nuevo (no queremos saturar con históricas).
// Para reasignar, el frontend pide la lista extendida (incluye FACTURADA).
const FASES_OTRAS_VALIDAS = ["INICIO_OBRA", "EN_EJECUCION", "FACTURADA"];
const FASES_OTRAS_ACTIVAS = ["INICIO_OBRA", "EN_EJECUCION"];

const PALETA_AVATAR = [
  "#fef3c7", "#dbeafe", "#e0e7ff", "#d1fae5", "#fce7f3",
  "#fed7aa", "#ddd6fe", "#fee2e2", "#cffafe", "#fef9c3",
];

// ============================================================
// CLIENTE SHEETS (lazy, igual que timeline-fases)
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
  // v0.2.4: reintentos con backoff ante rate limit + throw si persiste
  // Antes (v0.2.3 y anteriores): return [] silencioso → bug "Persona pX no existe"
  // cuando Google Sheets satura transitoriamente. Mantenido el nombre por compat.
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
        // Error duro (range no existe, credenciales mal, etc) → lanza ya
        console.error("[registros-tiempo/leerHojaSafe] ERROR", rango, msg);
        throw err;
      }
      // Rate limit transitorio → espera y reintenta
      const esperaMs = 1000 * Math.pow(2, i); // 1s, 2s, 4s
      console.warn(`[registros-tiempo/leerHojaSafe] rate-limit ${rango}, reintento ${i+1}/${MAX_INTENTOS} en ${esperaMs}ms`);
      await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  // Agotados los reintentos. Lanzar para que el endpoint devuelva 5xx honesto.
  console.error("[registros-tiempo/leerHojaSafe] rate-limit persistente tras reintentos:", rango);
  throw ultimoError || new Error(`Rate limit persistente al leer ${rango}`);
}

// ============================================================
// AUTO-CREACIÓN DE PESTAÑAS + SEED tipos_jornada
// ============================================================
let _pestanasOK = false;
async function asegurarPestanas() {
  if (_pestanasOK) return true;
  try {
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
          requestBody: {
            requests: [{ addSheet: { properties: { title: nombre } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${nombre}!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
        console.log(`[registros-tiempo] Tab ${nombre} creada`);
        return true; // creada
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
          console.log(`[registros-tiempo] Headers de ${nombre} actualizados`);
        }
        return false; // ya existía
      }
    }

    await asegurar("registros_tiempo", RT_HEADERS);
    await asegurar("registros_tiempo_historial", HIST_HEADERS);
    const tiposCreada = await asegurar("tipos_jornada", TIPOS_JORNADA_HEADERS);

    // Seed tipos_jornada si la hoja está vacía
    const filasTipos = await leerHojaSafe("tipos_jornada!A2:G");
    if (filasTipos.length === 0) {
      const lastCol = colLetterFromIdx(TIPOS_JORNADA_HEADERS.length - 1);
      const rows = TIPOS_DEFAULTS.map(t => TIPOS_JORNADA_HEADERS.map(h => t[h] || ""));
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `tipos_jornada!A2:${lastCol}${1 + rows.length}`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
      console.log(`[registros-tiempo] Sembrados ${rows.length} tipos en tipos_jornada`);
    }

    _pestanasOK = true;
    return true;
  } catch (err) {
    console.warn("[registros-tiempo/asegurarPestanas]", err.message);
    return false;
  }
}

// ============================================================
// CONVERSIÓN fila ↔ objeto
// ============================================================
function filaAObjeto(fila, headers, rowIndex) {
  const o = { _rowIndex: rowIndex };
  headers.forEach((k, i) => {
    o[k] = (fila[i] !== undefined && fila[i] !== null) ? String(fila[i]).trim() : "";
  });
  return o;
}

function objetoAFila(obj, headers) {
  return headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? String(obj[h]) : "");
}

// v0.3.3 — Cachés agresivas para evitar Quota Sheets 429
// Registros y personas se leen muy a menudo desde múltiples módulos.
// TTL 30s para registros (cambian al guardar parte), 60s para personas
// (cambian casi nunca).
let _registrosCache = null;
let _registrosCacheAt = 0;
const REGISTROS_CACHE_TTL_MS = 30_000;

function invalidarCacheRegistros() {
  _registrosCache = null;
  _registrosCacheAt = 0;
}

async function leerRegistros() {
  if (_registrosCache && Date.now() - _registrosCacheAt < REGISTROS_CACHE_TTL_MS) {
    return _registrosCache;
  }
  await asegurarPestanas();
  const lastCol = colLetterFromIdx(RT_HEADERS.length - 1);
  try {
    const filas = await leerHojaSafe(`registros_tiempo!A2:${lastCol}`);
    const data = filas.map((f, i) => filaAObjeto(f, RT_HEADERS, i + 2));
    _registrosCache = data;
    _registrosCacheAt = Date.now();
    return data;
  } catch (e) {
    // Fallback: caché vieja en quota
    if (_registrosCache) return _registrosCache;
    throw e;
  }
}

let _personasCache = null;
let _personasCacheAt = 0;
const PERSONAS_CACHE_TTL_MS = 60_000;

function invalidarCachePersonas() {
  _personasCache = null;
  _personasCacheAt = 0;
}

async function leerPersonas() {
  if (_personasCache && Date.now() - _personasCacheAt < PERSONAS_CACHE_TTL_MS) {
    return _personasCache;
  }
  const COLS = [
    "id","nombre","dni","fecha_nacimiento","puesto","rol","telefono","email",
    "fecha_alta","fecha_baja","pin","carpeta_drive","emergencia_nombre",
    "emergencia_telefono","iban","talla_calzado","talla_pantalon","talla_camiseta",
    "vehiculo_asignado","notas","coste_hora",
  ];
  try {
    const filas = await leerHojaSafe("personas!A2:U");
    const data = filas.map((f, i) => filaAObjeto(f, COLS, i + 2));
    _personasCache = data;
    _personasCacheAt = Date.now();
    return data;
  } catch (e) {
    if (_personasCache) return _personasCache;
    throw e;
  }
}

async function leerObrasActivas() {
  const filas = await leerHojaSafe("ordenes_trabajo!A2:B");
  return filas.map(f => ({
    comunidad: (f[0] || "").toString().trim(),
    fase_ot: (f[1] || "").toString().trim(),
  })).filter(o => o.comunidad);
}

// Obras Plan5 pre-ejecución (comunidades, fases 05-11)
// comunidades!A = nombre, col P (índice 15) = fase_presupuesto
async function leerObrasPanel() {
  const filas = await leerHojaSafe("comunidades!A2:P");
  return filas.map(f => ({
    comunidad: (f[0] || "").toString().trim(),
    fase_presupuesto: (f[15] || "").toString().trim(),
  })).filter(o => o.comunidad && FASES_PANEL_VALIDAS.includes(o.fase_presupuesto));
}

// Obras no-Plan5 (obras_otras, fases INICIO_OBRA, EN_EJECUCION)
// obras_otras!B = nombre, H (índice 7) = fase
async function leerObrasOtras() {
  const filas = await leerHojaSafe("obras_otras!A2:H");
  return filas.map(f => ({
    comunidad: (f[1] || "").toString().trim(),  // col B = nombre
    fase_otras: (f[7] || "").toString().trim(),  // col H = fase
  })).filter(o => o.comunidad && FASES_OTRAS_VALIDAS.includes(o.fase_otras));
}

// Cache de tipos (TTL 60s)
let _tiposCache = null;
let _tiposCacheAt = 0;
async function leerTiposJornada() {
  if (_tiposCache && Date.now() - _tiposCacheAt < 60000) return _tiposCache;
  await asegurarPestanas();
  const filas = await leerHojaSafe("tipos_jornada!A2:G");
  const tipos = filas.map((f, i) => filaAObjeto(f, TIPOS_JORNADA_HEADERS, i + 2));
  // Mapa por tipo para acceso rápido
  const map = Object.fromEntries(tipos.map(t => [t.tipo, t]));
  _tiposCache = { lista: tipos, map };
  _tiposCacheAt = Date.now();
  return _tiposCache;
}

function invalidarCacheTipos() {
  _tiposCache = null;
  _tiposCacheAt = 0;
}

// ============================================================
// GENERACIÓN DE IDs y TIMESTAMPS
// ============================================================
async function genId(prefix, fecha) {
  const ymd = fecha.replace(/-/g, "");
  const prefijo = `${prefix}-${ymd}-`;
  let rows = [];
  if (prefix === "RT") {
    rows = await leerRegistros();
  } else {
    const lastCol = colLetterFromIdx(HIST_HEADERS.length - 1);
    const filas = await leerHojaSafe(`registros_tiempo_historial!A2:${lastCol}`);
    rows = filas.map((f, i) => filaAObjeto(f, HIST_HEADERS, i + 2));
  }
  const idCol = prefix === "RT" ? "registro_id" : "evento_id";
  const existentes = rows
    .map(r => r[idCol] || "")
    .filter(id => id.startsWith(prefijo))
    .map(id => parseInt(id.split("-").pop(), 10))
    .filter(n => !isNaN(n));
  const siguiente = (existentes.length > 0 ? Math.max(...existentes) : 0) + 1;
  return `${prefijo}${String(siguiente).padStart(3, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================================
// DATOS DERIVADOS PERSONA (apodo / iniciales / color)
// ============================================================
function calcIniciales(nombre) {
  if (!nombre) return "??";
  const partes = String(nombre).trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function calcApodo(nombre, todasLasPersonas) {
  if (!nombre) return "?";
  const partes = String(nombre).trim().split(/\s+/);
  if (partes.length <= 2) return nombre;
  const primerasDos = partes.slice(0, 2).join(" ");
  const colisionesDos = (todasLasPersonas || []).filter(p =>
    (p.nombre || "").startsWith(primerasDos)
  );
  if (colisionesDos.length <= 1) return primerasDos;
  const tres = partes.slice(0, 3).join(" ");
  const colisionesTres = (todasLasPersonas || []).filter(p =>
    (p.nombre || "").startsWith(tres)
  );
  if (colisionesTres.length <= 1) return tres;
  if (partes[3]) return `${tres} ${partes[3][0]}.`;
  return tres;
}

function hashColor(id) {
  if (!id) return PALETA_AVATAR[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return PALETA_AVATAR[Math.abs(h) % PALETA_AVATAR.length];
}

function enriquecerPersona(p, todas) {
  if (!p) return null;
  return {
    id: p.id,
    nombre: p.nombre,
    apodo: calcApodo(p.nombre, todas),
    iniciales: calcIniciales(p.nombre),
    color: hashColor(p.id),
    puesto: p.puesto || "",
    coste_hora: parseFloat(p.coste_hora) || 0,
    fecha_baja: p.fecha_baja || "",
  };
}

// ============================================================
// VALIDADORES (v0.2.0 con soporte de tipos)
// ============================================================
async function validarPersona(persona_id, accionTipo = "crear") {
  const personas = await leerPersonas();
  const p = personas.find(r => r.id === persona_id);
  if (!p) return { ok: false, error: `Persona ${persona_id} no existe` };
  const inactiva = p.fecha_baja && p.fecha_baja.trim() !== "";
  if (inactiva && accionTipo === "crear") {
    return { ok: false, error: `Persona ${persona_id} (${p.nombre}) está dada de baja desde ${p.fecha_baja}` };
  }
  const cost = parseFloat(p.coste_hora);
  if (!cost || cost <= 0) {
    return {
      ok: false,
      error: `Persona ${persona_id} (${p.nombre}) no tiene coste_hora configurado. Rellénalo en la hoja personas (columna U).`,
    };
  }
  return { ok: true, persona: p };
}

async function validarObra(obra_id) {
  if (!obra_id) return { ok: false, error: "obra_id vacío" };

  // 1. Buscar en ordenes_trabajo (Plan5 fases 12-17)
  const obras = await leerObrasActivas();
  const o = obras.find(r => r.comunidad === obra_id);
  if (o) {
    if (!FASES_OT_VALIDAS.includes(o.fase_ot)) {
      return {
        ok: false,
        error: `Obra "${obra_id}" no está activa (fase: ${o.fase_ot || "vacía"}). Solo se registran horas en fases 12-17.`,
      };
    }
    return { ok: true, obra: o };
  }

  // 2. Buscar en comunidades (Plan5 fases 05-11)
  const obrasPanel = await leerObrasPanel();
  const p = obrasPanel.find(r => r.comunidad === obra_id);
  if (p) {
    return { ok: true, obra: { comunidad: p.comunidad, fase_ot: p.fase_presupuesto } };
  }

  // 3. Buscar en obras_otras (no Plan5)
  const obrasOtras = await leerObrasOtras();
  const q = obrasOtras.find(r => r.comunidad === obra_id);
  if (q) {
    return { ok: true, obra: { comunidad: q.comunidad, fase_ot: q.fase_otras } };
  }

  return { ok: false, error: `Obra "${obra_id}" no encontrada en ninguna fuente activa (ordenes_trabajo, comunidades Plan5 05-11, obras_otras)` };
}

// v0.5.0 — Al imputar tiempo a una obra de COMUNIDAD (Plan5) que aún no
// está en Órdenes de Trabajo, la pasamos sola a ejecución creando su OT
// en fase 12_INICIO_OBRA. El hecho de que los trabajadores hayan
// imputado horas implica que la obra ya está en ejecución, aunque siga
// en el Panel de Obras pendiente de documentación (son hojas distintas).
//
// Idempotente y NO BLOQUEANTE: si ya hay OT, o no es Plan5, o falla, no
// rompe el registro de tiempo. Solo aplica a comunidades Plan5 (no a
// obras_otras). Misma fila que panel-obras /ot/iniciar (cols A-K).
async function crearOTSiProcede(comunidad, usuario) {
  try {
    const nombre = (comunidad || "").trim();
    if (!nombre) return { creada: false, motivo: "sin_obra" };

    // ¿Ya tiene orden de trabajo? (entonces no hacemos nada)
    const filasOT = await leerHojaSafe("ordenes_trabajo!A2:B");
    const yaEnOT = filasOT.some(f => String(f[0] || "").trim() === nombre);
    if (yaEnOT) return { creada: false, motivo: "ya_en_ot" };

    // ¿Es una obra de comunidad (Plan5) en fase 05-11? Solo esas.
    const panel = await leerObrasPanel();
    if (!panel.some(o => o.comunidad === nombre)) {
      return { creada: false, motivo: "no_es_plan5" };
    }

    const ahora = nowIso();
    const quien = usuario || "ARA OS · Registro de tiempo";
    const fila = [
      nombre,            // A comunidad
      "12_INICIO_OBRA",  // B fase_ot
      ahora,             // C created_at
      quien,             // D created_by
      "",                // E fecha_inicio_obra
      "·",               // F materiales_pedidos
      "·",               // G presidente_avisado
      "·",               // H llaves_obtenidas
      "",                // I operarios_asignados
      ahora,             // J ultima_modificacion
      quien,             // K ultimo_modificador
    ];
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "ordenes_trabajo!A:K",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });
    return { creada: true, fase_ot: "12_INICIO_OBRA" };
  } catch (e) {
    console.warn("[crearOTSiProcede]", e.message);
    return { creada: false, error: e.message };
  }
}

async function validarTipo(tipo) {
  if (!tipo) tipo = "trabajo";
  const { map } = await leerTiposJornada();
  const t = map[tipo];
  if (!t) return { ok: false, error: `Tipo de jornada desconocido: "${tipo}"` };
  return { ok: true, tipoConfig: t };
}

function validarHoras(horas) {
  const h = parseFloat(horas);
  if (isNaN(h) || h <= 0) return { ok: false, error: "Horas debe ser > 0" };
  if (h > 24) return { ok: false, error: "Horas no puede ser > 24" };
  return { ok: true, horas: h };
}

function validarFecha(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: `Fecha inválida: ${fecha}. Formato esperado YYYY-MM-DD.` };
  }
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return { ok: false, error: `Fecha inválida: ${fecha}` };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 1);
  if (f > limite) return { ok: false, error: `Fecha futura no permitida: ${fecha}` };
  return { ok: true };
}

async function generarWarnings(fecha, persona_id, horas, registroIdExcluir = null) {
  const warnings = [];
  const registros = await leerRegistros();
  const otrasHorasDia = registros
    .filter(r =>
      r.fecha === fecha &&
      r.persona_id === persona_id &&
      r.borrado !== "TRUE" &&
      r.registro_id !== registroIdExcluir
    )
    .reduce((sum, r) => sum + (parseFloat(r.horas) || 0), 0);
  const totalDia = otrasHorasDia + parseFloat(horas);
  if (totalDia > 16) {
    warnings.push({ tipo: "jornada_imposible", mensaje: `Total ${totalDia}h ese día. Imposible, revisa.` });
  } else if (totalDia > 12) {
    warnings.push({ tipo: "jornada_larga", mensaje: `Jornada larga: ${totalDia}h ese día.` });
  }
  const dow = new Date(fecha + "T00:00:00").getDay();
  if (dow === 0 || dow === 6) {
    warnings.push({
      tipo: "fin_semana",
      mensaje: `${fecha} es ${dow === 0 ? "domingo" : "sábado"}.`,
    });
  }
  return warnings;
}

// Coste calculado con multiplicador del tipo
function calcularCoste(horas, costeHoraBase, multiplicador) {
  const m = parseFloat(multiplicador);
  return +(horas * costeHoraBase * (isNaN(m) ? 1 : m)).toFixed(2);
}

// ============================================================
// ESCRITURA EN SHEET
// ============================================================
async function appendRegistro(registro) {
  await asegurarPestanas();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(RT_HEADERS.length - 1);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `registros_tiempo!A:${lastCol}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [objetoAFila(registro, RT_HEADERS)] },
  });
  invalidarCacheRegistros();
}

async function updateRegistroEnFila(registro, rowIndex) {
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(RT_HEADERS.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `registros_tiempo!A${rowIndex}:${lastCol}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [objetoAFila(registro, RT_HEADERS)] },
  });
  invalidarCacheRegistros();
}

// ============================================================
// HISTORIAL append-only (no bloqueante)
// ============================================================
async function appendHistorial(evento) {
  await asegurarPestanas();
  const sheets = getSheetsClient();
  const lastCol = colLetterFromIdx(HIST_HEADERS.length - 1);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `registros_tiempo_historial!A:${lastCol}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [objetoAFila(evento, HIST_HEADERS)] },
  });
}

async function tryHistorial(tipo, registro, cambios, usuario) {
  try {
    const fecha = nowIso().split("T")[0];
    const evento = {
      evento_id: await genId("EV", fecha),
      registro_id: registro.registro_id,
      tipo_evento: tipo,
      snapshot_json: JSON.stringify(registro),
      cambios_json: cambios ? JSON.stringify(cambios) : "",
      evento_at: nowIso(),
      evento_by: usuario || "sistema",
    };
    await appendHistorial(evento);
  } catch (err) {
    console.warn("[registros-tiempo/tryHistorial] No se pudo registrar:",
      registro.registro_id, tipo, err.message);
  }
}

// ============================================================
// ENRIQUECER REGISTRO (con persona + tipo + coste)
// ============================================================
async function enriquecerRegistro(r, personasMap, personasTodas, tiposMap) {
  const persona = enriquecerPersona(personasMap[r.persona_id], personasTodas);
  const horas = parseFloat(r.horas) || 0;
  const tipoConfig = tiposMap[r.tipo || "trabajo"] || null;
  const multiplicador = tipoConfig ? parseFloat(tipoConfig.multiplicador_coste) || 1 : 1;
  const coste_calculado = persona ? calcularCoste(horas, persona.coste_hora, multiplicador) : null;
  return {
    ...r,
    horas,
    persona,
    tipo_config: tipoConfig ? {
      tipo: tipoConfig.tipo,
      etiqueta: tipoConfig.etiqueta,
      icono: tipoConfig.icono,
      color: tipoConfig.color,
      multiplicador_coste: multiplicador,
      necesita_obra: tipoConfig.necesita_obra === "TRUE",
    } : null,
    coste_calculado,
  };
}

// ============================================================
// API PÚBLICA: getHorasAcumuladasPorObra
// Usado desde panel-obras Fase 13 — solo cuenta tipos que tienen obra
// ============================================================
async function getHorasAcumuladasPorObra(obra_id) {
  const [registros, personas, tipos] = await Promise.all([
    leerRegistros(),
    leerPersonas(),
    leerTiposJornada(),
  ]);
  const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));

  // v0.3.2 — Resolver alias de obra para matchear partes guardados por nombre
  // El sistema viejo guarda los partes con el NOMBRE de la obra en r.obra_id
  // ("Regimiento de Soria 9 2"), pero ARA·OS nuevo pasa el código ("OO-2026-050").
  // Si obra_id empieza por "OO-" leemos obras_otras y resolvemos su nombre,
  // luego buscamos partes guardados con cualquiera de los dos identificadores.
  const aliases = new Set([obra_id]);
  if (typeof obra_id === "string" && /^OO-/.test(obra_id)) {
    try {
      const filas = await leerHojaSafe("obras_otras!A2:H");
      for (const f of filas) {
        const codigo = (f[0] || "").toString().trim();    // A = obra_id (OO-2026-NNN)
        const nombre = (f[1] || "").toString().trim();    // B = nombre
        if (codigo === obra_id && nombre) {
          aliases.add(nombre);
        }
      }
    } catch (e) {
      console.error("[registros-tiempo] error resolviendo alias obra:", e.message);
    }
  }

  const propios = registros.filter(r =>
    aliases.has(r.obra_id) &&
    r.borrado !== "TRUE" &&
    (r.tipo === "trabajo" || r.tipo === "extra" || !r.tipo)  // backward-compat
  );

  const porOperario = {};
  for (const r of propios) {
    const horas = parseFloat(r.horas) || 0;
    const pid = r.persona_id;
    const tipoConfig = tipos.map[r.tipo || "trabajo"];
    const multiplicador = tipoConfig ? parseFloat(tipoConfig.multiplicador_coste) || 1 : 1;
    if (!porOperario[pid]) {
      const p = personasMap[pid];
      const enriched = enriquecerPersona(p, personas);
      porOperario[pid] = {
        persona_id: pid,
        nombre: enriched?.nombre || pid,
        apodo: enriched?.apodo || pid,
        iniciales: enriched?.iniciales || "??",
        color: enriched?.color || PALETA_AVATAR[0],
        coste_hora: enriched?.coste_hora || 0,
        horas: 0,
        horas_normales: 0,
        horas_extra: 0,
        coste_total: 0,
      };
    }
    porOperario[pid].horas += horas;
    if (r.tipo === "extra") {
      porOperario[pid].horas_extra += horas;
    } else {
      porOperario[pid].horas_normales += horas;
    }
    porOperario[pid].coste_total += horas * porOperario[pid].coste_hora * multiplicador;
  }

  const lista = Object.values(porOperario).map(o => ({
    ...o,
    horas: +o.horas.toFixed(2),
    horas_normales: +o.horas_normales.toFixed(2),
    horas_extra: +o.horas_extra.toFixed(2),
    coste_total: +o.coste_total.toFixed(2),
  })).sort((a, b) => b.horas - a.horas);

  return {
    obra_id,
    total_horas: +lista.reduce((s, o) => s + o.horas, 0).toFixed(2),
    total_coste: +lista.reduce((s, o) => s + o.coste_total, 0).toFixed(2),
    por_operario: lista,
    actualizado: nowIso(),
  };
}

// ============================================================
// REGISTRO DE ENDPOINTS
// ============================================================
function registrar(app) {
  const bodyParser = require("body-parser");
  const jsonBodyParser = bodyParser.json({ limit: "1mb" });

  // CORS: mismo patrón que ara-os-timeline-fases.cjs
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // ---------- 0. PING ----------
  app.options("/api/ara-os/registros-tiempo/ping", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/registros-tiempo/ping", async (req, res) => {
    responderCORS(res);
    try {
      await asegurarPestanas();
      const [personas, registros, obras, tipos] = await Promise.all([
        leerPersonas(),
        leerRegistros(),
        leerObrasActivas(),
        leerTiposJornada(),
      ]);
      const obrasActivas = obras.filter(o => FASES_OT_VALIDAS.includes(o.fase_ot));
      res.json({
        ok: true,
        modulo: "ara-os-registros-tiempo",
        version: "v0.3.3",
        ts: nowIso(),
        sheets: {
          personas: {
            filas: personas.length,
            con_coste_hora: personas.filter(p => parseFloat(p.coste_hora) > 0).length,
            activas: personas.filter(p => !p.fecha_baja || p.fecha_baja.trim() === "").length,
            operarios_activos: personas.filter(p => (!p.fecha_baja || p.fecha_baja.trim() === "") && (p.rol || "").toLowerCase().trim() === "operario").length,
          },
          registros_tiempo: {
            filas: registros.length,
            no_borrados: registros.filter(r => r.borrado !== "TRUE").length,
          },
          ordenes_trabajo: {
            filas: obras.length,
            activas_para_horas: obrasActivas.length,
          },
          tipos_jornada: {
            filas: tipos.lista.length,
            tipos: tipos.lista.map(t => t.tipo),
          },
        },
        fases_validas: FASES_OT_VALIDAS,
      });
    } catch (e) {
      console.error("[GET /registros-tiempo/ping]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 1. GET /registros-tiempo (listado con filtros) ----------
  app.options("/api/ara-os/registros-tiempo", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/registros-tiempo", async (req, res) => {
    responderCORS(res);
    try {
      const { desde, hasta, persona_id, obra_id, tipo, source, incluir_borrados } = req.query;
      const [registros, personas, tipos] = await Promise.all([
        leerRegistros(),
        leerPersonas(),
        leerTiposJornada(),
      ]);
      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));

      const filtrados = registros.filter(r => {
        if (incluir_borrados !== "true" && r.borrado === "TRUE") return false;
        if (desde && r.fecha < desde) return false;
        if (hasta && r.fecha > hasta) return false;
        if (persona_id && r.persona_id !== persona_id) return false;
        if (obra_id && r.obra_id !== obra_id) return false;
        if (tipo && r.tipo !== tipo) return false;
        if (source && r.source !== source) return false;
        return true;
      });

      const enriquecidos = await Promise.all(
        filtrados.map(r => enriquecerRegistro(r, personasMap, personas, tipos.map))
      );

      const total_horas = enriquecidos.reduce((s, r) => s + r.horas, 0);
      const total_coste = enriquecidos.reduce((s, r) => s + (r.coste_calculado || 0), 0);

      res.json({
        ok: true,
        registros: enriquecidos,
        meta: {
          total_registros: enriquecidos.length,
          total_horas: +total_horas.toFixed(2),
          total_coste: +total_coste.toFixed(2),
          n_operarios: new Set(enriquecidos.map(r => r.persona_id)).size,
          n_obras: new Set(enriquecidos.filter(r => r.obra_id).map(r => r.obra_id)).size,
          por_tipo: enriquecidos.reduce((acc, r) => {
            const t = r.tipo || "trabajo";
            acc[t] = (acc[t] || 0) + r.horas;
            return acc;
          }, {}),
        },
      });
    } catch (e) {
      console.error("[GET /registros-tiempo]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 2. GET /registros-tiempo/dia/:fecha (agrupado por persona) ----------
  // Devuelve TODAS las personas activas con su detalle del día.
  // Si una persona no tiene registros, aparece como "pendiente".
  app.options("/api/ara-os/registros-tiempo/dia/:fecha", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/registros-tiempo/dia/:fecha", async (req, res) => {
    responderCORS(res);
    try {
      const { fecha } = req.params;
      const vFecha = validarFecha(fecha);
      if (!vFecha.ok) return res.status(400).json({ ok: false, error: vFecha.error });

      const [registros, personas, tipos] = await Promise.all([
        leerRegistros(),
        leerPersonas(),
        leerTiposJornada(),
      ]);

      const personasActivas = personas.filter(p => {
        const noEsBaja = !p.fecha_baja || p.fecha_baja.trim() === "";
        const esOperario = (p.rol || "").toLowerCase().trim() === "operario";
        return noEsBaja && esOperario;
      });

      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));
      const regsDelDia = registros.filter(r => r.fecha === fecha && r.borrado !== "TRUE");

      const resultado = await Promise.all(personasActivas.map(async p => {
        const regsPersona = regsDelDia.filter(r => r.persona_id === p.id);
        const personaEnriched = enriquecerPersona(p, personas);
        const items = await Promise.all(
          regsPersona.map(r => enriquecerRegistro(r, personasMap, personas, tipos.map))
        );
        const total_horas = items.reduce((s, r) => s + r.horas, 0);
        const total_coste = items.reduce((s, r) => s + (r.coste_calculado || 0), 0);

        // Estado: pendiente (sin registros), ok (con trabajo), baja (ausencia)
        let estado = "pendiente";
        if (items.length > 0) {
          const tieneAusencia = items.some(i =>
            i.tipo_config && !i.tipo_config.necesita_obra
          );
          const tieneTrabajo = items.some(i =>
            i.tipo_config && i.tipo_config.necesita_obra
          );
          if (tieneAusencia && !tieneTrabajo) estado = "ausencia";
          else estado = "ok";
        }

        return {
          persona: personaEnriched,
          estado,
          registros: items,
          total_horas: +total_horas.toFixed(2),
          total_coste: +total_coste.toFixed(2),
        };
      }));

      const total_dia_horas = resultado.reduce((s, r) => s + r.total_horas, 0);
      const total_dia_coste = resultado.reduce((s, r) => s + r.total_coste, 0);

      res.json({
        ok: true,
        fecha,
        personas: resultado,
        meta: {
          n_personas: resultado.length,
          n_pendientes: resultado.filter(r => r.estado === "pendiente").length,
          n_ausencias: resultado.filter(r => r.estado === "ausencia").length,
          n_trabajando: resultado.filter(r => r.estado === "ok").length,
          total_horas: +total_dia_horas.toFixed(2),
          total_coste: +total_dia_coste.toFixed(2),
        },
      });
    } catch (e) {
      console.error("[GET /registros-tiempo/dia/:fecha]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 3. POST /registros-tiempo (crear) ----------
  app.post("/api/ara-os/registros-tiempo", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const { fecha, persona_id, tipo, obra_id, horas, motivo, nota, usuario } = req.body || {};
      const tipoFinal = tipo || "trabajo";

      if (!fecha || !persona_id || horas === undefined) {
        return res.status(400).json({
          ok: false,
          error: "Faltan campos obligatorios: fecha, persona_id, horas",
        });
      }
      const vFecha = validarFecha(fecha);
      if (!vFecha.ok) return res.status(400).json({ ok: false, error: vFecha.error });
      const vHoras = validarHoras(horas);
      if (!vHoras.ok) return res.status(400).json({ ok: false, error: vHoras.error });
      const vPersona = await validarPersona(persona_id, "crear");
      if (!vPersona.ok) return res.status(400).json({ ok: false, error: vPersona.error });
      const vTipo = await validarTipo(tipoFinal);
      if (!vTipo.ok) return res.status(400).json({ ok: false, error: vTipo.error });

      // Validaciones condicionales según config del tipo
      const necesitaObra = vTipo.tipoConfig.necesita_obra === "TRUE";
      const motivoObligatorio = vTipo.tipoConfig.motivo_obligatorio === "TRUE";

      if (necesitaObra) {
        if (!obra_id) {
          return res.status(400).json({
            ok: false,
            error: `Tipo "${tipoFinal}" requiere obra_id`,
          });
        }
        const vObra = await validarObra(obra_id);
        if (!vObra.ok) return res.status(400).json({ ok: false, error: vObra.error });
      }
      if (motivoObligatorio && (!motivo || motivo.trim() === "")) {
        return res.status(400).json({
          ok: false,
          error: `Tipo "${tipoFinal}" requiere motivo`,
        });
      }

      const warnings = await generarWarnings(fecha, persona_id, vHoras.horas);
      const ahora = nowIso();
      // Snapshot coste_hora de la persona en este momento
      const personaSnap = vPersona.persona || {};
      const coste_hora_snap = parseFloat(personaSnap.coste_hora) || 0;

      const registro = {
        registro_id: await genId("RT", fecha),
        fecha,
        persona_id,
        tipo: tipoFinal,
        obra_id: necesitaObra ? obra_id : "",
        horas: vHoras.horas,
        motivo: (motivo || "").toString().slice(0, 500),
        nota: (nota || "").toString().slice(0, 500),
        source: "manual",
        created_at: ahora,
        created_by: usuario || "ARA OS",
        updated_at: ahora,
        updated_by: usuario || "ARA OS",
        borrado: "FALSE",
        coste_hora: coste_hora_snap,
      };
      await appendRegistro(registro);
      await tryHistorial("creado", registro, null, usuario);

      // v0.5.0 — Si la obra es de comunidad (Plan5) y aún no está en
      // Órdenes de Trabajo, al imputar tiempo la pasamos sola a ejecución
      // (fase 12). No bloqueante: nunca tumba el registro.
      let ot_creada = null;
      if (necesitaObra && obra_id) {
        const rOT = await crearOTSiProcede(obra_id, usuario);
        if (rOT.creada) ot_creada = { comunidad: obra_id, fase_ot: rOT.fase_ot };
      }

      // Enriquecer respuesta
      const personas = await leerPersonas();
      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));
      const tipos = await leerTiposJornada();
      const enriquecido = await enriquecerRegistro(registro, personasMap, personas, tipos.map);

      res.status(201).json({ ok: true, registro: enriquecido, warnings, ot_creada });
    } catch (e) {
      console.error("[POST /registros-tiempo]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 3.5. GET /registros-tiempo/tipos-jornada (antes que :id para evitar shadow) ----------
  app.options("/api/ara-os/registros-tiempo/tipos-jornada", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/registros-tiempo/tipos-jornada", async (req, res) => {
    responderCORS(res);
    try {
      const tipos = await leerTiposJornada();
      res.json({
        ok: true,
        tipos: tipos.lista.map(t => ({
          tipo: t.tipo,
          etiqueta: t.etiqueta,
          icono: t.icono,
          color: t.color,
          necesita_obra: t.necesita_obra === "TRUE",
          motivo_obligatorio: t.motivo_obligatorio === "TRUE",
          multiplicador_coste: parseFloat(t.multiplicador_coste) || 1,
        })),
      });
    } catch (e) {
      console.error("[GET /tipos-jornada]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 4. GET /registros-tiempo/:id ----------
  app.options("/api/ara-os/registros-tiempo/:id", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/registros-tiempo/:id", async (req, res) => {
    responderCORS(res);
    try {
      const { id } = req.params;
      const [registros, personas, tipos] = await Promise.all([
        leerRegistros(),
        leerPersonas(),
        leerTiposJornada(),
      ]);
      const r = registros.find(x => x.registro_id === id);
      if (!r) return res.status(404).json({ ok: false, error: `Registro ${id} no encontrado` });
      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));
      const enriquecido = await enriquecerRegistro(r, personasMap, personas, tipos.map);
      res.json({ ok: true, registro: enriquecido });
    } catch (e) {
      console.error("[GET /registros-tiempo/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 5. PATCH /registros-tiempo/:id ----------
  app.patch("/api/ara-os/registros-tiempo/:id", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const { id } = req.params;
      const cambios = req.body || {};
      const usuario = cambios.usuario || "ARA OS";
      const registros = await leerRegistros();
      const original = registros.find(r => r.registro_id === id);
      if (!original) return res.status(404).json({ ok: false, error: `Registro ${id} no encontrado` });
      if (original.borrado === "TRUE") {
        return res.status(400).json({ ok: false, error: "Registro borrado, no se puede editar" });
      }
      const camposEditables = ["fecha", "persona_id", "tipo", "obra_id", "horas", "motivo", "nota"];
      const diff = {};
      const nuevo = { ...original };
      for (const c of camposEditables) {
        if (cambios[c] !== undefined && String(cambios[c]) !== String(original[c])) {
          diff[c] = { antes: original[c], despues: cambios[c] };
          nuevo[c] = cambios[c];
        }
      }
      if (Object.keys(diff).length === 0) {
        return res.json({ ok: true, registro: original, cambios: {}, mensaje: "Sin cambios" });
      }

      // Re-validar lo que cambia + reglas según el tipo final
      const vTipo = await validarTipo(nuevo.tipo || "trabajo");
      if (!vTipo.ok) return res.status(400).json({ ok: false, error: vTipo.error });
      const necesitaObra = vTipo.tipoConfig.necesita_obra === "TRUE";
      const motivoObligatorio = vTipo.tipoConfig.motivo_obligatorio === "TRUE";

      if (diff.persona_id) {
        const v = await validarPersona(nuevo.persona_id, "editar");
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      }
      if (necesitaObra) {
        if (!nuevo.obra_id) return res.status(400).json({ ok: false, error: `Tipo "${nuevo.tipo}" requiere obra_id` });
        const v = await validarObra(nuevo.obra_id);
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      } else {
        nuevo.obra_id = ""; // limpiar obra si el tipo no la necesita
      }
      if (motivoObligatorio && (!nuevo.motivo || String(nuevo.motivo).trim() === "")) {
        return res.status(400).json({ ok: false, error: `Tipo "${nuevo.tipo}" requiere motivo` });
      }
      if (diff.horas) {
        const v = validarHoras(nuevo.horas);
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
        nuevo.horas = v.horas;
      }
      if (diff.fecha) {
        const v = validarFecha(nuevo.fecha);
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      }

      const warnings = await generarWarnings(nuevo.fecha, nuevo.persona_id, nuevo.horas, id);
      nuevo.updated_at = nowIso();
      nuevo.updated_by = usuario;
      const rowIndex = original._rowIndex;
      const aEscribir = { ...nuevo };
      delete aEscribir._rowIndex;
      await updateRegistroEnFila(aEscribir, rowIndex);
      await tryHistorial("editado", aEscribir, diff, usuario);

      const personas = await leerPersonas();
      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));
      const tipos = await leerTiposJornada();
      const enriquecido = await enriquecerRegistro(aEscribir, personasMap, personas, tipos.map);

      res.json({ ok: true, registro: enriquecido, cambios: diff, warnings });
    } catch (e) {
      console.error("[PATCH /registros-tiempo/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- 6. DELETE /registros-tiempo/:id ----------
  app.delete("/api/ara-os/registros-tiempo/:id", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      const { id } = req.params;
      const usuario = (req.body && req.body.usuario) || req.query.usuario || "ARA OS";
      const registros = await leerRegistros();
      const original = registros.find(r => r.registro_id === id);
      if (!original) return res.status(404).json({ ok: false, error: `Registro ${id} no encontrado` });
      if (original.borrado === "TRUE") {
        return res.json({ ok: true, mensaje: "Ya estaba borrado", registro: original });
      }
      const actualizado = {
        ...original,
        borrado: "TRUE",
        updated_at: nowIso(),
        updated_by: usuario,
      };
      const rowIndex = original._rowIndex;
      const aEscribir = { ...actualizado };
      delete aEscribir._rowIndex;
      await updateRegistroEnFila(aEscribir, rowIndex);
      await tryHistorial("borrado", aEscribir, null, usuario);
      res.json({ ok: true, registro: aEscribir });
    } catch (e) {
      console.error("[DELETE /registros-tiempo/:id]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // ============================================================
  // ADMIN: import histórico desde CSV Fixner
  // v0.3.0 — Bypasea validaciones de fase de obra y persona activa.
  // Idempotente: si la combinación (fecha+persona_id+obra_id+horas)
  // ya existe con source=fixner_import, salta.
  // ============================================================
  const { validToken } = require("./lib/auth.cjs");
  function tokenValido(req) {
    return validToken(req.query.token);
  }

  app.options("/api/ara-os/admin/registros-tiempo/import-historico", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/admin/registros-tiempo/import-historico", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }
    try {
      const { registros, dry_run } = req.body || {};
      if (!Array.isArray(registros) || registros.length === 0) {
        return res.status(400).json({ ok: false, error: "Falta array 'registros'" });
      }
      if (registros.length > 100) {
        return res.status(400).json({ ok: false, error: "Lote máximo de 100 registros" });
      }

      // Cargar contexto necesario
      const [personas, existentes] = await Promise.all([
        leerPersonas(),
        leerRegistros(),
      ]);
      const personasMap = Object.fromEntries(personas.map(p => [p.id, p]));

      // Hash de identidad para idempotencia
      function hashReg(r) {
        return `${r.fecha}|${r.persona_id}|${r.obra_id}|${parseFloat(r.horas).toFixed(2)}`;
      }
      const existentesHash = new Set(
        existentes
          .filter(r => r.source === "fixner_import" && r.borrado !== "TRUE")
          .map(r => hashReg(r))
      );

      const ahora = nowIso();
      const resultado = { creados: 0, saltados: 0, errores: [] };
      const aCrear = [];

      for (let i = 0; i < registros.length; i++) {
        const r = registros[i];
        // Validación mínima
        if (!r.fecha || !r.persona_id || !r.obra_id || r.horas === undefined) {
          resultado.errores.push({ idx: i, error: "Faltan campos", reg: r });
          continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) {
          resultado.errores.push({ idx: i, error: `Fecha inválida: ${r.fecha}`, reg: r });
          continue;
        }
        if (!personasMap[r.persona_id]) {
          resultado.errores.push({ idx: i, error: `Persona ${r.persona_id} no existe`, reg: r });
          continue;
        }
        const h = parseFloat(r.horas);
        if (isNaN(h) || h <= 0 || h > 24) {
          resultado.errores.push({ idx: i, error: `Horas inválidas: ${r.horas}`, reg: r });
          continue;
        }

        // Idempotencia
        const hash = hashReg({ fecha: r.fecha, persona_id: r.persona_id, obra_id: r.obra_id, horas: h });
        if (existentesHash.has(hash)) {
          resultado.saltados++;
          continue;
        }

        const registroNuevo = {
          registro_id: await genId("RT", r.fecha),
          fecha: r.fecha,
          persona_id: r.persona_id,
          tipo: r.tipo || "trabajo",
          obra_id: r.obra_id,
          horas: h,
          motivo: "",
          nota: (r.nota || "").toString().slice(0, 500),
          source: "fixner_import",
          created_at: ahora,
          created_by: "import-fixner",
          updated_at: ahora,
          updated_by: "import-fixner",
          borrado: "FALSE",
        };
        aCrear.push(registroNuevo);
        existentesHash.add(hash); // evitar duplicados dentro del mismo lote
      }

      if (dry_run) {
        return res.json({
          ok: true,
          dry_run: true,
          se_crearian: aCrear.length,
          se_saltarian: resultado.saltados,
          errores: resultado.errores,
        });
      }

      // Escritura real: append en lote (más rápido que uno a uno)
      if (aCrear.length > 0) {
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(RT_HEADERS.length - 1);
        const filas = aCrear.map(r => objetoAFila(r, RT_HEADERS));
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `registros_tiempo!A:${lastCol}`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: filas },
        });
        resultado.creados = aCrear.length;

        // Historial append-only (no bloqueante por cada uno)
        for (const r of aCrear) {
          tryHistorial("creado", r, null, "import-fixner").catch(() => {});
        }
      }

      res.json({ ok: true, ...resultado });
    } catch (e) {
      console.error("[POST /admin/import-historico]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-registros-tiempo v0.3.0] Módulo cargado. 9 endpoints: ping + CRUD + dia + tipos");
}

// v3.5 · Para la vista lista de OT necesitamos horas agregadas de
// TODAS las obras en una sola pasada (no 18 llamadas separadas).
// Devuelve un mapa { "Nombre Comunidad" → total_horas }.
async function getHorasAcumuladasMap() {
  const registros = await leerRegistros();
  const out = {};
  for (const r of registros) {
    if (r.borrado === "TRUE") continue;
    if (r.tipo && r.tipo !== "trabajo" && r.tipo !== "extra") continue;
    const k = (r.obra_id || "").trim();
    if (!k) continue;
    const h = parseFloat(r.horas) || 0;
    out[k] = (out[k] || 0) + h;
  }
  return out;
}

// Igual que getHorasAcumuladasMap pero solo cuenta registros hasta `hastaFecha` (YYYY-MM-DD inclusive).
async function getHorasAcumuladasMapHasta(hastaFecha) {
  const registros = await leerRegistros();
  const out = {};
  for (const r of registros) {
    if (r.borrado === "TRUE") continue;
    if (r.tipo && r.tipo !== "trabajo" && r.tipo !== "extra") continue;
    const k = (r.obra_id || "").trim();
    if (!k) continue;
    if (r.fecha && r.fecha > hastaFecha) continue;
    const h = parseFloat(r.horas) || 0;
    out[k] = (out[k] || 0) + h;
  }
  return out;
}

module.exports = registrar;
module.exports.getHorasAcumuladasPorObra = getHorasAcumuladasPorObra;
module.exports.getHorasAcumuladasMap = getHorasAcumuladasMap;
module.exports.getHorasAcumuladasMapHasta = getHorasAcumuladasMapHasta;
