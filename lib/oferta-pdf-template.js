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

const EMPRESA_DEFAULT = {
  nombre: "Instalaciones Araujo",
  subtitulo: "Fontanería · Bajantes · Instalaciones",
  cif: "B90488222",
  telefono: "954 12 34 56",
  email: "presupuestos@araujofontaneria.es",
  web: "araujofontaneria.es",
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

/* ─────────── Tipografía base ─────────── */
.eyebrow{font-size:9pt;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:var(--muted)}
.label  {font-size:7.5pt;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.serif  {font-family:var(--serif)}
.italic {font-style:italic}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 1 · PORTADA
   Composición asimétrica · gran diagonal azul · blueprint dominante
   ════════════════════════════════════════════════════════════════ */
/* .cover hereda dimensiones de .page (210×297mm) */
.cover .diagonal{
  position:absolute;inset:0;
  background:linear-gradient(135deg,var(--navy) 0%,var(--navy-2) 100%);
  clip-path:polygon(0 0,100% 0,100% 50%,0 60%);
}
.cover .glow{
  position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(circle at 78% 8%,rgba(255,255,255,.06),transparent 38%),
    radial-gradient(circle at 18% 28%,rgba(255,255,255,.04),transparent 48%);
}
.cover .hair{
  position:absolute;left:18mm;right:0;top:14mm;height:1px;
  background:rgba(255,255,255,.18);
}

/* Cabecera */
.cover .head{
  position:absolute;top:18mm;left:18mm;right:18mm;color:#fff;
  display:flex;justify-content:space-between;align-items:flex-start;z-index:3;
}
.cover .marca{display:flex;flex-direction:column;line-height:1}
.cover .marca .a{
  font-family:var(--serif);font-weight:900;font-size:32pt;
  letter-spacing:-2.4px;color:#fff;line-height:.85;
}
.cover .marca .sub{
  font-size:7pt;font-weight:700;letter-spacing:.34em;
  color:rgba(255,255,255,.7);margin-top:8px;text-transform:uppercase;
}
.cover .ref{text-align:right;color:rgba(255,255,255,.7);font-size:8pt;letter-spacing:.32em;line-height:1.6}
.cover .ref strong{display:block;font-size:11pt;color:#fff;letter-spacing:.18em;margin-top:4px;font-weight:700}

/* Bloque hero (eyebrow + título XXL) */
.cover .hero{position:absolute;top:60mm;left:18mm;right:90mm;color:#fff;z-index:3}
.cover .hero .eye{
  display:inline-flex;align-items:center;gap:14px;
  font-size:9pt;font-weight:700;letter-spacing:.42em;color:rgba(255,255,255,.78);
}
.cover .hero .eye::before{content:"";display:block;width:34px;height:1px;background:rgba(255,255,255,.7)}
.cover .hero h1{
  font-family:var(--serif);font-weight:500;
  font-size:36pt;line-height:1.04;letter-spacing:-.04em;
  margin-top:16px;color:#fff;
}
.cover .hero h1 em{font-style:italic;font-weight:400;color:rgba(255,255,255,.95)}

/* Blueprint a la derecha · elemento gráfico dominante */
.cover .heroBp{position:absolute;right:14mm;top:38mm;width:78mm;height:120mm;z-index:2;opacity:.95}
.cover .heroBp svg{width:100%;height:100%;display:block}

/* Número de oferta estilo magazine */
.cover .issue{position:absolute;left:18mm;top:138mm;color:#fff;z-index:3}
.cover .issue .l{font-size:8pt;font-weight:700;letter-spacing:.36em;color:rgba(255,255,255,.6)}
.cover .issue .n{
  font-family:var(--serif);font-weight:900;
  font-size:64pt;letter-spacing:-3.5px;line-height:.85;margin-top:4px;
}

/* Tira editorial de datos (4 columnas separadas por hairlines) */
.cover .strip{
  position:absolute;left:18mm;right:18mm;top:188mm;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);padding-top:12px;
}
.cover .strip .c{padding:0 14px;border-left:1px solid var(--hair)}
.cover .strip .c:first-child{padding-left:0;border-left:0}
.cover .strip .k{font-size:7pt;letter-spacing:.32em;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.cover .strip .v{font-size:11pt;font-weight:600;color:var(--text);line-height:1.3}

/* Importe gigante */
.cover .money{
  position:absolute;left:18mm;right:18mm;top:218mm;
  display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;
}
.cover .money .l{font-size:8pt;letter-spacing:.34em;font-weight:800;text-transform:uppercase;color:var(--muted)}
.cover .money .v{
  font-family:var(--serif);font-weight:700;
  font-size:68pt;line-height:.92;letter-spacing:-.04em;color:var(--navy);margin-top:6px;
}
.cover .money .v small{font-size:32pt;color:var(--accent);font-weight:500;margin-left:4px;letter-spacing:-.02em}
.cover .money .br{font-size:10pt;color:var(--muted);text-align:right;padding-bottom:8px;line-height:1.7}
.cover .money .br b{color:var(--text);font-weight:700;margin-left:16px}

/* Pie con contacto */
.cover .contact{
  position:absolute;left:18mm;right:18mm;bottom:14mm;
  border-top:1px solid var(--hair);padding-top:10px;
  display:flex;justify-content:space-between;align-items:center;
  font-size:9pt;color:var(--muted);letter-spacing:.04em;
}
.cover .contact .r{color:var(--navy);font-weight:800;letter-spacing:.24em}
.cover .contact .l span{margin-right:24px}

/* ════════════════════════════════════════════════════════════════
   CABECERA DE PÁGINAS INTERIORES
   ════════════════════════════════════════════════════════════════ */
.pageHead{
  position:absolute;top:18mm;left:18mm;right:18mm;
  display:flex;justify-content:space-between;align-items:center;
  padding-bottom:12px;border-bottom:1px solid var(--hair);
}
.pageHead .marca{display:flex;align-items:baseline;gap:12px}
.pageHead .marca .a{font-family:var(--serif);font-weight:900;font-size:18pt;color:var(--navy);letter-spacing:-1.4px;line-height:1}
.pageHead .marca .t{font-size:8pt;font-weight:800;letter-spacing:.28em;color:var(--muted);text-transform:uppercase}
.pageHead .right{text-align:right;line-height:1.4}
.pageHead .right .code{font-size:11pt;font-weight:800;color:var(--navy);letter-spacing:.14em}
.pageHead .right .scope{font-size:7.5pt;letter-spacing:.32em;color:var(--muted);text-transform:uppercase;margin-top:2px}

/* Pie de páginas interiores */
.pageFoot{
  position:absolute;left:18mm;right:18mm;bottom:14mm;
  display:flex;justify-content:space-between;align-items:center;
  padding-top:10px;border-top:1px solid var(--hair);
  font-size:8.5pt;color:var(--muted);
}
.pageFoot strong{color:var(--navy);font-weight:800;letter-spacing:.18em;text-transform:uppercase}

/* ════════════════════════════════════════════════════════════════
   CAPÍTULO (titular numerado editorial)
   ════════════════════════════════════════════════════════════════ */
.chapter{position:absolute;top:46mm;left:18mm}
.chapter .num{
  font-family:var(--serif);font-weight:900;font-size:92pt;
  line-height:.85;letter-spacing:-5px;color:var(--navy);
}
.chapter .lab{
  font-size:9pt;font-weight:800;letter-spacing:.38em;text-transform:uppercase;
  color:var(--muted);border-top:1px solid var(--navy);
  padding-top:10px;margin-top:18px;display:inline-block;min-width:140px;
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 2 · ALCANCE
   ════════════════════════════════════════════════════════════════ */
.scope .body{
  position:absolute;left:18mm;top:118mm;width:108mm;
}
.scope .lead{
  font-family:var(--serif);font-size:14pt;line-height:1.4;
  font-weight:400;letter-spacing:-.2px;color:var(--text);margin-bottom:14px;
}
.scope .list{display:flex;flex-direction:column}
.scope .item{
  display:grid;grid-template-columns:28px 1fr;gap:12px;
  padding:11px 0;border-top:1px solid var(--hair);
}
.scope .item:last-child{border-bottom:1px solid var(--hair)}
.scope .item .idx{font-family:var(--serif);font-size:13pt;font-weight:700;color:var(--accent);letter-spacing:-.4px;line-height:1.1}
.scope .item h3{font-size:10pt;font-weight:800;color:var(--navy);margin-bottom:3px;letter-spacing:.02em}
.scope .item p{font-size:8.5pt;line-height:1.4;color:var(--muted)}

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
.scope .visual svg{width:78%;height:auto;position:relative;z-index:1}
.scope .visual .cap{
  position:absolute;left:14px;bottom:14px;color:#fff;
  font-size:7pt;letter-spacing:.36em;font-weight:800;text-transform:uppercase;z-index:2;
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
  position:absolute;left:18mm;right:18mm;top:118mm;bottom:30mm;
  display:flex;flex-direction:column;gap:20px;
}
.inv .invBody .tableWrap{flex:0 0 auto}
.inv .table{border-collapse:collapse;width:100%}
.inv .table th{
  background:transparent;color:var(--muted);
  text-align:left;padding:10px 6px;
  font-size:7.5pt;letter-spacing:.24em;font-weight:800;text-transform:uppercase;
  border-bottom:1px solid var(--navy);
}
.inv .table th.c{text-align:center}
.inv .table th.r{text-align:right}
.inv .table td{
  padding:10px 6px;font-size:9pt;color:var(--text);
  border-bottom:1px solid var(--hair);vertical-align:middle;
}
.inv .table td.n{
  font-family:var(--serif);font-size:13pt;font-weight:700;
  color:var(--accent);text-align:center;width:28px;letter-spacing:-.5px;
}
.inv .table td.concept{font-size:10pt;font-weight:600;color:var(--navy);line-height:1.3}
.inv .table td.c{text-align:center;color:var(--muted);white-space:nowrap}
.inv .table td.r{text-align:right;white-space:nowrap;color:var(--muted)}
.inv .table td.r.b{
  font-family:var(--serif);font-size:12pt;font-weight:700;color:var(--navy);
}

/* Bloque totales · grid quote + box */
.inv .totals{display:grid;grid-template-columns:1fr 78mm;gap:0;flex:0 0 auto}
.inv .totals .quote{
  background:#F0F2F5;padding:18px 22px;
  display:flex;align-items:flex-end;
  font-family:var(--serif);font-size:11pt;font-style:italic;
  font-weight:500;color:var(--navy);line-height:1.35;letter-spacing:-.2px;
}
.inv .totals .row{display:flex;justify-content:space-between;padding:10px 16px;font-size:9pt;border-bottom:1px solid var(--hair)}
.inv .totals .row .l{color:var(--muted)}
.inv .totals .row .r{font-weight:700;color:var(--text);white-space:nowrap}
.inv .totals .grand{background:var(--navy);color:#fff;padding:16px;display:flex;justify-content:space-between;align-items:baseline}
.inv .totals .grand .l{font-size:7.5pt;letter-spacing:.3em;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,.65)}
.inv .totals .grand .r{font-family:var(--serif);font-size:17pt;font-weight:700;letter-spacing:-.04em;color:#fff;white-space:nowrap}

/* Pilares de marca · empujados al fondo del flex */
.inv .pillars{
  margin-top:auto;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);padding-top:16px;
}
.inv .pillar{padding:0 18px 4px 0;border-right:1px solid var(--hair)}
.inv .pillar:last-child{border-right:0}
.inv .pillar .mark{width:18px;height:1px;background:var(--navy);margin-bottom:10px}
.inv .pillar h4{font-size:9pt;font-weight:800;color:var(--navy);margin-bottom:3px;line-height:1.3}
.inv .pillar p{font-size:8pt;color:var(--muted);line-height:1.4}

/* ════════════════════════════════════════════════════════════════
   PÁGINA 4 · ACEPTACIÓN
   ════════════════════════════════════════════════════════════════ */
.accept .id{
  position:absolute;left:18mm;right:18mm;top:118mm;
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--navy);border-bottom:1px solid var(--navy);padding:14px 0;
}
.accept .id .c{padding:0 14px;border-left:1px solid var(--hair)}
.accept .id .c:first-child{padding-left:0;border-left:0}
.accept .id .k{font-size:7pt;letter-spacing:.32em;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.accept .id .v{font-size:11pt;font-weight:700;color:var(--navy);line-height:1.3}

.accept .legal{position:absolute;left:18mm;right:18mm;font-size:10pt;line-height:1.55;color:var(--text)}
.accept .legal strong{color:var(--navy);font-weight:700}
.accept .legal.p1{top:152mm}
.accept .legal.p2{top:174mm}

.accept .importeAceptar{
  position:absolute;left:18mm;right:18mm;top:196mm;
  border-top:1px solid var(--navy);padding-top:12px;
  display:flex;justify-content:space-between;align-items:baseline;
}
.accept .importeAceptar .l{font-size:8.5pt;letter-spacing:.34em;font-weight:800;text-transform:uppercase;color:var(--muted)}
.accept .importeAceptar .r{font-family:var(--serif);font-size:40pt;font-weight:700;letter-spacing:-.04em;color:var(--navy);line-height:.95}

.accept .signGrid{
  position:absolute;left:18mm;right:18mm;top:222mm;
  display:grid;grid-template-columns:1fr 1fr;gap:30px;
}
.accept .sign{padding-top:12px;border-top:1px solid var(--navy)}
.accept .sign h3{font-size:8.5pt;letter-spacing:.32em;font-weight:800;text-transform:uppercase;color:var(--navy);margin-bottom:26px}
.accept .sign .line{height:1px;background:var(--text)}
.accept .sign .labels{display:flex;justify-content:space-between;font-size:8pt;color:var(--muted);margin-top:6px;letter-spacing:.04em}

/* Footer corporativo grande con gradiente */
.accept .corpFooter{
  position:absolute;left:0;right:0;bottom:0;
  background:linear-gradient(135deg,var(--navy) 0%,var(--navy-2) 100%);
  color:#fff;padding:12mm 18mm 12mm 18mm;
  display:flex;justify-content:space-between;align-items:flex-end;
}
.accept .corpFooter .corp{font-family:var(--serif);font-size:15pt;font-weight:700;letter-spacing:-.2px;margin-bottom:6px}
.accept .corpFooter .data{font-size:9pt;line-height:1.55;color:rgba(255,255,255,.78)}
.accept .corpFooter .pn{font-family:var(--serif);font-size:32pt;font-weight:900;color:rgba(255,255,255,.9);letter-spacing:-.04em;line-height:.85}
.accept .corpFooter .pn span{display:block;font-family:var(--sans);font-size:7.5pt;letter-spacing:.36em;font-weight:700;color:rgba(255,255,255,.6);margin-top:6px}

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
          <span class="a">A</span>
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
        <span class="a">A</span>
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

function htmlAlcance(p) {
  const items = (p.alcance || []).slice(0, 7).map((a, i) => `
    <div class="item">
      <div class="idx">${String(i + 1).padStart(2, "0")}</div>
      <div>
        <h3>${esc(a[0])}</h3>
        <p>${esc(a[1])}</p>
      </div>
    </div>`).join("");
  return `
    <section class="page scope">
      ${htmlPageHead(p, "ALCANCE")}
      ${htmlChapter("01", "Alcance de los trabajos")}
      <div class="body">
        <p class="lead">${esc(p.alcanceIntro)}</p>
        <div class="list">${items}</div>
      </div>
      <div class="visual">
        ${p.theme.blueprintSvg}
        <div class="cap">ESPECIALIDAD<b>${esc(p.theme.label)}</b></div>
      </div>
      ${htmlPageFoot(p, "02")}
    </section>`;
}

function htmlInversion(p) {
  const rows = (p.partidas || []).map((r) => `
    <tr>
      <td class="n">${esc(r[0])}</td>
      <td class="concept">${esc(r[1])}</td>
      <td class="c">${esc(r[2])}</td>
      <td class="c">${esc(r[3])}</td>
      <td class="r">${esc(r[4])}</td>
      <td class="r b">${esc(r[5])}</td>
    </tr>`).join("");
  return `
    <section class="page inv">
      ${htmlPageHead(p, "INVERSIÓN")}
      ${htmlChapter("02", "Detalle por partidas")}
      <div class="invBody">
        <div class="tableWrap">
          <table class="table">
            <thead><tr>
              <th class="c">Nº</th>
              <th>Concepto</th>
              <th class="c">Unidad</th>
              <th class="c">Cantidad</th>
              <th class="r">Precio unit.</th>
              <th class="r">Importe</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="totals">
          <div class="quote">"Calidad, plazo y limpieza de obra como compromiso de marca."</div>
          <div class="box">
            <div class="row"><span class="l">Base imponible</span><span class="r">${esc(p.oferta.base)}</span></div>
            <div class="row"><span class="l">${esc(p.oferta.ivaTexto)}</span><span class="r">${esc(p.oferta.iva)}</span></div>
            <div class="grand"><span class="l">Total · IVA incluido</span><span class="r">${esc(p.oferta.total)}</span></div>
          </div>
        </div>
        <div class="pillars">
          <div class="pillar"><div class="mark"></div><h4>Mano de obra cualificada</h4><p>Equipos propios formados en instalaciones y rehabilitación.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Materiales certificados</h4><p>Suministros de primera marca con trazabilidad garantizada.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Gestión de residuos</h4><p>Retirada y reciclaje a través de gestor autorizado.</p></div>
          <div class="pillar"><div class="mark"></div><h4>Garantía de obra</h4><p>Cobertura escrita sobre los trabajos ejecutados.</p></div>
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
        <div class="sign">
          <h3>Por Instalaciones Araujo</h3>
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
    oferta:  presupuesto.oferta || {},
    alcanceIntro: presupuesto.alcanceIntro || "",
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
