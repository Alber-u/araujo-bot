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
    html+='<div class="menu-sep"></div>';
    ['IMPORTAR CATASTRO','IMPORTAR IMAGENES','IMPRIMIR TOMA DE DATOS','IMPRIMIR PRESUPUESTO','IMPRIMIR MATERIALES','IMPRIMIR TAREAS'].forEach(function(t){ html+='<div class="menu-item" data-p5act="'+t+'">'+t+'</div>'; });
    if(id){ html+='<div class="menu-sep"></div><a class="menu-item" href="/presupuestos/expediente?id='+encodeURIComponent(id)+(tk?'&token='+encodeURIComponent(tk):'')+'">\\u2190 Volver al expediente</a>'; }
    list.innerHTML=html; }
  var btn=document.getElementById('menuBtn');
  if(btn&&list){ btn.addEventListener('click',function(e){e.stopPropagation();list.hidden=!list.hidden;}); document.addEventListener('click',function(e){ if(e.target!==btn && !list.contains(e.target)) list.hidden=true; }); }
  if(list){ list.querySelectorAll('[data-p5act]').forEach(function(el){ el.addEventListener('click',function(){ var a=el.getAttribute('data-p5act'); if(a==='IMPRIMIR PRESUPUESTO'){ window.open('/plan5/presupuesto'+q(),'_blank'); list.hidden=true; } }); }); }
})();
`;

// La pantalla "Toma de datos" va incrustada aqui como texto (cadena JS escapada);
// asi todo el modulo Plan 5 es UN solo archivo y no hay .html aparte.
const TOMA_DATOS_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<style>.vrow{border-bottom:none}.avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:8px 0;font-size:11px}input.p5mismatch{border-color:#dc2626!important;background:#fef2f2!important;color:#dc2626!important}.ptl-card .ptl-form-grid input[readonly]{background:var(--ptl-gray-400)!important;color:#fff!important;border-color:var(--ptl-gray-400)!important}#longAli:disabled,#ali_codos:disabled,#con_llaves:disabled{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;opacity:1;font-weight:600}#gp_cald_new{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;font-weight:600}</style>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Plan 5 · Toma de datos</title>\n</head>\n<body>\n<script>window.__PLAN5_SAVED__=null;window.__PLAN5_SCREEN__=\"toma\";/*__PLAN5_SAVED__*/</script>\n<div class=\"page\">\n\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n\n  <!-- 1. DATOS DEL PRESUPUESTO -->\n  <div class=\"card\">\n    <div class=\"t\">Datos del presupuesto</div>\n    <div class=\"grid g3\">\n      <label class=\"f\"><span class=\"lab\">Nº de presupuesto</span><input id=\"f_npresupuesto\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Fecha</span><input id=\"f_fecha\" type=\"date\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Revision</span><div class=\"combo\"><input id=\"f_revision\" value=\"Rev-18 28/05/2026\" autocomplete=\"off\"><button type=\"button\" class=\"combo-arrow\" id=\"f_revision_arrow\" aria-label=\"Desplegar\">▾</button><div class=\"combo-list\" id=\"f_revision_list\" hidden><div class=\"combo-opt\">Rev-18 28/05/2026</div></div></div></label>\n    </div>\n  </div>\n\n  <!-- 2. DATOS CCPP (del expediente; identica a la ficha, bloqueada, sin botones) -->\n  <div class=\"ptl-card\">\n    <div class=\"ptl-card-title\" style=\"border-bottom:1px solid var(--ptl-general-2)\">Datos CCPP</div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-1\"><label class=\"ptl-form-label\">Tipo via</label><input class=\"calc-field\" id=\"f_tipovia\" value=\"\" readonly></div>\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Direccion</label><input class=\"calc-field\" id=\"f_direccion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-3\"><label class=\"ptl-form-label\">Poblacion</label><input class=\"calc-field\" id=\"f_poblacion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">CP</label><input class=\"calc-field\" id=\"f_cp\" value=\"\" readonly style=\"width:100%\"></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Administrador</label><input class=\"calc-field\" id=\"f_admin\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_admintel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_adminemail\" value=\"\" readonly></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Presidente</label><input class=\"calc-field\" id=\"f_presidente\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_prestel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_presemail\" value=\"\" readonly></div>\n    </div>\n  </div>\n\n  <!-- 2.5 DATOS ECONOMICOS (cuadro economico C29:F51 - SOLO GRAFICO, sin Sheet) -->\n  <div class=\"card\">\n    <div class=\"t\">Datos economicos</div>\n\n    <div class=\"grid g4\"><label class=\"f\"><span class=\"lab\">Tiempo ejecucion <small>(dias/cuadrilla)</small></span><div class=\"derived\" id=\"de_tEjec\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">%bº tradicional s/venta</span><input id=\"de_c41\" type=\"text\" inputmode=\"decimal\" maxlength=\"5\" style=\"width:100%;box-sizing:border-box\"></label><label class=\"f\"><span class=\"lab\">% Bº materiales</span><div class=\"derived\" id=\"de_bMat\"></div></label><label class=\"f\"><span class=\"lab\">% Bº mano de obra</span><div class=\"derived\" id=\"de_bMo\"></div></label></div>\n    \n    <div class=\"grid g5\"><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Costes</div><label class=\"f\"><span class=\"lab\">Coste total</span><div class=\"derived\" id=\"de_cTot\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">mano de obra</span><div class=\"derived\" id=\"de_cMo\"></div></label><label class=\"f\"><span class=\"lab\">materiales</span><div class=\"derived\" id=\"de_cMat\"></div></label><label class=\"f\"><span class=\"lab\">albañileria</span><div class=\"derived\" id=\"de_cAlb\"></div></label><label class=\"f\"><span class=\"lab\">grupo presion</span><div class=\"derived\" id=\"de_cGp\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;cursor:pointer\" class=\"colsel\" data-col=\"trad\">Presupuesto tradicional</div><label class=\"f\"><span class=\"lab\">Presupuesto total</span><div class=\"derived\" id=\"de_totTrad\"></div></label><label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totTradIva\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">Bº tradicional</span><div class=\"derived\" id=\"de_btTrad\"></div></label><label class=\"f\"><span class=\"lab\">% bº s/venta</span><div class=\"derived\" id=\"de_pBenTrad\"></div></label><label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hTrad\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;cursor:pointer\" class=\"colsel\" data-col=\"p5\">Presupuesto Plan 5</div><label class=\"f\"><span class=\"lab\">Presupuesto total</span><div class=\"derived\" id=\"de_totP5\"></div></label><label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totP5Iva\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label><label class=\"f\"><span class=\"lab\">Bº Plan 5</span><div class=\"derived\" id=\"de_bP5\"></div></label><label class=\"f\"><span class=\"lab\">% bº s/venta</span><div class=\"derived\" id=\"de_pBenP5\"></div></label><label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hP5\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\" id=\"tit-subv\">CON SUBVENCION EMASESA</div><label class=\"f\"><span class=\"lab\">Subvencion total</span><div class=\"derived\" id=\"de_subv\"></div></label><label class=\"f\"><span class=\"lab\" id=\"lab-totsubv\">Total con subvencion e IVA</span><div class=\"derived\" id=\"de_totSubv\"></div></label><label class=\"f\"><span class=\"lab\">Importe por comunero</span><div class=\"derived\" id=\"de_comunero\" style=\"font-size:16px;font-weight:800;border:1px solid #16a34a\"></div></label></div><div style=\"display:flex;flex-direction:column;gap:4px\"><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0 0 4px;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Financiacion particular</div><label class=\"f\"><span class=\"lab\">Cuota 6 meses <small>(8,312%)</small></span><div class=\"derived\" id=\"de_fin6\"></div></label><label class=\"f\"><span class=\"lab\">Cuota 12 meses <small>(8,037%)</small></span><div class=\"derived\" id=\"de_fin12\"></div></label><label class=\"f\"><span class=\"lab\">Cuota 18 meses <small>(7,708%)</small></span><div class=\"derived\" id=\"de_fin18\"></div></label><div style=\"font-size:11px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:0;min-height:30px;display:flex;align-items:flex-end;border-bottom:1px solid var(--titulo);padding-bottom:3px;\">Financiacion comunitaria</div><label class=\"f\"><span class=\"lab\">Importe financiable</span><div class=\"derived\" id=\"de_finCom\"></div></label></div></div>\n  </div>\n\n  <!-- 3. EDIFICIO Y VIVIENDAS -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de edificio</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Nº de plantas <small>(Baja + X)</small></span><input id=\"plantas\" type=\"number\" value=\"\" min=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Altura de planta <small>(m)</small></span><input id=\"altura\" type=\"number\" value=\"\" step=\"0.1\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de suministros</span><input id=\"nsum\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de edificio</span><div class=\"derived\" id=\"tipoEdif\">TIPO C</div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales con suministro</span><input id=\"localesCon\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales sin suministro</span><input id=\"localesSin\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de locales</span><div class=\"derived\" id=\"locNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"locTipo\"></div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Viv. con mas de una entrada</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de entradas de mas</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n    </div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en planta baja</div>\n      <button class=\"add\" data-z=\"baja\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vbaja\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en resto de plantas</div>\n      <button class=\"add\" data-z=\"resto\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vresto\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en atico</div>\n      <button class=\"add\" data-z=\"atico\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vatico\"></div>\n\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto1\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto2\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de comunidad</span><div class=\"derived\" id=\"comNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"comTipo\"></div></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 7. TUBO CONEXIÓN + ALIMENTACIÓN -->\n  <!-- CARACTERÍSTICAS DE LA INSTALACIÓN (A28:B51) -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de instalacion</div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Acometida</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Nº contador de agua</span><input value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Ubicacion del contador</span><select><option selected></option><option>FACHADA DELANTERA</option><option>FACHADA LATERAL</option><option>FACHADA TRASERA</option><option>ZONAS COMUNES</option><option>CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Situacion llave acerado</span><select><option selected></option><option>DELANTERA</option><option>LATERAL</option><option>TRASERA</option><option>DELANTERA-CAMBIAR</option><option>LATERAL-CAMBIAR</option><option>TRASERA-CAMBIAR</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº llaves de corte general <small>(ud)</small></span><input id=\"con_llaves\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de conexion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>PE</option><option>PLOMO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Diametro actual <small>(mm)</small></span><select><option selected></option><option>DESCONOCIDO</option><option>25</option><option>32</option><option>40</option><option>50</option><option>63</option><option>75</option><option>90</option><option>110</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longCon\"><option selected></option><option>NO EXISTE</option><option>VALIDO</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de alimentacion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Montaje propuesto</span><select id=\"ali_montaje\"><option selected></option><option>ENTERRADO</option><option>B.FORJADO</option><option>CANALETA</option><option>F.VIGA</option><option>F.TECHO</option><option>SOLO PIECERIA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº codos termofusion <small>(ud)</small></span><input id=\"ali_codos\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longAli\"><option selected></option><option>2,5</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Montante de abastecimiento</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>COBRE</option><option>HIERRO</option><option>PPR</option><option>PE</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Cuarto de contadores</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select><option selected></option><option>EN FACHADA DELANTERA</option><option>EN FACHADA LATERAL</option><option>EN FACHADA TRASERA</option><option>EN PORTAL</option><option>BAJO ESCALERA</option><option>EN PATIO INTERIOR</option><option>EN PATIO EXTERIOR</option><option>EN CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de armario</span><select id=\"cuarto_tipo\"><option selected></option><option value=\"EXISTENTE\">CUARTO EXISTENTE</option><option>ALUMINIO</option><option>OBRA - P.ALUMINIO</option><option>OBRA - P.HIERRO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 1</span><select class=\"bat\" id=\"cuarto_bat1\"></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 2 (si hay)</span><select class=\"bat\" id=\"cuarto_bat2\"></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Grupo de presion</div>\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores actual</span><input id=\"gp_mot_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia actual <small>(KW)</small></span><input id=\"gp_pot_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin actual <small>(L)</small></span><input id=\"gp_cald_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos actual</span><input id=\"gp_ndep_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos actual <small>(L)</small></span><input id=\"gp_tdep_act\" type=\"text\" value=\"\"></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores nuevo</span><input id=\"gpInstala\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia nueva <small>(KW)</small></span><select id=\"gp_pot_new\"><option selected></option><option>1,1</option><option>1,5</option><option>2,2</option><option>3</option><option>4</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin nuevo <small>(L)</small></span><input id=\"gp_cald_new\" type=\"text\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos nuevo</span><input id=\"gp_ndep_new\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos nuevo <small>(L)</small></span><select id=\"gp_tdep_new\"><option selected></option><option>500</option><option>750</option><option>1000</option><option>2000</option></select></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select id=\"gp_ubic\"><option selected></option><option>NO NECESITA</option><option>CUARTO EXISTENTE</option><option>CUARTO NUEVO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tiempo montaje nuevo GP</span><input id=\"gp_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Longitud tubo expulsion <small>(m)</small></span><input id=\"gp_longexp\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempos (cuadrilla X2)</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje de Peines (H)</span><input id=\"peines_h_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t1\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t2\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros trabajos extra <small>(€)</small></span><input id=\"otros_eur\" type=\"text\" inputmode=\"decimal\" value=\"\" class=\"euro\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n  </div>\n\n  <!-- 10. PEINES -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de peines</div>\n    <div id=\"avPeines\"></div>\n    <div id=\"peines\"></div>\n  </div>\n\n</div>\n\n<script>\nconst PLAST={20:25,25:32,30:40,40:50,50:63,60:75,80:90,100:110};\nconst ACOM=[[20,2,1,1,0,0],[25,6,4,3,2,1],[30,15,11,9,7,5],[40,60,40,33,22,17],[50,100,70,55,37,30],[60,180,120,90,60,50],[80,400,300,250,200,150]];\nconst ALIM=[[30,2,1,1,0,0],[40,5,3,2,2,1],[50,25,16,14,10,6],[60,75,50,45,40,30],[80,120,90,80,70,60],[100,200,150,130,110,90]];\nconst TI={\"TIPO A\":0,\"TIPO B\":1,\"TIPO C\":2,\"TIPO D\":3,\"TIPO E\":4};\nconst EQUIP_TIPO={\"Cocina + Lavadero + sanitario\":\"TIPO A\",\"Cocina + Lavadero + aseo\":\"TIPO B\",\"Cocina + Lavadero + baño\":\"TIPO C\",\"Cocina + Office + Lavadero + baño + aseo\":\"TIPO D\",\"Cocina + Office + Lavadero + 2 baño + aseo\":\"TIPO E\",\"Otros\":\"TIPO F\"};\nfunction diamBase(t,n,tipo){const i=TI[tipo];if(i===undefined)return null;for(const f of t){if(f[1+i]>0&&n<=f[1+i])return f[0];}return null;}\nfunction dAco(n,tipo,L){let d=diamBase(ACOM,n,tipo);if(d===null)return\"—\";if(L>15)d+=20;else if(L>6)d+=10;return(PLAST[d]||d)+\" mm\";}\nfunction dAli(n,tipo,L){let d=diamBase(ALIM,n,tipo);if(d===null)return\"—\";if(L>40)d+=20;else if(L>15)d+=10;return(PLAST[d]||d)+\" mm\";}\n\nfunction pp(t,h,n){const M={\"SIMPLE\":[1,0,0],\"SIMPLE+1\":[1,1,0],\"1-SIMPLE\":[1,0,h],\"1-SIMPLE+1\":[1,1,h],\"SIMPLE-1\":[1,0,h*(n+1)],\"SIMPLE-2\":[1,0,h*(2*n+1)],\"1-SIMPLE-1\":[1,0,h*(n+1)+h],\"1-SIMPLE-2\":[1,0,h*(2*n+1)+h],\"DOBLE\":[2,0,0],\"DOBLE+1\":[2,1,0],\"DOBLE+2\":[2,2,0],\"1-DOBLE\":[2,0,h],\"2-DOBLE\":[2,0,2*h],\"1-DOBLE+1\":[2,1,h],\"2-DOBLE+1\":[2,1,2*h],\"1-DOBLE+2\":[2,2,h],\"DOBLE-1\":[2,0,h],\"DOBLE-2\":[2,0,2*h],\"2-DOBLE+2\":[2,2,2*h]};return M[t]||[1,0,0];}\nconst TIPOS=[\"SIMPLE\",\"SIMPLE+1\",\"SIMPLE-1\",\"SIMPLE-2\",\"1-SIMPLE\",\"1-SIMPLE+1\",\"1-SIMPLE-1\",\"1-SIMPLE-2\",\"DOBLE\",\"DOBLE+1\",\"DOBLE+2\",\"DOBLE-1\",\"DOBLE-2\",\"1-DOBLE\",\"2-DOBLE\",\"1-DOBLE+1\",\"2-DOBLE+1\",\"1-DOBLE+2\",\"2-DOBLE+2\"];\nconst EQUIPS=Object.keys(EQUIP_TIPO);\nfunction pTubo(t,h,n){const[k,p,R]=pp(t,h,n);return k*h*(n+1)*(n+2)/2+p*h*(n+2)-R;}\nfunction pViv(t,n){const[k,p]=pp(t,1,n);return k*(n+1)+p;}\nfunction splitTipo(t){t=t||\"\";var pre=\"\";if(t.slice(0,2)===\"1-\"){pre=\"1-\";t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){pre=\"2-\";t=t.slice(2);}var suf=\"\";var l2=t.slice(-2);if([\"+1\",\"+2\",\"-1\",\"-2\"].indexOf(l2)>=0){suf=l2;t=t.slice(0,-2);}return{pre:pre,base:t,suf:suf};}\nconst TBASE=[\"\",\"SIMPLE\",\"DOBLE\"];function PREFS(b){return b===\"DOBLE\"?[\"\",\"1-\",\"2-\"]:b===\"SIMPLE\"?[\"\",\"1-\"]:[\"\"];}function SUFS(b){return b===\"DOBLE\"?[\"\",\"+1\",\"+2\",\"-1\",\"-2\"]:b===\"SIMPLE\"?[\"\",\"+1\",\"-1\",\"-2\"]:[\"\"];}\nconst optT=(arr,v)=>arr.map(o=>`<option value=\"${o}\" ${o===v?'selected':''}>${o||'—'}</option>`).join(\"\");\n\nconst $=id=>document.getElementById(id);\nconst zonas={ baja:[], resto:[], atico:[] };\nconst CONT={baja:\"vbaja\",resto:\"vresto\",atico:\"vatico\"};\nlet peines=[];\n\nfunction renderZona(z){\n  const arr=zonas[z],c=$(CONT[z]);c.innerHTML=\"\";\n  arr.forEach((v,i)=>{\n    const r=document.createElement(\"div\");r.className=\"vrow\";\n    const o=`<option ${!v.equip?'selected':''}></option>`+EQUIPS.map(e=>`<option ${e===v.equip?'selected':''}>${e}</option>`).join(\"\");\n    const pu=`<option ${!v.puerta?'selected':''}></option>`+[\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"DCHA\",\"IZDA\",\"CENTRO\"].map(x=>`<option ${x===v.puerta?'selected':''}>${x}</option>`).join(\"\");\n    r.innerHTML=`<label class=\"f\"><span class=\"lab\">Puerta</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"vp\">${pu}</select></label>\n      <label class=\"f\"><span class=\"lab\">Equipamiento</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"ve\">${o}</select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de viviendas</span><div class=\"derived vn-disp\" data-z=\"${z}\" data-i=\"${i}\">${v.n||0}</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">${EQUIP_TIPO[v.equip]||''}</div></label>\n      <button class=\"del\" data-z=\"${z}\" data-i=\"${i}\">×</button>`;\n    c.appendChild(r);\n  });\n  c.querySelectorAll(\".vp\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].puerta=e.target.value;recalc();});\n  c.querySelectorAll(\".ve\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].equip=e.target.value;renderZona(e.target.dataset.z);recalc();});\n  c.querySelectorAll(\".del\").forEach(b=>b.onclick=e=>{zonas[e.target.dataset.z].splice(+e.target.dataset.i,1);renderZona(e.target.dataset.z);recalc();});\n}\nfunction renderVivs(){renderZona(\"baja\");renderZona(\"resto\");renderZona(\"atico\");}\nfunction todasViviendas(){return [...zonas.baja,...zonas.resto,...zonas.atico];}\nconst OPT_ENGANCHE=[\"EXT\",\"INT-FACIL\",\"INT-MEDIO\",\"INT-DIFICIL\"];\nconst OPT_PEINEV=[\"V-INT\",\"V-EXT\"];\nconst OPT_IE=[\"INTERIOR\",\"EXTERIOR\"];\nconst OPT_ENGCB=[\"ENGANCHA EN COCINAS\",\"ENGANCHA EN BAÑOS\"];\nconst OPT_PROT=[\"B.FORJADO\",\"CANALETA\",\"F.VIGA\",\"F.TECHO\",\"B.LADRILLO\"];\nconst OPT_SUBE=[\"SUBE POR FACHADA DELANTERA\",\"SUBE POR FACHADA LATERAL DERECHA\",\"SUBE POR FACHADA LATERAL IZQUIERDA\",\"SUBE POR FACHADA TRASERA\",\"SUBE POR PATIO DERECHO\",\"SUBE POR PATIO CENTRAL\",\"SUBE POR PATIO IZQUIERDO\",\"SUBE POR SCHUNT\"];\nconst OPT_BAJA=[\"NO BAJA\",\"BAJA POR FACHADA DELANTERA\",\"BAJA POR FACHADA LATERAL DERECHA\",\"BAJA POR FACHADA LATERAL IZQUIERDA\",\"BAJA POR FACHADA TRASERA\",\"BAJA POR PATIO DERECHO\",\"BAJA POR PATIO CENTRAL\",\"BAJA POR PATIO IZQUIERDO\",\"BAJA POR SCHUNT\"];\nconst sel=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join(\"\");\nconst selB=(arr,v)=>`<option ${!v?'selected':''}></option>`+sel(arr,v);\nconst subH=t=>`<div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:8px 0 4px;\">${t}</div>`;\n\nfunction tramosHTML(i,m,arr){\n  const cols=(arr||[]).map((tr,t)=>`\n    <div style=\"display:flex;flex-direction:column;gap:4px;\">\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <label class=\"f\" style=\"flex:1;\"><span class=\"lab\">Longitud <small>(m)</small></span><input data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"long\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"${tr.long||''}\"></label>\n        <button class=\"del tdel\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">×</button>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <select data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"prot\" style=\"flex:1;\"><option ${!tr.prot?'selected':''}></option>${sel(OPT_PROT,tr.prot)}</select>\n        <button class=\"tadd addtramo\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">+</button>\n      </div>\n    </div>`).join(\"\");\n  return `<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end;\">${cols}</div>`;\n}\nfunction renderPeines(){\n  const c=$(\"peines\");c.innerHTML=\"\";\n  if(!peines.length){\n    const ab=document.createElement(\"button\");ab.className=\"add\";ab.title=\"Añadir peine\";ab.textContent=\"+\";\n    ab.onclick=()=>{peines.push(nuevoPeine());renderPeines();};\n    c.appendChild(ab);return;\n  }\n  peines.forEach((pe,i)=>{\n    const b=document.createElement(\"div\");\n    b.style.cssText=\"border:1px solid var(--g200);border-radius:8px;padding:8px 10px;margin-bottom:8px;position:relative;\";\n    b.innerHTML=`\n      <div style=\"position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;\">\n        <button class=\"add padd\" data-i=\"${i}\" title=\"Añadir peine\">+</button>\n        <button class=\"del pdel\" data-i=\"${i}\">×</button>\n      </div>\n      <div style=\"font-weight:700;color:var(--titulo);font-size:13px;margin-bottom:6px;\">PEINE ${i+1}</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:16px;\">\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante actual</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Interior / Exterior</span><select data-i=\"${i}\" data-k=\"maIE\">${selB(OPT_IE,pe.maIE)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"maEng\">${selB(OPT_ENGCB,pe.maEng)}</select></label>\n          </div>\n        </div>\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante nuevo</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Recorrido (sube)</span><select data-i=\"${i}\" data-k=\"mnSube\">${selB(OPT_SUBE,pe.mnSube)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Recorrido (baja)</span><select data-i=\"${i}\" data-k=\"mnBaja\">${selB(OPT_BAJA,pe.mnBaja)}</select></label>\n          </div>\n        </div>\n      </div>\n      <div class=\"grid g5\" style=\"margin-top:8px;\">\n        <label class=\"f\"><span class=\"lab\">Puerta(s)</span><input data-i=\"${i}\" data-k=\"puerta\" value=\"${pe.puerta||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Tipo de peine</span><div style=\"display:flex;gap:4px;\"><select class=\"ptipo\" data-i=\"${i}\" data-part=\"pre\" style=\"width:42px;\">${optT(PREFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).pre)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"base\" style=\"flex:1;\">${optT(TBASE,splitTipo(pe.tipo).base)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"suf\" style=\"width:42px;\">${optT(SUFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).suf)}</select></div></label>\n        <label class=\"f\"><span class=\"lab\">Nº giros extra</span><input data-i=\"${i}\" data-k=\"giros\" type=\"number\" min=\"0\" value=\"${pe.giros||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"enganche\">${selB(OPT_ENGANCHE,pe.enganche)}</select></label>\n        <label class=\"f\"><span class=\"lab\">Peine (V)</span><select data-i=\"${i}\" data-k=\"peineV\">${selB(OPT_PEINEV,pe.peineV)}</select></label>\n      </div>\n      <div style=\"margin-top:8px;\">${tramosHTML(i,'tramos',pe.tramos)}</div>`;\n    c.appendChild(b);\n  });\n  c.querySelectorAll(\"[data-k]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{peines[+e.target.dataset.i][e.target.dataset.k]=e.target.value;});\n  });\n  c.querySelectorAll(\"[data-f]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{const d=e.target.dataset; peines[+d.i][d.m][+d.t][d.f]=e.target.value;});\n  });\n  c.querySelectorAll(\".ptipo\").forEach(el=>el.addEventListener(\"change\",e=>{var i=+e.target.dataset.i;var pre=\"\",base=\"\",suf=\"\";c.querySelectorAll(\".ptipo\").forEach(p=>{if(+p.dataset.i!==i)return;if(p.dataset.part===\"pre\")pre=p.value;else if(p.dataset.part===\"base\")base=p.value;else suf=p.value;});if(PREFS(base).indexOf(pre)<0)pre=\"\";if(SUFS(base).indexOf(suf)<0)suf=\"\";peines[i].tipo=(pre||\"\")+(base||\"\")+(suf||\"\");renderPeines();}));\n  c.querySelectorAll(\".addtramo\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t+1,0,{long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".tdel\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t,1); if(!peines[+d.i][d.m].length)peines[+d.i][d.m].push({long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".pdel\").forEach(b=>b.onclick=e=>{peines.splice(+e.currentTarget.dataset.i,1);renderPeines();});\n  c.querySelectorAll(\".padd\").forEach(b=>b.onclick=()=>{peines.push(nuevoPeine());renderPeines();});avisoViviendas();\n}\nfunction tipoEdificio(){\n  const orden=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"];let best=\"TIPO A\";\n  todasViviendas().forEach(v=>{const t=EQUIP_TIPO[v.equip];if(t&&orden.indexOf(t)>orden.indexOf(best))best=t;});\n  return best;\n}\nfunction recalc(){\n  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};\n  const n=+$(\"plantas\").value||0,h=+$(\"altura\").value||0;\n  const nViv=todasViviendas().length;\n  let nSum=0; [\"baja\",\"resto\",\"atico\"].forEach(function(z){ zonas[z].forEach(function(v,i){ var c=(v.puerta||v.equip)?((z===\"resto\")?n:1):0; v.n=c; nSum+=c; var d=document.querySelector(\".vn-disp[data-z=\\\"\"+z+\"\\\"][data-i=\\\"\"+i+\"\\\"]\"); if(d) d.textContent=c; }); });\n  var lsin=+($(\"localesSin\")||{}).value||0; nSum+=lsin;\n  var _ln=$(\"locNum\"); if(_ln) _ln.textContent=lsin||\"\"; var _lt=$(\"locTipo\"); if(_lt) _lt.textContent=lsin>0?\"TIPO B\":\"\";\n  var c1=(($(\"comPunto1\")||{}).value||\"\"), c2=(($(\"comPunto2\")||{}).value||\"\");\n  var comN=(c1?1:0)+(c2?1:0);\n  var _cn=$(\"comNum\"); if(_cn) _cn.textContent=comN>0?1:0;\n  var _ct=$(\"comTipo\"); if(_ct) _ct.textContent=comN>0?\"TIPO A\":\"\";\n  if(comN>0) nSum+=1;\n  $(\"nsum\").value = (nViv||lsin||comN) ? nSum : \"\";\n  var tipo = nViv ? tipoEdificio() : \"\";\n  if(lsin>0){ var _ord=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"]; if(!tipo || _ord.indexOf(\"TIPO B\")>_ord.indexOf(tipo)) tipo=\"TIPO B\"; }\n  set(\"tipoEdif\",tipo);\n  var _gpi=$(\"gpInstala\"); var _cn=$(\"gp_cald_new\"); if(_cn){ _cn.value=(_gpi&&_gpi.value===\"2\")?\"8\":\"\"; }\n  const numAli=parseFloat(String(($(\"longAli\")||{}).value||\"\").replace(\",\",\".\"))||0;\n  const a=dAco(nSum,tipo,+$(\"longCon\").value||0),al=dAli(nSum,tipo,numAli);\n  set(\"dAco\",a);set(\"dAli\",al);\n  const sub=nSum*160+($(\"gpInstala\").checked?52:0);\n  set(\"rSub\",sub.toLocaleString(\"es-ES\")+\" €\");set(\"dSub\",sub.toLocaleString(\"es-ES\")+\" €\");avisoViviendas();\n}\ndocument.querySelectorAll(\"button.add[data-z]\").forEach(b=>b.onclick=()=>{const z=b.dataset.z;zonas[z].push({puerta:\"\",equip:\"\",n:\"\"});renderZona(z);recalc();});\nfunction nuevoPeine(){return {puerta:\"\",tipo:\"\",giros:\"\",enganche:\"\",peineV:\"\",maIE:\"\",maEng:\"\",mnSube:\"\",mnBaja:\"\",tramos:[{long:\"\",prot:\"\"}]};}\n[\"plantas\",\"altura\",\"longCon\",\"longAli\",\"gpInstala\",\"localesSin\",\"localesCon\",\"comPunto1\",\"comPunto2\"].forEach(id=>{const el=$(id);if(el){el.addEventListener(\"input\",recalc);el.addEventListener(\"change\",recalc);}});\nconst BATERIAS=\"4T-2F,6T-2F,6T-3F,9T-3F,10T-2F,12T-2F,12T-3F,14T-2F,15T-3F,16T-2F,18T-2F,18T-3F,20T-2F,21T-3F,22T-2F,24T-2F,24T-3F,26T-2F,27T-3F,28T-2F,30T-2F,30T-3F,33T-3F,36T-3F,39T-3F,42T-3F,45T-3F\".split(\",\");\ndocument.querySelectorAll(\"select.bat\").forEach((s)=>{s.innerHTML='<option selected></option>'+BATERIAS.map(b=>`<option>${b}</option>`).join(\"\");});\nfunction vivPeine(t,n){t=String(t||\"\").trim();if(!t)return 0;var a=0;if(t.slice(0,2)===\"1-\"){a=1;t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){a=2;t=t.slice(2);}var b=0,c=0,s=t.slice(-2);if(s===\"+1\"){c=1;t=t.slice(0,-2);}else if(s===\"+2\"){c=2;t=t.slice(0,-2);}else if(s===\"-1\"){b=1;t=t.slice(0,-2);}else if(s===\"-2\"){b=2;t=t.slice(0,-2);}var k=t===\"DOBLE\"?2:(t===\"SIMPLE\"?1:0);if(!k)return 0;var v=k*(n+1)-a-b+c;return v<0?0:v;}function avisoViviendas(){var n=+($(\"plantas\")||{}).value||0;var sumP=0,hay=false;for(var i=0;i<peines.length;i++){if(peines[i].tipo)hay=true;sumP+=vivPeine(peines[i].tipo,n);}var lsin=+($(\"localesSin\")||{}).value||0;var c1=(($(\"comPunto1\")||{}).value||\"\"),c2=(($(\"comPunto2\")||{}).value||\"\");var com=((c1?1:0)+(c2?1:0))>0?1:0;var nsum=+($(\"nsum\")||{}).value||0;var esperado=sumP+lsin+com;var desc=hay&&nsum>0&&esperado!==nsum;var el=$(\"nsum\");if(el){if(desc)el.classList.add(\"p5mismatch\");else el.classList.remove(\"p5mismatch\");}var box=$(\"avPeines\");if(box){box.innerHTML=desc?(\x27<div class=\"avbox\">Las viviendas de los peines (\x27+sumP+\x27) mas locales y comunidad (\x27+(lsin+com)+\x27) suman \x27+esperado+\x27, que no coincide con el N\xba de suministros (\x27+nsum+\x27). Revisa los peines o la distribuci\xf3n de viviendas.</div>\x27):\"\";}}renderVivs();renderPeines();recalc();(function(){var mo=$(\"ali_montaje\"),lo=$(\"longAli\"),co=$(\"ali_codos\"),ll=$(\"con_llaves\");function pz(){var p=mo&&mo.value===\"SOLO PIECERIA\";if(lo){lo.disabled=p;if(p)lo.value=\"\";}if(co){co.disabled=p;if(p)co.value=\"\";}if(ll){ll.disabled=p;if(p)ll.value=1;}recalc();}if(mo)mo.addEventListener(\"change\",pz);pz();})();\n\n// ---- Guardar / precargar contra el Sheet (vía el módulo) ----\nfunction camposEstaticos(){\n  const dyn=[\"vbaja\",\"vresto\",\"vatico\",\"peines\"].map(id=>$(id)).filter(Boolean);\n  const dentro=el=>dyn.some(d=>d.contains(el));\n  return [...document.querySelectorAll(\".page input, .page select\")].filter(el=>!dentro(el)&&el.id!=='de_c41');\n}\nfunction camposEditables(){ return camposEstaticos().filter(function(el){ return !el.readOnly && el.type!==\"hidden\"; }); }\nfunction serializar(){\n  var _ns=parseInt(($(\"nsum\")||{}).value,10)||0; var _tp=(($(\"tipoEdif\")||{}).textContent||\"\").trim(); var _lc=parseFloat(String((($(\"longCon\")||{}).value||\"\")).replace(\",\",\".\"))||0; var gv=function(id){var e=$(id);return e?e.value:\"\";}; var pf=function(id){return parseFloat(String(gv(id)).replace(\",\",\".\"))||0;}; var pe=function(id){return parseFloat(String(gv(id)).replace(/\\./g,\"\").replace(\",\",\".\"))||0;}; return { v: camposEditables().map(el=>el.value), zonas, peines, motor:{ nsum:_ns, pctBenefVenta:(typeof window.__P5_BENEF__==='number'?window.__P5_BENEF__:0.25), tipo:_tp, longCon:_lc, longAli: pf(\"longAli\"), montaje: gv(\"ali_montaje\"), codos: pf(\"ali_codos\"), llaves: pf(\"con_llaves\"), bat1: gv(\"cuarto_bat1\"), bat2: gv(\"cuarto_bat2\"), tipoCuarto: gv(\"cuarto_tipo\"), otrosTiempos: (pf(\"otros_t1\")+pf(\"otros_t2\")), otrosEur: pe(\"otros_eur\"), gpMotAct: gv(\"gp_mot_act\"), gpPotAct: gv(\"gp_pot_act\"), gpCaldAct: gv(\"gp_cald_act\"), gpNdepAct: gv(\"gp_ndep_act\"), gpTdepAct: gv(\"gp_tdep_act\"), gpInstala: gv(\"gpInstala\"), gpPotNew: gv(\"gp_pot_new\"), gpCaldNew: gv(\"gp_cald_new\"), gpNdepNew: pf(\"gp_ndep_new\"), gpTdepNew: gv(\"gp_tdep_new\"), gpUbic: gv(\"gp_ubic\"), gpDias: pf(\"gp_dias\"), gpLongExp: pf(\"gp_longexp\"), plantas: (parseInt(gv(\"plantas\"),10)||0), altura: pf(\"altura\"), peinesHDias: pf(\"peines_h_dias\"), puntosComunidad: ((($(\"comPunto1\")||{}).value?1:0)+(($(\"comPunto2\")||{}).value?1:0)), colActiva: (window.__P5_COL__||'plan5') } };\n}\nfunction hidratar(d){\n  if(!d) return;\n  if(d.zonas){ zonas.baja=d.zonas.baja||[]; zonas.resto=d.zonas.resto||[]; zonas.atico=d.zonas.atico||[]; }\n  if(Array.isArray(d.peines)&&d.peines.length){ peines.length=0; d.peines.forEach(p=>peines.push(p)); }\n  renderVivs(); renderPeines();\n  if(Array.isArray(d.v)){ camposEditables().forEach((el,i)=>{ if(i<d.v.length) el.value=d.v[i]; }); }\n  recalc();\n}\nconst PLAN5_TOKEN = new URLSearchParams(location.search).get(\"token\")||\"\";\n// Guarda TODO el formulario en el Sheet (1 fila por direccion). Devuelve true/false.\nasync function plan5GuardarTodo(){\n  try{\n    const body=new URLSearchParams();\n    var _tv=($(\"f_tipovia\")||{}).value||\"\"; var _dc=($(\"f_direccion\")||{}).value||\"\";\n    body.set(\"direccion\", ((_tv?_tv+\" \":\"\")+_dc).trim());\n    body.set(\"ccpp_id\", window.__PLAN5_VOLVER_ID__||\"\");\n    body.set(\"npresupuesto\", ($(\"f_npresupuesto\")||{}).value||\"\");\n    body.set(\"fecha\", ($(\"f_fecha\")||{}).value||\"\");\n    body.set(\"revision\", ($(\"f_revision\")||{}).value||\"\");\n    body.set(\"payload\", JSON.stringify(serializar()));\n    const r=await fetch(\"/plan5/guardar?token=\"+encodeURIComponent(PLAN5_TOKEN),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n    const j=await r.json().catch(()=>({ok:false}));\n    return !!(j&&j.ok);\n  }catch(e){ return false; }\n}\n// Recuadro verde 5s al guardar OK; rojo permanente al fallo (clases de estilo-visual).\nfunction plan5Flash(el, ok){\n  if(!el) return;\n  if(el._p5t){ clearTimeout(el._p5t); el._p5t=null; }\n  el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n  if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._p5t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._p5t=null; },5000); }\n  else { el.classList.add(\"ptl-guardado-error\"); }\n}\nvar p5hist=[], p5pos=-1; function p5enDinamico(el){ return ['vbaja','vresto','vatico','peines'].some(function(id){ var d=$(id); return d && d.contains(el); }); } function setP5UndoRedo(){ var u=$('undoBtn'), r=$('redoBtn'); if(u)u.disabled=(p5pos<0); if(r)r.disabled=(p5pos>=p5hist.length-1); } async function p5undo(){ if(p5pos<0)return; var e=p5hist[p5pos]; p5pos--; setP5UndoRedo(); if(e.el){ e.el.value=e.prev; e.el.dataset.orig=e.prev; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } async function p5redo(){ if(p5pos>=p5hist.length-1)return; p5pos++; var e=p5hist[p5pos]; setP5UndoRedo(); if(e.el){ e.el.value=e.next; e.el.dataset.orig=e.next; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } (function(){ var _ub=$('undoBtn'); if(_ub)_ub.onclick=p5undo; var _rb=$('redoBtn'); if(_rb)_rb.onclick=p5redo; setP5UndoRedo(); })(); \n  async function plan5OnCambio(el){\n  if(!el || el.readOnly) return;\n  const oldV = el.dataset.orig===undefined ? \"\" : el.dataset.orig;\n  if(el.value===oldV) return;\n  if(!p5enDinamico(el)){ p5hist=p5hist.slice(0,p5pos+1); p5hist.push({el:el, prev:oldV, next:el.value}); p5pos=p5hist.length-1; setP5UndoRedo(); }\n  el.dataset.orig = el.value;\n  const ok = await plan5GuardarTodo();\n  plan5Flash(el, ok); actualizarCuadro();\n}\nconst PAGE = document.querySelector(\".page\");\n// Fija el valor base al entrar en el campo (vale para campos dinámicos también)\nPAGE.addEventListener(\"focusin\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,select,textarea\") && el.dataset.orig===undefined) el.dataset.orig=el.value; });\n// Guardar al salir del campo (inputs) o al cambiar (selects)\nPAGE.addEventListener(\"focusout\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,textarea\")) plan5OnCambio(el); });\nPAGE.addEventListener(\"change\", function(e){ const el=e.target; if(el.matches && el.matches(\"select\")) plan5OnCambio(el); });\n// Cambios estructurales (añadir/borrar viviendas, peines, tramos): guardar también\nPAGE.addEventListener(\"click\", function(e){ const b=e.target.closest && e.target.closest(\"button.add,button.tadd,button.del,button.padd,button.pdel,button.addtramo,button.tdel\"); if(b) setTimeout(function(){plan5GuardarTodo().then(function(){actualizarCuadro();});},0); });\nif(window.__PLAN5_DIR__){ var _fd=$(\"f_direccion\"); if(_fd) _fd.value=window.__PLAN5_DIR__; }\nfunction _fmtTlf(v){ var d=String(v||\"\").replace(/\\D/g,\"\"); return d.length===9 ? d.slice(0,3)+\"-\"+d.slice(3,6)+\"-\"+d.slice(6) : (v||\"\"); }\nif(window.__PLAN5_EXP__){ var _e=window.__PLAN5_EXP__; var _sv=function(id,v){var el=$(id); if(el&&v!=null&&v!==\"\") el.value=v;};\n  _sv(\"f_tipovia\",_e.tipo_via); _sv(\"f_direccion\",_e.direccion_calle); _sv(\"f_poblacion\",_e.poblacion); _sv(\"f_cp\",_e.cp);\n  _sv(\"f_admin\",_e.administrador); _sv(\"f_admintel\",_fmtTlf(_e.tel_administrador)); _sv(\"f_adminemail\",_e.email_administrador);\n  _sv(\"f_presidente\",_e.presidente); _sv(\"f_prestel\",_fmtTlf(_e.tel_presidente)); _sv(\"f_presemail\",_e.email_presidente);\n}\nasync function actualizarCuadro(){try{var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';var dir=((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';var r=await fetch('/plan5/desglose?format=json&dir='+encodeURIComponent(dir)+(PLAN5_TOKEN?'&token='+encodeURIComponent(PLAN5_TOKEN):''));var j=await r.json().catch(function(){return null;});var c=j&&j.cuadro;if(!c)return;var setT=function(id,v){var e=$(id);if(e)e.textContent=v;};var eur=function(n){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'})+' \u20ac';};var pct=function(n){return (n==null||isNaN(n))?'':(Number(n)*100).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};var num=function(n,d){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:(d==null?3:d)});};setT('de_tEjec',num(c.tEjec,1));setT('de_cMat',eur(c.cMat));setT('de_cMo',eur(c.cMo));setT('de_cAlb',eur(c.cAlb));setT('de_cGp',eur(c.cGp));setT('de_cTot',eur(c.cTot));setT('de_bMat',pct(c.bMat));setT('de_bMo',pct(c.bMo));(function(){var e=$('de_c41');window.__P5_BENEF__=(c.c41==null||isNaN(c.c41))?0.25:c.c41;if(e&&document.activeElement!==e)e.value=(c.c41==null||isNaN(c.c41))?'25':(Math.round(c.c41*1000)/10).toString().replace('.',',');})();setT('de_btTrad',eur(c.btTrad));setT('de_totTrad',eur(c.totTrad));setT('de_totTradIva',eur(c.totTradIva));setT('de_hTrad',eur(c.hTrad));setT('de_bP5',eur(c.bP5));setT('de_totP5',eur(c.totP5));setT('de_totP5Iva',eur(c.totP5Iva));setT('de_hP5',eur(c.hP5));setT('de_fin6',eur(c.fin6));setT('de_fin12',eur(c.fin12));setT('de_fin18',eur(c.fin18));setT('de_finCom',c.finCom==null?'Importe no financiable':(eur(c.finCom)+' ('+pct(c.finComPct)+')'));setT('de_subv',eur(c.subv));setT('de_totSubv',eur(c.totSubv));setT('de_comunero',eur(c.comunero));setT('de_pBenTrad',pct(c.totTrad?c.btTrad/c.totTrad:0));setT('de_pBenP5',pct(c.totP5?c.bP5/c.totP5:0));window.__P5_CUADRO__=c;aplicarColumna();}catch(e){}}function aplicarColumna(){var c=window.__P5_CUADRO__;if(!c)return;var col=window.__P5_COL__||'plan5';var trad=(col==='trad');var setT=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};var eur=function(n){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'})+' €';};var pct=function(n){return (n==null||isNaN(n))?'':(Number(n)*100).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};var tit=document.getElementById('tit-subv'),lab=document.getElementById('lab-totsubv');if(tit)tit.textContent=trad?'SIN SUBVENCION EMASESA':'CON SUBVENCION EMASESA';if(lab)lab.textContent=trad?'Total sin subvencion e IVA':'Total con subvencion e IVA';setT('de_subv',eur(trad?0:c.subv));setT('de_totSubv',eur(trad?c.totSubvTrad:c.totSubv));setT('de_comunero',eur(trad?c.comuneroTrad:c.comunero));setT('de_fin6',eur(trad?c.fin6Trad:c.fin6));setT('de_fin12',eur(trad?c.fin12Trad:c.fin12));setT('de_fin18',eur(trad?c.fin18Trad:c.fin18));var fv=trad?c.finComTrad:c.finCom,fp=trad?c.finComPctTrad:c.finComPct;setT('de_finCom',fv==null?'Importe no financiable':(eur(fv)+' ('+pct(fp)+')'));}if(window.__PLAN5_SAVED__) hidratar(window.__PLAN5_SAVED__);actualizarCuadro();\ndocument.querySelectorAll('input[type=\"number\"]').forEach(inp=>{\n  inp.addEventListener(\"input\",()=>{ if(inp.value===\"0\") inp.value=\"\"; });\n});\ndocument.querySelectorAll(\"input.euro\").forEach(inp=>{\n  inp.addEventListener(\"blur\",()=>{\n    let n=parseFloat(inp.value.replace(/\\./g,\"\").replace(\",\",\".\"));\n    inp.value = isNaN(n) ? \"\" : n.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2});\n  });\n  inp.addEventListener(\"focus\",()=>{ inp.value=inp.value.replace(/\\./g,\"\").replace(\",\",\".\"); });\n});\nfunction fmtLong(inp){ let n=parseFloat(String(inp.value).replace(\",\",\".\")); inp.value = isNaN(n) ? \"\" : n.toFixed(1).replace(\".\",\",\"); inp.dispatchEvent(new Event(\"input\",{bubbles:true})); }\ndocument.addEventListener(\"blur\",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains(\"long\")) fmtLong(e.target); }, true);\n// Desplegable propio de Revision (flecha que funciona en Firefox; deja escribir)\n(function(){\n  var inp=$(\"f_revision\"), arr=$(\"f_revision_arrow\"), lst=$(\"f_revision_list\");\n  if(!inp||!arr||!lst) return;\n  arr.addEventListener(\"click\", function(e){ e.preventDefault(); e.stopPropagation(); lst.hidden=!lst.hidden; });\n  lst.querySelectorAll(\".combo-opt\").forEach(function(o){\n    o.addEventListener(\"click\", function(){ inp.value=o.textContent; lst.hidden=true; inp.dataset.orig=inp.value; plan5GuardarTodo().then(function(ok){ plan5Flash(inp, ok); }); });\n  });\n  document.addEventListener(\"click\", function(e){ if(e.target!==arr && !lst.contains(e.target)) lst.hidden=true; });\n})();\n(function(){var est=(window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.estado)||'abierto';if(est!=='cerrado')return;var pg=document.querySelector('.page');if(pg){var d=document.createElement('div');d.className='avbox';d.style.cssText='margin:8px 0;';var f='';try{var ci=window.__PLAN5_SAVED__.cierre;if(ci&&ci.fecha){var dt=new Date(ci.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+'. Edicion bloqueada. Pulsa el candado para abrirlo.';var bar=pg.querySelector('.p5bar');if(bar&&bar.nextSibling)pg.insertBefore(d,bar.nextSibling);else pg.insertBefore(d,pg.firstChild);}document.querySelectorAll('.page input, .page select, .page textarea, .page button.add, .page button.del, .page button.padd, .page button.pdel, .page button.tadd, .page button.addtramo, .page button.tdel, .page button.combo-arrow').forEach(function(el){if(el.id==='undoBtn'||el.id==='redoBtn'||el.id==='menuBtn'||el.id==='cerrarBtn')return;el.disabled=true;el.style.pointerEvents='none';});})();(function(){var SV=window.__PLAN5_SAVED__||null;var ESTADO=(SV&&SV.estado)||'abierto';var bar=document.querySelector('.p5bar');var rel=bar?bar.querySelector('.hdr-reload'):null;var btn=document.createElement('button');btn.type='button';btn.className='menu-btn';btn.id='cerrarBtn';btn.style.borderWidth='1px';btn.style.borderStyle='solid';if(bar){if(rel)bar.insertBefore(btn,rel);else bar.appendChild(btn);}var TK=PLAN5_TOKEN||'';function DIRv(){var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';return((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';}function pintaBtn(){if(ESTADO==='cerrado'){btn.textContent='\uD83D\uDD12';btn.style.color='#dc2626';btn.style.borderColor='#dc2626';btn.style.background='#fef2f2';btn.title='Presupuesto cerrado - pulsa para abrir';}else{btn.textContent='\uD83D\uDD13';btn.style.color='#16a34a';btn.style.borderColor='#16a34a';btn.style.background='#f0fdf4';btn.title='Presupuesto abierto - pulsa para cerrar';}}async function postAbrir(modo){btn.disabled=true;try{var body=new URLSearchParams();body.set('dir',DIRv());body.set('modo',modo);var r=await fetch('/plan5/abrir'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo abrir'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}function dialogoAbrir(){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';var bx=document.createElement('div');bx.style.cssText='background:#fff;color:#111;max-width:440px;width:90%;border-radius:10px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);';var t=document.createElement('div');t.textContent='Abrir presupuesto';t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px;';bx.appendChild(t);var sub=document.createElement('div');sub.textContent='Elige como abrirlo:';sub.style.cssText='color:#555;font-size:13px;margin-bottom:12px;';bx.appendChild(sub);function opt(tit,desc,modo){var b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;cursor:pointer;';var h=document.createElement('div');h.textContent=tit;h.style.cssText='font-weight:700;color:#111;font-size:13px;';b.appendChild(h);var dd=document.createElement('div');dd.textContent=desc;dd.style.cssText='color:#666;font-size:12px;margin-top:2px;';b.appendChild(dd);b.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);postAbrir(modo);};bx.appendChild(b);}opt('Actualizar todo (formulas, cantidades y precios)','Recalcula todo y descarta los ajustes manuales de cantidad y precio.','full');opt('Actualizar solo precios','Mantiene las cantidades de la foto y refresca los precios.','precios');opt('Editar a mano','Deja la foto tal cual y la desbloquea.','manual');var cc=document.createElement('button');cc.type='button';cc.textContent='Cancelar';cc.style.cssText='display:block;width:100%;border:none;background:none;color:#666;padding:6px;cursor:pointer;font-size:13px;';cc.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);};bx.appendChild(cc);ov.appendChild(bx);ov.onclick=function(e){if(e.target===ov&&ov.parentNode)document.body.removeChild(ov);};document.body.appendChild(ov);}async function cerrarFlow(){if(!confirm('Cerrar el presupuesto? Se congelara una foto (desglose y cuadro economico) y quedara bloqueado para editar.'))return;btn.disabled=true;try{var dir=DIRv();var url='/plan5/desglose?format=json'+(dir?'&dir='+encodeURIComponent(dir):'')+(TK?'&token='+encodeURIComponent(TK):'');var rf=await fetch(url);var jf=await rf.json().catch(function(){return null;});if(!jf||!jf.dsg){alert('No hay desglose que cerrar todavia. Rellena la toma de datos.');btn.disabled=false;return;}var body=new URLSearchParams();body.set('dir',dir);body.set('snapshot',JSON.stringify({dsg:jf.dsg,cuadro:jf.cuadro||null}));var r=await fetch('/plan5/cerrar'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo cerrar'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}btn.addEventListener('click',function(){if(ESTADO==='cerrado'){dialogoAbrir();return;}cerrarFlow();});pintaBtn();})();(function(){var e=document.getElementById('de_c41');if(!e)return;if(!e.value){e.value='25';window.__P5_BENEF__=0.25;}function leer(){var v=parseFloat(String(e.value||'').replace(',','.'));window.__P5_BENEF__=isNaN(v)?0.25:v/100;}e.addEventListener('change',function(){leer();if(typeof plan5GuardarTodo==='function'){plan5GuardarTodo().then(function(ok){if(typeof plan5Flash==='function')plan5Flash(e,ok);if(typeof actualizarCuadro==='function')actualizarCuadro();});}});e.addEventListener('keydown',function(ev){if(ev.key==='Enter')e.blur();});})();(function(){var SV=window.__PLAN5_SAVED__||null;var col=(SV&&SV.motor&&SV.motor.colActiva)||'plan5';window.__P5_COL__=col;var tit=document.querySelectorAll('.colsel');var cols={};tit.forEach(function(t){var c=t.parentElement;if(!c)return;c.style.border='1px solid transparent';c.style.borderRadius='10px';c.style.padding='4px';cols[t.getAttribute('data-col')]=c;t.style.cursor='pointer';t.style.userSelect='none';t.title='Clic para usar esta columna en el expediente';t.addEventListener('click',function(){window.__P5_COL__=t.getAttribute('data-col');pinta();if(typeof aplicarColumna==='function')aplicarColumna();if(typeof plan5GuardarTodo==='function')plan5GuardarTodo();});});function pinta(){Object.keys(cols).forEach(function(k){cols[k].style.borderColor=(k===window.__P5_COL__)?'var(--ptl-general-2)':'transparent';});}pinta();if(typeof aplicarColumna==='function')aplicarColumna();})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

// Pantalla de la tabla de PRECIOS (editable, fuente del motor). Incrustada igual.

const DESGLOSE_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 · MEDICIONES</title>\n<style>\n  .page{max-width:1100px}\n  .card{padding:6px}\n  .p5icon{background:none;border:1px solid var(--ptl-general-2);border-radius:6px;width:30px;height:30px;font-size:15px;line-height:1;cursor:pointer;color:var(--ptl-titulo);margin-left:4px}\n  .p5icon:disabled{opacity:.35;cursor:default}\n  table.dsg{width:100%;border-collapse:collapse}\n  table.dsg thead th{position:sticky;top:52px;z-index:80;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;font-size:10px;letter-spacing:.4px;text-align:left;padding:4px 4px;border-bottom:1px solid var(--ptl-general-2)}\n  table.dsg th.num,table.dsg td.num{text-align:right}\n  table.dsg td{padding:1px 4px;border-bottom:1px solid var(--ptl-general-2);font-size:11px}\n  table.dsg tr.cap td{background:var(--ptl-general-2);color:var(--ptl-titulo);text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:.4px}\n  table.dsg tr.tot td{font-weight:700;color:var(--ptl-titulo)}\n  table.dsg th.ud,table.dsg td.ud{width:26px}\n  table.dsg td.con{width:auto}\n  table.dsg th.dato,table.dsg td.dato{width:38px;text-align:right}\n  table.dsg td.dato input.cell{text-align:right;height:22px;width:24px;font-size:9px;padding:0 1px}\n  table.dsg th.cant,table.dsg td.cant{width:48px}\n  table.dsg th.var,table.dsg td.var{width:72px;font-size:10px;text-align:right}\n  table.dsg th.pre,table.dsg td.pre{width:54px}\n  table.dsg th.par,table.dsg td.par{width:46px}\n  table.dsg th.cap,table.dsg td.cap{width:176px;font-size:10px;color:var(--ptl-general-4)}\n  .dsg-empty{color:var(--ptl-general-4);font-style:italic;padding:14px 8px}\n  table.dsg td.dato{white-space:nowrap}\n  table.dsg td.dato.tramos{width:auto}\n  table.dsg td.dato.texto{width:auto;text-align:right;color:var(--ptl-titulo);font-size:10px}\n  .dunit{color:var(--ptl-general-4);font-size:10px;margin-left:4px}\n  input.dnum{width:32px;text-align:right;height:20px;font-size:9px;padding:0 1px}\n  .trow{display:inline-flex;align-items:center;gap:3px;flex-wrap:nowrap}\n  .tarr{color:var(--ptl-general-4);font-size:10px}\n  .ttope{color:var(--ptl-general-4);font-size:10px;white-space:nowrap}\n  input.dnum.aplica{color:#166534;font-weight:700;background:#bbf7d0;border:1px solid #16a34a}\n  .avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:0 0 8px;font-size:11px}\n  input.qcell,input.pcell{width:46px;text-align:right;height:20px;font-size:10px;padding:0 1px;border:1px solid transparent;background:transparent;color:inherit}\n  input.qcell:focus,input.pcell:focus{border-color:var(--ptl-general-2);background:#fff}\n  input.qcell.qover,input.pcell.pover{background:#fff7ed;border-color:#f59e0b;color:#b45309;font-weight:700}\n</style>\n</head>\n<body>\n<script>window.__DESGLOSE__=null;window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"desglose\";/*__DESGLOSE_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div id=\"avisos\"></div>\n  <div class=\"card\">\n    <table class=\"dsg\">\n      <thead><tr>\n        <th class=\"con\">Concepto</th>\n        <th class=\"dato num\">Dato</th>\n        <th class=\"cant num\">Cantidad</th>\n        <th class=\"ud\">Ud</th>\n        <th class=\"var\">Detalle</th>\n        <th class=\"pre num\">Precio</th>\n        <th class=\"par num\">Total</th>\n      </tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DSG=window.__DESGLOSE__||null;\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  var DIR=window.__PLAN5_DIR__||\"\";\n  var hist=[], hpos=-1;\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function fmt(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return x.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:\"always\"}); }\n  function numED(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return (Math.round(x*1000)/1000).toString().replace(\".\",\",\"); }\n  function fmtm(m){ if(m==null||m===\"\")return\"\"; var x=Number(m); if(isNaN(x))return esc(m); return (Math.round(x*100)/100).toString().replace(\".\",\",\")+\" m\"; }\n  function datoCell(l){\n    if(!l.dato) return '<td class=\"dato\"></td>';\n    if(l.dato.tipo===\"texto\"){ return '<td class=\"dato texto\">'+esc(l.dato.texto||\"\")+'</td>'; }\n    if(l.dato.tipo===\"tramos\"){\n      var t=l.dato.tramos||[]; var p=[];\n      p.push('<span class=\"ttope\">'+fmtm(t.length?t[0].lo:0)+'</span>');\n      for(var i=0;i<t.length;i++){\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<input class=\"cell dnum datocell'+(t[i].aplica?' aplica':'')+'\" data-row=\"'+t[i].row+'\" value=\"'+esc(numED(l.dato.mul?t[i].dias*l.dato.mul:t[i].dias))+'\" data-orig=\"'+esc(numED(l.dato.mul?t[i].dias*l.dato.mul:t[i].dias))+'\"'+(l.dato.mul?' data-mul=\"'+l.dato.mul+'\"':'')+'>');\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<span class=\"ttope\">'+fmtm(t[i].hi)+'</span>');\n      }\n      return '<td class=\"dato tramos\"><span class=\"trow\">'+p.join(\"\")+'</span><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n    }\n    var _dval=(l.dato.mul?numED((+l.dato.valor||0)*l.dato.mul):numED(l.dato.valor)); var _dmul=(l.dato.mul?' data-mul=\"'+l.dato.mul+'\"':''); if(l.dato.antes||l.dato.despues){ return '<td class=\"dato texto\">'+(l.dato.antes?'<span class=\"dunit\">'+esc(l.dato.antes)+'</span>':'')+'<input class=\"cell dnum datocell\" data-row=\"'+l.dato.row+'\" value=\"'+esc(_dval)+'\" data-orig=\"'+esc(_dval)+'\"'+_dmul+'>'+(l.dato.despues?'<span class=\"dunit\">'+esc(l.dato.despues)+'</span>':'')+'</td>'; } return '<td class=\"dato\"><input class=\"cell dnum datocell\" data-row=\"'+l.dato.row+'\" value=\"'+esc(_dval)+'\" data-orig=\"'+esc(_dval)+'\"'+_dmul+'><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n  }\n  function render(dsg){\n    DSG=dsg;\n    var av=$(\"avisos\"); if(av){ av.innerHTML=\"\"; if(dsg&&dsg.avisos&&dsg.avisos.length){ av.innerHTML='<div class=\"avbox\">'+dsg.avisos.map(function(a){return esc(a);}).join(\"<br>\")+'</div>'; } }\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    if(!dsg||!dsg.lineas||!dsg.lineas.length){\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML='<td class=\"dsg-empty\" colspan=\"7\">El motor de calculo aun no esta conectado. Rellena viviendas y longitud en Toma de datos.</td>';\n      tb.appendChild(tr); return;\n    }\n    dsg.lineas.forEach(function(l){\n      var tr=document.createElement(\"tr\");\n      if(l.tipo_fila===\"capitulo\"){ tr.className=\"cap\"; tr.innerHTML='<td colspan=\"7\">'+esc(l.concepto)+'</td>'; }\n      else if(l.tipo_fila===\"total\"){ tr.className=\"tot\"; tr.innerHTML='<td>'+esc(l.concepto)+'</td><td></td><td></td><td></td><td></td><td></td><td class=\"par num\">'+fmt(l.parcial)+'</td>'; }\n      else {\n        tr.innerHTML='<td class=\"con\" title=\"'+esc(l.capitulo_presupuesto||\"\")+'\">'+esc(l.concepto)+'</td>'+\n          datoCell(l)+\n          '<td class=\"cant num\">'+(l.ovkey?('<input class=\"cell qcell'+(l.over?' qover':'')+'\" data-ovkey=\"'+esc(l.ovkey)+'\" data-orig=\"'+esc(numED(l.cantidad))+'\" data-disp=\"'+esc(fmt(l.cantidad))+'\" value=\"'+esc(fmt(l.cantidad))+'\">'):fmt(l.cantidad))+'</td>'+\n          '<td class=\"ud\">'+esc(l.ud||\"\")+'</td>'+\n          '<td class=\"var\">'+esc(l.variante||\"\")+'</td>'+\n          '<td class=\"pre num\">'+(l.ovkey?('<input class=\"cell pcell'+(l.overP?' pover':'')+'\" data-ovkey=\"'+esc(l.ovkey)+'\" data-orig=\"'+esc(numED(l.precio))+'\" data-disp=\"'+esc(fmt(l.precio))+'\" value=\"'+esc(fmt(l.precio))+'\">'):fmt(l.precio))+'</td>'+\n          '<td class=\"par num\">'+fmt(l.parcial)+'</td>';\n      }\n      tb.appendChild(tr);\n    });\n  }\n  render(DSG);\n\n  // ---- Edicion: guarda el dato en el Sheet, el servidor recalcula todo y se repinta (verde/rojo) ----\n  function flash(el,ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  function findInput(row){ return document.querySelector('#tb input.datocell[data-row=\"'+row+'\"]'); }\n  function setUndoRedo(){ var u=$(\"undoBtn\"),r=$(\"redoBtn\"); if(u)u.disabled=(hpos<0); if(r)r.disabled=(hpos>=hist.length-1); }\n  async function guardarDato(row,valor){\n    try{\n      var body=new URLSearchParams(); body.set(\"row\",row); body.set(\"valor\",valor);\n      var r=await fetch(\"/plan5/mediciones/guardar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      return !!(j&&j.ok);\n    }catch(e){ return false; }\n  }\n  async function refetch(){\n    try{\n      var url=\"/plan5/desglose?format=json\"+(DIR?\"&dir=\"+encodeURIComponent(DIR):\"\")+(TOKEN?\"&token=\"+encodeURIComponent(TOKEN):\"\");\n      var r=await fetch(url);\n      var j=await r.json().catch(function(){return null;});\n      if(j&&typeof j.dsg!==\"undefined\"){ render(j.dsg); return true; }\n    }catch(e){}\n    return false;\n  }\n  // guarda un valor en una fila, recalcula y marca verde/rojo en esa fila\n  async function commit(row,valor){\n    var sok=await guardarDato(row,valor);\n    var rok=await refetch();\n    flash(findInput(row), sok&&rok);\n    return sok&&rok;\n  }\n  function onEdit(inp){\n    var prev=inp.getAttribute(\"data-orig\"); if(prev==null)prev=\"\";\n    var next=inp.value;\n    if(next===prev)return;\n    var _mul=+inp.getAttribute(\"data-mul\")||0; var _real=function(x){ if(!_mul)return x; var n=parseFloat(String(x).replace(\",\",\".\")); return isNaN(n)?x:String(n/_mul); };\n    hist=hist.slice(0,hpos+1); hist.push({row:inp.getAttribute(\"data-row\"),prev:_real(prev),next:_real(next)}); hpos=hist.length-1; setUndoRedo();\n    commit(inp.getAttribute(\"data-row\"),_real(next));\n  }\n  async function undo(){ if(hpos<0)return; var e=hist[hpos]; hpos--; setUndoRedo(); await commit(e.row,e.prev); }\n  async function redo(){ if(hpos>=hist.length-1)return; hpos++; var e=hist[hpos]; setUndoRedo(); await commit(e.row,e.next); }\n  function findQ(k){return document.querySelector('#tb input.qcell[data-ovkey=\"'+(window.CSS&&CSS.escape?CSS.escape(k):k)+'\"]');}\n  async function saveOverride(k,v){try{var body=new URLSearchParams();body.set(\"dir\",DIR);body.set(\"ovkey\",k);body.set(\"valor\",v);var r=await fetch(\"/plan5/mediciones/override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});return !!(j&&j.ok);}catch(e){return false;}}\n  async function commitQty(k,v){var sok=await saveOverride(k,v);var rok=await refetch();flash(findQ(k),sok&&rok);return sok&&rok;}\n  function onFocusQty(el){if(el.getAttribute(\"data-disp\")==null)el.setAttribute(\"data-disp\",el.value);el.value=el.getAttribute(\"data-orig\")||\"\";}\n  function onEditQty(el){var prev=el.getAttribute(\"data-orig\");if(prev==null)prev=\"\";var next=el.value.trim();if(next===prev){el.value=el.getAttribute(\"data-disp\")||el.value;return;}commitQty(el.getAttribute(\"data-ovkey\"),next);}\n  function findP(k){return document.querySelector('#tb input.pcell[data-ovkey=\"'+(window.CSS&&CSS.escape?CSS.escape(k):k)+'\"]');}\n  async function saveOverridePrecio(k,v){try{var body=new URLSearchParams();body.set(\"dir\",DIR);body.set(\"ovkey\",k);body.set(\"valor\",v);var r=await fetch(\"/plan5/mediciones/precio-override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});return !!(j&&j.ok);}catch(e){return false;}}\n  async function commitPrecio(k,v){var sok=await saveOverridePrecio(k,v);var rok=await refetch();flash(findP(k),sok&&rok);return sok&&rok;}\n  function onFocusPrecio(el){if(el.getAttribute(\"data-disp\")==null)el.setAttribute(\"data-disp\",el.value);el.value=el.getAttribute(\"data-orig\")||\"\";}\n  function onEditPrecio(el){var prev=el.getAttribute(\"data-orig\");if(prev==null)prev=\"\";var next=el.value.trim();if(next===prev){el.value=el.getAttribute(\"data-disp\")||el.value;return;}commitPrecio(el.getAttribute(\"data-ovkey\"),next);}\n  var tb=$(\"tb\");\n  tb.addEventListener(\"focusin\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"qcell\")) onFocusQty(el); else if(el.classList&&el.classList.contains(\"pcell\")) onFocusPrecio(el); });\n  tb.addEventListener(\"focusout\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"datocell\")) onEdit(el); else if(el.classList&&el.classList.contains(\"qcell\")) onEditQty(el); else if(el.classList&&el.classList.contains(\"pcell\")) onEditPrecio(el); });\n  tb.addEventListener(\"keydown\",function(e){ if(e.key===\"Enter\"&&e.target.classList&&(e.target.classList.contains(\"datocell\")||e.target.classList.contains(\"qcell\")||e.target.classList.contains(\"pcell\"))) e.target.blur(); });\n  var ub=$(\"undoBtn\"); if(ub) ub.onclick=undo;\n  var rb=$(\"redoBtn\"); if(rb) rb.onclick=redo;\n  setUndoRedo();\n(function(){var ESTADO=(window.__PLAN5_ESTADO__||'abierto'),CIERRE=window.__PLAN5_CIERRE__||null;if(ESTADO!=='cerrado')return;var av=$('avisos');if(av){var d=document.createElement('div');d.className='avbox';var f='';try{if(CIERRE&&CIERRE.fecha){var dt=new Date(CIERRE.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+'. Edicion bloqueada (abrelo desde Toma de datos).';av.insertBefore(d,av.firstChild);}document.querySelectorAll('#tb input.qcell, #tb input.pcell, #tb input.datocell').forEach(function(el){el.disabled=true;});})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

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
      { hasta: 10,  dias: fb(g("Fontanero (tubo conexión)", "Tramo 3 · días"), 1) },
      { hasta: 20,  dias: fb(g("Fontanero (tubo conexión)", "Tramo 4 · días"), 2) },
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
  const viv = R.entrada.viviendas || 0;
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
    viviendas:       R.entrada.viviendas || 0,
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
function _p5splitDir(d){ d=String(d||"").trim(); var m=/^(.*?)[\s,]+(\d+[A-Za-z]?)$/.exec(d); return m ? { via:m[1].trim(), num:m[2] } : { via:d, num:"" }; }
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
function _p5tablaPresupuesto(dsg, cuadro){
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
    } else {
      precio = _p5eur(r.venta); cant = "1 ud";
    }
    return '<td class="mat">'+mat+'</td><td class="diam">'+diam+'</td>'+
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
function _p5paginasLegales(meta, cuadro){
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
  <p class="legalp">LA EMPRESA pone a disposición de la Comunidad de Propietarios y esta lo podrá solicitar cuando estime oportuno durante la vigencia de las obras, copia de la póliza de seguros de responsabilidad civil y copias de los recibos compensados de la mencionada póliza de seguros.</p>
</div>`;

  var pag8 = `<div class="sheet legal">
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

  <table class="firma"><tbody>
    <tr><td class="fk">Conforme Presupuesto:</td><td class="fv">${eur(C.totP5Iva)}</td><td class="fp" rowspan="6">
      <div class="fpt">FORMAS DE PAGO</div>
      <div class="fpl"><b>1.- CONTADO POR COMUNERO</b><span>${eur(C.comunero)}</span></div>
      <div class="fpl"><b>2.- FINANCIADO COMUNERO</b></div>
      <div class="fpsub">${eur(C.fin6)} /6 meses</div>
      <div class="fpsub">${eur(C.fin12)} /12 meses</div>
      <div class="fpsub">${eur(C.fin18)} /18 meses</div>
      <div class="fpl"><b>3.- FINANCIADO CCPP</b><span>${eur(C.finCom)}</span></div>
      <div class="fpsub">MÁXIMO 120 MESES</div>
    </td></tr>
    <tr><td class="fk">Presupuesto con Subvención:</td><td class="fv">${eur(C.totSubv)}</td></tr>
    <tr><td class="fk">Importe por comunero:</td><td class="fv">${eur(C.comunero)}</td></tr>
    <tr><td class="fk">&nbsp;</td><td class="fv"></td></tr>
    <tr><td class="fk">Fecha: ${fecha}</td><td class="fv"></td></tr>
    <tr><td class="fk">N.I.F.:</td><td class="fv">N.I.F.: B-90.488.222</td></tr>
  </tbody></table>
  <table class="firma2"><tbody>
    <tr><td>Firmado conforme:</td><td>Firmado: Alberto Araujo</td></tr>
    <tr class="fsmall"><td>Presidente de la CCPP</td><td>LA EMPRESA</td></tr>
    <tr class="fsmall"><td>(NO ADMINISTRADOR)</td><td></td></tr>
  </tbody></table>
</div>`;

  return pag7 + pag8;
}
// Página 9: Análisis de Subvención (datos EMASESA del motor: acometida, cuotas, bonificaciones, neto).
function _p5paginaSubvencion(R, meta, cuadro){
  var C = cuadro || {}; var em = C.emasesa || {}; var f = (R && R.finca) || {};
  if (!C.emasesa) return ""; // sin datos del motor todavia
  var eur = function(n){ return _p5eur(n); };
  var neg = function(n){ var v = Math.abs(Number(n)||0); return "-" + _p5eur(v); };
  var sp = _p5splitDir(meta && (meta.direccion || ""));
  var via = (f.direccion && String(f.direccion).trim()) ? f.direccion : sp.via;
  var num = (f.numero!=null && f.numero!=="") ? f.numero : sp.num;
  var pob = f.poblacion || ""; var cp = f.cp || "";
  var np = _p5esc((meta && meta.nPresupuesto) || "");
  var viv = C.viviendas || 0;

  var impPres = C.totP5Iva || 0;
  var acom = em.importeAcometida || 0;
  var cuotas = em.cuotasFianzas || 0;
  var total = impPres + acom + cuotas;
  var subv = em.subvencion || 0;
  var bonA = em.bonifAcometida || 0;
  var bonC = em.bonifCuotas || 0;
  var ayudas = em.totalAyudas != null ? em.totalAyudas : -(subv + bonA + bonC);
  var neto = em.neto != null ? em.neto : (total + ayudas);
  var fianza = em.contratacionPorComunero || 0;
  var porCom = em.porComunero || C.comunero || 0;
  var netoCom = porCom - fianza;

  var fila = function(label, val, cls){ return '<tr class="'+(cls||"")+'"><td class="sl">'+label+'</td><td class="sv">'+val+'</td></tr>'; };

  return `<div class="sheet subv">
  <div class="subvhead">
    <div>Presupuesto nº ${np}</div>
    <div class="subvtit">Análisis de Subvención</div>
  </div>

  <div class="subvsec">DIRECCIÓN DE LA FINCA PRESUPUESTADA</div>
  <table class="subvgrid"><tbody>
    <tr><td>Calle: <b>${_p5esc(via)}</b></td><td>Número: <b>${_p5esc(num)}</b></td></tr>
    <tr><td>Población: <b>${_p5esc(pob)}</b></td><td>Código Postal: <b>${_p5esc(cp)}</b></td></tr>
  </tbody></table>

  <div class="subvsec">DATOS DEL PRESUPUESTO</div>
  <table class="subvgrid"><tbody>
    <tr><td>INSTALADOR: <b>Instalaciones Araujo (Ara Corporate Sdad. Inv. SL)</b></td><td>Nº de viviendas y/o locales: <b>${viv}</b></td></tr>
  </tbody></table>

  <table class="subvtab"><tbody>
    ${fila("IMPORTE DEL PRESUPUESTO (10% IVA incluido)", eur(impPres))}
    ${fila("IMPORTE DE LA NUEVA ACOMETIDA DE AGUA", eur(acom))}
    ${fila("IMPORTE CUOTAS DE CONTRATACIÓN Y FIANZAS", eur(cuotas))}
    ${fila("TOTAL", eur(total), "stot")}
    ${fila("SUBVENCIÓN EMASESA", neg(subv))}
    ${fila("BONIFICACIÓN ACOMETIDA", neg(bonA))}
    ${fila("BONIFICACIÓN EN CUOTAS DE CONTRATACIÓN Y FIANZAS", neg(bonC))}
    ${fila("TOTAL AYUDAS EXTRAORDINARIAS PLAN CINCO", neg(ayudas), "stot")}
    ${fila("IMPORTE NETO", eur(neto), "sneto")}
  </tbody></table>

  <div class="subvsec2">Análisis supuesto pago en efectivo:</div>
  <div class="subvnote">Distribución en función de los tipos de viviendas</div>
  <table class="subvtab2"><tbody>
    <tr><td class="sl">${viv} de 13 mm. Comunidad ( 1 )</td><td class="sv"></td></tr>
    ${fila("Importe neto por comunero", eur(netoCom))}
    ${fila("Cuota de Contratación (*)", eur(0))}
    ${fila("Fianza según tipo (*)", eur(fianza))}
    ${fila("Total efectivo por comunero", eur(porCom), "sneto")}
  </tbody></table>

  <div class="subvres">RESUMEN &nbsp;·&nbsp; Si paga al contado: <b>${eur(porCom)}</b></div>
  <div class="subvfoot">(*) Los precios de Cuotas de Contratación, Fianzas e importes de subvención son los previstos para el año 2026.<br>(*) Esta información es orientativa hasta su aprobación definitiva por EMASESA.</div>
</div>`;
}
// Páginas 2-5: Memoria de la Instalación (prosa generada desde la toma de datos, peines y motor).
var _P5_EQUIPTIPO = { "Cocina + Lavadero + sanitario":"TIPO A", "Cocina + Lavadero + aseo":"TIPO B", "Cocina + Lavadero + baño":"TIPO C", "Cocina + Office + Lavadero + baño + aseo":"TIPO D", "Cocina + Office + Lavadero + 2 baño + aseo":"TIPO E", "Otros":"TIPO F" };
// índices fiables del array v[] (campos editables estáticos, < 23)
var _P5V = { contadorNum:11, ubicContador:12, llaveAcerado:13, matConexion:15, diamConexion:16, matMontante:21, cuartoUbic:22 };

function _p5fachada(s){ s=String(s||"").toUpperCase(); if(s.indexOf("DELANT")>=0) return "delantera"; if(s.indexOf("LATERAL")>=0) return "lateral"; if(s.indexOf("TRASERA")>=0) return "trasera"; return ""; }
function _p5tramosLong(tramos){ var t=0; (tramos||[]).forEach(function(x){ t += parseFloat(String(x.long||"0").replace(",","."))||0; }); return t; }
function _p5protTxt(tramos){ var p=((tramos||[])[0]||{}).prot||""; var M={ "B.FORJADO":"bajo forjado","CANALETA":"bajo canaleta","F.VIGA":"bajo falsa viga","F.TECHO":"bajo falso techo","B.LADRILLO":"bajo fábrica de ladrillo" }; return M[p]||""; }
function _p5numES(n){ if(n==null||isNaN(n)) return ""; return Number(n).toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2}); }

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

  // tabla destino de suministro
  var rowsTipo = [
    ["Local", (porTipo["LOCAL"]||0), "TIPO B", "Comercial"],
    ["Domestico", (porTipo["TIPO B"]||0), "TIPO B", "Vivienda"],
    ["Domestico", (porTipo["TIPO C"]||0), "TIPO C", "Vivienda"],
    ["Domestico", (porTipo["TIPO D"]||0), "TIPO D", "Vivienda"],
    ["Domestico", (porTipo["TIPO E"]||0), "TIPO E", "Vivienda"],
    ["Comunitario", nCom, "TIPO A", "Comunidad"]
  ];
  var tipoMayor = ""; ["TIPO E","TIPO D","TIPO C","TIPO B","TIPO A"].forEach(function(t){ if(!tipoMayor && porTipo[t]) tipoMayor=t; });
  var distrib = vivs.length ? Object.keys(porTipo).map(function(t){ return porTipo[t]+" viviendas "+t; }).join(" - ") : "";

  // ---- B) propuesto ----
  var diamAcom = (R && R.conexion && R.conexion.diam) ? (R.conexion.diam+"mm") : "";
  var matConexNew = "PE";
  var longCon = parseFloat(String(m.longCon||"0").replace(",","."))||0;
  var soloPieceria = String(m.montaje||"").toUpperCase()==="SOLO PIECERIA";
  var bat1 = String(m.bat1||""); var bm = /(\d+)\s*T\s*-\s*(\d+)\s*F/i.exec(bat1);
  var batTomas = bm?bm[1]:""; var batFilas = bm?bm[2]:"";
  var nContadores = +m.nsum || nViv+nCom;
  var cuartoUbic = vg(_P5V.cuartoUbic);
  var tipoCuarto = String(m.tipoCuarto||"");
  var matArmario = /ALUMINIO/i.test(tipoCuarto) ? "aluminio" : (/HIERRO/i.test(tipoCuarto)?"hierro":"aluminio");
  var gpRenuncia = !(+m.gpInstala||0);

  // ---- montantes (peines) ----
  function peineTxt(pe, i){
    var puerta = pe.puerta ? (" (PUERTAS "+_p5esc(pe.puerta)+")") : "";
    var trayecto = _p5tramosLong(pe.tramos); var prot = _p5protTxt(pe.tramos);
    var sube = pe.peineV==="V-EXT" ? "subir por el exterior" : (pe.peineV==="V-INT" ? "subir por el interior" : "subir");
    var fachSube = _p5fachada(pe.mnSube) || fachReg;
    var conecta, llave;
    if(String(pe.enganche||"").indexOf("INT")>=0){ conecta="conectando por el punto más cercano del interior"; llave="colocando una nueva llave general de corte y anulando la antigua"; }
    else { conecta="conectando por el punto de entrada exterior existente"; llave="en el que se colocará la nueva llave general de corte"; }
    return "PEINE "+(i+1)+": alimenta 1 vivienda por planta"+puerta+
      " y tiene un trayecto "+(prot?prot+" ":"")+"de "+_p5numES(trayecto)+"m"+
      (fachSube?(", buscando la fachada "+fachSube+" para "+sube):(", para "+sube))+
      ", "+conecta+", "+llave+".";
  }
  var montantesHtml = peines.length
    ? peines.map(function(pe,i){ return '<p class="memp">'+_p5esc(peineTxt(pe,i)).replace(/&lt;/g,"<").replace(/&gt;/g,">")+'</p>'; }).join("")
    : '<p class="memp p5pend">(sin peines en la toma de datos)</p>';

  // ===== PÁGINA 2 =====
  var pag2 = `<div class="sheet memo">
  <div class="memh">1.- Memoria de la Instalación</div>
  <div class="memsub">A) Descripción del edificio:</div>
  <p class="meml"><b>NÚMERO DE PLANTAS DEL EDIFICIO:</b> Planta baja${plantas?(" + "+plantas+" plantas"):""}</p>
  <p class="meml"><b>ALTURA ÚLTIMO RECEPTOR:</b> ${altura&&plantas?(_p5numES(altura*plantas)+"m"):""}</p>
  <p class="meml"><b>TOMA DE COMUNIDAD:</b> ${nCom>0?"Sí":"No"}</p>
  <p class="meml"><b>DESCRIPCIÓN DEL EDIFICIO:</b><br>
  Finca Urbana, situada en ${_p5esc(dir)} de ${_p5esc(pob)}, ${_p5esc(cp)} - ${_p5esc(prov)}.<br>
  Está compuesta por planta baja${plantas?(" + "+plantas+" plantas"):""}, con un total de ${nViv} viviendas${nCom>0?(" y "+nCom+" punto de comunidad (portal)"):""}.${fachReg?(" El Registro de Emasesa se encuentra a pie de calle (en la parte "+fachReg+" del edificio)."):""}</p>
  <table class="memtab"><thead><tr><th>Destino del suministro</th><th>Nº de viviendas o locales</th><th>Clasificación</th><th>Actividad</th></tr></thead><tbody>
    ${rowsTipo.map(function(r){ return '<tr><td>'+r[0]+'</td><td class="c">'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>'; }).join("")}
    <tr><td>Con más de un punto de agua</td><td class="c">0</td><td></td><td></td></tr>
  </tbody></table>
  <p class="meml"><b>DESCRIPCIÓN DE LA DISTRIBUCIÓN DE LAS VIVIENDAS:</b><br>Hay - ${_p5esc(distrib||("")) }${nCom>0?(" - "+nCom+" toma de comunidad TIPO A"):""}.</p>
  <p class="meml"><b>IDENTIFICACIÓN DE LAS VIVIENDAS:</b><br>${pbaja?("La planta baja tiene las puertas "+_p5esc(pbaja)):""}${presto?(" - Cada planta tiene las puertas "+_p5esc(presto)):""}.</p>
  <p class="meml"><b>ACOMETIDA:</b><br>Es de material y diámetro desconocido.</p>
  <p class="meml"><b>TUBO DE CONEXIÓN:</b><br>${vg(_P5V.matConexion)?("Es de "+_p5esc(vg(_P5V.matConexion))+(vg(_P5V.diamConexion)?(", diámetro DN/OD "+_p5esc(vg(_P5V.diamConexion))+"mm"):"")+(fachReg?(" y cruza la línea de fachada "+fachReg+" hasta llegar al contador."):".")):"—"}</p>
  <p class="meml"><b>CONTADOR:</b><br>El contador${vg(_P5V.contadorNum)?(" (nº "+_p5esc(vg(_P5V.contadorNum))+")"):""} está ubicado en ${_p5esc((vg(_P5V.ubicContador)||"zonas comunes").toLowerCase())} del edificio.</p>
  <p class="meml"><b>ABASTECIMIENTO ACTUAL:</b><br>${vg(_P5V.matMontante)?("Los montantes actuales son de "+_p5esc(vg(_P5V.matMontante).toLowerCase())+"."):"—"}</p>
  <p class="meml"><b>Nº DE CONEXIONES A VIVIENDAS:</b><br>Las viviendas tienen una entrada de agua, siendo en total ${nViv} conexiones a vivienda${nCom>0?(", más "+nCom+" conexión a comunidad"):""}.</p>
  <p class="meml"><b>TIENE GRUPO HIDRONEUMÁTICO:</b> ${(+m.gpMotAct||0)?"Sí":"No"}.</p>
  <p class="meml"><b>TIENE ALJIBE:</b> No.</p>
</div>`;

  // ===== PÁGINA 3 =====
  var pag3 = `<div class="sheet memo">
  <div class="memsub">B) Descripción del abastecimiento propuesto</div>
  <p class="meml"><b>NUEVO GRUPO HIDRONEUMÁTICO:</b><br>${gpRenuncia?"La CC.PP. renuncia al grupo de presión.":"Se instalará un nuevo grupo de presión."}</p>
  <p class="meml"><b>EMPLAZAMIENTO DEL NUEVO GRUPO:</b><br>${gpRenuncia?"No es necesario.":(_p5esc(m.gpUbic||"")||"—")}</p>
  <p class="meml"><b>DIÁMETRO DE LA NUEVA ACOMETIDA:</b><br>${diamAcom?("DN/OD "+_p5esc(diamAcom)+"."):"—"}</p>
  <p class="meml"><b>DIÁMETRO DEL TUBO DE CONEXIÓN:</b><br>${diamAcom?("DN/OD "+_p5esc(diamAcom)+"."):"—"}</p>
  <p class="meml"><b>LONGITUD DEL TUBO DE CONEXIÓN:</b><br>${longCon?(_p5numES(longCon)+"m"):"—"}</p>
  <p class="meml"><b>MATERIAL DEL TUBO DE CONEXIÓN:</b><br>${matConexNew}</p>
  <p class="meml"><b>DIÁMETRO DEL TUBO DE ALIMENTACIÓN:</b><br>${soloPieceria?"No existe.":"—"}</p>
  <p class="meml"><b>LONGITUD DEL TUBO DE ALIMENTACIÓN:</b><br>${soloPieceria?"Sólo piecería.":(_p5numES(parseFloat(String(m.longAli||"0").replace(",","."))||0)+"m")}</p>
  <p class="meml"><b>MATERIAL DEL TUBO DE ALIMENTACIÓN:</b><br>${soloPieceria?"No existe.":"PERT"}</p>
  <p class="meml"><b>TRAZADO DEL TUBO DE ALIMENTACIÓN:</b><br>${soloPieceria?"No existe.":"—"}</p>
  <p class="meml"><b>SITUACIÓN DE LA LLAVE GENERAL DE CORTE:</b><br>En batería (${(+m.llaves||0)}ud).</p>
  <div class="memsub2">DESCRIPCIÓN:</div>
  <p class="meml"><b>ACOMETIDA:</b><br>Será de ${matConexNew}, de diámetro DN/OD ${_p5esc(diamAcom||"")}.</p>
  <p class="meml"><b>TUBO DE CONEXIÓN:</b><br>Será de ${matConexNew}, de diámetro DN/OD ${_p5esc(diamAcom||"")}${longCon?(" y tendrá una longitud de "+_p5numES(longCon)+"m"):""}.</p>
  <p class="meml"><b>TUBO DE ALIMENTACIÓN:</b><br>${soloPieceria?"Sólo piecería.":"—"}</p>
  <p class="meml"><b>BATERÍA DE CONTADORES:</b><br>Se instalará una batería de contadores de polipropileno${batTomas?(" de "+batTomas+" tomas"):""}${batFilas?(" y "+batFilas+" filas"):""} para un total de ${nContadores} contadores.<br>
  Se colocará en nuevo armario de ${matArmario}${cuartoUbic?(", "+_p5esc(cuartoUbic.toLowerCase())):""}, con puertas de acceso de ${matArmario}, dotadas de rejillas de ventilación y cerradura normalizada por Emasesa.<br>
  En la puerta de dicho cuarto/armario se instalará, en lugar destacado y de forma visible, un esquema señalizando debidamente los distintos montantes, salidas de batería y su correspondencia con las viviendas/locales.</p>
</div>`;

  // ===== PÁGINA 4 =====
  var pag4 = `<div class="sheet memo">
  <p class="meml">Dispondrá de un sumidero para evitar posibles fugas (no se instalará desagüe cuando el cuarto/armario se encuentre en patios, zonas exteriores o en habitáculos que ya dispongan del mismo).</p>
  <table class="memtab"><thead><tr><th>Batería nº</th><th>Nº de tomas</th><th>Nº de filas</th><th>Emplazamiento</th></tr></thead><tbody>
    <tr><td class="c">1</td><td class="c">${batTomas}</td><td class="c">${batFilas}</td><td>en nuevo armario de ${matArmario}</td></tr>
  </tbody></table>
  <div class="memsub2">MONTANTES:</div>
  <p class="meml">Partirán desde la batería de contadores, alimentando las distintas viviendas con la siguiente distribución:</p>
  ${montantesHtml}
</div>`;

  // ===== PÁGINA 5 (texto mayormente fijo) =====
  var pag5 = `<div class="sheet memo">
  <div class="memsub2">GRUPOS DE PRESIÓN:</div>
  <p class="meml">${gpRenuncia?"La CC.PP. renuncia al grupo de presión (se adjunta documento de renuncia).":"Se instalará el nuevo grupo de presión descrito."}</p>
  <div class="memsub2">AISLAMIENTO TÉRMICO:</div>
  <p class="meml">Los montantes exteriores irán aislados con coquilla y forrados con canaleta de aluminio blanco para garantizar su aislamiento y protección.<br>Cuando discurran por suelo, irán forrados con fábrica de ladrillo protegida con pintura impermeabilizante.</p>
  <div class="memsub2">ALBAÑILERÍA:</div>
  <p class="meml"><i>Zonas comunes</i><br>Se contempla la demolición y reposición necesarias para la desconexión y conexión.<br>La tubería de alimentación irá forrada bajo canaleta de aluminio blanco, bajo falsa viga de escayola de nueva construcción o bajo falso techo existente, según sea el caso.<br>Se construirá un nuevo armario de aluminio, con puertas de aluminio, para la batería de contadores.</p>
  <p class="meml"><i>Interior de viviendas</i><br>En caso de conexión por el punto más cercano del interior de las cocinas, o por el punto más cercano del interior de las viviendas (máx. 5m), se incluye el "regolado" de las tuberías y la mano de obra de reposición de los elementos decorativos afectados, los cuales deberán ser aportados por los propietarios.<br>Si la conexión de entrada no se hace en la llave de paso existente, será obligatorio anular dicha llave para separarla de la instalación común antigua.</p>
  <div class="memsub">C) Plazo de ejecución de los trabajos presupuestados</div>
  <p class="meml">La fecha de inicio de los trabajos será de común acuerdo con la Comunidad de Propietarios, y siempre que el pago haya sido efectuado.</p>
</div>`;

  return pag2 + pag3 + pag4 + pag5;
}
// Páginas 11-12: Anexo de financiación Prodinamia (reproducido como HTML para que imprima con el documento).
// Tabla de cuotas = amortización francesa sobre importe×1,01 (comisión apertura 1%); TIN 5,50% (<=84m) / 5,75% (>=96m).
function _p5prodLogo(){
  return '<span class="prodlogo"><span class="pdots">&#9679;&#9679;&#9679;</span><span class="pa">prod</span><span class="pb">inamia</span></span>';
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

  var pag1 = `<div class="sheet prod">
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
  <p class="prodp">Se trata de un préstamo para la comunidad de propietarios ${_p5esc(comunidad)} de <b>${_p5eur(importe)}</b> al plazo máximo de ${plazoMax} meses para ${vecinos} vecinos.</p>
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
function renderPresupuesto(R, meta, dsg, cuadro, saved){
  R = R || {}; meta = meta || {};
  var f = R.finca || {};
  var rm = R.meta || {};
  var sp = _p5splitDir(meta.direccion || f.direccion || "");
  var via = (f.direccion && String(f.direccion).trim()) ? f.direccion : sp.via;
  var num = (f.numero!=null && f.numero!=="") ? f.numero : sp.num;
  var poblacion = f.poblacion || "";
  var cp = f.cp || "";
  var provincia = f.provincia || "";
  var nombre = f.presidente || f.administrador || "";
  var email = f.email || "";
  var tel = f.telefono || "";
  var np = meta.nPresupuesto || rm.nPresupuesto || "";
  var fecha = _p5fecha(meta.fecha || rm.fecha || "");
  var rev = meta.rev || rm.rev || "";
  var pend = '<span class="p5pend">— (pendiente del expediente)</span>';
  var V = function(v){ return v ? _p5esc(v) : pend; };
  var tabla = _p5tablaPresupuesto(dsg, cuadro);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Presupuesto ${_p5esc(np)} - ${_p5esc(via)}</title>
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
  .ficha{ color:var(--navy); font-size:11pt; line-height:1.55; margin-left:2mm; }
  .empresa{ text-align:center; color:var(--navy); margin-top:9mm; line-height:1.55; font-size:11pt; }
  .rev{ text-align:right; font-size:8pt; color:#5b7fa6; margin-top:2mm; }
  /* ---- Tabla del presupuesto ---- */
  .sech{ color:var(--navy); font-size:12.5pt; font-weight:bold; margin:0 0 8px; }
  table.ptab{ width:100%; border-collapse:collapse; font-size:8.6pt; }
  table.ptab th{ text-align:left; font-weight:normal; font-style:italic; color:#333; border-bottom:1px solid #999; padding:2px 4px; }
  table.ptab th.num{ text-align:right; }
  table.ptab td{ padding:1.5px 4px; vertical-align:top; }
  table.ptab td.num{ text-align:right; white-space:nowrap; }
  table.ptab td.mat,table.ptab td.diam{ color:#444; white-space:nowrap; }
  table.ptab tr.cap td{ font-weight:bold; color:var(--navy); border-top:1px solid var(--navy); padding-top:4px; }
  table.ptab tr.sub td{ font-weight:bold; }
  table.ptab tr.ln td.den{ padding-left:14px; }
  .resumen{ margin-top:14px; page-break-inside:avoid; }
  .resumen .rtit{ color:var(--navy); font-weight:bold; font-size:10pt; margin-bottom:4px; }
  table.rtab{ width:60%; border-collapse:collapse; font-size:9pt; }
  table.rtab td{ padding:2px 6px; }
  table.rtab td.num{ text-align:right; white-space:nowrap; }
  table.rtab tr.rtot td{ font-weight:bold; border-top:1px solid var(--navy); }

  /* ---- Páginas legales + firma ---- */
  .legal .legalh{ color:var(--navy); font-weight:bold; font-size:12.1pt; margin:12px 0 4px; }
  .legal .legalp{ font-size:11pt; line-height:1.4; text-align:justify; margin:0 0 7px; }
  .legal .legalul{ font-size:11pt; line-height:1.4; margin:0 0 7px; padding-left:18px; }
  .legal .legalul li{ margin-bottom:2px; }
  table.firma{ width:100%; border-collapse:collapse; margin-top:14px; font-size:11pt; }
  table.firma td{ padding:2px 6px; vertical-align:top; }
  table.firma td.fk{ width:32%; color:#222; }
  table.firma td.fv{ width:24%; font-weight:bold; white-space:nowrap; }
  table.firma td.fp{ width:44%; border:1px solid var(--navy); padding:8px 10px; vertical-align:top; }
  .fpt{ font-weight:bold; text-align:center; color:var(--navy); margin-bottom:6px; }
  .fpl{ display:flex; justify-content:space-between; margin-top:4px; }
  .fpsub{ text-align:right; color:#333; }
  table.firma2{ width:100%; margin-top:26px; font-size:11pt; }
  table.firma2 td{ width:50%; text-align:center; border-top:1px solid #333; padding-top:4px; }
  table.firma2 tr.fsmall td{ border-top:0; padding-top:0; font-size:9.35pt; color:#444; }

  /* ---- Análisis de subvención ---- */
  .subv .subvhead{ display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid var(--navy); padding-bottom:4px; margin-bottom:10px; color:var(--navy); font-size:11pt; }
  .subv .subvtit{ font-size:15.4pt; font-weight:bold; }
  .subv .subvsec{ background:var(--navy); color:#fff; font-weight:bold; font-size:11pt; padding:3px 8px; margin:12px 0 6px; }
  .subv .subvsec2{ color:var(--navy); font-weight:bold; font-size:11pt; margin:14px 0 2px; }
  .subv .subvnote{ font-size:9.9pt; color:#444; margin-bottom:4px; }
  table.subvgrid{ width:100%; font-size:11pt; border-collapse:collapse; }
  table.subvgrid td{ padding:2px 8px; width:50%; }
  table.subvtab,table.subvtab2{ width:100%; border-collapse:collapse; font-size:11pt; margin-top:6px; }
  table.subvtab td.sl,table.subvtab2 td.sl{ padding:3px 8px; border-bottom:1px dotted #bbb; }
  table.subvtab td.sv,table.subvtab2 td.sv{ padding:3px 8px; text-align:right; white-space:nowrap; border-bottom:1px dotted #bbb; width:130px; }
  table.subvtab tr.stot td,table.subvtab2 tr.stot td{ font-weight:bold; border-bottom:1px solid var(--navy); }
  table.subvtab tr.sneto td,table.subvtab2 tr.sneto td{ font-weight:bold; color:var(--navy); border-bottom:2px solid var(--navy); }
  .subv .subvres{ margin-top:12px; font-size:11pt; color:var(--navy); }
  .subv .subvfoot{ margin-top:14px; font-size:8.8pt; color:#555; font-style:italic; }

  /* ---- Memoria descriptiva ---- */
  .memo .memh{ color:var(--navy); font-weight:bold; font-size:14.3pt; border-bottom:2px solid var(--navy); padding-bottom:3px; margin-bottom:8px; }
  .memo .memsub{ color:var(--navy); font-weight:bold; font-size:12.1pt; margin:10px 0 6px; }
  .memo .memsub2{ color:var(--navy); font-weight:bold; font-size:11pt; margin:8px 0 3px; }
  .memo .meml{ font-size:11pt; line-height:1.4; text-align:justify; margin:0 0 6px; }
  .memo .memp{ font-size:11pt; line-height:1.4; text-align:justify; margin:0 0 6px; }
  table.memtab{ width:100%; border-collapse:collapse; font-size:9.9pt; margin:6px 0 8px; }
  table.memtab th{ background:var(--navy); color:#fff; text-align:left; padding:3px 6px; font-weight:bold; }
  table.memtab td{ border:1px solid #bbb; padding:2px 6px; }
  table.memtab td.c{ text-align:center; }

  /* ---- Anexo Prodinamia ---- */
  .prod{ font-size:10pt; }
  .prodhead{ display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .prodhead .prodara{ width:26mm; height:auto; }
  .prodlogo{ font-size:20pt; font-weight:800; letter-spacing:-.5px; }
  .prodlogo .pdots{ color:#f7941d; font-size:9pt; letter-spacing:-3px; margin-right:3px; vertical-align:middle; }
  .prodlogo .pa{ color:#f7941d; }
  .prodlogo .pb{ color:#3a3a3a; }
  .prod .prodtit{ text-align:center; font-weight:bold; font-size:13pt; margin:6px 0 12px; padding:0 30mm; color:#111; }
  .prod .prodh{ color:#f7941d; font-weight:bold; font-size:10pt; margin:12px 0 4px; }
  .prod .prodp{ font-size:10pt; line-height:1.45; text-align:justify; margin:0 0 8px; }
  .prod .prodacta{ font-size:9pt; font-style:italic; color:#333; margin:0 0 8px; padding-left:18px; }
  .prod .prodnota{ font-size:8.5pt; color:#555; text-align:center; margin:4px 0; }
  .prod .prodcond{ font-size:10pt; font-weight:bold; text-align:center; margin:10px 0 4px; }
  .prod .prodfine{ font-size:7pt; color:#666; font-style:italic; line-height:1.35; text-align:justify; margin-top:10px; }
  table.prodtab{ border-collapse:collapse; margin:14px auto; width:62%; font-size:10pt; }
  table.prodtab th{ background:#f1f1f1; color:#333; padding:4px 8px; text-align:center; border:1px solid #ccc; font-weight:bold; }
  table.prodtab th.pcm{ background:#fff; color:#111; font-size:11pt; }
  table.prodtab td{ padding:3px 8px; text-align:center; border:1px solid #ddd; }
  table.prodtab td.pz{ background:#fde9cf; color:#b4660a; font-weight:bold; }
  table.prodtab td.pt{ color:#b4660a; }
  table.prodtab thead tr:nth-child(2) th:nth-child(3),table.prodtab thead tr:nth-child(2) th:nth-child(4){ color:#b4660a; }
  .prodfoot{ margin-top:18px; border-top:1px solid #ddd; padding-top:4px; }
  .prodfoot .pf1{ text-align:center; font-size:7.5pt; color:#888; }
  .prodfoot .pf2{ display:flex; justify-content:space-between; font-size:7.5pt; color:#aaa; margin-top:2px; }

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
  .docfoot .dfnp{ font-size:10pt; color:var(--navy); padding-top:2px; }
  @media print{
    body{ background:#fff; }
    .p5toolbar{ display:none; }
    .sheet{ width:auto; min-height:0; margin:0; padding:0; box-shadow:none; }
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
    Presupuesto Nº: ${V(np)}<br>
    Fecha:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${V(fecha)}<br>
    C/ o Plaza:&nbsp;${V(via)}<br>
    Edificio nº:&nbsp;${V(num)}<br>
    Población:&nbsp;${V(poblacion)}<br>
    C.P.:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${V(cp)}<br>
    Provincia:&nbsp;${V(provincia)}<br>
    Nombre:&nbsp;&nbsp;&nbsp;${V(nombre)}<br>
    Email:&nbsp;&nbsp;&nbsp;&nbsp;${V(email)}<br>
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
${ _p5paginasLegales(meta, cuadro) }
${ _p5paginaSubvencion(R, meta, cuadro) }
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
  add("Punto de luz", "ud", 1, "ALB", "2.2. Punto de luz");
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
  var a = 0;
  if (t.slice(0, 2) === "1-") { a = 1; t = t.slice(2); }
  else if (t.slice(0, 2) === "2-") { a = 2; t = t.slice(2); }
  var b = 0, c = 0, s = t.slice(-2);
  if (s === "+1") { c = 1; t = t.slice(0, -2); }
  else if (s === "+2") { c = 2; t = t.slice(0, -2); }
  else if (s === "-1") { b = 1; t = t.slice(0, -2); }
  else if (s === "-2") { b = 2; t = t.slice(0, -2); }
  return { base: t, a: a, b: b, c: c };   // a = faltan en baja, b = faltan arriba, c = áticos
}
// Lista de alturas (en nº de alturas de planta) de los montantes del peine.
function alturasPeine(base, a, b, c, n) {
  var k = (base === "DOBLE") ? 2 : 1, alt = [], p, col, i;
  for (p = 0; p <= n; p++) for (col = 0; col < k; col++) alt.push(p + 1);
  for (i = 0; i < a && alt.length; i++) alt.splice(alt.indexOf(Math.min.apply(null, alt)), 1);     // faltan en baja (cortos)
  for (i = 0; i < b && alt.length; i++) alt.splice(alt.lastIndexOf(Math.max.apply(null, alt)), 1); // faltan arriba (largos)
  for (i = 0; i < c; i++) alt.push(n + 2);                                                          // áticos
  return alt;
}
function geomPeine(t, h, n) {
  var P = parsePeine(t), alt = alturasPeine(P.base, P.a, P.b, P.c, n), tubo = 0, i;
  for (i = 0; i < alt.length; i++) tubo += alt[i];
  return { tubo: tubo * h, viv: alt.length, peine: alt.length ? Math.max.apply(null, alt) * h : 0 };
}
function pTuboS(t, h, n) { return geomPeine(t, h, n).tubo; }   // m de tubo VERTICAL del peine
function mPeineS(t, h, n) { return geomPeine(t, h, n).peine; } // m de peine VERTICAL (altura del peine)
function vivS(t, n) { return geomPeine(t, 1, n).viv; }         // nº de viviendas del peine

// Tipos válidos (23): 8 SIMPLE {prefijo "",1- · sufijo "",+1,-1,-2 ; SIN +2} + 15 DOBLE {prefijo "",1-,2- · sufijo "",+1,+2,-1,-2}.
var KNOWN_PEINE = (function () {
  var ok = {}, pres, sufs, p, s;
  pres = ["", "1-"]; sufs = ["", "+1", "-1", "-2"];
  for (p = 0; p < pres.length; p++) for (s = 0; s < sufs.length; s++) ok[pres[p] + "SIMPLE" + sufs[s]] = 1;
  pres = ["", "1-", "2-"]; sufs = ["", "+1", "+2", "-1", "-2"];
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
  var motNew = (String(e.gpInstala) === "2") ? 1 : 0;
  var motAct = parseFloat(String(e.gpMotAct == null ? "" : e.gpMotAct).replace(",", ".")) || 0;
  var pot = (e.gpPotNew == null ? "" : String(e.gpPotNew)).trim();
  var modelo = MOD[pot] || "", potConc = POT[pot] || "";
  var L = [];
  // 1. Grupo presion (bomba). Precio del catalogo por modelo serie 35. Modelo -> columna Dato.
  L.push({ concepto: "Grupo presión", variante: "", cantidad: motNew,
           precio: (motNew && potConc && modelo) ? precioDe(precios, potConc, modelo) : 0,
           tipoCoste: "GP", capitulo: "3.1 Grupo de presión", modelo: (motNew ? modelo : "") });
  // 2. By-pass: 1 si hay grupo (actual >=1 o nuevo), 0 si ninguno.
  var hayGrupo = (motAct >= 1 || motNew) ? 1 : 0;
  L.push({ concepto: "Grupo presión (by-pass + llaves + v.antiretorno + pequeño material)", variante: "ud",
           cantidad: hayGrupo, precio: precioDe(precios, "Grupo presión (by-pass + llaves + v.antiretorno + pequeño material)", "ud"),
           tipoCoste: "GP", capitulo: "3.3 By-pass + llaves + v.antiretorno + pequeño material" });
  // 3. Deposito: cantidad = nº depositos nuevo (independiente del grupo); precio por tamaño.
  var ndep = parseFloat(String(e.gpNdepNew == null ? "" : e.gpNdepNew).replace(",", ".")) || 0;
  var tdep = (e.gpTdepNew == null ? "" : String(e.gpTdepNew)).trim();
  var varDep = tdep ? (tdep + "L") : "";
  L.push({ concepto: "Grupo presión (depósito)", variante: varDep, cantidad: ndep,
           precio: (tdep ? precioDe(precios, "Grupo presión (depósito)", varDep) : 0),
           tipoCoste: "GP", capitulo: "3.4 Depósito" });
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
  var viv=(R.entrada&&R.entrada.viviendas)||0;
  var cxc=(R.emasesa&&R.emasesa.contratacionPorComunero)||0;
  var totSinSubv=((R.tradicional&&R.tradicional.totalIva)||0)+cxc*viv;
  var com=viv? totSinSubv/viv : 0;
  var fin=(R.emasesa&&R.emasesa.financiacion)||[];
  var fc=finanComunitaria(totSinSubv);
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
        var med = await leerMediciones();              // { obra, meta, order, rowOf } del Sheet
        var nViv = _contarViviendas(saved);
        var puntosCom = (saved.motor && +saved.motor.puntosComunidad) || 0;
        var R = calcular({ entrada: { nsum: +m.nsum || 0, tipoSuministro: m.tipo, longTuboConexion: +m.longCon || 0,
                           viviendas: nViv, puntosComunidad: puntosCom, masDeUnaEntrada: 0, proyecto: false,
                           grupoPresion: { seInstala: !!(+m.gpInstala || 0), tiene: false, modelo: "", deposito: "" },
                           longAlimentacion: +m.longAli || 0, montajeAli: m.montaje || "", codosTermo: +m.codos || 0,
                           llaves: +m.llaves || 0, bateria1: m.bat1 || "", bateria2: m.bat2 || "", tipoCuarto: m.tipoCuarto || "",
                           otrosTiempos: +m.otrosTiempos || 0, otrosEur: +m.otrosEur || 0, gpMotAct: +m.gpMotAct || 0, gpInstala: m.gpInstala || "", gpPotNew: m.gpPotNew || "", gpNdepNew: +m.gpNdepNew || 0, gpTdepNew: m.gpTdepNew || "", gpDias: +m.gpDias || 0, gpLongExp: +m.gpLongExp || 0, peines: (saved && saved.peines) || [], plantas: +m.plantas || 0, altura: +m.altura || 0, peinesHDias: +m.peinesHDias || 0, pctBenefVenta: m.pctBenefVenta } },
                         Object.assign({}, FUENTES, { PRECIOS_TABLA: precios, OBRA: med.obra }));
        var lineas = [{ tipo_fila: "capitulo", concepto: "1.1  TUBO DE CONEXION" }];
        var sinVar = function (v) { return v === "ud" || v === "día/cuadrilla" || v == null || v === ""; };
        var FK = { "Saco mortero": "saco_mortero", "Saco arena": "saco_arena", "Losa": "losa" };
        // Cuadrilla: localizar el tramo de días que aplica para esta longitud (el editable)
        var lc = +m.longCon || 0, tramos = (med.obra.conexion && med.obra.conexion.tiempo) || [], fidx = -1;
        for (var ti = 0; ti < tramos.length; ti++) { if (lc <= tramos[ti].hasta) { fidx = ti; break; } }
        var esCuadrilla = function (c) { return c === "Fontanero (tubo conexión)" || c === "Albañil (tubo conexión)"; };
        // Dato de cuadrilla = TODOS los tramos en una linea (0 -> [dia] -> tope -> [dia] -> tope...), el aplicado marcado en azul.
        var datoCuadrilla = (tramos && tramos.length) ? { tipo: "tramos", unidad: "horas/cuadrilla x2", mul: 8, tramos: tramos.map(function (tr, ti) {
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
        // recomputar el TOTAL de cada capítulo después de los overrides
        var _ovsum = 0;
        lineas.forEach(function (l) {
          if (l.tipo_fila === "capitulo") _ovsum = 0;
          else if (l.tipo_fila === "total") l.parcial = +_ovsum.toFixed(2);
          else _ovsum += (l.parcial || 0);
        });
        dsg = { lineas: lineas, diam: R.conexion ? R.conexion.diam : null, error: R.conexion ? R.conexion.error : false, longCon: (+m.longCon || 0), avisos: [].concat((R.conexion && R.conexion.avisos) || [], (R.alimentacion && R.alimentacion.avisos) || [], (R.montantes && R.montantes.avisos) || []) };

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
          R.emasesa.subvencion = R.entrada.viviendas * 160;
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
          };
        } catch (e) { console.error("[plan5] abrir precios error:", e.message); }
        delete saved.cierre;
      } else {
        delete saved.snapshot; delete saved.cierre; delete saved.overrides; delete saved.overridesPrecio;   // full: recalcular todo en vivo (descarta ajustes manuales de cantidad)
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

  app.get("/plan5/presupuesto", async function (req, res) {
    if (!validToken(req.query.token || "")) return res.status(403).send("token no valido");
    try {
      var dir = req.query.dir || "";
      var frow = null, savedExp = null;
      if (dir) { var ff = await leerFila(dir); if (ff) { frow = ff.row; try { savedExp = JSON.parse(ff.row[6]); } catch (e) { savedExp = null; } } }
      var meta = { nPresupuesto: (frow && frow[2]) || "", fecha: (frow && frow[3]) || "", rev: (frow && frow[4]) || "", direccion: (frow && frow[0]) || dir };
      // Datos CCPP del expediente (mismo origen que la pantalla Toma de datos: modulo presupuestos)
      var ficha = {};
      try {
        var id = req.query.id || "";
        if (id && P().buscarComunidadPorId) {
          var c = await P().buscarComunidadPorId(id);
          if (c) {
            ficha = {
              direccion: ((c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || "")).trim(),
              poblacion: c.poblacion || "",
              cp: c.cp || "",
              provincia: c.provincia || c.poblacion || "",
              presidente: c.presidente || "",
              administrador: c.administrador || "",
              email: c.email_presidente || c.email_administrador || "",
              telefono: c.telefono_presidente || c.telefono_administrador || ""
            };
          }
        }
      } catch (e) { console.error("[plan5] presupuesto expediente:", e.message); }
      var R = { finca: ficha, meta: meta };
      // Tabla del presupuesto: reutiliza el motor de MEDICIONES (mismos numeros, en venta)
      var dsg = null, cuadro = null;
      try {
        var capt = { _j: null, status: function () { return this; }, type: function () { return this; }, send: function () { return this; }, json: function (o) { this._j = o; return this; } };
        await p5DesgloseHandler({ query: { dir: dir, token: req.query.token || "", format: "json" } }, capt);
        if (capt._j) { dsg = capt._j.dsg || null; cuadro = capt._j.cuadro || null; }
      } catch (e) { console.error("[plan5] presupuesto desglose:", e.message); }
      res.send(renderPresupuesto(R, meta, dsg, cuadro, savedExp));
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
