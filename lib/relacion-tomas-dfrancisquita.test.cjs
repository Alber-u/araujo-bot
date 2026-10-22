// 22/10/2026 · Certificados EMASESA de Doña Francisquita 20 con lo que mandó JM el 19/10 (2 fotos de rótulo + 2
// relaciones de tomas de EMASESA del 14/10). Regla de Alberto (22/10): el PDF de EMASESA es GENÉRICO; el rótulo manda
// (batería, fila, columna) y el PDF sólo aporta cliente, caudal y calibre por piso+puerta, contra los PDF de TODAS
// las baterías de la obra juntos.
//   1 · puerta «C» con planta = vivienda (V); sólo «C»/«CDAD»/«COM» sin planta (o Bajo + CDAD) es la comunidad
//   2 · cuadrículas = las fotos (2×10 y 3×8), nunca la numeración del PDF (3×7 y 2×14)
//   3 · el 4º (en el PDF 32269) va en la batería 1 con sus nombres; no es incoherencia
//   4 · «casan» = piso+puerta exacto en algún PDF de la obra; repetido o inexistente bloquea; locales sin rótulo, aviso
// Uso: node lib/relacion-tomas-dfrancisquita.test.cjs
const assert = require("assert");
const RT = require("./relacion-tomas.cjs");

// ── 1 · puerta C ──
const k = (s) => RT.claveComun(s);
for (const s of ["C", "CDAD", "COM", "COMUNIDAD"]) assert.strictEqual(k(s), "COMUNIDAD", s);
for (const [s, e] of [["10ºC", "10C"], ["1º C", "1C"], ["9ºC", "9C"], ["3ºC", "3C"], ["10ºA", "10A"]]) assert.strictEqual(k(s), e, s);
const kt = (t) => RT.claveComun(RT.claveToma(t));
assert.strictEqual(kt({ piso: "10º", puerta: "C", caudal: "1,40", cliente: "SANCHEZ ALZATE, X" }), "10C");
assert.strictEqual(kt({ piso: "10º", puerta: "C", destino: "C", caudal: "1,40", cliente: "SANCHEZ ALZATE, X" }), "10C");   // un destino «C» guardado no la vuelve comunidad
assert.strictEqual(kt({ piso: "Bajo", puerta: "CDAD", caudal: "0,40", cliente: "CDAD PROP" }), "COMUNIDAD");
assert.strictEqual(kt({ piso: "", puerta: "C", caudal: "0,40" }), "COMUNIDAD");
assert.strictEqual(kt({ piso: "C", puerta: "C", caudal: "0,40" }), "COMUNIDAD");   // JP17: «C · C»
assert.strictEqual(kt({ piso: "COM", puerta: "", destino: "C" }), "COMUNIDAD");      // modal: normalizarTomaCom

// ── datos de la obra ──
const pad = (n) => String(n).padStart(2, "0");
const nombre = (pl, pu) => ({ "4D": "RUBIO ESPINOLA, ANA", "10C": "SANCHEZ ALZATE, LUIS", "6C": "VERA DELGADO, MARIA ISABEL", "9D": "VERA DELGADO, MARIA ISABEL" })[`${pl}${pu}`] || `VECINO ${pl}${pu}, NOMBRE`;
const toma = (n, piso, puerta, caudal, cliente) => ({ toma: `${pad(Math.floor(n / 100))}-${pad(n % 100)}`, piso, puerta, ampliacion: "", caudal, calibre: "15", cliente, revisada: true });
// PDF 32268: 1º-3º, comunidad, 6 locales y 2 libres (3 × 7 en su numeración)
const pdf32268 = [];
let n = 101;
const sig = () => { const r = n; n = n % 100 === 7 ? n + 94 : n + 1; return r; };
for (let pl = 1; pl <= 3; pl++) for (const pu of "ABCD") pdf32268.push(toma(sig(), `${pl}º`, pu, "1,40", nombre(pl, pu)));
pdf32268.push(toma(sig(), "Bajo", "CDAD", "0,40", "CDAD PROP CL DOÑA FRANCISQUITA 20"));
for (let i = 1; i <= 6; i++) pdf32268.push(toma(sig(), "Bajo", String(i), "1,40", `LOCAL ${i}, TITULAR`));
pdf32268.push(toma(sig(), "", "", "0,00", ""), toma(sig(), "", "", "0,00", ""));
// PDF 32269: 4º-10º (2 × 14 en su numeración; 10ºC es la 02-13)
const pdf32269 = [];
n = 101;
const sig2 = () => { const r = n; n = n % 100 === 14 ? n + 87 : n + 1; return r; };
for (let pl = 4; pl <= 10; pl++) for (const pu of "ABCD") pdf32269.push(toma(sig2(), `${pl}º`, pu, "1,40", nombre(pl, pu)));
assert.strictEqual(pdf32269.find((t) => t.piso === "10º" && t.puerta === "C").toma, "02-13");

const rotulo1 = ["3ºC", "4ºC", "3ºB", "1ºB", "3ºA", "1ºA", "2ºD", "4ºD", "X", "X",
                 "1ºC", "2ºC", "2ºB", "4ºB", "4ºA", "2ºA", "1ºD", "3ºD", "C", "X"];
const rotulo2 = ["10ºA", "7ºA", "7ºD", "10ºD", "10ºC", "9ºC", "6ºB", "9ºB",
                 "9ºA", "6ºA", "8ºD", "5ºD", "5ºC", "8ºC", "5ºB", "7ºB",
                 "8ºA", "5ºA", "9ºD", "6ºD", "7ºC", "6ºC", "10ºB", "8ºB"];
const obra = (r1 = rotulo1, r2 = rotulo2) => RT.montarCuadriculasObra([
  { orden: 1, numero_bateria: "32268", celdas: r1, numFilas: 2, numCols: 10, tomas: pdf32268 },
  { orden: 2, numero_bateria: "32269", celdas: r2, numFilas: 3, numCols: 8, tomas: pdf32269 },
]);

// ── 2-4 · Doña Francisquita 20 ──
const o = obra();
const b1 = o.porOrden[1], b2 = o.porOrden[2];
assert.deepStrictEqual([b1.num_filas, b1.num_cols, b2.num_filas, b2.num_cols], [2, 10, 3, 8]);
assert.ok(b1.ok && b2.ok, [...b1.errores, ...b2.errores].join(" | "));
// la cuadrícula es la foto, celda a celda
assert.deepStrictEqual(b1.celdas.map((c) => c.senal), rotulo1);
assert.deepStrictEqual(b2.celdas.map((c) => c.senal), rotulo2);
// pisos C = vivienda; sólo la «C» de la b1 (F2C9) es la comunidad
const destino = (cu, f, c) => cu.filas[f - 1][c - 1].destino;
assert.deepStrictEqual([destino(b1, 1, 1), destino(b1, 1, 2), destino(b1, 2, 1), destino(b1, 2, 2), destino(b1, 2, 9)], ["V", "V", "V", "V", "C"]);
assert.ok(b2.celdas.every((c) => c.destino === "V"));
assert.strictEqual(b1.filas[1][8].abastece_a, "CDAD PROP CL DOÑA FRANCISQUITA 20");
// cada celda con los datos de SU piso+puerta (no en el orden del PDF)
const cli = (cu, f, c) => cu.filas[f - 1][c - 1].cliente;
assert.strictEqual(cli(b1, 1, 1), nombre(3, "C"));
assert.strictEqual(cli(b1, 2, 1), nombre(1, "C"));
assert.strictEqual(cli(b2, 1, 5), "SANCHEZ ALZATE, LUIS");          // 10ºC (02-13 del PDF 32269)
assert.strictEqual(cli(b2, 3, 3), "VERA DELGADO, MARIA ISABEL");    // 9ºD
assert.strictEqual(cli(b2, 3, 6), "VERA DELGADO, MARIA ISABEL");    // 6ºC: mismo titular, otra toma
assert.notStrictEqual(b2.filas[2][2].toma, b2.filas[2][5].toma);
// el 4º, en la batería 1 con los datos del PDF 32269 (correcto: el PDF es genérico)
const cuarto = b1.celdas.filter((c) => /^4º/.test(c.senal));
assert.strictEqual(cuarto.length, 4);
assert.ok(cuarto.every((c) => c.estado === "ok" && c.de_otra_bateria && c.numero_bateria_pdf === "32269"));
assert.strictEqual(cli(b1, 1, 8), "RUBIO ESPINOLA, ANA");          // 4ºD
// «casan»: 17 de 17 y 24 de 24, de verdad
assert.deepStrictEqual([b1.resumen.casan, b1.resumen.total, b2.resumen.casan, b2.resumen.total], [17, 17, 24, 24]);
// sólo el aviso de los 6 locales (Bajo 1-6), sin bloquear
assert.strictEqual(o.avisos.length, 6);
assert.ok(o.avisos.every((a) => /Bajo|Bº/.test(a) && /32268/.test(a) && /no sale en ningún rótulo/.test(a)));
assert.strictEqual(b1.errores.length + b2.errores.length, 0);
// los campos del modal y del CO 051 salen de la foto
const campos = RT.camposCuadricula(b2);
assert.deepStrictEqual([campos.toma_1_5_senal, campos.toma_1_5_destino, campos.toma_3_8_senal, campos.toma_2_14_senal], ["10ºC", "V", "8ºB", undefined]);

// ── incoherencias reales ──
// 9ºD leído como 4ºD: repetido entre los dos rótulos → bloquea; y 9ºD queda sin rótulo (aviso)
const r2mal = rotulo2.slice(); r2mal[18] = "4ºD";
const o2 = obra(rotulo1, r2mal);
assert.ok(!o2.porOrden[2].ok);
assert.match(o2.porOrden[2].filas[2][2].error, /repetida en el rótulo \(ya en batería 1, fila 1, columna 8\)/);
assert.ok(o2.avisos.some((a) => /9ºD/.test(a)));
assert.deepStrictEqual([o2.porOrden[2].resumen.casan, o2.porOrden[2].resumen.total], [23, 24]);
// un piso del rótulo que no está en ningún PDF → bloquea
const r1mal = rotulo1.slice(); r1mal[0] = "11ºC";
assert.match(obra(r1mal).porOrden[1].filas[0][0].error, /no aparece en ningún PDF de EMASESA de la obra/);
console.log(`OK relacion-tomas-dfrancisquita · b1 2×10 ${b1.resumen.casan}/${b1.resumen.total} · b2 3×8 ${b2.resumen.casan}/${b2.resumen.total} · ${o.avisos.length} avisos (locales)`);

// ── «Nº plantas» de la toma de datos del presupuesto (BAJO+10 → B+10) ──
{
  const app = { locals: {}, options() {}, get() {}, post() {} };
  require("../ara-os-fase14-presupuesto.cjs")(app);
  const P = app.locals._fase14Presupuesto;
  assert.deepStrictEqual(["BAJO+10", "PB + 10", "Bajo y 3", "B+10", "B+3+ÁTICO"].map(P.numPlantas), ["B+10", "B+10", "B+3", "B+10", "B+3+ÁTICO"]);
  const matriz = [["Nº PRESUPUESTO", "P-1"], [], [], [], ["TIPO EDIFICIO", "D", "", "Nº PLANTAS", "BAJO+10"]];
  assert.strictEqual(P.numPlantas(P.buscarEnCualquierColumna(matriz, /^n[º°o.]?\s*(de\s*)?plantas:?$/)), "B+10");
  assert.strictEqual(P.extraerDatos(matriz).emasesa.num_plantas, "B+10");
  console.log("OK Nº plantas del presupuesto (B+10)");
}

// ── rótulo frente al modelo de batería del presupuesto (21T-3F y 28T-2F): aviso, no bloquea ──
{
  const o = obra();
  assert.match(RT.avisoModeloBateria("21T-3F", o.porOrden[1], 1), /Batería 1: el rótulo es de 2×10 y el modelo de batería «21T-3F» es de 3×7/);
  assert.match(RT.avisoModeloBateria("28T-2F", o.porOrden[2], 2), /3×8 .*2×14/);
  assert.strictEqual(RT.avisoModeloBateria("20T-2F", o.porOrden[1], 1), "");
  assert.strictEqual(RT.avisoModeloBateria("", o.porOrden[1], 1), "");
  console.log("OK aviso rótulo ≠ modelo de batería");
}
