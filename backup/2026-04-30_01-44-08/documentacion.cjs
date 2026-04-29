// ===================================================================
// MÓDULO DOCUMENTACIÓN — Araujo CCPP
// ===================================================================
// Plug-in que añade el módulo de Documentación (CCPP) al index.cjs.
// Toma el relevo cuando un CCPP termina la fase 04_SEGUIMIENTO de
// presupuestos y se acepta. A partir de 05_DOCUMENTACION en adelante
// (06_VISITA_EMASESA, 07_CONTRATOS_PAGOS) este módulo es el que manda.
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
//
// Variables de entorno:
//   - GOOGLE_CLIENT_ID
//   - GOOGLE_CLIENT_SECRET
//   - GOOGLE_REFRESH_TOKEN
//   - GOOGLE_SHEETS_ID
//   - ADMIN_TOKEN
// ===================================================================

const { google } = require("googleapis");
const { getThemeCss } = require("./estilo-visual.cjs");

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN (mismo patrón que presupuestos.cjs / index.cjs)
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

  // =================================================================
  // CONSTANTES
  // =================================================================
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const RANGO_COMUNIDADES = "comunidades!A:AL";
  const RANGO_VECINOS_BASE = "vecinos_base!A:F";
  const RANGO_EXPEDIENTES = "expedientes!A:Y";

  // Fases del módulo Documentación.
  // Importante: comparten la columna `fase_presupuesto` de la pestaña
  // "comunidades" con presupuestos.cjs (una sola máquina de estados
  // para todo el ciclo del CCPP). Presupuestos gestiona 01-04 y ZZ;
  // documentación gestiona 05-07.
  const DOC_FASES = {
    "05_DOCUMENTACION":   { codigo: "05", nombre: "Documentación", nombreLargo: "DOCUMENTACION",   color: "azul",  siguiente: "06_VISITA_EMASESA" },
    "06_VISITA_EMASESA":  { codigo: "06", nombre: "Visita EMASESA", nombreLargo: "VISITA EMASESA", color: "azul",  siguiente: "07_CONTRATOS_PAGOS" },
    "07_CONTRATOS_PAGOS": { codigo: "07", nombre: "Contratos",     nombreLargo: "CONTRATOS Y PAGOS", color: "verde", siguiente: null },
  };

  // Lista de fases que este módulo gestiona (las del listado /documentacion).
  const FASES_DOC = Object.keys(DOC_FASES);

  // Compat: estados antiguos de la fase 05 que pudieran quedar en el Sheet.
  const MAPA_ESTADO_FASE = {
    "05_ENVIO_DOC":      "05_DOCUMENTACION",
    "ENTREGADO":         "05_DOCUMENTACION",
    "06-ENVIO DOC":      "05_DOCUMENTACION",
  };

  function normalizarFase(fase) {
    if (!fase) return "";
    if (DOC_FASES[fase]) return fase;
    return MAPA_ESTADO_FASE[fase] || fase; // si no es de doc, devuelve tal cual
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
  // HELPERS GENÉRICOS (espejo de presupuestos.cjs para ser autocontenido)
  // =================================================================
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function fmtFecha(f) {
    if (!f || f === "") return "—";
    const d = new Date(f.length > 10 ? f : f + "T00:00:00");
    if (isNaN(d)) return f;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }
  function fmtMoneda(n) {
    if (n == null || n === "") return "—";
    const num = parseFloat(String(n).replace(',', '.'));
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }
  function fmtTlf(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }
  function ccppId(direccion) {
    const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }
  function urlT(token, path, params) {
    const usp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== "") usp.set(k, v);
      }
    }
    if (token) usp.set("token", token);
    const qs = usp.toString();
    return qs ? `${path}?${qs}` : path;
  }

  // =================================================================
  // CAPA DE ACCESO — comunidades (lectura + actualización fase)
  // =================================================================
  // Las columnas COLS son las mismas que en presupuestos.cjs. Aquí
  // solo hacemos LECTURA y, como mucho, cambio de la columna `fase_presupuesto`
  // (cuando se avance/retroceda fase desde documentación). No tocamos
  // los importes ni mails — eso es de presupuestos.
  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_decision_pto",
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio",
    "tiempo_previsto","tiempo_real","tiempo_desvio","notas_pto",
    "mails_enviados","mails_ultimo_envio",
    "fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto",
  ];
  function rowToObj(row) {
    const o = {};
    for (let i = 0; i < COLS.length; i++) o[COLS[i]] = row[i] || "";
    const clave = o.direccion || o.comunidad || "";
    o.ccpp_id = clave ? ccppId(clave) : "";
    return o;
  }
  async function leerComunidades() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_COMUNIDADES,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (!r[0] && !r[1])) continue;
      const o = rowToObj(r);
      o._rowIndex = i + 1;
      out.push(o);
    }
    return out;
  }
  async function buscarComunidadPorId(id) {
    const todas = await leerComunidades();
    return todas.find(c => c.ccpp_id === id) || null;
  }

  // =================================================================
  // CAPA DE ACCESO — vecinos_base + expedientes (lectura)
  // =================================================================
  // vecinos_base: listado maestro piso/nombre/teléfono por dirección.
  // expedientes:  cabecera del expediente WhatsApp por vecino (escrita
  //               por index.cjs cuando el vecino interactúa con el bot).
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
        // Hoy la col A se ha venido usando como "comunidad" (clave corta).
        // Para los vecinos NUEVOS que cree documentacion vamos a meter aquí
        // la `direccion` completa del CCPP. Compatibilidad: las filas viejas
        // siguen funcionando con el fallback de match por ambas claves.
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

  // Empareja vecinos (de "expedientes") con un CCPP por dirección o por
  // clave de comunidad. Hoy index.cjs escribe la "comunidad" en la col B,
  // y puede ser tanto la clave corta como la dirección. Probamos ambas
  // para máxima compatibilidad.
  function vecinosDeComunidad(expedientes, comu) {
    if (!expedientes || !comu) return [];
    const norm = s => String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const claves = [norm(comu.direccion), norm(comu.comunidad)].filter(Boolean);
    if (claves.length === 0) return [];
    return expedientes.filter(v => {
      const vc = norm(v.comunidad);
      if (!vc) return false;
      return claves.some(k => k === vc || k.includes(vc) || vc.includes(k));
    });
  }

  // Vecinos del listado maestro (pestaña vecinos_base) para un CCPP dado.
  function vecinosBaseDeComunidad(vecinosBase, comu) {
    if (!vecinosBase || !comu) return [];
    const norm = s => String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const claves = [norm(comu.direccion), norm(comu.comunidad)].filter(Boolean);
    if (claves.length === 0) return [];
    return vecinosBase.filter(v => {
      const vc = norm(v.direccion);
      if (!vc) return false;
      return claves.some(k => k === vc || k.includes(vc) || vc.includes(k));
    });
  }

  // =================================================================
  // TIMELINE (idéntico al de presupuestos.cjs — 7 fases activas)
  // =================================================================
  function calcularLineaTiempo(comu) {
    // Importante: aquí la fase la leemos tal cual está en el Sheet.
    // Si está en una fase de presupuestos (01-04) la pintamos igual.
    // Si está en una fase de documentación (05-07) también.
    let fase = comu.fase_presupuesto || "";
    fase = MAPA_ESTADO_FASE[fase] || fase;
    const ORDEN = ["01_CONTACTO","02_VISITA","03_ENVIO","04_SEGUIMIENTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_CONTRATOS_PAGOS"];
    const idx = ORDEN.indexOf(fase);
    return [
      { proceso: "Presupuesto",   nombre: "01-Contacto",  faseId: "01_CONTACTO",        estado: estadoHito("01_CONTACTO",        fase, idx) },
      { proceso: "Presupuesto",   nombre: "02-Visita",    faseId: "02_VISITA",          estado: estadoHito("02_VISITA",          fase, idx) },
      { proceso: "Presupuesto",   nombre: "03-Envío",     faseId: "03_ENVIO",           estado: estadoHito("03_ENVIO",           fase, idx) },
      { proceso: "Presupuesto",   nombre: "04-Seguim.",   faseId: "04_SEGUIMIENTO",     estado: estadoHito("04_SEGUIMIENTO",     fase, idx) },
      { proceso: "Documentación", nombre: "05-Doc.",      faseId: "05_DOCUMENTACION",   estado: estadoHito("05_DOCUMENTACION",   fase, idx) },
      { proceso: "Documentación", nombre: "06-EMASESA",   faseId: "06_VISITA_EMASESA",  estado: estadoHito("06_VISITA_EMASESA",  fase, idx) },
      { proceso: "Documentación", nombre: "07-Contrato",  faseId: "07_CONTRATOS_PAGOS", estado: estadoHito("07_CONTRATOS_PAGOS", fase, idx) },
    ];
    function estadoHito(hitoId, faseActual, idxFaseActual) {
      if (faseActual === "ZZ_RECHAZADO" || faseActual === "ZZ_DESCARTADO") return "rechazado";
      const ordenHito = ORDEN.indexOf(hitoId);
      if (ordenHito === -1) return "pendiente";
      if (idxFaseActual === -1) return "pendiente";
      if (ordenHito < idxFaseActual) return "completo";
      if (ordenHito === idxFaseActual) return "actual";
      return "pendiente";
    }
  }

  function fechaHito(comu, hitoId) {
    if (hitoId === "01_CONTACTO")    return comu.fecha_solicitud_pto;
    if (hitoId === "02_VISITA")      return comu.fecha_visita_pto;
    if (hitoId === "03_ENVIO")       return comu.fecha_envio_pto;
    if (hitoId === "04_SEGUIMIENTO") return comu.fecha_ultimo_seguimiento_pto;
    // 05-07: aún no tenemos fechas dedicadas en el Sheet (se decidirá
    // después si añadimos columnas o si las dejamos derivadas).
    return "";
  }

  function lineaTiempoHtml(comu) {
    const puntos = calcularLineaTiempo(comu);
    const grupos = {};
    puntos.forEach(p => { (grupos[p.proceso] ||= []).push(p); });
    return `<div class="ptl-timeline">
      ${Object.entries(grupos).map(([procName, pts]) => `
        <div class="ptl-grupo">
          <div class="ptl-grupo-titulo">${esc(procName)}</div>
          <div class="ptl-puntos">
            ${pts.map(p => {
              const f = fechaHito(comu, p.faseId);
              const ff = fmtFecha(f);
              return `<div class="ptl-punto ${p.estado}" title="${esc(procName)} · ${esc(p.nombre)}${f ? ' · ' + ff : ''}">
                <div class="ptl-circulo"></div>
                <div class="ptl-label">${esc(p.nombre)}</div>
                <div class="ptl-fecha">${f ? ff : '·'}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function badgeFase(faseId) {
    const fase = normalizarFase(faseId);
    const def = DOC_FASES[fase];
    if (!def) return `<span class="ptl-badge ptl-badge-gris">—</span>`;
    return `<span class="ptl-badge ptl-badge-${def.color}">${def.codigo}-${esc(def.nombre)}</span>`;
  }

  function badgeEstadoVecino(estado) {
    // Estados que escribe index.cjs en la columna `estado_expediente`.
    const map = {
      en_proceso: { txt: "En proceso", cls: "ptl-badge-azul" },
      pendiente_clasificacion: { txt: "Pdte. clasificación", cls: "ptl-badge-gris" },
      pendiente_estudio_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      pendiente_financiacion: { txt: "Pdte. financiación", cls: "ptl-badge-amarillo" },
      documentacion_base_completa: { txt: "Doc. completa", cls: "ptl-badge-verde" },
      expediente_con_revision_pendiente: { txt: "Revisión pendiente", cls: "ptl-badge-naranja" },
      completo_revision_final: { txt: "Rev. final", cls: "ptl-badge-naranja" },
    };
    const def = map[estado] || { txt: estado || "—", cls: "ptl-badge-gris" };
    return `<span class="ptl-badge ${def.cls}">${esc(def.txt)}</span>`;
  }

  // Cajita de vecinos en la ficha del CCPP de documentación.
  // Cruza `vecinos_base` (listado maestro) con `expedientes` (estado real
  // del bot WhatsApp). Si un vecino aparece en ambos, mostramos su estado;
  // si solo está en vecinos_base, lo marcamos como "sin contacto".
  function cajitaVecinosHtml(comu, vecinosBase, expedientes, token) {
    const vBase = vecinosBaseDeComunidad(vecinosBase, comu);
    const vExp = vecinosDeComunidad(expedientes, comu);

    // Indexar expedientes por teléfono normalizado para cruce rápido.
    const normTlf = s => String(s || "").replace(/\D/g, "").replace(/^34/, "");
    const expByTlf = {};
    vExp.forEach(e => { const k = normTlf(e.telefono); if (k) expByTlf[k] = e; });

    // Construir lista unificada: cada fila combina vecinos_base + expediente.
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
    // Vecinos que tienen expediente pero NO están en vecinos_base (raro,
    // significa que el bot creó al vecino antes de subir el listado).
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
        <div class="ptl-card">
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
      // Solo enlazamos a /vecino del index.cjs si tiene expediente real.
      const url = f.tieneExpediente ? `/vecino?t=${encodeURIComponent(f.telefono)}${tk}` : "";
      const onClick = url ? `onclick="window.location='${url}'"` : "";
      const cursor = url ? "" : "style=\"cursor:default\"";
      const huerfano = f.huerfano ? `<span class="ptl-badge ptl-badge-amarillo" style="margin-left:4px" title="Existe en expedientes pero no en el listado vecinos_base">⚠</span>` : "";
      return `<tr ${onClick} ${cursor}>
        <td><strong>${esc(f.vivienda)}</strong>${huerfano}</td>
        <td>${esc(f.nombre)}</td>
        <td class="ptl-num-cell">${esc(tlf)}</td>
        <td>${badgeEstadoVecino(f.estado)}</td>
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
      <div class="ptl-card">
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
  // PÁGINA HTML BASE
  // =================================================================
  function pageHtml(titulo, breadcrumbs, content, token) {
    const bc = breadcrumbs && breadcrumbs.length > 1
      ? `<div class="ptl-breadcrumb">${breadcrumbs.map((b, i) => {
          if (i < breadcrumbs.length - 1)
            return `<a href="${esc(b.url)}">${esc(b.label)}</a><span class="ptl-sep">/</span>`;
          return `<span>${esc(b.label)}</span>`;
        }).join("")}</div>`
      : "";
    const homeUrl = urlT(token, "/documentacion");
    return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(titulo)} · Araujo Documentación</title>
  <style>${getThemeCss()}</style>
</head><body>
  <nav class="ptl-nav">
    <a href="${homeUrl}" class="ptl-nav-brand">
      <div class="ptl-logo">A</div>
      <div class="ptl-nav-text"><strong>Araujo Documentación</strong><span>CCPP · Recogida y trámites</span></div>
    </a>
  </nav>
  <div class="ptl-page">
    ${bc}
    ${content}
  </div>
</body></html>`;
  }
  function sendHtml(res, html, status = 200) {
    res.status(status).set("Content-Type", "text/html; charset=utf-8").send(html);
  }
  function sendError(res, html, status = 500) {
    sendHtml(res, pageHtml("Error", [], `<div class="ptl-empty"><h3>${esc(html)}</h3></div>`), status);
  }

  function checkToken(req, res) {
    const t = req.query.token || (req.body && req.body.token);
    if (!t || t !== process.env.ADMIN_TOKEN) {
      res.status(403).send("No autorizado");
      return false;
    }
    return true;
  }

  // =================================================================
  // VISTA: LISTADO DE DOCUMENTACIÓN
  // =================================================================
  function vistaListado(comunidades, query, token) {
    const filtroFase = query.fase || "";
    const busqueda = (query.q || "").toLowerCase().trim();

    // Solo nos quedamos con CCPPs en fases del módulo documentacion.
    const enDoc = comunidades.filter(c => {
      const f = normalizarFase(c.fase_presupuesto);
      return FASES_DOC.includes(f);
    });

    const counts = { todos: enDoc.length };
    FASES_DOC.forEach(f => counts[f] = 0);
    enDoc.forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      if (counts[f] !== undefined) counts[f]++;
    });

    let lista = enDoc.slice();
    if (filtroFase && FASES_DOC.includes(filtroFase)) {
      lista = lista.filter(c => normalizarFase(c.fase_presupuesto) === filtroFase);
    }
    if (busqueda) {
      lista = lista.filter(c => {
        const hay = `${c.direccion} ${c.comunidad} ${c.administrador || ''} ${c.presidente || ''}`.toLowerCase();
        return hay.includes(busqueda);
      });
    }
    lista.sort((a, b) => String(a.direccion || a.comunidad || "").localeCompare(String(b.direccion || b.comunidad || ""), "es", { sensitivity: "base" }));

    const filtroBtn = (faseId, label, extra = "") => {
      const activo = filtroFase === faseId ? "on" : "";
      const params = {};
      if (faseId) params.fase = faseId;
      if (busqueda) params.q = busqueda;
      const url = urlT(token, "/documentacion", params);
      const n = faseId ? counts[faseId] : counts.todos;
      return `<a href="${url}" class="ptl-filtro ${activo} ${extra}">${label} <span style="opacity:.7;margin-left:3px">${n || 0}</span></a>`;
    };

    const filas = lista.map(c => `
      <a href="${urlT(token, "/documentacion/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info">
          <span class="ptl-fila-tipo">${esc(c.tipo_via || '')}</span>
          <span class="ptl-fila-dir">${esc(c.direccion || c.comunidad || '—')}</span>
        </div>
        ${lineaTiempoHtml(c)}
        <span class="ptl-fila-importe">${fmtMoneda(c.pto_total)}</span>
      </a>
    `).join("");

    return `
      <div class="ptl-lista-header">
        <div style="display:flex;gap:8px;align-items:stretch">
          <div class="ptl-search-wrap" style="flex:1">
            <span class="ptl-search-icon">🔍</span>
            <input class="ptl-search-input" placeholder="Buscar dirección, comunidad, administrador..." value="${esc(busqueda)}" oninput="ptlFiltrar(this.value)"/>
          </div>
        </div>
        <div class="ptl-filtros ptl-filtros-rapidos">
          ${(() => {
            const activo = !filtroFase ? "on" : "";
            const params = {};
            if (busqueda) params.q = busqueda;
            const url = urlT(token, "/documentacion", params);
            return `<a href="${url}" class="ptl-filtro ${activo}">Todos <span style="opacity:.7;margin-left:3px">${counts.todos}</span></a>`;
          })()}
        </div>
        <div class="ptl-filtros ptl-filtros-fases">
          ${filtroBtn("05_DOCUMENTACION", "05-DOCUMENTACION", "ptl-fase-activa")}
          ${filtroBtn("06_VISITA_EMASESA", "06-VISITA EMASESA", "ptl-fase-activa")}
          ${filtroBtn("07_CONTRATOS_PAGOS", "07-CONTRATOS Y PAGOS", "ptl-fase-activa")}
        </div>
      </div>
      <div>
        ${filas || `<div class="ptl-empty"><h3>Sin expedientes en documentación</h3><p>Cuando un presupuesto se acepta, el CCPP entra automáticamente aquí.</p></div>`}
      </div>
      <script>
        function ptlFiltrar(q) {
          // Filtro client-side simple por dirección.
          const Q = (q || "").toLowerCase().trim();
          document.querySelectorAll('.ptl-fila').forEach(el => {
            const t = el.innerText.toLowerCase();
            el.style.display = (!Q || t.includes(Q)) ? '' : 'none';
          });
        }
      </script>
    `;
  }

  // =================================================================
  // VISTA: FICHA DE EXPEDIENTE CCPP (en documentación)
  // =================================================================
  function vistaFicha(comu, vecinosBase, expedientes, token) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = DOC_FASES[fase];
    const labelFase = def
      ? `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`
      : (comu.fase_presupuesto || "—");

    return `
      <div style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h2 style="font-size:16px;font-weight:700;color:var(--ptl-gray-900);margin:0">
            ${esc(comu.tipo_via || '')} ${esc(comu.direccion || comu.comunidad || '—')}
          </h2>
          ${badgeFase(fase)}
        </div>
        <div style="font-size:12px;color:var(--ptl-gray-500);margin-top:2px">
          ${esc(labelFase)}${comu.administrador ? ' · Admin: ' + esc(comu.administrador) : ''}
        </div>
      </div>

      <div class="ptl-card" style="margin-bottom:8px">
        ${lineaTiempoHtml(comu)}
      </div>

      ${cajitaVecinosHtml(comu, vecinosBase, expedientes, token)}

      <div class="ptl-empty" style="margin-top:14px">
        <p style="font-size:12px">
          Próximos pasos del módulo documentación: subir listado piso/nombre/teléfono,
          gestionar las fases 05 → 06 → 07 con sus acciones, integrar el bot WhatsApp
          que hoy vive en index.cjs.
        </p>
      </div>
    `;
  }

  // =================================================================
  // RUTAS
  // =================================================================
  app.get("/documentacion", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const comunidades = await leerComunidades();
      sendHtml(res, pageHtml("Documentación",
        [{ label: "Documentación", url: urlT(token, "/documentacion") }, { label: "Listado", url: "#" }],
        vistaListado(comunidades, req.query, token),
        token));
    } catch (e) {
      console.error("[documentacion] /documentacion:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  app.get("/documentacion/expediente", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const id = req.query.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) {
        return sendHtml(res, pageHtml("No encontrado",
          [{ label: "Documentación", url: urlT(token, "/documentacion") }, { label: "—", url: "#" }],
          `<div class="ptl-empty"><h3>Expediente no encontrado</h3></div>`,
          token));
      }
      let vecinosBase = [];
      let expedientes = [];
      try { vecinosBase = await leerVecinosBase(); }
      catch (e) { console.warn("[documentacion] no se pudo leer vecinos_base:", e.message); }
      try { expedientes = await leerExpedientes(); }
      catch (e) { console.warn("[documentacion] no se pudo leer expedientes:", e.message); }

      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      sendHtml(res, pageHtml(titulo,
        [{ label: "Documentación", url: urlT(token, "/documentacion") }, { label: labelExp, url: "#" }],
        vistaFicha(comu, vecinosBase, expedientes, token),
        token));
    } catch (e) {
      console.error("[documentacion] /documentacion/expediente:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  console.log("[documentacion] Módulo cargado. Rutas: /documentacion, /documentacion/expediente");

};
