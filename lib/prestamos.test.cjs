// Test de lib/prestamos.cjs con datos inventados (los reales viven en la hoja).
// Uso: node lib/prestamos.test.cjs
const assert = require("assert");
const P = require("./prestamos.cjs");

const HOY = "2026-09-29";

// Importes
assert.strictEqual(P.parseImporte("1.234,56"), 1234.56);
assert.strictEqual(P.parseImporte("1234.56"), 1234.56);
assert.strictEqual(P.parseImporte("12.000"), 12000);
assert.strictEqual(P.parseImporte("1,5"), 1.5);
assert.strictEqual(P.parseImporte(""), null);
assert.strictEqual(P.parseImporte("abc"), null);

// Calendario irregular: manda sobre cuota/n_cuotas
const irregular = P.calcularPrestamo({
  id: "A", tipo: "recibido", contraparte: "Banco A", principal: "3000",
  cuota: "999", n_cuotas: "9", periodicidad: "mensual", fecha_inicio: "2026-01-01",
  cuotas_detalle: "2026-09-28:1000;2026-10-28:1000,50;2026-11-28:1000",
}, HOY);
assert.strictEqual(irregular.saldo_vivo, 2000.5);
assert.strictEqual(irregular.cuotas_pendientes.length, 2);
assert.strictEqual(irregular.fiabilidad, "exacto");

// Calendario mensual generado, día de cargo ajustado a fin de mes
const mensual = P.calcularPrestamo({
  id: "B", tipo: "recibido", principal: "1200", fecha_inicio: "2026-06-15",
  cuota: "100", periodicidad: "mensual", n_cuotas: "12", dia_cargo: "31",
}, HOY);
assert.deepStrictEqual(mensual.cuotas_pendientes[0], { fecha: "2026-09-30", importe: 100 });
assert.strictEqual(mensual.saldo_vivo, 1000); // 1ª cuota en jul-26: quedan sep-26..jun-27 = 10
assert.ok(mensual.cuotas_pendientes.some((c) => c.fecha === "2027-02-28"));

// Sin calendario → principal + aviso
const sinCal = P.calcularPrestamo({ id: "C", tipo: "concedido", principal: "500", periodicidad: "ninguna" }, HOY);
assert.strictEqual(sinCal.saldo_vivo, 500);
assert.strictEqual(sinCal.fiabilidad, "estimado");
assert.ok(sinCal.avisos.includes("sin calendario de devolución"));

// Sin calendario y sin principal → sin dato, nunca 0
const vacio = P.calcularPrestamo({ id: "D", tipo: "recibido", periodicidad: "ninguna" }, HOY);
assert.strictEqual(vacio.saldo_vivo, null);
assert.strictEqual(vacio.fiabilidad, "sin_dato");

// Resumen: inactivos fuera, cuotas en 30 días, total incompleto
const r = P.resumirPrestamos([
  { id: "A", tipo: "recibido", cuotas_detalle: "2026-10-28:1000;2026-11-28:1000" },
  { id: "B", tipo: "recibido", principal: "700", periodicidad: "ninguna" },
  { id: "C", tipo: "concedido", principal: "500", periodicidad: "ninguna" },
  { id: "X", tipo: "recibido", principal: "9999", activo: "no" },
  { id: "", tipo: "", principal: "" },
], HOY);
assert.strictEqual(r.recibidos.total, 2700);
assert.strictEqual(r.recibidos.completo, true);
assert.strictEqual(r.concedidos.total, 500);
assert.strictEqual(r.total_cuotas_proximas, 1000);
assert.strictEqual(r.cuotas_proximas[0].fecha, "2026-10-28");

const r2 = P.resumirPrestamos([{ id: "D", tipo: "recibido", periodicidad: "ninguna" }], HOY);
assert.strictEqual(r2.recibidos.total, null);
assert.strictEqual(r2.recibidos.completo, false);

// Contraste con Holded: neto por cuenta compartida
const conc = P.calcularPrestamo({ id: "C1", tipo: "concedido", principal: "100", cuenta_holded: "54200000" }, HOY);
const reci = P.calcularPrestamo({ id: "R1", tipo: "recibido", principal: "400", cuenta_holded: "54200000" }, HOY);
const banco = P.calcularPrestamo({ id: "B1", tipo: "recibido", cuotas_detalle: "2026-10-28:50;2026-11-28:50", cuenta_holded: "52000001" }, HOY);
const g1 = P.calcularPrestamo({ id: "G1", tipo: "recibido", principal: "10", cuenta_holded: "17000001" }, HOY);
const ct = P.contrasteHolded([conc, reci, banco, g1], { "54200000": -300, "52000001": -120 });
assert.deepStrictEqual(ct.porCuenta.find((c) => c.cuenta === "54200000").cuadra, true);
assert.strictEqual(ct.porCuenta.find((c) => c.cuenta === "52000001").cuadra, false);
assert.strictEqual(ct.avisos.length, 1);
assert.deepStrictEqual(ct.sinContrastar, ["G1"]);

console.log("OK prestamos.test");
