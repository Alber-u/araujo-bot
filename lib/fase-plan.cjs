// ============================================================
// lib/fase-plan.cjs — fase de una obra según Planificación (app.locals.planObras)
// ============================================================
// UNA fuente para «en obra / terminada / programada»: OT (Órdenes de trabajo) y José Manuel
// (/jm) usan esto mismo. Hasta la 13 manda Planificación; de la 14 en adelante (factura,
// inspector, contadores, cobro) manda la hoja de OT. (Alberto, 04/10/2026)
// ============================================================
"use strict";

const yLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] || "");
const dmP = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const textoPlan = (p) => (p.estado_plan === "en_obra" ? `En obra desde el ${dmP(p.inicio)}${p.operarios?.length ? ` · ${yLista(p.operarios)}` : ""} · fin previsto ${dmP(p.fin)}`
  : `Empieza el ${dmP(p.inicio)}${p.operarios?.length ? ` · ${yLista(p.operarios)}` : ""}`);

// plan = app.locals.planObras() (o null). Devuelve una función (faseHoja, obra_id) → { fase, de, texto }
function faseSegunPlan(plan) {
  const planDe = new Map((plan?.obras || []).map((o) => [o.obra_id, o]));
  const terminadasPlan = new Map((plan?.terminadas || []).map((t) => [t.obra_id, t]));
  const f = (faseHoja, id) => {
    faseHoja = String(faseHoja || "");
    if (!plan || (Number(faseHoja.slice(0, 2)) || 0) >= 14) return { fase: faseHoja, de: "ot" };
    const t = terminadasPlan.get(id);
    if (t) return { fase: "14_FINALIZADA", de: "planificacion", texto: `Terminada el ${dmP(t.fin)} según Planificación` };
    const p = planDe.get(id);
    if (p?.estado_plan === "en_obra") return { fase: "13_EN_EJECUCION", de: "planificacion", texto: textoPlan(p) };
    if (p?.estado_plan === "planificada") return { fase: "12_PROGRAMADA", de: "planificacion", texto: textoPlan(p) };
    // la hoja dice en ejecución pero Planificación no la da por empezada: se queda programada/inicio
    if (faseHoja === "13_EN_EJECUCION" && p) return { fase: p.operarios_de === "programada" ? "12_PROGRAMADA" : "12_INICIO_OBRA", de: "planificacion", texto: textoPlan(p) };
    return { fase: faseHoja, de: "ot", texto: p ? textoPlan(p) : "" };
  };
  f.planDe = planDe;
  f.terminadasPlan = terminadasPlan;
  return f;
}

// empezada o terminada (fase 12 en obra, 13 o más): ya no se enseña «Lista / No lista»
const yaEmpezada = (fase) => (Number(String(fase || "").slice(0, 2)) || 0) >= 13;

module.exports = { faseSegunPlan, textoPlan, yaEmpezada };
