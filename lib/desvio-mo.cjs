// ============================================================
// lib/desvio-mo.cjs — desvío real de mano de obra según Certificaciones (Alberto, 06/10/2026)
// ============================================================
// Mi panel no alarga las fechas de Planificación: el desvío va al coste de mano de obra. Es el de las obras
// TERMINADAS en Certificaciones (última visita al 100 %): horas al cierre ÷ horas previstas − 1, ponderado por
// horas (Σ cierre ÷ Σ previstas − 1). Sin terminadas, el de las obras en curso con visita (horas al cierre
// estimadas: fichadas hasta la visita ÷ % ejecutado), marcado como estimado. Sin ninguna, null (quien llama usa
// el de la calibración y lo dice).
// → { pct, fuente, fiabilidad, obras: [{ obra_id, previstas, cierre, pct }] } | null
"use strict";
const r1 = (n) => Math.round(n * 10) / 10;

function desvioCertificaciones(obras) {
  const conCierre = (obras || []).map((c) => {
    const prev = Number(c.previsto_horas) || 0, pct = Number(c.avance_pct) || 0, fich = Number(c.horas_fichadas_visita) || 0;
    const cierre = Number(c.horas_cierre) > 0 ? Number(c.horas_cierre) : pct > 0 && fich > 0 ? fich / (pct / 100) : null;
    return { obra_id: c.obra_id, previstas: prev, cierre, avance: pct };
  }).filter((x) => x.previstas > 0 && x.cierre > 0);
  const calcula = (xs, fuente, fiabilidad) => {
    const p = xs.reduce((t, x) => t + x.previstas, 0), c = xs.reduce((t, x) => t + x.cierre, 0);
    return { pct: r1((c / p - 1) * 100), fuente, fiabilidad, obras: xs.map((x) => ({ obra_id: x.obra_id, previstas: r1(x.previstas), cierre: r1(x.cierre), pct: r1((x.cierre / x.previstas - 1) * 100) })) };
  };
  const terminadas = conCierre.filter((x) => x.avance >= 100);
  if (terminadas.length) return calcula(terminadas, `Certificaciones: ${terminadas.length} ${terminadas.length === 1 ? "obra terminada" : "obras terminadas"} (horas al cierre ÷ previstas)`, terminadas.length >= 3 ? "exacto" : "estimado");
  if (conCierre.length) return calcula(conCierre, `Certificaciones: ${conCierre.length} ${conCierre.length === 1 ? "obra en curso" : "obras en curso"} con visita (horas al cierre estimadas)`, "estimado");
  return null;
}

module.exports = { desvioCertificaciones };
