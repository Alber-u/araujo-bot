// 07/10/2026 · «Listas para empezar primero»: una obra no lista no ocupa el hueco de una lista ni tiene fecha;
// la cuadrilla grande libre la toma la siguiente lista; y una lista no cambia de cuadrilla por un día.
// Uso: node lib/cola-listas.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");

const HOY = "2026-10-07";
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, pasos: 0, ...extra });
// expediente listo: pisos con contrato y pago; Mar de Alborán sin pisos; Luceros con 2 contratos sin firmar
const listo = { pisos: 6, contratos: { total: 6, faltan: [] }, pagos: { total: 6, faltan: [], financiados: [] }, documentacion: { total: 2, faltan: 0 }, cuadre: { ok: true } };
const expedientes = { rl: listo, lp: listo, mj: listo, ma: { ...listo, pisos: 0 }, lu: { ...listo, contratos: { total: 4, faltan: ["1ºA", "2ºB"] } } };
const obras0 = (hOrad = 400) => [
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29" }),
  { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: hOrad, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
  ob("ma", "Mar de Alborán 14", 380, { orden: 1 }),   // grande y no lista, la primera de la cola
  ob("rl", "Rafael Laffón 7", 160, { orden: 2 }), ob("lp", "La Paz 29", 120, { orden: 3 }),
  ob("lu", "Luceros 4", 200, { orden: 4 }), ob("mj", "Mijares 3", 102, { orden: 5 }),
];
const calc = (hOrad, extra = {}) => {
  const obras = O.aplicarPlanificacion(obras0(hOrad), []);
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: [], expedientes,
    simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const args = { cf, hoy: HOY, festivos: fest, jornada: J.leerJornada({ horas_dia: "8" }), nombresCuadrillas: quienes, registros: [] };
  return { r: P.calendarioPlan({ ...args, ...extra }), fechas: P.fechasPlan(args) };
};
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));
const ver = (r) => r.obras.map((o) => `${o.nombre}: C${o.equipo} ${o.inicio}→${o.fin}${o.sin_fecha ? " (sin fecha)" : ""}`).join("\n");

const { r, fechas } = calc(400);
const u = por(r, "Urbano"), mj = por(r, "Mijares"), ma = por(r, "Mar de"), lu = por(r, "Luceros"), rl = por(r, "Rafael"), lp = por(r, "La Paz");
// Orad en la Cuadrilla 2; al acabar, entra la siguiente lista (Mijares), no Mar de Alborán (grande, no lista)
assert.strictEqual(u.equipo, 2, ver(r));
assert.deepStrictEqual([mj.equipo, mj.inicio > u.fin, P.laborables(u.fin, mj.inicio)], [2, true, 2], ver(r));
// las no listas: sin fecha y al final de la cola
assert.deepStrictEqual([ma.sin_fecha, lu.sin_fecha, mj.sin_fecha, rl.sin_fecha], [true, true, false, false]);
const puestos = r.obras.filter((o) => o.estado_plan === "sugerencia").map((o) => o.nombre);
assert.deepStrictEqual(puestos.slice(-2), ["Mar de Alborán 14", "Luceros 4"], puestos.join(", "));
// Laffón y La Paz en la Cuadrilla 1, detrás de Montemayor
assert.deepStrictEqual([rl.equipo, lp.equipo], [1, 1], ver(r));
// el cash flow, con las mismas fechas
assert.deepStrictEqual([fechas.mj.inicio, fechas.mj.fin], [mj.inicio, mj.fin]);

// una lista no cambia de cuadrilla porque otra se alargue un día (Orad un día más)
{
  const r2 = calc(424).r;
  assert.deepStrictEqual(["Mijares", "Rafael", "La Paz"].map((n) => por(r2, n).equipo), [2, 1, 1], ver(r2));
}
// sin «Listas primero»: la cola de siempre (Mar de Alborán con fecha)
{
  const r3 = calc(400, { listasPrimero: false }).r;
  assert.strictEqual(por(r3, "Mar de").sin_fecha, false);
}
console.log(`OK cola-listas.test · Mijares C${mj.equipo} ${mj.inicio}→${mj.fin} tras Orad (${u.fin}) · Mar de Alborán y Luceros sin fecha, al final · Laffón y La Paz en la C1`);
