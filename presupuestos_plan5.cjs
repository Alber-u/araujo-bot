// ============================================================================
// MÓDULO PRESUPUESTOS PLAN 5 — Araujo CCPP
// Build: 2026-06-14 v0.26 (PANTALLA MEDICIONES terminada para ALIMENTACION + retoques. (1) Edicion inline de los DIAS de alimentacion reutilizando la celda Dato de conexion: las 3 lineas (Fontanero, Albañil enterrado, Albañil viga/techo) muestran sus 3 tramos (2,5->6,5->15->20) con cada dia editable y el tramo que aplica en AZUL; factores (sacos/losa/f.viga/f.techo) tambien editables. Via pintarCapAli leyendo med.rowOf del Sheet. (2) Quitada la columna Capitulo del presupuesto -> ahora va como TOOLTIP (title) en el Concepto. (3) Columna Dato mas estrecha (32px) y a la DERECHA; Detalle/Total comprimidas. (4) Banner de avisos junta conexion + alimentacion. Validado: node --check + jsdom (8 columnas, tooltip, 3 tramos con azul, fila total 8 celdas, banner) + conexion 1.293 € + alimentacion. Para editar dias/factores hay que pegar en plan5_mediciones las filas de parametros (TSV aparte); si faltan, se ve igual y el motor usa los valores correctos. PENDIENTE: cuarto de contadores, grupo de presion, montantes.)
// Build: 2026-06-14 v0.25 (TUBO DE ALIMENTACION ajustado al Excel/normativa + Toma de datos + cableado de dias/factores al Sheet. MOTOR calcAlimentacion: (1) Tuerca reduccion 3' a ® AÑADIDA (faltaba): cant 1, salvo 0 si Ø90 (3', no reduce); precio del Sheet por pulgada; si sale Ø110 (4', sin precio) -> aviso. (2) Dias por diasAli con corte '<=' (6,5 m = tramo corto, como Excel L8) + TERCER TRAMO 15-20 m (font 2 / ent 4 / viga 1,5; saltamos el tope de 15 SOLO para dias, el diametro sigue la norma). (3) SOLO PIECERIA / tubo <2,5 m: fontanero fijo 0,50 dia, albañiles 0, PE 0 m. (4) f.viga decimal (sin redondeo, como Excel); f.techo redondeo HACIA ARRIBA (ceil). (5) avisos[] para material con cantidad>0 sin precio. TOMA DE DATOS: orden Montaje->Longitud->Codos; Longitud pasa a DESPLEGABLE 2,5/3/4...20; SOLO PIECERIA bloquea Longitud y Codos a 0. Validado: node --check + ejecucion (dias 6,5->1, 16-20->2, pieceria 0,5, f.viga/f.techo, Tuerca Ø63/90/110+aviso) + conexion IDENTICA (1.293 € con tope SP) + jsdom Toma de datos. parseMediciones ahora construye obra.alimentacion leyendo factores y dias de TUBO DE ALIMENTACION del Sheet, con fallback a los valores correctos (no rompe nada si las filas no existen). PENDIENTE (siguiente pasada, pantalla MEDICIONES): Dato mas pequeño+derecha, igualar columnas, quitar columna Capitulo + tooltip en Concepto, edicion inline de los dias de alimentacion (machinery como conexion) y mostrar los avisos de alimentacion en el banner; + pegar en el Sheet las filas de parametros de dias/factores.)
// Build: 2026-06-14 v0.23 (CIERRE del capítulo TUBO DE CONEXION tras verificación línea a línea, con los cambios acordados por Guille. MOTOR: (1) Pasante (funda) por NORMA 6.1 (doble de la acometida, mínimo 90) con comerciales 90/110 -> acometida ≤45 mm = Ø90, >45 = Ø110; ya NO se lee del sheet (umbral fijo en código; Guille vació E3/F3/G3). (2) Topes de cuadrilla EN CÓDIGO (1,5 / 4 m); los días siguen editándose en el sheet; corte del primer tramo con "<" como el Excel (1,5 m clavados -> tramo 2). (3) AVISO si la acometida sale Ø110 (no hay precio de "Codo fitting" para ese Ø) -> banner amarillo en MEDICIONES. PANTALLA (columna "Dato"): unidad FUERA del input (ud/m · día/cuadrilla) e input estrecho; para las cuadrillas se muestran TODOS los tramos en una línea (0 m -> [día] -> 1,5 m -> [día] -> 4 m) con cada día editable a su celda y el tramo que se aplica coloreado en AZUL; Fontanero y Albañil NO se unifican (comparten los días, como en el Excel L6=L7). Validado: node --check + 3 scripts (verify) + arnés 1.293 € + cortes de tramo (1,49->0,25 / 1,5->0,375 / 4->0,375 / 4,5->error) + Ø110 dispara aviso + render jsdom de la celda Dato. PENDIENTE: motor de grupo de presión (precios + entradas + alinear potencias) y de montantes (peines); edición inline del Dato en alimentación/cuarto; 2 precios a 0 del cuarto; tuerca de reducción.)
// Build: 2026-06-14 v0.22 (ARREGLO del pintado de MEDICIONES + estructura completa como el Excel. (1) BUG corregido: el bloque "1.1 TUBO DE CONEXION" pintaba TODO el desglose (44 líneas) porque recorría R.desglose; ahora recorre solo R.conexion.lineas (sus 9). Se acaban los duplicados y las celdas de "Capítulo del presupuesto" vacías (eran síntoma del mismo bug). (2) Capítulo del presupuesto RELLENO en todas las líneas: calcConexion ahora da el capítulo de cada línea (1.1.1 / 1.1.2 / 1.1.3 / 2.4 / 1.6.1); el resto lo da el motor o la hoja. (3) Estructura COMPLETA en orden del Excel: 1.1 conexión, 1.2 alimentación, 1.3 cuarto, 1.4 MONTANTES (51 líneas), 3 GRUPO DE PRESION (5 líneas), OTROS. Montantes y grupo de presión se pintan DIRECTAMENTE desde plan5_mediciones (parseMediciones ahora devuelve `lineas` con todas las filas-partida) con cantidad/precio en blanco -> se ven todas las líneas a cero para revisarlas (su motor está pendiente). Validado: node --check + 9 scripts + arnés 1.293 € + parseMediciones.lineas (montantes 51, GP 5). PENDIENTE: unidad del "Dato" fuera del input + input estrecho; motor de grupo de presión (precios + entradas) y de montantes (peines).)
// Build: 2026-06-14 v0.21 (RE-CUADRE conexión al nuevo formato de detalle de Guille + 3 capítulos nuevos. (1) Terminal pasa a "pulgada (mm)" (ej. "2-1/2' (75mm)") y las líneas de cuadrilla a "cuadrilla x2" -> casan con plan5_precios reformateado; conexión vuelve a 1.293 €. (2) CAPÍTULOS NUEVOS en el motor y en MEDICIONES: 1.2 TUBO DE ALIMENTACION (diámetro propio por normativa pág.12: base <=15, +10 entre 15-40, +20 >40; accesorios por pulgada; sacos/f.viga/f.techo según montaje; 3 líneas de días), 1.3 CUARTO DE CONTADORES (baterías por modelo, llaves/flexo = nsum, capítulo dinámico por tipo de cuarto B39), y OTROS TIEMPOS/TRABAJOS (horas extra + importe € manual). (3) Toma de datos ahora ENVÍA los datos que faltaban: longitud alimentación, montaje, nº codos, nº llaves, baterías 1/2, tipo de cuarto, otros tiempos y € (ids nuevos + objeto motor ampliado). (4) Días de alimentación por OBRA_DEFAULT (editables en el Sheet más adelante); capítulos nuevos sin edición inline de "Dato" de momento (se ajusta después). PENDIENTE (avisado): 2 precios del cuarto salen a 0 -> "Accesorios, pequeño material y comprobación" y "Albañil (ejecución cuarto contadores OBRA...)"; tuerca reducción, grupo de presión y montantes para más adelante. Validado: node --check + 9 scripts + arnés 1.293 € (tabla nueva) + calcular() 4 capítulos + jsdom (motor envía los campos nuevos).)
// Build: 2026-06-14 v0.20 (Mismo "mm" para diámetros en la tabla PRECIOS (columna Detalle): se MUESTRAN con "mm" (40 -> "40mm"), pero al entrar a editar se ve el número limpio y al guardar se quita el "mm", así el Sheet plan5_precios sigue con números limpios y las búsquedas (precioDe/udDe) no cambian. Solo afecta a detalles que son número puro; "75mm - 2-1/2'", "ud", "día/cuadrilla", "10T-2F"… se quedan igual. Coherente con MEDICIONES. node --check + 9 scripts + jsdom (muestra 40mm, edita 40, guarda 50).)
// Build: 2026-06-14 v0.19 (El "Detalle" de los diámetros se muestra con "mm": el motor sigue calculando el diámetro como número (40) y con ese número busca precio y Ud; solo al PINTAR, si el detalle es un número puro se le añade "mm" (40 -> "40mm", 110 -> "110mm"). El terminal ("75mm - 2-1/2'"), "ud" y "día/cuadrilla" quedan igual. No afecta a cálculos ni a búsquedas (1.293 € intacto). Verificada la limpieza del Sheet (Tubo conexión PE en una fila sin parámetro; umbral pasante y factores/días intactos; 102 líneas).)
// Build: 2026-06-14 v0.18 (CORRECCIÓN según normativa EMASESA 3.9 (pág.11-12, "Diámetro de la acometida" = tubo de conexión): el ajuste de diámetro por longitud pasa a ser el de la NORMA, no el del Excel. Norma: tabla base ≤6 m; entre 6 y 15 m → +10 mm; EXCEDE DE 15 m → +20 mm. El Excel disparaba el +20 a 14 m (error); ahora entra a >15 m. El +10 (≥6 m) ya era correcto. Estos umbrales son de normativa (fijos), así que dejan de leerse del Sheet y van en el código (diametroConexion ya no recibe umbral; calcConexion no pasa O.umbralDiam). Sánchez Pizjuán (7 m) sigue dando 1.293 €. Las 2 filas de umbral de "Tubo conexión (PE)" en plan5_mediciones quedan IGNORADAS: se pueden borrar del Sheet (rowOf es dinámico, borrarlas no rompe nada). node --check + 9 scripts + arnés 1.293 € + prueba de umbrales (14-15 m → +10, 16 m → +20).)
// Build: 2026-06-14 v0.17 (MEDICIONES coherente con el modelo de datos acordado: (1) nueva primera columna "Ud", leída de plan5_precios col A (función udDe, mismo casado concepto+detalle que el precio; funciona con diámetros guardados como número). (2) el "Tipo" (coste) ahora MANDA LA HOJA: se lee de plan5_mediciones col C (tipo_coste), con respaldo al motor solo si faltara. Columnas MEDICIONES: Ud · Concepto · Dato · Cantidad · Detalle · Precio · Total · Tipo · Capítulo del presupuesto. Fuentes: Ud/Precio de plan5_precios (por concepto+detalle); Detalle/Concepto/Cantidad los calcula el motor (cantidad usa longitud de Toma de datos + factores/días del Sheet + conteos fijos en código); Dato/Tipo/Capítulo de plan5_mediciones. node --check + 9 scripts + arnés 1.293 € + udDe contra precios reales + jsdom (9 columnas).)
// Build: 2026-06-14 v0.16 (Coherencia de nombres: en la tabla PRECIOS la columna "Tipo" pasa a "Detalle" (es el mismo dato que el "Detalle" de MEDICIONES: el calibre/variante que casa el precio). Buscador de PRECIOS actualizado ("...concepto, detalle o ud..."). El "Tipo" de MEDICIONES sigue siendo el TIPO COSTE (MAT/MO/ALB), sin tocar. Solo etiquetas. node --check + 9 scripts OK.)
// Build: 2026-06-14 v0.15 (Retoques de MEDICIONES: (1) la columna "Variante" pasa a llamarse "Detalle". (2) la columna "Parcial" pasa a "Total" (es el importe de la línea = cantidad × precio). (3) las casillas editables del "Dato" usan ahora la clase .cell del programa (mismo estilo de entrada que PRECIOS: fondo gris claro, borde redondeado, foco a blanco), conservando la clase datocell para el JS. Solo presentación; motor intacto. node --check + 9 scripts OK; arnés 1.293 €.)
// Build: 2026-06-14 v0.14 (Nueva columna "Variante" en MEDICIONES, entre Cantidad y Precio: muestra el calibre/variante de cada línea (Ø75, "75mm - 2-1/2'", "ud", "día/cuadrilla"…), que es la columna B/"tipo" del Excel y lo que casa el precio en plan5_precios. Antes iba pegada al concepto; ahora el concepto queda limpio y la variante tiene su columna. La columna "Tipo" sigue siendo el TIPO COSTE (col K: MAT/MO/ALB). Sin cambios de lógica del motor. Validado: node --check + 9 scripts + arnés 1.293 € + jsdom (8 columnas, variante en su sitio).)
// Build: 2026-06-14 v0.13 (MEDICIONES terminada para el capítulo de conexión. (1) Recálculo robusto: al editar un "Dato" se guarda en `plan5_mediciones` (col F) y el SERVIDOR recalcula TODO (diámetros, precios, días, total) y la pantalla se REPINTA — endpoint nuevo /plan5/desglose?format=json. Así cualquier parámetro queda bien sin duplicar fórmulas en cliente. (2) Editables inline ahora: factores de sacos/losa (ud/m) Y días de cuadrilla (el tramo que aplica a la longitud). Umbrales de diámetro (+10/+14) y pasante se editan en el Sheet (raros) y la pantalla los recoge al recalcular. (3) Deshacer/Rehacer sobre ese flujo (re-guarda y repinta). (4) Columnas mucho más juntas (padding 1px 4px, anchos mínimos). Capítulo del presupuesto FIJO, auto-asignado desde la columna del Sheet (si se cambia ahí, la pantalla lo refleja). Guardado con verde/rojo como el resto. Validado: node --check + 9 scripts + arnés 1.293 € + jsdom (7 columnas, edita→POST→recalcula→repinta, cuadrilla editable, undo/redo).)
// Build: 2026-06-14 v0.12 (MEDICIONES operativa y editable. (1) Nueva columna "Dato" EDITABLE inline en las líneas con parámetro de un solo valor (de momento los factores de sacos/losa, ud/m): al cambiarlo recalcula la fila (cantidad = factor × longCon) y el total del capítulo, y GUARDA el valor en `plan5_mediciones` (col F) con verificación en VERDE/rojo, igual que el resto de guardados. Nueva ruta POST /plan5/mediciones/guardar; parseMediciones expone rowOf (fila del Sheet de cada parámetro). (2) Botones DESHACER / REHACER en la barra (pila de ediciones; re-guarda al deshacer/rehacer). (3) Columnas cantidad/precio/parcial/tipo/capítulo más juntas (menos padding y anchos). (4) La antes "Cap. presupuesto" pasa a "Capítulo del presupuesto" y se muestra FIJA/BLOQUEADA (texto, ya no desplegable; auto-asignada desde el oro). Validado: node --check + 9 scripts + arnés 1.293 € + parseMediciones/rowOf contra el Sheet real + jsdom (7 columnas, edición recalcula fila+total, capítulo bloqueado, undo/redo). PENDIENTE: hacer editable también la cuadrilla (días por tramo) y los umbrales de diámetro; persistir reasignación de capítulo si se quiere editable.)
// Build: 2026-06-14 v0.11 (Parámetros de obra DESDE EL SHEET. (1) Nueva pestaña `plan5_mediciones` (espejo del desglose: 103 líneas del oro, 7 col: capitulo,concepto,tipo_coste,capitulo_presupuesto,parametro,valor,unidad). (2) parseMediciones() la convierte en el objeto OBRA del motor (factores 1/2/4, tramos de días, umbrales diámetro +10/+14 con >=, pasante 40) + un mapa meta (tipo y capítulo por línea). leerMediciones() la lee del Sheet (RANGO_MEDICIONES); la ruta /plan5/desglose ya usa esa OBRA en vez de OBRA_DEFAULT, y adjunta capitulo_presupuesto a cada línea. (3) diametroConexion/pasanteConexion aceptan los umbrales del Sheet; con 6/14/>= el resultado es idéntico (arnés sigue dando 1.293 €). (4) MEDICIONES gana la columna \"Cap. presupuesto\" como DESPLEGABLE (32 partidas del oro, inyectadas como dato; por defecto la del oro). El tipo va al final. OJO: la pestaña trae los parámetros del template (tope 4 m) -> un trabajo de >4 m sale con error de tope hasta subir \"Tramo 2 · hasta\" en el Sheet (como en SP). Validado: node --check + 9 scripts + parseMediciones contra el Sheet real + jsdom (6 columnas, desplegables OK). PENDIENTE: el \"dato personalizable\" editable inline (escritura de vuelta al Sheet) y persistir el cambio del desplegable.)
// Build: 2026-06-14 v0.10 (Sobre v0.9: la casilla derivada junto a los locales pasa de "Nº de viviendas" a "Nº de locales" (cuenta locales sin suministro, no viviendas). Solo etiqueta.)
// Build: 2026-06-14 v0.9 (Fix definitivo del sombreado de las celdas BLOQUEADAS de "Datos CCPP": v0.7 les puso la clase calc-field pero algo del tema seguía pisándoles el fondo (probablemente .ptl-form-grid input -> general-3 = gris claro). Ahora se fuerza con regla propia de la pantalla y !important, sólo sobre esas celdas: .ptl-card .ptl-form-grid input[readonly]{background:gray-400;color:#fff;border-color:gray-400 !important}. Ninguna regla rival usa !important, así que gana seguro en cualquier navegador. Sin cambios de lógica; motor intacto.)
// Build: 2026-06-14 v0.8 (Sobre v0.7, ventana Tipo de edificio: (1) la casilla de comunidad muestra el Nº DE SUMINISTROS comunitarios (0 ó 1), no el nº de puntos de agua: un único suministro comunitario aunque haya 2 puntos (E28=IF(B28>0,1,0)). El nsum ya sumaba +1 correctamente; esto arregla solo lo que se MOSTRABA. (2) Esa casilla se renombra "Comunidad" -> "Nº de comunidad". (3) Reordenada la rejilla: junto a "Locales con/sin suministro" aparecen ahora los derivados "Nº de viviendas" (= locales SIN suministro) y "Tipo" (= TIPO B si hay); y "Viv. con mas de una entrada" + "Nº de entradas de mas" bajan a una fila nueva debajo. node --check + scripts OK.)
// Build: 2026-06-14 v0.7 (Retoques visuales de Toma de datos: (1) los 10 campos READONLY de "Datos CCPP" llevan ahora la clase calc-field -> se ven con el gris de bloqueada (gray-400, letra blanca) como el resto del programa (antes, al estar dentro de .ptl-form-grid, la regla input[readonly] la pisaba .ptl-form-grid input). (2) Quitadas las líneas discontinuas (border-bottom dashed) de las filas de vivienda .vrow, vía <style> propio de esta pantalla. (3) Menú hamburguesa: "Toma de datos" -> "TOMA DE DATOS" (consistente con MEDICIONES y PRECIOS). Sin cambios de lógica; motor intacto.)
// Build: 2026-06-14 v0.6 (Sobre v0.5: ventana "Tipo de edificio" COMPLETA según el Excel. PUNTOS DE AGUA DE COMUNIDAD: los 2 selects llevan id; el derivado "Comunidad" muestra cuántos hay y "Tipo" muestra TIPO A (F28); si hay alguno, suma +1 al nº de suministros (E28=IF(B28>0,1,0)). Mapeo confirmado del resto: nº plantas (B6), nº suministros (E5=L5 derivado = viviendas + locales sin + comunidad), tipo edificio (F5 derivado), "Más de 1 entrada" (D6) NO suma a suministros (solo chequeo peines/texto presupuesto), Altura NO existe en el Excel (input libre). node --check OK; scripts validados.)
// Build: 2026-06-14 v0.5 (Sobre v0.4: LOCALES en el nº de suministros, como el Excel. (1) "Locales SIN suministro" (E7) SUMA al nsum -> son los que reciben contador nuevo. (2) "Locales CON suministro" (C7) NO entra en ningún cálculo (el Excel no lo referencia; queda solo informativo). (3) Los locales cuentan como TIPO B (F7 del Excel): si hay locales sin suministro, el tipo de edificio sube a B como mínimo. Inputs con id localesCon/localesSin + listeners de recalc. node --check OK; scripts de pantalla validados. (Pendiente aún: puntos de agua de comunidad E28 en nsum.))
// Build: 2026-06-14 v0.4 (Sobre v0.3: el "Nº de viviendas" de cada fila vuelve a ser DERIVADO (no se teclea), calculado como el Excel: planta baja = 1 (E8=IF(B<>"",1,"")), resto de plantas = nº de plantas (E16=IF(B<>"",1,"")*B6, la puerta sube por todas las plantas), ático = 1. Nº de suministros (nsum) = suma de todas las filas (L5=SUM(E7:E28)). Solo cuenta filas con puerta o equipamiento. recalc pinta el derivado por fila y suma en nsum. El resto de v0.3 (precioDe número↔texto) se mantiene. node --check OK.)
// Build: 2026-06-14 v0.3 (Sobre v0.2: cierra el hueco para VER el tubo de conexión en MEDICIONES. (1) MOTOR endurecido: precioDe casa la variante por texto exacto Y, si es un número puro (diámetro), también numéricamente -> encuentra el "75"/"90"/"110" aunque el Sheet lo guarde como número. (2) TOMA DE DATOS pasa al motor nsum/tipo/longitud (objeto motor:{nsum,tipo,longCon} en el payload). Revalidado: Sánchez Pizjuán = 9 líneas + 1.293 €. node --check OK.)
// Build: 2026-06-14 v0.2 (Sobre v0.1: (1) RENOMBRADOS visibles: "Desglose de la instalacion"->"MEDICIONES" y "Tabla de precios"->"PRECIOS" (menu hamburguesa + titulos de pestaña; rutas internas /plan5/desglose y /plan5/precios SE MANTIENEN). (2) MOTOR del CAPITULO 1.1 TUBO DE CONEXION (filas 112-120 del Excel): diametro por tabla de acometida de la normativa (codigo) + ajuste por longitud (+10/+20mm) + redondeo comercial; pasante 90/110; terminal/codo por diametro; sacos/losa por factores de OBRA; dias de cuadrilla por tabla de escalones de OBRA (fontanero=albañil, 1 columna). Precios via SUMIFS por concepto+variante contra la tabla PRECIOS del Sheet. Parametros de OBRA por defecto = los del template (tope 4m / 0,375 dias / factores 1-2-4); la pestaña editable plan5_obra queda pendiente. (3) Pantalla MEDICIONES cableada al motor: lee Toma de datos (objeto motor:{nsum,tipo,longCon}) + PRECIOS y pinta las 9 lineas + total del capitulo. (4) Toma de datos guarda ahora motor:{nsum,tipo,longCon} en el payload. VALIDADO en arnes aislado contra el Excel oro (datos+parametros Sanchez Pizjuan): 9 lineas exactas y TOTAL 1.293 €. node --check OK. PENDIENTE para numero en vivo: que Toma de datos capture el nº de viviendas por fila (hoy el campo va como derivado sin rellenar -> nsum=0).
// ----------------------------------------------------------------------------
// Arquitectura (ver plan5-mapa-del-motor.md y plan5-arquitectura-modulo):
//
//   FUENTES (despensa) ─┐
//   ENTRADAS ───────────┴─> calcular(entradas, fuentes) -> resultado
//                                                            ├─ renderPresupuesto
//                                                            ├─ renderMateriales
//                                                            └─ renderTareas
//
// Una sola fuente de verdad: calcular() devuelve UN objeto `resultado` con TODO.
// Las salidas son pintores puros (no tocan precios ni normativa).
// Toma de datos + Datos + Analisis -> fundidos aquí dentro.
// ============================================================================

"use strict";

let validToken; try { ({ validToken } = require("./lib/auth.cjs")); } catch (e) { validToken = () => true; }
let getThemeCss, getPlan5Css; try { ({ getThemeCss, getPlan5Css } = require("./estilo-visual.cjs")); } catch (e) { getThemeCss = () => ""; getPlan5Css = () => ""; }
if (typeof getPlan5Css !== "function") getPlan5Css = () => "";

// Pestaña del Sheet donde se guardan los datos de cada presupuesto Plan 5.
// Columnas: A direccion | B ccpp_id | C nº_presupuesto | D fecha | E revisión | F actualizado | G datos_json
const RANGO_PLAN5 = "plan5_toma_datos!A:G";
const RANGO_PRECIOS = "plan5_precios!A:D";
const RANGO_MEDICIONES = "plan5_mediciones!A:G";
const normDir = s => String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, " ");

// Fuente UNICA de las pantallas de Plan 5: {id, titulo, ruta}. De aqui salen a la
// vez el titulo de la cabecera (#scrTitle) y los textos del menu hamburguesa, asi
// no se pueden descuadrar. Se inyecta en TODAS las pantallas (placeholder __PLAN5_MENU__).
const PLAN5_MENU_JS = `
(function(){
  var SCREENS=[{id:'toma',title:'TOMA DE DATOS',route:'/plan5'},{id:'desglose',title:'MEDICIONES',route:'/plan5/desglose'},{id:'precios',title:'PRECIOS',route:'/plan5/precios'}];
  var tk=window.__PLAN5_TOKEN__||'', dir=window.__PLAN5_DIR__||'', id=window.__PLAN5_VOLVER_ID__||'', cur=window.__PLAN5_SCREEN__||'';
  function q(){ var p=[]; if(dir)p.push('dir='+encodeURIComponent(dir)); if(id)p.push('id='+encodeURIComponent(id)); if(tk)p.push('token='+encodeURIComponent(tk)); return p.length?'?'+p.join('&'):''; }
  var t=document.getElementById('scrTitle'); var me=SCREENS.filter(function(s){return s.id===cur;})[0]; if(t&&me) t.textContent=me.title;
  var list=document.getElementById('menuList');
  if(list){ var html=''; SCREENS.forEach(function(s){ html+='<a class="menu-item'+(s.id===cur?' current':'')+'" href="'+s.route+q()+'">'+s.title+'</a>'; });
    if(id){ html+='<div class="menu-sep"></div><a class="menu-item" href="/presupuestos/expediente?id='+encodeURIComponent(id)+(tk?'&token='+encodeURIComponent(tk):'')+'">\\u2190 Volver al expediente</a>'; }
    list.innerHTML=html; }
  var btn=document.getElementById('menuBtn');
  if(btn&&list){ btn.addEventListener('click',function(e){e.stopPropagation();list.hidden=!list.hidden;}); document.addEventListener('click',function(e){ if(e.target!==btn && !list.contains(e.target)) list.hidden=true; }); }
})();
`;

// La pantalla "Toma de datos" va incrustada aqui como texto (cadena JS escapada);
// asi todo el modulo Plan 5 es UN solo archivo y no hay .html aparte.
const TOMA_DATOS_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<style>.vrow{border-bottom:none}.ptl-card .ptl-form-grid input[readonly]{background:var(--ptl-gray-400)!important;color:#fff!important;border-color:var(--ptl-gray-400)!important}</style>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Plan 5 \u00b7 Toma de datos</title>\n</head>\n<body>\n<script>window.__PLAN5_SAVED__=null;window.__PLAN5_SCREEN__=\"toma\";/*__PLAN5_SAVED__*/</script>\n<div class=\"page\">\n\n  <div class=\"p5bar\">\n    <span class=\"title\" id=\"scrTitle\"></span>\n    <span class=\"p5spacer\"></span>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n\n  <!-- 1. DATOS DEL PRESUPUESTO -->\n  <div class=\"card\">\n    <div class=\"t\">Datos del presupuesto</div>\n    <div class=\"grid g3\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de presupuesto</span><input id=\"f_npresupuesto\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Fecha</span><input id=\"f_fecha\" type=\"date\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Revision</span><div class=\"combo\"><input id=\"f_revision\" value=\"Rev-18 28/05/2026\" autocomplete=\"off\"><button type=\"button\" class=\"combo-arrow\" id=\"f_revision_arrow\" aria-label=\"Desplegar\">\u25be</button><div class=\"combo-list\" id=\"f_revision_list\" hidden><div class=\"combo-opt\">Rev-18 28/05/2026</div></div></div></label>\n    </div>\n  </div>\n\n  <!-- 2. DATOS CCPP (del expediente; identica a la ficha, bloqueada, sin botones) -->\n  <div class=\"ptl-card\">\n    <div class=\"ptl-card-title\">Datos CCPP</div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-1\"><label class=\"ptl-form-label\">Tipo via</label><input class=\"calc-field\" id=\"f_tipovia\" value=\"\" readonly></div>\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Direccion</label><input class=\"calc-field\" id=\"f_direccion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-3\"><label class=\"ptl-form-label\">Poblacion</label><input class=\"calc-field\" id=\"f_poblacion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">CP</label><input class=\"calc-field\" id=\"f_cp\" value=\"\" readonly style=\"width:100%\"></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Administrador</label><input class=\"calc-field\" id=\"f_admin\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_admintel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_adminemail\" value=\"\" readonly></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Presidente</label><input class=\"calc-field\" id=\"f_presidente\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_prestel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_presemail\" value=\"\" readonly></div>\n    </div>\n  </div>\n\n  <!-- 3. EDIFICIO Y VIVIENDAS -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de edificio</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de plantas <small>(Baja + X)</small></span><input id=\"plantas\" type=\"number\" value=\"\" min=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Altura de planta <small>(m)</small></span><input id=\"altura\" type=\"number\" value=\"\" step=\"0.1\"></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de suministros</span><input id=\"nsum\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de edificio</span><div class=\"derived\" id=\"tipoEdif\">TIPO C</div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales con suministro</span><input id=\"localesCon\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales sin suministro</span><input id=\"localesSin\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de locales</span><div class=\"derived\" id=\"locNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"locTipo\"></div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Viv. con mas de una entrada</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de entradas de mas</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n    </div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en planta baja</div>\n      <button class=\"add\" data-z=\"baja\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vbaja\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en resto de plantas</div>\n      <button class=\"add\" data-z=\"resto\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vresto\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en atico</div>\n      <button class=\"add\" data-z=\"atico\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vatico\"></div>\n\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto1\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto2\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de comunidad</span><div class=\"derived\" id=\"comNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"comTipo\"></div></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 7. TUBO CONEXI\u00d3N + ALIMENTACI\u00d3N -->\n  <!-- CARACTER\u00cdSTICAS DE LA INSTALACI\u00d3N (A28:B51) -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de instalacion</div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Acometida</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba contador de agua</span><input value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Ubicacion del contador</span><select><option selected></option><option>FACHADA DELANTERA</option><option>FACHADA LATERAL</option><option>FACHADA TRASERA</option><option>ZONAS COMUNES</option><option>CUARTO DE MOTORES</option><option>EN C\u00baSERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Situacion llave acerado</span><select><option selected></option><option>DELANTERA</option><option>LATERAL</option><option>TRASERA</option><option>DELANTERA-CAMBIAR</option><option>LATERAL-CAMBIAR</option><option>TRASERA-CAMBIAR</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba llaves de corte general <small>(ud)</small></span><input id=\"con_llaves\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de conexion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>PE</option><option>PLOMO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Diametro actual <small>(mm)</small></span><select><option selected></option><option>DESCONOCIDO</option><option>25</option><option>32</option><option>40</option><option>50</option><option>63</option><option>75</option><option>90</option><option>110</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longCon\"><option selected></option><option>NO EXISTE</option><option>VALIDO</option><option>1</option><option>2</option><option>3</option><option>4</option><option>7</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de alimentacion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Montaje propuesto</span><select id=\"ali_montaje\"><option selected></option><option>ENTERRADO</option><option>B.FORJADO</option><option>CANALETA</option><option>F.VIGA</option><option>F.TECHO</option><option>SOLO PIECERIA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longAli\"><option selected></option><option>2,5</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba codos termofusion <small>(ud)</small></span><input id=\"ali_codos\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Montante de abastecimiento</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>COBRE</option><option>HIERRO</option><option>PPR</option><option>PE</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Cuarto de contadores</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select><option selected></option><option>EN FACHADA DELANTERA</option><option>EN FACHADA LATERAL</option><option>EN FACHADA TRASERA</option><option>EN PORTAL</option><option>BAJO ESCALERA</option><option>EN PATIO INTERIOR</option><option>EN PATIO EXTERIOR</option><option>EN C\u00ba.MOTORES</option><option>EN C\u00ba.SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de cuarto</span><select id=\"cuarto_tipo\"><option selected></option><option>EXISTENTE</option><option>ALUMINIO</option><option>OBRA - P.ALUMINIO</option><option>OBRA - P.HIERRO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 1</span><select class=\"bat\" id=\"cuarto_bat1\"></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 2 (si hay)</span><select class=\"bat\" id=\"cuarto_bat2\"></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Grupo de presion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de motores actual</span><select><option></option><option>1</option><option>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Potencia actual <small>(KW)</small></span><select><option></option><option>1,7</option><option>1,9</option><option>2,2</option><option>2,7</option><option>3,0</option><option>4,0</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin <small>(L)</small></span><select><option selected></option><option>NO TIENE</option><option>8</option><option>24</option><option>300</option><option>500</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba depositos</span><select><option selected></option><option>1</option><option>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de motores nuevo</span><select id=\"gpInstala\"><option></option><option>1</option><option>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Potencia nueva <small>(KW)</small></span><select><option></option><option>1,7</option><option>1,9</option><option>2,2</option><option>2,7</option><option>3,0</option><option>4,0</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select><option selected></option><option>NO NECESITA</option><option>C.EXISTENTE</option><option>C.NUEVO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud tubo expulsion <small>(m)</small></span><input type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos <small>(L)</small></span><select><option selected></option><option>750</option><option>1000</option><option>1100</option><option>2000</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempos (cuadrilla X2)</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje de Peines (H)</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje nuevo GP (H)</span><input type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje (H)</span><input id=\"otros_t1\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje (H)</span><input id=\"otros_t2\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros trabajos extra <small>(\u20ac)</small></span><input id=\"otros_eur\" type=\"text\" inputmode=\"decimal\" value=\"\" class=\"euro\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n  </div>\n\n  <!-- 10. PEINES -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de peines</div>\n    <div id=\"peines\"></div>\n  </div>\n\n</div>\n\n<script>\nconst PLAST={20:25,25:32,30:40,40:50,50:63,60:75,80:90,100:110};\nconst ACOM=[[20,2,1,1,0,0],[25,6,4,3,2,1],[30,15,11,9,7,5],[40,60,40,33,22,17],[50,100,70,55,37,30],[60,180,120,90,60,50],[80,400,300,250,200,150]];\nconst ALIM=[[30,2,1,1,0,0],[40,5,3,2,2,1],[50,25,16,14,10,6],[60,75,50,45,40,30],[80,120,90,80,70,60],[100,200,150,130,110,90]];\nconst TI={\"TIPO A\":0,\"TIPO B\":1,\"TIPO C\":2,\"TIPO D\":3,\"TIPO E\":4};\nconst EQUIP_TIPO={\"Cocina + Lavadero + sanitario\":\"TIPO A\",\"Cocina + Lavadero + aseo\":\"TIPO B\",\"Cocina + Lavadero + ba\u00f1o\":\"TIPO C\",\"Cocina + Office + Lavadero + ba\u00f1o + aseo\":\"TIPO D\",\"Cocina + Office + Lavadero + 2 ba\u00f1o + aseo\":\"TIPO E\",\"Otros\":\"TIPO F\"};\nfunction diamBase(t,n,tipo){const i=TI[tipo];if(i===undefined)return null;for(const f of t){if(f[1+i]>0&&n<=f[1+i])return f[0];}return null;}\nfunction dAco(n,tipo,L){let d=diamBase(ACOM,n,tipo);if(d===null)return\"\u2014\";if(L>15)d+=20;else if(L>6)d+=10;return(PLAST[d]||d)+\" mm\";}\nfunction dAli(n,tipo,L){let d=diamBase(ALIM,n,tipo);if(d===null)return\"\u2014\";if(L>40)d+=20;else if(L>15)d+=10;return(PLAST[d]||d)+\" mm\";}\n\nfunction pp(t,h,n){const M={\"SIMPLE\":[1,0,0],\"SIMPLE+1\":[1,1,0],\"1-SIMPLE\":[1,0,h],\"1-SIMPLE+1\":[1,1,h],\"SIMPLE-1\":[1,0,h*(n+1)],\"SIMPLE-2\":[1,0,h*(2*n+1)],\"1-SIMPLE-1\":[1,0,h*(n+1)+h],\"1-SIMPLE-2\":[1,0,h*(2*n+1)+h],\"DOBLE\":[2,0,0],\"DOBLE+1\":[2,1,0],\"DOBLE+2\":[2,2,0],\"1-DOBLE\":[2,0,h],\"2-DOBLE\":[2,0,2*h],\"1-DOBLE+1\":[2,1,h],\"2-DOBLE+1\":[2,1,2*h],\"1-DOBLE+2\":[2,2,h],\"DOBLE-1\":[2,0,h],\"DOBLE-2\":[2,0,2*h],\"2-DOBLE+2\":[2,2,2*h]};return M[t]||[1,0,0];}\nconst TIPOS=[\"SIMPLE\",\"SIMPLE+1\",\"SIMPLE-1\",\"SIMPLE-2\",\"1-SIMPLE\",\"1-SIMPLE+1\",\"1-SIMPLE-1\",\"1-SIMPLE-2\",\"DOBLE\",\"DOBLE+1\",\"DOBLE+2\",\"DOBLE-1\",\"DOBLE-2\",\"1-DOBLE\",\"2-DOBLE\",\"1-DOBLE+1\",\"2-DOBLE+1\",\"1-DOBLE+2\",\"2-DOBLE+2\"];\nconst EQUIPS=Object.keys(EQUIP_TIPO);\nfunction pTubo(t,h,n){const[k,p,R]=pp(t,h,n);return k*h*(n+1)*(n+2)/2+p*h*(n+2)-R;}\nfunction pViv(t,n){const[k,p]=pp(t,1,n);return k*(n+1)+p;}\n\nconst $=id=>document.getElementById(id);\nconst zonas={ baja:[], resto:[], atico:[] };\nconst CONT={baja:\"vbaja\",resto:\"vresto\",atico:\"vatico\"};\nlet peines=[];\n\nfunction renderZona(z){\n  const arr=zonas[z],c=$(CONT[z]);c.innerHTML=\"\";\n  arr.forEach((v,i)=>{\n    const r=document.createElement(\"div\");r.className=\"vrow\";\n    const o=`<option ${!v.equip?'selected':''}></option>`+EQUIPS.map(e=>`<option ${e===v.equip?'selected':''}>${e}</option>`).join(\"\");\n    const pu=`<option ${!v.puerta?'selected':''}></option>`+[\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"DCHA\",\"IZDA\",\"CENTRO\"].map(x=>`<option ${x===v.puerta?'selected':''}>${x}</option>`).join(\"\");\n    r.innerHTML=`<label class=\"f\"><span class=\"lab\">Puerta</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"vp\">${pu}</select></label>\n      <label class=\"f\"><span class=\"lab\">Equipamiento</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"ve\">${o}</select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de viviendas</span><div class=\"derived vn-disp\" data-z=\"${z}\" data-i=\"${i}\">${v.n||0}</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">${EQUIP_TIPO[v.equip]||''}</div></label>\n      <button class=\"del\" data-z=\"${z}\" data-i=\"${i}\">\u00d7</button>`;\n    c.appendChild(r);\n  });\n  c.querySelectorAll(\".vp\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].puerta=e.target.value;recalc();});\n  c.querySelectorAll(\".ve\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].equip=e.target.value;renderZona(e.target.dataset.z);recalc();});\n  c.querySelectorAll(\".del\").forEach(b=>b.onclick=e=>{zonas[e.target.dataset.z].splice(+e.target.dataset.i,1);renderZona(e.target.dataset.z);recalc();});\n}\nfunction renderVivs(){renderZona(\"baja\");renderZona(\"resto\");renderZona(\"atico\");}\nfunction todasViviendas(){return [...zonas.baja,...zonas.resto,...zonas.atico];}\nconst OPT_ENGANCHE=[\"EXT\",\"INT-FACIL\",\"INT-MEDIO\",\"INT-DIFICIL\"];\nconst OPT_PEINEV=[\"V-INT\",\"V-EXT\"];\nconst OPT_IE=[\"INTERIOR\",\"EXTERIOR\"];\nconst OPT_ENGCB=[\"ENGANCHA EN COCINAS\",\"ENGANCHA EN BA\u00d1OS\"];\nconst OPT_PROT=[\"B.FORJADO\",\"CANALETA\",\"F.VIGA\",\"F.TECHO\",\"B.LADRILLO\"];\nconst OPT_SUBE=[\"SUBE POR FACHADA DELANTERA\",\"SUBE POR FACHADA LATERAL DERECHA\",\"SUBE POR FACHADA LATERAL IZQUIERDA\",\"SUBE POR FACHADA TRASERA\",\"SUBE POR PATIO DERECHO\",\"SUBE POR PATIO CENTRAL\",\"SUBE POR PATIO IZQUIERDO\",\"SUBE POR SCHUNT\"];\nconst OPT_BAJA=[\"NO BAJA\",\"BAJA POR FACHADA DELANTERA\",\"BAJA POR FACHADA LATERAL DERECHA\",\"BAJA POR FACHADA LATERAL IZQUIERDA\",\"BAJA POR FACHADA TRASERA\",\"BAJA POR PATIO DERECHO\",\"BAJA POR PATIO CENTRAL\",\"BAJA POR PATIO IZQUIERDO\",\"BAJA POR SCHUNT\"];\nconst sel=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join(\"\");\nconst selB=(arr,v)=>`<option ${!v?'selected':''}></option>`+sel(arr,v);\nconst subH=t=>`<div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:8px 0 4px;\">${t}</div>`;\n\nfunction tramosHTML(i,m,arr){\n  const cols=(arr||[]).map((tr,t)=>`\n    <div style=\"display:flex;flex-direction:column;gap:4px;\">\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <label class=\"f\" style=\"flex:1;\"><span class=\"lab\">Longitud <small>(m)</small></span><input data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"long\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"${tr.long||''}\"></label>\n        <button class=\"del tdel\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">\u00d7</button>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <select data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"prot\" style=\"flex:1;\"><option ${!tr.prot?'selected':''}></option>${sel(OPT_PROT,tr.prot)}</select>\n        <button class=\"tadd addtramo\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">+</button>\n      </div>\n    </div>`).join(\"\");\n  return `<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end;\">${cols}</div>`;\n}\nfunction renderPeines(){\n  const c=$(\"peines\");c.innerHTML=\"\";\n  if(!peines.length){\n    const ab=document.createElement(\"button\");ab.className=\"add\";ab.title=\"A\u00f1adir peine\";ab.textContent=\"+\";\n    ab.onclick=()=>{peines.push(nuevoPeine());renderPeines();};\n    c.appendChild(ab);return;\n  }\n  peines.forEach((pe,i)=>{\n    const b=document.createElement(\"div\");\n    b.style.cssText=\"border:1px solid var(--g200);border-radius:8px;padding:8px 10px;margin-bottom:8px;position:relative;\";\n    b.innerHTML=`\n      <div style=\"position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;\">\n        <button class=\"add padd\" data-i=\"${i}\" title=\"A\u00f1adir peine\">+</button>\n        <button class=\"del pdel\" data-i=\"${i}\">\u00d7</button>\n      </div>\n      <div style=\"font-weight:700;color:var(--titulo);font-size:13px;margin-bottom:6px;\">PEINE ${i+1}</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:16px;\">\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante actual</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Interior / Exterior</span><select data-i=\"${i}\" data-k=\"maIE\">${selB(OPT_IE,pe.maIE)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"maEng\">${selB(OPT_ENGCB,pe.maEng)}</select></label>\n          </div>\n        </div>\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante nuevo</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Recorrido (sube)</span><select data-i=\"${i}\" data-k=\"mnSube\">${selB(OPT_SUBE,pe.mnSube)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Recorrido (baja)</span><select data-i=\"${i}\" data-k=\"mnBaja\">${selB(OPT_BAJA,pe.mnBaja)}</select></label>\n          </div>\n        </div>\n      </div>\n      <div class=\"grid g5\" style=\"margin-top:8px;\">\n        <label class=\"f\"><span class=\"lab\">Puerta(s)</span><input data-i=\"${i}\" data-k=\"puerta\" value=\"${pe.puerta||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Tipo de peine</span><select data-i=\"${i}\" data-k=\"tipo\">${selB(TIPOS,pe.tipo)}</select></label>\n        <label class=\"f\"><span class=\"lab\">N\u00ba giros extra</span><input data-i=\"${i}\" data-k=\"giros\" type=\"number\" min=\"0\" value=\"${pe.giros||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"enganche\">${selB(OPT_ENGANCHE,pe.enganche)}</select></label>\n        <label class=\"f\"><span class=\"lab\">Peine (V)</span><select data-i=\"${i}\" data-k=\"peineV\">${selB(OPT_PEINEV,pe.peineV)}</select></label>\n      </div>\n      <div style=\"margin-top:8px;\">${tramosHTML(i,'tramos',pe.tramos)}</div>`;\n    c.appendChild(b);\n  });\n  c.querySelectorAll(\"[data-k]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{peines[+e.target.dataset.i][e.target.dataset.k]=e.target.value;});\n  });\n  c.querySelectorAll(\"[data-f]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{const d=e.target.dataset; peines[+d.i][d.m][+d.t][d.f]=e.target.value;});\n  });\n  c.querySelectorAll(\".addtramo\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t+1,0,{long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".tdel\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t,1); if(!peines[+d.i][d.m].length)peines[+d.i][d.m].push({long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".pdel\").forEach(b=>b.onclick=e=>{peines.splice(+e.currentTarget.dataset.i,1);renderPeines();});\n  c.querySelectorAll(\".padd\").forEach(b=>b.onclick=()=>{peines.push(nuevoPeine());renderPeines();});\n}\nfunction tipoEdificio(){\n  const orden=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"];let best=\"TIPO A\";\n  todasViviendas().forEach(v=>{const t=EQUIP_TIPO[v.equip];if(t&&orden.indexOf(t)>orden.indexOf(best))best=t;});\n  return best;\n}\nfunction recalc(){\n  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};\n  const n=+$(\"plantas\").value||0,h=+$(\"altura\").value||0;\n  const nViv=todasViviendas().length;\n  let nSum=0; [\"baja\",\"resto\",\"atico\"].forEach(function(z){ zonas[z].forEach(function(v,i){ var c=(v.puerta||v.equip)?((z===\"resto\")?n:1):0; v.n=c; nSum+=c; var d=document.querySelector(\".vn-disp[data-z=\\\"\"+z+\"\\\"][data-i=\\\"\"+i+\"\\\"]\"); if(d) d.textContent=c; }); });\n  var lsin=+($(\"localesSin\")||{}).value||0; nSum+=lsin;\n  var _ln=$(\"locNum\"); if(_ln) _ln.textContent=lsin||\"\"; var _lt=$(\"locTipo\"); if(_lt) _lt.textContent=lsin>0?\"TIPO B\":\"\";\n  var c1=(($(\"comPunto1\")||{}).value||\"\"), c2=(($(\"comPunto2\")||{}).value||\"\");\n  var comN=(c1?1:0)+(c2?1:0);\n  var _cn=$(\"comNum\"); if(_cn) _cn.textContent=comN>0?1:0;\n  var _ct=$(\"comTipo\"); if(_ct) _ct.textContent=comN>0?\"TIPO A\":\"\";\n  if(comN>0) nSum+=1;\n  $(\"nsum\").value = (nViv||lsin||comN) ? nSum : \"\";\n  var tipo = nViv ? tipoEdificio() : \"\";\n  if(lsin>0){ var _ord=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"]; if(!tipo || _ord.indexOf(\"TIPO B\")>_ord.indexOf(tipo)) tipo=\"TIPO B\"; }\n  set(\"tipoEdif\",tipo);\n  const numAli=parseFloat(String(($(\"longAli\")||{}).value||\"\").replace(\",\",\".\"))||0;\n  const a=dAco(nSum,tipo,+$(\"longCon\").value||0),al=dAli(nSum,tipo,numAli);\n  set(\"dAco\",a);set(\"dAli\",al);\n  const sub=nSum*160+($(\"gpInstala\").checked?52:0);\n  set(\"rSub\",sub.toLocaleString(\"es-ES\")+\" \u20ac\");set(\"dSub\",sub.toLocaleString(\"es-ES\")+\" \u20ac\");\n}\ndocument.querySelectorAll(\"button.add[data-z]\").forEach(b=>b.onclick=()=>{const z=b.dataset.z;zonas[z].push({puerta:\"\",equip:\"\",n:\"\"});renderZona(z);recalc();});\nfunction nuevoPeine(){return {puerta:\"\",tipo:\"\",giros:\"\",enganche:\"\",peineV:\"\",maIE:\"\",maEng:\"\",mnSube:\"\",mnBaja:\"\",tramos:[{long:\"\",prot:\"\"}]};}\n[\"plantas\",\"altura\",\"longCon\",\"longAli\",\"gpInstala\",\"localesSin\",\"localesCon\",\"comPunto1\",\"comPunto2\"].forEach(id=>{const el=$(id);if(el){el.addEventListener(\"input\",recalc);el.addEventListener(\"change\",recalc);}});\nconst BATERIAS=\"4T-2F,6T-2F,6T-3F,9T-3F,10T-2F,12T-2F,12T-3F,14T-2F,15T-3F,16T-2F,18T-2F,18T-3F,20T-2F,21T-3F,22T-2F,24T-2F,24T-3F,26T-2F,27T-3F,28T-2F,30T-2F,30T-3F,33T-3F,36T-3F,39T-3F,42T-3F,45T-3F\".split(\",\");\ndocument.querySelectorAll(\"select.bat\").forEach((s)=>{s.innerHTML='<option selected></option>'+BATERIAS.map(b=>`<option>${b}</option>`).join(\"\");});\nrenderVivs();renderPeines();recalc();(function(){var mo=$(\"ali_montaje\"),lo=$(\"longAli\"),co=$(\"ali_codos\");function pz(){var p=mo&&mo.value===\"SOLO PIECERIA\";if(lo){lo.disabled=p;if(p)lo.value=\"\";}if(co){co.disabled=p;if(p)co.value=\"\";}recalc();}if(mo)mo.addEventListener(\"change\",pz);pz();})();\n\n// ---- Guardar / precargar contra el Sheet (v\u00eda el m\u00f3dulo) ----\nfunction camposEstaticos(){\n  const dyn=[\"vbaja\",\"vresto\",\"vatico\",\"peines\"].map(id=>$(id)).filter(Boolean);\n  const dentro=el=>dyn.some(d=>d.contains(el));\n  return [...document.querySelectorAll(\".page input, .page select\")].filter(el=>!dentro(el));\n}\nfunction camposEditables(){ return camposEstaticos().filter(function(el){ return !el.readOnly && el.type!==\"hidden\"; }); }\nfunction serializar(){\n  var _ns=parseInt(($(\"nsum\")||{}).value,10)||0; var _tp=(($(\"tipoEdif\")||{}).textContent||\"\").trim(); var _lc=parseFloat(String((($(\"longCon\")||{}).value||\"\")).replace(\",\",\".\"))||0; var gv=function(id){var e=$(id);return e?e.value:\"\";}; var pf=function(id){return parseFloat(String(gv(id)).replace(\",\",\".\"))||0;}; var pe=function(id){return parseFloat(String(gv(id)).replace(/\\./g,\"\").replace(\",\",\".\"))||0;}; return { v: camposEditables().map(el=>el.value), zonas, peines, motor:{ nsum:_ns, tipo:_tp, longCon:_lc, longAli: pf(\"longAli\"), montaje: gv(\"ali_montaje\"), codos: pf(\"ali_codos\"), llaves: pf(\"con_llaves\"), bat1: gv(\"cuarto_bat1\"), bat2: gv(\"cuarto_bat2\"), tipoCuarto: gv(\"cuarto_tipo\"), otrosTiempos: (pf(\"otros_t1\")+pf(\"otros_t2\")), otrosEur: pe(\"otros_eur\") } };\n}\nfunction hidratar(d){\n  if(!d) return;\n  if(d.zonas){ zonas.baja=d.zonas.baja||[]; zonas.resto=d.zonas.resto||[]; zonas.atico=d.zonas.atico||[]; }\n  if(Array.isArray(d.peines)&&d.peines.length){ peines.length=0; d.peines.forEach(p=>peines.push(p)); }\n  renderVivs(); renderPeines();\n  if(Array.isArray(d.v)){ camposEditables().forEach((el,i)=>{ if(i<d.v.length) el.value=d.v[i]; }); }\n  recalc();\n}\nconst PLAN5_TOKEN = new URLSearchParams(location.search).get(\"token\")||\"\";\n// Guarda TODO el formulario en el Sheet (1 fila por direccion). Devuelve true/false.\nasync function plan5GuardarTodo(){\n  try{\n    const body=new URLSearchParams();\n    var _tv=($(\"f_tipovia\")||{}).value||\"\"; var _dc=($(\"f_direccion\")||{}).value||\"\";\n    body.set(\"direccion\", ((_tv?_tv+\" \":\"\")+_dc).trim());\n    body.set(\"ccpp_id\", window.__PLAN5_VOLVER_ID__||\"\");\n    body.set(\"npresupuesto\", ($(\"f_npresupuesto\")||{}).value||\"\");\n    body.set(\"fecha\", ($(\"f_fecha\")||{}).value||\"\");\n    body.set(\"revision\", ($(\"f_revision\")||{}).value||\"\");\n    body.set(\"payload\", JSON.stringify(serializar()));\n    const r=await fetch(\"/plan5/guardar?token=\"+encodeURIComponent(PLAN5_TOKEN),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n    const j=await r.json().catch(()=>({ok:false}));\n    return !!(j&&j.ok);\n  }catch(e){ return false; }\n}\n// Recuadro verde 5s al guardar OK; rojo permanente al fallo (clases de estilo-visual).\nfunction plan5Flash(el, ok){\n  if(!el) return;\n  if(el._p5t){ clearTimeout(el._p5t); el._p5t=null; }\n  el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n  if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._p5t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._p5t=null; },5000); }\n  else { el.classList.add(\"ptl-guardado-error\"); }\n}\nasync function plan5OnCambio(el){\n  if(!el || el.readOnly) return;\n  const oldV = el.dataset.orig===undefined ? \"\" : el.dataset.orig;\n  if(el.value===oldV) return;\n  el.dataset.orig = el.value;\n  const ok = await plan5GuardarTodo();\n  plan5Flash(el, ok);\n}\nconst PAGE = document.querySelector(\".page\");\n// Fija el valor base al entrar en el campo (vale para campos din\u00e1micos tambi\u00e9n)\nPAGE.addEventListener(\"focusin\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,select,textarea\") && el.dataset.orig===undefined) el.dataset.orig=el.value; });\n// Guardar al salir del campo (inputs) o al cambiar (selects)\nPAGE.addEventListener(\"focusout\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,textarea\")) plan5OnCambio(el); });\nPAGE.addEventListener(\"change\", function(e){ const el=e.target; if(el.matches && el.matches(\"select\")) plan5OnCambio(el); });\n// Cambios estructurales (a\u00f1adir/borrar viviendas, peines, tramos): guardar tambi\u00e9n\nPAGE.addEventListener(\"click\", function(e){ const b=e.target.closest && e.target.closest(\"button.add,button.tadd,button.del,button.padd,button.pdel,button.addtramo,button.tdel\"); if(b) setTimeout(plan5GuardarTodo,0); });\nif(window.__PLAN5_DIR__){ var _fd=$(\"f_direccion\"); if(_fd) _fd.value=window.__PLAN5_DIR__; }\nfunction _fmtTlf(v){ var d=String(v||\"\").replace(/\\D/g,\"\"); return d.length===9 ? d.slice(0,3)+\"-\"+d.slice(3,6)+\"-\"+d.slice(6) : (v||\"\"); }\nif(window.__PLAN5_EXP__){ var _e=window.__PLAN5_EXP__; var _sv=function(id,v){var el=$(id); if(el&&v!=null&&v!==\"\") el.value=v;};\n  _sv(\"f_tipovia\",_e.tipo_via); _sv(\"f_direccion\",_e.direccion_calle); _sv(\"f_poblacion\",_e.poblacion); _sv(\"f_cp\",_e.cp);\n  _sv(\"f_admin\",_e.administrador); _sv(\"f_admintel\",_fmtTlf(_e.tel_administrador)); _sv(\"f_adminemail\",_e.email_administrador);\n  _sv(\"f_presidente\",_e.presidente); _sv(\"f_prestel\",_fmtTlf(_e.tel_presidente)); _sv(\"f_presemail\",_e.email_presidente);\n}\nif(window.__PLAN5_SAVED__) hidratar(window.__PLAN5_SAVED__);\ndocument.querySelectorAll('input[type=\"number\"]').forEach(inp=>{\n  inp.addEventListener(\"input\",()=>{ if(inp.value===\"0\") inp.value=\"\"; });\n});\ndocument.querySelectorAll(\"input.euro\").forEach(inp=>{\n  inp.addEventListener(\"blur\",()=>{\n    let n=parseFloat(inp.value.replace(/\\./g,\"\").replace(\",\",\".\"));\n    inp.value = isNaN(n) ? \"\" : n.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2});\n  });\n  inp.addEventListener(\"focus\",()=>{ inp.value=inp.value.replace(/\\./g,\"\").replace(\",\",\".\"); });\n});\nfunction fmtLong(inp){ let n=parseFloat(String(inp.value).replace(\",\",\".\")); inp.value = isNaN(n) ? \"\" : n.toFixed(1).replace(\".\",\",\"); inp.dispatchEvent(new Event(\"input\",{bubbles:true})); }\ndocument.addEventListener(\"blur\",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains(\"long\")) fmtLong(e.target); }, true);\n// Desplegable propio de Revision (flecha que funciona en Firefox; deja escribir)\n(function(){\n  var inp=$(\"f_revision\"), arr=$(\"f_revision_arrow\"), lst=$(\"f_revision_list\");\n  if(!inp||!arr||!lst) return;\n  arr.addEventListener(\"click\", function(e){ e.preventDefault(); e.stopPropagation(); lst.hidden=!lst.hidden; });\n  lst.querySelectorAll(\".combo-opt\").forEach(function(o){\n    o.addEventListener(\"click\", function(){ inp.value=o.textContent; lst.hidden=true; inp.dataset.orig=inp.value; plan5GuardarTodo().then(function(ok){ plan5Flash(inp, ok); }); });\n  });\n  document.addEventListener(\"click\", function(e){ if(e.target!==arr && !lst.contains(e.target)) lst.hidden=true; });\n})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

// Pantalla de la tabla de PRECIOS (editable, fuente del motor). Incrustada igual.
const PRECIOS_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 \u00b7 PRECIOS</title>\n<style>\n  .page{max-width:900px}\n  .card{padding:6px}\n</style>\n</head>\n<body>\n<script>window.__PRECIOS__=null;window.__PLAN5_VOLVER__=\"\";window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"precios\";/*__PRECIOS_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <span class=\"title\" id=\"scrTitle\"></span>\n    <input id=\"q\" type=\"text\" placeholder=\"Buscar concepto, detalle o ud...\" autocomplete=\"off\">\n    <button id=\"addBtn\" class=\"addp\" type=\"button\" title=\"Anadir precio\">+</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div class=\"card\">\n    <table>\n      <thead><tr><th class=\"ud\">Ud</th><th>Concepto</th><th class=\"tp\">Detalle</th><th class=\"pr\">Precio (\u20ac)</th><th class=\"dc\"></th></tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DATA=(window.__PRECIOS__||[]).slice();\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  // Sin acentos para buscar\n  function sa(s){ return (s||\"\").toString().normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g,\"\").toLowerCase(); }\n  // Orden alfabetico por concepto y luego tipo\n  DATA.sort(function(a,b){\n    var c=sa(a.concepto).localeCompare(sa(b.concepto));\n    return c!==0 ? c : sa(a.tipo).localeCompare(sa(b.tipo));\n  });\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function render(filtro){\n    var f=sa(filtro);\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    var vis=0;\n    DATA.forEach(function(p){\n      if(f && sa(p.concepto+\" \"+p.tipo+\" \"+p.ud).indexOf(f)===-1) return;\n      vis++;\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML=\n        '<td class=\"ud\"><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"ud\" value=\"'+esc(p.ud)+'\" data-orig=\"'+esc(p.ud)+'\"></td>'+\n        '<td><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"concepto\" value=\"'+esc(p.concepto)+'\" data-orig=\"'+esc(p.concepto)+'\"></td>'+\n        '<td class=\"tp\"><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"tipo\" value=\"'+esc(detFmt(p.tipo))+'\" data-orig=\"'+esc(detFmt(p.tipo))+'\"></td>'+\n        '<td class=\"pr\"><input class=\"pr\" type=\"text\" inputmode=\"decimal\" data-row=\"'+p.r+'\" data-col=\"precio\" value=\"'+esc(p.precio)+'\" data-orig=\"'+esc(p.precio)+'\"></td>'+\n        '<td class=\"dc\"><button class=\"delp\" type=\"button\" data-row=\"'+p.r+'\" title=\"Borrar\">&#215;</button></td>';\n      tb.appendChild(tr);\n    });\n    if(vis===0){ var tr=document.createElement(\"tr\"); tr.innerHTML='<td class=\"empty\" colspan=\"5\">Sin resultados</td>'; tb.appendChild(tr); }\n  }\n  render(\"\");\n  $(\"q\").addEventListener(\"input\", function(){ render(this.value); });\n\n  // Formato 2 decimales con coma\n  function fmt(v){\n    var n=parseFloat(String(v).replace(/\\./g,\"\").replace(\",\",\".\"));\n    return isNaN(n) ? \"\" : n.toFixed(2).replace(\".\",\",\");\n  }\n  function detFmt(v){ var s=(v==null?\"\":String(v)).trim(); return /^\\d+([.,]\\d+)?$/.test(s)?(s+\"mm\"):s; }\n  function detRaw(v){ var s=(v==null?\"\":String(v)).trim(); return /^\\d+([.,]\\d+)?mm$/.test(s)?s.slice(0,-2).trim():s; }\n  function flash(el, ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  async function guardar(el){\n    var row=el.getAttribute(\"data-row\"), col=el.getAttribute(\"data-col\"), val=el.value;\n      if(col===\"tipo\") val=detRaw(val);\n    try{\n      var body=new URLSearchParams();\n      body.set(\"row\", row); body.set(\"col\", col); body.set(\"valor\", val);\n      var r=await fetch(\"/plan5/precios/guardar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      el.dataset.orig=el.value;\n      var d=DATA.find(function(x){return String(x.r)===String(row);}); if(d) d[col]=(col===\"tipo\"?detRaw(el.value):el.value);\n      flash(el, !!(j&&j.ok));\n    }catch(e){ flash(el, false); }\n  }\n  // Al entrar en una celda de Detalle, quita el \"mm\" para editar el numero\n  $(\"tb\").addEventListener(\"focusin\", function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"cell\")&&el.getAttribute(\"data-col\")===\"tipo\") el.value=detRaw(el.value); });\n  // Delegacion: al salir de una celda, formatear precio y guardar si cambio\n  $(\"tb\").addEventListener(\"focusout\", function(e){\n    var el=e.target; if(!el.classList||!(el.classList.contains(\"cell\")||el.classList.contains(\"pr\"))) return;\n    if(el.getAttribute(\"data-col\")===\"precio\") el.value=fmt(el.value);\n    if(el.getAttribute(\"data-col\")===\"tipo\") el.value=detFmt(el.value);\n    if(el.value===(el.dataset.orig||\"\")) return;\n    guardar(el);\n  });\n  // Borrar una linea: elimina la fila del Sheet y reajusta indices\n  $(\"tb\").addEventListener(\"click\", async function(e){\n    var b=e.target.closest && e.target.closest(\".delp\"); if(!b) return;\n    var row=parseInt(b.getAttribute(\"data-row\"),10);\n    var d=DATA.find(function(x){return x.r===row;});\n    var nombre=(d&&((d.concepto||\"\")+\" \"+(d.tipo||\"\")).trim())||\"esta linea\";\n    if(!confirm(\"Borrar \\\"\"+nombre+\"\\\"?\")) return;\n    try{\n      var body=new URLSearchParams(); body.set(\"row\", row);\n      var r=await fetch(\"/plan5/precios/borrar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      if(!j||!j.ok){ alert(\"No se pudo borrar\"); return; }\n      var idx=DATA.findIndex(function(x){return x.r===row;}); if(idx>=0) DATA.splice(idx,1);\n      DATA.forEach(function(x){ if(x.r>row) x.r--; });  // las de abajo suben 1\n      render($(\"q\").value);\n    }catch(err){ alert(\"Error al borrar: \"+err.message); }\n  });\n  // Boton + : anade una linea de precio nueva (reserva fila en el Sheet)\n  $(\"addBtn\").addEventListener(\"click\", async function(){\n    try{\n      var r=await fetch(\"/plan5/precios/nueva\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\"});\n      var j=await r.json().catch(function(){return {ok:false};});\n      if(!j||!j.ok||!j.row){ alert(\"No se pudo anadir la fila\"); return; }\n      DATA.push({ r:j.row, ud:\"\", concepto:(j.concepto||\"\"), tipo:\"\", precio:\"\" });\n      $(\"q\").value=\"\";\n      DATA.sort(function(a,b){ var c=sa(a.concepto).localeCompare(sa(b.concepto)); return c!==0?c:sa(a.tipo).localeCompare(sa(b.tipo)); });\n      render(\"\");\n      var inp=document.querySelector('#tb input[data-row=\"'+j.row+'\"][data-col=\"concepto\"]');\n      if(inp){ inp.scrollIntoView({block:\"center\"}); inp.focus(); inp.select(); }\n    }catch(e){ alert(\"Error al anadir: \"+e.message); }\n  });\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

const DESGLOSE_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 · MEDICIONES</title>\n<style>\n  .page{max-width:1100px}\n  .card{padding:6px}\n  .p5icon{background:none;border:1px solid var(--ptl-general-2);border-radius:6px;width:30px;height:30px;font-size:15px;line-height:1;cursor:pointer;color:var(--ptl-titulo);margin-left:4px}\n  .p5icon:disabled{opacity:.35;cursor:default}\n  table.dsg{width:100%;border-collapse:collapse}\n  table.dsg thead th{position:sticky;top:52px;z-index:80;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;font-size:10px;letter-spacing:.4px;text-align:left;padding:4px 4px;border-bottom:1px solid var(--ptl-general-2)}\n  table.dsg th.num,table.dsg td.num{text-align:right}\n  table.dsg td{padding:1px 4px;border-bottom:1px solid var(--ptl-general-2);font-size:11px}\n  table.dsg tr.cap td{background:var(--ptl-general-2);color:var(--ptl-titulo);text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:.4px}\n  table.dsg tr.tot td{font-weight:700;color:var(--ptl-titulo)}\n  table.dsg th.ud,table.dsg td.ud{width:36px}\n  table.dsg td.con{width:auto}\n  table.dsg th.dato,table.dsg td.dato{width:52px}\n  table.dsg td.dato input.cell{text-align:right;height:22px}\n  table.dsg th.cant,table.dsg td.cant{width:48px}\n  table.dsg th.var,table.dsg td.var{width:78px;font-size:10px}\n  table.dsg th.pre,table.dsg td.pre{width:54px}\n  table.dsg th.par,table.dsg td.par{width:56px}\n  table.dsg th.tp,table.dsg td.tp{width:34px;text-align:center}\n  table.dsg th.cap,table.dsg td.cap{width:176px;font-size:10px;color:var(--ptl-general-4)}\n  .dsg-empty{color:var(--ptl-general-4);font-style:italic;padding:14px 8px}\n  table.dsg td.dato{white-space:nowrap}\n  table.dsg td.dato.tramos{width:auto}\n  .dunit{color:var(--ptl-general-4);font-size:10px;margin-left:4px}\n  input.dnum{width:32px;text-align:right;height:20px;font-size:10px;padding:0 2px}\n  .trow{display:inline-flex;align-items:center;gap:3px;flex-wrap:nowrap}\n  .tarr{color:var(--ptl-general-4);font-size:10px}\n  .ttope{color:var(--ptl-general-4);font-size:10px;white-space:nowrap}\n  input.dnum.aplica{color:#2563eb;font-weight:700;border-color:#2563eb}\n  .avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:0 0 8px;font-size:11px}\n</style>\n</head>\n<body>\n<script>window.__DESGLOSE__=null;window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"desglose\";/*__DESGLOSE_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <span class=\"title\" id=\"scrTitle\"></span>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"p5icon\" type=\"button\" title=\"Deshacer\" disabled>&#8634;</button>\n    <button id=\"redoBtn\" class=\"p5icon\" type=\"button\" title=\"Rehacer\" disabled>&#8635;</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div id=\"avisos\"></div>\n  <div class=\"card\">\n    <table class=\"dsg\">\n      <thead><tr>\n        <th class=\"ud\">Ud</th>\n        <th class=\"con\">Concepto</th>\n        <th class=\"dato num\">Dato</th>\n        <th class=\"cant num\">Cantidad</th>\n        <th class=\"var\">Detalle</th>\n        <th class=\"pre num\">Precio</th>\n        <th class=\"par num\">Total</th>\n        <th class=\"tp\">Tipo</th>\n      </tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DSG=window.__DESGLOSE__||null;\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  var DIR=window.__PLAN5_DIR__||\"\";\n  var hist=[], hpos=-1;\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function fmt(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return x.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2}); }\n  function numED(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return (Math.round(x*1000)/1000).toString().replace(\".\",\",\"); }\n  function fmtm(m){ if(m==null||m===\"\")return\"\"; var x=Number(m); if(isNaN(x))return esc(m); return (Math.round(x*100)/100).toString().replace(\".\",\",\")+\" m\"; }\n  function datoCell(l){\n    if(!l.dato) return '<td class=\"dato\"></td>';\n    if(l.dato.tipo===\"tramos\"){\n      var t=l.dato.tramos||[]; var p=[];\n      p.push('<span class=\"ttope\">'+fmtm(t.length?t[0].lo:0)+'</span>');\n      for(var i=0;i<t.length;i++){\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<input class=\"cell dnum datocell'+(t[i].aplica?' aplica':'')+'\" data-row=\"'+t[i].row+'\" value=\"'+esc(numED(t[i].dias))+'\" data-orig=\"'+esc(numED(t[i].dias))+'\">');\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<span class=\"ttope\">'+fmtm(t[i].hi)+'</span>');\n      }\n      return '<td class=\"dato tramos\"><span class=\"trow\">'+p.join(\"\")+'</span><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n    }\n    return '<td class=\"dato\"><input class=\"cell dnum datocell\" data-row=\"'+l.dato.row+'\" value=\"'+esc(numED(l.dato.valor))+'\" data-orig=\"'+esc(numED(l.dato.valor))+'\"><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n  }\n  function render(dsg){\n    DSG=dsg;\n    var av=$(\"avisos\"); if(av){ av.innerHTML=\"\"; if(dsg&&dsg.avisos&&dsg.avisos.length){ av.innerHTML='<div class=\"avbox\">'+dsg.avisos.map(function(a){return esc(a);}).join(\"<br>\")+'</div>'; } }\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    if(!dsg||!dsg.lineas||!dsg.lineas.length){\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML='<td class=\"dsg-empty\" colspan=\"8\">El motor de calculo aun no esta conectado. Rellena viviendas y longitud en Toma de datos.</td>';\n      tb.appendChild(tr); return;\n    }\n    dsg.lineas.forEach(function(l){\n      var tr=document.createElement(\"tr\");\n      if(l.tipo_fila===\"capitulo\"){ tr.className=\"cap\"; tr.innerHTML='<td colspan=\"8\">'+esc(l.concepto)+'</td>'; }\n      else if(l.tipo_fila===\"total\"){ tr.className=\"tot\"; tr.innerHTML='<td></td><td>'+esc(l.concepto)+'</td><td></td><td></td><td></td><td></td><td class=\"par num\">'+fmt(l.parcial)+'</td><td></td>'; }\n      else {\n        tr.innerHTML='<td class=\"ud\">'+esc(l.ud||\"\")+'</td>'+\n          '<td class=\"con\" title=\"'+esc(l.capitulo_presupuesto||\"\")+'\">'+esc(l.concepto)+'</td>'+\n          datoCell(l)+\n          '<td class=\"cant num\">'+fmt(l.cantidad)+'</td>'+\n          '<td class=\"var\">'+esc(l.variante||\"\")+'</td>'+\n          '<td class=\"pre num\">'+fmt(l.precio)+'</td>'+\n          '<td class=\"par num\">'+fmt(l.parcial)+'</td>'+\n          '<td class=\"tp\">'+esc(l.tipo||\"\")+'</td>';\n      }\n      tb.appendChild(tr);\n    });\n  }\n  render(DSG);\n\n  // ---- Edicion: guarda el dato en el Sheet, el servidor recalcula todo y se repinta (verde/rojo) ----\n  function flash(el,ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  function findInput(row){ return document.querySelector('#tb input.datocell[data-row=\"'+row+'\"]'); }\n  function setUndoRedo(){ var u=$(\"undoBtn\"),r=$(\"redoBtn\"); if(u)u.disabled=(hpos<0); if(r)r.disabled=(hpos>=hist.length-1); }\n  async function guardarDato(row,valor){\n    try{\n      var body=new URLSearchParams(); body.set(\"row\",row); body.set(\"valor\",valor);\n      var r=await fetch(\"/plan5/mediciones/guardar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      return !!(j&&j.ok);\n    }catch(e){ return false; }\n  }\n  async function refetch(){\n    try{\n      var url=\"/plan5/desglose?format=json\"+(DIR?\"&dir=\"+encodeURIComponent(DIR):\"\")+(TOKEN?\"&token=\"+encodeURIComponent(TOKEN):\"\");\n      var r=await fetch(url);\n      var j=await r.json().catch(function(){return null;});\n      if(j&&typeof j.dsg!==\"undefined\"){ render(j.dsg); return true; }\n    }catch(e){}\n    return false;\n  }\n  // guarda un valor en una fila, recalcula y marca verde/rojo en esa fila\n  async function commit(row,valor){\n    var sok=await guardarDato(row,valor);\n    var rok=await refetch();\n    flash(findInput(row), sok&&rok);\n    return sok&&rok;\n  }\n  function onEdit(inp){\n    var prev=inp.getAttribute(\"data-orig\"); if(prev==null)prev=\"\";\n    var next=inp.value;\n    if(next===prev)return;\n    hist=hist.slice(0,hpos+1); hist.push({row:inp.getAttribute(\"data-row\"),prev:prev,next:next}); hpos=hist.length-1; setUndoRedo();\n    commit(inp.getAttribute(\"data-row\"),next);\n  }\n  async function undo(){ if(hpos<0)return; var e=hist[hpos]; hpos--; setUndoRedo(); await commit(e.row,e.prev); }\n  async function redo(){ if(hpos>=hist.length-1)return; hpos++; var e=hist[hpos]; setUndoRedo(); await commit(e.row,e.next); }\n  var tb=$(\"tb\");\n  tb.addEventListener(\"focusout\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"datocell\")) onEdit(el); });\n  tb.addEventListener(\"keydown\",function(e){ if(e.key===\"Enter\"&&e.target.classList&&e.target.classList.contains(\"datocell\")) e.target.blur(); });\n  var ub=$(\"undoBtn\"); if(ub) ub.onclick=undo;\n  var rb=$(\"redoBtn\"); if(rb) rb.onclick=redo;\n  setUndoRedo();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

// ============================================================================
// 1) FUENTES (la despensa) — datos que el motor consulta. STUB: se rellenan luego.
// ============================================================================

// PRECIOS: catálogo por concepto+tipo+proveedor. El GRUPO DE PRESIÓN va aquí
// como una línea más (decisión: precio de catálogo, selección manual).
const PRECIOS = {
  // clave "concepto|tipo" -> precio. (cuadrilla/día = 446, etc.)  TODO: cargar
  proveedorActivo: "PROVEEDOR 1",
  diaCuadrilla: 446,
  // tabla: [...]  TODO
};

// TABLAS (normativa EMASESA): se GENERAN de la normativa, no se copian.
// Verificado 100%: acometida (pág.11) y alimentación (pág.12) + mapeo a plástico.
const NORMATIVA = {
  plasticoDe: { 20: 25, 25: 32, 30: 40, 40: 50, 50: 63, 60: 75, 80: 90, 100: 110 },
  // acometida[diam] = {A,B,C,D,E} nº máx suministros (long <= 6m)
  acometida: [
    [20, 2, 1, 1, 0, 0], [25, 6, 4, 3, 2, 1], [30, 15, 11, 9, 7, 5],
    [40, 60, 40, 33, 22, 17], [50, 100, 70, 55, 37, 30],
    [60, 180, 120, 90, 60, 50], [80, 400, 300, 250, 200, 150],
  ],
  alimentacion: [
    [30, 2, 1, 1, 0, 0], [40, 5, 3, 2, 2, 1], [50, 25, 16, 14, 10, 6],
    [60, 75, 50, 45, 40, 30], [80, 120, 90, 80, 70, 60],
    [100, 200, 150, 130, 110, 90],
  ],
  // TODO: montante (pág.13) — pendiente de cruzar del todo
};

// TARIFAS EMASESA por año (cuotas, fianzas, acometidas, subvención). Caducan por año.
const TARIFAS = {
  2026: {
    subvencionBase: 160,        // €/vivienda
    subvencionGrupoPresion: 52,
    subvencionMasDeUnaEntrada: 120,
    subvencionProyecto: 4,
    // cuotas, fianzas, acometidas: [...]  TODO
  },
};

// PEINES: tabla de parámetros {nombre -> k, p, R}. R en función de v,n (se calcula).
// Fórmula única verificada (m de tubo, 0/19 fallos): k·T(p) + p·E(p) − R.
function peinesParams(v, n) {
  // n = plantas del tramo (A1=hasta 5 / A22=total) ; v = viviendas/planta
  return {
    "SIMPLE":      { k: 1, p: 0, R: 0 },
    "SIMPLE+1":    { k: 1, p: 1, R: 0 },
    "1-SIMPLE":    { k: 1, p: 0, R: v },
    "1-SIMPLE+1":  { k: 1, p: 1, R: v },
    "SIMPLE-1":    { k: 1, p: 0, R: v * (n + 1) },
    "SIMPLE-2":    { k: 1, p: 0, R: v * (2 * n + 1) },
    "1-SIMPLE-1":  { k: 1, p: 0, R: v * (n + 1) + v },
    "1-SIMPLE-2":  { k: 1, p: 0, R: v * (2 * n + 1) + v },
    "DOBLE":       { k: 2, p: 0, R: 0 },
    "DOBLE+1":     { k: 2, p: 1, R: 0 },
    "DOBLE+2":     { k: 2, p: 2, R: 0 },
    "1-DOBLE":     { k: 2, p: 0, R: v },
    "2-DOBLE":     { k: 2, p: 0, R: 2 * v },
    "1-DOBLE+1":   { k: 2, p: 1, R: v },
    "2-DOBLE+1":   { k: 2, p: 1, R: 2 * v },
    "1-DOBLE+2":   { k: 2, p: 2, R: v },
    "DOBLE-1":     { k: 2, p: 0, R: v },
    "DOBLE-2":     { k: 2, p: 0, R: 2 * v },
    "2-DOBLE+2":   { k: 2, p: 2, R: 2 * v },
  };
}

// ---------------------------------------------------------------------------
// NORMATIVA — helpers de diámetro (van en CÓDIGO, no en Sheet). Verificado vs Excel.
// ---------------------------------------------------------------------------
const TIPO_IDX = { "TIPO A": 0, "TIPO B": 1, "TIPO C": 2, "TIPO D": 3, "TIPO E": 4 };

// Diámetro COMERCIAL base de la tabla por nº de suministros y tipo (= VLOOKUP del Excel:
// tabla teórica de la normativa -> mapeo al plástico comercial inmediato superior).
function diamComercialBase(tabla, nsum, tipo) {
  const ti = TIPO_IDX[tipo];
  if (ti === undefined) return null;
  for (const fila of tabla) {                       // fila = [diamTeorico, A, B, C, D, E]
    const max = fila[1 + ti];
    if (max > 0 && nsum <= max) return NORMATIVA.plasticoDe[fila[0]] || fila[0];
  }
  return null;
}

// Redondeo al diámetro comercial existente (escalera I112 del Excel).
function redondeoComercial(d) {
  if (d <= 32) return 32;
  if (d <= 40) return 40;
  if (d <= 50) return 50;
  if (d <= 63) return 63;
  if (d <= 75) return 75;
  if (d <= 90) return 90;
  return 110;
}

// Diámetro del TUBO DE CONEXIÓN (= acometida): comercial base + ajuste por longitud + redondeo.
// Normativa pág.12: 6–15 m -> +10 mm ; >15 m -> +20 mm. (Excel: umbrales 5,99 / 13,99.)
function diametroConexion(nsum, tipo, longCon) {
  // Normativa EMASESA 3.9 (pág.11-12): diámetro de la ACOMETIDA (= tubo de conexión).
  // Tabla base para longitud <= 6 m ; entre 6 y 15 m -> +10 mm ; excede de 15 m -> +20 mm.
  const base = diamComercialBase(NORMATIVA.acometida, nsum, tipo);
  if (base === null) return null;
  let d = base;
  if (longCon >= 6) d += 10;   // entre 6 y 15 m
  if (longCon > 15) d += 10;   // excede de 15 m -> +20 total (el Excel lo ponía a 14, mal)
  return redondeoComercial(d);
}

// Pasante (funda): normativa 6.1 "doble de la acometida, mínimo 90". Excel: <40 -> 90, si no 110.
function pasanteConexion(diam) { return (2 * diam) <= 90 ? 90 : 110; }  // norma 6.1: doble, mín 90 -> comercial 90/110

// Texto de variante del terminal fitting (igual que el Excel, para casar con PRECIOS).
const TERMINAL_TXT = {
  25: "3/4' (25mm)", 32: "1' (32mm)", 40: "1-1/4' (40mm)", 50: "1-1/2' (50mm)",
  63: "2' (63mm)", 75: "2-1/2' (75mm)", 90: "3' (90mm)", 110: "4' (110mm)",
};
// Solo la pulgada, para los accesorios de alimentación (llave, válvula, filtro, te, codo, machón, tapón, tuerca).
const DIAM_INCH = { 25:"3/4'", 32:"1'", 40:"1-1/4'", 50:"1-1/2'", 63:"2'", 75:"2-1/2'", 90:"3'", 110:"4'" };

// Días de cuadrilla por escalones (parámetro de OBRA). Devuelve días o null si fuera de tope.
function diasPorTramo(escalones, metros) {
  const es = escalones || [];
  for (let k = 0; k < es.length; k++) {              // primer tramo "<" ; resto "<=" (como el Excel)
    if (k === 0 ? metros < es[k].hasta : metros <= es[k].hasta) return es[k].dias;
  }
  return null;                                       // fuera de tope -> el Excel marca "ERROR>4M"
}

// Dias de cuadrilla de ALIMENTACION: corte "<=" en todos los tramos (como el Excel L8/L9/L10).
function diasAli(escalones, metros) {
  for (const e of (escalones || [])) { if (metros <= e.hasta) return e.dias; }
  return null;                                        // > ultimo tope (20 m) -> no deberia pasar (desplegable max 20)
}

// PARÁMETROS DE OBRA por defecto (los del template). En producción se leerán del Sheet `plan5_obra`.
const OBRA_DEFAULT = {
  conexion: {
    factores: { saco_mortero: 1, saco_arena: 2, losa: 4 },           // ud por metro
    tiempo:   [ { hasta: 1.5, dias: 0.25 }, { hasta: 4, dias: 0.375 } ], // tope template = 4 m
    umbralDiam: { mas10: 6, mas20: 14 },
    pasante: 40,
  },
  alimentacion: {
    factores: { saco_mortero: 1, saco_arena: 2, losa: 4, fviga: 1, ftechoDiv: 2 },
    piezaFont: 0.5,   // dias de fontanero en SOLO PIECERIA (long < 2,5 m)
    tiempoFont: [ { hasta: 6.5, dias: 1 }, { hasta: 15, dias: 1.5 }, { hasta: 20, dias: 2 } ],
    tiempoEnt:  [ { hasta: 6.5, dias: 1.5 }, { hasta: 15, dias: 3 }, { hasta: 20, dias: 4 } ],
    tiempoViga: [ { hasta: 6.5, dias: 0.5 }, { hasta: 15, dias: 1 }, { hasta: 20, dias: 1.5 } ],
  },
};

// Las 32 partidas de presupuesto (columna L del oro) — opciones del desplegable de MEDICIONES.
const CAPS_PRESUPUESTO = [
  "1.1.1 Tubo de conexión", "1.1.2 Tubo pasante", "1.1.3 Accesorios y pequeño material",
  "1.2.1 Tubo de alimentación", "1.2.2 Llaves de paso", "1.2.3 Válvula de retención",
  "1.2.4 Filtro", "1.2.5 Te", "1.2.6 Accesorios y pequeño material",
  "1.2.7 Desmontaje contador general y conexión", "1.3.1.1 Batería de contadores",
  "1.3.1.2 Batería de contadores", "1.3.2 Juego de llaves de escuadra (entrada y salida)",
  "1.3.3 Flexo", "1.3.4 Accesorios y pequeño material", "1.4.1 Tubo distribución (25)",
  "1.4.2 Tubo distribución (32)", "1.4.3 Llaves de paso vivienda", "1.4.4 Accesorios y pequeño material",
  "1.5.1 Cerradura homologada armario-batería", "1.6.1 Mano de obra",
  "2.1 Armario batería de obra (puertas hierro)", "2.2. Punto de luz", "2.3 Sumidero de agua",
  "2.4 Regolas y taladros", "2.5 Techos falsos escayola y formación vigas falsas",
  "3.1 Grupo de presión", "3.2 Tubería de alimentación",
  "3.3 By-pass + llaves + v.antiretorno + pequeño material", "3.4 Depósito",
  "4.1 Forrado montantes con coquilla", "4.2 Canaleta protección chapa",
];

// Convierte las filas de la pestaña `plan5_mediciones` (capitulo,concepto,tipo_coste,
// capitulo_presupuesto,parametro,valor,unidad) en:
//   obra  -> parámetros que consume el motor (factores, tramos de días, umbrales)
//   meta  -> por línea (capitulo|concepto): tipo_coste y capitulo_presupuesto, para pintar/desplegable
//   order -> orden de aparición de las líneas (= orden del oro)
function parseMediciones(values) {
  const num = v => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const meta = {}, param = {}, order = [], rowOf = {}, lineas = [];
  for (let i = 1; i < (values || []).length; i++) {
    const row = values[i] || [];
    const cap = (row[0] == null ? "" : String(row[0])).trim();
    const con = (row[1] == null ? "" : String(row[1])).trim();
    if (!cap || !con || con.toLowerCase() === "concepto") continue;
    const key = cap + "|" + con;
    if (!(key in meta)) {
      meta[key] = { capitulo: cap, concepto: con,
                    tipo_coste: (row[2] == null ? "" : String(row[2])).trim(),
                    capitulo_presupuesto: (row[3] == null ? "" : String(row[3])).trim() };
      param[key] = {}; order.push(key);
    }
    const tc = (row[2] == null ? "" : String(row[2])).trim();
    const cp = (row[3] == null ? "" : String(row[3])).trim();
    if (tc || cp) lineas.push({ capitulo: cap, concepto: con, tipo_coste: tc, capitulo_presupuesto: cp });
    const p = (row[4] == null ? "" : String(row[4])).trim();
    if (p) { param[key][p] = num(row[5]); rowOf[key + "|" + p] = i + 1; }
  }
  const g = (con, p) => { const k = "TUBO DE CONEXION|" + con; return param[k] ? param[k][p] : undefined; };
  const fb = (v, d) => (v == null ? d : v);
  const obra = { conexion: {
    factores: {
      saco_mortero: fb(g("Saco mortero", "Unidades por metro"), 1),
      saco_arena:   fb(g("Saco arena",   "Unidades por metro"), 2),
      losa:         fb(g("Losa",         "Unidades por metro"), 4),
    },
    tiempo: [   // topes EN CÓDIGO (1,5 / 4 m); los días siguen siendo del sheet
      { hasta: 1.5, dias: fb(g("Fontanero (tubo conexión)", "Tramo 1 · días"), 0.25) },
      { hasta: 4,   dias: fb(g("Fontanero (tubo conexión)", "Tramo 2 · días"), 0.375) },
    ],
    umbralDiam: { mas10: fb(g("Tubo conexión (PE)", "Sube +10 mm a partir de (m)"), 6),
                  mas20: fb(g("Tubo conexión (PE)", "Sube +20 mm a partir de (m)"), 14) },
    pasante: fb(g("Tubo pasante (PVC)", "Pasa a Ø110 si acometida ≥ (mm)"), 40),
  }};
  // ALIMENTACION: factores y dias editables desde el Sheet (fallback = valores del Excel/normativa)
  const ga = (con, p) => { const k = "TUBO DE ALIMENTACION|" + con; return param[k] ? param[k][p] : undefined; };
  obra.alimentacion = {
    factores: {
      saco_mortero: fb(ga("Saco mortero", "Unidades por metro"), 1),
      saco_arena:   fb(ga("Saco arena", "Unidades por metro"), 2),
      losa:         fb(ga("Losa", "Unidades por metro"), 4),
      fviga:        fb(ga("Tubo alimentación (f.viga + pintado)", "Unidades por metro"), 1),
      ftechoDiv:    fb(ga("Tubo alimentación (f.techo + agujero + tapado + pintado 50x50cm)", "Metros por agujero"), 2),
    },
    piezaFont: fb(ga("Fontanero (tubo alimentación)", "Piecería · días"), 0.5),
    tiempoFont: [
      { hasta: 6.5, dias: fb(ga("Fontanero (tubo alimentación)", "Tramo 1 · días"), 1) },
      { hasta: 15,  dias: fb(ga("Fontanero (tubo alimentación)", "Tramo 2 · días"), 1.5) },
      { hasta: 20,  dias: fb(ga("Fontanero (tubo alimentación)", "Tramo 3 · días"), 2) },
    ],
    tiempoEnt: [
      { hasta: 6.5, dias: fb(ga("Albañil (tubo alimentación enterrado)", "Tramo 1 · días"), 1.5) },
      { hasta: 15,  dias: fb(ga("Albañil (tubo alimentación enterrado)", "Tramo 2 · días"), 3) },
      { hasta: 20,  dias: fb(ga("Albañil (tubo alimentación enterrado)", "Tramo 3 · días"), 4) },
    ],
    tiempoViga: [
      { hasta: 6.5, dias: fb(ga("Albañil (tubo alimentación f.viga / f.techo)", "Tramo 1 · días"), 0.5) },
      { hasta: 15,  dias: fb(ga("Albañil (tubo alimentación f.viga / f.techo)", "Tramo 2 · días"), 1) },
      { hasta: 20,  dias: fb(ga("Albañil (tubo alimentación f.viga / f.techo)", "Tramo 3 · días"), 1.5) },
    ],
  };
  return { obra, meta, order, rowOf, lineas };
}

// Precio por concepto + variante (= el SUMIFS del Excel sobre la tabla PRECIOS del Sheet).
// Casa la variante por texto exacto y, si la variante es un número puro (diámetro), también
// numéricamente (así "75" del motor encuentra el "75" / "75,0" que el Sheet guarda como número).
function precioDe(precios, concepto, variante) {
  const vStr = String(variante).trim();
  const pureNum = /^\d+([.,]\d+)?$/.test(vStr);
  const vNum = pureNum ? parseFloat(vStr.replace(",", ".")) : NaN;
  for (const p of (precios || [])) {
    if (p.concepto !== concepto) continue;
    const tRaw = (p.tipo == null ? "" : String(p.tipo)).trim();
    let match = (tRaw === vStr);
    if (!match && pureNum) { const tNum = parseFloat(tRaw.replace(",", ".")); match = !isNaN(tNum) && tNum === vNum; }
    if (match) {
      const n = (typeof p.precio === "number") ? p.precio
              : parseFloat(String(p.precio).replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

// Unidad (col A de plan5_precios) del concepto+variante, mismo casado que precioDe.
function udDe(precios, concepto, variante) {
  const vStr = String(variante).trim();
  const pureNum = /^\d+([.,]\d+)?$/.test(vStr);
  const vNum = pureNum ? parseFloat(vStr.replace(",", ".")) : NaN;
  for (const p of (precios || [])) {
    if (p.concepto !== concepto) continue;
    const tRaw = (p.tipo == null ? "" : String(p.tipo)).trim();
    let match = (tRaw === vStr);
    if (!match && pureNum) { const tNum = parseFloat(tRaw.replace(",", ".")); match = !isNaN(tNum) && tNum === vNum; }
    if (match) return (p.ud == null ? "" : String(p.ud));
  }
  return "";
}
function calcConexion(nsum, tipo, longCon, precios, obra) {
  const O = (obra && obra.conexion) || OBRA_DEFAULT.conexion;
  const diam = diametroConexion(nsum, tipo, longCon);
  const pasante = (diam == null) ? null : pasanteConexion(diam);
  const termTxt = (diam == null) ? "" : (TERMINAL_TXT[diam] || "");
  const dias = diasPorTramo(O.tiempo, longCon);      // fontanero = albañil (misma tabla, 1 columna)
  const fc = O.factores;
  const r = x => Math.round(x);

  const L = [];
  const add = (concepto, variante, cantidad, tipoCoste, capitulo) =>
    L.push({ concepto, variante, cantidad, precio: precioDe(precios, concepto, variante), tipoCoste, capitulo });

  add("Tubo conexión (PE)",        diam,            longCon,                "MAT", "1.1.1 Tubo de conexión");
  add("Tubo pasante (PVC)",        pasante,         1,                      "MAT", "1.1.2 Tubo pasante");
  add("Terminal fitting",          termTxt,         2,                      "MAT", "1.1.3 Accesorios y pequeño material");
  add("Codo fitting",              diam,            2,                      "MAT", "1.1.3 Accesorios y pequeño material");
  add("Saco mortero",              "ud",            r(fc.saco_mortero * longCon), "ALB", "2.4 Regolas y taladros");
  add("Saco arena",                "ud",            r(fc.saco_arena   * longCon), "ALB", "2.4 Regolas y taladros");
  add("Losa",                      "ud",            r(fc.losa         * longCon), "ALB", "2.4 Regolas y taladros");
  add("Fontanero (tubo conexión)", "cuadrilla x2", (dias == null ? 0 : dias), "MO", "1.6.1 Mano de obra");
  add("Albañil (tubo conexión)",   "cuadrilla x2", (dias == null ? 0 : dias), "MO", "2.4 Regolas y taladros");

  let total = 0;
  for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  const avisos = [];
  if (diam === 110) avisos.push("La acometida sale Ø110 mm: no hay precio de \"Codo fitting\" para ese diámetro (saldrá a 0).");
  return { diam, pasante, dias, error: (dias == null), lineas: L, total: +total.toFixed(2), avisos: avisos };
}

const FUENTES = { PRECIOS, NORMATIVA, TARIFAS, peinesParams };

// ============================================================================
// 2) EL MOTOR — calcular(entradas) -> resultado   (6 pasos, una pasada)
// ============================================================================

function resultadoVacio() {
  // ESTE es el esqueleto que se enseña: la forma del objeto `resultado`.
  return {
    meta:   { nPresupuesto: "", fecha: null, rev: "Rev-18" },
    finca:  { direccion: "", numero: "", poblacion: "", cp: "", administrador: "", presidente: "" },

    entrada: {
      plantas: 0, plantasRedGeneral: 0, viviendas: 0, vivPlantaBaja: 0,
      puntosComunidad: 0, tipoSuministro: "", longTuboConexion: 0, longTuboAlimentacion: 0,
      bateria1: "", bateria2: "",
      grupoPresion: { tiene: false, seInstala: false, modelo: "", deposito: "" },
      peines: [],   // topología: [{ tipo, vivPlanta, protecciones:{...} }, ...]
      tiempos: {},
    },

    dimensiones: { diamAcometida: 0, diamAlimentacion: 0, diamMontante: 0 },

    peines: {
      mlTuboTotal: 0, mlTuboHasta5: 0, mlPeineHoriz: 0, nViviendas: 0,
      codos: 0, chapa: 0,
      reparto: { bForjado: 0, canaleta: 0, fViga: 0, fTecho: 0, bLadrillo: 0 },
    },

    desglose: [],  // [{ concepto, tipo, cantidad, precio, total, tipoCoste, capitulo }]

    costes:   { materiales: 0, manoObra: 0, albanileria: 0, grupoPresion: 0, directo: 0 },
    margenes: { pctBenefMateriales: 0.30, pctBenefManoObra: 0 },

    emasesa: {
      subvencion: 0, bonifAcometida: 0, bonifCuotas: 0, totalAyudas: 0,
      importeAcometida: 0, cuotasFianzas: 0,
      neto: 0, porComunero: 0,
      financiacion: [],  // [{ meses, cuota }]
    },

    totales: {
      sinIva: 0, iva: 0, conIva: 0,
      conSubvencion: 0, porComunero: 0,
    },

    capitulos: {  // partidas formato EMASESA (lo que era hoja "Datos")
      fonteriaExterior: 0, albanileria: 0, grupoPresion: 0, aislamiento: 0, estudio: 0,
    },
  };
}

function calcular(entradas, fuentes = FUENTES) {
  const R = resultadoVacio();
  copiarEntradas(R, entradas);

  paso1_dimensionado(R, fuentes);       // entradas + normativa -> diámetros
  paso2_peines(R, fuentes);             // geometría + topología -> tubo, codos, chapa, viv.
  paso3_subvencion(R, fuentes);         // SOLO de entradas (entra en el margen)
  paso4_desglose(R, fuentes);           // cantidad × precio -> coste de cada línea
  paso5_agregacionYMargenes(R, fuentes);// SUMIF por tipo + márgenes + total + IVA
  paso6_emasesaNeto(R, fuentes);        // neto + por comunero + financiación

  return R;
}

// --- pasos (STUB: estructura correcta, números a afinar contra el Excel) ----

function copiarEntradas(R, e = {}) {
  Object.assign(R.entrada, e.entrada || {});
  Object.assign(R.finca,   e.finca   || {});
  Object.assign(R.meta,    e.meta    || {});
}

function paso1_dimensionado(R /*, F */) {
  // Diámetro del tubo de conexión (= acometida) por normativa. Montante/alimentación: pendiente.
  R.dimensiones.diamAcometida = diametroConexion(
    R.entrada.nsum || 0, R.entrada.tipoSuministro || "", R.entrada.longTuboConexion || 0
  ) || 0;
  R.dimensiones.diamAlimentacion = 0;
  R.dimensiones.diamMontante = 0;
}

function paso2_peines(R, F) {
  // Por cada peine de la topología: aplicar fórmula k·T(p)+p·E(p)−R y acumular.
  // codos y chapa salen de la topología (no de la fórmula). Ver mapa §3.
  const v = 0, n = 0; // TODO: de la topología
  void F; void v; void n;
  // R.peines.mlTuboTotal = ...
}

function paso3_subvencion(R, F) {
  // subvención = viviendas×base + grupoPresion + masDeUnaEntrada + proyecto
  const t = (F.TARIFAS[2026] || {});
  R.emasesa.subvencion = (R.entrada.viviendas || 0) * (t.subvencionBase || 0)
    + (R.entrada.grupoPresion.seInstala ? (t.subvencionGrupoPresion || 0) : 0);
  // TODO: +masDeUnaEntrada, +proyecto
}

function paso4_desglose(R, F) {
  // Construye las líneas del desglose por capítulo. HECHO: TUBO DE CONEXIÓN (1.1).
  // El resto (alimentación, cuarto, montantes, GP) se irá añadiendo.
  R.desglose = [];
  const precios = (F && F.PRECIOS_TABLA) || [];
  const obra    = (F && F.OBRA) || OBRA_DEFAULT;

  const con = calcConexion(R.entrada.nsum || 0, R.entrada.tipoSuministro || "",
                           R.entrada.longTuboConexion || 0, precios, obra);
  R.conexion = con;                                   // diagnóstico (diam, dias, error)
  con.lineas.forEach(l => R.desglose.push({
    concepto: l.concepto, tipo: l.variante, cantidad: l.cantidad, precio: l.precio,
    total: l.parcial, tipoCoste: l.tipoCoste, capitulo: "1.1 Tubo de conexión",
  }));
  const e = R.entrada;
  const dosBat = !!(e.bateria2 && String(e.bateria2).trim());
  R.alimentacion = calcAlimentacion(e.nsum||0, e.tipoSuministro||"", +e.longAlimentacion||0,
    e.montajeAli||"", +e.codosTermo||0, +e.llaves||0, dosBat, precios, obra);
  R.cuarto = calcCuarto(e.nsum||0, e.tipoCuarto||"", e.bateria1||"", e.bateria2||"", precios);
  R.otros  = calcOtros(+e.otrosTiempos||0, +e.otrosEur||0, precios);
  const pushCap = (calc, cap) => { if (calc && calc.lineas) calc.lineas.forEach(l => R.desglose.push({
    concepto: l.concepto, tipo: l.variante, cantidad: l.cantidad, precio: l.precio,
    total: l.parcial, tipoCoste: l.tipoCoste, capitulo: l.capitulo })); };
  pushCap(R.alimentacion); pushCap(R.cuarto); pushCap(R.otros);
}

function paso5_agregacionYMargenes(R /*, F */) {
  // SUMIF por tipoCoste
  const s = (t) => R.desglose.filter(l => l.tipoCoste === t).reduce((a, l) => a + (l.total || 0), 0);
  R.costes.materiales   = s("MAT");
  R.costes.manoObra     = s("MO");
  R.costes.albanileria  = s("ALB");
  R.costes.grupoPresion = s("GP");
  R.costes.directo = R.costes.materiales + R.costes.manoObra + R.costes.albanileria + R.costes.grupoPresion;

  // margen Plan 5 (con subvención metida) -> total + IVA. TODO: %Bº MO exacto.
  const m = R.margenes;
  const benef = (R.costes.materiales + R.costes.albanileria + R.costes.grupoPresion) * (1 + m.pctBenefMateriales)
    + R.costes.manoObra * (1 + m.pctBenefManoObra) - R.costes.directo
    + (R.emasesa.subvencion / 1.1);
  R.totales.sinIva = R.costes.directo + benef;
  R.totales.iva    = R.totales.sinIva * 0.1;
  R.totales.conIva = R.totales.sinIva + R.totales.iva;
}

function paso6_emasesaNeto(R /*, F */) {
  // Datos(partidas) + Analisis(ayudas) -> neto y por comunero + financiación.
  R.capitulos.fonteriaExterior = 0; // TODO desde desglose agrupado
  R.emasesa.totalAyudas = R.emasesa.subvencion + R.emasesa.bonifAcometida + R.emasesa.bonifCuotas;
  R.totales.conSubvencion = R.totales.conIva - R.emasesa.subvencion; // aprox; afinar con Tarifas
  R.totales.porComunero = R.entrada.viviendas
    ? R.totales.conSubvencion / R.entrada.viviendas
    : 0;
  // financiación PMT 6/12/18 meses. TODO
  R.emasesa.financiacion = [];
}

// ============================================================================
// 3) SALIDAS — pintores puros del `resultado` (STUB)
// ============================================================================

function renderPresupuesto(R) { return `<!-- TODO Presupuesto de ${R.finca.direccion} -->`; }
function renderMateriales(R)  { return `<!-- TODO Materiales (${R.desglose.length} líneas) -->`; }
function renderTareas(R)      { return `<!-- TODO Tareas de ${R.finca.direccion} -->`; }

// ============================================================================
// 4) MONTAJE en Express (STUB de rutas; Alberto añade el require en index.cjs)
// ============================================================================


// ===== ALIMENTACIÓN (filas 122-140 del oro) ==================================
function diametroAlimentacion(nsum, tipo, longAli) {
  // Normativa pág.12: tabla base <= 15 m ; entre 15 y 40 m -> +10 mm ; excede de 40 m -> +20 mm.
  const base = diamComercialBase(NORMATIVA.alimentacion, nsum, tipo);
  if (base === null) return null;
  let d = base;
  if (longAli >= 15) d += 10;   // entre 15 y 40
  if (longAli > 40)  d += 10;   // excede de 40 -> +20 total
  return redondeoComercial(d);
}
function calcAlimentacion(nsum, tipo, longAli, montaje, codosTermo, llaves, dosBaterias, precios, obra) {
  const O = (obra && obra.alimentacion) || OBRA_DEFAULT.alimentacion;
  const diam = diametroAlimentacion(nsum, tipo, longAli);
  const inch = (diam == null) ? "" : (DIAM_INCH[diam] || "");
  const term = (diam == null) ? "" : (TERMINAL_TXT[diam] || "");
  const dosN = dosBaterias ? 2 : 1;
  const fc = O.factores, r = x => Math.round(x);
  // SOLO PIECERIA = tubo < 2,5 m (o montaje "SOLO PIECERIA"): no hay tramo real de tubo.
  const esPieceria = (montaje === "SOLO PIECERIA") || (longAli < 2.5);
  const piezaFont = (O.piezaFont != null) ? O.piezaFont : 0.5;
  const dF = esPieceria ? piezaFont : diasAli(O.tiempoFont, longAli);
  const dE = (!esPieceria && montaje === "ENTERRADO") ? diasAli(O.tiempoEnt, longAli) : 0;
  const dV = (!esPieceria && (montaje === "F.VIGA" || montaje === "F.TECHO")) ? diasAli(O.tiempoViga, longAli) : 0;
  const A = "1.2.6 Accesorios y pequeño material";
  const T25 = "2.5 Techos falsos escayola y formación vigas falsas", REG = "2.4 Regolas y taladros", MO = "1.6.1 Mano de obra";
  const L = [];
  const add = (c, v, cant, tc, cap) => L.push({ concepto: c, variante: v, cantidad: cant, precio: precioDe(precios, c, v), tipoCoste: tc, capitulo: cap });
  add("Tubo alimentación (PE)", diam, longAli, "MAT", "1.2.1 Tubo de alimentación");
  add("Llave corte general", inch, llaves, "MAT", "1.2.2 Llaves de paso");
  add("Válvula de retención", inch, dosN, "MAT", "1.2.3 Válvula de retención");
  add("Filtro", inch, dosN, "MAT", "1.2.4 Filtro");
  add("Te", inch, dosN, "MAT", "1.2.5 Te");
  add("Codo", inch, dosN, "MAT", A);
  add("Machón", inch, 6, "MAT", A);
  add("Tapón", inch, 1, "MAT", A);
  add("Terminal fitting", term, dosN, "MAT", A);
  add("Codo termofusión", diam, (longAli ? codosTermo : 0), "MAT", A);
  add("Tuerca reducción 3' a ®", inch, (diam === 90 ? 0 : 1), "MAT", A);   // 3'(90mm) ya es 3' -> no reduce
  add("Tubo alimentación (f.viga + pintado)", "ml", (montaje === "F.VIGA" ? +(fc.fviga * longAli).toFixed(2) : 0), "ALB", T25);
  add("Tubo alimentación (f.techo + agujero + tapado + pintado 50x50cm)", "ud", (montaje === "F.TECHO" ? Math.ceil(longAli / fc.ftechoDiv) : 0), "ALB", T25);
  add("Saco mortero", "ud", (montaje === "ENTERRADO" ? r(fc.saco_mortero * longAli) : 0), "ALB", REG);
  add("Saco arena", "ud", (montaje === "ENTERRADO" ? r(fc.saco_arena * longAli) : 0), "ALB", REG);
  add("Losa", "ud", (montaje === "ENTERRADO" ? r(fc.losa * longAli) : 0), "ALB", REG);
  add("Fontanero (tubo alimentación)", "cuadrilla x2", (dF == null ? 0 : dF), "MO", MO);
  add("Albañil (tubo alimentación enterrado)", "cuadrilla x2", (dE == null ? 0 : dE), "MO", T25);
  add("Albañil (tubo alimentación f.viga / f.techo)", "cuadrilla x2", (dV == null ? 0 : dV), "MO", T25);
  let total = 0; for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  const avisos = [];
  for (const l of L) {
    if (l.tipoCoste === "MAT" && (l.cantidad || 0) > 0 && (l.precio || 0) === 0) {
      avisos.push("Sin precio: " + l.concepto + " (" + l.variante + ") -> revisar en PRECIOS");
    }
  }
  return { diam, lineas: L, total: +total.toFixed(2), avisos };
}

// ===== CUARTO DE CONTADORES (filas 142-156 del oro) ==========================
function capCuarto(b39) {
  if (b39 === "EXISTENTE") return "2.1 Adaptación de cuarto de bateria existente";
  if (b39 === "ALUMINIO") return "2.1 Armario batería de aluminio, con puertas de aluminio";
  if (b39 === "OBRA - P.ALUMINIO") return "2.1 Armario batería de obra (puertas aluminio)";
  return "2.1 Armario batería de obra (puertas hierro)";
}
function calcCuarto(nsum, b39, bat1, bat2, precios) {
  const esObra = /OBRA/i.test(b39 || "");
  const capB = capCuarto(b39 || "");
  const MO = "1.6.1 Mano de obra";
  const L = [];
  const add = (c, v, cant, tc, cap) => L.push({ concepto: c, variante: v, cantidad: cant, precio: precioDe(precios, c, v), tipoCoste: tc, capitulo: cap });
  add("Batería de contadores (PPR)", bat1 || "", (bat1 ? 1 : 0), "MAT", "1.3.1.1 Batería de contadores");
  add("Batería de contadores (PPR)", bat2 || "", (bat2 ? 1 : 0), "MAT", "1.3.1.2 Batería de contadores");
  add("Llaves escuadra (entrada y salida)", "1'", nsum, "MAT", "1.3.2 Juego de llaves de escuadra (entrada y salida)");
  add("Flexo", "3/4'", nsum, "MAT", "1.3.3 Flexo");
  add("Accesorios, pequeño material y comprobación", "---", 1, "MAT", "1.3.4 Accesorios y pequeño material");
  add("Pintura", "ud", 1, "ALB", capB);
  add("Punto de luz", "ud", 1, "ALB", "2.2. Punto de luz");
  add("Desagüe", "ud", 1, "ALB", "2.3 Sumidero de agua");
  add("Cerradura", "ud", 1, "ALB", "1.5.1 Cerradura homologada armario-batería");
  add("Armario aluminio con cerradura", "aluminio", (b39 === "ALUMINIO" ? 1 : 0), "ALB", capB);
  add("Albañilería (tabique + enfoscado)", "ud", (esObra ? 1 : 0), "ALB", capB);
  add("Puerta", (b39 || ""), (esObra ? 1 : 0), "ALB", capB);
  const baterias = (bat1 ? 1 : 0) + (bat2 ? 1 : 0);
  add("Fontanero (montaje batería contadores)", "cuadrilla x2", (baterias ? 1 : 0), "MO", MO);
  add("Fontanero (desmontaje contador + conexión)", "cuadrilla x2", 0.25, "MO", "1.2.7 Desmontaje contador general y conexión ");
  add("Albañil (ejecución cuarto contadores " + (b39 || "") + ")", "cuadrilla x2", (esObra ? 1 : 0), "MO", capB);
  let total = 0; for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  return { lineas: L, total: +total.toFixed(2) };
}

// ===== OTROS TIEMPOS / TRABAJOS (filas 216-217 del oro) =======================
function calcOtros(otrosTiempos, otrosEur, precios) {
  const L = [];
  const add = (c, v, cant, pr, tc, cap) => L.push({ concepto: c, variante: v, cantidad: cant, precio: pr, tipoCoste: tc, capitulo: cap });
  add("Fontanero", "cuadrilla x2", (+otrosTiempos || 0), precioDe(precios, "Fontanero", "cuadrilla x2"), "MO", "1.6.1 Mano de obra");
  add("Otros trabajos extra", "ud", 1, (+otrosEur || 0), "ALB", "2.6 Otros trabajos extra");
  let total = 0; for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  return { lineas: L, total: +total.toFixed(2) };
}

module.exports = function (app) {
  // Cliente de Sheets y SHEET_ID se reutilizan de presupuestos.cjs (app.locals.presupuestos).
  const P    = () => (app.locals && app.locals.presupuestos) || {};
  const sh   = () => P().getSheetsClient();
  const sid  = () => P().SHEET_ID;

  async function leerFila(direccion) {
    const r = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: RANGO_PLAN5 });
    const rows = r.data.values || [];
    const key = normDir(direccion);
    for (let i = 1; i < rows.length; i++) {
      if (normDir((rows[i] || [])[0]) === key) return { idx: i + 1, row: rows[i] };
    }
    return null;
  }

  // Pantalla "Toma de datos" (fase 03). ?dir=<dirección> precarga lo guardado.
  app.get(["/plan5", "/plan5/toma-datos"], async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no válido");
    let saved = "null";
    let exp = "null";
    try {
      const dir = req.query.dir || "";
      if (dir) { const f = await leerFila(dir); if (f && f.row[6]) saved = f.row[6]; }
    } catch (e) { /* sin Sheet/pestaña aún: pantalla en blanco */ }
    try {
      const id = req.query.id || "";
      if (id && P().buscarComunidadPorId) {
        const c = await P().buscarComunidadPorId(id);
        if (c) {
          exp = JSON.stringify({
            direccion: ((c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || "")).trim(),
            tipo_via: c.tipo_via || "",
            direccion_calle: c.direccion || "",
            poblacion: c.poblacion || "",
            cp: c.cp || "",
            presidente: c.presidente || "",
            tel_presidente: c.telefono_presidente || "",
            email_presidente: c.email_presidente || "",
            administrador: c.administrador || "",
            tel_administrador: c.telefono_administrador || "",
            email_administrador: c.email_administrador || "",
          });
        }
      }
    } catch (e) { /* sin datos de expediente: se rellena a mano */ }
    const inj = "window.__PLAN5_SAVED__=" + saved + ";window.__PLAN5_DIR__=" + JSON.stringify(req.query.dir || "") + ";window.__PLAN5_VOLVER_ID__=" + JSON.stringify(req.query.id || "") + ";window.__PLAN5_TOKEN__=" + JSON.stringify(req.query.token || "") + ";window.__PLAN5_EXP__=" + exp + ";";
    let theme = "";
    try { theme = getThemeCss() || ""; } catch (e) { theme = ""; }
    let p5 = ""; try { p5 = getPlan5Css() || ""; } catch (e) { p5 = ""; }
    const html = TOMA_DATOS_HTML
      .replace("<!--__PLAN5_THEME__-->", (theme ? "<style>" + theme + "</style>" : "") + (p5 ? "<style>" + p5 + "</style>" : ""))
      .replace("/*__PLAN5_SAVED__*/", inj)
      .replace("/*__PLAN5_MENU__*/", function () { return PLAN5_MENU_JS; });
    res.type("html").send(html);
  });

  // Guardar (upsert por dirección).
  app.post("/plan5/guardar", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      const b = req.body || {};
      const fila = [
        normDir(b.direccion || ""),
        b.ccpp_id || "",
        b.npresupuesto || "",
        b.fecha || "",
        b.revision || "",
        new Date().toISOString(),
        b.payload || "{}",
      ];
      const ex = await leerFila(b.direccion || "");
      if (ex) {
        await sh().spreadsheets.values.update({
          spreadsheetId: sid(), range: `plan5_toma_datos!A${ex.idx}:G${ex.idx}`,
          valueInputOption: "RAW", requestBody: { values: [fila] },
        });
      } else {
        await sh().spreadsheets.values.append({
          spreadsheetId: sid(), range: RANGO_PLAN5,
          valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [fila] },
        });
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] guardar error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // ---- TABLA DE PRECIOS (fuente editable del motor) ----
  function numEs(s){ // "1.234,52" / "4,52" / 4.52 -> Number
    if (s == null) return null;
    if (typeof s === "number") return s;
    var t = String(s).trim(); if (!t) return null;
    t = t.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(t); return isNaN(n) ? null : n;
  }
  function precioEs(v){ // Number -> "4,52"
    if (v == null || v === "") return "";
    var n = (typeof v === "number") ? v : parseFloat(String(v).replace(/\./g,"").replace(",","."));
    return isNaN(n) ? String(v) : n.toFixed(2).replace(".", ",");
  }
  async function leerPrecios(){
    var r = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: RANGO_PRECIOS });
    var rows = r.data.values || [];
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i] || [];
      var concepto = (row[1] || "").toString().trim();
      if (!concepto || concepto.toLowerCase() === "concepto") continue;
      out.push({ r: i + 1, ud: (row[0]||"").toString(), concepto: concepto, tipo: (row[2]==null?"":row[2]).toString(), precio: precioEs(row[3]) });
    }
    return out;
  }

  // Lee `plan5_mediciones` y devuelve { obra, meta, order } via parseMediciones.
  async function leerMediciones(){
    try {
      var r = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: RANGO_MEDICIONES });
      return parseMediciones(r.data.values || []);
    } catch (e) {
      console.error("[plan5] leerMediciones error:", e.message);
      return { obra: OBRA_DEFAULT, meta: {}, order: [], rowOf: {} };   // fallback: parámetros template
    }
  }

  app.get("/plan5/precios", async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no valido");
    var datos = [];
    try { datos = await leerPrecios(); } catch (e) { datos = []; }
    var token = req.query.token || "";
    var qs = [];
    if (req.query.dir) qs.push("dir=" + encodeURIComponent(req.query.dir));
    if (req.query.id)  qs.push("id=" + encodeURIComponent(req.query.id));
    if (token) qs.push("token=" + encodeURIComponent(token));
    var volver = "/plan5" + (qs.length ? "?" + qs.join("&") : "");
    var inj = "window.__PRECIOS__=" + JSON.stringify(datos) + ";window.__PLAN5_VOLVER__=" + JSON.stringify(volver) + ";window.__PLAN5_TOKEN__=" + JSON.stringify(token) + ";window.__PLAN5_DIR__=" + JSON.stringify(req.query.dir || "") + ";window.__PLAN5_VOLVER_ID__=" + JSON.stringify(req.query.id || "") + ";";
    var theme = "";
    try { theme = getThemeCss() || ""; } catch (e) { theme = ""; }
    var p5 = ""; try { p5 = getPlan5Css() || ""; } catch (e) { p5 = ""; }
    var html = PRECIOS_HTML
      .replace("<!--__PLAN5_THEME__-->", (theme ? "<style>" + theme + "</style>" : "") + (p5 ? "<style>" + p5 + "</style>" : ""))
      .replace("/*__PRECIOS_DATA__*/", inj)
      .replace("/*__PLAN5_MENU__*/", function () { return PLAN5_MENU_JS; });
    res.type("html").send(html);
  });

  app.get("/plan5/desglose", async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no valido");
    var token = req.query.token || "";
    // Carga lo guardado en Toma de datos (?dir=) + la tabla de precios, y calcula el desglose.
    var dsg = null;
    try {
      var dir = req.query.dir || "";
      var saved = null;
      if (dir) { var f = await leerFila(dir); if (f && f.row[6]) { try { saved = JSON.parse(f.row[6]); } catch (e) { saved = null; } } }
      var m = (saved && saved.motor) || null;        // { nsum, tipo, longCon } que guarda Toma de datos
      if (m && m.nsum && m.tipo && (m.longCon != null && m.longCon !== "")) {
        var precios = [];
        try { precios = await leerPrecios(); } catch (e) { precios = []; }
        var med = await leerMediciones();              // { obra, meta, order, rowOf } del Sheet
        var R = calcular({ entrada: { nsum: +m.nsum || 0, tipoSuministro: m.tipo, longTuboConexion: +m.longCon || 0,
                           longAlimentacion: +m.longAli || 0, montajeAli: m.montaje || "", codosTermo: +m.codos || 0,
                           llaves: +m.llaves || 0, bateria1: m.bat1 || "", bateria2: m.bat2 || "", tipoCuarto: m.tipoCuarto || "",
                           otrosTiempos: +m.otrosTiempos || 0, otrosEur: +m.otrosEur || 0 } },
                         Object.assign({}, FUENTES, { PRECIOS_TABLA: precios, OBRA: med.obra }));
        var lineas = [{ tipo_fila: "capitulo", concepto: "1.1  TUBO DE CONEXION" }];
        var sinVar = function (v) { return v === "ud" || v === "día/cuadrilla" || v == null || v === ""; };
        var FK = { "Saco mortero": "saco_mortero", "Saco arena": "saco_arena", "Losa": "losa" };
        // Cuadrilla: localizar el tramo de días que aplica para esta longitud (el editable)
        var lc = +m.longCon || 0, tramos = (med.obra.conexion && med.obra.conexion.tiempo) || [], fidx = -1;
        for (var ti = 0; ti < tramos.length; ti++) { if (lc <= tramos[ti].hasta) { fidx = ti; break; } }
        var esCuadrilla = function (c) { return c === "Fontanero (tubo conexión)" || c === "Albañil (tubo conexión)"; };
        // Dato de cuadrilla = TODOS los tramos en una linea (0 -> [dia] -> tope -> [dia] -> tope...), el aplicado marcado en azul.
        var datoCuadrilla = (tramos && tramos.length) ? { tipo: "tramos", unidad: "día/cuadrilla", tramos: tramos.map(function (tr, ti) {
          return { lo: (ti === 0 ? 0 : tramos[ti - 1].hasta), hi: tr.hasta, dias: tr.dias,
                   row: med.rowOf["TUBO DE CONEXION|Fontanero (tubo conexión)|Tramo " + (ti + 1) + " · días"] || null,
                   aplica: (ti === fidx) }; }) } : null;
        // Muestra los diámetros (detalle numérico puro) con "mm"; el resto (textos, ud, día) tal cual.
        var detalleMostrar = function (v) { var s = (v == null ? "" : String(v)).trim(); return /^\d+([.,]\d+)?$/.test(s) ? (s + "mm") : s; };
        R.conexion.lineas.forEach(function (l) {
          var mm = med.meta["TUBO DE CONEXION|" + l.concepto] || {};
          var dato = null;
          if (FK[l.concepto]) {
            var rw = med.rowOf["TUBO DE CONEXION|" + l.concepto + "|Unidades por metro"];
            if (rw) dato = { tipo: "factor", row: rw, valor: med.obra.conexion.factores[FK[l.concepto]], unidad: "ud/m" };
          } else if (esCuadrilla(l.concepto)) {
            dato = datoCuadrilla;
          }
          lineas.push({ ud: udDe(precios, l.concepto, l.variante), concepto: l.concepto, variante: detalleMostrar(l.variante),
                        cantidad: l.cantidad, precio: l.precio, parcial: l.parcial,
                        tipo: (mm.tipo_coste || l.tipoCoste || ""), capitulo_presupuesto: (mm.capitulo_presupuesto || l.capitulo || ""), dato: dato });
        });
        lineas.push({ tipo_fila: "total", concepto: "TOTAL 1.1 TUBO DE CONEXION", parcial: (R.conexion ? R.conexion.total : 0) });
        // Capítulos nuevos (alimentación, cuarto, otros). De momento sin edición inline (dato:null); se ajusta después.
        var pintarCap = function (titulo, calc) {
          if (!calc || !calc.lineas || !calc.lineas.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          calc.lineas.forEach(function (l) {
            lineas.push({ ud: udDe(precios, l.concepto, l.variante), concepto: l.concepto, variante: detalleMostrar(l.variante),
                          cantidad: l.cantidad, precio: l.precio, parcial: l.parcial,
                          tipo: l.tipoCoste || "", capitulo_presupuesto: l.capitulo || "", dato: null });
          });
          lineas.push({ tipo_fila: "total", concepto: "TOTAL " + titulo, parcial: calc.total });
        };
        // Igual que pintarCap pero con el "Dato" editable (factores + tramos de dias), reutilizando la celda de conexion.
        var pintarCapAli = function (titulo, calc) {
          if (!calc || !calc.lineas || !calc.lineas.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          var oa = med.obra.alimentacion || {}, fac = oa.factores || {}, la = +m.longAli || 0;
          var FKA = { "Saco mortero": "saco_mortero", "Saco arena": "saco_arena", "Losa": "losa" };
          var FVIGA = "Tubo alimentación (f.viga + pintado)";
          var FTECHO = "Tubo alimentación (f.techo + agujero + tapado + pintado 50x50cm)";
          var DIA = { "Fontanero (tubo alimentación)": oa.tiempoFont,
                      "Albañil (tubo alimentación enterrado)": oa.tiempoEnt,
                      "Albañil (tubo alimentación f.viga / f.techo)": oa.tiempoViga };
          var aplicaIdx = function (esc) { for (var i = 0; i < esc.length; i++) { if (la <= esc[i].hasta) return i; } return -1; };
          calc.lineas.forEach(function (l) {
            var dato = null, rw;
            if (FKA[l.concepto]) {
              rw = med.rowOf["TUBO DE ALIMENTACION|" + l.concepto + "|Unidades por metro"];
              if (rw) dato = { tipo: "factor", row: rw, valor: fac[FKA[l.concepto]], unidad: "ud/m" };
            } else if (l.concepto === FVIGA) {
              rw = med.rowOf["TUBO DE ALIMENTACION|" + FVIGA + "|Unidades por metro"];
              if (rw) dato = { tipo: "factor", row: rw, valor: fac.fviga, unidad: "ud/m" };
            } else if (l.concepto === FTECHO) {
              rw = med.rowOf["TUBO DE ALIMENTACION|" + FTECHO + "|Metros por agujero"];
              if (rw) dato = { tipo: "factor", row: rw, valor: fac.ftechoDiv, unidad: "m" };
            } else if (DIA[l.concepto]) {
              var esc = DIA[l.concepto] || [], fi = (la < 2.5) ? -1 : aplicaIdx(esc);
              dato = { tipo: "tramos", unidad: "día/cuadrilla", tramos: esc.map(function (tr, ti) {
                return { lo: (ti === 0 ? 2.5 : esc[ti - 1].hasta), hi: tr.hasta, dias: tr.dias,
                         row: med.rowOf["TUBO DE ALIMENTACION|" + l.concepto + "|Tramo " + (ti + 1) + " · días"] || null,
                         aplica: (ti === fi) }; }) };
            }
            lineas.push({ ud: udDe(precios, l.concepto, l.variante), concepto: l.concepto, variante: detalleMostrar(l.variante),
                          cantidad: l.cantidad, precio: l.precio, parcial: l.parcial,
                          tipo: l.tipoCoste || "", capitulo_presupuesto: l.capitulo || "", dato: dato });
          });
          lineas.push({ tipo_fila: "total", concepto: "TOTAL " + titulo, parcial: calc.total });
        };
        var pintarBloqueSheet = function (titulo, block) {
          var ls = (med.lineas || []).filter(function (x) { return x.capitulo === block; });
          if (!ls.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          ls.forEach(function (x) {
            lineas.push({ ud: "", concepto: x.concepto, variante: "", cantidad: "", precio: "", parcial: "",
                          tipo: x.tipo_coste || "", capitulo_presupuesto: x.capitulo_presupuesto || "", dato: null });
          });
          lineas.push({ tipo_fila: "total", concepto: "TOTAL " + titulo, parcial: 0 });
        };
        pintarCapAli("1.2  TUBO DE ALIMENTACION", R.alimentacion);
        pintarCap("1.3  CUARTO DE CONTADORES", R.cuarto);
        pintarBloqueSheet("1.4  MONTANTES  (pendiente)", "MONTANTES");
        pintarBloqueSheet("3  GRUPO DE PRESION  (pendiente)", "GRUPO DE PRESION");
        pintarCap("OTROS TIEMPOS / TRABAJOS", R.otros);
        dsg = { lineas: lineas, diam: R.conexion ? R.conexion.diam : null, error: R.conexion ? R.conexion.error : false, longCon: (+m.longCon || 0), avisos: [].concat((R.conexion && R.conexion.avisos) || [], (R.alimentacion && R.alimentacion.avisos) || []) };
      }
    } catch (e) { console.error("[plan5] desglose error:", e.message); dsg = null; }
    if (String(req.query.format || "") === "json") return res.json({ dsg: dsg });
    var inj = "window.__DESGLOSE__=" + JSON.stringify(dsg) + ";window.__PLAN5_TOKEN__=" + JSON.stringify(token) + ";window.__PLAN5_DIR__=" + JSON.stringify(req.query.dir || "") + ";window.__PLAN5_VOLVER_ID__=" + JSON.stringify(req.query.id || "") + ";";
    var theme = ""; try { theme = getThemeCss() || ""; } catch (e) { theme = ""; }
    var p5 = ""; try { p5 = getPlan5Css() || ""; } catch (e) { p5 = ""; }
    var html = DESGLOSE_HTML
      .replace("<!--__PLAN5_THEME__-->", (theme ? "<style>" + theme + "</style>" : "") + (p5 ? "<style>" + p5 + "</style>" : ""))
      .replace("/*__DESGLOSE_DATA__*/", inj)
      .replace("/*__PLAN5_MENU__*/", function () { return PLAN5_MENU_JS; });
    res.type("html").send(html);
  });

  // Guarda el valor (columna F) de un parámetro de `plan5_mediciones` por su fila.
  app.post("/plan5/mediciones/guardar", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var row = parseInt(b.row, 10);
      if (!row || row < 2) return res.status(400).json({ ok: false, error: "fila" });
      var n = numEs(b.valor);
      var valor = (n == null ? "" : n);
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_mediciones!F" + row,
        valueInputOption: "RAW", requestBody: { values: [[ valor ]] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] mediciones guardar error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/precios/guardar", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var row = parseInt(b.row, 10);
      if (!row || row < 2) return res.status(400).json({ ok: false, error: "fila" });
      var col = String(b.col || "precio");
      var map = { ud: "A", concepto: "B", tipo: "C", precio: "D" };
      var letra = map[col];
      if (!letra) return res.status(400).json({ ok: false, error: "col" });
      var valor;
      if (col === "precio") { var n = numEs(b.valor); valor = (n == null ? "" : n); }
      else { valor = (b.valor == null ? "" : String(b.valor)); }
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_precios!" + letra + row,
        valueInputOption: "RAW", requestBody: { values: [[ valor ]] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] precios guardar error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Anadir una linea de precio nueva: reserva la siguiente fila libre del Sheet.
  app.post("/plan5/precios/nueva", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var g = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: RANGO_PRECIOS });
      var rows = g.data.values || [];
      var newRow = rows.length + 1; // siguiente fila libre (rows incluye la cabecera)
      if (newRow < 2) newRow = 2;
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_precios!A" + newRow + ":D" + newRow,
        valueInputOption: "RAW", requestBody: { values: [[ "", "(nuevo)", "", "" ]] },
      });
      res.json({ ok: true, row: newRow, concepto: "(nuevo)" });
    } catch (e) {
      console.error("[plan5] precios nueva error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });


  // Borrar una linea de precio: elimina la fila del Sheet (las de abajo suben).
  async function sheetIdDe(title){
    var meta = await sh().spreadsheets.get({ spreadsheetId: sid() });
    var sheets = (meta.data && meta.data.sheets) || [];
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].properties && sheets[i].properties.title === title) return sheets[i].properties.sheetId;
    }
    return null;
  }
  app.post("/plan5/precios/borrar", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var row = parseInt((req.body || {}).row, 10);
      if (!row || row < 2) return res.status(400).json({ ok: false, error: "fila" });
      var gid = await sheetIdDe("plan5_precios");
      if (gid == null) return res.status(500).json({ ok: false, error: "pestaña no encontrada" });
      await sh().spreadsheets.batchUpdate({
        spreadsheetId: sid(),
        requestBody: { requests: [ { deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: row - 1, endIndex: row } } } ] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] precios borrar error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/calcular", function (req, res) {
    const entradas = req.body || {};
    const resultado = calcular(entradas);
    res.json(resultado);
  });

  app.post("/plan5/presupuesto", function (req, res) {
    res.send(renderPresupuesto(calcular(req.body || {})));
  });
};

// Exponer el núcleo para tests/arnés aislado (validación contra el Excel).
module.exports.calcular = calcular;
module.exports.resultadoVacio = resultadoVacio;
module.exports._fuentes = FUENTES;
module.exports.calcConexion = calcConexion;
module.exports.calcAlimentacion = calcAlimentacion;
module.exports.calcCuarto = calcCuarto;
module.exports.calcOtros = calcOtros;
module.exports.diametroAlimentacion = diametroAlimentacion;
module.exports.diametroConexion = diametroConexion;
module.exports.parseMediciones = parseMediciones;
