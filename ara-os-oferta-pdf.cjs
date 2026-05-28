/**
 * ara-os-oferta-pdf.cjs · v0.3.0 (28/05/2026)
 * --------------------------------------------------------------
 * PDF de presupuesto para cliente final.
 *
 * v0.3 · rediseño "gran compañía" — espacio, jerarquía, números
 *        gigantes, sin cebra. Inspirado en Stripe/Linear/Vercel.
 *
 * Dos formatos:
 *   ?formato=resumen   → Mano de obra y Material agregados (default)
 *   ?formato=detallado → Una línea por partida (concepto + importe)
 *
 * Endpoints:
 *   GET  /api/ara-os/obras-otras/:id/presupuesto-pdf
 *   POST /api/ara-os/obras-otras/:id/enviar-presupuesto
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
    cif:      "B90488222",
    dir1:     "Avenida San Francisco Javier",
    dir2:     "Edificio Sevilla 2, Planta 6, Módulo 9",
    cp:       "41018 · Sevilla",
    email:    "presupuestos@araujofontaneria.es",
    web:      "araujofontaneria.es",
  };

  const LOGO_PATH = path.join(__dirname, "assets", "araujo-logo.png");
  let LOGO_BYTES = null;
  try { LOGO_BYTES = fs.readFileSync(LOGO_PATH); }
  catch (e) { console.warn("[oferta-pdf] no se pudo cargar logo:", e.message); }

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
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: rango,
    });
    return r.data.values || [];
  }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  function fmtEur(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("es-ES", {
      style: "currency", currency: "EUR",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtEurCompacto(n) {
    // Sólo el número con miles · sin símbolo · para el total gigante
    const v = Number(n) || 0;
    return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  }
  function fmtFechaCorta(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
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
    try { rows = await leerHoja("obras_otras_partidas_extra!A2:M"); }
    catch { return []; }
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
  //  GENERADOR DE PDF · v0.3 estilo "gran compañía"
  // ════════════════════════════════════════════════════════════
  async function generarPdfPresupuesto(obra, partidas, formato = "resumen") {
    const pdfDoc = await PDFDocument.create();
    const helv     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const serif    = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const serifB   = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Paleta moderna
    const azul       = rgb(0.020, 0.294, 0.529);  // #054B87 corporativo
    const azulOscuro = rgb(0.012, 0.180, 0.325);  // #032D52 hero
    const azulSuave  = rgb(0.93, 0.96, 0.99);
    const azulPalo   = rgb(0.95, 0.97, 0.99);     // cebra de tabla muy sutil
    const acento     = rgb(0.831, 0.231, 0.196);  // #D43B32 rojo acento para títulos sección
    const ink        = rgb(0.07, 0.07, 0.07);
    const muted      = rgb(0.42, 0.42, 0.45);
    const faint      = rgb(0.65, 0.65, 0.68);
    const lineSoft   = rgb(0.92, 0.92, 0.94);
    const white      = rgb(1, 1, 1);

    const W = 595.28, H = 841.89;
    const M = 56;

    let logoImg = null;
    if (LOGO_BYTES) {
      try { logoImg = await pdfDoc.embedPng(LOGO_BYTES); }
      catch (e) { /* sin logo */ }
    }

    // ── helpers de texto ─────────────────────────────────────
    function t(page, s, x, y, opts = {}) {
      let font = helv;
      if (opts.serif)        font = opts.bold ? serifB : serif;
      else if (opts.bold)    font = helvBold;
      page.drawText(String(s ?? ""), {
        x, y,
        size: opts.size || 10,
        font,
        color: opts.color || ink,
        maxWidth: opts.maxWidth,
        lineHeight: opts.lineHeight,
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
            out.push(actual);
            actual = w;
          } else { actual = cand; }
        }
        if (actual) out.push(actual);
        out.push("");
      }
      if (out[out.length - 1] === "") out.pop();
      return out;
    }

    function pintarPie(page, idx, total) {
      const yPie = 32;
      page.drawLine({ start: { x: M, y: yPie + 14 }, end: { x: W - M, y: yPie + 14 }, thickness: 0.3, color: lineSoft });
      t(page, EMPRESA.marca, M, yPie, { size: 7, bold: true, color: muted });
      t(page, `· ${EMPRESA.cif}`, M + helvBold.widthOfTextAtSize(EMPRESA.marca, 7) + 4, yPie, { size: 7, color: faint });
      t(page, EMPRESA.email, M, yPie - 9, { size: 7, color: faint });
      tR(page, `${idx} / ${total}`, W - M, yPie, { size: 7, bold: true, color: muted });
    }

    // Chevron/flecha azul oscura de cabecera (estilo construcción comercial)
    function pintarChevron(page, alturaH = 130) {
      const yTop = H;
      const yBot = H - alturaH;
      const xCut = W * 0.62;
      const cutDepth = 28;
      // SVG path: shape de flecha invertida ocupando arriba completa
      const path = `M 0 ${yTop} ` +
                   `L ${W} ${yTop} ` +
                   `L ${W} ${yBot} ` +
                   `L ${xCut} ${yBot} ` +
                   `L ${xCut - cutDepth} ${yBot + cutDepth} ` +
                   `L 0 ${yBot + cutDepth} Z`;
      page.drawSvgPath(path, { color: azulOscuro, x: 0, y: 0 });
      // Pequeño triángulo de acento en la punta (rojo)
      const pathAcc = `M ${xCut - cutDepth} ${yBot + cutDepth} ` +
                      `L ${xCut} ${yBot} ` +
                      `L ${xCut} ${yBot + cutDepth + 6} Z`;
      page.drawSvgPath(pathAcc, { color: acento, x: 0, y: 0 });
    }

    function pintarBarraLat(page) {
      // banda azul vertical muy fina decorativa en página interna
      page.drawRectangle({ x: 0, y: 0, width: 4, height: H, color: azul });
    }

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 1 — PORTADA con cabecera chevron
    // ═══════════════════════════════════════════════════════
    const p1 = pdfDoc.addPage([W, H]);
    pintarChevron(p1, 150);

    // Logo arriba derecha sobre el chevron azul
    if (logoImg) {
      const d = logoImg.scale(0.10);
      p1.drawImage(logoImg, { x: W - M - d.width, y: H - 36 - d.height, width: d.width, height: d.height });
    }

    // Título grande blanco serif "OFERTA COMERCIAL"
    t(p1, "Oferta", M, H - 70, { size: 38, serif: true, bold: true, color: white });
    t(p1, "comercial", M, H - 102, { size: 28, serif: true, color: rgb(0.75, 0.85, 0.95) });

    // Pill número oferta debajo del chevron
    let y = H - 200;
    const pillTxt = (obra.obra_id || "—").toUpperCase();
    const pillW = helvBold.widthOfTextAtSize(pillTxt, 9) + 26;
    p1.drawRectangle({ x: M, y: y, width: pillW, height: 22, color: azulSuave });
    t(p1, pillTxt, M + 13, y + 6, { size: 9, bold: true, color: azul });

    y -= 36;

    // ── Tarjeta unificada Cliente + Datos oferta (estilo Venngage)
    const cardH = 100;
    const cardY = y - cardH;
    p1.drawRectangle({
      x: M, y: cardY, width: W - 2 * M, height: cardH,
      color: white, borderColor: lineSoft, borderWidth: 0.6,
    });
    // Línea separadora interna vertical
    p1.drawLine({
      start: { x: W / 2, y: cardY + 16 }, end: { x: W / 2, y: cardY + cardH - 16 },
      thickness: 0.4, color: lineSoft,
    });
    // Columna izquierda: cliente
    let cy = cardY + cardH - 22;
    t(p1, "INFORMACIÓN DEL CLIENTE", M + 18, cy, { size: 7, bold: true, color: acento });
    cy -= 16;
    t(p1, obra.cliente || obra.nombre || "—", M + 18, cy, { size: 12, bold: true });
    cy -= 14;
    if (obra.direccion) { t(p1, obra.direccion, M + 18, cy, { size: 9, color: muted, maxWidth: W / 2 - 36 }); cy -= 11; }
    if (obra.telefono)  { t(p1, `Tel. ${obra.telefono}`, M + 18, cy, { size: 9, color: muted }); cy -= 11; }
    // Columna derecha: datos oferta
    const xD = W / 2 + 18;
    let dy = cardY + cardH - 22;
    t(p1, "DATOS DE LA OFERTA", xD, dy, { size: 7, bold: true, color: acento });
    dy -= 18;
    const filaOf = (label, valor) => {
      t(p1, label, xD, dy, { size: 8, bold: true, color: faint });
      t(p1, valor || "—", xD + 95, dy, { size: 10 });
      dy -= 14;
    };
    filaOf("Código", obra.obra_id);
    filaOf("Fecha", fmtFechaCorta(obra.created_at) || fmtFechaCorta(new Date().toISOString()));
    filaOf("Validez", "30 días");

    y = cardY - 32;

    // ── Nombre del proyecto grande
    t(p1, "PROYECTO", M, y, { size: 7, bold: true, color: acento });
    y -= 22;
    const tituloLineas = wrap(obra.nombre || "—", W - 2 * M, 22, { serif: true, bold: true });
    for (const ln of tituloLineas.slice(0, 3)) {
      t(p1, ln, M, y, { size: 22, serif: true, bold: true });
      y -= 26;
    }
    y -= 18;

    // ── Hero total
    const subtotalObra = parseNum(obra.subtotal_eur) || partidas.reduce((s, p) => s + (p.pvp || p.subtotal_eur_num), 0);
    const ivaObra      = parseNum(obra.iva_eur);
    const totalObra    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotalObra + ivaObra);
    const ivaPct       = subtotalObra > 0 ? Math.round((ivaObra / subtotalObra) * 100) : 10;

    const heroH = 110;
    const heroY = y - heroH;
    p1.drawRectangle({ x: M, y: heroY, width: W - 2 * M, height: heroH, color: azulOscuro });
    // Banda lateral acento rojo
    p1.drawRectangle({ x: M, y: heroY, width: 4, height: heroH, color: acento });
    t(p1, "IMPORTE TOTAL", M + 24, heroY + heroH - 24, { size: 8, bold: true, color: rgb(0.7, 0.85, 1) });
    t(p1, "IVA INCLUIDO", M + 24, heroY + heroH - 36, { size: 7, color: rgb(0.55, 0.7, 0.9) });
    const totStr = fmtEurCompacto(totalObra);
    t(p1, totStr, M + 24, heroY + 28, { size: 42, bold: true, color: white });
    const totW = helvBold.widthOfTextAtSize(totStr, 42);
    t(p1, "€", M + 24 + totW + 8, heroY + 28, { size: 22, color: rgb(0.7, 0.85, 1) });
    // Mini desglose a la derecha
    tR(p1, "Base imponible", W - M - 24, heroY + heroH - 24, { size: 8, color: rgb(0.7, 0.85, 1), bold: true });
    tR(p1, fmtEur(subtotalObra), W - M - 24, heroY + heroH - 38, { size: 11, bold: true, color: white });
    tR(p1, `IVA ${ivaPct}%`, W - M - 24, heroY + heroH - 56, { size: 8, color: rgb(0.7, 0.85, 1), bold: true });
    tR(p1, fmtEur(ivaObra || (totalObra - subtotalObra)), W - M - 24, heroY + heroH - 70, { size: 11, bold: true, color: white });

    pintarPie(p1, 1, 3);

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 2 — ALCANCE + INVERSIÓN
    // ═══════════════════════════════════════════════════════
    const p2 = pdfDoc.addPage([W, H]);
    pintarBarraLat(p2);

    // Mini-cabecera coherente
    if (logoImg) {
      const d = logoImg.scale(0.05);
      p2.drawImage(logoImg, { x: M, y: H - 50 - d.height + 10, width: d.width, height: d.height });
    }
    t(p2, EMPRESA.marca.toUpperCase(), M + 38, H - 42, { size: 8, bold: true, color: muted });
    t(p2, `Oferta · ${obra.obra_id || ""}`, M + 38, H - 52, { size: 7, color: faint });
    tR(p2, (obra.cliente || "").toUpperCase(), W - M, H - 42, { size: 8, color: faint, bold: true });
    tR(p2, fmtFechaCorta(obra.created_at) || "", W - M, H - 52, { size: 7, color: faint });
    p2.drawLine({ start: { x: M, y: H - 62 }, end: { x: W - M, y: H - 62 }, thickness: 0.3, color: lineSoft });

    y = H - 100;

    // Header sección con cuadradito rojo
    function tituloSeccion(page, num, label, yy) {
      page.drawRectangle({ x: M, y: yy - 2, width: 14, height: 14, color: azulOscuro });
      t(page, num, M + 3, yy + 1, { size: 8, bold: true, color: white });
      t(page, label, M + 24, yy + 1, { size: 11, bold: true, color: ink });
      page.drawLine({ start: { x: M, y: yy - 10 }, end: { x: W - M, y: yy - 10 }, thickness: 0.8, color: azulOscuro });
    }

    tituloSeccion(p2, "01", "ALCANCE DEL TRABAJO", y);
    y -= 30;

    const descripcion = obra.factura_descripcion || obra.notas || "(Sin descripción)";
    for (const parrafo of String(descripcion).split(/\n+/)) {
      if (!parrafo.trim()) { y -= 6; continue; }
      const esBullet = /^[\-•*]/.test(parrafo.trim());
      const xT = esBullet ? M + 18 : M;
      const limpio = esBullet ? parrafo.trim().replace(/^[\-•*]\s*/, "") : parrafo.trim();
      const lineas = wrap(limpio, W - 2 * M - (esBullet ? 18 : 0), 10);
      let primera = true;
      for (const ln of lineas) {
        if (!ln) continue;
        if (y < 240) break;
        if (primera && esBullet) {
          p2.drawCircle({ x: M + 5, y: y + 3, size: 1.8, color: acento });
        }
        t(p2, ln, xT, y, { size: 10, color: ink });
        y -= 14;
        primera = false;
      }
      y -= 4;
    }

    y -= 28;
    tituloSeccion(p2, "02", formato === "detallado" ? "DETALLE POR PARTIDAS" : "INVERSIÓN", y);
    y -= 30;

    // ── Filas según formato
    let filas = [];
    if (formato === "resumen" && partidas.length > 0) {
      let totalMO = 0, totalMat = 0;
      const directas = [];
      for (const p of partidas) {
        if (p.precio_directo_num > 0) directas.push(p);
        else {
          totalMO  += p.horas_num * p.precio_hora_num;
          totalMat += p.material_eur_num * (1 + p.margen_material_num / 100);
        }
      }
      if (totalMO > 0)  filas.push({ concepto: "Mano de obra", detalle: "Ejecución del trabajo según especificaciones del alcance", importe: totalMO });
      if (totalMat > 0) filas.push({ concepto: "Material y suministros", detalle: "Material aportado · incluye gestión de pedidos a proveedor", importe: totalMat });
      directas.forEach(p => filas.push({ concepto: p.concepto || "—", importe: p.precio_directo_num }));
    } else if (partidas.length > 0) {
      filas = partidas.map(p => ({ concepto: p.concepto || "—", importe: p.pvp || p.subtotal_eur_num }));
    } else {
      const sub = parseNum(obra.subtotal_eur) || parseNum(obra.total_eur) || parseNum(obra.importe);
      filas = [{ concepto: obra.nombre || "Servicios profesionales", importe: sub }];
    }

    // Tabla estilo Venngage: header oscuro + cebra azul muy suave
    const xConcepto = M;
    const xCantidad = W - M - 200;
    const xPrecio   = W - M - 110;
    const xTotal    = W - M;

    // Header
    p2.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 26, color: azulOscuro });
    t(p2, "DESCRIPCIÓN", xConcepto + 12, y + 5, { size: 8, bold: true, color: white });
    tR(p2, "CANT.", xCantidad + 60, y + 5, { size: 8, bold: true, color: white });
    tR(p2, "PRECIO UNIT.", xPrecio + 80, y + 5, { size: 8, bold: true, color: white });
    tR(p2, "IMPORTE", xTotal - 8, y + 5, { size: 8, bold: true, color: white });
    y -= 26;

    let currentPage = p2;
    let zebra = false;
    for (const f of filas) {
      if (y < 200) {
        const np = pdfDoc.addPage([W, H]);
        pintarBarraLat(np);
        if (logoImg) {
          const d = logoImg.scale(0.05);
          np.drawImage(logoImg, { x: M, y: H - 50 - d.height + 10, width: d.width, height: d.height });
        }
        t(np, EMPRESA.marca.toUpperCase(), M + 38, H - 42, { size: 8, bold: true, color: muted });
        tR(np, `${obra.obra_id || ""} · CONTINUACIÓN`, W - M, H - 42, { size: 8, color: faint, bold: true });
        np.drawLine({ start: { x: M, y: H - 62 }, end: { x: W - M, y: H - 62 }, thickness: 0.3, color: lineSoft });
        currentPage = np;
        y = H - 100;
        // re-pintar header de tabla
        currentPage.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 26, color: azulOscuro });
        t(currentPage, "DESCRIPCIÓN", xConcepto + 12, y + 5, { size: 8, bold: true, color: white });
        tR(currentPage, "CANT.", xCantidad + 60, y + 5, { size: 8, bold: true, color: white });
        tR(currentPage, "PRECIO UNIT.", xPrecio + 80, y + 5, { size: 8, bold: true, color: white });
        tR(currentPage, "IMPORTE", xTotal - 8, y + 5, { size: 8, bold: true, color: white });
        y -= 26;
      }
      const concW = xCantidad - xConcepto - 14;
      const wConcepto = wrap(f.concepto, concW, 10, { bold: true });
      const wDetalle  = f.detalle ? wrap(f.detalle, concW, 8.5) : [];
      const altura = Math.max(28, wConcepto.length * 13 + wDetalle.length * 11 + 12);
      if (zebra) {
        currentPage.drawRectangle({ x: M, y: y - altura + 8, width: W - 2 * M, height: altura, color: azulPalo });
      }
      zebra = !zebra;
      let yLine = y - 2;
      wConcepto.forEach(ln => { t(currentPage, ln, xConcepto + 12, yLine, { size: 10, bold: true }); yLine -= 13; });
      wDetalle.forEach(ln => { t(currentPage, ln, xConcepto + 12, yLine, { size: 8.5, color: muted }); yLine -= 11; });
      const yMid = y - 4;
      tR(currentPage, "1", xCantidad + 60, yMid, { size: 9, color: muted });
      tR(currentPage, fmtEur(f.importe), xPrecio + 80, yMid, { size: 10 });
      tR(currentPage, fmtEur(f.importe), xTotal - 8, yMid, { size: 10, bold: true });
      y -= altura;
    }

    // Fila total dentro de la tabla con fondo azul oscuro
    currentPage.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 26, color: azulOscuro });
    t(currentPage, "TOTAL ESTIMADO", xConcepto + 12, y + 5, { size: 9, bold: true, color: white });
    tR(currentPage, fmtEur(totalObra), xTotal - 8, y + 5, { size: 12, bold: true, color: white });
    y -= 36;

    // Desglose IVA debajo a la derecha
    const xValor = W - M;
    const xLabel = W - M - 200;
    t(currentPage, "Base imponible", xLabel, y, { size: 9, color: muted });
    tR(currentPage, fmtEur(subtotalObra), xValor, y, { size: 10, bold: true });
    y -= 14;
    t(currentPage, `IVA ${ivaPct}%`, xLabel, y, { size: 9, color: muted });
    tR(currentPage, fmtEur(ivaObra || (totalObra - subtotalObra)), xValor, y, { size: 10, bold: true });

    // ═══════════════════════════════════════════════════════
    //  PÁGINA FINAL — ACEPTACIÓN
    // ═══════════════════════════════════════════════════════
    const pF = pdfDoc.addPage([W, H]);
    pintarBarraLat(pF);
    if (logoImg) {
      const d = logoImg.scale(0.05);
      pF.drawImage(logoImg, { x: M, y: H - 50 - d.height + 10, width: d.width, height: d.height });
    }
    t(pF, EMPRESA.marca.toUpperCase(), M + 38, H - 42, { size: 8, bold: true, color: muted });
    tR(pF, `${obra.obra_id || ""} · ACEPTACIÓN`, W - M, H - 42, { size: 8, color: faint, bold: true });
    pF.drawLine({ start: { x: M, y: H - 62 }, end: { x: W - M, y: H - 62 }, thickness: 0.3, color: lineSoft });

    let yA = H - 100;
    tituloSeccion(pF, "03", "DOCUMENTO DE ACEPTACIÓN", yA);
    yA -= 36;

    // Caja resumen identificación con borde
    pF.drawRectangle({
      x: M, y: yA - 86, width: W - 2 * M, height: 86,
      color: azulSuave, borderColor: azul, borderWidth: 0.5,
    });
    const filaId = (label, valor, yy) => {
      t(pF, label, M + 18, yy, { size: 7, bold: true, color: muted });
      t(pF, valor || "—", M + 130, yy, { size: 10, bold: true });
    };
    filaId("CÓDIGO DE OFERTA", obra.obra_id, yA - 18);
    filaId("PROYECTO", obra.nombre, yA - 36);
    filaId("CLIENTE", obra.cliente, yA - 54);
    filaId("FECHA DE EMISIÓN", fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()), yA - 72);
    yA -= 110;

    // Cuerpo cortés
    const cuerpo = [
      "Mediante la firma del presente documento, el CLIENTE acepta el presupuesto identificado y autoriza el inicio del trabajo conforme a las condiciones descritas en la oferta.",
      `El importe total acordado asciende a ${fmtEur(totalObra)} (IVA incluido). La forma de pago se acordará previamente al inicio. Cualquier variación derivada de imprevistos en obra será notificada al CLIENTE y requerirá aprobación expresa.`,
    ];
    for (const par of cuerpo) {
      const lns = wrap(par, W - 2 * M, 10);
      for (const ln of lns) {
        if (!ln) continue;
        t(pF, ln, M, yA, { size: 10, color: ink });
        yA -= 14;
      }
      yA -= 6;
    }
    yA -= 16;

    // Caja importe grande de aceptación
    pF.drawRectangle({ x: M, y: yA - 60, width: W - 2 * M, height: 60, color: azulOscuro });
    pF.drawRectangle({ x: M, y: yA - 60, width: 4, height: 60, color: acento });
    t(pF, "IMPORTE A ACEPTAR", M + 24, yA - 22, { size: 8, bold: true, color: rgb(0.7, 0.85, 1) });
    tR(pF, fmtEur(totalObra), W - M - 24, yA - 36, { size: 26, bold: true, color: white });
    yA -= 90;

    // Firmas
    const colF = (W - 2 * M - 30) / 2;
    const yLin = yA - 70;
    t(pF, "POR EL CLIENTE", M, yA, { size: 8, bold: true, color: acento });
    pF.drawLine({ start: { x: M, y: yLin }, end: { x: M + colF, y: yLin }, thickness: 0.6, color: ink });
    t(pF, "Firma · Nombre · DNI · Fecha", M, yLin - 14, { size: 7, color: faint });
    const xE = M + colF + 30;
    t(pF, `POR ${EMPRESA.marca.toUpperCase()}`, xE, yA, { size: 8, bold: true, color: acento });
    pF.drawLine({ start: { x: xE, y: yLin }, end: { x: xE + colF, y: yLin }, thickness: 0.6, color: ink });
    t(pF, "Firma · Nombre · DNI · Fecha", xE, yLin - 14, { size: 7, color: faint });

    // Datos empresa abajo (estilo footer compañía)
    pF.drawLine({ start: { x: M, y: 105 }, end: { x: W - M, y: 105 }, thickness: 0.3, color: lineSoft });
    t(pF, EMPRESA.razon, M, 90, { size: 9, bold: true, color: azul });
    t(pF, `CIF ${EMPRESA.cif}`, M, 78, { size: 7, color: muted });
    t(pF, `${EMPRESA.dir1} · ${EMPRESA.dir2} · ${EMPRESA.cp}`, M, 68, { size: 7, color: muted });
    t(pF, `${EMPRESA.email} · ${EMPRESA.web}`, M, 58, { size: 7, color: muted });

    // Numeración y pie en todas las páginas
    const totalPaginas = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((pg, i) => {
      // Sólo añadimos numeración a la derecha (el pie principal está en P1 y los datos en final)
      tR(pg, `${i + 1} / ${totalPaginas}`, W - M, 32, { size: 7, bold: true, color: muted });
    });

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
        from,
        to: email_destino,
        subject,
        html,
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
