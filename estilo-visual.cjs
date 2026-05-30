// estilo-visual.cjs
// Build: 2026-05-30 v1.63 (Sobre v1.62: cerrado SOLO el hueco entre el timeline y los numeros, sin tocar nada mas. .ptl-fila .ptl-timeline justify-content flex-start -> flex-end: el timeline sigue siendo flex:1 (mismo ancho, no se corta) pero sus puntos se pegan a la DERECHA, contra los numeros, cerrando el hueco. Los numeros NO se mueven (siguen fijos a la derecha, alineados en columna, en el borde). Un solo cambio. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.62 (Sobre v1.61: base = estado de la foto 01:23 (v1.51) pero con la LINEA a la IZQUIERDA para que el timeline NO se corte por la derecha, SIN mover los numeros. .ptl-fila-info 180 -> 120px (linea a la izq -> el timeline gana ancho y la ultima fase 08-CYCP ya no se corta). .ptl-fila .ptl-timeline flex:1 1 0 + min-width:0 + justify-content:flex-start (ocupa el hueco, puntos pegados al badge) + overflow:visible (no recorta la ultima fase). .ptl-fila-importe flex:0 0 100px fijo, es el ULTIMO elemento -> queda pegado al borde derecho por el propio flex (sin margin-left:auto, que con timeline flex:1 era redundante); text-align:right -> alineados en columna. La fila tiene overflow:hidden de red. Asi: numeros fijos a la derecha en columna + timeline con todo el ancho posible sin cortarse. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.61 (Sobre v1.60: SOLUCION al desbordamiento (los numeros se SALIAN por la derecha): la fila se hacia mas ancha que la ventana al sumar dir+badge+timeline(ancho fijo grande)+importe, y margin-left:auto no podia fijar nada porque no habia sobrante sino desbordamiento. Nuevo reparto robusto: dir+badge+importe son FIJOS (180+115+100=395px, siempre caben) y el TIMELINE es el elastico que CEDE: .ptl-fila .ptl-timeline flex:1 1 0 + min-width:0 + justify-content:flex-end (ocupa el hueco entre badge e importe, se encoge si no cabe -> el importe NUNCA se sale; puntos pegados a la derecha -> hueco pequeño con los numeros). .ptl-fila-importe flex:0 0 100px text-align:right SIN margin-left:auto (es el ultimo y fijo -> pegado al borde derecho/amarilla, alineado en columna). .ptl-fila-info 280 -> 180px. .ptl-fila gana overflow:hidden como red de seguridad. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.60 (Sobre v1.59: linea a la DERECHA para ESTRECHAR el hueco entre el final del timeline y los numeros (mover la linea a la izquierda lo ensanchaba; a la derecha lo estrecha, porque el timeline acaba mas cerca del importe que esta clavado a la derecha). .ptl-fila-info 150 -> 280px. Numeros siguen clavados al margen derecho (margin-left:auto, sin tocar). Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.59 (Sobre v1.58: linea 50px a la izquierda. .ptl-fila-info 200 -> 150px. Solo ese numero. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.58 (Sobre v1.57: linea 30px a la izquierda. .ptl-fila-info 230 -> 200px. Solo ese numero; nada elastico, el resto no se mueve. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.57 (Sobre v1.56: las DOS cosas que pedia Guille, por separado y bien: (A) IMPORTES clavados al MARGEN DERECHO (linea amarilla) y alineados en columna: .ptl-fila-importe recupera margin-left:auto (empuja el numero al extremo derecho absorbiendo el sobrante de la fila) + text-align:right + ancho fijo 110px (cabe 999.999,99 €; todos los € en la misma vertical) + padding-right:4px de sangria al borde. (B) Reducido el HUECO entre el final del timeline y los numeros moviendo la LINEA (fin de badges/inicio de timeline) a la DERECHA: .ptl-fila-info 150 -> 230px, asi el timeline arranca mas a la derecha y su final queda mas cerca del importe. El timeline sigue flex:0 0 auto (ancho natural, igual en todas las filas). Las dos cosas son independientes y compatibles: el sobrante que absorbe margin-left:auto disminuye al ensanchar la info, reduciendo el hueco, sin despegar el numero del margen. 230px provisional (mover este unico numero ajusta el hueco). Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.56 (Sobre v1.55: SOLUCION DEFINITIVA al baile de los importes, gracias a la observacion de Guille: TODOS los timelines ocupan SIEMPRE lo mismo (el render reserva 8 puntos fijos en todas las filas). Por tanto NO hace falta nada elastico (flex:1) ni margin-left:auto ni rellenar huecos: con las 4 columnas de ANCHO FIJO el importe cae en la misma vertical en todas las filas SOLO. Llevaba ~8 versiones metiendo flex elasticos que se peleaban entre si (timeline flex:1 vs importe margin-left:auto) y rompian la alineacion. Estado final, todo fijo: .ptl-fila-info flex:0 0 150px; .ptl-fila-badge-slot flex:0 0 115px; .ptl-fila .ptl-timeline flex:0 0 auto (ancho natural, identico en todas las filas) width:auto justify-content:flex-start (pegado al badge); .ptl-fila-importe flex:0 0 110px width:110px text-align:right (cabe hasta 999.999,99 €, alineado a la derecha en su caja fija -> todos los € en la misma vertical). Sin margin-auto, sin flex:1. El gap de .ptl-fila es 0; separaciones por margin-right de info y padding-left del importe. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.55 (Sobre v1.54: ENCONTRADO el fallo de raiz que llevaba varias versiones rompiendo los importes. Habia una CONTRADICCION en la fila: .ptl-fila .ptl-timeline estaba en flex:1 1 auto (se comia TODO el espacio sobrante) Y a la vez .ptl-fila-importe tenia margin-left:auto (que necesita espacio sobrante para empujar el numero a la derecha). Como el timeline ya no dejaba sobrante, el margin-left:auto no tenia nada que absorber y el importe quedaba pegado al final del timeline, escapandose al borde sin sangria. FIX: .ptl-fila .ptl-timeline vuelve a flex:0 0 auto (ancho fijo). Asi el sobrante de la fila existe, el margin-left:auto del importe lo absorbe y CLAVA el numero al margen derecho, en columna, con su padding-right:4px de sangria. El timeline queda de ancho natural pegado al badge por la izquierda; entre timeline e importe queda hueco (inevitable con timeline fijo + numero clavado a la derecha, y es el comportamiento correcto). Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.54 (Sobre v1.53: FIX error mio: al volver al timeline de ancho fijo en v1.52 me deje sin devolver el margin-left:auto del importe que habia quitado en v1.51 para el timeline elastico. Por eso los importes NO estaban fijados al margen derecho (iban pegados al final del timeline y rozaban el borde). Se devuelve margin-left:auto a .ptl-fila-importe -> los importes vuelven a quedar CLAVADOS al margen derecho, alineados en columna, sin escaparse, con el hueco entre timeline e importe (comportamiento correcto). Ademas padding-right:4px de respiro para que el simbolo € no toque el borde de la fila. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.53 (Sobre v1.52: descartado el experimento de grupos/puntos elasticos del timeline (habria estirado/separado las 8 fases por todo el ancho, cambiando mucho su aspecto) y se vuelve al timeline de ancho fijo de v1.52. Unico cambio efectivo: LINEA 10px a la derecha (.ptl-fila-info 140 -> 150px) para tantear. Estado conocido: en pantalla ANCHA el timeline (ancho fijo natural) deja hueco hasta el importe; en estrecha va justo. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.52 (Sobre v1.51: el timeline elastico se CORTABA por la derecha (la ultima fase 08-CYCP quedaba comida) porque no tenia ancho suficiente a media pantalla y .ptl-fila .ptl-timeline tenia overflow:hidden. Dos fixes: (1) se mueve la LINEA a la izquierda para dar mas ancho al timeline: .ptl-fila-info 185->140px y .ptl-fila-badge-slot 130->115px (linea ~315 -> ~255px). (2) .ptl-fila .ptl-timeline overflow hidden -> visible, para que la ultima fase no se recorte aunque ande justa. El importe sigue fijo a la derecha y alineado en columna. 140/115 provisionales. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.51 (Sobre v1.50: cierre del hueco timeline-importe ESTIRANDO el timeline (la unica forma de cerrarlo sin mover bloques ni que nada se salga). .ptl-fila .ptl-timeline pasa de flex:0 0 auto a flex:1 1 auto: ocupa todo el hueco entre el badge y el importe. justify-content pasa a flex-start (puntos pegados a la IZQUIERDA, arrancando junto al badge) y overflow:hidden por seguridad. .ptl-fila-importe pierde margin-left:auto (ya no hace falta: el timeline elastico lo empuja a la derecha) pero MANTIENE text-align:right + min-width:70px. Como dir+badge+importe son de ancho fijo, el hueco que ocupa el timeline es identico en todas las filas -> el importe arranca en la misma x en todas -> SIGUEN alineados en columna por la derecha (lo que se habia roto en v1.47). Linea de tabulacion queda en ~185 dir + 130 badge. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.50 (Sobre v1.49: MOVIDA la linea de tabulacion (borde derecho de badges = inicio de timelines) hacia la DERECHA para acercar el timeline al importe y reducir el hueco entre ellos (peticion de Guille, opcion 2). Al desplazar esa linea se mueven JUNTOS los badges (la siguen por su borde derecho) y el inicio del timeline; como el timeline tiene ancho fijo, su FINAL tambien se desplaza a la derecha -> se acerca al importe -> el hueco timeline-importe se reduce. El importe mantiene margin-left:auto (sigue alineado en columna por la derecha, intacto). .ptl-fila-info 150px -> 230px (la linea +80; ademas las direcciones se cortan menos) y .ptl-fila-badge-slot 115px -> 130px (+15): la linea pasa de ~265px a ~360px. Contrapartida asumida: los badges se separan del borde izquierdo (la direccion ocupa mas). 230/130 provisionales. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.49 (Sobre v1.48: REVERTIDO el acercamiento del importe de v1.47. Al quitar margin-left:auto, los importes se pegaban al timeline pero PERDIAN la alineacion a la derecha en columna (cada numero caia donde acababa su timeline, no en una vertical comun). Se devuelve margin-left:auto a .ptl-fila-importe: los totales vuelven a alinearse por la derecha en su columna (lo que pidio Guille). Vuelve a haber hueco entre timeline e importe, pero la alineacion de los numeros manda. Acompana a presupuestos.cjs v18.52.)
// Build: 2026-05-30 v1.48 (Sobre v1.47: BADGES del listado mas estrechos (peticion de Guille: tenian mucho margen entre las letras y el borde). .ptl-fila-badge padding lateral 8px -> 3px y letter-spacing .3px -> .2px. Mas cenidos al texto. Acompana a presupuestos.cjs v18.52 (tooltip nombre completo).)
// Build: 2026-05-30 v1.47 (Sobre v1.46: REDUCIDO el hueco entre el timeline y el importe total de la derecha (peticion de Guille). Ese hueco lo creaba el margin-left:auto de .ptl-fila-importe, que empujaba el total al extremo derecho de la fila. Se quita margin-left:auto y se deja padding-left:16px -> el importe queda pegado al timeline con 16px de respiro. Los importes siguen ALINEADOS entre si por la derecha porque (a) todos los timelines ocupan el MISMO ancho (el render reserva 8 puntos siempre, incluso en rechazados con puntos invisibles visibility:hidden) y (b) .ptl-fila-importe mantiene text-align:right + min-width:70px. El hueco sobrante de la fila queda ahora al final, despues del importe. 16px provisional, ajustable. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.46 (Sobre v1.45: el espacio que SEGUIA viendose entre badge y timeline pese al padding-right:0 era el gap:8px de .ptl-fila (separa TODAS las columnas por igual). FIX: gap de .ptl-fila 8px -> 0, y se recolocan las separaciones a mano solo donde hacen falta: .ptl-fila-info margin-right:10px (separa direccion del badge) y .ptl-fila-importe padding-left:10px (separa importe del timeline). Asi el badge queda PEGADO al timeline de verdad (gap 0 + padding 0), que es lo que pidio Guille, sin pegar el resto de columnas. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.45 (Sobre v1.44: espacio entre el borde derecho de los badges y el inicio del timeline a CERO (peticion de Guille): .ptl-fila-badge-slot padding-right 4px -> 0. Badges pegados al timeline. Solo ese numero. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.44 (Sobre v1.43: MOVIDA la linea de tabulacion (borde derecho de badges = borde izquierdo de timelines) hacia la IZQUIERDA, para que todo el bloque direccion+badge+timeline se desplace y los IMPORTES que se salian por la derecha (28.524,76 € etc., cortados por el borde de la ventana) entren completos. .ptl-fila-info 200px -> 150px y .ptl-fila-badge-slot 130px -> 115px: la linea pasa de ~330px a ~265px (65px a la izquierda). Ademas .ptl-fila-badge-slot padding-right 10px -> 4px para ACERCAR el borde derecho de los badges al inicio del timeline (peticion de Guille). Las direcciones se cortan algo antes con ellipsis (Guille: el corte da igual). Solo ajuste de numeros, misma estructura que v1.43. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.43 (Sobre v1.42: ELIMINADO el espacio muerto entre los badges y el timeline (lo que se veia en la captura: badges hacia el 18% y timeline hacia el 50%, un pasillo vacio enorme en medio). Dos causas y dos fixes: (1) .ptl-fila .ptl-timeline heredaba width:100% de la regla base .ptl-timeline, asi que aun con flex:0 0 auto se estiraba a todo el ancho y, con justify-content:flex-end, mandaba los puntos a la derecha dejando hueco a la izquierda -> ahora width:auto (ancho natural, pegado a lo que tenga delante). (2) .ptl-fila-badge-slot pasa de flex:1 1 auto (se comia el sobrante e inflaba el hueco) a flex:0 0 130px (ANCHO FIJO): el badge queda pegado a la direccion, alineado a la derecha dentro de sus 130px (punto de tabulacion en ~330px = 200 dir + 130 slot) y el timeline va JUSTO detras. (3) Para que el sobrante de ancho no reaparezca entre medias, .ptl-fila-importe recibe margin-left:auto -> TODO el hueco se va al FINAL de la fila (entre timeline e importe), con direccion+badge+timeline pegados a la izquierda. Resultado: timeline pegado a los badges (lo que pidio Guille). 200/130px provisionales. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.42 (Sobre v1.41: alineacion de badges del listado por PUNTO DE TABULACION (peticion de Guille, planteamiento correcto). En vez de pelear con anchos, se hace que el borde DERECHO de los badges caiga siempre en la misma x, situada ANTES del comienzo del timeline. Reparto de la fila [info][badge-slot][timeline][importe]: (1) .ptl-fila-info ancho FIJO 200px (antes 26%); cabe la mayoria de direcciones, las largas truncan con el ellipsis que ya tenia .ptl-fila-dir. (2) .ptl-fila-badge-slot pasa de flex:0 0 auto a flex:1 1 auto + justify-content:flex-end + padding-right:14px: ocupa TODO el hueco entre la direccion y el timeline y alinea el badge a la derecha, de modo que su borde derecho (menos los 14px de respiro) es el PUNTO DE TABULACION, identico en todas las filas y por delante del timeline. (3) .ptl-fila .ptl-timeline pasa de flex:1 a flex:0 0 auto (ancho natural fijo, anclado a la derecha): NO se mueve y deja que el badge-slot ocupe el hueco. DIFERENCIA con el error de v1.39: alli el flex:1 lo tenia .ptl-fila-info (direccion) y colapsaba a 0 borrando direcciones; aqui info es FIJA (200px) y el flex:1 lo lleva el badge-slot, que puede encoger sin problema (esta casi vacio). En pantallas muy estrechas, si no cabe todo, el badge-slot se encoge y el badge se acerca al timeline, pero NADA desaparece (ni direccion ni timeline). 200px y 14px provisionales, ajustables a ojo. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-30 v1.41 (Sobre v1.40: ALINEACION de los badges del listado por su borde DERECHO, BIEN esta vez y SIN romper direcciones. Diagnostico real (con captura de Guille a media pantalla): el badge no estaba desalineado por falta de ancho, sino porque .ptl-fila-info tenia ancho NATURAL (flex:0 0 auto) y el badge, que va detras, quedaba pegado a la direccion -> direccion corta = badge a la izquierda, direccion larga = badge a la derecha. FIX: .ptl-fila-info pasa a flex:0 0 26% (ancho FIJO; antes 0 0 auto). Asi la columna de direccion siempre mide igual, el badge arranca siempre en la misma x y, como .ptl-fila-badge-slot ya alinea a la derecha (justify-content:flex-end), todos los badges comparten borde derecho. DIFERENCIA con el error de v1.39: aquello era flex:1 1 0 (crecer/encoger sin tope -> colapsaba a 0 -> desaparecian direcciones); esto es 0 0 26% = FIJO, ni crece ni encoge. La direccion larga se trunca con el ellipsis que .ptl-fila-dir ya tenia. El timeline (flex:1) y el importe NO se tocan: solo cambia que la columna de info deja de ser elastica. Acompana a presupuestos.cjs v18.51 (sin cambios nuevos).)
// Build: 2026-05-29 v1.40 (Sobre v1.39: REVERTIDO el experimento de layout del listado que ROMPIO las direcciones. En v1.39 puse .ptl-fila-info en flex:1 1 0 (sin ancho), y al no caber direccion+badge+timeline+importe en pantallas no muy anchas la info se encogia a 0 -> las DIRECCIONES desaparecian. Se vuelve al reparto ORIGINAL, estable y de siempre: .ptl-fila-info flex:0 0 auto (ancho natural, max 26%); .ptl-fila-badge-slot flex:0 0 auto (ancho natural, badges justo tras la direccion); .ptl-fila .ptl-timeline flex:1 + overflow:hidden (anclado a la derecha). Las direcciones vuelven a verse. SE MANTIENE el fix de la cinta de v1.38/v1.39 (.ptl-na-left y .ptl-na-left .text en overflow:visible) que no tiene nada que ver con el listado. La alineacion de badges por la derecha queda PENDIENTE de rediseno cuidadoso desde este estado estable. Acompana a presupuestos.cjs v18.51.)
// Build: 2026-05-29 v1.39 (Sobre v1.38: (1) FIX badge de la cinta cortado por abajo, robusto: ademas de .ptl-na-left (v1.38), .ptl-na-left .text pasa de overflow:hidden a overflow:visible (mantiene white-space:nowrap; pierde el ellipsis del titulo, que en la cinta no hace falta porque los titulos de fase son cortos). (2) ALINEACION de badges del listado por la DERECHA y pegados al timeline (peticion de Guille): se rehace el reparto de la fila. .ptl-fila-info deja de ser ancho fijo (era flex:0 0 26%) y pasa a flex:1 1 0 (crece para empujar el bloque badge+timeline+importe a la derecha; en pantallas estrechas encoge y la direccion se trunca, protegiendo el timeline). .ptl-fila-badge-slot pasa a ancho FIJO 130px con justify-content:flex-end (badges alineados por su borde DERECHO, pegados a la izquierda del timeline; antes flex:0 0 auto, ancho variable). .ptl-fila .ptl-timeline pasa de flex:1 + overflow:hidden a flex:0 0 auto + overflow:visible: ancho natural fijo, NUNCA encoge ni recorta -> el 01-Contacto ya no desaparece bajo los badges anchos y la linea de estados NO se mueve (queda anclada a la izquierda del importe). 130px es provisional (cubre el badge mas ancho, "Cobrado DD-MM-AA"); ajustable a ojo. Acompana a presupuestos.cjs v18.50.)
// Build: 2026-05-29 v1.38 (Sobre v1.37: (1) FIX badge de la cinta de fase CORTADO POR ABAJO (pantallas de ficha, fases 01-08 y 09): .ptl-next-action-grid .ptl-na-left pasa de overflow:hidden a overflow:visible. El recorte vertical de esa caja cortaba el badge de plazo/estado que cuelga bajo el titulo. El recorte HORIZONTAL del titulo largo lo sigue haciendo .text (overflow:hidden + ellipsis), asi que no se pierde nada. (2) ALINEACION de los badges del LISTADO a una columna fija (peticion de Guille, "linea roja"): .ptl-fila-info pasa de flex:0 0 auto (ancho natural variable segun la direccion) a flex:0 0 26% (ancho FIJO, su tope anterior). Asi todos los badges arrancan en la MISMA x. La linea de estados (timeline) NO se mueve: va flex:1 anclada a la derecha con puntos de ancho fijo (flex:0 0 auto, justify-content:flex-end), de modo que fijar el ancho de la info solo reordena el hueco vacio, no los puntos. 26% es el limite seguro: subirlo mas comeria espacio del timeline (que no debe moverse). Acompana a presupuestos.cjs v18.50.)
// Build: 2026-05-29 v1.37 (Sobre v1.36: (1) FORMA DE PILDORA para TODOS los badges (peticion de Guille: unificar a forma de boton). .ptl-fila-badge (badges de estado del listado/ficha) pasa de border-radius 4px a 999px (capsula) y padding 2px 8px; .ptl-badge (pildoras de fase, ya usadas en documentacion) pasa de 10px a 999px. Sin hover (los badges son informativos, no clicables). (2) NUEVA variante .ptl-fila-badge-ejecucion en AZUL: fondo azul-claro + texto azul-oscuro + borde azul-claro, reusando las DOS unicas variables canonicas del sistema (no se inventa color nuevo). Es para el estado "En ejecucion" de la fase 09 en el listado. Sigue el mismo patron que decidir/en-plazo/retrasado (fondo claro del color + texto oscuro). NOTA: revisado el inventario, NINGUNA clase de badge esta muerta (ptl-badge-rojo parecia sin uso pero se genera dinamicamente via ptl-badge-${def.color} en 2 fases con color rojo), asi que no se borra nada. Acompana a presupuestos.cjs v18.49.)
// Build: 2026-05-29 v1.36 (Sobre v1.35: ALTURA UNIFICADA de la cinta de fase. La variante grid (.ptl-next-action.ptl-next-action-grid) sube min-height de 60px a 76px para que TODAS las cintas midan lo mismo: la fase mas alta (04, con 3 botones apilados: Reenviar/Aceptado/Rechazado) marcaba la altura real y las cortas (09, etc.) quedaban mas bajas. Ahora 76px cubre la 04 y las cortas suben a ese mismo alto. Solo se toca la variante GRID (la cinta de fase real); la base .ptl-next-action (banners de error/rechazado/descartado, una sola linea) se deja en 60px para no inflarla. Valor 76 provisional, a afinar a ojo. Acompana a presupuestos.cjs v18.48.)
// Build: 2026-05-29 v1.35 (Sobre v1.34: UNIFICACION del subtexto de la cinta de fase (.ptl-next-action .sub). La regla pasa de font-size:11px a font-size:10.5px + font-weight:600 (color y margin-top sin cambio: azul claro / 1px), que es EXACTAMENTE el estilo que los 5 bloques de fase de presupuestos.cjs venian escribiendo a mano inline (font-size 10.5, weight 600, color azul claro). Ahora ese estilo vive en UN SOLO sitio: presupuestos.cjs v18.46 elimina los 5 inline (incluido el de la fase 09, que ademas estaba en color OSCURO -success-dark/warning-dark- e ilegible sobre la cinta azul) y deja solo class=sub. Resultado: los 5 subtextos identicos y gobernados desde aqui; cambiar tamano/color del subtexto de la cinta = tocar esta unica linea. Acompana a presupuestos.cjs v18.46.)
// Build: 2026-05-28 v1.34 (Sobre v1.33: el botón ＋ de fila piso (.ptl-vec-btn-guardar) cuando está activo lleva borde azul oscuro 1.5px (antes era danger-dark). En hover sigue invertido a danger-dark/danger. Disabled intacto.)
// Build: 2026-05-28 v1.33 (Sobre v1.32: VISUAL — el botón ＋ "Guardar cambios" de cada fila piso (.ptl-vec-btn-guardar) pasa de azul claro/azul oscuro a ROJO con ＋ en BLANCO NEGRITA cuando está activo (fila con cambios sin guardar). Reposo: fondo --ptl-danger, color #FFFFFF, border --ptl-danger-dark, font-weight 700. Hover: invierte a fondo --ptl-danger-dark con borde --ptl-danger (texto sigue blanco). Disabled (sin cambios pendientes) sigue igual: gris claro + gris oscuro. Más visible para indicar "hay algo pendiente". Sin otros cambios.)
// Build: 2026-05-27 v1.32 (Sobre v1.31: FIX VISUAL — las etiquetas de los campos dentro de los modales (ventanas flotantes .ptl-floating-window) se veían en AZUL CLARO sobre el fondo BLANCO del modal, prácticamente ilegibles. Caso real: modal "Enviar mail manual" con DESTINATARIO, CC, CCO, ASUNTO, CUERPO DEL MENSAJE y ADJUNTOS casi invisibles. CAUSA: .ptl-form-label tiene color azul claro por v1.24 (todas las labels de la ficha viven sobre fondo azul oscuro y ahí se ven bien); ese mismo color se hereda dentro de los modales (fondo blanco) y rompe el contraste. FIX: nueva regla .ptl-floating-window .ptl-form-label{color:var(--ptl-azul-oscuro)} (y lo mismo para .ptl-form-section-title), que solo afecta a etiquetas DENTRO de modales flotantes. El resto del programa queda intacto: la ficha sigue con labels azul claro sobre fondo oscuro. Sirve para TODOS los modales que usen .ptl-floating-window, presentes y futuros. Acompaña a presupuestos.cjs v18.39 (fix bug ptlRecargaLimpia is not a function en fichas no-09).)
// Build: 2026-05-26 v1.31 (Sobre v1.30: el botón HOY (.ptl-filtro-hoy) se IGUALA a En trámite (.ptl-filtro-en-tramite) y Mapa (.ptl-btn-orden-ambar): le faltaba el fondo ámbar claro y el texto ámbar oscuro en reposo (estaba transparente con letra ámbar). Ahora los tres botones ámbar son idénticos: reposo = fondo warning-light + letra warning-dark + borde warning; hover = fondo warning + letra blanca. Sin más cambios.)
// Build: 2026-05-26 v1.30 (Sobre v1.29: REPASO GENERAL de hovers — los botones que en reposo son AZUL CLARO, al invertirse a fondo azul oscuro mantenían el BORDE azul oscuro, que se fundía con el fondo de pantalla (también oscuro) y desaparecía. Ahora su :hover pone border-color AZUL CLARO, así el borde se invierte de verdad y sigue visible. Afecta a: .ptl-filtro, .ptl-filtro-nuevo, .ptl-filtro-tramite, .ptl-fase-activa, .ptl-btn-orden, .ptl-btn-primary, .ptl-btn-undo, .ptl-vec-btn-guardar, .ptl-vec-doc-pendiente. Los botones de color (verde/ámbar/rojo) ya estaban bien (invierten a un tono distinto del fondo). Acompaña a presupuestos.cjs v18.32 y documentacion.cjs v17.33 (limpieza final: ~54 grises a pelo pasan a las variables de la escala; ya solo quedan blancos puros #FFFFFF a pelo, que es correcto).)
// Build: 2026-05-26 v1.29 (Sobre v1.28: (1) ALTURA uniforme de todos los campos de texto/select dentro de cajas: regla .ptl-card input:not(checkbox/radio),.ptl-card select{height:26px;box-sizing:border-box} (DATOS CCPP, DATOS ECONÓMICOS, etc. igualados; textarea exentos para que puedan crecer). (2) SIMPLIFICACIÓN: nueva clase .ptl-input-modal que sustituye el style inline repetido ~15 veces en el modal de Comunicaciones y en el campo notas_pto (presupuestos.cjs v18.31); el estilo del input vive ahora en UN solo sitio. (3) BORDE de la cinta de fase .ptl-next-action y su variante .ptl-next-action-grid (la ventanita de arriba con la fase + botones de paso) pasa de azul oscuro (invisible sobre el fondo) a AZUL CLARO, como el resto de cajas. La cajita PRÓXIMO MAIL (.ptl-mini-fecha) mantiene su borde oscuro a propósito (va sobre fondo azul claro, ahí sí se ve). Acompaña a presupuestos.cjs v18.31.)
// Build: 2026-05-26 v1.28 (Sobre v1.27: TODOS los botones se INVIERTEN al hover (fondo + letra + BORDE), decisión Guille "todos, todos, todos". (1) Se añade :hover que invierte a .ptl-btn-success y .ptl-btn-danger (no lo tenían) y se corrige el de .ptl-vec-btn-modo-manual y .ptl-vec-btn-borrar (antes no invertían). (2) SOLUCIÓN LIMPIA para los botones de cabecera que tenían el color en style INLINE (y por eso el hover no les funcionaba): se crean variantes de clase .ptl-btn-orden-verde / -ambar / -rojo (mismo formato que .ptl-btn-orden, distinta familia, todas invierten al hover con borde) y en presupuestos.cjs v18.30 se QUITA el inline de Plantillas mail/documentos (quedan .ptl-btn-orden azul), Ejecutar cron (.ptl-btn-orden-verde; su JS de estado ahora togglea CLASES verde/rojo en vez de estilos inline, así el hover sigue vivo), Mapa (.ptl-btn-orden-ambar) y HOY (.ptl-filtro-hoy). (3) Las FILAS del listado .ptl-fila pasan a borde AZUL CLARO (antes azul oscuro = invisible sobre el fondo oscuro), para distinguirse entre sí. Acompaña a presupuestos.cjs v18.30 y documentacion.cjs v17.32 (borde de la caja DATOS DOCUMENTACION a azul claro).)
// Build: 2026-05-26 v1.27 (Sobre v1.26: FONDO DE PANTALLA azul oscuro (decisión Guille). (1) body pasa a background azul oscuro + texto azul claro. (2) Como las cajas .ptl-card también son azul oscuro, su BORDE pasa a AZUL CLARO para que se distingan del fondo. (3) Barra superior .ptl-nav a azul oscuro + borde inferior azul claro; logo invertido (fondo claro/letra oscura); textos del título a azul claro. (4) Migajero .ptl-breadcrumb y .ptl-lista-header a texto/fondo coherentes con el fondo oscuro. (5) NUEVA clase .ptl-btn-avanzar (verde claro + letra verde oscuro + borde verde) para los botones de PASO/avance de fase. Acompaña a presupuestos.cjs v18.29 que aplica .ptl-btn-avanzar a los ~7 botones de avance (antes ptl-btn-primary azul). AVISO: cambio de gran alcance (fondo de TODO el programa); puede haber textos sueltos sobre el fondo oscuro que queden con bajo contraste; se pulen viéndolos.)
// Build: 2026-05-26 v1.26 (Sobre v1.25: (1) FECHAS del timeline de fases toman el MISMO color que el nombre de su fase según estado: .ptl-punto.actual/.completo/.rechazado .ptl-fecha pasan a ámbar/verde/rojo (antes la fecha siempre gris, desentonaba del nombre). Acompaña a presupuestos.cjs v18.28 que da BORDE visible (tono fuerte de su familia) a los botones de cabecera que lo tenían del mismo color que su fondo y por eso invisible: Plantillas mail, Plantillas documentos (azul oscuro), Ejecutar cron (verde), Mapa y HOY (ámbar) — y unifica HOY/En trámite/Mapa al mismo ámbar (fondo claro + letras warning-dark + borde warning).)
// Build: 2026-05-26 v1.25 (Sobre v1.24: GRAN UNIFICACIÓN de color (decisión Guille, "hacerlo una vez"). (1) ZEBRA: nueva variable --ptl-zebra (hoy = azul claro #B4DCFF) para la fila alterna de TODAS las listas/tablas; los 5 usos a pelo de #E0E2E6 (lista-filas de fase, Comunicaciones, Mails, cabecera CCPP de HOY, tabla DATOS DOCUMENTACION) pasan a var(--ptl-zebra). (2) FAMILIAS de color a TRÍO de variables: success/warning/danger ganan su variante -dark (#065F46 / #92400E / #991B1B) para el texto sobre fondo claro; TODOS los tonos sueltos a pelo de verde/ámbar/rojo (decenas) pasan a la variable que les toca por rol (fuerte/light/dark). (3) GRISES: se añade --ptl-gray-300 (#D1D5DB) que faltaba y los grises sueltos pasan a la escala de variables. (4) BORDES de botones UNIFORMES: .ptl-btn-success/.ptl-btn-danger ganan border-color de su tono -dark; los filtros de color (en-tramite, fase-zz, fase-tramitada, tramite, fase-activa) pasan a borde del tono FUERTE de su familia (antes borde = mismo color que el fondo claro -> no se veía). Resultado: todo el color del programa sale de variables; cambiar cualquier tono = una línea. Acompaña a presupuestos.cjs v18.27 y documentacion.cjs v17.31. Los tonos elegidos son provisionales: si no gustan, se cambian en el :root.)
// Build: 2026-05-26 v1.24 (Sobre v1.23: PASADA A FONDO a los textos sobre fondo azul oscuro (decisión Guille: TODO texto sobre azul oscuro va en azul claro). Las ETIQUETAS de formulario que se veían en gris apagado sobre las cajas oscuras pasan a AZUL CLARO: .ptl-form-label (TIPO VÍA, DIRECCIÓN, NOMBRE, TELÉFONO, EMAIL, y todos los campos de DATOS ECONÓMICOS que usan el helper inp()), .ptl-form-section-title (ADMINISTRADOR, PRESIDENTE — además pierde su border-bottom gris, que sobre oscuro era otra raya) y .ptl-label-mini. NOTA: las etiquetas del TIMELINE de fases (.ptl-label/.ptl-fecha) NO se tocan (esa zona se ve bien). Los textos sobre fondo blanco (inputs, listas, tablas) ya van en negro/oscuro de pasadas anteriores. Acompaña a presupuestos.cjs (sin cambios; las etiquetas usan estas clases comunes).)
// Build: 2026-05-26 v1.23 (Sobre v1.22: se quita el border:1px gris claro de .ptl-lista-filas (mini-listas de fase 02/05/08 de HOY). Sobre el fondo azul oscuro de la caja ese borde se veía como una raya clara innecesaria. Acompaña a presupuestos.cjs v18.26, que quita el mismo borde de .hoy-exp-list y .hoy-mails-list.)
// Build: 2026-05-26 v1.22 (Sobre v1.21: REPASO GENERAL de unificación de color (decisión Guille). (1) Se AÑADE al :root la variable --ptl-gray-800:#1F2937 que NO existía: varios textos usaban color:var(--ptl-gray-800) (asuntos y cuerpos de mail en Comunicaciones y en Mails pendientes) y, al ser variable inexistente, el navegador la ignoraba y esos textos HEREDABAN el azul claro de la caja -> se veían azul claro en vez de oscuros. Ahora resuelven a gris oscuro legible. (2) Se quitan las LÍNEAS azul claro bajo las cabeceras: .ptl-card-title y .ptl-card-title-row pierden su border-bottom (ahora cabecera y cuerpo son ambos azul oscuro, la línea solo metía una raya clara que desentonaba). (3) Cajita "PRÓXIMO MAIL" (.ptl-mini-fecha): pasa de fondo blanco/gris a fondo AZUL CLARO + borde y letras AZUL OSCURO (como un botón). Acompaña a presupuestos.cjs v18.24 y documentacion.cjs v17.30 (que sustituyen los últimos hex azules ANTIGUOS a pelo —#4F46E5, #EEF2FF, #C7D2FE, #DBEAFE, #C7DDF7, #93C5FD— por las variables del sistema, y ponen en azul claro los textos de reenvío de la cinta de fase y en negro el texto de Comunicaciones).)
// Build: 2026-05-26 v1.21 (Sobre v1.20: FIX de las dos zonas que seguían en azul claro pese a v1.20. (1) La cinta de fase real usa la variante .ptl-next-action.ptl-next-action-grid (regla MÁS específica, 2 clases) que tenía su propio background:azul-claro y pisaba al .ptl-next-action que se cambió en v1.20. Ahora esa variante también va a fondo AZUL OSCURO. (2) La franja .ptl-card-title-row de DATOS DOCUMENTACION llevaba un style inline propio; aunque no tocaba el background, para garantizar al 100% que aplica el fondo oscuro se refuerza el fondo/margen/padding INLINE en documentacion.cjs v17.29 (la regla CSS quedaba teóricamente bien pero no se reflejaba). DATOS PISOS (.ptl-card-title-row.ptl-vec-cabecera, sin inline) ya toma el fondo oscuro de la regla CSS. NOTA: micro-elementos sobre fondo blanco (badge-azul, stat-azul, filas .ptl-vec-fila-expandida que resaltan una fila de tabla, hover de autocompletar) se DEJAN en azul claro a propósito: son resaltados sobre blanco y ponerlos oscuros rompería el contraste del texto negro que va encima. Acompaña a documentacion.cjs v17.29.)
// Build: 2026-05-26 v1.20 (Sobre v1.19: más unificación al esquema de 2 azules tras revisión con Guille. (1) CINTA DE FASE .ptl-next-action: pasa de fondo azul claro+texto oscuro a fondo AZUL OSCURO + texto/subtexto AZUL CLARO (como las cabeceras). Los banners ZZ_RECHAZADO/ZZ_DESCARTADO NO cambian: siguen grises a propósito (estados apagados). (2) FRANJA DE CABECERA .ptl-card-title-row (cuando el título comparte fila con pill/botón, p.ej. DATOS DOCUMENTACION / DATOS PISOS): ahora es la FILA ENTERA la que es barra oscura de borde a borde (antes solo el <span> del título quedaba oscuro y el resto de la franja salía azul claro). El .ptl-card-title interior pierde su fondo/margen propios dentro del row. (3) FILAS DEL LISTADO .ptl-fila: fondo AZUL OSCURO + textos (dir/tipo/importe) AZUL CLARO (antes fondo claro+texto gris). Hover ajustado. (4) Texto de la tabla .ptl-vec-tabla (DATOS DOCUMENTACION, incl. la fila "Comunidad de propietarios") forzado a NEGRO (gray-900) porque va sobre el fondo blanco del wrap. (5) Las listas blancas (mails/exp HOY/lista-filas) ya iban a negro desde v1.20 anterior. Acompaña a documentacion.cjs (sin cambios de lógica; la cabecera ya usa .ptl-card-title-row). SIGUE SIENDO AFINADO: quedarán detalles de contraste por pulir pantalla por pantalla.)
// Build: 2026-05-26 v1.19 (Sobre v1.18: el FONDO de TODAS las cajas .ptl-card pasa a AZUL OSCURO con texto base AZUL CLARO (decisión Guille: "azul oscuro todas las ventanas"). Cambios: (1) .ptl-card background azul claro -> azul oscuro, y color -> azul claro (texto base que heredan los hijos sin color propio). (2) .ptl-card-title gana border-bottom azul claro para separarse del cuerpo ahora que ambos son oscuros. (3) Regla nueva .ptl-card input/textarea/select { color: gris-900 } para que los campos editables (fondo blanco) mantengan texto oscuro legible. (4) .ptl-card .ptl-grupo-titulo pasa de azul oscuro a azul claro. AVISO: es la PRIMERA PASADA de un cambio de gran alcance — afecta a TODAS las cajas del programa (ficha del expediente, económicos, documentación, HOY, fases). Es esperable que queden textos/elementos con bajo contraste sobre el nuevo fondo oscuro (etiquetas, datos, separadores que estaban en gris/oscuro a pelo); se irán puliendo pantalla por pantalla. Las filas grises de HOY, la lista blanca interior y los badges de color de estado conservan su color. Acompaña a presupuestos.cjs (sin cambios de lógica en esta entrega).)
// Build: 2026-05-26 v1.18 (Sobre v1.17: SISTEMA DE COLOR UNIFICADO A DOS AZULES (decisión Guille). Se establecen dos variables maestras en :root: --ptl-azul-oscuro:#004079 (RGB 0,64,121) y --ptl-azul-claro:#B4DCFF (RGB 180,220,255). TODOS los azules/lilas que antes estaban a pelo y dispersos (#4F46E5, #4338CA, #3730A3, #A5B4FC, #EEF2FF, #C7D2FE, #C7DDF7, #E0E7FF, #93C5FD, #DBEAFE) pasan a usar una de las dos variables. Las variables antiguas --ptl-brand/--ptl-brand-light/--ptl-brand-dark se mantienen pero APUNTAN a los dos azules canónicos (brand=oscuro, brand-light=claro) para no reescribir cada regla. REGLA DE USO: botones = fondo azul claro + texto azul oscuro (al activarse/hover se invierten a oscuro+claro); ventanas/cajas = fondo/cabecera azul oscuro + texto azul claro. CAMBIOS CONCRETOS: (1) .ptl-filtro y .ptl-filtro-nuevo y .ptl-btn-orden y .ptl-btn-primary y .ptl-vec-btn-guardar y .ptl-vec-doc-pendiente y .ptl-btn-undo:hover invertidos a la nueva regla. (2) .ptl-card: borde pasa a azul oscuro. (3) .ptl-card-title: pasa a BARRA de cabecera con fondo azul oscuro + texto azul claro, extendida de borde a borde (márgenes negativos que compensan el padding de la caja). NOTA: el cuerpo de .ptl-card sigue con fondo azul claro por ahora (si se quiere blanco, se afina luego). Los colores NO azules (verde éxito, ámbar warning, rojo danger, grises) NO se tocan. Acompaña a presupuestos.cjs v18.23 (subcabeceras de fase en azul oscuro, check invertido, X de Y).)
// Build: 2026-05-26 v1.17 (Sobre v1.16: completadas las clases de ancho del grid .ptl-form-grid que FALTABAN: .col-9, .col-10 y .col-11 (antes solo existían col-1..col-8 y col-12). Por eso el campo Dirección de la ficha del expediente, que usa class="col-11", NO se ensanchaba — la clase no existía y el navegador la ignoraba, dejando la columna al ancho mínimo del contenido. Ahora col-11 ocupa 11/12 del ancho y la Dirección llena toda la fila junto al Tipo vía (col-1). Solo se AÑADEN clases nuevas, no se modifica ninguna existente -> no afecta a nada que ya funcionara. Acompaña a presupuestos.cjs v18.08.)
// Build: 2026-05-19 v1.13 (Sobre v1.12: UNIFICACIÓN cinta de fase. (1) Migradas a estilo-visual.cjs las 8 reglas CSS de la cinta de fase que vivían hardcodeadas en presupuestos.cjs (.ptl-btn-enviar-avanzar, .ptl-btn-enviar-avanzar .ln, .ptl-na-igual-altura .ptl-btn, .ptl-btn-mail-3l, .ptl-btn-mail-3l .ln, .ptl-mini-fecha, .ptl-mini-fecha:hover, .ptl-mini-fecha input). El propio comentario en presupuestos.cjs ya decía "lo común está en estilo-visual.cjs" — ahora se cumple. (2) NUEVA regla .ptl-next-action-grid .ptl-btn-enviar-avanzar { min-width:215px }: el botón verde grande de fase 03 vive FUERA de .ptl-na-right, así que la regla global de min-width 215px no le llegaba y se veía más estrecho que los botones de las demás fases. Ahora sí. Acompaña a presupuestos.cjs v17.69 que elimina el bloque CSS migrado y simplifica btnRetrocederHtml quitando el botón ⏰ apilado.)
// Build: 2026-05-19 v1.12 (Sobre v1.11: NUEVA regla global ::placeholder. Antes los placeholders ("Nombre y apellidos", "600 000 000", "(sin notas)", etc.) usaban el color por defecto del navegador (~#757575 en Chrome), que parece contenido real y hacía que Guille se saltase campos por rellenar. Ahora: color:#D1D5DB (gris muy claro), opacity:1 (anula la opacidad reducida que aplica Firefox por defecto), font-style:italic. Aplicado a TODOS los <input> y <textarea> del programa de un solo plumazo, sin tocar HTML.)
// Build: 2026-05-19 v1.11 (Sobre v1.10: NUEVA variable CSS --ptl-card-gap (= 4px) declarada en :root. .ptl-card { margin-bottom } pasa de valor literal 4px a var(--ptl-card-gap). Próximos cambios al gap entre cajas se hacen en un solo sitio. Acompaña a documentacion.cjs v17.25 que elimina los 3 margin-top:12px hardcodeados de DATOS DOCUMENTACION (la cajita ahora respeta el gap global como el resto).)
// Build: 2026-05-19 v1.10 (Sobre v1.9: AÑADIDAS 7 clases utilitarias nuevas para unificar estilos inline repetidos en presupuestos.cjs y documentacion.cjs. Paso 1 de 3 de la unificación. Esta entrega NO sustituye ningún uso: solo añade las clases. Si nada se rompe (no debería: son clases nuevas sin uso), en los siguientes pasos sustituiremos los inline. Clases: .ptl-empty-msg ("Sin avisos", "(sin notas)"), .ptl-input-sm (input pequeño), .ptl-input-num (input numérico centrado), .ptl-label-mini (etiquetas uppercase tipo "NOTA SIMPLE"), .ptl-label-2nd (etiquetas secundarias normales), .ptl-error-msg (mensajes de error rojos), .ptl-hr-soft (separadores horizontales tenues).)
// Build: 2026-05-19 v1.9 (Sobre v1.8: reducción del gap vertical global entre cajas. .ptl-card { margin-bottom } pasa de 6px a 4px. Cambio menor pero afecta a todo el programa: ficha del expediente (DATOS CCPP / NOTAS / COMUNICACIONES / DATOS ECONÓMICOS / DATOS DOCUMENTACION / cajitas de fase), pantalla HOY y resto. Acompaña a presupuestos.cjs v17.68 que reduce los gap:14px específicos del layout del HOY a 4px.)
// Build: 2026-05-18 v1.8 (Sobre v1.7: .ptl-fila-badge-slot pierde su min-width:130px. Las filas sin badge ahora tienen el slot con ancho 0 (no reservan espacio); las filas con badge tienen el slot al ancho natural del badge. Como el timeline es flex:1 con justify-content:flex-end, sus puntos van pegados a la derecha tanto si hay badge como si no, así que la alineación vertical entre filas se mantiene. El badge "💶 Cobrada" queda pegado al inicio del timeline. Acompaña a presupuestos.cjs v17.47 que elimina el spacer flex:1 introducido erróneamente en v17.46.)
// Build: 2026-05-18 v1.7 (Sobre v1.6: REVERSIÓN de los cambios de las 3 versiones anteriores (1.4, 1.5, 1.6) que intentaban realinear timelines y rompieron la ventanita de cada fila. Vuelve al CSS que funcionaba bien en v1.3: (1) .ptl-fila-info recupera max-width:26% (no width fijo). (2) .ptl-fila-importe recupera min-width:70px. (3) .ptl-fila .ptl-timeline recupera flex:1 con justify-content:flex-end (el timeline ocupa todo el hueco entre info y badge-slot, y los puntos van pegados a la derecha del timeline). El badge-slot mantiene su min-width:130px (regla añadida en v1.3 para que las filas sin badge mantengan alineación con las filas que sí lo tienen). Acompaña a presupuestos.cjs v17.45 que mueve el slot del badge ANTES del timeline en el HTML, para que cuando aparezca "💶 Cobrada" quede a la izquierda del timeline (donde antes -hasta v17.22- estaban los badges 👍/⚠️/👎).)
// Build: 2026-05-18 v1.6 (Sobre v1.5: .ptl-fila-info pasa de max-width:26% a width:280px fijo. El problema en v1.5 era que con max-width:26% cada fila tenía un ancho de la columna izquierda (dirección) distinto según la longitud real del texto y el ancho de ventana, así que el resto de la fila se desplazaba fila a fila y los timelines no quedaban alineados verticalmente. Con un width fijo de 280px (suficiente para "Nuestra Señora de la Oliva 67" que es la más larga) todas las filas tienen exactamente la misma geometría: 280px info + spacer elástico + 130px badge-slot + timeline ancho-natural + 110px importe. Resultado: los timelines quedan alineados verticalmente entre todas las filas, independientemente de la dirección y de si tienen badge "💶 Cobrada" o no. Sin otros cambios.)
// Build: 2026-05-18 v1.5 (Sobre v1.4: .ptl-fila-importe min-width pasa de 70px a 110px. Con 70px, los importes reales (hasta ~95px para "46.306,78 €") empujaban hacia la izquierda y, como el timeline está pegado al importe, el final del timeline se movía fila a fila desalineando todo. Con 110px todos los importes caben holgados (hasta "999.999,99 €") y el borde izquierdo del importe queda fijo, lo que mantiene el final del timeline alineado verticalmente entre todas las filas. Sin otros cambios.)
// Build: 2026-05-18 v1.4 (Sobre v1.3: corrección de alineación en el listado /presupuestos. (1) .ptl-fila .ptl-timeline pasa de flex:1 a flex:0 0 auto: el timeline ya no se estira para ocupar todo el hueco entre la columna de dirección y el badge/importe, sino que tiene su ancho natural (el que necesita para mostrar las 8 fases). Esto consigue que TODAS las filas tengan el timeline con la misma anchura y queden visualmente alineadas por la derecha, pegados al importe. (2) Acompaña al cambio en presupuestos.cjs v17.44 que (a) mueve el slot del badge ANTES del timeline en el HTML para que el badge "💶 Cobrada" aparezca a la izquierda del timeline (donde antes -hasta v17.22- estaban los badges 👍/⚠️/👎 según la captura de Guille), y (b) añade un spacer elástico tras .ptl-fila-info para empujar timeline+badge+importe a la derecha.)
// Build: 2026-05-17 v1.3 (Sobre v1.2: nueva regla CSS .ptl-fila-badge-slot (min-width:130px, flex:0 0 auto, justify-content:flex-end). Es el slot que en el listado /presupuestos acomoda el badge "💶 Cobrada DD-MM-AA" en las CCPP de fase 09_TRAMITADA con fecha_cobro. Se renderiza SIEMPRE (vacío o con badge) para que las líneas de fases queden alineadas entre todas las filas del listado. Acompaña a presupuestos.cjs v17.43.)
// Build: 2026-05-17 v1.2 (Reducción de altura de la cabecera de listado (.ptl-lista-header y sus hijos): paddings verticales y gaps más compactos para que la barra de filtros ocupe menos espacio vertical. Cambios: .ptl-filtros gap 4->3, .ptl-filtros-fases .ptl-filtro padding 3px 6px -> 2px 6px, .ptl-filtro padding 3px 7px -> 2px 7px, .ptl-search-input padding vertical 7px -> 4px y font 13 -> 12, .ptl-btn-orden añade padding vertical 3px y font 12 -> 11.5, .ptl-lista-header padding 2px 0 4px -> 1px 0 2px y gap 3 -> 2. Afecta a las pantallas /presupuestos (HOY y listado), /presupuestos/expediente y /documentacion/expediente (donde se acaba de añadir la cabecera).)
// Build: 2026-05-17 v1.1 (Añadida clase .ptl-filtro-en-tramite (amarillo) para el botón "En trámite" del HOY y del listado, distinta del azul lavanda de .ptl-filtro-tramite.)
// Estilo visual compartido por los módulos de la app: presupuestos, documentación, ejecución.
// Centraliza variables de color, tipografía, layouts y componentes UI reutilizables.
//
// Uso:
//   const { getThemeCss } = require('./estilo-visual.cjs');
//   const html = `<style>${getThemeCss()} ${cssEspecificoDelModulo}</style>...`;
//
// Reglas:
//  - Aquí solo va lo que comparten todos los módulos.
//  - Si una clase es exclusiva de un módulo, se queda en ese módulo.
//  - Cuando dudemos, MEJOR mantenerla en el módulo. Más adelante migrar al estilo común
//    es trivial; sacar algo del estilo común porque "no aplica a todos" es más lioso.
//
// Mantenemos el prefijo `ptl-` por compatibilidad histórica aunque ahora sea común.

function getThemeCss() {
  return `
    /* ===== Reset y base ===== */
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);font-size:14px;line-height:1.5}
    a{text-decoration:none;color:inherit}

    /* ===== Variables de color (paleta global) ===== */
    :root{
      /* ===========================================================
         v1.18 — SISTEMA DE COLOR: SOLO DOS AZULES (decisión Guille).
         Toda la identidad azul del programa sale de estas dos variables.
         Regla de uso:
           · BOTONES  -> fondo AZUL CLARO  + texto AZUL OSCURO
           · VENTANAS -> fondo AZUL OSCURO + texto AZUL CLARO
         Si hay que retocar el tono, se hace SOLO aquí.
         =========================================================== */
      --ptl-azul-oscuro:#004079;   /* RGB(0,64,121) — antes --ptl-brand */
      --ptl-azul-claro:#B4DCFF;    /* RGB(180,220,255) — antes el celeste de las ventanas */
      /* v1.25 — Color de la fila ALTERNA (zebra) de todas las listas/tablas.
         Variable propia (hoy = azul claro) para poder cambiarla en un solo sitio
         sin tocar el azul claro general de las ventanas. */
      --ptl-zebra:#B4DCFF;
      /* Compatibilidad: las variables antiguas siguen existiendo pero
         APUNTAN a los dos azules canónicos, para que todo el CSS que ya
         usa var(--ptl-brand)/var(--ptl-brand-light) herede el nuevo sistema
         sin reescribir cada regla. brand=oscuro, brand-light=claro. */
      --ptl-brand:var(--ptl-azul-oscuro);
      --ptl-brand-light:var(--ptl-azul-claro);
      --ptl-brand-dark:var(--ptl-azul-oscuro);
      /* v1.25 — UNIFICACIÓN de las 3 familias de color a un TRÍO cada una:
         fuerte (fondo/borde) + light (fondo suave) + dark (texto sobre el suave).
         Todos los tonos sueltos a pelo del programa pasan a usar estas. */
      --ptl-success:#10B981;--ptl-success-light:#D1FAE5;--ptl-success-dark:#065F46;
      --ptl-warning:#F59E0B;--ptl-warning-light:#FEF3C7;--ptl-warning-dark:#92400E;
      --ptl-danger:#EF4444;--ptl-danger-light:#FEE2E2;--ptl-danger-dark:#991B1B;
      --ptl-gray-50:#F9FAFB;--ptl-gray-100:#F3F4F6;--ptl-gray-200:#E5E7EB;--ptl-gray-300:#D1D5DB;
      --ptl-gray-400:#9CA3AF;--ptl-gray-500:#6B7280;--ptl-gray-700:#374151;--ptl-gray-800:#1F2937;--ptl-gray-900:#111827;
      /* v1.11 — Variable única para el gap vertical entre cajas (.ptl-card). */
      --ptl-card-gap:4px;
    }

    /* v1.12 — Placeholder global. Gris muy claro + itálica para que NO se
       confunda con contenido real. Aplica a todos los <input> y <textarea>
       del programa. opacity:1 anula la opacidad reducida que Firefox aplica
       por defecto a sus placeholders. */
    input::placeholder,
    textarea::placeholder{
      color:var(--ptl-gray-300);
      opacity:1;
      font-style:italic;
    }

    /* ===== Navegación superior ===== */
    .ptl-nav{position:sticky;top:0;background:var(--ptl-azul-oscuro);border-bottom:1px solid var(--ptl-azul-claro);padding:8px 20px;display:flex;align-items:center;gap:14px;z-index:200;height:60px}
    .ptl-nav-brand{display:flex;align-items:center;gap:10px;flex:1}
    .ptl-logo{width:34px;height:34px;border-radius:8px;background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
    .ptl-nav-text{display:flex;flex-direction:column;line-height:1.2}
    .ptl-nav-text strong{font-size:14px;color:var(--ptl-azul-claro)}
    .ptl-nav-text span{font-size:11px;color:var(--ptl-azul-claro)}

    /* ===== Estructura de página ===== */
    .ptl-page{max-width:1200px;margin:0 auto;padding:2px 20px}
    .ptl-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ptl-azul-claro);margin-bottom:8px;flex-wrap:wrap}
    .ptl-breadcrumb a{color:var(--ptl-azul-claro)}
    .ptl-breadcrumb a:hover{text-decoration:underline}
    .ptl-breadcrumb .ptl-sep{color:var(--ptl-azul-claro)}
    .ptl-breadcrumb > span:last-child{font-size:16px;font-weight:600;color:var(--ptl-azul-claro)}

    /* ===== Cards ===== */
    /* v1.19 — Fondo de TODAS las cajas en azul oscuro + texto base azul claro
       (decisión Guille). Excepciones que conservan su color (no heredan el claro):
       inputs/textarea (siguen blancos), badges/pills de color de estado, la lista
       blanca interior de HOY y sus filas grises. Se pulirá pantalla por pantalla
       lo que quede con bajo contraste. */
    .ptl-card{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05);border:1px solid var(--ptl-azul-claro);margin-bottom:var(--ptl-card-gap)}
    /* La cabecera, al ir ya sobre fondo oscuro, no necesita su propio fondo: se
       integra. Mantiene texto claro y el separador inferior para marcarse. */
    .ptl-card-title{font-size:10px;font-weight:700;background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);text-transform:uppercase;letter-spacing:.7px;margin:-8px -12px 6px -12px;padding:6px 12px;border-radius:10px 10px 0 0}
    /* v1.20 — Cuando el título comparte fila con otros elementos (pill, botón
       "+ Añadir piso", etc.) va dentro de .ptl-card-title-row. En ese caso es la
       FILA ENTERA la que se convierte en barra de cabecera oscura (de borde a
       borde), y el título interior pierde su fondo/margen propios para no pintar
       una barra dentro de otra. Así toda la franja queda azul oscuro. */
    .ptl-card-title-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);margin:-8px -12px 6px -12px;padding:6px 12px;border-radius:10px 10px 0 0}
    .ptl-card-title-row .ptl-card-title{background:transparent;margin:0;padding:0;border-bottom:none;border-radius:0}
    /* Inputs/areas dentro de cajas: fuerzan texto oscuro sobre su fondo blanco. */
    .ptl-card input,.ptl-card textarea,.ptl-card select{color:var(--ptl-gray-900)}
    /* v1.29 — Altura uniforme de TODOS los campos de texto/select dentro de las
       cajas (DATOS CCPP, Comunicaciones, etc.), independientemente de su padding
       inline. Los textarea quedan exentos (pueden crecer). */
    .ptl-card input:not([type=checkbox]):not([type=radio]),.ptl-card select{height:26px;box-sizing:border-box}
    /* v1.20 — Las listas con fondo BLANCO propio (Mails Pendientes, Expedientes
       HOY y las mini-listas de fase) NO heredan el texto azul claro de la caja:
       su contenido va en NEGRO, como antes del fondo oscuro. Regla unificada:
       texto sobre claro = negro. */
    .hoy-mails-list,.hoy-exp-list,.ptl-lista-filas{color:var(--ptl-gray-900)}
    .hoy-mails-list a,.hoy-exp-list a{color:var(--ptl-gray-900)}

    /* v1.18 — Check "visto hoy" de la caja Expedientes HOY: cuadro BLANCO con
       borde, y al marcarlo un TICK NEGRO dibujado (decisión Guille: blanco con
       check negro, lo contrario del relleno por defecto del navegador). */
    .hoy-exp-visto{
      flex:0 0 auto;width:15px;height:15px;margin:0;cursor:pointer;
      -webkit-appearance:none;appearance:none;
      background:#fff;border:1.5px solid var(--ptl-gray-400);border-radius:3px;
      position:relative;
    }
    .hoy-exp-visto:checked{background:#fff;border-color:var(--ptl-gray-700)}
    .hoy-exp-visto:checked::after{
      content:"";position:absolute;left:4px;top:1px;width:4px;height:8px;
      border:solid #111827;border-width:0 2px 2px 0;transform:rotate(45deg);
    }
    .ptl-empty{text-align:center;padding:50px 20px;color:var(--ptl-gray-500)}
    .ptl-empty h3{color:var(--ptl-gray-700);font-size:17px;margin-bottom:6px}

    /* ===== Filtros ===== */
    .ptl-filtros{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:0;justify-content:flex-start}
    .ptl-filtros-rapidos{margin-bottom:0}
    .ptl-filtros-fases{flex-wrap:nowrap;gap:3px;overflow-x:auto;scrollbar-width:thin}
    .ptl-filtros-fases .ptl-filtro{flex-shrink:0;padding:2px 6px;font-size:10px}
    .ptl-filtro{padding:2px 7px;border-radius:14px;border:1.5px solid var(--ptl-azul-oscuro);background:var(--ptl-azul-claro);font-size:10.5px;font-weight:500;color:var(--ptl-azul-oscuro);transition:all .15s;white-space:nowrap}
    .ptl-filtro:hover,.ptl-filtro.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    .ptl-filtro-nuevo{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);font-weight:600}
    .ptl-filtro-nuevo:hover{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    .ptl-filtro.ptl-filtro-hoy{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-hoy:hover,.ptl-filtro.ptl-filtro-hoy.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-filtro-tramite{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);font-weight:600}
    .ptl-filtro.ptl-filtro-tramite:hover,.ptl-filtro.ptl-filtro-tramite.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    .ptl-filtro.ptl-filtro-en-tramite{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-en-tramite:hover,.ptl-filtro.ptl-filtro-en-tramite.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-fase-activa{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro)}
    .ptl-filtro.ptl-fase-activa:hover,.ptl-filtro.ptl-fase-activa.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    .ptl-filtro.ptl-fase-zz{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border-color:var(--ptl-danger)}
    .ptl-filtro.ptl-fase-zz:hover,.ptl-filtro.ptl-fase-zz.on{background:var(--ptl-danger);border-color:var(--ptl-danger);color:white}
    .ptl-filtro.ptl-fase-tramitada{background:var(--ptl-success-light);color:var(--ptl-success-dark);border-color:var(--ptl-success)}
    .ptl-filtro.ptl-fase-tramitada:hover,.ptl-filtro.ptl-fase-tramitada.on{background:var(--ptl-success);border-color:var(--ptl-success);color:white}

    /* ===== Búsqueda y orden ===== */
    .ptl-search-wrap{position:relative;flex:1}
    .ptl-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ptl-gray-400);font-size:13px}
    .ptl-search-input{width:100%;padding:4px 12px 4px 32px;border:1.5px solid var(--ptl-gray-200);border-radius:8px;font-size:12px;outline:none;background:white;font-family:inherit}
    .ptl-search-input:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-btn-orden{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-oscuro);border-radius:8px;padding:3px 12px;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .ptl-btn-orden:hover{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    /* v1.28 — Variantes de color del botón de cabecera (mismo formato que
       .ptl-btn-orden, distinta familia). Todas se INVIERTEN al hover, borde incl. */
    .ptl-btn-orden.ptl-btn-orden-verde{background:var(--ptl-success-light);color:var(--ptl-success-dark);border-color:var(--ptl-success)}
    .ptl-btn-orden.ptl-btn-orden-verde:hover{background:var(--ptl-success);color:white;border-color:var(--ptl-success-dark)}
    .ptl-btn-orden.ptl-btn-orden-ambar{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning)}
    .ptl-btn-orden.ptl-btn-orden-ambar:hover{background:var(--ptl-warning);color:white;border-color:var(--ptl-warning-dark)}
    .ptl-btn-orden.ptl-btn-orden-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border-color:var(--ptl-danger)}
    .ptl-btn-orden.ptl-btn-orden-rojo:hover{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger-dark)}

    /* ===== Cabecera de listado ===== */
    .ptl-lista-header{position:sticky;top:60px;z-index:100;background:var(--ptl-azul-oscuro);padding:1px 0 2px;margin-bottom:4px;border-bottom:1px solid var(--ptl-azul-claro);display:flex;flex-direction:column;gap:2px}

    /* ===== Filas de lista ===== */
    .ptl-fila{background:var(--ptl-azul-oscuro);border:1px solid var(--ptl-azul-claro);border-radius:8px;padding:3px 12px;margin-bottom:3px;display:flex;align-items:center;gap:0;color:var(--ptl-azul-claro);transition:all .15s;overflow:hidden}
    .ptl-fila:hover{border-color:var(--ptl-azul-claro);box-shadow:0 2px 6px rgba(180,220,255,.35);background:var(--ptl-azul-oscuro)}
    /* v1.41 — ancho FIJO 26% (antes 0 0 auto = ancho natural variable). Asi la
       columna de direccion siempre mide lo mismo y el badge (en .ptl-fila-badge-slot,
       que alinea a la derecha) arranca SIEMPRE en la misma x -> badges alineados por
       su borde derecho. NO es flex:1 (eso colapsaba a 0 y borraba direcciones en v1.39);
       es 0 0 26% = fijo. La direccion larga se trunca con ellipsis dentro de su 26%. */
    .ptl-fila-info{flex:0 0 120px;min-width:0;max-width:120px;display:flex;align-items:baseline;gap:6px;overflow:hidden;margin-right:10px}
    .ptl-fila-tipo{color:var(--ptl-azul-claro);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0}
    .ptl-fila-dir{font-size:13px;font-weight:600;color:var(--ptl-azul-claro);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-fila-importe{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptl-azul-claro);flex:0 0 100px;width:100px;text-align:right;padding-left:10px;padding-right:4px}
    .ptl-fila-badge-slot{flex:0 0 115px;min-width:0;display:flex;justify-content:flex-end;align-items:center;padding-right:0}
    .ptl-fila .ptl-timeline{flex:1 1 0;width:auto;min-width:0;justify-content:flex-end;padding:0;overflow:visible}
    .ptl-fila-badge{font-size:10px;font-weight:700;padding:2px 3px;border-radius:999px;flex-shrink:0;letter-spacing:.2px;line-height:1.2;white-space:nowrap}
    .ptl-fila-badge-decidir{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border:1px solid var(--ptl-warning-light)}
    .ptl-fila-badge-en-plazo{background:var(--ptl-success-light);color:var(--ptl-success-dark);border:1px solid var(--ptl-success-light)}
    .ptl-fila-badge-retrasado{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border:1px solid var(--ptl-danger-light)}
    .ptl-fila-badge-ejecucion{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border:1px solid var(--ptl-azul-claro)}

    /* ===== Timeline ===== */
    .ptl-timeline{display:flex;align-items:stretch;gap:0;padding:2px 0 1px;overflow:hidden;width:100%}
    .ptl-grupo{flex:1 1 auto;display:flex;flex-direction:column;padding:0 4px;min-width:0}
    .ptl-grupo-titulo{font-size:9px;font-weight:700;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:2px}
    /* En la ficha, los títulos de grupo (Presupuesto / Documentación) son más
       grandes y de color para destacar */
    .ptl-card .ptl-grupo-titulo{font-size:11px;color:var(--ptl-azul-claro);letter-spacing:1px;margin-bottom:6px}
    .ptl-puntos{display:flex;gap:0;padding:0 2px;justify-content:space-between;flex:1}
    .ptl-punto{display:flex;flex-direction:column;align-items:center;position:relative;flex:1 1 0;min-width:0}
    .ptl-punto:not(:last-child)::after{content:'';position:absolute;top:4px;right:-50%;width:100%;height:6px;background:#9CA3AF;z-index:0;border-radius:3px}
    .ptl-punto.completo:not(:last-child)::after{background:var(--ptl-success)}
    .ptl-punto.rechazado:not(:last-child)::after{background:var(--ptl-danger)}
    .ptl-circulo{width:10px;height:10px;border-radius:50%;background:#9CA3AF;border:2px solid #9CA3AF;z-index:1;position:relative}
    .ptl-punto.completo .ptl-circulo{background:var(--ptl-success);border-color:var(--ptl-success)}
    .ptl-punto.actual .ptl-circulo{background:var(--ptl-warning);border-color:var(--ptl-warning);box-shadow:0 0 0 3px rgba(245,158,11,.2);animation:ptlPulso 2s ease-in-out infinite}
    .ptl-punto.rechazado .ptl-circulo{background:var(--ptl-danger);border-color:var(--ptl-danger)}
    @keyframes ptlPulso{0%,100%{box-shadow:0 0 0 3px rgba(245,158,11,.2)}50%{box-shadow:0 0 0 6px rgba(245,158,11,.1)}}
    .ptl-label{font-size:8px;color:var(--ptl-gray-500);margin-top:3px;font-weight:500;text-align:center;line-height:1.1;white-space:nowrap}
    .ptl-fecha{font-size:9px;color:var(--ptl-gray-400);margin-top:0;font-variant-numeric:tabular-nums;text-align:center;line-height:1}
    /* En la ficha, el timeline va dentro de una card y hay más espacio: textos un punto más grandes */
    .ptl-card .ptl-label{font-size:10px}
    .ptl-card .ptl-fecha{font-size:10px}
    .ptl-punto.actual .ptl-label{color:var(--ptl-warning);font-weight:700}
    .ptl-punto.completo .ptl-label{color:var(--ptl-success);font-weight:600}
    .ptl-punto.rechazado .ptl-label{color:var(--ptl-danger);font-weight:700}
    /* v1.26 — La FECHA de cada punto del timeline toma el MISMO color que el
       nombre de su fase, según el estado (decisión Guille). */
    .ptl-punto.actual .ptl-fecha{color:var(--ptl-warning)}
    .ptl-punto.completo .ptl-fecha{color:var(--ptl-success)}
    .ptl-punto.rechazado .ptl-fecha{color:var(--ptl-danger)}
    .ptl-fila .ptl-grupo{padding:0 2px;flex:0 0 auto}
    .ptl-fila .ptl-grupo-titulo{display:none}
    .ptl-fila .ptl-puntos{padding:0;flex:0 0 auto;justify-content:flex-start}
    .ptl-fila .ptl-punto{flex:0 0 auto;min-width:60px}
    .ptl-fila .ptl-label,.ptl-fila .ptl-fecha{font-size:8px;line-height:1}

    /* ===== Autocomplete ===== */
    .ptl-ac-wrap{position:relative}
    .ptl-ac-list{position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--ptl-gray-200);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-height:240px;overflow-y:auto;z-index:50;display:none;margin-top:2px}
    .ptl-ac-list.show{display:block}
    .ptl-ac-item{padding:7px 12px;font-size:13px;color:var(--ptl-gray-700);cursor:pointer;border-bottom:1px solid var(--ptl-gray-100)}
    .ptl-ac-item:last-child{border-bottom:none}
    .ptl-ac-item:hover,.ptl-ac-item.active{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-ac-item mark{background:var(--ptl-warning-light);color:inherit;font-weight:700;padding:0;border-radius:2px}
    .ptl-ac-empty{padding:8px 12px;font-size:12px;color:var(--ptl-gray-400);font-style:italic}

    /* ===== Badges ===== */
    .ptl-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
    .ptl-badge-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-badge-amarillo{background:var(--ptl-warning-light);color:var(--ptl-warning)}
    .ptl-badge-naranja{background:var(--ptl-warning-light);color:var(--ptl-warning-dark)}
    .ptl-badge-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger)}
    .ptl-badge-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-badge-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-700)}

    /* ===== Botones genéricos ===== */
    .ptl-btn{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid transparent;font-family:inherit;transition:all .12s;display:inline-flex;align-items:center;gap:5px}
    .ptl-btn-sm{padding:4px 10px;font-size:11px}
    .ptl-btn-primary{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-oscuro)}
    .ptl-btn-primary:hover{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-color:var(--ptl-azul-claro)}
    .ptl-btn-success{background:var(--ptl-success);color:white;border-color:var(--ptl-success-dark)}
    .ptl-btn-success:hover{background:white;color:var(--ptl-success);border-color:var(--ptl-success)}
    /* v1.27 — Botón de PASO/avance de fase: verde claro + letra verde oscuro +
       borde verde (coherente con el resto de botones del sistema). */
    .ptl-btn-avanzar{background:var(--ptl-success-light);color:var(--ptl-success-dark);border:1.5px solid var(--ptl-success)}
    .ptl-btn-avanzar:hover{background:var(--ptl-success);color:white;border-color:var(--ptl-success)}
    .ptl-btn-danger{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger-dark)}
    .ptl-btn-danger:hover{background:white;color:var(--ptl-danger);border-color:var(--ptl-danger)}
    .ptl-btn-secondary{background:white;color:var(--ptl-gray-700);border-color:var(--ptl-gray-300)}

    /* ===== Barra de acciones (next-action) ===== */
    .ptl-next-action{background:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-claro);border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;min-height:60px;color:var(--ptl-azul-claro)}
    .ptl-next-action .ico{font-size:18px}
    .ptl-next-action .text{font-size:12px;font-weight:600;color:var(--ptl-azul-claro)}
    .ptl-next-action .sub{font-size:10.5px;font-weight:600;color:var(--ptl-azul-claro);margin-top:1px}
    .ptl-next-action.urgent{background:var(--ptl-danger-light);border-color:var(--ptl-danger-light)}
    .ptl-next-action.urgent .text{color:var(--ptl-danger)}
    .ptl-next-action.warn{background:var(--ptl-warning-light);border-color:var(--ptl-warning-light)}
    .ptl-next-action.warn .text{color:var(--ptl-warning)}
    /* Variante grid (3 zonas: izq texto / centro botón mail / der botones apilados).
       Altura UNIFICADA a 76px: cubre la fase más alta (04, con 3 botones apilados)
       para que TODAS las cintas midan lo mismo (las cortas, como la 09, suben a 76). */
    .ptl-next-action.ptl-next-action-grid{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:stretch;padding:2px 8px;gap:6px;min-width:0;margin-bottom:6px;flex-wrap:initial;min-height:76px}
    /* Variante 2 columnas: izq texto + der botón único grande */
    .ptl-next-action.ptl-next-action-grid.ptl-next-action-grid-2col{grid-template-columns:minmax(0,1fr) auto}
    .ptl-next-action-grid .ptl-na-left{display:flex;align-items:center;gap:8px;min-width:0;overflow:visible}
    .ptl-next-action-grid .ptl-na-left .text{overflow:visible;white-space:nowrap}
    .ptl-next-action-grid .ptl-na-right{display:flex;flex-direction:column;gap:2px;justify-content:stretch;align-items:flex-end}
    /* Mismo ancho global para TODOS los botones de la derecha (en cualquier fase).
       215px cabe el más largo: "→ Paso a 04-SEGUIMIENTO PTO". Texto pegado a la derecha. */
    .ptl-next-action-grid .ptl-na-right .ptl-btn{white-space:nowrap;padding:3px 10px;font-size:10.5px;min-width:215px;justify-content:flex-end;text-align:right}
    /* Botón único de fase 03: ocupa toda la altura de la barra (no se centra,
       se estira). El texto del botón sí se centra dentro. */
    .ptl-btn-enviar-avanzar{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;padding:3px 12px;gap:0;align-self:stretch;height:auto;white-space:normal;font-size:10.5px}
    .ptl-btn-enviar-avanzar .ln{display:block;font-size:10.5px;font-weight:600}
    /* v1.13: el botón verde grande de fase 03 vive FUERA de .ptl-na-right, así
       que necesita su propia regla de min-width para igualar al resto. */
    .ptl-next-action-grid .ptl-btn-enviar-avanzar{min-width:215px}
    /* Botones del bloque derecho con altura igualada a los de la izquierda (HOY/Atrás = 32px).
       Aplica en 01, 02, 05, 06, 07, 08, ZZ-RECHAZADO, ZZ-DESCARTADO.
       NO se aplica en 03 (un solo botón grande) ni en 04 (tres botones). */
    .ptl-na-igual-altura .ptl-btn{height:32px;padding-top:0;padding-bottom:0;display:inline-flex;align-items:center;justify-content:flex-end}
    /* Botón mail en 3 líneas: misma estética que ptl-btn-secondary pero altura ajustada a la columna */
    .ptl-btn-mail-3l{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;padding:2px 8px;gap:0;align-self:stretch;height:auto}
    .ptl-btn-mail-3l .ln{display:block;font-size:10.5px;font-weight:600}
    /* Mini-bloque "Fecha visita" (fase 02) y "Próximo mail" (fase 04): no son botones,
       tienen un input dentro */
    .ptl-mini-fecha{cursor:default;gap:2px;padding:3px 6px;min-width:120px;background:var(--ptl-azul-claro);border:1.5px solid var(--ptl-azul-oscuro);color:var(--ptl-azul-oscuro)}
    .ptl-mini-fecha:hover{background:var(--ptl-azul-claro)}
    .ptl-mini-fecha .ptl-label-mini{color:var(--ptl-azul-oscuro)}
    .ptl-mini-fecha input{cursor:text;color:var(--ptl-azul-oscuro)}

    /* ===== Form grid (12 columnas) ===== */
    .ptl-form-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px 6px}
    .ptl-form-grid input,.ptl-form-grid select,.ptl-form-grid textarea{width:100%;padding:4px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;outline:none;background:white;height:26px}
    .ptl-form-grid textarea{height:auto}
    .ptl-form-grid input:focus,.ptl-form-grid select:focus,.ptl-form-grid textarea:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-form-grid .col-1{grid-column:span 1}.ptl-form-grid .col-2{grid-column:span 2}.ptl-form-grid .col-3{grid-column:span 3}.ptl-form-grid .col-4{grid-column:span 4}.ptl-form-grid .col-5{grid-column:span 5}.ptl-form-grid .col-6{grid-column:span 6}.ptl-form-grid .col-7{grid-column:span 7}.ptl-form-grid .col-8{grid-column:span 8}.ptl-form-grid .col-9{grid-column:span 9}.ptl-form-grid .col-10{grid-column:span 10}.ptl-form-grid .col-11{grid-column:span 11}.ptl-form-grid .col-12{grid-column:span 12}
    .ptl-form-label{font-size:9px;font-weight:600;color:var(--ptl-azul-claro);text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px;display:block;line-height:1.2}
    .ptl-form-section-title{font-size:9px;font-weight:700;color:var(--ptl-azul-claro);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 2px;padding-bottom:1px}
    /* v1.32 — dentro de ventanas flotantes (.ptl-floating-window) el fondo es
       BLANCO, no azul oscuro. El azul claro de las etiquetas no contrasta y
       se lee fatal (caso modal "Enviar mail manual": DESTINATARIO, CC, CCO,
       ASUNTO, CUERPO DEL MENSAJE, ADJUNTOS se veían casi invisibles).
       Override para que en cualquier modal flotante actual o futuro las
       etiquetas .ptl-form-label y .ptl-form-section-title se vean en azul
       oscuro. Editable en este único sitio. */
    .ptl-floating-window .ptl-form-label,
    .ptl-floating-window .ptl-form-section-title{color:var(--ptl-azul-oscuro)}
    .ptl-form-grid input.calc-field{background:#E5E7EB;color:var(--ptl-gray-700);cursor:not-allowed;border-color:var(--ptl-gray-300);font-weight:600}
    .ptl-form-grid input[list]::-webkit-calendar-picker-indicator{opacity:.4}

    /* ===== Botón Deshacer ===== */
    .ptl-btn-undo{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .ptl-btn-undo:hover:not(:disabled){background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);color:var(--ptl-azul-claro)}
    .ptl-btn-undo:disabled{opacity:.4;cursor:not-allowed}

    /* ===== Tabla de vecinos (cajita en ficha CCPP) ===== */
    .ptl-vecinos-stats{display:flex;gap:6px;flex-wrap:wrap}
    .ptl-stat-pill{font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}
    .ptl-stat-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-stat-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-stat-naranja{background:var(--ptl-warning-light);color:var(--ptl-warning-dark)}
    .ptl-stat-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-700)}
    .ptl-stat-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger)}
    .ptl-tabla-vecinos{width:100%;border-collapse:collapse;font-size:12px}
    .ptl-tabla-vecinos thead th{background:var(--ptl-gray-50);color:var(--ptl-gray-500);font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:5px 8px;text-align:left;border-bottom:1px solid var(--ptl-gray-200);white-space:nowrap}
    .ptl-tabla-vecinos tbody td{padding:4px 8px;border-bottom:1px solid var(--ptl-gray-100);vertical-align:middle}
    .ptl-tabla-vecinos tbody tr:hover{background:var(--ptl-gray-50);cursor:pointer}
    .ptl-num-cell{font-variant-numeric:tabular-nums;color:var(--ptl-gray-700);white-space:nowrap}

    /* ===== Plantilla editable de vecinos (fase 05+) ===== */
    .ptl-vec-card{margin-top:8px}
    /* ===== Cabecera de la cajita: estilo igual a las demás ventanitas ===== */
    .ptl-vec-cabecera{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .ptl-vec-cabecera-derecha{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ptl-vec-total{color:var(--ptl-gray-500);font-weight:600;font-size:13px}
    /* Pill indicador a la derecha del título: "Faltan Y de X" o "✓ Completo" */
    .ptl-vec-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:.2px}
    .ptl-vec-pill-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger-dark)}
    .ptl-vec-pill-verde{background:var(--ptl-success-light);color:var(--ptl-success)}

    /* Toolbar — botones + Añadir piso y MANUAL/BOT */
    .ptl-vec-toolbar{display:flex;justify-content:flex-start;gap:8px;margin:6px 0}
    .ptl-vec-btn-modo{font-weight:700;letter-spacing:.5px}
    .ptl-vec-btn-modo-manual{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-vec-btn-modo-manual:hover{background:white;color:var(--ptl-danger);border-color:var(--ptl-danger)}
    .ptl-vec-btn-modo-bot{cursor:default;opacity:.95}
    .ptl-vec-btn-modo-bot:disabled{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-color:var(--ptl-azul-oscuro);opacity:.95}

    /* ===== Tabla ===== */
    .ptl-vec-tabla-wrap{border:1px solid var(--ptl-gray-100);border-radius:6px;overflow:hidden;background:white}
    .ptl-vec-tabla{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;color:var(--ptl-gray-900)}
    .ptl-vec-tabla thead th{background:var(--ptl-gray-50);color:var(--ptl-gray-500);font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:6px 8px;text-align:left;border-bottom:1px solid var(--ptl-gray-200);white-space:nowrap}
    /* Anchos calculados: vivienda da para "BAJO IZDA" (~10 chars en mayús),
       teléfono exacto para "XXX-XXX-XXX" (11 chars monoespacio),
       estado para "DOC. COMPLETA" badge,
       docs para "XX/XX" tag con padding,
       acciones para 3 botones de 28px + gaps,
       nombre = el resto. */
    .ptl-vec-th-vivienda{width:76px}
    .ptl-vec-th-nombre{width:auto}
    .ptl-vec-th-telefono{width:96px}
    .ptl-vec-th-estado{width:104px}
    .ptl-vec-th-docs{width:54px;text-align:center !important}
    .ptl-vec-th-acciones{width:92px}
    .ptl-vec-tabla tbody td{padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);vertical-align:middle;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
    .ptl-vec-fila{transition:background .12s}
    .ptl-vec-fila.ptl-vec-dirty{background:var(--ptl-warning-light)}
    .ptl-vec-fila.ptl-vec-dirty td{border-bottom-color:var(--ptl-warning-light)}
    /* Vecino con acordeón abierto: resaltado claro pero diferenciado */
    .ptl-vec-fila.ptl-vec-fila-expandida{background:var(--ptl-azul-claro);box-shadow:inset 4px 0 0 var(--ptl-brand)}
    .ptl-vec-fila.ptl-vec-fila-expandida td{border-bottom-color:var(--ptl-azul-claro)}
    .ptl-vec-fila.ptl-vec-nueva{background:var(--ptl-success-light)}
    .ptl-vec-input{width:100%;padding:1px 6px;border:1px solid transparent;background:transparent;border-radius:4px;font-size:12px;font-family:inherit;outline:none;text-overflow:ellipsis}
    .ptl-vec-input:hover{border-color:var(--ptl-gray-200);background:white}
    .ptl-vec-input:focus{border-color:var(--ptl-brand);background:white;box-shadow:0 0 0 2px rgba(79,70,229,.1)}
    .ptl-vec-vivienda{font-weight:600;font-variant-numeric:tabular-nums}
    .ptl-vec-telefono{font-variant-numeric:tabular-nums;color:var(--ptl-gray-700)}
    .ptl-vec-docs{text-align:center;font-variant-numeric:tabular-nums}
    .ptl-vec-docs-tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:.2px;font-variant-numeric:tabular-nums}
    .ptl-vec-docs-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger-dark)}
    .ptl-vec-docs-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-vec-docs-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-500)}
    .ptl-vec-estado{white-space:nowrap}
    .ptl-vec-acciones{text-align:right;white-space:nowrap}
    .ptl-vec-acciones .ptl-vec-btn{margin-left:4px;vertical-align:middle}
    .ptl-vec-acciones .ptl-vec-btn:first-child{margin-left:0}
    .ptl-vec-btn{width:24px;height:24px;border-radius:50%;border:1.5px solid transparent;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:all .12s;padding:0;background:white;font-family:inherit}
    .ptl-vec-btn-guardar{background:var(--ptl-danger);color:#FFFFFF;border:1.5px solid var(--ptl-azul-oscuro);font-weight:700}
    .ptl-vec-btn-guardar:hover:not(:disabled){background:var(--ptl-danger-dark);border-color:var(--ptl-danger);color:#FFFFFF}
    .ptl-vec-btn-guardar:disabled{background:var(--ptl-gray-100);color:var(--ptl-gray-400);border-color:var(--ptl-gray-200);cursor:default}
    .ptl-vec-btn-acordeon{background:var(--ptl-gray-100);color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}
    .ptl-vec-btn-acordeon:hover{background:var(--ptl-gray-200);color:var(--ptl-gray-900)}
    .ptl-vec-btn-borrar{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-vec-btn-borrar:hover{background:white;color:var(--ptl-danger);border-color:var(--ptl-danger)}
    .ptl-vec-empty{padding:24px;text-align:center;color:var(--ptl-gray-500);font-size:13px}

    /* ===== Acordeón documental — más compacto ===== */
    /* Resaltado del acordeón abierto, igual al de la fila: borde azul lateral + fondo */
    .ptl-vec-acordeon-fila{background:var(--ptl-azul-claro);box-shadow:inset 4px 0 0 var(--ptl-brand)}
    .ptl-vec-acordeon-cont{padding:8px 14px}
    .ptl-vec-ac-cab.ptl-vec-ac-sinexp{padding:6px 0;display:flex;align-items:center;gap:10px;font-size:11px;border-bottom:1px solid var(--ptl-gray-100);margin-bottom:6px}
    .ptl-vec-ac-cab-info{color:var(--ptl-gray-500);font-style:italic}
    /* Lista de documentos: 3 columnas con LECTURA VERTICAL.
       column-count crea columnas que se rellenan de arriba a abajo,
       saltando a la siguiente columna al llegar al final, exactamente
       como leer en columnas de prensa. */
    .ptl-vec-doc-lista{column-count:3;column-gap:14px;padding:2px 0}
    .ptl-vec-doc-fila{display:flex;align-items:center;gap:6px;padding:0;margin:0;line-height:1.15;break-inside:avoid;page-break-inside:avoid}
    .ptl-vec-doc-btn{width:22px;height:22px;border-radius:50%;border:1.5px solid transparent;display:inline-flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:all .12s;padding:0;flex-shrink:0;font-family:inherit}
    .ptl-vec-doc-pendiente{background:var(--ptl-brand-light);color:var(--ptl-brand);border-color:var(--ptl-azul-claro)}
    .ptl-vec-doc-pendiente:hover{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-color:var(--ptl-azul-claro)}
    .ptl-vec-doc-recibido{background:var(--ptl-success-light);color:var(--ptl-success);border-color:var(--ptl-success-light)}
    .ptl-vec-doc-recibido:hover{background:var(--ptl-success);color:white;border-color:var(--ptl-success)}
    .ptl-vec-doc-recibido-sinarchivo{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning-light)}
    .ptl-vec-doc-recibido-sinarchivo:hover{background:var(--ptl-warning);color:white;border-color:var(--ptl-warning)}
    .ptl-vec-doc-noaplica{background:var(--ptl-gray-100);color:var(--ptl-gray-500);border-color:var(--ptl-gray-200)}
    .ptl-vec-doc-noaplica:hover{background:var(--ptl-gray-400);color:white;border-color:var(--ptl-gray-400)}
    .ptl-vec-doc-label{font-size:11px;color:var(--ptl-gray-700);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-vec-ac-aviso{margin-top:6px;padding:4px 8px;background:var(--ptl-warning-light);color:var(--ptl-warning);font-size:10px;border-radius:4px;font-style:italic}

    /* Menú emergente del botón redondo de cada documento */
    /* Menú emergente del botón redondo de cada documento.
       Usa position:fixed para que no lo recorte ningún overflow:hidden
       de los contenedores (la tabla, la celda, etc.). La posición se
       calcula en JavaScript en el momento de abrirlo. */
    .ptl-vec-doc-menu{position:fixed;background:white;border:1px solid var(--ptl-gray-200);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.12);z-index:9999;min-width:230px;padding:4px;display:flex;flex-direction:column;gap:2px}
    .ptl-vec-doc-menu-item{background:white;border:none;text-align:left;padding:6px 10px;font-size:12px;color:var(--ptl-gray-700);font-family:inherit;border-radius:4px;cursor:pointer}
    .ptl-vec-doc-menu-item:hover{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-vec-doc-menu-item-disabled{color:var(--ptl-gray-400);cursor:not-allowed;font-style:italic}
    .ptl-vec-doc-menu-item-disabled:hover{background:white;color:var(--ptl-gray-400)}

    /* ========================================================
       LISTA DE FILAS — estilo común a cajitas tipo lista.
       Usar en: cajitas con filas que se leen una debajo de otra
       (Mails pendientes, Decidir, Adjuntos rotos, Comunicaciones
       del expediente, las cajitas 05/08 de HOY, etc.).
       ======================================================== */
    .ptl-lista-filas{
      border-radius:5px;
      background:#fff;
      overflow:hidden;
      font-size:11px;
      line-height:1.1;
      color:var(--ptl-gray-700);
    }
    /* Cada fila */
    .ptl-lista-filas .ptl-lista-fila{
      padding:0 6px;
      border-bottom:1px solid var(--ptl-gray-100);
      min-height:22px;
      display:flex;
      align-items:center;
      gap:8px;
    }
    .ptl-lista-filas .ptl-lista-fila:last-child{
      border-bottom:none;
    }
    /* Filas alternas: blanco / zebra */
    .ptl-lista-filas .ptl-lista-fila:nth-child(even){
      background:var(--ptl-zebra);
    }
    .ptl-lista-filas .ptl-lista-fila:nth-child(odd){
      background:#FFFFFF;
    }
    /* Enlaces dentro de cada fila */
    .ptl-lista-filas .ptl-lista-fila a{
      color:var(--ptl-gray-700);
      text-decoration:none;
    }
    .ptl-lista-filas .ptl-lista-fila a:hover{
      color:#000;
      font-weight:700;
    }

    /* ============================================================
       v1.10 — Clases utilitarias unificadas.
       Sustituyen estilos inline repetidos en presupuestos.cjs y
       documentacion.cjs. La migración se hace por fases en los
       siguientes builds. NO USAR todavía en código nuevo: en cuanto
       el paso 2/3 esté completo, este bloque será la única fuente
       de verdad para estos elementos.
       ============================================================ */

    /* Mensaje vacío tipo "Sin avisos", "(sin notas)", "(sin datos)" */
    .ptl-empty-msg{
      padding:8px 4px;
      color:var(--ptl-gray-500);
      font-size:12px;
      font-style:italic;
    }

    /* Input pequeño estándar (texto, búsqueda inline, etc.) */
    .ptl-input-sm{
      padding:2px 5px;
      border:1px solid var(--ptl-gray-200);
      border-radius:4px;
      font-size:12px;
      font-family:inherit;
      background:white;
    }
    /* v1.29 — Input estándar del modal de Comunicaciones (sustituye un style
       inline que estaba repetido ~15 veces). Altura uniforme con el resto. */
    .ptl-input-modal{
      width:100%;
      padding:4px 8px;
      border:1.5px solid var(--ptl-gray-200);
      border-radius:5px;
      font-family:inherit;
      font-size:12px;
      height:26px;
      box-sizing:border-box;
      background:white;
    }

    /* Input numérico centrado (cantidades, contadores) */
    .ptl-input-num{
      width:100%;
      padding:1px 4px;
      border:1px solid var(--ptl-gray-200);
      border-radius:4px;
      font-size:11px;
      font-family:inherit;
      background:white;
      text-align:center;
    }

    /* Etiqueta uppercase pequeña tipo "NOTA SIMPLE", "TIPO VÍA" */
    .ptl-label-mini{
      font-size:9px;
      color:var(--ptl-azul-claro);
      text-transform:uppercase;
      letter-spacing:.4px;
      font-weight:700;
    }

    /* Etiqueta secundaria normal (12px gris) */
    .ptl-label-2nd{
      display:block;
      font-size:12px;
      color:#6b7280;
      margin-bottom:3px;
    }

    /* Mensaje de error en rojo (validación, conflicto) */
    .ptl-error-msg{
      padding:8px;
      color:var(--ptl-danger);
      font-size:12px;
    }

    /* Separador horizontal tenue dentro de cajas. Vive sobre el fondo BLANCO de
       las cajitas de DATOS ECONÓMICOS, así que se mantiene gris (se ve bien). */
    .ptl-hr-soft{
      flex:1;
      height:1px;
      background:var(--ptl-gray-300);
      align-self:center;
    }

    /* ===== Ventana flotante arrastrable (estilo Windows) =====
       v1.14: clases compartidas por todos los modales-ventana del programa.
       Uso:
         <div class="ptl-floating-wrapper">    ← wrapper invisible (display:none/block)
           <div class="ptl-floating-window">   ← la caja con position:fixed
             <div class="ptl-floating-title">  ← cabecera arrastrable (cursor:move)
               <span class="ptl-floating-title-text">📧 Título</span>
               <button class="ptl-floating-close">✕</button>
             </div>
             <div class="ptl-floating-body">   ← scroll interno
               ...contenido...
             </div>
           </div>
         </div>
       El JS calcula top/left iniciales (centrado) y monta drag&drop sobre
       .ptl-floating-title (excepto cuando se clica en .ptl-floating-close).
    */
    .ptl-floating-wrapper{display:none}
    .ptl-floating-window{position:fixed;background:#fff;border-radius:8px;max-width:94vw;max-height:90vh;box-shadow:0 8px 32px rgba(0,0,0,0.35);z-index:9999;display:flex;flex-direction:column;overflow:hidden}
    .ptl-floating-title{background:var(--ptl-gray-100);border-bottom:1px solid var(--ptl-gray-200);padding:8px 12px;display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none}
    .ptl-floating-title-text{font-size:14px;font-weight:600}
    .ptl-floating-close{background:transparent;border:none;font-size:18px;line-height:1;cursor:pointer;padding:0 4px;color:var(--ptl-gray-500)}
    .ptl-floating-close:hover{color:var(--ptl-gray-900)}
    .ptl-floating-body{padding:14px 20px 20px 20px;overflow-y:auto;flex:1}

    /* v1.15 — Feedback de guardado por campo (compartido por presupuestos.cjs y
       documentacion.cjs). Se aplica al recuadro donde se escribe (input/textarea/select).
       OK: borde verde, lo quita el JS tras 5s. ERROR: borde rojo permanente hasta
       el siguiente guardado OK del mismo campo (lo quita el JS). !important para
       ganar a los border inline que llevan algunos campos. */
    .ptl-guardado-ok{border-color:var(--ptl-success) !important;background-color:var(--ptl-success-light) !important;box-shadow:0 0 0 2px var(--ptl-success-light)}
    .ptl-guardado-error{border-color:var(--ptl-danger) !important;background-color:var(--ptl-danger-light) !important;box-shadow:0 0 0 2px var(--ptl-danger-light)}
  `;
}

module.exports = { getThemeCss };
