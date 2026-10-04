// Bloqueos de contrato y pago con el expediente de Guillermo (04/10/2026)
const assert = require("assert");
const B = require("./bloqueos-expediente.cjs");

const exp = (id, comunidad, fase, extra = {}) => ({ ccpp_id: id, comunidad, direccion: `Calle ${comunidad}`, fase, pisos: 10, terminada: false, facturada: false,
  contratos: { ok: 10, total: 10, faltan: [] }, pagos: { resueltos: 10, total: 10, pagados: 10, financiados: [], faltan: [] }, ccpp: { aplica: false }, cuadre: { ok: true }, ...extra });
const expedientes = {
  mij: exp("mij", "Mijares 3", "09_TRAMITADA"),
  luc: exp("luc", "Luceros 4", "09_TRAMITADA", { pagos: { resueltos: 32, total: 32, pagados: 27, faltan: [],
    financiados: ["1A", "1B", "2A", "2B", "3A"].map((v) => ({ vivienda: v, abonado: false })) } }),
  car: exp("car", "Ciudad de Carcagente 2", "09_TRAMITADA", { terminada: true, facturada: true, contratos: { ok: 0, total: 3, faltan: ["1A", "1B", "1C"] } }),
  paz: exp("paz", "La Paz 29", "09_TRAMITADA", { pisos: 0, contratos: { ok: 0, total: 0, faltan: [] }, pagos: { resueltos: 0, total: 0, pagados: 0, financiados: [], faltan: [] },
    ccpp: { aplica: true, contrato: true, pago: { tipo: "pagado" } } }),
  lp: exp("lp", "Tordo 18", "09_TRAMITADA", { contratos: { ok: 7, total: 7, faltan: [] }, cuadre: { ok: false, sin_contrato: [{ vivienda: "3IZDA", contrato: "vacío", pago: "OK" }] } }),
  doc: exp("doc", "Otelo 8", "05_DOCUMENTACION", { contratos: { ok: 0, total: 2, faltan: ["1A", "2A"] } }),
};
const fila = (comunidad, tipo, extra = {}) => ({ comunidad, tipo_bloqueo: tipo, severidad: "critica", accion_exacta: "Gestionar contratos y cartas de pago con administrador", detectado_en: "2026-05-09", resuelto: "no", owner: "Guillermo", ...extra });
const hoja = [
  fila("Mijares 3", "CONTRATOS_PAGOS"), fila("La Paz 29", "CONTRATOS_PAGOS"), fila("Luceros 4", "CONTRATOS_PAGOS"),
  fila("Luceros 4", "FINANCIACION", { owner_override: "José Manuel", comentario_operativo: "Sabadell dice que esta semana" }),
  fila("Luceros 4", "PAGO_PENDIENTE"),
  fila("Ciudad de Carcagente 2", "CONTRATOS_PAGOS"), fila("Ciudad de Carcagente 2", "DOC_PENDIENTE"),
  fila("Prueba", "MANUAL_GUILLERMO", { accion_exacta: "test desde curl" }),
  fila("Otelo 8", "DOC_PENDIENTE"),
];
const r = B.bloqueosConExpediente(hoja, expedientes, "2026-10-04");
const de = (c, t) => r.filter((b) => b.comunidad === c && (!t || b.tipo_bloqueo === t));
// lo que contradice el expediente desaparece
assert.deepStrictEqual([de("Mijares 3").length, de("La Paz 29").length], [0, 0]);
// terminada o facturada: sin bloqueos; la fila de prueba no se enseña
assert.deepStrictEqual([de("Ciudad de Carcagente 2").length, de("Prueba").length], [0, 0]);
// Luceros 4: el motivo real, y se conserva lo puesto a mano en la hoja
// el abono de Sabadell pendiente es «Pendiente abono Sabadell» (un solo aviso, no además «Falta pago»)
assert.deepStrictEqual(de("Luceros 4").map((b) => b.tipo_bloqueo), ["FINANCIACION"]);
const lu = de("Luceros 4", "FINANCIACION")[0];
assert.strictEqual(lu.accion_exacta, "Pendiente abono Sabadell: 5 pisos (1A, 1B, 2A y 2 más)");
assert.deepStrictEqual([lu.owner_override, lu.comentario_operativo, lu.detectado_en, lu.pelota_en, lu.vecinos_afectados], ["José Manuel", "Sabadell dice que esta semana", "2026-05-09", "financiera", "1A, 1B, 2A, 2B, 3A"]);
// la fila FINANCIACION de la hoja (docs de financiación de la inferencia) ya no se enseña sola
assert.ok(!B.bloqueosConExpediente([fila("Mijares 3", "FINANCIACION")], expedientes, "2026-10-04").some((b) => b.comunidad === "Mijares 3"));
// Tordo 18: sin fila en la hoja, sale del expediente
// (los mismos textos que «Lista para empezar» en Planificación)
assert.strictEqual(de("Tordo 18", "CONTRATOS_PAGOS")[0].accion_exacta, "No cuadran los pisos: 7 con contrato y 10 con pago (10 pisos en la hoja de pisos) · Piso 3IZDA: sin contrato (contrato vacío, pago «OK»)");
assert.deepStrictEqual(de("Tordo 18", "CONTRATOS_PAGOS")[0].vecinos_afectados, "3IZDA");
// con el cálculo del cash flow (5610 de Holded): si cubre los abonos, no hay bloqueo de pago
assert.strictEqual(B.bloqueosConExpediente(hoja, expedientes, "2026-10-04", []).filter((b) => b.comunidad === "Luceros 4").length, 0);
assert.strictEqual(B.bloqueosConExpediente(hoja, expedientes, "2026-10-04", [{ ccpp_id: "luc", viviendas: ["1A", "1B"], pisos: 2 }]).find((b) => b.comunidad === "Luceros 4").accion_exacta, "Pendiente abono Sabadell: 2 pisos (1A, 1B)");
// antes de la fase 08 no se piden contratos ni pagos: nada; los demás bloqueos se quedan
assert.deepStrictEqual(de("Otelo 8").map((b) => b.tipo_bloqueo), ["DOC_PENDIENTE"]);
// sin expediente: esas dos clases no se enseñan (la regla vieja no vale)
assert.deepStrictEqual(B.bloqueosConExpediente(hoja, null).map((b) => `${b.comunidad}|${b.tipo_bloqueo}`), ["Ciudad de Carcagente 2|DOC_PENDIENTE", "Otelo 8|DOC_PENDIENTE"]);
// sobre filas crudas de la hoja
const filas = B.filasConExpediente(hoja.map((b) => B.COLS_BLOQUEO.map((k) => b[k] ?? "")), expedientes, "2026-10-04");
assert.ok(filas.every((f) => f.length === B.COLS_BLOQUEO.length) && filas.some((f) => f[0] === "Luceros 4"));
console.log("OK bloqueos-expediente.test");
