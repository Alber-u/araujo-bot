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
        { comunidad: "Estrella 4", ccpp_id: "ccpp_est", pto_total: 300 },          // facturada y cobrada, ligada por etiqueta
        { comunidad: "Luna 7", ccpp_id: "ccpp_luna", pto_total: 1000 },            // facturas solo por nombre: no restan
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
      { obra_id: "OO7", nombre: "Luna 7 extras B", fase: "FACTURADA", subtotal_eur: "50", total_eur: "60.5", holded_invoice_emitida_id: "i2" },
    ] }),
    iva: ok({ iva_resultado: 25, iva_repercutido: 40, iva_soportado: 15, periodo_inicio: "2026-07-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "i1", numero: "F1", cliente: "CCPP CL.ESTRELLA 4", subtotal: 300, estado_logico: "cobrada", tags: ["Estrella4"] },
      { id: "i2", numero: "F2", cliente: "C.C.P.P. LUNA 7 EXTRAS", subtotal: 50, estado_logico: "emitida_pdte", tags: [] }, // ligada a OO7
      { id: "i3", numero: "F3", cliente: "Comunidad Luna 7", subtotal: 999, estado_logico: "cobrada", tags: [] },        // solo por nombre
    ]),
    tags: ok({ ccpp_est: ["estrella4"] }),
    prestamos: ok([
      { id: "c1", tipo: "concedido", principal: 30, periodicidad: "ninguna", cuenta_holded: "54200000" },
      { id: "r1", tipo: "recibido", principal: 60, periodicidad: "ninguna", cuenta_holded: "54200000" },
      { id: "r2", tipo: "recibido", cuotas_detalle: "2026-10-15:10;2026-11-15:10" },
    ]),
    config: ok([{ clave: "nomina_neta_mensual", valor: "80" }, { clave: "poliza_dispuesta", valor: "0" }]),
    banco: ok([
      { fecha: "2026-09-28", descripcion: "TRANSFERENCIA NOMINA SEPTIEMBRE", salida: 20 },
      { fecha: "2026-08-31", descripcion: "RECIBO TGSS COTIZACION 001", salida: 40 },      // cotización de julio
      { fecha: "2026-09-13", descripcion: "RECIBO TGSS", salida: 15.5 },                   // aplazamiento: no es cotización
      { fecha: "2026-09-10", descripcion: "COBRO CLIENTE", salida: -100 },
    ]),
    nominas465: ok([{ fecha: "2026-09-03", descripcion: "Pago nómina agosto", haber: 0, debe: 70 }]),  // agosto, no cuenta
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
// T4: Uno 100 + Dos 200 + Luna 1000 (F3 solo por nombre: aviso, no resta; F2 es de OO7) = 1300
//     Estrella fuera: su factura está ligada por etiqueta y cobrada
assert.strictEqual(L(r, "T4").importe, 1300);
assert.ok(r.avisos.some((a) => /Estrella 4.*cobrada/.test(a.texto)));
assert.ok(r.avisos.some((a) => /Luna 7: hay factura\(s\).*F3.*No se restan/.test(a.texto)));
assert.ok(!r.avisos.some((a) => /Luna 7: hay factura\(s\).*F2/.test(a.texto)));   // la de OO7 ni se mira
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
assert.strictEqual(L(r, "D8").importe, 80);            // recibo de agosto sin cargar en sept → 2 × 40 (no 15,5)
assert.ok(r.avisos.some((a) => /no son el recibo de cotizaciones.*15\.5/.test(a.texto)));
assert.strictEqual(L(r, "D9").importe, 15);
assert.strictEqual(L(r, "D10").importe, 80);           // 60 + 20
assert.strictEqual(L(r, "D11").importe, 20);           // max(0,30−10) + max(0,20−25)
assert.strictEqual(L(r, "D12").importe, 0);
assert.strictEqual(L(r, "D12").fiabilidad, "estimado");
// 54200000: +30 − 60 = −30 → cuadra
assert.strictEqual(L(r, "D10").contraste.porCuenta[0].cuadra, true);
assert.deepStrictEqual(L(r, "D10").contraste.sinContrastar, ["r2"]);

const tengo = 1000 + 50 + 400 + 1300 + 350 + 30;
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

// ── hojas vacías: sin dato e INCOMPLETO, nunca 0 exacto ───────
const f5 = fuentes();
f5.prestamos = ok([]);
f5.config = ok([]);
const r5 = C.calcularEscalera(f5, HOY, AHORA);
for (const id of ["T5", "D10", "D7", "D12"]) {
  assert.strictEqual(L(r5, id).importe, null, id);
  assert.ok(r5.faltan.includes(id), id);
}
assert.strictEqual(r5.completo, false);
// solo recibidos → T5 sin dato, D10 con dato
const f6 = fuentes();
f6.prestamos = ok([{ id: "r1", tipo: "recibido", principal: 60, periodicidad: "ninguna" }]);
const r6 = C.calcularEscalera(f6, HOY, AHORA);
assert.strictEqual(L(r6, "T5").importe, null);
assert.strictEqual(L(r6, "D10").importe, 60);

// ── periodo de la nómina ──────────────────────────────────────
assert.strictEqual(C.periodoNomina({ fecha: "2026-09-03", descripcion: "Pago nómina agosto", haber: 0, debe: 70 }), "2026-08");
assert.strictEqual(C.periodoNomina({ fecha: "2026-01-05", descripcion: "NOMINA DICIEMBRE", haber: 0, debe: 70 }), "2025-12");
assert.strictEqual(C.periodoNomina({ fecha: "2026-09-30", descripcion: "Nóminas 09/2026", haber: 70, debe: 0 }), "2026-09");
assert.strictEqual(C.periodoNomina({ fecha: "2026-09-30", descripcion: "Remuneraciones", haber: 70, debe: 0 }), "2026-09");
assert.strictEqual(C.periodoNomina({ fecha: "2026-09-03", descripcion: "Transferencia", haber: 0, debe: 70 }), null);

// ── recibo TGSS del día 1 (festivo) = el que venció el mes anterior ──
const f7 = fuentes();
f7.banco = ok([{ fecha: "2026-10-01", descripcion: "SEGUROS SOCIALES", salida: 40 }, { fecha: "2026-10-14", descripcion: "OTRO", salida: 1 }]);
const r7 = C.calcularEscalera(f7, "2026-10-15", "2026-10-15T10:00:00Z");
assert.strictEqual(L(r7, "D8").importe, 80);   // septiembre (vence fin de octubre) + octubre

// ── D8 por concepto del banco (regla principal) ───────────────
const f8 = fuentes();
f8.banco = ok([
  { fecha: "2026-08-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 52 },
  { fecha: "2026-07-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 49 },
  { fecha: "2026-09-29", descripcion: "RECIBO TGSS", salida: 15 },            // día 29 pero sin COTIZACION → no es el recibo
]);
const r8 = C.calcularEscalera(f8, HOY, AHORA);
assert.strictEqual(L(r8, "D8").importe, 104);   // agosto (vence 30/09, sin cargar) + septiembre, a 52
assert.ok(!L(r8, "D8").nota);
assert.ok(r8.avisos.some((a) => /no son el recibo de cotizaciones.*15/.test(a.texto)));
// con el recibo de agosto ya cargado el 30/09 → solo el mes en curso
f8.banco.data.push({ fecha: "2026-09-30", descripcion: "RECIBO TGSS. COTIZACIÓN 001 RÉGIMEN GENERAL", salida: 53 });
assert.strictEqual(L(C.calcularEscalera(f8, "2026-09-30", AHORA), "D8").importe, 53);
// respaldo por fecha (ningún cargo con «TGSS … COTIZACION»): se avisa en la nota
const f9 = fuentes();
f9.banco = ok([{ fecha: "2026-08-31", descripcion: "SEGUROS SOCIALES", salida: 40 }, { fecha: "2026-09-13", descripcion: "RECIBO TGSS", salida: 15.5 }]);
const r9 = C.calcularEscalera(f9, HOY, AHORA);
assert.strictEqual(L(r9, "D8").importe, 80);
assert.ok(/por el día del cargo/.test(L(r9, "D8").nota));

// ── solo movimientos bancarios, nunca asientos manuales ───────
assert.strictEqual(C.esMovimientoBancario({ tipo: "entry", descripcion: "RECIBO TGSS" }), false);
assert.strictEqual(C.esMovimientoBancario({ tipo: "", descripcion: "Regularización TGSS septiembre" }), false);
assert.strictEqual(C.esMovimientoBancario({ tipo: "", descripcion: "RECL-0907 Seguridad social" }), false);
assert.strictEqual(C.esMovimientoBancario({ tipo: "bank", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL" }), true);

// ── 10.2.1 · cuadre banco / movimientos ──────────────────────
assert.strictEqual(C.cuadreBanco({ ok: false, error: "x" }).estado, "sin_comprobar");
assert.strictEqual(C.cuadreBanco({ ok: true, data: { saldo_banco: 100, saldo_movimientos: 99.5 } }).estado, "cuadra");
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 26000, saldo_movimientos: 67077.81 });
  const r = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r.provisional, true);
  assert.strictEqual(r.cuadre_banco.diferencia, -41077.81);
  assert.strictEqual(r.avisos[0].texto, "Saldo del banco y movimientos no cuadran por 41.078 €: cifras de caja y custodia provisionales.");
  assert.strictEqual(r.avisos[0].nivel, "rojo");
  assert.strictEqual(r.debo.find((l) => l.id === "D8").provisional, true);   // 10.2.3: sin cargo de TGSS en movimientos
  const sin = C.calcularEscalera(fuentes(), HOY, AHORA);
  assert.strictEqual(sin.provisional, null);
  assert.strictEqual(sin.cuadre_banco.estado, "sin_comprobar");
}

// ── descuadre histórico de la 572 (config_dinero) ─────────────
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 62415.68, saldo_movimientos: 100000 });   // total −37.584,32
  f.config.data.push({ clave: "descuadre_historico_572", valor: -28588 }, { clave: "descuadre_historico_572_fecha", valor: "2026-10-01" });
  const r = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r.cuadre_banco.diferencia_total, -37584.32);
  assert.strictEqual(r.cuadre_banco.descuadre_historico, -28588);
  assert.strictEqual(r.cuadre_banco.diferencia, -8996.32);            // la del día
  assert.strictEqual(r.provisional, true);
  assert.ok(/no cuadran por 8\.996 €/.test(r.avisos[0].texto));
  // si lo del día cuadra (±1 €), no hay aviso aunque el total no cuadre
  f.cuadre = ok({ saldo_banco: 71411.68, saldo_movimientos: 100000 });  // total −28.588,32
  const r2 = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r2.cuadre_banco.estado, "cuadra");
  assert.strictEqual(r2.provisional, false);
  assert.ok(!r2.avisos.some((a) => /no cuadran/.test(a.texto)));
  // sin la clave, como hasta ahora: el total
  const f3 = fuentes();
  f3.cuadre = ok({ saldo_banco: 71411.68, saldo_movimientos: 100000 });
  const r3 = C.calcularEscalera(f3, HOY, AHORA);
  assert.strictEqual(r3.cuadre_banco.diferencia, -28588.32);
  assert.strictEqual(r3.cuadre_banco.descuadre_historico, null);
}

// ── umbrales del cuadre y datos reales del 30/09 ─────────────
{
  const f = fuentes();
  // Producción 30/09: banco 62.415,68 · contable 126.889,10 · histórico 54.587,16 (escrito en positivo)
  f.cuadre = ok({ saldo_banco: 62415.68, saldo_movimientos: 126889.10 });
  f.config.data.push({ clave: "descuadre_historico_572", valor: 54587.16 }, { clave: "descuadre_historico_572_fecha", valor: "2026-09-30" });
  const r = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r.cuadre_banco.diferencia_total, -64473.42);
  assert.strictEqual(r.cuadre_banco.descuadre_historico, -54587.16);   // con el signo de la diferencia
  assert.strictEqual(r.cuadre_banco.diferencia, -9886.26);             // 5.072,34 sin importar + 4.813,92 de 2026
  assert.strictEqual(r.cuadre_banco.estado, "no_cuadra");
  assert.strictEqual(r.provisional, true);
  assert.strictEqual(r.cuadre_banco.actualizar_historico_a, null);
  // parte del día de 600 € → ámbar, sin provisional
  f.cuadre = ok({ saldo_banco: 62415.68, saldo_movimientos: 62415.68 + 54587.16 + 600 });
  const r2 = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r2.cuadre_banco.estado, "descuadre_menor");
  assert.strictEqual(r2.provisional, false);
  assert.ok(r2.avisos.some((a) => a.nivel === "ambar" && /difieren en 600 €/.test(a.texto)));
  assert.ok(!r2.avisos.some((a) => a.nivel === "rojo" && /no cuadran/.test(a.texto)));
  // se concilian 20.000 € antiguos: total 44.587 < 54.587 − 500 → actualizar la clave
  f.cuadre = ok({ saldo_banco: 62415.68, saldo_movimientos: 62415.68 + 44587.16 });
  const r3 = C.calcularEscalera(f, HOY, AHORA);
  assert.strictEqual(r3.cuadre_banco.actualizar_historico_a, 44587.16);
  assert.ok(r3.avisos.some((a) => /^Actualizar descuadre_historico_572 a 44587\.16/.test(a.texto)));
}

console.log("OK dinero-empresa-calculo.test");
