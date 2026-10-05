// «Una cuadrilla no puede cerrar una obra sola» (05/10/2026): Jorge de Montemayor 34 (36 de 109 h, la última
// el 02/10, OT en inicio de obra) no se da por terminada porque la Cuadrilla 1 entre en La Paz 29. Solo cierra
// la OT en Finalizada (o más) o marcarla a mano. Dos obras en marcha en la misma cuadrilla: aviso urgente y
// «Pausar obra»; la pausada sigue en la cola y vuelve después con las horas que le queden.
// Uso: node lib/pausar-obra.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const F = require("./fase-plan.cjs");
const J = require("./jornada.cjs");

const HOY = "2026-10-05";   // lunes
const sinFest = { lista: [], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
// la hoja de comunidades da a Montemayor «fecha de fin» el último día con horas (02/10): antes la cerraba
const base = [
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29", horas_registradas: 36, fecha_fin: "2026-10-02", horas_mes: 36 }),
  ob("lp", "La Paz 29", 120, { empezada: "2026-10-05" }),
  ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }),
];
const filas0 = [{ obra_id: "lp", fecha_inicio_fija: "2026-10-05", cuadrilla: 1, operarios: "Antonio, Pepe", nota: "entra hoy", usuario: "JM", fecha: "2026-10-04T18:00:00Z" }];
const cfDe = (obras) => ({ hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const cal = (filas) => P.calendarioPlan({ cf: cfDe(O.aplicarPlanificacion(base, filas)), hoy: HOY, festivos: sinFest, jornada, nombresCuadrillas: quienes });

// 1 · Montemayor no está terminada: sigue en obra en la Cuadrilla 1, con lo que le queda
const r = cal(filas0);
const por = (x, n) => x.obras.find((o) => o.nombre.startsWith(n));
assert.ok(!r.terminadas.some((t) => t.obra_id === "jm"), JSON.stringify(r.terminadas));
assert.deepStrictEqual([por(r, "Jorge").estado_plan, por(r, "Jorge").equipo, por(r, "Jorge").horas_quedan], ["en_obra", 1, 73]);
assert.ok(!r.avisos.some((a) => /Ya terminadas.*Montemayor/.test(a.texto)));
// OT y /jm no la ven «Terminada el 02/10»
const fase = F.faseSegunPlan(r);
assert.strictEqual(fase("12_INICIO_OBRA", "jm").fase, "13_EN_EJECUCION");
// 2 · aviso urgente con «Pausar obra»
const av = r.avisos.find((a) => a.accion?.tipo === "pausar");
assert.ok(av && av.nivel === "rojo", JSON.stringify(r.avisos));
assert.strictEqual(av.texto, "Cuadrilla 1 tiene dos obras en marcha: Jorge de Montemayor 34 y La Paz 29 · ¿pausar una?");
assert.deepStrictEqual(av.accion.obras.map((o) => o.obra_id).sort(), ["jm", "lp"]);

// 3 · pausar Montemayor: sigue en la cola, en la Cuadrilla 1, y vuelve cuando acaba La Paz 29 con sus 73 h
const pausa = { obra_id: "jm", estado: "pausada", cuadrilla: 1, nota: "primero La Paz", usuario: "Alberto", fecha: "2026-10-05T08:00:00Z" };
assert.deepStrictEqual(O.validarCambioPlan(pausa), []);
assert.ok(O.validarCambioPlan({ ...pausa, estado: "parada" }).length);
const r2 = cal([...filas0, pausa]);
const jm = por(r2, "Jorge"), lp = por(r2, "La Paz");
assert.ok(!r2.avisos.some((a) => a.accion?.tipo === "pausar"), JSON.stringify(r2.avisos));
assert.deepStrictEqual([jm.estado_plan, jm.equipo, jm.horas_plan, jm.pausada.desde], ["pausada", 1, 73, "2026-10-05"]);
// La Paz 29: 120 h ÷ (2 × 8 h) = 7,5 → último día 14/10; Montemayor vuelve el 14/10 (lo que sobra ese día) o el 15/10
assert.strictEqual(lp.fin, "2026-10-14");
assert.ok(jm.inicio > HOY && jm.inicio >= lp.fin, `${jm.inicio} vs ${lp.fin}`);
assert.ok(r2.obras.indexOf(jm) < r2.obras.indexOf(por(r2, "Rafael")), "la pausada vuelve antes que las sugerencias");
assert.ok(/^Pausada desde el 05\/10 · vuelve el /.test(F.faseSegunPlan(r2)("12_INICIO_OBRA", "jm").texto));
assert.strictEqual(F.faseSegunPlan(r2)("12_INICIO_OBRA", "jm").fase, "12_INICIO_OBRA");
// reanudar: vuelve a estar en obra (y vuelve el aviso)
const r3 = cal([...filas0, pausa, { obra_id: "jm", estado: "reanudar", nota: "seguimos", usuario: "Alberto", fecha: "2026-10-05T09:00:00Z" }]);
assert.strictEqual(por(r3, "Jorge").estado_plan, "en_obra");

// 4 · se cierra con la OT en Finalizada (fin_obra) o a mano («Dar por terminada»)
const r4 = P.calendarioPlan({ cf: cfDe(O.aplicarPlanificacion(base.map((o) => (o.obra_id === "jm" ? { ...o, fin_obra: "2026-10-02" } : o)), filas0)), hoy: HOY, festivos: sinFest, jornada, nombresCuadrillas: quienes });
assert.ok(!por(r4, "Jorge") && r4.terminadas.some((t) => t.obra_id === "jm"));
const r5 = cal([...filas0, { obra_id: "jm", estado: "terminada", nota: "acabada", usuario: "Alberto", fecha: "2026-10-05T10:00:00Z" }]);
assert.ok(!por(r5, "Jorge") && r5.terminadas.some((t) => t.obra_id === "jm"));
assert.ok(!r5.avisos.some((a) => a.accion?.tipo === "pausar"));

// 5 · todas sus horas hechas, OT sin Finalizada: no se cierra sola; pregunta «¿terminada?»
const r6 = P.calendarioPlan({ cf: cfDe(O.aplicarPlanificacion([...base, ob("g", "Gaviota 1", 100, { horas_registradas: 102, orden: 2 })], filas0)), hoy: HOY, festivos: sinFest, jornada, nombresCuadrillas: quienes });
assert.ok(por(r6, "Gaviota") && r6.avisos.some((a) => a.accion?.tipo === "terminar" && /^Gaviota 1: ¿terminada\? 102 de 100 h/.test(a.texto)));
console.log(`OK pausar-obra.test · Montemayor pausada vuelve el ${jm.inicio} (La Paz 29 acaba el ${lp.fin})`);

// 6 · 05/10/2026 en producción: La Paz 29 sin fecha ni horas (nadie la programó). Montemayor sigue en obra en la
// Cuadrilla 1 con sus 36 h y La Paz 29 es una sugerencia detrás de ella, no «En obra desde el 05/10»
{
  const sinProgramar = base.map((o) => (o.obra_id === "lp" ? { ...o, empezada: null, orden: 0, pasos: 0 } : o));
  const r7 = P.calendarioPlan({ cf: cfDe(O.aplicarPlanificacion(sinProgramar, [])), hoy: HOY, festivos: sinFest, jornada, nombresCuadrillas: quienes });
  const j7 = por(r7, "Jorge"), l7 = por(r7, "La Paz");
  assert.deepStrictEqual([j7.estado_plan, j7.equipo, j7.horas_registradas, j7.horas_plan], ["en_obra", 1, 36, 73]);
  // 73 h ÷ (2 × 8 h) = 4,6 jornadas desde hoy → último día 09/10
  assert.strictEqual(j7.fin, "2026-10-09");
  assert.strictEqual(l7.estado_plan, "sugerencia");
  if (l7.equipo === 1) assert.ok(l7.inicio > j7.fin, `${l7.inicio} vs ${j7.fin}`);
  // aunque a una sugerencia le toque empezar hoy (cuadrilla libre), no está en obra
  const r8 = P.calendarioPlan({ cf: cfDe(O.aplicarPlanificacion(sinProgramar.filter((o) => o.obra_id !== "jm"), [])), hoy: HOY, festivos: sinFest, jornada, nombresCuadrillas: quienes });
  assert.deepStrictEqual([por(r8, "La Paz").inicio, por(r8, "La Paz").estado_plan], [HOY, "sugerencia"]);
  assert.strictEqual(F.faseSegunPlan(r8)("11_PREPARADA", "lp").fase, "11_PREPARADA");
  console.log(`OK pausar-obra.test (05/10: Montemayor en obra hasta el ${j7.fin}; La Paz 29 sugerencia en la Cuadrilla ${l7.equipo} desde el ${l7.inicio})`);
}
