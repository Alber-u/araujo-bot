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
assert.ok(/En ejecución · 2 hito/.test(por("Obra 09 B").estado_doc));
// Sin fila en la hoja: se queda por fase y lo dice
const sin = O.ordenarCartera([{ obra_id: "x", nombre: "Huérfana", fase: "07_PTE_CYCP" }], [], HOY);
assert.strictEqual(sin[0].estado_doc, "sin datos de documentación");
// El simulador respeta orden y pasos
const S = require("./simulador-caja.cjs");
const conH = res.map((o) => ({ ...o, importe: 10000, horas_previstas: 100, horas_registradas: 0 }));
const sim = S.simular({ obras: conH, historico: { fijos: { operarios: 12734 } }, hoy: HOY, mandos: { horas: 800, desvio: 0, mat: 27, tram: 1, equipos: 1 } });
assert.deepStrictEqual(sim.prog.map((p) => p.nombre), res.map((o) => o.nombre));
assert.strictEqual(sim.prog.find((p) => p.nombre === "Obra 05 pocas").pasos, 4);
assert.ok(sim.prog.find((p) => p.nombre === "Obra 06 atascada").estado_doc.includes("atascada"));
console.log("OK orden-cartera.test");
