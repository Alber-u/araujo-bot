const express = require("express");
const twilio = require("twilio");

const app = express();

app.use(express.urlencoded({ extended: false }));

// 🔐 VALIDACIÓN TWILIO
const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers["x-twilio-signature"];
  const url = process.env.PUBLIC_URL + req.originalUrl;

  const params = req.body;

  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    params
  );

  if (!isValid) {
    return res.status(403).send("Forbidden");
  }

  next();
};

// 🔵 Endpoint principal
app.post("/whatsapp", validateTwilioRequest, (req, res) => {
  const incomingMsg = req.body.Body || "";

  console.log("Mensaje recibido:", incomingMsg);

  const twiml = new twilio.twiml.MessagingResponse();

  twiml.message("Hola 👋 Soy Instalaciones Araujo. Te ayudo con la documentación del Plan 5. ¿Qué necesitas?");

  res.type("text/xml");
  res.send(twiml.toString());
});

// 🟢 health check
app.get("/", (req, res) => {
  res.send("Servidor OK");
});

app.listen(3000, () => {
  console.log("🚀 Servidor corriendo en puerto 3000");
});