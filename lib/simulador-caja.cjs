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
// obra (OT finalizada, o fecha de fin pasada aunque tenga menos horas de las
// previstas), o parada (sin horas en el último mes cerrado y ≥ 80 % de
// avance: Sinaí 39 67/80, Goya 21 79/80…): no es cartera pendiente; va al bloque
// «terminadas, pendientes de cobro» (Alberto, 03/10).
const finPasado = (f, hoy) => !!(f && (!hoy || String(f).slice(0, 10) <= hoy));
// Parada = sin horas en el último mes cerrado (≈ 30 días) y con el 80 % o más
const parada = (o) => o.horas_mes != null && o.horas_mes !== "" && Number(o.horas_mes) === 0 && Number(o.horas_previstas) > 0 && avance(o) >= 0.8;
// Una obra SIN COBRAR con 0 horas registradas nunca está terminada por fechas
// o estados de documentación.
const conHoras = (o) => Number(o.horas_registradas) > 0;
// Cobrada entera = terminada, tenga las horas que tenga (Betis 20 y Doctor
// Fedriani 39 se hicieron sin registrar horas). Lo de «0 h» vale solo para las
// que no están cobradas.
const terminada = (o, hoy = null) => !!o.cobrada || (Number(o.horas_previstas) > 0 && avance(o) >= 0.999) || (conHoras(o) && (finPasado(o.fin_obra, hoy) || finPasado(o.fecha_fin, hoy))) || parada(o);

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

// IVA (Alberto, 03/10): los cobros de obra entran con su 10 % y el material se
// paga con su 21 %. La diferencia de cada trimestre (IVA de lo facturado − IVA
// del material) se paga el 20 del mes siguiente (303). Si sale a devolver, no
// cuenta como entrada.
const IVA_OBRA = 0.10, IVA_MATERIAL = 0.21;
const trimestre = (iso) => `${iso.slice(0, 4)}-T${Math.ceil(Number(iso.slice(5, 7)) / 3)}`;
const pago303 = (tri) => { const [y, t] = tri.split("-T").map(Number); return `${mesSig(`${y}-${String(t * 3).padStart(2, "0")}`, 1)}-20`; };
// Obras que ya cobra la caja conocida (obra terminada sin facturar, T4): el
// simulador no las vuelve a cobrar
function obrasConocidas(cf) {
  return [...new Set([...(cf?.semanas || []).flatMap((s) => s.movs || []), ...(cf?.meses || []).flatMap((m) => m.movs || [])]
    .filter((m) => m.fila === "obra_terminada" && m.obra_id).map((m) => m.obra_id))];
}
// IVA de los movimientos conocidos del backend (los que traen «iva»)
function ivaConocido(cf) {
  return [...(cf?.semanas || []).flatMap((s) => s.movs || []), ...(cf?.meses || []).flatMap((m) => m.movs || [])]
    .filter((m) => Number(m.iva)).map((m) => ({ fecha: m.iva_fecha || m.fecha, iva: Number(m.iva), concepto: m.concepto }));
}

// Orden manual (hoja planificacion_obras): las obras con «posicion» van a esa
// posición de la cola; el resto, en el orden automático.
function aplicarPosiciones(lista) {
  const fijas = lista.filter((o) => Number(o.posicion) > 0).sort((a, b) => Number(a.posicion) - Number(b.posicion));
  if (!fijas.length) return lista;
  const out = lista.filter((o) => !(Number(o.posicion) > 0));
  for (const o of fijas) out.splice(Math.min(out.length, Number(o.posicion) - 1), 0, o);
  return out;
}

// Aplica a la lista de obras un cambio de planificación aún sin guardar
// (para ver su efecto): { obra_id, posicion, fecha_inicio_fija, cuadrilla }
function aplicarCambioPlan(obras, b) {
  if (!b || !b.obra_id) return obras;
  return obras.map((o) => {
    if (o.obra_id !== b.obra_id) return o;
    const n = { ...o, posicion: Number(b.posicion) > 0 ? Number(b.posicion) : undefined, cuadrilla: Number(b.cuadrilla) > 0 ? Number(b.cuadrilla) : undefined };
    if (b.fecha_inicio_fija) { n.inicio_fijo = String(b.fecha_inicio_fija).slice(0, 10); n.inicio_manual = true; }
    else if (o.inicio_manual) { delete n.inicio_fijo; n.inicio_manual = false; }
    return n;
  });
}

// Caja propia: punto más bajo (13 semanas y luego fin de mes) y saldo final
function resumenCaja(cf, sim, opciones = {}) {
  const serie = serieMensual(cf, sim, opciones);
  let saldo = cf.inicial.propio;
  const vals = [saldo];
  for (const s of cf.semanas) {
    const movs = [...s.movs, ...(sim?.movs || []).filter((m) => m.fecha >= s.desde && m.fecha <= s.hasta)];
    saldo = saldo == null ? null : saldo + movs.reduce((t, m) => t + (m.entra ? m.importe : -m.importe), 0);
    vals.push(saldo);
  }
  const fin13 = cf.semanas[cf.semanas.length - 1].hasta.slice(0, 7);
  for (const m of serie.meses) if (m.mes > fin13) vals.push(m.saldo);
  const ok = vals.filter((v) => v != null);
  return { minimo: ok.length ? r2(Math.min(...ok)) : null, final: serie.meses[serie.meses.length - 1]?.saldo ?? null };
}

// Cola de obras sin terminar en el orden en que se programan (la misma para
// el cash flow y para Planificación): primero las que tienen fecha de inicio
// (por fecha), luego las que llevan horas, luego el orden de la documentación
// (o.orden) o la fase; encima, las posiciones fijadas a mano
function colaObras(obras, hoy) {
  const inicioDe = (o) => String(o.inicio_fijo || o.empezada || "");
  const rango = (o) => (inicioDe(o) ? 0 : avance(o) > 0 ? 1 : 2);
  return aplicarPosiciones(obras.filter((o) => !terminada(o, hoy)).map((o, i) => ({ ...o, _i: i })).sort((a, b) =>
    (rango(a) - rango(b)) || (rango(a) === 0 ? inicioDe(a).localeCompare(inicioDe(b)) : 0) ||
    ((a.orden != null && b.orden != null) ? a.orden - b.orden : (faseNum(b) - faseNum(a))) || a._i - b._i));
}

// Custodias (dinero de vecinos, cuentas 5610, endpoint custodias): cada obra
// entrega a EMASESA lo que tiene en custodia el día que empieza según la
// Planificación, sin desvío (si la obra se mueve, la entrega se mueve con ella). Solo
// baja «En el banco», nunca la caja propia. Restos de menos de 100 €: aparte.
function entregasCustodia(custodias, prog, hoy, minimo = 100, fechasInicio = {}) {
  const entregas = [], sin_fecha = [];
  let restos = 0;
  for (const c of custodias || []) {
    const imp = Number(c.en_custodia) || 0;
    if (!(imp > 0)) continue;
    if (imp < minimo) { restos += imp; continue; }
    // solo por ccpp_id (los duplicados se arreglan con ccpp_alias en config_dinero, nunca por nombre)
    const p = prog.find((x) => x.obra_id && x.obra_id === c.ccpp_id);
    if (!p) { sin_fecha.push({ nombre: c.comunidad, importe: r2(imp) }); continue; }
    // fecha de inicio de Planificación (sin desvío) si la hay; si no, la del simulador
    const ini = (fechasInicio && fechasInicio[p.obra_id]) || p.inicio;
    entregas.push({ obra_id: p.obra_id, nombre: p.nombre, fecha: ini < hoy ? hoy : ini, importe: r2(imp), fecha_de: fechasInicio && fechasInicio[p.obra_id] ? "planificacion" : "simulador" });
  }
  entregas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { entregas, sin_fecha, restos: r2(restos), total: r2(entregas.reduce((t, e) => t + e.importe, 0)) };
}

// simular({ obras, historico, hoy, mandos: { personas, hpp, cuadrillas, desvio, mat, tram, grande }, ivaConocido })
//   historico.personas_base = personas de hoy (las de más cuestan 2.800 €/mes)
//   obra.material_previsto  = material del presupuesto (comunidades, rentabilidad-obra);
//                              sin él, el % del mando «mat» (con aviso)
//   obra.cuadrilla          = nº de cuadrilla fijado a mano (1, 2…); obra.posicion = puesto fijado a mano
//   ivaConocido             = [{ fecha, iva }] de los movimientos conocidos (para el 303)
//   conocidas               = obra_id que ya cobra la caja conocida (T4): no se cobran dos veces
function simular({ obras = [], historico = {}, hoy, mandos, ivaConocido = [], conocidas = [], custodias = [], comisionesD14 = [], fechasInicio = {} }) {
  const yaEnCaja = new Set(conocidas || []);
  // comisión ya devengada en la escalera (D14) de obras sin cobro conocido: se paga
  // esa (no una nueva) cuando el simulador las cobre
  const d14 = new Map((comisionesD14 || []).filter((c) => c.ccpp_id).map((c) => [c.ccpp_id, Number(c.importe) || 0]));
  const usadasD14 = new Set();
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
  const comision = (o, ben) => (o.sin_comision ? 0 : d14.has(o.obra_id) ? (usadasD14.add(o.obra_id), r2(d14.get(o.obra_id))) : r2(Math.max(0, comPct * ben)));
  const matPrevisto = (o) => Number(o.material_previsto) > 0;
  // material: el previsto; si no, el % propio de la obra (OO: 27 %) o el del mando
  const pctMat = (o) => (o.material_pct != null ? Number(o.material_pct) : mat);
  const matObra = (o, frac) => (matPrevisto(o) ? Number(o.material_previsto) : pctMat(o) * (Number(o.importe_total) || Number(o.importe) || 0)) * frac;
  // Terminadas (100 % de horas, fecha de fin pasada u OT finalizada): fuera
  // del calendario. Solo generan cobro (regla desde su fin, con su comisión)
  // si no tienen factura emitida ni cobro y no están ya en «obra terminada sin
  // facturar» (T4): con factura, el cobro sale de la factura (13 semanas);
  // cobradas, nada.
  const terminadas = obras.filter((o) => terminada(o, hoy)).map((o) => {
    const ff = o.fin_obra || o.fecha_fin;
    const fin = ff && String(ff).slice(0, 10) <= hoy ? String(ff).slice(0, 10) : hoy;
    const imp = Number(o.importe) || 0, tot = Number(o.importe_total) || imp;
    const ben = tot - matObra(o, 1) - (Number(o.horas_registradas) || 0) * costeH;
    const enCaja = yaEnCaja.has(o.obra_id);
    const estado_cobro = o.cobrada ? "cobrada" : o.facturada ? "facturada" : enCaja ? "en_t4" : imp > 0 ? "pendiente" : "sin_presupuesto";
    return { obra_id: o.obra_id || null, en_caja_conocida: enCaja, estado_cobro, genera_cobro: estado_cobro === "pendiente", nombre: o.nombre, fase: o.fase, importe: r2(imp), sin_presupuesto: !(imp > 0), fin, fin_con_fecha: !!(ff && String(ff).slice(0, 10) <= hoy),
             horas_registradas: Number(o.horas_registradas) || 0, horas_previstas: Number(o.horas_previstas) || 0,
             cobro: imp > 0 ? (o.mes_cobro ? fechaMasMeses(fin, o.mes_cobro) : fechaCobroObra(fin)) : null, comision: comision(o, ben) };
  });
  const libre = Array(E).fill(0), esperaEq = Array(E).fill(0);
  const maxT = Math.max(...tam), minT = Math.min(...tam);
  // Orden: primero las que tienen fecha de inicio (empezadas según el panel de
  // obras, o fijada como Urbano Orad), por fecha; luego las que llevan horas;
  // luego el de la documentación (o.orden, lib/orden-cartera) si viene; si no,
  // por fase. Encima, las posiciones fijadas a mano.
  const inicioDe = (o) => String(o.inicio_fijo || o.empezada || "");
  const empezada = (o) => avance(o) > 0 || !!o.empezada;
  const orden = colaObras(obras, hoy);
  let idle = 0;
  const prog = [];
  for (const o of orden) {
    const av = avance(o), f = faseNum(o);
    // cuándo está tramitada: pasos de trámite que le faltan × ritmo (0 si ya empezó)
    const tramT = empezada(o) ? 0 : (o.pasos != null ? Number(o.pasos) : (f >= 9 ? 0 : 9 - f)) * tram;
    // fecha fijada (OT, OO o a mano): nunca antes de estar tramitada
    const tFijo = o.inicio_fijo ? tDeFecha(hoy, o.inicio_fijo) : null;
    const antesDeTramite = tramT > 0 && tFijo != null && tFijo < tramT - 1e-9;   // ya tramitada: cualquier fecha vale
    const ready = tFijo != null ? Math.max(0, tFijo, tramT) : tramT;
    const prev = Number(o.horas_previstas) || 0;
    const frac = prev > 0 ? 1 - av : 1;
    const imp = (Number(o.importe) || 0) * frac;                               // lo que queda por cobrar (sin IVA)
    const tot = (Number(o.importe_total) || Number(o.importe) || 0) * frac;  // obra que queda por hacer
    const matE = matObra(o, frac);
    // horas: previstas pendientes × (1 + desvío); sin previstas pero con margen
    // objetivo, las que dejan ese beneficio
    const hrs = prev > 0 ? prev * frac * k : (o.margen_objetivo && costeH > 0 ? Math.max(0, (tot - matE - Number(o.margen_objetivo) * tot) / costeH) : 0);
    const horasRef = prev > 0 ? prev : hrs;
    const esGrande = horasRef >= grande;
    // cuadrilla: la fijada a mano; si no, la más grande si es obra grande y la
    // más pequeña si no; si la preferida tarda más de un mes en quedar libre, a
    // la que esté libre (comparando cuándo podría empezar en cada una)
    const fijada = Number(o.cuadrilla) >= 1 && Number(o.cuadrilla) <= E ? Number(o.cuadrilla) - 1 : null;
    let eq;
    if (fijada != null) eq = fijada;
    else {
      const quiere = esGrande ? maxT : minT;
      const pref = [...Array(E).keys()].filter((i) => maxT === minT || tam[i] === quiere);
      eq = pref.reduce((a, i) => (libre[i] < libre[a] ? i : a), pref[0]);
      const otra = [...Array(E).keys()].reduce((a, i) => (libre[i] < libre[a] ? i : a), 0);
      if (Math.max(libre[otra], ready) + 1 < Math.max(libre[eq], ready)) eq = otra;
    }
    const t0 = Math.max(libre[eq], ready);
    // esperar a una fecha de inicio ya fijada no es esperar trámite
    const espera = tFijo != null && tFijo >= tramT ? 0 : t0 - libre[eq];
    idle += espera * cap[eq]; esperaEq[eq] += espera;
    const t1 = cap[eq] > 0 ? t0 + hrs / cap[eq] : t0;
    const desdeLibre = libre[eq];
    libre[eq] = t1;
    const ben = tot - matE - hrs * costeH;
    const ini0 = inicioDe(o).slice(0, 10);
    const inicio = ini0 && ini0 < hoy && t0 === 0 ? ini0 : fechaDeT(hoy, t0);
    const fin = fechaDeT(hoy, t1);
    prog.push({ obra_id: o.obra_id || null, nombre: o.nombre, fase: o.fase, importe: r2(imp), importe_total: r2(tot), sin_presupuesto: !(Number(o.importe) > 0), horas: r2(hrs), avance_pct: Math.round(av * 100),
                material: r2(matE), material_estimado: !matPrevisto(o),
                estado_doc: o.estado_doc || null, atascada_dias: o.atascada_dias || null, pasos: o.pasos ?? null, tipo: o.tipo || null,
                tramitada: fechaDeT(hoy, tramT), antes_de_tramite: antesDeTramite, manual: !!(o.posicion || o.cuadrilla || o.inicio_manual),
                equipo: eq + 1, cuadrilla: tam[eq], grande: esGrande, t0: r2(t0), t1: r2(t1), espera: r2(espera), espera_desde: espera > 0 ? fechaDeT(hoy, desdeLibre) : null,
                // ya facturada o cobrada (panel de Guillermo): su cobro está en las facturas o en el banco
                inicio, fin, cobro: imp > 0 && !o.facturada ? (o.mes_cobro ? fechaMasMeses(fin, o.mes_cobro) : fechaCobroObra(fin)) : null,
                ya_facturada: !!o.facturada, importe_provisional: !!o.importe_provisional, importe_provisional_ref: o.importe_provisional_ref || null, material_pct: matPrevisto(o) ? null : Math.round(pctMat(o) * 100),
                mes_cobro: o.mes_cobro || null, sin_comision: !!o.sin_comision,
                beneficio: r2(ben), comision: o.facturada ? 0 : comision(o, ben) });
  }
  // movimientos con fecha (cobros con su 10 % de IVA, material con su 21 %)
  const reglaCobro = (p) => (p.mes_cobro ? `cobro ${p.mes_cobro} mes(es) después de terminar` : "cobro 2 meses + día 5/20");
  const movs = [];
  const cobro = (fecha, base, concepto, fuente, ivaFecha) => movs.push({ fila: "sim_cobros", fecha, importe: r2(base * (1 + IVA_OBRA)), base: r2(base), iva: r2(base * IVA_OBRA), iva_fecha: ivaFecha, entra: true, concepto, fuente: `${fuente} · con ${Math.round(IVA_OBRA * 100)} % de IVA`, fiabilidad: "estimado" });
  for (const p of terminadas) {
    if (!p.genera_cobro) continue;     // facturada, cobrada o ya en «obra terminada sin facturar»
    cobro(p.cobro, p.importe, `${p.nombre} (terminada, pendiente de cobro)`, `Simulador: obra terminada el ${p.fin}, cobro 2 meses + día 5/20`, p.cobro);
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  for (const p of prog) {
    if (p.importe > 0 && p.cobro) cobro(p.cobro, p.importe, `${p.nombre} (fase ${String(p.fase).slice(0, 2)})`, `Simulador: termina ${p.fin}, ${reglaCobro(p)}`, p.fin);
    if (p.material > 0) {
      const desde = p.inicio < hoy ? hoy : p.inicio;
      const dias = p.inicio < hoy ? Math.max(0, 90 - Math.round((Date.parse(hoy) - Date.parse(p.inicio)) / 86400000)) : 90;
      movs.push({ fila: "sim_material", fecha: sumarDias(desde, dias), importe: r2(p.material * (1 + IVA_MATERIAL)), base: p.material, iva: -r2(p.material * IVA_MATERIAL), iva_fecha: desde, concepto: `Material ${p.nombre}`,
                  fuente: `Simulador: ${p.material_estimado ? `${p.material_pct} % del presupuesto (sin material previsto)` : "material previsto del presupuesto"}, 3 meses después de empezar, con ${Math.round(IVA_MATERIAL * 100)} % de IVA`, fiabilidad: "estimado" });
    }
    if (p.comision > 0) movs.push({ fila: "sim_comision", fecha: p.cobro, importe: p.comision, concepto: `Comisión ${p.nombre}`, fuente: `Simulador: ${Math.round(comPct * 100)} % del beneficio, al cobro`, fiabilidad: "estimado" });
  }
  const t = Math.max(0, ...libre);
  const ultimoCobro = [...prog, ...terminadas].map((p) => p.cobro).filter(Boolean).sort().pop() || null;
  const finMes = [ultimoCobro ? ultimoCobro.slice(0, 7) : null, FIN_MINIMO].filter(Boolean).sort().pop();
  // 303 de cada trimestre: IVA cobrado al facturar − IVA del material
  const porTri = {};
  for (const x of [...movs.filter((m) => m.iva), ...ivaConocido]) {
    const f = String(x.iva_fecha || x.fecha).slice(0, 10);
    if (f < hoy) continue;
    const q = trimestre(f);
    porTri[q] = (porTri[q] || 0) + Number(x.iva);
  }
  const iva_trimestres = Object.keys(porTri).sort().map((q) => ({ trimestre: q, iva: r2(porTri[q]), pago: pago303(q), a_devolver: porTri[q] < 0 }));
  for (const q of iva_trimestres) {
    if (q.iva > 0 && q.pago.slice(0, 7) <= finMes) movs.push({ fila: "sim_iva", fecha: q.pago, importe: q.iva, concepto: `IVA ${q.trimestre.replace("-T", " T")} (303)`, fuente: "Simulador: IVA de lo facturado (10 %) − IVA del material (21 %) del trimestre, el 20 del mes siguiente", fiabilidad: "estimado" });
  }
  // obra hecha, material y beneficio por mes (antes de IS) y personas de más
  const produccion = {}, beneficio = {}, terminan = {};
  const matMes = {}, p5Mes = {}, p5Mat = {};
  for (let m = hoy.slice(0, 7); m <= finMes; m = mesSig(m)) { produccion[m] = 0; matMes[m] = 0; p5Mes[m] = 0; p5Mat[m] = 0; terminan[m] = 0; }
  const reparte = (m, p, f) => { if (produccion[m] == null) return; produccion[m] += p.importe_total * f; matMes[m] += p.material * f; if (!p.sin_comision) { p5Mes[m] += p.importe_total * f; p5Mat[m] += p.material * f; } };
  for (const p of prog) {
    if (terminan[p.fin.slice(0, 7)] != null) terminan[p.fin.slice(0, 7)]++;
    const ini = p.inicio < hoy ? hoy : p.inicio;
    if (ini >= p.fin) { reparte(ini.slice(0, 7), p, 1); continue; }   // empieza y acaba el mismo día
    for (let m = ini.slice(0, 7); m <= p.fin.slice(0, 7) && m <= finMes; m = mesSig(m)) {
      const a = Math.max(Date.parse(ini), Date.parse(`${m}-01`)), b = Math.min(Date.parse(p.fin), Date.parse(finDeMes(m)) + 86400000);
      if (b > a) reparte(m, p, (b - a) / (Date.parse(p.fin) - Date.parse(ini)));
    }
  }
  for (const m of Object.keys(produccion)) {
    produccion[m] = r2(produccion[m]);
    const dias = Number(finDeMes(m).slice(8, 10));
    const frac = m === hoy.slice(0, 7) ? (dias - Number(hoy.slice(8, 10)) + 1) / dias : 1;
    // beneficio = obra hecha − material − nómina de obra − 20 % de Guillermo (Plan 5) − indirectos y generales
    const mo = moOp * frac, sh = produccion[m] > 0 ? p5Mes[m] / produccion[m] : 0;
    const gui = Math.max(0, comPct * (p5Mes[m] - p5Mat[m] - mo * sh));
    beneficio[m] = r2(produccion[m] - matMes[m] - mo - gui - ((Number(fijos.indirectos) || 0) + (Number(fijos.generales) || 0)) * frac);
    if (extra > 0) movs.push({ fila: "sim_operarios", fecha: `${m}-28` < hoy ? hoy : `${m}-28`, importe: r2(COSTE_PERSONA_EXTRA * extra * frac), concepto: `Personas de más en obra (${extra})`, fuente: "Simulador: 2.800 €/mes cada una", fiabilidad: "estimado" });
  }
  const benTot = r2(prog.reduce((s, p) => s + p.beneficio - p.comision, 0));
  return {
    movs: movs.sort((a, b) => a.fecha.localeCompare(b.fecha)), prog, terminadas, produccion, beneficio, terminan, iva_trimestres,
    custodia: entregasCustodia(custodias, prog, hoy, 100, fechasInicio),
    comisiones_d14_sin_fecha: (comisionesD14 || []).filter((c) => !usadasD14.has(c.ccpp_id)),
    idle: r2(idle), horas_mes: H, personas: P, hpp, cuadrillas: tam, equipos: E, personas_extra: extra, espera_por_equipo: esperaEq.map(r2),
    meses_obra: r2(t), fin_obras: prog.length ? fechaDeT(hoy, t) : null,
    ultimo_cobro: ultimoCobro, fin_mes: finMes, beneficio_cartera: benTot, cartera: cartera(obras, hoy),
    avisos: {
      sin_material: prog.filter((p) => p.material_estimado && p.importe_total > 0).map((p) => p.nombre),
      sin_material_pct: prog.filter((p) => p.material_estimado && p.importe_total > 0).map((p) => ({ nombre: p.nombre, pct: p.material_pct })),
      sin_presupuesto: prog.filter((p) => p.sin_presupuesto).map((p) => ({ nombre: p.nombre, material: p.material, horas: p.horas })),
      // importe provisional (config_dinero presupuesto_provisional): falta en el panel de Guillermo
      importe_provisional: prog.filter((p) => p.importe_provisional).map((p) => ({ nombre: p.nombre, importe: p.importe_total, ref: p.importe_provisional_ref })),
      antes_de_tramite: prog.filter((p) => p.antes_de_tramite).map((p) => ({ nombre: p.nombre, tramitada: p.tramitada })),
    },
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
  const apartado = cf.inicial?.custodia_y_senales ?? null;
  let entregadaAcum = 0;
  for (let m = cf.hoy.slice(0, 7); m <= finMes; m = mesSig(m)) {
    const ms = todos.filter((x) => x.fecha.slice(0, 7) === m);
    const entra = r2(ms.filter((x) => x.entra).reduce((t, x) => t + x.importe, 0));
    const sale = r2(ms.filter((x) => !x.entra).reduce((t, x) => t + x.importe, 0));
    saldo = saldo == null ? null : r2(saldo + entra - sale);
    // banco real = caja propia + custodia (y señales) aún no entregada a EMASESA
    const entregada = (sim?.custodia?.entregas || []).filter((e) => e.fecha.slice(0, 7) === m).reduce((t, e) => t + e.importe, 0);
    entregadaAcum += entregada;
    const banco = saldo == null || apartado == null ? null : r2(saldo + apartado - entregadaAcum);
    meses.push({ mes: m, entra, sale, saldo, movs: ms, produccion: sim?.produccion?.[m] ?? null, beneficio: sim?.beneficio?.[m] ?? null,
                 custodia_entregada: r2(entregada), custodia_pendiente: apartado == null ? null : r2(apartado - entregadaAcum), banco });
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
  // (también las de fases 05-09 ya terminadas: fecha de fin pasada o paradas al
  // 80 %; las que acaban por debajo de sus horas cuentan como ahorro)
  const acabada = (o) => (/^1[4-8]_/.test(o.fase || "") && o.fecha_fin && o.fecha_fin >= desde)
    || (/^0[5-9]_/.test(o.fase || "") && terminada(o, hoy) && (!o.fecha_fin || o.fecha_fin >= desde));
  const candidatas = d ? (d.obras || []).filter((o) => acabada(o) && Number(o.horas_previstas) > 0 && Number(o.horas_registradas) > 0) : [];
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

module.exports = { cartera, simular, serieMensual, calibrar, tamanosCuadrillas, ivaConocido, obrasConocidas, entregasCustodia, aplicarCambioPlan, resumenCaja, colaObras, terminada, avance, aplicarPosiciones, trimestre, pago303, IVA_OBRA, IVA_MATERIAL, fechaCobroObra, fechaDeT, mesSig, finDeMes, COSTE_PERSONA_EXTRA, FIN_MINIMO };
