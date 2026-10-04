// Endpoints pesados: caché y una sola ejecución a la vez (lib/cache-respuesta.cjs)
const assert = require("assert");
const express = require("express");
const { cacheRespuesta, unaALaVez } = require("./cache-respuesta.cjs");

(async () => {
  let n = 0;
  const app = express();
  const mw = cacheRespuesta({ clave: (req) => String(req.query.mes), ttl: () => 60e3, autorizado: (req) => req.query.token === "t" });
  app.get("/pnr", mw, async (req, res) => {
    if (req.query.token !== "t") return res.status(401).json({ error: "Token inválido" });
    n++; await new Promise((r) => setTimeout(r, 150));
    if (req.query.mes === "mal") return res.status(500).json({ ok: false, error: "Holded" });
    res.json({ ok: true, mes: req.query.mes, n });
  });
  const srv = app.listen(0);
  const url = (q) => `http://127.0.0.1:${srv.address().port}/pnr?${q}`;
  const get = (q) => fetch(url(q)).then(async (r) => ({ status: r.status, body: await r.json() }));
  // 5 a la vez → 1 cálculo
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => get("token=t&mes=9")));
  assert.strictEqual(n, 1);
  assert.ok(rs.every((r) => r.status === 200 && r.body.n === 1));
  // en caché
  await get("token=t&mes=9"); assert.strictEqual(n, 1);
  // otro mes: otro cálculo
  await get("token=t&mes=8"); assert.strictEqual(n, 2);
  // los errores no se guardan
  assert.strictEqual((await get("token=t&mes=mal")).status, 500);
  await get("token=t&mes=mal"); assert.strictEqual(n, 4);
  // sin token: nunca se sirve la caché
  assert.strictEqual((await get("token=x&mes=9")).status, 401);
  // refresh: recalcula
  await get("token=t&mes=9&refresh=1"); assert.strictEqual(n, 5);
  srv.close();

  // unaALaVez
  let m = 0;
  const f = unaALaVez(async () => { m++; await new Promise((r) => setTimeout(r, 50)); return m; });
  assert.deepStrictEqual(await Promise.all([f(), f(), f()]), [1, 1, 1]);
  console.log("OK cache-respuesta.test");
})().catch((e) => { console.error(e); process.exit(1); });
