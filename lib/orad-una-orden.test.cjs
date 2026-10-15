// 15/10/2026 · Prueba de aceptación del encargo «Urbano Orad UNA orden en Otras órdenes + Jorge de Montemayor
// (contadores + tuberías)». Módulos reales sobre Express, hoja de cálculo y Holded de mentira, con los datos de
// producción del 15/10 (~18:50). Uso: node lib/orad-una-orden.test.cjs
const assert = require("assert");
const crypto = require("crypto");
process.env.GOOGLE_SHEETS_ID = "x";
process.env.ADMIN_TOKEN = process.env.ARA_OS_TOKEN = "t";
process.env.HOLDED_API_KEY = "k";

// ── Hoja de mentira ────────────────────────────────────────────
const hojas = {};
const col = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const parse = (rango) => { const [h, r] = rango.split("!"); const m = (r || "A:ZZ").match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); return { h: h.replace(/^'|'$/g, ""), c0: col(m[1]), f0: m[2] ? Number(m[2]) : 1, c1: m[3] ? col(m[3]) : col(m[1]), f1: m[4] ? Number(m[4]) : null }; };
const escribir = (range, values) => { const p = parse(range); const xs = (hojas[p.h] = hojas[p.h] || []); values.forEach((v, i) => { const f = p.f0 - 1 + i; xs[f] = xs[f] || []; v.forEach((x, j) => (xs[f][p.c0 + j] = x)); }); };
const fake = { spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(hojas).map((title, i) => ({ properties: { title, sheetId: i, gridProperties: { columnCount: 60 } } })) } }),
  batchUpdate: async ({ requestBody }) => { for (const q of requestBody.requests || []) if (q.addSheet) hojas[q.addSheet.properties.title] = hojas[q.addSheet.properties.title] || []; return {}; },
  values: {
    get: async ({ range }) => { const p = parse(range); const xs = hojas[p.h]; if (!xs) throw new Error(`Unable to parse range: ${range}`); const hasta = p.f1 || xs.length; return { data: { values: xs.slice(p.f0 - 1, hasta).map((r) => (r || []).slice(p.c0, p.c1 + 1)) } }; },
    update: async ({ range, requestBody }) => { escribir(range, requestBody.values); return {}; },
    batchUpdate: async ({ requestBody }) => { for (const x of requestBody.data) escribir(x.range, x.values); return {}; },
    append: async ({ range, requestBody }) => { const p = parse(range); (hojas[p.h] = hojas[p.h] || []).push(...requestBody.values.map((v) => [...v])); return { data: { updates: {} } }; },
    batchGet: async ({ ranges }) => ({ data: { valueRanges: await Promise.all(ranges.map(async (r) => ({ values: (await fake.spreadsheets.values.get({ range: r })).data.values }))) } }),
  } } };
require("googleapis").google.sheets = () => fake;

// ── Holded de mentira: compras etiquetadas ─────────────────────
const ts = (iso) => Math.floor(Date.parse(iso + "T12:00:00Z") / 1000);
const COMPRAS = [
  { id: "c1", date: ts("2026-10-06"), tags: ["ot01432026ccppurbanoorad13"], subtotal: 100, tax: 21, total: 121 },
  { id: "c2", date: ts("2026-10-07"), tags: ["ot01442026ccppurbanoorad15"], subtotal: 56.47, tax: 11.86, total: 68.33 },
  { id: "c3", date: ts("2026-10-08"), tags: ["jorgedemontemayor34tuberias"], subtotal: 45, tax: 9.45, total: 54.45 },
  { id: "c4", date: ts("2026-09-20"), tags: ["jorgemontemayor34contadores"], subtotal: 474.81, tax: 99.71, total: 574.52 },
];
// ventas: el anticipo F260049 (22/09, 17.650 + 10 % IVA, cobrada) al contacto único de Orad, y la F260051 de tuberías
const CONTACTO_ORAD = "6ab38664ed647c83cb07ba87";
const VENTAS = [
  { id: "inv49", docNumber: "F260049", date: ts("2026-09-22"), contact: CONTACTO_ORAD, contactName: "COMUNIDAD DE PROPIETARIOS CL.URBANO ORAD 13-15", subtotal: 17650, tax: 1765, total: 19415, paymentsTotal: 19415, paymentsPending: 0, status: 2, tags: [] },
  { id: "inv51", docNumber: "F260051", date: ts("2026-10-12"), contact: "C-MARAVER", contactName: "Juan Antonio Maraver Romero", subtotal: 1920, tax: 192, total: 2112, paymentsTotal: 0, paymentsPending: 2112, status: 0, tags: [] },
];
const fetchReal = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.includes("holded.com")) return fetchReal(url, opts);
  const q = new URL(u).searchParams;
  const docs = u.includes("/documents/purchase?") || u.endsWith("/documents/purchase")
    ? COMPRAS.filter((d) => !q.get("starttmp") || (d.date >= Number(q.get("starttmp")) && d.date <= Number(q.get("endtmp"))))
    : u.includes("/documents/invoice") ? VENTAS.filter((d) => !q.get("starttmp") || (d.date >= Number(q.get("starttmp")) && d.date <= Number(q.get("endtmp")))) : [];
  return { ok: true, status: 200, text: async () => JSON.stringify(docs), json: async () => docs };
};

// ── Datos (producción, 15/10/2026) ─────────────────────────────
const ccpp = (dir) => `ccpp_${dir.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${crypto.createHash("md5").update(dir).digest("hex").slice(0, 6)}`;
const DIR_JM = "CALLE JORGE DE MONTEMAYOR, 34";
const ID_JM = ccpp(DIR_JM);
const MIG = require("../ara-os-migraciones.cjs");
MIG.TUBERIAS.relacionada = ID_JM;   // (en producción: ccpp_jorge_de_montemayor_34_9836ef)

(async () => {
  const express = require("express");
  const app = express();
  app.use(express.json());
  require("../ara-os-registros-tiempo.cjs")(app);
  require("../ara-os-obras-otras.cjs")(app);
  require("../ara-os-holded.cjs")(app);
  require("../ara-os-panel-obras.cjs")(app);
  MIG(app);
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  process.env.PORT = String(srv.address().port);
  const B = `http://127.0.0.1:${srv.address().port}/api/ara-os`;
  const get = async (u) => { const r = await fetch(`${B}${u}${u.includes("?") ? "&" : "?"}token=t`); return { status: r.status, j: await r.json() }; };
  const post = async (u, b = {}) => { const r = await fetch(`${B}${u}${u.includes("?") ? "&" : "?"}token=t`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, j: await r.json() }; };
  const patch = async (u, b = {}) => { const r = await fetch(`${B}${u}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, j: await r.json() }; };

  await fetch(`${B}/obras-otras?token=t`).catch(() => {});      // crea pestañas y cabeceras
  await fetch(`${B}/registros-tiempo?token=t`).catch(() => {});
  await fetch(`${B}/holded/etiquetas?token=t`).catch(() => {});
  const head = (h) => hojas[h][0];
  const fila = (h, o) => head(h).map((k) => (o[k] != null ? String(o[k]) : ""));
  const oo = (o) => fila("obras_otras", { personas: 3, borrado: "FALSE", tags_holded: "[]", ...o });
  hojas.obras_otras = [head("obras_otras"),
    oo({ obra_id: "OO-2026-142", codigo_ot: "OT0143/2026", nombre: "CPP. C/ URBANO ORAD, 13 – SEVILLA", fase: "EN_EJECUCION", fecha_inicio: "2026-10-05", subtotal_eur: 17650, iva_eur: 1765, total_eur: 19415, importe: 19415, horas_previstas: 320, material_previsto_eur: 2500, dias_estimados: 13.33, holded_contact_id: "C13" }),
    oo({ obra_id: "OO-2026-143", codigo_ot: "OT0144/2026", nombre: "CCPP.URBANO ORAD 15", fase: "EN_EJECUCION", fecha_inicio: "2026-10-05", subtotal_eur: 17650, iva_eur: 1765, total_eur: 19415, importe: 19415, horas_previstas: 320, material_previsto_eur: 2500, dias_estimados: 13.33, holded_contact_id: "C15" }),
    oo({ obra_id: "OO-2026-150", codigo_ot: "OT0151/2026", nombre: "Jorge Montemayor 34 TUBERIAS", fase: "FACTURADA", fecha_inicio: "2026-10-06", subtotal_eur: 1920, iva_eur: 192, total_eur: 2112, importe: 2112, horas_previstas: 40, material_previsto_eur: 60, personas: 2 }),
  ];
  hojas.obras_otras_entradas_cuenta = [hojas.obras_otras_entradas_cuenta[0],
    ["EC-1", "OO-2026-142", "2026-09-25", "9707.5", "50 % anticipo F260049", "", "", "FALSE", "", ""],
    ["EC-2", "OO-2026-143", "2026-09-25", "9707.5", "50 % anticipo F260049", "", "", "FALSE", "", ""]];
  hojas.holded_etiquetas = [head("holded_etiquetas"),
    ["OO-2026-142", "ot01432026ccppurbanoorad13", "CPP. C/ URBANO ORAD, 13 – SEVILLA", "otras", "2026-10-05", "TRUE", ""],
    ["OO-2026-143", "ot01442026ccppurbanoorad15", "CCPP.URBANO ORAD 15", "otras", "2026-10-05", "TRUE", ""],
    [ID_JM, "jorgemontemayor34contadores", "Jorge de Montemayor 34", "plan5", "2026-09-01", "TRUE", ""]];
  const com = Array(60).fill(""); com[0] = "Jorge de Montemayor 34"; com[1] = DIR_JM; com[15] = "09_TRAMITADA"; com[22] = "7057,79";
  hojas.comunidades = [["comunidad"], com];
  hojas.ordenes_trabajo = [["comunidad", "fase_ot"], ["Jorge de Montemayor 34", "13_EN_EJECUCION"]];
  const per = Array(21).fill(""); per[0] = "P-JUAN"; per[1] = "Juan"; per[20] = "30";
  hojas.personas = [["id", "nombre"], per];
  hojas.config_dinero = [["clave", "valor", "nota"], ["coste_hora_eur", 30, ""]];
  hojas.planificacion_obras = [["obra_id", "posicion", "fecha_inicio_fija", "cuadrilla", "nota", "usuario", "fecha", "operarios", "desde", "estado"],
    ["OO-2026-142+OO-2026-143", "", "", "", "juntas", "Alberto", "2026-10-05T09:00:00Z", "Juan", "2026-10-13", ""]];
  // registros: 179,5 h en «Urbano Orad 13-15» del 05 al 14/10, 40 h en «Jorge Montemayor 34 TUBERIAS», 95 h de contadores
  const rt = (n, fecha, obra, horas) => fila("registros_tiempo", { registro_id: `RT-${fecha.replace(/-/g, "")}-${String(n).padStart(3, "0")}`, fecha, persona_id: "P-JUAN", tipo: "trabajo", obra_id: obra, horas, source: "manual", borrado: "FALSE", coste_hora: 30 });
  const regs = [];
  const diasOrad = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-12", "2026-10-13", "2026-10-14"];
  let n = 0;
  for (const [i, f] of diasOrad.entries()) regs.push(rt(++n, f, "Urbano Orad 13-15", i === 0 ? 19.5 : 20));   // 19,5 + 8 × 20 = 179,5
  for (const f of ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]) regs.push(rt(++n, f, "Jorge Montemayor 34 TUBERIAS", 8));
  for (let i = 0; i < 10; i++) regs.push(rt(++n, `2026-09-${String(10 + i).padStart(2, "0")}`, "Jorge de Montemayor 34", 9.5));
  hojas.registros_tiempo = [head("registros_tiempo"), ...regs];
  require("../ara-os-registros-tiempo.cjs").invalidarCacheRegistros();
  require("../ara-os-obras-otras.cjs").invalidarCaches();

  // ── Antes: la ficha de tuberías ignoraba las 40 h si el nombre no casaba; el diagnóstico ve los textos ──
  const diag0 = await get("/registros-tiempo/diagnostico/obras");
  assert.strictEqual(diag0.status, 200, JSON.stringify(diag0.j));
  const estado0 = Object.fromEntries(diag0.j.obras.map((o) => [o.obra_id, [o.estado, o.sugerido, o.horas]]));
  assert.deepStrictEqual(estado0["Urbano Orad 13-15"], ["huerfano", null, 179.5]);
  assert.deepStrictEqual(estado0["Jorge Montemayor 34 TUBERIAS"], ["por_nombre", "OO-2026-150", 40]);

  // ── Migración: simulación (no escribe) ──
  const copia = JSON.stringify(hojas);
  const sim = await get("/admin/migraciones/orad-montemayor");
  assert.strictEqual(sim.status, 200, JSON.stringify(sim.j));
  assert.strictEqual(JSON.stringify(hojas), copia, "la simulación no escribe");
  assert.strictEqual(sim.j.simulacion, true);
  assert.deepStrictEqual(sim.j.registros_reescritos.por_obra, { "Urbano Orad 13-15 → OO-2026-142": 179.5, "Jorge Montemayor 34 TUBERIAS → OO-2026-150": 40 });
  assert.deepStrictEqual(sim.j.avisos, []);
  const a142 = sim.j.antes.obras.find((o) => o.obra_id === "OO-2026-142"), d142 = sim.j.despues.obras.find((o) => o.obra_id === "OO-2026-142");
  assert.deepStrictEqual([a142.subtotal_eur, a142.cobrado_entradas], [17650, 9707.5]);
  assert.deepStrictEqual([d142.nombre, d142.subtotal_eur, d142.total_eur, d142.horas_previstas, d142.material_previsto_eur, d142.cobrado_entradas, d142.borrado, d142.codigo_ot],
    ["CCPP Urbano Orad 13-15", 35300, 38830, 640, 5000, 19415, false, "OT0143/2026"]);
  assert.deepStrictEqual(d142.tags_holded, ["ot01432026ccppurbanoorad13", "ot01442026ccppurbanoorad15"]);
  // un solo cliente (el 13-15), la F260049 vinculada y las dos entradas conciliadas con ella (siguen en la 142)
  assert.deepStrictEqual([d142.holded_contact_id, d142.factura_vinculada, d142.cobrado_entradas, d142.entradas_sin_conciliar], [CONTACTO_ORAD, "inv49", 19415, 0]);
  assert.strictEqual(sim.j.despues.obras.find((o) => o.obra_id === "OO-2026-143").borrado, true);
  assert.deepStrictEqual(sim.j.despues.horas_registros["OO-2026-142"], { total: 179.5, periodo: 179.5 });
  console.log(`OK simulación · ${sim.j.n_cambios} celdas · ${sim.j.registros_reescritos.n} registros (${sim.j.registros_reescritos.horas} h) · avisos: ${sim.j.avisos.length}`);

  // ── Aplicar y repetir (idempotente) ──
  const ap = await post("/admin/migraciones/orad-montemayor?aplicar=1&usuario=test");
  assert.strictEqual(ap.status, 200, JSON.stringify(ap.j));
  assert.strictEqual(ap.j.simulacion, false);
  const otra = await post("/admin/migraciones/orad-montemayor?aplicar=1&usuario=test");
  assert.deepStrictEqual([otra.j.n_cambios, otra.j.n_filas_nuevas, otra.j.registros_reescritos.n], [0, 0, 0], JSON.stringify(otra.j.cambios));
  assert.strictEqual(hojas.registros_tiempo_historial.slice(1).filter((r) => r[2] === "editado").length, 14);   // 9 de Orad + 5 de tuberías
  assert.strictEqual(hojas.planificacion_obras[1][0], "OO-2026-142");
  assert.strictEqual(hojas.obras_otras.length, 4, "no se borra ninguna fila");

  // ── Prueba de aceptación ──
  // 1 · registros: ningún obra_id de texto; Orad 179,5 h en la orden única; tuberías 40 h en OO-2026-150
  const r1 = await get("/registros-tiempo?desde=2026-10-01&hasta=2026-10-15");
  const porObra = {};
  for (const r of r1.j.registros) porObra[r.obra_id] = (porObra[r.obra_id] || 0) + r.horas;
  assert.deepStrictEqual(porObra, { "OO-2026-142": 179.5, "OO-2026-150": 40 });
  assert.ok(r1.j.registros.every((r) => /^OO-/.test(r.obra_id)));
  assert.strictEqual(r1.j.registros.find((r) => r.obra_id === "OO-2026-142").obra_nombre, "CCPP Urbano Orad 13-15");
  const diag1 = await get("/registros-tiempo/diagnostico/obras");
  assert.deepStrictEqual([diag1.j.total_mal, diag1.j.obras.length], [0, 0], JSON.stringify(diag1.j.obras));

  // 2 · obras-otras: una sola Urbano Orad activa (35.300, 640 h, 5.000, cobrado 19.415); la 143 borrada (no sale)
  const r2 = await get("/obras-otras");
  const todas = Object.values(r2.j.grupos || {}).flat().concat(r2.j.obras || []);
  const orad = [...new Map(todas.filter((o) => /orad/i.test(o.nombre)).map((o) => [o.obra_id, o])).values()];
  assert.deepStrictEqual(orad.map((o) => [o.obra_id, o.nombre, Number(o.subtotal_eur), Number(o.horas_previstas), Number(o.material_previsto_eur), o.cobrado_eur + o.entradas_cuenta_eur]),
    [["OO-2026-142", "CCPP Urbano Orad 13-15", 35300, 640, 5000, 19415]]);
  assert.strictEqual(hojas.obras_otras[2][head("obras_otras").indexOf("borrado")], "TRUE");

  // 2b · el listado: la F260049 es un anticipo, la orden no queda «cobrada»; falta cobrar 19.415 € (sin contar dos veces)
  const l142 = orad[0];
  assert.deepStrictEqual([l142.factura_anticipo, l142.tiene_factura_emitida, l142.estado_cobro, l142.cobrado_eur, l142.entradas_cuenta_eur, l142.entradas_cuenta_total_eur, l142.pdte_facturar_eur],
    [true, false, "cobro_parcial", 19415, 0, 19415, 19415]);
  const pendienteMiPanel = Math.max(0, Number(l142.total_eur) - l142.cobrado_eur - l142.entradas_cuenta_eur);   // MiPanel › Pendiente de cobro
  assert.strictEqual(pendienteMiPanel, 19415);
  // la ficha: F260049 como factura de venta, cobrado 19.415 € (factura) + 0 (entradas conciliadas), no «cobrada»
  const f142 = await get("/obras-otras/OO-2026-142/economico");
  assert.deepStrictEqual([f142.j.facturas_venta.map((f) => f.numero), f142.j.facturado_eur, f142.j.cobrado_eur, f142.j.cobrado_manual_eur, f142.j.estado_cobro, f142.j.pdte_facturar_eur],
    [["F260049"], 19415, 19415, 0, "cobro_parcial", 19415]);
  // dinero (cartera de Planificación): pendiente 17.650 € sin IVA, no 0 ni 35.300
  const cart = require("./orden-cartera.cjs").carteraOO({ obras: [l142] }, "2026-10-15")[0];
  assert.strictEqual(cart.importe, 17650);

  // 3 · /ordenes-trabajo: ninguna orden de Otras órdenes en las fases de Plan 5
  const r3 = await get("/ordenes-trabajo");
  assert.strictEqual(r3.status, 200, JSON.stringify(r3.j));
  assert.ok(Object.values(r3.j.grupos).flat().every((o) => !/orad/i.test(o.comunidad) && !String(o.ccpp_id).includes("+")));

  // 4 · Mi panel oct-2026 (posición neta real): Urbano Orad en «Trabajo realizado» con 179,5 h × 35.300 / 640
  const r4 = await get("/holded/posicion-neta-real?año=2026&mes=10");
  assert.strictEqual(r4.status, 200, JSON.stringify(r4.j).slice(0, 500));
  const lista = r4.j.obras || r4.j.desglose_obras || r4.j.obras_desglose || [];
  const o4 = lista.find((o) => o.obra_id === "OO-2026-142");
  assert.ok(o4, `Orad en el desglose: ${JSON.stringify(Object.keys(r4.j))}`);
  assert.deepStrictEqual([o4.horas_mes, Math.round(o4.ingreso_mes)], [179.5, Math.round(179.5 * 35300 / 640)]);   // ≈ 9.900 €
  // con el criterio anterior (días × 16 h: 640 h ÷ (3 × 8) = 26,67 días → 426,72 h) habría salido ≈ 14.849 €
  const cambio4 = r4.j.cambio_horas_previstas.obras.find((o) => o.obra_id === "OO-2026-142");
  assert.deepStrictEqual([cambio4.antes.horas_previstas, Math.round(cambio4.antes.ingreso_mes), cambio4.despues.horas_previstas], [426.72, Math.round(35300 * 179.5 / 426.72), 640]);

  // el script de comparación (scripts/comparar-horas-previstas.cjs) da lo mismo que el endpoint
  const cmp = require("../scripts/comparar-horas-previstas.cjs").comparar(todas, r1.j.registros, ["2026-10"]).find((f) => f.obra_id === "OO-2026-142");
  assert.deepStrictEqual([cmp.hp_antes, cmp.hp_despues, cmp.ingreso_antes, cmp.ingreso_despues], [cambio4.antes.horas_previstas, 640, cambio4.antes.ingreso_mes, o4.ingreso_mes]);

  // 5 · tuberías: la ficha económica cuenta las 40 h (1.200 € a 30 €/h) y el material etiquetado; margen < 100 %
  const r5 = await get("/obras-otras/OO-2026-150/economico");
  assert.strictEqual(r5.status, 200, JSON.stringify(r5.j));
  const bv = r5.j.beneficio_vivo;
  assert.deepStrictEqual([bv.horas_reales, bv.coste_mano_obra_real, bv.coste_material_real], [40, 1200, 45]);
  assert.ok(bv.margen_pct < 100, `margen ${bv.margen_pct}`);
  assert.strictEqual(r5.j.obra_relacionada, ID_JM);

  // 6 · contadores: siguen sus 95 h y su material (474,81 €); a su lado, tuberías por separado
  const r6 = await get(`/holded/rentabilidad-obra/${ID_JM}`);
  assert.strictEqual(r6.status, 200, JSON.stringify(r6.j));
  assert.deepStrictEqual([r6.j.real.mano_obra_horas, Math.round(r6.j.real.material_real * 100) / 100], [95, 474.81]);
  assert.deepStrictEqual(r6.j.ordenes_relacionadas.map((o) => [o.obra_id, o.horas, o.presupuesto]), [["OO-2026-150", 40, 1920]]);

  // 7 · etiquetas: la fase de Jorge es la de su OT (13), no la de comunidades (09_TRAMITADA); tuberías con su etiqueta
  const r7 = await get("/holded/etiquetas");
  assert.strictEqual(r7.j.obras.find((o) => o.obra_id === ID_JM).fase, "13_EN_EJECUCION");
  assert.deepStrictEqual(hojas.holded_etiquetas.find((r) => r[0] === "OO-2026-150").slice(1, 2), ["jorgedemontemayor34tuberias"]);
  assert.deepStrictEqual(hojas.holded_etiquetas.find((r) => r[0] === "OO-2026-142")[1], "ot01432026ccppurbanoorad13|ot01442026ccppurbanoorad15");
  assert.strictEqual(hojas.holded_etiquetas.find((r) => r[0] === "OO-2026-143")[5], "FALSE");
  // rentabilidad de la orden única: las 179,5 h y el material de las dos etiquetas (100 + 56,47)
  const r8 = await get("/holded/rentabilidad-obra/OO-2026-142");
  assert.deepStrictEqual([r8.j.real.mano_obra_horas, Math.round(r8.j.real.material_real * 100) / 100, r8.j.previsto.pto_total], [179.5, 156.47, 35300]);

  // 8 · desde ahora: fichar con el nombre de una orden guarda su id; las antiguas, no
  const c1 = await post("/registros-tiempo", { fecha: "2026-10-15", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "CCPP Urbano Orad 13-15", horas: 8, usuario: "test" });
  assert.deepStrictEqual([c1.status, c1.j.registro?.obra_id], [201, "OO-2026-142"], JSON.stringify(c1.j));
  const c2 = await post("/registros-tiempo", { fecha: "2026-10-15", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "Urbano Orad 13-15", horas: 1, usuario: "test" });
  assert.deepStrictEqual([c2.status, c2.j.registro?.obra_id], [201, "OO-2026-142"]);   // el nombre de antes se reconoce como la misma orden
  const c3 = await post("/registros-tiempo", { fecha: "2026-10-15", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "OO-2026-143", horas: 1, usuario: "test" });
  assert.strictEqual(c3.status, 400);
  const c4 = await post("/registros-tiempo", { fecha: "2026-10-15", persona_id: "P-JUAN", tipo: "trabajo", obra_id: "Obra inventada 7", horas: 1, usuario: "test" });
  assert.strictEqual(c4.status, 400);
  // editar un registro sin tocar la obra no la estropea
  const e1 = await patch(`/registros-tiempo/${c1.j.registro.registro_id}`, { horas: 7, usuario: "test" });
  assert.deepStrictEqual([e1.status, e1.j.registro.obra_id], [200, "OO-2026-142"]);

  // sin la F260049 en Holded (o sin poder leer Holded): avisa y no vincula ni concilia nada
  {
    const h0 = JSON.parse(copia);
    const tabla = (n) => ({ head: (h0[n]?.[0] || []).map(String), filas: (h0[n] || []).slice(1) });
    const d0 = { obras: tabla("obras_otras"), entradas: tabla("obras_otras_entradas_cuenta"), extras: { head: [], filas: [] }, etiquetas: tabla("holded_etiquetas"), registros: tabla("registros_tiempo"), plan: tabla("planificacion_obras") };
    for (const facturas of [[], null]) {
      const p0 = MIG.planificar({ ...d0, facturas });
      assert.ok(p0.avisos.some((a) => /F260049/.test(a)), JSON.stringify(p0.avisos));
      assert.ok(!p0.cambios.some((c) => c.campos.conciliada_con_invoice_id || c.campos.holded_invoice_emitida_id));
    }
  }
  if (process.env.VER) console.log(JSON.stringify({ eco150: r5.j, pnr: { obras: lista.map((o) => [o.obra_id, o.horas_mes, o.ingreso_mes]), claves: Object.keys(r4.j) } }, null, 1));
  console.log("OK orad-una-orden.test · Orad una orden (179,5 h, 35.300 €, cobrado 19.415 €) · tuberías 40 h en OO-2026-150 · Plan 5 sin OO · Mi panel con Orad");
  srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
