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
// v172 (24/10/2026, criterio de Guille: "no lo pongas todo apegotonado... que si no parece eso una pelota que nadie lee")
//   -- con una linea en blanco entre cada parte.
// v174 (24/10/2026, criterio de Guille: "menos tirante, menos inquisitiva") -- la pregunta da pistas para contestar
//   (familiar, heredero, inquilino o compra reciente) y, si el titular es una SOCIEDAD (S.L., S.A., ...), otra
//   pregunta: administrador o representante de la sociedad, o inquilino (plantilla aparte).
const RESP_NOTA_SIMPLE = "Buenas {nombre},\n\nGracias por la documentaci\u00f3n. Revis\u00e1ndola hemos visto que, seg\u00fan la Nota simple, la vivienda figura a nombre de {titulares}.\n\n\u00bfNos podr\u00eda comentar si es usted familiar suyo, heredero, inquilino o si ha comprado la vivienda hace poco? As\u00ed le indicamos qu\u00e9 documentaci\u00f3n hace falta.\n\nMuchas gracias.";
const RESP_NOTA_SIMPLE_SOCIEDAD = "Buenas {nombre},\n\nGracias por la documentaci\u00f3n. Revis\u00e1ndola hemos visto que, seg\u00fan la Nota simple, la vivienda figura a nombre de la sociedad {titulares}.\n\n\u00bfNos podr\u00eda comentar si es usted administrador o representante de la sociedad, o inquilino? As\u00ed le indicamos qu\u00e9 documentaci\u00f3n hace falta.\n\nMuchas gracias.";
// textos anteriores: si la fila de Flujo bot sigue con uno de estos (Guille no la ha tocado), se cambia por el de arriba
const RESP_NOTA_SIMPLE_V170 = "Buenas {nombre}, gracias por la documentaci\u00f3n. Revis\u00e1ndola hemos visto que, seg\u00fan la Nota simple, la vivienda figura a nombre de {titulares}. \u00bfNos puede explicar qu\u00e9 relaci\u00f3n tiene usted con {con_quien}? Seg\u00fan lo que nos diga, le indicaremos qu\u00e9 documentaci\u00f3n hace falta. Muchas gracias.";
const RESP_NOTA_SIMPLE_V172 = "Buenas {nombre},\n\nGracias por la documentaci\u00f3n. Revis\u00e1ndola hemos visto que, seg\u00fan la Nota simple, la vivienda figura a nombre de {titulares}.\n\n\u00bfNos puede explicar qu\u00e9 relaci\u00f3n tiene usted con {con_quien}?\n\nSeg\u00fan lo que nos diga, le indicaremos qu\u00e9 documentaci\u00f3n hace falta.\n\nMuchas gracias.";
const RESP_NOTA_SIMPLE_VIEJOS = [RESP_NOTA_SIMPLE_V170, RESP_NOTA_SIMPLE_V172];
// titular que es una sociedad: termina en S.L., SL, S.L.U., S.A., S.A.U., S.C., C.B. o lleva SOCIEDAD / SOCIMI / LIMITADA / ANONIMA
function esSociedad(n) {
  const t = String(n || "").trim();
  return /(^|[\s,])(S\.?\s?L\.?(\s?U\.?)?|S\.?\s?A\.?(\s?U\.?)?|S\.?\s?C\.?|C\.?\s?B\.?)$/i.test(t) || /\b(SOCIEDAD|SOCIMI|LIMITADA|AN[OÓ]NIMA)\b/i.test(t);
}
function notaEsSociedad(nota) { return titularesDeNota(nota).some(esSociedad); }
// v176 (24/10/2026, criterio de Guille: "los saludos solo con el nombre... los titulares completos") -- nombre de pila:
//   la primera palabra y, detras, las que sean nombres de pila conocidos ("Rosa Mª", "Enrique José", "Ana Cristina"),
//   tambien con "del/de la/de los" + nombre ("María del Carmen", "Mª del Valle", "María de los Ángeles"). Asi no se
//   confunde con los apellidos compuestos ("Rodríguez de la Cruz", "Pérez de la Rosa"). Lo de detras de "/" o entre
//   parentesis no cuenta. Empresas y organismos: el nombre entero. Si falla, Guille lo corrige en el recuadro.
const _NOMBRES = new Set(("mª m.ª ma aº jª fº josé jose maría maria manuel antonio juan luis carlos miguel ángel angel francisco javier jesús jesus " +
  "rafael pedro pablo andrés andres alberto alejandro fernando enrique ignacio joaquín joaquin jorge víctor victor vicente ramón ramon " +
  "alfonso agustín agustin emilio eduardo daniel david diego gonzalo guillermo jaime julio lorenzo mario martín martin nicolás nicolas " +
  "óscar oscar ricardo roberto rodrigo salvador santiago sergio tomás tomas félix felix federico gabriel gregorio hugo iván ivan " +
  "cristina carmen isabel pilar dolores rosa rosario mercedes teresa ana lucía lucia elena laura marta patricia paula raquel sara sonia " +
  "susana beatriz silvia eva inmaculada josefa encarnación encarnacion concepción concepcion esperanza francisca antonia manuela " +
  "victoria virginia asunción asuncion amparo ángeles angeles auxiliadora consolación consolacion inés ines irene julia luisa macarena " +
  "magdalena milagros montserrat natalia nieves noelia nuria olga reyes rocío rocio soledad trinidad yolanda belén belen candelaria " +
  "esther gloria lourdes margarita marina mónica monica alicia andrea adela aurora carolina celia clara elisa emilia estrella eugenia " +
  "fátima fatima gema gemma guadalupe josefina leonor lidia loreto lola mar paloma regina remedios rosalía rosalia salud sagrario " +
  "valle o luz cruz rosal sagrado corazón corazon").split(" "));
const _NOMBRE_TRAS_PART = new Set("carmen valle o mar pilar rosario rocío rocio ángeles angeles consolación consolacion dolores mercedes montserrat luz cruz reyes nieves salud sagrario remedios milagros soledad gracia paz".split(" "));
function nombrePila(nombre) {
  const limpio = String(nombre || "").replace(/^\s*(\([^)]*\)\s*)+/, "").split("/")[0].replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return "";
  if (esSociedad(limpio) || /\b(ayuntamiento|comunidad|delegaci[oó]n|junta|consejer[ií]a|ministerio|excmo|iltmo)\b/i.test(limpio)) return limpio;
  const w = limpio.split(" ");
  const out = [w[0]];
  let i = 1;
  while (i < w.length - 1) {
    const x = w[i].toLowerCase();
    if (_NOMBRES.has(x)) { out.push(w[i]); i++; continue; }
    // "del Carmen", "de la O", "de los Ángeles"
    let k = i; while (k < w.length - 1 && /^(de|del|la|las|los)$/i.test(w[k])) k++;
    if (k > i && k < w.length - 1 && _NOMBRE_TRAS_PART.has(w[k].toLowerCase())) { out.push(...w.slice(i, k + 1)); i = k + 1; continue; }
    break;
  }
  return out.join(" ");
}
function rellenarRespuestaTipo(plantilla, nota, nombre) {
  const nb = nombrePila(nombre);   // v176: el saludo, solo con el nombre de pila
  const tit = titularesDeNota(nota);
  const lista = !tit.length ? "[titulares]" : (tit.length === 1 ? tit[0] : tit.slice(0, -1).join(", ") + " y " + tit[tit.length - 1]);
  const conQuien = !tit.length ? "[ellos / esa persona]" : (tit.length > 1 ? "ellos" : "esa persona");
  return String(plantilla || "").replace(/\{nombre\}/g, nb || "[nombre]").replace(/\{titulares\}/g, lista).replace(/\{con_quien\}/g, conQuien);
}
// v179 (24/10/2026, criterio de Guille: "para cerrar conversaciones... su documentacion esta completa") -- respuesta tipo
//   "Documentacion completa" (la n.º 2 de §6.21.6, "Lo tenemos todo").
const RESP_DOC_COMPLETA = "Buenas {nombre},\n\nYa tenemos toda la documentaci\u00f3n de su vivienda, completa y correcta.\n\nNosotros nos encargamos ahora de tramitarla con EMASESA. Si necesit\u00e1ramos algo m\u00e1s, se lo dir\u00edamos por aqu\u00ed.\n\nMuchas gracias.";
// v181 (24/10/2026, criterio de Guille: "¿podríamos hacer una respuesta tipo así?"; caso Malvaloca 1 5A) -- respuesta tipo
//   "Herencia (documentos)". {falta_impreso_dni}: la linea del Impreso toma datos y el DNI, SOLO si no los ha mandado.
const RESP_HERENCIA = "Buenas {nombre},\n\nEn los casos de herencia, a EMASESA le basta con el testamento y el certificado de defunci\u00f3n, o con la declaraci\u00f3n de herederos, en los que aparezca usted entre los herederos.{falta_impreso_dni}\n\nMuchas gracias.";
function lineaFaltaImpresoDni(tieneImpreso, tieneDni) {
  const f = [];
  if (!tieneImpreso) f.push("su Impreso toma datos, rellenado y firmado por usted");
  if (!tieneDni) f.push("su DNI por las dos caras");
  return f.length ? "\n\nJunto con ellos, necesitamos " + f.join(", y ") + "." : "";
}
module.exports = { RESP_HERENCIA, lineaFaltaImpresoDni, RESP_DOC_COMPLETA, saludoVecino, titularesDeNota, mismaPersona, rellenarRespuestaTipo, nombrePila, esSociedad, notaEsSociedad, RESP_NOTA_SIMPLE, RESP_NOTA_SIMPLE_SOCIEDAD, RESP_NOTA_SIMPLE_VIEJOS };
