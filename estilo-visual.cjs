// estilo-visual.cjs
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
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--ptl-general-1);color:var(--ptl-general-2);font-size:14px;line-height:1.5}
    a{text-decoration:none;color:inherit}

    /* ===== Variables de color (paleta global) ===== */
    :root{
      /* v1.66 — ALTURA ÚNICA de las celdas de entrada COMPACTAS (DATOS CCPP,
         DATOS ECONÓMICOS y demás formularios de ficha). Es el valor que ya tenía
         DATOS ECONÓMICOS (18px, fuente 11px). Cambiar este número cambia la
         altura de todos los campos compactos a la vez. */
      --ptl-input-h: 18px;
      /* ===========================================================
         IDENTIDAD — PALETA DE COLORES GENERAL (decision Guille).
         Categoria de identidad del programa (antes "FONDOS GENERALES";
         renombrada a "general" en v1.81 porque estos colores se usan tanto
         de fondo como de texto, no solo de fondo). Antes eran los "dos azules"
         (nombres viejos: ptl-azul-oscuro / ptl-azul-claro), renombrados en v1.79:
           - ptl-general-1  #004079   (azul oscuro: fondos y cabeceras oscuras)
           - ptl-general-2  = gris 300 (texto sobre oscuro, filas alternas, bordes)
           - ptl-general-3  = gris 200 (NUEVO v1.79; mismo grupo de identidad)
         Regla de uso (sin cambios):
           - BOTONES  -> fondo CLARO (general-2) + texto OSCURO (general-1)
           - VENTANAS -> fondo OSCURO (general-1) + texto CLARO (general-2)
         Si hay que retocar el tono, se hace SOLO aqui.
         =========================================================== */
      --ptl-general-1:#004079;             /* RGB(0,64,121). Nombre viejo: ptl-azul-oscuro / ptl-brand. */
      --ptl-general-2:var(--ptl-gray-300); /* nombre viejo: ptl-azul-claro (fue #cccccc, antes celeste #B4DCFF). Ahora dentro de la escala de grises. */
      --ptl-general-3:var(--ptl-gray-200); /* gris 200. Superficies neutras e inputs. (Hubo un test temporal en verde #00aa88ff v1.83-v1.85, ya revertido.) */
      --ptl-general-flotante:#fff;         /* v1.87 — superficie de VENTANAS FLOTANTES (modales/popups). Blanco a proposito, para que se "despeguen" del fondo. En la paleta para controlarlo desde aqui. */
      /* v1.76 — la variable --ptl-zebra se ELIMINA: las filas alternas (zebra)
         usan directamente var(--ptl-general-2). */
      /* Compatibilidad: los alias ptl-brand* siguen existiendo y ahora APUNTAN
         a los fondos generales, para no reescribir cada regla que usa
         var(--ptl-brand)/var(--ptl-brand-light). brand=general-1, brand-light=general-2. */
      --ptl-titulo:var(--ptl-general-2);   /* v1.93 - color unico de TODOS los titulos del programa (cabeceras de caja, secciones y columnas del panel bot, subtitulos). */
      --ptl-brand:var(--ptl-general-1);
      --ptl-brand-light:var(--ptl-general-2);
      --ptl-brand-dark:var(--ptl-general-1);
      /* v1.25 — UNIFICACIÓN de las 3 familias de color a un TRÍO cada una:
         fuerte (fondo/borde) + light (fondo suave) + dark (texto sobre el suave).
         Todos los tonos sueltos a pelo del programa pasan a usar estas. */
      --ptl-success:#10B981;--ptl-success-light:#D1FAE5;--ptl-success-dark:#065F46;
      --ptl-warning:#F59E0B;--ptl-warning-light:#FEF3C7;--ptl-warning-dark:#92400E;
      --ptl-danger:#EF4444;--ptl-danger-light:#FEE2E2;--ptl-danger-dark:#991B1B;
      --ptl-orange:#F97316;--ptl-orange-light:#ffcdaaff;--ptl-orange-dark:#9A3412;
      --ptl-gray-50:#F9FAFB;--ptl-gray-100:#F3F4F6;--ptl-gray-200:#E5E7EB;--ptl-gray-300:#D1D5DB;
      --ptl-gray-400:#9CA3AF;--ptl-gray-500:#6B7280;--ptl-gray-600:#4B5563;--ptl-gray-700:#374151;--ptl-gray-800:#1F2937;--ptl-gray-900:#111827;
      /* v1.11 — Variable única para el gap vertical entre cajas (.ptl-card). */
      --ptl-card-gap:5px;
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
    .ptl-nav{position:sticky;top:0;background:var(--ptl-general-1);border-bottom:1px solid var(--ptl-general-2);padding:8px 20px;display:flex;align-items:center;gap:14px;z-index:200;height:60px}
    .ptl-nav-brand{display:flex;align-items:center;gap:10px;flex:1}
    .ptl-logo{width:34px;height:34px;border-radius:8px;background:var(--ptl-general-2);color:var(--ptl-general-1);font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
    .ptl-nav-text{display:flex;flex-direction:column;line-height:1.2}
    .ptl-nav-text strong{font-size:14px;color:var(--ptl-general-2)}
    .ptl-nav-text span{font-size:11px;color:var(--ptl-general-2)}

    /* ===== Estructura de página ===== */
    .ptl-page{max-width:1200px;margin:0 auto;padding:2px 20px}
    .ptl-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ptl-general-2);margin-bottom:8px;flex-wrap:wrap}
    .ptl-breadcrumb a{color:var(--ptl-general-2)}
    .ptl-breadcrumb a:hover{text-decoration:underline}
    .ptl-breadcrumb .ptl-sep{color:var(--ptl-general-2)}
    .ptl-breadcrumb > span:last-child{font-size:16px;font-weight:600;color:var(--ptl-general-2)}

    /* ===== Cards ===== */
    /* v1.19 — Fondo de TODAS las cajas en azul oscuro + texto base azul claro
       (decisión Guille). Excepciones que conservan su color (no heredan el claro):
       inputs/textarea (siguen blancos), badges/pills de color de estado, la lista
       blanca interior de HOY y sus filas grises. Se pulirá pantalla por pantalla
       lo que quede con bajo contraste. */
    .ptl-card{background:var(--ptl-general-1);color:var(--ptl-general-2);border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05);border:1px solid var(--ptl-general-2);margin-bottom:var(--ptl-card-gap)}
    /* La cabecera, al ir ya sobre fondo oscuro, no necesita su propio fondo: se
       integra. Mantiene texto claro y el separador inferior para marcarse. */
    .ptl-card-title{font-size:10px;font-weight:700;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;letter-spacing:.7px;margin:-8px -12px 6px -12px;padding:6px 12px;border-radius:10px 10px 0 0}
    /* v1.20 — Cuando el título comparte fila con otros elementos (pill, botón
       "+ Añadir piso", etc.) va dentro de .ptl-card-title-row. En ese caso es la
       FILA ENTERA la que se convierte en barra de cabecera oscura (de borde a
       borde), y el título interior pierde su fondo/margen propios para no pintar
       una barra dentro de otra. Así toda la franja queda azul oscuro. */
    .ptl-card-title-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;background:var(--ptl-general-1);color:var(--ptl-general-2);margin:-8px -12px 6px -12px;padding:6px 12px;border-radius:10px 10px 0 0}
    .ptl-card-title-row .ptl-card-title{background:transparent;margin:0;padding:0;border-bottom:none;border-radius:0}
    /* Inputs/areas dentro de cajas: fuerzan texto oscuro sobre su fondo blanco. */
    .ptl-card input,.ptl-card textarea,.ptl-card select{color:var(--ptl-gray-900)}
    /* v1.66 — ALTURA ÚNICA de TODAS las celdas de entrada de datos del programa
       (inputs de texto/número/email/tel, select y textarea NO — los textarea
       crecen). Una sola fuente: la variable --ptl-input-h. Cambiar ese número
       cambia la altura de TODAS las celdas a la vez. Cubre: campos de ficha
       (.ptl-card, .ptl-form-grid, campo-*), modal (.ptl-input-modal), inputs
       pequeños/numéricos (.ptl-input-sm, .ptl-input-num), inputs de las tablas
       de doc/pisos (.ptl-vec-input) y la barra de búsqueda (.ptl-search-input).
       box-sizing:border-box para que el padding no sume. NO afecta a botones. */
    .ptl-card input:not([type=checkbox]):not([type=radio]),
    .ptl-card select,
    .ptl-form-grid input:not([type=checkbox]):not([type=radio]),
    .ptl-form-grid select,
    .ptl-input-modal,
    .ptl-input-sm,
    .ptl-input-num,
    .ptl-vec-input,
    .ptl-search-input{
      height:var(--ptl-input-h);
      box-sizing:border-box;
      background:var(--ptl-general-3);
    }
    /* Formato compacto de tipografía (fuente/padding pequeños) para las cajas de
       ficha marcadas como compactas. La ALTURA ya la da la regla maestra de
       arriba; aquí solo el tamaño de letra, padding y gaps. textarea exento. */
    .ptl-card-compact .ptl-form-grid{row-gap:4px;column-gap:8px}
    .ptl-card-compact .ptl-form-label{font-size:10px;margin-bottom:1px;line-height:1.1}
    .ptl-card-compact input:not([type=checkbox]):not([type=radio]),
    .ptl-card-compact select{
      font-size:11px;
      padding:0 6px;
      line-height:1.1;
    }
    .ptl-card textarea,.ptl-form-grid textarea,.ptl-card-compact textarea,textarea.ptl-input-modal,.ptl-textarea-grow{height:auto}
    /* v1.64 — Textarea que crece con el contenido (caja Notas de la ficha, misma
       nota_pto que en HOY). Altura mínima = la de una celda de entrada; crece por
       JS al escribir. */
    .ptl-textarea-grow{min-height:var(--ptl-input-h);line-height:1.3}
    /* v1.82 — Fondo de los campos de NOTA de las filas de HOY (CCPP y piso) a
       general-3 (gris 200). Excepcion intencional a "los inputs siguen blancos"
       (decision Guille sobre captura 31-05): estos textarea van gris 200, no blanco. */
    .hoy-exp-notas,.hoy-piso-notas{background:var(--ptl-general-3)}
    /* v1.88 — Flecha/caret de los acordeones. Antes el aspecto iba INLINE
       repetido en 5 spans (todos con class .ptl-acordeon-flecha). Mismo valor
       exacto, cero cambio visual. La rotacion la hace JS cambiando el caracter. */
    .ptl-acordeon-flecha{display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)}
    /* v1.89 — Cabecera (fila clicable) de los acordeones. Antes inline repetido
       en 5 sitios (todos con class .ptl-acordeon-cab). Mismo valor, cero cambio visual. */
    .ptl-acordeon-cab{display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0}
    /* v1.91: plantilla DESACTIVADA -> tarjeta plegada en ROJO para no perderla de vista (mail/doc/bot) */
    .ptl-acordeon-inactiva{border-color:var(--ptl-danger)}
    .ptl-acordeon-inactiva>.ptl-acordeon-cab{background:var(--ptl-danger-light)}
    /* v1.89 — Cajas economicas: separador de borde superior y hueco invisible
       de alineado de altura. Antes inline (separador x4; hueco x5 + helper). Cero cambio visual. */
    .ptl-caja-sep{margin-top:7px;padding-top:5px;border-top:1px solid var(--ptl-gray-300)}
    .ptl-hueco-extra{margin-top:2px;font-size:10px;line-height:1.3;visibility:hidden}
    /* v1.20 — Las listas con fondo BLANCO propio (Mails Pendientes, Expedientes
       HOY y las mini-listas de fase) NO heredan el texto azul claro de la caja:
       su contenido va en NEGRO, como antes del fondo oscuro. Regla unificada:
       texto sobre claro = negro. */
    .hoy-mails-list,.hoy-exp-list,.ptl-lista-filas{color:var(--ptl-gray-900)}
    .hoy-mails-list a,.hoy-exp-list a{color:var(--ptl-gray-900)}

    /* v1.18 — Check "visto hoy" de la caja Expedientes HOY: cuadro BLANCO con
       borde, y al marcarlo un TICK NEGRO dibujado (decisión Guille: blanco con
       check negro, lo contrario del relleno por defecto del navegador). */
    .hoy-exp-visto, .hoy-bot-llamado{
      flex:0 0 auto;width:15px;height:15px;margin:0;cursor:pointer;
      -webkit-appearance:none;appearance:none;
      background:#fff;border:1.5px solid var(--ptl-gray-400);border-radius:3px;
      position:relative;
    }
    .hoy-exp-visto:checked, .hoy-bot-llamado:checked{background:#fff;border-color:var(--ptl-gray-700)}
    .hoy-exp-visto:checked::after, .hoy-bot-llamado:checked::after{
      content:"";position:absolute;left:4px;top:1px;width:4px;height:8px;
      border:solid var(--ptl-gray-900);border-width:0 2px 2px 0;transform:rotate(45deg);
    }
    .ptl-empty{text-align:center;padding:50px 20px;color:var(--ptl-gray-500)}
    .ptl-empty h3{color:var(--ptl-gray-700);font-size:17px;margin-bottom:6px}

    /* ===== Filtros ===== */
    .ptl-filtros{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:0;justify-content:flex-start}
    .ptl-filtros-rapidos{margin-bottom:0}
    .ptl-filtros-fases{flex-wrap:nowrap;gap:3px;overflow-x:auto;scrollbar-width:thin}
    .ptl-filtros-fases .ptl-filtro{flex-shrink:0;padding:2px 6px;font-size:10px}
    .ptl-filtro{padding:2px 7px;border-radius:14px;border:1.5px solid var(--ptl-general-1);background:var(--ptl-general-2);font-size:10.5px;font-weight:500;color:var(--ptl-general-1);transition:all .15s;white-space:nowrap}
    .ptl-filtro:hover,.ptl-filtro.on{background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
    .ptl-filtro-nuevo{background:var(--ptl-general-2);color:var(--ptl-general-1);border-color:var(--ptl-general-1);font-weight:600}
    .ptl-filtro-nuevo:hover{background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
    .ptl-filtro.ptl-filtro-hoy{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-hoy:hover,.ptl-filtro.ptl-filtro-hoy.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-filtro-tramite{background:var(--ptl-general-2);color:var(--ptl-general-1);border-color:var(--ptl-general-1);font-weight:600}
    .ptl-filtro.ptl-filtro-tramite:hover,.ptl-filtro.ptl-filtro-tramite.on{background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
    .ptl-filtro.ptl-filtro-en-tramite{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-en-tramite:hover,.ptl-filtro.ptl-filtro-en-tramite.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-fase-activa{background:var(--ptl-general-2);color:var(--ptl-general-1);border-color:var(--ptl-general-1)}
    .ptl-filtro.ptl-fase-activa:hover,.ptl-filtro.ptl-fase-activa.on{background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
    .ptl-filtro.ptl-fase-zz{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border-color:var(--ptl-danger)}
    .ptl-filtro.ptl-fase-zz:hover,.ptl-filtro.ptl-fase-zz.on{background:var(--ptl-danger);border-color:var(--ptl-danger);color:white}
    .ptl-filtro.ptl-fase-tramitada{background:var(--ptl-success-light);color:var(--ptl-success-dark);border-color:var(--ptl-success)}
    .ptl-filtro.ptl-fase-tramitada:hover,.ptl-filtro.ptl-fase-tramitada.on{background:var(--ptl-success);border-color:var(--ptl-success);color:white}

    /* ===== Búsqueda y orden ===== */
    .ptl-search-wrap{position:relative;flex:1}
    .ptl-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ptl-gray-400);font-size:13px}
    .ptl-search-input{width:100%;padding:4px 12px 4px 32px;border:1.5px solid var(--ptl-gray-200);border-radius:8px;font-size:12px;outline:none;background:var(--ptl-general-3);font-family:inherit}
    .ptl-search-input:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-btn-orden{background:var(--ptl-general-2);color:var(--ptl-general-1);border:1.5px solid var(--ptl-general-1);border-radius:8px;padding:3px 12px;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .ptl-btn-orden:hover{background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
    /* v1.28 — Variantes de color del botón de cabecera (mismo formato que
       .ptl-btn-orden, distinta familia). Todas se INVIERTEN al hover, borde incl. */
    .ptl-btn-orden.ptl-btn-orden-verde{background:var(--ptl-success-light);color:var(--ptl-success-dark);border-color:var(--ptl-success)}
    .ptl-btn-orden.ptl-btn-orden-verde:hover{background:var(--ptl-success);color:white;border-color:var(--ptl-success-dark)}
    .ptl-btn-orden.ptl-btn-orden-ambar{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-color:var(--ptl-warning)}
    .ptl-btn-orden.ptl-btn-orden-ambar:hover{background:var(--ptl-warning);color:white;border-color:var(--ptl-warning-dark)}
    .ptl-btn-orden.ptl-btn-orden-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border-color:var(--ptl-danger)}
    .ptl-btn-orden.ptl-btn-orden-rojo:hover{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger-dark)}

    /* ===== Cabecera de listado ===== */
    .ptl-lista-header{position:sticky;top:60px;z-index:100;background:var(--ptl-general-1);padding:1px 0 2px;margin-bottom:4px;border-bottom:1px solid var(--ptl-general-2);display:flex;flex-direction:column;gap:2px}

    /* ===== Filas de lista ===== */
    .ptl-fila{background:var(--ptl-general-1);border:1px solid var(--ptl-general-2);border-radius:8px;padding:3px 12px;margin-bottom:3px;display:flex;align-items:center;gap:0;color:var(--ptl-general-2);transition:all .15s;overflow:hidden}
    .ptl-fila:hover{border-color:var(--ptl-general-2);box-shadow:0 2px 6px rgba(180,220,255,.35);background:var(--ptl-general-1)}
    /* v1.41 — ancho FIJO 26% (antes 0 0 auto = ancho natural variable). Asi la
       columna de direccion siempre mide lo mismo y el badge (en .ptl-fila-badge-slot,
       que alinea a la derecha) arranca SIEMPRE en la misma x -> badges alineados por
       su borde derecho. NO es flex:1 (eso colapsaba a 0 y borraba direcciones en v1.39);
       es 0 0 26% = fijo. La direccion larga se trunca con ellipsis dentro de su 26%. */
    .ptl-fila-info{flex:0 0 190px;min-width:0;max-width:190px;display:flex;align-items:baseline;gap:6px;overflow:hidden;margin-right:0}
    .ptl-fila-tipo{color:var(--ptl-general-2);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0}
    .ptl-fila-dir{font-size:13px;font-weight:600;color:var(--ptl-general-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-fila-importe{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptl-general-2);flex:0 0 65px;width:65px;text-align:right;padding-left:0;padding-right:0}
    .ptl-fila-badge-slot{flex:0 0 140px;width:140px;display:inline-block;text-align:center;min-width:0;padding-right:0}
    .ptl-fila .ptl-timeline{flex:1 1 0;width:auto;min-width:0;justify-content:flex-end;padding:0;overflow:visible}
    .ptl-fila-badge{font-size:10px;font-weight:700;padding:2px 3px;border-radius:999px;flex-shrink:0;letter-spacing:.2px;line-height:1.2;white-space:nowrap;box-sizing:border-box;width:140px;display:inline-block;text-align:center;overflow:hidden;text-overflow:ellipsis}
    .ptl-fila-badge-decidir{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border:1px solid var(--ptl-warning-light)}
    .ptl-fila-badge-en-plazo{background:var(--ptl-success-light);color:var(--ptl-success-dark);border:1px solid var(--ptl-success-light)}
    .ptl-fila-badge-retrasado{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border:1px solid var(--ptl-danger-light)}
    .ptl-fila-badge-ejecucion{background:var(--ptl-general-2);color:var(--ptl-general-1);border:1px solid var(--ptl-general-2)}
    /* v18.122 — colores de estado del badge de ultimátum (antes hardcodeados en presupuestos.cjs _COLB).
       Prefijo -ubadge- propio para NO colisionar con las .ptl-badge-* ya existentes. */
    .ptl-ubadge-verde{background:var(--ptl-success-light);color:var(--ptl-success-dark);border:1px solid #A7F3D0}
    .ptl-ubadge-ambar{background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border:1px solid #FDE68A}
    .ptl-ubadge-naranja{background:#FFE0B2;color:#E65100;border:1px solid #FFCC80}
    .ptl-ubadge-rojo{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border:1px solid #FECACA}
    .ptl-ubadge-gris{background:var(--ptl-gray-200);color:var(--ptl-gray-700);border:1px solid var(--ptl-gray-300)}
    /* v18.122 — colores de los BOTONES del ultimátum (antes hardcodeados en presupuestos.cjs btn()).
       Prefijo -ubtn- propio. Amarillo=prórroga 1 y 2, naranja=disidentes, rojo=resolver. */
    .ptl-ubtn-amarillo{background:#fbc02d;color:#5c3d00;border:1px solid #f9a825}
    .ptl-ubtn-naranja{background:#f57c00;color:#fff;border:1px solid #f57c00}
    .ptl-ubtn-rojo{background:#e53935;color:#fff;border:1px solid #e53935}
    /* v18.122 — tanda 1: patrones de estilo repetidos extraídos de presupuestos.cjs. */
    .ptl-h-tight{margin-bottom:0;font-weight:600;line-height:1.2}
    .ptl-lbl-field{font-size:13px;display:block;margin-bottom:3px}
    .ptl-flex-1{flex:1;min-width:0}
    .ptl-inline{display:inline}
    /* v18.122 — tanda 2 */
    .ptl-mb10{margin-bottom:10px}
    .ptl-flex-g6{display:flex;gap:6px}
    .ptl-nowrap{white-space:nowrap}
    .ptl-w100{width:100%}
    /* v18.122 — tanda 3 */
    .ptl-c-gray500{color:var(--ptl-gray-500)}
    .ptl-w46c{width:46px;text-align:center;display:inline-block}
    .ptl-acc-body8{display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)}
    .ptl-acc-body68{display:none;padding:6px 8px;border-top:1px solid var(--ptl-gray-200)}
    /* v18.122 — tanda 4 */
    .ptl-flex-c-g8{display:flex;align-items:center;gap:8px}
    .ptl-flex-c-g6{display:flex;align-items:center;gap:6px}
    .ptl-shrink0{flex-shrink:0}
    /* v18.122 — tanda 5 */
    .ptl-th-left{text-align:left;padding:6px 8px;border-bottom:2px solid var(--ptl-gray-300)}
    .ptl-h-tight13{margin-bottom:0;font-weight:600;font-size:13px;line-height:1.2}
    .ptl-fw400-gray{font-weight:400;color:var(--ptl-gray-500)}
    .ptl-td-right34{text-align:right;padding:3px 0 3px 34px;white-space:nowrap}
    .ptl-pad3-0{padding:3px 0}
    .ptl-fw600-lh{font-weight:600;line-height:1.2}
    .ptl-fw600{font-weight:600}
    .ptl-acc-guardar-hidden{display:none;margin:6px 12px 6px 0;flex-shrink:0}
    .ptl-hidden{display:none}
    /* v18.122 — tanda 6 */
    .ptl-input-full{width:100%;padding:4px 5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;line-height:1.35}
    .ptl-fs12-mb8{font-size:12px;line-height:1.3;margin-bottom:8px}
    .ptl-mb4{margin-bottom:4px}
    .ptl-select-200{flex:0 0 200px;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px}
    .ptl-input-flex{flex:1;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px}
    .ptl-fs12-lh{font-size:12px;line-height:1.3}
    .ptl-input-62r{width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right}
    .ptl-acc-acciones-hidden{display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0}
    .ptl-acc-activa-lbl{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-right:12px;flex-shrink:0}
    .ptl-m0{margin:0}
    .ptl-gap26{gap:2px 6px}
    /* v1.72 — variantes por NOMBRE DE COLOR usadas por los pills de HOY
       (Faltan/Completo/sin pisos), las cajas de fase 05/08 y la categoria de
       mail (Manual/Automatico). Mismo patron fondo-light + texto-dark que las
       de arriba. Reaparecieron al revertir el CSS a base v1.63 (perdiendo la
       unificacion de v1.64); el codigo (presupuestos.cjs) ya usa estos nombres.
       .ptl-fila-badge-fijo da el ancho fijo para que los pills se alineen en
       columna. Editable aqui, un solo sitio. */
    .ptl-fila-badge-success{background:var(--ptl-success-light);color:var(--ptl-success-dark);border:1px solid var(--ptl-success-light)}
    .ptl-fila-badge-danger{background:var(--ptl-danger-light);color:var(--ptl-danger-dark);border:1px solid var(--ptl-danger-light)}
    .ptl-fila-badge-neutro{background:var(--ptl-gray-200);color:var(--ptl-gray-700);border:1px solid var(--ptl-gray-200)}
    .ptl-fila-badge-fijo{flex:0 0 140px;width:140px;display:inline-block;text-align:center}

    /* ===== Timeline ===== */
    .ptl-timeline{display:flex;align-items:stretch;gap:0;padding:2px 0 1px;overflow:hidden;width:100%}
    .ptl-grupo{flex:1 1 auto;display:flex;flex-direction:column;padding:0 4px;min-width:0}
    .ptl-grupo-titulo{font-size:9px;font-weight:700;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:2px}
    /* En la ficha, los títulos de grupo (Presupuesto / Documentación) son más
       grandes y de color para destacar */
    .ptl-card .ptl-grupo-titulo{font-size:11px;color:var(--ptl-general-2);letter-spacing:1px;margin-bottom:6px}
    .ptl-puntos{display:flex;gap:0;padding:0 2px;justify-content:space-between;flex:1}
    .ptl-punto{display:flex;flex-direction:column;align-items:center;position:relative;flex:1 1 0;min-width:0}
    .ptl-punto:not(:last-child)::after{content:'';position:absolute;top:4px;right:-50%;width:100%;height:6px;background:var(--ptl-gray-400);z-index:0;border-radius:3px}
    .ptl-punto.completo:not(:last-child)::after{background:var(--ptl-success)}
    .ptl-punto.rechazado:not(:last-child)::after{background:var(--ptl-danger)}
    .ptl-circulo{width:10px;height:10px;border-radius:50%;background:var(--ptl-gray-400);border:2px solid var(--ptl-gray-400);z-index:1;position:relative}
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
    .ptl-ac-list{position:absolute;top:100%;left:0;right:0;background:var(--ptl-general-3);border:1px solid var(--ptl-gray-200);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-height:240px;overflow-y:auto;z-index:50;display:none;margin-top:2px}
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
    .ptl-btn{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid transparent;font-family:inherit;transition:all .12s;display:inline-flex;align-items:center;gap:5px}
    .ptl-btn-sm{padding:4px 10px;font-size:11px}
    /* v1.74 — dimensiones uniformes para botones primary de cabecera de cajitas
       (📁 CARPETA DRIVE, 📧 Enviar mail manual, + Añadir piso...). Centralizada
       aqui; antes estaba DUPLICADA a pelo en <style> de presupuestos.cjs y
       documentacion.cjs (regla 7). Mismo valor exacto, sin cambio visual. */
    .ptl-btn-uniforme{min-width:170px;height:28px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center}
    .ptl-btn-primary{background:var(--ptl-general-2);color:var(--ptl-general-1);border:1.5px solid var(--ptl-general-1)}
    .ptl-btn-primary:hover{background:var(--ptl-general-1);color:var(--ptl-general-2);border-color:var(--ptl-general-2)}
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
    .ptl-next-action{background:var(--ptl-general-1);border:1.5px solid var(--ptl-general-2);border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;min-height:60px;color:var(--ptl-general-2)}
    .ptl-next-action .ico{font-size:18px}
    .ptl-next-action .text{font-size:12px;font-weight:600;color:var(--ptl-general-2)}
    .ptl-next-action .sub{font-size:10.5px;font-weight:600;color:var(--ptl-general-2);margin-top:1px}
    .ptl-next-action.urgent{background:var(--ptl-danger-light);border-color:var(--ptl-danger-light)}
    .ptl-next-action.urgent .text{color:var(--ptl-danger)}
    .ptl-next-action.warn{background:var(--ptl-warning-light);border-color:var(--ptl-warning-light)}
    .ptl-next-action.warn .text{color:var(--ptl-warning)}
    /* Variante grid (3 zonas: izq texto / centro botón mail / der botones apilados).
       Altura UNIFICADA a 76px: cubre la fase más alta (04, con 3 botones apilados)
       para que TODAS las cintas midan lo mismo (las cortas, como la 09, suben a 76). */
    .ptl-next-action.ptl-next-action-grid{background:var(--ptl-general-1);border-color:var(--ptl-general-2);display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:stretch;padding:2px 8px;gap:6px;min-width:0;margin-bottom:6px;flex-wrap:initial;min-height:76px}
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
    .ptl-next-action-grid-2col .ptl-na-right .ptl-btn-enviar-avanzar{flex:1 1 auto;height:auto;display:flex;flex-direction:column;justify-content:center;align-items:center}
    /* Botón mail en 3 líneas: misma estética que ptl-btn-secondary pero altura ajustada a la columna */
    .ptl-btn-mail-3l{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;padding:2px 8px;gap:0;align-self:stretch;height:auto}
    .ptl-btn-mail-3l .ln{display:block;font-size:10.5px;font-weight:600}
    /* Mini-bloque "Fecha visita" (fase 02) y "Próximo mail" (fase 04): no son botones,
       tienen un input dentro */
    .ptl-mini-fecha{cursor:default;gap:2px;padding:3px 6px;min-width:120px;background:var(--ptl-general-2);border:1.5px solid var(--ptl-general-1);color:var(--ptl-general-1)}
    .ptl-mini-fecha:hover{background:var(--ptl-general-2)}
    .ptl-mini-fecha .ptl-label-mini{color:var(--ptl-general-1)}
    .ptl-mini-fecha input{cursor:text;color:var(--ptl-general-1)}

    /* ===== Form grid (12 columnas) ===== */
    .ptl-form-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px 6px}
    .ptl-form-grid input,.ptl-form-grid select,.ptl-form-grid textarea{width:100%;padding:4px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;outline:none;background:var(--ptl-general-3)}
    .ptl-form-grid textarea{height:auto}
    .ptl-form-grid input:focus,.ptl-form-grid select:focus,.ptl-form-grid textarea:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-form-grid .col-1{grid-column:span 1}.ptl-form-grid .col-2{grid-column:span 2}.ptl-form-grid .col-3{grid-column:span 3}.ptl-form-grid .col-4{grid-column:span 4}.ptl-form-grid .col-5{grid-column:span 5}.ptl-form-grid .col-6{grid-column:span 6}.ptl-form-grid .col-7{grid-column:span 7}.ptl-form-grid .col-8{grid-column:span 8}.ptl-form-grid .col-9{grid-column:span 9}.ptl-form-grid .col-10{grid-column:span 10}.ptl-form-grid .col-11{grid-column:span 11}.ptl-form-grid .col-12{grid-column:span 12}
    .ptl-form-label{font-size:9px;font-weight:600;color:var(--ptl-general-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px;display:block;line-height:1.2}
    .ptl-form-section-title{font-size:9px;font-weight:700;color:var(--ptl-general-2);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 2px;padding-bottom:1px}
    /* v1.71 — dentro de ventanas flotantes (.ptl-floating-window) el fondo es
       BLANCO, no azul oscuro. Las etiquetas (DESTINATARIO, CC, CCO, ASUNTO,
       CUERPO DEL MENSAJE, ADJUNTOS...) van en TINTA NEGRA corporativa
       (--ptl-gray-900), igual que el resto de texto sobre blanco del programa.
       Antes iban en azul oscuro (v1.32); Guille las quiere unificadas a negro.
       Editable en este único sitio (afecta a todos los modales flotantes). */
    .ptl-floating-window .ptl-form-label,
    .ptl-floating-window .ptl-form-section-title{color:var(--ptl-gray-900)}
    .ptl-form-grid input.calc-field:not([type=checkbox]):not([type=radio]){background:var(--ptl-gray-400);color:#fff;cursor:not-allowed;border-color:var(--ptl-gray-400);font-weight:600}
    /* CELDA BLOQUEADA (estandar): cualquier input/textarea readonly del programa
       se ve gris (gray-400) con letras blancas. Se excluye .ptl-vec-input (las
       celdas transparentes de la tabla de vecinos, que se funden con su fila). */
    input[readonly]:not(.ptl-vec-input),
    textarea[readonly]:not(.ptl-vec-input){background:var(--ptl-gray-400);color:#fff;cursor:not-allowed;border-color:var(--ptl-gray-400)}
    .ptl-form-grid input[list]::-webkit-calendar-picker-indicator{opacity:.4}

    /* ===== Botón Deshacer ===== */
    .ptl-btn-undo{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .ptl-btn-undo:hover:not(:disabled){background:var(--ptl-general-1);border-color:var(--ptl-general-2);color:var(--ptl-general-2)}
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
    .ptl-tabla-vecinos thead th{background:var(--ptl-general-3);color:var(--ptl-gray-500);font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:5px 8px;text-align:left;border-bottom:1px solid var(--ptl-gray-200);white-space:nowrap}
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
    .ptl-vec-btn-modo-bot:disabled{background:var(--ptl-general-1);color:var(--ptl-general-2);border-color:var(--ptl-general-1);opacity:.95}

    /* ===== Tabla ===== */
    .ptl-vec-tabla-wrap{border:1px solid var(--ptl-gray-100);border-radius:6px;overflow:hidden;background:var(--ptl-general-3)}
    .ptl-vec-tabla{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;color:var(--ptl-gray-900)}
    .ptl-vec-tabla thead th{background:var(--ptl-general-3);color:var(--ptl-gray-500);font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:6px 8px;text-align:left;border-bottom:1px solid var(--ptl-gray-200);white-space:nowrap}
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
    .ptl-vec-fila.ptl-vec-fila-expandida{background:var(--ptl-general-2);box-shadow:inset 4px 0 0 var(--ptl-brand)}
    .ptl-vec-fila.ptl-vec-fila-expandida td{border-bottom-color:var(--ptl-general-2)}
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
    /* v1.77 — boton RELOJ (⏰ añadir/quitar de HOY) CENTRALIZADO en DOS clases.
       Antes su estilo on/off iba inline repetido en ~8 sitios (presupuestos +
       documentacion). Colocadas TRAS .ptl-vec-btn para ganar el cascade.
       .ptl-btn-reloj = ACTIVADO (ambar + glow). .ptl-btn-reloj-off = DESACTIVADO
       (gris apagado, semitransparente). El tamaño 18px de los relojes de HOY
       sigue inline (es layout, no color). El JS alterna entre las dos clases. */
    .ptl-btn-reloj{background:var(--ptl-warning-light);color:var(--ptl-general-1);border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,.6);font-weight:bold}
    .ptl-btn-reloj-off{background:transparent;color:var(--ptl-gray-400);border-color:var(--ptl-gray-200);filter:grayscale(1) opacity(.5)}
    .ptl-vec-btn-guardar{background:var(--ptl-danger);color:#fff;border:1.5px solid var(--ptl-general-1);font-weight:700}
    .ptl-vec-btn-guardar:hover:not(:disabled){background:var(--ptl-danger-dark);border-color:var(--ptl-danger);color:#fff}
    .ptl-vec-btn-guardar:disabled{background:var(--ptl-gray-100);color:var(--ptl-gray-400);border-color:var(--ptl-gray-200);cursor:default}
    .ptl-vec-btn-acordeon{background:var(--ptl-gray-100);color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}
    .ptl-vec-btn-acordeon:hover{background:var(--ptl-gray-200);color:var(--ptl-gray-900)}
    .ptl-vec-btn-borrar{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-vec-btn-borrar:hover{background:white;color:var(--ptl-danger);border-color:var(--ptl-danger)}
    /* v1.90 — Switch del bot WhatsApp (M = manual / W = bot). Mismo tamaño que el
       resto de botones circulares. M en verde (success), W en rojo (danger, igual
       que el botón borrar). Alterna al pulsar. */
    .ptl-bot-switch{font-weight:700;letter-spacing:.3px}
    .ptl-bot-switch-m{background:var(--ptl-success);color:white;border-color:var(--ptl-success)}
    .ptl-bot-switch-m:hover{background:white;color:var(--ptl-success);border-color:var(--ptl-success)}
    .ptl-bot-switch-w{background:var(--ptl-danger);color:white;border-color:var(--ptl-danger)}
    .ptl-bot-switch-w:hover{background:white;color:var(--ptl-danger);border-color:var(--ptl-danger)}
    .ptl-vec-empty{padding:24px;text-align:center;color:var(--ptl-gray-500);font-size:13px}

    /* ===== Acordeón documental — más compacto ===== */
    /* Resaltado del acordeón abierto, igual al de la fila: borde azul lateral + fondo */
    .ptl-vec-acordeon-fila{background:var(--ptl-general-2);box-shadow:inset 4px 0 0 var(--ptl-brand)}
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
    .ptl-vec-doc-pendiente{background:var(--ptl-brand-light);color:var(--ptl-brand);border-color:var(--ptl-general-2)}
    .ptl-vec-doc-pendiente:hover{background:var(--ptl-general-1);color:var(--ptl-general-2);border-color:var(--ptl-general-2)}
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
    .ptl-vec-doc-menu{position:fixed;background:var(--ptl-general-3);border:1px solid var(--ptl-gray-200);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.12);z-index:9999;min-width:230px;padding:4px;display:flex;flex-direction:column;gap:2px}
    .ptl-vec-doc-menu-item{background:var(--ptl-general-3);border:none;text-align:left;padding:6px 10px;font-size:12px;color:var(--ptl-gray-700);font-family:inherit;border-radius:4px;cursor:pointer}
    .ptl-vec-doc-menu-item:hover{background:var(--ptl-brand-light);color:var(--ptl-brand)}
    .ptl-vec-doc-menu-item-disabled{color:var(--ptl-gray-400);cursor:not-allowed;font-style:italic}
    .ptl-vec-doc-menu-item-disabled:hover{background:var(--ptl-general-3);color:var(--ptl-gray-400)}

    /* ========================================================
       LISTA DE FILAS — estilo común a cajitas tipo lista.
       Usar en: cajitas con filas que se leen una debajo de otra
       (Mails pendientes, Decidir, Adjuntos rotos, Comunicaciones
       del expediente, las cajitas 05/08 de HOY, etc.).
       ======================================================== */
    .ptl-lista-filas{
      border-radius:5px;
      background:var(--ptl-general-3);
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
      background:var(--ptl-general-2);
    }
    .ptl-lista-filas .ptl-lista-fila:nth-child(odd){
      background:var(--ptl-general-3);
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
      background:var(--ptl-general-3);
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
      box-sizing:border-box;
      background:var(--ptl-general-3);
    }

    /* Input numérico centrado (cantidades, contadores) */
    .ptl-input-num{
      width:100%;
      padding:1px 4px;
      border:1px solid var(--ptl-gray-200);
      border-radius:4px;
      font-size:11px;
      font-family:inherit;
      background:var(--ptl-general-3);
      text-align:center;
    }

    /* Etiqueta uppercase pequeña tipo "NOTA SIMPLE", "TIPO VÍA" */
    .ptl-label-mini{
      font-size:9px;
      color:var(--ptl-general-2);
      text-transform:uppercase;
      letter-spacing:.4px;
      font-weight:700;
    }

    /* Etiqueta secundaria normal (12px gris) */
    .ptl-label-2nd{
      display:block;
      font-size:12px;
      color:var(--ptl-gray-500);
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
    .ptl-floating-window{position:fixed;background:var(--ptl-general-3);border-radius:8px;max-width:94vw;max-height:90vh;box-shadow:0 8px 32px rgba(0,0,0,0.35);z-index:9999;display:flex;flex-direction:column;overflow:hidden}
    .ptl-floating-title{background:var(--ptl-general-3);border-bottom:1px solid var(--ptl-gray-200);padding:8px 12px;display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none}
    .ptl-floating-title-text{font-size:14px;font-weight:600;color:var(--ptl-gray-900)}
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
    .menu-wrap{position:relative}
    .menu-btn{background:transparent;border:1.5px solid var(--ptl-general-2);color:var(--ptl-general-2);border-radius:7px;width:42px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;font-family:inherit}
    .menu-btn:hover{background:var(--ptl-general-2);color:var(--ptl-general-1)}
    .menu-list{position:absolute;top:100%;right:0;margin-top:4px;min-width:210px;background:var(--ptl-general-1);border:1px solid var(--ptl-general-2);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.35);z-index:100;overflow:hidden}
    .menu-list[hidden]{display:none}
    .menu-item{display:block;padding:8px 14px;font-size:13px;color:var(--ptl-general-2);text-decoration:none;cursor:pointer;font-weight:600}
    .menu-item:hover{background:var(--ptl-general-2);color:var(--ptl-general-1)}
    .menu-item-sm{font-size:9px}
    .menu-btn.hdr-reload,.menu-btn.hdr-cron,.menu-btn.hdr-hoy{font-size:24px;box-sizing:border-box;padding-bottom:3px}
    .menu-btn.hdr-cron-err{border-color:var(--ptl-danger);color:var(--ptl-danger)}
    .menu-btn.hdr-undo{font-size:18px}
    .menu-btn:disabled{opacity:.35;cursor:default;pointer-events:none}
    .menu-item.current{opacity:.45;pointer-events:none}
    .menu-sep{height:1px;background:var(--ptl-general-2);opacity:.4;margin:2px 0}
    /* Cabecera unificada (presupuestos + Plan 5): nombre de pantalla bajo la marca + hamburguesa */
    .ptl-nav-brand-fix{flex:0 0 auto}
    .ptl-nav-spacer{flex:1}
    .ptl-nav-text .ptl-nav-screen{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ptl-titulo)}
    .ptl-fase-titulo,
    .ptl-next-action .text .ptl-fase-titulo{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ptl-titulo)}
  `;
}

// CSS COMUN de las pantallas de Plan 5 (presupuesto, precios, ...). Lo inyecta
// el modulo presupuestos_plan5.cjs en TODAS sus pantallas, justo despues del
// tema, para no repetir estilos pantalla a pantalla. Usa los tokens --ptl-*.
function getPlan5Css() {
  return `
    /* ===== Estilo COMUN de TODAS las pantallas de Plan 5 (fuente unica) ===== */
    :root{
      --azul-oscuro:var(--ptl-general-1); --azul-claro:var(--ptl-general-2);
      --g1:var(--ptl-general-1); --titulo:var(--ptl-titulo);
      --g100:var(--ptl-gray-100); --g200:var(--ptl-general-3); --g300:var(--ptl-gray-300);
      --g400:var(--ptl-gray-400); --g500:var(--ptl-gray-500); --g600:var(--ptl-gray-600);
      --g700:var(--ptl-gray-700); --g800:var(--ptl-gray-800); --g900:var(--ptl-gray-900);
      --flotante:var(--ptl-general-1); --success:var(--ptl-success); --warning:var(--ptl-warning);
      --warning-dark:var(--ptl-warning-dark); --danger:var(--ptl-danger);
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--ptl-general-1);color:var(--ptl-general-2);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5}
    .page{max-width:1100px;margin:0 auto;padding:0 20px 60px}

    /* Cabecera comun: barra + titulo + menu hamburguesa */
    .p5bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:90;background:var(--ptl-general-1);padding:10px 0;margin-bottom:6px}
    .p5bar .title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ptl-titulo)}
    .p5bar .p5spacer{flex:1}
    .p5bar .p5brand{display:flex;align-items:center;gap:10px;text-decoration:none}

    /* Tarjetas */
    .card{background:var(--ptl-general-1);color:var(--ptl-general-2);border:1px solid var(--ptl-general-2);border-radius:10px;padding:8px 12px 11px;margin-bottom:var(--ptl-card-gap)}
    .card > .t{font-size:10px;font-weight:700;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;letter-spacing:.7px;margin:-8px -12px 8px -12px;padding:6px 12px;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--ptl-general-2)}
    .card > .t .tag{margin-left:auto;font-size:9px;letter-spacing:.5px;text-transform:none;color:var(--ptl-general-2);border:1px solid var(--ptl-general-2);border-radius:20px;padding:1px 8px}

    /* Rejillas (gaps unicos de Plan 5) */
    .grid{display:grid;row-gap:4px;column-gap:8px}
    .g2{grid-template-columns:1fr 1fr} .g3{grid-template-columns:1fr 1fr 1fr} .g4{grid-template-columns:1fr 1fr 1fr 1fr} .g5{grid-template-columns:repeat(5,1fr)}
    .gv{display:grid;row-gap:4px;column-gap:8px;grid-template-columns:1fr 1fr 1fr 1fr 26px}
    @media(max-width:480px){ .g2,.g3,.g4,.g5,.g8,.gv{grid-template-columns:1fr 1fr} }
    .span2{grid-column:span 2} .span3{grid-column:span 3} .g8{grid-template-columns:repeat(8,1fr)}

    /* Etiquetas e inputs (altura estandar --ptl-input-h) */
    label.f{display:flex;flex-direction:column;gap:1px}
    label.f .lab{font-size:10px;color:var(--ptl-general-2);letter-spacing:.4px;text-transform:uppercase;font-weight:700;line-height:1.1}
    label.f .lab small{color:var(--ptl-gray-400);text-transform:none;font-weight:400;letter-spacing:0}
    input,select{background:var(--ptl-general-3);border:1px solid var(--ptl-general-3);color:var(--ptl-gray-900);border-radius:4px;padding:0 6px;font-size:11px;width:100%;font-family:inherit;height:var(--ptl-input-h);box-sizing:border-box;line-height:1.1}
    input:focus,select:focus{outline:none;border-color:var(--ptl-general-2);background:#fff}
    input::placeholder{color:var(--ptl-gray-400);font-style:italic}
    input[readonly]{background:var(--ptl-gray-400);color:#fff;border-color:var(--ptl-gray-400);cursor:not-allowed}

    /* Combo propio (revision) */
    .combo{position:relative;width:100%}
    .combo > input{width:100%;padding-right:22px}
    .combo-arrow{position:absolute;right:1px;top:1px;bottom:1px;width:20px;border:none;background:transparent;color:var(--ptl-gray-700);cursor:pointer;font-size:12px;padding:0;display:flex;align-items:center;justify-content:center}
    .combo-list{position:absolute;top:100%;left:0;right:0;z-index:60;background:var(--ptl-general-3);border:1px solid var(--ptl-gray-400);border-top:none;border-radius:0 0 4px 4px;max-height:160px;overflow:auto;box-shadow:0 4px 10px rgba(0,0,0,.25)}
    .combo-list[hidden]{display:none}
    .combo-opt{padding:3px 6px;font-size:11px;color:var(--ptl-gray-900);cursor:pointer}
    .combo-opt:hover{background:var(--ptl-general-1);color:#fff}
    .derived{background:var(--ptl-gray-400);color:#fff;border-radius:4px;height:var(--ptl-input-h);display:flex;align-items:center;padding:0 6px;font-size:11px;font-weight:600}

    /* Filas dinamicas (viviendas / peines) */
    .vrow,.prow{display:grid;gap:8px;align-items:end;padding:4px 0;border-bottom:1px dashed var(--ptl-gray-600)}
    .vrow{grid-template-columns:0.5fr 1.5fr 1fr 1fr 26px}
    .prow{grid-template-columns:1.5fr .7fr auto auto}
    .vrow:last-of-type,.prow:last-of-type{border-bottom:none}
    .pout{font-size:12px;color:var(--ptl-general-2);font-weight:700;text-align:right;min-width:62px;padding-bottom:4px}

    /* Botones redondos + / x */
    button.del{background:var(--ptl-danger);border:1.5px solid var(--ptl-danger-dark);color:#fff;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center}
    button.del:hover{background:#fff;color:var(--ptl-danger)}
    button.add,button.tadd{background:var(--ptl-general-2);border:1.5px solid var(--ptl-general-1);color:var(--ptl-general-1);border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:15px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-weight:700}
    button.add:hover,button.tadd:hover{background:var(--ptl-general-1);color:var(--ptl-general-2);border-color:var(--ptl-general-2)}
    .toggle{display:flex;align-items:center;gap:7px;height:22px}
    .toggle input{width:auto;height:auto}
    .note{font-size:10px;color:var(--ptl-gray-400);margin-top:8px;line-height:1.5}

    /* ===== Pantalla de PRECIOS (tabla) ===== */
    #q{flex:1;min-width:160px;width:auto;height:32px;box-sizing:border-box;background:var(--ptl-general-3);border:1px solid var(--ptl-general-3);color:var(--ptl-gray-900);border-radius:6px;padding:0 10px;font-size:13px;font-family:inherit}
    #q:focus{outline:none;border-color:var(--ptl-general-2);background:#fff}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead th{position:sticky;top:52px;z-index:80;background:var(--ptl-general-1);color:var(--ptl-titulo);text-transform:uppercase;font-size:10px;letter-spacing:.5px;text-align:left;padding:6px 8px;border-bottom:1px solid var(--ptl-general-2)}
    th.pr,td.pr{text-align:right;width:110px}
    th.ud,td.ud{width:54px}
    th.tp,td.tp{width:180px}
    th.dc,td.dc{width:34px;text-align:center}
    tbody td{padding:2px 6px;border-bottom:1px solid var(--ptl-gray-700);color:var(--ptl-general-2);vertical-align:middle}
    tbody tr:hover td{background:rgba(255,255,255,.04)}
    input.pr{width:100%;text-align:right;background:var(--ptl-general-3);border:1px solid var(--ptl-general-3);color:var(--ptl-gray-900);border-radius:4px;padding:0 6px;font-size:11px;line-height:1.1;height:var(--ptl-input-h);box-sizing:border-box;font-family:inherit}
    input.pr:focus{outline:none;border-color:var(--ptl-general-2);background:#fff}
    input.cell{width:100%;background:var(--ptl-general-3);border:1px solid var(--ptl-general-3);color:var(--ptl-gray-900);border-radius:4px;padding:0 6px;font-size:11px;line-height:1.1;height:var(--ptl-input-h);box-sizing:border-box;font-family:inherit}
    input.cell:focus{outline:none;border-color:var(--ptl-general-2);background:#fff}
    .addp{flex:0 0 auto;background:var(--ptl-general-2);color:var(--ptl-general-1);border:1.5px solid var(--ptl-general-1);border-radius:50%;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;font-family:inherit}
    .addp:hover{background:var(--ptl-general-1);color:var(--ptl-general-2);border-color:var(--ptl-general-2)}
    .delp{background:var(--ptl-danger);border:1.5px solid var(--ptl-danger-dark);color:#fff;border-radius:50%;width:22px;height:22px;font-size:12px;line-height:1;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-family:inherit}
    .delp:hover{background:#fff;color:var(--ptl-danger)}
    .empty{padding:14px;text-align:center;color:var(--ptl-gray-400);font-style:italic}
  `;
}

module.exports = { getThemeCss, getPlan5Css };
