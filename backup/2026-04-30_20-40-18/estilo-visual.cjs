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
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F9FAFB;color:#111827;font-size:14px;line-height:1.5}
    a{text-decoration:none;color:inherit}

    /* ===== Variables de color (paleta global) ===== */
    :root{
      --ptl-brand:#4F46E5;--ptl-brand-light:#EEF2FF;
      --ptl-success:#10B981;--ptl-success-light:#D1FAE5;
      --ptl-warning:#F59E0B;--ptl-warning-light:#FEF3C7;
      --ptl-danger:#EF4444;--ptl-danger-light:#FEE2E2;
      --ptl-gray-50:#F9FAFB;--ptl-gray-100:#F3F4F6;--ptl-gray-200:#E5E7EB;
      --ptl-gray-400:#9CA3AF;--ptl-gray-500:#6B7280;--ptl-gray-700:#374151;--ptl-gray-900:#111827;
    }

    /* ===== Navegación superior ===== */
    .ptl-nav{position:sticky;top:0;background:white;border-bottom:1px solid var(--ptl-gray-200);padding:8px 20px;display:flex;align-items:center;gap:14px;z-index:200;height:60px}
    .ptl-nav-brand{display:flex;align-items:center;gap:10px;flex:1}
    .ptl-logo{width:34px;height:34px;border-radius:8px;background:var(--ptl-brand);color:white;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
    .ptl-nav-text{display:flex;flex-direction:column;line-height:1.2}
    .ptl-nav-text strong{font-size:14px;color:var(--ptl-gray-900)}
    .ptl-nav-text span{font-size:11px;color:var(--ptl-gray-500)}

    /* ===== Estructura de página ===== */
    .ptl-page{max-width:1200px;margin:0 auto;padding:14px 20px}
    .ptl-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ptl-gray-500);margin-bottom:8px;flex-wrap:wrap}
    .ptl-breadcrumb a{color:var(--ptl-brand)}
    .ptl-breadcrumb a:hover{text-decoration:underline}
    .ptl-breadcrumb .ptl-sep{color:#D1D5DB}
    .ptl-breadcrumb > span:last-child{font-size:16px;font-weight:600;color:var(--ptl-gray-900)}

    /* ===== Cards ===== */
    .ptl-card{background:var(--ptl-brand-light);border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05);border:1px solid #C7D2FE;margin-bottom:6px}
    .ptl-card-title{font-size:10px;font-weight:700;color:#3730A3;text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px}
    .ptl-card-title-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px}
    .ptl-empty{text-align:center;padding:50px 20px;color:var(--ptl-gray-500)}
    .ptl-empty h3{color:var(--ptl-gray-700);font-size:17px;margin-bottom:6px}

    /* ===== Filtros ===== */
    .ptl-filtros{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
    .ptl-filtros-rapidos{margin-bottom:6px}
    .ptl-filtros-fases{flex-wrap:wrap;gap:4px;overflow-x:auto;scrollbar-width:thin}
    .ptl-filtros-fases .ptl-filtro{flex-shrink:0;padding:4px 9px;font-size:10.5px}
    .ptl-filtro{padding:4px 9px;border-radius:18px;border:1.5px solid var(--ptl-gray-200);background:white;font-size:11px;font-weight:500;color:var(--ptl-gray-700);transition:all .15s;white-space:nowrap}
    .ptl-filtro:hover,.ptl-filtro.on{background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}
    .ptl-filtro-nuevo{background:var(--ptl-brand);color:white;border-color:var(--ptl-brand);font-weight:600}
    .ptl-filtro-nuevo:hover{background:var(--ptl-brand-dark, #4338ca);border-color:var(--ptl-brand-dark, #4338ca);color:white}
    .ptl-filtro.ptl-filtro-hoy{border-color:var(--ptl-warning);color:var(--ptl-warning);font-weight:600}
    .ptl-filtro.ptl-filtro-hoy:hover,.ptl-filtro.ptl-filtro-hoy.on{background:var(--ptl-warning);border-color:var(--ptl-warning);color:white}
    .ptl-filtro.ptl-filtro-tramite{background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE;font-weight:600}
    .ptl-filtro.ptl-filtro-tramite:hover,.ptl-filtro.ptl-filtro-tramite.on{background:#4F46E5;border-color:#4F46E5;color:white}
    .ptl-filtro.ptl-fase-activa{background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE}
    .ptl-filtro.ptl-fase-activa:hover,.ptl-filtro.ptl-fase-activa.on{background:#4F46E5;border-color:#4F46E5;color:white}
    .ptl-filtro.ptl-fase-zz{background:#FEF2F2;color:#DC2626;border-color:#FECACA}
    .ptl-filtro.ptl-fase-zz:hover,.ptl-filtro.ptl-fase-zz.on{background:#DC2626;border-color:#DC2626;color:white}

    /* ===== Búsqueda y orden ===== */
    .ptl-search-wrap{position:relative;flex:1}
    .ptl-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ptl-gray-400);font-size:13px}
    .ptl-search-input{width:100%;padding:7px 12px 7px 32px;border:1.5px solid var(--ptl-gray-200);border-radius:8px;font-size:13px;outline:none;background:white;font-family:inherit}
    .ptl-search-input:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-btn-orden{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);border-radius:8px;padding:0 14px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
    .ptl-btn-orden:hover{background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}

    /* ===== Cabecera de listado ===== */
    .ptl-lista-header{position:sticky;top:60px;z-index:100;background:var(--ptl-gray-50);padding:10px 0 8px;margin-bottom:6px;border-bottom:1px solid var(--ptl-gray-200);display:flex;flex-direction:column;gap:8px}

    /* ===== Filas de lista ===== */
    .ptl-fila{background:var(--ptl-brand-light);border:1px solid #C7D2FE;border-radius:8px;padding:3px 12px;margin-bottom:3px;display:flex;align-items:center;gap:8px;color:inherit;transition:all .15s}
    .ptl-fila:hover{border-color:var(--ptl-brand);box-shadow:0 2px 6px rgba(79,70,229,.15);background:#E0E7FF}
    .ptl-fila-info{flex:0 0 auto;min-width:0;max-width:26%;display:flex;align-items:baseline;gap:6px;overflow:hidden}
    .ptl-fila-tipo{color:var(--ptl-gray-500);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0}
    .ptl-fila-dir{font-size:13px;font-weight:600;color:var(--ptl-gray-900);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-fila-importe{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptl-gray-500);flex-shrink:0;min-width:70px;text-align:right}
    .ptl-fila .ptl-timeline{flex:1;min-width:0;justify-content:flex-end;padding:0;overflow:hidden}

    /* ===== Timeline ===== */
    .ptl-timeline{display:flex;align-items:stretch;gap:0;padding:2px 0 1px;overflow:hidden;width:100%}
    .ptl-grupo{flex:1 1 auto;display:flex;flex-direction:column;padding:0 4px;min-width:0}
    .ptl-grupo-titulo{font-size:9px;font-weight:700;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:2px}
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
    .ptl-btn-primary{background:var(--ptl-brand);color:white}
    .ptl-btn-primary:hover{background:#4338CA}
    .ptl-btn-success{background:var(--ptl-success);color:white}
    .ptl-btn-danger{background:var(--ptl-danger);color:white}
    .ptl-btn-secondary{background:white;color:var(--ptl-gray-700);border-color:var(--ptl-gray-200)}

    /* ===== Barra de acciones (next-action) ===== */
    .ptl-next-action{background:var(--ptl-brand-light);border:1.5px solid #C7D2FE;border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;min-height:60px}
    .ptl-next-action .ico{font-size:18px}
    .ptl-next-action .text{font-size:12px;font-weight:600;color:#3730A3}
    .ptl-next-action .sub{font-size:11px;color:var(--ptl-brand);margin-top:1px}
    .ptl-next-action.urgent{background:var(--ptl-danger-light);border-color:#FECACA}
    .ptl-next-action.urgent .text{color:var(--ptl-danger)}
    .ptl-next-action.warn{background:var(--ptl-warning-light);border-color:#FDE68A}
    .ptl-next-action.warn .text{color:var(--ptl-warning)}
    /* Variante grid (3 zonas: izq texto / centro botón mail / der botones apilados).
       Altura uniforme: 60px = altura del botón mail 3 líneas + padding/border. */
    .ptl-next-action.ptl-next-action-grid{background:#C7D2FE;border-color:#A5B4FC;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:stretch;padding:2px 8px;gap:6px;min-width:0;margin-bottom:6px;flex-wrap:initial;min-height:60px}
    /* Variante 2 columnas: izq texto + der botón único grande */
    .ptl-next-action.ptl-next-action-grid.ptl-next-action-grid-2col{grid-template-columns:minmax(0,1fr) auto}
    .ptl-next-action-grid .ptl-na-left{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}
    .ptl-next-action-grid .ptl-na-left .text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptl-next-action-grid .ptl-na-right{display:flex;flex-direction:column;gap:2px;justify-content:stretch;align-items:flex-end}
    /* Mismo ancho global para TODOS los botones de la derecha (en cualquier fase).
       215px cabe el más largo: "→ Paso a 04-SEGUIMIENTO PTO". Texto pegado a la derecha. */
    .ptl-next-action-grid .ptl-na-right .ptl-btn{white-space:nowrap;padding:3px 10px;font-size:10.5px;min-width:215px;justify-content:flex-end;text-align:right}

    /* ===== Form grid (12 columnas) ===== */
    .ptl-form-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px 6px}
    .ptl-form-grid input,.ptl-form-grid select,.ptl-form-grid textarea{width:100%;padding:4px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;outline:none;background:white;height:26px}
    .ptl-form-grid textarea{height:auto}
    .ptl-form-grid input:focus,.ptl-form-grid select:focus,.ptl-form-grid textarea:focus{border-color:var(--ptl-brand);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    .ptl-form-grid .col-1{grid-column:span 1}.ptl-form-grid .col-2{grid-column:span 2}.ptl-form-grid .col-3{grid-column:span 3}.ptl-form-grid .col-4{grid-column:span 4}.ptl-form-grid .col-5{grid-column:span 5}.ptl-form-grid .col-6{grid-column:span 6}.ptl-form-grid .col-7{grid-column:span 7}.ptl-form-grid .col-8{grid-column:span 8}.ptl-form-grid .col-12{grid-column:span 12}
    .ptl-form-label{font-size:9px;font-weight:600;color:var(--ptl-gray-500);text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px;display:block;line-height:1.2}
    .ptl-form-section-title{font-size:9px;font-weight:700;color:var(--ptl-gray-700);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 2px;padding-bottom:1px;border-bottom:1px solid var(--ptl-gray-100)}
    .ptl-form-grid input.calc-field{background:#E5E7EB;color:var(--ptl-gray-700);cursor:not-allowed;border-color:#D1D5DB;font-weight:600}
    .ptl-form-grid input[list]::-webkit-calendar-picker-indicator{opacity:.4}

    /* ===== Botón Deshacer ===== */
    .ptl-btn-undo{background:white;color:var(--ptl-gray-700);border:1.5px solid var(--ptl-gray-200);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .ptl-btn-undo:hover:not(:disabled){background:var(--ptl-brand);border-color:var(--ptl-brand);color:white}
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
  `;
}

module.exports = { getThemeCss };
