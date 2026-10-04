// ============================================================
// lib/cache-respuesta.cjs — caché y «una sola a la vez» para endpoints
// pesados de Holded (04/10/2026: 1.431 peticiones en 6 min tras un
// despliegue). Middleware de Express que va delante del handler:
//   · respuesta buena de menos de ttl(req) → se sirve sin recalcular;
//   · si ya hay un cálculo igual en marcha → se espera a ESE (no se lanza otro);
//   · solo se guardan las respuestas buenas (HTTP < 400 y ok !== false).
// ?refresh=1 o ?force=1 saltan la caché (pero no se duplican si ya hay uno).
// ============================================================
"use strict";

const ESPERA_MAX_MS = 10 * 60 * 1000;   // si el handler no responde, se suelta

function cacheRespuesta({ clave, ttl, autorizado, cors }) {
  const cache = new Map();
  const vuelo = new Map();
  const mw = (req, res, next) => {
    if (autorizado && !autorizado(req)) return next();        // el handler responde el 401
    const k = clave(req);
    const saltar = !!req.query.refresh || String(req.query.force || "") === "1";
    const c = cache.get(k);
    if (!saltar && c && Date.now() - c.ts < ttl(req)) { if (cors) cors(res); return res.status(c.status).json(c.body); }
    if (vuelo.has(k)) {
      return vuelo.get(k).then((r) => { if (cors) cors(res); if (!r) return next(); res.status(r.status).json(r.body); });
    }
    let soltar;
    const p = new Promise((r) => { soltar = r; });
    vuelo.set(k, p);
    const t = setTimeout(() => { if (vuelo.get(k) === p) vuelo.delete(k); soltar(null); }, ESPERA_MAX_MS);
    t.unref?.();
    const json = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode || 200;
      if (status < 400 && body && body.ok !== false) cache.set(k, { ts: Date.now(), status, body });
      clearTimeout(t);
      if (vuelo.get(k) === p) vuelo.delete(k);
      soltar({ status, body });
      return json(body);
    };
    next();
  };
  mw.stats = () => ({ en_cache: cache.size, en_marcha: vuelo.size });
  mw._cache = cache;
  return mw;
}

// Una sola ejecución a la vez de una función async por clave (las llamadas
// que llegan mientras tanto reciben la misma promesa)
function unaALaVez(fn, clave = () => "") {
  const vuelo = new Map();
  return function (...args) {
    const k = clave(...args);
    if (vuelo.has(k)) return vuelo.get(k);
    const p = Promise.resolve().then(() => fn.apply(this, args)).finally(() => vuelo.delete(k));
    vuelo.set(k, p);
    return p;
  };
}

module.exports = { cacheRespuesta, unaALaVez };
