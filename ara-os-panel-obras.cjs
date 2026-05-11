// ============================================================
// ARA OS — Panel de Obras · 11 fases del flujo real
// v0.5.0 — Fases JM: 09 FINANCIACIÓN · 10 BLOQUEOS · 11 PREPARADA
//
// require("./ara-os-panel-obras.cjs")(app);
//
// GET /api/ara-os/panel-obras?token=araujo2026
//
// Las 11 fases del flujo real de Instalaciones Araujo:
//
//   GUILLERMO (admin/presupuestos):
//     01_CONTACTO        Primer contacto
//     02_VISITA          Visita técnica
//     03_ENVIO_PTO       Presupuesto enviado
//     04_ACEPTACION_PTO  Esperando aceptación
//     05_DOCUMENTACION   Documentación Plan 5
//     06_VISITA_EMASESA  Visita EMASESA
//     07_PTE_CYCP        Pendiente CYCP
//     08_CYCP            CYCP en marcha
//
//   JOSÉ MANUEL (obra):
//     09_FINANCIACION    Pdte. cobrar/pagar
//     10_BLOQUEOS        Conflicto / parada
//     11_PREPARADA       Lista para iniciar obra
//
// Columna nueva BF `fase_jm` en Sheet `comunidades`:
//   Valores: "financiacion" | "bloqueo" | "preparada" | "" (vacío)
//   Solo se respeta si la obra está en 08_CYCP o tiene fecha_cycp_completa
//   rellena (regla de Alberto: 09/10/11 son post-CYCP).
//
// Filtro de cerradas:
//   - Una obra con fecha_cycp_completa rellena se descarta del panel
//     SALVO que tenga fase_jm marcada → entonces va a la columna JM.
//
// KPIs operativos:
//   - facturacion_ejecutable = fases 06 + 07 + 08 + 11
//   - dias_ejecucion_preparadas = ídem
//
// Lo que NO se toca:
//   - presupuestos.cjs (regla 1)
//   - motivo_pipeline (Sprint 2)
//   - sistema de financiación de vecinos de Guille (vive en pisos/expedientes)
// ============================================================

module.exports = function setupAraOSPanelObras(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
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

  // Sprint 2: añadida motivo_pipeline (BE)
  // v0.5.0: BF se renombra de `bloqueada` a `fase_jm` (financiacion|bloqueo|preparada)
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
    "motivo_rechazo",
    "motivo_pipeline",
    "fase_jm"
  ];

  function rowToObj(row) {
    const o = {};
    for (let i = 0; i < COLS.length; i++) {
      o[COLS[i]] = row[i] || "";
    }
    return o;
  }

  function parseImporte(s) {
    if (!s) return 0;
    if (typeof s === "number") return s;
    let limpio = String(s).replace(/[€\s]/g, "");
    if (limpio.includes(",")) {
      limpio = limpio.replace(/\./g, "").replace(/,/g, ".");
    }
    const n = parseFloat(limpio);
    return isNaN(n) ? 0 : n;
  }

  function formatEur(n) {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  // MOTIVOS DE PIPELINE (Sprint 2 · sigue intacto)
  const MOTIVOS_VALIDOS = new Set([
    "doc_pendiente",
    "emasesa_pendiente",
    "cliente_espera",
    "financiacion",
    "hueco_cuadrilla",
    "lista",
  ]);

  function normalizarMotivo(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "sin_clasificar";
    return MOTIVOS_VALIDOS.has(v) ? v : "sin_clasificar";
  }

  // FASE JM (v0.5.0) — la marca José Manuel manualmente
  const FASE_JM_VALIDAS = new Set(["financiacion", "bloqueo", "preparada"]);

  function normalizarFaseJM(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "";
    return FASE_JM_VALIDAS.has(v) ? v : "";
  }

  // LAS 11 FASES (orden de aparición en el panel)
  const FASES = [
    "01_CONTACTO",
    "02_VISITA",
    "03_ENVIO_PTO",
    "04_ACEPTACION_PTO",
    "05_DOCUMENTACION",
    "06_VISITA_EMASESA",
    "07_PTE_CYCP",
    "08_CYCP",
    "09_FINANCIACION",
    "10_BLOQUEOS",
    "11_PREPARADA",
  ];

  // Mapa fase_jm → fase del panel
  const FASE_JM_TO_PANEL = {
    "financiacion": "09_FINANCIACION",
    "bloqueo":      "10_BLOQUEOS",
    "preparada":    "11_PREPARADA",
  };

  // CLASIFICACIÓN v0.5.0
  //
  // Regla de Alberto: las fases JM (09/10/11) solo se respetan si la
  // obra ya pasó por CYCP. Si la obra está en una fase admin temprana
  // y JM ha marcado algo, se ignora y se queda en su fase admin.
  //
  //  - Sin fase_jm y obra cerrada (cycp_completa) → null (no entra)
  //  - Sin fase_jm y fase ZZ                       → null
  //  - Sin fase_jm                                 → su fase admin
  //  - Con fase_jm y obra en 08 o cerrada          → fase JM correspondiente
  //  - Con fase_jm pero obra NO en 08 ni cerrada   → su fase admin (la marca JM se ignora)
  function clasificarObra(obra) {
    const fase = (obra.fase_presupuesto || "").trim();
    if (fase.startsWith("ZZ_")) return null;

    const cerrada    = !!(obra.fecha_cycp_completa && String(obra.fecha_cycp_completa).trim());
    const en_cycp    = (fase === "08_CYCP");
    const post_cycp  = cerrada || en_cycp;
    const faseJM     = normalizarFaseJM(obra.fase_jm);

    // ¿JM marcó algo y la obra ya está en 08 o cerrada? → fase JM
    if (faseJM && post_cycp) {
      return FASE_JM_TO_PANEL[faseJM];
    }

    // Obra cerrada sin marca JM → fuera del panel (ya está terminada)
    if (cerrada) return null;

    // Resto → su fase admin
    if (FASES.includes(fase)) return fase;
    return null;
  }

  // ENDPOINT
  app.get("/api/ara-os/panel-obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const rows = await leerHoja("comunidades!A2:BF");
      const obras = rows
        .filter(r => r[0])
        .map(rowToObj);

      const grupos = {};
      for (const f of FASES) grupos[f] = [];

      for (const obra of obras) {
        const grupo = clasificarObra(obra);
        if (!grupo) continue;

        const importe = parseImporte(obra.pto_total);
        const item = {
          comunidad: obra.comunidad,
          direccion: obra.direccion,
          fase: obra.fase_presupuesto,
          pto_total: importe,
          pto_total_fmt: formatEur(importe),
          tiempo_previsto: obra.tiempo_previsto,
          fecha_visita_emasesa: obra.fecha_visita_emasesa,
          fecha_documentacion_completa: obra.fecha_documentacion_completa,
          fecha_cycp_completa: obra.fecha_cycp_completa,
          fecha_envio_contratos_pagos: obra.fecha_envio_contratos_pagos,
          est_ccpp_pago: obra.est_ccpp_pago,
          est_ccpp_factura_emasesa: obra.est_ccpp_factura_emasesa,
          notas_pto: obra.notas_pto,
          motivo_pipeline: normalizarMotivo(obra.motivo_pipeline),
          fase_jm: normalizarFaseJM(obra.fase_jm),
        };
        grupos[grupo].push(item);
      }

      for (const k of Object.keys(grupos)) {
        grupos[k].sort((a, b) => b.pto_total - a.pto_total);
      }

      function sumarGrupo(arr) {
        return arr.reduce((s, x) => s + x.pto_total, 0);
      }
      const totales = {};
      for (const f of FASES) totales[f] = sumarGrupo(grupos[f]);
      totales.total = FASES.reduce((s, f) => s + totales[f], 0);

      const totales_fmt = {};
      for (const k of Object.keys(totales)) {
        totales_fmt[k] = formatEur(totales[k]);
      }

      const cuentas = {};
      for (const f of FASES) cuentas[f] = grupos[f].length;
      cuentas.total = FASES.reduce((s, f) => s + cuentas[f], 0);

      function sumarDias(arr) {
        return arr.reduce((s, x) => {
          const d = parseFloat(String(x.tiempo_previsto || "0").replace(",", "."));
          return s + (isNaN(d) ? 0 : d);
        }, 0);
      }
      const dias_previstos = {};
      for (const f of FASES) dias_previstos[f] = sumarDias(grupos[f]);
      dias_previstos.total = FASES.reduce((s, f) => s + dias_previstos[f], 0);

      // KPIs operativos:
      //  - "Facturación ejecutable" = fases 06-08 + 11 (las realmente listas)
      //  - "Días ejecución preparados" = ídem
      //  - 09 (financiación) y 10 (bloqueos) NO entran como ejecutables
      const FASES_PREPARADAS = ["06_VISITA_EMASESA", "07_PTE_CYCP", "08_CYCP", "11_PREPARADA"];
      const dias_ejecucion_preparadas = FASES_PREPARADAS.reduce(
        (s, f) => s + dias_previstos[f], 0
      );
      const facturacion_ejecutable = FASES_PREPARADAS.reduce(
        (s, f) => s + totales[f], 0
      );

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.5.0",
        fases: FASES,
        grupos,
        totales,
        totales_fmt,
        cuentas,
        dias_previstos,
        kpis: {
          dias_ejecucion_preparadas,
          dias_ejecucion_preparadas_fmt: dias_ejecucion_preparadas.toFixed(1) + " d",
          facturacion_ejecutable,
          facturacion_ejecutable_fmt: formatEur(facturacion_ejecutable),
        },
      });
    } catch (err) {
      console.error("[panel-obras]", err);
      res.status(500).json({ error: err.message });
    }
  });
};
