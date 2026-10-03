// Prueba de aceptación del encargo «desfase banco / conciliación» (03/10/2026).
// Foto de los 27 movimientos sin conciliar de la ES81 de ese día (sin red).
// Las cifras de la escalera se calibran para que el valor CONTABLE sea el de
// producción (−14.713 / −31.498) y se comprueba el valor REAL.
// Uso: node lib/conciliacion-03-10.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const K = require("./conciliacion-provisional.cjs");
const T = require("./dinero-empresa-03-10.test.cjs");   // fuentes base del 03/10 (también se ejecuta su test)

const ok = (data) => ({ ok: true, data });
const mv = (id, date, amount, description) => ({ id, date, amount, description, pendingToReconcile: amount });
const T_ = "TRANSFERENCIA INMEDIATA A FAVOR DE";
// El encargo da 27 movimientos por −13.502,55 (entradas +752,43 / salidas
// −14.254,98), entre ellos la recarga de Pleo del 02/10 (−1.000).
const FOTO = {
  generado: "2026-10-03T08:45:00Z", cuenta: "es81", last_sync_at: "2026-10-03T08:40:25+00:00",
  movimientos: [
    mv("n1", "2026-10-02", -1620.22, `${T_} Miguel Angel Espada Perez CONCEPTO Nomina Septiembre`),
    mv("n2", "2026-10-02", -1173.25, `${T_} Miguel Angel Espada Rebollo CONCEPTO Nomina Septiembre`),
    mv("n3", "2026-10-02", -1369.51, `${T_} Antonio Ramirez Romero CONCEPTO Nomina Septiembre`),
    mv("n4", "2026-10-02", -1420.61, `${T_} Manuel Espada Rebollo CONCEPTO Nomina Septiembre`),
    mv("n5", "2026-10-02", -1236.03, `${T_} Cristhian Arturo Arias Caicero CONCEPTO Nomina Septiembre`),
    mv("a1", "2026-08-30", -2000.00, `${T_} Jose Alberto Araujo Puerta CONCEPTO Nomina Agosto`),
    mv("a2", "2026-09-29", -2000.00, `${T_} Jose Alberto Araujo Puerta CONCEPTO Nomina Septiembre`),
    mv("s1", "2026-10-01", -1211.89, "0000NOTIFICACIONES SIR."),
    mv("al1", "2026-10-01", -751.78, "RECIBO ALLIANZ SEGUROS"),
    mv("al2", "2026-10-01", 751.78, "GESTION DE DEVOLUCIONES -EXTERIOR"),
    mv("sa1", "2026-10-01", -210.29, "RECIBO SANITAS SA DE SEGUROS"),
    mv("sa2", "2026-10-01", -44.00, "RECIBO SANITAS SA DE SEGUROS"),
    mv("e1", "2026-09-22", -41.08, "RECIBO ENDESA ENERGIA"),
    mv("r1", "2026-09-23", -70.20, "COMPRA EN REGISTRO DE LA, SEVILLA"),
    mv("p1", "2026-09-30", -46.97, "RECIBO PLANETA SEGUROS"),
    mv("p2", "2026-09-30", -11.97, "RING BASIC PLAN"),
    mv("f1", "2026-09-10", -35.09, "COMPRA FIXNER"),
    mv("k1", "2026-09-12", -1.50, "PARKING"), mv("k2", "2026-09-15", -0.50, "PARKING"), mv("k3", "2026-09-17", -0.75, "PARKING"),
    mv("k4", "2026-09-19", -2.20, "PARKING"), mv("k5", "2026-09-24", -2.40, "PARKING"), mv("g1", "2026-09-26", -1.99, "GOOGLE ONE"),
    mv("k6", "2026-09-27", -1.25, "PARKING"), mv("k7", "2026-09-29", -1.50, "PARKING"),
    mv("pl", "2026-10-02", -1000.00, `${T_} Pleo Financial Services A/S CONCEPTO Recarga Pleo`),
    mv("d1", "2026-09-28", 0.65, "DEVOLUCION PARKING"),
  ],
};
// Nóminas de septiembre pendientes por persona (465). La de Cristhian, en dos.
const NOMINAS = [
  { nombre: "Miguel Angel Espada Perez", periodo: "2026-09", importe: 1620.22 },
  { nombre: "Miguel Angel Espada Rebollo", periodo: "2026-09", importe: 1173.25 },
  { nombre: "Antonio Ramirez Romero", periodo: "2026-09", importe: 1369.51 },
  { nombre: "Manuel Espada Rebollo", periodo: "2026-09", importe: 1420.61 },
  { nombre: "Cristhian Arturo Arias Caicero", periodo: "2026-09", importe: 1217.92 },
  { nombre: "Cristhian Arturo Arias Caicero", periodo: "2026-09", importe: 18.11 },
];

// ── la foto, regla a regla ────────────────────────────────────
assert.strictEqual(FOTO.movimientos.length, 27);
const k = K.casarMovimientos(FOTO, { hoy: "2026-10-03", lineas: { D7: 5795.14, D8: 5025, D3: 15429.82, D6: 18775.77, T3: 40000 }, nominas: NOMINAS });
assert.strictEqual(k.desfase_conciliacion, -13502.55);
assert.deepStrictEqual(k.detalle.filter((d) => d.regla === "R1").map((d) => d.id).sort(), ["n1", "n2", "n3", "n4", "n5"]);
assert.strictEqual(k.ajustes.D7, 5795.14);                                  // nunca más de lo que D7 tiene
assert.ok(k.detalle.find((d) => d.id === "n5").casado.includes("2 nóminas"));
assert.deepStrictEqual(k.sin_casar.map((x) => [x.id, x.regla]), [["a1", "R2"], ["a2", "R2"], ["s1", "SIR"]]);
assert.strictEqual(k.anulados.length, 1);                                   // Allianz ida/vuelta
assert.ok(!k.sin_documento.some((x) => /ALLIANZ|DEVOLUCIONES|NOMINA|SIR/.test(x.concepto)));
// sin documento: los recibos y compras sueltos (~475 €); la recarga de Pleo, como traspaso
assert.ok(Math.abs(k.sin_documento_total + 475) < 5, String(k.sin_documento_total));
assert.deepStrictEqual(k.traspasos.map((x) => [x.id, x.importe]), [["pl", -1000]]);
assert.ok(!k.sin_documento.some((x) => /PLEO/i.test(x.concepto)));
assert.strictEqual(k.ambiguos.length, 0);

// ── la escalera: contable −14.713 / −31.498 y real ≈ −8.918 / −25.703 ──
function fuentes() {
  const f = T.fuentes();
  f.compras.data.facturas[0].pagada_con_pleo = false;                       // RiesgoZero sin quitar
  f.clientes.data.saldos_por_cuenta["46500000"] = -5795.14;                  // D7 de producción
  f.banco.data = f.banco.data.filter((a) => !/NOMINA/.test(a.descripcion));  // las transferencias, sin conciliar
  f.cuadre = ok({ saldo_banco: 42053.84, saldo_movimientos: 110301.36, ultimo_apunte: "2026-10-01" });
  f.foto = ok(FOTO);
  f.nominasPendientes = ok(NOMINAS);
  return f;
}
const AHORA = "2026-10-03T10:21:00Z";
const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);
// calibrar T1 para que el contable sea el de producción
let f = fuentes();
const base = C.calcularEscalera(f, T.HOY, AHORA, { pleo_manual: 743 });
const ajusteT1 = -14713 - base.kpis.valor_contable.normal;
const conT1 = () => { const x = fuentes(); x.tesoreria.data.total_eur += ajusteT1; return x; };

const r = C.calcularEscalera(conT1(), T.HOY, AHORA, { pleo_manual: 743 });
assert.strictEqual(L(r, "D7").importe, 5795.14);
assert.deepStrictEqual(r.kpis.valor_contable, { normal: -14713, prudente: -31498 });
assert.ok(Math.abs(r.kpis.valor_real.normal - -8918) <= 1, String(r.kpis.valor_real.normal));
assert.ok(Math.abs(r.kpis.valor_real.prudente - -25703) <= 1, String(r.kpis.valor_real.prudente));
assert.strictEqual(r.ajuste_conciliacion.ajustes.D7, 5795.14);              // D7 baja a 0 en el real
// aviso de 68.248 separado: desfase (rojo) + histórico (ámbar)
assert.ok(!r.avisos.some((a) => /no cuadran por 68\.248/.test(a.texto)));
// foto fresca y ajustada: ámbar, con el texto de Alberto
assert.ok(r.avisos.some((a) => a.nivel === "ambar" && a.texto === "Falta conciliar en Holded 27 movimientos (-13.503 €). Las cifras ya los tienen en cuenta."), r.avisos.map((a) => a.texto).join("\n"));
assert.ok(!r.avisos.some((a) => a.nivel === "rojo" && /conciliar/.test(a.texto)));
assert.ok(r.avisos.some((a) => a.nivel === "ambar" && /Descuadre histórico banco − libro: -54\.745 €/.test(a.texto)));
assert.strictEqual(r.cuadre_banco.descuadre_historico_actual, -54744.97);
assert.strictEqual(r.provisional, false);
// frescura: lastSyncAt de la foto
assert.strictEqual(r.frescura.banco_sincronizacion, "al_dia");

// ── vista real: todo Mi panel «como si estuviera todo conciliado» ──
{
  const D = require("../ara-os-dinero-empresa.cjs");
  const d = D.componer({ fuentes: conT1(), hoy: T.HOY, generado: AHORA, tiposBanco: {} }, { pleo_manual: 743 });
  const R = d.real;
  // «A quién debo»: 244.316 contable → 238.521 real (−5.795 de las nóminas)
  assert.strictEqual(R.kpis.total_debo, Math.round((d.kpis.total_debo - 5795.14) * 100) / 100);
  assert.strictEqual(R.kpis.dinero_empresa_antes_is, d.kpis.valor_real.normal);
  assert.strictEqual(R.kpis.dinero_empresa_prudente, d.kpis.valor_real.prudente);
  // el resumen cuadra con su desglose
  assert.strictEqual(Math.round(R.debo.reduce((t, l) => t + (l.importe || 0), 0) * 100) / 100, R.kpis.total_debo);
  const d7 = R.debo.find((l) => l.id === "D7");
  assert.strictEqual(d7.importe, 0);
  assert.strictEqual(d7.importe_contable, 5795.14);
  assert.strictEqual(d7.ajuste_conciliacion.texto, "5.795 € pagados el 02/10, falta conciliar en Holded");
  assert.ok(!/No consta pagada/.test(d7.nota || ""), d7.nota);                 // casada en la foto: sin la nota
  assert.ok(/No consta pagada/.test(d.debo.find((l) => l.id === "D7").nota || ""));   // en la contable sigue
  // tarjetas: las nóminas ya pagadas no salen en la previsión ni en el umbral, ni en rojo en la 4
  const nomR = R.panel.prevision_semanal.semanas.flatMap((x) => x.salidas).filter((x) => x.tipo === "nomina" && /2026-09/.test(x.concepto));
  const nomC = d.panel.prevision_semanal.semanas.flatMap((x) => x.salidas).filter((x) => x.tipo === "nomina" && /2026-09/.test(x.concepto));
  assert.ok(nomC.length === 1 && nomR.length === 0, JSON.stringify([nomC, nomR]));
  assert.strictEqual(R.panel.umbral_mio_hoy, Math.round((d.panel.umbral_mio_hoy - 5795.14) * 100) / 100);
  assert.ok(R.panel.prevision_semanal.minimo.saldo > d.panel.prevision_semanal.minimo.saldo);
  assert.ok(!R.panel.alerta_patrimonial.senales.some((x) => x.nivel === "rojo" && /Nóminas/.test(x.texto)));
  assert.ok(R.panel.alerta_patrimonial.senales.some((x) => x.nivel === "ambar" && /Nóminas pagadas en el banco.*falta conciliar en Holded/.test(x.texto)));
  assert.ok(d.panel.alerta_patrimonial.senales.some((x) => x.nivel === "rojo" && /Nóminas/.test(x.texto)));   // la contable sí
}

// con RiesgoZero quitado (compras_pagadas_pleo): ≈ −8.701 / −25.486
const f2 = conT1();
f2.config.data.push({ clave: "compras_pagadas_pleo", valor: "C9" });
const r2 = C.calcularEscalera(f2, T.HOY, AHORA, { pleo_manual: 743 });
assert.ok(Math.abs(r2.kpis.valor_real.normal - -8701) <= 1, String(r2.kpis.valor_real.normal));
assert.ok(Math.abs(r2.kpis.valor_real.prudente - -25486) <= 1, String(r2.kpis.valor_real.prudente));

// el histórico cambia > 100 € respecto al guardado → rojo
const f3 = conT1();
f3.config.data.push({ clave: "descuadre_historico_572", valor: 54500 }, { clave: "descuadre_historico_572_fecha", valor: "2026-10-03" });
assert.ok(C.calcularEscalera(f3, T.HOY, AHORA, { pleo_manual: 743 }).avisos.some((a) => a.nivel === "rojo" && /histórico banco − libro ha cambiado/.test(a.texto)));

// foto de más de 36 h → no se ajusta nada
const f4 = conT1();
f4.foto = ok({ ...FOTO, generado: "2026-10-01T08:00:00Z" });
const r4 = C.calcularEscalera(f4, T.HOY, AHORA, { pleo_manual: 743 });
assert.deepStrictEqual(r4.kpis.valor_real.normal, r4.kpis.valor_contable.normal);
assert.ok(r4.avisos.some((a) => a.nivel === "rojo" && /Desfase de conciliación sin medir desde 01\/10/.test(a.texto)));
assert.strictEqual(r4.real, null);

// ── reglas sueltas ─────────────────────────────────────────────
{
  const ctx = (extra) => ({ hoy: "2026-10-03", lineas: { D7: 0, D8: 5025, D3: 15429.82, D6: 1000, T3: 50000 }, ...extra });
  // R3 TGSS ± 5 %
  let x = K.casarMovimientos({ movimientos: [mv("t", "2026-09-30", -5100, "RECIBO TGSS. COTIZACION 001")] }, ctx({ recibo_tgss: { importe: 5025, vence: "2026-10-30" } }));
  assert.strictEqual(x.ajustes.D8, 5025);
  // R4 plazo AEAT ± 5 días, ± 0,05
  x = K.casarMovimientos({ movimientos: [mv("a", "2026-10-21", -1246.23, "DOMICILIACION IMPUESTO ABONARE A.E.A.T")] }, ctx({ plazos_aeat: [{ fecha: "2026-10-20", importe: 1246.23, concepto: "IVA 2024" }] }));
  assert.strictEqual(x.ajustes.D3, 1246.23);
  // R5 compra por su pendiente; dos compras iguales sin proveedor en el concepto → ambiguo
  x = K.casarMovimientos({ movimientos: [mv("c", "2026-10-01", -120, "RECIBO RIESGOZERO SL")] }, ctx({ compras: [{ num: "C1", proveedor: "RiesgoZero SL", pendiente: 120, fecha: "2026-09-20" }, { num: "C2", proveedor: "Otro SL", pendiente: 120, fecha: "2026-09-20" }] }));
  assert.strictEqual(x.ajustes.D6, 120);
  x = K.casarMovimientos({ movimientos: [mv("c", "2026-10-01", -120, "RECIBO")] }, ctx({ compras: [{ num: "C1", proveedor: "Uno SL", pendiente: 120, fecha: "2026-09-20" }, { num: "C2", proveedor: "Dos SL", pendiente: 120, fecha: "2026-09-20" }] }));
  assert.strictEqual(x.ajustes.D6, 0);
  assert.strictEqual(x.ambiguos.length, 1);
  // R6 remesa EMASESA: suma exacta de varias facturas del mismo cliente
  const fs = [["F1", 10000], ["F2", 12000], ["F3", 16196], ["F4", 999]].map(([numero, p], i) => ({ numero, cliente: "EMASESA", pendiente: p, fecha: `2026-09-0${i + 1}` }));
  x = K.casarMovimientos({ movimientos: [mv("e", "2026-10-05", 38196, "REMESA EMASESA")] }, ctx({ facturas: fs }));
  assert.strictEqual(x.ajustes.T3, 38196);
  assert.strictEqual(x.ajuste_valor, -38196);                               // un cobro sin conciliar baja el valor
  // R7 custodia
  x = K.casarMovimientos({ movimientos: [mv("v", "2026-10-02", 300, "TRANSFERENCIA VECINO PLAN CINCO")] }, ctx({}));
  assert.strictEqual(x.detalle[0].regla, "R7");
  assert.strictEqual(x.ajuste_valor, 0);
}

// ── nóminas pendientes por persona desde la 465 ──────────────
{
  const ap = [
    { fecha: "2026-09-30", descripcion: "Nomina septiembre Espada Rebollo Manuel", haber: 1420.61, debe: 0 },
    { fecha: "2026-09-30", descripcion: "Nomina septiembre Arias Caicero Cristhian Arturo", haber: 1217.92, debe: 0 },
    { fecha: "2026-09-30", descripcion: "Nomina septiembre Arias Caicero Cristhian Arturo (atrasos)", haber: 18.11, debe: 0 },
    { fecha: "2026-09-03", descripcion: "Nomina agosto Espada Rebollo Manuel", haber: 1400, debe: 0 },
    { fecha: "2026-09-03", descripcion: "Pago nomina agosto Espada Rebollo Manuel", haber: 0, debe: 1400 },
  ];
  const np = K.nominasPendientes(ap, {}, ["2026-09", "2026-10"]);
  assert.deepStrictEqual(np.map((n) => [n.periodo, n.importe]), [["2026-09", 1420.61], ["2026-09", 1217.92], ["2026-09", 18.11]]);
  // y casan con las transferencias aunque el orden de nombre y apellidos cambie
  const x = K.casarMovimientos({ movimientos: [FOTO.movimientos[3], FOTO.movimientos[4]] }, { hoy: "2026-10-03", lineas: { D7: 5000 }, nominas: np });
  assert.strictEqual(x.ajustes.D7, 2656.64);
  // 465 en bloque (sin nombres): nombres de la nómina importada, sin importe
  const bloque = K.nominasPendientes([{ fecha: "2026-09-30", descripcion: "Nominas 09/2026", haber: 5795.14, debe: 0 }], { "2026-09": ["ESPADA PEREZ MIGUEL ANGEL"] }, ["2026-09", "2026-10"]);
  assert.deepStrictEqual(bloque, [{ nombre: "ESPADA PEREZ MIGUEL ANGEL", periodo: "2026-09", importe: null, fuente: "nominas_mes" }]);
}

// ── validación del POST ───────────────────────────────────────
{
  process.env.HOLDED_API_TOKEN = process.env.HOLDED_API_TOKEN || "x";
  const D = require("../ara-os-dinero-empresa.cjs");
  assert.ok(D.validarFoto({}).error);
  assert.ok(D.validarFoto({ generado: "2026-10-03T08:45:00Z", movimientos: [{ date: "2026-10-02" }] }).error);
  const v = D.validarFoto({ ...FOTO, movimientos: [...FOTO.movimientos, mv("ok", "2026-10-02", -10, "CONCILIADO")].map((m) => (m.id === "ok" ? { ...m, pendingToReconcile: 0 } : m)) });
  assert.strictEqual(v.foto.movimientos.length, 27);                       // el conciliado (pendiente 0) fuera
  assert.strictEqual(v.foto.last_sync_at, "2026-10-03T08:40:25.000Z");
}

console.log(`OK conciliacion-03-10.test · contable ${r.kpis.valor_contable.normal} / ${r.kpis.valor_contable.prudente} · real ${r.kpis.valor_real.normal} / ${r.kpis.valor_real.prudente} · con RiesgoZero ${r2.kpis.valor_real.normal} / ${r2.kpis.valor_real.prudente}`);

module.exports = { FOTO, NOMINAS, fuentes: conT1, AHORA };
