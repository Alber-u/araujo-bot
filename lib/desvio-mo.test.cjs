// Uso: node lib/desvio-mo.test.cjs
const assert = require("assert");
const { desvioCertificaciones: D } = require("./desvio-mo.cjs");
// terminadas: 100 h previstas → 115 al cierre; 200 → 260: (375 ÷ 300 − 1) = +25 %
const t = D([{ obra_id: "a", previsto_horas: 100, avance_pct: 100, horas_fichadas_visita: 115 }, { obra_id: "b", previsto_horas: 200, avance_pct: 100, horas_cierre: 260 },
  { obra_id: "c", previsto_horas: 100, avance_pct: 50, horas_fichadas_visita: 80 }]);
assert.deepStrictEqual([t.pct, t.obras.map((x) => x.obra_id), t.fiabilidad], [25, ["a", "b"], "estimado"]);
assert.ok(/2 obras terminadas/.test(t.fuente));
// sin terminadas: las en curso con visita (80 h al 50 % → 160 al cierre de 100: +60 %)
const e = D([{ obra_id: "c", previsto_horas: 100, avance_pct: 50, horas_fichadas_visita: 80 }]);
assert.deepStrictEqual([e.pct, e.fiabilidad], [60, "estimado"]);
assert.strictEqual(D([{ obra_id: "d", previsto_horas: 100, avance_pct: 0 }]), null);
console.log(`OK desvio-mo.test · ${t.pct} % (${t.fuente})`);
