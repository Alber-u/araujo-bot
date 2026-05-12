// ============================================================
// ARA OS — Módulo de datos para el hub operativo
// v0.2.0 — usa pestaña "comunidades" real de Sheets
//
// require("./ara-os.cjs")(app);
//
// GET /api/ara-os/health   → diagnóstico (sin token)
// GET /api/ara-os/obras?token=araujo2026 → obras + KPIs + alertas
// ============================================================

module.exports = function setupAraOS(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma",
    "observaciones","tipo_via","earth","administrador","telefono_administrador",
    "email_administrador","fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto",
    "fecha_envio_pto","fecha_ultimo_seguimiento_pto","decision_pto","fecha_decision_pto",
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio","tiempo_previsto",
    "tiempo_real","tiempo_desvio","notas_pto","mails_enviados","mails_ultimo_envio",
    "fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto","fecha_visita_emasesa",
    "fecha_documentacion_completa","fecha_contratos_pagos_completa","modo_documentacion",
    "est_ccpp_contrato_firmado","est_ccpp_toma_datos","est_ccpp_nif","est_ccpp_acta_pte",
    "est_ccpp_acta_pto","est_ccpp_renuncia_gp","est_ccpp_factura_emasesa",
    "est_ccpp_contrato","est_ccpp_pago","fecha_envio_contratos_pagos",
    "fecha_cycp_completa","mails_manuales","fecha_limite_documentacion_vecinos",
    "motivo_rechazo"
  ];

  function filaAObjeto(row) {
    const o = {};
    COLS.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  function mapearEstado(com) {
    const fase   = (com.fase_presupuesto || "").toLowerCase();
    const estado = (com.estado_comunidad || "").toLowerCase();

    if (estado === "parada" || estado === "bloqueada") return "parada";
    if (com.fecha_cycp_completa)                       return "terminada";
    if (com.fecha_contratos_pagos_completa)            return "cobro";
    if (com.fecha_documentacion_completa)              return "lista";

    if (["08_cycp","07_pte_cycp","06_visita_emasesa",
         "05_documentacion","04_aceptacion_pto"].includes(fase)) return "ejecucion";

    if (["03_envio_pto","02_visita","01_contacto"].includes(fase)) return "presupuesto";

    return "presupuesto";
  }

  function accionSiguiente(com) {
    if (com.motivo_rechazo) return "Rechazo: " + com.motivo_rechazo.slice(0, 50);
    const fase = com.fase_presupuesto || "";
    if (!fase) return "Sin contacto";
    return fase.replace(/_/g, " ").replace(/^\d\d /, "");
  }

  function calcularMargen(com) {
    const bp  = parseFloat(com.beneficio_previsto) || 0;
    const pto = parseFloat(com.pto_total)          || 0;
    if (!pto) return null;
    return Math.round((bp / pto) * 100);
  }

  async function obtenerDatosAraOS() {
    const rows = await leerHoja("comunidades!A:BC");

    const obras   = [];
    const alertas = [];
    let contAlertas = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;

      const com    = filaAObjeto(row);
      const estado = mapearEstado(com);
      const id     = "O-" + String(i).padStart(3, "0");

      let prio = null;
      if (estado === "parada") {
        prio = "risk";
      } else if (com.fecha_limite_documentacion_vecinos) {
        const limite = new Date(com.fecha_limite_documentacion_vecinos);
        if (!isNaN(limite) && limite < new Date()) prio = "warn";
      }

      if (prio) {
        contAlertas++;
        alertas.push({
          id:     contAlertas,
          prio,
          cuando: prio === "risk" ? "hoy" : "+2 días",
          texto:  com.comunidad + " · " + accionSiguiente(com),
          obra:   id,
        });
      }

      obras.push({
        id,
        comunidad:   com.comunidad,
        tipo:        com.tipo_via      || "—",
        estado,
        responsable: com.administrador || "—",
        margen:      calcularMargen(com),
        accion:      accionSiguiente(com),
        alertas:     prio ? 1 : 0,
      });
    }

    const obrasActivas  = obras.filter(o => o.estado === "ejecucion").length;
    const obrasCobro    = obras.filter(o => o.estado === "cobro").length;
    const obrasParadas  = obras.filter(o => o.estado === "parada").length;
    const alertasCrit   = alertas.filter(a => a.prio === "risk").length;

    const kpis = [
      { label: "Obras activas",      valor: String(obrasActivas),  tono: "ok"   },
      { label: "Pendiente cobro",     valor: String(obrasCobro),   tono: "warn" },
      { label: "Paradas/bloqueadas",  valor: String(obrasParadas), tono: obrasParadas > 0 ? "risk" : "ink" },
      { label: "Alertas críticas",    valor: String(alertasCrit),  tono: alertasCrit > 0 ? "risk" : "ink" },
      { label: "Caja",                valor: "—",                  tono: "ink"  },
      { label: "Margen mes",          valor: "—",                  tono: "ink"  },
    ];

    return { obras, kpis, alertas };
  }

  app.options("/api/ara-os/*", (req, res) => {
    responderCORS(res);
    res.status(204).end();
  });

  app.get("/api/ara-os/health", (req, res) => {
    responderCORS(res);
    res.json({
      ok: true,
      modulo: "ara-os",
      version: "0.2.0",
      sheets_id_presente:   !!process.env.GOOGLE_SHEETS_ID,
      google_auth_presente: !!(process.env.GOOGLE_CLIENT_ID &&
                               process.env.GOOGLE_CLIENT_SECRET &&
                               process.env.GOOGLE_REFRESH_TOKEN),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ara-os/obras", async (req, res) => {
    responderCORS(res);

    if (!tokenValido(req)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    try {
      const { obras, kpis, alertas } = await obtenerDatosAraOS();
      res.json({
        obras,
        kpis,
        alertas,
        meta: {
          generado:    new Date().toISOString(),
          total_obras: obras.length,
          fuente:      "Google Sheets · comunidades",
          version:     "0.2.0",
        },
      });
    } catch (err) {
      console.error("[ara-os] Error:", err.message);
      res.status(500).json({ error: "Error leyendo datos de Sheets", detalle: err.message });
    }
  });

  console.log("[ara-os] v0.2.0 · /api/ara-os/obras · /api/ara-os/health");
};
