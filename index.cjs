const express = require("express");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("Servidor OK");
});

// 🔹 DRIVE con OAuth token
async function getDriveClient() {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
  });

  return google.drive({
    version: "v3",
    auth,
  });
}

async function uploadToDrive(buffer, fileName, mimeType) {
  const drive = await getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, name",
  });

  return file.data;
}

// 🔹 WHATSAPP
app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);

    if (msg.includes("hola")) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPara el Plan 5 necesito:\n\n- DNI\n- Escritura\n- Certificado bancario\n\nPuedes enviarlo por aquí 📎"
      );
    } else if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mimeType = req.body.MediaContentType0 || "application/octet-stream";

      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const fileName = `doc_${Date.now()}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType
      );

      console.log("Archivo subido a Drive:", file);

      twiml.message(
        "📄 Documento recibido correctamente.\n\nYa lo hemos guardado para revisión."
      );
    } else {
      twiml.message(
        "No he entendido tu mensaje 🤔\n\nEscribe 'hola' o envía la documentación."
      );
    }
  } catch (error) {
    console.error("Error en /whatsapp:", error?.response?.data || error.message || error);

    twiml.message(
      "⚠️ He recibido tu mensaje pero ha habido un problema guardando el archivo."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});
});