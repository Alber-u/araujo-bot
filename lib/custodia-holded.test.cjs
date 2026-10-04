// Test de lib/custodia-holded.cjs. Uso: node lib/custodia-holded.test.cjs
const assert = require("assert");
const { indexarCustodias, custodiaDe, estadoCustodia } = require("./custodia-holded.cjs");
const idx = indexarCustodias([
  { cuenta: 56100005, comunidad: "Ciudad de Chiva 7", ccpp_id: "ccpp_ciudad_de_chiva_7_011c0e", cobrado: 7343.28, entregado_emasesa: 7343.28, en_custodia: 0 },
  { cuenta: 56100003, comunidad: "Doña Francisquita 20", ccpp_id: null, cobrado: 5000, entregado_emasesa: 5000, en_custodia: 0 },
  { cuenta: 56100006, comunidad: "Ciudad de Carcagente 2", ccpp_id: null, cobrado: 3000, entregado_emasesa: 3000, en_custodia: 0 },
  { cuenta: 56100009, comunidad: "Paz 29", ccpp_id: "ccpp_paz_29_479ef1", cobrado: 9000, entregado_emasesa: 0, en_custodia: 9000 },
  { cuenta: 56100099, comunidad: "Paz 2", ccpp_id: null, cobrado: 10, entregado_emasesa: 0, en_custodia: 10 },
]);
// por id
assert.strictEqual(custodiaDe(idx, { ccpp_id: "ccpp_ciudad_de_chiva_7_011c0e", comunidad: "CCPP Ciudad de Chiva 7" }).cuenta, 56100005);
// por nombre (sin id, con tilde y prefijos)
assert.strictEqual(custodiaDe(idx, { comunidad: "Doña Francisquita 20" }).cuenta, 56100003);
assert.strictEqual(custodiaDe(idx, { comunidad: "Carcagente 2" }).cuenta, 56100006);
assert.strictEqual(custodiaDe(idx, { comunidad: "La Paz 29" }).cuenta, 56100009);
// el número de portal tiene que ser el mismo (Paz 29 ≠ Paz 2)
assert.strictEqual(custodiaDe(idx, { comunidad: "Paz 2" }).cuenta, 56100099);
assert.strictEqual(custodiaDe(idx, { comunidad: "Tordo 18" }), null);
assert.deepStrictEqual(estadoCustodia(custodiaDe(idx, { comunidad: "Ciudad de Chiva 7" })),
  { cuenta: 56100005, comunidad_holded: "Ciudad de Chiva 7", cobrado: 7343.28, entregado: 7343.28, en_custodia: 0, estado: "entregado" });
assert.strictEqual(estadoCustodia(custodiaDe(idx, { comunidad: "La Paz 29" })).estado, "en_custodia");
console.log("OK custodia-holded.test");
