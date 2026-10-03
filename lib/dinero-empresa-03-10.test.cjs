// Prueba de aceptación del encargo del 03/10/2026 («¿Cuánto vale la empresa
// antes de IS?» tiene que cuadrar con la verificación manual).
// Fuentes con las cifras de ese día línea a línea (las del encargo); las que el
// encargo no da son de relleno y no cambian entre antes y después. Con el
// cálculo anterior salía 24.641 € / 7.856 €; ahora ≈ 4.883 € / −11.902 €.
// D3 llega ya corregido por /obligaciones (su test: obligaciones-pagos.test).
// Uso: node lib/dinero-empresa-03-10.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const P = require("./panel-empresa-calculo.cjs");

const HOY = "2026-10-03";
const AHORA = "2026-10-03T09:20:00Z";
const ok = (data) => ({ ok: true, data });

function fuentes() {
  return {
    tesoreria: ok({
      total_eur: 97023,
      cuentas: [{ nombre: "Santander", cuenta: "57200001", saldo: 97023, ultima_sincronizacion: "2026-10-03T06:05" }],
      pleo: { nombre: "Pleo", cuenta: null, saldo: 0 },                 // Holded no sincroniza Pleo
    }),
    clientes: ok({
      ok: true, generado: AHORA, total: 40000, por_tramo: { "0-30": 23215, "+90": 16785 },
      clientes: [], balance: {}, local13: { pendiente: 20000 },
      patrimonio: { en_causa_disolucion: false, ajustado: 50000, umbral_disolucion: 1500, ajustes: [] },
      saldos_por_cuenta: {
        "56000001": -2000, "43800000": -11000,
        "40000001": -16000, "41000001": -2776,                            // D6 18.776
        "46500000": -11000,                                               // nómina de septiembre contabilizada el 30/09
        "47600000": -26,                                                  // restos en la 476
        "54200000": 11850 - 40000, "57200007": 0,
      },
    }),
    custodias: ok({ totales: { en_custodia: 30000 } }),
    obligaciones: ok({
      generado: AHORA,
      resumen: { deuda_total: 14188 },                                    // ya sin el plazo cargado sin casar
      expedientes: [{ concepto: "Aplazamientos AEAT", pendiente: 14188, tipo: "aplazamiento", plazos: [] }],
      periodicos: [
        { modelo: "111", periodo: "4T 2026", vencimiento: "2027-01-20", devengado_trimestre: 0, arrastre: 0, saldo_cuenta: 0, ultimo_pago_banco: null },
        { modelo: "303", periodo: "4T 2026", devengado_trimestre: 0 },
      ],
    }),
    ot: ok({ grupos: {
      "14_FINALIZADA": [{ comunidad: "Obra A", ccpp_id: "ccpp_a", pto_total: 40000 }],
      "15_VISITA_INSPECTOR": [{ comunidad: "Obra B", ccpp_id: "ccpp_b", pto_total: 30000 }],
      "17_COBRO_EMASESA": [{ comunidad: "Obra C", ccpp_id: "ccpp_c", pto_total: 25000 }],
    } }),
    oo: ok({ obras: [] }),
    iva: ok({ iva_resultado: 6000, iva_repercutido: 9000, iva_soportado: 3000, periodo_inicio: "2026-07-01", periodo_fin: HOY }),
    invoices: ok([
      { id: "a", numero: "F260040", cliente: "CCPP Obra A", fecha: "2026-09-10", subtotal: 40000, estado_logico: "emitida_pdte", pdte_cobro_eur: 44000, tags: ["obraa"] },
      { id: "b", numero: "F260041", cliente: "CCPP Obra B", fecha: "2026-09-12", subtotal: 30000, estado_logico: "emitida_pdte", pdte_cobro_eur: 33000, tags: ["obrab"] },
      { id: "c", numero: "F260042", cliente: "CCPP Obra C", fecha: "2026-09-15", subtotal: 25000, estado_logico: "cobro_parcial", pdte_cobro_eur: 10000, tags: ["obrac"] },
      // Cobrada y la obra sin OT (fase < 12): cobrado sin ejecutar
      { id: "u", numero: "F260049", cliente: "CCPP URBANO ORAD", fecha: "2026-09-22", subtotal: 17650, total: 19415, estado_logico: "cobrada", pdte_cobro_eur: 0, tags: ["urbanoorad"] },
      // Cobrada de una obra ya terminada en otros tiempos y sin etiqueta: no cuenta
      { id: "v", numero: "F250010", cliente: "Cliente viejo", fecha: "2025-03-01", subtotal: 9999, estado_logico: "cobrada", pdte_cobro_eur: 0, tags: [] },
    ]),
    tags: ok({ ccpp_a: ["obraa"], ccpp_b: ["obrab"], ccpp_c: ["obrac"], ccpp_urbano: ["urbanoorad"] }),
    prestamos: ok([
      { id: "c1", tipo: "concedido", contraparte: "Araviva Inversiones", principal: 11850, periodicidad: "ninguna", cuenta_holded: "54200000" },
      { id: "r1", tipo: "recibido", contraparte: "Araviva Inversiones", principal: 40000, periodicidad: "ninguna", cuenta_holded: "54200000" },
    ]),
    config: ok([
      { clave: "nomina_neta_mensual", valor: "11000" }, { clave: "nomina_dia_pago", valor: "2" },
      { clave: "poliza_dispuesta", valor: "0" }, { clave: "irpf_111_trimestral", valor: "3411" },
    ]),
    banco: ok([
      { fecha: "2026-10-02", descripcion: "TRANSF NOMINA SEPTIEMBRE TRABAJADOR 1", salida: 6000 },
      { fecha: "2026-10-02", descripcion: "TRANSF NOMINA SEPTIEMBRE TRABAJADOR 2", salida: 5000 },
      { fecha: "2026-09-30", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 5025 },   // el de agosto
      { fecha: "2026-08-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 4980 },
      { fecha: "2026-09-21", descripcion: "DOMICILIACION IMPUESTO ABONARE A.E.A.T", salida: 1242.11 },
      { fecha: "2026-10-01", descripcion: "COBRO CLIENTE", salida: -2000 },
    ]),
    nominas465: ok([]),                                                   // la de octubre aún sin devengar
    compras: ok({ facturas: [
      { num: "C9", proveedor: "Ferretería", pendiente: 217, fecha_vto: "2026-10-10", pagada_con_pleo: true, motivo_pleo: "duplicada con el gasto de Pleo P-77" },
      { num: "C10", proveedor: "Almacén", pendiente: 18559, fecha_vto: "2026-10-20" },
    ] }),
    rentab: {
      ccpp_a: ok({ previsto: {}, real: { beneficio_real: 15000 } }),
      ccpp_b: ok({ previsto: {}, real: { beneficio_real: 12000 } }),
      ccpp_c: ok({ previsto: {}, real: { beneficio_real: 7500 } }),
    },
  };
}

const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);
const r = C.calcularEscalera(fuentes(), HOY, AHORA, { pleo_manual: 743 });

// línea a línea (tabla del encargo)
assert.strictEqual(L(r, "T2").importe, 743);
assert.strictEqual(L(r, "D3").importe, 14188);
assert.strictEqual(L(r, "D6").importe, 18559);
assert.strictEqual(L(r, "D7").importe, 0);
assert.strictEqual(L(r, "D8").importe, 5025);
assert.strictEqual(L(r, "D9").importe, 3411);
assert.strictEqual(L(r, "D13").importe, 17650);
assert.strictEqual(L(r, "D14").importe, 6900);                          // 20 % de 34.500

// cifras finales: ≈ 4.883 / ≈ −11.902 (± 2 %)
const cerca = (v, obj) => Math.abs(v - obj) <= Math.abs(obj) * 0.02;
assert.ok(cerca(r.kpis.dinero_empresa_antes_is, 4883), `normal ${r.kpis.dinero_empresa_antes_is}`);
assert.ok(cerca(r.kpis.dinero_empresa_prudente, -11902), `prudente ${r.kpis.dinero_empresa_prudente}`);
assert.strictEqual(r.completo, true, JSON.stringify(r.faltan));

// ni TGSS ni nóminas en rojo
const p = P.calcularPanel(fuentes(), r, HOY);
const rojas = p.alerta_patrimonial.senales.filter((s) => s.nivel === "rojo").map((s) => s.texto);
assert.ok(!rojas.some((t) => /Seguridad Social/.test(t)), rojas.join(" | "));
assert.ok(!rojas.some((t) => /Nóminas/.test(t)), rojas.join(" | "));
assert.ok(!r.avisos.some((a) => a.nivel === "rojo" && /sincronizar/.test(a.texto)));

// fuera de la escalera: local 13 y neto con Araviva (11.850 + 20.000 − 40.000)
assert.strictEqual(r.fuera.find((x) => x.id === "F2").importe, 20000);
assert.strictEqual(r.fuera.find((x) => x.id === "F4").importe, -8150);

// Pleo: sin el saldo puesto a mano, T2 sale «sin dato» (nunca 0) y el total incompleto
const sinPleo = C.calcularEscalera(fuentes(), HOY, AHORA);
assert.strictEqual(L(sinPleo, "T2").importe, null);
assert.strictEqual(sinPleo.completo, false);

// ── Ajustes tras la prueba en producción (03/10) ──────────────
// D6: compras pagadas con Pleo que Holded no marca → config_dinero compras_pagadas_pleo
{
  const f = fuentes();
  f.compras.data.facturas = [
    { num: "RZ-1", proveedor: "RiesgoZero", pendiente: 120, fecha_vto: "2026-10-10" },
    { num: "RZ-2", proveedor: "RiesgoZero", pendiente: 97, fecha_vto: "2026-10-10" },
  ];
  f.config.data.push({ clave: "compras_pagadas_pleo", valor: "RZ-1, RZ-2" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.strictEqual(L(x, "D6").importe, 18559);
  assert.ok(L(x, "D6").detalle.some((d) => /RZ-1.*compras_pagadas_pleo/.test(d.concepto)));
}
// D7: con nómina pendiente y el banco por delante del libro → aviso ámbar
{
  const f = fuentes();
  f.banco.data = f.banco.data.filter((a) => !/NOMINA/.test(a.descripcion));   // transferencias sin conciliar
  f.cuadre = ok({ saldo_banco: 86023, saldo_movimientos: 97023, ultimo_apunte: "2026-10-01" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.ok(L(x, "D7").importe > 0);
  assert.ok(x.avisos.some((a) => a.nivel === "ambar" && /puede que la nómina ya esté pagada y sin conciliar.*01\/10/.test(a.texto)));
  // sin descuadre ni sincronización posterior, no hay aviso
  const y = C.calcularEscalera({ ...f, cuadre: ok({ saldo_banco: 97023, saldo_movimientos: 97023, ultimo_apunte: "2026-10-03" }) }, HOY, AHORA, { pleo_manual: 743 });
  assert.ok(!y.avisos.some((a) => /nómina ya esté pagada y sin conciliar/.test(a.texto)));
}
// D3: el detalle enseña los cargos de la AEAT sin aplicar
{
  const f = fuentes();
  f.obligaciones.data.cargos_aeat_posteriores = [{ fecha: "2026-09-21", importe: 1242.11, descripcion: "DOMICILIACION IMPUESTO", usado: true },
                                                  { fecha: "2026-09-25", importe: 1241.82, descripcion: "DOMICILIACION IMPUESTO X", usado: false }];
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.ok(L(x, "D3").detalle.some((d) => d.informativo && /Cargo AEAT 25\/09 sin aplicar/.test(d.concepto)));
  assert.strictEqual(L(x, "D3").importe, 14188);       // informativo: no cambia la línea
}

console.log(`OK dinero-empresa-03-10.test · normal ${r.kpis.dinero_empresa_antes_is} · prudente ${r.kpis.dinero_empresa_prudente}`);

module.exports = { fuentes, HOY, AHORA };
