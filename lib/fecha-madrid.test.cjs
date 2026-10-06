// Uso: node lib/fecha-madrid.test.cjs
const assert = require("assert");
const { hoyMadrid, horaMadrid } = require("./fecha-madrid.cjs");
// 06/10 a las 00:30 de Madrid (verano, UTC+2) = 05/10 22:30 UTC: ya es martes 06/10
assert.strictEqual(hoyMadrid(new Date("2026-10-05T22:30:00Z")), "2026-10-06");
assert.strictEqual(hoyMadrid(new Date("2026-10-05T21:19:27Z")), "2026-10-05");   // 23:19 del lunes
assert.strictEqual(horaMadrid(new Date("2026-10-06T07:33:00Z")), "09:33");
// invierno (UTC+1): 01/12 a las 00:30 = 30/11 23:30 UTC
assert.strictEqual(hoyMadrid(new Date("2026-11-30T23:30:00Z")), "2026-12-01");
const { caduca } = require("./fecha-madrid.cjs");
// la carga del lunes 23:19 (Madrid), pedida el martes a las 09:33: otro día → renovar y esperar la nueva
const ts = Date.parse("2026-10-05T21:19:27Z"), ahora = Date.parse("2026-10-06T07:33:00Z");
assert.deepStrictEqual(caduca(ts, { ahora }), { otroDia: true, renovar: true });
// aunque solo hayan pasado 5 min: 23:58 → 00:03 de Madrid
assert.deepStrictEqual(caduca(Date.parse("2026-10-05T21:58:00Z"), { ahora: Date.parse("2026-10-05T22:03:00Z") }), { otroDia: true, renovar: true });
// mismo día: a los 10 min sigue; a los 13 min o tras un fichaje, se renueva (sin esperar)
assert.deepStrictEqual(caduca(ahora - 10 * 60e3, { ahora }), { otroDia: false, renovar: false });
assert.deepStrictEqual(caduca(ahora - 13 * 60e3, { ahora }), { otroDia: false, renovar: true });
assert.deepStrictEqual(caduca(ahora - 60e3, { ahora, sucio: true }), { otroDia: false, renovar: true });
console.log("OK fecha-madrid.test · 00:30 de Madrid ya es el día nuevo; 07:33 UTC = 09:33 · la carga de ayer caduca al cambiar de día y a los 12 min");
