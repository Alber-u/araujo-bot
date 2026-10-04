// Test de lib/fase-plan.cjs. Uso: node lib/fase-plan.test.cjs
const assert = require("assert");
const { faseSegunPlan, yaEmpezada } = require("./fase-plan.cjs");
const plan = {
  obras: [{ obra_id: "jm", estado_plan: "en_obra", inicio: "2026-10-02", fin: "2026-10-14", operarios: ["Antonio", "Pepe"] },
          { obra_id: "rl", estado_plan: "planificada", inicio: "2026-10-13", fin: "2026-10-27", operarios: null, operarios_de: "cuadrilla" },
          { obra_id: "lp", estado_plan: "sugerencia", inicio: "2026-10-28", fin: "2026-11-13", operarios_de: "cuadrilla" }],
  terminadas: [{ obra_id: "md", nombre: "Mandarinas 2", fin: "2026-10-01" }],
};
const f = faseSegunPlan(plan);
// Mandarinas 2: la hoja de OT dice 13 y Planificación la da por terminada el 01/10 → 14
assert.deepStrictEqual(f("13_EN_EJECUCION", "md"), { fase: "14_FINALIZADA", de: "planificacion", texto: "Terminada el 01/10 según Planificación" });
assert.strictEqual(f("12_INICIO_OBRA", "jm").fase, "13_EN_EJECUCION");
assert.strictEqual(f("", "jm").texto, "En obra desde el 02/10 · Antonio y Pepe · fin previsto 14/10");
assert.strictEqual(f("09_TRAMITADA", "rl").fase, "12_PROGRAMADA");
assert.strictEqual(f("13_EN_EJECUCION", "lp").fase, "12_INICIO_OBRA");
assert.strictEqual(f("16_MONTAJE_CONTADORES", "md").fase, "16_MONTAJE_CONTADORES");   // de la 14 en adelante, la OT
assert.strictEqual(faseSegunPlan(null)("13_EN_EJECUCION", "md").fase, "13_EN_EJECUCION");
assert.deepStrictEqual(["11_PREPARADA", "12_PROGRAMADA", "13_EN_EJECUCION", "14_FINALIZADA"].map(yaEmpezada), [false, false, true, true]);
console.log("OK fase-plan.test");
