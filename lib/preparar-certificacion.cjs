// ============================================================
// lib/preparar-certificacion.cjs — «Preparar certificación» en obras privadas aceptadas (Alberto, 07/10/2026)
// ============================================================
// Una obra privada (OO) se presupuesta con pocas partidas para el cliente («Total material y mano de obra»).
// Para poder visitarla en Certificaciones se divide por dentro en partidas de control: nombre, horas (suman
// exactamente las horas previstas del presupuesto) y cómo se mide el avance. El cliente no ve nada de esto:
// el precio, sus partidas y el texto del presupuesto no cambian.
//   · propuesta: Urbano Orad (OO-2026-142 y OO-2026-143) → las 7 de lib/partidas-orad.cjs; el resto, con el
//     mismo motor que «Generar partidas con IA» a partir de la descripción (factura_descripcion)
//   · guardar: una preparación por OO; las partidas que ya están (las de Orad) no se repiten
// medicion: { tipo: hecho | hecho_pct | pct | conteo, unidad, total | total_de }
//   conteo sin N en el presupuesto → «a contar en obra»: total_de = unidad (JM lo pone una vez en la ficha)
// ============================================================
"use strict";

const PO = require("./partidas-orad.cjs");

const TIPOS = new Set(["hecho", "hecho_pct", "pct", "conteo"]);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const casi = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

// la ficha de Certificaciones de una OO: Orad, la de su portal; el resto, el nombre de la orden
function certObraDe(oo) {
  const portal = PO.PORTALES_ORAD.find((p) => p.presupuesto === oo?.obra_id);
  return portal ? portal.obra_id : String(oo?.nombre || oo?.obra_id || "").trim();
}

// horas enteras que suman exactamente el total (mayor resto); si el total lleva decimales, a la mayor
function ajustarHoras(horas, total) {
  const xs = horas.map((h) => (Number(h) > 0 ? Number(h) : 0));
  const T = Number(total) || 0;
  const suma = xs.reduce((t, h) => t + h, 0);
  if (!xs.length || !(T > 0)) return xs.map(() => 0);
  const esc = xs.map((h) => (suma > 0 ? (h / suma) * T : T / xs.length));
  const ent = Math.floor(T);
  const base = esc.map((h) => Math.floor(h));
  let falta = ent - base.reduce((t, h) => t + h, 0);
  const orden = esc.map((h, i) => [h - Math.floor(h), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; falta > 0 && orden.length; k = (k + 1) % orden.length, falta--) base[orden[k][1]]++;
  const resto = r2(T - ent);
  if (resto) { const i = base.indexOf(Math.max(...base)); base[i] = r2(base[i] + resto); }
  return base;
}

// medición limpia (o un error)
function limpiarMedicion(m) {
  const tipo = String(m?.tipo || "").trim();
  if (!TIPOS.has(tipo)) return { error: "medida: hecho / no hecho, % o «X de N»" };
  if (tipo !== "conteo") return { medicion: { tipo } };
  const unidad = String(m.unidad || "").trim().toLowerCase();
  if (!unidad) return { error: "«X de N» necesita la unidad (viviendas, columnas, tramos…)" };
  const total = Number(m.total);
  if (m.total !== undefined && m.total !== null && m.total !== "") {
    if (!(Number.isInteger(total) && total > 0 && total <= 1000)) return { error: `N de ${unidad}: un número entero de 1 a 1000, o vacío para contarlo en obra` };
    return { medicion: { tipo, unidad, total } };
  }
  // a contar en obra: un N por obra y unidad (las columnas de Orad: partidas 3, 4 y 6)
  return { medicion: { tipo, unidad, total_de: String(m.total_de || unidad).trim().toLowerCase() } };
}

// la propuesta lista para revisar: horas ajustadas al total y medición limpia
function normalizarPropuesta(partidas, total) {
  const xs = (partidas || []).filter((p) => p && String(p.nombre || "").trim());
  const horas = ajustarHoras(xs.map((p) => p.horas), total);
  return xs.map((p, i) => {
    const lm = limpiarMedicion(p.medicion || { tipo: "pct" });
    return { n: i + 1, nombre: String(p.nombre).trim().slice(0, 200), horas: horas[i], medicion: lm.medicion || { tipo: "pct" } };
  });
}

// Urbano Orad: las 7 partidas de control (320 h); null si no es un portal de Orad
function propuestaOrad(presupuestoId) {
  const portal = PO.PORTALES_ORAD.find((p) => p.presupuesto === presupuestoId);
  if (!portal) return null;
  return { obra_id: portal.obra_id, origen: "orad", partidas: PO.PARTIDAS_ORAD.map((p) => ({ n: p.n, nombre: p.nombre, horas: p.horas, medicion: { ...p.medicion } })) };
}

// lo que se guarda: ¿cuadra? (nombre, horas > 0, medida, suma = total)
function validar(partidas, total) {
  if (!Array.isArray(partidas) || !partidas.length) return { error: "Sin partidas" };
  if (!(Number(total) > 0)) return { error: "El presupuesto no tiene horas previstas: ponlas antes en el presupuesto" };
  const limpias = [];
  for (const [i, p] of partidas.entries()) {
    const nombre = String(p?.nombre || "").trim();
    if (!nombre) return { error: `Partida ${i + 1}: falta el nombre` };
    const h = Number(String(p.horas ?? "").replace(",", "."));
    if (!(h > 0)) return { error: `${nombre}: las horas tienen que ser más de 0` };
    const lm = limpiarMedicion(p.medicion);
    if (lm.error) return { error: `${nombre}: ${lm.error}` };
    limpias.push({ n: i + 1, nombre: nombre.slice(0, 200), horas: r2(h), medicion: lm.medicion });
  }
  const suma = r2(limpias.reduce((t, p) => t + p.horas, 0));
  if (!casi(suma, total)) return { error: `Las horas suman ${String(suma).replace(".", ",")} h y el presupuesto tiene ${String(r2(total)).replace(".", ",")} h` };
  return { partidas: limpias, suma };
}

// filas de certif_partidas (Orad con sus ids de siempre: orad13_p1…; el resto, <presupuesto>_p1…)
function filasPartidas({ obra_id, presupuesto_id, partidas, ahora = new Date().toISOString() }) {
  const portal = PO.PORTALES_ORAD.find((p) => p.presupuesto === presupuesto_id);
  const clave = portal ? portal.clave : String(presupuesto_id || obra_id).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const total = partidas.reduce((t, p) => t + Number(p.horas), 0);
  return partidas.map((p) => ({
    partida_id: `${clave}_p${p.n}`, obra_id, bloque: `Control interno (presupuesto ${presupuesto_id}, ${String(r2(total)).replace(".", ",")} h)`,
    nombre: `${p.n}. ${p.nombre}`, tiempo_previsto_dias: r2(p.horas / 16), tiempo_previsto_horas: p.horas, orden: p.n, created_at: ahora,
    medicion: JSON.stringify(p.medicion),
  }));
}

// ── IA: el mismo motor que «Generar partidas con IA» (Messages API, herramienta forzada) ─────────────
const SISTEMA = `Eres jefe de obra de Instalaciones Araujo (fontanería y saneamiento en comunidades de vecinos, Sevilla).
Divide el trabajo de un presupuesto en 4 a 8 partidas de CONTROL INTERNO para seguir el avance en obra con visitas.
Cada partida: un trabajo que se ve terminado en obra, en el orden en que se hace, con las horas de cuadrilla que lleva
(el total lo ajustamos nosotros a las horas del presupuesto) y cómo se mide el avance:
- "hecho": se hace de una vez (replanteo, acopio)
- "conteo": se cuenta (viviendas, columnas, bajantes, tramos, arquetas). Pon "total" solo si el número sale de la
  descripción; si no, déjalo vacío y se contará en obra
- "pct": avance continuo que no se puede contar
- "hecho_pct": remates y pruebas finales
No inventes trabajos que no estén en la descripción.`;
const HERRAMIENTA = {
  name: "proponer_partidas_control",
  description: "Devuelve las partidas de control interno de la obra",
  input_schema: {
    type: "object",
    properties: {
      partidas: {
        type: "array", minItems: 2, maxItems: 10,
        items: {
          type: "object",
          properties: {
            nombre: { type: "string", description: "Trabajo, corto (máx. 90 caracteres)" },
            horas: { type: "number", description: "Horas de cuadrilla aproximadas" },
            medida: { type: "string", enum: ["hecho", "conteo", "pct", "hecho_pct"] },
            unidad: { type: "string", description: "Solo con conteo: viviendas, columnas, tramos…" },
            total: { type: "integer", description: "Solo con conteo y si sale de la descripción" },
          },
          required: ["nombre", "horas", "medida"],
        },
      },
    },
    required: ["partidas"],
  },
};
async function proponerConIA({ descripcion, horas, nombre, modelo, apiKey = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  const txt = String(descripcion || "").trim();
  if (!txt) throw new Error("El presupuesto no tiene descripción (la que va a la factura): escríbela para poder proponer partidas");
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: modelo, max_tokens: 2000, system: SISTEMA, tools: [HERRAMIENTA], tool_choice: { type: "tool", name: HERRAMIENTA.name },
      messages: [{ role: "user", content: `Obra: ${nombre || "—"}\nHoras de cuadrilla del presupuesto: ${horas}\n\nDescripción del presupuesto:\n${txt}` }] }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const uso = (j.content || []).find((c) => c.type === "tool_use");
  if (!uso) throw new Error("La IA no ha devuelto partidas");
  const partidas = (uso.input?.partidas || []).map((p) => ({ nombre: p.nombre, horas: p.horas,
    medicion: p.medida === "conteo" ? { tipo: "conteo", unidad: p.unidad || "unidades", total: Number.isInteger(p.total) && p.total > 0 ? p.total : undefined } : { tipo: p.medida } }));
  return normalizarPropuesta(partidas, horas);
}

module.exports = { certObraDe, ajustarHoras, limpiarMedicion, normalizarPropuesta, propuestaOrad, validar, filasPartidas, proponerConIA, HERRAMIENTA };
