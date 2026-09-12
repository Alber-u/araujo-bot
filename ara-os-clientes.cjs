/**
 * ara-os-clientes.cjs
 * --------------------------------------------------------------
 * QUÉ NOS DEBEN DE VERDAD (petición de Alberto, 12/09/2026)
 *
 * El KPI «Cobros pendientes» de Mi panel salía de ARA-OS y por eso mentía en
 * las dos direcciones:
 *   · De más: contaba el presupuesto entero de obras ya cobradas, porque el
 *     panel miraba campos que no existían (`tiene_factura_emitida`,
 *     `estado_cobro`) en vez de `facturada` / `cobrada`.
 *   · De menos: no ve las facturas que no están ligadas a una obra de ARA-OS.
 *     Caso real: la obra de Avda. Reina Mercedes 65 se facturó a la ficha
 *     «CP DE HELIÓPOLIS 6» (F260042). ARA-OS busca por la ficha «CCPP AVD.
 *     REINA MERCEDES 65» y no la encuentra, así que los 1.838,65 € que
 *     quedan por cobrar no aparecían en ningún sitio. Y las facturas de
 *     2023-2025 tampoco, porque no tienen obra asociada.
 *
 * La contabilidad no tiene ese problema: la cuenta 430 recoge lo que debe
 * cada cliente, tenga o no obra en ARA-OS y esté en la ficha que esté.
 *
 * Este módulo NO ESCRIBE NADA en Holded. Sólo lee con el API Token v2.
 *
 * Endpoint:
 *   GET /api/ara-os/holded/clientes-pendientes?token=   → saldo por cliente
 *
 * v0.1.0 · 12/09/2026
 */

const path = require("path");

const HOLDED_V2 = "https://api.holded.com/api/v2";
const LIMITE_PAGINA = 100;
const MAX_PAGINAS = 400;          // ~40.000 apuntes; el histórico completo
const TTL = 6 * 3600e3;           // saldos de clientes: 6 h
const DESDE = "2019-01-01";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

let _cache = null;

/* ══════════════════════════════════════════════════════════════════
   PATRIMONIO NETO Y CAUSA DE DISOLUCIÓN
   Añadido el 12/09/2026 a petición de Alberto: «quiero que este número
   sea real por el tema de las alertas de patrimonio».

   En Holded no existen las cuentas de los grupos 1, 2 y 3, así que el
   patrimonio neto no se puede leer: hay que construirlo. Se construye
   con lo que sí es verificable y se dice en voz alta lo que falta.
   ══════════════════════════════════════════════════════════════════ */

// Escritura de constitución de 14/05/2020, notario Tomás Marcos Martín,
// protocolo 696: 3.000 participaciones de 1 €.
const CAPITAL_SOCIAL = 3000;

// Ajustes conocidos que aún no están contabilizados y que RESTAN.
const AJUSTES_PENDIENTES = [
  { id: "deterioro-instalaciones", concepto: "Deterioro del préstamo a Instalaciones y Reformas", importe: -78084.95,
    nota: "Pendiente de que Eplus se pronuncie. Es el ajuste grande." },
  { id: "sanciones", concepto: "Sanciones de IVA 2024 en periodo ejecutivo", importe: -2924.48,
    nota: "Gasto no deducible; van a la 678." },
  { id: "intereses-aplazamiento", concepto: "Intereses de demora del aplazamiento AEAT", importe: -377.03,
    nota: "Van a la 669." },
];

// Partidas conocidas que NO se incluyen porque no hay cifra fiable. Se
// listan para que quede claro que la estimación es incompleta, y en qué
// dirección tira cada una.
const NO_INCLUIDO = [
  { concepto: "Inmovilizado y su amortización acumulada", efecto: "sube", nota: "Furgonetas y equipos: no hay cuentas del grupo 2 en Holded." },
  { concepto: "Deudas a largo plazo", efecto: "baja", nota: "Del banco sólo se ve la cuota, no el capital pendiente." },
  { concepto: "Facturas de gasto de 2025 sin contabilizar", efecto: "baja", nota: "Las etiquetadas nopresentado2025." },
  { concepto: "6 facturas de anticipos de 2025 sin emitir", efecto: "sube", nota: "70.009 € cobrados y sin facturar, a la espera del criterio de Eplus." },
  { concepto: "Obra ejecutada sin facturar", efecto: "sube", nota: "Por devengo debería reconocerse como obra en curso." },
];

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

// Nombre del cliente a partir de lo que traiga el apunte. La descripción de
// una factura de venta en Holded suele ser "Factura, F260042, NOMBRE, fecha".
function nombreDe(l) {
  const directo = l.account_name || l.accountName || l.contact_name || l.contactName;
  if (directo) return String(directo).trim();
  const d = String(l.description || "");
  const m = /^Factura,\s*[^,]+,\s*([^,]+)/i.exec(d);
  if (m) return m[1].trim();
  return null;
}

async function construir(force = false) {
  if (!force && _cache && Date.now() - _cache.ts < TTL) return _cache.data;

  const hasta = new Date().toISOString().slice(0, 10);
  const cuentas = {};
  const resultado = { ingresos: 0, gastos: 0 };
  let cursor = null, paginas = 0, apuntes = 0, truncado = false, error = null;

  for (let i = 0; i < MAX_PAGINAS; i++) {
    const params = { start_date: DESDE, end_date: hasta, limit: String(LIMITE_PAGINA) };
    if (cursor) params.cursor = cursor;
    const pag = await holdedGetV2("/ledger-entries", params);
    if (!pag.ok) { error = pag.error; break; }
    paginas++;
    for (const l of (pag.data && pag.data.items) || []) {
      const cta = String(l.account || "");
      // De paso, el resultado acumulado (grupos 6 y 7) para el patrimonio.
      if (/^[67]/.test(cta)) {
        const desc0 = String(l.description || "");
        if (!/regulariz|cierre|apertura/i.test(desc0)) {
          const d0 = Number(l.debit) || 0, h0 = Number(l.credit) || 0;
          if (cta[0] === "6") resultado.gastos += d0 - h0;
          else resultado.ingresos += h0 - d0;
        }
      }
      if (!/^430/.test(cta)) continue;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
      const debe = Number(l.debit) || 0, haber = Number(l.credit) || 0;
      const c = cuentas[cta] || (cuentas[cta] = { cuenta: cta, nombre: null, saldo: 0, ultima: null, ultima_factura: null });
      c.saldo += debe - haber;                 // deudor = nos deben
      const nom = nombreDe(l);
      if (nom && !c.nombre) c.nombre = nom;
      if (iso && (!c.ultima || iso > c.ultima)) c.ultima = iso;
      if (debe > 0 && iso && (!c.ultima_factura || iso > c.ultima_factura)) c.ultima_factura = iso;
      apuntes++;
    }
    if (!pag.data || !pag.data.has_more || !pag.data.cursor) break;
    cursor = pag.data.cursor;
    if (i === MAX_PAGINAS - 1) truncado = true;
  }

  const hoy = new Date();
  const clientes = Object.values(cuentas)
    .map(c => {
      const saldo = r2(c.saldo);
      const dias = c.ultima_factura
        ? Math.round((hoy - new Date(c.ultima_factura)) / 86400000) : null;
      return { ...c, saldo, dias, tramo: dias == null ? "—" : dias <= 30 ? "0-30" : dias <= 60 ? "31-60" : dias <= 90 ? "61-90" : "+90" };
    })
    .filter(c => c.saldo > 0.5)
    .sort((a, b) => b.saldo - a.saldo);

  const total = r2(clientes.reduce((s, c) => s + c.saldo, 0));
  const porTramo = { "0-30": 0, "31-60": 0, "61-90": 0, "+90": 0, "—": 0 };
  for (const c of clientes) porTramo[c.tramo] = r2(porTramo[c.tramo] + c.saldo);

  // ── Patrimonio neto construido ────────────────────────────────
  const resultadoAcumulado = r2(resultado.ingresos - resultado.gastos);
  const contabilizado = r2(CAPITAL_SOCIAL + resultadoAcumulado);
  const sumaAjustes = r2(AJUSTES_PENDIENTES.reduce((s, a) => s + a.importe, 0));
  const ajustado = r2(contabilizado + sumaAjustes);
  const umbral = r2(CAPITAL_SOCIAL / 2);
  const patrimonio = {
    capital_social: CAPITAL_SOCIAL,
    resultado_acumulado: resultadoAcumulado,
    contabilizado,
    ajustes: AJUSTES_PENDIENTES,
    suma_ajustes: sumaAjustes,
    ajustado,
    umbral_disolucion: umbral,
    margen: r2(ajustado - umbral),
    en_causa_disolucion: ajustado < umbral,
    no_incluido: NO_INCLUIDO,
    nota: "Construido, no leído: en Holded no existen las cuentas de los grupos 1, 2 y 3. Capital social según escritura de constitución de 14/05/2020. El resultado acumulado sale de los grupos 6 y 7 de toda la serie.",
  };

  const data = {
    ok: !error,
    generado: new Date().toISOString(),
    total,
    n_clientes: clientes.length,
    por_tramo: porTramo,
    clientes,
    patrimonio,
    lectura: { apuntes_430: apuntes, paginas, truncado, error: error || null },
    nota: truncado
      ? "Aviso: se ha alcanzado el tope de páginas, el histórico puede estar incompleto."
      : "Saldo deudor de las cuentas 430 (clientes). Incluye facturas sin obra en ARA-OS y facturas emitidas a una ficha de contacto distinta de la que ARA-OS tiene guardada.",
  };
  _cache = { ts: Date.now(), data };
  return data;
}

module.exports = function (app) {
  const cors = res => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  };

  app.options("/api/ara-os/holded/clientes-pendientes", (req, res) => { cors(res); res.status(204).end(); });

  app.get("/api/ara-os/holded/clientes-pendientes", async (req, res) => {
    cors(res);
    try {
      res.json(await construir(String(req.query.force || "") === "1"));
    } catch (e) {
      console.error("[ara-os-clientes]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.options("/api/ara-os/holded/patrimonio", (req, res) => { cors(res); res.status(204).end(); });

  app.get("/api/ara-os/holded/patrimonio", async (req, res) => {
    cors(res);
    try {
      const d = await construir(String(req.query.force || "") === "1");
      res.json({ ok: d.ok, generado: d.generado, ...d.patrimonio });
    } catch (e) {
      console.error("[ara-os-patrimonio]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Pantalla para JM: a quién hay que reclamar, ordenado por antigüedad.
  app.get("/panel-cobros", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "panel-cobros.html"));
  });

  console.log("[ara-os-clientes] v0.1.0 · /api/ara-os/holded/clientes-pendientes · /panel-cobros");
};

module.exports.construir = construir;
