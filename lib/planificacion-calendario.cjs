// ============================================================
// lib/planificacion-calendario.cjs — Planificación por cuadrillas (la usa JM)
// (encargo de planificación por cuadrillas, 03/10/2026, puntos 1-15)
// ============================================================
// Una sola planificación: la misma cola y las mismas reglas de cuadrilla que
// el cash flow (orden por documentación, fechas de las OT/OO, lo agendado a
// mano en planificacion_obras), pero en JORNADAS:
//   · horas = las del presupuesto (pendientes si ya va empezada), SIN desvío;
//     obras privadas sin horas previstas: el tope para el margen mínimo
//   · jornadas = horas ÷ (personas de la cuadrilla × 8 h), en días laborables
//   · fin = último día de trabajo
// SIN EUROS: Planificación es horas, personas, fechas y trámites; los euros
// se ven en Cash flow, que lee esta misma planificación.
// «Probar configuraciones»: actual, optimizada (fin de la cartera), optimizada
// (fecha media de fin) y «a la cuadrilla que antes pueda empezar», todas con
// las mismas personas, sin adelantar ninguna obra a su trámite y respetando lo
// fijado por JM.
// ============================================================
"use strict";

const S = require("./simulador-caja.cjs");
const { leerFestivos } = require("./festivos.cjs");

const J = require("./jornada.cjs");
const HORAS_DIA = J.HORAS_DIA_CONVENIO;   // 7,7 h (convenio del Metal de Sevilla); config_dinero «horas_dia»
const DIAS_MES = 30.4375;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const dia = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
// Festivos (config_dinero «festivos», lib/festivos.cjs): no son laborables
let FEST = new Set();
const setFestivos = (lista) => { FEST = new Set(lista || []); };
// Jornada (horas por día) y vacaciones por persona: config_dinero «horas_dia»,
// «vacaciones_dias», «vacaciones_personas» (lib/jornada.cjs)
let JOR = { horas_dia: HORAS_DIA, jornada: J.leerJornada({}), defecto: new Set(), cache: {} };
function setJornada(jornada, hoy) {
  const jj = jornada || J.leerJornada({});
  const { defecto } = J.diasVacaciones(jj, [], hoy, dia(hoy, 3 * 365), esLab);
  JOR = { horas_dia: jj.horas_dia, jornada: jj, defecto, desde: hoy, cache: {} };
}
const vacDe = (n) => {
  if (!JOR.jornada.personas[n]) return JOR.defecto;
  if (!JOR.cache[n]) JOR.cache[n] = J.diasVacaciones(JOR.jornada, [n], JOR.desde || "2026-01-01", dia(JOR.desde || "2026-01-01", 3 * 365), esLab).porPersona[n];
  return JOR.cache[n];
};
// personas de un equipo que trabajan ese día (los de vacaciones, fuera)
const disponibles = (crew, x) => (crew.nombres ? crew.nombres.filter((n) => !vacDe(n).has(x)).length : (JOR.defecto.has(x) ? 0 : crew.n));
// Último día de trabajo para «horas» desde «ini» con ese equipo: día a día,
// solo laborables, cada día las horas de los que no están de vacaciones
function finPorHoras(ini, horas, crew) {
  let x = labDesde(ini), resto = horas, dias = 0, vac = 0;
  for (let g = 0; g < 4000; g++) {
    const c = disponibles(crew, x) * JOR.horas_dia;
    if (c > 0) { resto -= c; dias++; if (resto <= 1e-6) break; } else vac++;
    x = dia(x, 1); while (!esLab(x)) x = dia(x, 1);
  }
  let fe = dia(x, 1); while (!esLab(fe)) fe = dia(fe, 1);
  return { ult: x, finExcl: fe, dias: Math.max(1, dias), vac };
}
const esLab = (iso) => { const d = new Date(iso + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6 && !FEST.has(iso); };
const labDesde = (iso) => { let x = iso; while (!esLab(x)) x = dia(x, 1); return x; };     // ese día o el siguiente laborable
const labAntes = (iso) => { let x = dia(iso, -1); while (!esLab(x)) x = dia(x, -1); return x; };
// fin EXCLUSIVO tras n jornadas desde ini (como el prototipo)
function sumarJornadas(ini, n) {
  let x = labDesde(ini), k = n;
  while (k > 1e-9) { x = dia(x, 1); if (esLab(x)) k -= 1; }
  return x;
}
function laborables(desde, hasta) {
  let n = 0;
  for (let x = desde; x <= hasta; x = dia(x, 1)) if (esLab(x)) n++;
  return n;
}
// n-ésimo día laborable contando «desde» (si es laborable) como el 1
function enesimoLaborable(desde, n) {
  let x = labDesde(desde), k = Math.max(1, Math.round(n));
  while (k > 1) { x = dia(x, 1); if (esLab(x)) k--; }
  return x;
}
// «X meses y Y días» entre dos fechas (calendario)
function mesesYDias(desde, hasta) {
  const [y1, m1, d1] = desde.split("-").map(Number), [y2, m2, d2] = hasta.split("-").map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses--;
  const base = new Date(Date.UTC(y1, m1 - 1 + meses, 1));
  const dimes = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const ancla = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Math.min(d1, dimes));
  return { meses: Math.max(0, meses), dias: Math.max(0, Math.round((Date.parse(hasta) - ancla) / 86400000)) };
}
const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const faseNum = (o) => Number(String(o.fase || "").slice(0, 2)) || 0;

// config_dinero «cuadrillas_personas»: «Cuadrilla 1: Antonio, Pepe; Cuadrilla 2: Juan, Luis, Mario»
function personasPorCuadrilla(txt) {
  if (!txt || !String(txt).trim()) return null;
  return String(txt).split(/[;\n]+/).map((x) => x.replace(/^[^:]*:/, (m) => (/cuadrilla/i.test(m) ? "" : m)))
    .map((x) => x.split(",").map((n) => n.trim()).filter(Boolean)).filter((x) => x.length);
}
const textoPersonas = (q) => q.map((xs, i) => `Cuadrilla ${i + 1}: ${xs.join(", ")}`).join("; ");

// Base común: cola, horas del presupuesto y fecha de trámite de cada obra
function preparar({ cf, hoy, borrador = null, tam = null, nombres = null }) {
  const m = cf.automatico.mandos;
  const obras = S.aplicarCambioPlan(cf.simulador.obras, borrador);
  const cuadrillas = tam && tam.length ? tam : (m.cuadrillas || [2, 3]);
  // horas del presupuesto (sin desvío): las mismas que el simulador con desvío 0
  const sim0 = S.simular({ obras, historico: cf.simulador.historico, hoy, mandos: { ...m, desvio: 0, cuadrillas } });
  const horas = Object.fromEntries(sim0.prog.map((p) => [p.obra_id, p.horas]));
  const cola = S.colaObras(obras, hoy).map((o) => {
    const av = S.avance(o), f = faseNum(o);
    const empezada = av > 0 || !!o.empezada;
    const pasos = empezada ? 0 : (o.pasos != null ? Number(o.pasos) : (f >= 9 ? 0 : 9 - f));
    const tramitada = labDesde(dia(hoy, Math.round(pasos * (m.tram ?? 1) * DIAS_MES)));
    const prev = Number(o.horas_previstas) || 0;
    return { o, av, f, empezada, pasos, tramitada, prev, horas: horas[o.obra_id] ?? prev * (1 - av), tope: (!(prev > 0) && !!o.margen_objetivo) || !!o.horas_tope_fijo };
  });
  // nombres de cada cuadrilla (si cuadran con su tamaño): para sus vacaciones
  const nombresOk = (nombres || []).map((xs, i) => (xs && xs.length === cuadrillas[i] ? xs : null));
  return { m, cuadrillas, cola, terminadas: sim0.terminadas, avisosSim: sim0.avisos, nombres: nombresOk };
}

// Coloca la cola en jornadas. conf = { orden: [obra_id…], asig: { obra_id: equipo (0, 1…) }, regla: "actual"|"antes" }
function programar(base, hoy, conf = null) {
  const { cuadrillas, cola, m } = base;
  const E = cuadrillas.length, maxT = Math.max(...cuadrillas), minT = Math.min(...cuadrillas);
  const grande = m.grande ?? 300;
  const inicioFijo = (x) => x.o.inicio_fijo || x.o.empezada || null;
  let lista = cola;
  if (conf?.orden) {
    const fijas = cola.filter((x) => inicioFijo(x));
    const resto = conf.orden.map((id) => cola.find((x) => x.o.obra_id === id)).filter((x) => x && !inicioFijo(x));
    lista = [...fijas, ...resto, ...cola.filter((x) => !inicioFijo(x) && !conf.orden.includes(x.o.obra_id))];
  }
  const libre = Array(E).fill(labDesde(hoy));
  return lista.map((x) => {
    const o = x.o, fijo = inicioFijo(x);
    const horasRef = x.prev > 0 ? x.prev : x.horas;
    const esGrande = horasRef >= grande;
    const manualEq = Number(o.cuadrilla) >= 1 && Number(o.cuadrilla) <= E ? Number(o.cuadrilla) - 1 : null;
    const quiere = esGrande ? maxT : minT;
    const pref = [...Array(E).keys()].filter((i) => maxT === minT || cuadrillas[i] === quiere);
    let eq = pref.reduce((a, i) => (libre[i] < libre[a] ? i : a), pref[0]);
    const ready = fijo ? String(fijo).slice(0, 10) : x.tramitada;
    const empieza = (i) => (fijo ? ready : (libre[i] > ready ? libre[i] : ready));
    const prefIdx = eq;
    if (manualEq != null) eq = manualEq;
    else if (conf?.asig && conf.asig[o.obra_id] != null && conf.asig[o.obra_id] < E) eq = conf.asig[o.obra_id];
    else if (conf?.regla === "antes") eq = [...Array(E).keys()].reduce((a, i) => (empieza(i) < empieza(a) ? i : a), 0);
    else {
      const otra = [...Array(E).keys()].reduce((a, i) => (libre[i] < libre[a] ? i : a), 0);
      if (Date.parse(empieza(otra)) + 30 * 86400000 < Date.parse(empieza(eq))) eq = otra;
    }
    const ini = labDesde(empieza(eq));
    const espera = !fijo && x.tramitada > libre[eq] ? { desde: libre[eq], hasta: x.tramitada } : null;
    // programada con «Programar obra»: la hacen esos operarios, no toda la cuadrilla
    const personas = Number(o.personas_plan) > 0 ? Number(o.personas_plan) : cuadrillas[eq];
    const jornadas = personas > 0 ? x.horas / (personas * JOR.horas_dia) : 0;
    const crew = Number(o.personas_plan) > 0 && o.operarios?.length ? { nombres: o.operarios } : base.nombres?.[eq] ? { nombres: base.nombres[eq] } : { n: personas };
    const fp = finPorHoras(ini, x.horas, crew);
    const finExcl = fp.finExcl, ult = fp.ult;
    // otra cuadrilla que la de su tamaño porque la suya estaba ocupada (para el motivo)
    const ocupada = !fijo && manualEq == null && !conf?.asig && conf?.regla !== "antes" && eq !== prefIdx && maxT !== minT ? { cuadrilla: prefIdx, hasta: labAntes(libre[prefIdx]) } : null;
    if (finExcl > libre[eq]) libre[eq] = finExcl;
    return { x, eq, ini, finExcl, ult, jornadas, personas, dias: fp.dias, vac: fp.vac, espera, esGrande, ocupada, fijo: !!fijo, antesDeTramite: !!(o.inicio_manual && x.pasos > 0 && ready < x.tramitada) };
  });
}

// Métricas para comparar configuraciones
function metricas(prog) {
  if (!prog.length) return { fin: null, media: null, term_31_12: 0, term_31_03: 0, dias_parados: 0 };
  const fin = prog.map((p) => p.ult).sort().pop();
  const media = new Date(prog.reduce((t, p) => t + Date.parse(p.ult), 0) / prog.length).toISOString().slice(0, 10);
  const y = Number(prog[0].ini.slice(0, 4));
  return { fin, media, term_31_12: prog.filter((p) => p.ult <= `${y}-12-31`).length, term_31_03: prog.filter((p) => p.ult <= `${y + 1}-03-31`).length,
           dias_parados: prog.reduce((t, p) => t + (p.espera ? laborables(p.espera.desde, labAntes(p.espera.hasta)) : 0), 0) };
}

// Búsqueda local: intercambiar obras cercanas de puesto y cambiar una de cuadrilla, quedándose con lo que mejora
function optimizar(base, hoy, tipo, iter = 1500) {
  const actual = programar(base, hoy);
  const libres = actual.filter((p) => !p.fijo);
  let cur = { orden: libres.map((p) => p.x.o.obra_id), asig: Object.fromEntries(actual.map((p) => [p.x.o.obra_id, p.eq])) };
  const nota = (c) => { const mm = metricas(programar(base, hoy, c)); const f = Date.parse(mm.fin), md = Date.parse(mm.media);
    return tipo === "fin" ? f * 1000 + md / 1e3 : md + f / 1e3; };
  let mejor = nota(cur), rnd = 12345;
  const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const E = base.cuadrillas.length;
  if (!cur.orden.length) return cur;
  for (let it = 0; it < iter; it++) {
    const c = { orden: [...cur.orden], asig: { ...cur.asig } };
    if (R() < 0.5) { const i = Math.floor(R() * c.orden.length), j = Math.min(c.orden.length - 1, Math.max(0, i + Math.floor(R() * 7) - 3)); [c.orden[i], c.orden[j]] = [c.orden[j], c.orden[i]]; }
    else { const id = c.orden[Math.floor(R() * c.orden.length)]; c.asig[id] = (c.asig[id] + 1) % E; }
    const v = nota(c);
    if (v < mejor) { mejor = v; cur = c; }
  }
  return cur;
}

const ETAPAS = ["Documentación", "Enviada a EMASESA", "CyCP", "Tramitada", "En obra"];
function motivo(p, hoy, nombreEq) {
  const C = nombreEq(p.eq), o = p.x.o;
  const h = Math.round(p.x.prev > 0 ? p.x.prev : p.x.horas);
  const big = p.ocupada ? ` ${p.esGrande ? `Tiene ${h} h` : `Es pequeña (${h} h)`}, pero la ${nombreEq(p.ocupada.cuadrilla)} está ocupada hasta el ${dm(p.ocupada.hasta)}: va a la ${p.eq + 1}.`
    : p.esGrande ? ` Tiene ${h} h: cuadrilla grande.` : "";
  if (o.plan?.fecha_inicio_fija || o.inicio_manual) return `Fijada a mano${o.plan?.usuario ? ` por ${o.plan.usuario}` : ""}: empieza el ${dm(p.ini)} con la ${C}.`;
  if (p.fijo) return `${p.ini <= hoy ? "En obra" : "Con fecha"}: empieza el ${dm(p.ini)} con la ${C}.`;
  if (o.plan?.posicion || o.plan?.cuadrilla) return `Movida a mano${o.plan?.usuario ? ` por ${o.plan.usuario}` : ""} («${o.plan.nota}»): entra el ${dm(p.ini)} con la ${C}.${big}`;
  if (p.espera) return `Lista hacia ${MESES[Number(p.x.tramitada.slice(5, 7)) - 1]} (trámite). La ${C} queda libre antes, el ${dm(p.espera.desde)}: espera al trámite.${big}`;
  if (p.x.pasos === 0) return `Ya tramitada: entra en cuanto la ${C} queda libre (${dm(p.ini)}).${big}`;
  return `Su trámite estará hacia ${MESES[Number(p.x.tramitada.slice(5, 7)) - 1]}; para entonces la ${C} sigue ocupada: entra el ${dm(p.ini)}.${big}`;
}

// cf = data.cashflow de /dinero-empresa. conf = alternativa a ver (sin aplicar).
// «Lista para empezar» (1): documentación según el panel de Guillermo (solo lectura)
function indicadorDoc(o, f) {
  if (o.tipo === "OO") return { verde: true, pct: null, texto: "no aplica (obra privada)", no_aplica: true };
  if (o.doc_sin_datos) return { verde: false, pct: null, texto: "sin datos en el panel de Guillermo" };
  const total = Number(o.total_docs) || 0, faltan = Number(o.faltan_docs) || 0;
  const pct = total ? Math.round((total - faltan) / total * 100) : null;
  if (f >= 9) return { verde: true, pct: 100, faltan: 0, total, texto: "100 % tramitada" };
  const fase = String(o.fase || "").slice(0, 2);
  return { verde: false, pct, faltan, total, fase, texto: `${total ? `faltan ${faltan} de ${total} · ` : ""}fase ${fase}` };
}
// «Lista para empezar» (2): vecinos que han pagado (cuenta 5610, /custodias, solo lectura).
// pendiente_eur solo lo enseña el front al CEO.
function indicadorCustodia(o, c) {
  if (o.tipo === "OO") return { verde: true, pct: null, texto: "no aplica (obra privada)", no_aplica: true };
  if (!c) return { verde: false, pct: null, sin_cuenta: true, texto: "sin cuenta de custodia (5610) en Holded" };
  const cobrado = Number(c.cobrado) || 0, previsto = c.previsto == null ? null : Number(c.previsto);
  const entregado = Number(c.entregado_emasesa) || 0, enCustodia = Number(c.en_custodia) || 0;
  const entregada = entregado > 1 ? (enCustodia <= 1 ? "entera" : "parte") : null;
  if (!(previsto > 0)) return { verde: false, pct: null, entregada, texto: "sin censo de vecinos (financiaciones_sabadell)" };
  const pendiente = Math.max(0, Math.round((previsto - cobrado) * 100) / 100);
  const pct = Math.min(100, Math.round(cobrado / previsto * 100));
  const faltan = c.vecinos_faltan != null ? c.vecinos_faltan : null;
  const verde = pendiente <= 1;
  return { verde, pct: verde ? 100 : pct, vecinos_faltan: verde ? 0 : faltan, vecinos: c.vecinos_censo ?? null, pendiente_eur: verde ? 0 : pendiente, entregada,
           texto: verde ? "100 % pagada" : `${pct} % pagada${faltan != null ? ` · faltan ${faltan} ${faltan === 1 ? "vecino" : "vecinos"}` : ""}` };
}

// «Lista para empezar» según el expediente de Guillermo (lib/expediente-estado.cjs):
//   1) documentación completa (fase 09 y «faltan 0»)
//   2) todos los pisos con contrato OK
//   3) todos los pisos con pago resuelto: OK (pagado a EMASESA) o financiado (nº de meses)
//   4) financiados: su importe frente al saldo de la 5610; si no llega, NO bloquea
//      (ARA lo adelanta a EMASESA el día de inicio: aviso y movimiento en el cash flow)
// adelantoEur solo lo enseña el front al CEO.
const lista6 = (xs) => (xs.length > 6 ? `${xs.slice(0, 6).join(", ")}…` : xs.join(", "));
const pisosTxt = (n) => `${n} ${n === 1 ? "piso" : "pisos"}`;
function estadoLista(o, f, e, adel) {
  if (o.tipo === "OO") return { lista: true, no_aplica: true, texto: "Obra privada: no pasa por EMASESA", faltas: [], financiacion: null };
  const fase = String(o.fase || "").slice(0, 2);
  if (!e) {
    const total = Number(o.total_docs) || 0, faltan = Number(o.faltan_docs) || 0;
    return { lista: false, sin_expediente: true, texto: "Sin datos del expediente (contratos y pagos de los pisos)", faltas: f >= 9 ? [] : [`Documentación: ${total ? `faltan ${faltan} de ${total} · ` : ""}fase ${fase}`], financiacion: null };
  }
  const ct = e.contratos, pg = e.pagos, d = e.documentacion;
  const faltas = [];
  const docOk = f >= 9 && (!d || d.faltan === 0);
  if (!docOk) faltas.push(`Documentación: ${d && d.total ? `faltan ${d.faltan} de ${d.total}` : "incompleta"} · fase ${fase}`);
  if (!e.pisos) faltas.push("El expediente no tiene pisos");
  if (ct.faltan.length) faltas.push(`Falta contrato: ${pisosTxt(ct.faltan.length)} (${lista6(ct.faltan)})`);
  if (pg.faltan.length) faltas.push(`Falta pago: ${pisosTxt(pg.faltan.length)} (${lista6(pg.faltan)})`);
  if (e.ccpp?.aplica && e.ccpp.contrato === false) faltas.push("Falta el contrato de la comunidad");
  if (e.ccpp?.aplica && e.ccpp.pago?.tipo === "pendiente") faltas.push("Falta el pago de la comunidad");
  const nf = pg.financiados.length;
  const meses = [...new Set(pg.financiados.map((x) => x.meses).filter(Boolean))];
  const finTxt = nf ? ` (${nf} ${nf === 1 ? "financiado" : "financiados"}${meses.length ? ` ${meses.join("/")} meses` : ""})` : "";
  const lista = docOk && e.pisos > 0 && faltas.length === 0;
  // antes de la fase 08 no hay contratos ni pagos que pedir: no se cuentan (no «0/0»)
  const sinCP = !ct.total && !pg.total;
  const resumen = sinCP ? (f < 8 ? `Contratos y pagos: todavía no (fase ${fase})` : "Sin contratos ni pagos en el expediente") : `${ct.ok}/${ct.total} contratos · ${pg.resueltos}/${pg.total} pagados${finTxt}`;
  const financiacion = sinCP || !e.pisos ? null : !nf ? { pisos: 0, texto: "Sin financiación: pagan los vecinos a EMASESA" }
    : { pisos: nf, meses, adelanto_eur: adel?.adelanto || 0, importe_eur: adel?.importe || null, cuenta_5610: !!adel?.cuenta_5610, estimado: !!adel?.estimado,
        texto: adel?.adelanto > 0 ? `${pisosTxt(nf)} ${nf === 1 ? "financiado" : "financiados"}: ARA adelanta lo que falta a EMASESA el día de inicio${adel.cuenta_5610 ? " (no lo cubre la cuenta 5610)" : " (no hay cuenta 5610)"}`
          : `${pisosTxt(nf)} ${nf === 1 ? "financiado" : "financiados"}: lo cubre la custodia de su cuenta 5610` };
  return { lista, texto: lista ? `Lista: ${resumen} · documentación completa` : resumen, faltas, financiacion,
           contratos: ct, pagos: { resueltos: pg.resueltos, total: pg.total, pagados: pg.pagados, financiados: nf }, documentacion: d };
}

function calendarioPlan({ cf, hoy, borrador = null, modo = "simulacion", nombresCuadrillas = null, tam = null, conf = null, alternativas = false, festivos = null, jornada = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { ok: false, error: cf?.simulador?.error || "sin datos de la cartera (posicion-neta-real)" };
  const fest = festivos || leerFestivos(null);
  setFestivos(fest.lista);
  setJornada(jornada, hoy);
  const H = JOR.horas_dia;
  const base = preparar({ cf, hoy, borrador, tam, nombres: nombresCuadrillas });
  const confReal = conf?.regla || conf?.orden ? conf : null;
  const prog = programar(base, hoy, confReal);
  const actual = confReal ? programar(base, hoy) : prog;
  const puestoActual = Object.fromEntries(actual.map((p, i) => [p.x.o.obra_id, i + 1]));
  const nombreEq = (e) => `Cuadrilla ${e + 1}`;
  const lista = prog.map((p, i) => {
    const o = p.x.o;
    const enObra = p.ini <= hoy || (Number(o.horas_registradas) || 0) > 0;
    // Planificada: programada con «Programar obra», con fecha fija (OT, OO) o con fila en planificacion_obras
    const planificada = !enObra && (Number(o.personas_plan) > 0 || !!o.inicio_fijo || !!o.plan);
    const exp = estadoLista(o, p.x.f, cf.expedientes ? cf.expedientes[o.obra_id] : null, (cf.adelantos_financiados || []).find((a) => a.ccpp_id === o.obra_id));
    const estado = enObra ? "en_ejecucion" : p.fijo ? "agendada" : "propuesta";
    const etapa = enObra ? 4 : p.x.f >= 9 ? 3 : p.x.f >= 7 ? 2 : p.x.f === 6 ? 1 : 0;
    const prevH = p.x.prev > 0 ? p.x.prev : p.x.horas;
    const reg = Number(o.horas_registradas) || 0;
    return {
      puesto: i + 1, puesto_antes: confReal && puestoActual[o.obra_id] !== i + 1 ? puestoActual[o.obra_id] : null,
      obra_id: o.obra_id, nombre: o.nombre, fase: o.fase, tipo: o.tipo || null, estado, manual: !!(o.plan || o.inicio_manual), plan: o.plan || null,
      equipo: p.eq + 1, cuadrilla: base.cuadrillas[p.eq], grande: p.esGrande,
      inicio: p.ini, fin: p.ult, fin_exclusivo: p.finExcl, jornadas: r1(p.jornadas), dias_laborables: p.dias, dias_vacaciones: p.vac,
      tramitada: p.x.tramitada, antes_de_tramite: p.antesDeTramite, espera: p.espera,
      etapa, etapa_txt: ETAPAS[etapa], estado_doc: o.estado_doc || null, atascada_dias: o.atascada_dias || null, sin_presupuesto: !(Number(o.importe) > 0),
      motivo: motivo(p, hoy, nombreEq),
      // «Planificada» (Programar obra) · «Sugerencia» (orden automático) · «En obra»
      estado_plan: enObra ? "en_obra" : planificada ? "planificada" : "sugerencia",
      programada: o.plan ? { usuario: o.plan.usuario || "", fecha: o.plan.fecha || "", nota: o.plan.nota || "", origen: "planificacion" }
        : planificada && o.inicio_fijo ? { usuario: "", fecha: "", nota: "", origen: o.tipo === "OO" ? "oo" : "ot" } : null,
      operarios: Number(o.personas_plan) > 0 ? o.operarios : (nombresCuadrillas?.[p.eq] || null),
      operarios_de: Number(o.personas_plan) > 0 ? "programada" : "cuadrilla",
      personas: p.personas,
      expediente: exp, lista_para_empezar: exp.lista,
      horas_previstas: r1(prevH), horas_tope_margen: p.x.tope ? r1(p.x.horas) : null, horas_plan: r1(p.x.horas),
      horas_registradas: r1(reg), horas_quedan: r1(Math.max(0, prevH - reg)), consumo_pct: prevH > 0 ? Math.round(reg / prevH * 100) : null,
    };
  });
  const visibles = modo === "real" ? lista.filter((x) => x.estado !== "propuesta") : lista;
  // Avisos (sin euros)
  const avisos = [];
  const desvio = base.m.desvio || 0;
  for (const x of lista.filter((y) => y.horas_tope_margen)) {
    const j = Math.ceil(x.jornadas - 1e-9), jr = Math.ceil(x.horas_plan * (1 + desvio / 100) / (x.cuadrilla * H) - 1e-9);
    avisos.push({ nivel: "ambar", texto: `${x.nombre} ${x.inicio > hoy ? "empieza" : "empezó"} el ${dm(x.inicio)} con la Cuadrilla ${x.equipo}: tope de ${Math.round(x.horas_plan)} h para el margen mínimo = ${j} jornadas (último día ${dm(x.fin)}).${desvio > 0 ? ` Al ritmo de las obras terminadas (+${desvio} %) serían ${jr} jornadas: hay que ir más rápido.` : ""} Registrar las horas cada día contra su OT.` });
  }
  // custodia de vecinos: el día de inicio hay que entregarla a EMASESA (sin euros)
  const conCustodia = S.entregasCustodia(cf.custodias_obras || [], lista.map((x) => ({ obra_id: x.obra_id, nombre: x.nombre, inicio: x.inicio })), hoy).entregas;
  for (const e of conCustodia) { const x = lista.find((y) => y.obra_id === e.obra_id); if (x) x.custodia = true; }
  if (conCustodia.length) avisos.push({ nivel: "ambar", texto: `El día de inicio hay que entregar la custodia a EMASESA: ${conCustodia.map((e) => `${e.nombre} (${dm(e.fecha)})`).join(" · ")}.` });
  // pisos financiados que no cubre la 5610: ARA adelanta a EMASESA el día de inicio (sin euros aquí)
  const adel = lista.filter((x) => x.expediente?.financiacion?.adelanto_eur > 0);
  if (adel.length) avisos.push({ nivel: "ambar", texto: `Pisos financiados: ARA adelanta a EMASESA el día de inicio lo que no cubre la cuenta 5610 en ${adel.map((x) => `${x.nombre} (${x.expediente.financiacion.pisos} ${x.expediente.financiacion.pisos === 1 ? "piso" : "pisos"}, ${dm(x.inicio)})`).join(" · ")}. Está en el cash flow.` });
  const sinHoras = base.terminadas.filter((t) => !(Number(t.horas_registradas) > 0));
  if (sinHoras.length) avisos.push({ nivel: "ambar", texto: `Terminadas sin horas registradas: ${sinHoras.map((t) => t.nombre).join(", ")}.` });
  const recientes = base.terminadas.filter((t) => t.fin_con_fecha && t.fin >= dia(hoy, -14) && Number(t.horas_registradas) > 0);
  if (recientes.length) avisos.push({ nivel: "ambar", texto: `Ya terminadas (no se planifican): ${recientes.map((t) => `${t.nombre} (${t.horas_previstas ? `${Math.round(t.horas_registradas)} de ${Math.round(t.horas_previstas)} h, ` : ""}fin ${dm(t.fin)})`).join(" · ")}.` });
  for (const x of lista.filter((y) => y.sin_presupuesto)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: sin presupuesto${x.atascada_dias ? `, expediente atascado ${x.atascada_dias} días` : ""}.` });
  for (const x of lista.filter((y) => y.antes_de_tramite)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: la fecha fijada es anterior a estar tramitada (≈ ${dm(x.tramitada)}); se programa entonces.` });
  const jf = JOR.jornada.fuente;
  if (jf.horas_dia !== "config_dinero" || jf.vacaciones_dias !== "config_dinero") avisos.push({ nivel: "ambar", texto: `Jornada: falta ${[jf.horas_dia !== "config_dinero" ? "«horas_dia»" : null, jf.vacaciones_dias !== "config_dinero" ? "«vacaciones_dias»" : null].filter(Boolean).join(" y ")} en config_dinero; se usa el convenio del Metal de Sevilla (${String(H).replace(".", ",")} h por día, ${JOR.jornada.vacaciones_dias} días de vacaciones en agosto).` });
  if (JOR.jornada.errores.length) avisos.push({ nivel: "rojo", texto: `config_dinero (jornada): ${JOR.jornada.errores.join(" · ")}.` });
  if (fest.fuente === "por_defecto") avisos.push({ nivel: "ambar", texto: "Festivos: falta la clave «festivos» en config_dinero; se usan los nacionales, de Andalucía y de Sevilla de 2026-2027 que lleva el programa (los de 2027, provisionales)." });
  if (fest.errores?.length) avisos.push({ nivel: "rojo", texto: `config_dinero «festivos»: fechas que no se entienden (AAAA-MM-DD): ${fest.errores.join(", ")}.` });
  // Cartera planificada: horas pendientes (presupuesto, sin desvío) ÷ (todas las personas × 8 h),
  // en días laborables desde el próximo (sin fines de semana ni festivos)
  const horasCartera = r1(lista.reduce((t, x) => t + (Number(x.horas_plan) || 0), 0));
  const personasTot = base.cuadrillas.reduce((t, n) => t + n, 0);
  const jornadasCartera = personasTot > 0 ? Math.round(horasCartera / (personasTot * H)) : null;
  // todas las personas a la vez, día a día, sin las que estén de vacaciones
  const todos = base.nombres.length === base.cuadrillas.length && base.nombres.every(Boolean) ? { nombres: base.nombres.flat() } : { n: personasTot };
  const fc = jornadasCartera ? finPorHoras(dia(hoy, 1), horasCartera, todos) : null;
  const ultimoCartera = fc ? fc.ult : null;
  const cartera = { horas: horasCartera, obras: lista.length, personas: personasTot, horas_dia: H, jornadas: jornadasCartera, dias_vacaciones: fc ? fc.vac : 0, desde: labDesde(dia(hoy, 1)), ultimo_dia: ultimoCartera,
                    ...(ultimoCartera ? mesesYDias(hoy, ultimoCartera) : { meses: null, dias: null }), fin_calendario: null };
  const out = {
    ok: true, hoy, modo, horas_dia: H, festivos: fest.lista, festivos_fuente: fest.fuente, cartera,
    // vacaciones (para recalcular en «Programar obra»): las de agosto por defecto y las de quien tiene fechas propias
    jornada: { horas_dia: H, vacaciones_dias: JOR.jornada.vacaciones_dias, fuente: JOR.jornada.fuente, personas_con_fechas: Object.keys(JOR.jornada.personas) },
    vacaciones: { defecto: [...JOR.defecto], por_persona: Object.fromEntries(Object.keys(JOR.jornada.personas).map((n) => [n, [...vacDe(n)]])) },
    resumen_plan: { planificadas: lista.filter((x) => x.estado_plan === "planificada").length, sugerencias: lista.filter((x) => x.estado_plan === "sugerencia").length, en_obra: lista.filter((x) => x.estado_plan === "en_obra").length },
    cuadrillas: base.cuadrillas.map((n, i) => ({ n: i + 1, personas: n, nombre: nombreEq(i), quienes: nombresCuadrillas?.[i] || null,
      grandes: base.cuadrillas.length > 1 && n === Math.max(...base.cuadrillas) && Math.max(...base.cuadrillas) !== Math.min(...base.cuadrillas) })),
    reglas: { grande: base.m.grande ?? 300, tram: base.m.tram ?? 1, desvio_cashflow: desvio },
    obras: visibles,
    terminadas: base.terminadas.map((t) => ({ obra_id: t.obra_id, nombre: t.nombre, fin: t.fin })),
    avisos, metricas: metricas(prog), viendo: confReal ? (conf.k || "prueba") : null,
    planificacion: cf.planificacion || null,
  };
  out.cartera.fin_calendario = out.metricas.fin;
  if (alternativas) {
    const mA = metricas(actual);
    const alts = [
      { id: "actual", k: "Actual · orden por trámite, obras grandes a la cuadrilla grande", conf: null },
      { id: "fin", k: "Optimizada · que acabe antes toda la cartera", conf: optimizar(base, hoy, "fin") },
      { id: "media", k: "Optimizada · que se terminen antes las obras (fecha media de fin)", conf: optimizar(base, hoy, "media") },
      { id: "antes", k: "Cada obra a la cuadrilla que antes pueda empezar", conf: { regla: "antes" } },
    ];
    out.alternativas = alts.map((a) => {
      const p = a.conf ? programar(base, hoy, a.conf) : actual;
      const mm = metricas(p);
      const pos = Object.fromEntries(actual.map((q, i) => [q.x.o.obra_id, i]));
      const eqA = Object.fromEntries(actual.map((q) => [q.x.o.obra_id, q.eq]));
      return { id: a.id, k: a.k, metricas: mm,
        dif_fin_dias: mm.fin && mA.fin ? Math.round((Date.parse(mm.fin) - Date.parse(mA.fin)) / 86400000) : 0,
        dif_media_dias: mm.media && mA.media ? Math.round((Date.parse(mm.media) - Date.parse(mA.media)) / 86400000) : 0,
        cambian_puesto: p.filter((q, i) => pos[q.x.o.obra_id] !== i).length, cambian_cuadrilla: p.filter((q) => eqA[q.x.o.obra_id] !== q.eq).length,
        // lo que se guarda al aplicar: puesto y cuadrilla de cada obra no fijada
        conf: a.conf ? { ...a.conf, k: a.k } : null,
        aplicar: p.map((q, i) => ({ obra_id: q.x.o.obra_id, posicion: i + 1, cuadrilla: q.eq + 1, fijada: q.fijo })).filter((q) => !q.fijada) };
    });
  }
  return out;
}

// Fecha de inicio de cada obra según Planificación (jornadas, sin desvío):
// las entregas de custodia a EMASESA del cash flow van en esta fecha
function fechasInicioPlan({ cf, hoy, festivos = null, jornada = null, nombresCuadrillas = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return {};
  setFestivos((festivos || leerFestivos(null)).lista);
  setJornada(jornada, hoy);
  const base = preparar({ cf, hoy, nombres: nombresCuadrillas });
  return Object.fromEntries(programar(base, hoy).map((p) => [p.x.o.obra_id, p.ini]));
}

module.exports = { estadoLista, setJornada, finPorHoras, setFestivos, enesimoLaborable, mesesYDias, indicadorDoc, indicadorCustodia, fechasInicioPlan, calendarioPlan, laborables, personasPorCuadrilla, textoPersonas, sumarJornadas, programar, preparar, metricas, optimizar, HORAS_DIA };
