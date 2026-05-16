// ============================================================
// ARA OS — Fase 14 · Parser de Presupuesto .xlsm
// v0.1.0 — 16/05/2026
//
// Lee el Excel del presupuesto (hoja "Toma de datos") desde Drive
// y extrae los datos que sirven para auto-rellenar:
//   · Modal Facturar Holded
//   · Modal Certificados EMASESA (CO 080 / CO 073 / Relación de Tomas)
//
// Endpoint:
//   GET /api/ara-os/panel-obras/fase14/datos-presupuesto?ccpp_id=XXX
//
// Estrategia:
//   · Busca el .xlsm más reciente en la subcarpeta "Presupuestos/"
//     de la carpeta Drive de la comunidad (o en raíz si no existe).
//   · Lee la hoja "Toma de datos".
//   · Extrae campos por ETIQUETA en columna A (fuzzy match),
//     NO por celda fija. Más robusto frente a plantillas
//     ligeramente distintas.
//   · Si un campo no se encuentra, queda vacío.
//   · Devuelve también `meta.encontrados` y `meta.faltantes`
//     para diagnóstico.
//
// Operación de SOLO LECTURA — nunca crea ni modifica archivos.
//
// require("./ara-os-fase14-presupuesto.cjs")(app);
// ============================================================

module.exports = function setupAraOSFase14Presupuesto(app) {
  const { google } = require("googleapis");
  const crypto = require("crypto");
  const XLSX = require("xlsx");

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "araujo2026";

  function tokenValido(req) {
    return req.query.token === ADMIN_TOKEN;
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

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
    catch (err) {
      console.warn("[fase14/presupuesto] leerHoja " + rango + ":", err.message);
      return [];
    }
  }

  // ------------------------------------------------------------
  // ccppId — réplica del de panel-obras (zona Guille). NO escribimos.
  // ------------------------------------------------------------
  function ccppId(direccion) {
    const slug = String(direccion || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // ------------------------------------------------------------
  // Modelo comunidades — solo los campos que necesitamos
  // ------------------------------------------------------------
  function obraDesdeRow(row) {
    return {
      comunidad:  row[0]  || "",
      direccion:  row[1]  || "",
      presidente: row[2]  || "",
      tipo_via:   row[10] || "",  // K
    };
  }

  // ----------------------------------------------------------------
  // Normalizar texto para fuzzy match
  // ----------------------------------------------------------------
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[()]/g, "")
      .trim();
  }

  // ----------------------------------------------------------------
  // Buscar valor por etiqueta dentro de la matriz [[fila], ...]
  // ----------------------------------------------------------------
  function buscarPorEtiqueta(matriz, etiqueta, opts = {}) {
    const offsetMin = opts.offsetMin || 1;
    const offsetMax = opts.offsetMax || 1;
    const filaInicio = opts.filaInicio || 0;
    const filaFin = opts.filaFin || matriz.length;
    const colEtiqueta = opts.colEtiqueta || 0;
    const etqN = norm(etiqueta);

    for (let f = filaInicio; f < filaFin; f++) {
      const row = matriz[f] || [];
      const lblCell = row[colEtiqueta];
      if (!lblCell) continue;
      const lblN = norm(lblCell);
      if (lblN.includes(etqN)) {
        for (let c = offsetMin; c <= offsetMax; c++) {
          const v = row[c];
          if (v !== null && v !== undefined && String(v).trim() !== "") {
            return { valor: v, fila: f, col: c };
          }
        }
        return { valor: null, fila: f, col: null };
      }
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Extraer datos del Excel parseado
  // ----------------------------------------------------------------
  function extraerDatos(matriz) {
    const encontrados = [];
    const faltantes = [];

    function get(etiqueta, opts) {
      const r = buscarPorEtiqueta(matriz, etiqueta, opts);
      if (r && r.valor !== null) {
        encontrados.push(etiqueta);
        return r.valor;
      }
      faltantes.push(etiqueta);
      return "";
    }

    // Header (fila 1)
    const filaHeader = (matriz[0] || []);
    const nPresupuesto = filaHeader[1] || "";
    const nSuministro  = filaHeader[3] || "";

    if (nPresupuesto) encontrados.push("n_presupuesto"); else faltantes.push("n_presupuesto");
    if (nSuministro)  encontrados.push("n_suministro");  else faltantes.push("n_suministro");

    // Dirección (fila 2)
    const filaDir = (matriz[1] || []);
    const dirCalle = filaDir[1] || "";
    const dirNum   = filaDir[3] || "";
    const dirCity  = filaDir[4] || "";
    const dirCP    = filaDir[5] || "";

    if (dirCalle) encontrados.push("direccion");
    if (dirCP)    encontrados.push("cp");

    // Presidente (fila 4)
    const filaPresi = (matriz[3] || []);
    const presiNombre = filaPresi[1] || "";
    const presiEmail  = filaPresi[3] || "";
    const presiTlf    = filaPresi[5] || "";

    if (presiNombre) encontrados.push("presidente_nombre");

    // Tipo edificio (fila 5)
    const filaEdif = (matriz[4] || []);
    const nSuministros = filaEdif[4] || "";

    // Datos técnicos (búsqueda por etiqueta)
    const tubo_conexion_material   = get("tubo conexion");
    const tubo_conexion_diametro   = get("diametro actual");
    const tubo_conexion_longitud   = get("longitud propuesta", { filaInicio: 25, filaFin: 29 });
    const tubo_alimentacion_long   = get("tubo alimentacion");
    const tubo_alimentacion_montaje = get("montaje propuesto");
    const n_codos                  = get("codos termofusion");
    const n_llaves                 = get("llaves de corte general");
    const montante_material        = get("montante abastecimiento");
    const cuarto_ubicacion         = get("cuarto contadores");
    const cuarto_tipo              = get("tipo de cuarto");
    const bateria_1                = get("tipo de bateria 1");
    const bateria_2                = get("tipo de bateria 2");
    const grupo_presion_tiene      = get("grupo de presion");
    const grupo_se_instala         = get("se instala");
    const grupo_ubicacion          = get("ubicacion", { filaInicio: 38, filaFin: 42 });
    const grupo_tubo_alim_long     = get("longitud tubo alimentacion");
    const aljibe                   = get("aljibe");

    // Totales (filas 33-50, columnas D/E/F).
    // Búsqueda con `exacto`: la etiqueta debe ser igual (no contener).
    // Esto evita que "total presupuesto" matchee también con
    // "total presupuesto con iva".
    // Tomamos el ÚLTIMO match: la hoja muestra primero el total
    // tradicional y después el de Plan 5, que es el real.
    function buscarTotal(etiqueta, modo = "exacto") {
      const etqN = norm(etiqueta);
      let ultimo = null;
      for (let f = 33; f < 50 && f < matriz.length; f++) {
        const row = matriz[f] || [];
        for (let c = 3; c <= 5; c++) {
          if (!row[c]) continue;
          const cellN = norm(row[c]);
          const match = modo === "exacto" ? (cellN === etqN) : cellN.includes(etqN);
          if (match) {
            const v1 = row[c + 1];
            if (v1 !== null && v1 !== undefined && String(v1).trim() !== "" && !isNaN(parseFloat(v1))) {
              ultimo = parseFloat(v1);
            }
          }
        }
      }
      return ultimo;
    }
    const total_presupuesto    = buscarTotal("total presupuesto");
    const total_con_iva        = buscarTotal("total presupuesto con iva");
    const subvencion_emasesa   = buscarTotal("subvencion emasesa");
    const total_con_subvencion = buscarTotal("total con subvencion");

    if (total_presupuesto)  encontrados.push("total_presupuesto"); else faltantes.push("total_presupuesto");
    if (total_con_iva)      encontrados.push("total_con_iva");
    if (subvencion_emasesa) encontrados.push("subvencion_emasesa");

    // Bloque Holded
    const holded = {
      n_presupuesto:      String(nPresupuesto || "").trim(),
      n_suministro:       String(nSuministro || "").trim(),
      presidente_nombre:  String(presiNombre || "").trim(),
      presidente_email:   String(presiEmail || "").trim(),
      presidente_tlf:     String(presiTlf || "").trim(),
      importe_total:      total_presupuesto || null,
      importe_con_iva:    total_con_iva || null,
      subvencion_emasesa: subvencion_emasesa || null,
      direccion_completa: [dirCalle, dirNum, dirCity, dirCP].filter(Boolean).join(", "),
    };

    // Bloque Certificados EMASESA
    const emasesa = {
      cp_titular:                  String(dirCP || "").trim(),
      cp_emplazamiento:            String(dirCP || "").trim(),
      direccion_calle:             String(dirCalle || "").trim(),
      direccion_numero:            String(dirNum || "").trim(),
      ciudad:                      String(dirCity || "").trim(),
      n_suministros:               nSuministros ? Number(nSuministros) : null,
      tubo_conexion_material:      String(tubo_conexion_material || "").trim(),
      tubo_conexion_diametro:      tubo_conexion_diametro ? Number(tubo_conexion_diametro) : null,
      tubo_conexion_longitud:      tubo_conexion_longitud ? Number(tubo_conexion_longitud) : null,
      tubo_alimentacion_longitud:  tubo_alimentacion_long ? Number(tubo_alimentacion_long) : null,
      tubo_alimentacion_montaje:   String(tubo_alimentacion_montaje || "").trim(),
      n_codos_termofusion:         n_codos ? Number(n_codos) : null,
      n_llaves_corte:              n_llaves ? Number(n_llaves) : null,
      montante_material:           String(montante_material || "").trim(),
      cuarto_contadores_ubicacion: String(cuarto_ubicacion || "").trim(),
      cuarto_contadores_tipo:      String(cuarto_tipo || "").trim(),
      bateria_1:                   String(bateria_1 || "").trim(),
      bateria_2:                   String(bateria_2 || "").trim(),
      grupo_presion_tiene:         String(grupo_presion_tiene || "").trim(),
      grupo_presion_se_instala:    String(grupo_se_instala || "").trim(),
      grupo_presion_ubicacion:     String(grupo_ubicacion || "").trim(),
      grupo_presion_tubo_long:     grupo_tubo_alim_long ? Number(grupo_tubo_alim_long) : null,
      aljibe:                      String(aljibe || "").trim(),
    };

    return {
      holded,
      emasesa,
      meta: {
        encontrados: encontrados.length,
        faltantes:   faltantes.length,
        lista_faltantes: faltantes,
      },
    };
  }

  // ----------------------------------------------------------------
  // Buscar el .xlsm más reciente
  // ----------------------------------------------------------------
  async function buscarExcelPresupuesto(drive, carpetaId) {
    const sub = await drive.files.list({
      q: `'${carpetaId}' in parents and mimeType='application/vnd.google-apps.folder' and name='Presupuestos' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });

    let carpetaBuscar = carpetaId;
    if (sub.data.files && sub.data.files.length > 0) {
      carpetaBuscar = sub.data.files[0].id;
    }

    const files = await drive.files.list({
      q: `'${carpetaBuscar}' in parents and trashed=false and (name contains '.xlsm' or name contains '.xlsx')`,
      fields: "files(id,name,mimeType,size,modifiedTime)",
      pageSize: 20,
      orderBy: "modifiedTime desc",
    });

    if (!files.data.files || files.data.files.length === 0) return null;

    const items = files.data.files;
    const prefer = items.find(f => /presupuesto|rev-?\d+/i.test(f.name));
    return prefer || items[0];
  }

  async function descargarArchivo(drive, fileId) {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  }

  // ----------------------------------------------------------------
  // ENDPOINT
  // ----------------------------------------------------------------
  const ENDPOINT = "/api/ara-os/panel-obras/fase14/datos-presupuesto";

  app.options(ENDPOINT, (req, res) => {
    responderCORS(res);
    res.status(204).end();
  });

  app.get(ENDPOINT, async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const ccpp_id = String(req.query.ccpp_id || req.query.id || "").trim();
    if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });

    try {
      // 1) Resolver comunidad (zona Guille — SOLO LECTURA)
      const rowsCom = await leerHojaSafe("comunidades!A2:BD");
      let obra = null;
      for (const row of rowsCom) {
        if (!row[0]) continue;
        const o = obraDesdeRow(row);
        const clave = o.direccion || o.comunidad || "";
        if (clave && ccppId(clave) === ccpp_id) { obra = o; break; }
      }
      if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

      const carpetaNombre = `${obra.tipo_via || ""} ${obra.direccion || ""}`.trim();
      if (!carpetaNombre) {
        return res.json({ ok: true, version: "0.1.0", found: false, motivo: "Comunidad sin carpeta Drive" });
      }

      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) {
        return res.json({ ok: true, version: "0.1.0", found: false, motivo: "Falta DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES en Render" });
      }

      // 2) Buscar carpeta de la comunidad
      const drive = getDriveClient();
      const nombreSafe = carpetaNombre.replace(/'/g, "\\'");
      const busq = await drive.files.list({
        q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1,
      });
      if (!busq.data.files || busq.data.files.length === 0) {
        return res.json({
          ok: true, version: "0.1.0", found: false,
          motivo: `Carpeta '${carpetaNombre}' no encontrada en Drive`,
        });
      }
      const carpetaId = busq.data.files[0].id;

      // 3) Buscar el .xlsm/.xlsx
      const archivo = await buscarExcelPresupuesto(drive, carpetaId);
      if (!archivo) {
        return res.json({
          ok: true, version: "0.1.0", found: false,
          motivo: "No hay .xlsm/.xlsx en la carpeta de la comunidad",
          carpeta_id: carpetaId,
        });
      }

      // 4) Descargar y parsear
      const buf = await descargarArchivo(drive, archivo.id);
      const wb = XLSX.read(buf, { type: "buffer" });

      const nombreHoja = "Toma de datos";
      if (!wb.SheetNames.includes(nombreHoja)) {
        return res.json({
          ok: true, version: "0.1.0", found: false,
          motivo: `El Excel no tiene la hoja '${nombreHoja}'`,
          archivo_nombre: archivo.name,
          archivo_id: archivo.id,
          hojas_disponibles: wb.SheetNames,
        });
      }
      const ws = wb.Sheets[nombreHoja];
      const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // 5) Extraer datos
      const datos = extraerDatos(matriz);

      return res.json({
        ok: true,
        version: "0.1.0",
        found: true,
        archivo: {
          id:         archivo.id,
          nombre:     archivo.name,
          modificado: archivo.modifiedTime,
        },
        ...datos,
      });
    } catch (err) {
      console.error("[fase14/datos-presupuesto]", err.message);
      return res.status(500).json({ error: err.message });
    }
  });
};
