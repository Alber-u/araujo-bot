// 06/10/2026 · Mi panel › Empresa con los datos de producción de ese día (18:36 UTC):
//   1 · «mío hoy» con su desglose: banco 77.361 − custodia 62.613 − señales 1.862 + Pleo 743
//   2 · la sincronización del banco es la de la ES81 (12:18 UTC), no la de otra cuenta, y T1 lleva esa fecha
//   3 · la remesa de EMASESA (JP17 26.995,20 + Palma del Río 11.200,72) ya está en el saldo del banco y sin importar:
//       sale de T3 (cobrada en banco, pendiente de conciliar), aviso ámbar; si no casa, aviso rojo y T3 igual
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
      clientes: [], balance: {}, local13: { pendiente: 0 },
      saldos_por_cuenta: { "56000001": -1862 },
    }),
    custodias: ok({ totales: { en_custodia: 62613 } }),
    obligaciones: ok({ generado: AHORA, resumen: { deuda_total: 0 }, expedientes: [], periodicos: [] }),
    ot: ok({ grupos: {
      "13_EN_EJECUCION": [
        { comunidad: "Jorge de Montemayor 34", ccpp_id: "ccpp_montemayor", pto_total: 30000 },
        { comunidad: "Urbano Orad 13-15", ccpp_id: ORAD, tipo: "OO", sin_ot: true, de_obras_otras: true, pto_total: 35300 },
      ],
    } }),
    oo: ok({ obras: [] }),
    iva: ok({ iva_resultado: 0, iva_repercutido: 0, iva_soportado: 0, periodo_inicio: "2026-10-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "jp", numero: "F260051", cliente: "CCPP JUAN PABLOS 17", fecha: "2026-08-20", fecha_vto: "2026-09-20", subtotal: 24541.09, estado_logico: "emitida_pdte", pdte_cobro_eur: 26995.20, tags: [] },
      { id: "pr", numero: "F260053", cliente: "CDAD PROP PALMA DEL RIO 4", fecha: "2026-08-28", fecha_vto: "2026-09-28", subtotal: 10182.47, estado_logico: "emitida_pdte", pdte_cobro_eur: 11200.72, tags: [] },
      { id: "x1", numero: "F260060", cliente: "CCPP OTRA 1", fecha: "2026-09-15", fecha_vto: "2026-10-15", subtotal: 9000, estado_logico: "emitida_pdte", pdte_cobro_eur: 9900, tags: [] },
      { id: "x2", numero: "F260061", cliente: "Cliente privado", fecha: "2026-09-20", fecha_vto: "2026-10-20", subtotal: 8681.83, estado_logico: "emitida_pdte", pdte_cobro_eur: 9549.01, tags: [] },
    ]),
    tags: ok({}),
    prestamos: ok([{ id: "r0", tipo: "recibido", contraparte: "Nadie", principal: 0, periodicidad: "ninguna" }, { id: "c0", tipo: "concedido", contraparte: "Nadie", principal: 0, periodicidad: "ninguna" }]),
    config: ok([{ clave: "poliza_dispuesta", valor: "0" }, { clave: "descuadre_historico_572", valor: "11000" }]),
    banco: ok([{ fecha: "2026-10-05", descripcion: "COBRO CLIENTE", salida: -100 }]),
    nominas465: ok([]),
    compras: ok({ facturas: [] }),
    // el libro va 11.000 € por encima del banco de siempre (histórico) y hoy la remesa lo pone 38.195,92 por delante
    cuadre: ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 38195.92 + 11000, ultimo_apunte: "2026-10-05" }),
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

// 3 · remesa ya en el banco: JP17 y Palma fuera de T3, aviso ámbar, sin «no cuadra»
assert.strictEqual(L(r, "T3").importe, 19449.01);
assert.deepStrictEqual(r.cuadre_banco.remesa_sin_importar.facturas.map((x) => x.numero).sort(), ["F260051", "F260053"]);
assert.ok(r.avisos.some((a) => a.nivel === "ambar" && /remesa de EMASESA/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(!r.avisos.some((a) => a.nivel === "rojo" && /no cuadran|por delante del extracto/.test(a.texto)), JSON.stringify(r.avisos.filter((a) => a.nivel === "rojo")));
assert.ok(r.cobros_en_banco.some((c) => c.numero === "F260051" && c.via === "remesa_sin_importar"));
assert.ok(L(r, "T3").detalle.some((d) => /F260051.*cobrada en banco 06\/10/.test(d.concepto) && d.importe === -26995.2));

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
