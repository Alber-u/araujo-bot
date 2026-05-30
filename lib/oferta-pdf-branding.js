/**
 * oferta-pdf-branding · v1.1
 * --------------------------------------------------------------
 * Activos de marca como SVG inline (vectoriales puros).
 *
 *   logoSvg(opts)   — Marca principal AAA. Header + portada.
 *   selloSvg(opts)  — Sello corporativo. Firma + watermark.
 *
 * opts:
 *   color    string  (default #0d4d8a)
 *   variant  'mark' | 'inverso' — solo logoSvg
 *
 * Reproducción vectorial del original de Araujo: 3 As geométricas
 * compartiendo una barra horizontal central, círculo doble exterior.
 * Cero rasters, cero dependencias.
 * --------------------------------------------------------------
 */

// ── LOGO AAA · v2 ────────────────────────────────────────────────
// Reproducción vectorial del logo original de Instalaciones Araujo:
// un solo círculo de contorno y tres letras 'A' compartiendo una
// barra horizontal central. Las As son anchas y de trazo grueso,
// con sus lados próximos (casi tocándose entre A y A).
function logoSvg({ color = "#1B528E", variant = "mark" } = {}) {
  const c = variant === "inverso" ? "#ffffff" : color;
  const apexY = 28, baseY = 76, barY = 56;
  const apexCx = [30, 50, 70];
  const halfW  = 14;
  const sw     = 7;
  const aPath = (cx) => `M ${cx - halfW} ${baseY} L ${cx} ${apexY} L ${cx + halfW} ${baseY}`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
    <circle cx="50" cy="50" r="46" fill="none" stroke="${c}" stroke-width="4"/>
    ${apexCx.map(cx => `<path d="${aPath(cx)}" stroke="${c}" stroke-width="${sw}" stroke-linejoin="miter" stroke-linecap="square" fill="none"/>`).join("")}
    <line x1="14" y1="${barY}" x2="86" y2="${barY}" stroke="${c}" stroke-width="${sw}" stroke-linecap="square"/>
  </svg>`;
}

// ── SELLO CORPORATIVO ────────────────────────────────────────────
// Doble círculo + texto perimetral curvado arriba/abajo + logo AAA
// central. Para que el texto inferior se lea correcto, el arco
// va de IZQ→DCHA pero por abajo (curvatura negativa).
function selloSvg({
  color = "#0d4d8a",
  textoArriba = "ARA CORPORATE SOCIEDAD DE INVERSIONES SL",
  textoAbajo  = "CIF B90488222 · SEVILLA",
} = {}) {
  const c = color;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none">
    <defs>
      <!-- Arco superior · va de 22,100 a 178,100 PASANDO POR ARRIBA -->
      <path id="arcUp"   d="M 22 100 A 78 78 0 0 1 178 100" fill="none"/>
      <!-- Arco inferior · va de 22,100 a 178,100 PASANDO POR ABAJO
           (sweep-flag invertido). El text-anchor:middle + startOffset
           50% lo centra dentro de la curva, leyéndose de izquierda
           a derecha al estar el observador mirando hacia arriba. -->
      <path id="arcDown" d="M 22 100 A 78 78 0 0 0 178 100" fill="none"/>
    </defs>

    <!-- Doble círculo perimetral -->
    <circle cx="100" cy="100" r="96" fill="none" stroke="${c}" stroke-width="2.6"/>
    <circle cx="100" cy="100" r="84" fill="none" stroke="${c}" stroke-width="1"/>

    <!-- Texto perimetral arriba -->
    <text font-family="Inter,Helvetica,sans-serif" font-size="9" font-weight="700" letter-spacing="1.6" fill="${c}">
      <textPath href="#arcUp" startOffset="50%" text-anchor="middle">${textoArriba}</textPath>
    </text>
    <!-- Texto perimetral abajo (curvatura inversa para que se lea derecho) -->
    <text font-family="Inter,Helvetica,sans-serif" font-size="8.5" font-weight="600" letter-spacing="1.4" fill="${c}">
      <textPath href="#arcDown" startOffset="50%" text-anchor="middle">${textoAbajo}</textPath>
    </text>

    <!-- Pequeños puntos separadores en los polos laterales -->
    <circle cx="20"  cy="100" r="1.4" fill="${c}"/>
    <circle cx="180" cy="100" r="1.4" fill="${c}"/>

    <!-- Logo AAA centrado, escala 0.58 · viewbox 100×100 → 58×58 -->
    <g transform="translate(71 71) scale(0.58)">
      ${logoSvg({ color: c }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}
    </g>
  </svg>`;
}

module.exports = { logoSvg, selloSvg };
