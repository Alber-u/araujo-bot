// ============================================================
// ARA OS — Fase 14 FINALIZADA · Modal facturar en Holded
// v0.1.0 — Sprint 14/05/2026
//
// require("./ara-os-fase14-holded.cjs")(app);
//
// Endpoints:
//   GET  /api/ara-os/fase14/datos-factura?token=...&ccpp_id=...
//   POST /api/ara-os/fase14/guardar-datos-factura
//   POST /api/ara-os/fase14/marcar-emitida
//   POST /api/ara-os/fase14/marcar-firmada
//
// Lo que hace:
//   - Recoge datos prerellenados de comunidades + ordenes_trabajo
//     para que JM monte la factura en Holded con copy-paste.
//   - Persiste datos manuales (suministro, NIF, CIF, importes,
//     nº pto, nº factura Holded, fechas) en columnas nuevas
//     AB-AJ de ordenes_trabajo.
//   - Marca `factura_emitida = "OK"` cuando JM confirma
//     emisión en Holded.
//   - Registra fecha de firma del presidente (conforme).
//
// Lo que NO toca (zona de Guillermo, READ-ONLY):
//   - comunidades, pisos, bloqueos_operativos
//   - presupuestos.cjs, documentacion.cjs
//
// Columnas nuevas en ordenes_trabajo (extensión OT_COLS):
//   AB · numero_pto
//   AC · cif_comunidad
//   AD · nif_presidente
//   AE · num_suministro_emasesa
//   AF · importe_cliente
//   AG · importe_subvencion_emasesa
//   AH · numero_factura_holded
//   AI · fecha_factura_emitida
//   AJ · fecha_firma_presidente
// ============================================================

module.exports = function setupAraOSFase14Holded(app) {

  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) {
    return validToken(req.query.token);
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  const { google } = require("googleapis");
  const crypto = require("crypto");
  const express = require("express");
  const multer = require("multer");
  const { Readable } = require("stream");
  const jsonBodyParser = express.json({ limit: "1mb" });

  // Multer en memoria — el PDF se sube a Drive directamente sin tocar disco.
  // Límite 10 MB (un PDF firmado típicamente <2 MB; margen generoso).
  const uploadPDF = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = file.mimetype === "application/pdf" ||
                 file.originalname?.toLowerCase().endsWith(".pdf");
      if (!ok) return cb(new Error("Solo se admiten archivos PDF"));
      cb(null, true);
    },
  });

  function getAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }

  function getSheetsClient() {
    return google.sheets({ version: "v4", auth: getAuth() });
  }

  function getDriveClient() {
    return google.drive({ version: "v3", auth: getAuth() });
  }

  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return res.data.values || [];
  }

  async function leerHojaSafe(rango) {
    try { return await leerHoja(rango); }
    catch (err) { console.warn("[fase14] leerHoja " + rango + ":", err.message); return []; }
  }

  // ------------------------------------------------------------
  // Modelo `comunidades` (SOLO LECTURA · réplica de panel-obras)
  // ------------------------------------------------------------
  const COLS_COM = [
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
    "motivo_rechazo","motivo_pipeline","fase_jm"
  ];

  function rowToObjCom(row) {
    const o = {};
    for (let i = 0; i < COLS_COM.length; i++) o[COLS_COM[i]] = row[i] || "";
    return o;
  }

  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // ------------------------------------------------------------
  // Modelo `ordenes_trabajo` extendido — fase 14 Holded
  // ------------------------------------------------------------
  // Mantenemos los índices originales (0..26 = A..AA) y añadimos
  // 27..35 (AB..AJ) para los campos de factura/firma.
  const OT_COLS = {
    comunidad: 0, fase_ot: 1,
    factura_emitida: 18, certificados_entregados: 19,
    ultima_modificacion: 9, ultimo_modificador: 10,
    // Extensiones v0.18 — Fase 14 Holded
    numero_pto:                 27, // AB
    cif_comunidad:              28, // AC
    nif_presidente:             29, // AD
    num_suministro_emasesa:     30, // AE
    importe_cliente:            31, // AF
    importe_subvencion_emasesa: 32, // AG
    numero_factura_holded:      33, // AH
    fecha_factura_emitida:      34, // AI
    fecha_firma_presidente:     35, // AJ
    // Extensión v0.19 — Fase 14 PDF firmado en Drive
    url_pdf_firmado:            36, // AK
  };

  // A=0 ... AK=36
  const OT_LETRA = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S",
    "T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK"
  ];

  // Campos editables manualmente vía guardar-datos-factura
  const CAMPOS_EDITABLES_FACTURA = new Set([
    "numero_pto",
    "cif_comunidad",
    "nif_presidente",
    "num_suministro_emasesa",
    "importe_cliente",
    "importe_subvencion_emasesa",
  ]);

  async function localizarFilaOT(comunidad) {
    const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AK");
    for (let i = 0; i < rowsOT.length; i++) {
      if (String(rowsOT[i][0] || "").trim() === comunidad) {
        return { rowIndex: i + 2, row: rowsOT[i] };
      }
    }
    return { rowIndex: -1, row: null };
  }

  async function resolverComunidadPorCcpp(ccpp_id) {
    const rowsCom = await leerHoja("comunidades!A2:BD");
    for (const row of rowsCom) {
      if (!row[0]) continue;
      const o = rowToObjCom(row);
      const clave = o.direccion || o.comunidad || "";
      if (clave && ccppId(clave) === ccpp_id) return o;
    }
    return null;
  }

  // ============================================================
  // GET /api/ara-os/fase14/datos-factura
  // Body: ?token=...&ccpp_id=ccpp_xxx
  //
  // Devuelve: { comunidad_data, ot_data, factura_prefill }
  //   - comunidad_data: nombre, direccion, presidente, fecha_aceptacion_pto, pto_total
  //   - ot_data: lo guardado en columnas AB-AJ (vacío si nunca se ha rellenado)
  //   - factura_prefill: concepto generado, fecha actual, etc.
  // ============================================================
  app.options("/api/ara-os/fase14/datos-factura", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/fase14/datos-factura", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const obraCom = await resolverComunidadPorCcpp(ccpp_id);
      if (!obraCom) return res.status(404).json({ error: "Obra no encontrada en comunidades" });

      const { rowIndex, row } = await localizarFilaOT(obraCom.comunidad.trim());
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa para esta obra" });

      const ot_data = {
        numero_pto:                 row[OT_COLS.numero_pto] || "",
        cif_comunidad:              row[OT_COLS.cif_comunidad] || "",
        nif_presidente:             row[OT_COLS.nif_presidente] || "",
        num_suministro_emasesa:     row[OT_COLS.num_suministro_emasesa] || "",
        importe_cliente:            row[OT_COLS.importe_cliente] || "",
        importe_subvencion_emasesa: row[OT_COLS.importe_subvencion_emasesa] || "",
        numero_factura_holded:      row[OT_COLS.numero_factura_holded] || "",
        fecha_factura_emitida:      row[OT_COLS.fecha_factura_emitida] || "",
        fecha_firma_presidente:     row[OT_COLS.fecha_firma_presidente] || "",
        url_pdf_firmado:            row[OT_COLS.url_pdf_firmado] || "",
        factura_emitida:            row[OT_COLS.factura_emitida] || "",
      };

      const comunidad_data = {
        comunidad:             obraCom.comunidad,
        direccion:             obraCom.direccion,
        presidente:            obraCom.presidente,
        fecha_aceptacion_pto:  obraCom.fecha_aceptacion_pto,
        pto_total:             obraCom.pto_total,
      };

      // Concepto por defecto replicando F260018
      const fechaAcept = obraCom.fecha_aceptacion_pto || "[FECHA ACEPTACIÓN]";
      const direccionConcepto = obraCom.direccion || obraCom.comunidad || "[DIRECCIÓN]";
      const numPto = ot_data.numero_pto || "[Nº PRESUPUESTO]";
      const suministro = ot_data.num_suministro_emasesa || "[Nº SUMINISTRO]";

      const concepto_factura =
        "FACTURA CORRESPONDIENTE A LOS TRABAJOS DE INSTALACIÓN DE BATERÍA DE " +
        "CONTADORES INDIVIDUALES EN LA FINCA SITA EN " + direccionConcepto + " CONFORME A " +
        "PRESUPUESTO Nº" + numPto + " ACEPTADO POR EL CLIENTE CON FECHA " + fechaAcept +
        " SUMINISTRO (" + suministro + ")";

      res.json({
        ok: true,
        version: "0.18.0",
        ccpp_id,
        comunidad_data,
        ot_data,
        factura_prefill: {
          concepto: concepto_factura,
          fecha_hoy: new Date().toISOString().slice(0, 10),
          holded_url: "https://app.holded.com/doc/invoice/new",
        },
      });
    } catch (err) {
      console.error("[fase14/datos-factura]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/fase14/guardar-datos-factura
  // Body: { ccpp_id, campo, valor }
  //   campo ∈ CAMPOS_EDITABLES_FACTURA
  // ============================================================
  app.options("/api/ara-os/fase14/guardar-datos-factura", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/guardar-datos-factura", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id, campo, valor } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!campo)   return res.status(400).json({ error: "Falta campo" });
      if (!CAMPOS_EDITABLES_FACTURA.has(campo)) {
        return res.status(400).json({ error: "Campo no editable: " + campo });
      }

      const obraCom = await resolverComunidadPorCcpp(ccpp_id);
      if (!obraCom) return res.status(404).json({ error: "Obra no encontrada" });

      const comunidad = obraCom.comunidad.trim();
      const { rowIndex } = await localizarFilaOT(comunidad);
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa" });

      const sheets = getSheetsClient();
      const letra = OT_LETRA[OT_COLS[campo]];
      const ahora = new Date().toISOString();

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${letra}${rowIndex}`, values: [[String(valor || "")]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`, values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,  values: [["ARA OS · JM · fase14"]] },
          ],
        },
      });

      res.json({ ok: true, version: "0.18.0", comunidad, campo, valor: String(valor || ""), actualizado_en: ahora });
    } catch (err) {
      console.error("[fase14/guardar-datos-factura]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/fase14/marcar-emitida
  // Body: { ccpp_id, numero_factura_holded }
  //
  // Marca factura_emitida=OK, guarda nº Holded y fecha emisión.
  // ============================================================
  app.options("/api/ara-os/fase14/marcar-emitida", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/marcar-emitida", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id, numero_factura_holded } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      const numFactura = String(numero_factura_holded || "").trim();
      if (!numFactura) return res.status(400).json({ error: "Falta numero_factura_holded" });

      const obraCom = await resolverComunidadPorCcpp(ccpp_id);
      if (!obraCom) return res.status(404).json({ error: "Obra no encontrada" });

      const comunidad = obraCom.comunidad.trim();
      const { rowIndex } = await localizarFilaOT(comunidad);
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa" });

      const ahora = new Date().toISOString();
      const sheets = getSheetsClient();

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.factura_emitida]}${rowIndex}`,        values: [["OK"]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.numero_factura_holded]}${rowIndex}`,  values: [[numFactura]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.fecha_factura_emitida]}${rowIndex}`,  values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`,    values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,     values: [["ARA OS · JM · fase14"]] },
          ],
        },
      });

      // Loggear evento en actividad_sistema (fire-and-forget)
      require("./ara-os-actividad.cjs").logActividad({
        actor: req.body?.actor || "José Manuel",
        tipo: "factura_emitida",
        comunidad,
        ccpp_id,
        detalle: `Factura ${numFactura} marcada como emitida`,
        payload: { numero_factura_holded: numFactura },
      });

      res.json({ ok: true, version: "0.18.0", comunidad, numero_factura_holded: numFactura, fecha_factura_emitida: ahora });
    } catch (err) {
      console.error("[fase14/marcar-emitida]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/fase14/marcar-firmada
  // Body: { ccpp_id, fecha_firma? }
  //
  // Registra firma conforme del presidente. Si no se manda fecha,
  // usa hoy. Solo se permite si factura_emitida === "OK".
  // ============================================================
  app.options("/api/ara-os/fase14/marcar-firmada", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/marcar-firmada", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const { ccpp_id, fecha_firma } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const obraCom = await resolverComunidadPorCcpp(ccpp_id);
      if (!obraCom) return res.status(404).json({ error: "Obra no encontrada" });

      const comunidad = obraCom.comunidad.trim();
      const { rowIndex, row } = await localizarFilaOT(comunidad);
      if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa" });

      if (String(row[OT_COLS.factura_emitida] || "").toUpperCase() !== "OK") {
        return res.status(409).json({ error: "Marca primero la factura como emitida" });
      }

      const fecha = (fecha_firma && String(fecha_firma).trim()) || new Date().toISOString().slice(0, 10);
      const ahora = new Date().toISOString();
      const sheets = getSheetsClient();

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.fecha_firma_presidente]}${rowIndex}`, values: [[fecha]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`,    values: [[ahora]] },
            { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,     values: [["ARA OS · JM · fase14"]] },
          ],
        },
      });

      // Loggear evento en actividad_sistema (fire-and-forget)
      require("./ara-os-actividad.cjs").logActividad({
        actor: req.body?.actor || "José Manuel",
        tipo: "factura_firmada",
        comunidad,
        ccpp_id,
        detalle: `Conforme firmado por presidente · fecha ${fecha}`,
        payload: { fecha_firma: fecha },
      });

      res.json({ ok: true, version: "0.18.0", comunidad, fecha_firma_presidente: fecha });
    } catch (err) {
      console.error("[fase14/marcar-firmada]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // POST /api/ara-os/fase14/subir-pdf-firmado
  // v0.19.0 — Sube el PDF firmado del CONFORME a Google Drive.
  //
  // Estructura:
  //   - Carpeta raíz (env DRIVE_FOLDER_FASE14_FIRMADAS)
  //     └── Subcarpeta por comunidad (se crea si no existe)
  //         └── F260018_firmada_2026-05-14.pdf
  //
  // Form-data: ccpp_id, file
  // Devuelve: { url_pdf_firmado, filename }
  //
  // Persiste:
  //   - url_pdf_firmado en columna AK de ordenes_trabajo
  //   - actualiza ultima_modificacion / modificador
  //
  // NO marca fecha_firma_presidente — eso lo hace el botón "Marcar firmada"
  // del frontend (puede haberse marcado antes de subir el PDF).
  // ============================================================
  app.options("/api/ara-os/fase14/subir-pdf-firmado", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/subir-pdf-firmado",
    uploadPDF.single("file"),
    async (req, res) => {
      responderCORS(res);
      if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

      try {
        const carpetaRaizId = process.env.DRIVE_FOLDER_FASE14_FIRMADAS;
        if (!carpetaRaizId) {
          return res.status(500).json({
            error: "Falta configurar DRIVE_FOLDER_FASE14_FIRMADAS en el entorno"
          });
        }

        const { ccpp_id } = req.body;
        if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
        if (!req.file) return res.status(400).json({ error: "Falta archivo (campo 'file')" });

        const obraCom = await resolverComunidadPorCcpp(ccpp_id);
        if (!obraCom) return res.status(404).json({ error: "Obra no encontrada" });

        const comunidad = obraCom.comunidad.trim();
        const { rowIndex, row } = await localizarFilaOT(comunidad);
        if (rowIndex < 0) return res.status(404).json({ error: "No hay OT activa" });

        const numFactura = String(row[OT_COLS.numero_factura_holded] || "").trim();
        const drive = getDriveClient();

        // 1) Buscar/crear subcarpeta por comunidad
        const nombreSubcarpeta = comunidad.replace(/'/g, "\\'");
        const busqCarp = await drive.files.list({
          q: `name='${nombreSubcarpeta}' and '${carpetaRaizId}' in parents and ` +
             `mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id,name)",
          pageSize: 1,
        });
        let subcarpetaId;
        if (busqCarp.data.files && busqCarp.data.files.length > 0) {
          subcarpetaId = busqCarp.data.files[0].id;
        } else {
          const creada = await drive.files.create({
            requestBody: {
              name: comunidad,
              mimeType: "application/vnd.google-apps.folder",
              parents: [carpetaRaizId],
            },
            fields: "id",
          });
          subcarpetaId = creada.data.id;
          console.log(`[fase14/upload] Subcarpeta creada: "${comunidad}" (id=${subcarpetaId})`);
        }

        // 2) Nombrar el archivo: F260018_firmada_2026-05-14.pdf
        //    Si no hay nº factura aún, usar timestamp.
        const fechaISO = new Date().toISOString().slice(0, 10);
        const baseNombre = numFactura
          ? `${numFactura}_firmada_${fechaISO}.pdf`
          : `firmada_${fechaISO}_${Date.now()}.pdf`;

        // 3) Subir el PDF
        const archivoSubido = await drive.files.create({
          requestBody: {
            name: baseNombre,
            parents: [subcarpetaId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(req.file.buffer),
          },
          fields: "id, name, webViewLink",
        });

        const url = archivoSubido.data.webViewLink;
        const filename = archivoSubido.data.name;

        // 4) Persistir en ordenes_trabajo
        const ahora = new Date().toISOString();
        const sheets = getSheetsClient();
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.url_pdf_firmado]}${rowIndex}`,    values: [[url]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultima_modificacion]}${rowIndex}`, values: [[ahora]] },
              { range: `ordenes_trabajo!${OT_LETRA[OT_COLS.ultimo_modificador]}${rowIndex}`,  values: [["ARA OS · JM · fase14"]] },
            ],
          },
        });

        console.log(`[fase14/upload] PDF subido: ${filename} → ${url}`);

        // Loggear evento en actividad_sistema (fire-and-forget)
        require("./ara-os-actividad.cjs").logActividad({
          actor: req.body?.actor || "José Manuel",
          tipo: "factura_firmada_pdf",
          comunidad,
          ccpp_id,
          detalle: `PDF firmado subido: ${filename}`,
          payload: { url, filename },
        });

        res.json({
          ok: true,
          version: "0.19.0",
          comunidad,
          filename,
          url_pdf_firmado: url,
        });
      } catch (err) {
        console.error("[fase14/subir-pdf-firmado]", err);
        // Detectar errores comunes y devolver mensajes útiles
        const msg = String(err.message || "");
        if (/insufficient.*permissions|invalid_scope|scope/i.test(msg)) {
          return res.status(500).json({
            error: "El backend no tiene permisos de Google Drive. Contacta con Alberto.",
            debug: msg,
          });
        }
        if (/file not found|404/i.test(msg)) {
          return res.status(500).json({
            error: "La carpeta de Drive configurada no existe o no es accesible.",
            debug: msg,
          });
        }
        res.status(500).json({ error: msg });
      }
    }
  );

  // ------------------------------------------------------------
  // POST /api/ara-os/fase14/migrar-columnas
  // ------------------------------------------------------------
  // Asegura que la hoja `ordenes_trabajo` tenga al menos
  // OT_LETRA.length columnas (AK = 37). Si la hoja se quedó
  // corta (típico cuando se creó con menos columnas y el código
  // intenta escribir en AH/AI/AJ/AK), añade las que falten y
  // escribe las cabeceras nuevas.
  //
  // Causa típica del bug: la hoja sólo tenía hasta Z (26 cols)
  // y `marcar-emitida` falla con:
  //   "Range (ordenes_trabajo!AH17) exceeds grid limits"
  app.options("/api/ara-os/fase14/migrar-columnas", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/migrar-columnas", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "token" });
    try {
      const sheets = getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

      // 1 · Localizar la pestaña y leer su tamaño actual.
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(sheetId,title,gridProperties))",
      });
      const hoja = meta.data.sheets.find(s => s.properties.title === "ordenes_trabajo");
      if (!hoja) return res.status(404).json({ error: "Pestaña ordenes_trabajo no encontrada" });

      const sheetId    = hoja.properties.sheetId;
      const colsActual = hoja.properties.gridProperties.columnCount || 0;
      const colsObjetivo = OT_LETRA.length; // 37 (A..AK)

      if (colsActual >= colsObjetivo) {
        return res.json({
          ok: true,
          ya_migrada: true,
          columnas_actuales: colsActual,
          columnas_objetivo: colsObjetivo,
        });
      }

      const aAnadir = colsObjetivo - colsActual;

      // 2 · Ampliar la rejilla con appendDimension.
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            appendDimension: {
              sheetId,
              dimension: "COLUMNS",
              length: aAnadir,
            },
          }],
        },
      });

      // 3 · Cabeceras nuevas (sólo para las columnas que acabamos
      //     de crear — no tocamos las que ya existían).
      const cabecerasFase14 = {
        27: "numero_pto",
        28: "cif_comunidad",
        29: "nif_presidente",
        30: "num_suministro_emasesa",
        31: "importe_cliente",
        32: "importe_subvencion_emasesa",
        33: "numero_factura_holded",
        34: "fecha_factura_emitida",
        35: "fecha_firma_presidente",
        36: "url_pdf_firmado",
      };
      const data = [];
      for (let idx = colsActual; idx < colsObjetivo; idx++) {
        const valor = cabecerasFase14[idx];
        if (!valor) continue;
        data.push({
          range: `ordenes_trabajo!${OT_LETRA[idx]}1`,
          values: [[valor]],
        });
      }
      if (data.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: "RAW", data },
        });
      }

      res.json({
        ok: true,
        columnas_anteriores: colsActual,
        columnas_actuales: colsObjetivo,
        cabeceras_escritas: data.map(d => d.range),
      });
    } catch (e) {
      console.error("[fase14/migrar-columnas]", e);
      res.status(500).json({ error: e.message });
    }
  });

};
