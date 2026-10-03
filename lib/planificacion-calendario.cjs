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

const HORAS_DIA = 8;
const DIAS_MES = 30.4375;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const dia = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const esLab = (iso) => { const d = new Date(iso + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6; };
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
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 86400000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
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
function preparar({ cf, hoy, borrador = null, tam = null }) {
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
  return { m, cuadrillas, cola, terminadas: sim0.terminadas, avisosSim: sim0.avisos };
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
    if (manualEq != null) eq = manualEq;
    else if (conf?.asig && conf.asig[o.obra_id] != null && conf.asig[o.obra_id] < E) eq = conf.asig[o.obra_id];
    else if (conf?.regla === "antes") eq = [...Array(E).keys()].reduce((a, i) => (empieza(i) < empieza(a) ? i : a), 0);
    else {
      const otra = [...Array(E).keys()].reduce((a, i) => (libre[i] < libre[a] ? i : a), 0);
      if (Date.parse(empieza(otra)) + 30 * 86400000 < Date.parse(empieza(eq))) eq = otra;
    }
    const ini = labDesde(empieza(eq));
    const espera = !fijo && x.tramitada > libre[eq] ? { desde: libre[eq], hasta: x.tramitada } : null;
    const jornadas = cuadrillas[eq] > 0 ? x.horas / (cuadrillas[eq] * HORAS_DIA) : 0;
    const finExcl = sumarJornadas(ini, Math.max(jornadas, 1e-6));
    const ult = labAntes(finExcl) < ini ? ini : labAntes(finExcl);
    if (finExcl > libre[eq]) libre[eq] = finExcl;
    return { x, eq, ini, finExcl, ult, jornadas, espera, esGrande, fijo: !!fijo, antesDeTramite: !!(o.inicio_manual && ready < x.tramitada) };
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
  const big = p.esGrande ? ` Tiene ${Math.round(p.x.prev > 0 ? p.x.prev : p.x.horas)} h: cuadrilla grande.` : "";
  if (o.plan?.fecha_inicio_fija || o.inicio_manual) return `Fijada a mano${o.plan?.usuario ? ` por ${o.plan.usuario}` : ""}: empieza el ${dm(p.ini)} con la ${C}.`;
  if (p.fijo) return `${p.ini <= hoy ? "En obra" : "Con fecha"}: empieza el ${dm(p.ini)} con la ${C}.`;
  if (o.plan?.posicion || o.plan?.cuadrilla) return `Movida a mano${o.plan?.usuario ? ` por ${o.plan.usuario}` : ""} («${o.plan.nota}»): entra el ${dm(p.ini)} con la ${C}.${big}`;
  if (p.espera) return `Lista hacia ${MESES[Number(p.x.tramitada.slice(5, 7)) - 1]} (trámite). La ${C} queda libre antes, el ${dm(p.espera.desde)}: espera al trámite.${big}`;
  if (p.x.pasos === 0) return `Ya tramitada: entra en cuanto la ${C} queda libre (${dm(p.ini)}).${big}`;
  return `Su trámite estará hacia ${MESES[Number(p.x.tramitada.slice(5, 7)) - 1]}; para entonces la ${C} sigue ocupada: entra el ${dm(p.ini)}.${big}`;
}

// cf = data.cashflow de /dinero-empresa. conf = alternativa a ver (sin aplicar).
function calendarioPlan({ cf, hoy, borrador = null, modo = "simulacion", nombresCuadrillas = null, tam = null, conf = null, alternativas = false }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { ok: false, error: cf?.simulador?.error || "sin datos de la cartera (posicion-neta-real)" };
  const base = preparar({ cf, hoy, borrador, tam });
  const confReal = conf?.regla || conf?.orden ? conf : null;
  const prog = programar(base, hoy, confReal);
  const actual = confReal ? programar(base, hoy) : prog;
  const puestoActual = Object.fromEntries(actual.map((p, i) => [p.x.o.obra_id, i + 1]));
  const nombreEq = (e) => `Cuadrilla ${e + 1}`;
  const lista = prog.map((p, i) => {
    const o = p.x.o;
    const enObra = p.ini <= hoy;
    const estado = enObra ? "en_ejecucion" : p.fijo ? "agendada" : "propuesta";
    const etapa = enObra ? 4 : p.x.f >= 9 ? 3 : p.x.f >= 7 ? 2 : p.x.f === 6 ? 1 : 0;
    const prevH = p.x.prev > 0 ? p.x.prev : p.x.horas;
    const reg = Number(o.horas_registradas) || 0;
    return {
      puesto: i + 1, puesto_antes: confReal && puestoActual[o.obra_id] !== i + 1 ? puestoActual[o.obra_id] : null,
      obra_id: o.obra_id, nombre: o.nombre, fase: o.fase, tipo: o.tipo || null, estado, manual: !!(o.plan || o.inicio_manual), plan: o.plan || null,
      equipo: p.eq + 1, cuadrilla: base.cuadrillas[p.eq], grande: p.esGrande,
      inicio: p.ini, fin: p.ult, fin_exclusivo: p.finExcl, jornadas: r1(p.jornadas), dias_laborables: Math.max(1, Math.ceil(p.jornadas - 1e-9)),
      tramitada: p.x.tramitada, antes_de_tramite: p.antesDeTramite, espera: p.espera,
      etapa, etapa_txt: ETAPAS[etapa], estado_doc: o.estado_doc || null, atascada_dias: o.atascada_dias || null, sin_presupuesto: !(Number(o.importe) > 0),
      motivo: motivo(p, hoy, nombreEq),
      horas_previstas: r1(prevH), horas_tope_margen: p.x.tope ? r1(p.x.horas) : null, horas_plan: r1(p.x.horas),
      horas_registradas: r1(reg), horas_quedan: r1(Math.max(0, prevH - reg)), consumo_pct: prevH > 0 ? Math.round(reg / prevH * 100) : null,
    };
  });
  const visibles = modo === "real" ? lista.filter((x) => x.estado !== "propuesta") : lista;
  // Avisos (sin euros)
  const avisos = [];
  const desvio = base.m.desvio || 0;
  for (const x of lista.filter((y) => y.horas_tope_margen)) {
    const j = Math.ceil(x.jornadas - 1e-9), jr = Math.ceil(x.horas_plan * (1 + desvio / 100) / (x.cuadrilla * HORAS_DIA) - 1e-9);
    avisos.push({ nivel: "ambar", texto: `${x.nombre} ${x.inicio > hoy ? "empieza" : "empezó"} el ${dm(x.inicio)} con la Cuadrilla ${x.equipo}: tope de ${Math.round(x.horas_plan)} h para el margen mínimo = ${j} jornadas (último día ${dm(x.fin)}).${desvio > 0 ? ` Al ritmo de las obras terminadas (+${desvio} %) serían ${jr} jornadas: hay que ir más rápido.` : ""} Registrar las horas cada día contra su OT.` });
  }
  const recientes = base.terminadas.filter((t) => t.fin_con_fecha && t.fin >= dia(hoy, -14));
  if (recientes.length) avisos.push({ nivel: "ambar", texto: `Ya terminadas (no se planifican): ${recientes.map((t) => `${t.nombre} (${t.horas_previstas ? `${Math.round(t.horas_registradas)} de ${Math.round(t.horas_previstas)} h, ` : ""}fin ${dm(t.fin)})`).join(" · ")}.` });
  for (const x of lista.filter((y) => y.sin_presupuesto)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: sin presupuesto${x.atascada_dias ? `, expediente atascado ${x.atascada_dias} días` : ""}.` });
  for (const x of lista.filter((y) => y.antes_de_tramite)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: la fecha fijada es anterior a estar tramitada (≈ ${dm(x.tramitada)}); se programa entonces.` });
  const out = {
    ok: true, hoy, modo, horas_dia: HORAS_DIA,
    cuadrillas: base.cuadrillas.map((n, i) => ({ n: i + 1, personas: n, nombre: nombreEq(i), quienes: nombresCuadrillas?.[i] || null,
      grandes: base.cuadrillas.length > 1 && n === Math.max(...base.cuadrillas) && Math.max(...base.cuadrillas) !== Math.min(...base.cuadrillas) })),
    reglas: { grande: base.m.grande ?? 300, tram: base.m.tram ?? 1, desvio_cashflow: desvio },
    obras: visibles,
    terminadas: base.terminadas.map((t) => ({ obra_id: t.obra_id, nombre: t.nombre, fin: t.fin })),
    avisos, metricas: metricas(prog), viendo: confReal ? (conf.k || "prueba") : null,
    planificacion: cf.planificacion || null,
  };
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

module.exports = { calendarioPlan, laborables, personasPorCuadrilla, textoPersonas, sumarJornadas, programar, preparar, metricas, optimizar, HORAS_DIA };
