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

// 🔹 DRIVE
function getDriveClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/drive.file"]
  );

  return google.drive({ version: "v3", auth });
}

async function uploadToDrive(buffer, fileName, mimeType) {
  const drive = getDriveClient();

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
    const numMedia = parseInt(req.body.NumMedia || "0");

    // SALUDO
    if (msg.includes("hola")) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPara el Plan 5 necesito:\n\n- DNI\n- Escritura\n- Certificado bancario\n\nPuedes enviarlo por aquí 📎"
      );
    }

    // SI HAY ARCHIVO
    else if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mimeType = req.body.MediaContentType0;

      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const fileName = `doc_${Date.now()}`;

      await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType
      );

      twiml.message(
        "📄 Documento recibido correctamente.\n\nYa lo hemos guardado para revisión."
      );
    }

    // OTRO TEXTO
    else {
      twiml.message(
        "No he entendido tu mensaje 🤔\n\nEscribe 'hola' o envía la documentación."
      );
    }

  } catch (error) {
    console.error(error);

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