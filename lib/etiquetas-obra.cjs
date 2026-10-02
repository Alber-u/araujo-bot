// ============================================================
// lib/etiquetas-obra.cjs · Etiquetas Holded de una obra (holded_etiquetas)
//
// La rentabilidad por obra, el material por obra y la escalera de Mi panel
// leen la pestaña `holded_etiquetas` (una fila por obra, tags separados
// por "|"). El "+ Crear tag" de la ficha escribía sólo en
// `comunidades_tags_holded`, así que esas compras no sumaban a la obra
// (Malvaloca 1, Ardilla 9, Ciudad de Gandía 5 · 02/10/2026).
//
// Funciones puras: deciden cómo queda la fila al AÑADIR un tag.
// Nunca reemplazan la lista: siempre fusionan (Mandarinas 2 tiene dos
// variantes del mismo tag y no se pueden perder).
//
// Test: node lib/etiquetas-obra.test.cjs
// ============================================================

const ETIQUETAS_HEADERS = [
  "obra_id",
  "etiqueta_holded",
  "nombre_comunidad",
  "tipo_obra",
  "fecha_asignacion",
  "activa",
  "notas",
];

// Tags por obra separados por "|". Tolerante a coma y punto y coma como
// separadores secundarios, espacios extra, etc.
function parseTagsCSV(s) {
  if (!s) return [];
  return String(s)
    .split(/[|,;]/)
    .map(t => t.trim())
    .filter(Boolean);
}

function serializeTagsCSV(arr) {
  return (arr || []).map(t => String(t).trim()).filter(Boolean).join("|");
}

// "02/10/2026" en hora de Madrid
function fechaCorta(fecha = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(fecha);
}

function tipoObraPorId(obra_id) {
  return /^ccpp_/i.test(String(obra_id || "")) ? "plan5" : "otras";
}

// Fila de holded_etiquetas tras añadir `tags` a la obra.
//   fila:   la fila actual (objeto con ETIQUETAS_HEADERS) o null si no hay
//   tags:   string o array de tags a añadir
// Devuelve { accion, fila, etiquetas, añadidas }:
//   accion = "creada" | "añadida" | "reactivada" | "ya_estaba"
// Sin duplicados (case-insensitive) y sin tocar nombre_comunidad,
// tipo_obra ni las notas previas de una fila existente.
function fusionarEtiquetasEnFila(fila, { obra_id, tags, nombre_comunidad = "", tipo_obra = "", hoyISO, hoyCorta, origen = "ficha" }) {
  const nuevos = (Array.isArray(tags) ? tags : [tags]).map(t => String(t || "").trim()).filter(Boolean);
  const previas = fila ? parseTagsCSV(fila.etiqueta_holded) : [];
  const vistos = new Set(previas.map(t => t.toLowerCase()));
  const añadidas = [];
  for (const t of nuevos) {
    if (vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    añadidas.push(t);
  }
  const etiquetas = [...previas, ...añadidas];
  const nota = añadidas.length ? `tag añadido desde ${origen} ${hoyCorta}` : "";

  if (!fila) {
    return {
      accion: "creada",
      añadidas,
      etiquetas,
      fila: {
        obra_id,
        etiqueta_holded: serializeTagsCSV(etiquetas),
        nombre_comunidad: nombre_comunidad || "",
        tipo_obra: tipo_obra || tipoObraPorId(obra_id),
        fecha_asignacion: hoyISO,
        activa: "TRUE",
        notas: nota,
      },
    };
  }

  const activa = String(fila.activa).toUpperCase() === "TRUE";
  if (!añadidas.length && activa) {
    return { accion: "ya_estaba", añadidas, etiquetas, fila };
  }
  const notasPrevias = String(fila.notas || "").trim();
  return {
    accion: añadidas.length ? "añadida" : "reactivada",
    añadidas,
    etiquetas,
    fila: {
      ...fila,
      etiqueta_holded: serializeTagsCSV(etiquetas),
      fecha_asignacion: fila.fecha_asignacion || hoyISO,
      activa: "TRUE",
      notas: nota ? (notasPrevias ? `${notasPrevias} · ${nota}` : nota) : notasPrevias,
    },
  };
}

module.exports = {
  ETIQUETAS_HEADERS,
  parseTagsCSV,
  serializeTagsCSV,
  fechaCorta,
  tipoObraPorId,
  fusionarEtiquetasEnFila,
};
