// =========================================================
// ARA Facturas — Módulo de importación de facturas con IA
//
// Registrar con: require("./ara-facturas.cjs")(app);
//
// Expone bajo /api/facturas/*:
//   - Subida de facturas PDF/JPG/PNG
//   - Extracción automática con Claude AI
//   - Bandeja de revisión manual
//   - Confirmación y actualización de precios en catálogo
// =========================================================

const express  = require("express");
const fs       = require("node:fs/promises");
const fsSync   = require("node:fs");
const path     = require("node:path");
const crypto   = require("node:crypto");
const multer   = require("multer");

// =========================================================
// CONFIG
// =========================================================
function resolveDataDir() {
  const candidates = ["/var/data", path.join(process.cwd(), "data")];
  for (const dir of candidates) {
    try {
      fsSync.mkdirSync(dir, { recursive: true });
      const testFile = path.join(dir, ".write-test");
      fsSync.writeFileSync(testFile, "ok");
      fsSync.unlinkSync(testFile);
      return dir;
    } catch (e) { /* siguiente */ }
  }
  return require("os").tmpdir();
}

const DATA_DIR      = resolveDataDir();
const DATA_FILE     = path.join(DATA_DIR, "ara-facturas.json");
const UPLOADS_DIR   = path.join(DATA_DIR, "facturas");

// Crear carpeta de uploads si no existe
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

// =========================================================
// PERSISTENCIA
// =========================================================
let _cache = null;

async function db() {
  if (_cache) return _cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    _cache = JSON.parse(raw);
  } catch {
    _cache = { facturas: [], equivalencias: [] };
    await save();
  }
  return _cache;
}

async function save() {
  await fs.writeFile(DATA_FILE, JSON.stringify(_cache, null, 2), "utf8");
}

// =========================================================
// MULTER — subida de archivos
// =========================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `factura-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// =========================================================
// CLAUDE AI — extracción de factura
// =========================================================
async function extraerFacturaConIA(filePath, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const fileBuffer = await fs.readFile(filePath);
  const base64 = fileBuffer.toString("base64");

  const esPDF = mediaType === "application/pdf";

  const prompt = `Eres un asistente especializado en extraer datos de facturas de materiales de fontanería y construcción.

Analiza esta factura y extrae TODA la información en formato JSON. Sé muy preciso con los números.

Devuelve ÚNICAMENTE el JSON, sin texto adicional, sin markdown, sin explicaciones.

Formato requerido:
{
  "proveedor": "nombre del proveedor",
  "cif_proveedor": "CIF o NIF si aparece",
  "numero_factura": "número de factura",
  "fecha": "fecha en formato YYYY-MM-DD",
  "base_imponible": 0.00,
  "iva": 0.00,
  "total": 0.00,
  "lineas": [
    {
      "referencia_proveedor": "ref",
      "descripcion_original": "descripción completa",
      "cantidad": 0,
      "unidad": "ud/m/kg/etc",
      "precio_unitario": 0.000,
      "descuento": 0,
      "importe_linea": 0.00
    }
  ]
}

Extrae TODAS las líneas de producto. Si hay descuentos por línea, inclúyelos. Si el precio unitario no está claro, calcula desde cantidad e importe.`;

  const body = {
    model: "claude-opus-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          esPDF
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: prompt }
        ]
      }
    ]
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content.map(c => c.text || "").join("").trim();

  // Limpiar posibles markdown fences
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("No se pudo parsear la respuesta de Claude: " + text.substring(0, 200));
  }
}

// =========================================================
// COMPARACIÓN CON CATÁLOGO
// =========================================================
function calcularConfianza(lineaFactura, productoCatalogo) {
  let score = 0;
  const descFact = (lineaFactura.descripcion_original || "").toLowerCase();
  const descCat  = (productoCatalogo.desc || "").toLowerCase();
  const refFact  = (lineaFactura.referencia_proveedor || "").toLowerCase();

  // Coincidencia por referencia (peso alto)
  const refs = Object.values(productoCatalogo.proveedores || {}).map(p => (p.ref || "").toLowerCase());
  if (refs.some(r => r && r === refFact)) score += 50;
  else if (refs.some(r => r && refFact && r.includes(refFact))) score += 30;

  // Coincidencia por palabras clave de descripción
  const palabrasCat  = descCat.split(/\s+/).filter(w => w.length > 3);
  const palabrasFact = descFact.split(/\s+/).filter(w => w.length > 3);
  const coincidencias = palabrasCat.filter(w => palabrasFact.includes(w)).length;
  const totalPalabras = Math.max(palabrasCat.length, 1);
  score += Math.round((coincidencias / totalPalabras) * 40);

  // Bonificación si coincide la unidad
  if (lineaFactura.unidad && productoCatalogo.unidad) {
    const uFact = lineaFactura.unidad.toLowerCase();
    const uCat  = productoCatalogo.unidad.toLowerCase();
    if (uFact === uCat || (uFact === "m" && (uCat === "rollo" || uCat === "barra"))) score += 10;
  }

  return Math.min(score, 100);
}

function buscarEquivalencias(lineaFactura, catalogo, equivalencias, proveedorId) {
  // 1. Buscar en equivalencias aprendidas
  const eqAprendida = equivalencias.find(e =>
    e.proveedorId === proveedorId &&
    (e.referencia_proveedor === lineaFactura.referencia_proveedor ||
     e.descripcion_proveedor?.toLowerCase() === lineaFactura.descripcion_original?.toLowerCase())
  );

  if (eqAprendida) {
    const prod = catalogo.find(p => p.id === eqAprendida.producto_id);
    if (prod) return [{ producto: prod, confianza: 95, aprendida: true }];
  }

  // 2. Buscar por similitud en catálogo
  const resultados = catalogo
    .map(p => ({ producto: p, confianza: calcularConfianza(lineaFactura, p) }))
    .filter(r => r.confianza >= 30)
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, 3);

  return resultados;
}

// =========================================================
// MÓDULO EXPRESS
// =========================================================
module.exports = function(app) {
  const router = express.Router();

  // CORS abierto para el frontend
  router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Middleware PIN (reutilizamos la misma lógica)
  async function checkPin(req, res, next) {
    const pin = req.headers["x-admin-pin"] || req.query.pin;
    // Leer PIN desde ara-catalogo data
    try {
      const catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
      const adminPin = catData.configEmail?.adminPin || catData.adminPin || "0000";
      if (String(pin) !== String(adminPin)) return res.status(401).json({ error: "PIN incorrecto" });
      next();
    } catch {
      return res.status(500).json({ error: "Error validando PIN" });
    }
  }

  // ── SUBIR FACTURA ──────────────────────────────────────
  router.post("/subir", checkPin, upload.single("factura"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });

      const d = await db();
      const facturaId = "fac-" + crypto.randomBytes(4).toString("hex");

      const nuevaFactura = {
        id: facturaId,
        archivo: req.file.filename,
        archivoOriginal: req.file.originalname,
        mimetype: req.file.mimetype,
        tamaño: req.file.size,
        fechaSubida: new Date().toISOString(),
        estado: "pendiente_extraccion",
        datosExtraidos: null,
        lineasRevision: []
      };

      d.facturas.push(nuevaFactura);
      await save();

      res.json({ ok: true, facturaId, factura: nuevaFactura });
    } catch (e) {
      console.error("[ara-facturas] subir error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── EXTRAER CON IA ─────────────────────────────────────
  router.post("/extraer/:id", checkPin, async (req, res) => {
    try {
      const d = await db();
      const factura = d.facturas.find(f => f.id === req.params.id);
      if (!factura) return res.status(404).json({ error: "Factura no encontrada" });

      const filePath = path.join(UPLOADS_DIR, factura.archivo);

      // Determinar media type
      let mediaType = factura.mimetype;
      if (factura.archivo.endsWith(".pdf")) mediaType = "application/pdf";
      else if (factura.archivo.endsWith(".jpg") || factura.archivo.endsWith(".jpeg")) mediaType = "image/jpeg";
      else if (factura.archivo.endsWith(".png")) mediaType = "image/png";
      else if (factura.archivo.endsWith(".webp")) mediaType = "image/webp";

      factura.estado = "extrayendo";
      await save();

      const datos = await extraerFacturaConIA(filePath, mediaType);
      factura.datosExtraidos = datos;

      // Cargar catálogo para comparar
      let catalogo = [];
      let equivalencias = d.equivalencias || [];
      try {
        const catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
        catalogo = catData.productos || [];
      } catch { /* catálogo vacío */ }

      // Detectar proveedor
      const proveedorNombre = (datos.proveedor || "").toLowerCase();
      const proveedorId = proveedorNombre.includes("aqua") ? "aqua"
        : proveedorNombre.includes("aram") ? "aram"
        : "desconocido";

      // Crear líneas de revisión
      factura.lineasRevision = (datos.lineas || []).map((l, idx) => {
        const sugerencias = buscarEquivalencias(l, catalogo, equivalencias, proveedorId);
        const mejor = sugerencias[0] || null;
        return {
          idx,
          lineaOriginal: l,
          productoSugerido: mejor?.producto?.id || null,
          confianza: mejor?.confianza || 0,
          aprendida: mejor?.aprendida || false,
          sugerencias: sugerencias.map(s => ({ id: s.producto.id, desc: s.producto.desc, confianza: s.confianza })),
          estado: "pendiente", // pendiente | confirmado | nuevo | ignorado
          precioUnitarioNeto: l.precio_unitario,
          proveedorId
        };
      });

      factura.proveedorDetectado = proveedorId;
      factura.estado = "pendiente_revision";
      await save();

      res.json({ ok: true, factura });
    } catch (e) {
      console.error("[ara-facturas] extraer error:", e);
      const d = await db();
      const factura = d.facturas.find(f => f.id === req.params.id);
      if (factura) { factura.estado = "error"; factura.errorMsg = e.message; await save(); }
      res.status(500).json({ error: e.message });
    }
  });

  // ── LISTAR FACTURAS ────────────────────────────────────
  router.get("/lista", checkPin, async (req, res) => {
    const d = await db();
    res.json(d.facturas.slice().reverse());
  });

  // ── VER FACTURA ────────────────────────────────────────
  router.get("/ver/:id", checkPin, async (req, res) => {
    const d = await db();
    const factura = d.facturas.find(f => f.id === req.params.id);
    if (!factura) return res.status(404).json({ error: "No encontrada" });
    res.json(factura);
  });

  // ── ACTUALIZAR LÍNEA DE REVISIÓN ───────────────────────
  router.put("/linea/:facturaId/:idx", checkPin, async (req, res) => {
    try {
      const d = await db();
      const factura = d.facturas.find(f => f.id === req.params.facturaId);
      if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
      const idx = parseInt(req.params.idx);
      if (!factura.lineasRevision[idx]) return res.status(404).json({ error: "Línea no encontrada" });
      Object.assign(factura.lineasRevision[idx], req.body);
      await save();
      res.json(factura.lineasRevision[idx]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── CONFIRMAR Y APLICAR AL CATÁLOGO ───────────────────
  router.post("/confirmar/:id", checkPin, async (req, res) => {
    try {
      const d = await db();
      const factura = d.facturas.find(f => f.id === req.params.id);
      if (!factura) return res.status(404).json({ error: "Factura no encontrada" });

      // Cargar catálogo
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));
      let actualizados = 0, nuevos = 0, ignorados = 0;

      for (const linea of factura.lineasRevision) {
        if (linea.estado === "ignorado") { ignorados++; continue; }

        const prov = linea.proveedorId;
        const l = linea.lineaOriginal;

        if (linea.estado === "confirmado" && linea.productoSugerido) {
          // Actualizar precio en producto existente
          const prod = catData.productos.find(p => p.id === linea.productoSugerido);
          if (prod) {
            if (!prod.proveedores) prod.proveedores = {};
            prod.proveedores[prov] = {
              ref: l.referencia_proveedor || prod.proveedores[prov]?.ref || "",
              bruto: linea.precioUnitarioNeto || l.precio_unitario,
              dto: 0,
              marca: prod.proveedores[prov]?.marca || "—"
            };
            actualizados++;

            // Guardar equivalencia aprendida
            const eqExist = d.equivalencias.findIndex(e =>
              e.proveedorId === prov && e.referencia_proveedor === l.referencia_proveedor
            );
            const eq = {
              proveedorId: prov,
              referencia_proveedor: l.referencia_proveedor,
              descripcion_proveedor: l.descripcion_original,
              producto_id: linea.productoSugerido,
              confianza_validada: linea.confianza,
              validado: true,
              fecha: new Date().toISOString()
            };
            if (eqExist >= 0) d.equivalencias[eqExist] = eq;
            else d.equivalencias.push(eq);
          }
        } else if (linea.estado === "nuevo") {
          // Crear producto nuevo
          const nuevoId = "prod-" + crypto.randomBytes(4).toString("hex");
          const nuevoProd = {
            id: nuevoId,
            desc: linea.descripcionPersonalizada || l.descripcion_original,
            familia: linea.familiaPersonalizada || "Varios",
            unidad: l.unidad || "uni",
            img: "tapon",
            proveedores: {
              [prov]: {
                ref: l.referencia_proveedor || "",
                bruto: linea.precioUnitarioNeto || l.precio_unitario,
                dto: 0,
                marca: "—"
              }
            }
          };
          catData.productos.push(nuevoProd);
          nuevos++;

          // Guardar equivalencia
          d.equivalencias.push({
            proveedorId: prov,
            referencia_proveedor: l.referencia_proveedor,
            descripcion_proveedor: l.descripcion_original,
            producto_id: nuevoId,
            confianza_validada: 100,
            validado: true,
            fecha: new Date().toISOString()
          });
        }
      }

      // Guardar catálogo actualizado
      await fs.writeFile(catFilePath, JSON.stringify(catData, null, 2), "utf8");

      factura.estado = "completado";
      factura.resumen = { actualizados, nuevos, ignorados };
      await save();

      res.json({ ok: true, actualizados, nuevos, ignorados });
    } catch (e) {
      console.error("[ara-facturas] confirmar error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── ELIMINAR FACTURA ───────────────────────────────────
  router.delete("/factura/:id", checkPin, async (req, res) => {
    try {
      const d = await db();
      const idx = d.facturas.findIndex(f => f.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: "No encontrada" });
      const factura = d.facturas[idx];
      // Borrar archivo físico
      try { await fs.unlink(path.join(UPLOADS_DIR, factura.archivo)); } catch { /* ya no existe */ }
      d.facturas.splice(idx, 1);
      await save();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/facturas", router);
  console.log("[ara-facturas] Módulo cargado. Facturas en:", UPLOADS_DIR);
};
