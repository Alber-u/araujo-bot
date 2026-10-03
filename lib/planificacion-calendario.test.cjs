// Test de la planificación por cuadrillas (jornadas, sin euros). Uso: node lib/planificacion-calendario.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");

const HOY = "2026-10-03";
const ob = (obra_id, nombre, fase, importe, h, extra = {}) => ({ obra_id, nombre, fase, importe, horas_previstas: h, horas_registradas: 0, material_previsto: importe * 0.25, ...extra });
const obras = [
  ob("jm", "Jorge de Montemayor 34", "09_TRAMITADA", 7058, 109, { empezada: "2026-10-02" }),
  { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 17650, importe_total: 35300, horas_previstas: 695, horas_tope_fijo: true, horas_registradas: 0, mes_cobro: 1, sin_comision: true, inicio_fijo: "2026-10-05" },
  ob("rl", "Rafael Laffón 7", "09_TRAMITADA", 8981, 142, { orden: 1, pasos: 0 }),
  ob("lp", "La Paz 29", "09_TRAMITADA", 14515, 192, { orden: 2, pasos: 0 }),
  ob("df", "Doctor Fedriani 39", "09_TRAMITADA", 20999, 384, { orden: 3, pasos: 0 }),
  ob("mv", "Malvaloca 1", "05_DOCUMENTACION", 36126, 528, { orden: 4, pasos: 4 }),
  ob("vg", "Virgen de la Antigua 2", "07_PTE_CYCP", 0, 357, { orden: 5, pasos: 2, atascada_dias: 200 }),
  ob("md", "Mandarinas 2", "09_TRAMITADA", 21009, 296, { horas_registradas: 270, fecha_fin: "2026-10-01" }),
];
const cf = {
  hoy: HOY, inicial: { propio: -20000, custodia_y_senales: 60000 },
  semanas: [{ n: 1, desde: "2026-09-28", hasta: "2026-10-04", movs: [] }], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 18, mat: 27, tram: 1, grande: 300 } },
};

// jornadas laborables, fin = último día de trabajo
assert.strictEqual(P.laborables("2026-10-05", "2026-10-11"), 5);
assert.strictEqual(P.sumarJornadas("2026-10-05", 29), "2026-11-13");          // exclusivo → último día 12/11
assert.deepStrictEqual(P.personasPorCuadrilla("Cuadrilla 1: Antonio, Pepe; Cuadrilla 2: Juan, Luis, Mario"), [["Antonio", "Pepe"], ["Juan", "Luis", "Mario"]]);
assert.strictEqual(P.textoPersonas([["A", "B"], ["C"]]), "Cuadrilla 1: A, B; Cuadrilla 2: C");

const r = P.calendarioPlan({ cf, hoy: HOY, alternativas: true });
// Sin euros para nadie
const texto = JSON.stringify(r);
for (const k of ["importe", "beneficio", "comision", "material", "dinero", "caja", "€"]) assert.ok(!texto.includes(k === "€" ? "€" : `"${k}`), `sale ${k}`);
const por = (n) => r.obras.find((x) => x.nombre.startsWith(n));
// Jorge en la Cuadrilla 1 desde el 02/10; Orad en la 2 desde el 05/10: tope 695 h sin desvío = 29 jornadas, último día 12/11
assert.deepStrictEqual([por("Jorge").equipo, por("Jorge").inicio, por("Jorge").estado], [1, "2026-10-02", "en_ejecucion"]);
const u = por("Urbano");
assert.deepStrictEqual([u.equipo, u.inicio, u.fin, u.dias_laborables, u.estado, Math.round(u.horas_tope_margen)], [2, "2026-10-05", "2026-11-12", 29, "agendada", 695]);
// horas del presupuesto sin desvío: Jorge 109 h ÷ 16 h = 6,8 jornadas
assert.strictEqual(por("Jorge").jornadas, 6.8);
// Mandarinas 2 terminada: no se planifica y lo avisa
assert.ok(!por("Mandarinas"));
assert.ok(r.avisos.some((a) => /Ya terminadas \(no se planifican\): Mandarinas 2 \(270 de 296 h, fin 01\/10\)/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(r.avisos.some((a) => /Urbano Orad 13-15 empieza el 05\/10 con la Cuadrilla 2: tope de 695 h .* 29 jornadas \(último día 12\/11\)\. Al ritmo .*\+18 %\) serían 35 jornadas/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(r.avisos.some((a) => a.nivel === "rojo" && /Virgen de la Antigua 2: sin presupuesto, expediente atascado 200 días/.test(a.texto)));
// trámite en 5 pasos y motivo
assert.deepStrictEqual([por("Jorge").etapa_txt, por("Malvaloca").etapa_txt, por("Virgen").etapa_txt], ["En obra", "Documentación", "CyCP"]);
assert.ok(/Ya tramitada: entra en cuanto la Cuadrilla 1 queda libre/.test(por("Rafael").motivo), por("Rafael").motivo);
assert.ok(/Tiene 384 h: cuadrilla grande/.test(por("Doctor Fedriani").motivo));
assert.ok(/Lista hacia|Su trámite estará/.test(por("Malvaloca").motivo));
// Real: solo lo que está en obra o con fecha
assert.deepStrictEqual(P.calendarioPlan({ cf, hoy: HOY, modo: "real" }).obras.map((x) => x.nombre).sort(), ["Jorge de Montemayor 34", "Urbano Orad 13-15"]);
// Mover La Paz 29 delante de Rafael Laffón 7
const m = P.calendarioPlan({ cf, hoy: HOY, borrador: { obra_id: "lp", posicion: 3 } });
assert.ok(m.obras.find((x) => x.obra_id === "lp").puesto < m.obras.find((x) => x.obra_id === "rl").puesto);
// Probar configuraciones: las optimizadas no empeoran; «Ver» marca los puestos que cambian
const alt = Object.fromEntries(r.alternativas.map((a) => [a.id, a]));
assert.deepStrictEqual(Object.keys(alt), ["actual", "fin", "media", "antes"]);
assert.ok(alt.fin.dif_fin_dias <= 0 && alt.media.dif_media_dias <= 0);
assert.ok(alt.actual.aplicar.every((x) => !["jm", "OO-2026-142+OO-2026-143"].includes(x.obra_id)));   // lo fijado no se toca
const ver = P.calendarioPlan({ cf, hoy: HOY, conf: alt.antes.conf });
assert.strictEqual(ver.viendo, alt.antes.k);
// Otra cuadrilla: 3 + 2 (la grande pasa a ser la 1)
const t = P.calendarioPlan({ cf, hoy: HOY, tam: [3, 2] });
assert.strictEqual(t.obras.find((x) => x.nombre.startsWith("Urbano")).equipo, 1);
console.log(`OK planificacion-calendario.test · ${r.obras.length} obras · fin cartera ${r.metricas.fin} · optimizada ${alt.fin.dif_fin_dias} d`);
