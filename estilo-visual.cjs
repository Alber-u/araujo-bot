// estilo-visual.cjs
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
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F9FAFB;color:#111827;font-size:14px;line-height:1.5}
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
      /* Compatibilidad: las variables antiguas siguen existiendo pero
         APUNTAN a los dos azules canónicos, para que todo el CSS que ya
         usa var(--ptl-brand)/var(--ptl-brand-light) herede el nuevo sistema
         sin reescribir cada regla. brand=oscuro, brand-light=claro. */
      --ptl-brand:var(--ptl-azul-oscuro);
      --ptl-brand-light:var(--ptl-azul-claro);
      --ptl-brand-dark:var(--ptl-azul-oscuro);
      --ptl-success:#10B981;--ptl-success-light:#D1FAE5;
      --ptl-warning:#F59E0B;--ptl-warning-light:#FEF3C7;
      --ptl-danger:#EF4444;--ptl-danger-light:#FEE2E2;
      --ptl-gray-50:#F9FAFB;--ptl-gray-100:#F3F4F6;--ptl-gray-200:#E5E7EB;
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
      color:#D1D5DB;
      opacity:1;
      font-style:italic;
    }

    /* ===== Navegación superior ===== */
    .ptl-nav{position:sticky;top:0;background:white;border-bottom:1px solid var(--ptl-gray-200);padding:8px 20px;display:flex;align-items:center;gap:14px;z-index:200;height:60px}
    .ptl-nav-brand{display:flex;align-items:center;gap:10px;flex:1}
    .ptl-logo{width:34px;height:34px;border-radius:8px;background:var(--ptl-brand);color:white;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
    .ptl-nav-text{display:flex;flex-direction:column;line-height:1.2}
    .ptl-nav-text strong{font-size:14px;color:var(--ptl-gray-900)}
    .ptl-nav-text span{font-size:11px;color:var(--ptl-gray-500)}

    /* ===== Estructura de página ===== */
    .ptl-page{max-width:1200px;margin:0 auto;padding:2px 20px}
    .ptl-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ptl-gray-500);margin-bottom:8px;flex-wrap:wrap}
    .ptl-breadcrumb a{color:var(--ptl-brand)}
    .ptl-breadcrumb a:hover{text-decoration:underline}
    .ptl-breadcrumb .ptl-sep{color:#D1D5DB}
    .ptl-breadcrumb > span:last-child{font-size:16px;font-weight:600;color:var(--ptl-gray-900)}

    /* ===== Cards ===== */
    /* v1.19 — Fondo de TODAS las cajas en azul oscuro + texto base azul claro
       (decisión Guille). Excepciones que conservan su color (no heredan el claro):
       inputs/textarea (siguen blancos), badges/pills de color de estado, la lista
       blanca interior de HOY y sus filas grises. Se pulirá pantalla por pantalla
       lo que quede con bajo contraste. */
    .ptl-card{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05);border:1px solid var(--ptl-azul-oscuro);margin-bottom:var(--ptl-card-gap)}
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
    .ptl-filtro:hover,.ptl-filtro.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}
    .ptl-filtro-nuevo{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);font-weight:600}
    .ptl-filtro-nuevo:hover{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}
    .ptl-filtro.ptl-filtro-hoy{border-color:var(--ptl-warning);color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-hoy:hover,.ptl-filtro.ptl-filtro-hoy.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-filtro-tramite{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro);font-weight:600}
    .ptl-filtro.ptl-filtro-tramite:hover,.ptl-filtro.ptl-filtro-tramite.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:white}
    .ptl-filtro.ptl-filtro-en-tramite{background:#FEF3C7;color:#92400E;border-color:#FDE68A;font-weight:600}
    .ptl-filtro.ptl-filtro-en-tramite:hover,.ptl-filtro.ptl-filtro-en-tramite.on{background:#F59E0B;border-color:#F59E0B;color:white}
    .ptl-filtro.ptl-fase-activa{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-claro)}
    .ptl-filtro.ptl-fase-activa:hover,.ptl-filtro.ptl-fase-activa.on{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:white}
    .ptl-filtro.ptl-fase-zz{background:#FEF2F2;color:#DC2626;border-color:#FECACA}
    .ptl-filtro.ptl-fase-zz:hover,.ptl-filtro.ptl-fase-zz.on{background:#DC2626;border-color:#DC2626;color:white}
    .ptl-filtro.ptl-fase-tramitada{background:var(--ptl-success-light);color:var(--ptl-success);border-color:#A7F3D0}
    .ptl-filtro.ptl-fase-tramitada:hover,.ptl-filtro.ptl-fase-tramitada.on{background:var(--ptl-success);border-color:var(--ptl-success);color:white}

    /* ===== Búsqueda y orden ===== */
    .ptl-search-wrap{position:relative;flex:1}
    .ptl-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ptl-gray-400);font-size:13px}
    .ptl-search-input{width:100%;padding:4px 12px 4px 32px;border:1.5px solid var(--ptl-gray-200);border-radius:8px;font-size:12px;outline:none;background:white;font-family:inherit}
    .ptl-search-input:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-btn-orden{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-oscuro);border-radius:8px;padding:3px 12px;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .ptl-btn-orden:hover{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}

    /* ===== Cabecera de listado ===== */
    .ptl-lista-header{position:sticky;top:60px;z-index:100;background:var(--ptl-gray-50);padding:1px 0 2px;margin-bottom:4px;border-bottom:1px solid var(--ptl-gray-200);display:flex;flex-direction:column;gap:2px}

    /* ===== Filas de lista ===== */
    .ptl-fila{background:var(--ptl-azul-oscuro);border:1px solid var(--ptl-azul-oscuro);border-radius:8px;padding:3px 12px;margin-bottom:3px;display:flex;align-items:center;gap:8px;color:var(--ptl-azul-claro);transition:all .15s}
    .ptl-fila:hover{border-color:var(--ptl-azul-claro);box-shadow:0 2px 6px rgba(0,64,121,.25);background:var(--ptl-azul-oscuro)}
    .ptl-fila-info{flex:0 0 auto;min-width:0;max-width:26%;display:flex;align-items:baseline;gap:6px;overflow:hidden}
    .ptl-fila-tipo{color:var(--ptl-azul-claro);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0}
    .ptl-fila-dir{font-size:13px;font-weight:600;color:var(--ptl-azul-claro);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-fila-importe{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptl-azul-claro);flex-shrink:0;min-width:70px;text-align:right}
    .ptl-fila-badge-slot{flex:0 0 auto;display:flex;justify-content:flex-end;align-items:center}
    .ptl-fila .ptl-timeline{flex:1;min-width:0;justify-content:flex-end;padding:0;overflow:hidden}
    .ptl-fila-badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0;letter-spacing:.3px;line-height:1.2;white-space:nowrap}
    .ptl-fila-badge-decidir{background:#FEF3C7;color:#B45309;border:1px solid #FDE68A}
    .ptl-fila-badge-en-plazo{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0}
    .ptl-fila-badge-retrasado{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5}

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
    .ptl-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
    .ptl-badge-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-badge-amarillo{background:var(--ptl-warning-light);color:var(--ptl-warning)}
    .ptl-badge-naranja{background:#FED7AA;color:#C2410C}
    .ptl-badge-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger)}
    .ptl-badge-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-badge-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-700)}

    /* ===== Botones genéricos ===== */
    .ptl-btn{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid transparent;font-family:inherit;transition:all .12s;display:inline-flex;align-items:center;gap:5px}
    .ptl-btn-sm{padding:4px 10px;font-size:11px}
    .ptl-btn-primary{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-oscuro)}
    .ptl-btn-primary:hover{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}
    .ptl-btn-success{background:var(--ptl-success);color:white}
    .ptl-btn-danger{background:var(--ptl-danger);color:white}
    .ptl-btn-secondary{background:white;color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}

    /* ===== Barra de acciones (next-action) ===== */
    .ptl-next-action{background:var(--ptl-azul-oscuro);border:1.5px solid var(--ptl-azul-oscuro);border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;min-height:60px;color:var(--ptl-azul-claro)}
    .ptl-next-action .ico{font-size:18px}
    .ptl-next-action .text{font-size:12px;font-weight:600;color:var(--ptl-azul-claro)}
    .ptl-next-action .sub{font-size:11px;color:var(--ptl-azul-claro);margin-top:1px}
    .ptl-next-action.urgent{background:var(--ptl-danger-light);border-color:#FECACA}
    .ptl-next-action.urgent .text{color:var(--ptl-danger)}
    .ptl-next-action.warn{background:var(--ptl-warning-light);border-color:#FDE68A}
    .ptl-next-action.warn .text{color:var(--ptl-warning)}
    /* Variante grid (3 zonas: izq texto / centro botón mail / der botones apilados).
       Altura uniforme: 60px = altura del botón mail 3 líneas + padding/border. */
    .ptl-next-action.ptl-next-action-grid{background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:stretch;padding:2px 8px;gap:6px;min-width:0;margin-bottom:6px;flex-wrap:initial;min-height:60px}
    /* Variante 2 columnas: izq texto + der botón único grande */
    .ptl-next-action.ptl-next-action-grid.ptl-next-action-grid-2col{grid-template-columns:minmax(0,1fr) auto}
    .ptl-next-action-grid .ptl-na-left{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}
    .ptl-next-action-grid .ptl-na-left .text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
    .ptl-form-label{font-size:9px;font-weight:600;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px;display:block;line-height:1.2}
    .ptl-form-section-title{font-size:9px;font-weight:700;color:var(--ptl-gray-700);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 2px;padding-bottom:1px;border-bottom:1px solid var(--ptl-gray-100)}
    .ptl-form-grid input.calc-field{background:#E5E7EB;color:var(--ptl-gray-700);cursor:not-allowed;border-color:#D1D5DB;font-weight:600}
    .ptl-form-grid input[list]::-webkit-calendar-picker-indicator{opacity:.4}

    /* ===== Botón Deshacer ===== */
    .ptl-btn-undo{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .ptl-btn-undo:hover:not(:disabled){background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}
    .ptl-btn-undo:disabled{opacity:.4;cursor:not-allowed}

    /* ===== Tabla de vecinos (cajita en ficha CCPP) ===== */
    .ptl-vecinos-stats{display:flex;gap:6px;flex-wrap:wrap}
    .ptl-stat-pill{font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}
    .ptl-stat-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-stat-azul{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-stat-naranja{background:#FED7AA;color:#C2410C}
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
    .ptl-vec-pill-rojo{background:#FEE2E2;color:#991B1B}
    .ptl-vec-pill-verde{background:var(--ptl-success-light);color:var(--ptl-success)}

    /* Toolbar — botones + Añadir piso y MANUAL/BOT */
    .ptl-vec-toolbar{display:flex;justify-content:flex-start;gap:8px;margin:6px 0}
    .ptl-vec-btn-modo{font-weight:700;letter-spacing:.5px}
    .ptl-vec-btn-modo-manual{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-vec-btn-modo-manual:hover{background:#DC2626;border-color:#DC2626}
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
    .ptl-vec-fila.ptl-vec-dirty{background:#FFFBEB}
    .ptl-vec-fila.ptl-vec-dirty td{border-bottom-color:#FDE68A}
    /* Vecino con acordeón abierto: resaltado claro pero diferenciado */
    .ptl-vec-fila.ptl-vec-fila-expandida{background:var(--ptl-azul-claro);box-shadow:inset 4px 0 0 var(--ptl-brand)}
    .ptl-vec-fila.ptl-vec-fila-expandida td{border-bottom-color:var(--ptl-azul-claro)}
    .ptl-vec-fila.ptl-vec-nueva{background:#F0FDF4}
    .ptl-vec-input{width:100%;padding:1px 6px;border:1px solid transparent;background:transparent;border-radius:4px;font-size:12px;font-family:inherit;outline:none;text-overflow:ellipsis}
    .ptl-vec-input:hover{border-color:var(--ptl-gray-200);background:white}
    .ptl-vec-input:focus{border-color:var(--ptl-brand);background:white;box-shadow:0 0 0 2px rgba(79,70,229,.1)}
    .ptl-vec-vivienda{font-weight:600;font-variant-numeric:tabular-nums}
    .ptl-vec-telefono{font-variant-numeric:tabular-nums;color:var(--ptl-gray-700)}
    .ptl-vec-docs{text-align:center;font-variant-numeric:tabular-nums}
    .ptl-vec-docs-tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:.2px;font-variant-numeric:tabular-nums}
    .ptl-vec-docs-rojo{background:#FEE2E2;color:#991B1B}
    .ptl-vec-docs-verde{background:var(--ptl-success-light);color:var(--ptl-success)}
    .ptl-vec-docs-gris{background:var(--ptl-gray-100);color:var(--ptl-gray-500)}
    .ptl-vec-estado{white-space:nowrap}
    .ptl-vec-acciones{text-align:right;white-space:nowrap}
    .ptl-vec-acciones .ptl-vec-btn{margin-left:4px;vertical-align:middle}
    .ptl-vec-acciones .ptl-vec-btn:first-child{margin-left:0}
    .ptl-vec-btn{width:24px;height:24px;border-radius:50%;border:1.5px solid transparent;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:all .12s;padding:0;background:white;font-family:inherit}
    .ptl-vec-btn-guardar{background:var(--ptl-azul-claro);color:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro)}
    .ptl-vec-btn-guardar:hover:not(:disabled){background:var(--ptl-azul-oscuro);border-color:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro)}
    .ptl-vec-btn-guardar:disabled{background:var(--ptl-gray-100);color:var(--ptl-gray-400);border-color:var(--ptl-gray-200);cursor:default}
    .ptl-vec-btn-acordeon{background:var(--ptl-gray-100);color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}
    .ptl-vec-btn-acordeon:hover{background:var(--ptl-gray-200);color:var(--ptl-gray-900)}
    .ptl-vec-btn-borrar{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-vec-btn-borrar:hover{background:#DC2626;border-color:#DC2626}
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
    .ptl-vec-doc-pendiente:hover{background:var(--ptl-azul-oscuro);color:var(--ptl-azul-claro);border-color:var(--ptl-azul-oscuro)}
    .ptl-vec-doc-recibido{background:var(--ptl-success-light);color:var(--ptl-success);border-color:#A7F3D0}
    .ptl-vec-doc-recibido:hover{background:var(--ptl-success);color:white;border-color:var(--ptl-success)}
    .ptl-vec-doc-recibido-sinarchivo{background:#FEF3C7;color:#B45309;border-color:#FDE68A}
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
      border:1px solid var(--ptl-gray-200);
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
    /* Filas alternas: blanco / azul claro */
    .ptl-lista-filas .ptl-lista-fila:nth-child(even){
      background:#E0E2E6;
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
      color:var(--ptl-gray-500);
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
      color:#DC2626;
      font-size:12px;
    }

    /* Separador horizontal tenue dentro de cajas. Vive sobre el fondo BLANCO de
       las cajitas de DATOS ECONÓMICOS, así que se mantiene gris (se ve bien). */
    .ptl-hr-soft{
      flex:1;
      height:1px;
      background:#D1D5DB;
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
