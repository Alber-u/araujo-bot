// ============================================================
// ARA OS — Panel de Obras · 11 fases · Conectado a bloqueos
// v0.9.0 — Días desde aceptación PTO en cada tarjeta del panel
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

  // v0.14.0: leer sin lanzar si la pestaña no existe
  async function leerHojaSafe(rango) {
    try {
      return await leerHoja(rango);
    } catch (err) {
      console.warn("[leerHojaSafe] " + rango + " falló:", err.message);
      return [];
    }
  }

  // v0.14.0: crear pestaña temperatura_contacto si no existe
  async function asegurarPestanaTemperatura() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "temperatura_contacto"
      );
      if (existe) return true;
      // Crear pestaña con cabecera
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "temperatura_contacto" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "temperatura_contacto!A1:D1",
        valueInputOption: "RAW",
        requestBody: { values: [["comunidad", "nivel", "actualizado_en", "marcado_por"]] },
      });
      return true;
    } catch (err) {
      console.warn("[asegurarPestanaTemperatura]", err.message);
      return false;
    }
  }

  // v0.11.0: escribir UNA celda. Devuelve el cliente para poder reutilizarlo.
  async function escribirCelda(rango, valor) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
      valueInputOption: "RAW",
      requestBody: { values: [[valor]] },
    });
  }

  // v0.11.0: añadir una fila al final de una pestaña (para log)
  async function appendFila(pestana, fila) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${pestana}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });
  }

  // Sprint 2: añadida motivo_pipeline (BE)
  // v0.5.0: BF se renombra de `bloqueada` a `fase_jm` (financiacion|bloqueo|preparada)
  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma",
    "observaciones","tipo_via","earth","administrador","telefono_administrador",
    "email_administrador","fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto",
    "fecha_envio_pto","fecha_ultimo_seguimiento_pto","decision_pto","fecha_aceptacion_pto",
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

  // v0.10.1: tiempo desde fecha en formato humano
  // Devuelve "X meses y Y días" / "X meses" / "Y días" o null si fecha inválida
  function tiempoHumanoDesde(fechaISO) {
    if (!fechaISO) return { humano: null, dias: null };
    const s = String(fechaISO).trim();
    if (!s) return { humano: null, dias: null };
    const d = new Date(s);
    if (isNaN(d)) return { humano: null, dias: null };
    const ahora = new Date();
    if (d > ahora) return { humano: null, dias: null };
    const dias = Math.floor((ahora - d) / 86400000);
    let meses = (ahora.getFullYear() - d.getFullYear()) * 12 + (ahora.getMonth() - d.getMonth());
    let diaInicio = new Date(d);
    diaInicio.setMonth(diaInicio.getMonth() + meses);
    if (diaInicio > ahora) {
      meses--;
      diaInicio = new Date(d);
      diaInicio.setMonth(diaInicio.getMonth() + meses);
    }
    const diasRestantes = Math.floor((ahora - diaInicio) / 86400000);
    const partes = [];
    if (meses > 0) partes.push(meses + (meses === 1 ? " mes" : " meses"));
    if (diasRestantes > 0 || meses === 0) {
      partes.push(diasRestantes + (diasRestantes === 1 ? " día" : " días"));
    }
    return { humano: partes.join(" y "), dias };
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

  // ============================================================
  // ESTADO DE PAGOS POR PISO (v0.10.0)
  //
  // Columna `est_piso_pago` (índice 44 = AS, última col del rango est_piso_*).
  // Valores y significado:
  //   OK       → piso ya cobrado
  //   F        → piso pendiente de cobrar al contado (pelota: vecino)
  //   6/12/18  → financiación a 6/12/18 meses, pendiente que JM la formalice
  //   FFCC     → forma fija con cargo a comunidad, pendiente JM
  //   vacío    → sin información
  // ============================================================
  const IDX_EST_PISO_PAGO = 44; // columna AS (la última de est_piso_*)
  const VALORES_FINANCIA  = new Set(["6", "12", "18", "FFCC"]);

  function calcularPagosObra(rowsPisosObra) {
    let total = 0, financia = 0, pendienteF = 0, cobrados = 0;
    for (const row of rowsPisosObra) {
      total++;
      const v = String(row[IDX_EST_PISO_PAGO] || "").trim().toUpperCase();
      if (VALORES_FINANCIA.has(v))     financia++;
      else if (v === "F")              pendienteF++;
      else if (v === "OK")             cobrados++;
      // otros: vacío, etc. no se contabilizan
    }
    return { total, financia, pendiente_f: pendienteF, cobrados };
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
  function clasificarObra(obra, bloqueosObra, pagos) {
    const fase = (obra.fase_presupuesto || "").trim();
    if (fase.startsWith("ZZ_")) return null;

    // Obra cerrada formalmente → fuera del panel SIEMPRE
    const cerrada = !!(obra.fecha_cycp_completa && String(obra.fecha_cycp_completa).trim());
    if (cerrada) return null;

    // Bloqueos abiertos del motor
    const activos     = (bloqueosObra || []).filter(b => b.resuelto !== "si");
    const tieneAlguno = activos.length > 0;
    const tieneFinBloq = activos.some(b => b.tipo_bloqueo === "FINANCIACION");
    const tieneJMOtro = activos.some(b =>
      b.tipo_bloqueo !== "FINANCIACION" &&
      TIPOS_JM.has(b.tipo_bloqueo) &&
      b.severidad === "critica"
    );

    // v0.10.0: estado real de pagos en los pisos
    const p = pagos || { financia: 0, pendiente_f: 0 };
    const tieneFinReal     = p.financia > 0;     // pisos con 6/12/18/FFCC
    const tienePendienteF  = p.pendiente_f > 0;  // pisos con F (cobro pdte)

    // Reglas para obra en 08_CYCP (zona post-admin de Guille)
    if (fase === "08_CYCP") {
      // 09 FINANCIACIÓN: o el motor detectó FINANCIACION pendiente,
      // o hay al menos 1 piso con est_piso_pago en 6/12/18/FFCC
      // (JM tiene que formalizar esa financiación con la financiera)
      if (tieneFinBloq || tieneFinReal) return "09_FINANCIACION";

      // 10 BLOQUEOS: otro bloqueo crítico de JM, o pisos con F (cobro pdte)
      if (tieneJMOtro || tienePendienteF) return "10_BLOQUEOS";

      // 11 PREPARADA: sin financiación pendiente, sin bloqueos críticos,
      // sin pagos pendientes. Tampoco puede tener otros bloqueos.
      if (!tieneAlguno) return "11_PREPARADA";

      // Si hay bloqueos de seguimiento o de Guille → se queda en 08
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
      // Leer en paralelo: comunidades + bloqueos + pisos + temperatura
      const [rowsCom, rowsBloq, rowsPisos, rowsTemp] = await Promise.all([
        leerHoja("comunidades!A2:BF"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
        leerHojaSafe("temperatura_contacto!A2:D"),
      ]);

      // Indexar temperaturas por comunidad: { "Nombre Com": "normal"|"caliente"|"urgente" }
      const tempPorComunidad = {};
      for (const row of rowsTemp) {
        if (!row[0]) continue;
        tempPorComunidad[String(row[0]).trim()] = String(row[1] || "normal").trim().toLowerCase();
      }

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
        const pisosObra = pisosPorComunidad[obra.comunidad.trim()] || [];

        // v0.10.0: estado real de pagos en los pisos (sustituye al motor de bloqueos
        // para detectar 09 FINANCIACIÓN / 10 BLOQUEOS / 11 PREPARADA)
        const pagos = calcularPagosObra(pisosObra);

        const grupo = clasificarObra(obra, bloqObra, pagos);
        if (!grupo) continue;

        // Avance documentación (CCPP + todos sus pisos)
        const av_ccpp = calcularAvanceCcpp(obra);
        let av_hecho = av_ccpp.hecho;
        let av_total = av_ccpp.total;
        for (const rowPiso of pisosObra) {
          const ap = calcularAvancePiso(rowPiso);
          av_hecho += ap.hecho;
          av_total += ap.total;
        }
        const avance_pct = av_total > 0 ? Math.round((av_hecho / av_total) * 100) : null;

        const importe = parseImporte(obra.pto_total);
        const claveCcpp = obra.direccion || obra.comunidad || "";

        // v0.10.1: tiempo atascada · fecha base según fase actual
        // Cada fase tiene un hito documentado; medimos desde ese hito.
        const faseActual = (obra.fase_presupuesto || "").trim();
        let atascado_fecha_base = "";
        let atascado_etiqueta   = "";
        if (faseActual === "01_CONTACTO" || faseActual === "02_VISITA" || faseActual === "03_ENVIO_PTO") {
          atascado_fecha_base = obra.fecha_solicitud_pto;
          atascado_etiqueta   = "Solicitado hace";
        } else if (faseActual === "04_ACEPTACION_PTO") {
          atascado_fecha_base = obra.fecha_envio_pto;
          atascado_etiqueta   = "PTO enviado hace";
        } else if (faseActual === "05_DOCUMENTACION") {
          atascado_fecha_base = obra.fecha_aceptacion_pto;
          atascado_etiqueta   = "Aceptado hace";
        } else if (faseActual === "06_VISITA_EMASESA" || faseActual === "07_PTE_CYCP") {
          atascado_fecha_base = obra.fecha_documentacion_completa;
          atascado_etiqueta   = "Doc cerrada hace";
        } else if (faseActual === "08_CYCP") {
          atascado_fecha_base = obra.fecha_envio_contratos_pagos;
          atascado_etiqueta   = "Contratos hace";
        }
        const _t = tiempoHumanoDesde(atascado_fecha_base);
        const atascado_humano = _t.humano;
        const atascado_dias   = _t.dias;

        const item = {
          comunidad: obra.comunidad,
          direccion: obra.direccion,
          ccpp_id: claveCcpp ? ccppId(claveCcpp) : "",
          fase: obra.fase_presupuesto,
          pto_total: importe,
          pto_total_fmt: formatEur(importe),
          // v0.10.0: estado real de pagos (para badge "Financia X/Y")
          pagos,
          tiempo_previsto: obra.tiempo_previsto,
          fecha_visita_emasesa: obra.fecha_visita_emasesa,
          fecha_documentacion_completa: obra.fecha_documentacion_completa,
          fecha_cycp_completa: obra.fecha_cycp_completa,
          fecha_envio_contratos_pagos: obra.fecha_envio_contratos_pagos,
          fecha_aceptacion_pto: obra.fecha_aceptacion_pto,
          decision_pto: obra.decision_pto,
          // v0.10.1: tiempo atascada según fase
          atascado_humano,
          atascado_etiqueta,
          atascado_fecha_base,
          atascado_dias,
          // v0.14.0: temperatura comercial (solo aplica en CONTACTO pero la
          // devolvemos siempre para que el frontend decida cuándo mostrarla)
          temperatura: tempPorComunidad[obra.comunidad.trim()] || "normal",
          est_ccpp_pago: obra.est_ccpp_pago,
          est_ccpp_factura_emasesa: obra.est_ccpp_factura_emasesa,
          notas_pto: obra.notas_pto,
          motivo_pipeline: normalizarMotivo(obra.motivo_pipeline),
          fase_jm: normalizarFaseJM(obra.fase_jm),
          bloqueos: bloqObra,
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
      //  - "Facturación ejecutable" = SOLO fase 11 PREPARADA
      //  - "Días ejecución preparados" = SOLO fase 11
      //  - Días hábiles = (días × 2) ÷ 5  (cada obra precisa oficial + peón,
      //    repartido entre las 5 personas activas de obra)
      const FASES_PREPARADAS = ["11_PREPARADA"];
      const dias_ejecucion_preparadas = FASES_PREPARADAS.reduce(
        (s, f) => s + dias_previstos[f], 0
      );
      const facturacion_ejecutable = FASES_PREPARADAS.reduce(
        (s, f) => s + totales[f], 0
      );
      const dias_habiles_5p = (dias_ejecucion_preparadas * 2) / 5;

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.12.0",
        fases: FASES,
        grupos,
        totales,
        totales_fmt,
        cuentas,
        dias_previstos,
        kpis: {
          dias_ejecucion_preparadas,
          dias_ejecucion_preparadas_fmt: dias_ejecucion_preparadas.toFixed(1) + " d",
          dias_habiles_5p,
          dias_habiles_5p_fmt: dias_habiles_5p.toFixed(1) + " d hábiles",
          facturacion_ejecutable,
          facturacion_ejecutable_fmt: formatEur(facturacion_ejecutable),
        },
      });
    } catch (err) {
      console.error("[panel-obras]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // ENDPOINT FICHA · v0.8.0
  // GET /api/ara-os/panel-obras/ficha?id=ccpp_xxx&token=araujo2026
  //
  // Devuelve todos los datos disponibles de UNA obra:
  //  - Datos del Sheet `comunidades` (no sensibles)
  //  - Bloqueos abiertos de bloqueos_operativos
  //  - Lista de pisos vinculados (resumen)
  //  - Avance documentación calculado igual que el panel
  //
  // No carga histórico de mails ni datos comerciales sensibles.
  // Si se necesitan, se enlazará al expediente de Guille desde la propia
  // ficha (con un botón "Ver expediente completo").
  // ============================================================
  app.get("/api/ara-os/panel-obras/ficha", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const idBuscado = String(req.query.id || "").trim();
    if (!idBuscado) {
      return res.status(400).json({ error: "Falta parámetro id" });
    }

    try {
      const [rowsCom, rowsBloq, rowsPisos] = await Promise.all([
        leerHoja("comunidades!A2:BF"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
      ]);

      // Localizar la obra por ccpp_id
      let obraEncontrada = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        const id = clave ? ccppId(clave) : "";
        if (id === idBuscado) {
          obraEncontrada = o;
          break;
        }
      }

      if (!obraEncontrada) {
        return res.status(404).json({ error: "Obra no encontrada", id: idBuscado });
      }

      // Bloqueos abiertos de esta obra
      const bloqueosObra = [];
      for (const row of rowsBloq) {
        if (!row[0]) continue;
        const b = filaABloqueo(row);
        if (b.resuelto === "si") continue;
        if (b.comunidad.trim() !== obraEncontrada.comunidad.trim()) continue;
        bloqueosObra.push({
          tipo_bloqueo:      b.tipo_bloqueo,
          severidad:         b.severidad,
          pelota_en:         b.pelota_en,
          impacto:           b.impacto,
          accion_exacta:     b.accion_exacta,
          vecinos_afectados: b.vecinos_afectados,
          owner:             ownerEfectivo(b),
          detectado_en:      b.detectado_en,
          esperar_hasta:     b.esperar_hasta,
        });
      }

      // Pisos vinculados (resumen mínimo + avance por piso)
      const pisos = [];
      let av_hecho = 0, av_total = 0;
      const ccpp_av = calcularAvanceCcpp(obraEncontrada);
      av_hecho += ccpp_av.hecho;
      av_total += ccpp_av.total;

      for (const row of rowsPisos) {
        if (!row[1]) continue;
        if (String(row[1]).trim() !== obraEncontrada.comunidad.trim()) continue;
        const ap = calcularAvancePiso(row);
        av_hecho += ap.hecho;
        av_total += ap.total;
        pisos.push({
          telefono:  (row[0]  || "").toString().trim(),
          vivienda:  (row[2]  || "").toString().trim(),
          nombre:    (row[4]  || "").toString().trim(),
          estado:    (row[7]  || "").toString().trim(),
          // v0.11.0: para pestaña Financiaciones
          est_piso_pago:           (row[IDX_EST_PISO_PAGO] || "").toString().trim(),
          est_piso_meses_financiar: (row[38] || "").toString().trim(),
          docs_hecho: ap.hecho,
          docs_total: ap.total,
        });
      }

      const importe = parseImporte(obraEncontrada.pto_total);
      const avance_pct = av_total > 0 ? Math.round((av_hecho / av_total) * 100) : null;

      // Clasificar para saber en qué columna del panel está
      const fasePanel = clasificarObra(obraEncontrada, bloqueosObra);

      // Helpers para parsear los JSONs de mails sin romperse si vienen mal
      function safeJson(raw) {
        if (!raw) return {};
        try { return JSON.parse(raw); } catch { return {}; }
      }
      const mails_enviados      = safeJson(obraEncontrada.mails_enviados);
      const mails_ultimo_envio  = safeJson(obraEncontrada.mails_ultimo_envio);
      const mails_manuales      = safeJson(obraEncontrada.mails_manuales);

      // Resumen económico: parsear importes en €
      const eco = {
        pto_total:          parseImporte(obraEncontrada.pto_total),
        mano_obra_previsto: parseImporte(obraEncontrada.mano_obra_previsto),
        mano_obra_real:     parseImporte(obraEncontrada.mano_obra_real),
        material_previsto:  parseImporte(obraEncontrada.material_previsto),
        material_real:      parseImporte(obraEncontrada.material_real),
        beneficio_previsto: parseImporte(obraEncontrada.beneficio_previsto),
        beneficio_real:     parseImporte(obraEncontrada.beneficio_real),
        beneficio_desvio:   parseImporte(obraEncontrada.beneficio_desvio),
      };
      // Formato bonito para todos
      const eco_fmt = {};
      for (const k of Object.keys(eco)) eco_fmt[k] = formatEur(eco[k]);

      // Tiempos
      const tiempo = {
        previsto: obraEncontrada.tiempo_previsto || "",
        real:     obraEncontrada.tiempo_real || "",
        desvio:   obraEncontrada.tiempo_desvio || "",
      };

      // Estados CCPP uno a uno (los 9 documentos)
      const estados_ccpp = COLS_EST_CCPP.map(c => ({
        codigo: c.replace(/^est_ccpp_/, ""),
        estado: (obraEncontrada[c] || "").toString().trim(),
      }));

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.12.0",
        obra: {
          ccpp_id:               idBuscado,
          comunidad:             obraEncontrada.comunidad,
          direccion:             obraEncontrada.direccion,
          tipo_via:              obraEncontrada.tipo_via,
          fase_presupuesto:      obraEncontrada.fase_presupuesto,
          fase_panel:            fasePanel,
          estado_comunidad:      obraEncontrada.estado_comunidad,
          motivo_pipeline:       normalizarMotivo(obraEncontrada.motivo_pipeline),
          motivo_rechazo:        obraEncontrada.motivo_rechazo,
          observaciones:         obraEncontrada.observaciones,
          presidente:            obraEncontrada.presidente,
          telefono_presidente:   obraEncontrada.telefono_presidente,
          email_presidente:      obraEncontrada.email_presidente,
          administrador:         obraEncontrada.administrador,
          telefono_administrador: obraEncontrada.telefono_administrador,
          email_administrador:   obraEncontrada.email_administrador,
          pto_total:             importe,
          pto_total_fmt:         formatEur(importe),
          tiempo_previsto:       obraEncontrada.tiempo_previsto,
          notas_pto:             obraEncontrada.notas_pto,
          // Fechas hitos
          fecha_inicio:                       obraEncontrada.fecha_inicio,
          fecha_solicitud_pto:                obraEncontrada.fecha_solicitud_pto,
          fecha_visita_pto:                   obraEncontrada.fecha_visita_pto,
          fecha_envio_pto:                    obraEncontrada.fecha_envio_pto,
          fecha_aceptacion_pto:                 obraEncontrada.fecha_aceptacion_pto,
          fecha_visita_emasesa:               obraEncontrada.fecha_visita_emasesa,
          fecha_documentacion_completa:       obraEncontrada.fecha_documentacion_completa,
          fecha_envio_contratos_pagos:        obraEncontrada.fecha_envio_contratos_pagos,
          fecha_cycp_completa:                obraEncontrada.fecha_cycp_completa,
          // Fechas límite
          fecha_limite_documentacion:         obraEncontrada.fecha_limite_documentacion,
          fecha_limite_firma:                 obraEncontrada.fecha_limite_firma,
          fecha_limite_documentacion_vecinos: obraEncontrada.fecha_limite_documentacion_vecinos,
          // URL externa
          url_expediente_guille: `/presupuestos/expediente?id=${encodeURIComponent(idBuscado)}`,
        },
        avance_docs: {
          hecho: av_hecho,
          total: av_total,
          pct:   avance_pct,
        },
        economico: { brut: eco, fmt: eco_fmt },
        tiempo,
        estados_ccpp,
        mails: {
          enviados:     mails_enviados,
          ultimo_envio: mails_ultimo_envio,
          manuales:     mails_manuales,
        },
        bloqueos: bloqueosObra,
        pisos,
      });
    } catch (err) {
      console.error("[panel-obras/ficha]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/financiacion-cerrar
  // v0.11.0 — JM marca "financiación cerrada con la financiera" en un piso.
  //
  // Body JSON: { ccpp_id, telefono, vivienda, valor_actual_esperado }
  //   - ccpp_id: id de la obra (para localizar la fila)
  //   - telefono o vivienda: para identificar el piso dentro de la obra
  //   - valor_actual_esperado: "6"/"12"/"18"/"FFCC" (el que JM vio en pantalla)
  //
  // Flujo:
  //   1. Buscar el piso en pisos!A:AS por comunidad + (telefono o vivienda)
  //   2. Leer el valor ACTUAL de est_piso_pago (col AS)
  //   3. Si no coincide con valor_actual_esperado → 409 (alguien lo cambió)
  //   4. Si coincide → escribir "OK" en esa celda
  //   5. Apuntar línea de log en pestaña 'log_financiaciones'
  // ============================================================
  // Body parser JSON SOLO para el endpoint POST (no afectamos al resto del app)
  const bodyParser = require("body-parser");
  const jsonBodyParser = bodyParser.json({ limit: "32kb" });

  app.post("/api/ara-os/panel-obras/financiacion-cerrar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const { ccpp_id, telefono, vivienda, valor_actual_esperado } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!telefono && !vivienda) return res.status(400).json({ error: "Falta telefono o vivienda" });
      if (!valor_actual_esperado) return res.status(400).json({ error: "Falta valor_actual_esperado" });

      // 1. Localizar la obra para conocer el nombre de comunidad
      const rowsCom = await leerHoja("comunidades!A2:BF");
      let comunidadBuscada = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidadBuscada = o.comunidad.trim();
          break;
        }
      }
      if (!comunidadBuscada) return res.status(404).json({ error: "Obra no encontrada" });

      // 2. Localizar la fila del piso en pisos!A:AS
      const rowsPisos = await leerHoja("pisos!A2:AS");
      let rowIndexAbs = -1;        // 1-based en el Sheet (sumamos 2: 1 por la fila cabecera + 1 por 0-index)
      let valorActualReal = "";
      for (let i = 0; i < rowsPisos.length; i++) {
        const r = rowsPisos[i] || [];
        if (!r[1]) continue;
        const com = String(r[1]).trim();
        if (com !== comunidadBuscada) continue;
        const tlf = String(r[0] || "").trim();
        const viv = String(r[2] || "").trim();
        const coincideTel = telefono && tlf && tlf === String(telefono).trim();
        const coincideViv = vivienda && viv && viv === String(vivienda).trim();
        if (coincideTel || coincideViv) {
          rowIndexAbs = i + 2; // +2 porque empezamos en A2 e índice 0
          valorActualReal = String(r[IDX_EST_PISO_PAGO] || "").trim();
          break;
        }
      }
      if (rowIndexAbs < 0) return res.status(404).json({ error: "Piso no encontrado en la obra" });

      // 3. Validar que el valor no ha cambiado entre que JM lo vio y pulsó el botón
      if (valorActualReal.toUpperCase() !== String(valor_actual_esperado).toUpperCase()) {
        return res.status(409).json({
          error: "El valor ha cambiado",
          detalle: `Esperabas '${valor_actual_esperado}' pero ahora hay '${valorActualReal}'. Refresca la ficha antes de volver a intentarlo.`,
          valor_actual: valorActualReal,
        });
      }

      // 4. Escribir "OK" en la celda AS de esa fila
      const rangoCelda = `pisos!AS${rowIndexAbs}`;
      await escribirCelda(rangoCelda, "OK");

      // 5. Apuntar log en pestaña log_financiaciones (se crea sola si no existe gracias a append)
      try {
        await appendFila("log_financiaciones", [
          new Date().toISOString(),    // timestamp
          ccpp_id,                     // id obra
          comunidadBuscada,            // nombre obra
          telefono || "",
          vivienda || "",
          valor_actual_esperado,       // valor anterior
          "OK",                        // valor nuevo
          "ARA OS / JM",               // origen
        ]);
      } catch (logErr) {
        // Si la pestaña log no existe, no rompemos la operación principal
        console.warn("[financiacion-cerrar] log fallido:", logErr.message);
      }

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.12.0",
        rango_actualizado: rangoCelda,
        valor_anterior: valor_actual_esperado,
        valor_nuevo: "OK",
      });
    } catch (err) {
      console.error("[financiacion-cerrar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/analisis-ia
  // v0.12.0 — Analiza el panel completo con Claude y devuelve estrategia.
  //
  // Reutiliza el patrón de ara-facturas.cjs (ANTHROPIC_API_KEY ya en env).
  //
  // Coste estimado: ~15 céntimos por análisis (modelo opus, ~50k tokens).
  // ============================================================
  app.post("/api/ara-os/panel-obras/analisis-ia", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada" });
    }

    try {
      // Cargar TODO el panel + pisos para tener contexto completo
      const [rowsCom, rowsBloq, rowsPisos] = await Promise.all([
        leerHoja("comunidades!A2:BF"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
      ]);

      // Indexar bloqueos por comunidad
      const bloqueosPorComunidad = {};
      for (const row of rowsBloq) {
        if (!row[0]) continue;
        const b = filaABloqueo(row);
        if (b.resuelto === "si") continue;
        const key = b.comunidad.trim();
        if (!bloqueosPorComunidad[key]) bloqueosPorComunidad[key] = [];
        bloqueosPorComunidad[key].push({
          tipo:      b.tipo_bloqueo,
          severidad: b.severidad,
          pelota_en: b.pelota_en,
          accion:    b.accion_exacta,
          dias:      b.dias_abierto || "",
        });
      }

      // Indexar pisos por comunidad
      const pisosPorComunidad = {};
      for (const row of rowsPisos) {
        if (!row[1]) continue;
        const com = String(row[1]).trim();
        if (!pisosPorComunidad[com]) pisosPorComunidad[com] = [];
        pisosPorComunidad[com].push(row);
      }

      // Construir resumen de obras activas (filtramos cerradas y descartadas)
      const obras = rowsCom.filter(r => r[0]).map(rowToObj);
      const obrasActivas = [];
      const resumenFases = {};

      for (const obra of obras) {
        const bloqObra = bloqueosPorComunidad[obra.comunidad.trim()] || [];
        const pisosObra = pisosPorComunidad[obra.comunidad.trim()] || [];
        const pagos = calcularPagosObra(pisosObra);
        const grupo = clasificarObra(obra, bloqObra, pagos);
        if (!grupo) continue;

        resumenFases[grupo] = (resumenFases[grupo] || 0) + 1;

        // Avance docs
        const av_ccpp = calcularAvanceCcpp(obra);
        let av_hecho = av_ccpp.hecho;
        let av_total = av_ccpp.total;
        for (const rowPiso of pisosObra) {
          const ap = calcularAvancePiso(rowPiso);
          av_hecho += ap.hecho;
          av_total += ap.total;
        }
        const avance_pct = av_total > 0 ? Math.round((av_hecho / av_total) * 100) : null;

        obrasActivas.push({
          comunidad:      obra.comunidad,
          fase_panel:     grupo,
          importe:        parseImporte(obra.pto_total),
          dias_previstos: parseFloat(obra.tiempo_previsto) || 0,
          fecha_envio_pto:                    obra.fecha_envio_pto || "",
          fecha_aceptacion_pto:               obra.fecha_aceptacion_pto || "",
          fecha_documentacion_completa:       obra.fecha_documentacion_completa || "",
          fecha_envio_contratos_pagos:        obra.fecha_envio_contratos_pagos || "",
          avance_docs_pct:                    avance_pct,
          num_pisos:                          pisosObra.length,
          pagos,
          bloqueos: bloqObra,
        });
      }

      // Calcular totales
      const total_importe = obrasActivas.reduce((s, o) => s + o.importe, 0);
      const dias_preparados = obrasActivas
        .filter(o => o.fase_panel === "11_PREPARADA")
        .reduce((s, o) => s + o.dias_previstos, 0);
      const importe_preparado = obrasActivas
        .filter(o => o.fase_panel === "11_PREPARADA")
        .reduce((s, o) => s + o.importe, 0);

      const datosPanel = {
        fecha_analisis: new Date().toISOString().slice(0, 10),
        resumen: {
          total_obras_activas: obrasActivas.length,
          importe_total: total_importe,
          importe_preparado: importe_preparado,
          dias_calendario_preparados: dias_preparados,
          dias_habiles_5p: (dias_preparados * 2) / 5,
          por_fase: resumenFases,
        },
        obras: obrasActivas,
      };

      const prompt = `Eres el director de operaciones de Instalaciones Araujo, una empresa de fontanería de Sevilla que ejecuta obras de cambio de columnas en comunidades de propietarios (CCPP) mediante el Plan 5 de EMASESA.

La empresa tiene 5 personas trabajando en obra (cada obra necesita oficial + peón, así que pueden tener 2-3 obras simultáneamente en marcha) más 2 personas en oficina: Guillermo (admin/presupuestos) y José Manuel (jefe de obra).

Las 11 fases del flujo son:
  01_CONTACTO        → primer contacto con la comunidad
  02_VISITA          → visita técnica
  03_ENVIO_PTO       → presupuesto enviado
  04_ACEPTACION_PTO  → esperando que el cliente acepte
  05_DOCUMENTACION   → Guille recoge papeles vecinos (Plan 5)
  06_VISITA_EMASESA  → visita EMASESA programada
  07_PTE_CYCP        → pendiente firma contratos+cartas pago con administrador
  08_CYCP            → CYCP en marcha
  09_FINANCIACION    → pisos con financiación pendiente que JM tiene que formalizar con financiera
  10_BLOQUEOS        → conflicto / parada
  11_PREPARADA       → todo OK, lista para empezar obra física

Te paso el ESTADO ACTUAL DEL PANEL DE OBRAS:

${JSON.stringify(datosPanel, null, 2)}

Tu tarea: produce un análisis estratégico estructurado en MARKDOWN con estas 4 secciones, en este orden exacto:

## 🎯 3 acciones prioritarias para esta semana
Las 3 obras concretas en las que JM y Guille deberían enfocarse YA para desbloquear mayor importe en menor tiempo. Para cada una: nombre de la comunidad, qué hay que hacer, quién lo hace, por qué es prioritaria.

## 🚧 Cuellos de botella
En qué fase(s) se está acumulando trabajo y por qué. Datos concretos (cuántas obras, cuánto importe). Diagnóstico breve.

## 💰 Top 5 obras más urgentes
Ranking por criterio importe × tiempo atascada. Tabla con: comunidad | fase | importe | días atascada (calculado por ti) | acción exacta.

## 📊 Estado general
2-3 párrafos de opinión directa: qué va bien, qué va mal, qué riesgo deberíamos vigilar.

Reglas:
- Sé concreto y accionable. NADA de generalidades del tipo "hay que mejorar la comunicación".
- Usa los nombres reales de las comunidades.
- Datos en euros formateados (1.234,56 €) y días con un decimal.
- Si una sección no aporta nada útil porque los datos son insuficientes, dilo en una línea y pasa a la siguiente.
- Responde SOLO el markdown, sin preámbulos, sin "aquí tienes el análisis", directo al primer ##.`;

      console.log(`[panel-obras/analisis-ia] Analizando ${obrasActivas.length} obras...`);

      const body = {
        model: "claude-opus-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
      };

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Claude API error ${r.status}: ${err}`);
      }

      const claudeData = await r.json();
      const texto = claudeData.content.map(c => c.text || "").join("").trim();

      // Token usage para calcular coste real
      const inputTokens  = claudeData.usage?.input_tokens  || 0;
      const outputTokens = claudeData.usage?.output_tokens || 0;
      // Tarifa Claude Opus 4: ~$15/M input, ~$75/M output (aprox)
      const costeUSD = (inputTokens * 15 / 1000000) + (outputTokens * 75 / 1000000);
      const costeEUR = costeUSD * 0.92;

      res.json({
        ok: true,
        version: "0.12.0",
        generated_at: new Date().toISOString(),
        markdown: texto,
        meta: {
          obras_analizadas: obrasActivas.length,
          tokens_entrada: inputTokens,
          tokens_salida:  outputTokens,
          coste_estimado_eur: Math.round(costeEUR * 100) / 100,
        },
      });
    } catch (err) {
      console.error("[panel-obras/analisis-ia]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/temperatura
  // v0.14.0 — Marca el nivel de temperatura comercial de un contacto.
  //
  // Body: { comunidad, nivel }
  //   nivel ∈ { "normal", "caliente", "urgente" }
  //
  // Escribe en la pestaña `temperatura_contacto`:
  //   comunidad | nivel | actualizado_en | marcado_por
  //
  // Si la comunidad ya existe en la pestaña → actualiza la fila.
  // Si no existe → añade fila nueva.
  // Si la pestaña no existe → la crea.
  // ============================================================
  app.post("/api/ara-os/panel-obras/temperatura", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const { comunidad, nivel } = req.body || {};
      if (!comunidad)               return res.status(400).json({ error: "Falta comunidad" });
      if (!["normal", "caliente", "urgente"].includes(String(nivel || "").toLowerCase())) {
        return res.status(400).json({ error: "Nivel inválido (usa normal/caliente/urgente)" });
      }

      // Crear pestaña si no existe
      await asegurarPestanaTemperatura();

      // Buscar si ya hay fila para esta comunidad
      const rowsTemp = await leerHojaSafe("temperatura_contacto!A2:D");
      let rowIndex = -1;
      for (let i = 0; i < rowsTemp.length; i++) {
        if (String(rowsTemp[i][0] || "").trim() === String(comunidad).trim()) {
          rowIndex = i + 2; // +2 porque empieza en A2
          break;
        }
      }

      const ahora = new Date().toISOString();
      const valores = [[String(comunidad).trim(), String(nivel).toLowerCase(), ahora, "ARA OS"]];

      const sheets = getSheetsClient();
      if (rowIndex > 0) {
        // Update fila existente
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `temperatura_contacto!A${rowIndex}:D${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: valores },
        });
      } else {
        // Append fila nueva
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: "temperatura_contacto!A:D",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: valores },
        });
      }

      res.json({
        ok: true,
        version: "0.14.0",
        comunidad,
        nivel: String(nivel).toLowerCase(),
        actualizado_en: ahora,
      });
    } catch (err) {
      console.error("[panel-obras/temperatura]", err);
      res.status(500).json({ error: err.message });
    }
  });
};
