/**
 * ara-os-oferta-pdf.cjs · v1.0.0 (28/05/2026)
 * --------------------------------------------------------------
 * Generación de PDFs de presupuesto con Puppeteer.
 *
 * Stack:
 *   - HTML+CSS canónico: lib/oferta-pdf-template.js
 *   - Renderizado:       Puppeteer (Chromium headless)
 *   - Formato A4, printBackground:true, margin:0
 *
 * Endpoints:
 *   GET  /api/ara-os/obras-otras/:id/presupuesto-html
 *        Devuelve el HTML (mismo que se renderiza al PDF). Útil
 *        para previsualizar en navegador y para que Puppeteer lo
 *        cargue vía page.setContent().
 *
 *   GET  /api/ara-os/obras-otras/:id/presupuesto-pdf
 *        Devuelve el application/pdf.
 *
 *   POST /api/ara-os/obras-otras/:id/enviar-presupuesto
 *        Envía el PDF por email vía Resend.
 *
 * Parámetro ?formato=:
 *   detallado (default) una línea por partida con su importe
 *   resumen            MO + Material agregados + partidas con precio_directo
 * --------------------------------------------------------------
 */

module.exports = function(app) {
  const { google } = require("googleapis");
  const express = require("express");
  const fs = require("node:fs");
  const path = require("node:path");
  const jsonBodyParser = express.json({ limit: "1mb" });
  const { renderPresupuestoHtml, EMPRESA_DEFAULT } = require("./lib/oferta-pdf-template.js");

  // ── Assets de branding · cargados una vez como data URIs ──────
  // Logo AAA y sello+firma ARA. Si los ficheros no existen, fallback
  // a null y el template renderiza sin imagen (no rompe).
  function leerComoDataUri(rutaRelativa) {
    try {
      const ruta = path.join(__dirname, rutaRelativa);
      if (!fs.existsSync(ruta)) return null;
      const buf = fs.readFileSync(ruta);
      const ext = path.extname(ruta).slice(1).toLowerCase();
      const mime = ext === "jpg" ? "jpeg" : ext;
      return `data:image/${mime};base64,${buf.toString("base64")}`;
    } catch (e) {
      console.warn(`[oferta-pdf] no se pudo leer ${rutaRelativa}: ${e.message}`);
      return null;
    }
  }
  const ASSETS = {
    logoPng:        leerComoDataUri("assets/araujo-logo-navy.png"),   // navy interior · juego con el texto
    logoPngBlue:    leerComoDataUri("assets/araujo-logo.png"),        // azul original (fallback)
    logoPngWhite:   leerComoDataUri("assets/araujo-logo-white.png"),  // blanco para cover sobre navy
    selloPng:       leerComoDataUri("assets/emasesa/sello_ara.png"),
  };
  console.log(`[oferta-pdf] assets: logoNavy=${!!ASSETS.logoPng} logoWhite=${!!ASSETS.logoPngWhite} sello=${!!ASSETS.selloPng}`);

  // ── Puppeteer · cliente reutilizable ──────────────────────
  // Puppeteer es pesado de arrancar (~1-2s). Mantenemos un browser
  // singleton vivo durante el proceso para amortizar el coste; cada
  // PDF abre y cierra su propia pestaña.
  let _browser = null;
  let _browserPromise = null;
  async function getBrowser() {
    if (_browser && _browser.isConnected()) return _browser;
    if (_browserPromise) return _browserPromise;
    const puppeteer = require("puppeteer");
    _browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    }).then((b) => {
      _browser = b;
      _browserPromise = null;
      b.on("disconnected", () => { _browser = null; });
      console.log("[oferta-pdf] Chromium headless arrancado");
      return b;
    }).catch((e) => {
      _browserPromise = null;
      console.error("[oferta-pdf] error arrancando Chromium:", e.message);
      throw e;
    });
    return _browserPromise;
  }

  async function htmlToPdfBuffer(html) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      // 'load' espera al evento load (todos los recursos), pero no
      // exige idle de red. 'networkidle0' colgaba 30s porque Google
      // Fonts (con display=swap) puede hacer revalidations en
      // background indefinidamente y nunca llega al estado idle.
      await page.setContent(html, { waitUntil: "load", timeout: 30000 });
      // Garantizamos que las webfonts están listas antes del pdf().
      // Si algo falla (fonts no disponibles), seguimos sin bloquear.
      await page.evaluate(() => (document.fonts?.ready || Promise.resolve()))
        .catch(() => {});
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return pdf;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // ── Sheets ────────────────────────────────────────────────
  // Usamos el mismo OAuth2 + refresh_token que el resto del bot
  // (ara-os-obras-otras.cjs). Las env vars que SÍ están en Render:
  //   GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REFRESH_TOKEN
  // El service-account JWT no se usa porque Render no tiene
  // GOOGLE_SERVICE_ACCOUNT_EMAIL ni GOOGLE_PRIVATE_KEY.
  let _sheetsClient = null;
  function getSheets() {
    if (_sheetsClient) return _sheetsClient;
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    _sheetsClient = google.sheets({ version: "v4", auth: oauth2 });
    return _sheetsClient;
  }
  async function leerHoja(rango) {
    const sheets = getSheets();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango,
    });
    return r.data.values || [];
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // ── Utilidades de formato ─────────────────────────────────
  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString("es-ES", {
      style: "currency", currency: "EUR",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtFechaLarga(iso) {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  }
  function fmtCantidad(n, dec = 2) {
    return (Number(n) || 0).toLocaleString("es-ES", {
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    });
  }
  function parseNum(v) {
    const n = parseFloat(String(v || "0").replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  function snapIvaPct(iva, base) {
    if (!base || base <= 0) return 10;
    const raw = (iva / base) * 100;
    const candidatos = [4, 10, 21];
    return candidatos.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a, 10);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Holded contactos · lookup perezoso del nombre del cliente cuando
  // obra.cliente está vacío pero hay un holded_contact_id vinculado.
  // Necesario para obras antiguas creadas antes de que el editor
  // empezara a persistir el nombre.
  let _holdedMod = null;
  function getHoldedMod() {
    if (!_holdedMod) {
      try { _holdedMod = require("./ara-os-holded.cjs"); }
      catch (e) { console.warn("[oferta-pdf] no se pudo cargar holded:", e.message); }
    }
    return _holdedMod;
  }
  async function resolverNombreCliente(obra) {
    if (obra.cliente && obra.cliente.trim()) return obra.cliente.trim();
    if (!obra.holded_contact_id) return "";
    const mod = getHoldedMod();
    if (!mod?.obtenerContactos) return "";
    try {
      const r = await mod.obtenerContactos();
      const c = (r.contactos || []).find(x => x.id === obra.holded_contact_id);
      return c?.nombre || "";
    } catch (e) {
      console.warn("[oferta-pdf] lookup contacto:", e.message);
      return "";
    }
  }

  // ── Lectura del sheet ─────────────────────────────────────
  // ⚠️ Orden CRÍTICO: debe coincidir EXACTAMENTE con OB_HEADERS en
  // ara-os-obras-otras.cjs (esa es la fuente de verdad de la hoja).
  // Si las columnas se desordenan, el alcance mostraría un timestamp
  // u otro campo de la hoja en lugar de la descripción del trabajo
  // — el bug que el usuario reportó en el PDF de prueba.
  const HEADERS_OO = [
    "obra_id","nombre","cliente","telefono","direccion","tipo","importe","fase",        // A-H
    "fecha_inicio","fecha_fin_estimada","fecha_fin_real","fecha_facturada","fecha_cobrada", // I-M
    "holded_invoice_id","notas","created_at","created_by","updated_at","updated_by","borrado", // N-T
    "subtotal_eur","iva_eur","total_eur","tags_holded","facturada","cobrada",            // U-Z
    "codigo_ot","dias_estimados","holded_contact_id","holded_series_id","beneficio_pct", // AA-AE
    "factura_descripcion","holded_invoice_emitida_id",                                     // AF-AG
    "email",                                                                              // AH · v0.5
  ];
  const HEADERS_PARTIDAS = [
    "extra_id","obra_id","concepto","horas","precio_hora",
    "material_eur","margen_material","subtotal_eur",
    "created_at","created_by","borrado",
    "coste_directo","precio_directo",
  ];

  async function obraPorId(id) {
    // Leemos hasta AG (33 columnas) para llegar a factura_descripcion (AF)
    // y holded_invoice_emitida_id (AG). Antes leía hasta AE → la
    // descripción NUNCA llegaba.
    const rows = await leerHoja("obras_otras!A2:AH");
    for (const row of rows) {
      if (!row[0]) continue;
      const obra = {};
      HEADERS_OO.forEach((h, i) => { obra[h] = row[i] || ""; });
      if (obra.obra_id === id && obra.borrado !== "TRUE") return obra;
    }
    return null;
  }
  async function partidasPorObra(id) {
    let rows = [];
    try { rows = await leerHoja("obras_otras_partidas_extra!A2:M"); } catch { return []; }
    const out = [];
    for (const row of rows) {
      if (!row[0]) continue;
      const p = {};
      HEADERS_PARTIDAS.forEach((h, i) => { p[h] = row[i] || ""; });
      if (p.obra_id === id && p.borrado !== "TRUE") {
        p.horas_num = parseNum(p.horas);
        p.precio_hora_num = parseNum(p.precio_hora);
        p.material_eur_num = parseNum(p.material_eur);
        p.margen_material_num = parseNum(p.margen_material);
        p.subtotal_eur_num = parseNum(p.subtotal_eur);
        p.coste_directo_num = parseNum(p.coste_directo);
        p.precio_directo_num = parseNum(p.precio_directo);
        p.pvp = p.precio_directo_num > 0
          ? p.precio_directo_num
          : (p.horas_num * p.precio_hora_num) + (p.material_eur_num * (1 + p.margen_material_num / 100));
        out.push(p);
      }
    }
    return out;
  }

  // ── Construcción del objeto `presupuesto` para el template ─
  async function construirPresupuesto(obra, partidas, formato) {
    const clienteResuelto = await resolverNombreCliente(obra);
    const subtotal = parseNum(obra.subtotal_eur) || partidas.reduce((s, p) => s + (p.pvp || p.subtotal_eur_num), 0);
    const ivaEur   = parseNum(obra.iva_eur);
    const total    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotal + ivaEur);
    const ivaPct   = snapIvaPct(ivaEur, subtotal);

    // ── Alcance: descripción verbatim ──────────────────────
    // v3.6 · pasamos el texto TAL CUAL al template. Era un error
    // intentar partirlo en titular+bullets — destrozaba descripciones
    // largas escritas en párrafos normales.
    const alcanceTexto = obra.factura_descripcion || obra.notas || "";
    const intro = "";   // legacy, ya no se usa
    const alcance = []; // legacy, ya no se usa

    // ── Partidas: construcción según formato ────────────────
    let filas = [];
    if (formato === "resumen" && partidas.length > 0) {
      let totalMO = 0, totalMat = 0, horasTot = 0;
      const directas = [];
      for (const p of partidas) {
        if (p.precio_directo_num > 0) directas.push(p);
        else {
          totalMO  += p.horas_num * p.precio_hora_num;
          totalMat += p.material_eur_num * (1 + p.margen_material_num / 100);
          horasTot += p.horas_num;
        }
      }
      let n = 1;
      if (totalMO > 0) {
        const ph = horasTot > 0 ? totalMO / horasTot : 0;
        filas.push([String(n++), "Mano de obra cualificada", "h",
          fmtCantidad(horasTot), fmtEur(ph), fmtEur(totalMO)]);
      }
      if (totalMat > 0) {
        filas.push([String(n++), "Material y suministros", "lote",
          "1", fmtEur(totalMat), fmtEur(totalMat)]);
      }
      directas.forEach(p => {
        filas.push([String(n++), p.concepto || "—", "ud", "1",
          fmtEur(p.precio_directo_num), fmtEur(p.precio_directo_num)]);
      });
    } else if (partidas.length > 0) {
      // Modo detallado: una línea por TRABAJO con su importe total.
      // No mostramos al cliente el desglose MO/material/margen por partida
      // (eso es contabilidad interna). El cliente ve cada actuación con
      // su precio final y el total al pie.
      partidas.forEach((p, i) => {
        const pvp = p.pvp || p.subtotal_eur_num;
        const esPorHora = p.horas_num > 0 && p.material_eur_num === 0 && p.precio_directo_num === 0;
        const unidad   = esPorHora ? "h" : "ud";
        const cantidad = esPorHora ? fmtCantidad(p.horas_num) : "1";
        const precio   = esPorHora ? p.precio_hora_num : pvp;
        filas.push([String(i + 1), p.concepto || "—", unidad, cantidad,
          fmtEur(precio), fmtEur(pvp)]);
      });
    } else {
      filas.push(["1", obra.nombre || "Servicios profesionales", "ud", "1", fmtEur(subtotal), fmtEur(subtotal)]);
    }

    return {
      empresa: EMPRESA_DEFAULT,
      assets:  ASSETS,           // v3.6 · logo + sello firmados
      oferta: {
        codigo: obra.obra_id || "—",
        titulo: obra.nombre || "—",
        tipo:   obra.tipo || "",
        cliente: clienteResuelto || obra.cliente || obra.nombre || "—",
        emplazamiento: obra.direccion || "—",
        fecha:  fmtFechaLarga(obra.created_at) || fmtFechaLarga(new Date().toISOString()),
        validez: "30 días desde la fecha de emisión",
        validezDias: "30",
        incluye: "Mano de obra cualificada, materiales, gestión de residuos",
        base:     fmtEur(subtotal),
        ivaTexto: `IVA ${ivaPct}%`,
        ivaPorc:  String(ivaPct),
        iva:      fmtEur(ivaEur || (total - subtotal)),
        total:    fmtEur(total),
        plazo:    "7-10 días laborables",
        formaPago:"50% al inicio / 50% a la finalización",
      },
      alcanceIntro: intro,
      alcanceTexto,
      alcance,
      partidas: filas,
    };
  }

  // ─── Endpoints ─────────────────────────────────────────────
  // GET /presupuesto-debug — diagnóstico rápido para verificar qué
  // está leyendo el PDF de la hoja. Devuelve el objeto obra entero
  // tal y como lo construye obraPorId, sin transformaciones.
  app.options("/api/ara-os/obras-otras/:id/presupuesto-debug", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-debug", async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      res.json({
        ok: true,
        obra_keys: Object.keys(obra),
        factura_descripcion: obra.factura_descripcion,
        notas: obra.notas,
        nombre: obra.nombre,
        created_at: obra.created_at,
        num_partidas: partidas.length,
        obra,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /presupuesto-data — JSON listo para alimentar el PdfLayout
  //    de React (preview en navegador). Se construye con la misma
  //    función que el HTML/PDF, así el cliente nunca se desincroniza.
  app.options("/api/ara-os/obras-otras/:id/presupuesto-data", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-data", async (req, res) => {
    responderCORS(res);
    try {
      const formato = req.query.formato === "resumen" ? "resumen" : "detallado";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const presupuesto = await construirPresupuesto(obra, partidas, formato);
      res.json({ ok: true, presupuesto });
    } catch (e) {
      console.error("[presupuesto-data]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.options("/api/ara-os/obras-otras/:id/presupuesto-html", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-html", async (req, res) => {
    responderCORS(res);
    try {
      const formato = req.query.formato === "resumen" ? "resumen" : "detallado";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).send("Obra no encontrada");
      const partidas = await partidasPorObra(req.params.id);
      const presupuesto = await construirPresupuesto(obra, partidas, formato);
      const html = renderPresupuestoHtml(presupuesto);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e) {
      console.error("[presupuesto-html]", e);
      res.status(500).send(e.message);
    }
  });

  app.options("/api/ara-os/obras-otras/:id/presupuesto-pdf", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-pdf", async (req, res) => {
    responderCORS(res);
    try {
      const formato = req.query.formato === "resumen" ? "resumen" : "detallado";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const presupuesto = await construirPresupuesto(obra, partidas, formato);
      const html = renderPresupuestoHtml(presupuesto);
      const pdf = await htmlToPdfBuffer(html);
      const slug = (obra.nombre || "").replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 50);
      const nombre = `oferta_${obra.obra_id}_${slug}_${formato}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${nombre}"`);
      res.send(Buffer.from(pdf));
    } catch (e) {
      console.error("[presupuesto-pdf]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.options("/api/ara-os/obras-otras/:id/enviar-presupuesto", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.post("/api/ara-os/obras-otras/:id/enviar-presupuesto", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      let resend = null;
      try {
        const { Resend } = require("resend");
        resend = new Resend(process.env.ARA_RESEND_API_KEY);
      } catch {
        return res.status(500).json({ ok: false, error: "Resend no instalado en este servidor" });
      }
      if (!process.env.ARA_RESEND_API_KEY) {
        return res.status(500).json({ ok: false, error: "Falta ARA_RESEND_API_KEY en el entorno" });
      }

      const { email_destino, asunto, mensaje, formato } = req.body || {};
      if (!email_destino) return res.status(400).json({ ok: false, error: "Falta email_destino" });

      const fmt = formato === "resumen" ? "resumen" : "detallado";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const presupuesto = await construirPresupuesto(obra, partidas, fmt);
      const html = renderPresupuestoHtml(presupuesto);
      const pdf = await htmlToPdfBuffer(html);

      const from    = process.env.ARA_FROM_EMAIL || "Instalaciones Araujo <comercial@instalacionesaraujo.com>";
      const bccSelf = process.env.ARA_BCC_EMAIL  || "comercial@instalacionesaraujo.com";
      const replyTo = process.env.ARA_REPLY_TO   || "comercial@instalacionesaraujo.com";
      const logoUrl = process.env.ARA_LOGO_URL   || "https://ara-os.onrender.com/branding/araujo-logo.png";
      const subject = asunto || `Presupuesto ${obra.obra_id} · ${obra.nombre}`;

      // ── Email v4.0 · Premium (Apple/Stripe/Linear/Notion) ──────
      // Layout en tablas (compatibilidad Gmail/Outlook), estilos 100%
      // inline. 5 secciones: cabecera → cuerpo → firma → servicios → pie.
      // Navy #123B6D · Agua #4DB6E5 · Fondo #F4F7FB
      // Bug fix: mensajeCliente contiene SÓLO el cuerpo — sin "Buenas,"
      // ni saludo final (el template los añade para evitar duplicados).
      const mensajeCliente = esc(mensaje || "Adjuntamos el presupuesto solicitado. Quedamos a su disposición para cualquier aclaración o ajuste que necesite.").replace(/\n/g, "<br/>");
      const bodyHtml = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased">

  <!-- ── Wrapper exterior ─────────────────────────────────── -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7FB">
    <tr><td align="center" style="padding:48px 16px 56px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

        <!-- ═══════════════════════════════════════════════════
             1 · CABECERA (navy)
        ════════════════════════════════════════════════════ -->
        <tr><td style="background:#123B6D;border-radius:12px 12px 0 0;padding:40px 48px 36px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="width:100px">
                <img src="${logoUrl}" width="88" height="88" alt="Araujo" style="display:block;width:88px;height:88px;border:0;border-radius:8px"/>
              </td>
              <td valign="middle" style="padding-left:22px">
                <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.4px;line-height:1.2">INSTALACIONES ARAUJO</div>
                <div style="font-size:12.5px;color:rgba(255,255,255,.62);margin-top:7px;line-height:1.55;font-weight:400">Instalaciones hidráulicas &middot; Bajantes &middot; Cubiertas &middot; Rehabilitaci&oacute;n</div>
              </td>
            </tr>
          </table>
          <!-- línea de acento agua -->
          <div style="margin-top:32px;height:2px;background:linear-gradient(90deg,#4DB6E5 0%,rgba(77,182,229,.15) 100%);border-radius:2px"></div>
        </td></tr>

        <!-- ═══════════════════════════════════════════════════
             2 · CUERPO
        ════════════════════════════════════════════════════ -->
        <tr><td style="background:#ffffff;padding:44px 48px 8px">
          <div style="font-size:10.5px;color:#94a3b8;letter-spacing:2.5px;font-weight:700;text-transform:uppercase">Presupuesto</div>
          <div style="font-size:22px;font-weight:600;color:#123B6D;margin-top:10px;letter-spacing:-.4px;line-height:1.3">${esc(obra.obra_id || "")} <span style="color:#cbd5e1;font-weight:300">&middot;</span> ${esc(obra.nombre || "")}</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:28px 48px 36px">
          <div style="font-size:15px;line-height:1.75;color:#1e293b">
            <p style="margin:0 0 14px 0">Buenas,</p>
            <p style="margin:0 0 14px 0">${mensajeCliente}</p>
            <p style="margin:0">Un cordial saludo,</p>
          </div>
        </td></tr>

        <!-- ═══════════════════════════════════════════════════
             3 · FIRMA
        ════════════════════════════════════════════════════ -->
        <tr><td style="background:#ffffff;padding:0 48px 44px">
          <div style="height:1px;background:#e8edf5;margin-bottom:28px"></div>
          <div style="font-size:16px;font-weight:700;color:#123B6D;letter-spacing:-.2px">Jos&eacute; Manuel Mendoza Terrero</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:5px;font-weight:400;letter-spacing:.1px">Responsable Comercial &middot; Instalaciones Araujo</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-collapse:collapse">
            <tr>
              <td style="padding:5px 28px 5px 0;font-size:13.5px;color:#334155;white-space:nowrap">
                <span style="color:#4DB6E5;font-size:10px;vertical-align:middle">&#9679;</span>&nbsp;&nbsp;<a href="tel:+34640527426" style="color:#334155;text-decoration:none">640 527 426</a>
              </td>
              <td style="padding:5px 28px 5px 0;font-size:13.5px;color:#334155;white-space:nowrap">
                <span style="color:#4DB6E5;font-size:10px;vertical-align:middle">&#9679;</span>&nbsp;&nbsp;<a href="mailto:comercial@instalacionesaraujo.com" style="color:#334155;text-decoration:none">comercial@instalacionesaraujo.com</a>
              </td>
              <td style="padding:5px 0;font-size:13.5px;color:#334155;white-space:nowrap">
                <span style="color:#4DB6E5;font-size:10px;vertical-align:middle">&#9679;</span>&nbsp;&nbsp;<a href="https://www.instalacionesaraujo.com" style="color:#334155;text-decoration:none">instalacionesaraujo.com</a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ═══════════════════════════════════════════════════
             4 · SERVICIOS (caja azul suave)
        ════════════════════════════════════════════════════ -->
        <tr><td style="background:#ffffff;padding:0 48px 48px">
          <div style="background:#EDF5FD;border-radius:10px;padding:28px 32px">
            <div style="font-size:10.5px;color:#4DB6E5;letter-spacing:2.5px;font-weight:700;text-transform:uppercase;margin-bottom:18px">Especialistas en</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding:7px 0;font-size:14px;color:#123B6D;line-height:1.5;font-weight:500">&#128167;&nbsp;&nbsp;Plan 5 EMASESA &middot; Redes comunitarias</td></tr>
              <tr><td style="padding:7px 0;font-size:14px;color:#123B6D;line-height:1.5;font-weight:500">&#128167;&nbsp;&nbsp;Bajantes, columnas y acometidas de agua</td></tr>
              <tr><td style="padding:7px 0;font-size:14px;color:#123B6D;line-height:1.5;font-weight:500">&#128167;&nbsp;&nbsp;Cubiertas, impermeabilizaci&oacute;n y reparaciones</td></tr>
              <tr><td style="padding:7px 0;font-size:14px;color:#123B6D;line-height:1.5;font-weight:500">&#128167;&nbsp;&nbsp;Comunidades de propietarios y administradores de fincas</td></tr>
            </table>
          </div>
        </td></tr>

        <!-- ═══════════════════════════════════════════════════
             5 · PIE LEGAL
        ════════════════════════════════════════════════════ -->
        <tr><td style="background:#F4F7FB;border-radius:0 0 12px 12px;padding:24px 48px 28px">
          <div style="font-size:11px;line-height:1.7;color:#94a3b8;text-align:center">
            ARA Corporate Sociedad de Inversiones, S.L. &middot; CIF B90488222<br/>
            Este mensaje es confidencial y est&aacute; dirigido exclusivamente a su destinatario. Tratamiento de datos conforme al RGPD (UE) 2016/679.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

      await resend.emails.send({
        from,
        to: email_destino,
        bcc: bccSelf,
        reply_to: replyTo,
        subject,
        html: bodyHtml,
        attachments: [{
          filename: `oferta_${obra.obra_id}.pdf`,
          content: Buffer.from(pdf).toString("base64"),
        }],
      });

      res.json({ ok: true, sent_to: email_destino, bcc: bccSelf });
    } catch (e) {
      console.error("[enviar-presupuesto]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Limpieza al apagar
  process.on("SIGTERM", async () => {
    if (_browser) try { await _browser.close(); } catch {}
  });
  process.on("SIGINT", async () => {
    if (_browser) try { await _browser.close(); } catch {}
  });

  console.log("[ara-os-oferta-pdf v1.0.0] · Puppeteer · endpoints listos");
};
