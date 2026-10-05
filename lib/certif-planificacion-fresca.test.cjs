// 08/10/2026 · «Preparar certificación» → Planificación lo ve en la siguiente petición (sin esperar la caché de 10 min).
// Uso: node lib/certif-planificacion-fresca.test.cjs
const assert = require("assert");
const http = require("http");
const express = require("express");
process.env.GOOGLE_SHEETS_ID = "x";

(async () => {
  // /api/certificaciones/obras de mentira: primero sin Orad, después de preparar con Orad 13 y 15
  let preparadas = false, lecturas = 0;
  const srv = http.createServer((req, res) => { lecturas++; res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, obras: preparadas ? [{ obra_id: "Urbano Orad 13", previsto_horas: 320, visitas: [] }, { obra_id: "Urbano Orad 15", previsto_horas: 320, visitas: [] }] : [] })); });
  await new Promise((r) => srv.listen(0, r));
  process.env.PORT = String(srv.address().port);
  const DE = require("../ara-os-dinero-empresa.cjs");
  const { certificacionesFrescas } = DE._prueba;

  // sin cambios no se relee nada
  assert.strictEqual(await certificacionesFrescas("t"), null);
  assert.strictEqual(lecturas, 0);
  // se guarda en Certificaciones (POST con éxito) → aviso → la siguiente petición relee
  const app = express();
  require("../ara-os-certificaciones.cjs")(app);
  app.post("/api/certificaciones/prueba-ok", (req, res) => { preparadas = true; res.json({ ok: true }); });
  const s2 = await new Promise((r) => { const x = app.listen(0, () => r(x)); });
  const base = `http://127.0.0.1:${s2.address().port}`;
  await fetch(`${base}/api/certificaciones/no-existe`, { method: "POST" });   // 404: no avisa
  assert.strictEqual(await certificacionesFrescas("t"), null);
  await fetch(`${base}/api/certificaciones/prueba-ok`, { method: "POST" });
  const f = await certificacionesFrescas("t");
  assert.deepStrictEqual([lecturas, f.lista.map((c) => c.obra_id)], [1, ["Urbano Orad 13", "Urbano Orad 15"]]);
  // y una vez leída, no se vuelve a leer hasta el siguiente cambio
  await certificacionesFrescas("t");
  assert.strictEqual(lecturas, 1);
  console.log("OK certif-planificacion-fresca.test · guardar en Certificaciones → Planificación relee (Orad 13 y 15)");
  srv.close(); s2.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
