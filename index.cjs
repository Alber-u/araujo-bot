const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

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

function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: "v4", auth });
}

async function buscarVecinoPorTelefono(telefono) {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: (process.env.GOOGLE_SHEETS_ID || "").trim(),
    range: "vecinos!A2:G",
  });

  const rows = response.data.values || [];

  for (const row of rows) {
    if ((row[0] || "").trim() === telefono.trim()) {
      return {
        telefono: row[0] || "",
        id_comunidad: row[1] || "",
        comunidad_oficial: row[2] || "",
        bloque: row[3] || "",
        vivienda: row[4] || "",
        carpeta_drive_id: row[5] || "",
        estado: row[6] || "",
      };
    }
  }

  return null;
}

async function uploadToDrive(fileBuffer, fileName, mimeType) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [(process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim()],
    },
    media: {
      mimeType,
      body: Buffer.from(fileBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return file.data;
}

// Ruta de prueba para navegador
app.get("/", (req, res) => {
  res.status(200).send("Servidor OK");
});

// Webhook de Twilio
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

    // Saludo siempre, sin depender de Sheets
    if (msg.includes("hola") && numMedia === 0) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎\n\nSi aún no estás registrado, te iré pidiendo comunidad y vivienda."
      );

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // A partir de aquí, usamos Sheets
    const vecino = await buscarVecinoPorTelefono(telefono);

    if (!vecino && numMedia === 0) {
      twiml.message(
        "Para poder registrarte necesito que me indiques:\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
      );
    } else if (!vecino && numMedia > 0) {
      twiml.message(
        "He recibido tu archivo 📎, pero antes de guardarlo necesito registrarte.\n\nIndícame:\n- Comunidad\n- Vivienda"
      );
    } else if (vecino && numMedia > 0) {
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

      const safeVivienda = (vecino.vivienda || "sin_vivienda").replace(/[^\w.-]/g, "_");
      const fileName = `doc_${safeVivienda}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType
      );

      console.log("Archivo subido:", file);

      twiml.message(
        `📄 Documento guardado en:\n${vecino.comunidad_oficial} ${vecino.vivienda}`
      );
    } else if (vecino && numMedia === 0) {
      twiml.message(
        `Hola de nuevo 👋\n\nTe tengo en:\n${vecino.comunidad_oficial}\nVivienda: ${vecino.vivienda}`
      );
    } else {
      twiml.message("No he entendido tu mensaje 🤔");
    }
  } catch (error) {
    console.error("ERROR en /whatsapp:", error?.response?.data || error?.message || error);

    twiml.message("⚠️ Ha habido un problema procesando tu mensaje.");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});