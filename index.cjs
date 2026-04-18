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

function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
}

// ================= BUSCAR VECINO =================
async function buscarVecino(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos_base!A:E",
  });

  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const tel = row[4];

    if (tel && tel.replace(/\s/g, "") === telefono) {
      return {
        comunidad: row[0],
        bloque: row[1],
        vivienda: row[2],
        nombre: row[3],
        telefono: row[4],
      };
    }
  }

  return null;
}

// ================= GUARDAR LOG =================
async function guardarContacto(telefono, mensaje, tipo) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "contactos!A:D",
    valueInputOption: "RAW",
    requestBody: {
      values: [[new Date().toISOString(), telefono, mensaje, tipo]],
    },
  });

  console.log("Guardado en contactos");
}

// ================= DRIVE =================
async function getOrCreateCarpetaTelefono(telefono) {
  const drive = getDriveClient();
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${telefono}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });

  let carpeta = res.data.files[0];

  if (!carpeta) {
    carpeta = await drive.files.create({
      requestBody: {
        name: telefono,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId],
      },
      fields: "id",
    });
  }

  return carpeta.id;
}

async function uploadToDrive(buffer, fileName, mimeType, carpetaId) {
  const drive = getDriveClient();

  return await drive.files.create({
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
}

// ================= WHATSAPP =================
app.post("/whatsapp", async (req, res) => {
  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0");
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    console.log("Mensaje recibido:", telefono, msg);

    const vecino = await buscarVecino(telefono);

    const twiml = new twilio.twiml.MessagingResponse();

    // ================= TEXTO =================
    if (numMedia === 0) {
      if (vecino) {
        twiml.message(
          `Hola ${vecino.nombre} 👋 Soy el asistente de Instalaciones Araujo. Puedes enviarme la documentación de tu vivienda ${vecino.vivienda}.`
        );
      } else {
        twiml.message(
          "Hola 👋 Soy el asistente de Instalaciones Araujo. Envíame la documentación por aquí."
        );
      }

      await guardarContacto(telefono, msg, "texto");

      return res.type("text/xml").send(twiml.toString());
    }

    // ================= ARCHIVOS =================
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

      const carpetaId = await getOrCreateCarpetaTelefono(telefono);

      const fileName = `doc_${telefono}_${Date.now()}`;

      await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        carpetaId
      );

      if (vecino) {
        twiml.message(
          `Documento recibido correctamente, ${vecino.nombre} ✅`
        );
      } else {
        twiml.message(
          "Documento recibido correctamente. Ya lo hemos guardado para revisión."
        );
      }

      await guardarContacto(telefono, "archivo", "archivo");

      return res.type("text/xml").send(twiml.toString());
    }

  } catch (error) {
    console.error("ERROR:", error);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Ha habido un problema procesando tu mensaje.");

    return res.type("text/xml").send(twiml.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});