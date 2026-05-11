// ============================================================
// ARA OS — Panel de Obras · 11 fases · Conectado a bloqueos
// v0.7.1 — Reglas estrictas: PREPARADA solo sin bloqueos · cerradas siempre fuera
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
//     09_FINANCIACION    Inferida: bloqueo FINANCIACION abierto
//     10_BLOQUEOS        Inferida: bloqueo crítico de JM (no fin) abierto
//     11_PREPARADA       Inferida: fase 08 sin bloqueos abiertos
//
// CAMBIO ARQUITECTÓNICO v0.6.0:
//   - El panel deja de pedir datos nuevos al Sheet (columna fase_jm).
//   - Lee bloqueos_operativos (ya pobladas por ara-os-inferencia.cjs)
//     y deduce 09/10/11 automáticamente.
//   - Cada tarjeta de obra trae sus bloqueos abiertos para mostrar
//     `pelota_en` y `accion_exacta` en el panel.
//
// Por qué este cambio:
//   El manifiesto ARA_OS_QUE_ES.md prohíbe sistemas de alertas paralelos.
//   La pestaña bloqueos_operativos ya existe con todos los campos que
//   estábamos a punto de inventar (pelota_en, owner, accion_exacta,
//   severidad...). Conectar es construir; duplicar es deuda técnica.
//
// Lo que NO se toca:
//   - ara-os-inferencia.cjs (motor de detección, zona de Guillermo)
//   - ara-os-panel.cjs (endpoint /api/ara-os/panel original)
//   - bloqueos_operativos (lectura solamente)
//   - comunidades.fase_jm (columna BF queda inerte, se mantiene por compat)
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

  // Generador de ccpp_id idéntico al de presupuestos.cjs.
  // Se usa para que el frontend pueda enlazar al expediente
  // existente sin tener que duplicar la lógica de hashing.
  const crypto = require("crypto");
  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto
      .createHash("md5")
      .update(direccion || "")
      .digest("hex")
      .slice(0, 6);
    return `ccpp_${slug}_${hash}`;
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

  // FASE JM (heredado v0.5.0) — ya NO se usa para clasificar.
  // Mantenido por compatibilidad si la columna BF tiene datos.
  const FASE_JM_VALIDAS = new Set(["financiacion", "bloqueo", "preparada"]);

  function normalizarFaseJM(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "";
    return FASE_JM_VALIDAS.has(v) ? v : "";
  }

  // ============================================================
  // BLOQUEOS (v0.6.0) — leídos de bloqueos_operativos
  // ============================================================
  // Columnas reales de la pestaña, copiadas de ara-os-inferencia.cjs
  const COLS_BLOQUEO = [
    "comunidad","tipo_bloqueo","severidad","pelota_en","impacto",
    "vecinos_afectados","accion_exacta","detectado_por","detectado_en",
    "ultimo_movimiento_humano","dias_sin_movimiento",
    "override_por","override_en","override_comentario",
    "esperar_hasta","proxima_revision","resuelto","resuelto_en",
    "owner","owner_override","owner_override_por","comentario_operativo"
  ];

  function filaABloqueo(row) {
    const o = {};
    for (let i = 0; i < COLS_BLOQUEO.length; i++) {
      o[COLS_BLOQUEO[i]] = (row[i] || "").toString().trim();
    }
    return o;
  }

  function ownerEfectivo(b) {
    if (b.owner_override && b.owner_override.trim()) return b.owner_override.trim();
    return b.owner || "";
  }

  // ============================================================
  // AVANCE DE DOCUMENTACIÓN (v0.7.0)
  //
  // Misma fórmula que documentacion.cjs · función calcularResumenManual
  // (acordada en sesión 04/05/2026):
  //
  //   OK / 6 / 12 / 18 / FFCC → hecho   (cuenta en hechos Y en total)
  //   F                        → pdte    (cuenta en total, NO en hechos)
  //   OP / NP / vacío          → no aplica (no cuenta)
  //
  // Aplicado a:
  //   - 9 columnas est_ccpp_* de la propia obra (en `comunidades`)
  //   - 17 columnas est_piso_* de cada piso de esa obra (en `pisos`)
  // ============================================================
  const COLS_EST_CCPP = [
    "est_ccpp_contrato_firmado","est_ccpp_toma_datos","est_ccpp_nif",
    "est_ccpp_acta_pte","est_ccpp_acta_pto","est_ccpp_renuncia_gp",
    "est_ccpp_factura_emasesa","est_ccpp_contrato","est_ccpp_pago",
  ];

  // Estados de piso · ocupan columnas AC..AS de `pisos!A:AS` (índices 28..44)
  const COLS_EST_PISO_IDX_INI = 28; // AC
  const COLS_EST_PISO_IDX_FIN = 44; // AS inclusive → 17 columnas

  function contarEstado(valor) {
    const v = String(valor || "").trim().toUpperCase();
    if (v === "OP" || v === "NP" || v === "") return { total: 0, hecho: 0 };
    // Hechos: OK, 6, 12, 18, FFCC
    if (v === "OK" || v === "6" || v === "12" || v === "18" || v === "FFCC") {
      return { total: 1, hecho: 1 };
    }
    // F u otros valores → pendiente (cuenta en total, no en hecho)
    return { total: 1, hecho: 0 };
  }

  function calcularAvanceCcpp(obra) {
    let hecho = 0, total = 0;
    for (const c of COLS_EST_CCPP) {
      const r = contarEstado(obra[c]);
      hecho += r.hecho;
      total += r.total;
    }
    return { hecho, total };
  }

  function calcularAvancePiso(rowPiso) {
    let hecho = 0, total = 0;
    for (let i = COLS_EST_PISO_IDX_INI; i <= COLS_EST_PISO_IDX_FIN; i++) {
      const r = contarEstado(rowPiso[i]);
      hecho += r.hecho;
      total += r.total;
    }
    return { hecho, total };
  }

  // Tipos de bloqueo que asignamos a JM según el manifiesto
  const TIPOS_JM = new Set([
    "FINANCIACION", "ADMIN_SILENCIO", "PRESIDENTE_INACTIVO",
    "PORCENTAJE_MINIMO", "INCIDENCIA_TECNICA", "MATERIAL_PENDIENTE"
  ]);

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

  // ============================================================
  // CLASIFICACIÓN v0.6.0
  //
  // Las fases 09/10/11 se infieren del sistema de bloqueos:
  //
  //   - Si la obra tiene un bloqueo FINANCIACION abierto y ya está
  //     en 08 o cerrada → 09_FINANCIACION
  //   - Si tiene cualquier otro bloqueo crítico de JM y está en 08
  //     o cerrada → 10_BLOQUEOS
  //   - Si está en 08_CYCP sin bloqueos abiertos → 11_PREPARADA
  //   - Si está cerrada (cycp_completa) sin bloqueos → null (ya hecha)
  //
  // Las fases 01-07 se siguen tomando de fase_presupuesto sin
  // inferencia, igual que en v0.5.0.
  // ============================================================
  function clasificarObra(obra, bloqueosObra) {
    const fase = (obra.fase_presupuesto || "").trim();
    if (fase.startsWith("ZZ_")) return null;

    // Obra cerrada formalmente → fuera del panel SIEMPRE
    // (sin excepciones · la fase JM manual ya no aplica desde v0.6.0)
    const cerrada = !!(obra.fecha_cycp_completa && String(obra.fecha_cycp_completa).trim());
    if (cerrada) return null;

    // Bloqueos abiertos
    const activos     = (bloqueosObra || []).filter(b => b.resuelto !== "si");
    const tieneAlguno = activos.length > 0;
    const tieneFin    = activos.some(b => b.tipo_bloqueo === "FINANCIACION");
    const tieneJMOtro = activos.some(b =>
      b.tipo_bloqueo !== "FINANCIACION" &&
      TIPOS_JM.has(b.tipo_bloqueo) &&
      b.severidad === "critica"
    );

    // Reglas para obra en 08_CYCP (zona post-admin de Guille)
    if (fase === "08_CYCP") {
      if (tieneFin)    return "09_FINANCIACION";
      if (tieneJMOtro) return "10_BLOQUEOS";
      // PREPARADA solo si NO hay NINGÚN bloqueo abierto (de nadie)
      if (!tieneAlguno) return "11_PREPARADA";
      // Si hay bloqueos de Guille o de seguimiento → se queda en 08
      return "08_CYCP";
    }

    // Fases 01-07: su fase admin tal cual
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
      // Leer en paralelo: comunidades + bloqueos_operativos + pisos
      const [rowsCom, rowsBloq, rowsPisos] = await Promise.all([
        leerHoja("comunidades!A2:BF"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
      ]);

      const obras = rowsCom.filter(r => r[0]).map(rowToObj);

      // Indexar bloqueos por comunidad
      const bloqueosPorComunidad = {};
      for (const row of rowsBloq) {
        if (!row[0]) continue;
        const b = filaABloqueo(row);
        if (b.resuelto === "si") continue;
        const key = b.comunidad.trim();
        if (!bloqueosPorComunidad[key]) bloqueosPorComunidad[key] = [];
        bloqueosPorComunidad[key].push({
          tipo_bloqueo:      b.tipo_bloqueo,
          severidad:         b.severidad,
          pelota_en:         b.pelota_en,
          impacto:           b.impacto,
          accion_exacta:     b.accion_exacta,
          vecinos_afectados: b.vecinos_afectados,
          owner:             ownerEfectivo(b),
          detectado_en:      b.detectado_en,
          esperar_hasta:     b.esperar_hasta,
          resuelto:          b.resuelto,
        });
      }

      // Indexar pisos por comunidad (para avance docs)
      // pisos!A2:AS  →  A=telefono, B=comunidad, ... AC..AS=est_piso_*
      const pisosPorComunidad = {};
      for (const row of rowsPisos) {
        if (!row[1]) continue; // sin comunidad asignada
        const com = String(row[1]).trim();
        if (!pisosPorComunidad[com]) pisosPorComunidad[com] = [];
        pisosPorComunidad[com].push(row);
      }

      const grupos = {};
      for (const f of FASES) grupos[f] = [];

      for (const obra of obras) {
        const bloqObra = bloqueosPorComunidad[obra.comunidad.trim()] || [];
        const grupo = clasificarObra(obra, bloqObra);
        if (!grupo) continue;

        // Avance documentación (CCPP + todos sus pisos)
        const av_ccpp = calcularAvanceCcpp(obra);
        let av_hecho = av_ccpp.hecho;
        let av_total = av_ccpp.total;
        const pisosObra = pisosPorComunidad[obra.comunidad.trim()] || [];
        for (const rowPiso of pisosObra) {
          const ap = calcularAvancePiso(rowPiso);
          av_hecho += ap.hecho;
          av_total += ap.total;
        }
        const avance_pct = av_total > 0 ? Math.round((av_hecho / av_total) * 100) : null;

        const importe = parseImporte(obra.pto_total);
        const claveCcpp = obra.direccion || obra.comunidad || "";
        const item = {
          comunidad: obra.comunidad,
          direccion: obra.direccion,
          ccpp_id: claveCcpp ? ccppId(claveCcpp) : "",
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
          bloqueos: bloqObra,
          // v0.7.0: avance documentación
          avance_docs: {
            hecho: av_hecho,
            total: av_total,
            pct: avance_pct,
            num_pisos: pisosObra.length,
          },
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
        version: "0.7.1",
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
