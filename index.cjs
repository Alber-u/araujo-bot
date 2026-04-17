try {
  require("dotenv").config();
} catch (e) {}

const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

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

// ================= TWILIO SEND =================
async function enviarWhatsapp(to, body) {
  const msg = await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to,
    body,
  });

  console.log("Mensaje enviado por API:", {
    sid: msg.sid,
    status: msg.status,
    to: msg.to,
  });

  return msg;
}

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.status(200).send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  const from = req.body.From || "";
  const telefono = from.replace("whatsapp:", "");
  const msg = (req.body.Body || "").trim().toLowerCase();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  console.log("Mensaje recibido en /whatsapp:", {
    from,
    telefono,
    msg,
    numMedia,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    hasGoogleDriveFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
  });

  // Respondemos 200 rápido a Twilio para evitar reintentos/timeout
  res.status(200).send("ok");

  try {
    // 1) SALUDO
    if (numMedia === 0 && msg.includes("hola")) {
      await enviarWhatsapp(
        from,
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎"
      );
      return;
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

      await enviarWhatsapp(
        from,
        "📄 Documento recibido correctamente.\n\nYa lo hemos guardado para revisión."
      );
      return;
    }

    // 3) OTRO TEXTO
    await enviarWhatsapp(
      from,
      "Te he leído 👍\n\nEscribe 'hola' o envíame documentación por aquí 📎"
    );
  } catch (error) {
    console.error(
      "ERROR en /whatsapp:",
      error?.response?.data || error?.message || error
    );

    try {
      await enviarWhatsapp(
        from,
        "⚠️ Ha habido un problema procesando tu mensaje."
      );
    } catch (sendError) {
      console.error(
        "ERROR enviando respuesta por API:",
        sendError?.response?.data || sendError?.message || sendError
      );
    }
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});