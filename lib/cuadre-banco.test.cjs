// Test 10.2.1: saldo del banco (tesorería) contra saldo contable de la 572.
// Holded se simula con un fetch falso. Uso: node lib/cuadre-banco.test.cjs
const assert = require("assert");
process.env.HOLDED_API_TOKEN = "x";
const D = require("../ara-os-dinero-empresa.cjs");
const C = require("./dinero-empresa-calculo.cjs");

// 250 apuntes de la 57200001 en 3 páginas (y alguno de otra cuenta que se ignora)
const apuntes = Array.from({ length: 250 }, (_, i) => ({ account: "57200001", date: "15/09/2026", debit: i % 2 ? 0 : 300, credit: i % 2 ? 100 : 0 }));
let llamadas = 0;
global.fetch = async (url) => {
  llamadas++;
  const u = new URL(String(url));
  const pag = Number(u.searchParams.get("cursor") || 0);
  const items = apuntes.slice(pag * 100, pag * 100 + 100).concat(pag === 0 ? [{ account: "57200006", date: "01/09/2026", debit: 999, credit: 0 }] : []);
  const has_more = (pag + 1) * 100 < apuntes.length;
  return { ok: true, status: 200, json: async () => ({ items, has_more, cursor: has_more ? String(pag + 1) : null }) };
};

(async () => {
  const saldoContable = 125 * 300 - 125 * 100;   // 25.000
  const tes = { ok: true, data: { cuentas: [{ cuenta: "57200001", saldo: 16003.68 }, { cuenta: "57200006", saldo: 10 }] } };
  const r = await D.cuadreCuenta(tes, "57200001", "2026-10-01", true);
  assert.deepStrictEqual([r.ok, r.data.saldo_movimientos, r.data.apuntes], [true, saldoContable, 250]);
  assert.strictEqual(llamadas, 3);
  const q = C.cuadreBanco(r);
  assert.strictEqual(q.estado, "no_cuadra");
  assert.strictEqual(q.diferencia, -8996.32);             // banco 16.003,68 − contable 25.000
  assert.strictEqual(q.provisional, true);
  // caché de 10 min: no vuelve a llamar a Holded
  await D.cuadreCuenta(tes, "57200001", "2026-10-01", false);
  assert.strictEqual(llamadas, 3);
  // cuadra (±1 €)
  const t2 = { ok: true, data: { cuentas: [{ cuenta: "57200001", saldo: 25000.6 }] } };
  assert.strictEqual(C.cuadreBanco(await D.cuadreCuenta(t2, "57200001", "2026-10-01", false)).estado, "cuadra");
  // sin la cuenta en tesorería, o sin tesorería: sin comprobar (nunca «cuadra»)
  assert.strictEqual(C.cuadreBanco(await D.cuadreCuenta({ ok: true, data: { cuentas: [] } }, "57200001", "2026-10-01", false)).estado, "sin_comprobar");
  assert.strictEqual(C.cuadreBanco(await D.cuadreCuenta({ ok: false, error: "x" }, "57200001", "2026-10-01", false)).estado, "sin_comprobar");
  console.log("OK cuadre-banco.test");
})().catch((e) => { console.error(e); process.exit(1); });
