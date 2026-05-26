// ============================================================
// ARA OS · Actividad inferida desde el sheet · v0.4.0 · 2026-05-26
//
// v0.4.0 — +3 fuentes: obras_otras (OO), pisos, checks doc
// v0.3.0 — financiaciones_sabadell + sin límite temporal
// v0.2.0 — acceso por índice posicional (no por header)
//
// Lee 6 sheets y sintetiza eventos a partir de columnas-fecha:
//   - ordenes_trabajo        · 8 columnas-fecha
//   - comunidades            · 12 columnas-fecha + 9 checks ccpp
//   - financiaciones_sabadell · 1 evento por fila
//   - obras_otras            · 5 columnas-fecha (OO)
//   - pisos                  · 2 columnas-fecha (contactos)
//
// GET /api/ara-os/actividad-inferida?token=...&actor=...&desde=...
//   - Sin "desde" → devuelve histórico completo
//   - actor opcional: 'José Manuel' | 'Guillermo'
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

// ── Mapeo POSICIONAL de columnas (idéntico a otros módulos) ────
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
  est_ccpp_contrato_firmado:       42,
  est_ccpp_toma_datos:             43,
  est_ccpp_nif:                    44,
  est_ccpp_acta_pte:               45,
  est_ccpp_acta_pto:               46,
  est_ccpp_renuncia_gp:            47,
  est_ccpp_factura_emasesa:        48,
  est_ccpp_contrato:               49,
  est_ccpp_pago:                   50,
  fecha_envio_contratos_pagos:     51,
  fecha_cycp_completa:             52,
};

const FS_COL_IDX = {
  n_operacion:     0,
  tipo:            1,
  comunidad:       2,
  vivienda:        3,
  titular:         4,
  importe:         5,
  fecha:           6,
  empresa:         7,
  url_pdf:         8,
  n_transferencia: 9,
  registrado_en:   10,
  registrado_por:  11,
};

// obras_otras (OB_HEADERS de ara-os-obras-otras.cjs)
const OO_COL_IDX = {
  obra_id:         0,   // A
  nombre:          1,   // B
  cliente:         2,   // C
  fase:            7,   // H
  fecha_inicio:    8,   // I
  fecha_fin_real:  10,  // K
  fecha_facturada: 11,  // L
  fecha_cobrada:   12,  // M
  created_at:      15,  // P
  created_by:      16,  // Q
  updated_by:      18,  // S
  borrado:         19,  // T
  total_eur:       22,  // W
  codigo_ot:       26,  // AA
};

// pisos (COLS_PISO de ara-os-inferencia.cjs)
const PISO_COL_IDX = {
  comunidad:               1,
  vivienda:                2,
  fecha_primer_contacto:   9,
  fecha_ultimo_contacto:   10,
  est_piso_pago:           44,  // AS
};

// ── Eventos por sheet ──────────────────────────────────────────
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

// Cada check tiene una "fecha proxy" — la del cierre de su bloque (docs o C&P)
const CHECKS_CCPP = [
  { col: 'est_ccpp_contrato_firmado', label: 'Contrato firmado',     fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_toma_datos',       label: 'Toma de datos',        fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_nif',              label: 'NIF presidente',       fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_acta_pte',         label: 'Acta presidente',      fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_acta_pto',         label: 'Acta presupuesto',     fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_renuncia_gp',      label: 'Renuncia grupo presión', fechaProxy: 'fecha_documentacion_completa' },
  { col: 'est_ccpp_factura_emasesa',  label: 'Factura EMASESA',      fechaProxy: 'fecha_contratos_pagos_completa' },
  { col: 'est_ccpp_contrato',         label: 'Contrato C&P',         fechaProxy: 'fecha_contratos_pagos_completa' },
  { col: 'est_ccpp_pago',             label: 'Pago C&P',             fechaProxy: 'fecha_contratos_pagos_completa' },
];

const OO_EVENTOS = [
  { col: 'fecha_inicio',    tipo: 'oo_iniciada',   actor: 'José Manuel', detalle: 'OO arrancada' },
  { col: 'fecha_fin_real',  tipo: 'oo_finalizada', actor: 'José Manuel', detalle: 'OO finalizada' },
  { col: 'fecha_facturada', tipo: 'oo_facturada',  actor: 'José Manuel', detalle: 'OO facturada en Holded' },
  { col: 'fecha_cobrada',   tipo: 'oo_cobrada',    actor: 'Guillermo',   detalle: 'OO cobrada' },
];

const PISO_EVENTOS = [
  { col: 'fecha_primer_contacto', tipo: 'piso_primer_contacto', actor: 'Guillermo', detalle: 'Primer contacto con vecino' },
  { col: 'fecha_ultimo_contacto', tipo: 'piso_ultimo_contacto', actor: 'Guillermo', detalle: 'Último contacto con vecino' },
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
              fecha, hora: extraerHora(raw),
              actor: actorFinal, tipo: ev.tipo, comunidad,
              detalle: ev.detalle, fuente: 'ot',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] ordenes_trabajo:', e.message);
      }

      // ── comunidades (fechas + checks) ──
      try {
        const datos = await leerSheet('comunidades!A2:BD');
        for (const row of datos) {
          const comunidad = String(row[COM_COL_IDX.comunidad] || '').trim();
          if (!comunidad) continue;

          // fechas directas
          for (const ev of COM_EVENTOS) {
            const idx = COM_COL_IDX[ev.col];
            if (idx == null) continue;
            const raw = String(row[idx] || '').trim();
            const fecha = normalizarFecha(raw);
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            if (actorFiltro && ev.actor !== actorFiltro) continue;
            eventos.push({
              fecha, hora: extraerHora(raw),
              actor: ev.actor, tipo: ev.tipo, comunidad,
              detalle: ev.detalle, fuente: 'comunidad',
            });
          }

          // checks ccpp · fecha proxy del cierre de su bloque
          for (const chk of CHECKS_CCPP) {
            const idx = COM_COL_IDX[chk.col];
            if (idx == null) continue;
            const val = String(row[idx] || '').toUpperCase().trim();
            if (val !== 'OK') continue;
            const fechaIdx = COM_COL_IDX[chk.fechaProxy];
            if (fechaIdx == null) continue;
            const fecha = normalizarFecha(String(row[fechaIdx] || ''));
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            if (actorFiltro && 'Guillermo' !== actorFiltro) continue;
            eventos.push({
              fecha, hora: '',
              actor: 'Guillermo',
              tipo: 'check_doc',
              comunidad,
              detalle: `Check marcado · ${chk.label}`,
              fuente: 'check',
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

          const importeFmt = fmtEur(row[FS_COL_IDX.importe]);
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
            comunidad, detalle, fuente: 'financiacion',
          });
        }
      } catch (e) {
        console.warn('[actividad-inferida] financiaciones_sabadell:', e.message);
      }

      // ── obras_otras (OO) ──
      try {
        const datos = await leerSheet('obras_otras!A2:AG');
        for (const row of datos) {
          const borrado = String(row[OO_COL_IDX.borrado] || '').toUpperCase().trim();
          if (borrado === 'TRUE' || borrado === 'SI') continue;
          const nombre = String(row[OO_COL_IDX.nombre] || '').trim()
                      || String(row[OO_COL_IDX.cliente] || '').trim();
          if (!nombre) continue;
          const codigo = String(row[OO_COL_IDX.codigo_ot] || '').trim();
          const comunidad = codigo ? `${nombre} · ${codigo}` : nombre;
          const updatedBy = normalizarActor(String(row[OO_COL_IDX.updated_by] || ''));

          // Evento "oo_creada" desde created_at
          const createdAt = normalizarFecha(String(row[OO_COL_IDX.created_at] || ''));
          if (createdAt && (!desde || createdAt >= desde)) {
            const creadoPor = normalizarActor(String(row[OO_COL_IDX.created_by] || '')) || 'José Manuel';
            if (!actorFiltro || creadoPor === actorFiltro) {
              eventos.push({
                fecha: createdAt,
                hora: extraerHora(String(row[OO_COL_IDX.created_at] || '')),
                actor: creadoPor,
                tipo: 'oo_creada',
                comunidad,
                detalle: 'OO creada',
                fuente: 'oo',
              });
            }
          }

          for (const ev of OO_EVENTOS) {
            const idx = OO_COL_IDX[ev.col];
            if (idx == null) continue;
            const raw = String(row[idx] || '').trim();
            const fecha = normalizarFecha(raw);
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            const actorFinal = updatedBy || ev.actor;
            if (actorFiltro && actorFinal !== actorFiltro) continue;
            const importeFmt = fmtEur(row[OO_COL_IDX.total_eur]);
            const detalle = importeFmt ? `${ev.detalle} · ${importeFmt}` : ev.detalle;
            eventos.push({
              fecha, hora: extraerHora(raw),
              actor: actorFinal, tipo: ev.tipo, comunidad,
              detalle, fuente: 'oo',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] obras_otras:', e.message);
      }

      // ── pisos · fechas de contacto ──
      try {
        const datos = await leerSheet('pisos!A2:AS');
        for (const row of datos) {
          const comunidad = String(row[PISO_COL_IDX.comunidad] || '').trim();
          if (!comunidad) continue;
          const vivienda = String(row[PISO_COL_IDX.vivienda] || '').trim();
          const estPago  = String(row[PISO_COL_IDX.est_piso_pago] || '').trim().toUpperCase();
          for (const ev of PISO_EVENTOS) {
            const idx = PISO_COL_IDX[ev.col];
            if (idx == null) continue;
            const raw = String(row[idx] || '').trim();
            const fecha = normalizarFecha(raw);
            if (!fecha) continue;
            if (desde && fecha < desde) continue;
            if (actorFiltro && ev.actor !== actorFiltro) continue;
            const partes = [];
            if (vivienda) partes.push(`piso ${vivienda}`);
            if (estPago === 'OK') partes.push('cobrado');
            else if (estPago === 'F') partes.push('pendiente pago');
            const detalle = partes.length ? `${ev.detalle} · ${partes.join(' · ')}` : ev.detalle;
            eventos.push({
              fecha, hora: '',
              actor: ev.actor, tipo: ev.tipo, comunidad,
              detalle, fuente: 'piso',
            });
          }
        }
      } catch (e) {
        console.warn('[actividad-inferida] pisos:', e.message);
      }

      // Orden desc por fecha+hora
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
    "[actividad-inferida] v0.4.0 cargado · GET /api/ara-os/actividad-inferida (6 sheets · OT + comunidades + financiaciones + OO + pisos + checks)",
  );
};
