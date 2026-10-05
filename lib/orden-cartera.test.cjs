// Test del orden de la cartera según la documentación (sin red).
// Uso: node lib/orden-cartera.test.cjs
const assert = require("assert");
const O = require("./orden-cartera.cjs");
const HOY = "2026-10-03";
// fila de comunidades!A:BO con los campos que se usan
function fila(dir, fase, x = {}) {
  const r = Array(67).fill("");
  r[0] = dir; r[1] = dir; r[15] = fase;
  for (const [k, v] of Object.entries(x)) {
    if (k === "est") v.forEach((e, i) => { r[42 + i] = e; });
    else r[O.COLUMNAS[k]] = v;
  }
  return r;
}
const est = (contrato, pago, resto = "OK") => [resto, resto, resto, resto, resto, resto, resto, contrato, pago];
const FILAS = [
  fila("Obra 09 A", "09_TRAMITADA", { hitos_obra: JSON.stringify({ financ: "2026-09-01" }), fecha_cycp_completa: "2026-08-01" }),
  fila("Obra 09 B", "09_TRAMITADA", { hitos_obra: JSON.stringify({ financ: "2026-09-01", inicio: "2026-09-10" }), fecha_cycp_completa: "2026-09-01" }),
  fila("Obra 08 pendiente", "08_CYCP", { est: est("F", "F") }),
  fila("Obra 08 solicitados 2 faltan", "08_CYCP", { fecha_envio_contratos_pagos: "2026-09-20", est: est("F", "F") }),
  fila("Obra 08 solicitados 1 falta", "08_CYCP", { fecha_envio_contratos_pagos: "2026-09-25", est: est("OK", "F") }),
  fila("Obra 06 reciente", "06_VISITA_EMASESA", { fecha_documentacion_completa: "2026-09-01" }),
  fila("Obra 06 antigua", "06_VISITA_EMASESA", { fecha_documentacion_completa: "2026-07-20" }),
  fila("Obra 06 atascada", "06_VISITA_EMASESA", { fecha_documentacion_completa: "2026-05-01" }),
  fila("Obra 05 resolver", "05_DOCUMENTACION", { fecha_aceptacion_pto: "2026-08-01", fecha_disidentes_solicitados: "2026-09-10", est: est("", "", "F") }),
  fila("Obra 05 muchas", "05_DOCUMENTACION", { fecha_aceptacion_pto: "2026-08-01", est: est("", "", "F") }),
  fila("Obra 05 pocas", "05_DOCUMENTACION", { fecha_aceptacion_pto: "2026-08-01", est: ["OK", "OK", "OK", "OK", "OK", "F", "OK", "", ""] }),
];
const obras = FILAS.map((r) => ({ obra_id: O.ccppId(r[1]), nombre: r[0], fase: r[15] }));
const res = O.ordenarCartera(obras, FILAS, HOY);
assert.deepStrictEqual(res.map((o) => o.nombre), [
  "Obra 09 B", "Obra 09 A",                                                        // más hitos primero
  "Obra 08 solicitados 1 falta", "Obra 08 solicitados 2 faltan", "Obra 08 pendiente", // solicitados, menos faltan
  "Obra 06 antigua", "Obra 06 reciente", "Obra 06 atascada",                         // envío más antiguo; atascada al final
  "Obra 05 pocas", "Obra 05 muchas", "Obra 05 resolver",                             // menos faltan; resolver al final
]);
const por = (n) => res.find((o) => o.nombre === n);
assert.strictEqual(por("Obra 09 A").pasos, 0);
assert.strictEqual(por("Obra 08 pendiente").pasos, 1);
assert.strictEqual(por("Obra 06 antigua").pasos, 3);
assert.strictEqual(por("Obra 05 pocas").pasos, 4);
assert.strictEqual(por("Obra 06 atascada").atascada_dias, 155);
assert.ok(/atascada 155 días/.test(por("Obra 06 atascada").estado_doc));
assert.ok(/CyCP solicitados hace 8 d · faltan 1 de 2/.test(por("Obra 08 solicitados 1 falta").estado_doc));
assert.strictEqual(por("Obra 08 pendiente").estado_doc, "Pendiente de iniciar · faltan 2 de 2");
assert.strictEqual(por("Obra 05 resolver").estado_doc, "Resolver el contrato");
assert.strictEqual(por("Obra 05 pocas").estado_doc, "Faltan 1 de 7 documentos");
assert.strictEqual(por("Obra 09 B").estado_doc, "Tramitada · 2 hitos");   // el paso real del trámite, no «en ejecución»
// Sin fila en la hoja: se queda por fase y lo dice
const sin = O.ordenarCartera([{ obra_id: "x", nombre: "Huérfana", fase: "07_PTE_CYCP" }], [], HOY);
assert.strictEqual(sin[0].estado_doc, "sin datos de documentación");
// El simulador respeta orden y pasos
const S = require("./simulador-caja.cjs");
const conH = res.map((o) => ({ ...o, importe: 10000, horas_previstas: 100, horas_registradas: 0 }));
const sim = S.simular({ obras: conH, historico: { fijos: { operarios: 12734 } }, hoy: HOY, mandos: { personas: 5, hpp: 160, cuadrillas: [5], desvio: 0, mat: 27, tram: 1 } });
assert.deepStrictEqual(sim.prog.map((p) => p.nombre), res.map((o) => o.nombre));
assert.strictEqual(sim.prog.find((p) => p.nombre === "Obra 05 pocas").pasos, 4);
assert.ok(sim.prog.find((p) => p.nombre === "Obra 06 atascada").estado_doc.includes("atascada"));
// Fechas del panel de obras y otras obras aceptadas (Urbano Orad 13 y 15)
{
  const ot = { grupos: { "12_INICIO_OBRA": [{ ccpp_id: "jorge", ot: { fecha_inicio_obra: "2026-10-02" } }],
                         "14_FINALIZADA": [{ ccpp_id: "hecha", ot: { fecha_inicio_real: "2026-09-01" } }] } };
  const oo = { obras: [
    { obra_id: "OO-2026-142", codigo_ot: "OT0143/2026", nombre: "Urbano Orad 13", fase: "INICIO_OBRA", fecha_inicio: "2026-10-05", total_eur: 21356.5, subtotal_eur: 17650, cobrado_eur: 21356.5 },   // el anticipo (una factura) emparejado con esta OO
    { obra_id: "OO-2026-143", codigo_ot: "OT0144/2026", nombre: "Urbano Orad 15", fase: "INICIO_OBRA", fecha_inicio: "2026-10-05", total_eur: 21356.5, subtotal_eur: 17650 },
    { obra_id: "OO-2026-100", nombre: "Otra", fase: "FINALIZADA", total_eur: 1000 },
    { obra_id: "OO-2026-101", nombre: "Borrada", fase: "EN_EJECUCION", total_eur: 1000, borrado: "TRUE" }] };
  const base = [{ obra_id: "jorge", nombre: "Jorge de Montemayor 34", fase: "09_TRAMITADA", estado_doc: "En ejecución · 0 hito(s)" },
                { obra_id: "hecha", nombre: "Hecha", fase: "09_TRAMITADA", fecha_fin: "2026-09-25" }, { obra_id: "otra", nombre: "Otra 05", fase: "05_DOC" }];
  const r = O.completarCartera(base, { ot, oo, hoy: "2026-10-03" });
  const j = r.find((o) => o.obra_id === "jorge"), h = r.find((o) => o.obra_id === "hecha"), u = r.find((o) => o.tipo === "OO");
  assert.deepStrictEqual([j.empezada, j.inicio_fijo, /Empezó el 02\/10/.test(j.estado_doc)], ["2026-10-02", undefined, true]);
  assert.strictEqual(h.fin_obra, "2026-09-25");
  assert.strictEqual(r.filter((o) => o.tipo === "OO").length, 1);              // las dos fichas son una obra
  assert.deepStrictEqual([u.nombre, u.importe_total, u.importe, u.mes_cobro, u.sin_comision, u.inicio_fijo],
    ["Urbano Orad 13-15", 35300, 17650, 1, true, "2026-10-05"]);
  // sin horas_previstas: tope fijo de 695 h (no depende del % de material ni de la calibración)
  assert.deepStrictEqual([u.horas_previstas, u.horas_tope_fijo, u.margen_objetivo, u.material_pct], [695, true, null, 0.27]);
  assert.ok(/tope 695 h/.test(u.estado_doc));
  // otra OO sin horas y sin tope fijado: horas para un 40 % de margen
  const otra = O.carteraOO({ obras: [{ obra_id: "OO-2026-200", nombre: "Otra 1", fase: "INICIO_OBRA", total_eur: 1210, subtotal_eur: 1000 }] }, "2026-10-03")[0];
  assert.deepStrictEqual([otra.horas_previstas, otra.margen_objetivo], [0, 0.4]);
  // como en producción: nombres distintos y sin fecha de inicio → se juntan por id, empiezan el 05/10 con tope 695 h
  const prod = O.carteraOO({ obras: [
    { obra_id: "OO-2026-142", codigo_ot: "OT0143/2026", nombre: "CPP. C/ URBANO ORAD, 13 – SEVILLA", fase: "INICIO_OBRA", subtotal_eur: "17650.00", total_eur: "19415.00", fecha_inicio: "" },
    { obra_id: "OO-2026-143", codigo_ot: "OT0144/2026", nombre: "CCPP.URBANO ORAD 15", fase: "INICIO_OBRA", subtotal_eur: "17650.00", total_eur: "19415.00", fecha_inicio: "" }] }, "2026-10-03");
  assert.strictEqual(prod.length, 1);
  assert.deepStrictEqual([prod[0].nombre, prod[0].inicio_fijo, prod[0].horas_previstas, prod[0].horas_tope_fijo, prod[0].importe_total, prod[0].importe], ["Urbano Orad 13-15", "2026-10-05", 695, true, 35300, 35300]);
  // F260049 como dos entradas de 9.707,50 € (50 % de anticipo): quedan 17.650 € pendientes…
  const conEntradas = (extra) => O.carteraOO({ obras: [
    { obra_id: "OO-2026-142", nombre: "CPP. C/ URBANO ORAD, 13 – SEVILLA", fase: "INICIO_OBRA", subtotal_eur: "17650.00", total_eur: "19415.00", entradas_cuenta_eur: 9707.5, ...extra[0] },
    { obra_id: "OO-2026-143", nombre: "CCPP.URBANO ORAD 15", fase: "INICIO_OBRA", subtotal_eur: "17650.00", total_eur: "19415.00", entradas_cuenta_eur: 9707.5, ...extra[1] }] }, "2026-10-03")[0];
  assert.strictEqual(conEntradas([{}, {}]).importe, 17650);
  // …también si ARA·OS ya emparejó F260049 (19.415 €) con una de las dos OO: no se cuenta dos veces
  assert.strictEqual(conEntradas([{ cobrado_eur: 19415 }, {}]).importe, 17650);
  assert.strictEqual(conEntradas([{ cobrado_eur: 19415, entradas_cuenta_eur: 0 }, { entradas_cuenta_eur: 0 }]).importe, 17650);
  assert.ok(/50 % cobrado/.test(u.estado_doc) && /sin horas ni material previstos/.test(u.estado_doc) && u.sin_prevision);
  assert.deepStrictEqual(u.codigos_ot, ["OT0143/2026", "OT0144/2026"]);   // dos OT, una obra
  // con el presupuesto completo (horas y material previstos) se usan esos datos
  const oo2 = { obras: oo.obras.map((o) => ({ ...o, horas_previstas: 347.5, material_previsto_eur: 4750 })) };
  const u2 = O.carteraOO(oo2, "2026-10-03")[0];
  assert.deepStrictEqual([u2.horas_previstas, u2.horas_tope_fijo, u2.material_previsto, u2.margen_objetivo, u2.sin_prevision], [695, false, 9500, null, false]);
  // cuando JM rellena las horas, mandan las suyas
  const u3 = O.carteraOO({ obras: oo.obras.map((o) => ({ ...o, horas_previstas: 300 })) }, "2026-10-03")[0];
  assert.deepStrictEqual([u3.horas_previstas, u3.horas_tope_fijo], [600, false]);
}
// Material previsto de cada obra: columna material_previsto de la hoja de comunidades
{
  const fila = Array(67).fill(""); fila[0] = "Tordo 18"; fila[1] = "Tordo 18"; fila[15] = "09_TRAMITADA"; fila[25] = 2259.99;
  const [t] = O.ordenarCartera([{ obra_id: O.ccppId("Tordo 18"), nombre: "Tordo 18", fase: "09_TRAMITADA" }], [fila], HOY);
  assert.strictEqual(t.material_previsto, 2259.99);
}
// «Facturada» / «Factura pendiente» del panel de Guillermo → facturada (el cobro ya está en las facturas o en el banco)
{
  const fila = (n, col, v) => { const r = Array(67).fill(""); r[0] = n; r[1] = n; r[15] = "09_TRAMITADA"; if (col) r[col] = v; return r; };
  const ob = (n) => ({ obra_id: O.ccppId(n), nombre: n, fase: "09_TRAMITADA" });
  const res2 = O.ordenarCartera([ob("Betis 20"), ob("Juan Pablos 17"), ob("La Paz 29")], [fila("Betis 20", 56, "2026-09-01"), fila("Juan Pablos 17", 59, "2026-09-20"), fila("La Paz 29")], HOY);
  const x = (n) => res2.find((o) => o.nombre === n);
  assert.deepStrictEqual([x("Betis 20").facturada, x("Betis 20").cobrada, x("Juan Pablos 17").facturada, x("Juan Pablos 17").cobrada, x("La Paz 29").facturada], [true, true, true, false, false]);
  assert.deepStrictEqual([x("Betis 20").estado_doc, x("Juan Pablos 17").estado_doc, x("La Paz 29").estado_doc], ["Facturada", "Factura pendiente", "Tramitada"]);
}
// Cobradas confirmadas por Alberto: cobrada entera (también por config_dinero «obras_cobradas»)
{
  const r = O.completarCartera([{ obra_id: "a", nombre: "Doctores González Meneses 10", fase: "06_VISITA_EMASESA" }, { obra_id: "b", nombre: "Betis 20" }, { obra_id: "c", nombre: "Otra 1" }, { obra_id: "d", nombre: "Otra 2" }], { hoy: HOY, cobradas: ["Otra 2"] });
  assert.deepStrictEqual(r.map((o) => !!o.cobrada), [true, true, false, true]);
}
// Planificación a mano: manda la última fila de cada obra; «TODAS» vuelve al orden automático
{
  const filas = [
    { obra_id: "a", posicion: "3", nota: "x", usuario: "JM", fecha: "2026-10-03T10:00:00Z" },
    { obra_id: "a", posicion: "1", cuadrilla: "2", nota: "y", usuario: "Alberto", fecha: "2026-10-03T11:00:00Z" },
    { obra_id: "b", fecha_inicio_fija: "2026-11-02", nota: "z", usuario: "JM", fecha: "2026-10-03T09:00:00Z" },
  ];
  const v = O.planVigente(filas);
  assert.deepStrictEqual([v.a.posicion, v.a.cuadrilla, v.a.usuario, v.b.fecha_inicio_fija], [1, 2, "Alberto", "2026-11-02"]);
  const ap = O.aplicarPlanificacion([{ obra_id: "a" }, { obra_id: "b" }, { obra_id: "c" }], filas);
  assert.deepStrictEqual([ap[0].posicion, ap[0].cuadrilla, ap[1].inicio_fijo, ap[1].inicio_manual, ap[2].plan], [1, 2, "2026-11-02", true, undefined]);
  assert.deepStrictEqual(O.planVigente([...filas, { obra_id: "TODAS", nota: "reset", usuario: "Alberto", fecha: "2026-10-03T12:00:00Z" }]), {});
  assert.deepStrictEqual(Object.keys(O.planVigente([...filas, { obra_id: "CUADRILLAS", cuadrilla: "2,3", nota: "x", usuario: "JM", fecha: "2026-10-03T12:00:00Z" }])).sort(), ["a", "b"]);
  assert.deepStrictEqual(Object.keys(O.planVigente([...filas, { obra_id: "a", nota: "quitar", usuario: "JM", fecha: "2026-10-03T12:00:00Z" }])), ["b"]);
  assert.ok(O.validarCambioPlan({ obra_id: "a", posicion: 1, usuario: "JM" }).includes("la nota es obligatoria"));
  assert.deepStrictEqual(O.validarCambioPlan({ obra_id: "a", posicion: 1, usuario: "JM", nota: "adelanto por junta" }), []);
}
console.log("OK orden-cartera.test");

// Limpieza 04/10/2026: obras privadas en ejecución sin importe ni horas (San Juan Bosco 6, Oficina…)
// entran en la cartera, empezadas, ocupando una semana con aviso «sin horas previstas»
{
  const O2 = require("./orden-cartera.cjs");
  const c = O2.completarCartera([], { oo: { obras: [{ obra_id: "OO-9", nombre: "San Juan Bosco 6", fase: "EN_EJECUCION" }] }, hoy: "2026-10-04" });
  const sj = c.find((o) => o.obra_id === "OO-9");
  require("assert").deepStrictEqual([!!sj, sj.empezada, sj.horas_previstas, sj.sin_horas_previstas, sj.horas_supuestas, sj.importe_total], [true, "2026-10-04", 77, true, true, 0]);
}
// con horas registradas (registros_tiempo): las cuenta, sigue ocupando una semana más y dice el último día
{
  const O2 = require("./orden-cartera.cjs");
  const c = O2.completarCartera([], { oo: { obras: [{ obra_id: "OO-9", nombre: "San Juan Bosco 6", fase: "EN_EJECUCION", fecha_inicio: "2026-07-15", horas_registradas_rt: 120, ultima_hora: "2026-10-02" }] }, hoy: "2026-10-04" });
  const sj = c.find((o) => o.obra_id === "OO-9");
  require("assert").deepStrictEqual([sj.horas_registradas, sj.horas_previstas, sj.oo_en_ejecucion, sj.ultima_hora, sj.inicio_hoja], [120, 197, true, "2026-10-02", "2026-07-15"]);
}
// Urbano Orad 13 y 15 (05/10/2026): con las horas de los presupuestos (320 + 320) manda la suma, no el
// tope de 695 h; el grupo se reconoce también por código de OT aunque cambie el id
{
  const O2 = require("./orden-cartera.cjs");
  const fila = (id, ot, nombre) => ({ obra_id: id, codigo_ot: ot, nombre, fase: "INICIO_OBRA", subtotal_eur: "17650", total_eur: "21356.5", horas_previstas: "320", material_previsto_eur: "2500" });
  const c = O2.completarCartera([], { oo: { obras: [fila("OO-2026-150", "OT0143", "CPP. C/ URBANO ORAD, 13 – SEVILLA"), fila("OO-2026-151", "OT0144", "CCPP.URBANO ORAD 15")] }, hoy: "2026-10-05" });
  const u = c.filter((o) => o.tipo === "OO");
  require("assert").strictEqual(u.length, 1);
  require("assert").deepStrictEqual([u[0].nombre, u[0].horas_previstas, u[0].sin_horas_previstas, u[0].horas_tope_fijo], ["Urbano Orad 13-15", 640, false, false]);
}
console.log("OK orden-cartera (Urbano Orad con las horas de los presupuestos)");
