// ===================================================================
// MÓDULO DOCUMENTACIÓN — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Documentación (CCPP) al index.cjs.
// Toma el relevo cuando un CCPP termina la fase 04_SEGUIMIENTO de
// presupuestos y se acepta. A partir de 05_DOCUMENTACION en adelante
// (06_VISITA_EMASESA, 07_CONTRATOS_PAGOS) este módulo es el que manda.
//
// IMPORTANTE — pantalla principal:
//  - La pantalla principal de TODA la app es /presupuestos. No hay
//    /documentacion (listado): ese listado vive en /presupuestos con
//    sus filtros 05/06/07.
//  - Documentación SÓLO ofrece la ficha individual:
//        GET /documentacion/expediente?id=...
//  - La ficha reusa `vistaFicha` de presupuestos.cjs (vía app.locals)
//    y le añade la cajita de vecinos al final. Cuando el CCPP está en
//    fase 05/06/07, vistaFicha deja la barra de acciones vacía
//    (pendiente de definir qué irá ahí).
//
// Lee/escribe en las pestañas:
//  - "comunidades"    (mismo Sheet que presupuestos)
//  - "vecinos_base"   (listado maestro de vecinos por dirección)
//  - "expedientes"    (cabecera del expediente WhatsApp por vecino,
//                      hoy gestionada por index.cjs en escritura;
//                      este módulo solo LEE de momento)
//
// Uso desde index.cjs:
//   require("./documentacion.cjs")(app);
//   (debe registrarse DESPUÉS de presupuestos.cjs, porque depende de
//    app.locals.presupuestos)
//
// Variables de entorno: las mismas que presupuestos.cjs.
// ===================================================================

const { google } = require("googleapis");

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN
  // =================================================================
  function getGoogleAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }

  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const RANGO_VECINOS_BASE = "vecinos_base!A:F";
  const RANGO_EXPEDIENTES = "expedientes!A:Y";

  // =================================================================
  // HELPERS LOCALES
  // =================================================================
  function fmtTlf(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }

  // Etiquetas legibles para los códigos de documento que index.cjs
  // escribe en la pestaña "expedientes" (col `documento_actual`).
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
  function labelDoc(c) { return DOC_LABELS[c] || c || "—"; }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base + expedientes (lectura)
  // =================================================================
  async function leerVecinosBase() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_VECINOS_BASE,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        // La col A se ha venido usando como "comunidad" (clave corta).
        // Documentación pasa a usarla como `direccion` para los nuevos
        // vecinos. Compatibilidad: el match prueba con ambas claves.
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
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_EXPEDIENTES,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        telefono: r[0] || "", comunidad: r[1] || "", vivienda: r[2] || "", nombre: r[3] || "",
        tipo_expediente: r[4] || "", paso_actual: r[5] || "", documento_actual: r[6] || "",
        estado_expediente: r[7] || "", fecha_inicio: r[8] || "", fecha_primer_contacto: r[9] || "",
        fecha_ultimo_contacto: r[10] || "", fecha_limite_documentacion: r[11] || "",
        fecha_limite_firma: r[12] || "", documentos_completos: r[13] || "",
        alerta_plazo: r[14] || "", documentos_recibidos: r[15] || "",
        documentos_pendientes: r[16] || "", documentos_opcionales_pendientes: r[17] || "",
      });
    }
    return out;
  }

  // Empareja por dirección o por clave de comunidad. Prueba ambas para
  // máxima compatibilidad con datos antiguos creados por index.cjs.
  function emparejar(items, comu, campoComu) {
    if (!items || !comu) return [];
    const norm = s => String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const claves = [norm(comu.direccion), norm(comu.comunidad)].filter(Boolean);
    if (claves.length === 0) return [];
    return items.filter(v => {
      const vc = norm(v[campoComu]);
      if (!vc) return false;
      return claves.some(k => k === vc || k.includes(vc) || vc.includes(k));
    });
  }

  // =================================================================
  // BADGE Y CAJITA DE VECINOS
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

  function cajitaVecinosHtml(comu, vecinosBase, expedientes, token, esc) {
    const vBase = emparejar(vecinosBase, comu, "direccion");
    const vExp = emparejar(expedientes, comu, "comunidad");

    // Indexar expedientes por teléfono normalizado para cruce rápido.
    const normTlf = s => String(s || "").replace(/\D/g, "").replace(/^34/, "");
    const expByTlf = {};
    vExp.forEach(e => { const k = normTlf(e.telefono); if (k) expByTlf[k] = e; });

    // Construir lista unificada: vecinos_base + estado real del bot.
    const filas = [];
    vBase.forEach(vb => {
      const exp = expByTlf[normTlf(vb.telefono)] || null;
      filas.push({
        telefono: vb.telefono,
        nombre: vb.nombre || (exp && exp.nombre) || "—",
        vivienda: vb.vivienda || (exp && exp.vivienda) || "—",
        estado: exp ? exp.estado_expediente : "sin_contacto",
        documento_actual: exp ? exp.documento_actual : "",
        documentos_pendientes: exp ? exp.documentos_pendientes : "",
        tieneExpediente: !!exp,
      });
    });
    // Vecinos con expediente pero NO en vecinos_base (huérfanos: el bot
    // los creó antes de subir el listado).
    vExp.forEach(e => {
      const k = normTlf(e.telefono);
      if (!vBase.some(vb => normTlf(vb.telefono) === k)) {
        filas.push({
          telefono: e.telefono,
          nombre: e.nombre || "—",
          vivienda: e.vivienda || "—",
          estado: e.estado_expediente,
          documento_actual: e.documento_actual,
          documentos_pendientes: e.documentos_pendientes,
          tieneExpediente: true,
          huerfano: true,
        });
      }
    });

    if (filas.length === 0) {
      return `
        <div class="ptl-card" style="margin-top:8px">
          <div class="ptl-card-title">Vecinos · Documentación</div>
          <div style="padding:12px;font-size:13px;color:var(--ptl-gray-500);text-align:center">
            Sin vecinos asociados todavía. Sube el listado piso/nombre/teléfono para empezar.
          </div>
        </div>
      `;
    }

    const total = filas.length;
    const completos = filas.filter(f => f.estado === "documentacion_base_completa").length;
    const sinContacto = filas.filter(f => f.estado === "sin_contacto").length;

    const tk = token ? `&token=${encodeURIComponent(token)}` : "";
    const filasHtml = filas.map(f => {
      const docActual = f.documento_actual ? labelDoc(f.documento_actual) : "—";
      const pendientes = (f.documentos_pendientes || "").split(",").filter(Boolean).length;
      const tlf = fmtTlf(f.telefono);
      const url = f.tieneExpediente ? `/vecino?t=${encodeURIComponent(f.telefono)}${tk}` : "";
      const onClick = url ? `onclick="window.location='${url}'"` : "";
      const cursor = url ? "" : `style="cursor:default"`;
      const huerfano = f.huerfano ? `<span class="ptl-badge ptl-badge-amarillo" style="margin-left:4px" title="Existe en expedientes pero no en el listado vecinos_base">⚠</span>` : "";
      return `<tr ${onClick} ${cursor}>
        <td><strong>${esc(f.vivienda)}</strong>${huerfano}</td>
        <td>${esc(f.nombre)}</td>
        <td class="ptl-num-cell">${esc(tlf)}</td>
        <td>${badgeEstadoVecino(f.estado, esc)}</td>
        <td>${esc(docActual)}</td>
        <td class="ptl-num-cell">${pendientes} doc.</td>
      </tr>`;
    }).join("");

    const incompletos = total - completos;
    const pillResumen = incompletos === 0
      ? `<span class="ptl-stat-pill ptl-stat-verde">✓ Completo</span>`
      : `<span class="ptl-stat-pill ptl-stat-naranja">⚠ ${incompletos} pendiente${incompletos === 1 ? '' : 's'}</span>`;
    const pillSinContacto = sinContacto > 0
      ? `<span class="ptl-stat-pill ptl-stat-gris" style="margin-left:4px">${sinContacto} sin contacto</span>`
      : "";

    return `
      <div class="ptl-card" style="margin-top:8px">
        <div class="ptl-card-title-row">
          <div class="ptl-card-title" style="margin-bottom:0">Vecinos · Documentación (${total})</div>
          <div class="ptl-vecinos-stats">
            ${pillResumen}${pillSinContacto}
          </div>
        </div>
        <div style="overflow-x:auto;border-radius:6px;border:1px solid var(--ptl-gray-100)">
          <table class="ptl-tabla-vecinos">
            <thead><tr><th>Vivienda</th><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Doc. actual</th><th>Pendientes</th></tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =================================================================
  // RUTAS — solo ficha individual
  // =================================================================
  app.get("/documentacion/expediente", async (req, res) => {
    // Acceso a los helpers de presupuestos (registrados en app.locals).
    const P = app.locals.presupuestos;
    if (!P) {
      return res.status(500).send(
        "Error: el módulo presupuestos no está cargado. " +
        "Asegúrate de que en index.cjs se haga require('./presupuestos.cjs')(app) " +
        "ANTES de require('./documentacion.cjs')(app)."
      );
    }

    const token = req.query.token || "";
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(403).send("No autorizado");
    }

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

      // Cargar vecinos para la cajita.
      let vecinosBase = [];
      let expedientes = [];
      try { vecinosBase = await leerVecinosBase(); }
      catch (e) { console.warn("[documentacion] no se pudo leer vecinos_base:", e.message); }
      try { expedientes = await leerExpedientes(); }
      catch (e) { console.warn("[documentacion] no se pudo leer expedientes:", e.message); }

      const cajita = cajitaVecinosHtml(comu, vecinosBase, expedientes, token, P.esc);

      // ---------------------------------------------------------------
      // SOLICITUD DE LISTADO DE VECINOS (fase 05_DOCUMENTACION)
      // ---------------------------------------------------------------
      // Inyectamos un bloque JS que:
      //  1) Define window.ptlDoc.abrirModalEnvioListado() como wrapper de
      //     window.ptlAbrirModalMail (función global ya cargada por la
      //     ficha de presupuestos, que reusamos aquí).
      //  2) Si la URL trae ?abrirEnvio=1, abre el modal automáticamente
      //     al cargar (caso "acabo de aceptar el presupuesto, hay que
      //     pedir el listado al administrador").
      //
      // El botón "■ Reenviar solicitud de listado" de la barra de acción
      // (definido en presupuestos.cjs) llama también a esta función.
      const fase05 = String(comu.fase_presupuesto || "") === "05_DOCUMENTACION";
      const abrirEnvio = String(req.query.abrirEnvio || "") === "1";
      const ccppIdJs = JSON.stringify(String(comu.ccpp_id || ""));
      const bloqueEnvio = fase05 ? `
        <script>
        (function () {
          window.ptlDoc = window.ptlDoc || {};
          window.ptlDoc.abrirModalEnvioListado = function () {
            if (typeof window.ptlAbrirModalMail !== 'function') {
              alert('No se ha podido abrir el modal de envío.');
              return;
            }
            window.ptlAbrirModalMail('05_DOCUMENTACION', ${ccppIdJs});
          };
          ${abrirEnvio ? `
          // Auto-apertura tras aceptar presupuesto: damos un pequeño delay
          // para asegurar que ptlAbrirModalMail ya está definido por la
          // ficha de presupuestos.
          window.addEventListener('load', function () {
            setTimeout(function () {
              if (typeof window.ptlAbrirModalMail === 'function') {
                window.ptlAbrirModalMail('05_DOCUMENTACION', ${ccppIdJs});
              }
            }, 200);
          });
          ` : ``}
        })();
        </script>` : ``;

      const extraFinal = cajita + bloqueEnvio;

      const datalists = P.construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";

      // El breadcrumb apunta a /presupuestos (pantalla principal única).
      P.sendHtml(res, P.pageHtml(titulo,
        [{ label: "Presupuestos", url: P.urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        P.vistaFicha(comu, datalists, token, reciencreado, { extraHtmlFinal: extraFinal }),
        token));
    } catch (e) {
      console.error("[documentacion] /documentacion/expediente:", e.message);
      const P2 = app.locals.presupuestos;
      if (P2) P2.sendError(res, "Error: " + e.message);
      else res.status(500).send("Error: " + e.message);
    }
  });

  console.log("[documentacion] Módulo cargado. Rutas: /documentacion/expediente");

};
