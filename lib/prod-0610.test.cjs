// 06/10/2026 · fallos vistos en producción con 540a3f2d. Uso: node lib/prod-0610.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const J = require("./jornada.cjs");
const H = require("./custodia-holded.cjs");
const { estadosExpedientes } = require("./expediente-estado.cjs");

const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const cfDe = (obras, hoy, cuadrillas) => ({ hoy, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas, desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

// 1 · Orad: el tramo se guardó con un id y la obra sale con otro (orden de sus OO o una sola viva)
{
  const quienes = [["Juan", "Luis", "Mario"], ["Manuel", "Cristhian"]];
  const orad = (id) => ({ obra_id: id, nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" });
  const tramo = (id) => ({ obra_id: id, desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-05T09:00:00Z" });
  for (const [guardado, ahora] of [["OO-2026-143+OO-2026-142", "OO-2026-142+OO-2026-143"], ["OO-2026-142+OO-2026-143", "OO-2026-142"], ["OO-2026-142", "OO-2026-142+OO-2026-143"]]) {
    const obras = O.aplicarPlanificacion([orad(ahora)], [tramo(guardado)]);
    const r = P.calendarioPlan({ cf: cfDe(obras, "2026-10-05", [3, 2]), hoy: "2026-10-05", festivos: fest, jornada, nombresCuadrillas: quienes });
    const u = por(r, "Urbano");
    assert.deepStrictEqual([u.tramos_texto, u.fin], ["05–09/10: 3 pers. · desde 13/10: 5 pers.", "2026-10-29"], `${guardado} → ${ahora}`);
  }
  // dos filas (una con cada id): los tramos de las dos
  const obras = O.aplicarPlanificacion([orad("OO-2026-142+OO-2026-143")], [tramo("OO-2026-143+OO-2026-142"), { ...tramo("OO-2026-142"), desde: "2026-10-20", operarios: "Juan, Luis, Mario", fecha: "2026-10-06T09:00:00Z" }]);
  assert.deepStrictEqual(obras[0].tramos.map((t) => [t.desde, t.operarios.length]), [["2026-10-13", 5], ["2026-10-20", 3]]);
}

// 2 · ritmo de Montemayor: su inicio es el 05/10 pero lo fichado viene de antes; los días sin fichajes, 0 h
{
  const quienes = [["Manuel", "Cristhian"], ["Juan", "Luis", "Mario"]];
  const jm = { obra_id: "jm", nombre: "Jorge de Montemayor 34", fase: "09_TRAMITADA", importe: 7058, horas_previstas: 109, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, empezada: "2026-10-05" };
  const regs = (dias) => dias.flatMap((d) => ["Manuel", "Cristhian"].map((p) => ({ fecha: d, persona: p, obra: "Jorge de Montemayor 34", horas: 36 / dias.length / 2 })));
  const calc = (r, hoy = "2026-10-06") => por(P.calendarioPlan({ cf: cfDe([jm], hoy, [2, 3]), hoy, festivos: fest, jornada, nombresCuadrillas: quienes, registros: r }), "Jorge").ritmo;
  assert.deepStrictEqual(calc(regs(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05"])), { horas: 36, dias: 5, desde: "2026-09-29", h_dia: 7.2, fin: "2026-10-21" });
  // todo fichado en dos días: 36 h ÷ 5 días laborables (desde el 29/09), no ÷ 2
  assert.strictEqual(calc(regs(["2026-09-29", "2026-10-02"])).h_dia, 7.2);
  // empezó ayer (05/10) sin nada antes: 1 día
  assert.strictEqual(calc(regs(["2026-10-05"])).dias, 1);
}

// 3 · cuenta 56100026 «Custodia Plan Cinco - Rafael Laffon 7»: obra por el nombre, aunque la comunidad
// esté dos veces en la hoja (se queda la de la cartera) o se llame «C/ Rafael Laffón, 7»
{
  const filas = [["Rafael Laffón 7", "C/ Rafael Laffón, 7"], ["RAFAEL LAFFON Nº 7", ""]];
  const idBueno = O.ccppId("C/ Rafael Laffón, 7");
  const c = { cuenta: 56100026, comunidad: "Custodia Plan Cinco - Rafael Laffon 7", ccpp_id: null };
  assert.strictEqual(H.asignarObras([c], filas, O.ccppId)[0].ccpp_id, null);                          // dos ids: no se adivina
  assert.strictEqual(H.asignarObras([c], filas, O.ccppId, new Set([idBueno]))[0].ccpp_id, idBueno);   // la de la cartera
  // y el aviso de Sabadell la encuentra por el nombre aunque no traiga id
  assert.strictEqual(H.custodiaDe(H.indexarCustodias([c]), { comunidad: "Rafael Laffón 7" }), c);
}

// 4 · 0DCHA de Rafael Laffón 7: financiado por Sabadell (1.489,51 €, abonado el 06/08) aunque su pago esté
// vacío o no esté en la hoja de pisos, y con la comunidad escrita de otra forma en financiaciones_sabadell
{
  const cabCom = ["comunidad", "direccion", "fase_presupuesto", "pto_total", "est_ccpp_contrato", "est_ccpp_pago"];
  const cabPis = ["telefono", "comunidad", "vivienda", "est_piso_meses_financiar", "est_piso_contrato", "est_piso_pago"];
  const com = [cabCom, ["Rafael Laffón 7", "C/ Rafael Laffón, 7", "09_TRAMITADA", 8981, "", ""]];
  const id = O.ccppId("C/ Rafael Laffón, 7");
  const fin = (pisos, comSab) => estadosExpedientes({ comunidades: com, pisos: [cabPis, ...pisos], docs: { piso: [], ccpp: [] },
    sabadell: [["op", "piso", comSab, "0DCHA", "", "1489,51", "2026-08-06"]] })[id].pagos.financiados;
  const esperado = [["0DCHA", true, 1489.51, "2026-08-06"]];
  const ver = (f) => f.map((x) => [x.vivienda, x.abonado, x.importe, x.fecha_abono]);
  assert.deepStrictEqual(ver(fin([["600", "C/ Rafael Laffón, 7", "0DCHA", "", "OK", ""], ["600", "C/ Rafael Laffón, 7", "1A", "", "OK", "OK"]], "CCPP RAFAEL LAFFON 7")), esperado);
  assert.deepStrictEqual(ver(fin([["600", "C/ Rafael Laffón, 7", "1A", "", "OK", "OK"]], "Rafael Laffón 7")), esperado);   // no está en pisos
  assert.deepStrictEqual(ver(fin([["600", "C/ Rafael Laffón, 7", "0DCHA", "", "OK", "OK"]], id)), esperado);               // por el id
}
console.log("OK prod-0610.test · Orad con su tramo · ritmo por días laborables · 5610 de Laffón · 0DCHA financiado");
