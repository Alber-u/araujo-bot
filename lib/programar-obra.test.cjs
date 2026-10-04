// «Programar obra», estado de cada obra, «lista para empezar», festivos y cartera en jornadas (04/10/2026)
// Uso: node lib/programar-obra.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const S = require("./simulador-caja.cjs");
const F = require("./festivos.cjs");

const HOY = "2026-10-03";
const ob = (obra_id, nombre, fase, importe, h, extra = {}) => ({ obra_id, nombre, fase, importe, horas_previstas: h, horas_registradas: 0, material_previsto: importe * 0.25, faltan_docs: 0, total_docs: 2, ...extra });
const obras = [
  ob("jm", "Jorge de Montemayor 34", "09_TRAMITADA", 7058, 109, { empezada: "2026-10-02", horas_registradas: 10 }),
  ob("rl", "Rafael Laffón 7", "09_TRAMITADA", 8981, 160, { orden: 1, pasos: 0 }),
  ob("lp", "La Paz 29", "09_TRAMITADA", 14515, 192, { orden: 2, pasos: 0 }),
  ob("mv", "Malvaloca 1", "05_DOCUMENTACION", 36126, 528, { orden: 3, pasos: 4, faltan_docs: 3, total_docs: 7 }),
];
const cf = (extra = {}) => ({
  hoy: HOY, inicial: { propio: -20000, custodia_y_senales: 60000 },
  semanas: [{ n: 1, desde: "2026-09-28", hasta: "2026-10-04", movs: [] }], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 18, mat: 27, tram: 1, grande: 300 } },
  custodias_obras: [
    { ccpp_id: "rl", comunidad: "Rafael Laffón 7", en_custodia: 9000, cobrado: 9000, previsto: 9000, entregado_emasesa: 0, vecinos_censo: 12, vecinos_faltan: 0 },
    { ccpp_id: "lp", comunidad: "Paz 29", en_custodia: 730.02, cobrado: 730.02, previsto: 2920.08, entregado_emasesa: 0, vecinos_censo: 4, vecinos_faltan: 3 },
  ],
  ...extra,
});
const quienes = [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]];

// ── festivos ──
assert.deepStrictEqual(F.leerFestivos("2026-12-08; 2026-12-25;mal").lista, ["2026-12-08", "2026-12-25"]);
assert.deepStrictEqual(F.leerFestivos("2026-12-08; 2026-12-25;mal").errores, ["mal"]);
assert.strictEqual(F.leerFestivos("").fuente, "por_defecto");
assert.ok(F.POR_DEFECTO.includes("2026-10-12") && F.POR_DEFECTO.includes("2026-11-02") && F.POR_DEFECTO.includes("2026-12-08"));
P.setFestivos(["2026-10-12"]);
assert.strictEqual(P.laborables("2026-10-12", "2026-10-16"), 4);                 // el 12/10 no cuenta
assert.strictEqual(P.enesimoLaborable("2026-10-09", 2), "2026-10-13");          // vie 09 = 1, (12 festivo) mar 13 = 2
P.setFestivos([]);
assert.deepStrictEqual(P.mesesYDias("2026-10-04", "2027-07-14"), { meses: 9, dias: 10 });
assert.deepStrictEqual(P.mesesYDias("2026-01-31", "2026-03-01"), { meses: 1, dias: 1 });   // 28/02 + 1

// ── planificacion_obras: columna «operarios» ──
assert.deepStrictEqual(O.leerOperarios(" Antonio, Pepe ,"), ["Antonio", "Pepe"]);
const v = O.planVigente([{ obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, nota: "JM", usuario: "JM", fecha: "2026-10-04T10:00:00Z", operarios: "Antonio, Pepe, Juan" }]);
assert.deepStrictEqual(v.lp.operarios, ["Antonio", "Pepe", "Juan"]);
const ap = O.aplicarPlanificacion(obras, [{ obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, nota: "JM", usuario: "JM", fecha: "2026-10-04T10:00:00Z", operarios: "Antonio, Pepe, Juan" }]).find((o) => o.obra_id === "lp");
assert.deepStrictEqual([ap.personas_plan, ap.inicio_fijo, ap.operarios.length], [3, "2026-10-19", 3]);
assert.ok(O.validarCambioPlan({ obra_id: "lp", nota: "x", usuario: "JM", operarios: ["Antonio"] }).some((e) => /fecha de inicio/.test(e)));
assert.deepStrictEqual(O.validarCambioPlan({ obra_id: "lp", nota: "x", usuario: "JM", operarios: ["Antonio"], fecha_inicio_fija: "2026-10-19" }), []);
// sin operarios (cambio de orden de antes): no está «planificada»
assert.strictEqual(O.aplicarPlanificacion(obras, [{ obra_id: "lp", posicion: 1, nota: "x", usuario: "JM", fecha: "2026-10-04" }]).find((o) => o.obra_id === "lp").personas_plan, undefined);

// ── calendario: estado, operarios, indicadores ──
const r = P.calendarioPlan({ cf: cf(), hoy: HOY, nombresCuadrillas: quienes, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
const por = (id) => r.obras.find((x) => x.obra_id === id);
assert.strictEqual(por("jm").estado_plan, "en_obra");
assert.strictEqual(por("lp").estado_plan, "sugerencia");
assert.deepStrictEqual(r.resumen_plan, { planificadas: 0, sugerencias: 3, en_obra: 1 });
assert.strictEqual(por("lp").operarios_de, "cuadrilla");
assert.deepStrictEqual(por("lp").operarios, quienes[por("lp").equipo - 1]);
// Rafael Laffón: tramitada y vecinos al 100 % → lista para empezar
assert.deepStrictEqual([por("rl").documentacion.texto, por("rl").custodia_vecinos.texto, por("rl").lista_para_empezar], ["100 % tramitada", "100 % pagada", true]);
// La Paz 29: 25 % pagada, faltan 3 vecinos (2.190,06 € solo para el CEO)
assert.deepStrictEqual([por("lp").custodia_vecinos.pct, por("lp").custodia_vecinos.vecinos_faltan, por("lp").custodia_vecinos.pendiente_eur, por("lp").lista_para_empezar], [25, 3, 2190.06, false]);
assert.strictEqual(por("lp").custodia_vecinos.texto, "25 % pagada · faltan 3 vecinos");
// Malvaloca: faltan 3 de 7, fase 05; sin cuenta de custodia
assert.deepStrictEqual([por("mv").documentacion.texto, por("mv").documentacion.pct, por("mv").custodia_vecinos.sin_cuenta], ["faltan 3 de 7 · fase 05", 57, true]);
// el importe de los vecinos no sale en el texto (JM lo ve)
assert.ok(!JSON.stringify(r.obras.map((x) => x.custodia_vecinos.texto)).includes("€"));

// ── Programar obra: La Paz 29 con 3 operarios desde el 19/10 ──
const borrador = { obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, operarios: ["Antonio", "Pepe", "Juan"] };
const r2 = P.calendarioPlan({ cf: cf(), hoy: HOY, borrador, nombresCuadrillas: quienes, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
const lp = r2.obras.find((x) => x.obra_id === "lp");
// 192 h ÷ (3 × 7,7 h) = 8,3 jornadas → 9 días, del lunes 19/10 al jueves 29/10
assert.deepStrictEqual([lp.estado_plan, lp.personas, lp.jornadas, lp.dias_laborables, lp.inicio, lp.fin, lp.operarios_de], ["planificada", 3, 8.3, 9, "2026-10-19", "2026-10-29", "programada"]);
assert.deepStrictEqual(r2.resumen_plan, { planificadas: 1, sugerencias: 2, en_obra: 1 });
// con 2 personas: 192 ÷ 15,4 = 12,5 jornadas
const r3 = P.calendarioPlan({ cf: cf(), hoy: HOY, borrador: { ...borrador, operarios: ["Antonio", "Pepe"] }, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
assert.strictEqual(r3.obras.find((x) => x.obra_id === "lp").jornadas, 12.5);

// ── Cartera planificada: horas ÷ (5 × 8) en laborables desde el próximo, con festivos ──
const c = r.cartera;
assert.strictEqual(c.personas, 5);
assert.strictEqual(c.jornadas, Math.round(c.horas / (5 * 7.7)));
assert.strictEqual(c.desde, "2026-10-05");
assert.strictEqual(c.ultimo_dia, P.finPorHoras("2026-10-05", c.horas, { n: 5 }).ult);
const conFest = P.calendarioPlan({ cf: cf(), hoy: HOY, festivos: { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] } }).cartera;
assert.ok(conFest.ultimo_dia > c.ultimo_dia, "los festivos alargan la cartera");
// sin la clave «festivos»: aviso
assert.ok(P.calendarioPlan({ cf: cf(), hoy: HOY }).avisos.some((a) => /falta la clave «festivos»/.test(a.texto)));

// ── Obras con fecha fija (OT, OO) o con fila en planificacion_obras: «Planificada» ──
const conFecha = obras.map((o) => (o.obra_id === "rl" ? { ...o, inicio_fijo: "2026-10-26" } : o));
const sinFest = { lista: [], fuente: "config_dinero", errores: [] };
const rF = P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFecha } }), hoy: HOY, festivos: sinFest });
const rl = rF.obras.find((x) => x.obra_id === "rl");
assert.deepStrictEqual([rl.estado_plan, rl.programada.origen], ["planificada", "ot"]);
// el día que empieza, «En obra»
assert.strictEqual(P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFecha } }), hoy: "2026-10-26", festivos: sinFest }).obras.find((x) => x.obra_id === "rl").estado_plan, "en_obra");
const conFila = O.aplicarPlanificacion(obras, [{ obra_id: "mv", posicion: 2, nota: "antes", usuario: "JM", fecha: "2026-10-04T09:00:00Z" }]);
const mvF = P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFila } }), hoy: HOY, festivos: sinFest }).obras.find((x) => x.obra_id === "mv");
assert.deepStrictEqual([mvF.estado_plan, mvF.programada.usuario], ["planificada", "JM"]);

// ── Jornada del convenio y vacaciones ──
const Jl = require("./jornada.cjs");
const jj = Jl.leerJornada({ horas_dia: "7,7", vacaciones_dias: "21", vacaciones_personas: "Pepe: 2027-07-05 a 2027-07-23, 2027-12-27 a 2027-12-31; mal" });
assert.deepStrictEqual([jj.horas_dia, jj.vacaciones_dias, jj.personas.Pepe.length, jj.errores.length], [7.7, 21, 2, 1]);
P.setFestivos(["2027-08-16"]); P.setJornada(jj, "2026-10-04");
// en agosto de 2027 nadie trabaja por defecto (21 laborables desde el 01/08: 02/08 → 31/08, sin el 16/08):
// 29 y 30/07 + 1, 2, 3 y 6/09 = 6 días
assert.deepStrictEqual(P.finPorHoras("2027-07-29", 2 * 7.7 * 6, { n: 2 }), { ult: "2027-09-06", finExcl: "2027-09-07", dias: 6, vac: 21 });
// Pepe trabaja en agosto (sus vacaciones son en julio): la obra sigue con él solo
const conPepe = P.finPorHoras("2027-08-02", 7.7 * 2, { nombres: ["Pepe", "Juan"] });
assert.deepStrictEqual([conPepe.ult, conPepe.dias], ["2027-08-03", 2]);
P.setFestivos([]); P.setJornada(null, HOY);
// cash flow: horas por persona y mes del convenio
const hp = Jl.hppConvenio(Jl.leerJornada({}), HOY, (x) => { const d = new Date(x + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6; });
assert.strictEqual(hp.hpp, Math.round(7.7 * (hp.labs - 21) / 12 * 10) / 10);

// ── Cash flow: los cobros dicen si vienen de una obra planificada o de una sugerencia ──
const conPlan = S.aplicarCambioPlan(obras, borrador);
const sim = S.simular({ obras: conPlan, historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 } });
const pLp = sim.prog.find((p) => p.obra_id === "lp"), pRl = sim.prog.find((p) => p.obra_id === "rl");
assert.deepStrictEqual([pLp.plan_estado, pRl.plan_estado, sim.prog.find((p) => p.obra_id === "jm").plan_estado], ["planificada", "sugerencia", "en_obra"]);
assert.ok(sim.movs.some((m) => m.fila === "sim_cobros" && /La Paz 29 \(fase 09 · planificada\)/.test(m.concepto)));
assert.ok(sim.movs.some((m) => m.fila === "sim_cobros" && /Rafael Laffón 7 \(fase 09 · sugerencia\)/.test(m.concepto)));
// 3 personas en vez de la cuadrilla de 2: dura menos
const simSin = S.simular({ obras: S.aplicarCambioPlan(obras, { ...borrador, operarios: [] }), historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 } });
const dur = (p) => p.t1 - p.t0;
assert.ok(dur(pLp) < dur(simSin.prog.find((p) => p.obra_id === "lp")) || simSin.prog.find((p) => p.obra_id === "lp").cuadrilla === 3);

console.log(`OK programar-obra.test · cartera ${c.horas} h = ${c.jornadas} jornadas → ${c.ultimo_dia} (${c.meses} meses y ${c.dias} días)`);
