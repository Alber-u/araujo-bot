// ============================================================
// lib/holded-fetch.cjs — todas las llamadas a api.holded.com por un mismo
// embudo (04/10/2026: Holded daba 429 y el panel salía en blanco)
// ============================================================
// Se instala una vez al arrancar (index.cjs) envolviendo fetch: solo afecta
// a las URL de api.holded.com; el resto pasa tal cual.
//   · como mucho MAX_PARALELO peticiones a la vez y SEPARACION_MS entre una y otra
//   · 429 o 503: reintento con espera creciente (Retry-After si viene;
//     si no, 2 s, 4 s, 8 s) y pausa GENERAL: mientras dura, ninguna otra
//     petición sale (no se machaca a Holded entre todos los módulos)
//   · contadores para ver cuántas peticiones salen (GET /api/ara-os/holded-embudo)
// ============================================================
"use strict";

const MAX_PARALELO = 3;
const SEPARACION_MS = 250;
const REINTENTOS = 3;
const ESPERA_BASE_MS = 2000;
const ESPERA_MAX_MS = 60 * 1000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { desde: new Date().toISOString(), peticiones: 0, reintentos: 0, respuestas_429: 0, en_pausa_hasta: null, ultimas_429: [] };
let activos = 0, ultimaSalida = 0, pausaHasta = 0;
const cola = [];

function siguiente() {
  if (activos >= MAX_PARALELO || !cola.length) return;
  const ahora = Date.now();
  const listo = Math.max(pausaHasta, ultimaSalida + SEPARACION_MS);
  if (ahora < listo) { setTimeout(siguiente, listo - ahora); return; }
  const tarea = cola.shift();
  activos++; ultimaSalida = Date.now();
  tarea().finally(() => { activos--; siguiente(); });
  siguiente();
}
const enCola = (fn) => new Promise((resolve, reject) => { cola.push(() => fn().then(resolve, reject)); siguiente(); });

function retryAfterMs(res) {
  const h = res.headers?.get?.("retry-after");
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n)) return n * 1000;
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

function envolver(fetchOriginal) {
  return async function fetchHolded(url, opts) {
    const u = typeof url === "string" ? url : url?.url || String(url);
    if (!/api\.holded\.com/i.test(u)) return fetchOriginal(url, opts);
    for (let intento = 0; ; intento++) {
      const res = await enCola(() => { stats.peticiones++; return fetchOriginal(url, opts); });
      if ((res.status !== 429 && res.status !== 503) || intento >= REINTENTOS) {
        if (res.status === 429) { stats.respuestas_429++; stats.ultimas_429 = [new Date().toISOString(), ...stats.ultimas_429].slice(0, 10); }
        return res;
      }
      if (res.status === 429) { stats.respuestas_429++; stats.ultimas_429 = [new Date().toISOString(), ...stats.ultimas_429].slice(0, 10); }
      const ms = Math.min(retryAfterMs(res) ?? ESPERA_BASE_MS * 2 ** intento, ESPERA_MAX_MS);
      pausaHasta = Math.max(pausaHasta, Date.now() + ms);       // pausa para TODOS
      stats.en_pausa_hasta = new Date(pausaHasta).toISOString();
      stats.reintentos++;
      await espera(ms);
    }
  };
}

let instalado = false;
function instalar() {
  if (instalado || typeof globalThis.fetch !== "function") return;
  globalThis.fetch = envolver(globalThis.fetch.bind(globalThis));
  instalado = true;
}

module.exports = { instalar, envolver, stats: () => ({ ...stats, en_cola: cola.length, activos }), _reset: () => { activos = 0; ultimaSalida = 0; pausaHasta = 0; cola.length = 0; } };
