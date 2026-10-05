// ============================================================
// lib/avance-certificaciones.cjs — Certificaciones como fuente del avance real (06/10/2026)
// ============================================================
// La última visita de Certificaciones dice qué % de la obra está hecho (media de las partidas
// ponderada por sus horas). Con las horas fichadas hasta esa visita:
//   horas al cierre = fichadas hasta la visita ÷ % ejecutado
//   desvío (h)      = horas al cierre − horas presupuestadas
//   desvío (€)      = desvío (h) × coste por hora (config_dinero «coste_hora_eur»)
// Planificación usa las horas al cierre para el fin estimado mientras la visita sea reciente
// (7 días o menos) y marque algo hecho; si no, el ritmo de fichajes («estimación sin visita»).
// «Toca visitar»: obra en obra sin visita, con la última hace 5 días laborables o más, o con más
// del 25 % de sus horas fichadas desde la última visita.
// ============================================================
"use strict";

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DIAS_VISITA_VALIDA = 7;
const LAB_TOCA_VISITAR = 5;
const PCT_HORAS_SIN_VISITA = 0.25;

// Cuentas de una obra (todas las horas en h, pct 0-100)
function cuentasAvance({ pct, horas_fichadas_visita, previsto_horas, coste_hora }) {
  if (!(pct > 0) || !(horas_fichadas_visita > 0)) return { horas_cierre: null, desvio_horas: null, desvio_eur: null };
  const horasCierre = horas_fichadas_visita / (pct / 100);
  const desvio = previsto_horas > 0 ? horasCierre - previsto_horas : null;
  return { horas_cierre: r1(horasCierre), desvio_horas: desvio == null ? null : r1(desvio),
           desvio_eur: desvio == null || !(coste_hora > 0) ? null : r2(desvio * coste_hora) };
}

const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
// ¿Vale la visita para estimar el fin? (reciente y con algo hecho)
function visitaValida(c, hoy) {
  if (!c || !c.ultima_visita_fecha) return { ok: false, motivo: "sin visita" };
  if (!(Number(c.avance_pct) > 0)) return { ok: false, motivo: "la última visita marca 0 %" };
  const dias = diasEntre(String(c.ultima_visita_fecha).slice(0, 10), hoy);
  if (dias > DIAS_VISITA_VALIDA) return { ok: false, motivo: `la última visita es de hace ${dias} días` };
  return { ok: true, dias };
}

// Horas que quedan según la visita: horas al cierre − todo lo fichado hasta hoy
// fichadasVisita: hasta la visita (las de ese día no cuentan: el tramo acaba la víspera)
function horasQuedanSegunVisita(c, fichadasVisita, fichadasHoy) {
  const pct = Number(c?.avance_pct) || 0;
  if (!(pct > 0) || !(fichadasVisita > 0)) return null;
  const cierre = fichadasVisita / (pct / 100);
  return { horas_cierre: r1(cierre), quedan: Math.max(0, cierre - fichadasHoy) };
}

// «Toca visitar» de una obra en obra. laborables(desde, hasta) cuenta días laborables (incluidos los dos)
function tocaVisitar({ ultima, fichadasDesde, previstas, hoy, laborables }) {
  if (!ultima) return { toca: true, motivo: "sin visita" };
  const lab = laborables(String(ultima).slice(0, 10), hoy) - 1;
  if (lab >= LAB_TOCA_VISITAR) return { toca: true, motivo: `última visita hace ${lab} días laborables` };
  if (previstas > 0 && fichadasDesde / previstas > PCT_HORAS_SIN_VISITA) return { toca: true, motivo: `${Math.round(fichadasDesde / previstas * 100)} % de sus horas fichadas desde la última visita` };
  return { toca: false };
}

// Todas las visitas de una obra, en orden, para marcarlas en el calendario de Planificación (07/10/2026).
// Cada visita guarda el % de las partidas que se tocaron; las demás siguen con el de la visita anterior.
//   avance_pct: media de las partidas ponderada por sus horas · partidas: con avance / activas
//   retraso: horas fichadas hasta la visita − horas esperadas (presupuesto × % ejecutado), en días de
//   cuadrilla (16 h); color: verde en plazo o adelantada (≤ 0,5 h), ámbar hasta 2 días, rojo más
//   desvío: horas al cierre − presupuestadas (y en € con el coste por hora)
// visitas, estados: filas de certif_visitas / certif_visita_estado de ESTA obra; prevPorPartida: { partida_id: horas }
// registros: registros de tiempo de la obra (fecha, horas)
const DIA_CUADRILLA_HORAS = 16;
function visitasDeObra({ visitas, estados, prevPorPartida, registros, coste_hora }) {
  const prevs = Object.entries(prevPorPartida || {}).filter(([, h]) => Number(h) > 0);
  const previsto = prevs.reduce((t, [, h]) => t + Number(h), 0);
  const porVisita = new Map();
  for (const e of estados || []) { if (!porVisita.has(e.visita_id)) porVisita.set(e.visita_id, []); porVisita.get(e.visita_id).push(e); }
  const pct = new Map();
  const orden = [...(visitas || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  return orden.map((v) => {
    for (const e of porVisita.get(v.visita_id) || []) pct.set(e.partida_id, Number(String(e.progreso_pct).replace(",", ".")) || 0);
    const avance = previsto > 0 ? prevs.reduce((t, [id, h]) => t + Number(h) * (pct.get(id) || 0), 0) / previsto : 0;
    const fecha = String(v.fecha || "").slice(0, 10);
    // el tramo de una visita acaba la víspera: las horas de ese día van al siguiente
    const fich = (registros || []).filter((r) => String(r.fecha || "").slice(0, 10) < fecha).reduce((t, r) => t + (Number(String(r.horas).replace(",", ".")) || 0), 0);
    const retrasoH = fich - previsto * avance / 100;
    const retrasoDias = retrasoH / DIA_CUADRILLA_HORAS;
    const c = cuentasAvance({ pct: avance, horas_fichadas_visita: fich, previsto_horas: previsto, coste_hora });
    return { visita_id: v.visita_id, fecha, estado: String(v.estado || "").toLowerCase() || null, tipo: v.tipo_visita || null,
             avance_pct: Math.round(avance * 10) / 10, partidas_con_avance: prevs.filter(([id]) => (pct.get(id) || 0) > 0).length, partidas: prevs.length,
             horas_fichadas: r1(fich), retraso_dias: r2(retrasoDias), color: retrasoH <= 0.5 ? "verde" : retrasoDias <= 2 ? "ambar" : "rojo",
             desvio_horas: c.desvio_horas, desvio_eur: c.desvio_eur };
  });
}

module.exports = { visitasDeObra, cuentasAvance, visitaValida, horasQuedanSegunVisita, tocaVisitar, DIAS_VISITA_VALIDA, LAB_TOCA_VISITAR, PCT_HORAS_SIN_VISITA };
