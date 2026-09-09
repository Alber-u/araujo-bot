// ============================================================
// ARA OS — Vinculación de FACTURACIÓN con Holded · v0.1.0 (09/09/2026)
//
// POR QUÉ EXISTE ESTE MÓDULO
// --------------------------
// Hasta ahora el panel de órdenes de trabajo cruzaba con Holded por el
// campo `numero_factura_holded`, que es TEXTO ESCRITO A MANO en la hoja
// (col AH). Consecuencia real medida el 09/09/2026:
//
//   · Guardabosques 3 → facturada (F260037) y COBRADA el 21/07 …
//     el panel la mostraba como "SIN FACTURA".
//   · Sextante 4      → facturada (F260044) …
//     el panel la mostraba como "SIN FACTURA".
//   · Doña Francisquita 20 → terminada hace 2 meses y 22 días,
//     31.414,63 € SIN facturar … y nadie lo veía.
//
// Un campo que hay que rellenar a mano siempre se acaba quedando vacío.
// Este módulo elimina esa dependencia: cruza por IDENTIDAD DEL CLIENTE
// (contacto de Holded ↔ comunidad de ARA-OS), no por un número tecleado.
//
// PRINCIPIO (decisión de Alberto, 08/09/2026)
// -------------------------------------------
//   "De ARA-OS no te fíes de los cobros, lo que vale es Holded."
//
// Aquí se aplica literalmente:
//   · Holded  → qué está facturado y qué está cobrado.  (verdad)
//   · ARA-OS  → qué obra hay, qué presupuesto y en qué fase está. (verdad)
//   · La resta → pendiente_facturar = pto_total − facturado.  (trabajo)
//
// ARA-OS NUNCA escribe en Holded desde aquí. Solo lee.
//
// NOTA TÉCNICA (verificada el 09/09/2026 contra la API real):
//   · /api/v2/accounting-accounts  → 403 (el plan Básico no da
//     contabilidad por API). Por eso NO se usa contabilidad aquí.
//   · /api/invoicing/v1/documents/invoice → 200 OK. Es la vía buena.
// ============================================================

const PORT = process.env.PORT || 3000;
const BASE_LOCAL = `http://127.0.0.1:${PORT}`;

// Umbral por debajo del cual no consideramos que "falte por facturar".
// Evita ruido por redondeos y por diferencias de IVA/subvención.
const TOLERANCIA_EUR = 25;

// Fases de OT en las que la obra ya está ejecutada y, por tanto,
// debería estar facturada (o al menos ser facturable).
const FASES_FACTURABLES = [
  "14_FINALIZADA",
  "15_VISITA_INSPECTOR",
  "16_MONTAJE_CONTADORES",
  "17_COBRO_EMASESA",
  "18_COBRADA",
];

// ------------------------------------------------------------
// Normalización de nombres de comunidad
// ------------------------------------------------------------
// En Holded el mismo cliente aparece como "CCPP CL.SEXTANTE 4",
// "COMUNIDAD DE PROPIETARIOS PALMA DEL RIO 12" o "CCPP Guardabosques 3".
// En ARA-OS es "Sextante 4", "Palma del Río 12", "Guardabosques 3".
// Esta función deja ambos en la misma forma canónica.
function normNombre(s) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // quita acentos
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(COMUNIDAD|COMUNIDADES|PROPIETARIOS|PROPIETARIAS|CCPP|CP|BARRIADA|BDA|URBANIZACION|URB|RESIDENCIAL|CONJUNTO|EDIFICIO|EDIF|BLOQUE|BLOQUES|PORTAL|CALLE|CL|AVDA|AVENIDA|AVD|PLAZA|PLZA|PZA|GLORIETA|PASEO|CTRA|CARRETERA|DE|DEL|LA|LAS|LOS|EL|Y|SEVILLA|SL|SLU|SA)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Conjunto de palabras significativas (>=3 letras) de un nombre ya normalizado.
function palabrasClave(s) {
  return new Set(
    normNombre(s).split(" ").filter(w => w.length >= 3 && !/^\d+$/.test(w))
  );
}

// Número del portal: el ÚLTIMO número del nombre (en "OLIVA 67" es 67;
// en "REGIMIENTO DE SORIA 9 2" nos quedamos con el 2, que es el portal).
function numeroPortal(s) {
  const nums = normNombre(s).match(/\b\d{1,4}\b/g);
  return nums && nums.length ? nums[nums.length - 1] : "";
}

// Firma = número + palabras significativas ordenadas alfabéticamente.
// Al ordenar, deja de importar el orden ni las palabras de relleno:
//   "BARRIADA NUESTRA SEÑORA DE LA OLIVA 67" → "67|NUESTRA OLIVA SENORA"
//   "Nuestra Señora de la Oliva 67"          → "67|NUESTRA OLIVA SENORA"
function firma(s) {
  const num = numeroPortal(s);
  const pal = [...palabrasClave(s)].sort().join(" ");
  return (num + "|" + pal).trim();
}

// Emparejamiento tolerante: mismo número de portal y al menos una palabra
// significativa en común. Devuelve una puntuación (nº de palabras compartidas)
// o 0 si no casan. Sirve cuando la firma exacta no coincide porque a un lado
// sobra o falta alguna palabra.
function puntuacion(a, b) {
  if (!a || !b) return 0;
  const na = numeroPortal(a), nb = numeroPortal(b);
  if (!na || !nb || na !== nb) return 0;
  const pa = palabrasClave(a), pb = palabrasClave(b);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes;
}

function eur(n) {
  const v = Number(n) || 0;
  const neg = v < 0;
  const s = Math.abs(v).toFixed(2).split(".");
  const ent = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + ent + "," + s[1] + " €";
}

async function getJSON(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const txt = await r.text();
    try { return { ok: r.ok, status: r.status, data: JSON.parse(txt) }; }
    catch { return { ok: false, status: r.status, error: "respuesta no-JSON", body_raw: txt.slice(0, 300) }; }
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------
// Núcleo: construye el cruce obra ↔ facturas
// ------------------------------------------------------------
async function construirCruce(token) {
  const q = `?token=${encodeURIComponent(token)}`;

  // 1) Obras y órdenes de trabajo, de los endpoints que ya existen.
  //    No duplicamos la lectura de Sheets: reutilizamos lo que hay.
  const [rObras, rOT] = await Promise.all([
    getJSON(`${BASE_LOCAL}/api/ara-os/panel-obras${q}`),
    getJSON(`${BASE_LOCAL}/api/ara-os/ordenes-trabajo${q}`),
  ]);
  if (!rObras.ok) return { error: "No se pudo leer panel-obras", detalle: rObras.error || rObras.status };
  if (!rOT.ok)    return { error: "No se pudo leer ordenes-trabajo", detalle: rOT.error || rOT.status };

  const obras = [];
  for (const f of (rObras.data.fases || [])) {
    for (const o of (rObras.data.grupos?.[f] || [])) obras.push(o);
  }

  // Fase OT por comunidad (la última que aparezca gana; una comunidad
  // sólo debería tener una OT viva).
  const faseOTPorCom = new Map();
  const otPorCom = new Map();
  for (const f of (rOT.data.fases || [])) {
    for (const o of (rOT.data.grupos?.[f] || [])) {
      faseOTPorCom.set(normNombre(o.comunidad), f);
      otPorCom.set(normNombre(o.comunidad), o);
    }
  }

  // v0.1.1 — Las obras que ya tienen orden de trabajo DESAPARECEN del
  // pipeline de /panel-obras (fases 01-11) y sólo viven en /ordenes-trabajo
  // (fases 12-19). Sin esto nos dejábamos fuera justo las obras ejecutadas,
  // que son las que importan aquí. Medido: emparejaba 3 obras de 135.
  const _clavesObras = new Set(obras.map(o => firma(o.comunidad)));
  for (const o of otPorCom.values()) {
    const k = firma(o.comunidad);
    if (!k || _clavesObras.has(k)) continue;
    _clavesObras.add(k);
    obras.push({ comunidad: o.comunidad, direccion: o.direccion || "", ccpp_id: o.ccpp_id || "", fase: null, pto_total: o.pto_total || 0 });
  }

  // 2) Facturas de venta de Holded. Aquí SÍ forzamos la lectura real:
  //    este endpoint existe justamente para eso, no puede ir con caché fría.
  let invoices = [];
  let holdedError = null;
  try {
    const holded = require("./ara-os-holded.cjs");
    if (!holded || typeof holded.obtenerInvoices !== "function") {
      holdedError = "ara-os-holded.cjs no expone obtenerInvoices";
    } else {
      const inv = await holded.obtenerInvoices({ mesesHaciaAtras: 36 });
      if (Array.isArray(inv?.docs)) invoices = inv.docs;
      else holdedError = inv?.error || "Holded no devolvió facturas";
    }
  } catch (e) {
    holdedError = e.message;
  }

  // 3) Agrupar facturas por cliente normalizado.
  const facturasPorClave = new Map();
  const sinEmparejar = [];
  for (const d of invoices) {
    const k = firma(d.cliente);
    if (!k) { sinEmparejar.push({ numero: d.numero, cliente: d.cliente, total: d.total }); continue; }
    if (!facturasPorClave.has(k)) facturasPorClave.set(k, []);
    facturasPorClave.get(k).push(d);
  }

  // 4) Cruce obra a obra.
  //    Primero por firma exacta; si no hay, se busca la clave que mejor
  //    puntúe (mismo número de portal + palabras en común). Así casan
  //    "Nuestra Señora de la Oliva 67" y "BARRIADA NUESTRA SEÑORA DE LA
  //    OLIVA 67" aunque a un lado sobre la palabra BARRIADA.
  const filas = [];
  const clavesUsadas = new Set();
  const clavesFacturas = [...facturasPorClave.keys()];

  for (const o of obras) {
    let clave = firma(o.comunidad);
    let fs = facturasPorClave.get(clave) || [];
    if (!fs.length) {
      let mejor = null, mejorPunt = 0;
      for (const k of clavesFacturas) {
        const muestra = facturasPorClave.get(k)[0];
        const p = puntuacion(o.comunidad, muestra.cliente);
        if (p > mejorPunt) { mejorPunt = p; mejor = k; }
      }
      if (mejor && mejorPunt >= 1) { clave = mejor; fs = facturasPorClave.get(mejor) || []; }
    }
    if (fs.length) clavesUsadas.add(clave);

    const facturado = fs.reduce((a, d) => a + (Number(d.total) || 0), 0);
    const cobrado   = fs.reduce((a, d) => a + (Number(d.cobrado_eur) || 0), 0);
    const pdteCobro = fs.reduce((a, d) => a + (Number(d.pdte_cobro_eur) || 0), 0);

    const pto = Number(o.pto_total) || 0;
    const faseOT = faseOTPorCom.get(normNombre(o.comunidad)) || null;
    const ejecutada = faseOT ? FASES_FACTURABLES.includes(faseOT) : false;

    // pendiente_facturar sólo tiene sentido si conocemos el presupuesto.
    const pendienteFacturar = pto > 0 ? Math.max(0, pto - facturado) : null;

    filas.push({
      comunidad: o.comunidad,
      ccpp_id: o.ccpp_id,
      fase_obra: o.fase,
      fase_ot: faseOT,
      ejecutada,
      pto_total: pto,
      pto_total_fmt: eur(pto),
      facturado,
      facturado_fmt: eur(facturado),
      cobrado,
      cobrado_fmt: eur(cobrado),
      pendiente_cobro: pdteCobro,
      pendiente_cobro_fmt: eur(pdteCobro),
      pendiente_facturar: pendienteFacturar,
      pendiente_facturar_fmt: pendienteFacturar === null ? "—" : eur(pendienteFacturar),
      num_facturas: fs.length,
      facturas: fs.map(d => ({
        numero: d.numero, fecha: d.fecha, fecha_vto: d.fecha_vto,
        total: d.total, cobrado: d.cobrado_eur, pendiente: d.pdte_cobro_eur,
        estado: d.estado_logico,
      })),
      dias_en_fase_ot: otPorCom.get(normNombre(o.comunidad))?.dias_en_fase ?? null,
      dias_humano_ot:  otPorCom.get(normNombre(o.comunidad))?.dias_humano ?? null,
      // Lo que la hoja dice (para comparar y detectar enlaces caducados).
      numero_factura_hoja: otPorCom.get(normNombre(o.comunidad))?.numero_factura_holded || "",
    });
  }

  // 5) Facturas de Holded que no han encontrado obra. Sirve para detectar
  //    clientes que no son comunidades (particulares) o nombres que no casan.
  const facturasHuerfanas = [];
  for (const [k, fs] of facturasPorClave.entries()) {
    if (clavesUsadas.has(k)) continue;
    for (const d of fs) {
      facturasHuerfanas.push({ clave: k, numero: d.numero, cliente: d.cliente, fecha: d.fecha, total: d.total });
    }
  }

  return { filas, facturasHuerfanas, sinEmparejar, holdedError, totalFacturasLeidas: invoices.length };
}

// ------------------------------------------------------------
module.exports = function setupAraOSFacturacion(app) {
  const VERSION = "0.2.0";

  function token(req) {
    return String(req.query.token || req.headers["x-ara-token"] || "");
  }

  // --- Cruce completo -------------------------------------------------
  app.get("/api/ara-os/facturacion", async (req, res) => {
    try {
      const r = await construirCruce(token(req));
      if (r.error) return res.status(502).json({ ok: false, version: VERSION, ...r });

      const conObra = r.filas.filter(f => f.pto_total > 0 || f.num_facturas > 0);
      const tot = conObra.reduce((a, f) => ({
        pto: a.pto + f.pto_total,
        fac: a.fac + f.facturado,
        cob: a.cob + f.cobrado,
        pdteCobro: a.pdteCobro + f.pendiente_cobro,
      }), { pto: 0, fac: 0, cob: 0, pdteCobro: 0 });

      res.json({
        ok: true,
        version: VERSION,
        generated_at: new Date().toISOString(),
        aviso_holded: r.holdedError || null,
        totales: {
          presupuestado: tot.pto,       presupuestado_fmt: eur(tot.pto),
          facturado: tot.fac,           facturado_fmt: eur(tot.fac),
          cobrado: tot.cob,             cobrado_fmt: eur(tot.cob),
          pendiente_cobro: tot.pdteCobro, pendiente_cobro_fmt: eur(tot.pdteCobro),
        },
        obras: conObra.sort((a, b) => (b.pendiente_facturar || 0) - (a.pendiente_facturar || 0)),
      });
    } catch (e) {
      res.status(500).json({ ok: false, version: VERSION, error: e.message });
    }
  });

  // --- EL SEMÁFORO: obra ejecutada y sin facturar ---------------------
  // Esta es la lista que el 09/09/2026 habría puesto Doña Francisquita 20
  // en lo alto con 82 días en rojo.
  app.get("/api/ara-os/facturacion/sin-facturar", async (req, res) => {
    try {
      const r = await construirCruce(token(req));
      if (r.error) return res.status(502).json({ ok: false, version: VERSION, ...r });

      const alertas = r.filas
        .filter(f => f.ejecutada)
        .filter(f => f.pendiente_facturar !== null && f.pendiente_facturar > TOLERANCIA_EUR)
        .sort((a, b) => (b.dias_en_fase_ot || 0) - (a.dias_en_fase_ot || 0));

      const total = alertas.reduce((a, f) => a + f.pendiente_facturar, 0);

      res.json({
        ok: true,
        version: VERSION,
        generated_at: new Date().toISOString(),
        aviso_holded: r.holdedError || null,
        tolerancia_eur: TOLERANCIA_EUR,
        cuantas: alertas.length,
        total_pendiente_facturar: total,
        total_pendiente_facturar_fmt: eur(total),
        obras: alertas.map(f => ({
          comunidad: f.comunidad,
          ccpp_id: f.ccpp_id,
          fase_ot: f.fase_ot,
          dias: f.dias_humano_ot,
          presupuesto: f.pto_total_fmt,
          facturado: f.facturado_fmt,
          pendiente_facturar: f.pendiente_facturar_fmt,
          facturas: f.facturas,
        })),
      });
    } catch (e) {
      res.status(500).json({ ok: false, version: VERSION, error: e.message });
    }
  });

  // --- Diagnóstico del emparejamiento ---------------------------------
  // Antes de fiarse de las cifras hay que ver que los nombres casan.
  app.get("/api/ara-os/facturacion/diagnostico", async (req, res) => {
    try {
      const r = await construirCruce(token(req));
      if (r.error) return res.status(502).json({ ok: false, version: VERSION, ...r });

      const emparejadas   = r.filas.filter(f => f.num_facturas > 0);
      const obrasSinFras  = r.filas.filter(f => f.num_facturas === 0 && f.pto_total > 0);
      const hojaDesfasada = r.filas.filter(f => f.num_facturas > 0 && !f.numero_factura_hoja);

      res.json({
        ok: true,
        version: VERSION,
        generated_at: new Date().toISOString(),
        aviso_holded: r.holdedError || null,
        facturas_leidas_de_holded: r.totalFacturasLeidas,
        obras_totales: r.filas.length,
        obras_con_facturas: emparejadas.length,
        obras_sin_ninguna_factura: obrasSinFras.length,
        // Estas son las que el panel viejo marcaba "SIN FACTURA" y sí la tienen:
        enlaces_que_faltan_en_la_hoja: hojaDesfasada.map(f => ({
          comunidad: f.comunidad,
          facturas: f.facturas.map(x => x.numero).join(", "),
        })),
        facturas_sin_obra: r.facturasHuerfanas,
        facturas_sin_cliente: r.sinEmparejar,
      });
    } catch (e) {
      res.status(500).json({ ok: false, version: VERSION, error: e.message });
    }
  });

  console.log(`[ara-os-facturacion] v${VERSION} listo`);
};
