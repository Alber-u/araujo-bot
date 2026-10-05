// ============================================================
// lib/partidas-orad.cjs — partidas de control de Urbano Orad 13 y 15 (Alberto, 07/10/2026)
// ============================================================
// Los presupuestos OO-2026-142 (Orad 13) y OO-2026-143 (Orad 15) tienen una sola partida para el
// cliente («Total material y mano de obra», 320 h). Por dentro, para certificar, se dividen en estas 7
// (8 + 40 + 80 + 40 + 105 + 25 + 22 = 320 h). Solo son internas: el precio y el texto del cliente no cambian.
// medicion: cómo se mide el avance en la visita
//   { tipo: "hecho" }                          hecho / no hecho (0 o 100 %)
//   { tipo: "hecho_pct" }                      hecho / no hecho, o un %
//   { tipo: "conteo", unidad, total }          «X de N» con N fijo (2 tramos, 21 viviendas)
//   { tipo: "conteo", unidad, total_de }       «X de N» con N de la obra (columnas: lo pone JM una vez por portal)
// ============================================================
"use strict";

const PARTIDAS_ORAD = [
  { n: 1, nombre: "Replanteo, acopio y protecciones", horas: 8, medicion: { tipo: "hecho" } },
  { n: 2, nombre: "Línea general PEAD 90 desde el grupo de presión hasta los 2 patios, con la llave de 3\" en el bypass", horas: 40, medicion: { tipo: "conteo", unidad: "tramos", total: 2 } },
  { n: 3, nombre: "Columnas PPR 50 por fachada, con llave de corte en cada subida", horas: 80, medicion: { tipo: "conteo", unidad: "columnas", total_de: "columnas" } },
  { n: 4, nombre: "Aislamiento K-Flex y canaleta de aluminio en las columnas", horas: 40, medicion: { tipo: "conteo", unidad: "columnas", total_de: "columnas" } },
  { n: 5, nombre: "Conexión a viviendas: multicapa 20 mm, llave de paso nueva, condenar la antigua y reponer azulejos", horas: 105, medicion: { tipo: "conteo", unidad: "viviendas", total: 21 } },
  { n: 6, nombre: "Desmontaje y retirada de las columnas antiguas", horas: 25, medicion: { tipo: "conteo", unidad: "columnas", total_de: "columnas" } },
  { n: 7, nombre: "Pruebas de presión, puesta en servicio, remates y limpieza", horas: 22, medicion: { tipo: "hecho_pct" } },
];
// una ficha de Certificaciones por portal (Planificación las junta en «Urbano Orad 13-15», ponderando por horas)
const PORTALES_ORAD = [{ obra_id: "Urbano Orad 13", presupuesto: "OO-2026-142", clave: "orad13" }, { obra_id: "Urbano Orad 15", presupuesto: "OO-2026-143", clave: "orad15" }];
const BLOQUE = "Control interno (presupuesto: Total material y mano de obra, 320 h)";

// filas de certif_partidas que faltan (las que ya están no se repiten)
function filasPartidasOrad(existentes, ahora = new Date().toISOString()) {
  const hay = new Set((existentes || []).map((p) => p.partida_id));
  const out = [];
  for (const pt of PORTALES_ORAD) for (const p of PARTIDAS_ORAD) {
    const partida_id = `${pt.clave}_p${p.n}`;
    if (hay.has(partida_id)) continue;
    out.push({ partida_id, obra_id: pt.obra_id, bloque: BLOQUE, nombre: `${p.n}. ${p.nombre}`, tiempo_previsto_dias: Math.round(p.horas / 16 * 100) / 100,
               tiempo_previsto_horas: p.horas, orden: p.n, created_at: ahora, medicion: JSON.stringify(p.medicion) });
  }
  return out;
}

// medicion de una partida (texto JSON de la hoja) con su N resuelto con los totales de la obra ({ columnas: 14 })
function leerMedicion(txt, totales = {}) {
  let m = null;
  try { m = txt ? JSON.parse(String(txt)) : null; } catch { m = null; }
  if (!m || !m.tipo) return null;
  if (m.tipo === "conteo") {
    const total = Number(m.total) > 0 ? Number(m.total) : Number(totales?.[m.total_de]) > 0 ? Number(totales[m.total_de]) : null;
    return { ...m, total, falta_total: total == null };
  }
  return m;
}
// % de una partida por conteo: «8 de 21 viviendas» → 38 %
const pctDeConteo = (x, n) => (Number(n) > 0 ? Math.max(0, Math.min(100, Math.round(Number(x) / Number(n) * 100))) : null);

module.exports = { PARTIDAS_ORAD, PORTALES_ORAD, filasPartidasOrad, leerMedicion, pctDeConteo };
