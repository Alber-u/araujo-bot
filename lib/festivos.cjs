// ============================================================
// lib/festivos.cjs — días no laborables de Planificación (Alberto, 04/10/2026)
// ============================================================
// config_dinero «festivos» = fechas AAAA-MM-DD separadas por «;». Si la clave
// no está (o está vacía), se usan los de abajo: nacionales, de Andalucía y
// locales de Sevilla de 2026 y 2027. Los de 2027 son PROVISIONALES hasta que
// salgan el BOE, el BOJA y el calendario del Ayuntamiento: comprobarlos y
// ponerlos en config_dinero cuando se publiquen.
// Sábados y domingos nunca son laborables (no hace falta ponerlos).
// ============================================================
"use strict";

const POR_DEFECTO = [
  // 2026 · calendario laboral del Convenio del Metal de Sevilla (BOP de Sevilla n.º 242, 17/12/2025,
  // anexo IX): 12 nacionales/autonómicas + 2 locales de Sevilla capital = 14 festivos
  "2026-01-01", "2026-01-06", "2026-02-28", "2026-04-02", "2026-04-03", "2026-05-01", "2026-08-15",
  "2026-10-12", "2026-11-02", "2026-12-07", "2026-12-08", "2026-12-25",
  "2026-04-22", "2026-06-04",                 // Sevilla: miércoles de Feria y Corpus Christi
  // 2027 · provisionales (Semana Santa 25-26/03; 28/02 y 15/08 en domingo, a falta del traslado)
  "2027-01-01", "2027-01-06", "2027-03-01", "2027-03-25", "2027-03-26", "2027-05-01", "2027-08-16",
  "2027-10-12", "2027-11-01", "2027-12-06", "2027-12-08", "2027-12-25",
  "2027-04-14", "2027-05-27",                 // Sevilla: miércoles de Feria y Corpus Christi (provisionales)
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Devuelve { lista, fuente, errores }
function leerFestivos(valor) {
  const txt = String(valor == null ? "" : valor).trim();
  if (!txt) return { lista: [...POR_DEFECTO], fuente: "por_defecto", errores: [] };
  const errores = [];
  const lista = [];
  for (const x of txt.split(/[;\n,]+/).map((y) => y.trim()).filter(Boolean)) {
    if (ISO.test(x) && !isNaN(Date.parse(x))) lista.push(x); else errores.push(x);
  }
  return { lista: [...new Set(lista)].sort(), fuente: "config_dinero", errores };
}

module.exports = { POR_DEFECTO, leerFestivos };
