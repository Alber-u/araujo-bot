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
const custodiaHolded = require("./lib/custodia-holded.cjs");
const { PRESTAMOS_HEADERS } = require("./lib/prestamos.cjs");
const calc = require("./lib/dinero-empresa-calculo.cjs");
const concil = require("./lib/conciliacion-provisional.cjs");
const cashflow = require("./lib/cashflow-calculo.cjs");
const simulador = require("./lib/simulador-caja.cjs");
const ordenCartera = require("./lib/orden-cartera.cjs");
const planCalendario = require("./lib/planificacion-calendario.cjs");
const festivosLib = require("./lib/festivos.cjs");
const jornadaLib = require("./lib/jornada.cjs");
const ccppAlias = require("./lib/ccpp-alias.cjs");
// Seguimiento previsto vs real (punto 8): una fila por mes con la previsión
// del día 1 y, al cerrar el mes, lo real.
const HOJA_PREV = "cashflow_previsiones";
const PREV_HEADERS = ["mes", "guardado", "escenario", "caja_fin_mes", "facturacion", "beneficio", "caja_real", "facturacion_real", "beneficio_real", "mandos_json"];
const { asegurarPestana, getSheetsClient } = require("./lib/sheets-tabla.cjs");
const panel = require("./lib/panel-empresa-calculo.cjs");

const VERSION = "0.8.0";
const HOLDED_V2 = "https://api.holded.com/api/v2";
const CACHE_MS = 60 * 1000;             // respuesta «fresca»
const CACHE_STALE_MS = 30 * 60 * 1000;
// Planificación (06/10/2026): la carga que sirve caduca al cambiar de día (Madrid) y como mucho a los 12 min;
// un fichaje o un cambio en Certificaciones la marca para renovar. Al cambiar de día se espera la carga nueva
// hasta ESPERA_DIA_MS; si no llega, se recalcula con lo leído para hoy (y se avisa con «Actualizado a las…»)
const PLAN_MAX_MS = 12 * 60 * 1000;
const ESPERA_DIA_MS = 25 * 1000;
let _planSucio = false;
// Registros de tiempo: un fichaje guardado relee los registros y renueva la carga en la siguiente petición
function registrosCambiados() { _regs = null; _planSucio = true; }   // hasta aquí se sirve al momento y se recalcula por detrás
// DINERO_ESCALA_TIEMPO: solo para la prueba local del bucle (acorta las esperas)
const ESCALA_T = Number(process.env.DINERO_ESCALA_TIEMPO) > 0 ? Number(process.env.DINERO_ESCALA_TIEMPO) : 1;
const RENTAB_TIMEOUT_MS = 45 * 1000 * ESCALA_T;
const TIMEOUT_MS = 30 * 1000 * ESCALA_T;
const TIMEOUT_LARGO_MS = 90 * 1000 * ESCALA_T;   // clientes-pendientes lee todo el histórico la primera vez
const CONFIG_HEADERS = ["clave", "valor", "nota"];
const CUENTA_BANCO_2 = "57200006";      // segunda cuenta corriente del Santander
// Foto diaria de los movimientos del banco sin conciliar (la sube la rutina de
// Cowork con la sesión de Holded: la API pública no los da). Una fila por foto.
const HOJA_FOTO = "banco_sin_conciliar";
const FOTO_HEADERS = ["generado", "recibido", "cuenta", "last_sync_at", "n_movimientos", "total", "movimientos_json"];
const NOMINAS_MES_HEADERS = ["periodo", "importe", "updated_at", "updated_by", "indirectos_eur", "detalle_json"];
const DIAS_465 = 120;                   // apuntes de la 465 para las nóminas pendientes por persona
let _foto = null;                       // última foto leída/guardada (caché)
// Última sincronización del banco (lastSyncAt de /internal/banking/accounts, ES81). La API pública de Holded no la
// da: la sube la rutina de Cowork (con la sesión de Holded) por POST /banco-sync, sin tener que subir otra foto.
const HOJA_SYNC = "banco_sync";
const SYNC_HEADERS = ["recibido", "cuenta", "last_sync_at", "saldo", "saldo_extracto", "ultimo_movimiento"];
let _bancoSync = null;
// Fuentes lentas del cash flow (recorren posicion-neta-real): 30 min de caché
// y, si fallan, el último dato bueno.
const LENTO_MS = 30 * 60 * 1000, TIMEOUT_LENTO_MS = 150 * 1000;
const ESPERA_LENTO_MS = 20 * 1000 * ESCALA_T;      // la escalera no espera más: la lectura sigue por detrás
const _enVuelo = {};
// Caché por fuente (04/10/2026: tras el despliegue, 1.431 peticiones a Holded
// en 6 min). Cada fuente de Holded:
//   · si tiene un dato bueno de menos de su TTL, se usa sin llamar;
//   · si ya se está leyendo, se espera a ESA lectura (nunca dos a la vez);
//   · se espera como mucho «espera»; si no llega, la lectura SIGUE por detrás
//     (no se aborta: su resultado queda guardado para la siguiente carga) y
//     mientras tanto se usa el último dato bueno, marcado «viejo».
// Así un timeout propio no vuelve a lanzar cientos de llamadas.
const _fuente = {};          // clave → { ts, r } (último dato bueno)
const LECTURA_MAX_MS = 10 * 60 * 1000;   // límite duro de una lectura por detrás
// Una lectura que acaba en error no se repite hasta FALLO_PAUSA_MS después
// (antes, cada recálculo volvía a lanzar posicion-neta-real y la anual enteras)
const _fallo = {};           // clave → { ts, error }
const FALLO_PAUSA_MS = 5 * 60 * 1000;
async function cacheFuente(clave, { ttl, espera }, fn) {
  const c = _fuente[clave];
  if (c && Date.now() - c.ts < ttl) return c.r;
  const f = _fallo[clave];
  if (!_enVuelo[clave] && f && Date.now() - f.ts < FALLO_PAUSA_MS) {
    if (c) return { ...c.r, viejo_min: Math.round((Date.now() - c.ts) / 60000), error_ultimo: f.error };
    return { ok: false, error: `${f.error} (se vuelve a intentar a partir de las ${new Date(f.ts + FALLO_PAUSA_MS).toISOString().slice(11, 16)} UTC)` };
  }
  if (!_enVuelo[clave]) {
    _enVuelo[clave] = Promise.resolve().then(fn).catch((e) => ({ ok: false, error: e.message }))
      .then((r) => { if (r?.ok) { _fuente[clave] = { ts: Date.now(), r }; delete _fallo[clave]; } else _fallo[clave] = { ts: Date.now(), error: r?.error || "error" }; return r; })
      .finally(() => { delete _enVuelo[clave]; });
  }
  let t;
  const r = await Promise.race([_enVuelo[clave], new Promise((res) => { t = setTimeout(() => res(null), espera); t.unref?.(); })]).finally(() => clearTimeout(t));
  if (r?.ok) return r;
  if (c) return { ...c.r, viejo_min: Math.round((Date.now() - c.ts) / 60000), error_ultimo: r ? r.error : "sigue leyendo" };
  if (r) return r;   // error de verdad (Holded 429/5xx, HTTP…)
  return { ok: false, pendiente: true, error: `${clave}: leyendo de Holded (más de ${Math.round(espera / 1000)} s; sigue por detrás)` };
}
const lecturasEnVuelo = () => Object.values(_enVuelo);
// TTL por fuente: lo que cambia poco se lee poco
const TTL = { tesoreria: 5 * 60e3, clientes: 30 * 60e3, custodias: 15 * 60e3, obligaciones: 15 * 60e3, ot: 2 * 60e3, oo: 10 * 60e3, iva: 60 * 60e3,
              invoices: 15 * 60e3, banco: 10 * 60e3, compras: 15 * 60e3, pnr: 12 * 3600e3, anual: 6 * 3600e3, ledger: 60 * 60e3, rentab: 30 * 60e3, a465: 30 * 60e3 };
async function lento(clave, fn, ttl = LENTO_MS) {
  return cacheFuente(clave, { ttl, espera: ESPERA_LENTO_MS }, fn);
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

async function leerBancoSync() {
  if (_bancoSync) return { ok: true, data: _bancoSync };
  const r = await leerPestana(HOJA_SYNC, SYNC_HEADERS, { crear: false });
  if (r.no_existe || !r.filas.length) return { ok: true, data: null };
  const ult = r.filas.filter((x) => x.last_sync_at && !isNaN(Date.parse(x.last_sync_at))).sort((a, b) => Date.parse(a.last_sync_at) - Date.parse(b.last_sync_at)).pop();
  if (!ult) return { ok: true, data: null };
  const n = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  _bancoSync = { last_sync_at: new Date(ult.last_sync_at).toISOString(), cuenta: String(ult.cuenta || "") || null, saldo: n(ult.saldo), recibido: String(ult.recibido || ""),
                 saldo_extracto: n(ult.saldo_extracto), ultimo_movimiento: /^\d{4}-\d{2}-\d{2}/.test(String(ult.ultimo_movimiento || "")) ? String(ult.ultimo_movimiento).slice(0, 10) : null };
  return { ok: true, data: _bancoSync };
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
const REINTENTO_MS = 60 * 1000 * ESCALA_T;
const REINTENTO_MAX_MS = 15 * 60 * 1000;
let _fallosSeguidos = 0;
let _esperaLecturas = null; // recálculo pendiente de que terminen las lecturas por detrás
const COLA_MAX_REINTENTO = 20;   // con más peticiones en cola no se lanza un reintento
const holdedEmbudo = require("./lib/holded-fetch.cjs");
// ¿Ha fallado alguna fuente? (data.fuentes: nombre → "ok" | error)
const fuenteCaida = (data) => Object.values(data?.fuentes || {}).some((v) => v !== "ok");
let _enCurso = null;        // promesa compartida si llegan dos peticiones a la vez
// Última carga COMPLETA (todas las fuentes "ok"). Si Holded da 429/503 se sirve
// esta, con el aviso «datos de las HH:MM (Holded no responde)», en vez de
// calcular con huecos. Se guarda también en disco para sobrevivir a un reinicio.
const ULTIMO_COMPLETO_FILE = process.env.DINERO_ULTIMO_COMPLETO_FILE || require("path").join(require("os").tmpdir(), "ara-os-dinero-ultimo-completo.json");
const ULTIMO_COMPLETO_MAX_MS = 7 * 24 * 60 * 60 * 1000;   // más viejo que una semana no se sirve
let _ultimoCompleto = null; // { ts, data }
let _ultimoConstruir = 0;   // cuándo empezó el último cálculo completo (para frenar force=1)
const FORCE_MIN_MS = 2 * 60 * 1000;   // un force=1 antes de 2 min desde el último cálculo no vuelve a Holded
// Render borra el disco en cada despliegue: la copia va también, comprimida, a
// una pestaña propia (dinero_ultima_carga, una fila), como mucho cada 30 min.
const HOJA_ULTIMA = "dinero_ultima_carga";
const ULTIMA_HEADERS = ["generado", "ts", "partes", "p1", "p2", "p3", "p4"];
const ULTIMA_HOJA_MS = 30 * 60 * 1000;
let _ultimaHojaTs = 0;
async function cargarUltimoCompleto() {
  const vale = (j) => j?.ts && j?.data && Date.now() - j.ts < ULTIMO_COMPLETO_MAX_MS && (!_ultimoCompleto || j.ts > _ultimoCompleto.ts);
  try {
    const j = JSON.parse(require("fs").readFileSync(ULTIMO_COMPLETO_FILE, "utf8"));
    if (vale(j)) _ultimoCompleto = j;
  } catch { /* no hay copia en disco */ }
  if (_ultimoCompleto) return;
  try {
    const r = await leerPestana(HOJA_ULTIMA, ULTIMA_HEADERS, { crear: false });
    const fila = r.filas?.[0];
    if (!fila?.ts) return;
    const b64 = ["p1", "p2", "p3", "p4"].slice(0, Number(fila.partes) || 1).map((k) => String(fila[k] || "")).join("");
    const j = { ts: Number(fila.ts), data: JSON.parse(require("zlib").gunzipSync(Buffer.from(b64, "base64")).toString("utf8")) };
    if (vale(j)) { _ultimoCompleto = j; _ultimaHojaTs = j.ts; }
  } catch (e) { console.error("[ara-os-dinero-empresa] leer la última carga completa:", e.message); }
}
function guardarUltimoCompleto(ts, data) {
  const { _base, ...pub } = data;   // sin las fuentes en bruto (facturas…): solo lo que ve el panel
  _ultimoCompleto = { ts, data: pub };
  require("fs").promises.writeFile(ULTIMO_COMPLETO_FILE, JSON.stringify(_ultimoCompleto))
    .catch((e) => console.error("[ara-os-dinero-empresa] copia de la última carga completa:", e.message));
  if (ts - _ultimaHojaTs < ULTIMA_HOJA_MS || !process.env.GOOGLE_SHEETS_ID) return;
  _ultimaHojaTs = ts;
  (async () => {
    const b64 = require("zlib").gzipSync(JSON.stringify(pub)).toString("base64");
    const partes = b64.match(/[\s\S]{1,45000}/g) || [];
    if (partes.length > 4) throw new Error(`no cabe (${b64.length} caracteres)`);
    await asegurarPestana(HOJA_ULTIMA, ULTIMA_HEADERS);
    await getSheetsClient().spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${HOJA_ULTIMA}!A2:G2`, valueInputOption: "RAW",
      requestBody: { values: [[pub.generado || new Date(ts).toISOString(), String(ts), partes.length, ...[0, 1, 2, 3].map((i) => partes[i] || "")]] },
    });
  })().catch((e) => console.error("[ara-os-dinero-empresa] guardar la última carga completa en la hoja:", e.message));
}
// Qué se sirve: lo último calculado si está completo; si le faltan fuentes y
// hay una carga completa guardada (de menos de una semana), esa, marcada de_cache.
// Si las fuentes que faltan solo siguen leyéndose (no es un error de Holded), el motivo es
// «actualizando»: se sirve la última completa mientras termina la carga.
function aServir(cache) {
  if (!cache || !fuenteCaida(cache.data)) return cache;
  const u = _ultimoCompleto;
  if (!u || Date.now() - u.ts > ULTIMO_COMPLETO_MAX_MS) return cache;
  const caidas = Object.entries(cache.data.fuentes || {}).filter(([, v]) => v !== "ok").map(([k, v]) => ({ fuente: k, error: String(v).slice(0, 200) }));
  const actualizando = caidas.every((c) => /sigue por detrás|sigue leyendo/.test(c.error));
  return deUltimo(actualizando ? "actualizando" : "Holded no responde", { fuentes_caidas: caidas, intento: new Date(cache.ts).toISOString() });
}
// La última carga completa, marcada de_cache (null si no hay o es de hace más de una semana)
function deUltimo(motivo, extra = {}) {
  const u = _ultimoCompleto;
  if (!u || Date.now() - u.ts > ULTIMO_COMPLETO_MAX_MS) return null;
  return { ts: u.ts, data: { ...u.data, de_cache: { generado: u.data.generado || new Date(u.ts).toISOString(), ts: u.ts, motivo, actualizando: motivo === "actualizando", fuentes_caidas: [], ...extra } } };
}
let _cargaUltimo = null;   // lectura de la última carga completa al arrancar (disco u hoja)

// el día de Madrid, no el de UTC (entre las 00:00 y las 02:00 UTC sigue en ayer) · 06/10/2026
const { hoyMadrid } = require("./lib/fecha-madrid.cjs");
const hoyISO = () => hoyMadrid();

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
// Obras privadas: horas registradas y último día con horas (registros_tiempo, en el mismo proceso
// y con su caché). Planificación las pone en cola y deja fuera las que llevan 14 días sin horas.
async function conHorasOO(r) {
  if (!r?.ok) return r;
  try {
    const rt = require("./ara-os-registros-tiempo.cjs");
    const [tot, ult] = await Promise.all([rt.getHorasAcumuladasMap(), rt.getUltimaFechaHorasMap()]);
    const GRUPOS = require("./lib/orden-cartera.cjs").GRUPOS_OO;
    for (const o of r.data?.obras || []) {
      const ks = [...new Set([o.obra_id, o.codigo_ot, o.nombre].map((k) => String(k || "").trim()).filter(Boolean))];
      // obra de varias OO (Urbano Orad): también su parte de lo fichado en «Urbano Orad 13-15» (06/10/2026)
      const g = GRUPOS.find((x) => x.ids.includes(o.obra_id));
      const deGrupo = g ? (Number(tot[g.nombre]) || 0) / g.ids.length : 0;
      o.horas_registradas_rt = Math.round((ks.reduce((t, k) => t + (Number(tot[k]) || 0), 0) + deGrupo) * 100) / 100;
      o.ultima_hora = [...ks, ...(g ? [g.nombre] : [])].map((k) => ult[k]).filter(Boolean).map((f) => String(f).slice(0, 10)).sort().pop() || null;
    }
  } catch (e) { console.warn("[dinero-empresa] horas de obras privadas:", e.message); }
  return r;
}

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
async function rentabObra(ccppId, token) {
  return cacheFuente(`rentab_${ccppId}`, { ttl: TTL.rentab, espera: RENTAB_TIMEOUT_MS },
    () => local(`/api/ara-os/holded/rentabilidad-obra/${encodeURIComponent(ccppId)}`, token, {}, LECTURA_MAX_MS));
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
  const cont = await cacheFuente(`ledger_${cuenta}_${hasta}`, { ttl: TTL.ledger, espera: TIMEOUT_LARGO_MS }, () => saldoContableCuenta(cuenta, hasta, true));
  if (!cont.ok) return { ok: false, error: cont.error };
  return { ok: true, data: { saldo_banco: Number(cta.saldo), saldo_movimientos: cont.data.saldo, cuenta, apuntes: cont.data.apuntes, ultimo_apunte: cont.data.ultimo_apunte } };
}

async function construir(token, force) {
  const t0 = Date.now(), p0 = holdedEmbudo.stats().peticiones;
  const data = await construirFuentes(token, force);
  // cuántas llamadas a Holded ha costado esta carga (incluye las lecturas por detrás que coincidan)
  data.holded = { peticiones: holdedEmbudo.stats().peticiones - p0, segundos: Math.round((Date.now() - t0) / 1000), lecturas_por_detras: lecturasEnVuelo().length };
  return data;
}
async function construirFuentes(token, force) {
  const hoy = hoyISO();
  const manana = calc.sumarDias(hoy, 1);   // end_date de Holded excluye ese día
  const iva = calc.periodoIvaSinLiquidar(hoy);
  const holded = require("./ara-os-holded.cjs");
  // force=1 solo salta la caché de ESTE cálculo: nunca se encadena a las
  // subllamadas (cada una tiene su caché y su llamada a Holded).
  // (08/10/2026) salvo el banco: «Recalcular» vuelve a leer la foto del extracto y lo que sube la rutina (hojas),
  // la tesorería y el libro de la 572, para que T1 y T3 salgan del mismo momento
  if (force) {
    _foto = null; _bancoSync = null;
    for (const k of Object.keys(_fuente)) if (k === "tesoreria" || k.startsWith("ledger_")) delete _fuente[k];
  }
  const f = {};

  // Primera tanda, todo en paralelo
  const nombres = ["tesoreria", "clientes", "custodias", "obligaciones", "ot", "oo", "iva", "invoices", "prestamos", "config", "tags", "banco", "compras", "foto", "nominas_mes", "pnr_ref", "res_anual", "previsiones", "comunidades_doc", "planificacion", "expedientes", "certif"];
  const [ya, ma] = hoy.split("-").map(Number);
  const ref = ma === 1 ? { año: ya - 1, mes: 12 } : { año: ya, mes: ma - 1 };   // último mes cerrado
  const res = await Promise.allSettled([
    cacheFuente("tesoreria", { ttl: TTL.tesoreria, espera: TIMEOUT_MS }, () => local("/api/ara-os/holded/tesoreria", token, {}, LECTURA_MAX_MS)),
    cacheFuente("clientes", { ttl: TTL.clientes, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/holded/clientes-pendientes", token, f, LECTURA_MAX_MS)),
    cacheFuente("custodias", { ttl: TTL.custodias, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/custodias", token, {}, LECTURA_MAX_MS)),
    cacheFuente("obligaciones", { ttl: TTL.obligaciones, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/obligaciones", token, f, LECTURA_MAX_MS)),
    cacheFuente("ot", { ttl: TTL.ot, espera: TIMEOUT_MS }, () => local("/api/ara-os/ordenes-trabajo", token, {}, LECTURA_MAX_MS)),
    cacheFuente("oo", { ttl: TTL.oo, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/obras-otras", token, {}, LECTURA_MAX_MS).then(conHorasOO)),
    cacheFuente(`iva_${iva.desde}_${iva.hasta}`, { ttl: TTL.iva, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/holded/iva-trimestre", token, { desde: iva.desde, hasta: iva.hasta }, LECTURA_MAX_MS)),
    cacheFuente("invoices", { ttl: TTL.invoices, espera: TIMEOUT_LARGO_MS }, () => holded.obtenerInvoices()
      .then((r) => (r?.error ? { ok: false, error: r.error }
        : r?.incompleto ? { ok: false, error: `facturas Holded cortadas a medias (${r.error_parcial})` }
        : { ok: true, data: r.docs || [] }))),
    conTimeout(leerPestana("prestamos", PRESTAMOS_HEADERS), TIMEOUT_MS, "hoja prestamos")
      .then((r) => ({ ok: true, data: r.filas, faltan: r.faltan })),
    // toda la hoja (config_dinero!A:C) por posición, la misma lectura que presupuestos y certificaciones (08/10/2026)
    conTimeout(asegurarPestana("config_dinero", CONFIG_HEADERS).then(() => require("./lib/config-dinero.cjs").leerConfigDinero()), TIMEOUT_MS, "hoja config_dinero")
      .then((r) => ({ ok: true, data: r.filas })),
    conTimeout(leerPestana("comunidades_tags_holded", TAGS_HEADERS, { crear: false }), TIMEOUT_MS, "hoja comunidades_tags_holded")
      .then((r) => {
        const m = {};
        for (const t of r.filas) if (String(t.borrado).toUpperCase() !== "TRUE" && t.ccpp_id && t.tag) (m[t.ccpp_id] = m[t.ccpp_id] || []).push(String(t.tag));
        return { ok: true, data: m };
      }),
    // Las dos cuentas corrientes: nóminas y recibos pueden salir de cualquiera.
    // Si la segunda falla, se sigue con la principal (lo dice data.banco_cuentas).
    cacheFuente(`banco_${hoy}`, { ttl: TTL.banco, espera: TIMEOUT_LARGO_MS }, () => Promise.all([
      apuntesCuenta(calc.CUENTA_BANCO, calc.sumarDias(hoy, -75), manana),
      apuntesCuenta(CUENTA_BANCO_2, calc.sumarDias(hoy, -75), manana).catch((e) => ({ ok: false, error: e.message })),
    ]).then(([a, b]) => (!a.ok ? a : { ok: true, data: [...a.data, ...(b.ok ? b.data : [])], cuentas: b.ok ? [calc.CUENTA_BANCO, CUENTA_BANCO_2] : [calc.CUENTA_BANCO], error_cuenta_2: b.ok ? null : b.error }))),
    cacheFuente("compras", { ttl: TTL.compras, espera: TIMEOUT_LARGO_MS }, () => local("/api/ara-os/holded/compras-pendientes", token, {}, LECTURA_MAX_MS)),   // vencimientos para la previsión semanal
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
    // mes cerrado y serie del año: se calculan una vez y se guardan (12 h y 6 h)
    lento(`pnr_${ref.año}_${ref.mes}`, () => local("/api/ara-os/holded/posicion-neta-real", token, { año: String(ref.año), mes: String(ref.mes) }, LECTURA_MAX_MS), TTL.pnr),
    lento(`anual_${ya}`, () => local("/api/ara-os/holded/resultado-real-anual", token, { año: String(ya) }, LECTURA_MAX_MS), TTL.anual),
    conTimeout(leerPestana(HOJA_PREV, PREV_HEADERS, { crear: false }), TIMEOUT_MS, `hoja ${HOJA_PREV}`).then((r) => ({ ok: true, data: r.filas || [] })),
    // Documentación de cada expediente (hoja de comunidades, solo lectura): orden del calendario
    conTimeout(getSheetsClient().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "comunidades!A2:BO", valueRenderOption: "UNFORMATTED_VALUE" }), TIMEOUT_MS, "hoja comunidades")
      .then((r) => ({ ok: true, data: r.data.values || [] })),
    // Orden de obras puesto a mano (calendario del cash flow; también para Planificación)
    conTimeout(leerPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS), TIMEOUT_MS, `hoja ${ordenCartera.HOJA_PLAN}`).then((r) => ({ ok: true, data: r.filas || [] })),
    // Contratos y pagos de cada piso (expediente de Guillermo, solo lectura): «Lista para empezar»
    cacheFuente("expedientes", { ttl: 10 * 60e3, espera: TIMEOUT_MS }, () => local("/api/ara-os/expediente-estado", token, {}, LECTURA_MAX_MS)),
    // Certificaciones (06/10/2026): última visita y % ejecutado de cada obra → fin estimado y «toca visitar»
    cacheFuente("certif", { ttl: 10 * 60e3, espera: TIMEOUT_MS }, () => local("/api/certificaciones/obras", token, {}, LECTURA_MAX_MS)),
  ]);
  const fuentes = Object.fromEntries(nombres.map((n, i) => [n, aFuente(res[i])]));
  // OT por su fase de la HOJA, sin las tarjetas que pone Planificación: si no, lo que Planificación
  // enseña volvía como dato (La Paz 29 «empezada el 05/10», Montemayor «OT finalizada»)
  if (fuentes.ot?.ok) fuentes.ot = { ...fuentes.ot, data: ordenCartera.otSegunHoja(fuentes.ot.data) };
  // 5610 sin obra (p. ej. una caché de /custodias de antes): por el nombre, sin tildes ni mayúsculas
  if (fuentes.custodias?.ok && fuentes.comunidades_doc?.ok && Array.isArray(fuentes.custodias.data?.comunidades)) {
    fuentes.custodias = { ...fuentes.custodias, data: { ...fuentes.custodias.data,
      comunidades: require("./lib/custodia-holded.cjs").asignarObras(fuentes.custodias.data.comunidades, fuentes.comunidades_doc.data, ordenCartera.ccppId,
        // comunidad repetida en la hoja: la de la cartera
        new Set([...(fuentes.pnr_ref?.ok ? (fuentes.pnr_ref.data.obras || []).map((o) => o.obra_id) : []), ...(fuentes.ot?.ok ? Object.values(fuentes.ot.data.grupos || {}).flat().map((o) => o.ccpp_id) : [])].filter(Boolean))) } };
  }
  // Comunidades duplicadas (config_dinero «ccpp_alias»): custodias, etiquetas y OT
  // con el id bueno antes de cualquier cálculo; nunca por nombre
  {
    const fila = require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], "ccpp_alias");
    ccppAlias.aplicarAlias(fuentes, ccppAlias.leerAlias(fila?.valor));
  }

  // Del banco solo cuentan los MOVIMIENTOS BANCARIOS, nunca los asientos
  // manuales del libro (type "entry": regularizaciones, reclasificaciones…).
  // Un asiento de regularización del 13/09 salía como «cargo de la TGSS».
  // Se aplica aquí para que D8, sus avisos, la frescura, la previsión y la
  // alerta de la SS lean lo mismo. Los tipos vistos van en la respuesta.
  // 10.2.1 · Saldo del banco (el de T1, tesorería de Holded) contra el saldo
  // CONTABLE de la misma cuenta 572 en el libro (suma de todos sus apuntes).
  // La diferencia son los movimientos del banco aún sin conciliar (propuesta
  // de Alberto, 30/09: los endpoints de movimientos de Holded son internos).
  fuentes.banco_sync = await conTimeout(leerBancoSync(), TIMEOUT_MS, `hoja ${HOJA_SYNC}`).catch((e) => ({ ok: false, error: e.message }));
  fuentes.cuadre = await cuadreCuenta(fuentes.tesoreria, calc.CUENTA_BANCO, manana, false);

  let tiposBanco = null;
  if (fuentes.banco.ok) {
    tiposBanco = {};
    for (const a of fuentes.banco.data) tiposBanco[a.tipo || "(vacío)"] = (tiposBanco[a.tipo || "(vacío)"] || 0) + 1;
    fuentes.banco = { ok: true, data: fuentes.banco.data.filter(calc.esMovimientoBancario), cuentas: fuentes.banco.cuentas, error_cuenta_2: fuentes.banco.error_cuenta_2 };
  }

  // Obras privadas en ejecución que /ordenes-trabajo aún no trae (sin planificación calculada tras un reinicio):
  // desde obras-otras, para T4, D11 y la rentabilidad (Urbano Orad 13-15 con su id combinado; 06/10/2026)
  if (fuentes.ot?.ok && fuentes.oo?.ok) fuentes.ot = { ...fuentes.ot, data: calc.otConOOEnCurso(fuentes.ot.data, fuentes.oo.data, fuentes.invoices) };

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
    Promise.allSettled(enCurso.map((o) => rentabObra(o.ccpp_id, token))),
    Promise.allSettled(cuentas465.map((c) => cacheFuente(`a465_${c}_${hoy}`, { ttl: TTL.a465, espera: TIMEOUT_MS }, () => apuntesCuenta(c, calc.sumarDias(hoy, -DIAS_465), manana)))),
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
  const cfgf = { txt: (k) => { const r = require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], k); return r && String(r.valor).trim() ? String(r.valor).trim() : null; } };
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

// Horas de trabajo fichadas (registros de tiempo), para Planificación y el cash flow: lo pasado
// manda (05/10/2026). Caché corta; si falla, null (se usan las horas que ya traía la cartera).
let _regs = null;   // { ts, data }
async function leerRegistrosTrabajo(maxEdadMs = 60 * 1000) {
  if (_regs && Date.now() - _regs.ts < maxEdadMs) return _regs.data;
  try { _regs = { ts: Date.now(), data: await require("./ara-os-registros-tiempo.cjs").getRegistrosTrabajo() }; }
  catch (e) { console.warn("[dinero-empresa] registros de tiempo:", e.message); }
  return _regs?.data || null;
}
const registrosYa = () => _regs?.data || null;

// Obras cuyo margen ya está en el valor de la empresa de hoy (T4 obra sin facturar − D11 − D14): fases 12-17 con
// algo por facturar (Urbano Orad, Montemayor…). Su beneficio no vuelve a sumar en «valor a fin de mes».
function obrasEnValor(data) {
  const t4 = [...(data.tengo || [])].find((l) => l.id === "T4");
  return (t4?.detalle || []).filter((d) => d.ccpp_id && Number(d.importe) > 0).map((d) => d.ccpp_id);
}

function componer({ fuentes, hoy, generado, tiposBanco }, opciones = {}) {
  const data = calc.calcularEscalera(fuentes, hoy, generado, opciones);
  const extra = extraCashflow(fuentes, hoy);
  // Sección 9 (tarjetas de Mi panel › Empresa): previsión semanal, alerta
  // patrimonial y umbral del semáforo de «mío hoy».
  data.panel = panel.calcularPanel(fuentes, data, hoy, { extra, concCaja: data.ajuste_conciliacion || null });
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
  data.cashflow = cashflow.calcularCashflow(fuentes, vistaCf, hoy, data.ajuste_conciliacion || null, extra);
  data.cashflow.vista = data.real ? "real" : "contable";
  data.cashflow.simulador = cashflow.baseSimulador(fuentes.pnr_ref);
  // Obras cobradas enteras confirmadas a mano (además de las de la hoja)
  const filaCob = require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], "obras_cobradas");
  const cobradasCfg = String(filaCob?.valor || "").split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
  // Orden de la cartera según la documentación de cada expediente
  // + fechas de inicio/fin del panel de obras (OT) y las otras obras aceptadas (OO)
  // + la planificación puesta a mano (hoja planificacion_obras)
  // «Lista para empezar» de cada obra (expediente de Guillermo + abono de Sabadell): en la cola,
  // las listas van delante de las no listas (simulador-caja.colaObras). null = sin expedientes
  let listaDe = null;
  const marcarLista = (obras) => (listaDe ? obras.map((o) => (o.obra_id in listaDe ? { ...o, lista_para_empezar: listaDe[o.obra_id] } : o)) : obras);
  const ordenar = (obras) => marcarLista(ordenCartera.aplicarPlanificacion(ordenCartera.completarCartera(
    fuentes.comunidades_doc?.ok ? ordenCartera.ordenarCartera(obras, fuentes.comunidades_doc.data, hoy) : obras,
    { ot: fuentes.ot?.ok ? fuentes.ot.data : null, oo: fuentes.oo?.ok ? fuentes.oo.data : null, hoy, cobradas: cobradasCfg }),
    fuentes.planificacion?.ok ? fuentes.planificacion.data : []));
  // Cuadrillas reales (config_dinero «cuadrillas», p. ej. "2,3") y obra grande
  const cfgTxt = (k) => { const r = require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], k); return r && String(r.valor).trim() ? String(r.valor).trim() : null; };
  const cuadrillasCfg = cfgTxt("cuadrillas");
  const grandeCfg = cfgTxt("obra_grande_horas") != null && Number.isFinite(Number(cfgTxt("obra_grande_horas"))) ? Number(cfgTxt("obra_grande_horas")) : null;
  // Custodias por obra (cuentas 5610): se entregan a EMASESA el día que empieza la obra
  data.cashflow.custodias_obras = fuentes.custodias?.ok ? (fuentes.custodias.data.comunidades || []).map((c) => ({ ccpp_id: c.ccpp_id || null, comunidad: c.comunidad, en_custodia: c.en_custodia,
    // Planificación «lista para empezar»: vecinos que han pagado (cobrado ÷ previsto) y lo ya entregado a EMASESA
    cobrado: c.cobrado ?? null, previsto: c.previsto ?? null, entregado_emasesa: c.entregado_emasesa ?? null, vecinos_censo: c.vecinos_censo ?? null,
    vecinos_faltan: Array.isArray(c.vecinos) && c.vecinos_censo != null ? c.vecinos.filter((v) => v.tipo !== "entrega_emasesa" && !v.en_holded).length : null })) : [];
  data.cashflow.festivos = festivosLib.leerFestivos(cfgTxt("festivos"));
  // cada cuántas horas toca visita de Certificaciones (config_dinero «horas_visita»; Planificación, 32 por defecto)
  data.cashflow.horas_visita = cfgTxt("horas_visita");
  // avance de Certificaciones (sin euros: Planificación la ve JM)
  data.cashflow.certificaciones = fuentes.certif?.ok ? certifParaPlan(fuentes.certif.data.obras) : null;
  // quién va en cada cuadrilla (Planificación también con la última carga completa, que no lleva _base)
  data.cashflow.cuadrillas_personas = cfgTxt("cuadrilla_personas") || cfgTxt("cuadrillas_personas");
  // Jornada del convenio (7,7 h) y vacaciones (21 días, por defecto en agosto): Planificación y cash flow
  data.cashflow.jornada = jornadaLib.leerJornada({ horas_dia: cfgTxt("horas_dia"), vacaciones_dias: cfgTxt("vacaciones_dias"), vacaciones_personas: cfgTxt("vacaciones_personas") });
  const festSet = new Set(data.cashflow.festivos.lista);
  const esLabCfg = (x) => { const d = new Date(x + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6 && !festSet.has(x); };
  const convenio = { ...jornadaLib.hppConvenio(data.cashflow.jornada, hoy, esLabCfg), horas_dia: data.cashflow.jornada.horas_dia, vacaciones_dias: data.cashflow.jornada.vacaciones_dias };
  // Custodias cuyo id no está en la cartera: posibles comunidades duplicadas (→ ccpp_alias)
  if (fuentes.custodias?.ok && fuentes.pnr_ref?.ok) {
    const ids = [...(fuentes.pnr_ref.data.obras || []).map((o) => o.obra_id), ...(fuentes.ot?.ok ? Object.values(fuentes.ot.data.grupos || {}).flat().map((o) => o.ccpp_id) : [])];
    data.cashflow.custodias_sin_obra = ccppAlias.custodiasSinObra(data.cashflow.custodias_obras, ids, 1);
    if (data.cashflow.custodias_sin_obra.length) data.avisos.push({ nivel: "ambar", texto: `Custodias sin obra en la cartera (¿comunidad duplicada? → ccpp_alias en config_dinero): ${data.cashflow.custodias_sin_obra.map((c) => `${c.comunidad} (${c.ccpp_id}, ${Math.round(c.en_custodia).toLocaleString("es-ES")} €)`).join(" · ")}.` });
  }
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
    // Expediente de cada obra de la cartera (contratos y pagos de los pisos, panel de Guillermo)
    // y lo que ARA adelanta a EMASESA por los pisos financiados que no cubre su cuenta 5610
    if (fuentes.expedientes?.ok) {
      const exp = fuentes.expedientes.data.obras || {};
      const ids = new Set(data.cashflow.simulador.obras.map((o) => o.obra_id));
      data.cashflow.expedientes = Object.fromEntries(Object.entries(exp).filter(([id]) => ids.has(id)));
      data.cashflow.sabadell = sabadellCustodia(data.cashflow.simulador.obras, data.cashflow.expedientes, data.cashflow.custodias_obras, hoy);
      // la misma regla que la pestaña Planificación (planificacion-calendario.estadoLista)
      listaDe = Object.fromEntries(data.cashflow.simulador.obras.map((o) => [o.obra_id, planCalendario.estadoLista(o, Number(String(o.fase || "").slice(0, 2)) || 0,
        data.cashflow.expedientes[o.obra_id] || null, (data.cashflow.sabadell.pendientes || []).find((a) => a.ccpp_id === o.obra_id) || null, true).lista]));
      data.cashflow.simulador.obras = marcarLista(data.cashflow.simulador.obras);
      for (const x of data.cashflow.sabadell.sin_5610) data.avisos.push({ nivel: "rojo", texto: `${x.nombre}: abono de Sabadell sin custodia 5610: revisar dónde se contabilizó (${Math.round(x.importe).toLocaleString("es-ES")} € según financiaciones_sabadell${x.cuenta_5610 ? "" : "; la obra no tiene cuenta 5610"}).` });
    } else data.cashflow.expedientes = null;
    data.cashflow.simulador.orden = fuentes.comunidades_doc?.ok ? "documentacion" : "fase";
  }
  // «Real (automático)»: mandos calibrados con lo último de ARA-OS y su serie
  if (data.cashflow.simulador.ok) {
    const filaExcl = require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], "obras_excluidas_calibracion");
    // fuera de la calibración: las de config y las cobradas confirmadas (sin horas o con horas sin confirmar)
    const excluir = [...String(filaExcl?.valor || "").split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean), ...ordenCartera.COBRADAS_CONFIRMADAS, ...cobradasCfg];
    const cal = simulador.calibrar({ pnr: fuentes.pnr_ref, anual: fuentes.res_anual, hoy, fotoFresca: !!data.real, excluir, cuadrillas: cuadrillasCfg, grande: grandeCfg, convenio });
    data.cashflow.simulador.historico.personas_base = cal.mandos.personas;
    data.cashflow.simulador.cuadrillas = cal.mandos.cuadrillas;
    // fechas de inicio de Planificación (la misma cola, en jornadas y sin desvío): ahí se entregan las custodias
    // y su último día (con los tramos de «Cambiar personas» y lo fichado): desde ahí se cobran esas obras
    // (06/10/2026) con los expedientes y Sabadell, como Planificación: las no listas van detrás (provisionales) y
    // los huecos de cada cuadrilla salen del mismo cálculo. Mi panel pinta las obras con estas fechas y cuadrillas.
    const pc = planCalendario.planParaCaja({ cf: { simulador: data.cashflow.simulador, automatico: { mandos: cal.mandos }, certificaciones: data.cashflow.certificaciones,
        expedientes: data.cashflow.expedientes || null, sabadell: data.cashflow.sabadell || null }, hoy, festivos: data.cashflow.festivos, jornada: data.cashflow.jornada,
      nombresCuadrillas: planCalendario.personasPorCuadrilla(data.cashflow.cuadrillas_personas), registros: registrosYa(),
      // horas por persona y mes del calendario del convenio del metal de Sevilla (config_dinero «calendario_metal»)
      calendarioMetal: require("./lib/config-dinero.cjs").valorConfig(fuentes.config?.ok ? fuentes.config.data : [], "calendario_metal")?.valor ?? null });
    const fp = pc.obras;
    // (07/10/2026) con «lista desde» y su motivo: sin ellos Mi panel daba las no listas por listas hoy («lista ≈ 06/10»)
    data.cashflow.plan_obras = Object.fromEntries(Object.entries(fp).map(([k, v]) => [k, { inicio: v.inicio, fin: v.fin, equipo: v.equipo, lista: v.lista, ...(v.extra ? { extra: v.extra } : {}), ...(v.exceso ? { exceso: v.exceso } : {}),
      ...(v.lista === false ? { pasos_lista: v.pasos_lista, lista_desde: v.lista_desde, lista_motivo: v.lista_motivo } : {}) }]));
    data.cashflow.huecos_plan = pc.huecos;
    // horas fichadas en otras órdenes (órdenes intermedias) por cuadrilla y mes: Mi panel, en la fila de horas
    data.cashflow.horas_otras_ordenes = pc.horas_otras_ordenes || null;
    data.cashflow.horas_disponibles = pc.disponibles || null;   // por cuadrilla y mes (festivos y vacaciones de config)
    data.cashflow.capacidad_dias = pc.capacidad || null;        // por cuadrilla y día laborable: el reparto de horas de Mi panel
    // «Por vender» de Mi panel: horas libres × €/h (config_dinero «eur_hora_venta», 75 por defecto)
    data.cashflow.eur_hora_venta = require("./lib/config-dinero.cjs").numConfig(fuentes.config?.ok ? fuentes.config.data : [], "eur_hora_venta") ?? 75;
    // desvío real de mano de obra (Certificaciones, obras terminadas): al coste, no a las fechas (06/10/2026);
    // sin datos, el de la calibración, y se dice
    const dc = require("./lib/desvio-mo.cjs").desvioCertificaciones(fuentes.certif?.ok ? fuentes.certif.data.obras : []);
    data.cashflow.desvio_mo = dc || (cal.mandos.desvio != null ? { pct: cal.mandos.desvio, fuente: "calibración (fichajes de las obras terminadas en 6 meses): Certificaciones no tiene obras con visita", fiabilidad: "estimado", obras: [] } : null);
    // «Beneficio del mes» de Mi panel: horas presupuestadas × €/h (config_dinero «coste_hora_presupuesto», 30 por defecto)
    data.cashflow.coste_hora_presupuesto = require("./lib/config-dinero.cjs").numConfig(fuentes.config?.ok ? fuentes.config.data : [], "coste_hora_presupuesto") ?? 30;
    data.cashflow.fechas_inicio_plan = Object.fromEntries(Object.entries(fp).map(([k, v]) => [k, v.inicio]));
    // solo las obras con «Cambiar personas» o movidas por el ritmo real (la lenta y las de detrás): las
    // demás siguen con su duración del cash flow (con desvío)
    data.cashflow.fechas_fin_plan = Object.fromEntries(Object.entries(fp).filter(([, v]) => v.con_tramos || v.movida).map(([k, v]) => [k, v.fin]));
    const sim = simulador.simular({ obras: ordenar(cal.obras), historico: data.cashflow.simulador.historico, hoy, mandos: cal.mandos, ivaConocido: simulador.ivaConocido(data.cashflow), conocidas: simulador.obrasConocidas(data.cashflow),
      custodias: data.cashflow.custodias_obras, comisionesD14: data.cashflow.comisiones_sin_fecha, fechasInicio: data.cashflow.fechas_inicio_plan, fechasFin: data.cashflow.fechas_fin_plan, abonosSabadell: data.cashflow.sabadell?.abonos_futuros || [],
      planObras: data.cashflow.plan_obras, capacidad: data.cashflow.capacidad_dias, enValor: obrasEnValor(data), desvioMO: data.cashflow.desvio_mo ? data.cashflow.desvio_mo.pct / 100 : null, costeHoraPres: data.cashflow.coste_hora_presupuesto });
    const serie = simulador.serieMensual(data.cashflow, sim);
    data.cashflow.automatico = { mandos: cal.mandos, calibracion: cal.calibracion,
      meses: serie.meses.map(({ movs, ...m }) => m), meses_obra: sim.meses_obra, ultimo_cobro: sim.ultimo_cobro,
      horas_perdidas: sim.idle, beneficio_cartera: sim.beneficio_cartera, cartera: sim.cartera, avisos: sim.avisos, iva_trimestres: sim.iva_trimestres };
    data.cashflow.planificacion = { ok: !!fuentes.planificacion?.ok, error: fuentes.planificacion?.ok ? null : fuentes.planificacion?.error || null,
      vigente: fuentes.planificacion?.ok ? ordenCartera.planVigente(fuentes.planificacion.data) : {},
      cambios: fuentes.planificacion?.ok ? fuentes.planificacion.data.filter((f) => !ordenCartera.esPlanBase(f)).slice(-30).reverse() : [] };
  }
  data.cashflow.seguimiento = seguimientoFilas(fuentes.previsiones, fuentes.res_anual);
  if (fuentes.pnr_ref?.viejo_min != null || fuentes.res_anual?.viejo_min != null) data.cashflow.notas.push("Datos de obra o de beneficio anual de una lectura anterior (la última no respondió).");
  data.version = VERSION;
  data.commit = (process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || null;   // Render lo pone en cada despliegue
  data.fuentes = Object.fromEntries(Object.entries(fuentes)
    .filter(([k]) => k !== "rentab" && k !== "expedientes")   // expedientes: solo Planificación, no hace incompleto el cash flow
    .map(([k, v]) => [k, v.ok ? "ok" : v.error]));
  // fuentes servidas con el último dato bueno porque la lectura nueva no llegó a tiempo
  data.expedientes_fuente = fuentes.expedientes?.ok ? "ok" : (fuentes.expedientes?.error || "sin dato");
  data.fuentes_viejas = Object.fromEntries(Object.entries(fuentes).filter(([k, v]) => k !== "rentab" && v?.ok && v.viejo_min != null).map(([k, v]) => [k, v.viejo_min]));
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
// Pisos financiados (piso_pago = nº de meses o FFCC; Alberto, 04/10/2026): Sabadell
// abona a ARA el importe DE GOLPE. Ese dinero es custodia (5610 de la obra) y se paga a
// EMASESA antes de empezar: ARA no adelanta nada de su caja (efecto cero en la caja propia).
//   · abonos_futuros: abonos con fecha posterior a hoy en financiaciones_sabadell (todavía
//     no están en la 5610): entran en «En el banco (con vecinos)» ese día y salen a EMASESA
//     el día de inicio. Los de hoy o antes ya están en el saldo de la 5610.
//   · pendientes: financiados sin abono (ni en la hoja ni cubiertos por la 5610): «pendiente»,
//     sin fecha inventada. Importe de cada piso: el de la hoja o, si no está,
//     estimado (presupuesto con IVA ÷ pisos).
//   · sin_5610: la hoja dice abonado pero la obra no tiene saldo en la 5610 (ni entregado a
//     EMASESA, ni está terminada o facturada): aviso rojo de contabilidad. Solo lectura de lo ya cargado de Holded.
function sabadellCustodia(obras, expedientes, custodias, hoy) {
  const out = { abonos_futuros: [], pendientes: [], sin_5610: [], cubiertos_5610: [] };
  const idxCust = custodiaHolded.indexarCustodias((custodias || []).filter((x) => !x.ccpp_id));
  for (const o of obras || []) {
    const e = expedientes?.[o.obra_id];
    if (!e) continue;
    // la 5610 de la obra: por su id o, si no lo trae (cuentas que Holded descubre solas), por el nombre
    // sin tildes ni mayúsculas («Custodia Plan Cinco - Rafael Laffon 7» = Rafael Laffón 7)
    const c = (custodias || []).find((x) => x.ccpp_id === o.obra_id) || custodiaHolded.custodiaDe(idxCust, { comunidad: o.nombre }) || null;
    const saldo = c ? Math.max(0, Number(c.en_custodia) || 0) : 0;
    const entregado = c ? Math.max(0, Number(c.entregado_emasesa) || 0) : 0;
    const sab = e.sabadell || { abonado_eur: 0, abonos: [], entregado_emasesa_eur: 0 };
    for (const a of sab.abonos || []) if (a.fecha && a.fecha > hoy && a.importe > 0)
      out.abonos_futuros.push({ ccpp_id: o.obra_id, nombre: o.nombre, vivienda: a.vivienda, importe: r2(a.importe), fecha: a.fecha });
    // abonado en la hoja (hasta hoy) y sin rastro en la 5610
    const abonadoHoy = (sab.abonos || []).filter((a) => !a.fecha || a.fecha <= hoy).reduce((t, a) => t + (a.importe || 0), 0);
    // no avisa si la obra ya está terminada o facturada, ni si consta la entrega a EMASESA
    // (Holded: saldo deudor de la 5610; hoja: fila «entrega_emasesa»)
    const terminadaObra = simulador.terminada(o, hoy) || !!o.facturada || !!o.cobrada || (!!o.fin_obra && String(o.fin_obra).slice(0, 10) <= hoy);
    if (abonadoHoy > 1 && saldo <= 1 && entregado <= 1 && !(sab.entregado_emasesa_eur > 1) && !terminadaObra)
      out.sin_5610.push({ ccpp_id: o.obra_id, nombre: o.nombre, importe: r2(abonadoHoy), cuenta_5610: !!c });
    const fin = (e.pagos?.financiados || []).filter((f) => !f.abonado);
    // la comunidad financiada (ccpp_pago = nº de meses o FFCC) sin abono de Sabadell
    const comFin = e.ccpp?.aplica && e.ccpp.pago?.tipo === "financiado" && !e.ccpp.abonado;
    if (!fin.length && !comFin) continue;
    const total = Number(o.importe_total) || Number(o.importe) || 0;
    const porPiso = e.pisos > 0 ? r2(total * 1.1 / e.pisos) : 0;
    // comunidad: sin pisos, todo el presupuesto con IVA (estimado); con pisos no se sabe su parte
    const impCom = comFin ? (e.pisos > 0 ? null : r2(total * 1.1)) : 0;
    const importe = r2(fin.reduce((t, f) => t + (f.importe > 0 ? f.importe : porPiso), 0) + (impCom || 0));
    // la 5610 ya tiene, además de lo abonado según la hoja, lo que cubre lo pendiente: abonado
    if (importe > 0 && impCom !== null && saldo - Math.max(0, abonadoHoy - entregado) >= importe - 1) { out.cubiertos_5610.push({ ccpp_id: o.obra_id, nombre: o.nombre, pisos: fin.map((f) => f.vivienda), comunidad: comFin }); continue; }
    const nEst = fin.filter((f) => !(f.importe > 0)).length;
    out.pendientes.push({ ccpp_id: o.obra_id, nombre: o.nombre, pisos: fin.length, viviendas: fin.map((f) => f.vivienda), comunidad: !!comFin,
                          importe: impCom === null && !fin.length ? null : importe, importe_sin_comunidad: impCom === null,
                          estimado: nEst > 0 || !!comFin, pisos_estimados: nEst, pisos_sabadell: fin.length - nEst, por_piso_estimado: nEst ? porPiso : null });
  }
  return out;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function responder(data, opciones) {
  const { _base, ...pub } = data;
  if (opciones.pleo_manual == null || !_base) return pub;
  return componer(_base, opciones);
}

// Certificaciones para Planificación (sin euros): de /api/certificaciones/obras
function certifParaPlan(obras) {
  return (obras || []).map((c) => ({ obra_id: c.obra_id, avance_pct: c.avance_pct, ultima_visita_fecha: c.ultima_visita_fecha,
    horas_fichadas_visita: c.horas_fichadas_visita, horas_fichadas: c.horas_fichadas, previsto_horas: c.previsto_horas, total_visitas: c.total_visitas,
    visita_abierta_fecha: c.visita_abierta_fecha || null, partidas_activas: c.partidas_activas ?? null, desvio_horas: c.desvio_horas ?? null,
    horas_visita_propia: c.horas_visita_propia ?? null, modo_total: !!c.modo_total,
    // sus visitas para el calendario, sin euros
    visitas: (c.visitas || []).map(({ desvio_eur, ...v }) => v) }));
}
// «Preparar certificación», una visita…: Certificaciones avisa al guardar y Planificación la relee en la
// siguiente petición (antes esperaba hasta 10 min la caché «certif»: Orad seguía «sin preparar») · 08/10/2026
let _certifSucio = false, _certifFresca = null;   // { ts, lista }
function certificacionesCambiadas() { _certifSucio = true; delete _fuente.certif; }
async function certificacionesFrescas(token) {
  if (!_certifSucio) return _certifFresca;
  _certifSucio = false;
  const r = await local("/api/certificaciones/obras", token, {}, LECTURA_MAX_MS);
  if (r.ok) { _fuente.certif = { ts: Date.now(), r }; _certifFresca = { ts: Date.now(), r, lista: certifParaPlan(r.data.obras) }; }
  else _certifSucio = true;
  return _certifFresca;
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
      recomponer((base) => { base.fuentes.foto = { ok: true, data: _foto }; });   // con la foto nueva, sin volver a Holded
      res.json({ ok: true, guardada: { generado: f.generado, n_movimientos: f.movimientos.length, total } });
    } catch (e) {
      console.error("[movimientos-sin-conciliar]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Última sincronización del banco (06/10/2026) ─────────────
  // POST { last_sync_at, cuenta?, saldo?, saldo_extracto?, ultimo_movimiento? }: la rutina lee lastSyncAt de /internal/banking/accounts (ES81) y lo
  // sube aquí. Se guarda en la hoja banco_sync (una fila por envío) y la cabecera de Mi panel lo enseña.
  const RUTA_SYNC = "/api/ara-os/holded/banco-sync";
  app.options(RUTA_SYNC, (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.status(204).end();
  });
  app.get(RUTA_SYNC, async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try { res.json(await leerBancoSync()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(RUTA_SYNC, require("express").json({ limit: "8kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const b = req.body || {};
    const v = b.last_sync_at ?? b.lastSyncAt;
    const n = Number(v);
    const d = v == null || v === "" ? null : Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(v));
    if (!d || isNaN(d)) return res.status(400).json({ ok: false, error: "last_sync_at: fecha obligatoria (ISO o Unix)" });
    const saldo = b.saldo == null || b.saldo === "" ? null : Number(b.saldo);
    // saldo_extracto: balance de la última transacción importada (lo que Holded tiene en movimientos); ultimo_movimiento: su fecha
    const ext = b.saldo_extracto == null || b.saldo_extracto === "" ? null : Number(b.saldo_extracto);
    const um = /^\d{4}-\d{2}-\d{2}/.test(String(b.ultimo_movimiento || "")) ? String(b.ultimo_movimiento).slice(0, 10) : null;
    const reg = { last_sync_at: d.toISOString(), cuenta: b.cuenta ? String(b.cuenta).slice(0, 64) : null, saldo: Number.isFinite(saldo) ? saldo : null, recibido: new Date().toISOString(),
                  saldo_extracto: Number.isFinite(ext) ? ext : null, ultimo_movimiento: um };
    try {
      await asegurarPestana(HOJA_SYNC, SYNC_HEADERS);
      // la hoja de antes tenía 4 columnas: cabecera completa (saldo_extracto y ultimo_movimiento se leen por nombre)
      await getSheetsClient().spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${HOJA_SYNC}!A1:F1`, valueInputOption: "RAW", requestBody: { values: [SYNC_HEADERS] } });
      await getSheetsClient().spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${HOJA_SYNC}!A:F`, valueInputOption: "RAW",
        requestBody: { values: [[reg.recibido, reg.cuenta || "", reg.last_sync_at, reg.saldo == null ? "" : reg.saldo, reg.saldo_extracto == null ? "" : reg.saldo_extracto, reg.ultimo_movimiento || ""]] },
      });
      if (!_bancoSync || reg.last_sync_at >= _bancoSync.last_sync_at) _bancoSync = reg;
      recomponer((base) => { base.fuentes.banco_sync = { ok: true, data: _bancoSync }; });
      res.json({ ok: true, guardada: reg });
    } catch (e) {
      console.error("[banco-sync]", e);
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
      res.json({ ok: true, vigente: ordenCartera.planVigente(r.filas), cambios: (r.filas || []).filter((f) => !ordenCartera.esPlanBase(f)).reverse() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(RUTA_PLAN, require("express").json({ limit: "16kb" }), async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const b = req.body || {};
    const errs = ordenCartera.validarCambioPlan(b);
    if (errs.length) return res.status(400).json({ ok: false, error: errs.join("; ") });
    const fila = { obra_id: String(b.obra_id).trim(), posicion: b.posicion ?? "", fecha_inicio_fija: b.fecha_inicio_fija || "", cuadrilla: b.cuadrilla ?? "",
                   nota: String(b.nota).trim(), usuario: String(b.usuario).trim(), fecha: new Date().toISOString(),
                   // «Programar obra»: quién la hace, uno a uno
                   operarios: ordenCartera.leerOperarios(b.operarios).join(", "),
                   // «Cambiar personas desde» (obra ya en obra): un tramo, no se toca la OT
                   desde: b.desde ? String(b.desde).slice(0, 10) : "",
                   // «Pausar obra» / «Dar por terminada» / «Reanudar»: no se toca la OT
                   estado: b.estado ? String(b.estado).trim().toLowerCase() : "" };
    try {
      await guardarFilasPlan([fila]);
      // La OT recibe lo de Planificación: con personas y fecha se crea o actualiza; sin nada
      // (Quitar programación) se deshace si seguía en «12_PROGRAMADA». Si falla, lo guardado se queda.
      const ops = ordenCartera.leerOperarios(b.operarios);
      const programa = ops.length && fila.fecha_inicio_fija && !fila.desde;
      const quita = !fila.desde && !fila.estado && !fila.fecha_inicio_fija && !ops.length && (fila.posicion === "" || fila.posicion == null) && (fila.cuadrilla === "" || fila.cuadrilla == null);
      let ot = null;
      if ((programa || quita) && typeof app.locals?.otDesdePlanificacion === "function") {
        try { ot = await app.locals.otDesdePlanificacion({ ccpp_id: fila.obra_id, fecha_inicio: programa ? fila.fecha_inicio_fija : null, operarios: ops, usuario: fila.usuario }); }
        catch (e) { console.error("[planificacion-obras] OT:", e.message); ot = { ok: false, error: e.message }; }
      }
      res.json({ ok: true, fila, ot });
    } catch (e) {
      console.error("[planificacion-obras]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Planificación por cuadrillas (pestaña Planificación) ──────────
  // GET ?modo=real|simulacion&borrador={json}&tam=2,3&conf={json}&alternativas=1
  // La misma cola que el cash flow, en jornadas y SIN euros (para nadie).
  const RUTA_CAL = "/api/ara-os/planificacion-obras/calendario";
  // de una clave repetida, la última fila con valor (como en todo el dinero)
  const cfgFila = (k) => require("./lib/config-dinero.cjs").valorConfig(_cache?.data?._base?.fuentes?.config?.ok ? _cache.data._base.fuentes.config.data : [], k) || undefined;
  app.options(RUTA_CAL, (req, res) => { cors(res); res.status(204).end(); });
  app.get(RUTA_CAL, async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    try {
      const [c, registros] = await Promise.all([datosServibles(process.env.ADMIN_TOKEN || String(req.query.token)), leerRegistrosTrabajo()]);
      const json = (k) => { if (!req.query[k]) return null; try { return JSON.parse(String(req.query[k])); } catch { throw Object.assign(new Error(`${k} no es JSON`), { status: 400 }); } };
      const tam = req.query.tam ? String(req.query.tam).split(",").map(Number).filter((n) => n > 0) : null;
      let cf = c.data.cashflow;
      // hoy, el de Madrid (aunque la carga sea de ayer: la columna de hoy, «toca visitar» y el ritmo, con hoy)
      if (hoyMadrid() > cf.hoy) cf = { ...cf, hoy: hoyMadrid() };
      // Certificaciones cambiadas desde el último cálculo (preparar, visitas): las de ahora
      const fresca = await certificacionesFrescas(process.env.ADMIN_TOKEN || String(req.query.token));
      if (fresca && fresca.ts > c.ts) {
        cf = { ...cf, certificaciones: fresca.lista };
        if (_cache?.data?._base?.fuentes && _cache.ts < fresca.ts) recomponer((base) => { base.fuentes.certif = fresca.r; });
      }
      const r = planCalendario.calendarioPlan({ cf, hoy: cf.hoy, borrador: json("borrador"), conf: json("conf"), tam, alternativas: String(req.query.alternativas || "") === "1",
        modo: req.query.modo === "real" ? "real" : "simulacion", festivos: cf.festivos || null,
        // «Listas para empezar primero» (por defecto sí): las no listas, sin fecha y al final
        listasPrimero: String(req.query.listas_primero ?? "1") !== "0", jornada: cf.jornada || null, registros, nombresCuadrillas: planCalendario.personasPorCuadrilla(cfgFila("cuadrilla_personas")?.valor || cfgFila("cuadrillas_personas")?.valor || cf.cuadrillas_personas) });
      // plan base (08/10/2026): la primera vez que una obra entra en obra (o con fecha), se guarda; no espera
      guardarPlanesBase(r.planes_base_nuevos);
      // commit desplegado (Render): para comprobar qué versión calcula
      res.json({ ...r, generado: c.data.generado, de_cache: c.data.de_cache || null, cache: { edad_s: Math.round((Date.now() - c.ts) / 1000) }, commit: (process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || null });
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
  // «cuadrilla_personas» (nombres, «1:A;B|2:C;D;E»), con nota y registro en planificacion_obras
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
      // «cuadrillas_personas» (la que se edita en Planificación) y «cuadrilla_personas»: las dos igual
      await escribirConfig({ cuadrillas: tam, cuadrillas_personas: planCalendario.textoCuadrillaPersonas(q), cuadrilla_personas: planCalendario.textoCuadrillaPersonas(q) });
      await guardarFilasPlan([{ obra_id: "CUADRILLAS", posicion: "", fecha_inicio_fija: "", cuadrilla: tam, nota: `${String(b.nota).trim()} · ${planCalendario.textoPersonas(q)}`, usuario: String(b.usuario).trim(), fecha: new Date().toISOString() }], false);
      // Los tamaños cambian el cálculo: se recompone con lo ya leído, sin volver a Holded
      recomponer((base) => {
        const filas = base.fuentes.config?.ok ? base.fuentes.config.data.filter((r) => !["cuadrillas", "cuadrilla_personas", "cuadrillas_personas"].includes(String(r.clave || "").trim().toLowerCase())) : [];
        base.fuentes.config = { ...(base.fuentes.config || {}), ok: true, data: [...filas, { clave: "cuadrillas", valor: tam }, { clave: "cuadrillas_personas", valor: planCalendario.textoCuadrillaPersonas(q) }, { clave: "cuadrilla_personas", valor: planCalendario.textoCuadrillaPersonas(q) }] };
      });
      res.json({ ok: true, cuadrillas: tam });
    } catch (e) { console.error("[planificacion-obras/cuadrillas]", e); res.status(500).json({ ok: false, error: e.message }); }
  });

  // Plan base congelado: una fila «plan_base» por obra, solo una vez (y solo si se pudo leer la hoja: sin ella no se
  // sabe si ya lo tenía)
  const _basesGuardadas = new Set();
  function guardarPlanesBase(nuevos) {
    if (!Array.isArray(nuevos) || !nuevos.length || !_cache?.data?._base?.fuentes?.planificacion?.ok) return;
    const ya = ordenCartera.basesPlan(_cache.data._base.fuentes.planificacion.data);
    const ahora = new Date().toISOString();
    const filas = nuevos.filter((b) => b.obra_id && b.fin && !ya[b.obra_id] && !_basesGuardadas.has(b.obra_id)).map((b) => ({
      obra_id: b.obra_id, posicion: "", fecha_inicio_fija: b.inicio || "", cuadrilla: "", nota: "Plan base (automático: la primera vez en obra o con fecha)",
      usuario: "ARA-OS", fecha: ahora, operarios: "", desde: b.fin, estado: ordenCartera.PLAN_BASE }));
    if (!filas.length) return;
    for (const f of filas) _basesGuardadas.add(f.obra_id);
    guardarFilasPlan(filas).catch((e) => { console.error("[planificacion-obras] plan base:", e.message); for (const f of filas) _basesGuardadas.delete(f.obra_id); });
  }

  async function guardarFilasPlan(filas, recalcular = true) {
    await asegurarPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS);
    await asegurarCabeceraPlan();
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${ordenCartera.HOJA_PLAN}!A:J`,
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
  // planificacion_obras ya existía con 7 columnas: añade «operarios» (H1), «desde» (I1) y «estado» (J1) si faltan
  let _cabeceraPlanOk = false;
  async function asegurarCabeceraPlan() {
    if (_cabeceraPlanOk) return;
    await asegurarPestana(ordenCartera.HOJA_PLAN, ordenCartera.PLAN_HEADERS);
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${ordenCartera.HOJA_PLAN}!A1:J1` });
    const cab = (r.data.values?.[0] || []).map((h) => String(h || "").trim().toLowerCase());
    const falta = ordenCartera.PLAN_HEADERS.map((h, i) => [h, i]).filter(([h, i]) => cab[i] !== h);
    // columnas añadidas después: «operarios» (H), «desde» (I) y «estado» (J); el resto tiene que estar igual
    if (falta.some(([h]) => !["operarios", "desde", "estado"].includes(h))) throw new Error(`cabecera de ${ordenCartera.HOJA_PLAN} distinta de la esperada: ${cab.join(", ")}`);
    if (falta.length) await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${ordenCartera.HOJA_PLAN}!H1:J1`, valueInputOption: "RAW", requestBody: { values: [["operarios", "desde", "estado"]] } });
    _cabeceraPlanOk = true;
  }
  // Escribe (o añade) claves en config_dinero
  async function escribirConfig(valores) {
    await asegurarPestana("config_dinero", CONFIG_HEADERS);
    const sheets = getSheetsClient();
    const CD = require("./lib/config-dinero.cjs");
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: CD.RANGO });
    const filas = r.data.values || [];
    for (const [k, v] of Object.entries(valores)) {
      // se escribe en la fila que se lee (la última con esa clave)
      const i = filas.map((f, j) => (j > 0 && CD.normClave(f[0]) === k ? j : -1)).filter((j) => j > 0).pop() ?? -1;
      if (i > 0) await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `config_dinero!B${i + 1}`, valueInputOption: "RAW", requestBody: { values: [[v]] } });
      else await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: "config_dinero!A:C", valueInputOption: "RAW", requestBody: { values: [[k, v, "Planificación (quién va en cada cuadrilla)"]] } });
    }
  }

  // Recalcula en segundo plano (una sola vez aunque lleguen varias peticiones).
  // Usa el ADMIN_TOKEN del propio servidor para las llamadas internas.
  function refrescar(token, force = false) {
    if (!_enCurso) {
      _ultimoConstruir = Date.now();
      // las horas fichadas, antes de componer (Planificación y el cash flow cuentan con ellas)
      _enCurso = leerRegistrosTrabajo().catch(() => null).then(() => construir(token, force))
        .then((data) => {
          _cache = { ts: Date.now(), data };
          if (!fuenteCaida(data)) guardarUltimoCompleto(_cache.ts, data);
          console.log(`[ara-os-dinero-empresa] carga ${fuenteCaida(data) ? "INCOMPLETA" : "completa"} · ${data.holded?.peticiones ?? "?"} peticiones a Holded en ${data.holded?.segundos ?? "?"} s · lecturas por detrás: ${lecturasEnVuelo().length}`);
          // Seguimiento previsto vs real: no bloquea la respuesta
          guardarPrevision(data, hoyMadrid()).catch((e) => console.error("[ara-os-dinero-empresa] previsión del mes:", e.message));
          // Si alguna fuente ha fallado (Holded 503, timeout…), se reintenta
          // solo al cabo de REINTENTO_MS aunque nadie abra el panel, hasta que
          // vuelva. Nunca se guarda un fallo como si fuera el dato bueno.
          if (!fuenteCaida(data)) _fallosSeguidos = 0;
          else if (lecturasEnVuelo().length) {
            // Faltan fuentes porque sus lecturas siguen en marcha (timeout propio,
            // no fallo de Holded): no se reintenta nada; cuando terminen, se
            // recalcula UNA vez con lo ya leído (todo sale de la caché por fuente).
            if (!_esperaLecturas) {
              _esperaLecturas = Promise.allSettled(lecturasEnVuelo()).then(() => new Promise((r) => setTimeout(r, 2000).unref?.()))
                .then(() => { _esperaLecturas = null; return refrescar(token); })
                .catch((e) => { _esperaLecturas = null; console.error("[ara-os-dinero-empresa] tras las lecturas:", e.message); });
            }
          } else if (!_reintento) programarReintento(token);
          return data;
        })
        .finally(() => { _enCurso = null; });
    }
    return _enCurso;
  }
  // Fallo de verdad de Holded (429/5xx): 1, 2, 4, 8 y como mucho 15 min entre
  // reintentos; y nunca con la cola del embudo llena ni con otra carga en marcha.
  function programarReintento(token) {
    const espera = Math.min(REINTENTO_MS * 2 ** _fallosSeguidos++, REINTENTO_MAX_MS);
    _reintento = setTimeout(() => {
      _reintento = null;
      if (_enCurso || _esperaLecturas || holdedEmbudo.stats().en_cola > COLA_MAX_REINTENTO) { _fallosSeguidos--; return programarReintento(token); }
      refrescar(token).catch((e) => console.error("[ara-os-dinero-empresa] reintento:", e.message));
    }, espera);
    _reintento.unref?.();
  }
  const conEdad = (opciones, extra = {}, c = aServir(_cache)) => ({ ...responder(c.data, opciones), cache: { edad_s: Math.round((Date.now() - c.ts) / 1000), ...extra } });
  // Planificación y Cash flow nunca esperan a Holded: sin carga hecha (tras un despliegue) o con
  // la carga a medias, la última completa con «datos de las HH:MM, actualizando». Sin llamadas extra.
  async function datosServibles(token) {
    await _cargaUltimo;
    // caduca al cambiar de día (Madrid), a los PLAN_MAX_MS o tras un fichaje
    if (_cache) {
      const { otroDia, renovar } = require("./lib/fecha-madrid.cjs").caduca(_cache.ts, { maxMs: PLAN_MAX_MS, sucio: _planSucio });
      if (renovar) {
        _planSucio = false;
        const p = refrescar(token).catch((e) => console.error("[ara-os-dinero-empresa] refresco:", e.message));
        if (otroDia) {
          let t;
          await Promise.race([p, new Promise((r) => { t = setTimeout(r, ESPERA_DIA_MS); t.unref?.(); })]).finally(() => clearTimeout(t));
          // sin carga nueva todavía: lo ya leído, calculado para hoy
          if (hoyMadrid(new Date(_cache.ts)) !== hoyMadrid() && _cache.data?._base?.hoy !== hoyMadrid()) recomponer((base) => { base.hoy = hoyMadrid(); });
        }
      }
    }
    if (!_cache) {
      const u = deUltimo("actualizando");
      if (u) { refrescar(token).catch((e) => console.error("[ara-os-dinero-empresa] refresco:", e.message)); return u; }
      await refrescar(token);
    }
    const c = aServir(_cache);
    // la carga en curso aún no trae la cartera (posicion-neta-real leyéndose): la última que sí la trae
    if (!c.data.cashflow?.simulador?.ok) return deUltimo(_enCurso || _esperaLecturas || lecturasEnVuelo().length ? "actualizando" : "Holded no responde") || c;
    return c;
  }
  // Recompone con lo ya leído (sin volver a Holded) tras un cambio local
  // (foto del banco, cuadrillas…). Si no hay base, se recalcula entero.
  function recomponer(cambiar) {
    const base = _cache?.data?._base;
    if (!base?.fuentes) { if (_cache) _cache.ts = 0; return; }
    cambiar(base);
    _cache = { ts: _cache.ts, data: { ...componer(base), _base: base } };
  }

  app.get("/api/ara-os/holded/dinero-empresa", async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    // force=1 seguido no vuelve a Holded: si el último cálculo empezó hace
    // menos de FORCE_MIN_MS (o está en marcha), se sirve lo que hay.
    const force = String(req.query.force || "") === "1" && (Date.now() - _ultimoConstruir > FORCE_MIN_MS);
    const tokenInterno = process.env.ADMIN_TOKEN || String(req.query.token);
    const pleo = req.query.pleo_saldo != null && String(req.query.pleo_saldo).trim() !== "" ? Number(String(req.query.pleo_saldo).replace(",", ".")) : null;
    const opciones = { pleo_manual: Number.isFinite(pleo) ? pleo : null };
    try {
      if (!force && _cache) {
        const edad = Date.now() - _cache.ts;
        if (edad < CACHE_MS && !fuenteCaida(_cache.data)) return res.json(conEdad(opciones));
        // Con una fuente caída (Holded 429/503) NO se recalcula en cada
        // petición: ya hay un reintento programado con espera creciente
        // (1, 2, 4, 8… 15 min). Se sirve la última carga completa.
        if (fuenteCaida(_cache.data) && (_reintento || _enCurso || _esperaLecturas)) return res.json(conEdad(opciones, { reintento_programado: true }));
        if (edad < CACHE_STALE_MS) {
          // Se sirve ya lo último calculado y se recalcula por detrás: el panel no espera.
          refrescar(tokenInterno).catch((e) => console.error("[ara-os-dinero-empresa] refresco:", e.message));
          return res.json(conEdad(opciones, { recalculando: true }));
        }
      }
      if (!_cache && !force) {
        const c = await datosServibles(tokenInterno);
        return res.json(conEdad(opciones, { recalculando: !!_enCurso }, c));
      }
      await refrescar(tokenInterno, force);
      res.json(conEdad(opciones));
    } catch (e) {
      console.error("[ara-os-dinero-empresa]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  _cargaUltimo = cargarUltimoCompleto().catch(() => {});
  // Abonos de Sabadell pendientes (financiaciones_sabadell + 5610 de Holded) de la última carga, para
  // los bloqueos de pago del Panel de Obras y del Operativo (lib/bloqueos-expediente.cjs): sin llamadas nuevas
  app.locals = app.locals || {};
  // Estado de cada obra según Planificación (una sola fuente para Órdenes de trabajo):
  // programada / en obra / sugerencia, con fechas y personas, y las terminadas. Con la última carga
  // (la que sirve Planificación), calculado para hoy; null si aún no hay ninguna.
  app.locals.planObras = () => {
    const c = _cache && _cache.data?.cashflow?.simulador?.ok ? _cache : _ultimoCompleto;
    const cf = c?.data?.cashflow;
    if (!cf?.simulador?.ok) return null;
    const hoyReal = hoyMadrid();
    leerRegistrosTrabajo().catch(() => {});   // por detrás: la próxima vez, más fresco
    const r = planCalendario.calendarioPlan({ cf, hoy: hoyReal > cf.hoy ? hoyReal : cf.hoy, festivos: cf.festivos || null, jornada: cf.jornada || null, registros: registrosYa(),
      nombresCuadrillas: planCalendario.personasPorCuadrilla(cfgFila("cuadrilla_personas")?.valor || cfgFila("cuadrillas_personas")?.valor || cf.cuadrillas_personas) });
    if (!r.ok) return null;
    // importe de cada obra (sin IVA, el del panel de Guillermo): para las tarjetas de OT sin fila propia
    const importeDe = new Map((cf.simulador.obras || []).map((o) => [o.obra_id, Number(o.importe_total) || Number(o.importe) || 0]));
    return { hoy: r.hoy, generado: c.data.generado, obras: r.obras.map((o) => ({ ...o, importe: importeDe.get(o.obra_id) || 0 })), terminadas: r.terminadas };
  };
  // Custodias de Holded (cuentas 5610, ya conciliadas) para la ficha, Trámite, OT, /jm…: la MISMA
  // lectura y caché que el cash flow (clave «custodias»), sin llamadas nuevas mientras siga viva.
  // Si Holded aún no ha respondido, la última carga completa; null si no hay nada.
  app.locals.custodiasHolded = async (espera = 8000) => {
    const r = await cacheFuente("custodias", { ttl: TTL.custodias, espera }, () => local("/api/ara-os/custodias", process.env.ADMIN_TOKEN || "", {}, LECTURA_MAX_MS));
    if (r?.ok && Array.isArray(r.data?.comunidades)) return { comunidades: r.data.comunidades, viejo_min: r.viejo_min || null, fuente: "holded" };
    const u = (_cache?.data || _ultimoCompleto?.data)?.cashflow?.custodias_obras;
    return Array.isArray(u) && u.length ? { comunidades: u, viejo_min: null, fuente: "holded (última carga completa)" } : null;
  };
  app.locals.sabadellPendientes = () => {
    const c = _cache && !fuenteCaida(_cache.data) ? _cache : (_ultimoCompleto || _cache);
    return c?.data?.cashflow?.sabadell?.pendientes || null;
  };
  // Sembrar la última carga completa (tras un despliegue no hay ninguna y Holded
  // puede tardar): POST con el JSON de una carga completa de /dinero-empresa.
  // Solo se acepta si está completa y es más nueva que la que haya.
  const RUTA_ULT = "/api/ara-os/holded/dinero-empresa/ultima-completa";
  app.options(RUTA_ULT, (req, res) => { cors(res); res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.status(204).end(); });
  app.get(RUTA_ULT, (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const u = _ultimoCompleto;
    res.json({ ok: true, hay: !!u, generado: u?.data?.generado || null, edad_min: u ? Math.round((Date.now() - u.ts) / 60000) : null, lecturas_por_detras: Object.keys(_enVuelo), ultima_carga: _cache ? { generado: _cache.data.generado, completa: !fuenteCaida(_cache.data), holded: _cache.data.holded || null } : null, embudo: holdedEmbudo.stats() });
  });
  app.post(RUTA_ULT, require("express").json({ limit: "2mb" }), (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ error: "Token inválido" });
    const d = req.body || {};
    const ts = Date.parse(d.generado);
    if (!d.generado || isNaN(ts)) return res.status(400).json({ ok: false, error: "generado: fecha ISO obligatoria" });
    if (d.completo !== true || fuenteCaida(d) || !d.cashflow || !d.kpis) return res.status(400).json({ ok: false, error: "no es una carga completa de /dinero-empresa" });
    if (Date.now() - ts > ULTIMO_COMPLETO_MAX_MS) return res.status(400).json({ ok: false, error: "más vieja que una semana" });
    if (_ultimoCompleto && _ultimoCompleto.ts >= ts) return res.status(409).json({ ok: false, error: `ya hay una carga completa igual o más nueva (${_ultimoCompleto.data.generado})` });
    const { cache, de_cache, ...limpia } = d;
    guardarUltimoCompleto(ts, limpia);
    res.json({ ok: true, guardada: d.generado });
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
module.exports.certificacionesCambiadas = certificacionesCambiadas;
module.exports.registrosCambiados = registrosCambiados;
module.exports.componer = componer;
module.exports.validarFoto = validarFoto;
module.exports.cuadreCuenta = cuadreCuenta;
module.exports._prueba = { cacheFuente, certificacionesFrescas, certifParaPlan, lecturasEnVuelo, aServir, deUltimo, guardarUltimoCompleto, cargarUltimoCompleto, fuenteCaida, reset: () => { _ultimoCompleto = null; _ultimaHojaTs = 0; } };
module.exports.sabadellCustodia = sabadellCustodia;
