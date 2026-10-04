// ============================================================
// lib/bloqueos-expediente.cjs — bloqueos de contrato y pago con el expediente
// de Guillermo (expediente-estado), la misma fuente que «Lista para empezar».
// (Alberto, 04/10/2026)
// ============================================================
// bloqueos_operativos tenía «Falta contrato firmado» (CONTRATOS_PAGOS) y
// «Falta pago vecino» (PAGO_PENDIENTE) de hace 148 días que contradicen el
// expediente: la regla vieja miraba fecha_contratos_pagos_completa, una columna
// que ya no se usa. Ahora, al LEER los bloqueos (Operativo, Mi día, Panel de
// Obras y su ficha):
//   · esas dos clases se quitan de la hoja y se calculan con el expediente, para
//     las obras desde la fase 08 (cuando se piden contratos y pagos), con el
//     motivo real («Falta contrato: 2 pisos (1A, 2B)», «Pendiente abono Sabadell:
//     5 pisos»…). De la fila de la hoja se conserva lo puesto a mano: owner,
//     esperar_hasta, comentario, override, y la fecha en que se detectó.
//   · las obras terminadas (OT en 14 o más) o facturadas no tienen bloqueos.
//   · la fila de prueba («test desde curl») no se enseña.
// Sin expediente (no se pudo leer), esas dos clases no se enseñan: la regla
// vieja no vale. Solo lectura: no se escribe nada en la hoja.
// ============================================================
"use strict";

const { norm } = require("./expediente-estado.cjs");

const COLS_BLOQUEO = ["comunidad", "tipo_bloqueo", "severidad", "pelota_en", "impacto", "vecinos_afectados", "accion_exacta", "detectado_por", "detectado_en",
  "ultimo_movimiento_humano", "dias_sin_movimiento", "override_por", "override_en", "override_comentario", "esperar_hasta", "proxima_revision", "resuelto",
  "resuelto_en", "owner", "owner_override", "owner_override_por", "comentario_operativo"];
const TIPOS_EXPEDIENTE = new Set(["CONTRATOS_PAGOS", "PAGO_PENDIENTE"]);
const lista3 = (xs) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} y ${xs.length - 3} más` : xs.join(", "));
const pisos = (n) => `${n} ${n === 1 ? "piso" : "pisos"}`;
const esPrueba = (b) => Object.values(b).some((v) => /test desde curl/i.test(String(v || "")));

// Índice por nombre y por dirección de la comunidad
function indice(expedientes) {
  const m = new Map();
  for (const e of Object.values(expedientes || {})) {
    for (const k of [e.comunidad, e.direccion]) if (k && !m.has(norm(k))) m.set(norm(k), e);
  }
  return m;
}

// Lo que falta de contrato y de pago: las MISMAS faltas y textos que «Lista para empezar»
// (planificacion-calendario.estadoLista). pend: la obra en cash flow sabadell.pendientes
// (abonos de financiaciones_sabadell y custodia de la 5610 en Holded); sin él, solo la hoja.
const ES_CONTRATO = /contrato|No cuadran|repetid/i;
const ES_PAGO = /pago|Sabadell/i;
function faltasExpediente(e, pend = null, conSabadell = false) {
  const { estadoLista } = require("./planificacion-calendario.cjs");
  const r = estadoLista({ fase: e.fase }, Number(String(e.fase || "").slice(0, 2)) || 0, e, pend, conSabadell);
  const propias = (r.faltas || []).filter((t) => !/^Documentación|^El expediente no tiene pisos/.test(t));
  const contrato = propias.filter((t) => ES_CONTRATO.test(t) && !/^Con contrato y sin pago|sin pago \(/.test(t));
  const pago = propias.filter((t) => !contrato.includes(t) && ES_PAGO.test(t));
  // pisos afectados, de los datos del expediente (no del texto)
  const cu = e.cuadre?.ok === false ? e.cuadre : {};
  const vecinosC = contrato.length ? [...new Set([...(e.contratos?.faltan || []), ...(cu.repetidos || []).map((x) => x.vivienda), ...(cu.sin_contrato || []).map((x) => x.vivienda)])] : [];
  const sinAbono = pend ? pend.viviendas || [] : conSabadell ? [] : (e.pagos?.financiados || []).filter((f) => !f.abonado).map((f) => f.vivienda);
  const vecinosP = pago.length ? [...new Set([...(e.pagos?.faltan || []), ...(cu.sin_pago || []).map((x) => x.vivienda), ...sinAbono])] : [];
  return { contrato, pago, vecinosC, vecinosP, lista: r.lista, estado: r };
}

// bloqueos: objetos con las columnas de bloqueos_operativos. expedientes: { ccpp_id: estado } o null.
// Devuelve la lista para enseñar (sin tocar la hoja).
// pendientes: cash flow sabadell.pendientes ([{ ccpp_id, viviendas, comunidad, importe… }]) o null
function bloqueosConExpediente(bloqueos, expedientes, hoy = new Date().toISOString().slice(0, 10), pendientes = null) {
  const idx = expedientes ? indice(expedientes) : null;
  const deObra = (b) => (idx ? idx.get(norm(b.comunidad)) || null : null);
  const fuera = (e) => !!(e && (e.terminada || e.facturada));
  // filas de la hoja de esas dos clases: solo para conservar lo puesto a mano
  const manual = new Map();
  const out = [];
  for (const b of bloqueos || []) {
    if (!b || !b.comunidad || esPrueba(b)) continue;
    const e = deObra(b);
    if (fuera(e)) continue;
    if (TIPOS_EXPEDIENTE.has(b.tipo_bloqueo)) { if (e) manual.set(`${e.ccpp_id}|${b.tipo_bloqueo}`, b); continue; }
    out.push(b);
  }
  if (!expedientes) return out;
  for (const e of Object.values(expedientes)) {
    if (fuera(e)) continue;
    const f = Number(String(e.fase || "").slice(0, 2)) || 0;
    if (f < 8 || /^ZZ/i.test(String(e.fase || ""))) continue;   // contratos y pagos se piden en la 08
    const fx = faltasExpediente(e, pendientes ? pendientes.find((x) => x.ccpp_id === e.ccpp_id) || null : null, !!pendientes);
    for (const [tipo, faltas, vecinos] of [["CONTRATOS_PAGOS", fx.contrato, fx.vecinosC], ["PAGO_PENDIENTE", fx.pago, fx.vecinosP]]) {
      if (!faltas.length) continue;
      const prev = manual.get(`${e.ccpp_id}|${tipo}`);
      if (prev && prev.resuelto === "si") continue;
      out.push({
        ...(prev || {}),
        comunidad: prev?.comunidad || e.comunidad, tipo_bloqueo: tipo, severidad: prev?.severidad || "critica",
        pelota_en: tipo === "PAGO_PENDIENTE" && faltas.every((t) => /Sabadell/.test(t)) ? "financiera" : "vecino",
        impacto: "bloquea_inicio", vecinos_afectados: vecinos.join(", "), accion_exacta: faltas.join(" · "),
        detectado_por: "expediente", detectado_en: prev?.detectado_en || hoy, resuelto: "no",
        owner: prev?.owner || "Guillermo", motivo_expediente: faltas, ccpp_id: e.ccpp_id,
      });
    }
  }
  return out;
}

// Lo mismo sobre filas crudas de la hoja (bloqueos_operativos!A2:V, sin cabecera)
const filaAObjeto = (row) => Object.fromEntries(COLS_BLOQUEO.map((k, i) => [k, String((row || [])[i] ?? "").trim()]));
const objetoAFila = (o) => COLS_BLOQUEO.map((k) => o[k] ?? "");
function filasConExpediente(rows, expedientes, hoy, pendientes = null) {
  return bloqueosConExpediente((rows || []).filter((r) => r && r[0]).map(filaAObjeto), expedientes, hoy, pendientes).map(objetoAFila);
}

// expediente-estado en el mismo proceso (app.locals.expedienteEstado), sin romper si falla
async function leerExpedientes(app) {
  try { return typeof app?.locals?.expedienteEstado === "function" ? await app.locals.expedienteEstado() : null; }
  catch (e) { console.warn("[bloqueos-expediente] sin expediente:", e.message); return null; }
}
// Abonos de Sabadell pendientes ya calculados por el cash flow (financiaciones_sabadell + 5610 de
// Holded, app.locals.sabadellPendientes): sin llamadas nuevas a Holded; null si aún no hay carga
function leerPendientes(app) {
  try { return typeof app?.locals?.sabadellPendientes === "function" ? app.locals.sabadellPendientes() : null; } catch { return null; }
}

module.exports = { bloqueosConExpediente, filasConExpediente, faltasExpediente, leerExpedientes, leerPendientes, COLS_BLOQUEO, TIPOS_EXPEDIENTE };
