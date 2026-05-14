// ============================================================
// ARA OS — Fase 14 · Generación de certificados EMASESA
// v0.20.0 — Sprint 14/05/2026
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
    const rowsCom = await leerHoja("comunidades!A2:BF");
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
  // ~135 columnas: bloques generales + 33 tomas (señal/destino/caudal)
  // ============================================================
  const TECNICOS_HEADERS = [
    "comunidad",
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
    // Tomas: hasta 33 tomas × 3 campos = 99 columnas
    // Patrón: toma_F_C_senal | toma_F_C_destino | toma_F_C_caudal
    // F: 1..3 (fila), C: 1..11 (columna)
    ...buildTomasHeaders(),
    // Caudal total instalado (suma)
    "caudal_total_instalado",
    "ultima_modificacion",
  ];

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

  async function asegurarPestanaTecnicos() {
    try {
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      });
      const existe = (meta.data.sheets || []).some(s =>
        s.properties && s.properties.title === "datos_tecnicos_bateria"
      );
      if (existe) return true;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "datos_tecnicos_bateria" } } }],
        },
      });
      // Convertir índice a notación A1
      const colLetter = (n) => {
        let s = "";
        n = n + 1;
        while (n > 0) {
          const m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };
      const lastCol = colLetter(TECNICOS_HEADERS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `datos_tecnicos_bateria!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [TECNICOS_HEADERS] },
      });
      console.log(`[fase14-cert] Tab datos_tecnicos_bateria creada (${TECNICOS_HEADERS.length} columnas)`);
      return true;
    } catch (err) {
      console.warn("[fase14-cert] asegurarPestanaTecnicos:", err.message);
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

  async function leerDatosTecnicos(comunidad) {
    await asegurarPestanaTecnicos();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);
    for (const row of rows) {
      if (String(row[0] || "").trim() === comunidad.trim()) {
        const obj = {};
        for (let i = 0; i < TECNICOS_HEADERS.length; i++) {
          obj[TECNICOS_HEADERS[i]] = row[i] || "";
        }
        return obj;
      }
    }
    // Devolver objeto vacío si no hay registro
    const vacio = {};
    for (const h of TECNICOS_HEADERS) vacio[h] = "";
    return vacio;
  }

  async function escribirDatosTecnicos(comunidad, datos) {
    await asegurarPestanaTecnicos();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(TECNICOS_HEADERS.length - 1);
    const rows = await leerHojaSafe(`datos_tecnicos_bateria!A2:${lastCol}`);
    const ahora = new Date().toISOString();

    const fila = TECNICOS_HEADERS.map(h => {
      if (h === "comunidad") return comunidad.trim();
      if (h === "ultima_modificacion") return ahora;
      return String(datos[h] || "");
    });

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
  function pintarTexto(page, font, texto, x, y, size = 10) {
    if (!texto) return;
    try {
      page.drawText(String(texto), {
        x, y, size, font,
        color: rgb(0, 0, 0),
      });
    } catch (err) {
      console.warn(`[fase14-cert] pintarTexto error en "${texto}":`, err.message);
    }
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

    return await pdfDoc.save();
  }

  // ============================================================
  // CO 073 · PDF plano · OVERLAY
  // No tiene form fields. Pintamos texto encima.
  // Coordenadas: las del CO 073 oficial (página 1)
  // ============================================================
  async function generarCO073(com, titular, tecnicos) {
    const pdfDoc = await cargarPdfBase("CO_073_V01.pdf");
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];

    const nombreLegal = (() => {
      const nom = String(com.comunidad || "").trim();
      if (/^COMUNIDAD DE PROPIETARIOS/i.test(nom)) return nom.toUpperCase();
      return ("COMUNIDAD DE PROPIETARIOS " + nom).toUpperCase();
    })();

    // NOTA: como no tengo la forma exacta del CO 073 oficial procesada,
    // dejamos como overlay genérico al pie del PDF. JM puede revisar/ajustar.
    // Esto es un STUB seguro — si EMASESA exige campos en posiciones exactas,
    // se ajustan las coordenadas en siguiente iteración.
    const hoy = new Date();
    const fechaStr = `${String(hoy.getDate()).padStart(2,"0")}/${String(hoy.getMonth()+1).padStart(2,"0")}/${hoy.getFullYear()}`;

    // Pintamos un sello de identificación al pie de página
    pintarTexto(page, helv, "Generado por ARA OS · " + fechaStr, 50, 30, 8);
    pintarTexto(page, helv, "Titular: " + nombreLegal, 50, 50, 9);
    pintarTexto(page, helv, "Dirección: " + (com.direccion || ""), 50, 65, 9);

    return await pdfDoc.save();
  }

  // ============================================================
  // RELACIÓN DE TOMAS · PDF plano · OVERLAY
  // Pintamos: dirección, batería, alimentación, y la tabla de tomas
  // ============================================================
  async function generarRelacionTomas(com, titular, tecnicos) {
    const pdfDoc = await cargarPdfBase("Relacion_de_tomas.pdf");
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPages()[0];

    const nombreLegal = (() => {
      const nom = String(com.comunidad || "").trim();
      if (/^COMUNIDAD DE PROPIETARIOS/i.test(nom)) return nom.toUpperCase();
      return ("COMUNIDAD DE PROPIETARIOS " + nom).toUpperCase();
    })();

    // Cabecera: dirección y datos generales
    // Coordenadas aproximadas - JM puede revisar visualmente y ajustamos si hace falta.
    pintarTexto(page, helv, com.direccion || "", 100, 705, 9);
    pintarTexto(page, helv, tecnicos.numero_edificio || "", 685, 705, 9);
    pintarTexto(page, helv, "Sevilla", 105, 685, 9);
    pintarTexto(page, helv, titular.cp || "", 240, 685, 9);
    pintarTexto(page, helv, nombreLegal, 350, 685, 9);

    // Tubo alimentación
    pintarTexto(page, helv, tecnicos.tubo_material || "", 80, 645, 9);
    pintarTexto(page, helv, tecnicos.tubo_diametro || "", 195, 645, 9);
    pintarTexto(page, helv, tecnicos.tubo_llave_general_situacion || "", 350, 645, 9);
    pintarTexto(page, helv, tecnicos.tubo_trazado || "", 580, 645, 9);

    // Batería
    pintarTexto(page, helv, tecnicos.bateria_marca || "", 75, 605, 9);
    pintarTexto(page, helv, tecnicos.num_baterias || "", 240, 605, 9);
    const numTomas = String((parseInt(tecnicos.bateria_num_filas || 0) * parseInt(tecnicos.bateria_num_columnas || 0)) || "");
    pintarTexto(page, helv, numTomas, 360, 605, 9);
    pintarTexto(page, helv, tecnicos.bateria_emplazamiento || "", 480, 605, 9);

    // Tabla de tomas: 3 filas × 11 columnas
    // Pintamos señal, destino y caudal en cada celda
    // Coordenadas base aproximadas — la tabla está en mitad de la página
    const TABLA_Y_INICIO = 510;          // y de la primera fila
    const TABLA_ALTO_FILA = 60;          // alto de cada fila (señal + destino + caudal)
    const TABLA_X_INICIO = 100;          // x de la primera columna
    const TABLA_ANCHO_COL = 60;          // ancho de cada columna
    const OFFSET_SENAL = 15;
    const OFFSET_DESTINO = 30;
    const OFFSET_CAUDAL = 45;

    let caudalTotal = 0;
    for (let f = 1; f <= 3; f++) {
      for (let c = 1; c <= 11; c++) {
        const senal   = tecnicos[`toma_${f}_${c}_senal`] || "";
        const destino = tecnicos[`toma_${f}_${c}_destino`] || "";
        const caudal  = tecnicos[`toma_${f}_${c}_caudal`] || "";

        if (!senal && !destino && !caudal) continue;

        const x = TABLA_X_INICIO + (c - 1) * TABLA_ANCHO_COL;
        const yBase = TABLA_Y_INICIO - (f - 1) * TABLA_ALTO_FILA;

        pintarTexto(page, helv, senal,   x + 2, yBase - OFFSET_SENAL, 7);
        pintarTexto(page, helv, destino, x + 2, yBase - OFFSET_DESTINO, 7);
        pintarTexto(page, helv, caudal,  x + 2, yBase - OFFSET_CAUDAL, 7);

        const n = parseFloat(String(caudal).replace(",", "."));
        if (isFinite(n)) caudalTotal += n;
      }
    }

    // Caudal total instalado
    if (caudalTotal > 0) {
      pintarTexto(page, helvBold, caudalTotal.toFixed(2).replace(".", ",") + " L/SEG", 460, 280, 10);
    }

    // Firma instalador
    const instalador = getInstaladorAutorizado();
    const hoy = new Date();
    const fechaStr = `${String(hoy.getDate()).padStart(2,"0")}/${String(hoy.getMonth()+1).padStart(2,"0")}/${hoy.getFullYear()}`;
    pintarTexto(page, helv, "Sevilla, " + fechaStr, 150, 235, 9);
    pintarTexto(page, helv, instalador.nombre, 150, 175, 9);

    return await pdfDoc.save();
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
      const tecnicos = await leerDatosTecnicos(com.comunidad);

      res.json({
        ok: true,
        version: "0.20.0",
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
        tecnicos_data: tecnicos,
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
      const { ccpp_id, datos } = req.body || {};
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!datos || typeof datos !== "object") {
        return res.status(400).json({ error: "Falta payload `datos`" });
      }

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      // Filtrar solo campos válidos (los que están en TECNICOS_HEADERS)
      const validKeys = new Set(TECNICOS_HEADERS);
      const datosFiltrados = {};
      for (const k of Object.keys(datos)) {
        if (validKeys.has(k)) datosFiltrados[k] = datos[k];
      }

      await escribirDatosTecnicos(com.comunidad, datosFiltrados);
      res.json({ ok: true, version: "0.20.0", comunidad: com.comunidad });
    } catch (err) {
      console.error("[fase14/guardar-datos-tecnicos]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/ara-os/fase14/generar-certificados
  // Genera los 3 PDFs, los sube a Drive (subcarpeta de la comunidad),
  // y devuelve las URLs.
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

      // Cargar datos relacionados
      const titular = await leerDatosTitular(com.comunidad);
      const tecnicos = await leerDatosTecnicos(com.comunidad);

      // Adjuntar CIF de comunidad desde ordenes_trabajo (columna AC=28)
      const rowsOT = await leerHojaSafe("ordenes_trabajo!A2:AK");
      for (const row of rowsOT) {
        if (String(row[0] || "").trim() === com.comunidad.trim()) {
          com.cif_comunidad_runtime = row[28] || "";
          break;
        }
      }

      // Generar los 3 PDFs
      console.log(`[fase14-cert] Generando certificados para "${com.comunidad}"...`);
      const fechaSlug = new Date().toISOString().slice(0, 10);

      const pdf080 = await generarCO080(com, titular, tecnicos);
      const pdf073 = await generarCO073(com, titular, tecnicos);
      const pdfRel = await generarRelacionTomas(com, titular, tecnicos);

      // Subir a Drive
      const r080 = await subirPdfADrive(pdf080, `CO_080_${fechaSlug}.pdf`, com.comunidad);
      const r073 = await subirPdfADrive(pdf073, `CO_073_${fechaSlug}.pdf`, com.comunidad);
      const rRel = await subirPdfADrive(pdfRel, `Relacion_tomas_${fechaSlug}.pdf`, com.comunidad);

      console.log(`[fase14-cert] OK: ${r080.filename}, ${r073.filename}, ${rRel.filename}`);

      res.json({
        ok: true,
        version: "0.20.0",
        comunidad: com.comunidad,
        certificados: {
          co_080: r080,
          co_073: r073,
          relacion_tomas: rRel,
        },
      });
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

};
