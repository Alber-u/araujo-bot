// Uso: node lib/presupuesto-provisional.test.cjs
const assert = require("assert");
const P = require("./presupuesto-provisional.cjs");
const m = P.leerProvisionales("ccpp_virgen_de_la_antigua_26_918ae2:34011.85; otra:1000:O25-ARA-1 Rev-2 ;mal:abc; vacia:0");
assert.deepStrictEqual(m, { ccpp_virgen_de_la_antigua_26_918ae2: { importe: 34011.85, ref: null }, otra: { importe: 1000, ref: "O25-ARA-1 Rev-2" } });
assert.deepStrictEqual(P.importeConProvisional("ccpp_virgen_de_la_antigua_26_918ae2", 0, m), { importe: 34011.85, provisional: true, ref: null, sobra: false });
assert.deepStrictEqual(P.importeConProvisional("ccpp_virgen_de_la_antigua_26_918ae2", "", m), { importe: 34011.85, provisional: true, ref: null, sobra: false });
// el panel trae importe: manda el panel y sobra la línea
assert.deepStrictEqual(P.importeConProvisional("otra", 1200, m), { importe: 1200, provisional: false, ref: null, sobra: true });
assert.deepStrictEqual(P.importeConProvisional("x", 500, m), { importe: 500, provisional: false, ref: null, sobra: false });
assert.deepStrictEqual(P.leerProvisionales(""), {});
console.log("OK presupuesto-provisional.test");
