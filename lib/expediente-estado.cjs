// ============================================================
// lib/expediente-estado.cjs — «¿está la obra lista para empezar?» según el
// expediente de Guillermo (SOLO LECTURA) · encargo del 04/10/2026
// ============================================================
// Lee lo mismo que la caja del expediente (/documentacion/expediente, función
// cajitaManualHtml de documentacion.cjs) pero para todas las obras a la vez:
//   · pisos!A:AX → una fila por piso; estados en las columnas «est_<código>»
//     (est_piso_contrato, est_piso_pago, est_piso_meses_financiar…)
//   · comunidades!A:BO → la fila «Comunidad de propietarios» (est_ccpp_*) y la fase
//   · documentos_manuales → qué documentos pide cada nivel (para «Faltan N de M»,
//     que se cuenta con presupuestos._contarFaltan: la misma regla que la ficha)
//   · financiaciones_sabadell → importe de cada piso financiado (para la custodia)
// piso_pago: «OK» = pagado a EMASESA · un número (6, 12, 18) o «FFCC» = financiado
// (lo cobra ARA y lo entrega a EMASESA) · «IPREM» = resuelto · vacío, F, REVISAR… = pendiente.
// «OP» / «NP» = no aplica a ese piso.
// ============================================================
"use strict";

const { ccppId } = require("./orden-cartera.cjs");

const IGNORA = new Set(["OP", "NP", ""]);
const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// estado de pago de un piso
function tipoPago(v) {
  const e = String(v || "").trim().toUpperCase();
  if (IGNORA.has(e)) return { tipo: "no_aplica" };
  if (e === "OK") return { tipo: "pagado" };
  if (e === "IPREM") return { tipo: "pagado", iprem: true };
  if (/^\d+$/.test(e)) return { tipo: "financiado", meses: Number(e) };
  if (e === "FFCC") return { tipo: "financiado", meses: null, ffcc: true };
  return { tipo: "pendiente", valor: e };
}
const contratoOk = (v) => { const e = String(v || "").trim().toUpperCase(); return IGNORA.has(e) ? null : e === "OK"; };

// Columnas conocidas (presupuestos.cjs COLS, ara-os-inferencia.cjs COLS_PISO): si la
// cabecera de la hoja no trae estos nombres, se usan por posición
const COLS_COM = ["comunidad", "direccion", "presidente", "telefono_presidente", "email_presidente", "estado_comunidad", "fecha_inicio", "fecha_limite_documentacion", "fecha_limite_firma", "observaciones", "tipo_via", "earth", "administrador", "telefono_administrador", "email_administrador", "fase_presupuesto", "fecha_solicitud_pto", "fecha_visita_pto", "fecha_envio_pto", "fecha_ultimo_seguimiento_pto", "decision_pto", "fecha_decision_pto", "pto_total", "mano_obra_previsto", "mano_obra_real", "material_previsto", "material_real", "beneficio_previsto", "beneficio_real", "beneficio_desvio", "tiempo_previsto", "tiempo_real", "tiempo_desvio", "notas_pto", "mails_enviados", "mails_ultimo_envio", "fecha_proximo_mail_manual", "fecha_ultimo_reenvio_pto", "fecha_visita_emasesa", "fecha_documentacion_completa", "fecha_contratos_pagos_completa", "modo_documentacion", "est_ccpp_contrato_firmado", "est_ccpp_toma_datos", "est_ccpp_nif", "est_ccpp_acta_pte", "est_ccpp_acta_pto", "est_ccpp_renuncia_gp", "est_ccpp_factura_emasesa", "est_ccpp_contrato", "est_ccpp_pago"];
const COLS_PISO = ["telefono", "comunidad", "vivienda", "nota_simple", "nombre", "paso_actual", "documento_actual", "estado_expediente", "fecha_inicio", "fecha_primer_contacto", "fecha_ultimo_contacto", "fecha_limite_documentacion", "fecha_limite_firma", "documentos_completos", "alerta_plazo", "documentos_recibidos", "documentos_pendientes", "documentos_opcionales_pendientes", "ultimo_documento_fallido", "fecha_ultimo_fallo", "reintento_hasta", "motivo_bloqueo_actual", "prioridad_expediente", "requiere_intervencion_humana", "documentos_opcionales_descartados", "notificacion_financiacion_enviada", "documentos_recibidos_sin_archivo", "documentos_no_aplica", "est_piso_toma_datos", "est_piso_nif_toma_datos", "est_piso_titularidad", "est_piso_empadronamiento", "est_piso_contrato_alquiler", "est_piso_nif_propietario", "est_piso_licencia_apertura", "est_piso_escrituras_empresa", "est_piso_poderes", "est_piso_nif_apoderado", "est_piso_meses_financiar", "est_piso_nif_financiado", "est_piso_justificante_ingresos", "est_piso_cuenta_bancaria", "est_piso_disidente", "est_piso_contrato", "est_piso_pago"];

// filas con cabecera → objetos por nombre de columna (en minúsculas)
function aObjetos(valores, conocidas = [], clave = null) {
  let cab = (valores[0] || []).map((h) => String(h || "").trim().toLowerCase());
  if (clave && !cab.includes(clave)) cab = conocidas.map((h, i) => h || cab[i]);
  return { cab, filas: valores.slice(1).map((r) => Object.fromEntries(cab.map((h, i) => [h, r[i] != null ? r[i] : ""]))) };
}

// comunidades: valores de comunidades!A:BO (con cabecera) · pisos: pisos!A:AX (con cabecera)
// docs: { piso: [{codigo,…}], ccpp: [...] } (documentos_manuales, ordenados) · sabadell: financiaciones_sabadell!A2:L
// contarFaltan: presupuestos._contarFaltan (opcional)
function estadosExpedientes({ comunidades, pisos, docs, sabadell = [], contarFaltan = null }) {
  const C = aObjetos(comunidades || [], COLS_COM, "est_ccpp_pago"), Pz = aObjetos(pisos || [], COLS_PISO, "est_piso_pago");
  const docsPiso = docs?.piso || [], docsCcpp = docs?.ccpp || [];
  // pisos por comunidad (columna «comunidad» = nombre o dirección de la comunidad)
  const porCom = new Map();
  for (const p of Pz.filas) {
    const k = norm(p.comunidad);
    if (!k || !String(p.vivienda || "").trim()) continue;
    if (!porCom.has(k)) porCom.set(k, []);
    porCom.get(k).push(p);
  }
  // financiaciones Sabadell: importe por comunidad y vivienda
  const sab = new Map();
  for (const r of sabadell || []) {
    if (String(r[1] || "").trim() !== "piso") continue;
    const k = `${norm(r[2])}|${norm(r[3])}`;
    sab.set(k, (sab.get(k) || 0) + num(r[5]));
  }
  const out = {};
  for (const c of C.filas) {
    const nombre = String(c.comunidad || "").trim(), dir = String(c.direccion || "").trim();
    if (!nombre && !dir) continue;
    const id = ccppId(dir || nombre);
    const fase = String(c.fase_presupuesto || c.fase || "").trim();
    const suyos = [...(porCom.get(norm(dir)) || []), ...(norm(nombre) !== norm(dir) ? porCom.get(norm(nombre)) || [] : [])];
    const lista = suyos.map((p) => ({
      vivienda: String(p.vivienda).trim(),
      contrato: contratoOk(p.est_piso_contrato),
      pago: tipoPago(p.est_piso_pago),
      meses_financiar: String(p.est_piso_meses_financiar || "").trim() || null,
      estados: docsPiso.map((d) => String(p[`est_${d.codigo}`] ?? "").trim()),
    }));
    const conContrato = lista.filter((p) => p.contrato !== null), conPago = lista.filter((p) => p.pago.tipo !== "no_aplica");
    const financiados = conPago.filter((p) => p.pago.tipo === "financiado").map((p) => {
      const imp = sab.get(`${norm(nombre)}|${norm(p.vivienda)}`) || sab.get(`${norm(dir)}|${norm(p.vivienda)}`) || null;
      return { vivienda: p.vivienda, meses: p.pago.meses, ffcc: !!p.pago.ffcc, importe: imp };
    });
    // fila de la comunidad (contrato y pago comunitarios, si contrata)
    const estC = docsCcpp.map((d) => String(c[`est_${d.codigo}`] ?? "").trim());
    const ccC = String(c.est_ccpp_contrato || "").trim().toUpperCase(), ccP = String(c.est_ccpp_pago || "").trim();
    const ccpp = { aplica: !(IGNORA.has(ccC) && IGNORA.has(ccP.toUpperCase())), contrato: IGNORA.has(ccC) ? null : ccC === "OK", pago: tipoPago(ccP) };
    // «Faltan N de M» con la regla de la ficha (fila de la comunidad + pisos, docs según la fase)
    let doc = null;
    if (contarFaltan && (docsPiso.length || docsCcpp.length)) {
      const r = contarFaltan(estC, docsCcpp, lista.map((p) => ({ estados: p.estados })), docsPiso, fase);
      doc = { faltan: r.pend, total: r.totalFilas };
    }
    out[id] = {
      ccpp_id: id, comunidad: nombre || dir, fase,
      pisos: lista.length,
      contratos: { ok: conContrato.filter((p) => p.contrato).length, total: conContrato.length, faltan: conContrato.filter((p) => !p.contrato).map((p) => p.vivienda) },
      pagos: { resueltos: conPago.filter((p) => p.pago.tipo !== "pendiente").length, total: conPago.length,
               pagados: conPago.filter((p) => p.pago.tipo === "pagado").length, financiados, faltan: conPago.filter((p) => p.pago.tipo === "pendiente").map((p) => p.vivienda) },
      ccpp, documentacion: doc,
    };
  }
  return out;
}

module.exports = { estadosExpedientes, tipoPago, norm };
