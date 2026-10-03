// Test del simulador de escenarios (sin red). Caso: las 34 obras del
// prototipo v2 aprobado (cashflow-simulador.html, 03/10/2026). El test del
// front (ara-os/src/lib/simuladorCaja.test.js) usa el mismo caso y cifras.
// Uso: node lib/simulador-caja.test.cjs
const assert = require("assert");
const S = require("./simulador-caja.cjs");

// [fase, nombre, importe, horas previstas, avance %] — del prototipo v2
const P = [[9,"Sinaí 39",4976,80,84],[9,"Nuestra Señora de la O (1)",8438,112,86],[9,"Nuestra Señora de la O (2)",9399,125,82],[9,"Guardabosques 3",22272,272,97],[9,"Goya 21",5468,80,99],[9,"Juan Pablos 17",24481,432,84],[9,"Mandarinas 2",21009,296,91],[9,"Tordo 18",9098,128,0],[9,"Rafael Laffón 7",8981,142,0],[9,"Perdiz 5",8320,120,0],[9,"La Paz 29",14515,192,0],[9,"Moncayo 6",12005,160,0],[9,"Mijares 3",9160,102,0],[9,"Mar de Alborán 14",27575,320,0],[9,"Luceros 4",25308,320,0],[9,"Jorge de Montemayor 34",7058,109,0],[9,"Doctor Fedriani 39",20999,384,0],[9,"Betis 20",8475,142,0],[8,"Tarfia 53",11867,181,0],[8,"Abogado Rafael Medina 1",42908,509,0],[7,"Diego Puerta 1",45564,582,0],[7,"Virgen de la Antigua 2",0,357,0],[6,"Doctores González Meneses 10",9014,99,97],[6,"Nescania 25",29831,400,0],[6,"Manuel Casana 7",20445,256,0],[6,"Doctor Fedriani 17",18086,272,0],[6,"Beatriz de Suabia 85",24826,368,0],[6,"Alberche 17",10261,112,0],[5,"Tharsis 5",15080,240,0],[5,"Malvaloca 1",36126,528,0],[5,"Otelo 8",9224,130,0],[5,"Diego Puerta 5",46307,598,0],[5,"Ciudad de Gandía 5",35096,435,0],[5,"Ardilla 9",33206,472,0]];
const FASE = { 9: "09_TRAMITADA", 8: "08_CYCP", 7: "07_PTE_CYCP", 6: "06_VISITA_EMASESA", 5: "05_DOCUMENTACION" };
const OBRAS = P.map(([f, nombre, importe, h, av]) => ({ nombre, fase: FASE[f], importe, horas_previstas: h, horas_registradas: h * av / 100 }));
const HIST = { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2 };
const SEPT = { personas: 5, hpp: 160, cuadrillas: [5], desvio: 18, mat: 27, tram: 1, grande: 300 };   // una cuadrilla de 5 = el prototipo v2

assert.strictEqual(S.fechaCobroObra("2026-09-28"), "2026-12-05");
const c = S.cartera(OBRAS);
assert.strictEqual(c.n, 34);
assert.strictEqual(c.sin_presupuesto, 1);                                   // Virgen de la Antigua 2
const s = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: SEPT });
// Orden: en curso → 09 → 08 → 07 → 06 → 05
assert.ok(s.prog.slice(0, 8).every((p) => p.avance_pct > 0));
assert.deepStrictEqual([...new Set(s.prog.slice(8).map((p) => p.fase.slice(0, 2)))], ["09", "08", "07", "06", "05"]);
// Cartera de 11,4 meses de trabajo (como el prototipo v2)
assert.strictEqual(Math.round(s.meses_obra * 10) / 10, 11.4);
// Sin presupuesto: gasta horas, no cobra
const v = s.prog.find((p) => p.nombre === "Virgen de la Antigua 2");
assert.ok(v.sin_presupuesto && v.horas > 0 && v.cobro === null);
assert.ok(!s.movs.some((m) => /Virgen de la Antigua/.test(m.concepto) && m.fila === "sim_cobros"));
// Cobro = fin + 2 meses, día 5 o 20; material 90 días después de empezar
for (const p of s.prog.filter((x) => x.importe > 0)) assert.strictEqual(p.cobro, S.fechaCobroObra(p.fin));
const m1 = s.movs.find((m) => m.fila === "sim_material");
const p1 = s.prog.find((p) => m1.concepto === `Material ${p.nombre}`);
assert.strictEqual(Date.parse(m1.fecha) - Date.parse(p1.inicio), 90 * 86400000);
// El horizonte llega al mes del último cobro (después de julio de 2027)
assert.ok(s.fin_mes > "2027-07" && s.fin_mes === s.ultimo_cobro.slice(0, 7));
// Si EMASESA tarda mucho, la cuadrilla espera: horas perdidas
const lento = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...SEPT, tram: 3 } });
assert.ok(lento.idle > 0 && lento.meses_obra > s.meses_obra);
assert.strictEqual(s.idle, 0);
// Prudente (760 h, +45 %): más meses; Presupuesto (800 h, 0 %): menos
assert.ok(S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...SEPT, hpp: 152, desvio: 45 } }).meses_obra > s.meses_obra);
assert.ok(S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...SEPT, desvio: 0 } }).meses_obra < s.meses_obra);
// +1 persona: 960 h y 2.800 €/mes
const op = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...SEPT, personas: 6, cuadrillas: [6] } });
assert.strictEqual(op.horas_mes, 960);
assert.ok(op.meses_obra < s.meses_obra && op.movs.some((m) => m.fila === "sim_operarios" && m.importe === 2800));
// La producción repartida por meses suma la cartera con presupuesto
const totalProd = Object.values(s.produccion).reduce((a, b) => a + b, 0);
assert.ok(Math.abs(totalProd - c.pendiente) < 5, `${totalProd} vs ${c.pendiente}`);

// Obras al 100 % de horas (Carcagente 2, Gaviota 1…): no son cartera; van a
// «terminadas, pendientes de cobro» y no salen «sin pto.»
{
  const conHechas = [...OBRAS,
    { nombre: "Carcagente 2", fase: "09_TRAMITADA", importe: 12000, horas_previstas: 150, horas_registradas: 150, fecha_fin: "2026-09-28" },
    { nombre: "Gaviota 1", fase: "09_TRAMITADA", importe: 8000, horas_previstas: 100, horas_registradas: 120 }];
  const sh = S.simular({ obras: conHechas, historico: HIST, hoy: "2026-10-01", mandos: SEPT });
  assert.ok(!sh.prog.some((p) => /Carcagente|Gaviota/.test(p.nombre)));
  assert.deepStrictEqual(sh.terminadas.map((p) => [p.nombre, p.sin_presupuesto, p.cobro]), [["Carcagente 2", false, "2026-12-05"], ["Gaviota 1", false, "2026-12-05"]]);
  assert.ok(sh.movs.some((m) => m.fila === "sim_cobros" && m.base === 12000 && m.importe === 13200 && /terminada, pendiente de cobro/.test(m.concepto)));
  assert.strictEqual(Math.round(sh.meses_obra * 10) / 10, 11.4);                // la cartera no cambia
  assert.strictEqual(S.cartera(conHechas).terminadas, 2);
  // si la caja conocida ya la cobra (obra terminada sin facturar, T4), no se cobra dos veces
  const dos = S.simular({ obras: conHechas.map((o) => ({ ...o, obra_id: o.nombre })), historico: HIST, hoy: "2026-10-01", mandos: SEPT, conocidas: ["Carcagente 2"] });
  assert.ok(dos.terminadas.find((p) => p.nombre === "Carcagente 2").en_caja_conocida);
  assert.ok(!dos.movs.some((m) => /Carcagente/.test(m.concepto)) && dos.movs.some((m) => /Gaviota/.test(m.concepto)));
  assert.deepStrictEqual(S.obrasConocidas({ semanas: [{ movs: [{ fila: "obra_terminada", obra_id: "x" }, { fila: "nominas" }] }], meses: [] }), ["x"]);
  // «sin pto.» solo para las que de verdad no tienen presupuesto
  assert.deepStrictEqual(sh.prog.filter((p) => p.sin_presupuesto).map((p) => p.nombre), ["Virgen de la Antigua 2"]);
}

// Cuadrillas reales (config_dinero «cuadrillas» = "2,3"): capacidad = personas × horas
{
  const REAL = { ...SEPT, cuadrillas: [2, 3] };
  assert.deepStrictEqual(S.tamanosCuadrillas(5, [2, 3]), [2, 3]);
  assert.deepStrictEqual(S.tamanosCuadrillas(7, [2, 3]), [2, 2, 3]);         // «+1 cuadrilla» = 2 personas más
  assert.deepStrictEqual(S.tamanosCuadrillas(4), [2, 2]);
  const dos = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: REAL });
  assert.deepStrictEqual([dos.equipos, dos.cuadrillas, dos.horas_mes], [2, [2, 3], 800]);
  assert.deepStrictEqual([...new Set(dos.prog.map((p) => p.cuadrilla))].sort(), [2, 3]);
  // Obra grande (≥ 300 h previstas) a la cuadrilla de 3, salvo que tarde más de un mes en quedar libre
  const mar = dos.prog.find((p) => p.nombre === "Mar de Alborán 14");
  assert.ok(mar.grande);
  dos.prog.forEach((p, i) => {
    const pref = p.grande ? 3 : 2;
    if (p.cuadrilla !== pref) {
      const libPref = Math.max(0, ...dos.prog.slice(0, i).filter((x) => x.cuadrilla === pref).map((x) => x.t1));
      assert.ok(libPref > p.t0 + 1 - 1e-6, `${p.nombre}: cuadrilla de ${p.cuadrilla} sin motivo`);
    }
  });
  // Mismas horas en total: la cartera dura más o menos lo mismo, pero en paralelo
  assert.ok(Math.abs(dos.meses_obra - s.meses_obra) < 1.5, `${dos.meses_obra} vs ${s.meses_obra}`);
  // Ninguna cuadrilla tiene dos obras a la vez
  for (const e of [1, 2]) {
    const xs = dos.prog.filter((p) => p.equipo === e).sort((a, b) => a.t0 - b.t0);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i].t0 >= xs[i - 1].t1 - 1e-9);
  }
  // «+1 cuadrilla»: 7 personas, 2.800 €/mes por cada una de más
  const mas = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...REAL, personas: 7 } });
  assert.ok(mas.meses_obra < dos.meses_obra && mas.movs.some((m) => m.fila === "sim_operarios" && m.importe === 5600));
  // Si EMASESA tarda, se ve en la espera de las cuadrillas
  const espera = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: { ...REAL, tram: 3 } });
  assert.ok(espera.espera_por_equipo.some((x) => x > 0) && espera.prog.some((p) => p.espera > 0 && p.espera_desde));
}

// Urbano Orad 13 y 15: OT aceptada, empieza el 05/10 con la cuadrilla de 3; 50 %
// cobrado, 50 % un mes después de terminar, sin comisión; horas para un 40 %.
// Jorge de Montemayor 34: empezó el 02/10 con la cuadrilla de 2 (sin registros).
{
  const REAL = { ...SEPT, cuadrillas: [2, 3], desvio: 0 };
  const urb = { nombre: "Urbano Orad 13 y 15", fase: "09_TRAMITADA", importe: 17650, importe_total: 35300, mes_cobro: 1, sin_comision: true, margen_objetivo: 0.4, inicio_fijo: "2026-10-05", tipo: "OT" };
  const jorge = OBRAS.find((o) => o.nombre === "Jorge de Montemayor 34");
  const obras = [...OBRAS.filter((o) => o !== jorge), { ...jorge, empezada: "2026-10-02" }, urb];
  const r = S.simular({ obras, historico: HIST, hoy: "2026-10-03", mandos: REAL });
  const u = r.prog.find((p) => p.nombre === urb.nombre), j = r.prog.find((p) => p.nombre === jorge.nombre);
  // horas máximas para un 40 %: 35.300 × (1 − 27 % − 40 %) ÷ (12.734 / 800) ≈ 732 h con estos fijos
  assert.ok(Math.abs(u.horas - 35300 * 0.33 / (12734 / 800)) < 1, String(u.horas));
  assert.deepStrictEqual([u.cuadrilla, u.inicio, u.grande, u.espera], [3, "2026-10-05", true, 0]);   // esperar al lunes no es esperar trámite
  assert.deepStrictEqual([j.cuadrilla, j.inicio, j.t0], [2, "2026-10-02", 0]);
  assert.ok(Math.abs(u.beneficio - 0.4 * 35300) < 5 && u.comision === 0);
  assert.strictEqual(u.cobro, `${S.mesSig(u.fin.slice(0, 7))}-${u.fin.slice(8, 10)}`);
  assert.ok(r.movs.some((m) => m.fila === "sim_cobros" && m.base === 17650 && m.importe === 19415 && m.fecha === u.cobro));   // con su 10 % de IVA
  assert.ok(!r.movs.some((m) => m.fila === "sim_comision" && /Urbano/.test(m.concepto)));
  assert.ok(r.movs.some((m) => m.fila === "sim_material" && /Urbano/.test(m.concepto) && m.base === 9531 && m.importe === 11532.51));   // 27 % del total (sin material previsto) + 21 % de IVA
  assert.ok(r.avisos.sin_material.includes(urb.nombre));
  // Las dos empezadas van primero en el calendario
  assert.deepStrictEqual(r.prog.slice(0, 2).map((p) => p.nombre).sort(), [jorge.nombre, urb.nombre].sort());
  // Fin de obra (hito «fin») = terminada aunque no tenga todas las horas
  const t = S.simular({ obras: [...obras, { nombre: "Hecha", fase: "09_TRAMITADA", importe: 5000, horas_previstas: 100, horas_registradas: 40, fin_obra: "2026-09-30" }], historico: HIST, hoy: "2026-10-03", mandos: REAL });
  assert.deepStrictEqual(t.terminadas.map((p) => [p.nombre, p.cobro]), [["Hecha", "2026-12-05"]]);
}

// Material previsto (rentabilidad-obra), IVA y 303, fecha de fin pasada, sin presupuesto
{
  const REAL = { ...SEPT, cuadrillas: [2, 3], desvio: 0 };
  const obras = [
    { obra_id: "a", nombre: "Tordo 18", fase: "09_TRAMITADA", importe: 9098, horas_previstas: 128, horas_registradas: 0, material_previsto: 2259.99 },
    { obra_id: "v", nombre: "Virgen de la Antigua 2", fase: "07_PTE_CYCP", importe: 0, horas_previstas: 357, horas_registradas: 0, material_previsto: 12220.3, pasos: 2 },
    { obra_id: "f", nombre: "Ya acabada", fase: "09_TRAMITADA", importe: 5000, horas_previstas: 100, horas_registradas: 60, fecha_fin: "2026-09-30" },
    { obra_id: "s", nombre: "Sin material", fase: "09_TRAMITADA", importe: 10000, horas_previstas: 100, horas_registradas: 0 },
  ];
  const r = S.simular({ obras, historico: HIST, hoy: "2026-10-03", mandos: REAL, ivaConocido: [{ fecha: "2026-11-20", iva: 1000 }] });
  const tordo = r.prog.find((p) => p.nombre === "Tordo 18");
  assert.deepStrictEqual([tordo.material, tordo.material_estimado], [2259.99, false]);
  const mt = r.movs.find((m) => m.fila === "sim_material" && /Tordo/.test(m.concepto));
  assert.deepStrictEqual([mt.base, mt.importe, mt.iva], [2259.99, 2734.59, -474.6]);
  // fecha de fin pasada = terminada aunque tenga menos horas
  assert.ok(!r.prog.some((p) => p.nombre === "Ya acabada") && r.terminadas.some((p) => p.nombre === "Ya acabada"));
  // sin presupuesto: gasta horas y material, no cobra, aviso
  const v = r.prog.find((p) => p.nombre === "Virgen de la Antigua 2");
  assert.ok(v.sin_presupuesto && v.material === 12220.3 && v.beneficio < 0 && v.cobro === null);
  assert.deepStrictEqual(r.avisos.sin_presupuesto.map((x) => x.nombre), ["Virgen de la Antigua 2"]);
  assert.deepStrictEqual(r.avisos.sin_material, ["Sin material"]);
  // 303: por trimestre, el 20 del mes siguiente; IVA cobrado al facturar (fin) − IVA del material (inicio) + conocidos
  const esperado = {};
  for (const m of r.movs.filter((x) => x.iva)) { const q = S.trimestre(m.iva_fecha); esperado[q] = (esperado[q] || 0) + m.iva; }
  esperado["2026-T4"] += 1000;
  for (const q of r.iva_trimestres) assert.ok(Math.abs(q.iva - esperado[q.trimestre]) < 0.05, q.trimestre);
  for (const q of r.iva_trimestres.filter((x) => x.iva > 0)) assert.ok(r.movs.some((m) => m.fila === "sim_iva" && m.fecha === q.pago && m.importe === q.iva));
  assert.strictEqual(S.pago303("2026-T4"), "2027-01-20");
  assert.strictEqual(S.pago303("2027-T1"), "2027-04-20");
  // un trimestre a devolver no es una entrada
  const dev = S.simular({ obras: [obras[1]], historico: HIST, hoy: "2026-10-03", mandos: REAL });
  assert.ok(dev.iva_trimestres.every((q) => q.a_devolver) && !dev.movs.some((m) => m.fila === "sim_iva"));
  // beneficio del mes = obra hecha − material − nómina − Guillermo − indirectos y generales
  const m11 = "2026-11";
  assert.ok(r.beneficio[m11] < r.produccion[m11]);
  assert.strictEqual(Object.values(r.terminan).reduce((a, b) => a + b, 0), r.prog.length);
}

// Parada al 80 % sin horas en el último mes cerrado = terminada (Sinaí 39 67/80); en la calibración, ahorro
{
  const sinai = { obra_id: "si", nombre: "Sinaí 39", fase: "09_TRAMITADA", importe: 4976, horas_previstas: 80, horas_registradas: 67, horas_mes: 0 };
  const viva = { ...sinai, obra_id: "vi", nombre: "Viva", horas_mes: 12 };
  const r = S.simular({ obras: [sinai, viva], historico: HIST, hoy: "2026-10-03", mandos: { ...SEPT, cuadrillas: [2, 3] } });
  assert.deepStrictEqual([r.terminadas.map((p) => p.nombre), r.prog.map((p) => p.nombre)], [["Sinaí 39"], ["Viva"]]);
  const pnrS = { ok: true, data: { año: 2026, mes: 9, total_horas_mo: 760, obras: [sinai, { ...sinai, obra_id: "go", nombre: "Goya 21", horas_registradas: 79, fecha_fin: "2026-09-20", horas_mes: 5 }] } };
  const c = S.calibrar({ pnr: pnrS, anual: { ok: false }, hoy: "2026-10-03", fotoFresca: true });
  assert.strictEqual(c.mandos.desvio, -9);                                   // mediana de −16 % y −1 %: acaban por debajo
}

// Terminadas: solo generan cobro si no tienen factura ni cobro y no están en T4; 0 h nunca es terminada
{
  const t = (nombre, extra) => ({ obra_id: nombre, nombre, fase: "09_TRAMITADA", importe: 10000, horas_previstas: 100, horas_registradas: 100, fecha_fin: "2026-09-20", ...extra });
  const obras = [t("Pendiente"), t("Juan Pablos 17", { facturada: true }), t("Oliva 94", { facturada: true, cobrada: true }), t("Chiva 7"),
    { obra_id: "betis", nombre: "Betis 20", fase: "09_TRAMITADA", importe: 8475, horas_previstas: 142, horas_registradas: 0, fin_obra: "2026-10-03", facturada: true, cobrada: true },
    { obra_id: "sinempezar", nombre: "Sin empezar", fase: "09_TRAMITADA", importe: 9000, horas_previstas: 150, horas_registradas: 0, fin_obra: "2026-10-03", facturada: true }];
  const r = S.simular({ obras, historico: HIST, hoy: "2026-10-03", mandos: { ...SEPT, cuadrillas: [2, 3] }, conocidas: ["Chiva 7"] });
  assert.deepStrictEqual(r.terminadas.map((p) => [p.nombre, p.estado_cobro, p.genera_cobro]),
    [["Pendiente", "pendiente", true], ["Juan Pablos 17", "facturada", false], ["Oliva 94", "cobrada", false], ["Chiva 7", "en_t4", false], ["Betis 20", "cobrada", false]]);   // cobrada entera = terminada aunque tenga 0 h
  const cobros = r.movs.filter((m) => m.fila === "sim_cobros").map((m) => m.concepto);
  assert.ok(cobros.some((c) => /^Pendiente/.test(c)) && !cobros.some((c) => /Juan Pablos|Oliva|Chiva|Betis/.test(c)), JSON.stringify(cobros));
  assert.ok(!r.movs.some((m) => m.fila === "sim_comision" && /Juan Pablos|Oliva|Chiva|Betis/.test(m.concepto)));
  // sin cobrar y con 0 h: nunca terminada por fechas o estados → sigue en la cartera, pero su cobro ya está facturado
  assert.ok(!r.prog.some((p) => p.nombre === "Betis 20"));
  const b = r.prog.find((p) => p.nombre === "Sin empezar");
  assert.ok(b && b.ya_facturada && b.cobro === null && b.comision === 0 && r.produccion["2026-10"] > 0);
  // material: el % propio de la obra (OO: 27 %), no el del mando
  const oo = S.simular({ obras: [{ obra_id: "oo", nombre: "Orad", fase: "09_OO", importe: 17650, importe_total: 35300, horas_previstas: 695, horas_registradas: 0, material_pct: 0.27, inicio_fijo: "2026-10-05" }],
    historico: HIST, hoy: "2026-10-03", mandos: { ...SEPT, mat: 6 } });
  assert.deepStrictEqual([oo.prog[0].material, oo.prog[0].material_pct, oo.avisos.sin_material_pct], [9531, 27, [{ nombre: "Orad", pct: 27 }]]);
  // ya tramitada con fecha pasada (Jorge, 02/10): no es «antes de trámite»
  const j = S.simular({ obras: [{ obra_id: "j", nombre: "Jorge", fase: "09_TRAMITADA", importe: 7058, horas_previstas: 109, horas_registradas: 0, inicio_fijo: "2026-10-02", inicio_manual: true }], historico: HIST, hoy: "2026-10-03", mandos: SEPT });
  assert.deepStrictEqual([j.prog[0].antes_de_tramite, j.prog[0].inicio], [false, "2026-10-02"]);
}

// Orden y cuadrilla fijados a mano (hoja planificacion_obras); nunca antes de estar tramitada
{
  const REAL = { ...SEPT, cuadrillas: [2, 3] };
  const base = S.simular({ obras: OBRAS, historico: HIST, hoy: "2026-10-01", mandos: REAL });
  const nombre = "Malvaloca 1";
  const conPos = OBRAS.map((o) => (o.nombre === nombre ? { ...o, posicion: 1, cuadrilla: 1 } : o));
  const r = S.simular({ obras: conPos, historico: HIST, hoy: "2026-10-01", mandos: REAL });
  assert.strictEqual(r.prog[0].nombre, nombre);
  assert.deepStrictEqual([r.prog[0].equipo, r.prog[0].cuadrilla, r.prog[0].manual], [1, 2, true]);
  assert.ok(r.prog[0].t0 >= 4 - 1e-9);                                       // fase 05: 4 pasos × 1 mes, aunque vaya primera
  assert.ok(base.prog.findIndex((p) => p.nombre === nombre) > 0);
  // fecha fijada antes de estar tramitada: aviso y se respeta el trámite
  const antes = S.simular({ obras: OBRAS.map((o) => (o.nombre === nombre ? { ...o, inicio_fijo: "2026-10-15" } : o)), historico: HIST, hoy: "2026-10-01", mandos: REAL });
  const p = antes.prog.find((x) => x.nombre === nombre);
  assert.ok(p.antes_de_tramite && p.t0 >= 4 - 1e-9 && antes.avisos.antes_de_tramite.some((x) => x.nombre === nombre));
  assert.deepStrictEqual(S.aplicarPosiciones([{ n: "a" }, { n: "b" }, { n: "c", posicion: 1 }, { n: "d", posicion: 9 }]).map((x) => x.n), ["c", "a", "b", "d"]);
}

// Calibración «Real (automático)»
const pnr = { ok: true, data: { año: 2026, mes: 9, total_horas_mo: 760, ingreso_mes_eur: 44840, gastos_materiales_eur: 12107, coste_mo_eur: 12734, coste_mo_fuente: "nomina",
  nomina_indirectos_eur: 2066, costes_generales_eur: 3057, obras: [
    ...OBRAS,
    { nombre: "T1", fase: "18_COBRADA", fecha_fin: "2026-08-10", importe: 15000, materiales_eur: 4000, horas_previstas: 200, horas_registradas: 290 },
    { nombre: "T2", fase: "17_COBRO_EMASESA", fecha_fin: "2026-09-20", importe: 10000, materiales_eur: 2800, horas_previstas: 100, horas_registradas: 145 },
    { nombre: "Vieja", fase: "18_COBRADA", fecha_fin: "2025-11-01", importe: 9000, materiales_eur: 1000, horas_previstas: 100, horas_registradas: 100 },
  ] } };
// Horas/mes: sin agosto ni meses con muchas vacaciones (junio: 60 % en obra)
const anual = { ok: true, data: { año: 2026, por_mes: [
  { mes: 6, horas_obra: 480, horas_pagadas: 800 }, { mes: 7, horas_obra: 700, horas_pagadas: 780 },
  { mes: 8, horas_obra: 520, horas_pagadas: 860 }, { mes: 9, horas_obra: 760, horas_pagadas: 872 }, { mes: 10, sin_datos: true }] } };
const cal = S.calibrar({ pnr, anual, hoy: "2026-10-03", fotoFresca: true });
assert.deepStrictEqual([cal.mandos.personas, cal.mandos.hpp, cal.mandos.cuadrillas, cal.mandos.desvio, cal.mandos.mat, cal.mandos.tram, cal.mandos.grande], [5, 146, [2, 3], 45, 27, 1, 300]);   // (700 + 760) / 2 ÷ 5; sin config → 2 + 3
const calC = S.calibrar({ pnr, anual, hoy: "2026-10-03", fotoFresca: true, cuadrillas: "2,3,2", grande: 250 });
assert.deepStrictEqual([calC.mandos.personas, calC.mandos.hpp, calC.mandos.cuadrillas, calC.mandos.grande], [7, 104, [2, 3, 2], 250]);
const tHoras = cal.calibracion.find((x) => x.mando === "horas").texto;
assert.ok(/media de jul, sep/.test(tHoras) && /ago, agosto/.test(tHoras) && /jun, solo 60 %/.test(tHoras), tHoras);
assert.strictEqual(cal.obras.length, 34);
assert.ok(/mediana de 2 obras terminadas en 6 meses/.test(cal.calibracion.find((x) => x.mando === "desvio").texto));
// Desvío: mediana (no media) y sin las obras con horas sin confirmar
const pnr2 = { ok: true, data: { ...pnr.data, obras: [...pnr.data.obras,
  { nombre: "T3", fase: "18_COBRADA", fecha_fin: "2026-09-01", importe: 5000, materiales_eur: 1350, horas_previstas: 100, horas_registradas: 110 },
  { nombre: "CCPP Generalife 13", fase: "18_COBRADA", fecha_fin: "2026-09-05", importe: 5000, horas_previstas: 100, horas_registradas: 400 }] } };
const c3 = S.calibrar({ pnr: pnr2, anual, hoy: "2026-10-03", fotoFresca: true });
assert.strictEqual(c3.mandos.desvio, 45);                                   // mediana de +45, +45, +10, +300 = +45 (la media daría +100)
const c4 = S.calibrar({ pnr: pnr2, anual, hoy: "2026-10-03", fotoFresca: true, excluir: ["Generalife 13", "Regimiento de Soria 9", "Ágata 7", "Oliva 94"] });
assert.strictEqual(c4.mandos.desvio, 45);                                   // mediana de +45, +45, +10
assert.ok(/\(1 excluidas: horas sin confirmar\)/.test(c4.calibracion.find((x) => x.mando === "desvio").texto));
assert.ok(S.calibrar({ pnr, anual, hoy: "2026-10-03", fotoFresca: false }).calibracion.some((x) => x.mando === "caja"));

// Serie mensual: conocidos + recurrentes tras la semana 13 + simulado, hasta el último cobro
const cf = {
  hoy: "2026-10-01", inicial: { propio: 1000 },
  semanas: [{ hasta: "2026-12-27", movs: [{ fila: "proveedores", fecha: "2026-10-10", importe: 100 }] }],
  meses: [{ mes: "2027-07", movs: [{ fila: "is_2026", fecha: "2027-07-25", importe: 5000 }] }],
  recurrentes_movs: [{ fila: "seguridad_social", fecha: "2026-12-31", importe: 50 }, { fila: "nominas", fecha: "2027-01-03", importe: 70 }, { fila: "nominas", fecha: "2029-01-03", importe: 70 }],
  is_2026: { fecha: "2027-07-25" },
};
const serie = S.serieMensual(cf, { movs: [{ fila: "sim_cobros", fecha: "2026-12-20", importe: 300, entra: true }], fin_mes: "2027-09" });
const mes = (m) => serie.meses.find((x) => x.mes === m);
assert.strictEqual(mes("2026-10").saldo, 900);
assert.strictEqual(mes("2026-12").saldo, 900 + 300 - 50);
assert.strictEqual(mes("2027-07").saldo, 1150 - 70 - 5000);
assert.strictEqual(serie.meses[serie.meses.length - 1].mes, "2027-09");
assert.strictEqual(S.serieMensual(cf, { movs: [] }, { is2026: 2000 }).meses.find((x) => x.mes === "2027-07").sale, 2000);
console.log(`OK simulador-caja.test · ${s.meses_obra.toFixed(1)} meses · último cobro ${s.ultimo_cobro} · beneficio cartera ${s.beneficio_cartera}`);
