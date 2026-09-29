/**
 * ara-os-dinero-empresa.cjs
 * --------------------------------------------------------------
 * «DINERO DE LA EMPRESA» — la escalera de Mi panel › Empresa
 * (ESPEC del 29/09/2026).
 *
 * Empieza en el banco y suma/resta paso a paso (TENGO T1-T5, DEBO D1-D12)
 * hasta el dinero que es de verdad de la empresa antes del IS.
 *
 * No reescribe ninguna lógica: combina lo que ya devuelven los endpoints
 * (tesoreria, clientes-pendientes, custodias, obligaciones, ordenes-trabajo,
 * iva-trimestre, rentabilidad-obra), las facturas de Holded, las hojas
 * `prestamos` y `config_dinero`, y los apuntes del banco (frescura y
 * nóminas pagadas). El cálculo está en lib/dinero-empresa-calculo.cjs.
 *
 * Cada fuente va con Promise.allSettled y timeout: si una falla, su línea
 * sale «sin dato» y la respuesta lleva completo:false. Nunca un 0 silencioso.
 * Solo lectura en Holded. En las hojas solo crea `prestamos` y
 * `config_dinero` (cabecera) si no existen.
 *
 * Endpoint:
 *   GET /api/ara-os/holded/dinero-empresa?token=…[&force=1]
 *
 * Hoja `config_dinero` (clave | valor | nota):
 *   nomina_neta_mensual · pleo_saldo · poliza_dispuesta
 *
 * v0.1.0 · 29/09/2026
 */
"use strict";

const { validToken } = require("./lib/auth.cjs");
const { leerPestana } = require("./lib/sheets-tabla.cjs");
const { PRESTAMOS_HEADERS } = require("./lib/prestamos.cjs");
const calc = require("./lib/dinero-empresa-calculo.cjs");

const VERSION = "0.1.0";
const HOLDED_V2 = "https://api.holded.com/api/v2";
const CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 30 * 1000;
const TIMEOUT_LARGO_MS = 90 * 1000;   // clientes-pendientes lee todo el histórico la primera vez
const CONFIG_HEADERS = ["clave", "valor", "nota"];
const TAGS_HEADERS = ["tag_id", "ccpp_id", "tag", "created_at", "created_by", "borrado"];

let _cache = null;          // { ts, data }
let _enCurso = null;        // promesa compartida si llegan dos peticiones a la vez

const hoyISO = () => new Date().toISOString().slice(0, 10);

function conTimeout(promesa, ms, nombre) {
  let t;
  return Promise.race([
    promesa,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${nombre}: sin respuesta en ${ms / 1000} s`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

// Resultado de allSettled → { ok, data } / { ok:false, error }
const aFuente = (r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message || String(r.reason) });

// GET a un endpoint propio (mismo proceso), con el token de quien pregunta.
async function local(ruta, token, params = {}, ms = TIMEOUT_MS) {
  const base = `http://127.0.0.1:${process.env.PORT || 10000}`;
  const qs = new URLSearchParams({ ...params, token });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${base}${ruta}?${qs}`, { signal: ctrl.signal });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || data.ok === false) return { ok: false, error: `${ruta}: ${data?.error || "HTTP " + r.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `${ruta}: ${e.name === "AbortError" ? `sin respuesta en ${ms / 1000} s` : e.message}` };
  } finally {
    clearTimeout(t);
  }
}

// Apuntes de una cuenta en Holded (API v2, /ledger-entries), paginados.
async function apuntesCuenta(cuenta, desde, hasta) {
  const tok = process.env.HOLDED_API_TOKEN || "";
  if (!tok) return { ok: false, error: "Falta HOLDED_API_TOKEN en entorno" };
  const out = [];
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const qs = new URLSearchParams({ start_date: desde, end_date: hasta, limit: "100", account: cuenta });
    if (cursor) qs.set("cursor", cursor);
    const r = await fetch(`${HOLDED_V2}/ledger-entries?${qs}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
    if (!r.ok) return { ok: false, error: `Holded ledger ${cuenta}: HTTP ${r.status}` };
    const pag = await r.json();
    for (const l of pag?.items || []) {
      if (cuenta && String(l.account || "") !== String(cuenta)) continue;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      if (!m) continue;
      const debe = Number(l.debit) || 0, haber = Number(l.credit) || 0;
      out.push({ fecha: `${m[3]}-${m[2]}-${m[1]}`, descripcion: String(l.description || ""), debe, haber, salida: Math.round((haber - debe) * 100) / 100 });
    }
    if (!pag?.has_more || !pag?.cursor) break;
    cursor = pag.cursor;
  }
  return { ok: true, data: out };
}

async function construir(token, force) {
  const hoy = hoyISO();
  const manana = calc.sumarDias(hoy, 1);   // end_date de Holded excluye ese día
  const iva = calc.periodoIvaSinLiquidar(hoy);
  const holded = require("./ara-os-holded.cjs");
  const f = force ? { force: "1" } : {};

  // Primera tanda, todo en paralelo
  const nombres = ["tesoreria", "clientes", "custodias", "obligaciones", "ot", "iva", "invoices", "prestamos", "config", "tags", "banco"];
  const res = await Promise.allSettled([
    local("/api/ara-os/holded/tesoreria", token),
    local("/api/ara-os/holded/clientes-pendientes", token, f, TIMEOUT_LARGO_MS),
    local("/api/ara-os/custodias", token, {}, TIMEOUT_LARGO_MS),
    local("/api/ara-os/obligaciones", token, f, TIMEOUT_LARGO_MS),
    local("/api/ara-os/ordenes-trabajo", token),
    local("/api/ara-os/holded/iva-trimestre", token, { desde: iva.desde, hasta: iva.hasta }, TIMEOUT_LARGO_MS),
    conTimeout(holded.obtenerInvoices({ mesesHaciaAtras: 24 }), TIMEOUT_LARGO_MS, "facturas Holded")
      .then((r) => (r?.error ? { ok: false, error: r.error } : { ok: true, data: r.docs || [] })),
    conTimeout(leerPestana("prestamos", PRESTAMOS_HEADERS), TIMEOUT_MS, "hoja prestamos")
      .then((r) => ({ ok: true, data: r.filas, faltan: r.faltan })),
    conTimeout(leerPestana("config_dinero", CONFIG_HEADERS), TIMEOUT_MS, "hoja config_dinero")
      .then((r) => ({ ok: true, data: r.filas })),
    conTimeout(leerPestana("comunidades_tags_holded", TAGS_HEADERS, { crear: false }), TIMEOUT_MS, "hoja comunidades_tags_holded")
      .then((r) => {
        const m = {};
        for (const t of r.filas) if (String(t.borrado).toUpperCase() !== "TRUE" && t.ccpp_id && t.tag) (m[t.ccpp_id] = m[t.ccpp_id] || []).push(String(t.tag));
        return { ok: true, data: m };
      }),
    conTimeout(apuntesCuenta(calc.CUENTA_BANCO, calc.sumarDias(hoy, -45), manana), TIMEOUT_MS, "apuntes banco"),
  ]);
  const fuentes = Object.fromEntries(nombres.map((n, i) => [n, aFuente(res[i])]));

  // Segunda tanda: depende de la primera
  //  · rentabilidad de las obras en fase 12-13 (D11)
  //  · apuntes de la 465 del mes (¿nómina del mes contabilizada? D7)
  const enCurso = fuentes.ot.ok
    ? calc.FASES_D11.flatMap((fase) => fuentes.ot.data.grupos?.[fase] || []).filter((o) => o.ccpp_id)
    : [];
  const cuentas465 = fuentes.clientes.ok
    ? Object.keys(fuentes.clientes.data.saldos_por_cuenta || {}).filter((c) => c.startsWith("465"))
    : [];
  const [rentab, n465] = await Promise.all([
    Promise.allSettled(enCurso.map((o) => local(`/api/ara-os/holded/rentabilidad-obra/${encodeURIComponent(o.ccpp_id)}`, token))),
    Promise.allSettled(cuentas465.map((c) => conTimeout(apuntesCuenta(c, `${hoy.slice(0, 7)}-01`, manana), TIMEOUT_MS, `apuntes ${c}`))),
  ]);
  fuentes.rentab = Object.fromEntries(enCurso.map((o, i) => [o.ccpp_id, aFuente(rentab[i])]));
  const n465f = n465.map(aFuente);
  fuentes.nominas465 = n465f.every((r) => r.ok)
    ? { ok: true, data: n465f.flatMap((r) => r.data) }
    : { ok: false, error: n465f.find((r) => !r.ok)?.error };

  const data = calc.calcularEscalera(fuentes, hoy, new Date().toISOString());
  data.version = VERSION;
  data.fuentes = Object.fromEntries(Object.entries(fuentes)
    .filter(([k]) => k !== "rentab")
    .map(([k, v]) => [k, v.ok ? "ok" : v.error]));
  return data;
}

module.exports = function (app) {
  const cors = (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  };

  app.options("/api/ara-os/holded/dinero-empresa", (req, res) => { cors(res); res.status(204).end(); });

  app.get("/api/ara-os/holded/dinero-empresa", async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const force = String(req.query.force || "") === "1";
    try {
      if (!force && _cache && Date.now() - _cache.ts < CACHE_MS) return res.json({ ..._cache.data, cache: true });
      if (!_enCurso) {
        _enCurso = construir(String(req.query.token), force)
          .then((data) => { _cache = { ts: Date.now(), data }; return data; })
          .finally(() => { _enCurso = null; });
      }
      res.json(await _enCurso);
    } catch (e) {
      console.error("[ara-os-dinero-empresa]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log(`[ara-os-dinero-empresa] v${VERSION} · /api/ara-os/holded/dinero-empresa`);
};

module.exports.construir = construir;
