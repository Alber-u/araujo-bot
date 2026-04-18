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

// ================= CLIENTES GOOGLE =================
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

function normalizarTelefono(telefono) {
  return (telefono || "").replace(/\s/g, "").trim();
}

function nombreArchivoDesdeMime(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/heic") return ".heic";
  return "";
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
    console.log("Creando carpeta para:", telefono);
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

// ================= SHEETS - CONTACTOS =================
async function guardarContacto(telefono, mensaje, tipo) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "contactos!A:D",
    valueInputOption: "RAW",
    requestBody: {
      values: [[ahoraISO(), telefono, mensaje, tipo]],
    },
  });

  console.log("Guardado en contactos");
}

// ================= SHEETS - EXPEDIENTES =================
async function buscarFilaExpedientePorTelefono(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:J",
  });

  const rows = res.data.values || [];
  const telNormalizado = normalizarTelefono(telefono);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const telFila = normalizarTelefono(row[0] || "");

    if (telFila === telNormalizado) {
      return i + 1; // número real de fila
    }
  }

  return null;
}

async function crearOActualizarExpediente(telefono, datosVecino) {
  const sheets = getSheetsClient();
  const filaExistente = await buscarFilaExpedientePorTelefono(telefono);
  const ahora = ahoraISO();

  const values = [[
    telefono,
    datosVecino?.comunidad || "",
    datosVecino?.vivienda || "",
    datosVecino?.nombre || "",
    "", // tipo_expediente
    "pendiente_documentacion", // estado_expediente
    ahora, // fecha_inicio
    ahora, // fecha_ultimo_contacto
    "NO", // documentos_completos
    "", // observaciones
  ]];

  if (filaExistente) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `expedientes!A${filaExistente}:J${filaExistente}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log("Expediente actualizado");
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:J",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log("Expediente creado");
  }
}

// ================= SHEETS - DOCUMENTOS =================
async function guardarDocumentoSheet(telefono, tipoDocumento, recibido, urlDrive) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "documentos!A:E",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        telefono,
        tipoDocumento,
        recibido,
        ahoraISO(),
        urlDrive || "",
      ]],
    },
  });

  console.log("Documento registrado en sheets");
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

    console.log("Mensaje recibido:", {
      telefono,
      msg,
      numMedia,
    });

    const twiml = new twilio.twiml.MessagingResponse();

    // Buscar vecino
    let datosVecino = null;
    try {
      datosVecino = await buscarVecinoPorTelefono(telefono);
      if (datosVecino) {
        console.log("Vecino identificado:", datosVecino);
      } else {
        console.log("Teléfono no encontrado en vecinos_base");
      }
    } catch (e) {
      console.error("ERROR buscando vecino:", e.message);
    }

    // Crear/actualizar expediente
    try {
      await crearOActualizarExpediente(telefono, datosVecino);
    } catch (e) {
      console.error("ERROR expediente:", e.message);
    }

    // ================= TEXTO =================
    if (numMedia === 0) {
      if (datosVecino) {
        twiml.message(
          `Hola ${datosVecino.nombre || ""} 👋 Soy el asistente de Instalaciones Araujo. Puedes enviarme la documentación de tu vivienda ${datosVecino.vivienda || ""}.`
        );
      } else {
        twiml.message(
          "Hola 👋 Soy el asistente de Instalaciones Araujo. Puedes enviarme documentación por aquí."
        );
      }

      try {
        await guardarContacto(telefono, msgOriginal || "texto", "texto");
      } catch (e) {
        console.error("ERROR contactos:", e.message);
      }

      return res.type("text/xml").send(twiml.toString());
    }

    // ================= ARCHIVO =================
    if (numMedia > 0) {
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
      const extension = nombreArchivoDesdeMime(mimeType);
      const fileName = `doc_${telefono}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        carpetaId
      );

      console.log("Archivo subido a Drive:", file);

      try {
        await guardarContacto(telefono, "archivo", "archivo");
      } catch (e) {
        console.error("ERROR contactos:", e.message);
      }

      try {
        await guardarDocumentoSheet(
          telefono,
          "pendiente_clasificar",
          "SI",
          file.webViewLink || ""
        );
      } catch (e) {
        console.error("ERROR documentos:", e.message);
      }

      if (datosVecino) {
        twiml.message(`Documento recibido correctamente, ${datosVecino.nombre} ✅`);
      } else {
        twiml.message("Documento recibido correctamente. Ya lo hemos guardado para revisión.");
      }

      return res.type("text/xml").send(twiml.toString());
    }

    // fallback
    twiml.message("Mensaje recibido.");
    return res.type("text/xml").send(twiml.toString());

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