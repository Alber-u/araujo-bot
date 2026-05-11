// ============================================================
// ARA OS — Panel de Obras con visión económica
// v0.3.0 — Sprint 3 · estado_ejecucion separado de fase_presupuesto
//
// require("./ara-os-panel-obras.cjs")(app);
//
// GET /api/ara-os/panel-obras?token=araujo2026
//
// Cambios Sprint 3:
//   - Nueva columna BF `estado_ejecucion` en Sheet `comunidades`
//     Valores válidos (de ENTIDADES.md):
//       sin_empezar | lista | ejecucion | parada | terminada
//   - clasificarObra() prioriza estado_ejecucion sobre fase_presupuesto:
//       · terminada            → facturadas
//       · ejecucion | parada   → en_ejecucion
//       · lista                → para_empezar
//       · sin_empezar | vacío  → fallback a la lógica antigua (fase)
//   - El item devuelto incluye estado_ejecucion para que el frontend
//     pueda mostrar un badge informativo
//   - La fase administrativa NO desaparece: sigue ahí, pero ya no
//     manda en la clasificación operativa
//
// Cambios Sprint 2 (heredados):
//   - Columna BE `motivo_pipeline`, usada en SIGUIENTE MES
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

  // Mismo orden de columnas que en presupuestos.cjs / ara-os.cjs
  // Sprint 2: añadida motivo_pipeline (BE)
  // Sprint 3: añadida estado_ejecucion (BF)
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
    "estado_ejecucion"
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

  // ============================================================
  // MOTIVOS DE PIPELINE (Sprint 2)
  // ============================================================
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

  // ============================================================
  // ESTADO DE EJECUCIÓN (Sprint 3)
  // Valores tomados de docs/000-vision/ENTIDADES.md
  // ============================================================
  const ESTADOS_EJECUCION_VALIDOS = new Set([
    "sin_empezar",
    "lista",
    "ejecucion",
    "parada",
    "terminada",
  ]);

  function normalizarEstadoEjecucion(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "";  // vacío = todavía no clasificada → fallback en clasificarObra
    return ESTADOS_EJECUCION_VALIDOS.has(v) ? v : "";
  }

  // ============================================================
  // REGLAS DE AGRUPACIÓN
  //
  // Prioridad:
  //   1. Si estado_ejecucion está informado → manda él
  //   2. Si no, fallback a la lógica antigua basada en fase
  //
  // Esto permite migración gradual: las obras que vayas
  // clasificando a mano en la columna BF saldrán correctas;
  // el resto se clasifica como antes hasta que las marques.
  // ============================================================
  function clasificarObra(obra) {
    const fase = (obra.fase_presupuesto || "").trim();
    if (fase.startsWith("ZZ_")) return null;
    if (fase === "01_CONTACTO") return null;
    if (fase === "02_VISITA") return null;
    if (fase === "03_ENVIO_PTO") return null;

    // --- Camino nuevo: estado_ejecucion manda ---
    const estado = normalizarEstadoEjecucion(obra.estado_ejecucion);
    if (estado === "terminada")  return "facturadas";
    if (estado === "ejecucion")  return "en_ejecucion";
    if (estado === "parada")     return "en_ejecucion";
    if (estado === "lista")      return "para_empezar";
    if (estado === "sin_empezar") return "siguiente_mes";

    // --- Fallback: lógica antigua basada en fase administrativa ---
    const cycp_completa  = !!obra.fecha_cycp_completa;
    const doc_completa   = !!obra.fecha_documentacion_completa;
    const visita_emasesa = !!obra.fecha_visita_emasesa;

    if (cycp_completa) return "facturadas";

    if (fase === "07_PTE_CYCP" || fase === "08_CYCP") {
      return "en_ejecucion";
    }

    if (doc_completa || visita_emasesa) {
      return "para_empezar";
    }

    if (fase === "04_ACEPTACION_PTO" || fase === "05_DOCUMENTACION" || fase === "06_VISITA_EMASESA") {
      return "siguiente_mes";
    }

    return null;
  }

  // ============================================================
  // ENDPOINT PRINCIPAL
  // ============================================================
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

      const grupos = {
        facturadas: [],
        en_ejecucion: [],
        para_empezar: [],
        siguiente_mes: []
      };

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
          estado_ejecucion: normalizarEstadoEjecucion(obra.estado_ejecucion),
        };
        grupos[grupo].push(item);
      }

      for (const k of Object.keys(grupos)) {
        grupos[k].sort((a, b) => b.pto_total - a.pto_total);
      }

      function sumarGrupo(arr) {
        return arr.reduce((s, x) => s + x.pto_total, 0);
      }

      const totales = {
        facturadas: sumarGrupo(grupos.facturadas),
        en_ejecucion: sumarGrupo(grupos.en_ejecucion),
        para_empezar: sumarGrupo(grupos.para_empezar),
        siguiente_mes: sumarGrupo(grupos.siguiente_mes)
      };
      totales.total = totales.facturadas + totales.en_ejecucion + totales.para_empezar + totales.siguiente_mes;

      const totales_fmt = {};
      for (const k of Object.keys(totales)) {
        totales_fmt[k] = formatEur(totales[k]);
      }

      const cuentas = {
        facturadas: grupos.facturadas.length,
        en_ejecucion: grupos.en_ejecucion.length,
        para_empezar: grupos.para_empezar.length,
        siguiente_mes: grupos.siguiente_mes.length,
        total: grupos.facturadas.length + grupos.en_ejecucion.length
             + grupos.para_empezar.length + grupos.siguiente_mes.length
      };

      function sumarDias(arr) {
        return arr.reduce((s, x) => {
          const d = parseFloat(String(x.tiempo_previsto || "0").replace(",", "."));
          return s + (isNaN(d) ? 0 : d);
        }, 0);
      }
      const dias_para_empezar = sumarDias(grupos.para_empezar);
      const dias_siguiente_mes = sumarDias(grupos.siguiente_mes);

      // Métrica de migración Sprint 3: cuántas obras tienen ya
      // estado_ejecucion informado vs cuántas siguen con fallback.
      // Sirve para saber el progreso del trabajo manual de clasificación.
      let con_estado_ejecucion = 0;
      let sin_estado_ejecucion = 0;
      for (const k of Object.keys(grupos)) {
        for (const item of grupos[k]) {
          if (item.estado_ejecucion) con_estado_ejecucion++;
          else sin_estado_ejecucion++;
        }
      }

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.3.0",
        grupos,
        totales,
        totales_fmt,
        cuentas,
        migracion_estado_ejecucion: {
          clasificadas: con_estado_ejecucion,
          pendientes:   sin_estado_ejecucion,
          total:        con_estado_ejecucion + sin_estado_ejecucion,
        },
        dias_previstos: {
          para_empezar: dias_para_empezar,
          siguiente_mes: dias_siguiente_mes,
          total: dias_para_empezar + dias_siguiente_mes
        }
      });
    } catch (err) {
      console.error("[panel-obras]", err);
      res.status(500).json({ error: err.message });
    }
  });
};
