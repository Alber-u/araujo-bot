// 07/10/2026 · Visitas previstas con la regla de Certificaciones (cada «horas_visita» h del plan, 32 por defecto).
// Uso: node lib/visitas-previstas.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");
const AV = require("./avance-certificaciones.cjs");

const HOY = "2026-10-07";   // miércoles
const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
const obras0 = [
  ob("jm", "Jorge de Montemayor 34", 109, { empezada: "2026-09-29" }),
  { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
  ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }),
];
const filas = [{ obra_id: "OO-2026-142+OO-2026-143", desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-05T09:00:00Z" }];
// Montemayor: 36 h fichadas desde la visita del 02/10 (02, 05 y 06/10)
const registros = [];
for (const d of ["2026-10-02", "2026-10-05", "2026-10-06"]) for (const p of ["Manuel", "Cristhian"]) registros.push({ fecha: d, persona: p, obra: "Jorge de Montemayor 34", horas: 6 });
const certs = [{ obra_id: "Jorge de Montemayor 34", avance_pct: 0, ultima_visita_fecha: "2026-10-02", horas_fichadas_visita: 0,
  visitas: [{ visita_id: "m1", fecha: "2026-10-02", estado: "cerrada", avance_pct: 0, partidas_con_avance: 0, partidas: 14 }] }];
const calc = (extra = {}) => {
  const obras = O.aplicarPlanificacion(obras0, filas);
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: certs, ...extra,
    simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  return P.calendarioPlan({ cf, hoy: HOY, festivos: fest, jornada, nombresCuadrillas: quienes, registros });
};
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));
const r = calc();
assert.strictEqual(r.horas_visita, 32);

// Montemayor: ◆ 0 % el 02/10; la siguiente (32 h del plan, 2 × 8 h: el 06/10) en rojo, con 36 h fichadas desde la visita;
// las demás cada 2 jornadas desde hoy
const jm = por(r, "Jorge");
assert.deepStrictEqual(jm.visitas.map((v) => [v.fecha, v.avance_pct]), [["2026-10-02", 0]]);
const [p0, p1, p2] = jm.visitas_previstas;
assert.deepStrictEqual([p0.fecha, p0.atrasada, p0.horas_fichadas, p0.motivo], ["2026-10-06", true, 36, "32 h desde la última (02/10)"]);
assert.deepStrictEqual([p1.fecha, p1.atrasada, p2.fecha], ["2026-10-09", false, "2026-10-14"]);   // 12/10 festivo
assert.strictEqual(jm.toca_visitar.motivo, "visita atrasada · 36 h fichadas desde la última");

// Orad: sin visitas; ◇ rojo el 05/10 (inicio), las siguientes en gris: 3 personas (24 h/día) hasta el 12/10 y 5 (40 h) desde
// el 13/10, cada día
const u = por(r, "Urbano");
const pu = u.visitas_previstas;
assert.deepStrictEqual([pu[0].fecha, pu[0].atrasada, pu[0].motivo], ["2026-10-05", true, "inicio de la obra"]);
assert.ok(pu.slice(1).every((v) => !v.atrasada));
// (sin ficha: el umbral de su grupo, 80 h)
assert.strictEqual(u.horas_visita, 80);
assert.ok(pu[pu.length - 1].fecha <= u.fin);
// Orad no tiene ficha en Certificaciones: «sin presupuesto…» (puede visitarse con el % de cada OO)
assert.ok(u.toca_visitar.sin_presupuesto && /^sin presupuesto en Certificaciones/.test(u.toca_visitar.motivo), u.toca_visitar.motivo);
// con su ficha (visita por % de cada OO, sin visitas aún): visita atrasada, y cada 80 h (las de Orad)
{
  const rO = calc({ certificaciones: [...certs, { obra_id: "Urbano Orad 13-15", avance_pct: 0, ultima_visita_fecha: null, modo_total: true, visitas: [] }] });
  const uO = por(rO, "Urbano");
  assert.strictEqual(uO.toca_visitar.motivo, "sin visita · visita atrasada 2 días laborables (prevista 05/10)");
  assert.strictEqual(uO.horas_visita, 80);
  // 80 h: 24 h/día hasta el 12/10 → 3 días (07, 08, 09 = 72 h) + el 13/10 (40 h) → 13/10; luego cada 2 días con 40 h
  assert.deepStrictEqual(uO.visitas_previstas.slice(1, 4).map((v) => v.fecha), ["2026-10-13", "2026-10-15", "2026-10-19"]);
}

// Laffón: ◇ gris el día que empieza; no está en obra: no «toca visitar»
const l = por(r, "Rafael");
assert.deepStrictEqual([l.visitas_previstas[0].fecha, l.visitas_previstas[0].atrasada, l.visitas_previstas[0].motivo, l.toca_visitar], [l.inicio, false, "inicio de la obra", null]);

// avisos y Mi día: los mismos
assert.deepStrictEqual(r.toca_visitar.map((x) => x.nombre).sort(), ["Jorge de Montemayor 34", "Urbano Orad 13-15"]);

// umbral en config_dinero «horas_visita» (no en el código): con 48 h, Montemayor (36 h) no va atrasada por horas
const r48 = calc({ horas_visita: "48" });
const jm48 = por(r48, "Jorge");
assert.deepStrictEqual([r48.horas_visita, jm48.visitas_previstas[0].fecha, jm48.visitas_previstas[0].atrasada], [48, "2026-10-07", false]);
assert.strictEqual(jm48.toca_visitar.motivo, "visita prevista hoy");
// la tarjeta de Certificaciones, con la misma regla
assert.deepStrictEqual([AV.atrasadaPorHoras(36, 32), AV.atrasadaPorHoras(31.9, 32), AV.umbralVisita(""), AV.umbralVisita("40")], [true, false, 32, 40]);
console.log(`OK visitas-previstas.test · Montemayor ${p0.fecha} roja (36 h) · Orad 05/10 roja y ${pu.length - 1} grises hasta el ${pu[pu.length - 1].fecha} · Laffón ${l.inicio}`);
