// ============================================================
// ARA OS — Panel desde bloqueos_operativos
// v0.1.0
//
// Añadir en index.cjs:
//   require("./ara-os-panel.cjs")(app);
//
// GET /api/ara-os/panel?token=araujo2026
//
// Lee bloqueos_operativos (fuente de verdad con owners reales)
// y devuelve la cola de trabajo priorizada para ARA OS.
// ============================================================

module.exports = function setupAraOSPanel(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";
  function tokenValido(req) { return req.query.token === ADMIN_TOKEN; }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  const { google } = require("googleapis");
  function getSheetsClient() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.sheets({ version: "v4", auth });
  }

  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return res.data.values || [];
  }

  const COLS_BLOQUEO = [
    "comunidad","tipo_bloqueo","severidad","pelota_en","impacto",
    "vecinos_afectados","accion_exacta","detectado_por","detectado_en",
    "ultimo_movimiento_humano","dias_sin_movimiento","override_por","override_en",
    "override_comentario","esperar_hasta","proxima_revision","resuelto","resuelto_en",
    "owner","owner_override","owner_override_por","comentario_operativo"
  ];

  function filaABloqueo(row) {
    const o = {};
    COLS_BLOQUEO.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  // Owner efectivo: override prevalece
  function ownerEfectivo(b) {
    return (b.owner_override && b.owner_override.trim())
      ? b.owner_override.trim()
      : (b.owner || "—");
  }

  // Prioridad numérica para ordenar
  function prioridad(b) {
    if (b.severidad === "critica")    return 1;
    if (b.severidad === "seguimiento") return 2;
    return 3;
  }

  async function obtenerPanel() {
    const rows = await leerHoja("bloqueos_operativos!A:V");

    const bloqueos = [];
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      const b = filaABloqueo(rows[i]);
      if (b.resuelto === "si") continue; // ignorar resueltos

      // Calcular días bloqueado desde detectado_en
      let diasBloqueado = null;
      if (b.detectado_en) {
        const d = new Date(b.detectado_en);
        if (!isNaN(d)) diasBloqueado = Math.floor((new Date() - d) / 86400000);
      }

      bloqueos.push({
        comunidad:          b.comunidad,
        tipo_bloqueo:       b.tipo_bloqueo,
        severidad:          b.severidad,
        owner:              ownerEfectivo(b),
        owner_inferido:     b.owner,
        owner_override:     b.owner_override || null,
        pelota_en:          b.pelota_en,
        impacto:            b.impacto,
        accion_exacta:      b.accion_exacta,
        vecinos_afectados:  b.vecinos_afectados || null,
        dias_bloqueado:     diasBloqueado,
        detectado_en:       b.detectado_en,
        esperar_hasta:      b.esperar_hasta || null,
        proxima_revision:   b.proxima_revision || null,
        comentario:         b.comentario_operativo || null,
        prioridad:          prioridad(b),
      });
    }

    // Ordenar: prioridad → días bloqueado desc
    bloqueos.sort((a, b) =>
      a.prioridad - b.prioridad ||
      (b.dias_bloqueado || 0) - (a.dias_bloqueado || 0)
    );

    // Agrupar por owner
    const porOwner = {};
    for (const b of bloqueos) {
      if (!porOwner[b.owner]) porOwner[b.owner] = [];
      porOwner[b.owner].push(b);
    }

    // KPIs del panel
    const kpis = {
      total:        bloqueos.length,
      criticos:     bloqueos.filter(b => b.severidad === "critica").length,
      seguimiento:  bloqueos.filter(b => b.severidad === "seguimiento").length,
      por_owner:    Object.fromEntries(
        Object.entries(porOwner).map(([o, bs]) => [o, bs.length])
      ),
    };

    return { bloqueos, por_owner: porOwner, kpis };
  }

  app.options("/api/ara-os/panel", (req, res) => { cors(res); res.status(204).end(); });

  app.get("/api/ara-os/panel", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });
    try {
      const data = await obtenerPanel();
      res.json({
        ...data,
        meta: {
          generado:  new Date().toISOString(),
          version:   "0.1.0",
          fuente:    "bloqueos_operativos",
        },
      });
    } catch (err) {
      console.error("[ara-os-panel] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-panel] v0.1.0 · /api/ara-os/panel");
};
