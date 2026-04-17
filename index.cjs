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

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.status(200).send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    console.log("Mensaje recibido:", {
      telefono,
      msg,
      numMedia,
    });

    const twiml = new twilio.twiml.MessagingResponse();

    // 1) SALUDO
    if (numMedia === 0 && (msg === "hola" || msg.includes("hola"))) {
      twiml.message(
        "Hola. Soy el asistente de Instalaciones Araujo. Puedes enviarme documentacion por aqui."
      );

      const respuesta = twiml.toString();
      console.log("TwiML saludo:", respuesta);

      return res.status(200).type("text/xml").send(respuesta);
    }

    // 2) SI MANDA ARCHIVO
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

      twiml.message("Documento recibido correctamente. Ya lo hemos guardado para revision.");

      const respuesta = twiml.toString();
      console.log("TwiML archivo:", respuesta);

      return res.status(200).type("text/xml").send(respuesta);
    }

    // 3) CUALQUIER OTRO TEXTO
    twiml.message(
      "Te he leido. Escribe hola o envia documentacion."
    );

    const respuesta = twiml.toString();
    console.log("TwiML texto:", respuesta);

    return res.status(200).type("text/xml").send(respuesta);

  } catch (error) {
    console.error("ERROR en /whatsapp:", error?.response?.data || error?.message || error);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Ha habido un problema procesando tu mensaje.");

    const respuesta = twiml.toString();
    console.log("TwiML error:", respuesta);

    return res.status(200).type("text/xml").send(respuesta);
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});