// ============================================================
// lib/panel-empresa-calculo.cjs — Mi panel › Empresa (sección 9)
// ============================================================
// Cálculo PURO de lo que la escalera no da y las tarjetas sí necesitan:
//   · prevision_semanal  → tarjeta 2 «¿Llego a las próximas 4 semanas?»
//   · alerta_patrimonial → tarjeta 4 «¿Me juego mi patrimonio?»
//   · umbral_mio_hoy     → semáforo de la tarjeta 1 (nóminas + SS del mes)
// Recibe las mismas fuentes que la escalera y el resultado de ésta, para que
// cada cifra salga de un solo sitio. Sin importes ni nombres en el código.
// ============================================================
"use strict";

const { cargosTGSS, mesVtoCotizacion, periodoNomina, sumarDias } = require("./dinero-empresa-calculo.cjs");
const { parseImporte } = require("./prestamos.cjs");

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const SEMANAS = 4;
const DIAS_MAS_90 = 90;
const PLAZO_COBRO_SIN_VTO = 30;   // factura sin vencimiento: se espera a 30 días de su fecha

const fmtDM = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const fmtMes = (mes) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;   // «09/2026»
// «117.312 €» (sin decimales, punto de miles)
const fmtEur = (n) => `${Math.round(Number(n) || 0) < 0 ? "−" : ""}${String(Math.abs(Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
const PAGO_GRANDE = 3000;          // 10.2.4
const HORIZONTE_FUTUROS = 120;     // días para buscar el siguiente pago grande
const HORAS_POR_DIA_CUADRILLA = 16; // como posicion-neta-real: 1 día cuadrilla = 16 h
const mesSig = (mes, n = 1) => {
  const [y, m] = mes.split("-").map(Number);
  const i = (m - 1) + n;
  return `${y + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};
const finDeMes = (mes) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
function ultimoHabil(mes) {
  let d = new Date(finDeMes(mes) + "T00:00:00Z");
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - 86400000);
  return d.toISOString().slice(0, 10);
}
function diaDelMes(mes, dia) {
  const fin = Number(finDeMes(mes).slice(8, 10));
  return `${mes}-${String(Math.min(Math.max(1, dia), fin)).padStart(2, "0")}`;
}

function config(f) {
  const cfg = {};
  if (f.config?.ok) for (const r of f.config.data || []) {
    const k = String(r.clave || "").trim().toLowerCase();
    if (k) cfg[k] = r.valor;
  }
  const num = (k) => (cfg[k] === undefined || String(cfg[k]).trim() === "" ? null : parseImporte(cfg[k]));
  const texto = (k) => (cfg[k] === undefined ? null : String(cfg[k]).trim() || null);
  return { num, texto };
}

// ── tarjeta 2: previsión semanal de caja ──────────────────────
// Saldo de partida = «mío hoy» (bancos + Pleo − custodia − señales).
// Salen: proveedores con vencimiento, nóminas, SS, AEAT, cuotas de préstamos.
// Entran: facturas emitidas pendientes, por su vencimiento, sin las de +90 días.
// NO entran cobros de obra sin facturar: no tienen fecha fiable.
function previsionSemanal(f, esc, hoy) {
  const { num } = config(f);
  const notas = [];
  const fuentesFaltan = [];
  const limite = sumarDias(hoy, SEMANAS * 7 - 1);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => ({
    n: i + 1, desde: sumarDias(hoy, i * 7), hasta: sumarDias(hoy, i * 7 + 6), entradas: [], salidas: [],
  }));
  // Lo vencido y no pagado/cobrado cae en la semana 1
  const cubo = (fecha) => {
    if (!fecha || fecha > limite) return null;
    if (fecha < hoy) return semanas[0];
    const dias = Math.round((new Date(fecha) - new Date(hoy)) / 86400000);
    return semanas[Math.floor(dias / 7)];
  };
  // Pagos posteriores a la semana 4 (hasta HORIZONTE_FUTUROS días): para la
  // línea «siguiente pago grande fuera de la ventana» (10.2.4).
  const futuros = [];
  const horizonte = sumarDias(hoy, HORIZONTE_FUTUROS);
  const sale = (fecha, importe, concepto, tipo, extra = {}) => {
    if (!(importe > 0)) return;
    const s = cubo(fecha);
    if (s) s.salidas.push({ fecha, importe: r2(importe), concepto, tipo, ...extra });
    else if (fecha && fecha > limite && fecha <= horizonte) futuros.push({ fecha, importe: r2(importe), concepto, tipo, ...extra });
  };
  const entra = (fecha, importe, concepto, tipo, extra = {}) => {
    const s = cubo(fecha);
    if (s && importe > 0) s.entradas.push({ fecha, importe: r2(importe), concepto, tipo, ...extra });
  };
  const mes = hoy.slice(0, 7);
  const lineaD = (id) => esc.debo.find((l) => l.id === id);

  // Proveedores con vencimiento (facturas de compra pendientes)
  if (f.compras?.ok) {
    let sinVto = 0;
    for (const c of f.compras.data?.facturas || []) {
      const imp = Number(c.pendiente) || 0;
      if (!c.fecha_vto) { sinVto++; continue; }
      sale(c.fecha_vto, imp, c.proveedor || c.num || "Proveedor", "proveedor", { vencida: !!c.vencida });
    }
    if (sinVto) notas.push(`${sinVto} factura(s) de proveedor sin vencimiento: no se reparten por semanas.`);
  } else fuentesFaltan.push("proveedores");

  // Nóminas: lo pendiente del mes (D7) en el día habitual de pago, y la
  // nómina del mes siguiente si cae dentro de las 4 semanas.
  // nomina_dia_pago: 1-24 = ese día del mes SIGUIENTE (la de agosto se pagó el
  // 03/09); 25-31 = ese día del mismo mes. Sin él, el último día del mes.
  {
    const dia = num("nomina_dia_pago");
    const neta = num("nomina_neta_mensual");
    const fechaPago = (m) => (!dia ? finDeMes(m) : dia >= 25 ? diaDelMes(m, dia) : diaDelMes(mesSig(m), dia));
    if (!dia) notas.push("Sin nomina_dia_pago en config_dinero: las nóminas se ponen el último día del mes.");
    const d7 = lineaD("D7");
    if (d7?.importe > 0) sale(fechaPago(mes), d7.importe, `Nóminas ${fmtMes(mes)}`, "nomina");
    else if (d7?.importe == null) fuentesFaltan.push("nóminas");
    for (let k = 1; k <= 4; k++) {
      const m = mesSig(mes, k);
      if (neta != null) sale(fechaPago(m), neta, `Nóminas ${fmtMes(m)}`, "nomina", { estimado: true });
    }
  }

  // Seguridad Social: recibo de cotizaciones el último día hábil de cada mes
  {
    const tg = f.banco?.ok ? cargosTGSS(f.banco.data || []) : null;
    const ult = tg?.cotizaciones?.[0];
    if (ult) {
      const vencidoPagado = tg.cotizaciones.some((c) => mesVtoCotizacion(c) === mes);
      if (!vencidoPagado) sale(ultimoHabil(mes), ult.salida, `Seguros sociales (recibo que vence en ${fmtMes(mes)})`, "ss", { estimado: true });
      for (let k = 1; k <= 4; k++) sale(ultimoHabil(mesSig(mes, k)), ult.salida, `Seguros sociales (recibo que vence en ${fmtMes(mesSig(mes, k))})`, "ss", { estimado: true });
    } else fuentesFaltan.push("Seguridad Social");
  }

  // AEAT: plazos pendientes de los aplazamientos y autoliquidaciones del día 20
  // (IVA / 111) de /obligaciones. Los mismos datos que su lista «próximos», pero
  // sin cortar a 30 días, para ver también el siguiente pago grande.
  if (f.obligaciones?.ok) {
    const o = f.obligaciones.data || {};
    for (const e of o.expedientes || []) {
      for (const p of e.plazos || []) if (p.estado === "pendiente") sale(p.fecha, Number(p.importe) || 0, `Plazo ${e.concepto}`, "aeat");
    }
    for (const p of o.periodicos || []) {
      if (p.vencimiento && p.devengado_trimestre > 0) sale(p.vencimiento, p.devengado_trimestre, `Modelo ${p.modelo} · ${p.concepto} (${p.periodo})`, "aeat", { estimado: true });
    }
  } else fuentesFaltan.push("Hacienda");

  // 10.2.5 · Pago anual recurrente (seguros de vehículos): importe y mes en
  // config_dinero (seguro_anual_importe, seguro_anual_mes, seguro_anual_dia
  // opcional —1 por defecto—, seguro_anual_concepto opcional).
  {
    const imp = num("seguro_anual_importe"), m = num("seguro_anual_mes");
    const dia = num("seguro_anual_dia") || 1;
    if (imp > 0 && m >= 1 && m <= 12) {
      const y = Number(hoy.slice(0, 4));
      let fecha = diaDelMes(`${y}-${String(m).padStart(2, "0")}`, dia);
      if (fecha < hoy) fecha = diaDelMes(`${y + 1}-${String(m).padStart(2, "0")}`, dia);   // ya pasó: el del año que viene
      const concepto = String(config(f).texto("seguro_anual_concepto") || "Seguros anuales (vehículos)");
      sale(fecha, imp, concepto, "seguro", { estimado: true });
    } else notas.push("Sin seguro anual en config_dinero (seguro_anual_importe y seguro_anual_mes).");
  }

  // Cuotas de préstamos recibidos (hoja prestamos)
  if (esc.prestamos) {
    for (const c of esc.prestamos.calendario || []) {
      if (c.tipo === "recibido") sale(c.fecha, c.importe, `Cuota préstamo ${c.contraparte || c.id}`, "prestamo");
      else entra(c.fecha, c.importe, `Cuota préstamo ${c.contraparte || c.id}`, "prestamo");
    }
  } else fuentesFaltan.push("préstamos");

  // Cobros: facturas emitidas pendientes, por vencimiento, sin las de +90 días
  if (f.invoices?.ok) {
    const corte = sumarDias(hoy, -DIAS_MAS_90);
    const yaCobradas = new Set((esc.cobros_en_banco || []).map((c) => c.id));   // 10.2.2: cobradas en banco, sin conciliar
    for (const d of f.invoices.data || []) {
      const pdte = Number(d.pdte_cobro_eur) || 0;
      if (pdte <= 0.01 || !d.fecha || d.fecha < corte || yaCobradas.has(d.id)) continue;
      const vto = d.fecha_vto || sumarDias(d.fecha, PLAZO_COBRO_SIN_VTO);
      entra(vto, pdte, `${d.numero} · ${d.cliente}`, "factura", { vencida: vto < hoy });
    }
  } else fuentesFaltan.push("facturas emitidas");

  const inicial = esc.kpis.mio_hoy;
  let saldo = inicial;
  for (const s of semanas) {
    s.entradas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    s.salidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    s.entra = r2(s.entradas.reduce((t, x) => t + x.importe, 0));
    s.sale = r2(s.salidas.reduce((t, x) => t + x.importe, 0));
    saldo = saldo == null ? null : r2(saldo + s.entra - s.sale);
    s.saldo = saldo;
  }
  const peor = inicial == null ? null : semanas.reduce((m, s) => (s.saldo < m.saldo ? s : m), semanas[0]);
  const hasta30 = sumarDias(hoy, 29);
  const todasSalidas = [...semanas.flatMap((s) => s.salidas), ...futuros];
  const sale30 = r2(todasSalidas.filter((x) => x.fecha <= hasta30).reduce((t, x) => t + x.importe, 0));
  const grande = futuros.filter((x) => x.importe > PAGO_GRANDE).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
  return {
    inicial,
    semanas,
    sale_30_dias: sale30,
    siguiente_pago_grande: grande,
    minimo: peor ? { saldo: peor.saldo, semana: peor.n, desde: peor.desde, hasta: peor.hasta } : null,
    completo: inicial != null && fuentesFaltan.length === 0,
    faltan: fuentesFaltan,
    notas: [...notas, "Los cobros son facturas emitidas con IVA (dinero que entra al banco); no incluyen obra sin facturar."],
  };
}

// ── 10.1 · patrimonio neto: contable hoy y estimado al cierre ──
// pn_contable_hoy = lo de /holded/patrimonio (contabilizado + ajustes).
// pn_cierre_estimado = pn_contable_hoy + obra ejecutada sin facturar (base)
//   + anticipos 438 cobrados sin facturar (/1,10). Sin IS.
// La obra sale de la misma fuente que T4 (órdenes 12-17 sin factura ligada);
// en fase 12-13 solo cuenta lo ejecutado: presupuesto × horas reales /
// horas previstas (tiempo_previsto × 16 h), con tope en el presupuesto.
// La causa de disolución se decide con la estimada al cierre.
function patrimonioCierre(f, esc, hoy) {
  const cli = f.clientes?.ok && f.clientes.data?.ok !== false ? f.clientes.data : null;
  const pat = cli?.patrimonio;
  if (!pat || pat.ajustado == null) return null;
  const fecha = cli.generado || null;
  const contable = r2(pat.ajustado);
  const umbral = r2(pat.umbral_disolucion != null ? pat.umbral_disolucion : (pat.capital_social || 0) / 2);
  const faltan = [];

  // Obra ejecutada sin facturar (base, sin IVA)
  const t4 = esc.tengo.find((l) => l.id === "T4");
  let obra = null;
  const detObra = [];
  if (t4 && t4.importe != null) {
    const previstoPorObra = {};
    for (const [fase, lista] of Object.entries(f.ot?.data?.grupos || {})) for (const o of lista) previstoPorObra[o.ccpp_id] = { tiempo_previsto: Number(o.tiempo_previsto) || 0, fase };
    obra = 0;
    for (const d of t4.detalle || []) {
      const enCurso = /^1[23]_/.test(d.fase || "");
      let importe = d.importe || 0, nota = null;
      if (enCurso && importe > 0) {
        const horasPrev = (previstoPorObra[d.ccpp_id]?.tiempo_previsto || 0) * HORAS_POR_DIA_CUADRILLA;
        const r = f.rentab?.[d.ccpp_id];
        const horasReal = r?.ok ? Number(r.data?.real?.mano_obra_horas) : NaN;
        if (horasPrev > 0 && Number.isFinite(horasReal)) {
          const ejecutado = Math.min(d.presupuesto, d.presupuesto * horasReal / horasPrev);
          importe = r2(Math.max(0, ejecutado - (d.facturado_base || 0)));
          nota = `ejecutado ${Math.round(Math.min(1, horasReal / horasPrev) * 100)} % (${r2(horasReal)} h de ${r2(horasPrev)} h)`;
        } else {
          importe = 0;
          nota = "en curso sin horas previstas o reales: no se cuenta";
          faltan.push(`horas de ${d.concepto}`);
        }
      }
      if (importe > 0 || nota) detObra.push({ concepto: d.concepto, fase: d.fase, importe: r2(importe), nota });
      obra += importe;
    }
    obra = r2(obra);
  } else faltan.push("obra sin facturar");

  // Anticipos 438 cobrados sin facturar, sin IVA (mismo saldo que D5)
  let a438 = null;
  if (cli.saldos_por_cuenta) {
    const s438 = -Object.entries(cli.saldos_por_cuenta).filter(([c]) => c.startsWith("438")).reduce((t, [, v]) => t + (Number(v) || 0), 0);
    a438 = r2(Math.max(0, s438) / 1.10);
  } else faltan.push("anticipos 438");

  const cierre = obra == null || a438 == null ? null : r2(contable + obra + a438);
  const componentes = [
    { concepto: "Contabilizado (capital + resultados acumulados)", importe: r2(pat.contabilizado), fuente: "Holded grupos 6 y 7 + capital (/holded/patrimonio)", fiabilidad: "exacto", fecha_dato: fecha, parte: "contable" },
    ...(pat.ajustes || []).map((a) => ({ concepto: a.concepto, importe: r2(a.importe), fuente: "Ajuste pendiente (/holded/patrimonio)", fiabilidad: "estimado", fecha_dato: fecha, nota: a.nota, parte: "contable" })),
    { concepto: "Obra ejecutada sin facturar (base)", importe: obra, fuente: "ARA-OS órdenes 12-17 (como T4); 12-13 por horas", fiabilidad: obra == null ? "sin_dato" : "estimado", fecha_dato: hoy, detalle: detObra, parte: "cierre" },
    { concepto: "Anticipos cobrados sin facturar (438 / 1,10)", importe: a438, fuente: "Contabilidad 438 (como D5)", fiabilidad: a438 == null ? "sin_dato" : "estimado", fecha_dato: fecha, parte: "cierre" },
    { concepto: "Inmovilizado (grupo 2)", importe: null, fuente: "No existe en Holded", fiabilidad: "sin_dato", fecha_dato: null, nota: "Suma 0.", parte: "cierre" },
  ];

  let nivel, texto;
  if (cierre != null && cierre < umbral) {
    nivel = "rojo";
    texto = `Causa de disolución: aun facturando la obra y los anticipos, el patrimonio quedaría en ≈ ${fmtEur(cierre)}, por debajo de ${fmtEur(umbral)}.`;
  } else if (contable < umbral && cierre != null) {
    nivel = "ambar";
    texto = `Patrimonio contable bajo: falta facturar ${fmtEur(obra)} de obra y ${fmtEur(a438)} de anticipos antes del 31/12. Con ello quedaría en ≈ ${fmtEur(cierre)}.`;
  } else if (contable < umbral) {
    nivel = "ambar";
    texto = `Patrimonio contable bajo (${fmtEur(contable)}) y no se ha podido estimar el cierre: falta ${faltan.join(", ")}.`;
  } else {
    nivel = "verde";
    texto = null;
  }
  return {
    capital_social: pat.capital_social,
    umbral_disolucion: umbral,
    pn_contable_hoy: contable,
    pn_cierre_estimado: cierre,
    obra_sin_facturar: obra,
    anticipos_438_sin_iva: a438,
    componentes,
    en_causa_disolucion: cierre != null ? cierre < umbral : null,
    en_causa_disolucion_contable: contable < umbral,
    nivel,
    texto,
    completo: faltan.length === 0,
    faltan,
    fecha_dato: fecha,
    nota: "Sin Impuesto de Sociedades. La obra sin facturar solo cuenta aquí: en la escalera y en el resto sigue sin facturar.",
  };
}

// 10.1.4 · Aviso de calendario del 1/11 al 31/12 si queda obra o anticipos sin facturar
function avisoCierre(pc, hoy) {
  if (!pc || pc.obra_sin_facturar == null || pc.anticipos_438_sin_iva == null) return null;
  const md = hoy.slice(5);
  if (md < "11-01" || md > "12-31") return null;
  const x = pc.obra_sin_facturar, y = pc.anticipos_438_sin_iva;
  if (!(x + y > 0)) return null;
  const n = Math.round((new Date(`${hoy.slice(0, 4)}-12-31T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86400000);
  return { nivel: "ambar", texto: `Quedan ${n} días para el cierre: ${fmtEur(x)} de obra ejecutada y ${fmtEur(y)} de anticipos sin facturar. Si el ejercicio cierra así, el patrimonio contable queda en ${fmtEur(pc.pn_contable_hoy)}.` };
}

// ── tarjeta 4: alerta patrimonial ─────────────────────────────
// Reutiliza señales que ya existen: causa de disolución (/patrimonio), deudas
// AEAT en ejecutivo o plazos impagados (/obligaciones), recibos de la SS sin
// cargar, nóminas de meses anteriores sin pagar (465) y préstamos sin
// calendario de devolución (hoja prestamos). Si falta una fuente, la alerta
// está incompleta: nunca verde por falta de datos.
function alertaPatrimonial(f, esc, hoy) {
  const senales = [];
  const faltan = [];
  const cli = f.clientes?.ok && f.clientes.data?.ok !== false ? f.clientes.data : null;
  const mes = hoy.slice(0, 7);

  // Causa de disolución (10.1): se decide con el patrimonio estimado al cierre
  const pc = patrimonioCierre(f, esc, hoy);
  if (pc) {
    if (pc.nivel !== "verde") senales.push({ nivel: pc.nivel, texto: pc.texto, fuente: "/holded/patrimonio", tipo: "disolucion", detalle: pc });
    if (!pc.completo && pc.nivel !== "rojo") faltan.push(...pc.faltan);
  } else faltan.push("patrimonio neto");

  // Hacienda
  const obl = f.obligaciones?.ok ? f.obligaciones.data : null;
  if (obl) {
    const ejec = (obl.expedientes || []).filter((e) => e.tipo === "ejecutivo" && e.pendiente > 0);
    if (ejec.length) senales.push({ nivel: "rojo", texto: `${ejec.length} deuda(s) con Hacienda en periodo ejecutivo (${r2(ejec.reduce((s, e) => s + e.pendiente, 0))} €): pueden embargar y cancelar los aplazamientos.`, fuente: "/obligaciones" });
    for (const e of obl.expedientes || []) {
      const imp = (e.plazos || []).filter((p) => p.estado === "impagado");
      const sc = (e.plazos || []).filter((p) => p.estado === "sin_confirmar");
      if (imp.length) senales.push({ nivel: "rojo", texto: `${e.concepto}: ${imp.length} plazo(s) vencido(s) hace más de 45 días sin pago.`, fuente: "/obligaciones" });
      else if (sc.length) senales.push({ nivel: "ambar", texto: `${e.concepto}: ${sc.length} plazo(s) vencido(s) sin cargo contabilizado (puede estar sin conciliar).`, fuente: "/obligaciones" });
    }
  } else faltan.push("Hacienda");

  // Seguridad Social: el recibo que venció el mes pasado tiene que estar cargado
  if (f.banco?.ok) {
    const tg = cargosTGSS(f.banco.data || []);
    const mesAnt = sumarDias(`${mes}-01`, -1).slice(0, 7);
    if (tg.cotizaciones.length && !tg.cotizaciones.some((c) => mesVtoCotizacion(c) === mesAnt)) {
      senales.push({ nivel: "rojo", texto: `No consta cargado el recibo de la Seguridad Social que vencía en ${fmtMes(mesAnt)}.`, fuente: "banco (TGSS)" });
    }
  } else faltan.push("Seguridad Social");

  // Nóminas atrasadas: saldo de la 465 de meses anteriores
  const saldos = cli?.saldos_por_cuenta;
  if (saldos && f.nominas465?.ok) {
    const mesContabilizado = (f.nominas465.data || []).some((a) => periodoNomina(a) === mes);
    const s465 = -Object.entries(saldos).filter(([c]) => c.startsWith("465")).reduce((t, [, v]) => t + (Number(v) || 0), 0);
    if (!mesContabilizado && s465 > 1) senales.push({ nivel: "rojo", texto: `Nóminas de meses anteriores sin pagar: ${r2(s465)} € en la 465.`, fuente: "contabilidad 465" });
  } else faltan.push("nóminas");

  // Préstamos sin calendario de devolución (típicamente, con sociedades del grupo)
  if (f.prestamos?.ok) {
    const filas = (f.prestamos.data || []).filter((r) => String(r.tipo || "").trim());
    for (const l of [...esc.tengo, ...esc.debo].filter((x) => x.id === "T5" || x.id === "D10")) {
      for (const d of l.detalle || []) {
        if (!(d.avisos || []).includes("sin calendario de devolución")) continue;
        const quien = l.id === "T5" ? `concedido a ${d.concepto}` : `recibido de ${d.concepto}`;
        senales.push({ nivel: "ambar", texto: `Préstamo ${quien}: sin calendario de devolución${/contrato/i.test(d.nota || "") ? " ni contrato" : ""}.`, fuente: "hoja prestamos" });
      }
    }
    if (!filas.length) faltan.push("préstamos");
  } else faltan.push("préstamos");

  const rojas = senales.filter((s) => s.nivel === "rojo").length;
  const ambar = senales.filter((s) => s.nivel === "ambar").length;
  return { rojas, ambar, senales, completo: faltan.length === 0, faltan };
}

// ── tarjeta 1: umbral del semáforo (nóminas + SS del mes) ─────
function umbralMioHoy(f, esc) {
  const d7 = esc.debo.find((l) => l.id === "D7")?.importe;
  const tg = f.banco?.ok ? cargosTGSS(f.banco.data || []) : null;
  const ss = tg?.cotizaciones?.[0]?.salida;
  if (d7 == null || ss == null) return null;
  return r2(d7 + ss);
}

function calcularPanel(f, esc, hoy) {
  const pc = patrimonioCierre(f, esc, hoy);
  return {
    prevision_semanal: previsionSemanal(f, esc, hoy),
    alerta_patrimonial: alertaPatrimonial(f, esc, hoy),
    umbral_mio_hoy: umbralMioHoy(f, esc),
    patrimonio_cierre: pc,
    aviso_cierre: avisoCierre(pc, hoy),
  };
}

module.exports = { calcularPanel, previsionSemanal, alertaPatrimonial, umbralMioHoy, ultimoHabil, patrimonioCierre, avisoCierre, fmtEur };
