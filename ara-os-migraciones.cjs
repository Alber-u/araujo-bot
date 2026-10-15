// ============================================================
// ARA OS — Migraciones de datos · v0.1.0 (15/10/2026)
// ============================================================
// Cambios de datos de una sola vez, idempotentes y con simulación. Nunca borran filas: lo que sobra queda con
// borrado = TRUE (obras_otras) o activa = FALSE (holded_etiquetas). Las listas de etiquetas se fusionan, no se
// reemplazan. No escriben en Holded ni en Pleo.
//
//   GET  /api/ara-os/admin/migraciones/orad-montemayor?token=…            → simulación (antes / después)
//   POST /api/ara-os/admin/migraciones/orad-montemayor?token=…&aplicar=1  → lo aplica
//        &todas=1 (opcional): además, cualquier registro de tiempo guardado con el NOMBRE de una orden de Otras
//        órdenes pasa a su id (los que lista /registros-tiempo/diagnostico/obras como «por_nombre»).
//
// Orad-Montemayor (decisión de Alberto, 15/10/2026):
//   A · Urbano Orad 13-15 es UNA orden de Otras órdenes: OO-2026-142 pasa a «CCPP Urbano Orad 13-15» (35.300 € sin
//       IVA, 640 h, 5.000 € de material, OT0143/2026); OO-2026-143 se fusiona en ella (sus entradas a cuenta,
//       partidas extra, etiquetas y registros de tiempo) y queda con borrado = TRUE.
//   B · Jorge de Montemayor 34 tuberías (OO-2026-150): sus registros de tiempo por id, su etiqueta
//       «jorgedemontemayor34tuberias» y unida (obra_relacionada) a la obra de contadores de Plan 5.
// ============================================================

const { google } = require("googleapis");
const { validToken } = require("./lib/auth.cjs");
const RO = require("./lib/obra-registro.cjs");
const { parseTagsCSV, serializeTagsCSV } = require("./lib/etiquetas-obra.cjs");

const MIGRACION = "orad-montemayor-15-10-2026";
const MARCA = "[fusión 15/10/2026]";

const ORAD = {
  destino: "OO-2026-142",
  origen: "OO-2026-143",
  datos: { nombre: "CCPP Urbano Orad 13-15", codigo_ot: "OT0143/2026", subtotal_eur: 35300, iva_pct: 10, horas_previstas: 640, material_previsto_eur: 5000, fecha_inicio: "2026-10-05", fase: "EN_EJECUCION" },
  tags: ["ot01432026ccppurbanoorad13", "ot01442026ccppurbanoorad15"],
  // contacto de Holded «COMUNIDAD DE PROPIETARIOS CL.URBANO ORAD 13-15» y su factura de anticipo (Alberto, 15/10/2026)
  contacto: "6ab38664ed647c83cb07ba87",
  anticipo: "F260049",
  // obra_id de registros de tiempo que son Urbano Orad (además de los dos nombres de las OO, leídos de la hoja)
  alias_registros: ["Urbano Orad 13-15", "OO-2026-143", "OO-2026-142+OO-2026-143", "OO-2026-143+OO-2026-142", "Urbano Orad 13", "Urbano Orad 15"],
  alias_plan: ["OO-2026-142+OO-2026-143", "OO-2026-143+OO-2026-142", "OO-2026-143"],
};
const TUBERIAS = {
  obra_id: "OO-2026-150",
  tag: "jorgedemontemayor34tuberias",
  relacionada: "ccpp_jorge_de_montemayor_34_9836ef",
  alias_registros: ["Jorge Montemayor 34 TUBERIAS"],
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (x) => { const v = parseFloat(String(x ?? "").replace(",", ".")); return isFinite(v) ? v : 0; };
const verdad = (v) => String(v || "").trim().toUpperCase() === "TRUE";
const fix2 = (n) => Number(n).toFixed(2);
function colLetra(i) { let s = ""; let n = i; while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } return s; }

// tags_holded de obras_otras: JSON '["a","b"]' (o texto con comas de las filas antiguas)
function tagsOO(celda) {
  const s = String(celda || "").trim();
  if (!s) return [];
  if (s.startsWith("[")) { try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map((t) => String(t).trim()).filter(Boolean); } catch (_) { /* sigue */ } }
  return parseTagsCSV(s);
}
const fusionar = (...listas) => { const out = [], vistos = new Set(); for (const t of listas.flat()) { const k = String(t || "").trim(); if (k && !vistos.has(k.toLowerCase())) { vistos.add(k.toLowerCase()); out.push(k); } } return out; };
const conNota = (nota, texto) => (String(nota || "").includes(texto) ? String(nota || "") : [String(nota || "").trim(), texto].filter(Boolean).join(" · "));

// tabla = { head: [...], filas: [[...]] } (fila 1 = cabeceras) → objetos con su nº de fila en la hoja
const objetos = (t) => t.filas.map((f, i) => ({ _fila: i + 2, ...Object.fromEntries(t.head.map((h, j) => [h, f[j] != null ? String(f[j]) : ""])) }));

// ============================================================
// Plan (función pura): qué cambia, sin escribir nada
// d = { obras, entradas, extras, etiquetas, registros, plan } (tablas) · opciones { todas, hoy }
// ============================================================
function planificar(d, { todas = false, ahora = new Date().toISOString(), usuario = "migración" } = {}) {
  const hoy = ahora.slice(0, 10);
  const cambios = [];            // { hoja, fila, campos: { col: [antes, después] } }
  const nuevas = [];             // { hoja, valores: {col: v} }
  const avisos = [];
  const set = (hoja, fila, campo, antes, despues) => {
    if (String(antes ?? "") === String(despues ?? "")) return;
    let c = cambios.find((x) => x.hoja === hoja && x.fila === fila);
    if (!c) cambios.push((c = { hoja, fila, campos: {} }));
    c.campos[campo] = [antes ?? "", despues];
  };

  const obras = objetos(d.obras), entradas = objetos(d.entradas), extras = objetos(d.extras), etiq = objetos(d.etiquetas), regs = objetos(d.registros), plan = objetos(d.plan);
  const obra = (id) => obras.find((o) => o.obra_id === id) || null;

  // ---------- A · Urbano Orad ----------
  const o142 = obra(ORAD.destino), o143 = obra(ORAD.origen);
  let anticipo = null;   // factura de venta del anticipo (Holded), si se vincula
  const nombresOrad = [o142?.nombre, o143?.nombre].filter(Boolean);
  if (!o142) avisos.push(`No está ${ORAD.destino} en obras_otras: no se fusiona Urbano Orad`);
  else {
    const D = ORAD.datos;
    const iva = r2(D.subtotal_eur * D.iva_pct / 100), total = r2(D.subtotal_eur + iva);
    const personas = num(o142.personas) || num(o143?.personas) || 3;
    const objetivo = {
      nombre: D.nombre, codigo_ot: D.codigo_ot, fase: D.fase, fecha_inicio: D.fecha_inicio,
      subtotal_eur: fix2(D.subtotal_eur), iva_eur: fix2(iva), total_eur: fix2(total), importe: fix2(total),
      horas_previstas: fix2(D.horas_previstas), material_previsto_eur: fix2(D.material_previsto_eur),
      dias_estimados: fix2(D.horas_previstas / (personas * 8)),
      tags_holded: JSON.stringify(fusionar(tagsOO(o142.tags_holded), tagsOO(o143?.tags_holded), ORAD.tags)),
      borrado: "FALSE",
    };
    // mismo contenido de tags (el JSON puede venir con otro formato): no se reescribe
    if (fusionar(tagsOO(o142.tags_holded)).join("|") === JSON.parse(objetivo.tags_holded).join("|")) objetivo.tags_holded = o142.tags_holded;
    let nota = o142.notas;
    if (o143 && !String(nota || "").includes(MARCA)) {
      nota = conNota(nota, `${MARCA} Una sola orden con ${ORAD.origen} (${o143.codigo_ot || "sin OT"} · «${o143.nombre}»), antes «${o142.nombre}»`);
    }
    // Cliente (Alberto, 15/10/2026): Urbano Orad se factura a UN solo contacto de Holded, «COMUNIDAD DE
    // PROPIETARIOS CL.URBANO ORAD 13-15»; los de «CCPP URBANO ORAD 13» y «… 15» no se usan ni se guardan.
    objetivo.holded_contact_id = ORAD.contacto;
    // El anticipo F260049 (22/09, 17.650 € sin IVA, cobrada): se busca en Holded (sólo lectura) por ese contacto y
    // se vincula a la orden; las entradas manuales de ese anticipo quedan conciliadas con ella (más abajo), así la
    // ficha la cuenta como factura de venta y no suma el mismo dinero dos veces.
    const fact = (d.facturas || []).find((f) => String(f.numero || "").trim().toUpperCase() === ORAD.anticipo && String(f.cliente_id || "") === ORAD.contacto);
    if (!d.facturas) avisos.push(`No se han podido leer las facturas de Holded: ${ORAD.anticipo} no se vincula ni se concilian las entradas (vuelve a lanzar la migración)`);
    else if (!fact) avisos.push(`No encuentro ${ORAD.anticipo} del contacto ${ORAD.contacto} en Holded: no se vincula ni se concilian las entradas`);
    else {
      const otra = obras.find((o) => o.obra_id !== ORAD.destino && o.obra_id !== ORAD.origen && !verdad(o.borrado) && o.holded_invoice_emitida_id === fact.id);
      if (otra) avisos.push(`${ORAD.anticipo} ya está vinculada a ${otra.obra_id} («${otra.nombre}»): no se vincula a ${ORAD.destino}`);
      else if (o142.holded_invoice_emitida_id && o142.holded_invoice_emitida_id !== fact.id) avisos.push(`${ORAD.destino} ya tiene otra factura vinculada (${o142.holded_invoice_emitida_id}): no se cambia por ${ORAD.anticipo}`);
      else { objetivo.holded_invoice_emitida_id = fact.id; anticipo = fact; }
    }
    for (const k of ["holded_invoice_emitida_id", "holded_invoice_id"]) {
      if (o143?.[k] && o143[k] !== fact?.id && o143[k] !== o142[k]) {
        avisos.push(`${ORAD.origen} tenía su propia factura vinculada (${k} = ${o143[k]}): queda anotada en la orden única, no se vincula`);
        nota = conNota(nota, `factura que tenía ${ORAD.origen}: ${o143[k]}`);
      }
    }
    objetivo.notas = nota;
    for (const [k, v] of Object.entries(objetivo)) set("obras_otras", o142._fila, k, o142[k], v);
    if (o143) {
      set("obras_otras", o143._fila, "borrado", o143.borrado, "TRUE");
      set("obras_otras", o143._fila, "notas", o143.notas, conNota(o143.notas, `${MARCA} Fusionada en ${ORAD.destino} («${D.nombre}»)`));
    }
    // cobros: las entradas a cuenta de la 143 pasan a la 142 (mismo entrada_id, misma conciliación con la factura)
    for (const e of entradas.filter((x) => x.obra_id === ORAD.origen)) {
      set("obras_otras_entradas_cuenta", e._fila, "obra_id", e.obra_id, ORAD.destino);
      set("obras_otras_entradas_cuenta", e._fila, "concepto", e.concepto, String(e.concepto || "").startsWith(`(${ORAD.origen})`) ? e.concepto : `(${ORAD.origen}) ${e.concepto || ""}`.trim());
    }
    for (const x of extras.filter((x) => x.obra_id === ORAD.origen)) set("obras_otras_partidas_extra", x._fila, "obra_id", x.obra_id, ORAD.destino);
    // las entradas manuales del anticipo («50 % anticipo F260049»), conciliadas con la factura: siguen en la orden
    // (y en el listado de entradas), pero el cobro lo cuenta la factura. Si ninguna nombra la factura, las que
    // sin conciliar suman su importe.
    if (anticipo) {
      const deOrad = entradas.filter((e) => [ORAD.destino, ORAD.origen].includes(e.obra_id) && !verdad(e.borrado));
      const libres = deOrad.filter((e) => !String(e.conciliada_con_invoice_id || "").trim());
      let aConciliar = libres.filter((e) => String(e.concepto || "").toUpperCase().includes(ORAD.anticipo));
      if (!aConciliar.length && Math.abs(libres.reduce((t, e) => t + num(e.importe), 0) - num(anticipo.total)) <= 1) aConciliar = libres;
      const suma = r2(aConciliar.reduce((t, e) => t + num(e.importe), 0)) + r2(deOrad.filter((e) => e.conciliada_con_invoice_id === anticipo.id).reduce((t, e) => t + num(e.importe), 0));
      if (suma > num(anticipo.total) + 1) avisos.push(`Las entradas a conciliar con ${ORAD.anticipo} suman ${suma} € y la factura ${num(anticipo.total)} €: no se concilian`);
      else for (const e of aConciliar) {
        set("obras_otras_entradas_cuenta", e._fila, "conciliada_con_invoice_id", e.conciliada_con_invoice_id, anticipo.id);
        set("obras_otras_entradas_cuenta", e._fila, "conciliada_at", e.conciliada_at, ahora);
      }
      if (!aConciliar.length && !deOrad.some((e) => e.conciliada_con_invoice_id === anticipo.id)) avisos.push(`No hay entradas manuales de ${ORAD.anticipo} que conciliar`);
    }
    // holded_etiquetas: la de la 142, con las dos; la de la 143 deja de contar (activa = FALSE, no se borra)
    const e142 = etiq.find((e) => e.obra_id === ORAD.destino), e143 = etiq.find((e) => e.obra_id === ORAD.origen);
    const tagsE = fusionar(parseTagsCSV(e142?.etiqueta_holded), parseTagsCSV(e143?.etiqueta_holded), ORAD.tags);
    if (e142) {
      if (parseTagsCSV(e142.etiqueta_holded).join("|") !== tagsE.join("|")) set("holded_etiquetas", e142._fila, "etiqueta_holded", e142.etiqueta_holded, serializeTagsCSV(tagsE));
      set("holded_etiquetas", e142._fila, "activa", e142.activa, "TRUE");
      set("holded_etiquetas", e142._fila, "nombre_comunidad", e142.nombre_comunidad, D.nombre);
      set("holded_etiquetas", e142._fila, "notas", e142.notas, conNota(e142.notas, `${MARCA} con las de ${ORAD.origen}`));
    } else {
      nuevas.push({ hoja: "holded_etiquetas", valores: { obra_id: ORAD.destino, etiqueta_holded: serializeTagsCSV(tagsE), nombre_comunidad: D.nombre, tipo_obra: "otras", fecha_asignacion: hoy, activa: "TRUE", notas: `${MARCA} con las de ${ORAD.origen}` } });
    }
    if (e143) {
      set("holded_etiquetas", e143._fila, "activa", e143.activa, "FALSE");
      set("holded_etiquetas", e143._fila, "notas", e143.notas, conNota(e143.notas, `${MARCA} fusionada en ${ORAD.destino}`));
    }
    // planificación (historial de cambios): la tarjeta «A+B» y la 143 son la 142
    for (const p of plan.filter((x) => ORAD.alias_plan.includes(String(x.obra_id || "").trim()))) set("planificacion_obras", p._fila, "obra_id", p.obra_id, ORAD.destino);
  }

  // ---------- B · Jorge de Montemayor 34 tuberías ----------
  const o150 = obra(TUBERIAS.obra_id);
  if (!o150) avisos.push(`No está ${TUBERIAS.obra_id} en obras_otras: no se tocan las tuberías de Jorge de Montemayor`);
  else {
    const tags = fusionar(tagsOO(o150.tags_holded), [TUBERIAS.tag]);
    if (tagsOO(o150.tags_holded).join("|") !== tags.join("|")) set("obras_otras", o150._fila, "tags_holded", o150.tags_holded, JSON.stringify(tags));
    if (!o150.obra_relacionada) set("obras_otras", o150._fila, "obra_relacionada", o150.obra_relacionada, TUBERIAS.relacionada);
    else if (o150.obra_relacionada !== TUBERIAS.relacionada) avisos.push(`${TUBERIAS.obra_id} ya está unida a ${o150.obra_relacionada}: no se cambia`);
    const e150 = etiq.find((e) => e.obra_id === TUBERIAS.obra_id);
    if (e150) {
      const t = fusionar(parseTagsCSV(e150.etiqueta_holded), [TUBERIAS.tag]);
      if (parseTagsCSV(e150.etiqueta_holded).join("|") !== t.join("|")) set("holded_etiquetas", e150._fila, "etiqueta_holded", e150.etiqueta_holded, serializeTagsCSV(t));
      set("holded_etiquetas", e150._fila, "activa", e150.activa, "TRUE");
    } else {
      nuevas.push({ hoja: "holded_etiquetas", valores: { obra_id: TUBERIAS.obra_id, etiqueta_holded: TUBERIAS.tag, nombre_comunidad: o150.nombre, tipo_obra: "otras", fecha_asignacion: hoy, activa: "TRUE", notas: `${MARCA} tuberías de Jorge de Montemayor 34` } });
    }
  }

  // ---------- registros de tiempo ----------
  const destinoDe = new Map();   // clave normalizada → id
  if (o142) for (const a of [...ORAD.alias_registros, ...nombresOrad, ORAD.datos.nombre]) destinoDe.set(RO.normClave(a), ORAD.destino);
  if (o150) for (const a of [...TUBERIAS.alias_registros, o150.nombre]) destinoDe.set(RO.normClave(a), TUBERIAS.obra_id);
  const idx = RO.indiceObrasOtras(d.obras.filas);
  const reescritos = [];
  for (const r of regs) {
    if (verdad(r.borrado) || !r.obra_id) continue;
    let nuevo = destinoDe.get(RO.normClave(r.obra_id)) || null;
    // la 142 por su id ya está bien; cualquier otro id se queda como está
    if (!nuevo && todas && !idx.porId.has(r.obra_id.trim())) nuevo = RO.resolverOO(r.obra_id, idx);
    if (!nuevo || nuevo === r.obra_id) continue;
    set("registros_tiempo", r._fila, "obra_id", r.obra_id, nuevo);
    set("registros_tiempo", r._fila, "updated_at", r.updated_at, ahora);
    set("registros_tiempo", r._fila, "updated_by", r.updated_by, `${usuario} (${MIGRACION})`);
    reescritos.push({ registro_id: r.registro_id, fecha: r.fecha, horas: num(r.horas), antes: r.obra_id, despues: nuevo, snapshot: r });
  }
  return { cambios, nuevas, avisos, reescritos };
}

// Antes / después legible: las órdenes, sus cobros y etiquetas, y las horas por obra_id
function resumen(d, p, { desde = "2026-10-01", hasta = "2026-10-15" } = {}) {
  const despues = (tabla, hoja) => {
    const filas = tabla.filas.map((f) => [...f]);
    for (const c of p.cambios.filter((x) => x.hoja === hoja)) for (const [k, [, v]] of Object.entries(c.campos)) {
      const j = tabla.head.indexOf(k); if (j >= 0) { const f = filas[c.fila - 2]; while (f.length <= j) f.push(""); f[j] = v; }
    }
    for (const n of p.nuevas.filter((x) => x.hoja === hoja)) filas.push(tabla.head.map((h) => n.valores[h] ?? ""));
    return { head: tabla.head, filas };
  };
  const foto = (dd) => {
    const obras = objetos(dd.obras), entradas = objetos(dd.entradas), etiq = objetos(dd.etiquetas), regs = objetos(dd.registros);
    const ids = [ORAD.destino, ORAD.origen, TUBERIAS.obra_id];
    const cobrado = (id, soloLibres = false) => r2(entradas.filter((e) => e.obra_id === id && !verdad(e.borrado) && (!soloLibres || !String(e.conciliada_con_invoice_id || "").trim())).reduce((t, e) => t + num(e.importe), 0));
    const horas = {};
    for (const r of regs) {
      if (verdad(r.borrado) || !r.obra_id || (r.tipo && r.tipo !== "trabajo" && r.tipo !== "extra")) continue;
      const k = r.obra_id.trim();
      const x = horas[k] || (horas[k] = { total: 0, periodo: 0 });
      x.total = r2(x.total + num(r.horas));
      if (r.fecha >= desde && r.fecha <= hasta) x.periodo = r2(x.periodo + num(r.horas));
    }
    const interesa = new Set([...ids, ...ORAD.alias_registros, ...TUBERIAS.alias_registros, ...p.reescritos.flatMap((r) => [r.antes, r.despues])]);
    return {
      obras: ids.map((id) => obras.find((o) => o.obra_id === id)).filter(Boolean).map((o) => ({
        obra_id: o.obra_id, nombre: o.nombre, codigo_ot: o.codigo_ot, fase: o.fase, borrado: verdad(o.borrado),
        subtotal_eur: num(o.subtotal_eur), total_eur: num(o.total_eur), horas_previstas: num(o.horas_previstas), material_previsto_eur: num(o.material_previsto_eur),
        fecha_inicio: o.fecha_inicio, tags_holded: tagsOO(o.tags_holded), obra_relacionada: o.obra_relacionada || "",
        holded_contact_id: o.holded_contact_id || "", factura_vinculada: o.holded_invoice_emitida_id || "",
        cobrado_entradas: cobrado(o.obra_id), entradas_sin_conciliar: cobrado(o.obra_id, true) })),
      etiquetas: etiq.filter((e) => ids.includes(e.obra_id)).map((e) => ({ obra_id: e.obra_id, etiquetas: parseTagsCSV(e.etiqueta_holded), activa: verdad(e.activa) })),
      horas_registros: Object.fromEntries(Object.entries(horas).filter(([k]) => interesa.has(k))),
    };
  };
  const dDesp = { ...d, obras: despues(d.obras, "obras_otras"), entradas: despues(d.entradas, "obras_otras_entradas_cuenta"), etiquetas: despues(d.etiquetas, "holded_etiquetas"), registros: despues(d.registros, "registros_tiempo") };
  return { periodo: { desde, hasta }, antes: foto(d), despues: foto(dDesp) };
}

// ============================================================
// Nombres sueltos (15/10/2026, Alberto): registros de tiempo con un texto que no es ninguna orden, a la obra que
// él ha dicho. Plan 5 se ficha con el nombre de la comunidad (comunidades!A / ordenes_trabajo!A); Otras órdenes,
// con su id. «lavin 6» y «Doña francisquita 9» se quedan como están hasta saber a qué van.
// ============================================================
const MIGRACION_NOMBRES = "nombres-sueltos-15-10-2026";
// fuente (texto del registro) → destino: { obra } (nombre de la obra a buscar) u { oo } (id de Otras órdenes)
const NOMBRES_SUELTOS = [
  { fuentes: ["DOCTOR FEDRIANI 39"], obra: "Doctor Fedriani 39" },
  { fuentes: ["PLAN CINCO CCPP BETIS 20 (G)"], obra: "Betis 20" },
  { fuentes: ["villanueva 3"], obra: "Villanueva 3" },
  { fuentes: ["la oliva 67 cambio de tomas"], obra: "La Oliva 67" },
  { fuentes: ["la oliva 102", "LA OLIVA 102"], obra: "La Oliva 102" },
  { fuentes: ["Ciudad Jardin"], obra: "Ciudad Jardín 85" },
  { fuentes: ["marques de nervion 99"], obra: "Marqués de Nervión 99" },
  { fuentes: ["Parque miraflores"], obra: "Parque Miraflores 5" },
  { fuentes: ["RAMON Y CAJAL 28"], obra: "Ramón y Cajal 28" },
  { fuentes: ["FURGONETA TALLER", "FURGONETA ITV"], oo: "OO-2026-032", debe_contener: "furgoneta" },
];
// palabras de una obra sin ruido («CCPP», «Plan Cinco», «C/», tildes…): «PLAN CINCO CCPP BETIS 20 (G)» → betis 20 g
const RUIDO = new Set(["ccpp", "cpp", "cp", "c", "calle", "cl", "plan", "cinco", "comunidad", "de", "propietarios", "sevilla"]);
const palabras = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w && !RUIDO.has(w));
// ¿las palabras de la clave van seguidas dentro de las del nombre? («la oliva 67» sí en «la oliva 67»; «betis 20» sí
// en «betis 20 g»; «oliva 10» no en «oliva 102»)
function contiene(nombre, clave) {
  const n = palabras(nombre), k = palabras(clave);
  if (!k.length) return false;
  for (let i = 0; i + k.length <= n.length; i++) if (k.every((w, j) => n[i + j] === w)) return true;
  return false;
}

// d = { obras, registros } (tablas) · plan5: nombres de comunidades y OT
function planificarNombres(d, plan5, { ahora = new Date().toISOString(), usuario = "migración", mapa = NOMBRES_SUELTOS } = {}) {
  const cambios = [], avisos = [], reescritos = [], destinos = [];
  const obras = objetos(d.obras).filter((o) => o.obra_id && !verdad(o.borrado));
  const nombresP5 = [...new Set((plan5 || []).map((x) => String(x || "").trim()).filter(Boolean))];
  const regs = objetos(d.registros);
  const set = (fila, campo, antes, despues) => {
    let c = cambios.find((x) => x.fila === fila);
    if (!c) cambios.push((c = { hoja: "registros_tiempo", fila, campos: {} }));
    c.campos[campo] = [antes ?? "", despues];
  };
  for (const m of mapa) {
    let destino = null, tipo = null;
    if (m.oo) {
      const o = obras.find((x) => x.obra_id === m.oo);
      if (!o) avisos.push(`${m.fuentes.join(" / ")}: no está la orden ${m.oo} (o está borrada); no se toca`);
      else if (m.debe_contener && !palabras(o.nombre).includes(m.debe_contener)) avisos.push(`${m.fuentes.join(" / ")}: ${m.oo} se llama «${o.nombre}», no parece la de ${m.debe_contener}; no se toca`);
      else { destino = o.obra_id; tipo = `Otras órdenes («${o.nombre}»)`; }
    } else {
      // primero igual (sin ruido), si no, que contenga la clave; tiene que salir UNA sola obra entre Plan 5 y Otras órdenes
      const cand = [...nombresP5.map((n) => ({ id: n, nombre: n, tipo: "Plan 5" })), ...obras.map((o) => ({ id: o.obra_id, nombre: o.nombre, tipo: "Otras órdenes" }))];
      const iguales = cand.filter((c) => palabras(c.nombre).join(" ") === palabras(m.obra).join(" "));
      const xs = iguales.length ? iguales : cand.filter((c) => contiene(c.nombre, m.obra));
      const unicos = [...new Map(xs.map((c) => [c.id, c])).values()];
      if (unicos.length === 1) { destino = unicos[0].id; tipo = `${unicos[0].tipo}${unicos[0].tipo === "Otras órdenes" ? ` («${unicos[0].nombre}»)` : ""}`; }
      else avisos.push(`${m.fuentes.join(" / ")}: ${unicos.length ? `varias obras posibles para «${m.obra}»: ${unicos.map((c) => `${c.nombre} (${c.tipo})`).join(", ")}` : `no encuentro «${m.obra}» ni en Plan 5 ni en Otras órdenes`}; no se toca`);
    }
    const claves = new Set(m.fuentes.map((f) => RO.normClave(f)));
    const suyos = regs.filter((r) => !verdad(r.borrado) && r.obra_id && claves.has(RO.normClave(r.obra_id)));
    destinos.push({ fuentes: m.fuentes, buscado: m.obra || m.oo, destino, tipo, registros: suyos.length, horas: r2(suyos.reduce((t, r) => t + num(r.horas), 0)) });
    if (!destino) continue;
    for (const r of suyos) {
      if (r.obra_id === destino) continue;
      set(r._fila, "obra_id", r.obra_id, destino);
      set(r._fila, "updated_at", r.updated_at, ahora);
      set(r._fila, "updated_by", r.updated_by, `${usuario} (${MIGRACION_NOMBRES})`);
      reescritos.push({ registro_id: r.registro_id, fecha: r.fecha, horas: num(r.horas), antes: r.obra_id, despues: destino, snapshot: r });
    }
  }
  return { cambios, nuevas: [], avisos, reescritos, destinos };
}

// ============================================================
// Hoja
// ============================================================
let _sheets = null;
function sheetsCli() {
  if (_sheets) return _sheets;
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}
const HOJAS = { obras: "obras_otras", entradas: "obras_otras_entradas_cuenta", extras: "obras_otras_partidas_extra", etiquetas: "holded_etiquetas", registros: "registros_tiempo", plan: "planificacion_obras" };

async function leerTodo({ facturas = true } = {}) {
  const sheets = sheetsCli();
  const d = {};
  for (const [k, hoja] of Object.entries(HOJAS)) {
    let filas = [];
    try { filas = (await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: `${hoja}!A1:AZ` })).data.values || []; }
    catch (e) { if (k !== "plan" && k !== "extras") throw e; }   // sin planificación ni partidas extra: nada que mover
    d[k] = { head: (filas[0] || []).map((h) => String(h || "").trim()), filas: filas.slice(1) };
  }
  // facturas de venta de Holded (sólo lectura), para el anticipo de Orad; sin ellas, la migración avisa y no vincula
  if (facturas) try {
    const r = await require("./ara-os-holded.cjs").obtenerInvoices();
    d.facturas = r && !r.error && Array.isArray(r.docs) ? r.docs : null;
  } catch (e) { console.warn("[migraciones] facturas Holded:", e.message); d.facturas = null; }
  // obras_otras: la columna obra_relacionada (AR) puede no estar aún en la cabecera de la hoja
  if (!d.obras.head.includes("obra_relacionada")) d.obras.head.push("obra_relacionada");
  return d;
}

async function aplicar(d, p, usuario, migracion = MIGRACION) {
  const sheets = sheetsCli();
  const id = process.env.GOOGLE_SHEETS_ID;
  const data = [];
  const tabla = Object.fromEntries(Object.entries(HOJAS).map(([k, h]) => [h, d[k]]));
  // la cabecera de obra_relacionada, si faltaba
  const hObras = d.obras.head;
  data.push({ range: `obras_otras!${colLetra(hObras.indexOf("obra_relacionada"))}1`, values: [["obra_relacionada"]] });
  for (const c of p.cambios) {
    const head = tabla[c.hoja].head;
    for (const [campo, [, v]] of Object.entries(c.campos)) {
      const j = head.indexOf(campo);
      if (j < 0) throw new Error(`${c.hoja}: no hay columna «${campo}»`);
      data.push({ range: `${c.hoja}!${colLetra(j)}${c.fila}`, values: [[String(v)]] });
    }
  }
  if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data } });
  for (const n of p.nuevas) {
    const head = tabla[n.hoja].head;
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: `${n.hoja}!A:${colLetra(head.length - 1)}`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [head.map((h) => String(n.valores[h] ?? ""))] } });
  }
  // historial de registros de tiempo (append-only): un «editado» por registro reescrito
  if (p.reescritos.length) {
    const ahora = new Date().toISOString(), dia = ahora.slice(0, 10).replace(/-/g, "");
    let prev = [];
    try { prev = ((await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "registros_tiempo_historial!A2:A" })).data.values || []).map((f) => String(f[0] || "")); } catch (_) { /* sin historial */ }
    let n = Math.max(0, ...prev.filter((x) => x.startsWith(`EV-${dia}-`)).map((x) => parseInt(x.split("-").pop(), 10)).filter((x) => !isNaN(x)));
    const filas = p.reescritos.map((r) => {
      const { _fila, ...snap } = r.snapshot;
      return [`EV-${dia}-${String(++n).padStart(3, "0")}`, r.registro_id, "editado", JSON.stringify({ ...snap, obra_id: r.despues }), JSON.stringify({ obra_id: { antes: r.antes, despues: r.despues }, migracion }), ahora, usuario];
    });
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: "registros_tiempo_historial!A:G", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: filas } });
  }
  // las cachés de los módulos, para que se vea ya
  for (const [mod, fn] of [["./ara-os-registros-tiempo.cjs", "invalidarCacheRegistros"], ["./ara-os-obras-otras.cjs", "invalidarCaches"], ["./ara-os-holded.cjs", "invalidarCachesEtiquetas"]]) {
    try { require(mod)[fn]?.(); } catch (e) { console.warn(`[migraciones] ${fn}:`, e.message); }
  }
  try { require("./ara-os-dinero-empresa.cjs").registrosCambiados?.(); } catch (_) { /* opcional */ }
  return data.length + p.nuevas.length;
}

function registrar(app) {
  const cors = (res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); };
  const ruta = "/api/ara-os/admin/migraciones/orad-montemayor";
  app.options(ruta, (req, res) => { cors(res); res.status(204).end(); });
  const manejar = async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ ok: false, error: "Token inválido" });
    const hacer = req.method === "POST" && String(req.query.aplicar || "") === "1";
    const usuario = String(req.query.usuario || "ARA OS");
    try {
      const d = await leerTodo();
      const p = planificar(d, { todas: String(req.query.todas || "") === "1", usuario });
      const r = resumen(d, p);
      const salida = {
        ok: true, migracion: MIGRACION, simulacion: !hacer,
        n_cambios: p.cambios.reduce((t, c) => t + Object.keys(c.campos).length, 0), n_filas_nuevas: p.nuevas.length,
        registros_reescritos: { n: p.reescritos.length, horas: r2(p.reescritos.reduce((t, x) => t + x.horas, 0)),
          por_obra: p.reescritos.reduce((m, x) => { const k = `${x.antes} → ${x.despues}`; m[k] = r2((m[k] || 0) + x.horas); return m; }, {}) },
        avisos: p.avisos, ...r,
        cambios: p.cambios.map((c) => ({ hoja: c.hoja, fila: c.fila, campos: c.campos })), filas_nuevas: p.nuevas,
      };
      if (hacer) salida.celdas_escritas = await aplicar(d, p, usuario);
      res.json(salida);
    } catch (e) {
      console.error("[migraciones/orad-montemayor]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  };
  app.get(ruta, manejar);
  app.post(ruta, manejar);

  // Nombres sueltos (15/10/2026): GET = simulación · POST &aplicar=1 = aplica
  const rutaN = "/api/ara-os/admin/migraciones/nombres-sueltos";
  app.options(rutaN, (req, res) => { cors(res); res.status(204).end(); });
  const manejarN = async (req, res) => {
    cors(res);
    if (!validToken(req.query.token)) return res.status(401).json({ ok: false, error: "Token inválido" });
    const hacer = req.method === "POST" && String(req.query.aplicar || "") === "1";
    const usuario = String(req.query.usuario || "ARA OS");
    try {
      const d = await leerTodo({ facturas: false });
      const sheets = sheetsCli();
      const leerA = async (rango) => ((await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango })).data.values || []).map((f) => f[0]);
      const plan5 = [...await leerA("comunidades!A2:A"), ...await leerA("ordenes_trabajo!A2:A")];
      const p = planificarNombres(d, plan5, { usuario });
      const salida = {
        ok: true, migracion: MIGRACION_NOMBRES, simulacion: !hacer,
        n_cambios: p.cambios.reduce((t, c) => t + Object.keys(c.campos).length, 0),
        registros_reescritos: { n: p.reescritos.length, horas: r2(p.reescritos.reduce((t, x) => t + x.horas, 0)),
          por_obra: p.reescritos.reduce((m, x) => { const k = `${x.antes} → ${x.despues}`; m[k] = r2((m[k] || 0) + x.horas); return m; }, {}) },
        destinos: p.destinos, avisos: p.avisos,
        cambios: p.cambios.map((c) => ({ hoja: c.hoja, fila: c.fila, campos: c.campos })),
      };
      if (hacer) salida.celdas_escritas = await aplicar(d, p, usuario, MIGRACION_NOMBRES);
      res.json(salida);
    } catch (e) {
      console.error("[migraciones/nombres-sueltos]", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  };
  app.get(rutaN, manejarN);
  app.post(rutaN, manejarN);
}

module.exports = registrar;
module.exports.planificar = planificar;
module.exports.resumen = resumen;
module.exports.ORAD = ORAD;
module.exports.TUBERIAS = TUBERIAS;
module.exports.planificarNombres = planificarNombres;
module.exports.NOMBRES_SUELTOS = NOMBRES_SUELTOS;
