const express = require(“express”);
const bodyParser = require(“body-parser”);
const twilio = require(“twilio”);
const axios = require(“axios”);
const { google } = require(“googleapis”);
const { Readable } = require(“stream”);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ================= GOOGLE AUTH =================
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
version: “v3”,
auth: getGoogleAuth(),
});
}

function getSheetsClient() {
return google.sheets({
version: “v4”,
auth: getGoogleAuth(),
});
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
const diffMs = ahora - inicio;
return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// FIX #6: normalizarTelefono ahora normaliza prefijos 0034 y +34 al mismo formato
function normalizarTelefono(telefono) {
let t = (telefono || “”)
.replace(/\s/g, “”)
.trim();

// Eliminar prefijo whatsapp: si viene de Twilio
t = t.replace(/^whatsapp:/i, “”);

// Normalizar 0034 → +34
if (t.startsWith(“0034”)) {
t = “+” + t.slice(2);
}

// Eliminar caracteres no numéricos excepto el + inicial
if (t.startsWith(”+”)) {
t = “+” + t.slice(1).replace(/\D/g, “”);
} else {
t = t.replace(/\D/g, “”);
}

return t;
}

function extensionDesdeMime(mimeType) {
if (mimeType === “image/jpeg”) return “.jpg”;
if (mimeType === “image/png”) return “.png”;
if (mimeType === “application/pdf”) return “.pdf”;
if (mimeType === “image/heic”) return “.heic”;
return “”;
}

function joinList(arr) {
return (arr || []).filter(Boolean).join(”,”);
}

function splitList(text) {
return (text || “”)
.split(”,”)
.map((x) => x.trim())
.filter(Boolean);
}

const DOC_LABELS = {
solicitud_firmada: “Solicitud de EMASESA firmada”,
dni_delante: “DNI por la parte delantera”,
dni_detras: “DNI por la parte trasera”,
dni_familiar_delante: “DNI del familiar por delante”,
dni_familiar_detras: “DNI del familiar por detrás”,
dni_propietario_delante: “DNI del propietario por delante”,
dni_propietario_detras: “DNI del propietario por detrás”,
dni_inquilino_delante: “DNI del inquilino por delante”,
dni_inquilino_detras: “DNI del inquilino por detrás”,
dni_administrador_delante: “DNI del administrador por delante”,
dni_administrador_detras: “DNI del administrador por detrás”,
libro_familia: “Libro de familia”,
autorizacion_familiar: “Documento de autorización”,
contrato_alquiler: “Contrato de alquiler completo y firmado”,
empadronamiento: “Certificado de empadronamiento”,
nif_sociedad: “NIF/CIF de la sociedad”,
escritura_constitucion: “Escritura de constitución”,
poderes_representante: “Poderes del representante”,
licencia_o_declaracion: “Licencia de apertura o declaración responsable”,
dni_pagador_delante: “DNI del pagador por delante”,
dni_pagador_detras: “DNI del pagador por detrás”,
justificante_ingresos: “Justificante de ingresos”,
titularidad_bancaria: “Documento de titularidad bancaria”,
adicional: “Documentación adicional”,
};

function labelDocumento(code) {
return DOC_LABELS[code] || code || “documento”;
}

function labelsDocumentos(listText) {
return splitList(listText).map(labelDocumento);
}

// ================= DOCUMENTOS LARGOS =================
const DOCS_LARGOS = [
“contrato_alquiler”,
“escritura_constitucion”,
“poderes_representante”,
“licencia_o_declaracion”,
“libro_familia”,
];

// ================= DOCUMENTOS REQUERIDOS =================
const REQUIRED_DOCS = {
propietario: {
obligatorios: [“solicitud_firmada”, “dni_delante”, “dni_detras”],
opcionales: [“empadronamiento”],
},
familiar: {
obligatorios: [
“solicitud_firmada”,
“dni_familiar_delante”,
“dni_familiar_detras”,
“dni_propietario_delante”,
“dni_propietario_detras”,
“libro_familia”,
“autorizacion_familiar”,
],
opcionales: [“empadronamiento”],
},
inquilino: {
obligatorios: [
“solicitud_firmada”,
“dni_inquilino_delante”,
“dni_inquilino_detras”,
“dni_propietario_delante”,
“dni_propietario_detras”,
“contrato_alquiler”,
],
opcionales: [“empadronamiento”],
},
sociedad: {
obligatorios: [
“solicitud_firmada”,
“dni_administrador_delante”,
“dni_administrador_detras”,
“nif_sociedad”,
“escritura_constitucion”,
“poderes_representante”,
],
opcionales: [],
},
local: {
obligatorios: [
“solicitud_firmada”,
“dni_propietario_delante”,
“dni_propietario_detras”,
“licencia_o_declaracion”,
],
opcionales: [],
},
financiacion: {
obligatorios: [
“dni_pagador_delante”,
“dni_pagador_detras”,
“justificante_ingresos”,
“titularidad_bancaria”,
],
opcionales: [],
},
};

// ================= FLUJOS =================
const FLOWS = {
propietario: [
{ code: “solicitud_firmada”, prompt: “1️⃣ Sube la solicitud de EMASESA firmada.” },
{ code: “dni_delante”, prompt: “2️⃣ Sube una foto del DNI por la parte delantera.” },
{ code: “dni_detras”, prompt: “3️⃣ Sube una foto del DNI por la parte trasera.” },
{ code: “empadronamiento”, prompt: “4️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes.” },
],
familiar: [
{ code: “solicitud_firmada”, prompt: “1️⃣ Sube la solicitud de EMASESA firmada.” },
{ code: “dni_familiar_delante”, prompt: “2️⃣ Sube el DNI del familiar por delante.” },
{ code: “dni_familiar_detras”, prompt: “3️⃣ Sube el DNI del familiar por detrás.” },
{ code: “dni_propietario_delante”, prompt: “4️⃣ Sube el DNI del propietario por delante.” },
{ code: “dni_propietario_detras”, prompt: “5️⃣ Sube el DNI del propietario por detrás.” },
{ code: “libro_familia”, prompt: “6️⃣ Sube el libro de familia.” },
{ code: “autorizacion_familiar”, prompt: “7️⃣ Sube el documento de autorización.” },
{ code: “empadronamiento”, prompt: “8️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes.” },
],
inquilino: [
{ code: “solicitud_firmada”, prompt: “1️⃣ Sube la solicitud de EMASESA firmada.” },
{ code: “dni_inquilino_delante”, prompt: “2️⃣ Sube el DNI del inquilino por delante.” },
{ code: “dni_inquilino_detras”, prompt: “3️⃣ Sube el DNI del inquilino por detrás.” },
{ code: “dni_propietario_delante”, prompt: “4️⃣ Sube el DNI del propietario por delante.” },
{ code: “dni_propietario_detras”, prompt: “5️⃣ Sube el DNI del propietario por detrás.” },
{
code: “contrato_alquiler”,
prompt:
“6️⃣ Sube el contrato de alquiler completo y firmado. Preferiblemente en un único PDF. Si no puedes, puedes enviarlo en varias fotos y cuando termines escribe LISTO.”,
},
{ code: “empadronamiento”, prompt: “7️⃣ (Opcional) Sube el certificado de empadronamiento si lo tienes.” },
],
sociedad: [
{ code: “solicitud_firmada”, prompt: “1️⃣ Sube la solicitud de EMASESA firmada.” },
{ code: “dni_administrador_delante”, prompt: “2️⃣ Sube el DNI del administrador por delante.” },
{ code: “dni_administrador_detras”, prompt: “3️⃣ Sube el DNI del administrador por detrás.” },
{ code: “nif_sociedad”, prompt: “4️⃣ Sube el NIF/CIF de la sociedad.” },
{
code: “escritura_constitucion”,
prompt:
“5️⃣ Sube la escritura de constitución. Preferiblemente en un único PDF. Si no puedes, puedes enviarla en varias fotos y cuando termines escribe LISTO.”,
},
{
code: “poderes_representante”,
prompt:
“6️⃣ Sube los poderes del representante. Preferiblemente en un único PDF. Si no puedes, puedes enviarlos en varias fotos y cuando termines escribe LISTO.”,
},
],
local: [
{ code: “solicitud_firmada”, prompt: “1️⃣ Sube la solicitud de EMASESA firmada.” },
{ code: “dni_propietario_delante”, prompt: “2️⃣ Sube el DNI del propietario por delante.” },
{ code: “dni_propietario_detras”, prompt: “3️⃣ Sube el DNI del propietario por detrás.” },
{
code: “licencia_o_declaracion”,
prompt:
“4️⃣ Sube la licencia de apertura o la declaración responsable. Preferiblemente en un único PDF. Si no puedes, puedes enviarla en varias fotos y cuando termines escribe LISTO.”,
},
],
financiacion: [
{ code: “dni_pagador_delante”, prompt: “1️⃣ Sube el DNI del pagador por delante.” },
{ code: “dni_pagador_detras”, prompt: “2️⃣ Sube el DNI del pagador por detrás.” },
{ code: “justificante_ingresos”, prompt: “3️⃣ Sube un justificante de ingresos.” },
{ code: “titularidad_bancaria”, prompt: “4️⃣ Sube el documento de titularidad bancaria.” },
],
};

function mapTipoExpediente(texto) {
const t = (texto || “”).trim().toLowerCase();
if (t === “1” || t.includes(“propiet”)) return “propietario”;
if (t === “2” || t.includes(“familiar”)) return “familiar”;
if (t === “3” || t.includes(“inquilin”)) return “inquilino”;
if (t === “4” || t.includes(“sociedad”) || t.includes(“empresa”)) return “sociedad”;
if (t === “5” || t.includes(“local”)) return “local”;
return null;
}

function mapFinanciacion(texto) {
const t = (texto || “”).trim().toLowerCase();
if (t === “1” || t === “si” || t === “sí”) return “si”;
if (t === “2” || t === “no”) return “no”;
return null;
}

function buildPreguntaTipo(nombre) {
return `Hola ${nombre || “”} 👋 Soy el asistente de Instalaciones Araujo.

Voy a ayudarte a enviar la documentación necesaria para el Plan 5 de EMASESA.

Indica tu caso:

1. Soy propietario de la vivienda
1. El contrato irá a nombre de un familiar
1. El contrato irá a nombre de un inquilino
1. La vivienda está a nombre de una sociedad
1. Es un local comercial`;
   }

function buildPreguntaFinanciacion() {
return `Perfecto 👌

Hemos recibido la documentación base necesaria.

Última pregunta:
¿Te gustaría que estudiemos la posibilidad de financiar tu parte?

1. Sí
1. No`;
   }

// ================= IA CON CONTEXTO =================
async function responderConIA(mensaje, expediente) {
const documentoActual = labelDocumento(expediente.documento_actual);
const pendientes = labelsDocumentos(expediente.documentos_pendientes).join(”, “);
const opcionales = labelsDocumentos(expediente.documentos_opcionales_pendientes).join(”, “);
const dias = diasEntre(expediente.fecha_primer_contacto);

const promptSistema = `
Eres el asistente de Instalaciones Araujo.

Tu función es ayudar a vecinos a completar su expediente del Plan 5 de EMASESA enviando documentación por WhatsApp.

Tu objetivo NO es conversar. Tu objetivo es conseguir que el cliente envíe la documentación cuanto antes.

CONTEXTO DEL EXPEDIENTE:

- Tipo de expediente: ${expediente.tipo_expediente || “sin definir”}
- Documento actual que estamos esperando: ${documentoActual || “sin definir”}
- Documentos pendientes obligatorios: ${pendientes || “ninguno”}
- Documentos opcionales pendientes: ${opcionales || “ninguno”}
- Días transcurridos desde primer contacto: ${dias}

REGLAS:

1. Responde siempre en español.
1. Sé breve, claro y directo.
1. Mantén presión comercial sin ser agresivo.
1. No reinicies el flujo.
1. No pidas documentos que no correspondan al expediente.
1. Si el mensaje es una duda, explica brevemente y vuelve al documento pendiente.
1. Si es una excusa, mete urgencia y vuelve al documento pendiente.
1. Si depende de tercero (casero, propietario, administrador, gestor), mete presión y acción inmediata.
1. Si es un caso especial delicado (empresa compleja, local sin licencia, conflicto real), indica revisión manual por la empresa.
1. Termina casi siempre orientando al siguiente paso: enviar el documento pendiente por WhatsApp.
1. No inventes soluciones legales.
1. No hagas saludos largos.

TONO:

- profesional
- directo
- útil
- con sensación de urgencia

ESTILO DESEADO:

- una primera frase de empatía breve si aplica
- una frase de consecuencia o urgencia si aplica
- una acción concreta
- recordar el documento pendiente
  `;
  
  const fallback = `Perfecto 👍 retomamos tu expediente.

Te falta por enviar:
• ${documentoActual}

📎 Puedes enviarlo directamente por este WhatsApp.`;

if (!process.env.OPENAI_API_KEY) {
return fallback;
}

try {
// FIX #7: Añadido timeout de 4 segundos para no superar el límite de Twilio (5s)
const response = await axios.post(
“https://api.openai.com/v1/chat/completions”,
{
model: “gpt-4o-mini”,
temperature: 0.3,
messages: [
{ role: “system”, content: promptSistema },
{ role: “user”, content: mensaje },
],
},
{
timeout: 4000,
headers: {
Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
“Content-Type”: “application/json”,
},
}
);

```
const texto = response?.data?.choices?.[0]?.message?.content?.trim();
return texto || fallback;
```

} catch (error) {
console.error(“Error IA:”, error?.response?.data || error.message);
return fallback;
}
}

// ================= DRIVE =================
async function buscarCarpeta(nombre, parentId) {
const drive = getDriveClient();
const res = await drive.files.list({
q: `'${parentId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
fields: “files(id, name)”,
});
return res.data.files[0] || null;
}

async function crearCarpeta(nombre, parentId) {
const drive = getDriveClient();
const file = await drive.files.create({
requestBody: {
name: nombre,
mimeType: “application/vnd.google-apps.folder”,
parents: [parentId],
},
fields: “id, name”,
});
return file.data;
}

async function getOrCreateCarpetaTelefono(telefono) {
const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
let carpeta = await buscarCarpeta(telefono, rootId);
if (!carpeta) {
carpeta = await crearCarpeta(telefono, rootId);
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
fields: “id, name, webViewLink”,
});
return file.data;
}

// ================= SHEETS - VECINOS =================
async function buscarVecinoPorTelefono(telefono) {
const sheets = getSheetsClient();
const res = await sheets.spreadsheets.values.get({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “vecinos_base!A:E”,
});

const rows = res.data.values || [];
const telNormalizado = normalizarTelefono(telefono);

for (let i = 1; i < rows.length; i++) {
const row = rows[i];
const telFila = normalizarTelefono(row[4] || “”);
if (telFila === telNormalizado) {
return {
comunidad: row[0] || “”,
bloque: row[1] || “”,
vivienda: row[2] || “”,
nombre: row[3] || “”,
telefono: row[4] || “”,
};
}
}

return null;
}

// ================= SHEETS - CONTACTOS =================
async function guardarContacto(telefono, mensajeCliente, tipo, respuestaBot) {
const sheets = getSheetsClient();
await sheets.spreadsheets.values.append({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “contactos!A:E”,
valueInputOption: “RAW”,
requestBody: {
values: [[ahoraISO(), telefono, mensajeCliente, tipo, respuestaBot]],
},
});
}

// ================= SHEETS - AVISOS =================
async function guardarAviso(telefono, tipoAviso, estado) {
const sheets = getSheetsClient();
await sheets.spreadsheets.values.append({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “avisos!A:D”,
valueInputOption: “RAW”,
requestBody: {
values: [[telefono, tipoAviso, ahoraISO(), estado]],
},
});
}

// ================= SHEETS - EXPEDIENTES =================
async function buscarExpedientePorTelefono(telefono) {
const sheets = getSheetsClient();
const res = await sheets.spreadsheets.values.get({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “expedientes!A:R”,
});

const rows = res.data.values || [];
const telNormalizado = normalizarTelefono(telefono);

for (let i = 1; i < rows.length; i++) {
const row = rows[i];
const telFila = normalizarTelefono(row[0] || “”);

```
if (telFila === telNormalizado) {
  return {
    rowIndex: i + 1,
    telefono: row[0] || "",
    comunidad: row[1] || "",
    vivienda: row[2] || "",
    nombre: row[3] || "",
    tipo_expediente: row[4] || "",
    paso_actual: row[5] || "",
    documento_actual: row[6] || "",
    estado_expediente: row[7] || "",
    fecha_inicio: row[8] || "",
    fecha_primer_contacto: row[9] || "",
    fecha_ultimo_contacto: row[10] || "",
    fecha_limite_documentacion: row[11] || "",
    fecha_limite_firma: row[12] || "",
    documentos_completos: row[13] || "",
    alerta_plazo: row[14] || "",
    documentos_recibidos: row[15] || "",
    documentos_pendientes: row[16] || "",
    documentos_opcionales_pendientes: row[17] || "",
  };
}
```

}

return null;
}

function calcularDocsExpediente(tipoExpediente, docsRecibidosArr) {
const reglas = REQUIRED_DOCS[tipoExpediente] || { obligatorios: [], opcionales: [] };
const recibidosSet = new Set(docsRecibidosArr || []);

const obligatoriosPendientes = reglas.obligatorios.filter((d) => !recibidosSet.has(d));
const opcionalesPendientes = reglas.opcionales.filter((d) => !recibidosSet.has(d));
const completos = obligatoriosPendientes.length === 0 ? “SI” : “NO”;

return {
recibidos: joinList(docsRecibidosArr),
pendientes: joinList(obligatoriosPendientes),
opcionalesPendientes: joinList(opcionalesPendientes),
completos,
};
}

async function crearExpedienteInicial(telefono, datosVecino) {
const sheets = getSheetsClient();
const ahora = ahoraISO();
const limiteDocumentacion = sumarDias(ahora, 20);

await sheets.spreadsheets.values.append({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “expedientes!A:R”,
valueInputOption: “RAW”,
requestBody: {
values: [[
telefono,
datosVecino?.comunidad || “”,
datosVecino?.vivienda || “”,
datosVecino?.nombre || “”,
“”,
“pregunta_tipo”,
“”,
“pendiente_clasificacion”,
ahora,
ahora,
ahora,
limiteDocumentacion,
“”,
“NO”,
“ok”,
“”,
“”,
“”,
]],
},
});
}

async function actualizarExpediente(rowIndex, data) {
const sheets = getSheetsClient();
await sheets.spreadsheets.values.update({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: `expedientes!A${rowIndex}:R${rowIndex}`,
valueInputOption: “RAW”,
requestBody: {
values: [[
data.telefono || “”,
data.comunidad || “”,
data.vivienda || “”,
data.nombre || “”,
data.tipo_expediente || “”,
data.paso_actual || “”,
data.documento_actual || “”,
data.estado_expediente || “”,
data.fecha_inicio || “”,
data.fecha_primer_contacto || “”,
data.fecha_ultimo_contacto || “”,
data.fecha_limite_documentacion || “”,
data.fecha_limite_firma || “”,
data.documentos_completos || “”,
data.alerta_plazo || “”,
data.documentos_recibidos || “”,
data.documentos_pendientes || “”,
data.documentos_opcionales_pendientes || “”,
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
async function guardarDocumentoSheet(
telefono,
comunidad,
vivienda,
tipoDocumento,
nombreArchivo,
urlDrive,
origenClasificacion
) {
const sheets = getSheetsClient();
await sheets.spreadsheets.values.append({
spreadsheetId: process.env.GOOGLE_SHEETS_ID,
range: “documentos!A:H”,
valueInputOption: “RAW”,
requestBody: {
values: [[
telefono,
comunidad,
vivienda,
tipoDocumento,
nombreArchivo,
ahoraISO(),
urlDrive || “”,
origenClasificacion || “”,
]],
},
});
}

// ================= FLOW HELPERS =================

// FIX #2: getNextStep ya no devuelve flow[0] si el documento no se encuentra,
// devuelve null para evitar reiniciar el flujo accidentalmente
function getNextStep(tipoExpediente, currentDocCode) {
const flow = FLOWS[tipoExpediente] || [];
const index = flow.findIndex((d) => d.code === currentDocCode);

if (index === -1) return null; // Era: flow[0] — causaba reinicio accidental
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

const listaPendientes = pendientes.join(”\n- “);

if (dias >= 20) {
return {
tipo: “fuera_plazo”,
alerta: “fuera_plazo”,
mensaje: `⚠️ ÚLTIMO AVISO – Plazo finalizado

Sigue pendiente:

- ${listaPendientes}

❗ Tu expediente puede quedar bloqueado y no continuar con la tramitación.

👉 Envíalo URGENTEMENTE por este mismo WhatsApp para que podamos revisar si aún es posible incorporarlo.

No lo dejes pasar.`,
};
}

if (dias >= 18) {
return {
tipo: “aviso_urgente”,
alerta: “urgente”,
mensaje: `⏳ Aviso importante – Plazo casi finalizado

Tu expediente sigue incompleto.

Falta:

- ${listaPendientes}

⚠️ Si no lo envías a tiempo, el expediente puede quedar paralizado.

Envíalo ahora por este WhatsApp.`,
};
}

if (dias >= 10) {
return {
tipo: “aviso_10_dias”,
alerta: “aviso_10_dias”,
mensaje: `📌 Recordatorio importante

Todavía falta documentación para completar tu expediente:

- ${listaPendientes}

📎 Puedes enviarla directamente por aquí.

👉 No lo dejes para el final.`,
};
}

return null;
}

async function revisarYAvisarPorPlazo(expediente) {
const aviso = construirAvisoPorPlazo(expediente);

if (!aviso) {
if (expediente.alerta_plazo !== “ok”) {
expediente.alerta_plazo = “ok”;
await actualizarExpediente(expediente.rowIndex, expediente);
}
return null;
}

if (expediente.alerta_plazo !== aviso.alerta) {
expediente.alerta_plazo = aviso.alerta;
await actualizarExpediente(expediente.rowIndex, expediente);
await guardarAviso(expediente.telefono, aviso.tipo, “enviado”);
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
console.error(“ERROR guardando contacto:”, e.message);
}

return res.type(“text/xml”).send(twiml.toString());
}

// ================= PROCESAMIENTO DE UN ARCHIVO =================
// FIX #5: Extraído a función para poder procesar múltiples archivos (MediaUrl0, MediaUrl1…)
async function procesarArchivo(mediaUrl, mimeType, telefono, carpetaId, expediente, datosVecino, contexto) {
const response = await axios.get(mediaUrl, {
responseType: “arraybuffer”,
auth: {
username: process.env.TWILIO_ACCOUNT_SID,
password: process.env.TWILIO_AUTH_TOKEN,
},
});

const extension = extensionDesdeMime(mimeType);
const fileName = `${contexto}_${telefono}_${Date.now()}${extension}`;

// FIX #8: Errores de Drive/Sheets se capturan con contexto detallado
let file;
try {
file = await uploadToDrive(Buffer.from(response.data), fileName, mimeType, carpetaId);
} catch (err) {
console.error(`ERROR uploadToDrive [telefono=${telefono}, archivo=${fileName}]:`, err.message);
throw err;
}

try {
await guardarDocumentoSheet(
telefono,
datosVecino.comunidad,
datosVecino.vivienda,
contexto,
fileName,
file.webViewLink || “”,
“flujo”
);
} catch (err) {
console.error(`ERROR guardarDocumentoSheet [telefono=${telefono}, doc=${contexto}]:`, err.message);
// No relanzamos: el archivo ya está en Drive, solo falla el log
}

return file;
}

// ================= RUTAS =================
app.get(”/”, (req, res) => {
res.send(“Servidor OK”);
});

app.post(”/whatsapp”, async (req, res) => {
try {
const msgOriginal = (req.body.Body || “”).trim();
const msg = msgOriginal.toLowerCase();
const numMedia = parseInt(req.body.NumMedia || “0”, 10);
const telefono = (req.body.From || “”).replace(“whatsapp:”, “”);

```
const datosVecino = await buscarVecinoPorTelefono(telefono);

if (!datosVecino) {
  return responderYLog(
    res,
    telefono,
    msgOriginal || "sin_texto",
    numMedia > 0 ? "archivo" : "texto",
    "Tu número no está en el listado inicial de la comunidad. Contacta con Instalaciones Araujo para validarlo."
  );
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
    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      "texto",
      buildPreguntaTipo(datosVecino.nombre)
    );
  }

  const primerPaso = getFirstStep(tipo);

  expediente.tipo_expediente = tipo;
  expediente.paso_actual = "recogida_documentacion";
  expediente.documento_actual = primerPaso ? primerPaso.code : "";
  expediente.estado_expediente = "en_proceso";
  expediente.fecha_ultimo_contacto = ahoraISO();
  expediente = refrescarResumenDocumental(expediente);

  await actualizarExpediente(expediente.rowIndex, expediente);

  return responderYLog(
    res,
    telefono,
    msgOriginal,
    "texto",
    `Perfecto ✅
```

Caso identificado: ${tipo}.

${primerPaso ? primerPaso.prompt : “Empezamos.”}`
);
}

```
// ================= LISTO PARA DOCUMENTOS LARGOS =================
if (
  numMedia === 0 &&
  expediente.paso_actual === "recogida_documentacion" &&
  msg === "listo"
) {
  const docsRecibidosArr = splitList(expediente.documentos_recibidos);

  if (
    expediente.documento_actual &&
    !docsRecibidosArr.includes(expediente.documento_actual)
  ) {
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

    return responderYLog(
      res,
      telefono,
      msgOriginal,
      "texto",
      `Perfecto 👍
```

Documento completo recibido.

Seguimos:
${siguiente.prompt}`
);
} else {
expediente.paso_actual = “pregunta_financiacion”;
expediente.documento_actual = “”;
expediente.estado_expediente = “documentacion_base_completa”;
await actualizarExpediente(expediente.rowIndex, expediente);

```
    return responderYLog(
      res,
      telefono,
      msgOriginal,
      "texto",
      `Perfecto ✅
```

Documento completo recibido.

${buildPreguntaFinanciacion()}`
);
}
}

```
// ================= TEXTO DURANTE RECOGIDA DOCUMENTACION =================
if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion") {
  const mensajePlazo = await revisarYAvisarPorPlazo(expediente);

  if (mensajePlazo) {
    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      "texto",
      mensajePlazo
    );
  }

  const mensajeNormalizado = (msgOriginal || "").trim().toLowerCase();

  const quiereSaltarOpcional =
    mensajeNormalizado === "no" ||
    mensajeNormalizado === "no lo tengo" ||
    mensajeNormalizado === "no dispongo" ||
    mensajeNormalizado === "no puedo" ||
    mensajeNormalizado === "paso" ||
    mensajeNormalizado === "siguiente" ||
    mensajeNormalizado === "no lo encuentro";

  if (
    esDocumentoOpcional(expediente.tipo_expediente, expediente.documento_actual) &&
    quiereSaltarOpcional
  ) {
    expediente.fecha_ultimo_contacto = ahoraISO();

    const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);

    if (siguiente) {
      expediente.documento_actual = siguiente.code;
      expediente.estado_expediente = "en_proceso";
      await actualizarExpediente(expediente.rowIndex, expediente);

      return responderYLog(
        res,
        telefono,
        msgOriginal || "sin_texto",
        "texto",
        `Perfecto 👍
```

Continuamos sin ese documento opcional.

Seguimos:
${siguiente.prompt}`
);
} else {
expediente.paso_actual = “pregunta_financiacion”;
expediente.documento_actual = “”;
expediente.estado_expediente = “documentacion_base_completa”;
expediente.fecha_ultimo_contacto = ahoraISO();
await actualizarExpediente(expediente.rowIndex, expediente);

```
      return responderYLog(
        res,
        telefono,
        msgOriginal || "sin_texto",
        "texto",
        `Perfecto 👍
```

Continuamos sin ese documento opcional.

${buildPreguntaFinanciacion()}`
);
}
}

```
  if (DOCS_LARGOS.includes(expediente.documento_actual)) {
    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      "texto",
      `Ahora mismo estamos esperando este documento:
```

• ${labelDocumento(expediente.documento_actual)}

📄 Preferiblemente envíalo en un único PDF completo.
Si no puedes, puedes mandarlo en varias fotos.

Cuando termines de enviar todas las páginas, escribe LISTO.`
);
}

```
  const respuestaIA = await responderConIA(msgOriginal, expediente);

  return responderYLog(
    res,
    telefono,
    msgOriginal || "sin_texto",
    "texto",
    respuestaIA
  );
}

// ================= PREGUNTA FINANCIACION =================
if (numMedia === 0 && expediente.paso_actual === "pregunta_financiacion") {
  const respuestaFin = mapFinanciacion(msg);

  if (!respuestaFin) {
    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      "texto",
      buildPreguntaFinanciacion()
    );
  }

  if (respuestaFin === "no") {
    expediente.paso_actual = "finalizado";
    expediente.documento_actual = "";
    expediente.estado_expediente = "documentacion_base_completa";
    expediente.fecha_ultimo_contacto = ahoraISO();
    expediente = refrescarResumenDocumental(expediente);

    await actualizarExpediente(expediente.rowIndex, expediente);

    return responderYLog(
      res,
      telefono,
      msgOriginal,
      "texto",
      "Perfecto ✅ Proceso base finalizado. Nuestro equipo revisará la documentación y te avisará si falta algo."
    );
  }

  const primerPasoFin = getFirstStep("financiacion");
  expediente.paso_actual = "recogida_financiacion";
  expediente.documento_actual = primerPasoFin.code;
  expediente.estado_expediente = "pendiente_financiacion";
  expediente.fecha_ultimo_contacto = ahoraISO();

  await actualizarExpediente(expediente.rowIndex, expediente);

  return responderYLog(
    res,
    telefono,
    msgOriginal,
    "texto",
    `Perfecto 💰
```

Vamos a estudiar la financiación.

${primerPasoFin.prompt}`
);
}

```
// ================= TEXTO DURANTE FINANCIACION =================
if (numMedia === 0 && expediente.paso_actual === "recogida_financiacion") {
  const mensajePlazo = await revisarYAvisarPorPlazo(expediente);

  if (mensajePlazo) {
    return responderYLog(
      res,
      telefono,
      msgOriginal || "sin_texto",
      "texto",
      mensajePlazo
    );
  }

  const respuestaIA = await responderConIA(msgOriginal, expediente);

  return responderYLog(
    res,
    telefono,
    msgOriginal || "sin_texto",
    "texto",
    respuestaIA
  );
}

// ================= SI MANDA ARCHIVO(S) =================
if (numMedia > 0) {
  const carpetaId = await getOrCreateCarpetaTelefono(telefono);

  // FIX #1: La condición para archivos fuera de flujo ahora está CORRECTAMENTE separada
  // del bloque principal, evaluando explícitamente los pasos válidos.
  const esPasoValido =
    expediente.paso_actual === "recogida_documentacion" ||
    expediente.paso_actual === "recogida_financiacion";

  if (!esPasoValido) {
    // Archivos recibidos fuera del flujo activo
    const docsRecibidosArr = splitList(expediente.documentos_recibidos);
    const opcionalesPendientes = splitList(expediente.documentos_opcionales_pendientes);

    // FIX #5: Procesar todos los archivos enviados, no solo MediaUrl0
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = req.body[`MediaUrl${i}`];
      const mimeType = req.body[`MediaContentType${i}`] || "application/octet-stream";

      let tipoDocumento = "adicional";

      if (opcionalesPendientes.includes("empadronamiento")) {
        tipoDocumento = "empadronamiento";
        if (!docsRecibidosArr.includes("empadronamiento")) {
          docsRecibidosArr.push("empadronamiento");
        }
      }

      try {
        await procesarArchivo(mediaUrl, mimeType, telefono, carpetaId, expediente, datosVecino, tipoDocumento);
      } catch (err) {
        console.error(`ERROR procesando archivo fuera de flujo [i=${i}]:`, err.message);
      }
    }

    if (opcionalesPendientes.includes("empadronamiento")) {
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);
    } else {
      expediente.fecha_ultimo_contacto = ahoraISO();
    }

    await actualizarExpediente(expediente.rowIndex, expediente);

    return responderYLog(
      res,
      telefono,
      "archivo",
      "archivo",
      opcionalesPendientes.includes("empadronamiento")
        ? "Documento recibido correctamente ✅ Lo incorporamos a tu expediente como documentación adicional."
        : "Documentación adicional recibida correctamente ✅ La incorporamos a tu expediente para revisión."
    );
  }

  // ---- Flujo activo (recogida_documentacion o recogida_financiacion) ----

  // FIX #3: Anti race-condition — leemos el expediente fresco justo antes de escribir
  // para minimizar la ventana de conflicto en envíos rápidos consecutivos
  const expedienteFresco = await buscarExpedientePorTelefono(telefono);
  if (expedienteFresco) {
    // Fusionamos documentos_recibidos con lo que ya había en Sheets
    const yaRecibidos = splitList(expedienteFresco.documentos_recibidos);
    const enMemoria = splitList(expediente.documentos_recibidos);
    const merged = Array.from(new Set([...yaRecibidos, ...enMemoria]));
    expediente.documentos_recibidos = joinList(merged);
  }

  // FIX #5: Procesar todos los archivos, no solo MediaUrl0
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = req.body[`MediaUrl${i}`];
    const mimeType = req.body[`MediaContentType${i}`] || "application/octet-stream";

    try {
      await procesarArchivo(
        mediaUrl,
        mimeType,
        telefono,
        carpetaId,
        expediente,
        datosVecino,
        expediente.documento_actual || "pendiente_clasificar"
      );
    } catch (err) {
      console.error(`ERROR procesando archivo en flujo [i=${i}]:`, err.message);
    }
  }

  // Usamos el mimeType del primer archivo para decidir si es PDF (lógica de documento largo)
  const mimeTypePrincipal = req.body.MediaContentType0 || "application/octet-stream";
  const esPDF = mimeTypePrincipal.includes("pdf");
  const esDocumentoLargo = DOCS_LARGOS.includes(expediente.documento_actual);

  expediente.fecha_ultimo_contacto = ahoraISO();

  // ================= DOCUMENTO LARGO EN PDF = COMPLETO =================
  if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && esPDF) {
    const docsRecibidosArr = splitList(expediente.documentos_recibidos);

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

      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        `Documento recibido correctamente ✅
```

PDF completo recibido.

Seguimos:
${siguiente.prompt}`
);
} else {
expediente.paso_actual = “pregunta_financiacion”;
expediente.documento_actual = “”;
expediente.estado_expediente = “documentacion_base_completa”;
await actualizarExpediente(expediente.rowIndex, expediente);

```
      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        `Documento recibido correctamente ✅
```

PDF completo recibido.

${buildPreguntaFinanciacion()}`
);
}
}

```
  // ================= DOCUMENTO LARGO EN FOTOS =================
  if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && !esPDF) {
    await actualizarExpediente(expediente.rowIndex, expediente);

    return responderYLog(
      res,
      telefono,
      "archivo",
      "archivo",
      `Página recibida correctamente ✅
```

Puedes seguir enviando más páginas de este documento.

Cuando termines, escribe LISTO.`
);
}

```
  // ================= DOCUMENTO NORMAL =================
  const docsRecibidosArr = splitList(expediente.documentos_recibidos);

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

      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        `Documento recibido correctamente ✅
```

Seguimos:
${siguiente.prompt}`
);
} else {
expediente.paso_actual = “pregunta_financiacion”;
expediente.documento_actual = “”;
expediente.estado_expediente = “documentacion_base_completa”;
expediente = refrescarResumenDocumental(expediente);
await actualizarExpediente(expediente.rowIndex, expediente);

```
      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        `Documento recibido correctamente ✅
```

${buildPreguntaFinanciacion()}`
);
}
}

```
  if (expediente.paso_actual === "recogida_financiacion") {
    const siguienteFin = getNextStep("financiacion", expediente.documento_actual);

    if (siguienteFin) {
      expediente.documento_actual = siguienteFin.code;
      expediente.estado_expediente = "pendiente_financiacion";
      await actualizarExpediente(expediente.rowIndex, expediente);

      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        `Documento recibido correctamente ✅
```

Seguimos:
${siguienteFin.prompt}`
);
} else {
// FIX #4: Se llama a refrescarResumenDocumental antes de guardar,
// en lugar de asignar documentos_completos = “SI” manualmente
expediente.paso_actual = “finalizado”;
expediente.documento_actual = “”;
expediente.estado_expediente = “pendiente_estudio_financiacion”;
expediente.fecha_ultimo_contacto = ahoraISO();
expediente = refrescarResumenDocumental(expediente);

```
      await actualizarExpediente(expediente.rowIndex, expediente);

      return responderYLog(
        res,
        telefono,
        "archivo",
        "archivo",
        "Perfecto ✅ Hemos recibido toda la documentación base y la de financiación. Nuestro equipo la revisará y te contactará."
      );
    }
  }
}

return responderYLog(
  res,
  telefono,
  msgOriginal || "sin_texto",
  numMedia > 0 ? "archivo" : "texto",
  "Mensaje recibido."
);
```

} catch (error) {
console.error(“ERROR GENERAL:”, error);

```
const twiml = new twilio.twiml.MessagingResponse();
twiml.message("Ha habido un problema procesando tu mensaje.");

return res.type("text/xml").send(twiml.toString());
```

}
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log(“Servidor corriendo en puerto”, PORT);
});