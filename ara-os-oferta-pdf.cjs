/**
 * ara-os-oferta-pdf.cjs · v0.2.0 (28/05/2026)
 * --------------------------------------------------------------
 * Generación del PDF de presupuesto y envío por email.
 *
 * v0.2 · rediseño corporativo
 *   - Branding Araujo (azul #054B87) + logo en cabecera
 *   - Bloques Cliente / Datos de la Oferta como tarjetas
 *   - Tabla de partidas con cebra y headers claros
 *   - Caja total destacada en azul corporativo
 *   - Página de aceptación con caja para firma
 *   - Pie con datos legales y paginación
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

  // ─── Constantes corporativas ────────────────────────────────
  const EMPRESA = {
    razon:    "Ara Corporate Sociedad de Inversiones SL",
    cif:      "B90488222",
    dir1:     "Avenida San Francisco Javier",
    dir2:     "Edificio Sevilla 2, Planta 6, Módulo 9",
    cp:       "41018 · Sevilla",
    pais:     "España",
    email:    "presupuestos@araujofontaneria.es",
  };

  const LOGO_PATH = path.join(__dirname, "assets", "araujo-logo.png");
  let LOGO_BYTES = null;
  try { LOGO_BYTES = fs.readFileSync(LOGO_PATH); }
  catch (e) { console.warn("[oferta-pdf] no se pudo cargar logo:", e.message); }

  // ─── Sheets helpers ─────────────────────────────────────────
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
  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function parseNum(v) {
    const n = parseFloat(String(v || "0").replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  // ─── HEADERS ───────────────────────────────────────────────
  const HEADERS_OO = [
    "obra_id","nombre","cliente","telefono","direccion","tipo","importe","fase",
    "created_at","created_by","borrado","fecha_inicio","fecha_fin_estimada",
    "fecha_fin_real","fecha_facturada","fecha_cobrada","holded_invoice_id","notas",
    "subtotal_eur","iva_eur","total_eur","tags_holded","facturada","cobrada",
    "codigo_ot","dias_estimados","holded_contact_id","holded_series_id",
    "beneficio_pct","factura_descripcion","holded_invoice_emitida_id",
  ];
  // Schema partidas v0.7.0: A extra_id, B obra_id, C concepto, D horas,
  // E precio_hora, F material_eur, G margen_material, H subtotal_eur,
  // I created_at, J borrado
  const HEADERS_PARTIDAS = [
    "extra_id","obra_id","concepto","horas","precio_hora",
    "material_eur","margen_material","subtotal_eur",
    "created_at","borrado",
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
    try { rows = await leerHoja("obras_otras_partidas_extra!A2:J"); }
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
        out.push(p);
      }
    }
    return out;
  }

  // ─── Generador de PDF ──────────────────────────────────────
  async function generarPdfPresupuesto(obra, partidas) {
    const pdfDoc = await PDFDocument.create();
    const helv     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Paleta corporativa
    const azul       = rgb(0.020, 0.294, 0.529);  // #054B87
    const azulSuave  = rgb(0.91, 0.94, 0.98);
    const ink        = rgb(0.10, 0.10, 0.10);
    const muted      = rgb(0.40, 0.40, 0.40);
    const faint      = rgb(0.60, 0.60, 0.60);
    const line       = rgb(0.85, 0.85, 0.85);
    const cebra      = rgb(0.97, 0.97, 0.97);

    // Dimensiones A4
    const W = 595.28, H = 841.89, M = 50;

    // Logo embebido (una vez)
    let logoImg = null;
    if (LOGO_BYTES) {
      try { logoImg = await pdfDoc.embedPng(LOGO_BYTES); }
      catch (e) { /* sin logo */ }
    }

    // Helpers de página ─────────────────────────────────────
    function nuevaPagina() {
      const page = pdfDoc.addPage([W, H]);
      pintarCabecera(page);
      pintarPie(page);
      return { page, y: H - 150 };  // y debajo de la cabecera
    }

    function pintarCabecera(page) {
      // Banda superior azul fina
      page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: azul });

      // Logo
      if (logoImg) {
        const dim = logoImg.scale(0.10);  // 512 * 0.10 = 51 px
        page.drawImage(logoImg, { x: M, y: H - 24 - dim.height, width: dim.width, height: dim.height });
      }

      // Razón social a la derecha
      const xR = W - M;
      let yR = H - 35;
      drawRight(page, EMPRESA.razon, xR, yR, { size: 10, bold: true, color: azul });
      yR -= 14;
      page.drawLine({ start: { x: xR - 220, y: yR + 4 }, end: { x: xR, y: yR + 4 }, thickness: 0.5, color: azul });
      drawRight(page, EMPRESA.cif, xR, yR - 6, { size: 9, bold: true });
      yR -= 18;
      drawRight(page, EMPRESA.dir1, xR, yR, { size: 8, color: muted }); yR -= 10;
      drawRight(page, EMPRESA.dir2, xR, yR, { size: 8, color: muted }); yR -= 10;
      drawRight(page, EMPRESA.cp,   xR, yR, { size: 8, color: muted }); yR -= 10;
      drawRight(page, EMPRESA.pais, xR, yR, { size: 8, color: muted });
    }

    function pintarPie(page) {
      const yPie = 40;
      page.drawLine({ start: { x: M, y: yPie + 12 }, end: { x: W - M, y: yPie + 12 }, thickness: 0.5, color: line });
      page.drawText(`${EMPRESA.razon} · ${EMPRESA.cif} · ${EMPRESA.email}`, {
        x: M, y: yPie, size: 7, font: helv, color: faint,
      });
    }

    function drawText(page, s, x, y, opts = {}) {
      page.drawText(String(s ?? ""), {
        x, y,
        size: opts.size || 10,
        font: opts.bold ? helvBold : helv,
        color: opts.color || ink,
        maxWidth: opts.maxWidth,
      });
    }
    function drawRight(page, s, xRight, y, opts = {}) {
      const f = opts.bold ? helvBold : helv;
      const size = opts.size || 10;
      const w = f.widthOfTextAtSize(String(s ?? ""), size);
      drawText(page, s, xRight - w, y, opts);
    }
    function drawCenter(page, s, xCenter, y, opts = {}) {
      const f = opts.bold ? helvBold : helv;
      const size = opts.size || 10;
      const w = f.widthOfTextAtSize(String(s ?? ""), size);
      drawText(page, s, xCenter - w / 2, y, opts);
    }
    function wrap(s, maxW, size = 10, bold = false) {
      const f = bold ? helvBold : helv;
      const palabras = String(s || "").split(/\s+/);
      const lineas = [];
      let actual = "";
      for (const w of palabras) {
        const cand = actual ? actual + " " + w : w;
        if (f.widthOfTextAtSize(cand, size) > maxW && actual) {
          lineas.push(actual);
          actual = w;
        } else { actual = cand; }
      }
      if (actual) lineas.push(actual);
      return lineas;
    }

    function tarjeta(page, x, y, w, h, titulo) {
      // borde azul superior
      page.drawRectangle({ x, y: y + h - 22, width: w, height: 22, color: azul });
      drawText(page, titulo, x + 10, y + h - 16, { size: 10, bold: true, color: rgb(1, 1, 1) });
      // borde caja
      page.drawRectangle({ x, y, width: w, height: h - 22, borderColor: line, borderWidth: 0.5, color: rgb(1, 1, 1) });
    }

    // ─── PÁGINA 1 ────────────────────────────────────────────
    let { page, y } = nuevaPagina();

    // Bloques Cliente / Datos oferta
    const colW = (W - 2 * M - 14) / 2;
    const colH = 110;
    tarjeta(page, M, y - colH, colW, colH, "Cliente");
    tarjeta(page, M + colW + 14, y - colH, colW, colH, "Datos de la Oferta");

    // Contenido cliente
    let yc = y - 22 - 14;
    drawText(page, (obra.cliente || obra.nombre || "—").toUpperCase(), M + 10, yc, { size: 11, bold: true });
    yc -= 16;
    if (obra.direccion) { drawText(page, obra.direccion, M + 10, yc, { size: 9, color: muted }); yc -= 12; }
    if (obra.telefono)  { drawText(page, `Tel. ${obra.telefono}`, M + 10, yc, { size: 9, color: muted }); yc -= 12; }

    // Contenido datos oferta
    const xD = M + colW + 14;
    let yd = y - 22 - 14;
    const filaOferta = (label, valor, yy) => {
      page.drawRectangle({ x: xD, y: yy - 4, width: 90, height: 14, color: azulSuave });
      drawText(page, label, xD + 8, yy, { size: 9, bold: true });
      drawText(page, valor, xD + 100, yy, { size: 9 });
    };
    filaOferta("Nº oferta", obra.obra_id || "—", yd); yd -= 18;
    filaOferta("Fecha", fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()), yd); yd -= 18;
    filaOferta("Tipo", String(obra.tipo || "—").toUpperCase(), yd); yd -= 18;
    if (obra.codigo_ot) { filaOferta("Cód. OT", obra.codigo_ot, yd); yd -= 18; }

    y = y - colH - 24;

    // Resumen de la oferta
    seccionTitulo(page, "Resumen de la oferta", y);
    y -= 22;
    drawText(page, "Nombre oferta", M, y, { size: 9, bold: true, color: muted });
    drawText(page, obra.nombre || "—", M + 110, y, { size: 10, bold: true });
    y -= 24;

    // Descripción
    const descripcion = obra.factura_descripcion || obra.notas || "";
    if (descripcion) {
      seccionTitulo(page, "Descripción de la oferta", y);
      y -= 22;
      const lineas = [];
      for (const parrafo of String(descripcion).split(/\n+/)) {
        if (!parrafo.trim()) { lineas.push(""); continue; }
        const esBullet = /^[\-•*]/.test(parrafo.trim());
        const sangrado = esBullet ? 12 : 0;
        const limpio = esBullet ? parrafo.trim().replace(/^[\-•*]\s*/, "") : parrafo.trim();
        const ww = wrap(limpio, W - 2 * M - sangrado, 9.5);
        ww.forEach((ln, i) => {
          if (esBullet && i === 0) lineas.push("•|" + ln);
          else lineas.push((esBullet ? "  " : "") + ln);
        });
      }
      for (const ln of lineas) {
        if (y < 200) { ({ page, y } = nuevaPagina()); }
        if (ln.startsWith("•|")) {
          drawText(page, "•", M, y, { size: 10, bold: true, color: azul });
          drawText(page, ln.slice(2), M + 12, y, { size: 9.5 });
        } else if (ln) {
          drawText(page, ln, M, y, { size: 9.5 });
        }
        y -= 12;
      }
      y -= 8;
    }

    // ─── PÁGINA 2 · Detalle económico ────────────────────────
    ({ page, y } = nuevaPagina());
    // Cliente arriba (mini)
    seccionMiniCliente(page, y, obra);
    y -= 50;
    seccionTitulo(page, "Detalle económico", y);
    y -= 22;

    // Tabla
    const xConcepto = M;
    const xHoras    = W - M - 230;
    const xPrecio   = W - M - 165;
    const xMaterial = W - M - 100;
    const xSubtotal = W - M;

    // Header
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 22, color: azul });
    drawText(page, "Descripción", xConcepto + 8, y + 4, { size: 9, bold: true, color: rgb(1, 1, 1) });
    drawRight(page, "Horas",    xHoras + 50,    y + 4, { size: 9, bold: true, color: rgb(1, 1, 1) });
    drawRight(page, "Precio/h", xPrecio + 55,   y + 4, { size: 9, bold: true, color: rgb(1, 1, 1) });
    drawRight(page, "Material", xMaterial + 80, y + 4, { size: 9, bold: true, color: rgb(1, 1, 1) });
    drawRight(page, "Subtotal", xSubtotal,      y + 4, { size: 9, bold: true, color: rgb(1, 1, 1) });
    y -= 22;

    let zebra = false;
    if (partidas.length > 0) {
      for (const p of partidas) {
        if (y < 180) {
          ({ page, y } = nuevaPagina());
          seccionMiniCliente(page, y, obra);
          y -= 50;
        }
        const concWidth = xHoras - xConcepto - 14;
        const concLineas = wrap(p.concepto || "—", concWidth, 9);
        const altura = Math.max(18, concLineas.length * 12 + 6);
        if (zebra) {
          page.drawRectangle({ x: M, y: y - altura + 8, width: W - 2 * M, height: altura, color: cebra });
        }
        zebra = !zebra;

        let yLine = y;
        concLineas.forEach((ln, i) => {
          drawText(page, ln, xConcepto + 8, yLine, { size: 9 });
          yLine -= 12;
        });
        const yMid = y;
        drawRight(page, p.horas_num ? `${p.horas_num.toFixed(2)}` : "—", xHoras + 50, yMid, { size: 9 });
        drawRight(page, p.precio_hora_num ? fmtEur(p.precio_hora_num) : "—", xPrecio + 55, yMid, { size: 9 });
        drawRight(page,
          p.material_eur_num ? fmtEur(p.material_eur_num * (1 + p.margen_material_num / 100)) : "—",
          xMaterial + 80, yMid, { size: 9 });
        drawRight(page, fmtEur(p.subtotal_eur_num), xSubtotal, yMid, { size: 9, bold: true });
        y -= altura;
      }
    } else {
      drawText(page, obra.nombre || "Servicios profesionales", xConcepto + 8, y, { size: 9 });
      const sub = parseNum(obra.subtotal_eur) || parseNum(obra.total_eur) || parseNum(obra.importe);
      drawRight(page, fmtEur(sub), xSubtotal, y, { size: 9, bold: true });
      y -= 20;
    }

    // Línea cierre tabla
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: line });
    y -= 24;

    // ─── Resumen económico ──────────────────────────────────
    if (y < 200) { ({ page, y } = nuevaPagina()); seccionMiniCliente(page, y, obra); y -= 50; }
    seccionTitulo(page, "Resumen económico", y);
    y -= 26;
    drawText(page, "Suma de las partidas descritas en el detalle económico:", M, y, { size: 9, color: muted });
    y -= 24;

    const subtotalObra = parseNum(obra.subtotal_eur) || partidas.reduce((s, p) => s + p.subtotal_eur_num, 0);
    const ivaObra      = parseNum(obra.iva_eur);
    const totalObra    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotalObra + ivaObra);
    const ivaPct       = subtotalObra > 0 ? Math.round((ivaObra / subtotalObra) * 100) : 10;

    bloqueTotal(page, M + 130, y, 320, subtotalObra, ivaObra || (totalObra - subtotalObra), totalObra, ivaPct);
    y -= 110;

    // ─── PÁGINA 3 · Aceptación ──────────────────────────────
    ({ page, y } = nuevaPagina());
    seccionMiniCliente(page, y, obra);
    y -= 50;
    seccionTitulo(page, "Documento de aceptación", y);
    y -= 26;

    // Tabla compacta de identificación
    const filaIdent = (label, valor, yy) => {
      page.drawRectangle({ x: M, y: yy - 4, width: 110, height: 18, color: azulSuave });
      drawText(page, label, M + 8, yy, { size: 9, bold: true });
      drawText(page, valor, M + 120, yy, { size: 9 });
    };
    filaIdent("Código oferta", obra.obra_id || "—", y); y -= 22;
    filaIdent("Nombre oferta", obra.nombre || "—", y); y -= 22;
    filaIdent("Cliente", obra.cliente || "—", y); y -= 30;

    // Cuerpo
    drawText(page, "Muy Sres. nuestros:", M, y, { size: 10 }); y -= 18;
    const intro = `Agradecemos la confianza depositada al encargarnos la redacción del presupuesto para ${obra.nombre || ""} y, de acuerdo con las especificaciones de nuestra oferta que obra en su poder y cuyo código es ${obra.obra_id || ""}.`;
    for (const ln of wrap(intro, W - 2 * M, 10)) { drawText(page, ln, M, y, { size: 10 }); y -= 13; }
    y -= 8;
    drawText(page, "IMPORTE", M, y, { size: 10, bold: true, color: azul });
    drawText(page, "  El precio resultante, en las condiciones descritas, es el siguiente:", M + 60, y, { size: 9, color: muted });
    y -= 22;

    bloqueTotal(page, M + 130, y, 320, subtotalObra, ivaObra || (totalObra - subtotalObra), totalObra, ivaPct);
    y -= 130;

    // Firmas
    const wFirma = (W - 2 * M - 30) / 2;
    drawText(page, "CONFORME CLIENTE", M, y, { size: 11, bold: true, color: azul });
    drawText(page, EMPRESA.razon, M + wFirma + 30, y, { size: 11, bold: true, color: azul });
    page.drawLine({ start: { x: M, y: y - 3 }, end: { x: M + 160, y: y - 3 }, thickness: 0.7, color: azul });
    page.drawLine({ start: { x: M + wFirma + 30, y: y - 3 }, end: { x: M + wFirma + 30 + 180, y: y - 3 }, thickness: 0.7, color: azul });
    y -= 80;
    drawText(page, "Fdo:", M, y, { size: 9 });
    drawText(page, "Fdo:", M + wFirma + 30, y, { size: 9 });
    y -= 14;
    drawText(page, "DNI/NIF:", M, y, { size: 9 });
    drawText(page, "DNI/NIF:", M + wFirma + 30, y, { size: 9 });

    // ─── Numeración de páginas ──────────────────────────────
    const total = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((p, i) => {
      const s = `${i + 1} de ${total}`;
      const w = helv.widthOfTextAtSize(s, 8);
      p.drawText(s, { x: W - M - w, y: 28, size: 8, font: helv, color: faint });
    });

    return await pdfDoc.save();

    // ─── helpers internos que cierran sobre `helvBold` etc. ─
    function seccionTitulo(page, titulo, yy) {
      page.drawLine({ start: { x: M, y: yy + 16 }, end: { x: W - M, y: yy + 16 }, thickness: 0.5, color: azul });
      drawText(page, titulo, M, yy, { size: 11, bold: true, color: azul });
      page.drawLine({ start: { x: M, y: yy - 4 }, end: { x: W - M, y: yy - 4 }, thickness: 0.5, color: line });
    }
    function seccionMiniCliente(page, yy, obra) {
      // Mini-tarjeta de identificación cuando hay múltiples páginas
      tarjeta(page, M, yy - 40, (W - 2 * M - 14) / 2, 40, "Cliente");
      tarjeta(page, M + (W - 2 * M - 14) / 2 + 14, yy - 40, (W - 2 * M - 14) / 2, 40, "Datos de la Oferta");
      drawText(page, (obra.cliente || obra.nombre || "—").toUpperCase(), M + 10, yy - 32, { size: 9, bold: true });
      drawText(page, obra.direccion || "", M + 10, yy - 44, { size: 8, color: muted });
      const xD = M + (W - 2 * M - 14) / 2 + 14;
      drawText(page, `Nº ${obra.obra_id || "—"}  ·  ${fmtFecha(obra.created_at) || ""}`, xD + 10, yy - 32, { size: 9, bold: true });
    }
    function bloqueTotal(page, x, yy, ancho, sub, iva, tot, ivaP) {
      const filaH = 28;
      const colLabelW = 130;
      // Sub
      page.drawRectangle({ x, y: yy - filaH + 4, width: colLabelW, height: filaH, color: azul });
      drawText(page, "Base Imponible", x + 12, yy - 14, { size: 10, bold: true, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: x + colLabelW, y: yy - filaH + 4, width: ancho - colLabelW, height: filaH, borderColor: line, borderWidth: 0.5, color: rgb(1, 1, 1) });
      drawRight(page, fmtEur(sub), x + ancho - 12, yy - 14, { size: 10, bold: true });
      // IVA
      const y2 = yy - filaH;
      page.drawRectangle({ x, y: y2 - filaH + 4, width: colLabelW, height: filaH, color: azul });
      drawText(page, "IVA", x + 12, y2 - 14, { size: 10, bold: true, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: x + colLabelW, y: y2 - filaH + 4, width: ancho - colLabelW, height: filaH, borderColor: line, borderWidth: 0.5, color: rgb(1, 1, 1) });
      drawRight(page, `(${ivaP}%) ${fmtEur(iva)}`, x + ancho - 12, y2 - 14, { size: 10 });
      // Total
      const y3 = y2 - filaH;
      page.drawRectangle({ x, y: y3 - filaH + 4, width: colLabelW, height: filaH, color: azul });
      drawText(page, "Total", x + 12, y3 - 14, { size: 11, bold: true, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: x + colLabelW, y: y3 - filaH + 4, width: ancho - colLabelW, height: filaH, color: azulSuave, borderColor: azul, borderWidth: 0.8 });
      drawRight(page, fmtEur(tot), x + ancho - 12, y3 - 14, { size: 12, bold: true, color: azul });
    }
  }

  // ─── GET /presupuesto-pdf ──────────────────────────────────
  app.options("/api/ara-os/obras-otras/:id/presupuesto-pdf", (req, res) => {
    responderCORS(res); res.status(204).end();
  });
  app.get("/api/ara-os/obras-otras/:id/presupuesto-pdf", async (req, res) => {
    responderCORS(res);
    try {
      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const pdfBytes = await generarPdfPresupuesto(obra, partidas);
      const slug = (obra.nombre || "").replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 50);
      const nombre = `oferta_${obra.obra_id}_${slug}.pdf`;
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

      const { email_destino, asunto, mensaje } = req.body || {};
      if (!email_destino) return res.status(400).json({ ok: false, error: "Falta email_destino" });

      const obra = await obraPorId(req.params.id);
      if (!obra) return res.status(404).json({ ok: false, error: "Obra no encontrada" });
      const partidas = await partidasPorObra(req.params.id);
      const pdfBytes = await generarPdfPresupuesto(obra, partidas);

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
