// 08/10/2026 · Órdenes intermedias en Registros de tiempo. La Cuadrilla 1 (Manuel, Cristhian) en Jorge de Montemayor 34
// ficha 16 h en «Jorge Montemayor 34 TUBERIAS» (OO-2026-150), 4 h en «LA OLIVA 102» (OO-2026-152) y 2 h en
// «FURGONETA ITV» (OO-2026-151, interna). Plan base de Montemayor guardado: fin 09/10.
//   · Las OO fichadas sin horas previstas no vuelven a la cola como bloque (antes, 79 h supuestas al final)
//   · Lo fichado en ellas se pinta en su día dentro de Montemayor y la alarga: en rojo «+N días por otras órdenes»
//   · Laffón y La Paz, detrás de Montemayor, sin los bloques
// Uso: node lib/ordenes-intermedias.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const S = require("./simulador-caja.cjs");
const J = require("./jornada.cjs");

const HOY = "2026-10-09";   // viernes
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
// como las saca orden-cartera.carteraOO: sin horas previstas (con importe: margen 40 %; sin importe: horas supuestas)
const oo = (obra_id, nombre, importe, reg) => ({ obra_id, nombre, fase: "09_OO", tipo: "OO", importe, importe_total: importe, horas_previstas: importe > 0 ? 0 : reg + 40,
  horas_tope_fijo: !(importe > 0), horas_supuestas: !(importe > 0), sin_horas_previstas: true, horas_registradas: reg, margen_objetivo: importe > 0 ? 0.4 : null,
  oo_en_ejecucion: true, ultima_hora: "2026-10-08", mes_cobro: 1, sin_comision: true, alias: [nombre], empezada: "2026-10-07" });
const ordenes = [oo("OO-2026-150", "Jorge Montemayor 34 TUBERIAS", 3000, 16), oo("OO-2026-152", "LA OLIVA 102", 1500, 4), oo("OO-2026-151", "FURGONETA ITV", 0, 2)];
const obras0 = [
  ob("jm", "Jorge de Montemayor 34", 108.8, { empezada: "2026-09-29" }),
  ob("rl", "Rafael Laffón 7", 142, { orden: 1, pasos: 0 }), ob("lp", "La Paz 29", 120, { orden: 2, pasos: 0 }),
];
const filasPlan = [{ obra_id: "jm", estado: "plan_base", fecha_inicio_fija: "2026-09-29", desde: "2026-10-09", nota: "Plan base (automático)", usuario: "ARA-OS", fecha: "2026-10-07T08:00:00Z" }];
// registros con el id de la persona y su nombre (como getRegistrosTrabajo)
const NOM = { p2: "Manuel Espada Rebollo", p3: "Cristhian Arturo Arias Caicedo" };
const reg = (fecha, obra, h2, h3) => [["p2", h2], ["p3", h3]].filter(([, h]) => h > 0).map(([p, h]) => ({ fecha, persona: p, persona_nombre: NOM[p], obra, horas: h }));
const registros = [
  ...reg("2026-09-29", "Jorge de Montemayor 34", 10, 10), ...reg("2026-09-30", "Jorge de Montemayor 34", 5, 5),
  ...reg("2026-10-01", "Jorge de Montemayor 34", 7.5, 7.5), ...reg("2026-10-02", "Jorge de Montemayor 34", 7.5, 7.5),
  ...reg("2026-10-07", "Jorge Montemayor 34 TUBERIAS", 8, 8),
  ...reg("2026-10-08", "LA OLIVA 102", 4, 0), ...reg("2026-10-08", "FURGONETA ITV", 0, 2), ...reg("2026-10-08", "Jorge de Montemayor 34", 6, 6),
];
const cfDe = (obras) => ({ hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const args = (obras) => ({ cf: cfDe(obras), hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros });
const obras = O.aplicarPlanificacion([...obras0, ...ordenes], filasPlan);
const r = P.calendarioPlan(args(obras));
const por = (rr, n) => rr.obras.find((o) => o.nombre.startsWith(n));
const jm = por(r, "Jorge de");

// 1 · las OO fichadas sin horas previstas no se planifican como bloque futuro
assert.deepStrictEqual(r.obras.filter((o) => o.tipo === "OO").map((o) => o.nombre), []);
// 2 · Montemayor: 72 h fichadas; quedan 36,8 h desde hoy (09/10) con 2 × 8 h → 09, 13 (12 festivo) y 14/10
assert.deepStrictEqual([jm.horas_registradas, jm.fin, jm.plan_base.fin, jm.plan_base.guardado], [72, "2026-10-14", "2026-10-09", true]);
// lo fichado en otras órdenes, en su día (tramo fino), con quién y cuántas horas
assert.deepStrictEqual(jm.intercaladas.map((e) => [e.fecha, e.obra, e.horas, e.personas.length, e.interna]),
  [["2026-10-07", "Jorge Montemayor 34 TUBERIAS", 16, 2, false], ["2026-10-08", "Furgoneta ITV", 2, 1, true], ["2026-10-08", "La Oliva 102", 4, 1, false]]);
// 3 · retraso en rojo sobre el plan base: 13 y 14/10, «por otras órdenes» (22 h, ≈ 1,4 días)
assert.deepStrictEqual([jm.retraso.desde, jm.retraso.hasta, jm.retraso.dias, jm.retraso.horas_oo, jm.retraso.dias_oo], ["2026-10-13", "2026-10-14", 2, 22, 1.4]);
assert.deepStrictEqual(jm.retraso.por_orden.map((z) => [z.obra, z.horas]), [["Jorge Montemayor 34 TUBERIAS", 16], ["La Oliva 102", 4], ["Furgoneta ITV", 2]]);
const av = r.avisos.find((a) => a.tipo === "retraso_ordenes");
assert.ok(av && /^Jorge de Montemayor 34: \+2 días por otras órdenes \(22 h: .*Furgoneta ITV 2 h \(no productiva\)\); su plan base acababa el 09\/10 y ahora el 14\/10\.$/.test(av.texto), av && av.texto);
assert.strictEqual(jm.exceso, null);   // no pasa de sus horas: sin «sobre presupuesto»
// 4 · la cola se mueve con ese retraso, sin los bloques de 79 h: la siguiente de la Cuadrilla 1 empieza el 15/10 y
//     Laffón y La Paz, igual que si esas órdenes no existieran
const sig = r.obras.filter((o) => o.equipo === jm.equipo && o !== jm).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
assert.strictEqual(sig.inicio, "2026-10-15");
const sinOO = P.calendarioPlan(args(O.aplicarPlanificacion(obras0, filasPlan)));
for (const n of ["Rafael", "La Paz"]) assert.deepStrictEqual([por(r, n).equipo, por(r, n).inicio, por(r, n).fin], [por(sinOO, n).equipo, por(sinOO, n).inicio, por(sinOO, n).fin], n);
// sin plan base guardado: el de «sin otras órdenes» (36,8 − 22 = 14,8 h → hoy, 09/10), y se pide guardarlo
{
  const r2 = P.calendarioPlan(args([...obras0, ...ordenes]));
  const j2 = por(r2, "Jorge de");
  assert.deepStrictEqual([j2.plan_base.fin, j2.plan_base.guardado, j2.retraso.dias], ["2026-10-09", false, 2]);
  assert.deepStrictEqual(r2.planes_base_nuevos.find((b) => b.obra_id === "jm"), { obra_id: "jm", inicio: j2.inicio, fin: "2026-10-09" });
  assert.ok(!r.planes_base_nuevos.some((b) => b.obra_id === "jm"));   // ya guardado: no se repite
  // la fila «plan_base» no cambia la planificación (ni programa la obra ni borra lo puesto a mano)
  assert.deepStrictEqual(O.planVigente(filasPlan), {});
  assert.deepStrictEqual(O.basesPlan([...filasPlan, { ...filasPlan[0], desde: "2026-10-20", fecha: "2026-10-08T08:00:00Z" }]).jm.fin, "2026-10-09");   // la primera manda
}
// 5 · Mi panel: las horas en otras órdenes, en el mes en que se ficharon; esas órdenes no ocupan capacidad futura
{
  const pc = P.planParaCaja(args(obras));
  assert.deepStrictEqual(pc.horas_otras_ordenes[1]["2026-10"], { horas: 22, no_productivas: 2, ordenes: { "Jorge Montemayor 34 TUBERIAS": 16, "Furgoneta ITV": 2, "La Oliva 102": 4 } });
  assert.strictEqual(pc.obras.jm.fin, "2026-10-14");
  const sim = S.simular({ obras, historico: cfDe(obras).simulador.historico, hoy: HOY, mandos: cfDe(obras).automatico.mandos, planObras: pc.obras, capacidad: pc.capacidad });
  for (const id of ordenes.map((o) => o.obra_id)) assert.strictEqual(sim.prog.find((p) => p.obra_id === id).horas_base, 0, id);
  assert.ok(S.esIntermedia(ordenes[0]) && S.esInterna("FURGONETA ITV") && !S.esInterna("LA OLIVA 102"));
}
console.log(`OK ordenes-intermedias.test · ${av.texto}`);
