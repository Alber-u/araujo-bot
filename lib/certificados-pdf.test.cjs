// 23/10/2026 · Segunda vuelta de certificados EMASESA (Doña Francisquita 20, probado en producción por Alberto):
//   1 · CO 051 «Caudal total instalado» = suma de la cuadrícula del rótulo, no el del PDF de EMASESA
//   2 · Nº plantas = el valor de DEBAJO de «No PLANTAS» en la toma de datos (BAJO+10 → B+10), nunca otra etiqueta
//   4 · forma de abastecimiento vacía (o un valor que el modal enseña como «—») no marca nada
//   5 · CO 080: el bloque TOMA DE BATERÍA va vacío en el alta de una batería nueva («ERADO LATER»)
//   6 · firma de la propiedad sin la vivienda entre paréntesis («… VACARO (4A»)
// Genera los PDF de verdad (sin Drive ni hojas). Uso: node lib/certificados-pdf.test.cjs
const assert = require("assert");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const RT = require("./relacion-tomas.cjs");

const app = { locals: {}, options() {}, get() {}, post() {}, put() {}, delete() {}, use() {} };
require("../ara-os-fase14-certificados.cjs")(app);
require("../ara-os-fase14-presupuesto.cjs")(app);
const G = app.locals._fase14Cert, P = app.locals._fase14Presupuesto;

const texto = async (bytes) => (await require("pdf-parse")(Buffer.from(bytes))).text;

(async () => {
  const com = { comunidad: "Doña Francisquita 20", direccion: "CALLE DOÑA FRANCISQUITA, 20", presidente: "Mª ANGELES MARQUEZ VACARO (4A)" };
  const titular = { cp: "41007" };
  // una batería pequeña: 1ºA, 1ºB, 1ºC (vivienda puerta C) y la comunidad; el PDF de EMASESA trae otro caudal total
  const tomas = [
    { toma: "01-01", piso: "1º", puerta: "A", caudal: "1,40", cliente: "UNO, A" },
    { toma: "01-02", piso: "1º", puerta: "B", caudal: "1,40", cliente: "UNO, B" },
    { toma: "01-03", piso: "1º", puerta: "C", caudal: "1,40", cliente: "UNO, C" },
    { toma: "01-04", piso: "Bajo", puerta: "CDAD", caudal: "0,40", cliente: "CDAD PROP CL DOÑA FRANCISQUITA 20" },
  ];
  const em = { bateria_numero: "32268", suministro: "0100563544", caudal_total: 19.6, tomas, rotulo_celdas: ["1ºA", "1ºB", "1ºC", "C"], rotulo_num_filas: 2, rotulo_num_cols: 2 };
  const cu = RT.montarCuadriculasObra([{ orden: 1, numero_bateria: "32268", celdas: em.rotulo_celdas, numFilas: 2, numCols: 2, tomas }]).porOrden[1];
  assert.ok(cu.ok, cu.errores.join(" | "));
  assert.strictEqual(cu.caudal_total, "4,60");
  const tec = { bateria_orden: "1", _indice_bateria: 1, _cuadricula: cu, tipo_actuacion: "nueva", forma_abastecimiento: "",
    tubo_llave_general_situacion: "ACERADO LATERAL", tubo_valvula_retencion: "SI", tubo_llave_general: "ESFERA", montante_material: "PERT", montante_diametro: "25",
    caudal_simultaneo: "3,2", bateria_marca: "4T-2F", bateria_num_filas: "2", bateria_num_columnas: "2", caudal_instalado: "4,6", num_plantas: "B+10" };

  // ── 1 · CO 051: caudal total = el de la cuadrícula (4,6), no el del PDF (19,6) ──
  const rel = await G.generarRelacionTomas(com, titular, tec, em, { celdas: em.rotulo_celdas, numFilas: 2, numCols: 2 });
  const tRel = await texto(rel);
  assert.ok(/\b4,6\b/.test(tRel) && !/19,6/.test(tRel), "caudal total del CO 051");
  // ── 6 · firma sin «(4A)» ──
  assert.ok(tRel.includes("Mª ANGELES MARQUEZ VACARO") && !/\(4A/.test(tRel), "firma del CO 051");
  assert.strictEqual(G.nombreFirma("Mª Angeles Marquez Vacaro (4A"), "Mª ANGELES MARQUEZ VACARO");
  assert.strictEqual(G.nombreFirma("JUAN PÉREZ"), "JUAN PÉREZ");
  const t073 = await texto(await G.generarCO073(com, titular, tec, em));
  assert.ok(!/\(4A/.test(t073), "firma del CO 073");

  // ── 4 y 5 · CO 080 ──
  const leer = async (t) => (await PDFDocument.load(await G.generarCO080(com, titular, t))).getForm();
  let f = await leer(tec);
  assert.ok(!f.getCheckBox("Aljibe").isChecked() && !f.getCheckBox("Directa").isChecked(), "forma vacía: nada");
  for (const k of ["Llave General", "V retención", "Llave", "Montante", "Q simultáneo 9", "N batería", "toma Fila", "toma Columna"]) assert.strictEqual(f.getTextField(k).getText() || "", "", k);
  assert.deepStrictEqual(["Marca", "num Filas", "N columnas", "Q Instalado", "N de Plantas"].map((k) => f.getTextField(k).getText()), ["4T-2F", "2", "2", "4,6", "B+10"]);
  f = await leer({ ...tec, forma_abastecimiento: "depósito" });   // el modal lo enseña como «—»
  assert.ok(!f.getCheckBox("Aljibe").isChecked());
  f = await leer({ ...tec, forma_abastecimiento: "deposito" });
  assert.ok(f.getCheckBox("Aljibe").isChecked());
  f = await leer({ ...tec, forma_abastecimiento: "directa" });
  assert.ok(f.getCheckBox("Directa").isChecked() && !f.getCheckBox("Aljibe").isChecked());
  // alta de una toma en una batería existente («ampliacion»): el bloque sí se rellena
  f = await leer({ ...tec, tipo_actuacion: "ampliacion", llave_toma: "ESCUADRA" });
  assert.deepStrictEqual(["Llave General", "Montante"].map((k) => f.getTextField(k).getText()), ["ESCUADRA", "PERT 25"]);
  for (const campo of f.getFields()) assert.ok(!/ACERADO/.test(campo.getText?.() || ""), `«Situación llave general» en ${campo.getName()}`);

  // ── 2 · Nº plantas: la fila real de Doña Francisquita 20 ──
  const re = /^n[º°o.]?\s*(de\s*)?plantas:?$/;
  const francisquita = [["Nº PRESUPUESTO", "P-1"], [], [], [], ["TIPO EDIFICIO", "D", "No PLANTAS", "No SUMINISTROS", "41 suministros"], ["", "", "BAJO+10", "41", ""]];
  assert.strictEqual(P.numPlantas(P.buscarEnCualquierColumna(francisquita, re, P.esPlantas)), "B+10");
  assert.strictEqual(P.extraerDatos(francisquita).emasesa.num_plantas, "B+10");
  // sin valor válido debajo ni a la derecha: vacío (y el modal avisa), nunca «Nº SUMINISTROS»
  const sinValor = [[], [], [], [], ["No PLANTAS", "No SUMINISTROS", "41 suministros"], ["", "41", ""]];
  assert.strictEqual(P.extraerDatos(sinValor).emasesa.num_plantas, "");
  assert.ok(P.extraerDatos(sinValor).meta.lista_faltantes.includes("num_plantas"));
  assert.deepStrictEqual(["BAJO+10", "PB + 10", "Bajo y 3", "B+3+ÁTICO", "No SUMINISTROS", "41", ""].map(P.numPlantas), ["B+10", "B+10", "B+3", "B+3+ÁTICO", "", "", ""]);

  console.log("OK certificados-pdf (CO 051 caudal del rótulo, Nº plantas B+10, forma de abastecimiento, bloque toma de batería, firma)");
})().catch((e) => { console.error(e); process.exit(1); });
