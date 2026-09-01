// ARA OS - Modulo CLIENTES
// CRUD sobre la pestana clientes del Sheet maestro. Expone /api/clientes/*.
// Ficha por cliente/vecino (ej. financiados via Sabadell Consumer Finance)
// con datos de contacto, comunidad de vecinos y documentos asociados.
// Sigue el patron de personas.cjs pero sin PIN de admin.

const { google } = require('googleapis')

const RANGO_CLIENTES = 'clientes!A:J'

const COLS = [
  'id',
  'nombre',
  'telefono',
  'email',
  'direccion',
  'comunidad',
  'piso',
  'notas',
  'documentos',
  'fecha_alta',
  ]

function getSheetsClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
    )
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.sheets({ version: 'v4', auth: oAuth2Client })
}

async function leerHoja(rango) {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: rango,
  })
  return res.data.values || []
}

async function escribirFila(rangoCelda, valores) {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: rangoCelda,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [valores] },
  })
}

async function anadirFila(valores) {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: RANGO_CLIENTES,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [valores] },
  })
}

function filaAObjeto(fila) {
  const o = {}
    COLS.forEach((k, i) => { o[k] = (fila[i] || '').toString().trim() })
  return o
}

function objetoAFila(cliente) {
  return COLS.map(k => (cliente[k] != null ? String(cliente[k]) : ''))
}

function siguienteId(clientesExistentes) {
  let max = 0
  clientesExistentes.forEach(c => {
    const m = /^C-(\d+)$/.exec(c.id || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  })
  return `C-${String(max + 1).padStart(4, '0')}`
}

async function cargarTodos() {
  const filas = await leerHoja(RANGO_CLIENTES)
  const datos = filas.slice(1)
  return datos
  .filter(f => f.some(v => (v || '').toString().trim() !== ''))
  .map((f, i) => Object.assign({}, filaAObjeto(f), { _fila: i + 2 }))
}

module.exports = function setupClientes(app) {
  app.get('/api/clientes', async (req, res) => {
    try {
      const clientes = await cargarTodos()
      const q = (req.query.q || '').toString().toLowerCase().trim()
      const filtrados = q
      ? clientes.filter(c =>
        [c.nombre, c.telefono, c.email, c.comunidad, c.piso, c.direccion]
                        .some(v => (v || '').toLowerCase().includes(q))
                        )
        : clientes
      res.json(filtrados.map(c => { const r = Object.assign({}, c); delete r._fila; return r }))
    } catch (e) {
      console.error('[clientes] GET /api/clientes', e)
      res.status(500).json({ error: 'Error leyendo clientes' })
    }
  })

  app.get('/api/clientes/:id', async (req, res) => {
    try {
      const clientes = await cargarTodos()
      const cliente = clientes.find(c => c.id === req.params.id)
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
      const resto = Object.assign({}, cliente)
      delete resto._fila
      res.json(resto)
    } catch (e) {
      console.error('[clientes] GET /api/clientes/:id', e)
      res.status(500).json({ error: 'Error leyendo el cliente' })
    }
  })

  app.post('/api/clientes', async (req, res) => {
    try {
      const clientes = await cargarTodos()
      const id = siguienteId(clientes)
      const nuevo = {
        id: id,
        nombre: req.body.nombre || '',
        telefono: req.body.telefono || '',
        email: req.body.email || '',
        direccion: req.body.direccion || '',
        comunidad: req.body.comunidad || '',
        piso: req.body.piso || '',
        notas: req.body.notas || '',
        documentos: req.body.documentos || '[]',
        fecha_alta: new Date().toISOString().slice(0, 10),
      }
      await anadirFila(objetoAFila(nuevo))
      res.status(201).json(nuevo)
    } catch (e) {
      console.error('[clientes] POST /api/clientes', e)
      res.status(500).json({ error: 'Error creando el cliente' })
    }
  })

  app.put('/api/clientes/:id', async (req, res) => {
    try {
      const clientes = await cargarTodos()
      const actual = clientes.find(c => c.id === req.params.id)
      if (!actual) return res.status(404).json({ error: 'Cliente no encontrado' })

    const actualizado = Object.assign({}, actual, {
      nombre: req.body.nombre != null ? req.body.nombre : actual.nombre,
      telefono: req.body.telefono != null ? req.body.telefono : actual.telefono,
      email: req.body.email != null ? req.body.email : actual.email,
      direccion: req.body.direccion != null ? req.body.direccion : actual.direccion,
      comunidad: req.body.comunidad != null ? req.body.comunidad : actual.comunidad,
      piso: req.body.piso != null ? req.body.piso : actual.piso,
      notas: req.body.notas != null ? req.body.notas : actual.notas,
      documentos: req.body.documentos != null ? req.body.documentos : actual.documentos,
    })
      delete actualizado._fila

    await escribirFila(`clientes!A${actual._fila}:J${actual._fila}`, objetoAFila(actualizado))
      res.json(actualizado)
    } catch (e) {
      console.error('[clientes] PUT /api/clientes/:id', e)
      res.status(500).json({ error: 'Error actualizando el cliente' })
    }
  })
}
