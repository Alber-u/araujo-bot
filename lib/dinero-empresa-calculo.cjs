// ============================================================
// lib/dinero-empresa-calculo.cjs — la escalera «Dinero de la empresa»
// ============================================================
// Cálculo PURO: recibe lo que ya han devuelto las fuentes (endpoints
// existentes, hojas y apuntes de Holded) y monta las líneas T1-T5 / D1-D12,
// los KPI y los avisos. No llama a nada, así que se prueba con datos fijos
// (lib/dinero-empresa-calculo.test.cjs).
//
// Cada fuente llega como { ok: true, data } o { ok: false, error }.
// Regla de oro: una fuente caída NUNCA se convierte en 0. La línea sale con
// importe null y fiabilidad "sin_dato", y la respuesta lleva completo:false.
// En este archivo no hay importes ni nombres: los parámetros (nómina neta,
// Pleo, póliza) vienen de la hoja `config_dinero`.
// ============================================================
"use strict";

const { resumirPrestamos, contrasteHolded, parseImporte, sumarDias } = require("./prestamos.cjs");

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const IVA_ANTICIPOS = 0.10;                   // 438 × 10/110 (rehabilitación de viviendas)
const FASES_T4 = ["12_INICIO_OBRA", "13_EN_EJECUCION", "14_FINALIZADA", "15_VISITA_INSPECTOR", "16_MONTAJE_CONTADORES", "17_COBRO_EMASESA"];
const FASES_D11 = ["12_INICIO_OBRA", "13_EN_EJECUCION"];
const CUENTA_BANCO = "57200001";      // cuenta corriente principal (la que sincroniza Holded)
const CUENTA_POLIZA = "57200007";
const CUENTA_SENALES = "56000001";
const COBERTURA_FACTURADA = 0.85;             // facturas ligadas ≥ 85 % del presupuesto = obra facturada

// ── utilidades ───────────────────────────────────────────────
function linea(id, concepto, importe, fuente, fiabilidad, fecha_dato, extra = {}) {
  return {
    id, concepto,
    importe: importe == null ? null : r2(importe),
    fuente,
    fiabilidad: importe == null ? "sin_dato" : fiabilidad,
    fecha_dato: fecha_dato || null,
    detalle: [],
    ...extra,
  };
}
const sinDato = (id, concepto, fuente, motivo) =>
  linea(id, concepto, null, fuente, "sin_dato", null, { nota: motivo || "La fuente no ha respondido" });

// «CCPP CL.ESTRELLA 4» y «Estrella 4» → «estrella4»
function normNombre(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/comunidad de propietarios|c\.?\s?c\.?\s?p\.?\s?p\.?|\bccpp\b|\bcdad\b|\bcl\.|\bc\/|\bcalle\b|\bavda\.?|\bavenida\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}
function mismoNombre(a, b) {
  if (!a || !b || a.length < 5 || b.length < 5) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const saldo = (saldos, pref) => r2(Object.entries(saldos || {})
  .filter(([c]) => c.startsWith(pref)).reduce((s, [, v]) => s + (Number(v) || 0), 0));
const hayCuenta = (saldos, pref) => Object.keys(saldos || {}).some((c) => c.startsWith(pref));

function diaLaborableAnterior(iso) {
  let d = new Date(iso + "T00:00:00Z");
  do { d = new Date(d.getTime() - 86400000); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}
const fmtDM = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const fmtEurCorto = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;

// Periodo de IVA aún sin liquidar a fecha `hoy`: el trimestre en curso y,
// hasta el día 20 del mes siguiente al cierre (30 de enero para el 4T), también
// el anterior.
function periodoIvaSinLiquidar(hoy) {
  const [a, m, d] = hoy.split("-").map(Number);
  const t = Math.floor((m - 1) / 3);
  let desdeA = a, desdeT = t;
  const primerMesTrim = m === t * 3 + 1;
  const limite = m === 1 ? 30 : 20;
  if (primerMesTrim && d <= limite) { desdeT = t - 1; if (desdeT < 0) { desdeT = 3; desdeA = a - 1; } }
  return { desde: `${desdeA}-${String(desdeT * 3 + 1).padStart(2, "0")}-01`, hasta: hoy };
}

// ── T4 · obra sin facturar (sin IVA), con cruce de facturas ────
// Solo RESTAN del presupuesto las facturas ligadas de verdad a la obra: por
// número en la hoja (numero_factura_holded) o por etiqueta de obra de Holded.
// Una factura que solo coincide por nombre del contacto NO se resta: se avisa
// (p. ej. «CIUDAD DE CHIVA 7 EXTRAS» es otra obra, de otras obras). Y nunca se
// usa una factura que ya está ligada a una obra de otras obras.
function idsFacturasOO(oo) {
  const ids = new Set();
  for (const o of (oo?.obras || [])) {
    for (const k of ["holded_invoice_emitida_id", "holded_invoice_id"]) {
      const v = String(o[k] || "").trim();
      if (v) ids.add(v);
    }
  }
  return ids;
}

function calcularT4(ot, invoices, tagsPorObra, avisos, idsOO = new Set()) {
  const filas = [];
  for (const fase of FASES_T4) for (const o of (ot.grupos?.[fase] || [])) filas.push({ ...o, fase });

  const docs = invoices.ok ? (invoices.data || []).filter((d) => !idsOO.has(String(d.id))) : [];
  const porNumero = new Map(docs.map((d) => [String(d.numero || "").replace(/\s+/g, "").toUpperCase(), d]));
  const detalle = [];
  let total = 0, sinPto = 0;

  for (const o of filas) {
    const pto = Number(o.pto_total) || 0;
    const tags = (tagsPorObra[o.ccpp_id] || []).map((t) => String(t).toLowerCase());
    const nObra = normNombre(o.comunidad);
    const ligadas = new Map();      // restan
    const porNombre = [];           // solo aviso
    const numHoja = String(o.numero_factura_holded || "").replace(/\s+/g, "").toUpperCase();
    if (numHoja && porNumero.has(numHoja)) ligadas.set(porNumero.get(numHoja).id, { d: porNumero.get(numHoja), via: "número en la hoja" });
    for (const d of docs) {
      if (ligadas.has(d.id)) continue;
      const dTags = (d.tags || []).map((t) => String(t).toLowerCase());
      if (tags.length && dTags.some((t) => tags.includes(t))) ligadas.set(d.id, { d, via: "etiqueta" });
      else if (mismoNombre(normNombre(d.cliente), nObra)) porNombre.push(d);
    }
    const facturas = [...ligadas.values()];
    const baseFacturada = r2(facturas.reduce((s, f) => s + (Number(f.d.subtotal) || 0), 0));
    // Lo que queda por facturar. Si las facturas ligadas cubren casi todo el
    // presupuesto, la obra está facturada (su pendiente ya está en la 430, T3).
    let queda = baseFacturada >= pto * COBERTURA_FACTURADA ? 0 : r2(Math.max(0, pto - baseFacturada));
    if (!pto) { sinPto++; queda = 0; }
    total += queda;

    const nums = (xs) => xs.map((f) => f.d.numero).join(", ");
    if (facturas.length && queda === 0 && pto) {
      if (facturas.every((f) => f.d.estado_logico === "cobrada")) {
        avisos.push({ nivel: "ambar", texto: `${o.comunidad}: fase ${o.fase.slice(0, 2)} con factura ${nums(facturas)} cobrada. No cuenta como obra sin facturar; pasarla a 18_COBRADA.` });
      }
    } else if (facturas.length && queda > 0) {
      avisos.push({ nivel: "ambar", texto: `${o.comunidad}: facturas ${nums(facturas)} (${baseFacturada} € base) por debajo del presupuesto (${pto} €). Se cuenta sin facturar solo la diferencia.` });
    }
    if (porNombre.length) {
      avisos.push({ nivel: "ambar", texto: `${o.comunidad}: hay factura(s) en Holded a un contacto parecido (${porNombre.map((d) => `${d.numero} «${d.cliente}» ${r2(d.subtotal)} € base, ${d.estado_logico}`).join("; ")}) sin ligar a la obra. No se restan: si son de esta obra, ligarlas por número o etiqueta.` });
    }
    if (!pto) avisos.push({ nivel: "ambar", texto: `${o.comunidad}: fase ${o.fase.slice(0, 2)} sin presupuesto (pto_total) en ARA-OS. No se puede contar su obra sin facturar.` });

    detalle.push({
      concepto: o.comunidad, fase: o.fase, ccpp_id: o.ccpp_id, presupuesto: pto,
      facturado_base: baseFacturada, importe: queda,
      facturas: facturas.map((f) => ({ numero: f.d.numero, cliente: f.d.cliente, base: f.d.subtotal, estado: f.d.estado_logico, via: f.via })),
      posibles_facturas: porNombre.map((d) => ({ numero: d.numero, cliente: d.cliente, base: d.subtotal, estado: d.estado_logico })),
    });
  }
  detalle.sort((a, b) => b.importe - a.importe);
  return { total: r2(total), detalle, sinPto, cruceHolded: invoices.ok };
}

// ── T4b · otras obras (obras-otras) terminadas y sin factura ────
const esVerdad = (v) => ["true", "si", "sí", "1", "x"].includes(String(v == null ? "" : v).trim().toLowerCase());
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// ── 10.4 · Anticipos facturados de obra sin ejecutar ─────────
// Toda factura emitida (o cobrada) de los últimos 12 meses cuya obra no tiene
// OT, o la tiene en fase < 12, es dinero cobrado por obra que aún hay que
// hacer: su base va a DEBO (D13) y resta en el patrimonio al cierre. Si la
// obra está en 12-13 con coste previsto, no va aquí: la cubre D11.
// Enlace factura ↔ obra: id de factura ligada en otras obras, etiqueta de obra
// de Holded y, si no, nombre de contacto normalizado (como en 4.1).
const FASES_EJECUTADAS_OO = ["INICIO_OBRA", "EN_EJECUCION", "FINALIZADA", "FACTURADA", "COBRADA"];
function anticiposSinEjecutar({ invoices, p5, oo, tags, rentab, hoy }) {
  const desde = sumarDias(hoy, -365);
  const lower = (x) => String(x || "").toLowerCase();
  // Obras candidatas: Plan 5 (todas las fases) y otras obras
  const obras = [];
  for (const [fase, lista] of Object.entries(p5?.grupos || {})) {
    for (const o of lista || []) {
      const faseOt = String(o.ot?.fase_ot || "");
      obras.push({
        tipo: "plan5", nombre: o.comunidad, nombres: [o.comunidad, o.direccion].filter(Boolean).map(normNombre),
        ccpp_id: o.ccpp_id, total_base: Number(o.pto_total) || 0,
        tags: (tags?.[o.ccpp_id] || []).map(lower),
        fase: faseOt || o.fase || fase, conOT: !!faseOt,
        numOT: parseInt(faseOt.slice(0, 2), 10),
      });
    }
  }
  const porIdOO = new Map();
  for (const o of oo?.obras || []) {
    if (esVerdad(o.borrado)) continue;
    const ob = {
      tipo: "oo", nombre: o.nombre || o.obra_id, nombres: [o.nombre, o.cliente, o.direccion].filter(Boolean).map(normNombre),
      obra_id: o.obra_id, total_base: num(o.subtotal_eur) || (num(o.total_eur) || num(o.importe)) / 1.1,
      total: num(o.total_eur) || num(o.importe),
      tags: (o.tags_holded_array || []).map(lower), fase: o.fase,
    };
    obras.push(ob);
    for (const k of ["holded_invoice_emitida_id", "holded_invoice_id"]) {
      const v = String(o[k] || "").trim();
      if (v) porIdOO.set(v, ob);
    }
  }
  // ¿Obra sin ejecutar? Plan 5 sin OT o con OT < 12, o en 12-13 sin coste
  // previsto (si lo tiene, lo cubre D11); otras obras en PRESUPUESTO.
  const sinEjecutar = (ob) => {
    if (ob.tipo === "oo") return !FASES_EJECUTADAS_OO.includes(ob.fase);
    if (!ob.conOT || !(ob.numOT >= 12)) return true;
    if (ob.numOT <= 13) {
      const r = rentab?.[ob.ccpp_id];
      const prev = r?.ok ? (Number(r.data?.previsto?.mano_obra_previsto) || 0) + (Number(r.data?.previsto?.material_previsto) || 0) : 0;
      return !(prev > 0);
    }
    return false;
  };

  const lineas = [], sinObra = [];
  for (const d of invoices || []) {
    if (!d.fecha || d.fecha < desde || d.fecha > hoy) continue;
    if (!(Number(d.total) > 0)) continue;                         // rectificativas fuera
    let ob = porIdOO.get(String(d.id)) || null, via = ob ? "factura ligada en otras obras" : null;
    if (!ob) {
      const dTags = (d.tags || []).map(lower);
      ob = obras.find((o) => o.tags.length && dTags.some((t) => o.tags.includes(t))) || null;
      if (ob) via = "etiqueta";
    }
    if (!ob) {
      const nc = normNombre(d.cliente);
      ob = obras.find((o) => o.nombres.some((n) => mismoNombre(n, nc))) || null;
      if (ob) via = "nombre del contacto";
    }
    if (!ob) { sinObra.push({ numero: d.numero, cliente: d.cliente, fecha: d.fecha, base: r2(d.subtotal) }); continue; }
    if (!sinEjecutar(ob)) continue;
    const base = r2(Number(d.subtotal) || 0);
    const cobrado = r2(Number(d.cobrado_eur) || 0);
    const pct = ob.total_base > 0 ? Math.round((base / ob.total_base) * 100) : null;
    lineas.push({
      numero: d.numero, cliente: d.cliente, fecha: d.fecha, obra: ob.nombre, fase: ob.fase, via,
      base, total: r2(d.total), cobrado, estado: d.estado_logico, pct_obra: pct,
    });
  }
  return { lineas, sinObra };
}

function calcularT4b(oo, detalleT4, invoices, avisos) {
  const obras = (oo.obras || []).filter((o) => o.fase === "FINALIZADA" && !esVerdad(o.borrado));
  const docs = invoices.ok ? (invoices.data || []) : [];
  const detalle = [];
  let total = 0, ivaSupuesto = 0;
  for (const o of obras) {
    const ligada = o.tiene_factura_emitida || esVerdad(o.facturada) || String(o.holded_invoice_id || "").trim()
      || String(o.holded_invoice_emitida_id || "").trim();
    const cobrada = esVerdad(o.cobrada) || o.estado_cobro === "cobrada";
    if (ligada || cobrada) continue;
    const tot = num(o.total_eur) || num(o.importe);
    let base = num(o.subtotal_eur);
    if (!base && num(o.iva_eur) > 0) base = tot - num(o.iva_eur);
    let supuesto = false;
    if (!base && tot) { base = tot / 1.21; supuesto = true; ivaSupuesto++; }
    // Entradas a cuenta (con IVA) ya cobradas: se descuenta su parte de base
    const entradas = num(o.entradas_cuenta_eur) + num(o.cobrado_eur);
    const queda = tot > 0 ? r2(Math.max(0, base * (1 - entradas / tot))) : 0;
    if (!queda) continue;
    total += queda;
    detalle.push({ concepto: o.nombre || o.obra_id, obra_id: o.obra_id, importe: queda, base: r2(base), entradas: r2(entradas), iva_supuesto: supuesto });
  }

  // Posibles duplicados: se avisa, no se quita (Alberto decide)
  const n = (x) => normNombre(x);
  detalle.forEach((d, i) => {
    const nd = n(d.concepto);
    const p5 = detalleT4.find((t) => mismoNombre(n(t.concepto), nd));
    if (p5) avisos.push({ nivel: "ambar", texto: `Posible duplicado: «${d.concepto}» (otras obras) se parece a «${p5.concepto}» (Plan 5). Revisar si son la misma obra o unos extras.` });
    const otra = detalle.slice(0, i).find((x) => mismoNombre(n(x.concepto), nd) || Math.abs(x.importe - d.importe) <= 2);
    if (otra) avisos.push({ nivel: "ambar", texto: `Posible duplicado en otras obras: «${otra.concepto}» y «${d.concepto}».` });
    const fra = docs.find((x) => mismoNombre(n(x.cliente), nd));
    if (fra) avisos.push({ nivel: "ambar", texto: `«${d.concepto}» figura sin factura en ARA-OS, pero hay una factura en Holded a «${fra.cliente}» (${fra.numero}). Revisar si hay que ligarla.` });
  });
  detalle.sort((a, b) => b.importe - a.importe);
  return { total: r2(total), detalle, ivaSupuesto };
}

// ── nóminas y TGSS ────────────────────────────────────────────
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Periodo (AAAA-MM) de un apunte de la 465: primero la descripción
// («Nómina septiembre 2026», «NOMINA 09/2026», «2026-09»); si no dice nada,
// un devengo (haber) es del mes de su fecha y un pago (debe) no se sabe (null).
function periodoNomina(a) {
  const d = String(a.descripcion || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const [fy, fm] = a.fecha.split("-").map(Number);
  let m = /\b(20\d\d)[-/.](\d{1,2})\b/.exec(d);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${String(+m[2]).padStart(2, "0")}`;
  m = /\b(\d{1,2})[-/.](20\d\d)\b/.exec(d);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${String(+m[1]).padStart(2, "0")}`;
  const idx = MESES_ES.findIndex((n) => d.includes(n) || (n === "septiembre" && d.includes("setiembre")));
  if (idx >= 0) {
    const y = (m = /\b(20\d\d)\b/.exec(d)) ? +m[1] : (idx + 1 > fm + 1 ? fy - 1 : fy); // «diciembre» pagada en enero
    return `${y}-${String(idx + 1).padStart(2, "0")}`;
  }
  return a.haber > 0 ? a.fecha.slice(0, 7) : null;
}

// Cargos de la TGSS en el banco, del más reciente al más antiguo, separados en
// recibo mensual de cotizaciones y otros (aplazamientos, recargos…).
// Regla principal (Alberto, 29/09): el concepto del Santander del recibo es
// siempre «RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL» → contiene «TGSS» y
// «COTIZACION». Respaldo, solo si ningún cargo trae ese concepto: por el día
// (últimos del mes, o 1-3 si el último hábil fue festivo).
const RE_TGSS = /tgss|t\.g\.s\.s|tesoreria general|seguridad social|seguros sociales|cotizaci/i;
const RE_NO_COTIZ = /aplaz|fraccion|plazo|recargo|apremio|embargo|providencia|deuda/i;
const sinAcentos = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function cargosTGSS(apuntes) {
  const tg = apuntes.filter((a) => a.salida > 0 && RE_TGSS.test(sinAcentos(a.descripcion)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const porConcepto = (a) => /tgss/i.test(sinAcentos(a.descripcion)) && /cotizacion/i.test(sinAcentos(a.descripcion));
  if (tg.some(porConcepto)) {
    return { cotizaciones: tg.filter(porConcepto), otros: tg.filter((a) => !porConcepto(a)), regla: "concepto" };
  }
  const porFecha = (a) => {
    if (RE_NO_COTIZ.test(sinAcentos(a.descripcion))) return false;
    const dia = Number(a.fecha.slice(8, 10));
    return dia >= 25 || dia <= 3;
  };
  return { cotizaciones: tg.filter(porFecha), otros: tg.filter((a) => !porFecha(a)), regla: "fecha" };
}

// ¿Es un movimiento bancario de verdad? Los asientos manuales del libro
// (type "entry" en Holded, como ya trata /custodias) y los de
// regularización, reclasificación, apertura o cierre NO son cargos del banco.
const RE_ASIENTO = /regulariz|reclasif|\brecl-|asiento|apertura|cierre/i;
function esMovimientoBancario(a) {
  if (String(a.tipo || "").toLowerCase() === "entry") return false;
  return !RE_ASIENTO.test(sinAcentos(a.descripcion));
}

// 10.2.2 · Facturas ya cobradas en el banco y aún sin conciliar en Holded:
// entrada del mismo importe (±0,01) en los últimos 10 días cuyo concepto
// contiene el número de la factura («FRA F260049»). Cada entrada, una vez.
function cobrosEnBanco(invoices, movimientos, hoy) {
  const desde = sumarDias(hoy, -10);
  const entradas = (movimientos || []).filter((a) => a.salida < 0 && a.fecha >= desde && a.fecha <= hoy);
  const usadas = new Set();
  const out = [];
  const norm = (x) => String(x || "").toUpperCase().replace(/\s+/g, "");
  for (const d of invoices || []) {
    const pdte = Number(d.pdte_cobro_eur) || 0;
    const num = norm(d.numero);
    if (pdte <= 0.01 || num.length < 4) continue;
    const i = entradas.findIndex((a, k) => !usadas.has(k) && Math.abs(-a.salida - pdte) <= 0.01 && norm(a.descripcion).includes(num));
    if (i < 0) continue;
    usadas.add(i);
    out.push({ id: d.id, numero: d.numero, cliente: d.cliente, importe: r2(pdte), fecha: d.fecha, fecha_cobro: entradas[i].fecha });
  }
  return out;
}

// 10.2.1 · ¿Cuadran el saldo que da el banco y la suma de sus movimientos?
// f.cuadre = { ok, data: { saldo_banco, saldo_movimientos, fecha } }. Si la
// diferencia pasa de 1 €, las cifras de caja y custodia son provisionales.
// No se adivina qué movimiento falta.
// historico = { importe, fecha } de config_dinero (descuadre_historico_572 y
// descuadre_historico_572_fecha): parte vieja de la diferencia (movimientos de
// 2023-2025 sin conciliar). Se aplica con el signo de la diferencia (da igual
// si en la hoja se escribe en positivo). Umbrales (Alberto, 30/09):
//   · parte del día ≤ 1 €          → cuadra
//   · 1 € < parte del día ≤ 1.000 € → aviso ámbar, sin «provisional»
//   · parte del día > 1.000 €       → aviso rojo y cifras provisionales
// Si la diferencia total baja más de 500 € por debajo del histórico guardado,
// se ha conciliado algo antiguo: aviso para actualizar la clave.
const CUADRE_TOLERANCIA = 1;
const CUADRE_UMBRAL_ROJO = 1000;
const CUADRE_HISTORICO_CAMBIO = 500;
function cuadreBanco(fuente, historico = null) {
  if (!fuente?.ok) return { estado: "sin_comprobar", motivo: fuente?.error || "sin fuente", provisional: null };
  const { saldo_banco, saldo_movimientos, fecha, cuenta, apuntes, ultimo_apunte } = fuente.data || {};
  if (saldo_banco == null || saldo_movimientos == null) return { estado: "sin_comprobar", motivo: "faltan saldos", provisional: null };
  const dif = r2(saldo_banco - saldo_movimientos);
  const histAbs = historico && historico.importe != null ? Math.abs(r2(historico.importe)) : null;
  const hist = histAbs == null ? null : (dif < 0 ? -histAbs : histAbs);
  const delDia = hist == null ? dif : r2(dif - hist);
  const abs = Math.abs(delDia);
  const estado = abs <= CUADRE_TOLERANCIA ? "cuadra" : abs <= CUADRE_UMBRAL_ROJO ? "descuadre_menor" : "no_cuadra";
  const revisar = histAbs != null && Math.abs(dif) < histAbs - CUADRE_HISTORICO_CAMBIO;
  return {
    estado, saldo_banco: r2(saldo_banco), saldo_movimientos: r2(saldo_movimientos),
    diferencia: delDia,                 // parte «del día»: la que dispara los avisos
    diferencia_total: dif,
    descuadre_historico: hist, descuadre_historico_fecha: hist == null ? null : (historico.fecha || null),
    actualizar_historico_a: revisar ? r2(Math.abs(dif)) : null,
    fecha: fecha || null, provisional: estado === "no_cuadra",
    cuenta: cuenta || null, apuntes_contables: apuntes ?? null, ultimo_apunte: ultimo_apunte || null,
    fuente: "Saldo del banco (tesorería de Holded) − saldo contable de la cuenta en el libro: la diferencia son movimientos sin conciliar.",
  };
}

// Mes en que VENCE un recibo de cotizaciones cargado: el recibo del mes M se
// carga el último día hábil de M+1; un cargo del 1-3 es el que venció el mes
// anterior (festivo). Devuelve AAAA-MM.
function mesVtoCotizacion(c) {
  return Number(c.fecha.slice(8, 10)) <= 3 ? sumarDias(c.fecha.slice(0, 8) + "01", -1).slice(0, 7) : c.fecha.slice(0, 7);
}

// ── cálculo principal ─────────────────────────────────────────
// f = { tesoreria, clientes, custodias, obligaciones, ot, iva, rentab, invoices,
//       tags, prestamos, config, banco, nominas465 }
function calcularEscalera(f, hoy, ahoraIso) {
  const avisos = [];
  const cfg = {};
  if (f.config?.ok) for (const r of f.config.data || []) {
    const k = String(r.clave || "").trim().toLowerCase();
    if (k) cfg[k] = r.valor;
  }
  const cfgNum = (k) => (cfg[k] === undefined || String(cfg[k]).trim() === "" ? null : parseImporte(cfg[k]));

  const tes = f.tesoreria?.ok ? f.tesoreria.data : null;
  const cli = f.clientes?.ok && f.clientes.data?.ok !== false ? f.clientes.data : null;
  const saldos = cli?.saldos_por_cuenta || null;
  const obl = f.obligaciones?.ok ? f.obligaciones.data : null;
  const fechaCli = cli?.generado || null;

  // ── frescura del banco (último apunte de la cuenta corriente principal) ──
  let ultimoMov = null;
  if (f.banco?.ok) for (const a of f.banco.data || []) if (a.fecha && (!ultimoMov || a.fecha > ultimoMov)) ultimoMov = a.fecha;
  const dow = new Date(hoy + "T00:00:00Z").getUTCDay();
  const laborable = dow !== 0 && dow !== 6;
  const frescura = {
    banco_ultimo_movimiento: ultimoMov,
    banco_desactualizado: f.banco?.ok ? (!ultimoMov || (laborable && ultimoMov < diaLaborableAnterior(hoy))) : null,
    nota: "Holded solo da la fecha del apunte, no la hora de la sincronización.",
  };
  if (!f.banco?.ok) avisos.push({ nivel: "ambar", texto: "No se ha podido leer el último movimiento del banco en Holded: no se sabe si el banco está al día." });
  else if (frescura.banco_desactualizado) avisos.push({ nivel: "rojo", texto: `Banco sin sincronizar desde ${fmtDM(ultimoMov)}: caja y custodia pueden ir con retraso.` });

  // ════════ TENGO ════════
  const tengo = [];

  // T1 Bancos
  if (tes) {
    const l = linea("T1", "Bancos", tes.total_eur, "Holded tesorería (572)", "exacto", ultimoMov || ahoraIso);
    l.detalle = (tes.cuentas || []).map((c) => ({ concepto: c.nombre, importe: c.saldo }));
    tengo.push(l);
  } else tengo.push(sinDato("T1", "Bancos", "Holded tesorería (572)", f.tesoreria?.error));

  // T2 Pleo
  if (tes?.pleo) tengo.push(linea("T2", "Pleo", tes.pleo.saldo, "Holded tesorería (Pleo)", "exacto", ahoraIso));
  else if (cfgNum("pleo_saldo") != null) tengo.push(linea("T2", "Pleo", cfgNum("pleo_saldo"), "Hoja config_dinero (pleo_saldo)", "estimado", null, { nota: "Holded no tiene la cuenta de Pleo: saldo puesto a mano." }));
  else tengo.push(sinDato("T2", "Pleo", "Holded tesorería (Pleo)", tes ? "Holded no tiene la cuenta de Pleo y no hay pleo_saldo en config_dinero" : f.tesoreria?.error));

  // T3 Facturas emitidas sin cobrar (430)
  // 10.2.2: una factura cuyo cobro ya está en el banco (entrada del mismo
  // importe ±0,01 en los últimos 10 días, con su número en el concepto) no
  // cuenta, aunque Holded aún no la tenga conciliada.
  const cobradasBanco = cobrosEnBanco(f.invoices?.ok ? f.invoices.data : [], f.banco?.ok ? f.banco.data : [], hoy);
  for (const c of cobradasBanco) avisos.push({ nivel: "ambar", texto: `${c.numero} cobrada en banco (${fmtDM(c.fecha_cobro)}), pendiente de conciliar.` });
  let mas90 = null;
  if (cli) {
    const menos = r2(cobradasBanco.reduce((t, c) => t + c.importe, 0));
    const menos90 = r2(cobradasBanco.filter((c) => c.fecha && c.fecha < sumarDias(hoy, -90)).reduce((t, c) => t + c.importe, 0));
    mas90 = r2(Math.max(0, (cli.por_tramo?.["+90"] || 0) - menos90));
    const l = linea("T3", "Facturas emitidas sin cobrar", r2(cli.total - menos), "Contabilidad 430", cli.lectura?.truncado ? "estimado" : "exacto", fechaCli, { mas_90: mas90 });
    l.detalle = [
      ...(cli.clientes || []).map((c) => ({ concepto: c.nombre || c.cuenta, importe: c.saldo, tramo: c.tramo, dias: c.dias })),
      ...cobradasBanco.map((c) => ({ concepto: `${c.numero} · cobrada en banco ${fmtDM(c.fecha_cobro)}, pendiente de conciliar`, importe: -c.importe })),
    ];
    if (cli.lectura?.truncado) avisos.push({ nivel: "ambar", texto: "La lectura de la 430 se ha cortado por el tope de páginas: «Facturas sin cobrar» puede estar incompleta." });
    tengo.push(l);
  } else tengo.push(sinDato("T3", "Facturas emitidas sin cobrar", "Contabilidad 430", f.clientes?.error));

  // T4 Obra sin facturar, sin IVA
  let t4 = null;
  if (f.ot?.ok) {
    t4 = calcularT4(f.ot.data, f.invoices || { ok: false }, f.tags?.ok ? f.tags.data : {}, avisos, idsFacturasOO(f.oo?.ok ? f.oo.data : null));
    const fiab = t4.cruceHolded && !t4.sinPto ? "exacto" : "estimado";
    const l = linea("T4", "Obra sin facturar (sin IVA)", t4.total, "ARA-OS órdenes de trabajo 12-17 · presupuesto", fiab, ahoraIso);
    l.detalle = t4.detalle;
    if (!t4.cruceHolded) {
      l.nota = "Sin cruce con las facturas de Holded: puede contar obras ya facturadas.";
      avisos.push({ nivel: "ambar", texto: "No se han podido leer las facturas de Holded: la obra sin facturar no se ha cruzado y puede contar alguna ya facturada." });
    }
    tengo.push(l);
  } else tengo.push(sinDato("T4", "Obra sin facturar (sin IVA)", "ARA-OS órdenes de trabajo", f.ot?.error));

  // T4b Otras obras (obras-otras) terminadas y sin factura, sin IVA
  if (f.oo?.ok) {
    const r = calcularT4b(f.oo.data, t4 ? t4.detalle : [], f.invoices || { ok: false }, avisos);
    const l = linea("T4b", "Otras obras sin facturar (sin IVA)", r.total, "ARA-OS otras obras (FINALIZADA, sin factura)", "estimado", ahoraIso);
    l.detalle = r.detalle;
    if (r.ivaSupuesto) l.nota = `${r.ivaSupuesto} obra(s) sin base imponible en ARA-OS: IVA supuesto del 21 %.`;
    tengo.push(l);
  } else tengo.push(sinDato("T4b", "Otras obras sin facturar (sin IVA)", "ARA-OS otras obras", f.oo?.error));

  // Préstamos (hoja `prestamos`)
  let pres = null;
  if (f.prestamos?.ok) {
    pres = resumirPrestamos(f.prestamos.data || [], hoy);
    for (const p of [...pres.concedidos.prestamos, ...pres.recibidos.prestamos]) {
      for (const a of p.avisos) avisos.push({ nivel: "ambar", texto: `Préstamo ${p.id || p.contraparte}: ${a}` });
    }
    if (f.prestamos.faltan?.length) avisos.push({ nivel: "ambar", texto: `Hoja prestamos: faltan las columnas ${f.prestamos.faltan.join(", ")}` });
  }
  const lineaPrestamos = (id, concepto, grupo) => {
    if (!pres) return sinDato(id, concepto, "Hoja prestamos", f.prestamos?.error);
    const g = pres[grupo];
    // Hoja vacía (o sin préstamos de este tipo) ≠ 0: sin dato. Para declarar
    // que de verdad no hay ninguno, una fila con principal 0.
    if (!g.prestamos.length) {
      return sinDato(id, concepto, "Hoja prestamos", `La hoja prestamos no tiene ningún préstamo ${grupo === "concedidos" ? "concedido" : "recibido"} activo. Si de verdad no hay, añadir una fila con principal 0.`);
    }
    const fiab = g.prestamos.some((p) => p.fiabilidad !== "exacto") ? "estimado" : "exacto";
    const l = linea(id, concepto, g.completo ? g.total : null, "Hoja prestamos", fiab, ahoraIso);
    if (!g.completo) l.nota = "Algún préstamo no tiene ni calendario ni principal.";
    l.detalle = g.prestamos.map((p) => ({ concepto: p.contraparte || p.id, id: p.id, importe: p.saldo_vivo, fiabilidad: p.fiabilidad, cuotas_pendientes: p.cuotas_pendientes, nota: p.nota, avisos: p.avisos }));
    return l;
  };

  // T5 Préstamos concedidos
  tengo.push(lineaPrestamos("T5", "Préstamos concedidos (nos deben)", "concedidos"));

  // ════════ DEBO ════════
  const debo = [];

  // D1 Custodia
  if (f.custodias?.ok && f.custodias.data?.totales) {
    debo.push(linea("D1", "Custodia Plan Cinco", f.custodias.data.totales.en_custodia, "Holded 5610 (/custodias)", "exacto", ahoraIso));
  } else debo.push(sinDato("D1", "Custodia Plan Cinco", "Holded 5610 (/custodias)", f.custodias?.error));

  // D2 Señales
  if (saldos) {
    const l = linea("D2", "Señales de clientes", -saldo(saldos, CUENTA_SENALES), `Contabilidad ${CUENTA_SENALES}`, "exacto", fechaCli);
    if (!hayCuenta(saldos, CUENTA_SENALES)) l.nota = "La cuenta no tiene apuntes.";
    debo.push(l);
  } else debo.push(sinDato("D2", "Señales de clientes", `Contabilidad ${CUENTA_SENALES}`, f.clientes?.error));

  // D3 Hacienda: aplazamientos, sanciones, intereses
  if (obl?.resumen && obl.resumen.deuda_total != null) {
    const l = linea("D3", "Hacienda: aplazamiento, sanciones e intereses", obl.resumen.deuda_total, "/obligaciones (calendario AEAT + banco)", "exacto", obl.generado);
    l.detalle = [
      ...(obl.expedientes || []).filter((e) => e.pendiente > 0).map((e) => ({ concepto: e.concepto, importe: e.pendiente, tipo: e.tipo })),
      // Ya pagadas (marcadas o encontradas en el banco): informativo, no suman
      ...(obl.expedientes || []).filter((e) => !(e.pendiente > 0) && e.detalle_pago)
        .map((e) => ({ concepto: `${e.concepto} · ${e.detalle_pago}`, importe: 0, informativo: true })),
    ];
    debo.push(l);
  } else debo.push(sinDato("D3", "Hacienda: aplazamiento, sanciones e intereses", "/obligaciones", f.obligaciones?.error));

  // D4 IVA corriente pendiente (periodo sin liquidar)
  if (f.iva?.ok && f.iva.data?.iva_resultado != null) {
    const v = Number(f.iva.data.iva_resultado);
    const l = linea("D4", "IVA corriente pendiente", Math.max(0, v), "Holded facturas (477 − 472)", "estimado", ahoraIso, {
      periodo: { desde: f.iva.data.periodo_inicio, hasta: f.iva.data.periodo_fin },
    });
    l.detalle = [
      { concepto: "IVA repercutido", importe: f.iva.data.iva_repercutido },
      { concepto: "IVA soportado", importe: -f.iva.data.iva_soportado },
    ];
    if (v < 0) l.nota = `Sale a compensar (${r2(v)} €): se cuenta 0.`;
    const p303 = (obl?.periodicos || []).find((p) => p.modelo === "303");
    if (p303) l.detalle.push({ concepto: `Contraste contabilidad 477−472 (${p303.periodo})`, importe: p303.devengado_trimestre, informativo: true });
    debo.push(l);
  } else debo.push(sinDato("D4", "IVA corriente pendiente", "/holded/iva-trimestre", f.iva?.error));

  // D5 IVA de los anticipos (438 × 10/110)
  if (saldos) {
    const s438 = -saldo(saldos, "438");
    const l = linea("D5", "IVA de los anticipos (438 al 10 %)", Math.max(0, s438) * IVA_ANTICIPOS / (1 + IVA_ANTICIPOS), "Contabilidad 438 × 10/110", "estimado", fechaCli);
    l.detalle = [{ concepto: "Saldo 438 (anticipos con IVA)", importe: r2(s438) }];
    debo.push(l);
  } else debo.push(sinDato("D5", "IVA de los anticipos (438 al 10 %)", "Contabilidad 438", f.clientes?.error));

  // D6 Proveedores (400 + 410)
  if (saldos) {
    const l = linea("D6", "Proveedores", -(saldo(saldos, "400") + saldo(saldos, "410")), "Contabilidad 400/410", "exacto", fechaCli);
    l.detalle = [{ concepto: "400 Proveedores", importe: -saldo(saldos, "400") }, { concepto: "410 Acreedores", importe: -saldo(saldos, "410") }];
    debo.push(l);
  } else debo.push(sinDato("D6", "Proveedores", "Contabilidad 400/410", f.clientes?.error));

  // D7 Nóminas del mes sin pagar
  // Regla (Alberto, 29/09): nomina_neta_mensual de config_dinero hasta que la
  // nómina DEL MES EN CURSO esté contabilizada o pagada en Holded (465);
  // desde entonces, el saldo acreedor de la 465 (0 si ya se pagó). El mes se
  // saca del PERIODO de la nómina (descripción del apunte), no de la fecha del
  // pago: la de agosto pagada el 03/09 no es la de septiembre. No se mira el
  // concepto del banco.
  {
    const mes = hoy.slice(0, 7);
    const movsMes = f.nominas465?.ok ? (f.nominas465.data || []).filter((a) => periodoNomina(a) === mes) : [];
    const neta = cfgNum("nomina_neta_mensual");
    if (movsMes.length && saldos) {
      const l = linea("D7", "Nóminas del mes sin pagar", Math.max(0, -saldo(saldos, "465")), "Contabilidad 465 (nómina del mes en Holded)", "exacto", fechaCli);
      l.detalle = movsMes.map((a) => ({ concepto: `${fmtDM(a.fecha)} · ${a.descripcion.slice(0, 60)}`, importe: r2(a.haber - a.debe) }));
      debo.push(l);
    } else if (neta != null) {
      const l = linea("D7", "Nóminas del mes sin pagar", neta, "Hoja config_dinero (nomina_neta_mensual)", "estimado", ahoraIso);
      l.nota = f.nominas465?.ok
        ? `Nómina de ${mes} aún sin contabilizar ni pagar en Holded (465).`
        : "No se han podido leer los apuntes de la 465: se usa la cifra de config.";
      debo.push(l);
    } else debo.push(sinDato("D7", "Nóminas del mes sin pagar", "Contabilidad 465 / config_dinero", "Nómina del mes sin contabilizar y sin nomina_neta_mensual en la hoja config_dinero"));
  }

  // D8 Seguridad Social pendiente = recibo de cotizaciones vencido sin pagar +
  // el del mes en curso. El recibo de cotizaciones se carga el último día
  // hábil del mes (el de agosto, el 30/09). Otros cargos de la TGSS (cuotas de
  // un aplazamiento, a mitad de mes) NO son cotización: se separan y se avisa.
  {
    const s476 = saldos ? -saldo(saldos, "476") : null;
    const { cotizaciones, otros, regla } = f.banco?.ok ? cargosTGSS(f.banco.data || []) : { cotizaciones: [], otros: [] };
    if (otros.length) {
      const u = otros[0];
      avisos.push({ nivel: "ambar", texto: `Cargos de la TGSS que no son el recibo de cotizaciones (último: ${r2(u.salida)} € el ${fmtDM(u.fecha)}): parecen un aplazamiento de la Seguridad Social. No cuentan en D8; si es un aplazamiento, añadirlo a la hoja prestamos (recibido, con sus cuotas).` });
    }
    const detOtros = otros.map((a) => ({ concepto: `No es cotización · ${fmtDM(a.fecha)} · ${a.descripcion.slice(0, 50)}`, importe: r2(a.salida), informativo: true }));
    if (s476 != null && s476 > 1) {
      const l = linea("D8", "Seguridad Social pendiente", s476, "Contabilidad 476", "exacto", fechaCli);
      l.detalle = detOtros;
      debo.push(l);
    } else if (cotizaciones.length) {
      const ult = cotizaciones[0];
      const mes = hoy.slice(0, 7);
      const vencidoPagado = cotizaciones.some((c) => mesVtoCotizacion(c) === mes);
      const n = vencidoPagado ? 1 : 2;
      const l = linea("D8", "Seguridad Social pendiente", ult.salida * n, "Último recibo de cotizaciones TGSS en el banco", "estimado", ult.fecha, { recibo_vencido_cargado: vencidoPagado });
      if (regla === "fecha") l.nota = "Ningún cargo trae el concepto «TGSS … COTIZACION»: el recibo se ha identificado por el día del cargo.";
      l.detalle = [
        { concepto: `Último recibo de cotizaciones (${fmtDM(ult.fecha)})`, importe: r2(ult.salida) },
        { concepto: vencidoPagado ? "Pendiente: mes en curso" : "Pendientes: recibo vencido sin cargar + mes en curso", importe: r2(ult.salida * n) },
        ...detOtros,
      ];
      debo.push(l);
    } else {
      const l = sinDato("D8", "Seguridad Social pendiente", "Contabilidad 476 / recibos TGSS", f.banco?.ok ? "No hay saldo en la 476 ni se encuentra el recibo de cotizaciones en el banco" : f.banco?.error);
      l.detalle = detOtros;
      debo.push(l);
    }
  }

  // D9 Retenciones IRPF (modelo 111)
  {
    const m111 = (obl?.periodicos || []).find((p) => p.modelo === "111");
    if (m111) {
      const l = linea("D9", "Retenciones IRPF (modelo 111)", (m111.devengado_trimestre || 0) + (m111.arrastre || 0), "Contabilidad 4751 (/obligaciones)", "estimado", obl.generado);
      l.detalle = [{ concepto: `Retenido en el ${m111.periodo}`, importe: m111.devengado_trimestre }, { concepto: "Arrastre de trimestres anteriores", importe: m111.arrastre }];
      debo.push(l);
    } else debo.push(sinDato("D9", "Retenciones IRPF (modelo 111)", "Contabilidad 4751", obl ? "/obligaciones no trae el modelo 111" : f.obligaciones?.error));
  }

  // D10 Préstamos recibidos
  const d10 = lineaPrestamos("D10", "Préstamos recibidos (saldo vivo)", "recibidos");
  if (pres && saldos) {
    const ct = contrasteHolded([...pres.concedidos.prestamos, ...pres.recibidos.prestamos], saldos);
    d10.contraste = ct;
    avisos.push(...ct.avisos);
  } else if (pres) d10.contraste = { porCuenta: [], avisos: [], sinContrastar: ["(sin contabilidad)"] };
  debo.push(d10);

  // D11 Coste pendiente de obras en curso (fases 12-13)
  if (f.ot?.ok) {
    const enCurso = FASES_D11.flatMap((fase) => (f.ot.data.grupos?.[fase] || []).map((o) => ({ ...o, fase })));
    const det = [];
    let total = 0, fallos = 0;
    for (const o of enCurso) {
      const r = f.rentab?.[o.ccpp_id];
      if (!r || !r.ok) { fallos++; det.push({ concepto: o.comunidad, importe: null, nota: r?.error || "sin respuesta" }); continue; }
      const pv = r.data.previsto || {}, re = r.data.real || {};
      const mo = Math.max(0, (Number(pv.mano_obra_previsto) || 0) - (Number(re.mano_obra_real) || 0));
      const mat = Math.max(0, (Number(pv.material_previsto) || 0) - (Number(re.material_real) || 0));
      if (!pv.mano_obra_previsto && !pv.material_previsto) avisos.push({ nivel: "ambar", texto: `${o.comunidad}: en ejecución sin coste previsto en ARA-OS; su coste pendiente cuenta 0.` });
      total += mo + mat;
      det.push({ concepto: o.comunidad, fase: o.fase, importe: r2(mo + mat), mano_obra_pendiente: r2(mo), material_pendiente: r2(mat),
                 ...(r.viejo_min != null ? { nota: `dato de hace ${r.viejo_min} min (la última consulta no respondió)` } : {}) });
    }
    const l = linea("D11", "Coste pendiente de obras en curso", fallos && fallos === enCurso.length ? null : total, "/holded/rentabilidad-obra (fases 12-13)", "estimado", ahoraIso);
    l.detalle = det;
    if (fallos) { l.incompleta = true; l.nota = `${fallos} obra(s) sin dato de rentabilidad.`; }
    debo.push(l);
  } else debo.push(sinDato("D11", "Coste pendiente de obras en curso", "/holded/rentabilidad-obra", f.ot?.error));

  // D13 Anticipos de obra sin ejecutar (10.4): base de las facturas de obras
  // que no han empezado. El IVA ya va en D4.
  let d13 = null, d13Linea = null;
  if (f.invoices?.ok && f.p5?.ok && f.oo?.ok) {
    d13 = anticiposSinEjecutar({ invoices: f.invoices.data, p5: f.p5.data, oo: f.oo.data, tags: f.tags?.ok ? f.tags.data : {}, rentab: f.rentab, hoy });
    const l = linea("D13", "Anticipos de obra sin ejecutar", r2(d13.lineas.reduce((t, x) => t + x.base, 0)), "Facturas de Holded ligadas a obras sin empezar (ARA-OS)", "exacto", ahoraIso);
    l.detalle = d13.lineas.map((x) => ({ concepto: `${x.numero} · ${x.obra}`, importe: x.base, fase: x.fase, nota: `${x.cobrado > 0 ? "cobrada" : "sin cobrar"} · ${x.via}` }));
    for (const x of d13.lineas) {
      const verbo = x.cobrado > 0 ? `cobrados ${fmtEurCorto(x.cobrado)}` : `facturados ${fmtEurCorto(x.total)}`;
      avisos.push({ nivel: "ambar", texto: `${x.obra}: ${verbo}${x.pct_obra != null ? ` (${x.pct_obra} % a cuenta)` : ""} sin obra ejecutada.` });
    }
    for (const x of d13.sinObra) avisos.push({ nivel: "ambar", texto: `${x.numero}: factura sin obra ligada.` });
    d13Linea = l;
  } else d13Linea = sinDato("D13", "Anticipos de obra sin ejecutar", "Facturas de Holded + obras de ARA-OS",
    [!f.invoices?.ok && "facturas de Holded", !f.p5?.ok && "obras Plan 5", !f.oo?.ok && "otras obras"].filter(Boolean).join(", ") + " sin respuesta");

  // D12 Póliza de crédito dispuesta
  {
    const sp = saldos && hayCuenta(saldos, CUENTA_POLIZA) ? saldo(saldos, CUENTA_POLIZA) : null;
    const manual = cfgNum("poliza_dispuesta");
    if (sp != null && sp < -1) debo.push(linea("D12", "Póliza de crédito dispuesta", -sp, `Contabilidad ${CUENTA_POLIZA}`, "exacto", fechaCli));
    else if (manual != null) debo.push(linea("D12", "Póliza de crédito dispuesta", manual, "Hoja config_dinero (poliza_dispuesta)", "estimado", null, { nota: "Holded da la póliza a 0: cifra confirmada a mano." }));
    else debo.push(sinDato("D12", "Póliza de crédito dispuesta", `Holded ${CUENTA_POLIZA}`, "Holded da la póliza a 0 y no se sabe si es real. Confirmarla y ponerla en config_dinero (poliza_dispuesta)."));
  }

  debo.push(d13Linea);

  // ════════ FUERA DE LA ESCALERA ════════
  const fuera = [];
  if (cli) {
    const det = (cli.patrimonio?.ajustes || []).find((a) => a.id === "deterioro-instalaciones");
    fuera.push({ id: "F1", concepto: "Préstamo deteriorado a sociedad vinculada", importe: r2(cli.balance?.credito_instalaciones_54200001), deterioro: det ? r2(det.importe) : null, fuente: "Contabilidad 54200001", nota: "Deteriorado: no se cuenta como dinero cobrable." });
    fuera.push({ id: "F2", concepto: "Local 13 · precio aplazado", importe: cli.local13?.pendiente ?? null, fuente: "/holded/patrimonio → local13.pendiente" });
  } else {
    fuera.push({ id: "F1", concepto: "Préstamo deteriorado a sociedad vinculada", importe: null, fiabilidad: "sin_dato" });
    fuera.push({ id: "F2", concepto: "Local 13 · precio aplazado", importe: null, fiabilidad: "sin_dato" });
  }
  fuera.push({ id: "F3", concepto: "Impuesto de Sociedades", importe: null, nota: "Fuera a propósito: la cifra es «antes de IS»." });

  // ════════ acumulado «te queda» y totales ════════
  let acum = 0;
  for (const l of tengo) { acum += l.importe || 0; l.acumulado = r2(acum); }
  for (const l of debo) { acum -= l.importe || 0; l.acumulado = r2(acum); }

  // 10.2.1 · banco por delante de los movimientos → cifras provisionales
  const cuadre = cuadreBanco(f.cuadre, cfgNum("descuadre_historico_572") == null ? null
    : { importe: cfgNum("descuadre_historico_572"), fecha: cfg["descuadre_historico_572_fecha"] != null ? String(cfg["descuadre_historico_572_fecha"]).trim() || null : null });
  if (cuadre.actualizar_historico_a != null) {
    avisos.push({ nivel: "ambar", texto: `Actualizar descuadre_historico_572 a ${cuadre.actualizar_historico_a.toFixed(2)} (la diferencia total ya es menor que el histórico guardado: se ha conciliado algo antiguo).` });
  }
  if (cuadre.estado === "descuadre_menor") {
    avisos.push({ nivel: "ambar", texto: `Saldo del banco y movimientos difieren en ${fmtEurCorto(Math.abs(cuadre.diferencia))} (movimientos pequeños sin conciliar).` });
  }
  if (cuadre.estado === "no_cuadra") {
    avisos.unshift({ nivel: "rojo", texto: `Saldo del banco y movimientos no cuadran por ${fmtEurCorto(Math.abs(cuadre.diferencia))}: cifras de caja y custodia provisionales.` });
    // 10.2.3: sin cargo de la TGSS en los movimientos, D8 se deja pero es provisional
    const d8 = debo.find((l) => l.id === "D8");
    if (d8 && d8.importe != null && d8.recibo_vencido_cargado === false) d8.provisional = true;
  }

  const suma = (ls) => r2(ls.reduce((s, l) => s + (l.importe || 0), 0));
  const faltan = [...tengo, ...debo].filter((l) => l.importe == null || l.incompleta).map((l) => l.id);
  const completo = faltan.length === 0;
  if (!completo) avisos.unshift({ nivel: "rojo", texto: `Cifras INCOMPLETAS: sin dato en ${faltan.join(", ")}.` });

  const val = (ls, id) => ls.find((l) => l.id === id)?.importe;
  const T1 = val(tengo, "T1"), T2 = val(tengo, "T2"), D1 = val(debo, "D1"), D2 = val(debo, "D2");
  const tuDinero = T1 == null || T2 == null || D1 == null ? null : r2(T1 + T2 - D1);
  const totalTengo = suma(tengo), totalDebo = suma(debo);
  const deboSinCustodia = suma(debo.filter((l) => l.id !== "D1"));
  const antesIS = r2(totalTengo - totalDebo);

  const kpis = {
    tu_dinero_hoy: tuDinero,
    mio_hoy: tuDinero == null || D2 == null ? null : r2(tuDinero - D2),
    si_pagas_todo_hoy: tuDinero == null ? null : r2(tuDinero - deboSinCustodia),
    dinero_empresa_antes_is: antesIS,
    dinero_empresa_prudente: mas90 == null ? null : r2(antesIS - mas90),
    total_tengo: totalTengo,
    total_debo: totalDebo,
    completo,
  };

  return {
    ok: true,
    generado: ahoraIso,
    completo,
    faltan,
    frescura,
    kpis,
    tengo,
    debo,
    fuera,
    avisos,
    cobros_en_banco: cobradasBanco,
    anticipos_sin_ejecutar: d13 ? d13.lineas : null,
    cuadre_banco: cuadre,
    provisional: cuadre.provisional,
    prestamos: pres ? {
      cuotas_30_dias: pres.total_cuotas_proximas,
      cuotas_proximas: pres.cuotas_proximas,
      calendario: [...pres.recibidos.prestamos, ...pres.concedidos.prestamos]
        .flatMap((p) => p.cuotas_pendientes.map((c) => ({ id: p.id, tipo: p.tipo, contraparte: p.contraparte, ...c })))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    } : null,
  };
}

module.exports = { calcularEscalera, cuadreBanco, cobrosEnBanco, esMovimientoBancario, periodoNomina, cargosTGSS, mesVtoCotizacion, normNombre, mismoNombre, periodoIvaSinLiquidar, diaLaborableAnterior, FASES_D11, CUENTA_BANCO, sumarDias };
