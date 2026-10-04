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
// Jorge en la Cuadrilla 1 desde el 02/10; Orad en la 2 desde el 05/10: tope 695 h sin desvío ÷ (3 × 7,7 h,
// convenio del Metal) = 30,1 → 31 jornadas, último día 18/11 (el 12/10 y el 02/11 son festivos)
assert.deepStrictEqual([por("Jorge").equipo, por("Jorge").inicio, por("Jorge").estado], [1, "2026-10-02", "en_ejecucion"]);
const u = por("Urbano");
assert.deepStrictEqual([u.equipo, u.inicio, u.fin, u.dias_laborables, u.estado, Math.round(u.horas_tope_margen)], [2, "2026-10-05", "2026-11-18", 31, "agendada", 695]);
// horas del presupuesto sin desvío: Jorge 109 h ÷ (2 × 7,7 h) = 7,1 jornadas
assert.strictEqual(por("Jorge").jornadas, 7.1);
// Mandarinas 2 terminada: no se planifica y lo avisa
assert.ok(!por("Mandarinas"));
assert.ok(r.avisos.some((a) => /Ya terminadas \(no se planifican\): Mandarinas 2 \(270 de 296 h, fin 01\/10\)/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(r.avisos.some((a) => /Urbano Orad 13-15 empieza el 05\/10 con la Cuadrilla 2: tope de 695 h .* 31 jornadas \(último día 18\/11\)\. Al ritmo .*\+18 %\) serían 36 jornadas/.test(a.texto)), JSON.stringify(r.avisos));
assert.ok(r.avisos.some((a) => a.nivel === "rojo" && /Virgen de la Antigua 2: sin presupuesto, expediente atascado 200 días/.test(a.texto)));
// trámite en 5 pasos y motivo
assert.deepStrictEqual([por("Jorge").etapa_txt, por("Malvaloca").etapa_txt, por("Virgen").etapa_txt], ["En obra", "Documentación", "CyCP"]);
assert.ok(/Ya tramitada: entra en cuanto la Cuadrilla 1 queda libre/.test(por("Rafael").motivo), por("Rafael").motivo);
assert.ok(/Tiene 384 h: cuadrilla grande/.test(por("Doctor Fedriani").motivo));
assert.ok(/Lista hacia|Su trámite estará/.test(por("Malvaloca").motivo));
// Obra grande que acaba en la cuadrilla pequeña porque la grande está ocupada: lo dice
{
  const cf2 = { ...cf, simulador: { ...cf.simulador, obras: [
    { obra_id: "u", nombre: "Grande A", fase: "09_TRAMITADA", importe: 1, horas_previstas: 2000, horas_registradas: 0, orden: 1, pasos: 0 },
    { obra_id: "m", nombre: "Malvaloca 1", fase: "09_TRAMITADA", importe: 1, horas_previstas: 528, horas_registradas: 0, orden: 2, pasos: 0 }] } };
  const x = P.calendarioPlan({ cf: cf2, hoy: HOY }).obras.find((o) => o.nombre === "Malvaloca 1");
  assert.ok(x.equipo === 1 && /Tiene 528 h, pero la Cuadrilla 2 está ocupada hasta el \d\d\/\d\d: va a la 1\./.test(x.motivo), x.motivo);
}
// Jorge con inicio fijo a mano el 02/10 (ya tramitada): en obra, sin aviso de trámite
{
  const cf3 = { ...cf, simulador: { ...cf.simulador, obras: cf.simulador.obras.map((o) => (o.obra_id === "jm" ? { ...o, empezada: undefined, inicio_fijo: "2026-10-02", inicio_manual: true, cuadrilla: 1, pasos: 0, plan: { fecha_inicio_fija: "2026-10-02", cuadrilla: 1, usuario: "Alberto", nota: "empezó el viernes 02/10, faltan sus registros" } } : o)) } };
  const r3 = P.calendarioPlan({ cf: cf3, hoy: HOY });
  const j = r3.obras.find((o) => o.obra_id === "jm");
  assert.deepStrictEqual([j.estado, j.inicio, j.equipo, j.antes_de_tramite], ["en_ejecucion", "2026-10-02", 1, false]);
  assert.ok(!r3.avisos.some((a) => /Jorge/.test(a.texto) && /tramitada/.test(a.texto)));
}
// Terminadas sin horas registradas (cobradas enteras): fuera de la cola y aviso de una línea para JM
{
  const cf4 = { ...cf, simulador: { ...cf.simulador, obras: [...cf.simulador.obras,
    { obra_id: "bt", nombre: "Betis 20", fase: "09_TRAMITADA", importe: 8475, horas_previstas: 142, horas_registradas: 0, cobrada: true, facturada: true },
    { obra_id: "df39", nombre: "Doctor Fedriani 39 bis", fase: "09_TRAMITADA", importe: 20999, horas_previstas: 384, horas_registradas: 0, cobrada: true, facturada: true }] } };
  const r4 = P.calendarioPlan({ cf: cf4, hoy: HOY });
  assert.ok(!r4.obras.some((o) => ["bt", "df39"].includes(o.obra_id)));
  assert.ok(r4.avisos.some((a) => a.texto === "Terminadas sin horas registradas: Betis 20, Doctor Fedriani 39 bis."), JSON.stringify(r4.avisos));
}
// Custodia: aviso sin euros con la fecha de inicio de la planificación
{
  const r5 = P.calendarioPlan({ cf: { ...cf, custodias_obras: [{ ccpp_id: "lp", comunidad: "La Paz 29", en_custodia: 730.02 }] }, hoy: HOY });
  const lp = r5.obras.find((o) => o.obra_id === "lp");
  const av = r5.avisos.find((a) => /custodia/.test(a.texto));
  assert.ok(lp.custodia && av && av.texto.includes(`La Paz 29 (${lp.inicio.slice(8, 10)}/${lp.inicio.slice(5, 7)})`) && !av.texto.includes("€"), JSON.stringify(av));
}
// Fechas de inicio de Planificación para las entregas de custodia del cash flow
{
  const f = P.fechasInicioPlan({ cf, hoy: HOY });
  const r6 = P.calendarioPlan({ cf, hoy: HOY });
  for (const o of r6.obras) assert.strictEqual(f[o.obra_id], o.inicio, o.nombre);
}
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
