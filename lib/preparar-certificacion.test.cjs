// 07/10/2026 · «Preparar certificación». Uso: node lib/preparar-certificacion.test.cjs
const assert = require("assert");
const PREP = require("./preparar-certificacion.cjs");
const PO = require("./partidas-orad.cjs");

(async () => {
  // OO-2026-142: la propuesta son las 7 partidas de Orad, 320 h, en la ficha «Urbano Orad 13»
  const o = PREP.propuestaOrad("OO-2026-142");
  const ps = PREP.normalizarPropuesta(o.partidas, 320);
  assert.deepStrictEqual([o.obra_id, ps.length, ps.reduce((t, p) => t + p.horas, 0)], ["Urbano Orad 13", 7, 320]);
  assert.deepStrictEqual(ps.map((p) => p.horas), [8, 40, 80, 40, 105, 25, 22]);
  assert.deepStrictEqual(ps[2].medicion, { tipo: "conteo", unidad: "columnas", total_de: "columnas" });   // N a contar en obra
  assert.strictEqual(PREP.propuestaOrad("OO-2026-999"), null);
  assert.strictEqual(PREP.certObraDe({ obra_id: "OO-2026-143", nombre: "CCPP.URBANO ORAD 15" }), "Urbano Orad 15");
  assert.strictEqual(PREP.certObraDe({ obra_id: "OO-2026-150", nombre: "Calle Feria 3" }), "Calle Feria 3");

  // guardar: mismos ids que las de Orad ya preparadas (orad13_p1…): no se duplican
  const v = PREP.validar(ps, 320);
  assert.ok(!v.error, v.error);
  const filas = PREP.filasPartidas({ obra_id: "Urbano Orad 13", presupuesto_id: "OO-2026-142", partidas: v.partidas, ahora: "x" });
  const antiguas = PO.filasPartidasOrad([]).filter((f) => f.obra_id === "Urbano Orad 13");
  assert.deepStrictEqual(filas.map((f) => f.partida_id), antiguas.map((f) => f.partida_id));
  assert.deepStrictEqual(filas.map((f) => f.tiempo_previsto_horas), [8, 40, 80, 40, 105, 25, 22]);
  assert.strictEqual(PO.leerMedicion(filas[4].medicion).total, 21);
  // «8 de 21 viviendas» → partida 5 al 38 %
  assert.strictEqual(PO.pctDeConteo(8, PO.leerMedicion(filas[4].medicion).total), 38);

  // no se guarda si no suman exactamente las horas del presupuesto
  assert.match(PREP.validar(ps.map((p, i) => (i === 0 ? { ...p, horas: 9 } : p)), 320).error, /suman 321 h y el presupuesto tiene 320 h/);
  assert.match(PREP.validar(ps, 0).error, /no tiene horas previstas/);
  assert.match(PREP.validar([{ nombre: "A", horas: 10, medicion: { tipo: "conteo" } }], 10).error, /unidad/);
  assert.match(PREP.validar([{ nombre: "", horas: 10, medicion: { tipo: "pct" } }], 10).error, /falta el nombre/);
  assert.match(PREP.validar([{ nombre: "A", horas: 10, medicion: { tipo: "conteo", unidad: "bajantes", total: 0 } }], 10).error, /entero de 1 a 1000/);

  // horas: enteras y sumando exactamente el total
  assert.deepStrictEqual(PREP.ajustarHoras([10, 10, 10], 100), [34, 33, 33]);
  assert.deepStrictEqual(PREP.ajustarHoras([1, 1], 7.5), [4.5, 3]);
  assert.strictEqual(PREP.ajustarHoras([3, 7, 11, 2], 186).reduce((t, h) => t + h, 0), 186);

  // IA: el mismo motor (Messages API, herramienta forzada), horas ajustadas al presupuesto
  let pedido = null;
  const fetchMock = async (url, opt) => { pedido = { url, body: JSON.parse(opt.body), headers: opt.headers };
    return { ok: true, json: async () => ({ content: [{ type: "tool_use", input: { partidas: [
      { nombre: "Replanteo", horas: 4, medida: "hecho" }, { nombre: "Bajantes", horas: 30, medida: "conteo", unidad: "bajantes", total: 4 },
      { nombre: "Arquetas", horas: 20, medida: "conteo", unidad: "arquetas" }, { nombre: "Remates", horas: 6, medida: "hecho_pct" }] } }] }) }; };
  const ia = await PREP.proponerConIA({ descripcion: "Sustitución de 4 bajantes y arquetas", horas: 120, nombre: "Feria 3", modelo: "m", apiKey: "k", fetchImpl: fetchMock });
  assert.deepStrictEqual([pedido.url, pedido.body.tool_choice, pedido.headers["anthropic-version"]], ["https://api.anthropic.com/v1/messages", { type: "tool", name: "proponer_partidas_control" }, "2023-06-01"]);
  assert.deepStrictEqual(ia.map((p) => p.horas), [8, 60, 40, 12]);
  assert.deepStrictEqual([ia[1].medicion, ia[2].medicion], [{ tipo: "conteo", unidad: "bajantes", total: 4 }, { tipo: "conteo", unidad: "arquetas", total_de: "arquetas" }]);
  await assert.rejects(PREP.proponerConIA({ descripcion: "", horas: 10, modelo: "m", apiKey: "k", fetchImpl: fetchMock }), /no tiene descripción/);

  console.log(`OK preparar-certificacion.test · OO-2026-142: ${ps.length} partidas, ${ps.reduce((t, p) => t + p.horas, 0)} h, mismos ids que las de Orad · IA ${ia.map((p) => p.horas).join("+")} = 120 h`);
})().catch((e) => { console.error(e); process.exit(1); });
