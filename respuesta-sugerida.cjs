// v179 (24/10/2026, criterio de Guille: "cuando te pregunto que mires el bot o los mail de un piso y despues te pido que le
//   responderias... una opcion en respuestas tipo, la primera, que lo hiciera cuando yo la pulsase: Respuesta sugerida") --
//   borrador de respuesta con la IA del programa (OpenAI, la misma que lee los DNI). Es una HERRAMIENTA: escribe un borrador
//   con lo que le damos; Guille lo lee, lo retoca y lo envia. No decide ni aprende sola: todo lo que sabe sale de
//   (1) los datos del vecino o de la comunidad que le pasa el programa en cada consulta, (2) las NORMAS del manual
//   (§6.21.6, leidas del propio "Plan 5 (Programa).md" en cada consulta: un solo sitio) y (3) ejemplos de como escribe
//   Guille (sus ultimos mensajes). Manual §3.15.5 y §6.21.6.
"use strict";
const fs = require("fs");
const path = require("path");

const MODELO = "gpt-4o";
const MANUAL = path.join(__dirname, "Plan 5 (Programa).md");
let _cache = { mtime: 0, normas: "" };

// §6.21.6 del manual (normas y respuestas tipo de WhatsApp), tal cual
function normasDelManual() {
  try {
    const st = fs.statSync(MANUAL);
    if (st.mtimeMs === _cache.mtime && _cache.normas) return _cache.normas;
    const t = fs.readFileSync(MANUAL, "utf8");
    const i = t.indexOf("**6.21.6 ");
    let j = i < 0 ? -1 : t.indexOf("\n# 7.", i);
    if (j < 0 && i >= 0) j = Math.min(t.length, i + 12000);
    _cache = { mtime: st.mtimeMs, normas: i < 0 ? "" : t.slice(i, j).trim() };
    return _cache.normas;
  } catch (e) { return ""; }
}

const _corta = (s, n) => { s = String(s == null ? "" : s).replace(/\r/g, "").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

const COMUN = [
  "Escribes en español de España, tratando de usted, con párrafos cortos separados por una línea en blanco (como escribe Guille).",
  "Usa SOLO los datos que te damos. No inventes documentos, importes, fechas, plazos ni nombres. Si te falta un dato para completar una frase, ponlo entre corchetes, por ejemplo [importe], para que lo complete Guille.",
  "Los documentos se nombran como su archivo: «Impreso toma datos», «Impreso autorización usufructo».",
  "Los importes salen siempre de los datos de la toma de datos de Plan 5 que te damos, nunca de lo dicho a otro vecino.",
  "No des nombres de otros vecinos.",
  "Termina con «Muchas gracias.» o, si hubo una molestia o un error nuestro, con «Disculpe las molestias.».",
  "Devuelve SOLO el texto del mensaje, sin comillas, sin explicaciones y sin firma (la firma la pone el programa).",
].join("\n- ");

// WhatsApp a un vecino
function promptWhatsApp(d) {
  const sys = "Redactas borradores de respuesta por WhatsApp para Guille, de Instalaciones Araujo, que gestiona el Plan 5 de EMASESA (individualización de contadores de agua en comunidades de vecinos de Sevilla). Guille leerá tu borrador, lo retocará si hace falta y lo enviará él al vecino.\n\nNormas:\n- "
    + "Empieza con «Buenas " + (d.nombrePila || "[nombre]") + ",» en su propia línea.\n- " + COMUN
    + "\n\nNormas y criterios del manual del programa (síguelos):\n\n" + (normasDelManual() || "(no disponibles)");
  const datos = [
    "Comunidad y piso: " + (d.comunidad || "") + " " + (d.vivienda || ""),
    "Nombre de quien escribe (el de arriba de la ficha): " + (d.nombre || "[sin nombre]"),
    "Titular(es) según la Nota simple: " + (d.notaSimple || "(no hay Nota simple)"),
    "Tipo de expediente: " + (d.tipo || "(sin dato)"),
    "Paso del bot: " + (d.paso || "(sin dato)") + (d.fechaLimite ? " · plazo de la documentación: " + d.fechaLimite : ""),
    "Documentos: " + (d.docs || "(sin dato)"),
    "Forma de pago elegida: " + (d.formaPago || "(sin elegir)"),
    "Importes de su vivienda (toma de datos de Plan 5): " + (d.importes || "(sin dato)"),
  ].join("\n");
  const conv = (d.items || []).slice(-40).map((x) => "[" + (x.fecha || "") + "] " + ({ vecino: "VECINO", bot: "BOT", equipo: "GUILLE" }[x.quien] || String(x.quien || "").toUpperCase()) + ": " + _corta(x.texto, 700)).join("\n");
  const ej = (d.ejemplos || []).slice(0, 8).map((t, i) => "Ejemplo " + (i + 1) + ":\n" + _corta(t, 600)).join("\n\n");
  const user = "DATOS DEL VECINO\n" + datos + "\n\nCONVERSACIÓN (de la más antigua a la más reciente)\n" + (conv || "(sin mensajes)")
    + (ej ? "\n\nASÍ ESCRIBE GUILLE (mensajes suyos a otros vecinos; copia el tono, no los datos)\n" + ej : "")
    + "\n\nEscribe ahora el mensaje que Guille debería mandar a este vecino.";
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

// correo a la comunidad (administrador / presidente)
function promptCorreo(d) {
  const sys = "Redactas borradores de correo electrónico para Guille, de Instalaciones Araujo, que gestiona el Plan 5 de EMASESA (individualización de contadores de agua en comunidades de vecinos de Sevilla). El correo va a la comunidad (administrador o presidente). Guille lo leerá, lo retocará si hace falta y lo enviará él.\n\nNormas:\n- "
    + COMUN + "\n- No escribas asunto ni la despedida con la firma (Atentamente, nombre, teléfono): ya están en el correo.";
  const datos = ["Comunidad: " + (d.comunidad || ""), "Fase del expediente: " + (d.fase || "(sin dato)")].join("\n");
  const hist = (d.historico || []).slice(0, 8).map((m) => "[" + (m.fecha || "") + "] " + (m.tipo || "") + " · " + _corta(m.asunto, 160) + "\n" + _corta(m.mensaje, 1200)).join("\n\n");
  const ej = (d.ejemplos || []).slice(0, 5).map((t, i) => "Ejemplo " + (i + 1) + ":\n" + _corta(t, 800)).join("\n\n");
  const user = "DATOS\n" + datos + "\n\nCORREOS DE ESTA COMUNIDAD (del más reciente al más antiguo)\n" + (hist || "(sin correos)")
    + "\n\nCORREO QUE ESTÁ ESCRIBIENDO GUILLE AHORA\nAsunto: " + _corta(d.asunto, 200) + "\nCuerpo actual (puede traer el correo al que responde citado debajo):\n" + _corta(d.cuerpo, 3000)
    + (ej ? "\n\nASÍ ESCRIBE GUILLE (correos suyos; copia el tono, no los datos)\n" + ej : "")
    + "\n\nEscribe ahora el texto del correo que Guille debería mandar (solo el texto nuevo, que irá arriba del cuerpo).";
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

// llamada a OpenAI (se puede cambiar en el banco de pruebas: module.exports._http)
async function _httpOpenAI(url, body, cfg) { return require("axios").post(url, body, cfg); }
async function sugerir(mensajes) {
  if (!process.env.OPENAI_API_KEY) throw new Error("el programa no tiene la clave de OpenAI");
  const r = await module.exports._http("https://api.openai.com/v1/chat/completions",
    { model: MODELO, temperature: 0.7, max_tokens: 700, messages: mensajes },
    { timeout: 45000, headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" } });
  const t = (((r && r.data && r.data.choices) || [])[0] || {}).message;
  const txt = String((t && t.content) || "").replace(/^\s*["«]|["»]\s*$/g, "").trim();
  if (!txt) throw new Error("la IA no ha devuelto ningún texto");
  return txt;
}

module.exports = { normasDelManual, promptWhatsApp, promptCorreo, sugerir, MODELO, _http: _httpOpenAI };
