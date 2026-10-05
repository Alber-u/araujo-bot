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

module.exports = { cuentasAvance, visitaValida, horasQuedanSegunVisita, tocaVisitar, DIAS_VISITA_VALIDA, LAB_TOCA_VISITAR, PCT_HORAS_SIN_VISITA };
