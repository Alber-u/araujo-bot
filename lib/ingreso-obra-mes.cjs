// Trabajo realizado de una obra en un mes (Mi panel › Resultado real del mes, /holded/posicion-neta-real).
// Sacado tal cual del endpoint el 15/10/2026 para poder calcularlo con otras horas previstas (comparar el
// criterio «días × 16 h» con «horas previstas de la orden») sin repetir la lógica. Función pura.
//
// o: { tipo: "plan5"|"otras", fase, importe, horasPrevistas, horasAcum, horasAcumAntes, horasMes, horasTotalReal,
//      fechaFin, importFixner }   ·   desde / hasta: primer y último día del mes (AAAA-MM-DD)
const FASES_TERMINADAS_PLAN5 = new Set(["14_FINALIZADA", "15_VISITA_INSPECTOR", "16_MONTAJE_CONTADORES", "17_COBRO_EMASESA", "18_COBRADA"]);
const FASES_OO_DEVENGADO_100 = new Set(["FINALIZADA", "FACTURADA", "COBRADA"]);

function ingresoObraMes(o, desde, hasta) {
  const { tipo, fase, importe, horasPrevistas, horasAcum, horasAcumAntes, horasMes, horasTotalReal, fechaFin, importFixner } = o;
  // Obra sin tiempo estimado (solo obras_otras sin horas previstas)
  const sinTiempoEstimado = horasPrevistas === 0 && tipo === "otras";
  // Terminada: fase de finalización. INCIDENCIAS implica que pasó por FINALIZADA antes.
  const esIncidenciaFase = (tipo === "plan5" && fase === "19_INCIDENCIAS") || (tipo === "otras" && fase === "INCIDENCIAS");
  const faseTerminada = (tipo === "plan5" && FASES_TERMINADAS_PLAN5.has(fase)) || (tipo === "otras" && FASES_OO_DEVENGADO_100.has(fase));
  // Mes de cierre real (v0.6, 11/09/2026): fin real / facturada / cobrada, o el último día con horas.
  //   fecha_fin > fin de este mes → en curso · dentro → se reconoce el tramo pendiente · antes → 0 · sin fecha → 0 y aviso
  // Cobradas sin horas ni fechas = obras antiguas (anteriores al registro de horas): ya cerradas, sin aviso.
  const cobradaAntigua    = faseTerminada && !fechaFin && (fase === "18_COBRADA" || fase === "COBRADA" || !!importFixner);
  const cerradaAntesDeMes = faseTerminada && ((fechaFin && fechaFin < desde) || cobradaAntigua);
  const cierraEsteMes     = faseTerminada && !!fechaFin && fechaFin >= desde && fechaFin <= hasta;
  const sinFechaFin       = faseTerminada && !fechaFin && !cobradaAntigua;
  const terminada = esIncidenciaFase || cerradaAntesDeMes || cierraEsteMes || sinFechaFin;
  const devengado100 = cerradaAntesDeMes || cierraEsteMes;

  // horasTotal = total de siempre de esta obra (denominador para reparto proporcional)
  const horasTotalObra = horasTotalReal || horasMes || 1;
  const avanceReal = horasPrevistas > 0
    ? Math.round(horasAcum / horasPrevistas * 10000) / 100
    : (sinTiempoEstimado ? Math.round(Math.min(horasAcum, horasTotalObra) / horasTotalObra * 10000) / 100 : 0);
  const avance = devengado100 ? 100 : Math.min(100, avanceReal);
  const devengado = Math.round(importe * avance / 100 * 100) / 100;

  let ingreso;
  if (esIncidenciaFase || cerradaAntesDeMes || sinFechaFin) {
    ingreso = 0; // garantía, ya reconocida o sin fecha de cierre
  } else if (cierraEsteMes) {
    // Tramo que faltaba hasta el 100 %, UNA sola vez (el mes del cierre).
    let ratioAntes;
    if (horasPrevistas > 0)       ratioAntes = horasAcumAntes / horasPrevistas;
    else if (horasTotalReal > 0)  ratioAntes = horasAcumAntes / horasTotalReal;
    else                          ratioAntes = 0; // sin horas: todo el importe en el mes de cierre
    ingreso = Math.round(importe * (1 - Math.min(1, ratioAntes)) * 100) / 100;
  } else if (sinTiempoEstimado) {
    ingreso = Math.round(importe * Math.min(1, horasMes / horasTotalObra) * 100) / 100;
  } else {
    const ratioAcum  = Math.min(1, horasPrevistas > 0 ? horasAcum      / horasPrevistas : 0);
    const ratioAntes = Math.min(1, horasPrevistas > 0 ? horasAcumAntes / horasPrevistas : 0);
    ingreso = Math.round((importe * ratioAcum - importe * ratioAntes) * 100) / 100;
  }
  return { sinTiempoEstimado, esIncidenciaFase, faseTerminada, cobradaAntigua, cerradaAntesDeMes, cierraEsteMes, sinFechaFin,
           terminada, devengado100, avanceReal, avance, devengado, ingresoObraMes: ingreso };
}

module.exports = { ingresoObraMes, FASES_TERMINADAS_PLAN5, FASES_OO_DEVENGADO_100 };
