// ============================================================
// ARA OS — Inferencia de bloqueos operativos
// v0.1.0
//
// Añadir en index.cjs:
//   require("./ara-os-inferencia.cjs")(app);
//
// GET  /api/ara-os/inferencia?token=araujo2026
//   → ejecuta inferencia y devuelve resumen de lo que haría
//
// POST /api/ara-os/inferencia?token=araujo2026
//   → ejecuta inferencia y escribe en bloqueos_operativos
//
// Filosofía:
//   - Infiere desde pisos + comunidades
//   - Solo escribe bloqueos nuevos o actualiza los automáticos
//   - NUNCA toca filas con override_por != vacío
//   - NUNCA borra filas existentes
//   - Auditable: detectado_por = "sistema", detectado_en = fecha
// ============================================================

module.exports = function setupAraOSInferencia(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function cors(res) {
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

  async function escribirFila(rango, valores) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
      valueInputOption: "RAW",
      requestBody: { values: [valores] },
    });
  }

  async function actualizarFila(rango, valores) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
      valueInputOption: "RAW",
      requestBody: { values: [valores] },
    });
  }

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

  // Columnas de bloqueos_operativos (en orden)
  const COLS_BLOQUEO = [
    "comunidad","tipo_bloqueo","severidad","pelota_en","impacto",
    "vecinos_afectados","accion_exacta","detectado_por","detectado_en",
    "ultimo_movimiento_humano","dias_sin_movimiento","override_por","override_en",
    "override_comentario","esperar_hasta","proxima_revision","resuelto","resuelto_en"
  ];

  function filaAPiso(row) {
    const o = {};
    COLS_PISO.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  function filaAComunidad(row) {
    const o = {};
    COLS_COM.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    return o;
  }

  function filaABloqueo(row) {
    const o = {};
    COLS_BLOQUEO.forEach((k, i) => { o[k] = (row[i] || "").trim(); });
    o._rowIndex = row._rowIndex;
    return o;
  }

  function hoy() {
    return new Date().toISOString().slice(0, 10);
  }

  function diasDesde(fecha) {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (isNaN(d)) return null;
    return Math.floor((new Date() - d) / 86400000);
  }

  // ----------------------------------------------------------
  // Reglas de inferencia — scope inicial controlado
  // Solo 4 tipos claros y difíciles de interpretar mal
  // ----------------------------------------------------------

  // ¿Este piso tiene documentación pendiente?
  function pisoTieneDocPendiente(piso) {
    if (piso.documentos_completos === "si" || piso.documentos_completos === "SI") return false;
    if (piso.estado_expediente === "CCPP" || piso.estado_expediente === "historico") return false;
    const pendientes = (piso.documentos_pendientes || "").trim();
    return pendientes.length > 0;
  }

  // ¿Este piso tiene pago pendiente?
  function pisoTienePagoPendiente(piso) {
    const pago = (piso.est_piso_pago || '').toUpperCase().trim();
    return pago === 'F';
  }


  // ¿Este piso tiene financiación pendiente?
  function pisoTieneFinanciacion(piso) {
    const meses = (piso.est_piso_meses_financiar || "").trim();
    const nifFin = (piso.est_piso_nif_financiado || "").toUpperCase();
    const justif = (piso.est_piso_justificante_ingresos || "").toUpperCase();
    const cuenta = (piso.est_piso_cuenta_bancaria || "").toUpperCase();
    if (!meses) return false; // no tiene financiación
    // Tiene financiación pero falta algún doc
    const faltaDocs = [nifFin, justif, cuenta].some(v => v && v !== "OK" && v !== "NO APLICA");
    return faltaDocs;
  }

  // ¿Comunidad tiene contratos/pagos pendientes?
  function comunidadTieneContratosPendientes(com) {
    if (com.fecha_contratos_pagos_completa) return false;
    if (!com.fecha_documentacion_completa) return false;
    // Documentación completa pero contratos no
    const ccppPendientes = [
      com.est_ccpp_contrato, com.est_ccpp_pago
    ].some(v => v && v !== "OK" && v !== "—" && v !== "");
    return ccppPendientes || !com.fecha_contratos_pagos_completa;
  }

  // ¿Comunidad lleva demasiados días sin movimiento humano?
  function comunidadSinMovimiento(com, pisos) {
    // Tomamos la fecha más reciente de contacto en pisos
    let fechaMax = null;
    for (const p of pisos) {
      if (p.fecha_ultimo_contacto) {
        const d = new Date(p.fecha_ultimo_contacto);
        if (!isNaN(d) && (!fechaMax || d > fechaMax)) fechaMax = d;
      }
    }
    if (!fechaMax) {
      // Sin ningún contacto registrado — usar fecha_inicio de comunidad
      if (com.fecha_inicio) {
        const dias = diasDesde(com.fecha_inicio);
        return dias !== null && dias > 21 ? { dias, fecha: com.fecha_inicio } : null;
      }
      return null;
    }
    const dias = Math.floor((new Date() - fechaMax) / 86400000);
    return dias > 21 ? { dias, fecha: fechaMax.toISOString().slice(0, 10) } : null;
  }

  // ----------------------------------------------------------
  // Inferir bloqueos para una comunidad
  // Devuelve array de bloqueos inferidos
  // ----------------------------------------------------------
  function inferirBloqueos(com, pisos) {
    const bloqueos = [];
    const fase = com.fase_presupuesto || "";

    // Solo inferimos en comunidades activas
    if (com.fecha_cycp_completa) return [];
    if (!fase || fase.startsWith("ZZ")) return [];

    // --- 1. DOC_PENDIENTE ---
    const pisosDocPendiente = pisos.filter(pisoTieneDocPendiente);
    if (pisosDocPendiente.length > 0) {
      const viviendas = pisosDocPendiente.map(p => p.vivienda).join(", ");
      const pendientes = [...new Set(
        pisosDocPendiente.flatMap(p =>
          (p.documentos_pendientes || "").split(/[,;|]+/).map(d => d.trim()).filter(Boolean)
        )
      )].slice(0, 5).join(", ");

      bloqueos.push({
        tipo_bloqueo:          "DOC_PENDIENTE",
        severidad:             pisosDocPendiente.length >= 3 ? "critica" : "seguimiento",
        pelota_en:             "vecino",
        impacto:               "bloquea_inicio",
        vecinos_afectados:     viviendas,
        accion_exacta:         `Reclamar documentación: ${pendientes || "ver pisos"}`,
        ultimo_movimiento_humano: "",
        dias_sin_movimiento:   "",
      });
    }

    // --- 2. PAGO_PENDIENTE ---
    const pisosPagoPendiente = pisos.filter(pisoTienePagoPendiente);
    if (pisosPagoPendiente.length > 0) {
      const viviendas = pisosPagoPendiente.map(p => p.vivienda).join(", ");
      bloqueos.push({
        tipo_bloqueo:          "PAGO_PENDIENTE",
        severidad:             "critica",
        pelota_en:             "vecino",
        impacto:               "bloquea_cobro",
        vecinos_afectados:     viviendas,
        accion_exacta:         `Reclamar pago a ${pisosPagoPendiente.length} vecino(s)`,
        ultimo_movimiento_humano: "",
        dias_sin_movimiento:   "",
      });
    }

    // --- 3. FINANCIACION ---
    const pisosFinanciacion = pisos.filter(pisoTieneFinanciacion);
    if (pisosFinanciacion.length > 0) {
      const viviendas = pisosFinanciacion.map(p => p.vivienda).join(", ");
      bloqueos.push({
        tipo_bloqueo:          "FINANCIACION",
        severidad:             "seguimiento",
        pelota_en:             "financiera",
        impacto:               "bloquea_inicio",
        vecinos_afectados:     viviendas,
        accion_exacta:         `Documentación financiación incompleta en ${pisosFinanciacion.length} piso(s)`,
        ultimo_movimiento_humano: "",
        dias_sin_movimiento:   "",
      });
    }

    // --- 4. CONTRATOS_PAGOS ---
    if (comunidadTieneContratosPendientes(com)) {
      bloqueos.push({
        tipo_bloqueo:          "CONTRATOS_PAGOS",
        severidad:             "critica",
        pelota_en:             "administrador",
        impacto:               "bloquea_cobro",
        vecinos_afectados:     "",
        accion_exacta:         "Gestionar contratos y cartas de pago con administrador",
        ultimo_movimiento_humano: "",
        dias_sin_movimiento:   "",
      });
    }

    // --- 5. SIN_MOVIMIENTO ---
    const sinMov = comunidadSinMovimiento(com, pisos);
    if (sinMov && bloqueos.length === 0) {
      // Solo marcamos SIN_MOVIMIENTO si no hay otros bloqueos explícitos
      bloqueos.push({
        tipo_bloqueo:          "SIN_MOVIMIENTO",
        severidad:             sinMov.dias > 30 ? "critica" : "seguimiento",
        pelota_en:             "nosotros",
        impacto:               "bloquea_ejecucion",
        vecinos_afectados:     "",
        accion_exacta:         `Sin movimiento humano en ${sinMov.dias} días — revisar expediente`,
        ultimo_movimiento_humano: sinMov.fecha,
        dias_sin_movimiento:   String(sinMov.dias),
      });
    }

    return bloqueos;
  }

  // ----------------------------------------------------------
  // Lógica principal de inferencia
  // ----------------------------------------------------------
  async function ejecutarInferencia(escribir = false) {
    const [rowsCom, rowsPisos, rowsBloqueos] = await Promise.all([
      leerHoja("comunidades!A:BC"),
      leerHoja("pisos!A:AS"),
      leerHoja("bloqueos_operativos!A:R"),
    ]);

    // Parsear comunidades
    const comunidades = [];
    for (let i = 1; i < rowsCom.length; i++) {
      if (!rowsCom[i][0]) continue;
      comunidades.push(filaAComunidad(rowsCom[i]));
    }

    // Parsear pisos por comunidad
    const pisosPorComunidad = {};
    for (let i = 1; i < rowsPisos.length; i++) {
      if (!rowsPisos[i][0]) continue;
      const p = filaAPiso(rowsPisos[i]);
      if (!p.comunidad) continue;
      if (!pisosPorComunidad[p.comunidad]) pisosPorComunidad[p.comunidad] = [];
      pisosPorComunidad[p.comunidad].push(p);
    }

    // Parsear bloqueos existentes (para no duplicar ni sobrescribir overrides)
    // clave: comunidad + tipo_bloqueo
    const bloqueosExistentes = {};
    for (let i = 1; i < rowsBloqueos.length; i++) {
      const row = [...rowsBloqueos[i]];
      row._rowIndex = i + 1; // 1-indexed para Sheets
      const b = filaABloqueo(row);
      if (!b.comunidad) continue;
      const clave = `${b.comunidad}||${b.tipo_bloqueo}`;
      bloqueosExistentes[clave] = b;
    }

    const resumen = {
      comunidades_analizadas: 0,
      bloqueos_inferidos:     0,
      bloqueos_nuevos:        0,
      bloqueos_actualizados:  0,
      bloqueos_respetados:    0, // tenían override humano
      detalle:                [],
    };

    for (const com of comunidades) {
      const pisos = pisosPorComunidad[com.comunidad] || [];
      const bloqueos = inferirBloqueos(com, pisos);
      if (bloqueos.length === 0) continue;

      resumen.comunidades_analizadas++;
      resumen.bloqueos_inferidos += bloqueos.length;

      for (const b of bloqueos) {
        const clave = `${com.comunidad}||${b.tipo_bloqueo}`;
        const existente = bloqueosExistentes[clave];

        // Si existe y tiene override humano → respetar, no tocar
        if (existente && existente.override_por) {
          resumen.bloqueos_respetados++;
          resumen.detalle.push({
            accion: "respetado",
            comunidad: com.comunidad,
            tipo: b.tipo_bloqueo,
            motivo: `override por ${existente.override_por}`,
          });
          continue;
        }

        // Si existe y ya está resuelto → no tocar
        if (existente && existente.resuelto === "si") {
          resumen.bloqueos_respetados++;
          continue;
        }

        // Construir fila
        const fila = [
          com.comunidad,
          b.tipo_bloqueo,
          b.severidad,
          b.pelota_en,
          b.impacto,
          b.vecinos_afectados,
          b.accion_exacta,
          "sistema",
          hoy(),
          b.ultimo_movimiento_humano,
          b.dias_sin_movimiento,
          "", // override_por
          "", // override_en
          "", // override_comentario
          "", // esperar_hasta
          "", // proxima_revision
          "no",
          "", // resuelto_en
        ];

        if (!existente) {
          // Bloqueo nuevo
          resumen.bloqueos_nuevos++;
          resumen.detalle.push({
            accion: "nuevo",
            comunidad: com.comunidad,
            tipo: b.tipo_bloqueo,
            severidad: b.severidad,
            accion_exacta: b.accion_exacta,
          });
          if (escribir) {
            await escribirFila("bloqueos_operativos!A:R", fila);
          }
        } else {
          // Actualizar bloqueo automático existente
          resumen.bloqueos_actualizados++;
          resumen.detalle.push({
            accion: "actualizado",
            comunidad: com.comunidad,
            tipo: b.tipo_bloqueo,
          });
          if (escribir) {
            const rango = `bloqueos_operativos!A${existente._rowIndex}:R${existente._rowIndex}`;
            await actualizarFila(rango, fila);
          }
        }
      }
    }

    return resumen;
  }

  // ----------------------------------------------------------
  // Rutas
  // ----------------------------------------------------------
  app.options("/api/ara-os/inferencia", (req, res) => {
    cors(res); res.status(204).end();
  });

  // GET → simula sin escribir
  app.get("/api/ara-os/inferencia", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });
    try {
      const resumen = await ejecutarInferencia(false);
      res.json({ ...resumen, modo: "simulacion" });
    } catch (err) {
      console.error("[ara-os-inferencia] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST → escribe en Sheets
  app.post("/api/ara-os/inferencia", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(403).json({ error: "No autorizado" });
    try {
      const resumen = await ejecutarInferencia(true);
      res.json({ ...resumen, modo: "escritura" });
    } catch (err) {
      console.error("[ara-os-inferencia] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[ara-os-inferencia] v0.1.0 · GET /api/ara-os/inferencia (simula) · POST (escribe)");
};
