// ===================================================================
// MÓDULO DOCUMENTACIÓN — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Documentación (CCPP) al index.cjs.
// Toma el relevo cuando un CCPP termina la fase 04_SEGUIMIENTO de
// presupuestos y se acepta. A partir de 05_DOCUMENTACION en adelante
// (06_VISITA_EMASESA, 07_CONTRATOS_PAGOS) este módulo es el que manda.
//
// IMPORTANTE — pantalla principal:
//  - La pantalla principal de TODA la app es /presupuestos. No hay
//    /documentacion (listado): ese listado vive en /presupuestos con
//    sus filtros 05/06/07.
//  - Documentación SÓLO ofrece la ficha individual:
//        GET /documentacion/expediente?id=...
//  - La ficha reusa `vistaFicha` de presupuestos.cjs (vía app.locals)
//    y le añade la cajita de vecinos al final. Cuando el CCPP está en
//    fase 05/06/07, vistaFicha deja la barra de acciones vacía
//    (pendiente de definir qué irá ahí).
//
// Lee/escribe en las pestañas:
//  - "comunidades"    (mismo Sheet que presupuestos)
//  - "vecinos_base"   (listado maestro de vecinos por dirección)
//  - "expedientes"    (cabecera del expediente WhatsApp por vecino,
//                      hoy gestionada por index.cjs en escritura;
//                      este módulo solo LEE de momento)
//
// Uso desde index.cjs:
//   require("./documentacion.cjs")(app);
//   (debe registrarse DESPUÉS de presupuestos.cjs, porque depende de
//    app.locals.presupuestos)
//
// Variables de entorno: las mismas que presupuestos.cjs.
// ===================================================================

const { google } = require("googleapis");
const stream = require("stream");
const express = require("express");

// Multer: opcional. Si no está instalado, los endpoints de subida de
// archivos devolverán 501 con instrucciones. El resto del módulo
// (cajita de vecinos, alta, edición de tipo) sigue funcionando.
let multer = null;
let upload = null;
try {
  multer = require("multer");
  upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
} catch (e) {
  console.warn("[documentacion] multer no instalado — la subida de archivos quedará deshabilitada hasta `npm install multer`");
}

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN
  // =================================================================
  function getGoogleAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }
  function getDriveClient()  { return google.drive({ version: "v3", auth: getGoogleAuth() }); }

  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const DRIVE_FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const RANGO_VECINOS_BASE = "vecinos_base!A:F";
  const RANGO_EXPEDIENTES = "expedientes!A:Y";
  const RANGO_DOCUMENTOS = "documentos!A:L";

  // =================================================================
  // FLOWS (copiado de index.cjs — DEBE coincidir exactamente con el
  // bot, para que un vecino metido a mano sea indistinguible de uno
  // gestionado por el bot)
  // =================================================================
  const FLOWS = {
    propietario: ["solicitud_firmada", "dni_delante", "dni_detras"],
    familiar:    ["solicitud_firmada", "dni_delante", "dni_detras",
                  "dni_propietario_delante", "dni_propietario_detras",
                  "libro_familia", "autorizacion_familiar"],
    inquilino:   ["solicitud_firmada", "dni_delante", "dni_detras",
                  "dni_propietario_delante", "dni_propietario_detras",
                  "contrato_alquiler", "empadronamiento"],
    sociedad:    ["solicitud_firmada", "dni_delante", "dni_detras",
                  "nif_sociedad", "escritura_constitucion", "poderes_representante"],
    local:       ["solicitud_firmada", "dni_delante", "dni_detras",
                  "licencia_o_declaracion"],
  };
  const DOCS_FINANCIACION = [
    "dni_pagador_delante", "dni_pagador_detras",
    "justificante_ingresos", "titularidad_bancaria",
  ];

  function docsParaTipo(tipo, conFinanciacion) {
    const base = FLOWS[tipo] || [];
    return conFinanciacion ? [...base, ...DOCS_FINANCIACION] : [...base];
  }

  // =================================================================
  // HELPERS LOCALES
  // =================================================================
  function fmtTlf(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }

  function normalizarTelefono(s) {
    return String(s || "").replace(/\D/g, "").replace(/^34/, "");
  }

  function ahoraISO() { return new Date().toISOString(); }

  // Etiquetas legibles para los códigos de documento que index.cjs
  // escribe en la pestaña "expedientes" (col `documento_actual`).
  const DOC_LABELS = {
    solicitud_firmada: "Solicitud de EMASESA firmada",
    dni_delante: "DNI por la parte delantera",
    dni_detras: "DNI por la parte trasera",
    dni_familiar_delante: "DNI del familiar por delante",
    dni_familiar_detras: "DNI del familiar por detrás",
    dni_propietario_delante: "DNI del propietario por delante",
    dni_propietario_detras: "DNI del propietario por detrás",
    dni_inquilino_delante: "DNI del inquilino por delante",
    dni_inquilino_detras: "DNI del inquilino por detrás",
    dni_administrador_delante: "DNI del administrador por delante",
    dni_administrador_detras: "DNI del administrador por detrás",
    libro_familia: "Libro de familia",
    autorizacion_familiar: "Documento de autorización",
    contrato_alquiler: "Contrato de alquiler completo y firmado",
    empadronamiento: "Certificado de empadronamiento",
    nif_sociedad: "NIF/CIF de la sociedad",
    escritura_constitucion: "Escritura de constitución",
    poderes_representante: "Poderes del representante",
    licencia_o_declaracion: "Licencia de apertura o declaración responsable",
    dni_pagador_delante: "DNI del pagador por delante",
    dni_pagador_detras: "DNI del pagador por detrás",
    justificante_ingresos: "Justificante de ingresos",
    titularidad_bancaria: "Documento de titularidad bancaria",
  };
  function labelDoc(c) { return DOC_LABELS[c] || c || "—"; }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base + expedientes (lectura)
  // =================================================================
  async function leerVecinosBase() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        // La col A se ha venido usando como "comunidad" (clave corta).
        // Documentación pasa a usarla como `direccion` para los nuevos
        // vecinos. Compatibilidad: el match prueba con ambas claves.
        direccion: r[0] || "",
        bloque: r[1] || "",
        vivienda: r[2] || "",
        nombre: r[3] || "",
        telefono: r[4] || "",
        presentacion_enviada: r[5] || "",
      });
    }
    return out;
  }

  async function leerExpedientes() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        telefono: r[0] || "", comunidad: r[1] || "", vivienda: r[2] || "", nombre: r[3] || "",
        tipo_expediente: r[4] || "", paso_actual: r[5] || "", documento_actual: r[6] || "",
        estado_expediente: r[7] || "", fecha_inicio: r[8] || "", fecha_primer_contacto: r[9] || "",
        fecha_ultimo_contacto: r[10] || "", fecha_limite_documentacion: r[11] || "",
        fecha_limite_firma: r[12] || "", documentos_completos: r[13] || "",
        alerta_plazo: r[14] || "", documentos_recibidos: r[15] || "",
        documentos_pendientes: r[16] || "", documentos_opcionales_pendientes: r[17] || "",
        _rowIndex: i + 1,
      });
    }
    return out;
  }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base + expedientes + documentos (escritura)
  // =================================================================

  // Devuelve la fila exacta de vecinos_base que coincide por teléfono
  // (normalizado), o null si no existe.
  async function buscarVecinoBasePorTelefono(telefono) {
    const tn = normalizarTelefono(telefono);
    if (!tn) return null;
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE,
    });
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      if (normalizarTelefono(r[4] || "") === tn) {
        return {
          direccion: r[0] || "", bloque: r[1] || "", vivienda: r[2] || "",
          nombre: r[3] || "", telefono: r[4] || "", presentacion_enviada: r[5] || "",
          _rowIndex: i + 1,
        };
      }
    }
    return null;
  }

  async function crearVecinoBase({ direccion, vivienda, nombre, telefono }) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE, valueInputOption: "RAW",
      requestBody: { values: [[
        direccion || "", "", vivienda || "", nombre || "", telefono || "", "",
      ]] },
    });
  }

  async function actualizarVecinoBase(rowIndex, { direccion, vivienda, nombre, telefono, bloque, presentacion_enviada }) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `vecinos_base!A${rowIndex}:F${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[
        direccion || "", bloque || "", vivienda || "", nombre || "", telefono || "", presentacion_enviada || "",
      ]] },
    });
  }

  async function buscarExpedientePorTelefono(telefono) {
    const tn = normalizarTelefono(telefono);
    if (!tn) return null;
    const todos = await leerExpedientes();
    return todos.find(e => normalizarTelefono(e.telefono) === tn) || null;
  }

  // Crea una fila en `expedientes` con la estructura mínima que entiende
  // index.cjs. Si ya existe, no la duplica (devuelve la existente).
  async function crearExpedienteSiNoExiste(comu, vecino) {
    const exist = await buscarExpedientePorTelefono(vecino.telefono);
    if (exist) return exist;
    const sheets = getSheetsClient();
    const fila = [
      vecino.telefono || "",                 // A telefono
      comu.comunidad || comu.direccion || "", // B comunidad (clave histórica)
      vecino.vivienda || "",                 // C vivienda
      vecino.nombre || "",                   // D nombre
      "",                                    // E tipo_expediente (lo asigna usuario o bot)
      "",                                    // F paso_actual
      "",                                    // G documento_actual
      "pendiente_clasificacion",             // H estado_expediente (mismo valor que usa index.cjs)
      ahoraISO(),                            // I fecha_inicio
      ahoraISO(),                            // J fecha_primer_contacto (manual)
      ahoraISO(),                            // K fecha_ultimo_contacto
      "", "",                                // L M fechas límite
      "",                                    // N documentos_completos
      "",                                    // O alerta_plazo
      "",                                    // P documentos_recibidos
      "",                                    // Q documentos_pendientes
      "",                                    // R documentos_opcionales_pendientes
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES, valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });
    return await buscarExpedientePorTelefono(vecino.telefono);
  }

  // Actualiza un campo concreto del expediente por índice de columna (0-based).
  async function actualizarCampoExpedienteByRow(rowIndex, campoIndex, nuevoValor) {
    const sheets = getSheetsClient();
    const colLetter = String.fromCharCode(65 + campoIndex);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `expedientes!${colLetter}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[nuevoValor]] },
    });
  }

  // Recalcula documentos_recibidos / documentos_pendientes leyendo
  // la pestaña `documentos` para este teléfono y comparando con el
  // FLOWS del tipo. Sigue exactamente la lógica que usa index.cjs.
  async function recalcularDocsExpediente(telefono) {
    const exp = await buscarExpedientePorTelefono(telefono);
    if (!exp) return;
    const tipo = exp.tipo_expediente;
    const conFinanciacion = (exp.documentos_opcionales_pendientes || "").includes("financiacion") ||
                            DOCS_FINANCIACION.some(d => (exp.documentos_recibidos || "").includes(d));
    const docsTipo = tipo ? docsParaTipo(tipo, conFinanciacion) : [];

    // Leer pestaña `documentos`: A telefono, B comunidad, C vivienda, D tipoDoc
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOCUMENTOS,
    });
    const rows = res.data.values || [];
    const tn = normalizarTelefono(telefono);
    const recibidos = new Set();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      if (normalizarTelefono(r[0] || "") !== tn) continue;
      // Estado revisión (col I): solo cuentan los OK
      const estado = (r[8] || "").toUpperCase();
      if (estado === "RECHAZADO") continue;
      const tipoDoc = r[3] || "";
      if (tipoDoc) recibidos.add(tipoDoc);
    }
    const pendientes = docsTipo.filter(d => !recibidos.has(d));
    await actualizarCampoExpedienteByRow(exp._rowIndex, 15, [...recibidos].join(","));   // P
    await actualizarCampoExpedienteByRow(exp._rowIndex, 16, pendientes.join(","));        // Q

    // Si no quedan pendientes, marcar estado completo (mismo valor que index.cjs)
    if (tipo && pendientes.length === 0) {
      await actualizarCampoExpedienteByRow(exp._rowIndex, 7, "documentacion_base_completa"); // H
    }
  }

  // Sube un buffer a Drive (carpeta compartida) y devuelve {fileId, url}.
  async function subirArchivoADrive(buffer, mimeType, nombreArchivo) {
    if (!DRIVE_FOLDER) throw new Error("GOOGLE_DRIVE_FOLDER_ID no configurado");
    const drive = getDriveClient();
    const bs = new stream.PassThrough();
    bs.end(buffer);
    const file = await drive.files.create({
      requestBody: { name: nombreArchivo, parents: [DRIVE_FOLDER] },
      media: { mimeType: mimeType || "application/octet-stream", body: bs },
      fields: "id, webViewLink, webContentLink",
    });
    return {
      fileId: file.data.id,
      url: file.data.webViewLink || file.data.webContentLink || "",
    };
  }

  async function registrarDocumento({ telefono, comunidad, vivienda, tipoDoc, nombreArchivo, urlDrive, origen, estado }) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: RANGO_DOCUMENTOS, valueInputOption: "RAW",
      requestBody: { values: [[
        telefono || "", comunidad || "", vivienda || "", tipoDoc || "",
        nombreArchivo || "", ahoraISO(), urlDrive || "",
        origen || "validacion_manual", estado || "OK", "", "", "media",
      ]] },
    });
  }

  // Cache de sheetId por nombre de pestaña (para deleteDimension).
  let _sheetIdCache = null;
  async function getSheetIdByName(name) {
    if (!_sheetIdCache) {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      _sheetIdCache = {};
      for (const s of (meta.data.sheets || [])) {
        _sheetIdCache[s.properties.title] = s.properties.sheetId;
      }
    }
    return _sheetIdCache[name];
  }

  // Borra una sola fila (1-based) de la pestaña indicada.
  async function borrarFilaSheet(pestana, rowIndex) {
    const sheets = getSheetsClient();
    const sheetId = await getSheetIdByName(pestana);
    if (sheetId === undefined) throw new Error("Pestaña no encontrada: " + pestana);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId, dimension: "ROWS",
              startIndex: rowIndex - 1, endIndex: rowIndex,
            },
          },
        }],
      },
    });
  }

  // Borra varias filas de una pestaña en una sola llamada batch.
  // rowIndices se ordenan de mayor a menor para que los borrados no
  // desplacen los índices de los siguientes.
  async function borrarFilasSheet(pestana, rowIndices) {
    if (!rowIndices || rowIndices.length === 0) return;
    const sheets = getSheetsClient();
    const sheetId = await getSheetIdByName(pestana);
    if (sheetId === undefined) throw new Error("Pestaña no encontrada: " + pestana);
    const ordenados = [...rowIndices].sort((a, b) => b - a);
    const requests = ordenados.map(idx => ({
      deleteDimension: {
        range: {
          sheetId, dimension: "ROWS",
          startIndex: idx - 1, endIndex: idx,
        },
      },
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
  }

  // Lee la pestaña documentos y devuelve filas asociadas a un teléfono.
  // Devuelve { rowIndices, fileIds } para poder borrar Sheet + Drive.
  async function leerDocumentosDeVecino(telefono) {
    const tn = normalizarTelefono(telefono);
    if (!tn) return { rowIndices: [], fileIds: [] };
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOCUMENTOS,
    });
    const rows = res.data.values || [];
    const rowIndices = [];
    const fileIds = [];
    // Cols: A telefono · B comunidad · C vivienda · D tipoDoc · E nombreArchivo
    //       F fechaISO · G urlDrive · H origen · I estado · J? · K? · L?
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      if (normalizarTelefono(r[0] || "") !== tn) continue;
      rowIndices.push(i + 1);
      // Extraer fileId del urlDrive si es de Drive
      const url = String(r[6] || "");
      const m = url.match(/[-\w]{25,}/); // typical Drive ID
      if (m) fileIds.push(m[0]);
    }
    return { rowIndices, fileIds };
  }

  async function borrarArchivoDrive(fileId) {
    if (!fileId) return;
    try {
      const drive = getDriveClient();
      await drive.files.delete({ fileId });
    } catch (e) {
      // No bloqueamos el flujo si un archivo ya no existe en Drive.
      console.warn("[documentacion] no se pudo borrar archivo Drive " + fileId + ":", e.message);
    }
  }

  // Empareja por dirección o por clave de comunidad. Prueba ambas para
  // máxima compatibilidad con datos antiguos creados por index.cjs.
  function emparejar(items, comu, campoComu) {
    if (!items || !comu) return [];
    const norm = s => String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const claves = [norm(comu.direccion), norm(comu.comunidad)].filter(Boolean);
    if (claves.length === 0) return [];
    return items.filter(v => {
      const vc = norm(v[campoComu]);
      if (!vc) return false;
      return claves.some(k => k === vc || k.includes(vc) || vc.includes(k));
    });
  }

  // =================================================================
  // BADGE Y CAJITA DE VECINOS
  // =================================================================
  function badgeEstadoVecino(estado, esc) {
    const map = {
      en_proceso: { txt: "En proceso", cls: "ptl-badge-azul" },
      pendiente_clasificacion: { txt: "Pdte. clasificación", cls: "ptl-badge-gris" },
      pendiente_estudio_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      pendiente_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      documentacion_base_completa: { txt: "Doc. completa", cls: "ptl-badge-verde" },
      expediente_con_revision_pendiente: { txt: "Revisión pendiente", cls: "ptl-badge-naranja" },
      completo_revision_final: { txt: "Rev. final", cls: "ptl-badge-naranja" },
      sin_contacto: { txt: "Sin contacto", cls: "ptl-badge-gris" },
    };
    const def = map[estado] || { txt: estado || "—", cls: "ptl-badge-gris" };
    return `<span class="ptl-badge ${def.cls}">${esc(def.txt)}</span>`;
  }

  function cajitaVecinosHtml(comu, vecinosBase, expedientes, token, esc) {
    const vBase = emparejar(vecinosBase, comu, "direccion");
    const vExp = emparejar(expedientes, comu, "comunidad");

    // Indexar expedientes por teléfono normalizado para cruce rápido.
    const normTlf = s => String(s || "").replace(/\D/g, "").replace(/^34/, "");
    const expByTlf = {};
    vExp.forEach(e => { const k = normTlf(e.telefono); if (k) expByTlf[k] = e; });

    // Construir lista unificada: vecinos_base + estado real del bot.
    const filas = [];
    vBase.forEach(vb => {
      const exp = expByTlf[normTlf(vb.telefono)] || null;
      filas.push({
        telefono: vb.telefono,
        nombre: vb.nombre || (exp && exp.nombre) || "",
        vivienda: vb.vivienda || (exp && exp.vivienda) || "",
        estado: exp ? exp.estado_expediente : "sin_contacto",
        tipo_expediente: exp ? exp.tipo_expediente : "",
        documento_actual: exp ? exp.documento_actual : "",
        documentos_pendientes: exp ? exp.documentos_pendientes : "",
        documentos_recibidos: exp ? exp.documentos_recibidos : "",
        tieneExpediente: !!exp,
      });
    });
    // Vecinos con expediente pero NO en vecinos_base (huérfanos).
    vExp.forEach(e => {
      const k = normTlf(e.telefono);
      if (!vBase.some(vb => normTlf(vb.telefono) === k)) {
        filas.push({
          telefono: e.telefono,
          nombre: e.nombre || "",
          vivienda: e.vivienda || "",
          estado: e.estado_expediente,
          tipo_expediente: e.tipo_expediente || "",
          documento_actual: e.documento_actual,
          documentos_pendientes: e.documentos_pendientes,
          documentos_recibidos: e.documentos_recibidos || "",
          tieneExpediente: true,
          huerfano: true,
        });
      }
    });

    const total = filas.length;
    const completos = filas.filter(f => f.estado === "documentacion_base_completa").length;
    const sinContacto = filas.filter(f => f.estado === "sin_contacto").length;

    // Cabecera con stats (solo si hay filas)
    const incompletos = total - completos;
    const pillResumen = total === 0
      ? ""
      : (incompletos === 0
          ? `<span class="ptl-stat-pill ptl-stat-verde">✓ Completo</span>`
          : `<span class="ptl-stat-pill ptl-stat-naranja">⚠ ${incompletos} pendiente${incompletos === 1 ? '' : 's'}</span>`);
    const pillSinContacto = sinContacto > 0
      ? `<span class="ptl-stat-pill ptl-stat-gris" style="margin-left:4px">${sinContacto} sin contacto</span>`
      : "";

    // Filas existentes — editables inline + botón "Rellenar" + panel acordeón
    const filasHtml = filas.map((f, idx) => {
      const tlfFmt = fmtTlf(f.telefono);
      const tlfNorm = normTlf(f.telefono);
      const huerfano = f.huerfano
        ? `<span class="ptl-badge ptl-badge-amarillo" style="margin-left:4px" title="Existe en expedientes pero no en el listado vecinos_base">⚠</span>`
        : "";
      const tieneTipo = !!f.tipo_expediente;
      const conFinanciacion = (f.documentos_opcionales_pendientes || "").includes("financiacion") ||
                              DOCS_FINANCIACION.some(d => (f.documentos_recibidos || "").includes(d));
      const docsTipo = tieneTipo ? docsParaTipo(f.tipo_expediente, conFinanciacion) : [];
      const recibidosSet = new Set((f.documentos_recibidos || "").split(",").map(s => s.trim()).filter(Boolean));
      const totalDocs = docsTipo.length;
      const docsOk = docsTipo.filter(d => recibidosSet.has(d)).length;
      const resumenDocs = tieneTipo
        ? `${docsOk}/${totalDocs} docs`
        : `<em style="color:var(--ptl-gray-500)">sin tipo</em>`;

      // Panel acordeón con tipo, financiación y lista de docs
      const docsHtml = docsTipo.map(d => {
        const recibido = recibidosSet.has(d);
        const ico = recibido ? "✓" : "○";
        const cls = recibido ? "ptl-doc-ok" : "ptl-doc-pdte";
        return `<div class="ptl-doc-row ${cls}">
          <span class="ptl-doc-ico">${ico}</span>
          <span class="ptl-doc-label">${esc(labelDoc(d))}</span>
          <span class="ptl-doc-actions">
            <input type="file" id="file-${idx}-${esc(d)}" style="display:none" onchange="ptlDoc.subirDoc(this, '${esc(f.telefono)}', '${esc(d)}')"/>
            <button type="button" class="ptl-btn-mini" onclick="document.getElementById('file-${idx}-${esc(d)}').click()">${recibido ? "↻ Reemplazar" : "↑ Subir"}</button>
          </span>
        </div>`;
      }).join("");

      const tipos = ["propietario", "familiar", "inquilino", "sociedad", "local"];
      const tipoOptions = `<option value="">— sin asignar —</option>` +
        tipos.map(t => `<option value="${t}"${f.tipo_expediente === t ? " selected" : ""}>${t}</option>`).join("");

      const acordeonId = `acord-${idx}`;
      const acordeon = `
        <tr class="ptl-acord-row" id="${acordeonId}" style="display:none">
          <td colspan="6" class="ptl-acord-cell">
            <div class="ptl-acord-grid">
              <div class="ptl-acord-col">
                <label class="ptl-form-label">Tipo de expediente</label>
                <select onchange="ptlDoc.asignarTipo('${esc(f.telefono)}', this.value)">
                  ${tipoOptions}
                </select>
              </div>
              <div class="ptl-acord-col">
                <label class="ptl-form-label">¿Solicita financiación?</label>
                <select onchange="ptlDoc.asignarFinanciacion('${esc(f.telefono)}', this.value)">
                  <option value="">— no aplica —</option>
                  <option value="si"${conFinanciacion ? " selected" : ""}>Sí</option>
                  <option value="no"${(!conFinanciacion && tieneTipo) ? " selected" : ""}>No</option>
                </select>
              </div>
            </div>
            <div class="ptl-docs-list">
              ${tieneTipo ? docsHtml : `<div style="padding:8px;color:var(--ptl-gray-500);font-style:italic;font-size:12px">Selecciona el tipo de expediente para ver los documentos requeridos.</div>`}
            </div>
          </td>
        </tr>`;

      return `<tr class="ptl-vecino-row" data-tlf="${esc(f.telefono)}">
        <td class="ptl-col-vivienda"><input type="text" class="ptl-inline-input" value="${esc(f.vivienda)}" onchange="ptlDoc.actualizar('${esc(f.telefono)}','vivienda',this.value)"/>${huerfano}</td>
        <td class="ptl-col-nombre"><input type="text" class="ptl-inline-input" value="${esc(f.nombre)}" onchange="ptlDoc.actualizar('${esc(f.telefono)}','nombre',this.value)"/></td>
        <td class="ptl-col-tel ptl-num-cell">${esc(tlfFmt)}</td>
        <td class="ptl-col-estado">${badgeEstadoVecino(f.estado, esc)}</td>
        <td class="ptl-col-docs">${resumenDocs}</td>
        <td class="ptl-col-acciones">
          <button type="button" class="ptl-btn-circle ptl-btn-circle-gray" title="Documentos" onclick="ptlDoc.toggleAcord('${acordeonId}')">📄</button>
          <button type="button" class="ptl-btn-circle ptl-btn-circle-red" title="Borrar vecino" onclick="ptlDoc.borrarVecino('${esc(f.telefono)}', '${esc(f.nombre || f.vivienda || f.telefono)}')">×</button>
        </td>
      </tr>
      ${acordeon}`;
    }).join("");

    // Fila vacía al final para añadir un nuevo vecino
    const filaNueva = `
      <tr class="ptl-vecino-nuevo">
        <td class="ptl-col-vivienda"><input type="text" id="vec-new-vivienda" class="ptl-inline-input" placeholder="Vivienda"/></td>
        <td class="ptl-col-nombre"><input type="text" id="vec-new-nombre" class="ptl-inline-input" placeholder="Nombre"/></td>
        <td class="ptl-col-tel"><input type="tel" id="vec-new-telefono" class="ptl-inline-input" placeholder="Teléfono"/></td>
        <td class="ptl-col-estado" colspan="2"><em style="color:var(--ptl-gray-500);font-size:12px">Nuevo vecino</em></td>
        <td class="ptl-col-acciones">
          <button type="button" class="ptl-btn-circle ptl-btn-circle-blue" title="Añadir vecino" onclick="ptlDoc.crearVecino()">+</button>
        </td>
      </tr>`;

    const cabeceraStats = total === 0 ? "" : `
      <div class="ptl-card-title-row">
        <div class="ptl-card-title" style="margin-bottom:0">Vecinos · Documentación (${total})</div>
        <div class="ptl-vecinos-stats">${pillResumen}${pillSinContacto}</div>
      </div>`;
    const cabeceraSimple = total === 0 ? `<div class="ptl-card-title">Vecinos · Documentación</div>` : "";

    // CSS extra (inline para no tocar estilo-visual.cjs)
    const cssInline = `
      <style>
        .ptl-tabla-vecinos{width:100%;table-layout:fixed}
        .ptl-tabla-vecinos th,.ptl-tabla-vecinos td{vertical-align:middle}
        .ptl-col-vivienda{width:90px}
        .ptl-col-nombre{width:auto}
        .ptl-col-tel{width:135px}
        .ptl-col-estado{width:120px}
        .ptl-col-docs{width:80px}
        .ptl-col-acciones{width:90px;text-align:right;white-space:nowrap}
        .ptl-inline-input{width:100%;border:1px solid var(--ptl-gray-200);border-radius:4px;padding:4px 6px;font-size:13px;background:#fff;box-sizing:border-box}
        .ptl-inline-input:focus{outline:none;border-color:var(--ptl-blue,#2c5282);box-shadow:0 0 0 2px rgba(44,82,130,.1)}
        /* Botones circulares (añadir / docs / borrar) */
        .ptl-btn-circle{
          display:inline-flex;align-items:center;justify-content:center;
          width:28px;height:28px;border-radius:50%;
          border:1px solid transparent;cursor:pointer;
          font-size:14px;line-height:1;padding:0;margin-left:4px;
          transition:transform .08s ease, box-shadow .08s ease;
        }
        .ptl-btn-circle:hover{transform:scale(1.06);box-shadow:0 1px 4px rgba(0,0,0,.15)}
        .ptl-btn-circle:active{transform:scale(.96)}
        .ptl-btn-circle-blue{background:#2c5282;color:#fff;border-color:#2c5282;font-weight:bold;font-size:18px}
        .ptl-btn-circle-blue:hover{background:#1e3a5f}
        .ptl-btn-circle-red{background:#dc2626;color:#fff;border-color:#dc2626;font-weight:bold;font-size:16px}
        .ptl-btn-circle-red:hover{background:#b91c1c}
        /* Gris claro como los campos bloqueados */
        .ptl-btn-circle-gray{background:#e5e7eb;color:#374151;border-color:#d1d5db;font-size:13px}
        .ptl-btn-circle-gray:hover{background:#d1d5db}
        /* Botón mini interno (subir/reemplazar dentro del acordeón) */
        .ptl-btn-mini{font-size:11px;padding:4px 8px;border:1px solid var(--ptl-gray-200);background:#fff;border-radius:4px;cursor:pointer;white-space:nowrap}
        .ptl-btn-mini:hover{background:var(--ptl-gray-50,#f7f8fa)}
        /* Acordeón */
        .ptl-acord-cell{background:var(--ptl-gray-50,#f7f8fa);padding:14px 18px !important}
        .ptl-acord-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}
        .ptl-acord-col label{display:block;font-size:11px;color:var(--ptl-gray-600,#666);margin-bottom:4px}
        .ptl-acord-col select{width:100%;padding:6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:13px}
        .ptl-docs-list{display:flex;flex-direction:column;gap:4px}
        .ptl-doc-row{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-100);border-radius:4px;font-size:13px}
        .ptl-doc-row.ptl-doc-ok{background:#f0fdf4;border-color:#bbf7d0}
        .ptl-doc-ico{font-weight:bold;text-align:center}
        .ptl-doc-row.ptl-doc-ok .ptl-doc-ico{color:#16a34a}
        .ptl-doc-row.ptl-doc-pdte .ptl-doc-ico{color:#94a3b8}
      </style>`;

    return `
      ${cssInline}
      <div class="ptl-card" style="margin-top:8px">
        ${cabeceraStats}${cabeceraSimple}
        <div style="overflow-x:auto;border-radius:6px;border:1px solid var(--ptl-gray-100)">
          <table class="ptl-tabla-vecinos">
            <thead><tr><th>Vivienda</th><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Docs.</th><th></th></tr></thead>
            <tbody>${filasHtml}${filaNueva}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // JS cliente para la cajita de vecinos. Se inyecta una vez por página.
  function jsClienteVecinos(token, ccppId) {
    const tk = JSON.stringify(token || "");
    const id = JSON.stringify(ccppId || "");
    return `
      <script>
      (function () {
        window.ptlDoc = window.ptlDoc || {};
        const TOKEN = ${tk};
        const CCPP = ${id};
        const urlT = (path, extra) => {
          const p = new URLSearchParams();
          p.set("token", TOKEN);
          if (extra) Object.keys(extra).forEach(k => p.set(k, extra[k]));
          return path + "?" + p.toString();
        };

        ptlDoc.toggleAcord = function (id) {
          const el = document.getElementById(id);
          if (!el) return;
          el.style.display = (el.style.display === "none" || !el.style.display) ? "table-row" : "none";
        };

        ptlDoc.crearVecino = async function () {
          const v = document.getElementById("vec-new-vivienda").value.trim();
          const n = document.getElementById("vec-new-nombre").value.trim();
          const t = document.getElementById("vec-new-telefono").value.trim();
          if (!v && !n && !t) return; // los 3 vacíos: silencio
          // Pre-check de teléfono duplicado
          if (t) {
            try {
              const r = await fetch(urlT("/documentacion/vecino/check-telefono", { telefono: t }));
              const j = await r.json();
              if (j && j.duplicado) {
                if (!confirm("Ese teléfono ya existe (CCPP: " + (j.direccion || "?") + "). ¿Añadir igualmente?")) return;
              }
            } catch (e) { /* si falla el check, seguimos */ }
          }
          try {
            const r = await fetch(urlT("/documentacion/vecino/crear", { id: CCPP }), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vivienda: v, nombre: n, telefono: t }),
            });
            if (!r.ok) throw new Error(await r.text());
            location.reload();
          } catch (e) { alert("Error al crear vecino: " + e.message); }
        };

        ptlDoc.actualizar = async function (telefono, campo, valor) {
          try {
            const r = await fetch(urlT("/documentacion/vecino/actualizar"), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telefono, campo, valor }),
            });
            if (!r.ok) throw new Error(await r.text());
          } catch (e) { alert("Error al guardar: " + e.message); }
        };

        ptlDoc.asignarTipo = async function (telefono, tipo) {
          try {
            const r = await fetch(urlT("/documentacion/vecino/asignar-tipo", { id: CCPP }), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telefono, tipo }),
            });
            if (!r.ok) throw new Error(await r.text());
            location.reload();
          } catch (e) { alert("Error al asignar tipo: " + e.message); }
        };

        ptlDoc.asignarFinanciacion = async function (telefono, valor) {
          try {
            const r = await fetch(urlT("/documentacion/vecino/asignar-financiacion"), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telefono, valor }),
            });
            if (!r.ok) throw new Error(await r.text());
            location.reload();
          } catch (e) { alert("Error al asignar financiación: " + e.message); }
        };

        ptlDoc.subirDoc = async function (fileInput, telefono, tipoDoc) {
          const file = fileInput.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("telefono", telefono);
          fd.append("tipoDoc", tipoDoc);
          try {
            const r = await fetch(urlT("/documentacion/vecino/subir-doc"), { method: "POST", body: fd });
            if (!r.ok) throw new Error(await r.text());
            location.reload();
          } catch (e) { alert("Error al subir: " + e.message); }
          fileInput.value = "";
        };

        ptlDoc.borrarVecino = async function (telefono, etiqueta) {
          const msg = "¿Seguro que quieres borrar este vecino y TODOS sus documentos?\n\n" +
            "Vecino: " + (etiqueta || telefono) + "\n\n" +
            "Esta acción no se puede deshacer. Se eliminarán:\n" +
            " · La fila en vecinos_base\n" +
            " · La fila en expedientes (si existe)\n" +
            " · Todos los documentos en el Sheet\n" +
            " · Los archivos físicos en Drive";
          if (!confirm(msg)) return;
          try {
            const r = await fetch(urlT("/documentacion/vecino/borrar"), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telefono }),
            });
            if (!r.ok) throw new Error(await r.text());
            location.reload();
          } catch (e) { alert("Error al borrar: " + e.message); }
        };
      })();
      </script>`;
  }

  // =================================================================
  // RUTAS — solo ficha individual
  // =================================================================
  app.get("/documentacion/expediente", async (req, res) => {
    // Acceso a los helpers de presupuestos (registrados en app.locals).
    const P = app.locals.presupuestos;
    if (!P) {
      return res.status(500).send(
        "Error: el módulo presupuestos no está cargado. " +
        "Asegúrate de que en index.cjs se haga require('./presupuestos.cjs')(app) " +
        "ANTES de require('./documentacion.cjs')(app)."
      );
    }

    const token = req.query.token || "";
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(403).send("No autorizado");
    }

    try {
      const id = req.query.id;
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) {
        return P.sendHtml(res, P.pageHtml("No encontrado",
          [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: "—", url: "#" }],
          `<div class="ptl-empty"><h3>Expediente no encontrado</h3></div>`,
          token));
      }

      // Cargar vecinos para la cajita.
      let vecinosBase = [];
      let expedientes = [];
      try { vecinosBase = await leerVecinosBase(); }
      catch (e) { console.warn("[documentacion] no se pudo leer vecinos_base:", e.message); }
      try { expedientes = await leerExpedientes(); }
      catch (e) { console.warn("[documentacion] no se pudo leer expedientes:", e.message); }

      const cajita = cajitaVecinosHtml(comu, vecinosBase, expedientes, token, P.esc);

      // ---------------------------------------------------------------
      // SOLICITUD DE LISTADO DE VECINOS (fase 05_DOCUMENTACION)
      // ---------------------------------------------------------------
      // Inyectamos un bloque JS que:
      //  1) Define window.ptlDoc.abrirModalEnvioListado() como wrapper de
      //     window.ptlAbrirModalMail (función global ya cargada por la
      //     ficha de presupuestos, que reusamos aquí).
      //  2) Si la URL trae ?abrirEnvio=1, abre el modal automáticamente
      //     al cargar (caso "acabo de aceptar el presupuesto, hay que
      //     pedir el listado al administrador").
      //
      // El botón "■ Reenviar solicitud de listado" de la barra de acción
      // (definido en presupuestos.cjs) llama también a esta función.
      const fase05 = String(comu.fase_presupuesto || "") === "05_DOCUMENTACION";
      const abrirEnvio = String(req.query.abrirEnvio || "") === "1";
      const ccppIdJs = JSON.stringify(String(comu.ccpp_id || ""));
      const bloqueEnvio = fase05 ? `
        <script>
        (function () {
          window.ptlDoc = window.ptlDoc || {};
          window.ptlDoc.abrirModalEnvioListado = function () {
            if (typeof window.ptlAbrirModalMail !== 'function') {
              alert('No se ha podido abrir el modal de envío.');
              return;
            }
            window.ptlAbrirModalMail('05_DOCUMENTACION', ${ccppIdJs});
          };
          ${abrirEnvio ? `
          // Auto-apertura tras aceptar presupuesto: damos un pequeño delay
          // para asegurar que ptlAbrirModalMail ya está definido por la
          // ficha de presupuestos.
          window.addEventListener('load', function () {
            setTimeout(function () {
              if (typeof window.ptlAbrirModalMail === 'function') {
                window.ptlAbrirModalMail('05_DOCUMENTACION', ${ccppIdJs});
              }
            }, 200);
          });
          ` : ``}
        })();
        </script>` : ``;

      const jsVecinos = jsClienteVecinos(token, comu.ccpp_id);
      const extraFinal = cajita + jsVecinos + bloqueEnvio;

      const datalists = P.construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";

      // Cargamos las plantillas del Sheet para que vistaFicha pueda mostrar
      // los plazos reales (próximo envío, tope) en la cabecera del listado.
      const plantillas = (typeof P.leerTodasPlantillasMail === "function")
        ? await P.leerTodasPlantillasMail() : {};

      // El breadcrumb apunta a /presupuestos (pantalla principal única).
      P.sendHtml(res, P.pageHtml(titulo,
        [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        P.vistaFicha(comu, datalists, token, reciencreado, { extraHtmlFinal: extraFinal, plantillas }),
        token));
    } catch (e) {
      console.error("[documentacion] /documentacion/expediente:", e.message);
      const P2 = app.locals.presupuestos;
      if (P2) P2.sendError(res, "Error: " + e.message);
      else res.status(500).send("Error: " + e.message);
    }
  });

  // =================================================================
  // ENDPOINTS — gestión de vecinos (modo manual)
  // =================================================================

  function checkAuth(req, res) {
    const token = req.query.token || req.body.token || "";
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }

  // GET /documentacion/vecino/check-telefono?telefono=...
  // Devuelve { duplicado, direccion } si ya existe alguno con ese tlf.
  app.get("/documentacion/vecino/check-telefono", async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const tlf = String(req.query.telefono || "").trim();
      if (!tlf) return res.json({ duplicado: false });
      const v = await buscarVecinoBasePorTelefono(tlf);
      if (v) return res.json({ duplicado: true, direccion: v.direccion });
      return res.json({ duplicado: false });
    } catch (e) {
      console.error("[documentacion] check-telefono:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/crear?id=ccpp_xxx
  // Body: { vivienda, nombre, telefono }
  app.post("/documentacion/vecino/crear", express.json(), async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const id = req.query.id;
      const { vivienda, nombre, telefono } = req.body || {};
      if (!vivienda && !nombre && !telefono) {
        return res.status(400).json({ error: "Todos los campos vacíos" });
      }
      const P = app.locals.presupuestos;
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });
      await crearVecinoBase({
        direccion: comu.direccion || comu.comunidad,
        vivienda: vivienda || "",
        nombre: nombre || "",
        telefono: (telefono || "").trim(),
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[documentacion] crear vecino:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/actualizar
  // Body: { telefono, campo: "vivienda"|"nombre", valor }
  app.post("/documentacion/vecino/actualizar", express.json(), async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const { telefono, campo, valor } = req.body || {};
      if (!telefono || !campo) return res.status(400).json({ error: "Faltan campos" });
      const v = await buscarVecinoBasePorTelefono(telefono);
      if (!v) return res.status(404).json({ error: "Vecino no encontrado" });
      const datos = { ...v };
      datos[campo] = valor || "";
      await actualizarVecinoBase(v._rowIndex, datos);
      res.json({ ok: true });
    } catch (e) {
      console.error("[documentacion] actualizar vecino:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/asignar-tipo?id=ccpp_xxx
  // Body: { telefono, tipo }
  app.post("/documentacion/vecino/asignar-tipo", express.json(), async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const id = req.query.id;
      const { telefono, tipo } = req.body || {};
      if (!telefono) return res.status(400).json({ error: "Falta telefono" });
      const tiposValidos = ["", "propietario", "familiar", "inquilino", "sociedad", "local"];
      if (!tiposValidos.includes(tipo || "")) {
        return res.status(400).json({ error: "Tipo inválido" });
      }
      const P = app.locals.presupuestos;
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });
      const vBase = await buscarVecinoBasePorTelefono(telefono);
      const vecino = vBase || { telefono, vivienda: "", nombre: "" };
      await crearExpedienteSiNoExiste(comu, vecino);
      const exp = await buscarExpedientePorTelefono(telefono);
      // Col E (índice 4) = tipo_expediente
      await actualizarCampoExpedienteByRow(exp._rowIndex, 4, tipo || "");
      // Recalcular pendientes según el nuevo tipo
      await recalcularDocsExpediente(telefono);
      res.json({ ok: true });
    } catch (e) {
      console.error("[documentacion] asignar tipo:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/asignar-financiacion
  // Body: { telefono, valor: "si"|"no"|"" }
  app.post("/documentacion/vecino/asignar-financiacion", express.json(), async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const { telefono, valor } = req.body || {};
      if (!telefono) return res.status(400).json({ error: "Falta telefono" });
      const exp = await buscarExpedientePorTelefono(telefono);
      if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
      // Col R (índice 17) = documentos_opcionales_pendientes
      const marca = (valor === "si") ? "financiacion" : "";
      await actualizarCampoExpedienteByRow(exp._rowIndex, 17, marca);
      await recalcularDocsExpediente(telefono);
      res.json({ ok: true });
    } catch (e) {
      console.error("[documentacion] asignar financiacion:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/subir-doc (multipart)
  // Form-data: file, telefono, tipoDoc
  const subirDocMiddleware = upload ? upload.single("file") : (req, res, next) => next();
  app.post("/documentacion/vecino/subir-doc", subirDocMiddleware, async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!upload) {
      return res.status(501).json({
        error: "Subida deshabilitada: instala multer (`npm install multer`) y reinicia",
      });
    }
    try {
      const { telefono, tipoDoc } = req.body || {};
      const file = req.file;
      if (!telefono || !tipoDoc) return res.status(400).json({ error: "Faltan campos" });
      if (!file) return res.status(400).json({ error: "Falta archivo" });
      const exp = await buscarExpedientePorTelefono(telefono);
      const comunidad = exp ? exp.comunidad : "";
      const vivienda = exp ? exp.vivienda : "";
      const nombreArchivo = `${normalizarTelefono(telefono)}_${tipoDoc}_${Date.now()}_${file.originalname}`;
      const subida = await subirArchivoADrive(file.buffer, file.mimetype, nombreArchivo);
      await registrarDocumento({
        telefono, comunidad, vivienda, tipoDoc,
        nombreArchivo: file.originalname,
        urlDrive: subida.url,
        origen: "validacion_manual",
        estado: "OK",
      });
      await recalcularDocsExpediente(telefono);
      res.json({ ok: true, url: subida.url });
    } catch (e) {
      console.error("[documentacion] subir-doc:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /documentacion/vecino/borrar
  // Body: { telefono }
  // Borra: vecinos_base + expedientes + documentos (filas) + archivos en Drive.
  app.post("/documentacion/vecino/borrar", express.json(), async (req, res) => {
    if (!checkAuth(req, res)) return;
    try {
      const { telefono } = req.body || {};
      if (!telefono) return res.status(400).json({ error: "Falta telefono" });

      const resumen = { vecinos_base: 0, expedientes: 0, documentos: 0, archivos_drive: 0, errores: [] };

      // 1) Documentos del vecino + sus archivos en Drive
      try {
        const docs = await leerDocumentosDeVecino(telefono);
        // Borrar archivos físicos de Drive (uno a uno; tolera fallos)
        for (const fid of docs.fileIds) {
          await borrarArchivoDrive(fid);
          resumen.archivos_drive++;
        }
        // Borrar las filas de documentos en bloque
        if (docs.rowIndices.length) {
          await borrarFilasSheet("documentos", docs.rowIndices);
          resumen.documentos = docs.rowIndices.length;
        }
      } catch (e) {
        resumen.errores.push("documentos: " + e.message);
      }

      // 2) Expediente
      try {
        const exp = await buscarExpedientePorTelefono(telefono);
        if (exp && exp._rowIndex) {
          await borrarFilaSheet("expedientes", exp._rowIndex);
          resumen.expedientes = 1;
        }
      } catch (e) {
        resumen.errores.push("expedientes: " + e.message);
      }

      // 3) Fila de vecinos_base
      try {
        const vb = await buscarVecinoBasePorTelefono(telefono);
        if (vb && vb._rowIndex) {
          await borrarFilaSheet("vecinos_base", vb._rowIndex);
          resumen.vecinos_base = 1;
        }
      } catch (e) {
        resumen.errores.push("vecinos_base: " + e.message);
      }

      if (resumen.errores.length > 0) {
        console.warn("[documentacion] borrar vecino con errores:", resumen);
      }
      res.json({ ok: true, resumen });
    } catch (e) {
      console.error("[documentacion] borrar vecino:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[documentacion] Módulo cargado. Rutas: /documentacion/expediente, /documentacion/vecino/*");

};
