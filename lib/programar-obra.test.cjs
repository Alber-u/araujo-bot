// «Programar obra», estado de cada obra, «lista para empezar», festivos y cartera en jornadas (04/10/2026)
// Uso: node lib/programar-obra.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const S = require("./simulador-caja.cjs");
const F = require("./festivos.cjs");

const HOY = "2026-10-03";
const ob = (obra_id, nombre, fase, importe, h, extra = {}) => ({ obra_id, nombre, fase, importe, horas_previstas: h, horas_registradas: 0, material_previsto: importe * 0.25, faltan_docs: 0, total_docs: 2, ...extra });
const obras = [
  ob("jm", "Jorge de Montemayor 34", "09_TRAMITADA", 7058, 109, { empezada: "2026-10-02", horas_registradas: 10 }),
  ob("rl", "Rafael Laffón 7", "09_TRAMITADA", 8981, 160, { orden: 1, pasos: 0 }),
  ob("lp", "La Paz 29", "09_TRAMITADA", 14515, 192, { orden: 2, pasos: 0 }),
  ob("mv", "Malvaloca 1", "05_DOCUMENTACION", 36126, 528, { orden: 3, pasos: 4, faltan_docs: 3, total_docs: 7 }),
];
const cf = (extra = {}) => ({
  hoy: HOY, inicial: { propio: -20000, custodia_y_senales: 60000 },
  semanas: [{ n: 1, desde: "2026-09-28", hasta: "2026-10-04", movs: [] }], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 18, mat: 27, tram: 1, grande: 300 } },
  custodias_obras: [
    { ccpp_id: "rl", comunidad: "Rafael Laffón 7", en_custodia: 9000, cobrado: 9000, previsto: 9000, entregado_emasesa: 0, vecinos_censo: 12, vecinos_faltan: 0 },
    { ccpp_id: "lp", comunidad: "Paz 29", en_custodia: 730.02, cobrado: 730.02, previsto: 2920.08, entregado_emasesa: 0, vecinos_censo: 4, vecinos_faltan: 3 },
  ],
  ...extra,
});
const quienes = [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]];

// ── festivos ──
assert.deepStrictEqual(F.leerFestivos("2026-12-08; 2026-12-25;mal").lista, ["2026-12-08", "2026-12-25"]);
assert.deepStrictEqual(F.leerFestivos("2026-12-08; 2026-12-25;mal").errores, ["mal"]);
assert.strictEqual(F.leerFestivos("").fuente, "por_defecto");
assert.ok(F.POR_DEFECTO.includes("2026-10-12") && F.POR_DEFECTO.includes("2026-11-02") && F.POR_DEFECTO.includes("2026-12-08"));
P.setFestivos(["2026-10-12"]);
assert.strictEqual(P.laborables("2026-10-12", "2026-10-16"), 4);                 // el 12/10 no cuenta
assert.strictEqual(P.enesimoLaborable("2026-10-09", 2), "2026-10-13");          // vie 09 = 1, (12 festivo) mar 13 = 2
P.setFestivos([]);
assert.deepStrictEqual(P.mesesYDias("2026-10-04", "2027-07-14"), { meses: 9, dias: 10 });
assert.deepStrictEqual(P.mesesYDias("2026-01-31", "2026-03-01"), { meses: 1, dias: 1 });   // 28/02 + 1

// ── planificacion_obras: columna «operarios» ──
assert.deepStrictEqual(O.leerOperarios(" Antonio, Pepe ,"), ["Antonio", "Pepe"]);
const v = O.planVigente([{ obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, nota: "JM", usuario: "JM", fecha: "2026-10-04T10:00:00Z", operarios: "Antonio, Pepe, Juan" }]);
assert.deepStrictEqual(v.lp.operarios, ["Antonio", "Pepe", "Juan"]);
const ap = O.aplicarPlanificacion(obras, [{ obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, nota: "JM", usuario: "JM", fecha: "2026-10-04T10:00:00Z", operarios: "Antonio, Pepe, Juan" }]).find((o) => o.obra_id === "lp");
assert.deepStrictEqual([ap.personas_plan, ap.inicio_fijo, ap.operarios.length], [3, "2026-10-19", 3]);
assert.ok(O.validarCambioPlan({ obra_id: "lp", nota: "x", usuario: "JM", operarios: ["Antonio"] }).some((e) => /fecha de inicio/.test(e)));
assert.deepStrictEqual(O.validarCambioPlan({ obra_id: "lp", nota: "x", usuario: "JM", operarios: ["Antonio"], fecha_inicio_fija: "2026-10-19" }), []);
// sin operarios (cambio de orden de antes): no está «planificada»
assert.strictEqual(O.aplicarPlanificacion(obras, [{ obra_id: "lp", posicion: 1, nota: "x", usuario: "JM", fecha: "2026-10-04" }]).find((o) => o.obra_id === "lp").personas_plan, undefined);

// ── calendario: estado, operarios, indicadores ──
const r = P.calendarioPlan({ cf: cf(), hoy: HOY, nombresCuadrillas: quienes, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
const por = (id) => r.obras.find((x) => x.obra_id === id);
assert.strictEqual(por("jm").estado_plan, "en_obra");
assert.strictEqual(por("lp").estado_plan, "sugerencia");
assert.deepStrictEqual(r.resumen_plan, { planificadas: 0, sugerencias: 3, en_obra: 1 });
assert.strictEqual(por("lp").operarios_de, "cuadrilla");
assert.deepStrictEqual(por("lp").operarios, quienes[por("lp").equipo - 1]);
// «Lista para empezar» con el expediente (contratos y pagos de los pisos)
const expRL = { pisos: 6, contratos: { ok: 6, total: 6, faltan: [] }, pagos: { resueltos: 6, total: 6, pagados: 5, financiados: [{ vivienda: "3A", meses: 18, importe: null }], faltan: [] },
                ccpp: { aplica: true, contrato: true, pago: { tipo: "pagado" } }, documentacion: { faltan: 0, total: 7 } };
const expLP = { pisos: 4, contratos: { ok: 2, total: 4, faltan: ["1IZDA", "2DCHA"] }, pagos: { resueltos: 3, total: 4, pagados: 3, financiados: [], faltan: ["1IZDA"] },
                ccpp: { aplica: false, contrato: null, pago: { tipo: "no_aplica" } }, documentacion: { faltan: 2, total: 5 } };
const expMV = { pisos: 8, contratos: { ok: 0, total: 0, faltan: [] }, pagos: { resueltos: 0, total: 0, pagados: 0, financiados: [], faltan: [] },
                ccpp: { aplica: false, contrato: null, pago: { tipo: "no_aplica" } }, documentacion: { faltan: 2, total: 9 } };
const rE = P.calendarioPlan({ cf: cf({ expedientes: { rl: expRL, lp: expLP, mv: expMV },
  sabadell: { abonos_futuros: [], pendientes: [{ ccpp_id: "rl", nombre: "Rafael Laffón 7", pisos: 1, viviendas: ["3A"], importe: 1650, estimado: true }], sin_5610: [] } }), hoy: HOY, nombresCuadrillas: quienes });
const porE = (id) => rE.obras.find((x) => x.obra_id === id);
// Rafael Laffón 7: 1 financiado a 18 meses sin abono de Sabadell → no lista, dice cuánto falta
assert.strictEqual(porE("rl").lista_para_empezar, false);
assert.strictEqual(porE("rl").expediente.texto, "6/6 contratos · 6/6 pagados (1 financiado 18 meses, sin abono de Sabadell)");
assert.deepStrictEqual(porE("rl").expediente.faltas, ["Pendiente abono Sabadell: 1 piso (3A)"]);
assert.ok(/Sabadell aún no ha abonado ninguno/.test(porE("rl").expediente.financiacion.texto));
assert.deepStrictEqual([porE("rl").expediente.financiacion.pendiente_eur, porE("rl").expediente.financiacion.estimado], [1650, true]);
assert.ok(!JSON.stringify([porE("rl").expediente.faltas, porE("rl").expediente.texto, porE("rl").expediente.financiacion.texto]).includes("€"), "sin euros en los textos (JM)");
assert.ok(!rE.avisos.some((a) => /ARA adelanta/.test(a.texto)), "ARA no adelanta nada de su caja");
// con el abono de Sabadell (no está en pendientes): lista
const rA = P.calendarioPlan({ cf: cf({ expedientes: { rl: expRL }, sabadell: { abonos_futuros: [], pendientes: [], sin_5610: [{ ccpp_id: "rl", nombre: "Rafael Laffón 7", importe: 1650 }] } }), hoy: HOY });
const rlA = rA.obras.find((x) => x.obra_id === "rl");
assert.deepStrictEqual([rlA.lista_para_empezar, rlA.expediente.texto], [true, "Lista: 6/6 contratos · 6/6 pagados (1 financiado 18 meses) · documentación completa"]);
assert.ok(/Sabadell ya ha abonado/.test(rlA.expediente.financiacion.texto));
// aviso rojo de contabilidad: abonado según la hoja y sin saldo en la 5610
assert.ok(rA.avisos.some((a) => a.nivel === "rojo" && a.texto === "Rafael Laffón 7: abono de Sabadell sin custodia 5610: revisar dónde se contabilizó."));
// sin el cálculo del cash flow: pendiente si no hay fila de abono en financiaciones_sabadell
const rN = P.calendarioPlan({ cf: cf({ expedientes: { rl: expRL } }), hoy: HOY }).obras.find((x) => x.obra_id === "rl");
assert.deepStrictEqual(rN.expediente.faltas, ["Pendiente abono Sabadell: 1 piso (3A)"]);
// La Paz 29: no lista, dice qué falta
assert.strictEqual(porE("lp").lista_para_empezar, false);
assert.deepStrictEqual(porE("lp").expediente.faltas, ["Documentación: faltan 2 de 5 · fase 09", "Falta contrato: 2 pisos (1IZDA, 2DCHA)", "Falta pago: 1 piso (1IZDA)"]);
assert.strictEqual(porE("lp").expediente.financiacion.texto, "Sin financiación: pagan los vecinos a EMASESA");
// Malvaloca (fase 05, «faltan 2 de 9»): no lista
assert.deepStrictEqual([porE("mv").lista_para_empezar, porE("mv").expediente.faltas[0], porE("mv").expediente.texto, porE("mv").expediente.financiacion], [false, "Documentación: faltan 2 de 9 · fase 05", "Contratos y pagos: todavía no (fase 05)", null]);
// Tordo 18: «7/7 contratos · 8/8 pagados» → no está lista y dice qué piso falla
const expTO = { pisos: 7, contratos: { ok: 7, total: 7, faltan: [] }, pagos: { resueltos: 8, total: 8, pagados: 8, financiados: [], faltan: [] },
                ccpp: { aplica: false, contrato: null, pago: { tipo: "no_aplica" } }, documentacion: { faltan: 0, total: 7 },
                cuadre: { ok: false, pisos: 7, repetidos: [{ vivienda: "1A", filas: 2 }], sin_contrato: [{ vivienda: "4A", contrato: "vacío", pago: "OK" }], sin_pago: [] } };
const rT = P.calendarioPlan({ cf: cf({ expedientes: { rl: expTO } }), hoy: HOY }).obras.find((x) => x.obra_id === "rl");
assert.strictEqual(rT.lista_para_empezar, false);
assert.strictEqual(rT.expediente.texto, "7/7 contratos · 8/8 pagados · no cuadran los pisos");
assert.deepStrictEqual(rT.expediente.faltas, ["No cuadran los pisos: 7 con contrato y 8 con pago (7 pisos en la hoja de pisos)",
  "Piso 1A: repetido (2 filas en la hoja de pisos)", "Piso 4A: sin contrato (contrato vacío, pago «OK»)"]);
// Cuadre solo desde la fase 08 (en 05-07 es normal pago sin contrato); como máximo 3 pisos con nombre
{
  const sinC = ["0A", "0B", "1A", "1B", "2A"].map((v) => ({ vivienda: v, contrato: "vacío", pago: "OK" }));
  const expV = { pisos: 5, contratos: { ok: 0, total: 0, faltan: [] }, pagos: { resueltos: 5, total: 5, pagados: 5, financiados: [], faltan: [] },
                 ccpp: { aplica: false }, documentacion: { faltan: 3, total: 6 }, cuadre: { ok: false, pisos: 5, repetidos: [], sin_contrato: sinC, sin_pago: [] } };
  const e05 = P.estadoLista({ fase: "05_DOCUMENTACION" }, 5, expV, null, true);
  assert.ok(!e05.faltas.some((t) => /cuadran|sin contrato|Sin contrato/.test(t)), "en 05-07 no se mira el cuadre");
  const e08 = P.estadoLista({ fase: "08_CYCP" }, 8, expV, null, true);
  assert.ok(e08.faltas.includes("Sin contrato y con pago anotado: 5 pisos (0A, 0B, 1A y 2 más)"));
  const e08b = P.estadoLista({ fase: "08_CYCP" }, 8, { ...expV, contratos: { ok: 0, total: 5, faltan: ["0A", "0B", "1A", "1B", "2A"] }, cuadre: { ok: true } }, null, true);
  assert.ok(e08b.faltas.includes("Falta contrato: 5 pisos (0A, 0B, 1A y 2 más)"));
}
// Sin pisos: contratada y pagada por la comunidad (La Paz 29) → Lista; sin nada (Mar de Alborán 14) → «no tiene pisos»
{
  const vacio = { contratos: { ok: 0, total: 0, faltan: [] }, pagos: { resueltos: 0, total: 0, pagados: 0, financiados: [], faltan: [] }, documentacion: { faltan: 0, total: 1 }, cuadre: { ok: true } };
  const lp0 = P.estadoLista({ fase: "09_TRAMITADA" }, 9, { ...vacio, pisos: 0, ccpp: { aplica: true, contrato: true, pago: { tipo: "pagado" } } }, null, true);
  assert.deepStrictEqual([lp0.lista, lp0.texto, lp0.faltas], [true, "Lista: Contratada y pagada por la comunidad · documentación completa", []]);
  const ma = P.estadoLista({ fase: "09_TRAMITADA" }, 9, { ...vacio, pisos: 0, ccpp: { aplica: false, contrato: null, pago: { tipo: "no_aplica" } } }, null, true);
  assert.deepStrictEqual([ma.lista, ma.faltas], [false, ["El expediente no tiene pisos"]]);
  const sinPago = P.estadoLista({ fase: "09_TRAMITADA" }, 9, { ...vacio, pisos: 0, ccpp: { aplica: true, contrato: true, pago: { tipo: "pendiente" } } }, null, true);
  assert.deepStrictEqual([sinPago.lista, sinPago.faltas], [false, ["Falta el pago de la comunidad"]]);
}
// Comunidad financiada: igual que los pisos, «Lista» solo con el abono de Sabadell
{
  const vacio = { pisos: 0, contratos: { ok: 0, total: 0, faltan: [] }, pagos: { resueltos: 0, total: 0, pagados: 0, financiados: [], faltan: [] }, documentacion: { faltan: 0, total: 1 }, cuadre: { ok: true } };
  const ccF = (abonado) => ({ ...vacio, ccpp: { aplica: true, contrato: true, pago: { tipo: "financiado", meses: 18 }, abonado } });
  const pend = P.estadoLista({ fase: "09_TRAMITADA" }, 9, ccF(false), { ccpp_id: "x", viviendas: [], pisos: 0, comunidad: true, importe: 33000, estimado: true }, true);
  assert.deepStrictEqual([pend.lista, pend.faltas, pend.financiacion.pendiente_eur], [false, ["Pendiente abono Sabadell: comunidad"], 33000]);
  assert.ok(!JSON.stringify([pend.faltas, pend.texto, pend.financiacion.texto]).includes("€"));
  const ab = P.estadoLista({ fase: "09_TRAMITADA" }, 9, ccF(true), null, true);
  assert.deepStrictEqual([ab.lista, ab.texto], [true, "Lista: Contratada y financiada (abonada por Sabadell) por la comunidad · documentación completa"]);
  // sin el cálculo del cash flow: según la fila de financiaciones_sabadell
  assert.deepStrictEqual(P.estadoLista({ fase: "09_TRAMITADA" }, 9, ccF(false), null, false).faltas, ["Pendiente abono Sabadell: comunidad"]);
}
// la cuenta 5610 no sale si no hay financiados; sin expediente, se dice
assert.ok(!JSON.stringify(porE("lp").expediente).includes("5610"));
assert.strictEqual(por("rl").expediente.sin_expediente, true);

// ── Programar obra: La Paz 29 con 3 operarios desde el 19/10 ──
const borrador = { obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, operarios: ["Antonio", "Pepe", "Juan"] };
const r2 = P.calendarioPlan({ cf: cf(), hoy: HOY, borrador, nombresCuadrillas: quienes, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
const lp = r2.obras.find((x) => x.obra_id === "lp");
// 192 h ÷ (3 × 7,7 h) = 8,3 jornadas → 9 días, del lunes 19/10 al jueves 29/10
assert.deepStrictEqual([lp.estado_plan, lp.personas, lp.jornadas, lp.dias_laborables, lp.inicio, lp.fin, lp.operarios_de], ["borrador", 3, 8.3, 9, "2026-10-19", "2026-10-29", "programada"]);
// sin guardar: «Borrador sin guardar», ni «Planificada» ni «Fijada a mano»
assert.deepStrictEqual([lp.manual, lp.borrador, lp.programada], [false, true, null]);
assert.strictEqual(lp.motivo, "Borrador sin guardar: empezaría el 19/10 con la Cuadrilla 1 (3 personas).");
assert.deepStrictEqual(r2.resumen_plan, { planificadas: 0, sugerencias: 2, en_obra: 1 });
// con 2 personas: 192 ÷ 15,4 = 12,5 jornadas
const r3 = P.calendarioPlan({ cf: cf(), hoy: HOY, borrador: { ...borrador, operarios: ["Antonio", "Pepe"] }, festivos: { lista: [], fuente: "config_dinero", errores: [] } });
assert.strictEqual(r3.obras.find((x) => x.obra_id === "lp").jornadas, 12.5);

// ── Cartera planificada: una sola fecha de fin, la del calendario por cuadrillas (7,7 h, festivos, vacaciones) ──
const c = r.cartera;
assert.strictEqual(c.personas, 5);
assert.strictEqual(c.horas_dia, 7.7);
assert.strictEqual(c.desde, "2026-10-05");
assert.strictEqual(c.ultimo_dia, r.metricas.fin);
assert.strictEqual(c.fin_calendario, r.metricas.fin);
assert.strictEqual(c.ultimo_dia, r.obras.map((x) => x.fin).sort().pop());
assert.deepStrictEqual([c.meses, c.dias], [P.mesesYDias(HOY, c.ultimo_dia).meses, P.mesesYDias(HOY, c.ultimo_dia).dias]);
assert.ok(!("jornadas" in c), "sin la cuenta horas ÷ personas, que daba otra fecha");
const conFest = P.calendarioPlan({ cf: cf(), hoy: HOY, festivos: { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] } }).cartera;
assert.ok(conFest.ultimo_dia >= c.ultimo_dia, "los festivos no adelantan la cartera");
// sin la clave «festivos»: aviso
assert.ok(P.calendarioPlan({ cf: cf(), hoy: HOY }).avisos.some((a) => /falta la clave «festivos»/.test(a.texto)));

// ── Programar una obra más adelante no manda las demás detrás de ella: se colocan en los huecos ──
{
  const sinF = { lista: [], fuente: "config_dinero", errores: [] };
  const rB = P.calendarioPlan({ cf: cf(), hoy: HOY, nombresCuadrillas: quienes, festivos: sinF,
    borrador: { obra_id: "lp", fecha_inicio_fija: "2026-12-01", cuadrilla: 1, operarios: ["Antonio", "Pepe"] } });
  const x = (id) => rB.obras.find((o) => o.obra_id === id);
  assert.strictEqual(x("lp").inicio, "2026-12-01");
  // (05/10/2026) Jorge, en obra, reparte lo que le queda desde hoy (antes, desde su inicio del 02/10):
  // termina un día más tarde y Rafael Laffón entra el 14/10
  assert.strictEqual(x("rl").inicio, "2026-10-14", "Rafael Laffón sigue en su hueco, antes de La Paz");
  assert.ok(x("rl").fin < x("lp").inicio);
  // si no cabe antes, va después del tramo fijado (nunca encima)
  const rC = P.calendarioPlan({ cf: cf(), hoy: HOY, nombresCuadrillas: quienes, festivos: sinF,
    borrador: { obra_id: "lp", fecha_inicio_fija: "2026-10-19", cuadrilla: 1, operarios: ["Antonio", "Pepe"] } });
  const y = (id) => rC.obras.find((o) => o.obra_id === id);
  assert.ok(y("rl").inicio > y("lp").fin, "no se monta encima de la obra fijada");
}

// ── Orden automático: las «Lista para empezar» antes que las no listas (caso Laffón 7 / Mijares 3) ──
{
  const sinF = { lista: [], fuente: "config_dinero", errores: [] };
  const conLista = obras.map((o) => ({ ...o, lista_para_empezar: o.obra_id === "lp" }));
  const rL = P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conLista } }), hoy: HOY, nombresCuadrillas: quienes, festivos: sinF });
  const x = (id) => rL.obras.find((o) => o.obra_id === id);
  assert.ok(x("lp").inicio < x("rl").inicio, "la lista (La Paz) entra antes que la no lista (Laffón), aunque Laffón vaya antes por documentación");
  assert.deepStrictEqual(S.colaObras(conLista, HOY).map((o) => o.obra_id), ["jm", "lp", "rl", "mv"]);
  // las obras con fecha no se mueven; sin dato de «lista», el orden de siempre
  assert.deepStrictEqual(S.colaObras(obras, HOY).map((o) => o.obra_id), ["jm", "rl", "lp", "mv"]);
  // el cash flow usa la misma cola
  const simL = S.simular({ obras: conLista, historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 } });
  const pi = (id) => simL.prog.find((p) => p.obra_id === id);
  assert.ok(pi("lp").t0 <= pi("rl").t0);
}

// ── Quién forma cada cuadrilla: si falta, aviso ──
{
  const sinF = { lista: [], fuente: "config_dinero", errores: [] };
  const sinNombres = P.calendarioPlan({ cf: cf(), hoy: HOY, festivos: sinF });
  assert.ok(sinNombres.avisos.some((a) => /^Falta decir quién forma la Cuadrilla 1 y la Cuadrilla 2: config_dinero «cuadrilla_personas»/.test(a.texto)));
  const media = P.calendarioPlan({ cf: cf(), hoy: HOY, festivos: sinF, nombresCuadrillas: P.personasPorCuadrilla("1:Antonio;Pepe") });
  assert.ok(media.avisos.some((a) => /^Falta decir quién forma la Cuadrilla 2:/.test(a.texto)));
  assert.deepStrictEqual(media.cuadrillas.map((c) => c.quienes), [["Antonio", "Pepe"], null]);
  assert.ok(!P.calendarioPlan({ cf: cf(), hoy: HOY, festivos: sinF, nombresCuadrillas: quienes }).avisos.some((a) => /Falta decir quién/.test(a.texto)));
}

// ── Obras con fecha fija (OT, OO) o con fila en planificacion_obras: «Planificada» ──
const conFecha = obras.map((o) => (o.obra_id === "rl" ? { ...o, inicio_fijo: "2026-10-26" } : o));
const sinFest = { lista: [], fuente: "config_dinero", errores: [] };
const rF = P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFecha } }), hoy: HOY, festivos: sinFest });
const rl = rF.obras.find((x) => x.obra_id === "rl");
assert.deepStrictEqual([rl.estado_plan, rl.programada.origen], ["planificada", "ot"]);
// el día que empieza, «En obra»
assert.strictEqual(P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFecha } }), hoy: "2026-10-26", festivos: sinFest }).obras.find((x) => x.obra_id === "rl").estado_plan, "en_obra");
const conFila = O.aplicarPlanificacion(obras, [{ obra_id: "mv", posicion: 2, nota: "antes", usuario: "JM", fecha: "2026-10-04T09:00:00Z" }]);
const mvF = P.calendarioPlan({ cf: cf({ simulador: { ...cf().simulador, obras: conFila } }), hoy: HOY, festivos: sinFest }).obras.find((x) => x.obra_id === "mv");
assert.deepStrictEqual([mvF.estado_plan, mvF.programada.usuario], ["planificada", "JM"]);

// ── Jornada del convenio y vacaciones ──
const Jl = require("./jornada.cjs");
const jj = Jl.leerJornada({ horas_dia: "7,7", vacaciones_dias: "21", vacaciones_personas: "Pepe: 2027-07-05 a 2027-07-23, 2027-12-27 a 2027-12-31; mal" });
assert.deepStrictEqual([jj.horas_dia, jj.vacaciones_dias, jj.personas.Pepe.length, jj.errores.length], [7.7, 21, 2, 1]);
P.setFestivos(["2027-08-16"]); P.setJornada(jj, "2026-10-04");
// en agosto de 2027 nadie trabaja por defecto (21 laborables desde el 01/08: 02/08 → 31/08, sin el 16/08):
// 29 y 30/07 + 1, 2, 3 y 6/09 = 6 días
assert.deepStrictEqual(P.finPorHoras("2027-07-29", 2 * 7.7 * 6, { n: 2 }), { ult: "2027-09-06", finExcl: "2027-09-07", dias: 6, vac: 21 });
// Pepe trabaja en agosto (sus vacaciones son en julio): la obra sigue con él solo
const conPepe = P.finPorHoras("2027-08-02", 7.7 * 2, { nombres: ["Pepe", "Juan"] });
assert.deepStrictEqual([conPepe.ult, conPepe.dias], ["2027-08-03", 2]);
P.setFestivos([]); P.setJornada(null, HOY);
// cash flow: horas por persona y mes del convenio
const hp = Jl.hppConvenio(Jl.leerJornada({}), HOY, (x) => { const d = new Date(x + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6; });
assert.strictEqual(hp.hpp, Math.round(7.7 * (hp.labs - 21) / 12 * 10) / 10);

// ── Cash flow: los cobros dicen si vienen de una obra planificada o de una sugerencia ──
const conPlan = S.aplicarCambioPlan(obras, borrador);
const sim = S.simular({ obras: conPlan, historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 } });
const pLp = sim.prog.find((p) => p.obra_id === "lp"), pRl = sim.prog.find((p) => p.obra_id === "rl");
assert.deepStrictEqual([pLp.plan_estado, pRl.plan_estado, sim.prog.find((p) => p.obra_id === "jm").plan_estado], ["planificada", "sugerencia", "en_obra"]);
assert.ok(sim.movs.some((m) => m.fila === "sim_cobros" && /La Paz 29 \(fase 09 · programada\)/.test(m.concepto)));
assert.ok(sim.movs.some((m) => m.fila === "sim_cobros" && /Rafael Laffón 7 \(fase 09 · sin programar\)/.test(m.concepto)));
// 3 personas en vez de la cuadrilla de 2: dura menos
const simSin = S.simular({ obras: S.aplicarCambioPlan(obras, { ...borrador, operarios: [] }), historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 } });
const dur = (p) => p.t1 - p.t0;
assert.ok(dur(pLp) < dur(simSin.prog.find((p) => p.obra_id === "lp")) || simSin.prog.find((p) => p.obra_id === "lp").cuadrilla === 3);

// cash flow: los financiados NO salen de la caja propia. El abono de Sabadell entra en la custodia
// y sale a EMASESA el día de inicio: solo cambia «En el banco (con vecinos)»
const simA = S.simular({ obras: conPlan, historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 },
  custodias: [], abonosSabadell: [{ ccpp_id: "lp", nombre: "La Paz 29", importe: 3000, fecha: "2026-10-12" }] });
assert.ok(!simA.movs.some((m) => /adelanta|sabadell/i.test(m.concepto + m.fila)), "nada en la caja propia");
assert.deepStrictEqual(simA.custodia.entregas.map((e) => [e.obra_id, e.importe, e.sabadell]), [["lp", 3000, 3000]]);
const cfSerie = { hoy: HOY, inicial: { propio: 10000, custodia_y_senales: 500 }, semanas: [{ hasta: "2026-12-31", movs: [] }], meses: [], recurrentes_movs: [] };
const sinAb = S.serieMensual(cfSerie, simA, { hasta: "2026-12" }).meses, ent = simA.custodia.entregas[0].fecha.slice(0, 7);
const simB = S.simular({ obras: conPlan, historico: cf().simulador.historico, hoy: HOY, mandos: { ...cf().automatico.mandos, desvio: 0 }, custodias: [] });
const base0 = S.serieMensual(cfSerie, simB, { hasta: "2026-12" }).meses;
assert.deepStrictEqual(sinAb.map((m) => m.saldo), base0.map((m) => m.saldo), "caja propia: efecto cero");
assert.strictEqual(sinAb.find((m) => m.mes === "2026-10").custodia_recibida, 3000);
assert.strictEqual(sinAb.find((m) => m.mes === "2026-12").banco, base0.find((m) => m.mes === "2026-12").banco, "entra 3.000 y sale 3.000: el banco acaba igual");
assert.strictEqual(sinAb.find((m) => m.mes === ent).custodia_entregada, 3000);

console.log(`OK programar-obra.test · cartera ${c.horas} h → ${c.ultimo_dia} (${c.meses} meses y ${c.dias} días, ${c.dias_laborables} laborables)`);
