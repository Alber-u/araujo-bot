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
const concil = require("./lib/conciliacion-provisional.cjs");
const cashflow = require("./lib/cashflow-calculo.cjs");
const simulador = require("./lib/simulador-caja.cjs");
const ordenCartera = require("./lib/orden-cartera.cjs");
const planCalendario = require("./lib/planificacion-calendario.cjs");
// Seguimiento previsto vs real (punto 8): una fila por mes con la previsión
// del día 1 y, al cerrar el mes, lo real.
const HOJA_PREV = "cashflow_previsiones";
const PREV_HEADERS = ["mes", "guardado", "escenario", "caja_fin_mes", "facturacion", "beneficio", "caja_real", "facturacion_real", "beneficio_real", "mandos_json"];
const { asegurarPestana, getSheetsClient } = require("./lib/sheets-tabla.cjs");
const panel = require("./lib/panel-empresa-calculo.cjs");

const VERSION = "0.8.0";
const HOLDED_V2 = "https://api.holded.com/api/v2";
const CACHE_MS = 60 * 1000;             // respuesta «fresca»
const CACHE_STALE_MS = 30 * 60 * 1000;   // hasta aquí se sirve al momento y se recalcula por detrás
const RENTAB_MS = 5 * 60 * 1000;         // caché de rentabilidad-obra por obra
const RENTAB_TIMEOUT_MS = 45 * 1000;
const TIMEOUT_MS = 30 * 1000;
const TIMEOUT_LARGO_MS = 90 * 1000;   // clientes-pendientes lee todo el histórico la primera vez
const CONFIG_HEADERS = ["clave", "valor", "nota"];
const CUENTA_BANCO_2 = "57200006";      // segunda cuenta corriente del Santander
// Foto diaria de los movimientos del banco sin conciliar (la sube la rutina de
// Cowork con la sesión de Holded: la API pública no los da). Una fila por foto.
const HOJA_FOTO = "banco_sin_conciliar";
const FOTO_HEADERS = ["generado", "recibido", "cuenta", "last_sync_at", "n_movimientos", "total", "movimientos_json"];
const NOMINAS_MES_HEADERS = ["periodo", "importe", "updated_at", "updated_by", "indirectos_eur", "detalle_json"];
const DIAS_465 = 120;                   // apuntes de la 465 para las nóminas pendientes por persona
let _foto = null;                       // última foto leída/guardada (caché)
// Fuentes lentas del cash flow (recorren posicion-neta-real): 30 min de caché
// y, si fallan, el último dato bueno.
const LENTO_MS = 30 * 60 * 1000, TIMEOUT_LENTO_MS = 150 * 1000;
const _lento = {};
const ESPERA_LENTO_MS = 20 * 1000;      // la escalera no espera más: la lectura sigue por detrás
const _enVuelo = {};
async function lento(clave, fn) {
  const c = _lento[clave];
  if (c && Date.now() - c.ts < LENTO_MS) return c.r;
  if (!_enVuelo[clave]) {
    _enVuelo[clave] = fn().catch((e) => ({ ok: false, error: e.message }))
      .then((r) => { if (r.ok) _lento[clave] = { ts: Date.now(), r }; return r; })
      .finally(() => { delete _enVuelo[clave]; });
  }
  const r = await Promise.race([_enVuelo[clave], new Promise((res) => setTimeout(() => res(null), ESPERA_LENTO_MS).unref?.())]);
  if (r?.ok) return r;
  if (c) return { ...c.r, viejo_min: Math.round((Date.now() - c.ts) / 60000) };
  return r || { ok: false, error: `${clave}: calculando (primera lectura, más de ${ESPERA_LENTO_MS / 1000} s)` };
}

async function leerUltimaFoto() {
  if (_foto) return { ok: true, data: _foto };
  const r = await leerPestana(HOJA_FOTO, FOTO_HEADERS, { crear: false });
  if (r.no_existe || !r.filas.length) return { ok: true, data: null };
  const ult = r.filas.filter((x) => x.generado).sort((a, b) => String(a.generado).localeCompare(String(b.generado))).pop();
  if (!ult) return { ok: true, data: null };
  let movimientos = [];
  try { movimientos = JSON.parse(ult.movimientos_json || "[]"); } catch { return { ok: false, error: "banco_sin_conciliar: movimientos_json ilegible" }; }
  _foto = { generado: String(ult.generado), recibido: String(ult.recibido || ""), cuenta: String(ult.cuenta || "") || null,
            last_sync_at: String(ult.last_sync_at || "") || null, movimientos };
  return { ok: true, data: _foto };
}

// Valida y normaliza el cuerpo del POST. Devuelve { foto } o { error }.
function validarFoto(b) {
  if (!b || typeof b !== "object") return { error: "Cuerpo JSON vacío" };
  if (!b.generado || isNaN(Date.parse(b.generado))) return { error: "generado: fecha ISO obligatoria" };
  if (!Array.isArray(b.movimientos)) return { error: "movimientos: lista obligatoria" };
  if (b.movimientos.length > 300) return { error: "movimientos: más de 300" };
  const movs = [];
  for (const [i, m] of b.movimientos.entries()) {
    const pend = Number(m?.pendingToReconcile), amount = Number(m?.amount);
    if (!m?.date || isNaN(Date.parse(String(m.date).slice(0, 10))) || !Number.isFinite(pend)) return { error: `movimientos[${i}]: date y pendingToReconcile obligatorios` };
    if (Math.abs(pend) <= 0.005) continue;           // conciliado: no es desfase
    movs.push({ id: String(m.id || "").slice(0, 64), date: String(m.date).slice(0, 10), amount: Number.isFinite(amount) ? amount : pend,
                description: String(m.description || "").slice(0, 160), pendingToReconcile: pend });
  }
  const last = b.last_sync_at && !isNaN(Date.parse(b.last_sync_at)) ? new Date(b.last_sync_at).toISOString() : null;
  return { foto: { generado: new Date(b.generado).toISOString(), cuenta: b.cuenta ? String(b.cuenta).slice(0, 64) : null, last_sync_at: last, movimientos: movs } };
}
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
  const nombres = ["tesoreria", "clientes", "custodias", "obligaciones", "ot", "oo", "iva", "invoices", "prestamos", "config", "tags", "banco", "compras", "foto", "nominas_mes", "pnr_ref", "res_anual", "previsiones", "comunidades_doc", "planificacion"];
  const [ya, ma] = hoy.split("-").map(Number);
  const ref = ma === 1 ? { año: ya - 1, mes: 12 } : { año: ya, mes: ma - 1 };   // último mes cerrado
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
    conTimeout(leerUltimaFoto(), TIMEOUT_MS, "hoja banco_sin_conciliar"),
    conTimeout(leerPestana("nominas_mes", NOMINAS_MES_HEADERS, { crear: false }), TIMEOUT_MS, "hoja nominas_mes")
      .then((r) => {
        const m = {};
        for (const fila of r.filas || []) {
          let det = []; try { det = JSON.parse(fila.detalle_json || "[]"); } catch {}
          if (Array.isArray(det) && det.length) m[String(fila.periodo).trim()] = det.map((t) => String(t.nombre || "")).filter(Boolean);
        }
        return { ok: true, data: m };
      }),
    // Cash flow: último mes cerrado (obras 05-09, horas, material, fijos) y la
    // serie del año (beneficio acumulado para el IS, media de gastos fijos)
    lento(`pnr_${ref.año}_${ref.mes}`, () => local("/api/ara-os/holded/posicion-neta-real", token, { año: String(ref.año), mes: String(ref.mes) }, TIMEOUT_LENTO_MS)),
    lento(`anual_${ya}`, () => local("/api/ara-os/holded/resultado-real-anual", token, { año: String(ya) }, TIMEOUT_LENTO_MS)),
    conTimeout(leerPestana(HOJA_PREV, PREV_HEADERS, { crear: false }), TIMEOUT_MS, `hoja ${HOJA_PREV}`).then((r) => ({ ok: true, data: r.filas || [] })),
    // Documentación de cada expediente (hoja de comunidades, solo lectura): orden del calendario
    conTimeout(getSheetsClient().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "comunidades!A2:BO", valueRenderOption: "UNFORMATTED_VALUE" }), TIMEOUT_MS, "hoja comunidades")
      .then((r) => ({ ok: true, data: r.data.values || [] })),
    // Orden de obras puesto a mano (calendario del cash flow; también para Planificación)
    conTimeout(leerPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS), TIMEOUT_MS, `hoja ${ordenCartera.HOJA_PLAN}`).then((r) => ({ ok: true, data: r.filas || [] })),
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
    Promise.allSettled(cuentas465.map((c) => conTimeout(apuntesCuenta(c, calc.sumarDias(hoy, -DIAS_465), manana), TIMEOUT_MS, `apuntes ${c}`))),
  ]);
  fuentes.rentab = Object.fromEntries(enCurso.map((o, i) => [o.ccpp_id, aFuente(rentab[i])]));
  const n465f = n465.map(aFuente);
  fuentes.nominas465 = n465f.every((r) => r.ok)
    ? { ok: true, data: n465f.flatMap((r) => r.data) }
    : { ok: false, error: n465f.find((r) => !r.ok)?.error };
  // Nóminas pendientes por persona (para casar las transferencias sin conciliar)
  {
    const mes = hoy.slice(0, 7), mesAnt = calc.mesAnterior(mes);
    fuentes.nominasPendientes = fuentes.nominas465.ok
      ? { ok: true, data: concil.nominasPendientes(fuentes.nominas465.data, fuentes.nominas_mes.ok ? fuentes.nominas_mes.data : {}, [mesAnt, mes]) }
      : { ok: false, error: fuentes.nominas465.error };
  }

  const generado = new Date().toISOString();
  return { ...componer({ fuentes, hoy, generado, tiposBanco }), _base: { fuentes, hoy, generado, tiposBanco } };
}

// Escalera + tarjetas a partir de las fuentes ya leídas. Es cálculo puro y
// rápido: se repite por petición cuando llega un saldo de Pleo puesto a mano,
// sin volver a leer Holded.
// Lo que el cash flow necesita de las fuentes lentas
function extraCashflow(fuentes, hoy) {
  const cfgf = { txt: (k) => { const r = (fuentes.config?.ok ? fuentes.config.data : []).find((x) => String(x.clave || "").trim().toLowerCase() === k); return r && String(r.valor).trim() ? String(r.valor).trim() : null; } };
  cfgf.num = (k) => { const v = cfgf.txt(k); const n = v == null ? null : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const an = fuentes.res_anual;
  const meses = an?.ok ? (an.data.por_mes || []).filter((m) => !m.sin_datos && m.beneficio_real != null) : [];
  const beneficio = an?.ok ? { ok: true, data: { año: an.data.año, meses: meses.length, acumulado: Math.round(meses.reduce((t, m) => t + m.beneficio_real, 0) * 100) / 100 } }
    : { ok: false, error: an?.error };
  // Media de costes generales de los 3 últimos meses cerrados
  const cerrados = an?.ok ? (an.data.por_mes || []).filter((m) => !m.sin_datos && m.mes < Number(hoy.slice(5, 7)) && m.costes_generales != null).slice(-3) : [];
  const gastosFijosMes = cerrados.length ? Math.round(cerrados.reduce((t, m) => t + m.costes_generales, 0) / cerrados.length * 100) / 100 : null;
  // Fecha de fin de cada obra terminada (para la regla de cobro 2 meses + 5/20)
  const finObras = {};
  for (const o of fuentes.pnr_ref?.ok ? fuentes.pnr_ref.data.obras || [] : []) if (o.fecha_fin) finObras[o.obra_id] = String(o.fecha_fin).slice(0, 10);
  return { is2026: cashflow.is2026(cfgf, beneficio), gastosFijosMes, finObras };
}

function componer({ fuentes, hoy, generado, tiposBanco }, opciones = {}) {
  const data = calc.calcularEscalera(fuentes, hoy, generado, opciones);
  const extra = extraCashflow(fuentes, hoy);
  // Sección 9 (tarjetas de Mi panel › Empresa): previsión semanal, alerta
  // patrimonial y umbral del semáforo de «mío hoy».
  data.panel = panel.calcularPanel(fuentes, data, hoy, { extra });
  if (data.panel.aviso_cierre) data.avisos.push(data.panel.aviso_cierre);   // 10.1.4: del 1/11 al 31/12
  // Vista real (todo conciliado): las mismas tarjetas con el ajuste aplicado
  if (data.real) data.real.panel = panel.calcularPanel(fuentes, { ...data, ...data.real }, hoy, { conc: data.ajuste_conciliacion, extra });
  // IS 2026 (D15): fuera de la escalera «antes de IS»; el panel lo resta con
  // el interruptor «después de IS».
  const is = extra.is2026;
  data.linea_is = { id: "D15", concepto: `IS ${hoy.slice(0, 4)} estimado`, importe: is.importe, fiabilidad: is.fiabilidad, fuente: is.fuente, nota: is.nota, fecha_pago: is.fecha };
  for (const k of [data.kpis, data.real?.kpis].filter(Boolean)) {
    k.is_estimado = is.importe;
    k.dinero_empresa_despues_is = is.importe == null || k.dinero_empresa_antes_is == null ? null : Math.round((k.dinero_empresa_antes_is - is.importe) * 100) / 100;
    k.dinero_empresa_prudente_despues_is = is.importe == null || k.dinero_empresa_prudente == null ? null : Math.round((k.dinero_empresa_prudente - is.importe) * 100) / 100;
  }
  // Cash flow de 13 semanas + puntuales hasta julio de 2027 (vista real si la hay)
  const vistaCf = data.real ? { ...data, ...data.real } : data;
  data.cashflow = cashflow.calcularCashflow(fuentes, vistaCf, hoy, data.real ? data.ajuste_conciliacion : null, extra);
  data.cashflow.vista = data.real ? "real" : "contable";
  data.cashflow.simulador = cashflow.baseSimulador(fuentes.pnr_ref);
  // Obras cobradas enteras confirmadas a mano (además de las de la hoja)
  const filaCob = (fuentes.config?.ok ? fuentes.config.data : []).find((r) => String(r.clave || "").trim().toLowerCase() === "obras_cobradas");
  const cobradasCfg = String(filaCob?.valor || "").split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
  // Orden de la cartera según la documentación de cada expediente
  // + fechas de inicio/fin del panel de obras (OT) y las otras obras aceptadas (OO)
  // + la planificación puesta a mano (hoja planificacion_obras)
  const ordenar = (obras) => ordenCartera.aplicarPlanificacion(ordenCartera.completarCartera(
    fuentes.comunidades_doc?.ok ? ordenCartera.ordenarCartera(obras, fuentes.comunidades_doc.data, hoy) : obras,
    { ot: fuentes.ot?.ok ? fuentes.ot.data : null, oo: fuentes.oo?.ok ? fuentes.oo.data : null, hoy, cobradas: cobradasCfg }),
    fuentes.planificacion?.ok ? fuentes.planificacion.data : []);
  // Cuadrillas reales (config_dinero «cuadrillas», p. ej. "2,3") y obra grande
  const cfgTxt = (k) => { const r = (fuentes.config?.ok ? fuentes.config.data : []).find((x) => String(x.clave || "").trim().toLowerCase() === k); return r && String(r.valor).trim() ? String(r.valor).trim() : null; };
  const cuadrillasCfg = cfgTxt("cuadrillas");
  const grandeCfg = cfgTxt("obra_grande_horas") != null && Number.isFinite(Number(cfgTxt("obra_grande_horas"))) ? Number(cfgTxt("obra_grande_horas")) : null;
  // Custodias por obra (cuentas 5610): se entregan a EMASESA el día que empieza la obra
  data.cashflow.custodias_obras = fuentes.custodias?.ok ? (fuentes.custodias.data.comunidades || []).map((c) => ({ ccpp_id: c.ccpp_id || null, comunidad: c.comunidad, en_custodia: c.en_custodia })) : [];
  // Préstamos sin calendario (Araviva): neto por contraparte; no se inventa la fecha
  if (fuentes.prestamos?.ok) {
    const { resumirPrestamos } = require("./lib/prestamos.cjs");
    const pr = resumirPrestamos(fuentes.prestamos.data || [], hoy);
    const grupos = {};
    for (const p of [...pr.recibidos.prestamos, ...pr.concedidos.prestamos].filter((x) => x.activo !== false && !x.con_calendario && Number(x.saldo_vivo) > 0)) {
      const k = String(p.contraparte || p.id).split(/[\s(,·-]+/)[0] || p.id;
      const g = grupos[k] || (grupos[k] = { contraparte: k, recibido: 0, concedido: 0, ids: [] });
      g[p.tipo === "concedido" ? "concedido" : "recibido"] += Number(p.saldo_vivo); g.ids.push(p.id);
    }
    data.cashflow.prestamos_sin_calendario = Object.values(grupos).map((g) => ({ ...g, neto: Math.round((g.recibido - g.concedido) * 100) / 100 }));
  }
  // presupuesto_provisional: si el panel ya trae el importe, sobra la línea de config_dinero
  for (const o of fuentes.pnr_ref?.ok ? fuentes.pnr_ref.data.obras || [] : []) {
    if (o.provisional_sobra) data.avisos.push({ nivel: "ambar", texto: `${o.nombre}: el panel de Guillermo ya trae el presupuesto (${Math.round(o.importe).toLocaleString("es-ES")} € sin IVA). Quita su línea de «presupuesto_provisional» en config_dinero.` });
  }
  if (data.cashflow.simulador.ok) {
    data.cashflow.simulador.obras = ordenar(data.cashflow.simulador.obras);
    data.cashflow.simulador.orden = fuentes.comunidades_doc?.ok ? "documentacion" : "fase";
  }
  // «Real (automático)»: mandos calibrados con lo último de ARA-OS y su serie
  if (data.cashflow.simulador.ok) {
    const filaExcl = (fuentes.config?.ok ? fuentes.config.data : []).find((r) => String(r.clave || "").trim().toLowerCase() === "obras_excluidas_calibracion");
    // fuera de la calibración: las de config y las cobradas confirmadas (sin horas o con horas sin confirmar)
    const excluir = [...String(filaExcl?.valor || "").split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean), ...ordenCartera.COBRADAS_CONFIRMADAS, ...cobradasCfg];
    const cal = simulador.calibrar({ pnr: fuentes.pnr_ref, anual: fuentes.res_anual, hoy, fotoFresca: !!data.real, excluir, cuadrillas: cuadrillasCfg, grande: grandeCfg });
    data.cashflow.simulador.historico.personas_base = cal.mandos.personas;
    data.cashflow.simulador.cuadrillas = cal.mandos.cuadrillas;
    const sim = simulador.simular({ obras: ordenar(cal.obras), historico: data.cashflow.simulador.historico, hoy, mandos: cal.mandos, ivaConocido: simulador.ivaConocido(data.cashflow), conocidas: simulador.obrasConocidas(data.cashflow),
      custodias: data.cashflow.custodias_obras, comisionesD14: data.cashflow.comisiones_sin_fecha });
    const serie = simulador.serieMensual(data.cashflow, sim);
    data.cashflow.automatico = { mandos: cal.mandos, calibracion: cal.calibracion,
      meses: serie.meses.map(({ movs, ...m }) => m), meses_obra: sim.meses_obra, ultimo_cobro: sim.ultimo_cobro,
      horas_perdidas: sim.idle, beneficio_cartera: sim.beneficio_cartera, cartera: sim.cartera, avisos: sim.avisos, iva_trimestres: sim.iva_trimestres };
    data.cashflow.planificacion = { ok: !!fuentes.planificacion?.ok, error: fuentes.planificacion?.ok ? null : fuentes.planificacion?.error || null,
      vigente: fuentes.planificacion?.ok ? ordenCartera.planVigente(fuentes.planificacion.data) : {},
      cambios: fuentes.planificacion?.ok ? fuentes.planificacion.data.slice(-30).reverse() : [] };
  }
  data.cashflow.seguimiento = seguimientoFilas(fuentes.previsiones, fuentes.res_anual);
  if (fuentes.pnr_ref?.viejo_min != null || fuentes.res_anual?.viejo_min != null) data.cashflow.notas.push("Datos de obra o de beneficio anual de una lectura anterior (la última no respondió).");
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

// Filas de la hoja cashflow_previsiones con su desviación (previsto vs real)
function seguimientoFilas(prev, anual) {
  if (!prev?.ok) return { ok: false, error: prev?.error };
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const desv = (p, r) => (p == null || r == null || p === 0 ? null : Math.round((r - p) / Math.abs(p) * 1000) / 10);
  const porMes = Object.fromEntries((anual?.ok ? anual.data.por_mes || [] : []).map((m) => [`${anual.data.año}-${String(m.mes).padStart(2, "0")}`, m]));
  const filas = prev.data.filter((f) => f.mes).map((f) => {
    const a = porMes[String(f.mes)];
    const real = {
      caja: num(f.caja_real),
      facturacion: num(f.facturacion_real) ?? (a && !a.sin_datos ? a.trabajo_realizado : null),
      beneficio: num(f.beneficio_real) ?? (a && !a.sin_datos ? a.beneficio_real : null),
    };
    const previsto = { caja: num(f.caja_fin_mes), facturacion: num(f.facturacion), beneficio: num(f.beneficio) };
    // guardada con el cálculo anterior (sin cuadrillas ni material por obra): no comparable
    let mandos = null; try { mandos = JSON.parse(f.mandos_json || "null"); } catch { mandos = null; }
    const comparable = !!(mandos && mandos.hpp != null);
    return { mes: String(f.mes), guardado: f.guardado, escenario: f.escenario, previsto, real, comparable,
      desviacion_pct: comparable ? { caja: desv(previsto.caja, real.caja), facturacion: desv(previsto.facturacion, real.facturacion), beneficio: desv(previsto.beneficio, real.beneficio) } : { caja: null, facturacion: null, beneficio: null } };
  }).sort((a, b) => a.mes.localeCompare(b.mes));
  return { ok: true, filas };
}

// Día 1 (o el primer cálculo del mes): se guarda la previsión del mes con el
// escenario automático, y en la fila del mes anterior la caja real (la caja
// propia de hoy) y lo real de facturación y beneficio. Solo una vez por mes.
let _prevGuardada = null;
async function guardarPrevision(data, hoy) {
  const mes = hoy.slice(0, 7);
  const auto = data.cashflow?.automatico;
  if (_prevGuardada === mes || !auto || !data.cashflow?.seguimiento?.ok) return;
  const filas = data.cashflow.seguimiento.filas;
  const sheets = getSheetsClient();
  const id = process.env.GOOGLE_SHEETS_ID;
  await asegurarPestana(HOJA_PREV, PREV_HEADERS);
  if (!filas.some((f) => f.mes === mes)) {
    const m = auto.meses.find((x) => x.mes === mes) || {};
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: `${HOJA_PREV}!A:J`, valueInputOption: "RAW",
      requestBody: { values: [[mes, new Date().toISOString(), "automatico", m.saldo ?? "", m.produccion ?? "", m.beneficio ?? "", "", "", "", JSON.stringify(auto.mandos)]] } });
  }
  const ant = calc.mesAnterior(mes);
  const iAnt = filas.findIndex((f) => f.mes === ant);
  if (iAnt >= 0 && filas[iAnt].real.caja == null && data.cashflow.inicial?.propio != null) {
    // fila en la hoja = posición en la lista leída + 2 (cabecera); se relee para no fallar por el orden
    const r = await leerPestana(HOJA_PREV, PREV_HEADERS, { crear: false });
    const n = (r.filas || []).findIndex((f) => String(f.mes) === ant);
    if (n >= 0) {
      const f = filas[iAnt];
      await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `${HOJA_PREV}!G${n + 2}:I${n + 2}`, valueInputOption: "RAW",
        requestBody: { values: [[data.cashflow.inicial.propio, f.real.facturacion ?? "", f.real.beneficio ?? ""]] } });
    }
  }
  _prevGuardada = mes;
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

  // ── Foto de movimientos del banco sin conciliar ─────────────────
  // POST: la rutina diaria (Cowork) sube { generado, cuenta, last_sync_at,
  // movimientos: [{ id, date, amount, description, pendingToReconcile }] }.
  // Se guarda en la hoja banco_sin_conciliar (una fila por foto). GET: la
  // última foto. Nunca se escribe en Holded.
  const RUTA_FOTO = "/api/ara-os/holded/movimientos-sin-conciliar";
  app.options(RUTA_FOTO, (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.status(204).end();
  });
  app.get(RUTA_FOTO, async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try {
      const r = await leerUltimaFoto();
      if (!r.ok) return res.status(500).json(r);
      const f = r.data;
      res.json({ ok: true, foto: f, resumen: f ? { generado: f.generado, n_movimientos: f.movimientos.length,
        total: Math.round(f.movimientos.reduce((s, m) => s + m.pendingToReconcile, 0) * 100) / 100 } : null });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(RUTA_FOTO, require("express").json({ limit: "512kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const v = validarFoto(req.body);
    if (v.error) return res.status(400).json({ ok: false, error: v.error });
    const f = v.foto;
    const json = JSON.stringify(f.movimientos);
    if (json.length > 49000) return res.status(413).json({ ok: false, error: "La foto no cabe en una celda (más de 49.000 caracteres)" });
    const total = Math.round(f.movimientos.reduce((s, m) => s + m.pendingToReconcile, 0) * 100) / 100;
    try {
      await asegurarPestana(HOJA_FOTO, FOTO_HEADERS);
      await getSheetsClient().spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${HOJA_FOTO}!A:G`,
        valueInputOption: "RAW",
        requestBody: { values: [[f.generado, new Date().toISOString(), f.cuenta || "", f.last_sync_at || "", f.movimientos.length, total, json]] },
      });
      _foto = { ...f, recibido: new Date().toISOString() };
      if (_cache) _cache.ts = 0;                       // la próxima petición recalcula con la foto nueva
      res.json({ ok: true, guardada: { generado: f.generado, n_movimientos: f.movimientos.length, total } });
    } catch (e) {
      console.error("[movimientos-sin-conciliar]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Orden de obras a mano (calendario del cash flow) ─────────────
  // GET: lo vigente y los últimos cambios. POST { obra_id, posicion?,
  // fecha_inicio_fija?, cuadrilla?, nota, usuario } añade una fila a
  // planificacion_obras (registro: nunca se borra). obra_id «TODAS» = volver
  // al orden automático. Recalcula al momento con las fuentes ya leídas.
  const RUTA_PLAN = "/api/ara-os/planificacion-obras";
  app.options(RUTA_PLAN, (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.status(204).end();
  });
  app.get(RUTA_PLAN, async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try {
      const r = await leerPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS);
      res.json({ ok: true, vigente: ordenCartera.planVigente(r.filas), cambios: (r.filas || []).slice().reverse() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(RUTA_PLAN, require("express").json({ limit: "16kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const b = req.body || {};
    const errs = ordenCartera.validarCambioPlan(b);
    if (errs.length) return res.status(400).json({ ok: false, error: errs.join("; ") });
    const fila = { obra_id: String(b.obra_id).trim(), posicion: b.posicion ?? "", fecha_inicio_fija: b.fecha_inicio_fija || "", cuadrilla: b.cuadrilla ?? "",
                   nota: String(b.nota).trim(), usuario: String(b.usuario).trim(), fecha: new Date().toISOString() };
    try {
      await guardarFilasPlan([fila]);
      res.json({ ok: true, fila });
    } catch (e) {
      console.error("[planificacion-obras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Planificación por cuadrillas (pestaña Planificación) ──────────
  // GET ?modo=real|simulacion&borrador={json}&tam=2,3&conf={json}&alternativas=1
  // La misma cola que el cash flow, en jornadas y SIN euros (para nadie).
  const RUTA_CAL = "/api/ara-os/planificacion-obras/calendario";
  const cfgFila = (k) => (_cache?.data?._base?.fuentes?.config?.ok ? _cache.data._base.fuentes.config.data : []).find((x) => String(x.clave || "").trim().toLowerCase() === k);
  app.options(RUTA_CAL, (req, res) => { cors(res); res.status(204).end(); });
  app.get(RUTA_CAL, async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try {
      if (!_cache) await refrescar(process.env.ADMIN_TOKEN || String(req.query.token));
      const json = (k) => { if (!req.query[k]) return null; try { return JSON.parse(String(req.query[k])); } catch { throw Object.assign(new Error(`${k} no es JSON`), { status: 400 }); } };
      const tam = req.query.tam ? String(req.query.tam).split(",").map(Number).filter((n) => n > 0) : null;
      const cf = _cache.data.cashflow;
      const r = planCalendario.calendarioPlan({ cf, hoy: cf.hoy, borrador: json("borrador"), conf: json("conf"), tam, alternativas: String(req.query.alternativas || "") === "1",
        modo: req.query.modo === "real" ? "real" : "simulacion", nombresCuadrillas: planCalendario.personasPorCuadrilla(cfgFila("cuadrillas_personas")?.valor) });
      res.json({ ...r, generado: _cache.data.generado, cache: { edad_s: Math.round((Date.now() - _cache.ts) / 1000) } });
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ ok: false, error: e.message });
      console.error("[planificacion-obras/calendario]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Aplicar una configuración probada: puesto y cuadrilla de cada obra no
  // fijada, una fila por obra en planificacion_obras con la misma nota
  const RUTA_LOTE = "/api/ara-os/planificacion-obras/lote";
  app.options(RUTA_LOTE, (req, res) => { cors(res); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.status(204).end(); });
  app.post(RUTA_LOTE, require("express").json({ limit: "64kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const b = req.body || {};
    const cambios = Array.isArray(b.cambios) ? b.cambios : [];
    const errs = ordenCartera.validarCambioPlan({ obra_id: "lote", nota: b.nota, usuario: b.usuario });
    if (!cambios.length) errs.push("no hay cambios");
    if (errs.length) return res.status(400).json({ ok: false, error: errs.join("; ") });
    const ahora = new Date().toISOString();
    const filas = cambios.map((c) => ({ obra_id: String(c.obra_id), posicion: c.posicion ?? "", fecha_inicio_fija: "", cuadrilla: c.cuadrilla ?? "", nota: String(b.nota).trim(), usuario: String(b.usuario).trim(), fecha: ahora }));
    try { await guardarFilasPlan(filas); res.json({ ok: true, n: filas.length }); }
    catch (e) { console.error("[planificacion-obras/lote]", e); res.status(500).json({ ok: false, error: e.message }); }
  });

  // Quién va en cada cuadrilla: config_dinero «cuadrillas» (tamaños) y
  // «cuadrillas_personas» (nombres), con nota y registro en planificacion_obras
  const RUTA_CQ = "/api/ara-os/planificacion-obras/cuadrillas";
  app.options(RUTA_CQ, (req, res) => { cors(res); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.status(204).end(); });
  app.post(RUTA_CQ, require("express").json({ limit: "16kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const b = req.body || {};
    const q = Array.isArray(b.quienes) ? b.quienes.map((xs) => (Array.isArray(xs) ? xs.map((n) => String(n).trim()).filter(Boolean) : [])) : [];
    const errs = ordenCartera.validarCambioPlan({ obra_id: "CUADRILLAS", nota: b.nota, usuario: b.usuario });
    if (q.length < 1 || q.some((xs) => !xs.length)) errs.push("cada cuadrilla necesita al menos una persona");
    if (errs.length) return res.status(400).json({ ok: false, error: errs.join("; ") });
    const tam = q.map((xs) => xs.length).join(",");
    try {
      await escribirConfig({ cuadrillas: tam, cuadrillas_personas: planCalendario.textoPersonas(q) });
      await guardarFilasPlan([{ obra_id: "CUADRILLAS", posicion: "", fecha_inicio_fija: "", cuadrilla: tam, nota: `${String(b.nota).trim()} · ${planCalendario.textoPersonas(q)}`, usuario: String(b.usuario).trim(), fecha: new Date().toISOString() }], false);
      if (_cache) _cache.ts = 0;   // los tamaños cambian el cálculo: recalcular
      res.json({ ok: true, cuadrillas: tam });
    } catch (e) { console.error("[planificacion-obras/cuadrillas]", e); res.status(500).json({ ok: false, error: e.message }); }
  });

  async function guardarFilasPlan(filas, recalcular = true) {
    await asegurarPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS);
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${ordenCartera.HOJA_PLAN}!A:G`,
      valueInputOption: "RAW",
      requestBody: { values: filas.map((f) => ordenCartera.PLAN_HEADERS.map((h) => f[h] ?? "")) },
    });
    if (recalcular && _cache?.data?._base?.fuentes) {
      const base = _cache.data._base;
      const prev = base.fuentes.planificacion?.ok ? base.fuentes.planificacion.data : [];
      base.fuentes.planificacion = { ok: true, data: [...prev, ...filas] };
      _cache = { ts: _cache.ts, data: { ...componer(base), _base: base } };
    }
  }
  // Escribe (o añade) claves en config_dinero
  async function escribirConfig(valores) {
    await asegurarPestana("config_dinero", CONFIG_HEADERS);
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "config_dinero!A1:C" });
    const filas = r.data.values || [];
    for (const [k, v] of Object.entries(valores)) {
      const i = filas.findIndex((f, j) => j > 0 && String(f[0] || "").trim().toLowerCase() === k);
      if (i > 0) await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `config_dinero!B${i + 1}`, valueInputOption: "RAW", requestBody: { values: [[v]] } });
      else await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "config_dinero!A:C", valueInputOption: "RAW", requestBody: { values: [[k, v, "Planificación (quién va en cada cuadrilla)"]] } });
    }
  }

  // Recalcula en segundo plano (una sola vez aunque lleguen varias peticiones).
  // Usa el ADMIN_TOKEN del propio servidor para las llamadas internas.
  function refrescar(token, force = false) {
    if (!_enCurso) {
      _enCurso = construir(token, force)
        .then((data) => {
          _cache = { ts: Date.now(), data };
          // Seguimiento previsto vs real: no bloquea la respuesta
          guardarPrevision(data, new Date().toISOString().slice(0, 10)).catch((e) => console.error("[ara-os-dinero-empresa] previsión del mes:", e.message));
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
module.exports.validarFoto = validarFoto;
module.exports.cuadreCuenta = cuadreCuenta;
