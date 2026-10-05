// 07/10/2026 · Partidas de control de Urbano Orad 13 y 15. Uso: node lib/partidas-orad.test.cjs
const assert = require("assert");
const PO = require("./partidas-orad.cjs");
const AV = require("./avance-certificaciones.cjs");
const P = require("./planificacion-calendario.cjs");
const J = require("./jornada.cjs");

// 7 partidas, 320 h, las mismas en los dos portales; se cargan una vez (la segunda, nada)
assert.strictEqual(PO.PARTIDAS_ORAD.reduce((t, p) => t + p.horas, 0), 320);
const filas = PO.filasPartidasOrad([]);
assert.deepStrictEqual([filas.length, filas.filter((f) => f.obra_id === "Urbano Orad 13").length, filas.filter((f) => f.obra_id === "Urbano Orad 15").length], [14, 7, 7]);
assert.strictEqual(PO.filasPartidasOrad(filas).length, 0);
assert.deepStrictEqual(filas.filter((f) => f.obra_id === "Urbano Orad 13").map((f) => f.tiempo_previsto_horas), [8, 40, 80, 40, 105, 25, 22]);

// cómo se mide: 5 = «X de 21 viviendas»; 3, 4 y 6 = columnas (N de la obra, una vez por portal)
const med = (n, tot = {}) => PO.leerMedicion(filas.find((f) => f.partida_id === `orad13_p${n}`).medicion, tot);
assert.deepStrictEqual([med(5).unidad, med(5).total], ["viviendas", 21]);
assert.deepStrictEqual([med(3).unidad, med(3).total, med(3).falta_total], ["columnas", null, true]);
assert.deepStrictEqual([med(3, { columnas: 12 }).total, med(4, { columnas: 12 }).total, med(6, { columnas: 12 }).total], [12, 12, 12]);
assert.deepStrictEqual([med(1).tipo, med(7).tipo, med(2).total], ["hecho", "hecho_pct", 2]);
// «8 de 21 viviendas» → partida 5 al 38 %
assert.strictEqual(PO.pctDeConteo(8, 21), 38);

// una visita a Orad 13 con la partida 5 al 38 % (y nada más): 105 × 38 % ÷ 320 = 12,5 % de Orad 13
const prev13 = Object.fromEntries(filas.filter((f) => f.obra_id === "Urbano Orad 13").map((f) => [f.partida_id, f.tiempo_previsto_horas]));
const vs13 = AV.visitasDeObra({ visitas: [{ visita_id: "v13", fecha: "2026-10-07", estado: "cerrada" }], estados: [{ visita_id: "v13", partida_id: "orad13_p5", progreso_pct: 38 }],
  prevPorPartida: prev13, registros: [], coste_hora: 30 });
assert.deepStrictEqual([vs13[0].avance_pct, vs13[0].partidas_con_avance, vs13[0].partidas], [12.5, 1, 7]);

// Planificación junta los dos portales ponderando por horas (320 + 320): 12,5 % y 0 % → 6,3 %
{
  const HOY = "2026-10-08";
  const orad = { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", alias: ["CPP. C/ URBANO ORAD, 13 – SEVILLA", "CCPP.URBANO ORAD 15"], fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" };
  const certs = [
    { obra_id: "Urbano Orad 13", previsto_horas: 320, avance_pct: 12.5, ultima_visita_fecha: "2026-10-07", visitas: vs13 },
    { obra_id: "Urbano Orad 15", previsto_horas: 320, avance_pct: 0, ultima_visita_fecha: null, visitas: [] },
    // una de % global de antes: no cuenta con partidas
    { obra_id: "Urbano Orad 13-15", modo_total: true, previsto_horas: 640, avance_pct: 90, ultima_visita_fecha: "2026-10-06", visitas: [{ visita_id: "x", fecha: "2026-10-06", avance_pct: 90 }] },
  ];
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: certs,
    simulador: { ok: true, obras: [orad], historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [3, 2], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const r = P.calendarioPlan({ cf, hoy: HOY, festivos: { lista: ["2026-10-12"], fuente: "config_dinero", errores: [] }, jornada: J.leerJornada({ horas_dia: "8" }), nombresCuadrillas: [["Juan", "Luis", "Mario"], ["Manuel", "Cristhian"]] });
  const u = r.obras.find((o) => o.nombre.startsWith("Urbano"));
  assert.deepStrictEqual(u.visitas.map((v) => [v.fecha, v.avance_pct]), [["2026-10-07", 6.3]]);
  assert.ok(!u.toca_visitar?.sin_presupuesto, "con partidas ya no es «sin presupuesto»");
  assert.deepStrictEqual([u.sin_partidas, u.sin_preparar, u.visitas_previstas.length > 0], [false, null, true]);
  assert.strictEqual(u.horas_visita, 80);
  console.log(`OK partidas-orad.test · 14 partidas · 8 de 21 viviendas = 38 % · Orad junto: ${u.visitas[0].avance_pct} % el 07/10`);
}
