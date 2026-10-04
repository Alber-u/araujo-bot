// Uso: node lib/holded-fetch.test.cjs
const assert = require("assert");
const H = require("./holded-fetch.cjs");
(async () => {
  // 429 dos veces y luego 200: reintenta con espera (Retry-After 0 s para no tardar)
  let n = 0, enParalelo = 0, maxParalelo = 0;
  const falso = async (url) => {
    enParalelo++; maxParalelo = Math.max(maxParalelo, enParalelo);
    await new Promise((r) => setTimeout(r, 20));
    enParalelo--;
    if (/otro\.com/.test(url)) return { status: 200, headers: { get: () => null } };
    if (/reintenta/.test(url) && n++ < 2) return { status: 429, headers: { get: (h) => (h === "retry-after" ? "0" : null) } };
    return { status: 200, headers: { get: () => null } };
  };
  const f = H.envolver(falso);
  const r = await f("https://api.holded.com/reintenta");
  assert.strictEqual(r.status, 200);
  assert.ok(H.stats().reintentos >= 2 && H.stats().respuestas_429 >= 2);
  // como mucho 3 a la vez hacia Holded
  maxParalelo = 0;
  await Promise.all(Array.from({ length: 8 }, (_, i) => f(`https://api.holded.com/x${i}`)));
  assert.ok(maxParalelo <= 3, String(maxParalelo));
  // lo que no es Holded pasa sin cola
  assert.strictEqual((await f("https://otro.com/a")).status, 200);
  console.log(`OK holded-fetch.test · ${JSON.stringify({ peticiones: H.stats().peticiones, reintentos: H.stats().reintentos })}`);
})().catch((e) => { console.error(e); process.exit(1); });
