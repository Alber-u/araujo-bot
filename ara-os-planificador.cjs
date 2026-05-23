// ============================================================
// ARA OS · Planificador de obras v1.0
// GET /api/ara-os/planificador
// ============================================================

module.exports = function(app) {
  const { validToken } = require('./lib/auth.cjs');
  const jsonBodyParser = require('express').json();

  function tokenValido(req) { return validToken(req.query.token); }
  function responderCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  const { google } = require('googleapis');
  function getSheetsClient() {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.sheets({ version: 'v4', auth });
  }
  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango });
    return res.data.values || [];
  }
  async function leerHojaSafe(rango) {
    try { return await leerHoja(rango); } catch { return []; }
  }
  function rowToObj(row, headers) {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i] || ''; });
    return o;
  }
  async function leerTabla(hoja, headers) {
    const rows = await leerHojaSafe(`${hoja}!A2:${String.fromCharCode(65 + headers.length - 1)}`);
    return rows.map(r => rowToObj(r, headers));
  }

  // ─── Tiempos medios entre fases (días naturales) ─────────
  const TIEMPOS = {
    solicitud_a_aceptacion:    60,
    aceptacion_a_visita_em:    30,
    visita_em_a_doc_completa:  45,
    doc_a_cycp:                30,
    cycp_a_preparada:          60,
    preparada_a_inicio:         7,
  };

  function addDias(fecha, dias) {
    if (!fecha) return null;
    try {
      const d = new Date(String(fecha).slice(0,10));
      if (isNaN(d)) return null;
      d.setDate(d.getDate() + Math.round(dias));
      return d.toISOString().slice(0, 10);
    } catch { return null; }
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function calcularFechasPrevistas(obra) {
    const f = obra.fase_panel || '';
    const h = hoy();
    const tp = parseFloat(String(obra.tiempo_previsto || '0').replace(',', '.')) || 0;
    const diasNaturales = Math.round(tp * 1.4); // días hábiles → naturales

    let fechas = {
      inicio_previsto: null,
      fin_previsto:    null,
      preparada_previsto: null,
    };

    if (f === '13_EN_EJECUCION' || f === '14_FINALIZADA' || f === '12_INICIO_OBRA') {
      fechas.inicio_previsto = obra.fecha_inicio_obra || h;
      fechas.fin_previsto    = addDias(fechas.inicio_previsto, diasNaturales);
    } else if (f === '11_PREPARADA') {
      fechas.preparada_previsto = h;
      fechas.inicio_previsto    = addDias(h, TIEMPOS.preparada_a_inicio);
      fechas.fin_previsto       = addDias(fechas.inicio_previsto, diasNaturales);
    } else if (['09_TRAMITADA','09_FINANCIACION','10_BLOQUEOS','08_CYCP','07_PTE_CYCP'].includes(f)) {
      const base = obra.fecha_cycp_completa || obra.fecha_documentacion_completa || h;
      fechas.preparada_previsto = addDias(base, TIEMPOS.cycp_a_preparada);
      fechas.inicio_previsto    = addDias(fechas.preparada_previsto, TIEMPOS.preparada_a_inicio);
      fechas.fin_previsto       = addDias(fechas.inicio_previsto, diasNaturales);
    } else if (['05_DOCUMENTACION','06_VISITA_EMASESA'].includes(f)) {
      let cursor = obra.fecha_visita_emasesa || obra.fecha_aceptacion_pto || obra.fecha_solicitud_pto || h;
      if (!obra.fecha_visita_emasesa) cursor = addDias(cursor, TIEMPOS.aceptacion_a_visita_em);
      if (!obra.fecha_documentacion_completa) cursor = addDias(cursor, TIEMPOS.visita_em_a_doc_completa);
      else cursor = obra.fecha_documentacion_completa;
      cursor = addDias(cursor, TIEMPOS.doc_a_cycp);
      fechas.preparada_previsto = addDias(cursor, TIEMPOS.cycp_a_preparada);
      fechas.inicio_previsto    = addDias(fechas.preparada_previsto, TIEMPOS.preparada_a_inicio);
      fechas.fin_previsto       = addDias(fechas.inicio_previsto, diasNaturales);
    } else {
      // Fases tempranas (01-04)
      let cursor = obra.fecha_aceptacion_pto || obra.fecha_solicitud_pto || h;
      cursor = addDias(cursor, TIEMPOS.aceptacion_a_visita_em + TIEMPOS.visita_em_a_doc_completa + TIEMPOS.doc_a_cycp);
      fechas.preparada_previsto = addDias(cursor, TIEMPOS.cycp_a_preparada);
      fechas.inicio_previsto    = addDias(fechas.preparada_previsto, TIEMPOS.preparada_a_inicio);
      fechas.fin_previsto       = addDias(fechas.inicio_previsto, diasNaturales);
    }

    return fechas;
  }

  // ─── GET /api/ara-os/planificador ────────────────────────
  app.options('/api/ara-os/planificador', (req, res) => { responderCORS(res); res.status(204).end(); });
  app.get('/api/ara-os/planificador', async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: 'Token inválido' });
    try {
      const COM_H = [
        'comunidad','direccion','presidente','telefono_presidente','email_presidente',
        'estado_comunidad','fecha_inicio','fecha_limite_documentacion','fecha_limite_firma',
        'observaciones','tipo_via','earth','administrador','telefono_administrador',
        'email_administrador','fase_presupuesto','fecha_solicitud_pto','fecha_visita_pto',
        'fecha_envio_pto','fecha_ultimo_seguimiento_pto','decision_pto','fecha_aceptacion_pto',
        'pto_total','mano_obra_previsto','mano_obra_real','material_previsto','material_real',
        'beneficio_previsto','beneficio_real','beneficio_desvio','tiempo_previsto',
        'tiempo_real','tiempo_desvio','notas_pto','mails_enviados','mails_ultimo_envio',
        'fecha_proximo_mail_manual','fecha_ultimo_reenvio_pto','fecha_visita_emasesa',
        'fecha_documentacion_completa','fecha_contratos_pagos_completa','modo_documentacion',
        'est_ccpp_contrato_firmado','est_ccpp_toma_datos','est_ccpp_nif','est_ccpp_acta_pte',
        'est_ccpp_acta_pto','est_ccpp_renuncia_gp','est_ccpp_factura_emasesa',
        'est_ccpp_contrato','est_ccpp_pago','fecha_envio_contratos_pagos',
        'fecha_cycp_completa',
      ];
      const OT_H = [
        'comunidad','fase_ot','fecha_creacion','creado_por','fecha_inicio_obra',
        'materiales_pedidos','presidente_avisado','llaves_obtenidas','operarios_asignados',
        'ultima_modificacion','ultimo_modificador','fecha_inicio_real','tiempo_estimado',
        'tiempo_consumido','pct_avance','pct_rentabilidad','num_certificaciones',
        'nif_certificaciones','fecha_cobro','ccpp_id',
      ];
      const PER_H = ['persona_id','nombre','rol','fecha_alta','fecha_baja','telefono','email','dni','cargo','direccion','notas','activo','foto_url','turno','tipo_contrato','num_ss','iban','banco','irpf','salario_bruto_anual','coste_hora'];

      const [filasCom, filasOT, filasPersonas, filasPisos] = await Promise.all([
        leerTabla('comunidades', COM_H),
        leerHojaSafe('ordenes_trabajo!A2:T').then(rows => rows.map(r => rowToObj(r, OT_H))),
        leerTabla('personas', PER_H),
        leerHojaSafe('pisos!A2:AS'), // AS = col 45, incluye est_piso_pago
      ]);

      // Mapa pagos por comunidad
      const IDX_COMUNIDAD_PISO = 0; // col A
      const IDX_EST_PISO_PAGO  = 44; // col AS
      const VALORES_FINANCIA = new Set(['6','12','18','FFCC']);
      const pagosPorComunidad = {};
      for (const row of filasPisos) {
        const com = String(row[IDX_COMUNIDAD_PISO] || '').trim();
        if (!com) continue;
        if (!pagosPorComunidad[com]) pagosPorComunidad[com] = { total: 0, cobrados: 0, financiados: 0, pendientes: 0 };
        const v = String(row[IDX_EST_PISO_PAGO] || '').trim().toUpperCase();
        pagosPorComunidad[com].total++;
        if (v === 'OK')               pagosPorComunidad[com].cobrados++;
        else if (VALORES_FINANCIA.has(v)) pagosPorComunidad[com].financiados++;
        else if (v === 'F')           pagosPorComunidad[com].pendientes++;
      }

      // Mapa OT por comunidad
      const otMap = {};
      for (const ot of filasOT) {
        if (ot.comunidad) otMap[ot.comunidad] = ot;
      }

      // Personas activas
      const personas = filasPersonas
        .filter(p => p.nombre && (p.activo || '').toUpperCase() !== 'FALSE')
        .map(p => ({ persona_id: p.persona_id, nombre: p.nombre, rol: p.rol, coste_hora: parseFloat(String(p.coste_hora||'0').replace(',','.')) || 0 }));

      // Procesar obras
      const FASES_VALIDAS = new Set([
        '05_DOCUMENTACION','06_VISITA_EMASESA','07_PTE_CYCP','08_CYCP',
        '09_TRAMITADA','09_FINANCIACION','10_BLOQUEOS','11_PREPARADA',
        '12_INICIO_OBRA','13_EN_EJECUCION','14_FINALIZADA',
      ]);

      const obras = filasCom
        .filter(o => o.comunidad && o.fase_presupuesto && FASES_VALIDAS.has(o.fase_presupuesto))
        .map(o => {
          const ot = otMap[o.comunidad] || {};
          const fase = ot.fase_ot || o.fase_presupuesto;
          const tp = parseFloat(String(o.tiempo_previsto || ot.tiempo_estimado || '0').replace(',','.')) || 0;
          const obra = {
            ccpp_id: ot.ccpp_id || '',
            comunidad: o.comunidad,
            direccion: o.direccion || '',
            fase_panel: fase,
            tiempo_previsto: tp,
            pto_total: parseFloat(String(o.pto_total||'0').replace(/\./g,'').replace(',','.')) || 0,
            operarios_asignados: ot.operarios_asignados || '',
            pct_avance: parseFloat(ot.pct_avance || '0') || 0,
            fecha_solicitud_pto: o.fecha_solicitud_pto || '',
            fecha_aceptacion_pto: o.fecha_aceptacion_pto || '',
            fecha_visita_emasesa: o.fecha_visita_emasesa || '',
            fecha_documentacion_completa: o.fecha_documentacion_completa || '',
            fecha_cycp_completa: o.fecha_cycp_completa || '',
            fecha_inicio_obra: ot.fecha_inicio_obra || ot.fecha_inicio_real || '',
          };
          const fechas_previstas = calcularFechasPrevistas(obra);

          // ─── Puntuación de prioridad ───
          // 1. % pisos con pago resuelto (OK + financiado) → peso 60%
          // 2. % documentación recogida (contratos, NIF, actas...) → peso 40%
          const pagos = pagosPorComunidad[o.comunidad] || { total: 0, cobrados: 0, financiados: 0 };
          const pctPagos = pagos.total > 0
            ? Math.round(((pagos.cobrados + pagos.financiados) / pagos.total) * 100)
            : 0;

          const docCampos = ['est_ccpp_contrato_firmado','est_ccpp_toma_datos','est_ccpp_nif',
            'est_ccpp_acta_pte','est_ccpp_acta_pto','est_ccpp_renuncia_gp',
            'est_ccpp_factura_emasesa','est_ccpp_contrato','est_ccpp_pago'];
          const docsOK = docCampos.filter(k => String(o[k]||'').toUpperCase() === 'OK').length;
          const pctDocs = Math.round((docsOK / docCampos.length) * 100);

          const prioridad = Math.round(pctPagos * 0.6 + pctDocs * 0.4);

          return {
            ...obra, ...fechas_previstas,
            prioridad, pct_pagos: pctPagos, pct_docs: pctDocs,
            pagos_detalle: pagos,
          };
        });

      res.json({
        ok: true,
        ts: new Date().toISOString(),
        tiempos_fase: TIEMPOS,
        personas,
        obras,
      });
    } catch(e) {
      console.error('[planificador]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
};
