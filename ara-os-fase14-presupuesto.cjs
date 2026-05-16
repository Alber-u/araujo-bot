// ============================================================
// ARA OS — Fase 14 · Parser de Presupuesto .xlsm
// v0.2.0 — 16/05/2026
//   · Extracción del DESGLOSE de la instalación (lo PROPUESTO).
//     Antes leía la sección de "Toma de datos" que es lo ACTUAL.
//     Ahora extrae material+diámetro de los items presupuestados:
//       - Tubo conexión (PE) 63
//       - Tubo alimentación (PE) 75
//       - Batería contadores (PPR) 18T-3F
//       - Tubo distribución (PERT) 25 → montante
//   · Lógica EMASESA: el "tubo de alimentación" del certificado
//     es el TUBO ALIMENTACION del Excel si existe, fallback al
//     TUBO CONEXION (cuando la batería está pegada a la llave).
//
// v0.1.0 — 16/05/2026
//   · Lectura inicial de "Toma de datos" para auto-rellenar Holded
//     (Nº presupuesto, suministro, totales) y CP titular EMASESA.
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
  // Localizar inicio del DESGLOSE DE LA INSTALACION (cabecera "concepto")
  // ----------------------------------------------------------------
  function localizarDesglose(matriz) {
    for (let f = 0; f < matriz.length; f++) {
      if (norm((matriz[f] || [])[0]).includes("desglose de la instalacion")) return f + 1;
    }
    return -1;
  }

  // ----------------------------------------------------------------
  // Extraer datos del desglose presupuestado (lo NUEVO que se instala).
  //
  // Reglas:
  //  · Las secciones son cabeceras en mayúsculas en columna A
  //    (TUBO DE CONEXION, TUBO DE ALIMENTACION, CUARTO DE CONTADORES,
  //    MONTANTES). Pueden tener sufijos como "(ENTERRADO)".
  //  · Dentro de cada sección, el primer item con material entre
  //    paréntesis (PE, PERT, PPR, COBRE…) y cantidad > 0 es el bueno.
  //  · Columna B = "tipo" (= diámetro en mm o nomenclatura batería)
  //  · Columna C = cantidad (longitud, unidades…)
  //
  // Devuelve por sección:
  //   { tubo_conexion: {material, diametro, cantidad, ...},
  //     tubo_alimentacion: {...},
  //     bateria_1: {...},
  //     montante: {...} }
  //
  // Si una sección no tiene item válido, ese key no aparece.
  // ----------------------------------------------------------------
  function extraerDesglose(matriz) {
    const inicio = localizarDesglose(matriz);
    if (inicio < 0) return {};

    const out = {};
    let seccion = null;
    const SECCIONES = {
      "tubo de conexion":               "tubo_conexion",
      "tubo de alimentacion":           "tubo_alimentacion",
      "tubo de alimentacion enterrado": "tubo_alimentacion",
      "tubo de alimentacion piezeria":  "tubo_alimentacion",  // por si lo llaman así
      "cuarto de contadores":           "bateria_1",
      "montantes":                      "montante",
    };

    for (let f = inicio; f < Math.min(inicio + 300, matriz.length); f++) {
      const row = matriz[f] || [];
      const a = String(row[0] || "").trim();
      if (!a) continue;

      // ¿Es cabecera de sección?
      const an = norm(a);
      let nuevaSec = null;
      for (const [k, v] of Object.entries(SECCIONES)) {
        if (an === k || an.startsWith(k)) { nuevaSec = v; break; }
      }
      if (nuevaSec) { seccion = nuevaSec; continue; }
      if (!seccion) continue;
      if (out[seccion]) continue;   // ya tenemos primera línea válida

      // ¿Es item con material entre paréntesis?
      const m = a.match(/\(([A-Za-zÀ-ÿ\-_ ]+)\)/);
      if (!m) continue;
      const material = m[1].trim().toUpperCase();
      const diametro = row[1] || "";
      const cantidad = row[2] || "";
      const cantNum = parseFloat(cantidad);
      if (!cantidad || isNaN(cantNum) || cantNum <= 0) continue;

      out[seccion] = {
        nombre_item: a,
        material:    material,
        diametro:    String(diametro).trim(),
        cantidad:    cantNum,
        fila:        f + 1,
      };
    }

    return out;
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

    // v0.2.0 — Extraer DESGLOSE de la instalación (lo PROPUESTO)
    const desglose = extraerDesglose(matriz);
    if (desglose.tubo_conexion)     encontrados.push("desglose_tubo_conexion");
    if (desglose.tubo_alimentacion) encontrados.push("desglose_tubo_alimentacion");
    if (desglose.bateria_1)         encontrados.push("desglose_bateria_1");
    if (desglose.montante)          encontrados.push("desglose_montante");

    // Lógica EMASESA: el tubo del certificado es el TUBO ALIMENTACION
    // si existe (batería lejos), si no el TUBO CONEXION (batería pegada).
    // Origen: "alimentacion" o "conexion" — útil para debug y UI.
    const tuboEmasesa = desglose.tubo_alimentacion || desglose.tubo_conexion || null;
    const tuboOrigen  = desglose.tubo_alimentacion ? "alimentacion"
                      : desglose.tubo_conexion     ? "conexion"
                      : null;

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

      // === DATOS ACTUALES (lo que había antes — INFORMATIVO) ===
      tubo_conexion_material_actual:  String(tubo_conexion_material || "").trim(),
      tubo_conexion_diametro_actual:  tubo_conexion_diametro ? Number(tubo_conexion_diametro) : null,
      montante_material_actual:       String(montante_material || "").trim(),

      // === DATOS PROPUESTOS (lo que se instala — PARA CERTIFICADO) ===
      // v0.2.0 — del desglose presupuestado
      tubo_conexion_material_propuesto:     desglose.tubo_conexion ? desglose.tubo_conexion.material : "",
      tubo_conexion_diametro_propuesto:     desglose.tubo_conexion ? (parseFloat(desglose.tubo_conexion.diametro) || desglose.tubo_conexion.diametro) : null,
      tubo_alimentacion_material_propuesto: desglose.tubo_alimentacion ? desglose.tubo_alimentacion.material : "",
      tubo_alimentacion_diametro_propuesto: desglose.tubo_alimentacion ? (parseFloat(desglose.tubo_alimentacion.diametro) || desglose.tubo_alimentacion.diametro) : null,
      tubo_alimentacion_longitud_propuesto: desglose.tubo_alimentacion ? desglose.tubo_alimentacion.cantidad : null,
      montante_material_propuesto:          desglose.montante ? desglose.montante.material : "",
      montante_diametro_propuesto:          desglose.montante ? (parseFloat(desglose.montante.diametro) || desglose.montante.diametro) : null,
      bateria_material_propuesto:           desglose.bateria_1 ? desglose.bateria_1.material : "",

      // === CAMPOS QUE EL FRONTEND DEBE USAR DIRECTAMENTE ===
      // El campo "Tubo de alimentación" del certificado EMASESA:
      //  - si hay tubo alimentación (batería lejos) → ese
      //  - si no, fallback al tubo conexión (batería pegada)
      tubo_emasesa_material:        tuboEmasesa ? tuboEmasesa.material : "",
      tubo_emasesa_diametro:        tuboEmasesa ? (parseFloat(tuboEmasesa.diametro) || tuboEmasesa.diametro) : null,
      tubo_emasesa_origen:          tuboOrigen, // "alimentacion" | "conexion" | null

      // Otros campos directos (mantengo compatibilidad con v0.1.0)
      tubo_alimentacion_longitud:  tubo_alimentacion_long ? Number(tubo_alimentacion_long) : null,
      tubo_alimentacion_montaje:   String(tubo_alimentacion_montaje || "").trim(),
      n_codos_termofusion:         n_codos ? Number(n_codos) : null,
      n_llaves_corte:              n_llaves ? Number(n_llaves) : null,
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
      desglose,    // v0.2.0 — incluir para debug
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
        return res.json({ ok: true, version: "0.2.0", found: false, motivo: "Comunidad sin carpeta Drive" });
      }

      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) {
        return res.json({ ok: true, version: "0.2.0", found: false, motivo: "Falta DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES en Render" });
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
          ok: true, version: "0.2.0", found: false,
          motivo: `Carpeta '${carpetaNombre}' no encontrada en Drive`,
        });
      }
      const carpetaId = busq.data.files[0].id;

      // 3) Buscar el .xlsm/.xlsx
      const archivo = await buscarExcelPresupuesto(drive, carpetaId);
      if (!archivo) {
        return res.json({
          ok: true, version: "0.2.0", found: false,
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
          ok: true, version: "0.2.0", found: false,
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
        version: "0.2.0",
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
