// ============================================================
// lib/custodia-holded.cjs — la custodia de cada obra sale de Holded (cuenta 5610, ya
// conciliada: /api/ara-os/custodias), la misma fuente que el cash flow y Planificación.
// (Alberto, 04/10/2026: la ficha de Ciudad de Chiva 7 decía «en custodia 7.343,28 €» con
// el registro propio de financiaciones_sabadell, y Holded dice entregado a EMASESA.)
//
// Las cuentas 5610 se llaman como la comunidad en Holded («Paz 29», «Ciudad de Carcagente 2»)
// y no siempre traen ccpp_id: se emparejan por ccpp_id y, si no, por el nombre normalizado
// (igual, o uno dentro del otro con el mismo número de portal).
// ============================================================
"use strict";

const normNombre = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\b(ccpp|cp|c\/|calle|avda?|avenida|plaza|pza|la|el|los|las|de|del)\b\.?/g, " ").replace(/[^a-z0-9]/g, "");
const numero = (n) => (n.match(/\d+[a-z]?$/) || [""])[0];

// comunidades = /api/ara-os/custodias .comunidades (o cashflow.custodias_obras)
function indexarCustodias(comunidades) {
  const lista = (comunidades || []).filter(Boolean).map((c) => ({ c, n: normNombre(c.comunidad) }));
  return {
    lista,
    porId: new Map(lista.filter((x) => x.c.ccpp_id).map((x) => [x.c.ccpp_id, x.c])),
  };
}

// La cuenta 5610 de una obra ({ ccpp_id, comunidad, direccion }) o null
function custodiaDe(idx, obra) {
  if (!idx || !obra) return null;
  if (obra.ccpp_id && idx.porId.has(obra.ccpp_id)) return idx.porId.get(obra.ccpp_id);
  for (const nombre of [obra.comunidad, obra.direccion]) {
    const n = normNombre(nombre);
    if (!n) continue;
    const igual = idx.lista.find((x) => x.n === n);
    if (igual) return igual.c;
    const num = numero(n);
    const parecida = num && idx.lista.find((x) => x.n && numero(x.n) === num && (x.n.includes(n) || n.includes(x.n)));
    if (parecida) return parecida.c;
  }
  return null;
}

// Obra de cada cuenta 5610 sin ccpp_id (las que Holded descubre solas no lo traen): por el nombre
// de la comunidad en la hoja de comunidades (solo lectura), sin tildes ni mayúsculas, con las mismas
// reglas que custodiaDe. «Rafael Laffon 7» (56100026) = «Rafael Laffón 7». Solo si hay UNA obra
// que encaja; si no, se queda sin obra. filas: comunidades!A2:B (A = comunidad, B = dirección).
// ccppId: el de lib/orden-cartera (ccpp_<slug>_<md5> de la dirección o, si no hay, el nombre).
function asignarObras(custodias, filas, ccppId) {
  const obras = (filas || []).map((r) => ({ nombre: String(r?.[0] || "").trim(), dir: String(r?.[1] || "").trim() }))
    .filter((o) => o.nombre || o.dir).map((o) => ({ id: ccppId(o.dir || o.nombre), ns: [normNombre(o.nombre), normNombre(o.dir)].filter(Boolean) }));
  const encaja = (n, m) => n === m || (!!numero(n) && numero(n) === numero(m) && (n.includes(m) || m.includes(n)));
  return (custodias || []).map((c) => {
    if (!c || c.ccpp_id) return c;
    const n = normNombre(c.comunidad);
    if (!n) return c;
    const iguales = [...new Set(obras.filter((o) => o.ns.includes(n)).map((o) => o.id))];
    const parecidas = iguales.length ? iguales : [...new Set(obras.filter((o) => o.ns.some((m) => encaja(n, m))).map((o) => o.id))];
    return parecidas.length === 1 ? { ...c, ccpp_id: parecidas[0], ccpp_id_por_nombre: true } : c;
  });
}

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
// Lo que enseñan las pantallas: en custodia (pendiente de entregar a EMASESA) y entregado
function estadoCustodia(c) {
  if (!c) return null;
  const en = r2(c.en_custodia), entregado = r2(c.entregado_emasesa), cobrado = r2(c.cobrado);
  return { cuenta: c.cuenta || null, comunidad_holded: c.comunidad, cobrado, entregado, en_custodia: en,
    estado: en > 0.01 ? "en_custodia" : entregado > 0.01 ? "entregado" : "sin_movimientos" };
}

module.exports = { asignarObras, normNombre, indexarCustodias, custodiaDe, estadoCustodia };
