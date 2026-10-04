// Holded en 429: se sirve la última carga completa (de_cache), nunca una con huecos.
const assert = require("assert");
const path = require("path"), os = require("os"), fs = require("fs");
process.env.DINERO_ULTIMO_COMPLETO_FILE = path.join(os.tmpdir(), `ultimo-completo-${process.pid}.json`);
delete process.env.GOOGLE_SHEETS_ID;
const D = require("../ara-os-dinero-empresa.cjs");
const X = require("./conciliacion-03-10.test.cjs");
const T = require("./dinero-empresa-03-10.test.cjs");
const P = D._prueba;

(async () => {
  const buenas = X.fuentes();
  const completa = { ...D.componer({ fuentes: buenas, hoy: T.HOY, generado: X.AHORA, tiposBanco: {} }, {}), _base: { fuentes: buenas } };
  assert.ok(!P.fuenteCaida(completa), "la carga de referencia está completa");
  const caidas = X.fuentes();
  for (const k of ["tesoreria", "clientes", "invoices", "banco", "compras", "custodias"]) caidas[k] = { ok: false, error: "Holded 429 Too Many Requests" };
  const huecos = D.componer({ fuentes: caidas, hoy: T.HOY, generado: "2026-10-04T09:00:00.000Z", tiposBanco: {} }, {});
  assert.strictEqual(huecos.completo, false);

  // Sin carga completa guardada: se sirve lo que hay (con sus «sin dato»)
  P.reset();
  assert.strictEqual(P.aServir({ ts: Date.now(), data: huecos }).data, huecos);

  // Con carga completa: se sirve esa, marcada de_cache, sin _base
  const tBueno = Date.now() - 3 * 3600e3;
  P.guardarUltimoCompleto(tBueno, completa);
  const s = P.aServir({ ts: Date.now(), data: huecos });
  assert.strictEqual(s.ts, tBueno);
  assert.strictEqual(s.data.completo, completa.completo);
  assert.strictEqual(s.data.generado, completa.generado);
  assert.strictEqual(s.data._base, undefined);
  assert.strictEqual(s.data.de_cache.motivo, "Holded no responde");
  assert.ok(s.data.de_cache.fuentes_caidas.some((f) => f.fuente === "tesoreria"));
  assert.deepStrictEqual(s.data.cashflow.inicial, completa.cashflow.inicial);
  assert.ok(s.data.cashflow.inicial.caja != null || Object.values(s.data.cashflow.inicial).some((v) => v != null), "cifras buenas, no null");

  // La carga sigue leyendo de Holded (posicion-neta-real tarda): «actualizando», no «Holded no responde»
  const lentas = X.fuentes();
  lentas.pnr_ref = { ok: false, pendiente: true, error: "pnr_2026_9: leyendo de Holded (más de 20 s; sigue por detrás)" };
  const aMedias = D.componer({ fuentes: lentas, hoy: T.HOY, generado: "2026-10-04T09:05:00.000Z", tiposBanco: {} }, {});
  const sa = P.aServir({ ts: Date.now(), data: aMedias });
  assert.deepStrictEqual([sa.ts, sa.data.de_cache.motivo, sa.data.de_cache.actualizando], [tBueno, "actualizando", true]);
  assert.strictEqual(P.deUltimo("actualizando").data.generado, completa.generado);
  // la última completa trae lo que Planificación necesita (cartera y cuadrillas)
  assert.ok(sa.data.cashflow.simulador && "cuadrillas_personas" in sa.data.cashflow);

  // Una carga completa nueva se sirve tal cual (sin de_cache)
  const c2 = { ts: Date.now(), data: completa };
  assert.strictEqual(P.aServir(c2), c2);

  // Sobrevive a un reinicio (copia en disco)
  await new Promise((r) => setTimeout(r, 50));
  P.reset();
  await P.cargarUltimoCompleto();
  assert.strictEqual(P.aServir({ ts: Date.now(), data: huecos }).ts, tBueno);

  // Más vieja que una semana: no se sirve
  P.reset();
  P.guardarUltimoCompleto(Date.now() - 8 * 24 * 3600e3, completa);
  assert.strictEqual(P.aServir({ ts: Date.now(), data: huecos }).data, huecos);

  fs.rmSync(process.env.DINERO_ULTIMO_COMPLETO_FILE, { force: true });
  console.log("OK ultimo-completo.test");
})().catch((e) => { console.error(e); process.exit(1); });
