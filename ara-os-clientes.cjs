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
  { concepto: "Precio aplazado del local 13 pendiente de cobro a Araviva", efecto: "sube", nota: "20.000 € de la venta de 09/07/2026, sin factura y sin apunte; falta restar el valor neto contable del local, que sólo tiene Eplus." },
];

/* ══════════════════════════════════════════════════════════════════
   LOCAL 13 · PRECIO APLAZADO DE ARAVIVA
   Petición de Alberto, 12/09/2026: «en el panel también deberíamos ver
   cómo esto que nos debe Araviva debe ir bajando con las cuotas».

   OJO: no es un alquiler. Escritura de compraventa nº 4.159 de
   09/07/2026, notario Gonzalo García-Manrique y García da Silva:
   ARA Corporate VENDE el local 13 a Araviva Inversiones SL por
   20.000 €, íntegramente APLAZADOS, sin interés y sin garantía, en
   cuotas mensuales de 600 € y una última de 200 €, «a partir del
   inicio del mes siguiente al otorgamiento» → desde el 01/08/2026.
   Operación sujeta y exenta de IVA con renuncia a la exención
   (art. 20.Dos LIVA) e inversión del sujeto pasivo (art. 84.Uno.2º.e).

   El crédito NO está contabilizado (la 54200000 sólo tiene los
   11.850 € del préstamo), así que el calendario se construye de la
   escritura y se contrasta contra los cobros reales del banco.
   ══════════════════════════════════════════════════════════════════ */

const LOCAL13 = {
  precio: 20000,
  cuota: 600,
  ultima: 200,
  primera: "2026-08-01",           // mes siguiente al otorgamiento
  escritura: "nº 4.159 de 09/07/2026, notario Gonzalo García-Manrique",
  contabilizado: false,
};

function calendarioLocal13() {
  const cuotas = [];
  let restante = LOCAL13.precio;
  const [y0, m0] = LOCAL13.primera.split("-").map(Number);
  for (let i = 0; restante > 0.005 && i < 60; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    const imp = Math.min(LOCAL13.cuota, restante);
    restante = r2(restante - imp);
    cuotas.push({ n: i + 1, fecha: d.toISOString().slice(0, 10), importe: r2(imp), restante_teorico: restante });
  }
  return cuotas;
}

// Cómo se amortiza el crédito. Alberto, 12/09/2026: «esos 600 € se los va
// a pagar Araviva a ARA alquilándole el local». O sea que Araviva, ya
// propietaria, arrienda el local a ARA y la renta se COMPENSA contra el
// precio aplazado. Así que el crédito puede bajar por dos vías y hay que
// mirar las dos:
//   a) dinero: entrada en una cuenta 57* con «ARAVIVA» en el concepto;
//   b) compensación: gasto de arrendamiento (621*) contra Araviva.
// Se descartan préstamo y reclasificaciones: no son amortización.
function claseMovLocal13(cta, desc, debe) {
  const d = String(desc || "");
  if (!/ARAVIVA/i.test(d)) return null;
  if (/PRESTAMO|PRÉSTAMO|RECL-|reclasific|regulariz|cierre|apertura/i.test(d)) return null;
  if (/^57/.test(cta) && debe > 0) return "cobro";
  if (/^621/.test(cta) && debe > 0) return "compensacion";
  return null;
}

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
  const cobrosLocal13 = [];
  // Tesorería que NO está conectada a Holded como banco y por tanto no
  // aparece en /tesoreria: hoy, la cuenta del Sabadell donde están los
  // fondos de terceros de Plan Cinco (57200009, creada el 12/09/2026 al
  // descubrir que 88.653,25 € de custodia se habían apuntado contra el
  // Santander). Sin esto el panel resta la custodia entera sin sumar el
  // dinero que la respalda, y el «dinero propio» sale 100.000 € peor de
  // lo que es.
  let sabadellCustodia = 0;
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
      const m0 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      const iso0 = m0 ? `${m0[3]}-${m0[2]}-${m0[1]}` : null;
      if (/^57200009/.test(cta)) sabadellCustodia += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      const kind = claseMovLocal13(cta, l.description, Number(l.debit) || 0);
      if (kind && iso0 && iso0 >= LOCAL13.primera) {
        cobrosLocal13.push({ fecha: iso0, via: kind, importe: r2(Number(l.debit) || 0), concepto: String(l.description || "").slice(0, 90) });
      }
      if (!/^430/.test(cta)) continue;
      const m = m0;
      const iso = iso0;
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

  // ── Local 13: cómo va bajando lo que debe Araviva ─────────────
  const hoyISO = new Date().toISOString().slice(0, 10);
  const cal = calendarioLocal13();
  const vencidas = cal.filter(c => c.fecha <= hoyISO);
  const vencidoTeorico = r2(vencidas.reduce((s, c) => s + c.importe, 0));
  const cobrado = r2(cobrosLocal13.reduce((s, c) => s + c.importe, 0));
  const proxima = cal.find(c => c.fecha > hoyISO) || null;
  const cuotasPagadas = Math.floor(cobrado / LOCAL13.cuota);
  const local13 = {
    ...LOCAL13,
    calendario_n: cal.length,
    fin: cal[cal.length - 1].fecha,
    cuotas_vencidas: vencidas.length,
    vencido_teorico: vencidoTeorico,
    cobrado,
    cuotas_pagadas: cuotasPagadas,
    pendiente: r2(LOCAL13.precio - cobrado),
    en_mora: r2(vencidoTeorico - cobrado),
    proxima_cuota: proxima,
    cobros: cobrosLocal13.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    por_via: {
      dinero: r2(cobrosLocal13.filter(c => c.via === "cobro").reduce((s, c) => s + c.importe, 0)),
      compensacion_alquiler: r2(cobrosLocal13.filter(c => c.via === "compensacion").reduce((s, c) => s + c.importe, 0)),
    },
    proximas: cal.filter(c => c.fecha > hoyISO).slice(0, 3),
    mecanismo: "Araviva no paga las cuotas en dinero: alquila el local a ARA y la renta se compensa contra el precio aplazado. Por eso no hay entradas de 600 € en el banco.",
    avisos: [
      ...(r2(vencidoTeorico - cobrado) > 0.5
        ? [`Han vencido ${vencidas.length} cuota(s) por ${vencidoTeorico.toFixed(2)} € y no consta ninguna amortizada: ${r2(vencidoTeorico - cobrado).toFixed(2)} € sin compensar.`]
        : []),
      "Falta el contrato de arrendamiento con la cláusula de compensación por escrito. Sin él, ni Araviva cobra renta ni el crédito baja.",
      "Falta la factura de venta del local (inversión del sujeto pasivo, art. 84.Uno.2º.e) y las facturas mensuales de renta de Araviva a ARA.",
      "ARA, como arrendataria, tendría que retener el 19 % de la renta e ingresarlo con el modelo 115 trimestral. Esa retención NO se compensa: se paga en dinero.",
      "El crédito de 20.000 € no está contabilizado: la 54200000 sólo recoge los 11.850 € del préstamo.",
    ],
    nota: "El crédito nace de la venta del local 13 a Araviva (" + LOCAL13.escritura + "): 20.000 € aplazados en cuotas de 600 €. La vía de pago pactada es el alquiler del local de vuelta a ARA, compensado contra el crédito.",
  };

  const data = {
    ok: !error,
    generado: new Date().toISOString(),
    total,
    local13,
    tesoreria_extra: {
      sabadell_custodia: r2(sabadellCustodia),
      cuenta: "57200009 · SABADELL - Fondos de terceros Plan Cinco",
      nota: "No está conectada a Holded como banco, así que no sale en /tesoreria. Es el dinero que respalda la custodia de las comunidades: hay que sumarla a la caja antes de restar la custodia, o el dinero propio sale falsamente en negativo.",
    },
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
      res.json({ ok: d.ok, generado: d.generado, ...d.patrimonio, local13: d.local13 });
    } catch (e) {
      console.error("[ara-os-patrimonio]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.options("/api/ara-os/holded/local13", (req, res) => { cors(res); res.status(204).end(); });

  app.get("/api/ara-os/holded/local13", async (req, res) => {
    cors(res);
    try {
      const d = await construir(String(req.query.force || "") === "1");
      res.json({ ok: d.ok, generado: d.generado, ...d.local13 });
    } catch (e) {
      console.error("[ara-os-local13]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Pantalla para JM: a quién hay que reclamar, ordenado por antigüedad.
  app.get("/panel-cobros", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "panel-cobros.html"));
  });

  console.log("[ara-os-clientes] v0.2.0 · clientes-pendientes · patrimonio · local13 · /panel-cobros");
};

module.exports.construir = construir;
