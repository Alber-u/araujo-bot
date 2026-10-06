// 06/10/2026 · Las obras no se pisan: el cambio de personas de Orad («desde 13/10: 5 pers.», entra la Cuadrilla 1)
// sigue a Montemayor, de donde viene esa gente. Uso: node lib/tramos-siguen-origen.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");

const HOY = "2026-10-06";
const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
const filas = [{ obra_id: "OO-2026-142+OO-2026-143", desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-05T09:00:00Z" }];
// Montemayor (Cuadrilla 1, en obra desde el 29/09): sus horas pendientes deciden cuándo acaba
const calc = (hMontemayor, conf = null) => {
  const obras0 = [
    { obra_id: "jm", nombre: "Jorge de Montemayor 34", fase: "09_TRAMITADA", importe: 7000, horas_previstas: hMontemayor, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, empezada: "2026-09-29", cuadrilla: 1 },
    { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
    { obra_id: "rl", nombre: "Rafael Laffón 7", fase: "09_TRAMITADA", importe: 7000, horas_previstas: 160, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, orden: 1, pasos: 0 },
  ];
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: [],
    simulador: { ok: true, obras: O.aplicarPlanificacion(obras0, filas), historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [2, 3], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const args = { cf, hoy: HOY, festivos: { lista: ["2026-10-12"], fuente: "config_dinero", errores: [] }, jornada: J.leerJornada({ horas_dia: "8" }), nombresCuadrillas: quienes, registros: [] };
  return { r: P.calendarioPlan({ ...args, conf }), fechas: P.fechasPlan(args) };
};
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

// 1 · Montemayor se alarga al 13/10 (2 personas × 8 h: 06, 07, 08, 09, 13/10 = 80 h; el 12 es festivo)
{
  const { r, fechas } = calc(80);
  const jm = por(r, "Jorge"), u = por(r, "Urbano"), l = por(r, "Rafael");
  assert.strictEqual(jm.fin, "2026-10-13");
  assert.deepStrictEqual(u.tramos_corridos, [{ cuadrilla: 1, desde: "2026-10-14", guardado: "2026-10-13", obra: "Jorge de Montemayor 34", fin: "2026-10-13" }]);
  assert.ok(/Cuadrilla 1 desde el 14\/10/.test(u.tramos_texto), u.tramos_texto);
  assert.deepStrictEqual(u.junta_desde, { 1: "2026-10-14" });
  // una sola barra por cuadrilla: la Cuadrilla 1 no tiene dos obras el mismo día
  assert.ok(jm.fin < u.junta_desde[1]);
  // aviso ámbar, ninguno rojo de choque
  assert.ok(r.avisos.some((a) => a.nivel === "ambar" && a.texto === "Urbano Orad: la Cuadrilla 1 entra el 14/10 en vez del 13/10 porque Jorge de Montemayor 34 acaba el 13/10."), JSON.stringify(r.avisos.map((a) => a.texto)));
  assert.ok(!r.avisos.some((a) => a.tipo === "choque" || /sigue en Jorge/.test(a.texto)));
  // Laffón (Cuadrilla 1, detrás) no empieza hasta que la Cuadrilla 1 vuelve de Orad
  assert.ok(l.equipo !== 1 || l.inicio > u.fin, `${l.equipo} ${l.inicio} ${u.fin}`);
  // el cash flow usa las mismas fechas (corridas)
  assert.deepStrictEqual([fechas[u.obra_id].fin, fechas[l.obra_id].inicio], [u.fin, l.inicio]);
  var finOradLargo = u.fin;
}
// 2 · con las horas fichadas Montemayor vuelve al 09/10: Orad vuelve a su fecha guardada (13/10), nunca antes
{
  const { r } = calc(32);
  const jm = por(r, "Jorge"), u = por(r, "Urbano");
  assert.strictEqual(jm.fin, "2026-10-07");
  assert.deepStrictEqual([u.tramos_corridos, u.junta_desde], [[], { 1: "2026-10-13" }]);
  assert.ok(!r.avisos.some((a) => a.tipo === "tramo_corrido" || a.tipo === "choque"));
  assert.ok(u.fin <= finOradLargo, "Orad recalcula su fin");
}
{
  const { r } = calc(64);   // acaba el 09/10
  assert.deepStrictEqual([por(r, "Jorge").fin, por(r, "Urbano").junta_desde], ["2026-10-09", { 1: "2026-10-13" }]);
}
console.log("OK tramos-siguen-origen.test · Montemayor al 13/10 → Cuadrilla 1 en Orad el 14/10 (aviso ámbar, sin choque) · Montemayor al 09/10 → vuelve al 13/10");
