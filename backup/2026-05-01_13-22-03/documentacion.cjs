// ===================================================================
// MÓDULO DOCUMENTACIÓN — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Documentación (CCPP) al index.cjs.
// Toma el relevo cuando un CCPP termina la fase 04_SEGUIMIENTO de
// presupuestos y se acepta. A partir de 05_DOCUMENTACION en adelante
// (06_VISITA_EMASESA, 07_CONTRATOS_PAGOS, 08_TRAMITADA) este módulo
// es el que manda.
//
// IMPORTANTE — pantalla principal:
//  - La pantalla principal de TODA la app es /presupuestos. No hay
//    /documentacion (listado): ese listado vive en /presupuestos con
//    sus filtros 05/06/07/08.
//  - Documentación SÓLO ofrece la ficha individual:
//        GET /documentacion/expediente?id=...
//  - La ficha reusa `vistaFicha` de presupuestos.cjs (vía app.locals)
//    y le añade la cajita de vecinos al final.
//
// PLANTILLA DE VECINOS (cajita en la ficha):
//  - Aparece a partir de fase 05 (editable plena en 05/06/07/08).
//  - Tabla in-line editable con una fila por piso del CCPP.
//  - Clave del piso: (direccion_CCPP, codigo_piso_normalizado).
//  - Pisos sin vecino permitidos.
//  - 7 reglas de normalización del código (vienen de presupuestos.cjs).
//  - Sincronización de teléfono con expedientes al editar.
//  - Borrado físico (vecinos_base + expedientes).
//  - Modo CCPP: MANUAL (defecto) / BOT (irreversible).
//
// LIMITACIÓN DE ESTA SESIÓN:
//  - El acordeón gris (📄) muestra el estado documental pero los
//    botones de subir/ver/descargar archivo NO están operativos
//    todavía. Quedan pendientes para la próxima sesión, donde se
//    reusarán las funciones del bot (en index.cjs) para subir a
//    Drive y escribir en `expedientes` con el mismo formato.
//
// Lee/escribe en las pestañas:
//  - "comunidades"    (mismo Sheet que presupuestos; col AP modo_doc)
//  - "vecinos_base"   (listado maestro de vecinos por dirección, A-F)
//  - "expedientes"    (cabecera del expediente WhatsApp por vecino;
//                      este módulo lee y SINCRONIZA teléfono al editar)
//
// Uso desde index.cjs:
//   require("./documentacion.cjs")(app);
//   (debe registrarse DESPUÉS de presupuestos.cjs, porque depende de
//    app.locals.presupuestos)
// ===================================================================

const { google } = require("googleapis");

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN — fallback si app.locals.presupuestos no estuviera
  // =================================================================
  function getGoogleAuthLocal() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheetsClientLocal() { return google.sheets({ version: "v4", auth: getGoogleAuthLocal() }); }
  function getSheets() {
    const P = app.locals.presupuestos;
    if (P && P.getSheetsClient) return P.getSheetsClient();
    return getSheetsClientLocal();
  }

  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const RANGO_VECINOS_BASE = "vecinos_base!A:F";
  const RANGO_EXPEDIENTES = "expedientes!A:AB";

  // =================================================================
  // HELPERS LOCALES
  // =================================================================
  function fmtTlfFallback(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }

  // Normalización de dirección para emparejar (compatible con la versión
  // antigua del módulo). Usada para casar vecinos_base con su CCPP.
  function normDir(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function mismaDireccion(a, b) {
    const na = normDir(a), nb = normDir(b);
    if (!na || !nb) return false;
    return na === nb;
  }

  // Etiquetas legibles para los códigos de documento que index.cjs
  // escribe en la pestaña "expedientes". Esta lista DEBE coincidir con
  // la del bot WhatsApp (REQUIRED_DOCS en index.cjs). Una sola fuente
  // de verdad: cualquier cambio se hace aquí Y en el bot.
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
  };
  const DOCS_UNIVERSAL = Object.keys(DOC_LABELS);

  // Columnas de la pestaña expedientes que tocan la gestión documental.
  // Ver cabeceras en el Sheet (deben coincidir):
  //   col P  (idx 15) = documentos_recibidos             (escrita por el bot)
  //   col Q  (idx 16) = documentos_pendientes
  //   col AA (idx 26) = documentos_recibidos_sin_archivo (nueva, manual)
  //   col AB (idx 27) = documentos_no_aplica             (nueva, manual)
  const COL_DOCS_RECIBIDOS = 15;
  const COL_DOCS_PENDIENTES = 16;
  const COL_DOCS_RECIBIDOS_SIN_ARCHIVO = 26;
  const COL_DOCS_NO_APLICA = 27;

  function csvToArr(s) {
    if (!s) return [];
    return String(s).split(",").map(x => x.trim()).filter(Boolean);
  }
  function arrToCsv(arr) {
    return Array.from(new Set(arr.filter(Boolean))).join(",");
  }
  // Lee el estado de un documento en una fila de expediente.
  function obtenerEstadoDocumento(fila, codigo) {
    if (!fila) return "pendiente";
    if (csvToArr(fila[COL_DOCS_RECIBIDOS] || "").includes(codigo)) return "recibido_archivo";
    if (csvToArr(fila[COL_DOCS_RECIBIDOS_SIN_ARCHIVO] || "").includes(codigo)) return "recibido_sin_archivo";
    if (csvToArr(fila[COL_DOCS_NO_APLICA] || "").includes(codigo)) return "no_aplica";
    return "pendiente";
  }
  // Aplica un nuevo estado a un código en una fila (mutando la fila).
  // SOLO toca cols AA y AB. Nunca col P.
  function aplicarEstadoDoc(fila, codigo, estadoNuevo) {
    let sinArch = csvToArr(fila[COL_DOCS_RECIBIDOS_SIN_ARCHIVO] || "");
    let noAplica = csvToArr(fila[COL_DOCS_NO_APLICA] || "");
    sinArch = sinArch.filter(c => c !== codigo);
    noAplica = noAplica.filter(c => c !== codigo);
    if (estadoNuevo === "recibido_sin_archivo") sinArch.push(codigo);
    if (estadoNuevo === "no_aplica") noAplica.push(codigo);
    fila[COL_DOCS_RECIBIDOS_SIN_ARCHIVO] = arrToCsv(sinArch);
    fila[COL_DOCS_NO_APLICA] = arrToCsv(noAplica);
  }

  // Clave estable del teléfono (9 dígitos, sin prefijo) para indexar.
  function normTlfKey(tlf) {
    const t = String(tlf || "").replace(/\D/g, "");
    if (t.length === 11 && t.startsWith("34")) return t.slice(2);
    if (t.length === 12 && t.startsWith("34")) return t.slice(2);
    return t;
  }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base y expedientes
  // =================================================================
  async function leerVecinosBase() {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        _rowIndex: i + 1,
        direccion: r[0] || "",
        bloque: r[1] || "",
        vivienda: r[2] || "",
        nombre: r[3] || "",
        telefono: r[4] || "",
        presentacion_enviada: r[5] || "",
      });
    }
    return out;
  }

  async function leerExpedientes() {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        _rowIndex: i + 1,
        telefono: r[0] || "", comunidad: r[1] || "", vivienda: r[2] || "", nombre: r[3] || "",
        tipo_expediente: r[4] || "", paso_actual: r[5] || "", documento_actual: r[6] || "",
        estado_expediente: r[7] || "", fecha_inicio: r[8] || "", fecha_primer_contacto: r[9] || "",
        fecha_ultimo_contacto: r[10] || "", fecha_limite_documentacion: r[11] || "",
        fecha_limite_firma: r[12] || "", documentos_completos: r[13] || "",
        alerta_plazo: r[14] || "", documentos_recibidos: r[15] || "",
        documentos_pendientes: r[16] || "", documentos_opcionales_pendientes: r[17] || "",
        // Columnas nuevas (estados manuales que no toca el bot)
        documentos_recibidos_sin_archivo: r[26] || "",
        documentos_no_aplica: r[27] || "",
      });
    }
    return out;
  }

  // Lista pisos de un CCPP (filtra vecinos_base por dirección normalizada,
  // ordena natural por código de piso).
  async function listarPisosDeCcpp(comu) {
    const P = app.locals.presupuestos;
    const todos = await leerVecinosBase();
    const filtrados = todos.filter(v =>
      mismaDireccion(v.direccion, comu.direccion) || mismaDireccion(v.direccion, comu.comunidad)
    );
    if (P && P.comparadorNaturalPiso) {
      filtrados.sort((a, b) => P.comparadorNaturalPiso(a.vivienda, b.vivienda));
    } else {
      filtrados.sort((a, b) => String(a.vivienda).localeCompare(String(b.vivienda)));
    }
    return filtrados;
  }

  // Buscar expediente por (dirección + vivienda) — para sincronización de teléfono.
  async function buscarExpedientePorPiso(comu, viviendaNorm) {
    const P = app.locals.presupuestos;
    const norm = (P && P.normalizarCodigoPiso) || (s => String(s || "").trim().toUpperCase().replace(/\s+/g, "").replace(/[()ºª\-/]/g, ""));
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const colComu = r[1] || "";
      const matchComu = mismaDireccion(colComu, comu.direccion) || mismaDireccion(colComu, comu.comunidad);
      const matchViv = norm(r[2] || "") === viviendaNorm;
      if (matchComu && matchViv) return { _rowIndex: i + 1, fila: r };
    }
    return null;
  }

  async function buscarExpedientePorTelefono(telefono) {
    if (!telefono) return null;
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      if (String(r[0] || "").trim() === String(telefono || "").trim()) {
        return { _rowIndex: i + 1, fila: r };
      }
    }
    return null;
  }

  // =================================================================
  // OPERACIONES SOBRE PISOS (alta, edición, borrado)
  // =================================================================

  // Guarda piso (alta o edición). Devuelve { ok, error?, piso? }.
  async function guardarPiso(comu, { codigoPisoBruto, nombreBruto, telefonoBruto, _rowIndex }) {
    const P = app.locals.presupuestos;
    if (!P || !P.normalizarCodigoPiso) return { ok: false, error: "Helpers de presupuestos no disponibles" };

    // 1. Normalizar
    const codigoPiso = P.normalizarCodigoPiso(codigoPisoBruto);
    if (!codigoPiso) return { ok: false, error: "El código de piso es obligatorio" };
    const nombre = P.normalizarNombrePiso(nombreBruto || "");
    const tlfRes = P.normalizarTelefonoPiso(telefonoBruto || "");
    if (!tlfRes.ok) return { ok: false, error: tlfRes.error };
    const telefono = tlfRes.valor;

    // 2. Comprobar duplicado en este CCPP (excluyendo la fila actual si es edición)
    const existentes = await listarPisosDeCcpp(comu);
    const colision = existentes.find(p =>
      P.normalizarCodigoPiso(p.vivienda) === codigoPiso &&
      Number(p._rowIndex) !== Number(_rowIndex || 0)
    );
    if (colision) return { ok: false, error: `Ya existe el piso ${codigoPiso} en este CCPP` };

    const sheets = getSheets();

    // 3. Detectar cambio de teléfono para sincronización con expedientes
    let telefonoViejo = "", presentacionVieja = "";
    if (_rowIndex) {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `vecinos_base!A${_rowIndex}:F${_rowIndex}`,
      });
      const filaVieja = (r.data.values && r.data.values[0]) || [];
      telefonoViejo = filaVieja[4] || "";
      presentacionVieja = filaVieja[5] || "";
    }

    // 4. Construir fila y persistir
    const fila = [comu.direccion, "", codigoPiso, nombre, telefono, presentacionVieja];
    if (_rowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `vecinos_base!A${_rowIndex}:F${_rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_VECINOS_BASE,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }

    // 5. Sincronización con expedientes si cambió el teléfono
    if (_rowIndex && telefonoViejo && telefonoViejo !== telefono) {
      const exp = await buscarExpedientePorPiso(comu, codigoPiso);
      if (exp) {
        const filaExp = [...exp.fila];
        while (filaExp.length < 28) filaExp.push("");
        filaExp[0] = telefono;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `expedientes!A${exp._rowIndex}:AB${exp._rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: [filaExp] },
        });
      }
    }

    return { ok: true, piso: { direccion: comu.direccion, vivienda: codigoPiso, nombre, telefono } };
  }

  // Borrar piso (físico): vecinos_base + expedientes (si existe).
  async function borrarPiso(comu, _rowIndex) {
    if (!_rowIndex) return { ok: false, error: "Falta _rowIndex" };
    const P = app.locals.presupuestos;
    const norm = (P && P.normalizarCodigoPiso) || (s => String(s || "").trim().toUpperCase());

    const sheets = getSheets();

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `vecinos_base!A${_rowIndex}:F${_rowIndex}`,
    });
    const fila = (r.data.values && r.data.values[0]) || [];
    if (!fila[0]) return { ok: false, error: "Fila vacía o no existe" };
    const viviendaNorm = norm(fila[2] || "");
    const telefono = fila[4] || "";

    const sheetIds = await getSheetIds();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetIds.vecinos_base,
              dimension: "ROWS",
              startIndex: _rowIndex - 1,
              endIndex: _rowIndex,
            },
          },
        }],
      },
    });

    // Buscar expediente: por dirección+vivienda Y por teléfono (cubre ambos casos)
    let exp = await buscarExpedientePorPiso(comu, viviendaNorm);
    if (!exp && telefono) exp = await buscarExpedientePorTelefono(telefono);
    let expedienteBorrado = false;
    if (exp) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetIds.expedientes,
                dimension: "ROWS",
                startIndex: exp._rowIndex - 1,
                endIndex: exp._rowIndex,
              },
            },
          }],
        },
      });
      expedienteBorrado = true;
    }
    return { ok: true, expedienteBorrado };
  }

  // Cache de sheetIds (numéricos) por nombre de pestaña.
  let _sheetIdsCache = null;
  async function getSheetIds() {
    if (_sheetIdsCache) return _sheetIdsCache;
    const sheets = getSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const result = {};
    for (const s of meta.data.sheets || []) {
      result[s.properties.title] = s.properties.sheetId;
    }
    _sheetIdsCache = result;
    return result;
  }

  // Cambia el modo del CCPP. Solo MANUAL → BOT (irreversible).
  async function cambiarModoCcpp(comu, modoNuevo) {
    if (modoNuevo !== "BOT") return { ok: false, error: "Solo se permite cambiar a BOT" };
    const actual = (comu.modo_documentacion || "MANUAL").toUpperCase();
    if (actual === "BOT") return { ok: false, error: "Ya está en modo BOT" };

    const P = app.locals.presupuestos;
    if (!P || !P.actualizarCampoComunidad) return { ok: false, error: "Helpers de presupuestos no disponibles" };
    await P.actualizarCampoComunidad(comu._rowIndex, "modo_documentacion", "BOT");
    return { ok: true };
  }

  // Marca un documento del vecino con un estado nuevo. SOLO los estados
  // operativos en esta sesión (no tocan col P ni Drive):
  //   - "pendiente"
  //   - "recibido_sin_archivo"  (escribe en col AA)
  //   - "no_aplica"             (escribe en col AB)
  // Si el documento ya estaba en col P (recibido_archivo), bloquea la
  // operación con motivo "requiere_sesion_b" (la próxima sesión añadirá
  // la subida real a Drive y el desplazamiento entre col P y AA/AB).
  // Si el vecino aún no tiene fila en `expedientes`, la crea con valores
  // razonables para flujo manual.
  async function marcarDocumento(comu, piso, codigo, estadoNuevo) {
    const ESTADOS_VALIDOS = new Set(["pendiente", "recibido_sin_archivo", "no_aplica"]);
    if (!ESTADOS_VALIDOS.has(estadoNuevo)) {
      return { ok: false, error: "Estado no permitido en esta sesión: " + estadoNuevo };
    }
    if (!piso || !piso.vivienda) return { ok: false, error: "Falta el piso" };
    if (!codigo) return { ok: false, error: "Falta el código de documento" };
    if (!DOC_LABELS[codigo]) return { ok: false, error: "Código de documento desconocido: " + codigo };

    const sheets = getSheets();
    const P = app.locals.presupuestos;
    const norm = (P && P.normalizarCodigoPiso) || (s => String(s || "").trim().toUpperCase());
    const viviendaNorm = norm(piso.vivienda);

    // 1. Buscar expediente: por dirección+vivienda primero, luego por teléfono
    let exp = await buscarExpedientePorPiso(comu, viviendaNorm);
    if (!exp && piso.telefono) {
      exp = await buscarExpedientePorTelefono(piso.telefono);
    }

    // 2. Si no existe, crearlo con campos básicos para flujo manual
    if (!exp) {
      const ahora = new Date().toISOString();
      const fila = new Array(28).fill("");
      fila[0]  = piso.telefono || "";
      fila[1]  = comu.direccion || comu.comunidad || "";
      fila[2]  = piso.vivienda || "";
      fila[3]  = piso.nombre || "";
      fila[7]  = "en_proceso";
      fila[8]  = ahora;
      fila[9]  = ahora;
      fila[10] = ahora;
      fila[13] = "NO";
      fila[14] = "ok";
      // El resto queda vacío (incluida col P)
      aplicarEstadoDoc(fila, codigo, estadoNuevo);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "expedientes!A:AB",
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
      return { ok: true, creado: true };
    }

    // 3. Existe: comprobar que no está en col P (recibido_archivo)
    const filaExp = [...exp.fila];
    while (filaExp.length < 28) filaExp.push("");
    const estadoActual = obtenerEstadoDocumento(filaExp, codigo);
    if (estadoActual === "recibido_archivo") {
      return {
        ok: false,
        error: "Este documento tiene un archivo subido. La gestión de archivos estará disponible en la próxima actualización.",
        motivo: "requiere_sesion_b",
      };
    }

    // 4. Aplicar estado y persistir (escribe SOLO cols AA y AB)
    aplicarEstadoDoc(filaExp, codigo, estadoNuevo);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `expedientes!A${exp._rowIndex}:AB${exp._rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [filaExp] },
    });
    return { ok: true, creado: false };
  }

  // =================================================================
  // RENDER — cajita de vecinos
  // =================================================================
  function badgeEstadoVecino(estado, esc) {
    const map = {
      en_proceso: { txt: "En proceso", cls: "ptl-badge-azul" },
      pendiente_clasificacion: { txt: "Pdte. clasificación", cls: "ptl-badge-gris" },
      pendiente_estudio_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      pendiente_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      documentacion_base_completa: { txt: "Doc. completa", cls: "ptl-badge-verde" },
      expediente_con_revision_pendiente: { txt: "Revisión pendiente", cls: "ptl-badge-naranja" },
      completo_revision_final: { txt: "Rev. final", cls: "ptl-badge-naranja" },
      sin_contacto: { txt: "Sin contacto", cls: "ptl-badge-gris" },
    };
    const def = map[estado] || { txt: estado || "—", cls: "ptl-badge-gris" };
    return `<span class="ptl-badge ${def.cls}">${esc(def.txt)}</span>`;
  }

  function filaPisoHtml(piso, expByTlf, esc, fmtTlf) {
    const isNueva = !piso;
    const p = piso || { _rowIndex: "", direccion: "", vivienda: "", nombre: "", telefono: "", presentacion_enviada: "" };
    const tlf = p.telefono || "";
    const exp = (tlf && expByTlf[normTlfKey(tlf)]) || null;
    const estado = exp ? exp.estado_expediente : (tlf ? "sin_contacto" : "");
    const recibidos = (exp && exp.documentos_recibidos) ? exp.documentos_recibidos.split(",").filter(Boolean).length : 0;
    const pendientes = (exp && exp.documentos_pendientes) ? exp.documentos_pendientes.split(",").filter(Boolean).length : 0;
    const totalDocs = recibidos + pendientes;
    const docsTxt = exp ? `${recibidos}/${totalDocs || 0}` : "—";
    const badge = (tlf || exp) ? badgeEstadoVecino(estado, esc) : `<span class="ptl-badge ptl-badge-gris">—</span>`;

    return `<tr class="ptl-vec-fila ${isNueva ? 'ptl-vec-nueva ptl-vec-dirty' : ''}"
      data-row-index="${esc(String(p._rowIndex))}"
      data-vivienda-orig="${esc(p.vivienda)}"
      data-nombre-orig="${esc(p.nombre)}"
      data-telefono-orig="${esc(p.telefono)}">
      <td><input type="text" class="ptl-vec-input ptl-vec-vivienda" value="${esc(p.vivienda)}" placeholder="${isNueva ? '0A' : ''}" maxlength="20"/></td>
      <td><input type="text" class="ptl-vec-input ptl-vec-nombre" value="${esc(p.nombre)}" placeholder="Nombre y apellidos"/></td>
      <td><input type="text" class="ptl-vec-input ptl-vec-telefono" value="${esc(fmtTlf(p.telefono))}" placeholder="600 000 000"/></td>
      <td class="ptl-vec-estado">${badge}</td>
      <td class="ptl-vec-docs">${esc(docsTxt)}</td>
      <td class="ptl-vec-acciones">
        <button type="button" class="ptl-vec-btn ptl-vec-btn-guardar" title="Guardar cambios" ${isNueva ? '' : 'disabled'}>＋</button>
        <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon" title="Ver documentación">📄</button>
        <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar" title="Eliminar piso">✕</button>
      </td>
    </tr>
    <tr class="ptl-vec-acordeon-fila" style="display:none">
      <td colspan="6" class="ptl-vec-acordeon-cont"></td>
    </tr>`;
  }

  function urlT(token, path, params) {
    const P = app.locals.presupuestos;
    if (P && P.urlT) return P.urlT(token, path, params);
    const usp = new URLSearchParams();
    if (params) for (const [k, v] of Object.entries(params)) if (v != null && v !== "") usp.set(k, v);
    if (token) usp.set("token", token);
    const qs = usp.toString();
    return path + (qs ? "?" + qs : "");
  }

  function cajitaVecinosHtml(comu, pisos, expedientes, token, esc, fmtTlf) {
    // Indexar expedientes por teléfono
    const expByTlf = {};
    for (const e of expedientes) {
      const k = normTlfKey(e.telefono);
      if (k) expByTlf[k] = e;
    }

    // Stats
    const total = pisos.length;
    let sinContacto = 0, completos = 0;
    for (const p of pisos) {
      const exp = expByTlf[normTlfKey(p.telefono)];
      if (!exp && p.telefono) sinContacto++;
      if (exp && exp.estado_expediente === "documentacion_base_completa") completos++;
    }
    const conExp = pisos.filter(p => expByTlf[normTlfKey(p.telefono)]).length;
    const incompletos = conExp - completos;

    const pillResumen = total === 0
      ? `<span class="ptl-stat-pill ptl-stat-gris">Sin pisos</span>`
      : (incompletos === 0 && completos > 0
          ? `<span class="ptl-stat-pill ptl-stat-verde">✓ Completo</span>`
          : (conExp > 0
              ? `<span class="ptl-stat-pill ptl-stat-naranja">⚠ ${incompletos} pendiente${incompletos === 1 ? '' : 's'}</span>`
              : `<span class="ptl-stat-pill ptl-stat-azul">${total} piso${total === 1 ? '' : 's'}</span>`));
    const pillSinContacto = sinContacto > 0
      ? `<span class="ptl-stat-pill ptl-stat-gris" style="margin-left:4px">${sinContacto} sin contacto</span>`
      : "";

    const modo = (comu.modo_documentacion || "MANUAL").toUpperCase();
    const modoCcppHtml = modo === "BOT"
      ? `<span class="ptl-vec-modo ptl-vec-modo-bot" title="Este CCPP funciona en modo automático con el bot WhatsApp">Modo: BOT 🤖</span>`
      : `<span class="ptl-vec-modo ptl-vec-modo-manual" title="Este CCPP se gestiona manualmente">Modo: MANUAL <button type="button" class="ptl-vec-cambiar-modo" title="Cambiar a modo BOT (irreversible)">↗</button></span>`;

    const filasExistentes = pisos.map(p => filaPisoHtml(p, expByTlf, esc, fmtTlf)).join("");

    const docsUnivJson = JSON.stringify(DOCS_UNIVERSAL.map(c => ({ codigo: c, label: DOC_LABELS[c] }))).replace(/</g, "\\u003c");
    const expedientesPorTlfJson = JSON.stringify(expByTlf).replace(/</g, "\\u003c");

    const URL_GUARDAR = urlT(token, "/documentacion/piso/guardar");
    const URL_BORRAR  = urlT(token, "/documentacion/piso/borrar");
    const URL_MODO    = urlT(token, "/documentacion/ccpp/modo");
    const URL_MARCAR  = urlT(token, "/documentacion/documento/marcar");

    return `
      <div class="ptl-card ptl-vec-card" data-direccion="${esc(comu.direccion)}" data-comunidad="${esc(comu.comunidad)}">
        <div class="ptl-card-title-row ptl-vec-cabecera">
          <div class="ptl-vec-titulo">
            <span class="ptl-card-title" style="margin-bottom:0">VECINOS · DOCUMENTACIÓN <span class="ptl-vec-total">(${total})</span></span>
            ${modoCcppHtml}
          </div>
          <div class="ptl-vecinos-stats">${pillResumen}${pillSinContacto}</div>
        </div>
        <div class="ptl-vec-toolbar">
          <button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-vec-btn-anadir">+ Añadir piso</button>
        </div>
        <div class="ptl-vec-tabla-wrap">
          <table class="ptl-vec-tabla">
            <thead><tr>
              <th class="ptl-vec-th-vivienda">Vivienda</th>
              <th class="ptl-vec-th-nombre">Nombre</th>
              <th class="ptl-vec-th-telefono">Teléfono</th>
              <th class="ptl-vec-th-estado">Estado</th>
              <th class="ptl-vec-th-docs">Docs</th>
              <th class="ptl-vec-th-acciones"></th>
            </tr></thead>
            <tbody class="ptl-vec-tbody">${filasExistentes}</tbody>
          </table>
          ${filasExistentes ? '' : '<div class="ptl-vec-empty">Sin pisos todavía. Pulsa <strong>+ Añadir piso</strong> para empezar.</div>'}
        </div>
        <script>
          (function() {
            const card = document.currentScript.closest('.ptl-vec-card');
            const tbody = card.querySelector('.ptl-vec-tbody');
            const direccion = card.dataset.direccion;
            const docsUniversal = ${docsUnivJson};
            const expedientesPorTlf = ${expedientesPorTlfJson};
            const URL_GUARDAR = ${JSON.stringify(URL_GUARDAR)};
            const URL_BORRAR  = ${JSON.stringify(URL_BORRAR)};
            const URL_MODO    = ${JSON.stringify(URL_MODO)};
            const URL_MARCAR  = ${JSON.stringify(URL_MARCAR)};

            function esc(s) {
              return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
              }[c]));
            }
            function fmtTlf(s) {
              if (!s) return '';
              let d = String(s).replace(/\\D/g, '');
              if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
              if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
              if (d.length === 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
              return String(s);
            }
            function normTlfKey(s) {
              const t = String(s || '').replace(/\\D/g, '');
              if (t.length === 11 && t.startsWith('34')) return t.slice(2);
              if (t.length === 12 && t.startsWith('34')) return t.slice(2);
              return t;
            }
            function filaToString(fila) {
              return [
                fila.querySelector('.ptl-vec-vivienda').value || '',
                fila.querySelector('.ptl-vec-nombre').value || '',
                fila.querySelector('.ptl-vec-telefono').value || '',
              ].join('|');
            }
            function originalToString(fila) {
              return [
                fila.dataset.viviendaOrig || '',
                fila.dataset.nombreOrig || '',
                fila.dataset.telefonoOrig || '',
              ].join('|');
            }
            function actualizarDirty(fila) {
              const dirty = filaToString(fila) !== originalToString(fila);
              fila.classList.toggle('ptl-vec-dirty', dirty);
              const btn = fila.querySelector('.ptl-vec-btn-guardar');
              if (btn) btn.disabled = !dirty;
              actualizarFlagSalir();
            }
            function actualizarFlagSalir() {
              window.__ptlVecDirty = !!card.querySelector('.ptl-vec-fila.ptl-vec-dirty');
            }
            if (!window.__ptlVecBeforeUnloadInstalled) {
              window.__ptlVecBeforeUnloadInstalled = true;
              window.addEventListener('beforeunload', e => {
                if (window.__ptlVecDirty) { e.preventDefault(); e.returnValue = ''; return ''; }
              });
            }

            function badgeEstado(estado) {
              const map = {
                en_proceso: ['En proceso', 'ptl-badge-azul'],
                pendiente_clasificacion: ['Pdte. clasificación', 'ptl-badge-gris'],
                pendiente_financiacion: ['Pdte. financiación', 'ptl-badge-amarillo'],
                documentacion_base_completa: ['Doc. completa', 'ptl-badge-verde'],
                expediente_con_revision_pendiente: ['Revisión pendiente', 'ptl-badge-naranja'],
                completo_revision_final: ['Rev. final', 'ptl-badge-naranja'],
                sin_contacto: ['Sin contacto', 'ptl-badge-gris'],
              };
              const def = map[estado] || [estado || '—', 'ptl-badge-gris'];
              return '<span class="ptl-badge '+def[1]+'">'+esc(def[0])+'</span>';
            }

            function cerrarAcordeonesAbiertos(excepto) {
              card.querySelectorAll('.ptl-vec-acordeon-fila').forEach(f => {
                if (f === excepto) return;
                f.style.display = 'none';
                const c = f.querySelector('.ptl-vec-acordeon-cont');
                if (c) c.innerHTML = '';
              });
              card.querySelectorAll('.ptl-vec-fila').forEach(f => f.classList.remove('ptl-vec-fila-expandida'));
            }

            function pintarAcordeon(filaPiso, contenedor) {
              const tlf = filaPiso.querySelector('.ptl-vec-telefono').value || '';
              const tlfKey = normTlfKey(tlf);
              const exp = expedientesPorTlf[tlfKey] || null;
              const recibidos      = exp && exp.documentos_recibidos                ? exp.documentos_recibidos.split(',').filter(Boolean) : [];
              const pendientes     = exp && exp.documentos_pendientes               ? exp.documentos_pendientes.split(',').filter(Boolean) : [];
              const sinArchivo     = exp && exp.documentos_recibidos_sin_archivo    ? exp.documentos_recibidos_sin_archivo.split(',').filter(Boolean) : [];
              const noAplica       = exp && exp.documentos_no_aplica                ? exp.documentos_no_aplica.split(',').filter(Boolean) : [];
              const recibidosSet  = new Set(recibidos);
              const sinArchivoSet = new Set(sinArchivo);
              const noAplicaSet   = new Set(noAplica);

              // Cabecera del acordeón
              let cab;
              if (!exp) {
                cab = '<div class="ptl-vec-ac-cab ptl-vec-ac-sinexp">'
                  + '<span class="ptl-badge ptl-badge-gris">Sin expediente</span>'
                  + '<span class="ptl-vec-ac-cab-info">El expediente se creará automáticamente al marcar el primer documento.</span>'
                  + '</div>';
              } else {
                // El contador suma los 3 estados "marcados" (recibidos con archivo + sin archivo + no aplica)
                const totalMarcados = recibidos.length + sinArchivo.length + noAplica.length;
                const total = totalMarcados + pendientes.length;
                cab = '<div class="ptl-vec-ac-cab">'
                  + badgeEstado(exp.estado_expediente)
                  + '<span class="ptl-vec-ac-cab-counter">'+totalMarcados+'/'+total+' docs</span>'
                  + (exp.fecha_inicio ? '<span class="ptl-vec-ac-cab-fecha">Inicio: '+esc(formatearFechaCorta(exp.fecha_inicio))+'</span>' : '')
                  + (exp.fecha_ultimo_contacto ? '<span class="ptl-vec-ac-cab-fecha">Último contacto: '+esc(formatearFechaCorta(exp.fecha_ultimo_contacto))+'</span>' : '')
                  + (exp.fecha_limite_documentacion ? '<span class="ptl-vec-ac-cab-fecha">Plazo: '+esc(formatearFechaCorta(exp.fecha_limite_documentacion))+'</span>' : '')
                  + '</div>';
              }

              // Lista universal de documentos con su estado calculado
              const docs = docsUniversal.map(d => {
                let estado, cls, icono, title;
                if (recibidosSet.has(d.codigo)) {
                  estado = 'recibido_archivo';
                  cls = 'ptl-vec-doc-recibido';
                  icono = '📎';
                  title = 'Recibido con archivo';
                } else if (sinArchivoSet.has(d.codigo)) {
                  estado = 'recibido_sin_archivo';
                  cls = 'ptl-vec-doc-recibido-sinarchivo';
                  icono = '⚠';
                  title = 'Recibido sin archivo (pendiente de digitalizar)';
                } else if (noAplicaSet.has(d.codigo)) {
                  estado = 'no_aplica';
                  cls = 'ptl-vec-doc-noaplica';
                  icono = '➖';
                  title = 'No aplica a este vecino';
                } else {
                  estado = 'pendiente';
                  cls = 'ptl-vec-doc-pendiente';
                  icono = '⬆️';
                  title = 'Pendiente';
                }
                return '<div class="ptl-vec-doc-fila">'
                  + '<button type="button" class="ptl-vec-doc-btn '+cls+'" '
                  + 'data-codigo="'+esc(d.codigo)+'" data-estado="'+estado+'" '
                  + 'title="'+esc(title)+'">'+icono+'</button>'
                  + '<span class="ptl-vec-doc-label">'+esc(d.label)+'</span>'
                  + '</div>';
              }).join('');

              contenedor.innerHTML = cab
                + '<div class="ptl-vec-doc-lista">' + docs + '</div>';
            }

            function formatearFechaCorta(s) {
              if (!s) return '';
              const d = new Date(s.length > 10 ? s : s + 'T00:00:00');
              if (isNaN(d)) return s;
              return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' });
            }

            // ---- MENÚ EMERGENTE de cada documento ----
            // Cierra cualquier menú abierto (un solo menú a la vez).
            function cerrarMenuDoc() {
              const m = card.querySelector('.ptl-vec-doc-menu');
              if (m) m.remove();
            }
            // Abre el menú al lado del botón con las opciones contextuales.
            function abrirMenuDoc(btn) {
              cerrarMenuDoc();
              const codigo = btn.dataset.codigo;
              const estado = btn.dataset.estado;
              const fila = btn.closest('.ptl-vec-acordeon-fila').previousElementSibling;
              const opciones = construirOpcionesMenu(estado);
              const menu = document.createElement('div');
              menu.className = 'ptl-vec-doc-menu';
              menu.innerHTML = opciones.map(o =>
                '<button type="button" class="ptl-vec-doc-menu-item'
                + (o.disabled ? ' ptl-vec-doc-menu-item-disabled' : '')
                + '" data-accion="'+esc(o.accion)+'"'
                + (o.disabled ? ' disabled title="Disponible próximamente"' : '')
                + '>'+esc(o.label)+'</button>'
              ).join('');
              btn.parentElement.style.position = 'relative';
              btn.parentElement.appendChild(menu);
              // Cerrar al pulsar fuera
              setTimeout(() => {
                document.addEventListener('click', cerrarFueraMenuDoc, { once: true });
              }, 0);

              // Manejar opción
              menu.addEventListener('click', async ev => {
                const it = ev.target.closest('.ptl-vec-doc-menu-item');
                if (!it || it.disabled) return;
                ev.stopPropagation();
                const accion = it.dataset.accion;
                cerrarMenuDoc();
                await ejecutarAccionDoc(fila, codigo, accion);
              });
            }
            function cerrarFueraMenuDoc(ev) {
              if (!ev.target.closest('.ptl-vec-doc-menu') && !ev.target.closest('.ptl-vec-doc-btn')) {
                cerrarMenuDoc();
              }
            }
            // Devuelve las opciones del menú según el estado actual.
            // Las opciones que tocan archivo (col P / Drive) van con disabled.
            function construirOpcionesMenu(estado) {
              const proximamente = ' (próximamente)';
              if (estado === 'pendiente') {
                return [
                  { accion: 'subir',                label: '⬆️ Subir archivo' + proximamente, disabled: true },
                  { accion: 'recibido_sin_archivo', label: '✓ Marcar recibido sin archivo' },
                  { accion: 'no_aplica',            label: '➖ No aplica a este vecino' },
                ];
              }
              if (estado === 'recibido_archivo') {
                return [
                  { accion: 'ver',                  label: '👁 Ver archivo' + proximamente, disabled: true },
                  { accion: 'descargar',            label: '⬇ Descargar archivo' + proximamente, disabled: true },
                  { accion: 'reemplazar',           label: '↻ Reemplazar archivo' + proximamente, disabled: true },
                  { accion: 'sin_archivo_desde_p', label: '⚠ Marcar sin archivo' + proximamente, disabled: true },
                  { accion: 'no_aplica_desde_p',   label: '➖ No aplica' + proximamente, disabled: true },
                ];
              }
              if (estado === 'recibido_sin_archivo') {
                return [
                  { accion: 'subir',                label: '📎 Subir archivo' + proximamente, disabled: true },
                  { accion: 'pendiente',            label: '↶ Marcar como pendiente' },
                  { accion: 'no_aplica',            label: '➖ No aplica a este vecino' },
                ];
              }
              if (estado === 'no_aplica') {
                return [
                  { accion: 'pendiente',            label: '↶ Marcar como pendiente' },
                  { accion: 'subir',                label: '⬆️ Subir archivo' + proximamente, disabled: true },
                  { accion: 'recibido_sin_archivo', label: '✓ Marcar recibido sin archivo' },
                ];
              }
              return [];
            }

            async function ejecutarAccionDoc(fila, codigo, accion) {
              // Solo las acciones operativas en esta sesión se envían al servidor.
              const ESTADOS = { pendiente: 'pendiente', recibido_sin_archivo: 'recibido_sin_archivo', no_aplica: 'no_aplica' };
              if (!ESTADOS[accion]) {
                // Acciones que requieren sesión B (subir/ver/descargar/reemplazar/etc)
                alert('Disponible en la próxima actualización.');
                return;
              }
              const fd = new URLSearchParams();
              fd.append('direccion', direccion);
              fd.append('vivienda', fila.dataset.viviendaOrig || fila.querySelector('.ptl-vec-vivienda').value || '');
              fd.append('codigo', codigo);
              fd.append('estado', ESTADOS[accion]);
              try {
                const resp = await fetch(URL_MARCAR, { method: 'POST', body: fd });
                const data = await resp.json();
                if (!data.ok) {
                  alert(data.error || 'Error marcando documento');
                  return;
                }
                window.location.reload();
              } catch (e) {
                alert('Error de red: ' + e.message);
              }
            }

            async function guardarFila(fila) {
              const fd = new URLSearchParams();
              fd.append('direccion', direccion);
              fd.append('codigoPiso', fila.querySelector('.ptl-vec-vivienda').value || '');
              fd.append('nombre',     fila.querySelector('.ptl-vec-nombre').value || '');
              fd.append('telefono',   fila.querySelector('.ptl-vec-telefono').value || '');
              const ri = fila.dataset.rowIndex || '';
              if (ri) fd.append('rowIndex', ri);
              try {
                const resp = await fetch(URL_GUARDAR, { method: 'POST', body: fd });
                const data = await resp.json();
                if (!data.ok) { alert(data.error || 'Error guardando'); return; }
                window.location.reload();
              } catch (e) {
                alert('Error de red: ' + e.message);
              }
            }

            async function borrarFila(fila) {
              const ri = fila.dataset.rowIndex || '';
              if (!ri) {
                // Fila nueva sin guardar: la quitamos del DOM y ya
                const sig = fila.nextElementSibling;
                if (sig && sig.classList.contains('ptl-vec-acordeon-fila')) sig.remove();
                fila.remove();
                actualizarFlagSalir();
                return;
              }
              const viv = fila.dataset.viviendaOrig || '';
              const nom = fila.dataset.nombreOrig || '';
              const tlf = fila.dataset.telefonoOrig || '';
              const exp = expedientesPorTlf[normTlfKey(tlf)];
              const recibidos = exp && exp.documentos_recibidos ? exp.documentos_recibidos.split(',').filter(Boolean) : [];

              let mensaje = 'Vas a borrar el piso ' + viv;
              if (nom) mensaje += ' · ' + nom;
              if (tlf) mensaje += ' · ' + fmtTlf(tlf);
              mensaje += '.';
              if (recibidos.length > 0) {
                mensaje += '\\n\\n⚠ Tiene ' + recibidos.length + ' documento' + (recibidos.length === 1 ? '' : 's') + ' recibido' + (recibidos.length === 1 ? '' : 's') + ' en su expediente:';
                for (const c of recibidos) {
                  const def = docsUniversal.find(d => d.codigo === c);
                  mensaje += '\\n  · ' + (def ? def.label : c);
                }
                mensaje += '\\n\\nSe eliminarán también esos documentos del expediente.';
              }
              mensaje += '\\n\\nEsta acción NO se puede deshacer. ¿Continuar?';

              if (!confirm(mensaje)) return;

              const fd = new URLSearchParams();
              fd.append('direccion', direccion);
              fd.append('rowIndex', ri);
              try {
                const resp = await fetch(URL_BORRAR, { method: 'POST', body: fd });
                const data = await resp.json();
                if (!data.ok) { alert(data.error || 'Error borrando'); return; }
                window.location.reload();
              } catch (e) {
                alert('Error de red: ' + e.message);
              }
            }

            async function cambiarModo() {
              if (!confirm('Vas a cambiar este CCPP a MODO BOT (gestión automática por WhatsApp).\\n\\nEsta acción NO se puede deshacer: una vez en modo BOT no se puede volver a MANUAL.\\n\\n¿Continuar?')) return;
              const fd = new URLSearchParams();
              fd.append('direccion', direccion);
              fd.append('modo', 'BOT');
              try {
                const resp = await fetch(URL_MODO, { method: 'POST', body: fd });
                const data = await resp.json();
                if (!data.ok) { alert(data.error || 'Error cambiando modo'); return; }
                window.location.reload();
              } catch (e) {
                alert('Error de red: ' + e.message);
              }
            }

            function anadirFilaNueva() {
              if (tbody.querySelector('.ptl-vec-nueva')) {
                tbody.querySelector('.ptl-vec-nueva .ptl-vec-vivienda').focus();
                return;
              }
              const tr = document.createElement('tr');
              tr.className = 'ptl-vec-fila ptl-vec-nueva ptl-vec-dirty';
              tr.dataset.rowIndex = '';
              tr.dataset.viviendaOrig = '';
              tr.dataset.nombreOrig = '';
              tr.dataset.telefonoOrig = '';
              tr.innerHTML = ''
                + '<td><input type="text" class="ptl-vec-input ptl-vec-vivienda" value="" placeholder="0A" maxlength="20"/></td>'
                + '<td><input type="text" class="ptl-vec-input ptl-vec-nombre" value="" placeholder="Nombre y apellidos"/></td>'
                + '<td><input type="text" class="ptl-vec-input ptl-vec-telefono" value="" placeholder="600 000 000"/></td>'
                + '<td class="ptl-vec-estado"><span class="ptl-badge ptl-badge-gris">—</span></td>'
                + '<td class="ptl-vec-docs">—</td>'
                + '<td class="ptl-vec-acciones">'
                + '<button type="button" class="ptl-vec-btn ptl-vec-btn-guardar" title="Guardar cambios">＋</button>'
                + '<button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon" title="Ver documentación">📄</button>'
                + '<button type="button" class="ptl-vec-btn ptl-vec-btn-borrar" title="Eliminar piso">✕</button>'
                + '</td>';
              const tr2 = document.createElement('tr');
              tr2.className = 'ptl-vec-acordeon-fila';
              tr2.style.display = 'none';
              tr2.innerHTML = '<td colspan="6" class="ptl-vec-acordeon-cont"></td>';
              // Insertar al PRINCIPIO (fila nueva arriba)
              tbody.insertBefore(tr2, tbody.firstChild);
              tbody.insertBefore(tr, tbody.firstChild);
              tr.querySelector('.ptl-vec-vivienda').focus();
              actualizarFlagSalir();
            }

            // ----- DELEGACIÓN DE EVENTOS -----
            tbody.addEventListener('input', e => {
              if (!e.target.matches('.ptl-vec-input')) return;
              const fila = e.target.closest('.ptl-vec-fila');
              if (fila) actualizarDirty(fila);
            });

            tbody.addEventListener('click', e => {
              const fila = e.target.closest('.ptl-vec-fila');
              if (fila) {
                if (e.target.closest('.ptl-vec-btn-guardar')) {
                  const btn = e.target.closest('.ptl-vec-btn-guardar');
                  if (btn.disabled) return;
                  guardarFila(fila);
                  return;
                }
                if (e.target.closest('.ptl-vec-btn-borrar')) {
                  borrarFila(fila);
                  return;
                }
                if (e.target.closest('.ptl-vec-btn-acordeon')) {
                  const acord = fila.nextElementSibling;
                  if (!acord || !acord.classList.contains('ptl-vec-acordeon-fila')) return;
                  const yaAbierto = acord.style.display !== 'none';
                  cerrarAcordeonesAbiertos(yaAbierto ? null : acord);
                  if (yaAbierto) {
                    acord.style.display = 'none';
                    const c = acord.querySelector('.ptl-vec-acordeon-cont');
                    if (c) c.innerHTML = '';
                    fila.classList.remove('ptl-vec-fila-expandida');
                  } else {
                    pintarAcordeon(fila, acord.querySelector('.ptl-vec-acordeon-cont'));
                    acord.style.display = '';
                    fila.classList.add('ptl-vec-fila-expandida');
                  }
                  return;
                }
              }
              const docBtn = e.target.closest('.ptl-vec-doc-btn');
              if (docBtn) {
                e.stopPropagation();
                abrirMenuDoc(docBtn);
              }
            });

            card.querySelector('.ptl-vec-btn-anadir').addEventListener('click', anadirFilaNueva);
            const btnModo = card.querySelector('.ptl-vec-cambiar-modo');
            if (btnModo) btnModo.addEventListener('click', cambiarModo);
          })();
        </script>
      </div>
    `;
  }

  // =================================================================
  // RUTAS
  // =================================================================
  function checkToken(req, res) {
    const token = req.query.token || (req.body && req.body.token);
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }

  // ----- GET /documentacion/expediente?id=... -----
  app.get("/documentacion/expediente", async (req, res) => {
    const P = app.locals.presupuestos;
    if (!P) {
      return res.status(500).send(
        "Error: el módulo presupuestos no está cargado. " +
        "Asegúrate de que en index.cjs se haga require('./presupuestos.cjs')(app) " +
        "ANTES de require('./documentacion.cjs')(app)."
      );
    }

    const token = req.query.token || "";
    if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).send("No autorizado");

    try {
      const id = req.query.id;
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) {
        return P.sendHtml(res, P.pageHtml("No encontrado",
          [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: "—", url: "#" }],
          `<div class="ptl-empty"><h3>Expediente no encontrado</h3></div>`,
          token));
      }

      let pisos = [], expedientes = [];
      try { pisos = await listarPisosDeCcpp(comu); }
      catch (e) { console.warn("[documentacion] no se pudo leer vecinos_base:", e.message); }
      try { expedientes = await leerExpedientes(); }
      catch (e) { console.warn("[documentacion] no se pudo leer expedientes:", e.message); }

      const fmtTlf = (P && P.fmtTlf) || fmtTlfFallback;
      const cajita = cajitaVecinosHtml(comu, pisos, expedientes, token, P.esc, fmtTlf);

      const datalists = P.construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";

      P.sendHtml(res, P.pageHtml(titulo,
        [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        P.vistaFicha(comu, datalists, token, reciencreado, { extraHtmlFinal: cajita }),
        token));
    } catch (e) {
      console.error("[documentacion] /documentacion/expediente:", e.message);
      const P2 = app.locals.presupuestos;
      if (P2) P2.sendError(res, "Error: " + e.message);
      else res.status(500).send("Error: " + e.message);
    }
  });

  // ----- POST /documentacion/piso/guardar -----
  app.post("/documentacion/piso/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const P = app.locals.presupuestos;
    if (!P) return res.status(500).json({ error: "Presupuestos no cargado" });
    try {
      const direccion = req.body.direccion;
      if (!direccion) return res.status(400).json({ error: "Falta dirección" });
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => mismaDireccion(c.direccion, direccion) || mismaDireccion(c.comunidad, direccion));
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });

      const result = await guardarPiso(comu, {
        codigoPisoBruto: req.body.codigoPiso,
        nombreBruto: req.body.nombre,
        telefonoBruto: req.body.telefono,
        _rowIndex: req.body.rowIndex ? parseInt(req.body.rowIndex, 10) : null,
      });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e) {
      console.error("[documentacion] piso/guardar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ----- POST /documentacion/piso/borrar -----
  app.post("/documentacion/piso/borrar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const P = app.locals.presupuestos;
    if (!P) return res.status(500).json({ error: "Presupuestos no cargado" });
    try {
      const direccion = req.body.direccion;
      const rowIndex = req.body.rowIndex ? parseInt(req.body.rowIndex, 10) : null;
      if (!rowIndex) return res.status(400).json({ error: "Falta rowIndex" });

      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => mismaDireccion(c.direccion, direccion) || mismaDireccion(c.comunidad, direccion));
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });

      const result = await borrarPiso(comu, rowIndex);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e) {
      console.error("[documentacion] piso/borrar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ----- POST /documentacion/ccpp/modo -----
  app.post("/documentacion/ccpp/modo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const P = app.locals.presupuestos;
    if (!P) return res.status(500).json({ error: "Presupuestos no cargado" });
    try {
      const direccion = req.body.direccion;
      const modo = (req.body.modo || "").toUpperCase();
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => mismaDireccion(c.direccion, direccion) || mismaDireccion(c.comunidad, direccion));
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });
      const result = await cambiarModoCcpp(comu, modo);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e) {
      console.error("[documentacion] ccpp/modo:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ----- POST /documentacion/documento/marcar -----
  // Marca un documento de un vecino con un nuevo estado.
  // Body: direccion, vivienda, telefono?, nombre?, codigo, estado.
  // Estados aceptados en esta sesión: pendiente | recibido_sin_archivo | no_aplica.
  app.post("/documentacion/documento/marcar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const P = app.locals.presupuestos;
    if (!P) return res.status(500).json({ error: "Presupuestos no cargado" });
    try {
      const direccion = req.body.direccion;
      const vivienda = req.body.vivienda;
      const codigo = req.body.codigo;
      const estado = req.body.estado;
      if (!direccion || !vivienda || !codigo || !estado) {
        return res.status(400).json({ error: "Faltan parámetros (direccion, vivienda, codigo, estado)" });
      }
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c => mismaDireccion(c.direccion, direccion) || mismaDireccion(c.comunidad, direccion));
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado" });

      // Necesitamos los datos completos del piso (telefono, nombre) para crear
      // el expediente si no existe. Los leemos de vecinos_base.
      const pisos = await listarPisosDeCcpp(comu);
      const norm = P.normalizarCodigoPiso || (s => String(s || "").trim().toUpperCase());
      const piso = pisos.find(p => norm(p.vivienda) === norm(vivienda));
      if (!piso) return res.status(404).json({ error: "Piso no encontrado en este CCPP" });

      const result = await marcarDocumento(comu, piso, codigo, estado);
      if (!result.ok) {
        // status 409 si hay conflicto con archivo existente, 400 en lo demás
        const status = result.motivo === "requiere_sesion_b" ? 409 : 400;
        return res.status(status).json(result);
      }
      res.json(result);
    } catch (e) {
      console.error("[documentacion] documento/marcar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[documentacion] Módulo cargado. Rutas: /documentacion/expediente, /documentacion/piso/guardar, /documentacion/piso/borrar, /documentacion/ccpp/modo, /documentacion/documento/marcar");

};
