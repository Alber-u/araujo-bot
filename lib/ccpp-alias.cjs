// ============================================================
// lib/ccpp-alias.cjs — comunidades duplicadas (Alberto, 03/10/2026)
// ============================================================
// config_dinero «ccpp_alias»: «id_duplicado:id_bueno», varias separadas por
// «;». Ej.: «ccpp_paz_29_479ef1:ccpp_la_paz_29_c896f4» (la custodia de «Paz 29»
// es la de la obra «La Paz 29»). Se aplica al leer las fuentes, antes de
// cualquier cálculo, al emparejar custodias, etiquetas, OT (cobros, T4) y expedientes.
// Nunca por nombre y nunca se toca la hoja de comunidades de Guillermo.
// ============================================================
"use strict";

function leerAlias(txt) {
  const out = {};
  for (const trozo of String(txt || "").split(/[;\n]+/)) {
    const [dup, bueno] = trozo.split(":").map((x) => String(x || "").trim());
    if (dup && bueno && dup !== bueno) out[dup] = bueno;
  }
  // cadenas (a→b, b→c) resueltas hasta el final, sin bucles
  for (const k of Object.keys(out)) { let v = out[k], n = 0; while (out[v] && n++ < 10) v = out[v]; out[k] = v; }
  return out;
}
const resolver = (id, alias) => (id && alias && alias[id]) || id || null;

// Aplica los alias a las fuentes ya leídas (muta y devuelve las fuentes)
function aplicarAlias(fuentes, alias) {
  if (!alias || !Object.keys(alias).length) return fuentes;
  // custodias (cuentas 5610)
  if (fuentes.custodias?.ok) for (const c of fuentes.custodias.data?.comunidades || []) {
    if (alias[c.ccpp_id]) { c.ccpp_id_original = c.ccpp_id; c.ccpp_id = alias[c.ccpp_id]; }
  }
  // etiquetas de Holded por obra: las del duplicado pasan a la buena
  if (fuentes.tags?.ok && fuentes.tags.data) {
    const m = fuentes.tags.data;
    for (const [dup, bueno] of Object.entries(alias)) {
      if (!m[dup]) continue;
      m[bueno] = [...new Set([...(m[bueno] || []), ...m[dup]])];
      delete m[dup];
    }
  }
  // órdenes de trabajo (cobros, T4, comisión)
  if (fuentes.ot?.ok) for (const xs of Object.values(fuentes.ot.data?.grupos || {})) for (const o of xs || []) {
    if (alias[o.ccpp_id]) { o.ccpp_id_original = o.ccpp_id; o.ccpp_id = alias[o.ccpp_id]; }
  }
  // expediente de Guillermo (contratos y pagos de los pisos): la fila del duplicado pasa al bueno
  if (fuentes.expedientes?.ok && fuentes.expedientes.data?.obras) {
    const m = fuentes.expedientes.data.obras;
    for (const [dup, bueno] of Object.entries(alias)) {
      if (!m[dup]) continue;
      if (!m[bueno] || (!(m[bueno].pisos > 0) && !m[bueno].ccpp?.aplica)) m[bueno] = { ...m[dup], ccpp_id: bueno, ccpp_id_original: dup };
      delete m[dup];
    }
  }
  return fuentes;
}

// Custodias cuyo id no está en la cartera (ni con alias): posibles duplicados
function custodiasSinObra(custodias, idsObras, minimo = 0) {
  const ids = new Set(idsObras);
  return (custodias || []).filter((c) => Math.abs(Number(c.en_custodia) || 0) > minimo && c.ccpp_id && !ids.has(c.ccpp_id))
    .map((c) => ({ ccpp_id: c.ccpp_id, comunidad: c.comunidad, en_custodia: Number(c.en_custodia) || 0 }));
}

module.exports = { leerAlias, resolver, aplicarAlias, custodiasSinObra };
