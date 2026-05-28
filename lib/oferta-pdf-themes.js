/**
 * oferta-pdf-themes · v2.0.0 — Themes 100% HTML/CSS/SVG
 * --------------------------------------------------------------
 * Cada theme aporta SOLO:
 *   · colorSecundario (acento corporativo)
 *   · blueprintSvg    (composición lateral en SVG inline)
 *   · label           (nombre legible para UI)
 *
 * El resto (tipografía, márgenes, tabla, footer, bloque aceptación,
 * estructura editorial) es INVARIANTE — se define en
 * lib/oferta-pdf-template.js.
 *
 * Para añadir un theme nuevo:
 *   1. Añadir entrada en THEMES con su SVG blueprint.
 *   2. Añadir aliases del campo obra.tipo en TYPE_TO_THEME.
 * --------------------------------------------------------------
 */

// Helpers para generar los SVG blueprint comunes (líneas técnicas)
const COMUNES = {
  marco: (extra = "") => `
    <rect x="22" y="22" width="232" height="376" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/>
    <path d="M22 398H254" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
    ${extra}`,
};

const BLUEPRINT_BAJANTES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    ${Array.from({length:7},(_,r)=>Array.from({length:3},(_,c)=>
      `<rect x="${50+c*60}" y="${52+r*48}" width="32" height="34" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.4"/>`
    ).join("")).join("")}
    <path d="M226 30V395" stroke="rgba(255,255,255,.95)" stroke-width="6" stroke-linecap="round"/>
    ${[88,160,232,308].map(y=>`<path d="M210 ${y}H242" stroke="rgba(255,255,255,.95)" stroke-width="4" stroke-linecap="round"/>`).join("")}
  `)}
</svg>`;

const BLUEPRINT_CONTADORES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    ${Array.from({length:5},(_,r)=>Array.from({length:4},(_,c)=>{
      const x=40+c*50, y=60+r*64;
      return `<rect x="${x}" y="${y}" width="44" height="56" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.3"/>
              <circle cx="${x+22}" cy="${y+24}" r="10" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.3"/>
              <rect x="${x+8}" y="${y+40}" width="28" height="8" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`;
    }).join("")).join("")}
  `)}
</svg>`;

const BLUEPRINT_GRUPO_PRESION = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    <rect x="100" y="60" width="80" height="120" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.4"/>
    <line x1="100" y1="90"  x2="180" y2="90"  stroke="rgba(255,255,255,.5)" stroke-width="1"/>
    <line x1="100" y1="120" x2="180" y2="120" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
    <line x1="100" y1="150" x2="180" y2="150" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
    <circle cx="140" cy="220" r="22" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
    <circle cx="140" cy="220" r="8"  fill="none" stroke="rgba(255,255,255,.7)"  stroke-width="1.4"/>
    <circle cx="60"  cy="290" r="18" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.8"/>
    <circle cx="220" cy="290" r="18" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.8"/>
    <path d="M62 290H218" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
    <path d="M140 180V198" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
    <path d="M60 308V340H220V308" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>
  `)}
</svg>`;

const BLUEPRINT_CUBIERTAS = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    <path d="M40 220 L140 80 L240 220" stroke="rgba(255,255,255,.95)" stroke-width="2.2"/>
    <path d="M55 220 L140 102 L225 220" stroke="rgba(255,255,255,.4)" stroke-width="1"/>
    <path d="M40 220 H240 V320 H40 Z" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/>
    <rect x="60" y="240" width="40" height="60" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>
    <rect x="180" y="240" width="40" height="60" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>
    <line x1="40" y1="220" x2="240" y2="220" stroke="rgba(255,255,255,.5)" stroke-dasharray="3,3"/>
    <path d="M232 100V220" stroke="rgba(255,255,255,.85)" stroke-width="3"/>
    <path d="M232 240V340H220" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
  `)}
</svg>`;

const BLUEPRINT_REPARACIONES = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    <path d="M50 200H230" stroke="rgba(255,255,255,.85)" stroke-width="6" stroke-linecap="round"/>
    <circle cx="140" cy="200" r="14" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.6"/>
    <circle cx="140" cy="200" r="22" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
    <path d="M126 186 L154 214" stroke="rgba(255,255,255,.4)" stroke-width="1"/>
    <path d="M154 186 L126 214" stroke="rgba(255,255,255,.4)" stroke-width="1"/>
    <path d="M70 280 L100 250 L130 280" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>
    <path d="M150 280 L180 250 L210 280" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>
    <path d="M50 130H230" stroke="rgba(255,255,255,.4)" stroke-width="1" stroke-dasharray="4,3"/>
    <path d="M50 320H230" stroke="rgba(255,255,255,.4)" stroke-width="1" stroke-dasharray="4,3"/>
  `)}
</svg>`;

const BLUEPRINT_REHABILITACION = `<svg viewBox="0 0 280 420" xmlns="http://www.w3.org/2000/svg" fill="none">
  ${COMUNES.marco(`
    ${Array.from({length:5},(_,r)=>Array.from({length:4},(_,c)=>
      `<rect x="${50+c*48}" y="${60+r*60}" width="32" height="36" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.3"/>`
    ).join("")).join("")}
    ${Array.from({length:6},(_,r)=>
      `<path d="M30 ${60+r*60}H250" stroke="rgba(255,255,255,.35)" stroke-width=".8" stroke-dasharray="2,2"/>`
    ).join("")}
    <path d="M30 50V370" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>
    <path d="M250 50V370" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>
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
  "obra":"rehabilitacion", "obras":"rehabilitacion", "instalaciones":"rehabilitacion",
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
