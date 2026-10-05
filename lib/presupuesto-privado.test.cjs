// Test de presupuestos de obra privada (bloque 3). Uso: node lib/presupuesto-privado.test.cjs
const assert = require("assert");
const P = require("./presupuesto-privado.cjs");

// Un presupuesto nuevo sin horas no se puede enviar ni pasar a OT
const vacio = { subtotal_eur: 35300 };
assert.deepStrictEqual(P.validarEnvio(vacio).faltan, ["horas_previstas", "personas", "material_previsto_eur"]);
assert.strictEqual(P.validarEnvio({ subtotal_eur: 1000, personas: 3 }).error, "Faltan horas previstas y material previsto: sin eso no se puede enviar");
assert.ok(!P.validarPasoOT(vacio).ok && /no se puede pasar a OT/.test(P.validarPasoOT(vacio).error));
// 35.300 € con 9.500 € de material y 695 h a 16,8 €/h → margen ≈ 40 % y 29 días con 3 personas
const orad = { subtotal_eur: 35300, material_previsto_eur: 9500, horas_previstas: 695, personas: 3, coste_hora_eur: 16.8 };
const c = P.calcularPrevision(orad);
assert.deepStrictEqual([c.beneficio_pct, c.dias_estimados], [40, 29]);
assert.ok(P.validarEnvio(orad).ok && P.validarPasoOT(orad).ok);
// coste/hora por defecto el de config_dinero
assert.strictEqual(P.calcularPrevision({ ...orad, coste_hora_eur: "" }, { coste_hora_eur: 20 }).coste_hora, 20);
assert.strictEqual(P.calcularPrevision({ ...orad, coste_hora_eur: "" }).coste_hora, 16.8);
// Uno con margen del 20 % no pasa a OT salvo «Aceptar igualmente» del CEO
const bajo = { subtotal_eur: 10000, material_previsto_eur: 4000, horas_previstas: 238, personas: 2, coste_hora_eur: 16.8 };
assert.strictEqual(P.calcularPrevision(bajo).beneficio_pct, 20);
const v = P.validarPasoOT(bajo);
assert.ok(!v.ok && v.bajo_minimo && v.error === "Margen 20 %: por debajo del mínimo (30 %). Solo Alberto puede aceptarlo", v.error);
assert.ok(P.validarPasoOT(bajo, {}, { usuario: "Alberto" }).forzado);
assert.ok(!P.validarPasoOT(bajo, { margen_minimo_privadas: 15 }).bajo_minimo);   // mínimo de config_dinero
// personas solo 2 o 3
assert.ok(P.faltan({ ...orad, personas: 5 }).includes("personas"));
console.log("OK presupuesto-privado.test");

// Urbano Orad 13 y 15 (05/10/2026): mismos datos → mismo margen, aunque un presupuesto lleve su
// propio coste por hora guardado (manda config_dinero); y la cuenta, a la vista
{
  const cfg = { coste_hora_eur: 16.8 };
  const base = { subtotal_eur: "17650", horas_previstas: "320", material_previsto_eur: "2500", personas: "3" };
  const a = P.calcularPrevision(base, cfg), b = P.calcularPrevision({ ...base, coste_hora_eur: "30" }, cfg);
  require("assert").strictEqual(a.beneficio_pct, 55.4);
  require("assert").strictEqual(b.beneficio_pct, a.beneficio_pct);
  require("assert").strictEqual(a.formula, "17.650 € − (16,8 €/h × 320 h + 2.500 € de material) = 9.774 € de beneficio (55,4 %)");
}
console.log("OK presupuesto-privado (mismo coste por hora para todos)");
