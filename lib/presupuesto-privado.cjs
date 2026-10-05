// ============================================================
// lib/presupuesto-privado.cjs — presupuestos de obra privada con datos
// obligatorios (encargo completo 03/10/2026, bloque 3)
// ============================================================
// Urbano Orad 13 y 15 se aceptaron sin horas, sin material ni margen. Desde
// ahora cada presupuesto de obra privada (obras_otras) lleva:
//   horas_previstas, personas (2 o 3), material_previsto_eur (sin IVA),
//   coste_hora_eur: el de config_dinero (sin él no hay margen: aviso)
// y se calculan solos (no se escriben a mano):
//   dias_estimados = horas ÷ (personas × 8)
//   beneficio_pct  = (subtotal − material − horas × coste_hora) ÷ subtotal
// Para enviar (email / PDF) hacen falta horas, personas y material; para
// «Aceptado → OT», además, margen ≥ margen_minimo_privadas (30 %) o que el
// CEO lo acepte igualmente (queda registrado). Los de Plan 5 no se tocan.
// ============================================================
"use strict";

const HORAS_DIA = 8;
// Sin coste por hora escondido (07/10/2026): si falta «coste_hora_eur» en config_dinero, no hay margen y se avisa
const COSTE_HORA_DEF = null;
const MARGEN_MIN_DEF = 30;
const num = (v) => { const t = String(v == null ? "" : v).trim(); if (!t) return null; const n = Number(t.replace(",", ".")); return Number.isFinite(n) ? n : null; };
const r1 = (n) => Math.round(n * 10) / 10;

// o: la fila de obras_otras (o el borrador del editor); cfg: { coste_hora_eur, margen_minimo_privadas }
function calcularPrevision(o, cfg = {}) {
  const horas = num(o.horas_previstas), personas = num(o.personas), material = num(o.material_previsto_eur);
  // UN coste por hora para todos (config_dinero «coste_hora_eur»): el que llevaba cada presupuesto
  // hacía que dos con los mismos datos dieran márgenes distintos (Urbano Orad 13 y 15, 05/10/2026)
  const coste = num(cfg.coste_hora_eur) > 0 ? num(cfg.coste_hora_eur) : null;
  const subtotal = num(o.subtotal_eur) || (num(o.total_eur) ? num(o.total_eur) / 1.21 : null);
  const dias = horas > 0 && personas > 0 ? Math.ceil(horas / (personas * HORAS_DIA)) : null;
  const margen = coste != null && subtotal > 0 && horas > 0 && material != null ? r1((subtotal - material - horas * coste) / subtotal * 100) : null;
  const costeMO = coste != null && horas > 0 ? Math.round(horas * coste * 100) / 100 : null;
  const beneficio = margen == null ? null : Math.round((subtotal - material - horas * coste) * 100) / 100;
  // cómo se calcula: subtotal − (coste hora × horas + material)
  const f = (n) => Math.round(n).toLocaleString("es-ES", { useGrouping: "always" });
  const formula = margen == null ? null
    : `${f(subtotal)} € − (${String(coste).replace(".", ",")} €/h × ${String(horas).replace(".", ",")} h + ${f(material)} € de material) = ${f(beneficio)} € de beneficio (${String(margen).replace(".", ",")} %)`;
  return { horas, personas, material, coste_hora: coste, coste_mano_obra: costeMO, subtotal, dias_estimados: dias, beneficio_pct: margen,
           beneficio_eur: beneficio, formula,
           falta_coste_hora: coste == null };
}

const NOMBRES = { horas_previstas: "horas previstas", personas: "personas", material_previsto_eur: "material previsto" };
// Lo que falta para poder enviar el presupuesto
function faltan(o) {
  const out = [];
  if (!(num(o.horas_previstas) > 0)) out.push("horas_previstas");
  if (![2, 3].includes(num(o.personas))) out.push("personas");
  const m = num(o.material_previsto_eur);
  if (m == null || m < 0) out.push("material_previsto_eur");
  return out;
}
const textoFaltan = (f) => {
  const n = f.map((k) => NOMBRES[k]);
  return `Faltan ${n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : n[0]}: sin eso no se puede enviar`;
};

function validarEnvio(o) {
  const f = faltan(o);
  return f.length ? { ok: false, faltan: f, error: textoFaltan(f) } : { ok: true };
}

// Paso a OT. aceptarIgualmente = { usuario } del CEO cuando el margen es bajo.
function validarPasoOT(o, cfg = {}, aceptarIgualmente = null) {
  const e = validarEnvio(o);
  if (!e.ok) return { ...e, error: e.error.replace("no se puede enviar", "no se puede pasar a OT") };
  const min = num(cfg.margen_minimo_privadas) ?? MARGEN_MIN_DEF;
  const p = calcularPrevision(o, cfg);
  if (p.beneficio_pct == null) return { ok: false, error: "Sin presupuesto (subtotal) no se puede calcular el margen" };
  if (p.beneficio_pct < min) {
    if (aceptarIgualmente?.usuario) return { ok: true, forzado: true, margen: p.beneficio_pct, minimo: min };
    return { ok: false, bajo_minimo: true, margen: p.beneficio_pct, minimo: min,
             error: `Margen ${String(p.beneficio_pct).replace(".", ",")} %: por debajo del mínimo (${min} %). Solo Alberto puede aceptarlo` };
  }
  return { ok: true, margen: p.beneficio_pct, minimo: min };
}

module.exports = { calcularPrevision, faltan, validarEnvio, validarPasoOT, textoFaltan, HORAS_DIA, COSTE_HORA_DEF, MARGEN_MIN_DEF };
