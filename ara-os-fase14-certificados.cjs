// ============================================================
// ARA OS — Fase 14 · Generación de certificados EMASESA
// v0.20.0 — Sprint 14/05/2026
// v0.22.0 — Sprint 15/05/2026 · migración a templates AcroForm (cero coordenadas)
// v0.24.0 — Sprint 16/05/2026 · Paso 1 del sprint "Reorden fase 14":
//           Parser RT enriquecido:
//             · Separa numero_bateria_emasesa (= "31973", oficial EMASESA)
//               de contadores_a_instalar (campo distinto, puede ir vacío).
//               bateria_numero mantiene el alias retrocompat.
//             · ubicacion_bateria captura la línea completa
//               (ej. "ARMARIO EN PATIO INTERIOR") en vez de quedarse en
//               "EN PATIO INTERIOR".
//             · numero_edificio_rt: número aislado de la dirección
//               (ej. "13" de "PLAZA GENERALIFE, 13, COM").
//             · causa_baja_suministro: "SI"/"NO" según marca X.
//             · Cada toma incorpora `revisada: false` por defecto
//               (preparado para columna SI/NO del CO 073, paso 4).
//           Tabla emasesa_relacion_tomas gana 3 columnas nuevas.
// v0.25.0 — Sprint 16/05/2026 · Paso 2 del sprint "Reorden fase 14":
//           Marca automática de "campos editados por humano":
//             · datos_tecnicos_bateria gana columna `campos_editados_humano`
//               (JSON array con nombres de campos que un humano modificó).
//             · escribirDatosTecnicos compara cada campo entrante con el
//               valor previo. Si CAMBIA → marca como humano. Si es idéntico
//               → no marca (preserva la idempotencia del autocompletado RT).
//             · Endpoint nuevo GET /fase14/campos-editados-humano
//               para que el frontend pueda invertir prioridades (paso 6).
//             · Cero cambios en frontend. JM sigue editando como siempre;
//               el sistema detecta la edición por comparación de valores.
// v0.26.0 — Sprint 16/05/2026 · Paso 3 del sprint "Reorden fase 14":
//           Flags de pasos de fase 14 (sin bloquear nada, solo informativo):
//             · Tabla nueva `ara_os_estado_documentos_bateria` (comunidad,
//               bateria_orden, rt_subida, foto_rotulo_subida + fechas).
//             · Tabla nueva `ara_os_estado_certificados` (comunidad,
//               certificados_generados + fechas).
//             · Hooks en /subir-relacion-emasesa, /subir-rotulo-bateria
//               y /generar-certificados marcan los flags automáticamente.
//             · Endpoint nuevo GET /fase14/estado-pasos devuelve el estado
//               completo para que la tarjeta lo pinte (paso 7 del sprint).
//             · Flags solo se levantan, nunca se bajan (histórico).
//             · Obras viejas: salen como pendientes hasta el primer toque.
//
// require("./ara-os-fase14-certificados.cjs")(app);
//
// Endpoints:
//   GET  /api/ara-os/fase14/datos-certificado?ccpp_id=...
//   POST /api/ara-os/fase14/guardar-datos-tecnicos
//   POST /api/ara-os/fase14/guardar-cp-titular
//   POST /api/ara-os/fase14/generar-certificados   (genera los 3 PDFs)
//
// Sheets nuevas (mi zona, NO toca `comunidades`):
//   - `datos_titular_extra`  (cp por comunidad)
//   - `datos_tecnicos_bateria` (todos los datos técnicos del CO 080 + CO 073 + Relación)
//
// PDFs base (assets/emasesa/):
//   - CO_080_V00.pdf       (formulario interactivo, 118 campos)
//   - CO_073_V01.pdf       (plano, overlay)
//   - Relacion_de_tomas.pdf (plano, overlay)
//
// Variables Render requeridas:
//   - ARA_INSTALADOR_NOMBRE    (ej. "JOSE ALBERTO ARAUJO PUERTA")
//   - ARA_INSTALADOR_NIF       (ej. "30228268N")
//   - DRIVE_FOLDER_FASE14_FIRMADAS  (ya existe, se reutiliza para certificados)
// ============================================================

module.exports = function setupAraOSFase14Certificados(app) {

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  // Datos fijos de la empresa instaladora (de la factura F260018)
  const EMPRESA_INSTALADORA = {
    razon_social: "ARA CORPORATE SOCIEDAD DE INVERSIONES S.L.",
    cif:          "B90488222",
    direccion:    "AVENIDA SAN FRANCISCO JAVIER, EDIFICIO SEVILLA 2, PLANTA 6, MODULO 9, 41018 SEVILLA",
    telefonos:    "640527426",
    email:        "info@instalacionesaraujo.com",
    movil:        "640527426",
  };

  function getInstaladorAutorizado() {
    return {
      nombre: process.env.ARA_INSTALADOR_NOMBRE || "",
      nif:    process.env.ARA_INSTALADOR_NIF || "",
    };
  }

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  const { google } = require("googleapis");
  const crypto = require("crypto");
  const express = require("express");
  const fs = require("fs");
  const path = require("path");
  const multer = require("multer");
  const axios = require("axios");
  const { Readable } = require("stream");
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
  const jsonBodyParser = express.json({ limit: "1mb" });

  function getAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }

  function getSheetsClient() {
    return google.sheets({ version: "v4", auth: getAuth() });
  }

  function getDriveClient() {
    return google.drive({ version: "v3", auth: getAuth() });
  }

  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return res.data.values || [];
  }

  async function leerHojaSafe(rango) {
    try { return await leerHoja(rango); }
    catch (err) { console.warn("[fase14-cert] leerHoja " + rango + ":", err.message); return []; }
  }

  // ------------------------------------------------------------
  // Modelo `comunidades` (SOLO LECTURA · réplica de panel-obras)
  // ------------------------------------------------------------
  const COLS_COM = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma",
    "observaciones","tipo_via","earth","administrador","telefono_administrador",
    "email_administrador","fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto",
    "fecha_envio_pto","fecha_ultimo_seguimiento_pto","decision_pto","fecha_aceptacion_pto",
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio","tiempo_previsto",
    "tiempo_real","tiempo_desvio","notas_pto","mails_enviados","mails_ultimo_envio",
    "fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto","fecha_visita_emasesa",
    "fecha_documentacion_completa","fecha_contratos_pagos_completa","modo_documentacion",
    "est_ccpp_contrato_firmado","est_ccpp_toma_datos","est_ccpp_nif","est_ccpp_acta_pte",
    "est_ccpp_acta_pto","est_ccpp_renuncia_gp","est_ccpp_factura_emasesa",
    "est_ccpp_contrato","est_ccpp_pago","fecha_envio_contratos_pagos",
    "fecha_cycp_completa","mails_manuales","fecha_limite_documentacion_vecinos",
    "motivo_rechazo","motivo_pipeline","fase_jm"
  ];

  function rowToObjCom(row) {
    const o = {};
    for (let i = 0; i < COLS_COM.length; i++) o[COLS_COM[i]] = row[i] || "";
    return o;
  }

  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  async function resolverComunidadPorCcpp(ccpp_id) {
    const rowsCom = await leerHoja("comunidades!A2:BD");
    for (const row of rowsCom) {
      if (!row[0]) continue;
      const o = rowToObjCom(row);
      const clave = o.direccion || o.comunidad || "";
      if (clave && ccppId(clave) === ccpp_id) return o;
    }
    return null;
  }

  // ============================================================
  // TAB · datos_titular_extra
  // Columnas: comunidad | cp | cp_emplazamiento | ultima_modificacion
  // ============================================================
  const TITULAR_HEADERS = ["comunidad", "cp", "cp_emplazamiento", "ultima_modificacion"];

  async function asegurarPestanaTitular() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "datos_titular_extra"
      );
      if (existe) return true;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "datos_titular_extra" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "datos_titular_extra!A1:D1",
        valueInputOption: "RAW",
        requestBody: { values: [TITULAR_HEADERS] },
      });
      console.log("[fase14-cert] Tab datos_titular_extra creada");
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaTitular:", err.message);
      return false;
    }
  }

  async function leerDatosTitular(comunidad) {
    await asegurarPestanaTitular();
    const rows = await leerHojaSafe("datos_titular_extra!A2:D");
    for (const row of rows) {
      if (String(row[0] || "").trim() === comunidad.trim()) {
        return {
          cp: row[1] || "",
          cp_emplazamiento: row[2] || "",
          ultima_modificacion: row[3] || "",
        };
      }
    }
    return { cp: "", cp_emplazamiento: "", ultima_modificacion: "" };
  }

  async function escribirDatosTitular(comunidad, datos) {
    await asegurarPestanaTitular();
    const sheets = getSheetsClient();
    const rows = await leerHojaSafe("datos_titular_extra!A2:D");
    const ahora = new Date().toISOString();
    const nuevaFila = [
      comunidad.trim(),
      datos.cp || "",
      datos.cp_emplazamiento || "",
      ahora,
    ];

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === comunidad.trim()) {
        rowIndex = i + 2;
        break;
      }
    }
    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `datos_titular_extra!A${rowIndex}:D${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [nuevaFila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "datos_titular_extra!A:D",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [nuevaFila] },
      });
    }
    return true;
  }

  // ============================================================
  // TAB · datos_tecnicos_bateria
  //
  // v0.23.0 — Soporte multi-batería:
  //   - Nueva clave compuesta (comunidad, bateria_orden)
  //   - Una comunidad puede tener N filas (una por batería física)
  //   - Filas legacy sin bateria_orden se tratan como orden=1 al leer.
  //   - El rótulo físico vive en `emasesa_relacion_tomas` (otra pestaña),
  //     que también tiene clave compuesta desde v0.23.0.
  // ============================================================
  const TECNICOS_HEADERS = [
    "comunidad",
    "bateria_orden",                 // v0.23.0: clave compuesta. Vacío en filas legacy = 1.
    // Bloque emplazamiento
    "numero_edificio","bloque","portal","escalera","piso","puerta",
    "uso","superficie_comercial","forma_abastecimiento","volumen_deposito",
    // Bloque tubo alimentación
    "tubo_material","tubo_diametro","tubo_trazado","tubo_llave_general_situacion",
    "tubo_valvula_retencion","tubo_llave_general",
    // Bloque batería
    "num_baterias","bateria_marca","bateria_emplazamiento","bateria_num_filas",
    "bateria_num_columnas","caudal_simultaneo","caudal_instalado","conexion_general_loc",
    // Bloque grupo presión
    "tiene_grupo_presion","grupo_tipo","grupo_p_min","grupo_p_max",
    "grupo_vol_aspiracion","grupo_vol_util","grupo_vol_presion",
    "grupo_tub_llenado","grupo_valvula_llenado","grupo_emplazamiento",
    // Bloque montante
    "num_plantas","montante_material","montante_diametro",
    // Observaciones generales
    "observaciones",
    // Tipo de actuación
    "tipo_actuacion", // "nueva" / "ampliacion" / "modificacion"
    // Tomas: hasta 33 tomas × 3 campos = 99 columnas (LEGACY · no se usa desde v0.23)
    // Patrón: toma_F_C_senal | toma_F_C_destino | toma_F_C_caudal
    // F: 1..3 (fila), C: 1..11 (columna)
    ...buildTomasHeaders(),
    // Caudal total instalado (suma)
    "caudal_total_instalado",
    // v0.25.0 — Marca de campos editados por humano (JSON array de strings)
    "campos_editados_humano",
    "ultima_modificacion",
  ];

  // v0.23.0 — Helper: normaliza el orden de batería.
  // Valor por defecto = 1 (filas legacy o llamadas sin parámetro).
  function normOrden(orden) {
    const n = parseInt(orden, 10);
    return (n >= 1 && n <= 99) ? n : 1;
  }

  // v0.25.0 — Campos que NUNCA se marcan como "editado por humano".
  // Son metadatos del sistema, no datos editables por el usuario.
  const CAMPOS_NO_MARCABLES = new Set([
    "comunidad",
    "bateria_orden",
    "ultima_modificacion",
    "campos_editados_humano",
  ]);

  // v0.25.0 — Helper: parsea el JSON del campo. Defensivo: si está vacío o
  // tiene basura, devuelve []. Nunca lanza.
  function parseCamposEditadosJSON(jsonStr) {
    if (!jsonStr) return [];
    try {
      const arr = JSON.parse(jsonStr);
      if (!Array.isArray(arr)) return [];
      return arr.filter(x => typeof x === "string");
    } catch {
      return [];
    }
  }

  // v0.25.0 — Helper: dado un valor previo y uno entrante, decide si "cambió"
  // a efectos de marcar como humano. Trata "" y undefined/null como equivalentes.
  function valorCambia(prev, nuevo) {
    const a = (prev === undefined || prev === null) ? "" : String(prev);
    const b = (nuevo === undefined || nuevo === null) ? "" : String(nuevo);
    return a !== b;
  }

  function buildTomasHeaders() {
    const arr = [];
    for (let f = 1; f <= 3; f++) {
      for (let c = 1; c <= 11; c++) {
        arr.push(`toma_${f}_${c}_senal`);
        arr.push(`toma_${f}_${c}_destino`);
        arr.push(`toma_${f}_${c}_caudal`);
      }
    }
    return arr;
  }

  // Caché in-memory para evitar leer/escribir el header cada vez.
  // Se resetea al reiniciar el proceso. Si la migración falla, vuelve a null
  // para reintentar en la siguiente llamada.
  let _pestanaTecnicosOK = null;

  async function asegurarPestanaTecnicos() {
    if (_pestanaTecnicosOK === true) return true;
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const sheetInfo = (meta.data.sheets || []).find(s =>
        s.properties && s.properties.title === "datos_tecnicos_bateria"
      );

      const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);

      // CASO A: la pestaña no existe → crearla con el header completo.
      if (!sheetInfo) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "datos_tecnicos_bateria" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `datos_tecnicos_bateria!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [TECNICOS_HEADERS] },
        });
        console.log(`[fase14-cert] Tab datos_tecnicos_bateria creada (${TECNICOS_HEADERS.length} columnas)`);
        _pestanaTecnicosOK = true;
        return true;
      }

      // CASO B: la pestaña existe → comprobar que el header coincide.
      // Si NO coincide (faltan columnas nuevas como bateria_orden, rotulo_*),
      // reescribimos el header completo. Esto NO borra datos: solo cambia fila 1.
      const headerActual = await leerHojaSafe(`datos_tecnicos_bateria!A1:${lastCol}1`);
      const filaHeader = (headerActual[0] || []).map(c => String(c || "").trim());

      const necesitaMigrar = TECNICOS_HEADERS.some((h, i) => filaHeader[i] !== h);
      if (necesitaMigrar) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `datos_tecnicos_bateria!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [TECNICOS_HEADERS] },
        });
        console.log(`[fase14-cert] v0.23.0 · Header migrado a ${TECNICOS_HEADERS.length} columnas (incluye bateria_orden + rotulo_*)`);
      }

      _pestanaTecnicosOK = true;
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaTecnicos:", err.message);
      _pestanaTecnicosOK = null;   // reintentaremos en la próxima llamada
      return false;
    }
  }

  function colLetterFromIdx(n) {
    let s = "";
    n = n + 1;
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // ============================================================
  // LECTURA · v0.23.0 — Soporte multi-batería
  // ============================================================
  // Helper: ¿esta fila coincide con (comunidad, bateria_orden)?
  // bateria_orden vacío en Sheet se interpreta como 1 (compatibilidad legacy).
  function _filaMatchea(row, comunidad, orden) {
    if (String(row[0] || "").trim() !== comunidad.trim()) return false;
    const ordenFila = normOrden(row[1] || "1");
    return ordenFila === normOrden(orden);
  }

  // Devuelve la batería con `bateria_orden` indicado (default 1).
  // Si no existe, devuelve objeto con todos los campos vacíos + comunidad + orden.
  // ⚠️ Mantiene la firma legacy: leerDatosTecnicos(comunidad) sigue funcionando.
  async function leerDatosTecnicos(comunidad, orden = 1) {
    await asegurarPestanaTecnicos();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);
    for (const row of rows) {
      if (_filaMatchea(row, comunidad, orden)) {
        const obj = {};
        for (let i = 0; i < TECNICOS_HEADERS.length; i++) {
          obj[TECNICOS_HEADERS[i]] = row[i] || "";
        }
        // Normalizamos el orden devuelto para que el cliente siempre vea un número
        obj.bateria_orden = String(normOrden(obj.bateria_orden));
        // v0.25.0 — parsear campos_editados_humano a array
        obj.campos_editados_humano = parseCamposEditadosJSON(obj.campos_editados_humano);
        return obj;
      }
    }
    // Sin registro: devolver objeto vacío con comunidad y orden ya rellenos
    const vacio = {};
    for (const h of TECNICOS_HEADERS) vacio[h] = "";
    vacio.comunidad = comunidad.trim();
    vacio.bateria_orden = String(normOrden(orden));
    vacio.campos_editados_humano = [];
    return vacio;
  }

  // v0.23.0 — Devuelve TODAS las baterías de una comunidad, ordenadas por bateria_orden.
  // Si no hay ninguna, devuelve [] (no inventa una vacía: el caller decide).
  async function leerBateriasDeComunidad(comunidad) {
    await asegurarPestanaTecnicos();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);
    const baterias = [];
    for (const row of rows) {
      if (String(row[0] || "").trim() !== comunidad.trim()) continue;
      const obj = {};
      for (let i = 0; i < TECNICOS_HEADERS.length; i++) {
        obj[TECNICOS_HEADERS[i]] = row[i] || "";
      }
      obj.bateria_orden = String(normOrden(obj.bateria_orden));
      // v0.25.0 — parsear campos_editados_humano a array
      obj.campos_editados_humano = parseCamposEditadosJSON(obj.campos_editados_humano);
      baterias.push(obj);
    }
    baterias.sort((a, b) => parseInt(a.bateria_orden, 10) - parseInt(b.bateria_orden, 10));
    return baterias;
  }

  // v0.23.0 — Próximo orden disponible para una comunidad (1 si no hay nada,
  // max+1 si ya hay baterías).
  async function siguienteOrdenBateria(comunidad) {
    const baterias = await leerBateriasDeComunidad(comunidad);
    if (baterias.length === 0) return 1;
    const maxOrden = Math.max(...baterias.map(b => parseInt(b.bateria_orden, 10) || 1));
    return maxOrden + 1;
  }

  // v0.25.0 — Helper público: lista de campos marcados como editados por humano.
  // Devuelve [] si no hay registro o si el JSON está corrupto.
  async function leerCamposEditadosHumano(comunidad, orden = 1) {
    const tec = await leerDatosTecnicos(comunidad, orden);
    return Array.isArray(tec.campos_editados_humano) ? tec.campos_editados_humano : [];
  }

  // v0.25.0 — Helper público: ¿está este campo marcado como humano?
  async function esCampoEditadoHumano(comunidad, orden, campo) {
    const campos = await leerCamposEditadosHumano(comunidad, orden);
    return campos.includes(campo);
  }

  // ============================================================
  // ESCRITURA · v0.23.0 — Clave compuesta (comunidad, bateria_orden)
  // v0.25.0 — Marcado automático "editado por humano":
  //   · Si encontramos fila existente, comparamos cada campo entrante con
  //     el valor previo. Marcamos como humano SOLO si:
  //       - el valor previo NO estaba vacío Y
  //       - el nuevo valor es distinto al previo.
  //   · Rellenar un campo vacío NO marca (puede ser autocompletado del RT
  //     o primera entrada manual; no podemos distinguir y mejor permisivo).
  //   · La marca es acumulativa: nunca se quita sola, solo se añade.
  // ============================================================
  // Mantiene la firma legacy escribirDatosTecnicos(comunidad, datos)
  // si `datos` se omite, se asume orden=1 y `datos`=arg2. Es decir,
  // tanto escribirDatosTecnicos(com, datos) como
  //       escribirDatosTecnicos(com, orden, datos) funcionan.
  async function escribirDatosTecnicos(comunidad, ordenOrDatos, datosOpt) {
    let orden, datos;
    if (datosOpt === undefined) {
      // Firma legacy: (comunidad, datos)
      orden = 1;
      datos = ordenOrDatos || {};
    } else {
      orden = normOrden(ordenOrDatos);
      datos = datosOpt || {};
    }

    await asegurarPestanaTecnicos();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);
    const ahora = new Date().toISOString();

    // v0.25.0 — Localizar fila existente PRIMERO (necesitamos los valores previos
    // para el cálculo de marcado).
    let rowIndex = -1;
    let filaPrevia = null;
    for (let i = 0; i < rows.length; i++) {
      if (_filaMatchea(rows[i], comunidad, orden)) {
        rowIndex = i + 2;
        filaPrevia = rows[i];
        break;
      }
    }

    // v0.25.0 — Calcular nueva lista de campos editados por humano.
    // Parte de la lista previa (acumulativo: nunca se desmarcan campos)
    // y añade los campos que cambian de un valor no-vacío a otro distinto.
    let camposEditadosHumano = [];
    if (filaPrevia) {
      const idxCampos = TECNICOS_HEADERS.indexOf("campos_editados_humano");
      const jsonPrevio = idxCampos >= 0 ? (filaPrevia[idxCampos] || "") : "";
      camposEditadosHumano = parseCamposEditadosJSON(jsonPrevio);

      // Detectar cambios: para cada campo presente en `datos`, comparar con previo
      const setCampos = new Set(camposEditadosHumano);
      for (const k of Object.keys(datos)) {
        if (CAMPOS_NO_MARCABLES.has(k)) continue;
        const idx = TECNICOS_HEADERS.indexOf(k);
        if (idx < 0) continue;                       // campo desconocido, ignorar
        const valorPrev  = filaPrevia[idx] || "";
        const valorNuevo = datos[k];
        // Opción C: solo marca si previo NO estaba vacío Y los valores difieren
        const prevTenia = String(valorPrev).trim() !== "";
        if (prevTenia && valorCambia(valorPrev, valorNuevo)) {
          setCampos.add(k);
        }
      }
      camposEditadosHumano = Array.from(setCampos).sort();
    }
    // Si no hay fila previa: es una creación, no hay nada que marcar.
    const jsonCamposEditados = JSON.stringify(camposEditadosHumano);

    const fila = TECNICOS_HEADERS.map(h => {
      if (h === "comunidad") return comunidad.trim();
      if (h === "bateria_orden") return String(orden);
      if (h === "ultima_modificacion") return ahora;
      if (h === "campos_editados_humano") return jsonCamposEditados;
      return String(datos[h] !== undefined ? datos[h] : "");
    });

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `datos_tecnicos_bateria!A${rowIndex}:${lastCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `datos_tecnicos_bateria!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });
    }
    return true;
  }

  // v0.23.0 — Eliminar una batería concreta. Si solo queda 1 batería y se intenta
  // borrar, devuelve false (no borramos la última: el caller debe decidir si
  // vaciar los datos en su lugar). Devuelve true si se borró.
  async function eliminarBateria(comunidad, orden) {
    const o = normOrden(orden);
    const baterias = await leerBateriasDeComunidad(comunidad);
    if (baterias.length <= 1) return false;       // protección: no borramos la última
    if (!baterias.find(b => parseInt(b.bateria_orden, 10) === o)) return false;

    await asegurarPestanaTecnicos();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (_filaMatchea(rows[i], comunidad, o)) {
        rowIndex = i + 2;
        break;
      }
    }
    if (rowIndex < 0) return false;

    // Borrar la fila físicamente (deleteDimension)
    // Necesitamos el sheetId numérico:
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    });
    const sheetInfo = (meta.data.sheets || []).find(s =>
      s.properties && s.properties.title === "datos_tecnicos_bateria"
    );
    if (!sheetInfo) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetInfo.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,   // 0-indexed para la API
              endIndex: rowIndex,
            }
          }
        }]
      }
    });
    return true;
  }

  // ============================================================
  // GENERACIÓN DE PDF · helpers comunes
  // ============================================================

  // Cargar PDF base desde assets/emasesa
  async function cargarPdfBase(nombreArchivo) {
    const ruta = path.join(__dirname, "assets", "emasesa", nombreArchivo);
    if (!fs.existsSync(ruta)) {
      throw new Error(`PDF base no encontrado: ${ruta}`);
    }
    const bytes = fs.readFileSync(ruta);
    return await PDFDocument.load(bytes);
  }

  // Pintar texto en una página (para overlays sobre PDFs planos)
  // v0.21.9 — Texto en AZUL para diferenciarlo del texto fijo del PDF base
  // (mismo concepto que un bolígrafo azul rellenando un formulario oficial)
  const COLOR_RELLENO = rgb(0.05, 0.15, 0.5);  // azul oscuro tipo bolígrafo
  function pintarTexto(page, font, texto, x, y, size = 10) {
    if (!texto) return;
    try {
      page.drawText(String(texto), {
        x, y, size, font,
        color: COLOR_RELLENO,
      });
    } catch (err) {
      console.warn(`[fase14-cert] pintarTexto error en "${texto}":`, err.message);
    }
  }

  // v0.21.10 — Separar dirección de su número final.
  // Ej: "Nuestra Señora de la Oliva 2" → { calle: "Nuestra Señora de la Oliva", numero: "2" }
  //     "C/ Mayor 15B" → { calle: "C/ Mayor", numero: "15B" }
  //     "Avda. de la Paz, 42" → { calle: "Avda. de la Paz", numero: "42" }
  function separarDireccion(direccion) {
    if (!direccion) return { calle: "", numero: "" };
    const txt = String(direccion).trim();
    // Patrón: termina en número opcionalmente seguido de letra (1, 15B, 42, 100bis, etc.)
    const m = txt.match(/^(.+?)[\s,]+(\d+(?:\s*[A-Za-z]+)?)\s*$/);
    if (m) {
      return {
        calle: m[1].trim().replace(/,$/, "").trim(),
        numero: m[2].trim()
      };
    }
    return { calle: txt, numero: "" };
  }

  // ============================================================
  // CO 080 · PDF interactivo con form fields
  // 18 campos auto + 10 semi-auto + el resto rellenado por JM
  // ============================================================
  async function generarCO080(com, titular, tecnicos) {
    const pdfDoc = await cargarPdfBase("CO_080_V00.pdf");
    const form = pdfDoc.getForm();
    const instalador = getInstaladorAutorizado();
    const hoy = new Date();
    const meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                   "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

    // Nombre legal del cliente (igual que en factura Holded)
    const nombreLegal = (() => {
      const nom = String(com.comunidad || "").trim();
      if (!nom) return "";
      if (/^COMUNIDAD DE PROPIETARIOS/i.test(nom)) return nom.toUpperCase();
      return ("COMUNIDAD DE PROPIETARIOS " + nom).toUpperCase();
    })();

    // Mapeo de campos → valores. Si un campo no tiene valor, lo dejamos vacío.
    const VALORES = {
      // Titular
      "Razon Social":       nombreLegal,
      "Domicilio":          com.direccion || "",
      "Localidad":          "Sevilla",
      "Provincia":          "Sevilla",
      "CP":                 titular.cp || "",
      "Correo Electrónico": com.email_presidente || "",
      "Teléfono":           com.telefono_presidente || "",
      "Text2":              com.cif_comunidad_runtime || "",  // CIF de ordenes_trabajo
      // Emplazamiento
      "Emplazamiento":      com.direccion || "",
      "Número":             tecnicos.numero_edificio || "",
      "Bloque":             tecnicos.bloque || "",
      "Portal":             tecnicos.portal || "",
      "Escalera":           tecnicos.escalera || "",
      "Piso":               tecnicos.piso || "",
      "Puerta":             tecnicos.puerta || "",
      "Localidad_2":        "Sevilla",
      "Provincia_2":        "Sevilla",
      "CP 2":               titular.cp_emplazamiento || titular.cp || "",
      "Superficie en caso de local comercial": tecnicos.superficie_comercial || "",
      "Volumen":            tecnicos.volumen_deposito || "",
      // Empresa instaladora
      "Empresa Instaladora": EMPRESA_INSTALADORA.razon_social,
      "CIF":                EMPRESA_INSTALADORA.cif,
      "Dirección":          EMPRESA_INSTALADORA.direccion,
      "Teléfonos":          EMPRESA_INSTALADORA.telefonos,
      "Nombre del instalador": instalador.nombre,
      "NIF":                instalador.nif,
      "correo electrónico": EMPRESA_INSTALADORA.email,
      "Teléfono móvil":     EMPRESA_INSTALADORA.movil,
      // Fecha
      "Sevilla":            "Sevilla",
      "dia":                String(hoy.getDate()).padStart(2, "0"),
      "Mes":                meses[hoy.getMonth()],
      "año":                String(hoy.getFullYear()),
      // Tubo alimentación
      "Material":           tecnicos.tubo_material || "",
      "Diámetro":           tecnicos.tubo_diametro || "",
      "Trazado":            tecnicos.tubo_trazado || "",
      "Localización de conexión general": tecnicos.conexion_general_loc || "",
      "V retención":        tecnicos.tubo_valvula_retencion || "",
      "Llave":              tecnicos.tubo_llave_general || "",
      "Llave General":      tecnicos.tubo_llave_general_situacion || "",
      // Batería
      "num Baterias":       tecnicos.num_baterias || "",
      "Marca":              tecnicos.bateria_marca || "",
      "Localizacion":       tecnicos.bateria_emplazamiento || "",
      "num Filas":          tecnicos.bateria_num_filas || "",
      "N columnas":         tecnicos.bateria_num_columnas || "",
      "Q simultáneo 9":     tecnicos.caudal_simultaneo || "",
      "Q Instalado":        tecnicos.caudal_instalado || "",
      "Q INSTALADO":        tecnicos.caudal_instalado || "",
      // Montante y plantas
      "N de Plantas":       tecnicos.num_plantas || "",
      "Material_2":         tecnicos.montante_material || "",
      "Diámetro_2":         tecnicos.montante_diametro || "",
      "Montante":           tecnicos.montante_material || "",
      // Grupo presión
      "Tipo Grupo":         tecnicos.grupo_tipo || "",
      "P Min":              tecnicos.grupo_p_min || "",
      "P Maximo":           tecnicos.grupo_p_max || "",
      "Vol Aspiracion":     tecnicos.grupo_vol_aspiracion || "",
      "Vol Util Deposito":  tecnicos.grupo_vol_util || "",
      "Vol Dep Presion":    tecnicos.grupo_vol_presion || "",
      "Tub de llenado":     tecnicos.grupo_tub_llenado || "",
      "Valvula de llenado": tecnicos.grupo_valvula_llenado || "",
      "Emplazamiento grupo": tecnicos.grupo_emplazamiento || "",
      // Observaciones
      "Observaciones":      tecnicos.observaciones || "",
    };

    // Aplicar valores con manejo defensivo (campos pueden no existir)
    for (const [campo, valor] of Object.entries(VALORES)) {
      if (!valor) continue;
      try {
        const f = form.getTextField(campo);
        f.setText(String(valor));
      } catch (err) {
        // El campo no existe o no es de texto → ignorar
      }
    }

    // Checkboxes (uso, tipo actuación, abastecimiento)
    try {
      const uso = (tecnicos.uso || "").toLowerCase();
      if (uso === "domestico" || uso === "doméstico") {
        form.getCheckBox("Uso Domestico").check();
      } else if (uso === "comercial") {
        form.getCheckBox("Uso Comercial").check();
      }
    } catch {}

    try {
      const tipoAct = (tecnicos.tipo_actuacion || "nueva").toLowerCase();
      if (tipoAct === "nueva") form.getCheckBox("Nueva").check();
      else if (tipoAct === "ampliacion") form.getCheckBox("Ampliacion").check();
      else if (tipoAct === "modificacion") form.getCheckBox("modificacion").check();
    } catch {}

    try {
      const forma = (tecnicos.forma_abastecimiento || "").toLowerCase();
      if (forma === "directa") form.getCheckBox("Directa").check();
      else if (forma === "deposito" || forma === "depósito" || forma === "aljibe") {
        form.getCheckBox("Aljibe").check();
      }
    } catch {}

    // v0.21.2 — Forzar actualización de apariencia de los form fields.
    // Sin esto, los textos rellenados quedan en estructura pero NO se ven al abrir el PDF.
    try { form.updateFieldAppearances(); } catch (err) {
      console.warn("[fase14-cert] updateFieldAppearances:", err.message);
    }

    // v0.22.2 — Sello + firma ARA en esquina inferior izquierda
    await embedSelloAra(pdfDoc, "CO080");

    return await pdfDoc.save();
  }
  // ============================================================
  // CO 073 · v0.22.0 — AcroForm-based
  // Usa CO_073_template.pdf (formulario oficial EMASESA + capa de
  // campos rellenables). CERO COORDENADAS. Cada dato se aplica con
  // form.getTextField(name).setText(value). Si un campo falla solo
  // queda como warn en logs, no rompe el certificado.
  // ============================================================
  async function generarCO073(com, titular, tecnicos, emasesaRT) {
    const pdfDoc = await cargarPdfBase("CO_073_template.pdf");
    const form = pdfDoc.getForm();

    function s(name, value) {
      if (value === null || value === undefined || value === "") return;
      try { form.getTextField(name).setText(String(value)); }
      catch (err) { console.warn(`[fase14-cert/CO073] campo "${name}" no existe: ${err.message}`); }
    }
    function chk(name) {
      try { form.getCheckBox(name).check(); }
      catch (err) { console.warn(`[fase14-cert/CO073] checkbox "${name}" no existe: ${err.message}`); }
    }

    // ─── Cabecera ───
    s("bateria_numero", emasesaRT?.bateria_numero || "");
    chk("rotulada_si");                       // siempre SI — baterías nuevas

    const hoy = new Date();
    s("fecha", `${String(hoy.getDate()).padStart(2,"0")}/${String(hoy.getMonth()+1).padStart(2,"0")}/${hoy.getFullYear()}`);

    // ─── Datos finca ───
    const direFinca = separarDireccion(com.direccion);
    s("direccion",       direFinca.calle);
    s("numero_edificio", tecnicos.numero_edificio || direFinca.numero);
    s("poblacion",       "Sevilla");
    s("cp",              titular.cp || "");
    s("nombre_edificio", tecnicos.nombre_edificio || "");
    s("num_plantas",     tecnicos.num_plantas || "");
    s("altura",          tecnicos.altura || "");

    // ─── Tabla "SEGÚN INSPECCIÓN" (22 filas máx) ───
    const tomas = (emasesaRT?.tomas || []).filter(t => t.piso || t.cliente);
    for (let i = 0; i < tomas.length && i < 22; i++) {
      const t = tomas[i];
      const senal = ((t.piso || "") + (t.puerta ? " " + t.puerta : "")).trim();
      s(`toma_${i+1}_id`,      t.toma || "");
      s(`toma_${i+1}_senal`,   senal);
      s(`toma_${i+1}_cliente`, (t.cliente || "").substring(0, 45));
      chk(`toma_${i+1}_si`);
    }

    // ─── Pie ───
    s("presidente_nombre", (com.presidente || "").toUpperCase());
    // v0.22.2 — fix: instalador_nif y instalador_nombre llamaban a propiedades
    // inexistentes en EMPRESA_INSTALADORA (.nif_instalador, .nombre_instalador).
    // El instalador autorizado vive en variables de entorno ARA_INSTALADOR_*.
    const instalador = getInstaladorAutorizado();
    s("instalador_nif",    instalador.nif);
    s("instalador_nombre", instalador.nombre);

    // ─── Sello + firma (si existe asset) ───
    await embedSelloAra(pdfDoc, "CO073");

    form.flatten();
    return await pdfDoc.save();
  }

  // ============================================================
  // RELACIÓN DE TOMAS · v0.22.0 — AcroForm-based
  // Usa Relacion_tomas_template.pdf. Acepta `rotuloBateria` (extraído
  // de foto con IA Vision) para pintar las tomas en el orden FÍSICO
  // real, no el orden EMASESA. Calcula caudal total agregando.
  // ============================================================
  async function generarRelacionTomas(com, titular, tecnicos, emasesaRT, rotuloBateria) {
    const pdfDoc = await cargarPdfBase("Relacion_tomas_template.pdf");
    const form = pdfDoc.getForm();

    function s(name, value) {
      if (value === null || value === undefined || value === "") return;
      try { form.getTextField(name).setText(String(value)); }
      catch (err) { console.warn(`[fase14-cert/RT] campo "${name}" no existe: ${err.message}`); }
    }

    // ─── Finca ───
    const direFinca = separarDireccion(com.direccion);
    s("direccion",       direFinca.calle);
    s("numero_edificio", tecnicos.numero_edificio || direFinca.numero);
    s("poblacion",       "Sevilla");
    s("cp",              titular.cp || "");
    s("ampliacion",      tecnicos.nombre_edificio || "");

    // ─── Tubo de alimentación ───
    s("tubo_material", tecnicos.tubo_material || "");
    s("tubo_diametro", tecnicos.tubo_diametro || "");
    s("tubo_llave",    tecnicos.tubo_situacion_llave || "");
    s("tubo_trazado",  tecnicos.tubo_trazado || "");

    // ─── Batería ───
    s("bateria_marca", tecnicos.bateria_marca || "");
    s("bateria_orden", "1");

    const tomasEm = (emasesaRT?.tomas || []).filter(t => t.piso || t.cliente);
    let numTomas = String(tomasEm.length);
    if ((!tomasEm.length || numTomas === "0") && rotuloBateria?.celdas) {
      numTomas = String(rotuloBateria.celdas.filter(c => c && c.toUpperCase() !== "X").length);
    }
    if (!numTomas || numTomas === "0") {
      const f = parseInt(tecnicos.bateria_num_filas || 0);
      const c = parseInt(tecnicos.bateria_num_columnas || 0);
      if (f * c > 0) numTomas = String(f * c);
    }
    s("bateria_num_tomas", numTomas);
    s("bateria_emplazamiento", emasesaRT?.ubicacion_bateria || tecnicos.bateria_emplazamiento || "");

    // ─── Alimentación ───
    s("acometida_diametro", tecnicos.acometida_diametro || "");
    s("suministro_actual",  emasesaRT?.suministro || tecnicos.num_suministro_emasesa || "");
    s("expte_licencia",     tecnicos.expte_licencia || "");
    s("grupo_presion",      tecnicos.grupo_presion || "");

    // ─── Tabla de tomas (3 filas × 11 columnas) ───
    // v0.22.3 — matching robusto con fallbacks:
    //   1. Match exacto: piso+puerta === celda  (ej: "1ºA" === "1ºA")
    //   2. Match comunidad: celda "C" → toma con puerta="COM" o destino="C"
    //   3. Match planta-baja: celda "BAJO" → primera toma con piso="Bajo" sin match previo
    //   4. Marcamos tomas ya emparejadas para no usarlas dos veces.
    let caudalTotal = 0;
    const celdas   = rotuloBateria?.celdas   || [];
    const numFilas = rotuloBateria?.numFilas || 3;
    const numCols  = rotuloBateria?.numCols  || 11;
    const usadas   = new Set();   // indices de tomasEm ya emparejadas

    function buscarToma(celda) {
      const celdaNorm = String(celda || "").toUpperCase().replace(/\s+/g, "");
      // 1. Match exacto piso+puerta
      let idx = tomasEm.findIndex((t, i) => {
        if (usadas.has(i)) return false;
        const senalT = ((t.piso || "") + (t.puerta ? " " + t.puerta : "")).toUpperCase().replace(/\s+/g, "");
        return senalT === celdaNorm;
      });
      if (idx >= 0) return { toma: tomasEm[idx], i: idx };
      // 2. Match "C" → comunidad (toma con puerta=COM o destino=C)
      if (celdaNorm === "C") {
        idx = tomasEm.findIndex((t, i) => {
          if (usadas.has(i)) return false;
          const puerta = (t.puerta || "").toUpperCase();
          const destino = (t.destino || "").toUpperCase();
          return puerta === "COM" || destino === "C";
        });
        if (idx >= 0) return { toma: tomasEm[idx], i: idx };
      }
      // 3. Match "BAJO" (sin sufijo) → primera toma piso=Bajo sin match aún
      if (celdaNorm === "BAJO") {
        idx = tomasEm.findIndex((t, i) => {
          if (usadas.has(i)) return false;
          return (t.piso || "").toUpperCase().replace(/\s+/g, "") === "BAJO";
        });
        if (idx >= 0) return { toma: tomasEm[idx], i: idx };
      }
      return null;
    }

    for (let f = 1; f <= 3; f++) {
      for (let c = 1; c <= 11; c++) {
        if (f > numFilas || c > numCols) continue;
        const idx = (f - 1) * numCols + (c - 1);
        const celda = celdas[idx];
        if (!celda) continue;
        const celdaNorm = String(celda).toUpperCase().replace(/\s+/g, "");
        const match = buscarToma(celda);
        s(`tabla_${f}_${c}_senal`, celda);
        if (match) {
          usadas.add(match.i);
          const tomaMatch = match.toma;
          s(`tabla_${f}_${c}_destino`, tomaMatch.destino || (celdaNorm === "X" ? "X" : celdaNorm === "C" ? "C" : "V"));
          if (tomaMatch.caudal !== null && tomaMatch.caudal !== undefined && tomaMatch.caudal !== "") {
            const cd = Number(String(tomaMatch.caudal).replace(",", "."));
            if (!isNaN(cd)) caudalTotal += cd;
            s(`tabla_${f}_${c}_caudal`, tomaMatch.caudal);
          }
        } else {
          s(`tabla_${f}_${c}_destino`, celdaNorm === "X" ? "X" : celdaNorm === "C" ? "C" : "V");
        }
      }
    }
    const ctFinal = emasesaRT?.caudal_total || (caudalTotal > 0 ? caudalTotal.toFixed(2).replace(".", ",") : "");
    s("caudal_total", ctFinal);

    // ─── Pie: compromiso instalador ───
    // v0.22.2 — fix: nombre_instalador no existe en EMPRESA_INSTALADORA.
    // El nombre legal del instalador autorizado vive en ARA_INSTALADOR_NOMBRE.
    const instalador = getInstaladorAutorizado();
    s("instalador_nombre_compromiso", instalador.nombre);
    s("instalador_empresa",           EMPRESA_INSTALADORA.razon_social);
    s("instalador_telefono",          EMPRESA_INSTALADORA.telefonos);

    // ─── Fecha ───
    const hoy = new Date();
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    s("fecha_localidad", "Sevilla");
    s("fecha_dia",       String(hoy.getDate()));
    s("fecha_mes",       meses[hoy.getMonth()]);
    s("fecha_anyo",      String(hoy.getFullYear()).slice(-2));

    // ─── Firma propiedad ───
    s("presidente_nombre",   (com.presidente || "").toUpperCase());
    s("presidente_telefono", com.telefono_presidente || "");

    // ─── Sello + firma ───
    await embedSelloAra(pdfDoc, "RT");

    form.flatten();
    return await pdfDoc.save();
  }

  // ============================================================
  // embedSelloAra · v0.22.0 — pega sello + firma ARA en el PDF
  // Sólo si existe assets/emasesa/sello_ara.png. Salida silenciosa
  // si no está (los PDFs sin sello aún son válidos para EMASESA).
  // ============================================================
  async function embedSelloAra(pdfDoc, docType) {
    const rutaSello = path.join(__dirname, "assets", "emasesa", "sello_ara.png");
    if (!fs.existsSync(rutaSello)) return;
    try {
      const png = await pdfDoc.embedPng(fs.readFileSync(rutaSello));
      const page = pdfDoc.getPages()[0];
      if (docType === "CO073") {
        page.drawImage(png, { x: 425, y: 35, width: 75, height: 75, opacity: 0.95 });
      } else if (docType === "RT") {
        page.drawImage(png, { x: 50, y: 50, width: 110, height: 110, opacity: 0.95 });
      } else if (docType === "CO080") {
        // v0.22.2 — Esquina inferior izquierda, en zona "La empresa instaladora CERTIFICA"
        // Página CO 080: 612 x 859 pts (más alta que A4)
        page.drawImage(png, { x: 50, y: 2, width: 79, height: 79, opacity: 0.95 });
      }
    } catch (err) {
      console.warn(`[fase14-cert] error embed sello: ${err.message}`);
    }
  }

  // ============================================================
  // SUBIDA A DRIVE · helper
  // Replica la lógica de subir-pdf-firmado:
  // - Busca/crea subcarpeta por comunidad en DRIVE_FOLDER_FASE14_FIRMADAS
  // - Sube el archivo con nombre indicado
  // - Devuelve {url, filename}
  // ============================================================
  async function subirPdfADrive(buffer, filename, comunidad) {
    const carpetaRaizId = process.env.DRIVE_FOLDER_FASE14_FIRMADAS;
    if (!carpetaRaizId) {
      throw new Error("Falta DRIVE_FOLDER_FASE14_FIRMADAS en el entorno");
    }
    const drive = getDriveClient();
    const nombreSafe = comunidad.replace(/'/g, "\\'");

    // Buscar subcarpeta
    const busq = await drive.files.list({
      q: `name='${nombreSafe}' and '${carpetaRaizId}' in parents and ` +
         `mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    let subcarpetaId;
    if (busq.data.files && busq.data.files.length > 0) {
      subcarpetaId = busq.data.files[0].id;
    } else {
      const creada = await drive.files.create({
        requestBody: {
          name: comunidad,
          mimeType: "application/vnd.google-apps.folder",
          parents: [carpetaRaizId],
        },
        fields: "id",
      });
      subcarpetaId = creada.data.id;
    }

    const subido = await drive.files.create({
      requestBody: { name: filename, parents: [subcarpetaId] },
      media: { mimeType: "application/pdf", body: Readable.from(Buffer.from(buffer)) },
      fields: "id, name, webViewLink",
    });
    return { url: subido.data.webViewLink, filename: subido.data.name };
  }

  // ============================================================
  // ENDPOINTS
  // ============================================================

  // ── GET /api/ara-os/fase14/datos-certificado?ccpp_id=...
  app.options("/api/ara-os/fase14/datos-certificado", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/fase14/datos-certificado", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const titular = await leerDatosTitular(com.comunidad);

      // v0.23.0 — Multi-batería:
      // Leer TODAS las baterías existentes. Si no hay ninguna, devolvemos
      // un placeholder con orden=1 (mantiene compatibilidad con frontend antiguo).
      const baterias = await leerBateriasDeComunidad(com.comunidad);
      const bateriasEmasesa = await leerEmasesaRT_todas(com.comunidad);

      if (baterias.length === 0) {
        // Sin filas en datos_tecnicos_bateria → vista vacía con orden=1
        const vacio = await leerDatosTecnicos(com.comunidad, 1);
        baterias.push(vacio);
      }

      // Adjuntar datos EMASESA RT (rótulo + tomas) a cada batería por orden
      const baterias_completas = baterias.map(b => {
        const orden = parseInt(b.bateria_orden, 10) || 1;
        const em = bateriasEmasesa.find(e => parseInt(e.bateria_orden, 10) === orden) || null;
        return { ...b, emasesa: em };
      });

      res.json({
        ok: true,
        version: "0.23.0",
        comunidad_data: {
          comunidad: com.comunidad,
          direccion: com.direccion,
          email_presidente: com.email_presidente,
          telefono_presidente: com.telefono_presidente,
          presidente: com.presidente,
        },
        instalador_data: getInstaladorAutorizado(),
        empresa_data: EMPRESA_INSTALADORA,
        titular_data: titular,

        // v0.23.0 — Multi-batería:
        baterias: baterias_completas,
        num_baterias: baterias_completas.length,

        // Legacy: la primera batería como `tecnicos_data` para compatibilidad
        // con frontend antiguo que no maneja `baterias[]`.
        tecnicos_data: baterias_completas[0] || {},
      });
    } catch (err) {
      console.error("[fase14/datos-certificado]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/ara-os/fase14/guardar-cp-titular
  app.options("/api/ara-os/fase14/guardar-cp-titular", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/guardar-cp-titular", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, cp, cp_emplazamiento } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      await escribirDatosTitular(com.comunidad, {
        cp: cp || "",
        cp_emplazamiento: cp_emplazamiento || "",
      });
      res.json({ ok: true, version: "0.20.0", comunidad: com.comunidad });
    } catch (err) {
      console.error("[fase14/guardar-cp-titular]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/ara-os/fase14/guardar-datos-tecnicos
  app.options("/api/ara-os/fase14/guardar-datos-tecnicos", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/guardar-datos-tecnicos", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, datos, bateria_orden } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!datos || typeof datos !== "object") {
        return res.status(400).json({ error: "Falta payload `datos`" });
      }

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      // v0.23.0 — Default orden=1 (compatibilidad frontend antiguo)
      const orden = bateria_orden ? normOrden(bateria_orden) : 1;

      // Filtrar solo campos válidos (los que están en TECNICOS_HEADERS)
      const validKeys = new Set(TECNICOS_HEADERS);
      const datosFiltrados = {};
      for (const k of Object.keys(datos)) {
        if (validKeys.has(k)) datosFiltrados[k] = datos[k];
      }

      await escribirDatosTecnicos(com.comunidad, orden, datosFiltrados);
      res.json({ ok: true, version: "0.25.0", comunidad: com.comunidad, bateria_orden: orden });
    } catch (err) {
      console.error("[fase14/guardar-datos-tecnicos]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── v0.25.0 — GET /api/ara-os/fase14/campos-editados-humano
  // Devuelve la lista de campos marcados como "editados por humano" para
  // una comunidad + batería. Lo usará el frontend (paso 6 del sprint) para
  // decidir qué campos NO pisar al aplicar sugerencias de RT/Excel.
  app.options("/api/ara-os/fase14/campos-editados-humano", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/fase14/campos-editados-humano", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const orden = req.query.bateria_orden ? normOrden(req.query.bateria_orden) : 1;

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const campos = await leerCamposEditadosHumano(com.comunidad, orden);
      res.json({
        ok: true,
        version: "0.25.0",
        comunidad: com.comunidad,
        bateria_orden: orden,
        campos,
      });
    } catch (err) {
      console.error("[fase14/campos-editados-humano]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // v0.23.0 — Endpoints multi-batería
  // ============================================================
  // POST /baterias/anyadir { ccpp_id } → crea fila vacía con orden = max+1
  app.options("/api/ara-os/fase14/baterias/anyadir", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/baterias/anyadir", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const proximoOrden = await siguienteOrdenBateria(com.comunidad);
      if (proximoOrden > 10) {
        return res.status(400).json({ error: "Máximo 10 baterías por comunidad" });
      }

      // Crear fila vacía
      await escribirDatosTecnicos(com.comunidad, proximoOrden, {});

      console.log(`[fase14-cert/baterias] Añadida batería ${proximoOrden} a "${com.comunidad}"`);
      res.json({
        ok: true,
        version: "0.23.0",
        comunidad: com.comunidad,
        bateria_orden: proximoOrden,
      });
    } catch (err) {
      console.error("[fase14/baterias/anyadir]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /baterias/eliminar { ccpp_id, bateria_orden } → borra la fila
  // Protección: no se puede borrar la última batería (siempre queda al menos 1).
  app.options("/api/ara-os/fase14/baterias/eliminar", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/baterias/eliminar", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id, bateria_orden } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!bateria_orden) return res.status(400).json({ error: "Falta bateria_orden" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const orden = normOrden(bateria_orden);

      // Borrar de datos_tecnicos_bateria (puede negarse si solo queda 1)
      const borradoTec = await eliminarBateria(com.comunidad, orden);
      if (!borradoTec) {
        return res.status(400).json({
          error: "No se puede borrar: es la última batería o no existe.",
        });
      }

      // También borrar de emasesa_relacion_tomas si hay registro para ese orden
      // (no es crítico que falle, pero lo intentamos)
      try {
        const sheets = getSheetsClient();
        const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
        const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
        for (let i = 0; i < rows.length; i++) {
          if (_filaEmasesaMatchea(rows[i], com.comunidad, orden)) {
            const meta = await sheets.spreadsheets.get({
              spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            });
            const sheetInfo = (meta.data.sheets || []).find(s =>
              s.properties && s.properties.title === "emasesa_relacion_tomas"
            );
            if (sheetInfo) {
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId: process.env.GOOGLE_SHEETS_ID,
                requestBody: {
                  requests: [{
                    deleteDimension: {
                      range: {
                        sheetId: sheetInfo.properties.sheetId,
                        dimension: "ROWS",
                        startIndex: i + 1,
                        endIndex: i + 2,
                      }
                    }
                  }]
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn("[fase14-cert/baterias/eliminar] no se pudo limpiar emasesa_relacion_tomas:", err.message);
      }

      console.log(`[fase14-cert/baterias] Eliminada batería ${orden} de "${com.comunidad}"`);
      res.json({ ok: true, version: "0.23.0", comunidad: com.comunidad, bateria_orden: orden });
    } catch (err) {
      console.error("[fase14/baterias/eliminar]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/ara-os/fase14/generar-certificados
  // Genera CO 080 + (CO 073 + RT por batería), los sube a Drive y devuelve las URLs.
  app.options("/api/ara-os/fase14/generar-certificados", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/generar-certificados", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      // Verificar que tenemos el instalador autorizado
      const inst = getInstaladorAutorizado();
      if (!inst.nombre || !inst.nif) {
        return res.status(500).json({
          error: "Falta configurar ARA_INSTALADOR_NOMBRE y/o ARA_INSTALADOR_NIF en el entorno"
        });
      }

      // Cargar datos comunes
      const titular = await leerDatosTitular(com.comunidad);

      // v0.23.0 — Multi-batería: leer todas las baterías de la comunidad.
      // Si no hay ninguna fila en datos_tecnicos_bateria, generamos con datos vacíos
      // (orden=1) para conservar el comportamiento mínimo.
      let baterias = await leerBateriasDeComunidad(com.comunidad);
      if (baterias.length === 0) {
        baterias = [await leerDatosTecnicos(com.comunidad, 1)];
      }

      // Adjuntar CIF de comunidad desde ordenes_trabajo (columna AC=28)
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AK");
      for (const row of rowsOT) {
        if (String(row[0] || "").trim() === com.comunidad.trim()) {
          com.cif_comunidad_runtime = row[28] || "";
          break;
        }
      }

      console.log(`[fase14-cert] Generando certificados para "${com.comunidad}" · ${baterias.length} batería(s)...`);
      const fechaSlug = new Date().toISOString().slice(0, 10);
      const multi = baterias.length > 1;

      // Sufijo en nombre de archivo: vacío si 1 batería, "_b1", "_b2"... si N>1
      const sufijo = (orden) => multi ? `_b${orden}` : "";

      // 1. CO 080 — SIEMPRE 1 (datos hidráulicos comunes, basado en batería 1)
      //    Si hay >1 batería, ponemos num_baterias = N en los datos técnicos
      //    que se pasan al PDF. Esto sobrescribe el valor del Sheet si difiere.
      const tec_para_co080 = { ...baterias[0] };
      if (multi) tec_para_co080.num_baterias = String(baterias.length);
      const pdf080 = await generarCO080(com, titular, tec_para_co080);
      const r080 = await subirPdfADrive(pdf080, `CO_080_${fechaSlug}.pdf`, com.comunidad);

      // 2. CO 073 + RT — uno por batería
      const certs_por_bateria = [];
      for (const bat of baterias) {
        const orden = parseInt(bat.bateria_orden, 10) || 1;
        const emasesaRT = await leerEmasesaRT(com.comunidad, orden);

        console.log(`[fase14-cert/generar] Batería ${orden}: emasesaRT=${emasesaRT ? "OK" : "NULL"}, tomas=${emasesaRT?.tomas?.length || 0}, rotulo=${emasesaRT?.rotulo_celdas?.length || 0}`);

        const pdf073 = await generarCO073(com, titular, bat, emasesaRT);
        const pdfRel = await generarRelacionTomas(com, titular, bat, emasesaRT, {
          celdas:    emasesaRT?.rotulo_celdas || [],
          numFilas:  parseInt(emasesaRT?.rotulo_num_filas || 0),
          numCols:   parseInt(emasesaRT?.rotulo_num_cols  || 0),
        });

        const r073 = await subirPdfADrive(pdf073, `CO_073_${fechaSlug}${sufijo(orden)}.pdf`, com.comunidad);
        const rRel = await subirPdfADrive(pdfRel, `Relacion_tomas_${fechaSlug}${sufijo(orden)}.pdf`, com.comunidad);

        certs_por_bateria.push({
          bateria_orden: orden,
          co_073: r073,
          relacion_tomas: rRel,
        });
      }

      console.log(`[fase14-cert] OK: CO 080 + ${certs_por_bateria.length} (CO 073 + RT)`);

      // v0.26.0 — Marcar flag certificados_generados (no bloqueante)
      try {
        await marcarCertificadosGenerados(com.comunidad);
      } catch (err) {
        console.warn(`[fase14-cert] No se pudo marcar certificados_generados para ${com.comunidad}:`, err.message);
      }

      // Respuesta:
      //   - Si 1 batería → shape LEGACY { co_080, co_073, relacion_tomas }
      //   - Si N baterías → shape NUEVO { co_080, baterias: [...] }
      // El frontend antiguo solo entiende el shape legacy.
      if (multi) {
        res.json({
          ok: true,
          version: "0.26.0",
          comunidad: com.comunidad,
          num_baterias: baterias.length,
          certificados: {
            co_080: r080,
            baterias: certs_por_bateria,
          },
        });
      } else {
        res.json({
          ok: true,
          version: "0.26.0",
          comunidad: com.comunidad,
          num_baterias: 1,
          certificados: {
            co_080: r080,
            co_073: certs_por_bateria[0]?.co_073,
            relacion_tomas: certs_por_bateria[0]?.relacion_tomas,
            // Para frontends que ya conozcan multi-batería, también:
            baterias: certs_por_bateria,
          },
        });
      }
    } catch (err) {
      console.error("[fase14/generar-certificados]", err);
      const msg = String(err.message || "");
      if (/insufficient.*permissions|invalid_scope/i.test(msg)) {
        return res.status(500).json({ error: "El backend no tiene permisos de Google Drive.", debug: msg });
      }
      if (/PDF base no encontrado/i.test(msg)) {
        return res.status(500).json({ error: "Faltan los PDFs base en assets/emasesa/.", debug: msg });
      }
      res.status(500).json({ error: msg });
    }
  });

  // ============================================================
  // v0.21.0 — PARSER PDF "Relación de tomas" de EMASESA
  // Subida + parsing + persistencia. JM lo sube una vez por obra.
  // Los datos extraídos auto-rellenan los campos técnicos.
  // ============================================================

  const pdfParse = require("pdf-parse");

  // Upload para PDF EMASESA — reutiliza el patrón de uploadPDF de holded
  const uploadEmasesa = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = file.mimetype === "application/pdf" ||
                 file.originalname?.toLowerCase().endsWith(".pdf");
      if (!ok) return cb(new Error("Solo se admiten archivos PDF"));
      cb(null, true);
    },
  });

  // Parser principal del texto extraído del PDF EMASESA
  // v0.24.0 — Devuelve:
  //   Identificadores: numero_bateria_emasesa, bateria_numero (alias),
  //                    contadores_a_instalar, solicitud_q, suministro
  //   Localización:    ubicacion_bateria, direccion_emasesa, numero_edificio_rt
  //   Otros:           fecha_emasesa, causa_baja_suministro
  //   Tomas:           tomas[] (cada una con .revisada: false), caudal_total
  function parsearTextoEmasesa(texto) {
    const out = {
      // Identificadores oficiales EMASESA
      numero_bateria_emasesa: "",      // v0.24.0 — Nº batería oficial EMASESA (ej. "31973")
      bateria_numero: "",              // alias retrocompat — mismo valor que numero_bateria_emasesa
      contadores_a_instalar: "",       // v0.24.0 — campo distinto (puede venir vacío)
      solicitud_q: "",
      suministro: "",

      // Localización
      ubicacion_bateria: "",
      direccion_emasesa: "",
      numero_edificio_rt: "",          // v0.24.0 — número aislado de la dirección

      // Otros
      fecha_emasesa: "",
      causa_baja_suministro: "",       // v0.24.0 — "SI" / "NO" / ""

      // Tomas
      tomas: [],
      caudal_total: 0,
    };

    let m;
    const lineas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    // ──────────────────────────────────────────────────────────
    // v0.24.0 — Batería oficial EMASESA y "contadores a instalar"
    // En el texto crudo aparecen las 2 etiquetas pegadas seguidas de
    // el/los valor(es): "Batería:Contadores a instalar:\n31973".
    // El primer número es Batería; el segundo (si existe) es
    // "Contadores a instalar". En Generalife 13 sólo viene el primero.
    // ──────────────────────────────────────────────────────────
    m = texto.match(/Bater[íi]a:\s*Contadores a instalar:\s*\n([0-9]+)(?:\s*\n([0-9]+))?/);
    if (m) {
      out.numero_bateria_emasesa = (m[1] || "").trim();
      out.bateria_numero         = out.numero_bateria_emasesa;
      out.contadores_a_instalar  = (m[2] || "").trim();
    } else {
      // Fallback al patrón legacy (compatibilidad con PDFs anteriores)
      m = texto.match(/Contadores a instalar:\s*\n?\s*([0-9]+)/);
      if (m) {
        out.numero_bateria_emasesa = m[1].trim();
        out.bateria_numero         = out.numero_bateria_emasesa;
      }
    }

    // ──────────────────────────────────────────────────────────
    // Dirección + número edificio (v0.24.0)
    // ──────────────────────────────────────────────────────────
    m = texto.match(/(BARRIADA[^\n]+|CALLE[^\n]+|AVENIDA[^\n]+|PLAZA[^\n]+)/i);
    if (m) {
      out.direccion_emasesa = m[1].trim();
      const mNum = out.direccion_emasesa.match(/,\s*(\d+(?:\s*BIS|\s*DUP)?)/i);
      if (mNum) out.numero_edificio_rt = mNum[1].trim();
    }

    // Fecha emisión EMASESA ("24 de marzo de 2026")
    m = texto.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
    if (m) out.fecha_emasesa = m[1].trim();

    // ──────────────────────────────────────────────────────────
    // v0.24.0 — Ubicación batería (captura completa)
    // Busca la etiqueta "Ubicación batería:" y captura la siguiente
    // línea con letras (saltando líneas puramente numéricas como el
    // bloque pegado de solicitud+suministro). Así "ARMARIO EN PATIO
    // INTERIOR" queda completo, en vez de cortarse en "EN PATIO INTERIOR".
    // ──────────────────────────────────────────────────────────
    const idxEtiqUbic = lineas.findIndex(l => /Ubicaci[óo]n bater[íi]a/i.test(l));
    if (idxEtiqUbic >= 0) {
      for (let k = idxEtiqUbic + 1; k < lineas.length; k++) {
        const ln = lineas[k];
        if (/^\d+$/.test(ln)) continue;            // saltar líneas solo numéricas
        if (/^[A-ZÁÉÍÓÚÑ ]+$/.test(ln) && /[A-ZÁÉÍÓÚÑ]/.test(ln)) {
          out.ubicacion_bateria = ln.trim();
          break;
        }
      }
    }
    // Fallback al regex viejo si la etiqueta no apareció
    if (!out.ubicacion_bateria) {
      m = texto.match(/EN\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?)(?:\s*\n|$)/);
      if (m) out.ubicacion_bateria = ("EN " + m[1]).trim();
    }

    // v0.21.6 — Solicitud y Suministro
    // pdf-parse extrae los 2 números como UN SOLO bloque pegado (truncado).
    // Ej: "01004615701005589" = "0100461574" + "0100558913" (cortado)
    // Estrategia: detectar el bloque pegado "010\d{7,}" y dividirlo en 2.
    const bloqueNumeros = texto.match(/\b(010\d{7,})\b/);
    if (bloqueNumeros) {
      const todo = bloqueNumeros[1];
      if (todo.length >= 20) {
        // Hay 2 números completos de 10 dígitos
        out.solicitud_q = todo.substring(0, 10);
        out.suministro  = todo.substring(10, 20);
      } else if (todo.length >= 10) {
        // Solo el primero está completo, el segundo está truncado
        out.solicitud_q = todo.substring(0, 10);
        out.suministro  = todo.substring(10); // lo que haya
      }
    } else {
      // Fallback: buscar 10 dígitos sueltos
      const numeros10 = texto.match(/\b(\d{10})\b/g) || [];
      if (numeros10.length >= 1) out.solicitud_q = numeros10[0];
      if (numeros10.length >= 2) out.suministro  = numeros10[1];
    }

    // ──────────────────────────────────────────────────────────
    // v0.24.0 — Causa baja suministro (SI/NO según marca X)
    // En el texto: " Causa baja el suministro: Fecha desmontaje:\nSI\nNO\nX"
    // La X aparece después de la opción marcada.
    // ──────────────────────────────────────────────────────────
    const idxCausa = lineas.findIndex(l => /Causa baja el suministro/i.test(l));
    if (idxCausa >= 0) {
      const ventana = lineas.slice(idxCausa + 1, idxCausa + 8);
      for (let k = 0; k < ventana.length - 1; k++) {
        if ((/^SI$/i.test(ventana[k]) || /^NO$/i.test(ventana[k])) &&
            /^X$/i.test(ventana[k + 1])) {
          out.causa_baja_suministro = ventana[k].toUpperCase();
          break;
        }
      }
      // Si hay X pero no inmediatamente después de SI/NO, dejamos vacío
      // (mejor vacío que adivinar).
    }

    // v0.21.6 — TOMAS: parser línea por línea (no por chunks).
    // pdf-parse devuelve cada campo en su propia línea con formato:
    //   01-02
    //   Bajo
    //   B
    //   1,40
    //   BAREA RUIZ,FRANCISCO
    //   15
    // Estrategia: cuando encontremos una línea NN-NN, los siguientes
    // campos hasta la próxima NN-NN son los datos de esa toma.
    // v0.24.0: cada toma incorpora `revisada: false` por defecto
    // (preparado para columna SI/NO del CO 073, paso 4 del sprint).
    let i = 0;
    while (i < lineas.length) {
      if (!/^\d{2}-\d{2}$/.test(lineas[i])) { i++; continue; }

      const toma = { toma: lineas[i], piso: "", puerta: "", caudal: "", cliente: "", calibre: "", revisada: false };
      i++;

      // Recoger campos hasta la próxima NN-NN o fin
      const campos = [];
      while (i < lineas.length && !/^\d{2}-\d{2}$/.test(lineas[i])) {
        campos.push(lineas[i]);
        i++;
      }

      // Identificar caudal (X,XX) y calibre (0/15/20/25/30/40/50)
      let caudalIdx = -1, calibreIdx = -1;
      for (let j = 0; j < campos.length; j++) {
        if (/^\d+,\d{2}$/.test(campos[j])) { caudalIdx = j; break; }
      }
      if (caudalIdx >= 0) {
        for (let j = caudalIdx + 1; j < campos.length; j++) {
          if (/^(0|15|20|25|30|40|50)$/.test(campos[j])) { calibreIdx = j; break; }
        }
      }

      if (caudalIdx >= 0) toma.caudal = campos[caudalIdx];
      if (calibreIdx >= 0) toma.calibre = campos[calibreIdx];

      // Antes del caudal: piso y puerta
      const antesCaudal = campos.slice(0, caudalIdx);
      if (antesCaudal.length === 1) {
        toma.piso = antesCaudal[0];
      } else if (antesCaudal.length === 2) {
        toma.piso = antesCaudal[0];
        toma.puerta = antesCaudal[1];
      } else if (antesCaudal.length >= 3) {
        toma.piso = antesCaudal[0];
        toma.puerta = antesCaudal.slice(1).join(" ");
      }

      // Cliente: entre caudal y calibre (si hay algo)
      if (caudalIdx >= 0 && calibreIdx > caudalIdx + 1) {
        toma.cliente = campos.slice(caudalIdx + 1, calibreIdx).join(" ").trim();
      }

      out.tomas.push(toma);
      const caudalNum = parseFloat(String(toma.caudal).replace(",", "."));
      if (isFinite(caudalNum)) out.caudal_total += caudalNum;
    }

    out.caudal_total = Math.round(out.caudal_total * 100) / 100;
    return out;
  }

  // ────────────────────────────────────────────────────────────
  // TAB · emasesa_relacion_tomas
  // Una fila por comunidad. Datos generales + URL del PDF subido + JSON con tomas.
  // ────────────────────────────────────────────────────────────
  const EMASESA_RT_HEADERS = [
    "comunidad",
    "bateria_orden",      // v0.23.0 — clave compuesta. Vacío = 1 (legacy).
    "bateria_numero",
    "solicitud_q",
    "suministro",
    "ubicacion_bateria",
    "direccion_emasesa",
    "fecha_emasesa",
    "caudal_total",
    "num_tomas",
    "tomas_json",         // serializado para no abusar de columnas
    "url_pdf_emasesa",
    "filename_pdf",
    // v0.21.2 — Rótulo físico (foto procesada con IA Vision)
    "rotulo_celdas_json",   // ["BAJO","4ºB","1ºB","1ºA","X","X","C","3ºA","2ºA","2ºB","3ºB","4ºA"]
    "rotulo_num_filas",
    "rotulo_num_cols",
    "url_foto_rotulo",
    "filename_foto_rotulo",
    // v0.24.0 — Campos enriquecidos del parser
    "numero_bateria_emasesa",   // Nº batería oficial EMASESA (ej. "31973")
    "contadores_a_instalar",    // Campo distinto al anterior, puede venir vacío
    "numero_edificio_rt",       // Número aislado de la dirección (ej. "13")
    "causa_baja_suministro",    // "SI" / "NO" / ""
    "ultima_modificacion",
  ];

  async function asegurarPestanaEmasesaRT() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "emasesa_relacion_tomas"
      );
      const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);

      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "emasesa_relacion_tomas" } } }],
          },
        });
      }

      // v0.21.5 — Verificar/actualizar headers SIEMPRE (no solo al crear).
      // Esto soluciona el bug donde añadimos columnas nuevas en v0.21.2 pero
      // las tabs existentes mantenían los headers viejos, causando desplazamiento
      // de datos en las filas.
      const headersActuales = await leerHojaSafe(`emasesa_relacion_tomas!A1:${lastCol}1`);
      const filaActual = headersActuales[0] || [];
      const desactualizada = filaActual.length < EMASESA_RT_HEADERS.length ||
        EMASESA_RT_HEADERS.some((h, i) => filaActual[i] !== h);

      if (desactualizada) {
        console.log(`[fase14-cert] Actualizando headers de emasesa_relacion_tomas (eran ${filaActual.length}, ahora ${EMASESA_RT_HEADERS.length})`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `emasesa_relacion_tomas!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [EMASESA_RT_HEADERS] },
        });
      }
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaEmasesaRT:", err.message);
      return false;
    }
  }

  // Helper: match con clave compuesta para emasesa_relacion_tomas.
  // col 0 = comunidad, col 1 = bateria_orden (vacío = 1 por compatibilidad).
  function _filaEmasesaMatchea(row, comunidad, orden) {
    if (String(row[0] || "").trim() !== comunidad.trim()) return false;
    const ordenFila = normOrden(row[1] || "1");
    return ordenFila === normOrden(orden);
  }

  // v0.23.0 — Lectura por (comunidad, bateria_orden). Default orden=1.
  // Mantiene firma legacy: leerEmasesaRT(com) sigue funcionando.
  async function leerEmasesaRT(comunidad, orden = 1) {
    await asegurarPestanaEmasesaRT();
    const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
    for (const row of rows) {
      if (_filaEmasesaMatchea(row, comunidad, orden)) {
        const obj = {};
        for (let i = 0; i < EMASESA_RT_HEADERS.length; i++) {
          obj[EMASESA_RT_HEADERS[i]] = row[i] || "";
        }
        obj.bateria_orden = String(normOrden(obj.bateria_orden));
        // Parsear tomas JSON
        try { obj.tomas = JSON.parse(obj.tomas_json || "[]"); }
        catch { obj.tomas = []; }
        // v0.21.2 — Parsear rótulo si está disponible
        try { obj.rotulo_celdas = JSON.parse(obj.rotulo_celdas_json || "[]"); }
        catch { obj.rotulo_celdas = []; }
        return obj;
      }
    }
    return null;
  }

  // v0.23.0 — Devuelve todas las baterías EMASESA de una comunidad, ordenadas.
  async function leerEmasesaRT_todas(comunidad) {
    await asegurarPestanaEmasesaRT();
    const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
    const baterias = [];
    for (const row of rows) {
      if (String(row[0] || "").trim() !== comunidad.trim()) continue;
      const obj = {};
      for (let i = 0; i < EMASESA_RT_HEADERS.length; i++) {
        obj[EMASESA_RT_HEADERS[i]] = row[i] || "";
      }
      obj.bateria_orden = String(normOrden(obj.bateria_orden));
      try { obj.tomas = JSON.parse(obj.tomas_json || "[]"); }
      catch { obj.tomas = []; }
      try { obj.rotulo_celdas = JSON.parse(obj.rotulo_celdas_json || "[]"); }
      catch { obj.rotulo_celdas = []; }
      baterias.push(obj);
    }
    baterias.sort((a, b) => parseInt(a.bateria_orden, 10) - parseInt(b.bateria_orden, 10));
    return baterias;
  }

  async function escribirEmasesaRT(comunidad, ordenOrDatos, datosOpt) {
    let orden, datos;
    if (datosOpt === undefined) {
      // Firma legacy: (comunidad, datos)
      orden = 1;
      datos = ordenOrDatos || {};
    } else {
      orden = normOrden(ordenOrDatos);
      datos = datosOpt || {};
    }

    await asegurarPestanaEmasesaRT();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
    const ahora = new Date().toISOString();

    // Si ya existe registro para (comunidad, orden), hacer merge para no perder campos
    // del otro upload (PDF EMASESA vs foto rótulo).
    let existente = null;
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (_filaEmasesaMatchea(rows[i], comunidad, orden)) {
        rowIndex = i + 2;
        existente = {};
        for (let j = 0; j < EMASESA_RT_HEADERS.length; j++) {
          existente[EMASESA_RT_HEADERS[j]] = rows[i][j] || "";
        }
        break;
      }
    }

    const merge = (campo) => {
      if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== "") return datos[campo];
      return existente ? existente[campo] : "";
    };

    const fila = EMASESA_RT_HEADERS.map(h => {
      if (h === "comunidad") return comunidad.trim();
      if (h === "bateria_orden") return String(orden);
      if (h === "ultima_modificacion") return ahora;
      if (h === "tomas_json") {
        if (Array.isArray(datos.tomas)) return JSON.stringify(datos.tomas);
        return existente ? existente.tomas_json : "[]";
      }
      if (h === "num_tomas") {
        if (Array.isArray(datos.tomas)) return String(datos.tomas.filter(t => t.piso).length);
        return existente ? existente.num_tomas : "";
      }
      if (h === "rotulo_celdas_json") {
        if (Array.isArray(datos.rotulo_celdas)) return JSON.stringify(datos.rotulo_celdas);
        return existente ? existente.rotulo_celdas_json : "[]";
      }
      return String(merge(h) || "");
    });

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `emasesa_relacion_tomas!A${rowIndex}:${lastCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `emasesa_relacion_tomas!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });
    }
    return true;
  }

  // ============================================================
  // v0.26.0 — TABLAS DE ESTADO DE FASE 14
  //
  // Dos tablas separadas para distinta granularidad:
  //
  // 1) `ara_os_estado_documentos_bateria`: clave (comunidad, bateria_orden).
  //    Flags de subida de RT y foto rótulo. Una fila por batería.
  //
  // 2) `ara_os_estado_certificados`: clave comunidad. Flag de "certificados
  //    generados" (porque /generar-certificados es una acción única para
  //    toda la obra: crea 1 CO 080 + N CO 073 + N CO 051).
  //
  // Filosofía: los flags solo se LEVANTAN. Nunca se bajan automáticamente.
  // Si en el futuro hace falta resetear, se hace con un endpoint admin.
  //
  // No bloquean nada en fase 14. Son informativos para que la tarjeta
  // pueda mostrar el estado al operario (paso 7 del sprint).
  // ============================================================

  // ── Tabla 1 · documentos por batería ─────────────────────────
  const ESTADO_DOCS_HEADERS = [
    "comunidad",
    "bateria_orden",
    "rt_subida",
    "rt_fecha",
    "rt_ultima_fecha",
    "foto_rotulo_subida",
    "foto_rotulo_fecha",
    "foto_rotulo_ultima_fecha",
    "ultima_modificacion",
  ];

  let _pestanaEstadoDocsOK = null;
  async function asegurarPestanaEstadoDocs() {
    if (_pestanaEstadoDocsOK === true) return true;
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "ara_os_estado_documentos_bateria"
      );
      const lastCol = colLetterFromIdx(ESTADO_DOCS_HEADERS.length - 1);

      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "ara_os_estado_documentos_bateria" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `ara_os_estado_documentos_bateria!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [ESTADO_DOCS_HEADERS] },
        });
        console.log(`[fase14-cert] Tab ara_os_estado_documentos_bateria creada`);
      } else {
        // Verificar headers (por si añadimos columnas en versiones futuras)
        const headersActuales = await leerHojaSafe(`ara_os_estado_documentos_bateria!A1:${lastCol}1`);
        const filaActual = headersActuales[0] || [];
        const desactualizada = filaActual.length < ESTADO_DOCS_HEADERS.length ||
          ESTADO_DOCS_HEADERS.some((h, i) => filaActual[i] !== h);
        if (desactualizada) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: `ara_os_estado_documentos_bateria!A1:${lastCol}1`,
            valueInputOption: "RAW",
            requestBody: { values: [ESTADO_DOCS_HEADERS] },
          });
          console.log(`[fase14-cert] Headers de ara_os_estado_documentos_bateria actualizados`);
        }
      }
      _pestanaEstadoDocsOK = true;
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaEstadoDocs:", err.message);
      _pestanaEstadoDocsOK = null;
      return false;
    }
  }

  function _filaEstadoDocsMatchea(row, comunidad, orden) {
    if (String(row[0] || "").trim() !== comunidad.trim()) return false;
    const ordenFila = normOrden(row[1] || "1");
    return ordenFila === normOrden(orden);
  }

  // Lee el estado de documentos de una batería concreta.
  // Si no hay registro, devuelve un objeto con todos los flags en false/vacío.
  async function leerEstadoDocsBateria(comunidad, orden = 1) {
    await asegurarPestanaEstadoDocs();
    const lastCol = colLetterFromIdx(ESTADO_DOCS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`ara_os_estado_documentos_bateria!A2:${lastCol}`);
    for (const row of rows) {
      if (_filaEstadoDocsMatchea(row, comunidad, orden)) {
        const obj = {};
        for (let i = 0; i < ESTADO_DOCS_HEADERS.length; i++) {
          obj[ESTADO_DOCS_HEADERS[i]] = row[i] || "";
        }
        obj.bateria_orden = String(normOrden(obj.bateria_orden));
        // Normalizar booleanos
        obj.rt_subida = String(obj.rt_subida).toUpperCase() === "OK";
        obj.foto_rotulo_subida = String(obj.foto_rotulo_subida).toUpperCase() === "OK";
        return obj;
      }
    }
    // Sin registro: estado por defecto
    return {
      comunidad: comunidad.trim(),
      bateria_orden: String(normOrden(orden)),
      rt_subida: false,
      rt_fecha: "",
      rt_ultima_fecha: "",
      foto_rotulo_subida: false,
      foto_rotulo_fecha: "",
      foto_rotulo_ultima_fecha: "",
      ultima_modificacion: "",
    };
  }

  // Devuelve el estado de TODAS las baterías de una comunidad (las que tengan fila).
  async function leerEstadoDocs_todas(comunidad) {
    await asegurarPestanaEstadoDocs();
    const lastCol = colLetterFromIdx(ESTADO_DOCS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`ara_os_estado_documentos_bateria!A2:${lastCol}`);
    const out = [];
    for (const row of rows) {
      if (String(row[0] || "").trim() !== comunidad.trim()) continue;
      const obj = {};
      for (let i = 0; i < ESTADO_DOCS_HEADERS.length; i++) {
        obj[ESTADO_DOCS_HEADERS[i]] = row[i] || "";
      }
      obj.bateria_orden = String(normOrden(obj.bateria_orden));
      obj.rt_subida = String(obj.rt_subida).toUpperCase() === "OK";
      obj.foto_rotulo_subida = String(obj.foto_rotulo_subida).toUpperCase() === "OK";
      out.push(obj);
    }
    out.sort((a, b) => parseInt(a.bateria_orden, 10) - parseInt(b.bateria_orden, 10));
    return out;
  }

  // Marca un flag (interno). `flag` ∈ {"rt", "foto_rotulo"}.
  // Si la fila no existe, la crea. Si existe, levanta el flag y actualiza la
  // fecha "última". `rt_fecha` / `foto_rotulo_fecha` solo se rellena la primera vez.
  async function _levantarFlagDocs(comunidad, orden, flag) {
    if (flag !== "rt" && flag !== "foto_rotulo") throw new Error("flag inválido: " + flag);
    await asegurarPestanaEstadoDocs();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(ESTADO_DOCS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`ara_os_estado_documentos_bateria!A2:${lastCol}`);
    const ahora = new Date().toISOString();
    const o = normOrden(orden);

    let rowIndex = -1;
    let filaPrev = null;
    for (let i = 0; i < rows.length; i++) {
      if (_filaEstadoDocsMatchea(rows[i], comunidad, o)) {
        rowIndex = i + 2;
        filaPrev = rows[i];
        break;
      }
    }

    // Construir fila a escribir
    const obj = {
      comunidad: comunidad.trim(),
      bateria_orden: String(o),
      rt_subida: "",
      rt_fecha: "",
      rt_ultima_fecha: "",
      foto_rotulo_subida: "",
      foto_rotulo_fecha: "",
      foto_rotulo_ultima_fecha: "",
      ultima_modificacion: ahora,
    };
    if (filaPrev) {
      for (let i = 0; i < ESTADO_DOCS_HEADERS.length; i++) {
        obj[ESTADO_DOCS_HEADERS[i]] = filaPrev[i] || "";
      }
      obj.ultima_modificacion = ahora;
    }

    // Levantar el flag pedido
    if (flag === "rt") {
      obj.rt_subida = "OK";
      if (!obj.rt_fecha) obj.rt_fecha = ahora;
      obj.rt_ultima_fecha = ahora;
    } else if (flag === "foto_rotulo") {
      obj.foto_rotulo_subida = "OK";
      if (!obj.foto_rotulo_fecha) obj.foto_rotulo_fecha = ahora;
      obj.foto_rotulo_ultima_fecha = ahora;
    }

    const fila = ESTADO_DOCS_HEADERS.map(h => String(obj[h] || ""));

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_estado_documentos_bateria!A${rowIndex}:${lastCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_estado_documentos_bateria!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });
    }
    return true;
  }

  async function marcarRTSubida(comunidad, orden) {
    return _levantarFlagDocs(comunidad, orden, "rt");
  }
  async function marcarFotoRotuloSubida(comunidad, orden) {
    return _levantarFlagDocs(comunidad, orden, "foto_rotulo");
  }

  // ── Tabla 2 · certificados (por comunidad) ───────────────────
  const ESTADO_CERT_HEADERS = [
    "comunidad",
    "certificados_generados",
    "certificados_fecha",
    "certificados_ultima_fecha",
    "ultima_modificacion",
  ];

  let _pestanaEstadoCertOK = null;
  async function asegurarPestanaEstadoCert() {
    if (_pestanaEstadoCertOK === true) return true;
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "ara_os_estado_certificados"
      );
      const lastCol = colLetterFromIdx(ESTADO_CERT_HEADERS.length - 1);

      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "ara_os_estado_certificados" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `ara_os_estado_certificados!A1:${lastCol}1`,
          valueInputOption: "RAW",
          requestBody: { values: [ESTADO_CERT_HEADERS] },
        });
        console.log(`[fase14-cert] Tab ara_os_estado_certificados creada`);
      } else {
        const headersActuales = await leerHojaSafe(`ara_os_estado_certificados!A1:${lastCol}1`);
        const filaActual = headersActuales[0] || [];
        const desactualizada = filaActual.length < ESTADO_CERT_HEADERS.length ||
          ESTADO_CERT_HEADERS.some((h, i) => filaActual[i] !== h);
        if (desactualizada) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: `ara_os_estado_certificados!A1:${lastCol}1`,
            valueInputOption: "RAW",
            requestBody: { values: [ESTADO_CERT_HEADERS] },
          });
          console.log(`[fase14-cert] Headers de ara_os_estado_certificados actualizados`);
        }
      }
      _pestanaEstadoCertOK = true;
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaEstadoCert:", err.message);
      _pestanaEstadoCertOK = null;
      return false;
    }
  }

  async function leerEstadoCert(comunidad) {
    await asegurarPestanaEstadoCert();
    const lastCol = colLetterFromIdx(ESTADO_CERT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`ara_os_estado_certificados!A2:${lastCol}`);
    for (const row of rows) {
      if (String(row[0] || "").trim() === comunidad.trim()) {
        const obj = {};
        for (let i = 0; i < ESTADO_CERT_HEADERS.length; i++) {
          obj[ESTADO_CERT_HEADERS[i]] = row[i] || "";
        }
        obj.certificados_generados = String(obj.certificados_generados).toUpperCase() === "OK";
        return obj;
      }
    }
    return {
      comunidad: comunidad.trim(),
      certificados_generados: false,
      certificados_fecha: "",
      certificados_ultima_fecha: "",
      ultima_modificacion: "",
    };
  }

  async function marcarCertificadosGenerados(comunidad) {
    await asegurarPestanaEstadoCert();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(ESTADO_CERT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`ara_os_estado_certificados!A2:${lastCol}`);
    const ahora = new Date().toISOString();

    let rowIndex = -1;
    let filaPrev = null;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === comunidad.trim()) {
        rowIndex = i + 2;
        filaPrev = rows[i];
        break;
      }
    }

    const obj = {
      comunidad: comunidad.trim(),
      certificados_generados: "OK",
      certificados_fecha: "",
      certificados_ultima_fecha: ahora,
      ultima_modificacion: ahora,
    };
    if (filaPrev) {
      for (let i = 0; i < ESTADO_CERT_HEADERS.length; i++) {
        obj[ESTADO_CERT_HEADERS[i]] = filaPrev[i] || "";
      }
      obj.certificados_generados = "OK";
      obj.certificados_ultima_fecha = ahora;
      obj.ultima_modificacion = ahora;
    }
    if (!obj.certificados_fecha) obj.certificados_fecha = ahora;

    const fila = ESTADO_CERT_HEADERS.map(h => String(obj[h] || ""));

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_estado_certificados!A${rowIndex}:${lastCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `ara_os_estado_certificados!A:${lastCol}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [fila] },
      });
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  // POST /api/ara-os/fase14/subir-relacion-emasesa
  // form-data: ccpp_id, file
  // ────────────────────────────────────────────────────────────
  app.options("/api/ara-os/fase14/subir-relacion-emasesa", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/subir-relacion-emasesa",
    uploadEmasesa.single("file"),
    async (req, res) => {
      responderCORS(res);
      if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
      try {
        const { ccpp_id } = req.body;
        if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
        if (!req.file) return res.status(400).json({ error: "Falta archivo (campo 'file')" });

        // v0.23.0 — bateria_orden opcional (default 1)
        const orden = req.body.bateria_orden ? normOrden(req.body.bateria_orden) : 1;

        const com = await resolverComunidadPorCcpp(ccpp_id);
        if (!com) return res.status(404).json({ error: "Obra no encontrada" });

        // 1) Parsear el PDF
        let parsed;
        try {
          const data = await pdfParse(req.file.buffer);
          parsed = parsearTextoEmasesa(data.text || "");
        } catch (err) {
          return res.status(400).json({
            error: "No se pudo leer el PDF. Asegúrate de que es el archivo oficial de EMASESA en formato texto (no escaneado).",
            debug: err.message,
          });
        }

        if (!parsed.bateria_numero && parsed.tomas.length === 0) {
          return res.status(400).json({
            error: "El PDF subido no parece ser una Relación de Tomas de EMASESA. No se encontraron datos reconocibles.",
          });
        }

        // 2) Subir el PDF original a Drive (con sufijo _bN si N>1 esperado)
        const fechaISO = new Date().toISOString().slice(0, 10);
        const sufijo = orden > 1 ? `_b${orden}` : "";
        const filename = `Relacion_tomas_EMASESA${sufijo}_${fechaISO}.pdf`;
        const uploaded = await subirPdfADrive(req.file.buffer, filename, com.comunidad);

        // 3) Persistir en (comunidad, orden)
        await escribirEmasesaRT(com.comunidad, orden, {
          ...parsed,
          url_pdf_emasesa: uploaded.url,
          filename_pdf:    uploaded.filename,
        });

        // 4) v0.26.0 — Marcar flag rt_subida (no bloqueante: si falla, solo log)
        try {
          await marcarRTSubida(com.comunidad, orden);
        } catch (err) {
          console.warn(`[fase14-cert] No se pudo marcar rt_subida para ${com.comunidad} bat${orden}:`, err.message);
        }

        console.log(`[fase14-cert] PDF EMASESA parseado · batería ${orden} · ${parsed.tomas.length} tomas · bat#${parsed.numero_bateria_emasesa || '?'}`);
        res.json({
          ok: true,
          version: "0.26.0",
          comunidad: com.comunidad,
          bateria_orden: orden,
          datos: parsed,
          url_pdf_emasesa: uploaded.url,
          filename: uploaded.filename,
        });
      } catch (err) {
        console.error("[fase14/subir-relacion-emasesa]", err);
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ────────────────────────────────────────────────────────────
  // GET /api/ara-os/fase14/datos-emasesa-rt?ccpp_id=...&bateria_orden=N
  // Devuelve los datos extraídos previamente (o vacío)
  // ────────────────────────────────────────────────────────────
  app.options("/api/ara-os/fase14/datos-emasesa-rt", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/fase14/datos-emasesa-rt", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      // v0.23.0 — bateria_orden opcional (default 1)
      const orden = req.query.bateria_orden ? normOrden(req.query.bateria_orden) : 1;

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const datos = await leerEmasesaRT(com.comunidad, orden);
      res.json({
        ok: true,
        version: "0.24.0",
        comunidad: com.comunidad,
        bateria_orden: orden,
        tiene_pdf: !!datos,
        datos: datos || null,
      });
    } catch (err) {
      console.error("[fase14/datos-emasesa-rt]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // v0.26.0 — GET /api/ara-os/fase14/estado-pasos?ccpp_id=X
  // Devuelve el estado de los pasos documentales de fase 14:
  //   { baterias: [{bateria_orden, rt_subida, foto_rotulo_subida, ...}],
  //     certificados: {certificados_generados, certificados_fecha, ...},
  //     resumen: {algun_rt, todas_las_rt, alguna_foto, todas_las_fotos,
  //               certificados, total_baterias} }
  //
  // El "total_baterias" se calcula leyendo datos_tecnicos_bateria (las
  // baterías que existen oficialmente para esta comunidad), NO la tabla
  // de estado (que solo tiene filas para baterías ya tocadas).
  // ─────────────────────────────────────────────────────────────
  app.options("/api/ara-os/fase14/estado-pasos", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/fase14/estado-pasos", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      // Leer en paralelo
      const [estadoDocs, estadoCert, bateriasOficiales] = await Promise.all([
        leerEstadoDocs_todas(com.comunidad),
        leerEstadoCert(com.comunidad),
        leerBateriasDeComunidad(com.comunidad),
      ]);

      // Construir mapa orden → estado y combinar con baterías oficiales
      // (para que la respuesta incluya todas las baterías, aunque alguna
      // todavía no tenga fila en estado_documentos_bateria).
      const mapaEstado = new Map();
      for (const e of estadoDocs) {
        mapaEstado.set(parseInt(e.bateria_orden, 10), e);
      }
      const totalBaterias = bateriasOficiales.length || (estadoDocs.length || 1);

      const baterias = [];
      // Si hay baterías oficiales, iterar sobre ellas (orden conocido)
      const ordenesAIterar = bateriasOficiales.length > 0
        ? bateriasOficiales.map(b => parseInt(b.bateria_orden, 10))
        : estadoDocs.map(e => parseInt(e.bateria_orden, 10));

      for (const orden of ordenesAIterar) {
        const e = mapaEstado.get(orden) || {
          comunidad: com.comunidad,
          bateria_orden: String(orden),
          rt_subida: false,
          rt_fecha: "",
          rt_ultima_fecha: "",
          foto_rotulo_subida: false,
          foto_rotulo_fecha: "",
          foto_rotulo_ultima_fecha: "",
          ultima_modificacion: "",
        };
        baterias.push(e);
      }
      baterias.sort((a, b) => parseInt(a.bateria_orden, 10) - parseInt(b.bateria_orden, 10));

      // Resumen agregado para la tarjeta
      const algunRT     = baterias.some(b => b.rt_subida);
      const todasLasRT  = baterias.length > 0 && baterias.every(b => b.rt_subida);
      const algunaFoto  = baterias.some(b => b.foto_rotulo_subida);
      const todasFotos  = baterias.length > 0 && baterias.every(b => b.foto_rotulo_subida);

      res.json({
        ok: true,
        version: "0.26.0",
        comunidad: com.comunidad,
        baterias,
        certificados: estadoCert,
        resumen: {
          total_baterias: totalBaterias,
          algun_rt: algunRT,
          todas_las_rt: todasLasRT,
          alguna_foto: algunaFoto,
          todas_las_fotos: todasFotos,
          certificados: !!estadoCert.certificados_generados,
        },
      });
    } catch (err) {
      console.error("[fase14/estado-pasos]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // v0.21.4 — Endpoint TEMPORAL de debug · devuelve el raw de la sheet
  // para diagnosticar bugs de persistencia
  app.get("/api/ara-os/fase14/debug-emasesa-rt", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const { ccpp_id } = req.query;
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      await asegurarPestanaEmasesaRT();
      const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
      const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);

      const todasLasFilas = rows.map((r, i) => {
        const obj = { fila_indice: i + 2 };
        for (let j = 0; j < EMASESA_RT_HEADERS.length; j++) {
          const val = r[j] || "";
          // Truncar strings largos
          if (typeof val === "string" && val.length > 500) {
            obj[EMASESA_RT_HEADERS[j]] = val.substring(0, 500) + `...[TRUNCADO ${val.length} chars total]`;
          } else {
            obj[EMASESA_RT_HEADERS[j]] = val;
          }
        }
        return obj;
      });

      const filaCoincidente = todasLasFilas.find(f => f.comunidad === com.comunidad.trim());

      res.json({
        ok: true,
        version: "0.21.4-debug",
        buscando_comunidad: com.comunidad,
        total_filas: rows.length,
        comunidades_en_sheet: rows.map(r => r[0]),
        fila_coincidente: filaCoincidente || null,
        todas_las_filas: todasLasFilas,
      });
    } catch (err) {
      console.error("[fase14/debug-emasesa-rt]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // v0.21.2 — Subida de FOTO DEL RÓTULO FÍSICO + procesamiento IA Vision
  // El rótulo físico de la batería tiene las tomas en su orden REAL.
  // EMASESA inspecciona basándose en esa numeración física.
  // ============================================================

  const uploadRotulo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /^image\/(jpeg|jpg|png|webp|heic)$/i.test(file.mimetype) ||
                 /\.(jpe?g|png|webp|heic)$/i.test(file.originalname || "");
      if (!ok) return cb(new Error("Solo se admiten imágenes (JPG, PNG, WEBP, HEIC)"));
      cb(null, true);
    },
  });

  // Llama a GPT-4o-mini Vision para extraer celdas del rótulo
  async function procesarRotuloConIA(buffer, mimeType) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Falta OPENAI_API_KEY en el entorno");
    }
    const base64 = buffer.toString("base64");
    const mimeTipo = mimeType || "image/jpeg";

    const systemPrompt = `Eres un asistente que extrae datos de rótulos físicos de baterías de contadores de agua.
El rótulo es una tabla manuscrita o impresa con celdas que indican qué piso/puerta corresponde a cada toma física de la batería.

Devuelve SOLO un JSON con este formato exacto (sin texto adicional, sin markdown):
{
  "num_filas": <número de filas de la tabla>,
  "num_cols": <número de columnas de la tabla>,
  "celdas": [<array LINEAL de las celdas leídas de izquierda-a-derecha, arriba-a-abajo>]
}

Reglas para las celdas:
- Cada celda tendrá la señal del piso/puerta (ej: "BAJO", "1ºA", "1ºB", "2ºA", "C", "X", "COM")
- "X" significa toma libre/sin asignar
- "C" o "COM" significa toma de la comunidad
- "BAJO" puede ser un local en planta baja
- "1ºA" = primero A, "2ºB" = segundo B, etc.
- Devuelve EXACTAMENTE el texto del rótulo, conservando mayúsculas y el símbolo º cuando aparezca
- Si una celda está vacía o no se puede leer, usa ""
- El array celdas debe tener exactamente num_filas × num_cols elementos

Ejemplo: si el rótulo tiene 2 filas y 6 columnas con valores
  Fila 1: BAJO  4ºB  1ºB  1ºA  X  X
  Fila 2: C     3ºA  2ºA  2ºB  3ºB  4ºA

devuelves:
{"num_filas":2,"num_cols":6,"celdas":["BAJO","4ºB","1ºB","1ºA","X","X","C","3ºA","2ºA","2ºB","3ºB","4ºA"]}`;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
              { type: "text", text: "Extrae las celdas del rótulo de esta batería en JSON." },
              { type: "image_url", image_url: { url: `data:${mimeTipo};base64,${base64}` } },
            ]},
          ],
        },
        {
          timeout: 45000,
          headers: {
            Authorization: "Bearer " + process.env.OPENAI_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      const texto = response?.data?.choices?.[0]?.message?.content || "";
      const limpio = texto.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        const parsed = JSON.parse(limpio);
        // Validación básica
        if (!Array.isArray(parsed.celdas)) {
          throw new Error("Respuesta IA sin array 'celdas'");
        }
        return {
          num_filas: parseInt(parsed.num_filas) || 0,
          num_cols:  parseInt(parsed.num_cols)  || 0,
          celdas:    parsed.celdas.map(c => String(c || "").trim()),
        };
      } catch (err) {
        console.error("[fase14-cert/rotulo IA] JSON inválido:", texto);
        throw new Error("La IA devolvió un formato no esperado. Texto: " + texto.substring(0, 200));
      }
    } catch (err) {
      if (err.response) {
        console.error("[fase14-cert/rotulo IA] Error API:", err.response.status, err.response.data);
        throw new Error(`Error API OpenAI ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 200)}`);
      }
      throw err;
    }
  }

  app.options("/api/ara-os/fase14/subir-rotulo-bateria", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/fase14/subir-rotulo-bateria",
    uploadRotulo.single("file"),
    async (req, res) => {
      responderCORS(res);
      if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
      try {
        const { ccpp_id } = req.body;
        if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
        if (!req.file) return res.status(400).json({ error: "Falta archivo (campo 'file')" });

        // v0.23.0 — bateria_orden opcional (default 1)
        const orden = req.body.bateria_orden ? normOrden(req.body.bateria_orden) : 1;

        const com = await resolverComunidadPorCcpp(ccpp_id);
        if (!com) return res.status(404).json({ error: "Obra no encontrada" });

        // 1) Procesar con IA Vision
        console.log(`[fase14-cert/rotulo] Procesando foto rótulo para ${com.comunidad} · batería ${orden} (${req.file.size} bytes, ${req.file.mimetype})`);
        let rotulo;
        try {
          rotulo = await procesarRotuloConIA(req.file.buffer, req.file.mimetype);
        } catch (err) {
          return res.status(500).json({ error: "Error procesando con IA Vision: " + err.message });
        }

        // 2) Subir foto original a Drive
        const fechaISO = new Date().toISOString().slice(0, 10);
        const extension = (req.file.originalname || "").split(".").pop() || "jpg";
        const sufijo = orden > 1 ? `_b${orden}` : "";
        const filename = `Rotulo_bateria${sufijo}_${fechaISO}.${extension}`;

        // Buscar/crear subcarpeta
        const carpetaRaizId = process.env.DRIVE_FOLDER_FASE14_FIRMADAS;
        const drive = getDriveClient();
        const nombreSafe = com.comunidad.replace(/'/g, "\\'");
        const busq = await drive.files.list({
          q: `name='${nombreSafe}' and '${carpetaRaizId}' in parents and ` +
             `mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id,name)", pageSize: 1,
        });
        let subcarpetaId;
        if (busq.data.files && busq.data.files.length > 0) {
          subcarpetaId = busq.data.files[0].id;
        } else {
          const creada = await drive.files.create({
            requestBody: {
              name: com.comunidad,
              mimeType: "application/vnd.google-apps.folder",
              parents: [carpetaRaizId],
            },
            fields: "id",
          });
          subcarpetaId = creada.data.id;
        }
        const subido = await drive.files.create({
          requestBody: { name: filename, parents: [subcarpetaId] },
          media: { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) },
          fields: "id, name, webViewLink",
        });

        // 3) Persistir en (comunidad, orden)
        await escribirEmasesaRT(com.comunidad, orden, {
          rotulo_celdas:        rotulo.celdas,
          rotulo_num_filas:     rotulo.num_filas,
          rotulo_num_cols:      rotulo.num_cols,
          url_foto_rotulo:      subido.data.webViewLink,
          filename_foto_rotulo: subido.data.name,
        });

        // 4) v0.26.0 — Marcar flag foto_rotulo_subida (no bloqueante)
        try {
          await marcarFotoRotuloSubida(com.comunidad, orden);
        } catch (err) {
          console.warn(`[fase14-cert] No se pudo marcar foto_rotulo_subida para ${com.comunidad} bat${orden}:`, err.message);
        }

        console.log(`[fase14-cert/rotulo] OK · batería ${orden} · ${rotulo.celdas.length} celdas · ${rotulo.num_filas}x${rotulo.num_cols}`);
        res.json({
          ok: true,
          version: "0.26.0",
          comunidad: com.comunidad,
          bateria_orden: orden,
          rotulo,
          url_foto_rotulo: subido.data.webViewLink,
          filename: subido.data.name,
        });
      } catch (err) {
        console.error("[fase14/subir-rotulo-bateria]", err);
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ============================================================
  // v0.21.5 — Endpoint debug PARSER
  // Devuelve el TEXTO CRUDO que extrae pdf-parse del PDF EMASESA
  // sin guardarlo en ningún sitio. Solo para depurar regex.
  // ============================================================
  app.post("/api/ara-os/fase14/debug-parse-emasesa",
    uploadEmasesa.single("file"),
    async (req, res) => {
      responderCORS(res);
      if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
      try {
        if (!req.file) return res.status(400).json({ error: "Falta archivo (campo 'file')" });
        const data = await pdfParse(req.file.buffer);
        const texto = data.text || "";

        // Probar también los regex actuales con el texto extraído
        const parsed = parsearTextoEmasesa(texto);
        const numeros10 = texto.match(/\b(\d{10})\b/g) || [];

        res.json({
          ok: true,
          version: "0.21.5",
          texto_crudo: texto,
          longitud_texto: texto.length,
          lineas: texto.split("\n").map((l, i) => `${i + 1}: ${JSON.stringify(l)}`),
          numeros_10_digitos: numeros10,
          parser_resultado: {
            bateria_numero:    parsed.bateria_numero,
            solicitud_q:       parsed.solicitud_q,
            suministro:        parsed.suministro,
            ubicacion_bateria: parsed.ubicacion_bateria,
            direccion_emasesa: parsed.direccion_emasesa,
            fecha_emasesa:     parsed.fecha_emasesa,
            caudal_total:      parsed.caudal_total,
            num_tomas:         parsed.tomas.length,
            tomas:             parsed.tomas,
          },
        });
      } catch (err) {
        console.error("[fase14/debug-parse-emasesa]", err);
        res.status(500).json({ error: err.message });
      }
    }
  );

};
