// 15/10/2026 · A qué obra va un registro de tiempo.
//
// Las órdenes de «Otras órdenes» (obras_otras) se fichan con su id («OO-2026-150»), no con el nombre: un nombre
// libre («Urbano Orad 13-15», «Jorge Montemayor 34 TUBERIAS») se queda huérfano en cuanto la orden cambia de
// nombre, se fusiona o no casa letra a letra, y entonces su ficha económica da coste 0 y el Resultado real del
// mes no la cuenta. Las obras de Plan 5 siguen con el nombre de la comunidad: es la clave de ordenes_trabajo
// (columna A) y de comunidades (columna A).
//
// Funciones puras (sin hoja): quien llama les pasa las filas de obras_otras tal cual (A = obra_id, B = nombre,
// H = fase, T = borrado).

// «CCPP Urbano Orad 13-15», «Urbano Orad 13-15» y «urbano  orad 13‑15» son la misma clave
function normClave(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().replace(/^(ccpp|cpp|cp)\b\.?\s*/, "").replace(/[^a-z0-9]/g, "");
}

const esVerdad = (v) => String(v || "").trim().toUpperCase() === "TRUE";

// filas de obras_otras (desde la fila 2) → { porId, porClave }
//   porId: id → { obra_id, nombre, fase, borrado }
//   porClave: clave del nombre → id (sólo órdenes no borradas)
function indiceObrasOtras(filas) {
  const porId = new Map(), porClave = new Map();
  for (const f of filas || []) {
    const obra_id = String(f[0] || "").trim();
    if (!obra_id) continue;
    const o = { obra_id, nombre: String(f[1] || "").trim(), fase: String(f[7] || "").trim(), borrado: esVerdad(f[19]) };
    porId.set(obra_id, o);
    if (o.borrado || !o.nombre) continue;
    const k = normClave(o.nombre);
    if (k && !porClave.has(k)) porClave.set(k, obra_id);
  }
  return { porId, porClave };
}

// Id de la orden de Otras órdenes a la que apunta `valor` (su id o su nombre), o null. Las borradas no cuentan.
function resolverOO(valor, idx) {
  const v = String(valor || "").trim();
  if (!v || !idx) return null;
  const o = idx.porId.get(v);
  if (o) return o.borrado ? null : o.obra_id;
  return idx.porClave.get(normClave(v)) || null;
}

// Diagnóstico de registros: cada obra_id con lo que es
//   ok           → id de una orden viva o comunidad de Plan 5
//   por_nombre   → nombre de una orden de Otras órdenes (debería ser su id: `sugerido`)
//   orden_borrada→ id de una orden con borrado = TRUE
//   huerfano     → no casa con nada
// registros: [{ registro_id, fecha, obra_id, horas, tipo, borrado }]; plan5: nombres de comunidades / OT
function clasificarRegistros(registros, idx, plan5) {
  const nombresP5 = new Set([...(plan5 || [])].map((s) => String(s || "").trim()).filter(Boolean));
  const grupos = new Map();
  for (const r of registros || []) {
    if (esVerdad(r.borrado)) continue;
    if (r.tipo && r.tipo !== "trabajo" && r.tipo !== "extra") continue;
    const id = String(r.obra_id || "").trim();
    if (!id) continue;
    let g = grupos.get(id);
    if (!g) {
      const oo = idx?.porId.get(id);
      let estado = "ok", sugerido = null, nombre = null;
      if (oo) { nombre = oo.nombre; if (oo.borrado) estado = "orden_borrada"; }
      else if (!nombresP5.has(id)) {
        sugerido = resolverOO(id, idx);
        estado = sugerido ? "por_nombre" : "huerfano";
        if (sugerido) nombre = idx.porId.get(sugerido)?.nombre || null;
      }
      g = { obra_id: id, estado, sugerido, nombre, registros: 0, horas: 0, desde: null, hasta: null, ids: [] };
      grupos.set(id, g);
    }
    g.registros += 1;
    g.horas = Math.round((g.horas + (parseFloat(r.horas) || 0)) * 100) / 100;
    const f = String(r.fecha || "").slice(0, 10);
    if (f && (!g.desde || f < g.desde)) g.desde = f;
    if (f && (!g.hasta || f > g.hasta)) g.hasta = f;
    if (g.ids.length < 50) g.ids.push(r.registro_id);
  }
  return [...grupos.values()].sort((a, b) => b.horas - a.horas);
}

module.exports = { normClave, indiceObrasOtras, resolverOO, clasificarRegistros };
