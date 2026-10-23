// v127 (20/10/2026, criterio de Guille: "el bot deberia estar calladito a horas intempestivas") -- horario de
//   comunicaciones del bot. Por defecto de lunes a viernes de 9:00 a 20:00 (hora de Espana). Se cambia en Flujo bot
//   (filas horario_dias, horario_inicio y horario_fin de bot_plantillas).
//   - El bot solo manda lo suyo (presentaciones, recordatorios, avisos por plazo) dentro del horario.
//   - Lo que manda Guille al pulsar: fuera del horario se le avisa y elige "Enviar ahora" o "Programar" (bot_programados).
//   - Las respuestas del bot cuando el vecino le escribe NO se ven afectadas.
//   Estas funciones se usan en el servidor (bot y presupuestos) y, copiadas con toString, en el navegador.
"use strict";

const HORARIO_DEFECTO = { dias: [1, 2, 3, 4, 5], ini: "09:00", fin: "20:00" };

// Normaliza lo que viene del Sheet: dias "1,2,3,4,5" (1 = lunes ... 7 = domingo), horas "HH:MM".
// v156 (23/10/2026, criterio de Guille: "partirlo en dos tramos, de 9 a 15 y de 17 a 20") -- segundo tramo opcional
//   (filas horario_inicio2 / horario_fin2): ini2/fin2 vacios = un solo tramo. Solo vale si empieza despues del primero.
function normalizarHorario(diasTxt, iniTxt, finTxt, ini2Txt, fin2Txt) {
  const hh = (s, def) => { const m = String(s || "").trim().match(/^(\d{1,2})[:.h]?(\d{2})?$/); if (!m) return def; const h = Math.min(23, parseInt(m[1], 10)); const mi = Math.min(59, parseInt(m[2] || "0", 10)); return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0"); };
  let dias = String(diasTxt == null ? "" : diasTxt).split(/[^0-9]+/).map(x => parseInt(x, 10)).filter(x => x >= 1 && x <= 7);
  if (!dias.length) dias = HORARIO_DEFECTO.dias.slice();
  const ini = hh(iniTxt, HORARIO_DEFECTO.ini), fin = hh(finTxt, HORARIO_DEFECTO.fin);
  let ini2 = hh(ini2Txt, ""), fin2 = hh(fin2Txt, "");
  if (!ini2 || !fin2 || ini2 >= fin2 || ini2 < fin) { ini2 = ""; fin2 = ""; }
  return { dias: Array.from(new Set(dias)).sort(), ini, fin, ini2, fin2 };
}

// Calcula, para el horario H y el momento d (Date), si se esta dentro y cual es la proxima apertura.
//   Autocontenida (se copia al navegador con toString): no usa nada de fuera.
function calcHorario(H, d) {
  H = H || { dias: [1, 2, 3, 4, 5], ini: "09:00", fin: "20:00" };
  d = d || new Date();
  var WD = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  var NOM = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hour12: false });
  var partes = function (x) { var o = {}; fmt.formatToParts(x).forEach(function (p) { o[p.type] = p.value; }); if (o.hour === "24") o.hour = "00"; return o; };
  var dentro = function (x) { var p = partes(x); var hm = p.hour + ":" + p.minute; return H.dias.indexOf(WD[p.weekday]) >= 0 && ((hm >= H.ini && hm < H.fin) || (!!H.ini2 && !!H.fin2 && hm >= H.ini2 && hm < H.fin2)); };   // v156: segundo tramo
  if (dentro(d)) return { dentro: true, proxima: d, texto: "" };
  var t = new Date(Math.ceil(d.getTime() / 300000) * 300000);   // siguiente multiplo de 5 minutos
  for (var i = 0; i < 8 * 24 * 12; i++) {
    if (dentro(t)) { var p = partes(t); return { dentro: false, proxima: t, texto: NOM[WD[p.weekday]] + " " + p.day + "/" + p.month + " a las " + parseInt(p.hour, 10) + ":" + p.minute }; }
    t = new Date(t.getTime() + 300000);
  }
  return { dentro: false, proxima: null, texto: "" };
}

// Texto corto del horario para los avisos: "L-V 9:00-20:00" / "L, X, V 9:00-14:00"
function textoHorario(H) {
  H = H || HORARIO_DEFECTO;
  var L = ["", "L", "M", "X", "J", "V", "S", "D"];
  var d = H.dias.slice().sort();
  var seguidos = d.length > 1 && d.every(function (x, i) { return i === 0 || x === d[i - 1] + 1; });
  var dias = seguidos ? (L[d[0]] + "-" + L[d[d.length - 1]]) : d.map(function (x) { return L[x]; }).join(", ");
  var h = function (s) { return String(parseInt(s.slice(0, 2), 10)) + ":" + s.slice(3); };
  return dias + " " + h(H.ini) + "-" + h(H.fin) + (H.ini2 && H.fin2 ? " y " + h(H.ini2) + "-" + h(H.fin2) : "");   // v156
}

module.exports = { HORARIO_DEFECTO, normalizarHorario, calcHorario, textoHorario };
