// ============================================================
// lib/jornada.cjs — horas por día y vacaciones (Alberto, 04/10/2026)
// ============================================================
// Convenio del Metal de Sevilla 2026 (BOP n.º 242, 17/12/2025, anexo IX):
// 1.759 h al año en 228 días laborables → 7,7 h por día; 21 días laborables
// de vacaciones por persona.
// config_dinero:
//   · horas_dia           = 7,7
//   · vacaciones_dias     = 21 (por persona; por defecto, los primeros 21
//                           días laborables desde el 1 de agosto de cada año)
//   · vacaciones_personas = «Nombre: AAAA-MM-DD a AAAA-MM-DD, AAAA-MM-DD a
//                           AAAA-MM-DD; Otro: …» (quien no está, en agosto)
// ============================================================
"use strict";

const HORAS_DIA_CONVENIO = 7.7;
const VACACIONES_DIAS_CONVENIO = 21;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dia = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const numero = (v) => { const t = String(v == null ? "" : v).trim(); if (!t) return null; const n = Number(t.replace(",", ".")); return Number.isFinite(n) ? n : null; };

// Devuelve { horas_dia, vacaciones_dias, personas: { nombre: [[desde, hasta]…] }, fuente: {…}, errores: [] }
function leerJornada({ horas_dia, vacaciones_dias, vacaciones_personas } = {}) {
  const errores = [];
  const h = numero(horas_dia), v = numero(vacaciones_dias);
  if (horas_dia != null && String(horas_dia).trim() && !(h > 0 && h <= 12)) errores.push(`horas_dia «${horas_dia}» no es válido`);
  if (vacaciones_dias != null && String(vacaciones_dias).trim() && !(v != null && v >= 0 && v <= 60)) errores.push(`vacaciones_dias «${vacaciones_dias}» no es válido`);
  const personas = {};
  for (const trozo of String(vacaciones_personas || "").split(/[;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const i = trozo.indexOf(":");
    if (i < 1) { errores.push(`vacaciones_personas: «${trozo}» (falta «Nombre:»)`); continue; }
    const nombre = trozo.slice(0, i).trim();
    const rangos = [];
    for (const r of trozo.slice(i + 1).split(",").map((x) => x.trim()).filter(Boolean)) {
      const m = r.split(/\s+(?:a|al|-|–)\s+/i).map((x) => x.trim());
      const [a, b] = m.length === 2 ? m : [m[0], m[0]];
      if (!ISO.test(a) || !ISO.test(b) || b < a) { errores.push(`vacaciones_personas: «${r}» de ${nombre} (AAAA-MM-DD a AAAA-MM-DD)`); continue; }
      rangos.push([a, b]);
    }
    if (rangos.length) personas[nombre] = rangos;
  }
  return {
    horas_dia: h > 0 && h <= 12 ? h : HORAS_DIA_CONVENIO,
    vacaciones_dias: v != null && v >= 0 && v <= 60 ? Math.round(v) : VACACIONES_DIAS_CONVENIO,
    personas,
    fuente: { horas_dia: h > 0 && h <= 12 ? "config_dinero" : "convenio", vacaciones_dias: v != null && v >= 0 && v <= 60 ? "config_dinero" : "convenio" },
    errores,
  };
}

// Días de vacaciones (laborables) de cada persona entre «desde» y «hasta».
// Quien no tiene fechas propias: los primeros N laborables desde el 1 de agosto.
// esLab(iso) decide qué es laborable (fines de semana y festivos fuera).
function diasVacaciones(jornada, nombres, desde, hasta, esLab) {
  const defecto = new Set();
  for (let y = Number(desde.slice(0, 4)); y <= Number(hasta.slice(0, 4)); y++) {
    let x = `${y}-08-01`, k = jornada.vacaciones_dias;
    while (k > 0) { if (esLab(x)) { defecto.add(x); k--; } x = dia(x, 1); }
  }
  const porPersona = {};
  for (const n of nombres || []) {
    const r = jornada.personas[n];
    if (!r) { porPersona[n] = defecto; continue; }
    const s = new Set();
    for (const [a, b] of r) for (let x = a; x <= b; x = dia(x, 1)) if (esLab(x)) s.add(x);
    porPersona[n] = s;
  }
  return { defecto, porPersona };
}

// Horas por persona y mes (para el cash flow, que va por meses): las horas
// del convenio de los próximos 12 meses ÷ 12. Las vacaciones se reparten en el año.
function hppConvenio(jornada, hoy, esLab) {
  let labs = 0;
  const fin = dia(hoy, 365);
  for (let x = dia(hoy, 1); x <= fin; x = dia(x, 1)) if (esLab(x)) labs++;
  const dias = Math.max(0, labs - jornada.vacaciones_dias);
  return { hpp: Math.round(jornada.horas_dia * dias / 12 * 10) / 10, labs, dias };
}

module.exports = { HORAS_DIA_CONVENIO, VACACIONES_DIAS_CONVENIO, leerJornada, diasVacaciones, hppConvenio };
