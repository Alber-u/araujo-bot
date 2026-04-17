const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= GOOGLE =================
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

// ================= DRIVE HELPERS =================
async function buscarCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
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
    supportsAllDrives: true,
  });

  return file.data;
}

async function getOrCreateCarpetaTelefono(telefono) {
  const rootId = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();

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
    supportsAllDrives: true,
  });

  return file.data;
}

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.status(200).send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const from = req.body.From || "";
    const telefono = from.replace("whatsapp:", "");

    console.log("Mensaje recibido en /whatsapp:", {
      from,
      telefono,
      msg,
      numMedia,
    });

    // 1) SALUDO
    if (numMedia === 0 && msg.includes("hola")) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎"
      );

      return res.type("text/xml").send(twiml.toString());
    }

    // 2) ARCHIVO
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

      const extension =
        mimeType === "image/jpeg" ? ".jpg" :
        mimeType === "image/png" ? ".png" :
        mimeType === "application/pdf" ? ".pdf" :
        mimeType === "image/heic" ? ".heic" :
        "";

      const carpetaId = await getOrCreateCarpetaTelefono(telefono);
      const safePhone = telefono.replace(/[^\d+]/g, "_");
      const fileName = `doc_${safePhone}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        carpetaId
      );

      console.log("Archivo subido a Drive:", file);

      twiml.message(
        "📄 Documento recibido correctamente.\n\nYa lo hemos guardado para revisión."
      );

      return res.type("text/xml").send(twiml.toString());
    }

    // 3) OTRO TEXTO
    twiml.message(
      "Te he leído 👍\n\nEscribe 'hola' o envíame documentación por aquí 📎"
    );

    return res.type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error(
      "ERROR en /whatsapp:",
      error?.response?.data || error?.message || error
    );

    twiml.message("⚠️ Ha habido un problema procesando tu mensaje.");
    return res.type("text/xml").send(twiml.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});