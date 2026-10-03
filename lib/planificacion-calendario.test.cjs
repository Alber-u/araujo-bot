// Test de la planificación por cuadrillas (bloque 2). Uso: node lib/planificacion-calendario.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");

const HOY = "2026-10-03";
const ob = (obra_id, nombre, fase, importe, h, extra = {}) => ({ obra_id, nombre, fase, importe, horas_previstas: h, horas_registradas: 0, material_previsto: importe * 0.25, ...extra });
const obras = [
  ob("jm", "Jorge de Montemayor 34", "09_TRAMITADA", 7058, 109, { empezada: "2026-10-02" }),
  { obra_id: "OO-142+OO-143", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 17650, importe_total: 35300, horas_previstas: 0, horas_registradas: 0, mes_cobro: 1, sin_comision: true, margen_objetivo: 0.4, inicio_fijo: "2026-10-05" },
  ob("rl", "Rafael Laffón 7", "09_TRAMITADA", 8981, 142, { orden: 1 }),
  ob("lp", "La Paz 29", "09_TRAMITADA", 14515, 192, { orden: 2 }),
  ob("mv", "Malvaloca 1", "05_DOCUMENTACION", 36126, 528, { orden: 3, pasos: 4 }),
];
const cf = {
  hoy: HOY, inicial: { propio: -20000, custodia_y_senales: 60000 },
  semanas: [{ n: 1, desde: "2026-09-28", hasta: "2026-10-04", movs: [] }, { n: 2, desde: "2026-10-05", hasta: "2026-12-27", movs: [] }],
  meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 18, mat: 27, tram: 1, grande: 300 } },
};

assert.strictEqual(P.laborables("2026-10-05", "2026-10-11"), 5);
assert.deepStrictEqual(P.personasPorCuadrilla("Cuadrilla 1: Antonio, Pepe; Cuadrilla 2: Juan, Luis, Mario"), [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]]);
assert.deepStrictEqual(P.personasPorCuadrilla("Antonio, Pepe\nJuan"), [["Antonio", "Pepe"], ["Juan"]]);
assert.strictEqual(P.personasPorCuadrilla(""), null);

// JM: sin ningún importe
const jm = P.calendarioPlan({ cf, hoy: HOY });
const texto = JSON.stringify(jm);
for (const k of ["importe", "beneficio", "comision", "material", "dinero", "caja"]) assert.ok(!texto.includes(`"${k}`), `JM ve ${k}`);
const por = (r, n) => r.obras.find((x) => x.nombre.startsWith(n));
assert.deepStrictEqual([por(jm, "Jorge").equipo, por(jm, "Jorge").inicio, por(jm, "Jorge").estado], [1, "2026-10-02", "en_ejecucion"]);
assert.deepStrictEqual([por(jm, "Urbano").equipo, por(jm, "Urbano").inicio, por(jm, "Urbano").estado], [2, "2026-10-05", "agendada"]);
assert.ok(por(jm, "Urbano").horas_tope_margen > 600);                         // tope de horas para el 40 %
assert.strictEqual(por(jm, "La Paz").estado, "propuesta");
assert.deepStrictEqual(jm.cuadrillas.map((c) => [c.nombre, c.personas, c.grandes]), [["Cuadrilla 1", 2, false], ["Cuadrilla 2", 3, true]]);
// Real: sin las propuestas
const real = P.calendarioPlan({ cf, hoy: HOY, modo: "real" });
assert.deepStrictEqual(real.obras.map((x) => x.nombre).sort(), ["Jorge de Montemayor 34", "Urbano Orad 13-15"]);
// CEO: con importes, obra hecha y beneficio; un cambio sin guardar enseña su efecto en la caja
const ceo = P.calendarioPlan({ cf, hoy: HOY, ceo: true, borrador: { obra_id: "lp", posicion: 3 } });
assert.ok(por(ceo, "La Paz").importe_total > 0 && ceo.dinero.produccion["2026-10"] > 0 && ceo.caja && ceo.caja_antes);
assert.ok(por(ceo, "La Paz").puesto < por(ceo, "Rafael").puesto);              // La Paz 29 delante de Rafael Laffón 7
assert.strictEqual(por(ceo, "La Paz").manual, true);
// fecha antes de estar tramitada: aviso
const antes = P.calendarioPlan({ cf, hoy: HOY, borrador: { obra_id: "mv", fecha_inicio_fija: "2026-10-20" } });
assert.ok(por(antes, "Malvaloca").antes_de_tramite && antes.avisos.antes_de_tramite.length === 1);
console.log(`OK planificacion-calendario.test · ${jm.obras.length} obras · La Paz ${por(ceo, "La Paz").inicio}`);
