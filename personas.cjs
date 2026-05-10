// =========================================================
// PERSONAS — Módulo plug-in para araujo-bot
// 
// Sigue el mismo patrón que ara-catalogo.cjs y documentacion.cjs:
//   require("./personas.cjs")(app);
// 
// Expone bajo /api/personas/* el CRUD del módulo Personas.
// Lee y escribe directamente sobre la pestaña `personas` del
// Google Sheet maestro (mismo Sheet donde viven `comunidades`,
// `pisos`, `vecinos_base`...).
// 
// Filosofía:
//   - El Sheet es la fuente de verdad. Si tu compañero o tú editáis
//     directamente en Google Sheets, los cambios se ven.
//   - ARA OS escribe a través de este backend para que la lógica
//     (validación, ids únicos, no borrar de verdad sino marcar baja)
//     viva centralizada.
// 
// Endpoints:
//   GET    /api/personas              → listado (sin económico)
//   GET    /api/personas/:id          → ficha de una persona
//   POST   /api/personas              → crear (requiere PIN)
//   PUT    /api/personas/:id          → editar (requiere PIN)
//   POST   /api/personas/:id/baja     → poner fecha_baja (requiere PIN)
//   POST   /api/personas/:id/reactivar→ vaciar fecha_baja (requiere PIN)
// 
// Acceso:
//   - Lectura: pública. Devuelve campos NO sensibles (sin DNI, IBAN,
//     emergencia, salario, etc.). Si el cliente envía PIN admin
//     correcto en query (?pin=XXXX), devuelve también campos sensibles.
//   - Escritura: requiere PIN admin (mismo que catálogo).
// =========================================================

const { google } = require("googleapis");

// =========================================================
// CONFIG
// =========================================================
const RANGO_PERSONAS = "personas!A:T";  // 20 columnas (A-T)

// Orden de columnas — debe coincidir EXACTAMENTE con la fila 1 del Sheet.
// Si añades una columna nueva al Sheet, añádela aquí también AL FINAL.
const COLS = [
  "id",                  // A
  "nombre",              // B
  "dni",                 // C  ← sensible
  "fecha_nacimiento",    // D
  "puesto",              // E
  "rol",                 // F
  "telefono",            // G
  "email",               // H
  "fecha_alta",          // I
  "fecha_baja",          // J
  "pin",                 // K  ← sensible
  "carpeta_drive",       // L
  "emergencia_nombre",   // M  ← sensible
  "emergencia_telefono", // N  ← sensible
  "iban",                // O  ← sensible
  "talla_calzado",       // P
  "talla_pantalon",      // Q
  "talla_camiseta",      // R
  "vehiculo_asignado",   // S
  "notas",               // T
];

// Campos NO sensibles que devuelve la API pública (sin PIN).
// El resto se omite en la respuesta cuando el cliente no se autentica.
const CAMPOS_PUBLICOS = new Set([
  "id", "nombre", "puesto", "rol", "telefono", "email",
  "fecha_alta", "fecha_baja",
  "talla_calzado", "talla_pantalon", "talla_camiseta",
  "vehiculo_asignado", "notas",
]);

// =========================================================
// HELPERS
// =========================================================
function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: "v4", auth });
}

async function leerHoja(rango) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: rango,
  });
  return res.data.values || [];
}

// Convierte una fila del Sheet (array de strings) en objeto
function filaAObjeto(fila) {
  const o = {};
  COLS.forEach((k, i) => { o[k] = (fila[i] || "").toString().trim(); });
  return o;
}

// Convierte un objeto persona en array de strings para el Sheet
function objetoAFila(persona) {
  return COLS.map(k => (persona[k] != null ? String(persona[k]) : ""));
}

// Filtra los campos sensibles si el cliente no es admin
function ocultarCamposSensibles(persona) {
  const limpia = {};
  for (const k of Object.keys(persona)) {
    if (CAMPOS_PUBLICOS.has(k)) limpia[k] = persona[k];
  }
  return limpia;
}

// =========================================================
// ID GENERATOR
// =========================================================
// Los ids son del estilo "p1", "p2"... (incremental). Cuando se crea
// una persona nueva, buscamos el siguiente número libre.
// 
// Importante: para los operarios que ya existen en el catálogo
// (op1, op2...) mantenemos su id antiguo para no romper pedidos
// históricos. Por eso el generador busca un id que no esté usado,
// independientemente del prefijo.
function siguienteId(personasExistentes) {
  // Empieza en p1 e incrementa hasta encontrar uno libre
  const usados = new Set(personasExistentes.map(p => p.id));
  let i = 1;
  while (usados.has("p" + i)) i++;
  return "p" + i;
}

// =========================================================
// MAIN
// =========================================================
module.exports = function setupPersonas(app) {

  const PIN_ADMIN = process.env.ADMIN_TOKEN || "araujo2026";

  // Middleware mini: ¿es admin?
  function esAdmin(req) {
    const pin = req.query.pin || req.body?.pin || req.headers["x-admin-pin"];
    return pin && pin === PIN_ADMIN;
  }

  function checkAdmin(req, res, next) {
    if (!esAdmin(req)) {
      return res.status(401).json({ error: "PIN admin requerido" });
    }
    next();
  }

  // CORS abierto · ARA OS está en otro dominio (ara-os.onrender.com)
  app.use("/api/personas", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Parse body JSON solo en este router (no afecta al resto del backend)
  const express = require("express");
  app.use("/api/personas", express.json({ limit: "1mb" }));

  // -------------------------------------------------------
  // GET /api/personas
  //   Lista todas las personas. Si ?activos=1, filtra los que
  //   tienen fecha_baja vacía. Si ?pin=XXXX correcto, devuelve
  //   también campos sensibles.
  // -------------------------------------------------------
  app.get("/api/personas", async (req, res) => {
    try {
      const filas = await leerHoja(RANGO_PERSONAS);
      // Saltamos la cabecera (fila 0)
      const datos = filas.slice(1)
        .map(filaAObjeto)
        .filter(p => p.id);  // descartar filas completamente vacías

      let lista = datos;
      if (req.query.activos === "1") {
        lista = lista.filter(p => !p.fecha_baja);
      }

      const admin = esAdmin(req);
      const respuesta = lista.map(p => admin ? p : ocultarCamposSensibles(p));

      res.json({
        personas: respuesta,
        total: respuesta.length,
        admin,
      });
    } catch (e) {
      console.error("[personas] GET error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------
  // GET /api/personas/:id
  // -------------------------------------------------------
  app.get("/api/personas/:id", async (req, res) => {
    try {
      const filas = await leerHoja(RANGO_PERSONAS);
      const datos = filas.slice(1).map(filaAObjeto);
      const persona = datos.find(p => p.id === req.params.id);
      if (!persona) return res.status(404).json({ error: "Persona no encontrada" });

      const admin = esAdmin(req);
      res.json(admin ? persona : ocultarCamposSensibles(persona));
    } catch (e) {
      console.error("[personas] GET /:id error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------
  // POST /api/personas    (crear)
  //   Body: objeto con los campos. id se genera si no se pasa.
  //   Validación mínima: nombre y rol obligatorios.
  // -------------------------------------------------------
  app.post("/api/personas", checkAdmin, async (req, res) => {
    try {
      const datos = req.body || {};
      if (!datos.nombre || !datos.nombre.trim()) {
        return res.status(400).json({ error: "El nombre es obligatorio" });
      }
      if (!datos.rol || !["operario", "encargado", "oficina", "admin"].includes(datos.rol)) {
        return res.status(400).json({ error: "Rol inválido. Debe ser: operario, encargado, oficina o admin" });
      }

      // Cargar lista actual para generar id único
      const filas = await leerHoja(RANGO_PERSONAS);
      const personasExistentes = filas.slice(1).map(filaAObjeto).filter(p => p.id);

      // Si el cliente envía un id, respetarlo (siempre que no exista ya)
      // Si no, generarlo
      let id = (datos.id || "").trim();
      if (id) {
        if (personasExistentes.find(p => p.id === id)) {
          return res.status(409).json({ error: "Ya existe una persona con ese id" });
        }
      } else {
        id = siguienteId(personasExistentes);
      }

      // Construir el objeto completo respetando el orden de COLS
      const nueva = { ...datos, id };
      // Si no se pasa fecha_alta, ponerla a hoy (formato YYYY-MM-DD)
      if (!nueva.fecha_alta) {
        nueva.fecha_alta = new Date().toISOString().slice(0, 10);
      }
      // fecha_baja siempre vacía al crear
      nueva.fecha_baja = "";

      const fila = objetoAFila(nueva);

      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: RANGO_PERSONAS,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({ ok: true, persona: nueva });
    } catch (e) {
      console.error("[personas] POST error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------
  // PUT /api/personas/:id    (editar)
  //   Body: campos a modificar. Solo se actualizan los que llegan.
  // -------------------------------------------------------
  app.put("/api/personas/:id", checkAdmin, async (req, res) => {
    try {
      const filas = await leerHoja(RANGO_PERSONAS);
      // Buscar la fila exacta (1-indexed para Sheets, +1 por la cabecera)
      let indice = -1;
      for (let i = 1; i < filas.length; i++) {
        if ((filas[i][0] || "").trim() === req.params.id) {
          indice = i;
          break;
        }
      }
      if (indice === -1) return res.status(404).json({ error: "Persona no encontrada" });

      const original = filaAObjeto(filas[indice]);
      const cambios = req.body || {};

      // No permitir cambiar el id
      delete cambios.id;
      // No permitir cambiar fecha_alta una vez creada (solo via reactivar)
      // (excepción: si está vacía, sí dejar)
      if (original.fecha_alta && cambios.fecha_alta) {
        delete cambios.fecha_alta;
      }

      // Validaciones
      if (cambios.rol && !["operario", "encargado", "oficina", "admin"].includes(cambios.rol)) {
        return res.status(400).json({ error: "Rol inválido" });
      }

      const actualizada = { ...original, ...cambios };
      const fila = objetoAFila(actualizada);

      const sheets = getSheetsClient();
      // Sheets es 1-indexed y la cabecera es la fila 1, así que indice+1 = fila correcta
      const filaSheet = indice + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `personas!A${filaSheet}:T${filaSheet}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({ ok: true, persona: actualizada });
    } catch (e) {
      console.error("[personas] PUT error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------
  // POST /api/personas/:id/baja
  //   Marca fecha_baja con la fecha indicada (o hoy si vacía).
  //   No borra la fila — el histórico se mantiene.
  // -------------------------------------------------------
  app.post("/api/personas/:id/baja", checkAdmin, async (req, res) => {
    try {
      const fecha = (req.body?.fecha || new Date().toISOString().slice(0, 10)).trim();
      // Reusar PUT internamente
      req.body = { fecha_baja: fecha };
      // Forzar el flujo
      const filas = await leerHoja(RANGO_PERSONAS);
      let indice = -1;
      for (let i = 1; i < filas.length; i++) {
        if ((filas[i][0] || "").trim() === req.params.id) { indice = i; break; }
      }
      if (indice === -1) return res.status(404).json({ error: "Persona no encontrada" });

      const original = filaAObjeto(filas[indice]);
      const actualizada = { ...original, fecha_baja: fecha };
      const fila = objetoAFila(actualizada);

      const sheets = getSheetsClient();
      const filaSheet = indice + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `personas!A${filaSheet}:T${filaSheet}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({ ok: true, persona: actualizada });
    } catch (e) {
      console.error("[personas] baja error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------
  // POST /api/personas/:id/reactivar
  //   Vacía fecha_baja. Útil si una persona vuelve.
  // -------------------------------------------------------
  app.post("/api/personas/:id/reactivar", checkAdmin, async (req, res) => {
    try {
      const filas = await leerHoja(RANGO_PERSONAS);
      let indice = -1;
      for (let i = 1; i < filas.length; i++) {
        if ((filas[i][0] || "").trim() === req.params.id) { indice = i; break; }
      }
      if (indice === -1) return res.status(404).json({ error: "Persona no encontrada" });

      const original = filaAObjeto(filas[indice]);
      const actualizada = { ...original, fecha_baja: "" };
      const fila = objetoAFila(actualizada);

      const sheets = getSheetsClient();
      const filaSheet = indice + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `personas!A${filaSheet}:T${filaSheet}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });

      res.json({ ok: true, persona: actualizada });
    } catch (e) {
      console.error("[personas] reactivar error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[personas] Módulo cargado. Endpoints en /api/personas/*");
};
