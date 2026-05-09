// ============================================================
// ARA OS — Módulo de datos para el hub operativo
//
// Patrón idéntico a ara-catalogo.cjs y presupuestos.cjs:
//   require("./ara-os.cjs")(app);
//
// Expone bajo /api/ara-os/* los datos que ARA OS necesita
// para mostrar información real sin tocar ninguna lógica
// existente. Solo lee. No escribe nada.
//
// Endpoints:
//   GET /api/ara-os/obras   → obras + KPIs + alertas
//   GET /api/ara-os/health  → diagnóstico rápido
//
// Autenticación: token de query igual al resto del panel.
//   ?token=araujo2026
//
// Datos que devuelve /api/ara-os/obras:
//   {
//     obras:    [ { id, comunidad, tipo, estado, responsable,
//                  margen, accion, alertas } ],
//     kpis:     [ { label, valor, tono } ],
//     alertas:  [ { id, prio, cuando, texto, obra } ],
//     meta:     { generado, total_obras, fuente }
//   }
//
// Modelo de estado (mapeo desde datos reales):
//   paso_actual "recogida_documentacion" o similar → "ejecucion"
//   requiere_intervencion_humana "si"               → "parada"
//   documentos_completos "SI"                       → "terminada"
//   estado_expediente "cobro" o similar             → "cobro"
//   paso_actual ""  / sin registro                  → "presupuesto"
//   alerta_plazo activa                             → estado "lista"
//
// Nota: Los campos "tipo", "responsable", "margen" y "accion"
// no existen aún en Sheets. Se devuelven como valores por
// defecto hasta que se añadan columnas reales. Ver TODO al final.
// ============================================================

module.exports = function setupAraOS(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  // ----------------------------------------------------------
  // Helpers de autenticación
  // ----------------------------------------------------------
  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    // ARA OS corre en un dominio diferente (Render/Netlify),
    // necesita CORS para llamadas fetch() desde el navegador.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // ----------------------------------------------------------
  // Helpers de Sheets (reutilizamos las funciones del proceso
  // principal que ya están definidas en index.cjs: getSheetsClient,
  // etc. No podemos importarlas porque index.cjs no exporta nada,
  // pero sí podemos usar el mismo patrón con googleapis).
  // ----------------------------------------------------------
  const { google } = require("googleapis");

  function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
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
  // Mapeo de estado real → modelo ARA OS
  // ----------------------------------------------------------

  // Los pasos activos de recogida de documentación
  const PASOS_EJECUCION = [
    "recogida_documentacion",
    "recogida_financiacion",
    "pregunta_financiacion",
    "visita_emasesa",
    "pte_cycp",
    "cycp",
  ];

  // Los estados de cobro (cuando la obra está terminada pero sin cobrar)
  const PASOS_COBRO = ["cobro", "cobro_pendiente", "pte_cobro"];

  function mapearEstado(exp) {
    if (!exp.paso_actual && !exp.estado_expediente) return "presupuesto";
    if (exp.requiere_intervencion_humana === "si") return "parada";
    if (exp.documentos_completos === "SI") {
      if (PASOS_COBRO.includes((exp.estado_expediente || "").toLowerCase())) return "cobro";
      return "terminada";
    }
    if (PASOS_EJECUCION.includes(exp.paso_actual)) return "ejecucion";
    if (exp.alerta_plazo && exp.alerta_plazo.toLowerCase() === "si") return "lista";
    return "presupuesto";
  }

  // Prioridad de alerta: ¿tiene problemas este expediente?
  function prioridadAlerta(exp) {
    if (exp.requiere_intervencion_humana === "si") return "risk";
    if (exp.estado_expediente === "repetir" || exp.ultimo_documento_fallido) return "warn";
    if (exp.alerta_plazo === "si") return "warn";
    return null; // sin alerta
  }

  // Texto de acción siguiente (con lo que hay en Sheets)
  function accionSiguiente(exp) {
    if (exp.requiere_intervencion_humana === "si") return "Intervención urgente";
    if (exp.motivo_bloqueo_actual) return exp.motivo_bloqueo_actual.slice(0, 60);
    if (exp.documento_actual) return "Esperando: " + exp.documento_actual;
    if (exp.documentos_completos === "SI") return "Cerrar y archivar";
    if (!exp.paso_actual) return "Enviar presupuesto";
    return exp.paso_actual.replace(/_/g, " ");
  }

  // ----------------------------------------------------------
  // Lectura y transformación de datos
  // ----------------------------------------------------------
  async function obtenerDatosAraOS() {
    // 1. Leer comunidades (fuente de las obras)
    const rowsCom = await leerHoja("comunidades!A:F");
    // Columnas: A=comunidad, B=direccion, C=presidente, D=telefono_presidente,
    //           E=email_presidente, F=estado_comunidad
    const comunidadesMap = {};
    for (let i = 1; i < rowsCom.length; i++) {
      const row = rowsCom[i];
      const nombre = (row[0] || "").trim();
      if (!nombre) continue;
      comunidadesMap[nombre] = {
        nombre,
        direccion: row[1] || nombre,
        estado_comunidad: row[5] || "",
      };
    }

    // 2. Leer expedientes (estado operativo de cada comunidad)
    const rowsExp = await leerHoja("expedientes!A:Y");
    // Agrupar expedientes por comunidad (uno por comunidad, el más reciente)
    const expPorComunidad = {};
    for (let i = 1; i < rowsExp.length; i++) {
      const row = rowsExp[i];
      if (!row[0]) continue; // sin teléfono
      const com = (row[1] || "").trim();
      if (!com) continue;
      // Guardamos el que tenga paso_actual más avanzado, o simplemente el último
      const exp = {
        telefono:                        row[0]  || "",
        comunidad:                       row[1]  || "",
        vivienda:                        row[2]  || "",
        nombre:                          row[3]  || "",
        tipo_expediente:                 row[4]  || "",
        paso_actual:                     row[5]  || "",
        documento_actual:                row[6]  || "",
        estado_expediente:               row[7]  || "",
        fecha_inicio:                    row[8]  || "",
        documentos_completos:            row[13] || "",
        alerta_plazo:                    row[14] || "",
        documentos_pendientes:           row[16] || "",
        ultimo_documento_fallido:        row[18] || "",
        motivo_bloqueo_actual:           row[21] || "",
        requiere_intervencion_humana:    row[23] || "no",
      };
      // Nos quedamos con el expediente más activo de cada comunidad
      const prev = expPorComunidad[com];
      if (!prev || PASOS_EJECUCION.includes(exp.paso_actual)) {
        expPorComunidad[com] = exp;
      }
    }

    // 3. Construir la lista de obras para ARA OS
    const obras = [];
    let contadorAlertas = 0;
    const alertas = [];

    // Fuente primaria: comunidades del Sheet
    const comunidades = Object.values(comunidadesMap);
    if (comunidades.length === 0) {
      // Fallback: usar expedientes aunque no haya pestaña comunidades bien formada
      Object.values(expPorComunidad).forEach((exp, idx) => {
        const estado = mapearEstado(exp);
        const prio = prioridadAlerta(exp);
        const id = "O-" + String(idx + 1).padStart(3, "0");

        if (prio) {
          contadorAlertas++;
          alertas.push({
            id:     contadorAlertas,
            prio,
            cuando: prio === "risk" ? "hoy" : "+2 días",
            texto:  exp.comunidad + " · " + accionSiguiente(exp),
            obra:   id,
          });
        }

        obras.push({
          id,
          comunidad:   exp.comunidad,
          tipo:        exp.tipo_expediente || "—",
          estado,
          responsable: "—",   // TODO: añadir columna en Sheets
          margen:      null,   // TODO: añadir columna en Sheets
          accion:      accionSiguiente(exp),
          alertas:     prio ? 1 : 0,
        });
      });
    } else {
      comunidades.forEach((com, idx) => {
        const exp = expPorComunidad[com.nombre] || null;
        const estado = exp ? mapearEstado(exp) : "presupuesto";
        const prio = exp ? prioridadAlerta(exp) : null;
        const id = "O-" + String(idx + 1).padStart(3, "0");

        if (prio) {
          contadorAlertas++;
          alertas.push({
            id:     contadorAlertas,
            prio,
            cuando: prio === "risk" ? "hoy" : "+2 días",
            texto:  com.nombre + " · " + (exp ? accionSiguiente(exp) : "Sin expediente"),
            obra:   id,
          });
        }

        obras.push({
          id,
          comunidad:   com.nombre,
          tipo:        exp ? (exp.tipo_expediente || "—") : "—",
          estado,
          responsable: "—",   // TODO: añadir columna responsable en Sheets
          margen:      null,   // TODO: añadir columna margen en Sheets
          accion:      exp ? accionSiguiente(exp) : "Sin expediente activo",
          alertas:     prio ? 1 : 0,
        });
      });
    }

    // 4. Calcular KPIs reales
    const obrasActivas  = obras.filter(o => o.estado === "ejecucion").length;
    const obrasPendCobro = obras.filter(o => o.estado === "cobro").length;
    const obrasParadas  = obras.filter(o => o.estado === "parada").length;
    const alertasCrit   = alertas.filter(a => a.prio === "risk").length;

    const kpis = [
      { label: "Obras activas",      valor: String(obrasActivas),    tono: "ok"   },
      { label: "Pendiente cobro",    valor: String(obrasPendCobro),  tono: "warn" },
      { label: "Paradas / bloqueadas", valor: String(obrasParadas),  tono: obrasParadas > 0 ? "risk" : "ink" },
      { label: "Alertas críticas",   valor: String(alertasCrit),     tono: alertasCrit > 0 ? "risk" : "ink" },
      // Caja y margen vendrán de Holded (fase 2)
      { label: "Caja",               valor: "—",                     tono: "ink"  },
      { label: "Margen mes",         valor: "—",                     tono: "ink"  },
    ];

    return { obras, kpis, alertas };
  }

  // ----------------------------------------------------------
  // Preflight CORS
  // ----------------------------------------------------------
  app.options("/api/ara-os/*", (req, res) => {
    responderCORS(res);
    res.status(204).end();
  });

  // ----------------------------------------------------------
  // GET /api/ara-os/health
  // Diagnóstico rápido: confirma que el módulo está activo y
  // que las variables de entorno necesarias están presentes.
  // No requiere token (útil para Render health checks).
  // ----------------------------------------------------------
  app.get("/api/ara-os/health", (req, res) => {
    responderCORS(res);
    res.json({
      ok: true,
      modulo: "ara-os",
      version: "0.1.0",
      sheets_id_presente: !!process.env.GOOGLE_SHEETS_ID,
      google_auth_presente: !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // ----------------------------------------------------------
  // GET /api/ara-os/obras
  // Devuelve obras, KPIs y alertas desde Sheets.
  // Requiere ?token=<ADMIN_TOKEN>
  // ----------------------------------------------------------
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
          fuente:      "Google Sheets · comunidades + expedientes",
          version:     "0.1.0",
          // Campos pendientes de Sheets para completar el modelo:
          // - responsable (columna nueva en comunidades)
          // - margen (columna nueva en comunidades)
          // Integración futura:
          // - kpis.caja y kpis.margen_mes vendrán de Holded API
        },
      });
    } catch (err) {
      console.error("[ara-os] Error leyendo datos:", err.message);
      res.status(500).json({
        error:   "Error leyendo datos de Sheets",
        detalle: err.message,
      });
    }
  });

  console.log("[ara-os] Módulo registrado · /api/ara-os/obras · /api/ara-os/health");
};

// ============================================================
// INSTRUCCIONES DE INSTALACIÓN
// ============================================================
//
// 1. Copiar este archivo a la raíz de araujo-bot como ara-os.cjs
//
// 2. En index.cjs, añadir junto al resto de módulos:
//
//    // ---- ARA OS hub ----
//    require("./ara-os.cjs")(app);
//
//    Sugerencia: justo después de la línea que carga ara-catalogo:
//    require("./ara-catalogo.cjs")(app);
//    require("./ara-os.cjs")(app);          // ← añadir aquí
//
// 3. No necesita dependencias nuevas (usa googleapis que ya está).
//    No necesita variables de entorno nuevas (usa GOOGLE_SHEETS_ID,
//    GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, ADMIN_TOKEN que ya
//    están definidas en .env y en Render).
//
// 4. Verificar en producción:
//    GET https://araujo-bot.onrender.com/api/ara-os/health
//    GET https://araujo-bot.onrender.com/api/ara-os/obras?token=araujo2026
//
// ============================================================
// TODO — PRÓXIMOS PASOS PARA COMPLETAR EL MODELO DE OBRA
// ============================================================
//
// Fase 1 (este archivo): datos reales de comunidades y estados.
//   ✓ estado operativo de cada obra
//   ✓ acción siguiente
//   ✓ alertas críticas
//   ✓ KPIs de conteo
//
// Fase 2 — Columnas nuevas en Sheets (no rompen nada existente):
//   Añadir en pestaña "comunidades":
//   - columna BC: responsable (Manuel R. / Juan A. / Alberto)
//   - columna BD: tipo_obra (plan5 / bajantes / reforma / etc.)
//   - columna BE: margen_porcentaje (número, puede estar vacío)
//   Una vez añadidas, cambiar en este archivo:
//     responsable: row[?] || "—"   (BC = índice 54)
//     tipo:        row[?] || "—"   (BD = índice 55)
//     margen:      parseFloat(row[?]) || null  (BE = índice 56)
//
// Fase 3 — Integración Holded:
//   Añadir endpoint /api/ara-os/kpis-financieros que llame a
//   la API de Holded para devolver caja real y margen del mes.
//   ARA OS puede mostrar esos KPIs en cuanto estén disponibles.
// ============================================================
