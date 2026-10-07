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
// «Toca visitar» y visitas previstas: planVisitas (cada «horas_visita» horas, la regla de Certificaciones).
// ============================================================
"use strict";

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DIAS_VISITA_VALIDA = 7;

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

// Todas las visitas de una obra, en orden, para marcarlas en el calendario de Planificación (07/10/2026).
// Cada visita guarda el % de las partidas que se tocaron; las demás siguen con el de la visita anterior.
//   avance_pct: media de las partidas ponderada por sus horas · partidas: con avance / activas
//   retraso: horas fichadas hasta la visita − horas esperadas (presupuesto × % ejecutado), en días de
//   cuadrilla (16 h); color: verde en plazo o adelantada (≤ 0,5 h), ámbar hasta 2 días, rojo más
//   desvío: horas al cierre − presupuestadas (y en € con el coste por hora)
// visitas, estados: filas de certif_visitas / certif_visita_estado de ESTA obra; prevPorPartida: { partida_id: horas }
// registros: registros de tiempo de la obra (fecha, horas)
const DIA_CUADRILLA_HORAS = 16;
// Rombo de una visita hecha (07/10/2026): «va X % · debería Y %». Va = % certificado en la visita; debería = horas
// fichadas hasta la visita ÷ horas previstas (máximo 100 %). Color: verde si va ≥ debería − 5; ámbar si va entre 5 y
// 15 puntos por debajo; rojo si más de 15 por debajo. (60 h de 108,8 y 40 % certificado → debería 55 %: rojo)
const fmtN = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",");
const signo = (n, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmtN(Math.abs(n), d)}`;
function vaDeberia({ va, fichadas, previstas, fecha = null }) {
  if (!(Number(previstas) > 0)) return null;
  const deb = Math.min(100, (Number(fichadas) || 0) / Number(previstas) * 100);
  const dif = (Number(va) || 0) - deb;
  const color = dif >= -5 ? "verde" : dif >= -15 ? "ambar" : "rojo";
  const difH = dif / 100 * Number(previstas);
  const dmF = fecha ? ` a ${String(fecha).slice(8, 10)}/${String(fecha).slice(5, 7)}` : "";
  return { va_pct: Math.round(va * 10) / 10, deberia_pct: Math.round(deb * 10) / 10, dif_puntos: Math.round(dif * 10) / 10, dif_horas: Math.round(difH * 10) / 10, color,
           texto: `va ${fmtN(va, 0)} % · debería ${fmtN(deb, 0)} %`,
           titulo: `${fmtN(fichadas)} h fichadas de ${fmtN(previstas)} previstas${dmF} · certificado ${fmtN(va, 0)} % · diferencia ${signo(dif)} puntos ≈ ${signo(difH, 1)} h` };
}
// «Con las horas fichadas debería ir al N %» (al guardar una visita en Certificaciones)
const textoDeberia = (fichadas, previstas) => (Number(previstas) > 0 ? `Con las horas fichadas debería ir al ${fmtN(Math.min(100, (Number(fichadas) || 0) / Number(previstas) * 100), 0)} %` : null);

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
    const vd = vaDeberia({ va: avance, fichadas: fich, previstas: previsto, fecha });
    return { visita_id: v.visita_id, fecha, estado: String(v.estado || "").toLowerCase() || null, tipo: v.tipo_visita || null,
             avance_pct: Math.round(avance * 10) / 10, partidas_con_avance: prevs.filter(([id]) => (pct.get(id) || 0) > 0).length, partidas: prevs.length,
             horas_fichadas: r1(fich), retraso_dias: r2(retrasoDias),
             // color del rombo: va / debería (07/10/2026); sin horas previstas, por el retraso en días como antes
             color: vd ? vd.color : retrasoH <= 0.5 ? "verde" : retrasoDias <= 2 ? "ambar" : "rojo",
             horas_previstas: r1(previsto), deberia_pct: vd ? vd.deberia_pct : null, va_texto: vd ? vd.texto : null, va_titulo: vd ? vd.titulo : null,
             desvio_horas: c.desvio_horas, desvio_eur: c.desvio_eur };
  });
}

// ============================================================
// Visitas (07/10/2026): UNA regla para todo, la de Certificaciones: cada «horas_visita» horas (config_dinero,
// 32 por defecto) toca certificar. Esta función da los ◇ del calendario, la visita atrasada, «toca visitar»
// (avisos, 🔔, Mi día) y el aviso de la tarjeta de Certificaciones.
//   · la primera visita, el día de inicio de la obra;
//   · las siguientes, el día en que el plan (personas × horas al día, con los tramos) acumula «horas_visita»
//     horas desde la anterior; hasta el fin de la obra;
//   · atrasada (roja): ha pasado su día sin visita, o las horas fichadas desde la última visita llegan al
//     umbral, lo que ocurra antes. Las de después se cuentan desde hoy; una visita real las recalcula.
// reales: [{ fecha }] · horasDia(d): horas planificadas ese día · fn: { dia, esLab, laborables }
// Devuelve { previstas: [{ fecha, motivo, atrasada, dias_atraso, horas_fichadas }], toca: { motivo } | null }
// ============================================================
const HORAS_VISITA_DEF = 32;
const umbralVisita = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : HORAS_VISITA_DEF; };
// Certificaciones (tarjeta): horas fichadas desde la última visita ≥ umbral → roja
const atrasadaPorHoras = (fichadasDesde, umbral = HORAS_VISITA_DEF) => Number(fichadasDesde) >= umbral - 1e-6;

// fichadasTotal y previstas (opcionales): «debería N %» de cada prevista = (fichadas hasta hoy + horas planificadas de
// hoy a la víspera de la visita) ÷ previstas, máximo 100 %
function planVisitas({ reales = [], inicio, fin, hoy, umbral = HORAS_VISITA_DEF, horasDia, fichadasDesdeUltima = 0, enObra = false, fn, fichadasTotal = null, previstas = null }) {
  const { dia, esLab, laborables } = fn;
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const hTxt = (h) => String(Math.round(h * 10) / 10).replace(".", ",");
  const labDesde = (x) => { let d = x; for (let g = 0; g < 30 && !esLab(d); g++) d = dia(d, 1); return d; };
  // el día en que el plan acumula «umbral» horas desde «base»
  const siguiente = (base, desdeTxt) => {
    let h = 0;
    for (let d = dia(base, 1), g = 0; g < 400; d = dia(d, 1), g++) {
      if (!esLab(d)) continue;
      h += horasDia(d) || 0;
      if (h >= umbral - 1e-6) return { fecha: d, motivo: `${hTxt(umbral)} h desde ${desdeTxt}` };
    }
    return null;
  };
  const ultReal = [...reales].map((v) => String(v.fecha).slice(0, 10)).filter((f) => f <= hoy).sort().pop() || null;
  const porHoras = enObra && atrasadaPorHoras(fichadasDesdeUltima, umbral);
  const out = [];
  let sig = ultReal ? siguiente(ultReal, `la última (${dm(ultReal)})`) : (inicio ? { fecha: labDesde(inicio), motivo: "inicio de la obra" } : null);
  for (let g = 0; sig && g < 80 && sig.fecha <= fin; g++) {
    if (!out.length && (sig.fecha < hoy || porHoras)) {
      // atrasada: su día ya pasó o ya se han fichado las horas; las siguientes, desde hoy
      out.push({ ...sig, atrasada: true, dias_atraso: sig.fecha < hoy ? laborables(dia(sig.fecha, 1), hoy) : 0,
                 horas_fichadas: Math.round(fichadasDesdeUltima * 10) / 10, por_horas: porHoras });
      sig = siguiente(sig.fecha > hoy ? sig.fecha : hoy, "hoy (la anterior va atrasada)");
      continue;
    }
    out.push({ ...sig, atrasada: false, dias_atraso: 0 });
    sig = siguiente(sig.fecha, `la anterior (${dm(sig.fecha)})`);
  }
  // «toca visitar» (en obra): la primera prevista es hoy o está atrasada
  let toca = null;
  const p0 = out[0];
  if (enObra && p0 && (p0.fecha <= hoy || p0.atrasada)) {
    const atraso = p0.atrasada ? (p0.por_horas ? `visita atrasada · ${hTxt(p0.horas_fichadas)} h fichadas desde ${ultReal ? "la última" : "el inicio"}`
      : `visita atrasada ${p0.dias_atraso} ${p0.dias_atraso === 1 ? "día laborable" : "días laborables"} (prevista ${dm(p0.fecha)})`) : `visita prevista hoy`;
    toca = { motivo: ultReal ? atraso : `sin visita${p0.atrasada ? ` · ${atraso}` : ""}`, ultima_visita: ultReal };
  }
  if (Number(previstas) > 0) {
    for (const p of out) {
      let h = Number(fichadasTotal) || 0;
      for (let d = hoy, g = 0; d < p.fecha && g < 800; d = dia(d, 1), g++) if (esLab(d)) h += horasDia(d) || 0;
      p.deberia_pct = Math.round(Math.min(100, h / Number(previstas) * 100) * 10) / 10;
    }
  }
  return { previstas: out, toca };
}

module.exports = { vaDeberia, textoDeberia, HORAS_VISITA_DEF, umbralVisita, atrasadaPorHoras, planVisitas, visitasDeObra, cuentasAvance, visitaValida, horasQuedanSegunVisita, DIAS_VISITA_VALIDA };
