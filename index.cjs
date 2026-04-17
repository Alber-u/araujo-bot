const express = require("express");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(express.urlencoded({ extended: false }));

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

app.get("/", (req, res) => {
  res.send("Servidor OK");
});

// GOOGLE AUTH
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

// DRIVE
function getDriveClient() {
  const auth = getGoogleAuth();

  return google.drive({
    version: "v3",
    auth,
  });
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
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return file.data;
}

// SHEETS
function getSheetsClient() {
  const auth = getGoogleAuth();

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function buscarVecinoPorTelefono(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "vecinos!A2:G",
  });

  const filas = res.data.values || [];

  for (const fila of filas) {
    if ((fila[0] || "").trim() === telefono.trim()) {
      return {
        telefono: fila[0] || "",
        id_comunidad: fila[1] || "",
        comunidad_oficial: fila[2] || "",
        bloque: fila[3] || "",
        vivienda: fila[4] || "",
        carpeta_drive_id: fila[5] || "",
        estado: fila[6] || "",
      };
    }
  }

  return null;
}

async function guardarVecinoEnHoja(data) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "vecinos!A:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.telefono,
        data.id_comunidad,
        data.comunidad_oficial,
        data.bloque || "",
        data.vivienda,
        data.carpeta_drive_id || "",
        data.estado || "activo",
      ]],
    },
  });
}

// WHATSAPP
app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const from = req.body.From || "";
    const telefono = from.replace("whatsapp:", "");

    const vecino = await buscarVecinoPorTelefono(telefono);

    // Si no está registrado y manda texto
    if (!vecino && numMedia === 0) {
      if (msg.includes("hola")) {
        twiml.message(
          "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nAntes de continuar, necesito registrarte.\n\nIndícame por favor:\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
        );
      } else {
        twiml.message(
          "Para poder registrarte necesito que me indiques:\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
        );
      }
    }

    // Si no está registrado y manda archivo
    else if (!vecino && numMedia > 0) {
      twiml.message(
        "He recibido tu archivo 📎, pero antes de guardarlo necesito registrarte.\n\nIndícame por favor:\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
      );
    }

    // Si ya está registrado y manda archivo
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

      console.log("Archivo subido a Drive:", file);

      twiml.message(
        `📄 Documento recibido correctamente.\n\nLo hemos guardado en el expediente de ${vecino.comunidad_oficial} ${vecino.bloque ? "- " + vecino.bloque : ""} ${vecino.vivienda}.`
      );
    }

    // Si ya está registrado y escribe texto
    else if (vecino && numMedia === 0) {
      twiml.message(
        `Hola de nuevo 👋\n\nTe tengo identificado en:\n${vecino.comunidad_oficial}${vecino.bloque ? " - " + vecino.bloque : ""}\nVivienda: ${vecino.vivienda}\n\nPuedes enviarme documentación por aquí 📎`
      );
    }

    else {
      twiml.message(
        "No he entendido tu mensaje 🤔"
      );
    }
  } catch (error) {
    console.error(
      "Error en /whatsapp:",
      error?.response?.data || error?.message || error
    );

    twiml.message(
      "⚠️ Ha habido un problema procesando tu mensaje."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});