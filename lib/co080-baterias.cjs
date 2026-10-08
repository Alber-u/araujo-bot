// ============================================================
// lib/co080-baterias.cjs · Un CO 080 por batería (08/10/2026, Mandarinas 2)
//
// Con varias baterías se genera un CO 080 por batería (antes, uno solo con los datos de la primera):
//   · tecnicosCO080(bat, baterias): los datos de SU batería (marca, emplazamiento, filas×columnas, caudales,
//     plantas, altura, llave, grupo, montante…) y, donde estén vacíos, los de la obra de la primera batería que
//     los tenga (registro, titular, tubo de alimentación, dirección, uso…). Nº de baterías = las de la obra.
//   · camposFaltanCO080(t): los datos de batería que el CO 080 necesita y faltan (se comprueba antes de generar
//     cuando hay varias baterías; con una, como siempre, sin bloqueo).
// Test: node lib/co080-baterias.test.cjs
// ============================================================
const CAMPOS_OBRA_CO080 = ["registro_1", "registro_2", "registro_3", "nif_titular", "email_titular", "telefono_titular",
  "numero_edificio", "bloque", "portal", "escalera", "uso", "tipo_actuacion",
  "tubo_material", "tubo_diametro", "tubo_trazado", "conexion_general_loc", "tubo_valvula_retencion", "tubo_llave_general", "tubo_llave_general_situacion"];
const conValor = (v) => String(v == null ? "" : v).trim() !== "";

function tecnicosCO080(bat, baterias) {
  const t = { ...bat };
  const todas = Array.isArray(baterias) && baterias.length ? baterias : [bat];
  for (const k of CAMPOS_OBRA_CO080) {
    if (conValor(t[k])) continue;
    const otra = todas.find((b) => conValor(b[k]));
    if (otra) t[k] = otra[k];
  }
  // nº de baterías = las de la obra (con una, lo guardado si lo hay)
  if (todas.length > 1 || !conValor(t.num_baterias)) t.num_baterias = String(todas.length);
  return t;
}

const OBLIGATORIOS_CO080 = [["bateria_marca", "marca"], ["bateria_num_filas", "nº filas"], ["bateria_num_columnas", "nº columnas"],
  ["caudal_instalado", "caudal instalado"], ["num_plantas", "nº plantas"], ["montante_material", "material del montante"], ["montante_diametro", "diámetro del montante"]];
function camposFaltanCO080(t) {
  return OBLIGATORIOS_CO080.filter(([k]) => !conValor((t || {})[k])).map(([, n]) => n);
}

// (08/10/2026) Casillas del CO 080 y del CO 051 que salían vacías o con el dato de otro campo (Mandarinas 2 b2):
// cada una sale de SU campo; si está vacío, aviso antes de generar (en todas las obras), no un PDF con huecos.
const OBLIGATORIOS_CERT = [["bateria_material", "material de la batería (CO 080)"], ["conexion_general_loc", "localización de conexión general (CO 080)"],
  ["montante_material", "material del montante"], ["montante_diametro", "diámetro del montante"],
  ["tubo_llave_general_situacion", "situación de la llave general (CO 051)"], ["acometida_diametro", "Ø de acometida (CO 051)"]];
// «OT» (la «Ubicación» del PDF de EMASESA) no es un emplazamiento de batería
const emplazamientoValido = (v) => conValor(v) && !/^\s*O\.?\s*T\.?\s*$/i.test(String(v));
function camposFaltanCertificados(t, { varias = false, cifObra = "" } = {}) {
  t = t || {};
  const faltan = varias ? camposFaltanCO080(t) : [];
  if (!conValor(t.nif_titular) && !conValor(cifObra)) faltan.push("NIF de la comunidad (titular)");
  if (!emplazamientoValido(t.bateria_emplazamiento)) faltan.push(conValor(t.bateria_emplazamiento) ? `emplazamiento de la batería (no vale «${String(t.bateria_emplazamiento).trim()}»)` : "emplazamiento de la batería");
  for (const [k, n] of OBLIGATORIOS_CERT) if (!conValor(t[k]) && !faltan.includes(n)) faltan.push(n);
  return faltan;
}

module.exports = { CAMPOS_OBRA_CO080, OBLIGATORIOS_CO080, OBLIGATORIOS_CERT, tecnicosCO080, camposFaltanCO080, camposFaltanCertificados, emplazamientoValido };
