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

// ================= DRIVE =================
function getDriveClient() {
  return google.drive({
    version: "v3",
    auth: getGoogleAuth(),
  });
}

// ================= SHEETS =================
function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
}

// ================= DRIVE HELPERS =================
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
    fields: "id, name",
  });

  return file.data;
}

// ================= SHEETS HELPERS =================
async function guardarEnSheets(telefono, mensaje, tipo) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos_base!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        new Date().toISOString(),
        telefono,
        mensaje,
        tipo
      ]]
    }
  });

  console.log("Guardado en Sheets");
}

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.send("Servidor OK");
});

// ================= WHATSAPP =================
app.post("/whatsapp", async (req, res) => {

  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    console.log("Mensaje recibido:", {
      telefono,
      msg,
      numMedia
    });

    // ================= RESPUESTA INMEDIATA =================
    if (numMedia === 0 && msg.includes("hola")) {
      twiml.message("Hola 👋 Soy el asistente de Instalaciones Araujo. Puedes enviarme documentación por aquí.");
    } 
    else if (numMedia > 0) {
      twiml.message("Documento recibido correctamente. Ya lo hemos guardado para revisión.");
    } 
    else {
      twiml.message("Te he leído. Puedes enviar documentación o escribir hola.");
    }

    // 👉 RESPONDER SIEMPRE A TWILIO
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());

    // ================= PROCESOS EN BACKGROUND =================

    // 📁 DRIVE
    if (numMedia > 0) {
      try {
        const mediaUrl = req.body.MediaUrl0;
        const mimeType = req.body.MediaContentType0 || "application/octet-stream";

        const response = await axios.get(mediaUrl, {
          responseType: "arraybuffer",
          auth: {
            username: process.env.TWILIO_ACCOUNT_SID,
            password: process.env.TWILIO_AUTH_TOKEN,
          },
        });

        const extension =
          mimeType === "image/jpeg" ? ".jpg" :
          mimeType === "image/png" ? ".png" :
          mimeType === "application/pdf" ? ".pdf" :
          "";

        const carpetaId = await getOrCreateCarpetaTelefono(telefono);
        const fileName = `doc_${telefono}_${Date.now()}${extension}`;

        const file = await uploadToDrive(
          Buffer.from(response.data),
          fileName,
          mimeType,
          carpetaId
        );

        console.log("Archivo subido a Drive:", file);

      } catch (e) {
        console.error("ERROR DRIVE:", e.message);
      }
    }

    // 📊 SHEETS
    try {
      await guardarEnSheets(
        telefono,
        msg || "archivo",
        numMedia > 0 ? "archivo" : "texto"
      );
    } catch (e) {
      console.error("ERROR SHEETS:", e.message);
    }

  } catch (error) {
    console.error("ERROR GENERAL:", error.message);

    // 👉 SIEMPRE RESPONDER AUNQUE FALLE TODO
    const fallback = new twilio.twiml.MessagingResponse();
    fallback.message("Mensaje recibido.");

    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(fallback.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});