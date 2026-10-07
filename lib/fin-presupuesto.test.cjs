// 07/10/2026 · Planificación: fin por las horas que quedan del presupuesto y exceso en rojo.
// Jorge de Montemayor 34: 108,8 h previstas, 60 fichadas (las del 05 y 06/10 aún sin registrar) → quedan 48,8 h con
// 2 personas × 8 h: acaba el 09/10 (no el 16/10 del ritmo de fichajes, 4 h por persona, ni lo frena la visita al 0 %).
// El 12/10 (festivo) sigue abierta con las 108,8 h fichadas: +1 día en rojo (el 13/10) y la de detrás, un día más tarde.
// Uso: node lib/fin-presupuesto.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const J = require("./jornada.cjs");

const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
const obras = [
  ob("jm", "Jorge de Montemayor 34", 108.8, { empezada: "2026-09-29" }),
  ob("rl", "Rafael Laffón 7", 400, { orden: 1, pasos: 0 }), ob("lp", "La Paz 29", 120, { orden: 2, pasos: 0 }),
];
const regsDe = (porDia) => Object.entries(porDia).flatMap(([fecha, h]) => ["Manuel", "Cristhian"].map((persona) => ({ fecha, persona, obra: "Jorge de Montemayor 34", horas: h / 2 })));
// 60 h hasta el 02/10; 40 h en los últimos 5 días laborables con 0 el 05 y el 06 → 4 h por persona
const hasta02 = { "2026-09-29": 20, "2026-09-30": 10, "2026-10-01": 15, "2026-10-02": 15 };
const cert = { obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: "2026-10-02", horas_fichadas_visita: 60,
  visitas: [{ visita_id: "v1", fecha: "2026-10-02", estado: "cerrada", avance_pct: 0, partidas_con_avance: 0, partidas: 14 }] };
const calc = (hoy, registros, extra = {}) => P.calendarioPlan({ hoy, festivos: fest, jornada, nombresCuadrillas: quienes, registros,
  cf: { hoy, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: [cert], ...extra,
    simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } } });
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

// 1 · hoy 07/10: quedan 48,8 h ÷ (2 × 8 h) → 07, 08 y 09/10 (lo que sobra, 0,8 h, se acaba el último día)
const r1 = calc("2026-10-07", regsDe(hasta02));
const j1 = por(r1, "Jorge");
assert.deepStrictEqual([j1.horas_registradas, j1.horas_quedan, j1.fin, j1.fin_previsto, j1.exceso, j1.retraso_dias], [60, 48.8, "2026-10-09", "2026-10-09", null, 0]);
assert.strictEqual(j1.ritmo.h_persona, 4);   // el ritmo queda como información, no alarga
const sig1 = r1.obras.filter((o) => o.equipo === j1.equipo && o !== j1).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
assert.strictEqual(sig1.inicio, "2026-10-13");   // 12/10 festivo
assert.ok(!r1.avisos.some((a) => /pasa de su presupuesto|va con retraso/.test(a.texto)));

// 2 · hoy 12/10 (festivo), sigue abierta con las 108,8 h fichadas hasta el 09/10: +1 día en rojo (13/10), +0 h,
//     y la siguiente de la Cuadrilla 1 empieza un día más tarde (14/10 en vez de 13/10)
const r2 = calc("2026-10-12", regsDe({ ...hasta02, "2026-10-07": 16, "2026-10-08": 16, "2026-10-09": 16.8 }));
const j2 = por(r2, "Jorge");
assert.deepStrictEqual([j2.horas_registradas, j2.fin_previsto, j2.fin, j2.exceso, j2.retraso_dias], [108.8, "2026-10-09", "2026-10-13", { desde: "2026-10-13", hasta: "2026-10-13", dias: 1, horas: 0 }, 1]);
const sig2 = r2.obras.find((o) => o.obra_id === sig1.obra_id);
assert.deepStrictEqual([sig2.equipo, sig2.inicio, sig2.empuje], [j2.equipo, "2026-10-14", { cuadrilla: j2.equipo, dias: 1 }]);
const av = r2.avisos.find((a) => a.tipo === "exceso");
assert.ok(av && /^Montemayor 34 pasa de su presupuesto: sigue abierta el 13\/10 y su presupuesto acababa el 09\/10 \(\+1 día · \+0 h sobre presupuesto\); .* se retrasa 1 día\.$/.test(av.texto), av && av.texto);
// con 4 h más fichadas: +4 h
const j3 = por(calc("2026-10-12", regsDe({ ...hasta02, "2026-10-07": 16, "2026-10-08": 16, "2026-10-09": 20.8 })), "Jorge");
assert.deepStrictEqual(j3.exceso, { desde: "2026-10-13", hasta: "2026-10-13", dias: 1, horas: 4 });
// 3 · el cash flow (Mi panel) toma las mismas fechas
assert.strictEqual(P.fechasPlan({ hoy: "2026-10-07", festivos: fest, jornada, nombresCuadrillas: quienes, registros: regsDe(hasta02), cf: { hoy: "2026-10-07", certificaciones: [cert], simulador: { ok: true, obras, historico: { fijos: {}, comision_pct: 0.2, personas_base: 5 } }, automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } } }).jm?.fin, "2026-10-09");
// 4 · Mi panel (simulador con la capacidad de las cuadrillas): el día de exceso ocupa la Cuadrilla 1 entera (16 h,
//     sin obra hecha) y la siguiente empieza el 14/10; ningún mes por encima de lo disponible
{
  const S = require("./simulador-caja.cjs");
  const regs = regsDe({ ...hasta02, "2026-10-07": 16, "2026-10-08": 16, "2026-10-09": 16.8 });
  const cf = { hoy: "2026-10-12", certificaciones: [cert], simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } }, automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const pc = P.planParaCaja({ cf, hoy: "2026-10-12", festivos: fest, jornada, nombresCuadrillas: quienes, registros: regs });
  assert.deepStrictEqual([pc.obras.jm.fin, pc.obras.jm.exceso], ["2026-10-13", { desde: "2026-10-13", hasta: "2026-10-13" }]);
  const obrasSim = obras.map((o) => (o.obra_id === "jm" ? { ...o, horas_registradas: 108.8 } : o));
  const sim = S.simular({ obras: obrasSim, historico: cf.simulador.historico, hoy: "2026-10-12", mandos: cf.automatico.mandos, planObras: pc.obras, capacidad: pc.capacidad });
  const jmS = sim.prog.find((p) => p.obra_id === "jm"), sigS = sim.prog.find((p) => p.obra_id === sig1.obra_id);
  assert.deepStrictEqual([jmS.fin, jmS.horas_exceso, sim.horas_cuadrilla[1]["2026-10"].obras["Jorge de Montemayor 34"]], ["2026-10-13", 16, 16]);
  assert.ok(sigS.inicio >= "2026-10-14", sigS.inicio);
  for (const c of pc.disponibles) for (const [m, d] of Object.entries(c.por_mes)) assert.ok((sim.horas_cuadrilla[c.equipo]?.[m]?.horas || 0) <= d + 0.5, `C${c.equipo} ${m}`);
}
// 5 · rombo de la visita en Planificación: 60 h fichadas de 108,8 y 40 % certificado → «va 40 % · debería 55 %» en rojo;
//     las previstas, «debería N %» con las horas planificadas hasta ese día
{
  const v40 = { ...cert, avance_pct: 40, ultima_visita_fecha: "2026-10-06", visitas: [{ visita_id: "v40", fecha: "2026-10-06", estado: "cerrada", avance_pct: 40, horas_fichadas: 60, horas_previstas: 108.8 }] };
  const rv = calc("2026-10-07", regsDe(hasta02), { certificaciones: [v40] });
  const jv = por(rv, "Jorge");
  assert.deepStrictEqual([jv.visitas[0].va_texto, jv.visitas[0].color], ["va 40 % · debería 55 %", "rojo"]);
  assert.ok(jv.visitas_previstas.length && jv.visitas_previstas.every((p) => p.deberia_pct > 55 && p.deberia_pct <= 100), JSON.stringify(jv.visitas_previstas));
}
// 6 · «debería» de las visitas previstas (07/10/2026): hasta el final del día de la visita, incluido; la del último
//     día de la obra, 100 %; una obra futura cuenta desde su inicio con sus horas planificadas (no las de la cuadrilla)
{
  const AV = require("./avance-certificaciones.cjs");
  // Montemayor: la prevista del 09/10 (último día) → 100 %
  const jmP = por(r1, "Jorge").visitas_previstas;
  const ult = jmP.find((p) => p.fecha === "2026-10-09");
  assert.ok(ult && ult.deberia_pct === 100, JSON.stringify(jmP));
  // obra futura de 142 h (2 personas × 8 h) que empieza el 19/10, visita cada 32 h: crece y solo el último día llega a 100 %
  const fn = { dia: (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    esLab: (iso) => { const w = new Date(iso + "T00:00:00Z").getUTCDay(); return w !== 0 && w !== 6; }, laborables: P.laborables };
  const fin = P.finPorHoras("2026-10-19", 142, { n: 2 }).ult;
  const pv = AV.planVisitas({ reales: [], inicio: "2026-10-19", fin, hoy: "2026-10-07", umbral: 32, horasDia: () => 16, fn, fichadasTotal: 0, previstas: 142 }).previstas;
  const pcts = pv.map((p) => p.deberia_pct);
  assert.ok(pcts.length >= 4 && pcts.every((x, i) => i === 0 || x > pcts[i - 1]), JSON.stringify(pv));
  assert.ok(pv.every((p) => (p.fecha < fin ? p.deberia_pct < 100 : p.deberia_pct === 100)), JSON.stringify(pv));
  assert.strictEqual(pv[0].deberia_pct, Math.round(16 / 142 * 1000) / 10);   // el día de inicio: 16 h
}
console.log(`OK fin-presupuesto.test · Montemayor acaba el ${j1.fin}; el 12/10 abierta: ${av.texto}`);
