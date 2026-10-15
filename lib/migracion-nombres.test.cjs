// 15/10/2026 · Migración «nombres sueltos»: registros con un texto que no es ninguna orden, a la obra que dijo
// Alberto (Plan 5 por el nombre de la comunidad; Otras órdenes por su id). Uso: node lib/migracion-nombres.test.cjs
const assert = require("assert");
const MIG = require("../ara-os-migraciones.cjs");

const tabla = (head, filas) => ({ head, filas });
const obras = tabla(["obra_id", "nombre", "x2", "x3", "x4", "x5", "x6", "fase", "x8", "x9", "x10", "x11", "x12", "x13", "x14", "x15", "x16", "x17", "x18", "borrado"], [
  ["OO-2026-032", "TALLER FURGONETA", "", "", "", "", "", "EN_EJECUCION"],
  ["OO-2026-085", "Ciudad Jardín 85 bajantes", "", "", "", "", "", "FACTURADA"],
  ["OO-2026-099", "Marqués de Nervión 99", "", "", "", "", "", "COBRADA"],
  ["OO-2026-028", "Ramon y Cajal 28", "", "", "", "", "", "FACTURADA"],
]);
const plan5 = ["Doctor Fedriani 39", "Betis 20 (G)", "Villanueva 3", "La Oliva 67", "La Oliva 102", "La Oliva 10", "Parque Miraflores 5", "Parque Miraflores 5"];
const RH = ["registro_id", "fecha", "persona_id", "tipo", "obra_id", "horas", "motivo", "nota", "source", "created_at", "created_by", "updated_at", "updated_by", "borrado", "coste_hora"];
const reg = (n, obra, h, borrado = "FALSE") => [`RT-${n}`, "2026-05-10", "P1", "trabajo", obra, String(h), "", "", "manual", "", "", "", "", borrado, "30"];
const registros = tabla(RH, [
  reg(1, "DOCTOR FEDRIANI 39", 8), reg(2, "PLAN CINCO CCPP BETIS 20 (G)", 6), reg(3, "villanueva 3", 4), reg(4, "la oliva 67 cambio de tomas", 3),
  reg(5, "la oliva 102", 2), reg(6, "LA OLIVA 102", 2), reg(7, "Ciudad Jardin", 5), reg(8, "marques de nervion 99", 7), reg(9, "Parque miraflores", 1),
  reg(10, "RAMON Y CAJAL 28", 9), reg(11, "FURGONETA TALLER", 3), reg(12, "FURGONETA ITV", 2), reg(13, "lavin 6", 16), reg(14, "Doña francisquita 9", 2),
  reg(15, "FURGONETA ITV", 4, "TRUE"),   // borrado: no se toca
]);
const p = MIG.planificarNombres({ obras, registros }, plan5, { ahora: "2026-10-15T20:00:00.000Z", usuario: "test" });
const a = Object.fromEntries(p.reescritos.map((r) => [r.registro_id, r.despues]));
assert.deepStrictEqual(a, {
  "RT-1": "Doctor Fedriani 39", "RT-2": "Betis 20 (G)", "RT-3": "Villanueva 3", "RT-4": "La Oliva 67", "RT-5": "La Oliva 102", "RT-6": "La Oliva 102",
  "RT-7": "OO-2026-085", "RT-8": "OO-2026-099", "RT-9": "Parque Miraflores 5", "RT-10": "OO-2026-028", "RT-11": "OO-2026-032", "RT-12": "OO-2026-032",
});
assert.deepStrictEqual(p.avisos, []);
assert.ok(!p.reescritos.some((r) => ["RT-13", "RT-14", "RT-15"].includes(r.registro_id)));   // lavin 6, Doña francisquita 9 y el borrado, igual
assert.deepStrictEqual(p.cambios.find((c) => c.fila === 2).campos, { obra_id: ["DOCTOR FEDRIANI 39", "Doctor Fedriani 39"], updated_at: ["", "2026-10-15T20:00:00.000Z"], updated_by: ["", "test (nombres-sueltos-15-10-2026)"] });

// ambigüedad o falta de destino: avisa y no toca esos registros
const p2 = MIG.planificarNombres({ obras, registros }, [...plan5, "Doctor Fedriani 39 bis", "Villanueva 3"].filter((x) => x !== "Ramon y Cajal 28"),
  { mapa: [{ fuentes: ["DOCTOR FEDRIANI 39"], obra: "Doctor Fedriani 39" }, { fuentes: ["la oliva 67 cambio de tomas"], obra: "La Oliva 6" }, { fuentes: ["FURGONETA ITV"], oo: "OO-2026-099", debe_contener: "furgoneta" }] });
assert.deepStrictEqual(p2.reescritos.map((r) => r.registro_id), ["RT-1"]);   // igual exacto gana a «contiene»
assert.strictEqual(p2.avisos.length, 2);

// repetirla después de aplicar: nada que cambiar
const aplicado = tabla(RH, registros.filas.map((f) => { const r = p.reescritos.find((x) => x.registro_id === f[0]); return r ? Object.assign([...f], { 4: r.despues }) : f; }));
assert.strictEqual(MIG.planificarNombres({ obras, registros: aplicado }, plan5).cambios.length, 0);
console.log(`OK migracion-nombres.test · ${p.reescritos.length} registros (${p.reescritos.reduce((t, r) => t + r.horas, 0)} h) a 10 destinos · lavin 6 y Doña francisquita 9 sin tocar`);
