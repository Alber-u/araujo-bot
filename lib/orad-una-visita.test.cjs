// 08/10/2026 · Urbano Orad: una sola visita para los dos portales (Orad 13 y 15), horas de «Urbano Orad 13-15»
// repartidas en la visita en curso, un solo «toca visitar» y un solo ◆ en Planificación.
// Hoja de cálculo de mentira en memoria. Uso: node lib/orad-una-visita.test.cjs
const assert = require("assert");
process.env.GOOGLE_SHEETS_ID = "x";

// ── Sheets en memoria ─────────────────────────────────────────
const hojas = {};   // nombre → filas (con la cabecera en la 1)
const col = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const parse = (rango) => { const [h, r] = rango.split("!"); const m = (r || "").match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); return { h, c0: col(m[1]), f0: m[2] ? Number(m[2]) : 1, c1: m[3] ? col(m[3]) : col(m[1]), f1: m[4] ? Number(m[4]) : null }; };
const fake = { spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(hojas).map((title) => ({ properties: { title } })) } }),
  batchUpdate: async ({ requestBody }) => { for (const q of requestBody.requests || []) if (q.addSheet) hojas[q.addSheet.properties.title] = []; return {}; },
  values: {
    get: async ({ range }) => { const p = parse(range); const xs = hojas[p.h] || []; const hasta = p.f1 || xs.length; return { data: { values: xs.slice(p.f0 - 1, hasta).map((r) => (r || []).slice(p.c0, p.c1 + 1)) } }; },
    update: async ({ range, requestBody }) => { const p = parse(range); const xs = (hojas[p.h] = hojas[p.h] || []); requestBody.values.forEach((v, i) => { const f = p.f0 - 1 + i; xs[f] = xs[f] || []; v.forEach((x, j) => (xs[f][p.c0 + j] = x)); }); return {}; },
    append: async ({ range, requestBody }) => { const p = parse(range); (hojas[p.h] = hojas[p.h] || []).push(...requestBody.values.map((v) => [...v])); return {}; },
  } } };
require("googleapis").google.sheets = () => fake;

const PO = require("./partidas-orad.cjs");
const express = require("express");
const app = express();
require("../ara-os-certificaciones.cjs")(app);

(async () => {
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const B = `http://127.0.0.1:${srv.address().port}/api/certificaciones`;
  const get = async (u) => (await fetch(B + u)).json();
  const post = async (u, b) => (await fetch(B + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

  await get("/obras");   // crea las pestañas
  // Orad 13 y 15 preparados (las 7 partidas cada uno, 320 h) y 12 columnas en cada portal
  const H = ["partida_id", "obra_id", "bloque", "nombre", "tiempo_previsto_dias", "tiempo_previsto_horas", "orden", "created_at", "medicion"];
  for (const f of PO.filasPartidasOrad([])) hojas.certif_partidas.push(H.map((h) => f[h]));
  await post(`/obra/${encodeURIComponent("Urbano Orad 13")}/config`, { totales: { columnas: 12 } });
  await post(`/obra/${encodeURIComponent("Urbano Orad 15")}/config`, { totales: { columnas: 12 } });
  // fichado en «Urbano Orad 13-15»: 3 personas × 8 h el 05, 06 y 07/10 (72 h) y 40 h el 08/10
  hojas.registros_tiempo = [["registro_id", "fecha", "persona_id", "tipo", "obra_id", "horas"]];
  let n = 0;
  for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) for (const p of ["juan", "luis", "mario"]) hojas.registros_tiempo.push([`r${++n}`, d, p, "trabajo", "Urbano Orad 13-15", 8]);
  for (const p of ["juan", "luis", "mario", "manuel", "cristhian"]) hojas.registros_tiempo.push([`r${++n}`, "2026-10-08", p, "trabajo", "Urbano Orad 13-15", 8]);

  // la ficha sabe que se visita junto con su hermana
  const f13 = await get(`/obra/${encodeURIComponent("Urbano Orad 13")}`);
  assert.deepStrictEqual(f13.grupo_certif, { nombre: "Urbano Orad 13-15", obras: ["Urbano Orad 13", "Urbano Orad 15"] });

  // 1 · una visita desde Orad 13 con partidas de los dos portales → una visita en cada ficha, misma fecha
  const v = await post(`/obra/${encodeURIComponent("Urbano Orad 13")}/visita`, { fecha: "2026-10-09", autor: "JM", estados: [
    { partida_id: "orad13_p5", cantidad: 8 }, { partida_id: "orad13_p1", progreso_pct: 100 },
    { partida_id: "orad15_p5", cantidad: 4 }, { partida_id: "orad15_p3", cantidad: 6 } ] });
  assert.ok(v.ok, v.error);
  assert.deepStrictEqual(v.visitas.map((x) => x.obra_id), ["Urbano Orad 13", "Urbano Orad 15"]);
  const vis = hojas.certif_visitas.slice(1);
  assert.deepStrictEqual(vis.map((r) => [r[1], String(r[2]).slice(0, 10)]), [["Urbano Orad 13", "2026-10-09"], ["Urbano Orad 15", "2026-10-09"]]);
  const idDe = Object.fromEntries(v.visitas.map((x) => [x.obra_id, x.visita_id]));
  const est = hojas.certif_visita_estado.slice(1).map((r) => ({ visita: r[1], partida: r[2], pct: Number(r[3]) }));
  assert.deepStrictEqual(est.map((e) => [e.partida, e.visita === idDe[e.partida.startsWith("orad13") ? "Urbano Orad 13" : "Urbano Orad 15"], e.pct]),
    [["orad13_p5", true, 38], ["orad13_p1", true, 100], ["orad15_p5", true, 19], ["orad15_p3", true, 50]]);
  // no se puede abrir otra en el otro portal mientras esta siga abierta
  const otra = await post(`/obra/${encodeURIComponent("Urbano Orad 15")}/visita`, { fecha: "2026-10-10", autor: "JM", estados: [] });
  assert.ok(!otra.ok && /abierta/.test(otra.error));

  // 2 · visita en curso con horas: las 112 h de «13-15» hasta la víspera, mitad y mitad (56 h en cada portal)
  const va13 = await get(`/obra/${encodeURIComponent("Urbano Orad 13")}/visita-abierta`);
  const va15 = await get(`/obra/${encodeURIComponent("Urbano Orad 15")}/visita-abierta`);
  assert.deepStrictEqual([va13.cuadre.horas_totales, va15.cuadre.horas_totales], [56, 56]);
  assert.ok(va13.cuadre.horas_pendientes > 0, "hay horas para repartir");

  // 3 · un solo «Cerrar visita» cierra las dos
  const c = await post(`/visita/${encodeURIComponent(idDe["Urbano Orad 13"])}/cerrar`);
  assert.deepStrictEqual(c.cerradas.map((x) => x.obra_id), ["Urbano Orad 13", "Urbano Orad 15"]);
  assert.deepStrictEqual(hojas.certif_visitas.slice(1).map((r) => r[hojas.certif_visitas[0].indexOf("estado")]), ["cerrada", "cerrada"]);

  // (la vista de JM, «visita-iniciar» desde Orad 15, también abre la del 13 con la misma fecha; y un cierre las cierra)
  const vi = await post(`/obra/${encodeURIComponent("Urbano Orad 15")}/visita-iniciar`, { autor: "JM", fecha: "2026-10-10" });
  const del10 = hojas.certif_visitas.slice(1).filter((r) => String(r[2]).slice(0, 10) === "2026-10-10").map((r) => r[1]).sort();
  assert.deepStrictEqual(del10, ["Urbano Orad 13", "Urbano Orad 15"]);
  await post(`/visita/${encodeURIComponent(vi.visita_id)}/cerrar`);
  assert.ok(hojas.certif_visitas.slice(1).every((r) => r[hojas.certif_visitas[0].indexOf("estado")] === "cerrada"));

  // 4 · Certificaciones: el mismo «toca visitar» para la obra, en la primera ficha; Planificación: un solo ◆
  const ob = (await get("/obras")).obras;
  const o13 = ob.find((o) => o.obra_id === "Urbano Orad 13"), o15 = ob.find((o) => o.obra_id === "Urbano Orad 15");
  assert.deepStrictEqual([o13.grupo.principal, o15.grupo.principal, o13.alarma_visita.horas_desde_visita, o15.alarma_visita.horas_desde_visita], [true, false, 0, 0]);
  assert.deepStrictEqual([o13.ultima_visita_fecha, o15.ultima_visita_fecha].map((f) => String(f).slice(0, 10)), ["2026-10-10", "2026-10-10"]);
  const P = require("./planificacion-calendario.cjs");
  const J = require("./jornada.cjs");
  const HOY = "2026-10-12";
  const orad = { obra_id: "OO-2026-142+OO-2026-143", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 112, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" };
  const cf = { hoy: HOY, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [], certificaciones: ob,
    simulador: { ok: true, obras: [orad], historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
    automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [3, 2], desvio: 0, mat: 27, tram: 1, grande: 300 } } };
  const r = P.calendarioPlan({ cf, hoy: HOY, festivos: { lista: [], fuente: "config_dinero", errores: [] }, jornada: J.leerJornada({ horas_dia: "8" }), nombresCuadrillas: [["Juan", "Luis", "Mario"], ["Manuel", "Cristhian"]] });
  const u = r.obras.find((x) => x.nombre === "Urbano Orad 13-15");
  assert.deepStrictEqual(u.visitas.map((x) => x.fecha), ["2026-10-09", "2026-10-10"]);   // un ◆ por día, no uno por portal
  // (Orad 13: 105 h × 38 % + 8 h = 47,9 h; Orad 15: 105 × 19 % + 80 × 50 % = 59,95 h; de 640 h → 16,9 %)
  assert.strictEqual(u.visitas[0].avance_pct, 16.9);
  assert.strictEqual(r.obras.filter((x) => /orad/i.test(x.nombre)).length, 1);
  assert.ok(r.avisos.filter((a) => /Orad/.test(a.texto) && /visitar/i.test(a.texto)).length <= 1);
  console.log(`OK orad-una-visita.test · una visita → Orad 13 y 15 el 09/10 · visita en curso ${va13.cuadre.horas_totales} + ${va15.cuadre.horas_totales} h · un «Cerrar visita» · Planificación 1 ◆ (${u.visitas[0].avance_pct} %)`);
  srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
