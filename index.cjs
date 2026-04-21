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

async function enviarWhatsApp(to, body) {
  // Validación temprana: si falta la variable no intentamos envío falso
  if (!process.env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error("Falta TWILIO_WHATSAPP_NUMBER en variables de entorno");
  }
  const fromNum = "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER;
  const toNum = "whatsapp:" + normalizarTelefono(to);
  console.log("Enviando WhatsApp:", {
    from: fromNum,
    to: toNum,
    body: body.slice(0, 120),
  });
  // Re-throw para que el caller pueda distinguir OK de error
  await twilioClient.messages.create({ from: fromNum, to: toNum, body });
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
function mensajeParaVecino(estadoDocumento, motivo, siguiente, intentos, documentoActualCode) {
  if (estadoDocumento === "OK") {
    return siguiente
      ? "Documento recibido correctamente\n\nSeguimos:\n" + siguiente
      : "Documento recibido correctamente";
  }
  if (estadoDocumento === "REVISAR") {
    return siguiente
      ? "Documento recibido. Lo vamos a revisar internamente. De momento seguimos:\n\n" + siguiente
      : "Documento recibido. Lo vamos a revisar internamente.";
  }
  if (estadoDocumento === "REPETIR") {
    // Usar el label real del documento si tenemos el codigo; si no, frase generica
    const docLabel = documentoActualCode ? labelDocumento(documentoActualCode) : "ese documento";
    let sufijoIntentos = "";
    if (intentos >= 3) {
      sufijoIntentos = "\n\nNuestro equipo tambien lo revisara personalmente para ayudarte.";
    } else if (intentos === 2) {
      sufijoIntentos = "\n\nEs el segundo intento con este documento. Si necesitas ayuda, puedes escribirnos.";
    }
    // Motivo limpio: quitar prefijos internos como [revisar_calidad] si llegaran aqui
    const motivoLimpio = motivo ? motivo.replace(/^\[\w+\]\s*/, "") : "";
    const lineaMotivo = motivoLimpio ? " (" + motivoLimpio + ")" : "";
    const lineaSiguiente = siguiente
      ? "\n\nDe momento seguimos con:\n" + siguiente
      : "";
    return "Archivo recibido, pero la " + docLabel + " no es valida" + lineaMotivo + "."
      + "\n\nPuedes volver a enviarla ahora mismo por este WhatsApp si quieres."
      + "\nSi prefieres, tambien puedes seguir con el resto y dejaremos este documento pendiente para revision."
      + sufijoIntentos
      + lineaSiguiente;
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
    "Analiza esta imagen. Responde SOLO en JSON:\n{\"tipo\": \"dni_delante | dni_detras | otro | dudoso\", \"confianza\": 0-100}\ndni_delante=cara+datos personales, dni_detras=codigo barras/MRZ, otro=no es DNI, dudoso=no se ve claro",
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
  const resultado = await llamarIAconImagen(
    "Analiza este documento. Es una solicitud de alta de agua de EMASESA (empresa de agua de Sevilla).\n\nResponde SOLO en JSON con este formato exacto:\n{\n  \"tipo\": \"solicitud_firmada | otro | dudoso\",\n  \"firma_detectada\": \"si | no | dudoso\",\n  \"completo\": \"si | no | dudoso\",\n  \"confianza\": 0,\n  \"motivo\": \"\"\n}\n\nReglas:\n- tipo solicitud_firmada: parece un formulario administrativo con campos rellenables\n- firma_detectada: si=firma manuscrita visible, no=no hay firma, dudoso=no se aprecia bien\n- completo: si=documento completo, no=cortado o incompleto, dudoso=no se puede determinar\n- confianza: 0-100\n- motivo: descripcion breve de lo que ves",
    base64,
    IA_TIMEOUT_MS
  );

  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo analizar la solicitud automaticamente" };

  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece la solicitud de EMASESA" };
  if (resultado.tipo === "dudoso") return { estadoDocumento: "REVISAR", motivo: "no se aprecia bien la solicitud" };

  // Es solicitud_firmada
  if (resultado.firma_detectada === "no") {
    return { estadoDocumento: "REPETIR", motivo: "la solicitud parece correcta pero no tiene firma. Firmala a mano y enviala de nuevo" };
  }
  if (resultado.firma_detectada === "dudoso") {
    return { estadoDocumento: "REVISAR", motivo: "la solicitud parece correcta pero la firma no se aprecia bien. Si puedes, reenviala mas cerca y con buena luz" };
  }
  if (resultado.completo === "no") {
    return { estadoDocumento: "REPETIR", motivo: "la solicitud parece incompleta o cortada. Asegurate de que se ve el documento entero" };
  }
  if (resultado.completo === "dudoso" || resultado.confianza < 50) {
    return { estadoDocumento: "REVISAR", motivo: resultado.motivo || "la solicitud necesita revision interna" };
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
    { code: "solicitud_firmada", prompt: "Primero necesito la solicitud de alta de EMASESA.\nImprimela, rellenala y firmala a mano.\nDespues hazle una foto clara o enviala en PDF.\nAsegurate de que se vea la firma." },
    { code: "dni_delante", prompt: "Ahora el DNI por la parte delantera.\nEs la cara con la foto y los datos personales.\nHaz la foto completa, bien encuadrada y con buena luz." },
    { code: "dni_detras", prompt: "Ahora el DNI por la parte trasera.\nEs la cara con los codigos y la zona inferior de lectura (MRZ).\nHaz la foto completa, sin recortar ningún borde." },
    { code: "empadronamiento", prompt: "Documento opcional: certificado de empadronamiento.\nSi lo tienes, enviamelo aqui.\nSi no lo tienes ahora, escribe NO y seguimos sin el." },
  ],
  familiar: [
    { code: "solicitud_firmada", prompt: "Primero necesito la solicitud de alta de EMASESA.\nImprimela, rellenala y firmala a mano.\nDespues hazle una foto clara o enviala en PDF.\nAsegurate de que se vea la firma." },
    { code: "dni_familiar_delante", prompt: "Ahora el DNI del familiar por la parte delantera.\nEs la cara con la foto y los datos personales.\nFoto completa, buena luz." },
    { code: "dni_familiar_detras", prompt: "Ahora el DNI del familiar por la parte trasera.\nEs la cara con los codigos y la zona MRZ.\nFoto completa, sin recortar." },
    { code: "dni_propietario_delante", prompt: "Ahora el DNI del propietario por la parte delantera.\nCara con foto y datos personales.\nFoto completa, buena luz." },
    { code: "dni_propietario_detras", prompt: "Ahora el DNI del propietario por la parte trasera.\nCara con codigos y zona MRZ.\nFoto completa, sin recortar." },
    { code: "libro_familia", prompt: "Necesito el libro de familia.\nEnvialo abierto por la pagina donde aparece la relacion entre el titular y el familiar.\nPuede ser foto o PDF." },
    { code: "autorizacion_familiar", prompt: "Necesito el documento de autorizacion firmado.\nDebe estar firmado por el propietario autorizando al familiar.\nFoto clara o PDF." },
    { code: "empadronamiento", prompt: "Documento opcional: certificado de empadronamiento.\nSi lo tienes, enviamelo.\nSi no, escribe NO y seguimos." },
  ],
  inquilino: [
    { code: "solicitud_firmada", prompt: "Primero necesito la solicitud de alta de EMASESA.\nImprimela, rellenala y firmala a mano.\nFoto clara o PDF. Asegurate de que se vea la firma." },
    { code: "dni_inquilino_delante", prompt: "Ahora el DNI del inquilino por la parte delantera.\nCara con foto y datos personales. Foto completa, buena luz." },
    { code: "dni_inquilino_detras", prompt: "Ahora el DNI del inquilino por la parte trasera.\nCara con codigos y zona MRZ. Foto completa, sin recortar." },
    { code: "dni_propietario_delante", prompt: "Ahora el DNI del propietario por la parte delantera.\nCara con foto y datos personales. Foto completa, buena luz." },
    { code: "dni_propietario_detras", prompt: "Ahora el DNI del propietario por la parte trasera.\nCara con codigos y zona MRZ. Foto completa, sin recortar." },
    { code: "contrato_alquiler", prompt: "Necesito el contrato de alquiler completo y firmado por ambas partes.\nLo ideal es enviarlo en un unico PDF.\nSi no puedes, manda todas las paginas como fotos y escribe LISTO cuando termines." },
    { code: "empadronamiento", prompt: "Documento opcional: certificado de empadronamiento.\nSi lo tienes, enviamelo.\nSi no, escribe NO y seguimos." },
  ],
  sociedad: [
    { code: "solicitud_firmada", prompt: "Primero la solicitud de alta de EMASESA.\nImprimela, rellenala y firmala. Foto clara o PDF con firma visible." },
    { code: "dni_administrador_delante", prompt: "DNI del administrador o representante por la parte delantera.\nCara con foto y datos personales. Foto completa, buena luz." },
    { code: "dni_administrador_detras", prompt: "DNI del administrador o representante por la parte trasera.\nCara con codigos y zona MRZ. Foto completa, sin recortar." },
    { code: "nif_sociedad", prompt: "Necesito el NIF o CIF de la sociedad.\nPuede ser la tarjeta original o un documento oficial donde aparezca el CIF.\nFoto o PDF." },
    { code: "escritura_constitucion", prompt: "Necesito la escritura de constitucion de la sociedad.\nEnviala en PDF si puedes.\nSi no, manda todas las paginas como fotos y escribe LISTO al terminar." },
    { code: "poderes_representante", prompt: "Necesito los poderes del representante.\nEnvialos en PDF si puedes.\nSi no, manda todas las paginas como fotos y escribe LISTO al terminar." },
  ],
  local: [
    { code: "solicitud_firmada", prompt: "Primero la solicitud de alta de EMASESA.\nImprimela, rellenala y firmala. Foto clara o PDF con firma visible." },
    { code: "dni_propietario_delante", prompt: "DNI del propietario por la parte delantera.\nCara con foto y datos personales. Foto completa, buena luz." },
    { code: "dni_propietario_detras", prompt: "DNI del propietario por la parte trasera.\nCara con codigos y zona MRZ. Foto completa, sin recortar." },
    { code: "licencia_o_declaracion", prompt: "Necesito la licencia de apertura o la declaracion responsable del local.\nEnviala en PDF si puedes.\nSi no, manda todas las paginas como fotos y escribe LISTO al terminar." },
  ],
  financiacion: [
    { code: "dni_pagador_delante", prompt: "DNI del pagador por la parte delantera.\nCara con foto y datos personales. Foto completa, buena luz." },
    { code: "dni_pagador_detras", prompt: "DNI del pagador por la parte trasera.\nCara con codigos y zona MRZ. Foto completa, sin recortar." },
    { code: "justificante_ingresos", prompt: "Necesito un justificante de ingresos.\nPuede ser la ultima nomina, pension, o declaracion de la renta.\nFoto o PDF." },
    { code: "titularidad_bancaria", prompt: "Necesito el certificado de titularidad bancaria.\nEs el documento del banco que acredita que eres titular de la cuenta.\nPuede ser PDF o foto clara." },
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

// Helper: devuelve la subcarpeta correcta segun el paso del expediente
function subcarpetaParaPaso(pasoActual, tipoDocumento) {
  if (tipoDocumento === "adicional") return "03_adicional";
  if (pasoActual === "recogida_financiacion") return "02_financiacion";
  return "01_documentacion_base";
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
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:X" });
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
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:X", valueInputOption: "RAW",
    requestBody: { values: [[
      telefono, (datosVecino && datosVecino.comunidad) || "", (datosVecino && datosVecino.vivienda) || "",
      (datosVecino && datosVecino.nombre) || "", "", "pregunta_tipo", "", "pendiente_clasificacion",
      ahora, ahora, ahora, sumarDias(ahora, 20), "", "NO", "ok", "", "", "",
      "", "", "",
      "", "", "no",
    ]] },
  });
}
async function actualizarExpediente(rowIndex, data) {
  // Recalcular motivo_bloqueo_actual automaticamente antes de guardar
  data.motivo_bloqueo_actual = calcularMotivoBloqueActual(data);
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A" + rowIndex + ":X" + rowIndex,
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
      if (normalizarTelefono(row[0] || "") === telNorm &&
          row[3] === tipoDocumento &&
          row[8] === "REPETIR") count++;
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
  propietario: 'Perfecto, ya hemos identificado tu caso: contrato a nombre del propietario.\n\nA continuación te iré pidiendo los documentos uno a uno, pero es recomendable que los tengas preparados desde ahora para agilizar el proceso.\n\nDocumentos que necesitaremos:\n• Solicitud de EMASESA firmada\n• DNI por la parte delantera\n• DNI por la parte trasera\n\nAdicionalmente, si lo tienes disponible, es recomendable aportar:\n• Certificado de empadronamiento\n\nSi no lo tienes ahora, puedes continuar igualmente y aportarlo más adelante.\n\nAquí tienes la solicitud de EMASESA para que puedas rellenarla ahora:\nhttps://drive.google.com/file/d/1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB/view?usp=sharing\n\nLa solicitud puedes completarla de dos formas:\n• En el ordenador: rellénala en PDF y firmala digitalmente.\n• En papel: imprímela, fírmala a mano y hazle una foto.\nEn ambos casos, el documento debe verse completo, sin recortes y con la firma bien visible.\n\nEmpezamos. Envíame primero la Solicitud de EMASESA firmada.',
  familiar: 'Perfecto, ya hemos identificado tu caso: contrato a nombre de un familiar.\n\nA continuación te iré pidiendo los documentos uno a uno, pero es recomendable que los tengas preparados desde ahora.\n\nDocumentos que necesitaremos:\n• Solicitud de EMASESA firmada\n• DNI del familiar por delante y por detrás\n• DNI del propietario por delante y por detrás\n• Libro de familia\n• Documento de autorización firmado por el propietario\n\nAdicionalmente, si lo tienes disponible, es recomendable aportar:\n• Certificado de empadronamiento\n\nSi no lo tienes ahora, puedes continuar igualmente y aportarlo más adelante.\n\nAquí tienes los documentos que deben rellenarse y firmarse:\n\nSolicitud de EMASESA:\nhttps://drive.google.com/file/d/1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB/view?usp=sharing\n\nAutorización de cambio de titularidad (para que la firme el propietario):\nhttps://drive.google.com/file/d/12y2WBseQkjl-JbBqXgx-wm2EjzzRYtMH/view?usp=sharing\n\nLa solicitud puedes completarla de dos formas:\n• En el ordenador: rellénala en PDF y firmala digitalmente.\n• En papel: imprímela, fírmala a mano y hazle una foto.\nEn ambos casos, el documento debe verse completo, sin recortes y con la firma bien visible.\n\nEmpezamos. Envíame primero la Solicitud de EMASESA firmada.',
  inquilino: 'Perfecto, ya hemos identificado tu caso: contrato a nombre del inquilino.\n\nA continuación te iré pidiendo los documentos uno a uno, pero es recomendable que los tengas preparados desde ahora.\n\nDocumentos que necesitaremos:\n• Solicitud de EMASESA firmada\n• DNI del inquilino por delante y por detrás\n• DNI del propietario por delante y por detrás\n• Contrato de alquiler completo y firmado por ambas partes\n\nAdicionalmente, si lo tienes disponible, es recomendable aportar:\n• Certificado de empadronamiento\n\nSi no lo tienes ahora, puedes continuar igualmente y aportarlo más adelante.\n\nAquí tienes la solicitud de EMASESA para que puedas rellenarla ahora:\nhttps://drive.google.com/file/d/1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB/view?usp=sharing\n\nLa solicitud puedes completarla de dos formas:\n• En el ordenador: rellénala en PDF y firmala digitalmente.\n• En papel: imprímela, fírmala a mano y hazle una foto.\nEn ambos casos, el documento debe verse completo, sin recortes y con la firma bien visible.\n\nEmpezamos. Envíame primero la Solicitud de EMASESA firmada.',
  sociedad: 'Perfecto, ya hemos identificado tu caso: contrato a nombre de una sociedad.\n\nA continuación te iré pidiendo los documentos uno a uno, pero es recomendable que los tengas preparados desde ahora.\n\nDocumentos que necesitaremos:\n• Solicitud de EMASESA firmada\n• DNI del administrador o representante por delante y por detrás\n• NIF / CIF de la sociedad\n• Escritura de constitución\n• Poderes del representante\n\nAquí tienes la solicitud de EMASESA para que puedas rellenarla ahora:\nhttps://drive.google.com/file/d/1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB/view?usp=sharing\n\nLa solicitud puedes completarla de dos formas:\n• En el ordenador: rellénala en PDF y firmala digitalmente.\n• En papel: imprímela, fírmala a mano y hazle una foto.\nEn ambos casos, el documento debe verse completo, sin recortes y con la firma bien visible.\n\nEmpezamos. Envíame primero la Solicitud de EMASESA firmada.',
  local: 'Perfecto, ya hemos identificado tu caso: local comercial.\n\nA continuación te iré pidiendo los documentos uno a uno, pero es recomendable que los tengas preparados desde ahora.\n\nDocumentos que necesitaremos:\n• Solicitud de EMASESA firmada\n• DNI del propietario por delante y por detrás\n• Licencia de apertura o declaración responsable\n\nAquí tienes la solicitud de EMASESA para que puedas rellenarla ahora:\nhttps://drive.google.com/file/d/1xbKZOF8Uah_7Yy60v9NFcfa75AhvNEbB/view?usp=sharing\n\nLa solicitud puedes completarla de dos formas:\n• En el ordenador: rellénala en PDF y firmala digitalmente.\n• En papel: imprímela, fírmala a mano y hazle una foto.\nEn ambos casos, el documento debe verse completo, sin recortes y con la firma bien visible.\n\nEmpezamos. Envíame primero la Solicitud de EMASESA firmada.',
};

function buildMensajeBienvenida(tipo) {
  return MENSAJES_BIENVENIDA[tipo] || 'Perfecto. Comenzamos con la recogida de documentacion.';
}

async function handlePreguntaTipo({ res, telefono, msgOriginal, msg, numMedia, datosVecino, expediente }) {
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
      await recalcularYActualizarTodo(expediente);
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

      const docsRecibidosArr = splitList(expediente.documentos_recibidos);
      if (docLargoValido && expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
        docsRecibidosArr.push(expediente.documento_actual);
      }
      expediente.documentos_recibidos = joinList(docsRecibidosArr);
      expediente.fecha_ultimo_contacto = ahoraISO();
      expediente = refrescarResumenDocumental(expediente);

      // Si el documento largo no llego valido, marcar fallo y NO avanzar al cierre
      if (!docLargoValido) {
        expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Las paginas han llegado con problemas y este documento sigue pendiente.\n\n" +
          "Por favor, vuelve a enviarlo por aqui o envialo en un PDF completo.\n" +
          "Cuando lo tengas listo, escribe LISTO de nuevo.");
      }

      const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
      if (siguiente) {
        expediente.documento_actual = siguiente.code;
        expediente.estado_expediente = "en_proceso";
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Documento completo recibido.\n\nSeguimos:\n" + siguiente.prompt);
      } else {
        // Solo pasar a financiacion si no quedan obligatorios pendientes
        const quedanObligatorios = splitList(expediente.documentos_pendientes).length > 0;
        if (quedanObligatorios) {
          expediente.estado_expediente = "en_proceso";
          await recalcularYActualizarTodo(expediente);
          const pendientesLabel = labelsDocumentos(expediente.documentos_pendientes).join("\n• ");
          return responderYLog(res, telefono, msgOriginal, "texto",
            "Documento completo recibido.\n\nAun quedan documentos obligatorios pendientes:\n\n• " +
            pendientesLabel + "\n\nEnvialos directamente por aqui.");
        }
        expediente.paso_actual = "pregunta_financiacion";
        expediente.documento_actual = "";
        expediente.estado_expediente = "documentacion_base_completa";
        await recalcularYActualizarTodo(expediente);
        return responderYLog(res, telefono, msgOriginal, "texto",
          "Documento completo recibido.\n\n" + buildPreguntaFinanciacion());
      }
    }
}

async function handleTextoRecogidaDocumentacion({ res, telefono, msgOriginal, msg, numMedia, expediente }) {
    // ================= TEXTO DURANTE RECOGIDA DOCUMENTACION =================
    if (numMedia === 0 && expediente.paso_actual === "recogida_documentacion") {
      const mensajePlazo = await revisarYAvisarPorPlazo(expediente);
      if (mensajePlazo) return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", mensajePlazo);

      const mn = (msgOriginal || "").trim().toLowerCase();
      // Deteccion robusta de intencion de saltar documento opcional
      // Cubre formatos habituales en WhatsApp sin lista cerrada estricta
      const quiereSaltarOpcional = (function(t) {
        if (!t) return false;
        const patrones = [
          /^no$/i, /^nop$/i, /^no,?\s*(lo\s*)?(tengo|dispongo|encuentro|tengo ahora)/i,
          /^no\s*(puedo|me\s*es\s*posible)/i,
          /^(paso|sigo|siguiente|continua|continuar|seguir|adelante|vamos)/i,
          /^lo\s*mando\s*(despues|luego|mas\s*tarde)/i,
          /no\s*(lo\s*)?(tengo|dispongo)\s*(ahora|de\s*momento)?/i,
          /de\s*momento\s*no/i, /ahora\s*(mismo\s*)?no/i,
        ];
        return patrones.some((p) => p.test(t));
      })(mn);

      if (esDocumentoOpcional(expediente.tipo_expediente, expediente.documento_actual) && quiereSaltarOpcional) {
        expediente.fecha_ultimo_contacto = ahoraISO();
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
            "Perfecto\n\nContinuamos sin ese documento opcional.\n\nSeguimos:\n" + siguiente.prompt);
        } else {
          // Comprobar pendientes obligatorios antes de pasar a financiacion
          expediente = refrescarResumenDocumental(expediente);
          const quedanObligOpcional = splitList(expediente.documentos_pendientes).length > 0;
          if (quedanObligOpcional) {
            expediente.fecha_ultimo_contacto = ahoraISO();
            expediente.estado_expediente = "en_proceso";
            await recalcularYActualizarTodo(expediente);
            const pendOpcLabel = labelsDocumentos(expediente.documentos_pendientes).join("\n• ");
            return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto",
              "Continuamos sin ese documento opcional.\n\nAun quedan documentos pendientes:\n\n• " +
              pendOpcLabel + "\n\nEnvialos directamente por aqui.");
          }
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
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
        expediente.fecha_ultimo_contacto = ahoraISO();
        expediente = refrescarResumenDocumental(expediente);
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
      const respuestaIA = await responderConIA(msgOriginal, expediente);
      return responderYLog(res, telefono, msgOriginal || "sin_texto", "texto", respuestaIA);
    }
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
          const docsRArr = splitList(expediente.documentos_recibidos);
          if (!docsRArr.includes(docFallido)) {
            docsRArr.push(docFallido);
            expediente.documentos_recibidos = joinList(docsRArr);
            expediente = refrescarResumenDocumental(expediente);
          }
          expediente.fecha_ultimo_contacto = ahoraISO();

          // Avanzar el flujo igual que si el documento hubiera llegado bien en el flujo normal
          const docFallidoLabel = labelDocumento(docFallido);
          const msgReintentoBase = resultadoPrueba.estadoDocumento === "OK"
            ? docFallidoLabel + " recibido correctamente.\n\nDocumento pendiente resuelto."
            : docFallidoLabel + " recibido, lo revisaremos internamente.";

          // El docFallido puede ser distinto del documento_actual actual
          // (el vecino reenvio el fallido mientras el flujo ya habia avanzado)
          // En ese caso solo resolver el pendiente, no cambiar documento_actual
          if (expediente.documento_actual && expediente.documento_actual !== docFallido) {
            await recalcularYActualizarTodo(expediente);
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\nAhora seguimos con:\n• " +
              labelDocumento(expediente.documento_actual) + "\n\nNo hace falta reenviar lo anterior.");
          }

          // El docFallido era el documento_actual: avanzar flujo
          const siguienteReintento = getNextStep(
            expediente.paso_actual === "recogida_financiacion" ? "financiacion" : expediente.tipo_expediente,
            docFallido
          );
          if (siguienteReintento) {
            expediente.documento_actual = siguienteReintento.code;
            expediente.estado_expediente = "en_proceso";
            await recalcularYActualizarTodo(expediente);
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\nSeguimos con:\n" + siguienteReintento.prompt);
          } else {
            // Era el ultimo documento — verificar pendientes antes de cerrar
            const quedanRein = splitList(expediente.documentos_pendientes).length > 0;
            if (quedanRein) {
              expediente.estado_expediente = "en_proceso";
              await recalcularYActualizarTodo(expediente);
              const pendReinLabel = labelsDocumentos(expediente.documentos_pendientes).join("\n• ");
              return responderYLog(res, telefono, "archivo", "archivo",
                msgReintentoBase + "\n\nAun quedan documentos pendientes:\n\n• " + pendReinLabel +
                "\n\nEnvialos directamente por aqui.");
            }
            // Separar cierre segun si estamos en financiacion o en documentacion base
            if (expediente.paso_actual === "recogida_financiacion") {
              expediente.paso_actual = "finalizado";
              expediente.documento_actual = "";
              expediente.estado_expediente = "pendiente_estudio_financiacion";
              await recalcularYActualizarTodo(expediente);
              return responderYLog(res, telefono, "archivo", "archivo",
                msgReintentoBase + "\n\nHemos recibido toda la documentacion de financiacion. Nuestro equipo la revisara y te avisara.");
            }
            expediente.paso_actual = "pregunta_financiacion";
            expediente.documento_actual = "";
            expediente.estado_expediente = "documentacion_base_completa";
            await recalcularYActualizarTodo(expediente);
            return responderYLog(res, telefono, "archivo", "archivo",
              msgReintentoBase + "\n\n" + buildPreguntaFinanciacion());
          }
        }
        // Si el archivo no encaja como reintento, seguir con flujo normal
        // y limpiar la ventana si ha cambiado de contexto
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
      const tipoParaSheet = resultado.tipoDetectado || documentoAValidar || "pendiente_clasificar";
      const origenParaSheet = resultado.contextoDoc === "sin_clasificar" ? "flujo_sin_clasificar"
        : (resultado.contextoDoc === "diferente_flujo" || resultado.contextoDoc === "ajeno") ? "flujo_diferente"
        : "flujo";
      try {
        await guardarDocumentoSheet(telefono, datosVecino.comunidad, datosVecino.vivienda,
          tipoParaSheet,
          resultado.fileName, resultado.file.webViewLink || "", origenParaSheet, resultado.estadoDocumento, resultado.motivo);
      } catch (err) { console.error("ERROR guardarDoc flujo:", err.message); }

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

      // DOCUMENTO LARGO EN PDF — siempre REVISAR, pero avanza
      if (expediente.paso_actual === "recogida_documentacion" && esDocumentoLargo && esPDF) {
        // Solo marcar recibido si es OK o REVISAR Y el doc coincide con el esperado
        const docCoincidePDF = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
        if (resultado.estadoDocumento !== "REPETIR" && docCoincidePDF) {
          if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
            docsRecibidosArr.push(expediente.documento_actual);
          }
          expediente.documentos_recibidos = joinList(docsRecibidosArr);
          expediente = limpiarReintento(expediente);
        } else if (resultado.estadoDocumento === "REPETIR") {
          expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
        }
        expediente = refrescarResumenDocumental(expediente);
        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguiente ? siguiente.prompt : null, fallosDocActual || 0, documentoAValidar);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          // Solo pasar a financiacion si no quedan obligatorios pendientes
          const quedanObligPDF = splitList(expediente.documentos_pendientes).length > 0;
          if (quedanObligPDF) {
            expediente.estado_expediente = "en_proceso";
            await recalcularYActualizarTodo(expediente);
            const pendientesLabelPDF = labelsDocumentos(expediente.documentos_pendientes).join("\n• ");
            return responderYLog(res, telefono, "archivo", "archivo",
              msgVecino + "\n\nAun quedan documentos obligatorios pendientes:\n\n• " +
              pendientesLabelPDF + "\n\nEnvialos directamente por aqui.");
          }
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            msgVecino + "\n\n" + buildPreguntaFinanciacion());
        }
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
      // Solo se marca como recibido si:
      //   - el estado es OK o REVISAR (no REPETIR)
      //   - Y el documento detectado coincide con el esperado (contextoDoc === "coincide")
      // Si el doc real es distinto del esperado, guardamos el archivo pero NO avanzamos
      // como si hubiera llegado el documento correcto.
      // "sin_clasificar" = PDF importante sin clasificacion visual, se deja pasar pero se marca
      const docCoincideConEsperado = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
      if (resultado.estadoDocumento !== "REPETIR" && docCoincideConEsperado) {
        if (expediente.documento_actual && !docsRecibidosArr.includes(expediente.documento_actual)) {
          docsRecibidosArr.push(expediente.documento_actual);
        }
        expediente = limpiarReintento(expediente);
      } else if (resultado.estadoDocumento === "REPETIR") {
        expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
        // Contar fallos reales para ajustar mensaje e intervencion
        try {
          fallosDocActual = await contarFallosDocumento(telefono, expediente.documento_actual);
          if (fallosDocActual >= 3) expediente.requiere_intervencion_humana = "si";
        } catch (e) { console.error("Error contando fallos:", e.message); }
      }
      // Si contextoDoc es "diferente_flujo" o "ajeno": el archivo se guarda en Sheets
      // pero NO se marca como recibido el documento esperado ni se avanza el flujo normalmente
      // Solo actualizar documentos_recibidos si hubo cambio real (doc coincide o fue aceptado)
      if (docCoincideConEsperado && resultado.estadoDocumento !== "REPETIR") {
        expediente.documentos_recibidos = joinList(docsRecibidosArr);
      }
      expediente = refrescarResumenDocumental(expediente);

      if (expediente.paso_actual === "recogida_documentacion") {
        // Si el documento recibido no coincide con el esperado, NO avanzar flujo.
        // Informar al vecino y pedir el documento correcto.
        if (!docCoincideConEsperado) {
          // Documento fuera de orden (diferente_flujo o ajeno):
          // Lo guardamos en Sheets/Drive (ya hecho arriba) pero NO lo marcamos como recibido valido.
          // El unico mecanismo para resolver un documento anterior es la logica de reintento
          // (hayReintentoVigente + validacion correcta). Fuera de esa ventana, el documento
          // queda trazado en Sheets con origen "flujo_diferente" para revision humana.
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const docRecibidoLabel = resultado.tipoDetectado ? labelDocumento(resultado.tipoDetectado) : "un documento distinto";
          const docEsperadoLabel = labelDocumento(expediente.documento_actual);
          const msgFueraOrden = resultado.contextoDoc === "diferente_flujo"
            ? "Hemos recibido " + docRecibidoLabel + " y lo hemos guardado para revision.\n\nAhora mismo necesitamos:\n\n• " + docEsperadoLabel
            : "Hemos recibido " + docRecibidoLabel + ", pero en este momento necesitamos:\n\n• " + docEsperadoLabel;
          return responderYLog(res, telefono, "archivo", "archivo",
            msgFueraOrden + "\n\nPuedes enviarlo directamente por aqui.");
        }

        const siguiente = getNextStep(expediente.tipo_expediente, expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguiente ? siguiente.prompt : null, fallosDocActual || 0, documentoAValidar);
        if (siguiente) {
          expediente.documento_actual = siguiente.code;
          expediente.estado_expediente = "en_proceso";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          // Solo pasar a financiacion si no quedan obligatorios pendientes
          const quedanObligNormal = splitList(expediente.documentos_pendientes).length > 0;
          if (quedanObligNormal) {
            expediente.estado_expediente = "en_proceso";
            await recalcularYActualizarTodo(expediente);
            const pendientesLabel2 = labelsDocumentos(expediente.documentos_pendientes).join("\n• ");
            return responderYLog(res, telefono, "archivo", "archivo",
              msgVecino + "\n\nAun quedan documentos obligatorios pendientes:\n\n• " +
              pendientesLabel2 + "\n\nEnvialos directamente por aqui.");
          }
          expediente.paso_actual = "pregunta_financiacion";
          expediente.documento_actual = "";
          expediente.estado_expediente = "documentacion_base_completa";
          expediente = refrescarResumenDocumental(expediente);
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            msgVecino + (resultado.estadoDocumento === "OK" ? "\n\n" : " ") + buildPreguntaFinanciacion());
        }
      }

      if (expediente.paso_actual === "recogida_financiacion") {
        // Mismo bloqueo que en recogida_documentacion: si el doc no coincide, no avanzar
        const docCoincideFinanciacion = resultado.contextoDoc === "coincide" || resultado.contextoDoc === "sin_clasificar" || !resultado.contextoDoc;
        if (!docCoincideFinanciacion) {
          // Mismo criterio que en documentacion: no auto-marcar como recibido.
          // Solo trazado en Sheets con origen "flujo_diferente" para revision humana.
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          const docRecibidoFinLabel = resultado.tipoDetectado ? labelDocumento(resultado.tipoDetectado) : "un documento distinto";
          const docEsperadoFinLabel = labelDocumento(expediente.documento_actual);
          const msgFueraOrdenFin = resultado.contextoDoc === "diferente_flujo"
            ? "Hemos recibido " + docRecibidoFinLabel + " y lo hemos guardado para revision.\n\nAhora mismo necesitamos:\n\n• " + docEsperadoFinLabel
            : "Hemos recibido " + docRecibidoFinLabel + ", pero ahora necesitamos:\n\n• " + docEsperadoFinLabel;
          return responderYLog(res, telefono, "archivo", "archivo",
            msgFueraOrdenFin + "\n\nPuedes enviarlo directamente por aqui.");
        }
        const siguienteFin = getNextStep("financiacion", expediente.documento_actual);
        const msgVecino = mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, siguienteFin ? siguienteFin.prompt : null, fallosDocActual || 0, documentoAValidar);
        // Marcar o limpiar reintento tambien en financiacion
        if (resultado.estadoDocumento === "REPETIR") {
          expediente = marcarDocumentoFallido(expediente, expediente.documento_actual);
        } else {
          expediente = limpiarReintento(expediente);
        }
        if (siguienteFin) {
          expediente.documento_actual = siguienteFin.code;
          expediente.estado_expediente = "pendiente_financiacion";
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo", msgVecino);
        } else {
          expediente.paso_actual = "finalizado";
          expediente.documento_actual = "";
          expediente.estado_expediente = "pendiente_estudio_financiacion";
          expediente.fecha_ultimo_contacto = ahoraISO();
          expediente = refrescarResumenDocumental(expediente);
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            "Perfecto\n\nHemos recibido toda la documentacion base y la de financiacion. Nuestro equipo la revisara y te avisara si necesita algo mas.");
        }
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

// ================= SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log("Servidor corriendo en puerto", PORT); });
