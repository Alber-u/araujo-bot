// 08/10/2026 · Mi panel cae 34.000 €: mezclaba el extracto viejo de la rutina (05/10: T1 = 42.840) con T3 de hoy
// (JP17 y Palma, 37.140 €, ya cobradas y conciliadas el 08/10). Holded ya tiene los movimientos del 06-07/10.
//   · el extracto de la rutina, anterior a lo importado en el libro de la 572, no se usa: T1 se deduce con el libro
//   · la sincronización no es «06/10»: Holded ya tiene movimientos del 07/10 (no hay aviso rojo falso)
//   · aviso de los cobros posteriores a la foto; sin libro con que deducir, no hay valor (nunca una cifra falsa)
// Uso: node lib/extracto-coherente.test.cjs
const assert = require("assert");
const C = require("./dinero-empresa-calculo.cjs");
const T = require("./dinero-empresa-06-10.test.cjs");

const HOY = "2026-10-08", AHORA = "2026-10-08T16:53:00Z";
const ok = (data) => ({ ok: true, data });
const BANCO = 78292.11, EXTRACTO = 77260;   // el extracto real: 42.840 + movimientos del 06-07/10
const REF_H = 54587.16;                      // descuadre histórico (config del fixture)
const L = (r, id) => [...r.tengo, ...r.debo].find((l) => l.id === id);

function hoy() {
  const f = T.fuentes();
  // API pública de tesorería: el saldo del banco, sin lastSyncAt
  f.tesoreria = ok({ total_eur: BANCO, cuentas: [{ nombre: "Santander ES81", cuenta: "57200001", saldo: BANCO }, { nombre: "Santander 2", cuenta: "57200006", saldo: 0 }], pleo: { nombre: "Pleo", cuenta: null, saldo: 0 } });
  // la rutina subió el 06/10 el extracto del 05/10
  f.banco_sync = ok({ last_sync_at: "2026-10-06T12:18:40.000Z", saldo: 77360.96, saldo_extracto: 42840, ultimo_movimiento: "2026-10-05" });
  // el libro de la 572 ya tiene los movimientos del 06 y 07/10 (conciliados el 08/10)
  f.cuadre = ok({ saldo_banco: BANCO, saldo_movimientos: BANCO - (BANCO - EXTRACTO) + REF_H, ultimo_apunte: "2026-10-07" });
  // T3 de hoy: JP17 y Palma ya cobradas (con su cobro del 06/10)
  f.clientes.data.clientes = f.clientes.data.clientes.filter((c) => !/JUAN PABLOS|PALMA/.test(c.nombre));
  f.clientes.data.total = Math.round(f.clientes.data.clientes.reduce((t, c) => t + c.saldo, 0) * 100) / 100;
  f.invoices = ok(f.invoices.data.map((d) => (d.numero === "F260041" ? { ...d, pdte_cobro_eur: 0, estado_logico: "cobrada", cobros: [{ fecha: "2026-10-06", importe: 25939.20 }] }
    : d.numero === "F260053" ? { ...d, pdte_cobro_eur: 0, estado_logico: "cobrada", cobros: [{ fecha: "2026-10-06", importe: 11200.72 }] } : d)));
  return f;
}

const r = C.calcularEscalera(hoy(), HOY, AHORA, { pleo_manual: 743 });
// 1 · T1 con el libro (≈ 77.260), no con la foto vieja (42.840)
assert.strictEqual(L(r, "T1").importe, EXTRACTO);
assert.ok(/deducido/.test(L(r, "T1").extracto_fuente) && /anterior a lo importado/.test(L(r, "T1").extracto_fuente), L(r, "T1").extracto_fuente);
// 2 · sincronización: al menos el 07/10 (lo importado), sin el rojo «sin sincronizar desde 06/10»
assert.strictEqual(r.frescura.banco_ultima_sincronizacion, "2026-10-07");
assert.ok(!r.avisos.some((a) => /Banco sin sincronizar/.test(a.texto)), JSON.stringify(r.avisos.map((a) => a.texto)));
// 3 · avisos: la foto vieja y los cobros posteriores (37.139,92 € de F260041 y F260053)
assert.ok(r.avisos.some((a) => a.tipo === "extracto_viejo" && /05\/10/.test(a.texto) && /07\/10/.test(a.texto)));
const cp = r.avisos.find((a) => a.tipo === "cobro_posterior_foto");
assert.ok(cp && /F260041/.test(cp.texto) && /F260053/.test(cp.texto), cp && cp.texto);
// 4 · el valor: lo de antes + la remesa que faltaba, nunca −26.000 (34.420 más que con la foto vieja)
const conFotoVieja = (() => { const f = hoy(); f.cuadre = ok({ ...f.cuadre.data, ultimo_apunte: "2026-10-05" }); return C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 }); })();
assert.strictEqual(L(conFotoVieja, "T1").importe, 42840);   // (sin movimientos nuevos en el libro, la foto sigue valiendo)
assert.strictEqual(Math.round((r.kpis.valor_real.normal - conFotoVieja.kpis.valor_real.normal) * 100) / 100, EXTRACTO - 42840);
// 5 · foto vieja y sin libro: no hay valor, aviso rojo «pulsa Recalcular»
{
  const f = hoy(); f.cuadre = { ok: false, error: "ledger caído" };
  // sin libro no se sabe que la foto es vieja: solo con la señal del libro se descarta (aquí, la de la rutina manda)
  assert.strictEqual(L(C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 }), "T1").importe, 42840);
}
{
  const f = hoy(); f.cuadre = ok({ saldo_banco: BANCO, saldo_movimientos: null, ultimo_apunte: "2026-10-07" });
  const x = C.calcularEscalera(f, HOY, AHORA, { pleo_manual: 743 });
  assert.deepStrictEqual([x.kpis.valor_real.normal, x.kpis.valor_real.prudente, x.kpis.extracto_desactualizado, x.kpis.dinero_empresa_antes_is, x.kpis.dinero_empresa_prudente], [null, null, true, null, null]);
  assert.ok(x.avisos.some((a) => a.nivel === "rojo" && a.tipo === "extracto_desactualizado" && /Recalcular/.test(a.texto)));
}
// 6 · cobrosPosteriores: solo después de la foto y hasta hoy
assert.deepStrictEqual(C.cobrosPosteriores(ok([{ numero: "A", cobros: [{ fecha: "2026-10-05", importe: 10 }, { fecha: "2026-10-06", importe: 5 }] }, { numero: "B", cobros: [{ fecha: "2026-10-09", importe: 7 }] }]), "2026-10-05", HOY), { total: 5, facturas: ["A"] });
console.log(`OK extracto-coherente.test · T1 ${L(r, "T1").importe} (antes 42.840) · valor normal ${r.kpis.valor_real.normal} · con la foto vieja daba ${conFotoVieja.kpis.valor_real.normal}`);
