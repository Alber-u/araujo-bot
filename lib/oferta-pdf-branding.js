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

// ── LOGO AAA ─────────────────────────────────────────────────────
// Tres letras A entrelazadas dentro de doble círculo. Construidas
// con strokes para tener control fino del peso y mantener limpieza
// a cualquier tamaño.
function logoSvg({ color = "#0d4d8a", variant = "mark" } = {}) {
  const c = variant === "inverso" ? "#ffffff" : color;
  // Cada A son dos diagonales (izq/der) + cierre triangular implícito
  // por la barra horizontal compartida que cruza las tres As.
  // ViewBox 100x100. Las 3 As se posicionan en x = 28, 50, 72.
  // Altura de la A: y0 (top) → y1 (base).
  const y0 = 26, y1 = 76;
  const barY = 60; // barra horizontal compartida
  const halfBase = 16; // medio ancho de la base de cada A
  // Stroke fino para que el conjunto respire.
  const sw = 5.5;

  const aLines = (cx) => `
    <!-- A en cx · diagonal izquierda y derecha -->
    <line x1="${cx - halfBase}" y1="${y1}" x2="${cx}" y2="${y0}" stroke="${c}" stroke-width="${sw}" stroke-linecap="square"/>
    <line x1="${cx + halfBase}" y1="${y1}" x2="${cx}" y2="${y0}" stroke="${c}" stroke-width="${sw}" stroke-linecap="square"/>`;

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Doble círculo exterior -->
    <circle cx="50" cy="50" r="46" fill="none" stroke="${c}" stroke-width="3.6"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="${c}" stroke-width="1.2"/>
    <!-- Tres As -->
    ${aLines(28)}
    ${aLines(50)}
    ${aLines(72)}
    <!-- Barra horizontal compartida que atraviesa las 3 As -->
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
