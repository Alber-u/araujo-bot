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
const { casarMovimientos } = require("./conciliacion-provisional.cjs");
const FOTO_MAX_HORAS = 36;                    // foto de movimientos sin conciliar: más vieja → no se ajusta
const DESFASE_ROJO = 5000;                    // desfase de conciliación que ya pinta rojo
const HISTORICO_CAMBIO_ROJO = 100;            // el descuadre histórico cambia más que esto → rojo

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const IVA_ANTICIPOS = 0.10;                   // 438 × 10/110 (rehabilitación de viviendas)
const FASES_T4 = ["12_INICIO_OBRA", "13_EN_EJECUCION", "14_FINALIZADA", "15_VISITA_INSPECTOR", "16_MONTAJE_CONTADORES", "17_COBRO_EMASESA"];
const FASES_D11 = ["12_INICIO_OBRA", "13_EN_EJECUCION"];
// D14: obra ejecutada (o ejecutándose) y aún sin cobrar → comisión comercial devengada
const FASES_D14 = ["13_EN_EJECUCION", "14_FINALIZADA", "15_VISITA_INSPECTOR", "16_MONTAJE_CONTADORES", "17_COBRO_EMASESA"];
// Todas las fases con OT (las de rentabilidad que hay que leer: D11 + D14)
const FASES_RENTAB = [...new Set([...FASES_D11, ...FASES_D14])];
const COMISION_COMERCIAL_DEF = 0.20;          // regla de Alberto (03/10): 20 % del beneficio de cada obra Plan 5
const TOLERANCIA_RECIBO = 0.05;               // ± 5 % para reconocer un cargo en el banco (nómina, TGSS)
const DIAS_COBRADO_SIN_EJECUTAR = 365;        // D13: solo facturas del último año
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
const fmtMesCorto = (am) => ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][Number(am.slice(5, 7)) - 1] || am;
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

// ── D13 · cobrado de obras sin ejecutar ──────────────────────
const listaNumeros = (v) => new Set(String(v == null ? "" : v).split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean));
function calcularD13(f, hoy, cfg, avisos) {
  const incluir = listaNumeros(cfg.cobrado_sin_ejecutar_incluir);
  const excluir = listaNumeros(cfg.cobrado_sin_ejecutar_excluir);
  const idsOO = idsFacturasOO(f.oo?.ok ? f.oo.data : null);
  // Obras con OT (fase ≥ 12): por ccpp_id y por número de factura de la hoja
  const conOT = new Set(), numsOT = new Set(), nombresOT = [];
  for (const grupo of Object.values(f.ot.data.grupos || {})) for (const o of grupo || []) {
    if (o.ccpp_id) conOT.add(o.ccpp_id);
    const n = String(o.numero_factura_holded || "").replace(/\s+/g, "").toUpperCase();
    if (n) numsOT.add(n);
    nombresOT.push(normNombre(o.comunidad));
  }
  // etiqueta (minúsculas) → ccpp_id
  const tagObra = new Map();
  for (const [ccpp, tags] of Object.entries(f.tags.data || {})) for (const t of tags) tagObra.set(String(t).toLowerCase(), ccpp);
  const desde = sumarDias(hoy, -DIAS_COBRADO_SIN_EJECUTAR);
  const detalle = [];
  let total = 0;
  for (const d of f.invoices.data || []) {
    const num = String(d.numero || "").replace(/\s+/g, "").toUpperCase();
    if (d.estado_logico !== "cobrada" || excluir.has(num) || idsOO.has(String(d.id))) continue;
    const forzada = incluir.has(num);
    if (!forzada && (!d.fecha || d.fecha < desde)) continue;
    const ccpp = (d.tags || []).map((t) => tagObra.get(String(t).toLowerCase())).find(Boolean) || null;
    if (!forzada) {
      if (!ccpp || conOT.has(ccpp) || numsOT.has(num)) continue;
      if (nombresOT.some((n) => mismoNombre(n, normNombre(d.cliente)))) continue;   // es de una obra con OT con otra etiqueta
    }
    const base = r2(Number(d.subtotal) || 0);
    if (!(base > 0)) continue;
    total += base;
    detalle.push({ concepto: `${d.numero} · ${d.cliente}`, numero: d.numero, fecha: d.fecha, ccpp_id: ccpp, importe: base,
                   via: forzada ? "config_dinero (cobrado_sin_ejecutar_incluir)" : "etiqueta de obra sin OT" });
  }
  detalle.sort((a, b) => b.importe - a.importe);
  if (detalle.length) avisos.push({ nivel: "ambar", texto: `Cobrado sin ejecutar: ${detalle.map((x) => `${x.numero} (${fmtEurCorto(x.importe)})`).join(", ")}. No es dinero propio hasta hacer la obra.` });
  return { total: r2(total), detalle };
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

// ¿Está cargado en el banco el recibo de la TGSS que vence en `mesVto`?
// Primero por concepto (cargosTGSS); si no, cualquier salida del banco entre el
// día 20 de ese mes y el día 5 del siguiente por el importe del último recibo
// conocido ± 5 % (Alberto, 03/10: el aviso salió en rojo el 02/10 con el
// recibo pagado). Devuelve el cargo o null.
function reciboTGSSCargado(movs, mesVto, referencia) {
  const tg = cargosTGSS(movs || []);
  const porConcepto = tg.cotizaciones.find((c) => mesVtoCotizacion(c) === mesVto);
  if (porConcepto) return { ...porConcepto, via: "concepto" };
  const ref = Number(referencia) || tg.cotizaciones[0]?.salida || 0;
  if (!(ref > 0)) return null;
  const desde = `${mesVto}-20`, hasta = sumarDias(`${mesVto}-01`, 36).slice(0, 8) + "05";
  const c = (movs || []).find((a) => a.salida > 0 && a.fecha >= desde && a.fecha <= hasta
    && Math.abs(a.salida - ref) <= ref * TOLERANCIA_RECIBO && !RE_NO_COTIZ.test(sinAcentos(a.descripcion)));
  return c ? { ...c, via: "importe" } : null;
}

// Transferencias de nómina en el banco («NOMINA …») desde `desde`. El
// concepto del Santander lleva «NOMINA» en cada transferencia a un trabajador.
const RE_NOMINA_BANCO = /n[oó]mina/i;
function pagosNominaBanco(movs, desde, hasta) {
  const xs = (movs || []).filter((a) => a.salida > 0 && a.fecha >= desde && (!hasta || a.fecha <= hasta)
    && RE_NOMINA_BANCO.test(sinAcentos(a.descripcion)));
  return { movimientos: xs, total: r2(xs.reduce((s, a) => s + a.salida, 0)), ultimo: xs.map((a) => a.fecha).sort().pop() || null };
}

// Mes anterior (AAAA-MM)
const mesAnterior = (mes) => sumarDias(`${mes}-01`, -1).slice(0, 7);

// D9 estimado: el 111 del trimestre anterior se ingresa hasta el día 20 del
// primer mes del trimestre siguiente; hasta entonces se debe entero. Del
// trimestre en curso, solo los meses ya cerrados (nómina devengada).
function estimar111(hoy, trimestral) {
  const [, m, d] = hoy.split("-").map(Number);
  const primerMes = (m - 1) % 3 === 0;
  const anterior = primerMes && d <= 20 ? r2(trimestral) : 0;
  const cerrados = (m - 1) % 3;                       // meses ya cerrados del trimestre en curso
  const enCurso = r2(trimestral / 3 * cerrados);
  const detalle = [];
  if (anterior) detalle.push({ concepto: "Trimestre anterior (se ingresa hasta el día 20)", importe: anterior });
  detalle.push({ concepto: `Trimestre en curso: ${cerrados} mes(es) cerrado(s)`, importe: enCurso });
  return { total: r2(anterior + enCurso), detalle };
}

// Frescura del banco. Holded da, por cuenta de tesorería, la fecha de la última
// sincronización (lastSyncAt, que /tesoreria pasa como `ultima_sincronizacion`).
// Esa es la que dice si el banco está al día; la del último apunte no (un día
// sin movimientos no es un banco sin sincronizar). Sin ella, se usa el último
// apunte, pero solo en ámbar.
function frescuraBanco(tes, banco, hoy) {
  let ultimoMov = null;
  if (banco?.ok) for (const a of banco.data || []) if (a.fecha && (!ultimoMov || a.fecha > ultimoMov)) ultimoMov = a.fecha;
  const syncs = (tes?.cuentas || []).map((c) => c.ultima_sincronizacion).filter(Boolean).sort();
  const ultimaSync = syncs.length ? syncs[0] : null;      // la cuenta más atrasada
  const dow = new Date(hoy + "T00:00:00Z").getUTCDay();
  const laborable = dow !== 0 && dow !== 6;
  const limite = laborable ? diaLaborableAnterior(hoy) : sumarDias(hoy, -3);
  let desactualizado = null, aviso = null;
  if (ultimaSync) {
    desactualizado = ultimaSync.slice(0, 10) < limite;
    if (desactualizado) aviso = { nivel: "rojo", texto: `Banco sin sincronizar desde ${fmtDM(ultimaSync.slice(0, 10))}${ultimaSync.length > 10 ? " " + ultimaSync.slice(11, 16) : ""}: caja y custodia pueden ir con retraso.` };
  } else {
    // Sin lastSyncAt no se sabe si el banco está al día: «sin dato», nunca
    // rojo (Alberto, 03/10). El último apunte solo se enseña como referencia.
    desactualizado = null;
    aviso = { nivel: "ambar", texto: `Sincronización del banco: sin dato (Holded no da la fecha).${ultimoMov ? ` Último movimiento: ${fmtDM(ultimoMov)}.` : ""}` };
  }
  return {
    banco_sincronizacion: ultimaSync ? (desactualizado ? "desactualizado" : "al_dia") : "sin_dato",
    banco_ultima_sincronizacion: ultimaSync,
    banco_ultimo_movimiento: ultimoMov,
    banco_desactualizado: desactualizado,
    nota: ultimaSync ? "Fecha de la última sincronización de Holded con el banco." : "Holded no ha dado la fecha de sincronización: se mira el último apunte.",
    aviso,
  };
}

// ── cálculo principal ─────────────────────────────────────────
// f = { tesoreria, clientes, custodias, obligaciones, ot, iva, rentab, invoices,
//       tags, prestamos, config, banco, nominas465 }
// opciones.pleo_manual: saldo de Pleo que Alberto ha puesto a mano en Mi panel
// (ara_pleo_saldo); solo se usa si ni Holded ni config_dinero lo dan.
function calcularEscalera(f, hoy, ahoraIso, opciones = {}) {
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

  // ── frescura del banco (última sincronización de Holded) ──
  // Foto de los movimientos sin conciliar (la sube la rutina diaria por
  // POST /movimientos-sin-conciliar). Trae también lastSyncAt del banco.
  const foto = f.foto?.ok && f.foto.data ? f.foto.data : null;
  const horasFoto = foto?.generado ? (Date.parse(ahoraIso) - Date.parse(foto.generado)) / 3600000 : null;
  const fotoFresca = foto && horasFoto != null && horasFoto <= FOTO_MAX_HORAS;
  const tesSync = tes && fotoFresca && foto.last_sync_at && !(tes.cuentas || []).some((c) => c.ultima_sincronizacion)
    ? { ...tes, cuentas: [{ ultima_sincronizacion: new Date(foto.last_sync_at).toISOString().slice(0, 16) }] } : tes;
  const { aviso: avisoFrescura, ...frescura } = frescuraBanco(tesSync, f.banco, hoy);
  const ultimoMov = frescura.banco_ultimo_movimiento;
  if (avisoFrescura) avisos.push(avisoFrescura);

  // ════════ TENGO ════════
  const tengo = [];

  // T1 Bancos
  if (tes) {
    const l = linea("T1", "Bancos", tes.total_eur, "Holded tesorería (572)", "exacto", ultimoMov || ahoraIso);
    l.detalle = (tes.cuentas || []).map((c) => ({ concepto: c.nombre, importe: c.saldo }));
    tengo.push(l);
  } else tengo.push(sinDato("T1", "Bancos", "Holded tesorería (572)", f.tesoreria?.error));

  // T2 Pleo. Una cuenta Pleo a 0 en Holded es que no la sincroniza (el 03/10
  // tenía 743 €): 0 no vale como dato. Orden: Holded (≠ 0) → config_dinero
  // (pleo_saldo) → lo puesto a mano en Mi panel → sin dato.
  {
    const pleoHolded = tes?.pleo && Math.abs(Number(tes.pleo.saldo) || 0) > 0.005 ? Number(tes.pleo.saldo) : null;
    const manual = opciones.pleo_manual != null && Number.isFinite(Number(opciones.pleo_manual)) ? Number(opciones.pleo_manual) : null;
    const porQue = tes?.pleo ? "Holded da la cuenta de Pleo a 0 (no la sincroniza)" : "Holded no tiene la cuenta de Pleo";
    if (pleoHolded != null) tengo.push(linea("T2", "Pleo", pleoHolded, "Holded tesorería (Pleo)", "exacto", ahoraIso));
    else if (cfgNum("pleo_saldo") != null) tengo.push(linea("T2", "Pleo", cfgNum("pleo_saldo"), "Hoja config_dinero (pleo_saldo)", "estimado", null, { nota: `${porQue}: saldo puesto a mano.` }));
    else if (manual != null) tengo.push(linea("T2", "Pleo", manual, "Mi panel (saldo de Pleo puesto a mano)", "estimado", null, { nota: `${porQue}: saldo puesto a mano en Mi panel.` }));
    else tengo.push(sinDato("T2", "Pleo", "Holded tesorería (Pleo)", tes ? `${porQue} y no hay saldo de Pleo puesto a mano (pleo_saldo en config_dinero o en Mi panel)` : f.tesoreria?.error));
  }

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
      // Diagnóstico: plazos ya cargados y cargos de la AEAT posteriores al
      // calendario, para ver a qué se ha aplicado cada uno.
      ...(obl.expedientes || []).flatMap((e) => (e.plazos || []).filter((p) => p.estado === "pagado")
        .map((p) => ({ concepto: `${e.concepto} · plazo ${fmtDM(p.fecha)} pagado${p.cargo ? ` (cargo ${fmtDM(p.cargo.fecha)})` : ""}`, importe: -r2(p.importe), informativo: true }))),
      ...(obl.expedientes || []).filter((e) => e.pendiente > 0 && e.cargos_aplicados?.length)
        .map((e) => ({ concepto: `${e.concepto} · ${e.detalle_pago}`, importe: -r2(e.cargos_aplicados.reduce((t, c) => t + c.importe, 0)), informativo: true })),
      ...(obl.cargos_aeat_posteriores || []).filter((c) => !c.usado)
        .map((c) => ({ concepto: `Cargo AEAT ${fmtDM(c.fecha)} sin aplicar a ninguna deuda · ${c.descripcion.slice(0, 50)}`, importe: -r2(c.importe), informativo: true })),
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

  // D6 Proveedores (400 + 410), sin las compras que ya se pagaron con Pleo:
  // en Holded siguen pendientes porque el pago de Pleo no se registra contra
  // la factura (o está duplicada con el gasto que exporta Pleo). Las marca
  // /holded/compras-pendientes (pagada_con_pleo). Sin esa fuente, se avisa.
  // Si Holded no deja ver que una compra se pagó con Pleo, se marca a mano en
  // config_dinero: compras_pagadas_pleo = número de la compra, … (03/10:
  // las tres de RiesgoZero no traían nada que dijera Pleo).
  if (saldos) {
    const aMano = listaNumeros(cfg.compras_pagadas_pleo);
    const marcada = (c) => c.pagada_con_pleo || aMano.has(String(c.num || "").replace(/\s+/g, "").toUpperCase());
    const pleo = f.compras?.ok ? (f.compras.data?.facturas || []).filter((c) => marcada(c) && Number(c.pendiente) > 0)
      .map((c) => (c.pagada_con_pleo ? c : { ...c, motivo_pleo: "marcada en config_dinero (compras_pagadas_pleo)" })) : [];
    const menosPleo = r2(pleo.reduce((s, c) => s + Number(c.pendiente), 0));
    const l = linea("D6", "Proveedores", -(saldo(saldos, "400") + saldo(saldos, "410")) - menosPleo, "Contabilidad 400/410 − compras pagadas con Pleo", f.compras?.ok ? "exacto" : "estimado", fechaCli);
    l.detalle = [
      { concepto: "400 Proveedores", importe: -saldo(saldos, "400") },
      { concepto: "410 Acreedores", importe: -saldo(saldos, "410") },
      ...pleo.map((c) => ({ concepto: `${c.proveedor} ${c.num} · pagada con Pleo (${c.motivo_pleo || "Pleo"})`, importe: -r2(c.pendiente) })),
    ];
    if (!f.compras?.ok) l.nota = "No se han podido leer las compras pendientes: no se han quitado las pagadas con Pleo.";
    debo.push(l);
  } else debo.push(sinDato("D6", "Proveedores", "Contabilidad 400/410", f.clientes?.error));

  // D7 Nóminas sin pagar
  // Regla (Alberto, 29/09 y 03/10):
  //  · Nómina DEL MES EN CURSO ya contabilizada (465, por el PERIODO de la
  //    descripción) → el saldo acreedor de la 465 menos lo ya transferido
  //    desde el devengo («NOMINA …» en el banco, aún sin conciliar).
  //  · Si no: ¿está pagada la del mes anterior? (transferencias «NOMINA …» en
  //    el banco desde el día 25 de ese mes por ≥ 95 % de la nómina, o la 465 a
  //    0). Pagada → 0: la del mes en curso no se estima hasta que se devengue
  //    (el 03/10 se contaban 11.000 € con la de septiembre pagada el 02/10).
  //  · Sin pagar → nomina_neta_mensual de config_dinero (o la 465).
  {
    const mes = hoy.slice(0, 7), mesAnt = mesAnterior(mes);
    const movsMes = f.nominas465?.ok ? (f.nominas465.data || []).filter((a) => periodoNomina(a) === mes) : [];
    const neta = cfgNum("nomina_neta_mensual");
    const s465 = saldos ? Math.max(0, -saldo(saldos, "465")) : null;
    const banco = f.banco?.ok ? f.banco.data || [] : null;
    if (movsMes.length && saldos) {
      const devengo = movsMes.filter((a) => a.haber > 0).map((a) => a.fecha).sort()[0] || `${mes}-01`;
      const pagos = banco ? pagosNominaBanco(banco, devengo, hoy) : { total: 0, movimientos: [] };
      const l = linea("D7", "Nóminas sin pagar", Math.max(0, s465 - pagos.total), "Contabilidad 465 (nómina del mes) − transferencias de nómina del banco", "exacto", fechaCli, { periodo: mes });
      l.detalle = [
        ...movsMes.map((a) => ({ concepto: `${fmtDM(a.fecha)} · ${a.descripcion.slice(0, 60)}`, importe: r2(a.haber - a.debe) })),
        ...(pagos.total > 0 ? [{ concepto: `Transferencias «NOMINA» en el banco desde ${fmtDM(devengo)} (sin conciliar en la 465)`, importe: -pagos.total }] : []),
      ];
      debo.push(l);
    } else {
      const pagos = banco ? pagosNominaBanco(banco, `${mesAnt}-25`, hoy) : null;
      const ref = neta != null ? neta : s465;
      const pagadaBanco = pagos && pagos.total > 0 && (ref == null || ref <= 0 || pagos.total >= ref * (1 - TOLERANCIA_RECIBO));
      const pagada465 = s465 != null && s465 <= 1 && f.nominas465?.ok;
      if (pagadaBanco || pagada465) {
        // Opción config_dinero nomina_prorrata = sí: la del mes en curso se
        // estima por los días transcurridos. Por defecto, nada hasta el devengo.
        const prorrata = esVerdad(cfg.nomina_prorrata) && neta != null;
        const [ya, ma] = mes.split("-").map(Number);
        const frac = Number(hoy.slice(8, 10)) / new Date(Date.UTC(ya, ma, 0)).getUTCDate();
        const imp = prorrata ? r2(neta * frac) : 0;
        const l = linea("D7", "Nóminas sin pagar", imp, pagadaBanco ? "Banco (transferencias de nómina)" : "Contabilidad 465", prorrata ? "estimado" : "exacto", pagadaBanco ? pagos.ultimo : fechaCli, { periodo: mes, sin_devengar: true });
        l.nota = `Nómina de ${mesAnt} pagada${pagadaBanco ? ` (banco, ${fmtEurCorto(pagos.total)} hasta el ${fmtDM(pagos.ultimo)})` : " (465 a 0)"}. ${prorrata ? `La de ${mes}, a prorrata de los días transcurridos (${Math.round(frac * 100)} %).` : `La de ${mes} no se cuenta hasta que se devengue.`}`;
        if (pagadaBanco) l.detalle = pagos.movimientos.map((a) => ({ concepto: `${fmtDM(a.fecha)} · ${a.descripcion.slice(0, 50)}`, importe: r2(a.salida), informativo: true }));
        debo.push(l);
      } else if (neta != null || (s465 != null && s465 > 1)) {
        // Sin pagar, o pagada en parte: lo que falta
        const imp = Math.max(0, (s465 != null && s465 > 1 ? s465 : neta) - (pagos?.total || 0));
        const l = linea("D7", "Nóminas sin pagar", imp, s465 != null && s465 > 1 ? "Contabilidad 465 − banco" : "Hoja config_dinero (nomina_neta_mensual) − banco", "estimado", ahoraIso, { periodo: mesAnt });
        l.nota = banco
          ? `No consta pagada entera en el banco la nómina de ${mesAnt}${pagos?.total ? ` (${fmtEurCorto(pagos.total)} en transferencias «NOMINA»)` : ""}.`
          : "No se han podido leer los movimientos del banco: no se sabe si la nómina está pagada.";
        debo.push(l);
      } else debo.push(sinDato("D7", "Nóminas sin pagar", "Contabilidad 465 / banco / config_dinero", "No consta pagada la nómina del mes anterior y no hay nomina_neta_mensual en la hoja config_dinero"));
    }
  }

  // D8 Seguridad Social pendiente. El recibo del mes M se carga el último día
  // hábil de M+1 (el de agosto, el 30/09). Regla (Alberto, 03/10): el recibo
  // del mes ANTERIOR está pendiente hasta que se carga a final del mes en
  // curso; se estima con el último recibo cargado. Una vez cargado, 0: la
  // cotización del mes en curso no se cuenta hasta que se devengue (igual que
  // D7). La 476 no manda: el 03/10 tenía 26 € de restos y D8 salía 26.
  // Otros cargos de la TGSS (cuotas de un aplazamiento, a mitad de mes) NO son
  // cotización: se separan y se avisa.
  {
    const s476 = saldos ? -saldo(saldos, "476") : null;
    const { cotizaciones, otros, regla } = f.banco?.ok ? cargosTGSS(f.banco.data || []) : { cotizaciones: [], otros: [] };
    if (otros.length) {
      const u = otros[0];
      avisos.push({ nivel: "ambar", texto: `Cargos de la TGSS que no son el recibo de cotizaciones (último: ${r2(u.salida)} € el ${fmtDM(u.fecha)}): parecen un aplazamiento de la Seguridad Social. No cuentan en D8; si es un aplazamiento, añadirlo a la hoja prestamos (recibido, con sus cuotas).` });
    }
    const detOtros = otros.map((a) => ({ concepto: `No es cotización · ${fmtDM(a.fecha)} · ${a.descripcion.slice(0, 50)}`, importe: r2(a.salida), informativo: true }));
    const det476 = s476 != null && Math.abs(s476) > 0.005 ? [{ concepto: "Contraste: saldo de la 476 en Holded", importe: r2(s476), informativo: true }] : [];
    if (cotizaciones.length) {
      const ult = cotizaciones[0];
      const mes = hoy.slice(0, 7);
      const cargado = reciboTGSSCargado(f.banco.data || [], mes, ult.salida);
      const pendiente = cargado ? 0 : ult.salida;
      const l = linea("D8", "Seguridad Social pendiente", pendiente, "Último recibo de cotizaciones TGSS en el banco", "estimado", ult.fecha, { recibo_vencido_cargado: !!cargado });
      if (regla === "fecha") l.nota = "Ningún cargo trae el concepto «TGSS … COTIZACION»: el recibo se ha identificado por el día del cargo.";
      l.detalle = [
        { concepto: `Último recibo de cotizaciones (${fmtDM(ult.fecha)})`, importe: r2(ult.salida), informativo: true },
        cargado
          ? { concepto: `Recibo de ${fmtMesCorto(mesAnterior(mes))} ya cargado el ${fmtDM(cargado.fecha)}; el de ${fmtMesCorto(mes)} no se cuenta hasta que se devengue`, importe: 0 }
          : { concepto: `Pendiente: recibo de ${fmtMesCorto(mesAnterior(mes))} (se carga a final de ${fmtMesCorto(mes)})`, importe: r2(pendiente) },
        ...det476,
        ...detOtros,
      ];
      debo.push(l);
    } else if (s476 != null && s476 > 1) {
      const l = linea("D8", "Seguridad Social pendiente", s476, "Contabilidad 476", "estimado", fechaCli);
      l.nota = "No se encuentra el recibo de cotizaciones en el banco: se usa el saldo de la 476.";
      l.detalle = detOtros;
      debo.push(l);
    } else {
      const l = sinDato("D8", "Seguridad Social pendiente", "Recibos TGSS / contabilidad 476", f.banco?.ok ? "No se encuentra el recibo de cotizaciones en el banco ni hay saldo en la 476" : f.banco?.error);
      l.detalle = detOtros;
      debo.push(l);
    }
  }

  // D9 Retenciones IRPF (modelo 111). Lo retenido y aún sin ingresar: el
  // trimestre en curso y el anterior hasta su día 20 (arrastre). Si la 4751 de
  // Holded no tiene las retenciones (el 03/10 daba 0 con el 3T por pagar el
  // 20/10), se estima con el trimestre de referencia —irpf_111_trimestral o
  // irpf_mensual × 3 de config_dinero, o el último 111 pagado en el banco—:
  // trimestre anterior entero hasta su vencimiento + meses ya cerrados del
  // trimestre en curso. Nunca 0 sin avisar.
  {
    const m111 = (obl?.periodicos || []).find((p) => p.modelo === "111");
    const contable = m111 ? r2((m111.devengado_trimestre || 0) + (m111.arrastre || 0)) : null;
    const refCfg = cfgNum("irpf_111_trimestral") != null ? cfgNum("irpf_111_trimestral")
      : cfgNum("irpf_mensual") != null ? r2(cfgNum("irpf_mensual") * 3) : null;
    const refBanco = Number(m111?.ultimo_pago_banco?.importe) > 0 ? Number(m111.ultimo_pago_banco.importe) : null;
    const ref = refCfg != null ? refCfg : refBanco;
    if (m111 && contable > 1) {
      const l = linea("D9", "Retenciones IRPF (modelo 111)", contable, "Contabilidad 4751 (/obligaciones)", "estimado", obl.generado);
      l.detalle = [{ concepto: `Retenido en el ${m111.periodo}`, importe: m111.devengado_trimestre }, { concepto: "Trimestres anteriores sin ingresar", importe: m111.arrastre }];
      debo.push(l);
    } else if (ref != null) {
      const est = estimar111(hoy, ref);
      const l = linea("D9", "Retenciones IRPF (modelo 111)", est.total, refCfg != null ? "Hoja config_dinero (irpf_111_trimestral / irpf_mensual)" : "Último modelo 111 pagado en el banco", "estimado", m111?.ultimo_pago_banco?.fecha || ahoraIso);
      l.nota = `${m111 ? "La 4751 de Holded no tiene las retenciones" : "/obligaciones no trae el modelo 111"}: estimado con ${fmtEurCorto(ref)} por trimestre.`;
      l.detalle = est.detalle;
      avisos.push({ nivel: "ambar", texto: `Retenciones IRPF (111) estimadas en ${fmtEurCorto(est.total)}: la 4751 de Holded está a 0. Contabilizar las retenciones de las nóminas o revisar irpf_111_trimestral en config_dinero.` });
      debo.push(l);
    } else if (m111) {
      debo.push(sinDato("D9", "Retenciones IRPF (modelo 111)", "Contabilidad 4751", "La 4751 de Holded está a 0 y no hay irpf_111_trimestral (ni irpf_mensual) en config_dinero ni un 111 pagado en el banco."));
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

  // D12 Póliza de crédito dispuesta
  {
    const sp = saldos && hayCuenta(saldos, CUENTA_POLIZA) ? saldo(saldos, CUENTA_POLIZA) : null;
    const manual = cfgNum("poliza_dispuesta");
    if (sp != null && sp < -1) debo.push(linea("D12", "Póliza de crédito dispuesta", -sp, `Contabilidad ${CUENTA_POLIZA}`, "exacto", fechaCli));
    else if (manual != null) debo.push(linea("D12", "Póliza de crédito dispuesta", manual, "Hoja config_dinero (poliza_dispuesta)", "estimado", null, { nota: "Holded da la póliza a 0: cifra confirmada a mano." }));
    else debo.push(sinDato("D12", "Póliza de crédito dispuesta", `Holded ${CUENTA_POLIZA}`, "Holded da la póliza a 0 y no se sabe si es real. Confirmarla y ponerla en config_dinero (poliza_dispuesta)."));
  }

  // D13 Cobrado sin ejecutar (regla de Alberto, 30/09: lo cobrado de una obra
  // que aún no se ha hecho no es propio hasta ejecutarla). Facturas COBRADAS
  // del último año ligadas por etiqueta de Holded a una obra de ARA-OS que no
  // tiene OT (fase < 12). Base sin IVA. Cuando la obra pasa a fase 12, sale de
  // aquí y entra en T4 (presupuesto − facturado). config_dinero:
  //   cobrado_sin_ejecutar_incluir = F260049, …  (facturas sin etiqueta de obra)
  //   cobrado_sin_ejecutar_excluir = F2600xx, …
  if (f.invoices?.ok && f.ot?.ok && f.tags?.ok) {
    const r = calcularD13(f, hoy, cfg, avisos);
    const l = linea("D13", "Cobrado sin ejecutar (sin IVA)", r.total, "Holded facturas cobradas de obras sin OT (fase < 12)", "estimado", ahoraIso);
    l.detalle = r.detalle;
    debo.push(l);
  } else debo.push(sinDato("D13", "Cobrado sin ejecutar (sin IVA)", "Holded facturas + ARA-OS órdenes de trabajo",
    [f.invoices, f.ot, f.tags].find((x) => !x?.ok)?.error || "sin facturas, OT o etiquetas"));

  // D14 Comisión comercial pendiente: el 20 % del beneficio de cada obra Plan 5
  // ejecutada (o ejecutándose) y aún no cobrada (fases 13-17). Se factura al
  // cobrar la obra, así que es una deuda futura cierta. % en config_dinero
  // (comision_comercial_pct, 20 por defecto). Beneficio: rentabilidad-obra.
  if (f.ot?.ok) {
    const pctCfg = cfgNum("comision_comercial_pct");
    const pct = pctCfg != null ? (pctCfg > 1 ? pctCfg / 100 : pctCfg) : COMISION_COMERCIAL_DEF;
    const cobradas = new Set((t4?.detalle || []).filter((d) => d.importe === 0 && d.facturas.length && d.facturas.every((x) => x.estado === "cobrada")).map((d) => d.ccpp_id));
    const obras = FASES_D14.flatMap((fase) => (f.ot.data.grupos?.[fase] || []).map((o) => ({ ...o, fase })));
    const det = [];
    let total = 0, fallos = 0;
    for (const o of obras) {
      if (cobradas.has(o.ccpp_id)) { det.push({ concepto: `${o.comunidad} · ya cobrada`, fase: o.fase, importe: 0, informativo: true }); continue; }
      const r = f.rentab?.[o.ccpp_id];
      if (!r || !r.ok) { fallos++; det.push({ concepto: o.comunidad, fase: o.fase, importe: null, nota: r?.error || "sin respuesta" }); continue; }
      const ben = Number(r.data.real?.beneficio_real);
      const imp = Number.isFinite(ben) ? r2(Math.max(0, ben) * pct) : 0;
      total += imp;
      det.push({ concepto: o.comunidad, fase: o.fase, ccpp_id: o.ccpp_id, beneficio: Number.isFinite(ben) ? r2(ben) : null, importe: imp,
                 ...(r.viejo_min != null ? { nota: `dato de hace ${r.viejo_min} min (la última consulta no respondió)` } : {}) });
    }
    det.sort((a, b) => (b.importe || 0) - (a.importe || 0));
    const l = linea("D14", `Comisión comercial pendiente (${Math.round(pct * 100)} % del beneficio)`, fallos && fallos === obras.length ? null : total,
      "/holded/rentabilidad-obra (fases 13-17 sin cobrar)", "estimado", ahoraIso);
    l.detalle = det;
    if (fallos) { l.incompleta = true; l.nota = `${fallos} obra(s) sin dato de rentabilidad.`; }
    if (pctCfg == null) l.nota = [l.nota, `Sin comision_comercial_pct en config_dinero: ${Math.round(COMISION_COMERCIAL_DEF * 100)} %.`].filter(Boolean).join(" ");
    debo.push(l);
  } else debo.push(sinDato("D14", "Comisión comercial pendiente", "/holded/rentabilidad-obra", f.ot?.error));

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

  // F4 Neto con la sociedad vinculada: lo que le debemos (préstamos recibidos)
  // contra lo que nos debe (préstamos concedidos + precio aplazado del local
  // 13, que es suyo). Informativo: los préstamos ya están en T5/D10 y el local
  // 13 va en F2. La sociedad: config_dinero `sociedad_vinculada`; si no está,
  // la contraparte que aparece a la vez como prestamista y prestataria.
  if (pres) {
    const norm = (s) => sinAcentos(String(s || "")).toLowerCase().replace(/[^a-z0-9]/g, "");
    const conc = pres.concedidos.prestamos, reci = pres.recibidos.prestamos;
    let nombre = cfg.sociedad_vinculada != null ? String(cfg.sociedad_vinculada).trim() : "";
    if (!nombre) nombre = (conc.find((p) => reci.some((q) => norm(q.contraparte) && norm(q.contraparte) === norm(p.contraparte))) || {}).contraparte || "";
    const es = (p) => nombre && norm(p.contraparte).includes(norm(nombre));
    if (nombre) {
      const debemos = r2(reci.filter(es).reduce((s, p) => s + (Number(p.saldo_vivo) || 0), 0));
      const prest = r2(conc.filter(es).reduce((s, p) => s + (Number(p.saldo_vivo) || 0), 0));
      const local13 = cli?.local13?.pendiente != null ? r2(cli.local13.pendiente) : null;
      fuera.push({
        id: "F4", concepto: `Neto con ${nombre}`, importe: local13 == null ? null : r2(prest + local13 - debemos),
        fuente: "Hoja prestamos + /holded/patrimonio (local 13)",
        nota: "Informativo: positivo = nos debe más de lo que le debemos. Los préstamos ya cuentan en T5 y D10.",
        detalle: [
          { concepto: `Nos debe: préstamos`, importe: prest },
          { concepto: "Nos debe: local 13 (precio aplazado)", importe: local13 },
          { concepto: "Le debemos: préstamos", importe: -debemos },
        ],
      });
    } else fuera.push({ id: "F4", concepto: "Neto con la sociedad vinculada", importe: null, fiabilidad: "sin_dato", nota: "Poner su nombre en config_dinero (sociedad_vinculada)." });
  }

  // ════════ acumulado «te queda» y totales ════════
  let acum = 0;
  for (const l of tengo) { acum += l.importe || 0; l.acumulado = r2(acum); }
  for (const l of debo) { acum -= l.importe || 0; l.acumulado = r2(acum); }

  // ════════ movimientos del banco sin conciliar (encargo del 03/10) ════════
  // Se casan de forma provisional con lo pendiente (sin tocar Holded) para dar
  // el valor REAL además del contable. Sin foto fresca, no se ajusta nada.
  let conc = null;
  if (fotoFresca) {
    const L = (id) => [...tengo, ...debo].find((l) => l.id === id)?.importe;
    const aMano = listaNumeros(cfg.compras_pagadas_pleo);
    const yaCobradas = new Set(cobradasBanco.map((c) => c.numero));
    conc = casarMovimientos(foto, {
      hoy,
      lineas: { D7: L("D7"), D8: L("D8"), D3: L("D3"), D6: L("D6"), T3: L("T3") },
      nominas: f.nominasPendientes?.ok ? f.nominasPendientes.data : [],
      recibo_tgss: L("D8") > 0 ? { importe: L("D8"), vence: sumarDias(`${sumarDias(`${hoy.slice(0, 7)}-01`, 32).slice(0, 7)}-01`, -1) } : null,
      plazos_aeat: (obl?.expedientes || []).flatMap((e) => (e.plazos || []).filter((p) => p.estado !== "pagado").map((p) => ({ fecha: p.fecha, importe: Number(p.importe), concepto: e.concepto }))),
      compras: f.compras?.ok ? (f.compras.data?.facturas || []).filter((c) => !c.pagada_con_pleo && !aMano.has(String(c.num || "").replace(/\s+/g, "").toUpperCase()) && Number(c.pendiente) > 0)
        .map((c) => ({ num: c.num, proveedor: c.proveedor, pendiente: Number(c.pendiente), fecha: c.fecha })) : [],
      facturas: f.invoices?.ok ? (f.invoices.data || []).filter((d) => Number(d.pdte_cobro_eur) > 0.01 && !yaCobradas.has(d.numero))
        .map((d) => ({ numero: d.numero, cliente: d.cliente, pendiente: Number(d.pdte_cobro_eur), fecha: d.fecha, mas90: !!(d.fecha && d.fecha < sumarDias(hoy, -90)) })) : [],
    });
    conc.foto = { generado: foto.generado, cuenta: foto.cuenta || null, last_sync_at: foto.last_sync_at || null };
    for (const a of conc.ambiguos) avisos.push({ nivel: "ambar", texto: `Movimiento del ${fmtDM(a.fecha)} (${fmtEurCorto(a.importe)}) casa con varios pendientes (${a.regla}): no se ajusta.` });
  } else {
    avisos.push({ nivel: "ambar", texto: foto ? `Desfase de conciliación sin medir desde ${fmtDM(String(foto.generado).slice(0, 10))}: la foto de movimientos sin conciliar tiene más de ${FOTO_MAX_HORAS} h. Valor real = contable.`
      : "Desfase de conciliación sin medir: no hay foto de movimientos sin conciliar. Valor real = contable." });
  }

  // 10.2.1 · banco por delante de los movimientos → cifras provisionales
  const cuadre = cuadreBanco(f.cuadre, cfgNum("descuadre_historico_572") == null ? null
    : { importe: cfgNum("descuadre_historico_572"), fecha: cfg["descuadre_historico_572_fecha"] != null ? String(cfg["descuadre_historico_572_fecha"]).trim() || null : null });
  // 3.4 · Con foto, la diferencia banco − libro se separa en desfase de
  // conciliación (movimientos aún sin conciliar) y descuadre histórico (el
  // resto). El histórico va en ámbar con su fecha; rojo solo si cambia más de
  // 100 € respecto al guardado (descuadre_historico_572). El desfase, rojo si
  // pasa de 5.000 € o hay un movimiento de más de 7 días que casa con un pendiente.
  if (conc && cuadre.diferencia_total != null) {
    const hist = r2(cuadre.diferencia_total - conc.desfase_conciliacion);
    const ref = cfgNum("descuadre_historico_572");
    const refFecha = cfg["descuadre_historico_572_fecha"] != null ? String(cfg["descuadre_historico_572_fecha"]).trim() : "";
    const refConSigno = ref == null ? null : (hist < 0 ? -Math.abs(ref) : Math.abs(ref));
    const cambia = refConSigno != null && Math.abs(hist - refConSigno) > HISTORICO_CAMBIO_ROJO;
    cuadre.desfase_conciliacion = conc.desfase_conciliacion;
    cuadre.descuadre_historico_actual = hist;
    cuadre.estado = cambia ? "historico_cambia" : "explicado";
    cuadre.provisional = cambia;
    const rojoDesfase = Math.abs(conc.desfase_conciliacion) > DESFASE_ROJO || conc.casados_mas_7_dias > 0;
    avisos.unshift({ nivel: rojoDesfase ? "rojo" : "ambar", texto: `Desfase de conciliación: ${conc.n_movimientos} movimientos del banco sin conciliar por ${fmtEurCorto(conc.desfase_conciliacion)}${conc.casados_mas_7_dias ? ` (${conc.casados_mas_7_dias} con más de 7 días que casan con un pendiente)` : ""}. ${fmtEurCorto(conc.ajustado_total)} ajustados en el valor real.` });
    avisos.push(cambia
      ? { nivel: "rojo", texto: `El descuadre histórico banco − libro ha cambiado: ${fmtEurCorto(hist)} frente a ${fmtEurCorto(refConSigno)} guardados${refFecha ? ` el ${refFecha}` : ""}. Algo nuevo se ha descuadrado.` }
      : { nivel: "ambar", texto: `Descuadre histórico banco − libro: ${fmtEurCorto(hist)}${ref == null ? ` (guardarlo en config_dinero: descuadre_historico_572 = ${Math.abs(hist).toFixed(2)} y su fecha)` : refFecha ? ` (guardado el ${refFecha})` : ""}.` });
  } else if (cuadre.actualizar_historico_a != null) {
    avisos.push({ nivel: "ambar", texto: `Actualizar descuadre_historico_572 a ${cuadre.actualizar_historico_a.toFixed(2)} (la diferencia total ya es menor que el histórico guardado: se ha conciliado algo antiguo).` });
  }
  if (!conc && cuadre.estado === "descuadre_menor") {
    avisos.push({ nivel: "ambar", texto: `Saldo del banco y movimientos difieren en ${fmtEurCorto(Math.abs(cuadre.diferencia))} (movimientos pequeños sin conciliar).` });
  }
  if (!conc && cuadre.estado === "no_cuadra") {
    avisos.unshift({ nivel: "rojo", texto: `Saldo del banco y movimientos no cuadran por ${fmtEurCorto(Math.abs(cuadre.diferencia))}: cifras de caja y custodia provisionales.` });
    // 10.2.3: sin cargo de la TGSS en los movimientos, D8 se deja pero es provisional
    const d8 = debo.find((l) => l.id === "D8");
    if (d8 && d8.importe != null && d8.recibo_vencido_cargado === false) d8.provisional = true;
  }

  // D7 con importe y el banco por delante del libro (saldo del banco que no
  // cuadra con los apuntes, o sincronizado después del último apunte): las
  // transferencias de nómina pueden estar hechas y sin conciliar.
  {
    const d7 = debo.find((l) => l.id === "D7");
    const ultApunte = cuadre.ultimo_apunte;
    const sync = frescura.banco_ultima_sincronizacion;
    const porDelante = (cuadre.estado === "descuadre_menor" || cuadre.estado === "no_cuadra") || (sync && ultApunte && sync.slice(0, 10) > ultApunte);
    if (d7?.importe > 0 && porDelante && !(conc && conc.ajustes.D7 >= d7.importe - 0.01)) {
      avisos.push({ nivel: "ambar", texto: `Nóminas (${fmtEurCorto(d7.importe)}): puede que la nómina ya esté pagada y sin conciliar (el saldo del banco es posterior al último apunte del libro${ultApunte ? `, ${fmtDM(ultApunte)}` : ""}).` });
    }
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
    // Valor contable (la escalera tal cual) y valor real (con los movimientos
    // del banco sin conciliar casados). Sin foto fresca, real = contable.
    valor_contable: { normal: antesIS, prudente: mas90 == null ? null : r2(antesIS - mas90) },
    valor_real: {
      normal: r2(antesIS + (conc ? conc.ajuste_valor : 0)),
      prudente: mas90 == null ? null : r2(antesIS + (conc ? conc.ajuste_valor : 0) - Math.max(0, mas90 - (conc ? conc.ajustes.T3_mas90 : 0))),
      ajustado: !!conc,
    },
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
    cuadre_banco: cuadre,
    provisional: cuadre.provisional,
    ajuste_conciliacion: conc,
    prestamos: pres ? {
      cuotas_30_dias: pres.total_cuotas_proximas,
      cuotas_proximas: pres.cuotas_proximas,
      calendario: [...pres.recibidos.prestamos, ...pres.concedidos.prestamos]
        .flatMap((p) => p.cuotas_pendientes.map((c) => ({ id: p.id, tipo: p.tipo, contraparte: p.contraparte, ...c })))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    } : null,
  };
}

module.exports = { calcularEscalera, cuadreBanco, cobrosEnBanco, esMovimientoBancario, periodoNomina, cargosTGSS, mesVtoCotizacion, reciboTGSSCargado, pagosNominaBanco, mesAnterior, estimar111, frescuraBanco, normNombre, mismoNombre, periodoIvaSinLiquidar, diaLaborableAnterior, FASES_D11, FASES_D14, FASES_RENTAB, CUENTA_BANCO, TOLERANCIA_RECIBO, sumarDias };
