// ============================================================
// lib/simulador-caja.cjs — simulador de escenarios del cash flow
// (encargo del 03/10/2026, puntos 6-9 · prototipo v2 aprobado)
// ============================================================
// Mismo modelo que el prototipo v2 (cashflow-simulador.html) y que
// ara-os/src/lib/simuladorCaja.js (se genera a partir de este archivo: si se
// cambia uno, cambiar el otro; los dos tests usan el mismo caso).
//
// Calendario OBRA A OBRA de la cartera aceptada (fases 05-09 sin terminar):
//   · orden: en curso → tramitadas (09) → 08 → 07 → 06 → 05
//   · las 05-08 no se pueden empezar hasta que EMASESA las tramite:
//     08 a +1×, 07 a +2×, 06 a +3×, 05 a +4× el mando «EMASESA tarda por fase»
//   · duración = horas previstas pendientes × (1 + desvío) ÷ horas/mes
//   · si no hay obra tramitada, la cuadrilla espera: horas perdidas (se pagan)
//   · cobro = fin + 2 meses, el siguiente día 5 o 20
//   · material = % del presupuesto, pagado 3 meses después de empezar
//   · comisión comercial = 20 % del beneficio de la obra, al cobro
//   · operarios extra: +160 h y +2.800 €/mes cada uno
//   · equipos trabajando a la vez: las horas/mes se reparten entre equipos y
//     cada obra va al primer equipo libre (respetando cuándo está tramitada)
// El tiempo va en meses desde hoy (t = 0 hoy); las fechas se sacan del
// calendario real.
// ============================================================
"use strict";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mesSig = (mes, n = 1) => { const [y, m] = mes.split("-").map(Number); const i = m - 1 + n; return `${y + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const finDeMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const sumarDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const HORAS_OPERARIO_EXTRA = 160, COSTE_OPERARIO_EXTRA = 2800, FIN_MINIMO = "2027-07", DIAS_MES = 30.4375;

// t (meses desde hoy) → fecha ISO
const fechaDeT = (hoy, t) => sumarDias(hoy, Math.round(t * DIAS_MES));

// Regla de cobro (Alberto, 03/10): 2 meses después de terminar, siguiente día 5 o 20
function fechaCobroObra(finIso) {
  const [y, m, d] = finIso.split("-").map(Number);
  const mas2 = mesSig(`${y}-${String(m).padStart(2, "0")}`, 2);
  const dia = Math.min(d, Number(finDeMes(mas2).slice(8, 10)));
  if (dia <= 5) return `${mas2}-05`;
  if (dia <= 20) return `${mas2}-20`;
  return `${mesSig(mas2, 1)}-05`;
}

const faseNum = (o) => Number(String(o.fase || "").slice(0, 2)) || 0;
// avance (0-1) de una obra: horas registradas ÷ previstas
const avance = (o) => { const p = Number(o.horas_previstas) || 0; return p > 0 ? Math.min(1, (Number(o.horas_registradas) || 0) / p) : 0; };

// Cartera por ejecutar: importe y horas previstas PENDIENTES
// Terminada = todas sus horas previstas hechas (100 %): no es cartera pendiente;
// va al bloque «terminadas, pendientes de cobro» (Alberto, 03/10).
const terminada = (o) => Number(o.horas_previstas) > 0 && avance(o) >= 0.999;
function cartera(obras = []) {
  let pendiente = 0, horasPend = 0, sinPto = 0;
  for (const o of obras.filter((x) => !terminada(x))) {
    const falta = 1 - avance(o);
    pendiente += (Number(o.importe) || 0) * falta; horasPend += (Number(o.horas_previstas) || 0) * falta;
    if (!(Number(o.importe) > 0)) sinPto++;
  }
  return { pendiente: r2(pendiente), horas_pendientes: r2(horasPend), eur_hora_prevista: horasPend > 0 ? r2(pendiente / horasPend) : null,
           n: obras.filter((x) => !terminada(x)).length, sin_presupuesto: sinPto, terminadas: obras.filter(terminada).length };
}

// simular({ obras, historico, hoy, mandos: { horas, desvio, extra, mat, tram, equipos } })
function simular({ obras = [], historico = {}, hoy, mandos }) {
  const H = (Number(mandos.horas) || 0) + HORAS_OPERARIO_EXTRA * (Number(mandos.extra) || 0);
  const k = 1 + (Number(mandos.desvio) || 0) / 100, mat = (Number(mandos.mat) || 0) / 100;
  const tram = mandos.tram == null ? 1 : Number(mandos.tram) || 0;
  const fijos = historico.fijos || {};
  const moOp = (Number(fijos.operarios) || 0) + COSTE_OPERARIO_EXTRA * (Number(mandos.extra) || 0);
  const costeH = H > 0 ? moOp / H : 0;
  const comPct = historico.comision_pct ?? 0.2;
  // orden: en curso primero, luego por fase de mayor a menor
  // Terminadas al 100 %: fuera del calendario; se cobran por la regla desde su
  // fin (último día con horas, o hoy) y pagan su comisión al cobro.
  const terminadas = obras.filter(terminada).map((o) => {
    const fin = o.fecha_fin && o.fecha_fin <= hoy ? String(o.fecha_fin).slice(0, 10) : hoy;
    const imp = Number(o.importe) || 0;
    const ben = imp * (1 - mat) - (Number(o.horas_registradas) || 0) * costeH;
    return { nombre: o.nombre, fase: o.fase, importe: r2(imp), sin_presupuesto: !(imp > 0), fin, cobro: imp > 0 ? fechaCobroObra(fin) : null, comision: r2(Math.max(0, comPct * ben)) };
  });
  // Equipos: cada uno con su parte de las horas/mes y su propia cola
  const E = Math.max(1, Math.min(6, Math.round(Number(mandos.equipos) || 1)));
  const He = H / E;
  const libre = Array(E).fill(0), esperaEq = Array(E).fill(0);
  const orden = obras.filter((o) => !terminada(o)).map((o, i) => ({ ...o, _i: i })).sort((a, b) => (avance(b) > 0) - (avance(a) > 0) || faseNum(b) - faseNum(a) || a._i - b._i);
  let t = 0, idle = 0;
  const prog = [];
  for (const o of orden) {
    const av = avance(o), f = faseNum(o);
    const ready = f >= 9 || av > 0 ? 0 : (9 - f) * tram;
    const hrs = (Number(o.horas_previstas) || 0) * (1 - av) * k;
    const imp = (Number(o.importe) || 0) * (1 - av);
    // primer equipo libre (el que antes pueda empezarla)
    let eq = 0;
    for (let e = 1; e < E; e++) if (Math.max(libre[e], ready) < Math.max(libre[eq], ready)) eq = e;
    const t0 = Math.max(libre[eq], ready);
    const espera = t0 - libre[eq];
    idle += espera * He; esperaEq[eq] += espera;
    const t1 = He > 0 ? t0 + hrs / He : t0;
    const desdeLibre = libre[eq];
    libre[eq] = t1;
    t = Math.max(t, t1);
    const ben = imp * (1 - mat) - hrs * costeH;
    const inicio = fechaDeT(hoy, t0), fin = fechaDeT(hoy, t1);
    prog.push({ nombre: o.nombre, fase: o.fase, importe: r2(imp), sin_presupuesto: !(Number(o.importe) > 0), horas: r2(hrs), avance_pct: Math.round(av * 100),
                equipo: eq + 1, t0: r2(t0), t1: r2(t1), espera: r2(espera), espera_desde: espera > 0 ? fechaDeT(hoy, desdeLibre) : null,
                inicio, fin, cobro: imp > 0 ? fechaCobroObra(fin) : null,
                beneficio: r2(ben), comision: r2(Math.max(0, comPct * ben)) });
  }
  // movimientos con fecha
  const movs = [];
  for (const p of terminadas) {
    if (!(p.importe > 0)) continue;
    movs.push({ fila: "sim_cobros", fecha: p.cobro, importe: p.importe, entra: true, concepto: `${p.nombre} (terminada, pendiente de cobro)`, fuente: `Simulador: 100 % de horas hechas, fin ${p.fin}, cobro 2 meses + día 5/20`, fiabilidad: "estimado" });
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  for (const p of prog) {
    if (!(p.importe > 0)) continue;
    movs.push({ fila: "sim_cobros", fecha: p.cobro, importe: p.importe, entra: true, concepto: `${p.nombre} (fase ${String(p.fase).slice(0, 2)})`, fuente: `Simulador: termina ${p.fin}, cobro 2 meses + día 5/20`, fiabilidad: "estimado" });
    if (mat > 0) movs.push({ fila: "sim_material", fecha: sumarDias(p.inicio, 90), importe: r2(mat * p.importe), concepto: `Material ${p.nombre}`, fuente: `Simulador: ${Math.round(mat * 100)} % del presupuesto, 3 meses después de empezar`, fiabilidad: "estimado" });
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  const ultimoCobro = [...prog, ...terminadas].map((p) => p.cobro).filter(Boolean).sort().pop() || null;
  const finMes = [ultimoCobro ? ultimoCobro.slice(0, 7) : null, FIN_MINIMO].filter(Boolean).sort().pop();
  // producción (ejecución) por mes y extras de operarios
  const produccion = {}, beneficio = {};
  for (let m = hoy.slice(0, 7); m <= finMes; m = mesSig(m)) { produccion[m] = 0; }
  for (const p of prog) {
    if (!(p.importe > 0)) continue;
    if (p.inicio === p.fin) { if (produccion[p.inicio.slice(0, 7)] != null) produccion[p.inicio.slice(0, 7)] += p.importe; continue; }   // empieza y acaba el mismo día
    for (let m = p.inicio.slice(0, 7); m <= p.fin.slice(0, 7) && m <= finMes; m = mesSig(m)) {
      const a = Math.max(Date.parse(p.inicio), Date.parse(`${m}-01`)), b = Math.min(Date.parse(p.fin), Date.parse(finDeMes(m)) + 86400000);
      if (b > a) produccion[m] += p.importe * (b - a) / (Date.parse(p.fin) - Date.parse(p.inicio));
    }
  }
  for (const m of Object.keys(produccion)) {
    produccion[m] = r2(produccion[m]);
    const dias = Number(finDeMes(m).slice(8, 10));
    const frac = m === hoy.slice(0, 7) ? (dias - Number(hoy.slice(8, 10)) + 1) / dias : 1;
    const b = (1 - mat) * produccion[m] - moOp * frac;
    beneficio[m] = r2(b - Math.max(0, comPct * b) - ((Number(fijos.indirectos) || 0) + (Number(fijos.generales) || 0)) * frac);
    if (mandos.extra > 0) movs.push({ fila: "sim_operarios", fecha: `${m}-28` < hoy ? hoy : `${m}-28`, importe: r2(COSTE_OPERARIO_EXTRA * mandos.extra * frac), concepto: `Operarios extra (${mandos.extra})`, fuente: "Simulador: 2.800 €/mes cada uno", fiabilidad: "estimado" });
  }
  const benTot = r2(prog.reduce((s, p) => s + p.beneficio - Math.max(0, comPct * p.beneficio), 0));
  return {
    movs: movs.sort((a, b) => a.fecha.localeCompare(b.fecha)), prog, terminadas, produccion, beneficio,
    idle: r2(idle), horas_mes: H, equipos: E, espera_por_equipo: esperaEq.map(r2), meses_obra: r2(t), fin_obras: prog.length ? prog[prog.length - 1].fin : null,
    ultimo_cobro: ultimoCobro, fin_mes: finMes, beneficio_cartera: benTot, cartera: cartera(obras),
  };
}

// Serie de caja hasta el mes del último cobro (mínimo julio de 2027): los
// movimientos conocidos del backend (13 semanas enteras y los puntuales de
// después) + los recurrentes después de las 13 semanas + lo simulado.
function serieMensual(cf, sim, { is2026 = undefined, hasta = null } = {}) {
  const fin13 = cf.semanas[cf.semanas.length - 1].hasta;
  const finMes = hasta || sim?.fin_mes || FIN_MINIMO;
  const conocidos = [...cf.semanas.flatMap((s) => s.movs), ...cf.meses.flatMap((m) => m.movs)]
    .filter((m) => !(is2026 !== undefined && m.fila === "is_2026"));
  const recurrentes = (cf.recurrentes_movs || []).filter((m) => m.fecha > fin13);
  const isMano = is2026 != null && is2026 > 0 ? [{ fila: "is_2026", fecha: (cf.is_2026?.fecha || "2027-07-25"), importe: is2026, concepto: "IS 2026", fuente: "A mano en el simulador", fiabilidad: "estimado" }] : [];
  const todos = [...conocidos, ...recurrentes, ...(sim?.movs || []), ...isMano].filter((m) => m.fecha.slice(0, 7) <= finMes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const meses = [];
  let saldo = cf.inicial.propio;
  for (let m = cf.hoy.slice(0, 7); m <= finMes; m = mesSig(m)) {
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
const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const normObra = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const mediana = (xs) => { const v = [...xs].sort((a, b) => a - b); const n = v.length; return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
// Meses con vacaciones o festivos largos: agosto siempre, y cualquier mes en el
// que las horas en obra sean menos del 85 % de las pagadas (vacaciones,
// festivos, bajas registradas en registros-tiempo).
const RATIO_MES_NORMAL = 0.85;
function mesNormal(m) {
  if (m.mes === 8) return { ok: false, motivo: "agosto (vacaciones)" };
  if (m.horas_pagadas > 0 && m.horas_obra / m.horas_pagadas < RATIO_MES_NORMAL) return { ok: false, motivo: `solo ${Math.round(m.horas_obra / m.horas_pagadas * 100)} % de las horas pagadas en obra` };
  return { ok: true };
}

// «Real (automático)»: mandos recalculados con lo último de ARA-OS.
//   pnr = posicion-neta-real del último mes cerrado; anual = resultado-real-anual
//   excluir = obras que no cuentan para calibrar (config_dinero
//   obras_excluidas_calibracion: horas sin confirmar por JM)
function calibrar({ pnr, anual, hoy, fotoFresca, excluir = [] }) {
  const cal = [];
  const d = pnr?.ok ? pnr.data : null;
  // Horas en obra al mes: media de los meses NORMALES de los 6 últimos cerrados
  // (sin agosto ni meses con muchas horas de vacaciones o festivos)
  const cerrados = anual?.ok ? (anual.data.por_mes || []).filter((m) => !m.sin_datos && m.horas_obra > 0 && m.mes < Number(hoy.slice(5, 7))).slice(-6) : [];
  const normales = cerrados.map((m) => ({ ...m, n: mesNormal(m) })).filter((m) => m.n.ok).slice(-3);
  const fuera = cerrados.map((m) => ({ ...m, n: mesNormal(m) })).filter((m) => !m.n.ok).slice(-3);
  const horas = normales.length ? Math.round(normales.reduce((t, m) => t + m.horas_obra, 0) / normales.length) : (d ? Math.round(d.total_horas_mo) : null);
  cal.push({ mando: "horas", valor: horas,
    texto: normales.length ? `media de ${normales.map((m) => MESES_ES[m.mes - 1]).join(", ")}${fuera.length ? ` (fuera: ${fuera.map((m) => `${MESES_ES[m.mes - 1]}, ${m.n.motivo}`).join("; ")})` : ""}` : d ? "último mes cerrado" : "sin dato",
    fiabilidad: normales.length >= 2 ? "exacto" : "estimado" });
  // Obras terminadas en los últimos 6 meses, sin las excluidas (horas sin confirmar)
  const desde = sumarDias(hoy, -183);
  const excl = (excluir || []).map(normObra).filter((x) => x.length >= 4);
  const esExcluida = (o) => excl.some((x) => normObra(o.nombre).includes(x));
  const candidatas = d ? (d.obras || []).filter((o) => /^1[4-8]_/.test(o.fase || "") && o.fecha_fin && o.fecha_fin >= desde && Number(o.horas_previstas) > 0 && Number(o.horas_registradas) > 0) : [];
  const term = candidatas.filter((o) => !esExcluida(o));
  const nExcl = candidatas.length - term.length;
  // Desvío: MEDIANA de las obras (horas reales ÷ previstas − 1), no la media
  const med = mediana(term.map((o) => Number(o.horas_registradas) / Number(o.horas_previstas) - 1));
  const desvio = med == null ? null : Math.round(med * 100);
  cal.push({ mando: "desvio", valor: desvio,
    texto: term.length ? `mediana de ${term.length} obras terminadas en 6 meses${nExcl ? ` (${nExcl} excluidas: horas sin confirmar)` : ""}` : "sin obras terminadas con horas",
    fiabilidad: term.length >= 5 ? "exacto" : "estimado" });
  const conMat = term.filter((o) => Number(o.importe) > 0);
  const impT = conMat.reduce((t, o) => t + Number(o.importe), 0), matT = conMat.reduce((t, o) => t + (Number(o.materiales_eur) || 0), 0);
  const mat = impT > 0 && matT > 0 ? Math.round(matT / impT * 100) : (d && Number(d.ingreso_mes_eur) > 0 ? Math.round(Number(d.gastos_materiales_eur) / Number(d.ingreso_mes_eur) * 100) : null);
  cal.push({ mando: "mat", valor: mat, texto: impT > 0 && matT > 0 ? `${conMat.length} obras terminadas (material imputado)` : "material del último mes ÷ obra ejecutada",
             fiabilidad: "estimado", nota: "El material sin etiqueta de obra no cuenta aquí (va a generales)." });
  const obras = d ? (d.obras || []).filter((o) => /^0[5-9]_/.test(o.fase || "") && Number(o.horas_previstas) > 0) : [];
  const c = cartera(obras);
  cal.push({ mando: "eurH", valor: c.eur_hora_prevista, texto: `${c.n} obras · ${Math.round(c.horas_pendientes)} h previstas pendientes${c.sin_presupuesto ? ` · ${c.sin_presupuesto} sin presupuesto` : ""}`, fiabilidad: c.n ? "exacto" : "sin_dato" });
  // Equipos: obras en ejecución ahora mismo (fases 12-13) con fecha de inicio
  // en Planificación / órdenes de trabajo; entre 1 y 4, y 2 si no hay ninguna
  const enMarcha = d ? (d.obras || []).filter((o) => /^1[23]_/.test(o.fase || "") && Number(o.horas_registradas) > 0).length : 0;
  const equipos = enMarcha ? Math.max(1, Math.min(4, enMarcha)) : 2;
  cal.push({ mando: "equipos", valor: equipos, texto: enMarcha ? `${enMarcha} obra(s) en ejecución ahora (fases 12-13)` : "ninguna obra en ejecución: 2 por defecto", fiabilidad: "estimado" });
  cal.push({ mando: "tram", valor: 1, texto: "1 mes por fase hasta tener la fecha de trámite de cada expediente", fiabilidad: "estimado" });
  cal.push({ mando: "cobro", valor: 2, texto: "regla de 2 meses + día 5/20 (sin fechas de cobro por obra todavía)", fiabilidad: "estimado" });
  const nomina = d?.coste_mo_fuente === "nomina";
  cal.push({ mando: "fijos", valor: d ? r2((d.coste_mo_eur || 0) + (d.nomina_indirectos_eur || 0) + (d.costes_generales_eur || 0)) : null,
             texto: d ? `${nomina ? "nómina" : "estimación"} de ${d.año}-${String(d.mes).padStart(2, "0")}: operarios ${r2(d.coste_mo_eur)} + indirectos ${r2(d.nomina_indirectos_eur)} + generales ${r2(d.costes_generales_eur)}` : "sin dato",
             fiabilidad: nomina ? "exacto" : "estimado" });
  if (!fotoFresca) cal.push({ mando: "caja", valor: null, texto: "foto de conciliación vieja o sin foto: la caja de partida es la contable", fiabilidad: "estimado" });
  const val = (k) => cal.find((x) => x.mando === k)?.valor;
  return {
    mandos: { esc: "automatico", nombre: "Real (automático)", horas: val("horas") ?? 760, desvio: val("desvio") ?? 45, extra: 0, mat: val("mat") ?? 27, tram: 1, equipos: val("equipos") ?? 2 },
    calibracion: cal,
    obras,
  };
}

module.exports = { cartera, simular, serieMensual, calibrar, fechaCobroObra, fechaDeT, mesSig, finDeMes, HORAS_OPERARIO_EXTRA, COSTE_OPERARIO_EXTRA, FIN_MINIMO };
