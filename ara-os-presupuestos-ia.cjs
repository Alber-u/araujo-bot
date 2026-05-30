/**
 * ara-os-presupuestos-ia.cjs · v1.0.0 (30/05/2026)
 * --------------------------------------------------------------
 * Generador de partidas presupuestarias a partir de una descripción
 * de trabajo en lenguaje natural.
 *
 * Filosofía:
 *   Trabajo → Descripción → Partidas sugeridas → Revisión humana
 *
 * La IA NUNCA estima horas. Solo identifica QUÉ trabajos y QUÉ
 * materiales se necesitan. Las horas las introduce el técnico
 * humano que conoce las condiciones reales de la obra.
 *
 * Endpoints
 *   POST /api/ara-os/presupuestos/sugerir-partidas
 *     body { descripcion, tipo_obra?, presupuesto_id?, modelo? }
 *     → { ok, request_id, sugerencias[], meta }
 *
 *   POST /api/ara-os/presupuestos/sugerencia-feedback
 *     body { request_id, acciones: [{id_sugerencia, accion, ...}] }
 *     → { ok }
 *
 *   POST /api/ara-os/presupuestos/partida-manual-post-ia
 *     body { request_id, presupuesto_id, concepto, tipo }
 *     → { ok }
 *
 * Sheets (auto-bootstrap si no existen):
 *   · ara_os_ia_aprendizaje        — toda generación
 *   · ara_os_ia_feedback           — qué hizo el usuario con cada sugerencia
 *   · ara_os_ia_partidas_manuales  — partidas añadidas a mano DESPUÉS
 *                                    de una sesión IA (lo que la IA olvidó)
 *
 * Modelo:
 *   Por defecto claude-haiku-4-5 (rápido, barato, ~0.5¢/llamada).
 *   La rama Sonnet está implementada pero no expuesta en UI todavía.
 * --------------------------------------------------------------
 */
const { google } = require("googleapis");
const express = require("express");
const crypto = require("node:crypto");
const { validToken } = require("./lib/auth.cjs");
const { CATALOGO } = require("./ara-catalogo-data.cjs");

// ── Configuración ─────────────────────────────────────────────
const TAB_APRENDIZAJE = "ara_os_ia_aprendizaje";
const TAB_FEEDBACK    = "ara_os_ia_feedback";
const TAB_MANUALES    = "ara_os_ia_partidas_manuales";

const HEADERS_APRENDIZAJE = [
  "id", "fecha", "modelo", "presupuesto_id", "tipo_obra",
  "descripcion_input", "sugerencias_json",
  "latencia_ms", "tokens_in", "tokens_out", "coste_usd",
];
const HEADERS_FEEDBACK = [
  "id_sugerencia", "request_id", "accion", "fecha",
  "concepto_original", "concepto_final",
  "tipo_original", "tipo_final",
  "catalogo_id_sugerido", "catalogo_id_final",
];
const HEADERS_MANUALES = [
  "request_id", "presupuesto_id", "fecha",
  "concepto_añadido", "tipo",
];

const MODELOS = {
  haiku:  "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};
// Tarifas aproximadas (USD por millón de tokens)
const TARIFAS = {
  "claude-haiku-4-5-20251001": { in: 1.0,  out: 5.0  },
  "claude-sonnet-4-6":         { in: 3.0,  out: 15.0 },
};

// ── Prompt del sistema ────────────────────────────────────────
// v1.1 · Cada partida = UN TRABAJO completo. Los materiales no son
//        partidas independientes: van dentro del trabajo al que
//        pertenecen. Refleja cómo se ejecuta y se factura realmente
//        una obra de fontanería.
const SYSTEM_PROMPT = `Eres un técnico experto en presupuestos de fontanería e instalaciones para Instalaciones Araujo (Sevilla). Recibes la descripción de un trabajo en lenguaje natural y propones LA ESTRUCTURA DE TRABAJOS PRESUPUESTABLES, no una lista de materiales sueltos.

CONCEPTO CLAVE — Cada PARTIDA es un TRABAJO completo a ejecutar:
  · Un trabajo describe QUÉ se va a hacer (ej. "Instalación de columna multicapa", "Demolición y retirada de bajante existente").
  · Cada trabajo lleva DENTRO los materiales típicos que se necesitan para ejecutarlo.
  · Los materiales NO son partidas independientes. Van anidados en el campo "materiales" de su trabajo correspondiente.
  · Solo los costes generales (gestión residuos, medios auxiliares, tasas) se crean como partidas tipo "directo".

REGLAS CRÍTICAS:
1. NO estimes horas de trabajo bajo ninguna circunstancia. Las horas las introduce el técnico humano.
2. CALIDAD > CANTIDAD. Máximo 6 trabajos + máximo 2 directos. Si tienes dudas, NO incluyas.
3. Cada trabajo debe tener un nombre claro: una actuación de obra completa, no una fase microscópica.
4. Los materiales dentro de un trabajo deben ser los PRINCIPALES: tubería, bajantes, llaves, contadores, cazoletas, codos importantes, abrazaderas estructurales. NUNCA listes: tornillos, tacos, cinta de teflón, silicona, sellador, soldadura común — eso está incluido implícitamente.
5. Para cada material propón cantidad_sugerida y unidad (ml, ud, m², kg…).
6. Tipos de partida:
   · "trabajo" → actuación de obra (con o sin materiales asociados)
   · "directo" → coste sin desglose (gestión residuos, medios auxiliares, tasas)
7. Confianza 0-1 según seguridad de que ese trabajo es necesario para ESTA obra concreta.
8. razonamiento: 1 frase corta.
9. Ordena las partidas según el FLUJO REAL de ejecución: demolición → retirada → instalación → reposición → cierre.
10. NO inventes garantías, plazos, precios ni recargos.
11. Si la descripción es muy ambigua, devuelve solo los 3-4 trabajos más obvios.
12. Vocabulario en español de España, técnico pero claro.

EJEMPLO de respuesta CORRECTA para "Sustitución de bajante de cocina":
  [
    { tipo: "trabajo", concepto: "Demolición de paramento y retirada de bajante existente",
      materiales: [], confianza: 0.95 },
    { tipo: "trabajo", concepto: "Instalación de nuevo bajante PVC Ø125",
      materiales: [
        { concepto: "Tubería PVC evacuación Ø125", cantidad: 4, unidad: "ml" },
        { concepto: "Codo PVC 45° Ø125", cantidad: 2, unidad: "ud" },
        { concepto: "Abrazadera isofónica Ø125", cantidad: 5, unidad: "ud" }
      ], confianza: 0.95 },
    { tipo: "trabajo", concepto: "Reposición de albañilería y enfoscado",
      materiales: [], confianza: 0.90 },
    { tipo: "directo", concepto: "Gestión de residuos de obra",
      cantidad_sugerida: 1, unidad: "ud", confianza: 0.85 }
  ]

EJEMPLO INCORRECTO (NO HAGAS ESTO):
  [
    { tipo: "mo", concepto: "Demolición" },
    { tipo: "material", concepto: "Tubería PVC" },     ← NO. Va dentro del trabajo de instalación.
    { tipo: "material", concepto: "Codos PVC" },        ← NO.
    { tipo: "material", concepto: "Abrazaderas" },      ← NO.
    { tipo: "mo", concepto: "Instalación" },
    ...
  ]`;

const MAX_PARTIDAS = 8;

// ── Cliente Sheets (OAuth2 igual que el resto del bot) ────────
let _sheetsClient = null;
function getSheets() {
  if (_sheetsClient) return _sheetsClient;
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheetsClient = google.sheets({ version: "v4", auth: oauth2 });
  return _sheetsClient;
}

// ── Auto-bootstrap de pestañas ────────────────────────────────
const _pestanasOk = new Set();
async function asegurarPestana(tab, headers) {
  if (_pestanasOk.has(tab)) return;
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
  const existe = meta.data.sheets.some(s => s.properties.title === tab);
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  const colsLetra = String.fromCharCode(64 + headers.length); // A,B,C…
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${tab}!A1:${colsLetra}1`,
  });
  const fila = r.data.values?.[0] || [];
  const necesita = fila.length < headers.length || headers.some((h, i) => fila[i] !== h);
  if (necesita) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${tab}!A1:${colsLetra}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
  _pestanasOk.add(tab);
}

async function appendFila(tab, headers, fila) {
  await asegurarPestana(tab, headers);
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${tab}!A:${String.fromCharCode(64 + headers.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [fila] },
  });
}

// ── Matching con catálogo ─────────────────────────────────────
// Estrategia v1.1: stemming ligero ES + sinónimos fontanería +
// boost por términos de familia (multicapa, pvc, pex…). Suficiente
// para un catálogo de ~200 productos. Cuando crezca → embeddings.
function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ºª/.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// Stemming muy ligero para español: quita plurales típicos.
// Conserva singulares de palabras técnicas (te, pe).
function stem(w) {
  if (w.length <= 3) return w;
  if (w.endsWith("ces") && w.length > 4) return w.slice(0, -3) + "z"; // luces → luz
  if (w.endsWith("es")  && w.length > 4) return w.slice(0, -2);       // llaves → llav (aprox)
  if (w.endsWith("s")   && w.length > 3) return w.slice(0, -1);       // codos → codo
  return w;
}
// Sinónimos típicos de fontanería · todos en singular ya stemmeado
const SINONIMOS = {
  "llav":    ["valvula", "llave"],
  "valvula": ["llav", "llave"],
  "corte":   ["paso", "esfera", "bola"],
  "paso":    ["corte"],
  "tubo":    ["tuberia", "tuberi"],
  "tuberia": ["tubo", "tuberi"],
  "tuberi":  ["tubo", "tuberia"],
};
function tokens(s) {
  const raw = normalizar(s).split(" ").filter(t => t.length >= 2);
  const out = new Set();
  for (const t of raw) {
    const r = stem(t);
    out.add(r);
    const sin = SINONIMOS[r];
    if (sin) for (const x of sin) out.add(x);
  }
  return out;
}
// Términos muy discriminantes: si los dos lados los comparten,
// muy probablemente sea el mismo producto / familia.
const PALABRAS_FAMILIA = new Set([
  "multicapa","pex","pvc","cobre","laton","polietileno","pe",
  "evacuacion","aenor","emasesa","electrofusion","inox",
  "abrazadera","codo","te","manguito","racor","fitting","valvula",
  "llav","tuberia","tuberi","tubo","filtro","contador","grifo",
  "bateria","latiguillo","aislamiento","empotrar",
]);
function similitud(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0, interFamilia = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      inter++;
      if (PALABRAS_FAMILIA.has(t)) interFamilia++;
    }
  }
  if (inter === 0) return 0;
  const jaccard   = inter / (ta.size + tb.size - inter);
  const cobertura = inter / Math.min(ta.size, tb.size);
  // base = lo mejor entre jaccard y cobertura (la cobertura pesa
  // más porque queremos premiar "todos mis tokens están allí")
  let score = Math.max(jaccard, cobertura * 0.90);
  // Boost · cada palabra de familia coincidente suma 0.10 hasta 0.25
  score += Math.min(0.25, interFamilia * 0.10);
  return Math.min(1, score);
}

function precioBase(producto) {
  // El primero disponible, neto = bruto * (1 - dto/100)
  const provs = Object.values(producto.proveedores || {});
  if (provs.length === 0) return null;
  const p = provs[0];
  const neto = (p.bruto || 0) * (1 - (p.dto || 0) / 100);
  return Math.round(neto * 100) / 100;
}

function buscarEnCatalogo(concepto, umbral = 0.40) {
  let mejor = null, mejorScore = 0;
  for (const p of CATALOGO) {
    const s = similitud(concepto, p.desc);
    if (s > mejorScore) { mejorScore = s; mejor = p; }
  }
  if (mejor && mejorScore >= umbral) {
    return {
      catalogo_id: mejor.id,
      catalogo_desc: mejor.desc,
      catalogo_unidad: mejor.unidad,
      catalogo_precio_base: precioBase(mejor),
      match_score: Math.round(mejorScore * 100) / 100,
    };
  }
  return null;
}

// ── Tool schema para Anthropic tool-use ───────────────────────
const TOOL_PROPONER = {
  name: "proponer_partidas",
  description: "Propone la estructura de TRABAJOS para presupuestar una actuación de fontanería e instalaciones. Cada trabajo lleva ANIDADOS los materiales principales que necesita; no devuelvas materiales como partidas independientes.",
  input_schema: {
    type: "object",
    properties: {
      tipo_obra_inferido: {
        type: "string",
        description: "Categoría inferida (cambio_bajantes, columna_general, rehabilitacion_bano, contador_individual, otros)."
      },
      partidas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: ["trabajo", "directo"],
              description: "trabajo = actuación de obra (puede incluir materiales). directo = coste sin desglose (gestión residuos, medios auxiliares, tasas)."
            },
            concepto: { type: "string", description: "Nombre del trabajo o del coste directo. Una actuación concreta y clara." },
            materiales: {
              type: "array",
              description: "SOLO para tipo 'trabajo'. Materiales principales que requiere este trabajo concreto. Lista vacía si el trabajo es solo mano de obra (demolición, retirada, prueba estanqueidad…). NUNCA incluir tornillería, cinta, silicona, sellador.",
              items: {
                type: "object",
                properties: {
                  concepto:           { type: "string" },
                  cantidad_sugerida:  { type: "number" },
                  unidad:             { type: "string", description: "ml, ud, m², kg, bote" }
                },
                required: ["concepto"]
              }
            },
            unidad:            { type: "string", description: "SOLO para tipo 'directo'." },
            cantidad_sugerida: { type: "number", description: "SOLO para tipo 'directo'." },
            confianza: { type: "number", minimum: 0, maximum: 1 },
            razonamiento: { type: "string", description: "1 frase corta." }
          },
          required: ["tipo", "concepto", "confianza"]
        }
      }
    },
    required: ["partidas"]
  }
};

// ── Llamada a Anthropic ───────────────────────────────────────
async function llamarClaude(descripcion, tipoObra, modeloId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const userMsg = tipoObra
    ? `Tipo de obra: ${tipoObra}\n\nDescripción del trabajo:\n${descripcion}`
    : `Descripción del trabajo (infiere tú el tipo de obra):\n${descripcion}`;

  const body = {
    model: modeloId,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [TOOL_PROPONER],
    tool_choice: { type: "tool", name: "proponer_partidas" },
    messages: [{ role: "user", content: userMsg }],
  };

  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const latencia = Date.now() - t0;
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Claude API ${r.status}: ${err}`);
  }
  const j = await r.json();
  const useBlock = (j.content || []).find(c => c.type === "tool_use");
  if (!useBlock) throw new Error("Claude no devolvió tool_use");
  return {
    payload: useBlock.input,
    tokens_in:  j.usage?.input_tokens  || 0,
    tokens_out: j.usage?.output_tokens || 0,
    latencia_ms: latencia,
  };
}

function calcularCoste(modeloId, tokIn, tokOut) {
  const t = TARIFAS[modeloId] || { in: 0, out: 0 };
  return (tokIn * t.in / 1_000_000) + (tokOut * t.out / 1_000_000);
}

// ── Enriquecimiento de la respuesta IA ────────────────────────
// Si la IA ignora el cap del prompt, lo aplicamos del lado del
// servidor: primero por confianza descendente, luego limitamos.
function recortarTop(partidasIA, max) {
  const arr = (partidasIA || []).slice();
  arr.sort((a, b) => (b.confianza || 0) - (a.confianza || 0));
  return arr.slice(0, max);
}
// v1.1 · Estructura nueva: cada partida es un TRABAJO con materiales
//        anidados. El backend resuelve los matches del catálogo para
//        cada material y calcula el coste total que entrará como
//        material_eur en la partida creada.
function enriquecerSugerencias(partidasIA) {
  return (partidasIA || []).map(p => {
    const tipo = p.tipo === "directo" ? "directo" : "trabajo";  // saneo
    const sug = {
      id: crypto.randomUUID(),
      tipo,
      concepto: String(p.concepto || "").trim(),
      confianza: typeof p.confianza === "number" ? p.confianza : 0.5,
      razonamiento: p.razonamiento || "",
      // Solo para 'directo'
      unidad: null,
      cantidad_sugerida: null,
      catalogo_id: null,
      catalogo_precio_base: null,
      // Solo para 'trabajo' · array de materiales enriquecidos
      materiales: [],
      material_eur_total: 0,
    };
    if (tipo === "directo") {
      sug.unidad            = p.unidad || null;
      sug.cantidad_sugerida = p.cantidad_sugerida ?? null;
      // Algunos directos también pueden tener match (ej. "Jornada de elevador")
      const m = buscarEnCatalogo(sug.concepto);
      if (m) {
        sug.catalogo_id          = m.catalogo_id;
        sug.catalogo_precio_base = m.catalogo_precio_base;
        if (!sug.unidad && m.catalogo_unidad) sug.unidad = m.catalogo_unidad;
      }
    } else {
      // Trabajo · enriquecer cada material asociado con su match
      const mats = Array.isArray(p.materiales) ? p.materiales : [];
      for (const m of mats) {
        const concepto = String(m.concepto || "").trim();
        if (!concepto) continue;
        const match = buscarEnCatalogo(concepto);
        const cantidad = m.cantidad_sugerida ?? null;
        const precio   = match?.catalogo_precio_base ?? null;
        const subtotal = (cantidad != null && precio != null)
          ? +(cantidad * precio).toFixed(2)
          : null;
        sug.materiales.push({
          id: crypto.randomUUID(),
          concepto,
          cantidad_sugerida: cantidad,
          unidad: m.unidad || match?.catalogo_unidad || null,
          catalogo_id:          match?.catalogo_id          ?? null,
          catalogo_precio_base: match?.catalogo_precio_base ?? null,
          subtotal_eur: subtotal,
        });
        if (subtotal != null) sug.material_eur_total += subtotal;
      }
      sug.material_eur_total = +sug.material_eur_total.toFixed(2);
    }
    return sug;
  });
}

// ══════════════════════════════════════════════════════════════
// MÓDULO
// ══════════════════════════════════════════════════════════════
module.exports = function(app) {
  const jsonBodyParser = express.json({ limit: "256kb" });

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // ─── POST · sugerir-partidas ────────────────────────────────
  app.options("/api/ara-os/presupuestos/sugerir-partidas", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/presupuestos/sugerir-partidas", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      const body = req.body || {};
      const descripcion = String(body.descripcion || "").trim();
      if (descripcion.length < 20) {
        return res.status(400).json({ ok: false, error: "Descripción demasiado corta (mínimo 20 caracteres)" });
      }
      const tipoObra = String(body.tipo_obra || "").trim() || null;
      const presupuestoId = String(body.presupuesto_id || "").trim() || null;
      const modeloKey = body.modelo === "sonnet" ? "sonnet" : "haiku";
      const modeloId = MODELOS[modeloKey];

      const { payload, tokens_in, tokens_out, latencia_ms } = await llamarClaude(descripcion, tipoObra, modeloId);
      const partidasTop = recortarTop(payload.partidas, MAX_PARTIDAS);
      const sugerencias = enriquecerSugerencias(partidasTop);
      const tipoObraInferido = payload.tipo_obra_inferido || tipoObra;

      const requestId = crypto.randomUUID();
      const costeUsd = calcularCoste(modeloId, tokens_in, tokens_out);

      // Persistencia · learning data desde el día 1
      try {
        await appendFila(TAB_APRENDIZAJE, HEADERS_APRENDIZAJE, [
          requestId,
          new Date().toISOString(),
          modeloId,
          presupuestoId || "",
          tipoObraInferido || "",
          descripcion,
          JSON.stringify(sugerencias),
          String(latencia_ms),
          String(tokens_in),
          String(tokens_out),
          costeUsd.toFixed(6),
        ]);
      } catch (e) {
        console.warn("[ia] no se pudo persistir aprendizaje:", e.message);
      }

      res.json({
        ok: true,
        request_id: requestId,
        tipo_obra: tipoObraInferido,
        sugerencias,
        meta: {
          modelo: modeloId,
          latencia_ms,
          tokens_in,
          tokens_out,
          coste_usd: +costeUsd.toFixed(6),
        },
      });
    } catch (e) {
      console.error("[ia/sugerir-partidas]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── POST · sugerencia-feedback ─────────────────────────────
  app.options("/api/ara-os/presupuestos/sugerencia-feedback", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/presupuestos/sugerencia-feedback", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      const body = req.body || {};
      const requestId = String(body.request_id || "").trim();
      const acciones = Array.isArray(body.acciones) ? body.acciones : [];
      if (!requestId || acciones.length === 0) {
        return res.status(400).json({ ok: false, error: "Faltan request_id o acciones" });
      }
      const ts = new Date().toISOString();
      for (const a of acciones) {
        await appendFila(TAB_FEEDBACK, HEADERS_FEEDBACK, [
          String(a.id_sugerencia || ""),
          requestId,
          String(a.accion || ""),         // aceptada | aceptada_editada | eliminada | ignorada
          ts,
          String(a.concepto_original || ""),
          String(a.concepto_final || ""),
          String(a.tipo_original || ""),
          String(a.tipo_final || ""),
          String(a.catalogo_id_sugerido || ""),
          String(a.catalogo_id_final || ""),
        ]);
      }
      res.json({ ok: true, registradas: acciones.length });
    } catch (e) {
      console.error("[ia/feedback]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── POST · partida-manual-post-ia ──────────────────────────
  // Permite marcar una partida añadida a mano DESPUÉS de una
  // sesión IA: lo que la IA olvidó. Oro puro para aprendizaje.
  app.options("/api/ara-os/presupuestos/partida-manual-post-ia", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/presupuestos/partida-manual-post-ia", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      const body = req.body || {};
      const requestId = String(body.request_id || "").trim();
      if (!requestId) return res.status(400).json({ ok: false, error: "Falta request_id" });
      await appendFila(TAB_MANUALES, HEADERS_MANUALES, [
        requestId,
        String(body.presupuesto_id || ""),
        new Date().toISOString(),
        String(body.concepto || ""),
        String(body.tipo || ""),
      ]);
      res.json({ ok: true });
    } catch (e) {
      console.error("[ia/manual-post-ia]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log("[ara-os-presupuestos-ia v1.0.0] montado · 3 endpoints · modelo por defecto haiku-4-5");
};
