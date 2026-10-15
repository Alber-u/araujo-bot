#!/usr/bin/env node
// 15/10/2026 · Mi panel › Resultado real del mes: qué órdenes de Otras órdenes cambian de «Trabajo realizado» al
// pasar de horas previstas = días estimados × 16 h a las horas previstas de la orden (columna AI).
// Sólo lectura, con los endpoints públicos de ARA·OS (no hace falta token) y el mismo cálculo que el endpoint
// (lib/ingreso-obra-mes.cjs). No incluye el importe sacado de la factura de Holded para las órdenes sin desglose de
// IVA (se marcan): a esas sólo les cambia la proporción, no el importe.
//
// Uso: node scripts/comparar-horas-previstas.cjs [https://araujo-bot.onrender.com] [2026-01] [2026-10]
const { ingresoObraMes } = require("../lib/ingreso-obra-mes.cjs");

const num = (s) => { if (s == null || s === "") return 0; let v = String(s).trim(); if (v.includes(",") && v.includes(".")) v = v.replace(/\./g, "").replace(",", "."); else if (v.includes(",")) v = v.replace(",", "."); return parseFloat(v) || 0; };
const iso = (s) => { const v = String(s || "").trim(); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ""; };
const FASES_OO_CON_HORAS = new Set(["INICIO_OBRA", "EN_EJECUCION", "FINALIZADA", "FACTURADA", "COBRADA", "INCIDENCIAS"]);

// obras: GET /api/ara-os/obras-otras (.obras) · registros: GET /api/ara-os/registros-tiempo (.registros)
function comparar(obras, registros, meses) {
  const regs = (registros || []).filter((r) => r.obra_id && (!r.tipo || r.tipo === "trabajo" || r.tipo === "extra") && String(r.borrado).toUpperCase() !== "TRUE");
  const suma = (pred) => { const m = {}; for (const r of regs) if (pred(r)) { const k = String(r.obra_id).trim(); m[k] = (m[k] || 0) + (parseFloat(r.horas) || 0); } return m; };
  const total = suma(() => true);
  const ultima = {};
  for (const r of regs) { const k = String(r.obra_id).trim(); if (r.fecha && (!ultima[k] || r.fecha > ultima[k])) ultima[k] = r.fecha; }
  const filas = [];
  for (const mes of meses) {
    const [a, m] = mes.split("-").map(Number);
    const desde = `${mes}-01`, hasta = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
    const ant = new Date(a, m - 1, 0), hastaAnt = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, "0")}-${String(ant.getDate()).padStart(2, "0")}`;
    const acum = suma((r) => r.fecha <= hasta), acumAnt = suma((r) => r.fecha <= hastaAnt), delMes = suma((r) => r.fecha >= desde && r.fecha <= hasta);
    for (const o of obras || []) {
      if (!o.obra_id || !o.nombre || String(o.borrado).toUpperCase() === "TRUE" || !FASES_OO_CON_HORAS.has(o.fase)) continue;
      const dias16 = num(o.dias_estimados) * 16, hp = num(o.horas_previstas);
      const despues = hp > 0 ? hp : dias16;
      if (Math.abs(despues - dias16) <= 0.01) continue;
      const sub = num(o.subtotal_eur), iva = num(o.iva_eur), tot = num(o.total_eur);
      const importe = sub > 0 ? sub : tot > 0 && iva > 0 ? tot - iva : tot > 0 ? tot : num(o.importe);
      const sinDesglose = !(sub > 0) && !(tot > 0 && iva > 0);
      let fechaFin = iso(o.fecha_fin_real) || iso(o.fecha_facturada) || iso(o.fecha_cobrada);
      const fixner = String(o.created_by || "").trim() === "import-fixner" || /importado de fixner/i.test(String(o.notas || ""));
      const enVentana = (f) => f && f >= "2026-05-15" && f <= "2026-05-31";
      if (fixner && fechaFin && enVentana(fechaFin) && !(iso(o.fecha_inicio) && iso(o.fecha_inicio) >= "2026-05-01")) fechaFin = [iso(o.fecha_fin_real), iso(o.fecha_facturada), iso(o.fecha_cobrada)].filter((f) => f && !enVentana(f))[0] || "";
      const k = (mp) => mp[o.obra_id] || mp[o.nombre] || 0;
      const base = { tipo: "otras", fase: o.fase, importe, horasAcum: k(acum), horasAcumAntes: k(acumAnt), horasMes: k(delMes), horasTotalReal: k(total),
                     fechaFin: fechaFin || ultima[o.obra_id] || ultima[o.nombre] || "", importFixner: fixner };
      const A = ingresoObraMes({ ...base, horasPrevistas: dias16 }, desde, hasta), D = ingresoObraMes({ ...base, horasPrevistas: despues }, desde, hasta);
      if (Math.abs(A.ingresoObraMes - D.ingresoObraMes) < 0.01 && Math.abs(A.devengado - D.devengado) < 0.01) continue;
      filas.push({ mes, obra_id: o.obra_id, nombre: o.nombre, fase: o.fase, importe: Math.round(importe * 100) / 100, sin_desglose_iva: sinDesglose,
        horas_mes: Math.round(base.horasMes * 100) / 100, horas_acum: Math.round(base.horasAcum * 100) / 100,
        hp_antes: Math.round(dias16 * 100) / 100, hp_despues: Math.round(despues * 100) / 100,
        ingreso_antes: A.ingresoObraMes, ingreso_despues: D.ingresoObraMes, diferencia: Math.round((D.ingresoObraMes - A.ingresoObraMes) * 100) / 100,
        devengado_antes: A.devengado, devengado_despues: D.devengado });
    }
  }
  return filas;
}

async function main() {
  const base = (process.argv[2] || "https://araujo-bot.onrender.com").replace(/\/$/, "");
  const desde = process.argv[3] || "2026-01", hasta = process.argv[4] || new Date().toISOString().slice(0, 7);
  const meses = [];
  for (let [a, m] = desde.split("-").map(Number); `${a}-${String(m).padStart(2, "0")}` <= hasta; m === 12 ? (a++, m = 1) : m++) meses.push(`${a}-${String(m).padStart(2, "0")}`);
  const j = async (u) => { const r = await fetch(base + u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); };
  const [oo, rt] = await Promise.all([j("/api/ara-os/obras-otras"), j("/api/ara-os/registros-tiempo")]);
  const filas = comparar(oo.obras || [], rt.registros || [], meses);
  const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log("| Mes | Orden | Fase | Importe | h mes | h previstas antes → después | Trabajo realizado antes → después | Dif. |");
  console.log("|---|---|---|---:|---:|---|---|---:|");
  for (const f of filas) console.log(`| ${f.mes} | ${f.obra_id} ${f.nombre}${f.sin_desglose_iva ? " (sin desglose IVA)" : ""} | ${f.fase} | ${eur(f.importe)} | ${f.horas_mes} | ${f.hp_antes} → ${f.hp_despues} | ${eur(f.ingreso_antes)} → ${eur(f.ingreso_despues)} | ${eur(f.diferencia)} |`);
  const porMes = {};
  for (const f of filas) porMes[f.mes] = Math.round(((porMes[f.mes] || 0) + f.diferencia) * 100) / 100;
  console.log("\nDiferencia por mes:", Object.entries(porMes).map(([m, d]) => `${m}: ${eur(d)} €`).join(" · ") || "ninguna");
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { comparar };
