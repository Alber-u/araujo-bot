const express = require("express");
const twilio = require("twilio");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor OK");
});

app.post("/whatsapp", (req, res) => {
  const incomingMsg = req.body.Body?.toLowerCase() || "";
  const numMedia = parseInt(req.body.NumMedia || "0");

  const twiml = new twilio.twiml.MessagingResponse();

  if (incomingMsg.includes("hola")) {
    twiml.message("Hola 👋 Soy el asistente de Instalaciones Araujo.\n\nPara el Plan 5 necesito que me envíes:\n\n- DNI\n- Escritura\n- Certificado bancario\n\nPuedes enviarlo por aquí 📎");
  
  } else if (numMedia > 0) {
    twiml.message("📄 Documento recibido correctamente.\n\nLo estamos revisando y te avisaremos si falta algo.");
  
  } else {
    twiml.message("No he entendido tu mensaje 🤔\n\nPuedes enviarme la documentación o escribir 'hola' para empezar.");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});