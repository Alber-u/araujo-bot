// ============================================================
// lib/orden-cartera.cjs — orden del calendario de obras según cómo va la
// documentación de cada expediente (Alberto, 03/10/2026)
// ============================================================
// Lee la hoja de comunidades (la del panel HOY de Guillermo, SOLO LECTURA) y
// a cada obra de la cartera (fases 05-09) le pone:
//   · orden   → posición en la cola del calendario
//   · pasos   → pasos de trámite que le faltan hasta poder empezar
//               (× el mando «Ritmo de tramitación»)
//   · estado_doc → texto para la columna «Documentación»
//   · atascada_dias → días en la misma fase si pasa de 90
// Reglas (mismo orden que HOY donde existe):
//   1) 09 en el orden de su lista «En ejecución»: más hitos hechos primero,
//      luego CyCP completo más antiguo, luego dirección.
//   2) 08: primero «CyCP solicitados» (fecha de envío de contratos y pagos),
//      luego «pendiente de iniciar»; dentro, menos documentos que falten.
//   3) 07: por fecha de visita del técnico, la más antigua primero.
//   4) 06 (documentación enviada a EMASESA): por fecha de envío, la más antigua
//      primero.
//   5) Atascadas (más de 90 días en la misma fase): al final de su bloque.
//   6) 05: menos documentos que falten primero; «resolver el contrato» al final.
// «Documentos que faltan» = documentos de la comunidad (est_ccpp_*) sin
// entregar, con las reglas de HOY: OK/6/12/18/FFCC/IPREM = hecho; OP/NP/vacío
// no cuentan; en 08 solo contrato y pago, en 05-07 todos menos esos dos. No
// cuenta los pisos (HOY sí: su «Faltan X de Y» va por filas).
// ============================================================
"use strict";

const crypto = require("crypto");

// Columnas de comunidades!A:BO (presupuestos.cjs COLS, índice 0)
const C = {
  comunidad: 0, direccion: 1, fase: 15, fecha_aceptacion_pto: 21, fecha_visita_emasesa: 38,
  fecha_documentacion_completa: 39, est_ini: 42, est_fin: 50, fecha_envio_contratos_pagos: 51,
  fecha_cycp_completa: 52, fecha_cobro: 56, fecha_pte_cobro: 59, fecha_ultimatum_ampliado: 63,
  fecha_disidentes_solicitados: 64, fecha_contrato_resuelto: 65, hitos_obra: 66,
};
const EST = ["ccpp_contrato_firmado", "ccpp_toma_datos", "ccpp_nif", "ccpp_acta_pte", "ccpp_acta_pto", "ccpp_renuncia_gp", "ccpp_factura_emasesa", "ccpp_contrato", "ccpp_pago"];
const HECHO = new Set(["OK", "6", "12", "18", "FFCC", "IPREM"]);
const IGNORA = new Set(["OP", "NP", ""]);
const SOLO_08 = new Set(["ccpp_contrato", "ccpp_pago"]);
const DIAS_ATASCADA = 90;
const DIAS_RESOLVER = 5;            // HOY: disidentes solicitados + 5 días → «resolver el contrato»

// Mismo id que posicion-neta-real (obra_id = ccppId(direccion))
function ccppId(direccion) {
  const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
  return `ccpp_${slug}_${hash}`;
}
const iso = (v) => { const s = String(v == null ? "" : v).trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const dias = (desde, hoy) => (desde ? Math.floor((Date.parse(hoy) - Date.parse(desde)) / 86400000) : null);
const fmt = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");

// Estado documental de una fila de comunidades
function estadoFila(r, hoy) {
  const fase = String(r[C.fase] || "").trim();
  const f = Number(fase.slice(0, 2)) || 0;
  const get = (k) => iso(r[C[k]]);
  // documentos de la comunidad que faltan (reglas de HOY por fase)
  let faltan = 0, total = 0;
  EST.forEach((cod, i) => {
    if (f === 8 ? !SOLO_08.has(cod) : f <= 7 && SOLO_08.has(cod)) return;
    const v = String(r[C.est_ini + i] == null ? "" : r[C.est_ini + i]).trim().toUpperCase();
    if (IGNORA.has(v)) return;
    total++;
    if (!HECHO.has(v)) faltan++;
  });
  let hitos = 0;
  try { const j = JSON.parse(r[C.hitos_obra] || "{}") || {}; hitos = Object.keys(j).filter((k) => j[k]).length; } catch { hitos = 0; }
  // base de días en la fase (como panel-obras «atascado»)
  const base = f === 5 ? get("fecha_aceptacion_pto") : f === 6 || f === 7 ? get("fecha_documentacion_completa")
    : f === 8 ? (get("fecha_cycp_completa") || get("fecha_envio_contratos_pagos")) : null;
  const enFase = dias(base, hoy);
  const atascada = enFase != null && enFase > DIAS_ATASCADA ? enFase : null;
  const bm = get("fecha_disidentes_solicitados"), bn = get("fecha_contrato_resuelto");
  const resolver = !!bn || (bm && dias(bm, hoy) >= DIAS_RESOLVER + 1);
  const solicitados = !!get("fecha_envio_contratos_pagos");
  const en09 = f === 9 && !get("fecha_cobro") && !get("fecha_pte_cobro");
  let texto;
  if (f === 9) texto = en09 ? `En ejecución · ${hitos} hito(s)` : get("fecha_cobro") ? "Facturada" : "Factura pendiente";
  else if (f === 8) texto = `${solicitados ? `CyCP solicitados hace ${dias(get("fecha_envio_contratos_pagos"), hoy)} d` : "Pendiente de iniciar"}${total ? ` · faltan ${faltan} de ${total}` : ""}`;
  else if (f === 7) texto = get("fecha_visita_emasesa") ? `Visita técnico ${fmt(get("fecha_visita_emasesa"))}` : "Pendiente de visita";
  else if (f === 6) texto = get("fecha_documentacion_completa") ? `Enviada a EMASESA ${fmt(get("fecha_documentacion_completa"))} (hace ${dias(get("fecha_documentacion_completa"), hoy)} d)` : "Enviada a EMASESA (sin fecha)";
  else texto = resolver ? (bn ? "Contrato resuelto" : "Resolver el contrato") : total ? `Faltan ${faltan} de ${total} documentos` : "Documentación";
  if (atascada) texto += ` · atascada ${atascada} días`;
  return {
    fase: f, faltan, total, hitos, en09, solicitados, resolver, atascada_dias: atascada,
    fecha_cycp: get("fecha_cycp_completa"), fecha_envio: get("fecha_documentacion_completa"), fecha_visita: get("fecha_visita_emasesa"),
    direccion: String(r[C.direccion] || r[C.comunidad] || ""), estado_doc: texto,
  };
}

// Clave de orden dentro de cada bloque de fase (menor = antes)
function claveOrden(e) {
  const dir = e.direccion.toLowerCase();
  const fecha = (d) => d || "9999-99-99";
  switch (e.fase) {
    case 9: return [e.en09 ? 0 : 1, -e.hitos, fecha(e.fecha_cycp), dir];
    case 8: return [e.atascada_dias ? 1 : 0, e.solicitados ? 0 : 1, e.faltan, dir];
    case 7: return [e.atascada_dias ? 1 : 0, fecha(e.fecha_visita), dir];
    case 6: return [e.atascada_dias ? 1 : 0, fecha(e.fecha_envio), dir];
    default: return [e.resolver ? 2 : e.atascada_dias ? 1 : 0, e.faltan, dir];
  }
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };

// Pasos de trámite que faltan hasta poder empezar (× «Ritmo de tramitación»)
const pasos = (e) => (e.fase >= 9 ? 0 : 9 - e.fase);

// obras: las de posicion-neta-real (obra_id, nombre, fase…); filas: comunidades!A2:BO
// Devuelve las obras con orden, pasos, estado_doc y atascada_dias.
function ordenarCartera(obras, filas, hoy) {
  const porId = new Map();
  for (const r of filas || []) {
    const dir = String(r[C.direccion] || "").trim();
    if (dir) porId.set(ccppId(dir), estadoFila(r, hoy));
  }
  const conEstado = obras.map((o, i) => {
    const e = porId.get(o.obra_id) || { fase: Number(String(o.fase).slice(0, 2)) || 0, faltan: 0, total: 0, hitos: 0, en09: true, solicitados: false, resolver: false, atascada_dias: null, direccion: o.nombre || "", estado_doc: "sin datos de documentación" };
    return { o, e, i };
  });
  conEstado.sort((a, b) => (b.e.fase - a.e.fase) || cmp(claveOrden(a.e), claveOrden(b.e)) || a.i - b.i);
  return conEstado.map(({ o, e }, k) => ({ ...o, orden: k + 1, pasos: pasos(e), estado_doc: e.estado_doc, atascada_dias: e.atascada_dias, faltan_docs: e.faltan }));
}

module.exports = { ordenarCartera, estadoFila, claveOrden, ccppId, COLUMNAS: C, DIAS_ATASCADA };
