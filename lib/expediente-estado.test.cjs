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
const sabadell = [["op1", "piso", "Calle Rafael Laffón 7", "3A", "", "1650,50", "2026-09-20"], ["", "entrega_emasesa", "Rafael Laffón 7", "", "EMASESA", "500", "2026-09-25"]];
let llamadas = 0;
const contarFaltan = (estC, dC, ps, dP, fase) => { llamadas++; return fase.startsWith("09") ? { totalFilas: 7, pend: 0 } : { totalFilas: 9, pend: 2 }; };
const r = estadosExpedientes({ comunidades, pisos, docs, sabadell, contarFaltan });
const rl = r[ccppId("Calle Rafael Laffón 7")], ot = r[ccppId("Calle Otelo 8")];
assert.deepStrictEqual([rl.pisos, rl.contratos.ok, rl.contratos.total, rl.pagos.resueltos, rl.pagos.pagados, rl.pagos.financiados], [6, 6, 6, 6, 5, [{ vivienda: "3A", meses: 18, ffcc: false, importe: 1650.5, abonado: true, fecha_abono: "2026-09-20" }]]);
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
// Sabadell: lo abonado según la hoja (fecha de abono) y lo entregado a EMASESA
assert.deepStrictEqual(rl.sabadell, { abonado_eur: 1650.5, abonos: [{ vivienda: "3A", importe: 1650.5, fecha: "2026-09-20" }], entregado_emasesa_eur: 500 });
// financiado sin fila en financiaciones_sabadell: pendiente de abono
const pisF = [cabPis, ["600", "Calle Tordo 18", "1DCHA", "18", "OK", "18"], ["600", "Calle Tordo 18", "2IZDA", "18", "OK", "FFCC"]];
const tf = estadosExpedientes({ comunidades: comT, pisos: pisF, docs, sabadell: [["op9", "piso", "Tordo 18", "2izda", "", "1800", "2026-10-01"]] })[ccppId("Calle Tordo 18")];
assert.deepStrictEqual(tf.pagos.financiados.map((f) => [f.vivienda, f.abonado, f.importe, f.fecha_abono]), [["1DCHA", false, null, null], ["2IZDA", true, 1800, "2026-10-01"]]);
// fila de tipo «comunidad»: todos los financiados abonados
const tc = estadosExpedientes({ comunidades: comT, pisos: pisF, docs, sabadell: [["op8", "comunidad", "Tordo 18", "", "", "3600", "2026-10-02"]] })[ccppId("Calle Tordo 18")];
assert.deepStrictEqual(tc.pagos.financiados.map((f) => f.abonado), [true, true]);
// «Faltan N de M» con el contador del panel: recibe los pisos de la dirección con los campos del bot y la clave
{
  const cabB = ["telefono", "comunidad", "vivienda", "est_piso_contrato", "est_piso_pago", "bot_piso_activo", "piso_tipo", "acordeon"];
  const pisB = [cabB, ["6", "Calle Otelo 8", "1A", "", "", "BOT_WHATSAPP", "propietario", ""], ["6", "Calle  OTELO 8", "1B", "", "", "", "", "BOT"], ["6", "Otelo 8", "2A", "", "", "", "", ""]];
  const comB = [cabCom, ["Otelo 8", "Calle Otelo 8", "05_DOCUMENTACION", 20000, "", ""]];
  let visto = null;
  const rB = estadosExpedientes({ comunidades: comB, pisos: pisB, docs, contarFaltan: (estC, dC, ps, dP, fase, clave) => { visto = { ps, clave, fase }; return { totalFilas: 9, pend: 2 }; } })[ccppId("Calle Otelo 8")];
  assert.deepStrictEqual(rB.documentacion, { faltan: 2, total: 9 });
  assert.deepStrictEqual([visto.clave, visto.fase, visto.ps.map((p) => [p.vivienda, p.bot_piso_activo, p.piso_tipo, p.acordeon])],
    ["Calle Otelo 8", "05_DOCUMENTACION", [["1A", "BOT_WHATSAPP", "propietario", ""], ["1B", "", "", "BOT"]]]);
}
// ccpp_alias: la fila de «Paz 29» pasa a la obra «La Paz 29» de la cartera
{
  const { aplicarAliasExpedientes } = require("./expediente-estado.cjs");
  const m = { ccpp_paz_29_479ef1: { ccpp_id: "ccpp_paz_29_479ef1", pisos: 6 }, ccpp_la_paz_29_c896f4: { ccpp_id: "ccpp_la_paz_29_c896f4", pisos: 0 } };
  aplicarAliasExpedientes(m, { ccpp_paz_29_479ef1: "ccpp_la_paz_29_c896f4" });
  assert.deepStrictEqual(Object.keys(m), ["ccpp_la_paz_29_c896f4"]);
  assert.deepStrictEqual([m.ccpp_la_paz_29_c896f4.pisos, m.ccpp_la_paz_29_c896f4.ccpp_id_original], [6, "ccpp_paz_29_479ef1"]);
}
// comunidad financiada: abonada con fila de tipo «comunidad» en financiaciones_sabadell
{
  const comF = [cabCom, ["La Paz 29", "Calle La Paz 29", "09_TRAMITADA", 30000, "OK", "18"]];
  const sinAb = estadosExpedientes({ comunidades: comF, pisos: [cabPis], docs })[ccppId("Calle La Paz 29")];
  assert.deepStrictEqual([sinAb.ccpp.pago.tipo, sinAb.ccpp.abonado], ["financiado", false]);
  const conAb = estadosExpedientes({ comunidades: comF, pisos: [cabPis], docs, sabadell: [["op7", "comunidad", "La Paz 29", "", "", "33000", "2026-10-01"]] })[ccppId("Calle La Paz 29")];
  assert.deepStrictEqual([conAb.ccpp.abonado, conAb.ccpp.importe_abono, conAb.ccpp.fecha_abono], [true, 33000, "2026-10-01"]);
}
console.log("OK expediente-estado.test");
