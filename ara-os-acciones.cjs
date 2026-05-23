// ============================================================
// ARA OS · Sistema de Acciones v1.0
// Genera acciones automáticas por fase y SLA para:
//   - Obras (fases 01-11)
//   - Órdenes de Trabajo (fases 12-19)
//   - Otras Órdenes (INICIO_OBRA, EN_EJECUCION, FINALIZADA, FACTURADA, COBRADA)
//
// Sheet: acciones_obra
// Cols: accion_id | entidad_tipo | entidad_id | comunidad | fase
//       texto | responsable | fecha_limite | prioridad
//       completada | completada_en | completada_por
//       auto_generada | sla_dias | creada_en
// ============================================================

module.exports = function(app) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'araujo2026'
  const { google } = require('googleapis')
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }

  function tokenValido(req) { return (req.query.token || req.body?.token) === ADMIN_TOKEN }
  function responderCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }

  function getSheetsClient() {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    return google.sheets({ version: 'v4', auth })
  }

  function hoy() { return new Date().toISOString().slice(0, 10) }

  function diffDias(fechaStr) {
    if (!fechaStr) return null
    try {
      const d = new Date(String(fechaStr).slice(0, 10))
      return Math.floor((Date.now() - d) / 86400000)
    } catch { return null }
  }

  function addDias(dias) {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 10)
  }

  // ─── COLS sheet acciones_obra ──────────────────────────────
  const COLS = [
    'accion_id','entidad_tipo','entidad_id','comunidad','fase',
    'texto','responsable','prioridad','fecha_limite',
    'completada','completada_en','completada_por',
    'auto_generada','sla_dias','creada_en',
  ]

  function rowToAccion(row) {
    const o = {}
    COLS.forEach((c, i) => { o[c] = (row[i] || '').toString().trim() })
    return o
  }

  function accionToRow(a) {
    return COLS.map(c => a[c] || '')
  }

  async function leerAcciones() {
    try {
      const sheets = getSheetsClient()
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'acciones_obra!A2:O',
      })
      return (res.data.values || []).map(rowToAccion).filter(a => a.accion_id)
    } catch { return [] }
  }

  async function guardarAccion(accion) {
    const sheets = getSheetsClient()
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'acciones_obra!A:O',
      valueInputOption: 'RAW',
      requestBody: { values: [accionToRow(accion)] },
    })
  }

  async function actualizarAccion(accionId, campos) {
    const sheets = getSheetsClient()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'acciones_obra!A:O',
    })
    const rows = res.data.values || []
    const idx = rows.findIndex(r => r[0] === accionId)
    if (idx < 0) return false
    const row = rows[idx]
    const obj = rowToAccion(row)
    Object.assign(obj, campos)
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `acciones_obra!A${idx + 1}:O${idx + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [accionToRow(obj)] },
    })
    return true
  }

  // ══════════════════════════════════════════════════════════
  // MOTOR DE ACCIONES AUTOMÁTICAS
  // ══════════════════════════════════════════════════════════

  // ─── Helper: formatear contacto de obra ──────────────────
  function contactoObra(obra) {
    const pres = obra.presidente || ''
    const telPres = obra.telefono_presidente || ''
    const admin = obra.administrador || ''
    const telAdmin = obra.telefono_administrador || ''
    if (pres && telPres) return `${pres} (${telPres})`
    if (pres) return pres
    if (admin && telAdmin) return `Adm. ${admin} (${telAdmin})`
    if (admin) return `Adm. ${admin}`
    return 'contacto sin registrar'
  }

  // ─── Acciones por fase de OBRA (01-11) ────────────────────
  function accionesObra(obra, accionesExistentes) {
    // Normalizar campos — el panel-obras devuelve 'fase', no 'fase_panel'
    const fase = obra.fase_panel || obra.fase_presupuesto || obra.fase || ''
    if (!obra.ccpp_id && obra.comunidad) {
      obra = { ...obra, ccpp_id: 'ccpp_' + obra.comunidad.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30) }
    }
    // Usar atascado_dias como proxy para días sin movimiento
    const diasSinMovimiento = obra.atascado_dias || 0
    const contacto = contactoObra(obra)
    const n = parseInt(fase.split('_')[0]) || 0
    const existeKey = (k) => accionesExistentes.some(a =>
      (a.entidad_id === obra.ccpp_id || a.comunidad === obra.comunidad) &&
      a.sla_dias === String(k) && a.completada !== 'SI')
    const acciones = []

    function add(texto, responsable, sla, prioridad = 'normal', fechaLimite = null) {
      if (existeKey(sla)) return
      acciones.push({
        accion_id: uuidv4(),
        entidad_tipo: 'obra',
        entidad_id: obra.ccpp_id,
        comunidad: obra.comunidad,
        fase,
        texto,
        responsable,
        prioridad,
        fecha_limite: fechaLimite || addDias(sla),
        completada: 'NO',
        completada_en: '',
        completada_por: '',
        auto_generada: 'SI',
        sla_dias: String(sla),
        creada_en: hoy(),
      })
    }

    // Fase 01 — Primer contacto
    if (n === 1) {
      if (diasSinMovimiento >= 1) {
        add(`📞 Llamar a ${contacto} — ${obra.comunidad} lleva ${diasSinMovimiento}d sin contactar`, 'JM', 1, 'critica')
      } else {
        add(`📞 Llamar a ${contacto} para concertar visita — ${obra.comunidad}`, 'JM', 1, 'alta')
      }
    }

    // Fase 02 — Visita concertada, pendiente de ir
    if (n === 2) {
      add(`🚗 Ir a visita PTO — ${obra.comunidad}. Citar con ${contacto}`, 'JM', 3, 'alta')
    }

    // Fase 03 — Visita hecha, enviar presupuesto
    if (n === 3) {
      if (diasSinMovimiento >= 3) {
        add(`📄 URGENTE: enviar presupuesto a ${contacto} — ${obra.comunidad}, ${diasSinMovimiento}d desde la visita`, 'JM', 3, 'critica')
      } else {
        add(`📄 Enviar presupuesto a ${contacto} — ${obra.comunidad}`, 'JM', 3, 'alta')
      }
    }

    // Fase 04 — Presupuesto enviado, seguimiento
    if (n === 4) {
      if (diasSinMovimiento >= 7) {
        const ciclos = Math.floor((diasSinMovimiento - 7) / 10)
        add(`📞 Llamar a ${contacto} — presupuesto ${obra.comunidad} lleva ${diasSinMovimiento}d sin respuesta`, 'JM', 7 + ciclos * 10, 'alta')
      } else {
        add(`📬 Seguimiento presupuesto ${obra.comunidad} — llamar a ${contacto} si no hay respuesta en ${7 - diasSinMovimiento}d`, 'JM', 7, 'normal')
      }
    }

    // Fase 05 — Documentación vecinos
    if (n === 5) {
      if (diasSinMovimiento >= 10) {
        add(`📋 URGENTE: llamar a ${contacto} — docs de ${obra.comunidad} llevan ${diasSinMovimiento}d paradas`, 'Guille', 10, 'critica')
      } else {
        add(`📋 Revisar docs pendientes con ${contacto} — ${obra.comunidad}`, 'Guille', 5, 'alta')
      }
      // Avance docs disponible
      const pctDocs = obra.avance_docs?.pct ?? null
      if (pctDocs != null && pctDocs < 80) {
        add(`📞 Contactar vecinos con docs pendientes — ${obra.comunidad} (${pctDocs}% completado)`, 'Guille', 10, 'alta')
      }
    }

    // Fase 06 — Visita EMASESA
    if (n === 6) {
      if (!obra.fecha_visita_emasesa) {
        if (diasSinMovimiento >= 14) {
          add(`📡 URGENTE: gestionar visita EMASESA — ${obra.comunidad} lleva ${diasSinMovimiento}d sin visita`, 'Guille', 14, 'critica')
        } else {
          add(`📡 Coordinar visita EMASESA — ${obra.comunidad}`, 'Guille', 14, 'alta')
        }
      }
    }

    // Fase 07-08 — CYCP
    if (n === 7 || n === 8) {
      if (diasSinMovimiento >= 14) {
        add(`📡 Llamar a EMASESA — CYCP de ${obra.comunidad} lleva ${diasSinMovimiento}d sin respuesta`, 'Guille', 14, 'alta')
      } else {
        add(`⏳ Hacer seguimiento CYCP con EMASESA — ${obra.comunidad}`, 'Guille', 14, 'normal')
      }
      if (n === 8) {
        add(`📋 Enviar contratos y cartas de pago a vecinos — ${obra.comunidad}`, 'Guille', 3, 'alta')
      }
    }

    // Fase 09 — Financiación + contratos
    if (n === 9) {
      if (diasSinMovimiento >= 5) {
        add(`📞 Seguimiento contratos/pagos — ${obra.comunidad} lleva ${diasSinMovimiento}d parada`, 'Guille', 10, 'alta')
      }
      const pagos = obra.pagos || {}
      const sabPend = (pagos.sab_total || 0) - (pagos.sab_cobrados || 0)
      const contPend = (pagos.contado_total || 0) - (pagos.contado_cobrados || 0)
      if (sabPend > 0) {
        add(`🏦 Gestionar financiación Sabadell — ${obra.comunidad}: ${sabPend} vecinos pendientes`, 'JM', 7, 'alta')
      }
      if (contPend > 0) {
        add(`💵 Cobrar pagos contado — ${obra.comunidad}: ${contPend} vecinos pendientes`, 'JM', 7, 'alta')
      }
    }

    // Fase 11 — Preparada para OT
    if (n === 11) {
      if (!obra.ot) {
        if (diasSinMovimiento >= 3) {
          add(`🚀 URGENTE: asignar operarios a ${obra.comunidad} — lleva ${diasSinMovimiento}d preparada sin OT`, 'JM', 3, 'critica')
        } else {
          add(`🚀 Enviar ${obra.comunidad} a Órdenes de Trabajo`, 'JM', 3, 'alta')
        }
      }
    }

    return acciones
  }

  // ─── Acciones por fase de OT (12-19) ──────────────────────
  function accionesOT(ot, accionesExistentes) {
    const fase = ot.fase_ot || ot.fase || ''
    if (!ot.ccpp_id && ot.comunidad) {
      ot = { ...ot, ccpp_id: 'ccpp_' + ot.comunidad.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30) }
    }
    const existeKey = (k) => accionesExistentes.some(a =>
      (a.entidad_id === ot.ccpp_id || a.comunidad === ot.comunidad) &&
      a.sla_dias === String(k) && a.completada !== 'SI')
    const acciones = []

    function add(texto, responsable, sla, prioridad = 'normal') {
      if (existeKey(sla)) return
      acciones.push({
        accion_id: uuidv4(),
        entidad_tipo: 'ot',
        entidad_id: ot.ccpp_id,
        comunidad: ot.comunidad,
        fase,
        texto,
        responsable,
        prioridad,
        fecha_limite: addDias(sla),
        completada: 'NO',
        completada_en: '',
        completada_por: '',
        auto_generada: 'SI',
        sla_dias: String(sla),
        creada_en: hoy(),
      })
    }

    if (fase === '12_INICIO_OBRA') {
      add(`🔨 Arrancar obra — ${ot.comunidad}: avisar presidente, obtener llaves, pedir material`, 'JM', 5, 'alta')
      if (!ot.presidente_avisado || ot.presidente_avisado === 'NO') {
        add(`📞 Avisar al presidente de ${ot.comunidad} — fecha inicio obra`, 'JM', 1, 'critica')
      }
      if (!ot.llaves_obtenidas || ot.llaves_obtenidas === 'NO') {
        add(`🗝 Obtener llaves de ${ot.comunidad}`, 'JM', 2, 'alta')
      }
      if (!ot.materiales_pedidos || ot.materiales_pedidos === 'NO') {
        add(`📦 Pedir material para ${ot.comunidad}`, 'JM', 3, 'alta')
      }
    }

    if (fase === '13_EN_EJECUCION') {
      const diasSinRegistro = diffDias(ot.ultimo_registro_tiempo)
      if (diasSinRegistro != null && diasSinRegistro >= 3) {
        add(`⏱ Sin fichajes en ${ot.comunidad} — ${diasSinRegistro}d sin registros. ¿Está activa la obra?`, 'JM', 3, 'critica')
      }
    }

    if (fase === '14_FINALIZADA') {
      add(`✅ Certificar obra terminada con EMASESA — ${ot.comunidad}`, 'JM', 2, 'alta')
      add(`📸 Hacer fotos del trabajo finalizado — ${ot.comunidad}`, 'JM', 2, 'normal')
    }

    if (fase === '15_VISITA_INSPECTOR') {
      add(`📋 Gestionar visita inspector EMASESA — ${ot.comunidad}`, 'Guille', 14, 'alta')
    }

    if (fase === '16_MONTAJE_CONTADORES') {
      add(`🔧 Confirmar fecha montaje contadores con EMASESA — ${ot.comunidad}`, 'JM', 14, 'alta')
    }

    if (fase === '17_COBRO_EMASESA') {
      const diasCobro = diffDias(ot.fecha_fin_obra)
      if (diasCobro != null && diasCobro >= 30) {
        add(`💰 URGENTE: gestionar cobro EMASESA — ${ot.comunidad} lleva ${diasCobro}d sin cobrar`, 'JM', 30, 'critica')
      } else {
        add(`💰 Gestionar cobro EMASESA — ${ot.comunidad}`, 'JM', 30, 'alta')
      }
    }

    if (fase === '19_INCIDENCIAS') {
      add(`🚨 Resolver incidencia — ${ot.comunidad}: ver detalle en ficha`, 'JM', 7, 'critica')
    }

    return acciones
  }

  // ─── Acciones por fase de OO ───────────────────────────────
  function accionesOO(oo, accionesExistentes) {
    const fase = oo.fase || ''
    const existeKey = (k) => accionesExistentes.some(a =>
      a.entidad_id === oo.id && a.sla_dias === String(k) && a.completada !== 'SI')
    const acciones = []

    function add(texto, responsable, sla, prioridad = 'normal') {
      if (existeKey(sla)) return
      acciones.push({
        accion_id: uuidv4(),
        entidad_tipo: 'oo',
        entidad_id: oo.id,
        comunidad: oo.comunidad || oo.titulo,
        fase,
        texto,
        responsable,
        prioridad,
        fecha_limite: addDias(sla),
        completada: 'NO',
        completada_en: '',
        completada_por: '',
        auto_generada: 'SI',
        sla_dias: String(sla),
        creada_en: hoy(),
      })
    }

    if (fase === 'INICIO_OBRA') {
      add(`🔧 Arrancar orden — ${oo.comunidad || oo.titulo}: coordinar con cliente`, 'JM', 2, 'alta')
    }

    if (fase === 'EN_EJECUCION') {
      const diasSinRegistro = diffDias(oo.ultimo_registro)
      if (diasSinRegistro != null && diasSinRegistro >= 3) {
        add(`⏱ Sin actividad en ${oo.comunidad || oo.titulo} — ${diasSinRegistro}d sin registros`, 'JM', 3, 'critica')
      }
    }

    if (fase === 'FINALIZADA') {
      add(`📄 Facturar ${oo.comunidad || oo.titulo} — obra terminada sin factura`, 'Guille', 2, 'alta')
    }

    if (fase === 'FACTURADA') {
      const diasFactura = diffDias(oo.fecha_factura)
      if (diasFactura != null && diasFactura >= 7) {
        add(`💰 Cobrar factura — ${oo.comunidad || oo.titulo} lleva ${diasFactura}d sin pagar. Llamar al cliente.`, 'JM', 7, 'critica')
      } else {
        add(`💰 Hacer seguimiento cobro — ${oo.comunidad || oo.titulo}`, 'JM', 7, 'normal')
      }
    }

    return acciones
  }

  // ══════════════════════════════════════════════════════════
  // ENDPOINTS
  // ══════════════════════════════════════════════════════════

  const jsonParser = require('express').json({ limit: '5mb' })

  // GET /api/ara-os/acciones — listar acciones pendientes
  app.options('/api/ara-os/acciones', (req, res) => { responderCORS(res); res.status(204).end() })
  app.get('/api/ara-os/acciones', async (req, res) => {
    responderCORS(res)
    if (!tokenValido(req)) return res.status(401).json({ error: 'Token inválido' })
    try {
      const { responsable, entidad_tipo, completada = 'NO' } = req.query
      let acciones = await leerAcciones()

      if (completada !== 'todas') acciones = acciones.filter(a => a.completada !== 'SI')
      if (responsable) acciones = acciones.filter(a => a.responsable === responsable)
      if (entidad_tipo) acciones = acciones.filter(a => a.entidad_tipo === entidad_tipo)

      // Ordenar por prioridad y fecha límite
      const PRIORIDAD = { critica: 0, alta: 1, normal: 2 }
      acciones.sort((a, b) => {
        const pa = PRIORIDAD[a.prioridad] ?? 2
        const pb = PRIORIDAD[b.prioridad] ?? 2
        if (pa !== pb) return pa - pb
        return (a.fecha_limite || '').localeCompare(b.fecha_limite || '')
      })

      res.json({ ok: true, total: acciones.length, acciones })
    } catch (e) {
      console.error('[acciones GET]', e)
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/ara-os/acciones — crear acción manual
  app.post('/api/ara-os/acciones', jsonParser, async (req, res) => {
    responderCORS(res)
    if (!tokenValido(req)) return res.status(401).json({ error: 'Token inválido' })
    try {
      const { entidad_tipo, entidad_id, comunidad, fase, texto, responsable, prioridad = 'normal', fecha_limite } = req.body
      if (!texto || !responsable || !entidad_id) return res.status(400).json({ error: 'Faltan campos' })
      const accion = {
        accion_id: uuidv4(),
        entidad_tipo: entidad_tipo || 'obra',
        entidad_id,
        comunidad: comunidad || '',
        fase: fase || '',
        texto,
        responsable,
        prioridad,
        fecha_limite: fecha_limite || addDias(7),
        completada: 'NO',
        completada_en: '',
        completada_por: '',
        auto_generada: 'NO',
        sla_dias: '',
        creada_en: hoy(),
      }
      await guardarAccion(accion)
      res.json({ ok: true, accion })
    } catch (e) {
      console.error('[acciones POST]', e)
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // PUT /api/ara-os/acciones/:id/completar — marcar como hecha
  app.options('/api/ara-os/acciones/:id/completar', (req, res) => { responderCORS(res); res.status(204).end() })
  app.put('/api/ara-os/acciones/:id/completar', jsonParser, async (req, res) => {
    responderCORS(res)
    if (!tokenValido(req)) return res.status(401).json({ error: 'Token inválido' })
    try {
      const { id } = req.params
      const { completada_por = 'sistema' } = req.body
      const ok = await actualizarAccion(id, {
        completada: 'SI',
        completada_en: hoy(),
        completada_por,
      })
      res.json({ ok })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/ara-os/acciones/generar — generar acciones automáticas
  // Anti-duplicado: no genera si ya existe una acción pendiente con mismo
  // entidad_id + sla_dias (la clave única de cada regla de negocio)
  app.options('/api/ara-os/acciones/generar', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(204).end()
  })
  app.post('/api/ara-os/acciones/generar', jsonParser, async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (!tokenValido(req)) return res.status(401).json({ error: 'Token inválido' })
    try {
      const { obras = [], ots = [], oos = [] } = req.body
      const existentes = await leerAcciones()
      const nuevas = []

      // Guardar en batch al final para reducir llamadas a Sheets
      const aBatch = []

      for (const obra of obras) {
        const acc = accionesObra(obra, existentes)
        aBatch.push(...acc)
      }
      for (const ot of ots) {
        const acc = accionesOT(ot, existentes)
        aBatch.push(...acc)
      }
      for (const oo of oos) {
        const acc = accionesOO(oo, existentes)
        aBatch.push(...acc)
      }

      // Guardar todas de una vez si hay nuevas
      if (aBatch.length > 0) {
        const sheets = getSheetsClient()
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: 'acciones_obra!A:O',
          valueInputOption: 'RAW',
          requestBody: { values: aBatch.map(accionToRow) },
        })
        nuevas.push(...aBatch)
      }

      res.json({ ok: true, generadas: nuevas.length, acciones: nuevas })
    } catch (e) {
      console.error('[acciones/generar]', e)
      res.status(500).json({ ok: false, error: e.message })
    }
  })
}
