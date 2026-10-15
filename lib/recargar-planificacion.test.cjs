// 16/10/2026 · «Recargar» en Planificación recalcula de verdad: tras pasar una OT a Finalizada, relee las OT (sin
// Holded), recompone y «Actualizado a las» es la hora de ahora. Uso: node lib/recargar-planificacion.test.cjs
const assert = require("assert");
const http = require("http");
process.env.ADMIN_TOKEN = "t";

(async () => {
  // /ordenes-trabajo y /obras-otras de mentira: Jorge de Montemayor en 13 y, tras el cambio, en 14
  let fase = "13_EN_EJECUCION", lecturasOT = 0;
  const srv = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/api/ara-os/ordenes-trabajo")) { lecturasOT++; return res.end(JSON.stringify({ ok: true, grupos: { [fase]: [{ comunidad: "Jorge de Montemayor 34", ccpp_id: "jm", pto_total: 6416, ot: { fase_ot: fase, fase_ot_hoja: fase } }] } })); }
    if (req.url.startsWith("/api/ara-os/obras-otras")) return res.end(JSON.stringify({ ok: true, obras: [] }));
    if (req.url.startsWith("/api/ara-os/registros-tiempo")) return res.end(JSON.stringify({ ok: true, registros: [] }));
    res.statusCode = 404; res.end("{}");
  });
  await new Promise((r) => srv.listen(0, r));
  process.env.PORT = String(srv.address().port);
  const DE = require("../ara-os-dinero-empresa.cjs");
  const T = require("./dinero-empresa-03-10.test.cjs");
  const P = DE._prueba;

  // datos ya calculados hace una hora (con la OT en 13)
  const fuentes = T.fuentes();
  const antes = new Date(Date.now() - 3600e3).toISOString();
  const base = { fuentes, hoy: T.HOY, generado: antes, tiposBanco: {} };
  P.setCache({ ts: Date.now() - 3600e3, data: { ...DE.componer(base), _base: base } });

  // la OT pasa a Finalizada; «Recargar» (recalcular=1)
  fase = "14_FINALIZADA";
  assert.strictEqual(await P.recalcularOT("t"), true);
  const c = P.getCache();
  assert.strictEqual(lecturasOT, 1);
  assert.ok(c.data._base.generado > antes && Date.now() - c.ts < 5000, `${c.data._base.generado} · ${c.ts}`);
  assert.strictEqual(c.data.generado, c.data._base.generado);   // lo que enseña «Actualizado a las»
  assert.deepStrictEqual(Object.keys(c.data._base.fuentes.ot.data.grupos).filter((k) => c.data._base.fuentes.ot.data.grupos[k].length), ["14_FINALIZADA"]);
  // y repetirlo vuelve a leer (no sale de la caché de 2 min de las OT)
  await P.recalcularOT("t");
  assert.strictEqual(lecturasOT, 2);
  // sin datos calculados todavía: no hace nada (la primera carga ya lee todo)
  P.setCache(null);
  assert.strictEqual(await P.recalcularOT("t"), false);
  console.log("OK recargar-planificacion.test · «Recargar» relee las OT (14_FINALIZADA), recompone y la hora es la de ahora");
  srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
