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
  // Mar de Alborán 14: sin expediente
};
const sabadell = { pendientes: [{ ccpp_id: "to", viviendas: ["1ºA", "2ºA"], importe: 4000 }] };
const obras = O.aplicarPlanificacion([
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29", horas_registradas: 40 }),
  { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
  // las no listas, en trámite (como en producción: les faltan pasos con EMASESA)
  ob("ma", "Mar de Alborán 14", 420, { orden: 1, fase: "06_VISITA_EMASESA", pasos: 3 }), ob("lu", "Luceros 4", 380, { orden: 2, fase: "07_PTE_CYCP", pasos: 2 }),
  ob("rl", "Rafael Laffón 7", 142, { orden: 3 }), ob("lp", "La Paz 29", 192, { orden: 4 }), ob("mj", "Mijares 3", 102, { orden: 5 }),
  ob("pe", "Perdiz 5", 150, { orden: 6, fase: "07_PTE_CYCP", pasos: 2 }), ob("to", "Tordo 18", 140, { orden: 7, fase: "07_PTE_CYCP", pasos: 2 }), ob("mo", "Moncayo 6", 120, { orden: 8, fase: "07_PTE_CYCP", pasos: 2 }),
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
assert.deepStrictEqual(r.obras.filter((o) => o.sin_fecha).map((o) => o.nombre).sort(), ["Luceros 4", "Mar de Alborán 14", "Moncayo 6", "Perdiz 5", "Tordo 18"]);

// 2 · huecos: horas sin obra lista y qué las llenaría, primero las que menos les falta
const horasHueco = pc.huecos.cuadrillas.reduce((t, c) => t + c.horas, 0);
assert.ok(horasHueco > 0, JSON.stringify(pc.huecos));
assert.deepStrictEqual(pc.huecos.candidatas.map((c) => c.nombre), ["Moncayo 6", "Tordo 18", "Perdiz 5", "Luceros 4", "Mar de Alborán 14"]);
assert.ok(/Pendiente abono Sabadell: 2 pisos/.test(pc.huecos.candidatas[1].falta_txt), pc.huecos.candidatas[1].falta_txt);
assert.strictEqual(pc.huecos.candidatas[4].falta_txt, "expediente vacío");
// Planificación lo avisa
assert.ok(r.avisos.some((a) => /sin obra lista/.test(a.texto) && /Lo llenaría: Moncayo 6/.test(a.texto)), JSON.stringify(r.avisos.map((a) => a.texto)));

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
assert.deepStrictEqual(noListas.map((p) => p.obra_id).sort(), ["lu", "ma", "mo", "pe", "to"]);
for (const p of noListas) assert.ok(p.inicio >= p.lista_desde, `${p.nombre} empieza ${p.inicio} antes de poder estar lista (${p.lista_desde})`);
for (const e of [1, 2]) {
  const xs = sim.prog.filter((p) => p.equipo === e).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < xs.length; i++) if (xs[i].provisional) assert.ok(xs[i].inicio >= xs[i - 1].fin, `C${e}: ${xs[i].nombre} (${xs[i].inicio}) pisa ${xs[i - 1].nombre} (hasta ${xs[i - 1].fin})`);
}
// con cinco no listas que pueden estar listas a primeros de diciembre, ninguna cuadrilla se queda sin obra en diciembre
for (const e of [1, 2]) assert.ok(sim.prog.some((p) => p.equipo === e && p.inicio.slice(0, 7) <= "2026-12" && p.fin.slice(0, 7) >= "2026-12"), `C${e} sin obra en diciembre`);
// noviembre: solo Laffón, La Paz y Mijares (y las que ya estaban en obra); diciembre en adelante, sin meses vacíos
assert.strictEqual(sim.obra_provisional["2026-11"] || 0, 0);
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
