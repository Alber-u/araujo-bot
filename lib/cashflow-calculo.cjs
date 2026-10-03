// ============================================================
// lib/cashflow-calculo.cjs — Mi panel › Cashflow (encargo del 03/10/2026)
// ============================================================
// «De cash flow cómo vamos no veo un esquema claro» (Alberto). Aquí no hay
// medias: solo pagos y cobros CONCRETOS que ya se conocen (facturas, plazos,
// cuotas, nóminas, recibos…) y recurrentes con su fecha. Cada movimiento
// lleva su fila, su fuente y su fiabilidad, para que la tabla de 13 semanas
// enseñe de dónde sale cada importe.
//
// Lo mismo alimenta la tarjeta 2 de Empresa (las 4 primeras semanas), así que
// las dos dicen siempre lo mismo.
//
// Después de las 13 semanas (hasta julio de 2027) se dan solo los movimientos
// PUNTUALES por mes (plazos, cuotas, impuestos, IS 2026, facturas y obra con
// fecha): la operativa (obras nuevas, nóminas, material, fijos) la pone el
// simulador del front, con sus mandos.
//
// Cálculo PURO. Regla de oro: lo que falta sale «sin dato», nunca 0.
// ============================================================
"use strict";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sumarDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const mesSig = (mes, n = 1) => { const [y, m] = mes.split("-").map(Number); const i = m - 1 + n; return `${y + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const finDeMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const diaDelMes = (mes, dia) => `${mes}-${String(Math.min(Math.max(1, dia), Number(finDeMes(mes).slice(8, 10)))).padStart(2, "0")}`;
function ultimoHabil(mes) {
  let d = new Date(finDeMes(mes) + "T00:00:00Z");
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - 86400000);
  return d.toISOString().slice(0, 10);
}
const lunes = (iso) => { const d = new Date(iso + "T00:00:00Z"); const w = (d.getUTCDay() + 6) % 7; return sumarDias(iso, -w); };
const fmtDM = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
// «2341.93», «2.341,93» y «2341,93» → 2341.93
const parseNum = (v) => {
  if (v == null || String(v).trim() === "") return null;
  if (typeof v === "number") return v;
  const t = String(v).trim().replace(/\s|€/g, "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

const SEMANAS = 13;
// Hasta dónde se generan movimientos: el simulador corta en el mes del último
// cobro de la cartera (mínimo julio de 2027, por el IS de 2026).
const FIN_TRAMO_LARGO = "2028-12";
const DIAS_MAS_90 = 90;
const DIAS_SIN_VTO = 60;                      // factura/compra sin vencimiento: fecha + 60 días (🟡)
const COLCHON_DEF = 10000;
const TIPO_IS_DEF = 0.25;
const IS_FECHA_DEF = "2027-07-25";
const RE_EMASESA = /emasesa/i;

// Regla de cobro (Alberto, 03/10): obra terminada → se cobra 2 meses después,
// en el siguiente día 5 o 20 (remesas de EMASESA). 28/09 → 28/11 → 05/12.
function fechaCobroObra(finIso) {
  const [y, m, d] = finIso.split("-").map(Number);
  const mas2 = mesSig(`${y}-${String(m).padStart(2, "0")}`, 2);
  const dia = Math.min(d, Number(finDeMes(mas2).slice(8, 10)));
  if (dia <= 5) return `${mas2}-05`;
  if (dia <= 20) return `${mas2}-20`;
  return `${mesSig(mas2, 1)}-05`;
}

// Filas de la tabla, en orden, con su lado y su fiabilidad por defecto.
const FILAS = [
  { id: "cobros_facturas", lado: "entra", titulo: "Cobros de facturas emitidas" },
  { id: "remesas_emasesa", lado: "entra", titulo: "Remesas EMASESA" },
  { id: "obra_terminada", lado: "entra", titulo: "Obra terminada sin facturar (2 meses + día 5/20)" },
  { id: "prestamos_entran", lado: "entra", titulo: "Préstamos que entran / te devuelven" },
  { id: "custodia_entra", lado: "custodia", titulo: "Dinero de vecinos (custodia)" },
  { id: "nominas", lado: "sale", titulo: "Nóminas" },
  { id: "seguridad_social", lado: "sale", titulo: "Seguridad Social" },
  { id: "hacienda_plazos", lado: "sale", titulo: "Hacienda: plazos del aplazamiento" },
  { id: "impuestos_trimestrales", lado: "sale", titulo: "IVA / IRPF / IS trimestral (303, 111, 202)" },
  { id: "is_2026", lado: "sale", titulo: "IS 2026" },
  { id: "prestamos_cuotas", lado: "sale", titulo: "Préstamos (cuotas)" },
  { id: "proveedores", lado: "sale", titulo: "Proveedores" },
  { id: "comision", lado: "sale", titulo: "Comisión comercial (20 % al cobro)" },
  { id: "gastos_fijos", lado: "sale", titulo: "Gastos fijos (media 3 meses)" },
  { id: "custodia_sale", lado: "custodia", titulo: "Pago a custodias / material de obras de vecinos" },
];
// Recurrentes: en el tramo largo los sustituye el simulador (fijos y obra)
const RECURRENTES = new Set(["nominas", "seguridad_social", "gastos_fijos"]);

function config(f) {
  const cfg = {};
  if (f.config?.ok) for (const r of f.config.data || []) { const k = String(r.clave || "").trim().toLowerCase(); if (k) cfg[k] = r.valor; }
  return { cfg, num: (k) => parseNum(cfg[k]), txt: (k) => (cfg[k] == null ? null : String(cfg[k]).trim() || null) };
}
// «2026-10-05:38196; 2026-11-05:20000»  →  [{ fecha, importe, concepto }]
function listaFechada(txt, conceptoDef) {
  return String(txt || "").split(/[;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const [fecha, imp, ...resto] = x.split(":");
    const n = parseNum(imp);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha).trim()) && n != null ? { fecha: fecha.trim(), importe: n, concepto: resto.join(":").trim() || conceptoDef } : null;
  }).filter(Boolean);
}

// IS de 2026: config_dinero (is_2026_estimado, is_2026_fecha) o, mientras
// Eplus no lo cierre, 25 % del beneficio acumulado del año (posicion-neta-real).
function is2026(cfgf, beneficioAnual) {
  const fecha = cfgf.txt("is_2026_fecha") || IS_FECHA_DEF;
  const manual = cfgf.num("is_2026_estimado");
  if (manual != null) return { importe: r2(manual), fecha, fiabilidad: "estimado", fuente: "config_dinero (is_2026_estimado)", nota: "Importe de Eplus." };
  if (beneficioAnual?.ok && beneficioAnual.data?.acumulado != null) {
    const b = Number(beneficioAnual.data.acumulado);
    return { importe: r2(Math.max(0, b) * TIPO_IS_DEF), fecha, fiabilidad: "estimado", fuente: `25 % del beneficio acumulado de ${beneficioAnual.data.año || 2026} (posicion-neta-real: ${r2(b)} € en ${beneficioAnual.data.meses} meses)`, nota: "Estimación hasta que Eplus cierre." };
  }
  return { importe: null, fecha, fiabilidad: "sin_dato", fuente: "posicion-neta-real", nota: beneficioAnual?.error || "Sin beneficio del año ni is_2026_estimado en config_dinero." };
}

// Movimientos previstos desde hoy hasta `hasta` (fin de julio de 2027).
// esc = escalera en la vista elegida (real si hay foto fresca); conc = ajuste
// de conciliación (lo ya casado no se vuelve a contar).
// extra: { is2026, gastosFijosMes, finObras: { ccpp_id → fecha fin } }
function movimientosPrevistos(f, esc, hoy, conc = null, extra = {}) {
  const { num, txt } = config(f);
  const hasta = finDeMes(FIN_TRAMO_LARGO);
  const movs = [], notas = [], sinDato = new Set();
  const det = (conc?.detalle || []).filter((d) => d.linea && d.ref);
  const ya = {
    compras: new Set(det.flatMap((d) => d.ref.compras || [])),
    facturas: new Set(det.flatMap((d) => d.ref.facturas || [])),
    plazos: new Set(det.filter((d) => d.ref.plazo).map((d) => `${d.ref.plazo.fecha}|${Number(d.ref.plazo.importe).toFixed(2)}`)),
    tgss: det.some((d) => d.ref.tgss),
  };
  const L = (id) => [...(esc.tengo || []), ...(esc.debo || [])].find((l) => l.id === id);
  const add = (fila, fecha, importe, concepto, fuente, fiabilidad = "exacto", x = {}) => {
    if (!(Math.abs(importe) > 0.005) || !fecha || fecha > hasta) return;
    movs.push({ fila, fecha: fecha < hoy ? hoy : fecha, fecha_original: fecha, importe: r2(Math.abs(importe)), concepto, fuente, fiabilidad, vencido: fecha < hoy, ...x });
  };

  // ── Cobros de facturas (las de +90 días, aparte: «dudosas») ──
  const remesas = listaFechada(txt("remesas_emasesa"), "Remesa EMASESA");
  const dudosas = [];
  if (f.invoices?.ok) {
    const corte = sumarDias(hoy, -DIAS_MAS_90);
    const yaCobradas = new Set((esc.cobros_en_banco || []).map((c) => c.id));
    for (const d of f.invoices.data || []) {
      const pdte = Number(d.pdte_cobro_eur) || 0;
      if (pdte <= 0.01 || yaCobradas.has(d.id) || ya.facturas.has(d.numero)) continue;
      const esEmasesa = RE_EMASESA.test(d.cliente || "");
      if (esEmasesa && remesas.length) continue;              // las cobra la remesa del calendario
      if (d.fecha && d.fecha < corte) { dudosas.push({ fecha: d.fecha, importe: r2(pdte), concepto: `${d.numero} · ${d.cliente}` }); continue; }
      const vto = d.fecha_vto || (d.fecha ? sumarDias(d.fecha, DIAS_SIN_VTO) : null);
      if (!vto) continue;
      add(esEmasesa ? "remesas_emasesa" : "cobros_facturas", vto, pdte, `${d.numero} · ${d.cliente}`,
        d.fecha_vto ? "Factura emitida pendiente (vencimiento)" : `Factura sin vencimiento: fecha + ${DIAS_SIN_VTO} días`,
        d.fecha_vto ? "exacto" : "estimado", { entra: true });
    }
  } else sinDato.add("cobros_facturas");
  for (const r of remesas) add("remesas_emasesa", r.fecha, r.importe, r.concepto, "config_dinero (remesas_emasesa)", "exacto", { entra: true });

  // ── Obra terminada sin facturar (T4): regla 2 meses + día 5/20 ──
  const t4 = L("T4");
  const fechaCobroCcpp = {};
  if (t4 && t4.importe != null) {
    for (const o of t4.detalle || []) {
      if (!(o.importe > 0) || !/^1[4-7]_/.test(o.fase || "")) continue;      // terminadas (14-17)
      const fin = extra.finObras?.[o.ccpp_id] || null;
      const cobro = fechaCobroObra(fin || hoy);
      fechaCobroCcpp[o.ccpp_id] = cobro;
      add("obra_terminada", cobro, o.importe, `${o.concepto} (fase ${String(o.fase).slice(0, 2)})`,
        `T4 sin IVA · terminada ${fin ? fmtDM(fin) : "sin fecha (se toma hoy)"} → cobro ${fmtDM(cobro)}`, fin ? "estimado" : "estimado", { entra: true });
    }
  } else sinDato.add("obra_terminada");
  // Facturas ya emitidas de obras Plan 5: la comisión va a su cobro
  for (const o of t4?.detalle || []) for (const fa of o.facturas || []) {
    if (fechaCobroCcpp[o.ccpp_id]) continue;
    const inv = (f.invoices?.ok ? f.invoices.data : []).find((d) => d.numero === fa.numero);
    if (inv && Number(inv.pdte_cobro_eur) > 0.01) fechaCobroCcpp[o.ccpp_id] = inv.fecha_vto || sumarDias(inv.fecha || hoy, DIAS_SIN_VTO);
  }

  // ── Préstamos (hoja prestamos): cuotas que pagamos y que nos pagan ──
  if (esc.prestamos) {
    for (const c of esc.prestamos.calendario || []) {
      if (c.tipo === "recibido") add("prestamos_cuotas", c.fecha, c.importe, `Cuota préstamo ${c.contraparte || c.id}`, "Hoja prestamos");
      else add("prestamos_entran", c.fecha, c.importe, `Cuota préstamo ${c.contraparte || c.id}`, "Hoja prestamos", "exacto", { entra: true });
    }
  } else { sinDato.add("prestamos_cuotas"); sinDato.add("prestamos_entran"); }

  // ── Nóminas: lo pendiente (D7) y la nómina neta de cada mes en su día ──
  {
    const dia = num("nomina_dia_pago"), neta = num("nomina_neta_mensual");
    const fechaPago = (m) => (!dia ? finDeMes(m) : dia >= 25 ? diaDelMes(m, dia) : diaDelMes(mesSig(m), dia));
    const d7 = L("D7"), mes = hoy.slice(0, 7);
    const per = d7?.periodo || mes;
    if (d7?.sin_devengar) { if (neta != null) add("nominas", fechaPago(mes), neta, `Nóminas ${mes}`, "config_dinero (nomina_neta_mensual)", "estimado"); }
    else if (d7?.importe > 0) add("nominas", fechaPago(per), d7.importe, `Nóminas ${per} pendientes`, "Escalera D7");
    else if (d7?.importe == null) sinDato.add("nominas");
    if (neta == null) sinDato.add("nominas");
    else for (let k = 1; k <= 40; k++) { const m = mesSig(per, k); if (m > FIN_TRAMO_LARGO) break; add("nominas", fechaPago(m), neta, `Nóminas ${m}`, "config_dinero (nomina_neta_mensual)", "estimado"); }
  }

  // ── Seguridad Social: último recibo, último día hábil de cada mes ──
  {
    const d8 = L("D8"), ult = d8?.detalle?.find((x) => /Último recibo/.test(x.concepto || ""))?.importe ?? null;
    const recibo = ult != null ? Number(ult) : null;
    const mes = hoy.slice(0, 7);
    if (recibo == null) sinDato.add("seguridad_social");
    else {
      if (d8.importe > 0 && !ya.tgss) add("seguridad_social", ultimoHabil(mes), recibo, `Recibo TGSS que vence en ${mes}`, "Último recibo TGSS del banco", "estimado");
      for (let k = 1; k <= 40; k++) { const m = mesSig(mes, k); if (m > FIN_TRAMO_LARGO) break; add("seguridad_social", ultimoHabil(m), recibo, `Recibo TGSS que vence en ${m}`, "Último recibo TGSS del banco", "estimado"); }
    }
  }

  // ── Hacienda: plazos del aplazamiento (obligaciones) ──
  if (f.obligaciones?.ok) {
    for (const e of f.obligaciones.data?.expedientes || []) for (const p of e.plazos || []) {
      if (p.estado !== "pendiente" || ya.plazos.has(`${p.fecha}|${Number(p.importe).toFixed(2)}`)) continue;
      add("hacienda_plazos", p.fecha, Number(p.importe), `Plazo ${e.concepto}`, "/obligaciones (calendario AEAT)");
    }
  } else sinDato.add("hacienda_plazos");

  // ── IVA / IRPF / 202 trimestrales, el día 20 (con las cifras de la escalera) ──
  {
    const d4 = L("D4")?.importe, d9 = L("D9")?.importe, is202 = num("is_202_trimestral");
    const irpfRef = num("irpf_111_trimestral") ?? d9;
    let primero = true;
    for (let k = 0; k <= 40; k++) {
      const m = mesSig(hoy.slice(0, 7), k);
      if (m > FIN_TRAMO_LARGO) break;
      const mm = Number(m.slice(5, 7)), dia20 = `${m}-20`;
      if (dia20 < hoy) continue;
      if ([1, 4, 7, 10].includes(mm)) {
        if (d4 == null) sinDato.add("impuestos_trimestrales");
        else add("impuestos_trimestrales", dia20, d4, `IVA 303 (${primero ? "trimestre en curso" : "estimado como el último"})`, "Escalera D4", "estimado");
        const irpf = primero ? d9 : irpfRef;
        if (irpf == null) sinDato.add("impuestos_trimestrales");
        else add("impuestos_trimestrales", dia20, irpf, "IRPF 111", primero ? "Escalera D9" : "irpf_111_trimestral / D9", "estimado");
        primero = false;
      }
      if (is202 != null && [4, 10, 12].includes(mm)) add("impuestos_trimestrales", dia20, is202, "Pago fraccionado IS 202", "config_dinero (is_202_trimestral)", "estimado");
    }
    if (is202 == null) notas.push("Sin pagos fraccionados del IS (202): poner is_202_trimestral en config_dinero si los hay.");
  }

  // ── IS 2026 ──
  const is = extra.is2026 || { importe: null, fecha: IS_FECHA_DEF, fiabilidad: "sin_dato" };
  if (is.importe == null) sinDato.add("is_2026");
  else add("is_2026", is.fecha, is.importe, "Impuesto de Sociedades 2026", is.fuente, "estimado", { nota: is.nota });

  // ── Proveedores: compras pendientes por vencimiento; calendario a mano ──
  {
    const programados = listaFechada(txt("pagos_programados"), "Pago programado");
    const nombresProg = programados.map((p) => p.concepto.toLowerCase()).filter((x) => x.length >= 4);
    for (const p of programados) add("proveedores", p.fecha, p.importe, p.concepto, "config_dinero (pagos_programados)");
    if (f.compras?.ok) {
      const aMano = new Set(String(txt("compras_pagadas_pleo") || "").split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean));
      let sinFecha = 0;
      for (const c of f.compras.data?.facturas || []) {
        const imp = Number(c.pendiente) || 0;
        if (imp <= 0 || c.pagada_con_pleo || aMano.has(String(c.num || "").toUpperCase()) || ya.compras.has(c.num)) continue;
        if (nombresProg.some((n) => String(c.proveedor || "").toLowerCase().includes(n))) continue;   // va por su calendario
        const vto = c.fecha_vto || (c.fecha ? sumarDias(c.fecha, DIAS_SIN_VTO) : null);
        if (!vto) { sinFecha++; continue; }
        add("proveedores", vto, imp, `${c.proveedor || "Proveedor"} ${c.num || ""}`.trim(),
          c.fecha_vto ? "Compra pendiente (vencimiento)" : `Compra sin vencimiento: fecha + ${DIAS_SIN_VTO} días`, c.fecha_vto ? "exacto" : "estimado");
      }
      if (sinFecha) notas.push(`${sinFecha} compra(s) de proveedor sin vencimiento ni fecha: no se reparten por semanas.`);
    } else sinDato.add("proveedores");
  }

  // ── Pago anual recurrente (seguros de vehículos): config_dinero ──
  {
    const imp = num("seguro_anual_importe"), m = num("seguro_anual_mes"), dia = num("seguro_anual_dia") || 1;
    if (imp > 0 && m >= 1 && m <= 12) {
      const y = Number(hoy.slice(0, 4));
      for (const yy of [y, y + 1]) {
        const fecha = diaDelMes(`${yy}-${String(m).padStart(2, "0")}`, dia);
        if (fecha >= hoy) add("proveedores", fecha, imp, txt("seguro_anual_concepto") || "Seguros anuales (vehículos)", "config_dinero (seguro_anual_*)", "estimado", { tipo: "seguro" });
      }
    } else notas.push("Sin seguro anual en config_dinero (seguro_anual_importe y seguro_anual_mes).");
  }

  // ── Comisión comercial: al cobro de cada obra (D14) ──
  {
    const d14 = L("D14");
    if (d14?.importe == null) sinDato.add("comision");
    for (const o of d14?.detalle || []) {
      if (!(o.importe > 0)) continue;
      const fecha = fechaCobroCcpp[o.ccpp_id];
      if (fecha) add("comision", fecha, o.importe, `${o.concepto}`, "D14 (20 % del beneficio real), al cobro de la obra", "estimado");
      else notas.push(`Comisión de ${o.concepto} (${r2(o.importe)} €) sin fecha: la obra aún no tiene cobro previsto.`);
    }
  }

  // ── Gastos fijos: media de los últimos 3 meses, el día 15 de cada mes ──
  if (extra.gastosFijosMes == null) sinDato.add("gastos_fijos");
  else for (let k = 0; k <= 40; k++) {
    const m = mesSig(hoy.slice(0, 7), k);
    if (m > FIN_TRAMO_LARGO) break;
    if (`${m}-15` < hoy) continue;                     // los de meses pasados ya se pagaron
    add("gastos_fijos", `${m}-15`, extra.gastosFijosMes, `Gastos fijos ${m}`, "Media de costes generales de los 3 últimos meses (posicion-neta-real)", "estimado");
  }

  // Custodia: no hay previsión de cobros de vecinos ni de pagos a la custodia
  sinDato.add("custodia_entra"); sinDato.add("custodia_sale");

  movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { movs, dudosas, notas, sin_dato: [...sinDato] };
}

// Tabla de 13 semanas (lunes-domingo) + meses hasta julio de 2027.
function calcularCashflow(f, esc, hoy, conc = null, extra = {}) {
  const { num } = config(f);
  const colchon = num("colchon_caja") ?? COLCHON_DEF;
  const L = (id) => [...(esc.tengo || []), ...(esc.debo || [])].find((l) => l.id === id);
  const banco = L("T1")?.importe, pleo = L("T2")?.importe, custodia = L("D1")?.importe, senales = L("D2")?.importe;
  const inicialBanco = banco == null || pleo == null ? null : r2(banco + pleo);
  const apartado = custodia == null || senales == null ? null : r2(custodia + senales);
  const propioHoy = inicialBanco == null || apartado == null ? null : r2(inicialBanco - apartado);
  const { movs, dudosas, notas, sin_dato } = movimientosPrevistos(f, esc, hoy, conc, extra);

  // Semanas
  const l0 = lunes(hoy);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => ({ n: i + 1, desde: sumarDias(l0, i * 7), hasta: sumarDias(l0, i * 7 + 6), celdas: {}, movs: [] }));
  const finSemanas = semanas[SEMANAS - 1].hasta;
  for (const m of movs) {
    if (m.fecha > finSemanas) continue;
    const s = semanas.find((x) => m.fecha >= x.desde && m.fecha <= x.hasta) || semanas[0];
    s.movs.push(m);
    s.celdas[m.fila] = r2((s.celdas[m.fila] || 0) + m.importe);
  }
  let saldo = propioHoy;
  for (const s of semanas) {
    s.inicial = saldo;
    s.entra = r2(s.movs.filter((m) => m.entra).reduce((t, m) => t + m.importe, 0));
    s.sale = r2(s.movs.filter((m) => !m.entra).reduce((t, m) => t + m.importe, 0));
    saldo = saldo == null ? null : r2(saldo + s.entra - s.sale);
    s.saldo_propio = saldo;
    s.saldo_con_custodia = saldo == null || apartado == null ? null : r2(saldo + apartado);
    s.estado = saldo == null ? "sin_dato" : saldo < 0 ? "rojo" : saldo < colchon ? "ambar" : "verde";
  }
  const peor13 = propioHoy == null ? null : semanas.reduce((m, s) => (s.saldo_propio < m.saldo_propio ? s : m), semanas[0]);

  // Meses después de las 13 semanas: solo puntuales (los recurrentes los pone el simulador)
  const meses = [];
  for (let m = finSemanas.slice(0, 7); m <= FIN_TRAMO_LARGO; m = mesSig(m)) {
    const ms = movs.filter((x) => x.fecha > finSemanas && x.fecha.slice(0, 7) === m && !RECURRENTES.has(x.fila));
    meses.push({
      mes: m,
      entra: r2(ms.filter((x) => x.entra).reduce((t, x) => t + x.importe, 0)),
      sale: r2(ms.filter((x) => !x.entra).reduce((t, x) => t + x.importe, 0)),
      movs: ms,
    });
  }
  // Recurrentes después de las 13 semanas, con su fecha real (nóminas el día de
  // pago, TGSS el último día hábil, gastos fijos el 15): la serie mensual del
  // simulador los suma tal cual.
  const recurrentesMovs = movs.filter((x) => x.fecha > finSemanas && RECURRENTES.has(x.fila));
  // Recurrentes por mes (referencia del simulador y del tramo largo sin simulador)
  const recurrentesMes = {};
  for (const id of RECURRENTES) {
    const xs = movs.filter((x) => x.fila === id && x.fecha > finSemanas);
    recurrentesMes[id] = xs.length ? r2(xs.reduce((t, x) => t + x.importe, 0) / new Set(xs.map((x) => x.fecha.slice(0, 7))).size) : null;
  }

  return {
    hoy, colchon,
    inicial: { banco_pleo: inicialBanco, custodia_y_senales: apartado, propio: propioHoy, banco, pleo, custodia, senales },
    filas: FILAS.map((x) => ({ ...x, sin_dato: sin_dato.includes(x.id) })),
    semanas,
    peor_13: peor13 ? { saldo: peor13.saldo_propio, semana: peor13.n, desde: peor13.desde, hasta: peor13.hasta } : null,
    meses,
    recurrentes_mes: recurrentesMes,
    recurrentes_movs: recurrentesMovs,
    dudosas: { total: r2(dudosas.reduce((t, x) => t + x.importe, 0)), facturas: dudosas },
    is_2026: extra.is2026 || null,
    notas: [
      ...notas,
      "Cobros de obra sin IVA (el IVA cobrado vuelve a Hacienda en el 303). Facturas emitidas, con IVA.",
      "La custodia de los vecinos no está en el saldo propio: es del banco, no de ARA.",
    ],
    completo: propioHoy != null && sin_dato.filter((x) => !/^custodia/.test(x)).length === 0,
    sin_dato,
  };
}

// Base del simulador de escenarios (punto 6 del encargo): obras por
// ejecutar (fases 05-09 de la hoja de comunidades, vía posicion-neta-real) y
// el histórico del mes de referencia (horas en obra, material, fijos, desvío
// de horas de las obras ya terminadas). Solo lectura.
function baseSimulador(pnr) {
  if (!pnr?.ok) return { ok: false, error: pnr?.error || "sin posicion-neta-real" };
  const d = pnr.data;
  // las sin presupuesto también: gastan horas aunque no sumen ingresos («sin pto.»)
  const obras = (d.obras || []).filter((o) => /^0[5-9]_/.test(o.fase || "") && (Number(o.importe) > 0 || Number(o.horas_previstas) > 0))
    .map((o) => ({ nombre: o.nombre, fase: o.fase, importe: r2(o.importe), horas_previstas: r2(o.horas_previstas), horas_registradas: r2(o.horas_registradas),
                   estado: Number(o.horas_registradas) > 0 ? "en_curso" : "sin_empezar" }));
  const hechas = (d.obras || []).filter((o) => /^1[4-8]_/.test(o.fase || "") && Number(o.horas_previstas) > 0 && Number(o.horas_registradas) > 0);
  const prev = hechas.reduce((t, o) => t + Number(o.horas_previstas), 0), reales = hechas.reduce((t, o) => t + Number(o.horas_registradas), 0);
  const ingreso = Number(d.ingreso_mes_eur) || 0;
  return {
    ok: true, mes_ref: `${d.año}-${String(d.mes).padStart(2, "0")}`,
    obras,
    historico: {
      horas_mes: r2(d.total_horas_mo),
      desvio_pct: prev > 0 ? Math.round((reales / prev - 1) * 100) : null,
      obras_hechas: { n: hechas.length, importe: r2(hechas.reduce((t, o) => t + Number(o.importe || 0), 0)), horas_previstas: r2(prev), horas_reales: r2(reales) },
      material_pct: ingreso > 0 ? Math.round((Number(d.gastos_materiales_eur) || 0) / ingreso * 100) : null,
      eur_hora_obra: Number(d.total_horas_mo) > 0 ? r2(ingreso / Number(d.total_horas_mo)) : null,
      fijos: { operarios: r2(d.coste_mo_eur), indirectos: r2(d.nomina_indirectos_eur), generales: r2(d.costes_generales_eur) },
      comision_pct: d.comision_comercial_pct ?? 0.2,
    },
  };
}

module.exports = { baseSimulador, calcularCashflow, movimientosPrevistos, fechaCobroObra, is2026, lunes, FILAS, SEMANAS, FIN_TRAMO_LARGO, COLCHON_DEF };
