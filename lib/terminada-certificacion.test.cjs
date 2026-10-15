// 15/10/2026 · Planificación: una obra certificada al 100 % está terminada aunque falte un remate de terceros
// (Jorge de Montemayor 34: falta el armario / las puertas del herrero). Uso: node lib/terminada-certificacion.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");
const F = require("./fase-plan.cjs");

const HOY = "2026-10-15";   // jueves
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
// Montemayor en obra desde el 02/10 (OT en 13, sin fecha de inicio), 95 de 109 h; Laffón, la siguiente sugerencia
const ot = { grupos: { "13_EN_EJECUCION": [{ ccpp_id: "jm", ot: { fase_ot_hoja: "13_EN_EJECUCION", fecha_inicio_obra: "", remate_pendiente: "armario / puertas del herrero", remate_responsable: "herrero" } }] } };
const obras0 = O.completarCartera([
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-10-02", fase: "13_EN_EJECUCION" }),
  ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }),
], { ot, hoy: HOY, oo: { obras: [
  // Urbano Orad: una sola orden (OO-2026-142) en obra; tuberías de Jorge de Montemayor, ya FACTURADA
  { obra_id: "OO-2026-142", codigo_ot: "OT0143/2026", nombre: "CCPP Urbano Orad 13-15", fase: "EN_EJECUCION", fecha_inicio: "2026-10-05", subtotal_eur: 35300, total_eur: 38830, horas_previstas: 640, material_previsto_eur: 5000, entradas_cuenta_eur: 0, cobrado_eur: 19415, ultima_hora: "2026-10-14" },
  { obra_id: "OO-2026-150", codigo_ot: "OT0151/2026", nombre: "Jorge Montemayor 34 TUBERIAS", fase: "FACTURADA", fecha_inicio: "2026-10-06", subtotal_eur: 1920, total_eur: 2112, horas_previstas: 40, material_previsto_eur: 60, ultima_hora: "2026-10-10" },
] } });
const registros = [];
// 95 h hasta el 08/10 (sin registros desde entonces: el aviso «sin registros» no debe salir)
for (const [d, h] of [["2026-10-02", 16], ["2026-10-03", 16], ["2026-10-05", 16], ["2026-10-06", 16], ["2026-10-07", 16], ["2026-10-08", 15]]) for (const p of ["Manuel", "Cristhian"]) registros.push({ fecha: d, persona: p, persona_nombre: p, obra: "Jorge de Montemayor 34", horas: h / 2 });
// Orad: 179,5 h en OO-2026-142 del 05 al 14/10 (Juan, Luis y Mario), sus dos fichas visitadas el 05/10 al 0 %, cada 80 h
const diasOrad = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-13", "2026-10-14"];
for (const [i, d] of diasOrad.entries()) for (const p of ["Juan", "Luis", "Mario"]) registros.push({ fecha: d, persona: p, persona_nombre: p, obra: "OO-2026-142", horas: i === 0 ? 179.5 / 3 - 6 * 8.5 : 8.5 });
const fichaOrad = (n) => ({ obra_id: `Urbano Orad ${n}`, avance_pct: 0, ultima_visita_fecha: "2026-10-05", previsto_horas: 320, horas_visita_propia: 80,
  visitas: [{ visita_id: `o${n}`, fecha: "2026-10-05", estado: "cerrada", avance_pct: 0 }] });
const certJM = (pct) => [fichaOrad(13), fichaOrad(15), { obra_id: "Jorge de Montemayor 34", avance_pct: pct, ultima_visita_fecha: "2026-10-14", horas_fichadas_visita: 95,
  visitas: [{ visita_id: "m1", fecha: "2026-10-02", estado: "cerrada", avance_pct: 0 }, { visita_id: "m2", fecha: "2026-10-14", estado: "cerrada", avance_pct: pct }] }];
const calc = (certs) => {
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: certs,
    simulador: { ok: true, obras: obras0, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  return P.calendarioPlan({ cf, hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros });
};

// Antes (certificación al 90 %): en obra, con horas que quedan y visita por hacer
const r90 = calc(certJM(90));
const jm90 = r90.obras.find((o) => o.obra_id === "jm");
assert.ok(jm90 && jm90.estado_plan === "en_obra" && jm90.horas_quedan > 0, JSON.stringify(jm90 && { e: jm90.estado_plan, q: jm90.horas_quedan }));

// Certificación al 100 %: terminada, fuera de las obras planificadas (sin «quedan», sin casilla roja ni visita)
const r = calc(certJM(100));
assert.strictEqual(r.obras.find((o) => o.obra_id === "jm"), undefined);
const t = r.terminadas.find((x) => x.obra_id === "jm");
assert.deepStrictEqual([t.por, t.certificada, t.fin, t.estado_texto, t.remate_responsable], ["certificacion", "2026-10-14", "2026-10-14", "Terminada · pendiente de remate: armario / puertas del herrero (herrero)", "herrero"]);
assert.ok(!r.toca_visitar.some((x) => x.obra_id === "jm"));
assert.ok(!r.avisos.some((a) => /Jorge de Montemayor 34/.test(a.texto) && /toca visitar|por otras órdenes|pasa de su presupuesto|¿terminada\?|Ya terminadas/i.test(a.texto)), JSON.stringify(r.avisos.map((a) => a.texto)));
const aviso = r.avisos.find((a) => a.tipo === "terminada_cert");
assert.strictEqual(aviso.texto, "Jorge de Montemayor 34: terminada según Certificaciones (100 % el 14/10) · pendiente de remate: armario / puertas del herrero (herrero), sin horas de cuadrilla. No ocupa cuadrilla. Su OT sigue sin Finalizada: pásala en Órdenes de trabajo.");
// la Cuadrilla 1 queda libre para lo siguiente: Laffón empieza antes que con Montemayor al 90 %
const rl = (x) => x.obras.find((o) => o.obra_id === "rl");
assert.ok(rl(r).inicio <= rl(r90).inicio, `${rl(r).inicio} vs ${rl(r90).inicio}`);
assert.ok(rl(r).inicio <= "2026-10-16", rl(r).inicio);

// Urbano Orad: un único aviso de visita, con la fecha de la última y las horas desde entonces
const orad = r.obras.find((o) => o.obra_id === "OO-2026-142");
assert.ok(orad, r.obras.map((o) => o.obra_id).join(","));
assert.strictEqual(orad.toca_visitar.motivo, "visita atrasada · 179,5 h fichadas desde la última (última el 05/10, cada 80 h)");
assert.deepStrictEqual([orad.toca_visitar.ultima_visita, orad.toca_visitar.horas_desde_ultima], ["2026-10-05", 179.5]);
assert.strictEqual(r.toca_visitar.filter((x) => /orad/i.test(x.nombre)).length, 1);
const avVisita = r.avisos.filter((a) => a.tipo === "toca_visitar" && /orad/i.test(a.texto));
assert.strictEqual(avVisita.length, 1);
// tuberías (FACTURADA): no se planifica ni cuenta como pendiente
assert.ok(!r.obras.some((o) => o.obra_id === "OO-2026-150") && !r.oo_paradas.some((o) => o.obra_id === "OO-2026-150"));

// Órdenes de trabajo: la OT sigue en 13 (no se mueve sola) y se propone pasarla a Finalizada
const f = F.faseSegunPlan({ obras: r.obras, terminadas: r.terminadas })("13_EN_EJECUCION", "jm");
assert.deepStrictEqual([f.fase, f.propuesta?.fase], ["13_EN_EJECUCION", "14_FINALIZADA"]);
assert.ok(/100 % ejecutado el 14\/10/.test(f.propuesta.motivo) && /remate: armario/.test(f.propuesta.motivo));
// una terminada a mano o con fecha (no por certificación) sigue como siempre: columna 14
assert.strictEqual(F.faseSegunPlan({ obras: [], terminadas: [{ obra_id: "x", fin: "2026-10-10" }] })("13_EN_EJECUCION", "x").fase, "14_FINALIZADA");

// (16/10/2026) OT en 14_FINALIZADA (Jorge de Montemayor desde las 22:30 del 15/10): terminada por su OT, con su remate,
// aunque la certificación no esté al 100 % y aunque no tuviera horas
const conOT14 = (horas) => {
  const ot14 = { grupos: { "14_FINALIZADA": [{ ccpp_id: "jm", ot: { fase_ot_hoja: "14_FINALIZADA", remate_pendiente: "armario / puertas del herrero", remate_responsable: "herrero" } }] } };
  const obras = O.completarCartera([ob("jm", "Jorge de Montemayor 34", 109, { fase: "14_FINALIZADA", horas_registradas: horas }), ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 })], { ot: ot14, hoy: HOY });
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: [],
    simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  return P.calendarioPlan({ cf, hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros: horas > 0 ? registros.filter((x) => /Montemayor/.test(x.obra)) : [] });
};
for (const h of [95, 0]) {
  const r14 = conOT14(h);
  assert.strictEqual(r14.obras.find((o) => o.obra_id === "jm"), undefined, `con ${h} h`);
  const t14 = r14.terminadas.find((x) => x.obra_id === "jm");
  assert.deepStrictEqual([t14.por, t14.estado_texto], ["ot", "Terminada · pendiente de remate: armario / puertas del herrero (herrero)"]);
  assert.ok(r14.avisos.some((a) => a.tipo === "terminada_cert" && /terminada \(OT en Finalizada\) · pendiente de remate: armario/.test(a.texto) && !/pásala/.test(a.texto)));
}
// OT en 14 y certificación al 100 %: el fin es el de la certificación (no hoy)
{
  const ot14 = { grupos: { "14_FINALIZADA": [{ ccpp_id: "jm", ot: { fase_ot_hoja: "14_FINALIZADA" } }] } };
  const obras = O.completarCartera([ob("jm", "Jorge de Montemayor 34", 109, { fase: "14_FINALIZADA" })], { ot: ot14, hoy: HOY });
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: certJM(100).filter((c) => /Jorge/.test(c.obra_id)),
    simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const t = P.calendarioPlan({ cf, hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros }).terminadas.find((x) => x.obra_id === "jm");
  assert.deepStrictEqual([t.por, t.fin, t.certificada, t.estado_texto], ["ot", "2026-10-14", "2026-10-14", "Terminada"]);
}

console.log("OK terminada-certificacion.test · Montemayor al 100 %: terminada (pendiente de remate), sin horas, sin avisos de visita ni registros; Cuadrilla 1 libre; OT con propuesta de Finalizada");
