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
        { concepto: "Aplazamiento", tipo: "aplazamiento", pendiente: 12, plazos: [{ fecha: "2026-09-21", estado: "sin_confirmar" }] },
      ],
      proximos: [
        { fecha: "2026-10-20", importe: 12, que: "Plazo aplazamiento" },
        { fecha: "fin de mes", importe: 40, que: "Cotización (estimado)" },   // TGSS: va aparte
      ],
    }),
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
    config: ok([{ clave: "nomina_neta_mensual", valor: 80 }, { clave: "nomina_dia_pago", valor: 30 }, { clave: "poliza_dispuesta", valor: 0 }]),
    banco: ok([{ fecha: "2026-08-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 40 }]),
    nominas465: ok([]),
    compras: ok({ facturas: [
      { num: "C1", proveedor: "Prov 1", pendiente: 30, fecha_vto: "2026-09-20", vencida: true },   // vencida → semana 1
      { num: "C2", proveedor: "Prov 2", pendiente: 25, fecha_vto: "2026-10-08" },                  // semana 2
      { num: "C3", proveedor: "Prov 3", pendiente: 5, fecha_vto: null },                           // sin vto: nota
      { num: "C4", proveedor: "Prov 4", pendiente: 99, fecha_vto: "2026-11-30" },                  // fuera de las 4 semanas
    ] }),
    rentab: {},
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
assert.ok(al.senales.some((s) => /Sociedad X: sin calendario de devolución ni contrato/.test(s.texto)));
assert.ok(!al.senales.some((s) => /Seguridad Social/.test(s.texto)));   // el recibo que vencía en agosto está cargado

// causa de disolución → roja
const f2 = fuentes();
f2.clientes.data.patrimonio.en_causa_disolucion = true;
const al2 = P.calcularPanel(f2, C.calcularEscalera(f2, HOY, AHORA), HOY).alerta_patrimonial;
assert.ok(al2.senales.some((s) => s.nivel === "rojo" && /Causa de disolución/.test(s.texto)));

// recibo de la SS de agosto sin cargar en septiembre → roja
const f3 = fuentes();
f3.banco = ok([{ fecha: "2026-07-31", descripcion: "RECIBO TGSS. COTIZACION 001 REGIMEN GENERAL", salida: 40 }]);
const al3 = P.calcularPanel(f3, C.calcularEscalera(f3, HOY, AHORA), HOY).alerta_patrimonial;
assert.ok(al3.senales.some((s) => s.nivel === "rojo" && /Seguridad Social que vencía en 2026-08/.test(s.texto)));

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

assert.strictEqual(P.ultimoHabil("2026-10"), "2026-10-30");   // 31/10 es sábado
console.log("OK panel-empresa-calculo.test");
