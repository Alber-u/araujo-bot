/**
 * ara-os-resultado-mensual.cjs
 * --------------------------------------------------------------
 * ¿CUÁNTO SE GANA CADA MES? (petición de Alberto, 11/09/2026)
 *
 * Una sola cuenta, sin mezclar métodos:
 *
 *   Obra ejecutada del mes (ARA-OS, devengo por avance, SIN IVA)
 * − Gastos del mes (CONTABILIDAD de Holded, grupo 6, SIN IVA)
 * = RESULTADO REAL DEL MES
 *
 * Por qué los gastos salen de la contabilidad y no de ARA-OS:
 *   - La contabilidad lo tiene TODO: nóminas y Seguridad Social (640/642,
 *     comprobado: may-jun cuadran al céntimo con las nóminas en PDF),
 *     compras etiquetadas y sin etiquetar, seguros, banco, etc.
 *   - ARA-OS solo ve compras con etiqueta y horas × 30 €/h, y mezclaba
 *     tarifa cargada con gastos generales (doble conteo) y material con IVA.
 *
 * Además se da:
 *   - Resultado contable (lo facturado − gastos): lo que verá la gestoría.
 *   - Obra ejecutada sin facturar del mes = ejecutada − facturada.
 *   - Coste hora cargado real = (gastos − material de obra) ÷ horas de operarios,
 *     para contrastar la tarifa de 30 €/h que usan los márgenes por obra.
 *
 * Este módulo NO ESCRIBE NADA en Holded. Solo lee con el API Token v2
 * (HOLDED_API_TOKEN, Authorization: Bearer).
 *
 * Endpoints:
 *   GET /api/ara-os/contabilidad/pyg-mes?año=&mes=&token=   → grupo 6/7 del mes
 *   GET /api/ara-os/resultado-mensual?año=&token=           → serie mensual completa
 *   GET /panel-resultado?token=                              → pantalla
 *
 * v0.1.0 · 11/09/2026
 */

const HOLDED_V2 = "https://api.holded.com/api/v2";
const LIMITE_PAGINA = 100;
const MAX_PAGINAS = 80;              // 8.000 apuntes por mes como tope
const TTL_MES_CERRADO = 6 * 3600e3;  // meses pasados: 6 h
const TTL_MES_ABIERTO = 10 * 60e3;   // mes en curso: 10 min

const _cachePyG = {};
const _cacheSerie = {};

function numAPI(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v == null ? "0" : v).trim());
  return Number.isFinite(n) ? n : 0;
}
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const pad2 = n => String(n).padStart(2, "0");

async function holdedGetV2(ruta, params = {}) {
  const tok = process.env.HOLDED_API_TOKEN || "";
  if (!tok) return { ok: false, status: 500, error: "Falta HOLDED_API_TOKEN en entorno" };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  const url = `${HOLDED_V2}${ruta}${qs.toString() ? "?" + qs.toString() : ""}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    if (!r.ok) return { ok: false, status: r.status, error: `Holded respondió ${r.status}`, body_raw: text.slice(0, 300) };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 500, error: e.message };
  }
}

// Grupo contable por número de cuenta (PGC, 8 dígitos en Holded)
function clasificar(cuenta) {
  const s = String(cuenta || "");
  if (s.startsWith("6300") || s.startsWith("6301")) return { lado: "g", grupo: "impuesto_sociedades" };
  if (s.startsWith("60")) return { lado: "g", grupo: "compras" };
  if (s.startsWith("61")) return { lado: "g", grupo: "compras" };            // variación de existencias
  if (s.startsWith("62")) return { lado: "g", grupo: "servicios" };
  if (s.startsWith("63")) return { lado: "g", grupo: "tributos" };
  if (s.startsWith("64")) return { lado: "g", grupo: "personal" };
  if (s.startsWith("65")) return { lado: "g", grupo: "otros" };
  if (s.startsWith("66")) return { lado: "g", grupo: "financieros" };
  if (s.startsWith("67")) return { lado: "g", grupo: "otros" };
  if (s.startsWith("68")) return { lado: "g", grupo: "amortizacion" };
  if (s.startsWith("69")) return { lado: "g", grupo: "otros" };
  if (s.startsWith("70") || s.startsWith("71") || s.startsWith("73") || s.startsWith("74") || s.startsWith("75")) return { lado: "i", grupo: "ventas" };
  if (s.startsWith("76") || s.startsWith("77") || s.startsWith("79")) return { lado: "i", grupo: "otros_ingresos" };
  return null;
}

// -------------------------------------------------------------
// Pérdidas y ganancias de un mes, desde el libro diario v2.
// end_date deja fuera el propio día (aprendido el 09/09/2026):
// se pide hasta el día 1 del mes siguiente.
// -------------------------------------------------------------
async function leerPyGMes(año, mes, { force = false } = {}) {
  const key = `${año}-${pad2(mes)}`;
  const hoy = new Date();
  const abierto = año === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  const ttl = abierto ? TTL_MES_ABIERTO : TTL_MES_CERRADO;
  const c = _cachePyG[key];
  if (!force && c && Date.now() - c.ts < ttl) return c.data;

  const desde = `${año}-${pad2(mes)}-01`;
  const sig = new Date(Date.UTC(año, mes, 1));
  const hasta = sig.toISOString().slice(0, 10);

  const grupos = { ventas: 0, otros_ingresos: 0, compras: 0, servicios: 0, tributos: 0, personal: 0,
                   financieros: 0, amortizacion: 0, otros: 0, impuesto_sociedades: 0 };
  const cuentas = {};
  let apuntes = 0, excluidos = 0, cursor = null, paginas = 0;

  for (let i = 0; i < MAX_PAGINAS; i++) {
    const params = { start_date: desde, end_date: hasta, limit: String(LIMITE_PAGINA) };
    if (cursor) params.cursor = cursor;
    const pag = await holdedGetV2("/ledger-entries", params);
    if (!pag.ok) return { ok: false, año, mes, paso: "ledger-entries", ...pag };
    paginas++;
    for (const l of (pag.data && pag.data.items) || []) {
      // La fecha de la API viene como DD/MM/YYYY: descartar lo que no sea del mes
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      if (m && (Number(m[3]) !== año || Number(m[2]) !== mes)) continue;
      const cl = clasificar(l.account);
      if (!cl) continue;
      // Asientos de regularización/cierre/apertura vacían el grupo 6/7 contra la 129
      const desc = String(l.description || "");
      const tipo = String(l.type || "").toLowerCase();
      if (/regulariz|cierre|apertura/i.test(desc) || /closing|opening|regulariz/.test(tipo)) { excluidos++; continue; }
      const d = numAPI(l.debit), h = numAPI(l.credit);
      const importe = cl.lado === "g" ? d - h : h - d;
      grupos[cl.grupo] += importe;
      const k = String(l.account);
      cuentas[k] = r2((cuentas[k] || 0) + importe);
      apuntes++;
    }
    if (!pag.data || !pag.data.has_more || !pag.data.cursor) break;
    cursor = pag.data.cursor;
  }

  for (const k of Object.keys(grupos)) grupos[k] = r2(grupos[k]);
  const ingresos = r2(grupos.ventas + grupos.otros_ingresos);
  const gastos = r2(grupos.compras + grupos.servicios + grupos.tributos + grupos.personal +
                    grupos.financieros + grupos.amortizacion + grupos.otros);
  const data = {
    ok: true, año, mes, abierto,
    ingresos, gastos, resultado: r2(ingresos - gastos),
    grupos, cuentas, apuntes, excluidos, paginas,
  };
  _cachePyG[key] = { ts: Date.now(), data };
  return data;
}

module.exports = function setupResultadoMensual(app) {
  const { validToken } = require("./lib/auth.cjs");
  const path = require("path");
  const http = require("http");
  const tokenValido = req => validToken(req.query.token);
  const cors = res => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  };
  const BASE = `http://localhost:${process.env.PORT || 10000}`;
  const fetchLocal = p => new Promise(resolve => {
    http.get(BASE + p, r => { let raw = ""; r.on("data", d => raw += d); r.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } }); })
      .on("error", () => resolve(null));
  });

  app.options("/api/ara-os/contabilidad/pyg-mes", (req, res) => { cors(res); res.status(204).end(); });
  app.get("/api/ara-os/contabilidad/pyg-mes", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    const hoy = new Date();
    const año = parseInt(req.query["año"] || req.query.anio || hoy.getFullYear());
    const mes = parseInt(req.query.mes || (hoy.getMonth() + 1));
    const d = await leerPyGMes(año, mes, { force: !!req.query.refresh });
    res.status(d.ok ? 200 : 502).json(d);
  });

  // -----------------------------------------------------------
  // Serie mensual del año
  // -----------------------------------------------------------
  app.options("/api/ara-os/resultado-mensual", (req, res) => { cors(res); res.status(204).end(); });
  app.get("/api/ara-os/resultado-mensual", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ ok: false, error: "Token inválido" });
    try {
      const hoy = new Date();
      const año = parseInt(req.query["año"] || req.query.anio || hoy.getFullYear());
      const token = String(req.query.token || "");
      const ck = String(año);
      if (!req.query.refresh && _cacheSerie[ck] && Date.now() - _cacheSerie[ck].ts < 10 * 60e3) {
        return res.json(_cacheSerie[ck].data);
      }
      const mesMax = año === hoy.getFullYear() ? hoy.getMonth() + 1 : (año < hoy.getFullYear() ? 12 : 0);

      const meses = [];
      for (let m = 1; m <= mesMax; m++) {
        // En serie, no en paralelo: posicion-neta-real es pesado y lee Sheets.
        const [pnr, pyg] = await Promise.all([
          fetchLocal(`/api/ara-os/holded/posicion-neta-real?a%C3%B1o=${año}&mes=${m}&token=${encodeURIComponent(token)}`),
          leerPyGMes(año, m),
        ]);
        const avisos = [];
        const abierto = año === hoy.getFullYear() && m === hoy.getMonth() + 1;
        if (abierto) avisos.push("Mes en curso: faltan nóminas y facturas por contabilizar.");
        if (!pnr || !pnr.ok) avisos.push("ARA-OS no devolvió la obra ejecutada del mes.");
        if (!pyg || !pyg.ok) avisos.push("Holded no devolvió la contabilidad del mes: " + ((pyg && (pyg.error || pyg.body_raw)) || "sin respuesta"));

        const ejecutada = pnr && pnr.ok ? r2(pnr.ingreso_mes_eur) : null;
        const horas = pnr && pnr.ok ? r2(pnr.total_horas_mo) : null;
        const materialObra = pnr && pnr.ok ? r2(pnr.gastos_materiales_eur) : null;   // compras con etiqueta de obra, sin IVA
        const comprasSinObra = pnr && pnr.ok ? r2(pnr.costes_generales_eur) : null;  // compras sin etiqueta de obra, sin IVA
        const sinFecha = pnr && pnr.ok ? (pnr.obras_terminadas_sin_fecha || []) : [];
        if (sinFecha.length) avisos.push(`${sinFecha.length} obra(s) terminadas sin fecha de cierre: su ingreso no cuenta (${sinFecha.slice(0, 3).map(o => o.nombre).join(", ")}${sinFecha.length > 3 ? "…" : ""}).`);

        const facturado = pyg && pyg.ok ? pyg.grupos.ventas : null;
        const gastos = pyg && pyg.ok ? pyg.gastos : null;
        const personal = pyg && pyg.ok ? pyg.grupos.personal : null;
        if (pyg && pyg.ok && !abierto && personal < 1000) avisos.push("No hay nóminas contabilizadas este mes en Holded.");

        const resultadoReal = ejecutada != null && gastos != null ? r2(ejecutada - gastos) : null;
        const resultadoContable = pyg && pyg.ok ? pyg.resultado : null;
        const sinFacturar = ejecutada != null && facturado != null ? r2(ejecutada - facturado) : null;
        const costeHora = horas > 0 && gastos != null && materialObra != null ? r2((gastos - materialObra) / horas) : null;
        if (comprasSinObra != null && comprasSinObra > 4000) avisos.push(`Compras sin etiqueta de obra ${Math.round(comprasSinObra)} €: si es material, los márgenes por obra salen inflados y el coste hora cargado también.`);

        meses.push({
          mes: m, abierto,
          obra_ejecutada: ejecutada,
          facturado,
          obra_sin_facturar_mes: sinFacturar,
          gastos,
          gastos_desglose: pyg && pyg.ok ? {
            compras: pyg.grupos.compras, servicios: pyg.grupos.servicios, personal: pyg.grupos.personal,
            tributos: pyg.grupos.tributos, financieros: pyg.grupos.financieros,
            amortizacion: pyg.grupos.amortizacion, otros: pyg.grupos.otros,
          } : null,
          material_obra_etiquetado: materialObra,
          compras_sin_etiqueta_obra: comprasSinObra,
          resultado_real: resultadoReal,
          resultado_contable: resultadoContable,
          horas_operarios: horas,
          coste_hora_cargado: costeHora,
          obras_cierran_mes: pnr && pnr.ok ? (pnr.obras || []).filter(o => o.cierra_este_mes && o.ingreso_mes > 0).map(o => ({ nombre: o.nombre, ingreso: o.ingreso_mes })) : [],
          avisos,
        });
      }

      const cerrados = meses.filter(x => !x.abierto && x.resultado_real != null);
      const suma = k => r2(cerrados.reduce((s, x) => s + (x[k] || 0), 0));
      const ult3 = cerrados.slice(-3);
      const media3 = k => ult3.length ? r2(ult3.reduce((s, x) => s + (x[k] || 0), 0) / ult3.length) : null;
      const horasTot = suma("horas_operarios");
      const acumulado = {
        meses_cerrados: cerrados.length,
        obra_ejecutada: suma("obra_ejecutada"),
        facturado: suma("facturado"),
        obra_sin_facturar: suma("obra_sin_facturar_mes"),
        gastos: suma("gastos"),
        resultado_real: suma("resultado_real"),
        resultado_contable: suma("resultado_contable"),
        horas_operarios: horasTot,
        coste_hora_cargado: horasTot > 0 ? r2((suma("gastos") - suma("material_obra_etiquetado")) / horasTot) : null,
      };
      acumulado.resultado_real_medio_mes = cerrados.length ? r2(acumulado.resultado_real / cerrados.length) : null;
      acumulado.resultado_contable_medio_mes = cerrados.length ? r2(acumulado.resultado_contable / cerrados.length) : null;
      const ultimos3 = {
        meses: ult3.map(x => x.mes),
        resultado_real_medio: media3("resultado_real"),
        obra_ejecutada_media: media3("obra_ejecutada"),
        gastos_medios: media3("gastos"),
        coste_hora_cargado: (() => { const h = ult3.reduce((s, x) => s + (x.horas_operarios || 0), 0);
          return h > 0 ? r2(ult3.reduce((s, x) => s + (x.gastos || 0) - (x.material_obra_etiquetado || 0), 0) / h) : null; })(),
      };

      const data = {
        ok: true, version: "0.1.0", ts: new Date().toISOString(), año,
        metodo: "Resultado real = obra ejecutada del mes (ARA-OS, sin IVA) − gastos del mes (contabilidad Holded, grupo 6). Resultado contable = ventas facturadas − gastos.",
        meses, acumulado, ultimos_3_meses: ultimos3,
        tarifa_obras_eur_h: 30,
      };
      _cacheSerie[ck] = { ts: Date.now(), data };
      res.json(data);
    } catch (e) {
      console.error("[resultado-mensual]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/panel-resultado", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "panel-resultado.html"));
  });

  console.log("[ara-os-resultado-mensual] v0.1.0 · /api/ara-os/resultado-mensual · /panel-resultado");
};

module.exports.leerPyGMes = leerPyGMes;
