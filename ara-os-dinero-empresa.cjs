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
 * obras-otras,
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
 *   GET /api/ara-os/holded/dinero-empresa?token=…[&force=1][&pleo_saldo=743]
 *   pleo_saldo: el saldo de Pleo puesto a mano en Mi panel. Solo cuenta si
 *   Holded no da Pleo (o lo da a 0) y no hay pleo_saldo en config_dinero.
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
const panel = require("./lib/panel-empresa-calculo.cjs");

const VERSION = "0.5.0";
const HOLDED_V2 = "https://api.holded.com/api/v2";
const CACHE_MS = 60 * 1000;             // respuesta «fresca»
const CACHE_STALE_MS = 30 * 60 * 1000;   // hasta aquí se sirve al momento y se recalcula por detrás
const RENTAB_MS = 5 * 60 * 1000;         // caché de rentabilidad-obra por obra
const RENTAB_TIMEOUT_MS = 45 * 1000;
const TIMEOUT_MS = 30 * 1000;
const TIMEOUT_LARGO_MS = 90 * 1000;   // clientes-pendientes lee todo el histórico la primera vez
const CONFIG_HEADERS = ["clave", "valor", "nota"];
const CUENTA_BANCO_2 = "57200006";      // segunda cuenta corriente del Santander
const TAGS_HEADERS = ["tag_id", "ccpp_id", "tag", "created_at", "created_by", "borrado"];

let _cache = null;          // { ts, data }
let _reintento = null;      // temporizador de reintento cuando una fuente ha fallado
const REINTENTO_MS = 60 * 1000;
const REINTENTO_MAX_MS = 15 * 60 * 1000;
let _fallosSeguidos = 0;
// ¿Ha fallado alguna fuente? (data.fuentes: nombre → "ok" | error)
const fuenteCaida = (data) => Object.values(data?.fuentes || {}).some((v) => v !== "ok");
let _enCurso = null;        // promesa compartida si llegan dos peticiones a la vez
const _rentab = {};         // ccpp_id → { ts, fuente } (último dato bueno)

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
    if (!r.ok || !data || data.ok === false) return { ok: false, error: `${ruta}: ${data?.error || data?.lectura?.error || (r.ok ? "respuesta con ok:false" : "HTTP " + r.status)}` };
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
      out.push({ fecha: `${m[3]}-${m[2]}-${m[1]}`, descripcion: String(l.description || ""), tipo: String(l.type || ""), debe, haber, salida: Math.round((haber - debe) * 100) / 100 });
    }
    if (!pag?.has_more || !pag?.cursor) break;
    cursor = pag.cursor;
  }
  return { ok: true, data: out };
}

// rentabilidad-obra de una obra, con caché de 5 min. Es lenta (lee compras y
// hojas): si hay un dato bueno de menos de 5 min se usa sin llamar; si la
// llamada falla o tarda, se usa el último dato bueno que haya, avisándolo.
async function rentabObra(ccppId, token, force) {
  const c = _rentab[ccppId];
  if (!force && c && Date.now() - c.ts < RENTAB_MS) return c.fuente;
  const r = await local(`/api/ara-os/holded/rentabilidad-obra/${encodeURIComponent(ccppId)}`, token, {}, RENTAB_TIMEOUT_MS);
  if (r.ok) { _rentab[ccppId] = { ts: Date.now(), fuente: r }; return r; }
  if (c) return { ...c.fuente, viejo_min: Math.round((Date.now() - c.ts) / 60000), error_ultimo: r.error };
  return r;
}

// Saldo contable de una cuenta: suma de TODOS sus apuntes en el libro (debe −
// haber). Se pagina el histórico filtrando por cuenta; caché de 10 min.
const _saldoContable = {};   // cuenta → { ts, data }
const SALDO_CONTABLE_MS = 10 * 60 * 1000;
const DESDE_HISTORICO = "2019-01-01";
async function saldoContableCuenta(cuenta, hasta, force) {
  const c = _saldoContable[cuenta];
  if (!force && c && Date.now() - c.ts < SALDO_CONTABLE_MS) return c.data;
  const tok = process.env.HOLDED_API_TOKEN || "";
  if (!tok) return { ok: false, error: "Falta HOLDED_API_TOKEN en entorno" };
  let saldo = 0, n = 0, cursor = null, ultima = null;
  for (let i = 0; i < 400; i++) {
    const qs = new URLSearchParams({ start_date: DESDE_HISTORICO, end_date: hasta, limit: "100", account: cuenta });
    if (cursor) qs.set("cursor", cursor);
    const r = await fetch(`${HOLDED_V2}/ledger-entries?${qs}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
    if (!r.ok) return { ok: false, error: `Holded ledger ${cuenta}: HTTP ${r.status}` };
    const pag = await r.json();
    for (const l of pag?.items || []) {
      if (String(l.account || "") !== String(cuenta)) continue;
      saldo += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      n++;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      if (m) { const iso = `${m[3]}-${m[2]}-${m[1]}`; if (!ultima || iso > ultima) ultima = iso; }
    }
    if (!pag?.has_more || !pag?.cursor) break;
    cursor = pag.cursor;
    if (i === 399) return { ok: false, error: `Holded ledger ${cuenta}: más de 40.000 apuntes, lectura cortada` };
  }
  const data = { ok: true, data: { saldo: Math.round(saldo * 100) / 100, apuntes: n, ultimo_apunte: ultima } };
  _saldoContable[cuenta] = { ts: Date.now(), data };
  return data;
}

async function cuadreCuenta(tesoreria, cuenta, hasta, force) {
  if (!tesoreria?.ok) return { ok: false, error: `sin saldo del banco (${tesoreria?.error || "tesorería"})` };
  const cta = (tesoreria.data?.cuentas || []).find((c) => String(c.cuenta || "") === String(cuenta));
  if (!cta) return { ok: false, error: `la tesorería de Holded no trae la cuenta ${cuenta}` };
  const cont = await conTimeout(saldoContableCuenta(cuenta, hasta, force), TIMEOUT_LARGO_MS, `saldo contable ${cuenta}`).catch((e) => ({ ok: false, error: e.message }));
  if (!cont.ok) return { ok: false, error: cont.error };
  return { ok: true, data: { saldo_banco: Number(cta.saldo), saldo_movimientos: cont.data.saldo, cuenta, apuntes: cont.data.apuntes, ultimo_apunte: cont.data.ultimo_apunte } };
}

async function construir(token, force) {
  const hoy = hoyISO();
  const manana = calc.sumarDias(hoy, 1);   // end_date de Holded excluye ese día
  const iva = calc.periodoIvaSinLiquidar(hoy);
  const holded = require("./ara-os-holded.cjs");
  const f = force ? { force: "1" } : {};

  // Primera tanda, todo en paralelo
  const nombres = ["tesoreria", "clientes", "custodias", "obligaciones", "ot", "oo", "iva", "invoices", "prestamos", "config", "tags", "banco", "compras"];
  const res = await Promise.allSettled([
    local("/api/ara-os/holded/tesoreria", token),
    local("/api/ara-os/holded/clientes-pendientes", token, f, TIMEOUT_LARGO_MS),
    local("/api/ara-os/custodias", token, {}, TIMEOUT_LARGO_MS),
    local("/api/ara-os/obligaciones", token, f, TIMEOUT_LARGO_MS),
    local("/api/ara-os/ordenes-trabajo", token),
    local("/api/ara-os/obras-otras", token, {}, TIMEOUT_LARGO_MS),
    local("/api/ara-os/holded/iva-trimestre", token, { desde: iva.desde, hasta: iva.hasta }, TIMEOUT_LARGO_MS),
    conTimeout(holded.obtenerInvoices(), TIMEOUT_LARGO_MS, "facturas Holded")
      .then((r) => (r?.error ? { ok: false, error: r.error }
        : r?.incompleto ? { ok: false, error: `facturas Holded cortadas a medias (${r.error_parcial})` }
        : { ok: true, data: r.docs || [] })),
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
    // Las dos cuentas corrientes: nóminas y recibos pueden salir de cualquiera.
    // Si la segunda falla, se sigue con la principal (lo dice data.banco_cuentas).
    Promise.all([
      conTimeout(apuntesCuenta(calc.CUENTA_BANCO, calc.sumarDias(hoy, -75), manana), TIMEOUT_MS, "apuntes banco"),
      conTimeout(apuntesCuenta(CUENTA_BANCO_2, calc.sumarDias(hoy, -75), manana), TIMEOUT_MS, "apuntes banco 2").catch((e) => ({ ok: false, error: e.message })),
    ]).then(([a, b]) => (!a.ok ? a : { ok: true, data: [...a.data, ...(b.ok ? b.data : [])], cuentas: b.ok ? [calc.CUENTA_BANCO, CUENTA_BANCO_2] : [calc.CUENTA_BANCO], error_cuenta_2: b.ok ? null : b.error })),
    local("/api/ara-os/holded/compras-pendientes", token, {}, TIMEOUT_LARGO_MS),   // vencimientos para la previsión semanal
  ]);
  const fuentes = Object.fromEntries(nombres.map((n, i) => [n, aFuente(res[i])]));

  // Del banco solo cuentan los MOVIMIENTOS BANCARIOS, nunca los asientos
  // manuales del libro (type "entry": regularizaciones, reclasificaciones…).
  // Un asiento de regularización del 13/09 salía como «cargo de la TGSS».
  // Se aplica aquí para que D8, sus avisos, la frescura, la previsión y la
  // alerta de la SS lean lo mismo. Los tipos vistos van en la respuesta.
  // 10.2.1 · Saldo del banco (el de T1, tesorería de Holded) contra el saldo
  // CONTABLE de la misma cuenta 572 en el libro (suma de todos sus apuntes).
  // La diferencia son los movimientos del banco aún sin conciliar (propuesta
  // de Alberto, 30/09: los endpoints de movimientos de Holded son internos).
  fuentes.cuadre = await cuadreCuenta(fuentes.tesoreria, calc.CUENTA_BANCO, manana, force);

  let tiposBanco = null;
  if (fuentes.banco.ok) {
    tiposBanco = {};
    for (const a of fuentes.banco.data) tiposBanco[a.tipo || "(vacío)"] = (tiposBanco[a.tipo || "(vacío)"] || 0) + 1;
    fuentes.banco = { ok: true, data: fuentes.banco.data.filter(calc.esMovimientoBancario), cuentas: fuentes.banco.cuentas, error_cuenta_2: fuentes.banco.error_cuenta_2 };
  }

  // Segunda tanda: depende de la primera
  //  · rentabilidad de las obras en fase 12-17 (D11 coste pendiente, D14 comisión)
  //  · apuntes de la 465 del mes (¿nómina del mes contabilizada? D7)
  const enCurso = fuentes.ot.ok
    ? calc.FASES_RENTAB.flatMap((fase) => fuentes.ot.data.grupos?.[fase] || []).filter((o) => o.ccpp_id)
    : [];
  const cuentas465 = fuentes.clientes.ok
    ? Object.keys(fuentes.clientes.data.saldos_por_cuenta || {}).filter((c) => c.startsWith("465"))
    : [];
  const [rentab, n465] = await Promise.all([
    Promise.allSettled(enCurso.map((o) => rentabObra(o.ccpp_id, token, force))),
    Promise.allSettled(cuentas465.map((c) => conTimeout(apuntesCuenta(c, `${hoy.slice(0, 7)}-01`, manana), TIMEOUT_MS, `apuntes ${c}`))),
  ]);
  fuentes.rentab = Object.fromEntries(enCurso.map((o, i) => [o.ccpp_id, aFuente(rentab[i])]));
  const n465f = n465.map(aFuente);
  fuentes.nominas465 = n465f.every((r) => r.ok)
    ? { ok: true, data: n465f.flatMap((r) => r.data) }
    : { ok: false, error: n465f.find((r) => !r.ok)?.error };

  const generado = new Date().toISOString();
  return { ...componer({ fuentes, hoy, generado, tiposBanco }), _base: { fuentes, hoy, generado, tiposBanco } };
}

// Escalera + tarjetas a partir de las fuentes ya leídas. Es cálculo puro y
// rápido: se repite por petición cuando llega un saldo de Pleo puesto a mano,
// sin volver a leer Holded.
function componer({ fuentes, hoy, generado, tiposBanco }, opciones = {}) {
  const data = calc.calcularEscalera(fuentes, hoy, generado, opciones);
  // Sección 9 (tarjetas de Mi panel › Empresa): previsión semanal, alerta
  // patrimonial y umbral del semáforo de «mío hoy».
  data.panel = panel.calcularPanel(fuentes, data, hoy);
  if (data.panel.aviso_cierre) data.avisos.push(data.panel.aviso_cierre);   // 10.1.4: del 1/11 al 31/12
  data.version = VERSION;
  data.commit = (process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || null;   // Render lo pone en cada despliegue
  data.fuentes = Object.fromEntries(Object.entries(fuentes)
    .filter(([k]) => k !== "rentab")
    .map(([k, v]) => [k, v.ok ? "ok" : v.error]));
  data.banco_tipos_apunte = tiposBanco;   // diagnóstico: qué tipos trae la 572 y cuáles se descartan (entry)
  data.banco_cuentas = fuentes.banco?.cuentas || null;
  if (fuentes.banco?.error_cuenta_2) data.avisos.push({ nivel: "ambar", texto: `No se han podido leer los movimientos de la cuenta ${CUENTA_BANCO_2}: nóminas y recibos solo se buscan en la ${calc.CUENTA_BANCO}.` });
  return data;
}

// Respuesta pública: sin las fuentes en bruto; recalculada con el Pleo manual si llega.
function responder(data, opciones) {
  const { _base, ...pub } = data;
  if (opciones.pleo_manual == null || !_base) return pub;
  return componer(_base, opciones);
}

module.exports = function (app) {
  const cors = (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  };

  app.options("/api/ara-os/holded/dinero-empresa", (req, res) => { cors(res); res.status(204).end(); });

  // Recalcula en segundo plano (una sola vez aunque lleguen varias peticiones).
  // Usa el ADMIN_TOKEN del propio servidor para las llamadas internas.
  function refrescar(token, force = false) {
    if (!_enCurso) {
      _enCurso = construir(token, force)
        .then((data) => {
          _cache = { ts: Date.now(), data };
          // Si alguna fuente ha fallado (Holded 503, timeout…), se reintenta
          // solo al cabo de REINTENTO_MS aunque nadie abra el panel, hasta que
          // vuelva. Nunca se guarda un fallo como si fuera el dato bueno.
          if (!fuenteCaida(data)) _fallosSeguidos = 0;
          else if (!_reintento) {
            // 1, 2, 4, 8 y como mucho 15 min entre reintentos
            const espera = Math.min(REINTENTO_MS * 2 ** _fallosSeguidos++, REINTENTO_MAX_MS);
            _reintento = setTimeout(() => {
              _reintento = null;
              refrescar(token).catch((e) => console.error("[ara-os-dinero-empresa] reintento:", e.message));
            }, espera);
            _reintento.unref?.();
          }
          return data;
        })
        .finally(() => { _enCurso = null; });
    }
    return _enCurso;
  }
  const conEdad = (opciones, extra = {}) => ({ ...responder(_cache.data, opciones), cache: { edad_s: Math.round((Date.now() - _cache.ts) / 1000), ...extra } });

  app.get("/api/ara-os/holded/dinero-empresa", async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const force = String(req.query.force || "") === "1";
    const tokenInterno = process.env.ADMIN_TOKEN || String(req.query.token);
    const pleo = req.query.pleo_saldo != null && String(req.query.pleo_saldo).trim() !== "" ? Number(String(req.query.pleo_saldo).replace(",", ".")) : null;
    const opciones = { pleo_manual: Number.isFinite(pleo) ? pleo : null };
    try {
      if (!force && _cache) {
        const edad = Date.now() - _cache.ts;
        // Con una fuente caída no hay «fresco»: se sirve lo último (con sus
        // «sin dato») y se recalcula por detrás en cada petición.
        if (edad < CACHE_MS && !fuenteCaida(_cache.data)) return res.json(conEdad(opciones));
        if (edad < CACHE_STALE_MS) {
          // Se sirve ya lo último calculado y se recalcula por detrás: el panel no espera.
          refrescar(tokenInterno).catch((e) => console.error("[ara-os-dinero-empresa] refresco:", e.message));
          return res.json(conEdad(opciones, { recalculando: true }));
        }
      }
      const data = await refrescar(tokenInterno, force);
      res.json({ ...responder(data, opciones), cache: { edad_s: 0 } });
    } catch (e) {
      console.error("[ara-os-dinero-empresa]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Precálculo al arrancar, para que la primera apertura del panel no espere.
  if (process.env.ADMIN_TOKEN) {
    setTimeout(() => {
      refrescar(process.env.ADMIN_TOKEN).catch((e) => console.error("[ara-os-dinero-empresa] precálculo:", e.message));
    }, 20 * 1000).unref();
  }

  console.log(`[ara-os-dinero-empresa] v${VERSION} · /api/ara-os/holded/dinero-empresa`);
};

module.exports.construir = construir;
module.exports.componer = componer;
module.exports.cuadreCuenta = cuadreCuenta;
