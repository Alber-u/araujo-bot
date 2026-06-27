// ============================================================================
// MÓDULO PRESUPUESTOS PLAN 5 — Araujo CCPP
// Build: 2026-06-15 v0.36 (FASE 2 — OVERRIDE MANUAL POR OBRA + V-EXT por peine. Cada partida de MEDICIONES
// lleva una "ovkey" (concepto||detalle) y su CANTIDAD es editable: si se teclea un valor, se guarda SOLO
// en esa obra (en saved.overrides dentro de su datos_json, ruta nueva POST /plan5/mediciones/override),
// la fila se marca en ÁMBAR y se recalcula su parcial y el total del capítulo; borrar el valor -> vuelve
// al automático. Las líneas "Fontanero (PEINE V-EXT -i)" pasan a ser DINÁMICAS: una por peine existente
// (i = PEINE i de toma de datos), editable individualmente (caso prioritario del override). Validado:
// node --check + Santa Clara con override del V-EXT del peine 2 a 0 -> montantes 4.075,42 -> 3.183,42, que
// es EXACTAMENTE el total del Excel real (el ajuste que Araujo teclea a mano). El guardado global de la
// plantilla (plan5_mediciones, factores/Dato) NO se toca; el override es una capa aparte por obra.
// Build: 2026-06-15 v0.35 (FASE 1 (parte) — FÓRMULA GENERAL DE PEINES, CASCADA, varios + documentación.
// (1) La geometría de peines pasa de tablas por tipo a un MODELO FÍSICO general (parsePeine/alturasPeine/
// geomPeine): cada vivienda = un montante de cero hasta ENCIMA de su planta (la tubería entra por arriba),
// el prefijo 1-/2- quita montantes CORTOS (faltan viviendas en baja), el sufijo -1/-2 quita los LARGOS
// (faltan arriba) y +1/+2 añade áticos (n+2). Calcula CUALQUIERA de las 23 combinaciones válidas (no solo
// las 19 del Excel) y CORRIGE DOBLE-1 y DOBLE-2, que en el Excel estaban mal (quitaban por abajo en vez de
// por arriba): p.ej. baja+4 DOBLE-1 = 75 m (no 33). KNOWN_PEINE pasa a 23 tipos {8 SIMPLE sin +2 · 15 DOBLE}.
// Regresión: idéntico a v0.34 en los otros 17 tipos -> Sánchez Pizjuán 17/17 y Santa Clara 4.075,42 intactos.
// (3) Las 3 casillas del tipo de peine van EN CASCADA: el prefijo y el sufijo que se ofrecen dependen de la
// base (SIMPLE -> sin +2 ni 2-; DOBLE -> todos), y al cambiar la base se resetea lo que quede imposible.
// Ya no se puede montar un tipo inexistente (el fallo de Arcángel). (7) Quitado el factor de "PEINE H
// (f.viga + pintado)" (siempre valía 1). (8) Punto de miles forzado también en números de 4 cifras
// (1.234,56). (10) Etiqueta GP: "Tiempo montaje nuevo GP". (2) AVISO en toma de datos: si la suma de
// viviendas de los peines + locales + comunidad no cuadra con el Nº de suministros, la casilla se pone en
// ROJO y sale un letrero amarillo (igual que el Excel). (6) Cada factor de la columna Dato lleva su FRASE
// explicativa ("1 sujección cada [x] m", "un agujero cada [x] m", "[x] días por vivienda"...); pendiente
// que Guille afine los textos y decida si los % se muestran como 10 en vez de 0,1 (la merma muestra crudo).
// PENDIENTE Fase 1 (resto): reorden visual material+MO, y líneas V-EXT por peine. Fase 2: override manual
// por obra (la V-EXT por peine va con esto). FUERA de fases: pasante Ø40, % beneficio MO, validar TIPO D/E.)
//
// === LÓGICA FÍSICA DE LOS PEINES (explicada por Guille, jun-2026; conservada para no perderla) ===
// PEINE = montantes que reparten el agua a las viviendas. Tiene parte VERTICAL y parte HORIZONTAL.
//  · VERTICAL: un montante por vivienda, del cuarto de contadores hasta ENCIMA de su vivienda (entra por
//    arriba). Vivienda de planta p (0=baja) mide (p+1) alturas. DOBLE = 2 montantes por planta. Prefijo
//    1-/2- = viviendas que faltan en baja (montantes cortos). Sufijo -1/-2 = últimas viviendas que faltan
//    arriba (montantes largos). +1/+2 = áticos. (ver geomPeine, más abajo.)
//  · HORIZONTAL: de la batería a la base del vertical; TODAS las tuberías miden lo mismo. m peine (H) =
//    suma de los tramos (una vez); m tubo (H) = m peine (H) x nº viviendas (una tubería por vivienda).
//    Cada tramo tiene una protección (canaleta/f.viga/f.techo/b.ladrillo/b.forjado) que decide su partida.
// QUÉ MIDE CADA COSA EN MEDICIONES:
//  · m tubo (H+V) -> Tubo distribución Ø25/Ø32 (+10%); de ahí sujección (1 cada X m), guía y tornillo.
//    En edificios >4 plantas TIPO D/E se reparte: Ø25 = parte de abajo (variante "4+1"), Ø32 = resto (resta).
//  · codos = por tubería: (nº tramos-1) cambios de dirección + giros extra + 2 fijos (batería y subida),
//    todo x nº viviendas. Codo 3/4' = 2 x nº suministros. Llave de paso = nº suministros.
//  · m peine por protección -> partidas b.forjado/f.viga/f.techo(agujeros = m/X)/b.ladrillo (m, una vez).
//  · CANALETA: aislamiento = m de TUBO en canaleta (H+V, x viviendas). Chapa (omega de aluminio): frontal
//    = nº tubos x 5cm -> (m tubo canaleta) x 0,05 ; resto de la omega (2 lados U + 2 pestañas = 20cm fijos)
//    -> (m peine canaleta) x 0,2 ; +alimentación si va en canaleta ; /2 m por chapa ; redondeo arriba.
//  · viviendas (V) -> días V-INT (x0,5625/viv), enganches, y CONTROL (Σ peines debe = viviendas reales).
//  · enganches: 1 por vivienda, agrupados por dificultad (EXT/INT-FACIL kit de 3 piezas; INT-MEDIO/DIFICIL
//    kit de 6); mano de obra = nº x días/vivienda (crece con la dificultad).
// Build: 2026-06-15 v0.34 (FIX mPeineS + validación contra obra real Santa Clara 35. La ML PEINE (m de peine vertical) se calculaba (n+1+p)·h, pero la hoja PEINES del Excel demuestra que el sufijo -1/-2 SÍ reduce la altura del peine y que en los DOBLE el +2 no sube 2 sino 1: fórmula correcta (n+1+ceil((p-neg)/k))·h con k=1 simple/2 doble. En Sánchez Pizjuán no se vio porque todos eran 1-SIMPLE. Afecta a canaletaPeine -> chapa. Verificado: ML TUBO, ML PEINE, Nº VIVIENDAS y variante 4+1 de los 19 tipos clavan contra la tabla de referencia del Excel (n=2). Comparada la obra Santa Clara 35 entera: cuarto y GP clavados; conexión, alimentación y montantes clavados salvo (a) dos tiempos que el cliente metió A MANO en el Excel -alimentación >15m y un peine V-EXT de 3m- que el programa calcula en automático (pendiente: override manual por obra), y (b) 0,5€ del pasante por el umbral Ø40 del Excel. node --check OK + Sánchez Pizjuán sigue 17/17.)
// Build: 2026-06-15 v0.33 (PASO 3 — PARÁMETROS DEL MONTANTE EDITABLES (Sheet + celdas Dato). parseMediciones arma obra.montantes leyendo las filas de parámetro de MONTANTES de plan5_mediciones (merma, espaciado de sujección, factores f.viga/f.techo, días de albañil/V-INT/chapa/enganches por dificultad y la tabla de cortes V-EXT), con fallback a los valores del oro (no rompe si las filas aún no están). calcMontantes usa esos parámetros; paso2_peines recibe F y lee la tabla de cortes V-EXT del Sheet. MEDICIONES: pintarCapMont pinta el capítulo con la celda "Dato" EDITABLE inline en cada partida con parámetro (mismo mecanismo que alimentación/cuarto: se guarda en el Sheet, recalcula y marca verde/rojo). Chapa (3 factores) y tabla V-EXT quedan editables en el Sheet (sin celda inline). Validado: node --check + Sánchez Pizjuán 17/17 con defaults + edición de parámetro cambia el resultado (merma 0,1->0,2 sube el tubo) + cortes V-EXT editables + conexión 1.293 €. ACCIONES SHEET: pegar en plan5_mediciones las ~21 filas de parámetro de MONTANTES (TSV aparte).)
// Build: 2026-06-15 v0.32 (PASO 2b — TIPO DE PEINE EN 3 CASILLAS. En Toma de datos el "Tipo de peine" se parte en 3 desplegables: prefijo (1-/2-), base (SIMPLE/DOBLE) y sufijo (+1/+2/-1/-2); al cambiar cualquiera se recompone pe.tipo (= prefijo+base+sufijo) y serializar/motor lo siguen usando sin cambios. splitTipo() reparte el tipo guardado en las 3 casillas al cargar. El motor añade un guard: si el tipo recompuesto no es uno de los 19 conocidos, lo salta con aviso (no calcula geometría falsa). Validado: node --check + recompone los 19 tipos + Sánchez Pizjuán intacto (17/17) + conexión 1.293 €. PENDIENTE: Paso 2a (Dato editable de montantes) va con el Paso 3.)
// Build: 2026-06-15 v0.31 (PASO 1 — MOTOR DE MONTANTES/PEINES. paso2_peines REAL: recorre los peines y acumula 9 agregados (tubo total + 4+1, codos + 4+1, viviendas, peine por protección, tubo/peine en canaleta -incluye el vertical V-EXT-, enganches por dificultad, días V-EXT por peine con tope 126 m -aviso si excede-). Helpers server-side ppS/pTuboS/mPeineS/vivS (vivS resta prefijo 1-/2- y sufijo -1/-2, que pViv no hacía). calcMontantes: de los agregados saca las 51 partidas (reparto Ø25/Ø32 por plantas+tipo D/E, merma 0,1, sujección/guía/tornillo, llave=nsum, peine H por protección, aislamiento y chapa de canaleta, días V-EXT, enganches con su material y días). Parámetros con valores por defecto (los del Excel); las filas editables van al Sheet en el Paso 3. Enganchado en paso4 (orden 1.2/1.3/1.4 montantes/3 GP/otros) y pintado en MEDICIONES (pintarCap, Dato no editable de momento). Ruta: entrada recibe peines/plantas/altura/peinesHDias; serializar los guarda + id al campo Peines(H). Validado: node --check + calcMontantes con los agregados reales de Sánchez Pizjuán (1.024,65 tubo / 108 codos / 684 aislamiento / 30 chapa / 36 enganches / V-EXT con aviso >126 m) + paso2_peines con peine sintético + conexión 1.293 €. PENDIENTE: Paso 2 (3 celdas del tipo de peine + Dato editable en montantes) y Paso 3 (parámetros del montante a plan5_mediciones).)
// Build: 2026-06-15 v0.30 (CAPITULO GRUPO DE PRESION programado completo. TOMA DE DATOS: bloque GP reestructurado a 2 filas alineadas (ACTUAL: 5 campos libres descriptivos; NUEVO: Nº motores vacio/2, Potencia 1,1/1,5/2,2/3/4 serie 35, Calderin 8L CALCULADO y BLOQUEADO, Nº depositos libre, Tamano depositos 500/750/1000/2000) + 3a linea (Ubicacion NO NECESITA/C.EXISTENTE/C.NUEVO · Tiempo montaje nuevo GP · Longitud tubo expulsion). El campo "Tiempo montaje nuevo GP" sale del apartado TIEMPOS. MOTOR calcGrupoPresion (5 lineas): (1) Grupo bomba cant 1 si motores nuevo=2, modelo serie 35 por potencia -> columna Dato, precio del catalogo 2x{pot}Kw; (2) By-pass 1 si motores actual>=1 o nuevo; (3) Deposito cant=Nº depositos nuevo (independiente) x precio por tamaño; (4) Tubo alimentacion PE por metros de expulsion y diametro reaprovechado de alimentacion; (5) Fontanero montaje por dias x446. MEDICIONES: pintarCapGP con el MODELO en la celda Dato (nuevo tipo "texto"). Validado: node --check + ejecucion del motor (by-pass 450, fontanero 446, modelo y precio catalogo, deposito por tamaño) + conexion 1.293 € + jsdom toma+desglose. PENDIENTE: precios catalogo 35-4/35-5/35-10 y depositos 500/750/1000 (los mete Guille en el Sheet).)
// Build: 2026-06-15 v0.29 (TOMA DE DATOS, apartado "Tiempos (cuadrilla X2)": quitada la "(H)" de "Tiempo de montaje nuevo GP" y de los dos "Otros tiempos de montaje" (no son horas; la cuadrilla ya va en el titulo). "Tiempo de montaje de Peines (H)" SE MANTIENE (H = horizontales). Ademas, con Montaje="SOLO PIECERIA" los campos longAli y ali_codos, que ya pasaban a disabled, adoptan el aspecto de celda BLOQUEADA del estilo visual (.calc-field: gris-400, texto blanco). Solo presentacion. node --check OK.)
// Build: 2026-06-15 v0.28 (MEDICIONES: columna "Dato" mas estrecha (38px) con input 24px y letra 9px, para dar mas ancho a Concepto. Solo presentacion. node --check + jsdom OK.)
// Build: 2026-06-15 v0.27 (CUARTO DE CONTADORES cerrado como el Excel + retoques MEDICIONES. CUARTO: (1) Accesorios = 10% del material previo (baterias+llaves+flexo), como Excel D146=SUM(F142:F145)*G146; el 0,10 es DATO editable del Sheet. (2) Fontanero desmontaje 0,25 (=2/8) pasa a DATO editable (antes fijo). (3) Albañil ejecucion cuarto: el nombre muestra el tipo pero el PRECIO se busca por concepto BASE Albañil (ejecucion cuarto contadores)=446 fijo (como el Excel), vale para los 2 OBRA. parseMediciones arma obra.cuarto (0,1/0,25) con fallback; pintarCapCuarto pinta esos 2 datos editables. PANTALLA: Detalle y Dato a la DERECHA en su celda; QUITADA columna Tipo; Ud pegada a Concepto y Precio pegado a Total. Validado: node --check + ejecucion (Accesorios 73,2=10% de 732, desmontaje 0,25, Albañil OBRA 446 por base) + jsdom (7 columnas sin Tipo, datos editables, Detalle derecha) + conexion 1.293 €. ACCIONES SHEET: 2 filas parametro al bloque CUARTO + renombrar precio albañil ejecucion al concepto base.)
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
  var SCREENS=[{id:'toma',title:'TOMA DE DATOS',route:'/plan5'},{id:'desglose',title:'MEDICIONES',route:'/plan5/desglose'}];
  var tk=window.__PLAN5_TOKEN__||'', dir=window.__PLAN5_DIR__||'', id=window.__PLAN5_VOLVER_ID__||'', cur=window.__PLAN5_SCREEN__||'';
  function q(){ var p=[]; if(dir)p.push('dir='+encodeURIComponent(dir)); if(id)p.push('id='+encodeURIComponent(id)); if(tk)p.push('token='+encodeURIComponent(tk)); return p.length?'?'+p.join('&'):''; }
  var t=document.getElementById('scrTitle'); var me=SCREENS.filter(function(s){return s.id===cur;})[0]; if(t&&me) t.textContent=me.title;
  var list=document.getElementById('menuList');
  if(list){ var html=''; SCREENS.forEach(function(s){ html+='<a class="menu-item'+(s.id===cur?' current':'')+'" href="'+s.route+q()+'">'+s.title+'</a>'; });
    ['IMPORTAR CATASTRO','IMPRIMIR PRESUPUESTO','IMPRIMIR DATOS'].forEach(function(t){ html+='<div class="menu-item" data-p5act="'+t+'">'+t+'</div>'; });
    if(id){ html+='<div class="menu-sep"></div><a class="menu-item" href="/presupuestos/expediente?id='+encodeURIComponent(id)+(tk?'&token='+encodeURIComponent(tk):'')+'">\\u2190 Volver al expediente</a>'; }
    list.innerHTML=html; }
  var btn=document.getElementById('menuBtn');
  if(btn&&list){ btn.addEventListener('click',function(e){e.stopPropagation();list.hidden=!list.hidden;}); document.addEventListener('click',function(e){ if(e.target!==btn && !list.contains(e.target)) list.hidden=true; }); }
  if(list){ list.querySelectorAll('[data-p5act]').forEach(function(el){ el.addEventListener('click',function(){ var a=el.getAttribute('data-p5act'); if((a==='IMPORTAR CATASTRO'||a==='IMPORTAR IMAGENES')&&window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.estado==='cerrado'){alert('Presupuesto cerrado: abrelo con el candado para poder importar.');return;} if(a==='IMPRIMIR PRESUPUESTO'){ window.open('/plan5/presupuesto'+q(),'_blank'); list.hidden=true; } if(a==='IMPRIMIR DATOS'){ alert('IMPRIMIR DATOS: en construccion (pronto: toma de datos + materiales + tareas).'); list.hidden=true; } if(a==='IMPORTAR CATASTRO'){ list.hidden=true; (function(){ var g=function(id){var e=document.getElementById(id);return e?(e.value||''):'';}; var p=[]; p.push('tipovia='+encodeURIComponent(g('f_tipovia'))); p.push('calle='+encodeURIComponent(g('f_direccion'))); p.push('poblacion='+encodeURIComponent(g('f_poblacion'))); p.push('cp='+encodeURIComponent(g('f_cp'))); if(tk)p.push('token='+encodeURIComponent(tk)); fetch('/plan5/catastro?'+p.join('&')).then(function(r){return r.json();}).then(function(j){ if(window.catImport)window.catImport(j); else alert('No se pudo cargar la lista.'); }).catch(function(e){ alert('Error consultando el Catastro: '+e.message); }); })(); } }); }); }
})();
`;

// La pantalla "Toma de datos" va incrustada aqui como texto (cadena JS escapada);
// asi todo el modulo Plan 5 es UN solo archivo y no hay .html aparte.
const TOMA_DATOS_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<style>.vrow{border-bottom:none}.avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:8px 0;font-size:11px}input.p5mismatch{border-color:#dc2626!important;background:#fef2f2!important;color:#dc2626!important}.ptl-card .ptl-form-grid input[readonly]{background:var(--ptl-gray-400)!important;color:#fff!important;border-color:var(--ptl-gray-400)!important}#longAli:disabled,#ali_montaje:disabled,#ali_codos:disabled,#con_llaves:disabled{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;opacity:1;font-weight:600}#gp_cald_new{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;font-weight:600}.catrow{display:flex;gap:12px;align-items:stretch}.catA{flex:1 1 23%;display:flex;flex-direction:column;min-width:0}.catB{flex:3 1 77%;display:flex;flex-direction:column;min-width:0}.catAhd,.catBhd{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 6px;border-bottom:1px solid var(--titulo);padding-bottom:4px;min-height:22px}.catadd{margin:0}.cattab{flex:1}.catth,.catrowr{display:grid;grid-template-columns:38px 34px 1fr 42px 30px 26px;gap:4px;align-items:center}.catth{font-size:10px;color:#888;font-weight:600;margin-bottom:4px}.catth span{padding:0 2px}.catrowr{margin-bottom:4px}.catrowr input{width:100%;box-sizing:border-box;font-size:13px;padding:4px 6px}.catdel{margin:0}.cattools{display:flex;align-items:center;gap:8px}.catpal{display:flex;gap:4px}.catsw{width:27px;height:27px;border-radius:4px;border:2px solid #ccc;cursor:pointer;padding:0}.catsw.sel{border-color:#111;box-shadow:0 0 0 2px #fff,0 0 0 3px #111}.catclear{font-size:11px;padding:3px 8px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff}.cattools button{font-size:16px !important;line-height:1 !important;padding:5px 11px !important}.catcanvwrap{width:100%;aspect-ratio:1/1;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff}#catcanvas{display:block;width:100%;height:100%;cursor:crosshair;touch-action:none}</style>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Plan 5 · Toma de datos</title>\n</head>\n<body>\n<script>window.__PLAN5_SAVED__=null;window.__PLAN5_SCREEN__=\"toma\";/*__PLAN5_SAVED__*/</script>\n<div class=\"page\">\n\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n\n  <!-- 1. DATOS DEL PRESUPUESTO -->\n  <div class=\"card\">\n    <div class=\"t\">Datos del presupuesto</div>\n    <div class=\"grid g3\" style=\"grid-template-columns:1fr 1fr 3fr\">\n      <label class=\"f\"><span class=\"lab\">Nº de presupuesto</span><input id=\"f_npresupuesto\" value=\"\" style=\"font-size:16px;font-weight:bold\"></label>\n      <label class=\"f\"><span class=\"lab\">Fecha</span><input id=\"f_fecha\" type=\"date\" value=\"\"></label>\n      <div style=\"text-align:right;align-self:start;font-size:13px;font-weight:600;padding-top:2px;\">__PLAN5_REV__</div>\n    </div>\n  </div>\n\n  <!-- 2. DATOS CCPP (del expediente; identica a la ficha, bloqueada, sin botones) -->\n  <div class=\"ptl-card\">\n    <div class=\"ptl-card-title\" style=\"border-bottom:1px solid var(--ptl-general-2)\">Datos CCPP</div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-1\"><label class=\"ptl-form-label\">Tipo via</label><input class=\"calc-field\" id=\"f_tipovia\" value=\"\" readonly></div>\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Direccion</label><input class=\"calc-field\" id=\"f_direccion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-3\"><label class=\"ptl-form-label\">Poblacion</label><input class=\"calc-field\" id=\"f_poblacion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">CP</label><input class=\"calc-field\" id=\"f_cp\" value=\"\" readonly style=\"width:100%\"></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Administrador</label><input class=\"calc-field\" id=\"f_admin\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_admintel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_adminemail\" value=\"\" readonly></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Presidente</label><input class=\"calc-field\" id=\"f_presidente\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_prestel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_presemail\" value=\"\" readonly></div>\n    </div>\n  </div>\n\n  <!-- 2.5 DATOS ECONOMICOS (cuadro economico C29:F51 - SOLO GRAFICO, sin Sheet) -->\n  <div class=\"card\">\n    <div class=\"t\">Datos economicos</div>\n\n    <div class=\"grid g4\"><label class=\"f\"><span class=\"lab\">Tiempo ejecucion <small>(dias/cuadrilla)</small></span><div class=\"derived\" id=\"de_tEjec\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">%bº tradicional s/venta</span><input id=\"de_c41\" type=\"text\" inputmode=\"decimal\" maxlength=\"5\" style=\"width:100%;box-sizing:border-box\"></label><label class=\"f\"><span class=\"lab\">% Bº materiales</span><div class=\"derived\" id=\"de_bMat\"></div></label><label class=\"f\"><span class=\"lab\">% Bº mano de obra</span><div class=\"derived\" id=\"de_bMo\"></div></label></div>\n    \n    <div class=\"grid g5\"><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Costes</div><label class=\"f\"><span class=\"lab\">Coste total</span><div class=\"derived\" id=\"de_cTot\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">mano de obra</span><div class=\"derived\" id=\"de_cMo\"></div></label><label class=\"f\"><span class=\"lab\">materiales</span><div class=\"derived\" id=\"de_cMat\"></div></label><label class=\"f\"><span class=\"lab\">albañileria</span><div class=\"derived\" id=\"de_cAlb\"></div></label><label class=\"f\"><span class=\"lab\">grupo presion</span><div class=\"derived\" id=\"de_cGp\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;cursor:pointer\" class=\"colsel\" data-col=\"trad\">Presupuesto tradicional</div><label class=\"f\"><span class=\"lab\">Presupuesto total</span><div class=\"derived\" id=\"de_totTrad\"></div></label><label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totTradIva\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">Bº tradicional</span><div class=\"derived\" id=\"de_btTrad\"></div></label><label class=\"f\"><span class=\"lab\">% bº s/venta</span><div class=\"derived\" id=\"de_pBenTrad\"></div></label><label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hTrad\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;cursor:pointer\" class=\"colsel\" data-col=\"p5\">Presupuesto Plan 5</div><label class=\"f\"><span class=\"lab\">Presupuesto total</span><div class=\"derived\" id=\"de_totP5\"></div></label><label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totP5Iva\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">Bº Plan 5</span><div class=\"derived\" id=\"de_bP5\"></div></label><label class=\"f\"><span class=\"lab\">% bº s/venta</span><div class=\"derived\" id=\"de_pBenP5\"></div></label><label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hP5\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\" id=\"tit-subv\">CON SUBVENCION EMASESA</div><label class=\"f\"><span class=\"lab\">Subvencion total</span><div class=\"derived\" id=\"de_subv\"></div></label><label class=\"f\"><span class=\"lab\" id=\"lab-totsubv\">Total con subvencion e IVA</span><div class=\"derived\" id=\"de_totSubv\"></div></label><label class=\"f\"><span class=\"lab\">Importe por comunero</span><div class=\"derived\" id=\"de_comunero\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Financiacion particular</div><label class=\"f\"><span class=\"lab\">Cuota 6 meses <small>(8,312%)</small></span><div class=\"derived\" id=\"de_fin6\"></div></label><label class=\"f\"><span class=\"lab\">Cuota 12 meses <small>(8,037%)</small></span><div class=\"derived\" id=\"de_fin12\"></div></label><label class=\"f\"><span class=\"lab\">Cuota 18 meses <small>(7,708%)</small></span><div class=\"derived\" id=\"de_fin18\"></div></label><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0;min-height:30px;display:flex;align-items:flex-end;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Financiacion comunitaria</div><label class=\"f\"><span class=\"lab\">Importe financiable</span><div class=\"derived\" id=\"de_finCom\"></div></label></div></div>\n  </div>\n\n  <!-- 3. EDIFICIO Y VIVIENDAS -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de edificio</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Nº de plantas <small>(Baja + X)</small></span><input id=\"plantas\" type=\"number\" value=\"\" min=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Altura de planta <small>(m)</small></span><input id=\"altura\" type=\"number\" value=\"\" step=\"0.1\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de suministros</span><input id=\"nsum\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de edificio</span><div class=\"derived\" id=\"tipoEdif\">TIPO C</div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales con suministro</span><input id=\"localesCon\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales sin suministro</span><input id=\"localesSin\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de locales</span><div class=\"derived\" id=\"locNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"locTipo\"></div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Viv. con mas de una entrada</span><input id=\"vivMasEntrada\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de entradas de mas</span><input id=\"entradasMas\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n    </div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en planta baja</div>\n      <button class=\"add\" data-z=\"baja\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vbaja\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en resto de plantas</div>\n      <button class=\"add\" data-z=\"resto\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vresto\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en atico</div>\n      <button class=\"add\" data-z=\"atico\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vatico\"></div>\n\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto1\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto2\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de comunidad</span><div class=\"derived\" id=\"comNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"comTipo\"></div></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 7. TUBO CONEXIÓN + ALIMENTACIÓN -->\n  <!-- CARACTERÍSTICAS DE LA INSTALACIÓN (A28:B51) -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de instalacion</div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Acometida</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Nº contador de agua</span><input id=\"ac_ncont\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Ubicacion del contador</span><select id=\"ac_ubic\"><option selected></option><option>FACHADA DELANTERA</option><option>FACHADA LATERAL</option><option>FACHADA TRASERA</option><option>ZONAS COMUNES</option><option>CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Situacion llave acerado</span><select id=\"ac_llave\"><option selected></option><option>DELANTERA</option><option>LATERAL</option><option>TRASERA</option><option>DELANTERA-TRASLADAR</option><option>LATERAL-TRASLADAR</option><option>TRASERA-TRASLADAR</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº llaves de corte general <small>(ud)</small></span><input id=\"con_llaves\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de conexion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longCon\"><option selected></option><option>NO EXISTE</option><option>VALIDO</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select id=\"con_material\"><option selected></option><option>DESCONOCIDO</option><option>PE</option><option>PLOMO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Diametro actual <small>(mm)</small></span><select id=\"con_diam\"><option selected></option><option>DESCONOCIDO</option><option>25</option><option>32</option><option>40</option><option>50</option><option>63</option><option>75</option><option>90</option><option>110</option></select></label>\n      <label class=\"f\"><span class=\"lab\">&nbsp;</span><span id=\"con_valido_badge\" class=\"ptl-badge ptl-badge-verde\" style=\"display:none;\">TUBO DE CONEXIÓN VÁLIDO</span></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de alimentacion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longAli\"><option selected></option><option>SOLO PIECERIA</option><option>2,5</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Montaje propuesto</span><select id=\"ali_montaje\"><option selected></option><option>ENTERRADO</option><option>B.FORJADO</option><option>CANALETA</option><option>F.VIGA</option><option>F.TECHO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº codos termofusion <small>(ud)</small></span><input id=\"ali_codos\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Montante de abastecimiento</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select id=\"mab_mat\"><option selected></option><option>DESCONOCIDO</option><option>COBRE</option><option>HIERRO</option><option>PPR</option><option>PE</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Armario de Contadores</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select id=\"cc_ubic\"><option selected></option><option>EN FACHADA DELANTERA</option><option>EN FACHADA LATERAL</option><option>EN FACHADA TRASERA</option><option>EN PORTAL</option><option>BAJO ESCALERA</option><option>EN PATIO INTERIOR</option><option>EN PATIO EXTERIOR</option><option>EN CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de armario</span><select id=\"cuarto_tipo\"><option selected></option><option value=\"EXISTENTE\">CUARTO EXISTENTE</option><option>ALUMINIO</option><option>OBRA - P.ALUMINIO</option><option>OBRA - P.HIERRO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 1</span><select class=\"bat\" id=\"cuarto_bat1\"></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 2 (si hay)</span><select class=\"bat\" id=\"cuarto_bat2\"></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Grupo de presion</div>\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores actual</span><input id=\"gp_mot_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia actual <small>(KW)</small></span><input id=\"gp_pot_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin actual <small>(L)</small></span><input id=\"gp_cald_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos actual</span><input id=\"gp_ndep_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos actual <small>(L)</small></span><input id=\"gp_tdep_act\" type=\"text\" value=\"\"></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores nuevo</span><input id=\"gpInstala\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia nueva <small>(KW)</small></span><select id=\"gp_pot_new\"><option selected></option><option>1,1</option><option>1,5</option><option>2,2</option><option>3</option><option>4</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin nuevo <small>(L)</small></span><input id=\"gp_cald_new\" type=\"text\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos nuevo</span><input id=\"gp_ndep_new\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos nuevo <small>(L)</small></span><select id=\"gp_tdep_new\"><option selected></option><option>500</option><option>750</option><option>1000</option><option>2000</option></select></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select id=\"gp_ubic\"><option selected></option><option>NO NECESITA</option><option>CUARTO EXISTENTE</option><option>CUARTO NUEVO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tiempo montaje nuevo GP</span><input id=\"gp_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Longitud tubo expulsion <small>(m)</small></span><input id=\"gp_longexp\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempos (días/cuadrilla X2)</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje de Peines (H)</span><input id=\"peines_h_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t1\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input id=\"otros_t1_esp\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t2\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input id=\"otros_t2_esp\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros trabajos extra <small>(€)</small></span><input id=\"otros_eur\" type=\"text\" inputmode=\"decimal\" value=\"\" class=\"euro\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input id=\"otros_eur_esp\"></label>\n    </div>\n  </div>\n\n  <!-- 10. PEINES -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de peines</div>\n    <div id=\"avPeines\"></div>\n    <div id=\"peines\"></div>\n  </div>\n\n  <!-- 11. CONDICIONES PARTICULARES -->\n  <div class=\"card\">\n    <div class=\"t\">Condiciones particulares</div>\n    <textarea id=\"f_condiciones\" rows=\"7\" style=\"width:100%;box-sizing:border-box;font-family:inherit;font-size:14px;line-height:1.4;padding:8px;resize:vertical;\">__PLAN5_COND__</textarea>\n  </div>\n\n  <!-- 12. CATASTRO Y CROQUIS -->\n  <div class=\"card\">\n    <div class=\"t\">Catastro y croquis</div>\n    <div class=\"catrow\">\n      <div class=\"catA\">\n        <div class=\"catAhd\"><span>Catastro</span><button type=\"button\" class=\"add catadd\" title=\"Añadir fila\">+</button></div>\n        <div class=\"cattab\">\n          <div class=\"catth\"><span>Planta</span><span>Puerta</span><span>Uso</span><span>Sup. m²</span><span>BAT</span><span></span></div>\n          <div id=\"catlist\"></div>\n        </div>\n      </div>\n      <div class=\"catB\">\n        <div class=\"catBhd\"><span>Croquis</span><div class=\"cattools\" style=\"display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end\"><button type=\"button\" class=\"cattool\" data-t=\"lapiz\" title=\"Lápiz: dibujar a mano alzada\" style=\"font-size:11px;line-height:1;padding:3px 7px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a\">Lápiz</button><button type=\"button\" class=\"cattool\" data-t=\"goma\" title=\"Goma: borra lo que toques\" style=\"font-size:11px;line-height:1;padding:3px 7px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a\">Goma</button><span class=\"catpal\"></span><button type=\"button\" class=\"catw\" data-w=\"2\" title=\"Trazo fino\" style=\"font-size:10px;line-height:1;padding:3px 6px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a\">F</button><button type=\"button\" class=\"catw\" data-w=\"4\" title=\"Trazo medio\" style=\"font-size:11px;line-height:1;padding:3px 6px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-weight:700\">M</button><button type=\"button\" class=\"catw\" data-w=\"7\" title=\"Trazo grueso\" style=\"font-size:12px;line-height:1;padding:3px 6px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-weight:800\">G</button><button type=\"button\" class=\"catcenter\" title=\"Centrar el dibujo\" style=\"font-size:11px;line-height:1;padding:3px 7px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a\">Centrar</button><button type=\"button\" class=\"catclear\" title=\"Borrar todo\" style=\"font-size:11px;line-height:1;padding:3px 7px;cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a\">Borrar todo</button></div></div>\n        <div class=\"catcanvwrap\"><canvas id=\"catcanvas\"></canvas></div>\n      </div>\n    </div>\n  </div>\n\n</div>\n\n<script>\nconst PLAST={20:25,25:32,30:40,40:50,50:63,60:75,80:90,100:110};\nconst ACOM=[[20,2,1,1,0,0],[25,6,4,3,2,1],[30,15,11,9,7,5],[40,60,40,33,22,17],[50,100,70,55,37,30],[60,180,120,90,60,50],[80,400,300,250,200,150]];\nconst ALIM=[[30,2,1,1,0,0],[40,5,3,2,2,1],[50,25,16,14,10,6],[60,75,50,45,40,30],[80,120,90,80,70,60],[100,200,150,130,110,90]];\nconst TI={\"TIPO A\":0,\"TIPO B\":1,\"TIPO C\":2,\"TIPO D\":3,\"TIPO E\":4};\nconst EQUIP_TIPO={\"Cocina + Lavadero + sanitario\":\"TIPO A\",\"Cocina + Lavadero + aseo\":\"TIPO B\",\"Cocina + Lavadero + baño\":\"TIPO C\",\"Cocina + Office + Lavadero + baño + aseo\":\"TIPO D\",\"Cocina + Office + Lavadero + 2 baño + aseo\":\"TIPO E\",\"Otros\":\"TIPO F\"};\nfunction diamBase(t,n,tipo){const i=TI[tipo];if(i===undefined)return null;for(const f of t){if(f[1+i]>0&&n<=f[1+i])return f[0];}return null;}\nfunction dAco(n,tipo,L){let d=diamBase(ACOM,n,tipo);if(d===null)return\"—\";if(L>15)d+=20;else if(L>6)d+=10;return(PLAST[d]||d)+\" mm\";}\nfunction dAli(n,tipo,L){let d=diamBase(ALIM,n,tipo);if(d===null)return\"—\";if(L>40)d+=20;else if(L>15)d+=10;return(PLAST[d]||d)+\" mm\";}\n\nfunction pp(t,h,n){const M={\"SIMPLE\":[1,0,0],\"SIMPLE+1\":[1,1,0],\"1-SIMPLE\":[1,0,h],\"1-SIMPLE+1\":[1,1,h],\"SIMPLE-1\":[1,0,h*(n+1)],\"SIMPLE-2\":[1,0,h*(2*n+1)],\"1-SIMPLE-1\":[1,0,h*(n+1)+h],\"1-SIMPLE-2\":[1,0,h*(2*n+1)+h],\"DOBLE\":[2,0,0],\"DOBLE+1\":[2,1,0],\"DOBLE+2\":[2,2,0],\"1-DOBLE\":[2,0,h],\"2-DOBLE\":[2,0,2*h],\"1-DOBLE+1\":[2,1,h],\"2-DOBLE+1\":[2,1,2*h],\"1-DOBLE+2\":[2,2,h],\"DOBLE-1\":[2,0,h],\"DOBLE-2\":[2,0,2*h],\"2-DOBLE+2\":[2,2,2*h]};return M[t]||[1,0,0];}\nconst TIPOS=[\"SIMPLE\",\"SIMPLE+1\",\"SIMPLE-1\",\"SIMPLE-2\",\"1-SIMPLE\",\"1-SIMPLE+1\",\"1-SIMPLE-1\",\"1-SIMPLE-2\",\"DOBLE\",\"DOBLE+1\",\"DOBLE+2\",\"DOBLE-1\",\"DOBLE-2\",\"1-DOBLE\",\"2-DOBLE\",\"1-DOBLE+1\",\"2-DOBLE+1\",\"1-DOBLE+2\",\"2-DOBLE+2\"];\nconst EQUIPS=Object.keys(EQUIP_TIPO);\nfunction pTubo(t,h,n){const[k,p,R]=pp(t,h,n);return k*h*(n+1)*(n+2)/2+p*h*(n+2)-R;}\nfunction pViv(t,n){const[k,p]=pp(t,1,n);return k*(n+1)+p;}\nfunction splitTipo(t){t=t||\"\";var pre=\"\";if(t.slice(0,2)===\"1-\"){pre=\"1-\";t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){pre=\"2-\";t=t.slice(2);}else if(t.slice(0,2)===\"1+\"){pre=\"1+\";t=t.slice(2);}else if(t.slice(0,2)===\"2+\"){pre=\"2+\";t=t.slice(2);}else if(t.slice(0,2)===\"3+\"){pre=\"3+\";t=t.slice(2);}var suf=\"\";var l2=t.slice(-2);if([\"+1\",\"+2\",\"-1\",\"-2\"].indexOf(l2)>=0){suf=l2;t=t.slice(0,-2);}return{pre:pre,base:t,suf:suf};}\nconst TBASE=[\"\",\"SIMPLE\",\"DOBLE\"];function PREFS(b){return b===\"DOBLE\"?[\"\",\"1-\",\"2-\",\"1+\",\"2+\",\"3+\"]:b===\"SIMPLE\"?[\"\",\"1-\",\"1+\",\"2+\",\"3+\"]:[\"\"];}function SUFS(b){return b===\"DOBLE\"?[\"\",\"+1\",\"+2\",\"-1\",\"-2\"]:b===\"SIMPLE\"?[\"\",\"+1\",\"-1\",\"-2\"]:[\"\"];}\nconst optT=(arr,v)=>arr.map(o=>`<option value=\"${o}\" ${o===v?'selected':''}>${o||'—'}</option>`).join(\"\");\n\nconst $=id=>document.getElementById(id);\nconst zonas={ baja:[], resto:[], atico:[] };\nconst CONT={baja:\"vbaja\",resto:\"vresto\",atico:\"vatico\"};\nlet peines=[];\n\nfunction renderZona(z){\n  const arr=zonas[z],c=$(CONT[z]);c.innerHTML=\"\";\n  arr.forEach((v,i)=>{\n    const r=document.createElement(\"div\");r.className=\"vrow\";\n    const o=`<option ${!v.equip?'selected':''}></option>`+EQUIPS.map(e=>`<option ${e===v.equip?'selected':''}>${e}</option>`).join(\"\");\n    const pu=`<option ${!v.puerta?'selected':''}></option>`+[\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"DCHA\",\"IZDA\",\"CENTRO\"].map(x=>`<option ${x===v.puerta?'selected':''}>${x}</option>`).join(\"\");\n    r.innerHTML=`<label class=\"f\"><span class=\"lab\">Puerta</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"vp\">${pu}</select></label>\n      <label class=\"f\"><span class=\"lab\">Equipamiento</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"ve\">${o}</select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de viviendas</span><div class=\"derived vn-disp\" data-z=\"${z}\" data-i=\"${i}\">${v.n||0}</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">${EQUIP_TIPO[v.equip]||''}</div></label>\n      <button class=\"del\" data-z=\"${z}\" data-i=\"${i}\">×</button>`;\n    c.appendChild(r);\n  });\n  c.querySelectorAll(\".vp\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].puerta=e.target.value;recalc();});\n  c.querySelectorAll(\".ve\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].equip=e.target.value;renderZona(e.target.dataset.z);recalc();});\n  c.querySelectorAll(\".del\").forEach(b=>b.onclick=e=>{zonas[e.target.dataset.z].splice(+e.target.dataset.i,1);renderZona(e.target.dataset.z);recalc();});\n}\nfunction renderVivs(){renderZona(\"baja\");renderZona(\"resto\");renderZona(\"atico\");}\nfunction todasViviendas(){return [...zonas.baja,...zonas.resto,...zonas.atico];}\nconst OPT_ENGANCHE=[\"EXT\",\"INT-FACIL\",\"INT-MEDIO\",\"INT-DIFICIL\"];\nconst OPT_PEINEV=[\"V-INT\",\"V-EXT\"];\nconst OPT_IE=[\"INTERIOR\",\"EXTERIOR\"];\nconst OPT_ENGCB=[\"ENGANCHA EN COCINAS\",\"ENGANCHA EN BAÑOS\"];\nconst OPT_PROT=[\"B.FORJADO\",\"CANALETA\",\"F.VIGA\",\"F.TECHO\",\"B.LADRILLO\"];\nconst OPT_SUBE=[\"SUBE POR FACHADA DELANTERA\",\"SUBE POR FACHADA LATERAL DERECHA\",\"SUBE POR FACHADA LATERAL IZQUIERDA\",\"SUBE POR FACHADA TRASERA\",\"SUBE POR PATIO DERECHO\",\"SUBE POR PATIO CENTRAL\",\"SUBE POR PATIO IZQUIERDO\",\"SUBE POR PATIO DELANTERO\",\"SUBE POR PATIO TRASERO\",\"SUBE POR SCHUNT\"];\nconst OPT_BAJA=[\"NO BAJA\",\"BAJA POR FACHADA DELANTERA\",\"BAJA POR FACHADA LATERAL DERECHA\",\"BAJA POR FACHADA LATERAL IZQUIERDA\",\"BAJA POR FACHADA TRASERA\",\"BAJA POR PATIO DERECHO\",\"BAJA POR PATIO CENTRAL\",\"BAJA POR PATIO IZQUIERDO\",\"BAJA POR PATIO DELANTERO\",\"BAJA POR PATIO TRASERO\",\"BAJA POR SCHUNT\"];\nconst sel=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join(\"\");\nconst selB=(arr,v)=>`<option ${!v?'selected':''}></option>`+sel(arr,v);\nconst subH=t=>`<div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:8px 0 4px;\">${t}</div>`;\n\nfunction tramosHTML(i,m,arr){\n  const cols=(arr||[]).map((tr,t)=>`\n    <div style=\"display:flex;flex-direction:column;gap:4px;\">\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <label class=\"f\" style=\"flex:1;\"><span class=\"lab\">Longitud <small>(m)</small></span><input data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"long\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"${tr.long||''}\"></label>\n        <button class=\"del tdel\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">×</button>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <select data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"prot\" style=\"flex:1;\"><option ${!tr.prot?'selected':''}></option>${sel(OPT_PROT,tr.prot)}</select>\n        <button class=\"tadd addtramo\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">+</button>\n      </div>\n    </div>`).join(\"\");\n  return `<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end;\">${cols}</div>`;\n}\nfunction renderPeines(){\n  const c=$(\"peines\");c.innerHTML=\"\";\n  if(!peines.length){\n    const ab=document.createElement(\"button\");ab.className=\"add\";ab.title=\"Añadir peine\";ab.textContent=\"+\";\n    ab.onclick=()=>{peines.push(nuevoPeine());renderPeines();};\n    c.appendChild(ab);return;\n  }\n  peines.forEach((pe,i)=>{\n    const b=document.createElement(\"div\");\n    b.style.cssText=\"border:1px solid var(--g200);border-radius:8px;padding:8px 10px;margin-bottom:8px;position:relative;\";\n    b.innerHTML=`\n      <div style=\"position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;\">\n        <button class=\"add padd\" data-i=\"${i}\" title=\"Añadir peine\">+</button>\n        <button class=\"del pdel\" data-i=\"${i}\">×</button>\n      </div>\n      <div style=\"font-weight:700;color:var(--titulo);font-size:13px;margin-bottom:6px;\">PEINE ${i+1}</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:16px;\">\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante actual</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Interior / Exterior</span><select data-i=\"${i}\" data-k=\"maIE\">${selB(OPT_IE,pe.maIE)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"maEng\">${selB(OPT_ENGCB,pe.maEng)}</select></label>\n          </div>\n        </div>\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante nuevo</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Recorrido (sube)</span><select data-i=\"${i}\" data-k=\"mnSube\">${selB(OPT_SUBE,pe.mnSube)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Recorrido (baja)</span><select data-i=\"${i}\" data-k=\"mnBaja\">${selB(OPT_BAJA,pe.mnBaja)}</select></label>\n          </div>\n        </div>\n      </div>\n      <div class=\"grid g5\" style=\"margin-top:8px;\">\n        <label class=\"f\"><span class=\"lab\">Puerta(s)</span><input data-i=\"${i}\" data-k=\"puerta\" value=\"${pe.puerta||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Tipo de peine</span><div style=\"display:flex;gap:4px;\"><select class=\"ptipo\" data-i=\"${i}\" data-part=\"pre\" style=\"width:42px;\">${optT(PREFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).pre)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"base\" style=\"flex:1;\">${optT(TBASE,splitTipo(pe.tipo).base)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"suf\" style=\"width:42px;\">${optT(SUFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).suf)}</select></div></label>\n        <label class=\"f\"><span class=\"lab\">Nº giros extra</span><input data-i=\"${i}\" data-k=\"giros\" type=\"number\" min=\"0\" value=\"${pe.giros||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"enganche\">${selB(OPT_ENGANCHE,pe.enganche)}</select></label>\n        <label class=\"f\"><span class=\"lab\">Peine (V)</span><select data-i=\"${i}\" data-k=\"peineV\">${selB(OPT_PEINEV,pe.peineV)}</select></label>\n      </div>\n      <div style=\"margin-top:8px;\">${tramosHTML(i,'tramos',pe.tramos)}</div>`;\n    c.appendChild(b);\n  });\n  c.querySelectorAll(\"[data-k]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{peines[+e.target.dataset.i][e.target.dataset.k]=e.target.value;});\n  });\n  c.querySelectorAll(\"[data-f]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{const d=e.target.dataset; peines[+d.i][d.m][+d.t][d.f]=e.target.value;});\n  });\n  c.querySelectorAll(\".ptipo\").forEach(el=>el.addEventListener(\"change\",e=>{var i=+e.target.dataset.i;var pre=\"\",base=\"\",suf=\"\";c.querySelectorAll(\".ptipo\").forEach(p=>{if(+p.dataset.i!==i)return;if(p.dataset.part===\"pre\")pre=p.value;else if(p.dataset.part===\"base\")base=p.value;else suf=p.value;});if(PREFS(base).indexOf(pre)<0)pre=\"\";if(SUFS(base).indexOf(suf)<0)suf=\"\";peines[i].tipo=(pre||\"\")+(base||\"\")+(suf||\"\");renderPeines();}));\n  c.querySelectorAll(\".addtramo\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t+1,0,{long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".tdel\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t,1); if(!peines[+d.i][d.m].length)peines[+d.i][d.m].push({long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".pdel\").forEach(b=>b.onclick=e=>{peines.splice(+e.currentTarget.dataset.i,1);renderPeines();});\n  c.querySelectorAll(\".padd\").forEach(b=>b.onclick=()=>{peines.push(nuevoPeine());renderPeines();});avisoViviendas();\n}\nfunction tipoEdificio(){\n  const orden=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"];let best=\"TIPO A\";\n  todasViviendas().forEach(v=>{const t=EQUIP_TIPO[v.equip];if(t&&orden.indexOf(t)>orden.indexOf(best))best=t;});\n  return best;\n}\nfunction recalc(){\n  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};\n  const n=+$(\"plantas\").value||0,h=+$(\"altura\").value||0;\n  const nViv=todasViviendas().length;\n  let nSum=0; [\"baja\",\"resto\",\"atico\"].forEach(function(z){ zonas[z].forEach(function(v,i){ var c=(v.puerta||v.equip)?((z===\"resto\")?n:1):0; v.n=c; nSum+=c; var d=document.querySelector(\".vn-disp[data-z=\\\"\"+z+\"\\\"][data-i=\\\"\"+i+\"\\\"]\"); if(d) d.textContent=c; }); });\n  var lsin=+($(\"localesSin\")||{}).value||0; nSum+=lsin;\n  var _ln=$(\"locNum\"); if(_ln) _ln.textContent=lsin||\"\"; var _lt=$(\"locTipo\"); if(_lt) _lt.textContent=lsin>0?\"TIPO B\":\"\";\n  var c1=(($(\"comPunto1\")||{}).value||\"\"), c2=(($(\"comPunto2\")||{}).value||\"\");\n  var comN=(c1?1:0)+(c2?1:0);\n  var _cn=$(\"comNum\"); if(_cn) _cn.textContent=comN>0?1:0;\n  var _ct=$(\"comTipo\"); if(_ct) _ct.textContent=comN>0?\"TIPO A\":\"\";\n  if(comN>0) nSum+=1;\n  $(\"nsum\").value = (nViv||lsin||comN) ? nSum : \"\";\n  var tipo = nViv ? tipoEdificio() : \"\";\n  if(lsin>0){ var _ord=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"]; if(!tipo || _ord.indexOf(\"TIPO B\")>_ord.indexOf(tipo)) tipo=\"TIPO B\"; }\n  set(\"tipoEdif\",tipo);\n  var _gpi=$(\"gpInstala\"); var _cn=$(\"gp_cald_new\"); if(_cn){ _cn.value=(_gpi&&_gpi.value===\"2\")?\"8\":\"\"; }\n  const numAli=parseFloat(String(($(\"longAli\")||{}).value||\"\").replace(\",\",\".\"))||0;\n  const a=dAco(nSum,tipo,+$(\"longCon\").value||0),al=dAli(nSum,tipo,numAli);\n  set(\"dAco\",a);set(\"dAli\",al);var _bm=$(\"con_material\"),_bd=$(\"con_diam\"),_bb=$(\"con_valido_badge\");var _neC=String((($(\"longCon\")||{}).value)||\"\").trim()===\"NO EXISTE\";if(_bm){_bm.disabled=_neC;if(_neC)_bm.value=\"\";}if(_bd){_bd.disabled=_neC;if(_neC)_bd.value=\"\";}var _bat2Ll=String((($(\"cuarto_bat2\")||{}).value)||\"\").trim()!==\"\";var _llEl=$(\"con_llaves\");if(_llEl){_llEl.value=(_bat2Ll?3:2);_llEl.disabled=true;}if(_bb){var _lr=String(($(\"longCon\")||{}).value||\"\").trim();var _isVal=(_lr===\"VALIDO\");var _ln=_isVal?0:parseFloat(_lr.replace(\",\",\".\"));var _cd=(!isNaN(_ln))?parseInt(String(dAco(nSum,tipo,_ln)),10):NaN;var _diamOk=_isVal||(!isNaN(_cd)&&parseInt(_bd.value,10)>=_cd);var _ok=((_bm&&_bm.value)===\"PE\")&&_bd&&_bd.value&&_lr!==\"NO EXISTE\"&&_diamOk;_bb.style.display=_ok?\"\":\"none\";}\n  const sub=nSum*160+($(\"gpInstala\").checked?52:0);\n  set(\"rSub\",sub.toLocaleString(\"es-ES\")+\" €\");set(\"dSub\",sub.toLocaleString(\"es-ES\")+\" €\");avisoViviendas();\n}\ndocument.querySelectorAll(\"button.add[data-z]\").forEach(b=>b.onclick=()=>{const z=b.dataset.z;zonas[z].push({puerta:\"\",equip:\"\",n:\"\"});renderZona(z);recalc();});\nfunction nuevoPeine(){return {puerta:\"\",tipo:\"\",giros:\"\",enganche:\"\",peineV:\"\",maIE:\"\",maEng:\"\",mnSube:\"\",mnBaja:\"\",tramos:[{long:\"\",prot:\"\"}]};}\n[\"plantas\",\"altura\",\"longCon\",\"longAli\",\"gpInstala\",\"localesSin\",\"localesCon\",\"comPunto1\",\"comPunto2\",\"con_material\",\"con_diam\",\"entradasMas\",\"vivMasEntrada\",\"cuarto_bat1\",\"cuarto_bat2\"].forEach(id=>{const el=$(id);if(el){el.addEventListener(\"input\",recalc);el.addEventListener(\"change\",recalc);}});\nconst BATERIAS=\"4T-2F,6T-2F,6T-3F,9T-3F,10T-2F,12T-2F,12T-3F,14T-2F,15T-3F,16T-2F,18T-2F,18T-3F,20T-2F,21T-3F,22T-2F,24T-2F,24T-3F,26T-2F,27T-3F,28T-2F,30T-2F,30T-3F,33T-3F,36T-3F,39T-3F,42T-3F,45T-3F\".split(\",\"); const BATMED=('4T-2F 0,36|6T-2F 0,51|6T-3F 0,39|9T-3F 0,55|10T-2F 0,79|12T-2F 0,91|12T-3F 0,67|14T-2F 1,03|15T-3F 0,79|16T-2F 1,15|18T-2F 1,27|18T-3F 0,91|20T-2F 1,39|21T-3F 1,03|22T-2F 1,51|24T-2F 1,63|24T-3F 1,15|26T-2F 1,75|27T-3F 1,27|28T-2F 1,87|30T-2F 1,99|30T-3F 1,39|33T-3F 1,57|36T-3F 1,69|39T-3F 1,81|42T-3F 1,93|45T-3F 2,05').split('|'); var _batMed={}; BATMED.forEach(function(s){ var p=s.split(' '); if(p.length>=2){ _batMed[p[0]]=p[1]; } });\ndocument.querySelectorAll(\"select.bat\").forEach((s)=>{s.innerHTML='<option selected></option>'+BATERIAS.map(b=>`<option>${b}</option>`).join(\"\");});\nfunction vivPeine(t,n){t=String(t||\"\").trim();if(!t)return 0;var a=0,d=0;if(t.slice(0,2)===\"1-\"){a=1;t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){a=2;t=t.slice(2);}else if(t.slice(0,2)===\"1+\"){d=1;t=t.slice(2);}else if(t.slice(0,2)===\"2+\"){d=2;t=t.slice(2);}else if(t.slice(0,2)===\"3+\"){d=3;t=t.slice(2);}var b=0,c=0,s=t.slice(-2);if(s===\"+1\"){c=1;t=t.slice(0,-2);}else if(s===\"+2\"){c=2;t=t.slice(0,-2);}else if(s===\"-1\"){b=1;t=t.slice(0,-2);}else if(s===\"-2\"){b=2;t=t.slice(0,-2);}var k=t===\"DOBLE\"?2:(t===\"SIMPLE\"?1:0);if(!k)return 0;var v=k*(n+1)-a-b+c+d;return v<0?0:v;}function avisoViviendas(){var n=+($(\"plantas\")||{}).value||0;var sumP=0,hay=false;for(var i=0;i<peines.length;i++){if(peines[i].tipo)hay=true;sumP+=vivPeine(peines[i].tipo,n);}var lsin=+($(\"localesSin\")||{}).value||0;var c1=(($(\"comPunto1\")||{}).value||\"\"),c2=(($(\"comPunto2\")||{}).value||\"\");var com=((c1?1:0)+(c2?1:0))>0?1:0;var nsum=+($(\"nsum\")||{}).value||0;var entradasMas=+($(\"entradasMas\")||{}).value||0;var esperado=(nsum-com)+entradasMas;var desc=hay&&nsum>0&&sumP!==esperado;var el=$(\"nsum\");if(el){if(desc)el.classList.add(\"p5mismatch\");else el.classList.remove(\"p5mismatch\");}var box=$(\"avPeines\");if(box){var _p=[];if(desc)_p.push('Los peines suman '+sumP+' montantes, pero se esperan '+esperado+' (viviendas + locales + entradas de más). Revisa los peines o la distribución de viviendas.');var _sv=(window.__P5_SRVAV||[]);for(var _i=0;_i<_sv.length;_i++){_p.push(String(_sv[_i]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));}box.innerHTML=_p.length?('<div class=\"avbox\">'+_p.join('<br>')+'</div>'):'';}}renderVivs();renderPeines();recalc();(function(){var mo=$(\"ali_montaje\"),lo=$(\"longAli\"),co=$(\"ali_codos\"),ll=$(\"con_llaves\");function pz(){var p=lo&&lo.value===\"SOLO PIECERIA\";if(mo){mo.disabled=p;if(p)mo.value=\"\";}if(co){co.disabled=p;if(p)co.value=\"\";}recalc();}window.__pzAli=pz;if(lo)lo.addEventListener(\"change\",pz);pz();})();\n\nvar catFilas=[];\nvar croqStrokes=[]; var croqColor=\"#dc2626\"; var croqW=4; var croqTool=\"lapiz\"; var croqCanvas=null, croqCtx=null; var croqBg=null; var croqView={k:1,ox:0,oy:0}; var croqCur=null; var croqPtrs={}; var croqGes=null; var croqGesLock=false; var croqPan=null; var croqChanged=false; function croqPCount(){ return Object.keys(croqPtrs).length; } function w2s(p){ return [ p[0]*croqView.k+croqView.ox, p[1]*croqView.k+croqView.oy ]; } function s2w(x,y){ return [ (x-croqView.ox)/croqView.k, (y-croqView.oy)/croqView.k ]; } function croqFit(){ if(croqBg&&croqBg.world&&croqBg.world.length>=3&&croqCanvas){ var W=croqCanvas.width,H=croqCanvas.height,pad=18,r=croqBg.world,minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity; for(var i=0;i<r.length;i++){ var x=r[i][0],y=r[i][1]; if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } var dw=(maxx-minx)||1,dh=(maxy-miny)||1,k=Math.min((W-2*pad)/dw,(H-2*pad)/dh); croqView={ k:k, ox:(W-k*(minx+maxx))/2, oy:(H-k*(miny+maxy))/2 }; } else { croqView={k:1,ox:0,oy:0}; } } function croqSetBg(p){ if(p&&Array.isArray(p.ring)&&p.ring.length>=3){ var w=[]; for(var i=0;i<p.ring.length;i++){ w.push([ p.ring[i][0], -p.ring[i][1] ]); } var _cv=function(rr){ var o=[]; if(Array.isArray(rr)){ for(var k=0;k<rr.length;k++){ var g=rr[k]; if(Array.isArray(g)&&g.length>=3){ var ww=[]; for(var t=0;t<g.length;t++){ ww.push([ g[t][0], -g[t][1] ]); } o.push(ww); } } } return o; }; croqBg={ world:w, edificios:_cv(p.edificios), patios:_cv(p.patios) }; } else { croqBg=null; } croqFit(); if(typeof catRedraw===\"function\")catRedraw(); } function croqDrawBg(){ if(!croqBg||!croqBg.world||croqBg.world.length<3||!croqCtx) return; var r=croqBg.world; croqCtx.save(); croqCtx.beginPath(); for(var j=0;j<r.length;j++){ var q=w2s(r[j]); if(j===0)croqCtx.moveTo(q[0],q[1]); else croqCtx.lineTo(q[0],q[1]); } croqCtx.closePath(); croqCtx.fillStyle=((croqBg.edificios&&croqBg.edificios.length)?\"#a8d8c5\":\"#f3c9c9\"); croqCtx.fill(); croqCtx.lineWidth=2; croqCtx.strokeStyle=\"#334155\"; croqCtx.stroke(); var _pol=function(ps,fl,st){ if(!ps) return; for(var a=0;a<ps.length;a++){ var pg=ps[a]; if(!pg||pg.length<3) continue; croqCtx.beginPath(); for(var b=0;b<pg.length;b++){ var s=w2s(pg[b]); if(b===0)croqCtx.moveTo(s[0],s[1]); else croqCtx.lineTo(s[0],s[1]); } croqCtx.closePath(); croqCtx.fillStyle=fl; croqCtx.fill(); croqCtx.lineWidth=1; croqCtx.strokeStyle=st; croqCtx.stroke(); } }; _pol(croqBg.edificios,'#f3c9c9','#b06a6a'); _pol(croqBg.patios,'#bfe0d3','#6a9c8a'); croqCtx.restore(); }\nfunction catEsc(s){ return String(s==null?\"\":s).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\nfunction catPlantaRank(p){ var s=String(p==null?\"\":p).trim().toLowerCase(); if(!s) return 9999; if(s.indexOf(\"sot\")===0||s.indexOf(\"sót\")===0||s.charAt(0)===\"-\"){ var ns=parseInt(s.replace(/[^0-9-]/g,\"\"),10); return isNaN(ns)?-100:ns; } if(s===\"b\"||s===\"bj\"||s===\"pb\"||s.indexOf(\"baj\")===0||s===\"00\"||s===\"0\") return 0; if(s.indexOf(\"atic\")===0||s.indexOf(\"átic\")===0||s===\"at\") return 900; var n=parseInt(s.replace(/[^0-9]/g,\"\"),10); return isNaN(n)?9000:n; }\nfunction catPuertaRank(p){ var s=String(p==null?\"\":p).trim().toUpperCase(); if(!s) return 9999; if(s.length===1&&s>=\"A\"&&s<=\"Z\") return s.charCodeAt(0)-64; var n=parseInt(s.replace(/[^0-9]/g,\"\"),10); if(!isNaN(n)) return 100+n; return 5000; }\nfunction catSort(){ catFilas.sort(function(a,b){ var pa=catPlantaRank(a.planta),pb=catPlantaRank(b.planta); if(pa!==pb) return pa-pb; return catPuertaRank(a.puerta)-catPuertaRank(b.puerta); }); }\nfunction catRender(){ var c=$(\"catlist\"); if(!c) return; catSort(); c.innerHTML=\"\"; catFilas.forEach(function(f,i){ var r=document.createElement(\"div\"); r.className=\"catrowr\"; r.innerHTML='<input class=\"catf\" data-i=\"'+i+'\" data-k=\"planta\" value=\"'+catEsc(f.planta)+'\" placeholder=\"Baja\">'+'<input class=\"catf\" data-i=\"'+i+'\" data-k=\"puerta\" value=\"'+catEsc(f.puerta)+'\" placeholder=\"A\">'+'<input class=\"catf\" data-i=\"'+i+'\" data-k=\"uso\" value=\"'+catEsc(f.uso)+'\" placeholder=\"Residencial\">'+'<input class=\"catf\" data-i=\"'+i+'\" data-k=\"sup\" value=\"'+catEsc(f.sup)+'\" placeholder=\"56\">'+'<input class=\"catf\" data-i=\"'+i+'\" data-k=\"bat\" value=\"'+catEsc(f.bat)+'\" placeholder=\"\">'+'<button type=\"button\" class=\"del catdel\" data-i=\"'+i+'\">×</button>'; c.appendChild(r); }); c.querySelectorAll(\".catf\").forEach(function(el){ el.addEventListener(\"input\",function(e){ var d=e.target.dataset; catFilas[+d.i][d.k]=e.target.value; if(d.k==='bat'&&typeof _proponerBaterias==='function'){ _proponerBaterias(); } }); }); c.querySelectorAll(\".catdel\").forEach(function(b){ b.onclick=function(e){ catFilas.splice(+e.currentTarget.dataset.i,1); catRender(); if(window.plan5GuardarTodo)plan5GuardarTodo(); }; }); }\nfunction croqDrawStroke(st){ if(!croqCtx||!st||!st.pts||!st.pts.length) return; croqCtx.save(); croqCtx.strokeStyle=st.c||\"#111111\"; croqCtx.fillStyle=st.c||\"#111111\"; croqCtx.lineWidth=st.w||3; croqCtx.lineCap=\"round\"; croqCtx.lineJoin=\"round\"; if(st.pts.length===1){ var q=w2s(st.pts[0]); croqCtx.beginPath(); croqCtx.arc(q[0],q[1],(st.w||3)/2,0,Math.PI*2); croqCtx.fill(); } else { croqCtx.beginPath(); for(var i=0;i<st.pts.length;i++){ var p=w2s(st.pts[i]); if(i===0)croqCtx.moveTo(p[0],p[1]); else croqCtx.lineTo(p[0],p[1]); } croqCtx.stroke(); } croqCtx.restore(); } function croqSegHit(a,b,px,py,r2){ var vx=b[0]-a[0],vy=b[1]-a[1],wx=px-a[0],wy=py-a[1],L=vx*vx+vy*vy,t=L>0?((wx*vx+wy*vy)/L):0; if(t<0)t=0; if(t>1)t=1; var cx=a[0]+t*vx,cy=a[1]+t*vy,dx=px-cx,dy=py-cy; return dx*dx+dy*dy<=r2; } function croqEraseAt(wx,wy){ var rad=12/croqView.k,r2=rad*rad,removed=false; for(var i=croqStrokes.length-1;i>=0;i--){ var pts=croqStrokes[i].pts,hit=false; for(var j=0;j<pts.length;j++){ var dx=pts[j][0]-wx,dy=pts[j][1]-wy; if(dx*dx+dy*dy<=r2){ hit=true; break; } if(j>0&&croqSegHit(pts[j-1],pts[j],wx,wy,r2)){ hit=true; break; } } if(hit){ croqStrokes.splice(i,1); removed=true; } } if(removed)croqChanged=true; return removed; } function catRedraw(){ if(!croqCtx||!croqCanvas) return; croqCtx.clearRect(0,0,croqCanvas.width,croqCanvas.height); croqDrawBg(); for(var i=0;i<croqStrokes.length;i++){ croqDrawStroke(croqStrokes[i]); } if(croqCur) croqDrawStroke(croqCur); } function croqResize(){ if(!croqCanvas) return; var w=croqCanvas.clientWidth||600; croqCanvas.width=w; croqCanvas.height=(croqCanvas.clientHeight||240); croqFit(); catRedraw(); } function croqPos(e){ var r=croqCanvas.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }\nfunction catInit(){ croqCanvas=$(\"catcanvas\"); var add=document.querySelector(\".catadd\"); if(add) add.onclick=function(){ catFilas.push({planta:\"\",puerta:\"\",uso:\"\",sup:\"\"}); catRender(); if(window.plan5GuardarTodo)plan5GuardarTodo(); }; var pal=document.querySelector(\".catpal\"); var COLORS=[[\"#dc2626\",\"Rojo\"],[\"#2563eb\",\"Azul\"],[\"#16a34a\",\"Verde\"],[\"#111111\",\"Negro\"],[\"#eab308\",\"Amarillo\"],[\"#ffffff\",\"Blanco\"]]; if(pal){ pal.innerHTML=\"\"; COLORS.forEach(function(co){ var b=document.createElement(\"button\"); b.type=\"button\"; b.className=\"catsw\"+(co[0]===croqColor?\" sel\":\"\"); b.style.background=co[0]; b.title=co[1]; b.onclick=function(){ croqColor=co[0]; pal.querySelectorAll(\".catsw\").forEach(function(x){x.classList.remove(\"sel\");}); b.classList.add(\"sel\"); }; pal.appendChild(b); }); } var clr=document.querySelector(\".catclear\"); if(clr) clr.onclick=function(){ croqStrokes=[]; croqCur=null; catRedraw(); if(window.plan5GuardarTodo)plan5GuardarTodo(); }; var ce=document.querySelector(\".catcenter\"); if(ce) ce.onclick=function(){ croqFit(); catRedraw(); }; function croqStyleBtn(b,on){ b.style.background=on?\"#1f3a8a\":\"#fff\"; b.style.color=on?\"#fff\":\"#0f172a\"; } function croqSelTool(t){ croqTool=t; var L=document.querySelectorAll(\".cattool\"); for(var i=0;i<L.length;i++){ croqStyleBtn(L[i], L[i].getAttribute(\"data-t\")===t); } } function croqSelW(w){ croqW=w; var L=document.querySelectorAll(\".catw\"); for(var i=0;i<L.length;i++){ croqStyleBtn(L[i], (+L[i].getAttribute(\"data-w\"))===w); } } (function(){ var L=document.querySelectorAll(\".cattool\"); for(var i=0;i<L.length;i++){ (function(b){ b.onclick=function(){ croqSelTool(b.getAttribute(\"data-t\")); }; })(L[i]); } var M=document.querySelectorAll(\".catw\"); for(var k=0;k<M.length;k++){ (function(b){ b.onclick=function(){ croqSelW(+b.getAttribute(\"data-w\")); }; })(M[k]); } })(); croqSelTool(\"lapiz\"); croqSelW(croqW); if(croqCanvas){ croqCtx=croqCanvas.getContext(\"2d\"); croqCanvas.addEventListener(\"pointerdown\",function(e){ e.preventDefault(); try{croqCanvas.setPointerCapture(e.pointerId);}catch(_e){} var p=croqPos(e); if(e.pointerType===\"mouse\"&&e.button===2){ croqPan={x:p.x,y:p.y,ox:croqView.ox,oy:croqView.oy}; return; } croqPtrs[e.pointerId]={x:p.x,y:p.y}; if(croqPCount()===2){ croqCur=null; croqGesLock=true; var ids=Object.keys(croqPtrs),a=croqPtrs[ids[0]],b=croqPtrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2; croqGes={ d0:d, k0:croqView.k, wmx:(mx-croqView.ox)/croqView.k, wmy:(my-croqView.oy)/croqView.k }; catRedraw(); return; } if(croqPCount()===1&&!croqGesLock){ var w=s2w(p.x,p.y); if(croqTool===\"goma\"){ croqEraseAt(w[0],w[1]); catRedraw(); } else { croqCur={ c:croqColor, w:croqW, pts:[w] }; croqChanged=true; catRedraw(); } } }); croqCanvas.addEventListener(\"pointermove\",function(e){ var p=croqPos(e); if(croqPan){ croqView.ox=croqPan.ox+(p.x-croqPan.x); croqView.oy=croqPan.oy+(p.y-croqPan.y); catRedraw(); return; } if(!(e.pointerId in croqPtrs)) return; croqPtrs[e.pointerId]={x:p.x,y:p.y}; if(croqGes&&croqPCount()===2){ var ids=Object.keys(croqPtrs),a=croqPtrs[ids[0]],b=croqPtrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nk=croqGes.k0*(d/croqGes.d0); if(nk<0.05)nk=0.05; if(nk>400)nk=400; croqView.k=nk; croqView.ox=mx-croqGes.wmx*nk; croqView.oy=my-croqGes.wmy*nk; catRedraw(); return; } if(croqPCount()===1&&!croqGesLock){ var w=s2w(p.x,p.y); if(croqTool===\"goma\"){ croqEraseAt(w[0],w[1]); catRedraw(); } else if(croqCur){ croqCur.pts.push(w); catRedraw(); } } }); function croqEnd(e){ if(croqPan){ croqPan=null; } if(e.pointerId in croqPtrs) delete croqPtrs[e.pointerId]; try{croqCanvas.releasePointerCapture(e.pointerId);}catch(_e){} if(croqPCount()<2) croqGes=null; if(croqPCount()===0){ croqGesLock=false; if(croqCur){ if(croqCur.pts.length>=1) croqStrokes.push(croqCur); croqCur=null; catRedraw(); } if(croqChanged){ croqChanged=false; if(window.plan5GuardarTodo)plan5GuardarTodo(); } } } croqCanvas.addEventListener(\"pointerup\",croqEnd); croqCanvas.addEventListener(\"pointercancel\",croqEnd); croqCanvas.addEventListener(\"contextmenu\",function(e){ e.preventDefault(); }); croqCanvas.addEventListener(\"wheel\",function(e){ e.preventDefault(); var p=croqPos(e),w=s2w(p.x,p.y),f=Math.exp(-e.deltaY*0.0015),nk=croqView.k*f; if(nk<0.05)nk=0.05; if(nk>400)nk=400; croqView.k=nk; croqView.ox=p.x-w[0]*nk; croqView.oy=p.y-w[1]*nk; catRedraw(); }, {passive:false}); window.addEventListener(\"resize\",croqResize); if(window.ResizeObserver){ try{ new ResizeObserver(function(){ croqResize(); }).observe(croqCanvas); }catch(_e){} } croqResize(); } }\ncatInit(); catRender();\nfunction _catAsignaBat(fs){ function _pn(p){ var s=String(p==null?'':p).trim().toLowerCase(); if(s===''||s==='baja'||s==='bajo'||s==='bj'){ return 0; } var nn=parseInt(s.replace(',','.'),10); return isNaN(nn)?9999:nn; } fs.forEach(function(f){ f.bat=(_pn(f.planta)<4)?'1':'2'; }); return fs; } function _batParse(b){ var s=String(b||'').toUpperCase(); var ti=s.indexOf('T'); if(ti<0){ return null; } var t=parseInt(s.slice(0,ti),10); if(isNaN(t)){ return null; } var rest=s.slice(ti+1), fn=''; for(var _i=0;_i<rest.length;_i++){ var c=rest.charAt(_i); if(c>='0'&&c<='9'){ fn+=c; } else if(fn.length){ break; } } return {s:b,t:t,f:parseInt(fn,10)||0}; } function _batFitTomas(need){ var best=0; (typeof BATERIAS!=='undefined'?BATERIAS:[]).forEach(function(b){ var m=_batParse(b); if(m&&m.t>=need){ if(best===0||m.t<best){ best=m.t; } } }); return best; } function _batModelsOfSize(size){ var out=[]; (typeof BATERIAS!=='undefined'?BATERIAS:[]).forEach(function(b){ var m=_batParse(b); if(m&&m.t===size){ out.push(m); } }); out.sort(function(a,b){ return a.f-b.f; }); return out; } function _batLabel(m,all){ var _md=(typeof _batMed!=='undefined'&&_batMed[m.s])?(' ('+_batMed[m.s]+'m)'):''; if(all.length>1){ var ot=[]; all.forEach(function(x){ if(x.f!==m.f){ ot.push(x.f+'F'); } }); return m.s+_md+' (alternativa '+ot.join('/')+')'; } return m.s+_md; } function _batFillSelect(sel,size,prefer){ if(!sel){ return; } var all=_batModelsOfSize(size); if(!all.length){ return; } var chosen=''; if(prefer){ all.forEach(function(m){ if(m.s===prefer){ chosen=m.s; } }); } if(!chosen){ chosen=all[0].s; } var html=''; all.forEach(function(m){ html+='<option value='+m.s+(m.s===chosen?' selected':'')+'>'+_batLabel(m,all)+'</option>'; }); sel.innerHTML=html; sel.value=chosen; } function _proponerBaterias(){ if(!Array.isArray(catFilas)){ return; } var n1=0,n2=0; catFilas.forEach(function(f){ if(f&&f.bat==='1'){ n1++; } else if(f&&f.bat==='2'){ n2++; } }); if(n1+n2===0){ return; } var nCom=0; ['comPunto1','comPunto2'].forEach(function(id){ var e=$(id); if(e){ if(e.type==='checkbox'){ if(e.checked){ nCom++; } } else { var vv=parseInt(String(e.value||'').replace(',','.'),10); if(!isNaN(vv)){ nCom+=vv; } } } }); var s1=$('cuarto_bat1'); if(s1&&n1>0){ var sz1=_batFitTomas(n1+nCom+1); if(sz1){ var c1=_batParse(s1.value); var keep1=(c1&&c1.t===sz1)?s1.value:''; _batFillSelect(s1,sz1,keep1); } } var s2=$('cuarto_bat2'); if(s2&&n2>0){ var sz2=_batFitTomas(n2); if(sz2){ var c2=_batParse(s2.value); var keep2=(c2&&c2.t===sz2)?s2.value:''; _batFillSelect(s2,sz2,keep2); } } if(typeof recalc==='function'){ try{ recalc(); }catch(_x){} } } function _batRestringir(){ ['cuarto_bat1','cuarto_bat2'].forEach(function(id){ var s=$(id); if(!s){ return; } var m=_batParse(s.value); if(m){ _batFillSelect(s,m.t,s.value); } }); } window.catImport=function(data){ try{ if(!data||!data.ok){ alert((data&&data.error)?data.error:\"No se pudo importar del Catastro.\"); return; } var fs=(data.filas||[]).map(function(x){ return {planta:(x&&x.planta)||\"\",puerta:(x&&x.puerta)||\"\",uso:(x&&x.uso)||\"\",sup:(x&&x.sup)||\"\"}; }); if(!fs.length){ alert(\"El Catastro no devolvio inmuebles para esa direccion.\"); return; } try{ _catAsignaBat(fs); }catch(_e){} catFilas=fs; if(typeof croqSetBg===\"function\")croqSetBg(data.plano); if(typeof catRender===\"function\")catRender(); try{ _proponerBaterias(); }catch(_e){} if(window.plan5GuardarTodo)plan5GuardarTodo(); }catch(e){ alert(\"Error al importar: \"+e.message); } };\n\n// ---- Guardar / precargar contra el Sheet (vía el módulo) ----\nfunction camposEstaticos(){\n  const dyn=[\"vbaja\",\"vresto\",\"vatico\",\"peines\"].map(id=>$(id)).filter(Boolean);\n  const dentro=el=>dyn.some(d=>d.contains(el));\n  return [...document.querySelectorAll(\".page input, .page select\")].filter(el=>!dentro(el)&&el.id!=='de_c41'&&!el.classList.contains('catf'));\n}\nfunction camposEditables(){ return camposEstaticos().filter(function(el){ return !el.readOnly && el.type!==\"hidden\"; }); }\nfunction camposKV(){ var c=camposEditables(), n=0; return c.map(function(el){ return [el.id||('__nid'+(n++)), el]; }); }\nfunction _croqRnd(n){ return Math.round(n*100)/100; } function _croqPerp(p,a,b){ var dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy; if(L===0) return Math.hypot(p[0]-a[0],p[1]-a[1]); var t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L; if(t<0)t=0; if(t>1)t=1; return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy)); } function _croqRDP(pts,eps){ if(!pts || pts.length<3) return pts?pts.slice():[]; var n=pts.length, dmax=0, idx=0; for(var i=1;i<n-1;i++){ var dd=_croqPerp(pts[i],pts[0],pts[n-1]); if(dd>dmax){ dmax=dd; idx=i; } } if(dmax>eps){ return _croqRDP(pts.slice(0,idx+1),eps).slice(0,-1).concat(_croqRDP(pts.slice(idx),eps)); } return [pts[0], pts[n-1]]; } function _croqPack(strokes, bg){ var minx=Infinity, miny=Infinity; var scan=function(arr){ if(arr) for(var i=0;i<arr.length;i++){ var p=arr[i]; if(p&&p.length>=2){ if(p[0]<minx)minx=p[0]; if(p[1]<miny)miny=p[1]; } } }; (strokes||[]).forEach(function(st){ if(st&&st.pts) scan(st.pts); }); if(bg){ scan(bg.world); (bg.edificios||[]).forEach(scan); (bg.patios||[]).forEach(scan); } if(!isFinite(minx)){ minx=0; miny=0; } var bx=Math.floor(minx), by=Math.floor(miny); var T=function(p){ return [_croqRnd(p[0]-bx), _croqRnd(p[1]-by)]; }; var Tp=function(a){ return (a||[]).map(T); }; var Tpoly=function(a){ return (a||[]).map(Tp); }; var s2=(strokes||[]).map(function(st){ return { c:st.c, w:st.w, pts:Tp(_croqRDP(st.pts,0.08)) }; }); var bg2=null; if(bg){ bg2={ world:Tp(bg.world) }; if(bg.edificios) bg2.edificios=Tpoly(bg.edificios); if(bg.patios) bg2.patios=Tpoly(bg.patios); } return { base:[bx,by], strokes:s2, bg:bg2 }; } function _croqUnpack(cr){ if(!cr || !Array.isArray(cr.base)) return cr; var bx=cr.base[0], by=cr.base[1]; var U=function(p){ return [p[0]+bx, p[1]+by]; }; var Up=function(a){ return (a||[]).map(U); }; var Upoly=function(a){ return (a||[]).map(Up); }; var s2=(cr.strokes||[]).map(function(st){ return { c:st.c, w:st.w, pts:Up(st.pts) }; }); var bg2=null; if(cr.bg){ bg2={ world:Up(cr.bg.world) }; if(cr.bg.edificios) bg2.edificios=Upoly(cr.bg.edificios); if(cr.bg.patios) bg2.patios=Upoly(cr.bg.patios); } return { strokes:s2, bg:bg2 }; } function serializar(){\n  var _ns=parseInt(($(\"nsum\")||{}).value,10)||0; var _tp=(($(\"tipoEdif\")||{}).textContent||\"\").trim(); var _lcR=String((($(\"longCon\")||{}).value||\"\")).trim(); var _lc=(_lcR===\"VALIDO\"||_lcR===\"NO EXISTE\")?_lcR:(parseFloat(_lcR.replace(\",\",\".\"))||0); var gv=function(id){var e=$(id);return e?e.value:\"\";}; var pf=function(id){return parseFloat(String(gv(id)).replace(\",\",\".\"))||0;}; var pe=function(id){return parseFloat(String(gv(id)).replace(/\\./g,\"\").replace(\",\",\".\"))||0;}; return { v: camposEditables().map(el=>el.value), vkv: camposKV().map(function(p){ return [p[0], p[1].value]; }), zonas, peines, condiciones: (($(\"f_condiciones\")||{}).value||\"\"), catastro: catFilas, croquis: _croqPack(croqStrokes, croqBg), motor:{ nsum:_ns, pctBenefVenta:(typeof window.__P5_BENEF__==='number'?window.__P5_BENEF__:0.25), tipo:_tp, longCon:_lc, longAli: (gv(\"longAli\")===\"SOLO PIECERIA\"?\"\":pf(\"longAli\")), montaje: (gv(\"longAli\")===\"SOLO PIECERIA\"?\"SOLO PIECERIA\":gv(\"ali_montaje\")), codos: pf(\"ali_codos\"), llaves: pf(\"con_llaves\"), bat1: gv(\"cuarto_bat1\"), bat2: gv(\"cuarto_bat2\"), tipoCuarto: gv(\"cuarto_tipo\"), otrosTiempos: (pf(\"otros_t1\")+pf(\"otros_t2\")), otrosEur: pe(\"otros_eur\"), gpMotAct: gv(\"gp_mot_act\"), gpPotAct: gv(\"gp_pot_act\"), gpCaldAct: gv(\"gp_cald_act\"), gpNdepAct: gv(\"gp_ndep_act\"), gpTdepAct: gv(\"gp_tdep_act\"), gpInstala: gv(\"gpInstala\"), gpPotNew: gv(\"gp_pot_new\"), gpCaldNew: gv(\"gp_cald_new\"), gpNdepNew: pf(\"gp_ndep_new\"), gpTdepNew: gv(\"gp_tdep_new\"), gpUbic: gv(\"gp_ubic\"), gpDias: pf(\"gp_dias\"), gpLongExp: pf(\"gp_longexp\"), plantas: (parseInt(gv(\"plantas\"),10)||0), altura: pf(\"altura\"), peinesHDias: pf(\"peines_h_dias\"), masDeUnaEntrada: pf(\"vivMasEntrada\"), puntosComunidad: ((($(\"comPunto1\")||{}).value?1:0)+(($(\"comPunto2\")||{}).value?1:0)), colActiva: (window.__P5_COL__||'plan5') } };\n}\nfunction hidratar(d){\n  if(!d) return;\n  if(d.condiciones!=null){ var _fc=$(\"f_condiciones\"); if(_fc) _fc.value=d.condiciones; } if(Array.isArray(d.catastro)){ catFilas=d.catastro.map(function(x){return {planta:(x&&x.planta)||\"\",puerta:(x&&x.puerta)||\"\",uso:(x&&x.uso)||\"\",sup:(x&&x.sup)||\"\",bat:(x&&x.bat)||\"\"};}); if(typeof catRender===\"function\")catRender(); } var _cru=_croqUnpack(d.croquis); if(_cru&&Array.isArray(_cru.strokes)){ croqStrokes=_cru.strokes.slice(); } if(_cru&&_cru.bg&&Array.isArray(_cru.bg.world)){ croqBg={ world:_cru.bg.world, edificios:(_cru.bg.edificios||[]), patios:(_cru.bg.patios||[]) }; } if(typeof croqFit===\"function\")croqFit(); if(typeof catRedraw===\"function\")catRedraw();\n  if(d.zonas){ zonas.baja=d.zonas.baja||[]; zonas.resto=d.zonas.resto||[]; zonas.atico=d.zonas.atico||[]; }\n  if(Array.isArray(d.peines)&&d.peines.length){ peines.length=0; d.peines.forEach(p=>peines.push(p)); }\n  renderVivs(); renderPeines();\n  if(Array.isArray(d.vkv)){ var _m={}; d.vkv.forEach(function(p){ if(p&&p[0]!=null) _m[p[0]]=p[1]; }); var _MIG={'__nid0':'ac_ncont','__nid1':'ac_ubic','__nid2':'ac_llave','__nid3':'mab_mat','__nid4':'cc_ubic','__nid5':'otros_t1_esp','__nid6':'otros_t2_esp','__nid7':'otros_eur_esp'}; Object.keys(_MIG).forEach(function(k){ if(Object.prototype.hasOwnProperty.call(_m,k)&&!Object.prototype.hasOwnProperty.call(_m,_MIG[k])) _m[_MIG[k]]=_m[k]; }); camposKV().forEach(function(p){ if(Object.prototype.hasOwnProperty.call(_m,p[0])) p[1].value=_m[p[0]]; }); } else if(Array.isArray(d.v)){ camposEditables().forEach((el,i)=>{ if(i<d.v.length) el.value=d.v[i]; }); }\n  recalc(); if(window.__pzAli)window.__pzAli();\n}\nconst PLAN5_TOKEN = new URLSearchParams(location.search).get(\"token\")||\"\";\n// Guarda TODO el formulario en el Sheet (1 fila por direccion). Devuelve true/false.\nasync function plan5GuardarTodo(){\n  try{\n    const body=new URLSearchParams();\n    var _tv=($(\"f_tipovia\")||{}).value||\"\"; var _dc=($(\"f_direccion\")||{}).value||\"\";\n    body.set(\"direccion\", ((_tv?_tv+\" \":\"\")+_dc).trim());\n    body.set(\"ccpp_id\", window.__PLAN5_VOLVER_ID__||\"\");\n    body.set(\"npresupuesto\", ($(\"f_npresupuesto\")||{}).value||\"\");\n    body.set(\"fecha\", ($(\"f_fecha\")||{}).value||\"\");\n    body.set(\"revision\", ($(\"f_revision\")||{}).value||\"\");\n    body.set(\"payload\", JSON.stringify(serializar()));\n    const r=await fetch(\"/plan5/guardar?token=\"+encodeURIComponent(PLAN5_TOKEN),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n    const j=await r.json().catch(()=>({ok:false}));\n    return !!(j&&j.ok);\n  }catch(e){ return false; }\n}\n// Recuadro verde 5s al guardar OK; rojo permanente al fallo (clases de estilo-visual).\nfunction plan5Flash(el, ok){\n  if(!el) return;\n  if(el._p5t){ clearTimeout(el._p5t); el._p5t=null; }\n  el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n  if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._p5t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._p5t=null; },5000); }\n  else { el.classList.add(\"ptl-guardado-error\"); }\n}\nvar p5hist=[], p5pos=-1; function p5enDinamico(el){ return ['vbaja','vresto','vatico','peines'].some(function(id){ var d=$(id); return d && d.contains(el); }); } function setP5UndoRedo(){ var u=$('undoBtn'), r=$('redoBtn'); if(u)u.disabled=(p5pos<0); if(r)r.disabled=(p5pos>=p5hist.length-1); } async function p5undo(){ if(p5pos<0)return; var e=p5hist[p5pos]; p5pos--; setP5UndoRedo(); if(e.el){ e.el.value=e.prev; e.el.dataset.orig=e.prev; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } async function p5redo(){ if(p5pos>=p5hist.length-1)return; p5pos++; var e=p5hist[p5pos]; setP5UndoRedo(); if(e.el){ e.el.value=e.next; e.el.dataset.orig=e.next; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } (function(){ var _ub=$('undoBtn'); if(_ub)_ub.onclick=p5undo; var _rb=$('redoBtn'); if(_rb)_rb.onclick=p5redo; setP5UndoRedo(); })(); \n  async function plan5OnCambio(el){\n  if(!el || el.readOnly) return;\n  const oldV = el.dataset.orig===undefined ? \"\" : el.dataset.orig;\n  if(el.value===oldV) return;\n  if(!p5enDinamico(el)){ p5hist=p5hist.slice(0,p5pos+1); p5hist.push({el:el, prev:oldV, next:el.value}); p5pos=p5hist.length-1; setP5UndoRedo(); }\n  el.dataset.orig = el.value;\n  const ok = await plan5GuardarTodo();\n  plan5Flash(el, ok); actualizarCuadro();\n}\nconst PAGE = document.querySelector(\".page\");\n// Fija el valor base al entrar en el campo (vale para campos dinámicos también)\nPAGE.addEventListener(\"focusin\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,select,textarea\") && el.dataset.orig===undefined) el.dataset.orig=el.value; });\n// Guardar al salir del campo (inputs) o al cambiar (selects)\nPAGE.addEventListener(\"focusout\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,textarea\")) plan5OnCambio(el); });\nPAGE.addEventListener(\"change\", function(e){ const el=e.target; if(el.matches && el.matches(\"select\")) plan5OnCambio(el); });\n// Cambios estructurales (añadir/borrar viviendas, peines, tramos): guardar también\nPAGE.addEventListener(\"click\", function(e){ const b=e.target.closest && e.target.closest(\"button.add,button.tadd,button.del,button.padd,button.pdel,button.addtramo,button.tdel\"); if(b) setTimeout(function(){plan5GuardarTodo().then(function(){actualizarCuadro();});},0); });\nif(window.__PLAN5_DIR__){ var _fd=$(\"f_direccion\"); if(_fd) _fd.value=window.__PLAN5_DIR__; }\nfunction _fmtTlf(v){ var d=String(v||\"\").replace(/\\D/g,\"\"); return d.length===9 ? d.slice(0,3)+\"-\"+d.slice(3,6)+\"-\"+d.slice(6) : (v||\"\"); }\nif(window.__PLAN5_EXP__){ var _e=window.__PLAN5_EXP__; var _sv=function(id,v){var el=$(id); if(el&&v!=null&&v!==\"\") el.value=v;};\n  _sv(\"f_tipovia\",_e.tipo_via); _sv(\"f_direccion\",_e.direccion_calle); _sv(\"f_poblacion\",_e.poblacion); _sv(\"f_cp\",_e.cp);\n  _sv(\"f_admin\",_e.administrador); _sv(\"f_admintel\",_fmtTlf(_e.tel_administrador)); _sv(\"f_adminemail\",_e.email_administrador);\n  _sv(\"f_presidente\",_e.presidente); _sv(\"f_prestel\",_fmtTlf(_e.tel_presidente)); _sv(\"f_presemail\",_e.email_presidente);\n}\nasync function actualizarCuadro(){try{var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';var dir=((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';var r=await fetch('/plan5/desglose?format=json&dir='+encodeURIComponent(dir)+(PLAN5_TOKEN?'&token='+encodeURIComponent(PLAN5_TOKEN):''));var j=await r.json().catch(function(){return null;});window.__P5_SRVAV=(j&&j.dsg&&j.dsg.avisos)||[];if(typeof avisoViviendas==='function')avisoViviendas();var c=j&&j.cuadro;if(!c)return;var setT=function(id,v){var e=$(id);if(e)e.textContent=v;};var eur=function(n){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'})+' \u20ac';};var pct=function(n){return (n==null||isNaN(n))?'':(Number(n)*100).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};var num=function(n,d){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:(d==null?3:d)});};setT('de_tEjec',num(c.tEjec,1));setT('de_cMat',eur(c.cMat));setT('de_cMo',eur(c.cMo));setT('de_cAlb',eur(c.cAlb));setT('de_cGp',eur(c.cGp));setT('de_cTot',eur(c.cTot));setT('de_bMat',pct(c.bMat));setT('de_bMo',pct(c.bMo));(function(){var e=$('de_c41');window.__P5_BENEF__=(c.c41==null||isNaN(c.c41))?0.25:c.c41;if(e&&document.activeElement!==e)e.value=(c.c41==null||isNaN(c.c41))?'25':(Math.round(c.c41*1000)/10).toString().replace('.',',');})();setT('de_btTrad',eur(c.btTrad));setT('de_totTrad',eur(c.totTrad));setT('de_totTradIva',eur(c.totTradIva));setT('de_hTrad',eur(c.hTrad));setT('de_bP5',eur(c.bP5));setT('de_totP5',eur(c.totP5));setT('de_totP5Iva',eur(c.totP5Iva));setT('de_hP5',eur(c.hP5));setT('de_fin6',eur(c.fin6));setT('de_fin12',eur(c.fin12));setT('de_fin18',eur(c.fin18));setT('de_finCom',c.finCom==null?'Importe no financiable':(eur(c.finCom)+' ('+pct(c.finComPct)+')'));setT('de_subv',eur(c.subv));setT('de_totSubv',eur(c.totSubv));setT('de_comunero',eur(c.comunero));setT('de_pBenTrad',pct(c.totTrad?c.btTrad/c.totTrad:0));setT('de_pBenP5',pct(c.totP5?c.bP5/c.totP5:0));window.__P5_CUADRO__=c;aplicarColumna();}catch(e){}}function aplicarColumna(){var c=window.__P5_CUADRO__;if(!c)return;var col=window.__P5_COL__||'plan5';var trad=(col==='trad');var setT=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};var eur=function(n){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'})+' €';};var pct=function(n){return (n==null||isNaN(n))?'':(Number(n)*100).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};var tit=document.getElementById('tit-subv'),lab=document.getElementById('lab-totsubv');if(tit)tit.textContent=trad?'SIN SUBVENCION EMASESA':'CON SUBVENCION EMASESA';if(lab)lab.textContent=trad?'Total sin subvencion e IVA':'Total con subvencion e IVA';setT('de_subv',eur(trad?0:c.subv));setT('de_totSubv',eur(trad?c.totSubvTrad:c.totSubv));setT('de_comunero',eur(trad?c.comuneroTrad:c.comunero));setT('de_fin6',eur(trad?c.fin6Trad:c.fin6));setT('de_fin12',eur(trad?c.fin12Trad:c.fin12));setT('de_fin18',eur(trad?c.fin18Trad:c.fin18));var fv=trad?c.finComTrad:c.finCom,fp=trad?c.finComPctTrad:c.finComPct;setT('de_finCom',fv==null?'Importe no financiable':(eur(fv)+' ('+pct(fp)+')'));}if(window.__PLAN5_SAVED__) hidratar(window.__PLAN5_SAVED__);try{ _batRestringir(); }catch(_e){} actualizarCuadro();\ndocument.querySelectorAll('input[type=\"number\"]').forEach(inp=>{\n  inp.addEventListener(\"input\",()=>{ if(inp.value===\"0\") inp.value=\"\"; });\n});\ndocument.querySelectorAll(\"input.euro\").forEach(inp=>{\n  inp.addEventListener(\"blur\",()=>{\n    let n=parseFloat(inp.value.replace(/\\./g,\"\").replace(\",\",\".\"));\n    inp.value = isNaN(n) ? \"\" : n.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2});\n  });\n  inp.addEventListener(\"focus\",()=>{ inp.value=inp.value.replace(/\\./g,\"\").replace(\",\",\".\"); });\n});\nfunction fmtLong(inp){ let n=parseFloat(String(inp.value).replace(\",\",\".\")); inp.value = isNaN(n) ? \"\" : n.toFixed(1).replace(\".\",\",\"); inp.dispatchEvent(new Event(\"input\",{bubbles:true})); }\ndocument.addEventListener(\"blur\",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains(\"long\")) fmtLong(e.target); }, true);\n// Desplegable propio de Revision (flecha que funciona en Firefox; deja escribir)\n(function(){\n  var inp=$(\"f_revision\"), arr=$(\"f_revision_arrow\"), lst=$(\"f_revision_list\");\n  if(!inp||!arr||!lst) return;\n  arr.addEventListener(\"click\", function(e){ e.preventDefault(); e.stopPropagation(); lst.hidden=!lst.hidden; });\n  lst.querySelectorAll(\".combo-opt\").forEach(function(o){\n    o.addEventListener(\"click\", function(){ inp.value=o.textContent; lst.hidden=true; inp.dataset.orig=inp.value; plan5GuardarTodo().then(function(ok){ plan5Flash(inp, ok); }); });\n  });\n  document.addEventListener(\"click\", function(e){ if(e.target!==arr && !lst.contains(e.target)) lst.hidden=true; });\n})();\n(function(){var est=(window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.estado)||'abierto';if(est!=='cerrado')return;var pg=document.querySelector('.page');if(pg){var d=document.createElement('div');d.className='avbox';d.style.cssText='margin:8px 0;';var f='';try{var ci=window.__PLAN5_SAVED__.cierre;if(ci&&ci.fecha){var dt=new Date(ci.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+'. Edicion bloqueada. Pulsa el candado para abrirlo.';var bar=pg.querySelector('.p5bar');if(bar&&bar.nextSibling)pg.insertBefore(d,bar.nextSibling);else pg.insertBefore(d,pg.firstChild);}document.querySelectorAll('.page input, .page select, .page textarea, .page button.add, .page button.del, .page button.padd, .page button.pdel, .page button.tadd, .page button.addtramo, .page button.tdel, .page button.combo-arrow, .page .cattool, .page .catw, .page .catcenter, .page .catclear, .page .catadd, .page .catdel, .page .catsw, .page canvas').forEach(function(el){if(el.id==='undoBtn'||el.id==='redoBtn'||el.id==='menuBtn'||el.id==='cerrarBtn')return;el.disabled=true;el.style.pointerEvents='none';});})();(function(){var SV=window.__PLAN5_SAVED__||null;var ESTADO=(SV&&SV.estado)||'abierto';var bar=document.querySelector('.p5bar');var rel=bar?bar.querySelector('.hdr-reload'):null;var btn=document.createElement('button');btn.type='button';btn.className='menu-btn';btn.id='cerrarBtn';btn.style.borderWidth='1px';btn.style.borderStyle='solid';if(bar){if(rel)bar.insertBefore(btn,rel);else bar.appendChild(btn);}var TK=PLAN5_TOKEN||'';function DIRv(){var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';return((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';}function pintaBtn(){if(ESTADO==='cerrado'){btn.textContent='\uD83D\uDD12';btn.style.color='#dc2626';btn.style.borderColor='#dc2626';btn.style.background='#fef2f2';btn.title='Presupuesto cerrado - pulsa para abrir';}else{btn.textContent='\uD83D\uDD13';btn.style.color='#16a34a';btn.style.borderColor='#16a34a';btn.style.background='#f0fdf4';btn.title='Presupuesto abierto - pulsa para cerrar';}}async function postAbrir(modo){btn.disabled=true;try{var body=new URLSearchParams();body.set('dir',DIRv());body.set('modo',modo);var r=await fetch('/plan5/abrir'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo abrir'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}function dialogoAbrir(){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';var bx=document.createElement('div');bx.style.cssText='background:#fff;color:#111;max-width:440px;width:90%;border-radius:10px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);';var t=document.createElement('div');t.textContent='Abrir presupuesto';t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px;';bx.appendChild(t);var sub=document.createElement('div');sub.textContent='Elige como abrirlo:';sub.style.cssText='color:#555;font-size:13px;margin-bottom:12px;';bx.appendChild(sub);function opt(tit,desc,modo){var b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;cursor:pointer;';var h=document.createElement('div');h.textContent=tit;h.style.cssText='font-weight:700;color:#111;font-size:13px;';b.appendChild(h);var dd=document.createElement('div');dd.textContent=desc;dd.style.cssText='color:#666;font-size:12px;margin-top:2px;';b.appendChild(dd);b.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);postAbrir(modo);};bx.appendChild(b);}opt('Actualizar todo (formulas, cantidades y precios)','Recalcula todo y descarta los ajustes manuales de cantidad y precio.','full');opt('Actualizar solo precios','Mantiene las cantidades de la foto y refresca los precios.','precios');opt('Editar a mano','Deja la foto tal cual y la desbloquea.','manual');var cc=document.createElement('button');cc.type='button';cc.textContent='Cancelar';cc.style.cssText='display:block;width:100%;border:none;background:none;color:#666;padding:6px;cursor:pointer;font-size:13px;';cc.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);};bx.appendChild(cc);ov.appendChild(bx);ov.onclick=function(e){if(e.target===ov&&ov.parentNode)document.body.removeChild(ov);};document.body.appendChild(ov);}async function cerrarFlow(){if(!confirm('Cerrar el presupuesto? Se congelara una foto (desglose y cuadro economico) y quedara bloqueado para editar.'))return;btn.disabled=true;try{var dir=DIRv();try{ if(window.plan5GuardarTodo) await window.plan5GuardarTodo(); }catch(_e){}var url='/plan5/desglose?format=json'+(dir?'&dir='+encodeURIComponent(dir):'')+(TK?'&token='+encodeURIComponent(TK):'');var rf=await fetch(url);var jf=await rf.json().catch(function(){return null;});if(!jf||!jf.dsg){alert('No hay desglose que cerrar todavia. Rellena la toma de datos.');btn.disabled=false;return;}var body=new URLSearchParams();body.set('dir',dir);body.set('snapshot',JSON.stringify({dsg:jf.dsg,cuadro:jf.cuadro||null}));var r=await fetch('/plan5/cerrar'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo cerrar'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}btn.addEventListener('click',function(){if(ESTADO==='cerrado'){dialogoAbrir();return;}cerrarFlow();});pintaBtn();})();(function(){var e=document.getElementById('de_c41');if(!e)return;if(!e.value){e.value='25';window.__P5_BENEF__=0.25;}function leer(){var v=parseFloat(String(e.value||'').replace(',','.'));window.__P5_BENEF__=isNaN(v)?0.25:v/100;}e.addEventListener('change',function(){leer();if(typeof plan5GuardarTodo==='function'){plan5GuardarTodo().then(function(ok){if(typeof plan5Flash==='function')plan5Flash(e,ok);if(typeof actualizarCuadro==='function')actualizarCuadro();});}});e.addEventListener('keydown',function(ev){if(ev.key==='Enter')e.blur();});})();(function(){var SV=window.__PLAN5_SAVED__||null;var col=(SV&&SV.motor&&SV.motor.colActiva)||'plan5';window.__P5_COL__=col;var tit=document.querySelectorAll('.colsel');var cols={};tit.forEach(function(t){var c=t.parentElement;if(!c)return;c.style.border='1px solid transparent';c.style.borderRadius='10px';c.style.padding='4px';cols[t.getAttribute('data-col')]=c;t.style.cursor='pointer';t.style.userSelect='none';t.title='Clic para usar esta columna en el expediente';t.addEventListener('click',function(){window.__P5_COL__=t.getAttribute('data-col');pinta();if(typeof aplicarColumna==='function')aplicarColumna();if(typeof plan5GuardarTodo==='function')plan5GuardarTodo();});});function pinta(){Object.keys(cols).forEach(function(k){cols[k].style.borderColor=(k===window.__P5_COL__)?'var(--ptl-general-2)':'transparent';});}pinta();if(typeof aplicarColumna==='function')aplicarColumna();})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

// Pantalla de la tabla de PRECIOS (editable, fuente del motor). Incrustada igual.

const DESGLOSE_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 · MEDICIONES</title>\n<style>\n  .page{max-width:1100px}\n  .card{padding:6px}\n  .p5icon{background:none;border:1px solid var(--ptl-general-2);border-radius:6px;width:30px;height:30px;font-size:15px;line-height:1;cursor:pointer;color:var(--ptl-titulo);margin-left:4px}\n  .p5icon:disabled{opacity:.35;cursor:default}\n  table.dsg{width:100%;border-collapse:collapse}\n  table.dsg thead th{position:sticky;top:52px;z-index:80;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;font-size:10px;letter-spacing:.4px;text-align:left;padding:4px 4px;border-bottom:1px solid var(--ptl-general-2)}\n  table.dsg th.num,table.dsg td.num{text-align:right}\n  table.dsg td{padding:1px 4px;border-bottom:1px solid var(--ptl-general-2);font-size:11px}\n  table.dsg tr.cap td{background:var(--ptl-general-2);color:var(--ptl-titulo);text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:.4px}\n  table.dsg tr.tot td{font-weight:700;color:var(--ptl-titulo)}\n  table.dsg th.ud,table.dsg td.ud{width:26px}\n  table.dsg td.con{width:auto}\n  table.dsg th.dato,table.dsg td.dato{width:38px;text-align:right}\n  table.dsg td.dato input.cell{text-align:right;height:22px;width:24px;font-size:9px;padding:0 1px}\n  table.dsg th.cant,table.dsg td.cant{width:48px}\n  table.dsg th.var,table.dsg td.var{width:72px;font-size:10px;text-align:right}\n  table.dsg th.pre,table.dsg td.pre{width:54px}\n  table.dsg th.par,table.dsg td.par{width:46px}\n  table.dsg th.cap,table.dsg td.cap{width:176px;font-size:10px;color:var(--ptl-general-4)}\n  .dsg-empty{color:var(--ptl-general-4);font-style:italic;padding:14px 8px}\n  table.dsg td.dato{white-space:nowrap}\n  table.dsg td.dato.tramos{width:auto}\n  table.dsg td.dato.texto{width:auto;text-align:right;color:var(--ptl-titulo);font-size:10px}\n  .dunit{color:var(--ptl-general-4);font-size:10px;margin-left:4px}\n  input.dnum{width:32px;text-align:right;height:20px;font-size:9px;padding:0 1px}\n  .trow{display:inline-flex;align-items:center;gap:3px;flex-wrap:nowrap}\n  .tarr{color:var(--ptl-general-4);font-size:10px}\n  .ttope{color:var(--ptl-general-4);font-size:10px;white-space:nowrap}\n  input.dnum.aplica{color:#166534;font-weight:700;background:#bbf7d0;border:1px solid #16a34a}\n  input.dnum.dover{background:#fff7ed;border:1px solid #f59e0b;color:#b45309;font-weight:700}\n  .avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:0 0 8px;font-size:11px}\n  input.qcell,input.pcell{width:46px;text-align:right;height:20px;font-size:10px;padding:0 1px;border:1px solid transparent;background:transparent;color:inherit}\n  input.qcell:focus,input.pcell:focus{border-color:var(--ptl-general-2);background:#fff}\n  input.qcell.qover,input.pcell.pover{background:#fff7ed;border-color:#f59e0b;color:#b45309;font-weight:700}\n</style>\n</head>\n<body>\n<script>window.__DESGLOSE__=null;window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"desglose\";/*__DESGLOSE_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div id=\"avisos\"></div>\n  <div class=\"card\">\n    <table class=\"dsg\">\n      <thead><tr>\n        <th class=\"con\">Concepto</th>\n        <th class=\"dato num\">Dato</th>\n        <th class=\"cant num\">Cantidad</th>\n        <th class=\"ud\">Ud</th>\n        <th class=\"var\">Detalle</th>\n        <th class=\"pre num\">Precio</th>\n        <th class=\"par num\">Total</th>\n      </tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DSG=window.__DESGLOSE__||null;\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  var DIR=window.__PLAN5_DIR__||\"\";\n  var hist=[], hpos=-1;\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function fmt(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return x.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:\"always\"}); }\n  function numED(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return (Math.round(x*1000)/1000).toString().replace(\".\",\",\"); } function numH(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return x.toFixed(2).replace(\".\",\",\"); }\n  function fmtm(m){ if(m==null||m===\"\")return\"\"; var x=Number(m); if(isNaN(x))return esc(m); return (Math.round(x*100)/100).toString().replace(\".\",\",\")+\" m\"; }\n  function datoCell(l){\n    if(!l.dato) return '<td class=\"dato\"></td>';\n    if(l.dato.tipo===\"texto\"){ return '<td class=\"dato texto\">'+esc(l.dato.texto||\"\")+'</td>'; }\n    if(l.dato.tipo===\"tramos\"){\n      var t=l.dato.tramos||[]; var p=[];\n      p.push('<span class=\"ttope\">'+fmtm(t.length?t[0].lo:0)+'</span>');\n      for(var i=0;i<t.length;i++){\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<input class=\"cell dnum datocell'+(t[i].aplica?' aplica':'')+(t[i].over?' dover':'')+'\" data-ovkey=\"'+esc(t[i].ovkey||'')+'\" value=\"'+esc(numH(l.dato.mul?t[i].dias*l.dato.mul:t[i].dias))+'\" data-orig=\"'+esc(numH(l.dato.mul?t[i].dias*l.dato.mul:t[i].dias))+'\"'+(l.dato.mul?' data-mul=\"'+l.dato.mul+'\"':'')+'>');\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<span class=\"ttope\">'+fmtm(t[i].hi)+'</span>');\n      }\n      return '<td class=\"dato tramos\"><span class=\"trow\">'+p.join(\"\")+'</span><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n    }\n    var _hh=(String(l.dato.unidad||\"\").indexOf(\"horas\")>=0);var _dn=(l.dato.mul?((+l.dato.valor||0)*l.dato.mul):(+l.dato.valor||0));var _dval=(_hh?numH(_dn):(l.dato.mul?numED((+l.dato.valor||0)*l.dato.mul):numED(l.dato.valor))); var _dmul=(l.dato.mul?' data-mul=\"'+l.dato.mul+'\"':''); if(l.dato.antes||l.dato.despues){ return '<td class=\"dato texto\">'+(l.dato.antes?'<span class=\"dunit\">'+esc(l.dato.antes)+'</span>':'')+'<input class=\"cell dnum datocell'+(l.dato.over?' dover':'')+'\" data-ovkey=\"'+esc(l.dato.ovkey||'')+'\" value=\"'+esc(_dval)+'\" data-orig=\"'+esc(_dval)+'\"'+_dmul+'>'+(l.dato.despues?'<span class=\"dunit\">'+esc(l.dato.despues)+'</span>':'')+'</td>'; } return '<td class=\"dato\"><input class=\"cell dnum datocell'+(l.dato.over?' dover':'')+'\" data-ovkey=\"'+esc(l.dato.ovkey||'')+'\" value=\"'+esc(_dval)+'\" data-orig=\"'+esc(_dval)+'\"'+_dmul+'><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n  }\n  function render(dsg){\n    DSG=dsg;\n    var av=$(\"avisos\"); if(av){ av.innerHTML=\"\"; }\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    if(!dsg||!dsg.lineas||!dsg.lineas.length){\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML='<td class=\"dsg-empty\" colspan=\"7\">El motor de calculo aun no esta conectado. Rellena viviendas y longitud en Toma de datos.</td>';\n      tb.appendChild(tr); return;\n    }\n    dsg.lineas.forEach(function(l){\n      var tr=document.createElement(\"tr\");\n      if(l.tipo_fila===\"capitulo\"){ tr.className=\"cap\"; tr.innerHTML='<td colspan=\"7\">'+esc(l.concepto)+'</td>'; }\n      else if(l.tipo_fila===\"total\"){ tr.className=\"tot\"; tr.innerHTML='<td>'+esc(l.concepto)+'</td><td></td><td></td><td></td><td></td><td></td><td class=\"par num\">'+fmt(l.parcial)+'</td>'; }\n      else {\n        tr.innerHTML='<td class=\"con\" title=\"'+esc(l.capitulo_presupuesto||\"\")+'\">'+esc(l.concepto)+'</td>'+\n          datoCell(l)+\n          '<td class=\"cant num\">'+(l.ovkey?('<input class=\"cell qcell'+(l.over?' qover':'')+'\" data-ovkey=\"'+esc(l.ovkey)+'\" data-orig=\"'+esc(numED(l.cantidad))+'\" data-disp=\"'+esc(fmt(l.cantidad))+'\" value=\"'+esc(fmt(l.cantidad))+'\">'):fmt(l.cantidad))+'</td>'+\n          '<td class=\"ud\">'+esc(l.ud||\"\")+'</td>'+\n          '<td class=\"var\">'+esc(l.variante||\"\")+'</td>'+\n          '<td class=\"pre num\">'+(l.ovkey?('<input class=\"cell pcell'+(l.overP?' pover':'')+'\" data-ovkey=\"'+esc(l.ovkey)+'\" data-orig=\"'+esc(numED(l.precio))+'\" data-disp=\"'+esc(fmt(l.precio))+'\" value=\"'+esc(fmt(l.precio))+'\">'):fmt(l.precio))+'</td>'+\n          '<td class=\"par num\">'+fmt(l.parcial)+'</td>';\n      }\n      tb.appendChild(tr);\n    });\n  }\n  render(DSG);\n\n  // ---- Edicion: guarda el dato en el Sheet, el servidor recalcula todo y se repinta (verde/rojo) ----\n  function flash(el,ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  function findInput(row){ return document.querySelector('#tb input.datocell[data-ovkey=\"'+row+'\"]'); }\n  function setUndoRedo(){ var u=$(\"undoBtn\"),r=$(\"redoBtn\"); if(u)u.disabled=(hpos<0); if(r)r.disabled=(hpos>=hist.length-1); }\n  async function guardarDato(row,valor){\n    try{\n      var body=new URLSearchParams(); body.set(\"dir\",DIR); body.set(\"ovkey\",row); body.set(\"valor\",valor);\n      var r=await fetch(\"/plan5/mediciones/dato-override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      return !!(j&&j.ok);\n    }catch(e){ return false; }\n  }\n  async function refetch(){\n    try{\n      var url=\"/plan5/desglose?format=json\"+(DIR?\"&dir=\"+encodeURIComponent(DIR):\"\")+(TOKEN?\"&token=\"+encodeURIComponent(TOKEN):\"\");\n      var r=await fetch(url);\n      var j=await r.json().catch(function(){return null;});\n      if(j&&typeof j.dsg!==\"undefined\"){ render(j.dsg); return true; }\n    }catch(e){}\n    return false;\n  }\n  // guarda un valor en una fila, recalcula y marca verde/rojo en esa fila\n  async function commit(row,valor){\n    var sok=await guardarDato(row,valor);\n    var rok=await refetch();\n    flash(findInput(row), sok&&rok);\n    return sok&&rok;\n  }\n  function onEdit(inp){\n    var prev=inp.getAttribute(\"data-orig\"); if(prev==null)prev=\"\";\n    var next=inp.value;\n    if(next===prev)return;\n    var _mul=+inp.getAttribute(\"data-mul\")||0; var _real=function(x){ if(!_mul)return x; var n=parseFloat(String(x).replace(\",\",\".\")); return isNaN(n)?x:String(n/_mul).replace(\".\",\",\"); };\n    hist=hist.slice(0,hpos+1); hist.push({row:inp.getAttribute(\"data-ovkey\"),prev:_real(prev),next:_real(next)}); hpos=hist.length-1; setUndoRedo();\n    commit(inp.getAttribute(\"data-ovkey\"),_real(next));\n  }\n  async function undo(){ if(hpos<0)return; var e=hist[hpos]; hpos--; setUndoRedo(); await commit(e.row,e.prev); }\n  async function redo(){ if(hpos>=hist.length-1)return; hpos++; var e=hist[hpos]; setUndoRedo(); await commit(e.row,e.next); }\n  function findQ(k){return document.querySelector('#tb input.qcell[data-ovkey=\"'+(window.CSS&&CSS.escape?CSS.escape(k):k)+'\"]');}\n  async function saveOverride(k,v){try{var body=new URLSearchParams();body.set(\"dir\",DIR);body.set(\"ovkey\",k);body.set(\"valor\",v);var r=await fetch(\"/plan5/mediciones/override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});return !!(j&&j.ok);}catch(e){return false;}}\n  async function commitQty(k,v){var sok=await saveOverride(k,v);var rok=await refetch();flash(findQ(k),sok&&rok);return sok&&rok;}\n  function onFocusQty(el){if(el.getAttribute(\"data-disp\")==null)el.setAttribute(\"data-disp\",el.value);el.value=el.getAttribute(\"data-orig\")||\"\";}\n  function onEditQty(el){var prev=el.getAttribute(\"data-orig\");if(prev==null)prev=\"\";var next=el.value.trim();if(next===prev){el.value=el.getAttribute(\"data-disp\")||el.value;return;}commitQty(el.getAttribute(\"data-ovkey\"),next);}\n  function findP(k){return document.querySelector('#tb input.pcell[data-ovkey=\"'+(window.CSS&&CSS.escape?CSS.escape(k):k)+'\"]');}\n  async function saveOverridePrecio(k,v){try{var body=new URLSearchParams();body.set(\"dir\",DIR);body.set(\"ovkey\",k);body.set(\"valor\",v);var r=await fetch(\"/plan5/mediciones/precio-override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});return !!(j&&j.ok);}catch(e){return false;}}\n  async function commitPrecio(k,v){var sok=await saveOverridePrecio(k,v);var rok=await refetch();flash(findP(k),sok&&rok);return sok&&rok;}\n  function onFocusPrecio(el){if(el.getAttribute(\"data-disp\")==null)el.setAttribute(\"data-disp\",el.value);el.value=el.getAttribute(\"data-orig\")||\"\";}\n  function onEditPrecio(el){var prev=el.getAttribute(\"data-orig\");if(prev==null)prev=\"\";var next=el.value.trim();if(next===prev){el.value=el.getAttribute(\"data-disp\")||el.value;return;}commitPrecio(el.getAttribute(\"data-ovkey\"),next);}\n  var tb=$(\"tb\");\n  tb.addEventListener(\"focusin\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"qcell\")) onFocusQty(el); else if(el.classList&&el.classList.contains(\"pcell\")) onFocusPrecio(el); });\n  tb.addEventListener(\"focusout\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"datocell\")) onEdit(el); else if(el.classList&&el.classList.contains(\"qcell\")) onEditQty(el); else if(el.classList&&el.classList.contains(\"pcell\")) onEditPrecio(el); });\n  tb.addEventListener(\"keydown\",function(e){ if(e.key===\"Enter\"&&e.target.classList&&(e.target.classList.contains(\"datocell\")||e.target.classList.contains(\"qcell\")||e.target.classList.contains(\"pcell\"))) e.target.blur(); });\n  var ub=$(\"undoBtn\"); if(ub) ub.onclick=undo;\n  var rb=$(\"redoBtn\"); if(rb) rb.onclick=redo;\n  setUndoRedo();\n(function(){var ESTADO=(window.__PLAN5_ESTADO__||'abierto'),CIERRE=window.__PLAN5_CIERRE__||null;if(ESTADO!=='cerrado')return;var av=$('avisos');if(av){var d=document.createElement('div');d.className='avbox';var f='';try{if(CIERRE&&CIERRE.fecha){var dt=new Date(CIERRE.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+'. Edicion bloqueada (abrelo desde Toma de datos).';av.insertBefore(d,av.firstChild);}document.querySelectorAll('#tb input.qcell, #tb input.pcell, #tb input.datocell').forEach(function(el){el.disabled=true;});})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

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
    // Subvención EMASESA (Analisis N54-N57): €/vivienda
    subvencionBase: 160,
    subvencionGrupoPresion: 52,
    subvencionMasDeUnaEntrada: 120,
    subvencionProyecto: 4,
    // Derechos COMPLETOS de contratación (sin Plan 5) por calibre de contador €/ud (Analisis K81-K83)
    derechosContratacion: { 13: 148.615, 15: 148.615, 20: 207.691 },
    ccComunidad: 60.007,        // cuota de contratación de comunidad (Analisis K84)
    fianzaComunidad: 88.608,    // fianza de comunidad (Analisis K85)
    // Subvención de cuotas+fianzas que aporta Plan 5 (Analisis K90/K93 ...): €/contador
    cuotaContratacion: { 13: 60.007, 15: 60.007, 20: 91.782 },  // C.C. por calibre
    fianza:            { 13: 88.608, 15: 88.608, 20: 115.909 }, // fianza por calibre
    // Residuo que el comunero paga en Plan 5 (Tarifas!K4 cuota, K16 fianza)
    planCincoCuota: 0,
    planCincoFianza: 3.01,
    // Acometidas: importe SIN IVA por diámetro del TUBO DE CONEXIÓN propuesto (B112 -> acometida)
    // (Tarifas A28-A34 / B28-B34). 25->Ø20, 32->Ø25, 40->Ø30, 50->Ø40, 63->Ø50, 75->Ø65, 90->Ø80
    acometidas: { 25: 557.888, 32: 697.36, 40: 836.832, 50: 1115.776, 63: 1394.72, 75: 1813.136, 90: 2231.552 },
    // Financiación: cuota mensual (PMT) sobre el importe por comunero. TAE nominal por plazo (C49-C51).
    financiacion: [{ meses: 6, tae: 8.312 }, { meses: 12, tae: 8.037 }, { meses: 18, tae: 7.708 }],
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
    tiempo:   [ { hasta: 1.5, dias: 0.25 }, { hasta: 4, dias: 0.375 }, { hasta: 10, dias: 1 }, { hasta: 20, dias: 2 } ], // topes 1,5/4/10/20
    umbralDiam: { mas10: 6, mas20: 14 },
    pasante: 40,
  },
  cuarto: { pctAccesorios: 0.1, diasDesmontaje: 0.25 },
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
  "2.1 Armario batería de obra (puertas hierro)", "2.2 Punto de luz", "2.3 Sumidero de agua",
  "2.4 Regolas y taladros", "2.5 Techos falsos escayola y formación vigas falsas",
  "3.1 Grupo de presión", "3.2 Tubería de alimentación",
  "3.3 By-pass + llaves + v.antiretorno + p.material", "3.4 Depósito",
  "4.1 Forrado montantes con coquilla", "4.2 Canaleta protección chapa",
];

// Convierte las filas de la pestaña `plan5_mediciones` (capitulo,concepto,tipo_coste,
// capitulo_presupuesto,parametro,valor,unidad) en:
//   obra  -> parámetros que consume el motor (factores, tramos de días, umbrales)
//   meta  -> por línea (capitulo|concepto): tipo_coste y capitulo_presupuesto, para pintar/desplegable
//   order -> orden de aparición de las líneas (= orden del oro)
function parseMediciones(values, ovDato) {
  const num = v => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const meta = {}, param = {}, order = [], rowOf = {}, keyOf = {}, lineas = [];
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
    if (p) { param[key][p] = num(row[5]); rowOf[key + "|" + p] = i + 1; keyOf[i + 1] = key + "|" + p; }
  }
  var _bFC = {}; (function(){ var _kf = "TUBO DE CONEXION|Fontanero (tubo conexión)"; ["Tramo 1 · días","Tramo 2 · días","Tramo 3 · días","Tramo 4 · días"].forEach(function(pp){ _bFC[pp] = (param[_kf] ? param[_kf][pp] : undefined); }); })();
  if (ovDato) { for (var _ok in ovDato) { if (!Object.prototype.hasOwnProperty.call(ovDato, _ok)) continue; var _lb = _ok.lastIndexOf("|"); if (_lb < 0) continue; var _ck = _ok.slice(0, _lb), _pp = _ok.slice(_lb + 1); if (!param[_ck]) param[_ck] = {}; param[_ck][_pp] = num(ovDato[_ok]); } }
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
      { hasta: 10,  dias: fb(g("Fontanero (tubo conexión)", "Tramo 3 · días"), 1) },
      { hasta: 20,  dias: fb(g("Fontanero (tubo conexión)", "Tramo 4 · días"), 2) },
    ],
    tiempoAlb: [   // Albanil: independiente; por defecto = dias de Fontanero, override por obra aparte
      { hasta: 1.5, dias: fb(g("Albañil (tubo conexión)", "Tramo 1 · días"), fb(_bFC["Tramo 1 · días"], 0.25)) },
      { hasta: 4,   dias: fb(g("Albañil (tubo conexión)", "Tramo 2 · días"), fb(_bFC["Tramo 2 · días"], 0.375)) },
      { hasta: 10,  dias: fb(g("Albañil (tubo conexión)", "Tramo 3 · días"), fb(_bFC["Tramo 3 · días"], 1)) },
      { hasta: 20,  dias: fb(g("Albañil (tubo conexión)", "Tramo 4 · días"), fb(_bFC["Tramo 4 · días"], 2)) },
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
  const gcu = (con, p) => { const k = "CUARTO DE CONTADORES|" + con; return param[k] ? param[k][p] : undefined; };
  obra.cuarto = {
    pctAccesorios:  fb(gcu("Accesorios, pequeño material y comprobación", "Factor sobre material (bat+llaves+flexo)"), 0.1),
    diasDesmontaje: fb(gcu("Fontanero (desmontaje contador + conexión)", "días"), 0.25),
  };
  const gm = (con, p) => { const k = "MONTANTES|" + con; return param[k] ? param[k][p] : undefined; };
  obra.montantes = {
    merma:  fb(gm("Tubo distribución (PERT)", "Merma (×)"), 0.1),
    sujSp:  fb(gm("Sujección tuberías (PERT)", "Una cada (m)"), 2),
    guia:   fb(gm("Guia de sujección tuberías", "ml por sujección"), 0.04),
    torn:   fb(gm("Tornillo + taco", "ud por sujección"), 0.3),
    fviga:  fb(gm("PEINE H (f.viga + pintado)", "Unidades por metro"), 1),
    ftDiv:  fb(gm("PEINE H (f.techo + agujero + tapado + pintado 50x50cm)", "Metros por agujero"), 2),
    albTG:  fb(gm("Albañil (PEINE H - f.techo agujero + tapado + pintado)", "Días por agujero"), 0.03),
    albLad: fb(gm("Albañil (PEINE H -b.ladrillo)", "Días por metro"), 0.1),
    vintF:  fb(gm("Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)", "Días por vivienda"), 4.5/8),
    chA:    fb(gm("Chapa para canaleta (aluminio)", "Factor tubo"), 0.05),
    chB:    fb(gm("Chapa para canaleta (aluminio)", "Factor peine"), 0.2),
    chDiv:  fb(gm("Chapa para canaleta (aluminio)", "Metros por chapa"), 2),
    fontCh: fb(gm("Fontanero (doblado chapa canaleta)", "Días por chapa"), 1/2/8),
    dEXT:   fb(gm("Fontanero (ENGANCHE - exterior)", "Días por vivienda"), 1/8),
    dFac:   fb(gm("Fontanero (ENGANCHE - interior fácil)", "Días por vivienda"), 1/8),
    dMed:   fb(gm("Fontanero (ENGANCHE - interior medio)", "Días por vivienda"), 2/8),
    dDif:   fb(gm("Fontanero (ENGANCHE - interior difícil)", "Días por vivienda"), 4/8),
    vextC1: fb(gm("Fontanero (PEINE V-EXT -1)", "Corte 1 · hasta (m)"), 125.99),
    vextD1: fb(gm("Fontanero (PEINE V-EXT -1)", "Corte 1 · días"), 2),
    vextC2: fb(gm("Fontanero (PEINE V-EXT -1)", "Corte 2 · hasta (m)"), 126),
    vextD2: fb(gm("Fontanero (PEINE V-EXT -1)", "Corte 2 · días"), 3),
  };
  return { obra, meta, order, rowOf, keyOf, lineas };
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
  var fallback = "";   // ud de cualquier fila del mismo concepto (respaldo)
  for (const p of (precios || [])) {
    if (p.concepto !== concepto) continue;
    if (!fallback && p.ud != null && String(p.ud).trim() !== "") fallback = String(p.ud);
    const tRaw = (p.tipo == null ? "" : String(p.tipo)).trim();
    let match = (tRaw === vStr);
    if (!match && pureNum) { const tNum = parseFloat(tRaw.replace(",", ".")); match = !isNaN(tNum) && tNum === vNum; }
    if (match) return (p.ud == null ? "" : String(p.ud));
  }
  return fallback;   // sin coincidencia exacta por detalle -> ud del concepto
}
function calcConexion(nsum, tipo, longCon, precios, obra) {
  const O = (obra && obra.conexion) || OBRA_DEFAULT.conexion;
  const anulaCon = (longCon === "VALIDO" || longCon === "NO EXISTE");
  const lc = anulaCon ? 0 : (+longCon || 0);
  const diam = diametroConexion(nsum, tipo, lc);
  const pasante = (diam == null) ? null : pasanteConexion(diam);
  const termTxt = (diam == null) ? "" : (TERMINAL_TXT[diam] || "");
  const diasF = anulaCon ? 0 : diasPorTramo(O.tiempo, lc);
  const diasA = anulaCon ? 0 : diasPorTramo(O.tiempoAlb || O.tiempo, lc);      // fontanero = albañil (misma tabla, 1 columna)
  const fc = O.factores;
  const r = x => Math.round(x);

  const L = [];
  const add = (concepto, variante, cantidad, tipoCoste, capitulo) =>
    L.push({ concepto, variante, cantidad, precio: precioDe(precios, concepto, variante), tipoCoste, capitulo });

  add("Tubo conexión (PE)",        diam,            (anulaCon ? 0 : lc),                "MAT", "1.1.1 Tubo de conexión");
  add("Tubo pasante (PVC)",        pasante,         1,                      "MAT", "1.1.2 Tubo pasante");
  add("Terminal fitting",          termTxt,         2,                      "MAT", "1.1.3 Accesorios y pequeño material");
  add("Codo fitting",              diam,            2,                      "MAT", "1.1.3 Accesorios y pequeño material");
  add("Saco mortero",              "ud",            r(fc.saco_mortero * lc), "ALB", "2.4 Regolas y taladros");
  add("Saco arena",                "ud",            r(fc.saco_arena   * lc), "ALB", "2.4 Regolas y taladros");
  add("Losa",                      "ud",            r(fc.losa         * lc), "ALB", "2.4 Regolas y taladros");
  add("Fontanero (tubo conexión)", "cuadrilla x2", (diasF == null ? 0 : diasF), "MO", "1.6.1 Mano de obra");
  add("Albañil (tubo conexión)",   "cuadrilla x2", (diasA == null ? 0 : diasA), "MO", "2.4 Regolas y taladros");

  let total = 0;
  for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  const avisos = [];
  if (diam === 110) avisos.push("La acometida sale Ø110 mm: no hay precio de \"Codo fitting\" para ese diámetro (saldrá a 0).");
  return { diam, pasante, dias: diasF, error: (diasF == null || diasA == null), lineas: L, total: +total.toFixed(2), avisos: avisos };
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

    costes:   { materiales: 0, manoObra: 0, albanileria: 0, grupoPresion: 0, directo: 0, tiempoEjecucion: 0 },
    margenes: { pctBenefMateriales: 0.30, pctBenefManoObra: 0, pctBenefVenta: 0.25 },

    // dos presupuestos del cuadro economico (C39:F46)
    tradicional: { beneficio: 0, total: 0, totalIva: 0, eurHora: 0 },
    plan5:       { beneficio: 0, total: 0, totalIva: 0, eurHora: 0 },

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
  if (R.entrada.pctBenefVenta != null && R.entrada.pctBenefVenta !== "") R.margenes.pctBenefVenta = +R.entrada.pctBenefVenta;
}

function paso1_dimensionado(R /*, F */) {
  // Diámetro del tubo de conexión (= acometida) por normativa. Montante/alimentación: pendiente.
  R.dimensiones.diamAcometida = diametroConexion(
    R.entrada.nsum || 0, R.entrada.tipoSuministro || "", R.entrada.longTuboConexion || 0
  ) || 0;
  R.dimensiones.diamAlimentacion = 0;
  R.dimensiones.diamMontante = 0;
}

function paso3_subvencion(R, F) {
  // Subvención EMASESA (Analisis N60-N64). SOLO de entradas -> entra en el margen (paso5).
  const t = (F.TARIFAS[2026] || {});
  const viv = (R.entrada.nsum || 0) - (R.entrada.puntosComunidad || 0);  // F22 = viviendas + locales (= nsum - comunidad), como el Excel
  const masEntrada = R.entrada.masDeUnaEntrada || 0;
  R.emasesa.subvencion = viv * (t.subvencionBase || 0)
    + (R.entrada.grupoPresion.seInstala ? viv * (t.subvencionGrupoPresion || 0) : 0)
    + (masEntrada > 0 ? masEntrada * (t.subvencionMasDeUnaEntrada || 0) : 0)
    + (R.entrada.proyecto ? viv * (t.subvencionProyecto || 0) : 0);
}

// ============================================================================
// BLOQUE EMASESA — funcion PURA: recibe el total de obra + datos de la finca,
// aplica Tarifas y DEVUELVE ayudas, neto e importe por comunero.
// Replica el circuito Tarifas -> Datos -> Analisis del Excel (pasada hacia delante, sin bucle).
// ============================================================================
function calcEmasesa(inp, tarifas) {
  const T = tarifas || {};
  const viv      = +inp.viviendas || 0;
  const c13      = (inp.contadores13 != null ? +inp.contadores13 : viv); // por defecto todos 13mm (Datos F25=F22)
  const c15      = +inp.contadores15 || 0;
  const c20      = +inp.contadores20 || 0;
  const tomasCom = +inp.tomasComunidad || 0;     // F21 (0/1)
  const totalIva = +inp.totalObraConIva || 0;    // O19 = Datos!F18 (presupuesto de VENTA con IVA)
  const ingreso  = +inp.ingresoEfectivo || 0;    // F19
  const dConex   = +inp.diamConexion || 0;       // B112 -> acometida
  const masEnt   = +inp.masDeUnaEntrada || 0;    // F24
  const gp        = !!inp.gpInstala;
  const proyecto  = !!inp.proyecto;

  // Subvención base (N60-N64)
  const subvencion = viv * (T.subvencionBase || 0)
    + (gp ? viv * (T.subvencionGrupoPresion || 0) : 0)
    + (masEnt > 0 ? masEnt * (T.subvencionMasDeUnaEntrada || 0) : 0)
    + (proyecto ? viv * (T.subvencionProyecto || 0) : 0);

  // Derechos COMPLETOS de contratación + fianza (N81-N86): lo que costaría SIN Plan 5
  const dc = T.derechosContratacion || {};
  const derechosCompletos = c13 * (dc[13] || 0) + c15 * (dc[15] || 0) + c20 * (dc[20] || 0)
    + (tomasCom >= 1 ? (T.ccComunidad || 0) + (T.fianzaComunidad || 0) : 0);

  // Bonificación de cuotas + fianzas que aporta Plan 5 (N89-N96)
  const cc = T.cuotaContratacion || {}, fz = T.fianza || {};
  const bonifCuotas =
      c13 * (cc[13] || 0) + c15 * (cc[15] || 0) + c20 * (cc[20] || 0)
    + c13 * (fz[13] || 0) + c15 * (fz[15] || 0) + c20 * (fz[20] || 0);

  // Bonificación acometida (N99-N106)
  const importeAcometida = (T.acometidas || {})[dConex] || 0;

  // Análisis (columna O)
  const o19 = totalIva;
  const o20 = importeAcometida;
  const o21 = derechosCompletos;
  const o22 = o19 + o20 + o21;
  const o24 = -subvencion;
  const o25 = -o20;
  const o26 = -bonifCuotas;
  const o27 = o24 + o25 + o26;       // total ayudas (negativo)
  const neto = o22 + o27;            // O29 importe neto

  // Importe por comunero (Analisis G34-G37)
  const g34 = viv ? (o19 - ingreso + o24) / viv : 0;
  const porComunero = g34 + (T.planCincoCuota || 0) + (T.planCincoFianza || 0);

  return {
    subvencion,                  // 5.760
    derechosCompletos,           // 5.498,76  (O21)
    bonifCuotas,                 // 5.350,14  (-O26)
    importeAcometida,            // 1.813,14  (O20)
    totalConExtras: o22,         // 43.716,25 (O22)
    totalAyudas: o27,            // -12.923,28 (O27)
    neto,                        // 30.792,98 (O29)
    porComunero,                 // 854,24    (G37)
    contratacionPorComunero: (T.planCincoCuota||0)+(T.planCincoFianza||0),  // G35+G36 (cuota+fianza)
  };
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
  R.cuarto = calcCuarto(e.nsum||0, e.tipoCuarto||"", e.bateria1||"", e.bateria2||"", precios, obra);
  R.otros  = calcOtros(+e.otrosTiempos||0, +e.otrosEur||0, precios, +e.viviendas||0);
  R.montantes = calcMontantes(R, precios, obra);
  R.grupo  = calcGrupoPresion(e, (R.alimentacion && R.alimentacion.diam) || 0, precios);
  const pushCap = (calc, cap) => { if (calc && calc.lineas) calc.lineas.forEach(l => R.desglose.push({
    concepto: l.concepto, tipo: l.variante, cantidad: l.cantidad, precio: l.precio,
    total: l.parcial, tipoCoste: l.tipoCoste, capitulo: l.capitulo })); };
  pushCap(R.alimentacion); pushCap(R.cuarto); pushCap(R.montantes); pushCap(R.grupo); pushCap(R.otros);
}

function paso5_agregacionYMargenes(R /*, F */) {
  // SUMIF por tipoCoste
  const s = (t) => R.desglose.filter(l => l.tipoCoste === t).reduce((a, l) => a + (l.total || 0), 0);
  // TIEMPO EJECUCION (E33 del Excel) = Σ cantidad de las lineas de mano de obra (mismo conjunto que MO)
  R.costes.tiempoEjecucion = R.desglose.filter(l => l.tipoCoste === "MO").reduce((a, l) => a + (+l.cantidad || 0), 0);
  R.costes.materiales   = s("MAT");
  R.costes.manoObra     = s("MO");
  R.costes.albanileria  = s("ALB");
  R.costes.grupoPresion = s("GP");
  R.costes.directo = R.costes.materiales + R.costes.manoObra + R.costes.albanileria + R.costes.grupoPresion;

  // --- MARGENES (cuadro C39:F46). Replica la macro GoalSeek: C40 = F41/F42 = C41 (% sobre venta) ---
  const m   = R.margenes;
  const MAG = R.costes.materiales + R.costes.albanileria + R.costes.grupoPresion; // todo menos mano de obra
  const MO  = R.costes.manoObra;
  const F38 = R.costes.directo;                                  // coste total
  const E39 = (m.pctBenefMateriales != null ? m.pctBenefMateriales : 0.30);
  const pct = (m.pctBenefVenta != null ? m.pctBenefVenta : 0.25); // C41 objetivo sobre venta
  const subv = R.emasesa.subvencion || 0;                        // 5760 (O24 = -subv); ya calculado en paso3
  const tEjec = R.costes.tiempoEjecucion || 0;                   // E33

  // Bº TRADICIONAL (F41) = coste·pct/(1-pct)  -> garantiza C40 = F41/(F38+F41) = pct (con subvencion metida)
  const F41 = (pct < 1) ? F38 * pct / (1 - pct) : 0;
  // margen de mano de obra implicito (E40 = 0,2·C39), despejado de la formula del Excel
  const E40 = MO ? (F41 - (MAG * (1 + E39) - F38 - subv / 1.1)) / MO - 1 : 0;
  m.pctBenefManoObra = E40;
  const F42 = F38 + F41;
  const F43 = F42 * 1.1;
  // €/h mano de obra tradicional (C42)
  const horas = tEjec * 2 * 8;
  const C42 = horas ? (MO * (1 + E40) - (E40 * (subv / 1.1) / (E39 + E40))) / horas : 0;

  // Bº PLAN 5 (F44) = el mismo SIN restar la subvencion del beneficio
  const F44 = F41 + subv / 1.1;
  const F45 = F38 + F44;
  const F46 = F45 * 1.1;
  const C45 = horas ? (MO * (1 + E40)) / horas : 0;

  R.tradicional = { beneficio: F41, total: F42, totalIva: F43, eurHora: C42 };
  R.plan5       = { beneficio: F44, total: F45, totalIva: F46, eurHora: C45 };

  // El TOTAL del presupuesto (lo que paga el cliente y lo que come EMASESA) es el de Plan 5.
  R.totales.sinIva = F45;
  R.totales.iva    = F45 * 0.1;
  R.totales.conIva = F46;
}

// Cuenta las viviendas guardadas igual que el recalc del cliente: baja/ático = 1, resto = nº plantas, por fila con puerta/equipamiento.
function _contarViviendas(saved) {
  if (!saved) return 0;
  var z = saved.zonas || {};
  var plantas = (saved.motor && +saved.motor.plantas) || 0;
  var n = 0;
  ["baja", "resto", "atico"].forEach(function (k) {
    (z[k] || []).forEach(function (v) {
      if (v && (v.puerta || v.equip)) n += (k === "resto" ? plantas : 1);
    });
  });
  return n;
}

function paso6_emasesaNeto(R, F) {
  const t = (F.TARIFAS[2026] || {});
  // Capítulos del presupuesto (estructura "6 RESUMEN" G297-G301). Agrupa el desglose por capítulo
  // grande 1-5 (primer dígito de capitulo_presupuesto). OJO: el desglose esta a COSTE; la seguridad
  // es formula propia (G295 = 150 + Σ suministros×3), no suma de lineas.
  const capGrande = (l) => { const m = String(l.capitulo || l.capitulo_presupuesto || "").trim().match(/^(\d)/); return m ? m[1] : ""; };
  const capSum = (pre) => R.desglose.filter(l => capGrande(l) === pre).reduce((a, l) => a + (l.total || 0), 0);
  R.capitulos.fonteriaExterior = capSum("1");
  R.capitulos.albanileria      = capSum("2");
  R.capitulos.grupoPresion     = capSum("3");
  R.capitulos.aislamiento      = capSum("4");
  R.capitulos.estudio          = 0; // ahora son 2 partidas reales (Seguridad y Salud + Nota Simple) en OTROS

  // BLOQUE EMASESA: total de obra con IVA (de VENTA) -> ayudas, neto, por comunero.
  const em = calcEmasesa({
    totalObraConIva: R.totales.conIva || 0,     // O19 = Datos!F18 (depende del bloque de margenes)
    viviendas:       (R.entrada.nsum || 0) - (R.entrada.puntosComunidad || 0),   // F22 = viviendas + locales (subvención/contadores/comunero, como el Excel)
    contadores13:    R.entrada.contadores13,    // por defecto = viviendas
    tomasComunidad:  R.entrada.puntosComunidad ? 1 : 0,
    diamConexion:    R.entrada.diamConexionPropuesto || R.dimensiones.diamAcometida || 0,
    masDeUnaEntrada: R.entrada.masDeUnaEntrada || 0,
    gpInstala:       !!R.entrada.grupoPresion.seInstala,
    proyecto:        !!R.entrada.proyecto,
    ingresoEfectivo: R.entrada.ingresoEfectivo || 0,
  }, t);

  R.emasesa.subvencion       = em.subvencion;
  R.emasesa.importeAcometida = em.importeAcometida;
  R.emasesa.bonifAcometida   = em.importeAcometida;
  R.emasesa.bonifCuotas      = em.bonifCuotas;
  R.emasesa.cuotasFianzas    = em.derechosCompletos;
  R.emasesa.totalAyudas      = em.totalAyudas;
  R.emasesa.neto             = em.neto;
  R.emasesa.porComunero      = em.porComunero;
  R.emasesa.contratacionPorComunero = em.contratacionPorComunero;

  R.totales.conSubvencion = em.neto;
  R.totales.porComunero   = em.porComunero;
  // Financiación: cuota mensual (PMT) sobre el importe por comunero, por plazo (C49-C51).
  const pmt = (anual, n, P) => { if (!P || !n) return 0; const i = Math.pow(1 + (anual || 0) / 100, 1 / 12) - 1; return i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; };
  R.emasesa.financiacion = (t.financiacion || []).map(p => ({ meses: p.meses, tae: p.tae, cuota: pmt(p.tae, p.meses, em.porComunero) }));
}

// ============================================================================
// 3) SALIDAS — pintores puros del `resultado` (STUB)
// ============================================================================

function _p5esc(s){ return (s==null?"":String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function _p5fecha(s){ if(!s) return ""; var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? (m[3]+"/"+m[2]+"/"+m[1]) : String(s); }
function _p5fechaLarga(s){ if(!s) return ""; var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); if(!m) return String(s); var M=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]; return parseInt(m[3],10)+" de "+M[parseInt(m[2],10)-1]+" del "+m[1]; }
function _p5splitDir(d){ d=String(d||"").trim(); var m=/^(.*?)[\s,]+(\d+[A-Za-z]?)$/.exec(d); return m ? { via:m[1].trim(), num:m[2] } : { via:d, num:"" }; }
function _p5cap(s){ s=String(s||"").toLowerCase(); var seps=" -/."; var o="",up=true; for(var i=0;i<s.length;i++){ var ch=s[i]; if(up && seps.indexOf(ch)<0){ o+=ch.toUpperCase(); up=false; } else { o+=ch; if(seps.indexOf(ch)>=0) up=true; } } return o; }
function _p5eur(n){ if(n==null||isNaN(n)) return ""; return Number(n).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})+" \u20ac"; }
function _p5num(n){ if(n==null||isNaN(n)) return ""; return Number(n).toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2}); }

// Nombres fijos de capítulos (1-5) y subcapítulos del capítulo 1 (los que llevan "Total")
var _P5_CHAP = { "1":"Fontanería exterior", "2":"Albañilería y varios", "3":"Grupo de Presión", "4":"Aislamiento térmico de montantes", "5":"Estudio, medidas y elementos de seguridad" };
var _P5_SUB1 = { "1.1":"Tubo de conexión", "1.2":"Tubo de alimentación", "1.3":"Batería de contadores", "1.4":"Montantes", "1.5":"Otros", "1.6":"Mano de obra" };

// Separa "1.2.6 Accesorios y pequeño material" -> { num:"1.2.6", path:[1,2,6], nombre:"Accesorios..." }
function _p5parseCap(s){
  s=String(s||"").trim();
  var m=/^(\d+(?:\.\d+)*)\s*(.*)$/.exec(s);
  if(!m) return { num:"", path:[], nombre:s };
  return { num:m[1], path:m[1].split(".").map(Number), nombre:(m[2]||"").trim() };
}
// material entre paréntesis del concepto: "Tubo conexión (PE)" -> "PE"
function _p5material(concepto){ var m=/\(([^)]+)\)\s*$/.exec(String(concepto||"")); return m ? m[1] : ""; }
function _p5diam(v){ if(v==null||v==="") return ""; var s=String(v); return /^\d+(\.\d+)?$/.test(s) ? (s+"mm") : s; }

// Construye la tabla "Presupuesto general de la Obra" (en VENTA) desde el desglose de MEDICIONES.
function _p5tablaPresupuesto(dsg, cuadro, matX){
  var _matConexX=(matX&&matX.conex)||"", _matAlimX=(matX&&matX.alim)||"", _diamGPX=(matX&&matX.diamGP)||"", _diamDepX=(matX&&matX.diamDep)||"";
  var lineas = ((dsg&&dsg.lineas)||[]).filter(function(l){ return !l.tipo_fila && l.tipo; });
  if(!lineas.length) return "";
  var fMat = 1 + ((cuadro&&cuadro.bMat!=null) ? cuadro.bMat : 0.30);
  var fMo  = 1 + ((cuadro&&cuadro.bMo!=null)  ? cuadro.bMo  : 0.6458525150762424);
  var fac = function(t){ return t==="MO" ? fMo : fMat; };

  // Agrupa por capitulo_presupuesto (= fila del PDF)
  var rows = {};   // num -> { num, path, nombre, venta, fuentes:[lineas] }
  lineas.forEach(function(l){
    var p = _p5parseCap(l.capitulo_presupuesto || "");
    if(!p.num) return;
    if(!rows[p.num]) rows[p.num] = { num:p.num, path:p.path, nombre:p.nombre, venta:0, fuentes:[] };
    rows[p.num].venta += (l.parcial||0)*fac(l.tipo);
    rows[p.num].fuentes.push(l);
  });
  CAPS_PRESUPUESTO.forEach(function(cap){ var pc=_p5parseCap(cap); if(pc.num && !rows[pc.num]) rows[pc.num]={ num:pc.num, path:pc.path, nombre:pc.nombre, venta:0, fuentes:[] }; });
  var orden = Object.keys(rows).sort(function(a,b){ return a.localeCompare(b,undefined,{numeric:true}); });

  // Estructura en capítulos 1-5
  var chapters = {};  // "1".."5" -> { total, subs:{ "1.1":{total,rows:[]} }, rows:[] }
  orden.forEach(function(num){
    var r = rows[num], ch = String(r.path[0]);
    if(!chapters[ch]) chapters[ch] = { total:0, subs:{}, rows:[] };
    chapters[ch].total += r.venta;
    if(ch==="1" && r.path.length>=3){
      var sub = r.path[0]+"."+r.path[1];
      if(!chapters[ch].subs[sub]) chapters[ch].subs[sub] = { total:0, rows:[] };
      chapters[ch].subs[sub].total += r.venta;
      chapters[ch].subs[sub].rows.push(r);
    } else {
      chapters[ch].rows.push(r);
    }
  });

  function celdasLinea(r){
    // material/diámetro/precio/cantidad sólo si la fila viene de UNA línea con detalle
    var mat="", diam="", precio="", cant="";
    if(r.fuentes.length===1 && r.fuentes[0].tipo==="MAT"){
      var l=r.fuentes[0];
      mat = _p5esc(_p5material(l.concepto));
      diam = _p5esc(_p5diam(l.variante));
      precio = _p5eur((l.precio||0)*fac(l.tipo));
      cant = _p5num(l.cantidad) + (l.ud?(" "+_p5esc(l.ud)):"");
    } else if(r.fuentes.length===0){
      precio = ""; cant = "";
    } else {
      precio = _p5eur(r.venta); cant = "1 ud";
    }
    if(r.num==="1.1.1") mat=_p5esc(_matConexX);
    else if(r.num==="1.2.1") mat=_p5esc(_matAlimX);
    else if(r.num==="1.3.2") mat="";
    else if(r.num==="4.2") mat="ALUMINIO";
    else if(r.num==="4.1") mat="";
    var _gpCombo = (r.num==="3.1" && _diamGPX) ? _p5esc(_diamGPX) : ((r.num==="3.4" && _diamDepX) ? _p5esc(_diamDepX) : "");
    var _cMatDiam = _gpCombo ? ('<td class="mat" colspan="2">'+_gpCombo+'</td>') : ('<td class="mat">'+mat+'</td><td class="diam">'+diam+'</td>');
    return _cMatDiam+
           '<td class="num">'+precio+'</td><td class="num">'+cant+'</td>'+
           '<td class="num">'+_p5eur(r.venta)+'</td>';
  }
  function filaLinea(r){
    return '<tr class="ln"><td class="den">'+_p5esc(r.num)+' '+_p5esc(r.nombre)+'</td>'+celdasLinea(r)+'</tr>';
  }

  var H=[];
  H.push('<table class="ptab"><thead><tr>'+
    '<th class="den">Denominación del material</th><th class="mat">material</th><th class="diam">diámetro</th>'+
    '<th class="num">precio</th><th class="num">cantidad</th><th class="num">suma</th></tr></thead><tbody>');

  ["1","2","3","4","5"].forEach(function(ch){
    var C = chapters[ch]; if(!C) C = { total:0, subs:{}, rows:[] };
    H.push('<tr class="cap"><td class="den">'+ch+' '+_p5esc(_P5_CHAP[ch]||"")+'</td>'+
           '<td></td><td></td><td></td><td></td><td class="num">Total '+_p5eur(C.total)+'</td></tr>');
    // subcapítulos (sólo capítulo 1)
    var subKeys = Object.keys(C.subs).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
    subKeys.forEach(function(sk){
      var S=C.subs[sk];
      H.push('<tr class="sub"><td class="den">'+_p5esc(sk)+' '+_p5esc(_P5_SUB1[sk]||"")+'</td>'+
             '<td></td><td></td><td></td><td></td><td class="num">Total '+_p5eur(S.total)+'</td></tr>');
      S.rows.sort(function(a,b){return a.num.localeCompare(b.num,undefined,{numeric:true});});
      S.rows.forEach(function(r){ H.push(filaLinea(r)); });
    });
    // líneas directas (capítulos 2-5)
    C.rows.sort(function(a,b){return a.num.localeCompare(b.num,undefined,{numeric:true});});
    C.rows.forEach(function(r){ H.push(filaLinea(r)); });
  });
  H.push('</tbody></table>');

  // RESUMEN + IVA (10%)
  var total = ["1","2","3","4","5"].reduce(function(a,ch){ return a + ((chapters[ch]&&chapters[ch].total)||0); },0);
  var iva = total*0.10, totalIva = total+iva;
  H.push('<div class="resumen"><div class="rtit">6 RESUMEN</div><table class="rtab"><tbody>');
  ["1","2","3","4","5"].forEach(function(ch){
    H.push('<tr><td>'+ch+' '+_p5esc(_P5_CHAP[ch]||"")+'</td><td class="num">'+_p5eur((chapters[ch]&&chapters[ch].total)||0)+'</td></tr>');
  });
  H.push('<tr class="rtot"><td>Total</td><td class="num">'+_p5eur(total)+'</td></tr>');
  H.push('<tr><td>10% de I.V.A.</td><td class="num">'+_p5eur(iva)+'</td></tr>');
  H.push('<tr class="rtot"><td>Total Presupuesto</td><td class="num">'+_p5eur(totalIva)+'</td></tr>');
  H.push('</tbody></table></div>');
  return H.join("");
}

// Páginas 7-8: documentación, normas, personal, seguro, garantía, validez y firma/formas de pago.
const _P5_REVISION = "Rev-19.78 27/06/2026";
  const _P5_NOIMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAUAAtADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6wooor6A8IKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACmk806mnrQAZozSUUALmjNJRQAuaM0lFAC5ozSUUALmjNJRQAuaM0lFAC5ozSUUALmjNJRQAuaM0ySRIYn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KKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z";
const _P5_CONDICIONES = "El presente presupuesto queda supeditado a las siguientes condiciones:\n- Que la batería de contadores quepa en la ubicación prevista.\n- Posibilidad técnica de paso de las instalaciones por el forjado sanitario.\n- Autorización de los propietarios afectados al paso de instalaciones a través de su propiedad.\n- Eliminación de ___ depósitos de los existentes para dar cabida a la/s batería/s de contadores.\n- Legalidad del piso ___ que no aparece en Catastro.\n- Autorización por parte de EMASESA para conectar en el punto actual de suministro.\nEn caso de que los buzones estorben para la colocación del armario de la batería, estos se desmontarán, siendo responsabilidad de la CCPP su nueva adquisición y montaje en otra ubicación.";
const _P5_SELLO = "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";
const _P5_SABADELL = "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";
function _p5paginasLegales(meta, cuadro, condiciones){
  var C = cuadro || {};
  var eur = function(n){ return _p5eur(n); };
  var np = _p5esc((meta && meta.nPresupuesto) || "");
  var fecha = _p5esc(_p5fecha((meta && meta.fecha) || ""));
  var diez = (C.totP5Iva || 0) * 0.10;

  var pag7 = `<div class="sheet legal">
  <div class="legalh">3.- DOCUMENTACIÓN</div>
  <p class="legalp">El importe del presente presupuesto comprende la confección y tramitación de toda la documentación necesaria, incluida la tramitada en: Delegación Provincial de Empleo y Desarrollo Tecnológico, Colegios Profesionales, Ayuntamientos, Gerencia Municipal de Urbanismo y EMASESA.</p>
  <p class="legalp">En este apartado no entrarán las autorizaciones y permisos necesarios para trabajar en recintos privados de la comunidad, paso de instalaciones en dependencias privadas, etc., que serán competencia exclusiva de la Comunidad de Propietarios.</p>

  <div class="legalh">4.- NORMAS DE APLICACIÓN</div>
  <p class="legalp">Las instalaciones presupuestadas se diseñarán y ejecutarán cumpliendo las siguientes normas:</p>
  <ul class="legalul">
    <li>Reglamento del Suministro Domiciliario de Agua (Decreto 120/1991 de 11 de junio).</li>
    <li>Ordenanza Fiscal Reguladora de la Tasa por Prestación del Servicio de Abastecimiento Domiciliario de Agua Potable y otras actividades conexas al mismo.</li>
    <li>Recomendaciones Técnicas para la adaptación de las Instalaciones Interiores de Agua de los Edificios en la Sustitución de Contadores Generales por Individuales en Batería.</li>
    <li>Reglamento Electrotécnico para Baja Tensión (Decreto 2413/1973, de 20 de septiembre).</li>
    <li>Ley de Prevención de Riesgos Laborales (nº 31/1995 de 8 de noviembre).</li>
    <li>Cumplimiento del Real Decreto 1627/1997, de 24 de octubre.</li>
  </ul>
  <p class="legalp">Y demás normas que puedan recoger actividades desarrolladas en este tipo de obras.</p>

  <div class="legalh">5.- PERSONAL</div>
  <p class="legalp">Durante la ejecución del trabajo, LA EMPRESA se obliga a cumplir cuantas normas de prevención de riesgos laborales y seguridad le sean de aplicación. Todo el personal que intervenga en el servicio bajo su dependencia deberá estar debidamente asegurado, y en este sentido deberá cumplir con las leyes laborales relativas a la Seguridad Social, seguros de accidente, seguros de enfermedad y otras que pudieran afectarle. La propiedad podrá solicitar, durante la vigencia de los trabajos, la presentación de las copias de los justificantes sellados por una entidad colaboradora que acredite el pago de los seguros sociales.</p>

  <div class="legalh">6.- SEGURO DE RESPONSABILIDAD CIVIL</div>
  <p class="legalp">Toda la actividad desarrollada por LA EMPRESA estará cubierta por un seguro de responsabilidad civil con una cuantía mínima de 300.000€ por siniestro.</p>
  <ul class="legalul">
    <li>Responsabilidad civil de explotación.</li>
    <li>Responsabilidad civil derivada de las labores propias del mantenimiento.</li>
    <li>Responsabilidad civil patronal, con sublímites no inferior a 150.000€.</li>
    <li>Responsabilidad subsidiaria de contratistas, con sublímites no inferior a 150.000€.</li>
  </ul>
  <p class="legalp">LA EMPRESA pone a disposición de la Comunidad de Propietarios y esta lo podrá solicitar cuando estime oportuno durante la vigencia de las obras, copia de la póliza de seguros de responsabilidad civil y copias de los recibos compensados de la mencionada póliza de seguros.</p>`;

  var pag8 = `
  <div class="legalh">7.- GARANTÍA DE LOS TRABAJOS</div>
  <p class="legalp">Los trabajos estarán garantizados por dos (2) años a contar desde la fecha de la factura final.</p>
  <p class="legalp">Para realizar este presupuesto, LA EMPRESA se ha basado en las mediciones tomadas en el edificio (en lo referente a la parte visible del edificio y de la instalación actual) y en las informaciones facilitadas por la comunidad (en lo referente a la parte no visible o no accesible del edificio y de la instalación actual).</p>
  <p class="legalp">El presupuesto detalla los trabajos a realizar, la forma de ejecución, los materiales a emplear, diámetros de las tuberías, así como el trazado de las tuberías, ubicación de los distintos elementos de la instalación, conexiones a realizar con la instalación interior de las viviendas y situación de las mismas, además los trabajos de albañilería, pero no los de pintura.</p>
  <p class="legalp">LA EMPRESA no se compromete a realizar ningún trabajo, ni a prestar ningún servicio, especialmente los de traslado o desmontaje de mobiliario o decoración, que sean necesarios para la ejecución de los trabajos y que no estén detallados en el presente presupuesto.</p>
  <p class="legalp">Este presupuesto se detalla teniendo en cuenta los criterios de la comunidad en cuanto a estética, ubicación de los distintos elementos y trazado de las instalaciones a realizar, teniendo siempre en cuenta el cumplimiento de las normas que le son de aplicación.</p>
  <p class="legalp">No estará incluida en esta garantía la instalación interior de las viviendas, por no haber sido renovada, estableciéndose el límite entre la instalación realizada y la instalación antigua de la vivienda, en el punto de conexión de ambas instalaciones.</p>
  <p class="legalp">Tampoco estarán incluidas en esta garantía las averías producidas por la incorrecta manipulación de la instalación.</p>
  <p class="legalp">LA EMPRESA repondrá los revestimientos (azulejos y aplacados de mármol blanco, etc.) que hayan sido levantados por motivo de la obra, por el modelo y medidas existentes en el mercado y será por cuenta de la Comunidad de Propietarios el suministro del material de revestimiento que no sea usual y por tanto de difícil localización.</p>
  <p class="legalp">LA EMPRESA no es responsable del estado de las instalaciones interiores de las viviendas ni de los atascos que pudiesen ocasionarse en las mismas.</p>

  <div class="legalh">8.- VALIDEZ DEL PRESUPUESTO</div>
  <p class="legalp">Este presupuesto tendrá un plazo de validez de 1 mes. En caso de que, por causas imputables a la Comunidad de Propietarios o a cualquier comunero, no se aportara correctamente la documentación conforme a los requisitos establecidos por EMASESA en un plazo máximo de veinte días naturales desde el envío del requerimiento por parte de LA EMPRESA a la Comunidad de Propietarios, o, completada esta fase y tras nuevo requerimiento, no se aportaran los contratos firmados ni los justificantes de pago en el plazo de diez días naturales, LA EMPRESA podrá resolver este contrato sin necesidad de nuevo aviso en cualquiera de los dos supuestos, y la Comunidad de Propietarios deberá abonar el 10% del importe presupuestado (${eur(diez)}), IVA incluido, en la cuenta del Banco Santander nº ES81-0049-5268-7222-1608-2567, en un plazo máximo de quince días naturales, en concepto de compensación por los costes de gestión, estudio técnico y tramitación administrativa realizados.</p>

  <div class="condpart">${ (condiciones && condiciones.trim()) ? _p5esc(condiciones) : '' }</div><table class="firma"><tbody>
    <tr>
      <td class="fleft">
        <div class="ftot">Conforme Presupuesto: ${eur(C.totP5Iva)}</div>
        <div class="ftot">Presupuesto con Subvención: ${eur(C.totSubv)}</div>
        <div class="ftot">Importe por comunero: ${eur(C.comunero)}</div>
        <div class="ffecha">Fecha: ${fecha}</div>
        <div class="fsigwrap"><table class="fsig"><tbody>
        <tr><td>N.I.F.:</td><td>N.I.F.: B-90.488.222</td></tr>
        <tr><td>Firmado conforme:</td><td>Firmado: Alberto Araujo</td></tr>
        <tr><td>Presidente de la CCPP</td><td>LA EMPRESA</td></tr>
        <tr><td>(NO ADMINISTRADOR)</td><td></td></tr>
        </tbody></table><img class="fsello" src="data:image/png;base64,${_P5_SELLO}" alt=""></div>
      </td>
      <td class="fp">
        <div class="fpbox">
        <img class="fpsab" src="data:image/png;base64,${_P5_SABADELL}" alt="Banco Sabadell Consumer">
        <table class="fptab"><tbody>
        <tr><td colspan="3" class="fph">FORMAS DE PAGO</td></tr>
        <tr><td colspan="3" class="fpbig">1.- CONTADO POR COMUNERO ${eur(C.comunero)}</td></tr>
        <tr><td colspan="3" class="fplbl">2.- FINANCIADO COMUNERO</td></tr>
        <tr><td colspan="2" class="fpc">${eur(C.fin6)}/6meses</td><td class="fpg"></td></tr>
        <tr><td colspan="2" class="fpc">${eur(C.fin12)}/12meses</td><td class="fpg"></td></tr>
        <tr><td colspan="2" class="fpc">${eur(C.fin18)}/18meses</td><td class="fpg"></td></tr>
        <tr><td colspan="3" class="fplbl">3.- FINANCIADO CCPP (MÁXIMO 120 MESES)</td></tr>
        <tr><td colspan="2" class="fpc">${eur(C.finCom)}</td><td class="fpg"></td></tr>
        </tbody></table>
        </div>
      </td>
    </tr>
  </tbody></table>
</div>`;

  return pag7 + pag8;
}
// Página 9: Análisis de Subvención (datos EMASESA del motor: acometida, cuotas, bonificaciones, neto).
function _p5lineaRellenar(w){ return '<span style="display:inline-block;min-width:'+(w||160)+'px;border-bottom:1px solid #333;">&nbsp;</span>'; }
// Documento legal del grupo de presion (mantenimiento / renuncia), tomado de
// doc_plantillas. Se rellena SOLO [comunidad]; el resto de huecos ([presidente],
// [nif_presidente], [nif_comunidad]) se dejan como linea para firmar/rellenar a mano.
// Procesa un bloque de texto de plantilla (encabezado / cuerpo / pie): escapa el texto,
// sustituye los huecos conocidos (rep: clave->HTML ya montado) y lo trocea en parrafos.
function _p5docBloque(txt, rep, estiloPar){
  if(txt==null) return "";
  rep = rep || {};
  var html = String(txt).replace(/\[([a-z_]+)\]/gi, function(m, k){
    var key = String(k).toLowerCase();
    return Object.prototype.hasOwnProperty.call(rep, key) ? ("\u0000"+key+"\u0000") : m;
  });
  html = _p5esc(html);
  Object.keys(rep).forEach(function(key){ html = html.split("\u0000"+key+"\u0000").join(rep[key]); });
  var est = estiloPar ? (' style="'+estiloPar+'"') : "";
  return html.split(/\n\s*\n/).map(function(p){ return '<p class="legalp"'+est+'>'+p.replace(/\n/g,"<br>")+"</p>"; }).join("\n");
}
// Documento del grupo de presion, montado IGUAL que el menu "Imprimir documentos":
// encabezado general (EMASESA, a la derecha + linea) + cuerpo + pie ("Y para que conste...").
// Solo se rellena [comunidad]; presidente y NIF quedan en linea para firmar a mano. [fecha]=hoy.
function _p5paginaGrupoPresion(doc, comunidadTxt, encab, pie){
  if(!doc || !doc.cuerpo) return "";
  var repBody = {
    "comunidad": (comunidadTxt && String(comunidadTxt).trim()) ? _p5esc(String(comunidadTxt).trim()) : _p5lineaRellenar(180),
    "nif_comunidad": _p5lineaRellenar(120),
    "presidente": _p5lineaRellenar(180),
    "nif_presidente": _p5lineaRellenar(120)
  };
  var _h=new Date(), _M=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var _fechaHoy=_h.getDate()+" de "+_M[_h.getMonth()]+" de "+_h.getFullYear();
  var encabHtml = encab ? ('<div class="gpenc">'+_p5docBloque(encab, {}, "text-align:right")+'</div><div style="border-bottom:1px solid #333;margin:14px 0 34px"></div>') : "";
  var bodyHtml  = _p5docBloque(doc.cuerpo, repBody);
  var pieHtml   = pie ? ('<div style="margin-top:38px">'+_p5docBloque(pie, {fecha:_p5esc(_fechaHoy)})+'</div>') : "";
  return '<div class="sheet legal gpdoc">\n  '+encabHtml+'\n  '+bodyHtml+'\n  '+pieHtml+'\n</div>';
}

function _p5paginaSubvencion(R, meta, cuadro){
  var C = cuadro || {}; var em = C.emasesa || {}; var f = (R && R.finca) || {};
  if (!C.emasesa) return ""; // sin datos del motor todavia
  var eur = function(n){ return _p5eur(n); };
  var neg = function(n){ var v = Math.abs(Number(n)||0); return "-" + _p5eur(v); };
  var sp = _p5splitDir((meta && meta.direccion) || f.direccion || "");
  var via = _p5cap(sp.via || "");
  var num = (f.numero!=null && f.numero!=="") ? f.numero : sp.num;
  var pob = _p5cap(f.poblacion || ""); var cp = f.cp || "";
  var np = _p5esc((meta && meta.nPresupuesto) || "");
  var sumi = _p5esc((meta && meta.suministro!=null) ? meta.suministro : 0);
  var fecha = _p5esc(_p5fechaLarga((meta && meta.fecha) || ""));
  var viv = C.viviendas || 0;
  var nCom = (C.tomasComunidad!=null ? C.tomasComunidad : ((R && R.entrada && R.entrada.puntosComunidad) ? 1 : 0)) || 0;

  var impPres = C.totP5Iva || 0;
  var acom = em.importeAcometida || 0;
  var cuotas = em.cuotasFianzas || 0;
  var total = impPres + acom + cuotas;
  var subv = em.subvencion || 0;
  var bonA = em.bonifAcometida || 0;
  var bonC = em.bonifCuotas || 0;
  var ayudas = em.totalAyudas != null ? em.totalAyudas : -(subv + bonA + bonC);
  var neto = em.neto != null ? em.neto : (total + ayudas);
  var contrat = em.contratacionPorComunero || 0;   // cuota+fianza por comunero (2026: 0 + 3,01)
  var porCom = em.porComunero || C.comunero || 0;
  var netoCom = porCom - contrat;
  var cuotaCom = 0;                  // G35 cuota de contratación (2026 = 0)
  var fianza = contrat - cuotaCom;   // G36 fianza
  var totComun = nCom>=1 ? contrat : 0;   // Comunidad: solo fianza (2026 = 3,01)
  var colCom = nCom>=1;

  var L = function(t, v, tot, ind, tl){ return '<div class="s2line'+(tot?" tot":"")+(ind?" ind":"")+(tl?" tl":"")+'"><span class="t">'+t+'</span><span class="d"></span><span class="v">'+v+'</span></div>'; };

  // Tabla por tipo de contador: 4 columnas SIEMPRE presentes (13/15/20 mm + Comunidad),
  // como el formulario oficial. El motor sólo rellena 13 mm; 15/20 quedan en blanco.
  var diam = [
    { nv: viv, mm: "13", neto: netoCom, cuota: cuotaCom, fianza: fianza, total: porCom },
    { nv: 0,   mm: "15", neto: null, cuota: null, fianza: null, total: null },
    { nv: 0,   mm: "20", neto: null, cuota: null, fianza: null, total: null }
  ];
  var eb = function(v){ return (v==null) ? "" : eur(v); };
  var payHd = diam.map(function(c){ return '<td class="hd">'+(c.nv>0 ? (c.nv+'&nbsp;&nbsp;de '+c.mm+' mm.') : "")+'</td>'; }).join("")
            + '<td class="hd">'+(nCom>=1 ? ('Comunidad ( '+nCom+' )') : "")+'</td>';
  var payRow = function(lab, key, tot){
    var cells = diam.map(function(c){ return '<td>'+eb(c[key])+'</td>'; }).join("");
    var comVal = (key==="fianza"||key==="total") ? (nCom>=1 ? totComun : null) : null;
    cells += '<td>'+eb(comVal)+'</td>';
    return '<tr'+(tot?' class="tot"':'')+'><td class="lab"><div class="ld"><span>'+lab+'</span><i></i></div></td>'+cells+'</tr>';
  };
  var resCells = diam.map(function(c){ return '<td>'+eb(c.total)+'</td>'; }).join("")
    + '<td>'+eb(nCom>=1 ? totComun : null)+'</td>';

  return `<div class="sheet subv">
  <div class="s2head">
    <div class="s2sumi">Suministro nº <b>${sumi}</b><br>Presupuesto nº <b>${np}</b></div>
    <div class="s2tit">Análisis de Subvención</div>
  </div>

  <div class="s2box">
    <div class="s2sec">DIRECCIÓN DE LA FINCA PRESUPUESTADA</div>
    <table class="s2grid"><tbody>
      <tr><td>Calle: <b>${_p5esc(via)}</b></td><td class="r">Número: <b>${_p5esc(num)}</b></td></tr>
      <tr><td>Población: <b>${_p5esc(pob)}</b></td><td class="r">Código Postal: <b>${_p5esc(cp)}</b></td></tr>
    </tbody></table>
  </div>

  <div class="s2box">
    <div class="s2sec">DATOS DEL PRESUPUESTO</div>
    <table class="s2grid s2inst"><tbody>
      <tr><td>INSTALADOR: <b>Instalaciones Araujo (Ara Corporate Sdad. Inv. SL)</b></td><td class="r">Nº de viviendas y/o locales: <b>${((R.entrada&&R.entrada.nsum)||0)-((R.entrada&&R.entrada.puntosComunidad)||0)}</b></td></tr>
    </tbody></table>
    ${L("IMPORTE DEL PRESUPUESTO (10% IVA incluido)", eur(impPres))}
    ${L("IMPORTE DE LA NUEVA ACOMETIDA DE AGUA", eur(acom))}
    ${L("IMPORTE CUOTAS DE CONTRATACIÓN Y FIANZAS", eur(cuotas))}
    ${L("TOTAL", eur(total), true, true, true)}
    <div class="s2gap"></div>
    ${L("SUBVENCIÓN EMASESA", neg(subv))}
    ${L("BONIFICACIÓN ACOMETIDA", neg(bonA))}
    ${L("BONIFICACIÓN EN CUOTAS DE CONTRATACIÓN Y FIANZAS", neg(bonC))}
    ${L("TOTAL AYUDAS EXTRAORDINARIAS PLAN CINCO", neg(ayudas), true, true, true)}
    <div class="s2gap"></div>
    ${L("IMPORTE NETO", eur(neto), true, true, true)}
  </div>

  <div class="s2box">
    <div class="s2sub">Análisis supuesto pago en efectivo:</div>
    <table class="s2pay"><tbody>
      <tr><td class="nob"></td><td class="distr" colspan="4">Distribución en función de los tipos de viviendas</td></tr>
      <tr><td class="nob"></td>${payHd}</tr>
      ${payRow("Importe neto por comunero", "neto", false)}
      ${payRow("Cuota de Contratación (*)", "cuota", false)}
      ${payRow("Fianza según tipo (*)", "fianza", false)}
      ${payRow("Total efectivo por comunero", "total", true)}
    </tbody></table>
  </div>

  <div class="s2box">
    <table class="s2pay"><tbody>
      <tr><td class="nob"><span class="s2res">RESUMEN</span></td><td class="distr" colspan="4">Distribución en función de los tipos de viviendas</td></tr>
      <tr class="res"><td class="lab s2res">Si paga al contado:</td>${resCells}</tr>
    </tbody></table>
  </div>

  <div class="s2date">${fecha}</div>
  <div class="s2foot">(*) Los precios de Cuotas de Contratación, Fianzas e importes de subvención son los previstos para el año 2026.<br>(*) Esta información es orientativa hasta su aprobación definitiva por EMASESA.</div>
</div>`;
}
// Página de imágenes: padrón (lista de catastro) + 11 fotos (01.png..11.png de la carpeta "00 imagenes"). Va tras Análisis de Subvención.
function _p5paginaImagenes(R, meta, cuadro, saved){
  var f = (R && R.finca) || {};
  var sv = saved || {};
  var cat = Array.isArray(sv.catastro) ? sv.catastro : [];
  var imgs = Array.isArray(sv.imagenes) ? sv.imagenes : [];
  var sp = _p5splitDir((meta && meta.direccion) || f.direccion || "");
  var via = _p5cap(sp.via || "");
  var num = (f.numero != null && f.numero !== "") ? f.numero : sp.num;
  var tv = (f.tipo_via || "").toString().toUpperCase().trim();
  var cab = ((tv ? tv + " " : "") + via + (num ? " " + num : "")).trim();
  var filas = cat.map(function(r){
    return "<tr><td class=\"pl\">Pl:" + _p5esc(r.planta||"") + " Pt:" + _p5esc(r.puerta||"") + "</td><td class=\"cc\">" + _p5esc(r.uso||"") + "</td><td class=\"cc\">" + _p5esc(r.sup||"") + "</td></tr>";
  }).join("");
  if (!filas) filas = "<tr><td colspan=\"3\" style=\"text-align:center;color:#888\">(sin datos de catastro)</td></tr>";
  var ETIQ = ["LLAVE DE ACERADO","PORTERO ELECTRONICO","CONTADOR","ARMARIO CONTADOR","NUEVO ARMARIO","PEINE","PEINE","PEINE","PEINE","PEINE","DISTRIBUCION"];
  var idq = encodeURIComponent((meta && meta.id) || "");
  var tkq = (meta && meta.token) ? ("&token=" + encodeURIComponent(meta.token)) : "";
  var celdas = "";
  for (var k = 0; k < 11; k++){
    var nn = ("0" + (k+1)).slice(-2);
    var inner = idq
      ? ("<img class=\"p5img\" decoding=\"sync\" src=\"/plan5/imagen?id=" + idq + "&n=" + nn + tkq + "\" style=\"width:100%;height:100%;object-fit:cover;border-radius:6px;display:none\" onload=\"this.style.display='';var p=this.parentNode.querySelector('.p5ph');if(p)p.style.display='none';\" onerror=\"if(!this.dataset.fb){this.dataset.fb='1';this.src=window.__P5_NOIMG__;var lab=this.parentNode.parentNode.querySelector('.p5imglab');if(lab)lab.style.display='none';}else{this.style.display='none';}\"><span class=\"p5ph\" style=\"color:#b6c2d2;font-size:10px\">" + nn + ".png</span>")
      : ("<span style=\"color:#b6c2d2;font-size:10px\">" + nn + ".png</span>");
    celdas += "<div class=\"p5imgcell\"><div class=\"p5imgbox\">" + inner + "</div><div class=\"p5imglab\">" + _p5esc(ETIQ[k] || ("IMAGEN " + (k+1))) + "</div></div>";
  }
  return "<div class=\"sheet p5imgs\">"
    + "<script>window.__P5_NOIMG__=" + JSON.stringify(_P5_NOIMG) + ";</script>"
    + "<style>"
    + ".p5imgs .p5area{display:grid;grid-template-columns:repeat(5,1fr);grid-auto-flow:row;column-gap:6px;row-gap:50px;margin:6px 0 12px}.p5imgs .p5padbox{grid-column:1 / span 2;grid-row:1 / span 2;overflow:hidden}" + ".p5imgs .p5padron{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;transform-origin:top left}"
    + ".p5imgs .p5padron th{background:#1f3a8a;color:#fff;padding:4px 6px;text-align:center}"
    + ".p5imgs .p5padron td.cc{text-align:center}"
    + ".p5imgs .p5padron td{border:1px solid #cbd5e1;padding:0 4px;line-height:1.3}"
    + ".p5imgs .p5padron td.pl{font-weight:700;text-align:left;word-break:break-word}"
    + ""
    + ".p5imgs .p5imgcell{display:flex;flex-direction:column;align-items:center}"
    + ".p5imgs .p5imgbox{width:100%;aspect-ratio:9/16;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}"
    + ".p5imgs .p5imglab{font-size:10px;font-weight:700;color:#1f3a8a;text-transform:uppercase;margin-top:3px;text-align:center}"
    + "</style>"
    + "<div class=\"p5area\">" + "<div class=\"p5padbox\"><table class=\"p5padron\"><colgroup><col style=\"width:48%\"><col style=\"width:26%\"><col style=\"width:26%\"></colgroup><thead><tr><th>" + (_p5esc(cab) || "CATASTRO") + "</th><th>USO</th><th>SUP. m&#178;</th></tr></thead><tbody>" + filas + "</tbody></table></div>"
    + celdas
    + "</div>"
    + "</div>"
    + "<script>(function(){function fit(){var bx=document.querySelector('.p5padbox');var t=bx&&bx.querySelector('.p5padron');if(!bx||!t)return;t.style.transform='';t.style.fontSize='';var ib=document.querySelector('.p5imgbox'),lb=document.querySelector('.p5imglab');var ah=0;if(ib){ah=(ib.getBoundingClientRect().height+(lb?lb.getBoundingClientRect().height:0))*2+50;}if(!(ah>0))ah=bx.clientHeight;t.style.fontSize='9px';var nh9=t.scrollHeight;if(nh9<=ah){t.style.fontSize='';return;}t.style.fontSize='5px';var nh5=t.scrollHeight;var a=(nh9-nh5)/4,b=nh9-a*9;var fs=(a>0)?((ah-b)/a):5;if(fs>9)fs=9;if(fs<2)fs=2;t.style.fontSize=fs+'px';var n2=t.scrollHeight;if(n2>ah&&n2>0){t.style.transform='scaleY('+(ah/n2)+')';}}if(document.readyState!=='loading')fit();else document.addEventListener('DOMContentLoaded',fit);window.addEventListener('load',fit);})();</script>";
}
// Páginas 2-5: Memoria de la Instalación (prosa generada desde la toma de datos, peines y motor).
var _P5_EQUIPTIPO = { "Cocina + Lavadero + sanitario":"TIPO A", "Cocina + Lavadero + aseo":"TIPO B", "Cocina + Lavadero + baño":"TIPO C", "Cocina + Office + Lavadero + baño + aseo":"TIPO D", "Cocina + Office + Lavadero + 2 baño + aseo":"TIPO E", "Otros":"TIPO F" };
// índices fiables del array v[] (campos editables estáticos, < 23)
var _P5V = { localesCon:4, localesSin:5, vivMasEntrada:6, entradasMas:7, comPunto1:8, comPunto2:9, contadorNum:10, ubicContador:11, llaveAcerado:12, matConexion:15, diamConexion:16, matMontante:20, cuartoUbic:21 };

function _p5fachada(s){ s=String(s||"").toUpperCase(); if(s.indexOf("DELANT")>=0) return "delantera"; if(s.indexOf("LATERAL")>=0) return "lateral"; if(s.indexOf("TRASERA")>=0) return "trasera"; return ""; }
function _p5listaES(a){ a=(a||[]).filter(function(s){return s!=null&&s!=="";}); if(!a.length) return ""; if(a.length===1) return String(a[0]); return a.slice(0,-1).join(", ")+" y "+a[a.length-1]; }
var _P5_COMNOM = { "PORTAL":"portal", "C.CONTADORES":"cuarto de contadores", "PATIO":"patio", "AZOTEA":"azotea" };
function _p5comNombre(s){ var u=String(s||"").toUpperCase().trim(); return _P5_COMNOM[u] || String(s||"").toLowerCase(); }
function _p5tramosLong(tramos){ var t=0; (tramos||[]).forEach(function(x){ t += parseFloat(String(x.long||"0").replace(",","."))||0; }); return t; }
function _p5protTxt(tramos){ var p=((tramos||[])[0]||{}).prot||""; var M={ "B.FORJADO":"bajo forjado","CANALETA":"bajo canaleta","F.VIGA":"bajo falsa viga","F.TECHO":"bajo falso techo","B.LADRILLO":"bajo fábrica de ladrillo" }; return M[p]||""; }
function _p5numES(n){ if(n==null||isNaN(n)) return ""; return Number(n).toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2}); }
function _p5metros(n){ var x=Number(n); if(isNaN(x)) return ""; return x.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" m."; }
function _p5pt(s){ s=String(s||""); return (s && !/[.!?\u2026]$/.test(s)) ? (s+".") : s; }

function _p5memoria(R, meta, saved){
  saved = saved || {};
  var m = saved.motor || {};
  var z = saved.zonas || {};
  var peines = saved.peines || [];
  var v = saved.v || [];
  var f = (R && R.finca) || {};
  var vg = function(i){ return (i!=null && v[i]!=null) ? String(v[i]) : ""; };

  var plantas = +m.plantas || 0;
  var altura = parseFloat(String(m.altura||"0").replace(",","."))||0;
  var nCom = +m.puntosComunidad || 0;

  // viviendas por zona/tipo
  function listaViv(){ var out=[]; ["baja","resto","atico"].forEach(function(k){ (z[k]||[]).forEach(function(vi){ if(vi&&(vi.puerta||vi.equip)){ var cnt=(k==="resto")?plantas:1; out.push({ zona:k, puerta:vi.puerta||"", equip:vi.equip||"", tipo:_P5_EQUIPTIPO[vi.equip]||"", n:cnt }); } }); }); return out; }
  var vivs = listaViv();
  var nViv = vivs.reduce(function(a,b){ return a+b.n; },0);
  var porTipo = {}; vivs.forEach(function(x){ if(x.tipo) porTipo[x.tipo]=(porTipo[x.tipo]||0)+x.n; });
  function puertasDe(zona){ var ps=[]; (z[zona]||[]).forEach(function(vi){ if(vi&&vi.puerta && ps.indexOf(vi.puerta)<0) ps.push(vi.puerta); }); return ps.join(", "); }
  var pbaja=puertasDe("baja"), presto=puertasDe("resto");

  var dir = (f.direccion||"")+(f.numero?(" nº "+f.numero):""); 
  var pob = f.poblacion||""; var cp = f.cp||""; var prov = f.provincia||pob;
  var fachReg = _p5fachada(vg(_P5V.llaveAcerado));
  var hayAtico = (z.atico||[]).some(function(vi){ return vi && (vi.puerta||vi.equip); });
  var patico = puertasDe("atico");
  var _sp = _p5splitDir(f.direccion||""); var viaC = _p5cap(_sp.via); var numC = _sp.num; var pobC = _p5cap(pob);
  var localesSin = parseInt(vg(_P5V.localesSin),10)||0;
  var localesCon = parseInt(vg(_P5V.localesCon),10)||0;
  var localesTot = localesCon + localesSin;
  var comNoms = [vg(_P5V.comPunto1), vg(_P5V.comPunto2)].filter(function(s){return s;}).map(_p5comNombre);
  var vivMasEnt = parseInt(vg(_P5V.vivMasEntrada),10)||0;
  var entradasMas = parseInt(vg(_P5V.entradasMas),10)||0;
  var nombresCom = [vg(_P5V.comPunto1), vg(_P5V.comPunto2)].filter(function(s){return s;}).map(function(s){return s.toLowerCase();}).join(", ");
  var _matCx = vg(_P5V.matConexion); var _diaCx = vg(_P5V.diamConexion);
  var matCxTxt = (_matCx.toUpperCase()==="DESCONOCIDO") ? "material desconocido" : _matCx;
  var diaCxTxt = !_diaCx ? "" : (_diaCx.toUpperCase()==="DESCONOCIDO" ? "di\u00e1metro DESCONOCIDO" : ("di\u00e1metro DN/OD "+_diaCx+"mm"));
  var _peinesAct = peines.map(function(pe){ if(!pe || !(pe.maIE||pe.maEng)) return ""; var ie = String(pe.maIE||"").toUpperCase().indexOf("EXT")>=0 ? "exterior" : "interior"; var eng = String(pe.maEng||"").toUpperCase().indexOf("BA\u00d1O")>=0 ? "ba\u00f1os" : "cocinas"; var pu = pe.puerta ? ("PUERTAS "+pe.puerta) : "montante"; return " El de las "+pu+" es "+ie+" y engancha en "+eng+"."; }).join("");

  // tabla destino de suministro
  var rowsTipo = [
    ["Local", localesSin, "TIPO B", "Comercial"],
    ["Doméstico", (porTipo["TIPO B"]||0), "TIPO B", "Vivienda"],
    ["Doméstico", (porTipo["TIPO C"]||0), "TIPO C", "Vivienda"],
    ["Doméstico", (porTipo["TIPO D"]||0), "TIPO D", "Vivienda"],
    ["Doméstico", (porTipo["TIPO E"]||0), "TIPO E", "Vivienda"],
    ["Comunitario", nCom>0?1:0, "TIPO A", "Comunidad"]
  ];
  var tipoMayor = ""; ["TIPO E","TIPO D","TIPO C","TIPO B","TIPO A"].forEach(function(t){ if(!tipoMayor && porTipo[t]) tipoMayor=t; });
  var _distParts = [];
  ["TIPO B","TIPO C","TIPO D","TIPO E"].forEach(function(t){ if(porTipo[t]) _distParts.push(porTipo[t]+" vivienda"+(porTipo[t]===1?"":"s")+" "+t); });
  if(localesSin>0) _distParts.push(localesSin+" local"+(localesSin===1?"":"es")+" TIPO B");
  var distrib = _distParts.join(" - ");

  // ---- B) propuesto ----
  var _tipoAcom = tipoMayor || "";
  if(localesSin>0){ var _ordAcom=["TIPO A","TIPO B","TIPO C","TIPO D","TIPO E","TIPO F"]; if(!_tipoAcom || _ordAcom.indexOf("TIPO B")>_ordAcom.indexOf(_tipoAcom)) _tipoAcom="TIPO B"; }
  var _nsumAcom = (+m.nsum||0) || (nViv + localesSin + (nCom>0?1:0));
  var _lcRawAcom = String(m.longCon||"").trim().toUpperCase();
  var _lcAcom = (_lcRawAcom==="VALIDO"||_lcRawAcom==="NO EXISTE") ? 0 : (parseFloat(String(m.longCon||"0").replace(",","."))||0);
  var diamAcomN = (R && R.conexion && R.conexion.diam) ? R.conexion.diam : ((typeof diametroConexion==="function" && _tipoAcom) ? (diametroConexion(_nsumAcom, _tipoAcom, _lcAcom)||0) : 0);
  var diamAliN  = (R && R.alimentacion && R.alimentacion.diam) ? R.alimentacion.diam : ((typeof diametroAlimentacion==="function" && _tipoAcom && String(m.montaje||"").toUpperCase()!=="SOLO PIECERIA") ? (diametroAlimentacion(_nsumAcom, _tipoAcom, (parseFloat(String(m.longAli||"0").replace(",","."))||0))||0) : 0);
  var diamAcom = diamAcomN ? (diamAcomN+"mm") : "";
  var matConexNew = "PE";
  var _lc = String(m.longCon||"").trim().toUpperCase();
  var _lcNum = parseFloat(String(m.longCon||"0").replace(",","."))||0;
  var longCon = _lcNum;
  var soloPieceria = String(m.montaje||"").toUpperCase()==="SOLO PIECERIA";
  var _laNum = parseFloat(String(m.longAli||"0").replace(",","."))||0;
  var bat1 = String(m.bat1||""); var bm = /(\d+)\s*T\s*-\s*(\d+)\s*F/i.exec(bat1);
  var batTomas = bm?bm[1]:""; var batFilas = bm?bm[2]:"";
  var bat2 = String(m.bat2||""); var bm2 = /(\d+)\s*T\s*-\s*(\d+)\s*F/i.exec(bat2);
  var bat2Tomas = bm2?bm2[1]:""; var bat2Filas = bm2?bm2[2]:"";
  var nContadores = +m.nsum || nViv+nCom;
  var cuartoUbic = vg(_P5V.cuartoUbic);
  var tipoCuarto = String(m.tipoCuarto||"");
  var matArmario = /ALUMINIO/i.test(tipoCuarto) ? "aluminio" : (/HIERRO/i.test(tipoCuarto)?"hierro":"aluminio");
  var matCxActual = vg(_P5V.matConexion); var diaCxActual = vg(_P5V.diamConexion);
  var _gpTiene = (+m.gpMotAct||0) > 0; var _gpInstala = (+m.gpInstala||0) > 0;
  var gpRenuncia = !_gpInstala && !_gpTiene;
  var _gpNum = function(x){ return parseFloat(String(x==null?"":x).replace(",",".")) || 0; };
  var _gpMotW = function(n){ return (n===1) ? "1 motor" : (n + " motores"); };
  var _gpDepW = function(n){ return (n===1) ? "1 depósito" : (n + " depósitos"); };
  var _gpDescNuevo = "Se instala uno nuevo que tiene las siguientes características: " + _gpMotW(_gpNum(m.gpInstala)) + " de " + _p5esc(String(m.gpPotNew||"").trim()) + "KW, calderín de " + _p5esc(String(m.gpCaldNew||"").trim()) + "L y " + _gpDepW(_gpNum(m.gpNdepNew)) + " de " + _p5esc(String(m.gpTdepNew||"").trim()) + "L, con lo que cumple las exigencias técnicas.";
  var _gpDescActual = "Se mantiene el existente que tiene las siguientes características: " + _gpMotW(_gpNum(m.gpMotAct)) + " de " + _p5esc(String(m.gpPotAct||"").trim()) + "KW, calderín de " + _p5esc(String(m.gpCaldAct||"").trim()) + "L y " + _gpDepW(_gpNum(m.gpNdepAct)) + " de " + _p5esc(String(m.gpTdepAct||"").trim()) + "L, con lo que cumple las exigencias técnicas (se adjunta documento de mantenimiento).";
  var gpDescTxt = _gpInstala ? _gpDescNuevo : (_gpTiene ? _gpDescActual : "La CC.PP. renuncia al grupo de presión (se adjunta documento de renuncia).");
  var grupoTxt = _gpInstala ? "Sí." : (_gpTiene ? "Se utiliza el existente." : "La CC.PP. renuncia al grupo de presión.");
  var _gpU = String(m.gpUbic||"").trim().toUpperCase();
  var emplazaTxt = (_gpU===""||_gpU==="NO NECESITA") ? "No es necesario." : (_gpU==="CUARTO EXISTENTE" ? "El nuevo Grupo Hidroneumático se ubicará en cuarto existente." : "El nuevo Grupo Hidroneumático se ubicará en cuarto de nueva construcción.");
  var diamAcomTxt = diamAcomN ? ("DN/OD "+diamAcomN+"mm.") : "\u2014";
  var diamCxTxt3 = (_lc==="NO EXISTE") ? "No existe." : (_lc==="VALIDO" ? ("El existente de DN/OD "+_p5esc(diaCxActual)+"mm es válido.") : (diamAcomN?("DN/OD "+diamAcomN+"mm."):"\u2014"));
  var longCxTxt = (_lc==="NO EXISTE") ? "No existe." : (_lc==="VALIDO" ? "El existente es válido." : (_lcNum?_p5metros(_lcNum):"\u2014"));
  var matCxTxt3 = (_lc==="NO EXISTE") ? "No existe." : (_lc==="VALIDO" ? ("El existente de "+_p5esc(matCxActual)+" es válido.") : "PE");
  var diamAliTxt = soloPieceria ? "No existe." : (diamAliN?("DN/OD "+diamAliN+"mm."):"\u2014");
  var longAliTxt = soloPieceria ? "Sólo piecería." : (_laNum?_p5metros(_laNum):"\u2014");
  var matAliTxt = soloPieceria ? "No existe." : "PE";
  var _mj = String(m.montaje||"").toUpperCase();
  var trazAliTxt = soloPieceria ? "No existe." : (_mj==="ENTERRADO" ? "La instalación del tubo de alimentación se realizará enterrado bajo zanja, quedando oculto, colocando una tapa de registro en los cambios de dirección." : (_mj==="B.FORJADO" ? "La instalación del tubo de alimentación se realizará por forjado sanitario, entubado." : (_mj==="CANALETA" ? "La instalación del tubo de alimentación se realizará en montaje aéreo, bajo canaleta." : "La instalación del tubo de alimentación se realizará por falsos techos existentes y/o falsas vigas de nueva formación, quedando oculto.")));
  var _ll = +m.llaves||0;
  var llaveTxt = _ll===1 ? "En batería (1ud)." : (_ll===2 ? "Una en fachada y otra en batería (2ud)." : (_ll===3 ? "Una en fachada y otra en cada batería (3ud)." : ""));
  var _batP1=" (para las plantas "+(pbaja?"baja, ":"")+"1ª, 2ª"+((localesCon===0&&localesSin===0&&nCom===0)?" y 3ª":", 3ª")+((localesCon>0||localesSin>0)?(nCom>0?", locales y toma de comunidad":" y locales"):(nCom>0?" y toma de comunidad":""))+")";
  var _batP2Arr=[]; for(var _bi=4;_bi<=plantas;_bi++){ _batP2Arr.push(_bi+"ª"); }
  var _batP2=_batP2Arr.length?(" (para las plantas "+_p5listaES(_batP2Arr)+")"):"";
          var _batP1solo = (((localesCon>0||localesSin>0)||nCom>0) ? (" (para las viviendas"+((localesCon>0||localesSin>0)?(nCom>0?", locales y toma de comunidad":" y locales"):(nCom>0?" y toma de comunidad":""))+")") : "");
  var bateriaTxt = "Se instalará una batería de contadores de polipropileno"+(batTomas?(" de "+batTomas+" tomas"):"")+(batFilas?(" y "+batFilas+" filas"):"")+(bat2Tomas?(_batP1+", y otra de "+bat2Tomas+" tomas y "+bat2Filas+" filas"+(plantas>=4?_batP2:"")):_batP1solo)+" para un total de "+nContadores+" contadores.";
  var _b39 = tipoCuarto.toUpperCase();
  var _f154 = (_b39==="EXISTENTE") ? "en cuarto existente" : (_b39==="ALUMINIO" ? "en nuevo armario de aluminio" : "en nuevo armario de obra");
  var _puertaArm = (_b39==="EXISTENTE") ? "" : (/ALUMINIO/.test(_b39) ? "aluminio, " : "hierro, ");
  var armarioTxt = "Se colocará "+_f154+", "+_p5esc(String(cuartoUbic||"").toLowerCase())+", con puertas de acceso "+(_puertaArm?("de "+_puertaArm):"")+"dotadas de rejillas de ventilación y cerradura normalizada por Emasesa.";
  var armarioAlbTxt = (_b39==="EXISTENTE") ? "Se utilizará el cuarto existente para la batería de contadores." : (_b39==="ALUMINIO" ? "Se construirá un nuevo armario de aluminio, con puertas de aluminio, para la batería de contadores." : (_b39==="OBRA - P.ALUMINIO" ? "Se construirá un nuevo armario de obra, con puertas de aluminio, para la batería de contadores." : "Se construirá un nuevo armario de obra, con puertas de hierro, para la batería de contadores."));
  var descCxTxt = (_lc==="NO EXISTE") ? "No existe." : (_lc==="VALIDO" ? ("El existente de "+_p5esc(matCxActual)+" y diámetro DN/OD "+_p5esc(diaCxActual)+"mm es válido.") : ("Será de "+matCxTxt3+", de diámetro "+diamCxTxt3+" y tendrá una longitud de "+(_lcNum?_p5metros(_lcNum):"")));
  var descAliTxt = soloPieceria ? "Sólo piecería." : ("Será de "+matAliTxt+", de diámetro DN/OD "+(diamAliN||"")+"mm y tendrá una longitud de "+(_laNum?_p5metros(_laNum):""));

  // ---- montantes (peines) ----
  var _SUBE = {
    "SUBE POR FACHADA DELANTERA":"buscando la fachada delantera para subir por el exterior",
    "SUBE POR FACHADA LATERAL DERECHA":"buscando la fachada lateral derecha para subir por el exterior",
    "SUBE POR FACHADA LATERAL IZQUIERDA":"buscando la fachada lateral izquierda para subir por el exterior",
    "SUBE POR FACHADA TRASERA":"buscando la fachada trasera para subir por el exterior",
    "SUBE POR PATIO DERECHO":"buscando el patio derecho para subir por el exterior",
    "SUBE POR PATIO CENTRAL":"buscando el patio central para subir por el exterior",
    "SUBE POR PATIO IZQUIERDO":"buscando el patio izquierdo para subir por el exterior",
    "SUBE POR PATIO DELANTERO":"buscando el patio delantero para subir por el exterior",
    "SUBE POR PATIO TRASERO":"buscando el patio trasero para subir por el exterior",
    "SUBE POR SCHUNT":"buscando el shunt para subir por el interior" };
  var _BAJA = {
    "BAJA POR FACHADA DELANTERA":" hasta la azotea y atravesándola para llegar a la fachada delantera, desde donde se realiza el suministro en bajada",
    "BAJA POR FACHADA LATERAL DERECHA":" hasta la azotea y atravesándola para llegar a la fachada lateral derecha, desde donde se realiza el suministro en bajada",
    "BAJA POR FACHADA LATERAL IZQUIERDA":" hasta la azotea y atravesándola para llegar a la fachada lateral izquierda, desde donde se realiza el suministro en bajada",
    "BAJA POR FACHADA TRASERA":" hasta la azotea y atravesándola para llegar a la fachada trasera, desde donde se realiza el suministro en bajada",
    "BAJA POR PATIO DERECHO":" hasta la azotea y atravesándola para llegar al patio derecho, desde donde se realiza el suministro en bajada",
    "BAJA POR PATIO CENTRAL":" hasta la azotea y atravesándola para llegar al patio central, desde donde se realiza el suministro en bajada",
    "BAJA POR PATIO IZQUIERDO":" hasta la azotea y atravesándola para llegar al patio izquierdo, desde donde se realiza el suministro en bajada",
    "BAJA POR PATIO DELANTERO":" hasta la azotea y atravesándola para llegar al patio delantero, desde donde se realiza el suministro en bajada",
    "BAJA POR PATIO TRASERO":" hasta la azotea y atravesándola para llegar al patio trasero, desde donde se realiza el suministro en bajada",
    "BAJA POR SCHUNT":" hasta la azotea y atravesándola para llegar al schunt, desde donde se realiza el suministro en bajada" };
  var _PROT_ORD = [["B.FORJADO","bajo forjado de "],["CANALETA","bajo canaleta de "],["F.VIGA","bajo falsa viga de escayola de "],["F.TECHO","bajo falso techo de "],["B.LADRILLO","bajo ladrillo de "]];
  function peineTxt(pe, i){
    var esSimple = /SIMPLE/i.test(String(pe.tipo||""));
    var puerta = pe.puerta ? (" (PUERTAS "+_p5esc(pe.puerta)+")") : "";
    var prot = { "B.FORJADO":0,"CANALETA":0,"F.VIGA":0,"F.TECHO":0,"B.LADRILLO":0 };
    (pe.tramos||[]).forEach(function(tr){ var lo=parseFloat(String(tr.long||"0").replace(",","."))||0; var pr=String(tr.prot||"").trim(); if(prot[pr]!=null) prot[pr]+=lo; });
    var tray=""; _PROT_ORD.forEach(function(p){ if(prot[p[0]]>0) tray += p[1]+_p5numES(prot[p[0]])+"m, "; });
    var subeTxt = _SUBE[String(pe.mnSube||"").trim().toUpperCase()] || "";
    var bajaTxt = _BAJA[String(pe.mnBaja||"").trim().toUpperCase()] || "";
    var conexion = (String(pe.enganche||"").trim().toUpperCase()==="EXT")
      ? "de entrada exterior existente, en el que se colocará la nueva llave general de corte."
      : "más cercano del interior, colocando una nueva llave general de corte y anulando la antigua.";
    return "<b>PEINE "+(i+1)+":</b> alimenta "+(esSimple?"1":"2")+" vivienda"+(esSimple?"":"s")+" por planta"+puerta+
      " y tiene un trayecto "+tray+subeTxt+bajaTxt+", conectando por el punto "+conexion;
  }
  var montantesHtml = peines.length
    ? peines.map(function(pe,i){ return '<p class="memp">'+_p5esc(peineTxt(pe,i)).replace(/&lt;/g,"<").replace(/&gt;/g,">")+'</p>'; }).join("")
    : '<p class="memp p5pend">(sin peines en la toma de datos)</p>';

  // ===== PÁGINA 2 =====
  var pagAB = `<div class="sheet memo">
  <div class="memh">1.- Memoria de la Instalación</div>
  <div class="memsub">A) Descripción del edificio:</div>
  <p class="meml"><b>NÚMERO DE PLANTAS DEL EDIFICIO:</b> Planta baja${plantas?(" + "+plantas+" plantas"):""}${hayAtico?" + ático":""}</p>
  <p class="meml"><b>ALTURA ÚLTIMO RECEPTOR:</b> ${altura?(_p5numES((plantas+1+(hayAtico?1:0))*altura)+"m"):""}</p>
  <p class="meml"><b>TOMA DE COMUNIDAD:</b> ${nCom>0?"Sí":"No"}</p>
  <p class="meml"><b>DESCRIPCIÓN DEL EDIFICIO:</b><br>
  Finca Urbana, situada en ${_p5esc(viaC)}${numC?(" nº "+_p5esc(numC)):""} de ${_p5esc(pobC)}, ${_p5esc(cp)} - Sevilla.</p>
  <p class="meml">Está compuesta por planta baja${plantas?(" + "+plantas+" plantas"):""}${hayAtico?" + ático":""}, con un total de ${_p5listaES([nViv+" vivienda"+(nViv===1?"":"s"), localesTot>0?(localesTot+" local"+(localesTot===1?"":"es")):"", nCom>0?(nCom+" punto"+(nCom===1?"":"s")+" de comunidad (en "+_p5esc(_p5listaES(comNoms))+")"):""])}.${localesCon>0?(" "+localesCon+" local"+(localesCon===1?" tiene":"es tienen")+" suministro propio, por lo que dejaremos previsto su alojamiento."):""}</p>${fachReg?('<p class="meml">El Registro de Emasesa se encuentra a pie de calle (en la parte '+fachReg+' del edificio).'+(/-TRASLADAR/i.test(String(vg(_P5V.llaveAcerado)||""))?" El presente presupuesto únicamente será válido si, una vez aceptado, se obtiene el visto bueno de EMASESA para su traslado; si no, habrá de ser revisado.":"")+'</p>'):""}
  <table class="memtab"><thead><tr><th>Destino del suministro</th><th>Nº de viviendas o locales</th><th>Clasificación</th><th>Actividad</th></tr></thead><tbody>
    ${rowsTipo.map(function(r){ return '<tr><td>'+r[0]+'</td><td class="c">'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>'; }).join("")}
    <tr><td>Con más de un punto de agua</td><td class="c">${vivMasEnt}</td><td></td><td></td></tr>
  </tbody></table>
  <p class="meml"><b>DESCRIPCIÓN DE LA DISTRIBUCIÓN DE LAS VIVIENDAS:</b><br>Hay ${_p5esc(_p5listaES(_distParts.concat(nCom>0?[nCom+" toma"+(nCom===1?"":"s")+" de comunidad TIPO A"]:[])))}.</p>
  <p class="meml"><b>IDENTIFICACIÓN DE LAS VIVIENDAS:</b><br>${(function(){var cl=[];if(pbaja)cl.push("la planta baja tiene las puertas "+_p5esc(pbaja));if(presto)cl.push("cada planta tiene las puertas "+_p5esc(presto));if(patico)cl.push("el ático tiene las puertas "+_p5esc(patico));var t=_p5listaES(cl);return t?(t.charAt(0).toUpperCase()+t.slice(1)+"."):"";})()}</p>
  <p class="meml"><b>ACOMETIDA:</b><br>Es de material y diámetro desconocido.</p>
  <p class="meml"><b>TUBO DE CONEXIÓN:</b><br>${_matCx?("Es de "+_p5esc(matCxTxt)+(diaCxTxt?(", "+_p5esc(diaCxTxt)):"")+(fachReg?(" y cruza la línea de fachada "+fachReg+" hasta llegar al contador."):".")):"—"}</p>
  <p class="meml"><b>CONTADOR:</b><br>El contador${vg(_P5V.contadorNum)?(" (nº "+_p5esc(vg(_P5V.contadorNum))+")"):""} está ubicado en ${_p5esc((vg(_P5V.ubicContador)||"zonas comunes").toLowerCase())} del edificio.</p>
  <p class="meml"><b>ABASTECIMIENTO ACTUAL:</b><br>${vg(_P5V.matMontante)?("Los montantes actuales son de "+_p5esc(vg(_P5V.matMontante).toLowerCase())+"."+_p5esc(_peinesAct)):"—"}</p>
  <p class="meml"><b>Nº DE CONEXIONES A VIVIENDAS:</b><br>Las viviendas tienen una entrada de agua${vivMasEnt>0?(" ("+vivMasEnt+" de ellas "+(vivMasEnt===1?"tiene":"tienen")+" más de una)"):""}, siendo en total ${_p5listaES([(nViv+entradasMas)+" "+((nViv+entradasMas)===1?"conexión":"conexiones")+" a vivienda", localesSin>0?(localesSin+" "+(localesSin===1?"conexión":"conexiones")+" a local"+(localesSin===1?"":"es")):"", nCom>0?(nCom+" "+(nCom===1?"conexión":"conexiones")+" a comunidad"):""])}.</p>
  <p class="meml"><b>TIENE GRUPO HIDRONEUMÁTICO:</b><br>${(String(m.gpMotAct==null?"":m.gpMotAct).trim()!=="")?"Sí":"No"}.</p>
  <p class="meml"><b>TIENE ALJIBE:</b><br>No.</p>

  <div class="memsub">B) Descripción del abastecimiento propuesto</div>
  <p class="meml"><b>NUEVO GRUPO HIDRONEUMÁTICO:</b><br>${grupoTxt}</p>
  <p class="meml"><b>EMPLAZAMIENTO DEL NUEVO GRUPO:</b><br>${emplazaTxt}</p>
  <p class="meml"><b>DIÁMETRO DE LA NUEVA ACOMETIDA:</b><br>${diamAcomTxt}</p>
  <p class="meml"><b>DIÁMETRO DEL TUBO DE CONEXIÓN:</b><br>${diamCxTxt3}</p>
  <p class="meml"><b>LONGITUD DEL TUBO DE CONEXIÓN:</b><br>${longCxTxt}</p>
  <p class="meml"><b>MATERIAL DEL TUBO DE CONEXIÓN:</b><br>${_p5pt(matCxTxt3)}</p>
  <p class="meml"><b>DIÁMETRO DEL TUBO DE ALIMENTACIÓN:</b><br>${diamAliTxt}</p>
  <p class="meml"><b>LONGITUD DEL TUBO DE ALIMENTACIÓN:</b><br>${longAliTxt}</p>
  <p class="meml"><b>MATERIAL DEL TUBO DE ALIMENTACIÓN:</b><br>${_p5pt(matAliTxt)}</p>
  <p class="meml"><b>TRAZADO DEL TUBO DE ALIMENTACIÓN:</b><br>${trazAliTxt}</p>
  <p class="meml"><b>SITUACIÓN DE LA LLAVE GENERAL DE CORTE:</b><br>${llaveTxt}</p>
  <div class="memsub2">DESCRIPCIÓN:</div>
  <p class="meml"><b>ACOMETIDA:</b><br>Será de ${matConexNew}, de diámetro ${diamAcomTxt}</p>
  <p class="meml"><b>TUBO DE CONEXIÓN:</b><br>${descCxTxt}</p>
  <p class="meml"><b>TUBO DE ALIMENTACIÓN:</b><br>${descAliTxt}</p>
  <p class="meml"><b>BATERÍA DE CONTADORES:</b><br>${bateriaTxt}</p>
  <p class="meml">${armarioTxt}</p>
  <p class="meml">En la puerta de dicho cuarto/armario se instalará, en lugar destacado y de forma visible, un esquema señalizando debidamente los distintos montantes, salidas de batería y su correspondencia con las viviendas/locales.</p>

  <p class="meml">Dispondrá de un sumidero para evitar posibles fugas (no se instalará desagüe cuando el cuarto/armario se encuentre en patios, zonas exteriores o en habitáculos que ya dispongan del mismo).</p>
  <table class="memtab"><thead><tr><th>Batería nº</th><th>Nº de tomas</th><th>Nº de filas</th><th>Emplazamiento</th></tr></thead><tbody>
    <tr><td class="c">1</td><td class="c">${batTomas}</td><td class="c">${batFilas}</td><td>${_f154}</td></tr>${bat2Tomas?('<tr><td class="c">2</td><td class="c">'+bat2Tomas+'</td><td class="c">'+bat2Filas+'</td><td>'+_f154+'</td></tr>'):''}
  </tbody></table>
</div>`;

  var pagMont = `<div class="sheet memo">
  <div class="memsub2">MONTANTES:</div>
  <p class="meml">Partirán desde la batería de contadores, alimentando las distintas viviendas con la siguiente distribución:</p>
  ${montantesHtml}

  <div class="memsub2">GRUPOS DE PRESIÓN:</div>
  <p class="meml">${gpDescTxt}</p>
  <div class="memsub2">AISLAMIENTO TÉRMICO:</div>
  <p class="meml">Los montantes exteriores irán aislados con coquilla y forrados con canaleta de aluminio blanco para garantizar su aislamiento y protección.<br>Cuando discurran por suelo, irán forrados con fábrica de ladrillo protegida con pintura impermeabilizante.</p>
  <div class="memsub2">ALBAÑILERÍA:</div>
  <p class="meml"><i>Zonas comunes</i><br>Se contempla la demolición y reposición necesarias para la desconexión y conexión.<br>La tubería de alimentación irá forrada bajo canaleta de aluminio blanco, bajo falsa viga de escayola de nueva construcción o bajo falso techo existente, según sea el caso.<br>${armarioAlbTxt}</p>
  <p class="meml"><i>Interior de viviendas</i><br>En caso de conexión por el punto más cercano del interior de las cocinas, o por el punto más cercano del interior de las viviendas (máx. 5m), se incluye el "regolado" de las tuberías y la mano de obra de reposición de los elementos decorativos afectados, los cuales deberán ser aportados por los propietarios.<br>Si la conexión de entrada no se hace en la llave de paso existente, será obligatorio anular dicha llave para separarla de la instalación común antigua.</p>
  <div class="memsub">C) Plazo de ejecución de los trabajos presupuestados</div>
  <p class="meml">La fecha de inicio de los trabajos será de común acuerdo con la Comunidad de Propietarios, y siempre que el pago haya sido efectuado.</p>

</div>`;

  return pagAB + pagMont;
}
// Páginas 11-12: Anexo de financiación Prodinamia (reproducido como HTML para que imprima con el documento).
// Tabla de cuotas = amortización francesa sobre importe×1,01 (comisión apertura 1%); TIN 5,50% (<=84m) / 5,75% (>=96m).
function _p5prodLogo(){
  return '<img class="prodlogo" src="data:image/png;base64,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" alt="prodinamia">';
}
function _p5anexoProdinamia(R, meta, cuadro){
  var C = cuadro || {}; var f = (R && R.finca) || {};
  var importe = (C.finCom != null) ? C.finCom : 0;
  if (!importe) return ""; // sin importe financiable no hay anexo
  var vecinos = C.viviendas || 0;
  var comunidad = (f.direccion || "").trim() || "su comunidad";
  var fechaVal = _p5fecha((meta && meta.fecha) || "") || (function(){ var d=new Date(); return ("0"+d.getDate()).slice(-2)+"/"+("0"+(d.getMonth()+1)).slice(-2)+"/"+d.getFullYear(); })();
  var plazoMax = 120;

  var Pf = importe * 1.01; // 1% comisión de apertura financiada
  var plazos = [24,36,48,60,72,84,96,108,120];
  function tinDe(n){ return n <= 84 ? 0.055 : 0.0575; }
  function pmt(n){ var i = tinDe(n)/12; return Pf * i / (1 - Math.pow(1+i, -n)); }
  var filas = plazos.map(function(n){
    var c = pmt(n);
    return '<tr><td class="pz">'+n+'</td><td class="pt">'+(tinDe(n)*100).toFixed(2).replace(".",",")+'%</td>'+
           '<td class="pc">'+_p5eur(Math.round(c))+'</td><td class="pv">'+(vecinos?_p5eur(Math.round(c/vecinos)):"")+'</td></tr>';
  }).join("");

  var head = function(pag){ return `<div class="prodhead">${_p5prodLogo()}</div>`; };
  var foot = function(pag){ return `<div class="prodfoot"><div class="pf1">Para más información www.prodinamia.es o escribe a info@prodinamia.es &nbsp;·&nbsp; Válido 30 días desde el ${_p5esc(fechaVal)}</div></div>`; };

  var pag1 = `<div class="sheet prod prod1">
  ${head(1)}
  <div class="prodtit">FINANCIACIÓN COMUNIDADES DE PROPIETARIOS CON INSTALACIONES ARAUJO</div>
  <div class="prodh">¿QUIÉN ES PRODINAMIA?</div>
  <p class="prodp">INSTALACIONES ARAUJO pone a disposición de la comunidad una <b>solución completa de financiación</b>, gestionada por Prodinamia, empresa especializada en préstamos para comunidades de propietarios.</p>
  <p class="prodp">Prodinamia trabaja con distintas entidades financieras, lo que permite analizar y comparar las opciones disponibles en cada caso, seleccionando aquella que ofrece <b>mayor seguridad jurídica, estabilidad de cuota y coste para la comunidad</b>. De este modo, la comunidad recibe directamente una solución ya filtrada y optimizada para su situación concreta, <b>sin ningún coste adicional</b> y con una gestión integral de todo el proceso.</p>
  <div class="prodh">¿CÓMO FUNCIONA?</div>
  <p class="prodp">Trabajamos con financiación de consumo por la seguridad que aporta a la comunidad. En este modelo, cuando la obra y el préstamo están vinculados, si la obra no se ejecuta completamente la comunidad solo responde por la parte realmente realizada (ver web Banco de España www.bde.es). De esta forma, el banco controla y gestiona directamente los pagos al constructor, analizando, validando y supervisando de forma continua su solvencia y desempeño.</p>
  <div class="prodh">VENTAJAS CON RESPECTO A UNA FINANCIACIÓN EN OFICINA</div>
  <p class="prodp">1. A diferencia de los bancos en oficina, <b>no existen garantías solidarias</b>, evitando que a cada vecino le puedan reclamar la totalidad del préstamo comunitario.</p>
  <p class="prodp">2. El préstamo <b>se domicilia en la cuenta habitual</b> de la comunidad, sin necesidad de cambiar de banco ni contratar seguros u otros productos que encarecen la operación. La comunidad mantiene total libertad para domiciliar en otro banco en caso, por ejemplo, de subida de comisiones en su entidad habitual.</p>
  <p class="prodp">3. <b>Proceso ágil y rápida aprobación</b>, aproximadamente 3 días si se cumplen los parámetros habituales.</p>
  <div class="prodh">VENTAJAS CON RESPECTO A OTRAS OPCIONES DE FINANCIACIÓN DE CONSUMO</div>
  <p class="prodp">1. Utilizamos un modelo en el que la comunidad <b>conoce desde el primer momento la cuota</b> que va a pagar, sin variaciones. Evitamos sistemas de financiación en los que el préstamo va creciendo durante la ejecución y la cuota varía en función del momento de fin de la obra. Esto genera incertidumbre porque es imposible conocer desde el inicio cuál será la cuota final, pudiendo incrementarse de forma significativa, especialmente en comunidades con pocos vecinos y retrasos en la ejecución.</p>
  <p class="prodp">2. Controlamos la <b>seguridad de la comunidad en las cláusulas de las pólizas</b>. Evitamos siempre aquellas que incluyen obligaciones extras como la contratación de un seguro a favor del banco por el importe y plazo de la obra. Este tipo de condiciones suelen pasar desapercibidas, ya que el banco no ofrece directamente la contratación del seguro, pero no cumplirlas puede comprometer la seguridad jurídica de la comunidad.</p>
  <p class="prodp">3. <b>El tipo de interés más bajo del mercado</b> en préstamo de consumo debido al volumen tramitado por Prodinamia (mayor agente en España en este tipo de préstamos). Igualmente plazos más amplios llegando a 12 y 15 años según importe.</p>
  <div class="prodh">CUOTAS Y PLAZOS</div>
  <p class="prodp">Sobre esta base de seguridad y estabilidad, presentamos las distintas opciones de cuota y plazo para que la comunidad pueda elegir la alternativa que mejor se adapte a sus necesidades (cuota por vecino orientativa si fuese un reparto lineal).</p>
  ${foot(1)}
</div>`;

  var pag2 = `<div class="sheet prod">
  ${head(2)}
  <p class="prodp">Se trata de un préstamo para la comunidad de propietarios <span style="color:#c00">${_p5esc(comunidad)}</span> de <b><span style="color:#c00">${_p5eur(importe)}</span></b> al plazo máximo de ${plazoMax} meses para ${vecinos} vecinos.</p>
  <table class="prodtab">
    <thead>
      <tr><th></th><th></th><th class="pcm" colspan="2">CUOTA MENSUAL</th></tr>
      <tr><th>PLAZO</th><th>TIN</th><th>COMUNIDAD</th><th>POR VECINO</th></tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <p class="prodnota">* Comisión de apertura del 1% ya incluida en la cuota.</p>
  <p class="prodcond">Condiciones válidas para importe superior a 5.000 €. Importes inferiores, consultar.</p>
  <div class="prodh">DUDAS HABITUALES</div>
  <p class="prodp">El préstamo debe ser aprobado en junta con las mayorías necesarias y el presidente será el único firmante del contrato. <b>Redacción sugerida para el acta</b>:</p>
  <p class="prodacta">«Se aprueba el presupuesto número X de la empresa INSTALACIONES ARAUJO por importe de X € y se acuerda facultar al presidente para elegir entidad bancaria y solicitar a nombre de la Comunidad un préstamo por el importe del presupuesto, menos las posibles aportaciones de la comunidad con sus fondos, más la comisión de apertura financiada; este préstamo será al tipo máximo de interés X%, comisión máxima de apertura X% y plazo máximo de X meses. Se autoriza al presidente a suscribir cuantos documentos sean necesarios para su contratación.»</p>
  <p class="prodp">El único titular del préstamo es la comunidad de propietarios. El banco emite un único recibo mensual en la cuenta de la comunidad, y es el administrador quien se encarga de establecer las derramas correspondientes entre los vecinos. En caso de que un vecino no pague, la comunidad sigue haciendo frente al préstamo con sus fondos y posteriormente le reclama su deuda por las vías habituales. Es exactamente igual que con cualquier otro gasto comunitario (limpieza, agua, luz).</p>
  <p class="prodp">Distinto es el caso de impago por parte de la comunidad devolviendo el recibo del préstamo. En ese supuesto, el banco, conforme a la Ley de Propiedad Horizontal (artículo 22), puede reclamar a los propietarios que participaron del préstamo según su coeficiente, pero nunca por el total al no existir garantías solidarias.</p>
  <p class="prodp"><b><u>La solución presentada ha sido previamente analizada dentro del mercado, descartando aquellas opciones que generan mayor coste, incertidumbre en la cuota o menor seguridad jurídica. Por ello, la propuesta descrita no es una opción más, sino la mejor solución disponible para la comunidad en seguridad y precio.</u></b></p>
  <p class="prodfine">Ejemplo representativo de un préstamo al consumo. Precio de venta al contado: 10.000 €. Importe del préstamo: 10.100 €. Comisión de apertura: 1,00% financiada en las cuotas, TIN 5,95% y TAE 6,35%. Importe total abonado: 13.425,60 € en 120 cuotas mensuales de 111,88 €. Coste total del crédito: 13.425,60 €. Importe total adeudado y precio total a plazos: 13.425,60 €. Financiación ofrecida y sujeta a aprobación por Entidad de crédito registrada/autorizada por Banco de España en modalidad de crédito al consumo, sin necesidad de apertura de cuenta ni otros productos de vinculación como seguros. Sistema de amortización francés.<br>Cuota por vecino orientativa ya que se ha tenido en cuenta un coeficiente idéntico para cada una de las propiedades pudiendo oscilar si existiese un reparto de propiedades diferente.</p>
  ${foot(2)}
</div>`;

  return pag1 + pag2;
}
// SALIDA: Presupuesto en PDF (pantalla imprimible). FASE 1: portada. FASE 2: tabla del presupuesto.
function renderPresupuesto(R, meta, dsg, cuadro, saved, docsGP){
  R = R || {}; meta = meta || {};
  var f = R.finca || {};
  var rm = R.meta || {};
  var sp = _p5splitDir(meta.direccion || f.direccion || "");
  var via = _p5cap(sp.via || f.direccion || "");
  var num = (f.numero!=null && f.numero!=="") ? f.numero : sp.num;
  var poblacion = _p5cap(f.poblacion || "");
  var cp = f.cp || "";
  var provincia = "Sevilla";
  var nombre = f.nombre || f.administrador || f.presidente || "";
  var email = f.email || "";
  var tel = f.telefono || "";
  var np = meta.nPresupuesto || rm.nPresupuesto || "";
  var fecha = _p5fecha(meta.fecha || rm.fecha || "");
  var rev = _P5_REVISION;
  var condiciones = (saved && saved.condiciones != null) ? saved.condiciones : _P5_CONDICIONES;
  var pend = '<span class="p5pend">— (pendiente del expediente)</span>';
  var V = function(v){ return v ? _p5esc(v) : pend; };
  var _svM=(saved&&saved.motor)||{}, _svV=(saved&&saved.v)||[];
  var _lcM=String(_svM.longCon||"").trim().toUpperCase();
  var _matCxM=(_P5V.matConexion!=null&&_svV[_P5V.matConexion]!=null)?String(_svV[_P5V.matConexion]):"";
  var _matConexTxt=(_lcM==="NO EXISTE")?"No existe.":(_lcM==="VALIDO"?("El existente de "+_matCxM+" es válido."):"PE");
  var _matAlimTxt=(String(_svM.montaje||"").toUpperCase()==="SOLO PIECERIA")?"No existe.":"PE";
  var _gpN=function(x){return parseFloat(String(x==null?"":x).replace(",","."))||0;};
  var _bombaW=function(n){return (n===1)?"1 bomba":(n+" bombas");};
  var _depW=function(n){return (n===1)?"1 depósito":(n+" depósitos");};
  var _mNew=_gpN(_svM.gpInstala), _mAct=_gpN(_svM.gpMotAct);
  var _diamGP="";
  if(_mNew>0){ _diamGP=_bombaW(_mNew)+" de "+String(_svM.gpPotNew==null?"":_svM.gpPotNew).trim()+"Kw con calderín de "+String(_svM.gpCaldNew==null?"":_svM.gpCaldNew).trim()+"L"; }
  else if(_mAct>0){ _diamGP=_bombaW(_mAct)+" de "+String(_svM.gpPotAct==null?"":_svM.gpPotAct).trim()+"Kw con calderín de "+String(_svM.gpCaldAct==null?"":_svM.gpCaldAct).trim()+"L"; }
  var _dNew=_gpN(_svM.gpNdepNew), _dAct=_gpN(_svM.gpNdepAct);
  var _diamDep="";
  if(_dNew>0){ _diamDep=_depW(_dNew)+" de "+String(_svM.gpTdepNew==null?"":_svM.gpTdepNew).trim()+"L"; }
  else if(_dAct>0){ _diamDep=_depW(_dAct)+" de "+String(_svM.gpTdepAct==null?"":_svM.gpTdepAct).trim()+"L"; }
  var tabla = _p5tablaPresupuesto(dsg, cuadro, {conex:_matConexTxt, alim:_matAlimTxt, diamGP:_diamGP, diamDep:_diamDep});
  // Documento del grupo de presion segun los motores: actual sin nuevo -> mantenimiento;
  // ni actual ni nuevo -> renuncia; con nuevo -> ninguno. (sesion 27/06)
  var _docGP = null;
  if(docsGP){
    if(_mAct>0 && _mNew===0) _docGP = docsGP.mantener || null;
    else if(_mAct===0 && _mNew===0) _docGP = docsGP.renunciar || null;
  }
  var _comunidadGP = (via||"") + ((num!=null && num!=="") ? (" "+String(num)) : "");
  var _encabGP = (docsGP && docsGP.encabezado) || "";
  var _pieGP = (docsGP && docsGP.pie) || "";
    var _p5fname = ("Presupuesto Nº " + np + " - " + via + ((num!=null&&num!=="")?(" "+String(num)):"") + " (" + String(rev).split(" ")[0] + ") (presupuesto)(FALTA FIRMA)").replace(/[\/\\:*?"<>|]+/g," ").replace(/\s+/g," ").trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${_p5esc(_p5fname)}</title>
<script>try{window.__P5_TIT__=${JSON.stringify(_p5fname)};document.title=window.__P5_TIT__;history.replaceState(null,"","/plan5/presupuesto/"+encodeURIComponent(window.__P5_TIT__)+location.search);}catch(e){}</script>
<style>
  :root{ --navy:#004079; }
  @page{ size:A4; margin:12mm 14mm 14mm 14mm; }
  *{ box-sizing:border-box; }
  body{ font-family:Cambria,Georgia,"Times New Roman",serif; color:#111; margin:0; background:#f3f4f6; }
  .sheet{ background:#fff; width:210mm; min-height:297mm; margin:14px auto; padding:16mm 14mm; box-shadow:0 2px 12px rgba(0,0,0,.15); }
  .sheet+.sheet{ margin-top:14px; }
  .p5toolbar{ position:sticky; top:0; z-index:10; background:var(--navy); color:#fff; padding:10px 16px; display:flex; gap:12px; align-items:center; font-family:Arial,sans-serif; }
  .p5toolbar b{ font-size:14px; }
  .p5btn{ margin-left:auto; background:#fff; color:var(--navy); border:0; border-radius:6px; padding:8px 16px; font-weight:700; font-size:14px; cursor:pointer; }
  .p5pend{ color:#c0392b; font-style:italic; }
  .lg{ width:34mm; height:auto; float:right; }
  .clr{ clear:both; }
  h1.title{ text-align:center; color:var(--navy); font-size:17pt; line-height:1.45; margin:8mm 6mm 12mm; }
  .hr{ border:0; border-top:2.4pt solid var(--navy); margin:10px 0; }
  .ficha{ color:var(--navy); font-size:14pt; line-height:1.25; margin-left:2mm; }
  .empresa{ text-align:center; color:var(--navy); margin-top:9mm; line-height:1.25; font-size:14pt; }
  .rev{ text-align:right; font-size:8pt; color:#5b7fa6; margin-top:2mm; }
  /* ---- Tabla del presupuesto ---- */
  .sech{ color:var(--navy); font-size:14.3pt; font-weight:bold; border-bottom:2px solid var(--navy); padding-bottom:3px; margin:0 0 8px; }
  table.ptab{ width:100%; border-collapse:collapse; font-size:8.6pt; line-height:1.05; }
  table.ptab th{ text-align:left; font-weight:normal; font-style:italic; color:#333; border-bottom:1px solid var(--navy); padding:2px 4px; }
  table.ptab th.num{ text-align:right; }
  table.ptab td{ padding:0.8px 4px; vertical-align:top; }
  table.ptab td.num{ text-align:right; white-space:nowrap; }
  table.ptab td.mat,table.ptab td.diam{ color:#444; white-space:nowrap; }
  table.ptab tr.cap td{ font-weight:bold; color:var(--navy); border-top:1px solid var(--navy); padding-top:4px; }
  table.ptab tr.sub td{ font-weight:bold; border-top:1px solid var(--navy); }
  table.ptab tr.ln td{ border-bottom:1px dotted #d6d6d6; }
  table.ptab tr.ln td.den{ padding-left:14px; }
  .resumen{ margin-top:14px; page-break-inside:avoid; }
  .resumen .rtit{ color:var(--navy); font-weight:bold; font-size:10pt; text-align:right; margin-bottom:4px; }
  table.rtab{ width:60%; border-collapse:collapse; font-size:8.6pt; line-height:1.05; margin-left:auto; }
  table.rtab td{ padding:0.8px 4px; border-bottom:1px dotted #d6d6d6; }
  table.rtab td.num{ text-align:right; white-space:nowrap; }
  table.rtab tr.rtot td{ font-weight:bold; border-top:1px solid var(--navy); }

  /* ---- Páginas legales + firma ---- */
  .legal .legalh{ color:var(--navy); font-weight:bold; font-size:12.1pt; margin:6px 0 3px; }
  .legal .legalp{ font-size:11pt; line-height:1.22; text-align:justify; margin:0 0 4px; }
  .legal .legalul{ font-size:11pt; line-height:1.22; margin:0 0 4px; padding-left:18px; }
  .legal .legalul li{ margin-bottom:2px; }
  /* Documento del grupo de presion: mismo texto que el menu, mas aireado (no apinado) */
  .gpdoc .legalp{ font-size:11.5pt; line-height:1.9; margin:0 0 22px; text-align:left; }
  .gpdoc .gpenc .legalp{ margin:0 0 3px; line-height:1.45; }
  table.firma{ width:100%; border-collapse:collapse; margin-top:14px; font-size:11pt; page-break-inside:avoid; break-inside:avoid; }
  table.firma td{ padding:2px 6px; vertical-align:top; }
  table.firma td.fk{ width:32%; color:#222; }
  table.firma td.fleft{ width:52%; border:1px solid var(--navy); vertical-align:top; padding:6px 10px; color:#222; }
  .firma .fleft .frow{ display:flex; justify-content:space-between; padding:3px 0; }
  .firma .fleft .frow b{ white-space:nowrap; }
  .firma .fleft .fdate{ margin-top:12px; }
.firma .fleft .ftot{ font-weight:bold; padding:0; line-height:1.0; }
.firma .fleft .ffecha{ padding:0; margin-top:4px; }
.firma .fleft table.fsig{ width:100%; border-collapse:collapse; margin-top:2px; }
.firma .fleft table.fsig td{ width:50%; padding:0 6px 0 0; vertical-align:top; line-height:1.0; }
.firma .fleft .fsigwrap{ position:relative; }
.firma .fleft .fsello{ position:absolute; bottom:-1mm; right:-1mm; width:100px; height:auto; }
.condpart{ color:#c00; white-space:pre-line; line-height:1.3; margin:4px 0 6px; min-height:9.1em; }
  table.firma td.fv{ width:24%; font-weight:bold; white-space:nowrap; }
  table.firma td.fp{ width:48%; border:1px solid var(--navy); padding:6px 8px; vertical-align:top; }
  .fptab{ width:100%; border-collapse:collapse; color:var(--navy); font-weight:bold; }
.fptab td{ padding:0 2px; line-height:0.9; }
.fph{ text-align:center; font-size:11pt; padding-bottom:0; }
.fpbig{ text-align:left; font-size:11pt; }
.fplbl{ text-align:left; font-size:10pt; padding-top:0; }
  .fpg{ width:33%; }
  .fpc{ text-align:center; font-size:10pt; }
.fpbox{ position:relative; }
.fpsab{ position:absolute; right:5px; top:54%; transform:translateY(-50%); width:132px; height:auto; }
  table.firma2{ width:100%; margin-top:34px; font-size:11pt; }
  table.firma2 td{ width:50%; text-align:center; border-top:1px solid #333; padding-top:4px; }
  table.firma2 tr.fsmall td{ border-top:0; padding-top:0; font-size:9.35pt; color:#444; }

  /* ---- Análisis de subvención (clavado al PDF) ---- */
  .subv{ color:#000; line-height:1.18; }
  .subv .s2box{ border:3px solid #000; padding:7px 12px; margin:0 0 9px; box-sizing:border-box; }
  .subv .s2head{ border:3px solid #000; padding:16px 12px 20px; margin:0 0 9px; position:relative; min-height:70px; box-sizing:border-box; }
  .subv .s2sumi{ position:absolute; top:6px; right:10px; text-align:right; font-size:10pt; line-height:1.4; }
  .subv .s2tit{ text-align:center; color:var(--navy); font-style:italic; font-weight:bold; font-size:17pt; margin-top:22px; }
  .subv .s2sec{ text-align:center; font-weight:bold; font-size:10.5pt; padding-bottom:3px; margin:0 0 8px; }
  .subv table.s2grid{ width:100%; border-collapse:collapse; font-size:10.5pt; }
  .subv table.s2grid td{ padding:5px 6px; }
  .subv table.s2grid td.r{ width:42%; }
  .subv table.s2inst td{ font-size:8.6pt; padding-top:1px; padding-bottom:1px; }
  .subv .s2line{ display:flex; align-items:flex-end; font-size:10.5pt; padding:3px 0; }
  .subv .s2line .t{ white-space:nowrap; padding-bottom:1px; }
  .subv .s2line .d{ flex:1 1 auto; border-bottom:1px dotted #000; margin:0 4px 3px; }
  .subv .s2line .v{ white-space:nowrap; text-align:right; min-width:96px; padding-bottom:1px; }
  .subv .s2line.tot .t, .subv .s2line.tot .v{ font-weight:bold; }
  .subv .s2line.ind{ padding-left:40px; }
  .subv .s2line.tl .v{ border-top:1px solid #000; padding-top:2px; min-width:120px; }
  .subv .s2gap{ height:13px; }
  .subv .s2sub{ font-weight:bold; font-size:10.5pt; border-bottom:1px solid #000; padding-bottom:2px; margin:0 0 4px; }
  .subv .s2distrib{ text-align:center; font-size:9pt; font-style:italic; color:#222; margin:0 0 3px; }
  .subv table.s2pay{ width:100%; border-collapse:collapse; font-size:9.5pt; table-layout:fixed; }
  .subv table.s2pay td{ border:1px solid #000; padding:4px 5px; text-align:right; white-space:nowrap; width:16%; overflow:hidden; }
  .subv table.s2pay td.lab{ text-align:left; border:1px solid #000; padding:4px 6px; width:36%; }
  .subv table.s2pay td.nob{ border:0; padding:3px 6px 3px 0; text-align:left; }
  .subv table.s2pay td.distr{ border:0; text-align:center; font-style:italic; font-size:9pt; color:#222; }
  .subv table.s2pay td.hd{ text-align:center; font-weight:bold; font-size:8pt; height:20px; overflow:visible; padding-left:2px; padding-right:2px; }
  .subv table.s2pay td.lab .ld{ display:flex; align-items:baseline; }
  .subv table.s2pay td.lab .ld span{ white-space:nowrap; }
  .subv table.s2pay td.lab .ld i{ flex:1 1 auto; border-bottom:1px dotted #000; margin-left:4px; transform:translateY(-3px); }
  .subv table.s2pay tr.tot td{ font-weight:bold; color:var(--navy); background:#dce6f4; }
  .subv table.s2pay tr.tot td.lab{ color:#000; background:#fff; }
  .subv table.s2pay tr.res td{ font-weight:bold; color:var(--navy); background:#dce6f4; }
  .subv .s2resrow{ display:flex; justify-content:space-between; align-items:baseline; margin:0 0 4px; }
  .subv .s2res{ color:var(--navy); font-weight:bold; font-size:11pt; }
  .subv table.s2pay td.rescell{ color:var(--navy); font-weight:bold; }
  .subv .s2date{ text-align:center; margin:12px 0 8px; font-size:10pt; }
  .subv .s2foot{ font-size:8.5pt; color:#333; font-style:italic; line-height:1.6; }

  /* ---- Memoria descriptiva ---- */
  .memo .memh{ color:var(--navy); font-weight:bold; font-size:14.3pt; border-bottom:2px solid var(--navy); padding-bottom:3px; margin-bottom:8px; }
  .memo .memsub{ color:var(--navy); font-weight:bold; font-size:12.1pt; margin:10px 0 6px; }
  .memo .memsub2{ color:var(--navy); font-weight:bold; font-size:11pt; margin:8px 0 3px; }
  .memo .meml{ font-size:11pt; line-height:1.22; text-align:justify; margin:0 0 4px; }
  .memo .memp{ font-size:11pt; line-height:1.22; text-align:justify; margin:0 0 4px; }
  table.memtab{ width:100%; border-collapse:collapse; font-size:9.9pt; margin:6px 0 8px; }
  table.memtab th{ background:var(--navy); color:#fff; text-align:left; padding:3px 6px; font-weight:bold; }
  table.memtab td{ border:1px solid #bbb; padding:2px 6px; }
  table.memtab td.c{ text-align:center; }

  /* ---- Anexo Prodinamia ---- */
  .prod{ font-size:10.8pt; }
  .prodhead{ display:flex; justify-content:flex-end; align-items:center; margin-bottom:10px; }
  .prodhead .prodara{ width:26mm; height:auto; }
  .prodlogo{ height:11mm; width:auto; }
  .prodlogo .pdots{ color:#f7941d; font-size:9pt; letter-spacing:-3px; margin-right:3px; vertical-align:middle; }
  .prodlogo .pa{ color:#f7941d; }
  .prodlogo .pb{ color:#3a3a3a; }
  .prod .prodtit{ text-align:center; font-weight:bold; font-size:14pt; margin:6px 0 12px; padding:0 30mm; color:#111; }
  .prod .prodh{ color:#f7941d; font-weight:bold; font-size:10.8pt; margin:12px 0 4px; }
  .prod .prodp{ font-size:10.8pt; line-height:1.45; text-align:justify; margin:0 0 8px; }
  .prod .prodacta{ font-size:9.7pt; font-style:italic; color:#333; margin:0 0 8px; padding-left:18px; }
  .prod .prodnota{ font-size:9.2pt; color:#555; text-align:center; margin:4px 0; }
  .prod .prodcond{ font-size:10.8pt; font-weight:bold; text-align:center; margin:10px 0 4px; }
  .prod .prodfine{ font-size:7.5pt; color:#666; font-style:italic; line-height:1.35; text-align:justify; margin-top:10px; }
  .prod1 .prodp{ line-height:1.40; margin:0 0 7px; }
  .prod1 .prodh{ margin:11px 0 4px; }
  table.prodtab{ border-collapse:collapse; margin:14px auto; width:62%; font-size:10.8pt; }
  table.prodtab th{ background:#f1f1f1; color:#333; padding:4px 8px; text-align:center; border:1px solid #ccc; font-weight:bold; }
  table.prodtab th.pcm{ background:#fff; color:#111; font-size:11.9pt; }
  table.prodtab td{ padding:3px 8px; text-align:center; border:1px solid #ddd; }
  table.prodtab td.pz{ background:#fde9cf; color:#b4660a; font-weight:bold; }
  table.prodtab td.pt{ color:#b4660a; }
  table.prodtab thead tr:nth-child(2) th:nth-child(3),table.prodtab thead tr:nth-child(2) th:nth-child(4){ color:#b4660a; }
  .prodfoot{ margin-top:18px; border-top:1px solid #ddd; padding-top:4px; }
  .prodfoot .pf1{ text-align:center; font-size:8.1pt; color:#888; }
  .prodfoot .pf2{ display:flex; justify-content:space-between; font-size:8.1pt; color:#aaa; margin-top:2px; }

  /* ---- Encabezado y pie repetidos ---- */
  table.docwrap{ width:100%; border-collapse:collapse; }
  table.docwrap > thead > tr > td, table.docwrap > tfoot > tr > td, table.docwrap > tbody > tr > td{ padding:0; border:0; }
  table.docwrap > thead{ display:table-header-group; }
  table.docwrap > tfoot{ display:table-footer-group; }
  .sheet.prod{ page-break-before:always; break-before:page; }
  .dochead{ height:30mm; position:relative; }
  .dochead .dhlogo{ height:25.5mm; width:auto; float:right; }
  .dochead .dhline{ clear:both; border-top:1.6pt solid var(--navy); position:absolute; left:0; right:0; bottom:1mm; }
  .docfoot{ padding-top:3mm; }
  .docfoot .dfline{ border-top:1.6pt solid var(--navy); }
  .docfoot .dfnp{ font-size:14pt; color:var(--navy); padding-top:2px; }
  @media print{
    body{ background:#fff; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .p5toolbar{ display:none; }
    .sheet{ width:auto; min-height:0; margin:0; padding:0; box-shadow:none; }
    .sheet.subv{ min-height:0; }   /* 271(area) - 30(head) - ~9(foot); 1mm de margen para no desbordar */
    .sheet+.sheet{ margin-top:0; page-break-before:always; }
  }
</style>
</head>
<body>
<div class="p5toolbar">
  <b>Presupuesto - ${_p5esc(np)||"(sin nº)"}</b>
  <span style="font-size:12px;opacity:.85">Pulsa "Imprimir" y elige "Guardar como PDF"</span>
  <button class="p5btn" onclick="window.print()">&#128424; Imprimir / Guardar PDF</button>
</div>

<table class="docwrap"><thead><tr><td>
<div class="dochead"><img class="dhlogo" src="data:image/png;base64,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" alt="Instalaciones Araujo"><div class="dhline"></div></div>
</td></tr></thead><tfoot><tr><td>
<div class="docfoot"><div class="dfline"></div><div class="dfnp">Presupuesto Nº ${_p5esc(np)||""}</div></div>
</td></tr></tfoot><tbody><tr><td>

<div class="sheet">
  
  <div class="clr"></div>

  <h1 class="title">PRESUPUESTO DE ADAPTACIÓN<br>DE LAS INSTALACIONES INTERIORES DE AGUA<br>DE LOS EDIFICIOS ACOGIDOS AL PLAN DE SUSTITUCIÓN<br>DE CONTADORES GENERALES POR INDIVIDUALES<br>EN BATERÍA</h1>

  <hr class="hr">
  <div class="ficha">
    Presupuesto Nº:&nbsp;${V(np)}<br>
    Fecha:&nbsp;${V(fecha)}<br>
    Dirección:&nbsp;${V(via)}<br>
    Edificio nº:&nbsp;${V(num)}<br>
    Población:&nbsp;${V(poblacion)}<br>
    C.P.:&nbsp;${V(cp)}<br>
    Provincia:&nbsp;${V(provincia)}<br>
    Nombre:&nbsp;${V(nombre)}<br>
    Email:&nbsp;${V(email)}<br>
    Telefono:&nbsp;${V(tel)}
  </div>

  <div class="empresa">
    Instalaciones Araujo (Ara Corporate Sdad. Inv. SL) - En adelante "LA EMPRESA".<br>
    B-90.488.222<br>
    Avenida de San Francisco Javier - Edificio Sevilla 2, planta 6, módulo 9<br>
    comercial@instalacionesaraujo.com<br>
    www.instalacionesaraujo.com
  </div>
  <div class="rev">${_p5esc(rev)}</div>
  <hr class="hr">
</div>

${ _p5memoria(R, meta, saved) }

${ tabla ? `<div class="sheet">
  <div class="sech">2.- Presupuesto general de la Obra</div>
  ${tabla}
</div>` : "" }
${ _p5paginasLegales(meta, cuadro, condiciones) }
${ _p5paginaSubvencion(R, meta, cuadro) }
${ _p5paginaImagenes(R, meta, cuadro, saved) }
${ _p5paginaGrupoPresion(_docGP, _comunidadGP, _encabGP, _pieGP) }
</td></tr></tbody></table>
${ _p5anexoProdinamia(R, meta, cuadro) }
</body>
</html>`;
}
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
function calcCuarto(nsum, b39, bat1, bat2, precios, obra) {
  const O = (obra && obra.cuarto) || OBRA_DEFAULT.cuarto;
  const pctAcc  = (O.pctAccesorios  != null) ? O.pctAccesorios  : 0.1;
  const diasDes = (O.diasDesmontaje != null) ? O.diasDesmontaje : 0.25;
  const esObra = /OBRA/i.test(b39 || "");
  const capB = capCuarto(b39 || "");
  const MO = "1.6.1 Mano de obra";
  const L = [];
  // precioFijo (6º arg) -> precio ya calculado (accesorios %) o buscado por concepto base (albañil)
  const add = (c, v, cant, tc, cap, precioFijo) => L.push({ concepto: c, variante: v, cantidad: cant,
    precio: (precioFijo != null ? precioFijo : precioDe(precios, c, v)), tipoCoste: tc, capitulo: cap });
  // Material previo (baterías + llaves + flexo): base para el % de accesorios (como Excel D146=SUM(F142:F145)*G146)
  add("Batería de contadores (PPR)", bat1 || "", (bat1 ? 1 : 0), "MAT", "1.3.1.1 Batería de contadores");
  add("Batería de contadores (PPR)", bat2 || "", (bat2 ? 1 : 0), "MAT", "1.3.1.2 Batería de contadores");
  add("Llaves escuadra (entrada y salida)", "1'", nsum, "MAT", "1.3.2 Juego de llaves de escuadra (entrada y salida)");
  add("Flexo", "3/4'", nsum, "MAT", "1.3.3 Flexo");
  const baseMat = L.reduce((a, l) => a + (l.cantidad || 0) * (l.precio || 0), 0);
  add("Accesorios, pequeño material y comprobación", "---", 1, "MAT", "1.3.4 Accesorios y pequeño material", +(pctAcc * baseMat).toFixed(2));
  add("Pintura", "ud", 1, "ALB", capB);
  add("Punto de luz", "ud", 1, "ALB", "2.2 Punto de luz");
  add("Desagüe", "ud", 1, "ALB", "2.3 Sumidero de agua");
  add("Cerradura", "ud", 1, "ALB", "1.5.1 Cerradura homologada armario-batería");
  add("Armario aluminio con cerradura", "aluminio", (b39 === "ALUMINIO" ? 1 : 0), "ALB", capB);
  add("Albañilería (tabique + enfoscado)", "ud", (esObra ? 1 : 0), "ALB", capB);
  add("Puerta", (b39 || ""), (esObra ? 1 : 0), "ALB", capB);
  const baterias = (bat1 ? 1 : 0) + (bat2 ? 1 : 0);
  add("Fontanero (montaje batería contadores)", "cuadrilla x2", (baterias ? 1 : 0), "MO", MO);
  add("Fontanero (desmontaje contador + conexión)", "cuadrilla x2", diasDes, "MO", "1.2.7 Desmontaje contador general y conexión ");
  // Nombre muestra el tipo, pero el precio se busca por el concepto BASE (446 fijo, como el Excel: cuadrilla)
  add("Albañil (ejecución cuarto contadores " + (b39 || "") + ")", "cuadrilla x2", (esObra ? 1 : 0), "MO", capB,
      precioDe(precios, "Albañil (ejecución cuarto contadores)", "cuadrilla x2"));
  let total = 0; for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  return { lineas: L, total: +total.toFixed(2) };
}

// ===== OTROS TIEMPOS / TRABAJOS (filas 216-217 del oro) =======================
function calcOtros(otrosTiempos, otrosEur, precios, viviendas) {
  const L = [];
  const add = (c, v, cant, pr, tc, cap) => L.push({ concepto: c, variante: v, cantidad: cant, precio: pr, tipoCoste: tc, capitulo: cap });
  add("Fontanero", "cuadrilla x2", (+otrosTiempos || 0), precioDe(precios, "Fontanero", "cuadrilla x2"), "MO", "1.6.1 Mano de obra");
  add("Otros trabajos extra", "ud", 1, (+otrosEur || 0), "ALB", "2.6 Otros trabajos extra");
  add("Seguridad y Salud", "ud", 1, precioDe(precios, "Seguridad y Salud", "ud"), "MAT", "5.1 Estudio, medidas y elementos de seguridad");
  add("Nota Simple", "Registro propiedad", (+viviendas || 0), precioDe(precios, "Nota Simple", "Registro propiedad"), "MAT", "5.1 Estudio, medidas y elementos de seguridad");
  let total = 0; for (const l of L) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0))).toFixed(2); total += l.parcial; }
  return { lineas: L, total: +total.toFixed(2) };
}

// ===== GRUPO DE PRESION (filas 209-214 del oro) ==============================
// ===== PEINES (geometría server-side) — verificado vs Excel + Sánchez Pizjuán ============
// MODELO FÍSICO de los peines (razonado con Guille, jun-2026). Lo que medimos como "vertical".
//
//  · Un peine SIMPLE = un montante independiente por vivienda, que sale del cuarto de contadores
//    (cota cero) y sube hasta ENCIMA de su vivienda (la tubería entra por arriba). Por eso la vivienda
//    de la planta p (0 = baja, 1 = primera, ... n) mide (p+1) alturas de planta. El tubo de un simple
//    es la suma de esos montantes; la ALTURA del peine la marca el montante más largo; viviendas = nº
//    de montantes.
//  · Un peine DOBLE = dos montantes por planta (dos viviendas por rellano): dobla tubo y viviendas,
//    pero la altura del peine es la misma que el simple (el montante más largo llega igual de alto).
//  · Prefijo 1-/2- = nº de viviendas que FALTAN en la planta baja -> se quitan los montantes más
//    CORTOS (los de 1 altura). Restan poco tubo y NO bajan la altura del peine.
//  · Sufijo -1/-2 = últimas viviendas que faltan ARRIBA -> se quitan los montantes más LARGOS.
//    Restan mucho tubo y SÍ bajan la altura del peine.
//  · Sufijo +1/+2 = viviendas ÁTICO (sobre la última planta): montantes nuevos de altura (n+2).
//
// Verificado contra los 19 tipos de la hoja PEINES del Excel: 16 clavan; DOBLE-1 y DOBLE-2 del Excel
// están MAL (quitan por abajo en vez de por arriba) y aquí se calculan bien por el modelo físico.
function parsePeine(t) {
  t = String(t || "").trim();
  var a = 0, d = 0;
  if (t.slice(0, 2) === "1-") { a = 1; t = t.slice(2); }
  else if (t.slice(0, 2) === "2-") { a = 2; t = t.slice(2); }
  else if (t.slice(0, 2) === "1+") { d = 1; t = t.slice(2); }
  else if (t.slice(0, 2) === "2+") { d = 2; t = t.slice(2); }
  else if (t.slice(0, 2) === "3+") { d = 3; t = t.slice(2); }
  var b = 0, c = 0, s = t.slice(-2);
  if (s === "+1") { c = 1; t = t.slice(0, -2); }
  else if (s === "+2") { c = 2; t = t.slice(0, -2); }
  else if (s === "-1") { b = 1; t = t.slice(0, -2); }
  else if (s === "-2") { b = 2; t = t.slice(0, -2); }
  return { base: t, a: a, b: b, c: c, d: d };   // a = faltan en baja, b = faltan arriba, c = áticos, d = sumadas en baja (locales)
}
// Lista de alturas (en nº de alturas de planta) de los montantes del peine.
function alturasPeine(base, a, b, c, n, d) {
  var k = (base === "DOBLE") ? 2 : 1, alt = [], p, col, i;
  for (p = 0; p <= n; p++) for (col = 0; col < k; col++) alt.push(p + 1);
  for (i = 0; i < a && alt.length; i++) alt.splice(alt.indexOf(Math.min.apply(null, alt)), 1);     // faltan en baja (cortos)
  for (i = 0; i < b && alt.length; i++) alt.splice(alt.lastIndexOf(Math.max.apply(null, alt)), 1); // faltan arriba (largos)
  for (i = 0; i < c; i++) alt.push(n + 2);                                                          // áticos
  for (i = 0; i < (d || 0); i++) alt.push(1);                                                       // sumadas en baja (locales): 1 planta de tubo
  return alt;
}
function geomPeine(t, h, n) {
  var P = parsePeine(t), alt = alturasPeine(P.base, P.a, P.b, P.c, n, P.d), tubo = 0, i;
  for (i = 0; i < alt.length; i++) tubo += alt[i];
  return { tubo: tubo * h, viv: alt.length, peine: alt.length ? Math.max.apply(null, alt) * h : 0 };
}
function pTuboS(t, h, n) { return geomPeine(t, h, n).tubo; }   // m de tubo VERTICAL del peine
function mPeineS(t, h, n) { return geomPeine(t, h, n).peine; } // m de peine VERTICAL (altura del peine)
function vivS(t, n) { return geomPeine(t, 1, n).viv; }         // nº de viviendas del peine

// Tipos válidos (23): 8 SIMPLE {prefijo "",1- · sufijo "",+1,-1,-2 ; SIN +2} + 15 DOBLE {prefijo "",1-,2- · sufijo "",+1,+2,-1,-2}.
var KNOWN_PEINE = (function () {
  var ok = {}, pres, sufs, p, s;
  pres = ["", "1-", "1+", "2+", "3+"]; sufs = ["", "+1", "-1", "-2"];
  for (p = 0; p < pres.length; p++) for (s = 0; s < sufs.length; s++) ok[pres[p] + "SIMPLE" + sufs[s]] = 1;
  pres = ["", "1-", "2-", "1+", "2+", "3+"]; sufs = ["", "+1", "+2", "-1", "-2"];
  for (p = 0; p < pres.length; p++) for (s = 0; s < sufs.length; s++) ok[pres[p] + "DOBLE" + sufs[s]] = 1;
  return ok;
})();
function paso2_peines(R, F) {
  // Recorre los peines y acumula los 9 agregados que consumen las partidas de montantes.
  var ag = { tuboTotal:0, tubo4y1:0, codos:0, codos4y1:0, viviendas:0, vintViv:0,
    peine:{ "B.FORJADO":0, "CANALETA":0, "F.VIGA":0, "F.TECHO":0, "B.LADRILLO":0 },
    canaletaTubo:0, canaletaPeine:0,
    enganche:{ "EXT":0, "INT-FACIL":0, "INT-MEDIO":0, "INT-DIFICIL":0 },
    diasVExt:[], avisos:[] };
  var peines = R.entrada.peines || [];
  var n = +R.entrada.plantas || 0;
  var h = +R.entrada.altura || 0;
  var QV = (F && F.OBRA && F.OBRA.montantes) || {};
  var vc1 = QV.vextC1 != null ? QV.vextC1 : 125.99, vd1 = QV.vextD1 != null ? QV.vextD1 : 2;
  var vc2 = QV.vextC2 != null ? QV.vextC2 : 126, vd2 = QV.vextD2 != null ? QV.vextD2 : 3;
  peines.forEach(function (pe, idx) {
    var t = (pe.tipo || "").trim();
    if (!t) { ag.diasVExt.push(0); return; }
    if (!KNOWN_PEINE[t]) { ag.avisos.push("Peine " + (idx+1) + ": tipo \"" + t + "\" no reconocido; revisar las 3 casillas."); ag.diasVExt.push(0); return; }
    var vEXT = (pe.peineV === "V-EXT");
    var L = pTuboS(t, h, n), L4 = pTuboS(t, h, 4), J = mPeineS(t, h, n);
    var M = vivS(t, n), M4 = vivS(t, 4);
    var Iprot = {}, Itot = 0, nTr = 0, icanal = 0;
    (pe.tramos || []).forEach(function (tr) {
      var lo = parseFloat(String(tr.long).replace(",", ".")) || 0;
      if (lo > 0) { nTr++; var pr = (tr.prot || "").trim(); if (pr) { Iprot[pr] = (Iprot[pr]||0) + lo; if (pr === "CANALETA") icanal += lo; } Itot += lo; }
    });
    var giros = +pe.giros || 0;
    var G = M*((nTr>0?nTr-1:0)+giros) + 2*M;
    var N = M4*((nTr>0?nTr-1:0)+giros) + 2*M4;
    ag.tuboTotal += M*Itot + L;
    ag.tubo4y1   += M4*Itot + L4;
    ag.codos += G; ag.codos4y1 += N; ag.viviendas += M;
    if (pe.peineV === "V-INT") ag.vintViv += M;
    Object.keys(Iprot).forEach(function (pr) { if (ag.peine[pr] != null) ag.peine[pr] += Iprot[pr]; });
    ag.canaletaTubo  += M*icanal + (vEXT ? L : 0);
    ag.canaletaPeine += icanal + (vEXT ? J : 0);
    var eng = (pe.enganche || "").trim(); if (ag.enganche[eng] != null) ag.enganche[eng] += M;
    var lv = vEXT ? L : 0, d;
    if (lv < 0.01) d = 0; else if (lv <= vc1) d = vd1; else if (lv <= vc2) d = vd2;
    else { d = 0; ag.avisos.push("Peine " + (idx+1) + ": tubo V-EXT " + lv.toFixed(0) + " m excede de 126 m; valorar los días a mano."); }
    ag.diasVExt.push(d);
  });
  R.peines = ag;
}

// ===== MONTANTES (filas 158-208 del oro) — agregados del peine -> 51 partidas ============
function calcMontantes(R, precios, obra) {
  var ag = R.peines || {};
  var pe = ag.peine || {}, en = ag.enganche || {}, dv = ag.diasVExt || [];
  var Q = (obra && obra.montantes) || {};
  var merma  = Q.merma   != null ? Q.merma   : 0.1;
  var sujSp  = Q.sujSp   != null ? Q.sujSp   : 2;
  var guia   = Q.guia    != null ? Q.guia    : 0.04;
  var torn   = Q.torn    != null ? Q.torn    : 0.3;
  var fviga  = Q.fviga   != null ? Q.fviga   : 1;
  var ftDiv  = Q.ftDiv   != null ? Q.ftDiv   : 2;
  var albTG  = Q.albTG   != null ? Q.albTG   : 0.03;
  var albLad = Q.albLad  != null ? Q.albLad  : 0.1;
  var vintF  = Q.vintF   != null ? Q.vintF   : 4.5/8;
  var chA    = Q.chA     != null ? Q.chA     : 0.05;
  var chB    = Q.chB     != null ? Q.chB     : 0.2;
  var chDiv  = Q.chDiv   != null ? Q.chDiv   : 2;
  var fontCh = Q.fontCh  != null ? Q.fontCh  : 1/2/8;
  var dEXT   = Q.dEXT    != null ? Q.dEXT    : 1/8;
  var dFac   = Q.dFac    != null ? Q.dFac    : 1/8;
  var dMed   = Q.dMed    != null ? Q.dMed    : 2/8;
  var dDif   = Q.dDif    != null ? Q.dDif    : 4/8;
  var tipo = R.entrada.tipoSuministro || "";
  var nPl  = +R.entrada.plantas || 0;
  var nsum = +R.entrada.nsum || 0;
  var DE = (tipo === "TIPO D" || tipo === "TIPO E");
  var over4 = nPl > 4;
  var L = [];
  function add(concepto, variante, cant, tc, cap) {
    var pr = precioDe(precios, concepto, variante);
    L.push({ concepto: concepto, variante: variante, cantidad: cant, precio: pr, parcial: +(((cant||0)*(pr||0)).toFixed(2)), tipoCoste: tc, capitulo: cap });
  }
  var MAT4 = "1.4.4 Accesorios y pequeño material", MO = "1.6.1 Mano de obra", T25 = "2.5 Techos falsos escayola y formación vigas falsas";
  // tubo distribución 25/32 (reparto por plantas+tipo) + merma
  var tubo25 = (over4 && DE) ? ag.tubo4y1 : ag.tuboTotal;
  var tubo32 = (over4 && DE) ? (ag.tuboTotal - ag.tubo4y1) : 0;
  var c158 = tubo25 * (1 + merma), c159 = tubo32 * (1 + merma);
  add("Tubo distribución (PERT)", 25, c158, "MAT", "1.4.1 Tubo distribución (25)");
  add("Tubo distribución (PERT)", 32, c159, "MAT", "1.4.2 Tubo distribución (32)");
  // codos 25/32
  add("Codo (PERT)", 25, (over4 && DE) ? ag.codos4y1 : ag.codos, "MAT", MAT4);
  add("Codo (PERT)", 32, (over4 && DE) ? (ag.codos - ag.codos4y1) : 0, "MAT", MAT4);
  add("Codo (PERT)", "3/4' (25mm)", 2 * nsum, "MAT", MAT4);
  // sujección / guía / tornillo / llave
  var suj25 = sujSp ? c158 / sujSp : 0, suj32 = sujSp ? c159 / sujSp : 0;
  add("Sujección tuberías (PERT)", 25, suj25, "MAT", MAT4);
  add("Sujección tuberías (PERT)", 32, suj32, "MAT", MAT4);
  add("Guia de sujección tuberías", "ml", guia * (suj25 + suj32), "MAT", MAT4);
  add("Tornillo + taco", "ud", torn * (suj25 + suj32), "MAT", MAT4);
  add("Llave paso vivienda", "3/4'", nsum, "MAT", "1.4.3 Llaves de paso vivienda");
  // peine H por protección
  add("PEINE H (b.forjado + tubo PVC)", "ml", pe["B.FORJADO"]||0, "ALB", T25);
  add("PEINE H (f.viga + pintado)", "ml", (pe["F.VIGA"]||0), "ALB", T25);   // sin factor: 1 m de viga = 1 m de partida
  add("PEINE H (f.techo + agujero + tapado + pintado 50x50cm)", "ud", ftDiv ? (pe["F.TECHO"]||0)/ftDiv : 0, "ALB", T25);
  add("PEINE H (b.ladrillo + ladrillo + impermeabilización)", "ml", pe["B.LADRILLO"]||0, "ALB", T25);
  // días H + albañiles + V-INT
  add("Fontanero (PEINE H - H-INT y H-EXT)", "cuadrilla x2", +R.entrada.peinesHDias || 0, "MO", MO);
  add("Albañil (PEINE H - f.techo agujero + tapado + pintado)", "cuadrilla x2", ftDiv ? (pe["F.TECHO"]||0)*albTG/ftDiv : 0, "MO", MO);
  add("Albañil (PEINE H -b.ladrillo)", "cuadrilla x2", (pe["B.LADRILLO"]||0) * albLad, "MO", MO);
  add("Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)", "cuadrilla x2", (ag.vintViv||0) * vintF, "MO", MO);
  // días V-EXT: UNA línea por peine existente (peine i = "PEINE i" de toma de datos), editable por obra (override)
  for (var i = 1; i <= Math.min(dv.length, 8); i++) add("Fontanero (PEINE V-EXT -" + i + ")", "cuadrilla x2", dv[i-1] || 0, "MO", MO);
  // aislamiento + chapa
  add("Aislamiento tubo PERT (coquilla)", "25mm", ag.canaletaTubo||0, "MAT", "4.1 Forrado montantes con coquilla");
  var extraCanal = (R.entrada.montajeAli === "CANALETA") ? (+R.entrada.longAlimentacion||0)*0.3 : 0;
  var chapa = Math.ceil(((ag.canaletaTubo||0)*chA + ((ag.canaletaPeine||0)+extraCanal)*chB) / chDiv);
  add("Chapa para canaleta (aluminio)", "2m", chapa, "MAT", "4.2 Canaleta protección chapa");
  add("Fontanero (doblado chapa canaleta)", "cuadrilla x2", chapa * fontCh, "MO", "4.2 Canaleta protección chapa");
  // enganches del montante actual por dificultad
  function bloqueEng(dif, conceptoDias, factor, conMedio) {
    var q = en[dif] || 0;
    add("Entronque (latón)", "3/4' (22mm)", q, "MAT", MAT4);
    add("Manguito (cobre)", 22, q, "MAT", MAT4);
    add("Codo (cobre)", 22, q, "MAT", MAT4);
    if (conMedio) { add("Te (latón)", "3/4'", q, "MAT", MAT4); add("Machón (latón)", "3/4'", q, "MAT", MAT4); add("Tubo (cobre)", 22, q, "MAT", MAT4); }
    add(conceptoDias, "cuadrilla x2", q * factor, "MO", MO);
  }
  bloqueEng("EXT", "Fontanero (ENGANCHE - exterior)", dEXT, false);
  bloqueEng("INT-FACIL", "Fontanero (ENGANCHE - interior fácil)", dFac, false);
  bloqueEng("INT-MEDIO", "Fontanero (ENGANCHE - interior medio)", dMed, true);
  bloqueEng("INT-DIFICIL", "Fontanero (ENGANCHE - interior difícil)", dDif, true);
  var total = 0; for (var j = 0; j < L.length; j++) total += L[j].parcial;
  return { lineas: L, total: +total.toFixed(2), avisos: (ag.avisos || []) };
}

function calcGrupoPresion(e, diamAli, precios) {
  e = e || {};
  var MOD = { "1,1":"CKE 2 Multi 35 4", "1,5":"CKE 2 Multi 35 5", "2,2":"CKE 2 Multi 35 6", "3":"CKE 2 Multi 35 8", "4":"CKE 2 Multi 35 10" };
  var POT = { "1,1":"2x1,1Kw", "1,5":"2x1,5Kw", "2,2":"2x2,2Kw", "3":"2x3Kw", "4":"2x4Kw" };
  var motNew = ((parseFloat(String(e.gpInstala == null ? "" : e.gpInstala).replace(",", ".")) || 0) !== 0) ? 1 : 0;
  var motAct = parseFloat(String(e.gpMotAct == null ? "" : e.gpMotAct).replace(",", ".")) || 0;
  var pot = (e.gpPotNew == null ? "" : String(e.gpPotNew)).trim();
  var modelo = MOD[pot] || "", potConc = POT[pot] || "";
  var L = [];
  // 1. Bomba. Nueva -> con precio (catalogo serie 35). Mantiene (hay actual, no nuevo) -> actual a 0. Nada -> no aparece.
  if (motNew) {
    L.push({ concepto: "Grupo presión", variante: "", cantidad: 1,
             precio: (potConc && modelo) ? precioDe(precios, potConc, modelo) : 0,
             tipoCoste: "GP", capitulo: "3.1 Grupo de presión", modelo: modelo });
  } else if (motAct !== 0) {
    L.push({ concepto: "Grupo presión", variante: "", cantidad: 0,
             precio: 0, tipoCoste: "GP", capitulo: "3.1 Grupo de presión", modelo: "" });
  }
  // 2. By-pass: 1 si hay grupo (actual >=1 o nuevo), 0 si ninguno.
  var hayGrupo = (motAct !== 0 || motNew) ? 1 : 0;
  L.push({ concepto: "Grupo presión (by-pass + llaves + v.antiretorno + pequeño material)", variante: "ud",
           cantidad: hayGrupo, precio: precioDe(precios, "Grupo presión (by-pass + llaves + v.antiretorno + pequeño material)", "ud"),
           tipoCoste: "GP", capitulo: "3.3 By-pass + llaves + v.antiretorno + p.material" });
  // 3. Deposito: nuevo -> con precio; si no, actual -> a 0 (reutilizado); si no hay ninguno -> no aparece.
  var ndepNew = parseFloat(String(e.gpNdepNew == null ? "" : e.gpNdepNew).replace(",", ".")) || 0;
  var tdepNew = (e.gpTdepNew == null ? "" : String(e.gpTdepNew)).trim();
  var ndepAct = parseFloat(String(e.gpNdepAct == null ? "" : e.gpNdepAct).replace(",", ".")) || 0;
  var tdepAct = (e.gpTdepAct == null ? "" : String(e.gpTdepAct)).trim();
  if (ndepNew > 0) {
    var varDepN = tdepNew ? (tdepNew + "L") : "";
    L.push({ concepto: "Grupo presión (depósito)", variante: varDepN, cantidad: ndepNew,
             precio: (tdepNew ? precioDe(precios, "Grupo presión (depósito)", varDepN) : 0),
             tipoCoste: "GP", capitulo: "3.4 Depósito" });
  } else if (ndepAct > 0) {
    var varDepA = tdepAct ? (tdepAct + "L") : "";
    L.push({ concepto: "Grupo presión (depósito)", variante: varDepA, cantidad: 0,
             precio: 0, tipoCoste: "GP", capitulo: "3.4 Depósito" });
  }
  // 4. Tubo alimentacion (PE): metros de "Longitud tubo expulsion"; diametro reaprovechado de alimentacion.
  var metros = parseFloat(String(e.gpLongExp == null ? "" : e.gpLongExp).replace(",", ".")) || 0;
  var dAli = +diamAli || 0;
  L.push({ concepto: "Tubo alimentación (PE)", variante: (dAli ? dAli : ""), cantidad: metros,
           precio: (dAli ? precioDe(precios, "Tubo alimentación (PE)", dAli) : 0),
           tipoCoste: "MAT", capitulo: "3.2 Tubería de alimentación" });
  // 5. Fontanero (montaje grupo presion): dias; precio cuadrilla.
  var dias = parseFloat(String(e.gpDias == null ? "" : e.gpDias).replace(",", ".")) || 0;
  L.push({ concepto: "Fontanero (montaje grupo presión)", variante: "cuadrilla x2", cantidad: dias,
           precio: precioDe(precios, "Fontanero (montaje grupo presión)", "cuadrilla x2"),
           tipoCoste: "MO", capitulo: "1.6.1 Mano de obra" });
  var total = 0; for (var i = 0; i < L.length; i++) { L[i].parcial = +(((L[i].cantidad || 0) * (L[i].precio || 0))).toFixed(2); total += L[i].parcial; }
  return { lineas: L, total: +total.toFixed(2) };
}

// Financiacion comunitaria (Excel Presupuesto!E420/H420): sobre el total con subvencion e IVA (Analisis!O29).
// Importe = O29*(1+pct) con pct por tramos; < 5000 -> no financiable. Maximo 120 meses (nota informativa).
function finanComunitaria(o29) {
  o29 = +o29 || 0;
  if (o29 < 5000) return { financiable: false, importe: null, pct: null };
  var p = o29>=1000000?0.01 : o29>=750000?0.0115 : o29>=500000?0.013 : o29>=300000?0.015 :
          o29>=200000?0.017 : o29>=150000?0.019 : o29>=100000?0.02 : o29>=75000?0.022 :
          o29>=50000?0.024 : o29>=40000?0.0255 : o29>=30000?0.027 : o29>=20000?0.028 :
          o29>=10000?0.029 : 0.03;
  return { financiable: true, importe: +(o29*(1+p)).toFixed(2), pct: p };
}
// PMT mensual (misma formula que el motor) para la financiacion de la columna tradicional.
function _pmt(anual,n,P){ if(!P||!n) return 0; var i=Math.pow(1+(anual||0)/100,1/12)-1; return i? P*i/(1-Math.pow(1+i,-n)) : P/n; }
// Financiacion de la columna TRADICIONAL: sin subvencion, se cobra el total tradicional + contratacion,
// repartido entre los MISMOS comuneros (viviendas) que el Plan 5.
function _finanTradicional(R){
  var viv=((R.entrada&&R.entrada.nsum)||0)-((R.entrada&&R.entrada.puntosComunidad)||0); // mismos comuneros que Plan 5 (viviendas+locales; la toma de comunidad no cuenta)
  // TRADICIONAL = vuestro presupuesto A PELO. NO aplica EMASESA: ni subvencion, ni cuota/fianza de contratacion, ni hoja de Analisis.
  var totSinSubv=(R.tradicional&&R.tradicional.totalIva)||0; // la obra tal cual (= "Total con IVA" del tradicional)
  var com=viv? totSinSubv/viv : 0;                            // comunero = obra / Nº comuneros, a pelo
  var fin=(R.emasesa&&R.emasesa.financiacion)||[];
  var fc=finanComunitaria(totSinSubv); // financiable sobre la obra (sin contratacion)
  return { subvTrad:0, totSubvTrad:totSinSubv, comuneroTrad:com,
    fin6Trad: fin[0]? _pmt(fin[0].tae,fin[0].meses,com):0,
    fin12Trad: fin[1]? _pmt(fin[1].tae,fin[1].meses,com):0,
    fin18Trad: fin[2]? _pmt(fin[2].tae,fin[2].meses,com):0,
    finComTrad: fc.importe, finComPctTrad: fc.pct };
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
    const html = TOMA_DATOS_HTML.replace("__PLAN5_REV__", _P5_REVISION).replace("__PLAN5_COND__", _P5_CONDICIONES)
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
      const ex = await leerFila(b.direccion || "");
      var _prev = {};
      if (ex) { try { _prev = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { _prev = {}; } }
      var _inc = {};
      try { _inc = JSON.parse(b.payload || "{}") || {}; } catch (e) { _inc = {}; }
      ["overrides", "overridesPrecio", "overridesDato"].forEach(function (k) {
        if (_inc[k] === undefined && _prev[k] !== undefined) _inc[k] = _prev[k];
      });
      const fila = [
        normDir(b.direccion || ""),
        b.ccpp_id || "",
        b.npresupuesto || "",
        b.fecha || "",
        b.revision || "",
        new Date().toISOString(),
        JSON.stringify(_inc),
      ];
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
  async function leerMediciones(ovDato){
    try {
      var r = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: RANGO_MEDICIONES });
      return parseMediciones(r.data.values || [], ovDato);
    } catch (e) {
      console.error("[plan5] leerMediciones error:", e.message);
      return { obra: OBRA_DEFAULT, meta: {}, order: [], rowOf: {}, keyOf: {} };   // fallback: parámetros template
    }
  }

  async function p5DesgloseHandler(req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no valido");
    var token = req.query.token || "";
    // Carga lo guardado en Toma de datos (?dir=) + la tabla de precios, y calcula el desglose.
    var dsg = null;
    var cuadro = null;
    var estadoActual = "abierto";
    var cierreActual = null;
    try {
      var dir = req.query.dir || "";
      var saved = null;
      if (dir) { var f = await leerFila(dir); if (f && f.row[6]) { try { saved = JSON.parse(f.row[6]); } catch (e) { saved = null; } } }
      var sirviendoFoto = !!(saved && saved.snapshot && saved.snapshot.dsg);
      if (sirviendoFoto) {
        estadoActual = saved.estado || "cerrado"; cierreActual = saved.cierre || null;
        dsg = saved.snapshot.dsg; cuadro = saved.snapshot.cuadro || null;
      }
      var m = (saved && saved.motor) || null;        // { nsum, tipo, longCon } que guarda Toma de datos
      if (!sirviendoFoto && m && m.nsum && m.tipo && (m.longCon != null && m.longCon !== "")) {
        var precios = [];
        try { precios = await leerPrecios(); } catch (e) { precios = []; }
        var OVD = (saved && saved.overridesDato) || {};   // override de DATO por obra (factores/dias)
        var med = await leerMediciones(OVD);           // { obra, meta, order, rowOf, keyOf } con overrides aplicados
        var nViv = _contarViviendas(saved);
        var puntosCom = (saved.motor && +saved.motor.puntosComunidad) || 0;
        var R = calcular({ entrada: { nsum: +m.nsum || 0, tipoSuministro: m.tipo, longTuboConexion: (m.longCon==="VALIDO"||m.longCon==="NO EXISTE")?m.longCon:(+m.longCon || 0),
                           viviendas: nViv, puntosComunidad: puntosCom, masDeUnaEntrada: +m.masDeUnaEntrada || 0, proyecto: false,
                           grupoPresion: { seInstala: !!(+m.gpInstala || 0), tiene: false, modelo: "", deposito: "" },
                           longAlimentacion: +m.longAli || 0, montajeAli: m.montaje || "", codosTermo: +m.codos || 0,
                           llaves: +m.llaves || 0, bateria1: m.bat1 || "", bateria2: m.bat2 || "", tipoCuarto: m.tipoCuarto || "",
                           otrosTiempos: +m.otrosTiempos || 0, otrosEur: +m.otrosEur || 0, gpMotAct: +m.gpMotAct || 0, gpPotAct: m.gpPotAct || "", gpNdepAct: +m.gpNdepAct || 0, gpTdepAct: m.gpTdepAct || "", gpInstala: m.gpInstala || "", gpPotNew: m.gpPotNew || "", gpNdepNew: +m.gpNdepNew || 0, gpTdepNew: m.gpTdepNew || "", gpDias: +m.gpDias || 0, gpLongExp: +m.gpLongExp || 0, peines: (saved && saved.peines) || [], plantas: +m.plantas || 0, altura: +m.altura || 0, peinesHDias: +m.peinesHDias || 0, pctBenefVenta: m.pctBenefVenta } },
                         Object.assign({}, FUENTES, { PRECIOS_TABLA: precios, OBRA: med.obra }));
        var lineas = [{ tipo_fila: "capitulo", concepto: "1.1  TUBO DE CONEXION" }];
        var sinVar = function (v) { return v === "ud" || v === "día/cuadrilla" || v == null || v === ""; };
        var FK = { "Saco mortero": "saco_mortero", "Saco arena": "saco_arena", "Losa": "losa" };
        // Cuadrilla: localizar el tramo de días que aplica para esta longitud (el editable)
        var lc = +m.longCon || 0, tramos = (med.obra.conexion && med.obra.conexion.tiempo) || [], fidx = -1;
        for (var ti = 0; ti < tramos.length; ti++) { if (lc <= tramos[ti].hasta) { fidx = ti; break; } }
        var esCuadrilla = function (c) { return c === "Fontanero (tubo conexión)" || c === "Albañil (tubo conexión)"; };
        // Dato de cuadrilla = TODOS los tramos en una linea (0 -> [dia] -> tope -> [dia] -> tope...), el aplicado marcado en azul.
        var mkCuad = function (tabla, concepto) { return (tabla && tabla.length) ? { tipo: "tramos", unidad: "horas/cuadrilla x2", mul: 8, tramos: tabla.map(function (tr, ti) {
          return { lo: (ti === 0 ? 0 : tabla[ti - 1].hasta), hi: tr.hasta, dias: tr.dias,
                   ovkey: "TUBO DE CONEXION|" + concepto + "|Tramo " + (ti + 1) + " · días",
                   aplica: (ti === fidx) }; }) } : null; };
        var datoCuadrilla = mkCuad(tramos, "Fontanero (tubo conexión)");
        var datoCuadrillaAlb = mkCuad((med.obra.conexion && med.obra.conexion.tiempoAlb) || tramos, "Albañil (tubo conexión)");
        // Muestra los diámetros (detalle numérico puro) con "mm"; el resto (textos, ud, día) tal cual.
        var detalleMostrar = function (v) { var s = (v == null ? "" : String(v)).trim(); return /^\d+([.,]\d+)?$/.test(s) ? (s + "mm") : s; };
        R.conexion.lineas.forEach(function (l) {
          var mm = med.meta["TUBO DE CONEXION|" + l.concepto] || {};
          var dato = null;
          if (FK[l.concepto]) {
            var rw = med.rowOf["TUBO DE CONEXION|" + l.concepto + "|Unidades por metro"];
            if (rw) dato = { tipo: "factor", row: rw, valor: med.obra.conexion.factores[FK[l.concepto]], unidad: "ud/m" };
          } else if (l.concepto === "Fontanero (tubo conexión)") {
            dato = datoCuadrilla;
          } else if (l.concepto === "Albañil (tubo conexión)") {
            dato = datoCuadrillaAlb;
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
              dato = { tipo: "tramos", unidad: "horas/cuadrilla x2", mul: 8, tramos: esc.map(function (tr, ti) {
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
        // Cuarto con "Dato" editable: accesorios (% sobre material) y desmontaje (días)
        var pintarCapCuarto = function (titulo, calc) {
          if (!calc || !calc.lineas || !calc.lineas.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          var oc = med.obra.cuarto || {};
          var ACC = "Accesorios, pequeño material y comprobación";
          var DES = "Fontanero (desmontaje contador + conexión)";
          calc.lineas.forEach(function (l) {
            var dato = null, rw;
            if (l.concepto === ACC) {
              rw = med.rowOf["CUARTO DE CONTADORES|" + ACC + "|Factor sobre material (bat+llaves+flexo)"];
              if (rw) dato = { tipo: "factor", row: rw, valor: (oc.pctAccesorios != null ? oc.pctAccesorios : 0.1), unidad: "% material", mul: 100 };
            } else if (l.concepto === DES) {
              rw = med.rowOf["CUARTO DE CONTADORES|" + DES + "|días"];
              if (rw) dato = { tipo: "factor", row: rw, valor: (oc.diasDesmontaje != null ? oc.diasDesmontaje : 0.25), unidad: "horas/cuadrilla x2", mul: 8 };
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
        var pintarCapGP = function (titulo, calc) {
          if (!calc || !calc.lineas || !calc.lineas.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          calc.lineas.forEach(function (l) {
            var dato = l.modelo ? { tipo: "texto", texto: l.modelo } : null;
            lineas.push({ ud: udDe(precios, l.concepto, l.variante), concepto: l.concepto, variante: detalleMostrar(l.variante),
                          cantidad: l.cantidad, precio: l.precio, parcial: l.parcial,
                          tipo: l.tipoCoste || "", capitulo_presupuesto: l.capitulo || "", dato: dato });
          });
          lineas.push({ tipo_fila: "total", concepto: "TOTAL " + titulo, parcial: calc.total });
        };
        pintarCapAli("1.2  TUBO DE ALIMENTACION", R.alimentacion);
        pintarCapCuarto("1.3  CUARTO DE CONTADORES", R.cuarto);
        var pintarCapMont = function (titulo, calc) {
          if (!calc || !calc.lineas || !calc.lineas.length) return;
          lineas.push({ tipo_fila: "capitulo", concepto: titulo });
          var om = med.obra.montantes || {};
          var MP = {
            "Tubo distribución (PERT)": ["Merma (×)", "merma", "%", "incremento de medición en un ", " %", 100],
            "Sujección tuberías (PERT)": ["Una cada (m)", "sujSp", "m", "1 sujección cada ", " m"],
            "Guia de sujección tuberías": ["ml por sujección", "guia", "ml/ud", "", " ml por sujección"],
            "Tornillo + taco": ["ud por sujección", "torn", "ud", "", " ud por sujección"],
            "PEINE H (f.techo + agujero + tapado + pintado 50x50cm)": ["Metros por agujero", "ftDiv", "m", "un agujero cada ", " m"],
            "Albañil (PEINE H - f.techo agujero + tapado + pintado)": ["Días por agujero", "albTG", "día", "", " horas de albañil por agujero", 8],
            "Albañil (PEINE H -b.ladrillo)": ["Días por metro", "albLad", "día/m", "", " horas de albañil por metro", 8],
            "Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)": ["Días por vivienda", "vintF", "día", "", " horas por vivienda", 8],
            "Fontanero (doblado chapa canaleta)": ["Días por chapa", "fontCh", "día", "", " horas por chapa", 8],
            "Fontanero (ENGANCHE - exterior)": ["Días por vivienda", "dEXT", "día", "", " horas por vivienda", 8],
            "Fontanero (ENGANCHE - interior fácil)": ["Días por vivienda", "dFac", "día", "", " horas por vivienda", 8],
            "Fontanero (ENGANCHE - interior medio)": ["Días por vivienda", "dMed", "día", "", " horas por vivienda", 8],
            "Fontanero (ENGANCHE - interior difícil)": ["Días por vivienda", "dDif", "día", "", " horas por vivienda", 8]
          };
          var soloPrim = { "Tubo distribución (PERT)": 25, "Sujección tuberías (PERT)": 25 };
          var mrows = [];
          calc.lineas.forEach(function (l) {
            var dato = null, mp = MP[l.concepto];
            if (mp) {
              var okVar = !(l.concepto in soloPrim) || (+l.variante === soloPrim[l.concepto]);
              if (okVar) { var rw = med.rowOf["MONTANTES|" + l.concepto + "|" + mp[0]]; if (rw) dato = { tipo: "factor", row: rw, valor: om[mp[1]], unidad: mp[2], antes: mp[3] || "", despues: mp[4] || "", mul: mp[5] || 0 }; }
            }
            mrows.push({ ud: udDe(precios, l.concepto, l.variante), concepto: l.concepto, variante: detalleMostrar(l.variante),
                          cantidad: l.cantidad, precio: l.precio, parcial: l.parcial,
                          tipo: l.tipoCoste || "", capitulo_presupuesto: l.capitulo || "", dato: dato });
          });
          // Reorden SOLO VISUAL: material y mano de obra del mismo trabajo van juntos. NO toca el cálculo
          // ni la separación MAT/MO; sólo cambia el orden en que se PINTAN las filas en MEDICIONES.
          var ORD = ["Tubo distribución (PERT)", "Codo (PERT)", "Sujección tuberías (PERT)", "Guia de sujección tuberías", "Tornillo + taco", "Llave paso vivienda", "PEINE H (b.forjado + tubo PVC)", "PEINE H (f.viga + pintado)", "PEINE H (f.techo + agujero + tapado + pintado 50x50cm)", "Albañil (PEINE H - f.techo agujero + tapado + pintado)", "PEINE H (b.ladrillo + ladrillo + impermeabilización)", "Albañil (PEINE H -b.ladrillo)", "Fontanero (PEINE H - H-INT y H-EXT)", "Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)", "Aislamiento tubo PERT (coquilla)", "Chapa para canaleta (aluminio)", "Fontanero (doblado chapa canaleta)"];
          var ordKey = function (c) { var i = ORD.indexOf(c); if (i >= 0) return i; if (c.indexOf("PEINE V-EXT") >= 0) return 13.5; return 100; };  // V-EXT tras V-INT; enganches al final, en su orden
          mrows.forEach(function (r, idx) { r._k = ordKey(r.concepto); r._i = idx; });
          mrows.sort(function (a, b) { return (a._k - b._k) || (a._i - b._i); });
          mrows.forEach(function (r) { delete r._k; delete r._i; lineas.push(r); });
          lineas.push({ tipo_fila: "total", concepto: "TOTAL " + titulo, parcial: calc.total });
        };
        pintarCapMont("1.4  MONTANTES", R.montantes);
        pintarCapGP("3  GRUPO DE PRESION", R.grupo);
        pintarCap("OTROS TIEMPOS / TRABAJOS", R.otros);
        // ===== OVERRIDE POR OBRA: cantidades tecleadas a mano SOLO para esta obra (en su datos_json) =====
        // Cada partida lleva su ovkey (concepto||detalle). Si la obra tiene un override para esa clave, su
        // CANTIDAD se sustituye, se marca (ámbar en la UI) y se recalcula el parcial. Borrar el override
        // (valor vacío) -> la fila vuelve al automático. Caso prioritario: los días V-EXT por peine.
        var OV = (saved && saved.overrides) || {};
        var OVP = (saved && saved.overridesPrecio) || {};
        lineas.forEach(function (l) {
          if (l.tipo_fila) return;                                  // capítulos y totales no
          var k = String(l.concepto || "") + "||" + String(l.variante || "");
          l.ovkey = k;
          if (Object.prototype.hasOwnProperty.call(OVP, k)) {
            var p = OVP[k];
            if (p !== "" && p != null && !isNaN(+p)) { l.precio = +p; l.overP = true; }
          }
          if (Object.prototype.hasOwnProperty.call(OV, k)) {
            var v = OV[k];
            if (v !== "" && v != null && !isNaN(+v)) { l.cantidad = +v; l.over = true; }
          }
          if (l.over || l.overP) { l.parcial = +(((l.cantidad || 0) * (l.precio || 0)).toFixed(2)); }
        });
        // DATO override por obra: ovkey + ambar de cada celda Dato (factores/dias) de esta obra
        lineas.forEach(function (l) {
          if (!l.dato) return;
          if (l.dato.tipo === "tramos" && l.dato.tramos) {
            l.dato.tramos.forEach(function (t) {
              if (!t.ovkey && t.row != null) t.ovkey = (med.keyOf && med.keyOf[t.row]) || null;
              t.over = !!(t.ovkey && Object.prototype.hasOwnProperty.call(OVD, t.ovkey));
            });
          } else {
            if (!l.dato.ovkey && l.dato.row != null) l.dato.ovkey = (med.keyOf && med.keyOf[l.dato.row]) || null;
            l.dato.over = !!(l.dato.ovkey && Object.prototype.hasOwnProperty.call(OVD, l.dato.ovkey));
          }
        });
        // recomputar el TOTAL de cada capítulo después de los overrides
        var _ovsum = 0;
        lineas.forEach(function (l) {
          if (l.tipo_fila === "capitulo") _ovsum = 0;
          else if (l.tipo_fila === "total") l.parcial = +_ovsum.toFixed(2);
          else _ovsum += (l.parcial || 0);
        });
        dsg = { lineas: lineas, diam: R.conexion ? R.conexion.diam : null, error: R.conexion ? R.conexion.error : false, longCon: (+m.longCon || 0), avisos: [].concat((R.conexion && R.conexion.avisos) || [], (R.alimentacion && R.alimentacion.avisos) || [], (R.montantes && R.montantes.avisos) || []) };

        // V-EXT: si la celda de cantidad se cambio respecto al motor, el aviso lo refleja.
        try {
          var _dvArr = (R.peines && R.peines.diasVExt) || [];
          var _vxLine = {};
          (dsg.lineas || []).forEach(function (l) {
            if (!l || !l.concepto) return;
            var _mm = /^Fontanero \(PEINE V-EXT -(\d+)\)$/.exec(l.concepto);
            if (_mm) _vxLine[_mm[1]] = { cant: +l.cantidad || 0, over: !!l.over };
          });
          dsg.avisos = (dsg.avisos || []).map(function (a) {
            var _am = /^Peine (\d+): tubo V-EXT /.exec(a);
            if (!_am || a.indexOf("valorar los días a mano.") < 0) return a;
            var _li = _vxLine[_am[1]]; if (!_li) return a;
            var _motor = +_dvArr[(+_am[1]) - 1] || 0;
            if (_li.over && _li.cant !== _motor) {
              return a.replace("valorar los días a mano.", "se han valorado " + (("" + _li.cant).replace(".", ",")) + " días a mano.");
            }
            return a;
          });
        } catch (_e) {}

        // ===== CUADRO ECONOMICO (C29:F51): recalcula costes/margenes/EMASESA/financiacion con las
        // cantidades REALES que se pintan (overrides incluidos), para que cuadre con MEDICIONES. =====
        try {
          R.desglose = lineas.filter(function (l) { return !l.tipo_fila && l.tipo; }).map(function (l) {
            return { concepto: l.concepto, tipo: l.variante, cantidad: +l.cantidad || 0, precio: +l.precio || 0,
                     total: +l.parcial || 0, tipoCoste: l.tipo || "", capitulo: l.capitulo_presupuesto || "" };
          });
          paso5_agregacionYMargenes(R);
          paso6_emasesaNeto(R, FUENTES);
          var _fin = R.emasesa.financiacion || []; var _T = _finanTradicional(R);
          var _E40 = R.margenes.pctBenefManoObra || 0;
          cuadro = {
            tEjec: R.costes.tiempoEjecucion, cMat: R.costes.materiales, cMo: R.costes.manoObra,
            cAlb: R.costes.albanileria, cGp: R.costes.grupoPresion, cTot: R.costes.directo,
            bMat: R.margenes.pctBenefMateriales, bMo: _E40, c41: R.margenes.pctBenefVenta,
            btTrad: R.tradicional.beneficio, totTrad: R.tradicional.total, totTradIva: R.tradicional.totalIva, hTrad: R.tradicional.eurHora,
            bP5: R.plan5.beneficio, totP5: R.plan5.total, totP5Iva: R.plan5.totalIva, hP5: R.plan5.eurHora,
            fin6: (_fin[0] && _fin[0].cuota) || 0, fin12: (_fin[1] && _fin[1].cuota) || 0, fin18: (_fin[2] && _fin[2].cuota) || 0, finCom: finanComunitaria(R.totales.conSubvencion).importe, finComPct: finanComunitaria(R.totales.conSubvencion).pct, subvTrad: _T.subvTrad, totSubvTrad: _T.totSubvTrad, comuneroTrad: _T.comuneroTrad, fin6Trad: _T.fin6Trad, fin12Trad: _T.fin12Trad, fin18Trad: _T.fin18Trad, finComTrad: _T.finComTrad, finComPctTrad: _T.finComPctTrad,
            subv: R.emasesa.subvencion, totSubv: R.totales.conSubvencion, comunero: R.emasesa.porComunero,
            emasesa: R.emasesa, viviendas: (R.entrada && R.entrada.viviendas) || 0,
            tomasComunidad: (R.entrada && R.entrada.puntosComunidad) ? 1 : 0,
          };
        } catch (e) { console.error("[plan5] cuadro error:", e.message); cuadro = null; }
      }
    } catch (e) { console.error("[plan5] desglose error:", e.message); dsg = null; }
    if (String(req.query.format || "") === "json") return res.json({ dsg: dsg, cuadro: cuadro, estado: estadoActual, cierre: cierreActual });
    var inj = "window.__DESGLOSE__=" + JSON.stringify(dsg) + ";window.__PLAN5_TOKEN__=" + JSON.stringify(token) + ";window.__PLAN5_DIR__=" + JSON.stringify(req.query.dir || "") + ";window.__PLAN5_VOLVER_ID__=" + JSON.stringify(req.query.id || "") + ";window.__PLAN5_ESTADO__=" + JSON.stringify(estadoActual) + ";window.__PLAN5_CIERRE__=" + JSON.stringify(cierreActual) + ";";
    var theme = ""; try { theme = getThemeCss() || ""; } catch (e) { theme = ""; }
    var p5 = ""; try { p5 = getPlan5Css() || ""; } catch (e) { p5 = ""; }
    var html = DESGLOSE_HTML
      .replace("<!--__PLAN5_THEME__-->", (theme ? "<style>" + theme + "</style>" : "") + (p5 ? "<style>" + p5 + "</style>" : ""))
      .replace("/*__DESGLOSE_DATA__*/", inj)
      .replace("/*__PLAN5_MENU__*/", function () { return PLAN5_MENU_JS; });
    res.type("html").send(html);
  }
  app.get("/plan5/desglose", p5DesgloseHandler);

  // === Paso 2 (Catastro y croquis): importar la LISTA de inmuebles del Catastro ===
  // Datos NO protegidos (uso + superficie): acceso libre, sin certificado.
  // Flujo: 1 consulta por direccion (lista de RC) + 1 consulta por RC (planta/puerta/uso/sup).
  // Limite OVC: 3600 peticiones/hora por IP -> de sobra para un edificio.
  function _p5catNorm(s){ return String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase().replace(/\s+/g," "); }
  function _p5catSplit(d){ d=String(d||"").trim(); var m=/^(.*?)[\s,]+(\d+[A-Za-z]?)$/.exec(d); return m ? { via:m[1].trim(), num:m[2] } : { via:d, num:"" }; }
  function _p5catSigla(tv){
    var t=_p5catNorm(tv).replace(/[\/.]/g,"");
    var M={ "CALLE":"CL","C":"CL","CL":"CL","AVENIDA":"AV","AVDA":"AV","AV":"AV","PLAZA":"PZ","PZA":"PZ","PZ":"PZ","PASEO":"PS","PS":"PS","CARRETERA":"CR","CTRA":"CR","CR":"CR","CAMINO":"CM","CM":"CM","TRAVESIA":"TR","TR":"TR","RONDA":"RD","RD":"RD","GLORIETA":"GL","GL":"GL","URBANIZACION":"UR","UR":"UR","BARRIADA":"BO","BARRIO":"BO","BO":"BO","POLIGONO":"PG","PG":"PG","CALLEJON":"CJ","CJ":"CJ","CUESTA":"CT","PASAJE":"PJ","PJ":"PJ","PARQUE":"PQ","RAMBLA":"RB","VEREDA":"VD" };
    return M[t] || M[t.split(" ")[0]] || "CL";
  }
  function _p5catProvincia(cp){
    var p=String(cp||"").replace(/\D/g,"").slice(0,2);
    var T={ "01":"ARABA/ALAVA","02":"ALBACETE","03":"ALICANTE","04":"ALMERIA","05":"AVILA","06":"BADAJOZ","07":"ILLES BALEARS","08":"BARCELONA","09":"BURGOS","10":"CACERES","11":"CADIZ","12":"CASTELLON","13":"CIUDAD REAL","14":"CORDOBA","15":"A CORUÑA","16":"CUENCA","17":"GIRONA","18":"GRANADA","19":"GUADALAJARA","20":"GIPUZKOA","21":"HUELVA","22":"HUESCA","23":"JAEN","24":"LEON","25":"LLEIDA","26":"LA RIOJA","27":"LUGO","28":"MADRID","29":"MALAGA","30":"MURCIA","31":"NAVARRA","32":"OURENSE","33":"ASTURIAS","34":"PALENCIA","35":"LAS PALMAS","36":"PONTEVEDRA","37":"SALAMANCA","38":"SANTA CRUZ DE TENERIFE","39":"CANTABRIA","40":"SEGOVIA","41":"SEVILLA","42":"SORIA","43":"TARRAGONA","44":"TERUEL","45":"TOLEDO","46":"VALENCIA","47":"VALLADOLID","48":"BIZKAIA","49":"ZAMORA","50":"ZARAGOZA","51":"CEUTA","52":"MELILLA" };
    return T[p] || "";
  }
  function _p5catTag(xml,tag){ var m=new RegExp("<"+tag+">([\\s\\S]*?)</"+tag+">").exec(xml); return m?m[1].trim():""; }
  function _p5catError(xml){ var m=/<err>[\s\S]*?<des>([\s\S]*?)<\/des>/.exec(String(xml||"")); return m?m[1].trim():""; }
  function _p5catRCfull(b){ return _p5catTag(b,"pc1")+_p5catTag(b,"pc2")+_p5catTag(b,"car")+_p5catTag(b,"cc1")+_p5catTag(b,"cc2"); }
  function _p5catListaInmuebles(xml){
    xml=String(xml||""); var out=[];
    var blocks=xml.match(/<rcdnp>[\s\S]*?<\/rcdnp>/g);
    if(blocks){ for(var i=0;i<blocks.length;i++){ var b=blocks[i]; out.push({ rc:_p5catRCfull(b), planta:_p5catTag(b,"pt"), puerta:_p5catTag(b,"pu") }); } }
    if(!out.length){ var u=/<bi>[\s\S]*?<\/bi>/.exec(xml); if(u){ out.push({ rc:_p5catRCfull(u[0]), planta:_p5catTag(u[0],"pt"), puerta:_p5catTag(u[0],"pu") }); } }
    return out;
  }
  function _p5catNorNum(s){ s=String(s==null?"":s).trim(); return /^-?\d+$/.test(s) ? String(parseInt(s,10)) : s; }
  function _p5catInmueble(xml){ xml=String(xml||""); return { planta:_p5catTag(xml,"pt"), puerta:_p5catTag(xml,"pu"), uso:_p5catTag(xml,"luso"), sup:_p5catTag(xml,"sfc") }; }
  function _p5catFetchOnce(url){
    return new Promise(function(resolve,reject){
      try{
        var https=require("https");
        var r=https.get(url,{headers:{"User-Agent":"araujo-bot"}},function(res){
          if(res.statusCode>=300 && res.statusCode<400 && res.headers.location){ res.resume(); return _p5catFetchOnce(res.headers.location).then(resolve,reject); }
          var data=""; res.setEncoding("utf8");
          res.on("data",function(c){ data+=c; });
          res.on("end",function(){ resolve(data); });
        });
        r.on("error",reject);
        r.setTimeout(15000,function(){ r.destroy(new Error("Tiempo de espera agotado consultando el Catastro.")); });
      }catch(e){ reject(e); }
    });
  }
  // Reintenta la llamada al Catastro si se corta (ECONNRESET/timeout): 3 intentos con pausa creciente.
  async function _p5catFetch(url){
    var ultimoError;
    for(var intento=0; intento<3; intento++){
      if(intento>0){ await new Promise(function(r){ setTimeout(r, 400*intento); }); }
      try{ return await _p5catFetchOnce(url); }
      catch(e){ ultimoError = e; }
    }
    throw ultimoError;
  }
  // Resuelve la via contra el callejero oficial del Catastro (coincidencia por texto).
  async function _p5catConsultaVia(base, prov, muni, sig, nombre){
    var url = base + "/ConsultaVia?Provincia=" + encodeURIComponent(prov) + "&Municipio=" + encodeURIComponent(muni) + "&TipoVia=" + encodeURIComponent(sig||"") + "&NombreVia=" + encodeURIComponent(nombre);
    var xml = await _p5catFetch(url);
    var out = []; var blocks = String(xml||"").match(/<calle>[\s\S]*?<\/calle>/g);
    if(blocks){ for(var i=0;i<blocks.length;i++){ var tv=_p5catTag(blocks[i],"tv"); var nv=_p5catTag(blocks[i],"nv"); if(nv) out.push({ tv:tv, nv:nv }); } }
    return out;
  }
  async function _p5catResolverVia(base, prov, muni, sig, nombre){
    var vias = await _p5catConsultaVia(base, prov, muni, sig, nombre);
    if(!vias.length && sig) vias = await _p5catConsultaVia(base, prov, muni, "", nombre);
    if(!vias.length) return null;
    var exact = vias.filter(function(v){ return v.nv === nombre; });
    var pool = exact.length ? exact : vias;
    if(sig){ var same = pool.filter(function(v){ return v.tv === sig; }); if(same.length) pool = same; }
    return pool[0];
  }
  // Contorno (geometria oficial) de la parcela, para dibujar el croquis del bloque aislado.
  async function _p5catCoordParcela(prov, muni, rc14){
    try{
      var url = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetParcel&srsname=EPSG:25830&REFCAT=" + encodeURIComponent(rc14);
      var xml = String(await _p5catFetch(url) || "");
      var m = /<(?:gml:)?posList[^>]*>([\s\S]*?)<\/(?:gml:)?posList>/i.exec(xml);
      if (!m) return null;
      var nums = m[1].trim().split(/\s+/).map(parseFloat).filter(function(v){ return !isNaN(v); });
      var ring = []; for (var i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i], nums[i+1]]);
      if (ring.length < 3) return null;
      return { srs: "EPSG:25830", ring: ring };
    } catch(e){ return null; }
  }
  function _p5catAnillosRe(xml, re){
    var out = [], m;
    while ((m = re.exec(xml))) {
      var nums = String(m[1]).trim().split(/\s+/).map(parseFloat).filter(function(v){ return !isNaN(v); });
      var ring = []; for (var i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i], nums[i+1]]);
      if (ring.length >= 3) out.push(ring);
    }
    return out;
  }
  async function _p5catCoordEdificios(rc14){
    try{
      var url = "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2.0.0&request=getfeature&STOREDQUERIE_ID=GetBuildingByParcel&srsname=EPSG:25830&REFCAT=" + encodeURIComponent(rc14);
      var xml = String(await _p5catFetch(url) || "");
      if (!xml) return { edificios: [], patios: [] };
      var ext = _p5catAnillosRe(xml, /<(?:gml:)?exterior\b[\s\S]*?<(?:gml:)?posList[^>]*>([\s\S]*?)<\/(?:gml:)?posList>/gi);
      var inn = _p5catAnillosRe(xml, /<(?:gml:)?interior\b[\s\S]*?<(?:gml:)?posList[^>]*>([\s\S]*?)<\/(?:gml:)?posList>/gi);
      return { edificios: ext, patios: inn };
    } catch(e){ return { edificios: [], patios: [] }; }
  }
  app.get("/plan5/catastro", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var q = req.query || {};
      var prov = _p5catProvincia(q.cp || "");
      var muni = _p5catNorm(q.poblacion || "");
      var sig = _p5catSigla(q.tipovia || "");
      var dd = _p5catSplit(q.calle || "");
      var via = _p5catNorm(dd.via);
      var num = dd.num || _p5catNorm(q.numero || "");
      if (!prov || !muni || !via) return res.json({ ok: false, error: "Faltan datos de la direccion (poblacion, codigo postal o calle)." });
      var base = "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx";
      // 1) Resolver la via en el callejero oficial (evita fallos por sigla/nombre que no casan exacto)
      var vr = await _p5catResolverVia(base, prov, muni, sig, via);
      if (!vr) return res.json({ ok: false, error: "El Catastro no reconoce la via \"" + via + "\" en " + muni + ". Revisa el nombre o el tipo de via." });
      var sigOK = (vr && vr.tv) ? vr.tv : sig;
      var viaOK = (vr && vr.nv) ? vr.nv : via;
      var locUrl = base + "/Consulta_DNPLOC?Provincia=" + encodeURIComponent(prov) + "&Municipio=" + encodeURIComponent(muni) + "&Sigla=" + encodeURIComponent(sigOK) + "&Calle=" + encodeURIComponent(viaOK) + "&Numero=" + encodeURIComponent(num) + "&Bloque=&Escalera=&Planta=&Puerta=";
      var locXml = await _p5catFetch(locUrl);
      var ferr = _p5catError(locXml);
      if (ferr) return res.json({ ok: false, error: "Catastro: " + ferr });
      var items = _p5catListaInmuebles(locXml);
      if (!items.length) return res.json({ ok: false, error: "La via \"" + viaOK + "\" existe, pero el Catastro no devuelve inmuebles en el numero \"" + num + "\". Revisa el numero." });
      if (items.length > 75) items = items.slice(0, 75);
      var plano = null;
      try { if (items.length) { var rc14 = String(items[0].rc || "").slice(0, 14); if (rc14.length === 14) { plano = await _p5catCoordParcela(prov, muni, rc14); if (plano) { var _ed = await _p5catCoordEdificios(rc14); plano.edificios = (_ed && _ed.edificios) || []; plano.patios = (_ed && _ed.patios) || []; } } } } catch (e3) {}
      var filas = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var det = { uso:"", sup:"", planta:"", puerta:"" };
        try {
          var rcUrl = base + "/Consulta_DNPRC?Provincia=" + encodeURIComponent(prov) + "&Municipio=" + encodeURIComponent(muni) + "&RC=" + encodeURIComponent(it.rc);
          var rcXml = await _p5catFetch(rcUrl);
          det = _p5catInmueble(rcXml);
        } catch (e2) { /* si falla el detalle, quedan planta/puerta de la lista */ }
        filas.push({ planta: _p5catNorNum(it.planta || det.planta || ""), puerta: _p5catNorNum(it.puerta || det.puerta || ""), uso: det.uso || "", sup: det.sup || "" });
      }
      filas = filas.filter(function (f) { return f && (f.planta || f.puerta || f.uso || f.sup); });
      res.json({ ok: true, filas: filas, plano: plano });
    } catch (e) {
      console.error("[plan5] catastro error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
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

  app.post("/plan5/mediciones/override", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var dir = b.dir || "", key = b.ovkey || "";
      if (!dir || !key) return res.status(400).json({ ok: false, error: "faltan datos" });
      var ex = await leerFila(dir);
      if (!ex) return res.status(404).json({ ok: false, error: "obra no encontrada" });
      var saved = {};
      try { saved = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { saved = {}; }
      if (!saved.overrides) saved.overrides = {};
      var n = numEs(b.valor);
      if (b.valor === "" || b.valor == null || n == null) delete saved.overrides[key];   // vaciar -> vuelve al automático
      else saved.overrides[key] = n;
      var fila = [ ex.row[0] || "", ex.row[1] || "", ex.row[2] || "", ex.row[3] || "", ex.row[4] || "", new Date().toISOString(), JSON.stringify(saved) ];
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_toma_datos!A" + ex.idx + ":G" + ex.idx,
        valueInputOption: "RAW", requestBody: { values: [fila] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] override error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/mediciones/precio-override", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var dir = b.dir || "", key = b.ovkey || "";
      if (!dir || !key) return res.status(400).json({ ok: false, error: "faltan datos" });
      var ex = await leerFila(dir);
      if (!ex) return res.status(404).json({ ok: false, error: "obra no encontrada" });
      var saved = {};
      try { saved = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { saved = {}; }
      if (!saved.overridesPrecio) saved.overridesPrecio = {};
      var n = numEs(b.valor);
      if (b.valor === "" || b.valor == null || n == null) delete saved.overridesPrecio[key];
      else saved.overridesPrecio[key] = n;
      var fila = [ ex.row[0] || "", ex.row[1] || "", ex.row[2] || "", ex.row[3] || "", ex.row[4] || "", new Date().toISOString(), JSON.stringify(saved) ];
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_toma_datos!A" + ex.idx + ":G" + ex.idx,
        valueInputOption: "RAW", requestBody: { values: [fila] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] precio-override error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/mediciones/dato-override", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var dir = b.dir || "", key = b.ovkey || "";
      if (!dir || !key) return res.status(400).json({ ok: false, error: "faltan datos" });
      var ex = await leerFila(dir);
      if (!ex) return res.status(404).json({ ok: false, error: "obra no encontrada" });
      var saved = {};
      try { saved = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { saved = {}; }
      if (!saved.overridesDato) saved.overridesDato = {};
      var n = numEs(b.valor);
      if (b.valor === "" || b.valor == null || n == null) delete saved.overridesDato[key];
      else saved.overridesDato[key] = n;
      var fila = [ ex.row[0] || "", ex.row[1] || "", ex.row[2] || "", ex.row[3] || "", ex.row[4] || "", new Date().toISOString(), JSON.stringify(saved) ];
      await sh().spreadsheets.values.update({ spreadsheetId: sid(), range: "plan5_toma_datos!A" + ex.idx + ":G" + ex.idx, valueInputOption: "RAW", requestBody: { values: [fila] } });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] dato-override error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---- CERRAR / ABRIR presupuesto: congela una foto (snapshot) del desglose+cuadro en el datos_json ----
  app.post("/plan5/cerrar", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var dir = b.dir || "";
      if (!dir) return res.status(400).json({ ok: false, error: "falta dir" });
      var ex = await leerFila(dir);
      if (!ex) return res.status(404).json({ ok: false, error: "obra no encontrada" });
      var saved = {};
      try { saved = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { saved = {}; }
      var snap = null;
      try { snap = JSON.parse(b.snapshot || "null"); } catch (e) { snap = null; }
      if (!snap || !snap.dsg) return res.status(400).json({ ok: false, error: "snapshot vacio" });
      saved.estado = "cerrado";
      saved.snapshot = { dsg: snap.dsg, cuadro: snap.cuadro || null };
      saved.cierre = { fecha: new Date().toISOString(), revision: ex.row[4] || "" };
      var fila = [ ex.row[0] || "", ex.row[1] || "", ex.row[2] || "", ex.row[3] || "", ex.row[4] || "", new Date().toISOString(), JSON.stringify(saved) ];
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_toma_datos!A" + ex.idx + ":G" + ex.idx,
        valueInputOption: "RAW", requestBody: { values: [fila] },
      });
      // --- Volcado economico Plan 5 -> ficha del expediente (comunidades). ---
      // Solo se ejecuta AQUI (al congelar) y solo sobre ESTE expediente.
      // beneficio_previsto (AB) SI se escribe ahora: valor plano bP5 (ver mas abajo).
      try {
        var _Pf  = P();
        var _cdr = snap.cuadro;
        if (_cdr && _Pf.buscarComunidadPorId && _Pf.actualizarCampoComunidad) {
          var _ccppId = ex.row[1] || "";
          var _comuF  = _ccppId ? await _Pf.buscarComunidadPorId(_ccppId) : null;
          if (_comuF && _comuF._rowIndex != null) {
            var _riF    = _comuF._rowIndex;
            // Redondeo igual que el Sheet (importes 2 dec, tiempo 1 dec) para que la
            // verificacion de actualizarCampoComunidad (releido) cuadre y no aborte.
            var _r2 = function(x){ x = Number(x); return isFinite(x) ? Math.round(x * 100) / 100 : 0; };
            var _r1 = function(x){ x = Number(x); return isFinite(x) ? Math.round(x * 10)  / 10  : 0; };
            var _matPrev = _r2((Number(_cdr.cMat) || 0) + (Number(_cdr.cAlb) || 0) + (Number(_cdr.cGp) || 0));
            await _Pf.actualizarCampoComunidad(_riF, "pto_total",          _r2(_cdr.totP5));
            await _Pf.actualizarCampoComunidad(_riF, "mano_obra_previsto", _r2(_cdr.cMo));
            await _Pf.actualizarCampoComunidad(_riF, "material_previsto",  _matPrev);
            await _Pf.actualizarCampoComunidad(_riF, "tiempo_previsto",    _r1(_cdr.tEjec));
            // beneficio_previsto (AB): valor PLANO de Plan 5 (bP5). Va directo a la celda
            // porque actualizarCampoComunidad protege esta columna (es de formula) y la
            // rechazaria. Aqui machacamos la formula con el numero, igual que los otros 4.
            await sh().spreadsheets.values.update({
              spreadsheetId: sid(),
              range: "comunidades!AB" + _riF,
              valueInputOption: "RAW",
              requestBody: { values: [[ _r2(_cdr.bP5) ]] },
            });
          }
        }
      } catch (eVol) {
        console.error("[plan5] volcado economicos al congelar:", eVol.message);
      }
      res.json({ ok: true, fecha: saved.cierre.fecha, revision: saved.cierre.revision });
    } catch (e) {
      console.error("[plan5] cerrar error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/abrir", async function (req, res) {
    if (!validToken((req.query && req.query.token) || "")) return res.status(403).json({ ok: false, error: "token" });
    try {
      var b = req.body || {};
      var dir = b.dir || "";
      if (!dir) return res.status(400).json({ ok: false, error: "falta dir" });
      var ex = await leerFila(dir);
      if (!ex) return res.status(404).json({ ok: false, error: "obra no encontrada" });
      var saved = {};
      try { saved = JSON.parse(ex.row[6] || "{}") || {}; } catch (e) { saved = {}; }
      var modo = String(b.modo || "full");
      saved.estado = "abierto";
      if (modo === "manual") {
        delete saved.cierre;                       // editar a mano: deja la foto y solo desbloquea
      } else if (modo === "precios" && saved.snapshot && saved.snapshot.dsg) {
        delete saved.overridesPrecio;   // "solo precios": descarta precios manuales, coge los del Sheet
        try {
          var precios = await leerPrecios();        // re-precia las lineas con cantidades de la foto
          var lns = saved.snapshot.dsg.lineas || [];
          var acc = 0, reales = [];
          for (var i = 0; i < lns.length; i++) {
            var l = lns[i];
            if (l.tipo_fila === "capitulo") { acc = 0; continue; }
            if (l.tipo_fila === "total") { l.parcial = Math.round(acc * 100) / 100; continue; }
            var np = precioDe(precios, l.concepto, l.variante);
            l.precio = np;
            l.parcial = Math.round(((+l.cantidad || 0) * (np || 0)) * 100) / 100;
            acc += l.parcial; reales.push(l);
          }
          var R = resultadoVacio();
          R.entrada.viviendas = _contarViviendas(saved);
          R.entrada.nsum = (saved.motor && +saved.motor.nsum) || 0;
          R.entrada.puntosComunidad = (saved.motor && +saved.motor.puntosComunidad) || 0;
          R.entrada.grupoPresion = { seInstala: !!(saved.motor && +saved.motor.gpInstala) };
          R.dimensiones.diamAcometida = diametroConexion(R.entrada.nsum, (saved.motor && saved.motor.tipo) || "", (saved.motor && +saved.motor.longCon) || 0) || 0;
          R.emasesa.subvencion = ((R.entrada.nsum || 0) - (R.entrada.puntosComunidad || 0)) * 160;
          if (saved.motor && saved.motor.pctBenefVenta != null && saved.motor.pctBenefVenta !== "") R.margenes.pctBenefVenta = +saved.motor.pctBenefVenta;
          R.desglose = reales.map(function (l) { return { tipoCoste: l.tipo, cantidad: +l.cantidad || 0, total: +l.parcial || 0, capitulo: l.capitulo_presupuesto || "" }; });
          paso5_agregacionYMargenes(R); paso6_emasesaNeto(R, FUENTES);
          var _fin = R.emasesa.financiacion || [], _E40 = R.margenes.pctBenefManoObra || 0; var _T = _finanTradicional(R);
          saved.snapshot.cuadro = {
            tEjec: R.costes.tiempoEjecucion, cMat: R.costes.materiales, cMo: R.costes.manoObra,
            cAlb: R.costes.albanileria, cGp: R.costes.grupoPresion, cTot: R.costes.directo,
            bMat: R.margenes.pctBenefMateriales, bMo: _E40, c41: R.margenes.pctBenefVenta,
            btTrad: R.tradicional.beneficio, totTrad: R.tradicional.total, totTradIva: R.tradicional.totalIva, hTrad: R.tradicional.eurHora,
            bP5: R.plan5.beneficio, totP5: R.plan5.total, totP5Iva: R.plan5.totalIva, hP5: R.plan5.eurHora,
            fin6: (_fin[0] && _fin[0].cuota) || 0, fin12: (_fin[1] && _fin[1].cuota) || 0, fin18: (_fin[2] && _fin[2].cuota) || 0, finCom: finanComunitaria(R.totales.conSubvencion).importe, finComPct: finanComunitaria(R.totales.conSubvencion).pct, subvTrad: _T.subvTrad, totSubvTrad: _T.totSubvTrad, comuneroTrad: _T.comuneroTrad, fin6Trad: _T.fin6Trad, fin12Trad: _T.fin12Trad, fin18Trad: _T.fin18Trad, finComTrad: _T.finComTrad, finComPctTrad: _T.finComPctTrad,
            subv: R.emasesa.subvencion, totSubv: R.totales.conSubvencion, comunero: R.emasesa.porComunero,
            emasesa: R.emasesa, viviendas: (R.entrada && R.entrada.viviendas) || 0,
            tomasComunidad: (R.entrada && R.entrada.puntosComunidad) ? 1 : 0,
          };
        } catch (e) { console.error("[plan5] abrir precios error:", e.message); }
        delete saved.cierre;
      } else {
        delete saved.snapshot; delete saved.cierre; delete saved.overrides; delete saved.overridesPrecio; delete saved.overridesDato;   // full: recalcular todo en vivo (descarta ajustes manuales de cantidad)
      }
      var fila = [ ex.row[0] || "", ex.row[1] || "", ex.row[2] || "", ex.row[3] || "", ex.row[4] || "", new Date().toISOString(), JSON.stringify(saved) ];
      await sh().spreadsheets.values.update({
        spreadsheetId: sid(), range: "plan5_toma_datos!A" + ex.idx + ":G" + ex.idx,
        valueInputOption: "RAW", requestBody: { values: [fila] },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[plan5] abrir error:", e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/plan5/calcular", function (req, res) {
    const entradas = req.body || {};
    const resultado = calcular(entradas);
    res.json(resultado);
  });

  app.get("/plan5/imagen", async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).end();
    try {
      var id = req.query.id || "";
      var n = String(req.query.n || "").replace(/[^0-9]/g, "");
      if (!id || !n) return res.status(404).end();
      var c = await P().buscarComunidadPorId(id);
      if (!c || !P().getImagenExpediente) return res.status(404).end();
      var buf = await P().getImagenExpediente(c.tipo_via, c.direccion, parseInt(n, 10));
      if (!buf) return res.status(404).end();
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "private, max-age=300");
      res.send(buf);
    } catch (e) { console.error("[plan5] imagen:", e.message); res.status(500).end(); }
  });

  app.get(["/plan5/presupuesto", "/plan5/presupuesto/:nombre"], async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no valido");
    try {
      var dir = req.query.dir || "";
      var frow = null, savedExp = null;
      if (dir) { var ff = await leerFila(dir); if (ff) { frow = ff.row; try { savedExp = JSON.parse(ff.row[6]); } catch (e) { savedExp = null; } } }
      var meta = { nPresupuesto: (frow && frow[2]) || "", fecha: (frow && frow[3]) || "", rev: (frow && frow[4]) || "", direccion: (frow && frow[0]) || dir }; meta.id = req.query.id || ""; meta.token = req.query.token || "";
      // Datos CCPP del expediente (mismo origen que la pantalla Toma de datos: modulo presupuestos)
      var ficha = {};
      try {
        var id = req.query.id || "";
        if (id && P().buscarComunidadPorId) {
          var c = await P().buscarComunidadPorId(id);
          if (c) {
            var hayAdmin = !!(c.administrador && String(c.administrador).trim());
            ficha = {
              direccion: ((c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || "")).trim(),
              poblacion: c.poblacion || "",
              cp: c.cp || "",
              provincia: "Sevilla",
              presidente: c.presidente || "",
              administrador: c.administrador || "",
              nombre: hayAdmin ? (c.administrador || "") : (c.presidente || ""),
              email: hayAdmin ? (c.email_administrador || "") : (c.email_presidente || ""),
              telefono: hayAdmin ? (c.telefono_administrador || "") : (c.telefono_presidente || "")
            };
          }
        }
      } catch (e) { console.error("[plan5] presupuesto expediente:", e.message); }
      /* fotos: ahora lazy en el navegador via /plan5/imagen */
      var _pm = (savedExp && savedExp.motor) || {}; var _pNViv = (typeof _contarViviendas === "function" && savedExp) ? _contarViviendas(savedExp) : 0; var R = { finca: ficha, meta: meta, entrada: { nsum: +_pm.nsum || 0, tipoSuministro: _pm.tipo, longTuboConexion: (_pm.longCon==="VALIDO"||_pm.longCon==="NO EXISTE")?_pm.longCon:(+_pm.longCon || 0), viviendas: _pNViv, puntosComunidad: +_pm.puntosComunidad || 0, masDeUnaEntrada: +_pm.masDeUnaEntrada || 0, proyecto: false, grupoPresion: { seInstala: !!(+_pm.gpInstala || 0), tiene: false, modelo: "", deposito: "" }, longAlimentacion: +_pm.longAli || 0, montajeAli: _pm.montaje || "", codosTermo: +_pm.codos || 0, llaves: +_pm.llaves || 0, bateria1: _pm.bat1 || "", bateria2: _pm.bat2 || "", tipoCuarto: _pm.tipoCuarto || "", otrosTiempos: +_pm.otrosTiempos || 0, otrosEur: +_pm.otrosEur || 0, gpMotAct: +_pm.gpMotAct || 0, gpPotAct: _pm.gpPotAct || "", gpNdepAct: +_pm.gpNdepAct || 0, gpTdepAct: _pm.gpTdepAct || "", gpInstala: _pm.gpInstala || "", gpPotNew: _pm.gpPotNew || "", gpNdepNew: +_pm.gpNdepNew || 0, gpTdepNew: _pm.gpTdepNew || "", gpDias: +_pm.gpDias || 0, gpLongExp: +_pm.gpLongExp || 0, peines: (savedExp && savedExp.peines) || [], plantas: +_pm.plantas || 0, altura: +_pm.altura || 0, peinesHDias: +_pm.peinesHDias || 0, pctBenefVenta: _pm.pctBenefVenta } };
      // Tabla del presupuesto: reutiliza el motor de MEDICIONES (mismos numeros, en venta)
      var dsg = null, cuadro = null;
      try {
        var capt = { _j: null, status: function () { return this; }, type: function () { return this; }, send: function () { return this; }, json: function (o) { this._j = o; return this; } };
        await p5DesgloseHandler({ query: { dir: dir, token: req.query.token || "", format: "json" } }, capt);
        if (capt._j) { dsg = capt._j.dsg || null; cuadro = capt._j.cuadro || null; }
      } catch (e) { console.error("[plan5] presupuesto desglose:", e.message); }
      // Plantillas del grupo de presion (mantenimiento / renuncia) desde doc_plantillas.
      var _docsGP = null;
      try {
        var _dpr = await sh().spreadsheets.values.get({ spreadsheetId: sid(), range: "doc_plantillas!A:D" });
        var _dprRows = (_dpr.data && _dpr.data.values) || [];
        var _pick = function(clave){ for(var i=1;i<_dprRows.length;i++){ var r=_dprRows[i]||[]; if(String(r[0]||"").trim()===clave){ return { titulo:(r[1]||""), cuerpo:(r[2]||""), activo:String(r[3]==null?"":r[3]).trim() }; } } return null; };
        var _man=_pick("mantener_presion"), _ren=_pick("renunciar_presion");
        var _enc=_pick("_ENCABEZADO_GLOBAL"), _pie=_pick("_PIE_GLOBAL");
        _docsGP = { mantener:(_man && _man.activo!=="0")?_man:null, renunciar:(_ren && _ren.activo!=="0")?_ren:null, encabezado:(_enc && _enc.activo!=="0")?_enc.cuerpo:"", pie:(_pie && _pie.activo!=="0")?_pie.cuerpo:"" };
      } catch(e){ console.error("[plan5] doc_plantillas grupo presion:", e.message); _docsGP=null; }
      res.send(renderPresupuesto(R, meta, dsg, cuadro, savedExp, _docsGP));
    } catch (e) {
      console.error("[plan5] presupuesto error:", e.message);
      res.status(500).send("Error generando el presupuesto: " + e.message);
    }
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
module.exports.calcGrupoPresion = calcGrupoPresion;
module.exports.calcMontantes = calcMontantes;
module.exports.paso2_peines = paso2_peines;
module.exports.diametroAlimentacion = diametroAlimentacion;
module.exports.diametroConexion = diametroConexion;
module.exports.parseMediciones = parseMediciones;
module.exports.calcEmasesa = calcEmasesa;
module.exports.paso5_agregacionYMargenes = paso5_agregacionYMargenes;
module.exports.paso6_emasesaNeto = paso6_emasesaNeto;
