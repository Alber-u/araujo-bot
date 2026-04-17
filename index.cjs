const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// =========================
// GOOGLE AUTH
// =========================
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });
const sheets = google.sheets({ version: "v4", auth: oauth2Client });

// =========================
// BUSCAR VECINO
// =========================
async function buscarVecinoPorTelefono(telefono) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos!A2:G",
  });

  const rows = response.data.values || [];

  for (let row of rows) {
    if (row[0] === telefono) {
      return {
        telefono: row[0],
        comunidad_oficial: row[1],
        bloque: row[2],
        vivienda: row[3],
      };
    }
  }

  return null;
}

// =========================
// SUBIR A DRIVE
// =========================
async function uploadToDrive(fileBuffer, fileName, mimeType) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: mimeType,
    body: Buffer.from(fileBuffer),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id, webViewLink",
  });

  return file.data;
}

// =========================
// WEBHOOK WHATSAPP
// =========================
app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const from = req.body.From || "";
    const telefono = from.replace("whatsapp:", "");

    // ✅ SALUDO SIN DEPENDER DE SHEETS
    if (msg.includes("hola") && numMedia === 0) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎\n\nSi aún no estás registrado, te iré pidiendo comunidad y vivienda."
      );

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // 🔹 A PARTIR DE AQUÍ YA USAMOS SHEETS
    const vecino = await buscarVecinoPorTelefono(telefono);

    if (!vecino && numMedia === 0) {
      twiml.message(
        "Para poder registrarte necesito que me indiques:\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
      );
    }

    else if (!vecino && numMedia > 0) {
      twiml.message(
        "He recibido tu archivo 📎, pero antes de guardarlo necesito registrarte.\n\nIndícame:\n- Comunidad\n- Vivienda"
      );
    }

    else if (vecino && numMedia > 0) {
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
    }

    else if (vecino && numMedia === 0) {
      twiml.message(
        `Hola de nuevo 👋\n\nTe tengo en:\n${vecino.comunidad_oficial}\nVivienda: ${vecino.vivienda}`
      );
    }

    else {
      twiml.message("No he entendido tu mensaje 🤔");
    }

  } catch (error) {
    console.error("ERROR:", error?.response?.data || error.message);

    twiml.message(
      "⚠️ Ha habido un problema procesando tu mensaje."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});