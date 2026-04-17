const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= GOOGLE =================

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

function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: "v4", auth });
}

// ================= FUNCIONES =================

async function buscarVecinoPorTelefono(telefono) {
  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: (process.env.GOOGLE_SHEETS_ID || "").trim(),
      range: "vecinos!A2:G",
    });

    const rows = response.data.values || [];

    for (const row of rows) {
      if ((row[0] || "").trim() === telefono.trim()) {
        return {
          comunidad: row[2],
          vivienda: row[4],
        };
      }
    }

    return null;

  } catch (error) {
    console.error("Error leyendo Sheets:", error.message);
    return null; // MUY IMPORTANTE: no romper flujo
  }
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
    const from = req.body.From || "";
    const telefono = from.replace("whatsapp:", "");

    console.log("Mensaje recibido:", { telefono, msg });

    // ================= SALUDO (SIN GOOGLE) =================
    if (msg.includes("hola")) {
      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎\n\nSi aún no estás registrado, te iré pidiendo comunidad y vivienda."
      );

      return res.type("text/xml").send(twiml.toString());
    }

    // ================= AQUI YA USAMOS GOOGLE =================
    const vecino = await buscarVecinoPorTelefono(telefono);

    if (!vecino) {
      twiml.message(
        "Para registrarte necesito:\n\n- Comunidad\n- Vivienda\n\nEjemplo:\nEstrella Aldebarán 4\n1A"
      );
    } else {
      twiml.message(
        `Te tengo registrado en:\n${vecino.comunidad}\nVivienda: ${vecino.vivienda}`
      );
    }

  } catch (error) {
    console.error("ERROR GLOBAL:", error.message);

    twiml.message("⚠️ Error interno. Inténtalo de nuevo.");
  }

  res.type("text/xml").send(twiml.toString());
});

// ================= SERVER =================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});