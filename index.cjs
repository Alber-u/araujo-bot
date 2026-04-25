const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");
const sharp = require("sharp");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Cliente Twilio para enviar mensajes fuera del webhook (modo background)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ================= NOTIFICACION EQUIPO =================
async function notificarEquipo(tipo, datos) {
  const telRaw = process.env.WHATSAPP_EQUIPO;
  if (!telRaw) return;
  const tels = telRaw.split(",").map(t => t.trim()).filter(Boolean);
  let contentSid = null;
  let variables = {};

  if (tipo === "intervencion_humana") {
    contentSid = "HXd105ccbfa748a9e541812e199e17142e";
    variables = {
      "1": datos.nombre || "Sin nombre",
      "2": datos.comunidad || "-",
      "3": datos.vivienda || "",
      "4": datos.telefono || "-",
      "5": datos.documento || "-",
      "6": String(datos.intentos || 3),
    };
  } else if (tipo === "expediente_completo") {
    contentSid = "HXcb8e7a4115c41c2033d9f6ee6f90dfa7";
    variables = {
      "1": datos.nombre || "Sin nombre",
      "2": datos.comunidad || "-",
      "3": datos.vivienda || "",
      "4": datos.telefono || "-",
      "5": datos.tipo || "-",
    };
  } else if (tipo === "revisar_documento") {
    contentSid = "HX345aa1246f1399f89e8f44f376c85e54";
    variables = {
      "1": datos.nombre || "Sin nombre",
      "2": datos.comunidad || "-",
      "3": datos.vivienda || "",
      "4": datos.telefono || "-",
      "5": datos.documento || "-",
      "6": datos.motivo || "Revisar manualmente",
    };
  } else if (tipo === "atencion_humana") {
    contentSid = "HX13df150c782230f5bdb298da4aeed749";
    variables = {
      "1": datos.nombre || "Sin nombre",
      "2": datos.comunidad || "-",
      "3": datos.vivienda || "",
      "4": datos.telefono || "-",
      "5": (datos.mensaje || "-").slice(0, 100),
      "6": datos.motivo || "Necesita atenci\u00f3n humana",
    };
  }

  if (!contentSid) return;
  for (const tel of tels) {
    try {
      await enviarWhatsAppPlantilla(tel, contentSid, variables);
    } catch(e) {
      console.error("Error notificando equipo:", tel, e.message);
    }
  }
}


async function enviarWhatsApp(to, body) {
  if (!process.env.TWILIO_WHATSAPP_NUMBER) throw new Error("Falta TWILIO_WHATSAPP_NUMBER en variables de entorno");
  const fromNum = "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER;
  const toNum = "whatsapp:" + normalizarTelefono(to);
  console.log("Enviando WhatsApp:", { from: fromNum, to: toNum, body: body.slice(0, 120) });
  await twilioClient.messages.create({ from: fromNum, to: toNum, body });
}

// Enviar usando plantilla aprobada de Twilio (sin restriccion de ventana 24h)
async function enviarWhatsAppPlantilla(to, contentSid, variables) {
  if (!process.env.TWILIO_WHATSAPP_NUMBER) throw new Error("Falta TWILIO_WHATSAPP_NUMBER");
  const fromNum = "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER;
  const toNum = "whatsapp:" + normalizarTelefono(to);
  console.log("Enviando plantilla WhatsApp:", { to: toNum, contentSid });
  // Twilio requiere contentVariables como JSON string con claves string
  // Asegurarse de que todas las claves son strings y los valores no son nulos
  const varsLimpias = {};
  for (const [k, v] of Object.entries(variables || {})) {
    varsLimpias[String(k)] = String(v || "").replace(/\n/g, " ").trim();
  }
  await twilioClient.messages.create({
    from: fromNum, to: toNum,
    contentSid,
    contentVariables: JSON.stringify(varsLimpias),
  });
}

// ================= DEDUPLICACION POR MessageSid =================
// Evita reprocesar el mismo mensaje si Twilio reintenta el webhook.
const _processedMessages = new Map();
const PROCESSED_TTL_MS = 10 * 60 * 1000; // 10 minutos

function yaProcesado(messageSid) {
  if (!messageSid) return false;
  const ts = _processedMessages.get(messageSid);
  if (!ts) return false;
  if (Date.now() - ts > PROCESSED_TTL_MS) {
    _processedMessages.delete(messageSid);
    return false;
  }
  return true;
}

function marcarProcesado(messageSid) {
  if (!messageSid) return;
  _processedMessages.set(messageSid, Date.now());
}

// ================= COLA POR TELEFONO (anti-concurrencia) =================
// Serializa las requests del mismo vecino en lugar de descartarlas.
// Si llegan 3 mensajes rapidos, se procesan en orden sin pisar estado.
const _queues = new Map();

function withLock(key, fn) {
  const prev = _queues.get(key) || Promise.resolve();
  const next = prev.then(() => fn()).catch((err) => {
    console.error("Cola error", { key, error: err.message });
    throw err; // re-throw para que el handler propio lo gestione
  });
  _queues.set(key, next);
  next.finally(() => {
    if (_queues.get(key) === next) _queues.delete(key);
  });
  return next;
}

// ================= CONSTANTES GLOBALES =================
const IA_TIMEOUT_MS = 7000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const RECENT_FILE_WINDOW_MS = 4 * 60 * 60 * 1000;
const RETRY_WINDOW_MS = 15 * 60 * 1000;

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

// Normaliza 0034, 34XXXXXXXXX y +34 al mismo formato
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

// Función principal de recalculo: calcula estado + indicadores en memoria y persiste UNA sola vez.
// Todas las rutas del flujo deben llamar a esta función, no a las subfunciones directamente.
async function recalcularYActualizarTodo(expediente) {
  await calcularEstadoExpedienteEnMemoria(expediente);
  await calcularIndicadoresOperativosEnMemoria(expediente);
  await actualizarExpediente(expediente.rowIndex, expediente);
}

// Solo calcula en memoria: lee documentos de Sheets, actualiza estado_expediente en el objeto.
// No persiste — el llamador (recalcularYActualizarTodo) hace la escritura final.
async function calcularEstadoExpedienteEnMemoria(expediente) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:L",
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

    // Fase final = el flujo conversacional ha terminado (paso_actual === "finalizado")
    // Nota: documentacion_base_completa y pendiente_estudio_financiacion son valores de
    // estado_expediente, NO de paso_actual, por lo que no deben usarse aqui.
    const esFaseFinal = expediente.paso_actual === "finalizado";

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
        // En fase final limpia, verificar que no quedan obligatorios pendientes
        const hayPendientesFinal = splitList(expediente.documentos_pendientes).length > 0;
        if (hayPendientesFinal) {
          // Si aun hay pendientes no dejar estado final limpio
          nuevoEstado = "expediente_final_pendiente_revision";
        } else {
          const hayFinanciacion = await tieneDocumentacionFinanciacion(expediente.telefono);
          nuevoEstado = hayFinanciacion
            ? "pendiente_estudio_financiacion"
            : "documentacion_base_completa";
        }
      }
    } else {
      // Durante el flujo activo:
      // - hay incidencias -> marcar el estado agregado correspondiente
      // - no hay incidencias -> verificar tambien pendientes reales antes de limpiar
      if (estadoAgregado !== "expediente_limpio") {
        nuevoEstado = estadoAgregado;
      } else {
        // Un expediente con documentos obligatorios aun no recibidos no puede ser limpio.
        // Esto cubre el caso de documentos que nunca llegaron (no aparecen en Sheets).
        const hayPendientesObligatorios = splitList(expediente.documentos_pendientes).length > 0;
        if (hayPendientesObligatorios && expediente.paso_actual !== "finalizado") {
          // Conservar estado actual si ya es un estado de incidencia, o poner en_proceso
          nuevoEstado = estadosSucios.includes(expediente.estado_expediente)
            ? expediente.estado_expediente
            : "en_proceso";
        } else {
          nuevoEstado = estadosSucios.includes(expediente.estado_expediente)
            ? "expediente_limpio"
            : expediente.estado_expediente;
        }
      }
    }

    if (nuevoEstado && nuevoEstado !== expediente.estado_expediente) {
      expediente.estado_expediente = nuevoEstado;
      // No persiste aqui — recalcularYActualizarTodo hace la escritura final
    }
  } catch (e) {
    console.error("Error calculando estado expediente en memoria:", e.message);
  }
}

// documentoActualCode: codigo del documento que fallo (ej: "solicitud_firmada", "dni_delante")
// Se usa para nombrar el documento en el mensaje al vecino con su label real.
// Helper: formatea un texto en negrita para WhatsApp
function bold(texto) {
  return '*' + texto + '*';
}

function mensajeParaVecino(estadoDocumento, motivo, siguiente, intentos, documentoActualCode) {
  if (estadoDocumento === "OK") {
    return siguiente
      ? "Documento recibido correctamente \u2705\n\n\u27A1\uFE0F Seguimos con el siguiente paso:\n\n" + siguiente
      : "\u2705 Documento recibido correctamente";
  }
  if (estadoDocumento === "REVISAR") {
    const motivoRev = motivo ? motivo.replace(/^\[\w+\]\s*/, "") : "";
    const avisoRev = motivoRev
      ? "\u26A0\uFE0F Documento recibido, pero detectamos un posible problema:\n\n" + motivoRev + ".\n\nNuestro equipo lo revisar\u00e1. Si quieres mejorarlo, puedes reenviarlo."
      : "Documento recibido \u2705 Lo vamos a revisar internamente.";
    return siguiente ? avisoRev + "\n\n\u27A1\uFE0F De momento seguimos:\n\n" + siguiente : avisoRev;
  }
  if (estadoDocumento === "REPETIR") {
    const docLabel = documentoActualCode ? labelDocumento(documentoActualCode) : "ese documento";
    let sufijoIntentos = "";
    if (intentos >= 3) sufijoIntentos = "\n\nHemos avisado a nuestro equipo para que te ayude personalmente.";
    else if (intentos === 2) sufijoIntentos = "\n\nSi tienes problemas, escr\u00edbenos y te ayudamos.";
    const motivoLimpio = motivo ? motivo.replace(/^\[\w+\]\s*/, "") : "";
    const lineaMotivo = motivoLimpio ? "\n\n" + motivoLimpio + "." : "";
    return "\u274C " + bold(docLabel) + " no v\u00e1lido:"
      + lineaMotivo + sufijoIntentos
      + "\n\nPor favor, vu\u00e9lvelo a enviar cuando est\u00e9 listo.";
  }
  return siguiente ? "Documento recibido\n\n\u27A1\uFE0F " + siguiente : "Documento recibido";
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
    if (meta.width < 500 || meta.height < 300) return { ok: false, estado: "REPETIR", motivo: "la foto es demasiado pequena. Hazla mas cerca o usa la camara normal, no en miniatura" };
    const { data, info } = await image.resize(300, 200, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    let suma = 0, min = 255, max = 0;
    for (let i = 0; i < data.length; i++) { const v = data[i]; suma += v; if (v < min) min = v; if (v > max) max = v; }
    const media = suma / data.length;
    if (media < 35) return { ok: false, estado: "REPETIR", motivo: "la foto esta demasiado oscura. Enciende mas luz o acercate a una ventana e intentalo de nuevo" };
    let nitidez = 0, count = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 1; x < info.width; x++) {
        nitidez += Math.abs(data[y * info.width + x] - data[y * info.width + (x - 1)]);
        count++;
      }
    }
    const nitidezMedia = count ? nitidez / count : 0;
    const rango = max - min;
    if (nitidezMedia < 3) return { ok: false, estado: "REPETIR", motivo: "la foto ha llegado borrosa o fuera de foco. Repitela con el movil quieto y buena luz" };
    if (rango < 20) return { ok: false, estado: "REPETIR", motivo: "la foto tiene muy poco contraste o puede estar tapada. Asegurate de que el documento sea bien visible" };
    if (nitidezMedia < 6 || media < 45) return { ok: true, estado: "REVISAR", motivo: "la foto ha llegado algo oscura o poco nitida. Si puedes, repitela con mas luz" };
    return { ok: true, estado: "OK", motivo: "" };
  } catch (error) {
    console.error("Error validando imagen", { error: error.message });
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
        timeout: timeout || IA_TIMEOUT_MS,
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      }
    );
    const texto = response && response.data && response.data.choices && response.data.choices[0]
      ? response.data.choices[0].message.content : "";
    const limpio = texto.replace(/```json/g, "").replace(/```/g, "").trim();
    try { return JSON.parse(limpio); } catch (e) { console.error("JSON IA invalido:", texto); return null; }
  } catch (error) {
    console.error("Error IA", { error: error && error.response ? JSON.stringify(error.response.data) : error.message });
    return null;
  }
}

// ===== DNI =====
async function analizarDNIconIA(buffer, documentoActual) {
  const base64 = buffer.toString("base64");
  const resultado = await llamarIAconImagen(
    "Analiza esta imagen de un DNI espa\u00f1ol. Responde SOLO en JSON:\n{\"tipo\": \"dni_delante | dni_detras | otro | dudoso\", \"confianza\": 0-100}\n\nREGLA PRINCIPAL — es la unica que importa:\n- dni_delante: ves la CARA/FOTO de una persona humana en el documento. Siempre tiene foto del titular.\n- dni_detras: NO ves cara humana. Tiene zona MRZ (dos o tres filas de letras y numeros en formato IDESPCL... o similar al pie), o codigo de barras, o chip dorado, o datos de domicilio/nacimiento sin foto. El DNI espanol moderno tiene chip dorado en la parte trasera.\n- otro: no es un DNI espanol.\n- dudoso: no se puede determinar con seguridad.\n\nCRITERIO DECISIVO: Si ves una cara humana fotografiada = dni_delante. Si NO ves cara humana = dni_detras.",
    base64,
    IA_TIMEOUT_MS
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
  const prompt =
    "Analiza este documento. Es el impreso de toma de datos de EMASESA (individualizacion de contadores de agua en Sevilla).\n\n" +
    "El documento tiene estos campos obligatorios:\n" +
    "- Nombre y Apellidos del solicitante\n" +
    "- NIF/CIF\n" +
    "- Direccion y numero\n" +
    "- Piso y poblacion\n" +
    "- Telefono (fijo o movil)\n" +
    "- Numero de habitantes\n" +
    "- Una de las dos casillas marcada (con o sin certificado de empadronamiento)\n" +
    "- Fecha (dia, mes, ano)\n" +
    "- Firma manuscrita o digital del solicitante\n\n" +
    "Responde SOLO en JSON con este formato exacto:\n" +
    "{\n" +
    '  "tipo": "solicitud_emasesa | otro | dudoso",\n' +
    '  "rellenada": "si | no | dudoso",\n' +
    '  "campos_incompletos": [],\n' +
    '  "firma_detectada": "si | no | dudoso",\n' +
    '  "fecha_detectada": "si | no",\n' +
    '  "completo": "si | no | dudoso",\n' +
    '  "motivo": ""\n' +
    "}\n\n" +
    "Criterios estrictos:\n" +
    "- tipo=solicitud_emasesa si ves el logotipo de EMASESA o el titulo 'Impreso para toma de datos'\n" +
    "- rellenada=si solo si los campos principales (nombre, NIF, direccion, telefono) tienen datos escritos\n" +
    "- rellenada=no si la mayoria de campos estan vacios o solo tiene el nombre\n" +
    "- campos_incompletos: lista los campos que faltan o estan vacios (ej: ['NIF', 'telefono', 'fecha'])\n" +
    "- firma_detectada=si solo si hay una firma manuscrita o digital visible en la zona inferior del documento\n" +
    "- fecha_detectada=si solo si hay una fecha escrita (dia, mes y ano)\n" +
    "- completo=si solo si se ve el documento entero sin recortes importantes\n" +
    "- motivo: si hay campos incompletos o falta firma, explicalo brevemente en espanol\n" +
    "- No marques si por intuicion: si no se aprecia claramente, usa dudoso";
  const resultado = await llamarIAconImagen(prompt, base64, IA_TIMEOUT_MS);

  // Log de diagnostico para detectar falsos positivos
  console.log("IA solicitud resultado:", JSON.stringify(resultado));

  if (!resultado) {
    return { estadoDocumento: "REVISAR", motivo: "no se pudo analizar la solicitud automaticamente" };
  }
  if (resultado.tipo === "otro") {
    return { estadoDocumento: "REPETIR", motivo: "no parece la solicitud de EMASESA" };
  }
  if (resultado.completo === "no") {
    return { estadoDocumento: "REPETIR", motivo: "la solicitud esta cortada o incompleta. Enviala completa" };
  }
  // Comprobar relleno y firma por separado para mensajes precisos
  // Construir mensaje de motivo con campos incompletos si los hay
  const camposInc = Array.isArray(resultado.campos_incompletos) && resultado.campos_incompletos.length > 0
    ? " Faltan: " + resultado.campos_incompletos.join(", ") + "."
    : "";

  if (resultado.rellenada === "no" && resultado.firma_detectada === "no") {
    return { estadoDocumento: "REPETIR", motivo: "la solicitud no esta rellenada ni firmada." + camposInc };
  }
  if (resultado.rellenada === "no") {
    return { estadoDocumento: "REPETIR", motivo: "la solicitud no esta rellenada correctamente." + camposInc + " Completala y enviala de nuevo." };
  }
  if (resultado.firma_detectada === "no") {
    const sinFecha = resultado.fecha_detectada === "no" ? " Tampoco tiene fecha." : "";
    return { estadoDocumento: "REPETIR", motivo: "la solicitud no esta firmada." + sinFecha + " Firmala y enviala de nuevo." };
  }
  if (resultado.rellenada === "dudoso") {
    return { estadoDocumento: "REPETIR", motivo: "no se puede confirmar que la solicitud este rellenada correctamente." + camposInc + " Asegurate de que todos los campos esten cumplimentados." };
  }
  if (resultado.firma_detectada === "dudoso") {
    return { estadoDocumento: "REPETIR", motivo: "no se puede confirmar que la solicitud este firmada. Asegurate de que la firma se vea bien." };
  }
  // Dudoso en tipo o completo → REVISAR (el equipo decide)
  // Ignorar confianza < 70 cuando todos los campos son positivos —
  // el modelo devuelve confianza:0 como valor por defecto, no como señal de incertidumbre real
  if (resultado.tipo === "dudoso" || resultado.completo === "dudoso") {
    return { estadoDocumento: "REVISAR", motivo: resultado.motivo || "no se pudo verificar bien la solicitud" };
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
    IA_TIMEOUT_MS
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
    IA_TIMEOUT_MS
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
// Subtipos internos de REVISAR (para trazabilidad en Sheets sin cambiar la API externa):
// revisar_calidad: imagen tecnica dudosa (oscura, borrosa, baja resolucion)
// revisar_contenido: documento identificado pero con algun problema de contenido (firma, completitud)
// revisar_clasificacion: la IA no pudo identificar bien el tipo de documento
// revisar_pdf: PDF sin clasificacion visual
function determinarEstadoFinal(validacionTecnica, analisisIA) {
  // REPETIR tiene siempre prioridad
  if (validacionTecnica.estado === "REPETIR") {
    return { estadoDocumento: "REPETIR", motivo: validacionTecnica.motivo, subtipo: null };
  }
  if (analisisIA && analisisIA.estadoDocumento === "REPETIR") {
    return { estadoDocumento: "REPETIR", motivo: analisisIA.motivo, subtipo: null };
  }
  // REVISAR — distinguir subtipo
  if (validacionTecnica.estado === "REVISAR") {
    return { estadoDocumento: "REVISAR", motivo: "[revisar_calidad] " + validacionTecnica.motivo, subtipo: "revisar_calidad" };
  }
  if (analisisIA && analisisIA.estadoDocumento === "REVISAR") {
    return { estadoDocumento: "REVISAR", motivo: "[revisar_contenido] " + (analisisIA.motivo || ""), subtipo: "revisar_contenido" };
  }
  return { estadoDocumento: "OK", motivo: "", subtipo: null };
}

// ================= CLASIFICACIÓN REAL INDEPENDIENTE DEL FLUJO =================
// Esta función analiza un archivo y determina QUÉ tipo de documento es realmente,
// sin asumir que es el documento que "tocaba" según el paso actual.
// Es la pieza central de la lógica anti-confusión documental.

async function clasificarDocumentoConIA(buffer, mimeType) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!esDocumentoImagenNormalizable(mimeType)) return null;

  const base64 = buffer.toString("base64");
  const resultado = await llamarIAconImagen(
    "Eres un clasificador de documentos administrativos espanoles.\n\n" +
    "Analiza esta imagen e identifica QUE tipo de documento es.\n\n" +
    "Responde SOLO en JSON con este formato:\n" +
    "{\n" +
    "  \"tipo\": \"dni_delante | dni_detras | solicitud_emasesa | contrato_alquiler | libro_familia | " +
    "escritura_notarial | nif_cif | empadronamiento | justificante_ingresos | titularidad_bancaria | " +
    "licencia_apertura | autorizacion | otro | dudoso\",\n" +
    "  \"confianza\": 0-100,\n" +
    "  \"descripcion\": \"descripcion breve de lo que ves\"\n" +
    "}\n\n" +
    "Guia de clasificacion:\n" +
    "- dni_delante: DNI espanol con foto, nombre, apellidos, DNI numero (cara delantera)\n" +
    "- dni_detras: DNI espanol con codigo MRZ, codigo de barras (cara trasera)\n" +
    "- solicitud_emasesa: formulario de alta de agua EMASESA con campos a rellenar\n" +
    "- contrato_alquiler: contrato de arrendamiento o alquiler\n" +
    "- libro_familia: libro de familia espanol\n" +
    "- escritura_notarial: escritura notarial, poder notarial o documento similar\n" +
    "- nif_cif: tarjeta o documento NIF/CIF de empresa\n" +
    "- empadronamiento: certificado de empadronamiento municipal\n" +
    "- justificante_ingresos: nomina, pension, declaracion renta o similar\n" +
    "- titularidad_bancaria: certificado de titularidad de cuenta bancaria\n" +
    "- licencia_apertura: licencia de apertura o declaracion responsable\n" +
    "- autorizacion: documento de autorizacion o representacion\n" +
    "- otro: documento que no encaja en ninguna categoria anterior\n" +
    "- dudoso: imagen demasiado mala para clasificar",
    base64,
    IA_TIMEOUT_MS
  );

  return resultado || null;
}

// Mapea el tipo detectado por la IA al codigo interno del sistema
function mapearTipoIAaCodigo(tipoDetectado, documentoEsperado) {
  if (!tipoDetectado) return null;

  const mapa = {
    "solicitud_emasesa": "solicitud_firmada",
    "contrato_alquiler": "contrato_alquiler",
    "libro_familia": "libro_familia",
    "escritura_notarial": "escritura_constitucion",
    "nif_cif": "nif_sociedad",
    "empadronamiento": "empadronamiento",
    "justificante_ingresos": "justificante_ingresos",
    "titularidad_bancaria": "titularidad_bancaria",
    "licencia_apertura": "licencia_o_declaracion",
    "autorizacion": "autorizacion_familiar",
  };

  // Para DNI necesitamos contexto del documento esperado para asignar el titular correcto
  if (tipoDetectado === "dni_delante" || tipoDetectado === "dni_detras") {
    const cara = tipoDetectado === "dni_delante" ? "delante" : "detras";
    // Si el esperado es un DNI del mismo tipo, reutilizar el titular del esperado
    if (documentoEsperado && esDocumentoDNI(documentoEsperado)) {
      const base = documentoEsperado.replace("_delante", "").replace("_detras", "");
      return base + "_" + cara;
    }
    // Si no hay contexto DNI, usar el generico
    return "dni_" + cara;
  }

  return mapa[tipoDetectado] || null;
}

// Decide si el documento recibido coincide con el esperado, es un candidato
// para un slot diferente del flujo, o es completamente ajeno.
// Retorna: { decision: "coincide" | "diferente_flujo" | "ajeno", tipoReal, motivo }
function decidirContextoDocumento(tipoDetectado, confianza, documentoEsperado, tipoExpediente) {
  if (!tipoDetectado || tipoDetectado === "dudoso" || tipoDetectado === "otro") {
    return { decision: "ajeno", tipoReal: null, motivo: "no se pudo identificar el documento" };
  }

  const tipoReal = mapearTipoIAaCodigo(tipoDetectado, documentoEsperado);
  if (!tipoReal) {
    return { decision: "ajeno", tipoReal: null, motivo: "tipo de documento no reconocido para este flujo" };
  }

  // Coincidencia directa con el esperado
  if (tipoReal === documentoEsperado) {
    return { decision: "coincide", tipoReal, motivo: "" };
  }

  // Para DNI: coincide si es la cara correcta o incorrecta del mismo DNI
  if (esDocumentoDNI(tipoReal) && esDocumentoDNI(documentoEsperado)) {
    const baseReal = tipoReal.replace("_delante", "").replace("_detras", "");
    const baseEsperado = documentoEsperado.replace("_delante", "").replace("_detras", "");
    if (baseReal === baseEsperado) {
      // Mismo DNI pero cara incorrecta
      const caraReal = tipoReal.includes("_delante") ? "delantera" : "trasera";
      const caraEsperada = documentoEsperado.includes("_delante") ? "delantera" : "trasera";
      return {
        decision: "coincide",
        tipoReal,
        motivo: caraReal !== caraEsperada
          ? "has enviado la cara " + caraReal + " pero necesitamos la " + caraEsperada
          : ""
      };
    }
  }

  // Comprobar si el tipo real pertenece a algún slot del flujo actual
  const flow = (tipoExpediente && FLOWS[tipoExpediente]) ? FLOWS[tipoExpediente] : [];
  const perteneceAlFlujo = flow.some((paso) => paso.code === tipoReal);
  if (perteneceAlFlujo) {
    return { decision: "diferente_flujo", tipoReal, motivo: "documento reconocido pero no es el que se esperaba ahora" };
  }

  return { decision: "ajeno", tipoReal, motivo: "documento no esperado en este flujo" };
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
    { code: "solicitud_firmada", prompt: "\uD83D\uDC49 *Solicitud de EMASESA*\n\u2022 Descarga el formulario del enlace que te hemos enviado\n\u2022 R\u00e9llalo con tus datos\n\u2022 F\u00edrmalo a mano o por ordenador\n\u2022 H\u00e1zle una foto o env\u00edalo en PDF" },
    { code: "dni_delante",       prompt: "\uD83D\uDC49 *Tu DNI \u2014 la cara con tu foto*\n\u2022 La parte donde sale tu foto y tu nombre\n\u2022 Ponlo plano y hazle una foto entera con buena luz" },
    { code: "dni_detras",        prompt: "\uD83D\uDC49 *Tu DNI \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s, donde salen los c\u00f3digos\n\u2022 Ponlo plano y hazle una foto entera con buena luz" },
    { code: "empadronamiento",   prompt: "\uD83D\uDC49 *Certificado de empadronamiento (opcional)*\n\u2022 Si lo tienes, env\u00edamelo aqu\u00ed\n\u2022 Si no lo tienes, escribe NO y seguimos" },
  ],
  familiar: [
    { code: "solicitud_firmada",       prompt: "\uD83D\uDC49 *Solicitud de EMASESA*\n\u2022 Descarga el formulario del enlace\n\u2022 R\u00e9llalo con tus datos y f\u00edrmalo" },
    { code: "dni_familiar_delante",    prompt: "\uD83D\uDC49 *DNI del familiar \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_familiar_detras",     prompt: "\uD83D\uDC49 *DNI del familiar \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "dni_propietario_delante", prompt: "\uD83D\uDC49 *DNI del propietario del piso \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_propietario_detras",  prompt: "\uD83D\uDC49 *DNI del propietario del piso \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "libro_familia",           prompt: "\uD83D\uDC49 *Libro de familia*\n\u2022 \u00c1brelo por la p\u00e1gina donde salis t\u00fa y el propietario juntos\n\u2022 Foto clara o PDF" },
    { code: "autorizacion_familiar",   prompt: "\uD83D\uDC49 *Autorizaci\u00f3n del propietario*\n\u2022 El documento que te hemos enviado, firmado por el due\u00f1o del piso\n\u2022 Foto clara o PDF" },
    { code: "empadronamiento",         prompt: "\uD83D\uDC49 *Certificado de empadronamiento (opcional)*\n\u2022 Si lo tienes, env\u00edamelo aqu\u00ed\n\u2022 Si no lo tienes, escribe NO y seguimos" },
  ],
  inquilino: [
    { code: "solicitud_firmada",       prompt: "\uD83D\uDC49 *Solicitud de EMASESA*\n\u2022 Descarga el formulario del enlace\n\u2022 R\u00e9llalo con tus datos y f\u00edrmalo" },
    { code: "dni_inquilino_delante",   prompt: "\uD83D\uDC49 *Tu DNI \u2014 la cara con tu foto*\n\u2022 La parte donde sale tu foto y tu nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_inquilino_detras",    prompt: "\uD83D\uDC49 *Tu DNI \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "dni_propietario_delante", prompt: "\uD83D\uDC49 *DNI del propietario del piso \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_propietario_detras",  prompt: "\uD83D\uDC49 *DNI del propietario del piso \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "contrato_alquiler",       prompt: "\uD83D\uDC49 *Contrato de alquiler*\n\u2022 El contrato completo, firmado por las dos partes\n\u2022 En PDF si puedes\n\u2022 Si no, manda las p\u00e1ginas una a una y escribe LISTO cuando termines" },
    { code: "empadronamiento",         prompt: "\uD83D\uDC49 *Certificado de empadronamiento (opcional)*\n\u2022 Si lo tienes, env\u00edamelo aqu\u00ed\n\u2022 Si no lo tienes, escribe NO y seguimos" },
  ],
  sociedad: [
    { code: "solicitud_firmada",         prompt: "\uD83D\uDC49 *Solicitud de EMASESA*\n\u2022 R\u00e9llala con los datos de la empresa y f\u00edrmala\n\u2022 Foto clara o PDF" },
    { code: "dni_administrador_delante", prompt: "\uD83D\uDC49 *DNI del administrador \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_administrador_detras",  prompt: "\uD83D\uDC49 *DNI del administrador \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "nif_sociedad",              prompt: "\uD83D\uDC49 *NIF o CIF de la empresa*\n\u2022 La tarjeta del CIF o cualquier papel oficial\n\u2022 Foto o PDF" },
    { code: "escritura_constitucion",    prompt: "\uD83D\uDC49 *Escritura de constituci\u00f3n*\n\u2022 En PDF si puedes\n\u2022 Si no, manda las p\u00e1ginas una a una y escribe LISTO cuando termines" },
    { code: "poderes_representante",     prompt: "\uD83D\uDC49 *Poderes del representante*\n\u2022 En PDF si puedes\n\u2022 Si no, manda las p\u00e1ginas una a una y escribe LISTO cuando termines" },
  ],
  local: [
    { code: "solicitud_firmada",       prompt: "\uD83D\uDC49 *Solicitud de EMASESA*\n\u2022 R\u00e9llala y f\u00edrmala\n\u2022 Foto clara o PDF" },
    { code: "dni_propietario_delante", prompt: "\uD83D\uDC49 *DNI del propietario \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_propietario_detras",  prompt: "\uD83D\uDC49 *DNI del propietario \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "licencia_o_declaracion",  prompt: "\uD83D\uDC49 *Licencia de apertura o declaraci\u00f3n responsable*\n\u2022 En PDF si puedes\n\u2022 Si no, manda las p\u00e1ginas una a una y escribe LISTO cuando termines" },
  ],
  financiacion: [
    { code: "dni_pagador_delante",   prompt: "\uD83D\uDC49 *DNI de quien va a pagar \u2014 la cara con la foto*\n\u2022 La parte donde sale la foto y el nombre\n\u2022 Foto entera con buena luz" },
    { code: "dni_pagador_detras",    prompt: "\uD83D\uDC49 *DNI de quien va a pagar \u2014 la cara de atr\u00e1s*\n\u2022 La parte de atr\u00e1s con los c\u00f3digos\n\u2022 Foto entera con buena luz" },
    { code: "justificante_ingresos", prompt: "\uD83D\uDC49 *Justificante de ingresos*\n\u2022 Tu \u00faltima n\u00f3mina, pensi\u00f3n o declaraci\u00f3n de la renta\n\u2022 Foto o PDF" },
    { code: "titularidad_bancaria",  prompt: "\uD83D\uDC49 *Certificado de titularidad bancaria*\n\u2022 Un papel del banco que confirma que eres titular de la cuenta\n\u2022 PDF o foto" },
  ],
};

function mapTipoExpediente(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (t === "1" || t === "1\uFE0F\u20E3" || t.includes("propiet") || t.includes("piso es m")) return "propietario";
  if (t === "2" || t === "2\uFE0F\u20E3" || t.includes("familiar")) return "familiar";
  if (t === "3" || t === "3\uFE0F\u20E3" || t.includes("inquilin")) return "inquilino";
  if (t === "4" || t === "4\uFE0F\u20E3" || t.includes("sociedad") || t.includes("empresa")) return "sociedad";
  if (t === "5" || t === "5\uFE0F\u20E3" || t.includes("local")) return "local";
  return null;
}
function mapFinanciacion(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (t === "1" || t === "1\uFE0F\u20E3" || t === "si" || t === "s\u00ed" || t.includes("plazos") || t.includes("interesa")) return "si";
  if (t === "2" || t === "2\uFE0F\u20E3" || t === "no" || t.includes("una vez")) return "no";
  return null;
}
function buildPreguntaTipo(nombre) {
  const saludo = nombre ? "Hola " + nombre + " \uD83D\uDC4B" : "Hola \uD83D\uDC4B";
  return saludo + "\n\nEspero que el v\u00eddeo te haya dado una idea de c\u00f3mo funciona el proceso \u2B06\uFE0F\n\nAhora dime: \u00bfcu\u00e1l es tu situaci\u00f3n con el piso?\n\n1\uFE0F\u20E3 El piso es m\u00edo\n2\uFE0F\u20E3 El contrato va a nombre de un familiar\n3\uFE0F\u20E3 Soy inquilino (el piso es de otra persona)\n4\uFE0F\u20E3 El piso est\u00e1 a nombre de una empresa\n5\uFE0F\u20E3 Es un local comercial";
}
function buildPreguntaFinanciacion() {
  return "\u2705 Casi lo tenemos todo.\n\n\u00daltima pregunta: \u00bfquieres pagar tu parte en plazos?\n\n1\uFE0F\u20E3 S\u00ed, me interesa pagar en plazos\n2\uFE0F\u20E3 No, lo pago de una vez";
}

// ================= IA TEXTO =================
async function responderConIA(mensaje, expediente) {
  const documentoActual = labelDocumento(expediente.documento_actual);
  const pendientes = labelsDocumentos(expediente.documentos_pendientes).join(", ");
  const opcionales = labelsDocumentos(expediente.documentos_opcionales_pendientes).join(", ");
  const dias = diasEntre(expediente.fecha_primer_contacto);
  // Si el vecino está en el paso de solicitud, usar el prompt experto en rellenar la solicitud
  const enSolicitud = expediente.documento_actual === "solicitud_firmada" ||
    (expediente.ultimo_documento_fallido === "solicitud_firmada");

  const promptSolicitud = enSolicitud
    ? "\n\n=== MODO EXPERTO: AYUDA CON LA SOLICITUD DE EMASESA ===\n" +
      "El vecino est\u00e1 rellenando o tiene dudas sobre el impreso de toma de datos de EMASESA.\n\n" +
      "CAMPOS QUE DEBEN ESTAR CORRECTOS:\n" +
      "1. DATOS PERSONALES: Nombre y apellidos, DNI/NIF, direcci\u00f3n completa, piso, tel\u00e9fono, email, n\u00famero de habitantes\n" +
      "2. EMPADRONAMIENTO: Debe marcar UNA de las dos casillas (entrega o no entrega certificado)\n" +
      "3. AUTORIZACI\u00d3N: Debe marcar la casilla de autorizaci\u00f3n de comunicaciones por email\n" +
      "4. DATOS BANCARIOS: Titular, banco e IBAN completo de 24 d\u00edgitos\n" +
      "5. FIRMA Y FECHA: Fecha (d\u00eda, mes, a\u00f1o) y firma manuscrita o digital\n\n" +
      "REGLAS DE VALIDACI\u00d3N:\n" +
      "- Si falta algo: d\u00edselo claramente y en orden de importancia\n" +
      "- Si algo est\u00e1 mal: explica c\u00f3mo corregirlo con un ejemplo\n" +
      "- Si la foto no se ve bien: pide otra mejor\n" +
      "- Si todo est\u00e1 correcto: conf\u00edrmalo y anima a enviarlo\n\n" +
      "FORMA DE RESPONDER:\n" +
      "- Frases cortas y f\u00e1ciles, sin t\u00e9cnicos\n" +
      "- Paso a paso, nunca todo de golpe\n" +
      "- Tono cercano y profesional, como un gestor que ayuda de verdad\n" +
      "- Refuerza positivamente cuando lo hace bien\n"
    : "";

  const promptSistema =
    "Eres el asistente de Instalaciones Araujo para el Plan 5 de EMASESA.\n" +
    "Tipo de expediente: " + (expediente.tipo_expediente || "sin definir") + "\n" +
    "Paso actual: " + (expediente.paso_actual || "") + "\n" +
    "Documento actual pendiente: " + documentoActual + "\n" +
    "Documentos pendientes: " + (pendientes || "ninguno") + "\n" +
    "Documentos opcionales pendientes: " + (opcionales || "ninguno") + "\n" +
    "Dias desde inicio: " + dias + "\n" +
    promptSolicitud + "\n" +
    "REGLAS OBLIGATORIAS:\n" +
    "- Nunca digas que un documento ya fue recibido, firmado, validado o completado salvo que aparezca expresamente en el contexto.\n" +
    "- Nunca digas que se ha pasado al siguiente paso salvo que el contexto lo indique.\n" +
    "- Si el usuario est\u00e1 confundido, recu\u00e9rdale \u00fanicamente el documento actual pendiente y c\u00f3mo enviarlo.\n" +
    "- No des por hecho que la solicitud est\u00e1 firmada ni recibida si no consta.\n" +
    "- No reformules el estado del expediente m\u00e1s all\u00e1 de lo indicado aqu\u00ed.\n" +
    "- Responde breve, clara y \u00fatil. Sin rodeos.\n" +
    "- Tu objetivo es reconducir al usuario al documento actual pendiente.";
  const fallback = "Retomamos tu expediente.\n\nTe falta por enviar:\n- " + documentoActual + "\n\nPuedes enviarlo directamente por este WhatsApp.";
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      { model: "gpt-4o-mini", temperature: 0.3, messages: [{ role: "system", content: promptSistema }, { role: "user", content: mensaje }] },
      { timeout: IA_TIMEOUT_MS, headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" } }
    );
    const texto = response && response.data && response.data.choices && response.data.choices[0] ? response.data.choices[0].message.content.trim() : null;
    return texto || fallback;
  } catch (error) {
    console.error("Error IA texto", { error: error && error.response ? JSON.stringify(error.response.data) : error.message });
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
// Sanitiza un nombre para que sea seguro como nombre de carpeta en Drive
function sanitizarNombreCarpeta(nombre) {
  return (nombre || "sin_nombre")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-zA-Z0-9\s_\-\.]/g, "")             // solo alfanum, espacios, guiones, puntos
    .replace(/\s+/g, "_")                               // espacios a guion bajo
    .trim()
    .slice(0, 60) || "sin_nombre";
}

// Estructura: raiz / comunidad / [bloque /] vivienda / subcarpeta
// subcarpeta: "01_documentacion_base" | "02_financiacion" | "03_adicional"
async function getOrCreateCarpetaVivienda(datosVecino, subcarpeta) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const comunidad = sanitizarNombreCarpeta(datosVecino.comunidad || "comunidad_desconocida");
  const bloque = datosVecino.bloque ? sanitizarNombreCarpeta(datosVecino.bloque) : null;
  const vivienda = sanitizarNombreCarpeta(datosVecino.vivienda || datosVecino.telefono || "vivienda_desconocida");

  // Nivel 1: carpeta comunidad
  let carpetaComunidad = await buscarCarpeta(comunidad, rootId);
  if (!carpetaComunidad) carpetaComunidad = await crearCarpeta(comunidad, rootId);

  // Nivel 2 (opcional): carpeta bloque
  let parentVivienda = carpetaComunidad.id;
  if (bloque) {
    let carpetaBloque = await buscarCarpeta(bloque, carpetaComunidad.id);
    if (!carpetaBloque) carpetaBloque = await crearCarpeta(bloque, carpetaComunidad.id);
    parentVivienda = carpetaBloque.id;
  }

  // Nivel 3: carpeta vivienda
  let carpetaVivienda = await buscarCarpeta(vivienda, parentVivienda);
  if (!carpetaVivienda) carpetaVivienda = await crearCarpeta(vivienda, parentVivienda);

  // Nivel 4 (opcional): subcarpeta dentro de vivienda
  if (!subcarpeta) return carpetaVivienda.id;
  let carpetaSub = await buscarCarpeta(subcarpeta, carpetaVivienda.id);
  if (!carpetaSub) carpetaSub = await crearCarpeta(subcarpeta, carpetaVivienda.id);
  return carpetaSub.id;
}

// Helper: devuelve la subcarpeta de paso
function subcarpetaParaPaso(pasoActual, tipoDocumento) {
  if (tipoDocumento === "adicional") return "03_adicional";
  if (pasoActual === "recogida_financiacion") return "02_financiacion";
  return "01_documentacion_base";
}

// Helper: devuelve la subcarpeta de estado dentro de la carpeta de paso
// validados = OK, revisar = REVISAR, rechazados = REPETIR o ajeno
function subcarpetaParaEstado(estadoDocumento) {
  if (estadoDocumento === "OK") return "validados";
  if (estadoDocumento === "REVISAR") return "revisar";
  return "rechazados";
}

// Obtener carpetaId con subcarpeta de estado
async function getCarpetaConEstado(datosVecino, pasoActual, tipoDocumento, estadoDocumento) {
  const subPaso = subcarpetaParaPaso(pasoActual, tipoDocumento);
  const subEstado = subcarpetaParaEstado(estadoDocumento);
  // Estructura: comunidad / vivienda / 01_documentacion_base / validados
  const carpetaPaso = await getOrCreateCarpetaVivienda(datosVecino, subPaso);
  // Crear subcarpeta de estado dentro de la carpeta de paso
  const drive = getDriveClient();
  const busqueda = await drive.files.list({
    q: `name='${subEstado}' and '${carpetaPaso}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)", pageSize: 1
  });
  if (busqueda.data.files && busqueda.data.files.length > 0) {
    return busqueda.data.files[0].id;
  }
  const nueva = await drive.files.create({
    requestBody: { name: subEstado, mimeType: "application/vnd.google-apps.folder", parents: [carpetaPaso] },
    fields: "id"
  });
  return nueva.data.id;
}

// Mantener por compatibilidad con el flujo de fuera de contexto
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
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:Y" });
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
        // Columnas nuevas S, T, U (indices 18, 19, 20)
        ultimo_documento_fallido: row[18] || "",
        fecha_ultimo_fallo: row[19] || "",
        reintento_hasta: row[20] || "",
        motivo_bloqueo_actual: row[21] || "",
        prioridad_expediente: row[22] || "",
        requiere_intervencion_humana: row[23] || "no",
        documentos_opcionales_descartados: row[24] || "",
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
// Crear carpeta nota_simple en Drive cuando se inicia el expediente
async function crearCarpetaNotaSimple(datosVecino) {
  try {
    await getOrCreateCarpetaVivienda(datosVecino, "04_nota_simple");
    console.log("Carpeta nota_simple creada para", datosVecino.vivienda);
  } catch(e) {
    console.error("Error creando carpeta nota_simple:", e.message);
  }
}

async function crearExpedienteInicial(telefono, datosVecino) {
  const sheets = getSheetsClient();
  const ahora = ahoraISO();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:Y", valueInputOption: "RAW",
    requestBody: { values: [[
      telefono, (datosVecino && datosVecino.comunidad) || "", (datosVecino && datosVecino.vivienda) || "",
      (datosVecino && datosVecino.nombre) || "", "", "pregunta_tipo", "", "pendiente_clasificacion",
      ahora, ahora, ahora, sumarDias(ahora, 20), "", "NO", "ok", "", "", "",
      "", "", "",
      "", "", "no",
      "",
    ]] },
  });
  // Crear carpeta 04_nota_simple en Drive en background
  if (datosVecino) crearCarpetaNotaSimple(datosVecino).catch(() => {});
}
async function actualizarExpediente(rowIndex, data) {
  // Recalcular motivo_bloqueo_actual automaticamente antes de guardar
  data.motivo_bloqueo_actual = calcularMotivoBloqueActual(data);
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A" + rowIndex + ":Y" + rowIndex,
    valueInputOption: "RAW",
    requestBody: { values: [[
      data.telefono || "", data.comunidad || "", data.vivienda || "", data.nombre || "",
      data.tipo_expediente || "", data.paso_actual || "", data.documento_actual || "",
      data.estado_expediente || "", data.fecha_inicio || "", data.fecha_primer_contacto || "",
      data.fecha_ultimo_contacto || "", data.fecha_limite_documentacion || "",
      data.fecha_limite_firma || "", data.documentos_completos || "",
      data.alerta_plazo || "", data.documentos_recibidos || "",
      data.documentos_pendientes || "", data.documentos_opcionales_pendientes || "",
      data.ultimo_documento_fallido || "",
      data.fecha_ultimo_fallo || "",
      data.reintento_hasta || "",
      data.motivo_bloqueo_actual || "",
      data.prioridad_expediente || "",
      data.requiere_intervencion_humana || "no",
      data.documentos_opcionales_descartados || "",
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

// columna I = estadoRevision: OK | REVISAR | REPETIR
// columna J = motivo (texto limpio, sin prefijos)
// columna K = subtipo_revision: revisar_calidad | revisar_contenido | revisar_clasificacion | revisar_pdf | null
function extraerSubtipoYMotivo(motivo) {
  if (!motivo) return { subtipo: "", motivo: "" };
  const match = motivo.match(/^\[([\w_]+)\]\s*(.*)/);
  if (match) return { subtipo: match[1], motivo: match[2].trim() };
  return { subtipo: "", motivo: motivo };
}

// Calcula la prioridad de revision humana basada en tipo de documento y subtipo
function calcularPrioridadRevision(tipoDocumento, subtipo, estadoRevision) {
  if (estadoRevision === "OK") return "";
  // Alta prioridad: documentos criticos con problemas de contenido o sin clasificar
  const docsCriticos = ["solicitud_firmada", "justificante_ingresos", "titularidad_bancaria", "contrato_alquiler"];
  const docsMedios = ["dni_delante", "dni_detras", "dni_familiar_delante", "dni_familiar_detras",
    "dni_propietario_delante", "dni_propietario_detras", "dni_inquilino_delante", "dni_inquilino_detras",
    "dni_administrador_delante", "dni_administrador_detras", "dni_pagador_delante", "dni_pagador_detras",
    "nif_sociedad", "escritura_constitucion", "poderes_representante", "licencia_o_declaracion"];
  if (docsCriticos.includes(tipoDocumento)) {
    if (subtipo === "revisar_pdf" || subtipo === "revisar_contenido") return "alta";
    if (subtipo === "revisar_calidad") return "media";
    return "alta";
  }
  if (docsMedios.includes(tipoDocumento)) {
    if (subtipo === "revisar_pdf" || subtipo === "revisar_contenido") return "media";
    return "media";
  }
  // Baja prioridad: empadronamiento, adicionales, y calidad en docs no criticos
  return "baja";
}

async function guardarDocumentoSheet(telefono, comunidad, vivienda, tipoDocumento, nombreArchivo, urlDrive, origenClasificacion, estadoRevision, motivoRaw) {
  const { subtipo, motivo } = extraerSubtipoYMotivo(motivoRaw);
  const prioridad = calcularPrioridadRevision(tipoDocumento, subtipo, estadoRevision);
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:L", valueInputOption: "RAW",
    requestBody: { values: [[
      telefono, comunidad, vivienda, tipoDocumento,
      nombreArchivo, ahoraISO(), urlDrive || "",
      origenClasificacion || "", estadoRevision || "OK", motivo || "", subtipo || "", prioridad || "",
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
    const limite = RECENT_FILE_WINDOW_MS;
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
      range: "documentos!A:L",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const ahora = new Date();
    const limite = RECENT_FILE_WINDOW_MS;
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

// ================= LÓGICA OPERATIVA: PRIORIDAD Y INTERVENCIÓN HUMANA =================

// Calcula la prioridad global del expediente leyendo los documentos guardados.
// Sube la prioridad del documento más urgente al nivel del expediente completo.
async function calcularPrioridadExpediente(telefono) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:L",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    let maxPrioridad = "baja";
    const orden = { "alta": 0, "media": 1, "baja": 2, "": 3 };
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      const estado = row[8] || "";
      if (estado === "OK") continue; // solo documentos con incidencia
      const prioridad = row[11] || "";
      if (orden[prioridad] < orden[maxPrioridad]) maxPrioridad = prioridad;
    }
    return maxPrioridad === "baja" ? "baja" : maxPrioridad;
  } catch (e) {
    console.error("Error calculando prioridad expediente:", e.message);
    return "baja";
  }
}

// Decide si el expediente requiere intervención humana.
// Disparadores:
// - 2 o más REPETIR del mismo tipo documental
// - prioridad_expediente = alta
// - expediente cerca de plazo (>= 18 días) con documentos pendientes
// - PDF critico sin clasificar
async function calcularRequiereIntervencion(telefono, expediente) {
  try {
    const dias = diasEntre(expediente.fecha_primer_contacto);
    const tienePendientes = splitList(expediente.documentos_pendientes).length > 0;

    // Cerca de plazo con pendientes — subir prioridad automaticamente
    if (dias >= 18 && tienePendientes) return "si";
    if (dias >= 10 && tienePendientes && expediente.prioridad_expediente === "alta") return "si";

    // Prioridad alta sin urgencia de plazo
    if (expediente.prioridad_expediente === "alta") return "si";

    // Leer documentos para contar REPETIR por tipo
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:K",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const repetirPorTipo = {};
    const hayPDFCritico = ["solicitud_firmada", "justificante_ingresos", "titularidad_bancaria"];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      const tipo = row[3] || "";
      const estado = row[8] || "";
      const subtipo = row[10] || "";
      const origen = row[7] || "";

      // PDF critico sin clasificar
      if (hayPDFCritico.includes(tipo) && subtipo === "revisar_pdf") return "si";

      // Contar repeticiones por tipo
      if (estado === "REPETIR") {
        repetirPorTipo[tipo] = (repetirPorTipo[tipo] || 0) + 1;
        if (repetirPorTipo[tipo] >= 2) return "si";
      }
    }

    return "no";
  } catch (e) {
    console.error("Error calculando intervencion:", e.message);
    return "no";
  }
}

// Solo calcula en memoria: actualiza prioridad_expediente y requiere_intervencion_humana en el objeto.
// No persiste — el llamador (recalcularYActualizarTodo) hace la escritura final.
async function calcularIndicadoresOperativosEnMemoria(expediente) {
  try {
    // Prioridad base desde documentos
    let prioridad = await calcularPrioridadExpediente(expediente.telefono);
    // Subir prioridad dinamicamente por cercanía de plazo
    const dias = diasEntre(expediente.fecha_primer_contacto);
    const tienePendientes = splitList(expediente.documentos_pendientes).length > 0;
    if (dias >= 18 && tienePendientes) {
      prioridad = "alta"; // plazo critico siempre sube a alta
    } else if (dias >= 10 && tienePendientes && prioridad === "baja") {
      prioridad = "media"; // a partir de 10 dias, baja sube a media
    }
    expediente.prioridad_expediente = prioridad;
    const intervencion = await calcularRequiereIntervencion(expediente.telefono, expediente);
    expediente.requiere_intervencion_humana = intervencion;
    // No persiste aqui
  } catch (e) {
    console.error("Error calculando indicadores operativos en memoria:", e.message);
  }
}

// ================= CONTADOR DE INTENTOS POR DOCUMENTO =================

// Devuelve cuántas veces se ha intentado subir un documento para este teléfono.
// Útil para detectar documentos problemáticos y saber si escalar a revisión humana.
// Cuenta solo los envios con resultado REPETIR para un documento y telefono.
// Mide fallos reales, no todos los intentos.
async function contarFallosDocumento(telefono, tipoDocumento) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:I",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      if (row[8] !== "REPETIR") continue;
      // Contar si el tipo coincide con el esperado O si el origen incluye "flujo"
      const origenFila = row[5] || "";
      if (row[3] === tipoDocumento || origenFila.startsWith("flujo")) count++;
    }
    return count;
  } catch (e) {
    console.error("Error contando fallos:", e.message);
    return 0;
  }
}

// Mantener alias para compatibilidad con calcularRequiereIntervencion
async function contarIntentosDocumento(telefono, tipoDocumento) {
  return await contarFallosDocumento(telefono, tipoDocumento);
}

// ================= LOGICA DE REINTENTO DE DOCUMENTOS FALLIDOS =================
// Ventana de reintento: 15 minutos desde que un documento sale REPETIR
// RETRY_WINDOW_MS definido arriba como constante global

// Registra un documento fallido en el expediente y calcula la ventana de reintento
function marcarDocumentoFallido(expediente, tipoDocumento) {
  const ahora = ahoraISO();
  const hasta = new Date(Date.now() + RETRY_WINDOW_MS).toISOString();
  expediente.ultimo_documento_fallido = tipoDocumento;
  expediente.fecha_ultimo_fallo = ahora;
  expediente.reintento_hasta = hasta;
  return expediente;
}

// Limpia los campos de reintento cuando se resuelve correctamente
function limpiarReintento(expediente) {
  expediente.ultimo_documento_fallido = "";
  expediente.fecha_ultimo_fallo = "";
  expediente.reintento_hasta = "";
  return expediente;
}

// Comprueba si hay una ventana de reintento activa y aun vigente
function hayReintentoVigente(expediente) {
  if (!expediente.ultimo_documento_fallido || !expediente.reintento_hasta) return false;
  const hasta = new Date(expediente.reintento_hasta);
  return !isNaN(hasta) && Date.now() < hasta.getTime();
}

// ================= FLOW HELPERS =================
// DEPRECATED: toda la lógica de negocio debe usar resolverEstadoConversacional().
// getNextStep solo existe como fallback de apoyo en código heredado.
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

// Calcula el motivo de bloqueo actual del expediente para la columna V.
// Esto permite al equipo saber en un vistazo por qué está parado cada expediente.
function calcularMotivoBloqueActual(expediente) {
  if (expediente.paso_actual === "finalizado") {
    const estadosSuciosFinal = [
      "expediente_con_documento_a_repetir",
      "expediente_con_revision_pendiente",
      "expediente_final_pendiente_revision",
    ];
    if (estadosSuciosFinal.includes(expediente.estado_expediente)) return "completo_revision_final";
    const hayFin = expediente.estado_expediente === "pendiente_estudio_financiacion";
    return hayFin ? "pendiente_financiacion_estudio" : "completo_pendiente_tramitacion";
  }
  if (expediente.ultimo_documento_fallido && expediente.reintento_hasta) {
    const hasta = new Date(expediente.reintento_hasta);
    if (!isNaN(hasta) && Date.now() < hasta.getTime()) return "documento_a_repetir";
  }
  const estadosRevision = [
    "expediente_con_revision_pendiente",
    "expediente_con_documento_a_repetir",
    "expediente_final_pendiente_revision",
  ];
  if (estadosRevision.includes(expediente.estado_expediente)) {
    // Detectar si hay PDF sin clasificar reciente
    if (expediente.estado_expediente === "expediente_con_revision_pendiente") return "revision_interna";
    return "documento_a_repetir";
  }
  if (expediente.paso_actual === "pregunta_financiacion") return "esperando_respuesta_financiacion";
  if (expediente.paso_actual === "recogida_financiacion") return "recogiendo_financiacion";
  // Si hay documento_actual definido, el vecino tiene algo concreto que enviar
  if (expediente.documento_actual) return "esperando_documento_vecino";
  return "esperando_vecino";
}

// ================= AVISOS POR PLAZO =================
function construirAvisoPorPlazo(expediente) {
  const dias = diasEntre(expediente.fecha_primer_contacto);
  const horas = expediente.fecha_ultimo_contacto
    ? Math.floor((Date.now() - new Date(expediente.fecha_ultimo_contacto)) / (1000 * 60 * 60))
    : 999;

  const pendientesArr = splitList(expediente.documentos_pendientes);
  if (!pendientesArr.length) return null;

  // Usar documento_actual si existe (es lo que toca conversacionalmente),
  // y solo si no hay documento_actual usar el primer pendiente calculado.
  // Esto es mas coherente cuando se han aprovechado documentos adelantados.
  const docParaRecordatorio = expediente.documento_actual
    ? labelDocumento(expediente.documento_actual)
    : labelDocumento(pendientesArr[0]);
  const primerPendiente = docParaRecordatorio;
  const totalPendientes = pendientesArr.length;
  const sufijo = totalPendientes > 1 ? "\n\nAdemás quedan " + (totalPendientes - 1) + " documento(s) más pendientes." : "";

  // Recordatorio por inactividad (horas sin respuesta)
  if (horas >= 72 && expediente.alerta_plazo !== "recordatorio_72h" &&
      expediente.alerta_plazo !== "aviso_10_dias" &&
      expediente.alerta_plazo !== "urgente" &&
      expediente.alerta_plazo !== "fuera_plazo") {
    return {
      tipo: "recordatorio_72h", alerta: "recordatorio_72h",
      mensaje: "Para no retrasar tu expediente, necesitamos:\n\n• " + primerPendiente +
        "\n\nPuedes enviarlo directamente por este WhatsApp ahora mismo." + sufijo
    };
  }
  if (horas >= 24 && horas < 72 && expediente.alerta_plazo !== "recordatorio_24h" &&
      expediente.alerta_plazo !== "recordatorio_72h" &&
      expediente.alerta_plazo !== "aviso_10_dias" &&
      expediente.alerta_plazo !== "urgente" &&
      expediente.alerta_plazo !== "fuera_plazo") {
    return {
      tipo: "recordatorio_24h", alerta: "recordatorio_24h",
      mensaje: "Seguimos pendientes de:\n\n• " + primerPendiente +
        "\n\nPuedes enviarlo directamente por aqui." + sufijo
    };
  }

  // Avisos por plazo total (dias desde inicio)
  if (dias >= 20) return {
    tipo: "fuera_plazo", alerta: "fuera_plazo",
    mensaje: "ULTIMO AVISO - El plazo para tu expediente ha finalizado.\n\n• " + primerPendiente +
      "\n\nEnvialo URGENTEMENTE por este WhatsApp o tu expediente puede quedar bloqueado."
  };
  if (dias >= 18) return {
    tipo: "aviso_urgente", alerta: "urgente",
    mensaje: "Aviso importante - Queda poco tiempo.\n\n• " + primerPendiente +
      "\n\nEnvialo ahora por este WhatsApp para no perder el plazo."
  };
  if (dias >= 10) return {
    tipo: "aviso_10_dias", alerta: "aviso_10_dias",
    mensaje: "Recordatorio - Tu expediente lleva varios dias esperando:\n\n• " + primerPendiente +
      "\n\nPuedes enviarlo directamente por aqui." + sufijo
  };
  return null;
}
async function revisarYAvisarPorPlazo(expediente) {
  const aviso = construirAvisoPorPlazo(expediente);
  if (!aviso) {
    // No tocar alerta_plazo — puede que aun no hayan pasado 24h
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
  try { await guardarContacto(telefono, mensajeCliente, tipo, respuestaBot); } catch (e) { console.error("ERROR guardando contacto:", e.message); }
  // Modo background: res es null, devolver texto directamente
  if (!res) return respuestaBot;
  // Modo sincrono: escribir en res
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuestaBot);
  return res.type("text/xml").send(twiml.toString());
}

// ================= PROCESAMIENTO Y VALIDACIÓN COMPLETA DE UN ARCHIVO =================
// documentoActual: lo que el flujo espera recibir ahora
// tipoExpediente: para poder clasificar si el doc pertenece al flujo
// Renderiza la primera página de un PDF a buffer JPEG para análisis con IA.
// Usa pdftoppm (poppler), disponible en el sistema.
// Devuelve el buffer de imagen o null si falla.
async function renderizarPrimeraPaginaPDF(pdfBuffer) {
  const { execFile } = require("child_process");
  const os = require("os");
  const path = require("path");
  const fs = require("fs");
  const tmpDir = os.tmpdir();
  const tmpPDF = path.join(tmpDir, "arabot_" + Date.now() + ".pdf");
  const tmpBase = path.join(tmpDir, "arabot_p_" + Date.now());
  try {
    fs.writeFileSync(tmpPDF, pdfBuffer);
    await new Promise((resolve, reject) => {
      execFile("pdftoppm", ["-jpeg", "-r", "150", "-f", "1", "-l", "1", tmpPDF, tmpBase], (err) => {
        if (err) reject(err); else resolve();
      });
    });
    // pdftoppm genera archivos tipo tmpBase-1.jpg o tmpBase-01.jpg
    const archivos = fs.readdirSync(tmpDir).filter(f => f.startsWith(path.basename(tmpBase)) && f.endsWith(".jpg")).sort();
    if (archivos.length === 0) return null;
    const imgBuffer = fs.readFileSync(path.join(tmpDir, archivos[0]));
    return imgBuffer;
  } catch (err) {
    console.error("Error renderizando PDF:", err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPDF); } catch {}
    // Limpiar archivos generados
    try {
      const archivos2 = fs.readdirSync(tmpDir).filter(f => f.startsWith(path.basename(tmpBase)));
      archivos2.forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch {} });
    } catch {}
  }
}

// Helper de timing: imprime cuánto tardó cada bloque en ms
function tlog(label, telefono, start) {
  console.log("[TIMING]", label, telefono, Date.now() - start + "ms");
}

async function procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaId, documentoActual, tipoExpediente) {
  const t0 = Date.now();

  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
  });
  tlog("descarga_twilio", telefono, t0);

  const bufferOriginal = Buffer.from(response.data);

  // Control de tamaño: rechazar archivos mayores de 10MB
  if (bufferOriginal.length > MAX_FILE_SIZE) {
    throw new Error("archivo_demasiado_grande");
  }

  const extension = extensionDesdeMime(mimeType);
  const fileName = (documentoActual || "documento") + "_" + telefono + "_" + Date.now() + extension;
  let bufferFinal = bufferOriginal;

  // Para PDFs: solo IA si existe, sin validacion tecnica de imagen
  if (mimeType.includes("pdf")) {
    const esLargo = DOCS_LARGOS.includes(documentoActual);
    const docsPDFImportantes = ["solicitud_firmada", "nif_sociedad", "justificante_ingresos", "titularidad_bancaria", "empadronamiento", "autorizacion_familiar"];
    const esPDFImportante = docsPDFImportantes.includes(documentoActual);
    let estadoPDF = "OK";
    let motivoPDF = "";
    if (esLargo) { estadoPDF = "REVISAR"; motivoPDF = "[revisar_pdf] PDF de documento largo pendiente de revision"; }
    else if (esPDFImportante) { estadoPDF = "REVISAR"; motivoPDF = "[revisar_pdf] PDF pendiente de revision interna"; }
    let file;
    try {
      file = await uploadToDrive(bufferFinal, fileName, mimeType, carpetaId);
    } catch (err) {
      console.error("ERROR uploadToDrive [tel=" + telefono + ", archivo=" + fileName + "]:", err.message);
      throw err;
    }
    // Politica de clasificacion de PDFs segun el tipo de documento esperado:
    //
    // 1. DOCS_LARGOS (contrato, escritura, etc.): el PDF es el formato natural → coincide
    // 2. docsPDFAdmisibles (solicitud, NIF, justificante, etc.): puede llegar en PDF
    //    pero no se puede clasificar visualmente → sin_clasificar (va a REVISAR)
    // 3. Cualquier otro documento (DNI, etc.): un PDF es inesperado y sospechoso
    //    porque estos documentos son fisicos y solo deberian llegar como imagen → ajeno
    //
    // "ajeno" activa REPETIR y el flujo no avanza, igual que si fuera una imagen erronea.

    // Documentos que pueden llegar naturalmente en PDF pero no son largos
    const docsPDFAdmisibles = [
      "solicitud_firmada", "nif_sociedad", "justificante_ingresos",
      "titularidad_bancaria", "empadronamiento", "autorizacion_familiar",
    ];
    // Documentos que solo deben llegar como imagen (DNI, etc.)
    // Un PDF de estos tipos es casi siempre un error del vecino
    const docsSoloImagen = [
      "dni_delante", "dni_detras",
      "dni_familiar_delante", "dni_familiar_detras",
      "dni_propietario_delante", "dni_propietario_detras",
      "dni_inquilino_delante", "dni_inquilino_detras",
      "dni_administrador_delante", "dni_administrador_detras",
      "dni_pagador_delante", "dni_pagador_detras",
    ];

    let contextoDocPDF;
    let estadoFinalPDF;
    let motivoFinalPDF;

    if (esLargo) {
      // Documento largo: PDF es el formato natural, asumir coincidencia
      contextoDocPDF = "coincide";
      estadoFinalPDF = estadoPDF; // REVISAR ya asignado arriba
      motivoFinalPDF = motivoPDF;
    } else if (docsSoloImagen.includes(documentoActual)) {
      // Documento que solo debe llegar como imagen: PDF es inesperado
      contextoDocPDF = "ajeno";
      estadoFinalPDF = "REPETIR";
      motivoFinalPDF = "los documentos de identidad deben enviarse como foto, no como PDF";
    } else if (documentoActual === "solicitud_firmada") {
      // Caso especial: la solicitud NECESITA validacion de contenido.
      // Un PDF vacio, sin rellenar o sin firmar no puede avanzar el flujo.
      // Renderizamos la primera pagina y la analizamos con IA especifica.
      contextoDocPDF = "coincide"; // el formato es correcto, el contenido es lo que hay que validar
      const ts = Date.now();
      const imgPDF = await renderizarPrimeraPaginaPDF(bufferOriginal);
      tlog("render_pdf_solicitud", telefono, ts);
      if (imgPDF) {
        const analisisSolicitud = await analizarSolicitudFirmadaConIA(imgPDF);
        tlog("ia_analisis_solicitud_pdf", telefono, ts);
        estadoFinalPDF = analisisSolicitud.estadoDocumento;
        motivoFinalPDF = analisisSolicitud.motivo || "";
        console.log("Resultado final solicitud PDF:", { estadoFinalPDF, motivoFinalPDF });
      } else {
        // No se pudo renderizar: dejar en REVISAR sin avanzar
        estadoFinalPDF = "REVISAR";
        motivoFinalPDF = "[revisar_pdf] no se pudo verificar el contenido de la solicitud — pendiente de revision manual";
      }
    } else if (docsPDFAdmisibles.includes(documentoActual)) {
      // Documento admisible en PDF pero sin clasificacion visual
      contextoDocPDF = "sin_clasificar";
      estadoFinalPDF = "REVISAR";
      motivoFinalPDF = "[revisar_pdf] PDF importante sin clasificacion visual — pendiente de revision prioritaria";
    } else {
      // Tipo desconocido: tratar como sin_clasificar por precaucion
      contextoDocPDF = "sin_clasificar";
      estadoFinalPDF = estadoPDF === "OK" ? "REVISAR" : estadoPDF;
      motivoFinalPDF = estadoPDF === "OK"
        ? "[revisar_pdf] PDF de tipo no verificado — pendiente de revision"
        : motivoPDF;
    }

    return { file, fileName, estadoDocumento: estadoFinalPDF, motivo: motivoFinalPDF, tipoDetectado: documentoActual, contextoDoc: contextoDocPDF };
  }

  // Para imagenes: 1) clasificacion real independiente del flujo
  //                2) validacion tecnica
  //                3) analisis especifico del tipo esperado
  let estadoDocumento = "OK";
  let motivo = "";
  let tipoDetectado = documentoActual;
  let contextoDoc = "coincide";

  if (esDocumentoImagenNormalizable(mimeType)) {
    // PASO 1: Clasificar qué documento es realmente
    const tc = Date.now();
    const clasificacion = await clasificarDocumentoConIA(bufferOriginal, mimeType);
    tlog("ia_clasificacion", telefono, tc);

    if (clasificacion && clasificacion.tipo && clasificacion.tipo !== "dudoso") {
      const contexto = decidirContextoDocumento(clasificacion.tipo, clasificacion.confianza, documentoActual, tipoExpediente);
      tipoDetectado = contexto.tipoReal || documentoActual;
      contextoDoc = contexto.decision;
      if (contexto.decision === "ajeno") {
        estadoDocumento = "REPETIR";
        motivo = contexto.motivo || "el documento recibido no coincide con el esperado";
      } else if (contexto.decision === "diferente_flujo") {
        estadoDocumento = "REVISAR";
        motivo = "[revisar_clasificacion] documento reconocido pero no es el que se esperaba ahora (" + labelDocumento(tipoDetectado) + ")";
      }
    }

    // PASO 2: Validacion tecnica (siempre, es rapida — sin llamada a red)
    const tv = Date.now();
    const validacionTecnica = await validarImagenTecnica(bufferOriginal);
    tlog("validacion_tecnica", telefono, tv);

    // PASO 3: Analisis IA especifico — SOLO si el documento coincide con lo esperado
    // Si ya sabemos que no coincide (ajeno / diferente_flujo), nos ahorramos esta llamada
    const mereceAnalisisEspecifico =
      estadoDocumento !== "REPETIR" &&
      (contextoDoc === "coincide" || contextoDoc === "sin_clasificar" || !contextoDoc);

    if (mereceAnalisisEspecifico) {
      const ta = Date.now();
      const tipoParaAnalizar = tipoDetectado || documentoActual;
      const analisisIA = await analizarDocumentoConIA(bufferOriginal, tipoParaAnalizar);
      tlog("ia_analisis", telefono, ta);
      const estadoFinal = determinarEstadoFinal(validacionTecnica, analisisIA);
      if (estadoFinal.estadoDocumento === "REPETIR" ||
          (estadoFinal.estadoDocumento === "REVISAR" && estadoDocumento === "OK")) {
        estadoDocumento = estadoFinal.estadoDocumento;
        motivo = estadoFinal.motivo || motivo;
      }
    } else {
      // Sin segunda IA: aplicar solo la validacion tecnica
      if (validacionTecnica.estado === "REPETIR") {
        estadoDocumento = validacionTecnica.estado;
        motivo = validacionTecnica.motivo;
      } else if (validacionTecnica.estado === "REVISAR" && estadoDocumento === "OK") {
        estadoDocumento = "REVISAR";
        motivo = "[revisar_calidad] " + validacionTecnica.motivo;
      }
    }

    // Normalizar imagen
    const tn = Date.now();
    const procesado = await normalizarImagenDocumento(bufferOriginal);
    tlog("normalizar_imagen", telefono, tn);
    if (procesado.ok) bufferFinal = procesado.buffer;
  }

  const tu = Date.now();
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
  tlog("upload_drive", telefono, tu);
  tlog("procesar_total", telefono, t0);

  return { file, fileName, estadoDocumento, motivo, tipoDetectado, contextoDoc };
}

// ================= RUTAS =================
app.get("/", (req, res) => { res.send("Servidor OK"); });

// Objeto de contexto que comparte estado entre subfunciones del handler
// Evita pasar decenas de params y mantiene el scope original
function buildCtx(req, res, telefono, msgOriginal, msg, numMedia, datosVecino, expediente) {
  return { req, res, telefono, msgOriginal, msg, numMedia, datosVecino, expediente };
}

// Dispatcher principal: llama subfunciones en orden hasta que una maneje la request
async function manejarMensajeWhatsApp(req, res) {
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

    const ctx = buildCtx(req, res, telefono, msgOriginal, msg, numMedia, datosVecino, expediente);

    // Dispatcher: cada handler devuelve la respuesta o undefined para seguir al siguiente
    return (
      await handlePreguntaTipo(ctx) ||
      await handleListoDocumentoLargo(ctx) ||
      await handleTextoRecogidaDocumentacion(ctx) ||
      await handlePreguntaFinanciacion(ctx) ||
      await handleTextoFinanciacion(ctx) ||
      await handleArchivos(ctx) ||
      await handleRespuestaGenerica(ctx)
    );

  } catch (error) {
    const telefonoErr = (req.body.From || "").replace("whatsapp:", "");
    console.error("ERROR GENERAL:", { error: error.message, telefono: telefonoErr });
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Ha habido un problema procesando tu mensaje.");
    return res.type("text/xml").send(twiml.toString());
  }
}

// ================= SUBFUNCIONES DEL HANDLER =================
// Cada una recibe ctx y devuelve la respuesta si maneja la request, o undefined si no.
// Usan destructuring para acceder al contexto de forma limpia.

// Mensajes de bienvenida por tipo de expediente
// Incluyen lista de documentos, PDFs rellenables y explicación del proceso
const MENSAJES_BIENVENIDA = {
  propietario: "Perfecto \u2705\n\nAntes de empezar, ten esto a mano:\n\n\uD83D\uDCCB *Lo que vas a necesitar:*\n\u2022 La Solicitud de EMASESA (te la acabo de enviar)\n\u2022 Tu DNI por las dos caras\n\u2022 Si tienes el certificado de empadronamiento, tambi\u00e9n puede venir bien\n\nTe ir\u00e9 pidiendo los documentos de uno en uno, sin prisa. Empezamos con la Solicitud. R\u00e9llala con tus datos y f\u00edrmala. Cuando est\u00e9 lista, env\u00edamela por aqu\u00ed.",
  familiar: "Perfecto \u2705\n\nAntes de empezar, ten esto a mano:\n\n\uD83D\uDCCB *Lo que vas a necesitar:*\n\u2022 La Solicitud de EMASESA (te la acabo de enviar)\n\u2022 La Autorizaci\u00f3n del propietario (te la acabo de enviar) \u2014 la firma el due\u00f1o del piso\n\u2022 Tu DNI por las dos caras\n\u2022 El DNI del propietario por las dos caras\n\u2022 El libro de familia\n\u2022 Si tienes el certificado de empadronamiento, tambi\u00e9n puede venir bien\n\nTe ir\u00e9 pidiendo los documentos de uno en uno, sin prisa. Empezamos con la Solicitud. R\u00e9llala con tus datos y f\u00edrmala. Cuando est\u00e9 lista, env\u00edamela por aqu\u00ed.",
  inquilino: "Perfecto \u2705\n\nAntes de empezar, ten esto a mano:\n\n\uD83D\uDCCB *Lo que vas a necesitar:*\n\u2022 La Solicitud de EMASESA (te la acabo de enviar)\n\u2022 Tu DNI por las dos caras\n\u2022 El DNI del propietario del piso por las dos caras\n\u2022 El contrato de alquiler completo y firmado\n\u2022 Si tienes el certificado de empadronamiento, tambi\u00e9n puede venir bien\n\nTe ir\u00e9 pidiendo los documentos de uno en uno, sin prisa. Empezamos con la Solicitud. R\u00e9llala con tus datos y f\u00edrmala. Cuando est\u00e9 lista, env\u00edamela por aqu\u00ed.",
  sociedad: "Perfecto \u2705\n\nAntes de empezar, ten esto a mano:\n\n\uD83D\uDCCB *Lo que vas a necesitar:*\n\u2022 La Solicitud de EMASESA (te la acabo de enviar)\n\u2022 El DNI del administrador por las dos caras\n\u2022 El NIF o CIF de la empresa\n\u2022 La escritura de constituci\u00f3n\n\u2022 Los poderes del representante\n\nTe ir\u00e9 pidiendo los documentos de uno en uno, sin prisa. Empezamos con la Solicitud. R\u00e9llala con los datos de la empresa y f\u00edrmala. Cuando est\u00e9 lista, env\u00edamela por aqu\u00ed.",
  local: "Perfecto \u2705\n\nAntes de empezar, ten esto a mano:\n\n\uD83D\uDCCB *Lo que vas a necesitar:*\n\u2022 La Solicitud de EMASESA (te la acabo de enviar)\n\u2022 El DNI del propietario por las dos caras\n\u2022 La licencia de apertura o declaraci\u00f3n responsable\n\nTe ir\u00e9 pidiendo los documentos de uno en uno, sin prisa. Empezamos con la Solicitud. R\u00e9llala y f\u00edrmala. Cuando est\u00e9 lista, env\u00edamela por aqu\u00ed.",
};

function buildMensajeBienvenida(tipo) {
  return MENSAJES_BIENVENIDA[tipo] || 'Perfecto. Comenzamos con la recogida de documentacion.';
}


// Paso 2: manda el vídeo explicativo con miniatura via Cloudinary
async function enviarVideoExplicativo(telefono) {
  try {
    await enviarWhatsAppConMedia(telefono, "", "https://res.cloudinary.com/donf5e6rj/video/upload/vc_h264,q_50/GUIA_PARA_VECINOS_P5_txbrm7.mp4");
  } catch(e) {
    console.error("Error enviando video:", e.message);
  }
}

// Paso 4: manda los PDFs correspondientes según el tipo elegido
async function enviarPDFsSegunTipo(telefono, tipoExpediente) {
  const BASE_URL = process.env.BASE_URL || "https://araujo-bot.onrender.com";
  try {
    await new Promise(r => setTimeout(r, 1000));
    await enviarWhatsAppConMedia(telefono,
      "\uD83D\uDCCE Aqu\u00ed tienes la Solicitud de EMASESA para rellenar y firmar:",
      BASE_URL + "/media/solicitud");
    if (tipoExpediente === "familiar") {
      await new Promise(r => setTimeout(r, 1000));
      await enviarWhatsAppConMedia(telefono,
        "\uD83D\uDCCE Y esta es la Autorizaci\u00f3n que tiene que firmar el propietario del piso:",
        BASE_URL + "/media/autorizacion");
    }
  } catch(e) {
    console.error("Error enviando PDFs:", e.message);
  }
}

async function handlePreguntaTipo({ res, telefono, msgOriginal, msg, numMedia, datosVecino, expediente }) {
    // ================= PREGUNTA TIPO =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_tipo") {
      const tipo = mapTipoExpediente(msg);
      if (!tipo) {
        // Primera vez que escribe: mandar vídeo + pregunta de tipo
        const esRespuestaPresentacion = !expediente.fecha_primer_contacto ||
          expediente.fecha_primer_contacto === expediente.fecha_ultimo_contacto;
        if (esRespuestaPresentacion) {
          // Mandar vídeo primero, luego el mensaje de tipo con pausa
          // para garantizar el orden correcto en WhatsApp
          const preguntaTipo = buildPreguntaTipo(datosVecino.nombre);
          enviarVideoExplicativo(telefono)
            .then(() => new Promise(r => setTimeout(r, 5000)))
            .then(() => enviarWhatsApp(telefono, preguntaTipo))
            .catch(() => enviarWhatsApp(telefono, preguntaTipo).catch(() => {}));
          // Responder vacío a Twilio para no bloquear el webhook
          return res.status(200).send("<Response></Response>");
        }
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaTipo(datosVecino.nombre));
      }
      const primerPaso = getFirstStep(tipo);
      expediente.tipo_expediente = tipo;
      expediente.paso_actual = "recogida_documentacion";
      expediente.documento_actual = primerPaso ? primerPaso.code : "";
      expediente.estado_expediente = "en_proceso";
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);
      await recalcularYActualizarTodo(expediente);
      // Mandar PDFs correspondientes según tipo elegido
      enviarPDFsSegunTipo(telefono, tipo).catch(() => {});
      return responderYLog(res, telefono, msgOriginal, "texto",
        buildMensajeBienvenida(tipo));
    }
}

async function handleListoDocumentoLargo({ res, telefono, msgOriginal, msg, numMedia, expediente }) {
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

      expediente.fecha_ultimo_contacto = ahoraISO();

      // Si el documento largo no llego valido, marcar fallo y NO avanzar al cierre
      if (!docLargoValido) {
        expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Las paginas han llegado con problemas y este documento sigue pendiente.\n\n" +
          "Por favor, vuelve a enviarlo por aqui o envialo en un PDF completo.\n" +
          "Cuando lo tengas listo, escribe LISTO de nuevo.");
      }

      // Motor central — pasar doc largo recien completado para evitar lag de Sheets
      expediente = await resolverEstadoConversacional(expediente, docLargoValido ? [expediente.documento_actual] : []);
      await recalcularYActualizarTodo(expediente);
      const promptSigListo = expediente.documento_actual ? getPromptPasoActual(expediente) : null;
      if (expediente.paso_actual === "recogida_documentacion" && expediente.documento_actual) {
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Documento completo recibido.\n\n" + (promptSigListo || ""));
      }
      if (expediente.paso_actual === "pregunta_financiacion") {
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Documento completo recibido.\n\n" + buildPreguntaFinanciacion());
      }
      return responderYLog(res, telefono, msgOriginal, "texto", "Documento completo recibido.");
    }
}

// Obtiene el prompt guiado del paso actual para mostrárselo al vecino cuando está perdido
function getPromptPasoActual(expediente) {
  const flujo = expediente.paso_actual === "recogida_financiacion"
    ? FLOWS["financiacion"]
    : FLOWS[expediente.tipo_expediente] || [];
  const paso = flujo.find((p) => p.code === expediente.documento_actual);
  return paso ? paso.prompt : "";
}

// IMPORTANTE:
// Helpers para opcionales descartados conversacionalmente (el vecino dijo NO)
function getOpcionalesDescartados(expediente) {
  return new Set(splitList(expediente.documentos_opcionales_descartados || ""));
}
function marcarOpcionalDescartado(expediente, documentoCode) {
  const set = getOpcionalesDescartados(expediente);
  set.add(documentoCode);
  expediente.documentos_opcionales_descartados = joinList(Array.from(set));
  return expediente;
}

// Calcula el siguiente documento real del flujo respetando:
// 1. Obligatorios primero — NUNCA mostrar opcionales si hay obligatorios pendientes
// 2. Opcionales solo si no quedan obligatorios y no han sido descartados conversacionalmente
// 3. Si no queda nada, retorna vacío
function obtenerSiguienteDocumentoReal(tipoExpediente, docsRecibidosArr, opcionalesDescartadosArr) {
  const flow = FLOWS[tipoExpediente] || [];
  const recibidos = new Set(docsRecibidosArr || []);
  const opcDesc = new Set(opcionalesDescartadosArr || []);
  const reglas = REQUIRED_DOCS[tipoExpediente] || { obligatorios: [], opcionales: [] };
  const obligatorios = new Set(reglas.obligatorios || []);
  const opcionales = new Set(reglas.opcionales || []);
  for (const paso of flow) {
    if (obligatorios.has(paso.code) && !recibidos.has(paso.code)) {
      return { documento_actual: paso.code, tipo: "obligatorio", completo: false };
    }
  }
  for (const paso of flow) {
    if (opcionales.has(paso.code) && !recibidos.has(paso.code) && !opcDesc.has(paso.code)) {
      return { documento_actual: paso.code, tipo: "opcional", completo: true };
    }
  }
  return { documento_actual: "", tipo: "ninguno", completo: true };
}

// DEPRECATED: usar resolverEstadoConversacional() en su lugar.
// Esta función no distingue financiación y solo rehidrata flujo base.
async function sincronizarEstadoRealDelFlujo(expediente) {
  expediente = await hidratarResumenDocumentalDesdeSheets(expediente);
  const docsRecibidosArr = splitList(expediente.documentos_recibidos);
  const opcDescArr = splitList(expediente.documentos_opcionales_descartados || "");
  const siguienteReal = obtenerSiguienteDocumentoReal(
    expediente.tipo_expediente,
    docsRecibidosArr,
    opcDescArr
  );
  expediente.documento_actual = siguienteReal.documento_actual || "";
  expediente.documentos_completos = siguienteReal.completo ? "SI" : "NO";
  return expediente;
}

// ===== MOTOR CENTRAL DE FLUJO =====
// SIEMPRE usar esta función para decidir el estado conversacional del expediente.
// Rehidrata desde Sheets, aplica reglas de obligatorios > opcionales > financiación,
// y devuelve el expediente con paso_actual, documento_actual y estado_expediente correctos.
// NUNCA decidir flujo fuera de esta función.
async function resolverEstadoConversacional(expediente, docsExtraRecibidos = []) {
  // 1. Fuente de verdad: leer documentos reales desde Sheets
  // docsExtraRecibidos: documentos recien guardados que pueden no haberse propagado aun en Sheets
  const esFinanciacion = expediente.paso_actual === "recogida_financiacion";
  expediente = await hidratarResumenDocumentalDesdeSheets(expediente, esFinanciacion ? "financiacion" : null);
  // Fusionar con docs extra para evitar lag de propagacion de Sheets
  const docsRecibidosSet = new Set(splitList(expediente.documentos_recibidos));
  for (const d of docsExtraRecibidos) { if (d) docsRecibidosSet.add(d); }
  expediente.documentos_recibidos = joinList(Array.from(docsRecibidosSet));
  const docsRecibidos = Array.from(docsRecibidosSet);
  const opcDesc = splitList(expediente.documentos_opcionales_descartados || "");

  // 2. Financiación: si ya estamos en ese paso, calcular siguiente doc de financiación
  if (esFinanciacion) {
    const sigFin = obtenerSiguienteDocumentoReal("financiacion", docsRecibidos, []);
    if (sigFin.documento_actual) {
      expediente.documento_actual = sigFin.documento_actual;
      expediente.estado_expediente = "pendiente_financiacion";
      return expediente;
    }
    expediente.paso_actual = "finalizado";
    expediente.documento_actual = "";
    expediente.estado_expediente = "pendiente_estudio_financiacion";
    return expediente;
  }

  // 3. Documentación base: obligatorios primero, opcionales solo si no queda ningún obligatorio
  const sigBase = obtenerSiguienteDocumentoReal(expediente.tipo_expediente, docsRecibidos, opcDesc);
  if (sigBase.documento_actual) {
    expediente.paso_actual = "recogida_documentacion";
    expediente.documento_actual = sigBase.documento_actual;
    expediente.estado_expediente = "en_proceso";
    return expediente;
  }

  // 4. Sin pendientes: pasar a pregunta de financiación
  expediente.paso_actual = "pregunta_financiacion";
  expediente.documento_actual = "";
  expediente.estado_expediente = "documentacion_base_completa";
  expediente.documentos_completos = "SI";
  return expediente;
}

// esMensajeAmbiguo solo se usa dentro de pasos guiados (recogida_documentacion,
// recogida_financiacion), nunca en pregunta_tipo ni pregunta_financiacion.
// Por eso aqui podemos tratar numeros sueltos, "si", "no", "ok", etc. como ambiguos.
function esMensajeAmbiguo(texto) {
  if (!texto) return true;
  const t = texto.trim().toLowerCase();

  // Muy corto (1-2 caracteres)
  if (t.length <= 2) return true;

  // Números sueltos fuera de contexto
  if (/^\d+$/.test(t)) return true;

  // Afirmaciones / negaciones sin contexto
  if (/^(ok|vale|si|sí|no|nop|okey|okay|perfecto|bien|claro|entendido|recibido|de acuerdo|ahi va|ahi voy)$/i.test(t)) return true;

  // Saludos y cortesias
  if (/^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|ey|saluda|saludos|buenas|hi|hello)$/i.test(t)) return true;

  // Signos solos o casi solos
  if (/^[?!.]+$/.test(t)) return true;

  // Textos muy cortos sin sentido (<= 6 chars y no es "listo")
  if (t.length <= 6 && t !== "listo") return true;

  return false;
}

// Construye la respuesta determinista cuando el mensaje es ambiguo durante un flujo guiado.
// Prioriza el documento fallido si hay reintento activo.
function respuestaGuiadaPorExpediente(expediente) {
  // Si hay reintento activo, recordar primero ese documento pendiente
  if (expediente.ultimo_documento_fallido && expediente.reintento_hasta) {
    const hasta = new Date(expediente.reintento_hasta);
    if (!isNaN(hasta) && Date.now() < hasta.getTime()) {
      const docFallidoLabel = labelDocumento(expediente.ultimo_documento_fallido);
      // Solo mostrar "seguiremos con" si el doc actual es DISTINTO del fallido
      const continuarConOtro = expediente.documento_actual &&
        expediente.documento_actual !== expediente.ultimo_documento_fallido;
      const siguienteTexto = continuarConOtro
        ? "\n\nCuando lo resuelvas, seguiremos con:\n• " + labelDocumento(expediente.documento_actual)
        : "";
      const promptFallido = (FLOWS[expediente.tipo_expediente] || [])
        .find(p => p.code === expediente.ultimo_documento_fallido);
      const guiaFallido = promptFallido ? promptFallido.prompt : ("\uD83D\uDC49 " + bold(docFallidoLabel));
      return "Todavía no hemos recibido correctamente:\n\n" + guiaFallido +
        "\n\nPor favor, envíalo de nuevo para poder continuar.";
    }
  }
  // Sin reintento activo: recordar el documento actual con su prompt guiado
  if (expediente.documento_actual) {
    const docLabel = labelDocumento(expediente.documento_actual);
    const promptPaso = getPromptPasoActual(expediente);
    // El prompt del paso ya incluye 👉 bold(doc) + bullets — usarlo directamente
    return promptPaso
      ? "\u27A1\uFE0F Seguimos en este paso:\n\n" + promptPaso
      : "\u27A1\uFE0F Seguimos en este paso:\n\n" + bold(docLabel) + "\n\nCuando lo envíes y lo validemos, pasaremos al siguiente documento.";
  }
  return "Seguimos con tu expediente. Envíame el documento que corresponde para continuar.";
}

// Detecta frases donde el vecino cree que ya mandó el documento (pero no consta validado).
// Se usa para reconducir sin pasar por IA, que podría dar la razón al vecino por error.
function esMensajeDeConfusionSobreEstado(texto) {
  if (!texto) return false;
  const t = texto.trim().toLowerCase();
  const patrones = [
    /ya te lo mand[eé]/,
    /ya lo mand[eé]/,
    /ya lo envi[eé]/,
    /ya est[aá] enviado/,
    /eso ya est[aá]/,
    /ya lo ten[eé]is/,
    /ya os lo mand[eé]/,
    /si ya est[aá]/,
    /si ya lo tienes/,
    /pero si ya lo mand[eé]/,
    /pero si ya est[aá]/,
    /ya te lo pas[eé]/,
    /lo mand[eé] antes/,
    /ya lo he enviado/,
    /ya est[aá]/,
    /si ya/,
    /ya lo tengo enviado/,
    /te lo pas[eé]/,
    /ya est[aá] hecho/,
    /pero si ya/,
    /ya lo ten[eé]is/,
  ];
  return patrones.some((p) => p.test(t));
}

// Reconstruye documentos realmente recibidos desde la hoja documentos! (fuente de verdad).
// La cache expedientes.documentos_recibidos puede desincronizarse; esta funcion siempre lee el estado real.
async function reconstruirDocsRecibidosDesdeSheets(telefono, tipoExpediente) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "documentos!A:I",
    });
    const rows = res.data.values || [];
    const telNorm = normalizarTelefono(telefono);
    const reglas = REQUIRED_DOCS[tipoExpediente] || { obligatorios: [], opcionales: [] };
    const docsDelFlujo = new Set([...(reglas.obligatorios || []), ...(reglas.opcionales || [])]);
    const recibidos = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tel = normalizarTelefono(row[0] || "");
      const tipoDoc = row[3] || "";
      const estado = row[8] || "OK";
      if (tel !== telNorm) continue;
      if (!docsDelFlujo.has(tipoDoc)) continue;
      // OK o REVISAR cuentan como recibidos. REPETIR no.
      if (estado === "OK" || estado === "REVISAR") recibidos.add(tipoDoc);
    }
    return Array.from(recibidos);
  } catch (e) {
    console.error("Error reconstruyendo docs desde Sheets:", e.message);
    return [];
  }
}

// Rehidrata el resumen documental del expediente desde la hoja documentos! real.
// tipoDocs: si se pasa "financiacion", reconstruye docs de financiacion en lugar del flujo base.
async function hidratarResumenDocumentalDesdeSheets(expediente, tipoDocs = null) {
  const tipo = tipoDocs || expediente.tipo_expediente;
  const docsRecibidosArr = await reconstruirDocsRecibidosDesdeSheets(
    expediente.telefono,
    tipo
  );
  const resumen = calcularDocsExpediente(tipo, docsRecibidosArr);
  expediente.documentos_recibidos = resumen.recibidos;
  expediente.documentos_pendientes = resumen.pendientes;
  expediente.documentos_opcionales_pendientes = resumen.opcionalesPendientes;
  expediente.documentos_completos = resumen.completos;
  return expediente;
}

// Detecta si el vecino quiere saltar un documento opcional.
// Cubre frases cortas, negaciones directas y variantes naturales de WhatsApp.
function esIntencionSaltarOpcional(texto) {
  if (!texto) return false;
  const t = texto.trim().toLowerCase();
  const patrones = [
    /^no$/i,
    /^nop$/i,
    /^no,?\s*(lo\s*)?(tengo|dispongo|encuentro|tengo ahora)/i,
    /^no\s*(puedo|me\s*es\s*posible)/i,
    /^(paso|sigo|siguiente|continua|continuar|seguir|adelante|vamos)/i,
    /^lo\s*mando\s*(despues|luego|mas\s*tarde)/i,
    /no\s*(lo\s*)?(tengo|dispongo)\s*(ahora|de\s*momento)?/i,
    /de\s*momento\s*no/i,
    /ahora\s*(mismo\s*)?no/i,
    // frases naturales de "no lo voy a mandar"
    /^no\s+lo\s+voy\s+a\s+(mandar|enviar)/i,
    /^no\s+voy\s+a\s+(mandarlo|enviarlo)/i,
    /^no\s+quiero\s+(mandarlo|enviarlo|mandarlo|aportar)/i,
    /^prefiero\s+no\s+(mandarlo|enviarlo)/i,
    /^no\s+lo\s+mando$/i,
    /^no\s+lo\s+env[ií]o$/i,
    // frases de "seguir sin eso"
    /^sin\s+eso$/i,
    /^sigue\s+sin\s+eso$/i,
    /^continua\s+sin\s+eso$/i,
    /^seguir\s+sin\s+eso$/i,
    /^mejor\s+sin\s+eso$/i,
  ];
  return patrones.some((p) => p.test(t));
}

async function handleTextoRecogidaDocumentacion({ res, telefono, msgOriginal, msg, numMedia, expediente }) {
    // ================= TEXTO DURANTE RECOGIDA DOCUMENTACION =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion") {
      const mensajePlazo = await revisarYAvisarPorPlazo(expediente);
      if (mensajePlazo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", mensajePlazo);

      const mn = (msgOriginal || "").trim().toLowerCase();

            // Deteccion de intencion de saltar documento opcional usando funcion reutilizable
      const quiereSaltarOpcional = esIntencionSaltarOpcional(mn);

      if (esDocumentoOpcional(expediente.tipo_expediente, expediente.documento_actual) && quiereSaltarOpcional) {
        expediente = marcarOpcionalDescartado(expediente, expediente.documento_actual);
        expediente.fecha_ultimo_contacto = ahoraISO();
        // Motor central: decide el siguiente paso real
        expediente = await resolverEstadoConversacional(expediente);
        await recalcularYActualizarTodo(expediente);
        if (expediente.paso_actual === "recogida_documentacion" && expediente.documento_actual) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto\n\nContinuamos sin ese documento opcional.\n\n" + getPromptPasoActual(expediente));
        }
        if (expediente.paso_actual === "pregunta_financiacion") {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto\n\nContinuamos sin ese documento opcional.\n\n" + buildPreguntaFinanciacion());
        }
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Perfecto\n\nContinuamos sin ese documento opcional.");
      }

      if (DOCS_LARGOS.includes(expediente.documento_actual)) {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "\u27A1\uFE0F Seguimos con:\n\n" + bold(labelDocumento(expediente.documento_actual)) +
          "\n\n\u2022 Preferiblemente envialo en un unico PDF completo\n\u2022 Si no puedes, mandalo pagina a pagina como fotos\n\n\uD83D\uDC49 Cuando termines de enviar todo, escribe *LISTO*");
      }

      // Si el mensaje es ambiguo o incoherente, NO pasar por IA.
      // Rehidratar desde Sheets antes de reconducir para evitar estado cacheado incorrecto.
      if (esMensajeAmbiguo(msgOriginal) || esMensajeDeConfusionSobreEstado(msgOriginal)) {
        expediente = await hidratarResumenDocumentalDesdeSheets(expediente);
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          respuestaGuiadaPorExpediente(expediente));
      }

      const respuestaIA = await responderConIA(msgOriginal, expediente);
      return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", respuestaIA);
    }
}

async function handlePreguntaFinanciacion({ res, telefono, msgOriginal, msg, numMedia, expediente }) {
    // ================= PREGUNTA FINANCIACION =================
    if (numMedia === 0 && expediente.paso_actual === "pregunta_financiacion") {
      const respuestaFin = mapFinanciacion(msg);
      if (!respuestaFin) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", buildPreguntaFinanciacion());

      if (respuestaFin === "no") {
        expediente.paso_actual = "finalizado";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        expediente.documentos_completos = "SI";
        expediente.fecha_ultimo_contacto = ahoraISO();
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Perfecto Tu expediente base ya esta completo. Nuestro equipo lo revisara y te avisara si necesitamos algo mas.");
      }

      const primerPasoFin = getFirstStep("financiacion");
      expediente.paso_actual = "recogida_financiacion";
      expediente.documento_actual = primerPasoFin.code;
      expediente.estado_expediente = "pendiente_financiacion";
      expediente.fecha_ultimo_contacto = ahoraISO();
      await recalcularYActualizarTodo(expediente);
      return responderYLog(res, telefono, msgOriginal, "texto",
        "Perfecto\n\nVamos a estudiar la financiacion.\n\n" + primerPasoFin.prompt);
    }
}

async function handleTextoFinanciacion({ res, telefono, msgOriginal, msg, numMedia, expediente }) {
    // ================= TEXTO DURANTE FINANCIACION =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_financiacion") {
      const mensajePlazo = await revisarYAvisarPorPlazo(expediente);
      if (mensajePlazo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", mensajePlazo);

      // Mismo filtro de ambiguedad y confusión que en documentacion
      if (esMensajeAmbiguo(msgOriginal) || esMensajeDeConfusionSobreEstado(msgOriginal)) {
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          respuestaGuiadaPorExpediente(expediente));
      }

      const respuestaIA = await responderConIA(msgOriginal, expediente);
      return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", respuestaIA);
    }
}

// Decide si un documento puede marcar el flujo como avanzado.
// Documentos críticos (como solicitud_firmada) solo avanzan con OK, no con REVISAR.
// El resto de documentos sí pueden avanzar con REVISAR (quedan para revisión humana pero el flujo no se bloquea).
function puedeAvanzarFlujo(tipoDocumento, estadoDocumento) {
  if (estadoDocumento === "OK") return true;
  if (estadoDocumento === "REPETIR") return false;
  return true; // REVISAR avanza, queda marcado para revision humana
}

async function handleArchivos(ctx) {
  const { req, res, telefono, msgOriginal, numMedia, datosVecino } = ctx;
  let expediente = ctx.expediente;
    // ================= SI MANDA ARCHIVO(S) =================
    if (numMedia > 0) {
      let carpetaId;
      try {
        const subCarpeta = subcarpetaParaPaso(expediente.paso_actual, "");
        carpetaId = await getOrCreateCarpetaVivienda(datosVecino, subCarpeta);
      } catch (err) {
        console.error("ERROR creando carpeta Drive:", { error: err.message, telefono });
        return responderYLog(res, telefono, "archivo", "archivo",
          "Ha habido un problema guardando el archivo. Por favor, intentalo de nuevo.");
      }
      const esPasoValido =
        expediente.paso_actual === "recogida_documentacion" ||
        expediente.paso_actual === "recogida_financiacion";

      // ====== ARCHIVO FUERA DE FLUJO ======
      if (!esPasoValido) {
        return await handleArchivoFueraDeFlujo({ req, res, telefono, numMedia, datosVecino, expediente });
      }

      // ====== ARCHIVO DENTRO DEL FLUJO ======
      // Lectura fresca para evitar race-condition en envios multiples
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

      // ===== LOGICA DE REINTENTO =====
      // Si hay una ventana de reintento activa, intentar procesar el archivo
      // como si fuera el documento fallido antes de tratarlo como documento_actual.
      let documentoAValidar = expediente.documento_actual;

      if (hayReintentoVigente(expediente)) {
        const docFallido = expediente.ultimo_documento_fallido;
        // Procesamos primero contra el documento fallido para ver si encaja
        let resultadoPrueba;
        try {
          resultadoPrueba = await procesarYValidarArchivo(mediaUrl0, mimeType0, telefono, carpetaId, docFallido, expediente.tipo_expediente);
        } catch (err) {
          resultadoPrueba = null;
        }
        // Reintento valido: OK o REVISAR, y el doc coincide con el fallido (incluye sin_clasificar)
        if (resultadoPrueba && resultadoPrueba.estadoDocumento !== "REPETIR" &&
            (resultadoPrueba.contextoDoc === "coincide" ||
             resultadoPrueba.contextoDoc === "sin_clasificar" ||
             !resultadoPrueba.contextoDoc)) {
          // Guardar el reintento con su estado real
          try {
            await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
              docFallido, resultadoPrueba.fileName, resultadoPrueba.file.webViewLink || "",
              "reintento", resultadoPrueba.estadoDocumento, resultadoPrueba.motivo);
          } catch (err) { console.error("ERROR guardarDoc reintento:", err.message); }
          // Limpiar ventana de reintento y marcar el documento como recibido
          expediente = limpiarReintento(expediente);
          expediente.fecha_ultimo_contacto = ahoraISO();
          // No refrescar con cache — el motor central rehidrata desde Sheets

          // Avanzar el flujo igual que si el documento hubiera llegado bien en el flujo normal
          const docFallidoLabel = labelDocumento(docFallido);
          const msgReintentoBase = resultadoPrueba.estadoDocumento === "OK"
            ? "\u2705 " + bold(docFallidoLabel) + " recibido correctamente.\n\nDocumento pendiente resuelto."
            : "\u26A0\uFE0F " + bold(docFallidoLabel) + " recibido, pero nuestro equipo necesita verificarlo antes de continuar.";

          // El docFallido puede ser distinto del documento_actual actual
          // (el vecino reenvio el fallido mientras el flujo ya habia avanzado)
          // En ese caso solo resolver el pendiente, no cambiar documento_actual
          if (expediente.documento_actual && expediente.documento_actual !== docFallido) {
            await recalcularYActualizarTodo(expediente);
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\nAhora seguimos con:\n• " +
              labelDocumento(expediente.documento_actual) + "\n\nNo hace falta reenviar lo anterior.");
          }

          // El docFallido era el documento_actual: motor central con doc resuelto
          expediente = await resolverEstadoConversacional(expediente, [docFallido]);
          await recalcularYActualizarTodo(expediente);
          const promptSigRein = expediente.documento_actual ? getPromptPasoActual(expediente) : null;
          if (expediente.paso_actual === "recogida_documentacion" && expediente.documento_actual) {
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\nSeguimos con:\n" + promptSigRein);
          }
          if (expediente.paso_actual === "recogida_financiacion" && expediente.documento_actual) {
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\nSeguimos con:\n" + promptSigRein);
          }
          if (expediente.paso_actual === "pregunta_financiacion") {
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\n" + buildPreguntaFinanciacion());
          }
          // Detectar si el vecino necesita atencion humana
      if (msgOriginal && msgOriginal.trim().length > 3) {
        try {
          const analisis = await detectarNecesidadHumano(msgOriginal, expediente);
          if (analisis.escalar) {
            console.log("ATENCION HUMANA:", analisis.motivo);
            notificarEquipo("atencion_humana", {
              nombre: datosVecino.nombre, comunidad: datosVecino.comunidad,
              vivienda: datosVecino.vivienda, telefono,
              mensaje: msgOriginal.slice(0, 100),
              motivo: analisis.motivo
            }).catch(() => {});
          }
        } catch(e) {}
      }

      if (expediente.paso_actual === "finalizado") {
        expediente = await hidratarResumenDocumentalDesdeSheets(expediente);
        const resumenFinal = calcularDocsExpediente(expediente.tipo_expediente, splitList(expediente.documentos_recibidos));
        const pendientesObligatorios = splitList(resumenFinal.pendientes);
        const estadosSucios = ["expediente_con_documento_a_repetir","expediente_con_revision_pendiente","expediente_final_pendiente_revision"];
        const tieneRevisiones = estadosSucios.includes(expediente.estado_expediente);
        const textoFin = (msgOriginal || "").trim().toLowerCase();
        const quiereEnviar = ["mando","envio","adjunto","subo","reenvio"].some(p => textoFin.includes(p));
        if (pendientesObligatorios.length > 0) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Todav\u00eda nos faltan estos documentos:\n\n" +
            pendientesObligatorios.map(d => "\u2022 " + labelDocumento(d)).join("\n") +
            "\n\nPuedes enviarlo directamente por aqu\u00ed.");
        }
        if (quiereEnviar) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto \u2705 Env\u00edamelo por aqu\u00ed y lo a\u00f1adimos a tu expediente.");
        }
        if (tieneRevisiones) {
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Hemos recibido toda tu documentaci\u00f3n. Nuestro equipo la est\u00e1 revisando y te avisar\u00e1 si hay que corregir algo.\n\nSi quieres reenviar algo, mand\u00e1melo por aqu\u00ed.");
        }
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Tu expediente est\u00e1 completo \u2705\n\nNuestro equipo lo est\u00e1 revisando. Te avisaremos cuando est\u00e9 todo en orden.");
      }
        }
        // Si el archivo no encaja como reintento, seguir con flujo normal
        // Si el archivo no encaja como reintento, seguir con el flujo normal.
        // La ventana de reintento se mantiene activa hasta que expire o se resuelva correctamente.
      }
      // ===== FIN LOGICA DE REINTENTO =====

      let fallosDocActual = 0; // contador de fallos reales (solo REPETIR) del doc actual
      let resultado;
      try {
        resultado = await procesarYValidarArchivo(mediaUrl0, mimeType0, telefono, carpetaId, documentoAValidar, expediente.tipo_expediente);
      } catch (err) {
        console.error("ERROR archivo principal:", { error: err.message, telefono, documento: documentoAValidar });
        if (err.message === "archivo_demasiado_grande") {
          return responderYLog(res, telefono, "archivo", "archivo",
            "El archivo es demasiado grande (maximo 10MB). Puedes comprimirlo o enviarlo en varias partes.");
        }
        return responderYLog(res, telefono, "archivo", "archivo",
          "Ha habido un problema procesando el archivo. Por favor, intentalo de nuevo.");
      }

      // Guardar documento principal con tipo real detectado y origen de clasificacion
      // origenClasificacion distingue si fue clasificado correctamente o no:
      // - flujo: doc coincide con el esperado (clasificacion confirmada)
      // - flujo_sin_clasificar: PDF importante que no se pudo clasificar visualmente
      // - flujo_diferente: la IA detecto un doc distinto al esperado
      const docCoincideParaSheet = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
      const tipoParaSheet = docCoincideParaSheet
        ? (documentoAValidar || resultado.tipoDetectado || "pendiente_clasificar")
        : (resultado.tipoDetectado || documentoAValidar || "pendiente_clasificar");
      const origenParaSheet = resultado.contextoDoc === "sin_clasificar" ? "flujo_sin_clasificar"
        : (resultado.contextoDoc === "diferente_flujo" || resultado.contextoDoc === "ajeno") ? "flujo_diferente"
        : "flujo";
      // Mover archivo a subcarpeta de estado correcta en Drive
      try {
        const carpetaEstado = await getCarpetaConEstado(
          datosVecino, expediente.paso_actual, documentoAValidar, resultado.estadoDocumento
        );
        if (carpetaEstado && resultado.file && resultado.file.id) {
          const driveClient = getDriveClient();
          // Obtener carpetas padre actuales y mover a carpeta de estado
          const fileMeta = await driveClient.files.get({ fileId: resultado.file.id, fields: "parents" });
          const prevParents = (fileMeta.data.parents || []).join(",");
          await driveClient.files.update({
            fileId: resultado.file.id,
            addParents: carpetaEstado,
            removeParents: prevParents,
            fields: "id, parents"
          });
        }
      } catch(e) { console.error("Error moviendo archivo a subcarpeta estado:", e.message); }

      try {
        await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
          tipoParaSheet,
          resultado.fileName, resultado.file.webViewLink || "", origenParaSheet, resultado.estadoDocumento, resultado.motivo);
      } catch (err) { console.error("ERROR guardarDoc flujo:", err.message); }
      // Notificar al equipo si el documento necesita revision manual
      if (resultado.estadoDocumento === "REVISAR" && resultado.motivo) {
        notificarEquipo("revisar_documento", {
          nombre: datosVecino.nombre, comunidad: datosVecino.comunidad,
          vivienda: datosVecino.vivienda, telefono,
          documento: labelDocumento(tipoParaSheet),
          motivo: resultado.motivo.replace(/^\[\w+\]\s*/, "")
        }).catch(() => {});
      }

      // Archivos adicionales (numMedia > 1): procesar y guardar con su estado real
      for (let i = 1; i < numMedia; i++) {
        const mediaUrlN = req.body["MediaUrl" + i];
        const mimeTypeN = req.body["MediaContentType" + i] || "application/octet-stream";
        try {
          const resultadoN = await procesarYValidarArchivo(mediaUrlN, mimeTypeN, telefono, carpetaId, expediente.documento_actual, expediente.tipo_expediente);
          try {
            const tipoExtraSheet = resultadoN.tipoDetectado || expediente.documento_actual || "pendiente_clasificar";
            await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
              tipoExtraSheet,
              resultadoN.fileName, resultadoN.file.webViewLink || "", "flujo_extra", resultadoN.estadoDocumento, resultadoN.motivo);
          } catch (err) { console.error("ERROR guardarDoc flujo_extra:", err.message); }
        } catch (err) { console.error("ERROR archivo extra:", err.message); }
      }

      expediente.fecha_ultimo_contacto = ahoraISO();

      const esPDF = mimeType0.includes("pdf");
      const esDocumentoLargo = DOCS_LARGOS.includes(expediente.documento_actual);
      const docsRecibidosArr = splitList(expediente.documentos_recibidos);

      // DOCUMENTO LARGO EN PDF — marca recibido y sincroniza estado real
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && esPDF) {
        const docCoincidePDF = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
        if (!docCoincidePDF) {
          // PDF de documento equivocado — pedir el correcto
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const promptDocEsperadoPDF = getPromptPasoActual(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "\u274C La imagen enviada no corresponde al documento solicitado." +
            "\n\n\uD83D\uDC49 Para continuar necesito que envíes:\n\n" +
            (promptDocEsperadoPDF || bold(labelDocumento(expediente.documento_actual))) +
            "\n\nPuedes enviarlo ahora mismo por este WhatsApp.");
        }
        if (resultado.estadoDocumento === "REPETIR") {
          expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, documentoAValidar));
        }
        // Marcar como recibido y sincronizar desde Sheets — mismo motor que DOCUMENTO NORMAL
        if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
          docsRecibidosArr.push(expediente.documento_actual);
          expediente.documentos_recibidos = joinList(docsRecibidosArr);
        }
        expediente = limpiarReintento(expediente);
        expediente = await resolverEstadoConversacional(expediente, [expediente.documento_actual]);
        const promptSiguientePDF = expediente.documento_actual ? getPromptPasoActual(expediente) : null;
        const msgVecinoPDF = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, promptSiguientePDF, fallosDocActual || 0, documentoAValidar);
        if (expediente.documento_actual) {
          expediente.estado_expediente = "en_proceso";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecinoPDF);
        }
        expediente.paso_actual = "pregunta_financiacion";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, documentoAValidar) +
          "\n\n" + buildPreguntaFinanciacion());
      }

      // DOCUMENTO LARGO EN FOTOS — recibe foto, no avanza hasta LISTO
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && !esPDF) {
        // Solo aceptar como pagina valida si coincide con el doc esperado o no se pudo clasificar.
        // Bloquear tanto "ajeno" (doc completamente distinto) como "diferente_flujo"
        // (doc del flujo pero que no es el que toca ahora), porque ambos contaminarian
        // el documento largo con contenido incorrecto.
        const paginaValida = resultado.contextoDoc === "coincide"
          || resultado.contextoDoc === "sin_clasificar"
          || !resultado.contextoDoc;
        if (!paginaValida) {
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const docEsperadoLabel = labelDocumento(expediente.documento_actual);
          const docRecibidoLabel = resultado.tipoDetectado ? labelDocumento(resultado.tipoDetectado) : "un documento distinto";
          return responderYLog(res, telefono, "archivo", "archivo",
            "Hemos recibido " + docRecibidoLabel + ", pero estamos esperando paginas de:\n\n" +
            "• " + docEsperadoLabel + "\n\n" +
            "Envia las paginas correctas y cuando termines escribe LISTO.");
        }
        expediente.fecha_ultimo_contacto = ahoraISO();
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, "archivo", "archivo",
          "Pagina recibida\n\nPuedes seguir enviando mas paginas de este documento.\n\nCuando termines, escribe LISTO.");
      }

      // DOCUMENTO NORMAL
      // Politica de aceptacion:
      // - coincide con el esperado → OK/REVISAR avanzan, REPETIR no
      // - diferente_flujo (obligatorio del flujo, distinto al esperado) → se acepta si es valido
      // - ajeno (no pertenece al flujo) → se rechaza
      // - solicitud_firmada en REVISAR → nunca avanza (doc critico)
      const docCoincideConEsperado = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
      const docEsObligatorioDelFlujo = resultado.contextoDoc === "diferente_flujo" &&
        resultado.tipoDetectado &&
        (REQUIRED_DOCS[expediente.tipo_expediente]?.obligatorios || []).includes(resultado.tipoDetectado);
      const docAceptable = docCoincideConEsperado || docEsObligatorioDelFlujo;
      const tipoDocAceptado = docEsObligatorioDelFlujo ? resultado.tipoDetectado : expediente.documento_actual;
      const puedeAvanzar = docAceptable && puedeAvanzarFlujo(tipoDocAceptado, resultado.estadoDocumento);

      if (resultado.estadoDocumento === "REPETIR" && docAceptable) {
        expediente = marcarDocumentoFallido(expediente, tipoDocAceptado);
        try {
          fallosDocActual = await contarFallosDocumento(telefono, tipoDocAceptado);
          if (fallosDocActual >= 3) {
            expediente.requiere_intervencion_humana = "si";
            console.log("NOTIF EQUIPO: activando intervencion_humana, fallos:", fallosDocActual, "tel_equipo:", process.env.WHATSAPP_EQUIPO ? "configurado" : "NO CONFIGURADO");
            notificarEquipo("intervencion_humana", {
              nombre: datosVecino.nombre, comunidad: datosVecino.comunidad,
              vivienda: datosVecino.vivienda, telefono,
              documento: labelDocumento(tipoDocAceptado || expediente.documento_actual),
              intentos: fallosDocActual
            }).catch((e) => { console.error("Error notif equipo:", e.message); });
          }
        } catch (e) { console.error("Error contando fallos:", e.message); }
      } else if (puedeAvanzar) {
        expediente = limpiarReintento(expediente);
      }

      if (expediente.paso_actual === "recogida_documentacion") {
        // Doc ajeno o formato incorrecto: si hay motivo explicativo usarlo, si no mensaje generico
        if (!docAceptable) {
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const promptDocEsperado = getPromptPasoActual(expediente);
          const motivoAjeno = resultado.motivo ? resultado.motivo.replace(/^\[\w+\]\s*/, "") : "";
          const msgAjeno = motivoAjeno
            ? "\u274C " + motivoAjeno + ".\n\n" + (promptDocEsperado || bold(labelDocumento(expediente.documento_actual)))
            : "\u274C La imagen enviada no corresponde al documento solicitado.\n\n" +
              (promptDocEsperado || bold(labelDocumento(expediente.documento_actual))) +
              "\n\nPuedes enviarlo por aqu\u00ed.";
          return responderYLog(res, telefono, "archivo", "archivo", msgAjeno);
        }
        // REPETIR: no llamar al motor — responder directamente sin recalcular estado
        // (el motor podria ver un REVISAR antiguo en Sheets y avanzar aunque el ultimo intento sea REPETIR)
        if (resultado.estadoDocumento === "REPETIR") {
          // Si el documento es OPCIONAL (ej: empadronamiento) — no bloquear expediente
          // Ofrecer reenviar o escribir NO para saltar
          if (esDocumentoOpcional(expediente.tipo_expediente, tipoDocAceptado)) {
            expediente.fecha_ultimo_contacto = ahoraISO();
            await recalcularYActualizarTodo(expediente);
            const labelOpc = labelDocumento(tipoDocAceptado);
            return responderYLog(res, telefono, "archivo", "archivo",
              "\u274C " + labelOpc + " no se ha podido validar.\n\n"
              + (resultado.motivo ? resultado.motivo + "\n\n" : "")
              + "\uD83D\uDC49 Puedes enviarlo de nuevo cuando lo tengas correcto.\n\n"
              + "O si prefieres continuar sin \u00e9l, escribe *NO* y seguimos con el resto.");
          }
          // Documento OBLIGATORIO: bloquear normalmente
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, tipoDocAceptado));
        }
        // OK o REVISAR: motor central decide siguiente paso
        expediente = await resolverEstadoConversacional(expediente, [tipoDocAceptado]);
        const promptSiguiente = expediente.documento_actual ? getPromptPasoActual(expediente) : null;
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, promptSiguiente, fallosDocActual || 0, tipoDocAceptado);
        await recalcularYActualizarTodo(expediente);
        if (expediente.paso_actual === "recogida_documentacion") {
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        }
        if (expediente.paso_actual === "pregunta_financiacion") {
          notificarEquipo("expediente_completo", {
            nombre: datosVecino.nombre, comunidad: datosVecino.comunidad,
            vivienda: datosVecino.vivienda, telefono, tipo: expediente.tipo_expediente
          }).catch(() => {});
          return responderYLog(res, telefono, "archivo", "archivo",
            mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, tipoDocAceptado) +
            "\n\n" + buildPreguntaFinanciacion());
        }
        return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
      }

      if (expediente.paso_actual === "recogida_financiacion") {
        const docCoincideFinanciacion = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
        if (!docCoincideFinanciacion) {
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const promptDocEsperadoFin = getPromptPasoActual(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "\u274C La imagen enviada no corresponde al documento solicitado." +
            "\n\n\uD83D\uDC49 Para continuar necesito que envíes:\n\n" +
            (promptDocEsperadoFin || bold(labelDocumento(expediente.documento_actual))) +
            "\n\nPuedes enviarlo ahora mismo por este WhatsApp.");
        }
        if (resultado.estadoDocumento === "REPETIR") {
          expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, documentoAValidar));
        }
        expediente = limpiarReintento(expediente);
        // Motor central: pasar doc recien aceptado para evitar lag de Sheets
        expediente = await resolverEstadoConversacional(expediente, [expediente.documento_actual]);
        const promptSiguienteFin = expediente.documento_actual ? getPromptPasoActual(expediente) : null;
        const msgVecinoFin = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, promptSiguienteFin, fallosDocActual || 0, documentoAValidar);
        await recalcularYActualizarTodo(expediente);
        if (expediente.paso_actual === "recogida_financiacion") {
          return responderYLog(res, telefono, "archivo", "archivo", msgVecinoFin);
        }
        notificarEquipo("expediente_completo", {
          nombre: datosVecino.nombre, comunidad: datosVecino.comunidad,
          vivienda: datosVecino.vivienda, telefono, tipo: expediente.tipo_expediente + " + financiacion"
        }).catch(() => {});
        return responderYLog(res, telefono, "archivo", "archivo",
          "Perfecto\n\nHemos recibido toda la documentacion base y la de financiacion. Nuestro equipo la revisara y te avisara si necesita algo mas.");
      }
      // Fallback de seguridad: paso_actual no era recogida_documentacion ni financiacion
      return responderYLog(res, telefono, "archivo", "archivo",
        "Hemos recibido tu documento y lo estamos revisando.");
    }
  // handleArchivos solo aplica cuando numMedia > 0; si no, devolver undefined
  // para que el dispatcher pase al siguiente handler
}

// Procesa archivos que llegan fuera del paso de recogida (fuera_flujo)
async function handleArchivoFueraDeFlujo({ req, res, telefono, numMedia, datosVecino, expediente }) {
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = req.body["MediaUrl" + i];
    const mimeType = req.body["MediaContentType" + i] || "application/octet-stream";
    try {
      const carpetaAdicionalId = await getOrCreateCarpetaVivienda(datosVecino, "03_adicional");
      const resultado = await procesarYValidarArchivo(mediaUrl, mimeType, telefono, carpetaAdicionalId, "adicional", expediente.tipo_expediente);
      try {
        await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
          "adicional", resultado.fileName, resultado.file.webViewLink || "", "fuera_flujo", resultado.estadoDocumento, resultado.motivo);
      } catch (err) { console.error("ERROR guardarDoc fuera_flujo:", err.message); }
    } catch (err) { console.error("ERROR archivo fuera flujo:", err.message); }
  }
  expediente.fecha_ultimo_contacto = ahoraISO();
  await recalcularYActualizarTodo(expediente);
  return responderYLog(res, telefono, "archivo", "archivo",
    "Documentacion adicional recibida\n\nLa incorporamos a tu expediente para revision.");
}


// ================= DETECCION ATENCION HUMANA CON IA =================
async function detectarNecesidadHumano(mensaje, expediente) {
  if (!mensaje || mensaje.trim().length < 5) return { escalar: false, motivo: "" };
  try {
    const prompt = "Eres un asistente que analiza mensajes de vecinos en un proceso documental (Plan 5 EMASESA).\n\nMensaje del vecino: \"" + mensaje + "\"\nPaso actual: " + (expediente.paso_actual || "desconocido") + "\n\nDetermina si requiere atenci\u00f3n humana. Escalar si:\n1. Frustraci\u00f3n o enfado\n2. Pregunta sobre plazos, costes, instalaci\u00f3n o problemas t\u00e9cnicos\n3. Situaci\u00f3n especial (propietario fallecido, disputa, hipoteca)\n4. Confusi\u00f3n grave que el bot no puede resolver\n\nResponde SOLO en JSON: {\"escalar\": true/false, \"motivo\": \"raz\u00f3n breve\"}";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch(e) {
    console.error("Error detectando necesidad humana:", e.message);
    return { escalar: false, motivo: "" };
  }
}

async function handleRespuestaGenerica({ res, telefono, msgOriginal, numMedia, expediente }) {
    // ================= RESPUESTA GENERICA =================
    if (numMedia === 0) {
      if (expediente.paso_actual === "recogida_documentacion" || expediente.paso_actual === "recogida_financiacion") {
        const docActualLabel = expediente.documento_actual
          ? labelDocumento(expediente.documento_actual)
          : "el documento pendiente";
        return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
          "Seguimos con tu expediente.\n\nAhora mismo falta por enviar:\n- " + docActualLabel + "\n\nPuedes enviarlo directamente por aqui.");
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
          // Rehidratar desde Sheets para evitar responder con cache desincronizada
          expediente = await hidratarResumenDocumentalDesdeSheets(expediente);
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
}

// ================= HANDLER BACKGROUND (archivos) =================
// Igual que manejarMensajeWhatsApp pero sin res — devuelve el texto de respuesta.
// Se llama después de que Twilio ya recibió respuesta inmediata.
async function manejarMensajeWhatsAppBackground(req) {
  const msgOriginal = (req.body.Body || "").trim();
  const msg = msgOriginal.toLowerCase();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);
  const telefono = (req.body.From || "").replace("whatsapp:", "");
  const datosVecino = await buscarVecinoPorTelefono(telefono);
  if (!datosVecino) {
    return responderYLog(null, telefono, msgOriginal || "sin_texto", "archivo",
      "Tu numero no esta en el listado inicial de la comunidad. Contacta con Instalaciones Araujo para validarlo.");
  }
  let expediente = await buscarExpedientePorTelefono(telefono);
  if (!expediente) { await crearExpedienteInicial(telefono, datosVecino); expediente = await buscarExpedientePorTelefono(telefono); }
  // ctx sin res — los handlers usan responderYLog(null,...) en modo background
  const ctx = { req, res: null, telefono, msgOriginal, msg, numMedia, datosVecino, expediente };
  const respuesta = await handleArchivos(ctx);
  return respuesta || "Hemos recibido tu documento y lo estamos revisando.";
}


// ================= PROXY DE MEDIA DESDE DRIVE =================
// Sirve archivos de Drive a través del bot para que Twilio pueda acceder
// Twilio necesita URLs públicas sin redirecciones para los mediaUrl
const MEDIA_DRIVE = {
  video:    "https://drive.google.com/uc?export=download&id=1E_kdVkbnqJEo-5VanIfWNXMIJ6Dn6KJM",
  solicitud:"https://drive.google.com/uc?export=download&id=1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB",
  autorizacion: "https://drive.google.com/uc?export=download&id=12y2WBseQkjl-JbBqXgx-wm2EjzzRYtMH",
};

app.get("/media/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const url = MEDIA_DRIVE[tipo];
  if (!url) return res.status(404).send("No encontrado");
  try {
    const response = await axios.get(url, { responseType: "stream", maxRedirects: 5 });
    const ct = response.headers["content-type"] || (tipo === "video" ? "video/mp4" : "application/pdf");
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    response.data.pipe(res);
  } catch(e) {
    console.error("Error proxy media:", e.message);
    res.status(500).send("Error");
  }
});

// Envia un mensaje WhatsApp con archivo multimedia adjunto
async function enviarWhatsAppConMedia(to, body, mediaUrl) {
  if (!process.env.TWILIO_WHATSAPP_NUMBER) throw new Error("Falta TWILIO_WHATSAPP_NUMBER");
  const fromNum = "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER;
  const toNum = "whatsapp:" + normalizarTelefono(to);
  console.log("Enviando WhatsApp con media:", { to: toNum, mediaUrl });
  await twilioClient.messages.create({ from: fromNum, to: toNum, body: body || "", mediaUrl: [mediaUrl] });
}


// ================= REVISION NOTA SIMPLE =================
// El equipo sube el PDF de la nota simple a Drive en la carpeta 04_nota_simple
// y llama a este endpoint para que la IA haga el cruce con los documentos del vecino
app.get("/revisar-nota-simple", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const telefono = normalizarTelefono(req.query.telefono || "");
  if (!telefono) return res.status(400).json({ error: "Falta telefono" });

  try {
    const datosVecino = await buscarVecinoPorTelefono(telefono);
    if (!datosVecino) return res.status(404).json({ error: "Vecino no encontrado" });

    const expediente = await buscarExpedientePorTelefono(telefono);
    if (!expediente) return res.status(404).json({ error: "Expediente no encontrado" });

    // Buscar la carpeta nota_simple en Drive
    const drive = getDriveClient();
    const carpetaViviendaId = await getOrCreateCarpetaVivienda(datosVecino, null);
    const busqNota = await drive.files.list({
      q: `name='04_nota_simple' and '${carpetaViviendaId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)", pageSize: 1
    });

    if (!busqNota.data.files || busqNota.data.files.length === 0) {
      return res.json({ ok: false, mensaje: "No se encontr\u00f3 la carpeta 04_nota_simple para este vecino." });
    }

    const carpetaNotaId = busqNota.data.files[0].id;

    // Buscar el PDF de la nota simple en esa carpeta
    const busqPDF = await drive.files.list({
      q: `'${carpetaNotaId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id,name,webViewLink)", pageSize: 1,
      orderBy: "createdTime desc"
    });

    if (!busqPDF.data.files || busqPDF.data.files.length === 0) {
      return res.json({ ok: false, mensaje: "No hay ning\u00fan PDF en la carpeta 04_nota_simple. S\u00fabelo y vuelve a intentarlo." });
    }

    const notaPDF = busqPDF.data.files[0];

    // Descargar el PDF de la nota simple
    const pdfResponse = await drive.files.get({ fileId: notaPDF.id, alt: "media" }, { responseType: "arraybuffer" });
    const pdfBuffer = Buffer.from(pdfResponse.data);

    // Buscar la solicitud validada del vecino
    const carpetaDocBase = await getOrCreateCarpetaVivienda(datosVecino, "01_documentacion_base");
    const busqValidados = await drive.files.list({
      q: `name='validados' and '${carpetaDocBase}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)", pageSize: 1
    });

    let solicitudBuffer = null;
    let dniBuffer = null;

    if (busqValidados.data.files && busqValidados.data.files.length > 0) {
      const validadosId = busqValidados.data.files[0].id;
      // Buscar solicitud
      const busqSol = await drive.files.list({
        q: `'${validadosId}' in parents and name contains 'solicitud' and trashed=false`,
        fields: "files(id,name)", pageSize: 1, orderBy: "createdTime desc"
      });
      if (busqSol.data.files && busqSol.data.files.length > 0) {
        const solResp = await drive.files.get({ fileId: busqSol.data.files[0].id, alt: "media" }, { responseType: "arraybuffer" });
        solicitudBuffer = Buffer.from(solResp.data);
      }
      // Buscar DNI delante
      const busqDNI = await drive.files.list({
        q: `'${validadosId}' in parents and name contains 'dni_delante' and trashed=false`,
        fields: "files(id,name)", pageSize: 1, orderBy: "createdTime desc"
      });
      if (busqDNI.data.files && busqDNI.data.files.length > 0) {
        const dniResp = await drive.files.get({ fileId: busqDNI.data.files[0].id, alt: "media" }, { responseType: "arraybuffer" });
        dniBuffer = Buffer.from(dniResp.data);
      }
    }

    // Llamar a la IA para cruzar los documentos
    const notaBase64 = pdfBuffer.toString("base64");
    const prompt = "Eres un experto en verificar expedientes de EMASESA Plan 5 (individualizaci\u00f3n de contadores de agua en Sevilla).\n\n" +
      "Tienes la nota simple del Registro de la Propiedad de la vivienda.\n" +
      "Extrae y devuelve en JSON:\n" +
      "{\n" +
      '  "titular": "nombre completo del titular registral",\n' +
      '  "nif": "NIF o DNI del titular si aparece",\n' +
      '  "direccion": "direcci\u00f3n completa del inmueble",\n' +
      '  "finca": "n\u00famero de finca registral si aparece"\n' +
      "}\n\n" +
      "Si un campo no aparece claramente, pon null.";

    const resultadoNota = await llamarIAconImagen(prompt, notaBase64, 15000);

    // Cruzar con datos del expediente
    const nombreExpediente = datosVecino.nombre || "";
    const informe = {
      vecino: datosVecino.nombre,
      comunidad: datosVecino.comunidad,
      vivienda: datosVecino.vivienda,
      nota_simple: notaPDF.name,
      datos_nota: resultadoNota,
      concordancias: [],
      discordancias: [],
      ok: true
    };

    if (resultadoNota) {
      // Verificar nombre
      const titularNota = (resultadoNota.titular || "").toLowerCase().trim();
      const nombreVec = nombreExpediente.toLowerCase().trim();
      if (titularNota && nombreVec) {
        const coincideNombre = titularNota.includes(nombreVec.split(" ")[0]) || nombreVec.includes(titularNota.split(" ")[0]);
        if (coincideNombre) informe.concordancias.push("Nombre del titular coincide: " + resultadoNota.titular);
        else { informe.discordancias.push("Nombre NO coincide: nota simple dice '" + resultadoNota.titular + "', expediente dice '" + nombreExpediente + "'"); informe.ok = false; }
      }
      if (resultadoNota.direccion) {
        informe.concordancias.push("Direcci\u00f3n en nota simple: " + resultadoNota.direccion);
      }
    }

    informe.resumen = informe.ok && informe.discordancias.length === 0
      ? "\u2705 Todo coincide. Expediente listo para tramitar."
      : "\u26A0\uFE0F Se encontraron discordancias. Revisar antes de tramitar.";

    return res.json(informe);

  } catch(e) {
    console.error("Error revisando nota simple:", e.message);
    return res.status(500).json({ error: e.message });
  }
});


// ================= REVISION COMUNIDAD COMPLETA =================
// Revisa todas las viviendas de una comunidad cruzando nota simple con documentos del vecino
// URL: GET /revisar-comunidad?token=SECRETO&comunidad=NOMBRE
app.get("/revisar-comunidad", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "No autorizado" });
  }
  const comunidadBuscada = (req.query.comunidad || "").trim().toUpperCase();
  if (!comunidadBuscada) return res.status(400).json({ error: "Falta comunidad" });

  try {
    const expedientes = await leerTodosExpedientes();
    const expComunidad = expedientes.filter(e =>
      (e.comunidad || "").toUpperCase().includes(comunidadBuscada)
    );

    if (expComunidad.length === 0) {
      return res.json({ ok: false, mensaje: "No se encontraron expedientes para: " + comunidadBuscada });
    }

    const drive = getDriveClient();
    const resultados = [];
    let okCount = 0, discordanciaCount = 0, sinNotaCount = 0, incompletoCount = 0;

    for (const expediente of expComunidad) {
      const datosVecino = {
        nombre: expediente.nombre,
        comunidad: expediente.comunidad,
        vivienda: expediente.vivienda,
        bloque: expediente.bloque,
        telefono: expediente.telefono
      };

      const resultado = {
        vivienda: expediente.vivienda,
        nombre: expediente.nombre,
        telefono: expediente.telefono,
        estado_expediente: expediente.estado_expediente,
        documentos_completos: expediente.documentos_completos,
        estado: null,
        titular_nota: null,
        concordancias: [],
        discordancias: [],
        resumen: ""
      };

      // Verificar si el expediente tiene documentos completos
      if (expediente.documentos_completos !== "SI" && expediente.documentos_completos !== "si") {
        resultado.estado = "incompleto";
        resultado.resumen = "\u274C Expediente incompleto — faltan documentos";
        incompletoCount++;
        resultados.push(resultado);
        continue;
      }

      // Buscar carpeta nota_simple
      try {
        const carpetaViviendaId = await getOrCreateCarpetaVivienda(datosVecino, null);
        const busqNota = await drive.files.list({
          q: `name='04_nota_simple' and '${carpetaViviendaId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)", pageSize: 1
        });

        if (!busqNota.data.files || busqNota.data.files.length === 0) {
          resultado.estado = "sin_nota";
          resultado.resumen = "\u23F3 Sin nota simple todav\u00eda";
          sinNotaCount++;
          resultados.push(resultado);
          continue;
        }

        const carpetaNotaId = busqNota.data.files[0].id;
        const busqPDF = await drive.files.list({
          q: `'${carpetaNotaId}' in parents and mimeType='application/pdf' and trashed=false`,
          fields: "files(id,name)", pageSize: 1, orderBy: "createdTime desc"
        });

        if (!busqPDF.data.files || busqPDF.data.files.length === 0) {
          resultado.estado = "sin_nota";
          resultado.resumen = "\u23F3 Carpeta nota_simple vac\u00eda — sube el PDF";
          sinNotaCount++;
          resultados.push(resultado);
          continue;
        }

        // Descargar y analizar nota simple con IA
        const pdfResp = await drive.files.get({ fileId: busqPDF.data.files[0].id, alt: "media" }, { responseType: "arraybuffer" });
        const pdfBuffer = Buffer.from(pdfResp.data);
        const notaBase64 = pdfBuffer.toString("base64");

        const promptNota = "Eres un experto en notas simples del Registro de la Propiedad espa\u00f1ol.\n" +
          "Extrae los datos del titular del inmueble. Responde SOLO en JSON:\n" +
          '{"titular": "nombre completo", "nif": "NIF si aparece o null", "direccion": "direcci\u00f3n completa o null"}';

        const datosNota = await llamarIAconImagen(promptNota, notaBase64, 15000);

        if (!datosNota || !datosNota.titular) {
          resultado.estado = "error_lectura";
          resultado.resumen = "\u26A0\uFE0F No se pudo leer la nota simple — revisa el PDF";
          discordanciaCount++;
          resultados.push(resultado);
          continue;
        }

        resultado.titular_nota = datosNota.titular;

        // Cruzar nombre
        const titularNota = (datosNota.titular || "").toLowerCase();
        const nombreVec = (expediente.nombre || "").toLowerCase();
        const primerApellidoNota = titularNota.split(" ").slice(-2).join(" ");
        const primerNombreVec = nombreVec.split(" ")[0];

        const coincide = titularNota.includes(primerNombreVec) || nombreVec.includes(primerApellidoNota) ||
          titularNota.split(" ").some(p => nombreVec.includes(p) && p.length > 3);

        if (coincide) {
          resultado.concordancias.push("Titular: " + datosNota.titular);
          resultado.estado = "ok";
          resultado.resumen = "\u2705 Todo coincide — listo para tramitar";
          okCount++;
        } else {
          resultado.discordancias.push("Nombre no coincide: nota='"+datosNota.titular+"' expediente='"+expediente.nombre+"'");
          resultado.estado = "discordancia";
          resultado.resumen = "\u26A0\uFE0F Nombre no coincide — revisar antes de tramitar";
          discordanciaCount++;
        }

        if (datosNota.direccion) resultado.concordancias.push("Direcci\u00f3n: " + datosNota.direccion);

      } catch(e) {
        resultado.estado = "error";
        resultado.resumen = "\u274C Error: " + e.message;
      }

      resultados.push(resultado);
      // Pausa entre viviendas para no saturar la API
      await new Promise(r => setTimeout(r, 500));
    }

    // Ordenar: discordancias primero, luego sin nota, luego ok, luego incompletos
    const orden = { discordancia: 0, error_lectura: 1, sin_nota: 2, ok: 3, incompleto: 4, error: 5 };
    resultados.sort((a, b) => (orden[a.estado] || 9) - (orden[b.estado] || 9));

    const informe = {
      comunidad: comunidadBuscada,
      total: resultados.length,
      resumen: {
        listos: okCount,
        discordancias: discordanciaCount,
        sin_nota: sinNotaCount,
        incompletos: incompletoCount
      },
      viviendas: resultados
    };

    return res.json(informe);

  } catch(e) {
    console.error("Error revisando comunidad:", e.message);
    return res.status(500).json({ error: e.message });
  }
});



// ================= PANEL DIOS - MANDO REAL =================
async function obtenerResumenComunidades() {
  const sheets = getSheetsClient();
  // Leer vecinos_base para comunidades
  const resVec = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "vecinos_base!A:E",
  });
  const rowsVec = resVec.data.values || [];
  const comunidadMap = {};
  for (let i = 1; i < rowsVec.length; i++) {
    const com = (rowsVec[i][0] || "").trim();
    if (!com) continue;
    if (!comunidadMap[com]) comunidadMap[com] = { nombre: com, total: 0, listos: 0, discordancias: 0, sin_nota: 0, incompletos: 0, vecinos: [] };
    comunidadMap[com].total++;
    comunidadMap[com].vecinos.push({
      vivienda: rowsVec[i][2] || "",
      nombre: rowsVec[i][3] || "",
      telefono: rowsVec[i][4] || ""
    });
  }
  // Leer expedientes para estado
  const expedientes = await leerTodosExpedientes();
  for (const exp of expedientes) {
    const com = (exp.comunidad || "").trim();
    if (!comunidadMap[com]) continue;
    const completo = (exp.documentos_completos || "").toUpperCase() === "SI";
    if (!completo) comunidadMap[com].incompletos++;
    else comunidadMap[com].listos++;
  }
  // Ordenar por prioridad: discordancias > sin_nota > incompletos > listos
  const lista = Object.values(comunidadMap);
  lista.sort((a, b) => {
    const prioA = a.discordancias * 100 + a.sin_nota * 10 + a.incompletos;
    const prioB = b.discordancias * 100 + b.sin_nota * 10 + b.incompletos;
    return prioB - prioA;
  });
  return lista;
}


// ================= FUNCIÓN UTILIDAD CRM =================
async function actualizarCampoExpediente(telefono, campoIndex, nuevoValor) {
  const sheets = getSheetsClient();
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "expedientes!A:Y",
  });
  const rows = data.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (normalizarTelefono(rows[i][0] || "") === normalizarTelefono(telefono)) {
      const rowIndex = i + 1;
      const row = [...rows[i]];
      while (row.length <= campoIndex) row.push("");
      row[campoIndex] = nuevoValor;
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "expedientes!A" + rowIndex + ":Y" + rowIndex,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
      return true;
    }
  }
  return false;
}


// ================= CONSTANTES PANEL HOLDED =================

const H = {
  css: `
    /* === RESET === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F7F8FA; color: #1a1d23; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }

    /* === VARIABLES === */
    :root {
      --brand: #4F46E5;
      --brand-hover: #4338CA;
      --brand-light: #EEF2FF;
      --success: #10B981;
      --success-light: #ECFDF5;
      --warning: #F59E0B;
      --warning-light: #FFFBEB;
      --danger: #EF4444;
      --danger-light: #FEF2F2;
      --gray-50: #F7F8FA;
      --gray-100: #F3F4F6;
      --gray-200: #E5E7EB;
      --gray-500: #6B7280;
      --gray-700: #374151;
      --gray-900: #1a1d23;
    }

    /* === NAV === */
    .nav { background: white; height: 54px; display: flex; align-items: center; padding: 0 24px; gap: 4px; position: sticky; top: 0; z-index: 200; border-bottom: 1px solid var(--gray-200); box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .nav-brand { display: flex; align-items: center; gap: 10px; margin-right: 20px; text-decoration: none; }
    .nav-brand img { height: 28px; width: 28px; object-fit: contain; mix-blend-mode: multiply; }
    .nav-brand span { font-weight: 700; font-size: 16px; color: var(--gray-900); letter-spacing: -0.3px; }
    .nav-link { color: var(--gray-500); padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.15s; }
    .nav-link:hover { color: var(--gray-900); background: var(--gray-100); }
    .nav-link.active { color: var(--brand); background: var(--brand-light); font-weight: 600; }

    /* === BREADCRUMB === */
    .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray-500); margin-bottom: 20px; }
    .breadcrumb a { color: var(--brand); }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb span { color: var(--gray-200); }

    /* === PAGE === */
    .page { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }

    /* === CARDS === */
    .card { background: #FFFFFF; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--gray-200); margin-bottom: 14px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-title { font-size: 11px; font-weight: 700; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 14px; }

    /* === KPIs === */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi { background: white; border-radius: 12px; padding: 18px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--gray-200); border-top: 3px solid var(--gray-200); }
    .kpi-num { font-size: 30px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
    .kpi-label { font-size: 12px; color: var(--gray-500); font-weight: 500; }
    .kpi.kpi-azul { border-top-color: var(--brand); } .kpi.kpi-azul .kpi-num { color: var(--brand); }
    .kpi.kpi-rojo { border-top-color: var(--danger); } .kpi.kpi-rojo .kpi-num { color: var(--danger); }
    .kpi.kpi-naranja { border-top-color: #EA580C; } .kpi.kpi-naranja .kpi-num { color: #EA580C; }
    .kpi.kpi-amarillo { border-top-color: var(--warning); } .kpi.kpi-amarillo .kpi-num { color: var(--warning); }
    .kpi.kpi-gris { border-top-color: #9CA3AF; } .kpi.kpi-gris .kpi-num { color: #9CA3AF; }
    .kpi.kpi-verde { border-top-color: var(--success); } .kpi.kpi-verde .kpi-num { color: var(--success); }

    /* === BADGES === */
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .badge-rojo { background: var(--danger-light); color: var(--danger); }
    .badge-verde { background: var(--success-light); color: var(--success); }
    .badge-azul { background: var(--brand-light); color: var(--brand); }
    .badge-gris { background: var(--gray-100); color: var(--gray-500); }
    .badge-amarillo { background: var(--warning-light); color: var(--warning); }
    .badge-naranja { background: #FFF7ED; color: #EA580C; }

    /* === BOTONES === */
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.15s; border: none; }
    .btn-primary { background: var(--brand); color: white; }
    .btn-primary:hover { background: var(--brand-hover); }
    .btn-secondary { background: var(--gray-100); color: var(--gray-700); border: 1px solid var(--gray-200); }
    .btn-secondary:hover { background: var(--gray-200); }
    .btn-danger { background: var(--danger-light); color: var(--danger); border: 1px solid #FECACA; }
    .btn-danger:hover { background: #FEE2E2; }
    .btn-success { background: var(--success-light); color: var(--success); border: 1px solid #A7F3D0; }
    .btn-success:hover { background: #D1FAE5; }
    .btn-warning { background: var(--warning-light); color: var(--warning); border: 1px solid #FDE68A; }
    .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
    .btn-block { display: flex; width: 100%; justify-content: center; }

    /* === TABLA === */
    .tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tabla th { background: var(--gray-50); padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--gray-200); }
    .tabla td { padding: 11px 12px; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
    .tabla tr:last-child td { border-bottom: none; }
    .tabla tr:hover td { background: var(--gray-50); }

    /* === BUSCADOR === */
    .search-wrap { position: relative; margin-bottom: 14px; }
    .search-input { width: 100%; padding: 10px 14px 10px 36px; border: 1.5px solid var(--gray-200); border-radius: 8px; font-size: 14px; outline: none; background: white; }
    .search-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
    .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gray-500); font-size: 15px; }

    /* === FILTROS === */
    .filtros { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .filtro { padding: 5px 12px; border-radius: 20px; border: 1.5px solid var(--gray-200); background: white; font-size: 12px; font-weight: 500; cursor: pointer; color: var(--gray-700); transition: all 0.15s; }
    .filtro:hover, .filtro.on { background: var(--brand); border-color: var(--brand); color: white; }

    /* === FILA INFO === */
    .info-fila { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px; }
    .info-fila:last-child { border-bottom: none; }
    .info-label { color: var(--gray-500); }
    .info-valor { font-weight: 500; max-width: 60%; text-align: right; }

    /* === ACCIONES === */
    .accion-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .accion-item { padding: 12px; border-radius: 10px; border: 1.5px solid var(--gray-200); display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; transition: all 0.15s; background: white; }
    .accion-item:hover { border-color: var(--brand); background: var(--brand-light); color: var(--brand); }

    /* === DOCUMENTOS === */
    .doc-item { padding: 8px 11px; border-radius: 8px; font-size: 13px; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
    .doc-ok { background: var(--success-light); color: var(--success); }
    .doc-falta { background: var(--danger-light); color: var(--danger); }
    .doc-actual { background: var(--brand-light); color: var(--brand); border: 1.5px solid #C7D2FE; font-weight: 700; }
    .doc-opcional { background: #F5F3FF; color: #7C3AED; }
    .doc-revision { background: var(--warning-light); color: var(--warning); }

    /* === AVANZADO === */
    .avanzado { display: none; }
    .avanzado.abierto { display: block; }
    .btn-avanzado { background: none; border: 1.5px solid var(--gray-200); width: 100%; padding: 9px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--gray-500); font-weight: 500; }
    .btn-avanzado:hover { background: var(--gray-50); }
    .avanzado-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
    .avanzado-btn { padding: 7px 8px; border-radius: 7px; background: var(--gray-100); color: var(--gray-700); font-size: 12px; text-align: center; transition: all 0.15s; border: 1px solid var(--gray-200); }
    .avanzado-btn:hover { background: var(--gray-200); }
    .seccion { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0 6px; font-weight: 600; }

    /* === SIGUIENTE ACCIÓN === */
    .next-action { background: var(--brand-light); border: 1.5px solid #C7D2FE; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .next-action .icon { font-size: 20px; }
    .next-action .text { font-size: 14px; font-weight: 600; color: #3730A3; }
    .next-action .sub { font-size: 12px; color: var(--brand); margin-top: 2px; }

    /* === RECOMENDACIÓN === */
    .recomendacion { background: var(--gray-50); border-left: 3px solid var(--brand); border-radius: 0 8px 8px 0; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: var(--gray-700); }

    /* === COMUNIDAD CARD === */
    .com-card { background: white; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--gray-200); border-left: 4px solid var(--gray-200); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .com-card.critica { border-left-color: var(--danger); }
    .com-card.proceso { border-left-color: var(--warning); }
    .com-card.completa { border-left-color: var(--success); }
    .com-stats-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
    .com-stat { font-size: 12px; color: var(--gray-500); }

    /* === RESPONSIVE === */
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .accion-grid { grid-template-columns: 1fr; }
      .avanzado-grid { grid-template-columns: repeat(2, 1fr); }
      .com-card { flex-direction: column; align-items: flex-start; }
    }
  `,

  nav(token, activo) {
    const tk = encodeURIComponent(token);
    const navLink = (href, label, key) => {
      const cls = "nav-link" + (activo === key ? " active" : "");
      return '<a href="' + href + '?token=' + tk + '" class="' + cls + '">' + label + '</a>';
    };
    const logoSrc = "data:image/png;base64,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";
    return '<nav class="nav">'
      + '<a href="/trabajo?token=' + tk + '" class="nav-brand">'
      + '<img src="' + logoSrc + '" alt="Araujo"/>'
      + '<span>Araujo</span></a>'
      + navLink('/trabajo', '🏠 Trabajo', 'trabajo')
      + navLink('/panel', '🏢 Comunidades', 'comunidades')
      + navLink('/panel-ceo', '📊 CEO', 'ceo')
      + '</nav>';
  },

  page(token, activo, title, breadcrumbs, content) {
    const tk = encodeURIComponent(token);
    const bc = breadcrumbs.map((b, i) => {
      if (i < breadcrumbs.length - 1) {
        const sep = b.url.includes('?') ? '&' : '?';
        return '<a href="' + b.url + sep + 'token=' + tk + '">' + b.label + '</a><span>/</span>';
      }
      return '<span style="color:#1a1d23;font-weight:500">' + b.label + '</span>';
    }).join('');
    const bcHtml = breadcrumbs.length > 1 ? '<div class="breadcrumb">' + bc + '</div>' : '';
    return '<!DOCTYPE html><html lang="es"><head>'
      + '<meta charset="UTF-8"/>'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
      + '<title>' + title + ' — Araujo</title>'
      + '<style>' + H.css + '</style>'
      + '</head><body>'
      + H.nav(token, activo)
      + '<div class="page">'
      + bcHtml
      + content
      + '</div></body></html>';
  },

  badge(estado) {
    if (!estado) return '<span class="badge badge-gris">—</span>';
    if (estado.includes('completo') || estado.includes('revisado')) return `<span class="badge badge-verde">✅ ${estado}</span>`;
    if (estado.includes('repetir') || estado.includes('bloqueado') || estado.includes('fuera')) return `<span class="badge badge-rojo">❌ ${estado}</span>`;
    if (estado.includes('revision')) return `<span class="badge badge-amarillo">⚠️ ${estado}</span>`;
    if (estado.includes('proceso') || estado.includes('recogida') || estado.includes('pregunta')) return `<span class="badge badge-azul">🔵 ${estado}</span>`;
    return `<span class="badge badge-gris">${estado}</span>`;
  },

  nextAction(docActual, estado, horasUltimo, requiereInterv) {
    if (requiereInterv === 'si') return { icon: '🚨', text: 'Intervención urgente', sub: 'Este expediente requiere atención manual inmediata' };
    if (estado && estado.includes('repetir')) return { icon: '🔁', text: `Pedir que repita: ${docActual || 'documento'}`, sub: 'El documento enviado no es válido' };
    if (estado && estado.includes('revision')) return { icon: '⚠️', text: `Revisar documento: ${docActual || ''}`, sub: 'Pendiente de validación manual' };
    if (horasUltimo > 72) return { icon: '📲', text: `Enviar recordatorio`, sub: `Sin respuesta hace ${Math.floor(horasUltimo/24)} días` };
    if (docActual) return { icon: '📄', text: `Esperar: ${docActual}`, sub: 'El vecino tiene que enviar este documento' };
    return { icon: '✅', text: 'Sin acción necesaria', sub: 'Expediente al día' };
  }
};

// ================= HOME: PANEL DE TRABAJO =================
app.get("/trabajo", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const sheets = getSheetsClient();
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:Y",
    });
    const rows = data.data.values || [];
    const tk = encodeURIComponent(token);

    let urgentes = 0, repetir = 0, sinRespuesta = 0, incompletos = 0;
    const tareas = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const estado = r[7] || "";
      const completo = (r[13] || "").toUpperCase() === "SI";
      if (completo) continue;
      const docActual = r[6] || "";
      const horasUltimo = r[10] ? Math.floor((Date.now() - new Date(r[10])) / 3600000) : 999;
      const requiereInterv = r[23] === "si";
      const nombre = r[3] || "Sin nombre";
      const vivienda = r[2] || "";
      const comunidad = r[1] || "";
      const telefono = r[0] || "";

      let prioridad = 4;
      let badgeClass = "badge-gris";
      let accionTexto = "";

      if (requiereInterv || estado.includes("bloqueado") || estado.includes("fuera")) {
        prioridad = 0; urgentes++;
        badgeClass = "badge-rojo"; accionTexto = "🚨 Intervención urgente";
      } else if (estado.includes("repetir")) {
        prioridad = 1; repetir++;
        badgeClass = "badge-naranja"; accionTexto = "🔁 Repetir: " + docActual;
      } else if (estado.includes("revision")) {
        prioridad = 2;
        badgeClass = "badge-amarillo"; accionTexto = "⚠️ Revisar documento";
      } else if (horasUltimo > 72) {
        prioridad = 3; sinRespuesta++;
        badgeClass = "badge-amarillo"; accionTexto = "📲 Sin respuesta " + Math.floor(horasUltimo/24) + "d";
      } else if (estado.includes("duda") || estado.includes("flujo_diferente") || estado === "recogida_documentacion" || estado === "pregunta_tipo" || estado === "pendiente_clasificacion") {
        prioridad = 2;
        badgeClass = "badge-amarillo"; accionTexto = "💬 Tiene dudas o no avanza";
      } else if (r[5] === "recogida_financiacion" || r[5] === "pregunta_financiacion") {
        prioridad = 4; incompletos++;
        badgeClass = "badge-azul"; accionTexto = "📋 Financiación" + (docActual ? ": " + docActual : "");
      } else if (docActual) {
        prioridad = 4; incompletos++;
        badgeClass = "badge-gris"; accionTexto = "📄 Falta: " + docActual;
      } else if (estado && !completo) {
        prioridad = 4; incompletos++;
        badgeClass = "badge-gris"; accionTexto = "⚪ En proceso: " + estado;
      } else continue;

      tareas.push({ nombre, vivienda, comunidad, telefono, accionTexto, badgeClass, prioridad });
    }

    tareas.sort((a, b) => a.prioridad - b.prioridad);

    const htmlTareas = tareas.slice(0, 40).map(t => `
      <tr>
        <td><strong>${t.nombre}</strong></td>
        <td style="color:#6b7280">${t.comunidad} ${t.vivienda}</td>
        <td><span class="badge ${t.badgeClass}">${t.accionTexto}</span></td>
        <td><a href="/vecino?token=${tk}&t=${encodeURIComponent(t.telefono)}" class="btn btn-sm btn-primary">Ver ficha →</a></td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="text-align:center;padding:30px;color:#16a34a">✅ No hay tareas pendientes</td></tr>`;

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h1 style="font-size:22px;font-weight:700">🏠 Trabajo hoy</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:2px">Esto es lo que necesita atención ahora mismo</p>
        </div>
        <a href="/ejecutar-job?token=${tk}" class="btn btn-secondary">📲 Recordar a vecinos</a>
      </div>

      <div class="kpi-grid">
        <div class="kpi kpi-rojo"><div class="kpi-num">${urgentes}</div><div class="kpi-label">🚨 Urgentes</div></div>
        <div class="kpi kpi-naranja"><div class="kpi-num">${repetir}</div><div class="kpi-label">🔁 Repetir doc</div></div>
        <div class="kpi kpi-amarillo"><div class="kpi-num">${sinRespuesta}</div><div class="kpi-label">📲 Sin respuesta</div></div>
        <div class="kpi kpi-gris"><div class="kpi-num">${incompletos}</div><div class="kpi-label">⚪ En proceso</div></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔥 Tareas pendientes — por prioridad</div>
        </div>
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="buscador" placeholder="Buscar por nombre, comunidad..." oninput="filtrar()"/>
        </div>
        <div style="overflow-x:auto">
          <table class="tabla" id="tabla">
            <thead><tr><th>Nombre</th><th>Comunidad</th><th>Acción</th><th></th></tr></thead>
            <tbody>${htmlTareas}</tbody>
          </table>
        </div>
      </div>

      <script>
        function filtrar() {
          const q = document.getElementById('buscador').value.toLowerCase();
          document.querySelectorAll('#tabla tbody tr').forEach(tr => {
            tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none';
          });
        }
      </script>
    `;

    res.send(H.page(token, 'trabajo', 'Trabajo hoy', [{ label: 'Trabajo', url: '/trabajo' }], content));
  } catch(e) {
    console.error("ERROR TRABAJO:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});

// ================= PANEL CEO =================
app.get("/panel-ceo", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const sheets = getSheetsClient();
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:Y",
    });
    const rows = data.data.values || [];
    const tk = encodeURIComponent(token);
    let stats = { total: 0, urgentes: 0, repetir: 0, revision: 0, incompletos: 0, completos: 0 };
    const comStats = {};

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      stats.total++;
      const estado = r[7] || "";
      const completo = (r[13] || "").toUpperCase() === "SI";
      const com = (r[1] || "Sin comunidad").trim();
      if (!comStats[com]) comStats[com] = { total: 0, urgentes: 0, repetir: 0, revision: 0, incompletos: 0, completos: 0 };
      comStats[com].total++;

      if (estado.includes("bloqueado") || estado.includes("fuera") || r[23] === "si") { stats.urgentes++; comStats[com].urgentes++; }
      else if (estado.includes("repetir")) { stats.repetir++; comStats[com].repetir++; }
      else if (estado.includes("revision")) { stats.revision++; comStats[com].revision++; }
      else if (completo) { stats.completos++; comStats[com].completos++; }
      else if (r[5] === "recogida_financiacion" || r[5] === "pregunta_financiacion") {
        // Financiación es opcional — tratarlo como "en proceso avanzado", no como incompleto urgente
        stats.incompletos++; comStats[com].incompletos++;
        if (!comStats[com].financiacion) comStats[com].financiacion = 0;
        comStats[com].financiacion++;
      }
      else { stats.incompletos++; comStats[com].incompletos++; }
    }

    const htmlComs = Object.entries(comStats)
      .sort((a,b) => (b[1].urgentes*100 + b[1].repetir*10 + b[1].incompletos) - (a[1].urgentes*100 + a[1].repetir*10 + a[1].incompletos))
      .map(([com, s]) => {
        const critica = s.urgentes > 0 || s.repetir > 0;
        const pct = s.total > 0 ? Math.round(s.completos / s.total * 100) : 0;
        const clase = critica ? 'critica' : s.completos === s.total ? 'completa' : 'proceso';
        const comUrl = `/panel-comunidad?token=${tk}&comunidad=${encodeURIComponent(com)}`;
        return `<div class="com-card ${clase}">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <strong style="font-size:15px">${com}</strong>
              ${critica ? '<span class="badge badge-rojo">🚨 Crítica</span>' : s.completos === s.total ? '<span class="badge badge-verde">✅ Completa</span>' : ''}
            </div>
            <div class="com-stats-row">
              <span class="com-stat">Total: <b>${s.total}</b></span>
              ${s.urgentes > 0 ? `<span class="com-stat" style="color:#dc2626">🚨 ${s.urgentes} urg.</span>` : ''}
              ${s.repetir > 0 ? `<span class="com-stat" style="color:#ea580c">🔁 ${s.repetir} repetir</span>` : ''}
              ${s.revision > 0 ? `<span class="com-stat" style="color:#d97706">⚠️ ${s.revision} revisión</span>` : ''}
              ${(s.incompletos - (s.financiacion||0)) > 0 ? `<span class="com-stat">⚪ ${s.incompletos - (s.financiacion||0)} proceso</span>` : ''}
              ${s.financiacion > 0 ? `<span class="com-stat" style="color:#7c3aed">📋 ${s.financiacion} financiación</span>` : ''}
              ${s.completos > 0 ? `<span class="com-stat" style="color:#16a34a">✅ ${s.completos} completos</span>` : ''}
            </div>
            <div style="margin-top:8px;height:4px;background:#f3f4f6;border-radius:2px">
              <div style="width:${pct}%;height:4px;background:#16a34a;border-radius:2px"></div>
            </div>
          </div>
          <a href="${comUrl}" class="btn btn-primary btn-sm" style="white-space:nowrap">Ver →</a>
        </div>`;
      }).join('');

    const content = `
      <div style="margin-bottom:20px">
        <h1 style="font-size:22px;font-weight:700">📊 Panel CEO</h1>
        <p style="color:#6b7280;font-size:14px;margin-top:2px">Resumen global del Plan 5 EMASESA</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi kpi-azul"><div class="kpi-num">${stats.total}</div><div class="kpi-label">Total</div></div>
        <div class="kpi kpi-rojo"><div class="kpi-num">${stats.urgentes}</div><div class="kpi-label">🚨 Urgentes</div></div>
        <div class="kpi kpi-naranja"><div class="kpi-num">${stats.repetir}</div><div class="kpi-label">🔁 Repetir</div></div>
        <div class="kpi kpi-amarillo"><div class="kpi-num">${stats.revision}</div><div class="kpi-label">⚠️ Revisión</div></div>
        <div class="kpi kpi-gris"><div class="kpi-num">${stats.incompletos}</div><div class="kpi-label">⚪ Proceso</div></div>
        <div class="kpi kpi-verde"><div class="kpi-num">${stats.completos}</div><div class="kpi-label">✅ Completos</div></div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:14px">🏢 Estado por comunidad</div>
        ${htmlComs || '<p style="color:#9ca3af">Sin datos</p>'}
      </div>
    `;

    res.send(H.page(token, 'ceo', 'Panel CEO', [{ label: 'CEO', url: '/panel-ceo' }], content));
  } catch(e) {
    console.error("ERROR CEO:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});

// ================= PANEL COMUNIDADES =================
app.get("/panel", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const comunidades = await obtenerResumenComunidades();
    const tk = encodeURIComponent(token);

    const tarjetas = comunidades.map(com => {
      const url = `/panel-comunidad?token=${tk}&comunidad=${encodeURIComponent(com.nombre)}`;
      const critica = com.discordancias > 0 || com.incompletos > com.total * 0.5;
      const clase = critica ? 'critica' : com.listos === com.total ? 'completa' : 'proceso';
      let prioLabel = '';
      if (critica) prioLabel = '<span class="badge badge-rojo">🚨 Crítica</span>';
      else if (com.listos === com.total) prioLabel = '<span class="badge badge-verde">✅ Completa</span>';
      const pct = com.total > 0 ? Math.round(com.listos / com.total * 100) : 0;

      return `<div class="com-card ${clase}" data-buscar="${com.nombre.toLowerCase()} ${com.vecinos.map(v=>v.nombre+' '+v.vivienda+' '+v.telefono).join(' ').toLowerCase()}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <strong>${com.nombre}</strong>
            ${prioLabel}
          </div>
          <div class="com-stats-row">
            <span class="com-stat">Total: <b>${com.total}</b></span>
            ${com.discordancias > 0 ? `<span class="com-stat" style="color:#dc2626">🔴 ${com.discordancias} discordancias</span>` : ''}
            ${com.sin_nota > 0 ? `<span class="com-stat" style="color:#d97706">🟡 ${com.sin_nota} sin nota</span>` : ''}
            ${com.incompletos > 0 ? `<span class="com-stat">⚪ ${com.incompletos} proceso</span>` : ''}
            ${com.listos > 0 ? `<span class="com-stat" style="color:#16a34a">✅ ${com.listos}</span>` : ''}
          </div>
          <div style="margin-top:8px;height:4px;background:#f3f4f6;border-radius:2px">
            <div style="width:${pct}%;height:4px;background:#16a34a;border-radius:2px"></div>
          </div>
        </div>
        <a href="${url}" class="btn btn-primary btn-sm" style="white-space:nowrap">Ver →</a>
      </div>`;
    }).join('');

    const content = `
      <div style="margin-bottom:20px">
        <h1 style="font-size:22px;font-weight:700">🏢 Comunidades</h1>
        <p style="color:#6b7280;font-size:14px;margin-top:2px">Ordenadas por prioridad</p>
      </div>

      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" id="buscador" placeholder="Buscar comunidad, vecino, vivienda..." oninput="filtrar()"/>
      </div>

      <div class="filtros">
        <button class="filtro on" onclick="setFiltro(this,'')">Todas</button>
        <button class="filtro" onclick="setFiltro(this,'crítica')">🚨 Críticas</button>
        <button class="filtro" onclick="setFiltro(this,'proceso')">⚪ En proceso</button>
        <button class="filtro" onclick="setFiltro(this,'completa')">✅ Completas</button>
      </div>

      <div id="lista">${tarjetas || '<p style="color:#9ca3af;text-align:center;padding:30px">Sin comunidades</p>'}</div>

      <script>
        let filtroActivo = '';
        function filtrar() {
          const q = document.getElementById('buscador').value.toLowerCase();
          document.querySelectorAll('.com-card').forEach(el => {
            const txt = (el.dataset.buscar || '') + el.innerText.toLowerCase();
            const matchQ = !q || txt.includes(q);
            const matchF = !filtroActivo || txt.includes(filtroActivo);
            el.style.display = matchQ && matchF ? '' : 'none';
          });
        }
        function setFiltro(btn, f) {
          filtroActivo = f;
          document.querySelectorAll('.filtro').forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
          filtrar();
        }
      </script>
    `;

    res.send(H.page(token, 'comunidades', 'Comunidades', [{ label: 'Comunidades', url: '/panel' }], content));
  } catch(e) {
    console.error("ERROR PANEL:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});

// ================= DETALLE COMUNIDAD =================
app.get("/panel-comunidad", async (req, res) => {
  const token = req.query.token;
  const comunidad = req.query.comunidad;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  if (!comunidad) return res.status(400).send("Falta comunidad");
  try {
    const tk = encodeURIComponent(token);
    const sheets = getSheetsClient();
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:Y",
    });
    const rows = data.data.values || [];
    const expedientes = rows.slice(1).filter(r => (r[1] || "").trim().toUpperCase() === comunidad.trim().toUpperCase());

    const filas = expedientes.map(r => {
      const estado = r[7] || "";
      const docActual = r[6] || "—";
      const telefono = r[0] || "";
      const horasUltimo = r[10] ? Math.floor((Date.now() - new Date(r[10])) / 3600000) : 999;
      const na = H.nextAction(docActual, estado, horasUltimo, r[23]);
      const fichaUrl = `/vecino?token=${tk}&t=${encodeURIComponent(telefono)}`;
      const pendientes = (r[16] || "").split(",").filter(Boolean).length;
      return `<tr data-buscar="${(r[3]||'').toLowerCase()} ${(r[2]||'').toLowerCase()} ${telefono}">
        <td><strong>${r[2] || "—"}</strong></td>
        <td><a href="${fichaUrl}" style="color:#2563eb;font-weight:500">${r[3] || "—"}</a></td>
        <td style="color:#6b7280;font-size:12px">${telefono}</td>
        <td>${H.badge(estado)}</td>
        <td style="font-size:13px">${docActual}</td>
        <td style="font-size:12px;color:#6b7280">${pendientes} doc.</td>
        <td><span class="badge badge-azul" style="font-size:11px">${na.icon} ${na.text}</span></td>
        <td><a href="${fichaUrl}" class="btn btn-sm btn-primary">Ficha →</a></td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:30px;color:#9ca3af">Sin expedientes</td></tr>`;

    const content = `
      <div style="margin-bottom:20px">
        <h1 style="font-size:22px;font-weight:700">${comunidad}</h1>
        <p style="color:#6b7280;font-size:14px;margin-top:2px">${expedientes.length} expedientes</p>
      </div>

      <div class="card">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="buscador" placeholder="Buscar por nombre, vivienda, teléfono..." oninput="filtrar()"/>
        </div>
        <div style="overflow-x:auto">
          <table class="tabla" id="tabla">
            <thead><tr><th>Vivienda</th><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Doc. actual</th><th>Pendientes</th><th>Acción recomendada</th><th></th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>

      <script>
        function filtrar() {
          const q = document.getElementById('buscador').value.toLowerCase();
          document.querySelectorAll('#tabla tbody tr').forEach(tr => {
            tr.style.display = (tr.dataset.buscar || tr.innerText).toLowerCase().includes(q) ? '' : 'none';
          });
        }
      </script>
    `;

    res.send(H.page(token, 'comunidades', comunidad,
      [{ label: 'Comunidades', url: '/panel' }, { label: comunidad, url: '/panel-comunidad?comunidad=' + encodeURIComponent(comunidad) }],
      content));
  } catch(e) {
    console.error("ERROR COMUNIDAD:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});

// ================= FICHA VECINO =================
app.get("/vecino", async (req, res) => {
  const token = req.query.token;
  const tel = req.query.t;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  if (!tel) return res.status(400).send("Falta teléfono");
  try {
    const sheets = getSheetsClient();
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:Y",
    });
    const rows = data.data.values || [];
    const r = rows.find(x => normalizarTelefono(x[0] || "") === normalizarTelefono(tel));
    if (!r) return res.send("<h2>No encontrado</h2>");
    const tk = encodeURIComponent(token);
    const tv = encodeURIComponent(r[0]);
    const comunidad = r[1] || "";
    const driveUrl = "https://drive.google.com/drive/folders/" + (process.env.GOOGLE_DRIVE_FOLDER_ID || "");

    // Documentos subidos desde hoja documentos!
    let docsSubidos = [];
    try {
      const dataDocs = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:J",
      });
      const telNorm = normalizarTelefono(tel);
      docsSubidos = (dataDocs.data.values || []).slice(1)
        .filter(d => normalizarTelefono(d[0] || "") === telNorm)
        .map(d => ({ tipo: d[3]||"documento", nombre: d[4]||"", fecha: (d[5]||"").slice(0,10), url: d[6]||"", estado: d[8]||"OK", motivo: d[9]||"" }))
        .sort((a,b) => ({ REVISAR:0, REPETIR:1, OK:2 }[a.estado]??3) - ({ REVISAR:0, REPETIR:1, OK:2 }[b.estado]??3));
    } catch(e) { console.error("Error docs:", e.message); }
    const estado = r[7] || "";
    const docActual = r[6] || "";
    const horasUltimo = r[10] ? Math.floor((Date.now() - new Date(r[10])) / 3600000) : 999;
    const diasInicio = r[8] ? Math.floor((Date.now() - new Date(r[8])) / 86400000) : "—";
    const na = H.nextAction(docActual, estado, horasUltimo, r[23]);
    const docsRecibidos = (r[15] || "").split(",").map(d => d.trim()).filter(Boolean);
    const docsPendientes = (r[16] || "").split(",").map(d => d.trim()).filter(Boolean);
    const docsOpcionales = (r[17] || "").split(",").map(d => d.trim()).filter(Boolean);
    const despues = docsPendientes.filter(d => d !== docActual);

    const recomendacion = r[23] === "si"
      ? "🚨 Requiere intervención manual — contactar directamente"
      : horasUltimo > 72 ? `📲 Lleva ${Math.floor(horasUltimo/24)} días sin responder — considera enviar un aviso`
      : estado.includes("repetir") ? "🔁 El vecino debe reenviar el documento — puedes pedírselo con el botón"
      : estado.includes("revision") ? "⚠️ Hay un documento pendiente de revisión manual"
      : "👀 Sin acción urgente — esperando al vecino";

    // ---- Construir lista unificada de documentos ----
    const pasoActual = r[5] || "";
    const esFinanciacion = pasoActual === "recogida_financiacion";
    const DOCS_FINANCIACION = ["dni_pagador_delante","dni_pagador_detras","justificante_ingresos","titularidad_bancaria"];

    let todosLosTipos;
    if (esFinanciacion) {
      // En financiación: mostrar los 4 docs de financiación + los del flujo principal ya recibidos
      const recibidosPrincipal = (r[15]||"").split(",").map(d=>d.trim()).filter(Boolean);
      todosLosTipos = [...new Set([...recibidosPrincipal, ...DOCS_FINANCIACION])];
    } else {
      todosLosTipos = [...new Set([
        ...(r[15]||"").split(",").map(d=>d.trim()).filter(Boolean), // recibidos
        ...(r[16]||"").split(",").map(d=>d.trim()).filter(Boolean), // pendientes
        ...(r[17]||"").split(",").map(d=>d.trim()).filter(Boolean), // opcionales
      ])];
    }

    // Para cada tipo, buscar el mejor archivo subido
    const docsMapa = {};
    for (const d of docsSubidos) {
      if (!docsMapa[d.tipo] || d.estado === "OK" || (d.estado === "REVISAR" && docsMapa[d.tipo].estado === "REPETIR")) {
        docsMapa[d.tipo] = d;
      }
    }

    // Construir lista unificada con estado visual
    const docsUnificados = todosLosTipos.map(tipo => {
      const subido = docsMapa[tipo];
      const esPendiente = (r[16]||"").includes(tipo);
      const esOpcional = (r[17]||"").includes(tipo) && !(r[16]||"").includes(tipo);
      const esActual = tipo === docActual;
      let estadoDoc, estadoLabel, estadoClass, motivo = "";
      if (!subido) {
        estadoDoc = esOpcional ? "opcional" : "pendiente";
        estadoLabel = esOpcional ? "Opcional" : "Pendiente";
        estadoClass = "badge-gris";
      } else if (subido.estado === "OK") {
        estadoDoc = "ok"; estadoLabel = "Correcto"; estadoClass = "badge-verde";
      } else if (subido.estado === "REVISAR") {
        estadoDoc = "revision"; estadoLabel = "En revisión"; estadoClass = "badge-amarillo";
        motivo = subido.motivo;
      } else {
        estadoDoc = "rechazado"; estadoLabel = "Rechazado"; estadoClass = "badge-rojo";
        motivo = subido.motivo;
      }
      return { tipo, subido, estadoDoc, estadoLabel, estadoClass, motivo, esActual, esOpcional };
    });

    // Ordenar: rechazados > revision > actuales > pendientes > ok > opcionales
    const ordenEstado = { rechazado:0, revision:1, pendiente:2, ok:3, opcional:4 };
    docsUnificados.sort((a,b) => {
      if (a.esActual && !b.esActual) return -1;
      if (!a.esActual && b.esActual) return 1;
      return (ordenEstado[a.estadoDoc]??5) - (ordenEstado[b.estadoDoc]??5);
    });

    // ---- Detectar acción principal automática ----
    const docProblema = docsUnificados.find(d => d.estadoDoc === "rechazado" || d.estadoDoc === "revision");
    let accionPrincipal = null;
    if (r[23] === "si") {
      accionPrincipal = {
        tipo: "urgente",
        titulo: `🚨 ${docActual ? docActual + ' — bloquea el expediente' : 'Expediente bloqueado'}`,
        descripcion: (r[22] || "Este expediente requiere atenci\u00f3n manual para continuar."),
        botones: [
          { label: "\uD83D\uDD01 Solicitar nuevo documento", url: `/accion/combo?token=${tk}&t=${tv}&estado=expediente_con_documento_a_repetir&msg=${encodeURIComponent('Necesitamos que vuelvas a enviar el documento. La imagen no es v\u00e1lida. \uD83D\uDC49 H\u00e1zla con buena luz, sin mover el m\u00f3vil y mostrando todo el documento.')}`, clase: "btn-primary" }
        ]
      };
    } else if (docProblema && docProblema.estadoDoc === "rechazado") {
      accionPrincipal = {
        tipo: "repetir",
        titulo: `❌ ${docProblema.tipo} — Rechazado`,
        descripcion: docProblema.motivo || "El documento no es válido.",
        botones: [
          docProblema.subido?.url ? { label: "👁 Ver documento", url: docProblema.subido.url, clase: "btn-secondary", blank: true } : null,
          { label: "🔁 Pedir repetición", url: `/accion/combo?token=${tk}&t=${tv}&estado=expediente_con_documento_a_repetir&msg=${encodeURIComponent('Necesitamos que vuelvas a enviar el documento. No se ha podido validar. Cualquier duda estamos aquí 👋')}`, clase: "btn-primary" }
        ].filter(Boolean)
      };
    } else if (docProblema && docProblema.estadoDoc === "revision") {
      accionPrincipal = {
        tipo: "revision",
        titulo: `⚠️ ${docProblema.tipo} — Pendiente de revisión`,
        descripcion: docProblema.motivo || "Revisar manualmente antes de continuar.",
        botones: [
          docProblema.subido?.url ? { label: "👁 Ver documento", url: docProblema.subido.url, clase: "btn-secondary", blank: true } : null,
          { label: "✅ Validar", url: `/accion/combo?token=${tk}&t=${tv}&estado=expediente_revisado&msg=${encodeURIComponent('✅ Tu documentación está correcta. En breve nos ponemos en contacto.')}`, clase: "btn-primary" },
          { label: "❌ Pedir repetición", url: `/accion/combo?token=${tk}&t=${tv}&estado=expediente_con_documento_a_repetir&msg=${encodeURIComponent('Necesitamos que vuelvas a enviar el documento. No se ha podido validar.')}`, clase: "btn-danger" }
        ].filter(Boolean)
      };
    } else if (horasUltimo > 72 && docActual) {
      accionPrincipal = {
        tipo: "recordatorio",
        titulo: `📲 Sin respuesta hace ${Math.floor(horasUltimo/24)} días`,
        descripcion: `Está esperando enviar: ${docActual}`,
        botones: [
          { label: "📲 Enviar recordatorio", url: `/accion/avisar?token=${tk}&t=${tv}`, clase: "btn-primary" }
        ]
      };
    }

    const colorBorde = r[23]==="si" || estado.includes("bloqueado") ? "#dc2626"
      : docProblema?.estadoDoc === "rechazado" ? "#dc2626"
      : docProblema?.estadoDoc === "revision" ? "#d97706"
      : estado.includes("completo") || estado.includes("revisado") ? "#16a34a"
      : "#2563eb";

    const content = `
      <!-- BLOQUE 1: HEADER -->
      <div class="card" style="border-left:4px solid ${colorBorde}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <h1 style="font-size:20px;font-weight:700">${r[3] || "Sin nombre"}</h1>
            <p style="color:#6b7280;font-size:13px;margin-top:3px">${comunidad} · Vivienda ${r[2] || "—"} · ${r[0]}</p>
          </div>
          ${H.badge(estado)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px">
          <div style="font-size:13px"><span style="color:#6b7280">Tipo</span><br><strong>${r[4] || "—"}</strong></div>
          ${esFinanciacion ? '<div style="font-size:13px"><span style="color:#6b7280">Fase</span><br><strong style="color:#7c3aed">📋 Financiación</strong></div>' : ''}
          <div style="font-size:13px"><span style="color:#6b7280">Días activo</span><br><strong>${diasInicio}d</strong></div>
          <div style="font-size:13px"><span style="color:#6b7280">Último contacto</span><br><strong>${(r[10]||"").slice(0,10)||"—"}</strong></div>
        </div>
        ${(estado.includes('repetir')||estado.includes('bloqueado')) && docActual ? `<div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border-radius:8px;display:flex;align-items:center;gap:10px">
          <span style="font-size:16px">\u26D4</span>
          <div>
            <div style="color:#dc2626;font-weight:700;font-size:13px">Expediente bloqueado</div>
            <div style="color:#7f1d1d;font-size:12px;margin-top:1px">Falta corregir: <strong>${docActual}</strong></div>
          </div>
        </div>` : estado.includes('revision') && docActual ? `<div style="margin-top:12px;padding:10px 14px;background:#fffbeb;border-radius:8px;display:flex;align-items:center;gap:10px">
          <span style="font-size:16px">\u26A0\uFE0F</span>
          <div>
            <div style="color:#d97706;font-weight:700;font-size:13px">Revisi\u00f3n pendiente</div>
            <div style="color:#78350f;font-size:12px;margin-top:1px">Validar manualmente: <strong>${docActual}</strong></div>
          </div>
        </div>` : ''}
      </div>

      <!-- PROGRESO EXPEDIENTE -->
      ${(function() {
        // Incluir docs de financiación en el total si está en esa fase
        const docsParaProgreso = esFinanciacion
          ? docsUnificados
          : docsUnificados.filter(d => !DOCS_FINANCIACION.includes(d.tipo));
        const totalDocs = docsParaProgreso.filter(d => d.estadoDoc !== 'opcional').length;
        const okDocs = docsParaProgreso.filter(d => d.estadoDoc === 'ok').length;
        const pct = totalDocs > 0 ? Math.round(okDocs / totalDocs * 100) : 0;
        const colorBarra = pct === 100 ? '#16a34a' : pct > 50 ? '#2563eb' : '#d97706';
        return `<div class="card" style="padding:14px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">\uD83D\uDCCA Progreso expediente</div>
            <div style="font-size:13px;font-weight:700;color:${colorBarra}">${okDocs} / ${totalDocs} documentos completados</div>
          </div>
          <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:6px;background:${colorBarra};border-radius:3px;transition:width 0.3s"></div>
          </div>
        </div>`;
      })()}

      <!-- ACCIÓN PRINCIPAL AUTOMÁTICA -->
      ${accionPrincipal ? `<div class="card" style="border-left:4px solid ${accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir' ? '#dc2626' : accionPrincipal.tipo==='revision' ? '#d97706' : '#f59e0b'};background:${accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir' ? '#fef9f9' : accionPrincipal.tipo==='revision' ? '#fffdf5' : '#fffbeb'}">
        <div style="font-size:10px;font-weight:700;color:${accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir'?'#dc2626':accionPrincipal.tipo==='revision'?'#d97706':'#f59e0b'};text-transform:uppercase;letter-spacing:0.7px;margin-bottom:10px">⚡ Acción ahora</div>
        <div style="margin-bottom:14px">
          <div style="font-size:13px;color:#6b7280;margin-bottom:2px">Documento incorrecto</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${accionPrincipal.tipo==='repetir'||accionPrincipal.tipo==='urgente' ? docActual || accionPrincipal.titulo : accionPrincipal.titulo}</div>
          <div style="font-size:13px;font-weight:600;color:#1a1d23">\uD83D\uDC49 Acci\u00f3n: ${accionPrincipal.tipo==='repetir'||accionPrincipal.tipo==='urgente'?'Solicitar nuevo documento':accionPrincipal.tipo==='revision'?'Validar o solicitar nuevo documento':'Enviar recordatorio'}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${accionPrincipal.botones.map(b => `<a href="${b.url}" ${b.blank?'target="_blank"':''} class="btn ${b.clase}">${b.label}</a>`).join('')}
        </div>
      </div>` : ''}

      <!-- DOCUMENTOS UNIFICADOS -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="card-title" style="margin-bottom:0">\uD83D\uDCCB Documentos</div>
          <a href="${driveUrl}" target="_blank" class="btn btn-sm btn-secondary">\uD83D\uDCC1 Drive</a>
        </div>
        ${docsUnificados.map(d => {
          const iconEstado = { ok:'🟢', revision:'🟡', rechazado:'🔴', pendiente:'⚪', opcional:'🔵' }[d.estadoDoc] || '⚪';
          const labelEstado = { ok:'Correcto', revision:'En revisi\u00f3n', rechazado:'Rechazado', pendiente:'Pendiente', opcional:'Opcional' }[d.estadoDoc] || '';
          const colorLabel = { ok:'#16a34a', revision:'#d97706', rechazado:'#dc2626', pendiente:'#6b7280', opcional:'#7c3aed' }[d.estadoDoc] || '#6b7280';
          const esBloqueante = d.estadoDoc === 'rechazado' && d.esActual;
          const bgRow = esBloqueante ? '#fff5f5' : d.estadoDoc === 'revision' ? '#fffdf0' : d.esActual ? '#f8faff' : 'transparent';
          const verBtn = d.subido?.url
            ? '<a href="' + d.subido.url + '" target="_blank" class="btn btn-sm btn-secondary">\uD83D\uDC41\uFE0F Ver</a>'
            : '';
          // Validar y Repetir disponibles para cualquier documento con archivo subido
          const tieneArchivo = !!d.subido;
          const validarBtn = tieneArchivo
            ? '<a href="/accion/validar?token=' + tk + '&t=' + tv + '&doc=' + encodeURIComponent(d.tipo) + '" class="btn btn-sm btn-success">\u2714 Validar</a>'
            : '';
          const motivoRep = d.motivo ? encodeURIComponent(d.motivo) : '';
          const repetirBtn = tieneArchivo
            ? '<a href="/accion/repetir-doc?token=' + tk + '&t=' + tv + '&doc=' + encodeURIComponent(d.tipo) + '&motivo=' + motivoRep + '" class="btn btn-sm btn-danger">\u274C Repetir</a>'
            : '';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px${bgRow!=='transparent'?' '+bgRow:'transparent'===bgRow?' 12px':'12px'};border-bottom:1px solid #f3f4f6;gap:10px;background:${bgRow};border-radius:${esBloqueante?'8px':'0'};margin-bottom:${esBloqueante?'4px':'0'}">
            <div style="min-width:0;flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:16px">${iconEstado}</span>
                <span style="font-size:14px;font-weight:600">${d.tipo}</span>
                ${esBloqueante ? '<span style="background:#dc2626;color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">BLOQUEANTE</span>' : d.esActual ? '<span style="background:#2563eb;color:white;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">SIGUIENTE</span>' : ''}
              </div>
              <div style="margin-top:4px;margin-left:24px">
                <span style="font-size:12px;color:${colorLabel};font-weight:600">${labelEstado === 'Pendiente' ? 'Pendiente \u2014 a\u00fan no enviado' : labelEstado}</span>
                ${d.motivo ? `<span style="font-size:12px;color:#6b7280"> · ${d.motivo}</span>` : ''}
              </div>
              ${d.subido?.fecha ? `<div style="font-size:11px;color:#9ca3af;margin-left:24px;margin-top:2px">${d.subido.fecha}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
              ${verBtn}${validarBtn}${repetirBtn}
            </div>
          </div>`;
        }).join('')}
      </div>

      

      <!-- BLOQUE 4: MODO AVANZADO -->
      <div class="card">
        <button class="btn-avanzado" onclick="const el=document.getElementById('av');el.classList.toggle('abierto');this.textContent=el.classList.contains('abierto')?'▲ Ocultar modo avanzado':'⚙️ Modo avanzado'">⚙️ Modo avanzado</button>
        <div id="av" class="avanzado">
          <div class="seccion">Mensajes manuales</div>
          <div class="avanzado-grid" style="grid-template-columns:1fr 1fr">
            <a href="/accion/avisar?token=${tk}&t=${tv}" class="avanzado-btn">📩 Avisar cliente</a>
            <a href="/accion/combo?token=${tk}&t=${tv}&estado=expediente_revisado&msg=${encodeURIComponent('\u2705 Hemos revisado tu documentaci\u00f3n y est\u00e1 correcta. En breve nos pondremos en contacto.')}" class="avanzado-btn">\u2705 Confirmar revisado</a>
          </div>
          <div class="seccion">Cambiar estado</div>
          <div class="avanzado-grid">
            <a href="/accion/estado?token=${tk}&t=${tv}&v=en_proceso" class="avanzado-btn">En proceso</a>
            <a href="/accion/estado?token=${tk}&t=${tv}&v=expediente_revisado" class="avanzado-btn">Revisado</a>
            <a href="/accion/desbloquear?token=${tk}&t=${tv}" class="avanzado-btn">🔓 Desbloquear</a>
          </div>
          <div class="seccion">Forzar documento</div>
          <div class="avanzado-grid">
            <a href="/accion/documento?token=${tk}&t=${tv}&v=solicitud_firmada" class="avanzado-btn">Solicitud</a>
            <a href="/accion/documento?token=${tk}&t=${tv}&v=dni_delante" class="avanzado-btn">DNI delante</a>
            <a href="/accion/documento?token=${tk}&t=${tv}&v=dni_detras" class="avanzado-btn">DNI detrás</a>
            <a href="/accion/documento?token=${tk}&t=${tv}&v=empadronamiento" class="avanzado-btn">Empadronamiento</a>
            <a href="/accion/documento?token=${tk}&t=${tv}&v=autorizacion_familiar" class="avanzado-btn">Autorización</a>
            <a href="/accion/documento?token=${tk}&t=${tv}&v=contrato_alquiler" class="avanzado-btn">Contrato</a>
          </div>
          <div class="seccion">Cambiar tipo expediente</div>
          <div class="avanzado-grid">
            <a href="/accion/tipo?token=${tk}&t=${tv}&v=propietario" class="avanzado-btn">Propietario</a>
            <a href="/accion/tipo?token=${tk}&t=${tv}&v=inquilino" class="avanzado-btn">Inquilino</a>
            <a href="/accion/tipo?token=${tk}&t=${tv}&v=familiar" class="avanzado-btn">Familiar</a>
            <a href="/accion/tipo?token=${tk}&t=${tv}&v=sociedad" class="avanzado-btn">Sociedad</a>
            <a href="/accion/tipo?token=${tk}&t=${tv}&v=local" class="avanzado-btn">Local</a>
          </div>
        </div>
      </div>
    `;

    res.send(H.page(token, 'comunidades', r[3] || 'Vecino',
      [{ label: 'Comunidades', url: '/panel' }, { label: comunidad, url: '/panel-comunidad?comunidad=' + encodeURIComponent(comunidad) }, { label: r[3] || 'Vecino', url: '' }],
      content));
  } catch(e) {
    console.error("ERROR FICHA:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});


// Validar documento: marca OK en documentos!, recalcula expediente, avanza flujo
// ===================================================================
// FUNCIÓN CENTRAL: procesarAccionDocumento
// Punto único de entrada para VALIDAR y REPETIR.
// Garantiza que el expediente siempre queda consistente.
// ===================================================================
async function procesarAccionDocumento(tipo, telefono, tipoDoc, motivo) {
  // tipo: "VALIDAR" | "REPETIR"
  const expedienteBase = await buscarExpedientePorTelefono(telefono);
  if (!expedienteBase) throw new Error("Expediente no encontrado: " + telefono);

  // 1. Registrar el cambio en documentos! (fuente de verdad)
  if (tipo === "VALIDAR") {
    await guardarDocumentoSheet(
      expedienteBase.telefono, expedienteBase.comunidad, expedienteBase.vivienda,
      tipoDoc, "validado_manual_crm", "", "validacion_manual", "OK", ""
    );
    await actualizarCampoExpediente(telefono, 22, "no");
    await actualizarCampoExpediente(telefono, 18, "");
    console.log("procesarAccionDocumento: OK registrado para", tipoDoc);
  } else {
    await guardarDocumentoSheet(
      expedienteBase.telefono, expedienteBase.comunidad, expedienteBase.vivienda,
      tipoDoc, "rechazado_manual_crm", "", "rechazo_manual",
      "REPETIR", motivo || "Documento incorrecto, revisar y reenviar"
    );
    console.log("procesarAccionDocumento: REPETIR registrado para", tipoDoc);
  }

  // 2. Rama REPETIR — flujo exclusivo, no continúa
  if (tipo === "REPETIR") {
    let expediente = await buscarExpedientePorTelefono(telefono);
    const esOpcional = esDocumentoOpcional(expediente.tipo_expediente, tipoDoc);

    if (esOpcional) {
      // Opcional rechazado: NO bloquear — descartar y avanzar al siguiente
      expediente = marcarOpcionalDescartado(expediente, tipoDoc);
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = await resolverEstadoConversacional(expediente, []);
      await recalcularYActualizarTodo(expediente);
      // Leer estado final
      const efOpc = await buscarExpedientePorTelefono(telefono);
      const labelOpc = labelDocumento(tipoDoc);
      let msgOpc;
      if (efOpc.paso_actual === "pregunta_financiacion") {
        msgOpc = "\u274C " + labelOpc + " no es v\u00e1lido.\n\n"
          + (motivo ? motivo + "\n\n" : "")
          + "Continuamos sin \u00e9l.\n\n" + buildPreguntaFinanciacion();
      } else if (efOpc.documento_actual) {
        msgOpc = "\u274C " + labelOpc + " no es v\u00e1lido.\n\n"
          + (motivo ? motivo + "\n\n" : "")
          + "Continuamos sin \u00e9l. Ahora necesitamos:\n\n\uD83D\uDC49 *" + labelDocumento(efOpc.documento_actual) + "*";
      } else {
        msgOpc = "\u274C " + labelOpc + " no es v\u00e1lido. Continuamos sin \u00e9l.";
      }
      console.log("WHATSAPP FINAL (REPETIR opcional):", { documento: tipoDoc, msg: msgOpc.slice(0,80) });
      await guardarContacto(telefono, "repetir_opcional_descartado", "bot", msgOpc);
      await enviarWhatsApp(telefono, msgOpc).catch(e => console.error("Error WA repetir opc:", e.message));
      return efOpc;
    }

    // Documento OBLIGATORIO: recalcular y bloquear
    expediente = await resolverEstadoConversacional(expediente, []);
    // Forzar estado bloqueado
    expediente.documento_actual = tipoDoc;
    expediente.estado_expediente = "expediente_con_documento_a_repetir";
    expediente.documentos_completos = "NO";
    await recalcularYActualizarTodo(expediente);
    // Doble seguridad: forzar campos críticos en Sheets
    await actualizarCampoExpediente(telefono, 6,  tipoDoc);
    await actualizarCampoExpediente(telefono, 7,  "expediente_con_documento_a_repetir");
    await actualizarCampoExpediente(telefono, 13, "NO");

    // Leer estado final para log
    const ef = await buscarExpedientePorTelefono(telefono);
    const labelDoc = labelDocumento(tipoDoc);
    const esBorroso = motivo && motivo.toLowerCase().includes("borros");
    let msg = "\u274C *" + labelDoc + "* no es v\u00e1lido.\n\n";
    if (esBorroso) {
      msg += "La imagen llega borrosa o fuera de foco.\n\n\uD83D\uDC49 Para que sea v\u00e1lida:\n"
        + "\u2022 Pon el documento sobre una superficie plana\n"
        + "\u2022 Usa buena luz (sin sombras)\n"
        + "\u2022 Mant\u00e9n el m\u00f3vil quieto\n"
        + "\u2022 Encuadra el documento completo";
    } else {
      msg += (motivo ? motivo + "\n\n" : "") + "\uD83D\uDC49 Por favor, vuelve a enviarlo por aqu\u00ed.";
    }
    console.log("WHATSAPP FINAL:", {
      accion: "REPETIR", documento: tipoDoc,
      estado_expediente_final: ef.estado_expediente,
      documento_actual_final: ef.documento_actual,
      documentos_pendientes_final: ef.documentos_pendientes,
      documentos_completos_final: ef.documentos_completos,
      mensaje: msg.slice(0, 80)
    });
    await guardarContacto(telefono, "solicitud_repetir_manual", "bot", msg);
    await enviarWhatsApp(telefono, msg).catch(e => console.error("Error WA repetir:", e.message));
    return ef; // ← return explícito, nunca continúa
  }

  // 3. Rama VALIDAR — solo llega aquí si tipo === "VALIDAR"
  {
    // Pasar tipoDoc explícitamente para evitar lag de Sheets
    let expediente = await buscarExpedientePorTelefono(telefono);
    expediente = await resolverEstadoConversacional(expediente, [tipoDoc]);
    await recalcularYActualizarTodo(expediente);

    // Leer estado FINAL de Sheets — fuente de verdad para el mensaje
    const ef = await buscarExpedientePorTelefono(telefono);
    const pendientesFinal = (ef.documentos_pendientes || "").split(",").map(d => d.trim()).filter(Boolean);
    // Triple comprobación: solo "completo" si Sheets lo dice, no hay pendientes Y no hay bloqueo
    const hayBloqueo = ef.estado_expediente === "expediente_con_documento_a_repetir"
      || !!ef.ultimo_documento_fallido
      || !!ef.documento_actual;
    const completoFinal = ef.documentos_completos === "SI"
      && pendientesFinal.length === 0
      && !hayBloqueo;

    let msg;
    if (completoFinal) {
      msg = "\u2705 Hemos revisado toda tu documentaci\u00f3n y est\u00e1 correcta. En breve nos pondremos en contacto para los siguientes pasos.";
    } else if (ef.documento_actual) {
      const labelValidado = labelDocumento(tipoDoc);
      const siguiente     = labelDocumento(ef.documento_actual);
      const promptDoc     = getPromptPasoActual(ef);
      msg = "\u2705 *" + labelValidado + "* recibida y validada correctamente.\n\n"
        + "Ahora necesitamos:\n\n\uD83D\uDC49 *" + siguiente + "*\n\n"
        + (promptDoc ? promptDoc.split("\n").slice(0, 3).join("\n") : "Puedes enviarlo por aqu\u00ed cuando lo tengas.");
    } else {
      msg = "\u2705 Documento validado correctamente. En breve te indicamos el siguiente paso.";
    }

    console.log("WHATSAPP FINAL:", {
      accion: "VALIDAR", documento: tipoDoc,
      estado_expediente_final: ef.estado_expediente,
      documento_actual_final: ef.documento_actual,
      documentos_pendientes_final: ef.documentos_pendientes,
      documentos_completos_final: ef.documentos_completos,
      mensaje: msg.slice(0, 80)
    });
    await guardarContacto(telefono, "validacion_manual", "bot", msg);
    await enviarWhatsApp(telefono, msg).catch(e => console.error("Error WA validar:", e.message));
    return ef;
  }
}

// Mantener como wrappers por compatibilidad con código existente
async function validarDocumento(telefono, tipoDoc) {
  return procesarAccionDocumento("VALIDAR", telefono, tipoDoc, "");
}
async function repetirDocumento(telefono, tipoDoc, motivo) {
  return procesarAccionDocumento("REPETIR", telefono, tipoDoc, motivo);
}

// ===================================================================
// ENDPOINTS CRM — usan procesarAccionDocumento
// ===================================================================

app.get("/accion/validar", async (req, res) => {
  const token = req.query.token;
  const t = req.query.t;
  const tipoDoc = req.query.doc || "";
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  if (!tipoDoc) return res.status(400).send("Falta doc");
  try {
    await procesarAccionDocumento("VALIDAR", t, tipoDoc, "");
  } catch(e) { console.error("Error /accion/validar:", e.message); }
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});

app.get("/accion/repetir-doc", async (req, res) => {
  const token = req.query.token;
  const t = req.query.t;
  const tipoDoc = req.query.doc || "";
  const motivo = req.query.motivo || "";
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  if (!tipoDoc) return res.status(400).send("Falta doc");
  try {
    await procesarAccionDocumento("REPETIR", t, tipoDoc, motivo);
  } catch(e) { console.error("Error /accion/repetir-doc:", e.message); }
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});


// DIAGNÓSTICO TEMPORAL
app.get("/debug-expediente", async (req, res) => {
  const token = req.query.token;
  const t = req.query.t;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const expediente = await buscarExpedientePorTelefono(t);
    const sheets = getSheetsClient();
    const dataDocs = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:J",
    });
    const docs = (dataDocs.data.values || []).slice(1)
      .filter(d => normalizarTelefono(d[0]||"") === normalizarTelefono(t))
      .map(d => ({ tipo: d[3], estado: d[8], motivo: d[9] }));
    res.json({ expediente, docs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


app.get("/ejecutar-job", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "No autorizado" });
  }
  console.log("Job seguimiento lanzado manualmente");
  ejecutarJobSeguimiento().catch(e => console.error("Error job manual:", e.message));
  return res.json({ ok: true, mensaje: "Job lanzado" });
});

// ================= ENVIO MASIVO PRESENTACION =================
// Lee vecinos_base, manda la plantilla solo a filas con columna F vacía,
// marca la fecha en columna F al enviar. F="SKIP" excluye la fila.
// URL: GET /enviar-presentacion?token=SECRETO
app.get("/enviar-presentacion", async (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const sheets = getSheetsClient();
    const resVecinos = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "vecinos_base!A:F",
    });
    const rows = resVecinos.data.values || [];

    // Asegurarse de que la cabecera F existe
    if (rows[0] && !rows[0][5]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "vecinos_base!F1",
        valueInputOption: "RAW",
        requestBody: { values: [["presentacion_enviada"]] },
      });
    }

    let enviados = 0, omitidos = 0, errores = 0;
    const detalle = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const comunidad = row[0] || "";
      const vivienda  = row[2] || "";
      const nombre    = row[3] || "";
      const telefono  = normalizarTelefono(row[4] || "");
      const yaEnviado = row[5] || "";

      if (!telefono) { omitidos++; detalle.push({ fila: i+1, estado: "sin_telefono" }); continue; }
      if (yaEnviado && yaEnviado !== "") { omitidos++; detalle.push({ fila: i+1, telefono, estado: yaEnviado === "SKIP" ? "excluido" : "ya_enviado", fecha: yaEnviado }); continue; }

      try {
        await enviarWhatsAppPlantilla(telefono, "HX0e6fec235c5d8122db40276a6ac1fe27", {
          "1": nombre || "vecino",
        });
        // Marcar fecha de envio en columna F
        const fechaEnvio = new Date().toISOString().slice(0, 16).replace("T", " ");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: "vecinos_base!F" + (i + 1),
          valueInputOption: "RAW",
          requestBody: { values: [[fechaEnvio]] },
        });
        enviados++;
        detalle.push({ fila: i+1, telefono, nombre, estado: "enviado", fecha: fechaEnvio });
        await new Promise(r => setTimeout(r, 1000));
      } catch(e) {
        errores++;
        detalle.push({ fila: i+1, telefono, nombre, estado: "error", error: e.message });
        console.error("Error enviando presentacion a", telefono, e.message);
      }
    }

    console.log("Envio masivo presentacion:", { enviados, omitidos, errores });
    return res.json({ ok: true, enviados, omitidos, errores, detalle });
  } catch(e) {
    console.error("Error envio masivo:", e.message);
    return res.status(500).json({ error: e.message });
  }
});


app.post("/whatsapp", async (req, res) => {
  const inicio = Date.now();
  const telefonoRaw = (req.body.From || "").replace("whatsapp:", "");
  const telefonoKey = normalizarTelefono(telefonoRaw);
  const numMedia = parseInt(req.body.NumMedia || "0", 10);
  console.log("Mensaje entrante:", telefonoKey, new Date().toISOString());

  // Deduplicacion: si Twilio reintenta el mismo webhook, ignorarlo
  const messageSid = req.body.MessageSid || "";
  if (yaProcesado(messageSid)) {
    console.log("Duplicado ignorado:", messageSid);
    const twimlDedup = new twilio.twiml.MessagingResponse();
    return res.type("text/xml").send(twimlDedup.toString());
  }
  // marcarProcesado se hace en cada rama justo antes de aceptar el trabajo,
  // no aqui, para que un fallo muy temprano permita reintentar a Twilio.

  // TEXTOS: procesar sincrono.
  // Suelen ser mas ligeros que archivos, aunque algunos pasan por IA de texto.
  if (numMedia === 0) {
    marcarProcesado(messageSid); // marcar antes de entrar en la cola
    return withLock(telefonoKey, async () => {
      try {
        return await manejarMensajeWhatsApp(req, res);
      } finally {
        console.log("Tiempo total ms:", telefonoKey, Date.now() - inicio);
      }
    }).catch(err => {
      console.error("Error en cola texto:", { telefono: telefonoKey, error: err.message });
      if (!res.headersSent) {
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message("Ha habido un problema procesando tu mensaje.");
        return res.type("text/xml").send(twiml.toString());
      }
    });
  }

  // ARCHIVOS: responder inmediato a Twilio y procesar en background
  marcarProcesado(messageSid); // marcar antes de responder 200
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message("Documento recibido. Lo estamos revisando...");
  res.type("text/xml").send(twiml.toString());

  // Capturar req.body ahora para evitar que Express lo limpie antes del background
  const reqData = { body: { ...req.body } };

  setImmediate(() => {
    withLock(telefonoKey, async () => {
      console.log("BG inicio:", telefonoKey, messageSid);
      try {
        const respuestaFinal = await manejarMensajeWhatsAppBackground(reqData);
        console.log("BG respuesta final:", telefonoKey, respuestaFinal ? respuestaFinal.slice(0, 60) : "null");
        if (respuestaFinal) {
          try {
            await enviarWhatsApp(telefonoKey, respuestaFinal);
            console.log("BG envio ok:", telefonoKey);
          } catch (envioErr) {
            console.error("BG envio error:", { telefono: telefonoKey, error: envioErr.message });
          }
        }
      } catch (err) {
        console.error("BG error:", { telefono: telefonoKey, messageSid, error: err.message, stack: err.stack });
        try {
          await enviarWhatsApp(telefonoKey, "Ha habido un problema procesando tu documento.");
          console.log("BG envio fallback ok:", telefonoKey);
        } catch (e) {
          console.error("BG envio fallback error:", e.message);
        }
      } finally {
        console.log("Tiempo total ms:", telefonoKey, Date.now() - inicio);
      }
    });
  });
  return; // rama background: res ya respondio
});

// Limpieza periodica del mapa de deduplicacion (cada 5 minutos)
setInterval(() => {
  const ahora = Date.now();
  let eliminados = 0;
  for (const [sid, ts] of _processedMessages.entries()) {
    if (ahora - ts > PROCESSED_TTL_MS) {
      _processedMessages.delete(sid);
      eliminados++;
    }
  }
  if (eliminados > 0) console.log("Dedup limpieza:", eliminados, "entradas eliminadas");
}, 5 * 60 * 1000);


// ================= JOB PROACTIVO DE SEGUIMIENTO =================
// Se ejecuta cada hora. Lee todos los expedientes incompletos de Sheets
// y envía recordatorios a los vecinos que llevan tiempo sin responder.
// Solo envía si el nivel de alerta es nuevo (no repite el mismo mensaje).

async function leerTodosExpedientes() {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "expedientes!A:Y",
    });
    const rows = res.data.values || [];
    const expedientes = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue; // sin telefono
      expedientes.push({
        rowIndex: i + 1,
        telefono: row[0] || "", comunidad: row[1] || "", vivienda: row[2] || "", nombre: row[3] || "",
        tipo_expediente: row[4] || "", paso_actual: row[5] || "", documento_actual: row[6] || "",
        estado_expediente: row[7] || "", fecha_inicio: row[8] || "", fecha_primer_contacto: row[9] || "",
        fecha_ultimo_contacto: row[10] || "", fecha_limite_documentacion: row[11] || "",
        fecha_limite_firma: row[12] || "", documentos_completos: row[13] || "",
        alerta_plazo: row[14] || "", documentos_recibidos: row[15] || "",
        documentos_pendientes: row[16] || "", documentos_opcionales_pendientes: row[17] || "",
        ultimo_documento_fallido: row[18] || "", fecha_ultimo_fallo: row[19] || "",
        reintento_hasta: row[20] || "", motivo_bloqueo_actual: row[21] || "",
        prioridad_expediente: row[22] || "", requiere_intervencion_humana: row[23] || "no",
        documentos_opcionales_descartados: row[24] || "",
      });
    }
    return expedientes;
  } catch (err) {
    console.error("Job: error leyendo expedientes:", err.message);
    return [];
  }
}

async function ejecutarJobSeguimiento() {
  console.log("Job seguimiento: inicio", new Date().toISOString());
  let enviados = 0;
  let omitidos = 0;

  try {
    const expedientes = await leerTodosExpedientes();

    for (let expediente of expedientes) {
      // Solo expedientes activos con documentos pendientes
      const pasosActivos = ["recogida_documentacion", "recogida_financiacion", "pregunta_financiacion"];
      if (!pasosActivos.includes(expediente.paso_actual)) { omitidos++; continue; }
      if (!splitList(expediente.documentos_pendientes).length) { omitidos++; continue; }
      if (!expediente.telefono) { omitidos++; continue; }

      // Rehidratar desde documentos! para no usar datos cacheados desincronizados
      const tipoDocsJob = expediente.paso_actual === "recogida_financiacion" ? "financiacion" : null;
      try { expediente = await hidratarResumenDocumentalDesdeSheets(expediente, tipoDocsJob); } catch(e) {}
      // Calcular si toca aviso proactivo
      const aviso = construirAvisoPorPlazo(expediente);
      if (!aviso) { omitidos++; continue; }

      // No repetir si ya se mandó este nivel de alerta
      if (expediente.alerta_plazo === aviso.alerta) { omitidos++; continue; }

      // Enviar recordatorio usando plantilla aprobada — sin restriccion ventana 24h
      try {
        const pendientesArr = splitList(expediente.documentos_pendientes);
        const listaPendientes = pendientesArr.map(d => "\u2022 " + labelDocumento(d)).join("\n") || "documentos pendientes";
        await enviarWhatsAppPlantilla(expediente.telefono, "HX2e0a14edff657f0b46b7b1a0d19627c7", {
          "1": expediente.nombre || "vecino",
          "2": (expediente.comunidad || "") + (expediente.vivienda ? " " + expediente.vivienda : ""),
          "3": listaPendientes,
        });
        // Actualizar alerta_plazo en Sheets para no repetir
        expediente.alerta_plazo = aviso.alerta;
        await actualizarExpediente(expediente.rowIndex, expediente);
        await guardarAviso(expediente.telefono, aviso.tipo, "job_proactivo");
        console.log("Job: enviado a", normalizarTelefono(expediente.telefono), aviso.tipo);
        try { await guardarContacto(expediente.telefono, "job_proactivo", "bot", aviso.mensaje || aviso.tipo); } catch(e) {}
        enviados++;
        // Pausa breve entre envíos para no saturar la API de Twilio
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error("Job: error enviando a", expediente.telefono, err.message);
      }
    }
  } catch (err) {
    console.error("Job seguimiento: error general:", err.message);
  }

  console.log("Job seguimiento: fin. Enviados:", enviados, "| Omitidos:", omitidos);
}

// Ejecutar cada hora. Primera ejecución a los 2 minutos de arrancar
// para no solaparse con el inicio del servidor.
setTimeout(() => {
  ejecutarJobSeguimiento();
  setInterval(ejecutarJobSeguimiento, 60 * 60 * 1000);
}, 2 * 60 * 1000);

// ================= SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log("Servidor corriendo en puerto", PORT); });
