// ============================================================
// lib/presupuesto-provisional.cjs — excepción temporal (Alberto, 03/10/2026)
// ============================================================
// config_dinero «presupuesto_provisional»: «obra_id:importe» (sin IVA, punto
// decimal), varias separadas por «;». Opcional, «obra_id:importe:referencia»
// (p. ej. «O25-ARA-00077 Rev-15») para el aviso.
// Si el pto_total del panel de Guillermo viene vacío o a 0, se usa este
// importe (simulador, cash flow y rentabilidad); si el panel ya trae importe,
// manda el panel y se avisa de que sobra la línea. Nunca se escribe en el panel.
// ============================================================
"use strict";

function leerProvisionales(txt) {
  const out = {};
  for (const trozo of String(txt || "").split(/[;\n]+/)) {
    const [id, imp, ...ref] = trozo.split(":").map((x) => x.trim());
    const n = Number(String(imp || "").replace(/\s/g, ""));
    if (id && Number.isFinite(n) && n > 0) out[id] = { importe: Math.round(n * 100) / 100, ref: ref.join(":").trim() || null };
  }
  return out;
}

// importe del panel + provisionales → { importe, provisional, ref, sobra }
function importeConProvisional(obra_id, importePanel, mapa) {
  const p = mapa?.[obra_id];
  const panel = Number(importePanel) || 0;
  if (panel > 0) return { importe: panel, provisional: false, ref: null, sobra: !!p };
  if (p) return { importe: p.importe, provisional: true, ref: p.ref, sobra: false };
  return { importe: panel, provisional: false, ref: null, sobra: false };
}

module.exports = { leerProvisionales, importeConProvisional };
