// ============================================================
// lib/relacion-tomas.cjs · Relación de tomas EMASESA (fase 14)
//
// Funciones puras compartidas por ara-os-fase14-certificados.cjs:
//   · parsearPdfRelacionTomas(buffer): PDF "Relación de tomas" →
//     cabecera (batería, Q, suministro, ubicación…) + tomas[] con
//     Piso, Puerta y Ampliación en campos separados (por columnas).
//   · montarCuadricula({celdas, numFilas, numCols, tomas}): cruza la
//     foto del rótulo con las tomas del PDF. La posición la manda la
//     foto; el PDF sólo aporta cliente, caudal y destino.
//
// Test: node lib/relacion-tomas.test.cjs
// ============================================================

// Parser principal del texto extraído del PDF EMASESA
// v0.24.0 — Devuelve:
//   Identificadores: numero_bateria_emasesa, bateria_numero (alias),
//                    contadores_a_instalar, solicitud_q, suministro
//   Localización:    ubicacion_bateria, direccion_emasesa, numero_edificio_rt
//   Otros:           fecha_emasesa, causa_baja_suministro
//   Tomas:           tomas[] (cada una con .revisada: false), caudal_total
function parsearTextoEmasesa(texto) {
  const out = {
    // Identificadores oficiales EMASESA
    numero_bateria_emasesa: "",      // v0.24.0 — Nº batería oficial EMASESA (ej. "31973")
    bateria_numero: "",              // alias retrocompat — mismo valor que numero_bateria_emasesa
    contadores_a_instalar: "",       // v0.24.0 — campo distinto (puede venir vacío)
    solicitud_q: "",
    suministro: "",

    // Localización
    ubicacion_bateria: "",
    direccion_emasesa: "",
    numero_edificio_rt: "",          // v0.24.0 — número aislado de la dirección

    // Otros
    fecha_emasesa: "",
    causa_baja_suministro: "",       // v0.24.0 — "SI" / "NO" / ""

    // Tomas
    tomas: [],
    caudal_total: 0,
  };

  let m;
  const lineas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // ──────────────────────────────────────────────────────────
  // v0.24.0 — Batería oficial EMASESA y "contadores a instalar"
  // En el texto crudo aparecen las 2 etiquetas pegadas seguidas de
  // el/los valor(es): "Batería:Contadores a instalar:\n31973".
  // El primer número es Batería; el segundo (si existe) es
  // "Contadores a instalar". En Generalife 13 sólo viene el primero.
  // ──────────────────────────────────────────────────────────
  m = texto.match(/Bater[íi]a:\s*Contadores a instalar:\s*\n([0-9]+)(?:\s*\n([0-9]+))?/);
  if (m) {
    out.numero_bateria_emasesa = (m[1] || "").trim();
    out.bateria_numero         = out.numero_bateria_emasesa;
    out.contadores_a_instalar  = (m[2] || "").trim();
  } else {
    // Fallback al patrón legacy (compatibilidad con PDFs anteriores)
    m = texto.match(/Contadores a instalar:\s*\n?\s*([0-9]+)/);
    if (m) {
      out.numero_bateria_emasesa = m[1].trim();
      out.bateria_numero         = out.numero_bateria_emasesa;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Dirección + número edificio (v0.24.0)
  // ──────────────────────────────────────────────────────────
  m = texto.match(/(BARRIADA[^\n]+|CALLE[^\n]+|AVENIDA[^\n]+|PLAZA[^\n]+)/i);
  if (m) {
    out.direccion_emasesa = m[1].trim();
    const mNum = out.direccion_emasesa.match(/,\s*(\d+(?:\s*BIS|\s*DUP)?)/i);
    if (mNum) out.numero_edificio_rt = mNum[1].trim();
  }

  // Fecha emisión EMASESA ("24 de marzo de 2026")
  m = texto.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
  if (m) out.fecha_emasesa = m[1].trim();

  // ──────────────────────────────────────────────────────────
  // v0.24.0 — Ubicación batería (captura completa)
  // Busca la etiqueta "Ubicación batería:" y captura la siguiente
  // línea con letras (saltando líneas puramente numéricas como el
  // bloque pegado de solicitud+suministro). Así "ARMARIO EN PATIO
  // INTERIOR" queda completo, en vez de cortarse en "EN PATIO INTERIOR".
  // ──────────────────────────────────────────────────────────
  const idxEtiqUbic = lineas.findIndex(l => /Ubicaci[óo]n bater[íi]a/i.test(l));
  if (idxEtiqUbic >= 0) {
    for (let k = idxEtiqUbic + 1; k < lineas.length; k++) {
      const ln = lineas[k];
      if (/^\d+$/.test(ln)) continue;            // saltar líneas solo numéricas
      if (/^[A-ZÁÉÍÓÚÑ ]+$/.test(ln) && /[A-ZÁÉÍÓÚÑ]/.test(ln)) {
        out.ubicacion_bateria = ln.trim();
        break;
      }
    }
  }
  // Fallback al regex viejo si la etiqueta no apareció
  if (!out.ubicacion_bateria) {
    m = texto.match(/EN\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?)(?:\s*\n|$)/);
    if (m) out.ubicacion_bateria = ("EN " + m[1]).trim();
  }

  // v0.21.6 — Solicitud y Suministro
  // pdf-parse extrae los 2 números como UN SOLO bloque pegado (truncado).
  // Ej: "01004615701005589" = "0100461574" + "0100558913" (cortado)
  // Estrategia: detectar el bloque pegado "010\d{7,}" y dividirlo en 2.
  const bloqueNumeros = texto.match(/\b(010\d{7,})\b/);
  if (bloqueNumeros) {
    const todo = bloqueNumeros[1];
    if (todo.length >= 20) {
      // Hay 2 números completos de 10 dígitos
      out.solicitud_q = todo.substring(0, 10);
      out.suministro  = todo.substring(10, 20);
    } else if (todo.length >= 10) {
      // Solo el primero está completo, el segundo está truncado
      out.solicitud_q = todo.substring(0, 10);
      out.suministro  = todo.substring(10); // lo que haya
    }
  } else {
    // Fallback: buscar 10 dígitos sueltos
    const numeros10 = texto.match(/\b(\d{10})\b/g) || [];
    if (numeros10.length >= 1) out.solicitud_q = numeros10[0];
    if (numeros10.length >= 2) out.suministro  = numeros10[1];
  }

  // ──────────────────────────────────────────────────────────
  // v0.24.0 — Causa baja suministro (SI/NO según marca X)
  // En el texto: " Causa baja el suministro: Fecha desmontaje:\nSI\nNO\nX"
  // La X aparece después de la opción marcada.
  // ──────────────────────────────────────────────────────────
  const idxCausa = lineas.findIndex(l => /Causa baja el suministro/i.test(l));
  if (idxCausa >= 0) {
    const ventana = lineas.slice(idxCausa + 1, idxCausa + 8);
    for (let k = 0; k < ventana.length - 1; k++) {
      if ((/^SI$/i.test(ventana[k]) || /^NO$/i.test(ventana[k])) &&
          /^X$/i.test(ventana[k + 1])) {
        out.causa_baja_suministro = ventana[k].toUpperCase();
        break;
      }
    }
    // Si hay X pero no inmediatamente después de SI/NO, dejamos vacío
    // (mejor vacío que adivinar).
  }

  // v0.21.6 — TOMAS: parser línea por línea (no por chunks).
  // v0.28.0 — Pre-procesado: si las tomas vienen en una sola línea
  //   "01-01 Bajo 1 1,40 15 DUARTE CALANCHA,JUAN LUIS"
  //   se expanden a líneas separadas para el parser estándar.
  const lineasExpandidas = [];
  for (const l of lineas) {
    const mLinea = l.match(/^(\d{2}-\d{2})\s+(.+)$/);
    if (mLinea) {
      // Línea de toma en formato compacto — expandir
      lineasExpandidas.push(mLinea[1]); // ID toma
      // Separar el resto por espacios pero preservar nombres
      // Formato: [Piso] [Puerta?] [Caudal X,XX] [Calibre] [Nombre...]
      const resto = mLinea[2].trim();
      const mCaudal = resto.match(/(\d+,\d{2})\s+(0|15|20|25|30|40|50)\s*(.*)?$/);
      if (mCaudal) {
        // Todo lo que está antes del caudal = piso y puerta
        const antesStr = resto.slice(0, resto.indexOf(mCaudal[1])).trim();
        const partes = antesStr.split(/\s+/);
        for (const p of partes) lineasExpandidas.push(p);
        lineasExpandidas.push(mCaudal[1]); // caudal
        lineasExpandidas.push(mCaudal[2]); // calibre
        if (mCaudal[3]) lineasExpandidas.push(mCaudal[3].trim()); // nombre
      } else {
        // Sin caudal claro — poner todo junto
        for (const p of resto.split(/\s+/)) lineasExpandidas.push(p);
      }
    } else {
      lineasExpandidas.push(l);
    }
  }
  // Usar lineasExpandidas si tiene más tomas que el original
  const lineasFinal = lineasExpandidas.length > lineas.length ? lineasExpandidas : lineas;

  let i = 0;
  while (i < lineasFinal.length) {
    if (!/^\d{2}-\d{2}$/.test(lineasFinal[i])) { i++; continue; }
    // Reemplazar lineas[i] con lineasFinal[i] en el resto del parser
    const _lineas = lineasFinal;

    const toma = { toma: _lineas[i], piso: "", puerta: "", ampliacion: "", caudal: "", cliente: "", calibre: "", revisada: true };
    i++;

    // Recoger campos hasta la próxima NN-NN o fin
    const campos = [];
    while (i < _lineas.length && !/^\d{2}-\d{2}$/.test(_lineas[i])) {
      campos.push(_lineas[i]);
      i++;
    }

    // Identificar caudal (X,XX) y calibre (0/15/20/25/30/40/50)
    let caudalIdx = -1, calibreIdx = -1;
    for (let j = 0; j < campos.length; j++) {
      if (/^\d+,\d{2}$/.test(campos[j])) { caudalIdx = j; break; }
    }
    if (caudalIdx >= 0) {
      for (let j = caudalIdx + 1; j < campos.length; j++) {
        if (/^(0|15|20|25|30|40|50)$/.test(campos[j])) { calibreIdx = j; break; }
      }
    }

    if (caudalIdx >= 0) toma.caudal = campos[caudalIdx];
    if (calibreIdx >= 0) toma.calibre = campos[calibreIdx];

    // Antes del caudal: piso y puerta
    const antesCaudal = campos.slice(0, caudalIdx);
    if (antesCaudal.length === 1) {
      toma.piso = antesCaudal[0];
    } else if (antesCaudal.length === 2) {
      toma.piso = antesCaudal[0];
      // Sin puerta pero con ampliación ("Bajo" + "UNIDO AL LOCAL")
      if (/\s/.test(antesCaudal[1])) toma.ampliacion = antesCaudal[1];
      else toma.puerta = antesCaudal[1];
    } else if (antesCaudal.length >= 3) {
      // Piso · Puerta · Ampliación ("3º" "A" "UNIDO AL PISO 3ºB").
      // La ampliación va en su propio campo, nunca pegada a la puerta.
      toma.piso = antesCaudal[0];
      toma.puerta = antesCaudal[1];
      toma.ampliacion = antesCaudal.slice(2).join(" ");
    }

    // Cliente: entre caudal y calibre (si hay algo)
    if (caudalIdx >= 0 && calibreIdx > caudalIdx + 1) {
      toma.cliente = campos.slice(caudalIdx + 1, calibreIdx).join(" ").trim();
    }

    out.tomas.push(toma);
    const caudalNum = parseFloat(String(toma.caudal).replace(",", "."));
    if (isFinite(caudalNum)) out.caudal_total += caudalNum;
  }

  out.caudal_total = Math.round(out.caudal_total * 100) / 100;
  return out;
}

// ============================================================
// PARSER POR COLUMNAS (posición X de cada texto en el PDF)
// ------------------------------------------------------------
// El texto corrido de pdf-parse pierde las columnas: "A" (Puerta) y
// "UNIDO AL PISO 3ºB" (Ampliación) salen en líneas seguidas y no hay
// forma fiable de separarlas. pdf.js sí da la posición de cada texto,
// así que asignamos cada valor a la columna de su cabecera.
//
// El PDF de EMASESA (JasperReports crpRelacionTomasP5) viene rotado:
// la coordenada de fila puede ser transform[4] o transform[5]. Se
// detecta mirando qué coordenada comparten las cabeceras.
// ============================================================

const CABECERAS = {
  TOMA: "toma", PISO: "piso", PUERTA: "puerta", AMPLIACION: "ampliacion",
  CAUDAL: "caudal", CALIBRE: "calibre", CONTADOR: "contador", PRECINTO: "precinto",
  SOLICITUD: "solicitud", SUMINISTRO: "suministro", CLIENTE: "cliente",
};
const COLS_NUMERICAS_FINALES = new Set(["contador", "precinto", "solicitud", "suministro"]);

function sinAcentos(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Devuelve [[{str, a, b}]] por página (a = transform[4], b = transform[5])
async function extraerItemsPdf(buffer) {
  const pdfParse = require("pdf-parse");
  const paginas = [];
  await pdfParse(buffer, {
    pagerender: pg => pg.getTextContent().then(tc => {
      paginas[pg.pageIndex] = tc.items
        .filter(it => it.str && it.str.trim())
        .map(it => ({ str: it.str.trim(), a: it.transform[4], b: it.transform[5] }));
      return "";
    }),
  });
  return paginas.filter(Boolean);
}

function parsearTomasPorColumnas(paginas) {
  const tomas = [];
  for (const items of paginas || []) {
    const cab = {};
    for (const it of items) {
      const k = CABECERAS[sinAcentos(it.str).toUpperCase()];
      if (k && !cab[k]) cab[k] = it;
    }
    if (!cab.toma || !cab.piso || !cab.puerta || !cab.caudal) continue;

    // ¿Qué eje es la fila? El que comparten todas las cabeceras.
    const hs = Object.values(cab);
    const rango = eje => Math.max(...hs.map(h => h[eje])) - Math.min(...hs.map(h => h[eje]));
    const ejeFila = rango("a") <= rango("b") ? "a" : "b";
    const ejeCol  = ejeFila === "a" ? "b" : "a";
    const signo = cab.toma[ejeCol] < cab.caudal[ejeCol] ? 1 : -1;
    const col = it => signo * it[ejeCol];
    const fila = it => it[ejeFila];

    const columnas = Object.entries(cab)
      .filter(([k]) => k !== "toma")
      .map(([k, h]) => ({ k, x: col(h) }))
      .sort((p, q) => p.x - q.x);
    const columnaDe = x => {
      let mejor = columnas[0];
      for (let i = 0; i < columnas.length; i++) {
        const lim = i + 1 < columnas.length ? (columnas[i].x + columnas[i + 1].x) / 2 : Infinity;
        mejor = columnas[i];
        if (x < lim) break;
      }
      return mejor.k;
    };

    const anclas = items.filter(it => /^\d{2}-\d{2}$/.test(it.str) && it !== cab.toma);
    for (const ancla of anclas) {
      const enFila = items
        .filter(it => it !== ancla && !hs.includes(it) && Math.abs(fila(it) - fila(ancla)) <= 4)
        .sort((p, q) => col(p) - col(q));
      const campos = {};
      for (const it of enFila) {
        let k = columnaDe(col(it));
        // La cabecera "Cliente" va centrada y los nombres alineados a la
        // izquierda: caen en zona de Suministro/Solicitud. Un texto con
        // letras en esas columnas numéricas es el cliente.
        if (COLS_NUMERICAS_FINALES.has(k) && /[A-ZÁÉÍÓÚÑ]{2,}/i.test(it.str)) k = "cliente";
        campos[k] = campos[k] ? campos[k] + " " + it.str : it.str;
      }
      tomas.push({
        toma: ancla.str,
        piso: campos.piso || "",
        puerta: campos.puerta || "",
        ampliacion: campos.ampliacion || "",
        caudal: campos.caudal || "",
        calibre: campos.calibre || "",
        cliente: (campos.cliente || "").replace(/\s{2,}/g, " ").trim(),
        revisada: true,
      });
    }
  }
  return tomas;
}

// Parser completo: cabecera por texto + tomas por columnas (si se
// puede; si no, las del parser de texto).
async function parsearPdfRelacionTomas(buffer) {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  const out = parsearTextoEmasesa(data.text || "");
  out.metodo_tomas = "texto";
  try {
    const porCols = parsearTomasPorColumnas(await extraerItemsPdf(buffer));
    if (porCols.length > 0) {
      out.tomas = porCols;
      out.metodo_tomas = "columnas";
      let total = 0;
      for (const t of porCols) {
        const n = parseFloat(String(t.caudal).replace(",", "."));
        if (isFinite(n)) total += n;
      }
      out.caudal_total = Math.round(total * 100) / 100;
    }
  } catch (err) {
    console.warn("[relacion-tomas] parser por columnas falló, uso el de texto:", err.message);
  }
  return out;
}

// ============================================================
// NORMALIZACIÓN DE SEÑALES (rótulo y PDF hablan "idiomas" distintos)
//   0º = Bº = B = BAJO = Bajo          → planta "0"
//   C = CO = COM = CDAD = COMUNIDAD    → comunidad
//   X = vacío = LIBRE                  → libre
//   "3º B", "3ºB", "3'B", "3B"         → planta "3", puerta "B"
// ============================================================

const RE_COMUNIDAD = /^(C|CO|COM|CDAD|CDADPROP|COMUN|COMUNIDAD|ZC|ZONASCOMUNES)$/;
const RE_LIBRE = /^(X|-|LIBRE|VACIA|VACIO)?$/;

function normPlanta(p) {
  const s = sinAcentos(p).toUpperCase().replace(/[\s.º°ª'’]/g, "");
  if (/^(0+|B|BJ|BAJO|BAJA|PB|PLANTABAJA)$/.test(s)) return "0";
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}
function normPuerta(p) {
  return sinAcentos(p).toUpperCase().replace(/[\s.º°ª'’]/g, "");
}

// Clasifica una celda del rótulo
function claveCelda(celda) {
  const raw = sinAcentos(celda).toUpperCase().trim();
  const compacto = raw.replace(/[\s.º°ª'’\-_]/g, "");
  if (RE_LIBRE.test(compacto)) return { tipo: "libre", clave: "X" };
  if (RE_COMUNIDAD.test(compacto) || compacto.startsWith("CDAD")) return { tipo: "comunidad", clave: "C" };

  let planta, puerta;
  // Con separador explícito: "3ºB", "1'1", "B º A"
  const mSep = raw.match(/^([^\sº°ª'’]+)\s*[º°ª'’]\s*(.*)$/);
  if (mSep) { planta = mSep[1]; puerta = mSep[2]; }
  else {
    const mPal = raw.match(/^(BAJO|BAJA|BJ|PB|\d+)\s*(.*)$/) || raw.match(/^(B)\s*([A-Z0-9].*)?$/);
    if (mPal) { planta = mPal[1]; puerta = mPal[2] || ""; }
  }
  if (planta == null) return { tipo: "desconocida", clave: compacto };
  const pl = normPlanta(planta), pu = normPuerta(puerta);
  if (RE_COMUNIDAD.test(pu)) return { tipo: "comunidad", clave: "C" };
  return { tipo: "vivienda", planta: pl, puerta: pu, clave: pl + "|" + pu };
}

// Clasifica una toma del PDF EMASESA
function claveToma(t) {
  const piso = String(t.piso || "").trim();
  // Tomas guardadas antes del parser por columnas traen la ampliación
  // pegada ("A UNIDO AL PISO 3ºB"): la puerta es sólo el primer token.
  const puerta = String(t.puerta || "").trim().split(/\s+/)[0];
  const cliente = sinAcentos(t.cliente || "").toUpperCase();
  const pu = normPuerta(puerta);
  if (RE_COMUNIDAD.test(pu) || pu.startsWith("CDAD") || String(t.destino || "").toUpperCase() === "C") {
    return { tipo: "comunidad", clave: "C" };
  }
  if (!piso && !puerta) {
    if (/^(CDAD|COMUNIDAD)/.test(cliente)) return { tipo: "comunidad", clave: "C" };
    return { tipo: "libre", clave: "X" };
  }
  const pl = normPlanta(piso);
  return { tipo: "vivienda", planta: pl, puerta: pu, clave: pl + "|" + pu };
}

// Señal tal como se escribe en los certificados: "BºB", "3ºA", "C", "X"
function senalCanonica(k, original) {
  if (k.tipo === "libre") return "X";
  if (k.tipo === "comunidad") return "C";
  if (k.tipo !== "vivienda") return String(original || "").trim();
  const pl = k.planta === "0" ? "B" : k.planta;
  return /^\d+$/.test(k.planta) || k.planta === "0" ? `${pl}º${k.puerta}` : `${pl}${k.puerta ? " " + k.puerta : ""}`;
}

function textoToma(t) {
  return [t.toma, senalCanonica(claveToma(t), [t.piso, t.puerta].filter(Boolean).join(" "))].filter(Boolean).join(" · ");
}

// ============================================================
// CUADRÍCULA "Relación de tomas (señal · destino · caudal)"
// ------------------------------------------------------------
// Regla: la POSICIÓN (fila, columna) la manda SIEMPRE la foto del
// rótulo. El PDF sólo aporta cliente, caudal y destino de cada
// piso+puerta. Nada se inventa: si una celda no casa, o una toma del
// PDF no aparece en el rótulo, se marca como error y `ok` = false.
// ============================================================
function montarCuadricula({ celdas, numFilas, numCols, tomas }) {
  const errores = [];
  celdas = Array.isArray(celdas) ? celdas.map(c => String(c == null ? "" : c).trim()) : [];
  numFilas = parseInt(numFilas, 10) || 0;
  numCols = parseInt(numCols, 10) || 0;
  tomas = (Array.isArray(tomas) ? tomas : []).filter(Boolean);

  if (!celdas.length || !numFilas || !numCols) {
    return { ok: false, sin_rotulo: true, filas: [], celdas: [], errores: ["Falta la foto del rótulo de la batería"], tomas_sin_colocar: [], num_filas: 0, num_cols: 0, caudal_total: "" };
  }
  if (celdas.length !== numFilas * numCols) {
    errores.push(`El rótulo tiene ${celdas.length} celdas y debería tener ${numFilas}×${numCols} = ${numFilas * numCols}`);
  }
  if (!tomas.length) errores.push("Falta el PDF de Relación de tomas de EMASESA");

  const claves = tomas.map(claveToma);
  const usadas = new Set();
  const usadaPorCelda = new Map();   // idx toma → "F-C" que la usó
  const filas = [];
  const planas = [];
  let total = 0;

  for (let f = 1; f <= numFilas; f++) {
    const fila = [];
    for (let c = 1; c <= numCols; c++) {
      const original = celdas[(f - 1) * numCols + (c - 1)] || "";
      const k = claveCelda(original);
      const celda = {
        fila: f, col: c, senal_rotulo: original, senal: senalCanonica(k, original),
        tipo: k.tipo, destino: "", caudal: "", toma: "", piso: "", puerta: "",
        ampliacion: "", cliente: "", revisada: true, estado: "ok", error: "",
      };
      const buscar = pred => claves.findIndex((kk, i) => !usadas.has(i) && pred(kk, i));

      let idx = -1;
      if (k.tipo === "libre") {
        idx = buscar(kk => kk.tipo === "libre");
        celda.destino = "X";
        celda.caudal = "0,00";
      } else if (k.tipo === "comunidad") {
        idx = buscar(kk => kk.tipo === "comunidad");
        celda.destino = "C";
        if (idx < 0) { celda.estado = "error"; celda.error = "El PDF no tiene (más) tomas de comunidad"; }
      } else if (k.tipo === "vivienda") {
        idx = buscar(kk => kk.tipo === "vivienda" && kk.clave === k.clave);
        celda.destino = "V";
        if (idx < 0) {
          const yaUsada = claves.findIndex((kk, i) => usadas.has(i) && kk.clave === k.clave);
          celda.estado = "error";
          celda.error = yaUsada >= 0
            ? `«${original}» está repetida en el rótulo (ya en ${usadaPorCelda.get(yaUsada)})`
            : `«${original}» no aparece en el PDF de EMASESA`;
        }
      } else {
        celda.estado = "error";
        celda.error = `No se entiende la celda «${original}»`;
      }

      if (idx >= 0) {
        const t = tomas[idx];
        usadas.add(idx);
        usadaPorCelda.set(idx, `fila ${f}, columna ${c}`);
        Object.assign(celda, {
          toma: t.toma || "", piso: t.piso || "", puerta: t.puerta || "",
          ampliacion: t.ampliacion || "", cliente: t.cliente || "",
          revisada: t.revisada !== false,
          caudal: t.caudal || celda.caudal,
        });
        if (t.destino && k.tipo === "vivienda" && /^[VLGJU]$/.test(String(t.destino).toUpperCase())) {
          celda.destino = String(t.destino).toUpperCase();
        }
      }
      if (celda.estado === "error") errores.push(`Fila ${f}, columna ${c}: ${celda.error}`);
      const n = parseFloat(String(celda.caudal).replace(",", "."));
      if (isFinite(n)) total += n;
      fila.push(celda);
      planas.push(celda);
    }
    filas.push(fila);
  }

  const tomas_sin_colocar = [];
  claves.forEach((kk, i) => {
    if (usadas.has(i) || kk.tipo === "libre") return;
    tomas_sin_colocar.push(tomas[i]);
    errores.push(`La toma ${textoToma(tomas[i])} del PDF no aparece en el rótulo`);
  });

  return {
    ok: errores.length === 0,
    sin_rotulo: false,
    num_filas: numFilas,
    num_cols: numCols,
    filas,
    celdas: planas,
    errores,
    tomas_sin_colocar,
    caudal_total: total.toFixed(2).replace(".", ","),
  };
}

// Campos toma_F_C_* que pinta la cuadrícula del modal de Certificados
function camposCuadricula(cuadricula, maxFilas = 3, maxCols = 11) {
  const out = {};
  for (let f = 1; f <= maxFilas; f++) {
    for (let c = 1; c <= maxCols; c++) {
      out[`toma_${f}_${c}_senal`] = "";
      out[`toma_${f}_${c}_destino`] = "";
      out[`toma_${f}_${c}_caudal`] = "";
    }
  }
  for (const cel of (cuadricula && cuadricula.celdas) || []) {
    if (cel.fila > maxFilas || cel.col > maxCols) continue;
    out[`toma_${cel.fila}_${cel.col}_senal`] = cel.senal;
    out[`toma_${cel.fila}_${cel.col}_destino`] = cel.destino;
    out[`toma_${cel.fila}_${cel.col}_caudal`] = cel.caudal;
  }
  return out;
}

module.exports = {
  parsearTextoEmasesa,
  parsearTomasPorColumnas,
  extraerItemsPdf,
  parsearPdfRelacionTomas,
  claveCelda,
  claveToma,
  senalCanonica,
  montarCuadricula,
  camposCuadricula,
};
