// 08/10/2026 · Certificados EMASESA de Mandarinas 2: el rótulo físico se escribe «2-A» y el PDF de EMASESA «2º A».
// Antes no casaba ninguna celda y las listas de vecinos salían en el orden del PDF, con el destino cruzado por número
// de toma (al 3ºB le caía la C de la comunidad). Ahora: clave común y lista en el orden de la cuadrícula.
// Uso: node lib/relacion-tomas-mandarinas.test.cjs
const assert = require("assert");
const RT = require("./relacion-tomas.cjs");

// ── 1 · Normalizador: la misma clave para todas las formas de escribir un piso ──
const c = (s) => RT.claveComun(s);
for (const s of ["2-A", "2ºA", "2º A", "2.A", "2/A", "2_A", " 2 - a ", "2A", "2'A"]) assert.strictEqual(c(s), "2A", s);
for (const s of ["0-A", "B-A", "BAJO A", "Bajo A", "0ºA", "BºA", "B A", "BJ-A"]) assert.strictEqual(c(s), "BAJOA", s);
for (const s of ["C", "CDAD", "COM", "COMUNIDAD", "Cdad"]) assert.strictEqual(c(s), "COMUNIDAD", s);
for (const s of ["X", "-", "", "LIBRE"]) assert.strictEqual(c(s), "LIBRE", s);
assert.strictEqual(c("11-B"), "11B");
assert.strictEqual(c("10-A"), "10A");
// el PDF, a la misma clave
assert.strictEqual(RT.claveComun(RT.claveToma({ piso: "2º", puerta: "A" })), "2A");
assert.strictEqual(RT.claveComun(RT.claveToma({ piso: "Bajo", puerta: "A" })), "BAJOA");
assert.strictEqual(RT.claveComun(RT.claveToma({ piso: "Bajo", puerta: "CDAD", cliente: "CDAD PROP CL MANDARINA 2" })), "COMUNIDAD");
// toma libre de relleno en el PDF («Bajo · 1 · 0,00» sin vecino, o «APELLIDO, NOMBRE»): libre
assert.strictEqual(RT.claveComun(RT.claveToma({ piso: "Bajo", puerta: "1", caudal: "0,00", cliente: "" })), "LIBRE");
assert.strictEqual(RT.claveComun(RT.claveToma({ piso: "Bajo", puerta: "1", caudal: "0,00", cliente: "APELLIDO, NOMBRE" })), "LIBRE");

// ── 2 · Mandarinas 2, batería 1 ──
// PDF «RT MANDARINA» (orden y numeración del PDF: por piso y puerta)
const tomasB1 = [
  ["01-01", "1º", "A", "1,40", "ROMERO LUNA,MARÍA DEL CARMEN"], ["01-02", "1º", "B", "1,40", "GONZÁLEZ GARCÍA,CARLOS FRANCISCO"],
  ["01-03", "2º", "A", "1,40", "IBÁÑEZ MÁRQUEZ,ISABEL"], ["01-04", "2º", "B", "1,40", "ANTRAS FRANCO,MARÍA TERESA"],
  ["01-05", "3º", "A", "1,40", "OSUNA GARCÍA,JOSÉ ANTONIO"], ["02-01", "3º", "B", "1,40", "ZUNINO LÓPEZ,ELISA ISABEL"],
  ["02-02", "Bajo", "CDAD", "0,40", "CDAD PROP CL MANDARINA 2"],
  ["02-03", "Bajo", "1", "0,00", ""], ["02-04", "", "", "0,00", ""], ["02-05", "", "", "0,00", ""],
].map(([toma, piso, puerta, caudal, cliente]) => ({ toma, piso, puerta, caudal, cliente, calibre: "15" }));
// rótulo (la foto): con guion, como se escribe en la batería
const rotuloB1 = ["2-A", "3-A", "3-B", "2-B", "1-B", "C", "1-A", "X", "X", "X"];
const cu1 = RT.montarCuadricula({ celdas: rotuloB1, numFilas: 2, numCols: 5, tomas: tomasB1 });
assert.ok(cu1.ok, cu1.errores.join(" · "));
assert.deepStrictEqual(cu1.resumen, { casan: 7, total: 7, sin_colocar: 0 });
assert.deepStrictEqual(cu1.lista.map((r) => [r.toma, r.piso, r.puerta, r.destino, r.caudal, r.cliente]), [
  ["01-01", "2º", "A", "V", "1,40", "IBÁÑEZ MÁRQUEZ,ISABEL"],
  ["01-02", "3º", "A", "V", "1,40", "OSUNA GARCÍA,JOSÉ ANTONIO"],
  ["01-03", "3º", "B", "V", "1,40", "ZUNINO LÓPEZ,ELISA ISABEL"],
  ["01-04", "2º", "B", "V", "1,40", "ANTRAS FRANCO,MARÍA TERESA"],
  ["01-05", "1º", "B", "V", "1,40", "GONZÁLEZ GARCÍA,CARLOS FRANCISCO"],
  ["02-01", "Bajo", "CDAD", "C", "0,40", "CDAD PROP CL MANDARINA 2"],
  ["02-02", "1º", "A", "V", "1,40", "ROMERO LUNA,MARÍA DEL CARMEN"],
  ["02-03", "", "", "X", "0,00", ""], ["02-04", "", "", "X", "0,00", ""], ["02-05", "", "", "X", "0,00", ""],
]);
// los campos de la cuadrícula del CO 073: 02-01 = comunidad, 01-03 = 3ºB vivienda
const campos = RT.camposCuadricula(cu1);
assert.deepStrictEqual([campos.toma_2_1_senal, campos.toma_2_1_destino, campos.toma_1_3_senal, campos.toma_1_3_destino], ["C", "C", "3ºB", "V"]);
// 6 viviendas × 1,40 + comunidad 0,40
assert.strictEqual(cu1.caudal_total, "8,80");
// ediciones a mano guardadas con la numeración vieja (la del PDF, y el destino cruzado: 02-01 3ºB «C», 02-02 CDAD «V"):
// se aplican por piso+puerta, el nombre sí; el destino de una vivienda nunca pasa a C ni el de la comunidad a V
const editadas = [{ toma: "02-01", piso: "3º", puerta: "B", destino: "C", caudal: "1,40", cliente: "ZUNINO LÓPEZ, ELISA" },
  { toma: "02-02", piso: "Bajo", puerta: "CDAD", destino: "V", caudal: "0,40", cliente: "CDAD PROP CL MANDARINA 2" },
  { toma: "02-03", piso: "Bajo", puerta: "1", destino: "X", caudal: "0,00", cliente: "APELLIDO, NOMBRE" }];
const cuE = RT.montarCuadricula({ celdas: rotuloB1, numFilas: 2, numCols: 5, tomas: RT.aplicarEdiciones(tomasB1, editadas) });
assert.ok(cuE.ok, cuE.errores.join(" · "));
assert.deepStrictEqual(cuE.lista.slice(0, 7).map((r) => [r.toma, r.senal, r.destino, r.cliente]).filter((r) => ["01-03", "02-01"].includes(r[0])),
  [["01-03", "3ºB", "V", "ZUNINO LÓPEZ, ELISA"], ["02-01", "C", "C", "CDAD PROP CL MANDARINA 2"]]);
assert.deepStrictEqual(cuE.lista.slice(7).map((r) => r.cliente), ["", "", ""]);
// un número de toma que en el PDF es otro piso no se cruza: «01-01» editado como 1ºA no toca al 2ºA de la cuadrícula
const cuN = RT.montarCuadricula({ celdas: rotuloB1, numFilas: 2, numCols: 5, tomas: RT.aplicarEdiciones(tomasB1, [{ toma: "01-01", piso: "1º", puerta: "A", cliente: "ROMERO LUNA, M. CARMEN" }]) });
assert.deepStrictEqual([cuN.lista[0].cliente, cuN.lista[6].cliente], ["IBÁÑEZ MÁRQUEZ,ISABEL", "ROMERO LUNA, M. CARMEN"]);

// ── 3 · Mandarinas 2, batería 2 (16 viviendas, 4ºA-11ºB, 2 × 8; sin comunidad en el rótulo ni en el PDF) ──
const pisosB2 = [];
for (let p = 4; p <= 11; p++) for (const pu of ["A", "B"]) pisosB2.push([p, pu]);
const tomasB2 = pisosB2.map(([p, pu], i) => ({ toma: `${String(Math.floor(i / 8) + 1).padStart(2, "0")}-${String((i % 8) + 1).padStart(2, "0")}`, piso: `${p}º`, puerta: pu, caudal: "1,40", cliente: `VECINO ${p}${pu}`, calibre: "15" }));
const rotuloB2 = ["8-A", "9-A", "11-A", "5-A", "11-B", "9-B", "7-B", "5-B", "7-A", "10-A", "4-A", "6-A", "10-B", "8-B", "6-B", "4-B"];
const cu2 = RT.montarCuadricula({ celdas: rotuloB2, numFilas: 2, numCols: 8, tomas: tomasB2 });
assert.ok(cu2.ok, cu2.errores.join(" · "));
assert.deepStrictEqual(cu2.resumen, { casan: 16, total: 16, sin_colocar: 0 });
assert.deepStrictEqual(cu2.lista.map((r) => `${r.toma} ${r.senal} ${r.cliente}`), rotuloB2.map((s, i) => {
  const [p, pu] = s.split("-");
  return `${String(Math.floor(i / 8) + 1).padStart(2, "0")}-${String((i % 8) + 1).padStart(2, "0")} ${p}º${pu} VECINO ${p}${pu}`;
}));
assert.strictEqual(cu2.lista[0].toma + " " + cu2.lista[0].senal, "01-01 8ºA");
assert.strictEqual(cu2.lista[15].toma + " " + cu2.lista[15].senal, "02-08 4ºB");
assert.ok(cu2.lista.every((r) => r.destino === "V"));   // la comunidad no se inventa
assert.strictEqual(cu2.caudal_total, "22,40");

// ── 4 · El aviso, corto: «Batería 1: 0 de 7 casan» (con la clave vieja no casaba nada) ──
const mal = RT.montarCuadricula({ celdas: ["2-A", "3-A", "3-B", "2-B", "1-B", "C", "1-A", "X", "X", "X"], numFilas: 2, numCols: 5,
  tomas: tomasB1.map((t) => (t.piso && t.puerta !== "CDAD" && t.caudal !== "0,00" ? { ...t, piso: `${parseInt(t.piso, 10) + 10}º` } : t)) });
assert.strictEqual(RT.textoResumen(mal, 1), "Batería 1: 1 de 7 casan · 6 tomas del PDF sin colocar");
assert.ok(!mal.ok);

console.log("OK relacion-tomas-mandarinas (normalizador, 2 baterías, ediciones por piso+puerta, aviso corto)");
