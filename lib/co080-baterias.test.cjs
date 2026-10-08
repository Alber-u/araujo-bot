// 08/10/2026 · Mandarinas 2 (2 baterías): un CO 080 por batería, cada uno con los datos de la suya.
// Uso: node lib/co080-baterias.test.cjs
const assert = require("assert");
const C = require("./co080-baterias.cjs");

const pequena = { bateria_orden: "2", bateria_marca: "10T-2F", bateria_emplazamiento: "OT", bateria_num_filas: "2", bateria_num_columnas: "5",
  caudal_instalado: "8,8", num_plantas: "B+3", altura: "12", llave_toma: "AL INICIO/BATERIA", tiene_grupo_presion: "si", grupo_emplazamiento: "NO NECESITA",
  montante_material: "PERT", montante_diametro: "25", tubo_material: "PE", tubo_diametro: "75", tubo_trazado: "ENTERRADO", registro_1: "R-123", numero_edificio: "2" };
const grande = { bateria_orden: "3", bateria_marca: "", bateria_emplazamiento: "CUARTO G.PRESION", bateria_num_filas: "2", bateria_num_columnas: "8", caudal_instalado: "22,4" };
const baterias = [pequena, grande];

// cada uno con lo de su batería; lo de la obra, repetido
const t2 = C.tecnicosCO080(pequena, baterias), t3 = C.tecnicosCO080(grande, baterias);
assert.deepStrictEqual([t2.bateria_marca, t2.bateria_num_columnas, t2.caudal_instalado, t2.bateria_emplazamiento], ["10T-2F", "5", "8,8", "OT"]);
assert.deepStrictEqual([t3.bateria_num_columnas, t3.caudal_instalado, t3.bateria_emplazamiento], ["8", "22,4", "CUARTO G.PRESION"]);
assert.deepStrictEqual([t3.registro_1, t3.tubo_material, t3.tubo_diametro, t3.tubo_trazado, t3.numero_edificio], ["R-123", "PE", "75", "ENTERRADO", "2"]);
assert.deepStrictEqual([t2.num_baterias, t3.num_baterias], ["2", "2"]);
// los de batería NO se copian de la otra (marca, plantas, montante: se avisa)
assert.deepStrictEqual([t3.bateria_marca, t3.num_plantas, t3.montante_material], ["", undefined, undefined]);
assert.deepStrictEqual(C.camposFaltanCO080(t2), []);
assert.deepStrictEqual(C.camposFaltanCO080(t3), ["marca", "nº plantas", "material del montante", "diámetro del montante"]);
// una sola batería: sin cambios (su nº de baterías si lo tenía)
assert.strictEqual(C.tecnicosCO080({ ...pequena, num_baterias: "1" }, [{ ...pequena, num_baterias: "1" }]).num_baterias, "1");
assert.strictEqual(C.tecnicosCO080({ ...pequena, num_baterias: "" }, [pequena]).num_baterias, "1");
// (08/10/2026) casillas vacías o con el dato de otro campo: aviso por batería antes de generar (todas las obras)
const completa = { ...pequena, bateria_material: "PPR", conexion_general_loc: "FACHADA", tubo_llave_general_situacion: "EN FACHADA", acometida_diametro: "63",
  bateria_emplazamiento: "CUARTO G.PRESION", nif_titular: "H41000000" };
assert.deepStrictEqual(C.camposFaltanCertificados(completa), []);
// como salió el b2: «OT» de emplazamiento, sin material de batería, sin localización, sin llave, sin acometida, sin NIF
assert.deepStrictEqual(C.camposFaltanCertificados(pequena), ["NIF de la comunidad (titular)", "emplazamiento de la batería (no vale «OT»)",
  "material de la batería (CO 080)", "localización de conexión general (CO 080)", "situación de la llave general (CO 051)", "Ø de acometida (CO 051)"]);
// el CIF de la orden de trabajo vale como NIF de la comunidad
assert.ok(!C.camposFaltanCertificados({ ...completa, nif_titular: "" }, { cifObra: "H41000000" }).length);
// con varias baterías, además los del CO 080 de cada una
assert.deepStrictEqual(C.camposFaltanCertificados({ ...completa, bateria_marca: "" }, { varias: true }), ["marca"]);
assert.ok(C.emplazamientoValido("CUARTO G.PRESION") && !C.emplazamientoValido("OT") && !C.emplazamientoValido(" o.t. ") && !C.emplazamientoValido(""));
console.log("OK co080-baterias (un CO 080 por batería, datos de obra repetidos, obligatorios por batería)");
