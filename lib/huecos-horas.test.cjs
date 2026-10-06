// 06/10/2026 · días con horas que faltan sin motivo. Uso: node lib/huecos-horas.test.cjs
const assert = require("assert");
const { huecosHoras } = require("./huecos-horas.cjs");
const personas = [
  { id: "p2", nombre: "Manuel Espada Rebollo", rol: "operario" }, { id: "p3", nombre: "Cristhian Arias", rol: "operario" },
  { id: "p4", nombre: "Antonio Ramírez", rol: "operario" }, { id: "p5", nombre: "Miguel Espada R.", rol: "operario" }, { id: "p6", nombre: "Miguel Espada P.", rol: "operario" },
  { id: "p9", nombre: "Guillermo", rol: "oficina" }, { id: "p7", nombre: "Baja", rol: "operario", fecha_baja: "2026-09-01" },
];
// viernes 02/10: p2 4 h, los demás 8 h (36 h); jueves 01/10 todos 8 h
const regs = [];
for (const p of ["p2", "p3", "p4", "p5", "p6"]) regs.push({ fecha: "2026-10-01", persona_id: p, tipo: "trabajo", horas: 8 });
for (const p of ["p3", "p4", "p5", "p6"]) regs.push({ fecha: "2026-10-02", persona_id: p, tipo: "trabajo", horas: 8 });
regs.push({ fecha: "2026-10-02", persona_id: "p2", tipo: "trabajo", horas: 4 });
const h = huecosHoras({ personas, registros: regs, desde: "2026-09-28", hasta: "2026-10-04", hoy: "2026-10-06", horasDia: 8, festivos: [] });
const del2 = h.filter((x) => x.fecha === "2026-10-02");
assert.deepStrictEqual(del2.map((x) => [x.persona_id, x.registradas, x.faltan]), [["p2", 4, 4]]);
assert.ok(!h.some((x) => x.fecha === "2026-10-01" || x.fecha === "2026-10-03" || x.fecha === "2026-10-04"));   // completo y fin de semana
assert.ok(!h.some((x) => x.persona_id === "p9" || x.persona_id === "p7"));   // oficina y de baja, no
// lunes 28 sin ningún registro: los 5 operarios, 8 h cada uno
assert.strictEqual(h.filter((x) => x.fecha === "2026-09-28").length, 5);
// explicado con un motivo en su registro o con una ausencia (4 h de médico): ya no sale
const conMotivo = regs.map((r) => (r.persona_id === "p2" && r.fecha === "2026-10-02" ? { ...r, motivo: "médico por la tarde" } : r));
assert.ok(!huecosHoras({ personas, registros: conMotivo, desde: "2026-10-02", hasta: "2026-10-02", hoy: "2026-10-06" }).length);
const conAusencia = [...regs, { fecha: "2026-10-02", persona_id: "p2", tipo: "falta_justificada", horas: 4, motivo: "médico" }];
assert.ok(!huecosHoras({ personas, registros: conAusencia, desde: "2026-10-02", hasta: "2026-10-02", hoy: "2026-10-06" }).length);
// hoy no cuenta (el día no ha terminado); festivos y vacaciones tampoco
assert.ok(!huecosHoras({ personas, registros: [], desde: "2026-10-06", hasta: "2026-10-06", hoy: "2026-10-06" }).length);
assert.ok(!huecosHoras({ personas, registros: [], desde: "2026-10-12", hasta: "2026-10-12", hoy: "2026-10-20", festivos: ["2026-10-12"] }).length);
assert.ok(!huecosHoras({ personas, registros: [], desde: "2026-08-03", hasta: "2026-08-03", hoy: "2026-10-20", vacaciones: () => true }).length);
console.log("OK huecos-horas.test · viernes 02/10: Manuel 4 h de 8 sin motivo → aviso; con motivo o ausencia, no");
