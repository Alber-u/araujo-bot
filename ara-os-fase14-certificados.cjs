// ============================================================
// ARA OS — Fase 14 · Generación de certificados EMASESA
// v0.20.0 — Sprint 14/05/2026
// v0.22.0 — Sprint 15/05/2026 · migración a templates AcroForm (cero coordenadas)
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
    s("instalador_nif",    EMPRESA_INSTALADORA.nif_instalador);
    s("instalador_nombre", EMPRESA_INSTALADORA.nombre_instalador);

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
    let caudalTotal = 0;
    const celdas   = rotuloBateria?.celdas   || [];
    const numFilas = rotuloBateria?.numFilas || 3;
    const numCols  = rotuloBateria?.numCols  || 11;
    for (let f = 1; f <= 3; f++) {
      for (let c = 1; c <= 11; c++) {
        if (f > numFilas || c > numCols) continue;
        const idx = (f - 1) * numCols + (c - 1);
        const celda = celdas[idx];
        if (!celda) continue;
        const celdaNorm = String(celda).toUpperCase().replace(/\s+/g, "");
        const tomaMatch = tomasEm.find(t => {
          const senalT = ((t.piso || "") + (t.puerta ? " " + t.puerta : "")).toUpperCase().replace(/\s+/g, "");
          return senalT === celdaNorm;
        });
        s(`tabla_${f}_${c}_senal`, celda);
        if (tomaMatch) {
          s(`tabla_${f}_${c}_destino`, tomaMatch.destino || (celdaNorm === "X" ? "X" : "V"));
          if (tomaMatch.caudal !== null && tomaMatch.caudal !== undefined && tomaMatch.caudal !== "") {
            const cd = Number(String(tomaMatch.caudal).replace(",", "."));
            if (!isNaN(cd)) caudalTotal += cd;
            s(`tabla_${f}_${c}_caudal`, tomaMatch.caudal);
          }
        } else {
          s(`tabla_${f}_${c}_destino`, celdaNorm === "X" ? "X" : "V");
        }
      }
    }
    const ctFinal = emasesaRT?.caudal_total || (caudalTotal > 0 ? caudalTotal.toFixed(2).replace(".", ",") : "");
    s("caudal_total", ctFinal);

    // ─── Pie: compromiso instalador ───
    s("instalador_nombre_compromiso", EMPRESA_INSTALADORA.nombre_instalador);
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
      // v0.21.0 — Datos extraídos del PDF EMASESA (si están)
      const emasesaRT = await leerEmasesaRT(com.comunidad);

      // v0.21.4 — DEBUG: log detallado del estado de emasesaRT
      console.log(`[fase14-cert/generar] === DEBUG emasesaRT para "${com.comunidad}" ===`);
      if (emasesaRT) {
        console.log(`[fase14-cert/generar]   - bateria_numero: ${emasesaRT.bateria_numero || "VACÍO"}`);
        console.log(`[fase14-cert/generar]   - tomas count:    ${Array.isArray(emasesaRT.tomas) ? emasesaRT.tomas.length : "NO ARRAY"}`);
        console.log(`[fase14-cert/generar]   - tomas_json len: ${(emasesaRT.tomas_json || "").length} chars`);
        console.log(`[fase14-cert/generar]   - rotulo_celdas count: ${Array.isArray(emasesaRT.rotulo_celdas) ? emasesaRT.rotulo_celdas.length : 0}`);
        if (Array.isArray(emasesaRT.tomas) && emasesaRT.tomas.length > 0) {
          console.log(`[fase14-cert/generar]   - primera toma: ${JSON.stringify(emasesaRT.tomas[0])}`);
        }
      } else {
        console.log(`[fase14-cert/generar]   - emasesaRT es NULL → no hay registro guardado`);
      }

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
      const pdf073 = await generarCO073(com, titular, tecnicos, emasesaRT);
      const pdfRel = await generarRelacionTomas(com, titular, tecnicos, emasesaRT, {
        celdas:    emasesaRT?.rotulo_celdas || [],
        numFilas:  parseInt(emasesaRT?.rotulo_num_filas || 0),
        numCols:   parseInt(emasesaRT?.rotulo_num_cols  || 0),
      });

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
  // Devuelve { bateria_numero, suministro, solicitud_q, ubicacion_bateria,
  //            direccion_emasesa, fecha_emasesa, tomas[], caudal_total }
  function parsearTextoEmasesa(texto) {
    const out = {
      bateria_numero: "",
      solicitud_q: "",
      suministro: "",
      ubicacion_bateria: "",
      direccion_emasesa: "",
      fecha_emasesa: "",
      tomas: [],
      caudal_total: 0,
    };

    // Batería nº (entre "Contadores a instalar:" y "Pasado para")
    let m = texto.match(/Contadores a instalar:\s*\n?\s*([0-9]+)/);
    if (m) out.bateria_numero = m[1].trim();

    // Dirección (línea que empieza por algo + ", N, COM" o similar)
    m = texto.match(/(BARRIADA[^\n]+|CALLE[^\n]+|AVENIDA[^\n]+|PLAZA[^\n]+)/i);
    if (m) out.direccion_emasesa = m[1].trim();

    // Fecha emisión EMASESA ("24 de marzo de 2026")
    m = texto.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
    if (m) out.fecha_emasesa = m[1].trim();

    // Ubicación batería ("EN ENTRESUELO", "EN SOTANO", etc.)
    m = texto.match(/EN\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?)(?:\s*\n|$)/);
    if (m) out.ubicacion_bateria = ("EN " + m[1]).trim();

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
    const lineas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    let i = 0;
    while (i < lineas.length) {
      if (!/^\d{2}-\d{2}$/.test(lineas[i])) { i++; continue; }

      const toma = { toma: lineas[i], piso: "", puerta: "", caudal: "", cliente: "", calibre: "" };
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

  async function leerEmasesaRT(comunidad) {
    await asegurarPestanaEmasesaRT();
    const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
    for (const row of rows) {
      if (String(row[0] || "").trim() === comunidad.trim()) {
        const obj = {};
        for (let i = 0; i < EMASESA_RT_HEADERS.length; i++) {
          obj[EMASESA_RT_HEADERS[i]] = row[i] || "";
        }
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

  async function escribirEmasesaRT(comunidad, datos) {
    await asegurarPestanaEmasesaRT();
    const sheets = getSheetsClient();
    const lastCol = colLetterFromIdx(EMASESA_RT_HEADERS.length - 1);
    const rows = await leerHojaSafe(`emasesa_relacion_tomas!A2:${lastCol}`);
    const ahora = new Date().toISOString();

    // v0.21.2 — Si ya existe registro, hacer merge para no perder campos
    // del otro upload (PDF EMASESA vs foto rótulo).
    let existente = null;
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === comunidad.trim()) {
        rowIndex = i + 2;
        existente = {};
        for (let j = 0; j < EMASESA_RT_HEADERS.length; j++) {
          existente[EMASESA_RT_HEADERS[j]] = rows[i][j] || "";
        }
        break;
      }
    }

    const merge = (campo) => {
      // Si datos lo trae, lo preferimos. Si no, mantenemos el existente.
      if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== "") return datos[campo];
      return existente ? existente[campo] : "";
    };

    const fila = EMASESA_RT_HEADERS.map(h => {
      if (h === "comunidad") return comunidad.trim();
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

        // 2) Subir el PDF original a Drive
        const fechaISO = new Date().toISOString().slice(0, 10);
        const filename = `Relacion_tomas_EMASESA_${fechaISO}.pdf`;
        const uploaded = await subirPdfADrive(req.file.buffer, filename, com.comunidad);

        // 3) Persistir
        await escribirEmasesaRT(com.comunidad, {
          ...parsed,
          url_pdf_emasesa: uploaded.url,
          filename_pdf:    uploaded.filename,
        });

        console.log(`[fase14-cert] PDF EMASESA parseado · ${parsed.tomas.length} tomas · batería ${parsed.bateria_numero}`);
        res.json({
          ok: true,
          version: "0.21.0",
          comunidad: com.comunidad,
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
  // GET /api/ara-os/fase14/datos-emasesa-rt?ccpp_id=...
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

      const com = await resolverComunidadPorCcpp(ccpp_id);
      if (!com) return res.status(404).json({ error: "Obra no encontrada" });

      const datos = await leerEmasesaRT(com.comunidad);
      res.json({
        ok: true,
        version: "0.21.0",
        comunidad: com.comunidad,
        tiene_pdf: !!datos,
        datos: datos || null,
      });
    } catch (err) {
      console.error("[fase14/datos-emasesa-rt]", err);
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

        const com = await resolverComunidadPorCcpp(ccpp_id);
        if (!com) return res.status(404).json({ error: "Obra no encontrada" });

        // 1) Procesar con IA Vision
        console.log(`[fase14-cert/rotulo] Procesando foto rótulo para ${com.comunidad} (${req.file.size} bytes, ${req.file.mimetype})`);
        let rotulo;
        try {
          rotulo = await procesarRotuloConIA(req.file.buffer, req.file.mimetype);
        } catch (err) {
          return res.status(500).json({ error: "Error procesando con IA Vision: " + err.message });
        }

        // 2) Subir foto original a Drive
        const fechaISO = new Date().toISOString().slice(0, 10);
        const extension = (req.file.originalname || "").split(".").pop() || "jpg";
        const filename = `Rotulo_bateria_${fechaISO}.${extension}`;

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

        // 3) Persistir
        await escribirEmasesaRT(com.comunidad, {
          rotulo_celdas:        rotulo.celdas,
          rotulo_num_filas:     rotulo.num_filas,
          rotulo_num_cols:      rotulo.num_cols,
          url_foto_rotulo:      subido.data.webViewLink,
          filename_foto_rotulo: subido.data.name,
        });

        console.log(`[fase14-cert/rotulo] OK · ${rotulo.celdas.length} celdas · ${rotulo.num_filas}x${rotulo.num_cols}`);
        res.json({
          ok: true,
          version: "0.21.2",
          comunidad: com.comunidad,
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
