// 08/10/2026 · lectura única de config_dinero. Uso: node lib/config-dinero.test.cjs
const assert = require("assert");
const CD = require("./config-dinero.cjs");

// como en producción: cabecera en la fila 1, horas_dia en la 19, coste_hora_eur en la 21 (B21 30)
const hoja = [["clave", "valor", "nota"]];
for (let i = 2; i <= 18; i++) hoja.push([`clave_${i}`, i, ""]);
hoja.push(["horas_dia", 8, "jornada"]);                   // fila 19
hoja.push(["coste_hora_eur", "", ""]);                    // fila 20: repetida y vacía (la primera ganaba antes)
hoja.push(["coste_hora_eur", 30, "coste por hora"]);      // fila 21
hoja.push([]);                                            // fila vacía
hoja.push(["​margen_minimo_privadas ", "30 %", ""]); // con caracteres invisibles
const filas = CD.filasDeValores(hoja);
assert.strictEqual(filas.find((f) => f.clave === "horas_dia").fila, 19);
assert.strictEqual(CD.numConfig(filas, "coste_hora_eur"), 30);
assert.strictEqual(CD.valorConfig(filas, "coste_hora_eur").fila, 21);
assert.strictEqual(CD.numConfig(filas, "margen_minimo_privadas"), 30);
assert.strictEqual(CD.numConfig([{ clave: "coste_hora_eur", valor: "30,00 €/h", fila: 2 }], "coste_hora_eur"), 30);
assert.strictEqual(CD.numConfig(filas, "no_existe"), null);
// sin cabecera en la fila 1 también se lee
assert.strictEqual(CD.numConfig(CD.filasDeValores([["coste_hora_eur", 30]]), "coste_hora_eur"), 30);
// el diagnóstico dice qué filas tienen la clave
const d = CD.diagnosticoClave(filas, hoja.length, "coste_hora_eur");
assert.deepStrictEqual([d.rango, d.filas_leidas, d.filas_con_la_clave.map((x) => x.fila)], ["config_dinero!A:C", 23, [20, 21]]);

// leerConfigDinero pide toda la hoja (A:C, sin fila final) y sin formato
(async () => {
  let pedido = null;
  const sheets = { spreadsheets: { values: { get: async (q) => { pedido = q; return { data: { values: hoja } }; } } } };
  const r = await CD.leerConfigDinero(sheets);
  assert.deepStrictEqual([pedido.range, pedido.valueRenderOption, CD.numConfig(r.filas, "coste_hora_eur"), r.filas_hoja], ["config_dinero!A:C", "UNFORMATTED_VALUE", 30, 23]);
  console.log("OK config-dinero.test · config_dinero!A:C · coste_hora_eur (fila 21) = 30 aunque la fila 20 la repita vacía");
})().catch((e) => { console.error(e); process.exit(1); });
