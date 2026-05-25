/**
 * ara-os-presupuestos.cjs · v0.1.0 (25/05/2026)
 * --------------------------------------------------------------
 * Endpoints para generar el PDF de un presupuesto (OO en fase
 * PRESUPUESTO) y enviarlo por email al cliente.
 *
 * Se monta en index.cjs con:
 *   require("./ara-os-presupuestos.cjs")(app);
 *
 * Rutas:
 *   GET  /api/ara-os/obras-otras/:id/presupuesto-pdf
 *        Devuelve un application/pdf descargable.
 *
 *   POST /api/ara-os/obras-otras/:id/enviar-presupuesto
 *        Body: { email_destino, asunto?, mensaje? }
 *        Envía el PDF adjunto al destino vía Resend.
 *
 * Reaprovecha:
 *   · pdf-lib (ya usada en certificados EMASESA)
 *   · resend  (ya usada en pedidos a proveedores)
 *   · google sheets (lee obras_otras + partidas_extra)
 * --------------------------------------------------------------
 */

module.exports = function(app) {
  const { google } = require("googleapis");
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
  const express = require("express");
  const jsonBodyParser = express.json({ limit: "1mb" });

  // ─── Helpers compartidos ──────────────────────────────────
  function getAuth() {
    return new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  function getSheets() {
    return google.sheets({ version: "v4", auth: getAuth() });
  }
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
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-ES", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }
  function parseNum(v) {
    const n = parseFloat(String(v || "0").replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  // ─── Cargar OO + partidas extra ─────────────────────────────
  // Estructura del sheet obras_otras (de ara-os-obras-otras.cjs):
  //   A=obra_id  B=nombre  C=cliente  D=telefono  E=direccion
  //   F=tipo     G=importe H=fase    ... (ver HEADERS allí)
  // Reproducimos sólo lo necesario para el PDF.
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
    "material_coste","material_margen_pct","subtotal_eur",
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
    try {
      rows = await leerHoja("obras_otras_partidas_extra!A2:J");
    } catch { return []; }
    const out = [];
    for (const row of rows) {
      if (!row[0]) continue;
      const p = {};
      HEADERS_PARTIDAS.forEach((h, i) => { p[h] = row[i] || ""; });
      if (p.obra_id === id && p.borrado !== "TRUE") {
        p.horas_num = parseNum(p.horas);
        p.precio_hora_num = parseNum(p.precio_hora);
        p.material_coste_num = parseNum(p.material_coste);
        p.material_margen_pct_num = parseNum(p.material_margen_pct);
        p.subtotal_eur_num = parseNum(p.subtotal_eur);
        out.push(p);
      }
    }
    return out;
  }

  // ─── Generador de PDF ──────────────────────────────────────
  async function generarPdfPresupuesto(obra, partidas) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);  // A4
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const M = 50;                   // margen
    const W = 595.28;
    let y = 841.89 - M;             // cursor desde arriba

    const ink = rgb(0.07, 0.07, 0.07);
    const muted = rgb(0.4, 0.4, 0.4);
    const faint = rgb(0.55, 0.55, 0.55);
    const line = rgb(0.85, 0.85, 0.85);
    const accent = rgb(0.55, 0.36, 0.9);  // violeta (color fase presupuesto)

    function text(s, x, yy, opts = {}) {
      page.drawText(String(s ?? ""), {
        x, y: yy,
        size: opts.size || 10,
        font: opts.bold ? helvBold : helv,
        color: opts.color || ink,
        maxWidth: opts.maxWidth,
      });
    }
    function hr(yy, color = line) {
      page.drawLine({
        start: { x: M, y: yy },
        end:   { x: W - M, y: yy },
        thickness: 0.5,
        color,
      });
    }

    // ─── Cabecera empresa ──────────────────────────────
    text("INSTALACIONES ARAUJO", M, y, { size: 14, bold: true });
    text("Presupuesto comercial", M, y - 16, { size: 9, color: muted });
    // Lado derecho: nº y fecha
    text(`Nº ${obra.obra_id}`, W - M - 200, y, { size: 9, bold: true });
    text(`Fecha: ${fmtFecha(obra.created_at || new Date().toISOString())}`, W - M - 200, y - 14, { size: 9, color: muted });
    y -= 36;
    hr(y);
    y -= 24;

    // ─── Datos cliente ──────────────────────────────────
    text("CLIENTE", M, y, { size: 8, bold: true, color: faint });
    y -= 14;
    text(obra.cliente || obra.nombre || "—", M, y, { size: 11, bold: true });
    y -= 14;
    if (obra.direccion) { text(obra.direccion, M, y, { size: 9, color: muted }); y -= 12; }
    if (obra.telefono)  { text(`Tel. ${obra.telefono}`, M, y, { size: 9, color: muted }); y -= 12; }
    y -= 10;

    // ─── Asunto ─────────────────────────────────────────
    text("OBRA / TRABAJO", M, y, { size: 8, bold: true, color: faint });
    y -= 14;
    text(obra.nombre || "—", M, y, { size: 11, bold: true });
    y -= 18;

    // ─── Descripción ────────────────────────────────────
    const descripcion = obra.factura_descripcion || obra.notas || "";
    if (descripcion) {
      text("DESCRIPCIÓN", M, y, { size: 8, bold: true, color: faint });
      y -= 14;
      // Wrap manual (helv no tiene wrapText; aproximamos por palabras)
      const maxChars = 95;
      const palabras = descripcion.split(/\s+/);
      let linea = "";
      for (const w of palabras) {
        if ((linea + " " + w).length > maxChars) {
          text(linea.trim(), M, y, { size: 9, color: ink });
          y -= 12;
          linea = w;
          if (y < 200) break;
        } else { linea = linea ? linea + " " + w : w; }
      }
      if (linea) { text(linea.trim(), M, y, { size: 9, color: ink }); y -= 12; }
      y -= 10;
    }

    // ─── Tabla de partidas ──────────────────────────────
    text("DETALLE", M, y, { size: 8, bold: true, color: faint });
    y -= 4;
    hr(y);
    y -= 14;
    // Cabecera tabla
    text("Concepto", M, y, { size: 8, bold: true, color: muted });
    text("Horas", W - M - 200, y, { size: 8, bold: true, color: muted });
    text("Material", W - M - 140, y, { size: 8, bold: true, color: muted });
    text("Subtotal", W - M - 70, y, { size: 8, bold: true, color: muted });
    y -= 12;
    hr(y);
    y -= 12;

    let subtotalTotal = 0;
    if (partidas.length > 0) {
      for (const p of partidas) {
        if (y < 160) break;
        text(p.concepto || "—", M, y, { size: 9, maxWidth: 280 });
        text(p.horas_num ? `${p.horas_num.toFixed(1)}h` : "—", W - M - 200, y, { size: 9 });
        text(p.material_coste_num ? fmtEur(p.material_coste_num * (1 + p.material_margen_pct_num/100)) : "—",
             W - M - 140, y, { size: 9 });
        text(fmtEur(p.subtotal_eur_num), W - M - 70, y, { size: 9, bold: true });
        subtotalTotal += p.subtotal_eur_num;
        y -= 14;
      }
    } else {
      // Si no hay partidas detalladas, mostramos solo el total acordado
      text(obra.nombre || "Servicios profesionales", M, y, { size: 9, maxWidth: 280 });
      const sub = parseNum(obra.subtotal_eur) || parseNum(obra.total_eur) || parseNum(obra.importe);
      text(fmtEur(sub), W - M - 70, y, { size: 9, bold: true });
      subtotalTotal = sub;
      y -= 14;
    }
    y -= 4;
    hr(y);
    y -= 24;

    // ─── Totales ───────────────────────────────────────
    const subtotalObra = parseNum(obra.subtotal_eur) || subtotalTotal;
    const ivaObra      = parseNum(obra.iva_eur);
    const totalObra    = parseNum(obra.total_eur) || parseNum(obra.importe) || (subtotalObra + ivaObra);
    const ivaPct       = subtotalObra > 0 ? Math.round((ivaObra / subtotalObra) * 100) : 10;

    const xLabel = W - M - 200;
    const xVal   = W - M - 60;
    text("Subtotal", xLabel, y, { size: 10, color: muted });
    text(fmtEur(subtotalObra), xVal, y, { size: 10, bold: true });
    y -= 14;
    text(`IVA ${ivaPct}%`, xLabel, y, { size: 10, color: muted });
    text(fmtEur(ivaObra || (totalObra - subtotalObra)), xVal, y, { size: 10, bold: true });
    y -= 18;
    page.drawRectangle({
      x: xLabel - 10, y: y - 8, width: W - M - xLabel + 20, height: 28,
      color: accent, opacity: 0.12,
    });
    text("TOTAL", xLabel, y, { size: 12, bold: true });
    text(fmtEur(totalObra), xVal, y, { size: 12, bold: true });
    y -= 36;

    // ─── Pie ───────────────────────────────────────────
    if (y < 120) y = 120;
    hr(y);
    y -= 16;
    text("Validez del presupuesto: 30 días desde la fecha de emisión.", M, y, { size: 9, color: muted });
    y -= 12;
    text("Las cantidades indicadas no incluyen variaciones derivadas de imprevistos en obra.", M, y, { size: 9, color: muted });
    y -= 12;
    text("Forma de pago: a convenir.", M, y, { size: 9, color: muted });
    y -= 24;
    text("Instalaciones Araujo · presupuesto@araujofontaneria.es", M, y, { size: 8, color: faint });

    return await pdfDoc.save();
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
      const nombre = `presupuesto_${obra.obra_id}_${(obra.nombre || "").replace(/[^a-z0-9]+/gi, "_")}.pdf`;
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
          filename: `presupuesto_${obra.obra_id}.pdf`,
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
