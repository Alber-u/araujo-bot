/**
 * oferta-pdf-themes · v2.1.0 — Refinamiento editorial premium
 * --------------------------------------------------------------
 * Cada theme aporta SOLO:
 *   · colorSecundario (acento corporativo)
 *   · blueprintSvg    (composición lateral en SVG inline · más
 *                      detalle técnico ingenieril, monocromo)
 *   · label           (nombre legible para UI y PDF)
 *
 * El resto (tipografía, márgenes, tabla, footer, bloque aceptación,
 * estructura editorial) es INVARIANTE — vive en
 * lib/oferta-pdf-template.js.
 * --------------------------------------------------------------
 */

// Stroke styles compartidos. Tres pesos para crear profundidad
// técnica (estructura · elementos · cotas/auxiliares).
const stk = {
  est: 'stroke="rgba(255,255,255,.82)" stroke-width="1.6"',       // estructura principal
  el:  'stroke="rgba(255,255,255,.6)" stroke-width="1.2"',         // elementos secundarios
  aux: 'stroke="rgba(255,255,255,.35)" stroke-width=".7"',         // cotas y líneas auxiliares
  dim: 'stroke="rgba(255,255,255,.42)" stroke-width=".7" stroke-dasharray="2 2"', // cota a trazos
  pipe:'stroke="rgba(255,255,255,.96)" stroke-width="3.4" stroke-linecap="round"',// tubería principal
};

// Etiqueta de cota: línea corta + texto pequeño.
// v3.12 · función conservada por si se reutiliza en un blueprint
// específico, pero se ha retirado de los blueprints estándar.
function cota(x1, y1, x2, y2, label) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${stk.dim}/>
          <text x="${mx + 4}" y="${my + 3}" fill="rgba(255,255,255,.5)" font-family="Inter,Arial,sans-serif" font-size="6" font-weight="600" letter-spacing=".5">${label}</text>`;
}

// v3.12 · marco técnico simplificado: solo el rectángulo y el
// suelo. Eliminadas las cotas perimetrales y la altura hardcoded
// 'H = 26,80 m' que aparecía sobre cualquier presupuesto.
const marcoTec = (extra = '') => `
  <!-- marco fachada -->
  <rect x="22" y="22" width="232" height="376" fill="none" ${stk.est}/>
  <!-- suelo -->
  <path d="M22 398H254" ${stk.aux}/>
  ${extra}`;

// ── BAJANTES ─────────────────────────────────────────────────────
// Fachada con ventanas + bajante con derivaciones por planta.
const BLUEPRINT_BAJANTES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    ${Array.from({length:7},(_,r)=>Array.from({length:3},(_,c)=>
      `<rect x="${48+c*58}" y="${52+r*48}" width="34" height="34" fill="none" ${stk.el}/>`
    ).join('')).join('')}
    <!-- líneas de planta horizontales muy finas -->
    ${[44,92,140,188,236,284,332,380].map(y=>`<path d="M22 ${y}H254" ${stk.aux}/>`).join('')}
    <!-- bajante principal vertical -->
    <path d="M228 28V392" ${stk.pipe}/>
    <!-- derivaciones por planta -->
    ${[64,112,160,208,256,304,352].map(y=>`<path d="M214 ${y}H242" ${stk.el}/>`).join('')}
    <!-- empalmes T -->
    ${[64,112,160,208,256,304,352].map(y=>`<circle cx="228" cy="${y}" r="2.4" fill="rgba(255,255,255,.95)"/>`).join('')}
  `)}
</svg>`;

// ── CONTADORES ───────────────────────────────────────────────────
// Armario de contadores · cuadrícula con esferas y registro.
const BLUEPRINT_CONTADORES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    <!-- collector horizontal arriba -->
    <path d="M44 50H236" ${stk.pipe}/>
    <path d="M44 50V44M236 50V44" ${stk.aux}/>
    <!-- 20 contadores en cuadrícula -->
    ${Array.from({length:5},(_,r)=>Array.from({length:4},(_,c)=>{
      const x=42+c*52, y=72+r*62;
      return `<rect x="${x}" y="${y}" width="46" height="50" fill="none" ${stk.el}/>
              <circle cx="${x+23}" cy="${y+22}" r="11" fill="none" ${stk.est}/>
              <line x1="${x+23}" y1="${y+12}" x2="${x+23}" y2="${y+16}" ${stk.aux}/>
              <line x1="${x+33}" y1="${y+22}" x2="${x+29}" y2="${y+22}" ${stk.aux}/>
              <rect x="${x+10}" y="${y+38}" width="26" height="6" fill="none" ${stk.el}/>
              <!-- bajante derivación -->
              <line x1="${x+23}" y1="${y+50}" x2="${x+23}" y2="${y+58}" ${stk.aux}/>`;
    }).join('')).join('')}
    <!-- collector retorno abajo -->
    <path d="M44 388H236" ${stk.pipe}/>
  `)}
</svg>`;

// ── GRUPO PRESIÓN ────────────────────────────────────────────────
// Esquema P&ID: depósito + bomba + dos circuitos + colectores.
const BLUEPRINT_GRUPO_PRESION = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    <!-- depósito acumulador -->
    <rect x="98" y="58" width="84" height="124" fill="none" ${stk.est}/>
    <path d="M98 86H182M98 112H182M98 138H182M98 164H182" ${stk.aux}/>
    <!-- nivel y manómetro arriba -->
    <circle cx="115" cy="48" r="6" fill="none" ${stk.el}/>
    <line x1="115" y1="42" x2="115" y2="36" ${stk.aux}/>
    <!-- válvulas y conexión a bomba -->
    <path d="M140 182V202" ${stk.pipe}/>
    <path d="M134 196L146 196L140 188Z" fill="rgba(255,255,255,.6)"/>
    <!-- bomba central -->
    <circle cx="140" cy="222" r="20" fill="none" ${stk.est}/>
    <circle cx="140" cy="222" r="6"  fill="none" ${stk.el}/>
    <path d="M124 206L156 238M156 206L124 238" ${stk.aux}/>
    <!-- impulsión a colector -->
    <path d="M140 242V268" ${stk.pipe}/>
    <path d="M52 268H228" ${stk.pipe}/>
    <!-- dos circuitos derivados -->
    <circle cx="60"  cy="298" r="14" fill="none" ${stk.est}/>
    <circle cx="220" cy="298" r="14" fill="none" ${stk.est}/>
    <path d="M60 268V284M220 268V284" ${stk.el}/>
    <path d="M60 312V340M220 312V340" ${stk.el}/>
    <!-- válvulas finales -->
    <rect x="54" y="340" width="12" height="10" fill="none" ${stk.el}/>
    <rect x="214" y="340" width="12" height="10" fill="none" ${stk.el}/>
  `)}
</svg>`;

// ── CUBIERTAS ────────────────────────────────────────────────────
// Sección transversal: cubierta a dos aguas + capas + bajante.
const BLUEPRINT_CUBIERTAS = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    <!-- silueta de cubierta a dos aguas -->
    <path d="M40 220 L140 76 L240 220" ${stk.est}/>
    <!-- capa segunda -->
    <path d="M50 220 L140 92 L230 220" ${stk.el}/>
    <!-- tercera (impermeable) -->
    <path d="M60 220 L140 108 L220 220" ${stk.aux}/>
    <!-- volumen edificio -->
    <path d="M40 220 H240 V328 H40 Z" ${stk.est}/>
    <!-- vigas / forjado -->
    <path d="M40 244 H240" ${stk.aux}/>
    <path d="M40 280 H240" ${stk.aux}/>
    <!-- ventanas -->
    <rect x="60" y="248" width="38" height="58" fill="none" ${stk.el}/>
    <rect x="182" y="248" width="38" height="58" fill="none" ${stk.el}/>
    <rect x="121" y="248" width="38" height="58" fill="none" ${stk.el}/>
    <!-- bajante exterior con codos -->
    <path d="M230 96 V220" ${stk.pipe}/>
    <path d="M230 220 H242 V328 H218" ${stk.el}/>
    <!-- cumbrera -->
    <circle cx="140" cy="76" r="3" fill="rgba(255,255,255,.95)"/>
  `)}
</svg>`;

// ── REPARACIONES ─────────────────────────────────────────────────
// Diagrama de unión: tubería + accesorios + zona de intervención.
const BLUEPRINT_REPARACIONES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    <!-- tubería principal horizontal -->
    <path d="M44 196H236" ${stk.pipe}/>
    <!-- T central (avería) -->
    <path d="M140 196V230" ${stk.pipe}/>
    <circle cx="140" cy="196" r="6" fill="none" ${stk.est}/>
    <!-- accesorios laterales (codos) -->
    <path d="M60 196 V160 H100" ${stk.el}/>
    <path d="M220 196 V160 H180" ${stk.el}/>
    <!-- válvulas -->
    <rect x="78" y="187" width="16" height="18" fill="none" ${stk.est}/>
    <rect x="186" y="187" width="16" height="18" fill="none" ${stk.est}/>
    <!-- bridas -->
    <line x1="78" y1="183" x2="78" y2="209" ${stk.aux}/>
    <line x1="94" y1="183" x2="94" y2="209" ${stk.aux}/>
    <line x1="186" y1="183" x2="186" y2="209" ${stk.aux}/>
    <line x1="202" y1="183" x2="202" y2="209" ${stk.aux}/>
    <!-- zona intervención (recuadro punteado) -->
    <rect x="118" y="180" width="44" height="34" fill="none" ${stk.dim}/>
    <!-- detalle ampliado abajo -->
    <path d="M44 296H236" ${stk.el}/>
    <path d="M140 260V332" ${stk.aux}/>
    <rect x="44" y="350" width="192" height="42" fill="none" ${stk.aux}/>
  `)}
</svg>`;

// ── REHABILITACIÓN ───────────────────────────────────────────────
// Fachada con malla de andamio + huecos cota + capas.
const BLUEPRINT_REHABILITACION = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${marcoTec(`
    <!-- huecos fachada -->
    ${Array.from({length:6},(_,r)=>Array.from({length:4},(_,c)=>
      `<rect x="${50+c*46}" y="${56+r*52}" width="32" height="36" fill="none" ${stk.el}/>`
    ).join('')).join('')}
    <!-- líneas plantas -->
    ${Array.from({length:7},(_,r)=>
      `<path d="M22 ${48+r*52}H254" ${stk.aux}/>`
    ).join('')}
    <!-- estructura andamio vertical -->
    <path d="M30 48V370M250 48V370" ${stk.est}/>
    <path d="M138 48V370" ${stk.aux}/>
    <!-- diagonales de arriostramiento -->
    ${Array.from({length:6},(_,r)=>{
      const y1 = 48+r*52, y2 = 48+(r+1)*52;
      return `<path d="M30 ${y1} L138 ${y2}" ${stk.aux}/>
              <path d="M138 ${y1} L250 ${y2}" ${stk.aux}/>`;
    }).join('')}
    <!-- cornisa decorativa arriba -->
    <path d="M22 50H254" ${stk.est}/>
    <path d="M22 53H254" ${stk.aux}/>
    <!-- zócalo abajo -->
    <path d="M22 380H254" ${stk.est}/>
  `)}
</svg>`;

const THEMES = {
  bajantes: {
    id: "bajantes", slug: "bajantes", label: "Bajantes",
    colorSecundario: "#0d4d8a",
    blueprintSvg: BLUEPRINT_BAJANTES,
  },
  contadores: {
    id: "contadores", slug: "contadores", label: "Contadores",
    colorSecundario: "#1357A2",
    blueprintSvg: BLUEPRINT_CONTADORES,
  },
  grupoPresion: {
    id: "grupoPresion", slug: "grupo-presion", label: "Grupos de presión",
    colorSecundario: "#0B5C94",
    blueprintSvg: BLUEPRINT_GRUPO_PRESION,
  },
  cubiertas: {
    id: "cubiertas", slug: "cubiertas", label: "Cubiertas",
    colorSecundario: "#054B87",
    blueprintSvg: BLUEPRINT_CUBIERTAS,
  },
  reparaciones: {
    id: "reparaciones", slug: "reparaciones", label: "Reparaciones",
    colorSecundario: "#123E6B",
    blueprintSvg: BLUEPRINT_REPARACIONES,
  },
  rehabilitacion: {
    id: "rehabilitacion", slug: "rehabilitacion", label: "Rehabilitación",
    colorSecundario: "#06182E",
    blueprintSvg: BLUEPRINT_REHABILITACION,
  },
};

const TYPE_TO_THEME = {
  "bajantes":"bajantes", "bajante":"bajantes", "saneamiento":"bajantes",
  "contadores":"contadores", "contador":"contadores", "bateria de contadores":"contadores",
  "grupo de presion":"grupoPresion", "grupos de presion":"grupoPresion",
  "grupo presion":"grupoPresion", "presion":"grupoPresion", "bombeo":"grupoPresion",
  "cubiertas":"cubiertas", "cubierta":"cubiertas", "impermeabilizacion":"cubiertas", "tejado":"cubiertas",
  "reparaciones":"reparaciones", "reparacion":"reparaciones",
  "averias":"reparaciones", "averia":"reparaciones",
  "fontaneria":"reparaciones", "fontaneria general":"reparaciones",
  "rehabilitacion":"rehabilitacion", "rehabilitaciones":"rehabilitacion",
  "obra":"rehabilitacion", "obras":"rehabilitacion",
  // v3.11 · cobertura completa de los 5 tipos visibles en el editor:
  // bajantes / instalaciones / averias / mantenimientos / otros.
  // Cada uno apunta a un blueprint diferente para que el cambio de
  // tipo en el editor se refleje visualmente en el PDF.
  "instalaciones":"contadores",          // instalación nueva → armario contadores
  "instalacion":"contadores",
  "mantenimientos":"grupoPresion",       // mantenimiento → esquema técnico P&ID
  "mantenimiento":"grupoPresion",
  "otros":"rehabilitacion",              // genérico → fachada con andamio
};

function normalizarTipo(tipo) {
  return String(tipo || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().replace(/\s+/g, " ");
}

function getTheme(tipoTrabajo) {
  const id = TYPE_TO_THEME[normalizarTipo(tipoTrabajo)] || "bajantes";
  return THEMES[id];
}

function listThemes() {
  return Object.values(THEMES).map(t => ({ id: t.id, label: t.label, colorSecundario: t.colorSecundario }));
}

module.exports = { THEMES, getTheme, listThemes, normalizarTipo };
