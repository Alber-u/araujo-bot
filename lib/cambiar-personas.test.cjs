// «Cambiar personas» en una obra ya en obra (05/10/2026): tramos «desde», cuadrillas juntas y lo
// pasado manda en los registros de tiempo. Uso: node lib/cambiar-personas.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");

const HOY = "2026-10-08";   // jueves
const sinFest = { lista: [], fuente: "config_dinero", errores: [] };
const quienes = [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, fase, importe, h, extra = {}) => ({ obra_id, nombre, fase, importe, horas_previstas: h, horas_registradas: 0, material_previsto: importe * 0.25, faltan_docs: 0, total_docs: 2, ...extra });
// planificacion_obras: Orad programada el 05/10 con la Cuadrilla 2; desde el 15/10, con los 5
const filasPlan = [
  { obra_id: "orad", fecha_inicio_fija: "2026-10-05", cuadrilla: 2, operarios: "Juan, Luis, Mario", nota: "programada", usuario: "JM", fecha: "2026-10-01T10:00:00Z" },
  { obra_id: "orad", desde: "2026-10-15", operarios: "Antonio, Pepe, Juan, Luis, Mario", nota: "juntamos las dos cuadrillas", usuario: "Alberto", fecha: "2026-10-08T09:00:00Z" },
];
const obras = O.aplicarPlanificacion([
  ob("jm", "Jorge de Montemayor 34", "09_TRAMITADA", 7058, 109, { empezada: "2026-10-02" }),
  { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true },
  ob("rl", "Rafael Laffón 7", "09_TRAMITADA", 8981, 160, { orden: 1, pasos: 0 }),
], filasPlan);
const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
// del 05 al 07/10 solo fueron 2 a Urbano Orad (estaban programados 3); Jorge sin horas
const registros = [];
for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) for (const p of ["Juan", "Luis"]) registros.push({ fecha: d, persona: p, obra: "URBANO ORAD 13-15", horas: 7.7 });

const tramosLeidos = O.planVigente(filasPlan).orad.tramos;
assert.deepStrictEqual(tramosLeidos.map((t) => [t.desde, t.operarios.length]), [["2026-10-15", 5]]);

const r = P.calendarioPlan({ cf, hoy: HOY, festivos: sinFest, nombresCuadrillas: quienes, registros });
const x = (id) => r.obras.find((o) => o.obra_id === id);
const orad = x("orad"), jm = x("jm"), rl = x("rl");
// lo pasado manda: 3 días × 2 personas × 7,7 h
assert.strictEqual(orad.horas_registradas, 46.2);
assert.strictEqual(orad.tramos_texto, "05–14/10: 3 pers. · desde 15/10: 5 pers.");
assert.strictEqual(orad.real_texto, "2 pers., 46,2 h del 05 al 07/10");
// fin: (640 − 46,2) h desde hoy: 3 pers. hasta el 14/10 y 5 desde el 15/10, a 7,7 h
const fin = P.finPorHoras("2026-10-08", 640 - 46.2, { n: 3 }, [{ desde: "2026-10-15", crew: { n: 5 } }]).ult;
assert.strictEqual(orad.fin, fin);
// cuadrillas juntas: la 1 también la lleva y no tiene otra obra mientras dure
assert.deepStrictEqual([orad.equipo, orad.equipos_extra, orad.junta_desde], [2, [1], { 1: "2026-10-15" }]);
assert.ok(rl.inicio > orad.fin || rl.fin < "2026-10-15", `Rafael Laffón no se monta encima: ${rl.inicio}–${rl.fin}`);
// Jorge sin horas: «0 h» y nada de ritmo; lo que queda se reparte desde hoy
assert.strictEqual(jm.horas_registradas, 0);
assert.ok(jm.fin >= "2026-10-08");
console.log(`OK cambiar-personas.test · Orad ${orad.inicio} → ${orad.fin} (equipos ${orad.equipo}+${orad.equipos_extra}) · Laffón ${rl.inicio}`);
// Jorge sigue en la Cuadrilla 1 el 15/10: aviso rojo
assert.ok(r.avisos.some((a) => a.nivel === "rojo" && /Urbano Orad 13-15: desde el 15\/10 lleva gente de la Cuadrilla 1, que sigue en Jorge de Montemayor 34/.test(a.texto)), JSON.stringify(r.avisos.map((a) => a.texto)));
console.log("OK cambiar-personas.test (aviso de cuadrillas que chocan)");
// Cash flow: la obra con tramos termina (y se cobra) desde el fin de Planificación
{
  const S = require("./simulador-caja.cjs");
  const fp = P.fechasPlan({ cf, hoy: HOY, festivos: sinFest, nombresCuadrillas: quienes, registros });
  assert.strictEqual(fp.orad.fin, orad.fin);
  assert.ok(fp.orad.con_tramos && !fp.jm.con_tramos);
  const sim = S.simular({ obras, historico: cf.simulador.historico, hoy: HOY, mandos: cf.automatico.mandos, fechasFin: { orad: fp.orad.fin } });
  const po = sim.prog.find((p) => p.obra_id === "orad");
  assert.strictEqual(po.fin, fp.orad.fin);
  console.log(`OK cambiar-personas.test (cash flow: Orad termina el ${po.fin} y se cobra el ${po.cobro})`);
}

// Con config_dinero «horas_dia» = 8: lo pasado, las horas fichadas tal cual (2 × 8 h = 16 h al día, 48 h
// en tres días); lo que queda, a 8 h por persona y día desde hoy
{
  const J = require("./jornada.cjs");
  const reg8 = registros.map((x) => ({ ...x, horas: 8 }));
  const r8 = P.calendarioPlan({ cf, hoy: HOY, festivos: sinFest, nombresCuadrillas: quienes, registros: reg8, jornada: J.leerJornada({ horas_dia: "8" }) });
  const o8 = r8.obras.find((o) => o.obra_id === "orad");
  assert.strictEqual(r8.horas_dia, 8);
  assert.strictEqual(o8.horas_registradas, 48);
  assert.strictEqual(o8.real_texto, "2 pers., 48 h del 05 al 07/10");
  assert.strictEqual(o8.tramos_texto, "05–14/10: 3 pers. · desde 15/10: 5 pers.");
  P.setJornada(J.leerJornada({ horas_dia: "8" }), HOY);
  assert.strictEqual(o8.fin, P.finPorHoras("2026-10-08", 640 - 48, { n: 3 }, [{ desde: "2026-10-15", crew: { n: 5 } }]).ult);
  console.log(`OK cambiar-personas.test (8 h/día: Orad termina el ${o8.fin})`);
}
