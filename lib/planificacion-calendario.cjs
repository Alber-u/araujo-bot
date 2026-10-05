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
const AV = require("./avance-certificaciones.cjs");
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
// tramos (05/10/2026, «Cambiar personas desde»): [{ desde, crew }]; cada día manda el último que ya empezó
// hPersona: horas de cada persona al día (por defecto la jornada; con el ritmo real, lo que rinden de verdad)
const crewDeDia = (crew, tramos, d) => { let c = crew; for (const t of tramos || []) if (t.desde <= d) c = t.crew; return c; };
function finPorHoras(ini, horas, crew, tramos = null, hPersona = null) {
  let x = labDesde(ini), resto = horas, dias = 0, vac = 0;
  const crewDia = (d) => crewDeDia(crew, tramos, d);
  for (let g = 0; g < 4000; g++) {
    const c = disponibles(crewDia(x), x) * (hPersona ?? JOR.horas_dia);
    if (c > 0) { resto -= c; dias++; if (resto <= 1e-6) break; } else vac++;
    x = dia(x, 1); while (!esLab(x)) x = dia(x, 1);
  }
  let fe = dia(x, 1); while (!esLab(fe)) fe = dia(fe, 1);
  return { ult: x, finExcl: fe, dias: Math.max(1, dias), vac };
}
const esLabSemana = (iso) => { const d = new Date(iso + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6; };
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
const yLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] || "");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const faseNum = (o) => Number(String(o.fase || "").slice(0, 2)) || 0;

// Quién forma cada cuadrilla, en config_dinero:
//   · «cuadrilla_personas» (la de ahora): «1:Antonio;Pepe|2:Juan;Luis;Mario»
//   · «cuadrillas_personas» (la de antes): «Cuadrilla 1: Antonio, Pepe; Cuadrilla 2: Juan, Luis, Mario»
// Devuelve [[nombres de la 1], [de la 2]…]; una cuadrilla que no se dice queda null.
function personasPorCuadrilla(txt) {
  if (!txt || !String(txt).trim()) return null;
  const t = String(txt).trim();
  if (t.includes("|") || /^\d+\s*:/.test(t)) {
    const out = [];
    for (const trozo of t.split("|")) {
      const m = trozo.match(/^\s*(\d+)\s*:(.*)$/);
      if (!m) continue;
      const xs = m[2].split(/[;,]+/).map((n) => n.trim()).filter(Boolean);
      if (Number(m[1]) >= 1 && xs.length) out[Number(m[1]) - 1] = xs;
    }
    return out.length ? Array.from({ length: out.length }, (_, i) => out[i] || null) : null;
  }
  return t.split(/[;\n]+/).map((x) => x.replace(/^[^:]*:/, (m) => (/cuadrilla/i.test(m) ? "" : m)))
    .map((x) => x.split(",").map((n) => n.trim()).filter(Boolean)).filter((x) => x.length);
}
const textoPersonas = (q) => q.map((xs, i) => `Cuadrilla ${i + 1}: ${xs.join(", ")}`).join("; ");
// para guardar en config_dinero «cuadrilla_personas»
const textoCuadrillaPersonas = (q) => q.map((xs, i) => `${i + 1}:${xs.join(";")}`).join("|");

// Horas fichadas (registros de tiempo) de cada obra: total y, por día, horas y personas distintas.
// Lo pasado manda en los registros (05/10/2026): las horas que quedan y quién fue de verdad.
const normR = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^ccpp\s+/, "").replace(/[^a-z0-9]/g, "");
function fichadoPorObra(obras, registros) {
  const out = new Map();
  if (!Array.isArray(registros)) return out;
  const idx = new Map();
  for (const o of obras || []) {
    for (const k of [o.nombre, ...(o.alias || []), ...String(o.obra_id || "").split("+")]) { const n = normR(k); if (n && !idx.has(n)) idx.set(n, o.obra_id); }
  }
  for (const r of registros) {
    const id = idx.get(normR(r.obra));
    if (!id) continue;
    const f = out.get(id) || { total: 0, dias: new Map() };
    f.total += Number(r.horas) || 0;
    const d = f.dias.get(r.fecha) || { horas: 0, personas: new Set() };
    d.horas += Number(r.horas) || 0; if (r.persona) d.personas.add(r.persona);
    f.dias.set(r.fecha, d); out.set(id, f);
  }
  return out;
}

// Base común: cola, horas del presupuesto y fecha de trámite de cada obra
// registros: horas de trabajo fichadas [{ fecha, persona, obra, horas }] (o null: las del cash flow)
// Visitas de una ficha de Certificaciones. Si los datos no traen la lista (una carga guardada antes del
// 07/10/2026: Montemayor llegaba con la última visita, el 02/10, y «visitas: []»), la última que sí traen
// (fecha y % ejecutado). Ninguna se descarta: tampoco las de 0 % o sin partidas avanzadas.
function visitasCert(c) {
  const vs = (Array.isArray(c?.visitas) ? c.visitas : []).filter((v) => v && v.fecha).map((v) => ({ ...v, fecha: String(v.fecha).slice(0, 10) }));
  const ultima = c?.ultima_visita_fecha ? String(c.ultima_visita_fecha).slice(0, 10) : null;
  if (ultima && !vs.some((v) => v.fecha === ultima)) {
    vs.push({ visita_id: null, fecha: ultima, estado: c.visita_abierta_fecha && String(c.visita_abierta_fecha).slice(0, 10) === ultima ? "abierta" : null,
      avance_pct: Number(c.avance_pct) || 0, partidas_con_avance: null, partidas: c.partidas_activas ?? null, horas_fichadas: c.horas_fichadas_visita ?? null,
      desvio_horas: c.desvio_horas ?? null, retraso_dias: null, color: null });
  }
  return vs;
}

// Certificaciones de cada obra (por su nombre, el de sus OO o su id; sin tildes ni mayúsculas). Si una
// obra tiene varias (Urbano Orad con el nombre de cada OO), la de la visita más reciente.
function certPorObra(obras, certs) {
  const out = new Map();
  if (!Array.isArray(certs)) return out;
  const porNombre = new Map();
  for (const c of certs) { const n = normR(c.obra_id); if (n) porNombre.set(n, [...(porNombre.get(n) || []), c]); }
  for (const o of obras || []) {
    const cs = [...new Set([o.nombre, ...(o.alias || []), ...String(o.obra_id || "").split("+")].map(normR).filter(Boolean))].flatMap((n) => porNombre.get(n) || []);
    if (!cs.length) continue;
    const mejor = cs.sort((a, b) => String(b.ultima_visita_fecha || "").localeCompare(String(a.ultima_visita_fecha || "")))[0];
    // las visitas de todas (Orad: las de sus dos OO), sin repetir, en orden
    const visitas = [...new Map(cs.flatMap(visitasCert).map((v) => [v.visita_id || v.fecha, v])).values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    // UNA fuente (07/10/2026): «toca visitar», el fin estimado y los ◆ del calendario salen de esta lista;
    // la última visita es la última de la lista (antes cada uno leía un campo y se separaron)
    const ult = visitas[visitas.length - 1] || null;
    out.set(o.obra_id, { ...mejor, visitas, ultima_visita_fecha: ult ? ult.fecha : null, avance_pct: ult ? Number(ult.avance_pct) || 0 : 0,
      horas_fichadas_visita: ult && ult.horas_fichadas != null ? ult.horas_fichadas : mejor.horas_fichadas_visita });
  }
  return out;
}

function preparar({ cf, hoy, borrador = null, tam = null, nombres = null, registros = null }) {
  const m = cf.automatico.mandos;
  // Obras privadas en marcha (Otras órdenes, sin programar en Planificación): una cuadrilla hace una
  // obra a la vez, así que van en cola, una detrás de otra, delante de las sugerencias (las empujan).
  // Sin horas registradas en los últimos 14 días (ni empezada en ellos): no ocupan cuadrilla, aviso.
  const ooParadas = [];
  // horas fichadas en vivo (las del cash flow pueden venir de una carga de hace horas): si las hay,
  // mandan; así «0 / 109 h» y «7,2 h/día la última semana» no se contradicen
  const fich = fichadoPorObra(cf.simulador.obras, registros);
  const certs = certPorObra(cf.simulador.obras, cf.certificaciones);
  const conFichado = (o) => {
    const f = fich.get(o.obra_id), c = certs.get(o.obra_id);
    const o1 = c ? { ...o, _cert: c } : o;
    return f && f.total > 0 ? { ...o1, horas_registradas: Math.round(f.total * 10) / 10, _real: f } : o1;
  };
  // pausa con fecha («se termina después» desde el día del tramo): llegado ese día, pausada normal
  const pausaLlegada = (o) => (o.pausa_desde && o.pausa_desde <= hoy ? { ...o, pausa_desde: null, empezada: null, inicio_fijo: null, inicio_manual: false } : o);
  const obras = S.aplicarCambioPlan(cf.simulador.obras, borrador).map(conFichado).map(pausaLlegada).flatMap((o) => {
    if (o.tipo !== "OO" || !o.oo_en_ejecucion || o.plan || o.inicio_manual || Number(o.personas_plan) > 0) return [o];
    const ref = [o.ultima_hora, o.inicio_hoja].filter(Boolean).sort().pop() || null;
    if (!ref || ref < dia(hoy, -14)) { ooParadas.push({ obra_id: o.obra_id, nombre: o.nombre, desde: o.ultima_hora || null }); return []; }
    return [{ ...o, empezada: null, inicio_fijo: null, oo_cola: true }];
  });
  const cuadrillas = tam && tam.length ? tam : (m.cuadrillas || [2, 3]);
  // horas del presupuesto (sin desvío): las mismas que el simulador con desvío 0
  const sim0 = S.simular({ obras, historico: cf.simulador.historico, hoy, mandos: { ...m, desvio: 0, cuadrillas } });
  const horas = Object.fromEntries(sim0.prog.map((p) => [p.obra_id, p.horas]));
  const cola0 = S.colaObras(obras, hoy).map((o) => {
    const av = S.avance(o), f = faseNum(o);
    const empezada = av > 0 || !!o.empezada;
    const pasos = empezada ? 0 : (o.pasos != null ? Number(o.pasos) : (f >= 9 ? 0 : 9 - f));
    const tramitada = labDesde(dia(hoy, Math.round(pasos * (m.tram ?? 1) * DIAS_MES)));
    const prev = Number(o.horas_previstas) || 0;
    return { o, av, f, empezada, pasos, tramitada, prev, horas: horas[o.obra_id] ?? prev * (1 - av), tope: (!(prev > 0) && !!o.margen_objetivo) || !!o.horas_tope_fijo };
  });
  // las fijas primero (reservan su tramo), luego las privadas en marcha (las más recientes en horas
  // primero) y después el resto de la cola
  const fija = (x) => !!(x.o.inicio_fijo || x.o.empezada);
  const refOO = (x) => String(x.o.ultima_hora || x.o.inicio_hoja || "");
  // las pausadas («Pausar obra») vuelven las primeras en cuanto su cuadrilla quede libre
  const pausada = (x) => !fija(x) && !!x.o.pausada;
  // (después de las privadas en marcha: si una se llevó a su gente, la pausada vuelve cuando la suelte)
  const cola = [...cola0.filter(fija), ...cola0.filter((x) => !fija(x) && !pausada(x) && x.o.oo_cola).sort((a, b) => refOO(b).localeCompare(refOO(a))), ...cola0.filter(pausada), ...cola0.filter((x) => !fija(x) && !pausada(x) && !x.o.oo_cola)];
  // nombres de cada cuadrilla (si cuadran con su tamaño): para sus vacaciones
  const nombresOk = (nombres || []).map((xs, i) => (xs && xs.length === cuadrillas[i] ? xs : null));
  return { m, cuadrillas, cola, terminadas: sim0.terminadas, avisosSim: sim0.avisos, nombres: nombresOk, nombresTodos: nombres || [], ooParadas };
}

// Coloca la cola en jornadas. conf = { orden: [obra_id…], asig: { obra_id: equipo (0, 1…) }, regla: "actual"|"antes" }
// Ritmo real de una obra en obra (06/10/2026): lo fichado en los últimos 5 días laborables antes de hoy
// (desde que empezó, si hace menos). h_dia = horas fichadas ÷ días; h_persona = lo que rinde cada persona
// programada esos días (para seguir con las personas de cada tramo: «Cambiar personas desde»).
// null: empezó hoy o después (todavía no hay ritmo que medir).
// Los días sin fichajes cuentan como 0 h. El inicio es el primer día fichado si es anterior a su fecha
// de inicio (06/10/2026: Montemayor salía con 36 h en 1 día = 36 h/día y fin el 07/10 porque su inicio
// era el 05/10 y lo fichado venía de antes).
function ritmoDe(o, hoy, ini, crew, tramos) {
  const primero = o._real?.dias ? [...o._real.dias.keys()].filter((d) => d < hoy).sort()[0] : null;
  const desde = primero && primero < ini ? primero : ini;
  const dias = [];
  for (let x = hoy; dias.length < 5;) { x = labAntes(x); if (x < desde) break; dias.push(x); }
  if (!dias.length) return null;
  const horas = dias.reduce((t, d) => t + (o._real?.dias?.get(d)?.horas || 0), 0);
  // (06/10/2026) ritmo = horas fichadas ÷ (días laborables × personas que ficharon) × personas programadas.
  // Montemayor: 36 h de 5 personas en 1 día = 7,2 h por persona → 2 programadas = 14,4 h/día (no 36).
  // Sin nombres en los registros: las personas programadas.
  const quienes = new Set(dias.flatMap((d) => [...(o._real?.dias?.get(d)?.personas || [])]));
  const programadas = disponibles(crewDeDia(crew, tramos, hoy), hoy) || disponibles(crew, hoy) || 1;
  const hPersona = horas > 0 ? horas / (dias.length * (quienes.size || programadas)) : 0;
  return { horas: Math.round(horas * 10) / 10, dias: dias.length, desde: dias[dias.length - 1], personas_fichan: quienes.size || null,
           h_persona: hPersona, h_dia: hPersona * programadas,
           // con menos de 3 días laborables de datos no se usa: el fin previsto («pocos datos de ritmo»)
           pocos_datos: dias.length < RITMO_DIAS_MIN };
}
const RITMO_DIAS_MIN = 3;

// opts.sinRitmo: con el fin previsto aunque la obra vaya lenta (para saber cuánto empuja el ritmo real)
// opts.sinTramos: sin «Cambiar personas» (para saber qué obras mueve; el cash flow toma esas fechas)
function programar(base, hoy, conf = null, opts = {}) {
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
  // libre[i]: fin de la última obra NO fijada de la cuadrilla i (la cola, en orden).
  // ocupado[i]: tramos de las obras con fecha (fijadas a mano, OT/OO o en obra): las demás se
  // colocan en los huecos de antes y de después, sin pasar por encima (antes, una obra fijada
  // más adelante mandaba todas las sugerencias detrás de ella)
  const libre = Array(E).fill(labDesde(hoy));
  const ocupado = Array.from({ length: E }, () => []);
  const crewDe = (o, i, personas) => (Number(o.personas_plan) > 0 && o.operarios?.length ? { nombres: o.operarios } : base.nombres?.[i] ? { nombres: base.nombres[i] } : { n: personas });
  // primer inicio desde «desde» en el que la obra cabe en la cuadrilla i sin pisar un tramo fijo
  // tramos («Cambiar personas desde»): también en las que no tienen fecha (obras privadas en marcha sin
  // programar, como Urbano Orad): antes se colocaban con las personas de la cuadrilla y el fin no cambiaba
  const colocar = (i, desde, horas, crew, tramos = null) => {
    let ini = labDesde(desde), fp = finPorHoras(ini, horas, crew, tramos);
    for (let g = 0; g < 50; g++) {
      const choca = ocupado[i].find(([a, b]) => a < fp.finExcl && b > ini);
      if (!choca) break;
      ini = labDesde(choca[1]); fp = finPorHoras(ini, horas, crew, tramos);
    }
    return { ini, fp };
  };
  // «Se termina después» (pausa con fecha, 06/10/2026): la obra sigue hasta la víspera y lo que le quede
  // vuelve a su cuadrilla después de las obras privadas en marcha (la que se llevó a su gente) y antes que
  // las sugerencias. pend: lo que falta colocar de esas obras.
  const pend = [];
  const colocarPend = () => {
    for (const { item, eq, desde, horas, crew } of pend.splice(0)) {
      const r = colocar(eq, desde, horas, crew);
      item.pausa = { desde, vuelve: r.ini, horas: Math.round(horas * 10) / 10 };
      item.ult = r.fp.ult; item.finExcl = r.fp.finExcl; item.finPrevisto = r.fp.ult; item.dias += r.fp.dias;
      ocupado[eq].push([r.ini, r.fp.finExcl]);
      if (r.fp.finExcl > libre[eq]) libre[eq] = r.fp.finExcl;
    }
  };
  const out = [];
  for (const x of lista) {
    if (pend.length && !inicioFijo(x) && !x.o.oo_cola) colocarPend();
    out.push(uno(x));
  }
  colocarPend();
  return out;

  function uno(x) {
    const o = x.o, fijo = inicioFijo(x);
    // Con fecha (en obra o programada): lo que queda (previstas − fichadas) se reparte desde hoy (o desde
    // su inicio si es futuro) entre las personas de cada tramo («Cambiar personas desde…»)
    const tramos = opts.sinTramos ? [] : (o.tramos || []).map((t) => ({ desde: t.desde, operarios: t.operarios, crew: { nombres: t.operarios } }));
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
    // obra privada en marcha: sigue cuanto antes, en la cuadrilla que antes quede libre
    else if (o.oo_cola) eq = [...Array(E).keys()].reduce((a, i) => (colocar(i, empieza(i), x.horas, crewDe(o, i, cuadrillas[i]), tramos).ini < colocar(a, empieza(a), x.horas, crewDe(o, a, cuadrillas[a]), tramos).ini ? i : a), 0);
    else if (conf?.regla === "antes") eq = [...Array(E).keys()].reduce((a, i) => (empieza(i) < empieza(a) ? i : a), 0);
    else {
      const otra = [...Array(E).keys()].reduce((a, i) => (libre[i] < libre[a] ? i : a), 0);
      if (Date.parse(empieza(otra)) + 30 * 86400000 < Date.parse(empieza(eq))) eq = otra;
    }
    const espera = !fijo && x.tramitada > libre[eq] ? { desde: libre[eq], hasta: x.tramitada } : null;
    // programada con «Programar obra»: la hacen esos operarios, no toda la cuadrilla
    const personas = Number(o.personas_plan) > 0 ? Number(o.personas_plan) : cuadrillas[eq];
    const jornadas = personas > 0 ? x.horas / (personas * JOR.horas_dia) : 0;
    const crew = crewDe(o, eq, personas);
    let ini, fp;
    if (fijo) {
      ini = labDesde(ready);
      const fichadoHoy = !!o._real?.dias?.has(hoy);
      const futuro = ini > hoy ? ini : labDesde(fichadoHoy ? dia(hoy, 1) : hoy);
      fp = finPorHoras(futuro, x.horas, crew, tramos);
    } else ({ ini, fp } = colocar(eq, empieza(eq), x.horas, crew, tramos));
    // En obra: la cuadrilla queda libre en la fecha más tardía entre el fin previsto y el fin al ritmo
    // real (lo fichado en los últimos 5 días laborables). Sin fichajes: el previsto (y se avisa).
    // Montemayor, 36 de 109 h a ~3 h/día: termina el 21/10, no el 09/10; Laffón y las demás, detrás.
    const finPrevisto = fp.ult;
    let ritmo = null, estimacion = null;
    const enObraYa = ini <= hoy && (!!fijo || Number(o.horas_registradas) > 0 || !!o.oo_cola);
    if (enObraYa && x.horas > 0) {
      const fichadoHoy = !!o._real?.dias?.has(hoy);
      const fut = labDesde(fichadoHoy ? dia(hoy, 1) : hoy);
      ritmo = ritmoDe(o, hoy, ini, crew, tramos);
      // Certificaciones (06/10/2026): con una visita de 7 días o menos que marque algo hecho, el fin
      // estimado sale de sus horas al cierre (fichadas hasta la visita ÷ % ejecutado); si no, del ritmo
      // de fichajes («estimación sin visita»)
      const c = o._cert, vv = AV.visitaValida(c, hoy);
      let fr = null;
      if (vv.ok) {
        const fVis = String(c.ultima_visita_fecha).slice(0, 10);
        const fichVis = o._real ? [...o._real.dias].filter(([d]) => d < fVis).reduce((t, [, v]) => t + v.horas, 0) : Number(c.horas_fichadas_visita) || 0;
        const q = AV.horasQuedanSegunVisita(c, fichVis, Number(o.horas_registradas) || 0);
        if (q) {
          fr = finPorHoras(fut, q.quedan, crew, tramos);
          estimacion = { fuente: "visita", pct: Number(c.avance_pct), fecha_visita: fVis, horas_cierre: q.horas_cierre, horas_quedan: Math.round(q.quedan * 10) / 10, fin: fr.ult };
        }
      }
      if (!fr && ritmo && ritmo.h_persona > 0) {
        const fRitmo = finPorHoras(fut, x.horas, crew, tramos, ritmo.h_persona);
        ritmo.fin = fRitmo.ult;
        if (ritmo.pocos_datos) estimacion = { fuente: "previsto", motivo: `pocos datos de ritmo (${ritmo.dias} ${ritmo.dias === 1 ? "día laborable" : "días laborables"})`, fin: fp.ult };
        else { fr = fRitmo; estimacion = { fuente: "fichajes", motivo: vv.motivo || null, fin: fr.ult }; }
      }
      if (fr && !opts.sinRitmo && fr.finExcl > fp.finExcl) fp = { ...fp, ult: fr.ult, finExcl: fr.finExcl, dias: fp.dias + laborables(dia(fp.ult, 1), fr.ult) };
    }
    // pausa con fecha: hasta la víspera trabaja (a su ritmo real si va más lenta); el resto, en pend
    const pd = fijo && o.pausa_desde && o.pausa_desde > hoy ? labDesde(o.pausa_desde) : null;
    let pausaResto = null;
    if (pd && fp.finExcl > pd) {
      const fichadoHoy = !!o._real?.dias?.has(hoy);
      const fut = ini > hoy ? ini : labDesde(fichadoHoy ? dia(hoy, 1) : hoy);
      const hp = ritmo && ritmo.h_persona > 0 ? Math.min(ritmo.h_persona, JOR.horas_dia) : null;
      let hecho = 0;
      for (let d = fut; d < pd; d = dia(d, 1)) if (esLab(d)) hecho += disponibles(crewDeDia(crew, tramos, d), d) * (hp ?? JOR.horas_dia);
      hecho = Math.min(x.horas, hecho);
      if (x.horas - hecho > 1e-6) { pausaResto = x.horas - hecho; fp = { ...fp, ult: labAntes(pd), finExcl: pd, dias: laborables(ini, labAntes(pd)) }; }
    }
    const finExcl = fp.finExcl, ult = fp.ult;
    // Cuadrillas juntas: si en un tramo va gente de otra cuadrilla, esa cuadrilla no tiene otra obra
    // hasta que esta termine (luego cada uno vuelve a la suya)
    const extra = new Set(), extraDesde = {};
    for (const t of tramos) {
      const desde = labDesde(t.desde > hoy ? t.desde : hoy);
      if (desde >= finExcl) continue;
      (base.nombresTodos || []).forEach((xs, i) => {
        if (i === eq || !xs || !xs.some((n) => t.operarios.includes(n))) return;
        if (!extra.has(i)) { extra.add(i); extraDesde[i] = desde; ocupado[i].push([desde, finExcl]); }
      });
    }
    // otra cuadrilla que la de su tamaño porque la suya estaba ocupada (para el motivo)
    const ocupada = !fijo && !o.oo_cola && manualEq == null && !conf?.asig && conf?.regla !== "antes" && eq !== prefIdx && maxT !== minT ? { cuadrilla: prefIdx, hasta: labAntes(libre[prefIdx]) } : null;
    if (fijo) ocupado[eq].push([ini, finExcl]);
    else if (finExcl > libre[eq]) libre[eq] = finExcl;
    const item = { x, eq, ini, finExcl, ult, finPrevisto, ritmo, estimacion, jornadas, personas, dias: fp.dias, vac: fp.vac, espera, esGrande, ocupada, fijo: !!fijo, antesDeTramite: !!(o.inicio_manual && x.pasos > 0 && ready < x.tramitada),
             tramos, equiposExtra: [...extra], equiposExtraDesde: extraDesde, pausa: null };
    if (pausaResto) pend.push({ item, eq, desde: pd, horas: pausaResto, crew });
    return item;
  }
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
  const m = motivoBase(p, hoy, nombreEq);
  // sin fecha y no lista: va detrás de las listas (simulador-caja.colaObras)
  return !p.fijo && !p.x.o.plan && p.x.o.lista_para_empezar === false ? `${m} No está lista para empezar: va detrás de las que sí lo están.` : m;
}
function motivoBase(p, hoy, nombreEq) {
  const C = nombreEq(p.eq), o = p.x.o;
  const h = Math.round(p.x.prev > 0 ? p.x.prev : p.x.horas);
  const big = p.ocupada ? ` ${p.esGrande ? `Tiene ${h} h` : `Es pequeña (${h} h)`}, pero la ${nombreEq(p.ocupada.cuadrilla)} está ocupada hasta el ${dm(p.ocupada.hasta)}: va a la ${p.eq + 1}.`
    : p.esGrande ? ` Tiene ${h} h: cuadrilla grande.` : "";
  if (o.plan?.fecha_inicio_fija || o.inicio_manual) return `Fijada a mano${o.plan?.usuario ? ` por ${o.plan.usuario}` : ""}: empieza el ${dm(p.ini)} con la ${C}.`;
  if (o.oo_cola) return p.ini <= labDesde(hoy) ? `Obra privada en marcha: la hace la ${C} ahora (una obra a la vez; las demás privadas van detrás).` : `Obra privada en marcha: va en cola en la ${C}, detrás de lo que ya tiene; entra el ${dm(p.ini)}.`;
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
//   4) financiados: resueltos SOLO si Sabadell ya ha abonado (fila en financiaciones_sabadell
//      o saldo de su 5610). Si no: «Pendiente abono Sabadell: N pisos (pisos)» y no está lista
//      (sin euros; el importe, pendiente_eur, solo lo ve el CEO).
//      Sabadell abona a ARA de golpe; es custodia y va a EMASESA antes de empezar (Alberto, 04/10/2026).
// pend = cf.sabadell.pendientes de la obra (ara-os-dinero-empresa.cjs, sabadellCustodia)
// como máximo 3 pisos con nombre por aviso y luego «y N más»
const lista3 = (xs) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} y ${xs.length - 3} más` : xs.join(", "));
const pisosTxt = (n) => `${n} ${n === 1 ? "piso" : "pisos"}`;
function estadoLista(o, f, e, pend, conSabadell = !!pend) {
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
  // Sin pisos: vale si la comunidad contrata y paga ella (ccpp_contrato OK y ccpp_pago OK, p. ej. La Paz 29).
  // «El expediente no tiene pisos» solo si tampoco hay datos de la comunidad
  const porComunidad = !e.pisos && !!e.ccpp?.aplica;
  // comunidad financiada: igual que los pisos, resuelta solo con el abono de Sabadell (fila en
  // financiaciones_sabadell o saldo de la 5610: lo decide el cash flow, pend.comunidad)
  const comFin = !!e.ccpp?.aplica && e.ccpp.pago?.tipo === "financiado";
  const comSinAbono = comFin && (pend ? !!pend.comunidad : conSabadell ? false : !e.ccpp.abonado);
  const pagoCcppOk = e.ccpp?.pago?.tipo === "pagado" || (comFin && !comSinAbono);
  const ccppResuelta = porComunidad && e.ccpp.contrato === true && pagoCcppOk;
  if (!e.pisos && !e.ccpp?.aplica) faltas.push("El expediente no tiene pisos");
  if (ct.faltan.length) faltas.push(`Falta contrato: ${pisosTxt(ct.faltan.length)} (${lista3(ct.faltan)})`);
  if (pg.faltan.length) faltas.push(`Falta pago: ${pisosTxt(pg.faltan.length)} (${lista3(pg.faltan)})`);
  // los pisos tienen que cuadrar: una fila por piso, cada uno con contrato y pago (expediente-estado.cjs).
  // Solo desde la fase 08: antes es normal que haya pagos anotados sin contrato
  const cu = f >= 8 ? e.cuadre : null;
  const cuadra = !cu || cu.ok;
  if (!cuadra) {
    faltas.push(`No cuadran los pisos: ${ct.total} con contrato y ${pg.total} con pago (${pisosTxt(cu.pisos ?? e.pisos)} en la hoja de pisos)`);
    const grupo = (xs, uno, varios) => { if (xs.length === 1) faltas.push(uno(xs[0])); else if (xs.length) faltas.push(`${varios}: ${pisosTxt(xs.length)} (${lista3(xs.map((x) => x.vivienda))})`); };
    grupo(cu.repetidos || [], (r) => `Piso ${r.vivienda}: repetido (${r.filas} filas en la hoja de pisos)`, "Pisos repetidos en la hoja de pisos");
    grupo(cu.sin_contrato || [], (r) => `Piso ${r.vivienda}: sin contrato (contrato ${r.contrato}, pago «${r.pago}»)`, "Sin contrato y con pago anotado");
    grupo(cu.sin_pago || [], (r) => `Piso ${r.vivienda}: sin pago (contrato «${r.contrato}», pago ${r.pago})`, "Con contrato y sin pago anotado");
  }
  if (e.ccpp?.aplica && (e.ccpp.contrato === false || (porComunidad && e.ccpp.contrato !== true))) faltas.push("Falta el contrato de la comunidad");
  if (e.ccpp?.aplica && (e.ccpp.pago?.tipo === "pendiente" || (porComunidad && !pagoCcppOk && !comSinAbono))) faltas.push("Falta el pago de la comunidad");
  const nf = pg.financiados.length;
  const meses = [...new Set(pg.financiados.map((x) => x.meses).filter(Boolean))];
  // financiados sin abono de Sabadell: con el cálculo del cash flow (5610 incluida) o, si no
  // llegó, los que no tienen fila en financiaciones_sabadell
  const sinAbono = pend ? pend.viviendas || [] : conSabadell ? [] : pg.financiados.filter((x) => !x.abonado).map((x) => x.vivienda);
  // sin euros: Planificación la ve JM; el importe (financiacion.pendiente_eur) solo lo enseña el front al CEO
  if (comSinAbono) faltas.push("Pendiente abono Sabadell: comunidad");
  if (sinAbono.length) faltas.push(`Pendiente abono Sabadell: ${pisosTxt(sinAbono.length)} (${lista3(sinAbono)})`);
  const finTxt = nf ? ` (${nf} ${nf === 1 ? "financiado" : "financiados"}${meses.length ? ` ${meses.join("/")} meses` : ""}${sinAbono.length ? `, ${sinAbono.length === nf ? "" : `${sinAbono.length} `}sin abono de Sabadell` : ""})` : "";
  const lista = docOk && (e.pisos > 0 || ccppResuelta) && faltas.length === 0;
  // antes de la fase 08 no hay contratos ni pagos que pedir: no se cuentan (no «0/0»)
  const sinCP = !ct.total && !pg.total;
  const resumen = (porComunidad ? (ccppResuelta ? `Contratada y ${comFin ? "financiada (abonada por Sabadell)" : "pagada"} por la comunidad` : comSinAbono && e.ccpp.contrato === true ? "Contratada por la comunidad, financiada: pendiente abono Sabadell" : "La contrata la comunidad (sin pisos)") : sinCP ? (f < 8 ? `Contratos y pagos: todavía no (fase ${fase})` : "Sin contratos ni pagos en el expediente") : `${ct.ok}/${ct.total} contratos · ${pg.resueltos}/${pg.total} pagados${finTxt}`)
    + (cuadra ? "" : " · no cuadran los pisos");
  const fTxt = `${pisosTxt(nf)} ${nf === 1 ? "financiado" : "financiados"}`;
  const financiacion = comFin && !nf ? { pisos: 0, comunidad: true, pendientes_abono: comSinAbono ? 1 : 0, pendiente_eur: comSinAbono ? pend?.importe || null : null, estimado: !!pend?.estimado,
        texto: comSinAbono ? "Comunidad financiada: Sabadell aún no ha abonado; al abonar entra en la custodia (5610) y va a EMASESA antes de empezar"
          : "Comunidad financiada: Sabadell ya ha abonado; es custodia (5610) y va a EMASESA antes de empezar" }
    : sinCP || !e.pisos ? null : !nf ? { pisos: 0, texto: "Sin financiación: pagan los vecinos a EMASESA" }
    : { pisos: nf, meses, comunidad: comFin, pendientes_abono: sinAbono.length + (comSinAbono ? 1 : 0), pendiente_eur: pend?.importe || null, estimado: !!pend?.estimado,
        texto: sinAbono.length ? `${fTxt}: Sabadell aún no ha abonado ${sinAbono.length === nf ? "ninguno" : `${sinAbono.length}`}; al abonar entra en la custodia (5610) y va a EMASESA antes de empezar`
          : `${fTxt}: Sabadell ya ha abonado; es custodia (5610) y va a EMASESA antes de empezar` };
  return { lista, texto: lista ? `Lista: ${resumen} · documentación completa` : resumen, faltas, financiacion,
           contratos: ct, pagos: { resueltos: pg.resueltos, total: pg.total, pagados: pg.pagados, financiados: nf }, documentacion: d };
}

// «05–14/10: 3 pers. · desde 15/10: 5 pers.» y, de los días ya pasados, lo fichado de verdad cuando no
// coincide con lo programado («2 pers., 48 h del 05 al 07/10»)
const ddmm = (a, b) => (a.slice(5, 7) === b.slice(5, 7) ? `${a.slice(8, 10)}–${dm(b)}` : `${dm(a)}–${dm(b)}`);
function textoTramos(p, hoy) {
  const o = p.x.o, tramos = p.tramos || [];
  const base = p.personas;
  const hoyT = tramos.filter((t) => t.desde <= hoy).pop() || null;
  let texto = null;
  if (tramos.length) {
    const partes = [];
    if (tramos[0].desde > p.ini) partes.push(`${ddmm(p.ini, labAntes(tramos[0].desde))}: ${base} pers.`);
    tramos.forEach((t, i) => {
      const sig = tramos[i + 1];
      partes.push(sig ? `${ddmm(t.desde, labAntes(sig.desde))}: ${t.operarios.length} pers.` : `desde ${dm(t.desde)}: ${t.operarios.length} pers.`);
    });
    texto = partes.join(" · ");
  }
  // lo real: días pasados desde el inicio, agrupando los seguidos con el mismo número de personas
  let real = null;
  if (o._real && p.ini < hoy) {
    const progDia = (d) => { let n = base; for (const t of tramos) if (t.desde <= d) n = t.operarios.length; return n; };
    const dias = [...o._real.dias.entries()].filter(([d]) => d >= p.ini && d < hoy).sort((a, b) => a[0].localeCompare(b[0]));
    const grupos = [];
    for (const [d, v] of dias) {
      const n = v.personas.size || 0;
      if (!n || n === progDia(d)) continue;
      const g = grupos[grupos.length - 1];
      if (g && g.n === n && laborables(dia(g.hasta, 1), labAntes(d)) === 0) { g.hasta = d; g.horas += v.horas; } else grupos.push({ n, desde: d, hasta: d, horas: v.horas });
    }
    // las horas, tal cual fichadas (persona a persona y día a día, sin multiplicar por la jornada)
    const h = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
    if (grupos.length) real = grupos.map((g) => `${g.n} pers., ${h(g.horas)} h ${g.desde === g.hasta ? `el ${dm(g.desde)}` : `del ${g.desde.slice(8, 10)} al ${dm(g.hasta)}`}`).join(" · ");
  }
  return { texto, real, hoy: hoyT };
}

function calendarioPlan({ cf, hoy, borrador = null, modo = "simulacion", nombresCuadrillas = null, tam = null, conf = null, alternativas = false, festivos = null, jornada = null, registros = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { ok: false, error: cf?.simulador?.error || "sin datos de la cartera (posicion-neta-real)" };
  const fest = festivos || leerFestivos(null);
  setFestivos(fest.lista);
  setJornada(jornada, hoy);
  const H = JOR.horas_dia;
  // cada cuántas horas toca visita de Certificaciones (config_dinero «horas_visita», 32 por defecto)
  const umbralVisita = AV.umbralVisita(cf.horas_visita);
  const base = preparar({ cf, hoy, borrador, tam, nombres: nombresCuadrillas, registros });
  const confReal = conf?.regla || conf?.orden ? conf : null;
  const prog = programar(base, hoy, confReal);
  // lo mismo con el fin previsto aunque vayan lentas: cuánto empuja el ritmo real a las de detrás
  const progSin = programar(base, hoy, confReal, { sinRitmo: true });
  const sinRitmoDe = new Map(progSin.map((p) => [p.x.o.obra_id, p]));
  const actual = confReal ? programar(base, hoy) : prog;
  const puestoActual = Object.fromEntries(actual.map((p, i) => [p.x.o.obra_id, i + 1]));
  const nombreEq = (e) => `Cuadrilla ${e + 1}`;
  const lista = prog.map((p, i) => {
    const o = p.x.o;
    // privada en cola: en obra solo cuando le toca (aunque tenga horas de antes)
    // En obra: con fecha (OT, OO o «Programar obra») ya llegada, o con horas fichadas. Una SUGERENCIA a la
    // que le toca empezar hoy no está en obra (05/10/2026: La Paz 29 salió «En obra desde el 05/10» sin
    // que nadie la programara, porque la Cuadrilla 1 quedó libre al darse por terminada Montemayor).
    // Privada en cola y pausada: en obra cuando les toca (aunque tengan horas de antes).
    const enObra = (p.fijo && p.ini <= hoy) || (o.oo_cola || o.pausada ? p.ini <= labDesde(hoy) : (Number(o.horas_registradas) || 0) > 0);
    // Planificada: programada con «Programar obra», con fecha fija (OT, OO) o con fila en planificacion_obras
    const planificada = !enObra && (Number(o.personas_plan) > 0 || !!o.inicio_fijo || !!o.plan);
    const enBorrador = !enObra && !!borrador?.obra_id && borrador.obra_id === o.obra_id;
    const exp = estadoLista(o, p.x.f, cf.expedientes ? cf.expedientes[o.obra_id] : null, (cf.sabadell?.pendientes || []).find((a) => a.ccpp_id === o.obra_id) || null, !!cf.sabadell);
    const estado = enObra ? "en_ejecucion" : p.fijo || o.pausada ? "agendada" : "propuesta";
    const etapa = enObra ? 4 : p.x.f >= 9 ? 3 : p.x.f >= 7 ? 2 : p.x.f === 6 ? 1 : 0;
    const prevH = p.x.prev > 0 ? p.x.prev : p.x.horas;
    const reg = Number(o.horas_registradas) || 0;
    const tr = textoTramos(p, hoy);
    // en obra: la barra empieza el primer día con fichajes o con visita (o su inicio de la hoja) si es antes
    // que su fecha de inicio (Montemayor, inicio 05/10 con horas y visita del 02/10)
    const inicioBarra = enObra ? [p.ini, o.inicio_hoja, o.empezada, ...(o._real ? [...o._real.dias.keys()] : []), ...(o._cert?.visitas || []).map((v) => v.fecha)]
      .map((d) => (d ? String(d).slice(0, 10) : null)).filter((d) => d && d <= hoy && d >= dia(p.ini, -60)).sort()[0] || p.ini : p.ini;
    // plan de horas de la obra (personas de cada tramo × horas al día): cada «horas_visita» horas, una visita
    const personasDia = (d) => { let n = p.personas; for (const t of p.tramos || []) if (t.desde <= d) n = t.operarios.length; return n; };
    const ultReal = o._cert?.visitas?.length ? o._cert.visitas[o._cert.visitas.length - 1].fecha : null;
    const pv = AV.planVisitas({ reales: o._cert?.visitas || [], inicio: inicioBarra, fin: p.ult, hoy, umbral: umbralVisita, enObra,
      horasDia: (d) => (JOR.defecto.has(d) ? 0 : personasDia(d) * JOR.horas_dia),
      fichadasDesdeUltima: o._real ? [...o._real.dias].filter(([d]) => !ultReal || d >= ultReal).reduce((t, [, v]) => t + v.horas, 0) : (ultReal ? 0 : Number(o.horas_registradas) || 0),
      fn: { dia, esLab, laborables } });
    return {
      puesto: i + 1, puesto_antes: confReal && puestoActual[o.obra_id] !== i + 1 ? puestoActual[o.obra_id] : null,
      obra_id: o.obra_id, nombre: o.nombre, fase: o.fase, tipo: o.tipo || null, estado, manual: !enBorrador && !!(o.plan || o.inicio_manual), plan: o.plan || null, borrador: enBorrador,
      equipo: p.eq + 1, cuadrilla: base.cuadrillas[p.eq], grande: p.esGrande,
      // en obra: la barra empieza el primer día con fichajes o con visita si es antes que su fecha de inicio
      // (Montemayor, inicio 05/10 con horas y visita del 02/10: el ◆ caía fuera de la barra)
      inicio: inicioBarra, fin: p.ult, fin_exclusivo: p.finExcl, jornadas: r1(p.jornadas), dias_laborables: p.dias, dias_vacaciones: p.vac,
      tramitada: p.x.tramitada, antes_de_tramite: p.antesDeTramite, espera: p.espera,
      etapa, etapa_txt: ETAPAS[etapa], estado_doc: o.estado_doc || null, atascada_dias: o.atascada_dias || null, sin_presupuesto: o.tipo === "OO" ? false : !(Number(o.importe) > 0),
      sin_horas_previstas: !!o.sin_horas_previstas, horas_supuestas: !!o.horas_supuestas,
      motivo: enBorrador ? `Borrador sin guardar: empezaría el ${dm(p.ini)} con la ${nombreEq(p.eq)}${Number(o.personas_plan) > 0 ? ` (${o.personas_plan} ${Number(o.personas_plan) === 1 ? "persona" : "personas"})` : ""}.` : motivo(p, hoy, nombreEq),
      // «Planificada» (Programar obra) · «Sugerencia» (orden automático) · «En obra»
      // «Borrador sin guardar»: el cambio que se está viendo (Programar obra / mover) todavía no está guardado
      estado_plan: enObra ? "en_obra" : enBorrador ? "borrador" : o.pausada ? "pausada" : planificada ? "planificada" : "sugerencia",
      // «Pausar obra»: desde cuándo y quién; vuelve en su cuadrilla con las horas que le queden
      pausada: o.pausada && !enObra ? { ...o.pausada, vuelve: p.ini } : null,
      // pausa con fecha: trabaja hasta la víspera de «desde» y vuelve el «vuelve» con esas horas
      pausa: p.pausa,
      programada: enBorrador ? null : o.plan ? { usuario: o.plan.usuario || "", fecha: o.plan.fecha || "", nota: o.plan.nota || "", origen: "planificacion" }
        : planificada && o.inicio_fijo ? { usuario: "", fecha: "", nota: "", origen: o.tipo === "OO" ? "oo" : "ot" } : null,
      operarios: tr.hoy ? tr.hoy.operarios : Number(o.personas_plan) > 0 ? o.operarios : (nombresCuadrillas?.[p.eq] || null),
      // «Cambiar personas desde»: los tramos programados y lo fichado de verdad si no coincide
      tramos: p.tramos.map((t) => ({ desde: t.desde, operarios: t.operarios, personas: t.operarios.length })),
      tramos_texto: tr.texto, real_texto: tr.real, equipos_extra: p.equiposExtra.map((i) => i + 1),
      // desde cuándo la lleva cada cuadrilla que se junta (en su fila, la barra empieza ahí)
      junta_desde: Object.fromEntries(p.equiposExtra.map((i) => [i + 1, p.equiposExtraDesde[i]])),
      operarios_de: Number(o.personas_plan) > 0 ? "programada" : "cuadrilla",
      personas: tr.hoy ? tr.hoy.operarios.length : p.personas,
      expediente: exp, lista_para_empezar: exp.lista,
      horas_previstas: r1(prevH), horas_tope_margen: p.x.tope && !o.horas_supuestas ? r1(p.x.horas) : null, horas_plan: r1(p.x.horas),
      horas_registradas: r1(reg), horas_quedan: r1(Math.max(0, prevH - reg)), consumo_pct: prevH > 0 ? Math.round(reg / prevH * 100) : null,
      // ritmo real (últimos 5 días laborables): la cuadrilla queda libre en el más tardío de los dos fines
      fin_previsto: p.finPrevisto,
      // fin estimado: con la última visita de Certificaciones (horas al cierre) o, sin visita válida, con el
      // ritmo de fichajes («estimación sin visita»)
      estimacion: p.estimacion,
      // visitas de Certificaciones (◆ en el calendario): fecha, % ejecutado, partidas, desvío en horas,
      // color (en plazo / hasta 2 días / más) y si sigue abierta; sin euros
      visitas: (o._cert?.visitas || []).map((v) => ({ visita_id: v.visita_id || null, fecha: v.fecha, abierta: v.estado === "abierta", avance_pct: v.avance_pct,
        partidas_con_avance: v.partidas_con_avance, partidas: v.partidas, desvio_horas: v.desvio_horas, retraso_dias: v.retraso_dias, color: v.color })),
      // «toca visitar» (solo en obra): sin visita, la última hace 5 días laborables o más, o > 25 % de las
      // horas fichadas desde ella
      // visitas previstas (◇) y «toca visitar»: de la misma función y de la misma lista de visitas
      visitas_previstas: pv.previstas,
      toca_visitar: pv.toca,
      ritmo: p.ritmo ? { horas: p.ritmo.horas, dias: p.ritmo.dias, desde: p.ritmo.desde, personas_fichan: p.ritmo.personas_fichan, h_persona: r1(p.ritmo.h_persona), h_dia: r1(p.ritmo.h_dia), fin: p.ritmo.fin || null, pocos_datos: p.ritmo.pocos_datos } : null,
      sin_fichajes: !!(enObra && p.ritmo && !(p.ritmo.horas > 0)),
      retraso_dias: p.ult > p.finPrevisto ? laborables(dia(p.finPrevisto, 1), p.ult) : 0,
      // cuánto la empuja el ritmo real de la de delante, comparando su MISMA cuadrilla con y sin ritmo:
      // { dias } si se queda en ella; { cuadrilla, inicio } si pasa a otra (Mijares)
      empuje: (() => {
        const q = sinRitmoDe.get(o.obra_id);
        if (!q || p.fijo) return null;
        if (q.eq !== p.eq) return { de_cuadrilla: q.eq + 1, cuadrilla: p.eq + 1, inicio: p.ini };
        return p.ini > q.ini ? { cuadrilla: p.eq + 1, dias: laborables(q.ini, labAntes(p.ini)) } : null;
      })(),
      empujada_dias: (() => { const q = sinRitmoDe.get(o.obra_id); return q && !p.fijo && q.eq === p.eq && p.ini > q.ini ? laborables(q.ini, labAntes(p.ini)) : 0; })(),
    };
  });
  const visibles = modo === "real" ? lista.filter((x) => x.estado !== "propuesta") : lista;
  // Avisos (sin euros)
  const avisos = [];
  const desvio = base.m.desvio || 0;
  // cuadrillas juntas: la otra cuadrilla no puede seguir en otra obra desde que se juntan
  for (const x of lista.filter((y) => y.equipos_extra?.length)) {
    const desde = (x.tramos || []).map((t) => (t.desde > hoy ? t.desde : hoy)).sort()[0] || hoy;
    for (const e of x.equipos_extra) {
      // (una obra pausada desde una fecha no ocupa su cuadrilla entre la pausa y la vuelta)
      const activa = (y, a, b) => (y.pausa ? (y.inicio <= b && labAntes(y.pausa.desde) >= a) || (y.pausa.vuelve <= b && y.fin >= a) : y.inicio <= b && y.fin >= a);
      const choca = lista.filter((y) => y !== x && y.equipo === e && activa(y, desde, x.fin));
      for (const y of choca) avisos.push({ nivel: "rojo", texto: `${x.nombre}: desde el ${dm(desde)} lleva gente de la Cuadrilla ${e}, que sigue en ${y.nombre} hasta el ${dm(y.fin)}. Cambiar la fecha o las personas.` });
    }
  }
  // Ritmo real (06/10/2026): más de 2 días por detrás del previsto → aviso con las que se retrasan detrás
  const corto = (n) => n.replace(/^(Jorge de )/, "");
  const diasTxt = (n) => `${n} ${n === 1 ? "día" : "días"}`;
  for (const x of lista.filter((y) => y.retraso_dias > 2)) {
    // las de detrás: las que sin el retraso iban en su cuadrilla (o en la que se le junta) después de ella
    const eqs = [x.equipo, ...(x.equipos_extra || [])];
    const detras = lista.filter((y) => y !== x && y.empuje && eqs.includes(y.empuje.de_cuadrilla || y.empuje.cuadrilla) && (sinRitmoDe.get(y.obra_id)?.ini || "") >= x.fin_previsto);
    const igual = detras.length && detras.every((y) => y.empuje.dias != null && y.empuje.dias === detras[0].empuje.dias);
    const txtDetras = !detras.length ? "" : igual ? `; ${yLista(detras.map((y) => y.nombre))} se ${detras.length === 1 ? "retrasa" : "retrasan"} ${diasTxt(detras[0].empuje.dias)}`
      : `; ${yLista(detras.map((y) => (y.empuje.dias != null ? `${y.nombre} se retrasa ${diasTxt(y.empuje.dias)}` : `${y.nombre} pasa a Cuadrilla ${y.empuje.cuadrilla}, empieza el ${dm(y.empuje.inicio)}`)))}`;
    const e = x.estimacion;
    const porque = e?.fuente === "visita" ? `visita del ${dm(e.fecha_visita)}: ${e.pct} % hecho → ${Math.round(e.horas_cierre)} h al cierre`
      : `estimación sin visita: ${String(x.ritmo?.h_dia ?? "").replace(".", ",")} h/día los últimos ${x.ritmo?.dias || 5} días laborables`;
    avisos.push({ nivel: "ambar", grupo: "revisar", texto: `${corto(x.nombre)} va con retraso: termina el ${dm(x.fin)} en vez del ${dm(x.fin_previsto)} (${porque})${txtDetras}.` });
  }
  // Certificaciones: toca visitar (Planificación y Mi día)
  const tocan = lista.filter((y) => y.toca_visitar);
  if (tocan.length) avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "toca_visitar", texto: `Toca visitar (Certificaciones): ${tocan.map((y) => `${y.nombre} (${y.toca_visitar.motivo})`).join(" · ")}.` });
  for (const x of lista.filter((y) => y.sin_fichajes)) avisos.push({ nivel: "ambar", grupo: "revisar", texto: `${x.nombre}: sin fichajes en los últimos ${x.ritmo.dias} días laborables; se usa el fin previsto (${dm(x.fin)}).` });
  // Una cuadrilla, una obra en marcha (05/10/2026): si coinciden dos, una no se da por terminada sola;
  // se pregunta cuál pausar (botón «Pausar obra» en el aviso)
  for (const e of base.cuadrillas.map((_, i) => i + 1)) {
    const enMarcha = lista.filter((y) => y.equipo === e && y.estado_plan === "en_obra" && y.inicio <= hoy && y.fin >= hoy);
    if (enMarcha.length < 2) continue;
    avisos.push({ nivel: "rojo", grupo: "actuar", texto: `${nombreEq(e - 1)} tiene ${enMarcha.length === 2 ? "dos" : enMarcha.length} obras en marcha: ${yLista(enMarcha.map((y) => y.nombre))} · ¿pausar una?`,
                  accion: { tipo: "pausar", cuadrilla: e, obras: enMarcha.map((y) => ({ obra_id: y.obra_id, nombre: y.nombre })) } });
  }
  // ¿terminada? Todas sus horas hechas, o al 80 % y sin horas en el último mes, pero la OT sin Finalizada:
  // sigue en la cola hasta que se pase su OT a Finalizada o se dé por terminada a mano
  for (const x of lista) {
    const o = prog.find((p) => p.x.o.obra_id === x.obra_id)?.x.o;
    const av = S.avance(o || {});
    if (!o || !(Number(o.horas_previstas) > 0) || !(av >= 0.999 || (av >= 0.8 && o.horas_mes != null && o.horas_mes !== "" && Number(o.horas_mes) === 0))) continue;
    avisos.push({ nivel: "ambar", grupo: "revisar", texto: `${x.nombre}: ¿terminada? ${Math.round(x.horas_registradas)} de ${Math.round(x.horas_previstas)} h. Sigue en la cola hasta que su OT pase a Finalizada o se dé por terminada.`,
                  accion: { tipo: "terminar", obras: [{ obra_id: x.obra_id, nombre: x.nombre }] } });
  }
  // obras privadas (Otras órdenes) sin horas previstas: ocupan su cuadrilla, pero hay que ponerlas
  for (const x of base.ooParadas) avisos.push({ nivel: "ambar", texto: `${x.nombre}: ¿sigue en marcha? ${x.desde ? `sin horas desde el ${dm(x.desde)}` : "sin horas registradas"}. No ocupa cuadrilla hasta que se registren horas (o se programe en Planificación).` });
  const sinPrev = lista.filter((y) => y.tipo === "OO" && y.sin_horas_previstas);
  if (sinPrev.length) avisos.push({ nivel: "ambar", texto: `Obras privadas sin horas previstas: ${sinPrev.map((y) => `${y.nombre}${y.horas_supuestas ? " (ocupa una semana de la cuadrilla hasta que se pongan)" : ""}`).join(" · ")}. Ponlas en Otras órdenes.` });
  for (const x of lista.filter((y) => y.horas_tope_margen)) {
    const j = Math.ceil(x.jornadas - 1e-9), jr = Math.ceil(x.horas_plan * (1 + desvio / 100) / (x.cuadrilla * H) - 1e-9);
    avisos.push({ nivel: "ambar", texto: `${x.nombre} ${x.inicio > hoy ? "empieza" : "empezó"} el ${dm(x.inicio)} con la Cuadrilla ${x.equipo}: tope de ${Math.round(x.horas_plan)} h para el margen mínimo = ${j} jornadas (último día ${dm(x.fin)}).${desvio > 0 ? ` Al ritmo de las obras terminadas (+${desvio} %) serían ${jr} jornadas: hay que ir más rápido.` : ""} Registrar las horas cada día contra su OT.` });
  }
  // custodia de vecinos: el día de inicio hay que entregarla a EMASESA (sin euros)
  const conCustodia = S.entregasCustodia(cf.custodias_obras || [], lista.map((x) => ({ obra_id: x.obra_id, nombre: x.nombre, inicio: x.inicio })), hoy, 100, {}, cf.sabadell?.abonos_futuros || []).entregas;
  for (const e of conCustodia) { const x = lista.find((y) => y.obra_id === e.obra_id); if (x) x.custodia = true; }
  if (conCustodia.length) avisos.push({ nivel: "ambar", texto: `El día de inicio hay que entregar la custodia a EMASESA: ${conCustodia.map((e) => `${e.nombre} (${dm(e.fecha)})`).join(" · ")}.` });
  // contabilidad: financiaciones_sabadell dice abonado y la obra no tiene saldo en la 5610
  for (const x of cf.sabadell?.sin_5610 || []) avisos.push({ nivel: "rojo", texto: `${x.nombre}: abono de Sabadell sin custodia 5610: revisar dónde se contabilizó.` });
  const sinHoras = base.terminadas.filter((t) => !(Number(t.horas_registradas) > 0));
  if (sinHoras.length) avisos.push({ nivel: "ambar", texto: `Terminadas sin horas registradas: ${sinHoras.map((t) => t.nombre).join(", ")}.` });
  const recientes = base.terminadas.filter((t) => t.fin_con_fecha && t.fin >= dia(hoy, -14) && Number(t.horas_registradas) > 0);
  if (recientes.length) avisos.push({ nivel: "ambar", texto: `Ya terminadas (no se planifican): ${recientes.map((t) => `${t.nombre} (${t.horas_previstas ? `${Math.round(t.horas_registradas)} de ${Math.round(t.horas_previstas)} h, ` : ""}fin ${dm(t.fin)})`).join(" · ")}.` });
  for (const x of lista.filter((y) => y.sin_presupuesto)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: sin presupuesto${x.atascada_dias ? `, expediente atascado ${x.atascada_dias} días` : ""}.` });
  for (const x of lista.filter((y) => y.antes_de_tramite)) avisos.push({ nivel: "rojo", texto: `${x.nombre}: la fecha fijada es anterior a estar tramitada (≈ ${dm(x.tramitada)}); se programa entonces.` });
  const jf = JOR.jornada.fuente;
  if (jf.horas_dia !== "config_dinero" || jf.vacaciones_dias !== "config_dinero") avisos.push({ nivel: "ambar", texto: `Jornada: falta ${[jf.horas_dia !== "config_dinero" ? "«horas_dia»" : null, jf.vacaciones_dias !== "config_dinero" ? "«vacaciones_dias»" : null].filter(Boolean).join(" y ")} en config_dinero; se usa el convenio del Metal de Sevilla (${String(H).replace(".", ",")} h por día, ${JOR.jornada.vacaciones_dias} días de vacaciones en agosto).` });
  if (JOR.jornada.errores.length) avisos.push({ nivel: "rojo", texto: `config_dinero (jornada): ${JOR.jornada.errores.join(" · ")}.` });
  // quién forma cada cuadrilla (para marcar las personas en «Programar»)
  const sinGente = base.cuadrillas.map((_, i) => i + 1).filter((n) => !(nombresCuadrillas?.[n - 1]?.length));
  if (sinGente.length) avisos.push({ nivel: "ambar", texto: `Falta decir quién forma la ${sinGente.map((n) => `Cuadrilla ${n}`).join(" y la ")}: config_dinero «cuadrilla_personas» (por ejemplo «1:Antonio;Pepe|2:Juan;Luis;Mario»).` });
  if (fest.fuente === "por_defecto") avisos.push({ nivel: "ambar", texto: "Festivos: falta la clave «festivos» en config_dinero; se usan los nacionales, de Andalucía y de Sevilla de 2026-2027 que lleva el programa (los de 2027, provisionales)." });
  if (fest.errores?.length) avisos.push({ nivel: "rojo", texto: `config_dinero «festivos»: fechas que no se entienden (AAAA-MM-DD): ${fest.errores.join(", ")}.` });
  // Cartera planificada: UNA sola fecha de fin, la del calendario por cuadrillas
  // (jornada de 7,7 h, sin fines de semana, festivos ni vacaciones), en meses y días desde hoy
  const horasCartera = r1(lista.reduce((t, x) => t + (Number(x.horas_plan) || 0), 0));
  const personasTot = base.cuadrillas.reduce((t, n) => t + n, 0);
  const finCal = metricas(prog).fin;
  const desdeCartera = labDesde(dia(hoy, 1));
  const vacCartera = finCal ? [...JOR.defecto].filter((x) => x >= desdeCartera && x <= finCal).length : 0;
  const cartera = { horas: horasCartera, obras: lista.length, personas: personasTot, horas_dia: H, desde: desdeCartera, ultimo_dia: finCal, fin_calendario: finCal,
                    dias_laborables: finCal ? laborables(desdeCartera, finCal) - vacCartera : null, dias_vacaciones: vacCartera,
                    festivos: finCal ? fest.lista.filter((x) => x >= desdeCartera && x <= finCal && esLabSemana(x)).length : 0,
                    ...(finCal ? mesesYDias(hoy, finCal) : { meses: null, dias: null }) };
  const out = {
    ok: true, hoy, modo, horas_dia: H, festivos: fest.lista, festivos_fuente: fest.fuente, cartera,
    horas_visita: umbralVisita, horas_visita_fuente: cf.horas_visita != null && String(cf.horas_visita).trim() !== "" ? "config_dinero" : "por_defecto",
    // vacaciones (para recalcular en «Programar obra»): las de agosto por defecto y las de quien tiene fechas propias
    jornada: { horas_dia: H, vacaciones_dias: JOR.jornada.vacaciones_dias, fuente: JOR.jornada.fuente, personas_con_fechas: Object.keys(JOR.jornada.personas) },
    vacaciones: { defecto: [...JOR.defecto], por_persona: Object.fromEntries(Object.keys(JOR.jornada.personas).map((n) => [n, [...vacDe(n)]])) },
    resumen_plan: { planificadas: lista.filter((x) => x.estado_plan === "planificada").length, sugerencias: lista.filter((x) => x.estado_plan === "sugerencia").length, en_obra: lista.filter((x) => x.estado_plan === "en_obra").length, pausadas: lista.filter((x) => x.estado_plan === "pausada").length },
    cuadrillas: base.cuadrillas.map((n, i) => ({ n: i + 1, personas: n, nombre: nombreEq(i), quienes: nombresCuadrillas?.[i] || null,
      grandes: base.cuadrillas.length > 1 && n === Math.max(...base.cuadrillas) && Math.max(...base.cuadrillas) !== Math.min(...base.cuadrillas) })),
    reglas: { grande: base.m.grande ?? 300, tram: base.m.tram ?? 1, desvio_cashflow: desvio },
    obras: visibles,
    terminadas: base.terminadas.map((t) => ({ obra_id: t.obra_id, nombre: t.nombre, fin: t.fin })),
    // obras privadas en marcha sin horas en 14 días (no ocupan cuadrilla): Mi día las cuenta
    oo_paradas: base.ooParadas.map((x) => ({ obra_id: x.obra_id, nombre: x.nombre, desde: x.desde })),
    // obras en obra a las que toca visita de Certificaciones (Mi día las enseña)
    toca_visitar: lista.filter((y) => y.toca_visitar).map((y) => ({ obra_id: y.obra_id, nombre: y.nombre, motivo: y.toca_visitar.motivo, ultima_visita: y.toca_visitar.ultima_visita })),
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

// Fecha de inicio de cada obra según Planificación (jornadas, sin desvío):
// las entregas de custodia a EMASESA del cash flow van en esta fecha
function fechasInicioPlan(args) { return Object.fromEntries(Object.entries(fechasPlan(args)).map(([k, v]) => [k, v.inicio])); }
// Inicio y último día de cada obra según Planificación (con los tramos de personas y lo fichado):
// el cash flow cobra cada obra a partir de ese fin
function fechasPlan({ cf, hoy, festivos = null, jornada = null, nombresCuadrillas = null, registros = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return {};
  setFestivos((festivos || leerFestivos(null)).lista);
  setJornada(jornada, hoy);
  const base = preparar({ cf, hoy, nombres: nombresCuadrillas, registros });
  // movida: sus fechas cambian por «Cambiar personas» o por el ritmo real (de esta obra o de la de delante,
  // en su cuadrilla o en la que se le junta): el cash flow la cobra desde ese fin, igual que Planificación
  const sin = new Map(programar(base, hoy, null, { sinRitmo: true, sinTramos: true }).map((p) => [p.x.o.obra_id, p]));
  return Object.fromEntries(programar(base, hoy).map((p) => { const q = sin.get(p.x.o.obra_id);
    return [p.x.o.obra_id, { inicio: p.ini, fin: p.ult, con_tramos: (p.tramos || []).length > 0, movida: !!q && (q.ult !== p.ult || q.ini !== p.ini) }]; }));
}

module.exports = { textoCuadrillaPersonas, estadoLista, setJornada, finPorHoras, setFestivos, enesimoLaborable, mesesYDias, indicadorDoc, indicadorCustodia, fechasInicioPlan, fechasPlan, fichadoPorObra, calendarioPlan, laborables, personasPorCuadrilla, textoPersonas, sumarJornadas, programar, preparar, metricas, optimizar, HORAS_DIA };
