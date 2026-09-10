/**
 * ara-os-custodias.cjs
 * --------------------------------------------------------------
 * Custodia Plan Cinco EMASESA, comunidad a comunidad.
 *
 * REGLA DE ORO (decisión de Alberto, 08/09/2026):
 *   En materia de COBROS manda HOLDED. ARA-OS no calcula cobros: los lee.
 *   Lo que ARA-OS aporta es el CENSO (vecinos y cuotas), que Holded no sabe.
 *   Este módulo NO ESCRIBE NADA en Holded. Sólo lee.
 *
 * De dónde sale cada cifra:
 *   cobrado            → Holded, saldo deudor de la subcuenta 5610xxxx
 *   entregado_emasesa  → Holded, saldo acreedor de la misma subcuenta
 *   en_custodia        → cobrado - entregado_emasesa
 *   anticipos (438)    → Holded, haber = cobrado a cuenta, debe = aplicado a factura;
 *                        pendiente_facturar = haber - debe  (lo que hay que facturar)
 *   previsto           → ARA-OS (hoja financiaciones_sabadell) = PREVISIÓN, no dinero
 *   pendiente_de_cobro → previsto - cobrado  (a quién hay que perseguir)
 *
 * Endpoints:
 *   GET /api/ara-os/custodias?token=            → datos por comunidad
 *   GET /api/ara-os/custodias/diagnostico?token= → qué API de Holded responde
 *   GET /panel-custodias?token=                  → el panel HTML
 *
 * v0.3.0 · 10/09/2026 — cuentas descubiertas en Holded (5610 = custodia, 438 = anticipo); previsto y pendiente de cobro
 * v0.4.0 · 10/09/2026 — señales y fianzas recibidas (560xxxxx) como tercer bloque
 * v0.4.1 · 10/09/2026 — desglose vecino a vecino (registro financiaciones_sabadell de ARA-OS cruzado con Holded)
 */

// Base verificada contra la API real el 08/09/2026:
//   /api/v2/accounting-accounts   → 403 "Access denied" sin key  ⇒ la ruta EXISTE
//   /api/v2/<inventada>           → 404 "No route found"         ⇒ así responde una ruta que no existe
//   /api/accounting/v2/...        → devuelve el HTML del SPA     ⇒ NO es la base buena
const HOLDED_V2 = "https://api.holded.com/api/v2";

// PARÁMETROS REALES de /api/v2/ledger-entries (doc oficial, 09/09/2026):
//   start_date  OBLIGATORIO  YYYY-MM-DD
//   end_date    OBLIGATORIO  YYYY-MM-DD
//   account     opcional     número de cuenta del plan contable (p.ej. 56100018)
//   limit       opcional     por defecto 25, MÁXIMO 100
//   cursor      opcional     paginación (la respuesta trae cursor + has_more)
// Los dos primeros son obligatorios: si mandas solo uno, el otro llega vacío
// y Holded responde 400 «Invalid date format: ""». Eso despistó un buen rato.
// Autenticación: Authorization: Bearer <API Token v2>. La API Key v1 da 403.
const HOLDED_V1 = "https://api.holded.com/api/invoicing/v1";

// ---------------------------------------------------------------
// DESCUBRIMIENTO AUTOMÁTICO (v0.3.0, 10/09/2026, petición de Alberto):
// las cuentas YA NO se listan a mano. El módulo lee el plan de
// cuentas de Holded y decide por el número:
//   5610xxxx (salvo 56100000/56100001) y no archivada → CUSTODIA
//   438xxxxx y no archivada                           → ANTICIPO
// El nombre de la comunidad sale del nombre de la cuenta
// ("Custodia Plan Cinco - X" / "Anticipos de clientes - CP X").
// Cambiar una comunidad de custodia a anticipo = mover su saldo en
// Holded y archivar la 5610: el panel lo refleja solo, sin tocar código.
//
// Las listas de abajo son METADATOS OPCIONALES por número de cuenta
// (obra enlazada, previsto, notas). Si una cuenta nueva no está aquí,
// se enseña igual, solo sin esos extras. También sirven de respaldo
// si el plan de cuentas no responde.
// ---------------------------------------------------------------
const CUENTAS = [
  { cuenta: 56100002, comunidad: "Diego Puerta 1",            ccpp_id: "ccpp_diego_puerta_1_aa006a" },
  { cuenta: 56100003, comunidad: "Doña Francisquita 20",      ccpp_id: null },
  { cuenta: 56100004, comunidad: "Virgen de la Antigua 26",   ccpp_id: "ccpp_virgen_de_la_antigua_26_918ae2" },
  { cuenta: 56100005, comunidad: "Ciudad de Chiva 7",         ccpp_id: "ccpp_ciudad_de_chiva_7_011c0e" },
  { cuenta: 56100006, comunidad: "Ciudad de Carcagente 2",    ccpp_id: null },
  { cuenta: 56100007, comunidad: "Ágata 7",                   ccpp_id: null },
  { cuenta: 56100008, comunidad: "Gaviota 1",                 ccpp_id: "ccpp_gaviota_1_16e4a8" },
  { cuenta: 56100009, comunidad: "Paz 29",                    ccpp_id: "ccpp_paz_29_479ef1" },
  { cuenta: 56100010, comunidad: "Juan Pablos 17",            ccpp_id: "ccpp_juan_pablos_17_de38b9" },
  { cuenta: 56100011, comunidad: "Guardabosques 3",           ccpp_id: "ccpp_guardabosques_3_3f5f70" },
  { cuenta: 56100012, comunidad: "Miguel Cid 62",             ccpp_id: "ccpp_miguel_cid_62_69c189" },
  { cuenta: 56100013, comunidad: "Rodrigo de Triana 9",       ccpp_id: null },
  { cuenta: 56100014, comunidad: "Generalife 13",             ccpp_id: null },
  { cuenta: 56100015, comunidad: "Palma del Río 12",          ccpp_id: null },
  { cuenta: 56100016, comunidad: "Ntra. Sra. de la Oliva 67", ccpp_id: null },
  { cuenta: 56100017, comunidad: "Abogado Rafael Medina 1",   ccpp_id: "ccpp_abogado_rafael_medina_1_45e6d1" },
  { cuenta: 56100018, comunidad: "PENDIENTE DE ASIGNAR",      ccpp_id: null },
  // Subcuentas creadas el 09-10/09/2026 al identificar la 56100018.
  // (56100023 Fedriani 39 y 56100024 Oliva 94 se archivaron el 10/09: sus
  // cobros van enlazados a tickets anulados y cuadran a cero por sí solos.
  // 56100020 La Oliva 102 también se archivó el 10/09: no tenía salida a
  // EMASESA, así que su saldo pasó a la 43800004 y es un anticipo.
  // 56100019 Villanueva 3, igual: PLAN5 tradicional, sin salida a EMASESA,
  // saldo 7.590,77 traspasado a la 43800006 y archivada el 10/09.)
  { cuenta: 56100021, comunidad: "Puerto Piqueras 1",         ccpp_id: null },
  { cuenta: 56100022, comunidad: "Santa María de Ordás 8",    ccpp_id: null },
];

const CUENTA_CABECERA = 56100001;
const CUENTA_PASO     = 56100018;

function limpiaNombre(nombre, tipo) {
  let n = String(nombre || "").trim();
  if (tipo === "custodia") n = n.replace(/^custodia\s+plan\s+cinco\s*[-–:]\s*/i, "");
  if (tipo === "anticipo") n = n.replace(/^anticipos?\s+de\s+clientes?\s*[-–:]\s*/i, "").replace(/^CP\s+/i, "");
  if (tipo === "senal")    n = n.replace(/^(señal|senal|fianza)e?s?\s+recibidas?\s*[-–:]\s*/i, "").replace(/^CP\s+/i, "");
  return n || String(nombre || "");
}

// ---------------------------------------------------------------
// ANTICIPOS DE CLIENTES (438xxxxx) — decisión de Alberto, 10/09/2026.
//
// No todo cobro de una comunidad es custodia. Cuando la obra NO va
// por Plan Cinco (o la comunidad paga la obra directamente), el
// dinero cobrado antes de emitir la factura es un ANTICIPO: un
// pasivo con el cliente que se cancela al facturar. Va a una
// subcuenta 438 por comunidad, nunca a la 5610.
//
//   cobrado_a_cuenta     → HABER de la 438 (lo que ha entrado)
//   aplicado_a_factura   → DEBE de la 438 (lo que ya se ha facturado)
//   pendiente_facturar   → haber − debe  (lo que hay que facturar YA)
//
// Regla: si «pendiente_facturar» > 0, hay una factura por emitir.
// Regla de Alberto (10/09/2026): si de una comunidad NO hay ninguna
// salida de dinero a EMASESA, ese dinero es ANTICIPO, no custodia.
// Misma mecánica de mantenimiento que CUENTAS: comunidad nueva sin
// Plan 5 → se crea su 438 en Holded y se añade su línea aquí.
//
// `previsto` (opcional) = lo que se ESPERA cobrar en total (cuota ×
// viviendas, o el presupuesto). Con él el panel calcula
// `pendiente_de_cobro` = previsto − cobrado y avisa de quién falta.
// Sin `previsto` no hay aviso: poner siempre el dato cuando se sepa.
// ---------------------------------------------------------------
const ANTICIPOS = [
  { cuenta: 43800001, comunidad: "Ángel 29",                  ccpp_id: null, previsto: 15230, nota: "Obra directa (no Plan 5). Cobrada entera: 4.809,40 contado + 10.420,60 Prodinamia." },
  { cuenta: 43800002, comunidad: "Playa de Matalascañas 8",   ccpp_id: null, nota: "14 cobros de vecinos (797,18 × 13 + 797,17). Eran tickets de venta, anulados el 10/09/2026." },
  { cuenta: 43800003, comunidad: "Avda. Ciudad Jardín 85",    ccpp_id: null, nota: "Pagos de obra 50 % + 30 % + final de la comunidad, 5 cobros de vecinos de 122 € y 2 cuotas financiadas Sabadell de 779,39. Sólo facturado F250079 (568,70)." },
  { cuenta: 43800004, comunidad: "Bda. Ntra. Sra. de la Oliva 102", ccpp_id: null, previsto: 6791.76, vecinos: 9, cuota: 754.64, nota: "8 de 9 vecinos cobrados (cuota 754,64 = 751,63 + 3,01 fianza, análisis EMASESA). Presupuesto O24-ARA/00112: 6.913,31. Falta 1 vecino. Sin salida a EMASESA → anticipo; traspasado desde la 56100020 el 10/09/2026." },
  { cuenta: 43800006, comunidad: "Villanueva 3",              ccpp_id: null, previsto: 7587.95, nota: "OT25-ARA/00022 PLAN5 TRADICIONAL (7.587,95). 8 cobros de vecinos 2025 (843,11 × 6, 844, 845) = 7.590,77: obra cobrada entera. Sin salida a EMASESA → anticipo; traspasado desde la 56100019 el 10/09/2026." },
  { cuenta: 43800005, comunidad: "Ágata 7",                   ccpp_id: null, nota: "Resto de la custodia (2.971,98) que quedó tras entregar a EMASESA: es obra cobrada pendiente de facturar (Alberto, 10/09/2026). Traspasado desde la 56100007." },
];

// ---------------------------------------------------------------
// SEÑALES Y FIANZAS RECIBIDAS (560xxxxx) — Alberto, 10/09/2026.
// Dinero que una comunidad entrega como señal de contrato (p.ej. el
// 10 % de la cláusula 8). No es custodia (no va a EMASESA) ni es
// todavía anticipo: se devuelve al terminar la gestión documental o,
// si la comunidad lo acuerda por escrito, se imputa al pago final.
//   recibido  → HABER de la 560 (entró la señal)
//   devuelto  → DEBE  (se devolvió o se aplicó a la factura final)
//   retenida  → haber − debe (lo que seguimos debiendo)
// Se descubren en Holded igual que las demás: 56000001..56009999.
// ---------------------------------------------------------------
const SENALES = [
  { cuenta: 56000001, comunidad: "Miguel Cid 62", ccpp_id: "ccpp_miguel_cid_62_69c189",
    nota: "Señal 10 % del contrato O25-ARA-00059 (1.861,78, 14/11/2025). Reembolsable al acabar la gestión documental o imputable a F260024 si la comunidad lo acuerda por escrito." },
];

module.exports = function setupAraOsCustodias(app) {
  const { validToken } = require("./lib/auth.cjs");
  const path = require("path");

  function tokenValido(req) { return validToken(req.query.token); }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  function eur(n) {
    return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(Number(n) || 0) + " €";
  }

  // -------------------------------------------------------------
  // Lectura de Holded. Sólo GET.
  // -------------------------------------------------------------
  // authMode:
  //   "auto"      → v2 con Bearer si hay HOLDED_API_TOKEN; si no, key v1
  //   "key"       → cabecera `key` con HOLDED_API_KEY   (v1 de toda la vida)
  //   "bearer"    → cabecera Authorization: Bearer <HOLDED_API_TOKEN>
  //   "key-token" → cabecera `key` pero con el TOKEN v2 (por si Holded lo acepta así)
  async function holdedGet(base, ruta, params = {}, authMode = "auto") {
    const key = process.env.HOLDED_API_KEY || "";
    const tok = process.env.HOLDED_API_TOKEN || "";
    const esV2 = String(base).includes("/api/v2");

    let modo = authMode;
    if (modo === "auto") modo = (esV2 && tok) ? "bearer" : "key";

    let headers;
    if (modo === "bearer") {
      if (!tok) return { ok: false, status: 500, error: "Falta HOLDED_API_TOKEN en entorno" };
      headers = { Authorization: `Bearer ${tok}`, Accept: "application/json" };
    } else if (modo === "key-token") {
      if (!tok) return { ok: false, status: 500, error: "Falta HOLDED_API_TOKEN en entorno" };
      headers = { key: tok, Accept: "application/json" };
    } else {
      if (!key) return { ok: false, status: 500, error: "Falta HOLDED_API_KEY en entorno" };
      headers = { key, Accept: "application/json" };
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    const url = `${base}${ruta}${qs.toString() ? "?" + qs.toString() : ""}`;

    try {
      const t0 = Date.now();
      const r = await fetch(url, { method: "GET", headers });
      const latency = Date.now() - t0;
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* respuesta no-JSON */ }
      if (!r.ok) {
        return { ok: false, status: r.status, error: `Holded respondió ${r.status}`, body_raw: text.slice(0, 300), latency };
      }
      return { ok: true, status: r.status, data, latency };
    } catch (e) {
      return { ok: false, status: 500, error: e.message };
    }
  }

  // -------------------------------------------------------------
  // Saldos por subcuenta, a partir de los asientos del diario.
  // Devuelve { [numeroCuenta]: {debe, haber} }
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Importes que devuelve la API de Holded: strings en formato
  // ingles ("843.11", el punto es el decimal). NO usar aqui el
  // parser de la hoja de Google, que quita los puntos por ser
  // separador de miles: convertiria 843.11 en 84311.
  // -------------------------------------------------------------
  function numAPI(v) {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v == null ? "0" : v).trim());
    return Number.isFinite(n) ? n : 0;
  }

  // -------------------------------------------------------------
  // Saldos de las cuentas de custodia leidos del libro diario v2.
  //
  // Reglas de /ledger-entries, aprendidas a base de 400 (09/09/2026):
  //   - start_date y end_date son OBLIGATORIOS (YYYY-MM-DD). Mandar
  //     solo una de las dos devuelve 400 "Invalid date format", que
  //     parece un error de formato y es un parametro que falta.
  //   - limit maximo 100 (por defecto 25). Pedir 5000 da 400.
  //   - se pagina con `cursor`; la respuesta trae `cursor` y `has_more`.
  //   - `account` filtra por NUMERO de cuenta contable, no por id.
  //   - devuelve {items:[{account, debit, credit, ...}]}, plano: no
  //     hay asientos con lineas dentro.
  // -------------------------------------------------------------
  const DESDE_POR_DEFECTO = "2024-01-01";
  const LIMITE_PAGINA     = 100;
  const MAX_PAGINAS       = 50;

  // end_date deja fuera los apuntes del propio dia, asi que por
  // defecto se pide hasta manana: si no, el asiento de hoy no se ve
  // y la cabecera 56100001 parece descuadrada (09/09/2026).
  function hastaPorDefecto() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // -------------------------------------------------------------
  // Plan de cuentas de Holded, paginado entero. Devuelve las
  // cuentas de custodia (5610) y de anticipo (438) vivas.
  // -------------------------------------------------------------
  async function descubrirCuentas() {
    // Holded ignora `page` y devuelve siempre la misma lista: si no
    // se deduplica, cada cuenta sale N veces y el diario se suma N
    // veces (panel con 900 comunidades y millones, 10/09/2026).
    // Se indexa por numero y se para en cuanto una pagina no aporta
    // ninguna cuenta nueva.
    const porNumero = new Map();
    let cursor = null, page = 1, paginas = 0;
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const params = { limit: String(LIMITE_PAGINA) };
      if (cursor) params.cursor = cursor; else if (page > 1) params.page = String(page);
      const r = await holdedGet(HOLDED_V2, "/accounting-accounts", params);
      if (!r.ok) return { ok: false, paso: "accounting-accounts", ...r };
      paginas++;
      const lote = (r.data && (r.data.items || r.data)) || [];
      if (!Array.isArray(lote) || !lote.length) break;
      let nuevas = 0;
      for (const it of lote) {
        const num = Number(it && it.number);
        if (!Number.isFinite(num) || porNumero.has(num)) continue;
        porNumero.set(num, it); nuevas++;
      }
      if (!nuevas) break;
      if (r.data && r.data.cursor && r.data.has_more) { cursor = r.data.cursor; continue; }
      if (lote.length < LIMITE_PAGINA) break;
      page++;
    }
    const items = [...porNumero.values()];
    const meta = {};
    for (const c of CUENTAS)   meta[c.cuenta] = { ...c, tipo: "custodia" };
    for (const a of ANTICIPOS) meta[a.cuenta] = { ...a, tipo: "anticipo" };
    for (const f of SENALES)   meta[f.cuenta] = { ...f, tipo: "senal" };

    const custodias = [], anticipos = [], senales = [];
    for (const it of items) {
      const num = Number(it.number);
      if (!Number.isFinite(num) || it.archived) continue;
      const m = meta[num] || {};
      if (num >= 56100002 && num <= 56109999) {
        custodias.push({ cuenta: num, comunidad: m.comunidad || limpiaNombre(it.name, "custodia"), ccpp_id: m.ccpp_id || null, nombre_holded: it.name });
      } else if (num >= 56000001 && num <= 56009999) {
        senales.push({ cuenta: num, comunidad: m.comunidad || limpiaNombre(it.name, "senal"), ccpp_id: m.ccpp_id || null,
                       nota: m.nota || null, nombre_holded: it.name });
      } else if (num >= 43800000 && num <= 43899999) {
        anticipos.push({ cuenta: num, comunidad: m.comunidad || limpiaNombre(it.name, "anticipo"), ccpp_id: m.ccpp_id || null,
                         previsto: m.previsto, vecinos: m.vecinos, cuota: m.cuota, nota: m.nota || null, nombre_holded: it.name });
      }
    }
    custodias.sort((a, b) => a.cuenta - b.cuenta);
    anticipos.sort((a, b) => a.cuenta - b.cuenta);
    senales.sort((a, b) => a.cuenta - b.cuenta);
    return { ok: true, custodias, anticipos, senales, cuentas_leidas: items.length, paginas };
  }

  async function saldosDesdeDiario(desde, hasta, listaCustodias, listaAnticipos, listaSenales) {
    desde = desde || DESDE_POR_DEFECTO;
    hasta = hasta || hastaPorDefecto();

    // Las cuentas de custodia son una lista fija y conocida: la
    // cabecera mas las de CUENTAS. NO se descubren llamando a
    // /accounting-accounts, porque ese endpoint pagina y las
    // 5610xxxx se quedaban fuera de la primera pagina: el panel
    // salia con todas las comunidades a cero (09/09/2026).
    const numeros = [CUENTA_CABECERA, ...listaCustodias.map(c => c.cuenta), ...listaAnticipos.map(a => a.cuenta), ...(listaSenales || []).map(f => f.cuenta)];

    const saldos = {};
    // Desglose por cuenta (fecha, concepto, debe, haber): el panel lo
    // enseña al desplegar una comunidad, para ver de dónde viene cada
    // cobro y con qué concepto (petición de Alberto, 10/09/2026).
    const movimientos = {};
    let usadas = 0, paginas = 0;

    for (const num of numeros) {
      let cursor = null;
      for (let i = 0; i < MAX_PAGINAS; i++) {
        const params = {
          start_date: desde, end_date: hasta,
          account: String(num), limit: String(LIMITE_PAGINA),
        };
        if (cursor) params.cursor = cursor;

        const pag = await holdedGet(HOLDED_V2, "/ledger-entries", params);
        if (!pag.ok) return { ok: false, paso: "ledger-entries", cuenta: num, ...pag };
        paginas++;

        const items = (pag.data && pag.data.items) || [];
        for (const l of items) {
          if (!saldos[num]) saldos[num] = { debe: 0, haber: 0 };
          saldos[num].debe  += numAPI(l.debit);
          saldos[num].haber += numAPI(l.credit);
          usadas++;
          if (!movimientos[num]) movimientos[num] = [];
          movimientos[num].push({
            fecha: l.date || null,
            tipo: l.type || null,
            concepto: (l.description || "").trim(),
            debe: +numAPI(l.debit).toFixed(2),
            haber: +numAPI(l.credit).toFixed(2),
          });
        }

        if (!pag.data || !pag.data.has_more || !pag.data.cursor) break;
        cursor = pag.data.cursor;
      }
    }

    const claveFecha = f => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(f || ""); return m ? (m[3] + m[2] + m[1]) : (f || ""); };
    for (const k of Object.keys(movimientos)) movimientos[k].sort((a, b) => claveFecha(a.fecha).localeCompare(claveFecha(b.fecha)));

    for (const k of Object.keys(saldos)) {
      saldos[k].debe  = +saldos[k].debe.toFixed(2);
      saldos[k].haber = +saldos[k].haber.toFixed(2);
    }

    return { ok: true, saldos, movimientos, lineas_usadas: usadas,
             asientos_leidos: usadas, paginas, periodo: { desde, hasta } };
  }

  // -------------------------------------------------------------
  // PREVISIÓN desde ARA-OS: el censo de vecinos y sus cuotas.
  // Ojo: esto NO es dinero cobrado. Es lo que se espera cobrar.
  // Se lee de la misma hoja que ya usa custodia-resumen.
  // -------------------------------------------------------------
  async function previstoPorComunidad() {
    try {
      const { google } = require("googleapis");
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const sheets = google.sheets({ version: "v4", auth });
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "financiaciones_sabadell!A2:L",
      });
      const rows = r.data.values || [];
      // Índices de financiaciones_sabadell (FS_COLS en ara-os-panel-obras.cjs):
      // 1 = tipo · 2 = comunidad · 5 = importe
      // Columnas (FS_COLS en ara-os-panel-obras.cjs):
      // 0 n_operacion · 1 tipo · 2 comunidad · 3 vivienda · 4 titular ·
      // 5 importe · 6 fecha (ISO) · 7 empresa · 8 url_pdf · 9 n_transferencia
      const out = {};
      const filas = {};
      for (const row of rows) {
        const tipo = String(row[1] || "").trim();
        const com  = String(row[2] || "").trim();
        const imp  = parseFloat(String(row[5] || "0").replace(/\./g, "").replace(",", ".")) || 0;
        if (!com) continue;
        // v0.4.1: el registro completo, vecino a vecino, para el desglose del panel
        // (quién ha pagado, cuánto, por qué vía y cuándo — petición de Alberto, 10/09/2026).
        if (!filas[com]) filas[com] = [];
        filas[com].push({
          n_operacion: String(row[0] || "").trim() || null,
          tipo,
          vivienda: String(row[3] || "").trim() || null,
          titular:  String(row[4] || "").trim() || null,
          importe:  +imp.toFixed(2),
          fecha:    String(row[6] || "").trim() || null,
          via:      String(row[7] || "").trim() || null,
          url_pdf:  String(row[8] || "").trim() || null,
          n_transferencia: String(row[9] || "").trim() || null,
        });
        if (tipo === "entrega_emasesa") continue;
        if (tipo !== "piso" && tipo !== "comunidad") continue;
        if (!out[com]) out[com] = { previsto: 0, vecinos: 0 };
        out[com].previsto += imp;
        out[com].vecinos  += 1;
      }
      for (const k of Object.keys(filas)) filas[k].sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
      return { ok: true, data: out, filas };
    } catch (e) {
      // La previsión es un extra: si falla, el endpoint sigue sirviendo
      // lo importante, que es lo que dice Holded.
      return { ok: false, error: e.message, data: {}, filas: {} };
    }
  }

  // Cruza el registro de vecinos (ARA-OS) con los apuntes de Holded de
  // esa cuenta: cada fila del registro busca un apunte del mismo importe
  // (haber para cobros, debe para entregas a EMASESA) que no se haya
  // usado ya. Devuelve las filas con `en_holded` y el resumen.
  // El nombre de la comunidad en Holded ("Bda. Ntra. Sra. de la Oliva 102")
  // y en la hoja de ARA-OS no siempre coinciden letra a letra: se compara
  // sin acentos, sin puntuación y, si hace falta, por el número de portal.
  function normaliza(n) {
    return String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(cp|ccpp|cdad|comunidad|de|del|la|el|los|las|prop|propietarios|bda|ntra|sra|nuestra|senora|avda|avenida|calle|c\/|plaza|pza)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function buscaFilas(filas, nombre) {
    if (!filas) return null;
    if (filas[nombre]) return filas[nombre];
    const n = normaliza(nombre);
    if (!n) return null;
    const claves = Object.keys(filas);
    let k = claves.find(c => normaliza(c) === n);
    if (!k) k = claves.find(c => { const m = normaliza(c); return m.includes(n) || n.includes(m); });
    return k ? filas[k] : null;
  }

  function cruzaVecinos(filas, movimientos) {
    const libres = (movimientos || []).map(m => ({ ...m, usado: false }));
    const vecinos = (filas || []).map(f => {
      const esEntrega = f.tipo === "entrega_emasesa";
      const m = libres.find(x => !x.usado && Math.abs((esEntrega ? x.debe : x.haber) - f.importe) < 0.01);
      if (m) m.usado = true;
      return { ...f, en_holded: !!m, fecha_holded: m ? m.fecha : null, concepto_holded: m ? m.concepto : null };
    });
    const cobros = vecinos.filter(v => v.tipo !== "entrega_emasesa");
    return {
      vecinos,
      resumen: {
        registrados: cobros.length,
        en_holded: cobros.filter(v => v.en_holded).length,
        sin_cuadrar: cobros.filter(v => !v.en_holded).length,
        importe_registrado: +cobros.reduce((s, v) => s + v.importe, 0).toFixed(2),
      },
    };
  }

  // =============================================================
  // GET /api/ara-os/custodias
  // =============================================================
  app.options("/api/ara-os/custodias", (req, res) => { cors(res); res.status(204).end(); });
  app.get("/api/ara-os/custodias", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      // 1) Qué cuentas existen (Holded manda). Si falla, listas del código.
      const desc = await descubrirCuentas();
      const listaCustodias = desc.ok ? desc.custodias : CUENTAS;
      const listaAnticipos = desc.ok ? desc.anticipos : ANTICIPOS;
      const listaSenales   = desc.ok ? desc.senales   : SENALES;

      const [hold, prev] = await Promise.all([
        saldosDesdeDiario(req.query.desde, req.query.hasta, listaCustodias, listaAnticipos, listaSenales),
        previstoPorComunidad(),
      ]);

      if (!hold.ok) {
        return res.status(502).json({
          ok: false,
          error: "No se ha podido leer la contabilidad de Holded",
          paso: hold.paso,
          detalle: hold.error,
          body_raw: hold.body_raw,
          pista: "Prueba /api/ara-os/custodias/diagnostico para ver qué API responde con esta key.",
        });
      }

      const comunidades = listaCustodias.map(c => {
        const s = hold.saldos[c.cuenta] || { debe: 0, haber: 0 };
        // Las 5610 son cuentas de PASIVO: el dinero que entra del
        // vecino va al HABER (aumenta lo que le debes) y lo que se
        // entrega a EMASESA va al DEBE (cancela esa deuda). Leerlo
        // al reves dejaba todas las custodias en negativo.
        const cobrado   = +(s.haber).toFixed(2);
        const entregado = +(s.debe).toFixed(2);
        const custodia  = +(cobrado - entregado).toFixed(2);
        const p = (buscaFilas(prev.data, c.comunidad) || null);
        const previsto = p ? +(p.previsto).toFixed(2) : null;

        return {
          cuenta: c.cuenta,
          comunidad: c.comunidad,
          ccpp_id: c.ccpp_id,
          cobrado, cobrado_fmt: eur(cobrado),
          entregado_emasesa: entregado, entregado_emasesa_fmt: eur(entregado),
          en_custodia: custodia, en_custodia_fmt: eur(custodia),
          pct_entregado: cobrado > 0 ? +((entregado / cobrado) * 100).toFixed(1) : 0,
          previsto,
          previsto_fmt: previsto === null ? null : eur(previsto),
          vecinos_censo: p ? p.vecinos : null,
          pendiente_de_cobro: previsto === null ? null : +(previsto - cobrado).toFixed(2),
          // Bandera de trabajo: en negativo se ha pagado a EMASESA
          // más de lo cobrado, así que falta un ingreso por registrar.
          alerta: custodia < -1 ? "pagado_de_mas" : null,
          // La 56100018 es una cuenta de paso: su debe no es dinero
          // entregado a EMASESA sino cobros reasignados a su comunidad.
          // El panel usa esta bandera para no etiquetarlo como EMASESA.
          es_cuenta_de_paso: c.cuenta === CUENTA_PASO,
          movimientos: hold.movimientos[c.cuenta] || [],
          ...cruzaVecinos(buscaFilas(prev.filas, c.comunidad), hold.movimientos[c.cuenta]),
        };
      }).sort((a, b) => b.en_custodia - a.en_custodia);

      const suma = k => +(comunidades.reduce((s, c) => s + (c[k] || 0), 0)).toFixed(2);
      const totalCobrado   = suma("cobrado");
      const totalEntregado = suma("entregado_emasesa");
      const totalCustodia  = +(totalCobrado - totalEntregado).toFixed(2);

      // Control de integridad: la suma de las subcuentas tiene que
      // coincidir con la cabecera. Si no, falta alguna cuenta en CUENTAS.
      const cab = hold.saldos[CUENTA_CABECERA] || { debe: 0, haber: 0 };
      const saldoCabecera = +(cab.haber - cab.debe).toFixed(2);

      // ---- Anticipos (438): obra cobrada que todavía no se ha facturado ----
      // También pasivo: el cobro entra por el HABER y la factura que lo
      // consume va al DEBE. Lo que queda en el haber es lo que hay que
      // facturar. Aquí no hay EMASESA de por medio: es dinero de la obra.
      const anticipos = listaAnticipos.map(a => {
        const s = hold.saldos[a.cuenta] || { debe: 0, haber: 0 };
        const cobrado   = +(s.haber).toFixed(2);
        const aplicado  = +(s.debe).toFixed(2);
        const pendiente = +(cobrado - aplicado).toFixed(2);
        const previsto  = (typeof a.previsto === "number") ? +a.previsto.toFixed(2) : null;
        const porCobrar = previsto === null ? null : +(previsto - cobrado).toFixed(2);
        return {
          cuenta: a.cuenta,
          comunidad: a.comunidad,
          ccpp_id: a.ccpp_id,
          nota: a.nota || null,
          previsto, previsto_fmt: previsto === null ? null : eur(previsto),
          vecinos: a.vecinos || null, cuota: a.cuota || null,
          pendiente_de_cobro: porCobrar,
          pendiente_de_cobro_fmt: porCobrar === null ? null : eur(porCobrar),
          vecinos_que_faltan: (porCobrar && a.cuota) ? Math.round(porCobrar / a.cuota) : null,
          cobrado_a_cuenta: cobrado, cobrado_a_cuenta_fmt: eur(cobrado),
          aplicado_a_factura: aplicado, aplicado_a_factura_fmt: eur(aplicado),
          pendiente_facturar: pendiente, pendiente_facturar_fmt: eur(pendiente),
          pct_facturado: cobrado > 0 ? +((aplicado / cobrado) * 100).toFixed(1) : 0,
          // En negativo se ha aplicado a factura más de lo cobrado:
          // o la factura se cobró por otra vía o falta un ingreso.
          alerta: pendiente < -1 ? "aplicado_de_mas" : (pendiente > 1 ? "factura_pendiente" : null),
          movimientos: hold.movimientos[a.cuenta] || [],
          ...cruzaVecinos(buscaFilas(prev.filas, a.comunidad), hold.movimientos[a.cuenta]),
        };
      }).sort((a, b) => b.pendiente_facturar - a.pendiente_facturar);

      const sumaA = k => +(anticipos.reduce((s, c) => s + (c[k] || 0), 0)).toFixed(2);
      const totalAntCobrado   = sumaA("cobrado_a_cuenta");
      const totalAntAplicado  = sumaA("aplicado_a_factura");
      const totalAntPendiente = +(totalAntCobrado - totalAntAplicado).toFixed(2);

      // ---- Señales y fianzas (560): dinero recibido que hay que devolver o aplicar ----
      const senales = listaSenales.map(f => {
        const s = hold.saldos[f.cuenta] || { debe: 0, haber: 0 };
        const recibido = +(s.haber).toFixed(2);
        const devuelto = +(s.debe).toFixed(2);
        const retenida = +(recibido - devuelto).toFixed(2);
        return {
          cuenta: f.cuenta,
          comunidad: f.comunidad,
          ccpp_id: f.ccpp_id,
          nota: f.nota || null,
          recibido, recibido_fmt: eur(recibido),
          devuelto_o_aplicado: devuelto, devuelto_o_aplicado_fmt: eur(devuelto),
          retenida, retenida_fmt: eur(retenida),
          pct_devuelto: recibido > 0 ? +((devuelto / recibido) * 100).toFixed(1) : 0,
          alerta: retenida < -1 ? "devuelto_de_mas" : (retenida > 1 ? "senal_viva" : null),
          movimientos: hold.movimientos[f.cuenta] || [],
          ...cruzaVecinos(buscaFilas(prev.filas, f.comunidad), hold.movimientos[f.cuenta]),
        };
      }).sort((a, b) => b.retenida - a.retenida);
      const sumaF = k => +(senales.reduce((s, c) => s + (c[k] || 0), 0)).toFixed(2);
      const totalSenRecibido = sumaF("recibido");
      const totalSenDevuelto = sumaF("devuelto_o_aplicado");
      const totalSenRetenida = +(totalSenRecibido - totalSenDevuelto).toFixed(2);

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.4.1",
        fuente_cobros: "holded",
        fuente_cuentas: desc.ok ? "holded (plan de cuentas)" : "listas del código (fallback)",
        cuentas_descubiertas: desc.ok ? { custodias: listaCustodias.length, anticipos: listaAnticipos.length, senales: listaSenales.length, leidas: desc.cuentas_leidas } : null,
        aviso_cuentas: desc.ok ? null : ("No se pudo leer el plan de cuentas: " + (desc.error || "") + ". Usando la lista del código."),
        comunidades,
        totales: {
          cobrado: totalCobrado, cobrado_fmt: eur(totalCobrado),
          entregado_emasesa: totalEntregado, entregado_emasesa_fmt: eur(totalEntregado),
          en_custodia: totalCustodia, en_custodia_fmt: eur(totalCustodia),
          pct_entregado: totalCobrado > 0 ? +((totalEntregado / totalCobrado) * 100).toFixed(1) : 0,
        },
        anticipos,
        totales_anticipos: {
          cobrado_a_cuenta: totalAntCobrado, cobrado_a_cuenta_fmt: eur(totalAntCobrado),
          aplicado_a_factura: totalAntAplicado, aplicado_a_factura_fmt: eur(totalAntAplicado),
          pendiente_facturar: totalAntPendiente, pendiente_facturar_fmt: eur(totalAntPendiente),
          comunidades_por_facturar: anticipos.filter(a => a.pendiente_facturar > 1).length,
        },
        senales,
        totales_senales: {
          recibido: totalSenRecibido, recibido_fmt: eur(totalSenRecibido),
          devuelto_o_aplicado: totalSenDevuelto, devuelto_o_aplicado_fmt: eur(totalSenDevuelto),
          retenida: totalSenRetenida, retenida_fmt: eur(totalSenRetenida),
          comunidades_con_senal: senales.filter(f => f.retenida > 1).length,
        },
        control: {
          saldo_cabecera_56100001: saldoCabecera,
          saldo_cabecera_fmt: eur(saldoCabecera),
          descuadre: +(saldoCabecera).toFixed(2),
          cuadra: Math.abs(saldoCabecera) < 0.02,
          nota: "56100001 debe quedar a 0: todo el saldo tiene que estar repartido en las subcuentas.",
        },
        previsión_disponible: prev.ok,
        previsión_error: prev.ok ? null : prev.error,
        diagnostico: { asientos_leidos: hold.asientos_leidos, lineas_usadas: hold.lineas_usadas },
      });
    } catch (err) {
      console.error("[custodias]", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // =============================================================
  // GET /api/ara-os/custodias/diagnostico
  // Dice qué APIs de Holded responden con la key actual.
  // Se ejecuta una vez tras desplegar; no forma parte del flujo.
  // =============================================================
  app.get("/api/ara-os/custodias/diagnostico", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    // 09/09/2026 · Se contrató el plan Estándar y la contabilidad se activó,
    // pero /api/v2/* seguía dando 403 con la API Key v1. Hipótesis: los
    // endpoints v2 exigen un API Token v2 (los nuevos, pat_...). Aquí se
    // prueban las tres formas de autenticar para salir de dudas de una vez.
    const pruebas = [
      { nombre: "v2 · plan de cuentas · KEY v1", base: HOLDED_V2, ruta: "/accounting-accounts", auth: "key" },
      { nombre: "v2 · plan de cuentas · TOKEN v2 (Bearer)", base: HOLDED_V2, ruta: "/accounting-accounts", auth: "bearer" },
      { nombre: "v2 · plan de cuentas · TOKEN v2 (cabecera key)", base: HOLDED_V2, ruta: "/accounting-accounts", auth: "key-token" },
      { nombre: "v2 · diario · TOKEN v2 (Bearer)", base: HOLDED_V2, ruta: "/ledger-entries", params: { limit: 5, start_date: "2026-01-01", end_date: "2026-12-31", account: 56100018 }, auth: "bearer" },
      { nombre: "v1 · tesorería (control)", base: HOLDED_V1, ruta: "/treasury", auth: "key" },
    ];

    // Cómo leer cada código, comprobado contra la API real sin key:
    //   200 → funciona
    //   403 "Access denied" → la ruta existe pero esta key no tiene permiso
    //        (o el plan de Holded no incluye contabilidad por API)
    //   404 "No route found" → la URL está mal, no es un problema de plan
    function interpretar(r) {
      if (r.ok) return "OK, responde";
      if (r.status === 404) return "URL incorrecta (la ruta no existe en Holded)";
      if (r.status === 403) return "La ruta existe pero la key no tiene acceso: revisa los permisos de la key y, si están bien, es que el plan no incluye contabilidad por API → plan B";
      if (r.status === 401) return "Key ausente o inválida";
      return "Respuesta inesperada";
    }

    const out = [];
    for (const p of pruebas) {
      const r = await holdedGet(p.base, p.ruta, p.params || {}, p.auth || "auto");
      out.push({
        prueba: p.nombre,
        url: `${p.base}${p.ruta}`,
        ok: r.ok,
        status: r.status,
        veredicto: interpretar(r),
        latency_ms: r.latency ?? null,
        body_raw: r.ok ? null : (r.body_raw || null),
        muestra: r.ok ? JSON.stringify(r.data).slice(0, 300) : null,
      });
    }

    const diario = out.find(x => x.prueba.startsWith("v2 · diario")) || out[0];
    const v2ok = out.filter(x => x.ok && x.prueba.startsWith("v2"));
    res.json({
      ok: true,
      key_v1_configurada: Boolean(process.env.HOLDED_API_KEY),
      token_v2_configurado: Boolean(process.env.HOLDED_API_TOKEN),
      v2_funciona_con: v2ok.map(x => x.prueba),
      key_configurada: Boolean(process.env.HOLDED_API_KEY),
      pruebas: out,
      conclusion: diario.ok
        ? "El diario responde: /api/ara-os/custodias puede funcionar tal cual."
        : "El diario NO responde. Hay que ir al plan B: leer movimientos bancarios conciliados y agrupar por cuenta de destino.",
    });
  });

  // =============================================================
  // GET /panel-custodias  → la pantalla
  // =============================================================
  app.get("/panel-custodias", (req, res) => {
    if (!tokenValido(req)) return res.status(401).send("Token inválido");
    res.sendFile(path.join(__dirname, "public", "panel-custodias.html"));
  });

  // Módulo hermano (09/09/2026): propuesta de asignación de los cobros
  // que la regla de conciliación deja en la 56100018. Se carga desde
  // aquí y no desde index.cjs para no tocar un archivo de 325 KB por
  // una línea. Protegido: si fallara, el resto de custodias sigue vivo.
  try { require("./ara-os-custodias-asignar.cjs")(app); }
  catch (e) { console.error("[ara-os-custodias-asignar] no se pudo cargar:", e.message); }

  console.log("[ara-os-custodias] v0.4.1 · /api/ara-os/custodias · /panel-custodias");
};
