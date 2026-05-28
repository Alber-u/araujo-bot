/**
 * oferta-pdf-template · v1.0.0
 * --------------------------------------------------------------
 * Template HTML+CSS canónico del PDF de presupuesto. Es la fuente
 * de verdad: el backend lo renderiza con Puppeteer y el frontend
 * (ara-os/src/components/pdf/) replica el mismo CSS para
 * previsualización. NO modificar el estilo sin actualizar las dos
 * partes.
 *
 * Exporta dos funciones puras:
 *   renderPresupuestoHtml(p)  → string HTML completo listo para
 *                                page.setContent() de puppeteer
 *   pdfCss                    → string CSS (también accesible para
 *                                el frontend si quiere consumirlo)
 *
 * Shape del presupuesto:
 *   {
 *     empresa: { nombre, subtitulo, cif, telefono, email, web,
 *                direccion },
 *     oferta: { codigo, titulo, tipo, cliente, emplazamiento,
 *               fecha, validez, incluye, base, ivaTexto, iva,
 *               total },
 *     alcanceIntro: string,
 *     alcance: [[titulo, descripcion], ...],
 *     partidas: [[n, concepto, unidad, cantidad, precio, importe], ...]
 *   }
 * --------------------------------------------------------------
 */

const EMPRESA_DEFAULT = {
  nombre: "Instalaciones Araujo",
  subtitulo: "Fontanería · Bajantes · Instalaciones",
  cif: "B90488222",
  telefono: "954 12 34 56",
  email: "presupuestos@araujofontaneria.es",
  web: "araujofontaneria.es",
  direccion: "Avenida San Francisco Javier · Edificio Sevilla 2, Planta 6, Módulo 9 · 41018 · Sevilla",
};

// Iconos como caracteres Unicode (sólida compatibilidad en Chromium)
const ICONOS_SCOPE = ["⌁", "↧", "◌", "▣", "♻", "✓", "◆", "▲"];

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// CSS canonical. Cualquier cambio aquí debe replicarse en
// ara-os/src/components/pdf/pdf.css (que importa este string en
// tiempo de build o duplica el contenido).
const pdfCss = `
:root{
  --navy:#0B1F3A;
  --blue:#123E6B;
  --mid:#0B5C94;
  --pale:#EFF6FB;
  --line:#DCE7F0;
  --text:#0B1420;
  --muted:#6B7785;
}
*{box-sizing:border-box}
body{margin:0;background:white;font-family:'Inter','Manrope','Helvetica Neue',Arial,sans-serif;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pdfPreview{display:block}
.page{width:210mm;height:297mm;background:white;position:relative;overflow:hidden;padding:54px 62px 56px;page-break-after:always;page-break-inside:avoid}
.page:last-child{page-break-after:auto}
.pageHeader{height:72px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px}
.logoBlock{display:flex;gap:14px;align-items:center}
.mark{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--mid));color:white;display:grid;place-items:center;font-weight:900;letter-spacing:-1px;font-size:15px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.18)}
.brand{font-size:20px;line-height:18px;font-weight:850;letter-spacing:-.5px;color:var(--navy)}
.tagline{font-size:10px;color:var(--muted);margin-top:4px;letter-spacing:.1px}
.headerRight{text-align:right;color:#8A96A3;font-size:12px;text-transform:uppercase;line-height:1.5}
.headerRight .code{font-size:14px;color:var(--blue);font-weight:850}

.cover{padding:58px 62px 0}
.coverShape{position:absolute;right:-70px;top:0;width:330px;height:545px;background:linear-gradient(155deg,var(--navy),var(--mid));clip-path:polygon(28% 0,100% 0,100% 100%,0 82%);opacity:.98}
.coverStripe{position:absolute;right:218px;top:120px;width:8px;height:410px;background:var(--mid);transform:skewY(-28deg);opacity:.9}
.pillCode{position:absolute;top:64px;right:62px;background:var(--pale);color:var(--blue);font-weight:850;padding:12px 18px;border-radius:4px;font-size:13px;z-index:3}
.coverGrid{position:relative;display:grid;grid-template-columns:1.15fr .85fr;gap:38px;margin-top:88px}
.eyebrow{font-size:13px;color:var(--mid);font-weight:900;letter-spacing:.04em;margin-bottom:14px}
.cover h1{font-size:42px;line-height:1.06;margin:0;color:var(--text);letter-spacing:-1.4px;max-width:440px}
.accentLine{width:86px;height:3px;background:var(--mid);margin:34px 0}
.infoGrid{display:grid;grid-template-columns:1fr 1fr;gap:28px 22px;margin-top:8px}
.infoItem{display:flex;gap:13px;align-items:flex-start}
.icon{width:36px;height:36px;border-radius:50%;background:#EAF4FC;color:var(--mid);display:grid;place-items:center;font-size:16px;flex:0 0 36px;border:1px solid #d8e9f6}
.infoItem .data span,.fact span{display:block;color:#7C8894;font-size:10px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;margin-bottom:5px}
.infoItem .data strong,.fact strong{display:block;font-size:14px;line-height:1.35;color:var(--text)}
.visualCard{position:relative;z-index:2;margin-right:-18px;margin-top:-48px;background:white;border-radius:10px;padding:16px;box-shadow:0 18px 55px rgba(11,31,58,.18)}
.visualCard .blueprint{background:#f7fbff}

.totalBand{position:absolute;left:62px;right:62px;bottom:200px;background:linear-gradient(90deg,var(--blue),var(--mid));color:white;display:flex;justify-content:space-between;align-items:center;padding:24px 34px}
.totalBand .totBlock span{display:block;font-size:11px;font-weight:800;letter-spacing:.04em;opacity:.83}
.totalBand .totBlock strong{font-size:44px;letter-spacing:-1.2px}
.taxBox{display:grid;grid-template-columns:auto auto;gap:7px 18px;align-items:center;text-align:right}
.taxBox b{font-size:13px}
.taxBox span{font-size:11px;opacity:.83}

.miniFacts{position:absolute;left:62px;right:62px;bottom:112px;display:grid;gap:9px}
.fact{display:grid;grid-template-columns:84px 1fr;align-items:baseline;gap:8px}
.contactBar{position:absolute;left:0;right:0;bottom:0;height:48px;border-top:1px solid var(--line);display:flex;align-items:center;gap:34px;padding:0 62px;color:#53606c;font-size:12px}

.content{padding-top:54px}
.twoCol{display:grid;grid-template-columns:1fr 280px;gap:44px}
.sectionTitle{display:flex;align-items:baseline;gap:22px;margin-bottom:24px}
.sectionTitle .num{font-size:34px;font-weight:900;color:var(--blue);letter-spacing:-1px}
.sectionTitle h2{font-size:18px;letter-spacing:.02em;margin:0;color:var(--blue);font-weight:900}
.lead{font-size:17px;line-height:1.45;margin:0 0 26px;max-width:540px}
.scopeList{display:grid;gap:22px}
.scopeItem{display:grid;grid-template-columns:42px 1fr;gap:16px;align-items:start}
.scopeItem h3{font-size:15px;color:var(--blue);margin:0 0 4px;font-weight:900}
.scopeItem p{font-size:13px;line-height:1.35;color:#4E5A66;margin:0}
.blueprint{background:var(--pale);border-radius:2px;display:grid;place-items:center;min-height:350px;padding:18px}

.pageFooter{position:absolute;left:62px;right:62px;bottom:24px;border-top:1px solid var(--line);padding-top:12px;color:#8A96A3;font-size:10px;display:flex;justify-content:space-between}
.pageFooter strong{color:var(--blue)}

.budgetTable{width:100%;border-collapse:collapse;font-size:12px;margin-top:18px}
.budgetTable th{background:var(--navy);color:white;text-align:left;padding:13px 12px;font-size:10px;letter-spacing:.03em}
.budgetTable td{border:1px solid var(--line);padding:14px 12px;vertical-align:top}
.budgetTable th:nth-child(1),.budgetTable td:nth-child(1),
.budgetTable th:nth-child(3),.budgetTable td:nth-child(3),
.budgetTable th:nth-child(4),.budgetTable td:nth-child(4){text-align:center}
.budgetTable th:nth-child(5),.budgetTable td:nth-child(5),
.budgetTable th:nth-child(6),.budgetTable td:nth-child(6){text-align:right;white-space:nowrap}
.budgetTable td:nth-child(2){min-width:240px}

.summaryBox{width:360px;margin:28px 0 0 auto;border:1px solid var(--line);font-size:13px}
.summaryBox div{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)}
.summaryBox div:last-child{border-bottom:0}
.summaryBox .grand{background:linear-gradient(90deg,var(--blue),var(--mid));color:white;font-weight:900}
.summaryBox .grand strong{font-size:22px}

.promiseGrid,.conditions{margin-top:54px;background:#F3F8FC;border:1px solid #E4EEF6;display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:22px}
.promise{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;border-right:1px solid var(--line);min-height:94px;justify-content:center;padding:0 8px}
.promise:last-child{border-right:0}
.promise strong{font-size:12px;color:var(--blue)}
.promise span{font-size:11px;color:#596775}

.acceptGrid{background:#F3F8FC;border:1px solid #E4EEF6;padding:18px 22px;display:grid;grid-template-columns:170px 1fr 170px 1fr;gap:12px 18px;margin-bottom:28px;align-items:baseline}
.acceptGrid .factK{font-size:10px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;color:#7C8894}
.acceptGrid .factV{font-size:13px;font-weight:850;color:var(--text)}

.legal{font-size:14px;line-height:1.55;margin:0 0 16px}
.acceptAmount{margin:34px 0;background:#EAF4FC;display:flex;justify-content:space-between;align-items:center;padding:22px 28px;color:var(--blue)}
.acceptAmount span{font-size:12px;font-weight:850}
.acceptAmount strong{font-size:34px;letter-spacing:-1px}
.signGrid{display:grid;grid-template-columns:1fr 1fr;gap:38px;margin-top:42px}
.sign{background:#F8FBFD;padding:22px;border:1px solid #E8F0F6;min-height:138px}
.sign h3{margin:0;color:var(--blue);font-size:12px}
.sign .line{height:1px;background:#677583;margin-top:58px}
.signLabels{display:flex;justify-content:space-between;color:#8995A1;font-size:10px;margin-top:8px}
.conditions{grid-template-columns:repeat(3,1fr);margin-top:42px;margin-bottom:24px}
.companyFooter{background:linear-gradient(90deg,var(--blue),var(--navy));color:white;padding:20px 26px;font-size:12px;line-height:1.5;margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end}
.companyFooter .pageNum{font-size:11px;color:rgba(255,255,255,.7);font-weight:700;white-space:nowrap;margin-left:24px}

@media print{
  body{background:white}
  .page{box-shadow:none;border-radius:0}
}
`;

function htmlLogo(empresa) {
  return `
    <div class="logoBlock">
      <div class="mark">IA</div>
      <div>
        <div class="brand">${esc(empresa.nombre.split(" ")[0])}<br/>${esc(empresa.nombre.split(" ").slice(1).join(" "))}</div>
        <div class="tagline">${esc(empresa.subtitulo)}</div>
      </div>
    </div>`;
}

function htmlHeader(presupuesto, { right = true, label = "" } = {}) {
  return `
    <div class="pageHeader">
      ${htmlLogo(presupuesto.empresa)}
      ${right ? `
        <div class="headerRight">
          <div class="code">${esc(presupuesto.oferta.codigo)}</div>
          <div>${esc(label || (presupuesto.oferta.cliente || "").toUpperCase())}</div>
        </div>` : ""}
    </div>`;
}

function htmlFooter(presupuesto, page) {
  return `
    <div class="pageFooter">
      <div><strong>${esc(presupuesto.empresa.nombre)}</strong> · ${esc(presupuesto.empresa.cif)}<br/>${esc(presupuesto.empresa.email)}</div>
      <div>${esc(page)} / 4</div>
    </div>`;
}

function htmlTechnicalBuilding() {
  // Ilustración técnica neutra (mismo SVG que el component React).
  // Reutilizable para cualquier tipo de obra; sin foto específica.
  const ventanas = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      ventanas.push(`<rect x="${45 + c * 55}" y="${48 + r * 46}" width="28" height="31" stroke="#7da0bb" stroke-width="1.6" fill="none"/>`);
    }
  }
  return `
    <div class="blueprint" aria-hidden="true">
      <svg viewBox="0 0 280 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
        <rect x="20" y="20" width="210" height="330" rx="3" stroke="#9fb9cf" stroke-width="2"/>
        ${ventanas.join("")}
        <path d="M210 28V350" stroke="#0B5C94" stroke-width="8" stroke-linecap="round"/>
        <path d="M196 80H224" stroke="#0B5C94" stroke-width="5" stroke-linecap="round"/>
        <path d="M196 145H224" stroke="#0B5C94" stroke-width="5" stroke-linecap="round"/>
        <path d="M196 215H224" stroke="#0B5C94" stroke-width="5" stroke-linecap="round"/>
        <path d="M196 282H224" stroke="#0B5C94" stroke-width="5" stroke-linecap="round"/>
        <path d="M230 20L260 55V350H230" stroke="#c4d4e2" stroke-width="2"/>
        <path d="M20 350H260" stroke="#c4d4e2" stroke-width="2"/>
      </svg>
    </div>`;
}

function htmlCover(p) {
  const o = p.oferta;
  return `
    <section class="page cover">
      <div class="coverShape"></div>
      <div class="coverStripe"></div>
      ${htmlHeader(p, { right: false })}
      <div class="pillCode">${esc(o.codigo)}</div>
      <div class="coverGrid">
        <div>
          <div class="eyebrow">OFERTA COMERCIAL</div>
          <h1>${esc(o.titulo)}</h1>
          <div class="accentLine"></div>
          <div class="infoGrid">
            <div class="infoItem"><div class="icon">👤</div><div class="data"><span>CLIENTE</span><strong>${esc(o.cliente)}</strong></div></div>
            <div class="infoItem"><div class="icon">📍</div><div class="data"><span>EMPLAZAMIENTO</span><strong>${esc(o.emplazamiento)}</strong></div></div>
            <div class="infoItem"><div class="icon">📄</div><div class="data"><span>Nº DE OFERTA</span><strong>${esc(o.codigo)}</strong></div></div>
            <div class="infoItem"><div class="icon">📅</div><div class="data"><span>FECHA DE EMISIÓN</span><strong>${esc(o.fecha)}</strong></div></div>
          </div>
        </div>
        <div class="visualCard">
          ${htmlTechnicalBuilding()}
        </div>
      </div>
      <div class="totalBand">
        <div class="totBlock">
          <span>IMPORTE TOTAL (IVA incluido)</span>
          <strong>${esc(o.total)}</strong>
        </div>
        <div class="taxBox">
          <span>Base imponible</span><b>${esc(o.base)}</b>
          <span>${esc(o.ivaTexto)}</span><b>${esc(o.iva)}</b>
        </div>
      </div>
      <div class="miniFacts">
        <div class="fact"><span>VALIDEZ</span><strong>${esc(o.validez)}</strong></div>
        <div class="fact"><span>INCLUYE</span><strong>${esc(o.incluye)}</strong></div>
        <div class="fact"><span>EMITE</span><strong>${esc(p.empresa.nombre)} · ${esc(p.empresa.cif)}</strong></div>
      </div>
      <div class="contactBar">
        <span>☎ ${esc(p.empresa.telefono)}</span>
        <span>✉ ${esc(p.empresa.email)}</span>
        <span>🌐 ${esc(p.empresa.web)}</span>
      </div>
    </section>`;
}

function htmlScope(p) {
  const items = (p.alcance || []).map(([titulo, texto], i) => `
    <div class="scopeItem">
      <div class="icon">${esc(ICONOS_SCOPE[i % ICONOS_SCOPE.length])}</div>
      <div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p></div>
    </div>`).join("");
  return `
    <section class="page">
      ${htmlHeader(p)}
      <main class="content twoCol">
        <div>
          <div class="sectionTitle"><span class="num">01</span><h2>ALCANCE DE LOS TRABAJOS</h2></div>
          <p class="lead">${esc(p.alcanceIntro)}</p>
          <div class="scopeList">${items}</div>
        </div>
        ${htmlTechnicalBuilding()}
      </main>
      ${htmlFooter(p, 2)}
    </section>`;
}

function htmlInvestment(p) {
  const rows = (p.partidas || []).map((r) =>
    `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`
  ).join("");
  return `
    <section class="page">
      ${htmlHeader(p, { label: "INVERSIÓN" })}
      <main class="content">
        <div class="sectionTitle"><span class="num">02</span><h2>DETALLE POR PARTIDAS</h2></div>
        <table class="budgetTable">
          <thead><tr>
            <th>Nº</th><th>CONCEPTO</th><th>UNIDAD</th><th>CANTIDAD</th><th>PRECIO UNITARIO</th><th>IMPORTE</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summaryBox">
          <div><span>SUBTOTAL</span><strong>${esc(p.oferta.base)}</strong></div>
          <div><span>${esc(p.oferta.ivaTexto)}</span><strong>${esc(p.oferta.iva)}</strong></div>
          <div class="grand"><span>TOTAL (IVA incluido)</span><strong>${esc(p.oferta.total)}</strong></div>
        </div>
        <div class="promiseGrid">
          <div class="promise"><div class="icon">⚙</div><strong>Mano de obra</strong><span>cualificada</span></div>
          <div class="promise"><div class="icon">◇</div><strong>Materiales</strong><span>de primera calidad</span></div>
          <div class="promise"><div class="icon">♻</div><strong>Gestión de residuos</strong><span>certificada</span></div>
          <div class="promise"><div class="icon">✓</div><strong>Garantía</strong><span>de los trabajos</span></div>
        </div>
      </main>
      ${htmlFooter(p, 3)}
    </section>`;
}

function htmlAcceptance(p) {
  const o = p.oferta;
  return `
    <section class="page">
      ${htmlHeader(p, { label: "ACEPTACIÓN" })}
      <main class="content">
        <div class="sectionTitle"><span class="num">03</span><h2>DOCUMENTO DE ACEPTACIÓN</h2></div>
        <div class="acceptGrid">
          <div class="factK">CÓDIGO DE OFERTA</div><div class="factV">${esc(o.codigo)}</div>
          <div class="factK">NOMBRE DE LA OBRA</div><div class="factV">${esc(o.titulo)}</div>
          <div class="factK">CLIENTE</div><div class="factV">${esc(o.cliente)}</div>
          <div class="factK">FECHA DE EMISIÓN</div><div class="factV">${esc(o.fecha)}</div>
        </div>
        <p class="legal">Mediante la firma del presente documento, el CLIENTE acepta el presupuesto identificado y autoriza el inicio del trabajo conforme a las condiciones descritas en la oferta.</p>
        <p class="legal">El importe total acordado asciende a <strong>${esc(o.total)} (IVA incluido)</strong>. La forma de pago se acordará previamente al inicio. Cualquier variación derivada de imprevistos en obra será notificada al CLIENTE y requerirá aprobación expresa.</p>
        <div class="acceptAmount"><span>IMPORTE A ACEPTAR (IVA incluido)</span><strong>${esc(o.total)}</strong></div>
        <div class="signGrid">
          <div class="sign"><h3>POR EL CLIENTE</h3><div class="line"></div><div class="signLabels"><span>Firma</span><span>Nombre / DNI</span><span>Fecha</span></div></div>
          <div class="sign"><h3>POR INSTALACIONES ARAUJO</h3><div class="line"></div><div class="signLabels"><span>Firma</span><span>Nombre / DNI</span><span>Fecha</span></div></div>
        </div>
        <div class="conditions">
          <div class="promise"><div class="icon">✓</div><strong>Plazo de ejecución</strong><span>7-10 días laborables</span></div>
          <div class="promise"><div class="icon">€</div><strong>Forma de pago</strong><span>50% al inicio / 50% a la finalización</span></div>
          <div class="promise"><div class="icon">📅</div><strong>Validez</strong><span>30 días</span></div>
        </div>
      </main>
      <div class="companyFooter">
        <div>
          <strong>Ara Corporate Sociedad de Inversiones SL</strong><br/>
          ${esc(p.empresa.direccion)}<br/>
          ${esc(p.empresa.email)} · ${esc(p.empresa.web)}
        </div>
        <div class="pageNum">4 / 4</div>
      </div>
    </section>`;
}

function renderPresupuestoHtml(presupuesto) {
  const p = {
    empresa: { ...EMPRESA_DEFAULT, ...(presupuesto.empresa || {}) },
    oferta: presupuesto.oferta || {},
    alcanceIntro: presupuesto.alcanceIntro || "",
    alcance: presupuesto.alcance || [],
    partidas: presupuesto.partidas || [],
  };
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${esc(p.oferta.titulo || "Presupuesto")} · ${esc(p.oferta.codigo || "")}</title>
  <style>${pdfCss}</style>
</head>
<body>
  <div class="pdfPreview">
    ${htmlCover(p)}
    ${htmlScope(p)}
    ${htmlInvestment(p)}
    ${htmlAcceptance(p)}
  </div>
</body>
</html>`;
}

module.exports = { renderPresupuestoHtml, pdfCss, EMPRESA_DEFAULT };
