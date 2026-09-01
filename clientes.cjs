// ============================================================
// ARA OS · Modulo CLIENTES
// --------------------------------------------------------------
// Espejo de la pestana `pisos` del Sheet maestro (fuente real de
// vecinos: A=telefono, B=comunidad, C=vivienda, D=nota_simple,
// E=nombre), con una capa opcional en la pestana `clientes` para
// guardar datos extra que no existen en pisos: email, direccion,
// notas ampliadas y documentos (cartas de pago, contratos...).
//
// Un cliente = un telefono unico. Si el telefono ya aparece en
// `pisos`, sus datos base (nombre/comunidad/piso) salen de ahi;
// la ficha en `clientes` solo aporta lo que falta. Si se edita
// nombre/comunidad/piso desde la ficha, se guarda en `clientes`
// y ese valor manda sobre el de `pisos`.
//
// Expone /api/clientes/*.
// ============================================================

const { google } = require('googleapis')

const RANGO_PISOS = 'pisos!A:E'
const RANGO_CLIENTES = 'clientes!A:J'

const COLS = [
  'id',            // A - telefono normalizado (solo digitos)
  'nombre',        // B
  'telefono',      // C
  'email',         // D
  'direccion',     // E
  'comunidad',     // F
  'piso',          // G
  'notas',         // H
  'documentos',    // I  <- JSON.stringify([{ nombre, url }, ...])
  'fecha_alta',    // J
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
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    })
    return res.data.values || []
  } catch (e) {
    // Si la pestana no existe todavia (p.ej. `clientes` recien creada
    // y vacia, o borrada), tratamos como "sin filas" en vez de romper.
    if (e && e.code === 400) return []
    throw e
  }
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

function normalizarTelefono(raw) {
  const digitos = (raw || '').toString().replace(/\D/g, '')
  if (digitos.length > 9 && digitos.startsWith('34')) return digitos.slice(-9)
  return digitos.slice(-9)
}

function filaAObjeto(fila) {
  const o = {}
  COLS.forEach((k, i) => { o[k] = (fila[i] || '').toString().trim() })
  return o
}

function objetoAFila(cliente) {
  return COLS.map(k => (cliente[k] != null ? String(cliente[k]) : ''))
}

// -------- pisos: fuente real de vecinos --------
async function cargarPisos() {
  const filas = await leerHoja(RANGO_PISOS)
  const [, ...datos] = filas // primera fila = cabecera
  const vistos = new Set()
  const out = []
  datos.forEach(f => {
    const telefonoRaw = (f[0] || '').toString().trim()
    const id = normalizarTelefono(telefonoRaw)
    if (!id || id.length < 6) return // fila vacia o telefono invalido
    if (vistos.has(id)) return // mismo vecino en varios pisos: nos quedamos con el primero
    vistos.add(id)
    out.push({
      id,
      telefono: telefonoRaw,
      comunidad: (f[1] || '').toString().trim(),
      piso: (f[2] || '').toString().trim(),
      notaSimple: (f[3] || '').toString().trim(),
      nombre: (f[4] || '').toString().trim(),
    })
  })
  return out
}

// -------- clientes: capa extra (email, direccion, documentos...) --------
async function cargarExtra() {
  const filas = await leerHoja(RANGO_CLIENTES)
  const [, ...datos] = filas
  const mapa = {}
  datos.forEach((f, i) => {
    const o = filaAObjeto(f)
    const id = o.id || normalizarTelefono(o.telefono)
    if (!id) return
    mapa[id] = { ...o, id, _fila: i + 2 }
  })
  return mapa
}

async function cargarTodos() {
  const [pisos, extraMap] = await Promise.all([cargarPisos(), cargarExtra()])
  const idsPisos = new Set(pisos.map(p => p.id))

  const desdePisos = pisos.map(p => {
    const extra = extraMap[p.id]
    return {
      id: p.id,
      nombre: (extra && extra.nombre) || p.nombre,
      telefono: (extra && extra.telefono) || p.telefono,
      email: (extra && extra.email) || '',
      direccion: (extra && extra.direccion) || '',
      comunidad: (extra && extra.comunidad) || p.comunidad,
      piso: (extra && extra.piso) || p.piso,
      notas: (extra && extra.notas) || p.notaSimple,
      documentos: (extra && extra.documentos) || '[]',
      fecha_alta: (extra && extra.fecha_alta) || '',
    }
  })

  const soloManuales = Object.keys(extraMap)
    .filter(id => !idsPisos.has(id))
    .map(id => {
      const e = extraMap[id]
      return {
        id,
        nombre: e.nombre || '',
        telefono: e.telefono || '',
        email: e.email || '',
        direccion: e.direccion || '',
        comunidad: e.comunidad || '',
        piso: e.piso || '',
        notas: e.notas || '',
        documentos: e.documentos || '[]',
        fecha_alta: e.fecha_alta || '',
      }
    })

  return [...desdePisos, ...soloManuales]
}

module.exports = function setupClientes(app) {
  // GET /api/clientes  -> listado completo (con filtro opcional ?q=)
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
      res.json(filtrados)
    } catch (e) {
      console.error('[clientes] GET /api/clientes', e)
      res.status(500).json({ error: 'Error leyendo clientes' })
    }
  })

  // GET /api/clientes/:id -> ficha de un cliente
  app.get('/api/clientes/:id', async (req, res) => {
    try {
      const clientes = await cargarTodos()
      const cliente = clientes.find(c => c.id === req.params.id)
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
      res.json(cliente)
    } catch (e) {
      console.error('[clientes] GET /api/clientes/:id', e)
      res.status(500).json({ error: 'Error leyendo el cliente' })
    }
  })

  // POST /api/clientes -> alta manual (vecino que aun no esta en `pisos`)
  app.post('/api/clientes', async (req, res) => {
    try {
      const id = normalizarTelefono(req.body.telefono || '')
      if (!id || id.length < 6) {
        return res.status(400).json({ error: 'Telefono invalido: hace falta para identificar al cliente' })
      }
      const extraMap = await cargarExtra()
      const pisos = await cargarPisos()
      if (extraMap[id] || pisos.some(p => p.id === id)) {
        return res.status(409).json({ error: 'Ya existe un cliente con ese telefono' })
      }
      const nuevo = {
        id,
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

  // PUT /api/clientes/:id -> guarda/edita la capa extra de un cliente
  // (tanto si viene de `pisos` como si es de alta manual)
  app.put('/api/clientes/:id', async (req, res) => {
    try {
      const id = req.params.id
      const extraMap = await cargarExtra()
      const existente = extraMap[id]
      const actualizado = {
        id,
        nombre: req.body.nombre || '',
        telefono: req.body.telefono || '',
        email: req.body.email || '',
        direccion: req.body.direccion || '',
        comunidad: req.body.comunidad || '',
        piso: req.body.piso || '',
        notas: req.body.notas || '',
        documentos: req.body.documentos || '[]',
        fecha_alta: (existente && existente.fecha_alta) || new Date().toISOString().slice(0, 10),
      }
      if (existente) {
        await escribirFila(`clientes!A${existente._fila}:J${existente._fila}`, objetoAFila(actualizado))
      } else {
        await anadirFila(objetoAFila(actualizado))
      }
      res.json(actualizado)
    } catch (e) {
      console.error('[clientes] PUT /api/clientes/:id', e)
      res.status(500).json({ error: 'Error actualizando el cliente' })
    }
  })
}
