try {
  require("dotenv").config();
} catch (e) {}

const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

const SHEET_ID = (process.env.GOOGLE_SHEETS_ID || "").trim();

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

// ================= NORMALIZACION =================
function normalizeText(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComunidad(text) {
  return normalizeText(text).toUpperCase();
}

function normalizeVivienda(text) {
  return normalizeText(text)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(\d+)[ºO]?([A-Z])$/, "$1$2");
}

function sanitizeFileName(text) {
  return normalizeText(text).replace(/[^\w.\- ]/g, "_");
}

function parseRegistroMessage(msg) {
  const original = (msg || "").trim();

  if (!original) return null;

  // Caso 1: dos lineas -> comunidad / vivienda
  const lines = original
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    const comunidadOriginal = lines[0];
    const viviendaOriginal = lines[1];

    return {
      comunidadOriginal,
      comunidadNormalizada: normalizeComunidad(comunidadOriginal),
      viviendaOriginal,
      viviendaNormalizada: normalizeVivienda(viviendaOriginal),
    };
  }

  // Caso 2: ultima palabra = vivienda, resto = comunidad
  const parts = original.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const viviendaOriginal = parts[parts.length - 1];
    const comunidadOriginal = parts.slice(0, -1).join(" ");

    return {
      comunidadOriginal,
      comunidadNormalizada: normalizeComunidad(comunidadOriginal),
      viviendaOriginal,
      viviendaNormalizada: normalizeVivienda(viviendaOriginal),
    };
  }

  return null;
}

// ================= TWILIO SEND =================
async function enviarWhatsapp(to, body) {
  const msg = await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to,
    body,
  });

  console.log("Mensaje enviado por API:", {
    sid: msg.sid,
    status: msg.status,
    to: msg.to,
  });

  return msg;
}

// ================= DRIVE HELPERS =================
async function buscarCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return res.data.files[0] || null;
}

async function crearCarpeta(nombre, parentId) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, name",
    supportsAllDrives: true,
  });

  return file.data;
}

async function getOrCreateCarpeta(nombre, parentId) {
  let carpeta = await buscarCarpeta(nombre, parentId);

  if (!carpeta) {
    console.log("Creando carpeta:", nombre, "en", parentId);
    carpeta = await crearCarpeta(nombre, parentId);
  }

  return carpeta.id;
}

async function uploadToDrive(buffer, fileName, mimeType, carpetaId) {
  const drive = getDriveClient();

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [carpetaId],
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

// ================= SHEETS HELPERS =================
async function buscarRegistroPorTelefono(telefono) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "registros!A2:P",
  });

  const rows = res.data.values || [];

  for (const row of rows) {
    if ((row[0] || "").trim() === telefono.trim()) {
      return {
        telefono_whatsapp: row[0] || "",
        telefono_validado: row[1] || "",
        comunidad_original: row[2] || "",
        comunidad_normalizada: row[3] || "",
        bloque_original: row[4] || "",
        bloque_normalizado: row[5] || "",
        vivienda_original: row[6] || "",
        vivienda_normalizada: row[7] || "",
        titular_nombre: row[8] || "",
        relacion_con_inmueble: row[9] || "",
        expediente_id: row[10] || "",
        carpeta_comunidad_id: row[11] || "",
        carpeta_vivienda_id: row[12] || "",
        acceso_autorizado: row[13] || "",
        fecha_alta: row[14] || "",
        observaciones: row[15] || "",
      };
    }
  }

  return null;
}

async function appendRegistro(data) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "registros!A:P",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.telefono_whatsapp,
        data.telefono_validado,
        data.comunidad_original,
        data.comunidad_normalizada,
        data.bloque_original || "",
        data.bloque_normalizado || "",
        data.vivienda_original,
        data.vivienda_normalizada,
        data.titular_nombre || "",
        data.relacion_con_inmueble || "",
        data.expediente_id,
        data.carpeta_comunidad_id,
        data.carpeta_vivienda_id,
        data.acceso_autorizado,
        data.fecha_alta,
        data.observaciones || "",
      ]],
    },
  });
}

async function appendExpediente(data) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "expedientes!A:AE",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.expediente_id,                  // A
        data.telefono_whatsapp,             // B
        data.comunidad_normalizada,         // C
        data.bloque_normalizado || "",      // D
        data.vivienda_normalizada,          // E
        "PENDIENTE_DE_DEFINIR",             // F tipo_expediente
        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", // G:Y
        "ALTA INICIAL",                     // Z estado_expediente
        "", "", "", "",                     // AA:AD fechas
        "",                                 // AE notas
      ]],
    },
  });
}

// ================= RUTAS =================
app.get("/", (req, res) => {
  res.status(200).send("Servidor OK");
});

app.post("/whatsapp", async (req, res) => {
  const from = req.body.From || "";
  const telefono = from.replace("whatsapp:", "");
  const msg = (req.body.Body || "").trim();
  const msgLower = msg.toLowerCase();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  console.log("Mensaje recibido en /whatsapp:", {
    from,
    telefono,
    msg,
    numMedia,
    hasSheetsId: !!SHEET_ID,
  });

  // Respondemos 200 rápido a Twilio
  res.status(200).send("ok");

  try {
    let registro = await buscarRegistroPorTelefono(telefono);

    // 1) HOLA
    if (numMedia === 0 && msgLower.includes("hola")) {
      if (registro && registro.acceso_autorizado === "si") {
        await enviarWhatsapp(
          from,
          `Hola 👋 Ya te tengo identificado en:\n${registro.comunidad_normalizada}\nVivienda: ${registro.vivienda_normalizada}\n\nPuedes enviarme documentación por aquí 📎`
        );
      } else {
        await enviarWhatsapp(
          from,
          "Hola 👋 Para registrarte necesito que me indiques:\n\n- Comunidad\n- Vivienda\n\nPuedes escribirlo así:\nEstrella Aldebarán 4 1A"
        );
      }
      return;
    }

    // 2) SI NO ESTÁ REGISTRADO Y MANDA TEXTO -> INTENTAR ALTA
    if (!registro && numMedia === 0) {
      const parsed = parseRegistroMessage(msg);

      if (!parsed) {
        await enviarWhatsapp(
          from,
          "No he podido identificar tu comunidad y vivienda.\n\nEscríbelo así:\nEstrella Aldebarán 4 1A"
        );
        return;
      }

      const rootId = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();
      const carpetaComunidadId = await getOrCreateCarpeta(
        parsed.comunidadNormalizada,
        rootId
      );

      const carpetaViviendaId = await getOrCreateCarpeta(
        parsed.viviendaNormalizada,
        carpetaComunidadId
      );

      const expedienteId = `EXP_${Date.now()}_${telefono.replace(/[^\d]/g, "")}`;

      const nuevoRegistro = {
        telefono_whatsapp: telefono,
        telefono_validado: telefono,
        comunidad_original: parsed.comunidadOriginal,
        comunidad_normalizada: parsed.comunidadNormalizada,
        bloque_original: "",
        bloque_normalizado: "",
        vivienda_original: parsed.viviendaOriginal,
        vivienda_normalizada: parsed.viviendaNormalizada,
        titular_nombre: "",
        relacion_con_inmueble: "",
        expediente_id: expedienteId,
        carpeta_comunidad_id: carpetaComunidadId,
        carpeta_vivienda_id: carpetaViviendaId,
        acceso_autorizado: "si",
        fecha_alta: new Date().toISOString(),
        observaciones: "",
      };

      await appendRegistro(nuevoRegistro);
      await appendExpediente({
        expediente_id: expedienteId,
        telefono_whatsapp: telefono,
        comunidad_normalizada: parsed.comunidadNormalizada,
        bloque_normalizado: "",
        vivienda_normalizada: parsed.viviendaNormalizada,
      });

      await enviarWhatsapp(
        from,
        `Perfecto ✅\n\nTe he registrado en:\n${parsed.comunidadNormalizada}\nVivienda: ${parsed.viviendaNormalizada}\n\nYa puedes enviarme documentación por aquí 📎`
      );
      return;
    }

    // 3) SI NO ESTÁ REGISTRADO Y MANDA ARCHIVO
    if (!registro && numMedia > 0) {
      await enviarWhatsapp(
        from,
        "He recibido tu archivo 📎, pero antes necesito registrarte.\n\nEscríbeme:\nComunidad + Vivienda\n\nEjemplo:\nEstrella Aldebarán 4 1A"
      );
      return;
    }

    // 4) SI ESTÁ REGISTRADO Y MANDA ARCHIVO
    if (registro && numMedia > 0) {
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

      const comunidadSafe = sanitizeFileName(registro.comunidad_normalizada);
      const viviendaSafe = sanitizeFileName(registro.vivienda_normalizada);
      const fileName = `${comunidadSafe}_${viviendaSafe}_${Date.now()}${extension}`;

      const file = await uploadToDrive(
        Buffer.from(response.data),
        fileName,
        mimeType,
        registro.carpeta_vivienda_id
      );

      console.log("Archivo subido a Drive:", file);

      await enviarWhatsapp(
        from,
        `📄 Documento recibido correctamente.\n\nLo he guardado en:\n${registro.comunidad_normalizada}\n${registro.vivienda_normalizada}`
      );
      return;
    }

    // 5) SI ESTÁ REGISTRADO Y MANDA TEXTO
    if (registro && numMedia === 0) {
      await enviarWhatsapp(
        from,
        `Te tengo identificado en:\n${registro.comunidad_normalizada}\nVivienda: ${registro.vivienda_normalizada}\n\nPuedes enviarme documentación por aquí 📎`
      );
      return;
    }

  } catch (error) {
    console.error(
      "ERROR en /whatsapp:",
      error?.response?.data || error?.message || error
    );

    try {
      await enviarWhatsapp(
        from,
        "⚠️ Ha habido un problema procesando tu mensaje."
      );
    } catch (sendError) {
      console.error(
        "ERROR enviando respuesta por API:",
        sendError?.response?.data || sendError?.message || sendError
      );
    }
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});