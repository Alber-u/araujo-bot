const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= GOOGLE AUTH =================
function getGoogleAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return auth;
}

function getDriveClient() {
  return google.drive({
    version: "v3",
    auth: getGoogleAuth(),
  });
}

function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
}

// ================= HELPERS =================
function ahoraISO() {
  return new Date().toISOString();
}

function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function normalizarTelefono(telefono) {
  return (telefono || "").replace(/\s/g, "").trim();
}

function extensionDesdeMime(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/heic") return ".heic";
  return "";
}

// ================= FLUJOS =================
const FLOWS = {
  propietario: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_delante", prompt: "2️⃣ Sube una foto del DNI por la parte delantera." },
    { code: "dni_detras", prompt: "3️⃣ Sube una foto del DNI por la parte trasera." },
    { code: "empadronamiento", prompt: "4️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  familiar: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_familiar_delante", prompt: "2️⃣ Sube el DNI del familiar por delante." },
    { code: "dni_familiar_detras", prompt: "3️⃣ Sube el DNI del familiar por detrás." },
    { code: "dni_propietario_delante", prompt: "4️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5️⃣ Sube el DNI del propietario por detrás." },
    { code: "libro_familia", prompt: "6️⃣ Sube el libro de familia." },
    { code: "autorizacion_familiar", prompt: "7️⃣ Sube el documento de autorización." },
    { code: "empadronamiento", prompt: "8️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  inquilino: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_inquilino_delante", prompt: "2️⃣ Sube el DNI del inquilino por delante." },
    { code: "dni_inquilino_detras", prompt: "3️⃣ Sube el DNI del inquilino por detrás." },
    { code: "dni_propietario_delante", prompt: "4️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5️⃣ Sube el DNI del propietario por detrás." },
    { code: "contrato_alquiler", prompt: "6️⃣ Sube el contrato de alquiler completo y firmado." },
    { code: "empadronamiento", prompt: "7️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  sociedad: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_administrador_delante", prompt: "2️⃣ Sube el DNI del administrador por delante." },
    { code: "dni_administrador_detras", prompt: "3️⃣ Sube el DNI del administrador por detrás." },
    { code: "nif_sociedad", prompt: "4️⃣ Sube el NIF/CIF de la sociedad." },
    { code: "escritura_constitucion", prompt: "5️⃣ Sube la escritura de constitución." },
    { code: "poderes_representante", prompt: "6️⃣ Sube los poderes del representante." },
  ],
  local: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_propietario_delante", prompt: "2️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "3️⃣ Sube el DNI del propietario por detrás." },
    { code: "licencia_o_declaracion", prompt: "4️⃣ Sube la licencia de apertura o la declaración responsable." },
  ],
  financiacion: [
    { code: "dni_pagador_delante", prompt: "1️⃣ Sube el DNI del pagador por delante." },
    { code: "dni_pagador_detras", prompt: "2️⃣ Sube el DNI del pagador por detrás." },
    { code: "justificante_ingresos", prompt: "3️⃣ Sube un justificante de ingresos." },
    { code: "titularidad_bancaria", prompt: "4️⃣ Sube el documento de titularidad bancaria." },
  ],
};

function mapTipoExpediente(texto) {
  const t = (texto || "").trim().toLowerCase();

  if (t === "1" || t.includes("propiet")) return "propietario";
  if (t === "2" || t.includes("familiar")) return "familiar";
  if (t === "3" || t.includes("inquilin")) return "inquilino";
  if (t === "4" || t.includes("sociedad") || t.includes("empresa")) return "sociedad";
  if (t === "5" || t.includes("local")) return "local";

  return null;
}

function mapFinanciacion(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (t === "1" || t === "si" || t === "sí") return "si";
  if (t === "2" || t === "no") return "no";
  return null;
}

function buildPreguntaTipo(nombre) {
  return `Hola ${nombre || ""} 👋 Soy el asistente de Instalaciones Araujo.

Voy a ayudarte a enviar la documentación necesaria para el Plan 5 de EMASESA.

Indica tu caso:
1. Soy propietario de la vivienda
2. El contrato irá a nombre de un familiar
3. El contrato irá a nombre de un inquilino
4. La vivienda está a nombre de una sociedad
5. Es un local comercial`;
}

function buildPreguntaFinanciacion() {
  return `Perfecto 👌

Hemos recibido la documentación base necesaria.

Última pregunta:
¿Te gustaría que estudiemos la posibilidad de financiar tu parte?

1. Sí
2. No`;
}

// ================= DRIVE =================
async function buscarCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });

  return res.data.files[0] || null;
}

async function crearCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, name",
  });

  return file.data;
}

async function getOrCreateCarpetaTelefono(telefono) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  let carpeta = await buscarCarpeta(telefono, rootId);

  if (!carpeta) {
    carpeta = await crearCarpeta(telefono, rootId);
  }

  return carpeta.id;
}

async function uploadToDrive(buffer, fileName, mimeType, carpetaId) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [carpetaId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, name, webViewLink",
  });

  return file.data;
}

// ================= SHEETS - VECINOS =================
async function buscarVecinoPorTelefono(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos_base!A:E",
  });

  const rows = res.data.values || [];
  const telNormalizado = normalizarTelefono(telefono);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const telFila = normalizarTelefono(row[4] || "");

    if (telFila === telNormalizado) {
      return {
        comunidad: row[0] || "",
        bloque: row[1] || "",
        vivienda: row[2] || "",
        nombre: row[3] || "",
        telefono: row[4] || "",
      };
    }
  }

  return null;
}

// ================= SHEETS - CONTACTOS (LOG) =================
async function guardarContacto(telefono, mensajeCliente, tipo, respuestaBot) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "contactos!A:E",
    valueInputOption: "RAW",
    requestBody: {
      values: [[ahoraISO(), telefono, mensajeCliente, tipo, respuestaBot]],
    },
  });
}

// ================= SHEETS - EXPEDIENTES =================
async function buscarExpedientePorTelefono(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:O",
  });

  const rows = res.data.values || [];
  const telNormalizado = normalizarTelefono(telefono);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const telFila = normalizarTelefono(row[0] || "");

    if (telFila === telNormalizado) {
      return {
        rowIndex: i + 1,
        telefono: row[0] || "",
        comunidad: row[1] || "",
        vivienda: row[2] || "",
        nombre: row[3] || "",
        tipo_expediente: row[4] || "",
        paso_actual: row[5] || "",
        documento_actual: row[6] || "",
        estado_expediente: row[7] || "",
        fecha_inicio: row[8] || "",
        fecha_primer_contacto: row[9] || "",
        fecha_ultimo_contacto: row[10] || "",
        fecha_limite_documentacion: row[11] || "",
        fecha_limite_firma: row[12] || "",
        documentos_completos: row[13] || "",
        alerta_plazo: row[14] || "",
      };
    }
  }

  return null;
}

async function crearExpedienteInicial(telefono, datosVecino) {
  const sheets = getSheetsClient();
  const ahora = ahoraISO();
  const limiteDocumentacion = sumarDias(ahora, 20);

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:O",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        telefono,
        datosVecino?.comunidad || "",
        datosVecino?.vivienda || "",
        datosVecino?.nombre || "",
        "", // tipo_expediente
        "pregunta_tipo", // paso_actual
        "", // documento_actual
        "pendiente_clasificacion", // estado_expediente
        ahora, // fecha_inicio
        ahora, // fecha_primer_contacto
        ahora, // fecha_ultimo_contacto
        limiteDocumentacion, // fecha_limite_documentacion
        "", // fecha_limite_firma
        "NO", // documentos_completos
        "ok", // alerta_plazo
      ]],
    },
  });
}

async function actualizarExpediente(rowIndex, data) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `expedientes!A${rowIndex}:O${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.telefono || "",
        data.comunidad || "",
        data.vivienda || "",
        data.nombre || "",
        data.tipo_expediente || "",
        data.paso_actual || "",
        data.documento_actual || "",
        data.estado_expediente || "",
        data.fecha_inicio || "",
        data.fecha_primer_contacto || "",
        data.fecha_ultimo_contacto || "",
        data.fecha_limite_documentacion || "",
        data.fecha_limite_firma || "",
        data.documentos_completos || "",
        data.alerta_plazo || "",
      ]],
    },
  });
}

// ================= SHEETS - DOCUMENTOS =================
async function guardarDocumentoSheet(
  telefono,
  comunidad,
  vivienda,
  tipoDocumento,
  nombreArchivo,
  urlDrive,
  origenClasificacion
) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "documentos!A:H",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        telefono,
        comunidad,
        vivienda,
        tipoDocumento,
        nombreArchivo,
        ahoraISO(),
        urlDrive || "",
        origenClasificacion || "",
      ]],
    },
  });
}

// ================= FLOW HELPERS =================
function getNextStep(tipoExpediente, currentDocCode) {
  const flow = FLOWS[tipoExpediente] || [];
  const index = flow.findIndex((d) => d.code === currentDocCode);

  if (index === -1) {
    return flow.length > 0 ? flow[0] : null;
  }

  if (index + 1 < flow.length) {
    return flow[index + 1];
  }

  return null;
}

function getFirstStep(tipoExpediente) {
  const flow = FLOWS[tipoExpediente] || [];
  return flow.length > 0 ? flow[0] : null;
}

// ================= RESPUESTA + LOG =================
async function responderYLog(res, telefono, mensajeCliente, tipo, respuestaBot) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuestaBot);

  try {
    await guardarContacto(telefono, mensajeCliente, tipo, respuestaBot);
  } catch (e) {
    console.error("ERROR guardando contacto:", e.message);
  }

  return res.type("text/xml").send(twiml.toString());
}

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  try {
    const msgOriginal = (req.body.Body || "").trim();
    const msg = msgOriginal.toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    const datosVecino = await buscarVecinoPorTelefono(telefono);

    if (!datosVecino) {
      return responderYLog(
        res,
        telefono,
        msgOriginal || "sin_texto",
        numMedia > 0 ? "archivo" : "texto",
        "Tu número no está en el listado inicial de la comunidad. Contacta con Instalaciones Araujo para validarlo."
      );
    }

    let expediente = await buscarExpedientePorTelefono(telefono);

    if (!expediente) {
      await crearExpedienteInicial(telefono, datosVecino);
      expediente = await buscarExpedientePorTelefono(telefono);
    }

    // ================= SI AÚN NO TIENE TIPO =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_tipo") {
      const tipo = mapTipoExpediente(msg);

      if (!tipo) {
        return responderYLog(
          res,
          telefono,
          msgOriginal || "sin_texto",
          "texto",
          buildPreguntaTipo(datosVecino.nombre)
        );
      }

      const primerPaso = getFirstStep(tipo);

      expediente.tipo_expediente = tipo;
      expediente.paso_actual = "recogida_documentacion";
      expediente.documento_actual = primerPaso ? primerPaso.code : "";
      expediente.estado_expediente = "en_proceso";
      expediente.fecha_ultimo_contacto = ahoraISO();

      await actualizarExpediente(expediente.rowIndex, expediente);

      return responderYLog(
        res,
        telefono,
        msgOriginal,
        "texto",
        `Perfecto ✅\n\nCaso identificado: ${tipo}.\n\n${primerPaso ? primerPaso.prompt : "Empezamos."}`
      );
    }

    // ================= SI ESPERA ARCHIVO Y LE MANDAN TEXTO =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion") {
      return responderYLog(
        res,
        telefono,
        msgOriginal || "sin_texto",
        "texto",
        `Ahora mismo estamos esperando este documento:\n\n${expediente.documento_actual}\n\nPuedes enviarlo por aquí 📎`
      );
    }

    // ================= SI HA TERMINADO DOCUMENTOS Y PREGUNTA FINANCIACION =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_financiacion") {
      const respuestaFin = mapFinanciacion(msg);

      if (!respuestaFin) {
        return responderYLog(
          res,
          telefono,
          msgOriginal || "sin_texto",
          "texto",
          buildPreguntaFinanciacion()
        );
      }

      if (respuestaFin === "no") {
        expediente.paso_actual = "finalizado";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        expediente.documentos_completos = "SI";
        expediente.fecha_ultimo_contacto = ahoraISO();

        await actualizarExpediente(expediente.rowIndex, expediente);

        return responderYLog(
          res,
          telefono,
          msgOriginal,
          "texto",
          "Perfecto ✅ Proceso base finalizado. Nuestro equipo revisará la documentación y te avisará si falta algo."
        );
      }

      const primerPasoFin = getFirstStep("financiacion");
      expediente.paso_actual = "recogida_financiacion";
      expediente.documento_actual = primerPasoFin.code;
      expediente.estado_expediente = "pendiente_financiacion";
      expediente.fecha_ultimo_contacto = ahoraISO();

      await actualizarExpediente(expediente.rowIndex, expediente);

      return responderYLog(
        res,
        telefono,
        msgOriginal,
        "texto",
        `Perfecto 💰\n\nVamos a estudiar la financiación.\n\n${primerPasoFin.prompt}`
      );
    }

    // ================= SI ESPERA ARCHIVOS DE FINANCIACION Y LE MANDAN TEXTO =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_financiacion") {
      return responderYLog(
        res,
        telefono,
        msgOriginal || "sin_texto",
        "texto",
        `Ahora mismo estamos esperando este documento para financiación:\n\n${expediente.documento_actual}\n\nPuedes enviarlo por aquí 📎`
      );
    }

    // ================= SI MANDA ARCHIVO =================
    if (numMedia > 0) {
      if (
        expediente.paso_actual !== "recogida_documentacion" &&
        expediente.paso_actual !== "recogida_financiacion"
      ) {
        return responderYLog(
          res,
          telefono,
          "archivo",
          "archivo",
          buildPreguntaTipo(datosVecino.nombre)
        );
      }

      const mediaUrl = req.body.MediaUrl0;
      const mimeType = req.body.MediaContentType0 || "application/octet-stream";

      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const carpetaId = await getOrCreateCarpetaTelefono(telefono);
      const extension = extensionDesdeMime(mimeType);
      const fileName = `${expediente.documento_actual || "documento"}_${telefono}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        carpetaId
      );

      await guardarDocumentoSheet(
        telefono,
        datosVecino.comunidad,
        datosVecino.vivienda,
        expediente.documento_actual || "pendiente_clasificar",
        fileName,
        file.webViewLink || "",
        "flujo"
      );

      expediente.fecha_ultimo_contacto = ahoraISO();

      // Flujo normal documentación
      if (expediente.paso_actual === "recogida_documentacion") {
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);

        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          await actualizarExpediente(expediente.rowIndex, expediente);

          return responderYLog(
            res,
            telefono,
            "archivo",
            "archivo",
            `Documento recibido correctamente ✅\n\nSeguimos:\n${siguiente.prompt}`
          );
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          await actualizarExpediente(expediente.rowIndex, expediente);

          return responderYLog(
            res,
            telefono,
            "archivo",
            "archivo",
            `Documento recibido correctamente ✅\n\n${buildPreguntaFinanciacion()}`
          );
        }
      }

      // Flujo financiación
      if (expediente.paso_actual === "recogida_financiacion") {
        const siguienteFin = getNextStep("financiacion", expediente.documento_actual);

        if (siguienteFin) {
          expediente.documento_actual = siguienteFin.code;
          await actualizarExpediente(expediente.rowIndex, expediente);

          return responderYLog(
            res,
            telefono,
            "archivo",
            "archivo",
            `Documento recibido correctamente ✅\n\nSeguimos:\n${siguienteFin.prompt}`
          );
        } else {
          expediente.paso_actual = "finalizado";
          expediente.documento_actual = "";
          expediente.estado_expediente = "pendiente_estudio_financiacion";
          expediente.documentos_completos = "SI";
          expediente.fecha_ultimo_contacto = ahoraISO();

          await actualizarExpediente(expediente.rowIndex, expediente);

          return responderYLog(
            res,
            telefono,
            "archivo",
            "archivo",
            "Perfecto ✅ Hemos recibido toda la documentación base y la de financiación. Nuestro equipo la revisará y te contactará."
          );
        }
      }
    }

    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      numMedia > 0 ? "archivo" : "texto",
      "Mensaje recibido."
    );

  } catch (error) {
    console.error("ERROR GENERAL:", error);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Ha habido un problema procesando tu mensaje.");

    return res.type("text/xml").send(twiml.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});