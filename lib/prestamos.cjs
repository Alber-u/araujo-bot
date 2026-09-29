// ============================================================
// lib/prestamos.cjs — Préstamos (recibidos y concedidos)
// ============================================================
// Los datos viven en la pestaña `prestamos` de la hoja de Google
// (GOOGLE_SHEETS_ID). En este archivo NO hay importes ni nombres:
// solo la lógica para convertir cada fila en su calendario de
// cuotas y su saldo vivo.
//
// Columnas:
//   id | tipo (recibido/concedido) | contraparte | cuenta_holded |
//   principal | fecha_inicio | cuota |
//   periodicidad (mensual/trimestral/ninguna) | n_cuotas |
//   dia_cargo | cuotas_detalle | activo | nota
//
// Reglas:
//   - cuotas_detalle ("2026-10-28:1000.50;2026-11-28:1000.50"),
//     si está relleno, manda sobre cuota/n_cuotas/periodicidad.
//   - Si no, el calendario se genera así: cuota k (1..n_cuotas) cae
//     k periodos después de fecha_inicio, el día `dia_cargo` (o el
//     día de fecha_inicio si está vacío), ajustado a fin de mes.
//   - Saldo vivo = suma de las cuotas con fecha posterior a hoy.
//   - Sin calendario (periodicidad = ninguna y sin cuotas_detalle):
//     saldo vivo = principal + aviso «sin calendario de devolución».
//   - tipo = concedido → TENGO (T5); recibido → DEBO (D10).
// ============================================================
"use strict";

const PRESTAMOS_HEADERS = [
  "id", "tipo", "contraparte", "cuenta_holded", "principal",
  "fecha_inicio", "cuota", "periodicidad", "n_cuotas", "dia_cargo",
  "cuotas_detalle", "activo", "nota",
];

const MESES_POR_PERIODO = { mensual: 1, trimestral: 3 };

// Admite "1.234,56", "1234,56", "1234.56", "1,234.56", "1.500" y
// números. Devuelve null si no es un número (nunca un 0 silencioso).
function parseImporte(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[€\s]/g, "");
  if (!s) return null;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    // El último separador es el decimal
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma > -1) {
    s = s.replace(",", ".");
  } else if (punto > -1 && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.500" / "12.000" → miles
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "2026-10-28" o "28/10/2026" → "2026-10-28" (o null)
function parseFecha(v) {
  const s = String(v == null ? "" : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function sumarMeses(fechaIso, meses, dia) {
  const [y, m] = fechaIso.split("-").map(Number);
  const idx = (m - 1) + meses;
  const yy = y + Math.floor(idx / 12), mm = (idx % 12) + 1;
  const finMes = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return iso(yy, mm, Math.min(dia, finMes));
}

function esActivo(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (s === "") return true; // vacío = activo
  return !["false", "no", "0", "n", "falso", "inactivo"].includes(s);
}

function round2(n) { return Math.round(n * 100) / 100; }

// Devuelve { cuotas: [{fecha, importe}], avisos: [] } o cuotas=null si no hay calendario.
function calendario(row) {
  const avisos = [];
  const detalle = String(row.cuotas_detalle || "").trim();
  if (detalle) {
    const cuotas = [];
    for (const trozo of detalle.split(";").map((t) => t.trim()).filter(Boolean)) {
      const i = trozo.lastIndexOf(":");
      const fecha = i > 0 ? parseFecha(trozo.slice(0, i)) : null;
      const importe = i > 0 ? parseImporte(trozo.slice(i + 1)) : null;
      if (!fecha || importe == null) { avisos.push(`cuotas_detalle: no entiendo «${trozo}»`); continue; }
      cuotas.push({ fecha, importe });
    }
    cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { cuotas, avisos };
  }

  const per = String(row.periodicidad || "").trim().toLowerCase();
  if (!per || per === "ninguna") return { cuotas: null, avisos };
  const paso = MESES_POR_PERIODO[per];
  if (!paso) { avisos.push(`periodicidad desconocida «${row.periodicidad}»`); return { cuotas: null, avisos }; }

  const inicio = parseFecha(row.fecha_inicio);
  const cuota = parseImporte(row.cuota);
  const n = parseInt(String(row.n_cuotas || "").trim(), 10);
  if (!inicio) avisos.push("falta fecha_inicio válida");
  if (cuota == null) avisos.push("falta cuota");
  if (!(n > 0)) avisos.push("falta n_cuotas");
  if (avisos.length) return { cuotas: null, avisos };

  const diaCargo = parseInt(String(row.dia_cargo || "").trim(), 10);
  const dia = diaCargo >= 1 && diaCargo <= 31 ? diaCargo : Number(inicio.slice(8, 10));
  const cuotas = [];
  for (let k = 1; k <= n; k++) cuotas.push({ fecha: sumarMeses(inicio, k * paso, dia), importe: cuota });
  return { cuotas, avisos };
}

// Convierte una fila de la hoja en un préstamo calculado a fecha `hoyIso`.
function calcularPrestamo(row, hoyIso) {
  const tipo = String(row.tipo || "").trim().toLowerCase();
  const principal = parseImporte(row.principal);
  const { cuotas, avisos } = calendario(row);
  const p = {
    id: String(row.id || "").trim(),
    tipo,
    contraparte: String(row.contraparte || "").trim(),
    cuenta_holded: String(row.cuenta_holded || "").trim(),
    principal,
    nota: String(row.nota || "").trim(),
    activo: esActivo(row.activo),
    con_calendario: !!cuotas,
    cuotas_pendientes: [],
    saldo_vivo: null,
    fiabilidad: "exacto",
    avisos,
  };
  if (tipo !== "recibido" && tipo !== "concedido") p.avisos.push(`tipo «${row.tipo}» no es recibido/concedido`);

  if (cuotas) {
    p.cuotas_pendientes = cuotas.filter((c) => c.fecha > hoyIso);
    p.saldo_vivo = round2(p.cuotas_pendientes.reduce((s, c) => s + c.importe, 0));
    if (avisos.length) p.fiabilidad = "estimado";
  } else {
    p.avisos.push("sin calendario de devolución");
    p.saldo_vivo = principal;
    p.fiabilidad = principal == null ? "sin_dato" : "estimado";
    if (principal == null) p.avisos.push("falta principal");
  }
  return p;
}

// Filas (objetos por cabecera) → resumen para la escalera y el cashflow.
function resumirPrestamos(filas, hoyIso, diasVentana = 30) {
  const limite = sumarDias(hoyIso, diasVentana);
  const prestamos = (filas || [])
    .filter((r) => r && Object.values(r).some((v) => String(v || "").trim() !== ""))
    .map((r) => calcularPrestamo(r, hoyIso))
    .filter((p) => p.activo);

  const grupo = (tipo) => {
    const lista = prestamos.filter((p) => p.tipo === tipo);
    const conDato = lista.filter((p) => p.saldo_vivo != null);
    return {
      total: conDato.length ? round2(conDato.reduce((s, p) => s + p.saldo_vivo, 0)) : (lista.length ? null : 0),
      completo: conDato.length === lista.length,
      prestamos: lista,
    };
  };

  // Cuotas de préstamos recibidos que vencen en la ventana (salen de caja)
  const cuotas_proximas = prestamos
    .filter((p) => p.tipo === "recibido")
    .flatMap((p) => p.cuotas_pendientes
      .filter((c) => c.fecha <= limite)
      .map((c) => ({ id: p.id, contraparte: p.contraparte, fecha: c.fecha, importe: c.importe })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    concedidos: grupo("concedido"), // T5
    recibidos: grupo("recibido"),   // D10
    cuotas_proximas,
    total_cuotas_proximas: round2(cuotas_proximas.reduce((s, c) => s + c.importe, 0)),
  };
}

function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Contraste con la contabilidad. saldosCuentas: { "52000001": -1000, ... }
// con deudor en positivo y acreedor en negativo (como /clientes-pendientes).
// Varios préstamos pueden compartir cuenta (una misma 542 puede mezclar lo que
// una sociedad nos debe y lo que nos prestó): se compara el NETO de la cuenta:
//   concedido → suma (nos deben, deudor) · recibido → resta (debemos, acreedor).
// Devuelve { porCuenta: [{cuenta, contable, calendario, cuadra, ids}], avisos,
// sinContrastar: [ids] } — sin contrastar = no hay cuenta o Holded no la tiene
// (p. ej. grupo 1): se indica, sin aviso rojo.
function contrasteHolded(prestamos, saldosCuentas, tolerancia = 1) {
  const grupos = {};
  const sinContrastar = [];
  for (const p of prestamos) {
    if (p.saldo_vivo == null) continue;
    const cta = p.cuenta_holded;
    if (!cta || !saldosCuentas || !(cta in saldosCuentas)) { sinContrastar.push(p.id || p.contraparte); continue; }
    const g = grupos[cta] || (grupos[cta] = { cuenta: cta, calendario: 0, ids: [] });
    g.calendario += p.tipo === "concedido" ? p.saldo_vivo : -p.saldo_vivo;
    g.ids.push(p.id || p.contraparte);
  }
  const porCuenta = Object.values(grupos).map((g) => {
    const contable = round2(Number(saldosCuentas[g.cuenta]) || 0);
    const calendario = round2(g.calendario);
    return { cuenta: g.cuenta, contable, calendario, cuadra: Math.abs(contable - calendario) <= tolerancia, ids: g.ids };
  });
  const avisos = porCuenta.filter((c) => !c.cuadra).map((c) => ({
    nivel: "ambar",
    texto: `Préstamos ${c.ids.join(" + ")}: la cuenta ${c.cuenta} de Holded da ${c.contable} € y el calendario ${c.calendario} € (deudor +, acreedor −)`,
  }));
  return { porCuenta, avisos, sinContrastar };
}

module.exports = {
  PRESTAMOS_HEADERS,
  parseImporte,
  parseFecha,
  calendario,
  calcularPrestamo,
  resumirPrestamos,
  contrasteHolded,
  sumarDias,
};
