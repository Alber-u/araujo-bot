// ============================================================
// ARA CACHE — Caché global de lecturas de Google Sheets
// v0.1.0
//
// Añadir en index.cjs INMEDIATAMENTE DESPUÉS de
//   const { google } = require("googleapis");
// y ANTES de cualquier require("./xxx.cjs")(app):
//
//   require("./ara-cache.cjs")();
//
// Qué hace:
//   Intercepta `google.sheets({...}).spreadsheets.values.get/update/append/batchUpdate`
//   monkey-patcheando el prototipo. Todos los módulos (presupuestos.cjs,
//   documentacion.cjs, ara-os-panel-obras.cjs, etc.) se benefician
//   automáticamente sin tocar su código.
//
// Estrategia:
//   - GET → si hay caché válida del rango, se devuelve; si no, se llama
//     a la API real y se guarda.
//   - UPDATE / APPEND / BATCHUPDATE → se invalida la caché de la pestaña
//     afectada antes de devolver al caller.
//
// TTL por pestaña (segundos):
//   - Tablas grandes y de lectura masiva: 30s
//     (comunidades, pisos, bloqueos_operativos, expedientes, documentos,
//      vecinos_base, mails_pendientes)
//   - Tablas con escrituras frecuentes: 15s
//     (ordenes_trabajo, financiaciones_sabadell, temperatura_contacto,
//      personas, contactos, avisos, mail_plantillas)
//   - Pestañas desconocidas: 15s (por defecto seguro)
//
// Por qué este enfoque:
//   - Una sola caché global compartida entre módulos (no hay duplicados
//     entre clientes creados por presupuestos.cjs vs panel-obras.cjs).
//   - Zero cambios en módulos existentes → respeta zona read-only de
//     Guillermo (presupuestos.cjs, documentacion.cjs).
//   - Invalidación correcta al escribir → coherencia inmediata para
//     el usuario que acaba de modificar algo.
//
// Logging:
//   En cada arranque imprime hits/misses periódicamente para verificar
//   que la caché está sirviendo.
// ============================================================

module.exports = function setupAraCache() {
  const { google } = require("googleapis");

  // === Configuración ===
  const TTL_GRANDE = 30 * 1000;  // 30s
  const TTL_RAPIDA = 15 * 1000;  // 15s

  const TTL_POR_PESTANA = {
    // Tablas grandes (lectura masiva, escritura puntual)
    "comunidades":            TTL_GRANDE,
    "pisos":                  TTL_GRANDE,
    "bloqueos_operativos":    TTL_GRANDE,
    "expedientes":            TTL_GRANDE,
    "documentos":             TTL_GRANDE,
    "vecinos_base":           TTL_GRANDE,
    "mails_pendientes":       TTL_GRANDE,
    // Tablas con escrituras más frecuentes
    "ordenes_trabajo":        TTL_RAPIDA,
    "financiaciones_sabadell":TTL_RAPIDA,
    "temperatura_contacto":   TTL_RAPIDA,
    "personas":               TTL_RAPIDA,
    "contactos":              TTL_RAPIDA,
    "avisos":                 TTL_RAPIDA,
    "mail_plantillas":        TTL_RAPIDA,
  };
  const TTL_DEFAULT = TTL_RAPIDA;

  function pestanaDeRango(range) {
    if (!range || typeof range !== "string") return null;
    const idx = range.indexOf("!");
    if (idx === -1) return range.trim(); // rango sin "!" es pestaña entera
    return range.slice(0, idx).trim();
  }

  function ttlDe(pestana) {
    if (!pestana) return TTL_DEFAULT;
    return TTL_POR_PESTANA[pestana] ?? TTL_DEFAULT;
  }

  // === Estado de caché ===
  // clave: `${spreadsheetId}::${range}::${majorDimension||""}::${valueRenderOption||""}`
  // valor: { data: <response real>, expira: <timestamp ms> }
  const cache = new Map();
  const stats = { hits: 0, misses: 0, invalidaciones: 0, escrituras: 0 };

  function claveCache(params) {
    const sid = params.spreadsheetId || "";
    const r = params.range || "";
    const md = params.majorDimension || "";
    const vro = params.valueRenderOption || "";
    return `${sid}::${r}::${md}::${vro}`;
  }

  function invalidarPestana(spreadsheetId, pestana) {
    if (!pestana) return;
    const prefijo = `${spreadsheetId}::${pestana}`;
    let borradas = 0;
    for (const k of cache.keys()) {
      // Coincidir tanto "pestana!..." como "pestana::..." (rango sin "!")
      if (k.startsWith(`${spreadsheetId}::${pestana}!`) ||
          k.startsWith(`${spreadsheetId}::${pestana}::`)) {
        cache.delete(k);
        borradas++;
      }
    }
    if (borradas > 0) {
      stats.invalidaciones += borradas;
    }
  }

  // === Monkey-patch ===
  // googleapis devuelve un cliente que internamente delega en una clase
  // `Resource$Spreadsheets$Values`. La forma robusta es parchear los
  // métodos en la instancia real la primera vez que se crea un cliente,
  // capturando el prototipo.
  let yaPatcheado = false;
  const origSheets = google.sheets.bind(google);

  google.sheets = function patchedSheets(...args) {
    const cliente = origSheets(...args);
    if (!yaPatcheado && cliente.spreadsheets && cliente.spreadsheets.values) {
      const proto = Object.getPrototypeOf(cliente.spreadsheets.values);
      const origGet = proto.get;
      const origUpdate = proto.update;
      const origAppend = proto.append;
      const origBatchUpdate = proto.batchUpdate;
      const origClear = proto.clear;

      // --- GET con caché ---
      // Política: si el GET real lanza, NO se cachea y se relanza el error
      // al caller (mismo comportamiento que sin caché). La caché solo guarda
      // respuestas exitosas. Si la lógica de caché tiene un bug puntual,
      // preferimos relanzar antes que llamar dos veces a Google.
      proto.get = async function patchedGet(params, opts) {
        const k = claveCache(params || {});
        const ahora = Date.now();
        const entrada = cache.get(k);
        if (entrada && entrada.expira > ahora) {
          stats.hits++;
          // Devolvemos la misma referencia del response. Los callers leen
          // res.data.values; no mutamos en este wrapper. Si algún caller
          // mutara res.data.values, esa mutación se vería en hits siguientes
          // — convención: los callers tratan el response como solo lectura.
          return entrada.data;
        }
        stats.misses++;
        const res = await origGet.call(this, params, opts);
        const pestana = pestanaDeRango(params && params.range);
        const ttl = ttlDe(pestana);
        cache.set(k, { data: res, expira: ahora + ttl });
        return res;
      };

      // --- UPDATE → invalida pestaña ---
      proto.update = async function patchedUpdate(params, opts) {
        const res = await origUpdate.call(this, params, opts);
        stats.escrituras++;
        const pestana = pestanaDeRango(params && params.range);
        invalidarPestana(params && params.spreadsheetId, pestana);
        return res;
      };

      // --- APPEND → invalida pestaña ---
      proto.append = async function patchedAppend(params, opts) {
        const res = await origAppend.call(this, params, opts);
        stats.escrituras++;
        const pestana = pestanaDeRango(params && params.range);
        invalidarPestana(params && params.spreadsheetId, pestana);
        return res;
      };

      // --- BATCH UPDATE → invalida todas las pestañas afectadas ---
      proto.batchUpdate = async function patchedBatchUpdate(params, opts) {
        const res = await origBatchUpdate.call(this, params, opts);
        stats.escrituras++;
        const sid = params && params.spreadsheetId;
        const data = params && params.requestBody && params.requestBody.data;
        if (Array.isArray(data)) {
          const pestanas = new Set();
          for (const d of data) {
            const p = pestanaDeRango(d && d.range);
            if (p) pestanas.add(p);
          }
          for (const p of pestanas) invalidarPestana(sid, p);
        } else {
          // batchUpdate también se usa para metadata (crear pestaña, etc).
          // En ese caso no podemos saber qué invalidar, así que vaciamos
          // por seguridad solo si es spreadsheets.batchUpdate (no values).
          // Aquí estamos en values.batchUpdate; si no hay data, no hacemos nada.
        }
        return res;
      };

      // --- CLEAR → invalida pestaña ---
      if (typeof origClear === "function") {
        proto.clear = async function patchedClear(params, opts) {
          const res = await origClear.call(this, params, opts);
          stats.escrituras++;
          const pestana = pestanaDeRango(params && params.range);
          invalidarPestana(params && params.spreadsheetId, pestana);
          return res;
        };
      }

      yaPatcheado = true;
      console.log("[ara-cache] v0.1.0 · prototipo Sheets parcheado");
    }
    return cliente;
  };

  // Restaurar el bind para mantener compatibilidad con `google.sheets.bind`
  // que algún módulo pueda usar.
  Object.setPrototypeOf(google.sheets, Function.prototype);

  // === Logging periódico ===
  // Cada 5 min imprime stats si hubo actividad. Útil para verificar
  // en logs de Render que la caché está sirviendo.
  setInterval(() => {
    const total = stats.hits + stats.misses;
    if (total === 0) return;
    const ratio = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : "0";
    console.log(
      `[ara-cache] stats · hits=${stats.hits} misses=${stats.misses} ` +
      `(${ratio}% hit) · escrituras=${stats.escrituras} ` +
      `invalidaciones=${stats.invalidaciones} · entradas=${cache.size}`
    );
  }, 5 * 60 * 1000);

  // === API opcional para debug ===
  // Endpoint /api/ara-cache/stats?token=araujo2026 → devuelve stats.
  // Endpoint /api/ara-cache/limpiar?token=araujo2026 → vacía caché.
  // Se registran solo si recibimos `app` (compatibilidad con
  // require("./ara-cache.cjs")(app)).
  const registrarEndpoints = function (app) {
    if (!app || typeof app.get !== "function") return;
    const TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

    app.get("/api/ara-cache/stats", (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.query.token !== TOKEN) {
        return res.status(403).json({ error: "No autorizado" });
      }
      const total = stats.hits + stats.misses;
      const ratio = total > 0 ? (stats.hits / total) : 0;
      res.json({
        version: "0.1.0",
        hits: stats.hits,
        misses: stats.misses,
        hit_ratio: Number((ratio * 100).toFixed(2)),
        escrituras: stats.escrituras,
        invalidaciones: stats.invalidaciones,
        entradas: cache.size,
        ttl_segundos: {
          grandes: TTL_GRANDE / 1000,
          rapidas: TTL_RAPIDA / 1000,
        },
      });
    });

    app.get("/api/ara-cache/limpiar", (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.query.token !== TOKEN) {
        return res.status(403).json({ error: "No autorizado" });
      }
      const n = cache.size;
      cache.clear();
      res.json({ ok: true, entradas_borradas: n });
    });

    console.log("[ara-cache] endpoints /api/ara-cache/stats y /limpiar listos");
  };

  return { registrarEndpoints };
};
