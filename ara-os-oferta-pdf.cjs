/**
 * ara-os-oferta-pdf.cjs · v0.5.0 (28/05/2026)
 * --------------------------------------------------------------
 * PDF de presupuesto · rediseño mockup Araujo (4 páginas).
 *
 *   P1 PORTADA    foto/placeholder · datos cliente/oferta · banner importe
 *   P2 ALCANCE    bullets con iconos · ilustración opcional
 *   P3 INVERSIÓN  tabla limpia · totales · badges con iconos
 *   P4 ACEPTACIÓN datos · firmas · condiciones · pie corporativo
 *
 * Fotos por tipo de obra: subir a /assets/fotos/<tipo>.jpg
 *   p.ej. bajantes.jpg, fontaneria.jpg, alicatado.jpg…
 *   si no existe la del tipo, busca 'default.jpg'
 *   si tampoco, dibuja un placeholder con gradiente y patrón
 *
 * Dos formatos via ?formato=resumen|detallado.
 * --------------------------------------------------------------
 */

module.exports = function(app) {
  const fs = require("fs");
  const path = require("path");
  const { google } = require("googleapis");
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
  const express = require("express");
  const jsonBodyParser = express.json({ limit: "1mb" });

  const EMPRESA = {
    razon:    "Ara Corporate Sociedad de Inversiones SL",
    marca:    "Instalaciones Araujo",
    tagline:  "Fontanería · Bajantes · Instalaciones",
    cif:      "B90488222",
    dir1:     "Avenida San Francisco Javier",
    dir2:     "Edificio Sevilla 2, Planta 6, Módulo 9",
    cp:       "41018 · Sevilla",
    tel:      "954 12 34 56",
    email:    "presupuestos@araujofontaneria.es",
    web:      "araujofontaneria.es",
  };

  const LOGO_PATH = path.join(__dirname, "assets", "araujo-logo.png");
  const FOTOS_DIR = path.join(__dirname, "assets", "fotos");
  let LOGO_BYTES = null;
  try { LOGO_BYTES = fs.readFileSync(LOGO_PATH); }
  catch (e) { console.warn("[oferta-pdf] no se pudo cargar logo:", e.message); }

  function buscarFotoPorTipo(tipo) {
    const candidatos = [
      `${(tipo || "").toLowerCase()}.jpg`,
      `${(tipo || "").toLowerCase()}.jpeg`,
      `${(tipo || "").toLowerCase()}.png`,
      "default.jpg", "default.jpeg", "default.png",
    ];
    for (const n of candidatos) {
      const p = path.join(FOTOS_DIR, n);
      if (fs.existsSync(p)) {
        try { return { bytes: fs.readFileSync(p), ext: path.extname(n).slice(1).toLowerCase() }; }
        catch { /* skip */ }
      }
    }
    return null;
  }

  // ── Sheets ─────────────────────────────────────────────────
  function getAuth() {
    return new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  function getSheets() { return google.sheets({ version: "v4", auth: getAuth() }); }
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

  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString("es-ES", {
      style: "currency", currency: "EUR",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtEurC(n) {
    return (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  }
  function parseNum(v) {
    const n = parseFloat(String(v || "0").replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  const HEADERS_OO = [
    "obra_id","nombre","cliente","telefono","direccion","tipo","importe","fase",
    "created_at","created_by","borrado","fecha_inicio","fecha_fin_estimada",
    "fecha_fin_real","fecha_facturada","fecha_cobrada","holded_invoice_id","notas",
    "subtotal_eur","iva_eur","total_eur","tags_holded","facturada","cobrada",
    "codigo_ot","dias_estimados","holded_contact_id","holded_series_id",
    "beneficio_pct","factura_descripcion","holded_invoice_emitida_id",
  ];
  const HEADERS_PARTIDAS = [
    "extra_id","obra_id","concepto","horas","precio_hora",
    "material_eur","margen_material","subtotal_eur",
    "created_at","created_by","borrado",
    "coste_directo","precio_directo",
  ];

  async function obraPorId(id) {
    const rows = await leerHoja("obras_otras!A2:AE");
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

  // ════════════════════════════════════════════════════════════
  //  GENERADOR DE PDF · v0.5 layout mockup
  // ════════════════════════════════════════════════════════════
  async function generarPdfPresupuesto(obra, partidas, formato = "resumen") {
    const pdfDoc = await PDFDocument.create();
    const helv     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const serif    = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const serifB   = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const azul       = rgb(0.020, 0.294, 0.529);  // #054B87
    const azulOsc    = rgb(0.012, 0.180, 0.325);  // #032D52 hero
    const azulSuave  = rgb(0.93, 0.96, 0.99);
    const azulMed    = rgb(0.85, 0.91, 0.97);
    const ink        = rgb(0.07, 0.07, 0.07);
    const muted      = rgb(0.42, 0.42, 0.45);
    const faint      = rgb(0.62, 0.62, 0.66);
    const lineSoft   = rgb(0.90, 0.91, 0.94);
    const white      = rgb(1, 1, 1);

    const W = 595.28, H = 841.89;
    const M = 44;

    let logoImg = null;
    if (LOGO_BYTES) {
      try { logoImg = await pdfDoc.embedPng(LOGO_BYTES); } catch {}
    }
    let fotoImg = null;
    const fotoData = buscarFotoPorTipo(obra.tipo);
    if (fotoData) {
      try {
        fotoImg = fotoData.ext === "png"
          ? await pdfDoc.embedPng(fotoData.bytes)
          : await pdfDoc.embedJpg(fotoData.bytes);
      } catch (e) { console.warn("[oferta-pdf] foto:", e.message); }
    }

    // ── helpers ──
    function t(page, s, x, y, opts = {}) {
      let font = helv;
      if (opts.serif) font = opts.bold ? serifB : serif;
      else if (opts.bold) font = helvBold;
      page.drawText(String(s ?? ""), {
        x, y, size: opts.size || 10, font,
        color: opts.color || ink, maxWidth: opts.maxWidth,
      });
    }
    function tR(page, s, xR, y, opts = {}) {
      const font = opts.serif ? (opts.bold ? serifB : serif) : (opts.bold ? helvBold : helv);
      const w = font.widthOfTextAtSize(String(s ?? ""), opts.size || 10);
      t(page, s, xR - w, y, opts);
    }
    function wrap(s, maxW, size = 10, opts = {}) {
      const font = opts.serif ? (opts.bold ? serifB : serif) : (opts.bold ? helvBold : helv);
      const out = [];
      for (const parrafo of String(s || "").split(/\n+/)) {
        const palabras = parrafo.split(/\s+/);
        let actual = "";
        for (const w of palabras) {
          const cand = actual ? actual + " " + w : w;
          if (font.widthOfTextAtSize(cand, size) > maxW && actual) {
            out.push(actual); actual = w;
          } else { actual = cand; }
        }
        if (actual) out.push(actual);
        out.push("");
      }
      if (out[out.length - 1] === "") out.pop();
      return out;
    }

    // ─── Iconos vectoriales minimalistas ──────────────────
    // Todos centrados en (x, y) con tamaño 'r' (radio aprox).
    // Estilo: outline azul, fondo blanco/transparente, 1.2 grosor.
    function ico(page, nombre, cx, cy, r, color) {
      const c = color || azul;
      const stroke = { borderColor: c, borderWidth: 1.2, color: undefined };
      const draw = (svgPath) => page.drawSvgPath(svgPath, { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
      // Cada path se diseña sobre un canvas de 24x24 con el (0,0) arriba-izquierda
      // y se traduce al colocarse (drawSvgPath toma x,y como esquina sup-izq).
      const scale = (2 * r) / 24;
      const sp = (p) => {
        // Escalar el path 24x24
        return p.replace(/(-?\d+(\.\d+)?)/g, (m) => (parseFloat(m) * scale).toString());
      };

      switch (nombre) {
        case "persona":
          page.drawCircle({ x: cx, y: cy + r * 0.35, size: r * 0.32, borderColor: c, borderWidth: 1.2 });
          page.drawSvgPath(sp("M 4 22 Q 12 14 20 22"), { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          break;
        case "pin":
          page.drawSvgPath(sp("M 12 2 C 7 2 4 5 4 10 C 4 16 12 22 12 22 C 12 22 20 16 20 10 C 20 5 17 2 12 2 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          page.drawCircle({ x: cx, y: cy + r * 0.18, size: r * 0.22, borderColor: c, borderWidth: 1.2 });
          break;
        case "documento":
          page.drawSvgPath(sp("M 5 2 L 16 2 L 19 5 L 19 22 L 5 22 Z M 16 2 L 16 5 L 19 5"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          // líneas internas
          page.drawLine({ start: { x: cx - r * 0.5, y: cy }, end: { x: cx + r * 0.4, y: cy }, thickness: 1, color: c });
          page.drawLine({ start: { x: cx - r * 0.5, y: cy - r * 0.25 }, end: { x: cx + r * 0.4, y: cy - r * 0.25 }, thickness: 1, color: c });
          break;
        case "calendario":
          page.drawRectangle({ x: cx - r * 0.8, y: cy - r * 0.7, width: r * 1.6, height: r * 1.5,
            borderColor: c, borderWidth: 1.2 });
          page.drawLine({ start: { x: cx - r * 0.8, y: cy + r * 0.4 }, end: { x: cx + r * 0.8, y: cy + r * 0.4 }, thickness: 1, color: c });
          page.drawLine({ start: { x: cx - r * 0.35, y: cy + r * 0.8 }, end: { x: cx - r * 0.35, y: cy + r * 1 }, thickness: 1.2, color: c });
          page.drawLine({ start: { x: cx + r * 0.35, y: cy + r * 0.8 }, end: { x: cx + r * 0.35, y: cy + r * 1 }, thickness: 1.2, color: c });
          break;
        case "telefono":
          page.drawSvgPath(sp("M 5 4 C 5 3 6 2 7 2 L 10 2 L 12 7 L 9 10 C 10 14 14 18 18 19 L 21 16 L 26 18 L 26 21 C 26 22 25 23 24 23 C 12 23 5 16 5 4 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          break;
        case "email":
          page.drawRectangle({ x: cx - r * 0.9, y: cy - r * 0.6, width: r * 1.8, height: r * 1.2, borderColor: c, borderWidth: 1.2 });
          page.drawLine({ start: { x: cx - r * 0.9, y: cy + r * 0.6 }, end: { x: cx, y: cy }, thickness: 1, color: c });
          page.drawLine({ start: { x: cx + r * 0.9, y: cy + r * 0.6 }, end: { x: cx, y: cy }, thickness: 1, color: c });
          break;
        case "web":
          page.drawCircle({ x: cx, y: cy, size: r * 0.85, borderColor: c, borderWidth: 1.2 });
          page.drawLine({ start: { x: cx - r * 0.85, y: cy }, end: { x: cx + r * 0.85, y: cy }, thickness: 1, color: c });
          page.drawLine({ start: { x: cx, y: cy - r * 0.85 }, end: { x: cx, y: cy + r * 0.85 }, thickness: 1, color: c });
          break;
        case "check":
          page.drawCircle({ x: cx, y: cy, size: r * 0.85, borderColor: c, borderWidth: 1.2 });
          page.drawSvgPath(sp("M 7 12 L 11 16 L 17 9"),
            { borderColor: c, borderWidth: 1.5, x: cx - r, y: cy + r });
          break;
        case "escudo":
          page.drawSvgPath(sp("M 12 2 L 4 5 L 4 12 C 4 17 8 21 12 22 C 16 21 20 17 20 12 L 20 5 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          page.drawSvgPath(sp("M 8 12 L 11 15 L 16 9"),
            { borderColor: c, borderWidth: 1.5, x: cx - r, y: cy + r });
          break;
        case "herramienta":
          page.drawSvgPath(sp("M 14 6 L 18 2 L 22 6 L 18 10 L 22 14 L 14 22 L 6 14 L 10 10 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          break;
        case "caja":
          page.drawSvgPath(sp("M 4 7 L 12 3 L 20 7 L 20 17 L 12 21 L 4 17 Z M 4 7 L 12 11 L 20 7 M 12 11 L 12 21"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          break;
        case "reciclaje":
          page.drawSvgPath(sp("M 12 4 L 7 12 L 11 12 L 11 18 L 13 18 L 13 12 L 17 12 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          page.drawCircle({ x: cx, y: cy, size: r * 0.95, borderColor: c, borderWidth: 1 });
          break;
        case "tuberia":
          // bajante: cilindro vertical con codo
          page.drawRectangle({ x: cx - r * 0.25, y: cy - r * 0.8, width: r * 0.5, height: r * 1.4,
            borderColor: c, borderWidth: 1.2 });
          page.drawRectangle({ x: cx - r * 0.45, y: cy + r * 0.3, width: r * 0.9, height: r * 0.25,
            borderColor: c, borderWidth: 1.2 });
          break;
        case "bombilla":
          page.drawCircle({ x: cx, y: cy + r * 0.2, size: r * 0.55, borderColor: c, borderWidth: 1.2 });
          page.drawRectangle({ x: cx - r * 0.25, y: cy - r * 0.7, width: r * 0.5, height: r * 0.3, borderColor: c, borderWidth: 1 });
          break;
        case "tabla":
          page.drawRectangle({ x: cx - r * 0.85, y: cy - r * 0.7, width: r * 1.7, height: r * 1.4, borderColor: c, borderWidth: 1.2 });
          page.drawLine({ start: { x: cx - r * 0.85, y: cy + r * 0.2 }, end: { x: cx + r * 0.85, y: cy + r * 0.2 }, thickness: 1, color: c });
          page.drawLine({ start: { x: cx - r * 0.85, y: cy - r * 0.2 }, end: { x: cx + r * 0.85, y: cy - r * 0.2 }, thickness: 1, color: c });
          break;
        case "handshake":
          page.drawSvgPath(sp("M 2 14 L 8 8 L 12 12 L 16 8 L 22 14 L 18 18 L 14 14 L 10 18 L 6 14 Z"),
            { borderColor: c, borderWidth: 1.2, x: cx - r, y: cy + r });
          break;
        default:
          page.drawCircle({ x: cx, y: cy, size: r * 0.6, borderColor: c, borderWidth: 1.2 });
      }
    }

    // Caja con icono + label encima + valor debajo (estilo mockup)
    function bloqueDato(page, x, y, iconoTipo, label, valor, anchoMax) {
      // Icono cuadrado relleno azul suave a la izquierda
      const iconBox = 30;
      page.drawRectangle({ x, y: y - iconBox + 6, width: iconBox, height: iconBox, color: azulSuave });
      ico(page, iconoTipo, x + iconBox / 2, y - iconBox / 2 + 6, 10, azul);
      // Label y valor a la derecha
      t(page, label.toUpperCase(), x + iconBox + 10, y, { size: 7, bold: true, color: faint });
      const ww = wrap(valor || "—", (anchoMax || 200) - iconBox - 10, 10, { bold: true });
      let yy = y - 12;
      for (const ln of ww.slice(0, 2)) {
        t(page, ln, x + iconBox + 10, yy, { size: 10, bold: true });
        yy -= 12;
      }
    }

    // Cabecera consistente para páginas 2-4
    function pintarCabPag(page, subtituloDer) {
      if (logoImg) {
        const d = logoImg.scale(0.055);
        page.drawImage(logoImg, { x: M, y: H - 38 - d.height, width: d.width, height: d.height });
      }
      t(page, "Instalaciones", M + 38, H - 30, { size: 11, bold: true, color: azulOsc });
      t(page, "Araujo", M + 38, H - 42, { size: 11, bold: true, color: azulOsc });
      tR(page, obra.obra_id || "", W - M, H - 30, { size: 9, bold: true, color: azulOsc });
      tR(page, (subtituloDer || "").toUpperCase(), W - M, H - 42, { size: 7, color: muted });
    }

    function pintarPiePag(page, idx, total) {
      page.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.3, color: lineSoft });
      t(page, EMPRESA.marca, M, 36, { size: 7, bold: true, color: muted });
      t(page, `· ${EMPRESA.cif}`, M + helvBold.widthOfTextAtSize(EMPRESA.marca, 7) + 4, 36, { size: 7, color: faint });
      t(page, EMPRESA.email, M, 26, { size: 7, color: faint });
      tR(page, `${idx} / ${total}`, W - M, 36, { size: 7, bold: true, color: muted });
    }

    function dibujarFotoOPlaceholder(page, x, y, w, h) {
      if (fotoImg) {
        // Recortar respetando aspect ratio para que cubra (cover)
        const ar = fotoImg.width / fotoImg.height;
        const targetAr = w / h;
        let cw = w, ch = h, ox = x, oy = y;
        if (ar > targetAr) {
          // foto más ancha que el hueco → encajamos por altura
          cw = h * ar;
          ox = x - (cw - w) / 2;
        } else {
          ch = w / ar;
          oy = y - (ch - h) / 2;
        }
        // pdf-lib no soporta clipping nativo; encajamos por dimensión más limitante
        const escala = Math.max(w / fotoImg.width, h / fotoImg.height);
        const fw = fotoImg.width * escala;
        const fh = fotoImg.height * escala;
        page.drawImage(fotoImg, { x: x - (fw - w) / 2, y: y - (fh - h) / 2, width: fw, height: fh });
      } else {
        // Placeholder: gradiente simulado con bandas + patrón decorativo
        for (let i = 0; i < 12; i++) {
          const t = i / 12;
          const r = 0.012 + (0.020 - 0.012) * t;
          const g = 0.18 + (0.294 - 0.18) * t;
          const b = 0.325 + (0.529 - 0.325) * t;
          page.drawRectangle({ x, y: y + h * i / 12, width: w, height: h / 12 + 1, color: rgb(r, g, b) });
        }
        // Patrón geométrico decorativo (círculos blancos sutiles)
        for (let i = 0; i < 8; i++) {
          page.drawCircle({
            x: x + w * (0.2 + (i % 4) * 0.22), y: y + h * (0.15 + Math.floor(i / 4) * 0.55),
            size: 4 + (i % 3) * 3, borderColor: rgb(1, 1, 1), borderWidth: 0.4,
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 1 — PORTADA
    // ═══════════════════════════════════════════════════════
    const p1 = pdfDoc.addPage([W, H]);
    // Foto a la derecha · 40% del ancho, desde arriba hasta el banner
    const fotoX = W * 0.62, fotoY = H - 240, fotoW = W * 0.38, fotoH = 240;
    dibujarFotoOPlaceholder(p1, fotoX, fotoY, fotoW, fotoH);

    // Logo + marca arriba izquierda
    if (logoImg) {
      const d = logoImg.scale(0.075);
      p1.drawImage(logoImg, { x: M, y: H - 50 - d.height, width: d.width, height: d.height });
    }
    t(p1, "Instalaciones", M + 50, H - 38, { size: 14, bold: true, color: azulOsc });
    t(p1, "Araujo", M + 50, H - 54, { size: 14, bold: true, color: azulOsc });
    t(p1, EMPRESA.tagline, M + 50, H - 70, { size: 8, color: muted });

    // Pill número oferta arriba derecha (sobre la foto)
    const pillTxt = obra.obra_id || "—";
    const pillW = helvBold.widthOfTextAtSize(pillTxt, 9) + 18;
    p1.drawRectangle({ x: fotoX + 10, y: H - 40, width: pillW, height: 18, color: white });
    t(p1, pillTxt, fotoX + 19, H - 35, { size: 9, bold: true, color: azulOsc });

    // Etiqueta y título
    let y = H - 280;
    t(p1, "OFERTA COMERCIAL", M, y, { size: 8, bold: true, color: azul });
    y -= 26;
    const tituloLineas = wrap(obra.nombre || "—", W - 2 * M - 20, 26, { serif: true, bold: true });
    for (const ln of tituloLineas.slice(0, 3)) {
      t(p1, ln, M, y, { size: 26, serif: true, bold: true, color: azulOsc });
      y -= 30;
    }
    // Línea decorativa
    p1.drawLine({ start: { x: M, y: y - 4 }, end: { x: M + 50, y: y - 4 }, thickness: 2, color: azul });
    y -= 24;

    // Datos cliente y datos oferta (2 columnas con iconos)
    const colW = (W - 2 * M - 24) / 2;
    bloqueDato(p1, M, y, "persona", "Cliente", obra.cliente || obra.nombre || "—", colW);
    bloqueDato(p1, M + colW + 24, y, "documento", "Nº de oferta", obra.obra_id || "—", colW);
    y -= 42;
    bloqueDato(p1, M, y, "pin", "Emplazamiento", obra.direccion || "—", colW);
    bloqueDato(p1, M + colW + 24, y, "calendario", "Fecha de emisión",
      fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()), colW);
    y -= 56;

    // Banner azul oscuro con importe (full width)
    const subtotalObra = parseNum(obra.subtotal_eur) || partidas.reduce((s, p) => s + (p.pvp || p.subtotal_eur_num), 0);
    const ivaObra      = parseNum(obra.iva_eur);
    const totalObra    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotalObra + ivaObra);
    const ivaPct       = subtotalObra > 0 ? Math.round((ivaObra / subtotalObra) * 100) : 10;

    const bannerH = 78;
    const bannerY = y - bannerH;
    p1.drawRectangle({ x: M, y: bannerY, width: W - 2 * M, height: bannerH, color: azulOsc });
    t(p1, "IMPORTE TOTAL", M + 22, bannerY + bannerH - 22, { size: 8, bold: true, color: rgb(0.7, 0.85, 1) });
    t(p1, "(IVA incluido)", M + 22 + helvBold.widthOfTextAtSize("IMPORTE TOTAL", 8) + 6, bannerY + bannerH - 22,
      { size: 8, color: rgb(0.55, 0.7, 0.9) });
    const totStr = fmtEurC(totalObra);
    t(p1, totStr, M + 22, bannerY + 18, { size: 32, bold: true, color: white });
    const totW = helvBold.widthOfTextAtSize(totStr, 32);
    t(p1, "€", M + 22 + totW + 6, bannerY + 18, { size: 18, color: rgb(0.7, 0.85, 1) });
    // Desglose derecha
    const xD = W - M - 22;
    t(p1, "Base imponible", xD - 130, bannerY + bannerH - 26, { size: 8, color: rgb(0.7, 0.85, 1) });
    tR(p1, fmtEur(subtotalObra), xD, bannerY + bannerH - 26, { size: 10, bold: true, color: white });
    t(p1, `IVA ${ivaPct}%`, xD - 130, bannerY + bannerH - 44, { size: 8, color: rgb(0.7, 0.85, 1) });
    tR(p1, fmtEur(ivaObra || (totalObra - subtotalObra)), xD, bannerY + bannerH - 44, { size: 10, bold: true, color: white });

    y = bannerY - 20;

    // Validez · Incluye · Emite (tres líneas con iconos pequeños)
    const linea = (icono, label, valor, yy) => {
      ico(p1, icono, M + 8, yy + 4, 8, azul);
      t(p1, label.toUpperCase(), M + 24, yy, { size: 7, bold: true, color: faint });
      t(p1, valor, M + 90, yy, { size: 9 });
    };
    linea("check", "Validez", "30 días desde la fecha de emisión", y); y -= 16;
    linea("escudo", "Incluye", "Mano de obra cualificada, materiales, gestión de residuos", y); y -= 16;
    linea("documento", "Emite", `${EMPRESA.marca} · ${EMPRESA.cif}`, y);

    // Pie con contacto (estilo mockup)
    const yPC = 60;
    ico(p1, "telefono", M + 6, yPC + 4, 6, muted);
    t(p1, EMPRESA.tel, M + 16, yPC, { size: 8, color: muted });
    ico(p1, "email", M + 130, yPC + 4, 6, muted);
    t(p1, EMPRESA.email, M + 140, yPC, { size: 8, color: muted });
    ico(p1, "web", M + 330, yPC + 4, 6, muted);
    t(p1, EMPRESA.web, M + 340, yPC, { size: 8, color: muted });
    p1.drawLine({ start: { x: M, y: yPC + 18 }, end: { x: W - M, y: yPC + 18 }, thickness: 0.3, color: lineSoft });
    tR(p1, "1 / 4", W - M, yPC, { size: 8, bold: true, color: muted });

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 2 — ALCANCE
    // ═══════════════════════════════════════════════════════
    const p2 = pdfDoc.addPage([W, H]);
    pintarCabPag(p2, obra.cliente || "");
    p2.drawLine({ start: { x: M, y: H - 70 }, end: { x: W - M, y: H - 70 }, thickness: 0.3, color: lineSoft });

    let y2 = H - 110;
    t(p2, "01", M, y2, { size: 22, bold: true, color: azul, serif: true });
    t(p2, "ALCANCE DE LOS TRABAJOS", M + 38, y2 + 5, { size: 11, bold: true, color: azulOsc });
    y2 -= 24;

    // Resumen ejecutivo (las 1-2 primeras líneas de la descripción)
    const desc = obra.factura_descripcion || obra.notas || "";
    const parrafos = String(desc).split(/\n+/).filter(p => p.trim());
    const intro = parrafos.find(p => !/^[\-•*]/.test(p.trim())) || "Trabajos de instalación según especificaciones detalladas a continuación.";
    for (const ln of wrap(intro, W - 2 * M - 220, 10)) {
      if (!ln) continue;
      t(p2, ln, M, y2, { size: 10, color: ink });
      y2 -= 14;
    }
    y2 -= 18;

    // Lista de bullets con iconos circulares (estilo mockup)
    const iconosBullet = ["tuberia", "herramienta", "caja", "escudo", "reciclaje", "check", "documento", "tabla"];
    const bullets = parrafos.filter(p => /^[\-•*]/.test(p.trim())).map(p => p.trim().replace(/^[\-•*]\s*/, ""));
    const usaIcono = (i) => iconosBullet[i % iconosBullet.length];
    // Si no hay bullets, parsea por puntos del párrafo
    const items = bullets.length > 0 ? bullets : intro.split(/\.\s+/).filter(s => s.trim()).slice(0, 6);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (y2 < 130) break;
      // Caja de icono circular azul suave
      const cx = M + 22, cy = y2;
      p2.drawCircle({ x: cx, y: cy, size: 16, color: azulSuave });
      ico(p2, usaIcono(i), cx, cy, 10, azul);
      // Título corto: primeras 4-5 palabras del item, capitalizado
      const titulo = item.split(/[,;:]/)[0].trim().slice(0, 50);
      const resto = item.slice(titulo.length).replace(/^[,;:\s]+/, "").trim();
      t(p2, titulo.charAt(0).toUpperCase() + titulo.slice(1), M + 48, cy + 5, { size: 10, bold: true, color: azulOsc });
      if (resto) {
        const lns = wrap(resto, W - 2 * M - 280, 9);
        let yy = cy - 8;
        for (const ln of lns.slice(0, 2)) {
          t(p2, ln, M + 48, yy, { size: 9, color: muted });
          yy -= 11;
        }
      }
      y2 -= 44;
    }

    // Ilustración a la derecha (placeholder con líneas tipo plano arquitectónico)
    if (!fotoImg) {
      const ilustX = W - M - 180, ilustY = H - 380, ilustW = 180, ilustH = 270;
      // marco
      p2.drawRectangle({ x: ilustX, y: ilustY, width: ilustW, height: ilustH, color: azulSuave });
      // líneas tipo plano
      for (let i = 0; i < 8; i++) {
        const xp = ilustX + 14 + i * 20;
        p2.drawLine({ start: { x: xp, y: ilustY + 20 }, end: { x: xp, y: ilustY + ilustH - 20 }, thickness: 0.5, color: azul });
      }
      // ventanas
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 5; c++) {
          p2.drawRectangle({ x: ilustX + 18 + c * 32, y: ilustY + 30 + r * 38, width: 18, height: 22,
            borderColor: azulOsc, borderWidth: 0.6 });
        }
      }
    }

    pintarPiePag(p2, 2, 4);

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 3 — INVERSIÓN
    // ═══════════════════════════════════════════════════════
    const p3 = pdfDoc.addPage([W, H]);
    pintarCabPag(p3, "Inversión");
    p3.drawLine({ start: { x: M, y: H - 70 }, end: { x: W - M, y: H - 70 }, thickness: 0.3, color: lineSoft });

    let y3 = H - 110;
    t(p3, "02", M, y3, { size: 22, bold: true, color: azul, serif: true });
    t(p3, formato === "detallado" ? "DETALLE POR PARTIDAS" : "INVERSIÓN", M + 38, y3 + 5, { size: 11, bold: true, color: azulOsc });
    y3 -= 28;

    // ── Filas según formato (Nº, concepto, unidad, cantidad, precio_unitario, importe)
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
      if (totalMO > 0) {
        const ph = horasTot > 0 ? totalMO / horasTot : 0;
        filas.push({ concepto: "Mano de obra cualificada", unidad: "h",
          cantidad: horasTot ? horasTot.toFixed(2) : "1", precio: ph || totalMO, importe: totalMO });
      }
      if (totalMat > 0) {
        filas.push({ concepto: "Material y suministros", unidad: "lote",
          cantidad: "1", precio: totalMat, importe: totalMat });
      }
      directas.forEach(p => filas.push({
        concepto: p.concepto, unidad: "ud", cantidad: "1",
        precio: p.precio_directo_num, importe: p.precio_directo_num,
      }));
    } else if (partidas.length > 0) {
      filas = partidas.map(p => ({
        concepto: p.concepto,
        unidad: p.horas_num > 0 ? "h" : "ud",
        cantidad: p.horas_num > 0 ? p.horas_num.toFixed(2) : "1",
        precio: p.horas_num > 0 ? p.precio_hora_num : (p.pvp || p.subtotal_eur_num),
        importe: p.pvp || p.subtotal_eur_num,
      }));
    } else {
      const sub = parseNum(obra.subtotal_eur) || parseNum(obra.total_eur) || parseNum(obra.importe);
      filas = [{ concepto: obra.nombre || "Servicios profesionales", unidad: "ud", cantidad: "1", precio: sub, importe: sub }];
    }

    // Columnas
    const colN = M, colC = M + 36, colU = W - M - 220, colQ = W - M - 160, colP = W - M - 100, colI = W - M;
    // Header
    p3.drawLine({ start: { x: M, y: y3 + 18 }, end: { x: W - M, y: y3 + 18 }, thickness: 0.4, color: ink });
    p3.drawLine({ start: { x: M, y: y3 - 6 }, end: { x: W - M, y: y3 - 6 }, thickness: 0.4, color: ink });
    t(p3, "Nº",       colN,     y3 + 2, { size: 8, bold: true, color: muted });
    t(p3, "CONCEPTO", colC,     y3 + 2, { size: 8, bold: true, color: muted });
    tR(p3, "UNIDAD",   colU + 30, y3 + 2, { size: 8, bold: true, color: muted });
    tR(p3, "CANTIDAD", colQ + 30, y3 + 2, { size: 8, bold: true, color: muted });
    tR(p3, "PRECIO UNITARIO", colP + 30, y3 + 2, { size: 8, bold: true, color: muted });
    tR(p3, "IMPORTE",  colI, y3 + 2, { size: 8, bold: true, color: muted });
    y3 -= 24;

    let currentPage = p3;
    let totalSinIva = 0;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (y3 < 220) {
        const np = pdfDoc.addPage([W, H]);
        pintarCabPag(np, "Inversión · continuación");
        currentPage = np;
        y3 = H - 110;
      }
      const concW = colU - colC - 14;
      const wConcepto = wrap(f.concepto, concW, 10, { bold: true });
      const altura = Math.max(22, wConcepto.length * 13 + 8);
      // Líneas sutiles entre filas (sin cebra)
      tR(currentPage, String(i + 1), colN + 28, y3, { size: 10, bold: true, color: muted });
      let yLine = y3;
      wConcepto.forEach(ln => { t(currentPage, ln, colC, yLine, { size: 10 }); yLine -= 13; });
      tR(currentPage, f.unidad || "ud", colU + 30, y3, { size: 9, color: muted });
      tR(currentPage, String(f.cantidad || "1"), colQ + 30, y3, { size: 9 });
      tR(currentPage, fmtEur(f.precio), colP + 30, y3, { size: 9 });
      tR(currentPage, fmtEur(f.importe), colI, y3, { size: 10, bold: true });
      totalSinIva += parseFloat(f.importe) || 0;
      y3 -= altura;
      currentPage.drawLine({ start: { x: M, y: y3 + 6 }, end: { x: W - M, y: y3 + 6 }, thickness: 0.3, color: lineSoft });
      y3 -= 4;
    }

    // ── Totales · caja con tres filas estilo mockup
    y3 -= 16;
    const totXLabel = colP - 60;
    const totXValor = colI;
    // Subtotal
    currentPage.drawRectangle({ x: totXLabel - 10, y: y3 - 4, width: totXValor - totXLabel + 10 + 10, height: 22, color: azulSuave });
    t(currentPage, "SUBTOTAL", totXLabel, y3 + 4, { size: 9, bold: true, color: azulOsc });
    tR(currentPage, fmtEur(subtotalObra), totXValor, y3 + 4, { size: 11, bold: true });
    y3 -= 30;
    // IVA
    currentPage.drawRectangle({ x: totXLabel - 10, y: y3 - 4, width: totXValor - totXLabel + 10 + 10, height: 22, color: azulSuave });
    t(currentPage, `IVA (${ivaPct}%)`, totXLabel, y3 + 4, { size: 9, bold: true, color: azulOsc });
    tR(currentPage, fmtEur(ivaObra || (totalObra - subtotalObra)), totXValor, y3 + 4, { size: 11, bold: true });
    y3 -= 30;
    // Total destacado
    currentPage.drawRectangle({ x: totXLabel - 10, y: y3 - 4, width: totXValor - totXLabel + 10 + 10, height: 28, color: azulOsc });
    t(currentPage, "TOTAL (IVA incluido)", totXLabel, y3 + 7, { size: 9, bold: true, color: white });
    tR(currentPage, fmtEur(totalObra), totXValor, y3 + 5, { size: 16, bold: true, color: white });
    y3 -= 50;

    // Badges con iconos al final (estilo mockup)
    if (y3 > 100) {
      const badges = [
        { ico: "herramienta", label1: "Mano de obra", label2: "cualificada" },
        { ico: "caja",        label1: "Materiales de", label2: "primera calidad" },
        { ico: "reciclaje",   label1: "Gestión de residuos", label2: "certificada" },
        { ico: "escudo",      label1: "Garantía de", label2: "los trabajos" },
      ];
      const bW = (W - 2 * M) / 4;
      for (let i = 0; i < badges.length; i++) {
        const xb = M + bW * i + bW / 2;
        const yb = y3 - 6;
        // círculo azul suave grande
        currentPage.drawCircle({ x: xb, y: yb, size: 18, color: azulSuave });
        ico(currentPage, badges[i].ico, xb, yb, 11, azul);
        t(currentPage, badges[i].label1, xb - helv.widthOfTextAtSize(badges[i].label1, 8) / 2, yb - 30, { size: 8, bold: true });
        t(currentPage, badges[i].label2, xb - helv.widthOfTextAtSize(badges[i].label2, 8) / 2, yb - 40, { size: 8, color: muted });
      }
    }

    pintarPiePag(currentPage, 3, 4);

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 4 — ACEPTACIÓN
    // ═══════════════════════════════════════════════════════
    const p4 = pdfDoc.addPage([W, H]);
    pintarCabPag(p4, "Aceptación");
    p4.drawLine({ start: { x: M, y: H - 70 }, end: { x: W - M, y: H - 70 }, thickness: 0.3, color: lineSoft });

    let y4 = H - 110;
    t(p4, "03", M, y4, { size: 22, bold: true, color: azul, serif: true });
    t(p4, "DOCUMENTO DE ACEPTACIÓN", M + 38, y4 + 5, { size: 11, bold: true, color: azulOsc });
    y4 -= 30;

    // Datos identificativos con líneas finas
    const filaId = (label, valor) => {
      t(p4, label, M, y4, { size: 8, bold: true, color: faint });
      t(p4, valor || "—", M + 130, y4, { size: 10, bold: true });
      y4 -= 18;
    };
    filaId("CÓDIGO DE OFERTA", obra.obra_id);
    filaId("NOMBRE DE LA OBRA", obra.nombre);
    filaId("CLIENTE", obra.cliente);
    filaId("FECHA DE EMISIÓN", fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()));
    y4 -= 8;

    const cuerpo = [
      "Mediante la firma del presente documento, el CLIENTE acepta el presupuesto identificado y autoriza el inicio del trabajo conforme a las condiciones descritas en la oferta.",
      `El importe total acordado asciende a ${fmtEur(totalObra)} (IVA incluido). La forma de pago se acordará previamente al inicio. Cualquier variación derivada de imprevistos en obra será notificada al CLIENTE y requerirá aprobación expresa.`,
    ];
    for (const par of cuerpo) {
      const lns = wrap(par, W - 2 * M, 10);
      for (const ln of lns) {
        if (!ln) continue;
        t(p4, ln, M, y4, { size: 10 });
        y4 -= 14;
      }
      y4 -= 6;
    }
    y4 -= 12;

    // Caja importe a aceptar (azul suave con número grande)
    p4.drawRectangle({ x: M, y: y4 - 50, width: W - 2 * M, height: 50, color: azulSuave });
    t(p4, "IMPORTE A ACEPTAR", M + 22, y4 - 20, { size: 9, bold: true, color: azulOsc });
    t(p4, "(IVA incluido)", M + 22 + helvBold.widthOfTextAtSize("IMPORTE A ACEPTAR", 9) + 6, y4 - 20,
      { size: 8, color: muted });
    tR(p4, fmtEur(totalObra), W - M - 22, y4 - 30, { size: 24, bold: true, color: azulOsc });
    y4 -= 70;

    // Firmas en cajas claras
    const colF = (W - 2 * M - 24) / 2;
    const yLin = y4 - 50;
    t(p4, "POR EL CLIENTE", M, y4, { size: 8, bold: true, color: azul });
    t(p4, "Firma", M, yLin, { size: 8, color: muted });
    p4.drawLine({ start: { x: M + 30, y: yLin + 3 }, end: { x: M + colF, y: yLin + 3 }, thickness: 0.5, color: ink });
    t(p4, "Nombre / DNI", M, yLin - 18, { size: 8, color: muted });
    p4.drawLine({ start: { x: M + 70, y: yLin - 15 }, end: { x: M + colF, y: yLin - 15 }, thickness: 0.5, color: ink });
    t(p4, "Fecha     /     /", M, yLin - 36, { size: 8, color: muted });
    p4.drawLine({ start: { x: M + 95, y: yLin - 33 }, end: { x: M + colF, y: yLin - 33 }, thickness: 0.5, color: ink });

    const xE = M + colF + 24;
    t(p4, "POR INSTALACIONES ARAUJO", xE, y4, { size: 8, bold: true, color: azul });
    t(p4, "Firma", xE, yLin, { size: 8, color: muted });
    p4.drawLine({ start: { x: xE + 30, y: yLin + 3 }, end: { x: xE + colF, y: yLin + 3 }, thickness: 0.5, color: ink });
    t(p4, "Nombre / DNI", xE, yLin - 18, { size: 8, color: muted });
    p4.drawLine({ start: { x: xE + 70, y: yLin - 15 }, end: { x: xE + colF, y: yLin - 15 }, thickness: 0.5, color: ink });
    t(p4, "Fecha     /     /", xE, yLin - 36, { size: 8, color: muted });
    p4.drawLine({ start: { x: xE + 95, y: yLin - 33 }, end: { x: xE + colF, y: yLin - 33 }, thickness: 0.5, color: ink });
    y4 = yLin - 60;

    // Condiciones con 3 mini-iconos
    if (y4 > 140) {
      p4.drawRectangle({ x: M, y: y4 - 60, width: W - 2 * M, height: 60, color: azulSuave });
      const condW = (W - 2 * M) / 3;
      const cond = [
        { ico: "check", t1: "Plazo de ejecución", t2: "7-10 días laborables" },
        { ico: "documento", t1: "Forma de pago", t2: "50% al inicio / 50%\na la finalización" },
        { ico: "calendario", t1: "Este presupuesto tiene", t2: "una validez de 30 días" },
      ];
      for (let i = 0; i < cond.length; i++) {
        const xc = M + i * condW + 16;
        const yc = y4 - 22;
        ico(p4, cond[i].ico, xc + 8, yc, 8, azul);
        t(p4, cond[i].t1, xc + 22, yc + 2, { size: 8, bold: true });
        const lns = String(cond[i].t2).split("\n");
        for (let k = 0; k < lns.length; k++) {
          t(p4, lns[k], xc + 22, yc - 10 - k * 10, { size: 8, color: muted });
        }
      }
      y4 -= 72;
    }

    // Pie con datos empresa
    p4.drawLine({ start: { x: M, y: 90 }, end: { x: W - M, y: 90 }, thickness: 0.3, color: lineSoft });
    t(p4, EMPRESA.razon, M, 76, { size: 9, bold: true, color: azulOsc });
    t(p4, `${EMPRESA.dir1} · ${EMPRESA.dir2} · ${EMPRESA.cp}`, M, 64, { size: 7, color: muted });
    t(p4, `${EMPRESA.email} · ${EMPRESA.web}`, M, 54, { size: 7, color: muted });

    // Numeración final ya pintada en pintarPiePag(); aquí sólo nos aseguramos para P4
    tR(p4, "4 / 4", W - M, 36, { size: 7, bold: true, color: muted });

    return await pdfDoc.save();
  }

  // ─── GET /presupuesto-pdf ──────────────────────────────────
  app.options("/api/ara-os/obras-otras/:id/presupuesto-pdf", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-pdf", async (req, res) => {
    responderCORS(res);
    try {
      const formato = req.query.formato === "detallado" ? "detallado" : "resumen";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const pdfBytes = await generarPdfPresupuesto(obra, partidas, formato);
      const slug = (obra.nombre || "").replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 50);
      const nombre = `oferta_${obra.obra_id}_${slug}_${formato}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${nombre}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (e) {
      console.error("[presupuesto-pdf]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── POST /enviar-presupuesto ──────────────────────────────
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

      const fmt = formato === "detallado" ? "detallado" : "resumen";
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const pdfBytes = await generarPdfPresupuesto(obra, partidas, fmt);

      const from = process.env.ARA_FROM_EMAIL || "presupuestos@araujofontaneria.es";
      const subject = asunto || `Presupuesto ${obra.obra_id} · ${obra.nombre}`;
      const html = `
        <p>Buenas,</p>
        <p>${(mensaje || "Adjuntamos el presupuesto solicitado. Quedamos a su disposición para cualquier aclaración.").replace(/\n/g, "<br/>")}</p>
        <p>Un saludo,<br/>Instalaciones Araujo</p>
      `;

      await resend.emails.send({
        from, to: email_destino, subject, html,
        attachments: [{
          filename: `oferta_${obra.obra_id}.pdf`,
          content: Buffer.from(pdfBytes).toString("base64"),
        }],
      });

      res.json({ ok: true, sent_to: email_destino });
    } catch (e) {
      console.error("[enviar-presupuesto]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
};
