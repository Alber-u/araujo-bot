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
const TOMA_DATOS_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<style>.vrow{border-bottom:none}.avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:8px 0;font-size:11px}input.p5mismatch{border-color:#dc2626!important;background:#fef2f2!important}.ptl-card .ptl-form-grid input[readonly]{background:var(--ptl-gray-400)!important;color:#fff!important;border-color:var(--ptl-gray-400)!important}#longAli:disabled,#ali_codos:disabled{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;opacity:1;font-weight:600}#gp_cald_new{background:var(--ptl-gray-400)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:var(--ptl-gray-400)!important;cursor:not-allowed;font-weight:600}</style>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Plan 5 · Toma de datos</title>\n</head>\n<body>\n<script>window.__PLAN5_SAVED__=null;window.__PLAN5_SCREEN__=\"toma\";/*__PLAN5_SAVED__*/</script>\n<div class=\"page\">\n\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n\n  <!-- 1. DATOS DEL PRESUPUESTO -->\n  <div class=\"card\">\n    <div class=\"t\">Datos del presupuesto</div>\n    <div class=\"grid g3\">\n      <label class=\"f\"><span class=\"lab\">Nº de presupuesto</span><input id=\"f_npresupuesto\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Fecha</span><input id=\"f_fecha\" type=\"date\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Revision</span><div class=\"combo\"><input id=\"f_revision\" value=\"Rev-18 28/05/2026\" autocomplete=\"off\"><button type=\"button\" class=\"combo-arrow\" id=\"f_revision_arrow\" aria-label=\"Desplegar\">▾</button><div class=\"combo-list\" id=\"f_revision_list\" hidden><div class=\"combo-opt\">Rev-18 28/05/2026</div></div></div></label>\n    </div>\n  </div>\n\n  <!-- 2. DATOS CCPP (del expediente; identica a la ficha, bloqueada, sin botones) -->\n  <div class=\"ptl-card\">\n    <div class=\"ptl-card-title\">Datos CCPP</div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-1\"><label class=\"ptl-form-label\">Tipo via</label><input class=\"calc-field\" id=\"f_tipovia\" value=\"\" readonly></div>\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Direccion</label><input class=\"calc-field\" id=\"f_direccion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-3\"><label class=\"ptl-form-label\">Poblacion</label><input class=\"calc-field\" id=\"f_poblacion\" value=\"\" readonly style=\"width:100%\"></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">CP</label><input class=\"calc-field\" id=\"f_cp\" value=\"\" readonly style=\"width:100%\"></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Administrador</label><input class=\"calc-field\" id=\"f_admin\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_admintel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_adminemail\" value=\"\" readonly></div>\n    </div>\n    <div class=\"ptl-form-grid\" style=\"gap:2px 6px\">\n      <div class=\"col-6\"><label class=\"ptl-form-label\">Presidente</label><input class=\"calc-field\" id=\"f_presidente\" value=\"\" readonly></div>\n      <div class=\"col-2\"><label class=\"ptl-form-label\">Telefono</label><input class=\"calc-field\" id=\"f_prestel\" value=\"\" readonly></div>\n      <div class=\"col-4\"><label class=\"ptl-form-label\">Email</label><input class=\"calc-field\" id=\"f_presemail\" value=\"\" readonly></div>\n    </div>\n  </div>\n\n  <!-- 2.5 DATOS ECONOMICOS (cuadro economico C29:F51 - SOLO GRAFICO, sin Sheet) -->\n  <div class=\"card\">\n    <div class=\"t\">Datos economicos</div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempo y costes</div>\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Tiempo ejecucion <small>(dias/cuadrilla)</small></span><div class=\"derived\" id=\"de_tEjec\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Coste materiales</span><div class=\"derived\" id=\"de_cMat\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Coste mano de obra</span><div class=\"derived\" id=\"de_cMo\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Coste albañileria</span><div class=\"derived\" id=\"de_cAlb\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Coste grupo presion</span><div class=\"derived\" id=\"de_cGp\"></div></label>\n    </div>\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Coste total</span><div class=\"derived\" id=\"de_cTot\"></div></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Margenes</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">% Bº materiales</span><div class=\"derived\" id=\"de_bMat\"></div></label>\n      <label class=\"f\"><span class=\"lab\">% Bº mano de obra</span><div class=\"derived\" id=\"de_bMo\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Coeficiente <small>(C39)</small></span><div class=\"derived\" id=\"de_c39\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Parametro <small>(C41)</small></span><div class=\"derived\" id=\"de_c41\"></div></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Presupuesto tradicional</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Bº tradicional</span><div class=\"derived\" id=\"de_btTrad\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Total presupuesto</span><div class=\"derived\" id=\"de_totTrad\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totTradIva\"></div></label>\n      <label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hTrad\"></div></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Presupuesto Plan 5</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Bº Plan 5</span><div class=\"derived\" id=\"de_bP5\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Total presupuesto</span><div class=\"derived\" id=\"de_totP5\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Total con IVA</span><div class=\"derived\" id=\"de_totP5Iva\"></div></label>\n      <label class=\"f\"><span class=\"lab\">€/h mano de obra</span><div class=\"derived\" id=\"de_hP5\"></div></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Financiacion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Cuota 6 meses <small>(8,312%)</small></span><div class=\"derived\" id=\"de_fin6\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Cuota 12 meses <small>(8,037%)</small></span><div class=\"derived\" id=\"de_fin12\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Cuota 18 meses <small>(7,708%)</small></span><div class=\"derived\" id=\"de_fin18\"></div></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Subvencion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Subvencion EMASESA</span><div class=\"derived\" id=\"de_subv\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Total con subvencion e IVA</span><div class=\"derived\" id=\"de_totSubv\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Importe por comunero</span><div class=\"derived\" id=\"de_comunero\"></div></label>\n    </div>\n  </div>\n\n  <!-- 3. EDIFICIO Y VIVIENDAS -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de edificio</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Nº de plantas <small>(Baja + X)</small></span><input id=\"plantas\" type=\"number\" value=\"\" min=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Altura de planta <small>(m)</small></span><input id=\"altura\" type=\"number\" value=\"\" step=\"0.1\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de suministros</span><input id=\"nsum\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de edificio</span><div class=\"derived\" id=\"tipoEdif\">TIPO C</div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales con suministro</span><input id=\"localesCon\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales sin suministro</span><input id=\"localesSin\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de locales</span><div class=\"derived\" id=\"locNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"locTipo\"></div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Viv. con mas de una entrada</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº de entradas de mas</span><input type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"></label>\n    </div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en planta baja</div>\n      <button class=\"add\" data-z=\"baja\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vbaja\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en resto de plantas</div>\n      <button class=\"add\" data-z=\"resto\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vresto\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en atico</div>\n      <button class=\"add\" data-z=\"atico\" title=\"Añadir vivienda\">+</button>\n    </div>\n    <div id=\"vatico\"></div>\n\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto1\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select id=\"comPunto2\"><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de comunidad</span><div class=\"derived\" id=\"comNum\"></div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\" id=\"comTipo\"></div></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 7. TUBO CONEXIÓN + ALIMENTACIÓN -->\n  <!-- CARACTERÍSTICAS DE LA INSTALACIÓN (A28:B51) -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de instalacion</div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Acometida</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Nº contador de agua</span><input value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Ubicacion del contador</span><select><option selected></option><option>FACHADA DELANTERA</option><option>FACHADA LATERAL</option><option>FACHADA TRASERA</option><option>ZONAS COMUNES</option><option>CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Situacion llave acerado</span><select><option selected></option><option>DELANTERA</option><option>LATERAL</option><option>TRASERA</option><option>DELANTERA-CAMBIAR</option><option>LATERAL-CAMBIAR</option><option>TRASERA-CAMBIAR</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº llaves de corte general <small>(ud)</small></span><input id=\"con_llaves\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de conexion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>PE</option><option>PLOMO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Diametro actual <small>(mm)</small></span><select><option selected></option><option>DESCONOCIDO</option><option>25</option><option>32</option><option>40</option><option>50</option><option>63</option><option>75</option><option>90</option><option>110</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longCon\"><option selected></option><option>NO EXISTE</option><option>VALIDO</option><option>1</option><option>2</option><option>3</option><option>4</option><option>7</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de alimentacion</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Montaje propuesto</span><select id=\"ali_montaje\"><option selected></option><option>ENTERRADO</option><option>B.FORJADO</option><option>CANALETA</option><option>F.VIGA</option><option>F.TECHO</option><option>SOLO PIECERIA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longAli\"><option selected></option><option>2,5</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Nº codos termofusion <small>(ud)</small></span><input id=\"ali_codos\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Montante de abastecimiento</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option selected></option><option>DESCONOCIDO</option><option>COBRE</option><option>HIERRO</option><option>PPR</option><option>PE</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Cuarto de contadores</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select><option selected></option><option>EN FACHADA DELANTERA</option><option>EN FACHADA LATERAL</option><option>EN FACHADA TRASERA</option><option>EN PORTAL</option><option>BAJO ESCALERA</option><option>EN PATIO INTERIOR</option><option>EN PATIO EXTERIOR</option><option>EN CUARTO DE MOTORES</option><option>EN CUARTO DE SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de armario</span><select id=\"cuarto_tipo\"><option selected></option><option value=\"EXISTENTE\">CUARTO EXISTENTE</option><option>ALUMINIO</option><option>OBRA - P.ALUMINIO</option><option>OBRA - P.HIERRO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 1</span><select class=\"bat\" id=\"cuarto_bat1\"></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bateria 2 (si hay)</span><select class=\"bat\" id=\"cuarto_bat2\"></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Grupo de presion</div>\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores actual</span><input id=\"gp_mot_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia actual <small>(KW)</small></span><input id=\"gp_pot_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin actual <small>(L)</small></span><input id=\"gp_cald_act\" type=\"text\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos actual</span><input id=\"gp_ndep_act\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos actual <small>(L)</small></span><input id=\"gp_tdep_act\" type=\"text\" value=\"\"></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Nº de motores nuevo</span><input id=\"gpInstala\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Potencia nueva <small>(KW)</small></span><select id=\"gp_pot_new\"><option selected></option><option>1,1</option><option>1,5</option><option>2,2</option><option>3</option><option>4</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tamano calderin nuevo <small>(L)</small></span><input id=\"gp_cald_new\" type=\"text\" value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Nº depositos nuevo</span><input id=\"gp_ndep_new\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Tamano depositos nuevo <small>(L)</small></span><select id=\"gp_tdep_new\"><option selected></option><option>500</option><option>750</option><option>1000</option><option>2000</option></select></label>\n    </div>\n\n    <div class=\"grid g5\">\n      <label class=\"f\"><span class=\"lab\">Ubicacion</span><select id=\"gp_ubic\"><option selected></option><option>NO NECESITA</option><option>CUARTO EXISTENTE</option><option>CUARTO NUEVO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tiempo montaje nuevo GP</span><input id=\"gp_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f\"><span class=\"lab\">Longitud tubo expulsion <small>(m)</small></span><input id=\"gp_longexp\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempos (cuadrilla X2)</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje de Peines (H)</span><input id=\"peines_h_dias\" type=\"number\" min=\"0\" value=\"\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t1\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje</span><input id=\"otros_t2\" type=\"number\" min=\"0\" value=\"\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros trabajos extra <small>(€)</small></span><input id=\"otros_eur\" type=\"text\" inputmode=\"decimal\" value=\"\" class=\"euro\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input></label>\n    </div>\n  </div>\n\n  <!-- 10. PEINES -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de peines</div>\n    <div id=\"avPeines\"></div>\n    <div id=\"peines\"></div>\n  </div>\n\n</div>\n\n<script>\nconst PLAST={20:25,25:32,30:40,40:50,50:63,60:75,80:90,100:110};\nconst ACOM=[[20,2,1,1,0,0],[25,6,4,3,2,1],[30,15,11,9,7,5],[40,60,40,33,22,17],[50,100,70,55,37,30],[60,180,120,90,60,50],[80,400,300,250,200,150]];\nconst ALIM=[[30,2,1,1,0,0],[40,5,3,2,2,1],[50,25,16,14,10,6],[60,75,50,45,40,30],[80,120,90,80,70,60],[100,200,150,130,110,90]];\nconst TI={\"TIPO A\":0,\"TIPO B\":1,\"TIPO C\":2,\"TIPO D\":3,\"TIPO E\":4};\nconst EQUIP_TIPO={\"Cocina + Lavadero + sanitario\":\"TIPO A\",\"Cocina + Lavadero + aseo\":\"TIPO B\",\"Cocina + Lavadero + baño\":\"TIPO C\",\"Cocina + Office + Lavadero + baño + aseo\":\"TIPO D\",\"Cocina + Office + Lavadero + 2 baño + aseo\":\"TIPO E\",\"Otros\":\"TIPO F\"};\nfunction diamBase(t,n,tipo){const i=TI[tipo];if(i===undefined)return null;for(const f of t){if(f[1+i]>0&&n<=f[1+i])return f[0];}return null;}\nfunction dAco(n,tipo,L){let d=diamBase(ACOM,n,tipo);if(d===null)return\"—\";if(L>15)d+=20;else if(L>6)d+=10;return(PLAST[d]||d)+\" mm\";}\nfunction dAli(n,tipo,L){let d=diamBase(ALIM,n,tipo);if(d===null)return\"—\";if(L>40)d+=20;else if(L>15)d+=10;return(PLAST[d]||d)+\" mm\";}\n\nfunction pp(t,h,n){const M={\"SIMPLE\":[1,0,0],\"SIMPLE+1\":[1,1,0],\"1-SIMPLE\":[1,0,h],\"1-SIMPLE+1\":[1,1,h],\"SIMPLE-1\":[1,0,h*(n+1)],\"SIMPLE-2\":[1,0,h*(2*n+1)],\"1-SIMPLE-1\":[1,0,h*(n+1)+h],\"1-SIMPLE-2\":[1,0,h*(2*n+1)+h],\"DOBLE\":[2,0,0],\"DOBLE+1\":[2,1,0],\"DOBLE+2\":[2,2,0],\"1-DOBLE\":[2,0,h],\"2-DOBLE\":[2,0,2*h],\"1-DOBLE+1\":[2,1,h],\"2-DOBLE+1\":[2,1,2*h],\"1-DOBLE+2\":[2,2,h],\"DOBLE-1\":[2,0,h],\"DOBLE-2\":[2,0,2*h],\"2-DOBLE+2\":[2,2,2*h]};return M[t]||[1,0,0];}\nconst TIPOS=[\"SIMPLE\",\"SIMPLE+1\",\"SIMPLE-1\",\"SIMPLE-2\",\"1-SIMPLE\",\"1-SIMPLE+1\",\"1-SIMPLE-1\",\"1-SIMPLE-2\",\"DOBLE\",\"DOBLE+1\",\"DOBLE+2\",\"DOBLE-1\",\"DOBLE-2\",\"1-DOBLE\",\"2-DOBLE\",\"1-DOBLE+1\",\"2-DOBLE+1\",\"1-DOBLE+2\",\"2-DOBLE+2\"];\nconst EQUIPS=Object.keys(EQUIP_TIPO);\nfunction pTubo(t,h,n){const[k,p,R]=pp(t,h,n);return k*h*(n+1)*(n+2)/2+p*h*(n+2)-R;}\nfunction pViv(t,n){const[k,p]=pp(t,1,n);return k*(n+1)+p;}\nfunction splitTipo(t){t=t||\"\";var pre=\"\";if(t.slice(0,2)===\"1-\"){pre=\"1-\";t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){pre=\"2-\";t=t.slice(2);}var suf=\"\";var l2=t.slice(-2);if([\"+1\",\"+2\",\"-1\",\"-2\"].indexOf(l2)>=0){suf=l2;t=t.slice(0,-2);}return{pre:pre,base:t,suf:suf};}\nconst TBASE=[\"\",\"SIMPLE\",\"DOBLE\"];function PREFS(b){return b===\"DOBLE\"?[\"\",\"1-\",\"2-\"]:b===\"SIMPLE\"?[\"\",\"1-\"]:[\"\"];}function SUFS(b){return b===\"DOBLE\"?[\"\",\"+1\",\"+2\",\"-1\",\"-2\"]:b===\"SIMPLE\"?[\"\",\"+1\",\"-1\",\"-2\"]:[\"\"];}\nconst optT=(arr,v)=>arr.map(o=>`<option value=\"${o}\" ${o===v?'selected':''}>${o||'—'}</option>`).join(\"\");\n\nconst $=id=>document.getElementById(id);\nconst zonas={ baja:[], resto:[], atico:[] };\nconst CONT={baja:\"vbaja\",resto:\"vresto\",atico:\"vatico\"};\nlet peines=[];\n\nfunction renderZona(z){\n  const arr=zonas[z],c=$(CONT[z]);c.innerHTML=\"\";\n  arr.forEach((v,i)=>{\n    const r=document.createElement(\"div\");r.className=\"vrow\";\n    const o=`<option ${!v.equip?'selected':''}></option>`+EQUIPS.map(e=>`<option ${e===v.equip?'selected':''}>${e}</option>`).join(\"\");\n    const pu=`<option ${!v.puerta?'selected':''}></option>`+[\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"DCHA\",\"IZDA\",\"CENTRO\"].map(x=>`<option ${x===v.puerta?'selected':''}>${x}</option>`).join(\"\");\n    r.innerHTML=`<label class=\"f\"><span class=\"lab\">Puerta</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"vp\">${pu}</select></label>\n      <label class=\"f\"><span class=\"lab\">Equipamiento</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"ve\">${o}</select></label>\n      <label class=\"f\"><span class=\"lab\">Nº de viviendas</span><div class=\"derived vn-disp\" data-z=\"${z}\" data-i=\"${i}\">${v.n||0}</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">${EQUIP_TIPO[v.equip]||''}</div></label>\n      <button class=\"del\" data-z=\"${z}\" data-i=\"${i}\">×</button>`;\n    c.appendChild(r);\n  });\n  c.querySelectorAll(\".vp\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].puerta=e.target.value;recalc();});\n  c.querySelectorAll(\".ve\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].equip=e.target.value;renderZona(e.target.dataset.z);recalc();});\n  c.querySelectorAll(\".del\").forEach(b=>b.onclick=e=>{zonas[e.target.dataset.z].splice(+e.target.dataset.i,1);renderZona(e.target.dataset.z);recalc();});\n}\nfunction renderVivs(){renderZona(\"baja\");renderZona(\"resto\");renderZona(\"atico\");}\nfunction todasViviendas(){return [...zonas.baja,...zonas.resto,...zonas.atico];}\nconst OPT_ENGANCHE=[\"EXT\",\"INT-FACIL\",\"INT-MEDIO\",\"INT-DIFICIL\"];\nconst OPT_PEINEV=[\"V-INT\",\"V-EXT\"];\nconst OPT_IE=[\"INTERIOR\",\"EXTERIOR\"];\nconst OPT_ENGCB=[\"ENGANCHA EN COCINAS\",\"ENGANCHA EN BAÑOS\"];\nconst OPT_PROT=[\"B.FORJADO\",\"CANALETA\",\"F.VIGA\",\"F.TECHO\",\"B.LADRILLO\"];\nconst OPT_SUBE=[\"SUBE POR FACHADA DELANTERA\",\"SUBE POR FACHADA LATERAL DERECHA\",\"SUBE POR FACHADA LATERAL IZQUIERDA\",\"SUBE POR FACHADA TRASERA\",\"SUBE POR PATIO DERECHO\",\"SUBE POR PATIO CENTRAL\",\"SUBE POR PATIO IZQUIERDO\",\"SUBE POR SCHUNT\"];\nconst OPT_BAJA=[\"NO BAJA\",\"BAJA POR FACHADA DELANTERA\",\"BAJA POR FACHADA LATERAL DERECHA\",\"BAJA POR FACHADA LATERAL IZQUIERDA\",\"BAJA POR FACHADA TRASERA\",\"BAJA POR PATIO DERECHO\",\"BAJA POR PATIO CENTRAL\",\"BAJA POR PATIO IZQUIERDO\",\"BAJA POR SCHUNT\"];\nconst sel=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join(\"\");\nconst selB=(arr,v)=>`<option ${!v?'selected':''}></option>`+sel(arr,v);\nconst subH=t=>`<div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:8px 0 4px;\">${t}</div>`;\n\nfunction tramosHTML(i,m,arr){\n  const cols=(arr||[]).map((tr,t)=>`\n    <div style=\"display:flex;flex-direction:column;gap:4px;\">\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <label class=\"f\" style=\"flex:1;\"><span class=\"lab\">Longitud <small>(m)</small></span><input data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"long\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"${tr.long||''}\"></label>\n        <button class=\"del tdel\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">×</button>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <select data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"prot\" style=\"flex:1;\"><option ${!tr.prot?'selected':''}></option>${sel(OPT_PROT,tr.prot)}</select>\n        <button class=\"tadd addtramo\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">+</button>\n      </div>\n    </div>`).join(\"\");\n  return `<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end;\">${cols}</div>`;\n}\nfunction renderPeines(){\n  const c=$(\"peines\");c.innerHTML=\"\";\n  if(!peines.length){\n    const ab=document.createElement(\"button\");ab.className=\"add\";ab.title=\"Añadir peine\";ab.textContent=\"+\";\n    ab.onclick=()=>{peines.push(nuevoPeine());renderPeines();};\n    c.appendChild(ab);return;\n  }\n  peines.forEach((pe,i)=>{\n    const b=document.createElement(\"div\");\n    b.style.cssText=\"border:1px solid var(--g200);border-radius:8px;padding:8px 10px;margin-bottom:8px;position:relative;\";\n    b.innerHTML=`\n      <div style=\"position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;\">\n        <button class=\"add padd\" data-i=\"${i}\" title=\"Añadir peine\">+</button>\n        <button class=\"del pdel\" data-i=\"${i}\">×</button>\n      </div>\n      <div style=\"font-weight:700;color:var(--titulo);font-size:13px;margin-bottom:6px;\">PEINE ${i+1}</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:16px;\">\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante actual</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Interior / Exterior</span><select data-i=\"${i}\" data-k=\"maIE\">${selB(OPT_IE,pe.maIE)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"maEng\">${selB(OPT_ENGCB,pe.maEng)}</select></label>\n          </div>\n        </div>\n        <div>\n          <div style=\"font-size:10px;color:var(--titulo);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante nuevo</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Recorrido (sube)</span><select data-i=\"${i}\" data-k=\"mnSube\">${selB(OPT_SUBE,pe.mnSube)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Recorrido (baja)</span><select data-i=\"${i}\" data-k=\"mnBaja\">${selB(OPT_BAJA,pe.mnBaja)}</select></label>\n          </div>\n        </div>\n      </div>\n      <div class=\"grid g5\" style=\"margin-top:8px;\">\n        <label class=\"f\"><span class=\"lab\">Puerta(s)</span><input data-i=\"${i}\" data-k=\"puerta\" value=\"${pe.puerta||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Tipo de peine</span><div style=\"display:flex;gap:4px;\"><select class=\"ptipo\" data-i=\"${i}\" data-part=\"pre\" style=\"width:42px;\">${optT(PREFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).pre)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"base\" style=\"flex:1;\">${optT(TBASE,splitTipo(pe.tipo).base)}</select><select class=\"ptipo\" data-i=\"${i}\" data-part=\"suf\" style=\"width:42px;\">${optT(SUFS(splitTipo(pe.tipo).base),splitTipo(pe.tipo).suf)}</select></div></label>\n        <label class=\"f\"><span class=\"lab\">Nº giros extra</span><input data-i=\"${i}\" data-k=\"giros\" type=\"number\" min=\"0\" value=\"${pe.giros||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"enganche\">${selB(OPT_ENGANCHE,pe.enganche)}</select></label>\n        <label class=\"f\"><span class=\"lab\">Peine (V)</span><select data-i=\"${i}\" data-k=\"peineV\">${selB(OPT_PEINEV,pe.peineV)}</select></label>\n      </div>\n      <div style=\"margin-top:8px;\">${tramosHTML(i,'tramos',pe.tramos)}</div>`;\n    c.appendChild(b);\n  });\n  c.querySelectorAll(\"[data-k]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{peines[+e.target.dataset.i][e.target.dataset.k]=e.target.value;});\n  });\n  c.querySelectorAll(\"[data-f]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{const d=e.target.dataset; peines[+d.i][d.m][+d.t][d.f]=e.target.value;});\n  });\n  c.querySelectorAll(\".ptipo\").forEach(el=>el.addEventListener(\"change\",e=>{var i=+e.target.dataset.i;var pre=\"\",base=\"\",suf=\"\";c.querySelectorAll(\".ptipo\").forEach(p=>{if(+p.dataset.i!==i)return;if(p.dataset.part===\"pre\")pre=p.value;else if(p.dataset.part===\"base\")base=p.value;else suf=p.value;});if(PREFS(base).indexOf(pre)<0)pre=\"\";if(SUFS(base).indexOf(suf)<0)suf=\"\";peines[i].tipo=(pre||\"\")+(base||\"\")+(suf||\"\");renderPeines();}));\n  c.querySelectorAll(\".addtramo\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t+1,0,{long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".tdel\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t,1); if(!peines[+d.i][d.m].length)peines[+d.i][d.m].push({long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".pdel\").forEach(b=>b.onclick=e=>{peines.splice(+e.currentTarget.dataset.i,1);renderPeines();});\n  c.querySelectorAll(\".padd\").forEach(b=>b.onclick=()=>{peines.push(nuevoPeine());renderPeines();});avisoViviendas();\n}\nfunction tipoEdificio(){\n  const orden=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"];let best=\"TIPO A\";\n  todasViviendas().forEach(v=>{const t=EQUIP_TIPO[v.equip];if(t&&orden.indexOf(t)>orden.indexOf(best))best=t;});\n  return best;\n}\nfunction recalc(){\n  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};\n  const n=+$(\"plantas\").value||0,h=+$(\"altura\").value||0;\n  const nViv=todasViviendas().length;\n  let nSum=0; [\"baja\",\"resto\",\"atico\"].forEach(function(z){ zonas[z].forEach(function(v,i){ var c=(v.puerta||v.equip)?((z===\"resto\")?n:1):0; v.n=c; nSum+=c; var d=document.querySelector(\".vn-disp[data-z=\\\"\"+z+\"\\\"][data-i=\\\"\"+i+\"\\\"]\"); if(d) d.textContent=c; }); });\n  var lsin=+($(\"localesSin\")||{}).value||0; nSum+=lsin;\n  var _ln=$(\"locNum\"); if(_ln) _ln.textContent=lsin||\"\"; var _lt=$(\"locTipo\"); if(_lt) _lt.textContent=lsin>0?\"TIPO B\":\"\";\n  var c1=(($(\"comPunto1\")||{}).value||\"\"), c2=(($(\"comPunto2\")||{}).value||\"\");\n  var comN=(c1?1:0)+(c2?1:0);\n  var _cn=$(\"comNum\"); if(_cn) _cn.textContent=comN>0?1:0;\n  var _ct=$(\"comTipo\"); if(_ct) _ct.textContent=comN>0?\"TIPO A\":\"\";\n  if(comN>0) nSum+=1;\n  $(\"nsum\").value = (nViv||lsin||comN) ? nSum : \"\";\n  var tipo = nViv ? tipoEdificio() : \"\";\n  if(lsin>0){ var _ord=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"]; if(!tipo || _ord.indexOf(\"TIPO B\")>_ord.indexOf(tipo)) tipo=\"TIPO B\"; }\n  set(\"tipoEdif\",tipo);\n  var _gpi=$(\"gpInstala\"); var _cn=$(\"gp_cald_new\"); if(_cn){ _cn.value=(_gpi&&_gpi.value===\"2\")?\"8\":\"\"; }\n  const numAli=parseFloat(String(($(\"longAli\")||{}).value||\"\").replace(\",\",\".\"))||0;\n  const a=dAco(nSum,tipo,+$(\"longCon\").value||0),al=dAli(nSum,tipo,numAli);\n  set(\"dAco\",a);set(\"dAli\",al);\n  const sub=nSum*160+($(\"gpInstala\").checked?52:0);\n  set(\"rSub\",sub.toLocaleString(\"es-ES\")+\" €\");set(\"dSub\",sub.toLocaleString(\"es-ES\")+\" €\");avisoViviendas();\n}\ndocument.querySelectorAll(\"button.add[data-z]\").forEach(b=>b.onclick=()=>{const z=b.dataset.z;zonas[z].push({puerta:\"\",equip:\"\",n:\"\"});renderZona(z);recalc();});\nfunction nuevoPeine(){return {puerta:\"\",tipo:\"\",giros:\"\",enganche:\"\",peineV:\"\",maIE:\"\",maEng:\"\",mnSube:\"\",mnBaja:\"\",tramos:[{long:\"\",prot:\"\"}]};}\n[\"plantas\",\"altura\",\"longCon\",\"longAli\",\"gpInstala\",\"localesSin\",\"localesCon\",\"comPunto1\",\"comPunto2\"].forEach(id=>{const el=$(id);if(el){el.addEventListener(\"input\",recalc);el.addEventListener(\"change\",recalc);}});\nconst BATERIAS=\"4T-2F,6T-2F,6T-3F,9T-3F,10T-2F,12T-2F,12T-3F,14T-2F,15T-3F,16T-2F,18T-2F,18T-3F,20T-2F,21T-3F,22T-2F,24T-2F,24T-3F,26T-2F,27T-3F,28T-2F,30T-2F,30T-3F,33T-3F,36T-3F,39T-3F,42T-3F,45T-3F\".split(\",\");\ndocument.querySelectorAll(\"select.bat\").forEach((s)=>{s.innerHTML='<option selected></option>'+BATERIAS.map(b=>`<option>${b}</option>`).join(\"\");});\nfunction vivPeine(t,n){t=String(t||\"\").trim();if(!t)return 0;var a=0;if(t.slice(0,2)===\"1-\"){a=1;t=t.slice(2);}else if(t.slice(0,2)===\"2-\"){a=2;t=t.slice(2);}var b=0,c=0,s=t.slice(-2);if(s===\"+1\"){c=1;t=t.slice(0,-2);}else if(s===\"+2\"){c=2;t=t.slice(0,-2);}else if(s===\"-1\"){b=1;t=t.slice(0,-2);}else if(s===\"-2\"){b=2;t=t.slice(0,-2);}var k=t===\"DOBLE\"?2:(t===\"SIMPLE\"?1:0);if(!k)return 0;var v=k*(n+1)-a-b+c;return v<0?0:v;}function avisoViviendas(){var n=+($(\"plantas\")||{}).value||0;var sumP=0,hay=false;for(var i=0;i<peines.length;i++){if(peines[i].tipo)hay=true;sumP+=vivPeine(peines[i].tipo,n);}var lsin=+($(\"localesSin\")||{}).value||0;var c1=(($(\"comPunto1\")||{}).value||\"\"),c2=(($(\"comPunto2\")||{}).value||\"\");var com=((c1?1:0)+(c2?1:0))>0?1:0;var nsum=+($(\"nsum\")||{}).value||0;var esperado=sumP+lsin+com;var desc=hay&&nsum>0&&esperado!==nsum;var el=$(\"nsum\");if(el){if(desc)el.classList.add(\"p5mismatch\");else el.classList.remove(\"p5mismatch\");}var box=$(\"avPeines\");if(box){box.innerHTML=desc?(\x27<div class=\"avbox\">Las viviendas de los peines (\x27+sumP+\x27) mas locales y comunidad (\x27+(lsin+com)+\x27) suman \x27+esperado+\x27, que no coincide con el N\xba de suministros (\x27+nsum+\x27). Revisa los peines o la distribuci\xf3n de viviendas.</div>\x27):\"\";}}renderVivs();renderPeines();recalc();(function(){var mo=$(\"ali_montaje\"),lo=$(\"longAli\"),co=$(\"ali_codos\");function pz(){var p=mo&&mo.value===\"SOLO PIECERIA\";if(lo){lo.disabled=p;if(p)lo.value=\"\";}if(co){co.disabled=p;if(p)co.value=\"\";}recalc();}if(mo)mo.addEventListener(\"change\",pz);pz();})();\n\n// ---- Guardar / precargar contra el Sheet (vía el módulo) ----\nfunction camposEstaticos(){\n  const dyn=[\"vbaja\",\"vresto\",\"vatico\",\"peines\"].map(id=>$(id)).filter(Boolean);\n  const dentro=el=>dyn.some(d=>d.contains(el));\n  return [...document.querySelectorAll(\".page input, .page select\")].filter(el=>!dentro(el));\n}\nfunction camposEditables(){ return camposEstaticos().filter(function(el){ return !el.readOnly && el.type!==\"hidden\"; }); }\nfunction serializar(){\n  var _ns=parseInt(($(\"nsum\")||{}).value,10)||0; var _tp=(($(\"tipoEdif\")||{}).textContent||\"\").trim(); var _lc=parseFloat(String((($(\"longCon\")||{}).value||\"\")).replace(\",\",\".\"))||0; var gv=function(id){var e=$(id);return e?e.value:\"\";}; var pf=function(id){return parseFloat(String(gv(id)).replace(\",\",\".\"))||0;}; var pe=function(id){return parseFloat(String(gv(id)).replace(/\\./g,\"\").replace(\",\",\".\"))||0;}; return { v: camposEditables().map(el=>el.value), zonas, peines, motor:{ nsum:_ns, tipo:_tp, longCon:_lc, longAli: pf(\"longAli\"), montaje: gv(\"ali_montaje\"), codos: pf(\"ali_codos\"), llaves: pf(\"con_llaves\"), bat1: gv(\"cuarto_bat1\"), bat2: gv(\"cuarto_bat2\"), tipoCuarto: gv(\"cuarto_tipo\"), otrosTiempos: (pf(\"otros_t1\")+pf(\"otros_t2\")), otrosEur: pe(\"otros_eur\"), gpMotAct: gv(\"gp_mot_act\"), gpPotAct: gv(\"gp_pot_act\"), gpCaldAct: gv(\"gp_cald_act\"), gpNdepAct: gv(\"gp_ndep_act\"), gpTdepAct: gv(\"gp_tdep_act\"), gpInstala: gv(\"gpInstala\"), gpPotNew: gv(\"gp_pot_new\"), gpCaldNew: gv(\"gp_cald_new\"), gpNdepNew: pf(\"gp_ndep_new\"), gpTdepNew: gv(\"gp_tdep_new\"), gpUbic: gv(\"gp_ubic\"), gpDias: pf(\"gp_dias\"), gpLongExp: pf(\"gp_longexp\"), plantas: (parseInt(gv(\"plantas\"),10)||0), altura: pf(\"altura\"), peinesHDias: pf(\"peines_h_dias\"), puntosComunidad: ((($(\"comPunto1\")||{}).value?1:0)+(($(\"comPunto2\")||{}).value?1:0)) } };\n}\nfunction hidratar(d){\n  if(!d) return;\n  if(d.zonas){ zonas.baja=d.zonas.baja||[]; zonas.resto=d.zonas.resto||[]; zonas.atico=d.zonas.atico||[]; }\n  if(Array.isArray(d.peines)&&d.peines.length){ peines.length=0; d.peines.forEach(p=>peines.push(p)); }\n  renderVivs(); renderPeines();\n  if(Array.isArray(d.v)){ camposEditables().forEach((el,i)=>{ if(i<d.v.length) el.value=d.v[i]; }); }\n  recalc();\n}\nconst PLAN5_TOKEN = new URLSearchParams(location.search).get(\"token\")||\"\";\n// Guarda TODO el formulario en el Sheet (1 fila por direccion). Devuelve true/false.\nasync function plan5GuardarTodo(){\n  try{\n    const body=new URLSearchParams();\n    var _tv=($(\"f_tipovia\")||{}).value||\"\"; var _dc=($(\"f_direccion\")||{}).value||\"\";\n    body.set(\"direccion\", ((_tv?_tv+\" \":\"\")+_dc).trim());\n    body.set(\"ccpp_id\", window.__PLAN5_VOLVER_ID__||\"\");\n    body.set(\"npresupuesto\", ($(\"f_npresupuesto\")||{}).value||\"\");\n    body.set(\"fecha\", ($(\"f_fecha\")||{}).value||\"\");\n    body.set(\"revision\", ($(\"f_revision\")||{}).value||\"\");\n    body.set(\"payload\", JSON.stringify(serializar()));\n    const r=await fetch(\"/plan5/guardar?token=\"+encodeURIComponent(PLAN5_TOKEN),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n    const j=await r.json().catch(()=>({ok:false}));\n    return !!(j&&j.ok);\n  }catch(e){ return false; }\n}\n// Recuadro verde 5s al guardar OK; rojo permanente al fallo (clases de estilo-visual).\nfunction plan5Flash(el, ok){\n  if(!el) return;\n  if(el._p5t){ clearTimeout(el._p5t); el._p5t=null; }\n  el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n  if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._p5t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._p5t=null; },5000); }\n  else { el.classList.add(\"ptl-guardado-error\"); }\n}\nvar p5hist=[], p5pos=-1; function p5enDinamico(el){ return ['vbaja','vresto','vatico','peines'].some(function(id){ var d=$(id); return d && d.contains(el); }); } function setP5UndoRedo(){ var u=$('undoBtn'), r=$('redoBtn'); if(u)u.disabled=(p5pos<0); if(r)r.disabled=(p5pos>=p5hist.length-1); } async function p5undo(){ if(p5pos<0)return; var e=p5hist[p5pos]; p5pos--; setP5UndoRedo(); if(e.el){ e.el.value=e.prev; e.el.dataset.orig=e.prev; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } async function p5redo(){ if(p5pos>=p5hist.length-1)return; p5pos++; var e=p5hist[p5pos]; setP5UndoRedo(); if(e.el){ e.el.value=e.next; e.el.dataset.orig=e.next; } var ok=await plan5GuardarTodo(); plan5Flash(e.el, ok); } (function(){ var _ub=$('undoBtn'); if(_ub)_ub.onclick=p5undo; var _rb=$('redoBtn'); if(_rb)_rb.onclick=p5redo; setP5UndoRedo(); })(); \n  async function plan5OnCambio(el){\n  if(!el || el.readOnly) return;\n  const oldV = el.dataset.orig===undefined ? \"\" : el.dataset.orig;\n  if(el.value===oldV) return;\n  if(!p5enDinamico(el)){ p5hist=p5hist.slice(0,p5pos+1); p5hist.push({el:el, prev:oldV, next:el.value}); p5pos=p5hist.length-1; setP5UndoRedo(); }\n  el.dataset.orig = el.value;\n  const ok = await plan5GuardarTodo();\n  plan5Flash(el, ok); actualizarCuadro();\n}\nconst PAGE = document.querySelector(\".page\");\n// Fija el valor base al entrar en el campo (vale para campos dinámicos también)\nPAGE.addEventListener(\"focusin\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,select,textarea\") && el.dataset.orig===undefined) el.dataset.orig=el.value; });\n// Guardar al salir del campo (inputs) o al cambiar (selects)\nPAGE.addEventListener(\"focusout\", function(e){ const el=e.target; if(el.matches && el.matches(\"input,textarea\")) plan5OnCambio(el); });\nPAGE.addEventListener(\"change\", function(e){ const el=e.target; if(el.matches && el.matches(\"select\")) plan5OnCambio(el); });\n// Cambios estructurales (añadir/borrar viviendas, peines, tramos): guardar también\nPAGE.addEventListener(\"click\", function(e){ const b=e.target.closest && e.target.closest(\"button.add,button.tadd,button.del,button.padd,button.pdel,button.addtramo,button.tdel\"); if(b) setTimeout(function(){plan5GuardarTodo().then(function(){actualizarCuadro();});},0); });\nif(window.__PLAN5_DIR__){ var _fd=$(\"f_direccion\"); if(_fd) _fd.value=window.__PLAN5_DIR__; }\nfunction _fmtTlf(v){ var d=String(v||\"\").replace(/\\D/g,\"\"); return d.length===9 ? d.slice(0,3)+\"-\"+d.slice(3,6)+\"-\"+d.slice(6) : (v||\"\"); }\nif(window.__PLAN5_EXP__){ var _e=window.__PLAN5_EXP__; var _sv=function(id,v){var el=$(id); if(el&&v!=null&&v!==\"\") el.value=v;};\n  _sv(\"f_tipovia\",_e.tipo_via); _sv(\"f_direccion\",_e.direccion_calle); _sv(\"f_poblacion\",_e.poblacion); _sv(\"f_cp\",_e.cp);\n  _sv(\"f_admin\",_e.administrador); _sv(\"f_admintel\",_fmtTlf(_e.tel_administrador)); _sv(\"f_adminemail\",_e.email_administrador);\n  _sv(\"f_presidente\",_e.presidente); _sv(\"f_prestel\",_fmtTlf(_e.tel_presidente)); _sv(\"f_presemail\",_e.email_presidente);\n}\nasync function actualizarCuadro(){try{var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';var dir=((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';var r=await fetch('/plan5/desglose?format=json&dir='+encodeURIComponent(dir)+(PLAN5_TOKEN?'&token='+encodeURIComponent(PLAN5_TOKEN):''));var j=await r.json().catch(function(){return null;});var c=j&&j.cuadro;if(!c)return;var setT=function(id,v){var e=$(id);if(e)e.textContent=v;};var eur=function(n){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' \u20ac';};var pct=function(n){return (n==null||isNaN(n))?'':(Number(n)*100).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};var num=function(n,d){return (n==null||isNaN(n))?'':Number(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:(d==null?3:d)});};setT('de_tEjec',num(c.tEjec));setT('de_cMat',eur(c.cMat));setT('de_cMo',eur(c.cMo));setT('de_cAlb',eur(c.cAlb));setT('de_cGp',eur(c.cGp));setT('de_cTot',eur(c.cTot));setT('de_bMat',pct(c.bMat));setT('de_bMo',pct(c.bMo));setT('de_c39',num(c.c39,4));setT('de_c41',pct(c.c41));setT('de_btTrad',eur(c.btTrad));setT('de_totTrad',eur(c.totTrad));setT('de_totTradIva',eur(c.totTradIva));setT('de_hTrad',eur(c.hTrad));setT('de_bP5',eur(c.bP5));setT('de_totP5',eur(c.totP5));setT('de_totP5Iva',eur(c.totP5Iva));setT('de_hP5',eur(c.hP5));setT('de_fin6',eur(c.fin6));setT('de_fin12',eur(c.fin12));setT('de_fin18',eur(c.fin18));setT('de_subv',eur(c.subv));setT('de_totSubv',eur(c.totSubv));setT('de_comunero',eur(c.comunero));}catch(e){}}if(window.__PLAN5_SAVED__) hidratar(window.__PLAN5_SAVED__);actualizarCuadro();\ndocument.querySelectorAll('input[type=\"number\"]').forEach(inp=>{\n  inp.addEventListener(\"input\",()=>{ if(inp.value===\"0\") inp.value=\"\"; });\n});\ndocument.querySelectorAll(\"input.euro\").forEach(inp=>{\n  inp.addEventListener(\"blur\",()=>{\n    let n=parseFloat(inp.value.replace(/\\./g,\"\").replace(\",\",\".\"));\n    inp.value = isNaN(n) ? \"\" : n.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2});\n  });\n  inp.addEventListener(\"focus\",()=>{ inp.value=inp.value.replace(/\\./g,\"\").replace(\",\",\".\"); });\n});\nfunction fmtLong(inp){ let n=parseFloat(String(inp.value).replace(\",\",\".\")); inp.value = isNaN(n) ? \"\" : n.toFixed(1).replace(\".\",\",\"); inp.dispatchEvent(new Event(\"input\",{bubbles:true})); }\ndocument.addEventListener(\"blur\",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains(\"long\")) fmtLong(e.target); }, true);\n// Desplegable propio de Revision (flecha que funciona en Firefox; deja escribir)\n(function(){\n  var inp=$(\"f_revision\"), arr=$(\"f_revision_arrow\"), lst=$(\"f_revision_list\");\n  if(!inp||!arr||!lst) return;\n  arr.addEventListener(\"click\", function(e){ e.preventDefault(); e.stopPropagation(); lst.hidden=!lst.hidden; });\n  lst.querySelectorAll(\".combo-opt\").forEach(function(o){\n    o.addEventListener(\"click\", function(){ inp.value=o.textContent; lst.hidden=true; inp.dataset.orig=inp.value; plan5GuardarTodo().then(function(ok){ plan5Flash(inp, ok); }); });\n  });\n  document.addEventListener(\"click\", function(e){ if(e.target!==arr && !lst.contains(e.target)) lst.hidden=true; });\n})();\n(function(){var ESTADO=(window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.estado)||'abierto',CIERRE=(window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.cierre)||null;var TK=(typeof PLAN5_TOKEN!=='undefined'?PLAN5_TOKEN:''),DR=window.__PLAN5_DIR__||'';var bar=document.querySelector('.p5bar');var rel=bar?bar.querySelector('.hdr-reload'):null;var btn=document.createElement('button');btn.type='button';btn.className='menu-btn';btn.id='cerrarBtn';if(bar){if(rel)bar.insertBefore(btn,rel);else bar.appendChild(btn);}function pintaBtn(){if(ESTADO==='cerrado'){btn.textContent='\uD83D\uDD12';btn.title='Presupuesto cerrado - pulsa para abrir';btn.style.color='#b45309';}else{btn.textContent='\uD83D\uDD13';btn.title='Cerrar presupuesto (congelar)';btn.style.color='';}}async function postAbrir(modo){btn.disabled=true;try{var body=new URLSearchParams();body.set('dir',DR);body.set('modo',modo);var r=await fetch('/plan5/abrir'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo abrir'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}function dialogoAbrir(){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';var bx=document.createElement('div');bx.style.cssText='background:#fff;color:#111;max-width:440px;width:90%;border-radius:10px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);';var t=document.createElement('div');t.textContent='Abrir presupuesto';t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px;';bx.appendChild(t);var sub=document.createElement('div');sub.textContent='Elige como abrirlo:';sub.style.cssText='color:#555;font-size:13px;margin-bottom:12px;';bx.appendChild(sub);function opt(tit,desc,modo){var b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;cursor:pointer;';var h=document.createElement('div');h.textContent=tit;h.style.cssText='font-weight:700;color:#111;font-size:13px;';b.appendChild(h);var dd=document.createElement('div');dd.textContent=desc;dd.style.cssText='color:#666;font-size:12px;margin-top:2px;';b.appendChild(dd);b.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);postAbrir(modo);};bx.appendChild(b);}opt('Actualizar formulas y precios','Recalcula todo con los datos y precios actuales.','full');opt('Actualizar solo precios','Mantiene las cantidades de la foto y refresca los precios.','precios');opt('Editar a mano','Deja la foto tal cual y la desbloquea.','manual');var cc=document.createElement('button');cc.type='button';cc.textContent='Cancelar';cc.style.cssText='display:block;width:100%;border:none;background:none;color:#666;padding:6px;cursor:pointer;font-size:13px;';cc.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);};bx.appendChild(cc);ov.appendChild(bx);ov.onclick=function(e){if(e.target===ov&&ov.parentNode)document.body.removeChild(ov);};document.body.appendChild(ov);}async function cerrarFlow(){if(!confirm('Cerrar el presupuesto? Se congelara una foto (desglose y cuadro economico) y quedara bloqueado para editar.'))return;btn.disabled=true;try{var url='/plan5/desglose?format=json'+(DR?'&dir='+encodeURIComponent(DR):'')+(TK?'&token='+encodeURIComponent(TK):'');var rf=await fetch(url);var jf=await rf.json().catch(function(){return null;});if(!jf||!jf.dsg){alert('No hay desglose que cerrar todavia. Rellena la toma de datos.');btn.disabled=false;return;}var body=new URLSearchParams();body.set('dir',DR);body.set('snapshot',JSON.stringify({dsg:jf.dsg,cuadro:jf.cuadro||null}));var r=await fetch('/plan5/cerrar'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo cerrar'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}btn.addEventListener('click',function(){if(ESTADO==='cerrado'){dialogoAbrir();return;}cerrarFlow();});pintaBtn();})();(function(){var est=(window.__PLAN5_SAVED__&&window.__PLAN5_SAVED__.estado)||'abierto';if(est!=='cerrado')return;var pg=document.querySelector('.page');if(pg){var d=document.createElement('div');d.className='avbox';d.style.cssText='margin:8px 0;';var f='';try{var ci=window.__PLAN5_SAVED__.cierre;if(ci&&ci.fecha){var dt=new Date(ci.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+'. Edicion bloqueada. Pulsa el candado para abrirlo.';var bar=pg.querySelector('.p5bar');if(bar&&bar.nextSibling)pg.insertBefore(d,bar.nextSibling);else pg.insertBefore(d,pg.firstChild);}document.querySelectorAll('.page input, .page select, .page textarea, .page button.add, .page button.del, .page button.padd, .page button.pdel, .page button.tadd, .page button.addtramo, .page button.tdel, .page button.combo-arrow').forEach(function(el){if(el.id==='undoBtn'||el.id==='redoBtn'||el.id==='menuBtn'||el.id==='cerrarBtn')return;el.disabled=true;el.style.pointerEvents='none';});})();(function(){var SV=window.__PLAN5_SAVED__||null;var ESTADO=(SV&&SV.estado)||'abierto';var bar=document.querySelector('.p5bar');var rel=bar?bar.querySelector('.hdr-reload'):null;var btn=document.createElement('button');btn.type='button';btn.className='menu-btn';btn.id='cerrarBtn';if(bar){if(rel)bar.insertBefore(btn,rel);else bar.appendChild(btn);}var TK=PLAN5_TOKEN||'';function DIRv(){var _tv=($('f_tipovia')||{}).value||'';var _dc=($('f_direccion')||{}).value||'';return((_tv?_tv+' ':'')+_dc).trim()||window.__PLAN5_DIR__||'';}function pintaBtn(){if(ESTADO==='cerrado'){btn.textContent='\uD83D\uDD12';btn.title='Presupuesto cerrado - pulsa para abrir';btn.style.color='#b45309';}else{btn.textContent='\uD83D\uDD13';btn.title='Cerrar presupuesto (congelar)';btn.style.color='';}}async function postAbrir(modo){btn.disabled=true;try{var body=new URLSearchParams();body.set('dir',DIRv());body.set('modo',modo);var r=await fetch('/plan5/abrir'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo abrir'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}function dialogoAbrir(){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';var bx=document.createElement('div');bx.style.cssText='background:#fff;color:#111;max-width:440px;width:90%;border-radius:10px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);';var t=document.createElement('div');t.textContent='Abrir presupuesto';t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px;';bx.appendChild(t);var sub=document.createElement('div');sub.textContent='Elige como abrirlo:';sub.style.cssText='color:#555;font-size:13px;margin-bottom:12px;';bx.appendChild(sub);function opt(tit,desc,modo){var b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;cursor:pointer;';var h=document.createElement('div');h.textContent=tit;h.style.cssText='font-weight:700;color:#111;font-size:13px;';b.appendChild(h);var dd=document.createElement('div');dd.textContent=desc;dd.style.cssText='color:#666;font-size:12px;margin-top:2px;';b.appendChild(dd);b.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);postAbrir(modo);};bx.appendChild(b);}opt('Actualizar formulas y precios','Recalcula todo con los datos y precios actuales.','full');opt('Actualizar solo precios','Mantiene las cantidades de la foto y refresca los precios.','precios');opt('Editar a mano','Deja la foto tal cual y la desbloquea.','manual');var cc=document.createElement('button');cc.type='button';cc.textContent='Cancelar';cc.style.cssText='display:block;width:100%;border:none;background:none;color:#666;padding:6px;cursor:pointer;font-size:13px;';cc.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);};bx.appendChild(cc);ov.appendChild(bx);ov.onclick=function(e){if(e.target===ov&&ov.parentNode)document.body.removeChild(ov);};document.body.appendChild(ov);}async function cerrarFlow(){if(!confirm('Cerrar el presupuesto? Se congelara una foto (desglose y cuadro economico) y quedara bloqueado para editar.'))return;btn.disabled=true;try{var dir=DIRv();var url='/plan5/desglose?format=json'+(dir?'&dir='+encodeURIComponent(dir):'')+(TK?'&token='+encodeURIComponent(TK):'');var rf=await fetch(url);var jf=await rf.json().catch(function(){return null;});if(!jf||!jf.dsg){alert('No hay desglose que cerrar todavia. Rellena la toma de datos.');btn.disabled=false;return;}var body=new URLSearchParams();body.set('dir',dir);body.set('snapshot',JSON.stringify({dsg:jf.dsg,cuadro:jf.cuadro||null}));var r=await fetch('/plan5/cerrar'+(TK?'?token='+encodeURIComponent(TK):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo cerrar'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}btn.addEventListener('click',function(){if(ESTADO==='cerrado'){dialogoAbrir();return;}cerrarFlow();});pintaBtn();})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

// Pantalla de la tabla de PRECIOS (editable, fuente del motor). Incrustada igual.
const PRECIOS_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 \u00b7 PRECIOS</title>\n<style>\n  .page{max-width:900px}\n  .card{padding:6px}\n</style>\n</head>\n<body>\n<script>window.__PRECIOS__=null;window.__PLAN5_VOLVER__=\"\";window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"precios\";/*__PRECIOS_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <input id=\"q\" type=\"text\" placeholder=\"Buscar concepto, detalle o ud...\" autocomplete=\"off\">\n    <button id=\"addBtn\" class=\"addp\" type=\"button\" title=\"Anadir precio\">+</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div class=\"card\">\n    <table>\n      <thead><tr><th class=\"ud\">Ud</th><th>Concepto</th><th class=\"tp\">Detalle</th><th class=\"pr\">Precio (\u20ac)</th><th class=\"dc\"></th></tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DATA=(window.__PRECIOS__||[]).slice();\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  // Sin acentos para buscar\n  function sa(s){ return (s||\"\").toString().normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g,\"\").toLowerCase(); }\n  // Orden alfabetico por concepto y luego tipo\n  DATA.sort(function(a,b){\n    var c=sa(a.concepto).localeCompare(sa(b.concepto));\n    return c!==0 ? c : sa(a.tipo).localeCompare(sa(b.tipo));\n  });\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function render(filtro){\n    var f=sa(filtro);\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    var vis=0;\n    DATA.forEach(function(p){\n      if(f && sa(p.concepto+\" \"+p.tipo+\" \"+p.ud).indexOf(f)===-1) return;\n      vis++;\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML=\n        '<td class=\"ud\"><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"ud\" value=\"'+esc(p.ud)+'\" data-orig=\"'+esc(p.ud)+'\"></td>'+\n        '<td><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"concepto\" value=\"'+esc(p.concepto)+'\" data-orig=\"'+esc(p.concepto)+'\"></td>'+\n        '<td class=\"tp\"><input class=\"cell\" data-row=\"'+p.r+'\" data-col=\"tipo\" value=\"'+esc(detFmt(p.tipo))+'\" data-orig=\"'+esc(detFmt(p.tipo))+'\"></td>'+\n        '<td class=\"pr\"><input class=\"pr\" type=\"text\" inputmode=\"decimal\" data-row=\"'+p.r+'\" data-col=\"precio\" value=\"'+esc(p.precio)+'\" data-orig=\"'+esc(p.precio)+'\"></td>'+\n        '<td class=\"dc\"><button class=\"delp\" type=\"button\" data-row=\"'+p.r+'\" title=\"Borrar\">&#215;</button></td>';\n      tb.appendChild(tr);\n    });\n    if(vis===0){ var tr=document.createElement(\"tr\"); tr.innerHTML='<td class=\"empty\" colspan=\"5\">Sin resultados</td>'; tb.appendChild(tr); }\n  }\n  render(\"\");\n  $(\"q\").addEventListener(\"input\", function(){ render(this.value); });\n\n  // Formato 2 decimales con coma\n  function fmt(v){\n    var n=parseFloat(String(v).replace(/\\./g,\"\").replace(\",\",\".\"));\n    return isNaN(n) ? \"\" : n.toFixed(2).replace(\".\",\",\");\n  }\n  function detFmt(v){ var s=(v==null?\"\":String(v)).trim(); return /^\\d+([.,]\\d+)?$/.test(s)?(s+\"mm\"):s; }\n  function detRaw(v){ var s=(v==null?\"\":String(v)).trim(); return /^\\d+([.,]\\d+)?mm$/.test(s)?s.slice(0,-2).trim():s; }\n  function flash(el, ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  async function guardar(el){\n    var row=el.getAttribute(\"data-row\"), col=el.getAttribute(\"data-col\"), val=el.value;\n      if(col===\"tipo\") val=detRaw(val);\n    try{\n      var body=new URLSearchParams();\n      body.set(\"row\", row); body.set(\"col\", col); body.set(\"valor\", val);\n      var r=await fetch(\"/plan5/precios/guardar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      el.dataset.orig=el.value;\n      var d=DATA.find(function(x){return String(x.r)===String(row);}); if(d) d[col]=(col===\"tipo\"?detRaw(el.value):el.value);\n      flash(el, !!(j&&j.ok));\n    }catch(e){ flash(el, false); }\n  }\n  // Al entrar en una celda de Detalle, quita el \"mm\" para editar el numero\n  $(\"tb\").addEventListener(\"focusin\", function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"cell\")&&el.getAttribute(\"data-col\")===\"tipo\") el.value=detRaw(el.value); });\n  // Delegacion: al salir de una celda, formatear precio y guardar si cambio\n  $(\"tb\").addEventListener(\"focusout\", function(e){\n    var el=e.target; if(!el.classList||!(el.classList.contains(\"cell\")||el.classList.contains(\"pr\"))) return;\n    if(el.getAttribute(\"data-col\")===\"precio\") el.value=fmt(el.value);\n    if(el.getAttribute(\"data-col\")===\"tipo\") el.value=detFmt(el.value);\n    if(el.value===(el.dataset.orig||\"\")) return;\n    guardar(el);\n  });\n  // Borrar una linea: elimina la fila del Sheet y reajusta indices\n  $(\"tb\").addEventListener(\"click\", async function(e){\n    var b=e.target.closest && e.target.closest(\".delp\"); if(!b) return;\n    var row=parseInt(b.getAttribute(\"data-row\"),10);\n    var d=DATA.find(function(x){return x.r===row;});\n    var nombre=(d&&((d.concepto||\"\")+\" \"+(d.tipo||\"\")).trim())||\"esta linea\";\n    if(!confirm(\"Borrar \\\"\"+nombre+\"\\\"?\")) return;\n    try{\n      var body=new URLSearchParams(); body.set(\"row\", row);\n      var r=await fetch(\"/plan5/precios/borrar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      if(!j||!j.ok){ alert(\"No se pudo borrar\"); return; }\n      var idx=DATA.findIndex(function(x){return x.r===row;}); if(idx>=0) DATA.splice(idx,1);\n      DATA.forEach(function(x){ if(x.r>row) x.r--; });  // las de abajo suben 1\n      render($(\"q\").value);\n    }catch(err){ alert(\"Error al borrar: \"+err.message); }\n  });\n  // Boton + : anade una linea de precio nueva (reserva fila en el Sheet)\n  $(\"addBtn\").addEventListener(\"click\", async function(){\n    try{\n      var r=await fetch(\"/plan5/precios/nueva\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\"});\n      var j=await r.json().catch(function(){return {ok:false};});\n      if(!j||!j.ok||!j.row){ alert(\"No se pudo anadir la fila\"); return; }\n      DATA.push({ r:j.row, ud:\"\", concepto:(j.concepto||\"\"), tipo:\"\", precio:\"\" });\n      $(\"q\").value=\"\";\n      DATA.sort(function(a,b){ var c=sa(a.concepto).localeCompare(sa(b.concepto)); return c!==0?c:sa(a.tipo).localeCompare(sa(b.tipo)); });\n      render(\"\");\n      var inp=document.querySelector('#tb input[data-row=\"'+j.row+'\"][data-col=\"concepto\"]');\n      if(inp){ inp.scrollIntoView({block:\"center\"}); inp.focus(); inp.select(); }\n    }catch(e){ alert(\"Error al anadir: \"+e.message); }\n  });\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

const DESGLOSE_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<!--__PLAN5_THEME__-->\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Plan 5 · MEDICIONES</title>\n<style>\n  .page{max-width:1100px}\n  .card{padding:6px}\n  .p5icon{background:none;border:1px solid var(--ptl-general-2);border-radius:6px;width:30px;height:30px;font-size:15px;line-height:1;cursor:pointer;color:var(--ptl-titulo);margin-left:4px}\n  .p5icon:disabled{opacity:.35;cursor:default}\n  table.dsg{width:100%;border-collapse:collapse}\n  table.dsg thead th{position:sticky;top:52px;z-index:80;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;font-size:10px;letter-spacing:.4px;text-align:left;padding:4px 4px;border-bottom:1px solid var(--ptl-general-2)}\n  table.dsg th.num,table.dsg td.num{text-align:right}\n  table.dsg td{padding:1px 4px;border-bottom:1px solid var(--ptl-general-2);font-size:11px}\n  table.dsg tr.cap td{background:var(--ptl-general-2);color:var(--ptl-titulo);text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:.4px}\n  table.dsg tr.tot td{font-weight:700;color:var(--ptl-titulo)}\n  table.dsg th.ud,table.dsg td.ud{width:26px}\n  table.dsg td.con{width:auto}\n  table.dsg th.dato,table.dsg td.dato{width:38px;text-align:right}\n  table.dsg td.dato input.cell{text-align:right;height:22px;width:24px;font-size:9px;padding:0 1px}\n  table.dsg th.cant,table.dsg td.cant{width:48px}\n  table.dsg th.var,table.dsg td.var{width:72px;font-size:10px;text-align:right}\n  table.dsg th.pre,table.dsg td.pre{width:54px}\n  table.dsg th.par,table.dsg td.par{width:46px}\n  table.dsg th.cap,table.dsg td.cap{width:176px;font-size:10px;color:var(--ptl-general-4)}\n  .dsg-empty{color:var(--ptl-general-4);font-style:italic;padding:14px 8px}\n  table.dsg td.dato{white-space:nowrap}\n  table.dsg td.dato.tramos{width:auto}\n  table.dsg td.dato.texto{width:auto;text-align:right;color:var(--ptl-titulo);font-size:10px}\n  .dunit{color:var(--ptl-general-4);font-size:10px;margin-left:4px}\n  input.dnum{width:24px;text-align:right;height:20px;font-size:9px;padding:0 1px}\n  .trow{display:inline-flex;align-items:center;gap:3px;flex-wrap:nowrap}\n  .tarr{color:var(--ptl-general-4);font-size:10px}\n  .ttope{color:var(--ptl-general-4);font-size:10px;white-space:nowrap}\n  input.dnum.aplica{color:#2563eb;font-weight:700;border-color:#2563eb}\n  .avbox{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:6px 10px;border-radius:6px;margin:0 0 8px;font-size:11px}\n  input.qcell{width:46px;text-align:right;height:20px;font-size:10px;padding:0 1px;border:1px solid transparent;background:transparent;color:inherit}\n  input.qcell:focus{border-color:var(--ptl-general-2);background:#fff}\n  input.qcell.qover{background:#fff7ed;border-color:#f59e0b;color:#b45309;font-weight:700}\n</style>\n</head>\n<body>\n<script>window.__DESGLOSE__=null;window.__PLAN5_TOKEN__=\"\";window.__PLAN5_DIR__=\"\";window.__PLAN5_VOLVER_ID__=\"\";window.__PLAN5_SCREEN__=\"desglose\";/*__DESGLOSE_DATA__*/</script>\n<div class=\"page\">\n  <div class=\"p5bar\">\n    <div class=\"p5brand\"><div class=\"ptl-logo\">A</div><div class=\"ptl-nav-text\"><strong>Araujo Presupuestos</strong><span class=\"ptl-nav-screen\" id=\"scrTitle\"></span></div></div>\n    <span class=\"p5spacer\"></span>\n    <button id=\"undoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Deshacer\" disabled>↶</button>\n    <button id=\"redoBtn\" class=\"menu-btn hdr-undo\" type=\"button\" title=\"Rehacer\" disabled>↷</button>\n    <button class=\"menu-btn hdr-reload\" type=\"button\" onclick=\"location.reload(true)\" title=\"Recargar (Ctrl+F5)\">🔄</button>\n    <div class=\"menu-wrap\">\n      <button id=\"menuBtn\" class=\"menu-btn\" aria-label=\"Menu\" type=\"button\">&#9776;</button>\n      <div id=\"menuList\" class=\"menu-list\" hidden></div>\n    </div>\n  </div>\n  <div id=\"avisos\"></div>\n  <div class=\"card\">\n    <table class=\"dsg\">\n      <thead><tr>\n        <th class=\"ud\">Ud</th>\n        <th class=\"con\">Concepto</th>\n        <th class=\"dato num\">Dato</th>\n        <th class=\"cant num\">Cantidad</th>\n        <th class=\"var\">Detalle</th>\n        <th class=\"pre num\">Precio</th>\n        <th class=\"par num\">Total</th>\n      </tr></thead>\n      <tbody id=\"tb\"></tbody>\n    </table>\n  </div>\n</div>\n<script>\n  var $=function(id){return document.getElementById(id);};\n  var DSG=window.__DESGLOSE__||null;\n  var TOKEN=window.__PLAN5_TOKEN__||\"\";\n  var DIR=window.__PLAN5_DIR__||\"\";\n  var hist=[], hpos=-1;\n  function esc(s){ return (s==null?\"\":String(s)).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }\n  function fmt(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return x.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:\"always\"}); }\n  function numED(n){ if(n==null||n===\"\")return\"\"; var x=Number(n); if(isNaN(x))return esc(n); return (Math.round(x*1000)/1000).toString().replace(\".\",\",\"); }\n  function fmtm(m){ if(m==null||m===\"\")return\"\"; var x=Number(m); if(isNaN(x))return esc(m); return (Math.round(x*100)/100).toString().replace(\".\",\",\")+\" m\"; }\n  function datoCell(l){\n    if(!l.dato) return '<td class=\"dato\"></td>';\n    if(l.dato.tipo===\"texto\"){ return '<td class=\"dato texto\">'+esc(l.dato.texto||\"\")+'</td>'; }\n    if(l.dato.tipo===\"tramos\"){\n      var t=l.dato.tramos||[]; var p=[];\n      p.push('<span class=\"ttope\">'+fmtm(t.length?t[0].lo:0)+'</span>');\n      for(var i=0;i<t.length;i++){\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<input class=\"cell dnum datocell'+(t[i].aplica?' aplica':'')+'\" data-row=\"'+t[i].row+'\" value=\"'+esc(numED(t[i].dias))+'\" data-orig=\"'+esc(numED(t[i].dias))+'\">');\n        p.push('<span class=\"tarr\">&rarr;</span>');\n        p.push('<span class=\"ttope\">'+fmtm(t[i].hi)+'</span>');\n      }\n      return '<td class=\"dato tramos\"><span class=\"trow\">'+p.join(\"\")+'</span><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n    }\n    if(l.dato.antes||l.dato.despues){ return '<td class=\"dato texto\">'+(l.dato.antes?'<span class=\"dunit\">'+esc(l.dato.antes)+'</span>':'')+'<input class=\"cell dnum datocell\" data-row=\"'+l.dato.row+'\" value=\"'+esc(numED(l.dato.valor))+'\" data-orig=\"'+esc(numED(l.dato.valor))+'\">'+(l.dato.despues?'<span class=\"dunit\">'+esc(l.dato.despues)+'</span>':'')+'</td>'; } return '<td class=\"dato\"><input class=\"cell dnum datocell\" data-row=\"'+l.dato.row+'\" value=\"'+esc(numED(l.dato.valor))+'\" data-orig=\"'+esc(numED(l.dato.valor))+'\"><span class=\"dunit\">'+esc(l.dato.unidad||\"\")+'</span></td>';\n  }\n  function render(dsg){\n    DSG=dsg;\n    var av=$(\"avisos\"); if(av){ av.innerHTML=\"\"; if(dsg&&dsg.avisos&&dsg.avisos.length){ av.innerHTML='<div class=\"avbox\">'+dsg.avisos.map(function(a){return esc(a);}).join(\"<br>\")+'</div>'; } }\n    var tb=$(\"tb\"); tb.innerHTML=\"\";\n    if(!dsg||!dsg.lineas||!dsg.lineas.length){\n      var tr=document.createElement(\"tr\");\n      tr.innerHTML='<td class=\"dsg-empty\" colspan=\"7\">El motor de calculo aun no esta conectado. Rellena viviendas y longitud en Toma de datos.</td>';\n      tb.appendChild(tr); return;\n    }\n    dsg.lineas.forEach(function(l){\n      var tr=document.createElement(\"tr\");\n      if(l.tipo_fila===\"capitulo\"){ tr.className=\"cap\"; tr.innerHTML='<td colspan=\"7\">'+esc(l.concepto)+'</td>'; }\n      else if(l.tipo_fila===\"total\"){ tr.className=\"tot\"; tr.innerHTML='<td></td><td>'+esc(l.concepto)+'</td><td></td><td></td><td></td><td></td><td class=\"par num\">'+fmt(l.parcial)+'</td>'; }\n      else {\n        tr.innerHTML='<td class=\"ud\">'+esc(l.ud||\"\")+'</td>'+\n          '<td class=\"con\" title=\"'+esc(l.capitulo_presupuesto||\"\")+'\">'+esc(l.concepto)+'</td>'+\n          datoCell(l)+\n          '<td class=\"cant num\">'+(l.ovkey?('<input class=\"cell qcell'+(l.over?' qover':'')+'\" data-ovkey=\"'+esc(l.ovkey)+'\" data-orig=\"'+esc(numED(l.cantidad))+'\" data-disp=\"'+esc(fmt(l.cantidad))+'\" value=\"'+esc(fmt(l.cantidad))+'\">'):fmt(l.cantidad))+'</td>'+\n          '<td class=\"var\">'+esc(l.variante||\"\")+'</td>'+\n          '<td class=\"pre num\">'+fmt(l.precio)+'</td>'+\n          '<td class=\"par num\">'+fmt(l.parcial)+'</td>';\n      }\n      tb.appendChild(tr);\n    });\n  }\n  render(DSG);\n\n  // ---- Edicion: guarda el dato en el Sheet, el servidor recalcula todo y se repinta (verde/rojo) ----\n  function flash(el,ok){\n    if(!el) return;\n    if(el._t){ clearTimeout(el._t); el._t=null; }\n    el.classList.remove(\"ptl-guardado-ok\",\"ptl-guardado-error\");\n    if(ok){ el.classList.add(\"ptl-guardado-ok\"); el._t=setTimeout(function(){ el.classList.remove(\"ptl-guardado-ok\"); el._t=null; },5000); }\n    else { el.classList.add(\"ptl-guardado-error\"); }\n  }\n  function findInput(row){ return document.querySelector('#tb input.datocell[data-row=\"'+row+'\"]'); }\n  function setUndoRedo(){ var u=$(\"undoBtn\"),r=$(\"redoBtn\"); if(u)u.disabled=(hpos<0); if(r)r.disabled=(hpos>=hist.length-1); }\n  async function guardarDato(row,valor){\n    try{\n      var body=new URLSearchParams(); body.set(\"row\",row); body.set(\"valor\",valor);\n      var r=await fetch(\"/plan5/mediciones/guardar\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n      var j=await r.json().catch(function(){return {ok:false};});\n      return !!(j&&j.ok);\n    }catch(e){ return false; }\n  }\n  async function refetch(){\n    try{\n      var url=\"/plan5/desglose?format=json\"+(DIR?\"&dir=\"+encodeURIComponent(DIR):\"\")+(TOKEN?\"&token=\"+encodeURIComponent(TOKEN):\"\");\n      var r=await fetch(url);\n      var j=await r.json().catch(function(){return null;});\n      if(j&&typeof j.dsg!==\"undefined\"){ render(j.dsg); return true; }\n    }catch(e){}\n    return false;\n  }\n  // guarda un valor en una fila, recalcula y marca verde/rojo en esa fila\n  async function commit(row,valor){\n    var sok=await guardarDato(row,valor);\n    var rok=await refetch();\n    flash(findInput(row), sok&&rok);\n    return sok&&rok;\n  }\n  function onEdit(inp){\n    var prev=inp.getAttribute(\"data-orig\"); if(prev==null)prev=\"\";\n    var next=inp.value;\n    if(next===prev)return;\n    hist=hist.slice(0,hpos+1); hist.push({row:inp.getAttribute(\"data-row\"),prev:prev,next:next}); hpos=hist.length-1; setUndoRedo();\n    commit(inp.getAttribute(\"data-row\"),next);\n  }\n  async function undo(){ if(hpos<0)return; var e=hist[hpos]; hpos--; setUndoRedo(); await commit(e.row,e.prev); }\n  async function redo(){ if(hpos>=hist.length-1)return; hpos++; var e=hist[hpos]; setUndoRedo(); await commit(e.row,e.next); }\n  function findQ(k){return document.querySelector('#tb input.qcell[data-ovkey=\"'+(window.CSS&&CSS.escape?CSS.escape(k):k)+'\"]');}\n  async function saveOverride(k,v){try{var body=new URLSearchParams();body.set(\"dir\",DIR);body.set(\"ovkey\",k);body.set(\"valor\",v);var r=await fetch(\"/plan5/mediciones/override\"+(TOKEN?\"?token=\"+encodeURIComponent(TOKEN):\"\"),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});return !!(j&&j.ok);}catch(e){return false;}}\n  async function commitQty(k,v){var sok=await saveOverride(k,v);var rok=await refetch();flash(findQ(k),sok&&rok);return sok&&rok;}\n  function onFocusQty(el){if(el.getAttribute(\"data-disp\")==null)el.setAttribute(\"data-disp\",el.value);el.value=el.getAttribute(\"data-orig\")||\"\";}\n  function onEditQty(el){var prev=el.getAttribute(\"data-orig\");if(prev==null)prev=\"\";var next=el.value.trim();if(next===prev){el.value=el.getAttribute(\"data-disp\")||el.value;return;}commitQty(el.getAttribute(\"data-ovkey\"),next);}\n  var tb=$(\"tb\");\n  tb.addEventListener(\"focusin\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"qcell\")) onFocusQty(el); });\n  tb.addEventListener(\"focusout\",function(e){ var el=e.target; if(el.classList&&el.classList.contains(\"datocell\")) onEdit(el); else if(el.classList&&el.classList.contains(\"qcell\")) onEditQty(el); });\n  tb.addEventListener(\"keydown\",function(e){ if(e.key===\"Enter\"&&e.target.classList&&(e.target.classList.contains(\"datocell\")||e.target.classList.contains(\"qcell\"))) e.target.blur(); });\n  var ub=$(\"undoBtn\"); if(ub) ub.onclick=undo;\n  var rb=$(\"redoBtn\"); if(rb) rb.onclick=redo;\n  setUndoRedo();\n(function(){var ESTADO=(window.__PLAN5_ESTADO__||'abierto'),CIERRE=window.__PLAN5_CIERRE__||null;var bar=document.querySelector('.p5bar');var rel=bar?bar.querySelector('.hdr-reload'):null;var btn=document.createElement('button');btn.type='button';btn.className='menu-btn';btn.id='cerrarBtn';if(bar){if(rel)bar.insertBefore(btn,rel);else bar.appendChild(btn);}function pintaBanner(){var av=$('avisos');if(!av)return;var old=document.getElementById('cerradoBanner');if(old)old.remove();if(ESTADO==='cerrado'){var d=document.createElement('div');d.id='cerradoBanner';d.className='avbox';var f='';try{if(CIERRE&&CIERRE.fecha){var dt=new Date(CIERRE.fecha);f=dt.toLocaleDateString('es-ES')+' '+dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}}catch(e){}d.textContent='\uD83D\uDD12 PRESUPUESTO CERRADO'+(f?(' \u00b7 '+f):'')+((CIERRE&&CIERRE.revision)?(' \u00b7 '+CIERRE.revision):'')+'. Edicion bloqueada. Pulsa el candado para abrir.';av.insertBefore(d,av.firstChild);}}function lockCells(){var dis=(ESTADO==='cerrado');document.querySelectorAll('#tb input.qcell, #tb input.datocell').forEach(function(el){el.disabled=dis;});}function pintaBtn(){if(ESTADO==='cerrado'){btn.textContent='\uD83D\uDD12';btn.title='Presupuesto cerrado - pulsa para abrir';btn.style.color='#b45309';}else{btn.textContent='\uD83D\uDD13';btn.title='Cerrar presupuesto (congelar)';btn.style.color='';}}function aplicar(){pintaBtn();pintaBanner();lockCells();}async function postAbrir(modo){btn.disabled=true;try{var body=new URLSearchParams();body.set('dir',DIR);body.set('modo',modo);var r=await fetch('/plan5/abrir'+(TOKEN?'?token='+encodeURIComponent(TOKEN):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo abrir'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}function dialogoAbrir(){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';var bx=document.createElement('div');bx.style.cssText='background:#fff;color:#111;max-width:440px;width:90%;border-radius:10px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);';var t=document.createElement('div');t.textContent='Abrir presupuesto';t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px;';bx.appendChild(t);var sub=document.createElement('div');sub.textContent='Elige como abrirlo:';sub.style.cssText='color:#555;font-size:13px;margin-bottom:12px;';bx.appendChild(sub);function opt(tit,desc,modo){var b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;cursor:pointer;';var h=document.createElement('div');h.textContent=tit;h.style.cssText='font-weight:700;color:#111;font-size:13px;';b.appendChild(h);var dd=document.createElement('div');dd.textContent=desc;dd.style.cssText='color:#666;font-size:12px;margin-top:2px;';b.appendChild(dd);b.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);postAbrir(modo);};bx.appendChild(b);}opt('Actualizar formulas y precios','Recalcula todo con los datos y precios actuales.','full');opt('Actualizar solo precios','Mantiene las cantidades de la foto y refresca los precios.','precios');opt('Editar a mano','Deja la foto tal cual y la desbloquea.','manual');var cc=document.createElement('button');cc.type='button';cc.textContent='Cancelar';cc.style.cssText='display:block;width:100%;border:none;background:none;color:#666;padding:6px;cursor:pointer;font-size:13px;';cc.onclick=function(){if(ov.parentNode)document.body.removeChild(ov);};bx.appendChild(cc);ov.appendChild(bx);ov.onclick=function(e){if(e.target===ov&&ov.parentNode)document.body.removeChild(ov);};document.body.appendChild(ov);}async function cerrarFlow(){if(!confirm('Cerrar el presupuesto? Se congelara una foto (desglose y cuadro economico) y quedara bloqueado para editar.'))return;btn.disabled=true;try{var url='/plan5/desglose?format=json'+(DIR?'&dir='+encodeURIComponent(DIR):'')+(TOKEN?'&token='+encodeURIComponent(TOKEN):'');var rf=await fetch(url);var jf=await rf.json().catch(function(){return null;});if(!jf||!jf.dsg){alert('No hay desglose que cerrar todavia. Rellena la toma de datos.');btn.disabled=false;return;}var body=new URLSearchParams();body.set('dir',DIR);body.set('snapshot',JSON.stringify({dsg:jf.dsg,cuadro:jf.cuadro||null}));var r=await fetch('/plan5/cerrar'+(TOKEN?'?token='+encodeURIComponent(TOKEN):''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});var j=await r.json().catch(function(){return {ok:false};});if(j&&j.ok){location.reload(true);}else{alert('No se pudo cerrar'+((j&&j.error)?': '+j.error:''));btn.disabled=false;}}catch(e){alert('Error: '+e.message);btn.disabled=false;}}btn.addEventListener('click',function(){if(ESTADO==='cerrado'){dialogoAbrir();return;}cerrarFlow();});aplicar();})();\n</script>\n<script>/*__PLAN5_MENU__*/</script>\n</body>\n</html>\n";

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
    tiempo:   [ { hasta: 1.5, dias: 0.25 }, { hasta: 4, dias: 0.375 } ], // tope template = 4 m
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
  R.otros  = calcOtros(+e.otrosTiempos||0, +e.otrosEur||0, precios);
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
  const estudio = 150 + (R.entrada.nsum || R.entrada.viviendas || 0) * 3; // G294 seguridad (formula propia)

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
  const F45 = F38 + F44 + estudio;
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
  R.capitulos.estudio          = 150 + (R.entrada.nsum || R.entrada.viviendas || 0) * 3; // G295 (formula propia)

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

  R.totales.conSubvencion = em.neto;
  R.totales.porComunero   = em.porComunero;
  // Financiación: cuota mensual (PMT) sobre el importe por comunero, por plazo (C49-C51).
  const pmt = (anual, n, P) => { if (!P || !n) return 0; const i = Math.pow(1 + (anual || 0) / 100, 1 / 12) - 1; return i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; };
  R.emasesa.financiacion = (t.financiacion || []).map(p => ({ meses: p.meses, tae: p.tae, cuota: pmt(p.tae, p.meses, em.porComunero) }));
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
function calcOtros(otrosTiempos, otrosEur, precios) {
  const L = [];
  const add = (c, v, cant, pr, tc, cap) => L.push({ concepto: c, variante: v, cantidad: cant, precio: pr, tipoCoste: tc, capitulo: cap });
  add("Fontanero", "cuadrilla x2", (+otrosTiempos || 0), precioDe(precios, "Fontanero", "cuadrilla x2"), "MO", "1.6.1 Mano de obra");
  add("Otros trabajos extra", "ud", 1, (+otrosEur || 0), "ALB", "2.6 Otros trabajos extra");
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
                           otrosTiempos: +m.otrosTiempos || 0, otrosEur: +m.otrosEur || 0, gpMotAct: +m.gpMotAct || 0, gpInstala: m.gpInstala || "", gpPotNew: m.gpPotNew || "", gpNdepNew: +m.gpNdepNew || 0, gpTdepNew: m.gpTdepNew || "", gpDias: +m.gpDias || 0, gpLongExp: +m.gpLongExp || 0, peines: (saved && saved.peines) || [], plantas: +m.plantas || 0, altura: +m.altura || 0, peinesHDias: +m.peinesHDias || 0 } },
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
              if (rw) dato = { tipo: "factor", row: rw, valor: (oc.pctAccesorios != null ? oc.pctAccesorios : 0.1), unidad: "× material" };
            } else if (l.concepto === DES) {
              rw = med.rowOf["CUARTO DE CONTADORES|" + DES + "|días"];
              if (rw) dato = { tipo: "factor", row: rw, valor: (oc.diasDesmontaje != null ? oc.diasDesmontaje : 0.25), unidad: "día/cuadrilla" };
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
            "Tubo distribución (PERT)": ["Merma (×)", "merma", "×", "incremento de medición en un ", ""],
            "Sujección tuberías (PERT)": ["Una cada (m)", "sujSp", "m", "1 sujección cada ", " m"],
            "Guia de sujección tuberías": ["ml por sujección", "guia", "ml/ud", "", " ml por sujección"],
            "Tornillo + taco": ["ud por sujección", "torn", "ud", "", " ud por sujección"],
            "PEINE H (f.techo + agujero + tapado + pintado 50x50cm)": ["Metros por agujero", "ftDiv", "m", "un agujero cada ", " m"],
            "Albañil (PEINE H - f.techo agujero + tapado + pintado)": ["Días por agujero", "albTG", "día", "", " días de albañil por agujero"],
            "Albañil (PEINE H -b.ladrillo)": ["Días por metro", "albLad", "día/m", "", " días de albañil por metro"],
            "Albañil + Fontanero (PEINE V-INT - abrir, meter tubo y cerrar calos)": ["Días por vivienda", "vintF", "día", "", " días por vivienda"],
            "Fontanero (doblado chapa canaleta)": ["Días por chapa", "fontCh", "día", "", " días por chapa"],
            "Fontanero (ENGANCHE - exterior)": ["Días por vivienda", "dEXT", "día", "", " días por vivienda"],
            "Fontanero (ENGANCHE - interior fácil)": ["Días por vivienda", "dFac", "día", "", " días por vivienda"],
            "Fontanero (ENGANCHE - interior medio)": ["Días por vivienda", "dMed", "día", "", " días por vivienda"],
            "Fontanero (ENGANCHE - interior difícil)": ["Días por vivienda", "dDif", "día", "", " días por vivienda"]
          };
          var soloPrim = { "Tubo distribución (PERT)": 25, "Sujección tuberías (PERT)": 25 };
          var mrows = [];
          calc.lineas.forEach(function (l) {
            var dato = null, mp = MP[l.concepto];
            if (mp) {
              var okVar = !(l.concepto in soloPrim) || (+l.variante === soloPrim[l.concepto]);
              if (okVar) { var rw = med.rowOf["MONTANTES|" + l.concepto + "|" + mp[0]]; if (rw) dato = { tipo: "factor", row: rw, valor: om[mp[1]], unidad: mp[2], antes: mp[3] || "", despues: mp[4] || "" }; }
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
        lineas.forEach(function (l) {
          if (l.tipo_fila) return;                                  // capítulos y totales no
          var k = String(l.concepto || "") + "||" + String(l.variante || "");
          l.ovkey = k;
          if (Object.prototype.hasOwnProperty.call(OV, k)) {
            var v = OV[k];
            if (v !== "" && v != null && !isNaN(+v)) { l.cantidad = +v; l.parcial = +((+v) * (l.precio || 0)).toFixed(2); l.over = true; }
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

        // ===== CUADRO ECONOMICO (C29:F51): recalcula costes/margenes/EMASESA/financiacion con las
        // cantidades REALES que se pintan (overrides incluidos), para que cuadre con MEDICIONES. =====
        try {
          R.desglose = lineas.filter(function (l) { return !l.tipo_fila && l.tipo; }).map(function (l) {
            return { concepto: l.concepto, tipo: l.variante, cantidad: +l.cantidad || 0, precio: +l.precio || 0,
                     total: +l.parcial || 0, tipoCoste: l.tipo || "", capitulo: l.capitulo_presupuesto || "" };
          });
          paso5_agregacionYMargenes(R);
          paso6_emasesaNeto(R, FUENTES);
          var _fin = R.emasesa.financiacion || [];
          var _E40 = R.margenes.pctBenefManoObra || 0;
          cuadro = {
            tEjec: R.costes.tiempoEjecucion, cMat: R.costes.materiales, cMo: R.costes.manoObra,
            cAlb: R.costes.albanileria, cGp: R.costes.grupoPresion, cTot: R.costes.directo,
            bMat: R.margenes.pctBenefMateriales, bMo: _E40, c39: (_E40 / 0.2), c41: R.margenes.pctBenefVenta,
            btTrad: R.tradicional.beneficio, totTrad: R.tradicional.total, totTradIva: R.tradicional.totalIva, hTrad: R.tradicional.eurHora,
            bP5: R.plan5.beneficio, totP5: R.plan5.total, totP5Iva: R.plan5.totalIva, hP5: R.plan5.eurHora,
            fin6: (_fin[0] && _fin[0].cuota) || 0, fin12: (_fin[1] && _fin[1].cuota) || 0, fin18: (_fin[2] && _fin[2].cuota) || 0,
            subv: R.emasesa.subvencion, totSubv: R.totales.conSubvencion, comunero: R.emasesa.porComunero,
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
          R.desglose = reales.map(function (l) { return { tipoCoste: l.tipo, cantidad: +l.cantidad || 0, total: +l.parcial || 0, capitulo: l.capitulo_presupuesto || "" }; });
          paso5_agregacionYMargenes(R); paso6_emasesaNeto(R, FUENTES);
          var _fin = R.emasesa.financiacion || [], _E40 = R.margenes.pctBenefManoObra || 0;
          saved.snapshot.cuadro = {
            tEjec: R.costes.tiempoEjecucion, cMat: R.costes.materiales, cMo: R.costes.manoObra,
            cAlb: R.costes.albanileria, cGp: R.costes.grupoPresion, cTot: R.costes.directo,
            bMat: R.margenes.pctBenefMateriales, bMo: _E40, c39: (_E40 / 0.2), c41: R.margenes.pctBenefVenta,
            btTrad: R.tradicional.beneficio, totTrad: R.tradicional.total, totTradIva: R.tradicional.totalIva, hTrad: R.tradicional.eurHora,
            bP5: R.plan5.beneficio, totP5: R.plan5.total, totP5Iva: R.plan5.totalIva, hP5: R.plan5.eurHora,
            fin6: (_fin[0] && _fin[0].cuota) || 0, fin12: (_fin[1] && _fin[1].cuota) || 0, fin18: (_fin[2] && _fin[2].cuota) || 0,
            subv: R.emasesa.subvencion, totSubv: R.totales.conSubvencion, comunero: R.emasesa.porComunero,
          };
        } catch (e) { console.error("[plan5] abrir precios error:", e.message); }
        delete saved.cierre;
      } else {
        delete saved.snapshot; delete saved.cierre;   // full: recalcular todo en vivo
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
module.exports.calcGrupoPresion = calcGrupoPresion;
module.exports.calcMontantes = calcMontantes;
module.exports.paso2_peines = paso2_peines;
module.exports.diametroAlimentacion = diametroAlimentacion;
module.exports.diametroConexion = diametroConexion;
module.exports.parseMediciones = parseMediciones;
module.exports.calcEmasesa = calcEmasesa;
module.exports.paso5_agregacionYMargenes = paso5_agregacionYMargenes;
module.exports.paso6_emasesaNeto = paso6_emasesaNeto;
