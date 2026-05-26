// ============================================================
// ARA OS · Actividad inferida desde el sheet · v0.3.0 · 2026-05-26
//
// v0.3.0 — Añade financiaciones_sabadell como 3ª fuente.
//          Sin desde, devuelve histórico completo.
// v0.2.0 — Acceso por índice posicional (no header).
//
// Lee 3 sheets y sintetiza eventos a partir de sus columnas-fecha:
//   - ordenes_trabajo        (8 columnas-evento)
//   - comunidades            (12 columnas-evento)
//   - financiaciones_sabadell (1 evento por fila)
//
// GET /api/ara-os/actividad-inferida?token=...&actor=...&desde=...
//   - Sin "desde" → devuelve histórico completo
//   - actor opcional: 'José Manuel' | 'Guillermo'
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

// ── Mapeo POSICIONAL de columnas (idéntico a panel-obras.cjs) ──
const OT_COL_IDX = {
  comunidad:              0,   // A
  fecha_creacion:         2,   // C
  fecha_inicio_obra:      4,   // E
  ultimo_modificador:     10,  // K
  fecha_inicio_real:      11,  // L
  visita_inspector_fecha: 20,  // U
  cobro_emasesa_fecha:    23,  // X
  fecha_montaje:          27,  // AB
  fecha_factura_emitida:  34,  // AI
  fecha_firma_presidente: 35,  // AJ
};

const COM_COL_IDX = {
  comunidad:                       0,   // A
  fecha_solicitud_pto:             16,  // Q
  fecha_visita_pto:                17,  // R
  fecha_envio_pto:                 18,  // S
  fecha_ultimo_seguimiento_pto:    19,  // T
  fecha_aceptacion_pto:            21,  // V
  mails_ultimo_envio:              35,
  fecha_ultimo_reenvio_pto:        37,
  fecha_visita_emasesa:            38,
  fecha_documentacion_completa:    39,
  fecha_contratos_pagos_completa:  40,
  fecha_envio_contratos_pagos:     51,
  fecha_cycp_completa:             52,
};

// financiaciones_sabadell sheet (FS_COLS de panel-obras.cjs)
const FS_COL_IDX = {
  n_operacion:     0,  // A
  tipo:            1,  // B   'piso' | 'comunidad'
  comunidad:       2,  // C
  vivienda:        3,  // D
  titular:         4,  // E
  importe:         5,  // F
  fecha:           6,  // G
  empresa:         7,  // H
  url_pdf:         8,  // I
  n_transferencia: 9,  // J
  registrado_en:   10, // K
  registrado_por:  11, // L
};

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
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
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

function fmtEur(n) {
  const v = parseFloat(n);
  if (!isFinite(v) || v <= 0) return '';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
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

      // ── ordenes_trabajo ──
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
              detalle: ev.detalle,
              fuente: 'ot',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] ordenes_trabajo:', e.message);
      }

      // ── comunidades ──
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
              detalle: ev.detalle,
              fuente: 'comunidad',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] comunidades:', e.message);
      }

      // ── financiaciones_sabadell ──
      try {
        const datos = await leerSheet('financiaciones_sabadell!A2:L');
        for (const row of datos) {
          const comunidad = String(row[FS_COL_IDX.comunidad] || '').trim();
          if (!comunidad) continue;
          const tipo      = String(row[FS_COL_IDX.tipo] || '').trim().toLowerCase();
          const fecha     = normalizarFecha(String(row[FS_COL_IDX.fecha] || ''));
          const fechaReg  = normalizarFecha(String(row[FS_COL_IDX.registrado_en] || ''));
          const fechaUsar = fecha || fechaReg;
          if (!fechaUsar) continue;
          if (desde && fechaUsar < desde) continue;
          const registrador = normalizarActor(String(row[FS_COL_IDX.registrado_por] || ''));
          const actorFinal  = registrador || 'Guillermo';
          if (actorFiltro && actorFinal !== actorFiltro) continue;

          const importeRaw = row[FS_COL_IDX.importe];
          const importeFmt = fmtEur(importeRaw);
          const titular    = String(row[FS_COL_IDX.titular] || '').trim();
          const vivienda   = String(row[FS_COL_IDX.vivienda] || '').trim();
          const partes = [];
          if (importeFmt) partes.push(importeFmt);
          if (tipo === 'piso' && vivienda) partes.push(`piso ${vivienda}`);
          else if (tipo === 'comunidad') partes.push('comunidad');
          if (titular) partes.push(titular);
          const detalle = partes.join(' · ') || 'Financiación registrada';

          eventos.push({
            fecha: fechaUsar,
            hora: extraerHora(String(row[FS_COL_IDX.registrado_en] || '')),
            actor: actorFinal,
            tipo: tipo === 'piso' ? 'financiacion_piso' : 'financiacion_comunidad',
            comunidad,
            detalle,
            fuente: 'financiacion',
          });
        }
      } catch (e) {
        console.warn('[actividad-inferida] financiaciones_sabadell:', e.message);
      }

      // Orden desc por fecha+hora (más reciente primero)
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
    "[actividad-inferida] v0.3.0 cargado · GET /api/ara-os/actividad-inferida (3 sheets · OT + comunidades + financiaciones)",
  );
};
