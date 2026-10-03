// ============================================================
// lib/conciliacion-provisional.cjs — movimientos del banco sin conciliar
// casados (de forma PROVISIONAL, sin tocar Holded) con lo pendiente.
// ============================================================
// Encargo del 03/10/2026: T1 (banco) es el saldo real, pero las deudas y los
// cobros salen de la contabilidad, que solo se mueve al conciliar. Un pago
// sin conciliar cuenta dos veces (ya salió del banco y la deuda sigue viva);
// un cobro sin conciliar, también (ya entró y la factura sigue pendiente).
// Aquí se casa cada movimiento sin conciliar con su pendiente y se dice
// cuánto hay que quitar de cada línea de la escalera (D7, D8, D3, D6, T3).
//
// Cálculo PURO (sin red). Reglas, por orden; el primero que casa gana. Un
// movimiento casa con UN pendiente (o varios del mismo trabajador/cliente) y
// un pendiente puede recibir varios movimientos:
//   R8 par ida/vuelta (mismo importe exacto, ≤ 10 días) → se anulan. Se mira
//      PRIMERO: un recibo devuelto no paga nada.
//   R2 salida a nombre de Alberto → no se casa (pendiente de Eplus)
//   ·  embargos de la AEAT («NOTIFICACIONES SIR») → no se casan
//   ·  traspaso a Pleo («Pleo Financial Services», «Recarga Pleo») → sin
//      ajuste: el dinero sigue siendo de la empresa (va a la tarjeta)
//   R1 salida «NOMINA» + nombre del trabajador → sus nóminas pendientes (D7)
//   R3 salida TGSS / SEGURIDAD SOCIAL → recibo pendiente (D8), ± 5 %
//   R4 salida AEAT / IMPUESTO → plazo de /obligaciones ± 5 días, ± 0,05 € (D3)
//   R5 salida = pendiente de una compra (D6), ± 0,01 €
//   R6 entrada = pendiente de una factura o suma de 2-40 del mismo cliente (T3)
//   R7 entrada de custodia (Plan Cinco / vecinos) → sin efecto (banco y D1 suben igual)
//   R9 resto → sin ajuste («en el banco sin documento»)
// Si un movimiento casa con varios pendientes por la misma regla: no se
// ajusta y aviso. Nunca se quita de una línea más de lo que tiene.
// ============================================================
"use strict";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sinAcentos = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (x) => sinAcentos(x).toUpperCase();
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const mesAnterior = (am) => { const [y, m] = am.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

// Palabras de un nombre propio (sin las de relleno de un concepto bancario)
const RELLENO = new Set(["TRANSFERENCIA", "TRANSF", "CONCEPTO", "NOMINA", "NOMINAS", "PAGO", "SUELDO", "SALARIO", "DE", "DEL", "LA", "LAS", "LOS", "EL",
  "Y", "A", "EN", "POR", "PARA", "CON", "SL", "SA", "SLU", "REMUNERACIONES", "MES", "FAVOR", "ORDENANTE", "BENEFICIARIO", "INMEDIATA", ...MESES]);
const palabras = (x) => norm(x).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !RELLENO.has(w) && !/^\d+$/.test(w));

// Mes que dice el concepto («Nomina Septiembre» → AAAA-09, con el año del movimiento)
function mesDelConcepto(desc, fecha) {
  const d = norm(desc);
  const i = MESES.findIndex((m) => d.includes(m) || (m === "SEPTIEMBRE" && d.includes("SETIEMBRE")));
  if (i < 0) return null;
  const [y, m] = fecha.split("-").map(Number);
  const anio = i + 1 > m + 1 ? y - 1 : y;            // «Nomina Diciembre» pagada en enero
  return `${anio}-${String(i + 1).padStart(2, "0")}`;
}

// Alberto (R2): su nómina está pendiente de Eplus. Mismos tokens que
// NOMINA_INDIRECTOS de ara-os-holded.cjs.
const TOKENS_ALBERTO = ["ARAUJO", "PUERTA"];
const esAlberto = (desc) => { const p = new Set(palabras(desc)); return TOKENS_ALBERTO.every((t) => p.has(t)); };
const RE_SIR = /NOTIFICACIONES\s+SIR/;
const RE_TGSS = /TGSS|T\.G\.S\.S|SEGURIDAD\s+SOCIAL/;
const RE_AEAT = /A\.?\s?E\.?\s?A\.?\s?T|\bAEAT\b|IMPUESTO/;
const RE_CUSTODIA = /PLAN\s*(5|CINCO)|CUSTODIA|VECIN/;
const RE_PLEO = /PLEO\s+FINANCIAL\s+SERVICES|RECARGA\s+PLEO/;

// Subconjunto de facturas de un cliente que suma `objetivo` (céntimos), 2-40
// facturas: todas, o un tramo seguido por fecha (las remesas pagan facturas
// consecutivas). Sin búsqueda exhaustiva: lo dudoso no se casa.
function remesa(facturas, objetivo) {
  const xs = facturas.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const c = xs.map((f) => Math.round(f.pendiente * 100));
  const hallados = [];
  for (let i = 0; i < xs.length; i++) {
    let s = 0;
    for (let j = i; j < xs.length && j - i < 40; j++) {
      s += c[j];
      if (j > i && Math.abs(s - objetivo) <= (j - i + 1)) hallados.push(xs.slice(i, j + 1));
      if (s > objetivo + 40) break;
    }
  }
  return hallados;
}

// foto: { generado, movimientos: [{ id, date, amount, description, pendingToReconcile }] }
// ctx: {
//   hoy, lineas: { D7, D8, D3, D6, T3 } (importes actuales o null),
//   nominas: [{ nombre, periodo, importe|null }]  — nóminas pendientes por persona
//   recibo_tgss: { importe, vence } | null
//   plazos_aeat: [{ fecha, importe, concepto }]
//   compras: [{ num, proveedor, pendiente, fecha }]
//   facturas: [{ numero, cliente, pendiente, fecha, mas90 }]
// }
function casarMovimientos(foto, ctx) {
  const hoy = ctx.hoy;
  const movs = (foto?.movimientos || [])
    .map((m) => ({ id: m.id, fecha: String(m.date || "").slice(0, 10), importe: r2(m.pendingToReconcile), amount: r2(m.amount), desc: String(m.description || "") }))
    .filter((m) => Math.abs(m.importe) > 0.005 && m.fecha);
  const queda = {};                                   // lo que aún se puede quitar de cada línea
  for (const [k, v] of Object.entries(ctx.lineas || {})) queda[k] = v == null ? null : Math.max(0, r2(v));
  const ajustes = { D7: 0, D8: 0, D3: 0, D6: 0, T3: 0, T3_mas90: 0 };
  const detalle = [], sinCasar = [], sinDocumento = [], anulados = [], ambiguos = [], traspasos = [];
  const hecho = new Set();

  const nominas = (ctx.nominas || []).map((n) => ({ ...n, tokens: palabras(n.nombre), resto: n.importe == null ? null : r2(n.importe) }));
  const plazos = (ctx.plazos_aeat || []).map((p) => ({ ...p, usado: false }));
  const compras = (ctx.compras || []).map((c) => ({ ...c, resto: r2(c.pendiente) }));
  const facturas = (ctx.facturas || []).map((f) => ({ ...f, resto: r2(f.pendiente) }));
  let tgssResto = ctx.recibo_tgss ? r2(ctx.recibo_tgss.importe) : 0;

  const aplicar = (m, regla, linea, importe, casado, extra = {}) => {
    const tope = queda[linea];
    if (tope == null) { sinCasar.push({ ...m, regla, nota: `casa con ${casado}, pero ${linea} está sin dato` }); return; }
    const aj = r2(Math.min(importe, tope));
    queda[linea] = r2(tope - aj);
    ajustes[linea] = r2(ajustes[linea] + aj);
    if (extra.mas90) ajustes.T3_mas90 = r2(ajustes.T3_mas90 + aj);
    detalle.push({ id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.desc.slice(0, 90), regla, linea, casado, ajuste: aj, ...(extra.ref ? { ref: extra.ref } : {}),
      ...(aj < importe ? { nota: `${linea} solo tenía ${r2(tope)} € pendientes` } : {}) });
  };

  // R8 · pares ida/vuelta
  for (const a of movs) {
    if (hecho.has(a) || a.importe >= 0) continue;
    const b = movs.find((x) => !hecho.has(x) && x !== a && x.importe > 0 && Math.abs(x.importe + a.importe) <= 0.005 && Math.abs(dias(x.fecha, a.fecha)) <= 10);
    if (b) { hecho.add(a); hecho.add(b); anulados.push({ ida: { fecha: a.fecha, importe: a.importe, concepto: a.desc.slice(0, 60) }, vuelta: { fecha: b.fecha, importe: b.importe, concepto: b.desc.slice(0, 60) } }); }
  }

  for (const m of movs) {
    if (hecho.has(m)) continue;
    hecho.add(m);
    const d = norm(m.desc), sale = -m.importe;
    if (m.importe < 0) {
      // R2 · Alberto
      if (esAlberto(m.desc)) { sinCasar.push({ ...m, regla: "R2", nota: "Nómina de Alberto: pendiente de Eplus, no se casa." }); continue; }
      if (RE_SIR.test(d)) { sinCasar.push({ ...m, regla: "SIR", nota: "Embargo de la AEAT (notificaciones SIR): no se casa automáticamente." }); continue; }
      if (RE_PLEO.test(d)) { traspasos.push({ id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.desc.slice(0, 90), nota: "Traspaso a Pleo: sin ajuste" }); continue; }
      // R1 · nóminas
      if (/NOMINA/.test(d)) {
        const pm = new Set(palabras(m.desc));
        const mesC = mesDelConcepto(m.desc, m.fecha);
        const periodos = mesC ? [mesC, mesAnterior(mesC)] : null;
        const cand = nominas.filter((n) => (!periodos || periodos.includes(n.periodo)) && (n.resto == null || n.resto > 0.005))
          .map((n) => { const comunes = n.tokens.filter((t) => pm.has(t)); return { n, score: comunes.length, clave: [...new Set(comunes)].sort().join(" ") }; })
          .filter((x) => x.score >= 2);
        if (cand.length) {
          const max = Math.max(...cand.map((x) => x.score));
          const top = cand.filter((x) => x.score === max);
          // La persona es el nombre que coincide, no todo el texto del apunte
          // («… Cristhian Arturo (atrasos)» es la misma persona).
          const personas = new Set(top.map((x) => x.clave));
          if (personas.size > 1) { ambiguos.push({ ...m, regla: "R1", candidatos: [...personas] }); continue; }
          const suyas = top.map((x) => x.n);
          const conImporte = suyas.every((n) => n.resto != null);
          const suma = conImporte ? r2(suyas.reduce((s, n) => s + n.resto, 0)) : null;
          if (conImporte && suma < sale - 1) { sinCasar.push({ ...m, regla: "R1", nota: `Sus nóminas pendientes (${suma} €) no llegan al importe` }); continue; }
          let falta = conImporte ? Math.min(sale, suma) : sale;
          if (conImporte) for (const n of suyas) { const q = Math.min(n.resto, falta); n.resto = r2(n.resto - q); falta = r2(falta - q); }
          aplicar(m, "R1", "D7", conImporte ? Math.min(sale, suma) : sale, `nómina ${suyas[0].periodo} de ${suyas[0].nombre}${suyas.length > 1 ? ` (${suyas.length} nóminas)` : ""}`, { ref: { periodo: suyas[0].periodo } });
          continue;
        }
      }
      // R3 · TGSS
      if (RE_TGSS.test(d) && tgssResto > 0 && Math.abs(sale - ctx.recibo_tgss.importe) <= ctx.recibo_tgss.importe * 0.05
          && (!ctx.recibo_tgss.vence || Math.abs(dias(m.fecha, ctx.recibo_tgss.vence)) <= 45)) {
        tgssResto = 0;
        aplicar(m, "R3", "D8", sale, "recibo de la TGSS pendiente", { ref: { tgss: true } });
        continue;
      }
      // R4 · plazos AEAT
      if (RE_AEAT.test(d)) {
        const ps = plazos.filter((p) => !p.usado && Math.abs(p.importe - sale) <= 0.05 && Math.abs(dias(m.fecha, p.fecha)) <= 5);
        if (ps.length > 1) { ambiguos.push({ ...m, regla: "R4", candidatos: ps.map((p) => `${p.concepto} ${p.fecha}`) }); continue; }
        if (ps.length === 1) { ps[0].usado = true; aplicar(m, "R4", "D3", sale, `plazo ${ps[0].fecha} · ${ps[0].concepto}`, { ref: { plazo: { fecha: ps[0].fecha, importe: ps[0].importe } } }); continue; }
      }
      // R5 · compras
      {
        let cs = compras.filter((c) => c.resto > 0.005 && Math.abs(c.resto - sale) <= 0.01 && c.fecha
          && dias(c.fecha, m.fecha) <= 5 && dias(c.fecha, m.fecha) >= -60);
        const conNombre = cs.filter((c) => palabras(c.proveedor).some((t) => t.length >= 4 && d.includes(t)));
        if (conNombre.length) cs = conNombre;
        else cs = cs.filter((c) => !compras.some((o) => o !== c && palabras(o.proveedor).some((t) => t.length >= 4 && d.includes(t))));
        if (cs.length > 1) { ambiguos.push({ ...m, regla: "R5", candidatos: cs.map((c) => `${c.proveedor} ${c.num}`) }); continue; }
        if (cs.length === 1) { cs[0].resto = 0; aplicar(m, "R5", "D6", sale, `compra ${cs[0].num} · ${cs[0].proveedor}`, { ref: { compras: [cs[0].num] } }); continue; }
      }
    } else {
      // R6 · cobros de facturas
      const ent = m.importe;
      const una = facturas.filter((f) => f.resto > 0.005 && Math.abs(f.resto - ent) <= 0.01 && (!f.fecha || f.fecha <= m.fecha));
      if (una.length > 1) { ambiguos.push({ ...m, regla: "R6", candidatos: una.map((f) => `${f.numero} ${f.cliente}`) }); continue; }
      if (una.length === 1) {
        una[0].resto = 0;
        aplicar(m, "R6", "T3", ent, `factura ${una[0].numero} · ${una[0].cliente}`, { mas90: una[0].mas90, ref: { facturas: [una[0].numero] } });
        continue;
      }
      const porCliente = {};
      for (const f of facturas) if (f.resto > 0.005 && (!f.fecha || f.fecha <= m.fecha)) (porCliente[f.cliente] = porCliente[f.cliente] || []).push(f);
      const hall = Object.entries(porCliente).flatMap(([cli, fs]) => remesa(fs, Math.round(ent * 100)).map((set) => ({ cli, set })));
      if (hall.length > 1) { ambiguos.push({ ...m, regla: "R6", candidatos: hall.map((h) => `${h.cli}: ${h.set.length} facturas`) }); continue; }
      if (hall.length === 1) {
        const { cli, set } = hall[0];
        for (const f of set) f.resto = 0;
        const mas90 = r2(set.filter((f) => f.mas90).reduce((s, f) => s + f.pendiente, 0));
        const tope = queda.T3;
        aplicar(m, "R6", "T3", ent, `remesa de ${set.length} facturas de ${cli} (${set[0].numero} … ${set[set.length - 1].numero})`, { ref: { facturas: set.map((f) => f.numero) } });
        if (tope != null) ajustes.T3_mas90 = r2(ajustes.T3_mas90 + Math.min(mas90, ent));
        continue;
      }
      // R7 · custodia de vecinos
      if (RE_CUSTODIA.test(d)) { detalle.push({ id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.desc.slice(0, 90), regla: "R7", linea: null, casado: "custodia (banco y D1 suben igual)", ajuste: 0 }); continue; }
    }
    // R9 · sin documento
    sinDocumento.push({ id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.desc.slice(0, 90) });
  }

  const desfase = r2(movs.reduce((s, m) => s + m.importe, 0));
  const ajusteDebo = r2(ajustes.D7 + ajustes.D8 + ajustes.D3 + ajustes.D6);
  // Movimientos que casan con un pendiente y llevan más de 7 días sin conciliar
  const viejos = detalle.filter((x) => x.linea && hoy && dias(hoy, x.fecha) > 7);
  return {
    desfase_conciliacion: desfase,
    n_movimientos: movs.length,
    ajustes,
    ajuste_valor: r2(ajusteDebo - ajustes.T3),          // lo que sube (o baja) el valor de la empresa
    ajustado_total: r2(ajusteDebo + ajustes.T3),
    detalle, sin_casar: sinCasar, sin_documento: sinDocumento,
    sin_documento_total: r2(sinDocumento.reduce((s, x) => s + x.importe, 0)),
    anulados, ambiguos, traspasos, traspasos_total: r2(traspasos.reduce((s, x) => s + x.importe, 0)),
    casados_mas_7_dias: viejos.length,
  };
}

// Nóminas pendientes POR PERSONA a partir de los apuntes de la 465: cada
// devengo (haber) con nombre de trabajador (≥ 2 palabras) menos los pagos
// (debe) del mismo trabajador, del más antiguo al más nuevo. Si la 465 no
// lleva nombres (asiento de nóminas en bloque), se usan los nombres de la
// nómina importada (hoja nominas_mes) sin importe: el ajuste queda limitado
// por lo que tenga D7.
//   apuntes: [{ fecha, descripcion, debe, haber }]
//   nombresNomina: { "AAAA-MM": ["APELLIDOS NOMBRE", …] }
function nominasPendientes(apuntes, nombresNomina = {}, meses = []) {
  const devengos = [], pagos = [];
  for (const a of apuntes || []) {
    const tokens = palabras(a.descripcion);
    if (tokens.length < 2) continue;
    const periodo = mesDelConcepto(a.descripcion, a.fecha) || a.fecha.slice(0, 7);
    if (a.haber > 0) devengos.push({ nombre: tokens.join(" "), tokens, periodo, fecha: a.fecha, resto: r2(a.haber) });
    else if (a.debe > 0) pagos.push({ tokens, fecha: a.fecha, importe: r2(a.debe) });
  }
  devengos.sort((x, y) => x.fecha.localeCompare(y.fecha));
  for (const p of pagos) {
    let falta = p.importe;
    for (const d of devengos) {
      if (falta <= 0.005) break;
      if (d.resto <= 0.005 || d.tokens.filter((t) => p.tokens.includes(t)).length < 2) continue;
      const q = Math.min(d.resto, falta);
      d.resto = r2(d.resto - q); falta = r2(falta - q);
    }
  }
  const conNombre = devengos.filter((d) => d.resto > 0.01).map((d) => ({ nombre: d.nombre, periodo: d.periodo, importe: d.resto, fuente: "465" }));
  if (conNombre.length) return conNombre;
  return meses.flatMap((m) => (nombresNomina[m] || []).map((nombre) => ({ nombre, periodo: m, importe: null, fuente: "nominas_mes" })));
}

module.exports = { casarMovimientos, nominasPendientes, palabras, mesDelConcepto, esAlberto };
