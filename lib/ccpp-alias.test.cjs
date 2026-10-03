// Uso: node lib/ccpp-alias.test.cjs
const assert = require("assert");
const A = require("./ccpp-alias.cjs");
const al = A.leerAlias("ccpp_paz_29_479ef1:ccpp_la_paz_29_c896f4; a:b ;b:c; mal; x:x");
assert.deepStrictEqual(al, { ccpp_paz_29_479ef1: "ccpp_la_paz_29_c896f4", a: "c", b: "c" });
assert.strictEqual(A.resolver("ccpp_paz_29_479ef1", al), "ccpp_la_paz_29_c896f4");
assert.strictEqual(A.resolver("otro", al), "otro");
const f = {
  custodias: { ok: true, data: { comunidades: [{ ccpp_id: "ccpp_paz_29_479ef1", comunidad: "Paz 29", en_custodia: 730.02 }, { ccpp_id: "z", comunidad: "Zeta", en_custodia: 50 }] } },
  tags: { ok: true, data: { ccpp_paz_29_479ef1: ["ot0099paz29"], ccpp_la_paz_29_c896f4: ["lapaz29"] } },
  ot: { ok: true, data: { grupos: { "12_INICIO_OBRA": [{ ccpp_id: "ccpp_paz_29_479ef1", comunidad: "Paz 29" }] } } },
};
A.aplicarAlias(f, al);
assert.deepStrictEqual([f.custodias.data.comunidades[0].ccpp_id, f.custodias.data.comunidades[0].ccpp_id_original], ["ccpp_la_paz_29_c896f4", "ccpp_paz_29_479ef1"]);
assert.deepStrictEqual(f.tags.data, { ccpp_la_paz_29_c896f4: ["lapaz29", "ot0099paz29"] });
assert.strictEqual(f.ot.data.grupos["12_INICIO_OBRA"][0].ccpp_id, "ccpp_la_paz_29_c896f4");
// custodias cuyo id no está en la cartera: aviso para descubrir duplicados
assert.deepStrictEqual(A.custodiasSinObra(f.custodias.data.comunidades, ["ccpp_la_paz_29_c896f4"]), [{ ccpp_id: "z", comunidad: "Zeta", en_custodia: 50 }]);
assert.deepStrictEqual(A.aplicarAlias({ x: 1 }, {}), { x: 1 });
console.log("OK ccpp-alias.test");
