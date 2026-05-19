// ============================================================
// ARA OS — Integración Holded (lectura) · v0.1.0 (18/05/2026)
//
// Sprint Holded MVP-A: traer gastos recibidos (documents/purchase)
// de Holded a ARA OS, sin escribir. Holded sigue siendo la verdad.
//
// Estado actual: v0.1.0
//   · Endpoints crudos de lectura, sin caché, sin asociación a obra.
//   · Objetivo: validar que la API key funciona, ver qué datos
//     llegan, decidir cómo cruzar con obras en la siguiente
//     iteración.
//
// Requisitos:
//   · Variable de entorno: HOLDED_API_KEY (configurar en Render)
//   · Plan Holded de pago (la API no funciona en plan Free)
//
// Endpoints expuestos:
//   GET  /api/ara-os/holded/ping
//         · Diagnóstico. Verifica que la API key responde.
//         · Hace una llamada barata (lista contactos, limit=1).
//         · Devuelve { ok, version, holded_ok, latency_ms, sample? }
//
//   GET  /api/ara-os/holded/gastos-recibidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//         · Lista documentos tipo `purchase` (gastos / facturas
//           recibidas de proveedores) en el rango indicado.
//         · Si no se pasan fechas, default: mes en curso + mes anterior.
//         · Devuelve { ok, version, rango, count, gastos[] }
//
// Lo que NO hace (todavía):
//   · No persiste nada en Sheet ni en BD.
//   · No asocia cada gasto a una obra (siguiente sprint).
//   · No escribe nada en Holded (solo lectura).
//   · No incluye payments, purchaseorder ni purchaserefund.
//
// Referencias API Holded:
//   https://developers.holded.com/reference/list-documents-1
//   Auth: header `key: <API_KEY>` (NO Bearer)
//   Fechas: Unix timestamp (segundos)
//   docType para gastos: "purchase"
// ============================================================

const HOLDED_API_BASE = "https://api.holded.com/api/invoicing/v1";

module.exports = function setupAraOSHolded(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  function getApiKey() {
    return process.env.HOLDED_API_KEY || "";
  }

  // Llamada genérica a Holded. Devuelve { ok, status, data, error }.
  async function fetchHolded(path, params = {}) {
    const key = getApiKey();
    if (!key) {
      return { ok: false, status: 500, error: "Falta HOLDED_API_KEY en entorno" };
    }
    let url = `${HOLDED_API_BASE}${path}`;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
    try {
      const t0 = Date.now();
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "key": key,
          "Accept": "application/json",
        },
      });
      const latency = Date.now() - t0;
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* respuesta no JSON */ }
      if (!r.ok) {
        return {
          ok: false,
          status: r.status,
          error: `Holded respondió ${r.status}`,
          body_raw: text.slice(0, 500),
          latency,
        };
      }
      return { ok: true, status: r.status, data, latency };
    } catch (e) {
      return { ok: false, status: 500, error: e.message };
    }
  }

  // YYYY-MM-DD → Unix timestamp en segundos (00:00:00 UTC del día)
  function fechaAUnix(fecha_iso) {
    if (!fecha_iso) return null;
    const d = new Date(`${fecha_iso}T00:00:00Z`);
    if (isNaN(d.getTime())) return null;
    return Math.floor(d.getTime() / 1000);
  }

  // Default: mes en curso + mes anterior (cubre ~60 días).
  function rangoDefault() {
    const hoy = new Date();
    const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
    const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
    const toISO = d => d.toISOString().slice(0, 10);
    return { desde: toISO(desde), hasta: toISO(hasta) };
  }

  // ============================================================
  // GET /api/ara-os/holded/ping
  // ============================================================
  app.options("/api/ara-os/holded/ping", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/ping", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const r = await fetchHolded("/contacts", { page: 1 });
    res.json({
      ok: true,
      version: "0.1.0",
      ts: new Date().toISOString(),
      holded_ok: r.ok,
      holded_status: r.status,
      holded_latency_ms: r.latency,
      holded_error: r.ok ? null : r.error,
      sample_count: r.ok && Array.isArray(r.data) ? r.data.length : null,
      sample_first: r.ok && Array.isArray(r.data) && r.data[0]
        ? { name: r.data[0].name || null, id: r.data[0].id || null }
        : null,
      key_presente: !!getApiKey(),
    });
  });

  // ============================================================
  // GET /api/ara-os/holded/gastos-recibidos
  //
  // Query params:
  //   - desde   YYYY-MM-DD (opcional; default: día 1 mes anterior)
  //   - hasta   YYYY-MM-DD (opcional; default: último día mes actual)
  //
  // Trae documentos `purchase` y los normaliza a un esquema sencillo
  // para ARA OS, ocultando la complejidad cruda de Holded.
  // ============================================================
  app.options("/api/ara-os/holded/gastos-recibidos", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/holded/gastos-recibidos", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const def = rangoDefault();
    const desde = String(req.query.desde || def.desde);
    const hasta = String(req.query.hasta || def.hasta);
    const ts_desde = fechaAUnix(desde);
    const ts_hasta = fechaAUnix(hasta);
    if (!ts_desde || !ts_hasta) {
      return res.status(400).json({ ok: false, error: "Fechas inválidas (esperado YYYY-MM-DD)" });
    }

    const r = await fetchHolded("/documents/purchase");
    if (!r.ok) {
      return res.status(502).json({
        ok: false, version: "0.1.0",
        error: r.error, holded_status: r.status,
        body_raw: r.body_raw || null,
      });
    }

    // Holded devuelve un array (al menos en GET documents/{type}).
    // Normalizamos campos clave a un esquema ARA OS estable.
    const docsRaw = Array.isArray(r.data) ? r.data : (r.data?.documents || []);

    // Filtrado de fecha en cliente (server-side params no documentados
    // para purchases en v0.1.0; podemos optimizar más adelante).
    const docsFiltrados = docsRaw.filter((d) => {
      const ts = Number(d.date || 0);
      return ts >= ts_desde && ts <= (ts_hasta + 86400); // incluye día hasta
    });

    const gastos = docsFiltrados.map((d) => ({
      id:             d.id || null,
      numero:         d.docNumber || d.number || "",
      fecha:          d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : null,
      fecha_vto:      d.dueDate ? new Date(d.dueDate * 1000).toISOString().slice(0, 10) : null,
      proveedor:      d.contactName || d.contact || "",
      proveedor_id:   d.contact || null,
      descripcion:    d.description || d.desc || "",
      subtotal:       Number(d.subtotal || 0),
      iva:            Number(d.tax || 0),
      total:          Number(d.total || 0),
      estado:         d.status || "",       // crudo de Holded
      pagado:         !!d.paid,             // boolean según docs
      tags:           Array.isArray(d.tags) ? d.tags : [],
      // crudo por si necesitamos algo no normalizado:
      _raw:           d,
    }));

    res.json({
      ok: true,
      version: "0.1.0",
      ts: new Date().toISOString(),
      rango: { desde, hasta },
      count_total_holded: docsRaw.length,
      count: gastos.length,
      total_eur: gastos.reduce((s, g) => s + g.total, 0),
      gastos,
    });
  });

};
