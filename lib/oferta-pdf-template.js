/**
 * oferta-pdf-template · v3.0.0 — HTML/CSS/SVG puro
 * --------------------------------------------------------------
 * Arquitectura limpia:
 *   - Sin PNG ni backgrounds raster.
 *   - Diagonales, masas de color, blueprint y bloques con CSS y SVG.
 *   - Composición editorial premium, replicable y mantenible.
 *   - Themes por tipo de obra cambian SOLO el SVG blueprint y el
 *     color secundario; el resto (tipografía, márgenes, tabla,
 *     totales, aceptación, footer) es invariante.
 *
 * Espejo del CSS y la estructura en
 *   ara-os/src/components/pdf/  (Cover/Scope/Investment/Acceptance)
 *
 * Exporta:
 *   renderPresupuestoHtml(presupuesto) → HTML completo
 *   pdfCss                              → string CSS
 *   EMPRESA_DEFAULT                     → defaults de empresa
 * --------------------------------------------------------------
 */

const { getTheme } = require("./oferta-pdf-themes.js");
const { logoSvg, selloSvg } = require("./oferta-pdf-branding.js");

// Logo y sello: PNG reales si están disponibles (data-URI). Fallback
// a los SVG vectoriales si no.
function renderLogo(p, opts = {}) {
  // Cover usa la versión blanca; resto, la azul corporativa.
  const png = opts.variant === "inverso" ? p.assets?.logoPngWhite : p.assets?.logoPng;
  if (png) {
    return `<img src="${png}" class="logo-img" alt="Araujo"/>`;
  }
  return logoSvg(opts);
}
function renderSello(p, opts = {}) {
  const png = p.assets?.selloPng;
  if (png) {
    return `<img src="${png}" class="sello-img" alt="Sello firmado ARA"/>`;
  }
  return selloSvg(opts);
}

const EMPRESA_DEFAULT = {
  nombre: "Instalaciones Araujo",
  subtitulo: "Fontanería · Bajantes · Instalaciones",
  cif: "B90488222",
  telefono: "954 12 34 56",
  email: "comercial@instalacionesaraujo.com",
  web: "www.instalacionesaraujo.com",
  direccion: "Avenida San Francisco Javier · Edificio Sevilla 2, Planta 6, Módulo 9 · 41018 · Sevilla",
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── CSS canónico ─────────────────────────────────────────────────
// Todo el diseño visual vive aquí. NO se usan imágenes raster.
const pdfCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;500;700;900&display=swap');

:root{
  --a4w:210mm; --a4h:297mm;
  --navy:#061f3d; --navy-2:#0d2c52;
  --accent:#0d4d8a;
  --paper:#FBFAF7;
  --text:#07172d;
  --muted:#5b6979;
  --hair:#E1E4E8;
  --serif:'Playfair Display',Georgia,serif;
  --sans:'Inter','Helvetica Neue',Arial,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:#e9eef4;
  font-family:var(--sans);color:var(--text);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
  font-variant-numeric:tabular-nums;
}
.pdf-root{display:flex;flex-direction:column;gap:24px;align-items:center;padding:24px}
.page{
  width:var(--a4w);height:var(--a4h);
  position:relative;background:var(--paper);
  overflow:hidden;
  page-break-after:always;page-break-inside:avoid;
  box-shadow:0 18px 45px rgba(0,0,0,.12);
}
.page:last-child{page-break-after:auto}

/* ─────────── Tipografía base · tracking refinado -35% ─────────── */
.eyebrow{font-size:9pt;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.label  {font-size:7.5pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.serif  {font-family:var(--serif)}
.italic {font-style:italic}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 1 · PORTADA
   Composición asimétrica · gran diagonal azul · blueprint dominante
   ════════════════════════════════════════════════════════════════ */
/* .cover hereda dimensiones de .page (210×297mm) */
.cover .diagonal{
  position:absolute;inset:0;
  background:linear-gradient(138deg,var(--navy) 0%,var(--navy-2) 100%);
  clip-path:polygon(0 0,100% 0,100% 48%,0 64%);
}
.cover .glow{
  position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(circle at 82% 6%,rgba(255,255,255,.07),transparent 40%),
    radial-gradient(circle at 14% 28%,rgba(255,255,255,.04),transparent 52%);
}
.cover .hair{
  position:absolute;left:18mm;right:0;top:14mm;height:1px;
  background:rgba(255,255,255,.16);
}

/* Cabecera */
.cover .head{
  position:absolute;top:18mm;left:18mm;right:18mm;color:#fff;
  display:flex;justify-content:space-between;align-items:flex-start;z-index:3;
}
.cover .marca{display:flex;flex-direction:column;line-height:1}
.cover .marca .logo{
  width:56px;height:56px;display:block;
}
/* v3.9 · logo PNG real de la empresa (blanco en cover, azul en
   cabeceras interiores). Soporta SVG fallback. */
.cover .marca .logo svg,
.cover .marca .logo .logo-img{width:100%;height:100%;display:block;object-fit:contain}
.pageHead .marca .logo svg,
.pageHead .marca .logo .logo-img{width:100%;height:100%;display:block;object-fit:contain}
/* Sello firmado PNG · 100% opaco sobre la línea de firma "Por Araujo" */
.accept .sign.empresa{position:relative}
.accept .sign.empresa .sello{
  position:absolute;right:0;top:-22mm;width:75px;height:75px;
  opacity:1;z-index:2;pointer-events:none;
}
.accept .sign.empresa .sello .sello-img,
.accept .sign.empresa .sello svg{
  width:100%;height:100%;display:block;object-fit:contain;
}
.accept .watermark{position:absolute;right:8mm;top:130mm;width:120mm;height:120mm;z-index:0;pointer-events:none}
.accept .watermark .sello-img,
.accept .watermark svg{width:100%;height:100%;display:block;object-fit:contain;opacity:.05}
.cover .marca .sub{
  font-size:7pt;font-weight:600;letter-spacing:.22em;
  color:rgba(255,255,255,.68);margin-top:13px;text-transform:uppercase;
}
.cover .ref{text-align:right;color:rgba(255,255,255,.68);font-size:8pt;letter-spacing:.2em;line-height:1.65}
.cover .ref strong{display:block;font-size:11pt;color:#fff;letter-spacing:.12em;margin-top:5px;font-weight:700}

/* Bloque hero (eyebrow + título XXL) */
.cover .hero{position:absolute;top:62mm;left:18mm;right:90mm;color:#fff;z-index:3}
.cover .hero .eye{
  display:inline-flex;align-items:center;gap:14px;
  font-size:9pt;font-weight:600;letter-spacing:.27em;color:rgba(255,255,255,.76);
}
.cover .hero .eye::before{content:"";display:block;width:34px;height:1px;background:rgba(255,255,255,.66)}
.cover .hero h1{
  font-family:var(--serif);font-weight:500;
  font-size:40pt;line-height:1.02;letter-spacing:-.045em;
  margin-top:18px;color:#fff;
}
.cover .hero h1 em{font-style:italic;font-weight:400;color:rgba(255,255,255,.94)}

/* Blueprint a la derecha · elemento gráfico dominante */
.cover .heroBp{position:absolute;right:14mm;top:34mm;width:80mm;height:128mm;z-index:2;opacity:.94}
.cover .heroBp svg{width:100%;height:100%;display:block}

/* Número de oferta estilo magazine */
.cover .issue{position:absolute;left:18mm;top:128mm;color:#fff;z-index:3}
.cover .issue .l{font-size:8pt;font-weight:600;letter-spacing:.23em;color:rgba(255,255,255,.58)}
.cover .issue .n{
  font-family:var(--serif);font-weight:900;
  font-size:64pt;letter-spacing:-3.4px;line-height:.85;margin-top:5px;
}

/* Tira editorial de datos (4 columnas separadas por hairlines) */
.cover .strip{
  position:absolute;left:18mm;right:18mm;top:192mm;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);padding-top:14px;
}
.cover .strip .c{padding:0 16px;border-left:1px solid var(--hair)}
.cover .strip .c:first-child{padding-left:0;border-left:0}
.cover .strip .k{font-size:7pt;letter-spacing:.2em;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.cover .strip .v{font-size:10.5pt;font-weight:600;color:var(--text);line-height:1.3}

/* Importe gigante */
.cover .money{
  position:absolute;left:18mm;right:18mm;top:222mm;
  display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;
}
.cover .money .l{font-size:8pt;letter-spacing:.22em;font-weight:700;text-transform:uppercase;color:var(--muted)}
.cover .money .v{
  font-family:var(--serif);font-weight:700;
  font-size:72pt;line-height:.92;letter-spacing:-.045em;color:var(--navy);margin-top:8px;
}
.cover .money .v small{font-size:32pt;color:var(--accent);font-weight:500;margin-left:6px;letter-spacing:-.02em}
.cover .money .br{font-size:10pt;color:var(--muted);text-align:right;padding-bottom:10px;line-height:1.75}
.cover .money .br b{color:var(--text);font-weight:700;margin-left:18px}

/* Pie con contacto */
.cover .contact{
  position:absolute;left:18mm;right:18mm;bottom:14mm;
  border-top:1px solid var(--hair);padding-top:10px;
  display:flex;justify-content:space-between;align-items:center;
  font-size:9pt;color:var(--muted);letter-spacing:.02em;
}
.cover .contact .r{color:var(--navy);font-weight:700;letter-spacing:.15em}
.cover .contact .l span{margin-right:24px}

/* ════════════════════════════════════════════════════════════════
   CABECERA DE PÁGINAS INTERIORES
   ════════════════════════════════════════════════════════════════ */
.pageHead{
  position:absolute;top:18mm;left:18mm;right:18mm;
  display:flex;justify-content:space-between;align-items:center;
  padding-bottom:12px;border-bottom:1px solid var(--hair);
}
.pageHead .marca{display:flex;align-items:center;gap:12px}
.pageHead .marca .logo{width:24px;height:24px;display:block}
.pageHead .marca .t{font-size:8pt;font-weight:600;letter-spacing:.18em;color:var(--muted);text-transform:uppercase}
.pageHead .right{text-align:right;line-height:1.45}
.pageHead .right .code{font-size:11pt;font-weight:700;color:var(--navy);letter-spacing:.09em}
.pageHead .right .scope{font-size:7.5pt;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-top:2px;font-weight:600}

/* Pie de páginas interiores */
.pageFoot{
  position:absolute;left:18mm;right:18mm;bottom:14mm;
  display:flex;justify-content:space-between;align-items:center;
  padding-top:10px;border-top:1px solid var(--hair);
  font-size:8.5pt;color:var(--muted);letter-spacing:.01em;
}
.pageFoot strong{color:var(--navy);font-weight:700;letter-spacing:.11em;text-transform:uppercase}

/* ════════════════════════════════════════════════════════════════
   CAPÍTULO (titular numerado editorial)
   ════════════════════════════════════════════════════════════════ */
.chapter{position:absolute;top:46mm;left:18mm}
.chapter .num{
  font-family:var(--serif);font-weight:900;font-size:92pt;
  line-height:.85;letter-spacing:-5px;color:var(--navy);
}
.chapter .lab{
  font-size:9pt;font-weight:700;letter-spacing:.24em;text-transform:uppercase;
  color:var(--muted);border-top:1px solid var(--navy);
  padding-top:11px;margin-top:18px;display:inline-block;min-width:140px;
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 2 · ALCANCE
   ════════════════════════════════════════════════════════════════ */
.scope .body{
  position:absolute;left:18mm;top:118mm;width:108mm;
}
.scope .lead{
  font-family:var(--serif);font-size:14pt;line-height:1.42;
  font-weight:400;letter-spacing:-.18px;color:var(--text);margin-bottom:18px;
}
/* v3.6 · descripción libre del trabajo (la que escribe el técnico) */
/* v3.9 · --scope-scale reduce el cuerpo proporcionalmente cuando hay
   mucho texto, para que el alcance siempre quepa en la página. */
.scope .descripcion{
  font-family:var(--sans);font-size:calc(10pt * var(--scope-scale,1));line-height:1.55;color:var(--text);
}
.scope .descripcion p{
  margin:0 0 calc(10pt * var(--scope-scale,1)) 0;
}
.scope .descripcion p:first-child{
  font-family:var(--serif);font-size:calc(13pt * var(--scope-scale,1));line-height:1.4;color:var(--navy);
  letter-spacing:-.1px;margin-bottom:calc(14pt * var(--scope-scale,1));
}
.scope .descripcion ul{
  list-style:none;padding:0;margin:0 0 calc(10pt * var(--scope-scale,1)) 0;
}
.scope .descripcion li{
  position:relative;padding-left:14pt;margin-bottom:calc(5pt * var(--scope-scale,1));font-size:calc(9.5pt * var(--scope-scale,1));line-height:1.5;color:var(--text);
}
.scope .descripcion li::before{
  content:"";position:absolute;left:0;top:7pt;width:6pt;height:1pt;background:var(--accent);
}
.scope .list{display:flex;flex-direction:column}
.scope .item{
  display:grid;grid-template-columns:28px 1fr;gap:14px;
  padding:12px 0;border-top:1px solid var(--hair);
}
.scope .item:last-child{border-bottom:1px solid var(--hair)}
.scope .item .idx{font-family:var(--serif);font-size:13pt;font-weight:700;color:var(--accent);letter-spacing:-.4px;line-height:1.1}
.scope .item h3{font-size:10pt;font-weight:700;color:var(--navy);margin-bottom:3px;letter-spacing:.01em}
.scope .item p{font-size:8.5pt;line-height:1.42;color:var(--muted);letter-spacing:.005em}

/* Composición lateral · blueprint dominante en columna derecha */
.scope .visual{
  position:absolute;right:0;top:80mm;width:65mm;height:170mm;
  background:linear-gradient(180deg,var(--navy) 0%,var(--navy-2) 100%);
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;
}
.scope .visual::before{
  content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 50% 100%,rgba(255,255,255,.05),transparent 60%);
}
.scope .visual svg{width:80%;height:auto;position:relative;z-index:1}
.scope .visual .cap{
  position:absolute;left:14px;bottom:14px;color:#fff;
  font-size:7pt;letter-spacing:.23em;font-weight:600;text-transform:uppercase;z-index:2;
  color:rgba(255,255,255,.62);
}
.scope .visual .cap b{
  display:block;font-family:var(--serif);font-size:18pt;font-weight:700;
  letter-spacing:-.4px;color:#fff;margin-top:6px;text-transform:none;
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 3 · INVERSIÓN
   El bloque .invBody fluye dentro del área entre cabecera y pie,
   así que tabla, totales y pilares se acomodan sin solapes
   independientemente del nº de filas.
   ════════════════════════════════════════════════════════════════ */
.inv .invBody{
  position:absolute;left:18mm;right:18mm;top:118mm;bottom:46mm;
  display:flex;flex-direction:column;gap:14px;
}
.inv .invBody .tableWrap{flex:0 0 auto}
.inv .table{border-collapse:collapse;width:100%}
.inv .table th{
  background:transparent;color:var(--muted);
  text-align:left;padding:10px 6px;
  font-size:7.5pt;letter-spacing:.16em;font-weight:700;text-transform:uppercase;
  border-bottom:1px solid var(--navy);
}
.inv .table th.c{text-align:center}
.inv .table th.r{text-align:right}
.inv .table td{
  padding:11px 6px;font-size:9pt;color:var(--text);
  border-bottom:1px solid var(--hair);vertical-align:middle;
}
.inv .table td.n{
  font-family:var(--serif);font-size:13pt;font-weight:700;
  color:var(--accent);text-align:center;width:28px;letter-spacing:-.5px;
}
/* v3.7 · tabla simplificada · solo concepto + importe */
.inv .table.simple td.concept{
  font-size:10.5pt;color:var(--navy);font-weight:600;padding:14px 6px;
}
.inv .table.simple td.r{font-size:11.5pt}
.inv .table.simple td.r.b{font-family:var(--serif);font-weight:700;color:var(--navy)}
.inv .table td.concept{font-size:10pt;font-weight:600;color:var(--navy);line-height:1.3;letter-spacing:.005em}
.inv .table td.c{text-align:center;color:var(--muted);white-space:nowrap;letter-spacing:.01em}
.inv .table td.r{text-align:right;white-space:nowrap;color:var(--muted)}
.inv .table td.r.b{
  font-family:var(--serif);font-size:12pt;font-weight:700;color:var(--navy);
}

/* Bloque totales · grid quote + box */
.inv .totals{display:grid;grid-template-columns:1fr 78mm;gap:0;flex:0 0 auto;align-items:end}
.inv .totals .quote{
  padding:0 24px 4px 0;
  font-family:var(--serif);font-size:11pt;font-style:italic;
  font-weight:500;color:var(--navy);line-height:1.45;letter-spacing:-.1px;
  border-left:1px solid var(--navy);padding-left:18px;
  max-width:96mm;
}
.inv .totals .quote::before{
  content:"";display:block;width:22px;height:1px;background:var(--accent);margin-bottom:14px;
}
.inv .totals .row{display:flex;justify-content:space-between;padding:10px 16px;font-size:9pt;border-bottom:1px solid var(--hair);letter-spacing:.01em}
.inv .totals .row .l{color:var(--muted)}
.inv .totals .row .r{font-weight:700;color:var(--text);white-space:nowrap}
.inv .totals .grand{background:var(--navy);color:#fff;padding:16px;display:flex;justify-content:space-between;align-items:baseline}
.inv .totals .grand .l{font-size:7.5pt;letter-spacing:.2em;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.62)}
.inv .totals .grand .r{font-family:var(--serif);font-size:17pt;font-weight:700;letter-spacing:-.04em;color:#fff;white-space:nowrap}

/* Pilares de marca · empujados al fondo del flex */
.inv .pillars{
  margin-top:auto;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);padding-top:18px;
}
.inv .pillar{padding:0 18px 4px 0;border-right:1px solid var(--hair)}
.inv .pillar:last-child{border-right:0}
.inv .pillar .mark{width:18px;height:1px;background:var(--navy);margin-bottom:11px}
.inv .pillar h4{font-size:9pt;font-weight:700;color:var(--navy);margin-bottom:4px;line-height:1.3;letter-spacing:.005em}
.inv .pillar p{font-size:8pt;color:var(--muted);line-height:1.45;letter-spacing:.005em}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 4 · ACEPTACIÓN
   ════════════════════════════════════════════════════════════════ */
.accept .id{
  position:absolute;left:18mm;right:18mm;top:118mm;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);border-bottom:1px solid var(--navy);padding:16px 0;
}
.accept .id .c{padding:0 16px;border-left:1px solid var(--hair)}
.accept .id .c:first-child{padding-left:0;border-left:0}
.accept .id .k{font-size:7pt;letter-spacing:.2em;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.accept .id .v{font-size:11pt;font-weight:700;color:var(--navy);line-height:1.3;letter-spacing:.005em}

.accept .legal{position:absolute;left:18mm;right:18mm;font-size:10pt;line-height:1.6;color:var(--text);letter-spacing:.005em}
.accept .legal strong{color:var(--navy);font-weight:700}
.accept .legal.p1{top:152mm}
.accept .legal.p2{top:174mm}

.accept .importeAceptar{
  position:absolute;left:18mm;right:18mm;top:196mm;
  border-top:1px solid var(--navy);padding-top:14px;
  display:flex;justify-content:space-between;align-items:baseline;
}
.accept .importeAceptar .l{font-size:8.5pt;letter-spacing:.22em;font-weight:700;text-transform:uppercase;color:var(--muted)}
.accept .importeAceptar .r{font-family:var(--serif);font-size:42pt;font-weight:700;letter-spacing:-.045em;color:var(--navy);line-height:.95}

.accept .signGrid{
  position:absolute;left:18mm;right:18mm;top:224mm;
  display:grid;grid-template-columns:1fr 1fr;gap:34px;
}
.accept .sign{padding-top:14px;border-top:1px solid var(--navy)}
.accept .sign h3{font-size:8.5pt;letter-spacing:.21em;font-weight:700;text-transform:uppercase;color:var(--navy);margin-bottom:26px}
.accept .sign .line{height:1px;background:var(--text)}
.accept .sign .labels{display:flex;justify-content:space-between;font-size:8pt;color:var(--muted);margin-top:7px;letter-spacing:.02em}

/* Sello corporativo · validación institucional en firma de Araujo */
.accept .sign.empresa{position:relative}
.accept .sign.empresa .sello{
  position:absolute;right:0;top:-6mm;width:32mm;height:32mm;
  opacity:.16;pointer-events:none;
}
.accept .sign.empresa .sello svg{width:100%;height:100%;display:block}

/* Watermark muy sutil del sello en el centro de la página de aceptación */
.accept .watermark{
  position:absolute;left:50%;top:48%;
  transform:translate(-50%,-50%);
  width:140mm;height:140mm;
  opacity:.035;pointer-events:none;z-index:0;
}
.accept .watermark svg{width:100%;height:100%;display:block}

/* Footer corporativo grande con gradiente */
.accept .corpFooter{
  position:absolute;left:0;right:0;bottom:0;
  background:linear-gradient(135deg,var(--navy) 0%,var(--navy-2) 100%);
  color:#fff;padding:12mm 18mm 12mm 18mm;
  display:flex;justify-content:space-between;align-items:flex-end;
}
.accept .corpFooter .corp{font-family:var(--serif);font-size:15pt;font-weight:700;letter-spacing:-.2px;margin-bottom:7px}
.accept .corpFooter .data{font-size:9pt;line-height:1.6;color:rgba(255,255,255,.74);letter-spacing:.005em}
.accept .corpFooter .pn{font-family:var(--serif);font-size:32pt;font-weight:900;color:rgba(255,255,255,.92);letter-spacing:-.04em;line-height:.85}
.accept .corpFooter .pn span{display:block;font-family:var(--sans);font-size:7.5pt;letter-spacing:.24em;font-weight:600;color:rgba(255,255,255,.58);margin-top:7px}

@media print{
  body{background:#fff}
  .pdf-root{display:block;padding:0;gap:0}
  .page{box-shadow:none;border-radius:0;margin:0}
}
`;

// ── Renderizado por página ──────────────────────────────────────

function htmlCover(p) {
  const o = p.oferta;
  // Forzamos el quiebre del título por el primer separador "·"
  const t = (o.titulo || "—").split("·");
  const titulo = t.length > 1
    ? `${esc(t[0].trim())} ·<br/><em>${esc(t.slice(1).join("·").trim())}</em>`
    : esc(o.titulo || "—");
  const num = (o.codigo || "").replace(/[^0-9]/g, "").slice(-5) || "00000";

  return `
    <section class="page cover">
      <div class="diagonal"></div>
      <div class="glow"></div>
      <div class="hair"></div>

      <div class="head">
        <div class="marca">
          <span class="logo">${renderLogo(p, { variant: "inverso" })}</span>
          <span class="sub">${esc(p.empresa.nombre)}</span>
        </div>
        <div class="ref">MEMORIA · OFERTA<strong>${esc(o.codigo)}</strong></div>
      </div>

      <div class="hero">
        <div class="eye">OFERTA COMERCIAL · ${esc((p.theme?.label || "PRESUPUESTO").toUpperCase())}</div>
        <h1>${titulo}</h1>
      </div>

      <div class="heroBp">${p.theme.blueprintSvg}</div>

      <div class="issue">
        <div class="l">REFERENCIA</div>
        <div class="n">№${esc(num)}</div>
      </div>

      <div class="strip">
        <div class="c"><div class="k">Cliente</div><div class="v">${esc(o.cliente)}</div></div>
        <div class="c"><div class="k">Emplazamiento</div><div class="v">${esc(o.emplazamiento)}</div></div>
        <div class="c"><div class="k">Fecha</div><div class="v">${esc(o.fecha)}</div></div>
        <div class="c"><div class="k">Validez</div><div class="v">${esc(o.validez)}</div></div>
      </div>

      <div class="money">
        <div>
          <div class="l">Importe total · IVA incluido</div>
          <div class="v">${esc((o.total || "").replace(/\s?€$/, ""))}<small>€</small></div>
        </div>
        <div class="br">
          Base imponible<b>${esc(o.base)}</b><br/>
          ${esc(o.ivaTexto)}<b>${esc(o.iva)}</b>
        </div>
      </div>

      <div class="contact">
        <div class="l">
          <span>${esc(p.empresa.telefono)}</span>
          <span>${esc(p.empresa.email)}</span>
          <span>${esc(p.empresa.web)}</span>
        </div>
        <div class="r">${esc(p.empresa.cif)}</div>
      </div>
    </section>`;
}

function htmlPageHead(p, scope) {
  return `
    <div class="pageHead">
      <div class="marca">
        <span class="logo">${renderLogo(p)}</span>
        <span class="t">${esc(p.empresa.nombre)}</span>
      </div>
      <div class="right">
        <div class="code">${esc(p.oferta.codigo)}</div>
        <div class="scope">${esc(scope || (p.oferta.cliente || "").toUpperCase())}</div>
      </div>
    </div>`;
}
function htmlPageFoot(p, idx) {
  return `
    <div class="pageFoot">
      <div><strong>${esc(p.empresa.nombre)}</strong> · ${esc(p.empresa.email)}</div>
      <div>${esc(idx)} / 04</div>
    </div>`;
}
function htmlChapter(num, label) {
  return `
    <div class="chapter">
      <div class="num">${esc(num)}</div>
      <div class="lab">${esc(label)}</div>
    </div>`;
}

// v3.9 · Factor de escala tipográfica para el alcance. Cuanto más
// largo es el texto, más se reduce la fuente para que quepa en la
// página sin recortarse. Los saltos de línea cuentan como ~50 chars
// porque cada párrafo/viñeta consume una línea completa.
function escalaTextoAlcance(texto) {
  const t = String(texto || "");
  const saltos = (t.match(/\r?\n/g) || []).length;
  const n = t.length + saltos * 40;
  if (n <= 650) return 1;
  if (n <= 950) return 0.92;
  if (n <= 1300) return 0.84;
  if (n <= 1700) return 0.76;
  if (n <= 2200) return 0.68;
  return 0.6;
}

function htmlAlcance(p) {
  // Renderiza la descripción TAL CUAL la escribió el técnico.
  // Cada línea no vacía se convierte en un párrafo con su propia
  // indentación; si hay una con guion al inicio se trata como bullet.
  // Si no llega texto, usa el fallback institucional.
  const texto = (p.alcanceTexto || p.alcanceIntro || "").trim()
    || "Trabajos de instalación según las especificaciones detalladas en este documento.";
  const escalaAlcance = escalaTextoAlcance(texto);
  const lineas = texto.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  // Reconocemos varios marcadores de viñeta: "-", "—", "•", "*",
  // "-.", "-)", "1.", "1)". El texto que queda se limpia para no
  // arrastrar el punto sobrante (ej. "-." → "Demolición..." sin el
  // punto inicial feo).
  const cuerpo = lineas.map(l => {
    const m = l.match(/^([-—•*]+|\d+[.)])\s*[.)\-]?\s*(.*)$/);
    if (m && m[2]) return `<li>${esc(m[2])}</li>`;
    return `<p>${esc(l)}</p>`;
  });
  // Agrupamos <li> consecutivos en <ul>
  const html = (() => {
    let out = "";
    let bufferUL = [];
    function flush() { if (bufferUL.length) { out += `<ul>${bufferUL.join("")}</ul>`; bufferUL = []; } }
    for (const item of cuerpo) {
      if (item.startsWith("<li>")) bufferUL.push(item);
      else { flush(); out += item; }
    }
    flush();
    return out;
  })();

  return `
    <section class="page scope">
      ${htmlPageHead(p, "ALCANCE")}
      ${htmlChapter("01", "Alcance de los trabajos")}
      <div class="body" style="--scope-scale:${escalaAlcance}">
        <div class="descripcion">${html}</div>
      </div>
      <div class="visual">
        ${p.theme.blueprintSvg}
        <div class="cap">ESPECIALIDAD<b>${esc(p.theme.label)}</b></div>
      </div>
      ${htmlPageFoot(p, "02")}
    </section>`;
}

function htmlInversion(p) {
  // v3.7 · solo Nº + Concepto + Importe. El cliente no necesita ver
  // unidades, cantidades ni precio unitario — esa contabilidad
  // interna queda en el editor. En el PDF se entrega un resumen
  // limpio: qué se hace y cuánto cuesta.
  const rows = (p.partidas || []).map((r) => `
    <tr>
      <td class="n">${esc(r[0])}</td>
      <td class="concept">${esc(r[1])}</td>
      <td class="r b">${esc(r[5])}</td>
    </tr>`).join("");
  return `
    <section class="page inv">
      ${htmlPageHead(p, "INVERSIÓN")}
      ${htmlChapter("02", "Detalle por partidas")}
      <div class="invBody">
        <div class="tableWrap">
          <table class="table simple">
            <thead><tr>
              <th class="c">Nº</th>
              <th>Concepto</th>
              <th class="r">Importe</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="totals">
          <div class="quote">Planificación, ejecución y control técnico como estándar operativo.</div>
          <div class="box">
            <div class="row"><span class="l">Base imponible</span><span class="r">${esc(p.oferta.base)}</span></div>
            <div class="row"><span class="l">${esc(p.oferta.ivaTexto)}</span><span class="r">${esc(p.oferta.iva)}</span></div>
            <div class="grand"><span class="l">Total · IVA incluido</span><span class="r">${esc(p.oferta.total)}</span></div>
          </div>
        </div>
        <div class="pillars">
          <div class="pillar"><div class="mark"></div><h4>Mano de obra cualificada</h4><p>Equipos propios formados.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Materiales certificados</h4><p>Primera marca, trazabilidad.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Gestión de residuos</h4><p>Gestor autorizado y reciclaje.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Garantía de obra</h4><p>Cobertura por escrito.</p></div>
        </div>
      </div>
      ${htmlPageFoot(p, "03")}
    </section>`;
}

function htmlAceptacion(p) {
  const o = p.oferta;
  const tituloFlat = (o.titulo || "").replace(/\s*[\n\r]+\s*/g, " ");
  return `
    <section class="page accept">
      ${htmlPageHead(p, "ACEPTACIÓN")}
      ${htmlChapter("03", "Documento de aceptación")}
      <div class="id">
        <div class="c"><div class="k">Código</div><div class="v">${esc(o.codigo)}</div></div>
        <div class="c"><div class="k">Obra</div><div class="v">${esc(tituloFlat)}</div></div>
        <div class="c"><div class="k">Cliente</div><div class="v">${esc(o.cliente)}</div></div>
        <div class="c"><div class="k">Fecha</div><div class="v">${esc(o.fecha)}</div></div>
      </div>
      <div class="legal p1">Mediante la firma del presente documento, el <strong>CLIENTE</strong> acepta el presupuesto identificado y autoriza el inicio del trabajo conforme a las condiciones descritas en la oferta.</div>
      <div class="legal p2">El importe total acordado asciende a <strong>${esc(o.total)} (IVA incluido)</strong>. La forma de pago se acordará previamente al inicio. Cualquier variación derivada de imprevistos en obra será notificada al CLIENTE y requerirá aprobación expresa.</div>
      <div class="importeAceptar">
        <span class="l">Importe a aceptar · IVA incluido</span>
        <span class="r">${esc(o.total)}</span>
      </div>
      <div class="signGrid">
        <div class="sign">
          <h3>Por el cliente</h3>
          <div class="line"></div>
          <div class="labels"><span>Firma</span><span>Nombre · DNI</span><span>Fecha</span></div>
        </div>
        <div class="sign empresa">
          <h3>Por Instalaciones Araujo</h3>
          <div class="sello">${renderSello(p)}</div>
          <div class="line"></div>
          <div class="labels"><span>Firma</span><span>Nombre · DNI</span><span>Fecha</span></div>
        </div>
      </div>
      <div class="corpFooter">
        <div>
          <div class="corp">Ara Corporate Sociedad de Inversiones SL</div>
          <div class="data">
            ${esc(p.empresa.direccion)}<br/>
            ${esc(p.empresa.email)} · ${esc(p.empresa.web)} · CIF ${esc(p.empresa.cif)}
          </div>
        </div>
        <div class="pn">04<span>DE 04</span></div>
      </div>
    </section>`;
}

function renderPresupuestoHtml(presupuesto) {
  const theme = getTheme(presupuesto?.oferta?.tipo);
  const p = {
    empresa: { ...EMPRESA_DEFAULT, ...(presupuesto.empresa || {}) },
    assets:  presupuesto.assets || {},      // v3.6 · { logoPng, selloPng } data-URIs
    oferta:  presupuesto.oferta || {},
    alcanceIntro: presupuesto.alcanceIntro || "",
    alcanceTexto: presupuesto.alcanceTexto || "",  // v3.6 · descripción completa verbatim
    alcance:  presupuesto.alcance || [],
    partidas: presupuesto.partidas || [],
    theme,
  };
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${esc(p.oferta.titulo || "Presupuesto")} · ${esc(p.oferta.codigo || "")}</title>
  <style>${pdfCss}</style>
</head>
<body>
  <div class="pdf-root">
    ${htmlCover(p)}
    ${htmlAlcance(p)}
    ${htmlInversion(p)}
    ${htmlAceptacion(p)}
  </div>
</body>
</html>`;
}

module.exports = { renderPresupuestoHtml, pdfCss, EMPRESA_DEFAULT };
