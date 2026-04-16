const express = require("express");
const twilio = require("twilio");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor OK");
});

app.post("/whatsapp", (req, res) => {
  const incomingMsg = req.body.Body || "";
  console.log("Mensaje recibido:", incomingMsg);

  const twiml = new twilio.twiml.MessagingResponse();
 twiml.message("Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPara el Plan 5 necesito que me envíes:\n\n- DNI\n- Escritura\n- Certificado bancario\n\nPuedes enviarlo por aquí 📎");

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});