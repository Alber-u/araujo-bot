// ============================================================
// lib/fecha-madrid.cjs — el día y la hora de Madrid (Europe/Madrid), no los de UTC · 06/10/2026
// Entre las 00:00 y las 02:00 de Madrid, UTC sigue en el día anterior: Planificación se quedaba en ayer.
// ============================================================
"use strict";
const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const HORA = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false });
// «2026-10-06»
const hoyMadrid = (d = new Date()) => DIA.format(d instanceof Date ? d : new Date(d));
// «09:33»
const horaMadrid = (d = new Date()) => HORA.format(d instanceof Date ? d : new Date(d));
// ¿Hay que renovar una carga hecha en «ts»? Al cambiar de día de Madrid (esperando la nueva), a los maxMs o si
// algo la ha marcado (un fichaje): { renovar, otroDia }
function caduca(ts, { ahora = Date.now(), maxMs = 12 * 60 * 1000, sucio = false } = {}) {
  const otroDia = hoyMadrid(new Date(ts)) !== hoyMadrid(new Date(ahora));
  return { otroDia, renovar: otroDia || sucio || ahora - ts > maxMs };
}
module.exports = { hoyMadrid, horaMadrid, caduca };
