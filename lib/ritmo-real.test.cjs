// 06/10/2026 · La cola con el ritmo real: una obra en obra deja libre su cuadrilla en el más tardío entre el
// fin previsto y el fin al ritmo de los últimos 5 días laborables. Montemayor (36 de 109 h, ~7,2 h/día con
// 2 personas) termina el 21/10, no el 13/10; Laffón, La Paz y Mijares van detrás, y el cash flow igual.
// Uso: node lib/ritmo-real.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const S = require("./simulador-caja.cjs");
const J = require("./jornada.cjs");

const HOY = "2026-10-06";   // martes
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
const base0 = [
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29" }),
  ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }), ob("lp", "La Paz 29", 120, { orden: 2, pasos: 0 }), ob("mj", "Mijares 3", 102, { orden: 3, pasos: 0 }),
];
// 36 h en los últimos 5 días laborables (29/09–05/10): 2 personas × 3,6 h
const registros = [];
for (const d of ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05"]) for (const p of ["Manuel", "Cristhian"]) registros.push({ fecha: d, persona: p, obra: "Jorge de Montemayor 34", horas: 3.6 });
const cfDe = (obras) => ({ hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const args = (obras, regs = registros) => ({ cf: cfDe(obras), hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros: regs });
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

// 1 · Montemayor: 73 h que quedan; previsto 73 ÷ 16 → 13/10; a 7,2 h/día → 21/10 (12/10 festivo)
const r = P.calendarioPlan(args(base0));
const jm = por(r, "Jorge");
assert.deepStrictEqual([jm.horas_registradas, jm.fin_previsto, jm.fin, jm.ritmo.h_dia, jm.ritmo.dias], [36, "2026-10-13", "2026-10-21", 7.2, 5]);
// las de la Cuadrilla 1 no empiezan antes del fin real de Montemayor
for (const o of r.obras.filter((x) => x.equipo === 1 && x !== jm)) assert.ok(o.inicio > jm.fin, `${o.nombre} empieza el ${o.inicio}`);
const av = r.avisos.find((a) => /va con retraso/.test(a.texto));
assert.ok(av && av.nivel === "ambar", JSON.stringify(r.avisos.map((a) => a.texto)));
assert.ok(/^Montemayor 34 va con retraso: termina el 21\/10 en vez del 13\/10 \(estimación sin visita: 7,2 h\/día los últimos 5 días laborables\); /.test(av.texto), av.texto);
// cada una con lo suyo: Laffón sigue en la Cuadrilla 1 y empieza 6 días laborables más tarde; La Paz pasa
// a la 2; Mijares, que sin el retraso ya iba en la 2, no sale (no iba detrás de Montemayor)
// (07/10/2026) La Paz ya va a la Cuadrilla 2, libre, con o sin el retraso: no la empuja Montemayor
assert.strictEqual(av.texto, "Montemayor 34 va con retraso: termina el 21/10 en vez del 13/10 (estimación sin visita: 7,2 h/día los últimos 5 días laborables); La Paz 29 se retrasa 6 días.");
// (06/10/2026, «ninguna cuadrilla vacía») Laffón, la primera de la cola, entra en la Cuadrilla 2, libre; La Paz va
// detrás de Montemayor en la 1 y es la que se retrasa
assert.strictEqual(por(r, "Rafael").equipo, 2);
assert.strictEqual(por(r, "La Paz").equipo, 1);
assert.deepStrictEqual(por(r, "La Paz").empuje, { cuadrilla: 1, dias: 6 });
console.log(`OK ritmo-real.test · ${av.texto}`);

// 2 · sin fichajes en los últimos 5 días: el fin previsto y aviso «sin fichajes»
{
  const r2 = P.calendarioPlan(args(base0.map((o) => (o.obra_id === "jm" ? { ...o, horas_registradas: 36 } : o)), []));
  const j2 = por(r2, "Jorge");
  assert.deepStrictEqual([j2.fin, j2.fin_previsto, j2.sin_fichajes], [j2.fin_previsto, "2026-10-13", true]);
  assert.ok(r2.avisos.some((a) => /^Jorge de Montemayor 34: sin fichajes en los últimos 5 días laborables; se usa el fin previsto \(13\/10\)/.test(a.texto)));
  assert.ok(!r2.avisos.some((a) => /va con retraso/.test(a.texto)));
}

// 3 · Urbano Orad (Cuadrilla 2) se lleva a la 1 desde el 13/10: Laffón no empieza antes del fin real de
// Montemayor ni del de Orad
{
  const orad = { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" };
  const obras = O.aplicarPlanificacion([...base0, orad], [{ obra_id: "orad", desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-06T09:00:00Z" }]);
  const r3 = P.calendarioPlan(args(obras));
  const j3 = por(r3, "Jorge"), u3 = por(r3, "Urbano"), l3 = por(r3, "Rafael");
  assert.strictEqual(j3.fin, "2026-10-21");
  assert.ok(l3.inicio > j3.fin && l3.inicio > u3.fin, `Laffón ${l3.inicio} · Montemayor ${j3.fin} · Orad ${u3.fin}`);
  // el cash flow se mueve igual: Montemayor y las de detrás llevan la fecha de Planificación
  const fp = P.fechasPlan(args(obras));
  assert.ok(fp.jm.movida && fp.rl.movida, JSON.stringify(fp));
  assert.deepStrictEqual([fp.jm.fin, fp.rl.fin, fp.rl.inicio], [j3.fin, l3.fin, l3.inicio]);
  const fechasFin = Object.fromEntries(Object.entries(fp).filter(([, v]) => v.con_tramos || v.movida).map(([k, v]) => [k, v.fin]));
  const sim = S.simular({ obras, historico: cfDe(obras).simulador.historico, hoy: HOY, mandos: cfDe(obras).automatico.mandos, fechasFin });
  for (const id of ["jm", "rl"]) assert.strictEqual(sim.prog.find((p) => p.obra_id === id).fin, fp[id].fin, id);
  console.log(`OK ritmo-real.test (con Orad: Montemayor ${j3.fin}, Orad ${u3.fin}, Laffón desde el ${l3.inicio}; cash flow igual)`);
}

// 4 · «Se termina después» de Orad: Montemayor sigue en la Cuadrilla 1 hasta el 12/10 (víspera del tramo) y
// lo que le queda ese día vuelve cuando Orad suelta a su gente, antes que las sugerencias
{
  const orad = { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" };
  const filas = [{ obra_id: "orad", desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-06T09:00:00Z" },
    { obra_id: "jm", estado: "pausada", cuadrilla: 1, desde: "2026-10-13", nota: "Se termina después de Urbano Orad 13-15", usuario: "Alberto", fecha: "2026-10-06T09:01:00Z" }];
  assert.deepStrictEqual(O.validarCambioPlan(filas[1]), []);
  const obras = O.aplicarPlanificacion([...base0, orad], filas);
  const r4 = P.calendarioPlan(args(obras));
  const j4 = por(r4, "Jorge"), u4 = por(r4, "Urbano"), l4 = por(r4, "Rafael");
  // hoy 06/10 sigue en obra (no se quita hoy); del 06 al 09/10 hace 4 × 7,2 h = 28,8 h; quedan 44,2 h
  assert.deepStrictEqual([j4.estado_plan, j4.equipo, j4.pausa.desde, j4.pausa.horas], ["en_obra", 1, "2026-10-13", 44.2]);
  assert.ok(j4.pausa.vuelve > u4.fin, `vuelve ${j4.pausa.vuelve} · Orad ${u4.fin}`);
  // (07/10/2026) Laffón no se monta con Montemayor: si la Cuadrilla 2 queda libre antes, la usa
  assert.ok(l4.equipo !== j4.equipo || l4.inicio > j4.fin, `Laffón ${l4.equipo} ${l4.inicio} · Montemayor ${j4.fin}`);
  // sin choque: la Cuadrilla 1 ya no sigue en Montemayor cuando Orad se la lleva
  assert.ok(!r4.avisos.some((a) => /lleva gente de la Cuadrilla 1, que sigue en Jorge de Montemayor/.test(a.texto)), JSON.stringify(r4.avisos.map((a) => a.texto)));
  // llegado el 13/10, pausada normal: vuelve después de Orad
  const r5 = P.calendarioPlan({ ...args(obras), cf: { ...cfDe(obras), hoy: "2026-10-13" }, hoy: "2026-10-13" });
  assert.ok(por(r5, "Jorge").estado_plan === "pausada" && por(r5, "Jorge").inicio > por(r5, "Urbano").fin, JSON.stringify([por(r5, "Jorge").estado_plan, por(r5, "Jorge").inicio, por(r5, "Urbano").fin]));
  console.log(`OK ritmo-real.test (pausa desde el 13/10: Montemayor hasta el 12/10, vuelve el ${j4.pausa.vuelve} con ${j4.pausa.horas} h; Orad ${u4.fin}; Laffón ${l4.inicio})`);
}
