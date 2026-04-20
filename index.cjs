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
function getDriveClient() { return google.drive({ version: "v3", auth: getGoogleAuth() }); }
function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }

// ================= HELPERS =================
function ahoraISO() { return new Date().toISOString(); }
function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}
function diasEntre(fechaIso) {
  if (!fechaIso) return 0;
  return Math.floor((new Date() - new Date(fechaIso)) / (1000 * 60 * 60 * 24));
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
function joinList(arr) { return (arr || []).filter(Boolean).join(","); }
function splitList(text) { return (text || "").split(",").map((x) => x.trim()).filter(Boolean); }

const DOC_LABELS = {
  solicitud_firmada: "Solicitud de EMASESA firmada",
  dni_delante: "DNI por la parte delantera",
  dni_detras: "DNI por la parte trasera",
  dni_familiar_delante: "DNI del familiar por delante",
  dni_familiar_detras: "DNI del familiar por detras",
  dni_propietario_delante: "DNI del propietario por delante",
  dni_propietario_detras: "DNI del propietario por detras",
  dni_inquilino_delante: "DNI del inquilino por delante",
  dni_inquilino_detras: "DNI del inquilino por detras",
  dni_administrador_delante: "DNI del administrador por delante",
  dni_administrador_detras: "DNI del administrador por detras",
  libro_familia: "Libro de familia",
  autorizacion_familiar: "Documento de autorizacion",
  contrato_alquiler: "Contrato de alquiler completo y firmado",
  empadronamiento: "Certificado de empadronamiento",
  nif_sociedad: "NIF/CIF de la sociedad",
  escritura_constitucion: "Escritura de constitucion",
  poderes_representante: "Poderes del representante",
  licencia_o_declaracion: "Licencia de apertura o declaracion responsable",
  dni_pagador_delante: "DNI del pagador por delante",
  dni_pagador_detras: "DNI del pagador por detras",
  justificante_ingresos: "Justificante de ingresos",
  titularidad_bancaria: "Documento de titularidad bancaria",
  adicional: "Documentacion adicional",
};
function labelDocumento(code) { return DOC_LABELS[code] || code || "documento"; }
function labelsDocumentos(listText) { return splitList(listText).map(labelDocumento); }

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
function esDocumentoImagenNormalizable(mimeType) { return (mimeType || "").startsWith("image/"); }
function nombreProcesado(fileName) {
  const p = fileName.lastIndexOf(".");
  return p === -1 ? fileName + "_procesado.jpg" : fileName.slice(0, p) + "_procesado.jpg";
}

// ================= ESTADOS DE DOCUMENTO Y EXPEDIENTE =================
// Documento: OK | REVISAR | REPETIR
// Expediente: expediente_limpio | expediente_con_revision_pendiente |
//             expediente_con_documento_a_repetir | expediente_final_pendiente_revision

function calcularEstadoAgregadoExpediente(estadosDocumentos) {
  const tieneRepetir = estadosDocumentos.some((e) => e === "REPETIR");
  const tieneRevisar = estadosDocumentos.some((e) => e === "REVISAR");
  if (tieneRepetir) return "expediente_con_documento_a_repetir";
  if (tieneRevisar) return "expediente_con_revision_pendiente";
  return "expediente_limpio";
}

// Lee todos los documentos del telefono desde Sheets, se queda con el ultimo estado
// por tipoDocumento y recalcula el estado agregado real del expediente.
async function recalcularYActualizarEstadoExpediente(expediente) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:I",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(expediente.telefono);

    // POLITICA DE ESTADO VIGENTE POR DOCUMENTO: mejor historico
    // Usamos el mejor estado que haya existido para cada tipo de documento.
    // Razon: un archivo extra o de peor calidad no debe invalidar uno ya validado.
    // Consecuencia: si el vecino mando algo bueno una vez, ese documento sigue OK
    // aunque luego mande algo mas. Esto es intencionado para este caso de uso.
    // Si en el futuro se quiere cambiar a "ultimo intento": quitar la condicion
    // de prioridad y simplemente sobreescribir con el ultimo estado.
    const prioridad = { "OK": 0, "REVISAR": 1, "REPETIR": 2 };
    const mejorEstadoPorTipo = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      const tipo = row[3] || "";
      const estado = row[8] || "OK";
      if (!tipo || tipo === "adicional" || tipo === "pendiente_clasificar") continue;
      const previo = mejorEstadoPorTipo[tipo];
      if (!previo || (prioridad[estado] !== undefined && prioridad[estado] < (prioridad[previo] || 99))) {
        mejorEstadoPorTipo[tipo] = estado;
      }
    }
    const ultimoEstadoPorTipo = mejorEstadoPorTipo;

    const estadosReales = Object.values(ultimoEstadoPorTipo);
    if (estadosReales.length === 0) return;

    const estadoAgregado = calcularEstadoAgregadoExpediente(estadosReales);

    // Estados finales del flujo
    const pasosFinal = ["finalizado", "documentacion_base_completa", "pendiente_estudio_financiacion"];
    const esFaseFinal = pasosFinal.includes(expediente.paso_actual);

    // Estados sucios que pueden limpiarse
    const estadosSucios = [
      "expediente_con_documento_a_repetir",
      "expediente_con_revision_pendiente",
      "expediente_final_pendiente_revision",
    ];

    let nuevoEstado;
    if (esFaseFinal) {
      // Politica simple en fase final:
      // - hay incidencias  -> expediente_final_pendiente_revision
      // - no hay incidencias -> estado final operativo correcto segun el paso actual
      if (estadoAgregado !== "expediente_limpio") {
        nuevoEstado = "expediente_final_pendiente_revision";
      } else {
        // Derivar el estado final limpio desde si existen docs de financiacion,
        // no desde el estado_expediente actual (que puede estar sucio).
        // Asi si estaba en pendiente_estudio_financiacion, se suco, y luego
        // se limpia, vuelve correctamente a pendiente_estudio_financiacion.
        const hayFinanciacion = await tieneDocumentacionFinanciacion(expediente.telefono);
        nuevoEstado = hayFinanciacion
          ? "pendiente_estudio_financiacion"
          : "documentacion_base_completa";
      }
    } else {
      // Durante el flujo activo:
      // - hay incidencias -> marcar el estado agregado correspondiente
      // - no hay incidencias -> si estaba sucio, limpiar; si no, conservar
      if (estadoAgregado !== "expediente_limpio") {
        nuevoEstado = estadoAgregado;
      } else {
        nuevoEstado = estadosSucios.includes(expediente.estado_expediente)
          ? "expediente_limpio"
          : expediente.estado_expediente;
      }
    }

    if (nuevoEstado && nuevoEstado !== expediente.estado_expediente) {
      expediente.estado_expediente = nuevoEstado;
      await actualizarExpediente(expediente.rowIndex, expediente);
    }
  } catch (e) {
    console.error("Error recalculando estado expediente:", e.message);
  }
}

function mensajeParaVecino(estadoDocumento, motivo, siguiente) {
  if (estadoDocumento === "OK") {
    return siguiente
      ? "Documento recibido correctamente\n\nSeguimos:\n" + siguiente
      : "Documento recibido correctamente";
  }
  if (estadoDocumento === "REVISAR") {
    return siguiente
      ? "Documento recibido Lo vamos a revisar internamente. De momento seguimos:\n\n" + siguiente
      : "Documento recibido Lo vamos a revisar internamente.";
  }
  if (estadoDocumento === "REPETIR") {
    return "Archivo recibido, pero ese documento concreto no es valido"
      + (motivo ? " (" + motivo + ")" : "")
      + " y habra que reenviarlo.\n\nEse documento queda pendiente: te avisaremos cuando toque revisarlo.\n\nPuedes seguir con el resto ahora."
      + (siguiente ? "\n\nSeguimos:\n" + siguiente : "");
  }
  return siguiente ? "Documento recibido\n\nSeguimos:\n" + siguiente : "Documento recibido";
}

// ================= PROCESAMIENTO DE IMAGEN =================
async function normalizarImagenDocumento(buffer) {
  try {
    const img = sharp(buffer).rotate();
    await img.metadata();
    const processedBuffer = await img
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .normalise().sharpen().jpeg({ quality: 90 })
      .toBuffer();
    return { ok: true, buffer: processedBuffer };
  } catch (error) {
    console.error("Error normalizando imagen:", error.message);
    return { ok: false };
  }
}

async function validarImagenTecnica(buffer) {
  try {
    const image = sharp(buffer).greyscale();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return { ok: false, estado: "REPETIR", motivo: "no hemos podido leer bien la imagen" };
    if (meta.width < 500 || meta.height < 300) return { ok: false, estado: "REPETIR", motivo: "la imagen es demasiado pequena" };
    const { data, info } = await image.resize(300, 200, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    let suma = 0, min = 255, max = 0;
    for (let i = 0; i < data.length; i++) { const v = data[i]; suma += v; if (v < min) min = v; if (v > max) max = v; }
    const media = suma / data.length;
    if (media < 35) return { ok: false, estado: "REPETIR", motivo: "la imagen esta demasiado oscura" };
    let nitidez = 0, count = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 1; x < info.width; x++) {
        nitidez += Math.abs(data[y * info.width + x] - data[y * info.width + (x - 1)]);
        count++;
      }
    }
    const nitidezMedia = count ? nitidez / count : 0;
    const rango = max - min;
    if (nitidezMedia < 3) return { ok: false, estado: "REPETIR", motivo: "la imagen esta borrosa o fuera de foco" };
    if (rango < 20) return { ok: false, estado: "REPETIR", motivo: "la imagen tiene poco contraste" };
    if (nitidezMedia < 6 || media < 45) return { ok: true, estado: "REVISAR", motivo: "la imagen no tiene una calidad del todo clara" };
    return { ok: true, estado: "OK", motivo: "" };
  } catch (error) {
    console.error("Error validando imagen:", error.message);
    return { ok: false, estado: "REVISAR", motivo: "no se pudo revisar la imagen correctamente" };
  }
}

// ================= IA: FUNCIONES ESPECÍFICAS POR DOCUMENTO =================

// Llamada base a OpenAI con imagen
async function llamarIAconImagen(systemPrompt, base64, timeout) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Analiza este documento." },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } },
          ]},
        ],
      },
      {
        timeout: timeout || 4000,
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      }
    );
    const texto = response && response.data && response.data.choices && response.data.choices[0]
      ? response.data.choices[0].message.content : "";
    const limpio = texto.replace(/```json/g, "").replace(/```/g, "").trim();
    try { return JSON.parse(limpio); } catch (e) { console.error("JSON IA invalido:", texto); return null; }
  } catch (error) {
    console.error("Error IA:", error && error.response ? error.response.data : error.message);
    return null;
  }
}

// ===== DNI =====
async function analizarDNIconIA(buffer, documentoActual) {
  const base64 = buffer.toString("base64");
  const resultado = await llamarIAconImagen(
    "Analiza esta imagen. Responde SOLO en JSON:\n{\"tipo\": \"dni_delante | dni_detras | otro | dudoso\", \"confianza\": 0-100}\ndni_delante=cara+datos personales, dni_detras=codigo barras/MRZ, otro=no es DNI, dudoso=no se ve claro",
    base64,
    4000
  );
  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo verificar el DNI automaticamente" };

  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece un DNI" };
  if (resultado.tipo === "dudoso") return { estadoDocumento: "REVISAR", motivo: "no se pudo verificar completamente el DNI" };
  if (documentoActual && documentoActual.includes("delante") && resultado.tipo === "dni_detras") {
    return { estadoDocumento: "REPETIR", motivo: "has enviado la parte trasera del DNI y necesitamos la delantera" };
  }
  if (documentoActual && documentoActual.includes("detras") && resultado.tipo === "dni_delante") {
    return { estadoDocumento: "REPETIR", motivo: "has enviado la parte delantera del DNI y necesitamos la trasera" };
  }
  return { estadoDocumento: "OK", motivo: "" };
}

// ===== SOLICITUD FIRMADA =====
async function analizarSolicitudFirmadaConIA(buffer) {
  const base64 = buffer.toString("base64");
  const resultado = await llamarIAconImagen(
    "Analiza este documento. Es una solicitud de alta de agua de EMASESA (empresa de agua de Sevilla).\n\nResponde SOLO en JSON con este formato exacto:\n{\n  \"tipo\": \"solicitud_firmada | otro | dudoso\",\n  \"firma_detectada\": \"si | no | dudoso\",\n  \"completo\": \"si | no | dudoso\",\n  \"confianza\": 0,\n  \"motivo\": \"\"\n}\n\nReglas:\n- tipo solicitud_firmada: parece un formulario administrativo con campos rellenables\n- firma_detectada: si=firma manuscrita visible, no=no hay firma, dudoso=no se aprecia bien\n- completo: si=documento completo, no=cortado o incompleto, dudoso=no se puede determinar\n- confianza: 0-100\n- motivo: descripcion breve de lo que ves",
    base64,
    4000
  );

  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo analizar la solicitud automaticamente" };

  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece la solicitud de EMASESA" };
  if (resultado.tipo === "dudoso") return { estadoDocumento: "REVISAR", motivo: "no se aprecia bien la solicitud" };

  // Es solicitud_firmada
  if (resultado.firma_detectada === "no") {
    return { estadoDocumento: "REPETIR", motivo: "no se aprecia firma en la solicitud" };
  }
  if (resultado.firma_detectada === "dudoso" || resultado.completo === "no" || resultado.completo === "dudoso" || resultado.confianza < 50) {
    return { estadoDocumento: "REVISAR", motivo: resultado.motivo || "la solicitud necesita revision" };
  }
  return { estadoDocumento: "OK", motivo: "" };
}

// ===== DOCUMENTO LARGO (contrato, escritura, etc.) =====
async function analizarDocumentoLargoConIA(buffer, tipoDocumento) {
  const base64 = buffer.toString("base64");
  const descripcion = labelDocumento(tipoDocumento);
  const resultado = await llamarIAconImagen(
    "Analiza este documento. Se espera que sea: " + descripcion + "\n\nResponde SOLO en JSON:\n{\n  \"tipo\": \"correcto | otro | dudoso\",\n  \"legible\": true,\n  \"confianza\": 0-100,\n  \"motivo\": \"texto corto\"\n}\n\ncorrecto: parece el tipo de documento esperado\notro: claramente no es ese documento\ndudoso: no se puede determinar bien",
    base64,
    4000
  );

  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo analizar el documento automaticamente" };
  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece ser " + descripcion };
  if (resultado.tipo === "dudoso" || resultado.legible === false || resultado.confianza < 50) {
    return { estadoDocumento: "REVISAR", motivo: resultado.motivo || "el documento necesita revision" };
  }
  return { estadoDocumento: "OK", motivo: "" };
}

// ===== DOCUMENTO GENERICO =====
async function analizarDocumentoGenericoConIA(buffer, tipoDocumento) {
  const base64 = buffer.toString("base64");
  const descripcion = labelDocumento(tipoDocumento);
  const resultado = await llamarIAconImagen(
    "Analiza este documento. Se espera que sea: " + descripcion + "\n\nResponde SOLO en JSON:\n{\n  \"tipo\": \"correcto | otro | dudoso\",\n  \"legible\": true,\n  \"confianza\": 0-100,\n  \"motivo\": \"texto corto\"\n}\n\ncorrecto: parece coherente con lo esperado\notro: no tiene nada que ver\ndudoso: no se puede determinar",
    base64,
    4000
  );

  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo analizar el documento" };
  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece ser " + descripcion };
  if (resultado.tipo === "dudoso" || resultado.legible === false || resultado.confianza < 40) {
    return { estadoDocumento: "REVISAR", motivo: resultado.motivo || "el documento necesita revision" };
  }
  return { estadoDocumento: "OK", motivo: "" };
}

// ===== ROUTER: elige qué función usar según el tipo de documento =====
const DOCS_CON_IA = [
  "solicitud_firmada",
  "dni_delante", "dni_detras",
  "dni_familiar_delante", "dni_familiar_detras",
  "dni_propietario_delante", "dni_propietario_detras",
  "dni_inquilino_delante", "dni_inquilino_detras",
  "dni_administrador_delante", "dni_administrador_detras",
  "dni_pagador_delante", "dni_pagador_detras",
  "contrato_alquiler", "escritura_constitucion",
  "poderes_representante", "licencia_o_declaracion",
  "libro_familia", "autorizacion_familiar",
  "nif_sociedad", "justificante_ingresos",
  "titularidad_bancaria", "empadronamiento",
];

async function analizarDocumentoConIA(buffer, tipoDocumento) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!DOCS_CON_IA.includes(tipoDocumento)) return null;

  if (esDocumentoDNI(tipoDocumento)) return await analizarDNIconIA(buffer, tipoDocumento);
  if (tipoDocumento === "solicitud_firmada") return await analizarSolicitudFirmadaConIA(buffer);
  if (["contrato_alquiler", "escritura_constitucion", "poderes_representante", "licencia_o_declaracion", "libro_familia"].includes(tipoDocumento)) {
    return await analizarDocumentoLargoConIA(buffer, tipoDocumento);
  }
  return await analizarDocumentoGenericoConIA(buffer, tipoDocumento);
}

// ================= DETERMINAR ESTADO FINAL DEL DOCUMENTO =================
function determinarEstadoFinal(validacionTecnica, analisisIA) {
  // REPETIR tiene siempre prioridad
  if (validacionTecnica.estado === "REPETIR") {
    return { estadoDocumento: "REPETIR", motivo: validacionTecnica.motivo };
  }
  if (analisisIA && analisisIA.estadoDocumento === "REPETIR") {
    return { estadoDocumento: "REPETIR", motivo: analisisIA.motivo };
  }
  // REVISAR si alguno lo dice
  if (validacionTecnica.estado === "REVISAR") {
    return { estadoDocumento: "REVISAR", motivo: validacionTecnica.motivo };
  }
  if (analisisIA && analisisIA.estadoDocumento === "REVISAR") {
    return { estadoDocumento: "REVISAR", motivo: analisisIA.motivo };
  }
  // OK si todo pasa
  return { estadoDocumento: "OK", motivo: "" };
}

// ================= DOCUMENTOS LARGOS =================
const DOCS_LARGOS = [
  "contrato_alquiler", "escritura_constitucion",
  "poderes_representante", "licencia_o_declaracion", "libro_familia",
];

// ================= DOCUMENTOS REQUERIDOS =================
const REQUIRED_DOCS = {
  propietario: { obligatorios: ["solicitud_firmada", "dni_delante", "dni_detras"], opcionales: ["empadronamiento"] },
  familiar: { obligatorios: ["solicitud_firmada", "dni_familiar_delante", "dni_familiar_detras", "dni_propietario_delante", "dni_propietario_detras", "libro_familia", "autorizacion_familiar"], opcionales: ["empadronamiento"] },
  inquilino: { obligatorios: ["solicitud_firmada", "dni_inquilino_delante", "dni_inquilino_detras", "dni_propietario_delante", "dni_propietario_detras", "contrato_alquiler"], opcionales: ["empadronamiento"] },
  sociedad: { obligatorios: ["solicitud_firmada", "dni_administrador_delante", "dni_administrador_detras", "nif_sociedad", "escritura_constitucion", "poderes_representante"], opcionales: [] },
  local: { obligatorios: ["solicitud_firmada", "dni_propietario_delante", "dni_propietario_detras", "licencia_o_declaracion"], opcionales: [] },
  financiacion: { obligatorios: ["dni_pagador_delante", "dni_pagador_detras", "justificante_ingresos", "titularidad_bancaria"], opcionales: [] },
};

// ================= FLUJOS =================
const FLOWS = {
  propietario: [
    { code: "solicitud_firmada", prompt: "1 Sube la solicitud de EMASESA firmada." },
    { code: "dni_delante", prompt: "2 Sube una foto del DNI por la parte delantera." },
    { code: "dni_detras", prompt: "3 Sube una foto del DNI por la parte trasera." },
    { code: "empadronamiento", prompt: "4 (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  familiar: [
    { code: "solicitud_firmada", prompt: "1 Sube la solicitud de EMASESA firmada." },
    { code: "dni_familiar_delante", prompt: "2 Sube el DNI del familiar por delante." },
    { code: "dni_familiar_detras", prompt: "3 Sube el DNI del familiar por detras." },
    { code: "dni_propietario_delante", prompt: "4 Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5 Sube el DNI del propietario por detras." },
    { code: "libro_familia", prompt: "6 Sube el libro de familia." },
    { code: "autorizacion_familiar", prompt: "7 Sube el documento de autorizacion." },
    { code: "empadronamiento", prompt: "8 (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  inquilino: [
    { code: "solicitud_firmada", prompt: "1 Sube la solicitud de EMASESA firmada." },
    { code: "dni_inquilino_delante", prompt: "2 Sube el DNI del inquilino por delante." },
    { code: "dni_inquilino_detras", prompt: "3 Sube el DNI del inquilino por detras." },
    { code: "dni_propietario_delante", prompt: "4 Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "5 Sube el DNI del propietario por detras." },
    { code: "contrato_alquiler", prompt: "6 Sube el contrato de alquiler completo y firmado. Preferiblemente en un unico PDF. Si no puedes, envialo en varias fotos y escribe LISTO al terminar." },
    { code: "empadronamiento", prompt: "7 (Opcional) Sube el certificado de empadronamiento si lo tienes." },
  ],
  sociedad: [
    { code: "solicitud_firmada", prompt: "1 Sube la solicitud de EMASESA firmada." },
    { code: "dni_administrador_delante", prompt: "2 Sube el DNI del administrador por delante." },
    { code: "dni_administrador_detras", prompt: "3 Sube el DNI del administrador por detras." },
    { code: "nif_sociedad", prompt: "4 Sube el NIF/CIF de la sociedad." },
    { code: "escritura_constitucion", prompt: "5 Sube la escritura de constitucion. Preferiblemente en un unico PDF. Si no puedes, enviala en varias fotos y escribe LISTO al terminar." },
    { code: "poderes_representante", prompt: "6 Sube los poderes del representante. Preferiblemente en un unico PDF. Si no puedes, envialos en varias fotos y escribe LISTO al terminar." },
  ],
  local: [
    { code: "solicitud_firmada", prompt: "1 Sube la solicitud de EMASESA firmada." },
    { code: "dni_propietario_delante", prompt: "2 Sube el DNI del propietario por delante." },
    { code: "dni_propietario_detras", prompt: "3 Sube el DNI del propietario por detras." },
    { code: "licencia_o_declaracion", prompt: "4 Sube la licencia de apertura o declaracion responsable. Preferiblemente en un unico PDF. Si no puedes, enviala en varias fotos y escribe LISTO al terminar." },
  ],
  financiacion: [
    { code: "dni_pagador_delante", prompt: "1 Sube el DNI del pagador por delante." },
    { code: "dni_pagador_detras", prompt: "2 Sube el DNI del pagador por detras." },
    { code: "justificante_ingresos", prompt: "3 Sube un justificante de ingresos." },
    { code: "titularidad_bancaria", prompt: "4 Sube el documento de titularidad bancaria." },
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
  return "Hola " + (nombre || "") + " Soy el asistente de Instalaciones Araujo.\n\nVoy a ayudarte a enviar la documentacion necesaria para el Plan 5 de EMASESA.\n\nIndica tu caso:\n1. Soy propietario de la vivienda\n2. El contrato ira a nombre de un familiar\n3. El contrato ira a nombre de un inquilino\n4. La vivienda esta a nombre de una sociedad\n5. Es un local comercial";
}
function buildPreguntaFinanciacion() {
  return "Perfecto\n\nHemos recibido la documentacion base necesaria.\n\nUltima pregunta:\nTe gustaria que estudiemos la posibilidad de financiar tu parte?\n\n1. Si\n2. No";
}

// ================= IA TEXTO =================
async function responderConIA(mensaje, expediente) {
  const documentoActual = labelDocumento(expediente.documento_actual);
  const pendientes = labelsDocumentos(expediente.documentos_pendientes).join(", ");
  const opcionales = labelsDocumentos(expediente.documentos_opcionales_pendientes).join(", ");
  const dias = diasEntre(expediente.fecha_primer_contacto);
  const promptSistema = "Eres el asistente de Instalaciones Araujo. Ayuda a completar expediente Plan 5 EMASESA.\nTipo: " + (expediente.tipo_expediente || "sin definir") + "\nDoc actual: " + documentoActual + "\nPendientes: " + (pendientes || "ninguno") + "\nOpcionales: " + (opcionales || "ninguno") + "\nDias: " + dias + "\nReglas: responde en espanol, breve, no reinicies flujo, mete urgencia si excusas, orienta a enviar documento.";
  const fallback = "Retomamos tu expediente.\n\nTe falta por enviar:\n- " + documentoActual + "\n\nPuedes enviarlo directamente por este WhatsApp.";
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      { model: "gpt-4o-mini", temperature: 0.3, messages: [{ role: "system", content: promptSistema }, { role: "user", content: mensaje }] },
      { timeout: 4000, headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" } }
    );
    const texto = response && response.data && response.data.choices && response.data.choices[0] ? response.data.choices[0].message.content.trim() : null;
    return texto || fallback;
  } catch (error) {
    console.error("Error IA texto:", error && error.response ? error.response.data : error.message);
    return fallback;
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

// ================= SHEETS =================
async function buscarVecinoPorTelefono(telefono) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "vecinos_base!A:E" });
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
async function guardarContacto(telefono, mensajeCliente, tipo, respuestaBot) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "contactos!A:E", valueInputOption: "RAW",
    requestBody: { values: [[ahoraISO(), telefono, mensajeCliente, tipo, respuestaBot]] },
  });
}
async function guardarAviso(telefono, tipoAviso, estado) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "avisos!A:D", valueInputOption: "RAW",
    requestBody: { values: [[telefono, tipoAviso, ahoraISO(), estado]] },
  });
}
async function buscarExpedientePorTelefono(telefono) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:R" });
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
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:R", valueInputOption: "RAW",
    requestBody: { values: [[
      telefono, (datosVecino && datosVecino.comunidad) || "", (datosVecino && datosVecino.vivienda) || "",
      (datosVecino && datosVecino.nombre) || "", "", "pregunta_tipo", "", "pendiente_clasificacion",
      ahora, ahora, ahora, sumarDias(ahora, 20), "", "NO", "ok", "", "", "",
    ]] },
  });
}
async function actualizarExpediente(rowIndex, data) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A" + rowIndex + ":R" + rowIndex,
    valueInputOption: "RAW",
    requestBody: { values: [[
      data.telefono || "", data.comunidad || "", data.vivienda || "", data.nombre || "",
      data.tipo_expediente || "", data.paso_actual || "", data.documento_actual || "",
      data.estado_expediente || "", data.fecha_inicio || "", data.fecha_primer_contacto || "",
      data.fecha_ultimo_contacto || "", data.fecha_limite_documentacion || "",
      data.fecha_limite_firma || "", data.documentos_completos || "",
      data.alerta_plazo || "", data.documentos_recibidos || "",
      data.documentos_pendientes || "", data.documentos_opcionales_pendientes || "",
    ]] },
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

// columna I = estado: OK | REVISAR | REPETIR
// columna J = motivo (texto corto)
async function guardarDocumentoSheet(telefono, comunidad, vivienda, tipoDocumento, nombreArchivo, urlDrive, origenClasificacion, estadoRevision, motivo) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:J", valueInputOption: "RAW",
    requestBody: { values: [[
      telefono, comunidad, vivienda, tipoDocumento,
      nombreArchivo, ahoraISO(), urlDrive || "",
      origenClasificacion || "", estadoRevision || "OK", motivo || "",
    ]] },
  });
}

// Comprueba si hay al menos un archivo reciente (ultimas 4h) para este documento.
// Evita que un intento historico previo valide un LISTO de una sesion nueva.
async function existeArchivoParaDocumento(telefono, tipoDocumento) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:F" });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const ahora = new Date();
    const limite = 4 * 60 * 60 * 1000;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      if (row[3] !== tipoDocumento) continue;
      const fechaSubida = row[5] ? new Date(row[5]) : null;
      if (fechaSubida && !isNaN(fechaSubida) && (ahora - fechaSubida) <= limite) return true;
    }
    return false;
  } catch (e) {
    console.error("Error buscando archivos recientes:", e.message);
    return false;
  }
}

// Devuelve el mejor estado disponible entre los archivos recientes (ultimas 4h)
// de un tipo documental. Prioridad: OK > REVISAR > REPETIR.
// Usado por LISTO para saber si las paginas enviadas tienen calidad suficiente.
async function obtenerMejorEstadoArchivoReciente(telefono, tipoDocumento) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:I",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const ahora = new Date();
    const limite = 4 * 60 * 60 * 1000;
    const prioridad = { "OK": 0, "REVISAR": 1, "REPETIR": 2 };
    let mejorEstado = null;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      if (row[3] !== tipoDocumento) continue;
      const fechaSubida = row[5] ? new Date(row[5]) : null;
      if (!fechaSubida || isNaN(fechaSubida) || (ahora - fechaSubida) > limite) continue;
      const estado = row[8] || "OK";
      if (mejorEstado === null || (prioridad[estado] !== undefined && prioridad[estado] < (prioridad[mejorEstado] || 99))) {
        mejorEstado = estado;
      }
    }
    return mejorEstado || "REPETIR";
  } catch (e) {
    console.error("Error obteniendo mejor estado archivo:", e.message);
    return "REVISAR";
  }
}

// Comprueba si el telefono tiene documentos de financiacion subidos alguna vez.
// Usado para determinar el estado final limpio correcto:
// si hay financiacion -> pendiente_estudio_financiacion
// si no hay -> documentacion_base_completa
async function tieneDocumentacionFinanciacion(telefono) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:D",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const docsFin = new Set(["dni_pagador_delante", "dni_pagador_detras", "justificante_ingresos", "titularidad_bancaria"]);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      if (docsFin.has(row[3])) return true;
    }
    return false;
  } catch (e) {
    console.error("Error comprobando financiacion:", e.message);
    return false;
  }
}

// ================= FLOW HELPERS =================
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
  const lista = pendientes.join("\n- ");
  if (dias >= 20) return { tipo: "fuera_plazo", alerta: "fuera_plazo", mensaje: "ULTIMO AVISO - Plazo finalizado\n\nSigue pendiente:\n- " + lista + "\n\nTu expediente puede quedar bloqueado.\n\nEnvialo URGENTEMENTE por este mismo WhatsApp." };
  if (dias >= 18) return { tipo: "aviso_urgente", alerta: "urgente", mensaje: "Aviso importante - Plazo casi finalizado\n\nFalta:\n- " + lista + "\n\nEnvialo ahora por este WhatsApp." };
  if (dias >= 10) return { tipo: "aviso_10_dias", alerta: "aviso_10_dias", mensaje: "Recordatorio importante\n\nFalta documentacion:\n\n- " + lista + "\n\nPuedes enviarla directamente por aqui." };
  return null;
}
async function revisarYAvisarPorPlazo(expediente) {
  const aviso = construirAvisoPorPlazo(expediente);
  if (!aviso) {
    if (expediente.alerta_plazo !== "ok") { expediente.alerta_plazo = "ok"; await actualizarExpediente(expediente.rowIndex, expediente); }
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
  try { await guardarContacto(telefono, mensajeCliente, tipo, respuestaBot); } catch (e) { console.error("ERROR guardando contacto:", e.message); }
  return res.type("text/xml").send(twiml.toString());
}

// ================= PROCESAMIENTO Y VALIDACIÓN COMPLETA DE UN ARCHIVO =================
async function procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaId, documentoActual) {
  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
  });

  const bufferOriginal = Buffer.from(response.data);
  const extension = extensionDesdeMime(mimeType);
  const fileName = (documentoActual || "documento") + "_" + telefono + "_" + Date.now() + extension;
  let bufferFinal = bufferOriginal;

  // Para PDFs: solo IA si existe, sin validacion tecnica de imagen
  if (mimeType.includes("pdf")) {
    // PDFs de docs largos pasan a REVISAR por defecto para que el equipo los valide
    const esLargo = DOCS_LARGOS.includes(documentoActual);
    // PDFs importantes que no son largos tambien van a REVISAR
    const docsPDFImportantes = ["solicitud_firmada", "nif_sociedad", "justificante_ingresos", "titularidad_bancaria", "empadronamiento", "autorizacion_familiar"];
    const esPDFImportante = docsPDFImportantes.includes(documentoActual);
    let estadoPDF = "OK";
    let motivoPDF = "";
    if (esLargo) { estadoPDF = "REVISAR"; motivoPDF = "PDF de documento largo pendiente de revision"; }
    else if (esPDFImportante) { estadoPDF = "REVISAR"; motivoPDF = "PDF pendiente de revision interna"; }
    let file;
    try {
      file = await uploadToDrive(bufferFinal, fileName, mimeType, carpetaId);
    } catch (err) {
      console.error("ERROR uploadToDrive [tel=" + telefono + ", archivo=" + fileName + "]:", err.message);
      throw err;
    }
    return { file, fileName, estadoDocumento: estadoPDF, motivo: motivoPDF };
  }

  // Para imagenes: validacion tecnica + IA
  let estadoDocumento = "OK";
  let motivo = "";

  if (esDocumentoImagenNormalizable(mimeType)) {
    const validacionTecnica = await validarImagenTecnica(bufferOriginal);
    const analisisIA = await analizarDocumentoConIA(bufferOriginal, documentoActual);
    const estadoFinal = determinarEstadoFinal(validacionTecnica, analisisIA);
    estadoDocumento = estadoFinal.estadoDocumento;
    motivo = estadoFinal.motivo;

    // Normalizar imagen siempre si es posible
    const procesado = await normalizarImagenDocumento(bufferOriginal);
    if (procesado.ok) bufferFinal = procesado.buffer;
  }

  let file;
  try {
    if (esDocumentoImagenNormalizable(mimeType)) {
      file = await uploadProcessedToDrive(bufferFinal, fileName, carpetaId);
    } else {
      file = await uploadToDrive(bufferFinal, fileName, mimeType, carpetaId);
    }
  } catch (err) {
    console.error("ERROR uploadToDrive [tel=" + telefono + ", archivo=" + fileName + "]:", err.message);
    throw err;
  }

  return { file, fileName, estadoDocumento, motivo };
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
        "Tu numero no esta en el listado inicial de la comunidad. Contacta con Instalaciones Araujo para validarlo.");
    }

    let expediente = await buscarExpedientePorTelefono(telefono);
    if (!expediente) { await crearExpedienteInicial(telefono, datosVecino); expediente = await buscarExpedientePorTelefono(telefono); }

    // ================= PREGUNTA TIPO =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_tipo") {
      const tipo = mapTipoExpediente(msg);
      if (!tipo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaTipo(datosVecino.nombre));
      const primerPaso = getFirstStep(tipo);
      expediente.tipo_expediente = tipo;
      expediente.paso_actual = "recogida_documentacion";
      expediente.documento_actual = primerPaso ? primerPaso.code : "";
      expediente.estado_expediente = "en_proceso";
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);
      await actualizarExpediente(expediente.rowIndex, expediente);
      return responderYLog(res, telefono, msgOriginal, "texto",
        "Perfecto\n\nCaso identificado: " + tipo + ".\n\n" + (primerPaso ? primerPaso.prompt : "Empezamos."));
    }

    // ================= LISTO PARA DOCUMENTOS LARGOS =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion" && msg === "listo") {
      const hayArchivo = await existeArchivoParaDocumento(telefono, expediente.documento_actual);
      if (!hayArchivo) {
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Todavia no hemos recibido ningun archivo para este documento.\n\n" +
          "Primero envialo por aqui y cuando hayas mandado todas las paginas, escribe LISTO.");
      }

      // Comprobar calidad de las paginas recientes
      // Si todas son REPETIR, no marcar como recibido correcto
      const estadoPaginasLargo = await obtenerMejorEstadoArchivoReciente(telefono, expediente.documento_actual);
      const docLargoValido = estadoPaginasLargo === "OK" || estadoPaginasLargo === "REVISAR";

      const docsRecibidosArr = splitList(expediente.documentos_recibidos);
      if (docLargoValido && expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
        docsRecibidosArr.push(expediente.documento_actual);
      }
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);

      const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
      const msgListo = docLargoValido
        ? "Documento completo recibido."
        : "Documento recibido, pero las paginas tienen calidad baja. Quedara pendiente de revision.";

      if (siguiente) {
        expediente.documento_actual = siguiente.code;
        expediente.estado_expediente = "en_proceso";
        await actualizarExpediente(expediente.rowIndex, expediente);
        await recalcularYActualizarEstadoExpediente(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          msgListo + "\n\nSeguimos:\n" + siguiente.prompt);
      } else {
        expediente.paso_actual = "pregunta_financiacion";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        await actualizarExpediente(expediente.rowIndex, expediente);
        await recalcularYActualizarEstadoExpediente(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          msgListo + "\n\n" + buildPreguntaFinanciacion());
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
            "Perfecto\n\nContinuamos sin ese documento opcional.\n\nSeguimos:\n" + siguiente.prompt);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente.fecha_ultimo_contacto = ahoraISO();
          await actualizarExpediente(expediente.rowIndex, expediente);
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto\n\nContinuamos sin ese documento opcional.\n\n" + buildPreguntaFinanciacion());
        }
      }

      if (DOCS_LARGOS.includes(expediente.documento_actual)) {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Ahora mismo estamos esperando:\n- " + labelDocumento(expediente.documento_actual) +
          "\n\nPreferiblemente envialo en un unico PDF completo.\nSi no puedes, mandalo en varias fotos.\n\nCuando termines de enviar todas las paginas, escribe LISTO.");
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
        await recalcularYActualizarEstadoExpediente(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Perfecto Tu expediente base ya esta completo. Nuestro equipo lo revisara y te avisara si necesitamos algo mas.");
      }

      const primerPasoFin = getFirstStep("financiacion");
      expediente.paso_actual = "recogida_financiacion";
      expediente.documento_actual = primerPasoFin.code;
      expediente.estado_expediente = "pendiente_financiacion";
      expediente.fecha_ultimo_contacto = ahoraISO();
      await actualizarExpediente(expediente.rowIndex, expediente);
      return responderYLog(res, telefono, msgOriginal, "texto",
        "Perfecto\n\nVamos a estudiar la financiacion.\n\n" + primerPasoFin.prompt);
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
      const esPasoValido =
        expediente.paso_actual === "recogida_documentacion" ||
        expediente.paso_actual === "recogida_financiacion";

      // ====== ARCHIVO FUERA DE FLUJO ======
      if (!esPasoValido) {
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = req.body["MediaUrl" + i];
          const mimeType = req.body["MediaContentType" + i] || "application/octet-stream";
          try {
            const resultado = await procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaId, "adicional");
            try {
              await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
                "adicional", resultado.fileName, resultado.file.webViewLink || "", "fuera_flujo", resultado.estadoDocumento, resultado.motivo);
            } catch (err) { console.error("ERROR guardarDoc fuera_flujo:", err.message); }
          } catch (err) { console.error("ERROR archivo fuera flujo:", err.message); }
        }
        expediente.fecha_ultimo_contacto = ahoraISO();
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Documentacion adicional recibida\n\nLa incorporamos a tu expediente para revision.");
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

      // Procesar archivo principal
      const mediaUrl0 = req.body.MediaUrl0;
      const mimeType0 = req.body.MediaContentType0 || "application/octet-stream";
      let resultado;
      try {
        resultado = await procesarYValidarArchivo(mediaUrl0, mimeType0, telefono, carpetaId, expediente.documento_actual);
      } catch (err) {
        console.error("ERROR archivo principal:", err.message);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Ha habido un problema procesando el archivo. Por favor, intentalo de nuevo.");
      }

      // Guardar documento principal con su estado real
      try {
        await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
          expediente.documento_actual || "pendiente_clasificar",
          resultado.fileName, resultado.file.webViewLink || "", "flujo", resultado.estadoDocumento, resultado.motivo);
      } catch (err) { console.error("ERROR guardarDoc flujo:", err.message); }

      // Archivos adicionales (numMedia > 1): procesar y guardar con su estado real
      for (let i = 1; i < numMedia; i++) {
        const mediaUrlN = req.body["MediaUrl" + i];
        const mimeTypeN = req.body["MediaContentType" + i] || "application/octet-stream";
        try {
          const resultadoN = await procesarYValidarArchivo(mediaUrlN, mimeTypeN, telefono, carpetaId, expediente.documento_actual);
          try {
            await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
              expediente.documento_actual || "pendiente_clasificar",
              resultadoN.fileName, resultadoN.file.webViewLink || "", "flujo_extra", resultadoN.estadoDocumento, resultadoN.motivo);
          } catch (err) { console.error("ERROR guardarDoc flujo_extra:", err.message); }
        } catch (err) { console.error("ERROR archivo extra:", err.message); }
      }

      expediente.fecha_ultimo_contacto = ahoraISO();

      const esPDF = mimeType0.includes("pdf");
      const esDocumentoLargo = DOCS_LARGOS.includes(expediente.documento_actual);
      const docsRecibidosArr = splitList(expediente.documentos_recibidos);

      // DOCUMENTO LARGO EN PDF — siempre REVISAR, pero avanza
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && esPDF) {
        // Para doc largo PDF: solo marcar recibido si no es REPETIR
        if (resultado.estadoDocumento !== "REPETIR") {
          if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
            docsRecibidosArr.push(expediente.documento_actual);
          }
          expediente.documentos_recibidos = joinList(docsRecibidosArr);
        }
        expediente = refrescarResumenDocumental(expediente);
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguiente ? siguiente.prompt : null);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            msgVecino + "\n\n" + buildPreguntaFinanciacion());
        }
      }

      // DOCUMENTO LARGO EN FOTOS — recibe foto, no avanza hasta LISTO
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && !esPDF) {
        await actualizarExpediente(expediente.rowIndex, expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Pagina recibida\n\nPuedes seguir enviando mas paginas de este documento.\n\nCuando termines, escribe LISTO.");
      }

      // DOCUMENTO NORMAL — avanza siempre (OK, REVISAR o REPETIR)
      // Solo se marca como recibido si es OK o REVISAR, nunca si es REPETIR
      // REPETIR: el vecino avanza pero el documento sigue pendiente en documentos_pendientes
      if (resultado.estadoDocumento !== "REPETIR") {
        if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
          docsRecibidosArr.push(expediente.documento_actual);
        }
      }
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente = refrescarResumenDocumental(expediente);

      if (expediente.paso_actual === "recogida_documentacion") {
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguiente ? siguiente.prompt : null);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente = refrescarResumenDocumental(expediente);
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            msgVecino + (resultado.estadoDocumento === "OK" ? "\n\n" : " ") + buildPreguntaFinanciacion());
        }
      }

      if (expediente.paso_actual === "recogida_financiacion") {
        const siguienteFin = getNextStep("financiacion", expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguienteFin ? siguienteFin.prompt : null);
        if (siguienteFin) {
          expediente.documento_actual = siguienteFin.code;
          expediente.estado_expediente = "pendiente_financiacion";
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          expediente.paso_actual = "finalizado";
          expediente.documento_actual = "";
          expediente.estado_expediente = "pendiente_estudio_financiacion";
          expediente.fecha_ultimo_contacto = ahoraISO();
          expediente = refrescarResumenDocumental(expediente);
          await actualizarExpediente(expediente.rowIndex, expediente);
          await recalcularYActualizarEstadoExpediente(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Perfecto\n\nHemos recibido toda la documentacion base y la de financiacion. Nuestro equipo la revisara y te avisara si necesita algo mas.");
        }
      }
    }

    // ================= RESPUESTA GENERICA =================
    if (numMedia === 0) {
      if (expediente.paso_actual === "recogida_documentacion" || expediente.paso_actual === "recogida_financiacion") {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Seguimos con tu expediente.\n\nAhora mismo falta por enviar:\n- " + labelDocumento(expediente.documento_actual) + "\n\nPuedes enviarlo directamente por aqui.");
      }
      if (expediente.paso_actual === "pregunta_financiacion") {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaFinanciacion());
      }
      if (expediente.paso_actual === "finalizado") {
        const textoFinal = (msgOriginal || "").trim().toLowerCase();
        const preguntaEstado = ["me falta", "falta algo", "esta completo", "esta correcto", "esta bien", "ya esta"].some(function(p) { return textoFinal.includes(p); });
        const quiereEnviarMas = ["te mando", "voy a mandar", "voy a enviar", "tengo otro", "tengo otra", "adjunto", "ahora envio"].some(function(p) { return textoFinal.includes(p); });

        // Determinar si el expediente tiene pendientes internos
        const estadosSuciosFinal = [
          "expediente_con_documento_a_repetir",
          "expediente_con_revision_pendiente",
          "expediente_final_pendiente_revision",
        ];
        const expedienteSucio = estadosSuciosFinal.includes(expediente.estado_expediente);

        if (preguntaEstado) {
          const resumenFinal = calcularDocsExpediente(expediente.tipo_expediente, splitList(expediente.documentos_recibidos));
          const opcionalesPendientes = splitList(resumenFinal.opcionalesPendientes);
          const pendientesObligatorios = splitList(resumenFinal.pendientes);

          if (pendientesObligatorios.length > 0) {
            return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
              "Tu expediente aun tiene documentos pendientes de envio:\n- " +
              pendientesObligatorios.map(labelDocumento).join("\n- ") +
              "\n\nEnvialos directamente por aqui.");
          }
          if (expedienteSucio) {
            return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
              "Hemos recibido tu documentacion, pero nuestro equipo esta revisando algunos documentos que necesitan atencion.\n\nTe avisaremos si hay que repetir algo.");
          }
          if (opcionalesPendientes.length > 0) {
            return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
              "Tu expediente esta completo para su tramitacion\n\nSolo quedaria, si lo tienes:\n- " +
              opcionalesPendientes.map(labelDocumento).join("\n- ") +
              "\n\nNo es obligatorio, pero si recomendable.\n\nNuestro equipo lo esta revisando.");
          }
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Tu expediente esta completo y en revision.\n\nNuestro equipo lo esta revisando.\nSi detectamos que falta algo, te avisaremos por aqui.");
        }

        if (quiereEnviarMas) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto\n\nPuedes enviarlo directamente por aqui y lo incorporamos a tu expediente para revision.");
        }

        // Respuesta generica final — coherente con el estado real
        if (expedienteSucio) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Tu expediente esta recibido, pero nuestro equipo todavia esta revisando algunos documentos.\n\nTe avisaremos cuando este todo en orden.\nSi necesitas anadir algo mas, puedes enviarlo por aqui.");
        }
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Tu expediente ya esta completo.\n\nNuestro equipo lo esta revisando.\nSi necesitas anadir algun documento mas, puedes enviarlo por aqui.");
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
