// 06/10/2026 · Certificaciones como fuente del avance real. Uso: node lib/certificaciones-avance.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const AV = require("./avance-certificaciones.cjs");
const J = require("./jornada.cjs");
// mismo caso que ritmo-real.test: Montemayor 36 de 109 h (7,2 h/día con 2 personas), hoy 06/10, 8 h/día
const HOY = "2026-10-06";
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
const base0 = [ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29" }), ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }), ob("lp", "La Paz 29", 120, { orden: 2, pasos: 0 })];
const registros = [];
for (const d of ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05"]) for (const p of ["Manuel", "Cristhian"]) registros.push({ fecha: d, persona: p, obra: "Jorge de Montemayor 34", horas: 3.6 });
const cfDe = (obras) => ({ hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const args = (obras) => ({ cf: cfDe(obras), hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros });
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

const orad = { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", alias: ["CPP. C/ URBANO ORAD, 13 – SEVILLA", "CCPP.URBANO ORAD 15"], fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" };
const conCert = (certs) => { const a = args([...base0, orad]); a.cf.certificaciones = certs; return a; };

// 1 · sin visitas: Montemayor y Orad, «toca visitar»; fin de Montemayor con el ritmo («estimación sin visita»)
const r = P.calendarioPlan(conCert([]));
const jm = por(r, "Jorge"), u = por(r, "Urbano");
// sin ficha en Certificaciones (07/10/2026): «sin presupuesto…» en vez de «toca visitar»
assert.deepStrictEqual([jm.toca_visitar?.motivo, u.toca_visitar?.motivo], ["sin presupuesto en Certificaciones: impórtalo para poder visitar", "sin preparar certificación: pulsa «Preparar certificación» en su presupuesto para poder visitar"]);
assert.deepStrictEqual(r.toca_visitar.map((x) => x.nombre).sort(), ["Jorge de Montemayor 34", "Urbano Orad 13-15"]);
assert.ok(r.avisos.some((a) => /^Sin presupuesto en Certificaciones \(impórtalo para poder visitar\): Jorge de Montemayor 34\.$/.test(a.texto)), JSON.stringify(r.avisos.map((a) => a.texto)));
assert.ok(r.avisos.some((a) => /^Sin preparar certificación \(pulsa «Preparar certificación» en su presupuesto para poder visitar\): Urbano Orad 13-15\.$/.test(a.texto)));
// con ficha (partidas) y sin visitas: «toca visitar» con la regla de 32 h: Montemayor ya lleva 36 h
{
  const rr = P.calendarioPlan(conCert([{ obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: null, partidas_activas: 14 }]));
  assert.strictEqual(por(rr, "Jorge").toca_visitar.motivo, "sin visita · visita atrasada · 36 h fichadas desde el inicio");
}
// (07/10/2026) el ritmo es información: el fin, por las horas que quedan del presupuesto
assert.deepStrictEqual([jm.estimacion.fuente, jm.fin, jm.fin_previsto], ["fichajes", "2026-10-13", "2026-10-13"]);

// 2 · visita de ayer (05/10) en Montemayor: 15 % hecho con las 28,8 h fichadas hasta el 02/10 → 192 h al
// cierre; quedan 156 h a 16 h/día desde hoy → 20/10. Ya no toca visitar. (07/10/2026) La estimación queda como
// información: el fin sigue siendo el del presupuesto (13/10), sin aviso de retraso
const visita = { obra_id: "Jorge de Montemayor 34", avance_pct: 15, ultima_visita_fecha: "2026-10-05", horas_fichadas_visita: 28.8, total_visitas: 1 };
const r2 = P.calendarioPlan(conCert([visita]));
const j2 = por(r2, "Jorge");
assert.deepStrictEqual([j2.estimacion.fuente, j2.estimacion.horas_cierre, j2.estimacion.horas_quedan, j2.estimacion.fin, j2.fin, j2.toca_visitar], ["visita", 192, 156, "2026-10-20", "2026-10-13", null]);
assert.ok(!r2.avisos.some((a) => /va con retraso|pasa de su presupuesto/.test(a.texto)), JSON.stringify(r2.avisos.map((a) => a.texto)));
// las de detrás, con ese fin
for (const o of r2.obras.filter((x) => x.equipo === 1 && x !== j2 && x.fin_previsto)) assert.ok(o.inicio > j2.fin || o.fin < "2026-09-29", `${o.nombre} ${o.inicio}`);
// el cash flow toma ese mismo fin
assert.strictEqual(P.fechasPlan(conCert([visita])).jm.fin, "2026-10-13");

// 3 · visita de más de 7 días o al 0 %: el ritmo de fichajes, «estimación sin visita» y toca visitar
for (const v of [{ ...visita, ultima_visita_fecha: "2026-09-25" }, { ...visita, avance_pct: 0 }]) {
  const j = por(P.calendarioPlan(conCert([v])), "Jorge");
  assert.strictEqual(j.estimacion.fuente, "fichajes");
  assert.ok(j.estimacion.motivo, JSON.stringify(j.estimacion));
}
assert.ok(/^visita atrasada · 36 h fichadas desde la última$/.test(por(P.calendarioPlan(conCert([{ ...visita, ultima_visita_fecha: "2026-09-25" }])), "Jorge").toca_visitar.motivo));

// 4 · Orad se reconoce por el nombre de sus OO (Certificaciones las tenía como obras sueltas)
const r4 = P.calendarioPlan(conCert([{ obra_id: "CCPP.URBANO ORAD 15", avance_pct: 5, ultima_visita_fecha: "2026-10-06", horas_fichadas_visita: 0, total_visitas: 1 }]));
assert.strictEqual(por(r4, "Urbano").toca_visitar, null);

// 5 · desvío: Francisquita (ejemplo) 50 % hecho con 120 h; presupuesto 200 h → 240 h al cierre, +40 h, +672 € a 16,8 €/h
assert.deepStrictEqual(AV.cuentasAvance({ pct: 50, horas_fichadas_visita: 120, previsto_horas: 200, coste_hora: 16.8 }), { horas_cierre: 240, desvio_horas: 40, desvio_eur: 672 });
assert.deepStrictEqual(AV.cuentasAvance({ pct: 0, horas_fichadas_visita: 120, previsto_horas: 200, coste_hora: 16.8 }).horas_cierre, null);
console.log(`OK certificaciones-avance.test · toca visitar: ${r.toca_visitar.map((x) => x.nombre).join(", ")} · tras la visita, Montemayor ${jm.fin} → ${j2.fin}`);

// 6 · visitas en el calendario (07/10/2026): todas, en orden, con su %, partidas, desvío y color; Orad junta las
// de sus dos OO; Montemayor, la del 02/10 con 0 %
{
  const prev = { a: 60, b: 40 };
  const regsM = ["2026-09-29", "2026-09-30", "2026-10-01"].map((f) => ({ fecha: f, horas: 7.2 }));
  const vs = AV.visitasDeObra({ visitas: [{ visita_id: "v2", fecha: "2026-10-05", estado: "abierta" }, { visita_id: "v1", fecha: "2026-10-02", estado: "cerrada" }],
    estados: [{ visita_id: "v1", partida_id: "a", progreso_pct: "0" }, { visita_id: "v2", partida_id: "a", progreso_pct: "50" }], prevPorPartida: prev, registros: regsM, coste_hora: 16.8 });
  assert.deepStrictEqual(vs.map((v) => [v.visita_id, v.fecha, v.estado, v.avance_pct, v.partidas_con_avance, v.partidas]), [["v1", "2026-10-02", "cerrada", 0, 0, 2], ["v2", "2026-10-05", "abierta", 30, 1, 2]]);
  // v1: 21,6 h fichadas de 100 y 0 % → debería 21,6 %, 21,6 puntos por debajo (rojo, 07/10/2026; 1,35 días de retraso);
  // v2: 21,6 h para un 30 % de 100 h (30 h esperadas) → adelantada (verde)
  assert.deepStrictEqual([vs[0].color, vs[0].retraso_dias, vs[0].va_texto, vs[1].color, vs[1].desvio_horas], ["rojo", 1.35, "va 0 % · debería 22 %", "verde", -28]);
  // rombo «va / debería» (07/10/2026): 60 h fichadas de 108,8 previstas y 40 % certificado → «va 40 % · debería 55 %» en rojo
  const vd = AV.vaDeberia({ va: 40, fichadas: 60, previstas: 108.8, fecha: "2026-10-06" });
  assert.deepStrictEqual([vd.texto, vd.color, vd.deberia_pct], ["va 40 % · debería 55 %", "rojo", 55.1]);
  assert.strictEqual(vd.titulo, "60 h fichadas de 108,8 previstas a 06/10 · certificado 40 % · diferencia −15 puntos ≈ −16,5 h");
  assert.deepStrictEqual([51, 45, 38].map((va) => AV.vaDeberia({ va, fichadas: 60, previstas: 108.8 }).color), ["verde", "ambar", "rojo"]);
  assert.strictEqual(AV.vaDeberia({ va: 100, fichadas: 150, previstas: 108.8 }).deberia_pct, 100);   // máximo 100 %
  assert.strictEqual(AV.textoDeberia(60, 108.8), "Con las horas fichadas debería ir al 55 %");
  // el «debería» cuenta las horas del mismo día de la visita: Montemayor, visita el 02/10 con 36 h ese día → 33 % (rojo)
  const v02 = AV.visitasDeObra({ visitas: [{ visita_id: "m02", fecha: "2026-10-02", estado: "cerrada" }], estados: [], prevPorPartida: { a: 108.8 }, registros: [{ fecha: "2026-10-02", horas: 36 }], coste_hora: 16.8 })[0];
  assert.deepStrictEqual([v02.deberia_pct, v02.va_texto, v02.color], [33.1, "va 0 % · debería 33 %", "rojo"]);
  assert.strictEqual(AV.visitasDeObra({ visitas: [{ visita_id: "x", fecha: "2026-10-05" }], estados: [], prevPorPartida: prev, registros: [{ fecha: "2026-10-01", horas: 40 }], coste_hora: 16.8 })[0].color, "rojo");
  const certs = [
    { obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: "2026-10-02", horas_fichadas_visita: 21.6, visitas: [{ visita_id: "m1", fecha: "2026-10-02", estado: "cerrada", avance_pct: 0, partidas_con_avance: 0, partidas: 26, desvio_horas: null, retraso_dias: 1.35, color: "ambar" }] },
    { obra_id: "CPP. C/ URBANO ORAD, 13 – SEVILLA", ultima_visita_fecha: "2026-10-05", avance_pct: 2, visitas: [{ visita_id: "o13", fecha: "2026-10-05", estado: "abierta", avance_pct: 2 }] },
    { obra_id: "CCPP.URBANO ORAD 15", ultima_visita_fecha: "2026-10-06", avance_pct: 1, visitas: [{ visita_id: "o15", fecha: "2026-10-06", estado: "cerrada", avance_pct: 1 }] },
  ];
  const r6 = P.calendarioPlan(conCert(certs));
  // (07/10/2026) con las horas fichadas hasta el final del 02/10, incluido: 0 % con horas → rojo
  assert.deepStrictEqual(por(r6, "Jorge").visitas.map((v) => [v.fecha, v.avance_pct, v.abierta, v.color]), [["2026-10-02", 0, false, "rojo"]]);
  assert.deepStrictEqual(por(r6, "Urbano").visitas.map((v) => [v.fecha, v.abierta]), [["2026-10-05", true], ["2026-10-06", false]]);
  assert.ok(!JSON.stringify(r6).includes("desvio_eur"), "sin euros en Planificación");
  console.log("OK certificaciones-avance.test (visitas en el calendario)");
}

// 7 · producción 07/10: Montemayor llegaba con la última visita (02/10, 0 %) y «visitas: []» (datos de una carga
// guardada antes de la lista). Una sola fuente: el ◆ del 02/10 sale igual, y «toca visitar» usa la misma visita.
{
  const viejo = { obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: "2026-10-02", horas_fichadas_visita: 21.6, total_visitas: 1, partidas_activas: 14 };
  for (const c of [viejo, { ...viejo, visitas: [] }, { ...viejo, visitas: [{ visita_id: "m1", fecha: "2026-10-02", estado: "cerrada", avance_pct: 0, partidas_con_avance: 0, partidas: 14, horas_fichadas: 21.6, color: "ambar" }] }]) {
    const j = por(P.calendarioPlan(conCert([c])), "Jorge");
    assert.deepStrictEqual(j.visitas.map((v) => [v.fecha, v.avance_pct]), [["2026-10-02", 0]], JSON.stringify(c));
    assert.strictEqual(j.toca_visitar?.ultima_visita ?? j.visitas[j.visitas.length - 1].fecha, j.visitas[j.visitas.length - 1].fecha);
    // 0 %: el fin no sale de la visita («estimación sin visita»)
    assert.strictEqual(j.estimacion?.fuente === "visita", false);
  }
  console.log("OK certificaciones-avance.test (Montemayor: ◆ 0 % el 02/10 aunque los datos no traigan la lista)");
}

// 8 · Montemayor con inicio 05/10 en Planificación pero fichajes desde el 29/09 y visita el 02/10: la barra empieza el 29/09
{
  const a = args([...base0.map((o) => (o.obra_id === "jm" ? { ...o, empezada: "2026-10-05" } : o)), orad]);
  a.cf.certificaciones = [{ obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: "2026-10-02", horas_fichadas_visita: 21.6 }];
  const j = por(P.calendarioPlan(a), "Jorge");
  assert.ok(j.inicio <= "2026-10-02" && j.visitas[0].fecha === "2026-10-02", `${j.inicio}`);
  console.log(`OK certificaciones-avance.test (barra de Montemayor desde el ${j.inicio}: el ◆ del 02/10 cae dentro)`);
}

// 9 · Orad: una visita con un % por OO (Orad 13 y 15, 320 h cada una) cuenta como dos partidas: 50 % y 0 % → 25 %
{
  const vs = AV.visitasDeObra({ visitas: [{ visita_id: "o1", fecha: "2026-10-08", estado: "cerrada" }],
    estados: [{ visita_id: "o1", partida_id: "__TOTAL__:OO-2026-142", progreso_pct: 50 }, { visita_id: "o1", partida_id: "__TOTAL__:OO-2026-143", progreso_pct: 0 }],
    prevPorPartida: { "__TOTAL__:OO-2026-142": 320, "__TOTAL__:OO-2026-143": 320 }, registros: [{ fecha: "2026-10-06", horas: 200 }], coste_hora: 16.8 });
  assert.deepStrictEqual([vs[0].avance_pct, vs[0].partidas_con_avance, vs[0].partidas, vs[0].desvio_horas, vs[0].desvio_eur], [25, 1, 2, 160, 2688]);
  console.log("OK certificaciones-avance.test (Orad: % por OO ponderado por horas)");
}
