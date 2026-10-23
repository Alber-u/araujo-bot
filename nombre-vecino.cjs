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
module.exports = { saludoVecino, titularesDeNota, mismaPersona };
