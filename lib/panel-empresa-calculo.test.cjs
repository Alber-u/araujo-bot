// Test de la sección 9 (previsión semanal, alerta patrimonial) con datos
// INVENTADOS. Uso: node lib/panel-empresa-calculo.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const P = require("./panel-empresa-calculo.cjs");

const HOY = "2026-09-29";   // martes · semanas: 29/09-05/10, 06-12/10, 13-19/10, 20-26/10
const AHORA = "2026-09-29T10:00:00Z";
const ok = (data) => ({ ok: true, data });

function fuentes() {
  return {
    tesoreria: ok({ total_eur: 1000, cuentas: [], pleo: { saldo: 50 } }),
    clientes: ok({
      ok: true, generado: AHORA, total: 0, por_tramo: {}, clientes: [], balance: {}, local13: {},
      patrimonio: { en_causa_disolucion: false, ajustado: 900, umbral_disolucion: 500, ajustes: [] },
      saldos_por_cuenta: { "56000001": -20, "46500000": -15 },
    }),
    custodias: ok({ totales: { en_custodia: 600 } }),
    obligaciones: ok({
      generado: AHORA, resumen: { deuda_total: 5 }, periodicos: [], recurrentes: [],
      expedientes: [
        { concepto: "Sanción", tipo: "ejecutivo", pendiente: 5, plazos: [] },
        { concepto: "Aplazamiento", tipo: "aplazamiento", pendiente: 12, plazos: [{ fecha: "2026-09-21", importe: 12, estado: "sin_confirmar" }, { fecha: "2026-10-20", importe: 12, estado: "pendiente" }] },
      ],
      proximos: [
        { fecha: "2026-10-20", importe: 12, que: "Plazo aplazamiento" },
        { fecha: "fin de mes", importe: 40, que: "Cotización (estimado)" },   // TGSS: va aparte
      ],
    }),
    p5: ok({ grupos: {} }),
    ot: ok({ grupos: {} }),
    oo: ok({ obras: [] }),
    iva: ok({ iva_resultado: 0, iva_repercutido: 0, iva_soportado: 0 }),
    invoices: ok([
      { id: "a", numero: "F1", cliente: "Cliente A", fecha: "2026-09-15", fecha_vto: "2026-10-10", pdte_cobro_eur: 100 },
      { id: "b", numero: "F2", cliente: "Cliente B", fecha: "2026-05-01", fecha_vto: "2026-05-31", pdte_cobro_eur: 70 },  // +90 días: fuera
      { id: "c", numero: "F3", cliente: "Cliente C", fecha: "2026-09-20", fecha_vto: null, pdte_cobro_eur: 60 },          // sin vto → 20/10
      { id: "d", numero: "F4", cliente: "Cliente D", fecha: "2026-09-01", fecha_vto: "2026-09-15", pdte_cobro_eur: 0 },   // cobrada
    ]),
    tags: ok({}),
    prestamos: ok([
      { id: "r1", tipo: "recibido", contraparte: "Banco", cuotas_detalle: "2026-10-15:10;2026-11-15:10" },
      { id: "c1", tipo: "concedido", contraparte: "Sociedad X", principal: 30, periodicidad: "ninguna", nota: "sin contrato" },
    ]),
    config: ok([{ clave: "nomina_neta_mensual", valor: 80 }, { clave: "nomina_dia_pago", valor: 30 }, { clave: "poliza_dispuesta", valor: 0 },
                { clave: "tecnico_pct", valor: 0.2 }, { clave: "tecnico_ambito", valor: "plan5" }]),
    banco: ok([{ fecha: "2026-08-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 40 }]),
    nominas465: ok([]),
    compras: ok({ facturas: [
      { num: "C1", proveedor: "Prov 1", pendiente: 30, fecha_vto: "2026-09-20", vencida: true },   // vencida → semana 1
      { num: "C2", proveedor: "Prov 2", pendiente: 25, fecha_vto: "2026-10-08" },                  // semana 2
      { num: "C3", proveedor: "Prov 3", pendiente: 5, fecha_vto: null },                           // sin vto: nota
      { num: "C4", proveedor: "Prov 4", pendiente: 99, fecha_vto: "2026-11-30" },                  // fuera de las 4 semanas
    ] }),
    rentab: {},
    cuadre: ok({ saldo_banco: 1000, saldo_movimientos: 1000 }),
  };
}

const f = fuentes();
const esc = C.calcularEscalera(f, HOY, AHORA);
assert.strictEqual(esc.kpis.mio_hoy, 430);                 // 1000 + 50 − 600 − 20
const p = P.calcularPanel(f, esc, HOY);

// ── previsión semanal ────────────────────────────────────────
const pv = p.prevision_semanal;
assert.strictEqual(pv.inicial, 430);
assert.deepStrictEqual(pv.semanas.map((s) => [s.desde, s.hasta]), [
  ["2026-09-29", "2026-10-05"], ["2026-10-06", "2026-10-12"], ["2026-10-13", "2026-10-19"], ["2026-10-20", "2026-10-26"],
]);
// S1: nóminas 80 (30/09) + SS 40 (30/09) + proveedor vencido 30 = 150
assert.deepStrictEqual(pv.semanas.map((s) => [s.entra, s.sale]), [[0, 150], [100, 25], [0, 10], [60, 12]]);
assert.deepStrictEqual(pv.semanas.map((s) => s.saldo), [280, 355, 345, 393]);
assert.deepStrictEqual(pv.minimo, { saldo: 280, semana: 1, desde: "2026-09-29", hasta: "2026-10-05" });
assert.strictEqual(pv.completo, true);
assert.ok(pv.notas.some((n) => /1 factura\(s\) de proveedor sin vencimiento/.test(n)));
assert.ok(!pv.semanas.flatMap((s) => s.salidas).some((x) => /Cotización/.test(x.concepto)));  // la TGSS de /obligaciones no se duplica

// ── umbral tarjeta 1 ─────────────────────────────────────────
assert.strictEqual(p.umbral_mio_hoy, 120);                   // nóminas 80 + SS 40

// ── alerta patrimonial ───────────────────────────────────────
const al = p.alerta_patrimonial;
assert.strictEqual(al.completo, true, JSON.stringify(al.faltan));
assert.strictEqual(al.rojas, 2);                             // ejecutivo + nóminas atrasadas (465 sin la de septiembre)
assert.strictEqual(al.ambar, 2);                             // plazo sin confirmar + préstamo sin calendario
assert.ok(al.senales.some((s) => /Préstamo concedido a Sociedad X: sin calendario de devolución ni contrato/.test(s.texto)));
assert.ok(!al.senales.some((s) => /Seguridad Social/.test(s.texto)));   // el recibo que vencía en agosto está cargado

// ── 10.1 · patrimonio: contable hoy y estimado al cierre ─────
// Datos inventados: capital 100 (umbral 50), contabilizado 60, ajuste −90
// → contable −30. Obra: Uno (fase 12, 100 de pto, 4 h de 240/30 = 8 → 50),
// Dos (fase 13, 200 de pto, sin mano de obra prevista → no cuenta y avisa) y Luna 7 (17,
// 1000) → obra 1050. Anticipos 438 = 110 → 100 sin IVA. Cierre −30+1050+100.
function fuentesPat() {
  const f = fuentes();
  f.clientes.data.patrimonio = { capital_social: 100, contabilizado: 60, ajustes: [{ concepto: "Deterioro", importe: -90 }], ajustado: -30, umbral_disolucion: 50, en_causa_disolucion: true };
  f.clientes.data.saldos_por_cuenta["43800000"] = -110;
  f.ot = ok({ grupos: {
    "12_INICIO_OBRA": [{ comunidad: "Uno 1", ccpp_id: "ccpp_uno", pto_total: 100, tiempo_previsto: 0.5 }],
    "13_EN_EJECUCION": [{ comunidad: "Dos 2", ccpp_id: "ccpp_dos", pto_total: 200, tiempo_previsto: 0 }],
    "17_COBRO_EMASESA": [{ comunidad: "Luna 7", ccpp_id: "ccpp_luna", pto_total: 1000 }],
  } });
  f.rentab = {
    ccpp_uno: ok({ previsto: { mano_obra_previsto: 240 }, real: { mano_obra_horas: 4 } }),   // 240 / 30 = 8 h previstas
    ccpp_dos: ok({ previsto: { mano_obra_previsto: 0 }, real: { mano_obra_horas: 10 } }),    // sin previsto
    ccpp_luna: ok({ previsto: {}, real: { beneficio_real: 0 } }),                             // % técnico 0
  };
  return f;
}
{
  const f = fuentesPat();
  const esc = C.calcularEscalera(f, HOY, AHORA);
  const p = P.calcularPanel(f, esc, HOY);
  const pc = p.patrimonio_cierre;
  assert.strictEqual(pc.pn_contable_hoy, -30);
  assert.strictEqual(pc.obra_sin_facturar, 1050);             // 50 (Uno, 50 %) + 0 (Dos, sin previsto) + 1000
  assert.strictEqual(pc.anticipos_438_sin_iva, 100);
  assert.strictEqual(pc.pn_cierre_estimado, 1120);
  assert.strictEqual(pc.en_causa_disolucion, false);           // se decide con la estimada
  assert.strictEqual(pc.en_causa_disolucion_contable, true);
  assert.strictEqual(pc.nivel, "ambar");
  assert.ok(/falta facturar 1\.050 € de obra y 100 € de anticipos antes del 31\/12\. Con ello quedaría en ≈ 1\.120 €/.test(pc.texto), pc.texto);
  assert.ok(pc.componentes.find((c) => /Inmovilizado/.test(c.concepto)).fiabilidad === "sin_dato");
  const obraC = pc.componentes.find((c) => /Obra ejecutada/.test(c.concepto));
  assert.ok(obraC.detalle.some((d) => d.concepto === "Uno 1" && /50 %/.test(d.nota)));
  assert.ok(obraC.detalle.some((d) => d.concepto === "Dos 2" && d.importe === 0));
  assert.deepStrictEqual(pc.faltan, ["horas de Dos 2"]);
  // la T4 de la escalera NO cambia (la obra sin facturar sigue siendo obra sin facturar)
  assert.strictEqual(esc.tengo.find((l) => l.id === "T4").importe, 1300);
  // tarjeta 4: señal ámbar de disolución con su desplegable
  const sd = p.alerta_patrimonial.senales.find((x) => x.tipo === "disolucion");
  assert.strictEqual(sd.nivel, "ambar");
  assert.strictEqual(sd.detalle.pn_cierre_estimado, 1120);
  // fuera de noviembre-diciembre, sin aviso de calendario
  assert.strictEqual(p.aviso_cierre, null);
  // 15/11: aviso ámbar con los días que quedan
  const av = P.avisoCierre(pc, "2026-11-15");
  assert.ok(/^Quedan 46 días para el cierre: 1\.050 € de obra ejecutada y 100 € de anticipos sin facturar\. Si el ejercicio cierra así, el patrimonio contable queda en −30 €\.$/.test(av.texto), av.texto);
  assert.strictEqual(P.avisoCierre(pc, "2027-01-02"), null);
}
{ // rojo: ni con la obra llega al umbral
  const f = fuentesPat();
  f.clientes.data.patrimonio.ajustado = -2000;
  const pc = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY).patrimonio_cierre;
  assert.strictEqual(pc.nivel, "rojo");
  assert.strictEqual(pc.en_causa_disolucion, true);
}
{ // verde: las dos por encima del umbral
  const f = fuentesPat();
  f.clientes.data.patrimonio.ajustado = 500;
  const p = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY);
  assert.strictEqual(p.patrimonio_cierre.nivel, "verde");
  assert.ok(!p.alerta_patrimonial.senales.some((x) => x.tipo === "disolucion"));
}

// Caso real del 30/09: Mandarinas 2, 190 h de 8.250/30 = 275 h → 69 % de 21.009,47
{
  const f = fuentesPat();
  f.ot.data.grupos["13_EN_EJECUCION"] = [{ comunidad: "Mandarinas 2", ccpp_id: "m2", pto_total: 21009.47 }];
  f.rentab.m2 = ok({ previsto: { mano_obra_previsto: 8250 }, real: { mano_obra_horas: 190 } });
  const pc = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY).patrimonio_cierre;
  const m2 = pc.componentes.find((c) => /Obra ejecutada/.test(c.concepto)).detalle.find((d) => d.concepto === "Mandarinas 2");
  assert.strictEqual(m2.importe, 14515.63);
  assert.strictEqual(m2.nota, "ejecutado 69 % (190 h de 275 h)");
}

// ── 10.4 · el anticipo de obra sin ejecutar resta al cierre ───
{
  const f = fuentesPat();
  f.oo.data.obras.push({ obra_id: "OO9", nombre: "Urbano Orad 13-15", fase: "PRESUPUESTO", subtotal_eur: "35300", total_eur: "38830", holded_invoice_emitida_id: "u1" });
  f.invoices.data.push({ id: "u1", numero: "F260049", cliente: "CDAD PROP", fecha: "2026-09-25", subtotal: 17650, total: 19415, cobrado_eur: 19415, estado_logico: "cobrada", tags: [] });
  const pc = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY).patrimonio_cierre;
  assert.strictEqual(pc.anticipos_obra_sin_ejecutar, 17650);
  assert.strictEqual(pc.pn_cierre_estimado, 1120 - 17650);        // −16.530 → rojo
  assert.strictEqual(pc.nivel, "rojo");
  assert.strictEqual(pc.componentes.find((c) => /sin ejecutar/.test(c.concepto)).importe, -17650);
  // sin dato de D13 → sin estimación al cierre, nunca «verde»
  const f2 = fuentesPat(); f2.p5 = { ok: false, error: "x" };
  const pc2 = P.calcularPanel(f2, C.calcularEscalera(f2, HOY, AHORA), HOY).patrimonio_cierre;
  assert.strictEqual(pc2.pn_cierre_estimado, null);
  assert.ok(pc2.faltan.includes("anticipos de obra sin ejecutar"));
}

// ── 10.5 + 10.6 · al cierre restan el % del técnico y los gastos del banco sin contabilizar ──
{
  const f = fuentesPat();
  f.rentab.ccpp_luna = ok({ previsto: {}, real: { beneficio_real: 1000 } });     // 20 % = 200
  f.cuadre = ok({ saldo_banco: 1000, saldo_movimientos: 1500 });                  // el libro cree 500 € de más
  f.config.data.push({ clave: "descuadre_historico_572", valor: 450 }, { clave: "descuadre_historico_572_fecha", valor: "2026-09-30" });
  const esc = C.calcularEscalera(f, HOY, AHORA);
  const pc = P.calcularPanel(f, esc, HOY).patrimonio_cierre;
  assert.strictEqual(pc.tecnico_plan5, 200);
  assert.strictEqual(pc.gastos_banco_sin_contabilizar, -450);
  assert.strictEqual(pc.pn_cierre_estimado, 1120 - 200 - 450);
  const gb = pc.componentes.find((c) => c.concepto === "Gastos del banco sin contabilizar (histórico)");
  assert.strictEqual(gb.importe, -450);
  assert.strictEqual(pc.componentes.find((c) => c.concepto === "20 % técnico (Plan 5)").importe, -200);
  // sin cuadre legible: la cifra de la hoja, como gasto
  const f2 = fuentesPat(); f2.cuadre = { ok: false, error: "x" };
  f2.config.data.push({ clave: "descuadre_historico_572", valor: 450 });
  assert.strictEqual(P.calcularPanel(f2, C.calcularEscalera(f2, HOY, AHORA), HOY).patrimonio_cierre.gastos_banco_sin_contabilizar, -450);
  // descuadre sin cifra histórica: sin estimación al cierre
  const f3 = fuentesPat(); f3.cuadre = ok({ saldo_banco: 1000, saldo_movimientos: 1500 });
  const pc3 = P.calcularPanel(f3, C.calcularEscalera(f3, HOY, AHORA), HOY).patrimonio_cierre;
  assert.strictEqual(pc3.pn_cierre_estimado, null);
  assert.ok(pc3.faltan.includes("descuadre histórico del banco (descuadre_historico_572)"));
  // sin config del técnico: sin estimación al cierre
  const f4 = fuentesPat(); f4.config.data = f4.config.data.filter((c) => !c.clave.startsWith("tecnico"));
  assert.strictEqual(P.calcularPanel(f4, C.calcularEscalera(f4, HOY, AHORA), HOY).patrimonio_cierre.pn_cierre_estimado, null);
}

// ── 10.2.2 · factura cobrada en banco sin conciliar ──────────
{
  const f = fuentes();
  f.invoices.data.push({ id: "e", numero: "F260049", cliente: "Cliente E", fecha: "2026-09-20", fecha_vto: "2026-10-05", pdte_cobro_eur: 250 });
  f.clientes.data.total = 400;
  f.banco = ok([...f.banco.data,
    { fecha: "2026-09-27", descripcion: "TRANSF CLIENTE E FRA F260049", salida: -250, tipo: "" },
    { fecha: "2026-09-10", descripcion: "FRA F260049 (hace más de 10 días)", salida: -250, tipo: "" }]);
  const esc = C.calcularEscalera(f, HOY, AHORA);
  assert.ok(esc.avisos.some((a) => a.texto === "F260049 cobrada en banco (27/09), pendiente de conciliar."));
  assert.strictEqual(esc.tengo.find((l) => l.id === "T3").importe, 150);                  // 430 = 400 − 250 cobrada en banco
  const pv = P.calcularPanel(f, esc, HOY).prevision_semanal;
  assert.ok(!pv.semanas.flatMap((s) => s.entradas).some((x) => /^F260049 /.test(x.concepto)));   // ni en la previsión
  // sin el número en el concepto, o con otro importe: no se da por cobrada
  const f2b = fuentes();
  f2b.invoices.data.push({ id: "e", numero: "F260049", cliente: "Cliente E", fecha: "2026-09-20", pdte_cobro_eur: 250 });
  f2b.banco = ok([{ fecha: "2026-09-27", descripcion: "TRANSF CLIENTE E", salida: -250, tipo: "" }, { fecha: "2026-09-27", descripcion: "FRA F260049", salida: -249, tipo: "" }]);
  assert.strictEqual(C.cobrosEnBanco(f2b.invoices.data, f2b.banco.data, HOY).length, 0);
}

// ── 10.2.4 · siguiente pago grande fuera de la ventana ───────
{
  const f = fuentes();
  f.prestamos = ok([{ id: "r1", tipo: "recibido", contraparte: "Banco", cuotas_detalle: "2026-10-28:15075.06;2026-11-28:15075.06" }]);
  const pv = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY).prevision_semanal;
  assert.deepStrictEqual([pv.siguiente_pago_grande.fecha, pv.siguiente_pago_grande.importe], ["2026-10-28", 15075.06]);
  assert.ok(/Cuota préstamo Banco/.test(pv.siguiente_pago_grande.concepto));
}

// ── 10.2.5 · seguro anual en la previsión y en «sale en 30 días» ─
{
  const f = fuentes();
  f.config.data.push({ clave: "seguro_anual_importe", valor: 2700 }, { clave: "seguro_anual_mes", valor: 10 }, { clave: "seguro_anual_dia", valor: 10 });
  const pv = P.calcularPanel(f, C.calcularEscalera(f, HOY, AHORA), HOY).prevision_semanal;
  const seg = pv.semanas.flatMap((s) => s.salidas).find((x) => x.tipo === "seguro");
  assert.deepStrictEqual([seg.fecha, seg.importe, seg.concepto], ["2026-10-10", 2700, "Seguros anuales (vehículos)"]);
  const sinSeg = P.calcularPanel(fuentes(), C.calcularEscalera(fuentes(), HOY, AHORA), HOY).prevision_semanal;
  assert.strictEqual(r2test(pv.sale_30_dias - sinSeg.sale_30_dias), 2700);
  assert.ok(sinSeg.notas.some((n) => /Sin seguro anual/.test(n)));
  assert.deepStrictEqual(pv.pagos_anuales, [{ fecha: "2026-10-10", importe: 2700, concepto: "Seguros anuales (vehículos)" }]);
}
function r2test(n) { return Math.round(n * 100) / 100; }

// recibo de la SS de agosto sin cargar en septiembre → roja
const f3 = fuentes();
f3.banco = ok([{ fecha: "2026-07-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 40 }]);
const al3 = P.calcularPanel(f3, C.calcularEscalera(f3, HOY, AHORA), HOY).alerta_patrimonial;
assert.ok(al3.senales.some((s) => s.nivel === "rojo" && /Seguridad Social que vencía en 08\/2026/.test(s.texto)));

// fuente caída → incompleta, nunca verde
const f4 = fuentes();
f4.obligaciones = { ok: false, error: "timeout" };
f4.compras = { ok: false, error: "timeout" };
const p4 = P.calcularPanel(f4, C.calcularEscalera(f4, HOY, AHORA), HOY);
assert.strictEqual(p4.alerta_patrimonial.completo, false);
assert.ok(p4.alerta_patrimonial.faltan.includes("Hacienda"));
assert.strictEqual(p4.prevision_semanal.completo, false);
assert.deepStrictEqual(p4.prevision_semanal.faltan, ["proveedores", "Hacienda"]);

// sin «mío hoy» no hay saldo que prever
const f5 = fuentes();
f5.custodias = { ok: false, error: "x" };
const p5 = P.calcularPanel(f5, C.calcularEscalera(f5, HOY, AHORA), HOY);
assert.strictEqual(p5.prevision_semanal.minimo, null);
assert.strictEqual(p5.prevision_semanal.semanas[0].saldo, null);

// nomina_dia_pago 1-24 = mes siguiente: la de septiembre el 05/10, sin duplicar la de octubre
const f6 = fuentes();
f6.config.data = f6.config.data.map((r) => (r.clave === "nomina_dia_pago" ? { ...r, valor: 5 } : r));
const pv6 = P.calcularPanel(f6, C.calcularEscalera(f6, HOY, AHORA), HOY).prevision_semanal;
const nom6 = pv6.semanas.flatMap((s) => s.salidas).filter((x) => x.tipo === "nomina");
assert.deepStrictEqual(nom6.map((x) => [x.fecha, x.importe]), [["2026-10-05", 80]]);

// 10.5 · el % del técnico sale la semana en que entra cada cobro de Plan 5
{
  const f7 = fuentes();
  f7.ot = ok({ grupos: { "17_COBRO_EMASESA": [{ comunidad: "Palma 3", ccpp_id: "ccpp_palma", pto_total: 10000 }] } });
  f7.tags = ok({ ccpp_palma: ["palma3"] });
  f7.rentab = { ccpp_palma: ok({ previsto: {}, real: { beneficio_real: 4000 } }) };
  f7.invoices.data.push({ id: "p1", numero: "F260050", cliente: "EMASESA", subtotal: 10000, total: 11000, cobrado_eur: 0, pdte_cobro_eur: 11000,
                          fecha: "2026-09-10", fecha_vto: "2026-10-14", estado_logico: "emitida_pdte", tags: ["palma3"] });
  const esc7 = C.calcularEscalera(f7, HOY, AHORA);
  assert.strictEqual(esc7.debo.find((l) => l.id === "D14").importe, 800);
  const pv7 = P.calcularPanel(f7, esc7, HOY).prevision_semanal;
  const s3 = pv7.semanas[2];   // 13-19/10
  assert.ok(s3.entradas.some((x) => /F260050/.test(x.concepto) && x.importe === 11000));
  assert.ok(s3.salidas.some((x) => x.tipo === "tecnico" && x.importe === 800 && x.concepto === "20 % técnico · Palma 3 (F260050)"));
  // sin config del técnico: la previsión no inventa la salida
  const f8 = fuentes(); f8.ot = f7.ot; f8.tags = f7.tags; f8.rentab = f7.rentab; f8.invoices = f7.invoices;
  f8.config.data = f8.config.data.filter((c) => !c.clave.startsWith("tecnico"));
  const pv8 = P.calcularPanel(f8, C.calcularEscalera(f8, HOY, AHORA), HOY).prevision_semanal;
  assert.ok(!pv8.semanas.some((s) => s.salidas.some((x) => x.tipo === "tecnico")));
}

assert.strictEqual(P.ultimoHabil("2026-10"), "2026-10-30");   // 31/10 es sábado
console.log("OK panel-empresa-calculo.test");
