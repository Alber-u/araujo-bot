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

// Importamos el módulo de catálogo SOLO para acceder a su función `recargar`,
// que invalida la caché en memoria del catálogo cuando modificamos el JSON
// directamente desde aquí (fusionar productos, crear-bulk, asociar-bulk, etc.).
// Si el módulo no expone `recargar` (versión vieja), usamos un noop para no romper.
let recargarCatalogo = async () => {};
try {
  const catModule = require("./ara-catalogo.cjs");
  if (catModule && typeof catModule.recargar === "function") {
    recargarCatalogo = catModule.recargar;
  } else {
    console.warn("[ara-facturas] ara-catalogo.cjs no expone recargar(). La caché del catálogo no se invalidará tras escribir.");
  }
} catch (e) {
  console.warn("[ara-facturas] No se pudo cargar ara-catalogo.cjs:", e.message);
}

// Helper: escribe el catálogo Y recarga la caché del módulo de catálogo
// para que los siguientes GET /public devuelvan los datos actualizados.
async function saveCatalogo(catFilePath, catData) {
  await fs.writeFile(catFilePath, JSON.stringify(catData, null, 2), "utf8");
  try {
    await recargarCatalogo();
  } catch (e) {
    console.warn("[ara-facturas] error al recargar caché de catálogo:", e.message);
  }
}

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
  const refFact = (lineaFactura.referencia_proveedor || "").trim();

  // 1. REFERENCIA EXACTA — búsqueda más fiable, sin margen de error
  if (refFact) {
    const porRef = catalogo.find(p =>
      p.proveedores?.[proveedorId]?.ref &&
      p.proveedores[proveedorId].ref.trim() === refFact
    );
    if (porRef) return [{ producto: porRef, confianza: 99, aprendida: false, porRef: true }];
  }

  // 2. EQUIVALENCIAS APRENDIDAS — confirmaciones anteriores del usuario
  const eqAprendida = equivalencias.find(e =>
    e.proveedorId === proveedorId &&
    (e.referencia_proveedor === refFact ||
     e.descripcion_proveedor?.toLowerCase() === lineaFactura.descripcion_original?.toLowerCase())
  );
  if (eqAprendida) {
    const prod = catalogo.find(p => p.id === eqAprendida.producto_id);
    if (prod) return [{ producto: prod, confianza: 95, aprendida: true }];
  }

  // 3. SIMILITUD DE TEXTO — último recurso
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

  // Parser JSON propio del módulo — garantiza que req.body siempre se parsea
  // independientemente del orden de middlewares en el servidor principal
  router.use(express.json({ limit: "10mb" }));

  // CORS abierto para el frontend
  router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Middleware PIN — valida contra ara-catalogo.json
  async function checkPin(req, res, next) {
    const pin = req.headers["x-admin-pin"] || req.query.pin;
    if (!pin) return res.status(401).json({ error: "PIN requerido" });
    try {
      const catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
      // PIN guardado en d.pinAdmin
      const adminPin = catData.pinAdmin;
      if (!adminPin) return res.status(401).json({ error: "PIN no configurado" });
      if (String(pin) !== String(adminPin)) return res.status(401).json({ error: "PIN incorrecto" });
      next();
    } catch (e) {
      console.error("[ara-facturas] checkPin error:", e.message);
      return res.status(500).json({ error: "Error validando PIN" });
    }
  }

  // ── SUBIR FACTURA ──────────────────────────────────────
  router.post("/subir", checkPin, upload.single("factura"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });

      const d = await db();

      // Calcular hash SHA-256 del archivo para detectar duplicados exactos
      const fileBuffer = await fs.readFile(req.file.path);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Comprobar si ya existe una factura con el mismo hash
      const duplicada = (d.facturas || []).find(f => f.hash === hash);
      if (duplicada) {
        // Borrar el archivo recién subido (es un duplicado)
        try { await fs.unlink(req.file.path); } catch {}
        return res.status(409).json({
          error: "Esta factura ya está subida",
          motivo: "archivo_duplicado",
          facturaExistente: {
            id: duplicada.id,
            archivoOriginal: duplicada.archivoOriginal,
            fechaSubida: duplicada.fechaSubida,
            proveedor: duplicada.datosExtraidos?.proveedor,
            numero_factura: duplicada.datosExtraidos?.numero_factura,
            estado: duplicada.estado
          }
        });
      }

      const facturaId = "fac-" + crypto.randomBytes(4).toString("hex");

      const nuevaFactura = {
        id: facturaId,
        archivo: req.file.filename,
        archivoOriginal: req.file.originalname,
        mimetype: req.file.mimetype,
        tamaño: req.file.size,
        hash, // ← guardar hash para futuros checks
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

      // Comprobar si esta factura (proveedor + nº) ya existe en otra
      // (puede ser un reescaneo del mismo PDF físico con hash distinto)
      const numFact = (datos.numero_factura || "").trim();
      const provFact = (datos.proveedor || "").trim().toLowerCase();
      if (numFact && provFact) {
        const duplicada = d.facturas.find(f =>
          f.id !== factura.id &&
          f.estado !== "error" &&
          (f.datosExtraidos?.numero_factura || "").trim() === numFact &&
          (f.datosExtraidos?.proveedor || "").trim().toLowerCase() === provFact
        );
        if (duplicada) {
          // Marcar como error y borrar para no contaminar la BD
          factura.estado = "error";
          factura.errorMsg = `Factura duplicada: ya existe ${numFact} de ${datos.proveedor} (subida el ${new Date(duplicada.fechaSubida).toLocaleDateString("es-ES")}).`;
          await save();
          return res.status(409).json({
            error: factura.errorMsg,
            motivo: "factura_duplicada",
            facturaExistente: {
              id: duplicada.id,
              archivoOriginal: duplicada.archivoOriginal,
              fechaSubida: duplicada.fechaSubida,
              proveedor: duplicada.datosExtraidos?.proveedor,
              numero_factura: duplicada.datosExtraidos?.numero_factura,
              estado: duplicada.estado
            }
          });
        }
      }

      // Cargar catálogo para comparar
      let catalogo = [];
      let catData = null;
      let equivalencias = d.equivalencias || [];
      try {
        catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
        catalogo = catData.productos || [];
      } catch { /* catálogo vacío */ }

      // Detectar proveedor — buscar en lista de proveedores del catálogo
      const proveedorNombreFact = (datos.proveedor || "").toLowerCase();
      let proveedorId = null;
      let proveedorDesconocido = null;

      // Intentar match con proveedores existentes
      const proveedoresList = catData?.proveedores || [];
      for (const prov of proveedoresList) {
        const nomProv = (prov.nombre || "").toLowerCase();
        if (nomProv.includes(proveedorNombreFact.substring(0,5)) ||
            proveedorNombreFact.includes(nomProv.substring(0,5)) ||
            nomProv.split(" ").some(w => w.length > 3 && proveedorNombreFact.includes(w))) {
          proveedorId = prov.id;
          break;
        }
      }

      // Fallback hardcoded
      if (!proveedorId) {
        if (proveedorNombreFact.includes("aqua")) proveedorId = "aqua";
        else if (proveedorNombreFact.includes("aram") || proveedorNombreFact.includes("guzm")) proveedorId = "aram";
      }

      // Si sigue sin detectarse, marcar como desconocido para que el usuario lo cree
      if (!proveedorId) {
        proveedorId = "nuevo_" + crypto.randomBytes(2).toString("hex");
        proveedorDesconocido = {
          nombreDetectado: datos.proveedor,
          cifDetectado: datos.cif_proveedor || "",
          sugerenciaId: proveedorId
        };
      }

      factura.proveedorDesconocido = proveedorDesconocido;

      // Crear líneas de revisión
      factura.lineasRevision = (datos.lineas || []).map((l, idx) => {
        const sugerencias = buscarEquivalencias(l, catalogo, equivalencias, proveedorId);
        const mejor = sugerencias[0] || null;

        // Calcular precio neto aplicando descuento
        const bruto = parseFloat(l.precio_unitario) || 0;
        const dto   = parseFloat(l.descuento) || 0;
        const precioNeto = dto > 0 ? +(bruto * (1 - dto / 100)).toFixed(4) : bruto;

        // Detectar si el producto ya existe y comparar precio actual
        let precioActual = null;
        let variacionPrecio = null;
        if (mejor?.producto) {
          const prod = mejor.producto;
          const provData = prod.proveedores?.[proveedorId];
          if (provData) {
            // Precio actual en catálogo (ya es neto)
            const netoActual = provData.dto > 0
              ? +(provData.bruto * (1 - provData.dto / 100)).toFixed(4)
              : provData.bruto;
            precioActual = netoActual;
            const diff = precioNeto - netoActual;
            const pct = netoActual > 0 ? +((diff / netoActual) * 100).toFixed(1) : 0;
            variacionPrecio = { diff: +diff.toFixed(4), pct, sube: diff > 0.001, baja: diff < -0.001 };
          }
        }

        // Lógica de estado automático:
        //   confianza >= 90% Y variación <= 50% → confirmado (auto)
        //   confianza >= 90% Y variación > 50%  → revisar (subida sospechosa)
        //   confianza < 50% Y variación > 200%  → match basura, mejor crear nuevo
        //   confianza > 0  Y < 90%              → pendiente (decide el usuario)
        //   confianza == 0 (sin sugerencia)     → nuevo (claramente no existe)
        const conf = mejor?.confianza || 0;
        const pctAbs = Math.abs(variacionPrecio?.pct || 0);

        // Detectar matches absurdos: baja confianza + variación irreal
        // (la IA emparejó productos sin relación real, mejor descartar la sugerencia)
        const esMatchBasura = conf > 0 && conf < 50 && pctAbs > 200;

        let estadoAuto;
        let productoFinal = mejor?.producto?.id || null;
        let confianzaFinal = conf;
        let variacionFinal = variacionPrecio;
        let precioActualFinal = precioActual;
        let sugerenciasFinales = sugerencias;

        if (esMatchBasura) {
          // Descartar match absurdo y tratar como producto realmente nuevo
          estadoAuto = "nuevo";
          productoFinal = null;
          confianzaFinal = 0;
          variacionFinal = null;
          precioActualFinal = null;
          sugerenciasFinales = [];
        } else if (conf >= 90 && pctAbs <= 50)      estadoAuto = "confirmado";
        else if (conf >= 90 && pctAbs > 50)  estadoAuto = "revisar";
        else if (conf > 0)                   estadoAuto = "pendiente";
        else                                 estadoAuto = "nuevo";

        return {
          idx,
          lineaOriginal: l,
          productoSugerido: productoFinal,
          confianza: confianzaFinal,
          aprendida: mejor?.aprendida || false,
          sugerencias: sugerenciasFinales.map(s => ({ id: s.producto.id, desc: s.producto.desc, confianza: s.confianza })),
          estado: estadoAuto,
          precioUnitarioBruto: bruto,
          descuento: dto,
          precioUnitarioNeto: precioNeto,
          precioActual: precioActualFinal,
          variacionPrecio: variacionFinal,
          tieneEnCatalogo: precioActualFinal !== null,
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

  // ── CREAR PROVEEDOR DESDE FACTURA ─────────────────────
  router.post("/crear-proveedor/:facturaId", checkPin, async (req, res) => {
    try {
      const d = await db();
      const factura = d.facturas.find(f => f.id === req.params.facturaId);
      if (!factura) return res.status(404).json({ error: "Factura no encontrada" });

      const { nombre, formaPago, color, email } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });

      // Crear proveedor en ara-catalogo.json
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));
      if (!catData.proveedores) catData.proveedores = [];

      const nuevoId = "prov-" + crypto.randomBytes(3).toString("hex");
      const nuevoProv = { id: nuevoId, nombre: nombre.trim(), formaPago: formaPago || "Contado", color: color || "blue", email: email || "", activo: true };
      catData.proveedores.push(nuevoProv);
      await saveCatalogo(catFilePath, catData);

      // Actualizar la factura con el nuevo proveedorId
      const viejoId = factura.proveedorDetectado;
      factura.proveedorDetectado = nuevoId;
      factura.proveedorDesconocido = null;
      // Actualizar proveedorId en todas las líneas
      (factura.lineasRevision || []).forEach(l => {
        if (l.proveedorId === viejoId) l.proveedorId = nuevoId;
      });
      await save();

      res.json({ ok: true, proveedor: nuevoProv, factura });
    } catch (e) {
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

      // Re-aplicación: si la factura ya estaba completada, lo registramos
      const esReaplicacion = factura.estado === "completado";

      // Validación: no permitir aplicar si hay líneas sin decidir
      // (a menos que el body traiga forzar:true para casos especiales)
      const sinDecidir = (factura.lineasRevision || []).filter(l =>
        l.estado === "pendiente" || l.estado === "revisar"
      );
      if (sinDecidir.length > 0 && !req.body?.forzar) {
        return res.status(400).json({
          error: `Hay ${sinDecidir.length} líneas sin decidir (pendiente/revisar). Decide cada una antes de aplicar, o envía {"forzar": true} para ignorarlas.`,
          sinDecidir: sinDecidir.length
        });
      }

      // Cargar catálogo
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));
      let actualizados = 0, nuevos = 0, ignorados = 0, saltados = 0;

      for (const linea of factura.lineasRevision) {
        if (linea.estado === "ignorado") { ignorados++; continue; }
        // Pendiente y revisar se saltan si llegamos aquí con forzar:true
        if (linea.estado === "pendiente" || linea.estado === "revisar") { saltados++; continue; }

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

            // Marcar la línea como APLICADA (para que futuras revisiones del análisis
            // ya no la vean como pendiente o nueva)
            linea.aplicada = true;
            linea.fechaAplicacion = new Date().toISOString();

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

          // FIX CRÍTICO: ahora la línea apunta al producto recién creado.
          // Sin esto, el modal Análisis volvía a verla como "nuevo" aunque ya estuviese creado.
          linea.productoSugerido = nuevoId;
          linea.confianza = 100;
          linea.aprendida = true;
          linea.aplicada = true;
          linea.fechaAplicacion = new Date().toISOString();

          // Recalcular variación de precio respecto al nuevo producto creado
          // (precioActual del producto que acabamos de crear es el mismo precio facturado,
          // así que la variación queda en 0 — la línea pasa a contar como "confirmada y sin variación")
          linea.precioActual = linea.precioUnitarioNeto || l.precio_unitario;
          linea.tieneEnCatalogo = true;
          linea.variacionPrecio = { diff: 0, pct: 0, sube: false, baja: false };

          // Guardar equivalencia (sobrescribe si ya existía una mala)
          const eqExist = d.equivalencias.findIndex(e =>
            e.proveedorId === prov && e.referencia_proveedor === l.referencia_proveedor
          );
          const eq = {
            proveedorId: prov,
            referencia_proveedor: l.referencia_proveedor,
            descripcion_proveedor: l.descripcion_original,
            producto_id: nuevoId,
            confianza_validada: 100,
            validado: true,
            fecha: new Date().toISOString()
          };
          if (eqExist >= 0) d.equivalencias[eqExist] = eq;
          else d.equivalencias.push(eq);
        }
      }

      // Guardar catálogo actualizado
      await saveCatalogo(catFilePath, catData);

      factura.estado = "completado";
      factura.resumen = { actualizados, nuevos, ignorados, saltados };

      // Historial de aplicaciones (para auditar)
      if (!factura.historialAplicaciones) factura.historialAplicaciones = [];
      factura.historialAplicaciones.push({
        fecha: new Date().toISOString(),
        actualizados, nuevos, ignorados, saltados,
        reaplicacion: esReaplicacion
      });

      await save();

      res.json({ ok: true, actualizados, nuevos, ignorados, saltados, esReaplicacion });
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

  // ── EQUIVALENCIAS APRENDIDAS ───────────────────────────
  // Listar todas las equivalencias aprendidas (con info enriquecida del producto)
  router.get("/equivalencias", checkPin, async (req, res) => {
    try {
      const d = await db();
      const equivalencias = d.equivalencias || [];

      // Cargar catálogo y proveedores para enriquecer la respuesta
      let catData = null;
      try {
        catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
      } catch { catData = { productos: [], proveedores: [] }; }

      const enriquecidas = equivalencias.map((eq, idx) => {
        const prod = catData.productos.find(p => p.id === eq.producto_id);
        const prov = catData.proveedores?.find(p => p.id === eq.proveedorId);
        return {
          idx, // índice posicional (para borrar/editar)
          ...eq,
          producto_desc: prod?.desc || "(producto no encontrado)",
          producto_familia: prod?.familia || "",
          proveedor_nombre: prov?.nombre || eq.proveedorId
        };
      });

      res.json(enriquecidas);
    } catch (e) {
      console.error("[ara-facturas] equivalencias listar error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Borrar una equivalencia aprendida (por índice posicional)
  router.delete("/equivalencias/:idx", checkPin, async (req, res) => {
    try {
      const d = await db();
      const idx = parseInt(req.params.idx);
      if (isNaN(idx) || idx < 0 || idx >= (d.equivalencias || []).length) {
        return res.status(400).json({ error: "Índice de equivalencia inválido" });
      }
      const borrada = d.equivalencias.splice(idx, 1)[0];
      await save();
      res.json({ ok: true, borrada });
    } catch (e) {
      console.error("[ara-facturas] equivalencias borrar error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Cambiar a qué producto apunta una equivalencia (corregir match malo)
  router.put("/equivalencias/:idx", checkPin, async (req, res) => {
    try {
      const d = await db();
      const idx = parseInt(req.params.idx);
      const { producto_id } = req.body || {};
      if (isNaN(idx) || idx < 0 || idx >= (d.equivalencias || []).length) {
        return res.status(400).json({ error: "Índice de equivalencia inválido" });
      }
      if (!producto_id) {
        return res.status(400).json({ error: "Falta producto_id en el body" });
      }
      // Validar que el producto existe
      let catData = null;
      try {
        catData = JSON.parse(await fs.readFile(path.join(DATA_DIR, "ara-catalogo.json"), "utf8"));
      } catch { return res.status(500).json({ error: "No se pudo leer el catálogo" }); }
      const prod = catData.productos.find(p => p.id === producto_id);
      if (!prod) return res.status(400).json({ error: "Producto no existe en el catálogo" });

      d.equivalencias[idx] = {
        ...d.equivalencias[idx],
        producto_id,
        confianza_validada: 100,
        validado: true,
        fecha: new Date().toISOString(),
        editadaManualmente: true
      };
      await save();
      res.json({ ok: true, equivalencia: d.equivalencias[idx] });
    } catch (e) {
      console.error("[ara-facturas] equivalencias editar error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── CREAR PRODUCTO desde el modal Análisis (con bulk de apariciones) ───
  // Recibe: { descripcion, familia, unidad, referenciaProveedor, proveedorId, precioFacturado, apariciones: [{facturaId, lineaIdx}] }
  // Crea UN producto, marca todas las apariciones como aplicadas con ese producto, aprende la equivalencia.
  router.post("/crear-producto-bulk", checkPin, async (req, res) => {
    try {
      const { descripcion, familia, unidad, referenciaProveedor, proveedorId, precioFacturado, apariciones } = req.body || {};
      if (!descripcion || !proveedorId || !Array.isArray(apariciones) || apariciones.length === 0) {
        return res.status(400).json({ error: "Faltan datos: descripcion, proveedorId o apariciones" });
      }

      const d = await db();
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));

      // Crear producto nuevo
      const nuevoId = "prod-" + crypto.randomBytes(4).toString("hex");
      const nuevoProd = {
        id: nuevoId,
        desc: descripcion,
        familia: familia || "Varios",
        unidad: unidad || "uni",
        img: "tapon",
        proveedores: {
          [proveedorId]: {
            ref: referenciaProveedor || "",
            bruto: precioFacturado || 0,
            dto: 0,
            marca: "—"
          }
        }
      };
      catData.productos.push(nuevoProd);
      await saveCatalogo(catFilePath, catData);

      // Marcar todas las apariciones como aplicadas
      let lineasMarcadas = 0;
      const ahora = new Date().toISOString();
      for (const ap of apariciones) {
        const f = d.facturas.find(x => x.id === ap.facturaId);
        if (!f) continue;
        const linea = (f.lineasRevision || [])[ap.lineaIdx];
        if (!linea) continue;
        linea.estado = "nuevo"; // por consistencia, aunque ya esté aplicada
        linea.productoSugerido = nuevoId;
        linea.confianza = 100;
        linea.aprendida = true;
        linea.aplicada = true;
        linea.fechaAplicacion = ahora;
        linea.tieneEnCatalogo = true;
        linea.precioActual = linea.precioUnitarioNeto || linea.lineaOriginal?.precio_unitario;
        linea.variacionPrecio = { diff: 0, pct: 0, sube: false, baja: false };
        lineasMarcadas++;
      }

      // Aprender equivalencia (sobrescribe si ya había una mala)
      if (referenciaProveedor) {
        const eqExist = d.equivalencias.findIndex(e =>
          e.proveedorId === proveedorId && e.referencia_proveedor === referenciaProveedor
        );
        const eq = {
          proveedorId,
          referencia_proveedor: referenciaProveedor,
          descripcion_proveedor: descripcion,
          producto_id: nuevoId,
          confianza_validada: 100,
          validado: true,
          fecha: ahora
        };
        if (eqExist >= 0) d.equivalencias[eqExist] = eq;
        else d.equivalencias.push(eq);
      }

      await save();

      res.json({
        ok: true,
        productoId: nuevoId,
        productoDesc: descripcion,
        lineasMarcadas,
        mensaje: `Producto "${descripcion}" creado y asociado a ${lineasMarcadas} línea${lineasMarcadas === 1 ? "" : "s"} en facturas.`
      });
    } catch (e) {
      console.error("[ara-facturas] crear-producto-bulk error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── ASOCIAR a producto EXISTENTE desde el modal Análisis ────────────────
  // Caso: la línea aparecía como "nuevo" pero en realidad el producto ya existía en el catálogo.
  // Recibe: { productoId, referenciaProveedor, proveedorId, precioFacturado, apariciones: [{facturaId, lineaIdx}] }
  // NO crea producto, asocia las apariciones al producto existente.
  // Actualiza el precio del producto en ese proveedor con el último precio facturado.
  router.post("/asociar-producto-bulk", checkPin, async (req, res) => {
    try {
      const { productoId, referenciaProveedor, proveedorId, precioFacturado, apariciones } = req.body || {};
      if (!productoId || !proveedorId || !Array.isArray(apariciones) || apariciones.length === 0) {
        return res.status(400).json({ error: "Faltan datos: productoId, proveedorId o apariciones" });
      }

      const d = await db();
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));
      const prod = catData.productos.find(p => p.id === productoId);
      if (!prod) return res.status(404).json({ error: "Producto no encontrado en el catálogo" });

      // Actualizar el precio del producto para ese proveedor
      if (!prod.proveedores) prod.proveedores = {};
      prod.proveedores[proveedorId] = {
        ref: referenciaProveedor || prod.proveedores[proveedorId]?.ref || "",
        bruto: precioFacturado || prod.proveedores[proveedorId]?.bruto || 0,
        dto: 0,
        marca: prod.proveedores[proveedorId]?.marca || "—"
      };
      await saveCatalogo(catFilePath, catData);

      // Marcar apariciones como aplicadas y asociar al productoId
      let lineasMarcadas = 0;
      const ahora = new Date().toISOString();
      for (const ap of apariciones) {
        const f = d.facturas.find(x => x.id === ap.facturaId);
        if (!f) continue;
        const linea = (f.lineasRevision || [])[ap.lineaIdx];
        if (!linea) continue;
        linea.estado = "confirmado";
        linea.productoSugerido = productoId;
        linea.confianza = 100;
        linea.aprendida = true;
        linea.aplicada = true;
        linea.fechaAplicacion = ahora;
        linea.tieneEnCatalogo = true;
        linea.precioActual = precioFacturado || linea.precioUnitarioNeto;
        linea.variacionPrecio = { diff: 0, pct: 0, sube: false, baja: false };
        lineasMarcadas++;
      }

      // Aprender equivalencia
      if (referenciaProveedor) {
        const eqExist = d.equivalencias.findIndex(e =>
          e.proveedorId === proveedorId && e.referencia_proveedor === referenciaProveedor
        );
        const eq = {
          proveedorId,
          referencia_proveedor: referenciaProveedor,
          descripcion_proveedor: prod.desc,
          producto_id: productoId,
          confianza_validada: 100,
          validado: true,
          fecha: ahora
        };
        if (eqExist >= 0) d.equivalencias[eqExist] = eq;
        else d.equivalencias.push(eq);
      }

      await save();

      res.json({
        ok: true,
        productoId,
        productoDesc: prod.desc,
        lineasMarcadas,
        mensaje: `Apariciones asociadas al producto "${prod.desc}" (${lineasMarcadas} línea${lineasMarcadas === 1 ? "" : "s"}).`
      });
    } catch (e) {
      console.error("[ara-facturas] asociar-producto-bulk error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── FUSIONAR DOS PRODUCTOS DUPLICADOS ───────────────────
  // Recibe: { ganadorId, perdedorId, conflictosResueltos: { proveedorId: "ganador"|"perdedor" } }
  //
  // Operaciones (atómicas — si falla algo, no se guarda nada):
  // 1. Mueve proveedores únicos del perdedor al ganador
  // 2. Para proveedores en conflicto, usa la decisión del usuario
  // 3. Redirige equivalencias: las que apuntan al perdedor pasan a apuntar al ganador
  // 4. Redirige líneas de factura: las que tenían productoSugerido=perdedor pasan al ganador
  // 5. Borra el perdedor del catálogo
  router.post("/fusionar-productos", checkPin, async (req, res) => {
    try {
      const { ganadorId, perdedorId, conflictosResueltos } = req.body || {};
      if (!ganadorId || !perdedorId) {
        return res.status(400).json({ error: "Faltan ganadorId o perdedorId" });
      }
      if (ganadorId === perdedorId) {
        return res.status(400).json({ error: "ganadorId y perdedorId no pueden ser iguales" });
      }

      const d = await db();
      const catFilePath = path.join(DATA_DIR, "ara-catalogo.json");
      const catData = JSON.parse(await fs.readFile(catFilePath, "utf8"));

      const ganador = catData.productos.find(p => p.id === ganadorId);
      const perdedor = catData.productos.find(p => p.id === perdedorId);
      if (!ganador) return res.status(404).json({ error: "Producto ganador no encontrado: " + ganadorId });
      if (!perdedor) return res.status(404).json({ error: "Producto perdedor no encontrado: " + perdedorId });

      // ── Paso 1+2: Fusionar proveedores ──
      const provsAntes = { ...(ganador.proveedores || {}) };
      const provsPerdedor = perdedor.proveedores || {};
      const conflictos = [];
      const movidos = []; // proveedores que se han movido al ganador
      const sobreescritos = []; // proveedores donde el perdedor "ganó" en el conflicto

      if (!ganador.proveedores) ganador.proveedores = {};
      for (const [provId, datosPerdedor] of Object.entries(provsPerdedor)) {
        const yaTiene = ganador.proveedores[provId];
        if (!yaTiene) {
          // No conflicto: simplemente copiar
          ganador.proveedores[provId] = { ...datosPerdedor };
          movidos.push(provId);
        } else {
          // Comprobar si los datos son IGUALES (con tolerancia para precios)
          const refIgual = (yaTiene.ref || "") === (datosPerdedor.ref || "");
          const precioIgual = Math.abs((yaTiene.bruto || 0) - (datosPerdedor.bruto || 0)) <= 0.001;
          if (refIgual && precioIgual) {
            // Datos idénticos: no es conflicto, ganador ya tiene los datos buenos
            continue;
          }
          // Conflicto real: el usuario tuvo que decidir
          const decision = conflictosResueltos?.[provId];
          if (decision === "perdedor") {
            ganador.proveedores[provId] = { ...datosPerdedor };
            sobreescritos.push(provId);
          } else if (decision === "ganador") {
            // No tocar, ganador ya lo tiene
            // (no hacemos nada)
          } else {
            // Conflicto sin resolver
            conflictos.push({
              proveedorId: provId,
              ganador: ganador.proveedores[provId],
              perdedor: datosPerdedor
            });
          }
        }
      }

      if (conflictos.length > 0) {
        // Devolver conflictos al frontend para que el usuario decida
        return res.status(409).json({
          error: "Hay conflictos sin resolver",
          conflictos,
          mensaje: `Ambos productos tienen estos proveedores. Elige cuál mantener para cada uno.`
        });
      }

      // ── Paso 3: Redirigir equivalencias ──
      let equivalenciasRedirigidas = 0;
      for (const eq of (d.equivalencias || [])) {
        if (eq.producto_id === perdedorId) {
          eq.producto_id = ganadorId;
          equivalenciasRedirigidas++;
        }
      }

      // ── Paso 4: Redirigir líneas de facturas ──
      let lineasRedirigidas = 0;
      for (const f of (d.facturas || [])) {
        for (const linea of (f.lineasRevision || [])) {
          if (linea.productoSugerido === perdedorId) {
            linea.productoSugerido = ganadorId;
            lineasRedirigidas++;
          }
        }
      }

      // ── Paso 5: Borrar el perdedor del catálogo ──
      const totalAntes = catData.productos.length;
      catData.productos = catData.productos.filter(p => p.id !== perdedorId);
      const totalDespues = catData.productos.length;
      const seBorroProducto = totalDespues < totalAntes;

      console.log(`[ara-facturas] fusionar: antes=${totalAntes}, despues=${totalDespues}, perdedorId=${perdedorId}, seBorro=${seBorroProducto}`);

      if (!seBorroProducto) {
        return res.status(500).json({
          error: `BUG: No se pudo borrar el perdedor. ID enviado: "${perdedorId}". Antes: ${totalAntes} productos, después: ${totalDespues}. El ID del perdedor no coincide con ningún producto del catálogo.`
        });
      }

      // Guardar TODO atómicamente (si alguno falla, lanzamos y no se guarda nada)
      await saveCatalogo(catFilePath, catData);
      await save(); // guarda d (facturas + equivalencias)

      res.json({
        ok: true,
        ganadorId,
        ganadorDesc: ganador.desc,
        perdedorId,
        perdedorDesc: perdedor.desc,
        proveedoresMovidos: movidos,
        proveedoresSobreescritos: sobreescritos,
        equivalenciasRedirigidas,
        lineasRedirigidas,
        productosAntes: totalAntes,
        productosDespues: totalDespues,
        mensaje: `Fusión completada: "${perdedor.desc}" → "${ganador.desc}". Catálogo: ${totalAntes} → ${totalDespues} productos. ${movidos.length} proveedor${movidos.length === 1 ? "" : "es"} movido${movidos.length === 1 ? "" : "s"}, ${equivalenciasRedirigidas} equivalencia${equivalenciasRedirigidas === 1 ? "" : "s"} y ${lineasRedirigidas} línea${lineasRedirigidas === 1 ? "" : "s"} de factura redirigidas.`
      });
    } catch (e) {
      console.error("[ara-facturas] fusionar-productos error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── MIGRACIÓN: marcar líneas ya aplicadas ───────────────
  // Para facturas que se aplicaron ANTES del fix, las líneas no tienen el flag
  // `aplicada=true`. Este endpoint recorre todas las facturas completadas y las marca,
  // resolviendo además el `productoSugerido` para las líneas que se aplicaron como "nuevo".
  // Es idempotente: ejecutarlo varias veces no causa daño.
  router.post("/migrar/marcar-aplicadas", checkPin, async (req, res) => {
    try {
      const d = await db();
      const equivalencias = d.equivalencias || [];
      let facturasTocadas = 0, lineasMarcadas = 0, productoSugeridoFijado = 0;

      for (const factura of d.facturas) {
        if (factura.estado !== "completado") continue;
        let tocada = false;
        for (const linea of (factura.lineasRevision || [])) {
          // Solo procesamos líneas con estado que indica que se aplicaron
          if (linea.estado !== "confirmado" && linea.estado !== "nuevo") continue;
          // Si ya está marcada, saltamos (idempotencia)
          if (linea.aplicada) continue;

          linea.aplicada = true;
          linea.fechaAplicacion = factura.historialAplicaciones?.[0]?.fecha || factura.fechaSubida;
          lineasMarcadas++;

          // Para líneas en estado "nuevo" que no tengan productoSugerido,
          // buscamos en las equivalencias el producto que se creó
          if (linea.estado === "nuevo" && !linea.productoSugerido) {
            const refProv = linea.lineaOriginal?.referencia_proveedor;
            const provId = linea.proveedorId;
            if (refProv && provId) {
              const eq = equivalencias.find(e =>
                e.proveedorId === provId &&
                e.referencia_proveedor === refProv
              );
              if (eq?.producto_id) {
                linea.productoSugerido = eq.producto_id;
                linea.confianza = 100;
                linea.aprendida = true;
                linea.tieneEnCatalogo = true;
                // El precio actual es el que se guardó al crear el producto
                linea.precioActual = linea.precioUnitarioNeto || linea.lineaOriginal?.precio_unitario;
                linea.variacionPrecio = { diff: 0, pct: 0, sube: false, baja: false };
                productoSugeridoFijado++;
              }
            }
          }
          tocada = true;
        }
        if (tocada) facturasTocadas++;
      }

      if (facturasTocadas > 0) await save();

      res.json({
        ok: true,
        facturasTocadas,
        lineasMarcadas,
        productoSugeridoFijado,
        mensaje: facturasTocadas === 0
          ? "Todas las facturas ya estaban correctamente marcadas. No había nada que migrar."
          : `Migración completada: ${facturasTocadas} facturas tocadas, ${lineasMarcadas} líneas marcadas como aplicadas, ${productoSugeridoFijado} productos asociados a líneas que estaban como "nuevo".`
      });
    } catch (e) {
      console.error("[ara-facturas] migrar marcar-aplicadas error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/facturas", router);
  console.log("[ara-facturas] Módulo cargado. Facturas en:", UPLOADS_DIR);
};
