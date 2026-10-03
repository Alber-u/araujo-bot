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

const { cargosTGSS, mesVtoCotizacion, periodoNomina, sumarDias, reciboTGSSCargado, pagosNominaBanco, mesAnterior, TOLERANCIA_RECIBO } = require("./dinero-empresa-calculo.cjs");
const cashflow = require("./cashflow-calculo.cjs");
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
const EUR_HORA_MANO_OBRA = 30;     // horas previstas = mano_obra_previsto / 30 (regla del negocio)
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
// Lo que la foto de movimientos sin conciliar ya ha casado (vista real):
// compras, facturas, plazos AEAT y recibo de la TGSS que ya salieron o
// entraron en el banco. Sin conc, conjuntos vacíos (vista contable).
function casados(conc) {
  const det = (conc?.detalle || []).filter((d) => d.linea && d.ref);
  return {
    compras: new Set(det.flatMap((d) => d.ref.compras || [])),
    facturas: new Set(det.flatMap((d) => d.ref.facturas || [])),
    plazos: new Set(det.filter((d) => d.ref.plazo).map((d) => `${d.ref.plazo.fecha}|${Number(d.ref.plazo.importe).toFixed(2)}`)),
    tgss: det.some((d) => d.ref.tgss),
    d7: conc?.ajustes?.D7 || 0, d8: conc?.ajustes?.D8 || 0,
  };
}

// Tarjeta 2: las 4 primeras semanas (lunes-domingo) del cash flow de 13
// semanas (lib/cashflow-calculo.cjs). Mismos movimientos, misma cifra: la
// peor semana de la tarjeta 2 es la de la pestaña Cashflow (encargo 03/10).
const FILA_TIPO = { cobros_facturas: "factura", remesas_emasesa: "factura", obra_terminada: "obra", prestamos_entran: "prestamo",
  nominas: "nomina", seguridad_social: "ss", hacienda_plazos: "aeat", impuestos_trimestrales: "aeat", is_2026: "aeat",
  prestamos_cuotas: "prestamo", proveedores: "proveedor", comision: "comision", gastos_fijos: "fijos" };
function previsionSemanal(f, esc, hoy, conc = null, extra = {}) {
  const cf = cashflow.calcularCashflow(f, esc, hoy, conc, extra);
  const aMov = (m) => ({ fecha: m.fecha, importe: m.importe, concepto: m.concepto, tipo: m.tipo || FILA_TIPO[m.fila] || m.fila,
    fila: m.fila, fuente: m.fuente, ...(m.fiabilidad !== "exacto" ? { estimado: true } : {}), ...(m.vencido ? { vencida: true } : {}) });
  const semanas = cf.semanas.slice(0, SEMANAS).map((s) => ({
    n: s.n, desde: s.desde, hasta: s.hasta,
    entradas: s.movs.filter((m) => m.entra).map(aMov), salidas: s.movs.filter((m) => !m.entra).map(aMov),
    entra: s.entra, sale: s.sale, saldo: s.saldo_propio,
  }));
  const inicial = cf.inicial.propio;
  const peor = inicial == null ? null : semanas.reduce((m, s) => (s.saldo < m.saldo ? s : m), semanas[0]);
  const hasta30 = sumarDias(hoy, 29), limite = semanas[semanas.length - 1].hasta;
  const todas = [...cf.semanas.flatMap((s) => s.movs), ...cf.meses.flatMap((m) => m.movs)].filter((m) => !m.entra);
  const futuros = todas.filter((m) => m.fecha > limite && m.fecha <= sumarDias(hoy, HORIZONTE_FUTUROS));
  const grande = futuros.filter((x) => x.importe > PAGO_GRANDE).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
  // El IS 2026 (julio de 2027) no cae en estas 4 semanas: no hace incompleta la tarjeta
  const faltan = cf.sin_dato.filter((x) => !/^custodia/.test(x) && x !== "is_2026");
  return {
    inicial,
    semanas,
    sale_30_dias: r2(todas.filter((x) => x.fecha <= hasta30).reduce((t, x) => t + x.importe, 0)),
    siguiente_pago_grande: grande ? aMov(grande) : null,
    pagos_anuales: todas.filter((x) => x.tipo === "seguro").map(({ fecha, importe, concepto }) => ({ fecha, importe, concepto })),
    minimo: peor ? { saldo: peor.saldo, semana: peor.n, desde: peor.desde, hasta: peor.hasta } : null,
    completo: inicial != null && faltan.length === 0,
    faltan,
    notas: [...cf.notas, "Semanas de lunes a domingo; lo vencido y no pagado cae en la semana 1."],
  };
}

// ── 10.1 · patrimonio neto: contable hoy y estimado al cierre ──
// pn_contable_hoy = lo de /holded/patrimonio (contabilizado + ajustes).
// pn_cierre_estimado = pn_contable_hoy + obra ejecutada sin facturar (base)
//   + anticipos 438 cobrados sin facturar (/1,10). Sin IS.
// La obra sale de la misma fuente que T4 (órdenes 12-17 sin factura ligada);
// en fase 12-13 solo cuenta lo ejecutado: presupuesto × horas reales /
// horas previstas, con tope en el presupuesto. Regla del negocio (Alberto,
// 30/09): horas previstas = mano_obra_previsto / 30 €/h y horas reales =
// real.mano_obra_horas, las dos de /holded/rentabilidad-obra.
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
    obra = 0;
    for (const d of t4.detalle || []) {
      const enCurso = /^1[23]_/.test(d.fase || "");
      let importe = d.importe || 0, nota = null;
      if (enCurso && importe > 0) {
        const r = f.rentab?.[d.ccpp_id];
        const horasPrev = r?.ok ? (Number(r.data?.previsto?.mano_obra_previsto) || 0) / EUR_HORA_MANO_OBRA : 0;
        const horasReal = r?.ok ? Number(r.data?.real?.mano_obra_horas) : NaN;
        if (horasPrev > 0 && Number.isFinite(horasReal)) {
          const ejecutado = Math.min(d.presupuesto, d.presupuesto * horasReal / horasPrev);
          importe = r2(Math.max(0, ejecutado - (d.facturado_base || 0)));
          nota = `ejecutado ${Math.round(Math.min(1, horasReal / horasPrev) * 100)} % (${Math.round(horasReal)} h de ${Math.round(horasPrev)} h)`;
        } else {
          importe = 0;
          nota = "en curso sin mano de obra prevista u horas reales en rentabilidad-obra: no se cuenta";
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
    { concepto: "Obra ejecutada sin facturar (base)", importe: obra, fuente: "ARA-OS órdenes 12-17 (como T4); 12-13 por horas (rentabilidad-obra)", fiabilidad: obra == null ? "sin_dato" : "estimado", fecha_dato: hoy, detalle: detObra, parte: "cierre" },
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
function alertaPatrimonial(f, esc, hoy, conc = null) {
  const ya = casados(conc);
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
      const sc = (e.plazos || []).filter((p) => p.estado === "sin_confirmar" && !ya.plazos.has(`${p.fecha}|${Number(p.importe).toFixed(2)}`));
      if (imp.length) senales.push({ nivel: "rojo", texto: `${e.concepto}: ${imp.length} plazo(s) vencido(s) hace más de 45 días sin pago.`, fuente: "/obligaciones" });
      else if (sc.length) senales.push({ nivel: "ambar", texto: `${e.concepto}: ${sc.length} plazo(s) vencido(s) sin cargo contabilizado (puede estar sin conciliar).`, fuente: "/obligaciones" });
    }
  } else faltan.push("Hacienda");

  // Seguridad Social: el recibo que venció el mes pasado tiene que estar cargado.
  // Antes de pintar rojo se cruza con el banco por concepto y, si no, por
  // importe (± 5 % del último recibo): el 02/10 salía rojo con el de agosto
  // cargado el 30/09.
  if (f.banco?.ok) {
    const tg = cargosTGSS(f.banco.data || []);
    const mesAnt = mesAnterior(mes);
    if (tg.cotizaciones.length) {
      const cargo = reciboTGSSCargado(f.banco.data || [], mesAnt, tg.cotizaciones[0].salida);
      if (!cargo && ya.tgss) senales.push({ nivel: "ambar", texto: `Recibo de la Seguridad Social de ${fmtMes(mesAnt)}: pagado en el banco, falta conciliar en Holded.`, fuente: "banco (foto sin conciliar)" });
      else if (!cargo) senales.push({ nivel: "rojo", texto: `No consta cargado el recibo de la Seguridad Social que vencía en ${fmtMes(mesAnt)}.`, fuente: "banco (TGSS)" });
      else if (cargo.via === "importe") senales.push({ nivel: "ambar", texto: `Recibo de la Seguridad Social de ${fmtMes(mesAnt)}: hay un cargo de ${fmtEur(cargo.salida)} el ${fmtDM(cargo.fecha)} sin el concepto «TGSS COTIZACION». Comprobar que es el recibo.`, fuente: "banco (TGSS)" });
    }
  } else faltan.push("Seguridad Social");

  // Nóminas atrasadas: saldo de la 465 de meses anteriores. Antes de pintar
  // rojo se cruza con las transferencias «NOMINA» del banco desde el día 25
  // del mes anterior: el 02/10 salía rojo con la de septiembre pagada.
  const saldos = cli?.saldos_por_cuenta;
  if (saldos && f.nominas465?.ok) {
    const mesContabilizado = (f.nominas465.data || []).some((a) => periodoNomina(a) === mes);
    const s465 = -Object.entries(saldos).filter(([c]) => c.startsWith("465")).reduce((t, [, v]) => t + (Number(v) || 0), 0);
    if (!mesContabilizado && s465 > 1) {
      const pagos = f.banco?.ok ? pagosNominaBanco(f.banco.data || [], `${mesAnterior(mes)}-25`, hoy) : null;
      if (pagos && pagos.total >= s465 * (1 - TOLERANCIA_RECIBO)) {
        senales.push({ nivel: "ambar", texto: `Nóminas pagadas en el banco (${fmtEur(pagos.total)} hasta el ${fmtDM(pagos.ultimo)}) pero la 465 sigue con ${fmtEur(s465)}: falta conciliar.`, fuente: "contabilidad 465 + banco" });
      } else if (ya.d7 > 0 && s465 - (pagos?.total || 0) - ya.d7 <= 1) {
        senales.push({ nivel: "ambar", texto: `Nóminas pagadas en el banco (${fmtEur(ya.d7)}), falta conciliar en Holded.`, fuente: "banco (foto sin conciliar)" });
      } else {
        const falta = r2(s465 - (pagos?.total || 0) - ya.d7);
        senales.push({ nivel: "rojo", texto: `Nóminas de meses anteriores sin pagar: ${fmtEur(falta)}${pagos?.total ? ` (465: ${fmtEur(s465)}; transferido: ${fmtEur(pagos.total)})` : " en la 465"}.`, fuente: "contabilidad 465 + banco" });
      }
    }
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
// Lo que sale cada mes en personal: la nómina mensual (nomina_neta_mensual;
// sin ella, D7) + el último recibo de la TGSS. No depende de si la nómina de
// este mes ya se ha pagado (D7 puede ser 0 recién pagada).
function umbralMioHoy(f, esc, conc = null) {
  const neta = config(f).num("nomina_neta_mensual");
  const d7 = neta != null ? neta : esc.debo.find((l) => l.id === "D7")?.importe;
  const tg = f.banco?.ok ? cargosTGSS(f.banco.data || []) : null;
  const ss = tg?.cotizaciones?.[0]?.salida;
  if (d7 == null || ss == null) return null;
  // Vista real: sin lo que ya ha salido del banco y está casado en la foto
  const ya = casados(conc);
  return r2(Math.max(0, d7 + ss - ya.d7 - ya.d8));
}

// opciones.conc: ajuste de conciliación (vista real). Sin él, vista contable.
function calcularPanel(f, esc, hoy, opciones = {}) {
  const conc = opciones.conc || null;
  const pc = patrimonioCierre(f, esc, hoy);
  return {
    prevision_semanal: previsionSemanal(f, esc, hoy, conc, opciones.extra || {}),
    alerta_patrimonial: alertaPatrimonial(f, esc, hoy, conc),
    umbral_mio_hoy: umbralMioHoy(f, esc, conc),
    patrimonio_cierre: pc,
    aviso_cierre: avisoCierre(pc, hoy),
  };
}

module.exports = { calcularPanel, previsionSemanal, alertaPatrimonial, umbralMioHoy, ultimoHabil, patrimonioCierre, avisoCierre, fmtEur };
