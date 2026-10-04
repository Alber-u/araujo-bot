// Caché por fuente (bucle de 1.431 peticiones a Holded del 04/10/2026):
// nunca dos lecturas iguales a la vez y un timeout propio no relanza la lectura.
const assert = require("assert");
delete process.env.GOOGLE_SHEETS_ID;
const D = require("../ara-os-dinero-empresa.cjs");
const { cacheFuente, lecturasEnVuelo } = D._prueba;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1) cinco cargas a la vez → UNA lectura
  let n = 0;
  const lenta = async () => { n++; await dormir(120); return { ok: true, data: n }; };
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => cacheFuente("clientes_t", { ttl: 60e3, espera: 1000 }, lenta)));
  assert.strictEqual(n, 1);
  assert.ok(rs.every((r) => r.ok && r.data === 1));
  // dentro del TTL: sin llamar
  await cacheFuente("clientes_t", { ttl: 60e3, espera: 1000 }, lenta);
  assert.strictEqual(n, 1);

  // 2) la lectura tarda más que la espera: «pendiente», pero sigue por detrás y no se repite
  let m = 0;
  const muyLenta = async () => { m++; await dormir(200); return { ok: true, data: "bueno" }; };
  const a = await cacheFuente("pnr_t", { ttl: 60e3, espera: 30 }, muyLenta);
  assert.deepStrictEqual([a.ok, a.pendiente], [false, true]);
  assert.strictEqual(lecturasEnVuelo().length, 1);
  const b = await cacheFuente("pnr_t", { ttl: 60e3, espera: 30 }, muyLenta);   // reintento: espera a la MISMA lectura
  assert.strictEqual(m, 1);
  assert.strictEqual(b.pendiente, true);
  await Promise.allSettled(lecturasEnVuelo());
  const c = await cacheFuente("pnr_t", { ttl: 60e3, espera: 30 }, muyLenta);
  assert.deepStrictEqual([c.ok, c.data, m], [true, "bueno", 1]);

  // 3) caducada y la nueva no llega a tiempo: el último dato bueno, marcado viejo
  const d = await cacheFuente("pnr_t", { ttl: 0, espera: 30 }, muyLenta);
  assert.deepStrictEqual([d.ok, d.data, d.viejo_min != null], [true, "bueno", true]);
  await Promise.allSettled(lecturasEnVuelo());

  // 4) error de Holded: se devuelve el error (y no se guarda como dato bueno)
  const e = await cacheFuente("tes_t", { ttl: 60e3, espera: 1000 }, async () => ({ ok: false, error: "Holded 429" }));
  assert.deepStrictEqual([e.ok, e.error, !!e.pendiente], [false, "Holded 429", false]);

  console.log("OK cache-fuente.test");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
