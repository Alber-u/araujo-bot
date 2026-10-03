// Test del simulador de escenarios (sin red). El caso de cartera es el mismo
// que el de ara-os/src/lib/simuladorCaja.test.js: los dos tienen que dar igual.
// Uso: node lib/simulador-caja.test.cjs
const assert = require("assert");
const S = require("./simulador-caja.cjs");

// Cartera del prototipo: 549.375 € con 7.860 h previstas → 69,9 €/h
const OBRAS = [
  { nombre: "A", fase: "09_TRAMITADA", importe: 300000, horas_previstas: 4292, horas_registradas: 0 },
  { nombre: "B", fase: "07_PTE_CYCP", importe: 249375, horas_previstas: 3568, horas_registradas: 0 },
];
const c = S.cartera(OBRAS);
assert.strictEqual(c.pendiente, 549375);
assert.strictEqual(c.eur_hora_prevista, 69.9);
// Una empezada solo cuenta lo que le falta
assert.strictEqual(S.cartera([{ importe: 1000, horas_previstas: 100, horas_registradas: 75 }]).pendiente, 250);

const HIST = { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2 };
// Como septiembre: 800 h, +18 % → 800 / 1,18 × 69,9 = 47.390 €/mes
const sim = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { horas: 800, desvio: 18, extra: 0, mat: 27, nueva: 0 } });
assert.strictEqual(Math.round(sim.prodMax), 47390);
assert.strictEqual(sim.produccion["2026-10"], Math.round(sim.prodMax * 100) / 100);       // desde el día 1: el mes entero
assert.strictEqual(sim.mesesCartera, 12);                                                  // 549.375 / 47.390 → 12 meses
// Lo de octubre se cobra el 20/12 y el material de octubre se paga el 15/01
assert.ok(sim.movs.some((m) => m.fila === "sim_cobros" && m.fecha === "2026-12-20" && m.importe === sim.produccion["2026-10"]));
assert.ok(sim.movs.some((m) => m.fila === "sim_material" && m.fecha === "2027-01-15"));
// Beneficio del mes: (1 − 27 %) × 47.390 − 12.734 = 21.861; −20 % → 17.489; − 2.066 − 3.057 = 12.365
assert.strictEqual(Math.round(sim.beneficio["2026-11"]), 12365);
// +1 operario: +160 h y 2.800 €/mes
const op = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { horas: 800, desvio: 18, extra: 1, mat: 27, nueva: 0 } });
assert.strictEqual(Math.round(op.prodMax), Math.round(960 / 1.18 * 69.9));
assert.ok(op.movs.some((m) => m.fila === "sim_operarios" && m.importe === 2800));
// Mes en curso a medias: el 16/10 quedan 16 días de 31
const med = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-16", mandos: { horas: 800, desvio: 18, mat: 27 } });
assert.strictEqual(Math.round(med.produccion["2026-10"]), Math.round(sim.prodMax * 16 / 31));

// Calibración «Real (automático)»
const pnr = { ok: true, data: { año: 2026, mes: 9, total_horas_mo: 760, ingreso_mes_eur: 44840, gastos_materiales_eur: 12107, coste_mo_eur: 12734, coste_mo_fuente: "nomina",
  nomina_indirectos_eur: 2066, costes_generales_eur: 3057, obras: [
    ...OBRAS,
    { nombre: "T1", fase: "18_COBRADA", fecha_fin: "2026-08-10", importe: 15000, materiales_eur: 4000, horas_previstas: 200, horas_registradas: 290 },
    { nombre: "T2", fase: "17_COBRO_EMASESA", fecha_fin: "2026-09-20", importe: 10000, materiales_eur: 2800, horas_previstas: 100, horas_registradas: 145 },
    { nombre: "Vieja", fase: "18_COBRADA", fecha_fin: "2025-11-01", importe: 9000, materiales_eur: 1000, horas_previstas: 100, horas_registradas: 100 },
  ] } };
const anual = { ok: true, data: { año: 2026, por_mes: [{ mes: 7, horas_obra: 700 }, { mes: 8, horas_obra: 720 }, { mes: 9, horas_obra: 760 }, { mes: 10, sin_datos: true }] } };
const cal = S.calibrar({ pnr, anual, hoy: "2026-10-03", fotoFresca: true });
assert.strictEqual(cal.mandos.horas, 727);                                  // (700 + 720 + 760) / 3
assert.strictEqual(cal.mandos.desvio, 45);                                  // 435 / 300 − 1 (solo las de los 6 últimos meses)
assert.strictEqual(cal.mandos.mat, 27);                                     // 6.800 / 25.000
assert.strictEqual(cal.mandos.eurH, 69.9);
assert.ok(/2 obras terminadas en 6 meses/.test(cal.calibracion.find((x) => x.mando === "desvio").texto));
assert.strictEqual(cal.calibracion.find((x) => x.mando === "fijos").fiabilidad, "exacto");
assert.ok(S.calibrar({ pnr, anual, hoy: "2026-10-03", fotoFresca: false }).calibracion.some((x) => x.mando === "caja" && x.fiabilidad === "estimado"));

// Serie mensual: conocidos (13 semanas) + recurrentes después + simulado
const cf = {
  hoy: "2026-10-01", inicial: { propio: 1000 },
  semanas: [{ hasta: "2026-12-27", movs: [{ fila: "proveedores", fecha: "2026-10-10", importe: 100 }] }],
  meses: [{ mes: "2027-07", movs: [{ fila: "is_2026", fecha: "2027-07-25", importe: 5000 }] }],
  recurrentes_movs: [{ fila: "seguridad_social", fecha: "2026-12-31", importe: 50 }, { fila: "nominas", fecha: "2027-01-03", importe: 70 }],
  is_2026: { fecha: "2027-07-25" },
};
const serie = S.serieMensual(cf, { movs: [{ fila: "sim_cobros", fecha: "2026-12-20", importe: 300, entra: true }], produccion: {}, beneficio: {} });
const v = (m) => serie.meses.find((x) => x.mes === m);
assert.strictEqual(v("2026-10").saldo, 900);
assert.strictEqual(v("2026-12").saldo, 900 + 300 - 50);                      // la TGSS del 31/12, tras la semana 13
assert.strictEqual(v("2027-07").saldo, 1150 - 70 - 5000);
// IS a mano en el simulador: sustituye al del backend
const serie2 = S.serieMensual(cf, { movs: [], produccion: {}, beneficio: {} }, { is2026: 2000 });
assert.strictEqual(serie2.meses.find((x) => x.mes === "2027-07").sale, 2000);
console.log("OK simulador-caja.test");
