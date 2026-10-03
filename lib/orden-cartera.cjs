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
  pto_total: 22, material_previsto: 25,   // lo mismo que lee rentabilidad-obra (previsto)
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
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
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
    material_previsto: num(r[C.material_previsto]) || null,
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
  return conEstado.map(({ o, e }, k) => ({ ...o, orden: k + 1, pasos: pasos(e), estado_doc: e.estado_doc, atascada_dias: e.atascada_dias, faltan_docs: e.faltan,
    material_previsto: o.material_previsto ?? e.material_previsto ?? null }));
}

// ── Lo que el panel de obras sabe de cada obra empezada o terminada ──
// ot: /api/ara-os/ordenes-trabajo (grupos por fase de OT, con ccpp_id y ot.*)
// Devuelve { [ccpp_id]: { inicio, fin } }: inicio = fecha real de arranque o,
// si no, la fecha de inicio asignada; fin = la OT ya está en fase 14 o más.
function fechasOT(ot) {
  const out = {};
  for (const [fase, xs] of Object.entries(ot?.grupos || {})) {
    const f = Number(String(fase).slice(0, 2)) || 0;
    for (const x of xs || []) {
      if (!x.ccpp_id) continue;
      const inicio = iso(x.ot?.fecha_inicio_real) || iso(x.ot?.fecha_inicio_obra);
      out[x.ccpp_id] = { inicio, fin: f >= 14 && f !== 19 };
    }
  }
  return out;
}

// ── Otras obras (OO) aceptadas y sin terminar → cartera del simulador ──
// Fases INICIO_OBRA y EN_EJECUCION. Se juntan las de la misma calle y fecha de
// inicio (Urbano Orad 13 y 15 = una obra de 2 edificios, aunque tengan dos OT:
// OT0143 y OT0144). Si tienen horas y material previstos (presupuesto con datos
// obligatorios) se usan; si no, horas para un 40 % y el % de material del mando.
// Importe pendiente = base × (1 − lo ya cobrado ÷ total con IVA). Cobro: un
// mes después de terminar; sin comisión comercial (no son Plan 5); horas: las
// que dejan un 40 % de beneficio (no tienen horas previstas).
const verdad = (v) => v === true || String(v).toUpperCase() === "TRUE";
const calle = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(ccpp|c\/|calle|avda?\.?)\b/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
const MARGEN_OO = 0.4;
function carteraOO(oo, hoy) {
  const vivas = (oo?.obras || []).filter((o) => ["INICIO_OBRA", "EN_EJECUCION"].includes(o.fase) && !verdad(o.borrado));
  const grupos = new Map();
  for (const o of vivas) {
    const ini = iso(o.fecha_inicio);
    const clave = ini ? `${calle(o.nombre || o.direccion)}|${ini}` : String(o.codigo_ot || o.obra_id);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(o);
  }
  return [...grupos.values()].map((xs) => {
    let base = 0, pend = 0, horas = 0, material = 0, conPrevision = true;
    for (const o of xs) {
      const tot = num(o.total_eur) || num(o.importe);
      let b = num(o.subtotal_eur);
      if (!b && num(o.iva_eur) > 0) b = tot - num(o.iva_eur);
      if (!b && tot) b = tot / 1.21;
      const cobrado = num(o.entradas_cuenta_eur) + num(o.cobrado_eur);
      base += b; pend += tot > 0 ? Math.max(0, b * (1 - cobrado / tot)) : b;
      if (num(o.horas_previstas) > 0 && num(o.material_previsto_eur) > 0) { horas += num(o.horas_previstas); material += num(o.material_previsto_eur); } else conPrevision = false;
    }
    const ini = xs.map((o) => iso(o.fecha_inicio)).filter(Boolean).sort()[0] || null;
    // «Urbano Orad 13» + «Urbano Orad 15» → «Urbano Orad 13-15»
    const partes = xs.map((o) => String(o.nombre || o.obra_id).trim().match(/^(.*?)\s+(\d+\w?)$/));
    const nombres = xs.length > 1 && partes.every((m) => m && m[1].toLowerCase() === partes[0][1].toLowerCase())
      ? `${partes[0][1]} ${partes.map((m) => m[2]).join("-")}` : xs.map((o) => String(o.nombre || o.obra_id)).join(" + ");
    const r2 = (n) => Math.round(n * 100) / 100;
    return { obra_id: xs.map((o) => o.obra_id).join("+"), nombre: nombres, fase: "09_OO", tipo: "OO",
             importe: r2(pend), importe_total: r2(base), horas_previstas: conPrevision ? r2(horas) : 0, horas_registradas: 0,
             material_previsto: conPrevision ? r2(material) : null, sin_prevision: !conPrevision,
             mes_cobro: 1, sin_comision: true, margen_objetivo: conPrevision ? null : MARGEN_OO,
             codigos_ot: xs.map((o) => o.codigo_ot).filter(Boolean),
             inicio_fijo: ini && ini > hoy ? ini : null, empezada: ini && ini <= hoy ? ini : null,
             estado_doc: `Otra obra aceptada${ini ? ` · ${ini <= hoy ? "empezó" : "empieza"} el ${fmt(ini)}` : ""} · ${base > 0 ? Math.round((1 - pend / base) * 100) : 0} % cobrado · sin comisión${conPrevision ? "" : " · sin horas ni material previstos: complétalo"}` };
  }).filter((o) => o.importe_total > 0);
}

// Cartera completa del simulador: obras 05-09 (con su orden de documentación),
// con las fechas del panel de obras, y las OO aceptadas
function completarCartera(obras, { ot = null, oo = null, hoy }) {
  const fechas = fechasOT(ot);
  const conFechas = obras.map((o) => {
    const f = fechas[o.obra_id];
    if (!f) return o;
    const extra = {};
    if (f.fin) extra.fin_obra = o.fecha_fin || hoy;
    else if (f.inicio && f.inicio <= hoy) extra.empezada = f.inicio;
    else if (f.inicio) extra.inicio_fijo = f.inicio;
    if (f.inicio && !f.fin) extra.estado_doc = `${f.inicio <= hoy ? "Empezó" : "Empieza"} el ${fmt(f.inicio)}${o.estado_doc ? ` · ${o.estado_doc}` : ""}`;
    return { ...o, ...extra };
  });
  return [...conFechas, ...carteraOO(oo, hoy)];
}

// ── Planificación a mano (hoja planificacion_obras) ──
// Registro de cambios: obra_id | posicion | fecha_inicio_fija | cuadrilla |
// nota | usuario | fecha. Manda la última fila de cada obra; una fila con
// obra_id «TODAS» (botón «Volver al orden automático») anula todo lo anterior.
const HOJA_PLAN = "planificacion_obras";
const PLAN_HEADERS = ["obra_id", "posicion", "fecha_inicio_fija", "cuadrilla", "nota", "usuario", "fecha"];
const TODAS = "TODAS";
function planVigente(filas) {
  const ord = (filas || []).filter((f) => f && f.obra_id).map((f, i) => ({ ...f, _i: i }))
    .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || a._i - b._i);
  const out = {};
  for (const f of ord) {
    if (String(f.obra_id).trim().toUpperCase() === TODAS) { for (const k of Object.keys(out)) delete out[k]; continue; }
    const posicion = num(f.posicion) > 0 ? Math.round(num(f.posicion)) : null;
    const cuadrilla = num(f.cuadrilla) > 0 ? Math.round(num(f.cuadrilla)) : null;
    const fecha_inicio_fija = iso(f.fecha_inicio_fija);
    const id = String(f.obra_id).trim();
    if (!posicion && !cuadrilla && !fecha_inicio_fija) { delete out[id]; continue; }   // vuelve al automático esa obra
    out[id] = { posicion, cuadrilla, fecha_inicio_fija, nota: String(f.nota || ""), usuario: String(f.usuario || ""), fecha: String(f.fecha || "") };
  }
  return out;
}
function aplicarPlanificacion(obras, filas) {
  const plan = planVigente(filas);
  return obras.map((o) => {
    const p = plan[o.obra_id];
    if (!p) return o;
    return { ...o, posicion: p.posicion || undefined, cuadrilla: p.cuadrilla || undefined,
             ...(p.fecha_inicio_fija ? { inicio_fijo: p.fecha_inicio_fija, inicio_manual: true } : {}),
             plan: p };
  });
}
// Validación de un cambio (la nota corta es obligatoria)
function validarCambioPlan(c) {
  const errs = [];
  if (!c || !String(c.obra_id || "").trim()) errs.push("falta obra_id");
  if (!String(c?.nota || "").trim()) errs.push("la nota es obligatoria");
  if (String(c?.nota || "").length > 200) errs.push("nota de 200 caracteres como mucho");
  if (!String(c?.usuario || "").trim()) errs.push("falta quién hace el cambio");
  if (c?.fecha_inicio_fija && !iso(c.fecha_inicio_fija)) errs.push("fecha_inicio_fija debe ser AAAA-MM-DD");
  if (c?.posicion != null && c.posicion !== "" && !(num(c.posicion) >= 1)) errs.push("posicion debe ser 1 o más");
  if (c?.cuadrilla != null && c.cuadrilla !== "" && !(num(c.cuadrilla) >= 1)) errs.push("cuadrilla debe ser 1 o más");
  return errs;
}

module.exports = { HOJA_PLAN, planVigente, aplicarPlanificacion, validarCambioPlan, PLAN_HEADERS, TODAS, ordenarCartera, estadoFila, claveOrden, ccppId, fechasOT, carteraOO, completarCartera, COLUMNAS: C, DIAS_ATASCADA };
