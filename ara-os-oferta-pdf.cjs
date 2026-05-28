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
    const helvLight = helv;  // pdf-lib no trae light, simulamos con color faint

    // Paleta moderna
    const azul       = rgb(0.020, 0.294, 0.529);  // #054B87 corporativo
    const azulOscuro = rgb(0.012, 0.180, 0.325);
    const azulSuave  = rgb(0.93, 0.96, 0.99);
    const acento     = rgb(0.184, 0.659, 0.471);  // verde sutil para badges OK
    const ink        = rgb(0.07, 0.07, 0.07);
    const muted      = rgb(0.42, 0.42, 0.45);
    const faint      = rgb(0.65, 0.65, 0.68);
    const lineSoft   = rgb(0.92, 0.92, 0.94);
    const white      = rgb(1, 1, 1);

    const W = 595.28, H = 841.89;
    const M = 56;  // margen generoso

    let logoImg = null;
    if (LOGO_BYTES) {
      try { logoImg = await pdfDoc.embedPng(LOGO_BYTES); }
      catch (e) { /* sin logo */ }
    }

    // ── helpers de texto ─────────────────────────────────────
    function t(page, s, x, y, opts = {}) {
      page.drawText(String(s ?? ""), {
        x, y,
        size: opts.size || 10,
        font: opts.bold ? helvBold : helv,
        color: opts.color || ink,
        maxWidth: opts.maxWidth,
        lineHeight: opts.lineHeight,
      });
    }
    function tR(page, s, xR, y, opts = {}) {
      const f = opts.bold ? helvBold : helv;
      const w = f.widthOfTextAtSize(String(s ?? ""), opts.size || 10);
      t(page, s, xR - w, y, opts);
    }
    function tC(page, s, xC, y, opts = {}) {
      const f = opts.bold ? helvBold : helv;
      const w = f.widthOfTextAtSize(String(s ?? ""), opts.size || 10);
      t(page, s, xC - w / 2, y, opts);
    }
    function wrap(s, maxW, size = 10, bold = false) {
      const f = bold ? helvBold : helv;
      const out = [];
      for (const parrafo of String(s || "").split(/\n+/)) {
        const palabras = parrafo.split(/\s+/);
        let actual = "";
        for (const w of palabras) {
          const cand = actual ? actual + " " + w : w;
          if (f.widthOfTextAtSize(cand, size) > maxW && actual) {
            out.push(actual);
            actual = w;
          } else { actual = cand; }
        }
        if (actual) out.push(actual);
        out.push(""); // separación entre párrafos
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

    function pintarCabeceraDoc(page) {
      // Barra azul vertical a la izquierda (acento sutil)
      page.drawRectangle({ x: 0, y: 0, width: 6, height: H, color: azul });
    }

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 1 — PORTADA
    // ═══════════════════════════════════════════════════════
    const p1 = pdfDoc.addPage([W, H]);
    pintarCabeceraDoc(p1);

    // Logo + marca (esquina superior izquierda)
    if (logoImg) {
      const d = logoImg.scale(0.085);
      p1.drawImage(logoImg, { x: M, y: H - 80 - d.height + 24, width: d.width, height: d.height });
    }
    t(p1, EMPRESA.marca, M, H - 76, { size: 11, bold: true });
    t(p1, "Fontanería · Bajantes · Instalaciones", M, H - 88, { size: 8, color: faint });

    // Mini-pill arriba derecha con número de oferta
    const pillTxt = (obra.obra_id || "—").toUpperCase();
    const pillW = helvBold.widthOfTextAtSize(pillTxt, 9) + 24;
    p1.drawRectangle({ x: W - M - pillW, y: H - 80, width: pillW, height: 22, color: azulSuave });
    t(p1, pillTxt, W - M - pillW + 12, H - 74, { size: 9, bold: true, color: azul });

    // ── Bloque hero
    let y = H - 180;
    t(p1, "OFERTA COMERCIAL", M, y, { size: 8, bold: true, color: azul });
    y -= 24;
    // Título proyecto · grande
    const tituloLineas = wrap(obra.nombre || "—", W - 2 * M - 40, 24, true);
    for (const ln of tituloLineas.slice(0, 3)) {
      t(p1, ln, M, y, { size: 24, bold: true });
      y -= 28;
    }
    y -= 8;

    // Línea fina decorativa
    p1.drawLine({ start: { x: M, y }, end: { x: M + 60, y }, thickness: 1.5, color: azul });
    y -= 28;

    // ── Tarjetas datos clave en grid 2x2
    const cardH = 64;
    const cardW = (W - 2 * M - 20) / 2;
    function card(x, yT, label, valor, valorBold = true) {
      // Sin borde: sólo etiqueta + valor
      t(p1, (label || "").toUpperCase(), x, yT, { size: 7, bold: true, color: faint });
      const ww = wrap(valor || "—", cardW - 10, 13, valorBold);
      let yy = yT - 16;
      for (const ln of ww.slice(0, 2)) {
        t(p1, ln, x, yy, { size: 13, bold: valorBold });
        yy -= 16;
      }
    }
    card(M,             y,       "Cliente",     obra.cliente || obra.nombre || "—");
    card(M + cardW + 20, y,      "Nº oferta",   obra.obra_id || "—");
    y -= cardH;
    card(M,             y,       "Emplazamiento", obra.direccion || "—");
    card(M + cardW + 20, y,      "Fecha",       fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()));
    y -= cardH + 8;

    // ── Bloque hero con importe total (números gigantes)
    const subtotalObra = parseNum(obra.subtotal_eur) || partidas.reduce((s, p) => s + (p.pvp || p.subtotal_eur_num), 0);
    const ivaObra      = parseNum(obra.iva_eur);
    const totalObra    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotalObra + ivaObra);
    const ivaPct       = subtotalObra > 0 ? Math.round((ivaObra / subtotalObra) * 100) : 10;

    // Caja azul oscuro centrada
    const heroH = 120;
    const heroY = y - heroH;
    p1.drawRectangle({ x: M, y: heroY, width: W - 2 * M, height: heroH, color: azul });
    // Pequeño badge esquina
    t(p1, "IMPORTE TOTAL (IVA incluido)", M + 24, heroY + heroH - 24, { size: 8, bold: true, color: rgb(0.7, 0.85, 1) });
    // Total gigante (número + €)
    const totStr = fmtEurCompacto(totalObra);
    t(p1, totStr, M + 24, heroY + 32, { size: 42, bold: true, color: white });
    const totW = helvBold.widthOfTextAtSize(totStr, 42);
    t(p1, "€", M + 24 + totW + 8, heroY + 32, { size: 24, color: rgb(0.7, 0.85, 1) });
    // Subtotal + IVA pequeños debajo
    tR(p1, `Base imponible  ${fmtEur(subtotalObra)}`, W - M - 24, heroY + 24, { size: 9, color: rgb(0.85, 0.92, 1) });
    tR(p1, `IVA ${ivaPct}%  ${fmtEur(ivaObra || (totalObra - subtotalObra))}`, W - M - 24, heroY + 12, { size: 9, color: rgb(0.85, 0.92, 1) });

    y = heroY - 24;

    // ── Resumen ejecutivo (1-2 líneas + validez)
    t(p1, "VALIDEZ", M, y, { size: 7, bold: true, color: faint });
    t(p1, "30 días desde la fecha de emisión", M + 60, y, { size: 9 });
    y -= 16;
    t(p1, "INCLUYE", M, y, { size: 7, bold: true, color: faint });
    t(p1, "Mano de obra cualificada, materiales, gestión de residuos", M + 60, y, { size: 9 });
    y -= 16;
    t(p1, "EMITE", M, y, { size: 7, bold: true, color: faint });
    t(p1, `${EMPRESA.marca} · ${EMPRESA.cif}`, M + 60, y, { size: 9 });

    pintarPie(p1, 1, 3);  // placeholder, se reescribe al final

    // ═══════════════════════════════════════════════════════
    //  PÁGINA 2 — ALCANCE + INVERSIÓN
    // ═══════════════════════════════════════════════════════
    const p2 = pdfDoc.addPage([W, H]);
    pintarCabeceraDoc(p2);

    // Mini-cabecera
    t(p2, EMPRESA.marca.toUpperCase(), M, H - 50, { size: 8, bold: true, color: faint });
    tR(p2, `${obra.obra_id || ""} · ${(obra.cliente || "").toUpperCase()}`, W - M, H - 50, { size: 8, color: faint });
    p2.drawLine({ start: { x: M, y: H - 60 }, end: { x: W - M, y: H - 60 }, thickness: 0.3, color: lineSoft });

    y = H - 100;
    t(p2, "01", M, y, { size: 9, bold: true, color: azul });
    t(p2, "ALCANCE DEL TRABAJO", M + 28, y, { size: 9, bold: true });
    p2.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 1, color: azul });
    y -= 28;

    const descripcion = obra.factura_descripcion || obra.notas || "(Sin descripción)";
    for (const parrafo of String(descripcion).split(/\n+/)) {
      if (!parrafo.trim()) { y -= 6; continue; }
      const esBullet = /^[\-•*]/.test(parrafo.trim());
      const xT = esBullet ? M + 16 : M;
      const limpio = esBullet ? parrafo.trim().replace(/^[\-•*]\s*/, "") : parrafo.trim();
      const lineas = wrap(limpio, W - 2 * M - (esBullet ? 16 : 0), 10);
      let primera = true;
      for (const ln of lineas) {
        if (!ln) continue;
        if (y < 220) { /* salto si no cabe */ break; }
        if (primera && esBullet) {
          p2.drawCircle({ x: M + 4, y: y + 3, size: 1.5, color: azul });
        }
        t(p2, ln, xT, y, { size: 10, color: ink, lineHeight: 14 });
        y -= 14;
        primera = false;
      }
      y -= 4;
    }

    // ── Sección 02: INVERSIÓN
    y -= 24;
    if (y < 260) { /* si nos quedamos cortos, lo dejamos así, ya pasa de página */ }
    t(p2, "02", M, y, { size: 9, bold: true, color: azul });
    t(p2, formato === "detallado" ? "DETALLE POR PARTIDAS" : "INVERSIÓN", M + 28, y, { size: 9, bold: true });
    p2.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 1, color: azul });
    y -= 24;

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
      if (totalMO > 0) {
        filas.push({ concepto: "Mano de obra",
          detalle: "Ejecución del trabajo según especificaciones del alcance",
          importe: totalMO });
      }
      if (totalMat > 0) {
        filas.push({ concepto: "Material y suministros",
          detalle: "Material aportado, incluye gestión de pedidos a proveedor",
          importe: totalMat });
      }
      directas.forEach(p => filas.push({ concepto: p.concepto || "—", importe: p.precio_directo_num }));
    } else if (partidas.length > 0) {
      filas = partidas.map(p => ({ concepto: p.concepto || "—", importe: p.pvp || p.subtotal_eur_num }));
    } else {
      const sub = parseNum(obra.subtotal_eur) || parseNum(obra.total_eur) || parseNum(obra.importe);
      filas = [{ concepto: obra.nombre || "Servicios profesionales", importe: sub }];
    }

    let currentPage = p2;
    for (const f of filas) {
      if (y < 200) {
        // Pasamos a una página nueva intermedia
        const np = pdfDoc.addPage([W, H]);
        pintarCabeceraDoc(np);
        t(np, EMPRESA.marca.toUpperCase(), M, H - 50, { size: 8, bold: true, color: faint });
        tR(np, `${obra.obra_id || ""} · CONTINUACIÓN`, W - M, H - 50, { size: 8, color: faint });
        np.drawLine({ start: { x: M, y: H - 60 }, end: { x: W - M, y: H - 60 }, thickness: 0.3, color: lineSoft });
        currentPage = np;
        y = H - 100;
      }
      const w = wrap(f.concepto, W - 2 * M - 110, 11, true);
      const wDet = f.detalle ? wrap(f.detalle, W - 2 * M - 110, 9) : [];
      for (const ln of w) {
        t(currentPage, ln, M, y, { size: 11, bold: true });
        y -= 14;
      }
      for (const ln of wDet) {
        t(currentPage, ln, M, y, { size: 9, color: muted });
        y -= 12;
      }
      // Importe a la derecha (alineado con la primera línea del concepto)
      tR(currentPage, fmtEur(f.importe), W - M, y + 14 * w.length + 12 * wDet.length - 14, {
        size: 13, bold: true,
      });
      y -= 8;
      currentPage.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: lineSoft });
      y -= 12;
    }

    // ── Totales · bloque limpio derecha
    y -= 16;
    if (y < 180) {
      const np = pdfDoc.addPage([W, H]);
      pintarCabeceraDoc(np);
      currentPage = np;
      y = H - 100;
    }
    const xValor = W - M;
    const xLabel = W - M - 200;
    t(currentPage, "Base imponible", xLabel, y, { size: 10, color: muted });
    tR(currentPage, fmtEur(subtotalObra), xValor, y, { size: 11, bold: true });
    y -= 18;
    t(currentPage, `IVA ${ivaPct}%`, xLabel, y, { size: 10, color: muted });
    tR(currentPage, fmtEur(ivaObra || (totalObra - subtotalObra)), xValor, y, { size: 11, bold: true });
    y -= 14;
    currentPage.drawLine({ start: { x: xLabel, y: y + 4 }, end: { x: xValor, y: y + 4 }, thickness: 0.5, color: ink });
    y -= 22;
    t(currentPage, "TOTAL (IVA incluido)", xLabel, y, { size: 10, bold: true });
    tR(currentPage, fmtEur(totalObra), xValor, y, { size: 18, bold: true, color: azul });
    y -= 36;

    // ═══════════════════════════════════════════════════════
    //  PÁGINA FINAL — ACEPTACIÓN
    // ═══════════════════════════════════════════════════════
    const pF = pdfDoc.addPage([W, H]);
    pintarCabeceraDoc(pF);
    t(pF, EMPRESA.marca.toUpperCase(), M, H - 50, { size: 8, bold: true, color: faint });
    tR(pF, `${obra.obra_id || ""} · ACEPTACIÓN`, W - M, H - 50, { size: 8, color: faint });
    pF.drawLine({ start: { x: M, y: H - 60 }, end: { x: W - M, y: H - 60 }, thickness: 0.3, color: lineSoft });

    let yA = H - 110;
    t(pF, "03", M, yA, { size: 9, bold: true, color: azul });
    t(pF, "DOCUMENTO DE ACEPTACIÓN", M + 28, yA, { size: 9, bold: true });
    pF.drawLine({ start: { x: M, y: yA - 8 }, end: { x: W - M, y: yA - 8 }, thickness: 1, color: azul });
    yA -= 32;

    // Identificación compacta
    const filaId = (label, valor) => {
      t(pF, label, M, yA, { size: 8, bold: true, color: faint });
      t(pF, valor || "—", M + 120, yA, { size: 10 });
      yA -= 18;
    };
    filaId("CÓDIGO DE OFERTA", obra.obra_id);
    filaId("NOMBRE DE LA OBRA", obra.nombre);
    filaId("CLIENTE", obra.cliente);
    filaId("FECHA DE EMISIÓN", fmtFecha(obra.created_at) || fmtFecha(new Date().toISOString()));
    yA -= 8;

    // Cuerpo
    const cuerpo = [
      "Mediante la firma del presente documento, el CLIENTE acepta el presupuesto identificado y autoriza el inicio del trabajo conforme a las condiciones descritas en la oferta.",
      "",
      `El importe total acordado asciende a ${fmtEur(totalObra)} (IVA incluido). La forma de pago se acordará previamente al inicio. Cualquier variación derivada de imprevistos en obra será notificada al CLIENTE y requerirá aprobación expresa.`,
    ];
    for (const par of cuerpo) {
      if (!par) { yA -= 6; continue; }
      const lns = wrap(par, W - 2 * M, 10);
      for (const ln of lns) {
        t(pF, ln, M, yA, { size: 10, lineHeight: 14 });
        yA -= 14;
      }
      yA -= 4;
    }
    yA -= 24;

    // Total destacado · más sobrio en esta página
    pF.drawRectangle({ x: M, y: yA - 38, width: W - 2 * M, height: 50, color: azulSuave });
    t(pF, "IMPORTE A ACEPTAR", M + 20, yA - 12, { size: 8, bold: true, color: azul });
    tR(pF, fmtEur(totalObra), W - M - 20, yA - 24, { size: 22, bold: true, color: azulOscuro });
    yA -= 80;

    // Firmas: dos cajas amplias con líneas
    const colF = (W - 2 * M - 30) / 2;
    const yLin = yA - 60;
    // Caja cliente
    t(pF, "POR EL CLIENTE", M, yA, { size: 8, bold: true, color: faint });
    pF.drawLine({ start: { x: M, y: yLin }, end: { x: M + colF, y: yLin }, thickness: 0.5, color: ink });
    t(pF, "Firma", M, yLin - 14, { size: 8, color: faint });
    t(pF, "Nombre / DNI", M + 90, yLin - 14, { size: 8, color: faint });
    t(pF, "Fecha", M + colF - 50, yLin - 14, { size: 8, color: faint });
    // Caja empresa
    const xE = M + colF + 30;
    t(pF, `POR ${EMPRESA.marca.toUpperCase()}`, xE, yA, { size: 8, bold: true, color: faint });
    pF.drawLine({ start: { x: xE, y: yLin }, end: { x: xE + colF, y: yLin }, thickness: 0.5, color: ink });
    t(pF, "Firma", xE, yLin - 14, { size: 8, color: faint });
    t(pF, "Nombre / DNI", xE + 90, yLin - 14, { size: 8, color: faint });
    t(pF, "Fecha", xE + colF - 50, yLin - 14, { size: 8, color: faint });

    // Pequeña nota corporativa abajo
    t(pF, EMPRESA.razon, M, 80, { size: 8, bold: true });
    t(pF, `${EMPRESA.dir1} · ${EMPRESA.dir2} · ${EMPRESA.cp}`, M, 70, { size: 7, color: muted });
    t(pF, `${EMPRESA.email} · ${EMPRESA.web}`, M, 60, { size: 7, color: muted });

    // ── Numeración final + pies en TODAS las páginas
    const totalPaginas = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((pg, i) => {
      pintarPie(pg, i + 1, totalPaginas);
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
