// ===================================================================
// MÓDULO DOCUMENTACIÓN — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Documentación (CCPP) al index.cjs.
// Toma el relevo cuando un CCPP termina la fase 04_ACEPTACION_PTO de
// presupuestos y se acepta. A partir de 05_DOCUMENTACION en adelante
// (06_VISITA_EMASESA, 07_PTE_CYCP, 08_CYCP) este módulo
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
  const RANGO_EXPEDIENTES = "pisos!A:AS";          // ampliado a AS para leer estados manuales (AC-AS)
  const RANGO_COMUNIDADES_DOC = "comunidades!A:AY";// para leer estados CCPP (AQ-AY)
  const RANGO_DOCS_MANUALES = "documentos_manuales!A:G";

  // =================================================================
  // CARGADOR DE LA LISTA DE DOCUMENTOS MANUALES
  // Lee la pestaña documentos_manuales y la mantiene en memoria con
  // un TTL (15 minutos). Distingue entre documentos del piso y del CCPP.
  // Si la pestaña no existe o falla, devuelve listas vacías y la cajita
  // mostrará un mensaje claro ("configura documentos_manuales").
  // =================================================================
  let _docsManualesCache = null;
  let _docsManualesCacheTs = 0;
  async function leerDocumentosManuales() {
    const TTL_MS = 15 * 60 * 1000;
    if (_docsManualesCache && (Date.now() - _docsManualesCacheTs) < TTL_MS) {
      return _docsManualesCache;
    }
    const sheets = getSheets();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: RANGO_DOCS_MANUALES,
      });
      rows = r.data.values || [];
    } catch (e) {
      console.warn("[documentacion] no se pudo leer documentos_manuales:", e.message);
      rows = [];
    }
    // Cabeceras esperadas: codigo, nivel, label, orden, permite_financiacion, activo, notas
    const piso = [];
    const ccpp = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const codigo = String(r[0] || "").trim();
      const nivel  = String(r[1] || "").trim().toUpperCase();
      const label  = String(r[2] || "").trim();
      const orden  = parseInt(String(r[3] || "0"), 10) || 0;
      const permiteFin = String(r[4] || "").trim().toUpperCase() === "SI";
      const activo = String(r[5] || "SI").trim().toUpperCase() !== "NO";
      if (!codigo || !label || !activo) continue;
      const doc = { codigo, label, orden, permiteFinanciacion: permiteFin };
      if (nivel === "PISO") piso.push(doc);
      else if (nivel === "CCPP") ccpp.push(doc);
    }
    piso.sort((a,b) => a.orden - b.orden);
    ccpp.sort((a,b) => a.orden - b.orden);
    _docsManualesCache = { piso, ccpp };
    _docsManualesCacheTs = Date.now();
    return _docsManualesCache;
  }
  // Para forzar recarga tras cambios externos
  function invalidarCacheDocsManuales() { _docsManualesCache = null; }

  // =================================================================
  // LECTURA DE ESTADOS CCPP
  // Lee la fila del CCPP en pestaña 'comunidades' y devuelve los 9
  // estados manuales (cols AQ-AY = índices 42-50).
  // Devuelve un array de 9 strings en el mismo orden que la lista
  // documentos_manuales (CCPP).
  // =================================================================
  async function leerEstadosCcpp(comu) {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_COMUNIDADES_DOC,
    });
    const rows = res.data.values || [];
    // Buscar fila por dirección o por comunidad
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const a = r[0] || ""; // comunidad
      const b = r[1] || ""; // direccion
      if (mismaDireccion(a, comu.comunidad) || mismaDireccion(a, comu.direccion) ||
          mismaDireccion(b, comu.comunidad) || mismaDireccion(b, comu.direccion)) {
        const estados = [];
        for (let c = 42; c <= 50; c++) estados.push(r[c] || "");
        return estados;
      }
    }
    return new Array(9).fill("");
  }

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
      // Antes: se descartaba la fila si NO tenía teléfono (r[0]). Eso era
      // herencia del bot, que necesita teléfono. En el sistema manual un piso
      // puede no tenerlo todavía, así que solo descartamos filas totalmente
      // vacías (sin teléfono, sin comunidad y sin vivienda).
      if (!r || (!r[0] && !r[1] && !r[2])) continue;
      // Construimos también el mapa de estados manuales por código.
      // Cols AC-AS = índices 28-44. Necesitamos saber qué código corresponde
      // a cada índice; lo resolvemos con la lista de documentos_manuales (PISO),
      // pero como esto es una lectura sin async, usamos solo los datos crudos
      // y dejamos que el caller (que ya tendrá la lista) los interprete.
      const estadosManualesPiso = [];
      for (let c = 28; c <= 44; c++) estadosManualesPiso.push(r[c] || "");

      out.push({
        _rowIndex: i + 1,
        // Decisión sesión 04/05/2026: las cols D y E del Sheet `pisos` se
        // han recoceptualizado:
        //  - D `nota_simple`: nombre del titular registral (de la Nota Simple).
        //  - E `nombre`:      nombre del titular del contrato con EMASESA.
        //                     Es el que se muestra en la cajita DATOS DOCUMENTACION.
        telefono: r[0] || "", comunidad: r[1] || "", vivienda: r[2] || "",
        nota_simple: r[3] || "", nombre: r[4] || "",
        // tipo_expediente desaparece del modelo manual (lo activará el bot
        // en el futuro sobre alguna columna libre).
        paso_actual: r[5] || "", documento_actual: r[6] || "",
        estado_expediente: r[7] || "", fecha_inicio: r[8] || "", fecha_primer_contacto: r[9] || "",
        fecha_ultimo_contacto: r[10] || "", fecha_limite_documentacion: r[11] || "",
        fecha_limite_firma: r[12] || "", documentos_completos: r[13] || "",
        alerta_plazo: r[14] || "", documentos_recibidos: r[15] || "",
        documentos_pendientes: r[16] || "", documentos_opcionales_pendientes: r[17] || "",
        // Columnas del bot (no se tocan desde el manual)
        documentos_recibidos_sin_archivo: r[26] || "",
        documentos_no_aplica: r[27] || "",
        // Estados manuales del piso (cols AC-AS, índices 28-44, en orden de la lista)
        _estadosManualesPiso: estadosManualesPiso,
      });
    }
    return out;
  }

  // Lista pisos de un CCPP (filtra la pestaña pisos por dirección normalizada,
  // ordena natural por código de piso).
  // CAMBIO IMPORTANTE: ya NO se lee de vecinos_base. Esa pestaña queda
  // independiente para uso futuro.
  async function listarPisosDeCcpp(comu) {
    const P = app.locals.presupuestos;
    const todos = await leerExpedientes();
    const filtrados = todos.filter(p =>
      mismaDireccion(p.comunidad, comu.direccion) || mismaDireccion(p.comunidad, comu.comunidad)
    ).map(p => ({
      // Mapear el objeto al formato que espera la cajita (vivienda, nombre, telefono).
      // Mantenemos _rowIndex de la pestaña pisos para edición/borrado.
      _rowIndex: p._rowIndex,
      direccion: p.comunidad,   // en pisos col B = comunidad/dirección
      bloque: "",               // pisos no tiene columna bloque
      vivienda: p.vivienda,
      nombre: p.nombre,
      telefono: p.telefono,
      presentacion_enviada: "", // no aplica en pisos
    }));
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
    const norm = (P && P.normalizarCodigoPiso) || (s => String(s || "").trim().toUpperCase().replace(/\s+/g, "").replace(/[()ºª/]/g, ""));
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

    // 3. Construir fila para la pestaña pisos.
    //    pisos!A:AB → telefono, comunidad, vivienda, nombre, ... (28 cols).
    //    Al editar: leemos la fila vieja y conservamos el resto de columnas
    //    (estado, fechas, documentos, etc.) que no son editables desde aquí.
    let fila;
    if (_rowIndex) {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `pisos!A${_rowIndex}:AB${_rowIndex}`,
      });
      const filaVieja = (r.data.values && r.data.values[0]) || [];
      fila = [...filaVieja];
      while (fila.length < 28) fila.push("");
      fila[0] = telefono;
      fila[1] = comu.direccion;
      fila[2] = codigoPiso;
      // fila[3] = col D `nota_simple` -> NO se gestiona desde aquí (la rellena el bot
      // o se importa desde el Excel histórico).
      fila[4] = nombre;          // col E `nombre` (titular del contrato EMASESA)

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `pisos!A${_rowIndex}:AB${_rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      // Alta: fila nueva. Pisos siempre se dan de alta en fase 05+, así que
      // los dos primeros docs (piso_toma_datos, piso_nif_toma_datos) se
      // sembran como "F". El resto de docs queda vacío ("·").
      // Estados manuales del piso: cols AC-AS = índices 28-44 del array.
      // Orden según `documentos_manuales` (PISO) -> idx 0=piso_toma_datos,
      // idx 1=piso_nif_toma_datos -> cols AC y AD.
      fila = new Array(45).fill("");
      fila[0] = telefono;
      fila[1] = comu.direccion;
      fila[2] = codigoPiso;
      // fila[3] = col D `nota_simple` -> queda vacío en alta manual
      fila[4] = nombre;          // col E `nombre` (titular del contrato EMASESA)
      fila[28] = "F";            // col AC: piso_toma_datos
      fila[29] = "F";            // col AD: piso_nif_toma_datos
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_EXPEDIENTES,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }

    return { ok: true, piso: { direccion: comu.direccion, vivienda: codigoPiso, nombre, telefono } };
  }

  // Borrar piso (físico): borra una fila de la pestaña pisos.
  // (Antes borraba en vecinos_base + expedientes. Ahora vecinos_base no se toca.)
  async function borrarPiso(comu, _rowIndex) {
    if (!_rowIndex) return { ok: false, error: "Falta _rowIndex" };
    const sheets = getSheets();

    // Verificar que la fila existe
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `pisos!A${_rowIndex}:AB${_rowIndex}`,
    });
    const fila = (r.data.values && r.data.values[0]) || [];
    if (!fila[0] && !fila[1] && !fila[2]) return { ok: false, error: "Fila vacía o no existe" };

    const sheetIds = await getSheetIds();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetIds.pisos,
              dimension: "ROWS",
              startIndex: _rowIndex - 1,
              endIndex: _rowIndex,
            },
          },
        }],
      },
    });

    return { ok: true };
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

    // Helper: extraer del array fila los campos que el cliente necesita para
    // refrescar la cajita sin recargar la página. Mantiene el mismo formato
    // que devuelve leerExpedientes() para que expedientesPorTlf[tlf] sea
    // un drop-in replacement en cliente.
    function expedienteDesdeFila(fila) {
      return {
        telefono:                          fila[0]  || "",
        estado_expediente:                 fila[7]  || "",
        documentos_recibidos:              fila[15] || "",
        documentos_pendientes:             fila[16] || "",
        documentos_recibidos_sin_archivo:  fila[26] || "",
        documentos_no_aplica:              fila[27] || "",
      };
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
        range: "pisos!A:AB",
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
      return { ok: true, creado: true, expediente: expedienteDesdeFila(fila) };
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
      range: `pisos!A${exp._rowIndex}:AB${exp._rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [filaExp] },
    });
    return { ok: true, creado: false, expediente: expedienteDesdeFila(filaExp) };
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
    // Total dinámico de documentos relevantes para este piso:
    //   total = 23 (universal) − marcados como "no aplica"
    //   hechos = recibidos con archivo + recibidos sin archivo
    //   (los "no aplica" se descuentan del total, no cuentan como "hechos").
    const TOTAL_UNIV = DOCS_UNIVERSAL.length;
    let docsHechos = 0, docsTotalRelevante = TOTAL_UNIV, docsHtml = `<span class="ptl-vec-docs-tag ptl-vec-docs-rojo">—</span>`;
    if (exp) {
      const recibidos = (exp.documentos_recibidos || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const sinArch   = (exp.documentos_recibidos_sin_archivo || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const noAplica  = (exp.documentos_no_aplica || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const hechosSet = new Set([...recibidos, ...sinArch]);
      const noAplicaSet = new Set(noAplica);
      docsHechos = hechosSet.size;
      docsTotalRelevante = TOTAL_UNIV - noAplicaSet.size;
      const cls = (docsTotalRelevante > 0 && docsHechos >= docsTotalRelevante) ? "ptl-vec-docs-verde" : "ptl-vec-docs-rojo";
      docsHtml = `<span class="ptl-vec-docs-tag ${cls}">${docsHechos}/${docsTotalRelevante}</span>`;
    } else if (!tlf) {
      docsHtml = `<span class="ptl-vec-docs-tag ptl-vec-docs-gris">—</span>`;
    } else {
      // Tiene teléfono pero no expediente: 0/23 en rojo
      docsHtml = `<span class="ptl-vec-docs-tag ptl-vec-docs-rojo">0/${TOTAL_UNIV}</span>`;
    }
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
      <td class="ptl-vec-docs">${docsHtml}</td>
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

  // =================================================================
  // CAJITA "DATOS PISOS" (basada en documentos_manuales)
  // Pinta:
  //   - Fila virtual del CCPP con sus 9 documentos
  //   - Una fila por cada piso real con sus 17 documentos
  // Cada documento se representa como un botón redondo con el valor
  // del estado dentro (OK/OP/NP/F/6/12/18/CCPP) y color según estado:
  //   rojo  = F o vacío
  //   verde = cualquier otro
  // Click en el botón -> menú para cambiar el estado.
  // =================================================================

  function calcularResumenManual(estados, docs) {
    // estados: array ordenado paralelo a docs
    // docs:    lista [{codigo, label, ...}]
    //
    // Reglas del contador (acordadas en sesión 04/05/2026):
    //   - OP, NP y vacío  -> NO cuentan ni en total ni en hechos
    //   - F                -> cuenta en total (pendiente)
    //   - OK / 6 / 12 / 18 / CCPP -> cuenta en total y en hechos
    //
    // Ejemplo: piso con 3 OK, 1 F, 8 OP, 3 vacíos -> 3/4
    let hechos = 0, totalRel = 0;
    for (let i = 0; i < docs.length; i++) {
      const e = (estados[i] || "").trim();
      if (e === "OP" || e === "NP" || e === "") continue;
      totalRel++;
      if (e === "OK" || e === "6" || e === "12" || e === "18" || e === "FFCC") {
        hechos++;
      }
      // F: cuenta en totalRel pero no en hechos.
    }
    return { hechos, totalRel };
  }

  function filaManualHtml(opciones) {
    const { id, etiquetaPiso, nombre, telefono, docs, estados, esc, esCcpp,
            rowIndex, viviendaOrig, nombreOrig, telefonoOrig } = opciones;
    const { hechos, totalRel } = calcularResumenManual(estados, docs);
    const cls = (totalRel > 0 && hechos >= totalRel) ? "ptl-vec-docs-verde" : "ptl-vec-docs-rojo";
    const docsHtml = `<span class="ptl-vec-docs-tag ${cls}">${hechos}/${totalRel}</span>`;
    const filaCss = esCcpp ? "ptl-vec-fila ptl-vec-fila-ccpp" : "ptl-vec-fila";
    // Botón 📄 (acordeón) siempre visible.
    const btnAcordeonHtml =
      `<button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon" title="Ver documentación">📄</button>`;
    // Fila CCPP: vivienda fija "Comunidad de propietarios", sin inputs ni acciones de guardar/borrar.
    // Fila piso: tres inputs editables (vivienda, nombre, teléfono) + botones ＋ y ✕.
    const acciones = esCcpp
      ? ``
      : `<button type="button" class="ptl-vec-btn ptl-vec-btn-guardar" title="Guardar cambios" disabled>＋</button>`
        + `<button type="button" class="ptl-vec-btn ptl-vec-btn-borrar" title="Eliminar piso">✕</button>`;
    // Datasets adicionales solo en filas de piso. Se usan tanto para borrarFila()
    // como para detectar cambios (dirty) y guardar via /piso/guardar.
    const dataExtra = esCcpp ? "" :
        ` data-row-index="${esc(String(rowIndex || ""))}"`
      + ` data-vivienda-orig="${esc(viviendaOrig || "")}"`
      + ` data-nombre-orig="${esc(nombreOrig || "")}"`
      + ` data-telefono-orig="${esc(telefonoOrig || "")}"`;
    // Celdas vivienda/nombre/teléfono: en filas de piso se renderizan como inputs
    // editables (igual que la cajita vieja); en la fila CCPP se mantienen como
    // texto plano porque no procede editarlas.
    // autocomplete="off" evita que el navegador rellene los inputs con el último
    // valor tecleado al recargar la página, lo que haría aparecer la fila como
    // "dirty" y dejaría el botón ＋ activo erróneamente tras un guardado.
    const celdaVivienda = esCcpp
      ? `<td>${esc(etiquetaPiso || "")}</td>`
      : `<td><input type="text" class="ptl-vec-input ptl-vec-vivienda" value="${esc(etiquetaPiso || "")}" placeholder="0A" maxlength="20" autocomplete="off"/></td>`;
    const celdaNombre = esCcpp
      ? `<td>${esc(nombre || "")}</td>`
      : `<td><input type="text" class="ptl-vec-input ptl-vec-nombre" value="${esc(nombre || "")}" placeholder="Nombre y apellidos" autocomplete="off"/></td>`;
    const celdaTelefono = esCcpp
      ? `<td>${esc(telefono || "")}</td>`
      : `<td><input type="text" class="ptl-vec-input ptl-vec-telefono" value="${esc(telefono || "")}" placeholder="600 000 000" autocomplete="off"/></td>`;
    return `<tr class="${filaCss}" data-manual-id="${esc(id)}"${dataExtra}>
      ${celdaVivienda}
      <td class="ptl-vec-acciones">${btnAcordeonHtml}</td>
      ${celdaNombre}
      ${celdaTelefono}
      <td class="ptl-vec-docs">${docsHtml}</td>
      <td class="ptl-vec-acciones">${acciones}</td>
    </tr>
    <tr class="ptl-vec-acordeon-fila" style="display:none">
      <td colspan="6" class="ptl-vec-acordeon-cont"></td>
    </tr>`;
  }

  function cajitaManualHtml({ comu, pisos, expedientes, docsManuales, estadosCcpp, esc, fmtTlf, token }) {
    const docsPisoCompletos = docsManuales.piso || [];
    const docsCcppCompletos = docsManuales.ccpp || [];

    // ----- Detectar modo de la cajita según la fase del CCPP -----
    // Modo 05 (fases 05, 06, 07_PTE_CYCP): los 4 docs *_contrato y *_pago se ocultan;
    //   los demás (7 CCPP, 15 piso) son los que se rellenan.
    //   La fase 07_PTE_CYCP es de espera (esperando contratos de EMASESA), todavía
    //   no hay nada que tramitar de contratos/pagos.
    // Modo 08 (fases 08_CYCP, ZZ_*): los 4 docs *_contrato y *_pago son los
    //   prioritarios y se muestran ARRIBA con estética actual; los 7/15
    //   anteriores van debajo en estilo "tenue" (consultivos pero editables).
    const faseActual = (comu && (comu.fase || comu.fase_presupuesto) || "").trim();
    const FASES_MODO_07 = new Set([
      "08_CYCP",
      "ZZ_RECHAZADO", "ZZ_DESCARTADO",
    ]);
    const modoFase07 = FASES_MODO_07.has(faseActual);

    // Lista de los 4 documentos contrato/pago. En modo 05 se OCULTAN; en modo 07
    // se EXTRAEN al bloque superior y los demás van al bloque inferior tenue.
    const COD_CONTRATO_PAGO = new Set([
      "ccpp_contrato", "ccpp_pago",
      "piso_contrato", "piso_pago",
    ]);

    // ----- Filtrado CCPP -----
    // Visibles principales (bloque arriba) y secundarios (bloque tenue, solo
    // en modo 07). En modo 05 los secundarios quedan vacíos (el bloque
    // tenue no se renderiza).
    const docsCcpp = [];          // bloque principal
    const estadosCcppFiltrados = [];
    const docsCcppPrev = [];      // bloque "previa" (solo modo 07)
    const estadosCcppPrev = [];
    for (let i = 0; i < docsCcppCompletos.length; i++) {
      const d = docsCcppCompletos[i];
      const e = estadosCcpp[i] || "";
      const esContratoPago = COD_CONTRATO_PAGO.has(d.codigo);
      if (modoFase07) {
        if (esContratoPago) { docsCcpp.push(d); estadosCcppFiltrados.push(e); }
        else                { docsCcppPrev.push(d); estadosCcppPrev.push(e); }
      } else {
        if (esContratoPago) continue; // oculto en modo 05
        docsCcpp.push(d); estadosCcppFiltrados.push(e);
      }
    }

    // ----- Filtrado piso -----
    // Mismo criterio. Guardamos los índices originales para luego filtrar los
    // estados de cada piso (que vienen alineados a docsPisoCompletos).
    const docsPiso = [];          // bloque principal
    const idxPisoVisibles = [];
    const docsPisoPrev = [];      // bloque "previa" (solo modo 07)
    const idxPisoPrev = [];
    for (let i = 0; i < docsPisoCompletos.length; i++) {
      const d = docsPisoCompletos[i];
      const esContratoPago = COD_CONTRATO_PAGO.has(d.codigo);
      if (modoFase07) {
        if (esContratoPago) { docsPiso.push(d);     idxPisoVisibles.push(i); }
        else                { docsPisoPrev.push(d); idxPisoPrev.push(i); }
      } else {
        if (esContratoPago) continue;
        docsPiso.push(d); idxPisoVisibles.push(i);
      }
    }

    // Si no hay documentos definidos, mostrar mensaje de configuración
    if (docsPiso.length === 0 && docsCcpp.length === 0) {
      return `<div class="ptl-card" style="margin-top:12px">
        <div class="ptl-card-title">DATOS DOCUMENTACION</div>
        <div style="padding:12px;color:#666">
          La pestaña <code>documentos_manuales</code> está vacía.
          Añade filas con los documentos que quieres gestionar y recarga la página.
        </div>
      </div>`;
    }

    // Indexar expedientes por (comunidad+vivienda). Antes se indexaba por
    // teléfono, pero los pisos pueden no tener teléfono (alta sin contacto
    // todavía), así que usar el teléfono como clave excluía a esos pisos
    // del cruce con sus estados manuales del Sheet.
    function claveExp(comunidad, vivienda) {
      const c = (comunidad || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ").trim().toLowerCase();
      const v = (vivienda || "").toString().trim().toLowerCase();
      return c + "|" + v;
    }
    const expByPiso = {};
    for (const e of expedientes) {
      const k = claveExp(e.comunidad, e.vivienda);
      if (k.length > 1) expByPiso[k] = e;
    }

    // ----- Fila CCPP virtual -----
    const filaCcppHtml = filaManualHtml({
      id: "ccpp",
      etiquetaPiso: "",
      nombre: "Comunidad de propietarios",
      telefono: "",
      docs: docsCcpp,
      estados: estadosCcppFiltrados,
      esc, esCcpp: true,
    });
    const dataCcpp = {
      docs: docsCcpp.map(d => ({ codigo: d.codigo, label: d.label, permiteFinanciacion: d.permiteFinanciacion })),
      estados: estadosCcppFiltrados,
      // Bloque "previa" (solo en modo 07; en modo 05 va vacío y no se renderiza)
      docsPrev: docsCcppPrev.map(d => ({ codigo: d.codigo, label: d.label, permiteFinanciacion: d.permiteFinanciacion })),
      estadosPrev: estadosCcppPrev,
    };

    // ----- Filas de los pisos -----
    // Helper: dado un array de los 17 estados completos del piso, devuelve solo
    // los que corresponden a documentos visibles en esta fase.
    function filtrarEstadosPiso(estadosCompletos) {
      const out = [];
      for (const idx of idxPisoVisibles) out.push(estadosCompletos[idx] || "");
      return out;
    }
    // Variante para los docs "previos" (solo se usa en modo 07).
    function filtrarEstadosPisoPrev(estadosCompletos) {
      const out = [];
      for (const idx of idxPisoPrev) out.push(estadosCompletos[idx] || "");
      return out;
    }
    const filasPisosHtml = pisos.map(p => {
      const tlfFmt = fmtTlf(p.telefono) || "";
      const exp = expByPiso[claveExp(p.comunidad || comu.direccion || comu.comunidad, p.vivienda)] || null;
      const estadosCompletos = exp && exp._estadosManualesPiso ? exp._estadosManualesPiso : new Array(docsPisoCompletos.length).fill("");
      const estadosFiltrados = filtrarEstadosPiso(estadosCompletos);
      return filaManualHtml({
        id: "piso-" + (p.vivienda || ""),
        etiquetaPiso: p.vivienda || "",
        nombre: p.nombre || "",
        telefono: tlfFmt,
        docs: docsPiso,
        estados: estadosFiltrados,
        esc,
        // Datos para reutilizar la función borrarFila() de la cajita vieja
        // y para detectar cambios (dirty). Los *Orig deben coincidir con el
        // VALOR PINTADO en el input para que filaToString === originalToString
        // al cargar (si no, la fila nace dirty y el botón ＋ se queda activo).
        rowIndex: exp ? exp._rowIndex : "",
        viviendaOrig: p.vivienda || "",
        nombreOrig: p.nombre || "",
        telefonoOrig: tlfFmt,
      });
    }).join("");

    // ----- Datos serializados para el cliente -----
    const dataPisos = pisos.map(p => {
      const exp = expByPiso[claveExp(p.comunidad || comu.direccion || comu.comunidad, p.vivienda)] || null;
      const estadosCompletos = exp && exp._estadosManualesPiso ? exp._estadosManualesPiso : new Array(docsPisoCompletos.length).fill("");
      const estados = filtrarEstadosPiso(estadosCompletos);
      const estadosPrev = filtrarEstadosPisoPrev(estadosCompletos);
      return { id: "piso-" + (p.vivienda || ""), vivienda: p.vivienda || "", estados, estadosPrev };
    });
    const dataDocsPiso     = docsPiso.map(d => ({ codigo: d.codigo, label: d.label, permiteFinanciacion: d.permiteFinanciacion }));
    const dataDocsPisoPrev = docsPisoPrev.map(d => ({ codigo: d.codigo, label: d.label, permiteFinanciacion: d.permiteFinanciacion }));

    // ----- Cálculo del pill global "Faltan X de Y" / "✓ Completo" -----
    // Cuenta filas (CCPP + pisos) y dice cuántas tienen su documentación cerrada.
    function _filaCompleta(estados, docs) {
      const r = calcularResumenManual(estados, docs);
      return r.totalRel > 0 && r.hechos >= r.totalRel;
    }
    let totalFilas = 1; // el CCPP cuenta siempre
    let completas = _filaCompleta(estadosCcppFiltrados, docsCcpp) ? 1 : 0;
    for (const dp of dataPisos) {
      totalFilas++;
      if (_filaCompleta(dp.estados, docsPiso)) completas++;
    }
    let pillHtml = "";
    if (totalFilas > 0) {
      if (completas === totalFilas) {
        pillHtml = `<span class="ptl-vec-pill ptl-vec-pill-verde">✓ Completo</span>`;
      } else {
        pillHtml = `<span class="ptl-vec-pill ptl-vec-pill-rojo">Faltan ${totalFilas - completas} de ${totalFilas}</span>`;
      }
    }

    return `
    <div class="ptl-card ptl-vec-card-manual"
         style="margin-top:12px; background:#FFFFFF"
         data-direccion="${esc(comu.direccion || "")}"
         data-comunidad="${esc(comu.comunidad || "")}"
         data-token="${esc(token || "")}">
      <style>
        .ptl-vec-card-manual { background: #FFFFFF !important; }
        .ptl-vec-card-manual .ptl-vec-fila-ccpp { background: #FEF3C7; }
        .ptl-vec-card-manual .ptl-vec-fila-ccpp td { font-weight: 600; }
        .ptl-vec-card-manual .ptl-vec-doc-fila { display:flex; align-items:center; gap:6px; padding:1px 0; break-inside:avoid; }
        .ptl-vec-card-manual .ptl-vec-doc-btn-manual {
          width: 28px; height: 22px;
          border-radius: 11px;
          border: 1px solid;
          font-size: 10px; font-weight: 700;
          line-height: 1; padding: 0;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          flex: 0 0 auto;
        }
        .ptl-vec-card-manual .ptl-vec-doc-btn-rojo {
          background: #FEE2E2; color: #991B1B; border-color: #FCA5A5;
        }
        .ptl-vec-card-manual .ptl-vec-doc-btn-rojo:hover { background: #FCA5A5; color: white; }
        .ptl-vec-card-manual .ptl-vec-doc-btn-amarillo {
          background: #FEF3C7; color: #92400E; border-color: #FCD34D;
        }
        .ptl-vec-card-manual .ptl-vec-doc-btn-amarillo:hover { background: #FCD34D; color: white; }
        .ptl-vec-card-manual .ptl-vec-doc-btn-verde {
          background: #D1FAE5; color: #065F46; border-color: #6EE7B7;
        }
        .ptl-vec-card-manual .ptl-vec-doc-btn-verde:hover { background: #6EE7B7; color: white; }
        /* Separador entre el bloque actual y el bloque "Documentación previa" (modo 07) */
        .ptl-vec-card-manual .ptl-vec-doc-sep {
          margin: 12px 0 6px 0;
          padding-top: 8px;
          border-top: 1px dashed #D1D5DB;
          font-size: 11px;
          font-weight: 600;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        /* Bloque "previa": fondo gris muy claro y opacidad reducida en los botones,
           pero plenamente editables. El hover los devuelve a opacidad completa
           para reforzar visualmente que se pueden tocar. */
        .ptl-vec-card-manual .ptl-vec-doc-lista-prev {
          background: #F9FAFB;
          border-radius: 6px;
          padding: 6px 8px;
        }
        .ptl-vec-card-manual .ptl-vec-doc-fila-prev { color: #6B7280; }
        .ptl-vec-card-manual .ptl-vec-doc-btn-prev { opacity: 0.72; }
        .ptl-vec-card-manual .ptl-vec-doc-btn-prev:hover { opacity: 1; }
        .ptl-vec-card-manual-menu {
          position: fixed; z-index: 9999;
          background: white;
          border: 1px solid #C7DDF7;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 4px 0;
          min-width: 90px;
        }
        .ptl-vec-card-manual-menu button {
          display: block; width: 100%;
          padding: 5px 12px;
          border: none; background: transparent;
          text-align: left; cursor: pointer;
          font-size: 12px;
        }
        .ptl-vec-card-manual-menu button:hover { background: #DBEAFE; }

        /* Compactación de la tabla de pisos (DATOS DOCUMENTACION) */
        .ptl-vec-tabla tbody td { padding: 0 6px; font-size: 11px; line-height: 1.05; }
        .ptl-vec-tabla .ptl-vec-input { padding: 0 6px; font-size: 11px; }
        .ptl-vec-tabla .ptl-vec-btn { width: 18px; height: 18px; font-size: 9px; }
        .ptl-vec-tabla .ptl-vec-acciones { white-space: nowrap; }
      </style>
      <div class="ptl-card-title-row" style="display:flex; align-items:center; gap:8px;">
        <span class="ptl-card-title">DATOS DOCUMENTACION</span>
        <button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-vec-btn-anadir-manual" style="margin-left:auto">+ Añadir piso</button>
        <span class="ptl-vec-pill-cont">${pillHtml}</span>
      </div>
      <table class="ptl-vec-tabla">
        <thead>
          <tr>
            <th style="width:76px">Piso</th>
            <th style="width:36px"></th>
            <th>Nombre</th>
            <th style="width:96px">Teléfono</th>
            <th style="width:54px">Docs</th>
            <th style="width:64px"></th>
          </tr>
        </thead>
        <tbody class="ptl-vec-tbody-manual">
          ${filaCcppHtml}
          ${filasPisosHtml}
        </tbody>
      </table>
      <script>
        (function() {
          const dataCcpp        = ${JSON.stringify(dataCcpp)};
          const dataPisos       = ${JSON.stringify(dataPisos)};
          const dataDocsPiso    = ${JSON.stringify(dataDocsPiso)};
          const dataDocsPisoPrev = ${JSON.stringify(dataDocsPisoPrev)};
          const URL_BORRAR      = ${JSON.stringify(urlT(token, "/documentacion/piso/borrar"))};
          const URL_GUARDAR     = ${JSON.stringify(urlT(token, "/documentacion/piso/guardar"))};

          // Estados disponibles según el documento
          // Norma general:        OK / F / ·
          // ccpp_pago:             OK / F / FFCC / ·  (la CCPP puede asumir el pago)
          // piso_pago:             OK / F / 6 / 12 / 18 / FFCC / ·  (F = pendiente, sin financiar todavía)
          // piso_meses_financiar:  6 / 12 / 18 / FFCC / ·
          const ESTADOS_BASICOS    = ['OK', 'F', ''];
          const ESTADOS_CCPP_PAGO  = ['OK', 'F', 'FFCC', ''];
          const ESTADOS_PISO_PAGO  = ['OK', 'F', '6', '12', '18', 'FFCC', ''];
          const ESTADOS_MESES      = ['6', '12', '18', 'FFCC', ''];
          const COD_MESES_FIN      = 'piso_meses_financiar';

          function escHtml(s) {
            return String(s == null ? '' : s)
              .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          }

          // Texto que va dentro del botón.
          // Para vacío: punto · (sin estado conocido)
          // Para F: la letra F
          // Para los demás estados: el valor literal (OK, OP, NP, 6, 12, 18, CCPP)
          function textoBoton(estado) {
            if (!estado) return '·';
            return estado;
          }
          function colorBoton(estado) {
            if (!estado) return 'amarillo';
            if (estado === 'F') return 'rojo';
            if (estado === 'NP') return 'rojo';
            if (estado === 'OP') return 'amarillo';
            return 'verde';
          }

          // Construye el HTML de un bloque (lista de docs).
          // 'esPrev' marca los del bloque "previa" (modo 07): añade clase tenue
          // y data-prev=1 al botón para localizarlos al refrescar.
          function htmlBloqueDocs(docs, estados, esPrev) {
            return docs.map((d, i) => {
              const e = (estados[i] || '').trim();
              const txt   = textoBoton(e);
              const color = colorBoton(e);
              return '<div class="ptl-vec-doc-fila' + (esPrev ? ' ptl-vec-doc-fila-prev' : '') + '">' +
                '<button type="button" class="ptl-vec-doc-btn-manual ptl-vec-doc-btn-' + color + (esPrev ? ' ptl-vec-doc-btn-prev' : '') + '"' +
                  ' data-codigo="' + escHtml(d.codigo) + '"' +
                  ' data-indice="' + i + '"' +
                  ' data-permite-fin="' + (d.permiteFinanciacion ? '1' : '0') + '"' +
                  (esPrev ? ' data-prev="1"' : '') +
                  ' title="' + escHtml(d.label) + '">' +
                  escHtml(txt) +
                '</button>' +
                '<span>' + escHtml(d.label) + '</span>' +
                '</div>';
            }).join('');
          }
          // renderAcordeon admite ahora un segundo set opcional (docs "previos"):
          // cuando llega no vacío, se renderiza un separador y el bloque tenue
          // debajo ("Documentación previa").
          function renderAcordeon(cont, docs, estados, docsPrev, estadosPrev) {
            let html = '<div class="ptl-vec-doc-lista">' + htmlBloqueDocs(docs, estados, false) + '</div>';
            if (docsPrev && docsPrev.length) {
              html += '<div class="ptl-vec-doc-sep">Documentación previa</div>'
                    + '<div class="ptl-vec-doc-lista ptl-vec-doc-lista-prev">'
                    + htmlBloqueDocs(docsPrev, estadosPrev || [], true)
                    + '</div>';
            }
            cont.innerHTML = html;
          }

          // ---------- Menú emergente ----------
          let menuActual = null;
          function cerrarMenu() {
            if (menuActual) { menuActual.remove(); menuActual = null; }
          }
          function abrirMenu(btn) {
            cerrarMenu();
            const codigo = btn.dataset.codigo || '';
            const permiteFin = btn.dataset.permiteFin === '1';
            let opciones;
            if (codigo === 'ccpp_pago')        opciones = ESTADOS_CCPP_PAGO;
            else if (codigo === 'piso_pago')   opciones = ESTADOS_PISO_PAGO;
            else if (codigo === COD_MESES_FIN) opciones = ESTADOS_MESES;
            else                               opciones = ESTADOS_BASICOS;
            const menu = document.createElement('div');
            menu.className = 'ptl-vec-card-manual-menu';
            menu.innerHTML = opciones.map(op =>
              '<button type="button" data-op="' + escHtml(op) + '">' + escHtml(op || '·') + '</button>'
            ).join('');
            document.body.appendChild(menu);
            // Posicionar
            const r = btn.getBoundingClientRect();
            const mt = r.bottom + 4;
            const ml = r.left;
            menu.style.top  = mt + 'px';
            menu.style.left = ml + 'px';
            // Reposicionar si se sale por la derecha o abajo
            const mr = menu.getBoundingClientRect();
            if (mr.right > window.innerWidth)  menu.style.left = (window.innerWidth - mr.width - 8) + 'px';
            if (mr.bottom > window.innerHeight) menu.style.top  = (r.top - mr.height - 4) + 'px';
            menuActual = menu;

            menu.addEventListener('click', async ev => {
              const opBtn = ev.target.closest('button[data-op]');
              if (!opBtn) return;
              const op = opBtn.dataset.op;
              cerrarMenu();
              // Capturar estado anterior para poder revertir si falla
              const card = btn.closest('.ptl-vec-card-manual');
              const direccion = card ? (card.dataset.direccion || card.dataset.comunidad || '') : '';
              const token = card ? (card.dataset.token || '') : '';
              const filaAcord = btn.closest('tr.ptl-vec-acordeon-fila');
              const filaPiso  = filaAcord ? filaAcord.previousElementSibling : null;
              const id        = filaPiso ? filaPiso.dataset.manualId : '';
              const nivel     = (id === 'ccpp') ? 'ccpp' : 'piso';
              let vivienda    = '';
              if (nivel === 'piso') {
                const dp = dataPisos.find(p => p.id === id);
                if (dp) vivienda = dp.vivienda || '';
              }
              const idx       = parseInt(btn.dataset.indice, 10);
              const codigo    = btn.dataset.codigo;
              const estadoPrevio = textoEstadoActual(btn);

              // Cambio visual optimista
              actualizarBoton(btn, op);

              // Llamada al servidor
              try {
                const fd = new URLSearchParams();
                fd.append('ccpp_clave', direccion);
                fd.append('vivienda',   vivienda);
                fd.append('nivel',      nivel);
                fd.append('codigo',     codigo);
                fd.append('estado',     op);
                if (token) fd.append('token', token);
                const r = await fetch('/documentacion/manual/marcar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: fd.toString(),
                });
                let data;
                try { data = await r.json(); }
                catch (parseErr) {
                  throw new Error('Respuesta no válida del servidor (HTTP ' + r.status + ')');
                }
                if (!data.ok) {
                  throw new Error(data.error || 'Error guardando');
                }
                // OK: el cambio queda persistido
              } catch (err) {
                console.error('[manual/marcar]', err);
                // Revertir cambio visual
                actualizarBoton(btn, estadoPrevio);
                alert('No se pudo guardar: ' + (err.message || err));
              }
            });
            // Cierre por click fuera
            setTimeout(() => {
              document.addEventListener('click', cerrarMenuFuera, { once: true });
            }, 0);
          }
          function cerrarMenuFuera(ev) {
            if (menuActual && !menuActual.contains(ev.target)) cerrarMenu();
            else document.addEventListener('click', cerrarMenuFuera, { once: true });
          }

          // Lee el estado actual del botón a partir de su texto/color.
          // Devuelve: F | OK | OP | NP | 6 | 12 | 18 | CCPP
          function textoEstadoActual(btn) {
            const txt = (btn.textContent || '').trim();
            if (!txt || txt === '·') return 'F';
            return txt;
          }

          function actualizarBoton(btn, nuevoEstado) {
            // Cambia el texto y el color del botón en pantalla
            btn.textContent = textoBoton(nuevoEstado);
            btn.classList.remove('ptl-vec-doc-btn-rojo', 'ptl-vec-doc-btn-amarillo', 'ptl-vec-doc-btn-verde');
            btn.classList.add('ptl-vec-doc-btn-' + colorBoton(nuevoEstado));
            // Actualizar estado en la cache local del piso/CCPP correspondiente
            const fila = btn.closest('tr.ptl-vec-acordeon-fila');
            if (!fila) return;
            const filaPiso = fila.previousElementSibling;
            if (!filaPiso) return;
            const id = filaPiso.dataset.manualId;
            const idx = parseInt(btn.dataset.indice, 10);
            const esPrev = btn.dataset.prev === '1';
            if (id === 'ccpp') {
              if (esPrev) {
                if (Array.isArray(dataCcpp.estadosPrev)) dataCcpp.estadosPrev[idx] = nuevoEstado;
              } else {
                dataCcpp.estados[idx] = nuevoEstado;
              }
            } else {
              const dp = dataPisos.find(p => p.id === id);
              if (dp) {
                if (esPrev) {
                  if (Array.isArray(dp.estadosPrev)) dp.estadosPrev[idx] = nuevoEstado;
                } else {
                  dp.estados[idx] = nuevoEstado;
                }
              }
            }
            // Los cambios en docs "previos" no alteran el contador X/Y ni el pill
            // global (solo cuentan los del bloque principal de la fase actual).
            if (!esPrev) recalcularDocs(filaPiso);
          }

          function recalcularDocs(filaPiso) {
            const id = filaPiso.dataset.manualId;
            let estados, docs;
            if (id === 'ccpp') {
              estados = dataCcpp.estados;
              docs    = dataCcpp.docs;
            } else {
              const dp = dataPisos.find(p => p.id === id);
              if (!dp) return;
              estados = dp.estados;
              docs    = dataDocsPiso;
            }
            let hechos = 0, totalRel = 0;
            for (let i = 0; i < docs.length; i++) {
              const e = (estados[i] || '').trim();
              if (e === 'OP' || e === 'NP' || e === '') continue;
              totalRel++;
              if (e === 'OK' || e === '6' || e === '12' || e === '18' || e === 'FFCC') hechos++;
            }
            const cls = (totalRel > 0 && hechos >= totalRel) ? 'ptl-vec-docs-verde' : 'ptl-vec-docs-rojo';
            const tag = filaPiso.querySelector('.ptl-vec-docs-tag');
            if (tag) {
              tag.className = 'ptl-vec-docs-tag ' + cls;
              tag.textContent = hechos + '/' + totalRel;
            }
            // Recalcular pill global
            recalcularPill();
          }

          // Calcula si una fila (CCPP o piso) está completa según sus estados.
          // Aplica la misma regla que calcularResumenManual() del servidor:
          //   OP/NP/vacío fuera del total; F en total no en hechos;
          //   OK/6/12/18/FFCC en total y en hechos.
          function _filaCompletaCli(estados, docs) {
            let hechos = 0, totalRel = 0;
            for (let i = 0; i < docs.length; i++) {
              const e = (estados[i] || '').trim();
              if (e === 'OP' || e === 'NP' || e === '') continue;
              totalRel++;
              if (e === 'OK' || e === '6' || e === '12' || e === '18' || e === 'FFCC') hechos++;
            }
            return totalRel > 0 && hechos >= totalRel;
          }

          // Recalcula el pill "Faltan X de Y" / "✓ Completo" en la cabecera
          function recalcularPill() {
            let total = 1; // CCPP cuenta siempre
            let completas = _filaCompletaCli(dataCcpp.estados, dataCcpp.docs) ? 1 : 0;
            for (const dp of dataPisos) {
              total++;
              if (_filaCompletaCli(dp.estados, dataDocsPiso)) completas++;
            }
            const cont = document.querySelector('.ptl-vec-card-manual .ptl-vec-pill-cont');
            if (!cont) return;
            if (total === 0) { cont.innerHTML = ''; return; }
            if (completas === total) {
              cont.innerHTML = '<span class="ptl-vec-pill ptl-vec-pill-verde">✓ Completo</span>';
            } else {
              cont.innerHTML = '<span class="ptl-vec-pill ptl-vec-pill-rojo">Faltan ' + (total - completas) + ' de ' + total + '</span>';
            }
          }

          // ---------- Borrar piso ----------
          // Replica la lógica de borrarFila() de la cajita vieja:
          //   - mensaje de confirmación que incluye vivienda, nombre y teléfono
          //   - POST a /documentacion/piso/borrar con direccion + rowIndex
          //   - recarga la página entera (silenciando el aviso de beforeunload
          //     del módulo presupuestos.cjs).
          // Decisión 04/05/2026: opción A (recarga completa) por simplicidad
          // y porque borrar un piso es una acción rara.
          function fmtTlfCliManual(s) {
            if (!s) return '';
            let d = String(s).replace(/\\D/g, '');
            if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 9) return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6);
            return String(s);
          }
          async function borrarFilaManual(fila) {
            const ri  = fila.dataset.rowIndex || '';
            if (!ri) return; // sin fila en Sheet, no se puede borrar
            const viv = fila.dataset.viviendaOrig || '';
            const nom = fila.dataset.nombreOrig   || '';
            const tlf = fila.dataset.telefonoOrig || '';

            let mensaje = 'Vas a borrar el piso ' + viv;
            if (nom) mensaje += ' · ' + nom;
            if (tlf) mensaje += ' · ' + fmtTlfCliManual(tlf);
            mensaje += '.';
            mensaje += '\\n\\nEsta acción NO se puede deshacer. ¿Continuar?';

            if (!confirm(mensaje)) return;

            // Leer direccion + token del card (igual que en otros handlers)
            const card = fila.closest('.ptl-vec-card-manual');
            const direccion = card ? (card.dataset.direccion || card.dataset.comunidad || '') : '';

            const fd = new URLSearchParams();
            fd.append('direccion', direccion);
            fd.append('rowIndex',  ri);
            try {
              const resp = await fetch(URL_BORRAR, { method: 'POST', body: fd });
              const data = await resp.json();
              if (!data.ok) { alert(data.error || 'Error borrando'); return; }
              // Recarga silenciosa (igual que la cajita vieja)
              window.__ptlVecDirty = false;
              window.ptlEliminando = true;
              if (window.__ptlVecBeforeUnloadHandler) {
                window.removeEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
                window.__ptlVecBeforeUnloadHandler = null;
              }
              window.location.reload();
            } catch (e) {
              alert('Error de red: ' + e.message);
            }
          }

          // ---------- Añadir / Guardar piso (portado de la cajita vieja) ----------
          // Inserta una fila editable al principio del tbody. La fila no existe
          // todavía en el Sheet; al darle al ＋ se hace POST a /piso/guardar y
          // recargamos la página.
          function anadirFilaNuevaManual() {
            const tbody = document.querySelector('.ptl-vec-tbody-manual');
            if (!tbody) return;
            if (tbody.querySelector('.ptl-vec-nueva')) {
              const inp = tbody.querySelector('.ptl-vec-nueva .ptl-vec-vivienda');
              if (inp) inp.focus();
              return;
            }
            const tr = document.createElement('tr');
            tr.className = 'ptl-vec-fila ptl-vec-nueva ptl-vec-dirty';
            tr.dataset.manualId = 'piso-nuevo';
            tr.dataset.rowIndex = '';
            tr.dataset.viviendaOrig = '';
            tr.dataset.nombreOrig = '';
            tr.dataset.telefonoOrig = '';
            // Mismo número de columnas que las filas de piso (6):
            //   PISO | 📄 | NOMBRE | TELÉFONO | DOCS | acciones (＋ ✕)
            // Para fila nueva el botón 📄 no tiene sentido (aún no hay docs);
            // lo dejamos visible pero sin acción hasta guardar.
            tr.innerHTML = ''
              + '<td><input type="text" class="ptl-vec-input ptl-vec-vivienda" value="" placeholder="0A" maxlength="20"/></td>'
              + '<td class="ptl-vec-acciones"><button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon" disabled title="Guarda primero">📄</button></td>'
              + '<td><input type="text" class="ptl-vec-input ptl-vec-nombre" value="" placeholder="Nombre y apellidos"/></td>'
              + '<td><input type="text" class="ptl-vec-input ptl-vec-telefono" value="" placeholder="600 000 000"/></td>'
              + '<td class="ptl-vec-docs"><span class="ptl-vec-docs-tag" style="background:#E5E7EB;color:#6B7280">—</span></td>'
              + '<td class="ptl-vec-acciones">'
              + '<button type="button" class="ptl-vec-btn ptl-vec-btn-guardar" title="Guardar cambios">＋</button>'
              + '<button type="button" class="ptl-vec-btn ptl-vec-btn-borrar" title="Cancelar">✕</button>'
              + '</td>';
            const tr2 = document.createElement('tr');
            tr2.className = 'ptl-vec-acordeon-fila';
            tr2.style.display = 'none';
            tr2.innerHTML = '<td colspan="6" class="ptl-vec-acordeon-cont"></td>';
            tbody.insertBefore(tr2, tbody.firstChild);
            tbody.insertBefore(tr, tbody.firstChild);
            const inp = tr.querySelector('.ptl-vec-vivienda');
            if (inp) inp.focus();
            actualizarFlagSalir();
          }

          function filaToString(fila) {
            const v = fila.querySelector('.ptl-vec-vivienda');
            const n = fila.querySelector('.ptl-vec-nombre');
            const t = fila.querySelector('.ptl-vec-telefono');
            return [(v && v.value) || '', (n && n.value) || '', (t && t.value) || ''].join('|');
          }
          function originalToString(fila) {
            return [
              fila.dataset.viviendaOrig || '',
              fila.dataset.nombreOrig   || '',
              fila.dataset.telefonoOrig || '',
            ].join('|');
          }
          function actualizarDirty(fila) {
            // Solo se aplica a filas con inputs (filas nuevas o filas editables
            // si en el futuro las hubiera). En las filas estándar de piso no
            // hay inputs y filaToString === originalToString siempre.
            if (!fila.querySelector('.ptl-vec-vivienda')) return;
            const dirty = filaToString(fila) !== originalToString(fila);
            fila.classList.toggle('ptl-vec-dirty', dirty);
            const btn = fila.querySelector('.ptl-vec-btn-guardar');
            if (btn) btn.disabled = !dirty;
            actualizarFlagSalir();
          }
          function actualizarFlagSalir() {
            const tbody = document.querySelector('.ptl-vec-tbody-manual');
            if (!tbody) return;
            const hayDirty = !!tbody.querySelector('.ptl-vec-fila.ptl-vec-dirty');
            window.__ptlVecDirty = hayDirty;
            if (hayDirty && !window.__ptlVecBeforeUnloadHandler) {
              window.__ptlVecBeforeUnloadHandler = function(e) {
                e.preventDefault(); e.returnValue = ''; return '';
              };
              window.addEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
            } else if (!hayDirty && window.__ptlVecBeforeUnloadHandler) {
              window.removeEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
              window.__ptlVecBeforeUnloadHandler = null;
            }
          }
          function recargarSilencioso() {
            window.__ptlVecDirty = false;
            window.ptlEliminando = true;
            if (window.__ptlVecBeforeUnloadHandler) {
              window.removeEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
              window.__ptlVecBeforeUnloadHandler = null;
            }
            window.location.reload();
          }
          async function guardarFilaManual(fila) {
            const card = fila.closest('.ptl-vec-card-manual');
            const direccion = card ? (card.dataset.direccion || card.dataset.comunidad || '') : '';
            const fd = new URLSearchParams();
            fd.append('direccion',  direccion);
            fd.append('codigoPiso', (fila.querySelector('.ptl-vec-vivienda') || {}).value || '');
            fd.append('nombre',     (fila.querySelector('.ptl-vec-nombre')   || {}).value || '');
            fd.append('telefono',   (fila.querySelector('.ptl-vec-telefono') || {}).value || '');
            const ri = fila.dataset.rowIndex || '';
            if (ri) fd.append('rowIndex', ri);
            try {
              const resp = await fetch(URL_GUARDAR, { method: 'POST', body: fd });
              const data = await resp.json();
              if (!data.ok) { alert(data.error || 'Error guardando'); return; }
              recargarSilencioso();
            } catch (e) {
              alert('Error de red: ' + e.message);
            }
          }

          // ---------- Eventos ----------
          const tbody = document.querySelector('.ptl-vec-tbody-manual');
          if (!tbody) return;
          // Al cargar la página, resincronizar los data-*-orig con los valores
          // que realmente tienen los inputs. Así, aunque el servidor haya
          // normalizado el dato (espacios, formato de teléfono, etc.) y el
          // valor pintado no coincida exactamente con lo guardado en el Sheet,
          // la fila arranca "limpia" y el botón ＋ queda desactivado.
          tbody.querySelectorAll('.ptl-vec-fila').forEach(fila => {
            const v = fila.querySelector('.ptl-vec-vivienda');
            const n = fila.querySelector('.ptl-vec-nombre');
            const t = fila.querySelector('.ptl-vec-telefono');
            if (v) fila.dataset.viviendaOrig = v.value || '';
            if (n) fila.dataset.nombreOrig   = n.value || '';
            if (t) fila.dataset.telefonoOrig = t.value || '';
            fila.classList.remove('ptl-vec-dirty');
            const btn = fila.querySelector('.ptl-vec-btn-guardar');
            if (btn) btn.disabled = true;
          });
          // Botón "+ Añadir piso" en la cabecera
          const btnAnadir = document.querySelector('.ptl-vec-btn-anadir-manual');
          if (btnAnadir) btnAnadir.addEventListener('click', anadirFilaNuevaManual);
          // Marca dirty al teclear en una fila editable
          tbody.addEventListener('input', e => {
            if (!e.target.matches('.ptl-vec-input')) return;
            const fila = e.target.closest('.ptl-vec-fila');
            if (fila) actualizarDirty(fila);
          });
          tbody.addEventListener('click', e => {
            // Click en botón de estado de documento -> abrir menú
            const btnDoc = e.target.closest('.ptl-vec-doc-btn-manual');
            if (btnDoc) {
              e.stopPropagation();
              abrirMenu(btnDoc);
              return;
            }
            // Click en ＋ guardar fila editable
            const btnGuardar = e.target.closest('.ptl-vec-btn-guardar');
            if (btnGuardar) {
              if (btnGuardar.disabled) return;
              const fila = btnGuardar.closest('.ptl-vec-fila');
              if (fila) guardarFilaManual(fila);
              return;
            }
            // Click en botón ✕ borrar piso -> confirmación + POST + recarga.
            // Excepción: si la fila es nueva (sin rowIndex), simplemente la
            // quitamos del DOM (cancelar).
            const btnBorrar = e.target.closest('.ptl-vec-btn-borrar');
            if (btnBorrar) {
              const fila = btnBorrar.closest('.ptl-vec-fila');
              if (!fila) return;
              if (fila.classList.contains('ptl-vec-nueva')) {
                const sig = fila.nextElementSibling;
                if (sig && sig.classList.contains('ptl-vec-acordeon-fila')) sig.remove();
                fila.remove();
                actualizarFlagSalir();
                return;
              }
              borrarFilaManual(fila);
              return;
            }
            // Click en botón de acordeón (📄) -> abrir/cerrar acordeón
            const btnAcord = e.target.closest('.ptl-vec-btn-acordeon');
            if (!btnAcord) return;
            const fila = btnAcord.closest('.ptl-vec-fila');
            if (!fila) return;
            const acord = fila.nextElementSibling;
            if (!acord || !acord.classList.contains('ptl-vec-acordeon-fila')) return;
            const yaAbierto = acord.style.display !== 'none';
            // Cerrar todos
            tbody.querySelectorAll('.ptl-vec-acordeon-fila').forEach(f => {
              f.style.display = 'none';
              const c = f.querySelector('.ptl-vec-acordeon-cont');
              if (c) c.innerHTML = '';
            });
            tbody.querySelectorAll('.ptl-vec-fila').forEach(f => f.classList.remove('ptl-vec-fila-expandida'));
            if (yaAbierto) return;
            // Abrir el actual
            const id = fila.dataset.manualId;
            let docs = null, estados = null;
            let docsPrev = null, estadosPrev = null;
            if (id === 'ccpp') {
              docs        = dataCcpp.docs;
              estados     = dataCcpp.estados;
              docsPrev    = dataCcpp.docsPrev    || [];
              estadosPrev = dataCcpp.estadosPrev || [];
            } else {
              const dp = dataPisos.find(p => p.id === id);
              if (!dp) return;
              docs        = dataDocsPiso;
              estados     = dp.estados;
              docsPrev    = dataDocsPisoPrev || [];
              estadosPrev = dp.estadosPrev   || [];
            }
            const cont = acord.querySelector('.ptl-vec-acordeon-cont');
            renderAcordeon(cont, docs, estados, docsPrev, estadosPrev);
            acord.style.display = '';
            fila.classList.add('ptl-vec-fila-expandida');
          });
        })();
      </script>
    </div>`;
  }



  function cajitaVecinosHtml(comu, pisos, expedientes, token, esc, fmtTlf) {
    // Indexar expedientes por teléfono
    const expByTlf = {};
    for (const e of expedientes) {
      const k = normTlfKey(e.telefono);
      if (k) expByTlf[k] = e;
    }

    // ----- Stats: cuántos pisos tienen TODA la documentación cerrada -----
    // Un piso se considera "completo" cuando ninguno de sus documentos
    // RELEVANTES está pendiente. Documentos relevantes = los 23 universales
    // menos los marcados como "no aplica" para este piso.
    // Hechos = recibidos con archivo + recibidos sin archivo.
    // Completo si hechos >= total relevante.
    const TOTAL_DOCS = DOCS_UNIVERSAL.length; // 23
    function contarDocsPiso(exp) {
      if (!exp) return { hechos: 0, totalRelevante: TOTAL_DOCS };
      const recibidos = (exp.documentos_recibidos || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const sinArch   = (exp.documentos_recibidos_sin_archivo || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const noAplica  = (exp.documentos_no_aplica || "").split(",").filter(Boolean).filter(c => DOCS_UNIVERSAL.includes(c));
      const hechosSet = new Set([...recibidos, ...sinArch]);
      const noAplicaSet = new Set(noAplica);
      const totalRelevante = TOTAL_DOCS - noAplicaSet.size;
      return { hechos: hechosSet.size, totalRelevante };
    }
    const total = pisos.length;
    let pisosCompletos = 0;
    for (const p of pisos) {
      const exp = expByTlf[normTlfKey(p.telefono)];
      const { hechos, totalRelevante } = contarDocsPiso(exp);
      if (totalRelevante > 0 && hechos >= totalRelevante) pisosCompletos++;
    }
    const ccppCompleto = total > 0 && pisosCompletos === total;

    // ----- Pill indicador a la derecha: "Faltan Y de X" / "✓ Completo" -----
    let pillIndicadorHtml = "";
    if (total === 0) {
      pillIndicadorHtml = "";
    } else if (ccppCompleto) {
      pillIndicadorHtml = `<span class="ptl-vec-pill ptl-vec-pill-verde">✓ Completo</span>`;
    } else {
      const faltan = total - pisosCompletos;
      pillIndicadorHtml = `<span class="ptl-vec-pill ptl-vec-pill-rojo">Faltan ${faltan} de ${total}</span>`;
    }

    // ----- Botón MODO en la toolbar -----
    const modo = (comu.modo_documentacion || "MANUAL").toUpperCase();
    const botonModoHtml = modo === "BOT"
      ? `<button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-vec-btn-modo ptl-vec-btn-modo-bot" title="Este CCPP funciona en modo automático con el bot WhatsApp" disabled>BOT</button>`
      : `<button type="button" class="ptl-btn ptl-btn-sm ptl-vec-btn-modo ptl-vec-btn-modo-manual" title="Modo MANUAL. Pulsa para cambiar a BOT (irreversible)">MANUAL</button>`;

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
          <span class="ptl-card-title" style="margin-bottom:0">DATOS PISOS</span>
          <div class="ptl-vec-cabecera-derecha">
            <button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-vec-btn-anadir">+ Añadir piso</button>
            ${botonModoHtml}
            ${pillIndicadorHtml}
          </div>
        </div>
        <div class="ptl-vec-tabla-wrap">
          <table class="ptl-vec-tabla">
            <thead><tr>
              <th class="ptl-vec-th-vivienda">Piso</th>
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
              const hayDirty = !!card.querySelector('.ptl-vec-fila.ptl-vec-dirty');
              window.__ptlVecDirty = hayDirty;
              // Instalar/quitar el beforeunload dinámicamente: solo activo si
              // hay filas dirty. Así, si no has editado nada, el navegador NO
              // muestra el aviso "¿abandonar página?".
              if (hayDirty && !window.__ptlVecBeforeUnloadHandler) {
                window.__ptlVecBeforeUnloadHandler = function(e) {
                  e.preventDefault(); e.returnValue = ''; return '';
                };
                window.addEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
              } else if (!hayDirty && window.__ptlVecBeforeUnloadHandler) {
                window.removeEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
                window.__ptlVecBeforeUnloadHandler = null;
              }
            }
            // Recarga la página después de una acción explícita del usuario
            // (guardar/borrar piso, marcar documento, cambiar modo). Quita el
            // listener de beforeunload (si estaba) para que el navegador NO
            // muestre el diálogo "¿abandonar página?".
            function recargar() {
              window.__ptlVecDirty = false;
              // El módulo presupuestos.cjs registra su propio listener de
              // beforeunload que avisa cuando hay diff en el formulario
              // principal (ver presupuestos.cjs línea ~1557). Ese listener
              // respeta el flag window.ptlEliminando: si está a true, NO
              // muestra el aviso. Lo activamos aquí antes del reload para
              // que las recargas controladas de la cajita de pisos sean
              // silenciosas. El flag se "resetea" naturalmente al recargar
              // la página (porque el window se reinicia).
              window.ptlEliminando = true;
              if (window.__ptlVecBeforeUnloadHandler) {
                window.removeEventListener('beforeunload', window.__ptlVecBeforeUnloadHandler);
                window.__ptlVecBeforeUnloadHandler = null;
              }
              window.location.reload();
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

            // ---- HELPERS de refresco quirúrgico ----
            // Tras una acción sobre un documento, actualizamos en pantalla
            // SOLO la fila del piso afectada y, si está abierto, su acordeón.
            // Más el pill "Faltan Y de X" de la cabecera.
            // No recargamos la página: esto preserva el acordeón abierto y
            // permite tocar varios documentos seguidos sin re-expandir nada.
            const TOTAL_DOCS_UNIV = docsUniversal.length; // 23
            const CODIGOS_UNIV = docsUniversal.map(d => d.codigo);

            function calcularDocsPiso(exp) {
              if (!exp) return { hechos: 0, totalRelevante: TOTAL_DOCS_UNIV };
              const recibidos = (exp.documentos_recibidos || '').split(',').filter(Boolean).filter(c => CODIGOS_UNIV.includes(c));
              const sinArch   = (exp.documentos_recibidos_sin_archivo || '').split(',').filter(Boolean).filter(c => CODIGOS_UNIV.includes(c));
              const noAplica  = (exp.documentos_no_aplica || '').split(',').filter(Boolean).filter(c => CODIGOS_UNIV.includes(c));
              const hechosSet = new Set([...recibidos, ...sinArch]);
              const noAplicaSet = new Set(noAplica);
              return { hechos: hechosSet.size, totalRelevante: TOTAL_DOCS_UNIV - noAplicaSet.size };
            }

            function htmlDocsTag(exp, tieneTlf) {
              if (!exp && !tieneTlf) return '<span class="ptl-vec-docs-tag ptl-vec-docs-gris">—</span>';
              if (!exp)              return '<span class="ptl-vec-docs-tag ptl-vec-docs-rojo">0/' + TOTAL_DOCS_UNIV + '</span>';
              const { hechos, totalRelevante } = calcularDocsPiso(exp);
              const cls = (totalRelevante > 0 && hechos >= totalRelevante) ? 'ptl-vec-docs-verde' : 'ptl-vec-docs-rojo';
              return '<span class="ptl-vec-docs-tag ' + cls + '">' + hechos + '/' + totalRelevante + '</span>';
            }

            function recalcularPillCabecera() {
              // Recorremos todas las filas de piso, contamos cuántas tienen
              // su documentación al día, y reescribimos el pill.
              const filas = card.querySelectorAll('.ptl-vec-fila');
              let total = 0, completos = 0;
              filas.forEach(f => {
                // Saltamos filas "nuevas" sin teléfono guardado todavía
                const tlf = f.dataset.telefonoOrig || '';
                if (!f.dataset.rowIndex) return; // sin guardar aún: no cuenta
                total++;
                if (!tlf) return;
                const exp = expedientesPorTlf[normTlfKey(tlf)];
                const { hechos, totalRelevante } = calcularDocsPiso(exp);
                if (totalRelevante > 0 && hechos >= totalRelevante) completos++;
              });
              const cont = card.querySelector('.ptl-vec-cabecera-derecha');
              if (!cont) return;
              // Quitamos el pill anterior (si lo hay) y añadimos el nuevo
              const viejo = cont.querySelector('.ptl-vec-pill');
              if (viejo) viejo.remove();
              if (total === 0) return;
              const nuevo = document.createElement('span');
              if (completos === total) {
                nuevo.className = 'ptl-vec-pill ptl-vec-pill-verde';
                nuevo.textContent = '✓ Completo';
              } else {
                nuevo.className = 'ptl-vec-pill ptl-vec-pill-rojo';
                nuevo.textContent = 'Faltan ' + (total - completos) + ' de ' + total;
              }
              cont.appendChild(nuevo);
            }

            // Refresca la fila resumen de un piso + su acordeón si está abierto
            // + el pill de la cabecera. NO recarga la página.
            function refrescarPiso(filaPiso) {
              if (!filaPiso) return;
              const tlf = filaPiso.dataset.telefonoOrig || filaPiso.querySelector('.ptl-vec-telefono')?.value || '';
              const exp = tlf ? (expedientesPorTlf[normTlfKey(tlf)] || null) : null;
              // 1. Celda Docs
              const celdaDocs = filaPiso.querySelector('.ptl-vec-docs');
              if (celdaDocs) celdaDocs.innerHTML = htmlDocsTag(exp, !!tlf);
              // 2. Badge de estado (puede haber cambiado si el server actualizó estado_expediente)
              if (exp) {
                const celdaEstado = filaPiso.querySelector('.ptl-vec-estado');
                if (celdaEstado) celdaEstado.innerHTML = badgeEstado(exp.estado_expediente);
              }
              // 3. Acordeón: si está abierto, redibujarlo
              const acordeonFila = filaPiso.nextElementSibling;
              if (acordeonFila && acordeonFila.classList.contains('ptl-vec-acordeon-fila') && acordeonFila.style.display !== 'none') {
                const cont = acordeonFila.querySelector('.ptl-vec-acordeon-cont');
                if (cont) pintarAcordeon(filaPiso, cont);
              }
              // 4. Pill cabecera
              recalcularPillCabecera();
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

              // Cabecera del acordeón: solo se muestra si NO hay expediente
              // (mensaje informativo); cuando hay expediente, ahorramos altura
              // porque el estado y el contador ya se ven en la propia fila del piso.
              let cab = '';
              if (!exp) {
                cab = '<div class="ptl-vec-ac-cab ptl-vec-ac-sinexp">'
                  + '<span class="ptl-badge ptl-badge-gris">Sin expediente</span>'
                  + '<span class="ptl-vec-ac-cab-info">El expediente se creará automáticamente al marcar el primer documento.</span>'
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
            // El menú se anexa al body con position:fixed para que NO lo
            // recorte el overflow:hidden de la tabla o de la celda.
            function cerrarMenuDoc() {
              const m = document.querySelector('.ptl-vec-doc-menu');
              if (m) m.remove();
            }
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
              document.body.appendChild(menu);

              // Calcular posición: justo debajo del botón.
              // Si no cabe abajo, lo subimos arriba; si no cabe a la derecha, lo desplazamos.
              const r = btn.getBoundingClientRect();
              const mw = menu.offsetWidth;
              const mh = menu.offsetHeight;
              const vh = window.innerHeight, vw = window.innerWidth;
              let top  = r.bottom + 4;
              let left = r.left;
              if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 4);
              if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
              menu.style.top  = top + 'px';
              menu.style.left = left + 'px';

              // Cerrar al pulsar fuera del menú
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
                let data;
                try { data = await resp.json(); }
                catch (parseErr) {
                  alert('El servidor devolvió una respuesta no válida (HTTP ' + resp.status + ')');
                  return;
                }
                if (!data.ok) {
                  alert(data.error || 'Error marcando documento');
                  return;
                }
                // Refresco quirúrgico: actualizamos solo el piso afectado.
                // El servidor nos devuelve el expediente actualizado; lo
                // metemos en la cache local y redibujamos fila + acordeón
                // (si abierto) + pill cabecera. Sin recargar la página.
                if (data.expediente) {
                  const tlf = fila.dataset.telefonoOrig || fila.querySelector('.ptl-vec-telefono').value || '';
                  const tlfKey = normTlfKey(tlf);
                  if (tlfKey) expedientesPorTlf[tlfKey] = data.expediente;
                  refrescarPiso(fila);
                } else {
                  // Fallback: si por lo que sea el server no devuelve expediente,
                  // recargamos como antes para no quedarnos con vista obsoleta.
                  recargar();
                }
              } catch (e) {
                console.error('[marcar-doc] error', e);
                alert('Error de red: ' + (e && e.message ? e.message : e));
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
                recargar();
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
                recargar();
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
                recargar();
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
                + '<td class="ptl-vec-docs"><span class="ptl-vec-docs-tag ptl-vec-docs-gris">—</span></td>'
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

      // ----- Cajita "DATOS DOCUMENTACION" basada en documentos_manuales -----
      // Solo aparece a partir de fase 05. En 01-04 no tiene sentido (todavía
      // no se ha entrado en documentación).
      let cajitaManual = "";
      const faseActual = (comu.fase || comu.fase_presupuesto || "").trim();
      const FASES_SIN_CAJITA = new Set([
        "01_CONTACTO", "02_VISITA", "03_ENVIO_PTO", "04_ACEPTACION_PTO",
      ]);
      if (FASES_SIN_CAJITA.has(faseActual)) {
        cajitaManual = "";
      } else try {
        const docsManuales = await leerDocumentosManuales();
        const estadosCcpp = await leerEstadosCcpp(comu);
        cajitaManual = cajitaManualHtml({
          comu, pisos, expedientes, docsManuales, estadosCcpp, esc: P.esc, fmtTlf, token,
        });
      } catch (e) {
        console.warn("[documentacion] no se pudo construir cajita manual:", e.message);
        cajitaManual = `<div class="ptl-card" style="margin-top:12px"><b>DATOS DOCUMENTACION</b><br><small style="color:#666">No se pudo cargar: ${P.esc(e.message)}</small></div>`;
      }

      const datalists = P.construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";

      // Banner amarillo: en fase 05 sin pisos cargados, avisar para que se añadan.
      // (En fase 06+ ya tendría que estar resuelto; en <05 todavía no toca.)
      let bannerSinPisos = "";
      if (faseActual === "05_DOCUMENTACION" && (!pisos || pisos.length === 0)) {
        bannerSinPisos = `
          <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:10px 14px;margin:0 0 12px 0;display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">⚠</span>
            <div style="flex:1;font-size:13px;color:#78350F">
              <strong>Faltan pisos por crear.</strong>
              Esta comunidad está en fase de documentación pero no tiene vecinos cargados.
              Añádelos antes de que empiece el seguimiento.
            </div>
          </div>`;
      }

      P.sendHtml(res, P.pageHtml(titulo,
        [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        await P.vistaFicha(comu, datalists, token, reciencreado, {
          extraHtmlFinal: cajitaManual,
          extraHtmlInicial: bannerSinPisos,
        }),
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

  // =================================================================
  // INICIALIZACIÓN DE ESTADOS AL ENTRAR EN UNA FASE
  // -----------------------------------------------------------------
  // Cuando un CCPP entra en fase 05 o 07, ciertos documentos deben
  // pasar de vacío ("·") a un estado por defecto (F u OP). Esta
  // función escribe esos valores iniciales en el Sheet, respetando
  // las celdas que YA tengan un valor (no las pisa).
  //
  // Reglas (acordadas 04/05/2026):
  //   - Al entrar en 05_DOCUMENTACION:
  //       CCPP: los 7 docs visibles en fase 05 -> F
  //       PISO: piso_toma_datos, piso_nif_toma_datos, piso_titularidad -> F
  //             el resto de docs visibles en fase 05 -> OP
  //   - Al entrar en 08_CYCP (es cuando aparecen los docs de contrato/pago
  //     activos en la cajita, después de la espera 07_PTE_CYCP):
  //       CCPP: ccpp_contrato, ccpp_pago -> F
  //       PISO: piso_contrato, piso_pago -> F
  //
  // Optimización: usa una sola llamada update por fila (CCPP + cada
  // piso) escribiendo el rango completo AQ:AY o AC:AS. Esto reduce
  // drásticamente el número de llamadas a la API.
  //
  // Devuelve { ccpp: Nº celdas escritas, pisos: Nº celdas escritas }
  // =================================================================
  async function inicializarEstadosFase(comu, fase) {
    if (!comu) throw new Error("inicializarEstadosFase: falta comu");
    const FASE_05 = "05_DOCUMENTACION";
    const FASE_07 = "08_CYCP";
    if (fase !== FASE_05 && fase !== FASE_07) return { ccpp: 0, pisos: 0 };

    const sheets = getSheets();
    const docsManuales = await leerDocumentosManuales();
    const docsCcpp = docsManuales.ccpp || [];
    const docsPiso = docsManuales.piso || [];

    // Reglas de inicialización por documento, según la fase de entrada.
    // Devuelve el estado inicial ("F" o "OP") o null si NO se inicializa.
    function reglaCcpp(codigo) {
      if (fase === FASE_05) {
        if (codigo === "ccpp_contrato" || codigo === "ccpp_pago") return null;
        return "F";
      }
      // FASE_07
      if (codigo === "ccpp_contrato" || codigo === "ccpp_pago") return "F";
      return null;
    }
    const COD_PISO_F_EN_05 = new Set(["piso_toma_datos", "piso_nif_toma_datos", "piso_titularidad"]);
    // En fase 08 (07->08), `piso_pago` se siembra arrastrando el valor de
    // `piso_meses_financiar` cuando éste tiene cualquier valor; si está vacío,
    // se siembra como "F". Por eso reglaPiso recibe el array de estados del
    // piso y el índice del doc piso_meses_financiar dentro de ese array.
    function reglaPiso(codigo, estadosPiso, idxMesesFin) {
      if (fase === FASE_05) {
        if (codigo === "piso_contrato" || codigo === "piso_pago") return null;
        if (COD_PISO_F_EN_05.has(codigo)) return "F";
        return "OP";
      }
      // FASE_07 (paso a 08_CYCP)
      if (codigo === "piso_contrato") return "F";
      if (codigo === "piso_pago") {
        const v = (idxMesesFin >= 0 && estadosPiso ? (estadosPiso[idxMesesFin] || "") : "").toString().trim();
        return v ? v : "F";
      }
      return null;
    }

    // ---------- CCPP: leer fila actual de cols AQ-AY y rellenar vacíos ----------
    const resCcpp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: "comunidades!A:B",
    });
    const rowsCcpp = resCcpp.data.values || [];
    let rowIndexCcpp = -1;
    for (let i = 1; i < rowsCcpp.length; i++) {
      const a = (rowsCcpp[i] && rowsCcpp[i][0]) || "";
      const b = (rowsCcpp[i] && rowsCcpp[i][1]) || "";
      if (mismaDireccion(a, comu.comunidad) || mismaDireccion(a, comu.direccion) ||
          mismaDireccion(b, comu.comunidad) || mismaDireccion(b, comu.direccion)) {
        rowIndexCcpp = i + 1; break;
      }
    }
    let escritasCcpp = 0;
    if (rowIndexCcpp > 0 && docsCcpp.length > 0) {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `comunidades!AQ${rowIndexCcpp}:AY${rowIndexCcpp}`,
      });
      const fila = (r.data.values && r.data.values[0]) || [];
      const nuevos = [];
      let huboCambio = false;
      for (let i = 0; i < docsCcpp.length; i++) {
        const actual = (fila[i] || "").toString().trim();
        if (actual !== "") { nuevos.push(actual); continue; }
        const def = reglaCcpp(docsCcpp[i].codigo);
        if (!def) { nuevos.push(""); continue; }
        nuevos.push(def);
        huboCambio = true;
        escritasCcpp++;
      }
      while (nuevos.length < 9) nuevos.push("");
      if (huboCambio) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `comunidades!AQ${rowIndexCcpp}:AY${rowIndexCcpp}`,
          valueInputOption: "RAW",
          requestBody: { values: [nuevos] },
        });
      }
    }

    // ---------- PISOS: leer todos los del CCPP de una vez ----------
    let escritasPisos = 0;
    const resPisos = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rowsPisos = resPisos.data.values || [];
    const claveComu = (comu.comunidad || comu.direccion || "").toString().trim();
    const filasDelCcpp = [];
    for (let i = 1; i < rowsPisos.length; i++) {
      const r = rowsPisos[i] || [];
      const cmu = (r[1] || "").toString().trim();
      if (!cmu) continue;
      if (mismaDireccion(cmu, claveComu) ||
          mismaDireccion(cmu, comu.comunidad) ||
          mismaDireccion(cmu, comu.direccion)) {
        const estados = [];
        for (let k = 0; k < 17; k++) estados.push((r[28 + k] || "").toString());
        filasDelCcpp.push({ rowIndex: i + 1, estados });
      }
    }
    // Índice de piso_meses_financiar dentro de docsPiso (para arrastrar valor a piso_pago en fase 08).
    const idxMesesFin = docsPiso.findIndex(d => d.codigo === "piso_meses_financiar");

    for (const f of filasDelCcpp) {
      const nuevos = [];
      let huboCambio = false;
      for (let i = 0; i < docsPiso.length && i < 17; i++) {
        const actual = (f.estados[i] || "").toString().trim();
        if (actual !== "") { nuevos.push(actual); continue; }
        const def = reglaPiso(docsPiso[i].codigo, f.estados, idxMesesFin);
        if (!def) { nuevos.push(""); continue; }
        nuevos.push(def);
        huboCambio = true;
        escritasPisos++;
      }
      while (nuevos.length < 17) nuevos.push("");
      if (huboCambio) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `pisos!AC${f.rowIndex}:AS${f.rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: [nuevos] },
        });
      }
    }

    return { ccpp: escritasCcpp, pisos: escritasPisos };
  }

  // =================================================================
  // GUARDAR ESTADO MANUAL DE UN DOCUMENTO
  // Escribe el estado en la celda correspondiente del Sheet.
  // - Si nivel === "ccpp": en pestaña comunidades, fila del CCPP, col AQ-AY
  // - Si nivel === "piso": en pestaña pisos, fila del piso (telefono+vivienda),
  //                        col AC-AS
  // El "índice" del documento dentro de la lista de documentos_manuales
  // determina la columna concreta:
  //   ccpp: índice 0 -> AQ (col 43, 1-indexed)
  //   piso: índice 0 -> AC (col 29, 1-indexed)
  // =================================================================
  async function marcarEstadoManual({ comu, vivienda, nivel, codigo, estadoNuevo }) {
    const sheets = getSheets();
    const docsManuales = await leerDocumentosManuales();
    const lista = nivel === "ccpp" ? docsManuales.ccpp : docsManuales.piso;
    const idx = lista.findIndex(d => d.codigo === codigo);
    if (idx < 0) {
      throw new Error("Documento no encontrado en documentos_manuales: " + codigo);
    }

    if (nivel === "ccpp") {
      // Localizar fila del CCPP en comunidades
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: "comunidades!A:B",
      });
      const rows = res.data.values || [];
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        const a = (rows[i] && rows[i][0]) || "";
        const b = (rows[i] && rows[i][1]) || "";
        if (mismaDireccion(a, comu.comunidad) || mismaDireccion(a, comu.direccion) ||
            mismaDireccion(b, comu.comunidad) || mismaDireccion(b, comu.direccion)) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex < 0) throw new Error("CCPP no encontrado en comunidades");
      // AQ = columna 43, AR = 44, ...
      const col = 43 + idx;
      const colLetter = colNumToLetter(col);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `comunidades!${colLetter}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[estadoNuevo]] },
      });
      return { ok: true };
    }

    // nivel === "piso"
    // Localizar fila del piso en pestaña pisos por (comunidad, vivienda)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: "pisos!A:C",
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const com = r[1] || "";
      const viv = r[2] || "";
      if ((mismaDireccion(com, comu.comunidad) || mismaDireccion(com, comu.direccion)) &&
          String(viv).trim() === String(vivienda).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex < 0) throw new Error("Piso no encontrado: " + vivienda);
    // AC = columna 29, AD = 30, ...
    const col = 29 + idx;
    const colLetter = colNumToLetter(col);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `pisos!${colLetter}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[estadoNuevo]] },
    });
    return { ok: true };
  }

  function colNumToLetter(n) {
    // 1->A, 26->Z, 27->AA, ...
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // ----- POST /documentacion/manual/marcar -----
  // Body: { ccpp_clave, vivienda, nivel: "ccpp"|"piso", codigo, estado }
  // - ccpp_clave: comunidad o direccion del CCPP
  // - vivienda: solo si nivel === "piso"
  // - codigo: el código del documento (ccpp_pago, piso_toma_datos, ...)
  // - estado: F | OK | OP | NP | 6 | 12 | 18 | CCPP  (vacío para limpiar)
  app.post("/documentacion/manual/marcar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const P = app.locals.presupuestos;
    if (!P) return res.status(500).json({ error: "Presupuestos no cargado" });
    try {
      const ccppClave = (req.body.ccpp_clave || "").trim();
      const vivienda  = (req.body.vivienda || "").trim();
      const nivel     = (req.body.nivel || "").trim().toLowerCase();
      const codigo    = (req.body.codigo || "").trim();
      const estado    = (req.body.estado || "").trim();
      if (!ccppClave || !nivel || !codigo) {
        return res.status(400).json({ error: "Faltan parámetros" });
      }
      if (nivel !== "ccpp" && nivel !== "piso") {
        return res.status(400).json({ error: "nivel inválido: " + nivel });
      }
      if (nivel === "piso" && !vivienda) {
        return res.status(400).json({ error: "Falta vivienda para nivel=piso" });
      }
      // Validar estado contra los conocidos
      const VALIDOS = new Set(["", "F", "OK", "OP", "NP", "6", "12", "18", "CCPP"]);
      if (!VALIDOS.has(estado)) {
        return res.status(400).json({ error: "estado inválido: " + estado });
      }
      // Resolver el CCPP en comunidades
      const comunidades = await P.leerComunidades();
      const comu = comunidades.find(c =>
        mismaDireccion(c.direccion, ccppClave) || mismaDireccion(c.comunidad, ccppClave)
      );
      if (!comu) return res.status(404).json({ error: "CCPP no encontrado: " + ccppClave });
      const result = await marcarEstadoManual({ comu, vivienda, nivel, codigo, estadoNuevo: estado });
      res.json(result);
    } catch (e) {
      console.error("[documentacion] manual/marcar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ----- Exponer API interna del módulo para que otros módulos
  //       (en concreto presupuestos.cjs) puedan invocar funciones aquí. -----
  app.locals.documentacion = app.locals.documentacion || {};
  app.locals.documentacion.inicializarEstadosFase = inicializarEstadosFase;

  console.log("[documentacion] Módulo cargado. Rutas: /documentacion/expediente, /documentacion/piso/guardar, /documentacion/piso/borrar, /documentacion/ccpp/modo, /documentacion/documento/marcar, /documentacion/manual/marcar");

};
