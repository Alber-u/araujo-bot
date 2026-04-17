const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= RUTA PRINCIPAL =================

app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const msg = (req.body.Body || "").trim().toLowerCase();
    const from = req.body.From || "";
    const telefono = from.replace("whatsapp:", "");

    console.log("Mensaje recibido:", { telefono, msg });

    // 🔥 SALUDO (SIN NADA MÁS)
    if (msg.includes("hola")) {
      console.log("Respondiendo saludo...");

      twiml.message(
        "Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPuedes enviarme documentación por aquí 📎\n\nSi aún no estás registrado, te iré pidiendo comunidad y vivienda."
      );

      return res.type("text/xml").send(twiml.toString());
    }

    // 🔥 RESPUESTA SIMPLE
    twiml.message("Recibido 👍");

  } catch (error) {
    console.error("ERROR:", error);
    twiml.message("⚠️ Error interno");
  }

  res.type("text/xml").send(twiml.toString());
});

// ================= SERVIDOR =================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});