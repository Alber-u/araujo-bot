// 06/10/2026 · Mi panel › Empresa con los datos de producción de ese día (18:36 UTC):
//   1 · «mío hoy» con su desglose: banco 77.361 − custodia 62.613 − señales 1.862 + Pleo 743
//   2 · la sincronización del banco es la de la ES81 (12:18 UTC), no la de otra cuenta, y T1 lleva esa fecha
//   3 · la remesa de EMASESA (JP17 26.995,20 + Palma del Río 11.200,72) ya está en el saldo del banco y sin importar:
//       sale de T3 (cobrada en banco, pendiente de conciliar), aviso ámbar; si no casa, aviso rojo y T3 igual.
//       Prueba en producción (19:15 UTC): el banco iba 35.346 € por delante (3.675 € de cargos de hoy sin importar)
//       y casaba con facturas sueltas de 2024; ahora solo obras en fase 17 con su día de remesa ya llegado.
//   4 · Urbano Orad 13-15 con su coste pendiente en D11 y sin comisión en D14 (no es Plan 5)
// Uso: node lib/dinero-empresa-06-10.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");

const HOY = "2026-10-06";
const AHORA = "2026-10-06T18:36:00Z";
const ok = (data) => ({ ok: true, data });
const ORAD = "OO-2026-142+OO-2026-143";

function fuentes() {
  return {
    tesoreria: ok({
      total_eur: 77360.96,
      cuentas: [
        { nombre: "Santander ES81", cuenta: "57200001", saldo: 77360.96, ultima_sincronizacion: "2026-10-06T12:18" },
        { nombre: "Santander 2", cuenta: "57200006", saldo: 0, ultima_sincronizacion: "2026-10-05T09:10" },   // la que se queda atrás
      ],
      pleo: { nombre: "Pleo", cuenta: null, saldo: 0 },
    }),
    clientes: ok({
      ok: true, generado: AHORA, total: 57644.93, por_tramo: { "0-30": 57644.93 },
      clientes: [
        { nombre: "CCPP JUAN PABLOS 17", saldo: 26995.20, tramo: "0-30" },
        { nombre: "CDAD PROP PALMA DEL RIO 4", saldo: 11200.72, tramo: "0-30" },
        { nombre: "CCPP EDUARDO DATO 44", saldo: 6892.45, tramo: "+90" },
        { nombre: "Puerto Piqueras", saldo: 1406.87, tramo: "+90" },
        { nombre: "CCPP DIEGO PUERTA 1", saldo: 620.40, tramo: "0-30" },
        { nombre: "Cliente privado", saldo: 10529.29, tramo: "0-30" },
      ], balance: {}, local13: { pendiente: 0 },
      saldos_por_cuenta: { "56000001": -1862 },
    }),
    custodias: ok({ totales: { en_custodia: 62613 } }),
    obligaciones: ok({ generado: AHORA, resumen: { deuda_total: 0 }, expedientes: [], periodicos: [] }),
    ot: ok({ grupos: {
      "13_EN_EJECUCION": [
        { comunidad: "Jorge de Montemayor 34", ccpp_id: "ccpp_montemayor", pto_total: 30000 },
        { comunidad: "Urbano Orad 13-15", ccpp_id: ORAD, tipo: "OO", sin_ot: true, de_obras_otras: true, pto_total: 35300 },
      ],
      "17_COBRO_EMASESA": [
        { comunidad: "Juan Pablos 17", ccpp_id: "ccpp_jp17", pto_total: 24541.09, numero_factura_holded: "F260041", fecha_cobro: "2026-10-05" },
        { comunidad: "Palma del Rio 4", ccpp_id: "ccpp_palma", pto_total: 10182.47, numero_factura_holded: "F260053", fecha_cobro: "2026-10-05" },
        { comunidad: "Eduardo Dato 44", ccpp_id: "ccpp_dato", pto_total: 6265.86, numero_factura_holded: "F260008", fecha_cobro: "2026-10-20" },   // su remesa aún no ha llegado
      ],
    } }),
    oo: ok({ obras: [] }),
    iva: ok({ iva_resultado: 0, iva_repercutido: 0, iva_soportado: 0, periodo_inicio: "2026-10-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "jp", numero: "F260041", cliente: "CCPP JUAN PABLOS 17", fecha: "2026-08-20", fecha_vto: "2026-09-20", subtotal: 24541.09, estado_logico: "emitida_pdte", pdte_cobro_eur: 25939.20, tags: [] },
      { id: "pr", numero: "F260053", cliente: "CDAD PROP PALMA DEL RIO 4", fecha: "2026-08-28", fecha_vto: "2026-09-28", subtotal: 10182.47, estado_logico: "emitida_pdte", pdte_cobro_eur: 11200.72, tags: [] },
      { id: "ed", numero: "F260008", cliente: "CCPP EDUARDO DATO 44", fecha: "2026-01-20", subtotal: 6265.86, estado_logico: "emitida_pdte", pdte_cobro_eur: 6892.45, tags: [] },
      { id: "pp", numero: "F240110", cliente: "Puerto Piqueras", fecha: "2024-05-10", subtotal: 1162.70, estado_logico: "emitida_pdte", pdte_cobro_eur: 1406.87, tags: [] },
      { id: "dp", numero: "F260022", cliente: "CCPP DIEGO PUERTA 1", fecha: "2026-03-01", subtotal: 564, estado_logico: "emitida_pdte", pdte_cobro_eur: 620.40, tags: [] },
      { id: "x2", numero: "F260061", cliente: "Cliente privado", fecha: "2026-09-20", fecha_vto: "2026-10-20", subtotal: 8702.72, estado_logico: "emitida_pdte", pdte_cobro_eur: 10529.29, tags: [] },
    ]),
    tags: ok({}),
    prestamos: ok([{ id: "r0", tipo: "recibido", contraparte: "Nadie", principal: 0, periodicidad: "ninguna" }, { id: "c0", tipo: "concedido", contraparte: "Nadie", principal: 0, periodicidad: "ninguna" }]),
    config: ok([{ clave: "poliza_dispuesta", valor: "0" }, { clave: "descuadre_historico_572", valor: "11000" }]),
    banco: ok([{ fecha: "2026-10-05", descripcion: "COBRO CLIENTE", salida: -100 }]),
    nominas465: ok([]),
    compras: ok({ facturas: [] }),
    // el libro va 11.000 € por encima del banco de siempre (histórico) y hoy la remesa lo pone 38.195,92 por delante
    // 35.346 € por delante: la remesa (38.195,92) menos 2.849,92 € de cargos de hoy sin importar
    cuadre: ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 35346 + 11000, ultimo_apunte: "2026-10-05" }),
    rentab: {
      ccpp_montemayor: ok({ previsto: { mano_obra_previsto: 3000, material_previsto: 1000 }, real: { mano_obra_real: 855.41, material_real: 0, beneficio_real: 9000 } }),
      // Urbano Orad: 320 h × 30 €/h + 2.500 € de material por portal (24.200 €), 8 h fichadas (240 €)
      [ORAD]: ok({ previsto: { pto_total: 35300, mano_obra_previsto: 19200, material_previsto: 5000 }, real: { mano_obra_real: 240, material_real: 0, beneficio_real: 35060 } }),
    },
  };
}

const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);
const r = C.calcularEscalera(fuentes(), HOY, AHORA, { pleo_manual: 743 });

// 1 · mío hoy y su desglose
assert.deepStrictEqual(r.kpis.mio_hoy_desglose, { banco: 77360.96, banco_sync: "2026-10-06T12:18", custodia: 62613, senales: 1862, pleo: 743 });
assert.strictEqual(r.kpis.mio_hoy, 13628.96);

// 2 · sincronización de la ES81 y fecha de T1
assert.strictEqual(r.frescura.banco_ultima_sincronizacion, "2026-10-06T12:18");
assert.strictEqual(L(r, "T1").fecha_dato, "2026-10-06T12:18");
// la rutina sube un lastSyncAt más nuevo (banco-sync): manda ese
assert.strictEqual(C.calcularEscalera({ ...fuentes(), banco_sync: ok({ last_sync_at: "2026-10-06T16:02:11Z" }) }, HOY, AHORA, { pleo_manual: 743 }).frescura.banco_ultima_sincronizacion, "2026-10-06T16:02");

// 3 · remesa ya en el banco: JP17 y Palma (fase 17, remesa del 05/10) fuera de T3, nada de facturas sueltas
assert.deepStrictEqual(r.cuadre_banco.remesa_sin_importar.obras.map((o) => [o.comunidad, o.importe]), [["Juan Pablos 17", 26995.2], ["Palma del Rio 4", 11200.72]]);
assert.strictEqual(r.cuadre_banco.remesa_sin_importar.resto_sin_importar, -2849.92);
assert.strictEqual(L(r, "T3").importe, 19449.01);
// el desglose cuadra con el total y marca las dos
const t3 = L(r, "T3");
assert.strictEqual(Math.round(t3.detalle.reduce((s, d) => s + d.importe, 0) * 100) / 100, t3.importe);
assert.deepStrictEqual(t3.detalle.filter((d) => d.cobrada_en_banco).map((d) => [d.importe, /cobrados en banco 06\/10 \(remesa EMASESA del 05\/10 sin importar\), pendiente de conciliar/.test(d.concepto)]), [[0, true], [0, true]]);
assert.ok(r.avisos.some((a) => a.nivel === "ambar" && /remesa de EMASESA cobrada y sin importar \(Juan Pablos 17 26\.995 € \+ Palma del Rio 4 11\.201 €/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(r.avisos.some((a) => a.nivel === "ambar" && /Cargos de hoy sin importar: 2\.850 €/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(!r.avisos.some((a) => a.nivel === "rojo" && /no cuadran|por delante del extracto/.test(a.texto)), JSON.stringify(r.avisos.filter((a) => a.nivel === "rojo")));
assert.deepStrictEqual(r.cobros_en_banco.filter((c) => c.via === "remesa_sin_importar").map((c) => c.numero), ["F260041", "F260053"]);
// con la remesa exacta (38.196 por delante), sin aviso de cargos
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 38195.92 + 11000, ultimo_apunte: "2026-10-05" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.strictEqual(L(x, "T3").importe, 19449.01);
  assert.ok(!x.avisos.some((a) => /sin importar: /.test(a.texto) && /Cargos|Abonos/.test(a.texto)));
}
// el 04/10 (antes del día de remesa) no se toca T3: aviso rojo
{
  const x = C.calcularEscalera(fuentes(), "2026-10-04", "2026-10-04T18:00:00Z", { pleo_manual: 743 });
  assert.strictEqual(L(x, "T3").importe, 57644.93);
  assert.ok(x.avisos.some((a) => a.nivel === "rojo" && /por delante del extracto: [\d.]+ € sin explicar \(ninguna remesa de obras en fase 17 casa/.test(a.texto)), JSON.stringify(x.avisos));
}

// si lo que va por delante no casa con ninguna remesa: rojo y T3 sin tocar (el histórico escrito con su signo:
// en positivo no se sabe si el banco va por delante o por detrás del libro)
{
  const f = fuentes();
  f.config.data = [{ clave: "poliza_dispuesta", valor: "0" }, { clave: "descuadre_historico_572", valor: "-11000" }];
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 20000 + 11000, ultimo_apunte: "2026-10-05" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.strictEqual(L(x, "T3").importe, 57644.93);
  assert.ok(x.avisos.some((a) => a.nivel === "rojo" && /por delante del extracto: 20\.000 € sin explicar/.test(a.texto)), JSON.stringify(x.avisos));
}
// sin adelanto (banco = libro + histórico): nada cambia
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 + 11000, ultimo_apunte: "2026-10-06" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.strictEqual(L(x, "T3").importe, 57644.93);
  assert.strictEqual(x.cuadre_banco.remesa_sin_importar, null);
}

// 4 · Urbano Orad: coste pendiente en D11 (24.200 − 240) y 0 de comisión en D14
const d11 = L(r, "D11").detalle.find((d) => d.concepto === "Urbano Orad 13-15");
assert.strictEqual(d11.importe, 23960);
const d14 = L(r, "D14");
assert.ok(d14.detalle.some((d) => /Urbano Orad 13-15 · obra privada, sin comisión/.test(d.concepto) && d.importe === 0));
assert.strictEqual(d14.importe, 1800);                       // solo Montemayor: 20 % de 9.000

console.log(`OK dinero-empresa-06-10.test · mío hoy ${r.kpis.mio_hoy} · T3 ${L(r, "T3").importe} · D11 Orad ${d11.importe} · D14 ${d14.importe} · normal ${r.kpis.dinero_empresa_antes_is}`);

module.exports = { fuentes, HOY, AHORA };
