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
 *   previsto           → ARA-OS (hoja financiaciones_sabadell) = PREVISIÓN, no dinero
 *   pendiente_de_cobro → previsto - cobrado  (a quién hay que perseguir)
 *
 * Endpoints:
 *   GET /api/ara-os/custodias?token=            → datos por comunidad
 *   GET /api/ara-os/custodias/diagnostico?token= → qué API de Holded responde
 *   GET /panel-custodias?token=                  → el panel HTML
 *
 * v0.1.0 · 08/09/2026
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
// PUENTE ccpp_id ↔ cuenta contable.
// Es la única pieza que hay que mantener a mano cuando entra
// una comunidad nueva: se crea su subcuenta en Holded y se añade
// aquí su línea.
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
];

const CUENTA_CABECERA = 56100001;

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
  async function saldosDesdeDiario() {
    const cuentas = await holdedGet(HOLDED_V2, "/accounting-accounts");
    if (!cuentas.ok) return { ok: false, paso: "accounting-accounts", ...cuentas };

    const lista = Array.isArray(cuentas.data) ? cuentas.data : (cuentas.data?.data || []);
    const porId = new Map();
    for (const c of lista) {
      const num = Number(c.num ?? c.number ?? c.code);
      if (num >= 56100001 && num <= 56100099) porId.set(String(c.id), num);
    }

    const asientos = await holdedGet(HOLDED_V2, "/ledger-entries", { limit: 5000 });
    if (!asientos.ok) return { ok: false, paso: "ledger-entries", ...asientos };

    const filas = Array.isArray(asientos.data) ? asientos.data : (asientos.data?.data || []);
    const saldos = {};
    let usadas = 0;

    for (const asiento of filas) {
      const lineas = asiento.entries || asiento.lines || asiento.items || [];
      for (const l of lineas) {
        const num = porId.get(String(l.accountingAccountId ?? l.accountId ?? l.account));
        if (!num) continue;
        if (!saldos[num]) saldos[num] = { debe: 0, haber: 0 };
        saldos[num].debe  += Number(l.debit  ?? l.debe  ?? 0);
        saldos[num].haber += Number(l.credit ?? l.haber ?? 0);
        usadas++;
      }
    }
    return { ok: true, saldos, lineas_usadas: usadas, asientos_leidos: filas.length };
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
      const out = {};
      for (const row of rows) {
        const tipo = String(row[1] || "").trim();
        const com  = String(row[2] || "").trim();
        const imp  = parseFloat(String(row[5] || "0").replace(/\./g, "").replace(",", ".")) || 0;
        if (!com || tipo === "entrega_emasesa") continue;
        if (tipo !== "piso" && tipo !== "comunidad") continue;
        if (!out[com]) out[com] = { previsto: 0, vecinos: 0 };
        out[com].previsto += imp;
        out[com].vecinos  += 1;
      }
      return { ok: true, data: out };
    } catch (e) {
      // La previsión es un extra: si falla, el endpoint sigue sirviendo
      // lo importante, que es lo que dice Holded.
      return { ok: false, error: e.message, data: {} };
    }
  }

  // =============================================================
  // GET /api/ara-os/custodias
  // =============================================================
  app.options("/api/ara-os/custodias", (req, res) => { cors(res); res.status(204).end(); });
  app.get("/api/ara-os/custodias", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    try {
      const [hold, prev] = await Promise.all([saldosDesdeDiario(), previstoPorComunidad()]);

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

      const comunidades = CUENTAS.map(c => {
        const s = hold.saldos[c.cuenta] || { debe: 0, haber: 0 };
        const cobrado   = +(s.debe).toFixed(2);
        const entregado = +(s.haber).toFixed(2);
        const custodia  = +(cobrado - entregado).toFixed(2);
        const p = prev.data[c.comunidad] || null;
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
        };
      }).sort((a, b) => b.en_custodia - a.en_custodia);

      const suma = k => +(comunidades.reduce((s, c) => s + (c[k] || 0), 0)).toFixed(2);
      const totalCobrado   = suma("cobrado");
      const totalEntregado = suma("entregado_emasesa");
      const totalCustodia  = +(totalCobrado - totalEntregado).toFixed(2);

      // Control de integridad: la suma de las subcuentas tiene que
      // coincidir con la cabecera. Si no, falta alguna cuenta en CUENTAS.
      const cab = hold.saldos[CUENTA_CABECERA] || { debe: 0, haber: 0 };
      const saldoCabecera = +(cab.debe - cab.haber).toFixed(2);

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "0.1.0",
        fuente_cobros: "holded",
        comunidades,
        totales: {
          cobrado: totalCobrado, cobrado_fmt: eur(totalCobrado),
          entregado_emasesa: totalEntregado, entregado_emasesa_fmt: eur(totalEntregado),
          en_custodia: totalCustodia, en_custodia_fmt: eur(totalCustodia),
          pct_entregado: totalCobrado > 0 ? +((totalEntregado / totalCobrado) * 100).toFixed(1) : 0,
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

  console.log("[ara-os-custodias] v0.1.0 · /api/ara-os/custodias · /panel-custodias");
};
