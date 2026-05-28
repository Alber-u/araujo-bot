// ============================================================
// ARA OS — Panel de Obras · 11 fases · Conectado a bloqueos
// v0.12.1 — Fix docs por piso: usar catálogo real documentos_manuales (18/05/2026)
// v0.12.0 — Endpoint /ficha devuelve docs entregados/pendientes por piso (18/05/2026)
// v0.11.0 — Hooks de timeline en avanzar/retroceder/crear OT (17/05/2026)
// v0.10.0 — Limpieza endpoint custodia-resumen duplicado (16/05/2026)
// v0.9.0 — Días desde aceptación PTO en cada tarjeta del panel
//
// require("./ara-os-panel-obras.cjs")(app);
//
// v0.12.1 — Fix del punto 9.
//   v0.12.0 leía cols P/Q/AA/AB de `pisos` y un DOC_LABELS hardcoded
//   copiado de documentacion.cjs. Esto era el sistema VIEJO del bot.
//   La realidad: hoy Guille rellena cols AC..AS de pisos (17 columnas)
//   con estados `OK/F/6/12/18/FFCC/OP/NP/...` y los LABELS humanos
//   viven en la pestaña `documentos_manuales` del Sheet maestro
//   (nivel=PISO, ordenados por col `orden` → mapean a cols AC..AS).
//   v0.12.1 lee `documentos_manuales` en runtime (caché 15min) y
//   construye docs_entregados/pendientes correctamente:
//     OK / 6 / 12 / 18 / FFCC  → entregado
//     OP / NP / "" / null      → no aplica (no se muestra)
//     resto (típicamente F)    → pendiente
//
// v0.12.0 — Punto 9 lista mejoras 18/05.
//   El endpoint GET /api/ara-os/panel-obras/ficha añade, por cada piso,
//   dos listas:
//     · docs_entregados:  [{codigo, label, con_archivo}]
//     · docs_pendientes:  [{codigo, label}]
//   Fuente: cols P, Q, AA, AB de la pestaña `pisos` (alimentadas por
//   el módulo documentacion.cjs de Guille).
//   Labels obtenidos del catálogo DOC_LABELS · duplicado de
//   documentacion.cjs con marca SYNC_GUILLE para mantenimiento manual.
//   Solo lectura desde ARA OS. La gestión sigue siendo de Guille.
//
// GET /api/ara-os/panel-obras?token=TU_ADMIN_TOKEN
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

  const { validToken } = require("./lib/auth.cjs");

  // v0.11.0 — Módulo de timeline de fases. Se llama a su helper
  // `registrarEventoFase` desde los endpoints avanzar-fase, retroceder-fase
  // y crear-OT. Es NO BLOQUEANTE: si falla, solo loggea warning, la
  // operación principal sigue funcionando.
  const timelineFases = require("./ara-os-timeline-fases.cjs");

  function tokenValido(req) {
    return validToken(req.query.token);
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

  // v0.15.0: asegurar pestaña ordenes_trabajo (fase 12+ de obras físicas)
  async function asegurarPestanaOT() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "ordenes_trabajo"
      );
      if (existe) return true;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "ordenes_trabajo" } } }],
        },
      });
      // Cabecera (orden importa, mantenerlo igual que COLS_OT)
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "ordenes_trabajo!A1:K1",
        valueInputOption: "RAW",
        requestBody: { values: [[
          "comunidad",
          "fase_ot",
          "fecha_creacion",
          "creado_por",
          "fecha_inicio_obra",
          "materiales_pedidos",
          "presidente_avisado",
          "llaves_obtenidas",
          "operarios_asignados",
          "ultima_modificacion",
          "ultimo_modificador",
        ]] },
      });
      return true;
    } catch (err) {
      console.warn("[asegurarPestanaOT]", err.message);
      return false;
    }
  }

  // v0.16.0: pestaña financiaciones_sabadell
  // Una sola pestaña para ambos tipos (piso individual o comunidad entera).
  // El campo `tipo` (piso/comunidad) discrimina. Si tipo=comunidad, el campo
  // `vivienda` queda vacío y el sistema marca TODOS los pisos de la comunidad
  // como cobrados al guardar.
  async function asegurarPestanaFinancSabadell() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "financiaciones_sabadell"
      );
      if (existe) return true;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "financiaciones_sabadell" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "financiaciones_sabadell!A1:L1",
        valueInputOption: "RAW",
        requestBody: { values: [[
          "n_operacion",      // A · clave única Sabadell
          "tipo",             // B · "piso" o "comunidad"
          "comunidad",        // C · siempre rellena
          "vivienda",         // D · solo si tipo=piso
          "titular",          // E · nombre del titular del contrato
          "importe",          // F · número
          "fecha",            // G · YYYY-MM-DD
          "empresa",          // H · ARA PARTICULARES / ARA CCPP
          "url_pdf",          // I · URL del PDF en Drive (opcional)
          "n_transferencia",  // J · número de transferencia agregada (opcional)
          "registrado_en",    // K · timestamp
          "registrado_por",   // L · quién
        ]] },
      });
      return true;
    } catch (err) {
      console.warn("[asegurarPestanaFinancSabadell]", err.message);
      return false;
    }
  }

  const FS_COLS = {
    n_operacion:     0,  // A
    tipo:            1,  // B
    comunidad:       2,  // C
    vivienda:        3,  // D
    titular:         4,  // E
    importe:         5,  // F
    fecha:           6,  // G
    empresa:         7,  // H
    url_pdf:         8,  // I
    n_transferencia: 9,  // J
    registrado_en:   10, // K
    registrado_por:  11, // L
  };
  const FS_LETRA = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  // v0.15.0: índices de columnas en ordenes_trabajo
  const OT_COLS = {
    comunidad:               0,  // A
    fase_ot:                 1,  // B  ej: "12_INICIO_OBRA"
    fecha_creacion:          2,  // C
    creado_por:              3,  // D
    fecha_inicio_obra:       4,  // E
    materiales_pedidos:      5,  // F   "·" / "F" / "OK"
    presidente_avisado:      6,  // G
    llaves_obtenidas:        7,  // H
    operarios_asignados:     8,  // I   nombres separados por coma
    ultima_modificacion:     9,  // J
    ultimo_modificador:      10, // K
    // Fase 13 – En ejecución
    fecha_inicio_real:       11, // L
    tiempo_estimado:         12, // M   días (número)
    tiempo_consumido:        13, // N   días (número)
    pct_avance:              14, // O   0-100
    pct_rentabilidad:        15, // P   0-100
    num_certificaciones:     16, // Q
    fechas_certificaciones:  17, // R   texto libre
    // Fase 14 – En finalización
    factura_emitida:         18, // S   "·" / "F" / "OK"
    certificados_entregados: 19, // T   "·" / "F" / "OK"
    // v3.5 · Holded fields (escritos por fase14-holded.cjs)
    numero_factura_holded:   33, // AH  número de factura en Holded
    fecha_factura_emitida:   34, // AI  fecha de emisión en Holded
    // Fase 15 – Visita inspector
    visita_inspector_fecha:  20, // U
    visto_bueno:             21, // V   "·" / "F" / "OK"
    // Fase 16 – Montaje contadores
    contadores_montados:     22, // W   "·" / "F" / "OK"
    // Fase 17 – Cobro EMASESA
    cobro_emasesa_fecha:     23, // X
    // Fase 18 – Incidencias (transversal)
    incidencia_abierta:      24, // Y   "si" / "no"
    incidencia_descripcion:  25, // Z
    transferencia_recibida:  26, // AA
    // v0.16.0 — Fecha de montaje de contadores (editable, fase 16)
    fecha_montaje:           27, // AB
  };
  const OT_LETRA = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB"];

  // ============================================================
  // v0.16.0 — Cálculo de fecha de cobro EMASESA según fecha montaje
  //   Regla:
  //     · montaje día 1-9   → cobro el 20 de ESE mes
  //     · montaje día 10-24 → cobro el 5 del mes siguiente
  //     · montaje día 25+   → cobro el 20 del mes siguiente
  //   Entrada: fechaMontaje "YYYY-MM-DD" (o ISO). Salida: "YYYY-MM-DD" o "".
  // ============================================================
  function calcularFechaCobro(fechaMontaje) {
    if (!fechaMontaje) return "";
    const s = String(fechaMontaje).slice(0, 10);
    const d = new Date(s + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const dia = d.getDate();
    let anyo = d.getFullYear();
    let mes = d.getMonth(); // 0-11
    let diaCobro;
    if (dia <= 9) {
      // cobro el 20 de ESE mes
      diaCobro = 20;
    } else if (dia <= 24) {
      // cobro el 5 del mes siguiente
      diaCobro = 5;
      mes += 1;
    } else {
      // cobro el 20 del mes siguiente
      diaCobro = 20;
      mes += 1;
    }
    if (mes > 11) { mes -= 12; anyo += 1; }
    const mm = String(mes + 1).padStart(2, "0");
    const dd = String(diaCobro).padStart(2, "0");
    return `${anyo}-${mm}-${dd}`;
  }

  // v0.16.0 — Extrae la fecha del evento de entrada en fase 16 (montaje)
  // a partir de los eventos del timeline de una obra.
  function fechaMontajeDeTimeline(eventos) {
    if (!Array.isArray(eventos)) return "";
    // último evento cuyo destino sea 16_MONTAJE_CONTADORES
    let fecha = "";
    for (const ev of eventos) {
      if (String(ev.fase_destino || "").trim() === "16_MONTAJE_CONTADORES" && ev.fecha_evento) {
        fecha = String(ev.fecha_evento).slice(0, 10);
      }
    }
    return fecha;
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

  // ============================================================
  // v0.12.1 — DOCS POR PISO (basado en documentos_manuales)
  // ============================================================
  // El catálogo real lo mantiene Guille en la pestaña
  // `documentos_manuales` del Sheet maestro:
  //   col A=codigo, B=nivel, C=label, D=orden, E=permite_financiacion,
  //   F=activo, G=notas
  //
  // Cada documento PISO ocupa una columna en `pisos!A:AS` según su
  // ORDEN: orden=0 → col AC (idx 28), orden=1 → col AD (idx 29)...
  // hasta máximo 17 (orden 16 → col AS, idx 44).
  //
  // Valor por celda → significado:
  //   OK / 6 / 12 / 18 / FFCC  → entregado
  //   F                        → pendiente
  //   OP / NP / "" / null      → no aplica (no se muestra al usuario)
  //
  // El catálogo se cachea 15 minutos (mismo TTL que Guille usa en su
  // módulo). Si Guille reordena o añade docs, se refresca solo en
  // ~15min, o cuando reinicie el proceso.
  // ============================================================
  const ESTADOS_ENTREGADO = new Set(["OK", "6", "12", "18", "FFCC", "IPREM"]);
  const ESTADOS_NO_APLICA = new Set(["OP", "NP", ""]);

  let _docsPisoCache = null;
  let _docsPisoCacheTs = 0;
  const DOCS_PISO_TTL_MS = 15 * 60 * 1000;

  // Devuelve [{codigo, label, orden}] de los docs nivel=PISO activos, ordenados.
  async function leerDocsManualesPiso() {
    if (_docsPisoCache && (Date.now() - _docsPisoCacheTs) < DOCS_PISO_TTL_MS) {
      return _docsPisoCache;
    }
    const filas = await leerHojaSafe("documentos_manuales!A2:G");
    const piso = [];
    for (const r of (filas || [])) {
      const codigo = String(r[0] || "").trim();
      const nivel  = String(r[1] || "").trim().toUpperCase();
      const label  = String(r[2] || "").trim();
      const orden  = parseInt(String(r[3] || "0"), 10) || 0;
      const activo = String(r[5] || "SI").trim().toUpperCase() !== "NO";
      if (!codigo || !label || !activo) continue;
      if (nivel !== "PISO") continue;
      piso.push({ codigo, label, orden });
    }
    piso.sort((a, b) => a.orden - b.orden);
    _docsPisoCache = piso;
    _docsPisoCacheTs = Date.now();
    return piso;
  }

  // Construye {entregados, pendientes} a partir de una fila de `pisos` y
  // el catálogo `documentos_manuales` PISO.
  // Mapeo: docPiso[i] (orden i) → fila[COLS_EST_PISO_IDX_INI + i]
  function docsDelPiso(rowPiso, docsPiso) {
    const entregados = [];
    const pendientes = [];
    for (let i = 0; i < docsPiso.length; i++) {
      const idxCol = COLS_EST_PISO_IDX_INI + i;
      if (idxCol > COLS_EST_PISO_IDX_FIN) break; // por seguridad
      const valor = String(rowPiso[idxCol] || "").trim().toUpperCase();
      if (ESTADOS_NO_APLICA.has(valor)) continue; // no contar, no mostrar
      const d = docsPiso[i];
      if (ESTADOS_ENTREGADO.has(valor)) {
        // con_archivo: hoy no hay forma de saberlo desde aquí; lo dejamos false
        // siempre (Guille aún no ha vinculado archivos individuales por doc).
        entregados.push({ codigo: d.codigo, label: d.label, con_archivo: false });
      } else {
        // Cualquier otro valor (típicamente "F") → pendiente
        pendientes.push({ codigo: d.codigo, label: d.label });
      }
    }
    return { entregados, pendientes };
  }

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

  function calcularPagosObra(rowsPisosObra, sabadellCobrados) {
    let total = 0, financia = 0, pendienteF = 0, cobrados = 0;
    for (const row of rowsPisosObra) {
      total++;
      const v = String(row[IDX_EST_PISO_PAGO] || "").trim().toUpperCase();
      if (VALORES_FINANCIA.has(v))     financia++;
      else if (v === "F")              pendienteF++;
      else if (v === "OK")             cobrados++;
    }
    const sab = sabadellCobrados || 0;
    const contadoCobrados = Math.max(0, cobrados - sab);
    return { total, financia, pendiente_f: pendienteF, cobrados, sab_cobrados: sab, sab_total: sab + financia, contado_cobrados: contadoCobrados, contado_total: pendienteF + contadoCobrados };
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
  // CLASIFICACIÓN v0.20.0
  //
  // 10_BLOQUEOS es SOLO manual (futuro botón). El sistema nunca
  // manda una obra ahí automáticamente.
  //
  // Árbol de decisión para 08_CYCP:
  //   1. Sin F y con 6/12/18/FFCC → 09_FINANCIACION
  //      (todos los contados cobrados, quedan financiaciones)
  //   2. Sin F y sin 6/12/18/FFCC → 11_PREPARADA
  //      (todo cobrado)
  //   3. Con F (contado pendiente), con o sin 6/12/18/FFCC → 08_CYCP
  //      (esperando que los vecinos paguen al contado, situación normal)
  //
  // Las fases 01-07 se siguen tomando de fase_presupuesto sin
  // inferencia, igual que en v0.5.0.
  // ============================================================
  function clasificarObra(obra, bloqueosObra, pagos) {
    const fase = (obra.fase_presupuesto || "").trim();
    if (fase.startsWith("ZZ_")) return null;

    // v0.10.0: estado real de pagos en los pisos
    const p = pagos || { financia: 0, pendiente_f: 0 };
    const tieneFinReal    = p.financia > 0;     // pisos con 6/12/18/FFCC
    const tienePendienteF = p.pendiente_f > 0;  // pisos con F (cobro al contado pdte)

    // Reglas para obra en 08_CYCP
    if (fase === "08_CYCP") {
      const cols = ["08_CYCP"];
      // Si hay financiaciones pendientes de cobrar → también en 09_FINANCIACION
      if (tieneFinReal) cols.push("09_FINANCIACION");
      // Si todo está resuelto (sin F y sin financiaciones) → 11_PREPARADA
      if (!tienePendienteF && !tieneFinReal) return ["11_PREPARADA"];
      return cols;
    }

    // v0.13.0 — Reglas para obra TRAMITADA (Guille la marca tras CYCP)
    // Decisión Alberto: una tramitada no se queda fuera del panel; va a
    // FINANCIACIÓN si tiene financiaciones pendientes · si no, a PREPARADA.
    // Una vez se cobran las financiaciones, ya pasa sola a PREPARADA.
    if (fase === "09_TRAMITADA") {
      if (tieneFinReal) return ["09_FINANCIACION"];
      return ["11_PREPARADA"];
    }

    // Fases 01-07: su fase admin tal cual
    if (FASES.includes(fase)) return [fase];
    return null;
  }

  // ENDPOINT
  app.get("/api/ara-os/panel-obras", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      // Leer en paralelo: comunidades + bloqueos + pisos + temperatura + ordenes_trabajo
      const [rowsCom, rowsBloq, rowsPisos, rowsTemp, rowsOT, rowsFinSab] = await Promise.all([
        leerHoja("comunidades!A2:BD"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
        leerHojaSafe("temperatura_contacto!A2:D"),
        leerHojaSafe("ordenes_trabajo!A2:AJ"),
        leerHojaSafe("financiaciones_sabadell!A2:L"),
      ]);

      // Mapa de cobros Sabadell por comunidad
      const sabadellPorComunidad = {};
      for (const row of (rowsFinSab || [])) {
        const com = String(row[FS_COLS.comunidad] || "").trim();
        if (!com) continue;
        sabadellPorComunidad[com] = (sabadellPorComunidad[com] || 0) + 1;
      }

      // Indexar temperaturas por comunidad
      const tempPorComunidad = {};
      for (const row of rowsTemp) {
        if (!row[0]) continue;
        tempPorComunidad[String(row[0]).trim()] = String(row[1] || "normal").trim().toLowerCase();
      }

      // v0.15.0: indexar órdenes de trabajo por comunidad
      // Una obra solo está en una columna a la vez (Modelo A).
      // Si hay fila en ordenes_trabajo, su fase OT manda sobre la fase admin.
      const otPorComunidad = {};
      for (const row of rowsOT) {
        if (!row[0]) continue;
        otPorComunidad[String(row[0]).trim()] = {
          fase_ot:               row[OT_COLS.fase_ot] || "",
          fecha_creacion:        row[OT_COLS.fecha_creacion] || "",
          creado_por:            row[OT_COLS.creado_por] || "",
          fecha_inicio_obra:     row[OT_COLS.fecha_inicio_obra] || "",
          materiales_pedidos:    row[OT_COLS.materiales_pedidos] || "",
          presidente_avisado:    row[OT_COLS.presidente_avisado] || "",
          llaves_obtenidas:      row[OT_COLS.llaves_obtenidas] || "",
          operarios_asignados:   row[OT_COLS.operarios_asignados] || "",
          ultima_modificacion:   row[OT_COLS.ultima_modificacion] || "",
          ultimo_modificador:    row[OT_COLS.ultimo_modificador] || "",
          // v3.5 · Tiempos / rentabilidad real (cols M-P de OT)
          tiempo_estimado:       row[OT_COLS.tiempo_estimado] || "",
          tiempo_consumido:      row[OT_COLS.tiempo_consumido] || "",
          pct_avance:            row[OT_COLS.pct_avance] || "",
          pct_rentabilidad:      row[OT_COLS.pct_rentabilidad] || "",
          // v3.5 · Holded
          factura_emitida:       row[OT_COLS.factura_emitida] || "",
          numero_factura_holded: row[OT_COLS.numero_factura_holded] || "",
          fecha_factura_emitida: row[OT_COLS.fecha_factura_emitida] || "",
        };
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

      // v3.5 · Mapa { comunidad → horas reales } para la vista lista de OT
      // (columna "Días reales" en días-cuadrilla = horas/16). Cargamos una
      // sola vez para no hacer N consultas.
      let horasPorObraMap = {};
      try {
        const reg = require("./ara-os-registros-tiempo.cjs");
        if (typeof reg.getHorasAcumuladasMap === "function") {
          horasPorObraMap = await reg.getHorasAcumuladasMap();
        }
      } catch (_) { /* registros opcionales · si fallan seguimos */ }

      for (const obra of obras) {
        const bloqObra = bloqueosPorComunidad[obra.comunidad.trim()] || [];
        const pisosObra = pisosPorComunidad[obra.comunidad.trim()] || [];

        // v0.10.0: estado real de pagos en los pisos (sustituye al motor de bloqueos
        // para detectar 09 FINANCIACIÓN / 10 BLOQUEOS / 11 PREPARADA)
        const pagos = calcularPagosObra(pisosObra, sabadellPorComunidad[obra.comunidad.trim()] || 0);

        const grupos_obra = clasificarObra(obra, bloqObra, pagos);
        if (!grupos_obra) continue;
        // v0.15.1: si hay orden de trabajo, la obra SALE del panel comercial
        const ot = otPorComunidad[obra.comunidad.trim()];
        if (ot && ot.fase_ot) continue;

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
          // v0.15.2: si la CYCP ya está cerrada, contamos desde esa fecha
          if (obra.fecha_cycp_completa && String(obra.fecha_cycp_completa).trim()) {
            atascado_fecha_base = obra.fecha_cycp_completa;
            atascado_etiqueta   = "Cerrada hace";
          } else {
            atascado_fecha_base = obra.fecha_envio_contratos_pagos;
            atascado_etiqueta   = "Contratos hace";
          }
        }
        const _t = tiempoHumanoDesde(atascado_fecha_base);
        const atascado_humano = _t.humano;
        const atascado_dias   = _t.dias;

        // v3.5 · Datos económicos para vista lista de OT
        const beneficioPrevisto = parseImporte(obra.beneficio_previsto);
        const beneficioReal     = parseImporte(obra.beneficio_real);
        const manoObraPrevista  = parseImporte(obra.mano_obra_previsto);
        const manoObraReal      = parseImporte(obra.mano_obra_real);
        const materialPrevisto  = parseImporte(obra.material_previsto);
        const materialReal      = parseImporte(obra.material_real);
        // Cobrado estimado: proporción de pisos OK + financiados sobre el total
        const cobradoProp = pagos.total > 0
          ? (pagos.cobrados + (pagos.sab_cobrados || 0)) / pagos.total
          : 0;
        const cobradoEstimado = +(importe * cobradoProp).toFixed(2);
        const pdteCobro = Math.max(0, +(importe - cobradoEstimado).toFixed(2));
        // Rentabilidad % (real si tiene datos, si no previsto)
        const benUsado = beneficioReal > 0 ? beneficioReal : beneficioPrevisto;
        const rentabilidadPct = importe > 0 ? +((benUsado / importe) * 100).toFixed(1) : 0;

        // v3.5 · Tiempos en días-cuadrilla para la vista lista de OT.
        // Previsto sale del sheet (col AE comunidades). Real = horas
        // fichadas en registros_tiempo / 16. Desvío = real − previsto.
        // pct_rentabilidad_real viene de la columna P de OT (escrito
        // por el flujo de Fase 14 al cerrar la obra).
        const tiempoPrevistoCuadrilla = parseFloat(String(obra.tiempo_previsto || "0").replace(",", ".")) || 0;
        const horasObra = Number(horasPorObraMap[obra.comunidad.trim()] || 0);
        const tiempoRealCuadrilla = horasObra > 0 ? +(horasObra / 16).toFixed(2) : 0;
        const tiempoDesvioCuadrilla = tiempoRealCuadrilla > 0
          ? +(tiempoRealCuadrilla - tiempoPrevistoCuadrilla).toFixed(2)
          : 0;
        const otRow = otPorComunidad[obra.comunidad.trim()] || null;
        const pctRentabilidadReal = otRow && otRow.pct_rentabilidad !== undefined
          ? (parseFloat(String(otRow.pct_rentabilidad || "0").replace(",", ".")) || 0)
          : null;

        const item = {
          comunidad: obra.comunidad,
          direccion: obra.direccion,
          ccpp_id: claveCcpp ? ccppId(claveCcpp) : "",
          fase: obra.fase_presupuesto,
          pto_total: importe,
          pto_total_fmt: formatEur(importe),
          // v3.5 · campos económicos
          beneficio_previsto:    beneficioPrevisto,
          beneficio_real:        beneficioReal,
          beneficio:             benUsado,
          beneficio_fmt:         formatEur(benUsado),
          mano_obra_previsto:    manoObraPrevista,
          mano_obra_real:        manoObraReal,
          material_previsto:     materialPrevisto,
          material_real:         materialReal,
          cobrado_estimado:      cobradoEstimado,
          cobrado_estimado_fmt:  formatEur(cobradoEstimado),
          pdte_cobro:            pdteCobro,
          pdte_cobro_fmt:        formatEur(pdteCobro),
          rentabilidad_pct:      rentabilidadPct,
          // v3.5 · Tiempos cuadrilla para vista lista OT
          tiempo_previsto_cuadrilla: tiempoPrevistoCuadrilla,
          tiempo_real_cuadrilla:     tiempoRealCuadrilla,
          tiempo_desvio_cuadrilla:   tiempoDesvioCuadrilla,
          pct_rentabilidad_real:     pctRentabilidadReal,
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
          // v0.14.0: temperatura comercial
          temperatura: tempPorComunidad[obra.comunidad.trim()] || "normal",
          // v0.15.0: orden de trabajo (presente solo si la obra está en fase 12+)
          ot: otPorComunidad[obra.comunidad.trim()] || null,
          est_ccpp_pago: obra.est_ccpp_pago,
          est_ccpp_factura_emasesa: obra.est_ccpp_factura_emasesa,
          notas_pto: obra.notas_pto,
          motivo_pipeline: normalizarMotivo(obra.motivo_pipeline),
          fase_jm: normalizarFaseJM(obra.fase_jm),
          bloqueos: bloqObra,
          // v0.x — datos de contacto para sistema de acciones
          presidente:             obra.presidente || "",
          telefono_presidente:    obra.telefono_presidente || "",
          email_presidente:       obra.email_presidente || "",
          administrador:          obra.administrador || "",
          telefono_administrador: obra.telefono_administrador || "",
          email_administrador:    obra.email_administrador || "",
          fecha_solicitud_pto:    obra.fecha_solicitud_pto || "",
          fecha_visita_pto:       obra.fecha_visita_pto || "",
          fecha_envio_pto:        obra.fecha_envio_pto || "",
          avance_docs: {
            hecho: av_hecho,
            total: av_total,
            pct: avance_pct,
            num_pisos: pisosObra.length,
          },
        };
        for (const g of grupos_obra) {
          if (grupos[g]) grupos[g].push(item);
        }
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
  // GET /api/ara-os/panel-obras/ficha?id=ccpp_xxx&token=TU_ADMIN_TOKEN
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
      const [rowsCom, rowsBloq, rowsPisos, docsPiso, rowsOT] = await Promise.all([
        leerHoja("comunidades!A2:BD"),
        leerHoja("bloqueos_operativos!A2:V"),
        leerHoja("pisos!A2:AS"),
        leerDocsManualesPiso(),
        leerHojaSafe("ordenes_trabajo!A2:AJ"),
      ]);

      // v3.5 · Indexar OT por comunidad para la pestaña EMASESA/Facturar
      // de ObraFicha (BloqueFase14 necesita obra.ot.factura_emitida etc).
      const otMap = {};
      for (const row of (rowsOT || [])) {
        if (!row[0]) continue;
        otMap[String(row[0]).trim()] = {
          fase_ot:               row[OT_COLS.fase_ot] || "",
          fecha_creacion:        row[OT_COLS.fecha_creacion] || "",
          creado_por:            row[OT_COLS.creado_por] || "",
          fecha_inicio_obra:     row[OT_COLS.fecha_inicio_obra] || "",
          materiales_pedidos:    row[OT_COLS.materiales_pedidos] || "",
          presidente_avisado:    row[OT_COLS.presidente_avisado] || "",
          llaves_obtenidas:      row[OT_COLS.llaves_obtenidas] || "",
          operarios_asignados:   row[OT_COLS.operarios_asignados] || "",
          ultima_modificacion:   row[OT_COLS.ultima_modificacion] || "",
          ultimo_modificador:    row[OT_COLS.ultimo_modificador] || "",
          factura_emitida:       row[OT_COLS.factura_emitida] || "",
          numero_factura_holded: row[OT_COLS.numero_factura_holded] || "",
          fecha_factura_emitida: row[OT_COLS.fecha_factura_emitida] || "",
        };
      }

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
        // v0.12.1: detalle de documentos usando catálogo documentos_manuales
        const docs = docsDelPiso(row, docsPiso);
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
          // v0.12.0: listas con codigo + label + flag con_archivo
          docs_entregados: docs.entregados,
          docs_pendientes: docs.pendientes,
        });
      }

      const importe = parseImporte(obraEncontrada.pto_total);
      const avance_pct = av_total > 0 ? Math.round((av_hecho / av_total) * 100) : null;

      // Clasificar para saber en qué columnas del panel está (puede ser más de una)
      const fasesPanel = clasificarObra(obraEncontrada, bloqueosObra) || [];

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

      // Tiempos · v3.5 · ahora cruzamos con registros_tiempo para sacar
      // el real desde las horas trabajadas en lugar de depender de un
      // tiempo_real escrito a mano en comunidades (que casi nunca está).
      let dias_real_cuadrilla = parseFloat(String(obraEncontrada.tiempo_real || "0").replace(",", ".")) || 0;
      try {
        const reg = require("./ara-os-registros-tiempo.cjs");
        if (typeof reg.getHorasAcumuladasPorObra === "function") {
          const r = await reg.getHorasAcumuladasPorObra(obraEncontrada.comunidad);
          const horas = Number(r?.total_horas) || 0;
          if (horas > 0) {
            // 1 día-cuadrilla = 16h (2 ops × 8h) · misma unidad que tiempo_previsto
            dias_real_cuadrilla = +(horas / 16).toFixed(2);
          }
        }
      } catch (e) { /* registros no accesibles · queda el valor del sheet */ }

      const prev = parseFloat(String(obraEncontrada.tiempo_previsto || "0").replace(",", ".")) || 0;
      const desv = dias_real_cuadrilla > 0 ? +(dias_real_cuadrilla - prev).toFixed(2) : 0;
      const tiempo = {
        previsto: obraEncontrada.tiempo_previsto || "",
        real:     dias_real_cuadrilla > 0 ? String(dias_real_cuadrilla) : "",
        desvio:   dias_real_cuadrilla > 0 ? String(desv) : "",
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
          fase_panel:            fasesPanel[0] || null,  // columna principal
          fases_panel:           fasesPanel,              // todas las columnas (duplicación)
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
        ot: otMap[(obraEncontrada.comunidad || "").trim()] || null,
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
      const rowsCom = await leerHoja("comunidades!A2:BD");
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

      // 4. Escribir valor en la celda AS según motivo · v0.17.0
      // Motivos válidos:
      //   "efectivo"             → escribir OK (cobrado por otra vía)
      //   "denegado_paga_otro"   → escribir OK (cobrado por otra vía)
      //   "denegado_pendiente"   → NO tocar est_piso_pago, abrir bloqueo
      //   "retira_firma"         → escribir NP (no procede)
      //   (sin motivo)           → escribir OK (compatibilidad con uso antiguo)
      const motivo = String(req.body?.motivo || "").trim();
      const notas  = String(req.body?.notas  || "").trim();

      const MOTIVOS_OK    = new Set(["", "efectivo", "denegado_paga_otro"]);
      const MOTIVOS_NP    = new Set(["retira_firma"]);
      const MOTIVOS_BLOQ  = new Set(["denegado_pendiente"]);

      let valor_nuevo = null;          // null = no tocar
      if (MOTIVOS_OK.has(motivo))      valor_nuevo = "OK";
      else if (MOTIVOS_NP.has(motivo)) valor_nuevo = "NP";
      else if (MOTIVOS_BLOQ.has(motivo)) valor_nuevo = null;
      else return res.status(400).json({ error: "Motivo desconocido: " + motivo });

      const rangoCelda = `pisos!AS${rowIndexAbs}`;
      if (valor_nuevo) {
        await escribirCelda(rangoCelda, valor_nuevo);
      }

      // 4b. Si motivo es "denegado_pendiente", abrir bloqueo nuevo
      if (motivo === "denegado_pendiente") {
        try {
          await appendFila("bloqueos_operativos", [
            new Date().toISOString(),                  // fecha_abierto
            comunidadBuscada,                          // comunidad
            telefono || "",                            // telefono piso
            vivienda || "",                            // vivienda piso
            "DECISION_PAGO_PENDIENTE",                 // tipo_bloqueo
            "critica",                                 // severidad
            `Sabadell denegó financiación de "${vivienda || telefono}". Pendiente decidir cómo paga el vecino. ${notas}`.trim(),
            "ARA OS / JM",                             // creado_por
            "", "", "", "", "", "", "", "", "", "", "", "", "", "no", // resto cols hasta V
          ]);
        } catch (bloqErr) {
          console.warn("[financiacion-cerrar] bloqueo fallido:", bloqErr.message);
        }
      }

      // 5. Apuntar log en pestaña log_financiaciones
      try {
        await appendFila("log_financiaciones", [
          new Date().toISOString(),
          ccpp_id,
          comunidadBuscada,
          telefono || "",
          vivienda || "",
          valor_actual_esperado,
          valor_nuevo || "(sin cambio)",
          `ARA OS / JM · ${motivo || "manual"}${notas ? " · " + notas : ""}`,
        ]);
      } catch (logErr) {
        console.warn("[financiacion-cerrar] log fallido:", logErr.message);
      }

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.17.0",
        rango_actualizado: rangoCelda,
        valor_anterior: valor_actual_esperado,
        valor_nuevo: valor_nuevo || "(sin cambio)",
        motivo: motivo || "manual",
        bloqueo_abierto: motivo === "denegado_pendiente",
      });
    } catch (err) {
      console.error("[financiacion-cerrar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/financiacion-revertir
  // Revierte un piso de OK/NP de vuelta a su estado de financiación original.
  // Usado cuando se marcó como contado por error.
  app.post("/api/ara-os/panel-obras/financiacion-revertir", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const { ccpp_id, telefono, vivienda, nuevo_estado, notas } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!telefono && !vivienda) return res.status(400).json({ error: "Falta telefono o vivienda" });
      if (!nuevo_estado) return res.status(400).json({ error: "Falta nuevo_estado" });

      const ESTADOS_VALIDOS = new Set(["6", "12", "18", "FFCC", "IPREM", "F"]);
      if (!ESTADOS_VALIDOS.has(String(nuevo_estado).trim().toUpperCase())) {
        return res.status(400).json({ error: "nuevo_estado inválido. Valores: 6, 12, 18, FFCC, IPREM, F" });
      }

      // 1. Localizar la obra
      const rowsCom = await leerHoja("comunidades!A2:BD");
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

      // 2. Localizar la fila del piso
      const rowsPisos = await leerHoja("pisos!A2:AS");
      let rowIndexAbs = -1;
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
          rowIndexAbs = i + 2;
          valorActualReal = String(r[IDX_EST_PISO_PAGO] || "").trim();
          break;
        }
      }
      if (rowIndexAbs < 0) return res.status(404).json({ error: "Piso no encontrado en la obra" });

      // 3. Solo se puede revertir desde OK o NP
      const ESTADOS_REVERTIBLES = new Set(["OK", "NP"]);
      if (!ESTADOS_REVERTIBLES.has(valorActualReal.toUpperCase())) {
        return res.status(409).json({
          error: "No se puede revertir",
          detalle: `El piso tiene estado '${valorActualReal}'. Solo se puede revertir desde OK o NP.`,
          valor_actual: valorActualReal,
        });
      }

      // 4. Escribir nuevo estado en AS
      const rangoCelda = `pisos!AS${rowIndexAbs}`;
      await escribirCelda(rangoCelda, nuevo_estado);

      // 5. Log en log_financiaciones
      try {
        await appendFila("log_financiaciones", [
          new Date().toISOString(),
          ccpp_id,
          comunidadBuscada,
          telefono || "",
          vivienda || "",
          valorActualReal,
          nuevo_estado,
          `ARA OS / JM · revertir${notas ? " · " + notas : ""}`,
        ]);
      } catch (logErr) {
        console.warn("[financiacion-revertir] log fallido:", logErr.message);
      }

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        rango_actualizado: rangoCelda,
        valor_anterior: valorActualReal,
        valor_nuevo: nuevo_estado,
      });
    } catch (err) {
      console.error("[financiacion-revertir]", err);
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
        leerHoja("comunidades!A2:BD"),
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
        const pagos = calcularPagosObra(pisosObra, sabadellPorComunidad[obra.comunidad.trim()] || 0);
        const grupos_obra = clasificarObra(obra, bloqObra, pagos);
        if (!grupos_obra) continue;
        // v0.15.1: si hay orden de trabajo, la obra SALE del panel comercial
        const ot = otPorComunidad[obra.comunidad.trim()];
        if (ot && ot.fase_ot) continue;

        for (const g of grupos_obra) {
          resumenFases[g] = (resumenFases[g] || 0) + 1;
        }

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

  // ============================================================
  // POST /api/ara-os/panel-obras/ot/iniciar
  // v0.15.0 — Crea orden de trabajo para una obra (la mueve a fase 12).
  //
  // Body: { ccpp_id }     (sacamos comunidad del ccpp_id)
  //
  // Si ya existe fila en ordenes_trabajo para esa comunidad → error 409.
  // ============================================================
  app.post("/api/ara-os/panel-obras/ot/iniciar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const { ccpp_id } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      // Localizar comunidad a partir del ccpp_id
      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidad = o.comunidad.trim();
          break;
        }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      // Asegurar pestaña
      await asegurarPestanaOT();

      // Comprobar que no exista ya
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AB");
      for (const row of rowsOT) {
        if (String(row[0] || "").trim() === comunidad) {
          return res.status(409).json({
            error: "Ya existe orden de trabajo para esta obra",
            fase_actual: row[OT_COLS.fase_ot] || "",
          });
        }
      }

      // Crear fila nueva
      const ahora = new Date().toISOString();
      const fila = [
        comunidad,           // A
        "12_INICIO_OBRA",    // B
        ahora,               // C
        "ARA OS · JM",       // D
        "",                  // E fecha_inicio_obra
        "·",                 // F materiales_pedidos
        "·",                 // G presidente_avisado
        "·",                 // H llaves_obtenidas
        "",                  // I operarios_asignados
        ahora,               // J ultima_modificacion
        "ARA OS · JM",       // K ultimo_modificador
      ];

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "ordenes_trabajo!A:K",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });

      // v0.11.0 — Hook timeline (no bloqueante): evento inicial
      try {
        await timelineFases.registrarEventoFase({
          ccpp_id,
          comunidad,
          fase_origen: "",   // No hay fase previa, entra directo a 12
          fase_destino: "12_INICIO_OBRA",
          tipo: "inicial",
          usuario: "ARA OS · JM",
        });
      } catch (err) {
        console.warn("[ot/iniciar] timeline:", err.message);
      }

      res.json({
        ok: true,
        version: "0.11.0",
        comunidad,
        fase_ot: "12_INICIO_OBRA",
        creada_en: ahora,
      });
    } catch (err) {
      console.error("[ot/iniciar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/ot/actualizar
  // v0.15.0 — Actualiza un campo de la OT (un check, fecha, operarios).
  //
  // Body: { ccpp_id, campo, valor }
  //   campo ∈ { "fecha_inicio_obra", "materiales_pedidos",
  //             "presidente_avisado", "llaves_obtenidas",
  //             "operarios_asignados" }
  //   valor: cadena (para los checks: "·"/"F"/"OK")
  // ============================================================
  app.post("/api/ara-os/panel-obras/ot/actualizar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const { ccpp_id, campo, valor } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!campo)   return res.status(400).json({ error: "Falta campo" });
      if (!(campo in OT_COLS)) return res.status(400).json({ error: "Campo no válido" });
      // Validar campos de tipo "check" (·/F/OK)
      const CAMPOS_CHECK = new Set(["materiales_pedidos","presidente_avisado","llaves_obtenidas"]);
      if (CAMPOS_CHECK.has(campo) && !["·","F","OK"].includes(String(valor || "").trim())) {
        return res.status(400).json({ error: "Valor de check inválido (usa ·/F/OK)" });
      }

      // Localizar comunidad
      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidad = o.comunidad.trim();
          break;
        }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      // Localizar fila en ordenes_trabajo
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AB");
      let rowIndex = -1;
      for (let i = 0; i < rowsOT.length; i++) {
        if (String(rowsOT[i][0] || "").trim() === comunidad) {
          rowIndex = i + 2;
          break;
        }
      }
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa para esta obra" });

      const sheets = getSheetsClient();
      const letra = OT_LETRA[OT_COLS[campo]];
      const ahora = new Date().toISOString();

      // Actualizamos en dos pasos: el campo + ultima_modificacion + modificador
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${letra}${rowIndex}`, values: [[String(valor || "")]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`, values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`, values: [["ARA OS · JM"]] },
          ],
        },
      });

      res.json({
        ok: true,
        version: "0.15.0",
        comunidad,
        campo,
        valor: String(valor || ""),
        actualizado_en: ahora,
      });
    } catch (err) {
      console.error("[ot/actualizar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET /api/ara-os/ordenes-trabajo
  // v0.15.1 — Vista del panel de Órdenes de Trabajo (fases 12+).
  //
  // Devuelve obras que tienen fila en `ordenes_trabajo`, enriquecidas
  // con datos de `comunidades` (importe, dirección, días previstos).
  // ============================================================
  app.get("/api/ara-os/ordenes-trabajo", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const [rowsCom, rowsOT] = await Promise.all([
        leerHoja("comunidades!A2:BD"),
        leerHojaSafe("ordenes_trabajo!A2:AK"),
      ]);

      // v0.16.0 — Historial de fases para sacar la fecha de montaje (fase 16)
      let historialMapa = new Map();
      try {
        if (timelineFases.leerHistorialAgrupado) {
          historialMapa = await timelineFases.leerHistorialAgrupado();
        }
      } catch (e) {
        console.warn("[ordenes-trabajo] no se pudo leer historial fases:", e.message);
      }

      // Indexar comunidades por nombre para enriquecer
      const comPorNombre = {};
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        comPorNombre[o.comunidad.trim()] = o;
      }

      // Fases OT disponibles (de momento solo 12)
      const FASES_OT = ["12_INICIO_OBRA","13_EN_EJECUCION","14_FINALIZADA","15_VISITA_INSPECTOR","16_MONTAJE_CONTADORES","17_COBRO_EMASESA","18_COBRADA","19_INCIDENCIAS"];
      const grupos = {};
      for (const f of FASES_OT) grupos[f] = [];

      for (const row of rowsOT) {
        if (!row[0]) continue;
        const comunidad = String(row[0]).trim();
        const fase_ot = String(row[OT_COLS.fase_ot] || "").trim();
        if (!FASES_OT.includes(fase_ot)) continue;

        const obra = comPorNombre[comunidad];
        if (!obra) continue; // huérfana, ignorar

        const claveCcpp = obra.direccion || obra.comunidad || "";
        const importe = parseImporte(obra.pto_total);
        const ot = {
          fase_ot,
          fecha_creacion:          row[OT_COLS.fecha_creacion] || "",
          creado_por:              row[OT_COLS.creado_por] || "",
          fecha_inicio_obra:       row[OT_COLS.fecha_inicio_obra] || "",
          materiales_pedidos:      row[OT_COLS.materiales_pedidos] || "",
          presidente_avisado:      row[OT_COLS.presidente_avisado] || "",
          llaves_obtenidas:        row[OT_COLS.llaves_obtenidas] || "",
          operarios_asignados:     row[OT_COLS.operarios_asignados] || "",
          ultima_modificacion:     row[OT_COLS.ultima_modificacion] || "",
          ultimo_modificador:      row[OT_COLS.ultimo_modificador] || "",
          fecha_inicio_real:       row[OT_COLS.fecha_inicio_real] || "",
          tiempo_estimado:         row[OT_COLS.tiempo_estimado] || "",
          tiempo_consumido:        row[OT_COLS.tiempo_consumido] || "",
          pct_avance:              row[OT_COLS.pct_avance] || "",
          pct_rentabilidad:        row[OT_COLS.pct_rentabilidad] || "",
          num_certificaciones:     row[OT_COLS.num_certificaciones] || "",
          fechas_certificaciones:  row[OT_COLS.fechas_certificaciones] || "",
          factura_emitida:         row[OT_COLS.factura_emitida] || "",
          certificados_entregados: row[OT_COLS.certificados_entregados] || "",
          visita_inspector_fecha:  row[OT_COLS.visita_inspector_fecha] || "",
          visto_bueno:             row[OT_COLS.visto_bueno] || "",
          contadores_montados:     row[OT_COLS.contadores_montados] || "",
          cobro_emasesa_fecha:     row[OT_COLS.cobro_emasesa_fecha] || "",
          // v0.16.0 — fecha de montaje editable (col AB)
          fecha_montaje_manual:    row[OT_COLS.fecha_montaje] || "",
          incidencia_abierta:      row[OT_COLS.incidencia_abierta] || "",
          incidencia_descripcion:  row[OT_COLS.incidencia_descripcion] || "",
          // v0.18.0 — Fase 14 Holded: campo necesario para badge del panel
          fecha_firma_presidente:  row[35] || "",
          // v0.19.0 — Fase 14 PDF firmado en Drive
          url_pdf_firmado:         row[36] || "",
        };

        // Días desde que se creó la OT (cuánto lleva en la fase)
        const _t = tiempoHumanoDesde(ot.fecha_creacion);

        // v0.16.0 — Fecha de montaje: manual si existe, si no del timeline (fase 16)
        const ccppIdCalc = claveCcpp ? ccppId(claveCcpp) : "";
        const eventosObra = historialMapa.get(ccppIdCalc) || historialMapa.get(comunidad) || [];
        const fechaMontajeTimeline = fechaMontajeDeTimeline(eventosObra);
        const fechaMontaje = ot.fecha_montaje_manual || fechaMontajeTimeline || "";
        const fechaCobro = calcularFechaCobro(fechaMontaje);

        grupos[fase_ot].push({
          comunidad,
          direccion:     obra.direccion,
          ccpp_id:       ccppIdCalc,
          pto_total:     importe,
          pto_total_fmt: formatEur(importe),
          tiempo_previsto: obra.tiempo_previsto,
          ot,
          dias_en_fase:    _t.dias,
          dias_humano:     _t.humano,
          // v0.16.0 — fechas de montaje y cobro EMASESA
          fecha_montaje:         fechaMontaje,
          fecha_montaje_timeline: fechaMontajeTimeline,
          fecha_montaje_manual:  ot.fecha_montaje_manual || "",
          fecha_cobro:           fechaCobro,
        });
      }

      // Ordenar cada grupo por días en fase (más viejo arriba)
      for (const f of FASES_OT) {
        grupos[f].sort((a, b) => (b.dias_en_fase || 0) - (a.dias_en_fase || 0));
      }

      const cuentas = { total: 0 };
      const totales = { total: 0 };
      for (const f of FASES_OT) {
        cuentas[f] = grupos[f].length;
        cuentas.total += grupos[f].length;
        totales[f] = grupos[f].reduce((s, o) => s + o.pto_total, 0);
        totales.total += totales[f];
      }
      const totales_fmt = {};
      for (const k of Object.keys(totales)) totales_fmt[k] = formatEur(totales[k]);

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.15.1",
        fases: FASES_OT,
        grupos,
        cuentas,
        totales,
        totales_fmt,
      });
    } catch (err) {
      console.error("[ordenes-trabajo]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET /api/ara-os/panel-obras/financiaciones-sabadell?ccpp_id=...
  // v0.16.0 — Devuelve las financiaciones Sabadell registradas
  // para una comunidad concreta (para mostrar en la ficha de obra).
  // ============================================================
  app.get("/api/ara-os/panel-obras/financiaciones-sabadell", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }
    try {
      const ccpp_id = req.query.ccpp_id;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      // Localizar comunidad
      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidad = o.comunidad.trim();
          break;
        }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      const rowsFS = await leerHojaSafe("financiaciones_sabadell!A2:L");
      const mias = [];
      for (const row of rowsFS) {
        if (String(row[FS_COLS.comunidad] || "").trim() !== comunidad) continue;
        mias.push({
          n_operacion:    row[FS_COLS.n_operacion] || "",
          tipo:           row[FS_COLS.tipo] || "",
          comunidad:      row[FS_COLS.comunidad] || "",
          vivienda:       row[FS_COLS.vivienda] || "",
          titular:        row[FS_COLS.titular] || "",
          importe:        parseImporte(row[FS_COLS.importe]),
          fecha:          row[FS_COLS.fecha] || "",
          empresa:        row[FS_COLS.empresa] || "",
          url_pdf:        row[FS_COLS.url_pdf] || "",
          n_transferencia: row[FS_COLS.n_transferencia] || "",
          registrado_en:  row[FS_COLS.registrado_en] || "",
          registrado_por: row[FS_COLS.registrado_por] || "",
        });
      }
      // Ordenar por fecha descendente
      mias.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

      const total = mias.reduce((s, x) => s + (x.importe || 0), 0);

      res.json({
        ok: true,
        version: "0.16.0",
        comunidad,
        count: mias.length,
        total,
        total_fmt: formatEur(total),
        financiaciones: mias,
      });
    } catch (err) {
      console.error("[financiaciones-sabadell GET]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/financiacion-sabadell/registrar
  // v0.16.0 — Registra una financiación Sabadell (piso o comunidad).
  //
  // Body comunes:
  //   ccpp_id, n_operacion, importe, fecha (YYYY-MM-DD),
  //   titular, empresa (opcional), url_pdf (opcional), n_transferencia (opcional)
  //
  // Si tipo = "piso":   también vivienda (o telefono) para identificar el piso.
  //                     Marca SOLO ese piso como cobrado (est_piso_pago = OK).
  // Si tipo = "comunidad": no necesita piso. Marca TODOS los pisos de la
  //                     comunidad con est_piso_pago en {12,18,FFCC,F,6} → OK.
  //
  // En ambos casos: graba fila en `financiaciones_sabadell` y registra
  // movimientos en `log_financiaciones`.
  // ============================================================
  app.options("/api/ara-os/panel-obras/financiacion-sabadell/registrar", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/financiacion-sabadell/registrar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const {
        ccpp_id, tipo, n_operacion, importe, fecha, titular,
        vivienda, telefono, empresa, url_pdf, n_transferencia,
      } = req.body || {};

      if (!ccpp_id)        return res.status(400).json({ error: "Falta ccpp_id" });
      if (!tipo || !["piso","comunidad"].includes(tipo))
        return res.status(400).json({ error: "tipo debe ser 'piso' o 'comunidad'" });
      if (!n_operacion)    return res.status(400).json({ error: "Falta n_operacion" });
      if (!importe || isNaN(parseFloat(importe)))
        return res.status(400).json({ error: "Falta importe (número)" });
      if (!fecha)          return res.status(400).json({ error: "Falta fecha (YYYY-MM-DD)" });
      if (tipo === "piso" && !vivienda && !telefono)
        return res.status(400).json({ error: "Para tipo=piso hace falta vivienda o telefono" });

      // 1. Localizar comunidad
      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidad = o.comunidad.trim();
          break;
        }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      // 2. Asegurar pestaña
      await asegurarPestanaFinancSabadell();

      // 3. Comprobar duplicado de n_operacion (cada operación debe ser única)
      const rowsFS = await leerHojaSafe("financiaciones_sabadell!A2:L");
      for (const row of rowsFS) {
        if (String(row[FS_COLS.n_operacion] || "").trim() === String(n_operacion).trim()) {
          return res.status(409).json({
            error: "Ya existe una financiación con ese n_operacion",
            n_operacion,
            comunidad_existente: row[FS_COLS.comunidad] || "",
          });
        }
      }

      // 4. Recorrer pisos para identificar cuáles marcar como cobrados
      const rowsPisos = await leerHoja("pisos!A2:AS");
      const VALORES_FINANCIANDO = new Set(["6","12","18","FFCC","F"]);
      // pisosTocar = [{ rowIndexAbs, valorAnterior, vivienda, telefono }]
      const pisosTocar = [];
      for (let i = 0; i < rowsPisos.length; i++) {
        const r = rowsPisos[i] || [];
        if (String(r[1] || "").trim() !== comunidad) continue;
        const tlf = String(r[0] || "").trim();
        const viv = String(r[2] || "").trim();
        const estado = String(r[IDX_EST_PISO_PAGO] || "").trim();

        if (tipo === "piso") {
          const coincideTel = telefono && tlf && tlf === String(telefono).trim();
          const coincideViv = vivienda && viv && viv === String(vivienda).trim();
          if (coincideTel || coincideViv) {
            pisosTocar.push({ rowIndexAbs: i + 2, valorAnterior: estado, vivienda: viv, telefono: tlf });
            break;
          }
        } else {
          // tipo = comunidad: tocar TODOS los pisos con valor en {6,12,18,FFCC,F}
          if (VALORES_FINANCIANDO.has(estado.toUpperCase())) {
            pisosTocar.push({ rowIndexAbs: i + 2, valorAnterior: estado, vivienda: viv, telefono: tlf });
          }
        }
      }

      if (tipo === "piso" && pisosTocar.length === 0) {
        return res.status(404).json({ error: "Piso no encontrado en la comunidad" });
      }

      // 5. Marcar pisos como OK
      for (const p of pisosTocar) {
        await escribirCelda(`pisos!AS${p.rowIndexAbs}`, "OK");
      }

      // 6. Grabar fila en financiaciones_sabadell
      const ahora = new Date().toISOString();
      await appendFila("financiaciones_sabadell", [
        String(n_operacion).trim(),
        tipo,
        comunidad,
        tipo === "piso" ? (vivienda || telefono || "") : "",
        titular || "",
        parseFloat(importe),
        fecha,
        empresa || "",
        url_pdf || "",
        n_transferencia || "",
        ahora,
        "ARA OS · JM",
      ]);

      // 7. Logs por cada piso tocado
      for (const p of pisosTocar) {
        try {
          await appendFila("log_financiaciones", [
            ahora,
            ccpp_id,
            comunidad,
            p.telefono,
            p.vivienda,
            p.valorAnterior,
            "OK",
            `ARA OS · Sabadell ${n_operacion}`,
          ]);
        } catch (logErr) {
          console.warn("[financiacion-sabadell] log fallido:", logErr.message);
        }
      }

      res.json({
        ok: true,
        version: "0.16.0",
        comunidad,
        tipo,
        n_operacion,
        pisos_marcados: pisosTocar.length,
        pisos_detalle: pisosTocar.map(p => ({
          vivienda: p.vivienda,
          telefono: p.telefono,
          valor_anterior: p.valorAnterior,
        })),
        registrado_en: ahora,
      });
    } catch (err) {
      console.error("[financiacion-sabadell registrar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET /api/ara-os/panel-obras/financiaciones-sabadell-resumen
  // v0.17.0 — Resumen mensual de pagos Sabadell registrados.
  // Para conciliar con extracto Santander.
  //
  // Query opcional: ?year=2026 (por defecto: año actual)
  //
  // Devuelve:
  //   { year, meses: [{mes, count, total, total_fmt, items: [...]}],
  //     count_total, total_total, total_total_fmt }
  // ============================================================
  app.get("/api/ara-os/panel-obras/financiaciones-sabadell-resumen", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) {
      return res.status(401).json({ error: "Token inválido" });
    }
    try {
      const yearParam = req.query.year || String(new Date().getFullYear());
      const todosModos = yearParam === "todo";
      const year = todosModos ? null : parseInt(yearParam, 10);
      const rowsFS = await leerHojaSafe("financiaciones_sabadell!A2:L");

      // Indexar por mes (1-12)
      const porMes = {};
      for (let m = 1; m <= 12; m++) porMes[m] = { count: 0, total: 0, items: [] };

      let totalAnual = 0;
      let countAnual = 0;

      for (const row of rowsFS) {
        const fecha = String(row[FS_COLS.fecha] || "").trim();
        if (!fecha) continue;
        // fecha esperada: YYYY-MM-DD
        const d = new Date(fecha);
        if (isNaN(d.getTime())) continue;
        if (!todosModos && d.getFullYear() !== year) continue;
        const m = d.getMonth() + 1;
        const importe = parseImporte(row[FS_COLS.importe]);
        porMes[m].count += 1;
        porMes[m].total += importe;
        porMes[m].items.push({
          n_operacion: row[FS_COLS.n_operacion] || "",
          tipo:        row[FS_COLS.tipo] || "",
          comunidad:   row[FS_COLS.comunidad] || "",
          vivienda:    row[FS_COLS.vivienda] || "",
          titular:     row[FS_COLS.titular] || "",
          importe,
          fecha,
          empresa:     row[FS_COLS.empresa] || "",
        });
        totalAnual += importe;
        countAnual += 1;
      }

      const NOMBRES_MES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      const meses = [];
      for (let m = 1; m <= 12; m++) {
        const x = porMes[m];
        meses.push({
          mes:       m,
          nombre:    NOMBRES_MES[m],
          count:     x.count,
          total:     x.total,
          total_fmt: formatEur(x.total),
          items:     x.items.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
        });
      }

      // En modo todo: construir resumen por año
      let anos = null;
      if (todosModos) {
        const porAno = {};
        for (const row of rowsFS) {
          const fecha = String(row[FS_COLS.fecha] || "").trim();
          if (!fecha) continue;
          const d = new Date(fecha);
          if (isNaN(d.getTime())) continue;
          if (String(row[FS_COLS.tipo] || "").trim() === "entrega_emasesa") continue;
          const y = d.getFullYear();
          if (!porAno[y]) porAno[y] = { count: 0, total: 0 };
          porAno[y].count += 1;
          porAno[y].total += parseImporte(row[FS_COLS.importe]);
        }
        anos = Object.keys(porAno).sort().map(y => ({
          year: parseInt(y),
          count: porAno[y].count,
          total: porAno[y].total,
          total_fmt: formatEur(porAno[y].total),
        }));
      }

      res.json({
        ok: true,
        version: "0.17.0",
        year: todosModos ? "todo" : year,
        meses,
        anos,
        count_total: countAnual,
        total_total: totalAnual,
        total_total_fmt: formatEur(totalAnual),
      });
    } catch (err) {
      console.error("[financiaciones-sabadell-resumen]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.options("/api/ara-os/panel-obras/financiacion-sabadell/previsualizar-excel", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/financiacion-sabadell/previsualizar-excel", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const { pagos } = req.body || {};
      if (!Array.isArray(pagos) || pagos.length === 0)
        return res.status(400).json({ error: "Falta array pagos" });
      const [rowsCom, rowsPisos, rowsFS] = await Promise.all([
        leerHoja("comunidades!A2:BD"),
        leerHoja("pisos!A2:AS"),
        leerHojaSafe("financiaciones_sabadell!A2:L"),
      ]);
      const obras = [];
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (!clave) continue;
        obras.push({ ccpp_id: ccppId(clave), comunidad: o.comunidad.trim() });
      }
      const pisosPorComunidad = {};
      for (const row of rowsPisos) {
        if (!row[1]) continue;
        const com = String(row[1]).trim();
        if (!pisosPorComunidad[com]) pisosPorComunidad[com] = [];
        pisosPorComunidad[com].push({
          telefono:      (row[0] || "").toString().trim(),
          vivienda:      (row[2] || "").toString().trim(),
          nombre:        (row[4] || "").toString().trim(),
          est_piso_pago: (row[IDX_EST_PISO_PAGO] || "").toString().trim(),
        });
      }
      const yaRegistrados = new Set();
      for (const row of rowsFS) {
        const n = String(row[FS_COLS.n_operacion] || "").trim();
        if (n) yaRegistrados.add(n);
      }
      function normNombre(s) {
        return String(s || "").toUpperCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Z0-9 ]/g, "").trim();
      }
      const resultado = pagos.map(pago => {
        const duplicado = yaRegistrados.has(String(pago.n_operacion || "").trim());
        const titularNorm = normNombre(pago.titular);
        const candidatos = [];
        for (const obra of obras) {
          const pisos = pisosPorComunidad[obra.comunidad] || [];
          for (const p of pisos) {
            const nombreNorm = normNombre(p.nombre);
            const palabrasTitular = titularNorm.split(" ").filter(x => x.length > 2);
            const palabrasNombre  = nombreNorm.split(" ").filter(x => x.length > 2);
            const comunes = palabrasTitular.filter(w => palabrasNombre.includes(w));
            if (comunes.length >= 2 || nombreNorm === titularNorm) {
              candidatos.push({ ccpp_id: obra.ccpp_id, comunidad: obra.comunidad, vivienda: p.vivienda, telefono: p.telefono, nombre: p.nombre, est_piso_pago: p.est_piso_pago, score: comunes.length });
            }
          }
        }
        candidatos.sort((a, b) => b.score - a.score);
        return { ...pago, duplicado, candidatos: candidatos.slice(0, 5) };
      });
      res.json({ ok: true, version: "0.18.0", pagos: resultado });
    } catch (err) {
      console.error("[previsualizar-excel]", err);
      res.status(500).json({ error: err.message });
    }
  });


  // ============================================================
  // POST /api/ara-os/panel-obras/financiacion-sabadell/entregar-emasesa
  // Registra una fila tipo "entrega_emasesa" en financiaciones_sabadell
  // ============================================================
  app.options("/api/ara-os/panel-obras/financiacion-sabadell/entregar-emasesa", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/financiacion-sabadell/entregar-emasesa", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, comunidad, importe, fecha } = req.body || {};
      if (!ccpp_id || !comunidad) return res.status(400).json({ error: "Faltan datos" });

      await asegurarPestanaFinancSabadell();

      const fechaReal = fecha || new Date().toISOString().slice(0, 10);
      const ahora = new Date().toISOString();

      await appendFila("financiaciones_sabadell", [
        "",                  // A n_operacion
        "entrega_emasesa",   // B tipo
        comunidad,           // C comunidad
        "",                  // D vivienda
        "EMASESA",           // E titular
        importe || 0,        // F importe
        fechaReal,           // G fecha
        "",                  // H empresa
        "",                  // I url_pdf
        "",                  // J n_transferencia
        ahora,               // K registrado_en
        "ARA OS · JM",       // L registrado_por
      ]);

      res.json({ ok: true, fecha: fechaReal, importe });
    } catch (err) {
      console.error("[entregar-emasesa]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET /api/ara-os/panel-obras/financiacion-sabadell/entrega-emasesa
  // Devuelve la última entrega a EMASESA de una obra
  // ============================================================
  app.options("/api/ara-os/panel-obras/financiacion-sabadell/entrega-emasesa", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/panel-obras/financiacion-sabadell/entrega-emasesa", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, comunidad } = req.query;
      if (!comunidad) return res.status(400).json({ error: "Falta comunidad" });

      const rows = await leerHojaSafe("financiaciones_sabadell!A2:L");
      const entregas = (rows || []).filter(r =>
        String(r[FS_COLS.tipo] || "").trim() === "entrega_emasesa" &&
        String(r[FS_COLS.comunidad] || "").trim() === comunidad.trim()
      ).map(r => ({
        fecha: r[FS_COLS.fecha] || "",
        importe: parseFloat(r[FS_COLS.importe] || 0),
        registrado_en: r[FS_COLS.registrado_en] || "",
      }));

      entregas.sort((a, b) => b.fecha.localeCompare(a.fecha));
      res.json({ ok: true, entregas, ultima: entregas[0] || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



  // ============================================================
  // GET /api/ara-os/panel-obras/financiacion-sabadell/custodia-resumen
  // Devuelve el dinero custodiado por ARA por comunidad
  // (total cobrado Sabadell - lo ya entregado a EMASESA)
  // ============================================================
  app.options("/api/ara-os/panel-obras/financiacion-sabadell/custodia-resumen", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get("/api/ara-os/panel-obras/financiacion-sabadell/custodia-resumen", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const rows = await leerHojaSafe("financiaciones_sabadell!A2:L");
      const porComunidad = {};

      for (const row of (rows || [])) {
        const tipo     = String(row[FS_COLS.tipo]      || "").trim();
        const com      = String(row[FS_COLS.comunidad] || "").trim();
        const importe  = parseImporte(row[FS_COLS.importe]);
        if (!com) continue;

        if (!porComunidad[com]) porComunidad[com] = { cobrado: 0, entregado: 0, pagos: 0 };

        if (tipo === "entrega_emasesa") {
          porComunidad[com].entregado += importe;
        } else if (tipo === "piso" || tipo === "comunidad") {
          porComunidad[com].cobrado += importe;
          porComunidad[com].pagos   += 1;
        }
      }

      const comunidades = Object.entries(porComunidad)
        .map(([comunidad, d]) => ({
          comunidad,
          cobrado:      d.cobrado,
          cobrado_fmt:  formatEur(d.cobrado),
          entregado:    d.entregado,
          entregado_fmt: formatEur(d.entregado),
          custodia:     d.cobrado - d.entregado,
          custodia_fmt: formatEur(d.cobrado - d.entregado),
          pagos:        d.pagos,
          entregado_emasesa: d.entregado > 0,
        }))
        .sort((a, b) => b.custodia - a.custodia);

      const totalCustodia  = comunidades.reduce((s, c) => s + c.custodia, 0);
      const totalCobrado   = comunidades.reduce((s, c) => s + c.cobrado, 0);
      const totalEntregado = comunidades.reduce((s, c) => s + c.entregado, 0);

      res.json({
        ok: true,
        comunidades,
        total_custodia:      totalCustodia,
        total_custodia_fmt:  formatEur(totalCustodia),
        total_cobrado:       totalCobrado,
        total_cobrado_fmt:   formatEur(totalCobrado),
        total_entregado:     totalEntregado,
        total_entregado_fmt: formatEur(totalEntregado),
      });
    } catch (err) {
      console.error("[custodia-resumen]", err);
      res.status(500).json({ error: err.message });
    }
  });



  // ============================================================
  // POST /api/ara-os/panel-obras/bloquear
  // v0.20.0 — Guillermo manda una obra a 10_BLOQUEOS manualmente
  // desde cualquier fase del panel, con motivo libre.
  //
  // Body: { ccpp_id, motivo, marcado_por? }
  // ============================================================
  app.options("/api/ara-os/panel-obras/bloquear", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/bloquear", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id, motivo, marcado_por } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!motivo || !String(motivo).trim()) return res.status(400).json({ error: "Falta motivo" });

      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      let direccion = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) {
          comunidad = o.comunidad.trim();
          direccion = o.direccion.trim();
          break;
        }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      const ahora      = new Date().toISOString();
      const ahoraFecha = ahora.slice(0, 10);
      const quien      = String(marcado_por || "Guillermo").trim();

      await appendFila("bloqueos_operativos", [
        comunidad,
        "MANUAL_GUILLERMO",
        "critica",
        "José Manuel",
        "bloquea_inicio",
        "",
        String(motivo).trim(),
        quien,
        ahoraFecha,
        "", "", "", "", "", "", "",
        "no",
        "",
        "José Manuel",
        "", "",
        "Bloqueado por " + quien + " el " + ahoraFecha,
      ]);

      try {
        await appendFila("log_bloqueos_manuales", [
          ahora, ccpp_id, comunidad, direccion, String(motivo).trim(), quien,
        ]);
      } catch (e) { /* no crítico */ }

      res.json({
        ok: true,
        version: "0.20.0",
        comunidad,
        motivo: String(motivo).trim(),
        marcado_por: quien,
        bloqueado_en: ahora,
      });
    } catch (err) {
      console.error("[panel-obras/bloquear]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET /api/ara-os/panel-obras/bloqueos-hoy
  // v0.20.0 — Bloqueos manuales creados HOY para Mi Día de JM.
  // ============================================================
  app.get("/api/ara-os/panel-obras/bloqueos-hoy", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const hoy  = new Date().toISOString().slice(0, 10);
      const rows = await leerHoja("bloqueos_operativos!A2:V");
      const bloqueos = [];

      for (const row of rows) {
        if (!row[0]) continue;
        const b = filaABloqueo(row);
        if (b.tipo_bloqueo !== "MANUAL_GUILLERMO") continue;
        if (b.resuelto === "si") continue;
        if (!b.detectado_en.startsWith(hoy)) continue;
        bloqueos.push({
          comunidad:   b.comunidad,
          motivo:      b.accion_exacta,
          marcado_por: b.detectado_por,
          fecha:       b.detectado_en,
          comentario:  b.comentario_operativo,
        });
      }

      res.json({
        ok: true,
        version: "0.20.0",
        fecha: hoy,
        count: bloqueos.length,
        bloqueos,
      });
    } catch (err) {
      console.error("[bloqueos-hoy]", err);
      res.status(500).json({ error: err.message });
    }
  });


  // ============================================================
  // POST /api/ara-os/panel-obras/ot/avanzar-fase
  // v0.21.0 — JM pasa una obra a la siguiente fase del flujo OT.
  //
  // Secuencia: 12 → 13 → 14 → 15 → 16 → 17 (fin)
  // 18_INCIDENCIAS es transversal, no entra en la secuencia.
  //
  // Body: { ccpp_id }
  // ============================================================
  const SECUENCIA_OT = [
    "12_INICIO_OBRA",
    "13_EN_EJECUCION",
    "14_FINALIZADA",
    "15_VISITA_INSPECTOR",
    "16_MONTAJE_CONTADORES",
    "17_COBRO_EMASESA",
    "18_COBRADA",
  ];

  app.options("/api/ara-os/panel-obras/ot/avanzar-fase", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/ot/avanzar-fase", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      // Localizar comunidad
      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) { comunidad = o.comunidad.trim(); break; }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      // Localizar fila en ordenes_trabajo
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AB");
      let rowIndex = -1;
      let faseActual = "";
      for (let i = 0; i < rowsOT.length; i++) {
        if (String(rowsOT[i][0] || "").trim() === comunidad) {
          rowIndex = i + 2;
          faseActual = String(rowsOT[i][OT_COLS.fase_ot] || "").trim();
          break;
        }
      }
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa para esta obra" });

      const idxActual = SECUENCIA_OT.indexOf(faseActual);
      if (idxActual < 0) return res.status(400).json({ error: "Fase actual no reconocida: " + faseActual });
      if (idxActual === SECUENCIA_OT.length - 1) return res.status(400).json({ error: "La obra ya está en la última fase (17)" });

      const faseSiguiente = SECUENCIA_OT[idxActual + 1];
      const ahora = new Date().toISOString();

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.fase_ot]}${rowIndex}`,            values: [[faseSiguiente]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`, values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,  values: [["ARA OS · JM"]] },
          ],
        },
      });

      // v0.11.0 — Hook timeline (no bloqueante)
      try {
        await timelineFases.registrarEventoFase({
          ccpp_id,
          comunidad,
          fase_origen: faseActual,
          fase_destino: faseSiguiente,
          tipo: "avance",
          usuario: "ARA OS · JM",
        });
      } catch (err) {
        console.warn("[ot/avanzar-fase] timeline:", err.message);
      }

      res.json({ ok: true, version: "0.11.0", comunidad, fase_anterior: faseActual, fase_nueva: faseSiguiente, actualizado_en: ahora });
    } catch (err) {
      console.error("[ot/avanzar-fase]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/panel-obras/ot/incidencia
  // v0.21.0 — JM abre o cierra una incidencia en una obra.
  //
  // Body: { ccpp_id, accion: "abrir"|"cerrar", descripcion? }
  // ============================================================
  app.options("/api/ara-os/panel-obras/ot/incidencia", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/ot/incidencia", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id, accion, descripcion } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!["abrir","cerrar"].includes(accion)) return res.status(400).json({ error: "accion debe ser 'abrir' o 'cerrar'" });
      if (accion === "abrir" && !descripcion?.trim()) return res.status(400).json({ error: "Falta descripcion" });

      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) { comunidad = o.comunidad.trim(); break; }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AB");
      let rowIndex = -1;
      for (let i = 0; i < rowsOT.length; i++) {
        if (String(rowsOT[i][0] || "").trim() === comunidad) { rowIndex = i + 2; break; }
      }
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa para esta obra" });

      const ahora = new Date().toISOString();
      const sheets = getSheetsClient();

      if (accion === "abrir") {
        // Si hay incidencia abierta → mover a 18_INCIDENCIAS
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.fase_ot]}${rowIndex}`,               values: [["19_INCIDENCIAS"]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.incidencia_abierta]}${rowIndex}`,     values: [["si"]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.incidencia_descripcion]}${rowIndex}`, values: [[String(descripcion).trim()]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`,    values: [[ahora]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,     values: [["ARA OS · JM"]] },
            ],
          },
        });
      } else {
        // Cerrar incidencia → volver a la fase anterior (guardada en descripcion vacío)
        // Por ahora volvemos a 12 si no hay otra info; JM puede mover manualmente
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.incidencia_abierta]}${rowIndex}`,     values: [["no"]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.incidencia_descripcion]}${rowIndex}`, values: [[""]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`,    values: [[ahora]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,     values: [["ARA OS · JM"]] },
            ],
          },
        });
      }

      res.json({ ok: true, version: "0.21.0", comunidad, accion, actualizado_en: ahora });
    } catch (err) {
      console.error("[ot/incidencia]", err);
      res.status(500).json({ error: err.message });
    }
  });



  // ============================================================
  // POST /api/ara-os/panel-obras/ot/retroceder-fase
  // v0.21.0 — JM vuelve a la fase anterior si se equivocó.
  // ============================================================
  app.options("/api/ara-os/panel-obras/ot/retroceder-fase", (req, res) => { responderCORS(res); res.status(204).end(); });
  app.post("/api/ara-os/panel-obras/ot/retroceder-fase", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const rowsCom = await leerHoja("comunidades!A2:BD");
      let comunidad = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) { comunidad = o.comunidad.trim(); break; }
      }
      if (!comunidad) return res.status(404).json({ error: "Obra no encontrada" });

      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AB");
      let rowIndex = -1, faseActual = "";
      for (let i = 0; i < rowsOT.length; i++) {
        if (String(rowsOT[i][0] || "").trim() === comunidad) {
          rowIndex = i + 2;
          faseActual = String(rowsOT[i][OT_COLS.fase_ot] || "").trim();
          break;
        }
      }
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa" });

      const idxActual = SECUENCIA_OT.indexOf(faseActual);
      if (idxActual <= 0) return res.status(400).json({ error: "Ya está en la primera fase" });

      const faseAnterior = SECUENCIA_OT[idxActual - 1];
      const ahora = new Date().toISOString();
      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.fase_ot]}${rowIndex}`,            values: [[faseAnterior]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`, values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,  values: [["ARA OS · JM"]] },
          ],
        },
      });

      // v0.11.0 — Hook timeline (no bloqueante)
      try {
        await timelineFases.registrarEventoFase({
          ccpp_id,
          comunidad,
          fase_origen: faseActual,
          fase_destino: faseAnterior,
          tipo: "retroceso",
          usuario: "ARA OS · JM",
        });
      } catch (err) {
        console.warn("[ot/retroceder-fase] timeline:", err.message);
      }

      res.json({ ok: true, version: "0.11.0", comunidad, fase_anterior: faseActual, fase_nueva: faseAnterior, actualizado_en: ahora });
    } catch (err) {
      console.error("[ot/retroceder-fase]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // v0.24.0 — ADJUNTOS · Listar archivos de Drive de la comunidad
  //
  // GET /api/ara-os/panel-obras/adjuntos?ccpp_id=XXX
  //
  // Devuelve los archivos de la carpeta Drive de la comunidad
  // (subcarpeta de DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES con nombre
  // "<tipo_via> <direccion>"), categorizados por tipo.
  //
  // Operación de SOLO LECTURA — nunca crea ni modifica carpetas/archivos.
  // ============================================================
  function getDriveClient() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.drive({ version: "v3", auth });
  }

  // Categorización por nombre + mimeType. Devuelve clave + emoji + etiqueta.
  function categorizarArchivo(name, mimeType) {
    const n = String(name || "").toLowerCase();
    const m = String(mimeType || "").toLowerCase();

    // Fotos: por mime
    if (m.startsWith("image/")) {
      return { key: "fotos", emoji: "📷", label: "Fotos" };
    }

    // Certificados EMASESA (orden importante: antes que "documentacion")
    if (/co[_\s-]?0?(73|80|51)|relacion[_\s-]?tomas|rotulo[_\s-]?bateria|certificado/.test(n)) {
      return { key: "certificados", emoji: "📄", label: "Certificados" };
    }

    // Facturas
    if (/factura|^f2[0-9]{4,}|holded/.test(n)) {
      return { key: "facturas", emoji: "💰", label: "Facturas" };
    }

    // Presupuestos
    if (/presupuesto|ppto|rev-?\d+/.test(n)) {
      return { key: "presupuestos", emoji: "📑", label: "Presupuestos" };
    }

    // Documentación CCPP/firmas
    if (/documentacion|documento|acta|nif|dni|contrato|firma|cycp/.test(n)) {
      return { key: "documentacion", emoji: "📐", label: "Documentación" };
    }

    return { key: "otros", emoji: "📦", label: "Otros" };
  }

  // Listar archivos recursivamente. Devuelve array plano de {id, name, mime, size, url, modified, ruta}.
  // Limitamos profundidad para no explorar carpetas sin fin.
  async function listarDriveRecursivo(drive, folderId, rutaActual = "", profundidad = 0) {
    if (profundidad > 3) return [];   // máx 4 niveles
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,size,webViewLink,modifiedTime)",
      pageSize: 200,
      orderBy: "name",
    });
    const items = res.data.files || [];
    const out = [];
    for (const f of items) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const sub = await listarDriveRecursivo(drive, f.id, rutaActual ? `${rutaActual}/${f.name}` : f.name, profundidad + 1);
        out.push(...sub);
      } else {
        out.push({
          id: f.id,
          name: f.name,
          mime: f.mimeType,
          size: f.size ? parseInt(f.size, 10) : null,
          url: f.webViewLink,
          modified: f.modifiedTime,
          ruta: rutaActual,   // ej. "" si está en raíz; "adjuntos" si está en subcarpeta
        });
      }
    }
    return out;
  }

  app.options("/api/ara-os/panel-obras/adjuntos", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
  });
  app.get("/api/ara-os/panel-obras/adjuntos", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const ccpp_id = String(req.query.ccpp_id || req.query.id || "").trim();
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      // 1) Resolver tipo_via + direccion desde `comunidades` (SOLO LECTURA, zona Guille).
      //    Usamos la misma convención que /ficha: rowToObj + ccppId(clave).
      const rowsCom = await leerHojaSafe("comunidades!A2:BD");
      let obra = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = rowToObj(row);
        const clave = o.direccion || o.comunidad || "";
        const id = clave ? ccppId(clave) : "";
        if (id === ccpp_id) { obra = o; break; }
      }
      if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

      // 2) Calcular nombre de carpeta Drive (igual que hace Guille en presupuestos.cjs)
      const carpetaNombre = `${obra.tipo_via || ""} ${obra.direccion || ""}`.trim();
      if (!carpetaNombre) {
        return res.json({ ok: true, version: "0.24.0", carpeta_existe: false, archivos: [], categorias: {}, total: 0 });
      }

      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) {
        return res.json({
          ok: true, version: "0.24.0",
          error_config: "Falta DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES en Render",
          archivos: [], categorias: {}, total: 0,
        });
      }

      // 3) Buscar la carpeta de la comunidad (sin crear si no existe)
      const drive = getDriveClient();
      const nombreSafe = carpetaNombre.replace(/'/g, "\\'");
      const busq = await drive.files.list({
        q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1,
      });
      if (!busq.data.files || busq.data.files.length === 0) {
        return res.json({
          ok: true, version: "0.24.0",
          comunidad: obra.comunidad,
          carpeta_nombre: carpetaNombre,
          carpeta_existe: false,
          archivos: [], categorias: {}, total: 0,
        });
      }
      const carpetaId = busq.data.files[0].id;
      const carpetaUrl = `https://drive.google.com/drive/folders/${carpetaId}`;

      // 4) Listar recursivamente y categorizar
      const archivos = await listarDriveRecursivo(drive, carpetaId);
      const categorias = {};
      for (const a of archivos) {
        const cat = categorizarArchivo(a.name, a.mime);
        const k = cat.key;
        if (!categorias[k]) {
          categorias[k] = { emoji: cat.emoji, label: cat.label, archivos: [] };
        }
        categorias[k].archivos.push({ ...a, categoria: k });
      }
      // Ordenar archivos dentro de cada categoría: más reciente primero
      for (const k of Object.keys(categorias)) {
        categorias[k].archivos.sort((a, b) =>
          String(b.modified || "").localeCompare(String(a.modified || ""))
        );
      }

      res.json({
        ok: true,
        version: "0.24.0",
        comunidad: obra.comunidad,
        carpeta_nombre: carpetaNombre,
        carpeta_id: carpetaId,
        carpeta_url: carpetaUrl,
        carpeta_existe: true,
        total: archivos.length,
        categorias,
      });
    } catch (err) {
      console.error("[panel-obras/adjuntos]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

};