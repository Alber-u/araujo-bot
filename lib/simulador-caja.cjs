// ============================================================
// lib/simulador-caja.cjs — simulador de escenarios del cash flow
// (encargo del 03/10/2026 · prototipo cashflow-simulador-ULTIMO.html)
// ============================================================
// Mismo modelo que el prototipo y que ara-os/src/lib/simuladorCaja.js (se
// genera a partir de este archivo: si se cambia uno, cambiar el otro; los dos
// tests usan el mismo caso).
//
// Calendario OBRA A OBRA de la cartera aceptada (fases 05-09 sin terminar):
//   · orden: empezadas → el de la documentación (lib/orden-cartera) → fase
//   · las 05-08 no se pueden empezar hasta que EMASESA las tramite:
//     pasos que faltan × el mando «Ritmo de tramitación»
//   · CUADRILLAS REALES (config_dinero «cuadrillas», p. ej. "2,3"): cada una
//     trabaja personas × horas por persona al mes. Las obras con horas
//     previstas ≥ «obra grande» van a la cuadrilla más grande; el resto a la
//     más pequeña. Si la preferida tarda más de un mes en quedar libre, a la
//     que esté libre.
//   · duración = horas pendientes × (1 + desvío) ÷ capacidad de la cuadrilla
//   · si no hay obra tramitada, la cuadrilla espera: horas perdidas (se pagan)
//   · cobro = fin + 2 meses, el siguiente día 5 o 20 (o fin + mes_cobro meses
//     si la obra lo trae, p. ej. Urbano Orad: 50 % al terminar, 1 mes después)
//   · material = % del presupuesto total, pagado 3 meses después de empezar
//   · comisión comercial = 20 % del beneficio de la obra, al cobro (salvo
//     sin_comision)
//   · cada persona de más sobre las de hoy: +2.800 €/mes
// El tiempo va en meses desde hoy (t = 0 hoy); las fechas se sacan del
// calendario real.
// ============================================================
"use strict";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mesSig = (mes, n = 1) => { const [y, m] = mes.split("-").map(Number); const i = m - 1 + n; return `${y + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const finDeMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const sumarDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const COSTE_PERSONA_EXTRA = 2800, FIN_MINIMO = "2027-07", DIAS_MES = 30.4375;

// t (meses desde hoy) → fecha ISO, y al revés
const fechaDeT = (hoy, t) => sumarDias(hoy, Math.round(t * DIAS_MES));
const tDeFecha = (hoy, iso) => (Date.parse(String(iso).slice(0, 10)) - Date.parse(hoy)) / 86400000 / DIAS_MES;

// Regla de cobro (Alberto, 03/10): 2 meses después de terminar, siguiente día 5 o 20
function fechaCobroObra(finIso) {
  const [y, m, d] = finIso.split("-").map(Number);
  const mas2 = mesSig(`${y}-${String(m).padStart(2, "0")}`, 2);
  const dia = Math.min(d, Number(finDeMes(mas2).slice(8, 10)));
  if (dia <= 5) return `${mas2}-05`;
  if (dia <= 20) return `${mas2}-20`;
  return `${mesSig(mas2, 1)}-05`;
}
// fin + n meses (mismo día, o el último del mes)
function fechaMasMeses(iso, n) {
  const mes = mesSig(iso.slice(0, 7), n);
  return `${mes}-${String(Math.min(Number(iso.slice(8, 10)), Number(finDeMes(mes).slice(8, 10)))).padStart(2, "0")}`;
}

const faseNum = (o) => Number(String(o.fase || "").slice(0, 2)) || 0;
// avance (0-1) de una obra: horas registradas ÷ previstas
const avance = (o) => { const p = Number(o.horas_previstas) || 0; return p > 0 ? Math.min(1, (Number(o.horas_registradas) || 0) / p) : 0; };

// Terminada = todas sus horas previstas hechas (100 %) o con fecha de fin de
// obra (hito «fin» del panel de obras): no es cartera pendiente; va al bloque
// «terminadas, pendientes de cobro» (Alberto, 03/10).
const terminada = (o, hoy = null) => (Number(o.horas_previstas) > 0 && avance(o) >= 0.999) || !!(o.fin_obra && (!hoy || String(o.fin_obra).slice(0, 10) <= hoy));

// Tamaños de las cuadrillas para P personas: si «base» suma P se respeta
// (config real, p. ej. [2, 3]); si no, cuadrillas de 2 y la última con el resto
function tamanosCuadrillas(personas, base = null) {
  const P = Math.max(2, Math.round(Number(personas) || 0));
  if (Array.isArray(base) && base.length && base.reduce((t, n) => t + n, 0) === P) return base.slice();
  const E = Math.max(1, Math.floor(P / 2));
  return Array.from({ length: E }, (_, i) => 2 + (i === E - 1 ? P - 2 * E : 0));
}

// Cartera por ejecutar: importe y horas previstas PENDIENTES
function cartera(obras = [], hoy = null) {
  let pendiente = 0, horasPend = 0, sinPto = 0;
  const vivas = obras.filter((x) => !terminada(x, hoy));
  for (const o of vivas) {
    const falta = 1 - avance(o);
    pendiente += (Number(o.importe) || 0) * falta; horasPend += (Number(o.horas_previstas) || 0) * falta;
    if (!(Number(o.importe) > 0)) sinPto++;
  }
  return { pendiente: r2(pendiente), horas_pendientes: r2(horasPend), eur_hora_prevista: horasPend > 0 ? r2(pendiente / horasPend) : null,
           n: vivas.length, sin_presupuesto: sinPto, terminadas: obras.length - vivas.length };
}

// simular({ obras, historico, hoy, mandos: { personas, hpp, cuadrillas, desvio, mat, tram, grande } })
//   historico.personas_base = personas de hoy (las de más cuestan 2.800 €/mes)
function simular({ obras = [], historico = {}, hoy, mandos }) {
  const base = Number(historico.personas_base) || 5;
  const P = Math.max(2, Math.round(Number(mandos.personas) || base));
  const hpp = Number(mandos.hpp) || 0;
  const tam = tamanosCuadrillas(P, mandos.cuadrillas);
  const E = tam.length, cap = tam.map((n) => n * hpp), H = P * hpp;
  const grande = mandos.grande == null ? 300 : Number(mandos.grande) || 0;
  const k = 1 + (Number(mandos.desvio) || 0) / 100, mat = (Number(mandos.mat) || 0) / 100;
  const tram = mandos.tram == null ? 1 : Number(mandos.tram) || 0;
  const fijos = historico.fijos || {};
  const extra = Math.max(0, P - base);
  const moOp = (Number(fijos.operarios) || 0) + COSTE_PERSONA_EXTRA * extra;
  const costeH = H > 0 ? moOp / H : 0;
  const comPct = historico.comision_pct ?? 0.2;
  const comision = (o, ben) => (o.sin_comision ? 0 : r2(Math.max(0, comPct * ben)));
  // Terminadas: fuera del calendario; se cobran por la regla desde su fin
  // (hito «fin», último día con horas, o hoy) y pagan su comisión al cobro.
  const terminadas = obras.filter((o) => terminada(o, hoy)).map((o) => {
    const ff = o.fin_obra || o.fecha_fin;
    const fin = ff && String(ff).slice(0, 10) <= hoy ? String(ff).slice(0, 10) : hoy;
    const imp = Number(o.importe) || 0, tot = Number(o.importe_total) || imp;
    const ben = tot * (1 - mat) - (Number(o.horas_registradas) || 0) * costeH;
    return { nombre: o.nombre, fase: o.fase, importe: r2(imp), sin_presupuesto: !(imp > 0), fin,
             cobro: imp > 0 ? (o.mes_cobro ? fechaMasMeses(fin, o.mes_cobro) : fechaCobroObra(fin)) : null, comision: comision(o, ben) };
  });
  const libre = Array(E).fill(0), esperaEq = Array(E).fill(0);
  const maxT = Math.max(...tam), minT = Math.min(...tam);
  // Orden: primero las que tienen fecha de inicio (empezadas según el panel de
  // obras, o fijada como Urbano Orad), por fecha; luego las que llevan horas;
  // luego el de la documentación (o.orden, lib/orden-cartera) si viene; si no,
  // por fase
  const inicioDe = (o) => String(o.inicio_fijo || o.empezada || "");
  const empezada = (o) => avance(o) > 0 || !!inicioDe(o);
  const rango = (o) => (inicioDe(o) ? 0 : avance(o) > 0 ? 1 : 2);
  const orden = obras.filter((o) => !terminada(o, hoy)).map((o, i) => ({ ...o, _i: i })).sort((a, b) =>
    (rango(a) - rango(b)) || (rango(a) === 0 ? inicioDe(a).localeCompare(inicioDe(b)) : 0) ||
    ((a.orden != null && b.orden != null) ? a.orden - b.orden : (faseNum(b) - faseNum(a))) || a._i - b._i);
  let idle = 0;
  const prog = [];
  for (const o of orden) {
    const av = avance(o), f = faseNum(o);
    // cuándo se puede empezar: fecha fijada, ya empezada, o pasos de trámite × ritmo
    const ready = o.inicio_fijo ? Math.max(0, tDeFecha(hoy, o.inicio_fijo))
      : empezada(o) ? 0 : (o.pasos != null ? Number(o.pasos) : (f >= 9 ? 0 : 9 - f)) * tram;
    const prev = Number(o.horas_previstas) || 0;
    const imp = (Number(o.importe) || 0) * (prev > 0 ? 1 - av : 1);
    const tot = Number(o.importe_total) || (Number(o.importe) || 0);
    // horas: previstas pendientes × (1 + desvío); sin previstas pero con margen
    // objetivo, las que dejan ese beneficio
    const hrs = prev > 0 ? prev * (1 - av) * k : (o.margen_objetivo && costeH > 0 ? tot * (1 - mat - Number(o.margen_objetivo)) / costeH : 0);
    const horasRef = prev > 0 ? prev : hrs;
    const esGrande = horasRef >= grande;
    // cuadrilla preferida: la más grande si es obra grande, si no la más pequeña
    // (o la que diga la obra: o.cuadrilla = nº de personas)
    const quiere = o.cuadrilla && tam.includes(Number(o.cuadrilla)) ? Number(o.cuadrilla) : esGrande ? maxT : minT;
    const pref = [...Array(E).keys()].filter((i) => maxT === minT || tam[i] === quiere);
    let eq = pref.reduce((a, i) => (libre[i] < libre[a] ? i : a), pref[0]);
    const otra = [...Array(E).keys()].reduce((a, i) => (libre[i] < libre[a] ? i : a), 0);
    // si la preferida tarda más de un mes en quedar libre, a la que esté libre
    // (comparando cuándo podría empezar en cada una: si las dos esperan al
    // trámite, se queda en la preferida)
    if (!o.cuadrilla && Math.max(libre[otra], ready) + 1 < Math.max(libre[eq], ready)) eq = otra;
    const t0 = Math.max(libre[eq], ready);
    // esperar a una fecha de inicio ya fijada no es esperar trámite
    const espera = o.inicio_fijo ? 0 : t0 - libre[eq];
    idle += espera * cap[eq]; esperaEq[eq] += espera;
    const t1 = cap[eq] > 0 ? t0 + hrs / cap[eq] : t0;
    const desdeLibre = libre[eq];
    libre[eq] = t1;
    const ben = tot * (1 - mat) * (prev > 0 ? 1 - av : 1) - hrs * costeH;
    const ini0 = inicioDe(o).slice(0, 10);
    const inicio = ini0 && ini0 < hoy && t0 === 0 ? ini0 : fechaDeT(hoy, t0);
    const fin = fechaDeT(hoy, t1);
    prog.push({ nombre: o.nombre, fase: o.fase, importe: r2(imp), importe_total: r2(tot), sin_presupuesto: !(Number(o.importe) > 0), horas: r2(hrs), avance_pct: Math.round(av * 100),
                estado_doc: o.estado_doc || null, atascada_dias: o.atascada_dias || null, pasos: o.pasos ?? null, tipo: o.tipo || null,
                equipo: eq + 1, cuadrilla: tam[eq], grande: esGrande, t0: r2(t0), t1: r2(t1), espera: r2(espera), espera_desde: espera > 0 ? fechaDeT(hoy, desdeLibre) : null,
                inicio, fin, cobro: imp > 0 ? (o.mes_cobro ? fechaMasMeses(fin, o.mes_cobro) : fechaCobroObra(fin)) : null,
                mes_cobro: o.mes_cobro || null, sin_comision: !!o.sin_comision,
                beneficio: r2(ben), comision: comision(o, ben) });
  }
  // movimientos con fecha
  const reglaCobro = (p) => (p.mes_cobro ? `cobro ${p.mes_cobro} mes(es) después de terminar` : "cobro 2 meses + día 5/20");
  const movs = [];
  for (const p of terminadas) {
    if (!(p.importe > 0)) continue;
    movs.push({ fila: "sim_cobros", fecha: p.cobro, importe: p.importe, entra: true, concepto: `${p.nombre} (terminada, pendiente de cobro)`, fuente: `Simulador: obra terminada el ${p.fin}, cobro 2 meses + día 5/20`, fiabilidad: "estimado" });
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  for (const p of prog) {
    if (p.importe > 0) movs.push({ fila: "sim_cobros", fecha: p.cobro, importe: p.importe, entra: true, concepto: `${p.nombre} (fase ${String(p.fase).slice(0, 2)})`, fuente: `Simulador: termina ${p.fin}, ${reglaCobro(p)}`, fiabilidad: "estimado" });
    const matEur = r2(mat * (p.importe_total || p.importe) * (p.avance_pct ? 1 - p.avance_pct / 100 : 1));
    if (mat > 0 && matEur > 0) movs.push({ fila: "sim_material", fecha: sumarDias(p.inicio < hoy ? hoy : p.inicio, p.inicio < hoy ? Math.max(0, 90 - Math.round((Date.parse(hoy) - Date.parse(p.inicio)) / 86400000)) : 90), importe: matEur, concepto: `Material ${p.nombre}`, fuente: `Simulador: ${Math.round(mat * 100)} % del presupuesto, 3 meses después de empezar`, fiabilidad: "estimado" });
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  const t = Math.max(0, ...libre);
  const ultimoCobro = [...prog, ...terminadas].map((p) => p.cobro).filter(Boolean).sort().pop() || null;
  const finMes = [ultimoCobro ? ultimoCobro.slice(0, 7) : null, FIN_MINIMO].filter(Boolean).sort().pop();
  // producción (ejecución) por mes y personas de más
  const produccion = {}, beneficio = {};
  for (let m = hoy.slice(0, 7); m <= finMes; m = mesSig(m)) { produccion[m] = 0; }
  for (const p of prog) {
    if (!(p.importe > 0)) continue;
    const ini = p.inicio < hoy ? hoy : p.inicio;
    if (ini >= p.fin) { if (produccion[ini.slice(0, 7)] != null) produccion[ini.slice(0, 7)] += p.importe; continue; }   // empieza y acaba el mismo día
    for (let m = ini.slice(0, 7); m <= p.fin.slice(0, 7) && m <= finMes; m = mesSig(m)) {
      const a = Math.max(Date.parse(ini), Date.parse(`${m}-01`)), b = Math.min(Date.parse(p.fin), Date.parse(finDeMes(m)) + 86400000);
      if (b > a) produccion[m] += p.importe * (b - a) / (Date.parse(p.fin) - Date.parse(ini));
    }
  }
  for (const m of Object.keys(produccion)) {
    produccion[m] = r2(produccion[m]);
    const dias = Number(finDeMes(m).slice(8, 10));
    const frac = m === hoy.slice(0, 7) ? (dias - Number(hoy.slice(8, 10)) + 1) / dias : 1;
    const b = (1 - mat) * produccion[m] - moOp * frac;
    beneficio[m] = r2(b - Math.max(0, comPct * b) - ((Number(fijos.indirectos) || 0) + (Number(fijos.generales) || 0)) * frac);
    if (extra > 0) movs.push({ fila: "sim_operarios", fecha: `${m}-28` < hoy ? hoy : `${m}-28`, importe: r2(COSTE_PERSONA_EXTRA * extra * frac), concepto: `Personas de más en obra (${extra})`, fuente: "Simulador: 2.800 €/mes cada una", fiabilidad: "estimado" });
  }
  const benTot = r2(prog.reduce((s, p) => s + p.beneficio - p.comision, 0));
  return {
    movs: movs.sort((a, b) => a.fecha.localeCompare(b.fecha)), prog, terminadas, produccion, beneficio,
    idle: r2(idle), horas_mes: H, personas: P, hpp, cuadrillas: tam, equipos: E, personas_extra: extra, espera_por_equipo: esperaEq.map(r2),
    meses_obra: r2(t), fin_obras: prog.length ? fechaDeT(hoy, t) : null,
    ultimo_cobro: ultimoCobro, fin_mes: finMes, beneficio_cartera: benTot, cartera: cartera(obras, hoy),
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
function calibrar({ pnr, anual, hoy, fotoFresca, excluir = [], cuadrillas = null, grande = null }) {
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
  // Cuadrillas: config_dinero «cuadrillas» (personas por cuadrilla, p. ej. "2,3")
  const tamanos = String(cuadrillas || "").split(/[,;\s]+/).map(Number).filter((n) => n > 0);
  const tam = tamanos.length ? tamanos : [2, 3];
  const personas = tam.reduce((t, n) => t + n, 0);
  cal.push({ mando: "personas", valor: personas, texto: tamanos.length ? `config_dinero cuadrillas = ${tam.join(" + ")}` : "sin «cuadrillas» en config_dinero: 2 + 3 por defecto", fiabilidad: tamanos.length ? "exacto" : "estimado" });
  const hpp = horas && personas ? Math.round(horas / personas) : null;
  cal.push({ mando: "hpp", valor: hpp, texto: `${horas ?? "—"} h en obra ÷ ${personas} personas`, fiabilidad: "estimado" });
  cal.push({ mando: "grande", valor: grande ?? 300, texto: grande != null ? "config_dinero obra_grande_horas" : "300 h por defecto (obra_grande_horas)", fiabilidad: "estimado" });
  cal.push({ mando: "tram", valor: 1, texto: "1 mes por fase hasta tener la fecha de trámite de cada expediente", fiabilidad: "estimado" });
  cal.push({ mando: "cobro", valor: 2, texto: "regla de 2 meses + día 5/20 (sin fechas de cobro por obra todavía)", fiabilidad: "estimado" });
  const nomina = d?.coste_mo_fuente === "nomina";
  cal.push({ mando: "fijos", valor: d ? r2((d.coste_mo_eur || 0) + (d.nomina_indirectos_eur || 0) + (d.costes_generales_eur || 0)) : null,
             texto: d ? `${nomina ? "nómina" : "estimación"} de ${d.año}-${String(d.mes).padStart(2, "0")}: operarios ${r2(d.coste_mo_eur)} + indirectos ${r2(d.nomina_indirectos_eur)} + generales ${r2(d.costes_generales_eur)}` : "sin dato",
             fiabilidad: nomina ? "exacto" : "estimado" });
  if (!fotoFresca) cal.push({ mando: "caja", valor: null, texto: "foto de conciliación vieja o sin foto: la caja de partida es la contable", fiabilidad: "estimado" });
  const val = (k) => cal.find((x) => x.mando === k)?.valor;
  return {
    mandos: { esc: "automatico", nombre: "Real (automático)", personas: val("personas"), hpp: val("hpp") ?? 152, cuadrillas: tam, desvio: val("desvio") ?? 45, mat: val("mat") ?? 27, tram: 1, grande: val("grande") ?? 300 },
    calibracion: cal,
    obras,
  };
}

module.exports = { cartera, simular, serieMensual, calibrar, tamanosCuadrillas, fechaCobroObra, fechaDeT, mesSig, finDeMes, COSTE_PERSONA_EXTRA, FIN_MINIMO };
