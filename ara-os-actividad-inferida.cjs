// ============================================================
// ARA OS · Actividad inferida desde el sheet · v0.2.0 · 2026-05-26
//
// Endpoint que NO loggea nada — INFIERE eventos leyendo las
// columnas-fecha de los sheets (ordenes_trabajo + comunidades).
// Cobertura histórica completa sin necesidad de instrumentar
// más endpoints.
//
// v0.2.0 — Acceso por ÍNDICE POSICIONAL (no por nombre de header).
// El sheet ordenes_trabajo solo tiene cabeceras nombradas hasta la
// columna K, pero usa hasta la AK. Por eso pasamos a leer por
// posición fija con OT_COL_IDX y COM_COL_IDX, idénticos a los que
// usa panel-obras.cjs internamente.
//
// GET /api/ara-os/actividad-inferida?token=...&actor=...&desde=...
// → { ok, total, eventos: [{ fecha, hora, actor, tipo, comunidad,
//                            detalle, fuente }] }
//
// Lo monta index.cjs con:
//   require("./ara-os-actividad-inferida.cjs")(app);
// ============================================================

const { google } = require("googleapis");

function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: "v4", auth });
}

// ── Mapeo POSICIONAL de columnas (índice 0-based) ──────────────
// Idéntico al OT_COLS de panel-obras.cjs · NO depende de headers.
const OT_COL_IDX = {
  comunidad:              0,   // A
  fase_ot:                1,   // B
  fecha_creacion:         2,   // C
  fecha_inicio_obra:      4,   // E
  ultima_modificacion:    9,   // J
  ultimo_modificador:     10,  // K
  fecha_inicio_real:      11,  // L
  visita_inspector_fecha: 20,  // U
  cobro_emasesa_fecha:    23,  // X
  fecha_montaje:          27,  // AB
  fecha_factura_emitida:  34,  // AI
  fecha_firma_presidente: 35,  // AJ
};

// Idéntico al COLS_COM de holded.cjs · posiciones del sheet comunidades.
const COM_COL_IDX = {
  comunidad:                       0,   // A
  fecha_solicitud_pto:             16,  // Q
  fecha_visita_pto:                17,  // R
  fecha_envio_pto:                 18,  // S
  fecha_ultimo_seguimiento_pto:    19,  // T
  fecha_aceptacion_pto:            21,  // V
  mails_ultimo_envio:              35,  // AJ
  fecha_ultimo_reenvio_pto:        37,  // AL
  fecha_visita_emasesa:            38,  // AM
  fecha_documentacion_completa:    39,  // AN
  fecha_contratos_pagos_completa:  40,  // AO
  fecha_envio_contratos_pagos:     51,  // AZ
  fecha_cycp_completa:             52,  // BA
};

// ── Eventos a inferir desde ordenes_trabajo ────────────────────
const OT_EVENTOS = [
  { col: 'fecha_creacion',         tipo: 'ot_creada',           actor: 'José Manuel', detalle: 'OT creada' },
  { col: 'fecha_inicio_real',      tipo: 'ot_iniciada',         actor: 'José Manuel', detalle: 'Obra arrancada' },
  { col: 'fecha_inicio_obra',      tipo: 'ot_iniciada',         actor: 'José Manuel', detalle: 'Obra programada' },
  { col: 'fecha_montaje',          tipo: 'contadores_montados', actor: 'José Manuel', detalle: 'Contadores montados' },
  { col: 'visita_inspector_fecha', tipo: 'visita_inspector',    actor: 'José Manuel', detalle: 'Visita del inspector' },
  { col: 'cobro_emasesa_fecha',    tipo: 'cobro_emasesa',       actor: 'Guillermo',   detalle: 'Cobro EMASESA recibido' },
  { col: 'fecha_factura_emitida',  tipo: 'factura_emitida',     actor: 'José Manuel', detalle: 'Factura emitida en Holded' },
  { col: 'fecha_firma_presidente', tipo: 'factura_firmada',     actor: 'José Manuel', detalle: 'Firma conforme del presidente' },
];

// ── Eventos a inferir desde comunidades ────────────────────────
const COM_EVENTOS = [
  { col: 'fecha_solicitud_pto',            tipo: 'pto_solicitado',  actor: 'Guillermo',   detalle: 'Cliente solicitó presupuesto' },
  { col: 'fecha_visita_pto',               tipo: 'pto_visita',      actor: 'José Manuel', detalle: 'Visita técnica de presupuesto' },
  { col: 'fecha_envio_pto',                tipo: 'pto_enviado',     actor: 'Guillermo',   detalle: 'Presupuesto enviado al cliente' },
  { col: 'fecha_ultimo_seguimiento_pto',   tipo: 'pto_seguimiento', actor: 'Guillermo',   detalle: 'Seguimiento del presupuesto' },
  { col: 'fecha_ultimo_reenvio_pto',       tipo: 'pto_reenvio',     actor: 'Guillermo',   detalle: 'Reenvío del presupuesto' },
  { col: 'fecha_aceptacion_pto',           tipo: 'pto_aceptado',    actor: 'Guillermo',   detalle: 'Cliente aceptó presupuesto' },
  { col: 'fecha_visita_emasesa',           tipo: 'visita_emasesa',  actor: 'José Manuel', detalle: 'Visita EMASESA' },
  { col: 'fecha_documentacion_completa',   tipo: 'docs_completos',  actor: 'Guillermo',   detalle: 'Documentación cerrada' },
  { col: 'fecha_envio_contratos_pagos',    tipo: 'cycp_enviado',    actor: 'Guillermo',   detalle: 'Contratos y pagos enviados' },
  { col: 'fecha_contratos_pagos_completa', tipo: 'cycp_completo',   actor: 'Guillermo',   detalle: 'Contratos y pagos completos' },
  { col: 'fecha_cycp_completa',            tipo: 'cycp_terminado',  actor: 'Guillermo',   detalle: 'C&P terminado' },
  { col: 'mails_ultimo_envio',             tipo: 'mail_enviado',    actor: 'Guillermo',   detalle: 'Email enviado al cliente' },
];

// ── Helpers ────────────────────────────────────────────────────
function normalizarFecha(s) {
  if (!s) return '';
  const str = String(s).trim();
  if (!str) return '';
  // ISO completo: 2026-05-26T14:00:00.000Z → 2026-05-26
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // Formato dd/mm/yyyy o dd-mm-yyyy
  const dmy = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return '';
}

function extraerHora(s) {
  if (!s) return '';
  const m = String(s).match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function normalizarActor(s) {
  if (!s) return '';
  const t = String(s).toLowerCase();
  if (/jose manuel|josé manuel|\bjm\b/.test(t)) return 'José Manuel';
  if (/guillermo|\bguille\b/.test(t))          return 'Guillermo';
  return String(s).trim();
}

// ── Mount ──────────────────────────────────────────────────────
module.exports = function setupActividadInferida(app) {
  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) {
    return validToken(req.query.token || req.body?.token);
  }
  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  async function leerSheet(rango) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return r.data.values || [];
  }

  app.options("/api/ara-os/actividad-inferida", (req, res) => {
    responderCORS(res);
    res.status(204).end();
  });

  app.get("/api/ara-os/actividad-inferida", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });
    try {
      const actorFiltro = normalizarActor(req.query.actor || '');
      const desde       = String(req.query.desde || '').slice(0, 10);
      const eventos = [];

      // ── ordenes_trabajo · A2:AK lee los datos (sin header) ──
      try {
        const datos = await leerSheet('ordenes_trabajo!A2:AK');
        for (const row of datos) {
          const comunidad = String(row[OT_COL_IDX.comunidad] || '').trim();
          if (!comunidad) continue;
          const modificador = normalizarActor(String(row[OT_COL_IDX.ultimo_modificador] || ''));
          for (const ev of OT_EVENTOS) {
            const idx = OT_COL_IDX[ev.col];
            if (idx == null) continue;
            const raw = String(row[idx] || '').trim();
            const fecha = normalizarFecha(raw);
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            const actorFinal = modificador || ev.actor;
            if (actorFiltro && actorFinal !== actorFiltro) continue;
            eventos.push({
              fecha,
              hora: extraerHora(raw),
              actor: actorFinal,
              tipo: ev.tipo,
              comunidad,
              ccpp_id: '',
              detalle: ev.detalle,
              fuente: 'ot',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] ordenes_trabajo:', e.message);
      }

      // ── comunidades · A2:BD lee los datos ──
      try {
        const datos = await leerSheet('comunidades!A2:BD');
        for (const row of datos) {
          const comunidad = String(row[COM_COL_IDX.comunidad] || '').trim();
          if (!comunidad) continue;
          for (const ev of COM_EVENTOS) {
            const idx = COM_COL_IDX[ev.col];
            if (idx == null) continue;
            const raw = String(row[idx] || '').trim();
            const fecha = normalizarFecha(raw);
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            if (actorFiltro && ev.actor !== actorFiltro) continue;
            eventos.push({
              fecha,
              hora: extraerHora(raw),
              actor: ev.actor,
              tipo: ev.tipo,
              comunidad,
              ccpp_id: '',
              detalle: ev.detalle,
              fuente: 'comunidad',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] comunidades:', e.message);
      }

      // Ordenar por fecha desc (más reciente primero) y luego por hora desc
      eventos.sort((a, b) => {
        const dCmp = (b.fecha || '').localeCompare(a.fecha || '');
        if (dCmp !== 0) return dCmp;
        return (b.hora || '').localeCompare(a.hora || '');
      });

      res.json({ ok: true, total: eventos.length, eventos });
    } catch (e) {
      console.error("[actividad-inferida GET]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log(
    "[actividad-inferida] v0.2.0 cargado · GET /api/ara-os/actividad-inferida (índice posicional)",
  );
};
