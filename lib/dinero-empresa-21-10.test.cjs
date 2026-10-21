// 21/10/2026 · Mi panel › Empresa con las cifras de producción de ese día (dinero-empresa?force=1, 05:23 UTC, v0.8.0):
//   1 · Gaviota 1: F260052 (base 8.915,05) ya en T3 y la obra seguía entera en T4 → ligada por el contacto (mismo
//       nombre) y fuera de T4. Un nombre solo parecido («CHIVA 7 EXTRAS») sigue siendo solo aviso. D14 sigue (sin cobrar).
//   2 · D9: el 111 del 3T (5.261,06, cargado el 20/10 y sin importar) es deuda hasta ver el cargo en el banco importado
//   3 · D4: el 303 del 3T (2.162,56) sigue en D4 sin cargo de la AEAT; «aplazado» lo pasa a D3
//   4 · Previsión: DF 20 sin montaje fuera, Aquatubo pagado fuera, cobros anunciados (cierto / posible), siguiente
//       pago grande desde hoy, 111 ya cargado en el banco real (por detrás del extracto) no vuelve a salir
// Uso: node lib/dinero-empresa-21-10.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const CF = require("./cashflow-calculo.cjs");
const P = require("./panel-empresa-calculo.cjs");

const HOY = "2026-10-21";
const AHORA = "2026-10-21T05:23:00Z";
const ok = (data) => ({ ok: true, data });
const GAV = "ccpp_gaviota_1_16e4a8";
const EXTRACTO = 74827.92, POR_DETRAS = 6758.93;   // 111 (5.261,06) + plazos AEAT (1.497,87) cargados y sin importar
const MODELOS = "111 3T 2026 5261,06; 303 3T 2026 2162,56";

function fuentes({ modelos = MODELOS, libro111 = 0, cargos = [] } = {}) {
  return {
    tesoreria: ok({ total_eur: EXTRACTO - POR_DETRAS, cuentas: [{ nombre: "Santander ES81", cuenta: "57200001", saldo: EXTRACTO - POR_DETRAS, ultima_sincronizacion: "2026-10-21T05:00" }], pleo: { saldo: 743 } }),
    banco_sync: ok({ last_sync_at: "2026-10-21T05:00:00.000Z", saldo_extracto: EXTRACTO, ultimo_movimiento: "2026-10-20" }),
    cuadre: ok({ saldo_banco: EXTRACTO - POR_DETRAS, saldo_movimientos: EXTRACTO, ultimo_apunte: "2026-10-20" }),
    clientes: ok({
      ok: true, generado: AHORA, total: 50920.51, por_tramo: { "0-30": 34436.53, "+90": 16483.98 },
      clientes: [{ nombre: "COMUNIDAD DE PROPIETARIOS CL.GAVIOTA 1", saldo: 9806.56, tramo: "0-30" }, { nombre: "Resto", saldo: 41113.95, tramo: "0-30" }],
      balance: {}, local13: { pendiente: 0 }, saldos_por_cuenta: { "56000001": -1000 },
    }),
    custodias: ok({ totales: { en_custodia: 40000 } }),
    obligaciones: ok({ generado: AHORA, resumen: { deuda_total: 10000 }, expedientes: [{ id: "aeat-aplaz-iva2024", concepto: "IVA 2024 aplazado", pendiente: 10000, tipo: "aplazamiento", plazos: [] }],
      periodicos: [
        { modelo: "111", periodo: "4T 2026", devengado_trimestre: 13.55, arrastre: 0, anterior: { periodo: "3T 2026", devengado: libro111 } },
        { modelo: "303", periodo: "4T 2026", devengado_trimestre: 2630.06, arrastre: 0, anterior: { periodo: "3T 2026", devengado: 4003.37 } },
      ] }),
    ot: ok({ grupos: {
      "13_EN_EJECUCION": [{ comunidad: "Chiva 7", ccpp_id: "ccpp_chiva7", pto_total: 12000 }],
      "14_FINALIZADA": [
        { comunidad: "Gaviota 1", ccpp_id: GAV, pto_total: 8915.04, numero_factura_holded: "" },
        { comunidad: "Doña Francisquita 20", ccpp_id: "ccpp_df20", pto_total: 31414.63, numero_factura_holded: "", fecha_montaje: "" },
        { comunidad: "Mandarinas 2", ccpp_id: "ccpp_mand2", pto_total: 21009.40, numero_factura_holded: "F260050", fecha_montaje: "2026-10-28", fecha_cobro: "2026-11-05" },
      ],
    } }),
    oo: ok({ obras: [] }),
    iva: ok({ iva_resultado: 2630.06, iva_repercutido: 3184.45, iva_soportado: 554.39, periodo_inicio: "2026-10-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "gav", numero: "F260052", cliente: "COMUNIDAD DE PROPIETARIOS CL.GAVIOTA 1", fecha: "2026-10-19", subtotal: 8915.05, estado_logico: "emitida_pdte", pdte_cobro_eur: 9806.56, tags: [] },
      { id: "chx", numero: "F260040", cliente: "CIUDAD DE CHIVA 7 EXTRAS", fecha: "2026-09-01", subtotal: 900, estado_logico: "emitida_pdte", pdte_cobro_eur: 990, tags: [] },
      { id: "man", numero: "F260050", cliente: "CCPP MANDARINAS 2", fecha: "2026-10-10", fecha_vto: "2026-11-05", subtotal: 21009.40, estado_logico: "emitida_pdte", pdte_cobro_eur: 23110.34, tags: [] },
    ]),
    tags: ok({}),
    prestamos: ok([
      { id: "santander", tipo: "recibido", contraparte: "Santander", cuotas_detalle: "2026-10-28:15075.06;2026-11-28:15075.06" },
      { id: "c0", tipo: "concedido", contraparte: "Nadie", principal: 0, periodicidad: "ninguna" },
    ]),
    config: ok([
      { clave: "poliza_dispuesta", valor: "0" }, { clave: "nomina_neta_mensual", valor: "11000" },
      ...(modelos ? [{ clave: "modelos_aeat", valor: modelos }] : []),
      { clave: "pagos_programados", valor: "2026-10-10:2341.93:Aquatubo" },
      { clave: "cobros_anunciados", valor: "2026-10-24:11555,17:Mandarinas 2 (mitad adelantada):F260050; 2026-10-31:19415:Urbano Orad 13-15 (resto):posible" },
      { clave: "is_202_trimestral", valor: "572,10" },
    ]),
    // Aquatubo pagado el 13/10 (importado); nóminas de septiembre pagadas
    banco: ok([
      { fecha: "2026-10-13", descripcion: "TRANSFERENCIA AQUATUBO SL", salida: 2341.93 },
      { fecha: "2026-10-02", descripcion: "NOMINA SEPTIEMBRE", salida: 11000 },
      ...cargos,
    ]),
    nominas465: ok([]),
    compras: ok({ facturas: [] }),
    rentab: {
      ccpp_chiva7: ok({ previsto: { mano_obra_previsto: 3000, material_previsto: 1000 }, real: { mano_obra_real: 1000, material_real: 0, beneficio_real: 4000 } }),
      [GAV]: ok({ previsto: {}, real: { beneficio_real: 3064.70 } }),
      ccpp_df20: ok({ previsto: {}, real: { beneficio_real: 10000 } }),
      ccpp_mand2: ok({ previsto: {}, real: { beneficio_real: 5000 } }),
    },
  };
}
const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);

// ── 1 · Gaviota 1 ──
const r = C.calcularEscalera(fuentes(), HOY, AHORA, { pleo_manual: 743 });
const t4 = L(r, "T4");
const gav = t4.detalle.find((d) => d.ccpp_id === GAV);
assert.strictEqual(gav.importe, 0, "Gaviota 1 fuera de T4");
assert.deepStrictEqual(gav.facturas.map((x) => [x.numero, x.via]), [["F260052", "contacto con el mismo nombre"]]);
assert.strictEqual(L(r, "T3").importe, 50920.51);                              // F260052 sigue en T3, una sola vez
assert.ok(!r.avisos.some((a) => /Gaviota 1: hay factura\(s\) en Holded a un contacto parecido/.test(a.texto)));
assert.ok(r.avisos.some((a) => /Gaviota 1: F260052 ligada\(s\) a la obra por el contacto/.test(a.texto)));
// Chiva 7: solo parecido → no se resta, se avisa
assert.strictEqual(t4.detalle.find((d) => d.ccpp_id === "ccpp_chiva7").importe, 12000);
assert.ok(r.avisos.some((a) => /Chiva 7: hay factura\(s\) en Holded a un contacto parecido \(F260040/.test(a.texto)));
// D14: la comisión de Gaviota sigue (facturada, sin cobrar): 20 % de 3.064,70 = 612,94
assert.strictEqual(L(r, "D14").detalle.find((d) => d.ccpp_id === GAV).importe, 612.94);
// la alerta patrimonial sale del mismo detalle de T4
const pv0 = P.calcularPanel(fuentes(), r, HOY, {});
assert.ok(pv0.prevision_semanal);

// ── 2 · D9 con el 111 del 3T sin importar ──
const d9 = L(r, "D9");
assert.strictEqual(d9.importe, 5274.61);                                       // 13,55 + 5.261,06
assert.ok(d9.detalle.some((x) => /Modelo 111 del 3T 2026 sin cargo/.test(x.concepto) && x.importe === 5261.06));
assert.ok(r.avisos.some((a) => a.tipo === "modelo_111_sin_cargo"));
// sin modelos_aeat: lo devengado en el libro (4751, julio-septiembre)
assert.strictEqual(L(C.calcularEscalera(fuentes({ modelos: null, libro111: 5261.06 }), HOY, AHORA, { pleo_manual: 743 }), "D9").importe, 5274.61);
// con el cargo importado (572, 20/10) → solo lo del 4T
const conCargos = C.calcularEscalera(fuentes({ cargos: [{ fecha: "2026-10-20", descripcion: "DOMICILIACION IMPUESTO AEAT", salida: 5261.06 }, { fecha: "2026-10-20", descripcion: "DOMICILIACION IMPUESTO AEAT", salida: 2162.56 }] }), HOY, AHORA, { pleo_manual: 743 });
assert.strictEqual(L(conCargos, "D9").importe, 13.55);
assert.strictEqual(L(conCargos, "D4").importe, 2630.06);

// ── 3 · D4 con el 303 del 3T sin cargo ──
assert.strictEqual(L(r, "D4").importe, 4792.62);                               // 2.630,06 + 2.162,56
const apl = C.calcularEscalera(fuentes({ modelos: "111 3T 2026 5261,06; 303 3T 2026 2162,56 aplazado" }), HOY, AHORA, { pleo_manual: 743 });
assert.strictEqual(L(apl, "D4").importe, 2630.06);
assert.strictEqual(L(apl, "D3").importe, 12162.56);                            // aplazado → D3
// valor: −8.915,04 (T4) −5.261,06 (D9) −2.162,56 (D4) respecto a la escalera de antes
const delta = (8915.04 + 5261.06 + 2162.56);
assert.strictEqual(Math.round((35263.42 - delta) * 100) / 100, 18924.76);
assert.strictEqual(Math.round((19098.46 - delta) * 100) / 100, 2759.8);

// ── 4 · Previsión semanal ──
const cf = CF.calcularCashflow(fuentes(), r, HOY, null, { gastosFijosMes: 3000, is2026: { importe: 1000, fecha: "2027-07-25" } });
const movs = [...cf.semanas.flatMap((s) => s.movs), ...cf.meses.flatMap((m) => m.movs)];
assert.ok(!movs.some((m) => /Francisquita/.test(m.concepto)), "DF 20 sin factura ni montaje fuera");
assert.ok(cf.notas.some((n) => /Fuera hasta que haya factura y montaje: Doña Francisquita 20/.test(n)));
assert.ok(!movs.some((m) => /Aquatubo/.test(m.concepto)), "Aquatubo ya pagado");
assert.ok(cf.notas.some((n) => /Aquatubo .* ya pagado el 13\/10/.test(n)));
// Mandarinas: la mitad anunciada (cierta, de la F260050) y el resto de la factura a su vencimiento
const mand = movs.filter((m) => /MANDARINAS|Mandarinas/.test(m.concepto));
assert.ok(mand.some((m) => m.fila === "cobros_anunciados" && m.fecha === "2026-10-24" && m.importe === 11555.17 && !m.posible));
assert.ok(mand.some((m) => m.fila === "remesas_emasesa" && m.fecha === "2026-11-05" && m.importe === 11555.17));
// Orad: posible, marcado
const orad = movs.find((m) => /Urbano Orad/.test(m.concepto));
assert.ok(orad.posible && orad.fecha === "2026-10-31" && orad.importe === 19415);
// 111 ya fuera del banco real (por detrás del extracto); 303 sale hoy (vencido)
assert.ok(!movs.some((m) => /IRPF 111 del 3T/.test(m.concepto)));
assert.ok(movs.some((m) => /IVA 303 del 3T 2026/.test(m.concepto) && m.fecha === HOY && m.importe === 2162.56));
// 202: solo el de diciembre (el de octubre ya está pagado)
assert.deepStrictEqual(movs.filter((m) => /IS 202$/.test(m.concepto) && m.fecha < "2027-01-01").map((m) => m.fecha), ["2026-12-20"]);
const pv = P.calcularPanel(fuentes(), r, HOY, {}).prevision_semanal;
assert.deepStrictEqual([pv.siguiente_pago_grande.fecha, pv.siguiente_pago_grande.importe], ["2026-10-28", 15075.06]);
const s2 = pv.semanas.find((s) => s.desde <= "2026-10-31" && s.hasta >= "2026-10-31");
assert.strictEqual(s2.entra_posible, 19415);
assert.ok(pv.minimo_sin_posibles && pv.minimo_sin_posibles.saldo <= pv.minimo.saldo);
for (const s of pv.semanas) assert.ok(s.saldo_sin_posibles <= s.saldo + 0.005);

// /obligaciones: lo devengado del trimestre anterior (111: haber de la 4751; 303: 477 − 472)
{
  const O = require("../ara-os-obligaciones.cjs");
  const def111 = O.CALENDARIO.periodicos.find((p) => p.modelo === "111"), def303 = O.CALENDARIO.periodicos.find((p) => p.modelo === "303");
  const hac = {
    "47510000": [{ fecha: "2026-07-31", debe: 0, haber: 1753.69 }, { fecha: "2026-08-31", debe: 0, haber: 1753.69 }, { fecha: "2026-09-30", debe: 0, haber: 1753.68 }, { fecha: "2026-10-15", debe: 0, haber: 13.55 }],
    "47700000": [{ fecha: "2026-08-10", debe: 0, haber: 3000 }, { fecha: "2026-10-10", debe: 0, haber: 3184.45 }],
    "47200000": [{ fecha: "2026-08-12", debe: 837.44, haber: 0 }, { fecha: "2026-10-12", debe: 554.39, haber: 0 }],
  };
  const p111 = O.calcularPeriodico(def111, hac, HOY), p303 = O.calcularPeriodico(def303, hac, HOY);
  assert.deepStrictEqual([p111.periodo, p111.devengado_trimestre, p111.anterior.periodo, p111.anterior.devengado, p111.anterior.vencimiento], ["4T 2026", 13.55, "3T 2026", 5261.06, "2026-10-20"]);
  assert.deepStrictEqual([p303.devengado_trimestre, p303.anterior.devengado], [2630.06, 2162.56]);
  assert.strictEqual(O.calcularPeriodico(def111, hac, "2027-01-10").anterior, null);   // el 4T de 2026 no está en el libro de 2027
}

console.log(`OK dinero-empresa-21-10.test · T4 Gaviota 0 · D9 ${d9.importe} · D4 ${L(r, "D4").importe} · peor semana ${pv.minimo.saldo} (sin posibles ${pv.minimo_sin_posibles.saldo})`);
