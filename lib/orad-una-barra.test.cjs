// 05/10/2026 · Cambiar personas en una obra privada en marcha sin programar (Urbano Orad, 640 h, 0 fichadas):
// el tramo de 5 personas desde el 13/10 cuenta (antes se colocaba con las de su cuadrilla y las dos barras
// acababan el 12/11); las obras de la cuadrilla prestada van detrás; vista previa = guardado = cash flow.
// Y las cuentas 5610 / financiaciones_sabadell se cruzan sin tildes ni mayúsculas (Rafael Laffón 7).
// Uso: node lib/orad-una-barra.test.cjs
const assert = require("assert");
const P = require("./planificacion-calendario.cjs");
const O = require("./orden-cartera.cjs");
const S = require("./simulador-caja.cjs");
const J = require("./jornada.cjs");
const H = require("./custodia-holded.cjs");
const { estadosExpedientes } = require("./expediente-estado.cjs");

const fest = { lista: ["2026-10-12", "2026-11-02"], fuente: "config_dinero", errores: [] };
const jornada = J.leerJornada({ horas_dia: "8" });
const quienes = [["Juan", "Luis", "Mario"], ["Manuel", "Cristhian"]];   // Orad es de la Cuadrilla 1 (3)
const ob = (obra_id, nombre, h, extra = {}) => ({ obra_id, nombre, fase: "09_TRAMITADA", importe: 7000, horas_previstas: h, horas_registradas: 0, material_previsto: 1500, faltan_docs: 0, total_docs: 2, ...extra });
const obras0 = [
  { obra_id: "orad", nombre: "Urbano Orad 13-15", fase: "09_OO", tipo: "OO", importe: 35300, importe_total: 35300, horas_previstas: 640, horas_registradas: 0, mes_cobro: 1, sin_comision: true, oo_en_ejecucion: true, inicio_hoja: "2026-10-05" },
  ob("rl", "Rafael Laffón 7", 160, { orden: 1, pasos: 0 }), ob("lp", "La Paz 29", 192, { orden: 2, pasos: 0 }), ob("mj", "Mijares 3", 102, { orden: 3, pasos: 0 }),
];
const tramo = { obra_id: "orad", desde: "2026-10-13", operarios: "Juan, Luis, Mario, Manuel, Cristhian", nota: "juntas", usuario: "Alberto", fecha: "2026-10-05T09:00:00Z" };
const cfDe = (obras, hoy) => ({ hoy, inicial: { propio: 0, custodia_y_senales: 0 }, semanas: [], meses: [], recurrentes_movs: [],
  simulador: { ok: true, obras, historico: { fijos: { operarios: 12734, indirectos: 2066, generales: 3057 }, comision_pct: 0.2, personas_base: 5 } },
  automatico: { mandos: { personas: 5, hpp: 152, cuadrillas: [3, 2], desvio: 0, mat: 27, tram: 1, grande: 300 } } });
const args = (hoy, obras) => ({ cf: cfDe(obras, hoy), hoy, festivos: fest, jornada, nombresCuadrillas: quienes });
const por = (r, n) => r.obras.find((o) => o.nombre.startsWith(n));

// 1 · hoy 05/10: 5 días × 3 × 8 = 120 h antes del tramo; 520 h ÷ (5 × 8) = 13 días desde el 13/10 → 29/10
{
  const obras = O.aplicarPlanificacion(obras0, [tramo]);
  const r = P.calendarioPlan(args("2026-10-05", obras));
  const u = por(r, "Urbano");
  assert.deepStrictEqual([u.equipo, u.fin, u.equipos_extra, u.junta_desde], [1, "2026-10-29", [2], { 2: "2026-10-13" }]);
  // una obra = una barra: solo una fila de Orad; la cuadrilla prestada (2) no tiene otra obra hasta el 29/10
  assert.strictEqual(r.obras.filter((o) => o.obra_id === "orad").length, 1);
  for (const o of r.obras.filter((x) => x.equipo === 2)) assert.ok(o.inicio > u.fin || o.fin < "2026-10-13", `${o.nombre} ${o.inicio}`);
  // vista previa (borrador sin guardar) = guardado = cash flow
  const previa = P.calendarioPlan({ ...args("2026-10-05", obras0), borrador: { obra_id: "orad", desde: "2026-10-13", operarios: tramo.operarios.split(", ") } });
  assert.strictEqual(por(previa, "Urbano").fin, "2026-10-29");
  assert.strictEqual(P.fechasPlan(args("2026-10-05", obras)).orad.fin, "2026-10-29");
  assert.ok(S.aplicarCambioPlan(obras0, { obra_id: "orad", desde: "2026-10-13", operarios: ["A"] })[0].tramos.length === 1);
}
// 2 · sin fichar esta semana (hoy jueves 08/10): 2 días × 24 h = 48 h; 592 h ÷ 40 = 14,8 días → 03/11 (02/11 festivo)
{
  const r = P.calendarioPlan(args("2026-10-08", O.aplicarPlanificacion(obras0, [tramo])));
  assert.strictEqual(por(r, "Urbano").fin, "2026-11-03");
}

// 3 · cuentas 5610: «Rafael Laffon 7» (sin tilde) es la obra de «Rafael Laffón 7»
{
  const filas = [["Rafael Laffón 7", "Calle Rafael Laffón 7"], ["Rafael Laffón 9", ""], ["Tordo 18", "Calle Tordo 18"]];
  const [c] = H.asignarObras([{ cuenta: 56100026, comunidad: "Rafael Laffon 7", ccpp_id: null }], filas, O.ccppId);
  assert.strictEqual(c.ccpp_id, O.ccppId("Calle Rafael Laffón 7"));
  // si encajan dos, ninguna (no se adivina)
  assert.strictEqual(H.asignarObras([{ comunidad: "Laffon", ccpp_id: null }], filas, O.ccppId)[0].ccpp_id, null);
}

// 4 · 0DCHA de Rafael Laffón 7: piso «OK» pero financiado y abonado por Sabadell (financiaciones_sabadell
// «CCPP RAFAEL LAFFON 7», «0 DCHA»): cuenta como financiado, no «Sin financiación»
{
  const cabCom = ["comunidad", "direccion", "fase_presupuesto", "pto_total", "est_ccpp_contrato", "est_ccpp_pago"];
  const cabPis = ["telefono", "comunidad", "vivienda", "est_piso_meses_financiar", "est_piso_contrato", "est_piso_pago"];
  const e = estadosExpedientes({ comunidades: [cabCom, ["Rafael Laffón 7", "Calle Rafael Laffón 7", "09_TRAMITADA", 8981, "", ""]],
    pisos: [cabPis, ["600", "Calle Rafael Laffón 7", "0DCHA", "", "OK", "OK"], ["600", "Calle Rafael Laffón 7", "1A", "", "OK", "OK"]], docs: { piso: [], ccpp: [] },
    sabadell: [["op", "piso", "CCPP RAFAEL LAFFON 7", "0 DCHA", "", "1650", "2026-09-20"]] })[O.ccppId("Calle Rafael Laffón 7")];
  assert.deepStrictEqual(e.pagos.financiados.map((f) => [f.vivienda, f.abonado, f.importe]), [["0DCHA", true, 1650]]);
  assert.deepStrictEqual([e.pagos.pagados, e.pagos.resueltos, e.sabadell.abonado_eur], [1, 2, 1650]);
  const lista = P.estadoLista({ obra_id: "rl", nombre: "Rafael Laffón 7" }, 9, e, null, true);
  assert.ok(!/Sin financiación/.test(lista.financiacion?.texto || ""), lista.financiacion?.texto);
  assert.ok(/1 piso financiado: Sabadell ya ha abonado/.test(lista.financiacion.texto), lista.financiacion.texto);
}
console.log("OK orad-una-barra.test · Orad 29/10 (03/11 sin fichar esta semana) · Laffón 5610 y 0DCHA");
