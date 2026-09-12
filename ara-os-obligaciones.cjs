/**
 * ara-os-obligaciones.cjs
 * --------------------------------------------------------------
 * HACIENDA Y SEGURIDAD SOCIAL — calendario maestro + cruce con banco
 * (petición de Alberto, 12/09/2026)
 *
 * Problema que resuelve: los expedientes de AEAT/TGSS viven en PDF sueltos
 * en Descargas y en la sede electrónica. No hay forma de ver de un vistazo
 * qué se debe, qué plazo viene, y si el cargo entró de verdad en el banco.
 *
 * Cómo funciona:
 *   1. CALENDARIO MAESTRO — más abajo, editable a mano. Cada expediente con
 *      sus plazos, importes y cuenta de domiciliación. Sale de los acuerdos
 *      originales de la AEAT (PDF verificados el 12/09/2026).
 *   2. CRUCE CON LA CONTABILIDAD — se leen los apuntes de las cuentas de
 *      banco (57*) en Holded (API v2, /ledger-entries) y se busca, para cada
 *      plazo, un cargo que case por importe (±0,05 €) y fecha (±10 días).
 *
 * Estados de un plazo:
 *   pagado        → hay un cargo que casa en la contabilidad
 *   pendiente     → aún no ha vencido
 *   sin_confirmar → ya venció y no encuentro el cargo CONTABILIZADO. Ojo: puede
 *                   estar en el banco y sin conciliar todavía. NO es "impagado".
 *   impagado      → venció hace más de 45 días y sigue sin aparecer
 *
 * Este módulo NO ESCRIBE NADA en Holded ni en la AEAT. Solo lee.
 *
 * Endpoints:
 *   GET /api/ara-os/obligaciones?token=        → JSON completo con el cruce
 *   GET /panel-obligaciones?token=             → pantalla
 *
 * v0.1.0 · 12/09/2026
 */

const path = require("path");

const HOLDED_V2 = "https://api.holded.com/api/v2";
const HOLDED_V1 = "https://api.holded.com/api/invoicing/v1";
const LIMITE_PAGINA = 100;
const MAX_PAGINAS = 60;
const TTL = 15 * 60e3;

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const pad2 = n => String(n).padStart(2, "0");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const dias = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

let _cache = null;

/* ══════════════════════════════════════════════════════════════════
   CALENDARIO MAESTRO
   Fuente: acuerdos y providencias originales de la AEAT, leídos el
   12/09/2026. Al recibir un expediente nuevo, añadirlo aquí.
   ══════════════════════════════════════════════════════════════════ */

function plazosAEAT(lista) {
  return lista.map(([fecha, importe]) => ({ fecha, importe }));
}

const CALENDARIO = {
  actualizado: "2026-09-12",
  fuente: "Relación de deudas de la sede AEAT (12/09/2026) + anexos de los acuerdos de aplazamiento",
  expedientes: [

    {
      id: "aeat-aplaz-412640377345N",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      tipo: "aplazamiento",
      concepto: "IVA 2024 · liquidación provisional 303 (1T-4T)",
      referencia: "Expte. 412640377345N · liq. A4160326300022717",
      cuenta: "ES81 0049 …2567",
      principal: 14803.24,
      intereses: 377.03,
      pendiente_sede: 14892.20,
      notas: "Concedido 09/07/2026, notificado 20/07/2026. Acuerdo dictado de forma automatizada (Resolución 24/11/2011): por eso se concedió sin cruzar la deuda en ejecutivo. Condicionado a estar al corriente durante su vigencia.",
      plazos: plazosAEAT([
        ["2026-09-21", 1242.11], ["2026-10-20", 1246.23], ["2026-11-20", 1250.49],
        ["2026-12-21", 1254.61], ["2027-01-20", 1258.86], ["2027-02-22", 1263.12],
        ["2027-03-22", 1266.96], ["2027-04-20", 1271.22], ["2027-05-20", 1275.34],
        ["2027-06-21", 1279.60], ["2027-07-20", 1283.72], ["2027-08-20", 1288.01],
      ]),
    },

    {
      id: "aeat-aplaz-is2025",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      tipo: "aplazamiento",
      concepto: "Impuesto sobre Sociedades 2025 · declaración anual",
      referencia: "Clave A4160426530260297",
      cuenta: "por confirmar",
      pendiente_sede: 1491.66,
      sin_calendario: true,
      notas: "Consta como aplazada/fraccionada en la sede, pero NO tenemos el acuerdo con sus plazos. Descargarlo de Mis Notificaciones y cargarlo aquí.",
      plazos: [],
    },

    {
      id: "aeat-ejec-176187",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      tipo: "ejecutivo",
      concepto: "Sanción 4T 2024 · infracción arts. 191 y 195.1 LGT (mod. 303)",
      referencia: "Clave A4160326500176187",
      cuenta: "—  (no domiciliado)",
      pendiente_sede: 519.50,
      sin_calendario: true,
      notas: "En periodo ejecutivo, pendiente de pago. Es una de las deudas que sostiene las diligencias de embargo sobre la ES81.",
      plazos: [],
    },

    {
      id: "aeat-ejec-176330",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      tipo: "ejecutivo",
      concepto: "Sanción 3T 2024 · ingreso no realizado, art. 191 LGT (mod. 303)",
      referencia: "Clave A4160326500176330",
      cuenta: "—  (no domiciliado)",
      pendiente_sede: 1724.85,
      sin_calendario: true,
      notas: "En periodo ejecutivo, pendiente de pago.",
      plazos: [],
    },

    {
      id: "aeat-ejec-176770",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      tipo: "ejecutivo",
      concepto: "Sanción 1T 2024 · ingreso no realizado, art. 191 LGT (mod. 303)",
      referencia: "Clave A4160326500176770",
      cuenta: "—  (no domiciliado)",
      pendiente_sede: 680.13,
      sin_calendario: true,
      notas: "En periodo ejecutivo, pendiente de pago.",
      plazos: [],
    },

    /* ARAVIVA INVERSIONES SL (B22751457) NO va aquí (Alberto, 12/09/2026):
       es una sociedad independiente, con su propia contabilidad y su propia
       cuenta, y ARA-OS es el sistema de ARA Corporate. Su aplazamiento de IVA
       4T-2025 (expte. 412640315476J, ~700 €/mes hasta 22-03-2027) se controla
       aparte; queda documentado en el proyecto, no en este panel. */
  ],

  /* Diligencias de embargo vistas en los movimientos de la ES81.
     Corresponden a las sanciones de 2024 que siguen en periodo ejecutivo:
     la diligencia queda viva y vuelve a barrer la cuenta cuando entra saldo. */
  embargos: [
    { fecha: "2026-01-15", diligencia: "412520028273G", importe: 46.79, organismo: "AEAT", identificado: true },
    { fecha: "2026-03-17", diligencia: "412620190040Z", importe: 652.40, organismo: "AEAT", identificado: true },
  ],

  /* Deudas que constaban en PDF de Descargas y que la sede YA NO recoge:
     están extinguidas. Se guardan para no volver a contarlas. */
  extinguidas: [
    { referencia: "A4185426200002245", concepto: "Apremio IS 2023", importe: 440.12, comprobado: "2026-09-12 · no figura en la relación de deudas" },
    { referencia: "A4160426530017164", concepto: "Apremio IVA 4T 2025", importe: 3335.65, comprobado: "2026-09-12 · no figura en la relación de deudas" },
  ],

  /* Impuestos periódicos que se autoliquidan cada trimestre. No hay acuerdo
     ni calendario que descargar: el importe se calcula del propio movimiento
     de las cuentas de Hacienda en Holded durante el trimestre en curso.
     Presentación: del 1 al 20 del mes siguiente al fin de trimestre. */
  periodicos: [
    {
      id: "mod111",
      modelo: "111",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      concepto: "IRPF · retenciones de trabajadores y profesionales",
      cuentas: ["4751"],
      notas: "Lo retenido en las nóminas cada trimestre. No es dinero de la empresa: se descuenta al trabajador y se ingresa a Hacienda. Si el saldo de la 4751 crece por encima del trimestre en curso, hay algún 111 sin ingresar.",
    },
    {
      id: "mod303",
      modelo: "303",
      organismo: "AEAT",
      sociedad: "ARA CORPORATE",
      concepto: "IVA · autoliquidación trimestral",
      cuentas: ["4750"],
      notas: "Estimación por el saldo contable de la 4750 en el trimestre. La cifra buena la da el modelo: aquí sólo para tener la fecha y el orden de magnitud.",
    },
  ],

  /* Obligaciones recurrentes: no hay calendario cerrado, se estima */
  recurrentes: [
    {
      id: "tgss-regimen-general",
      organismo: "TGSS",
      sociedad: "ARA CORPORATE",
      concepto: "Cotización régimen general (recibo mensual)",
      cuenta: "ES81 0049 …2567",
      dia: "último día del mes",
      patron: /RECIBO TGSS|COTIZACION 001|SEGURIDAD SOCIAL/i,
      notas: "Es el pago más grande del mes, cinco veces el plazo del aplazamiento.",
    },
  ],
};

/* ══════════════════════════════════════════════════════════════════
   LECTURA DE HOLDED
   ══════════════════════════════════════════════════════════════════ */

async function holdedGet(base, ruta, params = {}) {
  const tok = process.env.HOLDED_API_TOKEN || "";
  if (!tok) return { ok: false, status: 500, error: "Falta HOLDED_API_TOKEN en entorno" };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  const url = `${base}${ruta}${qs.toString() ? "?" + qs.toString() : ""}`;
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

// Apuntes de cuentas de banco (57*) y de Hacienda (47*) en el rango
async function apuntesBanco(desde, hasta) {
  const out = [];
  const hacienda = {};
  let cursor = null, paginas = 0, error = null;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const params = { start_date: desde, end_date: hasta, limit: String(LIMITE_PAGINA) };
    if (cursor) params.cursor = cursor;
    const pag = await holdedGet(HOLDED_V2, "/ledger-entries", params);
    if (!pag.ok) { error = pag.error; break; }
    paginas++;
    for (const l of (pag.data && pag.data.items) || []) {
      const cta = String(l.account || "");
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(l.date || "");
      const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
      if (!iso) continue;
      const debe = Number(l.debit) || 0, haber = Number(l.credit) || 0;
      if (/^57/.test(cta)) {
        out.push({
          fecha: iso,
          cuenta: cta,
          descripcion: String(l.description || ""),
          salida: r2(haber - debe),   // > 0 = dinero que sale del banco
        });
      } else if (/^47/.test(cta)) {
        // Cuentas de Hacienda: saldo acreedor = haber − debe.
        // Se excluyen los asientos de reclasificación/regularización (los
        // "RECL-…" del 07-09-2026, por ejemplo): mueven decenas de miles entre
        // cuentas sin que eso sea ni una retención ni un ingreso a Hacienda,
        // y falsean por completo el importe del trimestre.
        const desc = String(l.description || "");
        if (/RECL-|reclasific|regulariz|cierre|apertura/i.test(desc)) continue;
        (hacienda[cta] = hacienda[cta] || []).push({ fecha: iso, saldo: r2(haber - debe) });
      }
    }
    if (!pag.data || !pag.data.has_more || !pag.data.cursor) break;
    cursor = pag.data.cursor;
  }
  return { apuntes: out, hacienda, paginas, error };
}

// Trimestre natural de una fecha y su vencimiento de presentación (día 20 del
// mes siguiente al cierre; si cae en fin de semana, el lunes siguiente)
function trimestreDe(iso) {
  const [a, m] = iso.split("-").map(Number);
  const t = Math.floor((m - 1) / 3) + 1;
  const mesFin = t * 3;
  const anioVto = mesFin === 12 ? a + 1 : a;
  const mesVto = mesFin === 12 ? 1 : mesFin + 1;
  let v = new Date(Date.UTC(anioVto, mesVto - 1, 20));
  while (v.getUTCDay() === 0 || v.getUTCDay() === 6) v = new Date(v.getTime() + 86400000);
  return {
    etiqueta: `${t}T ${a}`,
    desde: `${a}-${pad2(mesFin - 2)}-01`,
    hasta: `${a}-${pad2(mesFin)}-31`,
    vencimiento: v.toISOString().slice(0, 10),
  };
}

// Importe del trimestre en curso y saldo acumulado de las cuentas del modelo
function calcularPeriodico(def, hacienda, hoy) {
  const tr = trimestreDe(hoy);
  let trimestre = 0, acumulado = 0;
  for (const [cta, movs] of Object.entries(hacienda)) {
    if (!def.cuentas.some(p => cta.startsWith(p))) continue;
    for (const mv of movs) {
      acumulado += mv.saldo;
      if (mv.fecha >= tr.desde && mv.fecha <= tr.hasta) trimestre += mv.saldo;
    }
  }
  trimestre = r2(trimestre); acumulado = r2(acumulado);
  const { cuentas, ...limpio } = def;
  // Un importe negativo significa que en el trimestre se ha pagado más de lo
  // devengado, o que la contabilidad de esa cuenta tiene apuntes que no son ni
  // devengo ni ingreso. En ese caso no se enseña una cifra: se dice que no es
  // fiable. Mejor un hueco que un número inventado.
  const fiable = trimestre >= 0;
  return {
    ...limpio,
    periodo: tr.etiqueta,
    vencimiento: tr.vencimiento,
    importe_trimestre: trimestre,
    saldo_acumulado: acumulado,
    fiable,
    motivo_no_fiable: fiable ? null : "El movimiento del trimestre en esta cuenta sale negativo: hay pagos o apuntes que no cuadran con el devengo. Revisar el mayor antes de fiarse.",
    // Si lo acumulado supera lo del trimestre en curso, hay saldo de
    // trimestres anteriores que debería estar ya ingresado.
    arrastre: fiable ? r2(Math.max(0, acumulado - trimestre)) : 0,
  };
}

// La API v1 de tesorería no usa Bearer: va con la cabecera "key" y HOLDED_API_KEY,
// igual que en ara-os-holded.cjs. Cuentas corrientes reales: 57200001 y 57200006.
const CUENTAS_TESORERIA = [57200001, 57200006];
const CUENTA_POLIZA = 57200007;

async function saldosBanco() {
  const KEY = process.env.HOLDED_API_KEY || "";
  if (!KEY) return { ok: false, error: "Falta HOLDED_API_KEY", cuentas: [], total: 0, poliza: null };
  try {
    const r = await fetch(`${HOLDED_V1}/treasury`, { headers: { key: KEY, Accept: "application/json" } });
    if (!r.ok) return { ok: false, error: `Holded respondió ${r.status}`, cuentas: [], total: 0, poliza: null };
    const todas = await r.json();
    if (!Array.isArray(todas)) return { ok: false, error: "Respuesta inesperada de tesorería", cuentas: [], total: 0, poliza: null };
    const cuentas = todas.filter(c => CUENTAS_TESORERIA.includes(c.accountNumber))
                         .map(c => ({ nombre: c.name || "—", saldo: r2(Number(c.balance) || 0) }));
    const pol = todas.find(c => c.accountNumber === CUENTA_POLIZA) || null;
    return {
      ok: true,
      cuentas,
      total: r2(cuentas.reduce((s, c) => s + c.saldo, 0)),
      poliza: pol ? { nombre: pol.name, disponible: r2(Number(pol.balance) || 0) } : null,
    };
  } catch (e) {
    return { ok: false, error: e.message, cuentas: [], total: 0, poliza: null };
  }
}

/* ══════════════════════════════════════════════════════════════════
   CRUCE
   ══════════════════════════════════════════════════════════════════ */

const TOLERANCIA_IMPORTE = 0.05;
const VENTANA_DIAS = 10;
const DIAS_PARA_IMPAGADO = 45;

function casarPlazo(plazo, apuntes, usados) {
  let mejor = null;
  for (let i = 0; i < apuntes.length; i++) {
    if (usados.has(i)) continue;
    const a = apuntes[i];
    if (Math.abs(a.salida - plazo.importe) > TOLERANCIA_IMPORTE) continue;
    const d = Math.abs(dias(a.fecha, plazo.fecha));
    if (d > VENTANA_DIAS) continue;
    if (!mejor || d < mejor.d) mejor = { i, d, a };
  }
  if (mejor) usados.add(mejor.i);
  return mejor;
}

function estadoPlazo(plazo, casado, hoy) {
  if (casado) return "pagado";
  const d = dias(hoy, plazo.fecha);
  if (d < 0) return "pendiente";
  if (d > DIAS_PARA_IMPAGADO) return "impagado";
  return "sin_confirmar";
}

async function construir(force = false) {
  if (!force && _cache && Date.now() - _cache.ts < TTL) return _cache.data;

  const hoy = hoyISO();
  const año = new Date().getFullYear();
  const { apuntes, hacienda, error: errApuntes } = await apuntesBanco(`${año}-01-01`, `${año}-12-31`);
  const saldos = await saldosBanco();

  const usados = new Set();
  const expedientes = CALENDARIO.expedientes.map(exp => {
    // Deudas sin calendario de plazos (ejecutivo, o aplazamiento cuyo acuerdo
    // no tenemos): el pendiente es el que dice la sede, no hay nada que casar.
    if (exp.sin_calendario) {
      return {
        ...exp,
        plazos: [],
        pagado: 0,
        pendiente: r2(exp.pendiente_sede || 0),
        total: r2(exp.pendiente_sede || 0),
        proximo: null,
        alerta: exp.tipo === "ejecutivo",
      };
    }
    const plazos = exp.plazos.map(p => {
      const casado = exp.sin_cruce ? null : casarPlazo(p, apuntes, usados);
      const estado = exp.sin_cruce ? (dias(hoy, p.fecha) < 0 ? "pendiente" : "sin_confirmar")
                                   : estadoPlazo(p, casado, hoy);
      return {
        fecha: p.fecha,
        importe: p.importe,
        estado,
        cargo: casado ? { fecha: casado.a.fecha, descripcion: casado.a.descripcion.slice(0, 90) } : null,
      };
    });
    // En expedientes que no se pueden cruzar (otra sociedad, otra cuenta), los
    // plazos ya vencidos se dan por atendidos: contarlos como pendientes
    // inflaría la deuda con dinero que casi seguro está pagado. Se marcan
    // aparte para que quede claro que nadie los ha verificado.
    const noVerificados = exp.sin_cruce ? plazos.filter(p => p.estado === "sin_confirmar") : [];
    const cuentanPendiente = exp.sin_cruce
      ? plazos.filter(p => p.estado === "pendiente")
      : plazos.filter(p => p.estado !== "pagado");
    const pendiente = r2(cuentanPendiente.reduce((s, p) => s + p.importe, 0));
    const pagado = r2(plazos.filter(p => p.estado === "pagado").reduce((s, p) => s + p.importe, 0));
    const importe_no_verificado = r2(noVerificados.reduce((s, p) => s + p.importe, 0));
    const proximo = plazos.find(p => p.estado === "pendiente") || null;
    return {
      ...exp, plazos, pendiente, pagado, proximo, importe_no_verificado,
      total: r2(plazos.reduce((s, p) => s + p.importe, 0)),
      alerta: plazos.some(p => p.estado === "impagado"),
    };
  });

  // Recurrentes: los últimos cargos detectados y la media
  const recurrentes = CALENDARIO.recurrentes.map(rec => {
    const hits = apuntes.filter(a => rec.patron.test(a.descripcion) && a.salida > 0)
                        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const ult = hits.slice(0, 3);
    const media = ult.length ? r2(ult.reduce((s, x) => s + x.salida, 0) / ult.length) : null;
    const { patron, ...limpio } = rec;
    return { ...limpio, ultimos: ult.map(x => ({ fecha: x.fecha, importe: x.salida })), media_3m: media };
  });

  // Impuestos periódicos del trimestre en curso
  const periodicos = CALENDARIO.periodicos.map(p => calcularPeriodico(p, hacienda, hoy));

  // Próximos 30 días
  const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const proximos = [];
  for (const exp of expedientes) {
    for (const p of exp.plazos) {
      if (p.estado === "pendiente" && p.fecha <= limite) {
        proximos.push({ fecha: p.fecha, importe: p.importe, quien: exp.sociedad, que: exp.concepto, cuenta: exp.cuenta });
      }
    }
  }
  for (const rec of recurrentes) {
    if (rec.media_3m) proximos.push({ fecha: `fin de mes`, importe: rec.media_3m, quien: rec.sociedad, que: rec.concepto + " (estimado)", cuenta: rec.cuenta, estimado: true });
  }
  for (const p of periodicos) {
    if (p.vencimiento <= limite && p.fiable && p.importe_trimestre > 0) {
      proximos.push({ fecha: p.vencimiento, importe: p.importe_trimestre, quien: p.sociedad, que: `Modelo ${p.modelo} · ${p.concepto} (${p.periodo}, estimado)`, cuenta: "domiciliación o pago en sede", estimado: true });
    }
  }
  proximos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const deuda_total = r2(expedientes.reduce((s, e) => s + e.pendiente, 0));
  const comprometido_30d = r2(proximos.reduce((s, p) => s + p.importe, 0));

  const avisos = [];
  const ejecutivo = expedientes.filter(e => e.tipo === "ejecutivo");
  const totalEjecutivo = r2(ejecutivo.reduce((s, e) => s + e.pendiente, 0));
  if (ejecutivo.length) {
    avisos.push({ nivel: "rojo", texto: `${totalEjecutivo.toFixed(2)} € en periodo ejecutivo (${ejecutivo.length} deudas). Es lo que mantiene vivas las diligencias de embargo sobre la ES81.` });
    avisos.push({ nivel: "rojo", texto: "Los acuerdos de aplazamiento están condicionados a estar al corriente. Con deuda en ejecutivo, la AEAT puede cancelarlos y exigir el resto de golpe con recargo." });
  }
  for (const e of expedientes) {
    if (e.alerta && e.tipo !== "ejecutivo") avisos.push({ nivel: "rojo", texto: `${e.concepto} (${e.sociedad}): vencido y sin constancia de pago — ${e.pendiente.toFixed(2)} €` });
  }
  for (const e of expedientes) {
    if (e.importe_no_verificado > 0) {
      avisos.push({ nivel: "ambar", texto: `${e.concepto} (${e.sociedad}): ${e.importe_no_verificado.toFixed(2)} € de plazos ya vencidos que no se pueden verificar desde aquí (cuenta ${e.cuenta}). Se dan por pagados; conviene mirar el extracto.` });
    }
    if (e.sin_calendario && e.tipo === "aplazamiento") {
      avisos.push({ nivel: "ambar", texto: `${e.concepto}: consta aplazada en la sede pero no tenemos el acuerdo con sus plazos (${e.pendiente.toFixed(2)} €). Descargarlo y cargarlo en el calendario.` });
    }
  }
  for (const p of periodicos) {
    if (!p.fiable) {
      avisos.push({ nivel: "ambar", texto: `Modelo ${p.modelo} (${p.concepto}): no se puede estimar el importe del ${p.periodo} desde la contabilidad. ${p.motivo_no_fiable}` });
    }
    if (p.arrastre > 100) {
      avisos.push({ nivel: "ambar", texto: `Modelo ${p.modelo} (${p.concepto}): quedan ${p.arrastre.toFixed(2)} € de saldo acreedor de trimestres anteriores al ${p.periodo}. O falta ingresar alguna autoliquidación, o falta contabilizar el pago.` });
    }
  }
  if (saldos.ok && comprometido_30d > saldos.total) {
    avisos.push({ nivel: "ambar", texto: `Los pagos de los próximos 30 días (${comprometido_30d.toFixed(2)} €) superan la caja disponible (${saldos.total.toFixed(2)} €).` });
  }

  const data = {
    ok: true,
    generado: new Date().toISOString(),
    calendario_actualizado: CALENDARIO.actualizado,
    fuente: CALENDARIO.fuente,
    resumen: { deuda_total, comprometido_30d, caja: saldos.ok ? saldos.total : null },
    avisos,
    expedientes,
    periodicos,
    recurrentes,
    embargos: CALENDARIO.embargos,
    extinguidas: CALENDARIO.extinguidas,
    proximos,
    caja: saldos,
    cruce: { apuntes_banco: apuntes.length, error: errApuntes || null },
    nota_metodo: "El cruce compara cada plazo con los apuntes CONTABILIZADOS de las cuentas 57*. Un plazo 'sin confirmar' puede estar cargado en el banco y pendiente de conciliar: no significa impagado.",
  };
  _cache = { ts: Date.now(), data };
  return data;
}

/* ══════════════════════════════════════════════════════════════════
   RUTAS
   ══════════════════════════════════════════════════════════════════ */

module.exports = function (app) {
  const responderCORS = res => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  };

  app.options("/api/ara-os/obligaciones", (req, res) => { responderCORS(res); res.status(204).end(); });

  app.get("/api/ara-os/obligaciones", async (req, res) => {
    responderCORS(res);
    try {
      const data = await construir(String(req.query.force || "") === "1");
      res.json(data);
    } catch (e) {
      console.error("[ara-os-obligaciones]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/panel-obligaciones", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "panel-obligaciones.html"));
  });

  console.log("[ara-os-obligaciones] v0.1.0 · /api/ara-os/obligaciones · /panel-obligaciones");
};

module.exports.CALENDARIO = CALENDARIO;
module.exports.construir = construir;
