// Compras/rectificativas/facturas de Holded: una lectura a la vez y caché de 15 min (04/10/2026)
const assert = require("assert");
process.env.HOLDED_API_KEY = process.env.HOLDED_API_KEY || "prueba";
const llamadas = {};
global.fetch = async (url) => {
  const ruta = new URL(url).pathname.split("/").pop();
  llamadas[ruta] = (llamadas[ruta] || 0) + 1;
  await new Promise((r) => setTimeout(r, 2));
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
const H = require("../ara-os-holded.cjs");
(async () => {
  // balance-anual pide 24 meses y gastos-resumen 36, a la vez, y tres obras más: UNA lectura de 36 ventanas
  await Promise.all([H.obtenerPurchases({ mesesHaciaAtras: 24 }), H.obtenerPurchases(), H.obtenerPurchases(), H.obtenerPurchases(), H.obtenerPurchases()]);
  assert.strictEqual(llamadas.purchase, 36, JSON.stringify(llamadas));
  // dentro de los 15 min: de la caché
  await H.obtenerPurchases({ mesesHaciaAtras: 24 });
  assert.strictEqual(llamadas.purchase, 36);
  await Promise.all([H.obtenerPurchaseRefunds(), H.obtenerPurchaseRefunds(), H.obtenerInvoices(), H.obtenerInvoices({ mesesHaciaAtras: 24 })]);
  assert.strictEqual(llamadas.purchaserefund, 36);
  assert.strictEqual(llamadas.invoice, 36);
  await Promise.all([H.obtenerPurchaseRefunds(), H.obtenerInvoices()]);
  assert.deepStrictEqual([llamadas.purchaserefund, llamadas.invoice], [36, 36]);
  console.log("OK holded-helpers-cache.test ·", JSON.stringify(llamadas));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
