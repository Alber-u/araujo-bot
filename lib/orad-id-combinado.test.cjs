// 06/10/2026 · «Urbano Orad 13-15» (OO-2026-142 + OO-2026-143) existe para el resto de ARA·OS: se ficha con ese
// nombre, la rentabilidad del id combinado suma las dos OO, /ordenes-trabajo lo nombra y el dinero lo cuenta.
// Hoja de cálculo de mentira en memoria. Uso: node lib/orad-id-combinado.test.cjs
const assert = require("assert");
process.env.GOOGLE_SHEETS_ID = "x";
process.env.ADMIN_TOKEN = process.env.ARA_OS_TOKEN = "t";

const hojas = {};
const col = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const parse = (rango) => { const [h, r] = rango.split("!"); const m = (r || "A:ZZ").match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); return { h: h.replace(/^'|'$/g, ""), c0: col(m[1]), f0: m[2] ? Number(m[2]) : 1, c1: m[3] ? col(m[3]) : col(m[1]), f1: m[4] ? Number(m[4]) : null }; };
const fake = { spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(hojas).map((title) => ({ properties: { title } })) } }),
  batchUpdate: async ({ requestBody }) => { for (const q of requestBody.requests || []) if (q.addSheet) hojas[q.addSheet.properties.title] = hojas[q.addSheet.properties.title] || []; return {}; },
  values: {
    get: async ({ range }) => { const p = parse(range); const xs = hojas[p.h]; if (!xs) throw new Error(`Unable to parse range: ${range}`); const hasta = p.f1 || xs.length; return { data: { values: xs.slice(p.f0 - 1, hasta).map((r) => (r || []).slice(p.c0, p.c1 + 1)) } }; },
    update: async ({ range, requestBody }) => { const p = parse(range); const xs = (hojas[p.h] = hojas[p.h] || []); requestBody.values.forEach((v, i) => { const f = p.f0 - 1 + i; xs[f] = xs[f] || []; v.forEach((x, j) => (xs[f][p.c0 + j] = x)); }); return {}; },
    append: async ({ range, requestBody }) => { const p = parse(range); (hojas[p.h] = hojas[p.h] || []).push(...requestBody.values.map((v) => [...v])); return { data: { updates: {} } }; },
    batchGet: async ({ ranges }) => ({ data: { valueRanges: await Promise.all(ranges.map(async (r) => ({ values: (await fake.spreadsheets.values.get({ range: r })).data.values }))) } }),
  } } };
require("googleapis").google.sheets = () => fake;

// obras_otras: las dos OO de Orad en ejecución, 17.650 € sin IVA cada una
const OO = require("../ara-os-obras-otras.cjs");
const express = require("express");

(async () => {
  const app = express();
  require("../ara-os-registros-tiempo.cjs")(app);
  require("../ara-os-holded.cjs")(app);
  OO(app);
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const B = `http://127.0.0.1:${srv.address().port}/api/ara-os`;
  // pestañas creadas por los módulos; se rellenan las de esta prueba
  await fetch(`${B}/obras-otras?token=t`).catch(() => {});
  const obHead = hojas.obras_otras?.[0] || [];
  const filaOO = (o) => obHead.map((h) => (o[h] != null ? String(o[h]) : ""));
  hojas.obras_otras = [obHead,
    filaOO({ obra_id: "OO-2026-142", nombre: "CPP. C/ URBANO ORAD, 13 – SEVILLA", fase: "EN_EJECUCION", subtotal_eur: 17650, total_eur: 19415, importe: 19415, horas_previstas: 320, personas: 3, material_previsto_eur: 2500 }),
    filaOO({ obra_id: "OO-2026-143", nombre: "CCPP.URBANO ORAD 15", fase: "EN_EJECUCION", subtotal_eur: 17650, total_eur: 19415, importe: 19415, horas_previstas: 320, personas: 3, material_previsto_eur: 2500 })];
  // un operario con coste por hora (personas, col U)
  const per = Array(21).fill(""); per[0] = "P-JUAN"; per[1] = "Juan"; per[20] = "30";
  hojas.personas = [["id", "nombre"], per];
  hojas.comunidades = hojas.comunidades || [[]];
  hojas.config_dinero = [["clave", "valor", "nota"], ["coste_hora_eur", 30, ""]];
  hojas.ordenes_trabajo = hojas.ordenes_trabajo || [[]];
  const post = async (u, b) => { const r = await fetch(`${B}${u}?token=t`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, j: await r.json() }; };
  const get = async (u) => { const r = await fetch(`${B}${u}${u.includes("?") ? "&" : "?"}token=t`); return { status: r.status, j: await r.json() }; };

  // 1 · 8 h de un operario en «Urbano Orad 13-15» el 05/10 → 201, guardado con ese nombre
  const c = await post("/registros-tiempo", { fecha: "2026-10-05", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "Urbano Orad 13-15", horas: 8, usuario: "test" });
  assert.strictEqual(c.status, 201, JSON.stringify(c.j));
  const rt = hojas.registros_tiempo.slice(1).filter((r) => r[4] === "Urbano Orad 13-15");
  assert.deepStrictEqual(rt.map((r) => [r[1], r[2], Number(r[5])]), [["2026-10-05", "P-JUAN", 8]]);
  // una obra que no existe sigue rechazándose
  assert.strictEqual((await post("/registros-tiempo", { fecha: "2026-10-05", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "Urbano Orad 99", horas: 8, usuario: "test" })).status, 400);

  // 2 · rentabilidad del id combinado: las 8 h (240 €) y la suma de presupuestos; cada OO, la mitad
  const rc = await get(`/holded/rentabilidad-obra/${encodeURIComponent("OO-2026-142+OO-2026-143")}`);
  assert.strictEqual(rc.status, 200, JSON.stringify(rc.j));
  assert.deepStrictEqual([rc.j.nombre_comunidad, rc.j.real.mano_obra_horas, rc.j.real.mano_obra_real], ["Urbano Orad 13-15", 8, 240]);
  const r142 = await get("/holded/rentabilidad-obra/OO-2026-142");
  assert.deepStrictEqual([r142.status, r142.j.real.mano_obra_horas], [200, 4]);
  // (06/10/2026) presupuesto sin IVA y coste previsto del presupuesto: 320 h × 30 €/h + 2.500 € de material por portal
  assert.deepStrictEqual([r142.j.previsto.pto_total, r142.j.previsto.mano_obra_previsto, r142.j.previsto.material_previsto, r142.j.previsto.beneficio_previsto], [17650, 9600, 2500, 5550]);
  assert.deepStrictEqual([rc.j.previsto.pto_total, rc.j.previsto.mano_obra_previsto + rc.j.previsto.material_previsto, rc.j.real.presupuesto_real], [35300, 24200, 35300]);
  console.log(`OK orad-id-combinado.test · 8 h en «Urbano Orad 13-15» → 201 · rentabilidad del combinado ${rc.j.real.mano_obra_horas} h (${rc.j.real.mano_obra_real} €), presupuesto ${rc.j.real.presupuesto_real} € · OO-2026-142 ${r142.j.real.mano_obra_horas} h`);

  // 3 · el dinero: Urbano Orad en las órdenes en curso aunque /ordenes-trabajo no la traiga (sin planificación)
  const calc = require("./dinero-empresa-calculo.cjs");
  const ot = calc.otConOOEnCurso({ grupos: { "13_EN_EJECUCION": [] } }, { obras: [
    { obra_id: "OO-2026-142", nombre: "CPP. C/ URBANO ORAD, 13 – SEVILLA", fase: "EN_EJECUCION", subtotal_eur: "17650" },
    { obra_id: "OO-2026-143", nombre: "CCPP.URBANO ORAD 15", fase: "EN_EJECUCION", subtotal_eur: "17650", holded_invoice_id: "F1" },
    { obra_id: "OO-2026-150", nombre: "Otra", fase: "PRESUPUESTO", subtotal_eur: "999" }] }, { ok: true, data: [{ id: "F1", subtotal: 5000 }] });
  assert.deepStrictEqual(ot.grupos["13_EN_EJECUCION"].map((x) => [x.comunidad, x.ccpp_id, x.pto_total, x.sin_ot]), [["Urbano Orad 13-15", "OO-2026-142+OO-2026-143", 30300, true]]);
  // si ya la trae (tarjeta de Planificación), no se repite
  const ot2 = calc.otConOOEnCurso({ grupos: { "13_EN_EJECUCION": [{ comunidad: "Urbano Orad 13-15", ccpp_id: "OO-2026-142+OO-2026-143", pto_total: 35300, sin_ot: true }] } }, { obras: [{ obra_id: "OO-2026-142", nombre: "x", fase: "EN_EJECUCION", subtotal_eur: "17650" }] });
  assert.strictEqual(ot2.grupos["13_EN_EJECUCION"].length, 1);
  console.log("OK orad-id-combinado.test (dinero: Urbano Orad 13-15 en curso con 35.300 € menos lo facturado)");
  srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
