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

// 🔍 Buscar carpeta por nombre
async function buscarCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });

  return res.data.files[0] || null;
}

// 📁 Crear carpeta
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

// 📁 Obtener o crear carpeta por teléfono
async function getOrCreateCarpetaTelefono(telefono) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  let carpeta = await buscarCarpeta(telefono, rootId);

  if (!carpeta) {
    console.log("Creando carpeta para:", telefono);
    carpeta = await crearCarpeta(telefono, rootId);
  }

  return carpeta.id;
}

// 📄 Subir archivo a carpeta
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

// ================= RUTAS =================

app.get("/", (req, res) => {
  res.send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    console.log("Mensaje:", telefono, msg);

    // 👋 SALUDO
    if (msg.includes("hola")) {
      twiml.message("Hola 👋 Soy el asistente. Puedes enviarme documentación por aquí 📎");
      return res.type("text/xml").send(twiml.toString());
    }

    // 📎 ARCHIVO
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mimeType = req.body.MediaContentType0;

      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      // 📁 carpeta automática por teléfono
      const carpetaId = await getOrCreateCarpetaTelefono(telefono);

      const fileName = `doc_${Date.now()}`;

      await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        carpetaId
      );

      twiml.message("📄 Documento guardado correctamente");
      return res.type("text/xml").send(twiml.toString());
    }

    // 💬 TEXTO
    twiml.message("Te he leído 👍");
    return res.type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error(error);

    twiml.message("⚠️ Error procesando el mensaje");
    return res.type("text/xml").send(twiml.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});