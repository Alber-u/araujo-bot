// Prueba de aceptación del encargo «cash flow claro» (03/10/2026), sin red.
// Uso: node lib/cashflow-03-10.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const CF = require("./cashflow-calculo.cjs");
const T = require("./dinero-empresa-03-10.test.cjs");
const D = require("../ara-os-dinero-empresa.cjs");

const ok = (data) => ({ ok: true, data });
const HOY = "2026-10-03", AHORA = "2026-10-03T10:21:00Z";

// ── regla de cobro: 2 meses después de terminar, siguiente día 5 o 20 ──
assert.strictEqual(CF.fechaCobroObra("2026-09-28"), "2026-12-05");
assert.strictEqual(CF.fechaCobroObra("2026-09-03"), "2026-11-05");
assert.strictEqual(CF.fechaCobroObra("2026-09-05"), "2026-11-05");
assert.strictEqual(CF.fechaCobroObra("2026-09-12"), "2026-11-20");
assert.strictEqual(CF.fechaCobroObra("2026-12-31"), "2027-03-05");          // 28/02 → se pasa al 05/03
assert.strictEqual(CF.lunes("2026-10-03"), "2026-09-28");

function fuentes() {
  const f = T.fuentes();
  f.tesoreria.data.total_eur = 42053.84;
  f.tesoreria.data.cuentas[0].saldo = 42053.84;
  f.iva = ok({ iva_resultado: 4206, iva_repercutido: 9000, iva_soportado: 4794, periodo_inicio: "2026-07-01", periodo_fin: HOY });
  f.config.data.push(
    { clave: "nomina_dia_pago", valor: "3" },
    { clave: "remesas_emasesa", valor: "2026-10-05:38196" },
    { clave: "pagos_programados", valor: "2026-10-10:2341.93:Aquatubo; 2026-11-10:9760.07:Aquatubo" },
    { clave: "colchon_caja", valor: "10000" },
  );
  f.config.data = f.config.data.filter((r) => r.clave !== "nomina_dia_pago" || r.valor === "3");
  f.obligaciones.data.expedientes = [{ concepto: "IVA 2024 aplazado", pendiente: 14188, tipo: "aplazamiento", plazos: [
    { fecha: "2026-09-21", importe: 1242.11, estado: "pagado" },
    { fecha: "2026-10-20", importe: 1246.23, estado: "pendiente" }, { fecha: "2026-11-20", importe: 1250.49, estado: "pendiente" },
  ] }];
  f.prestamos.data.push(
    { id: "santander-ara", tipo: "recibido", contraparte: "Santander", cuotas_detalle: "2026-10-28:15075.06;2026-11-28:15075.06;2026-12-28:15075.06" },
    { id: "santander-instalaciones-2023", tipo: "recibido", contraparte: "Instalaciones (Santander)",
      cuotas_detalle: ["10", "11", "12"].map((m) => `2026-${m}-30:880.95`).concat(["01", "02", "03", "04", "05", "06", "07"].map((m) => `2027-${m}-${m === "02" ? "28" : "30"}:880.95`)).join(";") },
  );
  // Aquatubo sale por su calendario, no por su vencimiento
  f.compras.data.facturas.push({ num: "AQ-77", proveedor: "AQUATUBO SL", pendiente: 12102, fecha_vto: "2026-12-31" });
  return f;
}
const extra = { gastosFijosMes: 3057, is2026: { importe: 48100, fecha: "2027-07-25", fiabilidad: "estimado", fuente: "prueba" } };
const esc = C.calcularEscalera(fuentes(), HOY, AHORA, { pleo_manual: 743 });
const cf = CF.calcularCashflow(fuentes(), esc, HOY, null, extra);

// Semana 1 empieza con 42.054 + 743 (y aparte la custodia y las señales)
assert.strictEqual(cf.inicial.banco_pleo, 42796.84);
assert.strictEqual(cf.semanas[0].desde, "2026-09-28");
// La semana del 05/10 trae +38.196 de EMASESA
const s2 = cf.semanas[1];
assert.strictEqual(s2.desde, "2026-10-05");
assert.ok(s2.movs.some((m) => m.fila === "remesas_emasesa" && m.importe === 38196));
// Octubre: Aquatubo, Hacienda + IVA + IRPF el 20, Santander el 28, Instalaciones el 30, TGSS, nóminas el 3/11
const oct = cf.semanas.flatMap((s) => s.movs).filter((m) => m.fecha <= "2026-11-03");
const hay = (fila, fecha, importe) => assert.ok(oct.some((m) => m.fila === fila && m.fecha === fecha && Math.abs(m.importe - importe) < 0.01), `${fila} ${fecha} ${importe}`);
hay("proveedores", "2026-10-10", 2341.93);
hay("hacienda_plazos", "2026-10-20", 1246.23);
hay("impuestos_trimestrales", "2026-10-20", 4206);
hay("impuestos_trimestrales", "2026-10-20", 3411);
hay("prestamos_cuotas", "2026-10-28", 15075.06);
hay("prestamos_cuotas", "2026-10-30", 880.95);
hay("seguridad_social", "2026-10-30", 5025);
hay("nominas", "2026-11-03", 11000);
assert.ok(!oct.some((m) => /AQ-77/.test(m.concepto)));                    // Aquatubo no dos veces
// La custodia no se mezcla con el saldo propio
assert.strictEqual(cf.inicial.propio, Math.round((42796.84 - 30000 - 2000) * 100) / 100);
for (const s of cf.semanas) assert.strictEqual(s.saldo_con_custodia, Math.round((s.saldo_propio + 32000) * 100) / 100);
assert.ok(cf.filas.find((x) => x.id === "custodia_entra").sin_dato);
// Saldo semana a semana = inicial + entradas − salidas
let saldo = cf.inicial.propio;
for (const s of cf.semanas) { saldo = Math.round((saldo + s.entra - s.sale) * 100) / 100; assert.strictEqual(s.saldo_propio, saldo); }
// Tramo largo: IS 2026 en julio de 2027; sin los recurrentes (los pone el simulador)
const jul = cf.meses.find((m) => m.mes === "2027-07");
assert.ok(jul.movs.some((m) => m.fila === "is_2026" && m.importe === 48100));
assert.ok(!cf.meses.some((m) => m.movs.some((x) => ["nominas", "seguridad_social", "gastos_fijos"].includes(x.fila))));
assert.deepStrictEqual(Object.keys(cf.recurrentes_mes).sort(), ["gastos_fijos", "nominas", "seguridad_social"]);

// La peor semana de la tarjeta 2 (Empresa) es la de las 4 primeras del cash flow
const d = D.componer({ fuentes: { ...fuentes(), pnr_ref: { ok: false, error: "sin red" }, res_anual: { ok: false, error: "sin red" } }, hoy: HOY, generado: AHORA, tiposBanco: {} }, { pleo_manual: 743 });
const min4 = d.cashflow.semanas.slice(0, 4).reduce((m, s) => (s.saldo_propio < m.saldo_propio ? s : m));
assert.deepStrictEqual(d.panel.prevision_semanal.minimo, { saldo: min4.saldo_propio, semana: min4.n, desde: min4.desde, hasta: min4.hasta });
// Sin beneficio del año ni is_2026_estimado: IS «sin dato», nunca 0
assert.strictEqual(d.linea_is.importe, null);
assert.strictEqual(d.kpis.dinero_empresa_despues_is, null);
assert.ok(d.cashflow.filas.find((x) => x.id === "is_2026").sin_dato);
// Con is_2026_estimado en config_dinero: D15 y «después de IS»
const f2 = fuentes(); f2.config.data.push({ clave: "is_2026_estimado", valor: "40000" });
const d2 = D.componer({ fuentes: { ...f2, pnr_ref: { ok: false }, res_anual: { ok: false } }, hoy: HOY, generado: AHORA, tiposBanco: {} }, { pleo_manual: 743 });
assert.strictEqual(d2.linea_is.importe, 40000);
assert.strictEqual(d2.kpis.dinero_empresa_despues_is, Math.round((d2.kpis.dinero_empresa_antes_is - 40000) * 100) / 100);
// Sin is_2026_estimado: 25 % del beneficio acumulado del año (posicion-neta-real)
const res = { ok: true, data: { año: 2026, por_mes: [{ mes: 8, beneficio_real: 10000, costes_generales: 3000 }, { mes: 9, beneficio_real: 30000, costes_generales: 3200 }, { mes: 10, sin_datos: true }] } };
const d3 = D.componer({ fuentes: { ...fuentes(), pnr_ref: { ok: false }, res_anual: res }, hoy: HOY, generado: AHORA, tiposBanco: {} }, { pleo_manual: 743 });
assert.strictEqual(d3.linea_is.importe, 10000);
assert.ok(/25 % del beneficio acumulado/.test(d3.linea_is.fuente));

// ── base del simulador ───────────────────────────────────────
const pnr = { ok: true, data: { año: 2026, mes: 9, total_horas_mo: 760, ingreso_mes_eur: 44840, gastos_materiales_eur: 12107, coste_mo_eur: 12734,
  nomina_indirectos_eur: 2066, costes_generales_eur: 3057, comision_comercial_pct: 0.2, obras: [
    { nombre: "A", fase: "09_TRAMITADA", importe: 10000, horas_previstas: 140, horas_registradas: 0 },
    { nombre: "B", fase: "09_FINANCIACION", importe: 8000, horas_previstas: 100, horas_registradas: 60 },
    { nombre: "C", fase: "06_VISITA_EMASESA", importe: 20000, horas_previstas: 300, horas_registradas: 0 },
    { nombre: "H", fase: "18_COBRADA", importe: 15000, horas_previstas: 200, horas_registradas: 290 },
    { nombre: "X", fase: "12_INICIO_OBRA", importe: 9000, horas_previstas: 100, horas_registradas: 20 },
  ] } };
const b = CF.baseSimulador(pnr);
assert.deepStrictEqual(b.obras.map((o) => [o.nombre, o.estado]), [["A", "sin_empezar"], ["B", "en_curso"], ["C", "sin_empezar"]]);
assert.strictEqual(b.historico.desvio_pct, 45);
assert.strictEqual(b.historico.material_pct, 27);
assert.strictEqual(b.historico.eur_hora_obra, 59);
assert.deepStrictEqual(b.historico.fijos, { operarios: 12734, indirectos: 2066, generales: 3057 });

console.log(`OK cashflow-03-10.test · peor de 13 semanas ${cf.peor_13.saldo} € (${cf.peor_13.desde}–${cf.peor_13.hasta}) · tarjeta 2 ${d.panel.prevision_semanal.minimo.saldo} €`);
