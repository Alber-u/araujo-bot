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
//   · financiaciones_sabadell → abonos de Sabadell (importe y fecha) de cada piso financiado
// piso_pago: «OK» = pagado a EMASESA · un número (6, 12, 18) o «FFCC» = financiado
// (lo cobra ARA y lo entrega a EMASESA) · «IPREM» = resuelto · vacío, F, REVISAR… = pendiente.
// «OP» / «NP» = no aplica a ese piso.
// ============================================================
"use strict";

const { ccppId } = require("./orden-cartera.cjs");

const IGNORA = new Set(["OP", "NP", ""]);
const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// normalización de presupuestos._leerPisosDeCcpp (sin acentos, espacios simples, minúsculas)
// claves de financiaciones_sabadell (05/10/2026): sin tildes, mayúsculas, espacios ni «CCPP»
// («CCPP Rafael Laffon 7» = «Rafael Laffón 7»; «0 DCHA» = «0DCHA»)
const normCom = (x) => norm(x).replace(/^(comunidad de propietarios|ccpp|cpp|cp|c p|calle|c)\s+/, "").replace(/ /g, "");
const normViv = (x) => norm(x).replace(/ /g, "");
const normPanel = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
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
// ots: filas de ordenes_trabajo (A = comunidad, B = fase_ot) para saber qué obras están terminadas
function estadosExpedientes({ comunidades, pisos, docs, sabadell = [], contarFaltan = null, ots = [] }) {
  const faseOT = new Map((ots || []).filter((r) => r && r[0]).map((r) => [norm(r[0]), String(r[1] || "").trim()]));
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
  // financiaciones Sabadell: cada fila es un ABONO de Sabadell a ARA (columna G = fecha de
  // abono). tipo «piso» = ese piso; tipo «comunidad» = todos los financiados de la comunidad.
  // Ese dinero es custodia (5610 de la obra) y se entrega a EMASESA antes de empezar.
  const sab = new Map(), sabCom = new Map(), entregas = new Map();
  for (const r of sabadell || []) {
    const tipo = String(r[1] || "").trim(), kc = normCom(r[2]), fecha = String(r[6] || "").trim().slice(0, 10) || null;
    if (!kc) continue;
    if (tipo === "piso") {
      const k = `${kc}|${normViv(r[3])}`;
      const prev = sab.get(k);
      sab.set(k, { importe: (prev?.importe || 0) + num(r[5]), fecha: prev?.fecha && (!fecha || prev.fecha > fecha) ? prev.fecha : fecha });
    } else if (tipo === "comunidad") {
      if (!sabCom.has(kc)) sabCom.set(kc, []);
      sabCom.get(kc).push({ importe: num(r[5]), fecha });
    } else if (tipo === "entrega_emasesa") entregas.set(kc, (entregas.get(kc) || 0) + num(r[5]));
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
    // Cuadre de pisos: cada piso una sola fila, y con contrato y pago a la vez.
    // Si no cuadran (p. ej. «7/7 contratos · 8/8 pagados»), no puede salir «Lista»
    const veces = new Map();
    for (const p of lista) { const k = norm(p.vivienda); veces.set(k, { vivienda: veces.get(k)?.vivienda || p.vivienda, filas: (veces.get(k)?.filas || 0) + 1 }); }
    const repetidos = [...veces.values()].filter((x) => x.filas > 1);
    const valor = (v) => { const t = String(v || "").trim(); return t ? `«${t}»` : "vacío"; };
    const sinContrato = suyos.filter((p) => contratoOk(p.est_piso_contrato) === null && tipoPago(p.est_piso_pago).tipo !== "no_aplica")
      .map((p) => ({ vivienda: String(p.vivienda).trim(), contrato: valor(p.est_piso_contrato), pago: String(p.est_piso_pago).trim() }));
    const sinPago = suyos.filter((p) => contratoOk(p.est_piso_contrato) !== null && tipoPago(p.est_piso_pago).tipo === "no_aplica")
      .map((p) => ({ vivienda: String(p.vivienda).trim(), contrato: String(p.est_piso_contrato).trim(), pago: valor(p.est_piso_pago) }));
    const cuadre = { ok: !repetidos.length && !sinContrato.length && !sinPago.length, filas: lista.length, pisos: veces.size,
                     contratos: conContrato.length, pagos: conPago.length, repetidos, sin_contrato: sinContrato, sin_pago: sinPago };
    // abonos de Sabadell de esta comunidad (por nombre o por dirección)
    const claves = [...new Set([normCom(nombre), normCom(dir), normCom(id)].filter(Boolean))];
    const abonoCom = claves.flatMap((k) => sabCom.get(k) || []);
    const abonoPiso = (v) => claves.map((k) => sab.get(`${k}|${normViv(v)}`)).find(Boolean) || null;
    // financiado: piso_pago con meses o FFCC, o con abono de Sabadell en financiaciones_sabadell aunque
    // el piso diga «OK» (Rafael Laffón 7, 0DCHA: financiado y abonado, salía «Sin financiación»)
    // (06/10/2026) con abono de Sabadell cuenta como financiado diga lo que diga su pago («OK», vacío…)
    const esFinanciado = (p) => p.pago.tipo === "financiado" || (p.pago.tipo !== "pendiente" && !!abonoPiso(p.vivienda));
    const financiados = lista.filter(esFinanciado).map((p) => {
      const a = abonoPiso(p.vivienda);
      const ab = a || (abonoCom.length ? { importe: null, fecha: abonoCom.map((x) => x.fecha).filter(Boolean).sort()[0] || null } : null);
      return { vivienda: p.vivienda, meses: p.pago.meses ?? null, ffcc: !!p.pago.ffcc, importe: a && a.importe > 0 ? a.importe : null,
               abonado: !!ab, fecha_abono: ab ? ab.fecha : null };
    });
    // abonos de Sabadell de pisos que no están en la hoja de pisos (o con otro nombre): también financiados
    const vistos = new Set(lista.map((p) => normViv(p.vivienda)));
    for (const k of claves) for (const [clave, a] of sab) {
      const [kc, kv] = clave.split("|");
      if (kc !== k || vistos.has(kv)) continue;
      vistos.add(kv);
      financiados.push({ vivienda: kv.toUpperCase(), meses: null, ffcc: false, importe: a.importe > 0 ? a.importe : null, abonado: true, fecha_abono: a.fecha, solo_sabadell: true });
    }
    // todo lo abonado por Sabadell a esta obra según la hoja (para el aviso de la 5610 y el cash flow)
    const abonos = [
      ...lista.map((p) => ({ vivienda: p.vivienda, a: abonoPiso(p.vivienda) })).filter((x) => x.a).map((x) => ({ vivienda: x.vivienda, importe: x.a.importe, fecha: x.a.fecha })),
      ...abonoCom.map((x) => ({ vivienda: null, importe: x.importe, fecha: x.fecha })),
      ...financiados.filter((f) => f.solo_sabadell).map((f) => ({ vivienda: f.vivienda, importe: f.importe || 0, fecha: f.fecha_abono })),
    ];
    const sabadellObra = { abonado_eur: Math.round(abonos.reduce((t, x) => t + (x.importe || 0), 0) * 100) / 100, abonos,
                           entregado_emasesa_eur: Math.round(claves.reduce((t, k) => t + (entregas.get(k) || 0), 0) * 100) / 100 };
    // fila de la comunidad (contrato y pago comunitarios, si contrata)
    const estC = docsCcpp.map((d) => String(c[`est_${d.codigo}`] ?? "").trim());
    const ccC = String(c.est_ccpp_contrato || "").trim().toUpperCase(), ccP = String(c.est_ccpp_pago || "").trim();
    const ccpp = { aplica: !(IGNORA.has(ccC) && IGNORA.has(ccP.toUpperCase())), contrato: IGNORA.has(ccC) ? null : ccC === "OK", pago: tipoPago(ccP) };
    // comunidad financiada: abonada si hay fila de tipo «comunidad» en financiaciones_sabadell
    if (ccpp.pago.tipo === "financiado") {
      ccpp.abonado = abonoCom.length > 0;
      ccpp.importe_abono = abonoCom.length ? Math.round(abonoCom.reduce((t, x) => t + (x.importe || 0), 0) * 100) / 100 : null;
      ccpp.fecha_abono = abonoCom.map((x) => x.fecha).filter(Boolean).sort()[0] || null;
    }
    // «Faltan N de M» con la regla de la ficha (fila de la comunidad + pisos, docs según la fase)
    // Mismo contador y mismos datos que el panel de Guillermo (presupuestos._contarFaltanBot):
    // los pisos cuya «comunidad» es la dirección (o, sin ella, el nombre), con los campos del bot
    let doc = null;
    if (contarFaltan && (docsPiso.length || docsCcpp.length)) {
      const clave = dir || nombre, kp = normPanel(clave);
      const pisosPanel = Pz.filas.filter((p) => normPanel(p.comunidad) === kp).map((p) => ({
        vivienda: String(p.vivienda || "").trim(), estados: docsPiso.map((d) => String(p[`est_${d.codigo}`] ?? "").trim()),
        bot_piso_activo: String(p.bot_piso_activo || "").trim(), piso_tipo: String(p.piso_tipo || "").trim(), acordeon: String(p.acordeon || "").trim() }));
      const r = contarFaltan(estC, docsCcpp, pisosPanel, docsPiso, fase, clave);
      doc = { faltan: r.pend, total: r.totalFilas };
    }
    // terminada: la OT en fase 14 o más; facturada: con fecha de factura o de cobro (panel de Guillermo)
    const fot = faseOT.get(norm(nombre)) || faseOT.get(norm(dir)) || "";
    const facturada = !!(String(c.fecha_cobro || "").trim() || String(c.fecha_pte_cobro || "").trim());
    out[id] = {
      ccpp_id: id, comunidad: nombre || dir, direccion: dir, fase, fase_ot: fot || null,
      terminada: (Number(fot.slice(0, 2)) || 0) >= 14 || facturada, facturada,
      pisos: veces.size, cuadre,
      contratos: { ok: conContrato.filter((p) => p.contrato).length, total: conContrato.length, faltan: conContrato.filter((p) => !p.contrato).map((p) => p.vivienda) },
      pagos: { resueltos: conPago.filter((p) => p.pago.tipo !== "pendiente").length, total: conPago.length,
               pagados: conPago.filter((p) => p.pago.tipo === "pagado" && !esFinanciado(p)).length, financiados, faltan: conPago.filter((p) => p.pago.tipo === "pendiente").map((p) => p.vivienda) },
      ccpp, documentacion: doc, sabadell: sabadellObra,
    };
  }
  return out;
}

// config_dinero «ccpp_alias» (lib/ccpp-alias.cjs): la fila de la comunidad duplicada pasa al id
// bueno (el de la cartera). Si el bueno ya tiene pisos o datos de la comunidad, se queda el bueno.
function aplicarAliasExpedientes(obras, alias) {
  if (!obras || !alias) return obras;
  for (const [dup, bueno] of Object.entries(alias)) {
    if (!obras[dup]) continue;
    if (!obras[bueno] || (!(obras[bueno].pisos > 0) && !obras[bueno].ccpp?.aplica)) obras[bueno] = { ...obras[dup], ccpp_id: bueno, ccpp_id_original: dup };
    delete obras[dup];
  }
  return obras;
}

module.exports = { estadosExpedientes, aplicarAliasExpedientes, tipoPago, norm };
