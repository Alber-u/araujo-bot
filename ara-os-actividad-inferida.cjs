// ============================================================
// ARA OS · Actividad inferida desde el sheet · v0.1.0 · 2026-05-26
//
// Endpoint que NO loggea nada — INFIERE eventos leyendo las
// columnas-fecha de los sheets (ordenes_trabajo + comunidades).
// Cobertura histórica completa sin necesidad de instrumentar
// más endpoints.
//
// Idea: cada vez que una columna como fecha_factura_emitida tiene
// una fecha, asumimos que ese día el evento "factura emitida"
// ocurrió. El actor se atribuye por convención (fase14 → JM,
// presupuesto/CYP → Guille). Si la fila tiene un ultimo_modificador
// identificable lo usamos como fallback más preciso.
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

// ── Mapeos columna → evento ────────────────────────────────────
// Cada entrada: { col (header del sheet), tipo (id evento),
//                 actor (atribución por defecto), detalle (label) }
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

  async function leerHojaConHeaders(name) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${name}!A1:BZ`,
    });
    const rows = r.data.values || [];
    if (rows.length === 0) return { headers: {}, datos: [] };
    const headers = {};
    (rows[0] || []).forEach((h, i) => { headers[String(h).trim()] = i; });
    return { headers, datos: rows.slice(1) };
  }

  function colVal(row, headers, name) {
    const idx = headers[name];
    return idx == null ? '' : String(row[idx] || '').trim();
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
        const { headers, datos } = await leerHojaConHeaders('ordenes_trabajo');
        for (const row of datos) {
          const comunidad = colVal(row, headers, 'comunidad') || (row[0] || '').toString().trim();
          if (!comunidad) continue;
          const modificador = normalizarActor(colVal(row, headers, 'ultimo_modificador'));
          for (const ev of OT_EVENTOS) {
            const raw   = colVal(row, headers, ev.col);
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

      // ── comunidades ──
      try {
        const { headers, datos } = await leerHojaConHeaders('comunidades');
        for (const row of datos) {
          const comunidad = colVal(row, headers, 'comunidad') || (row[0] || '').toString().trim();
          if (!comunidad) continue;
          for (const ev of COM_EVENTOS) {
            const raw   = colVal(row, headers, ev.col);
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
    "[actividad-inferida] v0.1.0 cargado · GET /api/ara-os/actividad-inferida",
  );
};
