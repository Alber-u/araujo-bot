// ============================================================
// lib/huecos-horas.cjs — días con horas que faltan y sin motivo (Alberto, 06/10/2026)
// ============================================================
// Cada operario activo tiene que tener su jornada (config_dinero «horas_dia», 8 h) cada día laborable. Si un
// día suma menos (trabajo + extras + ausencias) y no hay nada que lo explique, sale en rojo y JM lo tiene que
// explicar en el registro diario. Lo explica:
//   · un registro de ausencia ese día (vacaciones, baja, falta justificada, asuntos propios…), o
//   · un motivo escrito en cualquiera de sus registros de ese día.
// No cuentan: fines de semana, festivos, sus vacaciones (config_dinero o, sin fechas propias, las de
// agosto por defecto), antes de su alta o desde su baja, ni hoy (el día no ha terminado).
// ============================================================
"use strict";

const dia = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const finde = (iso) => { const d = new Date(iso + "T00:00:00Z").getUTCDay(); return d === 0 || d === 6; };
const r1 = (n) => Math.round(n * 10) / 10;
const TRABAJO = new Set(["trabajo", "extra"]);

// personas: [{ id, nombre, rol, fecha_alta, fecha_baja }] · registros: [{ fecha, persona_id, tipo, horas, motivo, borrado }]
// → [{ fecha, persona_id, nombre, registradas, esperadas, faltan }] (solo los que no están explicados)
function huecosHoras({ personas, registros, desde, hasta, hoy, horasDia = 8, festivos = [], vacaciones = null }) {
  const fest = new Set(festivos || []);
  const operarios = (personas || []).filter((p) => p.id && String(p.rol || "").toLowerCase().trim() === "operario");
  const porDia = new Map();
  for (const r of registros || []) {
    if (String(r.borrado).toUpperCase() === "TRUE") continue;
    const k = `${String(r.fecha).slice(0, 10)}|${String(r.persona_id || "").trim().toLowerCase()}`;
    const x = porDia.get(k) || { horas: 0, explicado: false };
    x.horas += Number(String(r.horas ?? "").replace(",", ".")) || 0;
    if (!TRABAJO.has(String(r.tipo || "trabajo")) || String(r.motivo || "").trim()) x.explicado = true;
    porDia.set(k, x);
  }
  const out = [];
  const tope = hoy && hoy <= hasta ? dia(hoy, -1) : hasta;
  for (let d = desde; d <= tope; d = dia(d, 1)) {
    if (finde(d) || fest.has(d)) continue;
    for (const p of operarios) {
      if (p.fecha_alta && String(p.fecha_alta).slice(0, 10) > d) continue;
      if (p.fecha_baja && String(p.fecha_baja).trim() && String(p.fecha_baja).slice(0, 10) <= d) continue;
      if (vacaciones && vacaciones(p, d)) continue;
      const x = porDia.get(`${d}|${String(p.id).trim().toLowerCase()}`) || { horas: 0, explicado: false };
      const faltan = r1(horasDia - x.horas);
      if (faltan > 0.05 && !x.explicado) out.push({ fecha: d, persona_id: p.id, nombre: p.nombre || p.id, registradas: r1(x.horas), esperadas: horasDia, faltan });
    }
  }
  return out;
}

module.exports = { huecosHoras };
