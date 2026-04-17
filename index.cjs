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
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: "v3", auth });
}

// ================= DRIVE =================
async function uploadToDrive(fileBuffer, fileName, mimeType) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [(process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim()],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
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

    // 1) saludo simple
    if (msg.includes("hola") && numMedia === 0) {
      console.log("Respondiendo saludo...");

      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎"
      );

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // 2) si manda archivo, lo guardamos en Drive
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

      const safePhone = telefono.replace(/[^\d+]/g, "_");
      const fileName = `doc_${safePhone}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType
      );

      console.log("Archivo subido a Drive:", file);

      twiml.message(
        "📄 Documento recibido correctamente.\n\nYa lo hemos guardado para revisión."
      );

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // 3) cualquier otro texto
    twiml.message(
      "Te he leído 👍\n\nEn este momento puedes decir 'hola' o enviarme documentación por aquí 📎"
    );

  } catch (error) {
    console.error(
      "ERROR en /whatsapp:",
      error?.response?.data || error?.message || error
    );

    twiml.message(
      "⚠️ Ha habido un problema procesando tu mensaje."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});