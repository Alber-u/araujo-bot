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
// tol: lo que sobra el último día por debajo de esa fracción de su jornada se acaba ese día (fin por presupuesto)
function finPorHoras(ini, horas, crew, tramos = null, hPersona = null, tol = 0) {
  let x = labDesde(ini), resto = horas, dias = 0, vac = 0;
  const crewDia = (d) => crewDeDia(crew, tramos, d);
  for (let g = 0; g < 4000; g++) {
    const c = disponibles(crewDia(x), x) * (hPersona ?? JOR.horas_dia);
    if (c > 0) { resto -= c; dias++; if (resto <= 1e-6 || resto <= tol * c + 1e-6) break; } else vac++;
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
  const OC = require("./orden-cartera.cjs");
  const porNombre = new Map();
  for (const c of certs) { const n = normR(c.obra_id); if (n) porNombre.set(n, [...(porNombre.get(n) || []), c]); }
  for (const o of obras || []) {
    let cs = [...new Set([o.nombre, ...(o.alias || []), ...String(o.obra_id || "").split("+")].map(normR).filter(Boolean))].flatMap((n) => porNombre.get(n) || []);
    // obras de varias OO (Orad): también sus fichas por portal («Urbano Orad 13» y «Urbano Orad 15»)
    const g = OC.grupoDe({ obra_id: String(o.obra_id || "").split("+")[0], nombre: o.nombre });
    if (g) cs = [...new Set([...cs, ...certs.filter((c) => OC.grupoDe({ nombre: c.obra_id }) === g)])];
    // con fichas por partidas, la de % global (si quedó de antes) no cuenta
    if (cs.some((c) => !c.modo_total)) cs = cs.filter((c) => !c.modo_total);
    if (!cs.length) continue;
    const mejor = [...cs].sort((a, b) => String(b.ultima_visita_fecha || "").localeCompare(String(a.ultima_visita_fecha || "")))[0];
    // varias fichas de la misma obra (Orad 13 y 15): una visita por día, con el % de cada portal (el de su
    // última visita hasta ese día) ponderado por sus horas presupuestadas
    const visitas = cs.length > 1 ? juntarPortales(cs) : [...new Map(cs.flatMap(visitasCert).map((v) => [v.visita_id || v.fecha, v])).values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    // UNA fuente (07/10/2026): «toca visitar», el fin estimado y los ◆ del calendario salen de esta lista;
    // la última visita es la última de la lista (antes cada uno leía un campo y se separaron)
    const ult = visitas[visitas.length - 1] || null;
    out.set(o.obra_id, { ...mejor, visitas, ultima_visita_fecha: ult ? ult.fecha : null, avance_pct: ult ? Number(ult.avance_pct) || 0 : 0,
      horas_fichadas_visita: ult && ult.horas_fichadas != null ? ult.horas_fichadas : mejor.horas_fichadas_visita,
      portales: cs.length > 1 ? cs.map((c) => c.obra_id) : null });
  }
  return out;
}
// Orad: las visitas de sus dos portales, juntas por día y ponderadas por horas
function juntarPortales(cs) {
  const prev = (c) => Number(c.previsto_horas) > 0 ? Number(c.previsto_horas) : 1;
  const listas = cs.map((c) => ({ c, vs: visitasCert(c).sort((a, b) => a.fecha.localeCompare(b.fecha)) }));
  const fechas = [...new Set(listas.flatMap((l) => l.vs.map((v) => v.fecha)))].sort();
  const total = cs.reduce((t, c) => t + prev(c), 0);
  const peor = { verde: 0, ambar: 1, rojo: 2 };
  return fechas.map((f) => {
    const hoyDe = listas.map((l) => ({ l, v: l.vs.filter((v) => v.fecha <= f).pop() || null, delDia: l.vs.filter((v) => v.fecha === f) }));
    const avance = hoyDe.reduce((t, x) => t + prev(x.l.c) * (Number(x.v?.avance_pct) || 0), 0) / total;
    const delDia = hoyDe.flatMap((x) => x.delDia);
    const color = delDia.map((v) => v.color).filter(Boolean).sort((a, b) => (peor[b] ?? -1) - (peor[a] ?? -1))[0] || null;
    const suma = (k) => (hoyDe.every((x) => x.v && x.v[k] != null) ? hoyDe.reduce((t, x) => t + Number(x.v[k]), 0) : null);
    return { visita_id: delDia.map((v) => v.visita_id).filter(Boolean).join("+") || null, fecha: f,
      estado: delDia.some((v) => v.estado === "abierta") ? "abierta" : "cerrada", avance_pct: Math.round(avance * 10) / 10,
      partidas_con_avance: suma("partidas_con_avance"), partidas: suma("partidas"), horas_fichadas: suma("horas_fichadas"),
      desvio_horas: suma("desvio_horas"), retraso_dias: null, color,
      portales: hoyDe.map((x) => ({ obra_id: x.l.c.obra_id, avance_pct: x.v ? Number(x.v.avance_pct) || 0 : 0, visita_del_dia: x.delDia.length > 0 })) };
  });
}

function preparar({ cf, hoy, borrador = null, tam = null, nombres = null, registros = null, listasPrimero = true }) {
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
  // «Listas para empezar primero» (07/10/2026): una sugerencia no lista (contratos, pagos o expediente) va al
  // final de la cola y sin fecha («sin programar · no lista»): nunca ocupa un hueco que pueda usar una lista.
  // Sin datos de expedientes no se sabe cuáles están listas: la cola, como siempre.
  const sinFecha = (x) => {
    if (!listasPrimero || !cf.expedientes || fija(x) || pausada(x) || x.o.oo_cola || x.o.tipo === "OO") return false;
    const pend = (cf.sabadell?.pendientes || []).find((a) => a.ccpp_id === x.o.obra_id) || null;
    return !estadoLista(x.o, x.f, cf.expedientes[x.o.obra_id] || null, pend, !!cf.sabadell).lista;
  };
  for (const x of cola0) {
    x.sinFecha = sinFecha(x);
    // (07/10/2026) una no lista no empieza antes de su «lista desde» (trámite, papeles o expediente vacío)
    if (x.sinFecha) x.listaDesde = listaDesde(x, estadoLista(x.o, x.f, cf.expedientes[x.o.obra_id] || null, (cf.sabadell?.pendientes || []).find((a) => a.ccpp_id === x.o.obra_id) || null, !!cf.sabadell), m.tram, hoy).fecha;
  }
  const sug = cola0.filter((x) => !fija(x) && !pausada(x) && !x.o.oo_cola);
  const cola = [...cola0.filter(fija), ...cola0.filter((x) => !fija(x) && !pausada(x) && x.o.oo_cola).sort((a, b) => refOO(b).localeCompare(refOO(a))), ...cola0.filter(pausada), ...sug.filter((x) => !x.sinFecha), ...sug.filter((x) => x.sinFecha).map((x, i) => ({ x, i })).sort((a, b) => a.x.listaDesde.localeCompare(b.x.listaDesde) || a.i - b.i).map((y) => y.x)];
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
const TOL_FIN = 0.05;   // un 5 % de la jornada o menos el último día (Montemayor: 0,8 de 16 h): se acaba ese día

// opts.sinRitmo: sin el exceso de las obras que pasan de su presupuesto (para saber cuánto empujan a las de detrás)
// opts.sinTramos: sin «Cambiar personas» (para saber qué obras mueve; el cash flow toma esas fechas)
function programar(base, hoy, conf = null, opts = {}) {
  const { cuadrillas, cola, m } = base;
  const E = cuadrillas.length, maxT = Math.max(...cuadrillas), minT = Math.min(...cuadrillas);
  const grande = m.grande ?? 300;
  const inicioFijo = (x) => x.o.inicio_fijo || x.o.empezada || null;
  let lista = cola;
  if (conf?.orden) {
    const fijas = cola.filter((x) => inicioFijo(x));
    // (las obras privadas en marcha, justo detrás de las fijas: pueden llevarse gente de ellas)
    const enMarcha = cola.filter((x) => !inicioFijo(x) && x.o.oo_cola);
    const resto = conf.orden.map((id) => cola.find((x) => x.o.obra_id === id)).filter((x) => x && !inicioFijo(x) && !x.o.oo_cola);
    const sinOrden = cola.filter((x) => !inicioFijo(x) && !x.o.oo_cola && !conf.orden.includes(x.o.obra_id));
    // (las no listas, siempre al final)
    lista = [...fijas, ...enMarcha, ...[...resto, ...sinOrden].filter((x) => !x.sinFecha), ...[...resto, ...sinOrden].filter((x) => x.sinFecha)];
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
  // Las obras no se pisan (06/10/2026): un tramo que trae gente de otra cuadrilla no empieza antes del día
  // siguiente al fin de la obra en marcha de esa cuadrilla; si esa obra se alarga, el tramo se corre solo, y si
  // se acorta vuelve a su fecha guardada (nunca antes). { ...t, desde, guardado, corrido: { cuadrilla, obra, fin } }
  const ajustarTramos = (tramos, eqi, nombre) => tramos.map((t) => {
    let desde = t.desde, corrido = null;
    for (let g = 0; g < 10; g++) {
      let movido = false;
      (base.nombresTodos || []).forEach((xs, i) => {
        if (i === eqi || !xs || !xs.some((n) => t.operarios.includes(n))) return;
        for (const [a, b, obra, fin] of ocupado[i]) {
          if (obra && obra !== nombre && a <= desde && b > desde) { desde = labDesde(b); corrido = { cuadrilla: i + 1, obra, fin }; movido = true; }
        }
      });
      if (!movido) break;
    }
    return desde !== t.desde ? { ...t, desde, guardado: t.desde, corrido } : t;
  });
  const out = [];
  // las listas aún sin colocar (para no dar la cuadrilla grande a una pequeña si espera una grande lista)
  let listasPendientes = lista.filter((y) => !inicioFijo(y) && !y.o.oo_cola && !y.sinFecha);
  for (const x of lista) {
    if (pend.length && !inicioFijo(x) && !x.o.oo_cola) colocarPend();
    out.push(uno(x));
    listasPendientes = listasPendientes.filter((y) => y !== x);
  }
  colocarPend();
  return out;

  function uno(x) {
    const o = x.o, fijo = inicioFijo(x);
    // Con fecha (en obra o programada): lo que queda (previstas − fichadas) se reparte desde hoy (o desde
    // su inicio si es futuro) entre las personas de cada tramo («Cambiar personas desde…»)
    const tramos0 = opts.sinTramos ? [] : (o.tramos || []).map((t) => ({ desde: t.desde, operarios: t.operarios, crew: { nombres: t.operarios } }));
    let tramos = tramos0;
    const horasRef = x.prev > 0 ? x.prev : x.horas;
    const esGrande = horasRef >= grande;
    const manualEq = Number(o.cuadrilla) >= 1 && Number(o.cuadrilla) <= E ? Number(o.cuadrilla) - 1 : null;
    const quiere = esGrande ? maxT : minT;
    const pref = [...Array(E).keys()].filter((i) => maxT === minT || cuadrillas[i] === quiere);
    let eq = pref.reduce((a, i) => (libre[i] < libre[a] ? i : a), pref[0]);
    const ready = fijo ? String(fijo).slice(0, 10) : x.listaDesde && x.listaDesde > x.tramitada ? x.listaDesde : x.tramitada;
    const empieza = (i) => (fijo ? ready : (libre[i] > ready ? libre[i] : ready));
    const prefIdx = eq;
    if (manualEq != null) eq = manualEq;
    else if (conf?.asig && conf.asig[o.obra_id] != null && conf.asig[o.obra_id] < E) eq = conf.asig[o.obra_id];
    // obra privada en marcha: sigue cuanto antes, en la cuadrilla que antes quede libre
    else if (o.oo_cola) eq = [...Array(E).keys()].reduce((a, i) => (colocar(i, empieza(i), x.horas, crewDe(o, i, cuadrillas[i]), ajustarTramos(tramos0, i, o.nombre)).ini < colocar(a, empieza(a), x.horas, crewDe(o, a, cuadrillas[a]), ajustarTramos(tramos0, a, o.nombre)).ini ? i : a), 0);
    else if (conf?.regla === "antes") eq = [...Array(E).keys()].reduce((a, i) => (empieza(i) < empieza(a) ? i : a), 0);
    else {
      // dónde empezaría de verdad en cada cuadrilla (contando las obras con fecha ya colocadas: una en obra
      // ocupa su cuadrilla aunque «libre» diga otra cosa)
      const iniEn = (i) => colocar(i, empieza(i), x.horas, crewDe(o, i, cuadrillas[i])).ini;
      const otra = [...Array(E).keys()].reduce((a, i) => (iniEn(i) < iniEn(a) ? i : a), 0);
      // una lista pequeña entra en la cuadrilla que antes quede libre (la grande, si no hay obra grande lista
      // esperando) cuando empieza al menos 5 días laborables antes: así ninguna cuadrilla se queda parada y la
      // obra no cambia de cuadrilla por un día de diferencia (07/10/2026, Mijares)
      // (06/10/2026, «no se puede quedar vacío»: la grande solo se guarda para una obra grande que de verdad
      // pueda empezar cuando la cuadrilla grande quede libre; si no, coge la pequeña)
      const grandeListaEspera = !esGrande && listasPendientes.some((y) => y !== x && (y.prev > 0 ? y.prev : y.horas) >= grande && (inicioFijo(y) || y.tramitada <= iniEn(otra)));
      // una grande lista con la cuadrilla grande ocupada: la coge la pequeña si queda libre al menos 5 días laborables
      // antes y no hay otra obra pequeña lista que la pueda llenar («grandes» es una preferencia, no una exclusiva)
      const pequenaListaEspera = esGrande && listasPendientes.some((y) => y !== x && (y.prev > 0 ? y.prev : y.horas) < grande && y.tramitada <= iniEn(otra));
      if (!x.sinFecha && !esGrande && otra !== eq && !grandeListaEspera && iniEn(otra) < iniEn(eq)) eq = otra;
      else if (!x.sinFecha && esGrande && otra !== eq && !pequenaListaEspera && iniEn(otra) < iniEn(eq) && laborables(iniEn(otra), labAntes(iniEn(eq))) >= 5) eq = otra;
      else if (Date.parse(empieza(otra)) + 30 * 86400000 < Date.parse(empieza(eq))) eq = otra;
      // estable: la cuadrilla del plan previsto (sin el ritmo real, que cambia cada día) se mantiene salvo que en
      // la otra empiece al menos 5 días laborables antes («si cabe en la misma cuadrilla con poco retraso, se queda»)
      const b = opts.asigBase?.get(o.obra_id);
      if (b != null && b !== eq && b < E && !(empieza(eq) < empieza(b) && laborables(empieza(eq), labAntes(empieza(b))) >= 5)) eq = b;
    }
    tramos = ajustarTramos(tramos0, eq, o.nombre);
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
      fp = finPorHoras(futuro, x.horas, crew, tramos, null, TOL_FIN);
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
      // (07/10/2026) el ritmo de fichajes y las visitas (también al 0 %) son información: no alargan la obra
    }
    // Exceso (07/10/2026): en obra, con todas las horas del presupuesto fichadas y aún abierta, la obra ocupa su
    // cuadrilla día a día desde el siguiente al que llegó a lo presupuestado hasta hoy (o el próximo laborable):
    // tramo rojo «+N días · +X h sobre presupuesto», que empuja a las de detrás. Los días sin registrar no cuentan
    // como horas (el fin sale de lo que queda por fichar; para eso, el aviso «sin registros desde…»).
    let exceso = null, finPres = finPrevisto;
    const fich = Number(o.horas_registradas) || 0;
    if (enObraYa && x.prev > 0 && fich >= x.prev - 1e-6) {
      let ac = 0, tope = null;
      for (const [d, v] of [...(o._real?.dias || [])].sort(([a], [b]) => a.localeCompare(b))) { ac += v.horas; if (ac >= x.prev - 1e-6) { tope = d; break; } }
      const hasta = labDesde(hoy);
      if (!tope || tope > hasta) tope = hasta;
      finPres = tope;
      // (sinRitmo: sin el exceso, acaba el día que llegó a lo presupuestado)
      const dias = tope < hasta && !opts.sinRitmo ? laborables(dia(tope, 1), hasta) : 0;
      if (dias > 0 || (fich - x.prev >= 0.5 && !opts.sinRitmo)) exceso = { desde: dias > 0 ? labDesde(dia(tope, 1)) : null, hasta: dias > 0 ? hasta : null, dias, horas: Math.round((fich - x.prev) * 10) / 10 };
      const fin = dias > 0 ? hasta : tope;
      fp = { ...fp, ult: fin, finExcl: labDesde(dia(fin, 1)), dias: Math.max(1, laborables(ini, fin)) };
    }
    // pausa con fecha: hasta la víspera trabaja (a su ritmo real si va más lenta); el resto, en pend
    const pd = fijo && o.pausa_desde && o.pausa_desde > hoy ? labDesde(o.pausa_desde) : null;
    let pausaResto = null;
    if (pd && fp.finExcl > pd) {
      const fichadoHoy = !!o._real?.dias?.has(hoy);
      const fut = ini > hoy ? ini : labDesde(fichadoHoy ? dia(hoy, 1) : hoy);
      const hp = null;   // (07/10/2026) a jornada completa: el ritmo de fichajes no alarga la obra
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
        if (!extra.has(i)) { extra.add(i); extraDesde[i] = desde; ocupado[i].push([desde, finExcl, o.nombre, ult]); if (finExcl > libre[i]) libre[i] = finExcl; }
      });
    }
    // otra cuadrilla que la de su tamaño porque la suya estaba ocupada (para el motivo)
    const ocupada = !fijo && !o.oo_cola && manualEq == null && !conf?.asig && conf?.regla !== "antes" && eq !== prefIdx && maxT !== minT ? { cuadrilla: prefIdx, hasta: labAntes(libre[prefIdx]) } : null;
    if (fijo) ocupado[eq].push([ini, finExcl, o.nombre, ult]);
    else if (finExcl > libre[eq]) libre[eq] = finExcl;
    const item = { x, eq, ini, finExcl, ult, finPrevisto: finPres, exceso, ritmo, estimacion, jornadas, personas, dias: fp.dias, vac: fp.vac, espera, esGrande, ocupada, fijo: !!fijo, antesDeTramite: !!(o.inicio_manual && x.pasos > 0 && ready < x.tramitada),
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
    // tramo corrido porque la gente que trae sigue en otra obra: «Cuadrilla 1 desde el 14/10»
    for (const t of tramos.filter((y) => y.corrido)) texto += ` · Cuadrilla ${t.corrido.cuadrilla} desde el ${dm(t.desde)}`;
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

function calendarioPlan({ cf, hoy, borrador = null, modo = "simulacion", nombresCuadrillas = null, tam = null, conf = null, alternativas = false, festivos = null, jornada = null, registros = null, listasPrimero = true }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { ok: false, error: cf?.simulador?.error || "sin datos de la cartera (posicion-neta-real)" };
  const fest = festivos || leerFestivos(null);
  setFestivos(fest.lista);
  setJornada(jornada, hoy);
  const H = JOR.horas_dia;
  // cada cuántas horas toca visita de Certificaciones (config_dinero «horas_visita», 32 por defecto)
  const umbralVisita = AV.umbralVisita(cf.horas_visita);
  const base = preparar({ cf, hoy, borrador, tam, nombres: nombresCuadrillas, registros, listasPrimero });
  const confReal = conf?.regla || conf?.orden ? conf : null;
  // la cuadrilla de cada sugerencia sale del plan previsto (estable de un día a otro): asigBase
  const asigBase = new Map(programar(base, hoy, confReal, { sinRitmo: true }).map((p) => [p.x.o.obra_id, p.eq]));
  const prog = programar(base, hoy, confReal, { asigBase });
  // lo mismo con el fin previsto aunque vayan lentas: cuánto empuja el ritmo real a las de detrás
  const progSin = programar(base, hoy, confReal, { sinRitmo: true });
  const sinRitmoDe = new Map(progSin.map((p) => [p.x.o.obra_id, p]));
  const actual = confReal ? programar(base, hoy, null, { asigBase: new Map(programar(base, hoy, null, { sinRitmo: true }).map((p) => [p.x.o.obra_id, p.eq])) }) : prog;
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
    // umbral de la obra: el de su ficha de Certificaciones, el de su grupo de OO (Orad, 80 h) o config_dinero
    const deGrupo = Number(o.horas_visita) > 0 ? Number(o.horas_visita) : Number(require("./orden-cartera.cjs").grupoDe({ obra_id: String(o.obra_id || "").split("+")[0], nombre: o.nombre })?.horas_visita) || 0;
    const umbralObra = Number(o._cert?.horas_visita_propia) > 0 ? Number(o._cert.horas_visita_propia) : deGrupo > 0 ? deGrupo : umbralVisita;
    const pv = AV.planVisitas({ reales: o._cert?.visitas || [], inicio: inicioBarra, fin: p.ult, hoy, umbral: umbralObra, enObra,
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
      // no lista (07/10/2026): sin fecha hasta que lo esté; al final de la cola («sin programar · no lista»)
      sin_fecha: !!p.x.sinFecha && !enObra,
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
      tramos: p.tramos.map((t) => ({ desde: t.desde, operarios: t.operarios, personas: t.operarios.length, ...(t.corrido ? { guardado: t.guardado, corrido: t.corrido } : {}) })),
      // tramos corridos porque su gente sigue en otra obra (06/10/2026): entra el día siguiente a su fin
      tramos_corridos: p.tramos.filter((t) => t.corrido).map((t) => ({ cuadrilla: t.corrido.cuadrilla, desde: t.desde, guardado: t.guardado, obra: t.corrido.obra, fin: t.corrido.fin })),
      tramos_texto: tr.texto, real_texto: tr.real, equipos_extra: p.equiposExtra.map((i) => i + 1),
      // desde cuándo la lleva cada cuadrilla que se junta (en su fila, la barra empieza ahí)
      junta_desde: Object.fromEntries(p.equiposExtra.map((i) => [i + 1, p.equiposExtraDesde[i]])),
      operarios_de: Number(o.personas_plan) > 0 ? "programada" : "cuadrilla",
      personas: tr.hoy ? tr.hoy.operarios.length : p.personas,
      expediente: exp, lista_para_empezar: exp.lista,
      // no lista: cuándo puede estarlo y por qué («lista ≈ 06/11 (falta abono Sabadell: 2 pisos)»)
      lista_desde: p.x.sinFecha && !enObra ? listaDesde(p.x, exp, base.m.tram, hoy) : null,
      horas_previstas: r1(prevH), horas_tope_margen: p.x.tope && !o.horas_supuestas ? r1(p.x.horas) : null, horas_plan: r1(p.x.horas),
      horas_registradas: r1(reg), horas_quedan: r1(Math.max(0, prevH - reg)), consumo_pct: prevH > 0 ? Math.round(reg / prevH * 100) : null,
      // ritmo real (últimos 5 días laborables): la cuadrilla queda libre en el más tardío de los dos fines
      fin_previsto: p.finPrevisto,
      // tramo rojo: días y horas por encima del presupuesto (en obra, todas las horas fichadas y aún abierta)
      exceso: p.exceso,
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
      // sin partidas en Certificaciones no hay visitas previstas (◇): la barra lleva «Sin partidas: no se puede visitar»
      // (una OT que aún no ha empezado mantiene sus ◇: su presupuesto se importa antes de empezar)
      visitas_previstas: !o._cert && (enObra || o.tipo === "OO") ? [] : pv.previstas,
      sin_partidas: !o._cert && (enObra || o.tipo === "OO"),
      // obra privada sin partidas de control: «Preparar certificación» en su presupuesto (una por OO)
      sin_preparar: !o._cert && o.tipo === "OO" ? String(o.obra_id || "").split("+").filter(Boolean) : null,
      horas_visita: umbralObra,
      // en obra sin presupuesto en Certificaciones: no se puede visitar; eso, en vez de «toca visitar»
      toca_visitar: enObra && !o._cert ? { motivo: o.tipo === "OO" ? "sin preparar certificación: pulsa «Preparar certificación» en su presupuesto para poder visitar" : "sin presupuesto en Certificaciones: impórtalo para poder visitar", sin_presupuesto: true, ultima_visita: null } : pv.toca,
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
      // (solo queda si alguien fija a mano dos obras en las mismas fechas con la misma gente: lo demás se corre)
      for (const y of choca) avisos.push({ nivel: "rojo", tipo: "choque", texto: `${x.nombre}: desde el ${dm(desde)} lleva gente de la Cuadrilla ${e}, que sigue en ${y.nombre} hasta el ${dm(y.fin)}. Cambiar la fecha o las personas.` });
    }
  }
  // tramo corrido: la cuadrilla entra cuando acaba su obra (ámbar, informativo)
  for (const x of lista) for (const t of x.tramos_corridos || []) {
    avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "tramo_corrido", texto: `${x.nombre.replace(/\s+[\d-]+$/, "")}: la Cuadrilla ${t.cuadrilla} entra el ${dm(t.desde)} en vez del ${dm(t.guardado)} porque ${t.obra} acaba el ${dm(t.fin)}.` });
  }
  // Ritmo real (06/10/2026): más de 2 días por detrás del previsto → aviso con las que se retrasan detrás
  const corto = (n) => n.replace(/^(Jorge de )/, "");
  const diasTxt = (n) => `${n} ${n === 1 ? "día" : "días"}`;
  for (const x of lista.filter((y) => y.retraso_dias > 0)) {
    // las de detrás: las que sin el retraso iban en su cuadrilla (o en la que se le junta) después de ella
    const eqs = [x.equipo, ...(x.equipos_extra || [])];
    const detras = lista.filter((y) => y !== x && y.empuje && eqs.includes(y.empuje.de_cuadrilla || y.empuje.cuadrilla) && (sinRitmoDe.get(y.obra_id)?.ini || "") >= x.fin_previsto);
    const igual = detras.length && detras.every((y) => y.empuje.dias != null && y.empuje.dias === detras[0].empuje.dias);
    const txtDetras = !detras.length ? "" : igual ? `; ${yLista(detras.map((y) => y.nombre))} se ${detras.length === 1 ? "retrasa" : "retrasan"} ${diasTxt(detras[0].empuje.dias)}`
      : `; ${yLista(detras.map((y) => (y.empuje.dias != null ? `${y.nombre} se retrasa ${diasTxt(y.empuje.dias)}` : `${y.nombre} pasa a Cuadrilla ${y.empuje.cuadrilla}, empieza el ${dm(y.empuje.inicio)}`)))}`;
    const ex = x.exceso;
    const porque = ex ? `+${diasTxt(ex.dias)} · +${String(ex.horas).replace(".", ",")} h sobre presupuesto` : "";
    avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "exceso", texto: `${corto(x.nombre)} pasa de su presupuesto: sigue abierta el ${dm(x.fin)} y su presupuesto acababa el ${dm(x.fin_previsto)} (${porque})${txtDetras}.` });
  }
  // Certificaciones: toca visitar (Planificación y Mi día)
  const tocan = lista.filter((y) => y.toca_visitar && !y.toca_visitar.sin_presupuesto);
  if (tocan.length) avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "toca_visitar", texto: `Toca visitar (Certificaciones): ${tocan.map((y) => `${y.nombre} (${y.toca_visitar.motivo})`).join(" · ")}.` });
  const sinPto = lista.filter((y) => y.toca_visitar?.sin_presupuesto);
  const sinPtoOT = sinPto.filter((y) => !y.sin_preparar), sinPrep = sinPto.filter((y) => y.sin_preparar);
  if (sinPtoOT.length) avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "toca_visitar", texto: `Sin presupuesto en Certificaciones (impórtalo para poder visitar): ${sinPtoOT.map((y) => y.nombre).join(" · ")}.` });
  if (sinPrep.length) avisos.push({ nivel: "ambar", grupo: "revisar", tipo: "toca_visitar", texto: `Sin preparar certificación (pulsa «Preparar certificación» en su presupuesto para poder visitar): ${sinPrep.map((y) => y.nombre).join(" · ")}.` });
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
  // huecos (06/10/2026): «Noviembre: Cuadrilla 2 con 350 h sin obra lista. Lo llenaría: …» (sin euros: lo ve JM)
  const huecos = huecosPlan(prog, base, cf, hoy);
  for (const t of textosHuecos(huecos)) avisos.push({ nivel: "rojo", grupo: "actuar", tipo: "hueco", texto: t });
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
    toca_visitar: lista.filter((y) => y.toca_visitar).map((y) => ({ obra_id: y.obra_id, nombre: y.nombre, motivo: y.toca_visitar.motivo, ultima_visita: y.toca_visitar.ultima_visita, sin_presupuesto: !!y.toca_visitar.sin_presupuesto, sin_preparar: y.sin_preparar || null })),
    avisos, huecos, metricas: metricas(prog), viendo: confReal ? (conf.k || "prueba") : null,
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

// «Lista desde» de una obra no lista (06/10/2026, Alberto): la más tardía de
//   · trámite: pasos que le faltan × ritmo de tramitación;
//   · contratos, pagos o abonos de Sabadell (aunque ya esté tramitada): 1 paso (1 mes con el ritmo de hoy);
//   · expediente vacío o sin pisos: 2 pasos.
// pasos_lista: en pasos de trámite (Mi panel lo multiplica por su ritmo: se cambia en un solo sitio).
// → { pasos_lista, fecha, motivo } · motivo: «falta abono Sabadell: 2 pisos», «en trámite (fase 07)»…
function listaDesde(x, exp, tram, hoy) {
  const faltas = (exp?.faltas || []).filter((f) => !/^Documentación:/.test(f));
  const vacio = !!exp?.sin_expediente || faltas.some((f) => /no tiene pisos/.test(f));
  const pasosDoc = vacio ? 2 : faltas.length ? 1 : 0;
  const pasosTram = Number(x.pasos) || 0;
  const pasos = Math.max(pasosDoc, pasosTram);
  const corto = (f) => f.replace(/\s*\(.*\)$/, "").replace(/^Pendiente abono Sabadell/, "falta abono Sabadell").replace(/^Falta /, "falta ").replace(/^El expediente no tiene pisos$/, "expediente sin pisos");
  // lo que manda la fecha va primero: el trámite si le faltan más pasos (o los mismos); si no, lo del expediente
  const docs = vacio ? ["expediente vacío"] : faltas.map(corto);
  const motivo = pasosTram >= pasosDoc && pasosTram > 0 ? [`en trámite (fase ${String(x.o.fase || "").slice(0, 2)})`, ...docs].join(" · ") : docs.join(" · ");
  return { pasos_lista: pasos, fecha: labDesde(dia(hoy, Math.round(pasos * (tram ?? 1) * DIAS_MES))), motivo };
}

// HUECOS (06/10/2026, Alberto: «se meten en obras pequeñas, no se puede quedar vacío»): tramos en los que una
// cuadrilla no tiene ninguna obra LISTA (las no listas se dibujan de forma provisional, pero no se pueden empezar),
// desde hoy hasta el fin del mes de la última obra lista. Para cada hueco, las obras que lo llenarían (las no
// listas) con lo que les falta, primero las que menos (pisos pendientes de contrato, pago o abono de Sabadell…).
// → { cuadrillas: [{ equipo, personas, segmentos: [{ desde, hasta, horas }], por_mes: { AAAA-MM: horas }, horas }],
//     candidatas: [{ obra_id, nombre, horas, faltas, falta_txt, puntos }], hasta }
const finMes = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);
function huecosPlan(prog, base, cf, hoy) {
  const listas = prog.filter((p) => !p.x.sinFecha);
  if (!listas.length) return { cuadrillas: [], candidatas: [], hasta: null };
  const hasta = finMes(listas.map((p) => p.ult).sort().pop());
  const cuadrillas = base.cuadrillas.map((n, i) => {
    const ocupado = [];
    for (const p of listas) {
      if (p.eq === i) ocupado.push([p.ini, p.finExcl]);
      if ((p.equiposExtra || []).includes(i)) ocupado.push([p.equiposExtraDesde[i], p.finExcl]);
    }
    const crew = base.nombres?.[i] ? { nombres: base.nombres[i] } : { n };
    const segmentos = [], por_mes = {};
    let seg = null;
    for (let d = labDesde(hoy); d <= hasta; d = dia(d, 1)) {
      if (!esLab(d)) continue;
      const libre = !ocupado.some(([a, b]) => a <= d && b > d);
      const h = libre ? disponibles(crew, d) * JOR.horas_dia : 0;
      if (libre && h > 0) {
        if (seg && seg.mes === d.slice(0, 7) && laborables(dia(seg.hasta, 1), d) <= 1) { seg.hasta = d; seg.horas += h; }
        else { seg = { desde: d, hasta: d, horas: h, mes: d.slice(0, 7) }; segmentos.push(seg); }
        por_mes[d.slice(0, 7)] = (por_mes[d.slice(0, 7)] || 0) + h;
      } else seg = null;
    }
    return { equipo: i + 1, personas: n, segmentos: segmentos.map(({ mes, ...x }) => ({ ...x, horas: r1(x.horas) })),
             por_mes: Object.fromEntries(Object.entries(por_mes).map(([k, v]) => [k, r1(v)])), horas: r1(segmentos.reduce((t, x) => t + x.horas, 0)) };
  });
  // lo que falta de cada no lista: cuantos menos pisos (o cosas) pendientes, antes
  const puntos = (faltas, sinExp) => (sinExp ? 99 : faltas.reduce((t, f) => { const m = String(f).match(/(\d+)\s+pisos?/); return t + (m ? Number(m[1]) : 1); }, 0));
  const candidatas = prog.filter((p) => p.x.sinFecha).map((p) => {
    const o = p.x.o;
    const exp = estadoLista(o, p.x.f, cf.expedientes ? cf.expedientes[o.obra_id] : null, (cf.sabadell?.pendientes || []).find((a) => a.ccpp_id === o.obra_id) || null, !!cf.sabadell);
    const faltas = exp.faltas || [];
    return { obra_id: o.obra_id, nombre: o.nombre, horas: r1(p.x.horas), grande: p.esGrande, faltas, puntos: puntos(faltas, exp.sin_expediente),
             ...(() => { const ld = listaDesde(p.x, exp, base.m.tram, hoy); return { lista_desde: ld.fecha, motivo: ld.motivo, falta_txt: `lista ≈ ${dm(ld.fecha)} (${ld.motivo})` }; })() };
  // (06/10/2026) la más próxima primero; a igual fecha, la que menos cosas tiene pendientes
  }).sort((a, b) => a.lista_desde.localeCompare(b.lista_desde) || a.puntos - b.puntos || a.horas - b.horas);
  const meses = [...new Set(cuadrillas.flatMap((c) => Object.keys(c.por_mes)))].sort();
  const out = { cuadrillas, candidatas, hasta };
  // por mes, las que lo pueden llenar (lista en ese mes o el siguiente) y cuántas quedan fuera
  out.por_mes = Object.fromEntries(meses.map((m) => { const { xs, resto } = candidatasMes(out, m); return [m, { candidatas: xs.map((c) => c.obra_id), resto }]; }));
  return out;
}

// «Noviembre: Cuadrilla 2 con 350 h sin obra lista. Lo llenaría: Moncayo 6 (Falta contrato: 1 piso) · …»
// costeHora: con euros («≈ −6.000 €»), solo para Mi panel
const MESES_TXT = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// Las que pueden llenar el hueco de un mes: su «lista desde» cae en ese mes o en el siguiente (06/10/2026: el aviso de
// noviembre proponía Tharsis 5 u Otelo 8, en trámite largo, y no Tordo, Perdiz o Luceros). Las demás, solo contadas.
function candidatasMes(huecos, mes) {
  const sig = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 1)).toISOString().slice(0, 7);   // el mes siguiente
  const tope = finMes(`${sig}-01`);
  const xs = (huecos?.candidatas || []).filter((c) => c.lista_desde && c.lista_desde <= tope);
  return { xs, resto: (huecos?.candidatas || []).length - xs.length };
}
function textoLlenaria(huecos, mes) {
  const { xs, resto } = candidatasMes(huecos, mes);
  const mas = resto ? ` y ${resto} más en trámite largo` : "";
  return xs.length ? ` Lo llenaría: ${xs.slice(0, 6).map((c) => `${c.nombre}: ${c.falta_txt}`).join(" · ")}${xs.length > 6 ? ` · ${xs.length - 6} más` : ""}${mas}.`
    : ` Ninguna obra puede estar lista a tiempo${mas}: hace falta cartera.`;
}
function textosHuecos(huecos, costeHora = null) {
  if (!huecos?.cuadrillas?.length) return [];
  const out = [];
  const meses = [...new Set(huecos.cuadrillas.flatMap((c) => Object.keys(c.por_mes)))].sort();
  for (const m of meses) {
    const llenaria = textoLlenaria(huecos, m);
    const xs = huecos.cuadrillas.filter((c) => (c.por_mes[m] || 0) >= 8).map((c) => `Cuadrilla ${c.equipo} con ${Math.round(c.por_mes[m])} h sin obra lista${costeHora ? ` (≈ −${Math.round(c.por_mes[m] * costeHora).toLocaleString("es-ES", { useGrouping: "always" })} €)` : ""}`);
    if (xs.length) out.push(`${MESES_TXT[Number(m.slice(5, 7)) - 1]}: ${yLista(xs)}.${llenaria}`);
  }
  return out;
}

// Calendario laboral del convenio del metal de Sevilla (config_dinero «calendario_metal», 07/10/2026): horas de trabajo
// efectivo por persona y mes (jornada anual repartida por meses, con festivos, puentes y días de convenio).
// Acepta JSON ({"2026-10": 152, …}) o «2026-10: 152; 2026-11: 144». Vacía o ilegible: {}.
function leerCalendarioMetal(valor) {
  const t = String(valor ?? "").trim();
  if (!t) return {};
  const out = {};
  try { const j = JSON.parse(t); if (j && typeof j === "object") for (const [k, v] of Object.entries(j)) if (/^\d{4}-\d{2}$/.test(k) && Number(v) > 0) out[k] = Number(v); return out; } catch {}
  for (const m of t.matchAll(/(\d{4}-\d{2})\s*[:=]\s*(\d+(?:[.,]\d+)?)/g)) if (Number(m[2].replace(",", ".")) > 0) out[m[1]] = Number(m[2].replace(",", "."));
  return out;
}

// Capacidad de cada cuadrilla por día laborable (07/10/2026), desde hoy y 24 meses: personas disponibles ese día (sin
// sus vacaciones) × horas por persona y día. Con el calendario del metal, las horas del mes ÷ días laborables del mes;
// sin él, las horas por día de la jornada («estimado»). Las horas disponibles por mes son la suma de estas, así que
// Mi panel reparte las horas de obra con el mismo calendario con el que las cuenta.
// → [{ equipo, personas, dias: { AAAA-MM-DD: h }, por_mes: { AAAA-MM: h }, estimado: { AAAA-MM: true } }]
function capacidadCuadrillas(base, hoy, calendario = {}, meses = 24) {
  const hasta = finMes(dia(`${hoy.slice(0, 7)}-01`, Math.round(meses * DIAS_MES)));
  const labMes = {};
  for (let d = `${hoy.slice(0, 7)}-01`; d <= hasta; d = dia(d, 1)) if (esLab(d)) labMes[d.slice(0, 7)] = (labMes[d.slice(0, 7)] || 0) + 1;
  const hDia = (m) => (Number(calendario?.[m]) > 0 ? Number(calendario[m]) / labMes[m] : JOR.horas_dia);
  return base.cuadrillas.map((n, i) => {
    const crew = base.nombres?.[i] ? { nombres: base.nombres[i] } : { n };
    const dias = {}, por_mes = {}, estimado = {};
    for (let d = labDesde(hoy); d <= hasta; d = dia(d, 1)) {
      if (!esLab(d)) continue;
      const m = d.slice(0, 7), h = disponibles(crew, d) * hDia(m);
      if (h > 0) dias[d] = Math.round(h * 100) / 100;
      por_mes[m] = (por_mes[m] || 0) + h;
      if (!(Number(calendario?.[m]) > 0)) estimado[m] = true;
    }
    return { equipo: i + 1, personas: n, dias, por_mes: Object.fromEntries(Object.entries(por_mes).map(([k, v]) => [k, r1(v)])), estimado };
  });
}
// Horas disponibles por mes (Mi panel): las de la capacidad por día, sumadas por mes
function horasDisponibles(base, hoy, calendario = {}, meses = 24) {
  return capacidadCuadrillas(base, hoy, calendario, meses).map(({ dias, ...c }) => c);
}

// Planificación para la caja (Mi panel usa el mismo motor, 06/10/2026): inicio, fin y cuadrilla de cada obra
// (las no listas, provisionales) y los huecos de cada cuadrilla
function planParaCaja({ cf, hoy, festivos = null, jornada = null, nombresCuadrillas = null, registros = null, calendarioMetal = null }) {
  if (!cf?.simulador?.ok || !cf.automatico?.mandos) return { obras: {}, huecos: null };
  setFestivos((festivos || leerFestivos(null)).lista);
  setJornada(jornada, hoy);
  const base = preparar({ cf, hoy, nombres: nombresCuadrillas, registros });
  const sin = new Map(programar(base, hoy, null, { sinRitmo: true, sinTramos: true }).map((p) => [p.x.o.obra_id, p]));
  const asigBase = new Map(programar(base, hoy, null, { sinRitmo: true }).map((p) => [p.x.o.obra_id, p.eq]));
  const prog = programar(base, hoy, null, { asigBase });
  const obras = Object.fromEntries(prog.map((p) => { const q = sin.get(p.x.o.obra_id);
    const ld = p.x.sinFecha ? listaDesde(p.x, estadoLista(p.x.o, p.x.f, cf.expedientes ? cf.expedientes[p.x.o.obra_id] : null, (cf.sabadell?.pendientes || []).find((a) => a.ccpp_id === p.x.o.obra_id) || null, !!cf.sabadell), base.m.tram, hoy) : null;
    // cuadrillas que se le juntan (Cambiar personas): su gente trabaja en esta obra desde ese día
    const extra = (p.equiposExtra || []).map((i) => ({ equipo: i + 1, desde: p.equiposExtraDesde[i] }));
    return [p.x.o.obra_id, { inicio: p.ini, fin: p.ult, equipo: p.eq + 1, lista: !p.x.sinFecha, ...(extra.length ? { extra } : {}), ...(p.exceso?.desde ? { exceso: { desde: p.exceso.desde, hasta: p.exceso.hasta } } : {}), ...(ld ? { pasos_lista: ld.pasos_lista, lista_desde: ld.fecha, lista_motivo: ld.motivo } : {}), con_tramos: (p.tramos || []).length > 0, movida: !!q && (q.ult !== p.ult || q.ini !== p.ini) }]; }));
  return { obras, huecos: huecosPlan(prog, base, cf, hoy), cuadrillas: base.cuadrillas, ...(() => {
    const cap = capacidadCuadrillas(base, hoy, leerCalendarioMetal(calendarioMetal));
    return { disponibles: cap.map(({ dias, ...c }) => c), capacidad: Object.fromEntries(cap.map((c) => [c.equipo, c.dias])) };
  })() };
}

// Fecha de inicio de cada obra según Planificación (jornadas, sin desvío):
// las entregas de custodia a EMASESA del cash flow van en esta fecha
function fechasInicioPlan(args) { return Object.fromEntries(Object.entries(fechasPlan(args)).map(([k, v]) => [k, v.inicio])); }
// Inicio y último día de cada obra según Planificación (con los tramos de personas y lo fichado):
// el cash flow cobra cada obra a partir de ese fin
function fechasPlan(args) {
  return planParaCaja(args).obras;
}
module.exports = { capacidadCuadrillas, leerCalendarioMetal, horasDisponibles, candidatasMes, textoLlenaria, listaDesde, planParaCaja, huecosPlan, textosHuecos, textoCuadrillaPersonas, estadoLista, setJornada, finPorHoras, setFestivos, enesimoLaborable, mesesYDias, indicadorDoc, indicadorCustodia, fechasInicioPlan, fechasPlan, fichadoPorObra, calendarioPlan, laborables, personasPorCuadrilla, textoPersonas, sumarJornadas, programar, preparar, metricas, optimizar, HORAS_DIA };
