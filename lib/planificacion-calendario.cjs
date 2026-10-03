// ============================================================
// lib/planificacion-calendario.cjs — Planificación por cuadrillas (la usa JM)
// (encargo completo del 03/10/2026, bloque 2)
// ============================================================
// Una sola planificación: la misma simulación que el cash flow (obras de la
// cartera con su orden por documentación, las fechas de las OT/OO y lo
// agendado a mano en planificacion_obras). Lo agendado por JM o Alberto y lo
// que ya está en ejecución es «real»; el resto, «propuesta» del orden
// automático. Para JM no van importes: solo obras, cuadrillas, fechas y horas.
// ============================================================
"use strict";

const S = require("./simulador-caja.cjs");

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const DINERO = ["importe", "importe_total", "beneficio", "comision", "material"];

// Días laborables (lunes a viernes) entre dos fechas ISO, ambas incluidas
function laborables(desde, hasta) {
  let n = 0;
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 86400000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}

// config_dinero «cuadrillas_personas»: «Cuadrilla 1: Antonio, Pepe; Cuadrilla 2: Juan, Luis, Mario»
// (o «Antonio, Pepe; Juan, Luis, Mario») → [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]]
function personasPorCuadrilla(txt) {
  if (!txt || !String(txt).trim()) return null;
  return String(txt).split(/[;\n]+/).map((x) => x.replace(/^[^:]*:/, (m) => (/cuadrilla/i.test(m) ? "" : m)))
    .map((x) => x.split(",").map((n) => n.trim()).filter(Boolean)).filter((x) => x.length);
}

// cf = data.cashflow de /dinero-empresa; borrador = cambio sin guardar
function calendarioPlan({ cf, hoy, borrador = null, ceo = false, modo = "simulacion", nombresCuadrillas = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { ok: false, error: cf?.simulador?.error || "sin datos de la cartera (posicion-neta-real)" };
  const obras = S.aplicarCambioPlan(cf.simulador.obras, borrador);
  const mandos = cf.automatico.mandos;
  const sim = S.simular({ obras, historico: cf.simulador.historico, hoy, mandos, ivaConocido: S.ivaConocido(cf), conocidas: S.obrasConocidas(cf) });
  const porId = Object.fromEntries(obras.map((o) => [o.obra_id, o]));
  const lista = sim.prog.map((p, i) => {
    const o = porId[p.obra_id] || {};
    const empezada = p.inicio <= hoy;
    const agendada = !!(p.manual || o.inicio_fijo || o.plan);
    const estado = empezada ? "en_ejecucion" : agendada ? "agendada" : "propuesta";
    const prev = Number(o.horas_previstas) || 0, reg = Number(o.horas_registradas) || 0;
    const x = {
      puesto: i + 1, obra_id: p.obra_id, nombre: p.nombre, fase: p.fase, tipo: p.tipo, estado, manual: p.manual, plan: o.plan || null,
      equipo: p.equipo, cuadrilla: p.cuadrilla, inicio: p.inicio, fin: p.fin, tramitada: p.tramitada, antes_de_tramite: p.antes_de_tramite,
      espera: p.espera, espera_desde: p.espera_desde, estado_doc: p.estado_doc, atascada_dias: p.atascada_dias, sin_presupuesto: p.sin_presupuesto,
      // horas: previstas (o el tope para el margen mínimo en obras privadas), registradas, las que quedan
      horas_previstas: r1(prev > 0 ? prev : p.horas), horas_tope_margen: prev > 0 ? null : r1(p.horas),
      horas_registradas: r1(reg), horas_quedan: r1(Math.max(0, (prev > 0 ? prev : p.horas) - reg)), horas_simuladas: r1(p.horas),
      consumo_pct: (prev > 0 ? prev : p.horas) > 0 ? Math.round(reg / (prev > 0 ? prev : p.horas) * 100) : null,
      dias_laborables: laborables(p.inicio, p.fin),
    };
    if (ceo) for (const k of DINERO) x[k] = p[k];
    return x;
  });
  const visibles = modo === "real" ? lista.filter((x) => x.estado !== "propuesta") : lista;
  const out = {
    ok: true, hoy, modo,
    cuadrillas: sim.cuadrillas.map((n, i) => ({ n: i + 1, personas: n, nombre: `Cuadrilla ${i + 1}`, quienes: nombresCuadrillas?.[i] || null, grandes: sim.cuadrillas.length > 1 && n === Math.max(...sim.cuadrillas) && Math.max(...sim.cuadrillas) !== Math.min(...sim.cuadrillas) })),
    mandos: { personas: mandos.personas, hpp: mandos.hpp, desvio: mandos.desvio, grande: mandos.grande, tram: mandos.tram },
    horas_dia_persona: 8,
    obras: visibles,
    terminadas: sim.terminadas.map((t) => ({ obra_id: t.obra_id, nombre: t.nombre, fin: t.fin })),
    avisos: { antes_de_tramite: sim.avisos.antes_de_tramite, sin_presupuesto: sim.avisos.sin_presupuesto.map((x) => x.nombre) },
    idle_horas: sim.idle,
    planificacion: cf.planificacion || null,
  };
  if (ceo) {
    out.dinero = { produccion: sim.produccion, beneficio: sim.beneficio, terminan: sim.terminan };
    out.caja = S.resumenCaja(cf, sim);
    if (borrador) {
      const base = S.simular({ obras: cf.simulador.obras, historico: cf.simulador.historico, hoy, mandos, ivaConocido: S.ivaConocido(cf), conocidas: S.obrasConocidas(cf) });
      out.caja_antes = S.resumenCaja(cf, base);
    }
  }
  return out;
}

module.exports = { calendarioPlan, laborables, personasPorCuadrilla };
