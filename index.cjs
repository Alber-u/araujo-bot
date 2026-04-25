const express = require("express");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
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

  // financiacion_lista: mensaje directo sin plantilla
  if (tipo === "financiacion_lista") {
    const baseUrl = process.env.BASE_URL || "https://araujo-bot.onrender.com";
    const enlace = baseUrl + "/vecino?token=" + (process.env.ADMIN_TOKEN || "") + "&t=" + encodeURIComponent(datos.telefono || "");
    const msg = "\uD83D\uDCCA *Nuevo expediente listo para estudio de financiaci\u00f3n*\n\n"
      + "Comunidad: " + (datos.comunidad || "-") + "\n"
      + "Vivienda: " + (datos.vivienda || "-") + "\n"
      + "Vecino: " + (datos.nombre || "-") + "\n"
      + "Tel\u00e9fono: " + (datos.telefono || "-") + "\n\n"
      + "\u2705 Documentaci\u00f3n principal completa\n"
      + "\u2705 Documentaci\u00f3n de financiaci\u00f3n completa\n\n"
      + "Acci\u00f3n: Revisar documentaci\u00f3n y tramitar financiaci\u00f3n.\n\n"
      + "Enlace expediente:\n" + enlace;
    for (const tel of tels) {
      try { await enviarWhatsApp(tel, msg); } catch(e) { console.error("Error notif financiacion:", e.message); }
    }
    return;
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

  // Notificar al equipo cuando el expediente pasa a pendiente_estudio_financiacion (solo una vez)
  if (
    expediente.estado_expediente === "pendiente_estudio_financiacion" &&
    expediente.notificacion_financiacion_enviada !== "SI"
  ) {
    expediente.notificacion_financiacion_enviada = "SI";
    notificarEquipo("financiacion_lista", {
      nombre: expediente.nombre,
      comunidad: expediente.comunidad,
      vivienda: expediente.vivienda,
      telefono: expediente.telefono,
    }).catch(e => console.error("Error notif financiacion:", e.message));
    console.log("NOTIF: financiacion_lista enviada para", expediente.telefono);
  }

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

    // POLÍTICA: último evento manda con estas prioridades:
    // 1. OK siempre gana sobre REPETIR/REVISAR anterior (el doc fue aceptado)
    // 2. REPETIR manual gana sobre OK automático anterior (el operario lo rechazó)
    // 3. Entre estados iguales → el más reciente gana (mayor fila)
    const ORIGENES_MANUALES = ["validacion_manual", "rechazo_manual"];
    const estadoPorTipoRaw = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (normalizarTelefono(row[0] || "") !== telNorm) continue;
      const tipo   = row[3] || "";
      const estado = row[8] || "OK";
      const origen = row[7] || "";
      if (!tipo || tipo === "adicional" || tipo === "pendiente_clasificar") continue;
      const esManual = ORIGENES_MANUALES.includes(origen);
      const previo   = estadoPorTipoRaw[tipo];
      if (!previo) { estadoPorTipoRaw[tipo] = { estado, esManual, fila: i }; continue; }
      // OK siempre mejora sobre estado peor anterior
      const nuevoEsOK = estado === "OK";
      const previoEsOK = previo.estado === "OK";
      const actualizar =
        (nuevoEsOK && !previoEsOK)                              // OK nuevo gana sobre no-OK previo
        || (!nuevoEsOK && esManual && previoEsOK && !previo.esManual) // REPETIR manual gana sobre OK automático
        || (!nuevoEsOK && esManual && !previoEsOK && i > previo.fila) // REPETIR manual más reciente
        || (!nuevoEsOK && !esManual && !previoEsOK && !previo.esManual && i > previo.fila); // automático más reciente
      if (actualizar) estadoPorTipoRaw[tipo] = { estado, esManual, fila: i };
    }
    const estadoPorTipo = Object.fromEntries(
      Object.entries(estadoPorTipoRaw).map(([t, d]) => [t, d.estado])
    );

    // Excluir REPETIR de documentos opcionales — no deben bloquear el expediente
    const opcionalesDelTipo = (REQUIRED_DOCS[expediente.tipo_expediente] || {}).opcionales || [];
    const estadosReales = Object.entries(estadoPorTipo)
      .filter(([tipo, estado]) => {
        if (estado === "REPETIR" && opcionalesDelTipo.includes(tipo)) return false;
        return true;
      })
      .map(([, estado]) => estado);

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
    }
    // Si el estado quedó limpio, limpiar también los campos de bloqueo
    if (nuevoEstado && !estadosSucios.includes(nuevoEstado) && nuevoEstado !== "expediente_con_documento_a_repetir") {
      // Solo limpiar si el ultimo_documento_fallido ya no está en REPETIR
      const docFallido = expediente.ultimo_documento_fallido;
      const sigueSiendoFallido = docFallido && estadoPorTipo[docFallido] === "REPETIR";
      if (!sigueSiendoFallido) {
        expediente.ultimo_documento_fallido = "";
        expediente.fecha_ultimo_fallo = "";
        expediente.reintento_hasta = "";
        expediente.motivo_bloqueo_actual = "";
        expediente.requiere_intervencion_humana = "no";
      }
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

// ===== Analizar PDF con IA (nota simple, contratos) =====
async function llamarIAconPDF(systemPrompt, pdfBase64, timeout) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Analiza este documento PDF." },
            { type: "image_url", image_url: { url: "data:application/pdf;base64," + pdfBase64 } },
          ]},
        ],
      },
      {
        timeout: timeout || 20000,
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      }
    );
    const texto = response?.data?.choices?.[0]?.message?.content || "";
    const limpio = texto.replace(/```json|```/g, "").trim();
    try { return JSON.parse(limpio); } catch(e) { console.error("JSON IA PDF invalido:", texto); return null; }
  } catch(error) {
    console.error("Error IA PDF:", error?.response ? JSON.stringify(error.response.data) : error.message);
    return null;
  }
}

// ===== DNI — usa gpt-4o para mayor precisión en cara delantera/trasera =====
async function llamarGPT4oConImagen(systemPrompt, base64) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 100,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Analiza este documento." },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } },
          ]},
        ],
      },
      { timeout: IA_TIMEOUT_MS, headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" } }
    );
    const texto = resp?.data?.choices?.[0]?.message?.content || "";
    return JSON.parse(texto.replace(/```json|```/g, "").trim());
  } catch(e) { console.error("Error gpt-4o imagen:", e.message); return null; }
}

async function analizarDNIconIA(buffer, documentoActual) {
  const base64 = buffer.toString("base64");
  const PROMPT_DNI = "Analiza esta imagen de un DNI espanol. Responde SOLO en JSON:\n{\"tipo\": \"dni_delante | dni_detras | otro | dudoso\", \"confianza\": 0-100}\n\nPASO 1 — Busca una cara humana fotografiada en la imagen:\n- Si YES hay foto de rostro humano real → dni_delante\n- Si NO hay foto de rostro humano → continua al paso 2\n\nPASO 2 — Busca alguno de estos elementos (todos indican la parte trasera):\n- Tres filas de letras y numeros al pie (zona MRZ): empieza por IDESPCL, ARA, o similar\n- Chip dorado rectangular en la esquina\n- Texto con DOMICILIO, LUGAR DE NACIMIENTO, HIJO/A DE\n- Codigo de barras\nSi encuentras cualquiera de estos → dni_detras\n\nIMPORTANTE: La palabra DNI en grande, escudo de Espana, o la bandera NO indican que sea la parte delantera. Esos elementos aparecen en AMBAS caras. Solo la foto de rostro humano indica la parte delantera.";
  const resultado = await llamarGPT4oConImagen(PROMPT_DNI, base64);
  console.log("DNI clasificacion gpt-4o:", { documentoActual, resultado });
  if (!resultado) return { estadoDocumento: "REVISAR", motivo: "no se pudo verificar el DNI automaticamente" };

  if (resultado.tipo === "otro") return { estadoDocumento: "REPETIR", motivo: "no parece un DNI" };
  if (resultado.tipo === "dudoso") return { estadoDocumento: "REVISAR", motivo: "no se pudo verificar completamente el DNI" };
  if (documentoActual && documentoActual.includes("delante") && resultado.tipo === "dni_detras") {
    const labelDoc = labelDocumento(documentoActual);
    return { estadoDocumento: "REPETIR", motivo: "has enviado la parte trasera del DNI, pero ahora necesitamos la delantera (con la foto). La trasera la pediremos justo después" };
  }
  if (documentoActual && documentoActual.includes("detras") && resultado.tipo === "dni_delante") {
    const labelDoc = labelDocumento(documentoActual);
    return { estadoDocumento: "REPETIR", motivo: "has enviado la parte delantera del DNI, pero ahora necesitamos la trasera (con el chip dorado y el código de barras)" };
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
  // Buscar todas las subcarpetas del padre y filtrar en JS — evita problemas de encoding
  const res = await drive.files.list({
    q: "'" + parentId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id, name)",
    orderBy: "createdTime asc",
    pageSize: 50
  });
  if (!res.data.files || !res.data.files.length) return null;
  const nombreNorm = nombre.toLowerCase().replace(/_/g, ' ').trim();
  // Buscar coincidencia exacta o con espacios/guiones equivalentes
  const matches = res.data.files.filter(f => {
    const fn = f.name.toLowerCase().replace(/_/g, ' ').trim();
    return fn === nombreNorm;
  });
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  // Múltiples: elegir la que tenga contenido
  for (const carpeta of matches) {
    const contenido = await drive.files.list({
      q: "'" + carpeta.id + "' in parents and trashed=false",
      fields: "files(id)", pageSize: 1
    });
    if (contenido.data.files && contenido.data.files.length > 0) return carpeta;
  }
  return matches[0];
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
  console.log("[DRIVE] comunidad:", comunidad, "->", carpetaComunidad.id, carpetaComunidad.name);

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
  console.log("[DRIVE] vivienda:", vivienda, "->", carpetaVivienda.id, carpetaVivienda.name);

  // Nivel 4 (opcional): subcarpeta dentro de vivienda
  if (!subcarpeta) return carpetaVivienda.id;
  let carpetaSub = await buscarCarpeta(subcarpeta, carpetaVivienda.id);
  if (!carpetaSub) carpetaSub = await crearCarpeta(subcarpeta, carpetaVivienda.id);
  console.log("[DRIVE] subcarpeta:", subcarpeta, "->", carpetaSub.id, carpetaSub.name);
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
        notificacion_financiacion_enviada: row[25] || "",
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
      data.notificacion_financiacion_enviada || "",
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
      // CRÍTICO: usar documentoActual (esperado por expediente), no tipoDetectado
      // tipoDetectado puede ser la clasificación general y confundir delante/detrás en DNI
      const tipoParaAnalizar = documentoActual;
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

    // Politica: ultimo estado manda, manual gana sobre automatico
    const ORIGENES_MANUALES_REC = ["validacion_manual", "rechazo_manual"];
    const estadoPorTipoRec = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tel = normalizarTelefono(row[0] || "");
      const tipoDoc = row[3] || "";
      const estado = row[8] || "OK";
      const origen = row[7] || "";
      if (tel !== telNorm) continue;
      if (!docsDelFlujo.has(tipoDoc)) continue;
      const esManual = ORIGENES_MANUALES_REC.includes(origen);
      const previo = estadoPorTipoRec[tipoDoc];
      const actualizar = !previo
        || (esManual && !previo.esManual)
        || (esManual && previo.esManual && i > previo.fila)
        || (!esManual && !previo.esManual && i > previo.fila);
      if (actualizar) estadoPorTipoRec[tipoDoc] = { estado, esManual, fila: i };
    }
    // Solo cuentan como recibidos los que tienen estado OK o REVISAR vigente
    const recibidos = new Set();
    for (const [tipo, { estado }] of Object.entries(estadoPorTipoRec)) {
      if (estado === "OK" || estado === "REVISAR") recibidos.add(tipo);
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
          // Usar documentoAValidar (el que se pedía) para el título — no el detectado
          expediente.fecha_ultimo_contacto = ahoraISO();
          await recalcularYActualizarTodo(expediente);
          return responderYLog(res, telefono, "archivo", "archivo",
            mensajeParaVecino(resultado.estadoDocumento, resultado.motivo, null, fallosDocActual || 0, documentoAValidar));
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

    const resultadoNota = await llamarIAconPDF(prompt, notaBase64, 20000);

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

      // Buscar nota simple usando la misma función global que generarPdfEmasesa
      try {
        const notaSimpleObj = await obtenerUrlNotaSimple(expediente);

        if (!notaSimpleObj) {
          resultado.estado = "sin_nota";
          resultado.resumen = "\u23F3 Sin nota simple todav\u00eda";
          sinNotaCount++;
          resultados.push(resultado);
          continue;
        }

        const pdfFiles = [{ id: notaSimpleObj.id, name: "nota_simple.pdf" }];

        // Descargar y analizar nota simple con IA
        const pdfResp = await drive.files.get({ fileId: pdfFiles[0].id, alt: "media" }, { responseType: "arraybuffer" });
        const pdfBuffer = Buffer.from(pdfResp.data);
        const notaBase64 = pdfBuffer.toString("base64");

        const promptNota = "Eres un experto en notas simples del Registro de la Propiedad espa\u00f1ol.\n" +
          "Extrae los datos del titular del inmueble. Responde SOLO en JSON:\n" +
          '{"titular": "nombre completo", "nif": "NIF si aparece o null", "direccion": "direcci\u00f3n completa o null"}';

        const datosNota = await llamarIAconPDF(promptNota, notaBase64, 20000);

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
        range: "expedientes!A" + rowIndex + ":Z" + rowIndex,
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
    .nav-brand img { height: 28px; width: 28px; object-fit: contain; }
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="font-size:22px;font-weight:700">${comunidad}</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:2px">${expedientes.length} expedientes</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="cruzarNotas()" class="btn btn-secondary" id="btnNota">
            🔍 Cruzar notas simples
          </button>
          <a href="/generar-pdfs-comunidad?token=${tk}&comunidad=${encodeURIComponent(comunidad)}" target="_blank" class="btn btn-secondary">
            📄 Generar expedientes EMASESA
          </a>
        </div>
      </div>

      <!-- RESULTADO NOTA SIMPLE (oculto hasta pulsar) -->
      <div id="notaResultado" style="display:none;margin-bottom:16px"></div>

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

        async function cruzarNotas() {
          const btn = document.getElementById('btnNota');
          const div = document.getElementById('notaResultado');
          btn.textContent = '⏳ Analizando notas simples...';
          btn.disabled = true;
          try {
            const resp = await fetch('/revisar-comunidad?token=${token}&comunidad=${encodeURIComponent(comunidad)}');
            const data = await resp.json();
            if (!data.viviendas) {
              div.innerHTML = '<div class="card" style="color:#dc2626">' + (data.mensaje || 'Error al analizar') + '</div>';
              div.style.display = 'block';
              return;
            }
            const colores = { ok: '#f0fdf4', discordancia: '#fef2f2', error_lectura: '#fef2f2', sin_nota: '#fffbeb', incompleto: '#f3f4f6' };
            const iconos = { ok: '✅', discordancia: '🔴', error_lectura: '🔴', sin_nota: '🟡', incompleto: '⚪' };
            const labels = { ok: 'Coincide', discordancia: 'Discordancia', error_lectura: 'Error lectura', sin_nota: 'Sin nota', incompleto: 'Incompleto' };
            let html = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
              + '<div class="card-title" style="margin-bottom:0">🔍 Cruce con nota simple</div>'
              + '<div style="display:flex;gap:10px;font-size:12px;color:#6b7280">'
              + '<span>✅ ' + (data.resumen.listos||0) + ' OK</span>'
              + '<span>🔴 ' + (data.resumen.discordancias||0) + ' discordancias</span>'
              + '<span>🟡 ' + (data.resumen.sin_nota||0) + ' sin nota</span>'
              + '<span>⚪ ' + (data.resumen.incompletos||0) + ' incompletos</span>'
              + '</div></div>';
            html += '<table class="tabla"><thead><tr><th>Vivienda</th><th>Vecino</th><th>Titular nota</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>';
            data.viviendas.forEach(v => {
              const bg = colores[v.estado] || '#f3f4f6';
              const ic = iconos[v.estado] || '⚪';
              const lb = labels[v.estado] || v.estado;
              const disc = v.discordancias && v.discordancias.length ? v.discordancias.join(', ') : '';
              html += '<tr style="background:' + bg + '">'
                + '<td><strong>' + (v.vivienda||'—') + '</strong></td>'
                + '<td>' + (v.nombre||'—') + '</td>'
                + '<td style="color:#6b7280;font-size:12px">' + (v.titular_nota||'—') + '</td>'
                + '<td><span class="badge ' + (v.estado==='ok'?'badge-verde':v.estado==='sin_nota'?'badge-amarillo':v.estado==='incompleto'?'badge-gris':'badge-rojo') + '">' + ic + ' ' + lb + '</span></td>'
                + '<td style="font-size:12px;color:#dc2626">' + disc + '</td>'
                + '</tr>';
            });
            html += '</tbody></table></div>';
            div.innerHTML = html;
            div.style.display = 'block';
          } catch(e) {
            div.innerHTML = '<div class="card" style="color:#dc2626">Error: ' + e.message + '</div>';
            div.style.display = 'block';
          } finally {
            btn.textContent = '🔍 Cruzar notas simples';
            btn.disabled = false;
          }
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
        .map(d => ({ tipo: d[3]||"documento", nombre: d[4]||"", fecha: (d[5]||"").slice(0,10), url: d[6]||"", origen: d[7]||"", estado: d[8]||"OK", motivo: d[9]||"" }));
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

    // ---- Construir dos secciones de documentos ----
    const pasoActual = r[5] || "";
    const esFinanciacion = pasoActual === "recogida_financiacion" || pasoActual === "pregunta_financiacion";
    const tipoExp = r[4] || "propietario";
    const DOCS_FINANCIACION_TIPOS = ["dni_pagador_delante","dni_pagador_detras","justificante_ingresos","titularidad_bancaria"];

    // Sección 1: documentación base — siempre visible
    // Usar el FLOW del tipo de expediente como fuente de verdad del orden
    const flowBase = (FLOWS[tipoExp] || []).map(f => f.code);
    // Añadir cualquier doc recibido que no esté en el flow (por si acaso)
    const recibidosBase = (r[15]||"").split(",").map(d=>d.trim()).filter(d => d && !DOCS_FINANCIACION_TIPOS.includes(d));
    const tiposBase = [...new Set([...flowBase, ...recibidosBase])];

    // Sección 2: documentación financiación — visible si está en esa fase o hay docs subidos
    const hayDocsFinanciacionSubidos = docsSubidos.some(d => DOCS_FINANCIACION_TIPOS.includes(d.tipo));
    const mostrarFinanciacion = pasoActual === "recogida_financiacion"
      || pasoActual === "pregunta_financiacion"
      || hayDocsFinanciacionSubidos;

    const tiposFinanciacion = mostrarFinanciacion ? DOCS_FINANCIACION_TIPOS : [];

    // Para compatibilidad con el código de renderizado
    const todosLosTipos = [...tiposBase]; // usado solo si hace falta lista plana

    // Para cada tipo: mismo criterio que calcularEstadoExpedienteEnMemoria
    // "último evento manda, manual gana sobre automático"
    // URL: si el estado vigente no tiene URL, usar la última URL real disponible
    const ORIGENES_MANUALES_VISTA = ["validacion_manual", "rechazo_manual"];
    const urlPorTipo = {};
    for (const d of docsSubidos) {
      if (d.url) urlPorTipo[d.tipo] = d.url; // última URL real por tipo
    }
    const docsMapaRaw = {}; // tipo -> { d, esManual, idx }
    docsSubidos.forEach((d, idx) => {
      const esManual = ORIGENES_MANUALES_VISTA.includes(d.origen || "");
      const previo   = docsMapaRaw[d.tipo];
      if (!previo) { docsMapaRaw[d.tipo] = { d, esManual, idx }; return; }
      const nuevoEsOK = d.estado === "OK";
      const previoEsOK = previo.d.estado === "OK";
      // OK gana sobre no-OK anterior; REPETIR manual gana sobre OK automático anterior
      const actualizar =
        (nuevoEsOK && !previoEsOK)
        || (!nuevoEsOK && esManual && previoEsOK && !previo.esManual)
        || (!nuevoEsOK && esManual && !previoEsOK)
        || (!nuevoEsOK && !esManual && !previoEsOK && !previo.esManual && idx > previo.idx);
      if (actualizar) docsMapaRaw[d.tipo] = { d, esManual, idx };
    });
    const docsMapa = Object.fromEntries(
      Object.entries(docsMapaRaw).map(([tipo, { d }]) => [tipo, { ...d, url: d.url || urlPorTipo[tipo] || "" }])
    );

    // Construir lista unificada con estado visual
    const docsUnificados = todosLosTipos.map(tipo => {
      // Si el estado vigente no tiene URL, usar la última URL real disponible
      const subidoRaw = docsMapa[tipo];
      const subido = subidoRaw ? { ...subidoRaw, url: subidoRaw.url || urlPorTipo[tipo] || "" } : null;
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

    // Recalcular bloqueo REAL desde docsMapa (ya tiene política último-manda)
    const hayRepetirActivo = Object.values(docsMapa).some(d => d.estado === "REPETIR");
    // Estados que significan expediente OK — nunca mostrar como bloqueado
    const ESTADOS_OK = ["pendiente_estudio_financiacion", "documentacion_base_completa",
      "expediente_revisado", "expediente_limpio", "completo_pendiente_tramitacion", "finalizado"];
    const esEstadoOK = ESTADOS_OK.some(s => estado.includes(s));
    const estadoReal = esEstadoOK ? estado
      : hayRepetirActivo ? "expediente_con_documento_a_repetir"
      : estado.includes("repetir") ? "en_proceso" : estado;

    // ---- Detectar acción principal automática ----
    const docProblema = docsUnificados.find(d => d.estadoDoc === "rechazado" || d.estadoDoc === "revision");
    let accionPrincipal = null;

    // Estado positivo — expediente completo y listo para equipo interno
    if (esEstadoOK && !hayRepetirActivo) {
      accionPrincipal = {
        tipo: "completo",
        titulo: estado.includes("financiacion") ? "\uD83D\uDCCA Expediente listo para estudio de financiaci\u00f3n" : "\u2705 Documentaci\u00f3n completa",
        descripcion: estado.includes("financiacion") ? "Toda la documentaci\u00f3n est\u00e1 validada. El equipo interno puede iniciar el estudio." : "El expediente est\u00e1 completo y validado.",
        botones: []
      };
    } else if (r[23] === "si") {
      accionPrincipal = {
        tipo: "urgente",
        titulo: `🚨 ${docActual ? docActual + ' — bloquea el expediente' : 'Expediente bloqueado'}`,
        descripcion: (r[22] || "Este expediente requiere atenci\u00f3n manual para continuar."),
        botones: [
          { label: "\uD83D\uDCE9 Forzar recordatorio ahora", url: "/accion/recordatorio-doc?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docActual || ""), clase: "btn-primary" }
        ]
      };
    } else if (docProblema && docProblema.estadoDoc === "rechazado") {
      accionPrincipal = {
        tipo: "repetir",
        titulo: `❌ ${docProblema.tipo} — Rechazado`,
        descripcion: docProblema.motivo || "El documento no es válido.",
        botones: [
          docProblema.subido?.url ? { label: "👁 Ver documento", url: docProblema.subido.url, clase: "btn-secondary", blank: true } : null,
          { label: "\uD83D\uDCE9 Forzar recordatorio ahora", url: "/accion/recordatorio-doc?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docActual || ""), clase: "btn-primary" }
        ].filter(Boolean)
      };
    } else if (docProblema && docProblema.estadoDoc === "revision") {
      accionPrincipal = {
        tipo: "revision",
        titulo: `⚠️ ${docProblema.tipo} — Pendiente de revisión`,
        descripcion: docProblema.motivo || "Revisar manualmente antes de continuar.",
        botones: [
          docProblema.subido?.url ? { label: "👁 Ver documento", url: docProblema.subido.url, clase: "btn-secondary", blank: true } : null,
          { label: "\u2714 Validar", url: "/accion/validar?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docProblema ? docProblema.tipo : docActual || ""), clase: "btn-primary" },
          { label: "\u274C Pedir repetici\u00f3n", url: "/accion/repetir-doc?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docProblema ? docProblema.tipo : docActual || ""), clase: "btn-danger" }
        ].filter(Boolean)
      };
    } else if (horasUltimo > 72 && docActual) {
      accionPrincipal = {
        tipo: "recordatorio",
        titulo: "\uD83D\uDCF2 Sin respuesta hace " + Math.floor(horasUltimo/24) + " d\u00edas",
        descripcion: "Est\u00e1 esperando enviar: " + labelDocumento(docActual),
        botones: [
          { label: "\uD83D\uDCE9 Forzar recordatorio ahora", url: "/accion/recordatorio-doc?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docActual || ""), clase: "btn-primary" }
        ]
      };
    } else if (docActual && !docsMapa[docActual]) {
      accionPrincipal = {
        tipo: "recordatorio",
        titulo: "\uD83D\uDCC4 Esperando: " + labelDocumento(docActual),
        descripcion: "El vecino a\u00fan no ha enviado este documento.",
        botones: [
          { label: "\uD83D\uDCE9 Forzar recordatorio ahora", url: "/accion/recordatorio-doc?token=" + tk + "&t=" + tv + "&doc=" + encodeURIComponent(docActual), clase: "btn-primary" }
        ]
      };
    }

    const colorBorde = hayRepetirActivo ? "#dc2626"
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
        ${(function() {
          // Solo mostrar bloqueo si el documento bloqueante es de la fase activa
          const esBloqueoFinanciacion = DOCS_FINANCIACION_TIPOS.includes(docActual);
          const esBloqueoBase = !esBloqueoFinanciacion;
          if ((estadoReal.includes('repetir')||estadoReal.includes('bloqueado')) && docActual && esBloqueoBase) {
            return `<div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border-radius:8px;display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">\u26D4</span>
              <div>
                <div style="color:#dc2626;font-weight:700;font-size:13px">Documentaci\u00f3n principal bloqueada</div>
                <div style="color:#7f1d1d;font-size:12px;margin-top:1px">Falta corregir: <strong>${labelDocumento(docActual)}</strong></div>
              </div>
            </div>`;
          }
          if ((estadoReal.includes('repetir')||estadoReal.includes('bloqueado')) && docActual && esBloqueoFinanciacion) {
            return `<div style="margin-top:12px;padding:10px 14px;background:#fff7ed;border-radius:8px;display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">\uD83D\uDCCB</span>
              <div>
                <div style="color:#ea580c;font-weight:700;font-size:13px">Financiaci\u00f3n bloqueada</div>
                <div style="color:#7c2d12;font-size:12px;margin-top:1px">Falta corregir: <strong>${labelDocumento(docActual)}</strong></div>
              </div>
            </div>`;
          }
          if (estadoReal.includes('revision') && docActual) {
            return `<div style="margin-top:12px;padding:10px 14px;background:#fffbeb;border-radius:8px;display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">\u26A0\uFE0F</span>
              <div>
                <div style="color:#d97706;font-weight:700;font-size:13px">Revisi\u00f3n pendiente</div>
                <div style="color:#78350f;font-size:12px;margin-top:1px">Validar manualmente: <strong>${labelDocumento(docActual)}</strong></div>
              </div>
            </div>`;
          }
          return '';
        })()}
      </div>

      <!-- PROGRESO EXPEDIENTE -->
      ${(function() {
        // Incluir docs de financiación en el total si está en esa fase
        // Calcular progreso con tiposBase + financiación si aplica
        const tiposProgreso = esFinanciacion
          ? [...tiposBase, ...DOCS_FINANCIACION_TIPOS]
          : tiposBase;
        const opcionalesExp = (REQUIRED_DOCS[tipoExp] || {}).opcionales || [];
        const totalDocs = tiposProgreso.filter(t => !opcionalesExp.includes(t)).length;
        const okDocs = tiposProgreso.filter(t => {
          const sub = docsMapa[t];
          return sub && sub.estado === "OK";
        }).length;
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
      ${accionPrincipal ? `<div class="card" style="border-left:4px solid ${accionPrincipal.tipo==='completo' ? '#16a34a' : accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir' ? '#dc2626' : accionPrincipal.tipo==='revision' ? '#d97706' : '#f59e0b'};background:${accionPrincipal.tipo==='completo' ? '#f0fdf4' : accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir' ? '#fef9f9' : accionPrincipal.tipo==='revision' ? '#fffdf5' : '#fffbeb'}">
        <div style="font-size:10px;font-weight:700;color:${accionPrincipal.tipo==='urgente'||accionPrincipal.tipo==='repetir'?'#dc2626':accionPrincipal.tipo==='revision'?'#d97706':'#f59e0b'};text-transform:uppercase;letter-spacing:0.7px;margin-bottom:10px">\u26A1 Acci\u00f3n ahora</div>
        <div style="margin-bottom:14px">
          <div style="font-size:13px;color:#6b7280;margin-bottom:2px">Documento incorrecto</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${accionPrincipal.titulo}</div>
          <div style="font-size:13px;font-weight:600;color:#1a1d23">\uD83D\uDC49 Acci\u00f3n: ${accionPrincipal.tipo==='repetir'||accionPrincipal.tipo==='urgente'?'Pedir repetici\u00f3n del documento':accionPrincipal.tipo==='revision'?'Validar o pedir repetici\u00f3n':'Forzar recordatorio'}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${accionPrincipal.botones.map(b => `<a href="${b.url}" ${b.blank?'target="_blank"':''} class="btn ${b.clase}">${b.label}</a>`).join('')}
        </div>
      </div>` : ''}

      <!-- DOCUMENTOS: DOS SECCIONES (BASE + FINANCIACIÓN) -->
      ${(function() {
        // Función que convierte un tipo de documento en una fila HTML
        function buildDocRow(tipo) {
          const subido = docsMapa[tipo];
          const esPendiente = (r[16]||"").includes(tipo);
          const esOpcional = (r[17]||"").includes(tipo) && !esPendiente;
          const esActual = tipo === docActual;
          const esFinanciacionDoc = DOCS_FINANCIACION_TIPOS.includes(tipo);
          let estadoDoc, estadoLabel, colorLabel, motivo = "";
          if (!subido) {
            estadoDoc = esOpcional ? "opcional" : "pendiente";
            estadoLabel = esOpcional ? "Opcional" : "Pendiente";
            colorLabel = esOpcional ? "#7c3aed" : "#6b7280";
          } else if (subido.estado === "OK") {
            estadoDoc = "ok"; estadoLabel = "Correcto"; colorLabel = "#16a34a";
          } else if (subido.estado === "REVISAR") {
            estadoDoc = "revision"; estadoLabel = "En revisi\u00f3n"; colorLabel = "#d97706"; motivo = subido.motivo||"";
          } else {
            estadoDoc = "rechazado"; estadoLabel = "Rechazado"; colorLabel = "#dc2626"; motivo = subido.motivo||"";
          }
          const iconEstado = { ok:"\uD83D\uDFE2", revision:"\uD83D\uDFE1", rechazado:"\uD83D\uDD34", pendiente:"\u26AA", opcional:"\uD83D\uDD35" }[estadoDoc] || "\u26AA";
          const esBloqueante = estadoDoc === "rechazado" && esActual;
          const bgRow = esBloqueante ? "#fff5f5" : estadoDoc === "revision" ? "#fffdf0" : esActual ? "#f8faff" : "transparent";
          const verBtn = subido?.url ? '<a href="' + subido.url + '" target="_blank" class="btn btn-sm btn-secondary">\uD83D\uDC41\uFE0F Ver</a>' : "";
          const tieneArchivo = !!subido;
          const validarBtn = tieneArchivo ? '<a href="/accion/validar?token=' + tk + '&t=' + tv + '&doc=' + encodeURIComponent(tipo) + '" class="btn btn-sm btn-success">\u2714 Validar</a>' : "";
          const motivoEnc = motivo ? encodeURIComponent(motivo) : "";
          const repetirBtn = tieneArchivo ? '<a href="/accion/repetir-doc?token=' + tk + '&t=' + tv + '&doc=' + encodeURIComponent(tipo) + '&motivo=' + motivoEnc + '" class="btn btn-sm btn-danger">\u274C Repetir</a>' : "";
          const label = labelDocumento(tipo);
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f3f4f6;gap:10px;background:' + bgRow + ';border-radius:' + (esBloqueante?"8px":"0") + ';margin-bottom:' + (esBloqueante?"4px":"0") + '">'
            + '<div style="min-width:0;flex:1">'
            + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
            + '<span style="font-size:16px">' + iconEstado + '</span>'
            + '<span style="font-size:14px;font-weight:600">' + label + '</span>'
            + (esBloqueante ? '<span style="background:#dc2626;color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">BLOQUEANTE</span>' : esActual ? '<span style="background:#2563eb;color:white;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">SIGUIENTE</span>' : "")
            + '</div>'
            + '<div style="margin-top:4px;margin-left:24px">'
            + '<span style="font-size:12px;color:' + colorLabel + ';font-weight:600">' + (estadoLabel === "Pendiente" ? "Pendiente \u2014 a\u00fan no enviado" : estadoLabel) + '</span>'
            + (motivo ? '<span style="font-size:12px;color:#6b7280"> \u00b7 ' + motivo + '</span>' : "")
            + '</div>'
            + (subido?.fecha ? '<div style="font-size:11px;color:#9ca3af;margin-left:24px;margin-top:2px">' + subido.fecha + '</div>' : "")
            + '</div>'
            + '<div style="display:flex;gap:6px;flex-shrink:0;align-items:center">' + verBtn + validarBtn + repetirBtn + '</div>'
            + '</div>';
        }

        const htmlBase = tiposBase.map(buildDocRow).join("");
        const htmlFin  = tiposFinanciacion.map(buildDocRow).join("");

        return '<div class="card">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
          + '<div class="card-title" style="margin-bottom:0">\uD83D\uDCCB Documentaci\u00f3n principal</div>'
          + '<a href="' + driveUrl + '" target="_blank" class="btn btn-sm btn-secondary">\uD83D\uDCC1 Drive</a>'
          + '</div>'
          + htmlBase
          + '</div>'
          + (mostrarFinanciacion && tiposFinanciacion.length
            ? '<div class="card"><div class="card-title">\uD83D\uDCCB Documentaci\u00f3n financiaci\u00f3n</div>' + htmlFin + '</div>'
            : "");
      })()}

      

      <!-- BLOQUE 4: MODO AVANZADO -->
      <div class="card">
        <button class="btn-avanzado" onclick="const el=document.getElementById('av');el.classList.toggle('abierto');this.textContent=el.classList.contains('abierto')?'▲ Ocultar modo avanzado':'⚙️ Modo avanzado'">⚙️ Modo avanzado</button>
        <div id="av" class="avanzado">
          <div class="seccion">Mensajes manuales</div>
          <div class="avanzado-grid" style="grid-template-columns:1fr 1fr">
            <a href="/accion/avisar?token=${tk}&t=${tv}" class="avanzado-btn">📩 Avisar cliente</a>
            <a href="/accion/estado?token=${tk}&t=${tv}&v=expediente_revisado" class="avanzado-btn">\u2705 Marcar revisado</a>
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
    // Buscar la URL real del último archivo subido para ese tipo
    let urlReal = "";
    try {
      const dataBusq = await getSheetsClient().spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:J",
      });
      const telNormBusq = normalizarTelefono(expedienteBase.telefono);
      const filasBusq = (dataBusq.data.values || []).slice(1)
        .filter(d => normalizarTelefono(d[0]||"") === telNormBusq && d[3] === tipoDoc && d[6]);
      if (filasBusq.length > 0) urlReal = filasBusq[filasBusq.length - 1][6]; // última URL real
    } catch(e) { console.error("Error buscando URL real:", e.message); }

    await guardarDocumentoSheet(
      expedienteBase.telefono, expedienteBase.comunidad, expedienteBase.vivienda,
      tipoDoc, "validado_manual_crm", urlReal, "validacion_manual", "OK", ""
    );
    await actualizarCampoExpediente(telefono, 22, "no");
    await actualizarCampoExpediente(telefono, 18, "");
    console.log("procesarAccionDocumento: OK registrado para", tipoDoc, "url:", urlReal ? "ok" : "vacía");
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


// ===== ENDPOINTS CRM ADICIONALES =====

app.get("/accion/desbloquear", async (req, res) => {
  const token = req.query.token, t = req.query.t;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    await actualizarCampoExpediente(t, 22, "no"); // requiere_intervencion_humana
    await actualizarCampoExpediente(t, 18, "");    // ultimo_documento_fallido
    await actualizarCampoExpediente(t, 7, "en_proceso"); // estado_expediente
    console.log("CRM: desbloqueado", t);
  } catch(e) { console.error("Error desbloquear:", e.message); }
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});

app.get("/accion/estado", async (req, res) => {
  const token = req.query.token, t = req.query.t, v = req.query.v;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try { await actualizarCampoExpediente(t, 7, v); console.log("CRM estado:", t, v); } catch(e) {}
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});

app.get("/accion/documento", async (req, res) => {
  const token = req.query.token, t = req.query.t, v = req.query.v;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try { await actualizarCampoExpediente(t, 6, v); console.log("CRM documento:", t, v); } catch(e) {}
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});

app.get("/accion/tipo", async (req, res) => {
  const token = req.query.token, t = req.query.t, v = req.query.v;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try { await actualizarCampoExpediente(t, 4, v); console.log("CRM tipo:", t, v); } catch(e) {}
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});

app.get("/accion/avisar", async (req, res) => {
  const token = req.query.token, t = req.query.t;
  const msg = req.query.msg || "Hola, te escribimos de Instalaciones Araujo. ¿Necesitas ayuda con tu documentación?";
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    await enviarWhatsApp(t, msg);
    await guardarContacto(t, "aviso_manual", "bot", msg);
    console.log("CRM: aviso manual enviado a", t);
  } catch(e) { console.error("Error avisar:", e.message); }
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});


// Recordatorio manual — envía el prompt del documento actual sin cambiar estados
app.get("/accion/recordatorio-doc", async (req, res) => {
  const token = req.query.token;
  const t = req.query.t;
  const doc = req.query.doc || "";
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const expediente = await buscarExpedientePorTelefono(t);
    if (expediente && doc) {
      const label = labelDocumento(doc);
      const prompt = getPromptPasoActual({ ...expediente, documento_actual: doc });
      const msg = "\uD83D\uDC49 Seguimos esperando:\n\n*" + label + "*\n\n"
        + (prompt ? prompt.split("\n").slice(0, 4).join("\n") : "Puedes enviarlo cuando lo tengas por aqu\u00ed.");
      await enviarWhatsApp(t, msg);
      await guardarContacto(t, "recordatorio_manual", "bot", msg);
      console.log("CRM: recordatorio-doc enviado a", t, doc);
    }
  } catch(e) { console.error("Error recordatorio-doc:", e.message); }
  res.redirect("/vecino?token=" + encodeURIComponent(token) + "&t=" + encodeURIComponent(t));
});


// ================= PDF EXPEDIENTE EMASESA =================

// Extrae el fileId de Drive de una URL de Drive
function extraerDriveFileId(url) {
  if (!url) return null;
  // Formatos posibles:
  // https://drive.google.com/file/d/ID/view
  // https://drive.google.com/open?id=ID
  // https://drive.google.com/uc?id=ID
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function obtenerDocumentosVigentesOK(telefono) {
  const sheets = getSheetsClient();
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "documentos!A:J",
  });
  const telNorm = normalizarTelefono(telefono);
  const ORIGENES_MANUALES = ["validacion_manual", "rechazo_manual"];
  const mapaRaw = {};
  (data.data.values || []).slice(1).forEach((row, idx) => {
    if (normalizarTelefono(row[0]||"") !== telNorm) return;
    const tipo = row[3]||"", estado = row[8]||"OK", origen = row[7]||"";
    const urlRaw = row[6]||"";
    if (!tipo || tipo === "adicional" || tipo === "pendiente_clasificar") return;
    const esManual = ORIGENES_MANUALES.includes(origen);
    const fileId = extraerDriveFileId(urlRaw);
    const previo = mapaRaw[tipo];
    if (!previo) { mapaRaw[tipo] = { tipo, estado, url: urlRaw, id: fileId, esManual, idx }; return; }
    const nuevoOK = estado === "OK", previoOK = previo.estado === "OK";
    const act = (nuevoOK && !previoOK) || (!nuevoOK && esManual && previoOK && !previo.esManual)
      || (!nuevoOK && esManual && !previoOK) || (!nuevoOK && !esManual && !previoOK && !previo.esManual && idx > previo.idx);
    if (act) mapaRaw[tipo] = { tipo, estado, url: urlRaw, id: fileId, esManual, idx };
  });
  return Object.values(mapaRaw);
}

// También buscar la nota simple desde Drive
async function obtenerUrlNotaSimple(expediente) {
  try {
    const drive = getDriveClient();
    const vivienda = (expediente.vivienda || "").toLowerCase().trim();

    // Buscar directamente desde la raíz de Drive por nombre de carpeta nota_simple
    // que esté dentro de una carpeta cuyo nombre coincida con la vivienda
    // Usamos búsqueda global de Drive — más fiable que navegar la jerarquía
    const busq = await drive.files.list({
      q: `name contains 'nota' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name,parents)", pageSize: 50
    });
    console.log("[NOTA] carpetas nota encontradas globalmente:", (busq.data.files||[]).map(f=>f.name));

    // Filtrar: buscar la que esté dentro de la carpeta de la vivienda correcta
    for (const carpNota of (busq.data.files||[])) {
      // Verificar que el padre de esta carpeta nota es la vivienda correcta
      if (!carpNota.parents || !carpNota.parents.length) continue;
      const parentId = carpNota.parents[0];
      // Obtener info del padre para verificar que es la vivienda
      const parentInfo = await drive.files.get({ fileId: parentId, fields: "id,name,parents" }).catch(()=>null);
      if (!parentInfo) continue;
      const parentName = (parentInfo.data.name||"").toLowerCase().replace(/_/g,' ').trim();
      console.log("[NOTA] carpeta nota:", carpNota.name, "-> padre:", parentInfo.data.name);
      if (parentName !== vivienda) continue;

      // Encontrada — buscar PDFs dentro
      const busqPDF = await drive.files.list({
        q: `'${carpNota.id}' in parents and trashed=false`,
        fields: "files(id,name,mimeType)", pageSize: 10
      });
      const pdfs = (busqPDF.data.files||[]).filter(f => f.mimeType==='application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      console.log("[NOTA] PDFs en", carpNota.name, ":", pdfs.map(f=>f.name));
      if (pdfs.length) return { tipo: "nota_simple", estado: "OK", url: `https://drive.google.com/uc?export=download&id=${pdfs[0].id}`, id: pdfs[0].id };
    }
    console.log("[NOTA] no encontrada para vivienda:", vivienda);
    return null;
  } catch(e) { console.error("[NOTA] Error:", e.message); return null; }
}

function filtrarDocumentosEmasesa(documentos) {
  const TIPOS_EMASESA = [
    "solicitud_firmada","dni_delante","dni_detras",
    "dni_propietario_delante","dni_propietario_detras",
    "dni_inquilino_delante","dni_inquilino_detras",
    "dni_familiar_delante","dni_familiar_detras",
    "contrato_alquiler","empadronamiento","libro_familia",
    "autorizacion_familiar","nif_sociedad","escritura_constitucion",
    "poderes_representante","licencia_o_declaracion"
  ];
  return documentos.filter(d => d.estado === "OK" && TIPOS_EMASESA.includes(d.tipo));
}

function ordenarDocumentosParaEmasesa(tipo, docs, notaSimple) {
  const orden = {
    propietario: ["solicitud_firmada","dni_delante","dni_detras","nota_simple","empadronamiento"],
    inquilino: ["solicitud_firmada","dni_propietario_delante","dni_propietario_detras","dni_inquilino_delante","dni_inquilino_detras","contrato_alquiler","nota_simple","empadronamiento"],
    familiar: ["solicitud_firmada","dni_delante","dni_detras","dni_familiar_delante","dni_familiar_detras","libro_familia","autorizacion_familiar","nota_simple","empadronamiento"],
    sociedad: ["solicitud_firmada","nif_sociedad","escritura_constitucion","poderes_representante","licencia_o_declaracion","nota_simple"],
    local: ["solicitud_firmada","nif_sociedad","escritura_constitucion","poderes_representante","licencia_o_declaracion","nota_simple"],
  };
  const lista = [...docs];
  if (notaSimple) lista.push(notaSimple);
  return (orden[tipo] || orden.propietario)
    .map(t => lista.find(d => d.tipo === t))
    .filter(Boolean);
}

function validarExpedienteParaPdf(expediente, docs) {
  const tipos = docs.map(d => d.tipo);
  if (!tipos.includes("solicitud_firmada")) return { ok: false, error: "Falta la solicitud firmada de EMASESA" };
  if (!tipos.includes("nota_simple")) return { ok: false, error: "Falta la nota simple — s\u00fabela a la carpeta 04_nota_simple en Drive" };
  if (expediente.tipo_expediente === "familiar" && !tipos.includes("libro_familia") && !tipos.includes("autorizacion_familiar")) {
    return { ok: false, error: "Falta acreditaci\u00f3n familiar (libro de familia o autorizaci\u00f3n)" };
  }
  return { ok: true };
}

async function generarPdfEmasesa(expediente, docs) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // PORTADA
  const portada = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = portada.getSize();
  portada.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.31, 0.27, 0.9) });
  portada.drawText("EXPEDIENTE PLAN 5 EMASESA", { x: 40, y: height - 50, size: 18, font: fontBold, color: rgb(1,1,1) });
  portada.drawText("Instalaciones Araujo", { x: 40, y: height - 68, size: 11, font, color: rgb(0.9,0.9,1) });
  let y = height - 140;
  const campo = (label, valor) => {
    portada.drawText(label + ":", { x: 40, y, size: 11, font: fontBold, color: rgb(0.4,0.4,0.4) });
    portada.drawText(valor || "—", { x: 160, y, size: 11, font, color: rgb(0.1,0.1,0.1) });
    y -= 24;
  };
  campo("Comunidad", expediente.comunidad);
  campo("Vivienda", expediente.vivienda);
  campo("Vecino", expediente.nombre);
  campo("Tel\u00e9fono", expediente.telefono);
  campo("Tipo expediente", expediente.tipo_expediente);
  campo("Fecha generaci\u00f3n", new Date().toLocaleDateString("es-ES"));
  y -= 20;
  portada.drawText("Documentos incluidos:", { x: 40, y, size: 12, font: fontBold, color: rgb(0.2,0.2,0.2) });
  y -= 20;
  docs.forEach((d, i) => {
    portada.drawText((i+1) + ". " + labelDocumento(d.tipo), { x: 55, y, size: 11, font, color: rgb(0.3,0.3,0.3) });
    y -= 18;
  });

  // DOCUMENTOS
  const drive = getDriveClient();
  for (const doc of docs) {
    if (!doc.url && !doc.id) continue;
    try {
      let bytes;
      if (doc.id) {
        // Descargar directamente por fileId desde Drive — más fiable que URL
        const resp = await drive.files.get({ fileId: doc.id, alt: "media" }, { responseType: "arraybuffer" });
        bytes = Buffer.from(resp.data);
      } else if (doc.url) {
        const resp = await axios.get(doc.url, { responseType: "arraybuffer", timeout: 15000,
          headers: { Authorization: "Bearer " + (await getSheetsClient().auth.getAccessToken()).token }
        });
        bytes = Buffer.from(resp.data);
      } else {
        console.error("Doc sin URL ni id:", doc.tipo);
        continue;
      }

      // Intentar como PDF primero
      try {
        const pdfExt = await PDFDocument.load(bytes);
        const pages = await pdfDoc.copyPages(pdfExt, pdfExt.getPageIndices());
        pages.forEach(p => pdfDoc.addPage(p));
        continue;
      } catch {}

      // Intentar como imagen
      try {
        let embedded;
        try { embedded = await pdfDoc.embedJpg(bytes); } catch { embedded = await pdfDoc.embedPng(bytes); }
        const imgPage = pdfDoc.addPage([595, 842]);
        const { width: w, height: h } = imgPage.getSize();
        const dims = embedded.scaleToFit(w - 40, h - 40);
        imgPage.drawImage(embedded, { x: (w - dims.width)/2, y: (h - dims.height)/2, width: dims.width, height: dims.height });
      } catch(e2) { console.error("Error embediendo imagen doc", doc.tipo, e2.message); }
    } catch(e) { console.error("Error descargando doc", doc.tipo, e.message); }
  }

  return Buffer.from(await pdfDoc.save());
}

async function subirPdfExpedienteADrive(pdfBuffer, expediente) {
  const datosVecino = { nombre: expediente.nombre, comunidad: expediente.comunidad, vivienda: expediente.vivienda, bloque: expediente.bloque||"", telefono: expediente.telefono };
  const carpetaId = await getOrCreateCarpetaVivienda(datosVecino, null);
  const drive = getDriveClient();
  const nombre = "Expediente_EMASESA_" + expediente.comunidad.replace(/\s+/g,"_") + "_" + expediente.vivienda + "_" + new Date().toISOString().slice(0,10) + ".pdf";
  const { Readable } = require("stream");
  const stream = new Readable();
  stream.push(pdfBuffer);
  stream.push(null);
  const file = await drive.files.create({
    requestBody: { name: nombre, parents: [carpetaId], mimeType: "application/pdf" },
    media: { mimeType: "application/pdf", body: stream },
    fields: "id,webViewLink"
  });
  return file.data.webViewLink;
}

// Endpoint principal
app.post("/generar-pdf-expediente", async (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).json({ ok: false, error: "No autorizado" });
  const telefono = req.body.telefono || req.query.t;
  if (!telefono) return res.status(400).json({ ok: false, error: "Falta tel\u00e9fono" });
  try {
    const expediente = await buscarExpedientePorTelefono(telefono);
    if (!expediente) return res.status(404).json({ ok: false, error: "Expediente no encontrado" });
    const docsRaw = await obtenerDocumentosVigentesOK(telefono);
    const docsFiltrados = filtrarDocumentosEmasesa(docsRaw);
    const notaSimple = await obtenerUrlNotaSimple(expediente);
    const docsOrdenados = ordenarDocumentosParaEmasesa(expediente.tipo_expediente, docsFiltrados, notaSimple);
    const validacion = validarExpedienteParaPdf(expediente, docsOrdenados);
    if (!validacion.ok) return res.json({ ok: false, error: validacion.error });
    console.log("Generando PDF EMASESA para", telefono, "con", docsOrdenados.length, "documentos");
    const pdfBuffer = await generarPdfEmasesa(expediente, docsOrdenados);
    const url = await subirPdfExpedienteADrive(pdfBuffer, expediente);
    console.log("PDF generado y subido:", url);
    return res.json({ ok: true, url });
  } catch(e) {
    console.error("Error generando PDF EMASESA:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint GET para lanzar desde el navegador (panel)
app.get("/generar-pdf-expediente", async (req, res) => {
  const token = req.query.token;
  const t = req.query.t;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  try {
    const expediente = await buscarExpedientePorTelefono(t);
    if (!expediente) return res.status(404).send("Expediente no encontrado");
    const docsRaw = await obtenerDocumentosVigentesOK(t);
    const docsFiltrados = filtrarDocumentosEmasesa(docsRaw);
    const notaSimple = await obtenerUrlNotaSimple(expediente);
    const docsOrdenados = ordenarDocumentosParaEmasesa(expediente.tipo_expediente, docsFiltrados, notaSimple);
    const validacion = validarExpedienteParaPdf(expediente, docsOrdenados);
    if (!validacion.ok) return res.send('<script>alert("' + validacion.error + '");history.back();</script>');
    const pdfBuffer = await generarPdfEmasesa(expediente, docsOrdenados);
    const url = await subirPdfExpedienteADrive(pdfBuffer, expediente);
    res.redirect(url);
  } catch(e) {
    console.error("Error generando PDF:", e.message);
    res.send('<script>alert("Error: ' + e.message.replace(/"/g,"") + '");history.back();</script>');
  }
});


// Generar PDFs para toda una comunidad — uno por vivienda
app.get("/generar-pdfs-comunidad", async (req, res) => {
  const token = req.query.token;
  const comunidad = req.query.comunidad;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");
  if (!comunidad) return res.status(400).send("Falta comunidad");
  try {
    const sheets = getSheetsClient();
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "expedientes!A:Z",
    });
    const expedientes = (data.data.values || []).slice(1)
      .filter(r => (r[1]||"").trim().toUpperCase() === comunidad.trim().toUpperCase())
      .map(r => ({
        rowIndex: 0, telefono: r[0]||"", comunidad: r[1]||"", vivienda: r[2]||"",
        nombre: r[3]||"", tipo_expediente: r[4]||"propietario", bloque: "",
        documentos_completos: r[13]||"NO"
      }))
      .sort((a,b) => (a.vivienda||"").localeCompare(b.vivienda||""));

    if (!expedientes.length) return res.send("<h2>No hay expedientes en esta comunidad</h2>");

    // Un único PDF para toda la comunidad
    const pdfComunidad = await PDFDocument.create();
    const fontH = await pdfComunidad.embedFont(StandardFonts.Helvetica);
    const fontB = await pdfComunidad.embedFont(StandardFonts.HelveticaBold);

    // Portada de la comunidad
    const portadaCom = pdfComunidad.addPage([595, 842]);
    const { width: pw, height: ph } = portadaCom.getSize();
    portadaCom.drawRectangle({ x: 0, y: ph - 100, width: pw, height: 100, color: rgb(0.18, 0.27, 0.75) });
    portadaCom.drawText("EXPEDIENTES PLAN 5 EMASESA", { x: 40, y: ph - 52, size: 20, font: fontB, color: rgb(1,1,1) });
    portadaCom.drawText("Instalaciones Araujo", { x: 40, y: ph - 74, size: 12, font: fontH, color: rgb(0.8,0.85,1) });
    portadaCom.drawText("Comunidad: " + comunidad, { x: 40, y: ph - 140, size: 14, font: fontB, color: rgb(0.1,0.1,0.3) });
    portadaCom.drawText("Fecha: " + new Date().toLocaleDateString("es-ES"), { x: 40, y: ph - 165, size: 12, font: fontH, color: rgb(0.4,0.4,0.4) });
    portadaCom.drawText("N\u00famero de expedientes: " + expedientes.length, { x: 40, y: ph - 188, size: 12, font: fontH, color: rgb(0.4,0.4,0.4) });

    // Índice
    portadaCom.drawText("Expedientes incluidos:", { x: 40, y: ph - 230, size: 13, font: fontB, color: rgb(0.2,0.2,0.2) });
    let yi = ph - 255;
    expedientes.forEach((exp, i) => {
      portadaCom.drawText((i+1) + ". Vivienda " + exp.vivienda + " — " + exp.nombre, { x: 55, y: yi, size: 11, font: fontH, color: rgb(0.3,0.3,0.3) });
      yi -= 20;
    });

    const resultados = [];
    for (const exp of expedientes) {
      if (!exp.telefono) continue;
      try {
        const docsRaw = await obtenerDocumentosVigentesOK(exp.telefono);
        const docsFiltrados = filtrarDocumentosEmasesa(docsRaw);
        const notaSimple = await obtenerUrlNotaSimple(exp);
        const docsOrdenados = ordenarDocumentosParaEmasesa(exp.tipo_expediente, docsFiltrados, notaSimple);
        const validacion = validarExpedienteParaPdf(exp, docsOrdenados);
        if (!validacion.ok) {
          resultados.push({ vivienda: exp.vivienda, nombre: exp.nombre, ok: false, error: validacion.error });
          continue;
        }

        // Separador / portada de vivienda con lista de documentos
        const sepPage = pdfComunidad.addPage([595, 842]);
        const { width: sw, height: sh } = sepPage.getSize();
        // Cabecera azul
        sepPage.drawRectangle({ x: 0, y: sh - 130, width: sw, height: 130, color: rgb(0.18, 0.27, 0.75) });
        sepPage.drawText("Vivienda " + exp.vivienda, { x: 30, y: sh - 52, size: 24, font: fontB, color: rgb(1,1,1) });
        sepPage.drawText(exp.nombre, { x: 30, y: sh - 82, size: 15, font: fontH, color: rgb(0.85,0.9,1) });
        sepPage.drawText("Tipo: " + exp.tipo_expediente + "   ·   Tel: " + exp.telefono, { x: 30, y: sh - 108, size: 11, font: fontH, color: rgb(0.7,0.75,0.95) });
        // Lista de documentos incluidos
        let yd = sh - 165;
        sepPage.drawText("Documentos incluidos en este expediente:", { x: 30, y: yd, size: 12, font: fontB, color: rgb(0.18,0.27,0.75) });
        yd -= 8;
        sepPage.drawLine({ start: { x: 30, y: yd }, end: { x: sw - 30, y: yd }, thickness: 1, color: rgb(0.85,0.87,0.95) });
        yd -= 22;
        docsOrdenados.forEach((doc, i) => {
          // Bullet punto
          sepPage.drawCircle({ x: 40, y: yd + 4, size: 3, color: rgb(0.18,0.27,0.75) });
          sepPage.drawText((i + 1) + ".  " + labelDocumento(doc.tipo), { x: 52, y: yd, size: 11, font: fontH, color: rgb(0.15,0.15,0.15) });
          yd -= 20;
        });
        // Total docs
        yd -= 8;
        sepPage.drawLine({ start: { x: 30, y: yd }, end: { x: sw - 30, y: yd }, thickness: 1, color: rgb(0.85,0.87,0.95) });
        yd -= 18;
        sepPage.drawText("Total: " + docsOrdenados.length + " documento" + (docsOrdenados.length !== 1 ? "s" : ""), { x: 30, y: yd, size: 11, font: fontB, color: rgb(0.4,0.4,0.4) });

        // Añadir documentos de esta vivienda al PDF de comunidad
        const pdfVivienda = await generarPdfEmasesa(exp, docsOrdenados);
        const pdfVivDoc = await PDFDocument.load(pdfVivienda);
        // Saltar la portada individual (página 0) — ya tenemos el separador
        const indices = pdfVivDoc.getPageIndices().slice(1);
        if (indices.length) {
          const pages = await pdfComunidad.copyPages(pdfVivDoc, indices);
          pages.forEach(p => pdfComunidad.addPage(p));
        }

        resultados.push({ vivienda: exp.vivienda, nombre: exp.nombre, ok: true, docs: docsOrdenados.length });
        console.log("Vivienda añadida al PDF comunidad:", exp.vivienda, docsOrdenados.length, "docs");
      } catch(e) {
        resultados.push({ vivienda: exp.vivienda, nombre: exp.nombre, ok: false, error: e.message });
        console.error("Error vivienda", exp.vivienda, e.message);
      }
    }

    const ok = resultados.filter(r => r.ok).length;
    const err = resultados.filter(r => !r.ok).length;

    if (!ok) {
      const filas = resultados.map(r => `<tr><td><strong>${r.vivienda}</strong></td><td>${r.nombre}</td><td style="color:#dc2626">\u274C Error</td><td style="font-size:12px;color:#dc2626">${r.error||""}</td></tr>`).join('');
      return res.send(H.page(token, 'comunidades', 'PDFs EMASESA',
        [{ label: 'Comunidades', url: '/panel' }, { label: comunidad, url: '/panel-comunidad?comunidad=' + encodeURIComponent(comunidad) }],
        `<div class="card"><h2>Sin expedientes v\u00e1lidos</h2><table class="tabla"><thead><tr><th>Vivienda</th><th>Vecino</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${filas}</tbody></table></div>`
      ));
    }

    // Subir PDF único a Drive en la carpeta de la comunidad
    const pdfBytes = Buffer.from(await pdfComunidad.save());
    const drive = getDriveClient();
    const nombreArchivo = "Expedientes_EMASESA_" + comunidad.replace(/\s+/g,"_") + "_" + new Date().toISOString().slice(0,10) + ".pdf";

    // Buscar carpeta comunidad en Drive
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const comunidadSan = sanitizarNombreCarpeta(comunidad);
    let carpetaCom = await buscarCarpeta(comunidadSan, rootId);
    if (!carpetaCom) carpetaCom = await buscarCarpeta(comunidad, rootId);
    const parentId = carpetaCom ? carpetaCom.id : rootId;

    const { Readable } = require("stream");
    const stream = new Readable(); stream.push(pdfBytes); stream.push(null);
    const file = await drive.files.create({
      requestBody: { name: nombreArchivo, parents: [parentId], mimeType: "application/pdf" },
      media: { mimeType: "application/pdf", body: stream },
      fields: "id,webViewLink"
    });
    const urlPdf = file.data.webViewLink;
    console.log("PDF comunidad subido:", urlPdf);

    const filas = resultados.map(r => {
      if (r.ok) return `<tr><td><strong>${r.vivienda}</strong></td><td>${r.nombre}</td><td>\u2705 Incluido</td><td style="color:#6b7280;font-size:12px">${r.docs} documentos</td></tr>`;
      return `<tr><td><strong>${r.vivienda}</strong></td><td>${r.nombre}</td><td style="color:#dc2626">\u274C Omitido</td><td style="font-size:12px;color:#dc2626">${r.error||""}</td></tr>`;
    }).join('');

    res.send(H.page(token, 'comunidades', 'PDFs EMASESA',
      [{ label: 'Comunidades', url: '/panel' }, { label: comunidad, url: '/panel-comunidad?comunidad=' + encodeURIComponent(comunidad) }, { label: 'PDF', url: '' }],
      `<div style="margin-bottom:20px">
        <h1 style="font-size:22px;font-weight:700">\uD83D\uDCC4 Expedientes EMASESA — ${comunidad}</h1>
        <p style="color:#6b7280;font-size:14px;margin-top:4px">\u2705 ${ok} viviendas incluidas · \u274C ${err} omitidas</p>
      </div>
      <div class="card" style="background:#f0fdf4;border-left:4px solid #16a34a;padding:20px;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:8px">\uD83D\uDCC4 PDF generado correctamente</div>
        <a href="${urlPdf}" target="_blank" class="btn btn-success" style="font-size:15px">Abrir PDF completo de la comunidad</a>
      </div>
      <div class="card">
        <table class="tabla">
          <thead><tr><th>Vivienda</th><th>Vecino</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`
    ));
  } catch(e) {
    console.error("Error generando PDF comunidad:", e.message);
    res.status(500).send("Error: " + e.message);
  }
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
