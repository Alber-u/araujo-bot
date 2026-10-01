// Test de lib/relacion-tomas.cjs con el caso real de Juan Pablos 17
// (batería 32138). PDF real en test/fixtures; las celdas del rótulo son
// las de la foto test/fixtures/jp17-rotulo.jpg (la lectura de la foto la
// hace la IA en producción; aquí se fija lo que pone físicamente).
// Uso: node lib/relacion-tomas.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const RT = require("./relacion-tomas.cjs");

const PDF_JP17 = path.join(__dirname, "..", "test", "fixtures", "jp17-relacion-tomas.pdf");
const ROTULO_JP17 = [
  "3ºB", "2ºB", "0ºB", "1ºA", "0ºA",
  "2ºA", "1ºB", "3ºA", "C",   "X",
];

// ── Normalización de señales ────────────────────────────────
const k = s => RT.claveCelda(s).clave;
assert.strictEqual(k("0ºB"), "0|B");
assert.strictEqual(k("BºB"), "0|B");
assert.strictEqual(k("Bajo B"), "0|B");
assert.strictEqual(k("B'A"), "0|A");
assert.strictEqual(k(" 3 º B "), "3|B");
assert.strictEqual(k("3B"), "3|B");
assert.strictEqual(k("1'1"), "1|1");
assert.strictEqual(k("C"), "C");
assert.strictEqual(k("CDAD"), "C");
assert.strictEqual(k("X"), "X");
assert.strictEqual(k(""), "X");
assert.strictEqual(RT.claveToma({ piso: "Bajo", puerta: "B" }).clave, "0|B");
assert.strictEqual(RT.claveToma({ piso: "Bajo", puerta: "CDAD" }).clave, "C");
assert.strictEqual(RT.claveToma({ piso: "", puerta: "", caudal: "0,00" }).clave, "X");
assert.strictEqual(RT.senalCanonica(RT.claveCelda("0ºB")), "BºB");

(async () => {
  // ── PDF EMASESA de JP17 ─────────────────────────────────────
  const rt = await RT.parsearPdfRelacionTomas(fs.readFileSync(PDF_JP17));
  assert.strictEqual(rt.metodo_tomas, "columnas");
  assert.strictEqual(rt.numero_bateria_emasesa, "32138");
  assert.strictEqual(rt.solicitud_q, "0100463641");
  assert.strictEqual(rt.suministro, "0100215316");
  assert.strictEqual(rt.ubicacion_bateria, "ARMARIO EN PATIO INTERIOR");
  assert.strictEqual(rt.caudal_total, 14);
  assert.strictEqual(rt.tomas.length, 10);

  const porToma = Object.fromEntries(rt.tomas.map(t => [t.toma, t]));
  assert.deepStrictEqual(
    rt.tomas.map(t => [t.toma, t.piso, t.puerta, t.ampliacion, t.caudal, t.cliente]),
    [
      ["01-01", "Bajo", "A", "", "1,70", "DOMINGUEZ DOMINGUEZ ADAME,MARÍA"],
      ["01-02", "Bajo", "B", "", "1,70", "POLO GARRIDO,DANIEL"],
      ["01-03", "1º", "A", "", "1,70", "TRAVADO MUÑOYERRO,SARA"],
      ["01-04", "1º", "B", "", "1,70", "JIMENEZ PORTILLO,JUAN ANTONIO"],
      ["01-05", "2º", "A", "", "1,70", "LUQUE CASTRO,ANTONIO"],
      ["02-01", "2º", "B", "", "1,70", "MARCELLAN CRESPO,CLARA EUGENIA"],
      ["02-02", "3º", "A", "UNIDO AL PISO 3ºB", "1,70", "BOHM FONT,MARGARITA"],
      ["02-03", "3º", "B", "UNIDO AL PISO 3ºA", "1,70", ""],
      ["02-04", "Bajo", "CDAD", "", "0,40", "CDAD PROP CL JUAN PABLOS 17"],
      ["02-05", "", "", "", "0,00", ""],
    ]
  );
  assert.strictEqual(porToma["02-02"].puerta, "A");
  assert.strictEqual(porToma["02-03"].puerta, "B");

  // El parser de texto (respaldo) tampoco debe pegar la ampliación a la puerta
  const pdfParse = require("pdf-parse");
  const txt = RT.parsearTextoEmasesa((await pdfParse(fs.readFileSync(PDF_JP17))).text);
  const t0202 = txt.tomas.find(t => t.toma === "02-02");
  assert.strictEqual(t0202.puerta, "A");
  assert.strictEqual(t0202.ampliacion, "UNIDO AL PISO 3ºB");

  // ── Cuadrícula = la foto ────────────────────────────────────
  const cu = RT.montarCuadricula({ celdas: ROTULO_JP17, numFilas: 2, numCols: 5, tomas: rt.tomas });
  assert.deepStrictEqual(cu.errores, []);
  assert.strictEqual(cu.ok, true);
  const pinta = cu.filas.map(f => f.map(c => `${c.senal} ${c.destino} ${c.caudal}`).join(" | "));
  assert.deepStrictEqual(pinta, [
    "3ºB V 1,70 | 2ºB V 1,70 | BºB V 1,70 | 1ºA V 1,70 | BºA V 1,70",
    "2ºA V 1,70 | 1ºB V 1,70 | 3ºA V 1,70 | C C 0,40 | X X 0,00",
  ]);
  assert.strictEqual(cu.caudal_total, "14,00");
  assert.strictEqual(cu.filas[0][0].cliente, "");                    // 3ºB, unido al 3ºA
  assert.strictEqual(cu.filas[1][2].cliente, "BOHM FONT,MARGARITA"); // 3ºA
  assert.strictEqual(cu.filas[1][0].toma, "01-05");                  // 2ºA

  // "Abastece a": sin cliente → la ampliación tal cual
  assert.strictEqual(cu.filas[0][0].abastece_a, "UNIDO AL PISO 3ºA");      // 3ºB (02-03)
  assert.strictEqual(cu.filas[1][2].abastece_a, "BOHM FONT,MARGARITA");    // 3ºA
  assert.strictEqual(cu.filas[1][3].abastece_a, "CDAD PROP CL JUAN PABLOS 17");
  // Tomas guardadas antes del parser por columnas (ampliación pegada a la puerta)
  const legacy = rt.tomas.map(t => t.ampliacion ? { ...t, puerta: `${t.puerta} ${t.ampliacion}`, ampliacion: undefined } : t);
  const cuLegacy = RT.montarCuadricula({ celdas: ROTULO_JP17, numFilas: 2, numCols: 5, tomas: legacy });
  assert.strictEqual(cuLegacy.ok, true);
  assert.strictEqual(cuLegacy.filas[0][0].abastece_a, "UNIDO AL PISO 3ºA");
  assert.strictEqual(cuLegacy.filas[0][0].puerta, "B");
  // Vivienda sin cliente ni ampliación → error (no se deja en blanco)
  const sinNombre = rt.tomas.map(t => t.toma === "01-04" ? { ...t, cliente: "" } : t);  // 1ºB
  const cuSin = RT.montarCuadricula({ celdas: ROTULO_JP17, numFilas: 2, numCols: 5, tomas: sinNombre });
  assert.strictEqual(cuSin.ok, false);
  assert.strictEqual(cuSin.filas[1][1].estado, "error");
  assert.match(cuSin.filas[1][1].error, /1ºB.*no tiene cliente ni ampliación.*Tomas · vecinos/);
  // ...y se resuelve escribiendo el nombre a mano (campo `nombre` del modal)
  assert.strictEqual(RT.abasteceA({ cliente: "", nombre: "PEREZ,LUIS" }), "PEREZ,LUIS");

  const campos = RT.camposCuadricula(cu);
  assert.strictEqual(campos.toma_1_1_senal, "3ºB");
  assert.strictEqual(campos.toma_2_1_senal, "2ºA");
  assert.strictEqual(campos.toma_2_4_destino, "C");
  assert.strictEqual(campos.toma_3_1_senal, "");

  // ── No inventar: celda sin pareja, duplicada o toma sin colocar ──
  const mal = RT.montarCuadricula({
    celdas: ["3ºB", "2ºB", "0ºB", "1ºA", "0ºA", "2ºA", "1ºB", "3ºB", "C", "4ºA"],
    numFilas: 2, numCols: 5, tomas: rt.tomas,
  });
  assert.strictEqual(mal.ok, false);
  assert.strictEqual(mal.filas[1][2].estado, "error");   // 3ºB repetida
  assert.match(mal.filas[1][2].error, /repetida/);
  assert.strictEqual(mal.filas[1][4].estado, "error");   // 4ºA no existe
  assert.match(mal.filas[1][4].error, /no aparece en el PDF/);
  assert.deepStrictEqual(mal.tomas_sin_colocar.map(t => t.toma), ["02-02"]); // 3ºA sin colocar

  const sinFoto = RT.montarCuadricula({ celdas: [], numFilas: 0, numCols: 0, tomas: rt.tomas });
  assert.strictEqual(sinFoto.ok, false);
  assert.strictEqual(sinFoto.sin_rotulo, true);

  console.log("OK relacion-tomas (JP17)");
})().catch(err => { console.error(err); process.exit(1); });
