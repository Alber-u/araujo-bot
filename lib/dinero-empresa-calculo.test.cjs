// Test de la escalera con datos INVENTADOS (los reales viven en Holded y en
// las hojas). Uso: node lib/dinero-empresa-calculo.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");

const HOY = "2026-09-29";            // martes
const AHORA = "2026-09-29T10:00:00Z";
const ok = (data, extra = {}) => ({ ok: true, data, ...extra });

function fuentes() {
  return {
    tesoreria: ok({ total_eur: 1000, cuentas: [{ nombre: "Banco", saldo: 1000 }], pleo: { saldo: 50 } }),
    clientes: ok({
      ok: true, generado: AHORA, total: 400, por_tramo: { "0-30": 300, "+90": 100 },
      clientes: [{ nombre: "Cliente A", saldo: 300, tramo: "0-30" }, { nombre: "Cliente B", saldo: 100, tramo: "+90" }],
      balance: { credito_instalaciones_54200001: 900 },
      patrimonio: { ajustes: [{ id: "deterioro-instalaciones", importe: -800 }] },
      local13: { pendiente: 200 },
      saldos_por_cuenta: {
        "43000001": 400, "56000001": -20, "43800000": -110, "40000001": -70, "41000001": -5,
        "46500000": 0, "47600000": 0, "54200000": -30, "57200007": 0,
      },
    }),
    custodias: ok({ totales: { en_custodia: 600 } }),
    obligaciones: ok({
      generado: AHORA,
      resumen: { deuda_total: 90 },
      expedientes: [{ concepto: "Aplazamiento", pendiente: 90, tipo: "aplazamiento" }],
      periodicos: [
        { modelo: "111", periodo: "3T 2026", devengado_trimestre: 12, arrastre: 3 },
        { modelo: "303", periodo: "3T 2026", devengado_trimestre: 19 },
      ],
      recurrentes: [{ organismo: "TGSS", ultimos: [{ fecha: "2026-08-31", importe: 40 }] }],
    }),
    ot: ok({ grupos: {
      "12_INICIO_OBRA": [{ comunidad: "Calle Uno 1", ccpp_id: "ccpp_uno", pto_total: 100 }],
      "13_EN_EJECUCION": [{ comunidad: "Calle Dos 2", ccpp_id: "ccpp_dos", pto_total: 200 }],
      "17_COBRO_EMASESA": [
        { comunidad: "Estrella 4", ccpp_id: "ccpp_est", pto_total: 300 },          // facturada y cobrada, sin ligar
        { comunidad: "Luna 7", ccpp_id: "ccpp_luna", pto_total: 1000 },            // solo una factura de extras
      ],
      "18_COBRADA": [{ comunidad: "No cuenta 9", ccpp_id: "x", pto_total: 999 }],
    } }),
    oo: ok({ obras: [
      { obra_id: "OO1", nombre: "Bajante Sol 3", fase: "FINALIZADA", subtotal_eur: "200", iva_eur: "42", total_eur: "242" },
      { obra_id: "OO2", nombre: "Luna 7 extras", fase: "FINALIZADA", subtotal_eur: "", iva_eur: "", total_eur: "121" },   // sin base → 21 %
      { obra_id: "OO3", nombre: "Avería Mar 1", fase: "FINALIZADA", subtotal_eur: "100", total_eur: "121", entradas_cuenta_eur: 60.5 }, // media cobrada
      { obra_id: "OO4", nombre: "Ya facturada", fase: "FINALIZADA", subtotal_eur: "500", total_eur: "605", tiene_factura_emitida: true },
      { obra_id: "OO5", nombre: "Cobrada", fase: "FINALIZADA", subtotal_eur: "500", total_eur: "605", cobrada: "TRUE" },
      { obra_id: "OO6", nombre: "En curso", fase: "EN_EJECUCION", subtotal_eur: "500", total_eur: "605" },
    ] }),
    iva: ok({ iva_resultado: 25, iva_repercutido: 40, iva_soportado: 15, periodo_inicio: "2026-07-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "i1", numero: "F1", cliente: "CCPP CL.ESTRELLA 4", subtotal: 300, estado_logico: "cobrada", tags: [] },
      { id: "i2", numero: "F2", cliente: "C.C.P.P. LUNA 7 EXTRAS", subtotal: 50, estado_logico: "emitida_pdte", tags: [] },
    ]),
    tags: ok({}),
    prestamos: ok([
      { id: "c1", tipo: "concedido", principal: 30, periodicidad: "ninguna", cuenta_holded: "54200000" },
      { id: "r1", tipo: "recibido", principal: 60, periodicidad: "ninguna", cuenta_holded: "54200000" },
      { id: "r2", tipo: "recibido", cuotas_detalle: "2026-10-15:10;2026-11-15:10" },
    ]),
    config: ok([{ clave: "nomina_neta_mensual", valor: "80" }, { clave: "poliza_dispuesta", valor: "0" }]),
    banco: ok([
      { fecha: "2026-09-28", descripcion: "TRANSFERENCIA NOMINA SEPTIEMBRE", salida: 20 },
      { fecha: "2026-09-10", descripcion: "COBRO CLIENTE", salida: -100 },
    ]),
    nominas465: ok([]),
    rentab: {
      ccpp_uno: ok({ previsto: { mano_obra_previsto: 30, material_previsto: 20 }, real: { mano_obra_real: 10, material_real: 25 } }),
      ccpp_dos: ok({ previsto: { mano_obra_previsto: 0, material_previsto: 0 }, real: {} }),
    },
  };
}

const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);

// ── todo bien ────────────────────────────────────────────────
const r = C.calcularEscalera(fuentes(), HOY, AHORA);
assert.strictEqual(r.completo, true, JSON.stringify(r.faltan));
assert.strictEqual(L(r, "T1").importe, 1000);
assert.strictEqual(L(r, "T2").importe, 50);
assert.strictEqual(L(r, "T3").importe, 400);
// T4: Uno 100 + Dos 200 + Luna (1000 − 50 de extras) = 1250; Estrella fuera (facturada)
assert.strictEqual(L(r, "T4").importe, 1250);
assert.ok(r.avisos.some((a) => /Estrella 4.*cobrada/.test(a.texto)));
assert.ok(r.avisos.some((a) => /Luna 7.*por debajo del presupuesto/.test(a.texto)));
assert.strictEqual(L(r, "T5").importe, 30);
assert.strictEqual(L(r, "D1").importe, 600);
assert.strictEqual(L(r, "D2").importe, 20);
assert.strictEqual(L(r, "D3").importe, 90);
assert.strictEqual(L(r, "D4").importe, 25);
assert.strictEqual(L(r, "D5").importe, 10);            // 110 × 10/110
assert.strictEqual(L(r, "D6").importe, 75);
assert.strictEqual(L(r, "D7").importe, 80);            // config: nómina del mes aún sin 465
assert.strictEqual(L(r, "T4b").importe, 350);          // 200 + 100 (121/1,21) + 50 (mitad cobrada)
assert.ok(r.avisos.some((a) => /Posible duplicado: «Luna 7 extras».*«Luna 7»/.test(a.texto)));
assert.strictEqual(L(r, "D8").importe, 80);            // agosto sin cargar en sept → 2 × 40
assert.strictEqual(L(r, "D9").importe, 15);
assert.strictEqual(L(r, "D10").importe, 80);           // 60 + 20
assert.strictEqual(L(r, "D11").importe, 20);           // max(0,30−10) + max(0,20−25)
assert.strictEqual(L(r, "D12").importe, 0);
assert.strictEqual(L(r, "D12").fiabilidad, "estimado");
// 54200000: +30 − 60 = −30 → cuadra
assert.strictEqual(L(r, "D10").contraste.porCuenta[0].cuadra, true);
assert.deepStrictEqual(L(r, "D10").contraste.sinContrastar, ["r2"]);

const tengo = 1000 + 50 + 400 + 1250 + 350 + 30;
const debo = 600 + 20 + 90 + 25 + 10 + 75 + 80 + 80 + 15 + 80 + 20 + 0;
assert.strictEqual(r.kpis.total_tengo, tengo);
assert.strictEqual(r.kpis.total_debo, debo);
assert.strictEqual(r.kpis.tu_dinero_hoy, 1000 + 50 - 600);
assert.strictEqual(r.kpis.mio_hoy, 1000 + 50 - 600 - 20);
assert.strictEqual(r.kpis.si_pagas_todo_hoy, 450 - (debo - 600));
assert.strictEqual(r.kpis.dinero_empresa_antes_is, tengo - debo);
assert.strictEqual(r.kpis.dinero_empresa_prudente, tengo - debo - 100);
assert.strictEqual(r.debo[r.debo.length - 1].acumulado, tengo - debo);
assert.strictEqual(r.frescura.banco_desactualizado, false);  // 28/09 = día laborable anterior
assert.strictEqual(r.prestamos.cuotas_30_dias, 10);

// ── fuentes caídas: nunca 0, siempre INCOMPLETO ────────────────
const f2 = fuentes();
f2.obligaciones = { ok: false, error: "timeout" };
f2.tesoreria = { ok: false, error: "Holded 500" };
f2.config = ok([]);
const r2 = C.calcularEscalera(f2, HOY, AHORA);
assert.strictEqual(r2.completo, false);
for (const id of ["T1", "T2", "D3", "D9", "D12"]) {
  assert.strictEqual(L(r2, id).importe, null, id);
  assert.strictEqual(L(r2, id).fiabilidad, "sin_dato", id);
}
assert.strictEqual(r2.kpis.tu_dinero_hoy, null);
assert.ok(r2.avisos[0].nivel === "rojo" && /INCOMPLETAS/.test(r2.avisos[0].texto));

// ── D7: nómina del mes ya en la 465 → saldo de la 465 (0 si pagada) ──
const f4 = fuentes();
f4.nominas465 = ok([{ fecha: "2026-09-26", descripcion: "Nómina septiembre", haber: 70, debe: 0 }, { fecha: "2026-09-28", descripcion: "Pago", haber: 0, debe: 70 }]);
assert.strictEqual(L(C.calcularEscalera(f4, HOY, AHORA), "D7").importe, 0);
f4.clientes.data.saldos_por_cuenta["46500000"] = -15;
assert.strictEqual(L(C.calcularEscalera(f4, HOY, AHORA), "D7").importe, 15);
assert.strictEqual(L(C.calcularEscalera(f4, HOY, AHORA), "D7").fiabilidad, "exacto");

// ── banco sin movimientos recientes ──────────────────────────
const f3 = fuentes();
f3.banco = ok([{ fecha: "2026-09-24", descripcion: "x", salida: 1 }]);
const r3 = C.calcularEscalera(f3, HOY, AHORA);
assert.strictEqual(r3.frescura.banco_desactualizado, true);
assert.ok(r3.avisos.some((a) => /Banco sin sincronizar desde 24\/09/.test(a.texto)));

// ── utilidades ───────────────────────────────────────────────
assert.strictEqual(C.normNombre("CCPP CL.ESTRELLA 4"), C.normNombre("Estrella 4"));
assert.strictEqual(C.normNombre("COMUNIDAD DE PROPIETARIOS Palma del Río 12"), "palmadelrio12");
assert.deepStrictEqual(C.periodoIvaSinLiquidar("2026-09-29"), { desde: "2026-07-01", hasta: "2026-09-29" });
assert.deepStrictEqual(C.periodoIvaSinLiquidar("2026-10-05"), { desde: "2026-07-01", hasta: "2026-10-05" });
assert.deepStrictEqual(C.periodoIvaSinLiquidar("2026-10-21"), { desde: "2026-10-01", hasta: "2026-10-21" });
assert.deepStrictEqual(C.periodoIvaSinLiquidar("2027-01-15"), { desde: "2026-10-01", hasta: "2027-01-15" });

console.log("OK dinero-empresa-calculo.test");
