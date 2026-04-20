const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");
const sharp = require("sharp");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= GOOGLE AUTH =================
function getGoogleAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: getGoogleAuth() });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

// ================= HELPERS =================
function ahoraISO() {
  return new Date().toISOString();
}

function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function diasEntre(fechaIso) {
  if (!fechaIso) return 0;
  const inicio = new Date(fechaIso);
  const ahora = new Date();
  return Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24));
}

// FIX #6: normaliza 0034, 34XXXXXXXXX y +34 al mismo formato
function normalizarTelefono(telefono) {
  let t = (telefono || "").replace(/\s/g, "").trim();
  t = t.replace(/^whatsapp:/i, "");
  if (t.startsWith("0034")) t = "+" + t.slice(2);
  if (/^34\d{9}$/.test(t)) t = "+" + t;
  if (t.startsWith("+")) {
    t = "+" + t.slice(1).replace(/\D/g, "");
  } else {
    t = t.replace(/\D/g, "");
  }
  return t;
}

function extensionDesdeMime(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/heic") return ".heic";
  return "";
}

function joinList(arr) {
  return (arr || []).filter(Boolean).join(",");
}

function splitList(text) {
  return (text || "").split(",").map((x) => x.trim()).filter(Boolean);
}

const DOC_LABELS = {
  solicitud_firmada: "Solicitud de EMASESA firmada",
  dni_delante: "DNI por la parte delantera",
  dni_detras: "DNI por la parte trasera",
  dni_familiar_delante: "DNI del familiar por delante",
  dni_familiar_detras: "DNI del familiar por detrás",
  dni_propietario_delante: "DNI del propietario por delante",
  dni_propietario_detras: "DNI del propietario por detrás",
  dni_inquilino_delante: "DNI del inquilino por delante",
  dni_inquilino_detras: "DNI del inquilino por detrás",
  dni_administrador_delante: "DNI del administrador por delante",
  dni_administrador_detras: "DNI del administrador por detrás",
  libro_familia: "Libro de familia",
  autorizacion_familiar: "Documento de autorización",
  contrato_alquiler: "Contrato de alquiler completo y firmado",
  empadronamiento: "Certificado de empadronamiento",
  nif_sociedad: "NIF/CIF de la sociedad",
  escritura_constitucion: "Escritura de constitución",
  poderes_representante: "Poderes del representante",
  licencia_o_declaracion: "Licencia de apertura o declaración responsable",
  dni_pagador_delante: "DNI del pagador por delante",
  dni_pagador_detras: "DNI del pagador por detrás",
  justificante_ingresos: "Justificante de ingresos",
  titularidad_bancaria: "Documento de titularidad bancaria",
  adicional: "Documentación adicional",
};

function labelDocumento(code) {
  return DOC_LABELS[code] || code || "documento";
}

function labelsDocumentos(listText) {
  return splitList(listText).map(labelDocumento);
}

function esDocumentoDNI(code) {
  return [
    "dni_delante", "dni_detras",
    "dni_familiar_delante", "dni_familiar_detras",
    "dni_propietario_delante", "dni_propietario_detras",
    "dni_inquilino_delante", "dni_inquilino_detras",
    "dni_administrador_delante", "dni_administrador_detras",
    "dni_pagador_delante", "dni_pagador_detras",
  ].includes(code);
}

function esDocumentoImagenNormalizable(mimeType) {
  return (mimeType || "").startsWith("image/");
}

function nombreProcesado(fileName) {
  const punto = fileName.lastIndexOf(".");
  if (punto === -1) return fileName + "_procesado.jpg";
  return fileName.slice(0, punto) + "_procesado.jpg";
}

async function normalizarImagenDocumento(buffer) {
  try {
    const img = sharp(buffer).rotate();
    const meta = await img.metadata();
    const processedBuffer = await img
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .normalise()
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
    return { ok: true, buffer: processedBuffer, metadata: meta };
  } catch (error) {
    console.error("Error normalizando imagen:", error.message);
    return { ok: false, error: error.message };
  }
}

async function validarImagenTecnica(buffer) {
  try {
    const image = sharp(buffer).greyscale();
    const meta = await image.metadata();

    if (!meta.width || !meta.height) {
      return { ok: false, estado: "rechazado", motivo: "No hemos podido leer bien la imagen." };
    }
    if (meta.width < 500 || meta.height < 300) {
      return { ok: false, estado: "rechazado", motivo: "La imagen es demasiado pequeña." };
    }

    const { data, info } = await image
      .resize(300, 200, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let suma = 0, min = 255, max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      suma += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const media = suma / data.length;

    if (media < 35) {
      return { ok: false, estado: "rechazado", motivo: "La imagen está demasiado oscura." };
    }

    let nitidez = 0, count = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 1; x < info.width; x++) {
        const idx = y * info.width + x;
        nitidez += Math.abs(data[idx] - data[y * info.width + (x - 1)]);
        count++;
      }
    }
    const nitidezMedia = count ? nitidez / count : 0;
    const rango = max - min;

    if (nitidezMedia < 3) {
      return { ok: false, estado: "rechazado", motivo: "La imagen está borrosa o fuera de foco." };
    }
    if (rango < 20) {
      return { ok: false, estado: "rechazado", motivo: "La imagen tiene poco contraste y no se aprecia bien el documento." };
    }
    if (nitidezMedia < 6 || media < 45) {
      return { ok: true, estado: "dudoso", motivo: "La imagen puede servir, pero no tiene una calidad del todo clara." };
    }
    return { ok: true, estado: "valido", motivo: "" };
  } catch (error) {
    console.error("Error validando imagen técnica:", error.message);
    return { ok: false, estado: "rechazado", motivo: "No hemos podido revisar la imagen correctamente." };
  }
}

// ================= DOCUMENTOS LARGOS =================
const DOCS_LARGOS = [
  "contrato_alquiler",
  "escritura_constitucion",
  "poderes_representante",
  "licencia_o_declaracion",
  "libro_familia",
];

// ================= DOCUMENTOS REQUERIDOS =================
const REQUIRED_DOCS = {
  propietario: {
    obligatorios: ["solicitud_firmada", "dni_delante", "dni_detras"],
    opcionales: ["empadronamiento"],
  },
  familiar: {
    obligatorios: ["solicitud_firmada", "dni_familiar_delante", "dni_familiar_detras", "dni_propietario_delante", "dni_propietario_detras", "libro_familia", "autorizacion_familiar"],
    opcionales: ["empadronamiento"],
  },
  inquilino: {
    obligatorios: ["solicitud_firmada", "dni_inquilino_delante", "dni_inquilino_detras", "dni_propietario_delante", "dni_propietario_detras", "contrato_alquiler"],
    opcionales: ["empadronamiento"],
  },
  sociedad: {
    obligatorios: ["solicitud_firmada", "dni_administrador_delante", "dni_administrador_detras", "nif_sociedad", "escritura_constitucion", "poderes_representante"],
    opcionales: [],
  },
  local: {
    obligatorios: ["solicitud_firmada", "dni_propietario_delante", "dni_propietario_detras", "licencia_o_declaracion"],
    opcionales: [],
  },
  financiacion: {
    obligatorios: ["dni_pagador_delante", "dni_pagador_detras", "justificante_ingresos", "titularidad_bancaria"],
    opcionales: [],
  },
};

// ================= FLUJOS =================
const FLOWS = {
  propietario: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_delante", prompt: "2️⃣ Sube una foto del DNI por la parte delantera." },
    { code: "dni_detras", prompt: "3️⃣ Sube una foto del DNI por la parte trasera." },
    { code: "empadronamiento", prompt: "4️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  familiar: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_familiar_delante", prompt: "2️⃣ Sube el DNI del familiar por delante." },
    { code: "dni_familiar_detras", prompt: "3️⃣ Sube el DNI del familiar por detrás." },
    { code: "dni_propietario_delante", prompt: "4️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5️⃣ Sube el DNI del propietario por detrás." },
    { code: "libro_familia", prompt: "6️⃣ Sube el libro de familia." },
    { code: "autorizacion_familiar", prompt: "7️⃣ Sube el documento de autorización." },
    { code: "empadronamiento", prompt: "8️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  inquilino: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_inquilino_delante", prompt: "2️⃣ Sube el DNI del inquilino por delante." },
    { code: "dni_inquilino_detras", prompt: "3️⃣ Sube el DNI del inquilino por detrás." },
    { code: "dni_propietario_delante", prompt: "4️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5️⃣ Sube el DNI del propietario por detrás." },
    { code: "contrato_alquiler", prompt: "6️⃣ Sube el contrato de alquiler completo y firmado. Preferiblemente en un único PDF. Si no puedes, puedes enviarlo en varias fotos y cuando termines escribe LISTO." },
    { code: "empadronamiento", prompt: "7️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  sociedad: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_administrador_delante", prompt: "2️⃣ Sube el DNI del administrador por delante." },
    { code: "dni_administrador_detras", prompt: "3️⃣ Sube el DNI del administrador por detrás." },
    { code: "nif_sociedad", prompt: "4️⃣ Sube el NIF/CIF de la sociedad." },
    { code: "escritura_constitucion", prompt: "5️⃣ Sube la escritura de constitución. Preferiblemente en un único PDF. Si no puedes, puedes enviarla en varias fotos y cuando termines escribe LISTO." },
    { code: "poderes_representante", prompt: "6️⃣ Sube los poderes del representante. Preferiblemente en un único PDF. Si no puedes, puedes enviarlos en varias fotos y cuando termines escribe LISTO." },
  ],
  local: [
    { code: "solicitud_firmada", prompt: "1️⃣ Sube la solicitud de EMASESA firmada." },
    { code: "dni_propietario_delante", prompt: "2️⃣ Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "3️⃣ Sube el DNI del propietario por detrás." },
    { code: "licencia_o_declaracion", prompt: "4️⃣ Sube la licencia de apertura o la declaración responsable. Preferiblemente en un único PDF. Si no puedes, puedes enviarla en varias fotos y cuando termines escribe LISTO." },
  ],
  financiacion: [
    { code: "dni_pagador_delante", prompt: "1️⃣ Sube el DNI del pagador por delante." },
    { code: "dni_pagador_detras", prompt: "2️⃣ Sube el DNI del pagador por detrás." },
    { code: "justificante_ingresos", prompt: "3️⃣ Sube un justificante de ingresos." },
    { code: "titularidad_bancaria", prompt: "4️⃣ Sube el documento de titularidad bancaria." },
  ],
};

function mapTipoExpediente(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (t === "1" || t.includes("propiet")) return "propietario";
  if (t === "2" || t.includes("familiar")) return "familiar";
  if (t === "3" || t.includes("inquilin")) return "inquilino";
  if (t === "4" || t.includes("sociedad") || t.includes("empresa")) return "sociedad";
  if (t === "5" || t.includes("local")) return "local";
  return null;
}

function mapFinanciacion(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (t === "1" || t === "si" || t === "sí") return "si";
  if (t === "2" || t === "no") return "no";
  return null;
}

function buildPreguntaTipo(nombre) {
  return "Hola " + (nombre || "") + " 👋 Soy el asistente de Instalaciones Araujo.\n\nVoy a ayudarte a enviar la documentación necesaria para el Plan 5 de EMASESA.\n\nIndica tu caso:\n1. Soy propietario de la vivienda\n2. El contrato irá a nombre de un familiar\n3. El contrato irá a nombre de un inquilino\n4. La vivienda está a nombre de una sociedad\n5. Es un local comercial";
}

function buildPreguntaFinanciacion() {
  return "Perfecto 👌\n\nHemos recibido la documentación base necesaria.\n\nÚltima pregunta:\n¿Te gustaría que estudiemos la posibilidad de financiar tu parte?\n\n1. Sí\n2. No";
}

// ================= IA TEXTO =================
async function responderConIA(mensaje, expediente) {
  const documentoActual = labelDocumento(expediente.documento_actual);
  const pendientes = labelsDocumentos(expediente.documentos_pendientes).join(", ");
  const opcionales = labelsDocumentos(expediente.documentos_opcionales_pendientes).join(", ");
  const dias = diasEntre(expediente.fecha_primer_contacto);

  const promptSistema = "Eres el asistente de Instalaciones Araujo.\n\nTu función es ayudar a vecinos a completar su expediente del Plan 5 de EMASESA enviando documentación por WhatsApp.\n\nTu objetivo NO es conversar. Tu objetivo es conseguir que el cliente envíe la documentación cuanto antes.\n\nCONTEXTO DEL EXPEDIENTE:\n- Tipo de expediente: " + (expediente.tipo_expediente || "sin definir") + "\n- Documento actual que estamos esperando: " + (documentoActual || "sin definir") + "\n- Documentos pendientes obligatorios: " + (pendientes || "ninguno") + "\n- Documentos opcionales pendientes: " + (opcionales || "ninguno") + "\n- Días transcurridos desde primer contacto: " + dias + "\n\nREGLAS:\n1. Responde siempre en español.\n2. Sé breve, claro y directo.\n3. Mantén presión comercial sin ser agresivo.\n4. No reinicies el flujo.\n5. No pidas documentos que no correspondan al expediente.\n6. Si el mensaje es una duda, explica brevemente y vuelve al documento pendiente.\n7. Si es una excusa, mete urgencia y vuelve al documento pendiente.\n8. Si depende de tercero, mete presión y acción inmediata.\n9. Si es un caso especial delicado, indica revisión manual.\n10. Termina orientando al siguiente paso: enviar documento.";

  const fallback = "Perfecto 👍 retomamos tu expediente.\n\nTe falta por enviar:\n• " + documentoActual + "\n\n📎 Puedes enviarlo directamente por este WhatsApp.";

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    // FIX #7: timeout 4s para no superar límite de Twilio
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: mensaje },
        ],
      },
      {
        timeout: 4000,
        headers: {
          Authorization: "Bearer " + process.env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    const texto = response && response.data && response.data.choices && response.data.choices[0] ? response.data.choices[0].message.content.trim() : null;
    return texto || fallback;
  } catch (error) {
    console.error("Error IA TEXTO:", error && error.response ? error.response.data : error.message);
    return fallback;
  }
}

// ================= IA DNI (VISIÓN) =================
async function analizarDNIconIA(buffer) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const base64 = buffer.toString("base64");

    // FIX #7: timeout 4s también en llamada DNI
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Analiza esta imagen.\n\nResponde SOLO en JSON con este formato:\n\n{\n  \"tipo\": \"dni_delante | dni_detras | otro | dudoso\",\n  \"confianza\": 0-100\n}\n\nReglas:\n- dni_delante: cara + datos personales\n- dni_detras: código barras o MRZ\n- otro: no es DNI\n- dudoso: no se ve claro",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "¿Qué documento es este?" },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } },
            ],
          },
        ],
      },
      {
        timeout: 4000,
        headers: {
          Authorization: "Bearer " + process.env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const texto = response && response.data && response.data.choices && response.data.choices[0] ? response.data.choices[0].message.content : "";
    const limpio = texto.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      return JSON.parse(limpio);
    } catch (e) {
      console.error("JSON DNI inválido:", texto);
      return null;
    }
  } catch (error) {
    console.error("Error IA DNI:", error && error.response ? error.response.data : error.message);
    return null;
  }
}

// ================= DRIVE =================
async function buscarCarpeta(nombre, parentId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: "'" + parentId + "' in parents and name='" + nombre + "' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id, name)",
  });
  return res.data.files[0] || null;
}

async function crearCarpeta(nombre, parentId) {
  const drive = getDriveClient();
  const file = await drive.files.create({
    requestBody: { name: nombre, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id, name",
  });
  return file.data;
}

async function getOrCreateCarpetaTelefono(telefono) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  let carpeta = await buscarCarpeta(telefono, rootId);
  if (!carpeta) carpeta = await crearCarpeta(telefono, rootId);
  return carpeta.id;
}

async function uploadToDrive(buffer, fileName, mimeType, carpetaId) {
  const drive = getDriveClient();
  const file = await drive.files.create({
    requestBody: { name: fileName, parents: [carpetaId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, name, webViewLink",
  });
  return file.data;
}

async function uploadProcessedToDrive(buffer, originalFileName, carpetaId) {
  return await uploadToDrive(buffer, nombreProcesado(originalFileName), "image/jpeg", carpetaId);
}

// ================= SHEETS - VECINOS =================
async function buscarVecinoPorTelefono(telefono) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos_base!A:E",
  });
  const rows = res.data.values || [];
  const telNormalizado = normalizarTelefono(telefono);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalizarTelefono(row[4] || "") === telNormalizado) {
      return { comunidad: row[0] || "", bloque: row[1] || "", vivienda: row[2] || "", nombre: row[3] || "", telefono: row[4] || "" };
    }
  }
  return null;
}

// ================= SHEETS - CONTACTOS =================
async function guardarContacto(telefono, mensajeCliente, tipo, respuestaBot) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "contactos!A:E",
    valueInputOption: "RAW",
    requestBody: { values: [[ahoraISO(), telefono, mensajeCliente, tipo, respuestaBot]] },
  });
}

// ================= SHEETS - AVISOS =================
async function guardarAviso(telefono, tipoAviso, estado) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "avisos!A:D",
    valueInputOption: "RAW",
    requestBody: { values: [[telefono, tipoAviso, ahoraISO(), estado]] },
  });
}

// ================= SHEETS - EXPEDIENTES =================
async function buscarExpedientePorTelefono(telefono) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:R",
  });
  const rows = res.data.values || [];
  const telNormalizado = normalizarTelefono(telefono);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalizarTelefono(row[0] || "") === telNormalizado) {
      return {
        rowIndex: i + 1,
        telefono: row[0] || "", comunidad: row[1] || "", vivienda: row[2] || "", nombre: row[3] || "",
        tipo_expediente: row[4] || "", paso_actual: row[5] || "", documento_actual: row[6] || "",
        estado_expediente: row[7] || "", fecha_inicio: row[8] || "", fecha_primer_contacto: row[9] || "",
        fecha_ultimo_contacto: row[10] || "", fecha_limite_documentacion: row[11] || "",
        fecha_limite_firma: row[12] || "", documentos_completos: row[13] || "",
        alerta_plazo: row[14] || "", documentos_recibidos: row[15] || "",
        documentos_pendientes: row[16] || "", documentos_opcionales_pendientes: row[17] || "",
      };
    }
  }
  return null;
}

function calcularDocsExpediente(tipoExpediente, docsRecibidosArr) {
  const reglas = REQUIRED_DOCS[tipoExpediente] || { obligatorios: [], opcionales: [] };
  const recibidosSet = new Set(docsRecibidosArr || []);
  const obligatoriosPendientes = reglas.obligatorios.filter((d) => !recibidosSet.has(d));
  const opcionalesPendientes = reglas.opcionales.filter((d) => !recibidosSet.has(d));
  return {
    recibidos: joinList(docsRecibidosArr),
    pendientes: joinList(obligatoriosPendientes),
    opcionalesPendientes: joinList(opcionalesPendientes),
    completos: obligatoriosPendientes.length === 0 ? "SI" : "NO",
  };
}

async function crearExpedienteInicial(telefono, datosVecino) {
  const sheets = getSheetsClient();
  const ahora = ahoraISO();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:R",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        telefono,
        (datosVecino && datosVecino.comunidad) || "",
        (datosVecino && datosVecino.vivienda) || "",
        (datosVecino && datosVecino.nombre) || "",
        "", "pregunta_tipo", "", "pendiente_clasificacion",
        ahora, ahora, ahora, sumarDias(ahora, 20), "", "NO", "ok", "", "", "",
      ]],
    },
  });
}

async function actualizarExpediente(rowIndex, data) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A" + rowIndex + ":R" + rowIndex,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.telefono || "", data.comunidad || "", data.vivienda || "", data.nombre || "",
        data.tipo_expediente || "", data.paso_actual || "", data.documento_actual || "",
        data.estado_expediente || "", data.fecha_inicio || "", data.fecha_primer_contacto || "",
        data.fecha_ultimo_contacto || "", data.fecha_limite_documentacion || "",
        data.fecha_limite_firma || "", data.documentos_completos || "",
        data.alerta_plazo || "", data.documentos_recibidos || "",
        data.documentos_pendientes || "", data.documentos_opcionales_pendientes || "",
      ]],
    },
  });
}

function refrescarResumenDocumental(expediente) {
  const docsRecibidosArr = splitList(expediente.documentos_recibidos);
  const resumen = calcularDocsExpediente(expediente.tipo_expediente, docsRecibidosArr);
  expediente.documentos_recibidos = resumen.recibidos;
  expediente.documentos_pendientes = resumen.pendientes;
  expediente.documentos_opcionales_pendientes = resumen.opcionalesPendientes;
  expediente.documentos_completos = resumen.completos;
  return expediente;
}

// ================= SHEETS - DOCUMENTOS =================
// columna I = estadoRevision: OK | REVISAR | RECHAZADO
async function guardarDocumentoSheet(telefono, comunidad, vivienda, tipoDocumento, nombreArchivo, urlDrive, origenClasificacion, estadoRevision) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "documentos!A:I",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        telefono, comunidad, vivienda, tipoDocumento,
        nombreArchivo, ahoraISO(), urlDrive || "",
        origenClasificacion || "", estadoRevision || "OK",
      ]],
    },
  });
}

// ================= FLOW HELPERS =================

// FIX #2: devuelve null si no encuentra el código — evita reinicio accidental
function getNextStep(tipoExpediente, currentDocCode) {
  const flow = FLOWS[tipoExpediente] || [];
  const index = flow.findIndex((d) => d.code === currentDocCode);
  if (index === -1) return null;
  if (index + 1 < flow.length) return flow[index + 1];
  return null;
}

function getFirstStep(tipoExpediente) {
  const flow = FLOWS[tipoExpediente] || [];
  return flow.length > 0 ? flow[0] : null;
}

function esDocumentoOpcional(tipoExpediente, documentoCode) {
  const reglas = REQUIRED_DOCS[tipoExpediente] || { opcionales: [] };
  return (reglas.opcionales || []).includes(documentoCode);
}

// ================= AVISOS POR PLAZO =================
function construirAvisoPorPlazo(expediente) {
  const dias = diasEntre(expediente.fecha_primer_contacto);
  const pendientes = labelsDocumentos(expediente.documentos_pendientes);
  if (!pendientes.length) return null;
  const listaPendientes = pendientes.join("\n- ");

  if (dias >= 20) {
    return {
      tipo: "fuera_plazo", alerta: "fuera_plazo",
      mensaje: "⚠️ ÚLTIMO AVISO - Plazo finalizado\n\nSigue pendiente:\n- " + listaPendientes + "\n\n❗ Tu expediente puede quedar bloqueado.\n\n👉 Envíalo URGENTEMENTE por este mismo WhatsApp.\n\nNo lo dejes pasar.",
    };
  }
  if (dias >= 18) {
    return {
      tipo: "aviso_urgente", alerta: "urgente",
      mensaje: "⏳ Aviso importante - Plazo casi finalizado\n\nTu expediente sigue incompleto.\n\nFalta:\n- " + listaPendientes + "\n\n⚠️ Si no lo envías a tiempo, el expediente puede quedar paralizado.\n\nEnvíalo ahora por este WhatsApp.",
    };
  }
  if (dias >= 10) {
    return {
      tipo: "aviso_10_dias", alerta: "aviso_10_dias",
      mensaje: "📌 Recordatorio importante\n\nTodavía falta documentación:\n\n- " + listaPendientes + "\n\n📎 Puedes enviarla directamente por aquí.\n\n👉 No lo dejes para el final.",
    };
  }
  return null;
}

async function revisarYAvisarPorPlazo(expediente) {
  const aviso = construirAvisoPorPlazo(expediente);
  if (!aviso) {
    if (expediente.alerta_plazo !== "ok") {
      expediente.alerta_plazo = "ok";
      await actualizarExpediente(expediente.rowIndex, expediente);
    }
    return null;
  }
  if (expediente.alerta_plazo !== aviso.alerta) {
    expediente.alerta_plazo = aviso.alerta;
    await actualizarExpediente(expediente.rowIndex, expediente);
    await guardarAviso(expediente.telefono, aviso.tipo, "enviado");
    return aviso.mensaje;
  }
  return null;
}

// ================= RESPUESTA + LOG =================
async function responderYLog(res, telefono, mensajeCliente, tipo, respuestaBot) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuestaBot);
  try {
    await guardarContacto(telefono, mensajeCliente, tipo, respuestaBot);
  } catch (e) {
    console.error("ERROR guardando contacto:", e.message);
  }
  return res.type("text/xml").send(twiml.toString());
}

// ================= PROCESAMIENTO Y VALIDACIÓN DE UN ARCHIVO =================
// FIX #5 + FIX #8: función extraída para múltiples archivos con errores contextualizados
async function procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaId, documentoActual) {
  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
  });

  const bufferOriginal = Buffer.from(response.data);
  const extension = extensionDesdeMime(mimeType);
  const fileName = (documentoActual || "documento") + "_" + telefono + "_" + Date.now() + extension;

  let bufferFinal = bufferOriginal;
  let estadoDocumento = "validado";
  let motivoRevision = "";
  let motivoRechazo = "";

  if (esDocumentoImagenNormalizable(mimeType)) {
    // Validación técnica
    const validacion = await validarImagenTecnica(bufferOriginal);

    if (!validacion.ok) {
      estadoDocumento = "rechazado";
      motivoRechazo = validacion.motivo;
    } else if (validacion.estado === "dudoso") {
      estadoDocumento = "pendiente_revision";
      motivoRevision = validacion.motivo || "La imagen no es del todo clara.";
    }

    // Análisis DNI con IA visión (solo si no está ya rechazado)
    if (esDocumentoDNI(documentoActual) && estadoDocumento !== "rechazado") {
      const analisisDNI = await analizarDNIconIA(bufferOriginal);

      if (analisisDNI) {
        if (analisisDNI.tipo === "otro") {
          estadoDocumento = "pendiente_revision";
          motivoRevision = "No parece un DNI, lo revisaremos manualmente.";
        }
        if (documentoActual.includes("delante") && analisisDNI.tipo === "dni_detras") {
          estadoDocumento = "rechazado";
          motivoRechazo = "Has enviado la parte trasera del DNI y necesitamos la delantera.";
        }
        if (documentoActual.includes("detras") && analisisDNI.tipo === "dni_delante") {
          estadoDocumento = "rechazado";
          motivoRechazo = "Has enviado la parte delantera del DNI y necesitamos la trasera.";
        }
        if (analisisDNI.tipo === "dudoso" && estadoDocumento !== "rechazado") {
          estadoDocumento = "pendiente_revision";
          motivoRevision = "No se ha podido verificar completamente el DNI.";
        }
      } else if (estadoDocumento !== "rechazado") {
        estadoDocumento = "pendiente_revision";
        motivoRevision = "No se ha podido verificar el DNI automáticamente.";
      }
    }

    // Normalizar imagen
    const procesado = await normalizarImagenDocumento(bufferOriginal);
    if (procesado.ok) bufferFinal = procesado.buffer;
  }

  // Subir a Drive
  let file;
  try {
    if (esDocumentoImagenNormalizable(mimeType)) {
      file = await uploadProcessedToDrive(bufferFinal, fileName, carpetaId);
    } else {
      file = await uploadToDrive(bufferFinal, fileName, mimeType, carpetaId);
    }
  } catch (err) {
    // FIX #8: error contextualizado
    console.error("ERROR uploadToDrive [telefono=" + telefono + ", archivo=" + fileName + "]:", err.message);
    throw err;
  }

  return { file, fileName, estadoDocumento, motivoRevision, motivoRechazo };
}

// ================= RUTAS =================
app.get("/", (req, res) => { res.send("Servidor OK"); });

app.post("/whatsapp", async (req, res) => {
  try {
    const msgOriginal = (req.body.Body || "").trim();
    const msg = msgOriginal.toLowerCase();
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const telefono = (req.body.From || "").replace("whatsapp:", "");

    const datosVecino = await buscarVecinoPorTelefono(telefono);

    if (!datosVecino) {
      return responderYLog(res, telefono, msgOriginal || "sin_texto", numMedia > 0 ? "archivo" : "texto",
        "Tu número no está en el listado inicial de la comunidad. Contacta con Instalaciones Araujo para validarlo.");
    }

    let expediente = await buscarExpedientePorTelefono(telefono);
    if (!expediente) {
      await crearExpedienteInicial(telefono, datosVecino);
      expediente = await buscarExpedientePorTelefono(telefono);
    }

    // ================= PREGUNTA TIPO =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_tipo") {
      const tipo = mapTipoExpediente(msg);
      if (!tipo) {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaTipo(datosVecino.nombre));
      }
      const primerPaso = getFirstStep(tipo);
      expediente.tipo_expediente = tipo;
      expediente.paso_actual = "recogida_documentacion";
      expediente.documento_actual = primerPaso ? primerPaso.code : "";
      expediente.estado_expediente = "en_proceso";
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);
      await actualizarExpediente(expediente.rowIndex, expediente);
      return responderYLog(res, telefono, msgOriginal, "texto",
        "Perfecto ✅\n\nCaso identificado: " + tipo + ".\n\n" + (primerPaso ? primerPaso.prompt : "Empezamos."));
    }

    // ================= LISTO PARA DOCUMENTOS LARGOS =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion" && msg === "listo") {
      const docsRecibidosArr = splitList(expediente.documentos_recibidos);
      if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
        docsRecibidosArr.push(expediente.documento_actual);
      }
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);
      const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
      if (siguiente) {
        expediente.documento_actual = siguiente.code;
        expediente.estado_expediente = "en_proceso";
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Perfecto 👍\n\nDocumento completo recibido.\n\nSeguimos:\n" + siguiente.prompt);
      } else {
        expediente.paso_actual = "pregunta_financiacion";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Perfecto ✅\n\nDocumento completo recibido.\n\n" + buildPreguntaFinanciacion());
      }
    }

    // ================= TEXTO DURANTE RECOGIDA DOCUMENTACION =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion") {
      const mensajePlazo = await revisarYAvisarPorPlazo(expediente);
      if (mensajePlazo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", mensajePlazo);

      const mn = (msgOriginal || "").trim().toLowerCase();
      const quiereSaltarOpcional = ["no", "no lo tengo", "no dispongo", "no puedo", "paso", "siguiente", "no lo encuentro"].includes(mn);

      if (esDocumentoOpcional(expediente.tipo_expediente, expediente.documento_actual) && quiereSaltarOpcional) {
        expediente.fecha_ultimo_contacto = ahoraISO();
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto 👍\n\nContinuamos sin ese documento opcional.\n\nSeguimos:\n" + siguiente.prompt);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente.fecha_ultimo_contacto = ahoraISO();
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto 👍\n\nContinuamos sin ese documento opcional.\n\n" + buildPreguntaFinanciacion());
        }
      }

      if (DOCS_LARGOS.includes(expediente.documento_actual)) {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Ahora mismo estamos esperando este documento:\n\n• " + labelDocumento(expediente.documento_actual) + "\n\n📄 Preferiblemente envíalo en un único PDF completo.\nSi no puedes, puedes mandarlo en varias fotos.\n\nCuando termines de enviar todas las páginas, escribe LISTO.");
      }

      const respuestaIA = await responderConIA(msgOriginal, expediente);
      return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", respuestaIA);
    }

    // ================= PREGUNTA FINANCIACION =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_financiacion") {
      const respuestaFin = mapFinanciacion(msg);
      if (!respuestaFin) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaFinanciacion());

      if (respuestaFin === "no") {
        expediente.paso_actual = "finalizado";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        expediente.fecha_ultimo_contacto = ahoraISO();
        expediente = refrescarResumenDocumental(expediente);
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Perfecto ✅ Tu expediente base ya está completo. Nuestro equipo lo revisará y te avisará si necesitamos algo más.");
      }

      const primerPasoFin = getFirstStep("financiacion");
      expediente.paso_actual = "recogida_financiacion";
      expediente.documento_actual = primerPasoFin.code;
      expediente.estado_expediente = "pendiente_financiacion";
      expediente.fecha_ultimo_contacto = ahoraISO();
      await actualizarExpediente(expediente.rowIndex, expediente);
      return responderYLog(res, telefono, msgOriginal, "texto",
        "Perfecto 💰\n\nVamos a estudiar la financiación.\n\n" + primerPasoFin.prompt);
    }

    // ================= TEXTO DURANTE FINANCIACION =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_financiacion") {
      const mensajePlazo = await revisarYAvisarPorPlazo(expediente);
      if (mensajePlazo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", mensajePlazo);
      const respuestaIA = await responderConIA(msgOriginal, expediente);
      return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", respuestaIA);
    }

    // ================= SI MANDA ARCHIVO(S) =================
    if (numMedia > 0) {
      const carpetaId = await getOrCreateCarpetaTelefono(telefono);

      // FIX #1: evaluación explícita del paso válido
      const esPasoValido =
        expediente.paso_actual === "recogida_documentacion" ||
        expediente.paso_actual === "recogida_financiacion";

      // ====== ARCHIVO FUERA DE FLUJO ======
      if (!esPasoValido) {
        // FIX #5: procesar todos los archivos
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = req.body["MediaUrl" + i];
          const mimeType = req.body["MediaContentType" + i] || "application/octet-stream";
          try {
            const resultado = await procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaId, "adicional");
            try {
              await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
                "adicional", resultado.fileName, resultado.file.webViewLink || "", "fuera_flujo", "OK");
            } catch (err) {
              console.error("ERROR guardarDocumentoSheet fuera_flujo [i=" + i + "]:", err.message);
            }
          } catch (err) {
            console.error("ERROR procesando archivo fuera de flujo [i=" + i + "]:", err.message);
          }
        }
        expediente.fecha_ultimo_contacto = ahoraISO();
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Documentación adicional recibida correctamente ✅\n\nLa incorporamos a tu expediente para revisión.");
      }

      // ====== ARCHIVO DENTRO DEL FLUJO ======

      // FIX #3: lectura fresca anti race-condition
      const expedienteFresco = await buscarExpedientePorTelefono(telefono);
      if (expedienteFresco) {
        const merged = Array.from(new Set(
          splitList(expedienteFresco.documentos_recibidos).concat(splitList(expediente.documentos_recibidos))
        ));
        expediente.documentos_recibidos = joinList(merged);
      }

      // Procesar archivo principal con validación completa
      const mediaUrl0 = req.body.MediaUrl0;
      const mimeType0 = req.body.MediaContentType0 || "application/octet-stream";

      let resultado;
      try {
        resultado = await procesarYValidarArchivo(mediaUrl0, mimeType0, telefono, carpetaId, expediente.documento_actual);
      } catch (err) {
        console.error("ERROR procesando archivo principal:", err.message);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Ha habido un problema procesando el archivo. Por favor, inténtalo de nuevo.");
      }

      // FIX #5: archivos adicionales (numMedia > 1) se guardan sin validación extra
      for (let i = 1; i < numMedia; i++) {
        const mediaUrlN = req.body["MediaUrl" + i];
        const mimeTypeN = req.body["MediaContentType" + i] || "application/octet-stream";
        try {
          const resultadoN = await procesarYValidarArchivo(mediaUrlN, mimeTypeN, telefono, carpetaId, expediente.documento_actual);
          try {
            await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
              expediente.documento_actual || "pendiente_clasificar",
              resultadoN.fileName, resultadoN.file.webViewLink || "", "flujo_extra", "OK");
          } catch (err) {
            console.error("ERROR guardarDocumentoSheet flujo_extra [i=" + i + "]:", err.message);
          }
        } catch (err) {
          console.error("ERROR procesando archivo extra [i=" + i + "]:", err.message);
        }
      }

      // Guardar documento principal con su estado de revisión
      const estadoRevision =
        resultado.estadoDocumento === "rechazado" ? "RECHAZADO" :
        resultado.estadoDocumento === "pendiente_revision" ? "REVISAR" : "OK";

      try {
        await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
          expediente.documento_actual || "pendiente_clasificar",
          resultado.fileName, resultado.file.webViewLink || "", "flujo", estadoRevision);
      } catch (err) {
        console.error("ERROR guardarDocumentoSheet flujo [doc=" + expediente.documento_actual + "]:", err.message);
      }

      expediente.fecha_ultimo_contacto = ahoraISO();

      // ====== RECHAZADO ======
      if (resultado.estadoDocumento === "rechazado") {
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "El documento no se puede validar ❌\n\nDocumento esperado:\n• " + labelDocumento(expediente.documento_actual) + "\n\nMotivo:\n" + resultado.motivoRechazo + "\n\nPor favor, vuelve a enviarlo correctamente.");
      }

      // ====== PENDIENTE DE REVISIÓN ======
      if (resultado.estadoDocumento === "pendiente_revision") {
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Hemos recibido este documento ⚠️\n\n• " + labelDocumento(expediente.documento_actual) + "\n\nHa quedado pendiente de revisión." + (resultado.motivoRevision ? "\nMotivo: " + resultado.motivoRevision : "") + "\n\nNuestro equipo lo revisará antes de continuar.");
      }

      // ====== DOCUMENTO VALIDADO — continuar flujo ======
      const esPDF = mimeType0.includes("pdf");
      const esDocumentoLargo = DOCS_LARGOS.includes(expediente.documento_actual);
      const docsRecibidosArr = splitList(expediente.documentos_recibidos);

      // DOCUMENTO LARGO EN PDF — completo
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && esPDF) {
        if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
          docsRecibidosArr.push(expediente.documento_actual);
        }
        expediente.documentos_recibidos = joinList(docsRecibidosArr);
        expediente = refrescarResumenDocumental(expediente);
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Documento recibido correctamente ✅\n\nPDF completo recibido.\n\nSeguimos:\n" + siguiente.prompt);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Documento recibido correctamente ✅\n\nPDF completo recibido.\n\n" + buildPreguntaFinanciacion());
        }
      }

      // DOCUMENTO LARGO EN FOTOS
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && !esPDF) {
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Página recibida correctamente ✅\n\nPuedes seguir enviando más páginas de este documento.\n\nCuando termines, escribe LISTO.");
      }

      // DOCUMENTO NORMAL
      if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
        docsRecibidosArr.push(expediente.documento_actual);
      }
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente = refrescarResumenDocumental(expediente);

      if (expediente.paso_actual === "recogida_documentacion") {
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Documento recibido correctamente ✅\n\nSeguimos:\n" + siguiente.prompt);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente = refrescarResumenDocumental(expediente);
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Documento recibido correctamente ✅\n\n" + buildPreguntaFinanciacion());
        }
      }

      if (expediente.paso_actual === "recogida_financiacion") {
        const siguienteFin = getNextStep("financiacion", expediente.documento_actual);
        if (siguienteFin) {
          expediente.documento_actual = siguienteFin.code;
          expediente.estado_expediente = "pendiente_financiacion";
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Documento recibido correctamente ✅\n\nSeguimos:\n" + siguienteFin.prompt);
        } else {
          // FIX #4: refrescarResumenDocumental en lugar de asignar SI manualmente
          expediente.paso_actual = "finalizado";
          expediente.documento_actual = "";
          expediente.estado_expediente = "pendiente_estudio_financiacion";
          expediente.fecha_ultimo_contacto = ahoraISO();
          expediente = refrescarResumenDocumental(expediente);
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Perfecto ✅\n\nHemos recibido toda la documentación base y la de financiación. Nuestro equipo la revisará y te avisará por aquí si necesita algo más.");
        }
      }
    }

    // ================= RESPUESTA GENÉRICA =================
    if (numMedia === 0) {
      if (expediente.paso_actual === "recogida_documentacion" || expediente.paso_actual === "recogida_financiacion") {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Perfecto 👍\n\nSeguimos con tu expediente.\n\nAhora mismo falta por enviar:\n• " + labelDocumento(expediente.documento_actual) + "\n\n📎 Puedes enviarlo directamente por aquí.");
      }

      if (expediente.paso_actual === "pregunta_financiacion") {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaFinanciacion());
      }

      if (expediente.paso_actual === "finalizado") {
        const textoFinal = (msgOriginal || "").trim().toLowerCase();
        const preguntaEstado = ["me falta", "falta algo", "falta documentación", "esta completo", "está completo", "esta correcto", "está correcto", "esta bien", "está bien", "ya está", "ya esta"].some(function(p) { return textoFinal.includes(p); });
        const quiereEnviarMas = ["te mando", "voy a mandar", "voy a enviar", "tengo otro", "tengo otra", "he encontrado", "encontré", "adjunto", "ahora envío", "ahora envio"].some(function(p) { return textoFinal.includes(p); });

        if (preguntaEstado) {
          const resumenFinal = calcularDocsExpediente(expediente.tipo_expediente, splitList(expediente.documentos_recibidos));
          const opcionalesPendientes = splitList(resumenFinal.opcionalesPendientes);
          if (opcionalesPendientes.length > 0) {
            return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
              "Tu expediente está completo para su tramitación ✅\n\n📌 Solo quedaría, si lo tienes:\n- " + opcionalesPendientes.map(labelDocumento).join("\n- ") + "\n\nNo es obligatorio, pero sí recomendable.\n\nNuestro equipo lo está revisando.");
          }
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Ahora mismo tu expediente figura como completo ✅\n\nNuestro equipo lo está revisando.\nSi detectamos que falta algo, te avisaremos por aquí.");
        }

        if (quiereEnviarMas) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto 👍\n\nPuedes enviarlo directamente por aquí y lo incorporamos a tu expediente para revisión.");
        }

        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Perfecto 👌\n\nTu expediente ya está completo.\n\nNuestro equipo lo está revisando.\nSi necesitas añadir algún documento más, puedes enviarlo por aquí.");
      }
    }

    return responderYLog(res, telefono, msgOriginal || "sin_texto", numMedia > 0 ? "archivo" : "texto", "Mensaje recibido.");

  } catch (error) {
    console.error("ERROR GENERAL:", error);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Ha habido un problema procesando tu mensaje.");
    return res.type("text/xml").send(twiml.toString());
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log("Servidor corriendo en puerto", PORT); });
