// Test: deudas de Hacienda pagadas (marcadas o encontradas en el banco).
// Holded se simula con un fetch falso. Los importes se leen del propio
// CALENDARIO, no se escriben aquí. Uso: node lib/obligaciones-pagos.test.cjs
const assert = require("assert");
process.env.HOLDED_API_TOKEN = "x";
process.env.HOLDED_API_KEY = "x";
const O = require("../ara-os-obligaciones.cjs");

const exps = O.CALENDARIO.expedientes;
const sinCal = exps.filter((e) => e.sin_calendario);
const marcadas = sinCal.filter((e) => e.pagada);
const libres = sinCal.filter((e) => !e.pagada);              // p. ej. IS aplazado sin calendario
assert.strictEqual(marcadas.length, 3, "las tres sanciones marcadas como pagadas");
assert.ok(libres.length >= 1);
const libre = libres[0];
const dmy = (iso) => iso.split("-").reverse().join("/");

// ── pagoEnBanco ──────────────────────────────────────────────
const ap = [
  { fecha: "2026-09-20", descripcion: "INGRESO AEAT", salida: 100, tipo: "entry" },        // asiento manual: no
  { fecha: "2026-09-20", descripcion: "Regularización AEAT", salida: 100, tipo: "" },      // regularización: no
  { fecha: "2026-09-01", descripcion: "INGRESO AEAT", salida: 100, tipo: "" },             // anterior a la deuda: no
  { fecha: "2026-09-20", descripcion: "TRANSFERENCIA", salida: 100, tipo: "" },            // concepto: no
  { fecha: "2026-09-21", descripcion: "0000DOCUMENTOS DE INGRESO PARCIAL.", salida: 100.02, tipo: "" }, // sí (±0,02)
];
const us = new Set();
assert.strictEqual(O.pagoEnBanco(100, "2026-09-12", ap, us).fecha, "2026-09-21");
assert.strictEqual(O.pagoEnBanco(100, "2026-09-12", ap, us), null);      // cada cargo, una vez
assert.strictEqual(O.pagoEnBanco(100.05, "2026-09-12", ap, new Set()), null);   // 0,03 de diferencia: no

// ── construir() con un Holded simulado ───────────────────────
const ddmmyyyy = (iso) => dmy(iso);
const items = [
  // Pago de la deuda sin calendario, por banco, después de la fecha del calendario
  { account: "57200001", date: ddmmyyyy("2026-09-24"), description: "PAGO IMPUESTO SOCIEDADES AEAT", debit: 0, credit: libre.pendiente_sede, type: "" },
  // Un asiento manual con el mismo importe NO la paga (se consume antes si se aceptara)
  { account: "57200001", date: ddmmyyyy("2026-09-22"), description: "INGRESO AEAT", debit: 0, credit: libre.pendiente_sede, type: "entry" },
];
global.fetch = async (url) => {
  const u = String(url);
  const body = /ledger-entries/.test(u) ? { items, has_more: false } : [];
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
};

(async () => {
  const d = await O.construir(true);
  for (const m of marcadas) {
    const e = d.expedientes.find((x) => x.id === m.id);
    assert.strictEqual(e.pendiente, 0, m.id);
    assert.strictEqual(e.estado_pago, "pagada");
    assert.ok(e.detalle_pago.startsWith("pagada el 17/09/2026"), e.detalle_pago);
  }
  const el = d.expedientes.find((x) => x.id === libre.id);
  assert.strictEqual(el.pendiente, 0);
  assert.strictEqual(el.estado_pago, "pagada_banco");
  assert.strictEqual(el.detalle_pago, "pagada según banco (24/09/2026)");
  // Ninguna deuda en ejecutivo pendiente → sin aviso rojo de ejecutivo
  assert.ok(!d.avisos.some((a) => /periodo ejecutivo/.test(a.texto)));
  // La deuda total ya no incluye lo pagado
  const pendientesConPlazos = d.expedientes.filter((x) => !x.sin_calendario).reduce((s, x) => s + x.pendiente, 0);
  assert.strictEqual(d.resumen.deuda_total, Math.round(pendientesConPlazos * 100) / 100);
  console.log("OK obligaciones-pagos.test");
})().catch((e) => { console.error(e); process.exit(1); });
