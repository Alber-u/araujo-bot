// Estado del expediente (contratos y pagos de los pisos) para «Lista para empezar»
const assert = require("assert");
const { estadosExpedientes, tipoPago } = require("./expediente-estado.cjs");
const { ccppId } = require("./orden-cartera.cjs");

assert.deepStrictEqual(tipoPago("OK"), { tipo: "pagado" });
assert.deepStrictEqual(tipoPago("18"), { tipo: "financiado", meses: 18 });
assert.deepStrictEqual(tipoPago("REVISAR").tipo, "pendiente");
assert.deepStrictEqual(tipoPago("").tipo, "no_aplica");
assert.deepStrictEqual(tipoPago("NP").tipo, "no_aplica");

const cabCom = ["comunidad", "direccion", "fase_presupuesto", "pto_total", "est_ccpp_contrato", "est_ccpp_pago"];
const cabPis = ["telefono", "comunidad", "vivienda", "est_piso_meses_financiar", "est_piso_contrato", "est_piso_pago"];
const comunidades = [cabCom,
  ["Rafael Laffón 7", "Calle Rafael Laffón 7", "09_TRAMITADA", 8981, "OK", "OK"],
  ["Otelo 8", "Calle Otelo 8", "05_DOCUMENTACION", 20000, "", ""]];
const pisos = [cabPis,
  ...["1A", "1B", "2A", "2B", "3B"].map((v) => ["600", "Calle Rafael Laffón 7", v, "", "OK", "OK"]),
  ["600", "Calle Rafael Laffón 7", "3A", "18", "OK", "18"],
  ["600", "Otelo 8", "1IZDA", "", "", ""], ["600", "Otelo 8", "2DCHA", "", "F", "REVISAR"]];
const docs = { piso: [{ codigo: "piso_contrato" }, { codigo: "piso_pago" }], ccpp: [{ codigo: "ccpp_contrato" }, { codigo: "ccpp_pago" }] };
const sabadell = [["op1", "piso", "Calle Rafael Laffón 7", "3A", "", "1650,50"]];
let llamadas = 0;
const contarFaltan = (estC, dC, ps, dP, fase) => { llamadas++; return fase.startsWith("09") ? { totalFilas: 7, pend: 0 } : { totalFilas: 9, pend: 2 }; };
const r = estadosExpedientes({ comunidades, pisos, docs, sabadell, contarFaltan });
const rl = r[ccppId("Calle Rafael Laffón 7")], ot = r[ccppId("Calle Otelo 8")];
assert.deepStrictEqual([rl.pisos, rl.contratos.ok, rl.contratos.total, rl.pagos.resueltos, rl.pagos.pagados, rl.pagos.financiados], [6, 6, 6, 6, 5, [{ vivienda: "3A", meses: 18, ffcc: false, importe: 1650.5 }]]);
assert.deepStrictEqual([rl.ccpp.aplica, rl.ccpp.contrato, rl.ccpp.pago.tipo, rl.documentacion], [true, true, "pagado", { faltan: 0, total: 7 }]);
// Otelo 8: un piso sin nada (no aplica todavía) y otro con contrato F y pago REVISAR
assert.deepStrictEqual([ot.fase, ot.contratos.faltan, ot.pagos.faltan, ot.documentacion], ["05_DOCUMENTACION", ["2DCHA"], ["2DCHA"], { faltan: 2, total: 9 }]);
assert.strictEqual(llamadas, 2);
// cabecera sin nombres: por posición (COLS de presupuestos)
assert.ok(Object.keys(estadosExpedientes({ comunidades: [["x"]], pisos: [["y"]], docs })).length === 0);
// Tordo 18: «7/7 contratos · 8/8 pagados» → un piso con pago y sin contrato, y uno repetido: no cuadra
const comT = [cabCom, ["Tordo 18", "Calle Tordo 18", "09_TRAMITADA", 9000, "", ""]];
const pisT = [cabPis, ...["1A", "1B", "2A", "2B", "3A", "3B"].map((v) => ["600", "Calle Tordo 18", v, "", "OK", "OK"]),
  ["600", "Calle Tordo 18", "4A", "", "", "OK"], ["601", "Tordo 18", "1a", "", "OK", "OK"]];
const t = estadosExpedientes({ comunidades: comT, pisos: pisT, docs })[ccppId("Calle Tordo 18")];
assert.deepStrictEqual([t.contratos.ok, t.contratos.total, t.pagos.resueltos, t.pagos.total, t.pisos], [7, 7, 8, 8, 7]);
assert.deepStrictEqual([t.cuadre.ok, t.cuadre.repetidos, t.cuadre.sin_contrato, t.cuadre.sin_pago],
  [false, [{ vivienda: "1A", filas: 2 }], [{ vivienda: "4A", contrato: "vacío", pago: "OK" }], []]);
assert.strictEqual(rl.cuadre.ok, true);
console.log("OK expediente-estado.test");
