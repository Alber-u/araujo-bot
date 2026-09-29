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
  return { num };
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
  const sale = (fecha, importe, concepto, tipo, extra = {}) => {
    const s = cubo(fecha);
    if (s && importe > 0) s.salidas.push({ fecha, importe: r2(importe), concepto, tipo, ...extra });
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
  {
    const dia = num("nomina_dia_pago");
    const neta = num("nomina_neta_mensual");
    const fechaPago = (m) => (dia ? diaDelMes(m, dia) : finDeMes(m));
    if (!dia) notas.push("Sin nomina_dia_pago en config_dinero: las nóminas se ponen el último día del mes.");
    const d7 = lineaD("D7");
    if (d7?.importe > 0) sale(fechaPago(mes), d7.importe, `Nóminas de ${mes}`, "nomina");
    else if (d7?.importe == null) fuentesFaltan.push("nóminas");
    for (let k = 1; k <= 2; k++) {
      const m = mesSig(mes, k);
      if (neta != null) sale(fechaPago(m), neta, `Nóminas de ${m}`, "nomina", { estimado: true });
    }
  }

  // Seguridad Social: recibo de cotizaciones el último día hábil de cada mes
  {
    const tg = f.banco?.ok ? cargosTGSS(f.banco.data || []) : null;
    const ult = tg?.cotizaciones?.[0];
    if (ult) {
      const vencidoPagado = tg.cotizaciones.some((c) => mesVtoCotizacion(c) === mes);
      if (!vencidoPagado) sale(ultimoHabil(mes), ult.salida, `Seguros sociales (recibo que vence en ${mes})`, "ss", { estimado: true });
      for (let k = 1; k <= 2; k++) sale(ultimoHabil(mesSig(mes, k)), ult.salida, `Seguros sociales (recibo que vence en ${mesSig(mes, k)})`, "ss", { estimado: true });
    } else fuentesFaltan.push("Seguridad Social");
  }

  // AEAT: plazos de aplazamientos y autoliquidaciones del día 20 (de /obligaciones)
  if (f.obligaciones?.ok) {
    for (const p of f.obligaciones.data?.proximos || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha || ""))) continue;   // «fin de mes» = TGSS, va aparte
      sale(p.fecha, Number(p.importe) || 0, p.que || "Hacienda", "aeat", { estimado: !!p.estimado });
    }
  } else fuentesFaltan.push("Hacienda");

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
    for (const d of f.invoices.data || []) {
      const pdte = Number(d.pdte_cobro_eur) || 0;
      if (pdte <= 0.01 || !d.fecha || d.fecha < corte) continue;
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
  return {
    inicial,
    semanas,
    minimo: peor ? { saldo: peor.saldo, semana: peor.n, desde: peor.desde, hasta: peor.hasta } : null,
    completo: inicial != null && fuentesFaltan.length === 0,
    faltan: fuentesFaltan,
    notas: [...notas, "Los cobros son facturas emitidas con IVA (dinero que entra al banco); no incluyen obra sin facturar."],
  };
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

  // Causa de disolución
  const pat = cli?.patrimonio;
  if (pat && pat.en_causa_disolucion != null) {
    if (pat.en_causa_disolucion) senales.push({ nivel: "rojo", texto: `Causa de disolución: patrimonio neto ${r2(pat.ajustado)} € por debajo de la mitad del capital (${r2(pat.umbral_disolucion)} €).`, fuente: "/holded/patrimonio" });
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
      senales.push({ nivel: "rojo", texto: `No consta cargado el recibo de la Seguridad Social que vencía en ${mesAnt}.`, fuente: "banco (TGSS)" });
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
    for (const d of [...esc.tengo, ...esc.debo].filter((l) => l.id === "T5" || l.id === "D10").flatMap((l) => l.detalle || [])) {
      if ((d.avisos || []).includes("sin calendario de devolución")) {
        senales.push({ nivel: "ambar", texto: `Préstamo ${d.concepto}: sin calendario de devolución${/contrato/i.test(d.nota || "") ? " ni contrato" : ""}.`, fuente: "hoja prestamos" });
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
  return {
    prevision_semanal: previsionSemanal(f, esc, hoy),
    alerta_patrimonial: alertaPatrimonial(f, esc, hoy),
    umbral_mio_hoy: umbralMioHoy(f, esc),
  };
}

module.exports = { calcularPanel, previsionSemanal, alertaPatrimonial, umbralMioHoy, ultimoHabil };
