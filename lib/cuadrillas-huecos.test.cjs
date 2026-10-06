// 06/10/2026 · «Se meten en obras pequeñas, no se puede quedar vacío» (Alberto):
//   · una cuadrilla libre coge la siguiente obra lista, grande o pequeña («grandes» es preferencia, no exclusiva)
//   · si no hay obra lista para un tramo, es un HUECO: horas sin obra y qué obras lo llenarían, primero las que
//     menos les falta
//   · Mi panel usa el mismo motor: cada obra, un solo tramo con la cuadrilla y las fechas de Planificación
//   · «valor a fin de mes»: el beneficio de las obras que ya están en el valor de hoy (T4) no vuelve a sumar
// Uso: node lib/cuadrillas-huecos.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");
const S = require("./simulador-caja.cjs");

const HOY = "2026-10-06";
const fest = { lista: ["2026-10-12", "2026-11-02", "2026-12-08", "2026-12-25"], fuente: "config_dinero", errores: [] };
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 9000, horas_previstas: h, horas_registradas: 0, material_previsto: 2000, faltan_docs: 0, total_docs: 2, pasos: 0, ...extra });
const listo = { pisos: 6, contratos: { total: 6, faltan: [] }, pagos: { total: 6, faltan: [], financiados: [] }, documentacion: { total: 2, faltan: 0 }, cuadre: { ok: true } };
const pisos = (n) => Array.from({ length: n }, (_, i) => `${i + 1}ºA`);
const expedientes = {
  rl: listo, lp: listo, mj: listo,
  lu: { ...listo, contratos: { total: 6, faltan: pisos(5) } },            // Luceros 4: 5 contratos
  pe: { ...listo, pagos: { total: 6, faltan: pisos(4), financiados: [] } }, // Perdiz 5: 4 pagos
  mo: { ...listo, contratos: { total: 6, faltan: pisos(1) } },            // Moncayo 6: 1 contrato
  to: { ...listo, pagos: { total: 6, faltan: [], financiados: [{ vivienda: "1ºA", meses: 24 }, { vivienda: "2ºA", meses: 24 }] } },   // Tordo 18: Sabadell
  df: listo,
  ch: { ...listo, contratos: { total: 6, faltan: pisos(2) }, documentacion: { total: 2, faltan: 0 } },   // Chiva 7: en trámite y 2 contratos
  // Mar de Alborán 14: sin expediente
};
const sabadell = { pendientes: [{ ccpp_id: "to", viviendas: ["1ºA", "2ºA"], importe: 4000 }] };
const obras = O.aplicarPlanificacion([
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29", horas_registradas: 40 }),
  { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
  // las no listas como en producción (06/10): ya tramitadas (fase 09) pero con contratos, pagos o abonos de Sabadell
  // pendientes (lista ≈ +1 mes), y Mar de Alborán con el expediente vacío (+2 meses)
  ob("ma", "Mar de Alborán 14", 420, { orden: 1 }), ob("lu", "Luceros 4", 380, { orden: 2 }),
  ob("rl", "Rafael Laffón 7", 142, { orden: 3 }), ob("lp", "La Paz 29", 192, { orden: 4 }), ob("mj", "Mijares 3", 102, { orden: 5 }),
  ob("pe", "Perdiz 5", 150, { orden: 6 }), ob("to", "Tordo 18", 140, { orden: 7 }), ob("mo", "Moncayo 6", 120, { orden: 8 }),
  // y una en trámite que además tiene contratos pendientes: la más tardía de las dos (2 pasos de trámite)
  ob("ch", "Chiva 7", 100, { orden: 9, fase: "07_PTE_CYCP", pasos: 2 }),
  // en trámite largo (producción, 06/10: el aviso de noviembre las proponía): fuera de «Lo llenaría»
  ob("th", "Tharsis 5", 90, { orden: 20, fase: "05_DOCUMENTACION", pasos: 4, faltan_docs: 9, total_docs: 9 }),
  ob("ot", "Otelo 8", 110, { orden: 21, fase: "06_VISITA_EMASESA", pasos: 3 }),
  // una sola cosa pendiente pero lista más tarde (en trámite): con fe8bd723 (orden por «menos pendientes» y corte a 6)
  // pasaba por delante de Tordo, Perdiz y Luceros y las dejaba fuera
  ob("df", "Doctor Fedriani 17", 130, { orden: 22, fase: "08_CYCP", pasos: 2 }),
], []);
const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: [], expedientes, sabadell,
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
const args = { cf, hoy: HOY, festivos: fest, jornada: J.leerJornada({ horas_dia: "8" }), nombresCuadrillas: quienes, registros: [] };

const r = P.calendarioPlan(args);
const pc = P.planParaCaja(args);
const ver = () => r.obras.map((o) => `${o.nombre}: C${o.equipo} ${o.inicio}→${o.fin}${o.sin_fecha ? " (no lista)" : ""}`).join("\n");
const listas = r.obras.filter((o) => !o.sin_fecha && o.estado_plan === "sugerencia");

// 1 · ninguna cuadrilla con hueco mientras haya una obra lista esperando
for (const c of pc.huecos.cuadrillas) for (const s of c.segmentos) {
  const espera = listas.find((o) => o.inicio > s.desde && o.tramitada <= s.desde);
  assert.ok(!espera, `C${c.equipo} con hueco desde ${s.desde} y ${espera?.nombre} esperando (empieza ${espera?.inicio})\n${ver()}`);
}
// las tres listas están programadas y las no listas van detrás, provisionales
assert.deepStrictEqual(listas.map((o) => o.nombre).sort(), ["La Paz 29", "Mijares 3", "Rafael Laffón 7"]);
assert.deepStrictEqual(r.obras.filter((o) => o.sin_fecha).map((o) => o.nombre).sort(), ["Chiva 7", "Doctor Fedriani 17", "Luceros 4", "Mar de Alborán 14", "Moncayo 6", "Otelo 8", "Perdiz 5", "Tharsis 5", "Tordo 18"]);

// 2 · huecos: horas sin obra lista y qué las llenaría, primero las que menos les falta
const horasHueco = pc.huecos.cuadrillas.reduce((t, c) => t + c.horas, 0);
assert.ok(horasHueco > 0, JSON.stringify(pc.huecos));
// la más próxima primero y, a igual fecha, la que menos tiene pendiente; en noviembre, solo las que pueden estar
// listas en noviembre o diciembre (Tharsis y Otelo, en trámite largo, fuera)
assert.deepStrictEqual(pc.huecos.candidatas.map((c) => c.nombre).slice(0, 4), ["Moncayo 6", "Tordo 18", "Perdiz 5", "Luceros 4"]);
const nov = P.candidatasMes(pc.huecos, "2026-11");
assert.deepStrictEqual([nov.xs.map((c) => c.nombre).slice(0, 4), nov.resto], [["Moncayo 6", "Tordo 18", "Perdiz 5", "Luceros 4"], 2]);
assert.ok(nov.xs.findIndex((c) => c.nombre === "Doctor Fedriani 17") > 3, "Fedriani (lista ≈ 07/12) va detrás de las del 05/11");
// las no listas con tramo provisional dentro del hueco también se proponen (son las que lo llenarían)
const enHueco = r.obras.filter((o) => o.sin_fecha && o.inicio.slice(0, 7) <= "2026-11" && o.fin.slice(0, 7) >= "2026-11").map((o) => o.nombre);
assert.ok(enHueco.length > 0 && enHueco.every((n) => nov.xs.some((c) => c.nombre === n)), JSON.stringify(enHueco));
// de dónde sale la fecha: «lista ≈ 05/11 (falta abono Sabadell: 2 pisos)»
const cand = (n) => pc.huecos.candidatas.find((c) => c.nombre === n);
assert.strictEqual(cand("Tordo 18").falta_txt, "lista ≈ 05/11 (falta abono Sabadell: 2 pisos)");
assert.strictEqual(cand("Moncayo 6").falta_txt, "lista ≈ 05/11 (falta contrato: 1 piso)");
assert.strictEqual(cand("Mar de Alborán 14").falta_txt, "lista ≈ 07/12 (expediente vacío)");
assert.strictEqual(cand("Chiva 7").falta_txt, "lista ≈ 07/12 (en trámite (fase 07) · falta contrato: 2 pisos)");
// y en la ficha de Planificación
assert.deepStrictEqual(r.obras.find((o) => o.nombre === "Tordo 18").lista_desde, { pasos_lista: 1, fecha: "2026-11-05", motivo: "falta abono Sabadell: 2 pisos" });
// Planificación lo avisa
const avNov = r.avisos.find((a) => a.tipo === "hueco" && /^Noviembre/.test(a.texto));
assert.ok(avNov && /Lo llenaría: Moncayo 6: lista ≈ 05\/11 \(falta contrato: 1 piso\) · Tordo 18/.test(avNov.texto) && /y 2 más en trámite largo\.$/.test(avNov.texto) && !/Tharsis|Otelo/.test(avNov.texto), avNov?.texto);

// 3 · Mi panel con el mismo motor: cada obra, un solo tramo con la cuadrilla de Planificación
const sim = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, enValor: ["jm", "orad"] });
for (const p of sim.prog) {
  const q = pc.obras[p.obra_id];
  if (!q || q.lista === false) continue;
  assert.deepStrictEqual([p.equipo, p.inicio, p.fin], [q.equipo, q.inicio, q.fin], p.nombre);
}
// las no listas: desde que pueden estar listas (hoy + pasos × 1 mes), en la cuadrilla que antes quede libre,
// sin pisar otra obra de su cuadrilla
const noListas = sim.prog.filter((p) => p.provisional);
assert.deepStrictEqual(noListas.map((p) => p.obra_id).sort(), ["ch", "df", "lu", "ma", "mo", "ot", "pe", "th", "to"]);
// ninguna entra hoy: desde primeros de noviembre (contratos, pagos, Sabadell) o de diciembre (expediente vacío, trámite)
assert.deepStrictEqual(noListas.map((p) => [p.obra_id, p.lista_desde.slice(0, 7)]).sort(), [["ch", "2026-12"], ["df", "2026-12"], ["lu", "2026-11"], ["ma", "2026-12"], ["mo", "2026-11"], ["ot", "2027-01"], ["pe", "2026-11"], ["th", "2027-02"], ["to", "2026-11"]]);
assert.strictEqual(sim.obra_provisional["2026-10"] || 0, 0);
assert.strictEqual(sim.prog.find((p) => p.obra_id === "to").lista_motivo, "falta abono Sabadell: 2 pisos");
for (const p of noListas) assert.ok(p.inicio >= p.lista_desde, `${p.nombre} empieza ${p.inicio} antes de poder estar lista (${p.lista_desde})`);
for (const e of [1, 2]) {
  const xs = sim.prog.filter((p) => p.equipo === e).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < xs.length; i++) if (xs[i].provisional) assert.ok(xs[i].inicio >= xs[i - 1].fin, `C${e}: ${xs[i].nombre} (${xs[i].inicio}) pisa ${xs[i - 1].nombre} (hasta ${xs[i - 1].fin})`);
}
// (07/10/2026) la entrada que llega a Mi panel (dinero-empresa → plan_obras) con su «lista desde»: aunque falten
// pasos_lista, ninguna no lista empieza antes de esa fecha (en producción salían «lista ≈ 06/10» y Mar en noviembre)
{
  const soloFecha = Object.fromEntries(Object.entries(pc.obras).map(([k, v]) => [k, v.lista === false ? { inicio: v.inicio, fin: v.fin, equipo: v.equipo, lista: false, lista_desde: v.lista_desde } : v]));
  const s2 = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: soloFecha });
  for (const p of s2.prog.filter((x) => x.provisional)) assert.ok(p.inicio >= pc.obras[p.obra_id].lista_desde && p.lista_desde === pc.obras[p.obra_id].lista_desde, `${p.nombre}: ${p.inicio} / ${p.lista_desde}`);
  assert.ok(s2.prog.find((p) => p.obra_id === "ma").inicio >= "2026-12-07");
}
// con cinco no listas que pueden estar listas a primeros de diciembre, ninguna cuadrilla se queda sin obra en diciembre
for (const e of [1, 2]) assert.ok(sim.prog.some((p) => p.equipo === e && p.inicio.slice(0, 7) <= "2026-12" && p.fin.slice(0, 7) >= "2026-12"), `C${e} sin obra en diciembre`);
// capacidad: ninguna cuadrilla con más horas en un mes de las que puede hacer (personas × días laborables × 8 h, +10 %)
{
  const lab = (a, b) => { let n = 0; for (let d = a; d <= b; d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)) { const w = new Date(d + "T00:00:00Z").getUTCDay(); if (w && w !== 6 && !fest.lista.includes(d)) n++; } return n; };
  const porEqMes = {};
  for (const p of sim.prog) {
    const ini = p.inicio < HOY ? HOY : p.inicio, total = lab(ini, p.fin) || 1;
    for (let m = ini.slice(0, 7); m <= p.fin.slice(0, 7); m = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).toISOString().slice(0, 7)) {
      const a = ini > `${m}-01` ? ini : `${m}-01`, fm = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10), b = p.fin < fm ? p.fin : fm;
      const k = `${p.equipo}|${m}`; porEqMes[k] = (porEqMes[k] || 0) + (p.horas_base || 0) * lab(a, b) / total;
    }
  }
  for (const [k, h] of Object.entries(porEqMes)) {
    const [e, m] = k.split("|"); const fm = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const cap = [2, 3][Number(e) - 1] * 8 * lab(m === HOY.slice(0, 7) ? HOY : `${m}-01`, fm);
    assert.ok(h <= cap * 1.1 + 1, `C${e} en ${m}: ${Math.round(h)} h para ${cap} h de capacidad`);
  }
}
// (07/10/2026) horas por cuadrilla y mes: disponibles (personas × laborables sin festivos × 8 h) y asignadas (horas de
// presupuesto de sus obras, sin desvío, con las no listas aparte)
{
  const disp = (e, m) => pc.disponibles.find((c) => c.equipo === e).por_mes[m];
  assert.deepStrictEqual([disp(1, "2026-11"), disp(2, "2026-11")], [320, 480]);   // 20 laborables (02/11 festivo)
  const asig = (e, m) => sim.horas_cuadrilla[e]?.[m] || { horas: 0, no_listas: 0, obras: {} };
  // noviembre con hueco: la Cuadrilla 2 por debajo del 70 % sin contar las no listas
  const c2 = asig(2, "2026-11");
  assert.ok((c2.horas - c2.no_listas) / disp(2, "2026-11") < 0.7, JSON.stringify(c2));
  // las horas de todas las obras suman sus horas de presupuesto (sin desvío)
  const tot = Object.values(sim.horas_cuadrilla).flatMap((ms) => Object.values(ms)).reduce((t, c) => t + c.horas, 0);
  const prev = sim.prog.reduce((t, p) => t + p.horas_base, 0);
  assert.ok(Math.abs(tot - prev) < 2, `${tot} / ${prev}`);
  // sin calendario del metal: todos los meses «estimado»
  assert.ok(pc.disponibles.every((c) => c.estimado["2026-11"]));
  // con calendario del metal (config_dinero «calendario_metal»): personas × horas del mes; el mes que falte, estimado
  assert.deepStrictEqual(P.leerCalendarioMetal('{"2026-11": 144, "2026-12": 136.5, "x": 3}'), { "2026-11": 144, "2026-12": 136.5 });
  assert.deepStrictEqual(P.leerCalendarioMetal("2026-11: 144; 2026-12 = 136,5"), { "2026-11": 144, "2026-12": 136.5 });
  assert.deepStrictEqual(P.leerCalendarioMetal(""), {});
  const conCal = P.planParaCaja({ ...args, calendarioMetal: "2026-11: 144; 2026-12: 136" });
  const c1 = conCal.disponibles.find((c) => c.equipo === 1), c2b = conCal.disponibles.find((c) => c.equipo === 2);
  assert.deepStrictEqual([c1.por_mes["2026-11"], c2b.por_mes["2026-11"], c1.por_mes["2026-12"], !!c1.estimado["2026-11"], !!c1.estimado["2027-01"]], [288, 432, 272, false, true]);
  // las vacaciones de agosto (convenio por defecto, sin fechas por persona) se restan
  const ago = P.planParaCaja({ ...args, calendarioMetal: "2027-08: 120" }).disponibles.find((c) => c.equipo === 1).por_mes["2027-08"];
  assert.ok(ago < 2 * 120, String(ago));
  console.log(`  horas nov: C1 ${Math.round(asig(1, "2026-11").horas)} / ${disp(1, "2026-11")} · C2 ${Math.round(c2.horas)} (${Math.round(c2.no_listas)} no listas) / ${disp(2, "2026-11")}`);
}
// (07/10/2026) en Planificación ninguna no lista empieza antes de su «lista desde» (Mar de Alborán salía el 24/11)
for (const o of r.obras.filter((x) => x.sin_fecha)) assert.ok(o.inicio >= o.lista_desde.fecha, `${o.nombre}: empieza ${o.inicio}, lista ≈ ${o.lista_desde.fecha}`);
// (07/10/2026) con la capacidad por día de cada cuadrilla (calendario laboral): ningún mes por encima del 100 %, ni por
// cuadrilla ni en total; las horas de presupuesto no se pierden (lo que no cabe pasa a los días siguientes)
{
  assert.ok(pc.capacidad && Object.keys(pc.capacidad["1"] || {}).length > 200, "capacidad por día");
  const sc = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, capacidad: pc.capacidad, enValor: ["jm", "orad"], desvioMO: 0.2 });
  const meses = [...new Set(Object.values(sc.horas_cuadrilla).flatMap((ms) => Object.keys(ms)))].sort();
  for (const m of meses) {
    let a = 0, d = 0;
    for (const c of pc.disponibles) {
      const h = sc.horas_cuadrilla[c.equipo]?.[m]?.horas || 0, dm = c.por_mes[m] || 0;
      assert.ok(h <= dm + 0.5, `C${c.equipo} en ${m}: ${Math.round(h)} h asignadas con ${dm} h disponibles`);
      a += h; d += dm;
    }
    assert.ok(a <= d + 0.5, `total en ${m}: ${Math.round(a)} / ${d}`);
  }
  const asignadas = Object.values(sc.horas_cuadrilla).flatMap((ms) => Object.values(ms)).reduce((t, c) => t + c.horas, 0);
  const presupuesto = sc.prog.reduce((t, p) => t + p.horas_base, 0);
  assert.ok(Math.abs(asignadas - presupuesto) < 1, `${asignadas} / ${presupuesto}`);
  // Orad (640 h, C2 de 3 personas) ya no cabe en octubre: se alarga y empuja a las de detrás
  const orad = sc.prog.find((p) => p.obra_id === "orad");
  assert.ok(orad.fin > "2026-11-01" && (sc.horas_cuadrilla[2]["2026-10"].obras["Urbano Orad 13-15"] || 0) <= pc.disponibles[1].por_mes["2026-10"] + 0.5, orad.fin);
  // ninguna no lista antes de su «lista desde», también con el reparto
  for (const p of sc.prog.filter((x) => x.provisional)) assert.ok(p.inicio >= p.lista_desde, `${p.nombre} ${p.inicio} < ${p.lista_desde}`);
  // la obra hecha y el beneficio, con este reparto (la fórmula, la misma)
  assert.ok(Object.values(sc.produccion).every((v) => v >= 0));
  console.log(`  capacidad: ${meses.slice(0, 4).map((m) => `${m} ${pc.disponibles.map((c) => `C${c.equipo} ${Math.round(sc.horas_cuadrilla[c.equipo]?.[m]?.horas || 0)}/${c.por_mes[m]}`).join(" ")}`).join(" · ")} · Orad hasta ${orad.fin}`);
}
// (07/10/2026) Urbano Orad con la Cuadrilla 1 desde el 19/10 (Cambiar personas): el reparto suma la capacidad de la que
// se junta desde su fecha (3 personas hasta el 16/10, 5 desde el 19/10) y termina mucho antes que solo con la C2
{
  const obrasJ = O.aplicarPlanificacion(obras, [{ obra_id: "orad", desde: "2026-10-19", operarios: "Manuel, Cristhian, Juan, Luis, Mario", nota: "juntas", usuario: "Alberto", fecha: "2026-10-06T09:00:00Z" }]);
  const cfJ = { ...cf, simulador: { ...cf.simulador, obras: obrasJ } };
  const pj = P.planParaCaja({ ...args, cf: cfJ });
  assert.deepStrictEqual(pj.obras.orad.extra, [{ equipo: 1, desde: "2026-10-19" }]);
  const sj = S.simular({ obras: obrasJ, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pj.obras, capacidad: pj.capacidad, enValor: ["jm", "orad"] });
  const oj = sj.prog.find((p) => p.obra_id === "orad");
  const sinJ = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, capacidad: pc.capacidad, enValor: ["jm", "orad"] }).prog.find((p) => p.obra_id === "orad");
  assert.ok(oj.fin < sinJ.fin, `con la C1 termina ${oj.fin}; sin ella ${sinJ.fin}`);
  // en octubre, horas de Orad en la C1 desde el 19/10 y nada por encima del 100 %
  assert.ok((sj.horas_cuadrilla[1]["2026-10"].obras["Urbano Orad 13-15"] || 0) > 100, JSON.stringify(sj.horas_cuadrilla[1]["2026-10"]));
  for (const c of pj.disponibles) for (const [m, d] of Object.entries(c.por_mes)) assert.ok((sj.horas_cuadrilla[c.equipo]?.[m]?.horas || 0) <= d + 0.5, `C${c.equipo} ${m}`);
  // Montemayor (C1, en obra) sigue en octubre: no se va detrás de Orad
  assert.ok(sj.prog.find((p) => p.obra_id === "jm").fin < "2026-10-19", sj.prog.find((p) => p.obra_id === "jm").fin);
  const oct = pj.disponibles.reduce((t, c) => t + c.por_mes["2026-10"], 0), octA = [1, 2].reduce((t, e) => t + (sj.horas_cuadrilla[e]["2026-10"]?.horas || 0), 0);
  console.log(`  Orad con la C1 desde el 19/10: termina ${oj.fin} (sin ella ${sinJ.fin}) · octubre ${Math.round(octA)} / ${oct} h`);
}
// (07/10/2026) «Beneficio según presupuestos»: la suma de todos los meses es la suma de los beneficios previstos de
// las obras planificadas, sin perder ni duplicar nada (con el reparto por capacidad y sin él)
{
  const obrasB = [...obras.map((o) => (o.obra_id === "rl" ? { ...o, mano_obra_previsto: 3800 } : o)),
    { obra_id: "OO-9", nombre: "Privada sin horas", fase: "09_OO", tipo: "OO", importe: 10000, importe_total: 10000, horas_previstas: 0, horas_registradas: 0, margen_objetivo: 0.4, sin_comision: true, mes_cobro: 1, inicio_fijo: "2026-12-01" }];
  for (const conCap of [true, false]) {
    const sb = S.simular({ obras: obrasB, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, capacidad: conCap ? pc.capacidad : null, enValor: ["jm", "orad"], desvioMO: 0.2 });
    const porMeses = Object.values(sb.beneficio_presupuesto).reduce((t, v) => t + v, 0);
    const porObras = sb.prog.reduce((t, p) => t + p.beneficio_presupuesto, 0);
    assert.ok(Math.abs(porMeses - porObras) < 1, `${conCap ? "con" : "sin"} capacidad: ${porMeses} / ${porObras}`);
    // el detalle por obra de cada mes suma la celda
    for (const [m, v] of Object.entries(sb.beneficio_presupuesto)) assert.ok(Math.abs(Object.values(sb.beneficio_presupuesto_obras[m] || {}).reduce((t, x) => t + x, 0) - v) < 0.5, m);
    // reglas: presupuesto (Laffón, con su mano de obra y el 20 % de comisión) y margen (sin horas, 40 %)
    const rl = sb.prog.find((p) => p.obra_id === "rl"), oo = sb.prog.find((p) => p.obra_id === "OO-9");
    assert.deepStrictEqual([rl.beneficio_presupuesto_regla, rl.beneficio_presupuesto], ["presupuesto", Math.round((9000 - 2000 - 3800) * 0.8 * 100) / 100]);
    assert.deepStrictEqual([oo.beneficio_presupuesto_regla, oo.beneficio_presupuesto], ["margen", 4000]);
  }
}
// noviembre: el hueco de la Cuadrilla 2 sigue (sin obra lista: solo Laffón, La Paz y Mijares); diciembre en adelante, sin meses vacíos
assert.ok(pc.huecos.cuadrillas.find((c) => c.equipo === 2).por_mes["2026-11"] > 100);
const meses = Object.keys(sim.produccion).filter((m) => m >= "2026-12" && m <= noListas.map((p) => p.fin).sort().pop().slice(0, 7));
for (const m of meses) assert.ok(sim.produccion[m] > 0, `${m} sin obra: ${JSON.stringify(sim.produccion)}`);
// y la caja con las mismas fechas: cobro y material de cada no lista desde su tramo de Mi panel
for (const p of noListas) {
  const mat = sim.movs.find((x) => x.fila === "sim_material" && x.concepto === `Material ${p.nombre}`);
  if (mat) assert.ok(mat.fecha >= p.inicio, `${p.nombre}: material el ${mat.fecha} antes de empezar (${p.inicio})`);
  if (p.cobro) assert.ok(p.cobro > p.fin);
}
// 4 · el margen de Montemayor y Orad (ya en el valor de hoy) no vuelve a sumar
assert.ok(sim.beneficio_nuevo["2026-10"] < sim.beneficio["2026-10"], JSON.stringify([sim.beneficio_nuevo["2026-10"], sim.beneficio["2026-10"]]));
// sin obras en el valor, igual que el beneficio
const sim0 = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras });
assert.deepStrictEqual(sim0.beneficio_nuevo, sim0.beneficio);

// 5 · decisiones de Alberto (06/10): las no listas no suman obra ni beneficio en sus meses provisionales; el desvío
//     real (Certificaciones) va al coste de mano de obra sin mover fechas; la mano de obra pendiente de las obras
//     del valor (D11) no se resta dos veces
{
  const conD = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, enValor: ["jm", "orad"], desvioMO: 0.2 });
  const sinD = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, enValor: ["jm", "orad"], desvioMO: 0 });
  // mismas fechas; más coste
  assert.deepStrictEqual(conD.prog.map((p) => [p.inicio, p.fin]), sinD.prog.map((p) => [p.inicio, p.fin]));
  assert.ok(conD.sobrecoste_mo["2026-11"] > 0 && conD.beneficio["2026-11"] < sinD.beneficio["2026-11"]);
  assert.strictEqual(conD.desvio_mo, 0.2);
  // (ajuste 06/10: las no listas suman desde que pueden estar listas) hay obra en diciembre
  assert.ok(conD.produccion["2026-12"] > 0);
  // D11 de Montemayor (1.500 € de mano de obra pendiente) vuelve al beneficio nuevo de sus meses
  const conMO = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: { ...cf.automatico.mandos, desvio: 45 }, planObras: pc.obras, enValor: ["jm", "orad"], desvioMO: 0.2, moEnValor: { jm: 1500 } });
  const dif = Object.keys(conMO.beneficio_nuevo).reduce((t, m) => t + conMO.beneficio_nuevo[m] - conD.beneficio_nuevo[m], 0);
  assert.ok(Math.abs(dif - 1500) < 1, String(dif));
}

console.log(`OK cuadrillas-huecos.test · ${pc.huecos.cuadrillas.map((c) => `C${c.equipo}: ${c.horas} h de hueco`).join(" · ")} · lo llenaría: ${pc.huecos.candidatas.map((c) => `${c.nombre} (${c.falta_txt})`).join(" · ")}`);
