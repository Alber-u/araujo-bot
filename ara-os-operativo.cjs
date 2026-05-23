// ============================================================
// ARA OS — Endpoint operativo
// v0.1.0
//
// Añadir en index.cjs:
//   require("./ara-os-operativo.cjs")(app);
//
// GET /api/ara-os/operativo?token=araujo2026
//
// Devuelve para cada comunidad activa:
//   - estado global (de comunidades)
//   - pisos: total, ok, bloqueados, sin_estado
//   - bloqueos detallados por piso
//   - siguiente acción exacta
//   - prioridad calculada
// ============================================================

module.exports = function setupAraOSOperativo(app) {

  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) {
    return validToken(req.query.token);
  }

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

  // ----------------------------------------------------------
  // Columnas de comunidades (igual que ara-os.cjs)
  // ----------------------------------------------------------
  const COLS_COM = [
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

  // ----------------------------------------------------------
  // Columnas de pisos
  // ----------------------------------------------------------
  const COLS_PISO = [
    "telefono","comunidad","vivienda","nota_simple","nombre","paso_actual",
    "documento_actual","estado_expediente","fecha_inicio","fecha_primer_contacto",
    "fecha_ultimo_contacto","fecha_limite_documentacion","fecha_limite_firma",
    "documentos_completos","alerta_plazo","documentos_recibidos","documentos_pendientes",
    "documentos_opcionales_pendientes","ultimo_documento_fallido","fecha_ultimo_fallo",
    "reintento_hasta","motivo_bloqueo_actual","prioridad_expediente",
    "requiere_intervencion_humana","documentos_opcionales_descartados",
    "notificacion_financiacion_enviada","documentos_recibidos_sin_archivo",
    "documentos_no_aplica",
    "est_piso_toma_datos","est_piso_nif_toma_datos","est_piso_titularidad",
    "est_piso_empadronamiento","est_piso_contrato_alquiler","est_piso_nif_propietario",
    "est_piso_licencia_apertura","est_piso_escrituras_empresa","est_piso_poderes",
    "est_piso_nif_apoderado","est_piso_meses_financiar","est_piso_nif_financiado",
    "est_piso_justificante_ingresos","est_piso_cuenta_bancaria","est_piso_disidente",
    "est_piso_contrato","est_piso_pago",
  ];

  function filaAComunidad(row) {
    const o = {};
    COLS_COM.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  function filaAPiso(row) {
    const o = {};
    COLS_PISO.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  // ----------------------------------------------------------
  // ¿Está este piso bloqueado?
  // ----------------------------------------------------------
  function estadoPiso(piso) {
    if (piso.requiere_intervencion_humana === "si") return "intervencion";
    if (piso.documentos_completos === "si" || piso.documentos_completos === "SI") return "ok";
    if (piso.estado_expediente === "CCPP") return "ok";
    if (piso.estado_expediente === "historico") return "ok";
    if (piso.motivo_bloqueo_actual) return "bloqueado";
    if (piso.ultimo_documento_fallido) return "bloqueado";
    if (piso.paso_actual) return "en_proceso";
    return "sin_estado";
  }

  // Documentos pendientes como lista
  function docsPendientes(piso) {
    if (!piso.documentos_pendientes) return [];
    return piso.documentos_pendientes
      .split(/[,;|]+/)
      .map(d => d.trim())
      .filter(Boolean);
  }

  // ----------------------------------------------------------
  // Prioridad de la comunidad (para ordenar la cola)
  // 1 = máxima urgencia
  // ----------------------------------------------------------
  function calcularPrioridad(com, resumen) {
    if (resumen.intervenciones > 0) return 1;
    if (resumen.bloqueados > 0 && com.fecha_limite_documentacion_vecinos) {
      const dias = Math.ceil(
        (new Date(com.fecha_limite_documentacion_vecinos) - new Date()) / 86400000
      );
      if (dias < 7) return 1;
      if (dias < 21) return 2;
    }
    if (resumen.bloqueados > 0) return 2;
    if (resumen.en_proceso > 0) return 3;
    if (resumen.sin_estado > 0) return 4;
    return 5;
  }

  // Siguiente acción legible
  function accionComunidad(com, resumen, pisosBloqueados) {
    if (resumen.intervenciones > 0)
      return `⛔ Intervención urgente · ${resumen.intervenciones} piso(s)`;
    if (pisosBloqueados.length > 0) {
      const primero = pisosBloqueados[0];
      const motivo = primero.motivo_bloqueo_actual || primero.ultimo_documento_fallido || "bloqueo sin detalle";
      return `🔴 ${pisosBloqueados.length} bloqueado(s) · ${primero.vivienda}: ${motivo}`;
    }
    if (com.fase_presupuesto === "05_documentacion" || com.fase_presupuesto === "06_visita_emasesa")
      return `📄 Documentación en curso · ${resumen.ok}/${resumen.total} OK`;
    if (com.fecha_visita_emasesa && !com.fecha_documentacion_completa)
      return `🏛️ Visita EMASESA · ${com.fecha_visita_emasesa}`;
    if (com.fecha_documentacion_completa && !com.fecha_contratos_pagos_completa)
      return `📝 Contratos y pagos pendientes`;
    if (com.fecha_contratos_pagos_completa && !com.fecha_cycp_completa)
      return `⏳ Pendiente CYCP`;
    return `▶ En proceso · ${resumen.ok}/${resumen.total} OK`;
  }

  // ----------------------------------------------------------
  // Fases activas que aparecen en el panel
  // ----------------------------------------------------------
  const FASES_ACTIVAS = [
    "04_aceptacion_pto","05_documentacion","06_visita_emasesa",
    "07_pte_cycp","08_cycp",
  ];

  // ----------------------------------------------------------
  // Lógica principal
  // ----------------------------------------------------------
  async function obtenerOperativo() {
    const [rowsCom, rowsPisos] = await Promise.all([
      leerHoja("comunidades!A:BC"),
      leerHoja("pisos!A:AS"),
    ]);

    // Parsear comunidades
    const comunidades = [];
    for (let i = 1; i < rowsCom.length; i++) {
      if (!rowsCom[i][0]) continue;
      comunidades.push(filaAComunidad(rowsCom[i]));
    }

    // Parsear pisos y agrupar por comunidad
    const pisosPorComunidad = {};
    for (let i = 1; i < rowsPisos.length; i++) {
      if (!rowsPisos[i][0]) continue;
      const piso = filaAPiso(rowsPisos[i]);
      const com = piso.comunidad;
      if (!com) continue;
      if (!pisosPorComunidad[com]) pisosPorComunidad[com] = [];
      pisosPorComunidad[com].push(piso);
    }

    // Construir panel operativo — solo comunidades activas
    const panel = [];

    for (const com of comunidades) {
      const fase = com.fase_presupuesto || "";
      const terminada = com.fecha_cycp_completa;
      const rechazada = (com.motivo_rechazo || "").toLowerCase().includes("rechaz") ||
                        fase.includes("ZZ");

      // Solo comunidades activas
      if (terminada || rechazada) continue;
      if (!FASES_ACTIVAS.includes(fase) &&
          !com.fecha_documentacion_completa &&
          !com.fecha_contratos_pagos_completa) continue;

      const pisos = pisosPorComunidad[com.comunidad] || [];

      // Clasificar pisos
      const resumen = { total: pisos.length, ok: 0, bloqueados: 0, en_proceso: 0, sin_estado: 0, intervenciones: 0 };
      const pisosBloqueados = [];

      for (const piso of pisos) {
        const ep = estadoPiso(piso);
        if (ep === "ok")           resumen.ok++;
        else if (ep === "bloqueado") { resumen.bloqueados++; pisosBloqueados.push(piso); }
        else if (ep === "intervencion") { resumen.intervenciones++; resumen.bloqueados++; pisosBloqueados.push(piso); }
        else if (ep === "en_proceso")  resumen.en_proceso++;
        else                           resumen.sin_estado++;
      }

      const prio = calcularPrioridad(com, resumen);
      const accion = accionComunidad(com, resumen, pisosBloqueados);

      // Días hasta fecha límite
      let diasLimite = null;
      if (com.fecha_limite_documentacion_vecinos) {
        diasLimite = Math.ceil(
          (new Date(com.fecha_limite_documentacion_vecinos) - new Date()) / 86400000
        );
      }

      panel.push({
        comunidad:     com.comunidad,
        administrador: com.administrador || "—",
        fase:          com.fase_presupuesto || "—",
        prioridad:     prio,
        accion,
        dias_limite:   diasLimite,
        resumen,
        // Detalle de bloqueos (max 5 para no saturar)
        bloqueos: pisosBloqueados.slice(0, 5).map(p => ({
          vivienda:  p.vivienda,
          nombre:    p.nombre,
          motivo:    p.motivo_bloqueo_actual || p.ultimo_documento_fallido || "sin detalle",
          pendientes: docsPendientes(p),
          intervencion: p.requiere_intervencion_humana === "si",
        })),
        // Estado CCPP de la comunidad
        ccpp: {
          contrato_firmado:  com.est_ccpp_contrato_firmado  || "—",
          toma_datos:        com.est_ccpp_toma_datos        || "—",
          nif:               com.est_ccpp_nif               || "—",
          acta_pte:          com.est_ccpp_acta_pte          || "—",
          factura_emasesa:   com.est_ccpp_factura_emasesa   || "—",
          contrato:          com.est_ccpp_contrato          || "—",
          pago:              com.est_ccpp_pago              || "—",
        },
        // Fechas clave
        fechas: {
          limite_documentacion: com.fecha_limite_documentacion_vecinos || null,
          visita_emasesa:       com.fecha_visita_emasesa               || null,
          documentacion_ok:     com.fecha_documentacion_completa       || null,
          contratos_pagos_ok:   com.fecha_contratos_pagos_completa     || null,
        },
      });
    }

    // Ordenar por prioridad
    panel.sort((a, b) => a.prioridad - b.prioridad || a.comunidad.localeCompare(b.comunidad));

    return panel;
  }

  // ----------------------------------------------------------
  // Rutas
  // ----------------------------------------------------------
  app.options("/api/ara-os/operativo", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.get("/api/ara-os/operativo", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });

    try {
      const panel = await obtenerOperativo();
      res.json({
        panel,
        meta: {
          generado:    new Date().toISOString(),
          total:       panel.length,
          urgentes:    panel.filter(c => c.prioridad === 1).length,
          con_bloqueo: panel.filter(c => c.resumen.bloqueados > 0).length,
          version:     "0.1.0",
        },
      });
    } catch (err) {
      console.error("[ara-os-operativo] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-operativo] v0.1.0 · /api/ara-os/operativo");
};
