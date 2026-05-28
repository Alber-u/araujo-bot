// ============================================================
// Checklist físico de obra — patrones de detección.
//
// Define los "items físicos verificables" que deben estar al 100%
// ANTES de poder marcar una visita como CERTIFICACIÓN FINAL. Cada
// item se detecta automáticamente buscando partidas del catálogo
// cuyo nombre coincida con alguno de los patrones (regex).
//
// Para añadir o ajustar items, edita ITEMS abajo. No hace falta
// tocar el código de los endpoints.
//
// Cómo se calcula el estado de un item:
//   - Si NINGUNA partida de la obra matchea el patrón → "na" (no aplica)
//   - Si AL MENOS UNA partida matchea y todas las matcheadas están al
//     100% → "ok"
//   - Si AL MENOS UNA partida matchea pero no todas al 100% → "pendiente"
// ============================================================

const ITEMS = [
  {
    clave: "armario_contadores",
    titulo: "Armario / cuarto de contadores",
    descripcion: "Albañilería del cuarto o armario donde van las baterías de contadores",
    patrones: [
      /cuarto.*contadores/i,
      /\barmario\b/i,
      /\bp\.?\s*hierro\b/i, // "P.HIERRO" como nombre alternativo
    ],
  },
  {
    clave: "bateria_contadores",
    titulo: "Batería de contadores montada",
    descripcion: "Montaje de la batería de contadores en el cuarto",
    patrones: [
      /bater[ií]a.*contadores/i,
      /montaje.*bater[ií]a/i,
    ],
  },
  {
    clave: "contadores_instalados",
    titulo: "Contadores instalados",
    descripcion: "Desmontaje del contador antiguo + conexión del nuevo",
    patrones: [
      /desmontaje.*contador/i,
      /conexi[óo]n.*contador/i,
    ],
  },
  {
    clave: "grupo_presion",
    titulo: "Grupo de presión (si aplica)",
    descripcion: "Montaje del grupo de presión, solo en obras que lo requieran",
    patrones: [
      /grupo\s+(de\s+)?presi[óo]n/i,
    ],
  },
  {
    clave: "engancha_acometidas",
    titulo: "Enganches / acometidas",
    descripcion: "Conexión a la red de los puntos finales de la instalación",
    patrones: [
      /enganche/i,
      /acometida/i,
    ],
  },
];

function normalizarNombre(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ------------------------------------------------------------
// Dado el catálogo de partidas de la obra y un mapa de progreso
// actual (partida_id → progreso_pct), devuelve la lista de items
// del checklist con su estado y las partidas que matchean.
//
// progresoMap: { [partida_id]: number(0-100) }
// ------------------------------------------------------------
function calcularChecklistFisico(partidasObra, progresoMap) {
  const items = [];
  for (const def of ITEMS) {
    const partidasMatch = partidasObra.filter((p) => {
      const nombre = normalizarNombre(p.nombre);
      return def.patrones.some((rx) => rx.test(nombre));
    });
    let status;
    if (partidasMatch.length === 0) {
      status = "na";
    } else {
      const todas100 = partidasMatch.every((p) => (progresoMap[p.partida_id] || 0) >= 100);
      status = todas100 ? "ok" : "pendiente";
    }
    items.push({
      clave: def.clave,
      titulo: def.titulo,
      descripcion: def.descripcion,
      status,
      partidas: partidasMatch.map((p) => ({
        partida_id: p.partida_id,
        nombre: p.nombre,
        progreso_pct: progresoMap[p.partida_id] || 0,
      })),
    });
  }
  return items;
}

// ------------------------------------------------------------
// ¿El checklist permite cerrar la obra como FINALIZADA?
// Sí si: todos los items aplicables (status != "na") están en "ok".
// ------------------------------------------------------------
function checklistPermiteFinalizar(items) {
  for (const it of items) {
    if (it.status === "na") continue;
    if (it.status !== "ok") return false;
  }
  return true;
}

module.exports = {
  ITEMS,
  calcularChecklistFisico,
  checklistPermiteFinalizar,
};
