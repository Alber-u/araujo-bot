// ============================================================
// ARA OS — Certificaciones de obra (avance presupuesto vs real)
// v0.3.1 — Sprint 17/05/2026 (hotfix)
//   · Fix CORS: añadido middleware app.use("/api/certificaciones",...)
//     que aplica los headers a todas las rutas del módulo y maneja
//     preflight OPTIONS. Mismo patrón que ara-os-acciones / ara-catalogo.
//
// v0.3.0 — Sprint 17/05/2026
//   · Nuevo endpoint GET /api/certificaciones/obras → listado con KPIs.
//
// v0.2.1 — Fix parseo numérico locale ES con helper toNum().
// v0.2.0 — Reescritura con OAuth2 + env GOOGLE_SHEETS_ID + leerHojaSafe robusto.
// v0.1.0 — Diseño inicial: parser presupuesto + esquema 4 tablas.
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

// ============================================================
// CONSTANTES
// ============================================================
const DIA_CUADRILLA_HORAS = 16; // 1 día/cuadrilla = 2 personas × 8h (solo display)

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
  "notas_generales", "created_at",
];
const VISITA_ESTADO_HEADERS = [
  "estado_id", "visita_id", "partida_id",
  "progreso_pct", "motivo_retraso", "created_at",
];
const DESGLOSE_HEADERS = [
  "desglose_id", "obra_id", "partida_id", "persona_id",
  "horas_imputadas", "fecha_imputacion", "imputado_por",
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

async function getPersonasMap() {
  const personas = await leerTabla("personas", PERS_HEADERS);
  const map = {};
  for (const p of personas) map[p.id] = p.nombre || p.id;
  return map;
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

      // Borrar partidas previas de esta obra (idempotente)
      const partidasExistentes = await leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS);
      const restantes = partidasExistentes.filter((p) => p.obra_id !== obra_id);
      if (restantes.length !== partidasExistentes.length) {
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(PARTIDAS_HEADERS.length - 1);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `${HOJA_PARTIDAS}!A2:${lastCol}`,
        });
        if (restantes.length > 0) {
          await appendTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS, restantes);
        }
      }

      // Insertar nuevas partidas
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
      await appendTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS, filas);

      res.json({
        ok: true,
        obra_id,
        bloques: bloques.length,
        partidas_importadas: filas.length,
      });
    } catch (e) {
      console.error("[certif/importar]", e);
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
      const [partidasRaw, visitasRaw, estadosRaw] = await Promise.all([
        leerTabla(HOJA_PARTIDAS, PARTIDAS_HEADERS),
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
      ]);

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
        return {
          obra_id: o.obra_id,
          partidas_total: o.partidas_total,
          partidas_activas: o.partidas_activas,
          previsto_horas: Math.round(o.previsto_horas * 100) / 100,
          previsto_dias: Math.round((o.previsto_horas / DIA_CUADRILLA_HORAS) * 100) / 100,
          total_visitas: visitasPorObra[o.obra_id] || 0,
          ultima_visita_fecha: ult ? ult.fecha : null,
          avance_pct: avance,
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

      const estadoUltimaVisita = ultimaVisita
        ? estadosRaw.filter((e) => e.visita_id === ultimaVisita.visita_id)
        : [];
      const estadoMap = {};
      for (const e of estadoUltimaVisita) estadoMap[e.partida_id] = e;

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

      res.json({
        ok: true,
        obra_id,
        bloques: bloqueOrden.map((n) => bloques[n]),
        ultima_visita: ultimaVisita,
        total_visitas: visitas.length,
        operarios_reales: operariosReales,
        totales: {
          previsto_horas: Math.round(totalPrevistoH * 100) / 100,
          previsto_dias: Math.round((totalPrevistoH / DIA_CUADRILLA_HORAS) * 100) / 100,
          imputado_horas: Math.round(totalImputado * 100) / 100,
          real_horas: Math.round(totalRealH * 100) / 100,
          por_imputar: Math.round((totalRealH - totalImputado) * 100) / 100,
        },
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
      const [visitasRaw, estadosRaw] = await Promise.all([
        leerTabla(HOJA_VISITAS, VISITAS_HEADERS),
        leerTabla(HOJA_VISITA_ESTADO, VISITA_ESTADO_HEADERS),
      ]);
      const visitas = visitasRaw
        .filter((v) => v.obra_id === obra_id)
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
        .map((v) => ({
          ...v,
          estados: estadosRaw.filter((e) => e.visita_id === v.visita_id),
        }));
      res.json({ ok: true, obra_id, visitas });
    } catch (e) {
      console.error("[certif/visitas]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/obra/:obra_id/visita
  // body: { fecha, autor, notas_generales, estados:[{partida_id,progreso_pct,motivo_retraso}] }
  // ----------------------------------------------------------
  app.post("/api/certificaciones/obra/:obra_id/visita", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const { fecha, autor, notas_generales = "", estados = [] } = req.body || {};
      if (!fecha || !autor) return res.status(400).json({ ok: false, error: "Falta fecha o autor" });
      if (!Array.isArray(estados)) return res.status(400).json({ ok: false, error: "estados debe ser array" });

      const visita_id = nuevoId("visita");
      const nowIso = new Date().toISOString();

      await appendTabla(HOJA_VISITAS, VISITAS_HEADERS, [{
        visita_id, obra_id, fecha, autor, notas_generales, created_at: nowIso,
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

      res.json({ ok: true, visita_id, estados_registrados: estados.length });
    } catch (e) {
      console.error("[certif/visita]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/certificaciones/obra/:obra_id/desglose
  // body: { partida_id, persona_id, horas_imputadas, imputado_por }
  // ----------------------------------------------------------
  app.post("/api/certificaciones/obra/:obra_id/desglose", express.json(), async (req, res) => {
    try {
      await asegurarPestanas();
      const obra_id = decodeURIComponent(req.params.obra_id);
      const { partida_id, persona_id, horas_imputadas, imputado_por } = req.body || {};
      if (!partida_id || !persona_id || horas_imputadas == null) {
        return res.status(400).json({ ok: false, error: "Faltan campos (partida_id, persona_id, horas_imputadas)" });
      }
      const horas = Number(horas_imputadas);
      if (isNaN(horas) || horas < 0) {
        return res.status(400).json({ ok: false, error: "horas_imputadas inválido" });
      }
      await appendTabla(HOJA_DESGLOSE, DESGLOSE_HEADERS, [{
        desglose_id: nuevoId("desg"),
        obra_id,
        partida_id,
        persona_id,
        horas_imputadas: horas,
        fecha_imputacion: new Date().toISOString(),
        imputado_por: imputado_por || "",
      }]);
      res.json({ ok: true });
    } catch (e) {
      console.error("[certif/desglose]", e);
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

  console.log("[ara-os-certificaciones] v0.3.1 cargado");
};
