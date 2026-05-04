// =========================================================
// ARA Catálogo — Módulo plug-in para araujo-bot
// 
// Sigue el mismo patrón que presupuestos.cjs y documentacion.cjs:
// se registra haciendo  require("./ara-catalogo.cjs")(app);
// 
// Expone bajo /api/catalogo/* un backend completo:
//   - Datos del catálogo (productos, obras, operarios)
//   - Pedidos (creación, histórico)
//   - Productos no listados pendientes de validación
//   - Obras nuevas creadas por operarios
//   - Panel admin protegido por PIN
//   - Envío de pedidos por email a proveedores (vía Resend, opcional)
// 
// Persistencia: archivo JSON en disco. En Render usa /var/data si existe,
// si no usa ./data dentro del propio araujo-bot.
// =========================================================

const express = require("express");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { CATALOGO } = require("./ara-catalogo-data.cjs");

// =========================================================
// CONFIG
// =========================================================
// Carpeta donde guardar el JSON. Probamos varias en orden de preferencia:
//   1. /var/data   → si existe (Render con disco)
//   2. ./data      → relativo al cwd
function resolveDataDir() {
  const candidates = ["/var/data", path.join(process.cwd(), "data")];
  for (const dir of candidates) {
    try {
      fsSync.mkdirSync(dir, { recursive: true });
      // Test de escritura
      const testFile = path.join(dir, ".write-test");
      fsSync.writeFileSync(testFile, "ok");
      fsSync.unlinkSync(testFile);
      return dir;
    } catch (e) { /* probamos siguiente */ }
  }
  // Último recurso: tmp
  return require("os").tmpdir();
}

const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, "ara-catalogo.json");

// Resend (opcional) – solo se inicializa si la API key está disponible
let resend = null;
try {
  if (process.env.ARA_RESEND_API_KEY) {
    const { Resend } = require("resend");
    resend = new Resend(process.env.ARA_RESEND_API_KEY);
  }
} catch (e) {
  console.log("[ara-catalogo] Resend no instalado, los envíos por email quedan desactivados");
}
const FROM_EMAIL = process.env.ARA_FROM_EMAIL || "onboarding@resend.dev";

// =========================================================
// SEED (datos iniciales si la BBDD no existe)
// =========================================================
const SEED = {
  pinAdmin: "1234",
  datosCliente: {
    razonSocial: "ARA Corporate Sociedad de Inversiones, SL",
    cif: "B90488222",
    direccion: "Avd San Francisco Javier 9 P6 M9, 41018 Sevilla",
    telefono: "640527426",
    email: "infom4@gmail.com",
    formaPago: "Recibo domiciliado · 60 días",
    cuenta: "****************2567"
  },
  configEmail: {
    emailAquatubo: "",
    emailAramburu: "",
    emailCC: "infom4@gmail.com",
    nombreFirma: "ARA Corporate",
    telefonoFirma: "640527426",
    activo: false
  },
  operarios: [
    { id: "op-1", nombre: "Antonio Ramírez Romero", activo: true },
    { id: "op-2", nombre: "Miguel Ángel Espada Pérez", activo: true },
    { id: "op-3", nombre: "Miguel Ángel Espada Rebollo", activo: true },
    { id: "op-4", nombre: "Juan García", activo: true },
    { id: "op-5", nombre: "Pedro Fernández", activo: true },
    { id: "op-6", nombre: "Manuel López", activo: true }
  ],
  obras: [
    { id: "JP17", nombre: "Juan Pablos Edif. 17", dir: "Calle Juan Pablos 17, Sevilla", activa: true },
    { id: "DF20", nombre: "Doña Francisquita 20", dir: "Calle Doña Francisquita 20, Sevilla", activa: true },
    { id: "OL67", nombre: "Ntra. Sra. Oliva 67", dir: "Bda. Ntra. Sra. de la Oliva 67, Sevilla", activa: true },
    { id: "OLE2", nombre: "Ntra. Sra. Oliva Edif. 2", dir: "Bda. Ntra. Sra. de la Oliva Edif. 2, Sevilla", activa: true },
    { id: "OL94", nombre: "C/ Virgen de la Oliva 94", dir: "C/ Virgen de la Oliva 94, Sevilla", activa: true },
    { id: "RT9",  nombre: "Rodrigo de Triana 9", dir: "Rodrigo de Triana 9, Sevilla", activa: true },
    { id: "GO21", nombre: "Calle Goya 21", dir: "Calle Goya 21, Sevilla", activa: true },
    { id: "DF39", nombre: "Doctor Fedriani 39", dir: "Doctor Fedriani 39, Sevilla", activa: true },
    { id: "PD1",  nombre: "Plaza Duendes 1", dir: "Plaza Duendes 1, Sevilla", activa: true },
    { id: "PG13", nombre: "Plaza Generalife 13", dir: "Plaza Generalife 13, Sevilla", activa: true },
    { id: "RS9",  nombre: "Regimiento de Soria 9", dir: "Regimiento de Soria 9, Sevilla", activa: true },
    { id: "AT1",  nombre: "Astronomía Torre 1", dir: "Calle Astronomía Torre 1, Sevilla", activa: true },
    { id: "AG7",  nombre: "C/ Ágata Edif. 7", dir: "C/ Ágata Edif. 7, Sevilla", activa: true },
    { id: "VV18", nombre: "Virgen del Valle 18", dir: "Calle Virgen del Valle 18, Sevilla", activa: true },
    { id: "BT20", nombre: "Calle Betis 20", dir: "Calle Betis 20, Sevilla", activa: true }
  ],
  productos: CATALOGO,
  pedidos: [],
  productosPendientes: [],
  obrasPendientes: []
};

// =========================================================
// PERSISTENCIA
// =========================================================
let cache = null;

async function loadData() {
  try {
    const text = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(text);
  } catch (e) {
    console.log("[ara-catalogo] Inicializando BBDD con datos semilla en", DATA_FILE);
    await fs.writeFile(DATA_FILE, JSON.stringify(SEED, null, 2));
    return JSON.parse(JSON.stringify(SEED));
  }
}

async function db() {
  if (!cache) cache = await loadData();
  return cache;
}

async function save() {
  if (!cache) return;
  await fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 2));
}

const genId = () => crypto.randomBytes(4).toString("hex");

// =========================================================
// EXPORTACIÓN: función plug-in para Express
// =========================================================
module.exports = function(app) {
  // Crear un router específico para el módulo (no tocar el app global)
  const router = express.Router();

  // Body parser JSON para nuestras rutas (sin afectar al resto)
  router.use(express.json({ limit: "5mb" }));

  // CORS abierto para que el frontend de Render pueda llamar
  router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Middleware: validar PIN admin
  async function checkPin(req, res, next) {
    const pin = req.headers["x-admin-pin"] || req.query.pin;
    const d = await db();
    if (!pin || pin !== d.pinAdmin) {
      return res.status(401).json({ error: "PIN incorrecto" });
    }
    next();
  }

  // ---------------- RUTAS PÚBLICAS ----------------

  router.get("/health", (req, res) => res.json({ ok: true, ts: Date.now(), modulo: "ara-catalogo" }));

  router.get("/public", async (req, res) => {
    try {
      const d = await db();
      res.json({
        productos: d.productos,
        obras: d.obras.filter(o => o.activa !== false),
        operarios: d.operarios.filter(o => o.activo !== false),
        datosCliente: d.datosCliente
      });
    } catch (e) {
      console.error("[ara-catalogo] /public error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Crear obra nueva (cualquier operario puede)
  router.post("/obra-nueva", async (req, res) => {
    try {
      const { nombre, dir, creadaPor } = req.body;
      if (!nombre || nombre.trim().length < 2) {
        return res.status(400).json({ error: "Nombre de obra inválido" });
      }
      const d = await db();
      const obra = {
        id: "obra-" + genId(),
        nombre: nombre.trim(),
        dir: (dir || "").trim(),
        activa: true,
        creadaPor: creadaPor || "anónimo",
        creadaEn: new Date().toISOString(),
        pendienteValidar: true
      };
      d.obras.push(obra);
      d.obrasPendientes.push({ ...obra });
      await save();
      res.json(obra);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pedir producto NO listado
  router.post("/producto-no-listado", async (req, res) => {
    try {
      const { desc, cantidad, unidad, proveedor, foto, pedidoPor, obra } = req.body;
      if (!desc || !cantidad) return res.status(400).json({ error: "Faltan datos" });
      const d = await db();
      const item = {
        id: "pendiente-" + genId(),
        desc: desc.trim(),
        cantidad: parseFloat(cantidad),
        unidad: unidad || "uni",
        proveedor: proveedor || "indistinto",
        foto: foto || null,
        pedidoPor: pedidoPor || "anónimo",
        obra: obra || null,
        creadoEn: new Date().toISOString(),
        estado: "pendiente"
      };
      d.productosPendientes.push(item);
      await save();
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Enviar pedido
  router.post("/enviar-pedido", async (req, res) => {
    try {
      const { operario, obra, lineasAqua, lineasAram, lineasNoListado, notas } = req.body;
      const d = await db();

      if (!operario || !obra) {
        return res.status(400).json({ error: "Faltan datos del pedido" });
      }
      if ((!lineasAqua || lineasAqua.length === 0) &&
          (!lineasAram || lineasAram.length === 0) &&
          (!lineasNoListado || lineasNoListado.length === 0)) {
        return res.status(400).json({ error: "El pedido está vacío" });
      }

      const pedido = {
        id: "ped-" + genId(),
        operario, obra,
        lineasAqua: lineasAqua || [],
        lineasAram: lineasAram || [],
        lineasNoListado: lineasNoListado || [],
        notas: notas || "",
        fecha: new Date().toISOString(),
        enviadoPorEmail: false,
        erroresEmail: []
      };

      const enviados = [];
      const errores = [];

      if (d.configEmail.activo && resend) {
        if (lineasAqua && lineasAqua.length > 0) {
          try {
            await enviarEmailProveedor("aqua", pedido, d);
            enviados.push("aqua");
          } catch (e) {
            errores.push({ proveedor: "aqua", error: e.message });
          }
        }
        if (lineasAram && lineasAram.length > 0) {
          try {
            await enviarEmailProveedor("aram", pedido, d);
            enviados.push("aram");
          } catch (e) {
            errores.push({ proveedor: "aram", error: e.message });
          }
        }
      }

      pedido.enviadoPorEmail = enviados.length > 0;
      pedido.erroresEmail = errores;
      pedido.proveedoresEnviados = enviados;
      d.pedidos.push(pedido);
      await save();

      res.json({
        pedidoId: pedido.id,
        enviados,
        errores,
        emailConfigurado: d.configEmail.activo,
        aviso: !d.configEmail.activo
          ? "El envío por email no está configurado. El pedido se ha guardado en el sistema."
          : null
      });
    } catch (e) {
      console.error("[ara-catalogo] enviar-pedido error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------- RUTAS ADMIN ----------------

  router.post("/admin/login", async (req, res) => {
    const { pin } = req.body;
    const d = await db();
    if (pin === d.pinAdmin) return res.json({ ok: true });
    res.status(401).json({ error: "PIN incorrecto" });
  });

  router.post("/admin/cambiar-pin", checkPin, async (req, res) => {
    const { nuevoPin } = req.body;
    if (!nuevoPin || !/^\d{4,8}$/.test(nuevoPin)) {
      return res.status(400).json({ error: "El PIN debe ser de 4 a 8 dígitos" });
    }
    const d = await db();
    d.pinAdmin = nuevoPin;
    await save();
    res.json({ ok: true });
  });

  router.get("/admin/all", checkPin, async (req, res) => {
    const d = await db();
    res.json(d);
  });

  // === PRODUCTOS ===
  router.put("/admin/producto/:id", checkPin, async (req, res) => {
    const d = await db();
    const idx = d.productos.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "No encontrado" });
    d.productos[idx] = { ...d.productos[idx], ...req.body };
    await save();
    res.json(d.productos[idx]);
  });
  router.post("/admin/producto", checkPin, async (req, res) => {
    const d = await db();
    const nuevo = { id: "p-" + genId(), ...req.body };
    d.productos.push(nuevo);
    await save();
    res.json(nuevo);
  });
  router.delete("/admin/producto/:id", checkPin, async (req, res) => {
    const d = await db();
    d.productos = d.productos.filter(p => p.id !== req.params.id);
    await save();
    res.json({ ok: true });
  });

  // === OBRAS ===
  router.put("/admin/obra/:id", checkPin, async (req, res) => {
    const d = await db();
    const idx = d.obras.findIndex(o => o.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "No encontrada" });
    d.obras[idx] = { ...d.obras[idx], ...req.body };
    if (d.obras[idx].pendienteValidar === false) {
      d.obrasPendientes = d.obrasPendientes.filter(o => o.id !== req.params.id);
    }
    await save();
    res.json(d.obras[idx]);
  });
  router.delete("/admin/obra/:id", checkPin, async (req, res) => {
    const d = await db();
    d.obras = d.obras.filter(o => o.id !== req.params.id);
    d.obrasPendientes = d.obrasPendientes.filter(o => o.id !== req.params.id);
    await save();
    res.json({ ok: true });
  });
  router.post("/admin/obra", checkPin, async (req, res) => {
    const d = await db();
    const nueva = { id: "obra-" + genId(), activa: true, pendienteValidar: false, ...req.body };
    d.obras.push(nueva);
    await save();
    res.json(nueva);
  });

  // === OPERARIOS ===
  router.post("/admin/operario", checkPin, async (req, res) => {
    const d = await db();
    const nuevo = { id: "op-" + genId(), activo: true, ...req.body };
    d.operarios.push(nuevo);
    await save();
    res.json(nuevo);
  });
  router.put("/admin/operario/:id", checkPin, async (req, res) => {
    const d = await db();
    const idx = d.operarios.findIndex(o => o.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "No encontrado" });
    d.operarios[idx] = { ...d.operarios[idx], ...req.body };
    await save();
    res.json(d.operarios[idx]);
  });
  router.delete("/admin/operario/:id", checkPin, async (req, res) => {
    const d = await db();
    d.operarios = d.operarios.filter(o => o.id !== req.params.id);
    await save();
    res.json({ ok: true });
  });

  // === PRODUCTOS PENDIENTES ===
  router.post("/admin/pendiente/:id/validar", checkPin, async (req, res) => {
    const d = await db();
    const pend = d.productosPendientes.find(p => p.id === req.params.id);
    if (!pend) return res.status(404).json({ error: "No encontrado" });
    const nuevo = { id: "p-" + genId(), ...req.body };
    d.productos.push(nuevo);
    pend.estado = "validado";
    pend.productoCreado = nuevo.id;
    await save();
    res.json({ producto: nuevo });
  });
  router.post("/admin/pendiente/:id/descartar", checkPin, async (req, res) => {
    const d = await db();
    const pend = d.productosPendientes.find(p => p.id === req.params.id);
    if (!pend) return res.status(404).json({ error: "No encontrado" });
    pend.estado = "descartado";
    await save();
    res.json({ ok: true });
  });

  // === CONFIG EMAIL ===
  router.put("/admin/config-email", checkPin, async (req, res) => {
    const d = await db();
    d.configEmail = { ...d.configEmail, ...req.body };
    await save();
    res.json(d.configEmail);
  });

  // === DATOS CLIENTE ===
  router.put("/admin/datos-cliente", checkPin, async (req, res) => {
    const d = await db();
    d.datosCliente = { ...d.datosCliente, ...req.body };
    await save();
    res.json(d.datosCliente);
  });

  // === HISTÓRICO PEDIDOS ===
  router.get("/admin/pedidos", checkPin, async (req, res) => {
    const d = await db();
    res.json(d.pedidos);
  });

  // ---------------- MONTAR EN APP ----------------
  app.use("/api/catalogo", router);

  // Inicializar BBDD al cargar (no esperamos)
  db().catch(e => console.error("[ara-catalogo] error inicializando BBDD:", e));

  console.log("[ara-catalogo] Módulo cargado. Datos en:", DATA_FILE);
};

// =========================================================
// FUNCIÓN AUXILIAR: envío email
// =========================================================
function formatearLineas(lineas) {
  return lineas.map(l => {
    const ref = (l.ref || "—").padEnd(14);
    const desc = (l.desc || "").substring(0, 40).padEnd(40);
    const cant = String(l.cantidad).padStart(6);
    const importe = (l.importe ? "€" + l.importe.toFixed(2) : "—").padStart(10);
    return `  ${cant} ${ref} ${desc} ${importe}`;
  }).join("\n");
}

async function enviarEmailProveedor(prov, pedido, d) {
  const isAqua = prov === "aqua";
  const lineas = isAqua ? pedido.lineasAqua : pedido.lineasAram;
  const proveedorNombre = isAqua ? "Aquatubo SL" : "Aramburu Guzmán SLU";
  const emailProveedor = isAqua ? d.configEmail.emailAquatubo : d.configEmail.emailAramburu;

  if (!emailProveedor) throw new Error(`Sin email para ${proveedorNombre}`);

  const subtotal = lineas.reduce((s, l) => s + (l.importe || 0), 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const noListadas = (pedido.lineasNoListado || []).filter(
    l => l.proveedor === prov || l.proveedor === "indistinto"
  );

  const cuerpo = `Buenos días,

Solicitamos el siguiente material para nuestra obra. Por favor confirmar disponibilidad y plazo de entrega.

══════════════════════════════════════════════════════
DATOS DEL PEDIDO
══════════════════════════════════════════════════════
Obra:           ${pedido.obra.nombre}
Dirección:      ${pedido.obra.dir}
Solicita:       ${pedido.operario}
Fecha:          ${new Date(pedido.fecha).toLocaleDateString("es-ES", { dateStyle: "long" })}

══════════════════════════════════════════════════════
LÍNEAS
══════════════════════════════════════════════════════
   Cant Ref            Descripción                              Importe
${formatearLineas(lineas)}
${noListadas.length > 0 ? `
══════════════════════════════════════════════════════
*** PRODUCTOS NO LISTADOS — CONFIRMAR DISPONIBILIDAD Y PRECIO ***
${noListadas.map(l => `  · ${l.cantidad} ${l.unidad}: ${l.desc}`).join("\n")}
` : ""}
══════════════════════════════════════════════════════
                        Base imponible:   €${subtotal.toFixed(2)}
                        IVA 21%:           €${iva.toFixed(2)}
                        TOTAL:            €${total.toFixed(2)}
══════════════════════════════════════════════════════
${pedido.notas ? `\nNOTAS:\n${pedido.notas}\n` : ""}
DATOS CLIENTE:
${d.datosCliente.razonSocial}
CIF: ${d.datosCliente.cif}
${d.datosCliente.direccion}
Tel: ${d.datosCliente.telefono}
Forma de pago: ${d.datosCliente.formaPago}

Saludos cordiales,
${d.configEmail.nombreFirma}
${d.configEmail.telefonoFirma ? "Tel: " + d.configEmail.telefonoFirma : ""}

— Pedido ID: ${pedido.id}
`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: emailProveedor,
    cc: d.configEmail.emailCC ? [d.configEmail.emailCC] : [],
    subject: `Pedido ARA Corporate · ${pedido.obra.nombre} · ${new Date(pedido.fecha).toLocaleDateString("es-ES")}`,
    text: cuerpo
  });
}
