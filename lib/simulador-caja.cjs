// ============================================================
// lib/simulador-caja.cjs — simulador de escenarios del cash flow
// (encargo del 03/10/2026, puntos 6-8)
// ============================================================
// Mismo modelo que el prototipo aprobado (cashflow-simulador.html) y que
// ara-os/src/lib/simuladorCaja.js (el front lo usa para mover los mandos a
// mano; aquí se usa para el escenario «Real (automático)» y para guardar la
// previsión de cada mes). Si se cambia uno, cambiar el otro: los dos tests
// usan el mismo caso (cartera 549.375 € / 7.860 h).
//   · producción al mes = horas ÷ (1 + desvío) × € por hora prevista
//   · se cobra 2 meses después (día 20), material a 90 días, comisión al cobro
//   · operarios extra: +160 h y +2.800 €/mes
// ============================================================
"use strict";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mesSig = (mes, n = 1) => { const [y, m] = mes.split("-").map(Number); const i = m - 1 + n; return `${y + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const finDeMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const sumarDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const HORAS_OPERARIO_EXTRA = 160, COSTE_OPERARIO_EXTRA = 2800, FIN_TRAMO = "2027-07";

// Cartera por ejecutar: importe y horas previstas PENDIENTES (de las empezadas,
// lo que falta por sus horas) y su € por hora prevista.
function cartera(obras = []) {
  let pendiente = 0, horasPend = 0;
  for (const o of obras) {
    const prev = Number(o.horas_previstas) || 0, hechas = Number(o.horas_registradas) || 0, imp = Number(o.importe) || 0;
    const falta = prev > 0 ? Math.max(0, 1 - hechas / prev) : 1;
    pendiente += imp * falta; horasPend += prev * falta;
  }
  return { pendiente: r2(pendiente), horas_pendientes: r2(horasPend), eur_hora_prevista: horasPend > 0 ? r2(pendiente / horasPend) : null, n: obras.length };
}

function simular({ obras = [], historico = {}, hoy, mandos }) {
  const c = cartera(obras);
  const horasTot = (Number(mandos.horas) || 0) + HORAS_OPERARIO_EXTRA * (Number(mandos.extra) || 0);
  const eurH = Number(mandos.eurH) > 0 ? Number(mandos.eurH) : (c.eur_hora_prevista || 0);
  const prodMax = horasTot / (1 + (Number(mandos.desvio) || 0) / 100) * eurH;
  const mat = (Number(mandos.mat) || 0) / 100;
  const fijos = historico.fijos || {};
  const moOp = (Number(fijos.operarios) || 0) + COSTE_OPERARIO_EXTRA * (Number(mandos.extra) || 0);
  const comPct = historico.comision_pct ?? 0.2;
  const nueva = Number(mandos.nueva) || 0;
  const lagCobro = Number(mandos.mesesCobro) || 2;
  const movs = [], produccion = {}, beneficio = {};
  let resto = c.pendiente;
  const mesHoy = hoy.slice(0, 7);
  for (let m = mesHoy; m <= FIN_TRAMO; m = mesSig(m)) {
    resto += nueva;
    const dias = Number(finDeMes(m).slice(8, 10));
    const frac = m === mesHoy ? (dias - Number(hoy.slice(8, 10)) + 1) / dias : 1;
    const p = r2(Math.min(prodMax * frac, resto));
    resto -= p;
    produccion[m] = p;
    const b = (1 - mat) * p - moOp * frac;
    beneficio[m] = r2(b - Math.max(0, comPct * b) - ((Number(fijos.indirectos) || 0) + (Number(fijos.generales) || 0)) * frac);
    if (p > 0) {
      movs.push({ fila: "sim_cobros", fecha: `${mesSig(m, lagCobro)}-20`, importe: p, entra: true, concepto: `Obra ejecutada en ${m}`, fuente: "Simulador: cobro 2 meses después (día 5/20)", fiabilidad: "estimado" });
      movs.push({ fila: "sim_material", fecha: `${mesSig(m, 3)}-15`, importe: r2(mat * p), concepto: `Material de lo ejecutado en ${m}`, fuente: `Simulador: ${Math.round(mat * 100)} % pagado a 90 días`, fiabilidad: "estimado" });
      const com = r2(Math.max(0, comPct * ((1 - mat) * p - moOp * frac)));
      if (com > 0) movs.push({ fila: "sim_comision", fecha: `${mesSig(m, lagCobro)}-20`, importe: com, concepto: `Comisión de lo ejecutado en ${m}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
    }
    if (mandos.extra > 0) movs.push({ fila: "sim_operarios", fecha: `${m}-28`, importe: r2(COSTE_OPERARIO_EXTRA * mandos.extra * frac), concepto: `Operarios extra (${mandos.extra})`, fuente: "Simulador: 2.800 €/mes cada uno", fiabilidad: "estimado" });
  }
  let mesesCartera = null;
  if (prodMax > nueva) { let x = c.pendiente, n = 0; while (x > 0 && n < 120) { x += nueva - prodMax; n++; } mesesCartera = n; }
  return { movs, produccion, beneficio, prodMax: r2(prodMax), mesesCartera, cartera: c };
}

// Serie de caja: los movimientos conocidos del backend (13 semanas enteras y,
// después, los puntuales) + los recurrentes de cada mes tras las 13 semanas +
// lo simulado. Devuelve la caja propia a fin de cada mes.
function serieMensual(cf, sim, { is2026 = undefined } = {}) {
  const fin13 = cf.semanas[cf.semanas.length - 1].hasta;
  const conocidos = [...cf.semanas.flatMap((s) => s.movs), ...cf.meses.flatMap((m) => m.movs)]
    .filter((m) => !(is2026 !== undefined && m.fila === "is_2026"));
  const recurrentes = (cf.recurrentes_movs || []).filter((m) => m.fecha > fin13);
  const islas = is2026 != null && is2026 > 0 ? [{ fila: "is_2026", fecha: (cf.is_2026?.fecha || "2027-07-25"), importe: is2026, concepto: "IS 2026", fuente: "A mano en el simulador", fiabilidad: "estimado" }] : [];
  const todos = [...conocidos, ...recurrentes, ...(sim?.movs || []), ...islas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const meses = [];
  let saldo = cf.inicial.propio;
  for (let m = cf.hoy.slice(0, 7); m <= FIN_TRAMO; m = mesSig(m)) {
    const ms = todos.filter((x) => x.fecha.slice(0, 7) === m);
    const entra = r2(ms.filter((x) => x.entra).reduce((t, x) => t + x.importe, 0));
    const sale = r2(ms.filter((x) => !x.entra).reduce((t, x) => t + x.importe, 0));
    saldo = saldo == null ? null : r2(saldo + entra - sale);
    meses.push({ mes: m, entra, sale, saldo, movs: ms, produccion: sim?.produccion?.[m] ?? null, beneficio: sim?.beneficio?.[m] ?? null });
  }
  return { meses, movs: todos };
}

// «Real (automático)»: mandos recalculados con lo último de ARA-OS.
//   pnr = posicion-neta-real del último mes cerrado; anual = resultado-real-anual
function calibrar({ pnr, anual, hoy, fotoFresca }) {
  const cal = [];
  const d = pnr?.ok ? pnr.data : null;
  // Horas en obra al mes: media de los últimos 3 meses cerrados
  const cerrados = anual?.ok ? (anual.data.por_mes || []).filter((m) => !m.sin_datos && m.horas_obra > 0 && m.mes < Number(hoy.slice(5, 7))).slice(-3) : [];
  let horas = cerrados.length ? Math.round(cerrados.reduce((t, m) => t + m.horas_obra, 0) / cerrados.length) : (d ? Math.round(d.total_horas_mo) : null);
  cal.push({ mando: "horas", valor: horas, texto: cerrados.length ? `media de ${cerrados.length} mes(es)` : d ? "último mes cerrado" : "sin dato", fiabilidad: cerrados.length >= 3 ? "exacto" : "estimado" });
  // Obras terminadas en los últimos 6 meses
  const desde = sumarDias(hoy, -183);
  const term = d ? (d.obras || []).filter((o) => /^1[4-8]_/.test(o.fase || "") && o.fecha_fin && o.fecha_fin >= desde && Number(o.horas_previstas) > 0 && Number(o.horas_registradas) > 0) : [];
  const hp = term.reduce((t, o) => t + Number(o.horas_previstas), 0), hr = term.reduce((t, o) => t + Number(o.horas_registradas), 0);
  const desvio = hp > 0 ? Math.round((hr / hp - 1) * 100) : null;
  cal.push({ mando: "desvio", valor: desvio, texto: term.length ? `${term.length} obras terminadas en 6 meses` : "sin obras terminadas con horas", fiabilidad: term.length >= 5 ? "exacto" : "estimado" });
  const conMat = term.filter((o) => Number(o.importe) > 0);
  const impT = conMat.reduce((t, o) => t + Number(o.importe), 0), matT = conMat.reduce((t, o) => t + (Number(o.materiales_eur) || 0), 0);
  const mat = impT > 0 && matT > 0 ? Math.round(matT / impT * 100) : (d && Number(d.ingreso_mes_eur) > 0 ? Math.round(Number(d.gastos_materiales_eur) / Number(d.ingreso_mes_eur) * 100) : null);
  cal.push({ mando: "mat", valor: mat, texto: impT > 0 && matT > 0 ? `${conMat.length} obras terminadas (material imputado)` : "material del último mes ÷ obra ejecutada",
             fiabilidad: impT > 0 && matT > 0 ? "estimado" : "estimado", nota: "El material sin etiqueta de obra no cuenta aquí (va a generales)." });
  const obras = d ? (d.obras || []).filter((o) => /^0[5-9]_/.test(o.fase || "") && Number(o.importe) > 0) : [];
  const c = cartera(obras);
  cal.push({ mando: "eurH", valor: c.eur_hora_prevista, texto: `${c.n} obras · ${Math.round(c.horas_pendientes)} h previstas pendientes`, fiabilidad: c.n ? "exacto" : "sin_dato" });
  cal.push({ mando: "mesesCobro", valor: 2, texto: "regla de 2 meses + día 5/20 (sin fechas de cobro por obra todavía)", fiabilidad: "estimado" });
  const nomina = d?.coste_mo_fuente === "nomina";
  cal.push({ mando: "fijos", valor: d ? r2((d.coste_mo_eur || 0) + (d.nomina_indirectos_eur || 0) + (d.costes_generales_eur || 0)) : null,
             texto: d ? `${nomina ? "nómina" : "estimación"} de ${d.año}-${String(d.mes).padStart(2, "0")}: operarios ${r2(d.coste_mo_eur)} + indirectos ${r2(d.nomina_indirectos_eur)} + generales ${r2(d.costes_generales_eur)}` : "sin dato",
             fiabilidad: nomina ? "exacto" : "estimado" });
  if (!fotoFresca) cal.push({ mando: "caja", valor: null, texto: "foto de conciliación vieja o sin foto: la caja de partida es la contable", fiabilidad: "estimado" });
  const val = (k) => cal.find((x) => x.mando === k)?.valor;
  return {
    mandos: { esc: "automatico", nombre: "Real (automático)", horas: val("horas") ?? 760, desvio: val("desvio") ?? 45, extra: 0, mat: val("mat") ?? 27, nueva: 0, eurH: val("eurH"), mesesCobro: 2 },
    calibracion: cal,
    obras,
  };
}

module.exports = { cartera, simular, serieMensual, calibrar, mesSig, finDeMes, HORAS_OPERARIO_EXTRA, COSTE_OPERARIO_EXTRA, FIN_TRAMO };
