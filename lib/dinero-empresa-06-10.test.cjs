// 06/10/2026 · Mi panel › Empresa con los datos de producción de ese día (18:36 UTC):
//   1 · «mío hoy» con su desglose: banco 77.361 − custodia 62.613 − señales 1.862 + Pleo 743
//   2 · la sincronización del banco es la de la ES81 (12:18 UTC), no la de otra cuenta, y T1 lleva esa fecha
//   3 · (decisión de Alberto, 06/10) el valor de la empresa va con el EXTRACTO (lo importado en Holded), no con el
//       saldo del banco: T1 = 42.054 (banco 77.361 − 35.307 aún sin importar), T3 sin tocar (JP17 y Palma dentro hasta
//       conciliar), «mío hoy» y la caja con el banco real. Solo un aviso ámbar con la pista de la remesa (fase 17).
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
    // histórico de producción: el libro va 54.587,16 por encima del banco (escrito en positivo)
    config: ok([{ clave: "poliza_dispuesta", valor: "0" }, { clave: "descuadre_historico_572", valor: "54587.16" }]),
    banco: ok([{ fecha: "2026-10-05", descripcion: "COBRO CLIENTE", salida: -100 }]),
    nominas465: ok([]),
    compras: ok({ facturas: [] }),
    // el libro va 11.000 € por encima del banco de siempre (histórico) y hoy la remesa lo pone 38.195,92 por delante
    // 35.307 € por delante de lo importado: la remesa (38.195,92) menos 2.888,92 € de cargos de hoy sin importar
    cuadre: ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 35307 + 54587.16, ultimo_apunte: "2026-10-05" }),
    rentab: {
      ccpp_montemayor: ok({ previsto: { mano_obra_previsto: 3000, material_previsto: 1000 }, real: { mano_obra_real: 855.41, material_real: 0, beneficio_real: 9000 } }),
      // Urbano Orad: 320 h × 30 €/h + 2.500 € de material por portal (24.200 €), 8 h fichadas (240 €)
      [ORAD]: ok({ previsto: { pto_total: 35300, mano_obra_previsto: 19200, material_previsto: 5000 }, real: { mano_obra_real: 240, material_real: 0, beneficio_real: 35060 } }),
    },
  };
}

const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);
const r = C.calcularEscalera(fuentes(), HOY, AHORA, { pleo_manual: 743 });

// 1 · mío hoy con el banco real, y el extracto al lado
assert.deepStrictEqual(r.kpis.mio_hoy_desglose, { banco: 77360.96, extracto: 42053.96, banco_sync: "2026-10-06T12:18", custodia: 62613, senales: 1862, pleo: 743 });
assert.strictEqual(r.kpis.mio_hoy, 13628.96);

// 2 · sincronización de la ES81; T1 con la fecha del último movimiento importado
assert.strictEqual(r.frescura.banco_ultima_sincronizacion, "2026-10-06T12:18");
assert.strictEqual(L(r, "T1").fecha_dato, "2026-10-05");
// la rutina sube un lastSyncAt más nuevo (banco-sync): manda ese
assert.strictEqual(C.calcularEscalera({ ...fuentes(), banco_sync: ok({ last_sync_at: "2026-10-06T16:02:11Z" }) }, HOY, AHORA, { pleo_manual: 743 }).frescura.banco_ultima_sincronizacion, "2026-10-06T16:02");

// 3 · T1 = extracto, T3 sin tocar, solo aviso ámbar con la pista
assert.deepStrictEqual([L(r, "T1").importe, L(r, "T1").saldo_banco, L(r, "T1").adelanto_banco], [42053.96, 77360.96, 35307]);
assert.strictEqual(L(r, "T3").importe, 57644.93);
assert.ok(!r.cobros_en_banco.length);
const av = r.avisos.find((a) => /por delante de lo importado/.test(a.texto));
assert.ok(av && av.nivel === "ambar", JSON.stringify(r.avisos));
assert.ok(/^El banco va 35\.307 € por delante de lo importado en Holded \(sync 06\/10 14:18\)\. Se ajustará al importar y conciliar\. Posible remesa EMASESA: Juan Pablos 17 26\.995 € \+ Palma del Rio 4 11\.201 €; cargos sin importar ≈ 2\.889 €\.$/.test(av.texto), av.texto);
// el cuadre y el histórico, con el extracto: cuadran
assert.strictEqual(r.cuadre_banco.estado, "cuadra");
assert.ok(!r.avisos.some((a) => a.nivel === "rojo" && /no cuadran|histórico/.test(a.texto)), JSON.stringify(r.avisos.filter((a) => a.nivel === "rojo")));
// la caja (cash flow) arranca del banco real
assert.strictEqual(require("./cashflow-calculo.cjs").calcularCashflow(fuentes(), r, HOY).inicial.banco, 77360.96);

// el rato en que el banco va por delante y el día siguiente, importado y conciliado, valen lo mismo salvo los
// cargos de hoy (que ya estaban en el banco): T1 sube 35.307 + T3 baja 38.196 → −2.889
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 + 54587.16, ultimo_apunte: "2026-10-06" });
  f.clientes.data.total = 19449.01;
  f.clientes.data.clientes = f.clientes.data.clientes.filter((c) => !/JUAN PABLOS|PALMA/.test(c.nombre));
  f.invoices.data = f.invoices.data.map((d) => (["F260041", "F260053"].includes(d.numero) ? { ...d, estado_logico: "cobrada", pdte_cobro_eur: 0 } : d));
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.deepStrictEqual([L(x, "T1").importe, L(x, "T3").importe], [77360.96, 19449.01]);
  assert.ok(!x.avisos.some((a) => /por delante de lo importado/.test(a.texto)));
  assert.strictEqual(Math.round((x.kpis.dinero_empresa_antes_is - r.kpis.dinero_empresa_antes_is) * 100) / 100, -2888.92);
  assert.strictEqual(x.kpis.mio_hoy, r.kpis.mio_hoy);
}
// la rutina manda el saldo del extracto: manda ese (aunque el histórico no esté)
{
  const f = fuentes();
  f.config.data = [{ clave: "poliza_dispuesta", valor: "0" }];
  f.banco_sync = ok({ last_sync_at: "2026-10-06T12:18:40.000Z", saldo: 77360.96, saldo_extracto: 42000, ultimo_movimiento: "2026-10-05" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.deepStrictEqual([L(x, "T1").importe, L(x, "T1").adelanto_banco, L(x, "T1").fecha_dato], [42000, 35360.96, "2026-10-05"]);
}
// si no casa con ninguna obra de fase 17: el aviso, sin pista, y nada más
{
  const f = fuentes();
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 20000 + 54587.16, ultimo_apunte: "2026-10-05" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.strictEqual(L(x, "T3").importe, 57644.93);
  const a = x.avisos.find((y) => /por delante de lo importado/.test(y.texto));
  assert.ok(a && a.nivel === "ambar" && /20\.000 €/.test(a.texto) && !/remesa/.test(a.texto), JSON.stringify(x.avisos));
}

// 5 · cash flow (tarjeta 2) desde el banco real: lo ya cobrado o pagado en el banco no vuelve a entrar ni salir
//     (06/10/2026, 20:26 UTC: Palma y JP17 entraban otra vez, la nómina de septiembre salía otra vez y
//     Guardabosques, casada por R6 con la transferencia del 05/10, se volvía a cobrar)
{
  const P = require("./panel-empresa-calculo.cjs");
  const mv = (id, date, amount, description) => ({ id, date, amount, description, pendingToReconcile: amount });
  const f = fuentes();
  f.config.data.push({ clave: "nomina_neta_mensual", valor: "11000" }, { clave: "nomina_dia_pago", valor: "2" });
  f.clientes.data.saldos_por_cuenta["46500000"] = -5795.14;                    // nómina de septiembre en la 465
  f.nominas465 = ok([{ fecha: "2026-09-30", concepto: "Nóminas septiembre 2026", haber: 5795.14 }]);
  f.nominasPendientes = ok([{ nombre: "Juan Perez Lopez", periodo: "2026-09", importe: 3000 }, { nombre: "Luis Gomez Ruiz", periodo: "2026-09", importe: 2795.14 }]);
  f.invoices.data.push({ id: "gb", numero: "F260035", cliente: "CCPP GUARDABOSQUES 3", fecha: "2026-09-20", fecha_vto: "2026-10-20", subtotal: 513.64, estado_logico: "emitida_pdte", pdte_cobro_eur: 621.50, tags: [] });
  f.foto = ok({ generado: "2026-10-06T12:30:00Z", cuenta: "es81", last_sync_at: "2026-10-06T12:18:40Z", movimientos: [
    mv("n1", "2026-10-02", -3000, "TRANSFERENCIA INMEDIATA A FAVOR DE Juan Perez Lopez CONCEPTO Nomina Septiembre"),
    mv("n2", "2026-10-02", -2795.14, "TRANSFERENCIA INMEDIATA A FAVOR DE Luis Gomez Ruiz CONCEPTO Nomina Septiembre"),
    mv("g1", "2026-10-05", 621.50, "TRANSFERENCIA DE CCPP GUARDABOSQUES 3 FRA F260035"),
  ] });
  // banco − libro = 35.307 sin importar + (−5.173,64) importado sin conciliar (foto) − 54.587,16 de histórico
  f.cuadre = ok({ saldo_banco: 77360.96, saldo_movimientos: 77360.96 - 35307 + 5173.64 + 54587.16, ultimo_apunte: "2026-10-05" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.ok(x.ajuste_conciliacion, "con foto fresca");
  assert.deepStrictEqual([x.debo.find((l) => l.id === "D7").importe, x.ajuste_conciliacion.ajustes.D7, x.ajuste_conciliacion.ajustes.T3], [5795.14, 5795.14, 621.5]);   // hay qué no repetir
  assert.ok(x.cuadre_banco.banco_vs_extracto.posible_remesa, JSON.stringify(x.cuadre_banco.banco_vs_extracto));
  const comprobar = (pv, vista) => {
    const ent = pv.semanas.flatMap((w) => w.entradas).map((m) => m.concepto).join(" | ");
    const sal = pv.semanas.flatMap((w) => w.salidas).filter((m) => m.tipo === "nomina" && /2026-09/.test(m.concepto));
    for (const n of ["F260041", "F260053", "F260035"]) assert.ok(!ent.includes(n), `${vista}: ${n} entra otra vez · ${ent}`);
    assert.deepStrictEqual(sal, [], `${vista}: nómina de septiembre otra vez`);
  };
  comprobar(P.calcularPanel(f, x, HOY, { concCaja: x.ajuste_conciliacion }).prevision_semanal, "contable");
  comprobar(P.calcularPanel(f, { ...x, ...x.real }, HOY, { conc: x.ajuste_conciliacion }).prevision_semanal, "real");
  const cf = require("./cashflow-calculo.cjs").calcularCashflow(f, x, HOY, x.ajuste_conciliacion);
  assert.ok(!cf.semanas.flatMap((w) => w.movs).some((m) => /F260041|F260053|F260035/.test(m.concepto) || (m.fila === "nominas" && /2026-09/.test(m.concepto))));
  // las demás facturas siguen entrando (Eduardo Dato, el cliente privado)
  assert.ok(cf.semanas.flatMap((w) => w.movs).some((m) => /F260061/.test(m.concepto)));
}

// 4 · Urbano Orad: coste pendiente en D11 (24.200 − 240) y 0 de comisión en D14
const d11 = L(r, "D11").detalle.find((d) => d.concepto === "Urbano Orad 13-15");
assert.strictEqual(d11.importe, 23960);
const d14 = L(r, "D14");
assert.ok(d14.detalle.some((d) => /Urbano Orad 13-15 · obra privada, sin comisión/.test(d.concepto) && d.importe === 0));
assert.strictEqual(d14.importe, 1800);                       // solo Montemayor: 20 % de 9.000

console.log(`OK dinero-empresa-06-10.test · mío hoy ${r.kpis.mio_hoy} · T3 ${L(r, "T3").importe} · D11 Orad ${d11.importe} · D14 ${d14.importe} · normal ${r.kpis.dinero_empresa_antes_is}`);

module.exports = { fuentes, HOY, AHORA };
