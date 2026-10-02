// Test de lib/etiquetas-obra.cjs (fusión de tags en holded_etiquetas).
// Uso: node lib/etiquetas-obra.test.cjs
const assert = require("assert");
const E = require("./etiquetas-obra.cjs");

const HOY = { hoyISO: "2026-10-02", hoyCorta: "02/10/2026" };
const MANDARINAS = {
  obra_id: "ccpp_mandarinas_2_174b80",
  etiqueta_holded: "o25ara00087_plan_cinco_ccpp_mandarinas_2_g|o25ara00087plancincoccppmandarinas2g",
  nombre_comunidad: "Mandarinas 2",
  tipo_obra: "plan5",
  fecha_asignacion: "2026-06-01",
  activa: "TRUE",
  notas: "dos variantes de Holded",
};

// Parse / serialize
assert.deepStrictEqual(E.parseTagsCSV(" a | b,c ; d "), ["a", "b", "c", "d"]);
assert.deepStrictEqual(E.parseTagsCSV(""), []);
assert.strictEqual(E.serializeTagsCSV([" a", "", "b "]), "a|b");
assert.strictEqual(E.tipoObraPorId("ccpp_x"), "plan5");
assert.strictEqual(E.tipoObraPorId("OO-12"), "otras");
assert.match(E.fechaCorta(new Date("2026-10-02T10:00:00Z")), /^02\/10\/2026$/);

// Obra sin fila → se crea activa
let r = E.fusionarEtiquetasEnFila(null, { obra_id: "ccpp_prueba_1_abc123", tags: "plancincoccppprueba1", nombre_comunidad: "Prueba 1", ...HOY });
assert.strictEqual(r.accion, "creada");
assert.deepStrictEqual(r.fila, {
  obra_id: "ccpp_prueba_1_abc123", etiqueta_holded: "plancincoccppprueba1", nombre_comunidad: "Prueba 1",
  tipo_obra: "plan5", fecha_asignacion: "2026-10-02", activa: "TRUE", notas: "tag añadido desde ficha 02/10/2026",
});

// Mandarinas 2: añadir uno nuevo NO borra las dos variantes; no toca nombre/tipo/notas previas
r = E.fusionarEtiquetasEnFila(MANDARINAS, { obra_id: MANDARINAS.obra_id, tags: "nuevo_tag_mandarinas", ...HOY });
assert.strictEqual(r.accion, "añadida");
assert.deepStrictEqual(r.etiquetas, [
  "o25ara00087_plan_cinco_ccpp_mandarinas_2_g", "o25ara00087plancincoccppmandarinas2g", "nuevo_tag_mandarinas",
]);
assert.strictEqual(r.fila.nombre_comunidad, "Mandarinas 2");
assert.strictEqual(r.fila.tipo_obra, "plan5");
assert.strictEqual(r.fila.fecha_asignacion, "2026-06-01");
assert.strictEqual(r.fila.notas, "dos variantes de Holded · tag añadido desde ficha 02/10/2026");

// Duplicado (mayúsculas distintas) → no cambia nada
r = E.fusionarEtiquetasEnFila(MANDARINAS, { obra_id: MANDARINAS.obra_id, tags: "O25ARA00087PLANCINCOCCPPMANDARINAS2G", ...HOY });
assert.strictEqual(r.accion, "ya_estaba");
assert.strictEqual(r.fila, MANDARINAS);

// Fila inactiva con el tag → se reactiva sin duplicar
r = E.fusionarEtiquetasEnFila({ ...MANDARINAS, activa: "FALSE" }, { obra_id: MANDARINAS.obra_id, tags: "o25ara00087plancincoccppmandarinas2g", ...HOY });
assert.strictEqual(r.accion, "reactivada");
assert.strictEqual(r.fila.activa, "TRUE");
assert.strictEqual(r.fila.etiqueta_holded, MANDARINAS.etiqueta_holded);

// Fila existente vacía (activa FALSE, sin tags) → añade y activa
r = E.fusionarEtiquetasEnFila({ obra_id: "x", etiqueta_holded: "", activa: "FALSE", notas: "" }, { obra_id: "x", tags: ["t1", "t1", "T1", "t2"], ...HOY });
assert.strictEqual(r.accion, "añadida");
assert.strictEqual(r.fila.etiqueta_holded, "t1|t2");
assert.strictEqual(r.fila.activa, "TRUE");

console.log("OK etiquetas-obra");
