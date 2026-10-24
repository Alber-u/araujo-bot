// v161 (23/10/2026, criterio de Guille: "¿ponemos a los dos? ... Hola David (Titular - Enrique José Pérez de la Rosa Ruiz)";
//   "y con usufructo... y con empresa?" -> una sola regla para todos los tipos) -- nombre con el que se saluda al vecino
//   en TODO lo que sale a su nombre (avisos M, Pedir contacto, presentacion, recordatorios del bot):
//   - el de arriba (pisos col E, quien tiene el telefono) y, si NO es el titular, el titular de la Nota simple entre
//     parentesis: "David (Titular - Enrique José Pérez de la Rosa Ruiz y otros)" ("y otros" si hay varios titulares);
//   - si el de arriba es el titular (o uno de ellos): solo su nombre;
//   - sin nombre arriba: el primer titular; sin Nota simple (o es una anotacion): el de arriba.
//   Lo usan presupuestos.cjs (_p5NombreDirigido) y bot-whatsapp.cjs (nombreParaPiso): una sola fuente.
"use strict";
const _norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-zñ0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function titularesDeNota(nota) {
  return String(nota || "").split("/").map((n) => n.replace(/^\s*\([^)]*\)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+/g, " ").trim())
    .filter((n) => n.length >= 3 && !/^(mismo|misma|piso|pte|pendiente|sin|ver|no )/i.test(n));
}
// mismo nombre: todas las palabras del mas corto estan en el mas largo ("Carlos Blanco" = "Carlos Blanco Molina")
function mismaPersona(a, b) {
  const wa = _norm(a).split(" ").filter((w) => w.length > 1), wb = _norm(b).split(" ").filter((w) => w.length > 1);
  if (!wa.length || !wb.length) return false;
  const [c, l] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return c.every((w) => l.includes(w));
}
function saludoVecino(nota, nombre) {
  const nb = String(nombre || "").replace(/^\s*(\([^)]*\)\s*)+/, "").replace(/\s+/g, " ").trim();
  const tit = titularesDeNota(nota);
  if (!tit.length) return nb;
  if (!nb) return tit[0];
  if (tit.some((t) => mismaPersona(nb, t))) return nb;
  return nb + " (Titular - " + tit[0] + (tit.length > 1 ? " y otros" : "") + ")";
}
// v170 (24/10/2026, criterio de Guille: "Nota simple (titular distinto)... lo que queremos es preguntarle por qué en la
//   nota simple viene un titular distinto") -- respuesta tipo de WhatsApp (boton "Respuestas tipo" de Contestar por el bot).
//   Rellena {nombre} (el de arriba, pisos col E), {titulares} (los de la Nota simple: "A", "A y B", "A, B y C") y
//   {con_quien} ("ellos" si son varios, "esa persona" si es uno: asi no hay que adivinar si es hombre o mujer).
//   Lo que no se sabe sale entre corchetes para que lo escriba Guille.
const RESP_NOTA_SIMPLE = "Buenas {nombre}, gracias por la documentaci\u00f3n. Revis\u00e1ndola hemos visto que, seg\u00fan la Nota simple, la vivienda figura a nombre de {titulares}. \u00bfNos puede explicar qu\u00e9 relaci\u00f3n tiene usted con {con_quien}? Seg\u00fan lo que nos diga, le indicaremos qu\u00e9 documentaci\u00f3n hace falta. Muchas gracias.";
function rellenarRespuestaTipo(plantilla, nota, nombre) {
  const nb = String(nombre || "").replace(/^\s*(\([^)]*\)\s*)+/, "").replace(/\s+/g, " ").trim();
  const tit = titularesDeNota(nota);
  const lista = !tit.length ? "[titulares]" : (tit.length === 1 ? tit[0] : tit.slice(0, -1).join(", ") + " y " + tit[tit.length - 1]);
  const conQuien = !tit.length ? "[ellos / esa persona]" : (tit.length > 1 ? "ellos" : "esa persona");
  return String(plantilla || "").replace(/\{nombre\}/g, nb || "[nombre]").replace(/\{titulares\}/g, lista).replace(/\{con_quien\}/g, conQuien);
}
module.exports = { saludoVecino, titularesDeNota, mismaPersona, rellenarRespuestaTipo, RESP_NOTA_SIMPLE };
