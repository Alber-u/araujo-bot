// ============================================================================
// MÓDULO PRESUPUESTOS PLAN 5 — Araujo CCPP
// Build: 2026-06-12 v0.1 (ESQUELETO — espina dorsal, bloques en stub)
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

// Pestaña del Sheet donde se guardan los datos de cada presupuesto Plan 5.
// Columnas: A direccion | B ccpp_id | C nº_presupuesto | D fecha | E revisión | F actualizado | G datos_json
const RANGO_PLAN5 = "plan5_toma_datos!A:G";
const normDir = s => String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, " ");

// La pantalla "Toma de datos" va incrustada aqui como texto (cadena JS escapada);
// asi todo el modulo Plan 5 es UN solo archivo y no hay .html aparte.
const TOMA_DATOS_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Plan 5 \u00b7 Toma de datos</title>\n<style>\n  :root{\n    --azul-oscuro:#004079; --azul-claro:#B4DCFF; --g1:#004079; --titulo:#D1D5DB;\n    --g100:#F3F4F6; --g200:#E5E7EB; --g300:#D1D5DB; --g400:#9CA3AF;\n    --g500:#6B7280; --g600:#4B5563; --g700:#374151; --g800:#1F2937; --g900:#111827; --flotante:#fff;\n    --success:#10B981; --warning:#F59E0B; --warning-dark:#92400E; --danger:#EF4444;\n  }\n  *{box-sizing:border-box;}\n  body{margin:0; background:var(--g1); color:var(--titulo); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; line-height:1.5;}\n  .page{max-width:1100px; margin:0 auto; padding:10px 20px 60px;}\n\n  .head{display:flex; align-items:baseline; gap:10px; padding:8px 2px 10px; flex-wrap:wrap;}\n  .head .ttl{font-size:17px; font-weight:700; color:#fff;}\n  .head .ttl b{color:var(--azul-claro);}\n  .head .sub{font-size:11px; color:var(--azul-claro); letter-spacing:1.5px; text-transform:uppercase; width:100%;}\n  .head .ref{margin-left:auto; font-size:11px; color:var(--g300);}\n  .head .ref b{color:#fff; font-weight:600;}\n\n  .live{position:sticky; top:0; z-index:5; background:linear-gradient(180deg,#00345f,#013256); border:1px solid #0a4f86; border-radius:9px; display:flex; gap:6px; padding:8px; margin-bottom:10px; flex-wrap:wrap; box-shadow:0 4px 14px rgba(0,0,0,.25);}\n  .live .cell{flex:1 1 84px; text-align:center; padding:3px 4px;}\n  .live .cell .lab{font-size:9px; letter-spacing:.6px; text-transform:uppercase; color:#7fb2dd;}\n  .live .cell .val{font-size:15px; font-weight:700; color:var(--azul-claro); margin-top:2px;}\n  .live .cell .val.amber{color:var(--warning);}\n  .live .cell .val.pend{color:#5f87a8; font-size:12px; font-weight:500;}\n\n  .card{background:var(--flotante); border-radius:10px; padding:8px 12px 11px; margin-bottom:5px;}\n  .card > .t{font-size:10px; font-weight:700; background:var(--g1); color:var(--titulo); text-transform:uppercase; letter-spacing:.7px; margin:-8px -12px 8px -12px; padding:6px 12px; border-radius:10px 10px 0 0; display:flex; align-items:center; gap:8px;}\n  .card > .t .tag{margin-left:auto; font-size:9px; letter-spacing:.5px; text-transform:none; color:var(--azul-claro); border:1px solid #2f6da3; border-radius:20px; padding:1px 8px;}\n\n  .grid{display:grid; row-gap:4px; column-gap:8px;}\n  .g2{grid-template-columns:1fr 1fr;} .g3{grid-template-columns:1fr 1fr 1fr;} .g4{grid-template-columns:1fr 1fr 1fr 1fr;} .g5{grid-template-columns:repeat(5,1fr);}\n  .gv{display:grid; row-gap:4px; column-gap:8px; grid-template-columns:1fr 1fr 1fr 1fr 26px;}\n  @media(max-width:480px){ .g2,.g3,.g4,.g5,.g8,.gv{grid-template-columns:1fr 1fr;} }\n  .span2{grid-column:span 2;} .span3{grid-column:span 3;} .g8{grid-template-columns:repeat(8,1fr);}\n\n  label.f{display:flex; flex-direction:column; gap:2px;}\n  label.f .lab{font-size:9px; color:var(--g500); letter-spacing:.4px; text-transform:uppercase; font-weight:700;}\n  label.f .lab small{color:var(--g400); text-transform:none; font-weight:400; letter-spacing:0;}\n  input,select{background:var(--g200); border:1px solid var(--g200); color:var(--g900); border-radius:4px; padding:2px 6px; font-size:12px; width:100%; font-family:inherit; height:22px;}\n  input:focus,select:focus{outline:none; border-color:var(--azul-oscuro); background:#fff;}\n  input::placeholder{color:var(--g300); font-style:italic;}\n  input[readonly]{background:var(--g400); color:#fff; border-color:var(--g400); cursor:default;}\n  .derived{background:var(--g400); color:#fff; border-radius:4px; height:22px; display:flex; align-items:center; padding:0 6px; font-size:12px; font-weight:600;}\n\n  .vrow,.prow{display:grid; gap:8px; align-items:end; padding:4px 0; border-bottom:1px dashed var(--g200);}\n  .vrow{grid-template-columns:0.5fr 1.5fr 1fr 1fr 26px;}\n  .prow{grid-template-columns:1.5fr .7fr auto auto;}\n  .vrow:last-of-type,.prow:last-of-type{border-bottom:none;}\n  .pout{font-size:12px; color:var(--azul-oscuro); font-weight:700; text-align:right; min-width:62px; padding-bottom:4px;}\n  .pout small{display:block; font-size:9px; color:var(--g400); font-weight:400;}\n  button.del{background:var(--danger); border:1.5px solid var(--danger); color:#fff; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:12px; line-height:1; padding:0; display:inline-flex; align-items:center; justify-content:center;}\n  button.del:hover{filter:brightness(.9);}\n  button.add,button.tadd{background:var(--azul-oscuro); border:1.5px solid var(--azul-oscuro); color:#fff; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:15px; line-height:1; padding:0; display:inline-flex; align-items:center; justify-content:center; font-family:inherit; font-weight:700;}\n  button.add:hover,button.tadd:hover{background:var(--azul-claro); color:var(--azul-oscuro); border-color:var(--azul-oscuro);}\n  .toggle{display:flex; align-items:center; gap:7px; height:22px;}\n  .toggle input{width:auto; height:auto;}\n\n  .resl{display:flex; justify-content:space-between; align-items:baseline; padding:6px 0; border-bottom:1px solid var(--g100); gap:10px;}\n  .resl:last-child{border-bottom:none;}\n  .resl .k{font-size:12px; color:var(--g500);} .resl .v{font-size:14px; font-weight:700; color:var(--g800);}\n  .resl .v.pend{color:var(--g400); font-weight:500; font-size:12px;} .resl .v.amber{color:var(--warning-dark);}\n  .note{font-size:10px; color:var(--g400); margin-top:8px; line-height:1.5;}\n</style>\n</head>\n<body>\n<script>window.__PLAN5_SAVED__=null;/*__PLAN5_SAVED__*/</script>\n<div class=\"page\">\n\n  <div style=\"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;\">\n    <a id=\"btnVolver\" href=\"#\" style=\"display:none;background:transparent;color:var(--azul-claro);border:1.5px solid var(--azul-claro);border-radius:7px;padding:6px 16px;font-size:13px;font-weight:700;text-decoration:none;font-family:inherit;\">\u2190 Volver al expediente</a>\n    <div style=\"display:flex;align-items:center;gap:10px;margin-left:auto;\">\n      <span id=\"saveMsg\" style=\"font-size:12px;color:var(--g500);\"></span>\n      <button id=\"btnGuardar\" type=\"button\" style=\"background:var(--azul-claro);color:var(--azul-oscuro);border:1.5px solid var(--azul-oscuro);border-radius:7px;padding:6px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;\">Guardar</button>\n    </div>\n  </div>\n\n  <!-- 1. DATOS DEL PRESUPUESTO -->\n  <div class=\"card\">\n    <div class=\"t\">Datos del presupuesto</div>\n    <div class=\"grid g3\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de presupuesto</span><input id=\"f_npresupuesto\" value=\"O25-ARA/00213\"></label>\n      <label class=\"f\"><span class=\"lab\">Fecha</span><input id=\"f_fecha\" type=\"date\" value=\"2026-05-28\"></label>\n      <label class=\"f\"><span class=\"lab\">Revisi\u00f3n</span><input id=\"f_revision\" value=\"Rev-18 28/05/2026\"></label>\n    </div>\n  </div>\n\n  <!-- 2. COMUNIDAD (del expediente; s\u00f3lo el CP se teclea) -->\n  <div class=\"card\">\n    <div class=\"t\">Comunidad <span class=\"tag\">del expediente</span></div>\n    <div class=\"gv\">\n      <label class=\"f span2\"><span class=\"lab\">Direcci\u00f3n</span><input id=\"f_direccion\" value=\"Av S\u00e1nchez Pizju\u00e1n 6\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Poblaci\u00f3n</span><input value=\"Sevilla\"></label>\n      <label class=\"f\"><span class=\"lab\">CP</span><input value=\"41009\"></label>\n\n      <label class=\"f span2\"><span class=\"lab\">Administrador</span><input value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tel. administrador</span><input value=\"\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Email administrador</span><input value=\"\" readonly></label>\n      <label class=\"f\"></label>\n\n      <label class=\"f span2\"><span class=\"lab\">Presidente</span><input value=\"Juan Carlos Dorado\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tel. presidente</span><input value=\"674860912\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Email presidente</span><input value=\"jcdorado1966@gmail.com\" readonly></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 3. EDIFICIO Y VIVIENDAS -->\n  <div class=\"card\">\n    <div class=\"t\">Tipo de edificio</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de plantas <small>(Baja + X)</small></span><input id=\"plantas\" type=\"number\" value=\"9\" min=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Altura de planta <small>(m)</small></span><input id=\"altura\" type=\"number\" value=\"3\" step=\"0.1\"></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de suministros</span><input id=\"nsum\" value=\"36\" readonly></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de edificio</span><div class=\"derived\" id=\"tipoEdif\">TIPO C</div></label>\n      <label class=\"f\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales con suministro</span><input type=\"number\" min=\"0\" value=\"7\"></label>\n      <label class=\"f\"><span class=\"lab\">Locales sin suministro</span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">Viviendas con m\u00e1s de una entrada</span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de entradas de m\u00e1s</span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n      <label class=\"f\"></label>\n    </div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en planta baja</div>\n      <button class=\"add\" data-z=\"baja\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vbaja\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en resto de plantas</div>\n      <button class=\"add\" data-z=\"resto\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vresto\"></div>\n\n    <div style=\"display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px;\">\n      <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;\">Viviendas en \u00e1tico</div>\n      <button class=\"add\" data-z=\"atico\" title=\"A\u00f1adir vivienda\">+</button>\n    </div>\n    <div id=\"vatico\"></div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Puntos de agua de comunidad</div>\n    <div class=\"gv\">\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select><option></option><option selected>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Puntos de agua de comunidad</span><select><option></option><option>PORTAL</option><option>C.CONTADORES</option><option>PATIO</option><option>AZOTEA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Comunidad</span><div class=\"derived\">1</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">TIPO A</div></label>\n      <label class=\"f\"></label>\n    </div>\n  </div>\n\n  <!-- 7. TUBO CONEXI\u00d3N + ALIMENTACI\u00d3N -->\n  <!-- CARACTER\u00cdSTICAS DE LA INSTALACI\u00d3N (A28:B51) -->\n  <div class=\"card\">\n    <div class=\"t\">Caracter\u00edsticas de la instalaci\u00f3n por tipo de instalaci\u00f3n</div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Acometida</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba contador de agua</span><input value=\"22100138\"></label>\n      <label class=\"f\"><span class=\"lab\">Ubicaci\u00f3n del contador</span><select><option>FACHADA DELANTERA</option><option>FACHADA LATERAL</option><option>FACHADA TRASERA</option><option selected>ZONAS COMUNES</option><option>CUARTO DE MOTORES</option><option>EN C\u00baSERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Situaci\u00f3n llave acerado</span><select><option selected>DELANTERA</option><option>LATERAL</option><option>TRASERA</option><option>DELANTERA-CAMBIAR</option><option>LATERAL-CAMBIAR</option><option>TRASERA-CAMBIAR</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba llaves de corte general <small>(ud)</small></span><input type=\"number\" min=\"0\" value=\"3\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de conexi\u00f3n</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option>DESCONOCIDO</option><option selected>PE</option><option>PLOMO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Di\u00e1metro actual <small>(mm)</small></span><select><option>DESCONOCIDO</option><option>25</option><option>32</option><option>40</option><option selected>50</option><option>63</option><option>75</option><option>90</option><option>110</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><select id=\"longCon\"><option>NO EXISTE</option><option>VALIDO</option><option>1</option><option>2</option><option>3</option><option>4</option><option selected>7</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tubo de alimentaci\u00f3n</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Longitud propuesta <small>(m)</small></span><input id=\"longAli\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"14,0\"></label>\n      <label class=\"f\"><span class=\"lab\">Montaje propuesto</span><select><option>ENTERRADO</option><option selected>B.FORJADO</option><option>CANALETA</option><option>F.VIGA</option><option>F.TECHO</option><option>SOLO PIECERIA</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba codos termofusi\u00f3n <small>(ud)</small></span><input type=\"number\" min=\"0\" value=\"4\"></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Montante de abastecimiento</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Material actual</span><select><option>DESCONOCIDO</option><option selected>COBRE</option><option>HIERRO</option><option>PPR</option><option>PE</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Cuarto de contadores</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Ubicaci\u00f3n</span><select><option>EN FACHADA DELANTERA</option><option>EN FACHADA LATERAL</option><option>EN FACHADA TRASERA</option><option selected>EN PORTAL</option><option>BAJO ESCALERA</option><option>EN PATIO INTERIOR</option><option>EN PATIO EXTERIOR</option><option>EN C\u00ba.MOTORES</option><option>EN C\u00ba.SERVICIO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de cuarto</span><select><option>EXISTENTE</option><option selected>ALUMINIO</option><option>OBRA - P.ALUMINIO</option><option>OBRA - P.HIERRO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bater\u00eda 1</span><select class=\"bat\"></select></label>\n      <label class=\"f\"><span class=\"lab\">Tipo de bater\u00eda 2 (si hay)</span><select class=\"bat\"></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Grupo de presi\u00f3n</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">N\u00ba de motores actual</span><select><option></option><option>1</option><option selected>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Potencia actual <small>(KW)</small></span><select><option></option><option selected>1,7</option><option>1,9</option><option>2,2</option><option>2,7</option><option>3,0</option><option>4,0</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de motores nuevo</span><select id=\"gpInstala\"><option selected></option><option>1</option><option>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Potencia nueva <small>(KW)</small></span><select><option selected></option><option>1,7</option><option>1,9</option><option>2,2</option><option>2,7</option><option>3,0</option><option>4,0</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Ubicaci\u00f3n</span><select><option selected>NO NECESITA</option><option>C.EXISTENTE</option><option>C.NUEVO</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Longitud tubo alimentaci\u00f3n <small>(m)</small></span><input type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"7,0\"></label>\n      <label class=\"f\"><span class=\"lab\">Tama\u00f1o calder\u00edn <small>(L)</small></span><select><option>NO TIENE</option><option selected>8</option><option>24</option><option>300</option><option>500</option></select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba dep\u00f3sitos</span><select><option>1</option><option selected>2</option><option>3</option></select></label>\n      <label class=\"f\"><span class=\"lab\">Tama\u00f1o dep\u00f3sitos <small>(L)</small></span><select><option>750</option><option>1000</option><option selected>1100</option><option>2000</option></select></label>\n    </div>\n\n    <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:12px 0 4px;\">Tiempos</div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje de Peines (H) <small>(cuadrilla x2)</small></span><input type=\"number\" min=\"0\" value=\"4\"></label>\n      <label class=\"f\"><span class=\"lab\">Tiempo de montaje nuevo GP <small>(cuadrilla x2)</small></span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje <small>(cuadrilla x2)</small></span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input placeholder=\"\u2014\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros tiempos de montaje <small>(cuadrilla x2)</small></span><input type=\"number\" min=\"0\" value=\"\" placeholder=\"0\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input placeholder=\"\u2014\"></label>\n    </div>\n    <div class=\"grid g4\">\n      <label class=\"f\"><span class=\"lab\">Otros trabajos extra <small>(\u20ac)</small></span><input type=\"text\" inputmode=\"decimal\" value=\"\" placeholder=\"0,00\" class=\"euro\"></label>\n      <label class=\"f span3\"><span class=\"lab\">Especificar</span><input placeholder=\"\u2014\"></label>\n    </div>\n  </div>\n\n  <!-- 10. PEINES -->\n  <div class=\"card\">\n    <div class=\"t\">Peines (topolog\u00eda) por tipo de peines</div>\n    <div id=\"peines\"></div>\n  </div>\n\n</div>\n\n<script>\nconst PLAST={20:25,25:32,30:40,40:50,50:63,60:75,80:90,100:110};\nconst ACOM=[[20,2,1,1,0,0],[25,6,4,3,2,1],[30,15,11,9,7,5],[40,60,40,33,22,17],[50,100,70,55,37,30],[60,180,120,90,60,50],[80,400,300,250,200,150]];\nconst ALIM=[[30,2,1,1,0,0],[40,5,3,2,2,1],[50,25,16,14,10,6],[60,75,50,45,40,30],[80,120,90,80,70,60],[100,200,150,130,110,90]];\nconst TI={\"TIPO A\":0,\"TIPO B\":1,\"TIPO C\":2,\"TIPO D\":3,\"TIPO E\":4};\nconst EQUIP_TIPO={\"Cocina + Lavadero + sanitario\":\"TIPO A\",\"Cocina + Lavadero + aseo\":\"TIPO B\",\"Cocina + Lavadero + ba\u00f1o\":\"TIPO C\",\"Cocina + Office + Lavadero + ba\u00f1o + aseo\":\"TIPO D\",\"Cocina + Office + Lavadero + 2 ba\u00f1o + aseo\":\"TIPO E\",\"Otros\":\"TIPO F\"};\nfunction diamBase(t,n,tipo){const i=TI[tipo];if(i===undefined)return null;for(const f of t){if(f[1+i]>0&&n<=f[1+i])return f[0];}return null;}\nfunction dAco(n,tipo,L){let d=diamBase(ACOM,n,tipo);if(d===null)return\"\u2014\";if(L>15)d+=20;else if(L>6)d+=10;return(PLAST[d]||d)+\" mm\";}\nfunction dAli(n,tipo,L){let d=diamBase(ALIM,n,tipo);if(d===null)return\"\u2014\";if(L>40)d+=20;else if(L>15)d+=10;return(PLAST[d]||d)+\" mm\";}\n\nfunction pp(t,h,n){const M={\"SIMPLE\":[1,0,0],\"SIMPLE+1\":[1,1,0],\"1-SIMPLE\":[1,0,h],\"1-SIMPLE+1\":[1,1,h],\"SIMPLE-1\":[1,0,h*(n+1)],\"SIMPLE-2\":[1,0,h*(2*n+1)],\"1-SIMPLE-1\":[1,0,h*(n+1)+h],\"1-SIMPLE-2\":[1,0,h*(2*n+1)+h],\"DOBLE\":[2,0,0],\"DOBLE+1\":[2,1,0],\"DOBLE+2\":[2,2,0],\"1-DOBLE\":[2,0,h],\"2-DOBLE\":[2,0,2*h],\"1-DOBLE+1\":[2,1,h],\"2-DOBLE+1\":[2,1,2*h],\"1-DOBLE+2\":[2,2,h],\"DOBLE-1\":[2,0,h],\"DOBLE-2\":[2,0,2*h],\"2-DOBLE+2\":[2,2,2*h]};return M[t]||[1,0,0];}\nconst TIPOS=[\"SIMPLE\",\"SIMPLE+1\",\"SIMPLE-1\",\"SIMPLE-2\",\"1-SIMPLE\",\"1-SIMPLE+1\",\"1-SIMPLE-1\",\"1-SIMPLE-2\",\"DOBLE\",\"DOBLE+1\",\"DOBLE+2\",\"DOBLE-1\",\"DOBLE-2\",\"1-DOBLE\",\"2-DOBLE\",\"1-DOBLE+1\",\"2-DOBLE+1\",\"1-DOBLE+2\",\"2-DOBLE+2\"];\nconst EQUIPS=Object.keys(EQUIP_TIPO);\nfunction pTubo(t,h,n){const[k,p,R]=pp(t,h,n);return k*h*(n+1)*(n+2)/2+p*h*(n+2)-R;}\nfunction pViv(t,n){const[k,p]=pp(t,1,n);return k*(n+1)+p;}\n\nconst $=id=>document.getElementById(id);\nconst zonas={\n  baja:[],\n  resto:[\n    {puerta:\"1\",equip:\"Cocina + Lavadero + ba\u00f1o\",n:9},\n    {puerta:\"2\",equip:\"Cocina + Lavadero + ba\u00f1o\",n:9},\n    {puerta:\"3\",equip:\"Cocina + Lavadero + ba\u00f1o\",n:9},\n    {puerta:\"4\",equip:\"Cocina + Lavadero + ba\u00f1o\",n:9}\n  ],\n  atico:[]\n};\nconst CONT={baja:\"vbaja\",resto:\"vresto\",atico:\"vatico\"};\nlet peines=[{puerta:\"1\",tipo:\"1-SIMPLE\",giros:\"\",enganche:\"EXT\",peineV:\"V-EXT\",maIE:\"EXTERIOR\",maEng:\"ENGANCHA EN COCINAS\",mnSube:\"SUBE POR FACHADA DELANTERA\",mnBaja:\"NO BAJA\",tramos:[{long:\"9,5\",prot:\"B.FORJADO\"}]}];\n\nfunction renderZona(z){\n  const arr=zonas[z],c=$(CONT[z]);c.innerHTML=\"\";\n  arr.forEach((v,i)=>{\n    const r=document.createElement(\"div\");r.className=\"vrow\";\n    const o=`<option ${!v.equip?'selected':''}></option>`+EQUIPS.map(e=>`<option ${e===v.equip?'selected':''}>${e}</option>`).join(\"\");\n    const pu=`<option ${!v.puerta?'selected':''}></option>`+[\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"DCHA\",\"IZDA\",\"CENTRO\"].map(x=>`<option ${x===v.puerta?'selected':''}>${x}</option>`).join(\"\");\n    r.innerHTML=`<label class=\"f\"><span class=\"lab\">Puerta</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"vp\">${pu}</select></label>\n      <label class=\"f\"><span class=\"lab\">Equipamiento</span><select data-z=\"${z}\" data-i=\"${i}\" class=\"ve\">${o}</select></label>\n      <label class=\"f\"><span class=\"lab\">N\u00ba de viviendas</span><div class=\"derived\">${v.n||0}</div></label>\n      <label class=\"f\"><span class=\"lab\">Tipo</span><div class=\"derived\">${EQUIP_TIPO[v.equip]||''}</div></label>\n      <button class=\"del\" data-z=\"${z}\" data-i=\"${i}\">\u00d7</button>`;\n    c.appendChild(r);\n  });\n  c.querySelectorAll(\".vp\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].puerta=e.target.value;recalc();});\n  c.querySelectorAll(\".ve\").forEach(s=>s.onchange=e=>{zonas[e.target.dataset.z][+e.target.dataset.i].equip=e.target.value;renderZona(e.target.dataset.z);recalc();});\n  c.querySelectorAll(\".del\").forEach(b=>b.onclick=e=>{zonas[e.target.dataset.z].splice(+e.target.dataset.i,1);renderZona(e.target.dataset.z);recalc();});\n}\nfunction renderVivs(){renderZona(\"baja\");renderZona(\"resto\");renderZona(\"atico\");}\nfunction todasViviendas(){return [...zonas.baja,...zonas.resto,...zonas.atico];}\nconst OPT_ENGANCHE=[\"EXT\",\"INT-FACIL\",\"INT-MEDIO\",\"INT-DIFICIL\"];\nconst OPT_PEINEV=[\"V-INT\",\"V-EXT\"];\nconst OPT_IE=[\"INTERIOR\",\"EXTERIOR\"];\nconst OPT_ENGCB=[\"ENGANCHA EN COCINAS\",\"ENGANCHA EN BA\u00d1OS\"];\nconst OPT_PROT=[\"B.FORJADO\",\"CANALETA\",\"F.VIGA\",\"F.TECHO\",\"B.LADRILLO\"];\nconst OPT_SUBE=[\"SUBE POR FACHADA DELANTERA\",\"SUBE POR FACHADA LATERAL DERECHA\",\"SUBE POR FACHADA LATERAL IZQUIERDA\",\"SUBE POR FACHADA TRASERA\",\"SUBE POR PATIO DERECHO\",\"SUBE POR PATIO CENTRAL\",\"SUBE POR PATIO IZQUIERDO\",\"SUBE POR SCHUNT\"];\nconst OPT_BAJA=[\"NO BAJA\",\"BAJA POR FACHADA DELANTERA\",\"BAJA POR FACHADA LATERAL DERECHA\",\"BAJA POR FACHADA LATERAL IZQUIERDA\",\"BAJA POR FACHADA TRASERA\",\"BAJA POR PATIO DERECHO\",\"BAJA POR PATIO CENTRAL\",\"BAJA POR PATIO IZQUIERDO\",\"BAJA POR SCHUNT\"];\nconst sel=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join(\"\");\nconst selB=(arr,v)=>`<option ${!v?'selected':''}></option>`+sel(arr,v);\nconst subH=t=>`<div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin:8px 0 4px;\">${t}</div>`;\n\nfunction tramosHTML(i,m,arr){\n  const cols=(arr||[]).map((tr,t)=>`\n    <div style=\"display:flex;flex-direction:column;gap:4px;\">\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <label class=\"f\" style=\"flex:1;\"><span class=\"lab\">Longitud <small>(m)</small></span><input data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"long\" type=\"text\" inputmode=\"decimal\" class=\"long\" value=\"${tr.long||''}\"></label>\n        <button class=\"del tdel\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">\u00d7</button>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:end;\">\n        <select data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\" data-f=\"prot\" style=\"flex:1;\"><option ${!tr.prot?'selected':''}></option>${sel(OPT_PROT,tr.prot)}</select>\n        <button class=\"tadd addtramo\" data-i=\"${i}\" data-m=\"${m}\" data-t=\"${t}\">+</button>\n      </div>\n    </div>`).join(\"\");\n  return `<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end;\">${cols}</div>`;\n}\nfunction renderPeines(){\n  const c=$(\"peines\");c.innerHTML=\"\";\n  if(!peines.length){\n    const ab=document.createElement(\"button\");ab.className=\"add\";ab.title=\"A\u00f1adir peine\";ab.textContent=\"+\";\n    ab.onclick=()=>{peines.push(nuevoPeine());renderPeines();};\n    c.appendChild(ab);return;\n  }\n  peines.forEach((pe,i)=>{\n    const b=document.createElement(\"div\");\n    b.style.cssText=\"border:1px solid var(--g200);border-radius:8px;padding:8px 10px;margin-bottom:8px;position:relative;\";\n    b.innerHTML=`\n      <div style=\"position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;\">\n        <button class=\"add padd\" data-i=\"${i}\" title=\"A\u00f1adir peine\">+</button>\n        <button class=\"del pdel\" data-i=\"${i}\">\u00d7</button>\n      </div>\n      <div style=\"font-weight:700;color:var(--g900);font-size:13px;margin-bottom:6px;\">PEINE ${i+1}</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:16px;\">\n        <div>\n          <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante actual</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Interior / Exterior</span><select data-i=\"${i}\" data-k=\"maIE\">${selB(OPT_IE,pe.maIE)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"maEng\">${selB(OPT_ENGCB,pe.maEng)}</select></label>\n          </div>\n        </div>\n        <div>\n          <div style=\"font-size:10px;color:var(--g900);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:4px;\">Montante nuevo</div>\n          <div class=\"grid g2\">\n            <label class=\"f\"><span class=\"lab\">Recorrido (sube)</span><select data-i=\"${i}\" data-k=\"mnSube\">${selB(OPT_SUBE,pe.mnSube)}</select></label>\n            <label class=\"f\"><span class=\"lab\">Recorrido (baja)</span><select data-i=\"${i}\" data-k=\"mnBaja\">${selB(OPT_BAJA,pe.mnBaja)}</select></label>\n          </div>\n        </div>\n      </div>\n      <div class=\"grid g5\" style=\"margin-top:8px;\">\n        <label class=\"f\"><span class=\"lab\">Puerta(s)</span><input data-i=\"${i}\" data-k=\"puerta\" value=\"${pe.puerta||''}\"></label>\n        <label class=\"f\"><span class=\"lab\">Tipo de peine</span><select data-i=\"${i}\" data-k=\"tipo\">${selB(TIPOS,pe.tipo)}</select></label>\n        <label class=\"f\"><span class=\"lab\">N\u00ba giros extra</span><input data-i=\"${i}\" data-k=\"giros\" type=\"number\" min=\"0\" value=\"${pe.giros||''}\" placeholder=\"0\"></label>\n        <label class=\"f\"><span class=\"lab\">Enganche</span><select data-i=\"${i}\" data-k=\"enganche\">${selB(OPT_ENGANCHE,pe.enganche)}</select></label>\n        <label class=\"f\"><span class=\"lab\">Peine (V)</span><select data-i=\"${i}\" data-k=\"peineV\">${selB(OPT_PEINEV,pe.peineV)}</select></label>\n      </div>\n      <div style=\"margin-top:8px;\">${tramosHTML(i,'tramos',pe.tramos)}</div>`;\n    c.appendChild(b);\n  });\n  c.querySelectorAll(\"[data-k]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{peines[+e.target.dataset.i][e.target.dataset.k]=e.target.value;});\n  });\n  c.querySelectorAll(\"[data-f]\").forEach(el=>{\n    const ev=el.tagName===\"SELECT\"?\"change\":\"input\";\n    el.addEventListener(ev,e=>{const d=e.target.dataset; peines[+d.i][d.m][+d.t][d.f]=e.target.value;});\n  });\n  c.querySelectorAll(\".addtramo\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t+1,0,{long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".tdel\").forEach(b=>b.onclick=e=>{const d=e.currentTarget.dataset; peines[+d.i][d.m].splice(+d.t,1); if(!peines[+d.i][d.m].length)peines[+d.i][d.m].push({long:\"\",prot:\"\"}); renderPeines();});\n  c.querySelectorAll(\".pdel\").forEach(b=>b.onclick=e=>{peines.splice(+e.currentTarget.dataset.i,1);renderPeines();});\n  c.querySelectorAll(\".padd\").forEach(b=>b.onclick=()=>{peines.push(nuevoPeine());renderPeines();});\n}\nfunction tipoEdificio(){\n  const orden=[\"TIPO A\",\"TIPO B\",\"TIPO C\",\"TIPO D\",\"TIPO E\",\"TIPO F\"];let best=\"TIPO A\";\n  todasViviendas().forEach(v=>{const t=EQUIP_TIPO[v.equip];if(t&&orden.indexOf(t)>orden.indexOf(best))best=t;});\n  return best;\n}\nfunction recalc(){\n  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};\n  const n=+$(\"plantas\").value||0,h=+$(\"altura\").value||0;\n  const nSum=todasViviendas().reduce((a,v)=>a+(+v.n||0),0);\n  $(\"nsum\").value=nSum;\n  const tipo=tipoEdificio();\n  set(\"tipoEdif\",tipo);\n  const numAli=parseFloat(String(($(\"longAli\")||{}).value||\"\").replace(\",\",\".\"))||0;\n  const a=dAco(nSum,tipo,+$(\"longCon\").value||0),al=dAli(nSum,tipo,numAli);\n  set(\"dAco\",a);set(\"dAli\",al);\n  const sub=nSum*160+($(\"gpInstala\").checked?52:0);\n  set(\"rSub\",sub.toLocaleString(\"es-ES\")+\" \u20ac\");set(\"dSub\",sub.toLocaleString(\"es-ES\")+\" \u20ac\");\n}\ndocument.querySelectorAll(\"button.add[data-z]\").forEach(b=>b.onclick=()=>{const z=b.dataset.z;zonas[z].push({puerta:\"\",equip:\"\",n:\"\"});renderZona(z);recalc();});\nfunction nuevoPeine(){return {puerta:\"\",tipo:\"\",giros:\"\",enganche:\"\",peineV:\"\",maIE:\"\",maEng:\"\",mnSube:\"\",mnBaja:\"\",tramos:[{long:\"\",prot:\"\"}]};}\n[\"plantas\",\"altura\",\"longCon\",\"longAli\",\"gpInstala\"].forEach(id=>{const el=$(id);if(el){el.addEventListener(\"input\",recalc);el.addEventListener(\"change\",recalc);}});\nconst BATERIAS=\"4T-2F,6T-2F,6T-3F,9T-3F,10T-2F,12T-2F,12T-3F,14T-2F,15T-3F,16T-2F,18T-2F,18T-3F,20T-2F,21T-3F,22T-2F,24T-2F,24T-3F,26T-2F,27T-3F,28T-2F,30T-2F,30T-3F,33T-3F,36T-3F,39T-3F,42T-3F,45T-3F\".split(\",\");\ndocument.querySelectorAll(\"select.bat\").forEach((s,idx)=>{const sel=idx===0?\"22T-2F\":\"24T-2F\";s.innerHTML=BATERIAS.map(b=>`<option ${b===sel?'selected':''}>${b}</option>`).join(\"\");});\nrenderVivs();renderPeines();recalc();\n\n// ---- Guardar / precargar contra el Sheet (v\u00eda el m\u00f3dulo) ----\nfunction camposEstaticos(){\n  const dyn=[\"vbaja\",\"vresto\",\"vatico\",\"peines\"].map(id=>$(id)).filter(Boolean);\n  const dentro=el=>dyn.some(d=>d.contains(el));\n  return [...document.querySelectorAll(\".page input, .page select\")].filter(el=>!dentro(el) && el.id!==\"btnGuardar\");\n}\nfunction serializar(){\n  return { v: camposEstaticos().map(el=>el.value), zonas, peines };\n}\nfunction hidratar(d){\n  if(!d) return;\n  if(d.zonas){ zonas.baja=d.zonas.baja||[]; zonas.resto=d.zonas.resto||[]; zonas.atico=d.zonas.atico||[]; }\n  if(Array.isArray(d.peines)&&d.peines.length){ peines.length=0; d.peines.forEach(p=>peines.push(p)); }\n  renderVivs(); renderPeines();\n  if(Array.isArray(d.v)){ camposEstaticos().forEach((el,i)=>{ if(i<d.v.length) el.value=d.v[i]; }); }\n  recalc();\n}\nconst token = new URLSearchParams(location.search).get(\"token\")||\"\";\n$(\"btnGuardar\").onclick=async()=>{\n  const msg=$(\"saveMsg\"); msg.textContent=\"Guardando\u2026\"; msg.style.color=\"var(--g500)\";\n  try{\n    const body=new URLSearchParams();\n    body.set(\"direccion\", ($(\"f_direccion\")||{}).value||\"\");\n    body.set(\"ccpp_id\", \"\");\n    body.set(\"npresupuesto\", ($(\"f_npresupuesto\")||{}).value||\"\");\n    body.set(\"fecha\", ($(\"f_fecha\")||{}).value||\"\");\n    body.set(\"revision\", ($(\"f_revision\")||{}).value||\"\");\n    body.set(\"payload\", JSON.stringify(serializar()));\n    const r=await fetch(\"/plan5/guardar?token=\"+encodeURIComponent(token),{method:\"POST\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded\"},body:body.toString()});\n    const j=await r.json().catch(()=>({ok:false}));\n    if(j.ok){ msg.textContent=\"Guardado \u2713\"; msg.style.color=\"var(--success)\"; }\n    else { msg.textContent=\"Error al guardar\"; msg.style.color=\"var(--danger)\"; }\n  }catch(e){ msg.textContent=\"Error al guardar\"; msg.style.color=\"var(--danger)\"; }\n};\nif(window.__PLAN5_DIR__){ var _fd=$(\"f_direccion\"); if(_fd) _fd.value=window.__PLAN5_DIR__; }\nif(window.__PLAN5_VOLVER_ID__){ var _bv=$(\"btnVolver\"); if(_bv){ var _t=window.__PLAN5_TOKEN__||\"\"; _bv.href=\"/presupuestos/expediente?id=\"+encodeURIComponent(window.__PLAN5_VOLVER_ID__)+(_t?\"&token=\"+encodeURIComponent(_t):\"\"); _bv.style.display=\"inline-block\"; } }\nif(window.__PLAN5_SAVED__) hidratar(window.__PLAN5_SAVED__);\ndocument.querySelectorAll('input[type=\"number\"]').forEach(inp=>{\n  inp.addEventListener(\"input\",()=>{ if(inp.value===\"0\") inp.value=\"\"; });\n});\ndocument.querySelectorAll(\"input.euro\").forEach(inp=>{\n  inp.addEventListener(\"blur\",()=>{\n    let n=parseFloat(inp.value.replace(/\\./g,\"\").replace(\",\",\".\"));\n    inp.value = isNaN(n) ? \"\" : n.toLocaleString(\"es-ES\",{minimumFractionDigits:2,maximumFractionDigits:2});\n  });\n  inp.addEventListener(\"focus\",()=>{ inp.value=inp.value.replace(/\\./g,\"\").replace(\",\",\".\"); });\n});\nfunction fmtLong(inp){ let n=parseFloat(String(inp.value).replace(\",\",\".\")); inp.value = isNaN(n) ? \"\" : n.toFixed(1).replace(\".\",\",\"); inp.dispatchEvent(new Event(\"input\",{bubbles:true})); }\ndocument.addEventListener(\"blur\",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains(\"long\")) fmtLong(e.target); }, true);\n</script>\n</body>\n</html>\n";

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
  // TODO: diametroAcometida(nSum,tipo,long) y diametroAlimentacion(...) desde NORMATIVA
  // + ajuste por longitud + redondeo a plástico. Montante: pendiente.
  R.dimensiones.diamAcometida = 0;
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

function paso4_desglose(R /*, F */) {
  // Construir las ~217 líneas: concepto, tipo, cantidad (entradas/lookup/peines),
  // precio (PRECIOS), total, tipoCoste (MAT/MO/ALB/GP), capítulo. El grueso a afinar.
  R.desglose = [];
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
    try {
      const dir = req.query.dir || "";
      if (dir) { const f = await leerFila(dir); if (f && f.row[6]) saved = f.row[6]; }
    } catch (e) { /* sin Sheet/pestaña aún: pantalla en blanco */ }
    const inj = "window.__PLAN5_SAVED__=" + saved + ";window.__PLAN5_DIR__=" + JSON.stringify(req.query.dir || "") + ";window.__PLAN5_VOLVER_ID__=" + JSON.stringify(req.query.id || "") + ";window.__PLAN5_TOKEN__=" + JSON.stringify(req.query.token || "") + ";";
    const html = TOMA_DATOS_HTML.replace("/*__PLAN5_SAVED__*/", inj);
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
