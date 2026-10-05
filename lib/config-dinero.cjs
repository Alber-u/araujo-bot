// ============================================================
// lib/config-dinero.cjs — una sola lectura de la hoja config_dinero (clave | valor | nota) · 08/10/2026
// ============================================================
// Antes cada módulo la leía a su manera: el dinero se quedaba con la ÚLTIMA fila de cada clave y
// presupuestos / certificaciones con la PRIMERA, por el nombre de la cabecera de la fila 1. Con una clave
// repetida (una fila vacía más arriba) o una cabecera distinta, «coste_hora_eur» salía «Falta» en
// presupuestos aunque estuviera en la hoja (A21 · B21 30).
// Ahora: toda la hoja (config_dinero!A:C), por posición (A clave, B valor, C nota), clave sin espacios ni
// caracteres invisibles, y de una clave repetida manda la última fila con valor.
// ============================================================
"use strict";

const RANGO = "config_dinero!A:C";

// «Coste_Hora_EUR », «coste hora eur», con espacio duro o de ancho cero → «coste_hora_eur»
const normClave = (k) => String(k ?? "").normalize("NFKC").replace(/[​-‍⁠﻿]/g, "").replace(/ /g, " ").trim().toLowerCase().replace(/\s+/g, "_");

// filas de la hoja (valores de values.get) → [{ clave, valor, nota, fila }] (fila = número de fila en la hoja)
function filasDeValores(values) {
  const out = [];
  (values || []).forEach((r, i) => {
    const clave = normClave(r?.[0]);
    if (!clave || (i === 0 && clave === "clave")) return;   // cabecera
    out.push({ clave, valor: r[1] ?? "", nota: r[2] ?? "", fila: i + 1 });
  });
  return out;
}

async function leerConfigDinero(sheets) {
  const s = sheets || require("./sheets-tabla.cjs").getSheetsClient();
  const r = await s.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: RANGO, valueRenderOption: "UNFORMATTED_VALUE" });
  const values = r.data.values || [];
  return { filas: filasDeValores(values), filas_hoja: values.length };
}

// el valor de una clave: la última fila con valor (si ninguna lo tiene, la última)
function valorConfig(filas, clave) {
  const k = normClave(clave);
  const xs = (filas || []).filter((f) => f.clave === k);
  const conValor = xs.filter((f) => String(f.valor ?? "").trim() !== "");
  return (conValor.length ? conValor[conValor.length - 1] : xs[xs.length - 1]) || null;
}
// el número de una clave aunque lleve unidades o espacios («30», «30 €», «30,00 €/h»); > 0 o null
function numConfig(filas, clave) {
  const f = valorConfig(filas, clave);
  if (!f) return null;
  if (typeof f.valor === "number") return f.valor > 0 ? f.valor : null;
  const m = String(f.valor ?? "").replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  const n = m ? Number(m[0].replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
// por qué no sale una clave (para el aviso): filas leídas y las filas con esa clave o una parecida
function diagnosticoClave(filas, filasHoja, clave) {
  const k = normClave(clave);
  const raiz = k.split("_")[0];
  return {
    rango: RANGO, filas_leidas: filasHoja,
    filas_con_la_clave: (filas || []).filter((f) => f.clave === k).map((f) => ({ fila: f.fila, valor: f.valor })),
    parecidas: (filas || []).filter((f) => f.clave !== k && raiz && f.clave.includes(raiz)).map((f) => ({ fila: f.fila, clave: f.clave, valor: f.valor })),
  };
}

module.exports = { RANGO, normClave, filasDeValores, leerConfigDinero, valorConfig, numConfig, diagnosticoClave };
