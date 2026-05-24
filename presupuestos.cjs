// ===================================================================
// MÓDULO PRESUPUESTOS — Araujo CCPP
// Build: 2026-05-24 v17.90 (Sobre v17.89: el formulario de relleno de documentos pasa a mostrar UNA SOLA LISTA de datos SIN DUPLICAR (petición Guille: "solo quiero ver lo que realmente hay que rellenar o cambiar"). Antes mostraba un bloque por documento repitiendo campos comunes (presidente, NIF presidente, NIF comunidad, propietario, etc.) y además el campo "Piso" que ya se eligió en el menú. Cambios: (1) /docs/huecos ahora agrupa los huecos de TODOS los documentos elegidos en una lista única por clave de campo (Map), excluyendo OCULTOS = comunidad + piso + pisos (la comunidad la pone el programa; el piso ya se eligió en el menú). Devuelve { campos:[{clave,label,valor,manual,docs}] }. Cada campo guarda en `docs` qué documentos lo usan. (2) /docs/generar ahora recibe { id, claves, vivienda, valores } (valores = lista única rellenada) y RECONSTRUYE los valores de cada documento: reparte cada valor común a los documentos que lo usan + inyecta piso/pisos (del piso elegido) y comunidad (del expediente). (3) El modal pinta una sola lista de inputs (no bloques por documento) y al generar recoge los valores por data-hueco y los manda como lista única. Verificado: lista sin duplicados, sin piso/comunidad; el reparto lleva cada dato a los documentos correctos (ej: NIF presidente escrito 1 vez va a mantener_presion Y renunciar_presion). Sin cambios en el Sheet ni en la generación del PDF en sí.)
// Build: 2026-05-24 v17.89 (Sobre v17.88: el PIE de los documentos PDF se ancla al FONDO de la página (estilo carta formal, opción A de Guille). Tras escribir el cuerpo se calcula el alto del pie (heightOfString) y se coloca en y = altoPagina - margenInferior - altoPie. PROTECCIÓN anti-solape: si el cuerpo llega tan abajo que el pie no cabe (yFondo <= yTrasCuerpo+24), el pie se pone justo tras el cuerpo con 24px de separación (nunca se solapa; en documentos muy largos pasa a la 2ª página de forma limpia). Verificado con documento corto (pie al fondo, 1 página) y largo (pie no se solapa). Los 6 documentos reales de EMASESA son cortos -> siempre 1 página con el pie abajo. Sin otros cambios.)
// Build: 2026-05-24 v17.88 (Sobre v17.87: más separación entre la línea del encabezado y el cuerpo del documento — el moveDown tras la línea pasa de 1.4 a 2.5 (~2 retornos de carro). Ajuste estético menor pedido por Guille. Sin otros cambios.)
// Build: 2026-05-24 v17.87 (Sobre v17.86: FIX — caracteres raros "Đ" en el PDF de documentos. Los textos de la tab doc_plantillas (y los valores) vienen con saltos de línea Windows CRLF (\r\n); pdfkit interpreta bien el \n pero dibujaba el \r sobrante como un glifo extraño "Đ" en cada salto de línea / corte de párrafo. FIX: normalizar saltos antes de escribir en el PDF — _rellenarHuecos quita los \r (replace \r\n -> \n y \r -> \n) tanto del texto de la plantilla como de los valores; y el encabezado (que no pasa por _rellenarHuecos) se limpia igual antes de doc.text. Verificado: tras la limpieza no queda ningún \r en encabezado/cuerpo/pie y el PDF sale limpio. Sin cambios en datos del Sheet.)
// Build: 2026-05-24 v17.86 (Sobre v17.85: 3 ajustes visuales en el PDF de documentos (generarPdfDocumentos). (1) El encabezado general (las 3 líneas de EMASESA) pasa a alinearse a la DERECHA (align:right, antes left). (2) Se añade una LÍNEA HORIZONTAL continua negra (1pt) justo debajo del encabezado, de margen izquierdo a margen derecho, separándolo del cuerpo. (3) El cuerpo del documento y el pie pasan de 12pt a 14pt (fuente Helvetica, equivalente visual de Arial; Arial real no está disponible en pdfkit sin subir el .ttf al servidor — decisión Guille: Helvetica 14pt). Sin cambios en datos, huecos ni lógica de generación.)
// Build: 2026-05-24 v17.85 (Sobre v17.84: el campo "Comunidad (CCPP)" se QUITA del formulario de relleno de documentos (opción A de Guille). Aparecía repetido en cada documento del lote y es redundante: la comunidad la conoce el programa y es común a todos. (1) /docs/huecos ahora FILTRA el hueco "comunidad" de los campos visibles (def.huecos.filter(h => h.clave !== "comunidad")), así no se muestra ni se pregunta. (2) /docs/generar calcula la comunidad (tipo_via + direccion) y la INYECTA en los valores de cada documento si no viene del form, de modo que [comunidad] se sigue rellenando en el PDF aunque ya no sea un campo editable. Verificado: ningún documento queda sin campos visibles al quitar comunidad (el que menos, piso_disidente, conserva piso y titular). El resto de huecos (propietario, piso, NIF, etc.) siguen mostrándose y editándose igual.)
// Build: 2026-05-24 v17.84 (Sobre v17.83: FIX del Bloque 2 + ajustes estéticos/orden. (1) FIX CRÍTICO "Faltan datos": los endpoints nuevos /docs/huecos y /docs/generar recibían el body como JSON (Content-Type application/json), pero el backend NO tiene express.json() y TODO el módulo usa formularios (x-www-form-urlencoded) — req.body llegaba vacío -> id y claves vacíos -> "Faltan datos" (caso real: Mantenimiento del grupo de presión y cualquier documento). Ahora el modal envía los 2 POST como x-www-form-urlencoded (igual que el resto del programa), pasando las listas claves/docs como JSON dentro de un campo de texto; los endpoints las parsean con JSON.parse tolerante a error. Cadena verificada: mismo formato que los ~9 fetch existentes del módulo, que funcionan en producción. (2) Botón "📄 Plantillas documentos" igualado estéticamente al de "📧 Plantillas mail" (mismo azul lavanda #EEF2FF/#4F46E5/#C7D2FE, antes caqui). (3) Botón "📄 IMPRIMIR DOCUMENTOS" igualado al de "📁 CARPETA DRIVE" (mismas clases ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme, sin color inline; antes caqui). (4) ORDEN del listado de documentos en el menú de impresión fijado en código (ORDEN_DOCS, no depende del orden de la tab): Mantenimiento del grupo de presión, Renuncia al grupo de presión, Autorización de usufructo, Piso disidente, Solicitud de contador único, Autorización paso de instalaciones.)
// Build: 2026-05-24 v17.83 (Sobre v17.82: SPRINT A — BLOQUE 2: generación de DOCUMENTOS en PDF desde la ficha del expediente. Necesita pdfkit (ya instalado en backend). (1) Botón "📄 IMPRIMIR DOCUMENTOS" en la cabecera de la caja DATOS CCPP, junto a "📁 CARPETA DRIVE", visible en TODAS las fases. (2) Helpers nuevos: DOCS_GENERALES (mantener_presion, renunciar_presion) y DOCS_PARTICULARES (paso_instalaciones, usufructo, piso_disidente, contador_unico); DOC_HUECOS define los huecos de cada documento y su origen (comunidad:<campo> / piso:<campo> / manual / auto). Mapeo confirmado con Guille: [comunidad]=tipo_via+direccion, [presidente]=comunidades.presidente, [propietario]/[titular]=pisos.nota_simple, [usufructuario]=pisos.nombre, [piso]/[pisos]=pisos.vivienda; los NIF (propietario/usufructuario/presidente/comunidad) son MANUAL (no existen en el Sheet, salen vacíos para rellenar); [fecha]=hoy en español con mes en palabra. (3) _rellenarHuecos sustituye [huecos] por su valor; los sin dato salen como línea "__________" para rellenar a mano. generarPdfDocumentos crea el PDF con UNA PÁGINA por documento: encabezado global + cuerpo relleno + pie global (con [fecha] automática). (4) 3 endpoints: GET /presupuestos/docs/menu (lista documentos + pisos del expediente), POST /presupuestos/docs/huecos (huecos precargados de los documentos elegidos para un piso), POST /presupuestos/docs/generar (genera y descarga el PDF). (5) Modal en la ficha: paso 1 elegir documentos + piso (el selector de piso solo aparece si se marca algún documento particular), paso 2 formulario de huecos editables, paso 3 generar y descargar PDF al ordenador. El enganche del PDF al modal de mail queda APARCADO para más adelante (decisión Guille: de momento solo generar/guardar; si se quiere enviar, se adjunta como enlace al mail como hasta ahora).)
// Build: 2026-05-24 v17.82 (Sobre v17.81: SPRINT A — BLOQUE 1: pantalla de PLANTILLAS DE DOCUMENTOS (EMASESA). NO necesita pdfkit (eso es el Bloque 2). (1) Nueva tab `doc_plantillas` del Sheet (cols: clave | titulo | cuerpo | activo) con 8 filas: _ENCABEZADO_GLOBAL, los 6 cuerpos de documento (paso_instalaciones, usufructo, mantener_presion, renunciar_presion, contador_unico, piso_disidente) y _PIE_GLOBAL. (2) Capa de datos nueva: RANGO_DOC_PLANTILLAS y funciones leerPlantillasDoc / leerPlantillaDoc / guardarPlantillaDoc, calcadas al patrón de mail_plantillas pero más simples (solo clave/titulo/cuerpo; activo se conserva sin tocarse, no se edita desde la pantalla). guardarPlantillaDoc actualiza la fila por clave si existe, o la añade. (3) Nueva pantalla GET /presupuestos/plantillas-doc + POST /presupuestos/plantillas-doc/guardar, mismo esquema que /presupuestos/plantillas (mail): vistaPlantillasDoc reutiliza las MISMAS clases .ptl-acordeon* y el MISMO script de toggle. Acordeones que se despliegan al clic con su botón Guardar. Diferencias vs mail: cada documento solo tiene TÍTULO + CUERPO (sin asunto/días/cuenta/cco), NO hay interruptor "Activa" (la selección se hará al imprimir, Bloque 2), y hay DOS cajas especiales: encabezado general (arriba) y pie general (abajo), análogas al _PIE_GLOBAL de mail. (4) Nuevo botón "📄 Plantillas documentos" en renderCabeceraComun, junto a "📧 Plantillas mail" (aparece en HOY, listado y ficha, igual que el de mail), fondo caqui. Bloque 2 (botón en el expediente, menú de selección, formulario de datos y generación de PDF) pendiente de que Alberto añada pdfkit al package.json.)
// Build: 2026-05-24 v17.81 (Sobre v17.80: dos cambios en la cajita DATOS ECONÓMICOS de /presupuestos/hoy (las 4 cajas Total presupuestado / aceptado / pendiente / tramitado). (1) TIEMPO mostrado en MESES en vez de días: el helper fmtDias pasa a fmtMeses, que divide los días de cuadrilla-5 (g.tiempo, que ya lleva la fórmula ×2/5) entre 22 (días laborables/mes) y muestra 1 decimal + " meses". Aplica a las 4 cajas. La etiqueta "(cuadrilla 5)" se mantiene; el sufijo " meses" aclara la unidad. Ej: 876,9 días -> 39,9 meses. (2) BENEFICIO — regla Opción A acordada con Guille: la regla anterior (breal>0 ? breal : bprev) ante un beneficio_real NEGATIVO (pérdida) caía al previsto positivo, ocultando la pérdida. Ahora: si la obra ya tiene beneficio_real (campo no vacío) se usa Math.max(real,0) — una pérdida cuenta como 0, nunca resta del total; si aún no tiene real (vacío) se usa el previsto. Se distingue "real vacío" de "real 0/negativo" mirando el dato crudo c.beneficio_real (porque _num convierte vacío en 0). Como todos los acumuladores de beneficio (presupuestado/aceptado/pendiente/tramitado/cobrado/por cobrar) y los "Total (20%)" derivan de este mismo valor por obra, el cambio se propaga a todos automáticamente. Caso real: Regimiento de Soria 9 2 (real -1.628,44) pasa de contar +4.437,08 (previsto) a contar 0; el beneficio total presupuestado baja exactamente 4.437,08. Sin cambios en el Sheet ni en otras pantallas.)
// Build: 2026-05-24 v17.80 (Sobre v17.79: FIX CRÍTICO de pérdida de datos. ptlDiff (detector de "cambios sin guardar" de la ficha) comparaba TODOS los campos de la foto ptlOrig contra el formulario, incluidos campos que en ciertas fases NO tienen input en pantalla. Para esos, ptlValor devolvía '' (input inexistente) y se comparaba contra el valor real de la foto -> cambio FANTASMA. Al pulsar el botón HOY / salir / clic en enlace salía "Hay cambios sin guardar" sin que el usuario hubiera tocado nada, y al elegir "Guardar y salir" se escribía '' -> BORRABA el dato (que podía haberse puesto desde otra pantalla, p.ej. notas desde la pantalla HOY o la tabla de documentación). Caso real: notas "ANTONIO" en Tordo 18 (fase 09) se borraban al volver a HOY. Campos afectados: notas_pto en fases 05-09/ZZ (sin caja Notas, que solo existe en 01-04) y los económicos pto_total/mano_obra_*/material_*/tiempo_* en fases 01-02 (sin caja Datos económicos). FIX: ptlDiff ahora SALTA cualquier campo cuyo input no exista en el formulario (if (!el) continue) — si no hay input, el usuario no pudo cambiarlo, no es un cambio. Un solo punto (ptlDiff) que alimenta los 4 caminos de aviso (botón HOY, beforeunload, intercept de enlaces, ptlGuardar al salir), así que el fix cubre todos. Verificado: documentacion.cjs NO tiene este patrón (guarda campo a campo por blur con data-orig propio, sin foto global). Probada la lógica: sin tocar nada en fase 09/01 -> 0 cambios (no borra); cambio real con input presente -> se detecta.)
// Build: 2026-05-24 v17.79 (Sobre v17.78: FIX CRÍTICO — el endpoint POST /presupuestos/expediente/campo (el que guarda un campo cuando el usuario escribe en la ficha) llamaba a actualizarComunidad (reescribe la fila entera, SIN releído de verificación) en vez de a actualizarCampoComunidad (escribe solo la celda + relee + compara, añadida en v17.75-77). Resultado del bug: un campo podía salir VERDE en el front aunque la escritura no cuajara en el Sheet (caso real de Guille: escribió "PEPE" en notas, se puso verde 5s, pero no quedó guardado). La mejora del releído estaba metida en una función que NO la llamaba nadie. Ahora el endpoint usa actualizarCampoComunidad(rowIndex, campo, valor): el verde solo aparece si el dato está releído y confirmado en el Sheet; si no, el endpoint devuelve error y el campo se pinta ROJO. Campos que pasan por aquí (notas_pto, en_hoy, fechas, económicos editables) son todos compatibles (ninguno es de fórmula). PENDIENTE 2ª fase: blindar igual los ~17 guardados que cambian VARIOS campos a la vez (avance de fase, cron, cierres) y que siguen usando actualizarComunidad.)
// Build: 2026-05-24 v17.78 (Sobre v17.77: FIX feedback de guardado en la caja "Expedientes HOY" de /presupuestos/hoy. Ese textarea (hoy-exp-notas / hoy-piso-notas) usaba un _flashGuardado PROPIO y antiguo que ponía el color con border inline (solo borde, verde a 2s) en vez de las clases compartidas — por eso ahí no se veía el relleno verde ni el verde duraba 5s, a diferencia de la ficha del expediente. Ahora ese helper usa las clases .ptl-guardado-ok / .ptl-guardado-error de estilo-visual.cjs v1.16 (borde + relleno, verde 5s / rojo permanente), igual que los otros dos puntos del programa. Confirmado que NO queda ningún feedback de guardado con método inline antiguo (los únicos border inline restantes son del botón "Ejecutar cron", que es otra cosa). Resultado: los TRES sitios con feedback de guardado (ficha del expediente, tabla de documentación, caja Expedientes HOY) son ahora visualmente idénticos.)
// Build: 2026-05-24 v17.77 (Sobre v17.76: el protocolo de "guardado seguro y verificado" (escritura solo-celda + releído de verificación) se extiende a los CAMPOS DE PISO. _actualizarCampoPiso (que ya escribía solo la celda) gana el mismo releído: tras escribir en_hoy / notas_piso / nota_simple, relee esa celda de la pestaña `pisos` y compara con lo que se quiso guardar (comparación de texto con trim, ya que estos campos son de texto); si no coincide lanza error -> los endpoints /piso/toggle-hoy, /piso/guardar-notas-hoy y /piso/guardar-nota-simple ya devuelven status 500 con el error -> el front pinta el campo en ROJO. Resultado: AHORA TODOS los campos guardables del programa (ficha del expediente vía actualizarCampoComunidad + campos de piso vía _actualizarCampoPiso) usan el mismo protocolo: el verde solo aparece si el dato está de verdad releído y confirmado en el Sheet. Sin cambios en el front.)
// Build: 2026-05-24 v17.76 (Sobre v17.75: ESCRITURA "SOLO LA CELDA" (modelo Excel) en actualizarCampoComunidad. Antes, al guardar UN campo, se leía la fila entera, se cambiaba ese campo y se reescribían ~56 celdas vía actualizarComunidad. Eso tenía dos efectos no deseados: (a) reformateaba de pasada otros campos que el usuario NO había tocado (objToRow convierte a String / redondea números) — posible causa de "campos que se modifican solos"; y (b) aplicaba una regularización heredada 08_CYCP->09_TRAMITADA que ya no afecta a ninguna CCPP (verificado: 0 comunidades en 08 con fecha_cycp_completa). Ahora se escribe ÚNICAMENTE la celda del campo modificado (values.update sobre comunidades!<letra><fila>), con su formato correcto (número 2dec para importes, 1dec para tiempos, texto para el resto). PROTECCIÓN: las 4 columnas calculadas por fórmula (beneficio_previsto/real/desvio, tiempo_desvio) se RECHAZAN si llegan aquí (escribirlas borraría la fórmula). El releído de verificación de v17.75 se mantiene sobre esa misma celda. Consumidores verificados: endpoint /presupuestos/expediente/campo (guardado suelto) y documentacion.cjs (modo_documentacion=BOT, campo de texto) — ambos compatibles, ninguno dependía de reescribir la fila entera. Resultado: guardar un campo ya no toca ningún otro campo del Sheet, como en Excel. Coste por guardado: 1 escritura de 1 celda + 1 lectura de 1 celda (más barato que antes, que leía y escribía la fila entera).)
// Build: 2026-05-24 v17.75 (Sobre v17.74: BLINDAJE DEL GUARDADO — releído de verificación contra el Sheet. En actualizarCampoComunidad, tras escribir el campo, se RELEE esa misma celda del Sheet y se compara con el valor que se quiso guardar; si no coincide, se lanza un error que el endpoint /campo convierte en respuesta de fallo -> el front pinta el campo en ROJO. Antes el verde aparecía con solo recibir un 200, aunque la escritura no hubiera cuajado (caso real: celda verde pero al salir el dato se había perdido). La comparación es TOLERANTE según el tipo de campo (helper _mismoValorGuardado): texto exacto (trim); números/importes y tiempos por valor numérico (12.500,00 € == 12500); fechas por fecha normalizada YYYY-MM-DD (acepta ISO, serial de Sheets o ya formateada) — así no se dan falsos rojos por diferencias de formato. Los 4 campos calculados por fórmula (beneficio_previsto/real/desvio, tiempo_desvio) NO se releen (los calcula el Sheet, no los escribimos). Helpers nuevos: _colNumALetra (índice de columna -> letra A..BF) y _normFechaCmp. Coste: 1 lectura extra del Sheet por guardado (asumible al guardar campo a campo). Sin cambios en el front (el verde/rojo por campo ya se enganchó en v17.74).)
// Build: 2026-05-24 v17.74 (Sobre v17.73: FEEDBACK DE GUARDADO POR CAMPO (bloque de colores). Nuevo helper ptlFlashGuardado(name, ok) enganchado en los 3 puntos de salida de ptlGuardarCampo (OK / error HTTP / error de red). Al guardar un campo de la ficha del expediente: el recuadro donde se escribe se pone con borde VERDE 5s si guardó OK, o ROJO PERMANENTE si falló (hasta el siguiente guardado OK del mismo campo). Usa las clases compartidas .ptl-guardado-ok / .ptl-guardado-error de estilo-visual.cjs v1.15 (el aspecto vive en un solo sitio). Como ptlGuardarCampo es el punto único por el que pasan TODOS los campos de la ficha (Datos CCPP, económicos, notas, etc.), todos heredan el feedback sin tocarlos uno a uno. La píldora global ptlSetPill se mantiene por dentro (sigue alimentando el flujo "salir con cambios sin guardar") pero deja de ser el feedback visible principal. NOTA: documentacion.cjs v17.28 hace lo mismo en su tabla con su propio _flashGuardado adaptado a las mismas clases. Sin cambios en backend ni en el guardado en sí.)
// Build: 2026-05-24 v17.73 (Sobre v17.72: el modal de mail CON PLANTILLA (ptl-modal-mail) iguala su ESTRUCTURA DE CAMPOS a la del modal de mail MANUAL (ptlComSendModal), manteniendo cada uno su lógica de envío separada (el de plantilla sigue avanzando fase, con botón "Saltar envío", avisos de cron y modo reenvío; el manual sigue siendo compositor puro). Cambios SOLO en el modal de plantilla: (1) AÑADIDO campo CCO (opcional) entre CC y Asunto, igual que el manual. Antes el CCO solo salía de la plantilla del Sheet (col I cco) y no era editable; ahora hay input ptl-mm-cco. (2) Adjuntos: el textarea "uno por línea" (ptl-mm-adjuntos) se sustituye por 3 filas Etiqueta+URL (ptl-mm-adj{1,2,3}{lbl,url}) idénticas al manual. Al abrir, adjuntos_fijos de la plantilla se reparte en esas 3 filas: el reparto se guía SOLO por la presencia de http(s) — si un trozo NO tiene URL es una etiqueta sola (recordatorio para pegar el link al enviar, p.ej. "PRESUPUESTO:", "CONTRATOS:", "CARTAS DE PAGO:") y va al campo Etiqueta tal cual; si tiene URL se separa etiqueta y URL por el http (quitando el ': ' separador). Antes (primera versión de v17.73) se intentaba separar por el ': ' previo al http, lo que metía las etiquetas-sin-url en el campo URL en vez del de Etiqueta (visible en fases 03, 04_REENVIO, 05_ACEPTACION_PTO, 08_INICIO_CYCP). Al enviar, las 3 filas se recomponen en "LABEL: url || LABEL: url", formato que el endpoint /enviar-mail ya acepta (parsea por /\\|\\||[\\r\\n]+/). (3) El JS de envío añade fd.append('cco', ...) y monta los adjuntos desde las 6 cajas. (4) BACKEND: el endpoint /presupuestos/expediente/enviar-mail ahora respeta el CCO escrito por el usuario en el modal (req.body.cco); si viene vacío, cae al cco de la plantilla como hasta ahora. Esto aplica tanto al envío normal (ccoF) como al reenvío manual "Reenviar presupuesto revisado" (rama reenvio, ccoR). Los reenvíos AUTOMÁTICOS del cron NO usan el modal ni mandan body, así que siguen usando plantilla.cco intactos. Sin cambios en el modal manual ni en mail-enviar-manual ni en la lógica de avance de fase. Resultado: ambos modales se ven y se rellenan igual; lo único que difiere es de dónde salen los datos (en blanco en el manual, precargados de plantilla en el otro) y el comportamiento de envío/avance, que es intencionadamente distinto. (5) VISUAL — listado de adjuntos del HISTORIAL de mails ahora muestra cada adjunto (LABEL: url) en su PROPIA LÍNEA en vez de pegados con " || ". Aplicado en los DOS puntos que lo renderizan: renderAdjuntos (ficha del expediente, ~línea 3915) y renderAdj (bandeja de mails pendientes/HOY, ~línea 7962). Implementación: tras escapar y convertir las URLs en enlaces, se hace .replace(/ \|\| /g, "\n"); como ambos contenedores usan white-space:pre-wrap el salto se respeta. Solo cambia la visualización; el dato en el Sheet y la lógica de envío/parseo NO se tocan. Limpieza de paso: en renderAdjuntos el enlace usaba var(--ptl-primary) (variable inexistente en estilo-visual.cjs, el enlace quedaba sin color de marca) — corregido a var(--ptl-brand), igual que en renderAdj. (6) FIX aviso "¿Activar envíos automáticos?": (Bug A) el flag creado=1/reactivado=1 solo se limpiaba de la URL al enviar un mail con éxito; si se cancelaba el aviso, el flag quedaba pegado y cualquier recarga posterior (avanzar de fase, reloj ⏰, Ctrl+F5) lo re-disparaba en fases donde no aplica (p.ej. 02_VISITA, vista en captura de Guille). Fix: limpiar el flag con history.replaceState en cuanto se muestra el aviso, así sale UNA sola vez (en su momento legítimo: tras crear/reactivar, que siempre dejan en 01_CONTACTO). (Bug B) el aviso pasaba comu.fase al modal, propiedad inexistente (valía undefined -> fallback 'fase' -> el modal no cargaba plantilla si se aceptaba); corregido a la fase real (variable fase = normalizarFase(comu.fase_presupuesto), que aquí siempre es 01_CONTACTO). Sin tocar cadencias de plantillas ni lógica de cron.) (7) TEXTO — el confirm del botón "Saltar envío" del modal de plantilla ya no menciona el cron. Antes decía "el cron seguirá funcionando... enviará el siguiente mail dentro de los días configurados en la plantilla", lo cual era engañoso: las fases donde aparece ese botón (02_PTE_VISITA_*, 03_ENVIO_PTO, 05_ACEPTACION_PTO, 05_FIN_DOC, 08_INICIO_CYCP) son todas plantillas de un solo disparo (max_envios=1, sin recurrencia), no tienen reenvíos automáticos. Ahora dice simplemente "El expediente avanzará a la siguiente fase." Sin cambios de lógica, solo el texto del confirm.) (8) VISIBILIDAD — la caja "Datos económicos" pasa a verse en TODAS las fases EXCEPTO 01_CONTACTO y 02_VISITA (antes solo en 05/06/07/08/09). Ahora también aparece en 03_ENVIO_PTO, 04_ACEPTACION_PTO y en ZZ_RECHAZADO/ZZ_DESCARTADO. Motivo: en fase 03 el sistema ya exige rellenar los 4 económicos previstos antes de enviar el presupuesto (validación ptlIntentarEnviarFase03), pero la caja para rellenarlos estaba oculta. Condición invertida: en vez de listar las fases que la muestran, se oculta solo en 01 y 02. Sin cambios en los campos ni en el guardado.)
// Build: 2026-05-19 v17.72 (Sobre v17.71: PASO 2 de la unificación pendiente desde estilo-visual.cjs v1.10 (paso 1 — añadir 7 clases utilitarias sin uso). Ahora se sustituyen 45 estilos inline repetidos por las clases correspondientes: (1) 7 usos de .ptl-empty-msg (antes inline padding:8px 4px;color:gray-500;font-size:12px;font-style:italic) — mensajes "— Sin X —" en cajas de comunicaciones, mails pendientes, expedientes por fase y avisos. (2) 11 usos de .ptl-input-sm (antes inline padding:2px 5px;border:gray-200;border-radius:4px;font-size:12px) — inputs pequeños de la pantalla de plantillas mail; cuando además había width:100% se conserva como style="width:100%". (3) 6 usos de .ptl-input-num (input numérico centrado con border, padding 1px 4px, font 11px, text-align:center) — inputs de fecha en cinta de fase 02/04/09. (4) 6 usos de .ptl-label-mini (font-size:9px uppercase letter-spacing) — etiquetas "Fecha cobro" / "Próximo mail" / "Fecha visita" en cinta de fase. Mantienen la clase ln combinada para .ptl-btn-mail-3l/.ptl-btn-enviar-avanzar. (5) 5 usos de .ptl-label-2nd (display:block;font-size:12px;color:#6b7280;margin-bottom:3px) — labels del segundo modal de mail (Para, CC, Asunto, Mensaje, Adjuntos). (6) 5 usos de .ptl-error-msg (padding:8px;color:#DC2626;font-size:12px) — mensajes de error en cajas de pantalla HOY cuando falla la lectura. (7) 5 usos de .ptl-hr-soft (separador horizontal 1px gris) — separadores dentro de cajas de pantalla HOY. Resultado: archivo 3 KB más ligero, mucho más legible, y al cambiar el estilo de cualquiera de estos 7 patrones en el futuro se cambia en un solo sitio (estilo-visual.cjs). Sin cambios visuales — las clases tienen exactamente las mismas reglas que los inline reemplazados.)
// Build: 2026-05-19 v17.71 (Sobre v17.70: UNIFICACIÓN total de los dos modales de mail. Antes había DOS compositores de mail con HTML/CSS/JS independientes: ptlComSendModal (mail manual) ya arrastrable desde v17.70, y ptl-modal-mail (mail con plantilla) aún modal bloqueante con overlay translúcido. Ahora los dos son ventanas flotantes arrastrables idénticas. Cambios: (1) Ambos modales pasan a usar las clases compartidas .ptl-floating-wrapper / .ptl-floating-window / .ptl-floating-title / .ptl-floating-title-text / .ptl-floating-close / .ptl-floating-body de estilo-visual.cjs v1.14. Eliminados todos los estilos inline equivalentes. (2) Eliminado el overlay translúcido rgba(0,0,0,.5) del segundo modal; ahora la pantalla detrás queda totalmente interactiva durante el envío de un mail con plantilla (puedes copiar de detrás y pegar). (3) Eliminado el listener "click fuera = cerrar" del segundo modal (que ya no aplica porque no hay overlay; cierre solo por ✕ o Cancelar). (4) Nuevos helpers globales window.ptlMakeDraggable(boxEl, titleEl, closeEl) y window.ptlCentrarVentana(boxEl) definidos en el primer <script> del HTML; el segundo modal los usa porque son globales (window.*). Esto sustituye el IIFE drag inline que tenía el primer modal. (5) ptlAbrirModalMail llama a window.ptlCentrarVentana tras mostrar para centrar la ventana en el viewport, igual que el primer modal. (6) ptl-mm-titulo cambia de <h3> a <span class="ptl-floating-title-text"> para alinear con el patrón unificado (sin cambios funcionales: setTextContent/innerHTML sigue funcionando). El display:flex que tenía m.style.display pasa a display:block porque la nueva clase .ptl-floating-wrapper no usa flex (la caja se posiciona con position:fixed + top/left). Resultado: ambos modales se comportan exactamente igual, comparten todo el CSS, y al cambiar algo de estilo en el futuro se cambia una sola vez en estilo-visual.cjs.)
// Build: 2026-05-19 v17.70 (Sobre v17.69: el modal "📧 Enviar mail manual" se convierte en VENTANA FLOTANTE ARRASTRABLE estilo Windows. Antes: overlay translúcido oscuro que cubría toda la pantalla y la bloqueaba; si el usuario pulsaba por error fuera de la caja, se cerraba perdiendo todo lo escrito. Y NO se podía consultar la pantalla de detrás para copiar datos. Ahora: (1) Eliminado el overlay translúcido (el div exterior pasa a ser un wrapper invisible que solo controla display:none/block). (2) Caja interior con position:fixed, width:680px, max-height:90vh, sombra fuerte para destacar sobre el fondo. (3) Nueva cabecera arrastrable (id ptlComSendTitle): fondo gris claro, cursor:move, título "📧 Enviar mail manual" a la izquierda y botón ✕ a la derecha para cerrar. (4) Función sCentrar() calcula posición inicial centrada en el viewport al abrir (después de displayear, para usar offsetWidth/Height reales). (5) Handlers de drag&drop en la cabecera: mousedown captura offset cursor-caja, mousemove en document mueve la caja con clamping para que no salga del viewport (margen 4px), mouseup termina. El botón ✕ está exento del drag (el click en ✕ cierra, no arrastra). (6) Eliminado el listener "click fuera = cerrar" que ya no aplica porque no hay overlay. (7) La pantalla de detrás queda totalmente interactiva: se puede seleccionar texto, scrollear, copiar al portapapeles y volver al modal para pegar. (8) El cuerpo del modal pasa a tener su propio scroll interno (overflow-y:auto) en lugar del scroll de la caja entera, para que la cabecera quede siempre visible durante el arrastre. Resultado: el compositor se comporta como una ventana de Windows que se mueve por la cabecera y no se cierra por accidente.)
// Build: 2026-05-19 v17.69 (Sobre v17.68: UNIFICACIÓN cinta de fase + limpieza. (1) Eliminado el botón ⏰ HOY que iba apilado encima del ↶ rojo en la cinta de fase de TODAS las fichas (01/02/04/05/06/07/08). El acceso a HOY ya vive en la pestaña ⏰ HOY de la cabecera unificada (v17.63), allí está unificado. El botón apilado era una duplicación visual. Resultado en btnRetrocederHtml: ~17 líneas menos. La fase 01_CONTACTO (que NO tiene fase anterior) ahora simplemente renderiza string vacío en lugar del HOY suelto. Fases 03/09/ZZ_* no se ven afectadas: 03 no usaba btnRetrocederHtml (su accionHtml inserta sus propios botones), 09 y ZZ tampoco lo usaban. (2) Migradas a estilo-visual.cjs v1.13 las 8 reglas CSS que vivían hardcodeadas en la constante CSS de este módulo (.ptl-btn-enviar-avanzar, .ptl-na-igual-altura, .ptl-btn-mail-3l, .ptl-mini-fecha, etc.). El comentario "lo común está en estilo-visual.cjs" ya lo anticipaba. La constante CSS queda vacía como placeholder para futuro CSS específico. ~20 líneas menos. (3) En estilo-visual.cjs v1.13 se añade además .ptl-next-action-grid .ptl-btn-enviar-avanzar { min-width:215px } para que el botón verde grande de fase 03 (que vive FUERA de .ptl-na-right y por tanto no recibía la regla global min-width:215px) iguale ancho al resto de botones de las demás fases. Resultado visual: cintas de fase 01-08 con altura uniforme y botones derechos uniformes.)
// Build: 2026-05-19 v17.68 (Sobre v17.67: reducir gaps verticales entre cajas en TODO el programa para que todas las pantallas se compacten verticalmente. (1) Pantalla /presupuestos/hoy: los 3 gap:14px del layout (grid principal y las 2 columnas apiladas) pasan a gap:4px. (2) Ficha del expediente: el margin-bottom:16px hardcodeado en las cajas de fase (.ptl-card.ptl-acordeon, ~línea 5500) se elimina; queda solo el margin-bottom global de .ptl-card (que pasa a 4px en estilo-visual.cjs v1.9). Resultado: cajas más juntas, sin huecos vacíos grandes, misma compacidad que la barra de pestañas superior. Si en alguna pantalla concreta los 4px son demasiado apretados, se ajusta puntualmente sin tocar el global.)
// Build: 2026-05-19 v17.67 (Sobre v17.66: (1) NUEVO endpoint /presupuestos/piso/guardar-nota-simple con body {ccpp_id, vivienda, nota_simple}. Guarda en pisos.D (columna nota_simple). Usado desde el acordeón de documentacion.cjs v17.23. (2) _actualizarCampoPiso amplía CAMPOS_PERMITIDOS para incluir "nota_simple" (además de en_hoy y notas_piso). (3) Los 2 textareas de notas inline en la caja "Expedientes HOY" de /presupuestos/hoy (CCPP y piso) pasan del patrón de feedback "flash verde 0,8s / flash rojo 1,5s" al patrón unificado "verde 2s / rojo permanente hasta próximo guardado OK". Mismo helper que en documentacion.cjs v17.23.)
// Build: 2026-05-19 v17.66 (Sobre v17.65: fix — al entrar a un expediente desde HOY con ?accion_mail=responder|reenviar&mid=... el modal de mail se abría correctamente, pero los parámetros se quedaban pegados a la URL. Cualquier recarga posterior (Ctrl+F5 desde la cabecera, botón reloj ⏰, los ~9 location.reload() de handlers internos) volvía a re-disparar el modal. Fix: tras el setTimeout que dispara el clic, llamamos a history.replaceState con la URL limpia (sin accion_mail y sin mid). replaceState no recarga la página, solo sustituye la URL visible; el modal sigue abierto. Los próximos reloads recargan ya la URL limpia y no re-disparan nada. Una sola modificación, en el IIFE del auto-disparo (línea ~4190).)
// Build: 2026-05-19 v17.65 (Sobre v17.64: fix — al abrir un expediente en fase 09_TRAMITADA NO se redirigía a /documentacion/expediente. Se quedaba en /presupuestos/expediente, que no inyecta la tabla DATOS DOCUMENTACION. Resultado: en tramitados no se veía la tabla. Fix mínimo en la línea de redirect: además de FASES_DOCUMENTACION (05-08), también se redirige cuando faseActual === "09_TRAMITADA". No se toca la constante FASES_DOCUMENTACION (usada en otros 5 sitios con semántica de "fase del módulo documentación en curso") para no afectar otros flujos. Una línea modificada.)
// Build: 2026-05-19 v17.64 (Sobre v17.63: UNIFICACIÓN DE CABECERAS. Antes había 3 cabeceras casi idénticas duplicadas en el código: una inline en vistaListado (~140 líneas), otra inline en el handler de /presupuestos/hoy (~95 líneas) y la función renderCabeceraComun (~125 líneas, ya usada por la ficha del expediente vía documentacion.cjs). Total ~360 líneas con el mismo bloque (buscador + A-Z + Plantillas + Cron + pestañas + fases) repetido 3 veces y con pequeñas diferencias. (1) renderCabeceraComun gana un 3er parámetro opts = { filtroActivo, busqueda, orden, mostrarOrden, cuadra }. (2) Soporta: precargar la búsqueda en el input, botón de orden A-Z/Z-A/Urgencia dinámico con next state, resaltar pestaña activa con clase 'on', aviso ⚠ en Activos cuando los contadores no cuadran (heredado del listado). (3) ptlFiltrarComun: lleva 400ms de debounce (igual que ptlFiltrar antes); evita 1 redirect por tecla. (4) Las cabeceras inline de vistaListado y del handler HOY se eliminan y se sustituyen por una llamada a renderCabeceraComun pasando los opts adecuados. Las funciones helper duplicadas (filtroBtn / _filtroBtnHoy / _filtroBtn) se quedan solo en renderCabeceraComun. Los handlers ptlFiltrar y ptlFiltrarHoy se eliminan (todo usa ptlFiltrarComun). (5) Comportamiento funcional: idéntico al anterior. Visualmente las 3 cabeceras quedan EXACTAMENTE iguales (antes tenían pequeñas diferencias: la del HOY ya no llevaba el botón de Cron en algunos puntos, ya no llevaba el contador de "Activos" en barra... ahora todo unificado).)
// Build: 2026-05-19 v17.63 (Sobre v17.62: reubicación del botón ⏰ HOY en las cabeceras. (1) En /presupuestos (listado): el botón se quita de la barra superior (junto a Plantillas mail y Ejecutar cron) y se mueve a la barra de pestañas, en la posición justo después de Ctrl+F5 y antes de Activos. (2) En renderCabeceraComun (cabecera unificada que usa la ficha del expediente vía documentacion.cjs): se AÑADE el mismo botón en la misma posición (antes no existía en esta cabecera). (3) En /presupuestos/hoy: sin cambios — la cabecera del HOY nunca ha llevado el botón porque ya estás en HOY. (4) El botón ⏰ vertical apilado con ↶ Retroceder dentro de la ficha del expediente (línea ~3399) NO se toca: vive en el accionHtml de la fase, no en una cabecera. Estilo del botón en pestañas: fondo caqui (var(--ptl-warning-light)/var(--ptl-warning)/#FDE68A) y peso 600 para que destaque visualmente del resto de pestañas.)
// Build: 2026-05-19 v17.62 (HOTFIX sobre v17.61: la v17.61 rompía el listado con "ReferenceError: filtroEfectivo is not defined". Causa: al envolver el bloque del filtro de fase en `if (!busqueda)`, metí la declaración `const filtroEfectivo` DENTRO del if, pero esa variable se usa más abajo en el mismo método para resaltar la pestaña activa (líneas ~3124 y ~3286 de v17.61). Fix: sacar la declaración fuera del if; el if solo controla AHORA si se aplica el filtro sobre `lista`. Comportamiento funcional: idéntico a lo que v17.61 pretendía (búsqueda sin acentos + ignora filtro de fase + contadores totales).)
// Build: 2026-05-19 v17.61 (Sobre v17.60: búsqueda del listado /presupuestos — (1) Insensible a acentos. Helper local _normTexto(s) que aplica String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''). Antes solo se aplicaba .toLowerCase() y "brujula" no encontraba "Brújula". Las mayúsculas ya funcionaban; el bug real eran los acentos. (2) Cuando hay búsqueda activa, se IGNORA el filtro de fase (filtroEfectivo). Resultado: escribir en el buscador busca SIEMPRE en todo el listado, sea cual sea la pestaña activa (Activos / En trámite / fase concreta / ZZ). Si el campo está vacío vuelve a aplicarse el filtro de fase de la pestaña. (3) Contadores de pestañas sin cambios: siguen reflejando el total real del Sheet, no se recalculan con la búsqueda. (4) Las búsquedas de /presupuestos/hoy (ptlFiltrarHoy) y /comunidades (ptlFiltrarComun) NO se han tocado en este sprint; quedan pendientes para sincronizar el mismo comportamiento si Guille lo pide.)
// Build: 2026-05-19 v17.60 (Sobre v17.59: ficha del expediente — (1) Caja NOTAS: ahora se renderiza SOLO en las fases 01_CONTACTO / 02_VISITA / 03_ENVIO_PTO / 04_ACEPTACION_PTO. En fases 05+ y ZZ_* la caja queda oculta. La gestión de notas_pto en 05+ se hace exclusivamente desde la fila "Comunidad de propietarios" de la tabla DATOS DOCUMENTACION (módulo documentacion.cjs v17.13+). Decisión Guille: en zona presupuesto las notas son protagonistas; en zona documentación pasan a ser una columna más de la tabla. (2) Caja NOTAS pasa de <textarea rows="2"> a <input> de una sola línea (mismo nombre notas_pto, mismo flujo dirty/+, sin cambios en backend). El reloj ⏰ "Añadir a HOY" se mantiene en la esquina derecha del título. (3) Caja DATOS ECONÓMICOS: la condición de visibilidad se invierte. Antes: visible salvo en 01_CONTACTO y 02_VISITA. Ahora: visible SOLO en 05_DOCUMENTACION / 06_VISITA_EMASESA / 07_PTE_CYCP / 08_CYCP / 09_TRAMITADA. Queda oculta en 01-04 y ZZ_*. (4) DATOS ECONÓMICOS gana clase ptl-card-econ-compact con CSS: labels 10px, inputs 11px y altura 22px (igual que la tabla DATOS DOCUMENTACION), gap vertical reducido. Resultado: caja ~40% más baja, encaja mejor con la tabla de pisos que va justo debajo.)
// Build: 2026-05-19 v17.59 (Sobre v17.58: caja "Expedientes HOY" — la cebra deja de alternar por bloque. Ahora TODAS las cabeceras de expediente (filas amarillas de CCPP) llevan fondo gris fijo #E0E2E6, y TODAS las filas de piso llevan fondo blanco fijo. Patrón visual estricto gris/blanco/gris/blanco por bloque, independientemente del número de pisos de cada uno. Decisión Guille: las cabeceras se identifican mejor con un único color uniforme y los pisos contrastan al ser blancos.)
// Build: 2026-05-19 v17.58 (Sobre v17.57: ajustes visuales. (1) Caja Expedientes HOY — cabecera de CCPP: dirección de 240px → 160px para dar más ancho al textarea de notas. (2) Filas de piso: piso/nombre/teléfono/docs ahora ocupan 50/170/90/32px (más compactos), con gap:4px entre celdas; el textarea de notas tiene margin-left:8px y crece a flex:1 con todo el espacio sobrante. (3) Cebra de pisos: ahora blanco/#E0E2E6 (la misma intensidad que las cabeceras de CCPP), antes era la suave #FAFBFC/#F3F4F6. (4) Caja 1 DATOS ECONÓMICOS (Total presupuestado): el extra ahora tiene 2 huecos invisibles bajo "inicio del cómputo" para que la línea separadora gris quede a la MISMA altura horizontal que en cajas 2/3/4 (las otras tienen 3 líneas en el extra). (5) Caja 2 (Total aceptado): junto a "Nº expedientes" e "Importe" aparece un porcentaje en gris itálico calculado sobre los valores de caja 1 (n_aceptado/n_presupuestado e importe_aceptado/importe_presupuestado). Solo en caja 2 — Guille indicó expresamente no añadirlo en 3 ni 4.)
// Build: 2026-05-19 v17.57 (Sobre v17.56: (1) DATOS ECONÓMICOS — caja 1: la línea "Media mensual" sube y ocupa la posición de "Beneficio" (las otras cajas tienen Beneficio ahí), de modo que las 4 cajitas tienen 4 líneas de datos y los bloques inferiores quedan alineados. _cajaEconomica gana opts.lineaSustitutivaBeneficio para esto. "Inicio del cómputo" pasa al extraHTML como única línea, anclada al pie. (2) Cajas 2 (Total aceptado) y 3 (Pendiente de tramitar): el bloque extra ahora tiene separador horizontal arriba (igual que caja 4) + línea Total (20%) + 2 huecos invisibles del mismo alto que Cobrado/Por cobrar de caja 4. Resultado: las 4 cajas tienen exactamente la misma altura visual y los "Total (20%)" quedan a la misma altura horizontal. (3) /presupuestos/mail-clasificar (asignar mail a expediente): el handler frontend ya NO hace location.reload(). Actualiza solo la fila en DOM: marca la opción seleccionada con "✓", pone fondo verde al select, propaga data-ccpp a los botones ↩/↪ de la fila para que funcionen inmediatamente. Ahorra los 1-3s de recarga completa de HOY que percibía Guille al asignar.)
// Build: 2026-05-19 v17.56 (Sobre v17.55: ajustes UX en /presupuestos/hoy. (1) Caja "Expedientes en HOY" renombrada a "Expedientes HOY" y SUBIDA por encima de "Mails pendientes" en el layout del HOY. (2) DATOS ECONÓMICOS — cada cajita ahora es flex-column con extraHTML empujado al fondo (margin-top:auto), de modo que la línea "inicio del cómputo" de la caja 1 queda alineada al pie de la cajita (antes pegada al bloque de datos, dejando hueco abajo). (3) Caja 4 (Total tramitado): se elimina el pie "(20% DEL BENEFICIO)"; las 3 líneas pasan a llamarse "Total (20%)" / "Cobrado" / "Por cobrar" con tipografía igualada a "inicio del cómputo" (10px, itálica). (4) Cajas 2 (Total aceptado) y 3 (Pendiente de tramitar): añaden una sola línea extra "Total (20%)" con el 20% de su beneficio respectivo, misma tipografía. Cobrado/Por cobrar no aplican en esas fases (los expedientes aún no están cerrados).)
// Build: 2026-05-19 v17.55 (Sobre v17.54: rediseño caja "Expedientes en HOY" para igualar el aspecto de las cajitas 02/04/05/08. (1) Tipografía 11px, line-height 1.1, min-height 22px (antes 12-13px y padding generoso). (2) Cebra blanco/#E0E2E6 a nivel de cabecera de bloque (en vez de fondo amarillo fijo); las sub-filas de pisos tienen su propia cebra suave #FAFBFC/#F3F4F6 para no chocar con la cebra del expediente. (3) Filas de piso completas con TODAS las celdas SIEMPRE: piso · nombre · teléfono · docs · notas · ⏰. La celda docs muestra N/M usando _resumenManual (misma lógica de calcularResumenManual de doc.cjs). Si nombre/teléfono vienen vacíos del Sheet, la celda queda vacía pero la columna se conserva para mantener alineación. (4) Botones reloj tamaño estándar 18×18px font 9px (igual que en la caja Mails pendientes), antes eran del tamaño normal. (5) Lectura única de pisos con extracción de est_piso_* en el mismo paso para calcular docs sin hacer N llamadas a Sheets, una por CCPP. _leerDocsManuales se llama una vez para obtener la lista docsPiso necesaria.)
// Build: 2026-05-19 v17.54 (Sobre v17.53: (1) Replicado el botón ⏰ "Añadir a HOY" del expediente en la esquina superior derecha del bloque NOTAS (clase ptl-exp-reloj con data-ccpp-id). Ambos botones (NOTAS y fila Comunidad de propietarios de DATOS DOCUMENTACION) comparten clase y se sincronizan al pulsar uno: el handler localiza TODOS los .ptl-exp-reloj con el mismo ccpp_id y refresca su aspecto al mismo tiempo. (2) Handler de pres.cjs (.ptl-exp-reloj) registrado en la zona de cierre del script de ficha, con flag relojBound para evitar doble-binding cuando documentacion.cjs también está renderizado (el de doc.cjs respeta el flag). (3) No hay cambios en endpoints ni columnas; el flujo es el mismo que v17.51-v17.52.)
// Build: 2026-05-18 v17.53 (Sobre v17.52: FIX botones responder/reenviar desde HOY para CCPPs en fase 05+. La redirección automática a /documentacion/expediente al pedir /presupuestos/expediente para una CCPP en fase del módulo documentación descartaba los parámetros accion_mail+mid que se necesitan para abrir el modal precargado. Solo el módulo presupuestos tiene listado de comunicaciones con modal de respuesta. Solución: si la URL trae accion_mail, NO se redirige a documentación; se renderiza la ficha de presupuestos para que el auto-disparo abra el modal. El usuario sigue luego con su flujo normal.)
// Build: 2026-05-18 v17.52 (Sobre v17.51: Sprint pisos + traslado del reloj del expediente. IMPORTANTE — añadir manualmente en pestaña `pisos` columnas AT="en_hoy" y AU="notas_piso" antes de desplegar. (1) Quitado el botón ⏰ de junto al título "Notas" en la ficha del expediente (decisión Guille: el reloj del expediente queda solo en la fila "Comunidad de propietarios" de DATOS DOCUMENTACION para alinearse visualmente con los de los pisos). El handler JS también se quita. La columna comunidades.en_hoy (BF) sigue siendo la misma. (2) RANGO_PISOS pasa de A:AS a A:AU. (3) _leerPisosDeCcpp devuelve además nombre, telefono, en_hoy, notas_piso y _rowIndex (1-based) para cada piso. (4) Helpers _actualizarCampoPiso (escribe solo en_hoy / notas_piso, restringido) y _buscarRowIndexPiso (resuelve direccion+vivienda → rowIndex). (5) Endpoint POST /presupuestos/piso/toggle-hoy {ccpp_id, vivienda}: alterna pisos.en_hoy 1/"". Side-effect: si pasa a "1" y la CCPP padre no tenía en_hoy="1", activa también el padre (regla acordada: activar piso ⇒ activar expediente). (6) Endpoint POST /presupuestos/piso/guardar-notas-hoy {ccpp_id, vivienda, notas}: guarda notas_piso del piso. (7) Caja "Expedientes en HOY" en /presupuestos/hoy: cada cabecera de CCPP (fondo amarillo) se sigue de las sub-filas de pisos con en_hoy="1" (fondo gris claro, sangría). Cada sub-fila: [vivienda] [nombre] [teléfono] [notas_piso editable inline] [⏰]. Una sola lectura de RANGO_PISOS para todos los pisos del HOY. Confirmación al quitar expediente con pisos activos. (8) Tipografía de la cabecera de la caja "Expedientes en HOY" igualada a las cajitas de fase (font-size 13px) para coherencia visual.)
// Build: 2026-05-18 v17.51 (Sobre v17.50: NUEVA columna BF en_hoy en Sheet "comunidades" + reloj "Añadir a HOY" en la ficha del expediente + caja "Expedientes en HOY" bajo "Mails pendientes". IMPORTANTE — añadir manualmente en BF1 la cabecera "en_hoy" antes de desplegar. Tipo string "1" (activo) o "" (no). (1) COLS añade "en_hoy" al final. (2) RANGO_COMUNIDADES pasa de A:BE a A:BF; tramoH en actualizarComunidad pasa a AH:BF; rango de lectura en actualizarCampoComunidad pasa a A:BF. (3) En la ficha del expediente, el título "Notas" gana a la derecha un botón ⏰ (clase ptl-exp-reloj-hoy) que alterna en_hoy entre "1" y "" mediante el endpoint /presupuestos/expediente/campo existente. Encendido: fondo ámbar + borde + glow (mismo estilo visual que el reloj de mails). Apagado: gris transparente. (4) En /presupuestos/hoy, debajo de cajaMails se inserta cajaExpedientesHoy. Lista las CCPPs con en_hoy === "1" ordenadas alfabéticamente. Cada fila: [tipo_via direccion clicable que lleva a la ficha] | [textarea inline editable con notas_pto, guarda en blur al endpoint /expediente/campo con campo=notas_pto] | [⏰ siempre encendido, al pulsar pone en_hoy="" y recarga]. Vacío: mensaje "— Sin expedientes marcados —". (5) Sprint pisos (reloj por piso, notas_piso, agrupación por expediente con sub-filas de pisos) queda PENDIENTE para próximo sprint con Alberto, ya que requiere columnas nuevas en la pestaña pisos (zona de su gestión).)
// Build: 2026-05-18 v17.50 (Sobre v17.49: CORRECCIÓN de la lógica de badges. La v17.49 solo comparaba hoy vs fLim, lo que daba 🔴 Rojo a CCPPs con cron parado (caso Alberche 17: 1+3/3 reenvío completado sin fecha manual, fLim pasada hace 63 días → v17.49 daba 🔴 Retrasado 63 días, pero el comportamiento correcto es 🟡 Decidir porque el cron está parado esperando decisión humana). La v17.50 introduce los 3 estados del cron: ACTIVO (ciclo en curso), DORMIDO (ciclo agotado pero hay fecha_proximo_mail_manual rellena, despertará en esa fecha) y PARADO (ciclo agotado y sin fecha manual). Reglas nuevas: 🟡 Ámbar Decidir cuando cron PARADO (independientemente de fLim). 🟢 Verde En plazo cuando cron ACTIVO o DORMIDO y hoy<fLim. 🔴 Rojo Retrasado (N días) cuando cron ACTIVO o DORMIDO y hoy>=fLim, N=días desde fLim. El estado del cron se detecta reutilizando calcularInfoEnvioAuto (única fuente de verdad ya en uso). Caso de uso: el badge ámbar dice \"el sistema ha hecho lo que podía, te toca a ti decidir\". El rojo solo aparece si decidiste continuar (fecha manual o nuevo ciclo) pero el plazo ya pasó. Se mantiene: fallback al vuelo para CCPPs sin BC migrada (mails_ultimo_envio + di + dr × mx). Los 4 puntos de v17.49 sobre rellenado/borrado de BC se mantienen sin cambios.)
// Build: 2026-05-18 v17.49 (Sobre v17.48: NUEVA LÓGICA de badges 👍/⚠️/👎 acordada con Guille basada en fecha_limite_documentacion_vecinos (columna BC) en lugar de en el estado del ciclo del cron. La fecha mide el COMPROMISO con el cliente y coincide con la que muestra el mail automático en {{fecha_limite_doc_vecinos}}, por lo que badge y mail van siempre coherentes. (1) calcularEstadoPlazo reescrita: 🟢 Verde si hoy<fLim; 🟡 Ámbar si hoy==fLim; 🔴 Rojo (N días) si hoy>fLim, donde N = días desde fLim hasta hoy. Sin badge si plantilla inactiva, totalEnvios==0, o BC vacía Y sin último envío para fallback. Fallback al vuelo: si BC vacía pero hay mails_ultimo_envio[fase], calcula fLim = mails_ultimo_envio[fase] + di + dr × mx (compat con CCPPs antiguos sin migrar). El parámetro f1Map se conserva por compatibilidad pero ya no se usa. Helper _retrasadoConF1 también se conserva para compat. (2) Cálculo dinámico de fecha límite: los valores hardcoded +20 días (fase 05) y +10 días (fase 08) se sustituyen por di + dr × mx leído de la plantilla destino. Helpers _calcPlazoDesdePlantilla y _guardarFechaLimite añadidos en el endpoint de envío manual. Coincidencia validada: fase 05 (di=5,dr=5,mx=3)=20; fase 08 (di=4,dr=3,mx=2)=10. Para fases 01 (di=0,dr=30,mx=3)=90 días y fase 04 (di=3,dr=30,mx=3)=93 días. (3) Rellenado de BC en nuevos puntos: cuando fase==01_CONTACTO (mail manual de inicio): usa plantilla 01_CONTACTO; cuando fase==03_ENVIO_PTO (envío del presupuesto, paso a 04): usa plantilla 04_ACEPTACION_PTO. Lecturas de plantilla con try/catch para no romper si fallan. (4) Borrado de BC al retroceder de fase: ya se borraba al retroceder de 05; se añade también al retroceder de 02→01 (BC fue rellenado al iniciar 01) y de 04→03 (BC fue rellenado al pasar a 04 vía mail de fase 03). Mantiene la coherencia: si retrocedes, BC se borra y al rehacer la fase se recalcula con la nueva fecha real. NOTA: las CCPPs actualmente en fases 01 y 04 tienen BC vacía; el fallback al vuelo las cubre temporalmente; queda pendiente migración manual (Guille pegará tabla generada por Claude en columna BC del Sheet).)
// Build: 2026-05-18 v17.48 (Sobre v17.47: NUEVA LÓGICA de badges 👍/⚠️/👎 acordada con Guille y validada en sandbox con 87 casos sintéticos + 116 CCPPs reales. Reglas: (a) 🟢 Verde "en_plazo" mientras numAutomaticos < max_envios (ciclo inicial vivo) — tanto sin tregua como con tregua a tiempo (fecha manual metida ANTES de agotar el ciclo). (b) 🟡 Ámbar "decidir" cuando numAutomaticos == max_envios y NO hay fecha manual, O cuando el cron debía haber disparado y no lo hizo (regla C: fecha del próximo reenvío esperado ya pasada). (c) 🔴 Rojo "retrasado (N días)" cuando numAutomaticos == max_envios con fecha manual rellena (reactivación tardía) o numAutomaticos > max_envios (ya ampliado). N = días desde F1 (último auto del ciclo inicial = envío automático nº max_envios) hasta hoy; PERMANENTE, F1 no cambia aunque haya treguas posteriores. Función _retrasadoConF1 extraída como helper. Esta lógica es genérica e idéntica para fases 01_CONTACTO, 04_ACEPTACION_PTO, 05_DOCUMENTACION y 08_CYCP (sólo varía la plantilla). Los datos reales de hoy producen los mismos badges que la lógica anterior (verificado 116/116 CCPPs); la diferencia real solo aparece en el caso "tregua tardía recién metida pero aún no disparada", que la lógica anterior marcaba verde y ahora marca rojo correctamente.)
// Build: 2026-05-18 v17.47 (Sobre v17.46: se elimina el spacer elástico flex:1 introducido en v17.46. Con dos flex:1 (spacer + timeline) compitiendo, el spacer ganaba el hueco y el timeline se contraía cortando los primeros puntos. Ahora el orden vuelve a ser [info] [badge-slot] [timeline flex:1] [importe], sin spacer. Acompaña a estilo-visual.cjs v1.8 que quita el min-width:130px del badge-slot: las filas sin badge tienen el slot vacío con ancho 0 (timeline ocupa todo el hueco), las filas con badge tienen el slot al ancho natural del badge (timeline ocupa el resto). En ambos casos los puntos del timeline van pegados a la derecha por su justify-content:flex-end, así que quedan alineados verticalmente entre todas las filas. El badge queda pegado al inicio del timeline.)
// Build: 2026-05-18 v17.46 (Sobre v17.45: se añade un spacer elástico <div style="flex:1"></div> entre .ptl-fila-info (columna dirección) y .ptl-fila-badge-slot (slot del badge "💶 Cobrada"). Resultado: en las filas con badge, el badge se desplaza hacia la derecha hasta quedar pegado al borde izquierdo del timeline. En las filas sin badge, el slot sigue ocupando sus 130px reservados a la izquierda del timeline pero sin contenido visible. El timeline mantiene flex:1 con justify-content:flex-end, así que sus puntos siguen pegados a la derecha de cada ventanita. No hay cambios en el CSS, solo en este punto del HTML.)
// Build: 2026-05-18 v17.45 (Sobre v17.44: se elimina el spacer elástico <div style="flex:1"></div> que se había añadido tras .ptl-fila-info. Ya no es necesario porque estilo-visual.cjs v1.7 devuelve el timeline a flex:1 (era él quien debía absorber el hueco, como en v1.3 original). El slot del badge .ptl-fila-badge-slot se mantiene ANTES del timeline en el HTML (cambio bueno introducido en v17.44, mantiene el badge "💶 Cobrada" a la izquierda del timeline, en la posición histórica donde hasta v17.22 iban los badges 👍/⚠️/👎). Resultado: estructura HTML idéntica a v17.43 salvo por el orden badge↔timeline, y CSS idéntico a v1.3. Los timelines vuelven a quedar justificados a la derecha de cada ventanita, con el badge a su izquierda cuando aplica.)
// Build: 2026-05-18 v17.44 (Sobre v17.43: corrección de alineación en el listado /presupuestos. (1) El slot del badge .ptl-fila-badge-slot pasa de ir DESPUÉS del timeline a ir ANTES, replicando la posición histórica (hasta v17.22) de los badges 👍/⚠️/👎 según la captura de Guille. Ahora el badge "💶 Cobrada DD-MM-AA" aparece a la izquierda del timeline, no a su derecha. (2) Se añade un spacer elástico <div style="flex:1"></div> entre .ptl-fila-info y el slot del badge, para empujar el bloque [badge+timeline+importe] hacia la derecha. Combinado con el cambio en estilo-visual.cjs v1.4 (.ptl-fila .ptl-timeline pasa a flex:0 0 auto) el timeline ya no se estira: ocupa su ancho natural y todas las filas quedan visualmente alineadas por la derecha, pegadas al importe. Sin cambios funcionales: solo orden de elementos y CSS.)
// Build: 2026-05-17 v17.43 (Sobre v17.42: (1) Listado /presupuestos — el badge "💶 Cobrada DD-MM-AA" se renderiza dentro de un slot SIEMPRE PRESENTE (.ptl-fila-badge-slot) con min-width fijo, para que las líneas de fases queden alineadas entre todas las filas (antes el badge sólo existía en algunas filas y robaba espacio al timeline flex:1, desalineando). Acompaña a estilo-visual.cjs v1.3 que añade la regla CSS del slot. (2) Caja TOTAL TRAMITADO: separador entre las 4 líneas base y las 3 líneas resumen cambia de #E5E7EB (muy claro, casi invisible) a #D1D5DB (mismo color y grosor que las líneas conectoras subtítulo-valor). (3) fmtMoneda fuerza el separador de miles también para números de 4 cifras enteras (1.000–9.999). El locale es-ES por defecto NO los pone (norma RAE), pero para uniformidad visual los añadimos a mano. (4) Las 3 líneas Total/Cobrado/Por cobrar de la caja 4 multiplican el beneficio por 0,20 (20% del beneficio bruto). Se añade encima de las 3 líneas un mini-sub-título "(20% del beneficio)" para que el dato no se confunda con el beneficio bruto que aparece arriba.)
// Build: 2026-05-17 v17.42 (Sobre v17.41: (1) Unificación TOTAL de formato de fecha en DD-MM-AA (guiones, año 2 dígitos): fmtFecha global, formatearFechaDDMMYYYY (mantiene el nombre histórico pero ahora produce DD-MM-AA), fmtFecha local de histórico mails (con hora dd-mm-aa hh:mm), fmtFechaHoy y fmtFechaAviso. Solo NO se toca _fmtFechaCita ("El 12 de mayo de 2026 a las 14:32") porque es texto natural para citar en el cuerpo de un mail. (2) En el LISTADO principal /presupuestos, las CCPP en fase 09_TRAMITADA con fecha_cobro rellena muestran un badge verde "💶 Cobrada DD-MM-AA" entre la línea de tiempo y el importe, en el mismo slot donde antes (v17.22 y antes) se ponían los badges 👍/⚠️/👎. Reutiliza la clase ptl-fila-badge-en-plazo (verde). (3) Caja TOTAL TRAMITADO: las 3 líneas pasan a mostrar BENEFICIO (real si > 0, si no previsto) en lugar de IMPORTE, manteniendo la regla del resto de cajas. Acumuladores tramitadoCobrado y tramitadoPorCobrar añaden campo beneficio. (4) Separador de las 3 líneas de la caja 4 cambia de "border-top dashed amarillo" a "border-top solid gris #E5E7EB" para coherencia visual con la caja 1.)
// Build: 2026-05-17 v17.41 (Sobre v17.40: (1) NUEVA columna BE fecha_cobro en Sheet "comunidades": IMPORTANTE — añadir manualmente en BE1 la cabecera "fecha_cobro" antes de desplegar. Tipo string ISO YYYY-MM-DD. (2) RANGO_COMUNIDADES pasa de A:BD a A:BE; tramoH en actualizarComunidad pasa a AH:BE; rango de lectura en actualizarCampoComunidad pasa a A:BE. (3) Saneador añade fecha_cobro al COL_LETTER (BE) y al COL_FECHA. (4) En la ficha del expediente, fase 09_TRAMITADA pasa a tener su propio bloque accionHtml (antes caía en el genérico que asume def.siguiente, lo que no aplica a 09). Muestra estado "09-TRAMITADO" + sub-texto "💶 COBRADO el YYYY-MM-DD" si hay fecha_cobro, o "⌛ Pendiente de cobro" si está vacía. A la derecha, mini-bloque "Fecha cobro" con input type=date, mismo formato y posición que "Próximo mail" en fase 04. onchange dispara fetch al endpoint /presupuestos/expediente/campo y recarga la página para actualizar el sub-texto. (5) En la caja TOTAL TRAMITADO del HOY, debajo de las 4 líneas habituales, separador punteado amarillo y 3 líneas resumen "Total / Cobrado / Por cobrar" con sus importes correspondientes (basado en si fecha_cobro está rellena o no). (6) Cambios visuales: TODOS los textos de las 4 cajas pasan a NEGRO (#111827); solo los BORDES conservan el color identificativo de cada caja. (7) Se elimina el separador dashed border-top + padding-top que metía hueco blanco entre línea Tiempo y línea Media mensual de la caja 1 (compactado).)
// Build: 2026-05-17 v17.40 (Sobre v17.39: refinamiento visual DATOS ECONÓMICOS. (1) Fondos de las 4 cajas BLANCOS (#FFFFFF) en lugar de tintados; los bordes y colores de texto mantienen la paleta gris/verde/azul/amarillo para identificación. (2) Coletilla "(fases XX-YY)" baja a una SEGUNDA línea bajo el título de cada caja, sin acoplarse a él. (3) Cada línea de subtítulo/valor pasa a flex con valor justificado a la derecha y una LÍNEA gris fina (#D1D5DB, 1px) conectando subtítulo y valor a media altura, rellenando el hueco como un índice de libro pero continua y discreta. (4) Línea "Media mensual" pierde el "/mes" (la unidad € se sobreentiende al venir de un importe).)
// Build: 2026-05-17 v17.39 (Sobre v17.38: DATOS ECONÓMICOS refinado visualmente. (1) Subtítulos en negrita (Nº expedientes, Importe, Tiempo, Beneficio) y valores SIN negrita, todo en una misma línea (antes: subtítulo arriba en gris, valor abajo grande en negrita; ahora más compacto). (2) Tras el TÍTULO de cada caja, paréntesis con la coletilla de fases: "Total presupuestado (todas las fases)", "Total aceptado (fases 05-09)", "Pendiente de tramitar (fases 05-08)", "Total tramitado (fase 09)". (3) Tras el subtítulo "Tiempo", coletilla "(cuadrilla 5)". (4) Se elimina la línea inferior gris "fases 05-08 · cuadrilla 5" que ya queda redundante. (5) NUEVO en caja 1 (Total presupuestado): línea extra "Media mensual XX.XXX,XX €/mes" calculada como importe_total / meses_transcurridos, donde meses_transcurridos = días entre la fecha_envio_pto más antigua del Sheet y hoy, dividido por 30.4375 (días promedio mes gregoriano, min=1 mes). Muestra debajo la fecha de inicio del cómputo en formato DD/MM/YYYY. La media presupuestada usa el importe de TODAS las CCPP (incl. ZZ_*).)
// Build: 2026-05-17 v17.38 (Sobre v17.37: (1) DATOS ECONÓMICOS rediseñado: 4 cajas estrechas en una sola fila (grid 1fr×4), todas con la misma estructura interna nº exp / importe / tiempo / beneficio. Cajas: 1) Total presupuestado (todos, sin beneficio porque es bruto), 2) Total aceptado (fases 05-09), 3) Pendiente de tramitar (05-08), 4) Total tramitado (solo 09). Tiempo = (real si > 0, si no previsto) × 2/5 días cuadrilla. Beneficio = real si > 0, si no previsto. Refactor con bucle único acumulando en objeto G y helper _cajaEconomica con paleta parametrizada. Se pierden los % "por importe / por nº" que tenía la versión antigua de Aceptado: si hace falta volverlos a meter, se hace en otra entrega. (2) BUG 1 backend (handler /presupuestos/expediente/campo): parser robusto formato ES en numéricos. Antes parseFloat(replace(',','.')) truncaba "1.234,56" → 1.23 si por cualquier vía llegara así desde un cliente; ahora se replica la lógica de ptlNum del frontend. (3) BUG 3 validación de rango: cada campo numérico (pto_total, mano_obra_*, material_*, beneficio_*, tiempo_*) tiene rango razonable. Si se intenta guardar fuera, devuelve 400 con mensaje claro. Evita repetir caso Diego Puerta (tiempo_previsto=16298 días).)
// Build: 2026-05-17 v17.37 (Sobre v17.36: Cabecera común (buscador + A-Z + Plantillas mail + Ejecutar cron + filtros rápidos + filtros fase, idéntica a la del HOY con contadores) extraída a una nueva función reutilizable renderCabeceraComun(token, comusListado) ubicada al final del módulo y expuesta vía app.locals.presupuestos.renderCabeceraComun para que documentacion.cjs (v17.9) la consuma también. Inyectada en /presupuestos/expediente como prefijo del HTML de la ficha. Acompaña a estilo-visual.cjs v1.2 que reduce la altura visual de la cabecera (paddings y font-sizes más compactos). El handler de /hoy NO se ha refactorizado en esta entrega: mantiene su cabecera inline para minimizar riesgo; se considera duplicación temporal que se podrá unificar en una entrega futura. La INICIAL /presupuestos sigue usando SU cabecera propia (no se ha tocado).)
// Build: 2026-05-17 v17.36 (Acompaña a documentacion.cjs v17.8. Cambio mínimo en _resumenManual (L~2103): el contador de "hechos" añade el estado IPREM (recién soportado en piso_pago y piso_meses_financiar dentro de documentacion.cjs v17.8). Sin IPREM aquí, los pisos pagados vía IPREM no contarían como hechos en los resúmenes que sirve presupuestos.cjs al panel HOY ni en pct_pisos/calcularResumenDocumentacion. Aprovechado para corregir un comentario que decía "CCPP" donde el código real era "FFCC" desde hace tiempo.)
// Build: 2026-05-17 v17.35 (Sobre v17.34: (1) Etiqueta "Tramitada" pasa a "Tramitados" en TODOS los sitios donde aparece visible al usuario: botón filtro pantalla principal, botón filtro HOY, botón ✓ Tramitados en la ficha del expediente (cierre fase 08), y propagación vía FASES_INFO["09_TRAMITADA"].nombre/nombreLargo/accionLabel (afecta a etiquetas internas tipo "09-Tramitados", badge verde, label "→ Tramitados"). La clave interna del Sheet "09_TRAMITADA" se mantiene sin cambios. (2) Layout HOY: las 5 cajas de fases se reorganizan en dos columnas FLEX apiladas (no grid celda-a-celda como antes): izquierda 01-CONTACTO + 02-VISITA, derecha 04-ACEPTACION + 05-DOCUMENTACION + 08-CYCP. Cada columna mantiene su gap interno de 14px. Las dos columnas se igualan en altura por JS: al cargar y en resize se mide la altura real de cada columna apilada, se localiza la columna más corta, dentro de ella se identifica la caja más pequeña, y se le aplica un min-height calculado como (altura actual + diferencia entre columnas) para que ambas columnas terminen midiendo exactamente lo mismo. CSS añadido: .hoy-col-item con flex column y .hoy-col-item > .ptl-card con flex:1 para que el estirado del wrapper se propague a la card interna.)
// ===================================================================
// Plug-in que añade el módulo de Presupuestos (CCPP) al index.cjs.
// Lee/escribe en la pestaña "comunidades" del Sheet de producción.
// Solo lee (no modifica) las pestañas existentes: vecinos_base,
// expedientes, documentos.
//
// Uso desde index.cjs:
//   require("./presupuestos.cjs")(app);
//
// Variables de entorno usadas (las mismas que ya usa index.cjs):
//   - GOOGLE_CLIENT_ID
//   - GOOGLE_CLIENT_SECRET
//   - GOOGLE_REFRESH_TOKEN
//   - GOOGLE_SHEETS_ID
//   - ADMIN_TOKEN
// ===================================================================

const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const { getThemeCss } = require("./estilo-visual.cjs");
const { validToken } = require("./lib/auth.cjs");

module.exports = function (app) {

  // =================================================================
  // AUTENTICACIÓN (mismo patrón que index.cjs)
  // =================================================================
  function getGoogleAuth() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }

  // =================================================================
  // CONSTANTES
  // =================================================================
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const RANGO_COMUNIDADES = "comunidades!A:BF"; // ... + fecha_limite_documentacion_vecinos (BC) + motivo_rechazo (BD) + fecha_cobro (BE) + en_hoy (BF)
  const RANGO_MAIL_PLANTILLAS = "mail_plantillas!A:J"; // A..I como antes + J = cuenta_envio
  const RANGO_DOC_PLANTILLAS = "doc_plantillas!A:D"; // A clave | B titulo | C cuerpo | D activo (plantillas de documentos EMASESA, v17.82)
  const RANGO_MAIL_HISTORICO = "mail_historico!A:J";   // ... + J = message_id (Message-ID del envío SMTP)
  const RANGO_MAIL_CUENTAS   = "mail_cuentas!A:G";   // A id | B email | C password | D host | E puerto | F host_imap | G puerto_imap
  const RANGO_MAILS_PENDIENTES = "mails_pendientes!A:L"; // bandeja de mails IMAP entrantes sin clasificar
  const RANGO_DOCS_MANUALES  = "documentos_manuales!A:G"; // codigo | nivel | label | orden | permite_financiacion | activo | notas
  const RANGO_PISOS          = "pisos!A:AU";   // pisos con est_piso_* (AC..AS) + v17.52: en_hoy (AT) + notas_piso (AU)

  // Fases del proceso de presupuesto (módulo CCPP)
  // - codigo:        número visible (01, 02, ..., ZZ)
  // - nombre:        forma corta para filtros y línea de tiempo
  // - nombreLargo:   forma larga en MAYÚSCULAS para botones y cabeceras de ficha
  const PTO_FASES = {
    "01_CONTACTO":       { codigo: "01", nombre: "Contacto",    nombreLargo: "CONTACTO",         color: "azul",     siguiente: "02_VISITA",          accionLabel: "Contacto registrado",  plantilla: "primer_contacto", cadenciaDias: 30 },
    "02_VISITA":         { codigo: "02", nombre: "Visita",      nombreLargo: "VISITA",           color: "azul",     siguiente: "03_ENVIO_PTO",       accionLabel: "Programar visita",     plantilla: null },
    "03_ENVIO_PTO":      { codigo: "03", nombre: "Envío",       nombreLargo: "ENVIO PTO",        color: "azul",     siguiente: "04_ACEPTACION_PTO",  accionLabel: "Enviar presupuesto",   plantilla: "envio_pto" },
    "04_ACEPTACION_PTO": { codigo: "04", nombre: "Aceptación",  nombreLargo: "ACEPTACION PTO",   color: "amarillo", siguiente: "05_DOCUMENTACION",   accionLabel: "Aceptación",           plantilla: "seguimiento", cadenciaDias: 15, cadenciaInicialDias: 3 },
    "09_TRAMITADA":      { codigo: "09", nombre: "Tramitados",   nombreLargo: "TRAMITADOS",        color: "verde",    siguiente: null,                 accionLabel: "Tramitados",            plantilla: null },
    "ZZ_RECHAZADO":      { codigo: "ZZ", nombre: "Rechazado",   nombreLargo: "RECHAZADO",        color: "rojo",     siguiente: null,                 accionLabel: "Rechazado",            plantilla: null },
    "ZZ_DESCARTADO":     { codigo: "ZZ", nombre: "Descartado",  nombreLargo: "DESCARTADO",       color: "rojo",     siguiente: null,                 accionLabel: "Descartado",           plantilla: null },
  };

  // Mapeo de estados antiguos (Excel SEGUIMIENTO.xlsm + Sheet con nombres antiguos) -> fase nueva
  const MAPA_ESTADO_FASE = {
    // Identificadores antiguos del Sheet (compat con datos ya guardados)
    "01_SOLICITUD":          "01_CONTACTO",
    "ENTREGADO":             "05_DOCUMENTACION",
    "05_RESOLUCION":         "04_ACEPTACION_PTO",   // si quedara alguno colgado, lo mandamos a aceptación
    // Compat: la antigua fase 05_ENVIO_DOC pasa a ser 05_DOCUMENTACION (ya no es de presupuestos)
    "05_ENVIO_DOC":          "05_DOCUMENTACION",
    // Compat: nombres antiguos de fases ya renombradas (sesión 04/05/2026):
    //   03_ENVIO          -> 03_ENVIO_PTO
    //   04_SEGUIMIENTO    -> 04_ACEPTACION_PTO
    // Esto permite leer CCPPs ya escritos en el Sheet con los códigos antiguos
    // y normalizarlos en cada lectura. Cuando avancen de fase, se reescriben
    // con el nombre nuevo y la migración es automática.
    "03_ENVIO":              "03_ENVIO_PTO",
    "04_SEGUIMIENTO":        "04_ACEPTACION_PTO",
    // Compat: cambio estructural sesión 04/05/2026 — el flujo final cambió:
    //   07_CONTRATOS_PAGOS -> 08_CYCP (renombrado)
    //   08_TRAMITADA       -> 08_CYCP (fusionado en la fase 08)
    //   (07_PTE_CYCP es nueva, no migra de nada)
    "07_CONTRATOS_PAGOS":    "08_CYCP",
    "08_TRAMITADA":          "08_CYCP",
    // Estados del Excel SEGUIMIENTO.xlsm
    "00-SOLICITUD ACTA PTO": "01_CONTACTO",
    "00-PTE VISITA":         "02_VISITA",
    "01-ENVIO PTO":          "03_ENVIO_PTO",
    "01-PERSIGO PTO":        "04_ACEPTACION_PTO",
    "01-SOLICITUD ACTA PTO": "01_CONTACTO",
    "02-PTE VISITA":         "02_VISITA",
    "03-ENVIO PTO":          "03_ENVIO_PTO",
    "03-ENVÍO PTO":          "03_ENVIO_PTO",
    "04-SEGUIMIENTO PTO":    "04_ACEPTACION_PTO",
    "05-RESOLUCION PTO":     "04_ACEPTACION_PTO",   // expediente sin decisión todavía
    "05-RESOLUCIÓN PTO":     "04_ACEPTACION_PTO",
    "ZZ-RECHAZADA":          "ZZ_RECHAZADO",
    "ZZ-RECHAZADO":          "ZZ_RECHAZADO",
    "06-ENVIO DOC":          "05_DOCUMENTACION",
    "02-PERSIGO CYCP":       "05_DOCUMENTACION",
    "02-PERSIGO DOC":        "05_DOCUMENTACION",
    "02-EMASESA CYCP":       "05_DOCUMENTACION",
    "02-EMASESA TECNICO":    "05_DOCUMENTACION",
    "02-TRADICIONAL":        "05_DOCUMENTACION",
    "03-TRAMITADA":          "08_CYCP",
    "04-EJECUTADA":          "08_CYCP",
  };

  // Fases de OTROS módulos que presupuestos debe reconocer pero no gestionar.
  // Cuando un CCPP está en una de estas fases, ya no es "asunto de presupuestos"
  // pero la ficha tiene que pintar el timeline correctamente y no tratarlo
  // como un 01_CONTACTO recién creado.
  const FASES_DOCUMENTACION = ["05_DOCUMENTACION", "06_VISITA_EMASESA", "07_PTE_CYCP", "08_CYCP"];

  // Definiciones de las fases de documentación (mismo formato que PTO_FASES).
  // Presupuestos las usa SOLO para pintar la barra de acción azul oscura
  // y los botones de avance cuando un CCPP está en una de ellas. La lógica
  // de gestión real vive en documentacion.cjs.
  const FASES_DOCUMENTACION_DEF = {
    "05_DOCUMENTACION":   { codigo: "05", nombre: "Documentación",   nombreLargo: "DOCUMENTACION",     siguiente: "06_VISITA_EMASESA" },
    "06_VISITA_EMASESA":  { codigo: "06", nombre: "Visita EMASESA",  nombreLargo: "VISITA EMASESA",    siguiente: "07_PTE_CYCP" },
    "07_PTE_CYCP":        { codigo: "07", nombre: "Pte CYCP",        nombreLargo: "PTE CYCP",          siguiente: "08_CYCP" },
    "08_CYCP":            { codigo: "08", nombre: "CYCP",            nombreLargo: "CYCP",              siguiente: null },
  };

  function normalizarFase(fase) {
    if (!fase) return "01_CONTACTO";
    if (PTO_FASES[fase]) return fase;
    if (FASES_DOCUMENTACION.includes(fase)) return fase; // módulo doc: respetar valor
    return MAPA_ESTADO_FASE[fase] || "01_CONTACTO";
  }

  // Devuelve el nombre amigable de una plantilla a partir de su código de fase.
  // Ej: "02_PTE_VISITA_CON_ACTA" -> "02-PTE VISITA (CON ACTA)"
  // Usado en pantalla de plantillas y en desplegable de "Añadir mail manual".
  function nombrePlantillaAmigable(fase) {
    if (fase === "02_PTE_VISITA_CON_ACTA") return "02-PTE VISITA (CON ACTA)";
    if (fase === "02_PTE_VISITA_SIN_ACTA") return "02-PTE VISITA (SIN ACTA)";
    if (fase === "04_ACEPTACION_PTO")      return "04-SEGUIMIENTO PTO";
    if (fase === "04_REENVIO")             return "04-REVISION PTO";
    if (fase === "05_ACEPTACION_PTO")      return "05-INICIO DOC";
    if (fase === "05_SEGUIMIENTO_DOC")     return "05-SEGUIMIENTO DOC";
    if (fase === "05_FIN_DOC")             return "05-FIN DOC";
    if (fase === "08_INICIO_CYCP")         return "08-INICIO CYCP";
    if (fase === "08_SEGUIMIENTO_CYCP")    return "08-SEGUIMIENTO CYCP";
    if (fase === "08_FIN_CYCP")            return "08-FIN CYCP";
    const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
    if (def) return `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;
    return fase;
  }

  // Devuelve la fase inmediatamente anterior (busca quién tiene `fase` como `siguiente`).
  // Devuelve null si no hay fase anterior (01_CONTACTO, ZZ_*, o fase desconocida).
  function calcularFaseAnterior(fase) {
    if (!fase) return null;
    // Recorrer ambos catálogos buscando quién tiene esta fase como "siguiente"
    for (const [k, v] of Object.entries(PTO_FASES)) {
      if (v.siguiente === fase) return k;
    }
    for (const [k, v] of Object.entries(FASES_DOCUMENTACION_DEF)) {
      if (v.siguiente === fase) return k;
    }
    return null;
  }

  // =================================================================
  // HELPERS GENÉRICOS
  // =================================================================
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  // Renderiza el cuerpo de un mail dividiéndolo en "nuevo" (azul) e "histórico
  // arrastrado" (gris apagado, más pequeño). Detecta el primer marcador de cita
  // habitual y todo lo que venga después se pinta como histórico. Si no
  // detecta marcador, todo el cuerpo va como "nuevo".
  // Patrones detectados (orden):
  //   1. Línea que empieza con ">" (quote universal)
  //   2. "----- Mensaje original -----" / "----- Original Message -----" (Outlook)
  //   3. "---------- Mensaje reenviado ----------" / "---------- Forwarded message ----------" (Gmail)
  //   4. "El ... escribió:" / "On ... wrote:" (clientes en es/en)
  //   5. "De: ..." / "From: ..." al inicio de línea (Outlook compacto)
  // escFn = función de escape HTML (puede ser esc o _esc según el contexto)
  //
  // Adicionalmente, el bloque "nuevo" se reflowea: los saltos de línea simples
  // que parecen artificiales (cliente antiguo cortando a ~72 chars) se sustituyen
  // por un espacio, conservando los párrafos (\n\n) y las listas/despedidas.
  // El bloque histórico NO se reflowea (los > son señal visual útil).
  function _reflowearTexto(texto) {
    const lineas = String(texto || "").split("\n");
    const out = [];
    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i];
      const siguiente = lineas[i + 1];
      // Si la siguiente línea está vacía o es la última → mantener salto
      if (siguiente === undefined || siguiente.trim() === "") {
        out.push(actual);
        continue;
      }
      // Si la actual está vacía → mantener salto (es un párrafo)
      if (actual.trim() === "") {
        out.push(actual);
        continue;
      }
      const actTrim = actual.trimEnd();
      const sigTrim = siguiente.trimStart();
      // Si la línea actual termina en puntuación fuerte → mantener salto (nueva frase)
      if (/[.!?:;]$/.test(actTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea siguiente empieza por viñeta/quote/guion → mantener salto (lista)
      if (/^[-*•>–—]/.test(sigTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea siguiente empieza por mayúscula o número → mantener salto
      // (asumimos nueva frase, dirección, dato, despedida...)
      if (/^[A-ZÁÉÍÓÚÑ0-9]/.test(sigTrim)) {
        out.push(actual);
        continue;
      }
      // Si la línea actual es corta (<40 chars) → mantener salto (probablemente fue intencional)
      if (actTrim.length < 40) {
        out.push(actual);
        continue;
      }
      // Si la línea actual es muy larga (>90 chars) → mantener salto (no parece corte artificial)
      if (actTrim.length > 90) {
        out.push(actual);
        continue;
      }
      // Resto: corte artificial a ~60-80 chars con minúscula en la siguiente → unir
      out.push(actTrim + " " + sigTrim);
      i++; // saltar la siguiente porque ya la consumimos
    }
    return out.join("\n");
  }

  function _renderCuerpoMail(cuerpo, escFn) {
    const raw = String(cuerpo || "");
    if (!raw.trim()) return "";
    const lineas = raw.split(/\r?\n/);
    const patrones = [
      /^\s*>/,
      /^\s*-{3,}\s*Mensaje\s+original\s*-{3,}/i,
      /^\s*-{3,}\s*Original\s+Message\s*-{3,}/i,
      /^\s*-{3,}\s*Mensaje\s+reenviado\s*-{3,}/i,
      /^\s*-{3,}\s*Forwarded\s+message\s*-{3,}/i,
      /^\s*El\s+.{5,120}\s+escribió\s*:?\s*$/i,
      /^\s*On\s+.{5,120}\s+wrote\s*:?\s*$/i,
      /^\s*De\s*:\s*.+/i,
      /^\s*From\s*:\s*.+/i,
    ];
    let idxCorte = -1;
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      for (const p of patrones) {
        if (p.test(l)) { idxCorte = i; break; }
      }
      if (idxCorte >= 0) break;
    }
    const azul = "var(--ptl-brand)";
    const gris = "var(--ptl-gray-500)";
    if (idxCorte < 0) {
      return `<span style="color:${azul}">${escFn(_reflowearTexto(raw))}</span>`;
    }
    const nuevoRaw = lineas.slice(0, idxCorte).join("\n").replace(/\s+$/g, "");
    const nuevo = _reflowearTexto(nuevoRaw);
    const histo = lineas.slice(idxCorte).join("\n");
    const nuevoHtml = nuevo ? `<span style="color:${azul}">${escFn(nuevo)}</span>` : "";
    const histoHtml = `<span style="color:${gris};font-size:11px">${escFn(histo)}</span>`;
    return nuevo ? `${nuevoHtml}\n\n${histoHtml}` : histoHtml;
  }

  function fmtFecha(f) {
    if (!f || f === "") return "—";
    const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
    // Fallback para otros formatos: intentar Date y formatear con guiones.
    const d = new Date(f.length > 10 ? f : f + "T00:00:00");
    if (isNaN(d)) return f;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const aa = String(d.getFullYear()).slice(2);
    return `${dd}-${mm}-${aa}`;
  }
  function fmtMoneda(n) {
    if (n == null || n === "") return "—";
    const num = parseFloat(String(n).replace(',', '.'));
    if (isNaN(num)) return "—";
    // v17.43: forzamos separador de miles también para números de 4 dígitos
    // (1.000–9.999). El locale es-ES por defecto NO los pone (norma RAE), pero
    // para uniformidad visual con números mayores los añadimos manualmente.
    const formatted = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(num);
    // Si el entero es de 4 dígitos (sin separador), insertamos el punto a mano.
    // Intl los da como "8802,45"; nosotros queremos "8.802,45".
    const parts = formatted.split(',');
    const intPart = parts[0];
    const intAbs = intPart.replace('-', '');
    let intFixed = intPart;
    if (intAbs.length === 4 && !intAbs.includes('.')) {
      const sign = intPart.startsWith('-') ? '-' : '';
      intFixed = `${sign}${intAbs[0]}.${intAbs.slice(1)}`;
    }
    return `${intFixed},${parts[1]} €`;
  }
  function fmtTlf(s) {
    if (!s) return "";
    let d = String(s).replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 12 && d.startsWith("34")) d = d.slice(2);
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    return String(s);
  }
  function splitList(s) { return String(s || "").split(",").map(x => x.trim()).filter(Boolean); }
  function ahoraISO() { return new Date().toISOString(); }

  // Validación de email: formato razonable, sin acentos ni espacios.
  // Acepta caracteres ASCII básicos. Si está vacío, devuelve true (campo opcional).
  function esEmailValido(s) {
    if (!s) return true;
    const v = String(s).trim();
    if (!v) return true;
    // Sin caracteres acentuados ni espacios
    if (/[áéíóúüñçÁÉÍÓÚÜÑÇ\s]/.test(v)) return false;
    // Formato básico: algo@algo.algo (todo ASCII imprimible salvo @ ni espacios)
    return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v);
  }
  // Validación de lista de emails separados por coma (para CCO).
  // Acepta hasta `max` direcciones (default 3). Si está vacío, válido.
  function esListaEmailsValida(s, max) {
    if (!s) return true;
    const lista = String(s).split(",").map(x => x.trim()).filter(Boolean);
    if (lista.length > (max || 3)) return false;
    return lista.every(esEmailValido);
  }
  function ccppId(direccion) {
    const slug = String(direccion || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(direccion || "").digest("hex").slice(0, 6);
    return `ccpp_${slug}_${hash}`;
  }

  // Construye una URL añadiendo automáticamente el token si existe.
  // params puede ser un objeto { fase: "01_CONTACTO", q: "alberche" }
  function urlT(token, path, params) {
    const usp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== "") usp.set(k, v);
      }
    }
    if (token) usp.set("token", token);
    const qs = usp.toString();
    return path + (qs ? "?" + qs : "");
  }

  // =================================================================
  // NORMALIZADORES DE PISOS — usados por la plantilla de vecinos
  // =================================================================
  // Se exportan vía app.locals.presupuestos para que documentacion.cjs
  // los use con la misma lógica. La validación de duplicados, el orden
  // de la tabla y la importación del histórico aplican estas reglas.
  // (Probadas en sandbox /home/claude/sandbox-vecinos/)

  // Normalización del CÓDIGO DE PISO (7 reglas):
  //   1. trim
  //   2. mayúsculas
  //   3. quitar paréntesis
  //   4. eliminar TODOS los espacios
  //   5. quitar acentos en vocales (Ñ se mantiene)
  //   6. quitar º y ª
  //   7. quitar barras `/` (los guiones `-` SÍ se conservan literalmente)
  function normalizarCodigoPiso(s) {
    if (s == null) return "";
    let r = String(s);
    r = r.trim();
    r = r.toUpperCase();
    r = r.replace(/[()]/g, "");
    r = r.replace(/\s+/g, "");
    r = r.replace(/Á/g, "A").replace(/É/g, "E").replace(/Í/g, "I")
         .replace(/Ó/g, "O").replace(/Ú/g, "U").replace(/Ü/g, "U");
    r = r.replace(/[ºª]/g, "");
    r = r.replace(/\//g, "");
    return r;
  }

  // Normalización del NOMBRE: solo trim + colapsar dobles espacios.
  function normalizarNombrePiso(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  // Normalización del TELÉFONO: devuelve { ok, valor, error? }.
  // Resultado válido: "" (vacío) o "+34" + 9 dígitos.
  // Compatible con el formato que usa el bot WhatsApp (normalizarTelefono
  // de index.cjs), de modo que el bot encuentra al vecino al recibir un
  // mensaje y la sincronización vecinos_base ↔ expedientes funciona.
  function normalizarTelefonoPiso(s) {
    if (s == null || String(s).trim() === "") return { ok: true, valor: "" };
    let r = String(s).trim().replace(/[^\d+]/g, "");
    if (r.startsWith("+")) {
      if (/^\+34\d{9}$/.test(r)) return { ok: true, valor: r };
      return { ok: false, valor: r, error: "El teléfono debe ser +34 seguido de 9 dígitos" };
    }
    if (/^34\d{9}$/.test(r)) return { ok: true, valor: "+" + r };
    if (/^\d{9}$/.test(r))   return { ok: true, valor: "+34" + r };
    return { ok: false, valor: r, error: "El teléfono debe ser un móvil/fijo español de 9 dígitos" };
  }

  // Comparador de orden NATURAL para códigos de piso: 9A < 10A.
  // Los trozos numéricos se comparan como números, los alfabéticos como letras.
  function comparadorNaturalPiso(a, b) {
    const re = /(\d+)|(\D+)/g;
    const aParts = String(a || "").match(re) || [];
    const bParts = String(b || "").match(re) || [];
    const n = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < n; i++) {
      const ap = aParts[i], bp = bParts[i];
      const aNum = /^\d+$/.test(ap), bNum = /^\d+$/.test(bp);
      if (aNum && bNum) {
        const da = parseInt(ap, 10), db = parseInt(bp, 10);
        if (da !== db) return da - db;
      } else {
        if (ap !== bp) return ap < bp ? -1 : 1;
      }
    }
    return aParts.length - bParts.length;
  }

  // =================================================================
  // CAPA DE ACCESO A DATOS — pestaña "comunidades"
  // =================================================================
  // Estructura de columnas (10 originales + 24 nuevas):
  //  A  comunidad (clave humana, ej "ESTRELLA ALDEBARAN 4")
  //  B  direccion
  //  C  presidente
  //  D  telefono_presidente
  //  E  email_presidente
  //  F  estado_comunidad
  //  G  fecha_inicio
  //  H  fecha_limite_documentacion
  //  I  fecha_limite_firma
  //  J  observaciones
  //  K  tipo_via
  //  L  earth
  //  M  administrador
  //  N  telefono_administrador
  //  O  email_administrador
  //  P  fase_presupuesto
  //  Q  fecha_contacto
  //  R  fecha_visita
  //  S  fecha_envio_pto
  //  T  fecha_ultimo_seguimiento_pto
  //  U  decision_pto
  //  V  fecha_aceptacion_pto
  //  W  pto_total
  //  X  mano_obra_previsto
  //  Y  mano_obra_real
  //  Z  material_previsto
  //  AA material_real
  //  AB beneficio_previsto    (calculado: W - X - Z - 150)
  //  AC beneficio_real        (calculado: W - Y - AA)
  //  AD beneficio_desvio      (calculado: AC - AB)
  //  AE tiempo_previsto
  //  AF tiempo_real
  //  AG tiempo_desvio         (calculado: 1 - AF/AE)
  //  AH notas_pto
  //  AI mails_enviados (JSON)
  //  AJ mails_ultimo_envio (JSON)
  //  AK fecha_proximo_mail_manual
  //  AL fecha_ultimo_reenvio_pto
  //  AM fecha_visita_emasesa   (fase 06_VISITA_EMASESA)
  //  AN fecha_documentacion_completa  (fase 05_DOCUMENTACION cerrada)
  //  AO fecha_contratos_pagos_completa (legacy: era el cierre de la antigua fase 07_CONTRATOS_PAGOS)
  //  AP modo_documentacion     (MANUAL | BOT — defecto MANUAL, irreversible MANUAL→BOT)
  //  AQ-AY estados manuales CCPP (gestionados por documentacion.cjs)
  //  AZ fecha_envio_contratos_pagos
  //  BA fecha_cycp_completa
  //  BB mails_manuales (JSON, paralelo a mails_enviados)

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_aceptacion_pto",
    "pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real",
    "beneficio_previsto","beneficio_real","beneficio_desvio",
    "tiempo_previsto","tiempo_real","tiempo_desvio","notas_pto",
    // AI, AJ — tracking de mails (JSON)
    "mails_enviados",        // JSON: { "01_CONTACTO": 3, "03_ENVIO_PTO": 1, ... }
    "mails_ultimo_envio",    // JSON: { "01_CONTACTO": "2026-04-27", ... }
    // AK, AL — fase 04
    "fecha_proximo_mail_manual",  // fecha YYYY-MM-DD que el usuario escribe cuando habla con el cliente
    "fecha_ultimo_reenvio_pto",   // fecha YYYY-MM-DD del último reenvío de presupuesto desde fase 04
    // AM — fase 06
    "fecha_visita_emasesa",       // fecha YYYY-MM-DD de la visita de EMASESA al CCPP
    // AN — cierre fase 05
    "fecha_documentacion_completa", // fecha YYYY-MM-DD en que se cerró la fase 05_DOCUMENTACION
    // AO — cierre fase 07
    "fecha_contratos_pagos_completa", // legacy: era el cierre de la antigua fase 07_CONTRATOS_PAGOS. Ya no se usa para definir fechas de hito (se mantiene en el Sheet por si hay datos históricos importados).
    // AP — modo de gestión documental del CCPP
    "modo_documentacion",         // "MANUAL" (defecto) | "BOT" (irreversible MANUAL → BOT)
    // AQ–AY — Estados manuales del CCPP (los gestiona documentacion.cjs).
    //   Se declaran aquí solo como placeholders para que rowToObj/objToRow no
    //   los pisen al leer/escribir filas. Mantienen su orden exacto en el Sheet.
    "est_ccpp_contrato_firmado",  // AQ
    "est_ccpp_toma_datos",        // AR
    "est_ccpp_nif",               // AS
    "est_ccpp_acta_pte",          // AT
    "est_ccpp_acta_pto",          // AU
    "est_ccpp_renuncia_gp",       // AV
    "est_ccpp_factura_emasesa",   // AW
    "est_ccpp_contrato",          // AX
    "est_ccpp_pago",              // AY
    // AZ — fecha de paso de fase 07-PTE CYCP a 08-CYCP (cuando se pulsa el
    //      botón "paso a 08-CYCP" y se envía el mail con los contratos a clientes).
    "fecha_envio_contratos_pagos",
    // BA — fecha de cierre final de fase 08-CYCP (cuando se pulsa "cerrar fase 08";
    //      indica que ya se han recibido y firmado todos los contratos).
    "fecha_cycp_completa",
    // BB — JSON con los envíos MANUALES por fase (paralelo a mails_enviados).
    //      Formato: { "01_CONTACTO": 1, "04_ACEPTACION_PTO": 2 }
    //      - mails_enviados   = total de envíos (manuales + automáticos del cron)
    //      - mails_manuales   = solo los hechos por la persona (incluye el inicial
    //                           y los "Reenviar presupuesto revisado")
    //      - reenvíos automáticos = mails_enviados - mails_manuales
    //      Para CCPPs antiguos sin este campo se asume que el primer envío fue
    //      manual (manuales = 1 si mails_enviados >= 1, sino 0).
    "mails_manuales",
    // BC — fecha límite para que los vecinos entreguen la documentación.
    //      Se calcula cuando se envía el mail de fase 05_ACEPTACION_PTO (hoy + 20 días)
    //      y se reutiliza en mails posteriores como variable {{fecha_limite_doc_vecinos}}.
    //      Formato YYYY-MM-DD.
    "fecha_limite_documentacion_vecinos",
    // BD motivo_rechazo: solo se rellena si fase pasa a ZZ_RECHAZADO. Valores
    // posibles: "POR PRECIO MÁS BAJO DE LA COMPETENCIA" o "PORQUE NO SE VA A
    // HACER DE MOMENTO" (los dos botones del modal).
    "motivo_rechazo",
    // BE fecha_cobro: fecha en que Instalaciones Araujo cobró la obra al cliente.
    // Formato YYYY-MM-DD. Solo se rellena manualmente desde la ficha en fase
    // 09_TRAMITADA. Si está rellena → cobrado; si vacía → pendiente de cobro.
    // Se usa para distinguir en la caja TOTAL TRAMITADO del panel HOY los
    // expedientes cobrados de los pendientes de cobro.
    "fecha_cobro",
    // BF en_hoy: "1" si el expediente está marcado para aparecer en HOY (reloj
    // activo junto al campo Notas de la ficha del expediente). Vacío en otro caso.
    // El cambio lo controla el endpoint /presupuestos/expediente/campo (toggle
    // 1/"" desde el botón reloj). En HOY se muestra una caja "Expedientes en HOY"
    // bajo "Mails pendientes" con las CCPPs que tengan en_hoy="1".
    "en_hoy",
  ];

  function rowToObj(row) {
    const o = {};
    for (let i = 0; i < COLS.length; i++) o[COLS[i]] = row[i] || "";
    // Generar id virtual estable a partir de la dirección (si existe) o comunidad
    const clave = o.direccion || o.comunidad || "";
    o.ccpp_id = clave ? ccppId(clave) : "";
    // v17.23: regularización progresiva 08_CYCP -> 09_TRAMITADA.
    // Si una CCPP tiene fase 08_CYCP y fecha_cycp_completa rellena, la tratamos
    // como 09_TRAMITADA en memoria. La primera vez que esa CCPP pase por
    // actualizarComunidad (al editar y guardar) se escribirá 09_TRAMITADA en el
    // Sheet. Sin script de migración: regularización automática.
    if (o.fase_presupuesto === "08_CYCP" && o.fecha_cycp_completa) {
      o.fase_presupuesto = "09_TRAMITADA";
    }
    // Compatibilidad con el código antiguo: alias 'tipo' = tipo_via, 'fase' = fase_presupuesto
    o.tipo = o.tipo_via || "";
    o.fase = normalizarFase(o.fase_presupuesto);
    o.importe = o.pto_total || "";
    o.notas = o.notas_pto || "";
    return o;
  }
  // v17.26: nombres de columnas que deben escribirse como NÚMERO nativo, no String.
  // Importes (€) con 2 decimales; tiempos (días) con 1 decimal.
  // Si el valor es vacío/null se escribe "" (deja la celda vacía).
  // El parseo es tolerante: acepta string con coma o punto y números nativos.
  const COLS_NUM_IMPORTE = new Set(["pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real"]);
  const COLS_NUM_TIEMPO  = new Set(["tiempo_previsto","tiempo_real"]);
  function _toNumOrEmpty(v, decimales) {
    if (v == null || v === "") return "";
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    if (!isFinite(n)) return "";
    // Redondear a los decimales pedidos sin que aparezcan números tipo 12855.199999
    return Math.round(n * Math.pow(10, decimales)) / Math.pow(10, decimales);
  }
  function objToRow(o) {
    return COLS.map(c => {
      const v = o[c];
      if (v == null) return "";
      if (COLS_NUM_IMPORTE.has(c)) return _toNumOrEmpty(v, 2);
      if (COLS_NUM_TIEMPO.has(c))  return _toNumOrEmpty(v, 1);
      return String(v);
    });
  }

  async function leerComunidades() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGO_COMUNIDADES,
      // v17.28: UNFORMATTED_VALUE para que los números vengan como Number nativo
      // y no como strings formateados con coma decimal y separador de miles ('99.999,99').
      // Las celdas de texto (fases, fechas ISO string, JSON) llegan tal cual.
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (!r[0] && !r[1])) continue; // saltar vacías
      const o = rowToObj(r);
      o._rowIndex = i + 1; // fila real en el Sheet (1-based, header en 1)
      out.push(o);
    }
    return out;
  }
  async function buscarComunidadPorId(id) {
    const todas = await leerComunidades();
    return todas.find(c => c.ccpp_id === id) || null;
  }
  async function actualizarComunidad(rowIndex, datos) {
    const sheets = getSheetsClient();
    // v17.21: los campos AB beneficio_previsto, AC beneficio_real, AD beneficio_desvio
    // y AG tiempo_desvio se calculan ahora con FÓRMULAS NATIVAS del Sheet.
    // Por eso ya no los calculamos aquí (lo hacía el código de v17.20 y anteriores)
    // y, sobre todo, NO los escribimos en la fila — escribir un valor o "" sobre
    // esas celdas borraría la fórmula que el Sheet usa para calcularlas.
    //
    // Las columnas son contiguas: AB-AD y AG. Por tanto la fila se escribe en
    // 3 rangos separados (A:AA, AE:AF, AH:BD) dentro de un solo batchUpdate.
    // Forzamos el valor "" para los 4 índices saltados en el row generado,
    // no se usa para escribir pero queda explícito que no se incluyen.
    const row = objToRow(datos);
    // Índices de las 4 columnas saltadas (0-based, según orden de COLS):
    //   AB beneficio_previsto = 27
    //   AC beneficio_real     = 28
    //   AD beneficio_desvio   = 29
    //   AG tiempo_desvio      = 32
    const tramoA  = row.slice(0, 27);   // A..AA (cols 0..26)
    const tramoEF = row.slice(30, 32);  // AE..AF (cols 30..31)
    const tramoH  = row.slice(33);      // AH..BD (cols 33..55)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `comunidades!A${rowIndex}:AA${rowIndex}`,  values: [tramoA]  },
          { range: `comunidades!AE${rowIndex}:AF${rowIndex}`, values: [tramoEF] },
          { range: `comunidades!AH${rowIndex}:BF${rowIndex}`, values: [tramoH]  },
        ],
      },
    });
  }
  async function crearComunidad(datos) {
    const sheets = getSheetsClient();
    if (!datos.fase_presupuesto) datos.fase_presupuesto = "01_CONTACTO";
    if (!datos.fecha_contacto) datos.fecha_contacto = new Date().toISOString().slice(0, 10);
    if (!datos.estado_comunidad) datos.estado_comunidad = "activa";
    // v17.21: asegurar que las 4 columnas calculadas se crean VACÍAS en el append
    // (luego un segundo update las pone con fórmulas USER_ENTERED).
    datos.beneficio_previsto = "";
    datos.beneficio_real     = "";
    datos.beneficio_desvio   = "";
    datos.tiempo_desvio      = "";
    const row = objToRow(datos);
    const apRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGO_COMUNIDADES,
      valueInputOption: "RAW",
      includeValuesInResponse: false,
      requestBody: { values: [row] },
    });
    // v17.21: tras el append, inyectar las 4 fórmulas nativas en la fila creada.
    // updatedRange devuelve algo como "comunidades!A210:BD210" → extraemos el nº fila.
    try {
      const m = String(apRes.data.updates && apRes.data.updates.updatedRange || "")
        .match(/!([A-Z]+)(\d+):/);
      if (m) {
        const n = parseInt(m[2], 10);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: [
              { range: `comunidades!AB${n}`, values: [[`=W${n}-X${n}-Z${n}-150`]] },
              { range: `comunidades!AC${n}`, values: [[`=IF(OR(W${n}="";Y${n}="";AA${n}="");"";W${n}-Y${n}-AA${n})`]] },
              { range: `comunidades!AD${n}`, values: [[`=IF(AC${n}="";"";AC${n}-AB${n})`]] },
              { range: `comunidades!AG${n}`, values: [[`=IF(OR(AE${n}="";AF${n}="";AE${n}=0);"";1-AF${n}/AE${n})`]] },
            ],
          },
        });
      }
    } catch (e) {
      console.warn("[presupuestos] No se pudieron inyectar fórmulas en la nueva CCPP:", e.message);
    }
  }
  async function actualizarCampoComunidad(rowIndex, campo, valor) {
    if (!COLS.includes(campo)) throw new Error("Campo no permitido: " + campo);
    const sheets = getSheetsClient();

    // v17.76 — ESCRITURA "SOLO LA CELDA" (modelo Excel). Antes se leía la fila
    // entera, se cambiaba un campo y se reescribían ~56 celdas. Eso (a) reformateaba
    // de pasada otros campos que el usuario no había tocado (posible causa de
    // "se modifican solos") y (b) aplicaba una regularización heredada 08->09 que
    // ya no afecta a ninguna CCPP. Ahora se escribe ÚNICAMENTE la celda del campo.
    //
    // PROTECCIÓN: las 4 columnas calculadas por fórmula nativa del Sheet
    // (beneficio_previsto/real/desvio, tiempo_desvio) NO se pueden escribir desde
    // aquí: hacerlo borraría la fórmula. Si llega una, se rechaza.
    const CAMPOS_FORMULA = new Set(["beneficio_previsto","beneficio_real","beneficio_desvio","tiempo_desvio"]);
    if (CAMPOS_FORMULA.has(campo)) {
      throw new Error(`El campo "${campo}" es calculado por el Sheet y no se escribe directamente.`);
    }

    const colIdx = COLS.indexOf(campo);
    const letra = _colNumALetra(colIdx);
    // Formato del valor a escribir: número nativo para importes (2 dec) y tiempos
    // (1 dec), texto para el resto. Mismo criterio que objToRow para una celda.
    let valorCelda;
    if (COLS_NUM_IMPORTE.has(campo))      valorCelda = _toNumOrEmpty(valor, 2);
    else if (COLS_NUM_TIEMPO.has(campo))  valorCelda = _toNumOrEmpty(valor, 1);
    else                                  valorCelda = (valor == null ? "" : String(valor));

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `comunidades!${letra}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[valorCelda]] },
    });

    // v17.75 — RELEÍDO DE VERIFICACIÓN. Releemos ESA celda y comparamos con lo
    // que se quiso guardar. Si no coincide, lanzamos error: el endpoint /campo
    // lo convierte en respuesta de fallo y el front pinta el campo en ROJO. Así
    // el verde solo aparece si el dato está de verdad en el Sheet.
    const rel = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `comunidades!${letra}${rowIndex}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const leido = (rel.data.values && rel.data.values[0] && rel.data.values[0][0] != null)
      ? rel.data.values[0][0] : "";
    if (!_mismoValorGuardado(campo, valor, leido)) {
      console.error(`[actualizarCampoComunidad] VERIFICACIÓN FALLIDA ${campo} (fila ${rowIndex}): se quiso "${valor}" pero el Sheet tiene "${leido}"`);
      throw new Error(`El campo "${campo}" no quedó guardado en el Sheet (se intentó "${valor}", quedó "${leido}").`);
    }
  }

  // v17.75 — Convierte índice 0-based de columna a letra(s) de Sheet (0→A, 25→Z, 26→AA...).
  function _colNumALetra(n) {
    let s = "";
    n = n + 1; // a 1-based
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // v17.75 — Compara, con tolerancia según el tipo de campo, el valor que se
  // quiso guardar contra el que quedó en el Sheet. Devuelve true si son "el
  // mismo dato" (aunque difiera el formato), para no dar falsos rojos.
  function _mismoValorGuardado(campo, quiso, leido) {
    const sQ = String(quiso == null ? "" : quiso).trim();
    const sL = String(leido == null ? "" : leido).trim();
    if (sQ === sL) return true;            // idénticos como texto → OK
    if (sQ === "" && sL === "") return true;
    // Números (importes y tiempos): comparar por valor numérico.
    if (COLS_NUM_IMPORTE.has(campo) || COLS_NUM_TIEMPO.has(campo)) {
      const nQ = parseFloat(sQ.replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, ""));
      const nL = parseFloat(String(sL).replace(",", "."));
      if (isNaN(nQ) && isNaN(nL)) return true;
      if (isNaN(nQ) || isNaN(nL)) return sQ === sL;
      // tolerancia mínima por redondeo de coma flotante
      return Math.abs(nQ - nL) < 0.005;
    }
    // Fechas (YYYY-MM-DD): comparar la parte de fecha normalizada.
    if (/^fecha_/.test(campo)) {
      const dQ = _normFechaCmp(sQ), dL = _normFechaCmp(sL);
      if (dQ && dL) return dQ === dL;
    }
    // Texto: comparación ya hecha arriba (sQ === sL). Distinto → no coincide.
    return false;
  }

  // v17.75 — Normaliza una fecha a YYYY-MM-DD para comparar (acepta ISO con hora,
  // serial de Sheets, o ya formateada). Devuelve "" si no se puede interpretar.
  function _normFechaCmp(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Serial de fecha de Sheets (número de días desde 1899-12-30)
    if (/^\d+(\.\d+)?$/.test(s)) {
      const dias = parseInt(s, 10);
      const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  }

  // =================================================================
  // CAPA DE ACCESO — mail_plantillas (lectura) y mail_historico (insertar)
  // =================================================================
  // Estructura mail_plantillas (columnas A-J):
  //   A fase | B activo (SI/NO) | C asunto | D mensaje | E adjuntos_fijos
  //   F dias_primer_envio (no usado: el primero es manual)
  //   G dias_recurrente | H max_envios | I cco | J cuenta_envio (id de mail_cuentas)
  //
  // El contenido de las plantillas (asuntos, cuerpos, parámetros) vive
  // ÍNTEGRAMENTE en la pestaña `mail_plantillas` del Sheet. Aquí no hay
  // valores por defecto: si una plantilla no existe en el Sheet,
  // `leerPlantillaMail` devuelve null y el endpoint /enviar-mail responde
  // con error 400 "Sin plantilla para esa fase".
  //
  // Estructura mail_cuentas (columnas A-E):
  //   A id | B email | C password | D host | E puerto
  // Cada fila es una cuenta de envío SMTP. La plantilla referencia una
  // cuenta por su id en col J. Si una plantilla no tiene cuenta_envio,
  // /enviar-mail devuelve error claro.
  const MAIL_PLANTILLAS_DEFAULT = {};

  // ─────────────────────────────────────────────────────────────────
  // CACHÉ DE mail_plantillas (v17.20)
  // Antes: cada llamada a leerPlantillaMail / leerListaPlantillas /
  // verificarAdjuntosDePlantillasCron / guardarPlantillaMail leía el
  // rango entero (mail_plantillas!A:J) independientemente. El cron
  // diario disparaba ~50 lecturas por ejecución; /plantillas (admin)
  // disparaba 13 secuenciales. Eso saturaba la cuota de 60 reads/min.
  //
  // Ahora: una sola lectura del rango cubre TODAS las funciones
  // durante TTL_MS. Se invalida automáticamente al guardar una
  // plantilla (guardarPlantillaMail) para que cualquier lectura
  // posterior vea los datos nuevos al instante.
  //
  // Las filas se cachean en crudo (array de arrays, tal cual las
  // devuelve Sheets), porque las distintas funciones consumidoras
  // hacen parseos distintos (objeto completo, lista de fases, set
  // de URLs de adjuntos, etc.).
  // ─────────────────────────────────────────────────────────────────
  let _mailPlantillasRowsCache = null;
  let _mailPlantillasRowsCacheTs = 0;
  const MAIL_PLANTILLAS_CACHE_TTL_MS = 60_000; // 1 minuto

  // Devuelve las filas crudas de mail_plantillas (array de arrays, sin
  // cabecera filtrada — el consumidor salta la fila 0). Usa caché TTL.
  // Si forzar=true, ignora el caché y vuelve a leer del Sheet.
  // En caso de error, devuelve null (no cachea el fallo) para que la
  // siguiente llamada reintente y no se queden datos vacíos pegados.
  async function _leerFilasMailPlantillas(forzar = false) {
    const ahora = Date.now();
    if (!forzar && _mailPlantillasRowsCache &&
        (ahora - _mailPlantillasRowsCacheTs) < MAIL_PLANTILLAS_CACHE_TTL_MS) {
      return _mailPlantillasRowsCache;
    }
    const sheets = getSheetsClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_PLANTILLAS,
      });
      const rows = res.data.values || [];
      _mailPlantillasRowsCache = rows;
      _mailPlantillasRowsCacheTs = ahora;
      return rows;
    } catch (e) {
      // No cacheamos el fallo: dejamos el caché previo (si lo hay)
      // o devolvemos null para que el consumidor caiga a defaults.
      console.warn("[presupuestos] mail_plantillas no disponible, usando defaults:", e.message);
      throw e;
    }
  }

  // Invalida el caché de mail_plantillas. Llamar tras guardar/borrar
  // una fila para que la próxima lectura vea los cambios sin esperar
  // al TTL.
  function _invalidarCacheMailPlantillas() {
    _mailPlantillasRowsCache = null;
    _mailPlantillasRowsCacheTs = 0;
  }

  // Caché en memoria de cuentas. Se refresca al cargar y se invalida si falla auth.
  let _cuentasCache = null;
  let _cuentasCacheTs = 0;
  const CUENTAS_CACHE_TTL_MS = 60_000; // 1 minuto

  async function leerCuentasMail(forzar = false) {
    const ahora = Date.now();
    if (!forzar && _cuentasCache && (ahora - _cuentasCacheTs) < CUENTAS_CACHE_TTL_MS) {
      return _cuentasCache;
    }
    const sheets = getSheetsClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_CUENTAS,
      });
      const rows = res.data.values || [];
      // Saltar cabecera (fila 1). Cada fila restante es una cuenta.
      const cuentas = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[1]) continue;
        const id = String(r[0]).trim();
        if (!id) continue;
        cuentas.push({
          id,
          email:    String(r[1] || "").trim(),
          password: String(r[2] || ""),  // sin trim por si la pass tiene espacios
          host:     String(r[3] || "").trim(),
          puerto:   parseInt(r[4]) || 465,
          host_imap:   String(r[5] || "").trim(),
          puerto_imap: parseInt(r[6]) || 993,
        });
      }
      _cuentasCache = cuentas;
      _cuentasCacheTs = ahora;
      return cuentas;
    } catch (e) {
      console.warn("[presupuestos] mail_cuentas no disponible:", e.message);
      _cuentasCache = [];
      _cuentasCacheTs = ahora;
      return [];
    }
  }

  // Devuelve la cuenta con ese id, o null si no existe.
  async function buscarCuentaMail(id) {
    if (!id) return null;
    const cuentas = await leerCuentasMail();
    return cuentas.find(c => c.id === String(id).trim()) || null;
  }

  // Devuelve { to, cc } para una CCPP combinando email_administrador y email_presidente.
  // Reglas:
  //   - Solo admin           -> { to: admin,           cc: "" }
  //   - Solo presi           -> { to: presi,           cc: "" }
  //   - Ambos                -> { to: admin,           cc: presi }
  //   - Ninguno              -> { to: "",              cc: "" }
  //   - Ambos iguales        -> { to: admin,           cc: "" }   (no duplica)
  function _destinatariosCcpp(comu) {
    const a = String((comu && comu.email_administrador) || "").trim();
    const p = String((comu && comu.email_presidente)   || "").trim();
    if (a && p) {
      if (a.toLowerCase() === p.toLowerCase()) return { to: a, cc: "" };
      return { to: a, cc: p };
    }
    if (a) return { to: a, cc: "" };
    if (p) return { to: p, cc: "" };
    return { to: "", cc: "" };
  }

  // Envía un mail real vía SMTP usando la cuenta indicada.
  // - cuentaId: id de la fila en mail_cuentas (ej. "administracion").
  // - destinatario: email(s) del destinatario principal ("To"). Acepta varios separados por coma.
  // =================================================================
  // ADJUNTOS REALES (descarga de Drive y adjunto al mail)
  // =================================================================
  // Cache en memoria de links Drive verificados (rotos detectados por la última
  // ronda de verificación o por intento de envío fallido). Esto alimenta al
  // futuro botón HOY → subtarea "Adjuntos rotos".
  // Estructura: Map<url, { ultimaComprobacion: Date, motivo: string }>
  const _adjuntosRotos = new Map();

  // Extrae el ID de un link de Drive en cualquier formato común.
  function extraerIdDrive(url) {
    if (!url) return null;
    const s = String(url).trim();
    let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  }

  // Dada una entrada "LABEL: url" devuelve { label, url }.
  function parsearEntradaAdjunto(s) {
    const str = String(s || "").trim();
    if (!str) return null;
    const idxHttp = str.search(/https?:\/\//i);
    if (idxHttp < 0) {
      return { label: str.replace(/:\s*$/, "").trim(), url: "" };
    }
    const label = str.slice(0, idxHttp).replace(/[:\s]+$/, "").trim();
    const url = str.slice(idxHttp).trim();
    return { label, url };
  }

  // Parsea texto completo de adjuntos ("LABEL: url || LABEL: url || ...").
  // Devuelve array de { label, url }. Las entradas con URL vacía se mantienen
  // (representan huecos sin link, que se ignoran en el envío).
  function parsearAdjuntosTexto(texto) {
    if (!texto) return [];
    const partes = String(texto).split(/\|\||[\r\n]+/);
    const out = [];
    for (const p of partes) {
      const entry = parsearEntradaAdjunto(p);
      if (!entry) continue;
      if (!entry.url && !entry.label) continue;
      out.push(entry);
    }
    return out;
  }

  // Descarga binaria con soporte de redirects (3xx).
  function _descargarConRedirects(url, maxRedirects) {
    return new Promise((resolve, reject) => {
      let u;
      try { u = new URL(url); } catch (e) { return reject(new Error("URL inválida: " + url)); }
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (maxRedirects <= 0) return reject(new Error("Demasiados redirects"));
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          _descargarConRedirects(next, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}${res.statusMessage ? " " + res.statusMessage : ""}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({
          buffer: Buffer.concat(chunks),
          headers: res.headers,
        }));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.setTimeout(20000, () => req.destroy(new Error("Timeout descargando " + url)));
    });
  }

  // Descarga un archivo público de Drive. Devuelve { buffer, filename, mimeType, size }.
  // Lanza error si falla.
  async function descargarDeDrive(driveUrl) {
    const id = extraerIdDrive(driveUrl);
    if (!id) throw new Error("URL de Drive no reconocida: " + driveUrl);
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    const { buffer, headers } = await _descargarConRedirects(downloadUrl, 5);
    let filename = "archivo";
    const cd = headers["content-disposition"] || "";
    let m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m) {
      try { filename = decodeURIComponent(m[1]); } catch (_) { filename = m[1]; }
    } else {
      m = cd.match(/filename="?([^";]+)"?/i);
      if (m) filename = m[1];
    }
    const mimeType = (headers["content-type"] || "application/octet-stream").split(";")[0].trim();
    // Detección de "Google Drive can't scan" cuando archivo > 100MB: devuelve HTML.
    if (mimeType.startsWith("text/html") && buffer.length < 1024 * 1024) {
      const txt = buffer.toString("utf8");
      if (/can't scan|virus|too large/i.test(txt)) {
        throw new Error("Drive bloqueó la descarga (archivo demasiado grande para escaneo antivirus)");
      }
    }
    return { buffer, filename, mimeType, size: buffer.length };
  }

  // Verifica si un link de Drive está accesible. Devuelve { ok, motivo }.
  async function verificarLinkDrive(driveUrl) {
    const id = extraerIdDrive(driveUrl);
    if (!id) return { ok: false, motivo: "URL no reconocida" };
    const checkUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    return new Promise((resolve) => {
      try {
        const req = https.get(checkUrl, (res) => {
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          res.resume();
          resolve({
            ok,
            motivo: ok ? "" : `HTTP ${res.statusCode}`,
          });
        });
        req.on("error", (e) => resolve({ ok: false, motivo: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, motivo: "Timeout" }); });
      } catch (e) {
        resolve({ ok: false, motivo: e.message });
      }
    });
  }

  // Devuelve cliente de Drive autenticado (reutiliza el OAuth2 del bot).
  function getDriveClient() {
    return google.drive({ version: "v3", auth: getGoogleAuth() });
  }

  // Busca (o crea si no existe) una subcarpeta para un expediente dentro
  // de la carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES.
  // Nombre de la carpeta: "tipo_via direccion" (ej. "C Alberche 17").
  // Devuelve el id de la carpeta. Si no hay configurada la carpeta padre,
  // devuelve null sin lanzar error (no debe bloquear la creación del expediente).
  async function getOrCreateCarpetaExpediente(tipoVia, direccion) {
    const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
    if (!parentId) {
      console.warn("[presupuestos] DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES no configurada, se omite creación de carpeta");
      return null;
    }
    const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
    if (!nombre) {
      console.warn("[presupuestos] getOrCreateCarpetaExpediente: nombre vacío, se omite");
      return null;
    }
    // Escapar comillas simples del nombre para la query de Drive.
    const nombreSafe = nombre.replace(/'/g, "\\'");
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      console.log(`[presupuestos] carpeta Drive ya existe: "${nombre}" (id=${busq.data.files[0].id})`);
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: nombre,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos] carpeta Drive creada: "${nombre}" (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  // ===================================================================
  // IMAP — Lectura de mails entrantes
  // ===================================================================
  // Las dependencias imapflow y mailparser se cargan perezosamente para no
  // romper el arranque si por alguna razón no están instaladas.
  let _ImapFlow = null;
  let _simpleParser = null;
  function _cargarDepsImap() {
    if (!_ImapFlow) {
      try { _ImapFlow = require("imapflow").ImapFlow; }
      catch (e) { throw new Error("Falta dependencia 'imapflow'. Instalar con: npm install imapflow"); }
    }
    if (!_simpleParser) {
      try { _simpleParser = require("mailparser").simpleParser; }
      catch (e) { throw new Error("Falta dependencia 'mailparser'. Instalar con: npm install mailparser"); }
    }
  }

  // Devuelve el cuerpo entero del mail SIN recortar el hilo de respuestas.
  // (Antes recortaba en el primer "El X escribió:" / "On X wrote:" / etc.
  //  Cambiado en v17.3 a petición de Guille: queremos el hilo completo.)
  function _limpiarCuerpoMail(texto) {
    if (!texto) return "";
    return String(texto).trim();
  }

  // Sube un buffer a Drive dentro de la carpeta indicada y devuelve el webViewLink.
  async function _subirBufferADrive(buffer, filename, mimeType, carpetaId) {
    const { Readable } = require("stream");
    const drive = getDriveClient();
    const file = await drive.files.create({
      requestBody: { name: filename, parents: [carpetaId] },
      media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
      fields: "id, name, webViewLink",
    });
    return file.data;
  }

  // [v17.13] Función clasificarMailEntrante eliminada por completo.
  // No se calculan ni almacenan sugerencias automáticas.


  // Garantiza que existe la carpeta IMAP "Descargados a plataforma" y devuelve
  // su nombre exacto. Si no existe, la crea.
  async function _asegurarCarpetaImap(client) {
    const NOMBRE = "Descargados a plataforma";
    try {
      const lista = await client.list();
      const existe = lista.some(box => box.path === NOMBRE || box.name === NOMBRE);
      if (!existe) {
        await client.mailboxCreate(NOMBRE);
        console.log(`[presupuestos][imap] Carpeta IMAP creada: ${NOMBRE}`);
      }
    } catch (e) {
      console.warn(`[presupuestos][imap] No se pudo asegurar carpeta IMAP "${NOMBRE}":`, e.message);
    }
    return NOMBRE;
  }

  // [v17.13] Sube los adjuntos del mail a la carpeta padre
  // DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES. Las sugerencias automáticas se
  // eliminaron, así que SIEMPRE se sube a la carpeta padre (quedan "sueltos"
  // hasta que el usuario clasifique el mail manualmente).
  // Devuelve string formato "LABEL: url || LABEL: url" igual que mail_historico.
  async function _subirAdjuntosEntrantes(adjuntos) {
    if (!adjuntos || adjuntos.length === 0) return "";
    const carpetaId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES || null;
    if (!carpetaId) {
      console.warn("[presupuestos][imap] No hay carpeta destino para adjuntos, se omiten");
      return "";
    }
    const links = [];
    for (const adj of adjuntos) {
      try {
        const subida = await _subirBufferADrive(adj.content, adj.filename, adj.contentType, carpetaId);
        const label = (adj.filename || "ADJUNTO").replace(/\|/g, "_");
        const url = subida.webViewLink || `https://drive.google.com/file/d/${subida.id}/view`;
        links.push(`${label}: ${url}`);
      } catch (e) {
        console.error(`[presupuestos][imap] Error subiendo adjunto "${adj.filename}":`, e.message);
      }
    }
    return links.join(" || ");
  }

  // Guarda un mail entrante en la pestaña mails_pendientes del Sheet.
  async function _guardarMailPendiente(datos) {
    const sheets = getSheetsClient();
    const fila = [
      datos.id || "",
      datos.fecha_recepcion || new Date().toISOString(),
      datos.message_id || "",
      datos.in_reply_to || "",
      datos.references || "",
      datos.remitente || "",
      datos.asunto || "",
      datos.cuerpo || "",
      datos.adjuntos || "",
      JSON.stringify(datos.sugerencias || []),
      datos.estado || "pendiente",
      datos.clasificado_a || "",
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGO_MAILS_PENDIENTES,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });
  }

  // Lee mails_pendientes y devuelve todas las filas que están "en HOY".
  // Esto incluye:
  //   - estado="pendiente"   → mail recién llegado, sin clasificar.
  //   - estado="clasificado" → mail ya asignado a un expediente pero
  //                            que el usuario quiere mantener visible en HOY.
  // NO devuelve filas con estado="descartado" (compat por si quedaran).
  async function leerMailsPendientes() {
    const sheets = getSheetsClient();
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
      });
      const rows = r.data.values || [];
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const estado = String(row[10] || "pendiente");
        if (estado === "descartado") continue;
        // [v17.13] La columna J (sugerencias) ya no se lee: lógica eliminada.
        out.push({
          _rowIndex: i + 1, // 1-based en Sheet
          id: row[0] || "",
          fecha_recepcion: row[1] || "",
          message_id: row[2] || "",
          in_reply_to: row[3] || "",
          references: row[4] || "",
          remitente: row[5] || "",
          asunto: row[6] || "",
          cuerpo: row[7] || "",
          adjuntos: row[8] || "",
          sugerencias: [],
          estado,
          clasificado_a: row[11] || "",
        });
      }
      // Ordenar ascendente por fecha_recepcion (más antiguos arriba).
      out.sort((a, b) => {
        const ta = Date.parse(a.fecha_recepcion);
        const tb = Date.parse(b.fecha_recepcion);
        if (isNaN(ta) && isNaN(tb)) return 0;
        if (isNaN(ta)) return 1;
        if (isNaN(tb)) return -1;
        return ta - tb;
      });
      return out;
    } catch (e) {
      console.error("[presupuestos][imap] Error leyendo mails_pendientes:", e.message);
      return [];
    }
  }

  // Devuelve un Set con los message_id que están actualmente "en HOY"
  // (presentes en mails_pendientes con estado != descartado). Usado en
  // la cajita Comunicaciones para pintar el reloj encendido/apagado.
  async function leerMessageIdsEnHoy() {
    const lista = await leerMailsPendientes();
    const ids = new Set();
    for (const m of lista) {
      if (m.message_id) ids.add(String(m.message_id).trim());
    }
    return ids;
  }

  // Marca un mail pendiente como "clasificado" o "descartado" en el Sheet.
  // No borra la fila — queda como auditoría.
  async function _actualizarEstadoMailPendiente(id, nuevoEstado, clasificadoA) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
    });
    const rows = r.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "") === String(id)) {
        const filaSheet = i + 1; // 1-based
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `mails_pendientes!K${filaSheet}:L${filaSheet}`,
          valueInputOption: "RAW",
          requestBody: { values: [[nuevoEstado, clasificadoA || ""]] },
        });
        return true;
      }
    }
    return false;
  }

  // Extrae los IDs de Drive de un texto "LABEL: url || LABEL: url".
  function _extraerIdsDriveDeTexto(texto) {
    const ids = [];
    if (!texto) return ids;
    const partes = String(texto).split(/\s*\|\|\s*/);
    for (const p of partes) {
      // Buscar URL de Drive en cada parte
      const m = p.match(/\/d\/([a-zA-Z0-9_-]{20,})|id=([a-zA-Z0-9_-]{20,})/);
      if (m) ids.push(m[1] || m[2]);
    }
    return ids;
  }

  // Manda a la papelera de Drive los archivos referenciados en una cadena
  // de adjuntos. No bloquea, solo logea errores.
  async function _papelearAdjuntosDeTexto(texto) {
    const ids = _extraerIdsDriveDeTexto(texto);
    if (ids.length === 0) return 0;
    const drive = getDriveClient();
    let okCount = 0;
    for (const fileId of ids) {
      try {
        await drive.files.update({ fileId, requestBody: { trashed: true } });
        okCount++;
      } catch (e) {
        console.warn(`[presupuestos] No se pudo papelear archivo Drive ${fileId}:`, e.message);
      }
    }
    return okCount;
  }

  // Devuelve (o crea) la subcarpeta "adjuntos" dentro de la carpeta del
  // expediente. Se crea la primera vez que llega un adjunto a clasificar.
  async function _getOrCreateCarpetaAdjuntosExpediente(tipoVia, direccion) {
    const carpetaExp = await getOrCreateCarpetaExpediente(tipoVia, direccion);
    if (!carpetaExp) return null;
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='adjuntos' and '${carpetaExp}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: "adjuntos",
        mimeType: "application/vnd.google-apps.folder",
        parents: [carpetaExp],
      },
      fields: "id",
    });
    console.log(`[presupuestos] Subcarpeta 'adjuntos' creada en expediente "${tipoVia} ${direccion}" (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  // Mueve los archivos de Drive referenciados en `texto` a la subcarpeta
  // `adjuntos` del expediente indicado. Devuelve el texto actualizado con
  // los nuevos links (o el original si nada cambió).
  async function _moverAdjuntosACarpetaExpediente(texto, comu) {
    if (!texto || !comu) return texto;
    const ids = _extraerIdsDriveDeTexto(texto);
    if (ids.length === 0) return texto;
    let carpetaDestId;
    try {
      carpetaDestId = await _getOrCreateCarpetaAdjuntosExpediente(comu.tipo_via, comu.direccion);
    } catch (e) {
      console.warn("[presupuestos] No se pudo obtener subcarpeta adjuntos:", e.message);
      return texto;
    }
    if (!carpetaDestId) return texto;
    const drive = getDriveClient();
    // Reescribir el texto sustituyendo URLs viejas por las nuevas (que cambia
    // poco porque el ID no cambia al mover, solo cambian los parents).
    let textoOut = texto;
    for (const fileId of ids) {
      try {
        // Obtener parents actuales para quitarlos.
        const meta = await drive.files.get({ fileId, fields: "parents, webViewLink, name" });
        const parentsActuales = (meta.data.parents || []).join(",");
        await drive.files.update({
          fileId,
          addParents: carpetaDestId,
          removeParents: parentsActuales,
          fields: "id, parents",
        });
        console.log(`[presupuestos] Adjunto "${meta.data.name}" movido a carpeta adjuntos del expediente`);
      } catch (e) {
        console.warn(`[presupuestos] No se pudo mover archivo ${fileId} a carpeta expediente:`, e.message);
      }
    }
    return textoOut; // los webViewLink siguen funcionando aunque se haya movido
  }

  // Borra físicamente la fila de mails_pendientes y manda los adjuntos a la
  // papelera de Drive. Devuelve true si encontró y borró la fila.
  async function _borrarMailPendiente(id) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
    });
    const rows = r.data.values || [];
    let filaIdx = -1;
    let adjuntosTexto = "";
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "") === String(id)) {
        filaIdx = i;
        adjuntosTexto = rows[i][8] || "";
        break;
      }
    }
    if (filaIdx < 0) return false;
    // Papelear adjuntos primero.
    try {
      const n = await _papelearAdjuntosDeTexto(adjuntosTexto);
      if (n > 0) console.log(`[presupuestos] Mail ${id}: ${n} adjuntos enviados a papelera Drive`);
    } catch (e) {
      console.warn("[presupuestos] Error papeleando adjuntos:", e.message);
    }
    // Borrar fila físicamente.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const hoja = meta.data.sheets.find(s => s.properties.title === "mails_pendientes");
    if (!hoja) throw new Error("Pestaña mails_pendientes no encontrada");
    const sheetId = hoja.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: filaIdx,
              endIndex: filaIdx + 1,
            },
          },
        }],
      },
    });
    return true;
  }

  // Función principal: lee no leídos del IMAP, procesa cada uno, guarda
  // pendiente en Sheet, mueve a "Descargados a plataforma". Devuelve resumen.
  async function ejecutarLecturaImap() {
    _cargarDepsImap();
    const cuentas = await leerCuentasMail();
    if (!cuentas || cuentas.length === 0) {
      return { ok: false, error: "No hay cuentas en mail_cuentas" };
    }
    const cuenta = cuentas[0]; // primera cuenta = administracion
    if (!cuenta.host_imap) {
      return { ok: false, error: "Falta host_imap en mail_cuentas col F" };
    }
    const client = new _ImapFlow({
      host: cuenta.host_imap,
      port: cuenta.puerto_imap || 993,
      secure: true,
      auth: { user: cuenta.email, pass: cuenta.password },
      logger: false,
    });
    let procesados = 0;
    let errores = 0;
    const detalle_errores = [];
    try {
      await client.connect();
      const carpetaDestino = await _asegurarCarpetaImap(client);
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Buscar no leídos.
        const uids = await client.search({ seen: false }, { uid: true });
        console.log(`[presupuestos][imap] No leídos en INBOX: ${uids.length}`);
        for (const uid of uids) {
          try {
            const { content } = await client.download(uid, undefined, { uid: true });
            // Parsear el mail con mailparser.
            const parsed = await _simpleParser(content);
            const mail = {
              remitente: (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address) || "",
              asunto: parsed.subject || "",
              cuerpo: _limpiarCuerpoMail(
                parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")
              ),
              message_id: parsed.messageId || "",
              inReplyTo: parsed.inReplyTo || "",
              references: parsed.references || "",
              adjuntos: (parsed.attachments || []).map(a => ({
                filename: a.filename || "adjunto",
                content: a.content,
                contentType: a.contentType || "application/octet-stream",
              })),
            };
            // Sugerencias automáticas eliminadas: siempre se guarda sin asignar.
            // Subir adjuntos a carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES.
            const adjuntosStr = await _subirAdjuntosEntrantes(mail.adjuntos);
            // Guardar como pendiente
            const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await _guardarMailPendiente({
              id: idPendiente,
              fecha_recepcion: new Date().toISOString(),
              message_id: mail.message_id,
              in_reply_to: mail.inReplyTo,
              references: Array.isArray(mail.references) ? mail.references.join(" ") : mail.references,
              remitente: mail.remitente,
              asunto: mail.asunto,
              cuerpo: (mail.cuerpo || "").slice(0, 5000), // recortar por si es enorme
              adjuntos: adjuntosStr,
              sugerencias: [],
              estado: "pendiente",
            });
            // Marcar como leído + mover a carpeta procesados.
            try {
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              await client.messageMove(uid, carpetaDestino, { uid: true });
            } catch (eMove) {
              console.warn(`[presupuestos][imap] No se pudo mover uid=${uid}:`, eMove.message);
            }
            procesados++;
          } catch (errMail) {
            errores++;
            detalle_errores.push(`uid=${uid}: ${errMail.message}`);
            console.error(`[presupuestos][imap] Error procesando uid=${uid}:`, errMail.message);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      try { await client.logout(); } catch (_) {}
    }
    return { ok: true, procesados, errores, detalle_errores };
  }

  // ===================================================================
  // Importar .eml sueltos desde una carpeta de Drive
  // ===================================================================
  // Lee todos los .eml de la carpeta DRIVE_FOLDER_EML_IMPORTAR, los parsea
  // igual que el cron IMAP (stripping, clasificación, adjuntos, pendientes)
  // y los mueve a una subcarpeta "Procesados" para no reprocesarlos.
  // Útil cuando alguien reenvía un .eml como adjunto o cuando hay mails de
  // otra cuenta sin IMAP configurado.
  async function _getOrCreateSubcarpetaProcesados(parentId) {
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='Procesados' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: "Procesados",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos][eml] subcarpeta "Procesados" creada (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  async function importarEmlsDeDrive() {
    _cargarDepsImap();
    const parentId = process.env.DRIVE_FOLDER_EML_IMPORTAR;
    if (!parentId) {
      return { ok: false, error: "Falta variable DRIVE_FOLDER_EML_IMPORTAR en Render" };
    }
    const drive = getDriveClient();
    // Listar .eml de la carpeta (no incluye Procesados porque filtramos por parents).
    // mimeType de los .eml suele ser "message/rfc822", pero a veces se sube como
    // application/octet-stream, así que también filtramos por extensión.
    const lista = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: "files(id,name,mimeType)",
      pageSize: 200,
    });
    const archivos = (lista.data.files || []).filter(f => {
      const n = String(f.name || "").toLowerCase();
      return n.endsWith(".eml") || f.mimeType === "message/rfc822";
    });
    console.log(`[presupuestos][eml] archivos .eml encontrados: ${archivos.length}`);
    if (archivos.length === 0) {
      return { ok: true, procesados: 0, errores: 0, detalle_errores: [] };
    }
    let procesadosCarpeta = null;
    try {
      procesadosCarpeta = await _getOrCreateSubcarpetaProcesados(parentId);
    } catch (e) {
      console.error("[presupuestos][eml] no se pudo crear/obtener subcarpeta Procesados:", e.message);
      return { ok: false, error: "No se pudo crear subcarpeta Procesados: " + e.message };
    }
    let procesados = 0;
    let errores = 0;
    const detalle_errores = [];
    for (const f of archivos) {
      try {
        // Descargar el .eml como buffer.
        const dl = await drive.files.get(
          { fileId: f.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const buf = Buffer.from(dl.data);
        // Parsear con mailparser.
        const parsed = await _simpleParser(buf);
        const remitenteEml = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address) || "";
        // Si es saliente (lo enviamos nosotros), capturar destinatario del To:
        // y prefijarlo al cuerpo con marcador [TO:...] para que al clasificar
        // se pueda extraer sin tocar el esquema de mails_pendientes.
        const esSalienteImp = remitenteEml.toLowerCase().includes("administracion@instalacionesaraujo.com");
        let destinatarioEml = "";
        if (esSalienteImp && parsed.to && parsed.to.value && parsed.to.value.length) {
          destinatarioEml = parsed.to.value.map(t => t.address).filter(Boolean).join(", ");
        }
        let cuerpoBase = _limpiarCuerpoMail(
          parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")
        );
        if (esSalienteImp && destinatarioEml) {
          cuerpoBase = `[TO:${destinatarioEml}]\n${cuerpoBase}`;
        }
        const mail = {
          remitente: remitenteEml,
          asunto: parsed.subject || "",
          cuerpo: cuerpoBase,
          message_id: parsed.messageId || "",
          inReplyTo: parsed.inReplyTo || "",
          references: parsed.references || "",
          adjuntos: (parsed.attachments || []).map(a => ({
            filename: a.filename || "adjunto",
            content: a.content,
            contentType: a.contentType || "application/octet-stream",
          })),
        };
        // Sugerencias automáticas eliminadas: siempre se guarda sin asignar.
        const adjuntosStr = await _subirAdjuntosEntrantes(mail.adjuntos);
        // Fecha real del mail (cabecera Date). Si no viene, caemos a "ahora".
        let fechaMail;
        try {
          if (parsed.date) {
            const d = (parsed.date instanceof Date) ? parsed.date : new Date(parsed.date);
            if (!isNaN(d.getTime())) fechaMail = d.toISOString();
          }
        } catch (_) {}
        if (!fechaMail) fechaMail = new Date().toISOString();
        // Guardar como pendiente
        const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await _guardarMailPendiente({
          id: idPendiente,
          fecha_recepcion: fechaMail,
          message_id: mail.message_id,
          in_reply_to: mail.inReplyTo,
          references: Array.isArray(mail.references) ? mail.references.join(" ") : mail.references,
          remitente: mail.remitente,
          asunto: mail.asunto,
          cuerpo: (mail.cuerpo || "").slice(0, 5000),
          adjuntos: adjuntosStr,
          sugerencias: [],
          estado: "pendiente",
        });
        // Mover el .eml a subcarpeta Procesados.
        try {
          const meta = await drive.files.get({ fileId: f.id, fields: "parents" });
          const prevParents = (meta.data.parents || []).join(",");
          await drive.files.update({
            fileId: f.id,
            addParents: procesadosCarpeta,
            removeParents: prevParents,
            fields: "id, parents",
          });
        } catch (eMove) {
          console.warn(`[presupuestos][eml] no se pudo mover "${f.name}":`, eMove.message);
        }
        procesados++;
        console.log(`[presupuestos][eml] procesado "${f.name}" → mails_pendientes (${idPendiente})`);
      } catch (errEml) {
        errores++;
        detalle_errores.push(`${f.name}: ${errEml.message}`);
        console.error(`[presupuestos][eml] error procesando "${f.name}":`, errEml.message);
      }
    }
    return { ok: true, procesados, errores, detalle_errores };
  }

  // Cron interno cada 5 minutos. Se inicia al cargar el módulo.
  let _imapCronEnMarcha = false;
  function _arrancarCronImap() {
    const INTERVALO_MS = 30 * 60 * 1000;
    async function tick() {
      if (_imapCronEnMarcha) return;
      _imapCronEnMarcha = true;
      try {
        const r = await ejecutarLecturaImap();
        if (r.procesados > 0 || r.errores > 0) {
          console.log(`[presupuestos][imap][cron] procesados=${r.procesados} errores=${r.errores}`);
        }
      } catch (e) {
        console.error("[presupuestos][imap][cron] error:", e.message);
      } finally {
        _imapCronEnMarcha = false;
      }
    }
    // Primer tick al minuto de arrancar; después cada 5 min.
    setTimeout(tick, 60 * 1000);
    setInterval(tick, INTERVALO_MS);
    console.log(`[presupuestos][imap] Cron arrancado (intervalo ${INTERVALO_MS / 1000}s)`);
  }
  // Arrancar cron solo si la variable está habilitada (para poder desactivar
  // en dev). Por defecto, activado.
  if (process.env.IMAP_CRON_DISABLED !== "1") {
    _arrancarCronImap();
  }

  // Procesa una lista de adjuntos: descarga los que tienen URL, devuelve
  // { attachments, rotos, ignorados }.
  //   attachments: array para nodemailer ({ filename, content, contentType })
  //   rotos: array de { label, url, motivo } — links que fallaron
  //   ignorados: array de labels que no tenían URL (huecos)
  async function procesarAdjuntos(textoAdjuntos) {
    const entradas = parsearAdjuntosTexto(textoAdjuntos);
    const attachments = [];
    const rotos = [];
    const ignorados = [];
    for (const e of entradas) {
      if (!e.url) {
        ignorados.push(e.label);
        continue;
      }
      // Si no es Drive, lo ignoramos (no sabemos descargarlo) — más adelante se podría ampliar.
      if (!extraerIdDrive(e.url)) {
        rotos.push({ label: e.label, url: e.url, motivo: "No es un link de Drive válido" });
        continue;
      }
      try {
        const f = await descargarDeDrive(e.url);
        attachments.push({
          filename: f.filename,
          content: f.buffer,
          contentType: f.mimeType,
        });
        // Si previamente estaba marcado como roto, lo limpiamos.
        _adjuntosRotos.delete(e.url);
      } catch (err) {
        rotos.push({ label: e.label, url: e.url, motivo: err.message });
        _adjuntosRotos.set(e.url, { ultimaComprobacion: new Date(), motivo: err.message });
      }
    }
    return { attachments, rotos, ignorados };
  }

  // Devuelve la lista actual de adjuntos rotos detectados (en memoria).
  function listarAdjuntosRotos() {
    const out = [];
    for (const [url, info] of _adjuntosRotos.entries()) {
      out.push({ url, ultimaComprobacion: info.ultimaComprobacion, motivo: info.motivo });
    }
    return out;
  }

  // =================================================================
  // ENVÍO REAL DE MAILS
  // =================================================================

  // Función central de envío.
  // - cuentaId: id de fila en mail_cuentas (típicamente "administracion").
  // - destinatario: string ("a@b.com" o "a@b.com, c@d.com").
  // - cc: array o string — destinatarios en CC (visible).
  // - cco: array o string — destinatarios en BCC.
  // - asunto, mensaje (texto plano).
  // - adjuntosUrls: array de strings con formato "LABEL: url" (separados por
  //   || antes de llegar aquí) O un texto crudo "LABEL: url || LABEL: url".
  //   Las URLs de Drive se DESCARGAN y se adjuntan como adjuntos reales.
  //   Si algún link falla, se LANZA error y NO se envía el mail (regla del usuario:
  //   ningún mail debe salir sin sus adjuntos). El error indica qué link está roto
  //   para que se pueda diagnosticar.
  // Lanza error si falla. Devuelve el messageId.
  async function enviarMailReal({ cuentaId, destinatario, cc, cco, asunto, mensaje, adjuntosUrls }) {
    if (!destinatario) throw new Error("Falta destinatario");
    const cuenta = await buscarCuentaMail(cuentaId);
    if (!cuenta) throw new Error(`Cuenta de envío "${cuentaId}" no encontrada en mail_cuentas`);
    if (!cuenta.email || !cuenta.password || !cuenta.host) {
      throw new Error(`Cuenta "${cuentaId}" mal configurada (faltan email/password/host)`);
    }

    let cuerpo = String(mensaje || "");

    // Procesar adjuntos: si recibimos array, lo unimos con "||" para reusar el parser único.
    let textoAdj = "";
    if (Array.isArray(adjuntosUrls)) {
      textoAdj = adjuntosUrls.filter(Boolean).join(" || ");
    } else if (adjuntosUrls) {
      textoAdj = String(adjuntosUrls);
    }
    const { attachments, rotos, ignorados } = await procesarAdjuntos(textoAdj);
    if (rotos.length > 0) {
      const detalle = rotos.map(r => `· ${r.label || "(sin label)"}: ${r.motivo}`).join("\n");
      throw new Error(
        `No se envía el mail: ${rotos.length} adjunto(s) con link roto.\n${detalle}\n` +
        `URLs afectadas:\n${rotos.map(r => "  " + r.url).join("\n")}`
      );
    }
    // (los huecos sin link, "ignorados", se descartan en silencio — son labels
    // de adjuntos no rellenados por el usuario, comportamiento histórico.)

    // Pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D)
    try {
      const pie = await leerPlantillaMail("_PIE_GLOBAL");
      const textoPie = pie && pie.mensaje ? String(pie.mensaje).trim() : "";
      if (textoPie) cuerpo += "\n\n" + textoPie;
    } catch (e) { /* si falla, no se añade pie */ }

    // CC: aceptar string o array. Acepta separadores ||, comas, ;, saltos de línea.
    let ccStr = "";
    if (Array.isArray(cc)) ccStr = cc.filter(Boolean).join(", ");
    else if (cc) ccStr = String(cc).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");

    // CCO: aceptar string o array. Acepta separadores ||, comas, ;, saltos de línea.
    let bcc = "";
    if (Array.isArray(cco)) bcc = cco.filter(Boolean).join(", ");
    else if (cco) bcc = String(cco).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");

    const transporter = nodemailer.createTransport({
      host: cuenta.host,
      port: cuenta.puerto,
      secure: cuenta.puerto === 465, // true para 465, false para otros (TLS STARTTLS)
      auth: { user: cuenta.email, pass: cuenta.password },
    });

    const info = await transporter.sendMail({
      from: cuenta.email,
      to: destinatario,
      cc:  ccStr || undefined,
      bcc: bcc   || undefined,
      subject: asunto || "",
      text: cuerpo,
      attachments: attachments.length ? attachments : undefined,
    });
    return info.messageId;
  }

  async function leerPlantillaMail(fase) {
    let rows;
    try {
      // v17.20: una sola lectura cacheada cubre todas las llamadas
      // dentro del TTL (60s). Antes era 1 lectura por llamada.
      rows = await _leerFilasMailPlantillas();
    } catch (e) {
      // Pestaña no existe o error de cuota → caer a defaults
      const def = MAIL_PLANTILLAS_DEFAULT[fase];
      return def ? Object.assign({ fase, activo: def.activo === "SI" }, def) : null;
    }
    // Header: A fase | B activo | C asunto | D mensaje | E adjuntos | F dias_primer | G dias_recurrente | H max_envios | I cco | J cuenta_envio
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      if (String(r[0]).trim() === fase) {
        return {
          fase,
          activo:           (r[1] || "SI").toUpperCase() === "SI",
          asunto:           r[2] || "",
          mensaje:          r[3] || "",
          adjuntos_fijos:   r[4] || "",
          dias_primer_envio: parseInt(r[5]) || 0,
          dias_recurrente:  parseInt(r[6]) || 0,
          max_envios:       parseInt(r[7]) || 0,
          cco:              r[8] || "",
          cuenta_envio:     (r[9] || "").trim(),
          _rowIndex:        i + 1, // fila real en el Sheet (1-based)
        };
      }
    }
    // Fase no encontrada → default si lo hay, null si no
    const def = MAIL_PLANTILLAS_DEFAULT[fase];
    return def ? Object.assign({ fase, activo: def.activo === "SI" }, def) : null;
  }

  // Guarda una plantilla en mail_plantillas. Si la fila existe, la actualiza; si no, la añade.
  async function guardarPlantillaMail(datos) {
    const sheets = getSheetsClient();
    const fila = [
      datos.fase || "",
      datos.activo === "SI" ? "SI" : "NO",
      datos.asunto || "",
      datos.mensaje || "",
      datos.adjuntos_fijos || "",
      String(datos.dias_primer_envio || 0),
      String(datos.dias_recurrente || 0),
      String(datos.max_envios || 0),
      datos.cco || "",
      datos.cuenta_envio || "",
    ];
    // Buscar si ya existe
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAIL_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === datos.fase) {
        rowIndex = i + 1; break;
      }
    }
    if (rowIndex > 0) {
      // Update
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `mail_plantillas!A${rowIndex}:J${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      // Append
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_MAIL_PLANTILLAS,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }
    // v17.20: invalidar caché para que la próxima lectura traiga la
    // plantilla recién guardada sin esperar al TTL de 60s.
    _invalidarCacheMailPlantillas();
  }

  // =================================================================
  // PLANTILLAS DE DOCUMENTOS (EMASESA) — tab `doc_plantillas` (v17.82)
  // Estructura: A clave | B titulo | C cuerpo | D activo
  // Mismo patrón que mail_plantillas pero más simple: el documento solo
  // tiene título y cuerpo (no asunto, ni días, ni cuenta de envío).
  // Filas especiales: _ENCABEZADO_GLOBAL y _PIE_GLOBAL (comunes a todos
  // los documentos, igual que el _PIE_GLOBAL de los mails).
  // =================================================================

  // Devuelve TODAS las filas de doc_plantillas como array de objetos
  // {clave, titulo, cuerpo, activo}. Sin caché (se edita poco; lectura directa).
  async function leerPlantillasDoc() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOC_PLANTILLAS,
    });
    const rows = res.data.values || [];
    const out = [];
    // Fila 0 = cabeceras; empezamos en la 1
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      out.push({
        clave:   String(r[0]).trim(),
        titulo:  r[1] || "",
        cuerpo:  r[2] || "",
        activo:  (r[3] === undefined || r[3] === null || String(r[3]).trim() === "") ? true
                  : (String(r[3]).trim() === "1" || String(r[3]).trim().toUpperCase() === "SI"),
        _rowIndex: i + 1, // fila real en el Sheet (1-based)
      });
    }
    return out;
  }

  // Devuelve UNA plantilla de documento por su clave, o null si no existe.
  async function leerPlantillaDoc(clave) {
    const todas = await leerPlantillasDoc();
    return todas.find(p => p.clave === clave) || null;
  }

  // Guarda una plantilla de documento. Si la fila (por clave) existe, la
  // actualiza; si no, la añade. Solo escribe título y cuerpo: la clave es el
  // identificador y la columna `activo` se respeta (no se toca desde aquí).
  async function guardarPlantillaDoc(datos) {
    const sheets = getSheetsClient();
    const clave = String(datos.clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    // Buscar si ya existe
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_DOC_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    let activoExistente = "1";
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) {
        rowIndex = i + 1;
        // conservar el valor de `activo` que ya tuviera la fila
        if (rows[i][3] !== undefined && rows[i][3] !== null && String(rows[i][3]).trim() !== "") {
          activoExistente = String(rows[i][3]).trim();
        }
        break;
      }
    }
    const fila = [
      clave,
      String(datos.titulo || ""),
      String(datos.cuerpo || ""),
      activoExistente, // se mantiene tal cual estaba (1 por defecto)
    ];
    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `doc_plantillas!A${rowIndex}:D${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_DOC_PLANTILLAS,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    }
  }

  // =================================================================
  // GENERACIÓN DE DOCUMENTOS PDF (Sprint A — Bloque 2, v17.83)
  // =================================================================

  // Clasificación de documentos: GENERAL (de la comunidad, no pide piso)
  // o PARTICULAR (pide elegir un piso de la comunidad).
  const DOCS_GENERALES   = ["mantener_presion", "renunciar_presion"];
  const DOCS_PARTICULARES = ["paso_instalaciones", "usufructo", "piso_disidente", "contador_unico"];

  // Para cada documento, qué HUECOS tiene y de dónde se precarga cada uno.
  // origen: 'comunidad:<campo>' | 'piso:<campo>' | 'manual' | 'auto'
  // (los 'manual' salen vacíos para rellenar a mano; 'auto' = fecha de hoy).
  // El campo `tipo` (general/particular) decide si el menú pide piso.
  const DOC_HUECOS = {
    paso_instalaciones: { tipo: "particular", huecos: [
      { clave: "propietario",     label: "Propietario",         origen: "piso:nota_simple" },
      { clave: "nif_propietario", label: "NIF del propietario", origen: "manual" },
      { clave: "piso",            label: "Piso/local/trastero", origen: "piso:vivienda" },
      { clave: "comunidad",       label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
    ]},
    usufructo: { tipo: "particular", huecos: [
      { clave: "propietario",       label: "Propietario",           origen: "piso:nota_simple" },
      { clave: "nif_propietario",   label: "NIF del propietario",   origen: "manual" },
      { clave: "piso",              label: "Piso",                  origen: "piso:vivienda" },
      { clave: "comunidad",         label: "Comunidad (CCPP)",      origen: "comunidad:direccion_completa" },
      { clave: "usufructuario",     label: "Usufructuario",         origen: "piso:nombre" },
      { clave: "nif_usufructuario", label: "NIF del usufructuario", origen: "manual" },
    ]},
    mantener_presion: { tipo: "general", huecos: [
      { clave: "presidente",     label: "Presidente",          origen: "comunidad:presidente" },
      { clave: "nif_presidente", label: "NIF del presidente",  origen: "manual" },
      { clave: "comunidad",      label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
      { clave: "nif_comunidad",  label: "NIF de la comunidad", origen: "manual" },
    ]},
    renunciar_presion: { tipo: "general", huecos: [
      { clave: "presidente",     label: "Presidente",          origen: "comunidad:presidente" },
      { clave: "nif_presidente", label: "NIF del presidente",  origen: "manual" },
      { clave: "comunidad",      label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
      { clave: "nif_comunidad",  label: "NIF de la comunidad", origen: "manual" },
    ]},
    contador_unico: { tipo: "particular", huecos: [
      { clave: "propietario",     label: "Propietario",         origen: "piso:nota_simple" },
      { clave: "nif_propietario", label: "NIF del propietario", origen: "manual" },
      { clave: "pisos",           label: "Pisos (unidos)",      origen: "piso:vivienda" },
      { clave: "comunidad",       label: "Comunidad (CCPP)",    origen: "comunidad:direccion_completa" },
    ]},
    piso_disidente: { tipo: "particular", huecos: [
      { clave: "comunidad", label: "Comunidad (CCPP)", origen: "comunidad:direccion_completa" },
      { clave: "piso",      label: "Piso",             origen: "piso:vivienda" },
      { clave: "titular",   label: "Titular",          origen: "piso:nota_simple" },
    ]},
  };

  // Devuelve el valor precargado de un hueco a partir de comu y piso.
  function _valorHueco(origen, comu, piso) {
    if (!origen || origen === "manual" || origen === "auto") return "";
    const [tipo, campo] = origen.split(":");
    if (tipo === "comunidad") {
      if (campo === "direccion_completa") {
        const tv = String(comu && comu.tipo_via || "").trim();
        const dir = String(comu && comu.direccion || "").trim();
        return (tv ? tv + " " : "") + dir;
      }
      return String((comu && comu[campo]) || "").trim();
    }
    if (tipo === "piso") {
      return String((piso && piso[campo]) || "").trim();
    }
    return "";
  }

  // Lista simple de los pisos de una comunidad (por id) para el menú de
  // selección. Empareja por dirección (como _leerPisosDeCcpp) pero sin
  // depender de la matriz de documentación. Devuelve {vivienda, propietario, usufructuario}.
  async function _pisosParaDocumentos(ccppId) {
    const comu = await buscarComunidadPorId(ccppId);
    if (!comu) return { comu: null, pisos: [] };
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return { comu, pisos: [] };
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    const idxNota = hdr.indexOf("nota_simple"); // propietario
    const idxNom = hdr.indexOf("nombre");       // usufructuario
    const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const objetivo = norm(comu.direccion);
    const pisos = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) !== objetivo) continue;
      pisos.push({
        vivienda:     idxViv  >= 0 ? String(f[idxViv]  || "").trim() : "",
        nota_simple:  idxNota >= 0 ? String(f[idxNota] || "").trim() : "",
        nombre:       idxNom  >= 0 ? String(f[idxNom]  || "").trim() : "",
      });
    }
    return { comu, pisos };
  }

  // Fecha de hoy en español, mes en palabra: "24 de mayo de 2026".
  function _fechaHoyLarga() {
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
                   "agosto","septiembre","octubre","noviembre","diciembre"];
    const d = new Date();
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // Sustituye los [huecos] de un texto por sus valores. Los que no tengan
  // valor se dejan como una línea de subrayado para rellenar a mano.
  // v17.87: normaliza saltos de línea — quita los retornos de carro (CR) que
  // vienen del Sheet/Windows (CRLF) y que pdfkit dibujaba como un símbolo raro "Đ".
  function _rellenarHuecos(texto, valores) {
    const limpio = String(texto || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return limpio.replace(/\[([a-z_]+)\]/gi, (m, clave) => {
      const v = valores[clave];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      return "__________"; // hueco sin dato → línea para rellenar a mano
    });
  }

  // Genera el PDF (Buffer) con una PÁGINA por documento seleccionado.
  // docs = [{ clave, valores }]  (valores ya incluye lo que el usuario confirmó/editó)
  // encabezado/pie son los textos globales de la tab.
  async function generarPdfDocumentos(docs, encabezadoTxt, pieTxt) {
    const PDFDocument = require("pdfkit");
    return await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margins: { top: 70, bottom: 70, left: 70, right: 70 } });
        const chunks = [];
        doc.on("data", c => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const fecha = _fechaHoyLarga();
        docs.forEach((d, i) => {
          if (i > 0) doc.addPage();
          // Encabezado general (común) — alineado a la DERECHA (v17.86)
          if (encabezadoTxt && encabezadoTxt.trim()) {
            const encabLimpio = encabezadoTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
            doc.font("Helvetica").fontSize(12).fillColor("#000");
            doc.text(encabLimpio, { align: "right" });
            doc.moveDown(0.6);
            // Línea horizontal continua justo bajo el encabezado (de margen a margen)
            const xIzq = doc.page.margins.left;
            const xDer = doc.page.width - doc.page.margins.right;
            doc.moveTo(xIzq, doc.y).lineTo(xDer, doc.y).lineWidth(1).strokeColor("#000").stroke();
            doc.moveDown(2.5); // v17.88: ~2 retornos de carro de separación bajo la línea
          }
          // Cuerpo del documento, con huecos rellenados — Helvetica 14pt (v17.86)
          const cuerpo = _rellenarHuecos(d.cuerpo, d.valores);
          doc.font("Helvetica").fontSize(14).fillColor("#000");
          doc.text(cuerpo, { align: "justify", lineGap: 4 });
          const yTrasCuerpo = doc.y; // dónde acabó el cuerpo
          // Pie general (común), con [fecha] automática — Helvetica 14pt
          // v17.89: el pie se ancla al FONDO de la página (estilo carta formal).
          if (pieTxt && pieTxt.trim()) {
            const pieFinal = _rellenarHuecos(pieTxt, { fecha });
            doc.font("Helvetica").fontSize(14).fillColor("#000");
            const anchoPie = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const altoPie = doc.heightOfString(pieFinal, { width: anchoPie, lineGap: 4 });
            const yFondo = doc.page.height - doc.page.margins.bottom - altoPie;
            // Si el cuerpo no llega tan abajo, pegamos el pie al fondo; si el
            // documento es muy largo y el pie no cabe, lo ponemos justo tras el
            // cuerpo con una separación mínima (nunca se solapa).
            const yPie = (yFondo > yTrasCuerpo + 24) ? yFondo : (yTrasCuerpo + 24);
            doc.text(pieFinal, doc.page.margins.left, yPie, { align: "left", lineGap: 4, width: anchoPie });
          }
        });
        doc.end();
      } catch (e) { reject(e); }
    });
  }

  async function registrarMailEnHistorico(datos) {
    // datos: { fecha, ccpp_id, direccion, fase, destinatario, asunto, mensaje, adjuntos, tipo, message_id }
    const sheets = getSheetsClient();
    const fila = [
      datos.fecha || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      datos.destinatario || "",
      datos.asunto || "",
      datos.mensaje || "",
      datos.adjuntos || "",
      datos.tipo || "manual",
      datos.message_id || "",
    ];
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGO_MAIL_HISTORICO,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } catch (e) {
      console.error("[presupuestos] No se pudo registrar en mail_historico:", e.message);
      throw e;
    }
  }

  // Lee mail_historico filtrando por CCPP. Identifica filas por ccpp_id (col B);
  // si la fila no lo tiene (envíos antiguos `manual_externo`), cae a coincidencia
  // por `direccion` (col C). Devuelve ordenado ascendente por fecha.
  async function leerMailHistoricoDeCcpp(ccpp_id, direccion) {
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      console.error("[presupuestos] No se pudo leer mail_historico:", e.message);
      return [];
    }
    const out = [];
    const dirNorm = String(direccion || "").trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const rowId = String(r[1] || "").trim();
      const rowDir = String(r[2] || "").trim().toLowerCase();
      const matchPorId = ccpp_id && rowId === ccpp_id;
      const matchPorDir = !rowId && dirNorm && rowDir === dirNorm;
      if (!matchPorId && !matchPorDir) continue;
      out.push({
        fecha: r[0] || "",
        ccpp_id: r[1] || "",
        direccion: r[2] || "",
        fase: r[3] || "",
        destinatario: r[4] || "",
        asunto: r[5] || "",
        mensaje: r[6] || "",
        adjuntos: r[7] || "",
        tipo: r[8] || "",
        message_id: r[9] || "",
      });
    }
    // Ordenar ascendente por fecha. Las fechas vienen mezcladas:
    //   - ISO string: "2026-05-10T09:49:48.560Z"
    //   - Date legacy: "2025-04-01 00:00:00" o "01/04/2025"
    // Date.parse() come ambas; las que no parsea quedan al final.
    out.sort((a, b) => {
      const ta = Date.parse(a.fecha);
      const tb = Date.parse(b.fecha);
      const va = isNaN(ta) ? Infinity : ta;
      const vb = isNaN(tb) ? Infinity : tb;
      return va - vb;
    });
    return out;
  }

  // Devuelve la lista de códigos de plantilla activos (sin _PIE_GLOBAL).
  async function leerListaPlantillas() {
    let rows;
    try {
      // v17.20: usa el mismo caché que leerPlantillaMail
      rows = await _leerFilasMailPlantillas();
    } catch (e) {
      console.warn("[presupuestos] No se pudo leer mail_plantillas:", e.message);
      return [];
    }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const fase = String(r[0]).trim();
      if (fase.startsWith("_")) continue; // _PIE_GLOBAL fuera
      const activo = (r[1] || "SI").toUpperCase() === "SI";
      if (!activo) continue;
      out.push(fase);
    }
    return out;
  }

  // Borra una fila concreta de mail_historico.
  // Identifica la fila por: fecha + ccpp_id + direccion + fase + asunto + tipo.
  // Devuelve true si borró exactamente una.
  async function borrarMailHistoricoFila(criterios) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
    });
    const rows = r.data.values || [];
    const idx = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const eqFecha = String(row[0] || "") === String(criterios.fecha || "");
      const eqId    = String(row[1] || "") === String(criterios.ccpp_id || "");
      const eqDir   = String(row[2] || "") === String(criterios.direccion || "");
      const eqFase  = String(row[3] || "") === String(criterios.fase || "");
      const eqAsun  = String(row[5] || "") === String(criterios.asunto || "");
      const eqTipo  = String(row[8] || "") === String(criterios.tipo || "");
      if (eqFecha && eqId && eqDir && eqFase && eqAsun && eqTipo) {
        idx.push(i); // 0-based en rows; en Sheet es i+1
      }
    }
    if (idx.length !== 1) {
      throw new Error(`No se pudo identificar fila única (matches=${idx.length})`);
    }
    const fila = idx[0] + 1; // 1-based para Sheets API
    // Necesitamos sheetId numérico para batchUpdate
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const hoja = meta.data.sheets.find(s => s.properties.title === "mail_historico");
    if (!hoja) throw new Error("Pestaña mail_historico no encontrada");
    const sheetId = hoja.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: fila - 1, // 0-based, inclusive
              endIndex: fila,        // 0-based, exclusive
            },
          },
        }],
      },
    });
    return true;
  }

  // v17.29: lee TODO mail_historico (sin filtrar por CCPP) para construir
  // índices globales como el de F1 (calcular badge "👎 Retrasado").
  async function leerMailHistoricoCompleto() {
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      console.error("[presupuestos] No se pudo leer mail_historico (completo):", e.message);
      return [];
    }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      out.push({
        fecha: r[0] || "",
        ccpp_id: r[1] || "",
        direccion: r[2] || "",
        fase: r[3] || "",
        destinatario: r[4] || "",
        asunto: r[5] || "",
        mensaje: r[6] || "",
        adjuntos: r[7] || "",
        tipo: r[8] || "",
        message_id: r[9] || "",
      });
    }
    return out;
  }

  function parsearMailJson(s) {
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  }

  // ----------- Helpers para variables {{DOC_CCPP}}, {{DOC_PISOS}}, {{PCT_PISOS}} -----------
  // Leen documentos_manuales + pisos del Sheet, replican la regla calcularResumenManual
  // de documentacion.cjs y devuelven los textos de las variables del mail.

  // Lee la pestaña documentos_manuales y devuelve solo los activos, separados por nivel.
  async function _leerDocsManuales() {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_DOCS_MANUALES });
    const rows = r.data.values || [];
    const docsCcpp = [];
    const docsPiso = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f || !f[0]) continue;
      if (String(f[5] || "").trim().toUpperCase() !== "SI") continue;
      const codigo = String(f[0]).trim();
      const nivel  = String(f[1] || "").trim().toUpperCase();
      const label  = String(f[2] || "").trim();
      const orden  = parseFloat(f[3]) || 999;
      if (nivel === "CCPP") docsCcpp.push({ codigo, label, orden });
      else if (nivel === "PISO") docsPiso.push({ codigo, label, orden });
    }
    docsCcpp.sort((a, b) => a.orden - b.orden);
    docsPiso.sort((a, b) => a.orden - b.orden);
    return { docsCcpp, docsPiso };
  }

  // Lee los pisos de una CCPP concreta. Devuelve [{vivienda, estados:[]}] alineado con docsPiso.
  async function _leerPisosDeCcpp(direccionComunidad, docsPiso) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return [];
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    const idxNom = hdr.indexOf("nombre");
    const idxTlf = hdr.indexOf("telefono");
    // v17.52: columnas nuevas para reloj y notas por piso. -1 si no existen.
    const idxEnHoy = hdr.indexOf("en_hoy");
    const idxNotasP = hdr.indexOf("notas_piso");
    // Mapeo doc.codigo (ej "piso_toma_datos") → columna est_piso_toma_datos
    const colByCod = {};
    for (const d of docsPiso) {
      const colName = "est_" + d.codigo;
      const ci = hdr.indexOf(colName);
      if (ci >= 0) colByCod[d.codigo] = ci;
    }
    function norm(s) {
      return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    const objetivo = norm(direccionComunidad);
    const pisos = [];
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) !== objetivo) continue;
      const estados = docsPiso.map(d => {
        const ci = colByCod[d.codigo];
        return ci !== undefined ? String(f[ci] || "").trim() : "";
      });
      pisos.push({
        vivienda: String(f[idxViv] || "").trim(),
        nombre: idxNom >= 0 ? String(f[idxNom] || "").trim() : "",
        telefono: idxTlf >= 0 ? String(f[idxTlf] || "").trim() : "",
        en_hoy: idxEnHoy >= 0 ? String(f[idxEnHoy] || "").trim() : "",
        notas_piso: idxNotasP >= 0 ? String(f[idxNotasP] || "").trim() : "",
        estados,
        _rowIndex: i + 1, // 1-based para Sheets
        comunidad: String(f[idxCom] || "").trim(),
      });
    }
    return pisos;
  }

  // v17.52: actualiza una sola celda de la pestaña `pisos` para un piso concreto.
  // Se usa desde los endpoints de toggle reloj-hoy y guardar notas_piso. Solo
  // permite escribir las columnas neutrales en_hoy y notas_piso para no
  // invadir las que controla documentacion.cjs (Alberto).
  async function _actualizarCampoPiso(rowIndex, campo, valor) {
    // v17.67: añadido nota_simple (columna D de pisos).
    const CAMPOS_PERMITIDOS = new Set(["en_hoy", "notas_piso", "nota_simple"]);
    if (!CAMPOS_PERMITIDOS.has(campo)) {
      throw new Error("Campo no permitido en pisos: " + campo);
    }
    const sheets = getSheetsClient();
    // Necesitamos la letra de columna real leyendo la cabecera (en_hoy y
    // notas_piso son columnas nuevas, no sabemos su letra sin leer).
    const cab = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: "pisos!1:1",
    });
    const hdr = (cab.data.values && cab.data.values[0]) || [];
    const idx = hdr.indexOf(campo);
    if (idx < 0) throw new Error(`Columna '${campo}' no encontrada en pestaña pisos (¿la has añadido al Sheet?)`);
    // Convertir índice 0-based a letra de columna A..AZ..
    const letra = (() => {
      let s = "", n = idx + 1;
      while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
      return s;
    })();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `pisos!${letra}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[valor]] },
    });

    // v17.77 — RELEÍDO DE VERIFICACIÓN (mismo protocolo que actualizarCampoComunidad).
    // Releemos esa celda y comparamos con lo que se quiso guardar. Si no coincide,
    // lanzamos error: el endpoint lo convierte en respuesta de fallo y el front
    // pinta el campo en ROJO. Los campos de piso (en_hoy, notas_piso, nota_simple)
    // son de texto, así que comparamos como texto (trim). Así el verde de estos
    // campos también significa "está de verdad en el Sheet".
    const rel = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `pisos!${letra}${rowIndex}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const leido = (rel.data.values && rel.data.values[0] && rel.data.values[0][0] != null)
      ? rel.data.values[0][0] : "";
    if (String(valor == null ? "" : valor).trim() !== String(leido).trim()) {
      console.error(`[_actualizarCampoPiso] VERIFICACIÓN FALLIDA ${campo} (fila ${rowIndex}): se quiso "${valor}" pero el Sheet tiene "${leido}"`);
      throw new Error(`El campo "${campo}" del piso no quedó guardado en el Sheet (se intentó "${valor}", quedó "${leido}").`);
    }
  }

  // v17.52: dada una direccion de comunidad y una vivienda, devuelve el
  // _rowIndex del piso en la pestaña `pisos`, o null si no existe.
  async function _buscarRowIndexPiso(direccionComunidad, vivienda) {
    const sheets = getSheetsClient();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
    const rows = r.data.values || [];
    if (rows.length < 2) return null;
    const hdr = rows[0];
    const idxCom = hdr.indexOf("comunidad");
    const idxViv = hdr.indexOf("vivienda");
    function norm(s) {
      return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    const objetivoCom = norm(direccionComunidad);
    const objetivoViv = norm(vivienda);
    for (let i = 1; i < rows.length; i++) {
      const f = rows[i];
      if (!f) continue;
      if (norm(f[idxCom]) === objetivoCom && norm(f[idxViv]) === objetivoViv) {
        return i + 1; // 1-based
      }
    }
    return null;
  }

  // Replica calcularResumenManual de documentacion.cjs:
  //   OP, NP, vacío  → no cuentan
  //   F              → cuenta en total (pendiente)
  //   OK/6/12/18/FFCC/IPREM → cuenta en total y en hechos
  function _resumenManual(estados) {
    let hechos = 0, totalRel = 0;
    for (const raw of estados) {
      const e = (raw || "").trim();
      if (e === "OP" || e === "NP" || e === "") continue;
      totalRel++;
      if (e === "OK" || e === "6" || e === "12" || e === "18" || e === "FFCC" || e === "IPREM") hechos++;
    }
    return { hechos, totalRel };
  }

  // Devuelve { lista_doc_ccpp, lista_doc_pisos, pct_pisos } para una CCPP.
  // Los textos siguen el formato pedido por el usuario:
  //   - DOC_CCPP: "- Falta: Etiqueta\n- Falta: Etiqueta" o "COMPLETA"
  //   - DOC_PISOS: "Faltan 0A, 1B, 2C" o "COMPLETA"
  //   - PCT_PISOS: porcentaje redondeado de pisos completos
  async function calcularResumenDocumentacion(comu) {
    try {
      const { docsCcpp, docsPiso } = await _leerDocsManuales();
      // Estados CCPP: leer las columnas est_ccpp_* de la propia comu
      const estadosCcpp = docsCcpp.map(d => String(comu["est_" + d.codigo] || "").trim());
      const faltanCcpp = [];
      for (let i = 0; i < docsCcpp.length; i++) {
        if (estadosCcpp[i] === "F") faltanCcpp.push(docsCcpp[i].label);
      }
      const lista_doc_ccpp = faltanCcpp.length === 0
        ? "COMPLETA"
        : faltanCcpp.map(l => "- Falta: " + l).join("\n");

      // Pisos
      const direccion = comu.direccion || comu.comunidad || "";
      const pisos = await _leerPisosDeCcpp(direccion, docsPiso);
      let completos = 0;
      const faltanPisos = [];
      for (const p of pisos) {
        const r = _resumenManual(p.estados);
        const ok = r.totalRel > 0 && r.hechos >= r.totalRel;
        if (ok) completos++;
        else faltanPisos.push(p.vivienda || "?");
      }
      const lista_doc_pisos = faltanPisos.length === 0 && pisos.length > 0
        ? "COMPLETA"
        : (pisos.length === 0 ? "COMPLETA" : "Faltan " + faltanPisos.join(", "));
      const pct_pisos = pisos.length > 0
        ? Math.round((completos / pisos.length) * 100) + "%"
        : "0%";
      return { lista_doc_ccpp, lista_doc_pisos, pct_pisos };
    } catch (e) {
      console.warn("[presupuestos] calcularResumenDocumentacion falló:", e.message);
      return { lista_doc_ccpp: "(no disponible)", lista_doc_pisos: "(no disponible)", pct_pisos: "—" };
    }
  }

  // Devuelve la fecha de envío del último mail de la fase 05_ACEPTACION_PTO
  // para esta CCPP, leyendo de mails_ultimo_envio (col AJ). Formato DD/MM/AAAA.
  function _fechaAceptacionPto(comu) {
    try {
      const ult = comu.mails_ultimo_envio ? JSON.parse(comu.mails_ultimo_envio) : {};
      const f = ult["05_ACEPTACION_PTO"] || comu.fecha_decision_pto || "";
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    } catch { return comu.fecha_decision_pto || ""; }
  }

  // Devuelve la fecha de paso a fase 08_CYCP (envío de contratos y pagos
  // a la CCPP). Equivalente a _fechaAceptacionPto pero para el mail
  // 08_INICIO_CYCP. Lee de mails_ultimo_envio["08_INICIO_CYCP"] como
  // referencia primaria, con fallback a fecha_envio_contratos_pagos.
  // Formato DD/MM/AAAA.
  function _fechaInicioCycp(comu) {
    try {
      const ult = comu.mails_ultimo_envio ? JSON.parse(comu.mails_ultimo_envio) : {};
      const f = ult["08_INICIO_CYCP"] || comu.fecha_envio_contratos_pagos || "";
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    } catch { return comu.fecha_envio_contratos_pagos || ""; }
  }

  // Versión async de sustituirVariables: acepta las mismas que la síncrona
  // y además resuelve {{DOC_CCPP}}, {{DOC_PISOS}}, {{PCT_PISOS}} y
  // {{fecha_aceptacion_pto}} consultando el Sheet. Solo se usa para plantillas
  // que necesiten estas variables (como 05_SEGUIMIENTO_DOC).
  async function sustituirVariablesAsync(texto, comu) {
    let t = sustituirVariables(texto, comu);
    if (!t) return "";
    const necesitaResumen = /\{\{(DOC_CCPP|DOC_PISOS|PCT_PISOS)\}\}/.test(t);
    if (necesitaResumen) {
      const r = await calcularResumenDocumentacion(comu);
      t = t
        .replace(/\{\{DOC_CCPP\}\}/g, r.lista_doc_ccpp)
        .replace(/\{\{DOC_PISOS\}\}/g, r.lista_doc_pisos)
        .replace(/\{\{PCT_PISOS\}\}/g, r.pct_pisos);
    }
    if (/\{\{fecha_aceptacion_pto\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_aceptacion_pto\}\}/g, _fechaAceptacionPto(comu));
    }
    if (/\{\{fecha_inicio_cycp\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_inicio_cycp\}\}/g, _fechaInicioCycp(comu));
    }
    return t;
  }

  function sustituirVariables(texto, comu) {
    if (!texto) return "";
    return String(texto)
      .replace(/\{\{direccion\}\}/g, comu.direccion || "")
      .replace(/\{\{comunidad\}\}/g, comu.comunidad || "")
      .replace(/\{\{administrador\}\}/g, comu.administrador || "")
      .replace(/\{\{presidente\}\}/g, comu.presidente || "")
      .replace(/\{\{tipo_via\}\}/g, comu.tipo_via || "")
      .replace(/\{\{pto_total\}\}/g, comu.pto_total || "")
      // {{fecha_limite_doc_vecinos}} → fecha guardada en col BC.
      // Se rellena al enviar el mail de fase 05_ACEPTACION_PTO (hoy + 20 días).
      // En el Sheet está en formato YYYY-MM-DD; aquí la convertimos a DD/MM/AAAA y, si
      // la fecha ya pasó, añadimos el aviso "(la cual cumplió hace N días)" / "(que es hoy)".
      .replace(/\{\{fecha_limite_doc_vecinos\}\}/g, () => {
        const f = comu.fecha_limite_documentacion_vecinos || "";
        const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return f;
        const fechaStr = `${m[3]}/${m[2]}/${m[1]}`;
        // Calcular días desde la fecha límite hasta hoy (a medianoche para evitar deriva por horas)
        const fLim = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
        fLim.setHours(0, 0, 0, 0);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - fLim) / 86400000);
        if (dias === 0) return `${fechaStr} (que es hoy)`;
        if (dias > 0)   return `${fechaStr} (la cual cumplió hace ${dias} día${dias === 1 ? '' : 's'})`;
        return fechaStr; // futura: sin coletilla
      })
      // {{FECHA+N}} → fecha de hoy + N días en formato DD/MM/AAAA. Útil para
      // marcar plazos relativos en plantillas (ej: "fecha límite {{FECHA+20}}").
      // N puede ser positivo o negativo (FECHA-5 → hace 5 días).
      .replace(/\{\{FECHA([+-]\d+)\}\}/g, (_m, dias) => {
        const f = new Date();
        f.setDate(f.getDate() + parseInt(dias, 10));
        const dd = String(f.getDate()).padStart(2, '0');
        const mm = String(f.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${f.getFullYear()}`;
      })
      // {{FECHA}} → fecha de hoy en DD/MM/AAAA
      .replace(/\{\{FECHA\}\}/g, () => {
        const f = new Date();
        const dd = String(f.getDate()).padStart(2, '0');
        const mm = String(f.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${f.getFullYear()}`;
      });
  }

  // =================================================================
  // (BLOQUE ELIMINADO) — La capa de acceso a vecinos_base/expedientes
  // y la lógica de emparejado vecino↔CCPP se traslada a documentacion.cjs.
  // Presupuestos ya no lee/muestra vecinos.
  // =================================================================

  // =================================================================
  // LÓGICA DE NEGOCIO — disparadores, transiciones, línea de tiempo
  // =================================================================
  function calcularDisparador(comu) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    if (!def || !def.plantilla) return null;
    let baseFecha = null;
    let dias = def.cadenciaDias || 30;
    if (fase === "04_ACEPTACION_PTO") {
      baseFecha = comu.fecha_ultimo_seguimiento_pto || comu.fecha_envio_pto;
      if (!baseFecha) return null;
      if (!comu.fecha_ultimo_seguimiento_pto) dias = def.cadenciaInicialDias || 3;
    } else if (fase === "01_CONTACTO") {
      baseFecha = comu.fecha_contacto;
      if (!baseFecha) return null;
    } else { return null; }
    const desde = new Date(baseFecha.length > 10 ? baseFecha : baseFecha + "T00:00:00");
    if (isNaN(desde)) return null;
    const vence = new Date(desde); vence.setDate(vence.getDate() + dias);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const dRest = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
    let urg = "lejano";
    if (dRest <= 0) urg = "vencido";
    else if (dRest <= 3) urg = "proximo";
    return { vence: vence.toISOString().slice(0,10), diasRestantes: dRest, urgencia: urg };
  }

  // Calcula el estado de plazo de un expediente para mostrar el badge
  // 👍 En plazo / ⚠️ Decidir / 👎 Retrasado (X días).
  //
  // Se basa en calcularInfoEnvioAuto() para mantener una única fuente de verdad
  // sobre cuándo toca el próximo reenvío. Aplica a las 4 fases con reenvíos:
  // 01, 04, 05 y 08.
  //
  // Reglas:
  //   - info.estado "no_iniciado"  → null (no marcamos hasta el primer envío)
  //   - info.estado "completado"   → "decidir" (reenvíos automáticos agotados)
  //   - info.estado "en_curso":
  //       hoy < fecha_próximo_reenvío                         → "en_plazo"
  //       hoy ≥ fecha_próximo_reenvío:
  //         si hay fecha_proximo_mail_manual rellena         → "retrasado" (pactó día y no envió)
  //         si no                                             → "decidir" (toca enviar siguiente reenvío)
  //   - info.estado "desactivado"  → null
  //   - resto                       → null
  //
  // diasRetraso = hoy - fecha_próximo_reenvío (solo en "retrasado").
  //
  // Parámetros:
  //   - comu: el expediente
  //   - plantilla: la plantilla de su fase (ya cargada en el cache local del handler)
  //
  // Devuelve null o { estado, fechaAviso, diasRetraso }.
  // v17.30: índice F1 (fecha del último reenvío automático del PRIMER ciclo
  // por CCPP+fase). Se calcula recorriendo los CCPPs y mirando sus CONTADORES
  // (numAutomaticos del JSON mails_enviados/mails_manuales) — NO el histórico —
  // para decidir si están ampliados. El histórico solo se usa para localizar
  // la fecha F1 del envío automático nº mx-ésimo. Si la desincronización
  // entre historico y contadores impide localizarlo, fallback a
  // mails_ultimo_envio (aproximación: la fecha del último envío).
  //
  // Estructura: { "ccpp_id__fase": "2026-04-15T..." }
  //
  // comus: array de comunidades ya leídas (con ccpp_id, fase_presupuesto,
  //   mails_enviados, mails_manuales, mails_ultimo_envio).
  // historicoCompleto: array de mail_historico (con ccpp_id, fase, tipo, fecha).
  // plantillas: mapa fase -> objeto plantilla (al menos max_envios).
  function _indexarF1PorCcppFase(comus, historicoCompleto, plantillas) {
    if (!Array.isArray(comus) || comus.length === 0) return {};

    // 1) Para cada CCPP, determinar si está ampliado en su fase actual.
    //    v17.33: AMPLIADO es:
    //      (a) numAutomaticos > mx (el cron ya disparó nuevo ciclo)
    //      O
    //      (b) numAutomaticos >= mx Y hay fecha_proximo_mail_manual rellena
    //          (ya he decidido reactivar, aún sin disparar)
    const ampliadosKeys = []; // array de { ccpp_id, fase, mx, ultimoEnvio, casoB }
    for (const c of comus) {
      if (!c || !c.ccpp_id) continue;
      const fase = normalizarFase(c.fase_presupuesto);
      const pl = plantillas[fase];
      if (!pl) continue;
      const mx = parseInt(pl.max_envios) || 0;
      if (mx <= 0) continue;
      let enviados = {}, manuales = {};
      try { enviados = JSON.parse(c.mails_enviados || "{}"); } catch (_) { enviados = {}; }
      try { manuales = JSON.parse(c.mails_manuales || "{}"); } catch (_) { manuales = {}; }
      const totalEnvios = parseInt(enviados[fase]) || 0;
      let numManuales;
      if (manuales[fase] !== undefined) {
        numManuales = parseInt(manuales[fase]) || 0;
      } else {
        numManuales = totalEnvios >= 1 ? 1 : 0;
      }
      const numAutomaticos = Math.max(0, totalEnvios - numManuales);
      const hayFechaManual = !!(c.fecha_proximo_mail_manual || "").trim();
      // Caso A: cron ya disparó nuevo ciclo
      const casoA = numAutomaticos > mx;
      // Caso B: justo agotado pero ya hay decisión de ampliar
      const casoB = numAutomaticos === mx && hayFechaManual;
      if (casoA || casoB) {
        let ultimoEnvio = null;
        try {
          const ultJson = JSON.parse(c.mails_ultimo_envio || "{}");
          if (ultJson[fase]) ultimoEnvio = ultJson[fase];
        } catch (_) {}
        ampliadosKeys.push({ ccpp_id: c.ccpp_id, fase, mx, ultimoEnvio, casoB });
      }
    }
    if (ampliadosKeys.length === 0) return {};

    // 2) Para cada ampliado, obtener F1.
    //    - Caso B (numAuto == mx + fecha manual): mails_ultimo_envio[fase] ES
    //      el último auto del primer ciclo. Usar directo.
    //    - Caso A (numAuto > mx): buscar en histórico el envío automático nº mx
    //      filtrado por ccpp+fase, ordenado asc. Fallback a mails_ultimo_envio
    //      si el histórico está desincronizado.
    const out = {};
    for (const a of ampliadosKeys) {
      const k = a.ccpp_id + "__" + a.fase;
      if (a.casoB) {
        if (a.ultimoEnvio) out[k] = a.ultimoEnvio;
        continue;
      }
      // Caso A
      const candidatos = (historicoCompleto || [])
        .filter(m =>
          m && String(m.tipo || "").toLowerCase() === "automatico" &&
          m.ccpp_id === a.ccpp_id &&
          m.fase === a.fase
        )
        .slice()
        .sort((x, y) => {
          const tx = Date.parse(x.fecha), ty = Date.parse(y.fecha);
          return (isNaN(tx) ? Infinity : tx) - (isNaN(ty) ? Infinity : ty);
        });
      if (candidatos.length >= a.mx) {
        out[k] = candidatos[a.mx - 1].fecha;
      } else if (a.ultimoEnvio) {
        out[k] = a.ultimoEnvio;
      }
    }
    return out;
  }

  function calcularEstadoPlazo(comu, plantilla, f1Map) {
    // v17.50 — LÓGICA basada en ESTADO DEL CRON + fecha límite.
    //
    // Definida con Guille tras descartar v17.49 (que solo miraba hoy vs fLim
    // y daba rojo a CCPPs con cron parado, lo cual era incorrecto: si el
    // cron está parado, hay que DECIDIR, no señalar retraso).
    //
    // El cron tiene 3 estados:
    //   - ACTIVO: ciclo en curso, hay envíos automáticos por hacer.
    //   - DORMIDO: ciclo agotado PERO hay fecha_proximo_mail_manual rellena
    //              (despertará en esa fecha y mandará el mail, reiniciando ciclo).
    //   - PARADO: ciclo agotado y NO hay fecha manual → espera decisión humana.
    //
    // Reglas del badge:
    //
    //   🟡 Ámbar "Decidir"  → cron PARADO (independientemente de fLim).
    //                          La decisión es humana: el sistema ya hizo lo
    //                          que podía hacer automáticamente.
    //
    //   🟢 Verde "En plazo" → cron ACTIVO o DORMIDO y hoy < fLim.
    //                          (Aún no ha llegado la fecha prometida al cliente).
    //
    //   🔴 Rojo "Retrasado (N días)" → cron ACTIVO o DORMIDO y hoy >= fLim.
    //                                   N = días desde fLim hasta hoy.
    //                                   (Cliente ya en retraso, pero el sistema
    //                                   sigue trabajando: o reenviando, o
    //                                   esperando una fecha manual futura).
    //
    // Sin badge (null):
    //   - Sin plantilla / plantilla desactivada / sin automatización configurada.
    //   - totalEnvios == 0 (no iniciado: aún no hay mail inicial, no hay
    //     compromiso con el cliente todavía).
    //   - fLim vacía Y sin último envío para fallback al vuelo.
    //
    // Cálculo de fLim:
    //   - Lectura directa de comu.fecha_limite_documentacion_vecinos (BC).
    //   - Fallback si BC vacía: mails_ultimo_envio[fase] + di + dr × mx.
    //     Cubre a CCPPs antiguos sin migrar.
    //
    // El parámetro f1Map se conserva en la firma por compatibilidad con
    // las llamadas existentes (listado, HOY, ficha), pero ya no se usa.
    if (!plantilla) return null;
    if (!plantilla.activo) return null;
    const mx = parseInt(plantilla.max_envios) || 0;
    const dr = parseInt(plantilla.dias_recurrente) || 0;
    const di = parseInt(plantilla.dias_primer_envio) || 0;
    if (mx <= 0 && dr <= 0) return null;

    const fase = normalizarFase(comu.fase_presupuesto);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    // Verificar que hay actividad (totalEnvios > 0)
    let enviados;
    try { enviados = JSON.parse(comu.mails_enviados || "{}"); } catch (_) { enviados = {}; }
    const totalEnvios = parseInt(enviados[fase]) || 0;
    if (totalEnvios === 0) return null;

    // Detectar estado del cron usando calcularInfoEnvioAuto (única fuente de
    // verdad sobre el ciclo del cron, ya en uso en la ficha y el HOY).
    // info.estado puede ser: "no_iniciado", "desactivado", "sin_plantilla",
    //                        "en_curso" (activo o dormido) o "completado" (parado).
    const info = calcularInfoEnvioAuto(comu, fase, plantilla);
    if (info.estado === "no_iniciado" || info.estado === "desactivado" || info.estado === "sin_plantilla") {
      return null;
    }

    // 🟡 Cron PARADO → Decidir. Hay que ampliar manualmente.
    if (info.estado === "completado") {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }

    // info.estado === "en_curso": cron activo o dormido. Decidir entre verde
    // y rojo según fLim.

    // Leer fecha límite. Si está vacía, calcular al vuelo desde mails_ultimo_envio
    // + di + dr × mx (compat con CCPPs antiguos sin BC migrada).
    let fechaLimiteIso = (comu.fecha_limite_documentacion_vecinos || "").trim();
    if (!fechaLimiteIso) {
      let ultimo;
      try { ultimo = JSON.parse(comu.mails_ultimo_envio || "{}"); } catch (_) { ultimo = {}; }
      const fechaUlt = ultimo[fase];
      if (!fechaUlt) return null;
      const tUlt = Date.parse(fechaUlt);
      if (isNaN(tUlt)) return null;
      const fu = new Date(tUlt); fu.setHours(0, 0, 0, 0);
      const sumDias = di + dr * mx;
      fu.setDate(fu.getDate() + sumDias);
      fechaLimiteIso = fu.toISOString().slice(0, 10);
    }

    const tLim = Date.parse(fechaLimiteIso);
    if (isNaN(tLim)) return null;
    const fLim = new Date(tLim); fLim.setHours(0, 0, 0, 0);

    if (hoy < fLim) {
      return { estado: "en_plazo", fechaAviso: fechaLimiteIso.slice(0, 10), diasRetraso: 0 };
    }
    // hoy >= fLim → 🔴 Retrasado con N días desde fLim
    const diasRetraso = Math.round((hoy - fLim) / 86400000);
    return { estado: "retrasado", fechaAviso: fechaLimiteIso.slice(0, 10), diasRetraso };
  }

  // Helper: devuelve {estado:"retrasado", diasRetraso:N} desde F1 hasta hoy.
  // Si F1 falta o no parsea, fallback a "decidir" (no rompe nada).
  function _retrasadoConF1(f1Iso, hoy) {
    if (!f1Iso) {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }
    const tF1 = Date.parse(f1Iso);
    if (isNaN(tF1)) {
      return { estado: "decidir", fechaAviso: hoy.toISOString().slice(0, 10), diasRetraso: 0 };
    }
    const fF1 = new Date(tF1); fF1.setHours(0, 0, 0, 0);
    const diasRetraso = Math.max(0, Math.round((hoy - fF1) / 86400000));
    return { estado: "retrasado", fechaAviso: f1Iso.slice(0, 10), diasRetraso };
  }

  // Devuelve el HTML del badge correspondiente al estado de plazo.
  // estadoPlazo = { estado, fechaAviso, diasRetraso } o null.
  function renderBadgePlazo(estadoPlazo) {
    if (!estadoPlazo) return "";
    if (estadoPlazo.estado === "en_plazo") {
      return `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="En plazo">👍 En plazo</span>`;
    }
    if (estadoPlazo.estado === "decidir") {
      return `<span class="ptl-fila-badge ptl-fila-badge-decidir" title="Plazo cumplido — pendiente de decidir">⚠️ Decidir</span>`;
    }
    if (estadoPlazo.estado === "retrasado") {
      const d = estadoPlazo.diasRetraso || 0;
      return `<span class="ptl-fila-badge ptl-fila-badge-retrasado" title="Plazo ampliado — retraso acumulado">👎 Retrasado (${d} día${d === 1 ? '' : 's'})</span>`;
    }
    return "";
  }

  function calcularLineaTiempo(comu) {
    const fase = normalizarFase(comu.fase_presupuesto);
    // Las 7 fases activas del ciclo completo (presupuestos + documentación).
    // Presupuestos solo gestiona 01-04 y ZZ; las fases 05-07 son del módulo
    // documentacion.cjs, pero el timeline las pinta para que el usuario vea
    // siempre el mapa completo del expediente.
    const ORDEN = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const idx = ORDEN.indexOf(fase);
    return [
      { proceso: "Presupuesto",   nombre: "01-Contacto",          faseId: "01_CONTACTO",        estado: estadoHito("01_CONTACTO",        fase, idx) },
      { proceso: "Presupuesto",   nombre: "02-Visita",            faseId: "02_VISITA",          estado: estadoHito("02_VISITA",          fase, idx) },
      { proceso: "Presupuesto",   nombre: "03-Envío PTO",         faseId: "03_ENVIO_PTO",           estado: estadoHito("03_ENVIO_PTO",           fase, idx) },
      { proceso: "Presupuesto",   nombre: "04-Aceptación PTO",   faseId: "04_ACEPTACION_PTO",     estado: estadoHito("04_ACEPTACION_PTO",     fase, idx) },
      { proceso: "Documentación", nombre: "05-Documentación",     faseId: "05_DOCUMENTACION",   estado: estadoHito("05_DOCUMENTACION",   fase, idx) },
      { proceso: "Documentación", nombre: "06-Visita EMASESA",    faseId: "06_VISITA_EMASESA",  estado: estadoHito("06_VISITA_EMASESA",  fase, idx) },
      { proceso: "Documentación", nombre: "07-PTE CYCP",          faseId: "07_PTE_CYCP", estado: estadoHito("07_PTE_CYCP", fase, idx) },
      { proceso: "Documentación", nombre: "08-CYCP",              faseId: "08_CYCP",     estado: estadoHito("08_CYCP",     fase, idx) },
    ];
    function estadoHito(hitoId, faseActual, idxFaseActual) {
      // Para rechazados: las 4 fases del proceso de presupuesto (01-04) se
      // marcan como COMPLETADAS (con sus fechas reales). Las fases de
      // documentación (05-08) ya no se pintan: el grupo "Documentación"
      // entero se sustituye por el cartel del motivo (ver lineaTiempoHtml).
      if (faseActual === "ZZ_RECHAZADO") {
        const FASES_PRESUPUESTO = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO"];
        if (FASES_PRESUPUESTO.includes(hitoId)) return "completo";
        return "rechazado";
      }
      // v17.23: 09_TRAMITADA = todos los hitos del ciclo completados (verde).
      if (faseActual === "09_TRAMITADA") return "completo";
      const ordenHito = ORDEN.indexOf(hitoId);
      if (ordenHito === -1) return "pendiente";
      if (ordenHito < idxFaseActual) return "completo";
      // Caso especial fase 08: si está en fase 08 y ya cerrada
      // (fecha_cycp_completa rellena), pintamos el círculo en verde aunque el
      // CCPP siga marcado como 08_CYCP (no hay fase posterior).
      if (hitoId === "08_CYCP" && faseActual === "08_CYCP" && comu.fecha_cycp_completa) return "completo";
      if (ordenHito === idxFaseActual) return "actual";
      return "pendiente";
    }
  }

  function fechaHito(comu, hitoId) {
    if (hitoId === "01_CONTACTO")     return comu.fecha_contacto;
    if (hitoId === "02_VISITA")       return comu.fecha_visita;
    if (hitoId === "03_ENVIO_PTO")        return comu.fecha_envio_pto;
    if (hitoId === "04_ACEPTACION_PTO")  return comu.fecha_aceptacion_pto;
    if (hitoId === "05_DOCUMENTACION") return comu.fecha_documentacion_completa;
    if (hitoId === "06_VISITA_EMASESA") return comu.fecha_visita_emasesa;
    // Decisión sesión 04/05/2026:
    //  - 07_PTE_CYCP -> fecha_envio_contratos_pagos: se rellena al pulsar
    //    el botón "paso a 08-CYCP" (con envío de mail tipo fase 03→04).
    //  - 08_CYCP -> fecha_cycp_completa: se rellena al pulsar el botón
    //    "cerrar fase 08" cuando todos los contratos están firmados.
    //    Mientras el CCPP esté en 08 sin haber cerrado, el círculo 08 sale vacío.
    if (hitoId === "07_PTE_CYCP") return comu.fecha_envio_contratos_pagos;
    if (hitoId === "08_CYCP")     return comu.fecha_cycp_completa;
    return "";
  }

  // Genera HTML de la línea de tiempo.
  // compacto=true: variante para listados (.ptl-fila), con etiquetas más cortas.
  function lineaTiempoHtml(comu, compacto = false) {
    const puntos = calcularLineaTiempo(comu);
    const grupos = {};
    puntos.forEach(p => { (grupos[p.proceso] ||= []).push(p); });
    function nombreMostrar(p) {
      if (compacto && p.faseId === "05_DOCUMENTACION") return "05-Doc";
      return p.nombre;
    }
    // Si la CCPP está rechazada, sustituimos el grupo "DOCUMENTACIÓN" (fases
    // 05-08) por un cartel con el motivo del rechazo en rojo. El grupo
    // "PRESUPUESTO" (01-04) se mantiene tal cual con sus fechas.
    const esRechazado = normalizarFase(comu.fase_presupuesto) === "ZZ_RECHAZADO";
    // Mapear el valor crudo del Sheet a texto formateado para mostrar en el listado.
    const MOTIVOS_FMT = {
      "POR PRECIO MÁS BAJO DE LA COMPETENCIA": "RECHAZADA: PRECIO MAS BAJO DE LA COMPETENCIA",
      "PORQUE NO SE VA A HACER DE MOMENTO":    "RECHAZADA: NO SE VA A HACER DE MOMENTO",
    };
    const motivoRaw = esRechazado ? String(comu.motivo_rechazo || "").trim() : "";
    let motivoRech;
    if (!motivoRaw) {
      motivoRech = "RECHAZADA (sin motivo)";
    } else if (MOTIVOS_FMT[motivoRaw]) {
      motivoRech = MOTIVOS_FMT[motivoRaw];
    } else if (motivoRaw.toUpperCase().startsWith("RECHAZADA")) {
      // Ya viene preformateado en el Sheet, no añadir prefijo
      motivoRech = motivoRaw;
    } else {
      motivoRech = "RECHAZADA: " + motivoRaw;
    }
    return `<div class="ptl-timeline">
      ${Object.entries(grupos).map(([procName, pts]) => {
        const esGrupoDoc = procName.toUpperCase().includes("DOCUMENTACI");
        if (esRechazado && esGrupoDoc) {
          // Para que el cartel ocupe EXACTAMENTE el mismo espacio que el
          // grupo "Documentación" en una fila no rechazada (4 puntos), lo
          // renderizamos como ese mismo grupo de 4 puntos pero invisibles
          // (visibility:hidden, NO display:none, así reservan tamaño), y
          // encima superponemos el cartel rojo con position:absolute.
          // Etiquetas reales para que la anchura coincida con las otras filas.
          const etiquetasDoc = compacto
            ? ["05-Doc", "06-Visita EMASESA", "07-PTE CYCP", "08-CYCP"]
            : ["05-Documentación", "06-Visita EMASESA", "07-PTE CYCP", "08-CYCP"];
          const puntosInvisibles = etiquetasDoc.map(lbl => `
            <div class="ptl-punto pendiente" style="visibility:hidden">
              <div class="ptl-circulo"></div>
              <div class="ptl-label">${esc(lbl)}</div>
              <div class="ptl-fecha">·</div>
            </div>`).join('');
          return `
            <div class="ptl-grupo" style="position:relative">
              <div class="ptl-grupo-titulo" style="visibility:hidden">${esc(procName)}</div>
              <div class="ptl-puntos">${puntosInvisibles}</div>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#DC2626;font-weight:700;font-size:9px;line-height:1.15;overflow:hidden;padding:0 6px;text-align:center" title="${esc(motivoRech)}">
                ${esc(motivoRech)}
              </div>
            </div>`;
        }
        const wStyleNorm = "";
        return `
          <div class="ptl-grupo" style="${wStyleNorm}">
            <div class="ptl-grupo-titulo">${esc(procName)}</div>
            <div class="ptl-puntos">
              ${pts.map(p => {
                const f = fechaHito(comu, p.faseId);
                const ff = fmtFecha(f);
                return `<div class="ptl-punto ${p.estado}" title="${esc(procName)} · ${esc(p.nombre)}${f ? ' · ' + ff : ''}">
                  <div class="ptl-circulo"></div>
                  <div class="ptl-label">${esc(nombreMostrar(p))}</div>
                  <div class="ptl-fecha">${f ? ff : '·'}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  }

  function badgeFase(faseId) {
    const fase = normalizarFase(faseId);
    const def = PTO_FASES[fase];
    if (!def) return `<span class="ptl-badge ptl-badge-gris">—</span>`;
    return `<span class="ptl-badge ptl-badge-${def.color}">${def.codigo}-${esc(def.nombre)}</span>`;
  }

  // =================================================================
  // LAYOUT HTML (CSS embebido, prefijo "ptl-" para no chocar con index.cjs)
  // =================================================================
  function pageHtml(titulo, breadcrumbs, content, token) {
    const bc = breadcrumbs && breadcrumbs.length > 1
      ? `<div class="ptl-breadcrumb">${breadcrumbs.map((b, i) => {
          if (i < breadcrumbs.length - 1)
            return `<a href="${esc(b.url)}">${esc(b.label)}</a><span class="ptl-sep">/</span>`;
          return `<span>${esc(b.label)}</span>`;
        }).join("")}</div>`
      : "";
    const homeUrl = urlT(token, "/presupuestos");
    return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(titulo)} · Araujo Presupuestos</title>
  <style>${getThemeCss()}${CSS}</style>
</head><body>
  <nav class="ptl-nav">
    <a href="${homeUrl}" class="ptl-nav-brand">
      <div class="ptl-logo">A</div>
      <div class="ptl-nav-text"><strong>Araujo Presupuestos</strong><span>CCPP · Individualización contadores</span></div>
    </a>
  </nav>
  <div class="ptl-page">
    ${bc}
    ${content}
  </div>
</body></html>`;
  }
  function sendHtml(res, html, status = 200) {
    res.status(status).set("Content-Type", "text/html; charset=utf-8").send(html);
  }
  function sendError(res, html, status = 500) {
    sendHtml(res, pageHtml("Error", [], `<div class="ptl-empty"><h3>${esc(html)}</h3></div>`), status);
  }

  // v17.69: TODAS las reglas CSS de la cinta de fase (que vivían aquí) se han
  // migrado a estilo-visual.cjs v1.13. Esta constante se mantiene vacía como
  // placeholder por si en el futuro hace falta añadir CSS específico que NO
  // sea reutilizable desde otros módulos. Si está vacía mucho tiempo, se podrá
  // borrar junto con su uso en pageHtml.
  const CSS = ``;

  // =================================================================
  // HELPER: información sobre los envíos automáticos de una fase
  // =================================================================
  // Devuelve un objeto con:
  //   - texto:     string que se pinta en la UI (ej: "📧 1+0/3 - próximo reenvío 12/05/2026")
  //   - estado:    "no_iniciado" | "en_curso" | "completado" | "desactivado" | "sin_plantilla"
  //   - completado: boolean (true cuando reenvíos automáticos >= max_envios)
  //
  // Formato del texto: "📧 X+Y/Z" donde:
  //   - X = envíos manuales hechos (incluye el inicial + cada "Reenviar revisado")
  //   - Y = reenvíos automáticos hechos (los que dispara el cron)
  //   - Z = max_envios (tope de reenvíos automáticos definido en la plantilla)
  //
  // Inputs:
  //   - comu:      ficha completa (lee mails_enviados, mails_manuales, mails_ultimo_envio,
  //                fecha_proximo_mail_manual, fecha_ultimo_seguimiento_pto)
  //   - fase:      código de fase (01_CONTACTO, 04_ACEPTACION_PTO, ...)
  //   - plantilla: objeto plantilla del Sheet (puede ser null si no existe).
  //                Debe traer al menos: activo, dias_recurrente, max_envios, dias_primer_envio.
  //
  // Reglas de estado:
  //   - Sin plantilla / sin automatización → estado "sin_plantilla", texto vacío.
  //   - Plantilla inactiva → estado "desactivado", texto "📧 reenvío desactivado".
  //   - X==0 e Y==0 → "📧 0+0/Z - reenvío no iniciado".
  //   - Y >= max_envios → "📧 X+Y/Z - reenvío completado".
  //   - En curso → "📧 X+Y/Z - próximo reenvío DD/MM/AAAA".
  //
  // CÁLCULO DE MANUALES Y AUTOMÁTICOS:
  //   - Total envíos = mails_enviados[fase]
  //   - Manuales     = mails_manuales[fase]  (si el campo no existe en datos
  //                    antiguos: se asume 1 si total >= 1, sino 0)
  //   - Automáticos  = total - manuales (mínimo 0)
  function calcularInfoEnvioAuto(comu, fase, plantilla) {
    if (!plantilla) {
      return { texto: "", estado: "sin_plantilla", completado: false };
    }
    const mx = parseInt(plantilla.max_envios) || 0;
    const dr = parseInt(plantilla.dias_recurrente) || 0;
    const di = parseInt(plantilla.dias_primer_envio) || 0;
    // Sin automatización configurada → no se pinta nada
    if (mx <= 0 && dr <= 0) {
      return { texto: "", estado: "sin_plantilla", completado: false };
    }
    if (!plantilla.activo) {
      return { texto: "📧 reenvío desactivado", estado: "desactivado", completado: false };
    }

    const enviados = (() => { try { return JSON.parse(comu.mails_enviados || "{}"); } catch { return {}; } })();
    const manuales = (() => { try { return JSON.parse(comu.mails_manuales || "{}"); } catch { return {}; } })();
    const ultimo   = (() => { try { return JSON.parse(comu.mails_ultimo_envio || "{}"); } catch { return {}; } })();
    const totalEnvios = enviados[fase] || 0;
    // Compat: si hay envíos pero no hay tracking de manuales (CCPP antiguo),
    // asumir que el primero fue manual.
    let numManuales;
    if (manuales[fase] !== undefined) {
      numManuales = parseInt(manuales[fase]) || 0;
    } else {
      numManuales = totalEnvios >= 1 ? 1 : 0;
    }
    const numAutomaticos = Math.max(0, totalEnvios - numManuales);
    const fechaUltimo = ultimo[fase] || null;
    const totalLabel = mx > 0 ? mx : "∞";
    const xy = `${numManuales}+${numAutomaticos}/${totalLabel}`;

    // No iniciado: ningún envío de ningún tipo
    if (numManuales === 0 && numAutomaticos === 0) {
      return {
        texto: `📧 ${xy} - reenvío no iniciado`,
        estado: "no_iniciado",
        completado: false,
      };
    }

    // Completado: reenvíos automáticos al tope del CICLO ACTUAL.
    // v17.29: el ciclo se reinicia con cada fecha manual ampliatoria.
    // Si numAutomaticos > 0 y es múltiplo exacto de mx → ciclo agotado.
    //   - Sin fecha manual nueva → estado "completado".
    //   - Con fecha manual nueva → estado "en_curso" (próximo = fecha manual).
    const cicloAgotado = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
    const hayFechaManualNueva = !!(comu.fecha_proximo_mail_manual || "").trim();
    if (cicloAgotado && !hayFechaManualNueva) {
      return {
        texto: `📧 ${xy} - reenvío completado`,
        estado: "completado",
        completado: true,
      };
    }

    // En curso: calcular fecha del próximo reenvío automático
    let fechaProx = null;
    const fechaManual = (comu.fecha_proximo_mail_manual || "").trim();
    if (fechaManual) {
      fechaProx = fechaManual;
    } else if (fechaUltimo && dr > 0) {
      // Si ya hay automáticos previos, la cadencia recurrente es 'dr' días desde
      // el último envío. Si no hay automáticos pero sí hay manual reciente, el
      // primer reenvío automático es a 'di' días (cadencia inicial) desde el
      // último envío manual.
      const fu = new Date(fechaUltimo);
      if (!isNaN(fu.getTime())) {
        const sumDias = numAutomaticos > 0 ? dr : (di > 0 ? di : dr);
        fu.setDate(fu.getDate() + sumDias);
        fechaProx = fu.toISOString().slice(0, 10);
      }
    } else if (!fechaUltimo && di > 0 && comu.fecha_ultimo_seguimiento_pto) {
      const fb = new Date(comu.fecha_ultimo_seguimiento_pto);
      if (!isNaN(fb.getTime())) {
        fb.setDate(fb.getDate() + di);
        fechaProx = fb.toISOString().slice(0, 10);
      }
    }
    const fechaProxFmt = fechaProx ? formatearFechaDDMMYYYY(fechaProx) : "pendiente";
    return {
      texto: `📧 ${xy} - próximo reenvío ${fechaProxFmt}`,
      estado: "en_curso",
      completado: false,
      fechaProxIso: fechaProx || null,
    };
  }

  // YYYY-MM-DD → DD-MM-AA (para mostrar). El nombre histórico se mantiene
  // por compatibilidad; el formato real es ahora DD-MM-AA (año 2 dígitos).
  function formatearFechaDDMMYYYY(fechaIso) {
    if (!fechaIso) return "";
    const m = String(fechaIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(fechaIso);
    return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
  }

  // Fases que tienen automatización de reenvíos (las que el cron procesa).
  // Se usa en el listado para sondear cuáles tienen "decidir pendiente" y en
  // la ficha para pintar el indicador de envíos automáticos. La fase 03 NO
  // está aquí: tiene plantilla, pero es un envío manual único (el presupuesto)
  // que avanza directamente a 04, no hay reenvíos automáticos en 03.
  const FASES_CON_REENVIOS = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"];

  // Mapeo fase → clave de plantilla y de contadores. Por defecto coinciden,
  // pero fase 05_DOCUMENTACION usa la plantilla 05_SEGUIMIENTO_DOC (los reenvíos
  // automáticos durante la espera de documentación de los vecinos).
  function plantillaDeFase(fase) {
    if (fase === "05_DOCUMENTACION") return "05_SEGUIMIENTO_DOC";
    if (fase === "08_CYCP") return "08_SEGUIMIENTO_CYCP";
    return fase;
  }

  // =================================================================
  // VISTA: LISTADO DE PRESUPUESTOS
  // =================================================================
  async function vistaListado(comunidades, query, token) {
    const filtroFase = query.fase || "";
    // v17.61 — Búsqueda insensible a mayúsculas Y acentos.
    // _normTexto aplica NFD + strip diacríticos para que "brujula" encuentre "Brújula".
    const _normTexto = s => String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const busqueda = _normTexto(query.q || "").trim();
    const orden = query.orden || "";

    // Cargar plantillas de las fases con reenvíos (en paralelo, una sola vez para
    // todo el listado) para detectar qué CCPPs tienen los reenvíos completados
    // y marcarlos visualmente con un badge "⚠ Decidir".
    const plantillasReenvios = {};
    try {
      const arr = await Promise.all(FASES_CON_REENVIOS.map(f => leerPlantillaMail(plantillaDeFase(f)).catch(() => null)));
      FASES_CON_REENVIOS.forEach((f, i) => { plantillasReenvios[f] = arr[i] || null; });
    } catch (e) { /* si falla, simplemente no se pintan los badges */ }

    const counts = { todos: 0, hoy: 0, activos: 0, en_tramite: 0 };
    ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP","09_TRAMITADA","ZZ_RECHAZADO","ZZ_DESCARTADO"].forEach(f => counts[f] = 0);
    // Activos = todo lo que sigue vivo en el negocio (presupuestos + documentación).
    //   Incluye 08_CYCP porque sigue siendo trabajo en curso (recepción de
    //   contratos firmados), PERO si la fase 08 está finalizada
    //   (fecha_cycp_completa rellena) ya no cuenta como activo.
    //   NO incluye 09_TRAMITADA (terminal de éxito), ZZ_RECHAZADO ni ZZ_DESCARTADO (terminales de fracaso).
    // En trámite = solo las fases del módulo documentación que siguen abiertas
    //   (05/06/07/08), con la misma exclusión: 08 finalizada no cuenta.
    const FASES_ACTIVAS = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO","05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const FASES_EN_TRAMITE = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    comunidades.forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      counts.todos++;
      if (counts[f] !== undefined) counts[f]++;
      // Una 08_CYCP con fecha_cycp_completa rellena se considera finalizada y
      // ya no cuenta como activo ni en trámite.
      const ochoFinalizada = (f === "08_CYCP" && !!c.fecha_cycp_completa);
      if (FASES_ACTIVAS.includes(f) && !ochoFinalizada) counts.activos++;
      if (FASES_EN_TRAMITE.includes(f) && !ochoFinalizada) counts.en_tramite++;
      const d = calcularDisparador(c);
      if (d && (d.urgencia === "vencido" || d.diasRestantes === 0)) counts.hoy++;
    });

    let lista = comunidades.slice();
    // v17.61/62 — filtroEfectivo se declara FUERA del if porque se usa más
    // abajo para resaltar la pestaña activa (líneas ~3124 y ~3286). En v17.61
    // se metió por error dentro del if y rompía el listado con ReferenceError.
    // Si hay búsqueda activa, IGNORAMOS el filtro de fase: la búsqueda
    // siempre opera sobre todo el Sheet. Sin búsqueda, se aplica el filtro normal
    // (Activos por defecto, o la fase clicada).
    const filtroEfectivo = filtroFase || "ACTIVOS";
    if (!busqueda) {
      if (filtroEfectivo === "HOY") {
        lista = lista.filter(c => {
          const d = calcularDisparador(c);
          return d && (d.urgencia === "vencido" || d.diasRestantes === 0);
        });
      } else if (filtroEfectivo === "ACTIVOS") {
        lista = lista.filter(c => {
          const f = normalizarFase(c.fase_presupuesto);
          if (!FASES_ACTIVAS.includes(f)) return false;
          // Excluir 08_CYCP finalizadas (con fecha_cycp_completa)
          if (f === "08_CYCP" && c.fecha_cycp_completa) return false;
          return true;
        });
      } else if (filtroEfectivo === "TRAMITE") {
        lista = lista.filter(c => {
          const f = normalizarFase(c.fase_presupuesto);
          if (!FASES_EN_TRAMITE.includes(f)) return false;
          if (f === "08_CYCP" && c.fecha_cycp_completa) return false;
          return true;
        });
      } else if (filtroEfectivo === "TODOS") {
        // sin filtro
      } else {
        lista = lista.filter(c => normalizarFase(c.fase_presupuesto) === filtroEfectivo);
      }
    }
    if (busqueda) {
      lista = lista.filter(c => {
        const hay = _normTexto(`${c.direccion} ${c.comunidad} ${c.administrador || ''} ${c.presidente || ''} ${c.telefono_administrador || ''} ${c.telefono_presidente || ''}`);
        return hay.includes(busqueda);
      });
    }

    const ordenEf = orden || "az";
    if (ordenEf === "az" || ordenEf === "za") {
      const dir = ordenEf === "az" ? 1 : -1;
      lista.sort((a, b) => {
        const dirA = String(a.direccion || a.comunidad || "");
        const dirB = String(b.direccion || b.comunidad || "");
        // 1º: comparar por calle (sin número/escalera)
        const calleA = extraerNombreCalle(dirA);
        const calleB = extraerNombreCalle(dirB);
        const cmpCalle = calleA.localeCompare(calleB, "es", { sensitivity: "base", numeric: true });
        if (cmpCalle !== 0) return dir * cmpCalle;
        // 2º: misma calle → tipo_via desempata
        const tvA = String(a.tipo_via || "");
        const tvB = String(b.tipo_via || "");
        const cmpTv = tvA.localeCompare(tvB, "es", { sensitivity: "base", numeric: true });
        if (cmpTv !== 0) return dir * cmpTv;
        // 3º: mismo tipo_via → ordenar por dirección completa (número, escalera...)
        return dir * dirA.localeCompare(dirB, "es", { sensitivity: "base", numeric: true });
      });
    } else if (ordenEf === "urg") {
      lista.sort((a, b) => {
        const da = calcularDisparador(a), db = calcularDisparador(b);
        return (da ? da.diasRestantes : 9999) - (db ? db.diasRestantes : 9999);
      });
    }

    // v17.64 — Cabecera unificada. Antes había ~140 líneas inline (buscador,
    // botón orden A-Z/Z-A/Urg, Plantillas mail, Ejecutar cron + script,
    // Ctrl+F5, HOY, Activos con aviso ⚠, En trámite, Tramitados, ZZ,
    // +Nuevo y fases 01-08). Todo eso ahora vive en renderCabeceraComun.
    // Le pasamos los opts necesarios para que se comporte como antes:
    //   - filtroActivo: la pestaña marcada como "on"
    //   - busqueda: para precargar el input
    //   - orden: para que el botón de orden gire al próximo estado
    //   - mostrarOrden: true (este es el único sitio donde el botón gira)
    //   - cuadra: para el aviso ⚠ en Activos si los contadores no cuadran
    const sumaProcesos = counts["01_CONTACTO"]+counts["02_VISITA"]+counts["03_ENVIO_PTO"]+counts["04_ACEPTACION_PTO"]+counts["05_DOCUMENTACION"]+counts["06_VISITA_EMASESA"]+counts["07_PTE_CYCP"]+counts["08_CYCP"]+counts["09_TRAMITADA"]+counts["ZZ_RECHAZADO"]+counts["ZZ_DESCARTADO"];
    const cuadra = sumaProcesos === counts.todos;

    const filas = lista.map(c => {
      // v17.23: badges 👍/⚠️/👎 quitados del listado.
      // v17.42: en el listado, las CCPP en fase 09_TRAMITADA que tengan
      // fecha_cobro rellena muestran un badge verde "💶 Cobrada DD-MM-AA".
      // v17.43: el slot del badge se renderiza SIEMPRE (vacío o con badge)
      // con min-width fijo para que todas las filas mantengan alineadas
      // sus líneas de fases.
      // v17.44: el slot del badge pasa de ir DESPUÉS del timeline a ir ANTES,
      // replicando la posición histórica de los badges 👍/⚠️/👎 (hasta v17.22).
      // Además se añade un spacer elástico (flex:1) tras .ptl-fila-info para
      // empujar el bloque [badge+timeline+importe] hacia la derecha, ya que
      // .ptl-fila .ptl-timeline pasa a flex:0 0 auto en estilo-visual v1.4
      // (deja de estirarse para ocupar su ancho natural).
      const faseFila = normalizarFase(c.fase_presupuesto);
      const fechaCobroFila = String(c.fecha_cobro || "").trim();
      let badgeCobroInner = "";
      if (faseFila === "09_TRAMITADA" && /^\d{4}-\d{2}-\d{2}/.test(fechaCobroFila)) {
        const fLab = formatearFechaDDMMYYYY(fechaCobroFila);
        badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="Obra cobrada">💶 Cobrada ${esc(fLab)}</span>`;
      }
      return `
      <a href="${urlT(token, "/presupuestos/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info">
          <span class="ptl-fila-tipo">${esc(c.tipo_via || '')}</span>
          <span class="ptl-fila-dir">${esc(c.direccion || c.comunidad || '—')}</span>
        </div>
        <div class="ptl-fila-badge-slot">${badgeCobroInner}</div>
        ${lineaTiempoHtml(c, true)}
        <span class="ptl-fila-importe">${fmtMoneda(c.pto_total)}</span>
      </a>
    `;
    }).join("");

    return `
      ${renderCabeceraComun(token, comunidades, {
        filtroActivo: filtroEfectivo,
        busqueda,
        orden: ordenEf,
        mostrarOrden: true,
        cuadra,
      })}
      <div>
        ${filas || `<div class="ptl-empty"><h3>Sin resultados</h3><p>No hay presupuestos que cumplan los filtros</p></div>`}
      </div>
    `;
  }

  // =================================================================
  // VISTA: FICHA DE EXPEDIENTE CCPP
  // =================================================================
  // opts (opcional):
  //   - extraHtmlFinal: HTML extra que se inserta al final de la ficha
  //     (lo usa documentacion.cjs para añadir la cajita de vecinos).
  async function vistaFicha(comu, datalists, token, reciencreado, opts) {
    const fase = normalizarFase(comu.fase_presupuesto);
    const def = PTO_FASES[fase];
    const disp = calcularDisparador(comu);
    const extraHtmlFinal = (opts && opts.extraHtmlFinal) || "";
    const extraHtmlInicial = (opts && opts.extraHtmlInicial) || "";
    const enFaseDoc = FASES_DOCUMENTACION.includes(fase);

    // Histórico de comunicaciones (mails) de esta CCPP — ascendente por fecha.
    // Si la lectura falla, seguimos con [] para no romper la ficha.
    let comuHistorico = [];
    try {
      comuHistorico = await leerMailHistoricoDeCcpp(comu.ccpp_id, comu.direccion);
    } catch (_) { comuHistorico = []; }
    // Set de message_id que están en HOY (para pintar el reloj encendido/apagado).
    let messageIdsEnHoy = new Set();
    try {
      messageIdsEnHoy = await leerMessageIdsEnHoy();
    } catch (_) { messageIdsEnHoy = new Set(); }
    let comuPlantillas = [];
    try {
      comuPlantillas = await leerListaPlantillas();
    } catch (_) { comuPlantillas = []; }
    // Pie de página global para responder/reenviar.
    let pieGlobal = "";
    try {
      const pieRow = await leerPlantillaMail("_PIE_GLOBAL");
      pieGlobal = pieRow ? (pieRow.mensaje || "") : "";
    } catch (_) { pieGlobal = ""; }

    // Plantilla de la fase actual (para el badge de estado de plazo en "Datos CCPP").
    // Solo se carga si la fase tiene reenvíos configurados. Si falla, badge no aparece.
    let plantillaFichaActual = null;
    try {
      const faseActual = normalizarFase(comu.fase_presupuesto);
      if (FASES_CON_REENVIOS.includes(faseActual)) {
        plantillaFichaActual = await leerPlantillaMail(plantillaDeFase(faseActual));
      }
    } catch (_) { plantillaFichaActual = null; }

    // v17.30: índice F1 para esta ficha. Pasamos solo este CCPP en el array
    // y el comuHistorico (que ya solo contiene mails de este CCPP). El
    // indexador detecta ampliación SOLO con los contadores del CCPP, no con
    // el conteo del histórico.
    let f1MapFicha = {};
    try {
      if (plantillaFichaActual) {
        const plMapFicha = {};
        plMapFicha[normalizarFase(comu.fase_presupuesto)] = plantillaFichaActual;
        f1MapFicha = _indexarF1PorCcppFase([comu], comuHistorico, plMapFicha);
      }
    } catch (_) { f1MapFicha = {}; }

    // Botón cuadradito ↶ "volver a fase anterior" (32x32). Solo se renderiza si
    // existe una fase anterior real (cualquier fase activa salvo 01 y los ZZ).
    // Las ramas que muestran cabecera de fase normal lo insertan a la izquierda
    // del icono "→" del título de la fase. Las ramas finales (ZZ) y 01_CONTACTO
    // lo dejan en "".
    // v17.69: eliminado el botón ⏰ HOY que iba apilado encima del ↶. El acceso
    // a HOY ya está en la pestaña ⏰ HOY de la cabecera unificada (v17.63).
    let btnRetrocederHtml = '';
    {
      const faseAnt = calcularFaseAnterior(fase);
      if (faseAnt) {
        const defAnt = PTO_FASES[faseAnt] || FASES_DOCUMENTACION_DEF[faseAnt];
        const labelAnt = defAnt ? `${defAnt.codigo}-${(defAnt.nombreLargo || defAnt.nombre || '').toUpperCase()}` : faseAnt;
        btnRetrocederHtml = `
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/retroceder")}" style="display:inline-flex;margin:0 8px 0 0;vertical-align:middle" id="ptlFormRetroceder_${esc(comu.ccpp_id)}">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <input type="hidden" name="conservar" value=""/>
            <button type="button"
              class="ptl-btn ptl-btn-sm"
              style="width:32px;height:32px;padding:0;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;background:var(--ptl-danger);color:#fff;border:1px solid var(--ptl-danger);font-weight:bold"
              title="Volver a ${esc(labelAnt)}"
              onclick="ptlRetroceder('${esc(comu.ccpp_id)}', '${esc(labelAnt)}')">↶</button>
          </form>`;
      }
    }

    let accionHtml = "";
    if (fase === "ZZ_RECHAZADO") {
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col" style="background:var(--ptl-gray-50);border-color:var(--ptl-gray-200)">
        <div class="ptl-na-left">
          <div class="ico">✕</div>
          <div class="text" style="color:var(--ptl-gray-700)">Expediente rechazado por el cliente</div>
        </div>
        <div class="ptl-na-right ptl-na-igual-altura">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a 01-CONTACTO con los contadores reseteados.')">↻ Reactivar expediente</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Pasar este expediente a ZZ-DESCARTADOS?')">→ A ZZ-DESCARTADOS</button>
          </form>
        </div>
      </div>`;
    } else if (fase === "ZZ_DESCARTADO") {
      // Ficha descartada: Reactivar + Eliminar (borrado físico definitivo)
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col" style="background:var(--ptl-gray-50);border-color:var(--ptl-gray-200)">
        <div class="ptl-na-left">
          <div class="ico">✕</div>
          <div class="text" style="color:var(--ptl-gray-700)">Expediente descartado</div>
        </div>
        <div class="ptl-na-right ptl-na-igual-altura">
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/reactivar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a 01-CONTACTO con los contadores reseteados.')">↻ Reactivar expediente</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/eliminar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Eliminar definitivamente este expediente? Esta acción NO se puede deshacer.')">🗑 ELIMINAR</button>
          </form>
        </div>
      </div>`;
    } else if (fase === "09_TRAMITADA") {
      // v17.41: fase terminal. La barra de acción muestra el estado "Tramitado"
      // y, en el mismo sitio donde otras fases tienen "Próximo mail" o "Fecha
      // visita", aparece el campo "Fecha cobro" (manual). Si se rellena, la
      // CCPP queda contabilizada como COBRADA en la caja TOTAL TRAMITADO del
      // panel HOY. Si se borra, vuelve a estar pendiente de cobro.
      const fco = comu.fecha_cobro || '';
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          <div class="ico" style="color:#10B981">✓</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>09-TRAMITADO</span>
            <div class="sub" style="font-size:10.5px;color:${fco ? '#059669' : '#92400E'};margin-top:1px;font-weight:600">
              ${fco ? '💶 COBRADO el ' + esc(formatearFechaDDMMYYYY(fco)) : '⌛ Pendiente de cobro'}
            </div>
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha en que se cobró la obra al cliente. Déjala vacía si todavía no se ha cobrado.">
          <span class="ln ptl-label-mini">Fecha cobro</span>
          <input type="date" id="ptl-mini-fecha-cobro" value="${esc(fco)}"
            onchange="ptlSyncFechaCobro(this.value)"
            class="ptl-input-num"/>
        </div>
      </div>
      <script>
        (function(){
          window.ptlSyncFechaCobro = async function(v) {
            try {
              const fd = new URLSearchParams();
              fd.append('id', ${JSON.stringify(comu.ccpp_id)});
              fd.append('campo', 'fecha_cobro');
              fd.append('valor', v || '');
              const r = await fetch(${JSON.stringify(urlT(token, "/presupuestos/expediente/campo"))}, { method: 'POST', body: fd });
              if (r.ok) {
                // Recargar para que el sub-texto (COBRADO/Pendiente) refleje el cambio
                window.location.reload();
              } else {
                alert('Error guardando fecha de cobro: ' + r.status);
              }
            } catch (e) {
              alert('Error de red: ' + e.message);
            }
          };
        })();
      </script>`;
    } else if (fase === "04_ACEPTACION_PTO") {
      // Texto fase actual igual que el resto (sin la fecha, que ya se ve en el timeline)
      const labelFase04 = `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;
      const fpm = comu.fecha_proximo_mail_manual || '';

      // Indicador de reenvíos automáticos (segunda línea bajo el título de la fase)
      let infoEnvioAuto04Html = '';
      try {
        const plantilla04 = await leerPlantillaMail(fase);
        const info = calcularInfoEnvioAuto(comu, fase, plantilla04);
        if (info.texto) {
          const colorTxt = info.completado
            ? '#B45309'                                  // ámbar (decidir)
            : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
          infoEnvioAuto04Html = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
        }
      } catch (e) { /* si falla la lectura de plantilla, no se pinta el indicador */ }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>${esc(labelFase04)}</span>
            ${infoEnvioAuto04Html}
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>
        <div class="ptl-na-right">
          <button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-sm"
            onclick="ptlIntentarReenviarFase04('${esc(comu.ccpp_id)}')"
            title="Abre el modal para reenviar el presupuesto con los cambios realizados">
            📧 Reenviar presupuesto revisado
          </button>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/aceptar")}" style="display:inline" id="ptl-form-aceptar">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="button" class="ptl-btn ptl-btn-success ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_ACEPTACION_PTO', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de aceptación. Al confirmar, también pasa a fase 05-DOCUMENTACION.">✓ ACEPTADO</button>
          </form>
          <button type="button" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="ptlAbrirModalRechazo('${esc(comu.ccpp_id)}')">✕ RECHAZADO</button>
        </div>
      </div>
      <div id="ptl-modal-rechazo" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">
        <div style="background:white;border-radius:8px;padding:20px;max-width:480px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2)">
          <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:#991B1B">✕ Rechazar presupuesto</h3>
          <p style="margin:0 0 14px 0;font-size:13px;color:var(--ptl-gray-600)">Indica el motivo del rechazo:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" id="ptl-rech-precio" class="ptl-btn ptl-btn-danger" style="text-align:left;padding:10px 14px">POR PRECIO MÁS BAJO DE LA COMPETENCIA</button>
            <button type="button" id="ptl-rech-momento" class="ptl-btn ptl-btn-danger" style="text-align:left;padding:10px 14px">PORQUE NO SE VA A HACER DE MOMENTO</button>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px">
            <button type="button" id="ptl-rech-cancel" class="ptl-btn" style="background:var(--ptl-gray-100)">Cancelar</button>
          </div>
        </div>
      </div>
      <script>
        (function(){
          var modal = document.getElementById('ptl-modal-rechazo');
          var ccppIdRech = null;
          window.ptlAbrirModalRechazo = function(id){
            ccppIdRech = id;
            modal.style.display = 'flex';
          };
          function cerrar(){ modal.style.display = 'none'; ccppIdRech = null; }
          async function rechazar(motivo){
            if (!ccppIdRech) return;
            // Si hay cambios sin guardar en la ficha, los guardamos primero
            // para no perderlos. Si falla, abortamos el rechazo.
            try {
              if (typeof ptlDiff === 'function' && Object.keys(ptlDiff()).length > 0) {
                const ok = await ptlGuardar();
                if (!ok) {
                  alert('No se pudieron guardar los cambios pendientes. Rechazo cancelado.');
                  return;
                }
              }
            } catch (e) { /* si ptlDiff/ptlGuardar no existen aquí, seguimos */ }
            // Ahora POST al endpoint de rechazo con fetch.
            try {
              const body = new URLSearchParams({ id: ccppIdRech, motivo: motivo });
              const res = await fetch(${JSON.stringify(urlT(token, "/presupuestos/expediente/rechazar"))}, {
                method: 'POST',
                headers: {'Content-Type':'application/x-www-form-urlencoded'},
                body: body.toString()
              });
              if (!res.ok) {
                const t = await res.text();
                alert('No se pudo rechazar: ' + t);
                return;
              }
              window.ptlReloading = true;
              location.reload();
            } catch (e) {
              alert('Error: ' + e.message);
            }
          }
          document.getElementById('ptl-rech-precio').onclick   = function(){ rechazar('POR PRECIO MÁS BAJO DE LA COMPETENCIA'); };
          document.getElementById('ptl-rech-momento').onclick  = function(){ rechazar('PORQUE NO SE VA A HACER DE MOMENTO'); };
          document.getElementById('ptl-rech-cancel').onclick   = cerrar;
          modal.addEventListener('click', function(e){ if (e.target === modal) cerrar(); });
        })();
      </script>`;
    } else if (enFaseDoc) {
      // Fases del módulo documentación (05/06/07): barra azul oscura con
      // un botón principal de avance + descartar. Misma estructura visual
      // que las fases 01/02. La definición de la fase está en
      // FASES_DOCUMENTACION_DEF (más abajo en el archivo).
      const defDoc = FASES_DOCUMENTACION_DEF[fase];
      const labelFaseDoc = defDoc
        ? `${defDoc.codigo}-${(defDoc.nombreLargo || defDoc.nombre || '').toUpperCase()}`
        : fase;
      const sigDoc = defDoc && defDoc.siguiente ? FASES_DOCUMENTACION_DEF[defDoc.siguiente] : null;
      const labelSigDoc = sigDoc
        ? `→ Paso a ${sigDoc.codigo}-${(sigDoc.nombreLargo || sigDoc.nombre || '').toUpperCase()}`
        : null;

      // Caso especial fase 06_VISITA_EMASESA: clon estructural de la fase
      // 02_VISITA. Lleva un mini-bloque "FECHA VISITA" en el centro que
      // edita directamente el campo `fecha_visita_emasesa` del Sheet.
      let miniBloqueDocHtml = '<div></div>';
      if (fase === "06_VISITA_EMASESA") {
        const fve = comu.fecha_visita_emasesa || '';
        miniBloqueDocHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha real en que EMASESA visitó el CCPP">
          <span class="ln ptl-label-mini">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita-emasesa" value="${esc(fve)}"
            onchange="ptlSyncFechaVisitaEmasesa(this.value)"
            class="ptl-input-num"/>
        </div>`;
      } else if (fase === "05_DOCUMENTACION" || (fase === "08_CYCP" && !comu.fecha_cycp_completa)) {
        // Casilla "Próximo mail" — clon de la fase 04. Permite forzar la
        // próxima fecha en que el cron disparará el mail recurrente
        // (05_SEGUIMIENTO_DOC o 08_SEGUIMIENTO_CYCP). Al rellenarla, el
        // cron en su próximo tick verá que toca y lo enviará. La cadencia
        // normal se reanuda desde ahí.
        const fpm = comu.fecha_proximo_mail_manual || '';
        miniBloqueDocHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>`;
      }

      // Botón de avance:
      //  - Si hay siguiente fase definida: botón normal de paso a la siguiente.
      //  - Si NO hay siguiente (08_CYCP sin fecha de cierre): botón "Cerrar fase 08".
      //  - Si NO hay siguiente y ya cerrada: sin botón.
      let botonAvanzarHtml = '';
      if (labelSigDoc) {
        if (fase === "05_DOCUMENTACION") {
          // Al pulsar "→ Paso a 06-VISITA EMASESA" se abre el modal del mail
          // 05_FIN_DOC. El avance a fase 06 lo hace el endpoint /enviar-mail
          // al confirmar el envío (caso especial avanzadoA06).
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_FIN_DOC', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de fin de documentación. Al confirmar, también pasa a fase 06-VISITA EMASESA.">${esc(labelSigDoc)}</button>`;
        } else if (fase === "07_PTE_CYCP") {
          // Al pulsar "→ Paso a 08-CYCP" se abre el modal del mail
          // 08_INICIO_CYCP. El avance a fase 08 lo hace el endpoint /enviar-mail
          // al confirmar el envío (caso especial avanzadoA08).
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm"
              onclick="ptlAbrirModalMail('08_INICIO_CYCP', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de inicio de fase 08-CYCP (solicitud de contratos firmados y pagos). Al confirmar, también pasa a fase 08-CYCP.">${esc(labelSigDoc)}</button>`;
        } else {
          botonAvanzarHtml = `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">${esc(labelSigDoc)}</button>
            </form>`;
        }
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        // Cierre de fase 08: abre modal del mail 08_FIN_CYCP. El cierre real
        // (fecha_cycp_completa = hoy) lo hace el endpoint /enviar-mail al
        // confirmar el envío (caso especial cerradoFase08). El endpoint
        // legacy /cerrar-cycp se mantiene por compatibilidad pero ya no se
        // usa desde la UI.
        botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm"
            onclick="ptlAbrirModalMail('08_FIN_CYCP', '${esc(comu.ccpp_id)}')"
            title="Abre el modal para enviar el mail de cierre de fase 08-CYCP. Al confirmar, también cierra la fase (fecha_cycp_completa = hoy) y pasa a 09-TRAMITADA.">✓ Tramitados</button>`;
      }

      // Indicador de reenvíos automáticos (segunda línea bajo el título de la fase).
      // Solo en fases con cron de seguimiento: 05_DOCUMENTACION y 08_CYCP.
      let infoEnvioAutoDocHtml = '';
      if (fase === "05_DOCUMENTACION") {
        try {
          const plantilla05 = await leerPlantillaMail("05_SEGUIMIENTO_DOC");
          const info = calcularInfoEnvioAuto(comu, "05_DOCUMENTACION", plantilla05);
          if (info.texto) {
            const colorTxt = info.completado
              ? '#B45309'
              : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
            infoEnvioAutoDocHtml = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla */ }
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        try {
          const plantilla08 = await leerPlantillaMail("08_SEGUIMIENTO_CYCP");
          const info = calcularInfoEnvioAuto(comu, "08_CYCP", plantilla08);
          if (info.texto) {
            const colorTxt = info.completado
              ? '#B45309'
              : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
            infoEnvioAutoDocHtml = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla */ }
      }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>${esc(labelFaseDoc)}</span>
            ${infoEnvioAutoDocHtml}
            <div style="margin-top:4px">${renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha))}</div>
          </div>
        </div>
        ${miniBloqueDocHtml}
        <div class="ptl-na-right ptl-na-igual-altura">
          ${botonAvanzarHtml}
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Descartar este expediente? Pasará a ZZ-DESCARTADO y no podrá enviarse más.')">✕ A ZZ-DESCARTADOS</button>
          </form>
        </div>
      </div>`;
    } else if (def && def.siguiente) {
      // Fases activas con email asociado: 01_CONTACTO, 03_ENVIO_PTO
      const tienePlantilla = !!def.plantilla;
      const enviados = (() => { try { return JSON.parse(comu.mails_enviados || "{}"); } catch { return {}; } })();
      const numEnviosFase = enviados[fase] || 0;

      // Texto indicador con código + nombre (la fecha se ve en el timeline debajo)
      const labelFaseActual = `${def.codigo}-${(def.nombreLargo || def.nombre || '').toUpperCase()}`;

      // ----- INDICADOR de envíos automáticos (segunda línea bajo el título) -----
      // Se pinta SOLO en las fases que tienen reenvíos automáticos vía cron
      // (FASES_CON_REENVIOS). Muestra "no iniciado" si está en 0, "en curso"
      // con fecha del próximo, "completado" o "desactivado". La fase 03 tiene
      // plantilla pero es un envío manual único que avanza a 04, no hay
      // reenvíos: ahí no se pinta.
      let infoEnvioAutoHtml = "";
      if (tienePlantilla && FASES_CON_REENVIOS.includes(fase)) {
        try {
          const plantillaSheet = await leerPlantillaMail(fase);
          const info = calcularInfoEnvioAuto(comu, fase, plantillaSheet);
          if (info.texto) {
            const colorTxt = info.completado
              ? '#B45309'                                  // ámbar (decidir)
              : (info.estado === 'desactivado' ? 'var(--ptl-gray-500)' : '#4F46E5');
            infoEnvioAutoHtml = `<div class="sub" style="font-size:10.5px;color:${colorTxt};margin-top:1px;font-weight:600">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla la lectura */ }
      }

      // Texto botón siguiente
      const sig = PTO_FASES[def.siguiente];
      const labelSig = sig
        ? `→ Paso a ${sig.codigo}-${(sig.nombreLargo || sig.nombre || '').toUpperCase()}`
        : `→ ${esc(def.accionLabel)}`;

      // Botón mail: estilo secondary original (gris claro). Solo si la plantilla está activa.
      // Cuando ya hay envíos, se oculta (lo gestiona el cron).
      let btnMailHtml = '';
      if (tienePlantilla && numEnviosFase === 0) {
        btnMailHtml = `<button type="button" class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l"
          onclick="ptlAbrirModalMail('${esc(fase)}', '${esc(comu.ccpp_id)}')"
          title="Enviar el primer mail y dejar el resto al cron automático">
          <span class="ln">📧 Activar</span>
          <span class="ln">mail</span>
          <span class="ln">automático</span>
        </button>`;
      }

      // Mini-bloque "FECHA VISITA" en fase 02_VISITA (sustituye al hueco del botón mail).
      // El input edita directamente el campo fecha_visita del formulario principal,
      // así que aprovecha el sistema de "guardar al cambiar" que ya existe.
      let miniBloqueHtml = '';
      if (fase === "02_VISITA") {
        const fv = comu.fecha_visita || '';
        miniBloqueHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha real en que se hizo la visita">
          <span class="ln ptl-label-mini">Fecha visita</span>
          <input type="date" id="ptl-mini-fecha-visita" value="${esc(fv)}"
            onchange="ptlSyncFechaVisita(this.value)"
            class="ptl-input-num"/>
        </div>`;
      } else if (fase === "01_CONTACTO") {
        // Casilla "Próximo mail" — clon de la fase 04. Permite forzar la
        // próxima fecha en que el cron disparará el reenvío automático de
        // fase 01. Al rellenarla, el cron en su próximo tick verá que toca y
        // lo enviará. Tras el envío se borra y la cadencia normal se reanuda.
        const fpm = comu.fecha_proximo_mail_manual || '';
        miniBloqueHtml = `<div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Próxima fecha en que el cron enviará un mail (rellénala si has hablado con el cliente y te ha pedido que vuelvas un día concreto)">
          <span class="ln ptl-label-mini">Próximo mail</span>
          <input type="date" id="ptl-mini-fecha-proximo" value="${esc(fpm)}"
            onchange="ptlSyncFechaProximoMail(this.value)"
            class="ptl-input-num"/>
        </div>`;
      }

      // Caso especial fase 03_ENVIO_PTO: un único botón grande "Enviar presupuesto y Paso a 04"
      // que ocupa la columna derecha (donde antes iban los dos botones apilados).
      // No hay botón rojo de descartar en esta fase.
      // Antes de abrir el modal, valida que estén rellenos los datos económicos previstos.
      if (fase === "03_ENVIO_PTO") {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid ptl-next-action-grid-2col">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span>${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-enviar-avanzar"
            onclick="ptlIntentarEnviarFase03('${esc(fase)}', '${esc(comu.ccpp_id)}')"
            title="Abre el modal para revisar y enviar el presupuesto. Al confirmar, también pasa a fase 04-ACEPTACION PTO.">
            <span class="ln">📧 Enviar presupuesto</span>
            <span class="ln">Y paso a 04-ACEPTACION PTO</span>
          </button>
        </div>`;
      } else {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span>${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          ${miniBloqueHtml || btnMailHtml || '<div></div>'}
          <div class="ptl-na-right ptl-na-igual-altura">
            ${ fase === "01_CONTACTO"
              ? `<button type="button" class="ptl-btn ptl-btn-primary ptl-btn-sm"
                  onclick="ptlPreguntarActaPaso02('${esc(comu.ccpp_id)}')"
                  title="Pregunta si han enviado el acta y abre el modal del mail correspondiente. Al confirmar, también pasa a fase 02-VISITA (pendiente de visita).">${esc(labelSig)}</button>`
              : `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm">${esc(labelSig)}</button>
            </form>` }
            <form method="POST" action="${urlT(token, "/presupuestos/expediente/descartar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Descartar este expediente? Pasará a ZZ-DESCARTADO y no podrá enviarse más.')">✕ A ZZ-DESCARTADOS</button>
            </form>
          </div>
        </div>`;
      }
    }

    // Helper inputs
    const inp = (name, val, opts = {}) => {
      const tipo = opts.type || "text";
      // Para campos numéricos, usamos type=text + clase para formatearlos con JS
      const esEuros = tipo === "number" && (opts.formato === "euros" || /pto_total|mano_obra|material|beneficio/.test(name));
      const esDias  = tipo === "number" && (opts.formato === "dias" || /tiempo/.test(name));
      let inputType = tipo === "email" ? "email" : (tipo === "tel" ? "tel" : "text");
      if (tipo === "number" && !esEuros && !esDias) inputType = "number";
      const col = opts.col || 3;
      const lbl = opts.label || name;
      const step = (tipo === "number" && inputType === "number") ? ' step="0.01"' : '';
      let cls = "";
      if (tipo === "tel") cls = ' class="campo-tlf"';
      else if (esEuros) cls = ' class="campo-euros"' + (opts.readonly ? '' : ' inputmode="decimal"');
      else if (esDias)  cls = ' class="campo-dias"'  + (opts.readonly ? '' : ' inputmode="decimal"');
      // Si el campo es readonly, le aplicamos la clase calc-field para que tenga la sombra gris
      // de los campos bloqueados (igual que Desvío tiempo / Desvío beneficio).
      if (opts.readonly) {
        cls = cls.replace('class="', 'class="calc-field ');
        if (!cls.includes('class="')) cls = ' class="calc-field"';
      }
      const ro = opts.readonly ? ' readonly' : '';
      const list = opts.list ? ` list="${opts.list}"` : '';
      return `<div class="col-${col}">
        <label class="ptl-form-label">${esc(lbl)}</label>
        <input type="${inputType}" name="${name}" value="${esc(val == null ? '' : val)}" data-orig="${esc(val == null ? '' : val)}"${step}${cls}${list}${ro}/>
      </div>`;
    };

    // Determinar qué campos económicos están bloqueados según la fase actual.
    // Reglas:
    //  - Fases 01_CONTACTO y 02_VISITA: TODOS los campos económicos editables bloqueados.
    //  - Fases 03_ENVIO_PTO en adelante: solo los 4 "previstos" desbloqueados.
    //  - Los campos REAL siguen bloqueados de momento (más adelante se decidirá cuándo activarlos).
    //  - Calculados (desvíos, beneficios) están siempre bloqueados (se renderizan aparte).
    const fasePtl = normalizarFase(comu.fase_presupuesto);
    // Los campos "previstos" siguen editables aunque el CCPP ya esté en una
    // fase del módulo documentacion (05+), por si hay que retocar importes.
    const previstoEditable = !["01_CONTACTO","02_VISITA","ZZ_RECHAZADO","ZZ_DESCARTADO"].includes(fasePtl);
    // Los campos "real" se desbloquean al entrar en fase 08_CYCP y siguen
    // editables a partir de ahí (decisión sesión 04/05/2026: por ahora no se
    // vuelven a bloquear con el cierre de fase, ya se decidirá en el futuro).
    const realEditable = (fasePtl === "08_CYCP");
    const roPrevisto = !previstoEditable;
    const roReal = !realEditable;

    const expDataJson = JSON.stringify({
      direccion: comu.direccion || "", comunidad: comu.comunidad || "", tipo_via: comu.tipo_via || "", earth: comu.earth || "",
      administrador: comu.administrador || "", telefono_administrador: fmtTlf(comu.telefono_administrador),
      email_administrador: comu.email_administrador || "",
      presidente: comu.presidente || "", telefono_presidente: fmtTlf(comu.telefono_presidente),
      email_presidente: comu.email_presidente || "",
      pto_total: comu.pto_total || "", mano_obra_previsto: comu.mano_obra_previsto || "", mano_obra_real: comu.mano_obra_real || "",
      material_previsto: comu.material_previsto || "", material_real: comu.material_real || "",
      tiempo_previsto: comu.tiempo_previsto || "", tiempo_real: comu.tiempo_real || "",
      notas_pto: comu.notas_pto || "",
    }).replace(/</g, "\\u003c");

    // Info de administradores existentes para autocompletar tel/email
    const adminInfoJson = JSON.stringify(datalists.adminInfo || {}).replace(/</g, "\\u003c");
    const ccppIdActual = comu.ccpp_id || "";

    // Listas para autocompletado custom (tipos via + admins + presidentes)
    const tiposViaPredef = ["C","Av","Bª","Pz","Pza","Rª","Ur"];
    const tiposViaBd = (datalists.tiposVia || []);
    const tiposViaUnion = Array.from(new Set([...tiposViaPredef, ...tiposViaBd])).filter(Boolean);
    const acDataJson = JSON.stringify({
      admins: datalists.admins || [],
      presis: datalists.presis || [],
      tipos:  tiposViaUnion,
    }).replace(/</g, "\\u003c");

    return `
      ${accionHtml}

      <div class="ptl-card">
        ${lineaTiempoHtml(comu)}
      </div>

      <form id="ptl-ficha-form" data-id="${esc(comu.ccpp_id)}" onsubmit="return false">
        <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
        ${extraHtmlInicial}

        <div class="ptl-card" style="padding:6px 12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="ptl-card-title" style="margin:0">Datos CCPP</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" id="ptlBtnImprimirDocs"
                class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme"
                data-ccpp-id="${esc(comu.ccpp_id)}"
                title="Imprimir documentos de EMASESA para este expediente">📄 IMPRIMIR DOCUMENTOS</button>
              <button type="button" id="ptlBtnCarpetaDrive"
                class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme"
                title="Abrir la carpeta de este expediente en Google Drive">📁 CARPETA DRIVE</button>
            </div>
          </div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-1">
              <label class="ptl-form-label">Tipo vía</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" value="${esc(comu.tipo_via || '')}" data-orig="${esc(comu.tipo_via || '')}" placeholder="C" autocomplete="off"/>
              </div>
            </div>
            <div class="col-7">
              <label class="ptl-form-label">Dirección</label>
              <input name="direccion" value="${esc(comu.direccion || '')}" data-orig="${esc(comu.direccion || '')}"/>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">Earth</label>
              <select name="earth" data-orig="${esc(comu.earth || '')}">
                <option value="" ${!comu.earth ? 'selected' : ''}>—</option>
                <option value="SI" ${comu.earth === 'SI' ? 'selected' : ''}>Sí</option>
                <option value="NO" ${comu.earth === 'NO' ? 'selected' : ''}>No</option>
              </select>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">Comunidad (clave)</label>
              <input name="comunidad" value="${esc(comu.comunidad || '')}" data-orig="${esc(comu.comunidad || '')}" title="Clave humana usada en pestañas vecinos_base/expedientes"/>
            </div>
          </div>

          <div class="ptl-form-section-title" style="margin:2px 0 0">Administrador</div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Nombre</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" value="${esc(comu.administrador || '')}" data-orig="${esc(comu.administrador || '')}" autocomplete="off"/>
              </div>
            </div>
            ${inp("telefono_administrador", fmtTlf(comu.telefono_administrador), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_administrador",    comu.email_administrador, { col: 4, type: "email", label: "Email" })}
          </div>

          <div class="ptl-form-section-title" style="margin:2px 0 0">Presidente</div>
          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Nombre</label>
              <input name="presidente" value="${esc(comu.presidente || '')}" data-orig="${esc(comu.presidente || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_presidente", fmtTlf(comu.telefono_presidente), { col: 2, type: "tel", label: "Teléfono" })}
            ${inp("email_presidente",    comu.email_presidente, { col: 4, type: "email", label: "Email" })}
          </div>
        </div>

        ${["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO"].includes(fase) ? `<div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="ptl-card-title" style="margin:0">Notas</div>
            <button type="button"
                    class="ptl-vec-btn ptl-exp-reloj"
                    data-ccpp-id="${esc(comu.ccpp_id || '')}"
                    data-enhoy="${(String(comu.en_hoy || '').trim() === '1') ? '1' : '0'}"
                    title="${(String(comu.en_hoy || '').trim() === '1') ? 'Quitar de HOY' : 'Añadir a HOY'}"
                    style="${(String(comu.en_hoy || '').trim() === '1')
                       ? 'background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold'
                       : 'background:transparent;color:#9CA3AF;border-color:#E5E7EB;filter:grayscale(1) opacity(0.5)'}">⏰</button>
          </div>
          <input type="text" name="notas_pto" data-orig="${esc(comu.notas_pto || '')}" value="${esc(comu.notas_pto || '')}" autocomplete="off" style="width:100%;padding:5px 8px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
        </div>` : ''}

        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title" style="margin:0">Comunicaciones</div>
            <div style="display:flex;gap:6px">
              <button type="button" id="ptlComSendBtn"
                class="ptl-btn ptl-btn-primary ptl-btn-sm ptl-btn-uniforme"
                title="Enviar mail manual">📧 Enviar mail manual</button>
            </div>
          </div>
          <style>
            /* Cajita Comunicaciones — filas compactas (scoped) */
            .ptl-com-list .ptl-vec-btn{width:18px;height:18px;font-size:9px}
            .ptl-com-list .ptl-com-grid{padding:0 6px;line-height:1.1}
            .ptl-com-list .ptl-com-row:nth-child(even){background:#E0E2E6}
            .ptl-com-list .hoy-asunto-clic:hover{color:#000;font-weight:700}
            /* Dimensiones uniformes para botones primary de cabecera de cajitas */
            .ptl-btn-uniforme{min-width:170px;height:28px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center}
          </style>
          ${(() => {
            // Formatea fecha del histórico a "dd/mm/aa hh:mm" o "dd/mm/aa".
            // Usa zona horaria Europe/Madrid: el servidor (Render) corre en UTC,
            // así que sin TZ explícita las horas saldrían 1-2h por debajo.
            const fmtFecha = (s) => {
              if (!s) return "";
              const t = Date.parse(s);
              if (isNaN(t)) return String(s);
              const d = new Date(t);
              const partes = new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
              }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
              const dd = partes.day, mm = partes.month, aa = partes.year;
              const hh = partes.hour === '24' ? '00' : partes.hour;
              const mi = partes.minute;
              const tieneHora = (hh !== "00" || mi !== "00");
              return tieneHora ? `${dd}-${mm}-${aa} ${hh}:${mi}` : `${dd}-${mm}-${aa}`;
            };
            // Quita el prefijo "C [tipo_via] [direccion] -" del asunto si coincide con la CCPP actual.
            // El patrón típico es "C Ciudad de Carcagente 2 -Presupuesto..." (con o sin espacio tras el guión).
            const tipoVia = String(comu.tipo_via || "").trim();
            const direccionCcpp = String(comu.direccion || "").trim();
            const prefijos = [];
            if (tipoVia && direccionCcpp) prefijos.push(`${tipoVia} ${direccionCcpp}`);
            if (direccionCcpp) prefijos.push(direccionCcpp);
            const limpiarAsunto = (a) => {
              let s = String(a || "").trim();
              for (const p of prefijos) {
                // intenta eliminar "PREFIJO -" o "PREFIJO-" al inicio (case-insensitive)
                const re = new RegExp("^" + p.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&") + "\\\\s*-\\\\s*", "i");
                if (re.test(s)) { s = s.replace(re, ""); break; }
              }
              return s;
            };
            const renderAdjuntos = (raw) => {
              const s = String(raw || "").trim();
              if (!s) return "";
              const conLinks = esc(s).replace(
                /(https?:\/\/[^\s<>"]+)/g,
                '<a href="$1" target="_blank" rel="noopener" style="color:var(--ptl-brand);text-decoration:underline">$1</a>'
              ).replace(/ \|\| /g, "\n");
              return `<div style="margin-top:6px;font-size:11px;color:var(--ptl-gray-700);white-space:pre-wrap;word-break:break-word">${conLinks}</div>`;
            };
            if (!comuHistorico.length) {
              return `<div class="ptl-empty-msg">— Sin comunicaciones registradas —</div>`;
            }
            // Deduce dirección a partir del tipo. Por convención:
            //   tipos con sufijo "_entrada" o que contengan "entrada" → ↓ (entrante)
            //   resto → ↑ (saliente)
            const esEntrante = (tipo) => /entrada/i.test(String(tipo || ""));
            // Categorías visibles: Manual (todos los manual_*) | Automático (automatico/cron)
            const categoriaDe = (tipo) => {
              const t = String(tipo || "").toLowerCase();
              if (t.startsWith("manual") || t === "reenvio_fase04") return { label: "Manual", color: "#6B7280", bg: "#F3F4F6" };
              if (t === "automatico") return { label: "Automático", color: "#208040", bg: "#ECFDF5" };
              return { label: t || "—", color: "#6B7280", bg: "#F3F4F6" };
            };
            const filas = comuHistorico.map((m, idx) => {
              const fechaTxt = fmtFecha(m.fecha);
              const asuntoLimpio = limpiarAsunto(m.asunto);
              const asuntoHtml = asuntoLimpio
                ? esc(asuntoLimpio)
                : `<span style="color:var(--ptl-gray-400);font-style:italic">— envío externo —</span>`;
              const entrante = esEntrante(m.tipo);
              const flecha = entrante ? '▼' : '▲';
              const colorFlecha = entrante ? 'var(--ptl-danger)' : 'var(--ptl-brand)';
              const labelDest = entrante ? 'Remitente' : 'Destinatario';
              const cat = categoriaDe(m.tipo);
              const destTxt = String(m.destinatario || "").trim() || "—";
              const fasePlantilla = String(m.fase || "").trim() || "—";
              const cuerpo = String(m.mensaje || "").replace(/\\n/g, "\n");
              // Datos para identificar la fila al borrar (los pasamos al backend).
              const dataAttrs = `data-fecha="${esc(m.fecha)}" data-id="${esc(m.ccpp_id)}" data-dir="${esc(m.direccion)}" data-fase="${esc(m.fase)}" data-asunto="${esc(m.asunto)}" data-tipo="${esc(m.tipo)}"`;
              // Botón reloj: solo para mails entrantes con message_id (los únicos
              // que tienen sentido en HOY). Encendido (color) si está actualmente
              // en HOY; apagado (gris) si no.
              const mid = String(m.message_id || "").trim();
              const enHoy = mid && messageIdsEnHoy.has(mid);
              const mostrarReloj = entrante && mid;
              const btnReloj = mostrarReloj
                ? `<button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-hoy" data-mid="${esc(mid)}" data-enhoy="${enHoy ? '1' : '0'}" title="${enHoy ? 'Quitar de HOY' : 'Añadir a HOY'}" style="${enHoy ? 'background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold' : 'background:transparent;color:#9CA3AF;border-color:#E5E7EB;filter:grayscale(1) opacity(0.5)'}">⏰</button>`
                : `<span class="ptl-vec-btn" style="visibility:hidden">⏰</span>`;
              // Datos para Responder/Reenviar (los pasamos al JS por data-*).
              // El cuerpo puede ser largo: lo codificamos en base64 para evitar
              // problemas con saltos de línea y comillas dentro del HTML.
              const cuerpoB64 = Buffer.from(String(m.mensaje || ""), "utf8").toString("base64");
              const asuntoB64 = Buffer.from(String(m.asunto || ""), "utf8").toString("base64");
              const destB64   = Buffer.from(String(m.destinatario || ""), "utf8").toString("base64");
              const dataRR = `data-fecha="${esc(m.fecha)}" data-dest="${destB64}" data-asunto="${asuntoB64}" data-cuerpo="${cuerpoB64}" data-entrante="${entrante ? '1' : '0'}" data-adjuntos="${esc(m.adjuntos || '')}" data-mid="${esc(mid)}"`;
              return `
                <div class="ptl-com-row" data-idx="${idx}" style="border-bottom:1px solid var(--ptl-gray-100)">
                  <div class="ptl-com-grid" style="display:grid;grid-template-columns:90px 18px 78px 1fr 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px">
                    <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${esc(fechaTxt)}</div>
                    <div style="text-align:center;color:${colorFlecha};font-weight:600">${flecha}</div>
                    <div style="text-align:center"><span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:${cat.bg};color:${cat.color};white-space:nowrap">${esc(cat.label)}</span></div>
                    <div class="hoy-asunto-clic ptl-com-toggle" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-800)" title="${esc(m.asunto || '')}">${asuntoHtml}</div>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-responder" ${dataRR} title="Responder" style="color:var(--ptl-brand);font-weight:bold">↩</button>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-reenviar" ${dataRR} title="Reenviar" style="color:var(--ptl-brand);font-weight:bold">↪</button>
                    ${btnReloj}
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar ptl-com-delete" ${dataAttrs} title="Borrar este registro">✕</button>
                  </div>
                  <div class="ptl-com-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
                    <div style="margin-bottom:4px"><strong>${labelDest}:</strong> ${esc(destTxt)}</div>
                    <div style="margin-bottom:4px"><strong>Plantilla:</strong> ${esc(fasePlantilla)}</div>
                    <div style="margin-bottom:4px"><strong>Mensaje:</strong></div>
                    <div style="white-space:pre-line;word-break:break-word;background:#fff;padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800)">${_renderCuerpoMail(cuerpo, esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
                    ${renderAdjuntos(m.adjuntos)}
                  </div>
                </div>
              `;
            }).join("");
            return `
              <div class="ptl-com-list" style="overflow:visible;border:1px solid var(--ptl-gray-200);border-radius:5px;background:#FFFFFF">
                ${filas}
              </div>
            `;
          })()}
        </div>

        <!-- Modal enviar mail manual (compositor tipo Gmail) -->
        <!-- v17.70: convertido en ventana flotante arrastrable estilo Windows.
             v17.71: usa las clases compartidas .ptl-floating-* de estilo-visual.cjs v1.14
             y se inicializa con el helper ptlMakeDraggable (mismo helper que el otro modal). -->
        <div id="ptlComSendModal" class="ptl-floating-wrapper">
          <div id="ptlComSendBox" class="ptl-floating-window" style="width:680px">
            <div id="ptlComSendTitle" class="ptl-floating-title">
              <span class="ptl-floating-title-text">📧 Enviar mail manual</span>
              <button type="button" id="ptlComSxclose" class="ptl-floating-close" title="Cerrar">✕</button>
            </div>
            <div class="ptl-floating-body">
            <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">
              <div>
                <label class="ptl-form-label">Destinatario (email)</label>
                <input type="text" id="ptlComSdest" placeholder="ejemplo@dominio.com" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
              </div>
              <div>
                <label class="ptl-form-label">CC (opcional)</label>
                <input type="text" id="ptlComScc" placeholder="separar con coma" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
              </div>
              <div>
                <label class="ptl-form-label">CCO (opcional)</label>
                <input type="text" id="ptlComScco" placeholder="separar con coma" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
              </div>
              <div>
                <label class="ptl-form-label">Asunto</label>
                <input type="text" id="ptlComSasunto" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
              </div>
              <div>
                <label class="ptl-form-label">Cuerpo del mensaje</label>
                <textarea id="ptlComScuerpo" rows="10" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;resize:vertical"></textarea>
              </div>
              <div>
                <label class="ptl-form-label">Adjuntos (links de Drive, hasta 3)</label>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" style="flex:0 0 200px;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                    <input type="text" id="ptlComSadj1url" placeholder="https://drive.google.com/..." style="flex:1;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                  </div>
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj2lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                    <input type="text" id="ptlComSadj2url" placeholder="https://drive.google.com/..." style="flex:1;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                  </div>
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj3lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                    <input type="text" id="ptlComSadj3url" placeholder="https://drive.google.com/..." style="flex:1;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px"/>
                  </div>
                </div>
                <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:4px">
                  Los archivos se descargan de Drive y se adjuntan al mail. En el histórico solo se guardan los links.
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
              <button type="button" id="ptlComScancel" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
              <button type="button" id="ptlComSsend" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Enviar</button>
            </div>
            </div>
          </div>
        </div>

        <script>
          (function(){
            // ============================================================
            // v17.71: Helpers globales para ventanas flotantes arrastrables.
            //         Usados por ptlComSendModal (mail manual) y por
            //         ptl-modal-mail (mail con plantilla). Las clases CSS
            //         viven en estilo-visual.cjs v1.14 (.ptl-floating-*).
            // ============================================================
            // ptlMakeDraggable(boxEl, titleEl, closeEl?)
            //   - boxEl:   la ventana (la .ptl-floating-window).
            //   - titleEl: la cabecera arrastrable (.ptl-floating-title).
            //   - closeEl: opcional, el botón ✕; si se clica, no arrastra.
            // Aplica drag por mousedown en titleEl, sigue al cursor con
            // clamping para que la ventana no salga del viewport (margen 4px).
            window.ptlMakeDraggable = window.ptlMakeDraggable || function(boxEl, titleEl, closeEl){
              if (!boxEl || !titleEl) return;
              let arrastrando = false;
              let offX = 0, offY = 0;
              titleEl.addEventListener('mousedown', function(e){
                if (closeEl && e.target.closest && e.target === closeEl) return;
                if (closeEl && e.target.closest && e.target.closest('.ptl-floating-close')) return;
                arrastrando = true;
                const rect = boxEl.getBoundingClientRect();
                offX = e.clientX - rect.left;
                offY = e.clientY - rect.top;
                e.preventDefault();
              });
              document.addEventListener('mousemove', function(e){
                if (!arrastrando) return;
                let x = e.clientX - offX;
                let y = e.clientY - offY;
                const maxX = window.innerWidth  - boxEl.offsetWidth  - 4;
                const maxY = window.innerHeight - boxEl.offsetHeight - 4;
                if (x < 4) x = 4; if (x > maxX) x = maxX;
                if (y < 4) y = 4; if (y > maxY) y = maxY;
                boxEl.style.left = x + 'px';
                boxEl.style.top  = y + 'px';
              });
              document.addEventListener('mouseup', function(){ arrastrando = false; });
            };
            // ptlCentrarVentana(boxEl): coloca top/left para centrar boxEl en el viewport.
            // Llamar DESPUÉS de mostrarla (necesita offsetWidth/Height reales).
            window.ptlCentrarVentana = window.ptlCentrarVentana || function(boxEl){
              if (!boxEl) return;
              const w = boxEl.offsetWidth || 680;
              const h = boxEl.offsetHeight || 500;
              const left = Math.max(0, Math.round((window.innerWidth - w) / 2));
              const top  = Math.max(0, Math.round((window.innerHeight - h) / 2));
              boxEl.style.left = left + 'px';
              boxEl.style.top  = top + 'px';
            };

            // Toggle desplegable
            document.querySelectorAll('.ptl-com-toggle').forEach(btn => {
              btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const det = document.querySelector('.ptl-com-detail[data-idx="' + idx + '"]');
                if (!det) return;
                const abierto = det.style.display !== 'none';
                det.style.display = abierto ? 'none' : 'block';
              });
            });
            // Botón reloj: alterna presencia del mail en HOY
            document.querySelectorAll('.ptl-com-hoy').forEach(btn => {
              btn.addEventListener('click', async () => {
                const mid = btn.dataset.mid || '';
                if (!mid) return;
                btn.disabled = true;
                try {
                  const body = new URLSearchParams({ message_id: mid });
                  const res = await fetch('${urlT(token, "/presupuestos/mail-toggle-hoy")}', {
                    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { const t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // Pie global para responder/reenviar (precargado desde el server).
            const PIE_GLOBAL = ${JSON.stringify(pieGlobal || "")};

            // Helper: decodifica base64 con soporte UTF-8.
            function _b64dec(s) {
              try { return decodeURIComponent(escape(atob(s || ''))); } catch (_) { return ''; }
            }
            // Helper: formato fecha "El 12 de mayo de 2026 a las 14:32"
            function _fmtFechaCita(fechaStr) {
              const t = Date.parse(fechaStr);
              if (isNaN(t)) return String(fechaStr || '');
              const d = new Date(t);
              const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
              const dia = d.getDate();
              const mes = meses[d.getMonth()];
              const anio = d.getFullYear();
              const hh = String(d.getHours()).padStart(2,'0');
              const mi = String(d.getMinutes()).padStart(2,'0');
              return 'El ' + dia + ' de ' + mes + ' de ' + anio + ' a las ' + hh + ':' + mi;
            }
            // Helper: añade "> " delante de cada línea del cuerpo (estilo Gmail).
            function _citar(texto) {
              return String(texto || '').split('\\n').map(l => '> ' + l).join('\\n');
            }
            // Helper: quita prefijos "Re:"/"Fwd:" repetidos y añade el nuevo.
            function _prefijar(prefix, asunto) {
              let s = String(asunto || '').trim();
              // Quitar prefijos previos (Re:, RE:, Fwd:, FW:, Rv:) varias veces.
              for (let i = 0; i < 5; i++) {
                const m = s.match(/^(re|fwd|fw|rv|aw)\\s*:\\s*/i);
                if (!m) break;
                s = s.slice(m[0].length);
              }
              return prefix + s;
            }

            // === Responder ===
            document.querySelectorAll('.ptl-com-responder').forEach(btn => {
              btn.addEventListener('click', () => {
                const fecha = btn.dataset.fecha || '';
                const dest = _b64dec(btn.dataset.dest || '');
                const asunto = _b64dec(btn.dataset.asunto || '');
                const cuerpo = _b64dec(btn.dataset.cuerpo || '');
                const entrante = btn.dataset.entrante === '1';
                // Destinatario: si era entrante, contestamos al remitente
                // (lo guardamos en col "destinatario" tras clasificar); si era
                // saliente, contestamos al destinatario original.
                sAbrir();
                sDest.value = dest;
                sAs.value = _prefijar('Re: ', asunto);
                const cita = _fmtFechaCita(fecha) + ', escribió:\\n' + _citar(cuerpo);
                sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL + '\\n\\n' : '') + cita;
                // Cursor al principio para que escriba arriba.
                setTimeout(() => { sCu.focus(); sCu.setSelectionRange(0, 0); }, 100);
              });
            });

            // === Reenviar ===
            document.querySelectorAll('.ptl-com-reenviar').forEach(btn => {
              btn.addEventListener('click', () => {
                const fecha = btn.dataset.fecha || '';
                const dest = _b64dec(btn.dataset.dest || '');
                const asunto = _b64dec(btn.dataset.asunto || '');
                const cuerpo = _b64dec(btn.dataset.cuerpo || '');
                const adjuntos = btn.dataset.adjuntos || '';
                sAbrir();
                sDest.value = '';   // destinatario vacío
                sAs.value = _prefijar('Fwd: ', asunto);
                const cabecera = '---------- Mensaje reenviado ----------\\n'
                  + 'De: ' + dest + '\\n'
                  + 'Fecha: ' + _fmtFechaCita(fecha) + '\\n'
                  + 'Asunto: ' + asunto + '\\n\\n';
                sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL + '\\n\\n' : '') + cabecera + cuerpo;
                // Rellenar adjuntos si vienen como "LABEL: url || LABEL: url".
                if (adjuntos) {
                  const partes = adjuntos.split('||').map(s => s.trim()).filter(Boolean);
                  partes.slice(0, 3).forEach((p, i) => {
                    const idx = i + 1;
                    const sep = p.indexOf(':');
                    if (sep < 0) return;
                    const lbl = p.slice(0, sep).trim();
                    const url = p.slice(sep + 1).trim();
                    const elLbl = document.getElementById('ptlComSadj' + idx + 'lbl');
                    const elUrl = document.getElementById('ptlComSadj' + idx + 'url');
                    if (elLbl) elLbl.value = lbl;
                    if (elUrl) elUrl.value = url;
                  });
                }
                setTimeout(() => sDest.focus(), 100);
              });
            });

            // Auto-disparo: si la URL trae ?accion_mail=responder|reenviar&mid=...
            // significa que llegamos desde HOY → buscar el botón con ese mid y
            // simular un clic, para abrir el modal precargado.
            // v17.66: tras disparar (o intentarlo), LIMPIAMOS accion_mail y mid
            // de la URL del navegador con history.replaceState. Antes esos
            // parámetros se quedaban pegados a la URL y cualquier recarga
            // (Ctrl+F5, reloj ⏰, location.reload de cualquier handler)
            // volvía a re-abrir el modal. Con replaceState no se recarga,
            // solo se sustituye la URL visible; el modal sigue abierto.
            (function(){
              try {
                var qp = new URLSearchParams(window.location.search);
                var accion = qp.get('accion_mail');
                var mid = qp.get('mid');
                if (!accion || !mid) return;
                var clase = accion === 'reenviar' ? '.ptl-com-reenviar' : '.ptl-com-responder';
                var sel = clase + '[data-mid="' + mid.replace(/"/g, '\\"') + '"]';
                var btn = document.querySelector(sel);
                if (btn) {
                  setTimeout(() => btn.click(), 200);
                } else {
                  console.warn('No se encontró botón para auto-disparar:', sel);
                }
                // v17.66 — limpiar URL para que próximos reloads no re-disparen.
                qp.delete('accion_mail');
                qp.delete('mid');
                var nuevaUrl = window.location.pathname + (qp.toString() ? '?' + qp.toString() : '') + window.location.hash;
                history.replaceState(null, '', nuevaUrl);
              } catch (e) { console.error('Auto-disparo accion_mail:', e); }
            })();
            // Borrar fila
            document.querySelectorAll('.ptl-com-delete').forEach(btn => {
              btn.addEventListener('click', async () => {
                if (!confirm('¿Borrar este registro de comunicaciones?\\n\\nEl mail enviado NO se desenvía — solo se borra el registro.')) return;
                btn.disabled = true;
                try {
                  const body = new URLSearchParams({
                    id: ${JSON.stringify(comu.ccpp_id)},
                    fecha: btn.dataset.fecha || '',
                    ccpp_id: btn.dataset.id || '',
                    direccion: btn.dataset.dir || '',
                    fase: btn.dataset.fase || '',
                    asunto: btn.dataset.asunto || '',
                    tipo: btn.dataset.tipo || ''
                  });
                  const res = await fetch('${urlT(token, "/presupuestos/expediente/mail-borrar")}', {
                    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) {
                    const t = await res.text();
                    alert('No se pudo borrar: ' + t);
                    btn.disabled = false;
                    return;
                  }
                  window.ptlReloading = true;
                  location.reload();
                } catch(e) {
                  alert('Error: ' + e.message);
                  btn.disabled = false;
                }
              });
            });
            // ===== Botón Carpeta Drive (cabecera DATOS CCPP) =====
            const btnDrive = document.getElementById('ptlBtnCarpetaDrive');
            if (btnDrive) {
              btnDrive.addEventListener('click', async () => {
                const orig = btnDrive.textContent;
                btnDrive.disabled = true;
                btnDrive.textContent = '⏳ Abriendo...';
                try {
                  const url = '${urlT(token, "/presupuestos/expediente/carpeta-drive")}' + '&id=' + encodeURIComponent(${JSON.stringify(comu.ccpp_id)});
                  const r = await fetch(url);
                  const data = await r.json();
                  if (!r.ok || !data.url) {
                    alert('No se pudo abrir la carpeta: ' + (data.error || 'error desconocido'));
                    return;
                  }
                  window.open(data.url, '_blank', 'noopener');
                } catch (e) {
                  alert('Error: ' + e.message);
                } finally {
                  btnDrive.disabled = false;
                  btnDrive.textContent = orig;
                }
              });
            }

            // ===== Modal "Imprimir documentos" (Sprint A — Bloque 2) =====
            // Flujo: (paso 1) elegir documentos + piso (si hay particulares) ->
            // (paso 2) formulario de huecos precargados/editables -> generar PDF.
            (function(){
              const btnImp = document.getElementById('ptlBtnImprimirDocs');
              if (!btnImp) return;
              const CCPP_ID = ${JSON.stringify(comu.ccpp_id)};
              const TOKEN_GEN = '${urlT(token, "/presupuestos/docs/generar")}';
              const URL_MENU = '${urlT(token, "/presupuestos/docs/menu")}';
              const URL_HUECOS = '${urlT(token, "/presupuestos/docs/huecos")}';

              let estado = { menu: null, seleccion: [], vivienda: '', campos: [] };

              function cerrar(){ const m = document.getElementById('ptlDocModal'); if (m) m.remove(); }

              function escH(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

              function crearVentana(titulo, contenidoHtml){
                cerrar();
                const wrap = document.createElement('div');
                wrap.id = 'ptlDocModal';
                wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:block';
                wrap.innerHTML =
                  '<div id="ptlDocBox" style="position:fixed;top:8%;left:50%;transform:translateX(-50%);width:560px;max-width:94vw;max-height:86vh;background:#fff;border:1px solid #d1d5db;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden">'
                  + '<div style="display:flex;align-items:center;justify-content:space-between;background:#FEF3C7;padding:10px 14px;border-bottom:1px solid #FDE68A">'
                  + '<strong style="color:#92400E">📄 ' + escH(titulo) + '</strong>'
                  + '<button type="button" id="ptlDocClose" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:#92400E;line-height:1">✕</button>'
                  + '</div>'
                  + '<div id="ptlDocBody" style="padding:14px;overflow-y:auto">' + contenidoHtml + '</div>'
                  + '</div>';
                document.body.appendChild(wrap);
                document.getElementById('ptlDocClose').addEventListener('click', cerrar);
              }

              // ---- PASO 1: menú de documentos + piso ----
              async function abrirMenu(){
                crearVentana('Imprimir documentos', '<div style="text-align:center;color:#6b7280;padding:20px">Cargando…</div>');
                let data;
                try {
                  const r = await fetch(URL_MENU + '&id=' + encodeURIComponent(CCPP_ID));
                  data = await r.json();
                  if (!r.ok) throw new Error(data.error || 'Error');
                } catch(e){
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:#DC2626">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.menu = data;
                pintarMenu();
              }

              function pintarMenu(){
                const data = estado.menu;
                let html = '<div style="font-size:13px;color:#374151;margin-bottom:10px">Expediente: <strong>' + escH(data.comunidad) + '</strong></div>';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:6px">Marca los documentos a imprimir:</div>';
                html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
                data.documentos.forEach(d => {
                  const et = d.tipo === 'particular' ? ' <span style="font-size:11px;color:#92400E">(de un piso)</span>' : ' <span style="font-size:11px;color:#6b7280">(general)</span>';
                  html += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">'
                       + '<input type="checkbox" class="ptlDocChk" value="' + escH(d.clave) + '" data-tipo="' + escH(d.tipo) + '"/>'
                       + '<span>' + escH(d.titulo) + et + '</span></label>';
                });
                html += '</div>';
                // Selector de piso (solo si hay pisos). Se mostrará/ocultará según haga falta.
                html += '<div id="ptlDocPisoWrap" style="display:none;margin-bottom:12px">';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:4px">Piso (para los documentos de un piso):</div>';
                if (data.pisos && data.pisos.length){
                  html += '<select id="ptlDocPiso" style="width:100%;padding:5px;border:1px solid #d1d5db;border-radius:4px;font-size:13px">';
                  html += '<option value="">— Elige un piso —</option>';
                  data.pisos.forEach(p => {
                    const etq = p.vivienda + (p.propietario ? ' · ' + p.propietario : '');
                    html += '<option value="' + escH(p.vivienda) + '">' + escH(etq) + '</option>';
                  });
                  html += '</select>';
                } else {
                  html += '<div style="font-size:12px;color:#DC2626">Este expediente no tiene pisos cargados. Los documentos de un piso saldrán con los datos en blanco.</div>';
                }
                html += '</div>';
                html += '<div style="text-align:right"><button type="button" id="ptlDocSiguiente" class="ptl-btn ptl-btn-primary" style="padding:6px 14px">Siguiente →</button></div>';
                document.getElementById('ptlDocBody').innerHTML = html;

                const chks = Array.from(document.querySelectorAll('.ptlDocChk'));
                const pisoWrap = document.getElementById('ptlDocPisoWrap');
                function refrescarPiso(){
                  const hayParticular = chks.some(c => c.checked && c.dataset.tipo === 'particular');
                  pisoWrap.style.display = hayParticular ? 'block' : 'none';
                }
                chks.forEach(c => c.addEventListener('change', refrescarPiso));
                document.getElementById('ptlDocSiguiente').addEventListener('click', () => {
                  const sel = chks.filter(c => c.checked).map(c => c.value);
                  if (sel.length === 0){ alert('Marca al menos un documento.'); return; }
                  const hayParticular = chks.some(c => c.checked && c.dataset.tipo === 'particular');
                  const pisoSel = document.getElementById('ptlDocPiso');
                  const viv = pisoSel ? pisoSel.value : '';
                  if (hayParticular && !viv){ alert('Elige el piso para los documentos de un piso.'); return; }
                  estado.seleccion = sel;
                  estado.vivienda = viv;
                  abrirFormulario();
                });
              }

              // ---- PASO 2: formulario de huecos ----
              async function abrirFormulario(){
                document.getElementById('ptlDocBody').innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px">Cargando datos…</div>';
                let data;
                try {
                  const body = new URLSearchParams({
                    id: CCPP_ID,
                    claves: JSON.stringify(estado.seleccion),
                    vivienda: estado.vivienda
                  });
                  const r = await fetch(URL_HUECOS, {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  data = await r.json();
                  if (!r.ok) throw new Error(data.error || 'Error');
                } catch(e){
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:#DC2626">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.campos = data.campos || [];
                let html = '<div style="font-size:13px;color:#374151;margin-bottom:10px">Revisa los datos. Los precargados puedes corregirlos; los vacíos puedes rellenarlos o dejarlos en blanco para rellenar a mano.</div>';
                if (estado.campos.length === 0){
                  html += '<div style="font-size:12px;color:#6b7280;margin-bottom:10px">Estos documentos no tienen datos que rellenar.</div>';
                }
                html += '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px">';
                estado.campos.forEach(c => {
                  html += '<label style="display:block;font-size:12px;margin-bottom:8px">'
                       + '<span style="display:block;color:#374151;margin-bottom:2px">' + escH(c.label) + (c.manual ? ' <span style="color:#9ca3af">(a mano)</span>' : '') + '</span>'
                       + '<input type="text" data-hueco="' + escH(c.clave) + '" value="' + escH(c.valor) + '" style="width:100%;padding:5px;border:1px solid #d1d5db;border-radius:4px;font-size:13px"/>'
                       + '</label>';
                });
                html += '</div>';
                html += '<div style="display:flex;justify-content:space-between;gap:8px">'
                     + '<button type="button" id="ptlDocAtras" class="ptl-btn" style="padding:6px 14px;background:#f3f4f6;border:1px solid #d1d5db">← Atrás</button>'
                     + '<button type="button" id="ptlDocGenerar" class="ptl-btn ptl-btn-primary" style="padding:6px 14px">📄 Generar PDF</button>'
                     + '</div>';
                document.getElementById('ptlDocBody').innerHTML = html;
                document.getElementById('ptlDocAtras').addEventListener('click', pintarMenu);
                document.getElementById('ptlDocGenerar').addEventListener('click', generar);
              }

              // ---- PASO 3: generar y descargar ----
              async function generar(){
                const btnG = document.getElementById('ptlDocGenerar');
                btnG.disabled = true; btnG.textContent = '⏳ Generando…';
                // Recoger los valores de la lista única
                const valores = {};
                document.querySelectorAll('#ptlDocBody input[data-hueco]').forEach(inp => {
                  valores[inp.dataset.hueco] = inp.value;
                });
                try {
                  const body = new URLSearchParams({
                    id: CCPP_ID,
                    claves: JSON.stringify(estado.seleccion),
                    vivienda: estado.vivienda,
                    valores: JSON.stringify(valores)
                  });
                  const r = await fetch(TOKEN_GEN, {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!r.ok){ const t = await r.json().catch(()=>({error:'Error'})); throw new Error(t.error || 'Error'); }
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'documentos.pdf';
                  document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(()=>URL.revokeObjectURL(url), 4000);
                  cerrar();
                } catch(e){
                  alert('Error generando el PDF: ' + e.message);
                  btnG.disabled = false; btnG.textContent = '📄 Generar PDF';
                }
              }

              btnImp.addEventListener('click', abrirMenu);
            })();

            // ===== Modal "Enviar mail manual" (compositor tipo Gmail) =====
            // v17.70: ventana flotante arrastrable estilo Windows. Sin overlay
            // translúcido; la pantalla de detrás queda totalmente interactiva
            // (puedes seleccionar, copiar, scrollear). Se mueve por la cabecera.
            const sModal = document.getElementById('ptlComSendModal');
            const sBox   = document.getElementById('ptlComSendBox');
            const sTitle = document.getElementById('ptlComSendTitle');
            const sBtn = document.getElementById('ptlComSendBtn');
            const sCancel = document.getElementById('ptlComScancel');
            const sXclose = document.getElementById('ptlComSxclose');
            const sSend = document.getElementById('ptlComSsend');
            const sDest = document.getElementById('ptlComSdest');
            const sCc = document.getElementById('ptlComScc');
            const sCco = document.getElementById('ptlComScco');
            const sAs = document.getElementById('ptlComSasunto');
            const sCu = document.getElementById('ptlComScuerpo');
            function sLimpiar() {
              sDest.value = ''; sCc.value = ''; sCco.value = '';
              sAs.value = ''; sCu.value = '';
              ['ptlComSadj1lbl','ptlComSadj1url','ptlComSadj2lbl','ptlComSadj2url','ptlComSadj3lbl','ptlComSadj3url']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            }
            function sAbrir() {
              sLimpiar();
              sModal.style.display = 'block';
              // v17.71: usa helper global window.ptlCentrarVentana.
              window.ptlCentrarVentana(sBox);
              setTimeout(() => sDest.focus(), 50);
            }
            function sCerrar() { sModal.style.display = 'none'; }
            if (sBtn) sBtn.addEventListener('click', sAbrir);
            if (sCancel) sCancel.addEventListener('click', sCerrar);
            if (sXclose) sXclose.addEventListener('click', sCerrar);
            // v17.71: drag&drop unificado via window.ptlMakeDraggable (helper
            // global definido más arriba, también lo usa ptl-modal-mail).
            window.ptlMakeDraggable(sBox, sTitle, sXclose);
            if (sSend) sSend.addEventListener('click', async () => {
              const dest = (sDest.value || '').trim();
              const cc = (sCc.value || '').trim();
              const cco = (sCco.value || '').trim();
              const asun = (sAs.value || '').trim();
              const cuer = sCu.value || '';
              if (!dest) { alert('Falta el destinatario'); return; }
              if (!asun) { alert('Falta el asunto'); return; }
              const adjs = [];
              for (let i = 1; i <= 3; i++) {
                const lbl = (document.getElementById('ptlComSadj' + i + 'lbl').value || '').trim();
                const url = (document.getElementById('ptlComSadj' + i + 'url').value || '').trim();
                if (url) adjs.push((lbl || 'ADJUNTO_' + i) + ': ' + url);
              }
              const adjuntos = adjs.join(' || ');
              sSend.disabled = true;
              sSend.textContent = '⏳ Enviando...';
              try {
                const body = new URLSearchParams({
                  id: ${JSON.stringify(comu.ccpp_id)},
                  destinatario: dest,
                  cc, cco,
                  asunto: asun,
                  mensaje: cuer,
                  adjuntos: adjuntos
                });
                const res = await fetch('${urlT(token, "/presupuestos/expediente/mail-enviar-manual")}', {
                  method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                  body: body.toString()
                });
                if (!res.ok) {
                  const t = await res.text();
                  alert('No se pudo enviar:\\n\\n' + t);
                  sSend.disabled = false;
                  sSend.textContent = '📧 Enviar';
                  return;
                }
                window.ptlReloading = true;
                location.reload();
              } catch(e) {
                alert('Error: ' + e.message);
                sSend.disabled = false;
                sSend.textContent = '📧 Enviar';
              }
            });
          })();
        </script>

        ${!["01_CONTACTO","02_VISITA"].includes(fase) ? `<div class="ptl-card ptl-card-econ-compact">
          <style>
            /* v17.60 — Datos económicos compacto: misma tipografía y altura
               que la tabla DATOS DOCUMENTACION (11px, 22px alto). */
            .ptl-card-econ-compact .ptl-form-grid { row-gap: 4px; column-gap: 8px; }
            .ptl-card-econ-compact .ptl-form-label { font-size: 10px; margin-bottom: 1px; line-height: 1.1; }
            .ptl-card-econ-compact input[type="text"],
            .ptl-card-econ-compact input[type="number"] {
              font-size: 11px;
              height: 22px;
              padding: 0 6px;
              line-height: 1.05;
            }
            .ptl-card-econ-compact .ptl-card-title { margin-bottom: 4px; }
          </style>
          <div class="ptl-card-title">Datos económicos</div>
          <div class="ptl-form-grid">
            ${inp("pto_total", comu.pto_total, { type: "number", formato: "euros", col: 12, label: "PTO total (€)", readonly: roPrevisto })}
            ${inp("tiempo_previsto", comu.tiempo_previsto, { type: "number", formato: "dias", col: 4, label: "Tiempo previsto (días/cuadrilla × 2)", readonly: roPrevisto })}
            ${inp("tiempo_real",     comu.tiempo_real,     { type: "number", formato: "dias", col: 4, label: "Tiempo real (días/cuadrilla × 2)", readonly: roReal })}
            <div class="col-4">
              <label class="ptl-form-label">Desvío tiempo</label>
              <input type="text" name="tiempo_desvio" id="f_tiempo_desvio" readonly class="calc-field campo-pct" value="${esc(comu.tiempo_desvio || '')}"/>
            </div>
            ${inp("mano_obra_previsto", comu.mano_obra_previsto, { type: "number", formato: "euros", col: 4, label: "Mano de obra previsto", readonly: roPrevisto })}
            ${inp("mano_obra_real",     comu.mano_obra_real,     { type: "number", formato: "euros", col: 8, label: "Mano de obra real", readonly: roReal })}
            ${inp("material_previsto",  comu.material_previsto,  { type: "number", formato: "euros", col: 4, label: "Material previsto", readonly: roPrevisto })}
            ${inp("material_real",      comu.material_real,      { type: "number", formato: "euros", col: 8, label: "Material real", readonly: roReal })}
            <div class="col-4">
              <label class="ptl-form-label">Beneficio previsto</label>
              <input type="text" name="beneficio_previsto" id="f_ben_prev" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_previsto || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Beneficio real</label>
              <input type="text" name="beneficio_real" id="f_ben_real" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_real || '')}"/>
            </div>
            <div class="col-4">
              <label class="ptl-form-label">Desvío beneficio</label>
              <input type="text" name="beneficio_desvio" id="f_ben_desv" readonly class="calc-field campo-euros" value="${esc(comu.beneficio_desvio || '')}"/>
            </div>
          </div>
        </div>` : ''}
      </form>

      ${extraHtmlFinal}

      <script>
        // Saneamiento global: elimina acentos y caracteres no ASCII en cualquier input[type=email].
        // Mantiene el cursor lo más cerca posible de su posición original.
        document.querySelectorAll('input[type="email"]').forEach(el => {
          el.addEventListener('input', () => {
            const before = el.value;
            const sanitized = before
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
              .replace(/[^A-Za-z0-9._%+\-@]/g, ''); // quita cualquier carácter raro
            if (sanitized !== before) {
              const pos = el.selectionStart - (before.length - sanitized.length);
              el.value = sanitized;
              try { el.setSelectionRange(pos, pos); } catch(e) {}
            }
          });
        });
        const ptlForm = document.getElementById('ptl-ficha-form');
        const ptlId = ptlForm.dataset.id;
        const ptlPill = document.getElementById('ptl-save-pill');
        const ptlOrig = ${expDataJson};
        const ptlHist = [];
        let ptlIntercept = true;

        // ============================================================
        // AUTOCOMPLETE CUSTOM (sustituye al <datalist> nativo)
        // Filtra por SUBSTRING (no solo prefijo), insensible a tildes/mayúsc.
        // ============================================================
        const ptlAcData = ${acDataJson};
        function ptlNormStr(s) {
          return String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
        }
        function ptlAcInit(input) {
          if (!input || input.dataset.acReady) return;
          input.dataset.acReady = "1";
          const wrap = input.closest('.ptl-ac-wrap');
          if (!wrap) return;
          const opciones = ptlAcData[input.dataset.ac] || [];
          // Crear lista
          const lista = document.createElement('div');
          lista.className = 'ptl-ac-list';
          wrap.appendChild(lista);
          let activeIdx = -1;
          function render(filtro) {
            const f = ptlNormStr(filtro);
            const matches = !f
              ? opciones.slice(0, 20)
              : opciones.filter(o => ptlNormStr(o).includes(f)).slice(0, 30);
            if (matches.length === 0) {
              lista.innerHTML = '<div class="ptl-ac-empty">Sin coincidencias (puedes escribir un valor nuevo)</div>';
              lista.classList.add('show');
              activeIdx = -1;
              return;
            }
            lista.innerHTML = matches.map((o, i) => {
              // Resaltar el match
              let html = ptlEscHtml(o);
              if (f) {
                const idx = ptlNormStr(o).indexOf(f);
                if (idx !== -1) {
                  const before = ptlEscHtml(o.substring(0, idx));
                  const match  = ptlEscHtml(o.substring(idx, idx + filtro.length));
                  const after  = ptlEscHtml(o.substring(idx + filtro.length));
                  html = before + '<mark>' + match + '</mark>' + after;
                }
              }
              return '<div class="ptl-ac-item" data-idx="'+i+'" data-val="'+ptlEscHtml(o)+'">'+html+'</div>';
            }).join('');
            lista.classList.add('show');
            activeIdx = -1;
          }
          function ocultar() { lista.classList.remove('show'); activeIdx = -1; }
          function elegir(val) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            ocultar();
            // Disparar blur lógico (autocomplete admin → rellenar tel/email)
            input.dispatchEvent(new Event('blur', { bubbles: true }));
          }

          input.addEventListener('focus', () => render(input.value));
          input.addEventListener('input', () => render(input.value));
          input.addEventListener('keydown', (ev) => {
            const items = lista.querySelectorAll('.ptl-ac-item');
            if (ev.key === 'ArrowDown') {
              ev.preventDefault();
              activeIdx = Math.min(activeIdx + 1, items.length - 1);
              items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
              if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (ev.key === 'ArrowUp') {
              ev.preventDefault();
              activeIdx = Math.max(activeIdx - 1, 0);
              items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
              if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (ev.key === 'Enter' || ev.key === 'Tab') {
              if (activeIdx >= 0 && items[activeIdx]) {
                ev.preventDefault();
                elegir(items[activeIdx].dataset.val);
              } else if (items.length === 1) {
                // Si solo hay 1 sugerencia, Tab/Enter la elige
                ev.preventDefault();
                elegir(items[0].dataset.val);
              } else {
                ocultar();
              }
            } else if (ev.key === 'Escape') {
              ocultar();
            }
          });
          lista.addEventListener('mousedown', (ev) => {
            const item = ev.target.closest('.ptl-ac-item');
            if (item) { ev.preventDefault(); elegir(item.dataset.val); }
          });
          // Cerrar al hacer click fuera
          document.addEventListener('click', (ev) => {
            if (!wrap.contains(ev.target)) ocultar();
          });
        }
        function ptlEscHtml(s) {
          return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
        }
        // Inicializar todos los inputs con data-ac
        ptlForm.querySelectorAll('input[data-ac]').forEach(ptlAcInit);

        // Helpers de formato numérico (definidos arriba para usarlos en ptlValor)
        function ptlNum(s) {
          if (s == null) return null;
          let txt = String(s).trim();
          if (!txt) return null;
          txt = txt.replace(/€|\\s/g, '');
          if (txt.indexOf('.') !== -1 && txt.indexOf(',') !== -1) {
            txt = txt.replace(/\\./g, '').replace(',', '.');
          } else {
            txt = txt.replace(',', '.');
          }
          const v = parseFloat(txt);
          return isNaN(v) ? null : v;
        }
        function ptlFmtEuros(s) {
          const v = ptlNum(s);
          if (v == null) return '';
          return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) + ' €';
        }
        function ptlFmtDias(s) {
          const v = ptlNum(s);
          if (v == null) return '';
          return v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true });
        }
        function ptlValorPlano(s) {
          const v = ptlNum(s);
          return v == null ? '' : String(v);
        }

        function ptlSetPill(estado, txt) { if (!ptlPill) return; ptlPill.className = 'ptl-save-pill ' + estado; ptlPill.textContent = txt; }
        function ptlValor(name) {
          const el = ptlForm.querySelector('[name="'+name+'"]');
          if (!el) return '';
          // Si es euros, días o teléfono → guardamos valor plano (sin formato)
          if (el.classList.contains('campo-euros') || el.classList.contains('campo-dias')) {
            return ptlValorPlano(el.value);
          }
          if (el.classList.contains('campo-tlf')) {
            // Devolver en el MISMO formato que fmtTlf usa para ptlOrig:
            // 9 dígitos formateados como "XXX-XXX-XXX". Si no hay 9 dígitos
            // limpios, devolvemos el valor tal cual (no podemos formatear).
            // Esto evita falsos diffs entre lo mostrado y lo guardado.
            let d = String(el.value).replace(/\\D/g, '');
            if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
            if (d.length === 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
            return el.value;
          }
          return el.value;
        }
        function ptlDiff() {
          const d = {};
          for (const k of Object.keys(ptlOrig)) {
            const el = ptlForm.querySelector('[name="'+k+'"]');
            // v17.80 — FIX falso positivo + borrado de datos. Si el campo de la
            // foto (ptlOrig) NO tiene input en el formulario en esta fase, el
            // usuario NO ha podido tocarlo -> NO es un cambio. Hay que saltarlo.
            // Sin esta guarda, ptlValor(k) devolvía '' (input inexistente) y se
            // comparaba contra el valor real de la foto, marcando un cambio
            // fantasma; al "Guardar y salir" se escribía '' y se BORRABA el dato
            // (que pudo haberse puesto desde otra pantalla). Casos afectados:
            // notas_pto en fases 05-09/ZZ (sin caja Notas) y los económicos
            // pto_total/mano_obra/material/tiempo en fases 01-02 (sin caja Datos
            // económicos).
            if (!el) continue;
            const v = String(ptlValor(k) ?? '');
            const orig = String(ptlOrig[k] ?? '');
            // Comparación numérica SOLO para campos numéricos (euros, días).
            // No usar parseFloat en cualquier campo: una nota como "-09/04/26..."
            // parsea a -9 igual que "-09/04/26 + nuevo texto", y se perdería el cambio.
            const esNumerico = el && (el.classList.contains('campo-euros') || el.classList.contains('campo-dias'));
            if (esNumerico) {
              const vn = parseFloat(v), on = parseFloat(orig);
              if (!isNaN(vn) && !isNaN(on)) {
                if (vn !== on) d[k] = v;
              } else if (v !== orig) {
                d[k] = v;
              }
            } else if (v !== orig) {
              d[k] = v;
            }
          }
          return d;
        }
        function ptlActPill() {
          const n = Object.keys(ptlDiff()).length;
          if (n === 0) ptlSetPill('', 'Sin cambios');
          else ptlSetPill('saving', n + (n === 1 ? ' cambio sin guardar' : ' cambios sin guardar'));
        }
        function ptlActUndo() {
          // Botón Deshacer eliminado de la UI; función mantenida vacía
          // para no tocar el resto del flujo que la llama.
        }
        async function ptlGuardar() {
          const d = ptlDiff();
          if (Object.keys(d).length === 0) return true;
          const errores = [];
          for (const [campo, valor] of Object.entries(d)) {
            try {
              const fd = new URLSearchParams();
              fd.append('id', ptlId); fd.append('campo', campo); fd.append('valor', valor);
              // keepalive: la petición sobrevive aunque el navegador cambie de página inmediatamente.
              const r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd, keepalive: true });
              if (!r.ok) {
                let msg = 'HTTP '+r.status;
                try {
                  const j = await r.json();
                  if (j && j.error) msg = j.error;
                } catch (_) {
                  try { msg = await r.text(); } catch (__) {}
                }
                console.error('[ptlGuardar] '+campo+' →', r.status, msg);
                errores.push(campo+': '+msg);
              } else {
                ptlOrig[campo] = valor;
              }
            } catch (e) {
              console.error('[ptlGuardar] '+campo+' excepción:', e);
              errores.push(campo+': '+e.message);
            }
          }
          if (errores.length > 0) {
            ptlSetPill('error', '✕ Error');
            alert('NO se guardaron los siguientes cambios:\\n\\n• '+errores.join('\\n• ')+'\\n\\nRevise la consola (F12) para más detalle.');
            return false;
          }
          ptlSetPill('saved', '✓ Guardado');
          return true;
        }
        // v17.74 — Feedback de guardado por campo (recuadro verde 5s al OK /
        // rojo permanente al fallo hasta el siguiente OK del mismo campo).
        // Usa las clases compartidas .ptl-guardado-ok / .ptl-guardado-error de
        // estilo-visual.cjs v1.15. Localiza el input por su name. Reemplaza a la
        // píldora global como feedback visible principal (la píldora sigue por
        // dentro para el flujo "salir con cambios sin guardar").
        function ptlFlashGuardado(name, ok) {
          const el = ptlForm.querySelector('[name="'+name+'"]');
          if (!el) return;
          if (el._ptlFlashTimer) { clearTimeout(el._ptlFlashTimer); el._ptlFlashTimer = null; }
          el.classList.remove('ptl-guardado-ok', 'ptl-guardado-error');
          if (ok) {
            el.classList.add('ptl-guardado-ok');
            el._ptlFlashTimer = setTimeout(function(){
              el.classList.remove('ptl-guardado-ok');
              el._ptlFlashTimer = null;
            }, 5000);
          } else {
            el.classList.add('ptl-guardado-error');
            // Sin timer: rojo permanente hasta el siguiente guardado OK del campo.
          }
        }
        // Guardar UN solo campo. Se llama desde ptlOnCambio (blur).
        // Devuelve true si OK, false si falló. Actualiza ptlOrig[name] si OK.
        async function ptlGuardarCampo(name, valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId); fd.append('campo', name); fd.append('valor', valor);
            const r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!r.ok) {
              let msg = 'HTTP '+r.status;
              try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) {
                try { msg = await r.text(); } catch (__) {}
              }
              console.error('[ptlGuardarCampo] '+name+' →', r.status, msg);
              ptlSetPill('error', '✕ Error guardando '+name);
              ptlFlashGuardado(name, false);
              return false;
            }
            ptlOrig[name] = valor;
            ptlSetPill('saved', '✓ Guardado');
            ptlFlashGuardado(name, true);
            return true;
          } catch (e) {
            console.error('[ptlGuardarCampo] '+name+' excepción:', e);
            ptlSetPill('error', '✕ Error de red');
            ptlFlashGuardado(name, false);
            return false;
          }
        }
        function ptlOnCambio(ev) {
          const el = ev.target; const name = el.name;
          if (!name) return;
          const newV = el.value, oldV = el.dataset.orig || '';
          if (newV === oldV) return;
          ptlHist.push({ name, oldVal: oldV, newVal: newV });
          el.dataset.orig = newV;
          ptlActUndo(); ptlActPill();
          // Guardar inmediatamente este campo (sin esperar a salir de la ficha).
          // El valor que mandamos es el VALOR CRUDO del campo, no ptlValor (que reformatea).
          // Para campos numéricos (euros, días) y teléfonos, reusamos ptlValor para enviar
          // el formato canónico que espera el servidor.
          let valorEnvio = newV;
          if (el.classList.contains('campo-euros') || el.classList.contains('campo-dias') || el.classList.contains('campo-tlf')) {
            valorEnvio = ptlValor(name);
          }
          ptlGuardarCampo(name, valorEnvio);
        }
        function ptlUndo() {
          if (ptlHist.length === 0) return;
          const c = ptlHist.pop();
          const el = ptlForm.querySelector('[name="'+c.name+'"]');
          if (el) { el.value = c.oldVal; el.dataset.orig = c.oldVal; el.focus(); }
          ptlActUndo(); ptlActPill();
        }
        ptlForm.querySelectorAll('input, textarea').forEach(el => {
          el.addEventListener('blur', ptlOnCambio);
          el.addEventListener('input', () => ptlActPill());
        });
        ptlForm.querySelectorAll('select').forEach(el => el.addEventListener('change', ptlOnCambio));

        document.addEventListener('click', async (ev) => {
          const a = ev.target.closest('a');
          if (!a || !ptlIntercept) return;
          if (Object.keys(ptlDiff()).length === 0) return;
          ev.preventDefault();
          const href = a.getAttribute('href');
          const r = confirm('Hay cambios sin guardar.\\n\\n  Aceptar = Guardar y salir\\n  Cancelar = Descartar y salir');
          if (r) {
            const ok = await ptlGuardar();
            if (!ok) {
              if (!confirm('No se pudo guardar todos los cambios. ¿Salir igualmente?')) return;
            }
          }
          ptlIntercept = false;
          window.location = href;
        }, true);
        window.addEventListener('beforeunload', (ev) => {
          if (window.ptlEliminando) return;
          if (window.ptlReloading) return;
          if (Object.keys(ptlDiff()).length > 0) { ev.preventDefault(); ev.returnValue = ''; }
        });
        document.querySelectorAll('form[action^="/presupuestos/expediente/"]').forEach(f => {
          // El form de descartar elimina el expediente — no tiene sentido avisar de cambios sin guardar
          if (f.getAttribute('action').includes('/descartar')) return;
          f.addEventListener('submit', async (ev) => {
            if (Object.keys(ptlDiff()).length > 0) {
              ev.preventDefault();
              const r = confirm('Hay cambios sin guardar.\\n\\n  Aceptar = Guardar y continuar\\n  Cancelar = Descartar y continuar');
              if (r) await ptlGuardar();
              ptlIntercept = false; f.submit();
            }
          });
        });

        // Formato teléfono (XXX-XXX-XXX, sin código de país)
        function ptlFmtTlf(s) {
          if (!s) return '';
          let d = String(s).replace(/\\D/g, '');
          if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
          if (d.length === 12 && d.startsWith('34')) d = d.slice(2);
          if (d.length === 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6,9);
          return s;
        }
        ptlForm.querySelectorAll('.campo-tlf').forEach(el => {
          el.addEventListener('blur', () => { const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; } });
          el.addEventListener('focus', () => { el.value = String(el.value).replace(/\\D/g, ''); });
          const f = ptlFmtTlf(el.value); if (f !== el.value) { el.value = f; el.dataset.orig = f; }
        });

        // Aplicar formato a campos de euros (editables y readonly)
        ptlForm.querySelectorAll('.campo-euros').forEach(el => {
          if (el.readOnly) {
            const f = ptlFmtEuros(el.value); if (f !== el.value) el.value = f;
            return;
          }
          el.addEventListener('focus', () => { const v = ptlNum(el.value); el.value = v == null ? '' : String(v).replace('.', ','); });
          el.addEventListener('blur',  () => { const f = ptlFmtEuros(el.value); el.value = f; el.dataset.orig = ptlValorPlano(f); });
          // Formateo inicial al cargar
          const f = ptlFmtEuros(el.value);
          if (f) { el.value = f; el.dataset.orig = ptlValorPlano(f); }
        });
        // Aplicar formato a campos de días
        ptlForm.querySelectorAll('.campo-dias').forEach(el => {
          if (el.readOnly) {
            const f = ptlFmtDias(el.value); if (f !== el.value) el.value = f;
            return;
          }
          el.addEventListener('focus', () => { const v = ptlNum(el.value); el.value = v == null ? '' : String(v).replace('.', ','); });
          el.addEventListener('blur',  () => { const f = ptlFmtDias(el.value); el.value = f; el.dataset.orig = ptlValorPlano(f); });
          const f = ptlFmtDias(el.value);
          if (f) { el.value = f; el.dataset.orig = ptlValorPlano(f); }
        });

        // Cálculos en vivo
        function n(name) { const el = ptlForm.querySelector('[name="'+name+'"]'); if (!el) return null; const v = ptlNum(el.value); return v; }
        function setCalc(id, val, fmt) {
          const el = document.getElementById(id);
          if (!el) return;
          if (val == null) { el.value = ''; return; }
          if (fmt === 'pct') el.value = (val * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }) + ' %';
          else el.value = val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) + ' €';
        }
        function recalc() {
          const tp = n('tiempo_previsto'), tr = n('tiempo_real');
          if (tp != null && tr != null && tp !== 0) setCalc('f_tiempo_desvio', 1 - (tr/tp), 'pct'); else setCalc('f_tiempo_desvio', null);
          const pto = n('pto_total');
          const mop = n('mano_obra_previsto'), mor = n('mano_obra_real');
          const map_ = n('material_previsto'), mar = n('material_real');
          const bp = (pto!=null && mop!=null && map_!=null) ? (pto - mop - map_ - 150) : null;
          const br = (pto!=null && mor!=null && mar!=null) ? (pto - mor - mar) : null;
          setCalc('f_ben_prev', bp); setCalc('f_ben_real', br);
          setCalc('f_ben_desv', (bp!=null && br!=null) ? (br - bp) : null);
        }
        ['tiempo_previsto','tiempo_real','pto_total','mano_obra_previsto','mano_obra_real','material_previsto','material_real']
          .forEach(name => { const el = ptlForm.querySelector('[name="'+name+'"]'); if (el) el.addEventListener('input', recalc); });
        recalc();

        // ============================================================
        // v17.54 — Handler reloj "Añadir a HOY" del expediente.
        // Hay dos botones .ptl-exp-reloj en la ficha:
        //   - En la esquina superior derecha del bloque NOTAS (replicado en v17.54).
        //   - En la fila "Comunidad de propietarios" de DATOS DOCUMENTACION
        //     (la renderiza documentacion.cjs, en pres.cjs solo si llegan los
        //     datos via app.locals.documentacion).
        // Al pulsar uno se actualizan ambos visualmente para que estén siempre
        // sincronizados (representan el mismo campo: comunidades.en_hoy).
        // El handler de documentacion.cjs hace lo mismo, así que cualquiera de
        // los dos puede inicializar el clic; pero registramos aquí para los
        // casos en que solo se renderiza el de NOTAS (módulo presupuestos puro).
        (function() {
          const styleOn  = 'background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold';
          const styleOff = 'background:transparent;color:#9CA3AF;border-color:#E5E7EB;filter:grayscale(1) opacity(0.5)';
          document.querySelectorAll('.ptl-exp-reloj').forEach(function(btn){
            // Evitamos doble-handler si documentacion.cjs ya lo ha enganchado.
            if (btn.dataset.relojBound === '1') return;
            btn.dataset.relojBound = '1';
            btn.addEventListener('click', async function(){
              var ccppId = btn.dataset.ccppId;
              var yaActivo = btn.dataset.enhoy === '1';
              var nuevoValor = yaActivo ? '' : '1';
              btn.disabled = true;
              try {
                var body = new URLSearchParams({ id: ccppId, campo: 'en_hoy', valor: nuevoValor });
                var r = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                  method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
                  body: body.toString()
                });
                if (!r.ok) {
                  var t = await r.text();
                  alert('Error: ' + t); btn.disabled = false; return;
                }
                // Sincronizar TODOS los .ptl-exp-reloj con el mismo ccpp_id.
                document.querySelectorAll('.ptl-exp-reloj[data-ccpp-id="' + ccppId + '"]').forEach(function(b){
                  b.dataset.enhoy = nuevoValor === '1' ? '1' : '0';
                  b.title = nuevoValor === '1' ? 'Quitar de HOY' : 'Añadir a HOY';
                  b.style.cssText = (nuevoValor === '1' ? styleOn : styleOff);
                });
                btn.disabled = false;
              } catch (e) {
                alert('Error de red: ' + e.message);
                btn.disabled = false;
              }
            });
          });
        })();

        // ============================================================
        // AUTOCOMPLETADO DE ADMINISTRADOR (nombre → tel + email)
        // ============================================================
        const ptlAdminInfo = ${adminInfoJson};
        const ptlCcppIdActual = ${JSON.stringify(ccppIdActual)};

        function ptlNormNombre(s) { return String(s || "").trim(); }
        function ptlBuscarAdmin(nombre) {
          const n = ptlNormNombre(nombre);
          if (!n) return null;
          // Coincidencia exacta primero
          if (ptlAdminInfo[n]) return Object.assign({ nombre: n }, ptlAdminInfo[n]);
          // Coincidencia case-insensitive
          const nl = n.toLowerCase();
          for (const k of Object.keys(ptlAdminInfo)) {
            if (k.toLowerCase() === nl) return Object.assign({ nombre: k }, ptlAdminInfo[k]);
          }
          return null;
        }

        const inpAdminNombre = ptlForm.querySelector('[name="administrador"]');
        const inpAdminTel    = ptlForm.querySelector('[name="telefono_administrador"]');
        const inpAdminEmail  = ptlForm.querySelector('[name="email_administrador"]');

        // Cuando el usuario sale del campo NOMBRE administrador y ese nombre existe en BD:
        // si tel o email están vacíos, los rellena automáticamente
        if (inpAdminNombre && inpAdminTel && inpAdminEmail) {
          inpAdminNombre.addEventListener('blur', () => {
            const found = ptlBuscarAdmin(inpAdminNombre.value);
            if (!found) return;
            // Asegurar que el nombre quede con la capitalización oficial de BD
            if (inpAdminNombre.value !== found.nombre) {
              inpAdminNombre.value = found.nombre;
              inpAdminNombre.dataset.orig = found.nombre;
            }
            // Si TEL vacío → rellenar
            if (!inpAdminTel.value.trim() && found.telefono) {
              const f = (typeof ptlFmtTlf === 'function') ? ptlFmtTlf(found.telefono) : found.telefono;
              inpAdminTel.value = f;
              inpAdminTel.dataset.orig = f;
              ptlActPill();
            }
            // Si EMAIL vacío → rellenar
            if (!inpAdminEmail.value.trim() && found.email) {
              inpAdminEmail.value = found.email;
              inpAdminEmail.dataset.orig = found.email;
              ptlActPill();
            }
          });

          // Cuando se cambia tel o email del admin, ofrecer propagar a otras CCPPs
          async function ptlPreguntarPropagarAdmin(campo) {
            const nombreAdmin = ptlNormNombre(inpAdminNombre.value);
            if (!nombreAdmin) return;
            const info = ptlAdminInfo[nombreAdmin];
            if (!info || !info.ccpps || info.ccpps.length <= 1) return;
            // Hay más CCPPs con este admin → preguntar
            const otras = info.ccpps.filter(x => x.ccpp_id !== ptlCcppIdActual);
            if (otras.length === 0) return;
            const nuevoValor = (campo === 'telefono')
              ? (typeof ptlValor === 'function' ? ptlValor('telefono_administrador') : inpAdminTel.value.replace(/\\D/g, ''))
              : inpAdminEmail.value.trim();
            const r = confirm(
              'Has cambiado el ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + nombreAdmin + '.\\n\\n' +
              'Este administrador está en ' + info.ccpps.length + ' CCPPs.\\n\\n' +
              '¿Aplicar el cambio en TODAS sus ' + info.ccpps.length + ' CCPPs?\\n\\n' +
              '  Aceptar = Actualizar todas\\n' +
              '  Cancelar = Solo en esta CCPP'
            );
            if (!r) return;
            // Llamar al endpoint de propagación
            try {
              const fd = new URLSearchParams();
              fd.append('nombre_admin', nombreAdmin);
              fd.append('campo', campo);
              fd.append('valor', nuevoValor);
              const resp = await fetch('${urlT(token, "/presupuestos/admin/actualizar")}', { method: 'POST', body: fd });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const data = await resp.json();
              alert('Actualizado ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + nombreAdmin + ' en ' + data.actualizadas + ' CCPPs.');
              // Actualizar también la cache local de ptlAdminInfo
              if (campo === 'telefono') ptlAdminInfo[nombreAdmin].telefono = nuevoValor;
              else ptlAdminInfo[nombreAdmin].email = nuevoValor;
            } catch (e) {
              alert('Error actualizando: ' + e.message);
            }
          }
          inpAdminTel.addEventListener('blur', () => {
            // Solo preguntar si el valor cambió respecto al original
            if (inpAdminTel.dataset.orig !== inpAdminTel.value) {
              setTimeout(() => ptlPreguntarPropagarAdmin('telefono'), 100);
            }
          });
          inpAdminEmail.addEventListener('blur', () => {
            if (inpAdminEmail.dataset.orig !== inpAdminEmail.value) {
              setTimeout(() => ptlPreguntarPropagarAdmin('email'), 100);
            }
          });
        }

        // ============================================================
        // MODAL ENVIAR MAIL (fase con plantilla)
        // v17.71: convertido en ventana flotante arrastrable (igual que
        // ptlComSendModal). Sin overlay translúcido; usa las clases
        // compartidas .ptl-floating-* de estilo-visual.cjs v1.14.
        // ============================================================
        function ptlCrearModalMailHtml() {
          if (document.getElementById('ptl-modal-mail')) return;
          const div = document.createElement('div');
          div.id = 'ptl-modal-mail';
          div.className = 'ptl-floating-wrapper';
          div.innerHTML = \`
            <div id="ptl-mm-box" class="ptl-floating-window" style="width:680px">
              <div id="ptl-mm-title" class="ptl-floating-title">
                <span id="ptl-mm-titulo" class="ptl-floating-title-text">📧 Enviar email</span>
                <button type="button" id="ptl-mm-cerrar" class="ptl-floating-close" title="Cerrar">✕</button>
              </div>
              <div class="ptl-floating-body">
                <div id="ptl-mm-aviso" style="display:none;padding:8px 12px;background:#FEF3C7;border-radius:6px;margin-bottom:12px;font-size:12px;color:#92400e"></div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Para <span style="color:#9ca3af;font-weight:normal">(varios separados por coma)</span></label>
                  <input id="ptl-mm-destinatario" type="text" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">CC <span style="color:#9ca3af;font-weight:normal">(con copia visible — vacío si no procede)</span></label>
                  <input id="ptl-mm-cc" type="text" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">CCO <span style="color:#9ca3af;font-weight:normal">(con copia oculta — separar con coma)</span></label>
                  <input id="ptl-mm-cco" type="text" placeholder="separar con coma" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Asunto</label>
                  <input id="ptl-mm-asunto" type="text" style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Mensaje</label>
                  <textarea id="ptl-mm-mensaje" rows="10" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Adjuntos (links de Drive, hasta 3)</label>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" style="flex:0 0 200px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj1url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                    </div>
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj2lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj2url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                    </div>
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj3lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj3url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                    </div>
                  </div>
                  <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:4px">
                    Los archivos se descargan de Drive y se adjuntan al mail. En el histórico solo se guardan los links.
                  </div>
                </div>
                <div id="ptl-mm-estado" style="font-size:11px;color:#6b7280;margin-top:8px"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb">
                  <button type="button" id="ptl-mm-saltar" class="ptl-btn ptl-btn-secondary ptl-btn-sm" style="display:none;margin-right:auto">→ Saltar envío</button>
                  <button type="button" id="ptl-mm-cancelar" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
                  <button type="button" id="ptl-mm-enviar" class="ptl-btn ptl-btn-primary ptl-btn-sm">📧 Confirmar envío</button>
                </div>
              </div>
            </div>
          \`;
          document.body.appendChild(div);
          const cerrarBtn = document.getElementById('ptl-mm-cerrar');
          document.getElementById('ptl-mm-cerrar').addEventListener('click', ptlCerrarModalMail);
          document.getElementById('ptl-mm-cancelar').addEventListener('click', ptlCerrarModalMail);
          // v17.71: drag&drop arrastrable; NO se cierra al pulsar fuera (no hay overlay).
          window.ptlMakeDraggable(
            document.getElementById('ptl-mm-box'),
            document.getElementById('ptl-mm-title'),
            cerrarBtn
          );
        }
        function ptlCerrarModalMail() {
          const m = document.getElementById('ptl-modal-mail');
          if (m) m.style.display = 'none';
        }
        async function ptlAbrirModalMail(fase, ccppId, opts) {
          opts = opts || {};
          const esReenvio = !!opts.reenvio;
          ptlCrearModalMailHtml();
          const m = document.getElementById('ptl-modal-mail');
          m.style.display = 'block';
          // v17.71: centramos la ventana en el viewport tras mostrarla.
          window.ptlCentrarVentana(document.getElementById('ptl-mm-box'));
          // Limpiar
          document.getElementById('ptl-mm-aviso').style.display = 'none';
          document.getElementById('ptl-mm-asunto').value = 'Cargando...';
          document.getElementById('ptl-mm-mensaje').value = '';
          document.getElementById('ptl-mm-destinatario').value = '';
          document.getElementById('ptl-mm-cc').value = '';
          document.getElementById('ptl-mm-cco').value = '';
          ['ptl-mm-adj1lbl','ptl-mm-adj1url','ptl-mm-adj2lbl','ptl-mm-adj2url','ptl-mm-adj3lbl','ptl-mm-adj3url']
            .forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
          document.getElementById('ptl-mm-estado').textContent = '';
          // Cargar plantilla del servidor
          try {
            const r = await fetch('${urlT(token, "/presupuestos/plantilla-mail")}&fase=' + encodeURIComponent(fase) + '&id=' + encodeURIComponent(ccppId));
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              alert('Error: ' + (err.error || ('HTTP ' + r.status)));
              ptlCerrarModalMail();
              return;
            }
            const data = await r.json();
            document.getElementById('ptl-mm-titulo').textContent = esReenvio
              ? '📧 Reenviar presupuesto revisado'
              : '📧 Email · Fase ' + fase;
            document.getElementById('ptl-mm-destinatario').value = data.destinatario.email || '';
            document.getElementById('ptl-mm-cc').value = data.destinatario.cc || '';
            document.getElementById('ptl-mm-asunto').value = data.plantilla.asunto || '';
            document.getElementById('ptl-mm-mensaje').value = data.plantilla.mensaje || '';
            // Repartir adjuntos_fijos en las 3 filas Etiqueta+URL. Se guía SOLO
            // por la presencia de http(s): si el trozo NO tiene URL es una etiqueta
            // sola (recordatorio para pegar el link al enviar) -> va al campo Etiqueta,
            // tal cual (conservando los ':' si los tuviera). Si tiene URL, se separa
            // la etiqueta (quitando el ': ' separador previo) de la URL.
            // Acepta separación por " || " o por saltos de línea.
            (function(){
              var partes = String(data.plantilla.adjuntos_fijos || '')
                .split(/\\s*\\|\\|\\s*|[\\r\\n]+/).map(function(s){ return s.trim(); }).filter(Boolean);
              for (var i = 0; i < 3; i++) {
                var lblEl = document.getElementById('ptl-mm-adj' + (i+1) + 'lbl');
                var urlEl = document.getElementById('ptl-mm-adj' + (i+1) + 'url');
                if (!lblEl || !urlEl) continue;
                var p = partes[i] || '';
                if (!p) { lblEl.value = ''; urlEl.value = ''; continue; }
                var idx = p.search(/https?:\\/\\//);
                if (idx === -1) {
                  // Sin URL -> etiqueta sola (recordatorio), tal cual.
                  lblEl.value = p; urlEl.value = '';
                } else {
                  urlEl.value = p.slice(idx).trim();
                  lblEl.value = p.slice(0, idx).replace(/:\\s*$/, '').trim();
                }
              }
            })();
            const enviados = data.estado.enviados || 0;
            const max = data.plantilla.max_envios || 0;
            const stEl = document.getElementById('ptl-mm-estado');
            if (max > 0) {
              // 'enviados' aquí es el total (manuales + automáticos). Para el
              // primer envío manual de la fase será 0. max_envios es el tope
              // de reenvíos automáticos. Mostramos info útil sin mezclar.
              if (enviados === 0) {
                stEl.textContent = 'Primer envío de la fase. Tras enviarlo, el cron mandará hasta ' + max + ' reenvíos automáticos.';
              } else {
                stEl.textContent = 'Envíos previos en esta fase: ' + enviados + '. Tope de reenvíos automáticos: ' + max + '.';
              }
              if (enviados + 1 >= max && fase === '03_ENVIO_PTO') {
                const aviso = document.getElementById('ptl-mm-aviso');
                aviso.style.display = 'block';
                aviso.innerHTML = 'ℹ Al confirmar el envío, el expediente pasará automáticamente a <strong>04-ACEPTACION PTO</strong>.';
              }
            } else {
              stEl.textContent = 'Envíos previos: ' + enviados + '.';
            }
            // Si no hay destinatario, avisar
            if (!data.destinatario.email) {
              const aviso = document.getElementById('ptl-mm-aviso');
              aviso.style.display = 'block';
              aviso.textContent = '⚠ Esta CCPP no tiene email de administrador ni de presidente configurado. Añade al menos uno en la ficha antes de enviar.';
            }
            // Botón "Saltar envío" — visible en todas las fases de envío que provocan avance
            // (excepto en reenvío de fase 04, que no avanza).
            const btnSaltar = document.getElementById('ptl-mm-saltar');
            const fasesSaltables = ['02_PTE_VISITA_CON_ACTA','02_PTE_VISITA_SIN_ACTA','03_ENVIO_PTO','05_ACEPTACION_PTO','05_FIN_DOC','08_INICIO_CYCP'];
            if (fasesSaltables.includes(fase) && !esReenvio) {
              btnSaltar.style.display = 'inline-flex';
              btnSaltar.onclick = async () => {
                if (!confirm('¿Avanzar a la siguiente fase sin enviar el mail desde el sistema?\\n\\nSe asume que ya enviaste el mail por otra vía (WhatsApp, teléfono, etc).\\n\\nEl expediente avanzará a la siguiente fase.')) return;
                btnSaltar.disabled = true; btnSaltar.textContent = 'Avanzando...';
                try {
                  const fd = new URLSearchParams();
                  fd.append('id', ccppId);
                  fd.append('fase', fase);
                  fd.append('skip', '1');
                  const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                  const dd = await resp.json();
                  if (!resp.ok) throw new Error(dd.error || 'HTTP ' + resp.status);
                  alert('→ Expediente avanzado sin envío de mail.');
                  ptlCerrarModalMail();
                  window.ptlReloading = true;
                  window.location.reload();
                } catch (e) {
                  alert('Error: ' + e.message);
                  btnSaltar.disabled = false; btnSaltar.textContent = '→ Saltar envío';
                }
              };
            } else {
              btnSaltar.style.display = 'none';
            }
            // Botón confirmar
            const btn = document.getElementById('ptl-mm-enviar');
            if (esReenvio) btn.textContent = '📧 Confirmar reenvío';
            btn.onclick = async () => {
              btn.disabled = true; btn.textContent = esReenvio ? 'Reenviando...' : 'Enviando...';
              try {
                const fd = new URLSearchParams();
                fd.append('id', ccppId);
                fd.append('fase', fase);
                fd.append('destinatario', document.getElementById('ptl-mm-destinatario').value);
                fd.append('cc', document.getElementById('ptl-mm-cc').value);
                fd.append('cco', document.getElementById('ptl-mm-cco').value);
                fd.append('asunto', document.getElementById('ptl-mm-asunto').value);
                fd.append('mensaje', document.getElementById('ptl-mm-mensaje').value);
                // Adjuntos: 3 filas Etiqueta+URL -> "LABEL: url || LABEL: url"
                // (mismo formato que el modal de mail manual).
                var _adjs = [];
                for (var _i = 1; _i <= 3; _i++) {
                  var _lbl = (document.getElementById('ptl-mm-adj' + _i + 'lbl').value || '').trim();
                  var _url = (document.getElementById('ptl-mm-adj' + _i + 'url').value || '').trim();
                  if (_url) _adjs.push((_lbl || 'ADJUNTO_' + _i) + ': ' + _url);
                }
                fd.append('adjuntos', _adjs.join(' || '));
                fd.append('tipo', esReenvio ? 'reenvio_fase04' : 'manual_inicial');
                if (esReenvio) fd.append('reenvio', '1');
                const resp = await fetch('${urlT(token, "/presupuestos/expediente/enviar-mail")}', { method: 'POST', body: fd });
                const dd = await resp.json();
                if (!resp.ok) throw new Error(dd.error || 'HTTP ' + resp.status);
                let msg;
                if (esReenvio) {
                  msg = '✓ Presupuesto reenviado.\\n\\nCuenta como un nuevo envío manual. El cron arranca el ciclo de reenvíos automáticos desde cero.';
                } else {
                  msg = '✓ Email enviado.';
                  if (dd.avanzado) {
                    msg += '\\n\\n→ Expediente avanzado a 04-ACEPTACION PTO.';
                  } else if (dd.avanzadoA05) {
                    msg += '\\n\\n→ Expediente avanzado a 05-DOCUMENTACION.';
                  } else if (fase === '01_CONTACTO') {
                    msg += '\\n\\nEl sistema gestionará los reenvíos automáticos.';
                  }
                }
                alert(msg);
                ptlCerrarModalMail();
                // Si avanzó a 05, redirigir al módulo de documentación
                if (dd.avanzadoA05) {
                  const ccppId = '${esc(comu.ccpp_id)}';
                  window.location.href = '${urlT(token, "/documentacion/expediente")}&id=' + encodeURIComponent(ccppId);
                  return;
                }
                // Recargar quitando flags creado/reactivado para que no vuelva a preguntar
                const url = new URL(window.location.href);
                url.searchParams.delete('creado');
                url.searchParams.delete('reactivado');
                window.location.href = url.toString();
              } catch (e) {
                alert('Error: ' + e.message);
                btn.disabled = false; btn.textContent = '📧 Confirmar envío';
              }
            };
          } catch (e) {
            alert('Error cargando plantilla: ' + e.message);
            ptlCerrarModalMail();
          }
        }
        // Exponer globalmente para usar desde onclick="..."
        window.ptlAbrirModalMail = ptlAbrirModalMail;

        // Mini-diálogo "¿Recibimos mail con acta?" antes de abrir el modal
        // del mail de paso a fase 02. Según lo que pulse el usuario, se abre
        // el modal con la plantilla 02_PTE_VISITA_CON_ACTA o 02_PTE_VISITA_SIN_ACTA.
        window.ptlPreguntarActaPaso02 = function(ccppId) {
          // Si ya hay un diálogo abierto, ignorar
          if (document.getElementById('ptl-dlg-acta')) return;
          const dlg = document.createElement('div');
          dlg.id = 'ptl-dlg-acta';
          dlg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px';
          dlg.innerHTML = \`
            <div style="background:white;border-radius:10px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);padding:20px">
              <h3 style="margin:0 0 14px;font-size:16px;color:#111827">¿Recibimos mail con acta?</h3>
              <p style="margin:0 0 18px;font-size:13px;color:#4b5563;line-height:1.4">
                Selecciona la plantilla a enviar según hayan adjuntado el acta de la asamblea o no.
              </p>
              <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
                <button type="button" id="ptl-dlg-acta-cancel" class="ptl-btn ptl-btn-secondary ptl-btn-sm">Cancelar</button>
                <button type="button" id="ptl-dlg-acta-sin"    class="ptl-btn ptl-btn-secondary ptl-btn-sm">Sin acta</button>
                <button type="button" id="ptl-dlg-acta-con"    class="ptl-btn ptl-btn-primary ptl-btn-sm">Con acta</button>
              </div>
            </div>
          \`;
          document.body.appendChild(dlg);
          function cerrar() { const d = document.getElementById('ptl-dlg-acta'); if (d) d.remove(); }
          dlg.addEventListener('click', ev => { if (ev.target === dlg) cerrar(); });
          document.getElementById('ptl-dlg-acta-cancel').onclick = cerrar;
          document.getElementById('ptl-dlg-acta-con').onclick = () => {
            cerrar();
            window.ptlAbrirModalMail('02_PTE_VISITA_CON_ACTA', ccppId);
          };
          document.getElementById('ptl-dlg-acta-sin').onclick = () => {
            cerrar();
            window.ptlAbrirModalMail('02_PTE_VISITA_SIN_ACTA', ccppId);
          };
        };

        // Validación previa al envío de fase 03: comprueba que los 4 campos económicos
        // previstos estén rellenos. Si falta alguno, pide confirmación. Si el usuario
        // confirma, abre el modal. Si cancela, vuelve a la pantalla a rellenar.
        window.ptlIntentarEnviarFase03 = function(fase, ccppId) {
          const requeridos = [
            { name: 'pto_total',          label: 'PTO TOTAL' },
            { name: 'tiempo_previsto',    label: 'TIEMPO PREVISTO' },
            { name: 'mano_obra_previsto', label: 'MANO DE OBRA PREVISTO' },
            { name: 'material_previsto',  label: 'MATERIAL PREVISTO' },
          ];
          const faltan = [];
          for (const r of requeridos) {
            const el = ptlForm.querySelector('input[name="' + r.name + '"]');
            const v = (el && el.value || '').trim();
            if (!v) faltan.push(r.label);
          }
          if (faltan.length > 0) {
            const msg = 'No se han rellenado todos los datos económicos previstos:\\n\\n  • ' + faltan.join('\\n  • ') + '\\n\\n¿Continuar a fase 04 igualmente?';
            if (!confirm(msg)) return;
          }
          ptlAbrirModalMail(fase, ccppId);
        };

        // Sincroniza el mini-input "FECHA VISITA" de la barra de acciones con el campo
        // principal del formulario (fecha_visita). Así reutiliza el sistema de
        // "guardar al cambiar" que ya existe (ptlMarcarCambios + autosave).
        window.ptlSyncFechaVisita = function(valor) {
          const main = ptlForm.querySelector('input[name="fecha_visita"]');
          if (!main) return;
          main.value = valor;
          // Disparar el evento que recalcula el diff y guarda
          main.dispatchEvent(new Event('input', { bubbles: true }));
          main.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Sincronización de la fecha de visita EMASESA (fase 06).
        // No usa el sistema del formulario (la columna no aparece como input
        // editable en el form). Hace una llamada al endpoint /campo directamente.
        window.ptlSyncFechaVisitaEmasesa = async function(valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId);
            fd.append('campo', 'fecha_visita_emasesa');
            fd.append('valor', valor || '');
            const resp = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              alert('Error guardando fecha: ' + (err.error || resp.status));
            }
          } catch (e) {
            alert('Error guardando fecha: ' + e.message);
          }
        };

        // Sincronización de la fecha "Próximo mail manual" (fase 04).
        // No usa el sistema del formulario (porque la columna no aparece como input
        // editable en el form). Hace una llamada al endpoint /campo directamente.
        window.ptlSyncFechaProximoMail = async function(valor) {
          try {
            const fd = new URLSearchParams();
            fd.append('id', ptlId);
            fd.append('campo', 'fecha_proximo_mail_manual');
            fd.append('valor', valor || '');
            const resp = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', { method: 'POST', body: fd });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              alert('Error guardando próxima fecha: ' + (err.error || resp.status));
            }
          } catch (e) {
            alert('Error guardando próxima fecha: ' + e.message);
          }
        };

        // Reenviar presupuesto desde fase 04: valida los 4 económicos previstos y abre el modal.
        // El modal usa la plantilla "envio_pto" (la misma que en fase 03).
        // Al confirmar el envío, el endpoint /enviar-mail con flag reenvio=1 hace:
        //   - Actualiza fecha_ultimo_reenvio_pto = hoy
        //   - Resetea fecha_ultimo_seguimiento_pto = hoy
        //   - Borra contador de mails fase 04 y fecha_proximo_mail_manual
        //   - Registra en histórico
        window.ptlIntentarReenviarFase04 = function(ccppId) {
          const requeridos = [
            { name: 'pto_total',          label: 'PTO TOTAL' },
            { name: 'tiempo_previsto',    label: 'TIEMPO PREVISTO' },
            { name: 'mano_obra_previsto', label: 'MANO DE OBRA PREVISTO' },
            { name: 'material_previsto',  label: 'MATERIAL PREVISTO' },
          ];
          const faltan = [];
          for (const r of requeridos) {
            const el = ptlForm.querySelector('input[name="' + r.name + '"]');
            const v = (el && el.value || '').trim();
            if (!v) faltan.push(r.label);
          }
          if (faltan.length > 0) {
            const msg = 'No se han rellenado todos los datos económicos previstos:\\n\\n  • ' + faltan.join('\\n  • ') + '\\n\\n¿Continuar con el reenvío igualmente?';
            if (!confirm(msg)) return;
          }
          // Abre el modal con la fase '04_REENVIO' (plantilla exclusiva del reenvío de fase 04)
          // y le pasa el flag reenvio para que el endpoint sepa qué hacer (no avanza fase, etc.).
          ptlAbrirModalMail('04_REENVIO', ccppId, { reenvio: true });
        };

        // Retroceder a fase anterior: única confirmación con conservar/borrar datos.
        //   Aceptar  = conservar | Cancelar = borrar (vuelta limpia)
        window.ptlRetroceder = function(ccppId, labelAnt) {
          const conservar = confirm(
            'Volver a ' + labelAnt + '.\\n\\n' +
            'Datos de la fase actual (fechas y contadores de mails de esa fase):\\n\\n' +
            '  • Aceptar  = CONSERVAR los datos (se quedan por si avanzas otra vez)\\n' +
            '  • Cancelar = BORRARLOS (vuelta limpia)'
          );
          const form = document.getElementById('ptlFormRetroceder_' + ccppId);
          if (!form) { alert('Error: formulario no encontrado'); return; }
          form.querySelector('input[name="conservar"]').value = conservar ? '1' : '0';
          form.submit();
        };

        // Si el expediente acaba de crearse o reactivarse, preguntar si activar envíos automáticos.
        // v17.73: (Bug A) se limpia el flag creado/reactivado de la URL ANTES de preguntar, con
        // history.replaceState, para que el aviso se muestre UNA sola vez. Antes el flag se quedaba
        // pegado si se cancelaba, y cualquier recarga posterior (avanzar de fase, reloj, Ctrl+F5)
        // lo re-disparaba en fases donde no aplica (p.ej. 02_VISITA). (Bug B) se pasa la fase REAL
        // (${esc(fase)}, que tras crear/reactivar siempre es 01_CONTACTO) en vez de comu.fase, que
        // no existe como propiedad (valía undefined -> fallback 'fase' -> el modal no cargaba plantilla).
        ${reciencreado ? `
        setTimeout(() => {
          const _u = new URL(window.location.href);
          _u.searchParams.delete('creado');
          _u.searchParams.delete('reactivado');
          history.replaceState(null, '', _u.toString());
          if (confirm('¿Activar envíos automáticos?\\n\\nSe enviará ahora el primer email solicitando aprobación del presupuesto, y a partir de ahí el sistema gestionará los envíos según las reglas de la plantilla.')) {
            ptlAbrirModalMail('${esc(fase)}', '${esc(comu.ccpp_id)}');
          }
        }, 300);
        ` : ''}
      </script>
    `;
  }

  // (BLOQUE ELIMINADO) — La cajita de vecinos y el badge de estado vecino se
  // trasladan a documentacion.cjs.

  // =================================================================
  // VISTA: NUEVO EXPEDIENTE
  // =================================================================
  function vistaNuevo(error, token, tiposVia, admins, presis, calles, direccionPrev) {
    const acDataNuevoJson = JSON.stringify({
      tipos:  tiposVia || [],
      admins: admins || [],
      presis: presis || [],
      calles: calles || [],
    }).replace(/</g, "\\u003c");
    const dirVal = esc(direccionPrev || "");
    return `
      <h1 style="font-size:22px;font-weight:700;margin-bottom:14px">+ Nuevo expediente</h1>
      ${error ? `<div class="ptl-next-action urgent"><div class="ico">⚠</div><div class="text">${esc(error)}</div></div>` : ''}
      <form method="POST" action="${urlT(token, "/presupuestos/nuevo")}" id="ptl-form-nuevo">
        <div class="ptl-card">
          <div class="ptl-card-title">Datos de la nueva CCPP</div>
          <div class="ptl-form-grid">
            <div class="col-2"><label class="ptl-form-label">Tipo vía</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" autofocus placeholder="C" value="" autocomplete="off"/>
              </div>
            </div>
            <div class="col-8"><label class="ptl-form-label">Dirección *</label>
              <div class="ptl-ac-wrap">
                <input name="direccion" data-ac="calles" required placeholder="Ej. Doctor Fedriani 39" value="${dirVal}" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Earth</label>
              <select name="earth"><option value="NO">No</option><option value="SI">Sí</option></select>
            </div>
          </div>
          <div class="ptl-form-section-title">Administrador</div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Nombre</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_administrador" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_administrador" type="email"/></div>
          </div>
          <div class="ptl-form-section-title">Presidente</div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Nombre</label>
              <input name="presidente" autocomplete="off"/>
            </div>
            <div class="col-2"><label class="ptl-form-label">Teléfono</label><input name="telefono_presidente" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_presidente" type="email"/></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="submit" class="ptl-btn ptl-btn-primary">Crear expediente</button>
          <a href="${urlT(token, "/presupuestos")}" class="ptl-btn ptl-btn-secondary">Cancelar</a>
        </div>
      </form>
      <script>
        // Saneamiento global: elimina acentos en inputs email
        document.querySelectorAll('input[type="email"]').forEach(el => {
          el.addEventListener('input', () => {
            const before = el.value;
            const sanitized = before
              .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
              .replace(/[^A-Za-z0-9._%+\\-@]/g, '');
            if (sanitized !== before) {
              const pos = el.selectionStart - (before.length - sanitized.length);
              el.value = sanitized;
              try { el.setSelectionRange(pos, pos); } catch(e) {}
            }
          });
        });
        (function() {
          const form = document.getElementById('ptl-form-nuevo');
          if (!form) return;
          const acData = ${acDataNuevoJson};
          function normStr(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); }
          function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
          form.querySelectorAll('input[data-ac]').forEach(input => {
            const wrap = input.closest('.ptl-ac-wrap');
            if (!wrap) return;
            const opciones = acData[input.dataset.ac] || [];
            const lista = document.createElement('div');
            lista.className = 'ptl-ac-list';
            wrap.appendChild(lista);
            let activeIdx = -1;
            function render(filtro) {
              const f = normStr(filtro);
              const matches = !f
                ? opciones.slice(0, 20)
                : opciones.filter(o => normStr(o).includes(f)).slice(0, 30);
              if (matches.length === 0) {
                lista.innerHTML = '<div class="ptl-ac-empty">Sin coincidencias (puedes escribir un valor nuevo)</div>';
                lista.classList.add('show');
                activeIdx = -1;
                return;
              }
              lista.innerHTML = matches.map((o, i) => {
                let html = escHtml(o);
                if (f) {
                  const idx = normStr(o).indexOf(f);
                  if (idx !== -1) {
                    const before = escHtml(o.substring(0, idx));
                    const match  = escHtml(o.substring(idx, idx + filtro.length));
                    const after  = escHtml(o.substring(idx + filtro.length));
                    html = before + '<mark>' + match + '</mark>' + after;
                  }
                }
                return '<div class="ptl-ac-item" data-idx="'+i+'" data-val="'+escHtml(o)+'">'+html+'</div>';
              }).join('');
              lista.classList.add('show');
              activeIdx = -1;
            }
            function ocultar() { lista.classList.remove('show'); activeIdx = -1; }
            function elegir(val) {
              // Si es el campo dirección, añadimos un espacio para que el usuario siga escribiendo el número
              if (input.dataset.ac === 'calles') {
                input.value = val + ' ';
                input.focus();
                // Mover cursor al final
                const len = input.value.length;
                input.setSelectionRange(len, len);
              } else {
                input.value = val;
              }
              ocultar();
            }
            input.addEventListener('focus', () => render(input.value));
            input.addEventListener('input', () => render(input.value));
            input.addEventListener('keydown', (ev) => {
              const items = lista.querySelectorAll('.ptl-ac-item');
              if (ev.key === 'ArrowDown') { ev.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('active', i === activeIdx)); if (items[activeIdx]) items[activeIdx].scrollIntoView({block:'nearest'}); }
              else if (ev.key === 'ArrowUp') { ev.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('active', i === activeIdx)); if (items[activeIdx]) items[activeIdx].scrollIntoView({block:'nearest'}); }
              else if (ev.key === 'Enter' || ev.key === 'Tab') {
                if (activeIdx >= 0 && items[activeIdx]) { ev.preventDefault(); elegir(items[activeIdx].dataset.val); }
                else if (items.length === 1) { ev.preventDefault(); elegir(items[0].dataset.val); }
                else { ocultar(); }
              }
              else if (ev.key === 'Escape') ocultar();
            });
            lista.addEventListener('mousedown', (ev) => {
              const item = ev.target.closest('.ptl-ac-item');
              if (item) { ev.preventDefault(); elegir(item.dataset.val); }
            });
            document.addEventListener('click', (ev) => { if (!wrap.contains(ev.target)) ocultar(); });
          });
        })();
      </script>
    `;
  }

  // =================================================================
  // VISTA: PLANTILLAS DE MAIL (editor)
  // =================================================================
  function vistaPlantillas(plantillas, token, cuentas, pieGlobal) {
    const tarjetas = plantillas.map(p => {
      // Separar adjuntos_fijos en _adjunto_1, _adjunto_2, _adjunto_3 para el formulario
      const partes = String(p.adjuntos_fijos || "").split("||");
      p._adjunto_1 = (partes[0] || "").trim();
      p._adjunto_2 = (partes[1] || "").trim();
      p._adjunto_3 = (partes[2] || "").trim();
      // Lo mismo para CCO: separar en _cco_1, _cco_2, _cco_3
      const partesCco = String(p.cco || "").split("||");
      p._cco_1 = (partesCco[0] || "").trim();
      p._cco_2 = (partesCco[1] || "").trim();
      p._cco_3 = (partesCco[2] || "").trim();
      const fase = p.fase;
      const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
      const nombre = nombrePlantillaAmigable(fase);
      const activoChecked = p.activo ? 'checked' : '';
      const cuentasList = Array.isArray(cuentas) ? cuentas : [];
      const cuentaSel = (p.cuenta_envio || "").trim();
      const optsCuenta = cuentasList.length === 0
        ? '<option value="">— No hay cuentas configuradas en mail_cuentas —</option>'
        : '<option value="">— Selecciona una cuenta —</option>' +
          cuentasList.map(c => `<option value="${esc(c.id)}" ${c.id === cuentaSel ? 'selected' : ''}>${esc(c.id)} (${esc(c.email)})</option>`).join('');
      // Descripción del disparador (qué desencadena el envío de esta plantilla)
      const DESCR_PLANTILLA = {
        "01_CONTACTO":             'Envío manual al pulsar "📧 Activar mail automático" en fase 01.',
        "02_PTE_VISITA_CON_ACTA":  'Envío manual al pulsar "→ Paso a 02-VISITA" en fase 01 cuando han enviado el acta de la asamblea.',
        "02_PTE_VISITA_SIN_ACTA":  'Envío manual al pulsar "→ Paso a 02-VISITA" en fase 01 cuando NO han enviado el acta (la respuesta vale como interés).',
        "03_ENVIO_PTO":            'Envío manual al pulsar "📧 Enviar presupuesto" en fase 03.',
        "04_ACEPTACION_PTO":  'Envío automático de seguimiento al pulsar "📧 Enviar presupuesto" en fase 03.',
        "04_REENVIO":         'Envío manual al pulsar "📧 Reenviar presupuesto revisado" en fase 04.',
        "05_ACEPTACION_PTO":  'Envío manual al pulsar "✓ ACEPTADO" en fase 04.',
        "05_SEGUIMIENTO_DOC": 'Envío automático de seguimiento al pulsar "✓ ACEPTADO" en fase 04.',
        "05_FIN_DOC":         'Envío manual al pulsar "→ Paso a 06-VISITA EMASESA" en fase 05.',
        "08_INICIO_CYCP":     'Envío manual al pulsar "→ Paso a 08-CYCP" en fase 07.',
        "08_SEGUIMIENTO_CYCP":'Envío automático de seguimiento al pulsar "→ Paso a 08-CYCP" en fase 07.',
        "08_FIN_CYCP":        'Envío manual al pulsar "✓ Cerrar fase 08-CYCP" en fase 08.',
      };
      const descripcion = DESCR_PLANTILLA[fase] || "";
      return `
        <div class="ptl-card ptl-acordeon" data-fase="${esc(fase)}" style="margin-bottom:4px">
          <div class="ptl-acordeon-cab" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha" style="display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)">▶</span>
                <span>📧 Fase ${esc(nombre)}</span>
              </div>
              ${descripcion ? `<div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">${esc(descripcion)}</div>` : ""}
            </div>
            <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-right:12px;flex-shrink:0" onclick="event.stopPropagation()">
              <input type="checkbox" class="ptl-acordeon-activa-chk" ${activoChecked}/>
              <span><strong>Activa</strong></span>
            </label>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="display:none;margin:6px 12px 6px 0;flex-shrink:0">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar")}" class="ptl-acordeon-cuerpo" style="display:none;padding:6px 8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="fase" value="${esc(fase)}"/>
            <input type="checkbox" name="activo" value="SI" class="ptl-acordeon-activa-real" ${activoChecked} style="display:none"/>

            <label style="font-size:13px;display:block;margin-bottom:3px">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Enviar desde</div>
              <select name="cuenta_envio" class="ptl-input-sm" style="width:100%">
                ${optsCuenta}
              </select>
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:3px">
              <label style="font-size:13px">
                <div style="margin-bottom:0;font-weight:600;line-height:1.2">Días para primer envío</div>
                <input type="number" name="dias_primer_envio" value="${p.dias_primer_envio || 0}" min="0" max="365"
                  class="ptl-input-sm" style="width:100%"/>
              </label>
              <label style="font-size:13px">
                <div style="margin-bottom:0;font-weight:600;line-height:1.2">Días entre envíos</div>
                <input type="number" name="dias_recurrente" value="${p.dias_recurrente || 0}" min="0" max="365"
                  class="ptl-input-sm" style="width:100%"/>
                <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:0;line-height:1.15">0 = sin reenvíos automáticos</div>
              </label>
              <label style="font-size:13px">
                <div style="margin-bottom:0;font-weight:600;line-height:1.2">Máximo de envíos</div>
                <input type="number" name="max_envios" value="${p.max_envios || 1}" min="1" max="10"
                  class="ptl-input-sm" style="width:100%"/>
                <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:0;line-height:1.15">Tope de reenvíos automáticos (al alcanzarlo el cron para y avisa al admin)</div>
              </label>
            </div>

            <label style="font-size:13px;display:block;margin-bottom:3px">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Asunto del email</div>
              <input type="text" name="asunto" value="${esc(p.asunto || '')}" maxlength="200" required
                class="ptl-input-sm" style="width:100%"/>
            </label>

            <label style="font-size:13px;display:block;margin-bottom:3px">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Cuerpo del mensaje</div>
              <textarea name="mensaje" rows="8" maxlength="5000" required
                style="width:100%;padding:4px 5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;line-height:1.35">${esc(p.mensaje || '')}</textarea>
              <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:0;line-height:1.15">Texto literal — destinatarios: administrador (To) y presidente (CC) — los que estén configurados</div>
            </label>

            <div style="margin-bottom:0;font-weight:600;font-size:13px;line-height:1.2">CCO (con copia oculta) — opcional</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:3px">
              <input type="email" name="cco_1" value="${esc(p._cco_1 || '')}" maxlength="200"
                placeholder="email CCO 1"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
              <input type="email" name="cco_2" value="${esc(p._cco_2 || '')}" maxlength="200"
                placeholder="email CCO 2"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
              <input type="email" name="cco_3" value="${esc(p._cco_3 || '')}" maxlength="200"
                placeholder="email CCO 3"
                pattern="[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}"
                class="ptl-input-sm"/>
            </div>

            <div style="margin-bottom:0;font-weight:600;font-size:13px;line-height:1.2">Adjuntos fijos (opcional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <input type="text" name="adjunto_1" value="${esc(p._adjunto_1 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
              <input type="text" name="adjunto_2" value="${esc(p._adjunto_2 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
              <input type="text" name="adjunto_3" value="${esc(p._adjunto_3 || '')}" maxlength="500"
                placeholder="Título: https://..."
                class="ptl-input-sm"/>
            </div>
          </form>
        </div>
      `;
    }).join("");

    return `
      <div style="max-width:880px;margin:0 auto;padding:14px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">⚙ Plantillas de mail</h1>
        <p style="color:var(--ptl-gray-600);font-size:13px;margin-bottom:4px">
          Configura aquí los textos de los emails y las reglas de envío automático para cada fase.
          Los cambios se aplican inmediatamente — no hay que reiniciar nada.
        </p>
        ${tarjetas}

        <div class="ptl-card ptl-acordeon" data-fase="_PIE_GLOBAL" style="margin-bottom:4px;border-color:var(--ptl-gray-300)">
          <div class="ptl-acordeon-cab" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha" style="display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)">▶</span>
                <span>📝 Pie de página global</span>
              </div>
              <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que se añadirá al final de TODOS los mails (después del cuerpo y los adjuntos).</div>
            </div>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="display:none;margin:6px 12px 6px 0;flex-shrink:0">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas/guardar-pie-global")}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <textarea name="pie_global" rows="5" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(pieGlobal || "")}</textarea>
          </form>
        </div>

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:12px">
          Los datos se guardan en la pestaña <code>mail_plantillas</code> del Sheet.
        </div>

        <script>
          (function(){
            // Acordeón de plantillas: clic en cabecera para abrir/cerrar.
            // El botón "Guardar" solo se muestra cuando la plantilla está abierta.
            document.querySelectorAll('.ptl-acordeon').forEach(function(card){
              var cab     = card.querySelector('.ptl-acordeon-cab');
              var cuerpo  = card.querySelector('.ptl-acordeon-cuerpo');
              var flecha  = card.querySelector('.ptl-acordeon-flecha');
              var btnGuardar = card.querySelector('.ptl-acordeon-guardar');
              var chkVisible = card.querySelector('.ptl-acordeon-activa-chk');
              var chkReal    = card.querySelector('.ptl-acordeon-activa-real');
              if (!cab || !cuerpo || !flecha || !btnGuardar) return;

              function toggle(forzarAbierto){
                var abierto = (forzarAbierto !== undefined) ? forzarAbierto : (cuerpo.style.display === 'none');
                cuerpo.style.display = abierto ? 'block' : 'none';
                flecha.textContent = abierto ? '▼' : '▶';
                btnGuardar.style.display = abierto ? 'inline-block' : 'none';
              }

              cab.addEventListener('click', function(e){
                if (e.target.closest('.ptl-acordeon-guardar')) return;
                if (e.target.closest('.ptl-acordeon-activa')) return;
                toggle();
              });

              btnGuardar.addEventListener('click', function(){
                cuerpo.requestSubmit ? cuerpo.requestSubmit() : cuerpo.submit();
              });

              // Sincronizar el checkbox visible con el oculto del form (es el que se envía).
              if (chkVisible && chkReal) {
                chkVisible.addEventListener('change', function(){
                  chkReal.checked = chkVisible.checked;
                });
              }
            });
          })();
        </script>
      </div>
    `;
  }

  // =================================================================
  // VISTA: pantalla de plantillas de DOCUMENTOS (v17.82)
  // Calcada en estética a vistaPlantillas (mail): acordeones que se
  // despliegan al hacer clic, con su botón "Guardar". Diferencias:
  //  - cada documento solo tiene TÍTULO + CUERPO (sin asunto/días/cuenta)
  //  - NO hay interruptor "Activa" (la selección se hace al imprimir)
  //  - hay DOS cajas especiales: encabezado general (arriba) y pie (abajo)
  // Reutiliza las MISMAS clases .ptl-acordeon* y el MISMO script de toggle
  // que la pantalla de mail.
  // =================================================================
  function vistaPlantillasDoc(plantillas, token) {
    // Reparte: encabezado, pie y el resto (cuerpos de documento) en su orden.
    const encab = plantillas.find(p => p.clave === "_ENCABEZADO_GLOBAL");
    const pie   = plantillas.find(p => p.clave === "_PIE_GLOBAL");
    const cuerpos = plantillas.filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL");

    const tarjetas = cuerpos.map(p => {
      const clave  = p.clave;
      const titulo = p.titulo || clave;
      return `
        <div class="ptl-card ptl-acordeon" data-clave="${esc(clave)}" style="margin-bottom:4px">
          <div class="ptl-acordeon-cab" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha" style="display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)">▶</span>
                <span>📄 ${esc(titulo)}</span>
              </div>
            </div>
            <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="display:none;margin:6px 12px 6px 0;flex-shrink:0">💾 Guardar</button>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo" style="display:none;padding:6px 8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="clave" value="${esc(clave)}"/>

            <label style="font-size:13px;display:block;margin-bottom:6px">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Título</div>
              <input type="text" name="titulo" value="${esc(p.titulo || "")}" class="ptl-input-sm" style="width:100%"/>
            </label>

            <label style="font-size:13px;display:block">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Cuerpo del documento</div>
              <textarea name="cuerpo" rows="8" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(p.cuerpo || "")}</textarea>
            </label>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:4px 0 0 0">
              Los huecos entre corchetes (por ejemplo <code>[propietario]</code>, <code>[comunidad]</code>) se rellenarán al generar el documento.
            </div>
          </form>
        </div>
      `;
    }).join("");

    // Caja especial: ENCABEZADO GENERAL (arriba)
    const cajaEncab = `
      <div class="ptl-card ptl-acordeon" data-clave="_ENCABEZADO_GLOBAL" style="margin-bottom:4px;border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0">
          <div style="flex:1;min-width:0">
            <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
              <span class="ptl-acordeon-flecha" style="display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)">▶</span>
              <span>📝 Encabezado general</span>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que aparecerá al PRINCIPIO de TODOS los documentos (antes del cuerpo).</div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="display:none;margin:6px 12px 6px 0;flex-shrink:0">💾 Guardar</button>
        </div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
          <input type="hidden" name="clave" value="_ENCABEZADO_GLOBAL"/>
          <input type="hidden" name="titulo" value="${esc(encab ? encab.titulo : "Encabezado general")}"/>
          <textarea name="cuerpo" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(encab ? encab.cuerpo : "")}</textarea>
        </form>
      </div>
    `;

    // Caja especial: PIE GENERAL (abajo)
    const cajaPie = `
      <div class="ptl-card ptl-acordeon" data-clave="_PIE_GLOBAL" style="margin-bottom:4px;border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:0">
          <div style="flex:1;min-width:0">
            <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
              <span class="ptl-acordeon-flecha" style="display:inline-block;transition:transform 0.15s;font-size:11px;color:var(--ptl-gray-500)">▶</span>
              <span>📝 Pie general</span>
            </div>
            <div style="font-size:11px;color:var(--ptl-gray-500);padding:0 12px 6px 30px">Texto que aparecerá al FINAL de TODOS los documentos (después del cuerpo). El hueco <code>[fecha]</code> se rellena solo con la fecha de hoy.</div>
          </div>
          <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="display:none;margin:6px 12px 6px 0;flex-shrink:0">💾 Guardar</button>
        </div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-doc/guardar")}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
          <input type="hidden" name="clave" value="_PIE_GLOBAL"/>
          <input type="hidden" name="titulo" value="${esc(pie ? pie.titulo : "Pie general")}"/>
          <textarea name="cuerpo" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(pie ? pie.cuerpo : "")}</textarea>
        </form>
      </div>
    `;

    return `
      <div style="max-width:760px;margin:0 auto;padding:8px">
        <h2 style="font-size:18px;margin:8px 0 4px">📄 Plantillas de documentos</h2>
        <p style="font-size:13px;color:var(--ptl-gray-500);margin:0 0 12px">
          Aquí editas los textos de los documentos de EMASESA. El <strong>encabezado</strong> y el <strong>pie</strong> son comunes a todos; cada documento tiene su propio <strong>cuerpo</strong>.
          Los cambios se aplican inmediatamente — no hay que reiniciar nada.
        </p>
        ${cajaEncab}
        ${tarjetas}
        ${cajaPie}

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:12px">
          Los datos se guardan en la pestaña <code>doc_plantillas</code> del Sheet.
        </div>

        <script>
          (function(){
            // Acordeón: clic en cabecera abre/cierra; "Guardar" solo visible si está abierto.
            document.querySelectorAll('.ptl-acordeon').forEach(function(card){
              var cab     = card.querySelector('.ptl-acordeon-cab');
              var cuerpo  = card.querySelector('.ptl-acordeon-cuerpo');
              var flecha  = card.querySelector('.ptl-acordeon-flecha');
              var btnGuardar = card.querySelector('.ptl-acordeon-guardar');
              if (!cab || !cuerpo || !flecha || !btnGuardar) return;

              function toggle(forzarAbierto){
                var abierto = (forzarAbierto !== undefined) ? forzarAbierto : (cuerpo.style.display === 'none');
                cuerpo.style.display = abierto ? 'block' : 'none';
                flecha.textContent = abierto ? '▼' : '▶';
                btnGuardar.style.display = abierto ? 'inline-block' : 'none';
              }

              cab.addEventListener('click', function(e){
                if (e.target.closest('.ptl-acordeon-guardar')) return;
                toggle();
              });

              btnGuardar.addEventListener('click', function(){
                cuerpo.requestSubmit ? cuerpo.requestSubmit() : cuerpo.submit();
              });
            });
          })();
        </script>
      </div>
    `;
  }

  // =================================================================
  // Extrae el "nombre de calle" de una dirección quitando el número/escalera del final.
  // Ejemplos:
  //   "Alberche 17"          → "Alberche"
  //   "Alberche 6C"          → "Alberche"
  //   "Doctor Marañón 11, esc. A" → "Doctor Marañón"
  //   "Estrella Aldebaran 4" → "Estrella Aldebaran"
  //   "Plaza España s/n"     → "Plaza España"
  function extraerNombreCalle(direccion) {
    if (!direccion) return "";
    let s = String(direccion).trim();
    if (!s) return "";
    // Cortar por la primera coma (todo lo que viene después suele ser escalera/portal/etc)
    const comaIdx = s.indexOf(",");
    if (comaIdx > 0) s = s.slice(0, comaIdx).trim();
    // Quitar tokens del final mientras contengan dígitos o sean palabras tipo s/n, esc, bloque, portal, bis
    const tokens = s.split(/\s+/);
    const palabrasNumericas = /^(s\/n|s\.n\.|esc\.?|escalera|bloque|portal|bis|nº|nro\.?|num\.?|num)$/i;
    while (tokens.length > 1) {
      const ult = tokens[tokens.length - 1];
      if (/\d/.test(ult) || palabrasNumericas.test(ult)) {
        tokens.pop();
      } else {
        break;
      }
    }
    return tokens.join(" ").trim();
  }

  function construirDatalists(comunidades) {
    const admins = new Set(), presis = new Set(), tiposVia = new Set(), calles = new Set();
    // adminInfo: { "Nombre Admin": { telefono: "...", email: "...", ccpps: [{ ccpp_id, direccion }, ...] } }
    const adminInfo = {};
    comunidades.forEach(c => {
      if (c.administrador && String(c.administrador).trim()) {
        const nombre = String(c.administrador).trim();
        admins.add(nombre);
        if (!adminInfo[nombre]) {
          adminInfo[nombre] = { telefono: "", email: "", ccpps: [] };
        }
        // El primer telefono/email no vacío que encontremos se queda como "el del admin"
        if (!adminInfo[nombre].telefono && c.telefono_administrador) {
          adminInfo[nombre].telefono = String(c.telefono_administrador).trim();
        }
        if (!adminInfo[nombre].email && c.email_administrador) {
          adminInfo[nombre].email = String(c.email_administrador).trim();
        }
        adminInfo[nombre].ccpps.push({ ccpp_id: c.ccpp_id, direccion: c.direccion || c.comunidad });
      }
      if (c.presidente && String(c.presidente).trim()) presis.add(String(c.presidente).trim());
      if (c.tipo_via && String(c.tipo_via).trim()) tiposVia.add(String(c.tipo_via).trim());
      // Extraer nombre de calle (sin número/escalera)
      const calle = extraerNombreCalle(c.direccion);
      if (calle) calles.add(calle);
    });
    return {
      admins: [...admins].sort(),
      presis: [...presis].sort(),
      tiposVia: [...tiposVia].sort(),
      calles: [...calles].sort(),
      adminInfo,
    };
  }

  // =================================================================
  // GUARD: ADMIN_TOKEN (igual que index.cjs)
  // =================================================================
  function checkToken(req, res) {
    const token = req.query.token;
    if (!process.env.ADMIN_TOKEN) {
      // Si no hay ADMIN_TOKEN definido en el entorno, permitir acceso (modo dev)
      return true;
    }
    if (!validToken(token)) {
      res.status(403).type("text/plain").send("No autorizado. Añade ?token=TUTOKEN a la URL.");
      return false;
    }
    return true;
  }

  // =================================================================
  // RUTAS HTTP
  // =================================================================

  // GET /presupuestos — listado
  app.get("/presupuestos", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const comunidades = await leerComunidades();
      const html = pageHtml("Presupuestos",
        [{ label: "Presupuestos", url: "#" }],
        await vistaListado(comunidades, req.query, token),
        token);
      sendHtml(res, html);
    } catch (e) {
      console.error("[presupuestos] /presupuestos error:", e.message);
      sendError(res, "Error cargando presupuestos: " + e.message);
    }
  });

  // GET /presupuestos/nuevo — formulario nuevo
  app.get("/presupuestos/nuevo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    let tiposVia = ["C", "Av", "Bª", "Pz", "Pza", "Rª", "Ur", "Cm", "Pje", "Bda", "Crta"];
    let admins = [], presis = [], calles = [];
    try {
      const comunidades = await leerComunidades();
      const dl = construirDatalists(comunidades);
      const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
      tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
      admins = dl.admins;
      presis = dl.presis;
      calles = dl.calles;
    } catch (e) {
      console.warn("[presupuestos] no se pudieron leer datos:", e.message);
    }
    sendHtml(res, pageHtml("Nuevo expediente",
      [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
      vistaNuevo(req.query.error || "", token, tiposVia, admins, presis, calles, req.query.dir || ""),
      token));
  });

  // POST /presupuestos/nuevo — crear (con validación de duplicado)
  app.post("/presupuestos/nuevo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    const errPage = (mensaje, datos) => {
      // Recargar listas para reconstruir el formulario
      return (async () => {
        let tiposVia = ["C", "Av", "Bª", "Pz", "Pza", "Rª", "Ur"];
        let admins = [], presis = [], calles = [];
        try {
          const comunidades = await leerComunidades();
          const dl = construirDatalists(comunidades);
          const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
          tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
          admins = dl.admins; presis = dl.presis; calles = dl.calles;
        } catch (e) {}
        sendHtml(res, pageHtml("Nuevo expediente",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
          vistaNuevo(mensaje, token, tiposVia, admins, presis, calles, datos),
          token));
      })();
    };
    try {
      const dir = String(req.body.direccion || "").trim();
      if (!dir) {
        return errPage("La dirección es obligatoria", "");
      }
      // Validar duplicado: comparar normalizado (insensible a tildes/mayúsculas y espacios extra)
      const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      const dirNorm = norm(dir);
      const comunidades = await leerComunidades();
      const duplicado = comunidades.find(c => norm(c.direccion) === dirNorm);
      if (duplicado) {
        return errPage(`Ya existe un expediente con la dirección "${duplicado.direccion}". Cambia la dirección (añade número, escalera, portal, etc.) para diferenciarlo.`, dir);
      }
      // Validación de emails (sin acentos, formato correcto)
      const emailAdmin = String(req.body.email_administrador || "").trim();
      const emailPresi = String(req.body.email_presidente || "").trim();
      if (!esEmailValido(emailAdmin)) {
        return errPage(`Email del administrador no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld`, dir);
      }
      if (!esEmailValido(emailPresi)) {
        return errPage(`Email del presidente no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld`, dir);
      }
      const datos = {
        comunidad: dir,                    // Auto-rellenado con la dirección
        direccion: dir,
        tipo_via: req.body.tipo_via || "",
        earth: req.body.earth || "NO",
        administrador: req.body.administrador || "",
        telefono_administrador: String(req.body.telefono_administrador || "").replace(/\D/g, ""),
        email_administrador: emailAdmin,
        presidente: req.body.presidente || "",
        telefono_presidente: String(req.body.telefono_presidente || "").replace(/\D/g, ""),
        email_presidente: emailPresi,
        fase_presupuesto: "01_CONTACTO",
        fecha_contacto: new Date().toISOString().slice(0, 10),
      };
      await crearComunidad(datos);
      // Crear carpeta del expediente en Drive (no bloqueante).
      try {
        await getOrCreateCarpetaExpediente(datos.tipo_via, datos.direccion);
      } catch (errDrive) {
        console.error("[presupuestos] Error creando carpeta Drive (no bloquea creación expediente):", errDrive.message);
      }
      res.redirect(urlT(token, "/presupuestos/expediente", { id: ccppId(dir), creado: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /nuevo:", e.message);
      sendError(res, "Error creando: " + e.message);
    }
  });

  // GET /presupuestos/expediente?id=...
  app.get("/presupuestos/expediente", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const id = req.query.id;
      const comunidades = await leerComunidades();
      const comu = comunidades.find(c => c.ccpp_id === id);
      if (!comu) {
        return sendHtml(res, pageHtml("No encontrado",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "—", url: "#" }],
          `<div class="ptl-empty"><h3>Expediente no encontrado</h3></div>`,
          token));
      }
      // Si el CCPP ya está en una fase del módulo documentación, redirigir allí.
      // v17.52: excepción si vienen accion_mail + mid (clic en ↩/↪ desde HOY):
      // la ficha de presupuestos es la única que tiene listado de
      // comunicaciones con el modal de responder/reenviar, así que la
      // renderizamos aunque la CCPP esté en fase 05+. El auto-disparo abrirá
      // el modal y al guardar/cancelar el usuario navegará normalmente.
      const faseActual = normalizarFase(comu.fase_presupuesto);
      // v17.65: también redirigimos en 09_TRAMITADA para que se inyecte la tabla DATOS DOCUMENTACION.
      if ((FASES_DOCUMENTACION.includes(faseActual) || faseActual === "09_TRAMITADA") && !req.query.accion_mail) {
        return res.redirect(urlT(token, "/documentacion/expediente", { id }));
      }
      const datalists = construirDatalists(comunidades);
      const titulo = comu.direccion || comu.comunidad || "Expediente";
      const labelExp = `${comu.tipo_via || ''} ${titulo}`.trim();
      const reciencreado = req.query.creado === "1" || req.query.reactivado === "1";
      const cabecera = renderCabeceraComun(token, comunidades);
      sendHtml(res, pageHtml(titulo,
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        cabecera + (await vistaFicha(comu, datalists, token, reciencreado)),
        token));
    } catch (e) {
      console.error("[presupuestos] /expediente:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/campo — auto-guardado de un campo
  app.post("/presupuestos/expediente/campo", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const campo = req.body.campo;
      let valor = req.body.valor;
      if (!COLS.includes(campo)) return res.status(400).send("Campo no permitido");
      // Numéricos
      const numericos = new Set(["pto_total","mano_obra_previsto","mano_obra_real",
        "material_previsto","material_real","beneficio_previsto","beneficio_real","beneficio_desvio",
        "tiempo_previsto","tiempo_real","tiempo_desvio"]);
      if (numericos.has(campo)) {
        if (valor === "" || valor == null) valor = "";
        else {
          // v17.38 BUG 1: parser robusto formato ES.
          // El caso normal: el cliente (ptlValorPlano) envía un número plano "1234.56" o
          // un número nativo. Pero si por cualquier vía llega "1.234,56" (formato ES con
          // separador de miles + decimal con coma), el parseFloat ingenuo lo trunca a 1.23.
          // Aplicamos la misma lógica que ptlNum del frontend:
          //   - si hay '.' y ',' → quitar puntos (miles) y cambiar coma por punto
          //   - si solo hay coma → cambiarla por punto
          //   - si solo hay puntos → dejarlos (es decimal o entero ya correcto)
          let txt = String(valor).trim().replace(/€|\s/g, "");
          if (txt.indexOf('.') !== -1 && txt.indexOf(',') !== -1) {
            txt = txt.replace(/\./g, '').replace(',', '.');
          } else {
            txt = txt.replace(',', '.');
          }
          const n = parseFloat(txt);
          if (isNaN(n)) {
            valor = "";
          } else {
            // v17.38 BUG 3: validación de rango razonable. Evita el caso Diego Puerta
            // donde se coló tiempo_previsto = 16298.1 por error de tecleo, sin que nada
            // saltara. Rangos amplios pensados para no entorpecer trabajo legítimo.
            const RANGOS = {
              pto_total:           [0, 500000],
              mano_obra_previsto:  [0, 500000],
              mano_obra_real:      [0, 500000],
              material_previsto:   [0, 500000],
              material_real:       [0, 500000],
              beneficio_previsto:  [-50000, 500000],
              beneficio_real:      [-50000, 500000],
              beneficio_desvio:    [-500000, 500000],
              tiempo_previsto:     [0, 365],
              tiempo_real:         [0, 365],
              tiempo_desvio:       [-1, 1],
            };
            const r = RANGOS[campo];
            if (r && (n < r[0] || n > r[1])) {
              return res.status(400).json({
                error: `Valor fuera de rango para ${campo}: ${n}. Rango permitido: ${r[0]} a ${r[1]}. ` +
                       `Si quieres meter ese valor de verdad, avisa para ampliar el rango.`
              });
            }
            valor = n;
          }
        }
      }
      // Teléfonos: solo dígitos
      if (campo === "telefono_administrador" || campo === "telefono_presidente") {
        valor = String(valor || "").replace(/\D/g, "");
      }
      // Emails: validar formato (sin acentos, sin espacios)
      if (campo === "email_administrador" || campo === "email_presidente") {
        valor = String(valor || "").trim();
        if (!esEmailValido(valor)) {
          return res.status(400).json({ error: "Email no válido. No debe contener acentos ni espacios y debe seguir el formato usuario@dominio.tld" });
        }
      }
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      // v17.79 — Guardado de UN campo suelto: usar actualizarCampoComunidad, que
      // escribe SOLO esa celda y RELEE para verificar (lanza error si no cuajó).
      // Antes usaba actualizarComunidad (reescribía la fila entera, sin verificar):
      // por eso un campo podía salir verde en el front pero no quedar en el Sheet.
      // Los guardados que cambian VARIOS campos a la vez (avance de fase, cron, etc.)
      // siguen usando actualizarComunidad (pendiente: blindarlos en una 2ª fase).
      await actualizarCampoComunidad(comu._rowIndex, campo, valor);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /campo:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.52: POST /presupuestos/piso/toggle-hoy
  // Body: { ccpp_id, vivienda }
  // Alterna en_hoy del piso entre "1" y "". Side-effect: si pasa a "1" y el
  // expediente padre no tiene en_hoy="1", lo activa también (regla: activar un
  // piso obliga a activar su expediente para que aparezca en HOY como cabecera).
  // Quitar un piso NO desactiva al expediente padre (el padre puede seguir
  // estando activo por sí mismo o por otros pisos).
  app.post("/presupuestos/piso/toggle-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      // Leer el valor actual de en_hoy para alternarlo
      const sheets = getSheetsClient();
      const cab = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "pisos!1:1" });
      const hdr = (cab.data.values && cab.data.values[0]) || [];
      const idxEnHoy = hdr.indexOf("en_hoy");
      if (idxEnHoy < 0) return res.status(500).json({ error: "Columna 'en_hoy' no encontrada en pisos (¿añadida al Sheet?)" });
      const letra = (() => {
        let s = "", n = idxEnHoy + 1;
        while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
        return s;
      })();
      const cellRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `pisos!${letra}${rowIdx}` });
      const valorActual = ((cellRes.data.values || [[]])[0] || [])[0] || "";
      const nuevoValor = String(valorActual).trim() === "1" ? "" : "1";
      await _actualizarCampoPiso(rowIdx, "en_hoy", nuevoValor);
      // Si encendemos un piso y el expediente padre no estaba en HOY, lo activamos.
      if (nuevoValor === "1" && String(comu.en_hoy || "").trim() !== "1") {
        comu.en_hoy = "1";
        try {
          await actualizarComunidad(comu._rowIndex, comu);
        } catch (e) {
          console.warn("[piso/toggle-hoy] no se pudo activar expediente padre:", e.message);
        }
      }
      res.json({ ok: true, en_hoy: nuevoValor });
    } catch (e) {
      console.error("[presupuestos] /piso/toggle-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.52: POST /presupuestos/piso/guardar-notas-hoy
  // Body: { ccpp_id, vivienda, notas }
  // Guarda notas_piso para un piso concreto. Llamado en blur desde la caja
  // "Expedientes en HOY" cuando el usuario edita las notas inline.
  app.post("/presupuestos/piso/guardar-notas-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const notas = String(req.body.notas == null ? "" : req.body.notas);
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "notas_piso", notas);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /piso/guardar-notas-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // v17.67: POST /presupuestos/piso/guardar-nota-simple
  // Body: { ccpp_id, vivienda, nota_simple }
  // Guarda nota_simple (columna D de pestaña pisos) para un piso concreto.
  // Usado desde el acordeón de la fila piso en DATOS DOCUMENTACION
  // (documentacion.cjs v17.23+).
  app.post("/presupuestos/piso/guardar-nota-simple", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const nota_simple = String(req.body.nota_simple == null ? "" : req.body.nota_simple);
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "nota_simple", nota_simple);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /piso/guardar-nota-simple:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/expediente/avanzar
  app.post("/presupuestos/expediente/avanzar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      // Buscar definición de la fase actual: primero en PTO_FASES, luego
      // en las fases del módulo documentación.
      const def = PTO_FASES[fase] || FASES_DOCUMENTACION_DEF[fase];
      if (def && def.siguiente) {
        comu.fase_presupuesto = def.siguiente;
        const hoy = new Date().toISOString().slice(0, 10);
        // Si se sale de 02_VISITA sin fecha de visita rellenada, ponemos la de hoy como fallback
        if (fase === "02_VISITA" && !comu.fecha_visita) comu.fecha_visita = hoy;
        // Mismo fallback al salir de 06_VISITA_EMASESA
        if (fase === "06_VISITA_EMASESA" && !comu.fecha_visita_emasesa) comu.fecha_visita_emasesa = hoy;
        // Al salir de 05_DOCUMENTACION marcamos la fecha de cierre = hoy
        if (fase === "05_DOCUMENTACION" && !comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
        // Al salir de 07_PTE_CYCP (paso a 08_CYCP) marcamos fecha_envio_contratos_pagos = hoy.
        // Esa fecha representa el día en que se envió el mail de contratos y cartas de pago,
        // y es la fecha que pinta el círculo 07 en la línea de tiempo.
        if (fase === "07_PTE_CYCP" && !comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
        // fecha_envio_pto YA NO se rellena al entrar en 03_ENVIO_PTO: se rellena al confirmar el envío del mail
        if (def.siguiente === "04_ACEPTACION_PTO" && !comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        await actualizarComunidad(comu._rowIndex, comu);
        // Inicializar estados manuales al ENTRAR en fase 05 o al entrar en 08_CYCP
        // (en 08 es cuando aparecen ccpp_contrato/pago y piso_contrato/pago como
        // activos en la cajita). 07_PTE_CYCP es solo una fase de espera, sin docs.
        if (def.siguiente === "05_DOCUMENTACION" || def.siguiente === "08_CYCP") {
          try {
            const D = app.locals.documentacion;
            if (D && D.inicializarEstadosFase) {
              await D.inicializarEstadosFase(comu, def.siguiente);
            }
          } catch (e) {
            console.warn("[presupuestos] inicializarEstadosFase " + def.siguiente + " falló:", e.message);
          }
        }
      }
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) {
      console.error("[presupuestos] /avanzar:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/retroceder
  // Retrocede el expediente a la fase anterior. body: id, conservar ("1"|"0").
  // Si conservar="0", limpia las fechas/contadores asociados a la fase ACTUAL
  // (la que se está abandonando). Si conservar="1", solo cambia la fase.
  app.post("/presupuestos/expediente/retroceder", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const conservar = String(req.body.conservar || "1") === "1";
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      const faseAnt = calcularFaseAnterior(fase);
      if (!faseAnt) {
        const token = req.query.token || "";
        return res.redirect(urlT(token, "/presupuestos/expediente", { id }));
      }
      comu.fase_presupuesto = faseAnt;

      if (!conservar) {
        // Limpiar datos asociados a la fase de la que se sale.
        // Mapeo conservador: solo se borran campos directamente ligados a esa fase.
        // v17.49: también se borra `fecha_limite_documentacion_vecinos` al
        // retroceder DE 02 (vuelve a 01) y DE 04 (vuelve a 03). El campo se
        // rellena al iniciar 01 (primer mail manual) y al iniciar 04 (envío
        // del presupuesto desde 03). Si retrocedes, hay que borrarlo para
        // que al volver a iniciar la fase se recalcule con la fecha real.
        if (fase === "01_CONTACTO")        { comu.fecha_proximo_mail_manual = ""; }
        if (fase === "02_VISITA")          {
          comu.fecha_visita = "";
          // v17.49: al volver a 01, borramos también BC (la fecha límite que
          // se calculó al iniciar 01). Al rehacer el primer mail en 01 se
          // recalculará con la fecha actual.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "03_ENVIO_PTO")       { comu.fecha_envio_pto = ""; }
        if (fase === "04_ACEPTACION_PTO")  {
          comu.fecha_aceptacion_pto = "";
          comu.fecha_ultimo_seguimiento_pto = "";
          comu.fecha_ultimo_reenvio_pto = "";
          comu.fecha_proximo_mail_manual = "";
          // v17.49: al volver a 03, borramos también BC (la fecha límite que
          // se calculó al pasar de 03 a 04 vía envío del presupuesto). Al
          // reenviar el presupuesto se recalculará con la fecha actual.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "05_DOCUMENTACION")   {
          comu.fecha_documentacion_completa = "";
          // Importante: al retroceder de 05, hay que borrar también la fecha
          // límite calculada al pulsar ACEPTADO (hoy+20). Si no, al volver a
          // entrar a 05 el cron no la recalcula porque la guardia
          // `if (!comu.fecha_limite_documentacion_vecinos)` la conserva, y el
          // mail saldría con una fecha más cercana de lo previsto.
          comu.fecha_limite_documentacion_vecinos = "";
        }
        if (fase === "06_VISITA_EMASESA")  { comu.fecha_visita_emasesa = ""; }
        if (fase === "07_PTE_CYCP")        { comu.fecha_envio_contratos_pagos = ""; }
        if (fase === "08_CYCP")            { comu.fecha_cycp_completa = ""; }

        // Borrar contadores de mails de esa fase
        try {
          const enviados = parsearMailJson(comu.mails_enviados);
          const manuales = parsearMailJson(comu.mails_manuales);
          const ultimo   = parsearMailJson(comu.mails_ultimo_envio);
          if (enviados[fase] !== undefined) { delete enviados[fase]; comu.mails_enviados = JSON.stringify(enviados); }
          if (manuales[fase] !== undefined) { delete manuales[fase]; comu.mails_manuales = JSON.stringify(manuales); }
          if (ultimo[fase] !== undefined)   { delete ultimo[fase];   comu.mails_ultimo_envio = JSON.stringify(ultimo); }
        } catch (e) { /* nada */ }
      }

      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) {
      console.error("[presupuestos] /retroceder:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/aceptar
  app.post("/presupuestos/expediente/aceptar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      // El CCPP sale de presupuestos y entra en el módulo documentacion.
      // 05_DOCUMENTACION es la primera fase de ese módulo.
      comu.fase_presupuesto = "05_DOCUMENTACION";
      comu.decision_pto = "ACEPTADO";
      comu.fecha_aceptacion_pto = new Date().toISOString().slice(0, 10);
      await actualizarComunidad(comu._rowIndex, comu);
      // Inicializar estados manuales al entrar en la fase. Se hace después
      // de actualizar para que la fase nueva ya esté guardada.
      try {
        const D = app.locals.documentacion;
        if (D && D.inicializarEstadosFase) {
          await D.inicializarEstadosFase(comu, "05_DOCUMENTACION");
        }
      } catch (e) {
        console.warn("[presupuestos] inicializarEstadosFase 05 falló:", e.message);
      }
      const token = req.query.token || "";
      // El CCPP ya pertenece al módulo documentación: redirigir allí.
      res.redirect(urlT(token, "/documentacion/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/rechazar
  app.post("/presupuestos/expediente/rechazar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      comu.fase_presupuesto = "ZZ_RECHAZADO";
      comu.decision_pto = "RECHAZADO";
      comu.fecha_aceptacion_pto = new Date().toISOString().slice(0, 10);
      comu.motivo_rechazo = String(req.body.motivo || "").trim();
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/cerrar-cycp — cierra la fase 08-CYCP (final).
  // Solo válido si el CCPP está en fase 08_CYCP.
  // Acción: rellena fecha_cycp_completa = hoy.
  // El CCPP se mantiene en 08_CYCP (no hay fase posterior); el cierre solo se
  // refleja en que ya tiene fecha en el círculo 08.
  app.post("/presupuestos/expediente/cerrar-cycp", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      if (fase !== "08_CYCP") {
        return sendError(res, "Solo se puede cerrar fase 08-CYCP cuando el CCPP está en esa fase. Fase actual: " + fase);
      }
      if (!comu.fecha_cycp_completa) comu.fecha_cycp_completa = new Date().toISOString().slice(0, 10);
      comu.fase_presupuesto = "09_TRAMITADA"; // v17.23
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/descartar — pasa a ZZ_DESCARTADO (manual)
  app.post("/presupuestos/expediente/descartar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      comu.fase_presupuesto = "ZZ_DESCARTADO";
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      res.redirect(urlT(token, "/presupuestos/expediente", { id }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // POST /presupuestos/expediente/eliminar — BORRADO FÍSICO de la fila del Sheet.
  // Solo permitido si la fase es ZZ_DESCARTADO (los rechazados deben pasar primero
  // por DESCARTADO antes de poder eliminarse, así hay una "papelera" intermedia).
  // Usa batchUpdate con deleteDimension para que la fila desaparezca físicamente.
  app.post("/presupuestos/expediente/eliminar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const fase = normalizarFase(comu.fase_presupuesto);
      if (fase !== "ZZ_DESCARTADO") {
        return sendError(res, "Solo se pueden eliminar expedientes en fase ZZ-DESCARTADO");
      }
      // Obtener el sheetId numérico de la pestaña 'comunidades'
      const sheets = getSheetsClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const tab = (meta.data.sheets || []).find(s => s.properties && s.properties.title === "comunidades");
      if (!tab) throw new Error("No se encontró la pestaña 'comunidades' en el Sheet");
      const tabId = tab.properties.sheetId;
      // _rowIndex es 1-based con cabecera; deleteDimension usa 0-based, por eso restamos 1
      const startIndex = comu._rowIndex - 1;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: tabId,
                dimension: "ROWS",
                startIndex,
                endIndex: startIndex + 1,
              },
            },
          }],
        },
      });
      // Mover carpeta de Drive a la papelera (no bloqueante).
      try {
        const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
        if (parentId) {
          const nombre = `${comu.tipo_via || ""} ${comu.direccion || ""}`.trim();
          if (nombre) {
            const nombreSafe = nombre.replace(/'/g, "\\'");
            const drive = getDriveClient();
            const busq = await drive.files.list({
              q: `name='${nombreSafe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: "files(id,name)",
              pageSize: 1,
            });
            if (busq.data.files && busq.data.files.length > 0) {
              await drive.files.update({
                fileId: busq.data.files[0].id,
                requestBody: { trashed: true },
              });
              console.log(`[presupuestos] carpeta Drive enviada a papelera: "${nombre}"`);
            } else {
              console.log(`[presupuestos] carpeta Drive no encontrada para "${nombre}" (nada que borrar)`);
            }
          }
        }
      } catch (errDrive) {
        console.error("[presupuestos] Error enviando carpeta a papelera (no bloquea eliminación):", errDrive.message);
      }
      const token = req.query.token || "";
      // Redirigir al listado (la ficha ya no existe)
      res.redirect(urlT(token, "/presupuestos"));
    } catch (e) {
      console.error("[presupuestos] /eliminar:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/expediente/reactivar — vuelve a 01_CONTACTO reseteando contadores
  // Equivalente a "crear de cero" pero conservando los datos de la ficha.
  // Acepta como fase de origen ZZ_RECHAZADO o ZZ_DESCARTADO.
  app.post("/presupuestos/expediente/reactivar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = req.body.id;
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("No encontrado");
      const faseActual = normalizarFase(comu.fase_presupuesto);
      // Solo permitir reactivar si está rechazada o descartada
      if (faseActual !== "ZZ_DESCARTADO" && faseActual !== "ZZ_RECHAZADO") {
        return sendError(res, "Solo se pueden reactivar expedientes rechazados o descartados");
      }
      comu.fase_presupuesto = "01_CONTACTO";
      comu.fecha_contacto = new Date().toISOString().slice(0, 10);
      // Resetear todas las fechas posteriores
      comu.fecha_visita = "";
      comu.fecha_envio_pto = "";
      comu.fecha_ultimo_seguimiento_pto = "";
      comu.fecha_aceptacion_pto = "";
      comu.decision_pto = "";
      // Resetear contadores de mail
      comu.mails_enviados = "";
      comu.mails_manuales = "";
      comu.mails_ultimo_envio = "";
      await actualizarComunidad(comu._rowIndex, comu);
      const token = req.query.token || "";
      // Redirigir con flag "reactivado=1" para que la UI muestre el confirm de envío inicial
      res.redirect(urlT(token, "/presupuestos/expediente", { id, reactivado: "1" }));
    } catch (e) { sendError(res, "Error: " + e.message); }
  });

  // GET /presupuestos/plantilla-mail?fase=01_CONTACTO&id=...
  // Devuelve JSON con la plantilla aplicada al expediente (variables sustituidas)
  app.get("/presupuestos/plantilla-mail", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const fase = String(req.query.fase || "");
      const id = String(req.query.id || "");
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const plantilla = await leerPlantillaMail(fase);
      if (!plantilla || !plantilla.activo) {
        return res.status(404).json({ error: "Plantilla no disponible para esta fase" });
      }
      // Para la previsualización del mail de fase 05_ACEPTACION_PTO, si la
      // CCPP aún no tiene fecha_limite_documentacion_vecinos, mostramos en la
      // preview la fecha que se calculará al confirmar el envío (hoy + 20).
      // No tocamos el Sheet aquí: eso lo hace el endpoint de envío real (POST
      // /presupuestos/expediente/enviar-mail). Trabajamos sobre una copia.
      const comuPreview = Object.assign({}, comu);
      if (fase === "05_ACEPTACION_PTO" && !comuPreview.fecha_limite_documentacion_vecinos) {
        const f = new Date();
        f.setDate(f.getDate() + 20);
        comuPreview.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      }
      // Idem para 08_INICIO_CYCP: si la CCPP aún está en fase 07, mostramos
      // en la preview la fecha que se calculará al confirmar el envío (hoy + 10).
      // Coincide con la lógica del endpoint de envío real (línea ~4227).
      if (fase === "08_INICIO_CYCP" && normalizarFase(comuPreview.fase_presupuesto) === "07_PTE_CYCP") {
        const f = new Date();
        f.setDate(f.getDate() + 10);
        comuPreview.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      }
      // Sustituir variables (async porque puede incluir {{DOC_CCPP}}/{{DOC_PISOS}}/{{PCT_PISOS}})
      const asunto = await sustituirVariablesAsync(plantilla.asunto, comuPreview);
      const mensaje = await sustituirVariablesAsync(plantilla.mensaje, comuPreview);
      // Estado actual de envíos
      const enviados = parsearMailJson(comu.mails_enviados);
      const ultimo = parsearMailJson(comu.mails_ultimo_envio);
      res.json({
        ok: true,
        fase,
        plantilla: {
          asunto,
          mensaje,
          adjuntos_fijos: plantilla.adjuntos_fijos || "",
          dias_recurrente: plantilla.dias_recurrente,
          max_envios: plantilla.max_envios,
        },
        destinatario: (function() {
          const d = _destinatariosCcpp(comu);
          return {
            nombre: comu.administrador || "",
            email: d.to,
            cc:    d.cc,
          };
        })(),
        estado: {
          enviados: enviados[fase] || 0,
          ultimo: ultimo[fase] || "",
        },
      });
    } catch (e) {
      console.error("[presupuestos] /plantilla-mail:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/expediente/carpeta-drive?id=...
  // Devuelve la URL de la carpeta Drive del expediente (la crea si no existe).
  app.get("/presupuestos/expediente/carpeta-drive", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const folderId = await getOrCreateCarpetaExpediente(comu.tipo_via, comu.direccion);
      if (!folderId) return res.status(500).json({ error: "No se pudo obtener carpeta Drive" });
      res.json({ ok: true, url: `https://drive.google.com/drive/folders/${folderId}` });
    } catch (e) {
      console.error("[presupuestos] /carpeta-drive:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/expediente/mail-borrar
  // body: id, fecha, ccpp_id, direccion, fase, asunto, tipo
  // Borra una fila de mail_historico identificada por (fecha, ccpp_id, direccion, fase, asunto, tipo).
  app.post("/presupuestos/expediente/mail-borrar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      await borrarMailHistoricoFila({
        fecha: String(req.body.fecha || ""),
        ccpp_id: String(req.body.ccpp_id || ""),
        direccion: String(req.body.direccion || ""),
        fase: String(req.body.fase || ""),
        asunto: String(req.body.asunto || ""),
        tipo: String(req.body.tipo || ""),
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-borrar:", e.message);
      res.status(500).send(e.message);
    }
  });

  // POST /presupuestos/expediente/mail-enviar-manual
  // body: id, destinatario, cc, cco, asunto, mensaje, adjuntos
  // Compositor libre tipo Gmail: envía REAL por SMTP usando la primera cuenta
  // (administracion) y registra en mail_historico como tipo "manual_externo"
  // (mismo tipo que los demás manuales). En `adjuntos` se guardan los links
  // tal cual; los archivos NO se almacenan en el Sheet.
  app.post("/presupuestos/expediente/mail-enviar-manual", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const destinatario = String(req.body.destinatario || "").trim();
      const cc = String(req.body.cc || "").trim();
      const cco = String(req.body.cco || "").trim();
      const asunto = String(req.body.asunto || "").trim();
      const mensaje = String(req.body.mensaje || "");
      const adjuntos = String(req.body.adjuntos || "").trim();
      if (!id) return res.status(400).send("Falta id");
      if (!destinatario) return res.status(400).send("Falta destinatario");
      if (!asunto) return res.status(400).send("Falta asunto");
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).send("Expediente no encontrado");
      // Cuenta = primera de mail_cuentas (administracion).
      const cuentas = await leerCuentasMail();
      if (!cuentas.length) return res.status(500).send("No hay cuentas en mail_cuentas");
      const cuentaId = cuentas[0].id;
      // Envío real (descarga adjuntos de Drive, los adjunta, registra error si link roto).
      let msgIdEnviado = "";
      try {
        msgIdEnviado = await enviarMailReal({
          cuentaId,
          destinatario,
          cc,
          cco,
          asunto,
          mensaje,
          adjuntosUrls: adjuntos,
        });
      } catch (errEnv) {
        console.error("[presupuestos] /mail-enviar-manual envío falló:", errEnv.message);
        return res.status(500).send("No se envió:\n" + errEnv.message);
      }
      // Registrar en histórico (solo links, no archivos).
      await registrarMailEnHistorico({
        fecha: new Date().toISOString(),
        ccpp_id: comu.ccpp_id,
        direccion: comu.direccion || "",
        fase: "00_MANUAL",
        destinatario,
        asunto,
        mensaje,
        adjuntos,
        tipo: "manual_externo",
        message_id: msgIdEnviado,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-enviar-manual:", e.message);
      res.status(500).send(e.message);
    }
  });

  // POST /presupuestos/expediente/enviar-mail
  // body: id, fase, asunto, mensaje, destinatario, adjuntos, tipo
  // tipo: "manual_inicial" (1er envío del confirm) | "automatico" (cron) | "manual" (legacy)
  // Envío REAL via SMTP (nodemailer). La cuenta de salida la indica la plantilla
  // (col J `cuenta_envio` de mail_plantillas) referenciando una fila de mail_cuentas.
  // NOTA: el descarte por tope NO lo hace este endpoint — lo hace el cron diario 30 días después.
  app.post("/presupuestos/expediente/enviar-mail", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "");
      const fase = String(req.body.fase || "");
      const skip = String(req.body.skip || "") === "1";
      const reenvio = String(req.body.reenvio || "") === "1";
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });

      // Modo "saltar envío": no envía mail ni registra en histórico ni toca contadores
      // del cron, solo aplica el avance de fase (y sellado de fechas) propio de la fase.
      // Para fases con cron (05, 08), siembra los contadores con fecha=hoy para que
      // el cron espere los días configurados antes del siguiente envío.
      if (skip) {
        const faseActual = normalizarFase(comu.fase_presupuesto);
        const hoy = new Date().toISOString().slice(0, 10);
        // 01 -> 02 (sin sellar fechas, sin cron)
        if ((fase === "02_PTE_VISITA_CON_ACTA" || fase === "02_PTE_VISITA_SIN_ACTA") && faseActual === "01_CONTACTO") {
          comu.fase_presupuesto = "02_VISITA";
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 03 -> 04 (sella fecha_envio_pto, sin cron específico)
        if (fase === "03_ENVIO_PTO" && faseActual === "03_ENVIO_PTO") {
          comu.fecha_envio_pto = hoy;
          comu.fase_presupuesto = "04_ACEPTACION_PTO";
          if (!comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 04 -> 05 (sella fecha_aceptacion_pto, siembra cron de 05 con fecha hoy)
        if (fase === "05_ACEPTACION_PTO" && faseActual === "04_ACEPTACION_PTO") {
          comu.fase_presupuesto = "05_DOCUMENTACION";
          comu.decision_pto = "ACEPTADO";
          comu.fecha_aceptacion_pto = hoy;
          const enviados05 = parsearMailJson(comu.mails_enviados);
          const manuales05 = parsearMailJson(comu.mails_manuales);
          const ultimo05 = parsearMailJson(comu.mails_ultimo_envio);
          enviados05["05_DOCUMENTACION"] = 1;
          manuales05["05_DOCUMENTACION"] = 1;
          ultimo05["05_DOCUMENTACION"] = hoy;
          comu.mails_enviados = JSON.stringify(enviados05);
          comu.mails_manuales = JSON.stringify(manuales05);
          comu.mails_ultimo_envio = JSON.stringify(ultimo05);
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 05 -> 06 (sella fecha_documentacion_completa, sin cron específico)
        if (fase === "05_FIN_DOC" && faseActual === "05_DOCUMENTACION") {
          comu.fase_presupuesto = "06_VISITA_EMASESA";
          if (!comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        // 07 -> 08 (sella fecha_envio_contratos_pagos, siembra cron de 08 con fecha hoy)
        if (fase === "08_INICIO_CYCP" && faseActual === "07_PTE_CYCP") {
          comu.fase_presupuesto = "08_CYCP";
          if (!comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
          const enviados08 = parsearMailJson(comu.mails_enviados);
          const manuales08 = parsearMailJson(comu.mails_manuales);
          const ultimo08 = parsearMailJson(comu.mails_ultimo_envio);
          enviados08["08_CYCP"] = 1;
          manuales08["08_CYCP"] = 1;
          ultimo08["08_CYCP"] = hoy;
          comu.mails_enviados = JSON.stringify(enviados08);
          comu.mails_manuales = JSON.stringify(manuales08);
          comu.mails_ultimo_envio = JSON.stringify(ultimo08);
          await actualizarComunidad(comu._rowIndex, comu);
          return res.json({ ok: true, skipped: true, avanzado: true });
        }
        return res.status(400).json({ error: "El modo 'saltar envío' no está disponible para esta fase/plantilla en este expediente." });
      }

      // Modo "reenvío" (fase 04): mismo flujo de envío que un mail normal pero:
      //  - Registra en histórico con tipo 'reenvio_fase04'
      //  - Actualiza fecha_ultimo_reenvio_pto = hoy
      //  - Resetea fecha_ultimo_seguimiento_pto = hoy (el ciclo empieza de cero)
      //  - Borra contadores de mails fase 04 (cron empezará otra vez)
      //  - Borra fecha_proximo_mail_manual
      //  - NO avanza de fase (sigue en 04)
      if (reenvio) {
        if (normalizarFase(comu.fase_presupuesto) !== "04_ACEPTACION_PTO") {
          return res.status(400).json({ error: "El reenvío solo está disponible en fase 04-ACEPTACION PTO." });
        }
        // Plantilla 04_REENVIO (exclusiva del reenvío de presupuesto modificado)
        const plantillaR = await leerPlantillaMail("04_REENVIO");
        if (!plantillaR) return res.status(400).json({ error: "Sin plantilla 04_REENVIO configurada en mail_plantillas." });
        if (!plantillaR.activo) return res.status(400).json({ error: "Plantilla 04_REENVIO desactivada." });
        if (!plantillaR.cuenta_envio) return res.status(400).json({ error: "Plantilla 04_REENVIO sin cuenta de envío configurada." });

        // Si el body trae destinatario, respetar lo que escribió el usuario
        // (incluyendo el CC que haya puesto). Si no, usar el helper.
        const _destR = req.body.destinatario
          ? { to: String(req.body.destinatario).trim(), cc: String(req.body.cc || "").trim() }
          : _destinatariosCcpp(comu);
        const destinatarioR = _destR.to;
        const ccR = _destR.cc;
        if (!destinatarioR) return res.status(400).json({ error: "El expediente no tiene email de administrador ni de presidente configurado." });
        const asuntoR  = req.body.asunto  || (await sustituirVariablesAsync(plantillaR.asunto, comu))  || "";
        const mensajeR = req.body.mensaje || (await sustituirVariablesAsync(plantillaR.mensaje, comu)) || "";
        const adjuntosR = req.body.adjuntos || plantillaR.adjuntos_fijos || "";
        // CCO: si el usuario lo escribió en el modal de reenvío, se respeta;
        // si viene vacío, cae al de la plantilla (igual que el envío normal).
        const ccoR = (req.body.cco != null && String(req.body.cco).trim() !== "")
          ? String(req.body.cco).trim()
          : plantillaR.cco;

        // Envío real
        let msgIdEnviado = "";
        try {
          msgIdEnviado = await enviarMailReal({
            cuentaId: plantillaR.cuenta_envio,
            destinatario: destinatarioR,
            cc:  ccR,
            cco: ccoR,
            asunto: asuntoR,
            mensaje: mensajeR,
            adjuntosUrls: String(adjuntosR).split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
          });
        } catch (errEnv) {
          console.error("[presupuestos] enviarMailReal (reenvío) falló:", errEnv.message);
          return res.status(502).json({ error: "Fallo al enviar el mail: " + errEnv.message });
        }

        await registrarMailEnHistorico({
          fecha: new Date().toISOString(),
          ccpp_id: id,
          direccion: comu.direccion || comu.comunidad,
          fase: "04_ACEPTACION_PTO",
          destinatario: destinatarioR,
          asunto: asuntoR,
          mensaje: mensajeR,
          adjuntos: adjuntosR,
          tipo: "reenvio_fase04",
          message_id: msgIdEnviado,
        });
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_ultimo_reenvio_pto = hoy;
        comu.fecha_ultimo_seguimiento_pto = hoy;
        comu.fecha_proximo_mail_manual = "";
        // Opción A (sesión 07/05/2026): el reenvío revisado cuenta como un
        // NUEVO envío manual. Se suman:
        //   - manuales[04_ACEPTACION_PTO] += 1
        //   - automáticos se resetean: mails_enviados[04] = manuales[04]
        //     (de modo que numAutomáticos = 0 → cuenta atrás de cron empieza
        //      desde cero con la nueva cadencia inicial 'cadenciaInicialDias').
        // En la UI esto pasa de 1+0/3 a 2+0/3 (segundo manual, 0 reenvíos).
        const enviadosR = parsearMailJson(comu.mails_enviados);
        const manualesR = parsearMailJson(comu.mails_manuales);
        const ultimoR = parsearMailJson(comu.mails_ultimo_envio);
        // Compat con CCPPs antiguos: si nunca se trackearon manuales pero
        // ya había envíos, asumimos que al menos 1 fue manual (el inicial).
        let prevMan = manualesR["04_ACEPTACION_PTO"];
        if (prevMan === undefined) {
          const total = enviadosR["04_ACEPTACION_PTO"] || 0;
          prevMan = total >= 1 ? 1 : 0;
        }
        const nuevoMan = parseInt(prevMan) + 1;
        manualesR["04_ACEPTACION_PTO"] = nuevoMan;
        // Total = manuales (los automáticos quedan a 0 hasta que el cron mande
        // el siguiente)
        enviadosR["04_ACEPTACION_PTO"] = nuevoMan;
        ultimoR["04_ACEPTACION_PTO"] = hoy;
        comu.mails_enviados  = JSON.stringify(enviadosR);
        comu.mails_manuales  = JSON.stringify(manualesR);
        comu.mails_ultimo_envio = JSON.stringify(ultimoR);
        await actualizarComunidad(comu._rowIndex, comu);
        return res.json({ ok: true, reenvio: true });
      }

      const plantilla = await leerPlantillaMail(fase);
      if (!plantilla) return res.status(400).json({ error: "Sin plantilla para esa fase" });
      if (!plantilla.activo) return res.status(400).json({ error: "Plantilla desactivada para esta fase" });
      if (!plantilla.cuenta_envio) return res.status(400).json({ error: "Plantilla sin cuenta de envío configurada." });

      const enviados = parsearMailJson(comu.mails_enviados);
      const manuales = parsearMailJson(comu.mails_manuales);
      const ultimo = parsearMailJson(comu.mails_ultimo_envio);
      const nuevoCount = (enviados[fase] || 0) + 1;

      // Comprobar tope: max_envios = nº máximo de REENVÍOS AUTOMÁTICOS.
      // El envío manual nunca está limitado por max_envios; este check solo
      // aplica cuando alguien intenta forzar más automáticos vía endpoint
      // (que no debería pasar porque el endpoint manual los marca como
      // "manual" y no incrementa el contador de automáticos).
      // Mantenemos el check como red de seguridad por si llega un envío
      // de tipo "automatico" (ej. cron manual).
      const tipoEnvio = req.body.tipo || "manual";
      const esManual = tipoEnvio === "manual" || tipoEnvio === "manual_inicial" || tipoEnvio === "reenvio_fase04";
      if (!esManual && plantilla.max_envios > 0) {
        const numAutomActual = Math.max(0, (enviados[fase] || 0) - (manuales[fase] || 0));
        // v17.29: aceptar mientras estemos DENTRO del ciclo actual.
        // El ciclo se completa al alcanzar un múltiplo exacto de max_envios.
        const automEnCicloActual = numAutomActual % plantilla.max_envios;
        if (automEnCicloActual === 0 && numAutomActual > 0) {
          return res.status(400).json({
            error: `Se alcanzó el máximo de reenvíos automáticos del ciclo (${plantilla.max_envios}). Mete fecha de próximo mail manual para arrancar un nuevo ciclo.`,
          });
        }
      }

      // Si el body trae destinatario, respetar lo que escribió el usuario
      // (incluyendo el CC que haya puesto). Si no, usar el helper.
      const _dest2 = req.body.destinatario
        ? { to: String(req.body.destinatario).trim(), cc: String(req.body.cc || "").trim() }
        : _destinatariosCcpp(comu);
      const destinatario = _dest2.to;
      const ccManual = _dest2.cc;
      if (!destinatario) return res.status(400).json({ error: "El expediente no tiene email de administrador ni de presidente configurado." });

      // v17.49: Cálculo de fecha_limite_documentacion_vecinos basado en la
      // plantilla del cron de la fase destino. La fórmula es:
      //   fecha_limite = hoy + di + dr × mx
      // donde di, dr, mx son los parámetros del cron de la fase DESTINO.
      // Esta fecha coincide con el día en que el cron, siguiendo cadencia
      // normal, habría agotado el ciclo inicial. Es la misma fecha que se
      // muestra en {{fecha_limite_doc_vecinos}} en los mails y la que usa
      // calcularEstadoPlazo para los badges 👍/⚠️/👎.
      //
      // Helper para calcular plazo desde una plantilla:
      const _calcPlazoDesdePlantilla = (pl) => {
        if (!pl) return null;
        const _di = parseInt(pl.dias_primer_envio) || 0;
        const _dr = parseInt(pl.dias_recurrente) || 0;
        const _mx = parseInt(pl.max_envios) || 0;
        if (_mx <= 0 && _dr <= 0) return null;
        return _di + _dr * _mx;
      };
      // Helper para guardar la fecha límite (hoy + N días):
      const _guardarFechaLimite = (nDias) => {
        const f = new Date();
        f.setDate(f.getDate() + nDias);
        comu.fecha_limite_documentacion_vecinos = f.toISOString().slice(0, 10);
      };

      // FASE 01_CONTACTO: al enviar el primer mail manual de inicio,
      // calcular fecha límite con plantilla 01_CONTACTO. Solo si aún
      // no hay valor (no se sobrescribe en re-envíos manuales).
      if (fase === "01_CONTACTO" && !comu.fecha_limite_documentacion_vecinos) {
        const plazo01 = _calcPlazoDesdePlantilla(plantilla);
        if (plazo01 != null) _guardarFechaLimite(plazo01);
      }
      // FASE 03_ENVIO_PTO: al enviar el presupuesto (paso a 04), calcular
      // fecha límite con plantilla 04_ACEPTACION_PTO (la fase DESTINO),
      // SOBRESCRIBIENDO el valor anterior (que sería de fase 01 y ya no aplica).
      if (fase === "03_ENVIO_PTO" && normalizarFase(comu.fase_presupuesto) === "03_ENVIO_PTO") {
        try {
          const pl04 = await leerPlantillaMail("04_ACEPTACION_PTO");
          const plazo04 = _calcPlazoDesdePlantilla(pl04);
          if (plazo04 != null) _guardarFechaLimite(plazo04);
        } catch (_) { /* si falla la lectura, no rellenamos; el badge usará el fallback */ }
      }
      // FASE 05_ACEPTACION_PTO: al pulsar ACEPTADO en fase 04 (paso a 05),
      // calcular fecha límite con plantilla 05_SEGUIMIENTO_DOC (la fase
      // DESTINO). Solo si aún no hay valor.
      if (fase === "05_ACEPTACION_PTO" && !comu.fecha_limite_documentacion_vecinos) {
        try {
          const pl05 = await leerPlantillaMail("05_SEGUIMIENTO_DOC");
          const plazo05 = _calcPlazoDesdePlantilla(pl05);
          if (plazo05 != null) _guardarFechaLimite(plazo05);
        } catch (_) { /* idem */ }
      }
      // FASE 08_INICIO_CYCP: al enviar contratos y pagos (paso a 08),
      // calcular fecha límite con plantilla 08_SEGUIMIENTO_CYCP (la fase
      // DESTINO). SOBRESCRIBE el valor anterior (que sería de fase 05).
      if (fase === "08_INICIO_CYCP" && normalizarFase(comu.fase_presupuesto) === "07_PTE_CYCP") {
        try {
          const pl08 = await leerPlantillaMail("08_SEGUIMIENTO_CYCP");
          const plazo08 = _calcPlazoDesdePlantilla(pl08);
          if (plazo08 != null) _guardarFechaLimite(plazo08);
        } catch (_) { /* idem */ }
      }

      const asuntoF  = req.body.asunto  || (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
      const mensajeF = req.body.mensaje || (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
      const adjuntosF = req.body.adjuntos || plantilla.adjuntos_fijos || "";
      // CCO: si el usuario escribió uno en el modal, se respeta; si no, cae al
      // de la plantilla (col I `cco`). El cron/reenvíos sin body siguen usando
      // plantilla.cco como hasta ahora.
      const ccoF = (req.body.cco != null && String(req.body.cco).trim() !== "")
        ? String(req.body.cco).trim()
        : plantilla.cco;

      // Envío real
      let msgIdEnviado = "";
      try {
        msgIdEnviado = await enviarMailReal({
          cuentaId: plantilla.cuenta_envio,
          destinatario,
          cc:  ccManual,
          cco: ccoF,
          asunto: asuntoF,
          mensaje: mensajeF,
          adjuntosUrls: String(adjuntosF).split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
        });
      } catch (errEnv) {
        console.error("[presupuestos] enviarMailReal falló:", errEnv.message);
        return res.status(502).json({ error: "Fallo al enviar el mail: " + errEnv.message });
      }

      // Registrar en histórico
      await registrarMailEnHistorico({
        fecha: new Date().toISOString(),
        ccpp_id: id,
        direccion: comu.direccion || comu.comunidad,
        fase,
        destinatario,
        asunto: asuntoF,
        mensaje: mensajeF,
        adjuntos: adjuntosF,
        tipo: tipoEnvio,
        message_id: msgIdEnviado,
      });

      // Actualizar contador y fecha
      enviados[fase] = nuevoCount;
      ultimo[fase] = new Date().toISOString().slice(0, 10);
      // Si es envío manual, también incrementamos el contador de manuales.
      // Compat con CCPPs antiguos: si todavía no hay entrada en `manuales`
      // pero ya había envíos, asumimos que el primero (los previos) eran
      // manuales y partimos de ahí.
      if (esManual) {
        let prevManuales = manuales[fase];
        if (prevManuales === undefined) {
          // Antes de este envío había `enviados[fase] - 1` envíos en total.
          // Asumimos que al menos uno fue manual si había alguno.
          prevManuales = (enviados[fase] - 1) >= 1 ? 1 : 0;
        }
        manuales[fase] = parseInt(prevManuales) + 1;
        comu.mails_manuales = JSON.stringify(manuales);
      }
      comu.mails_enviados = JSON.stringify(enviados);
      comu.mails_ultimo_envio = JSON.stringify(ultimo);

      // Caso especial fase 03: el envío del presupuesto avanza automáticamente a 04
      // y rellena fecha_envio_pto con la fecha real del envío.
      let avanzado = false;
      if (fase === "03_ENVIO_PTO" && normalizarFase(comu.fase_presupuesto) === "03_ENVIO_PTO") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_envio_pto = hoy;
        comu.fase_presupuesto = "04_ACEPTACION_PTO";
        if (!comu.fecha_ultimo_seguimiento_pto) comu.fecha_ultimo_seguimiento_pto = hoy;
        avanzado = true;
      }

      // Caso especial fase 05_ACEPTACION_PTO: el mail de aceptación avanza
      // automáticamente a 05-DOCUMENTACION (igual que el botón ACEPTADO).
      let avanzadoA05 = false;
      if (fase === "05_ACEPTACION_PTO" && normalizarFase(comu.fase_presupuesto) === "04_ACEPTACION_PTO") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "05_DOCUMENTACION";
        comu.decision_pto = "ACEPTADO";
        comu.fecha_aceptacion_pto = hoy;
        // Sembrar contadores de fase 05 con este envío como el primer manual,
        // para que el cron de fase 05 arranque la cadencia desde aquí.
        const enviados05 = parsearMailJson(comu.mails_enviados);
        const manuales05 = parsearMailJson(comu.mails_manuales);
        const ultimo05 = parsearMailJson(comu.mails_ultimo_envio);
        enviados05["05_DOCUMENTACION"] = 1;
        manuales05["05_DOCUMENTACION"] = 1;
        ultimo05["05_DOCUMENTACION"] = hoy;
        comu.mails_enviados = JSON.stringify(enviados05);
        comu.mails_manuales = JSON.stringify(manuales05);
        comu.mails_ultimo_envio = JSON.stringify(ultimo05);
        avanzadoA05 = true;
      }

      // Caso especial fase 05_FIN_DOC: mail de fin de documentación. Al confirmar,
      // Caso especial fase 02 (paso 01 -> 02): mail de transición. Se activa con
      // cualquiera de las dos plantillas (CON_ACTA o SIN_ACTA). Al confirmar, se
      // avanza la CCPP de 01_CONTACTO a 02_VISITA. NO se sella ninguna fecha aquí:
      // `fecha_visita` se rellena al salir de la fase 02 (cuando la visita ya ocurrió).
      let avanzadoA02 = false;
      if ((fase === "02_PTE_VISITA_CON_ACTA" || fase === "02_PTE_VISITA_SIN_ACTA")
          && normalizarFase(comu.fase_presupuesto) === "01_CONTACTO") {
        comu.fase_presupuesto = "02_VISITA";
        // Al pasar de fase 01 limpiamos la fecha del próximo mail manual
        // para que no se arrastre si más tarde se vuelve a una fase con
        // reenvíos automáticos (04/05/08).
        comu.fecha_proximo_mail_manual = "";
        avanzadoA02 = true;
      }

      // se avanza la CCPP de 05_DOCUMENTACION a 06_VISITA_EMASESA y se sella la
      // fecha (fecha_documentacion_completa = hoy).
      let avanzadoA06 = false;
      if (fase === "05_FIN_DOC" && normalizarFase(comu.fase_presupuesto) === "05_DOCUMENTACION") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "06_VISITA_EMASESA";
        if (!comu.fecha_documentacion_completa) comu.fecha_documentacion_completa = hoy;
        avanzadoA06 = true;
      }

      // Caso especial fase 08_INICIO_CYCP: mail de inicio de fase 08. Al confirmar,
      // se avanza la CCPP de 07_PTE_CYCP a 08_CYCP y se sella la fecha
      // (fecha_envio_contratos_pagos = hoy). Además se siembran los contadores
      // de la fase 08 con este envío como primer manual, para que el cron de
      // fase 08 arranque la cadencia desde aquí (igual que el paso 04→05).
      let avanzadoA08 = false;
      if (fase === "08_INICIO_CYCP" && normalizarFase(comu.fase_presupuesto) === "07_PTE_CYCP") {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fase_presupuesto = "08_CYCP";
        if (!comu.fecha_envio_contratos_pagos) comu.fecha_envio_contratos_pagos = hoy;
        const enviados08 = parsearMailJson(comu.mails_enviados);
        const manuales08 = parsearMailJson(comu.mails_manuales);
        const ultimo08 = parsearMailJson(comu.mails_ultimo_envio);
        enviados08["08_CYCP"] = 1;
        manuales08["08_CYCP"] = 1;
        ultimo08["08_CYCP"] = hoy;
        comu.mails_enviados = JSON.stringify(enviados08);
        comu.mails_manuales = JSON.stringify(manuales08);
        comu.mails_ultimo_envio = JSON.stringify(ultimo08);
        avanzadoA08 = true;
      }

      // Caso especial fase 08_FIN_CYCP: mail de cierre de fase 08. Al confirmar,
      // se cierra la fase (fecha_cycp_completa = hoy) y se pasa a 09_TRAMITADA
      // (v17.23). La CCPP marcada como 09_TRAMITADA ya no aparece en Activos
      // ni en En trámite ni en el cron de envíos.
      let cerradoFase08 = false;
      if (fase === "08_FIN_CYCP" && normalizarFase(comu.fase_presupuesto) === "08_CYCP" && !comu.fecha_cycp_completa) {
        const hoy = new Date().toISOString().slice(0, 10);
        comu.fecha_cycp_completa = hoy;
        comu.fase_presupuesto = "09_TRAMITADA";
        cerradoFase08 = true;
      }

      await actualizarComunidad(comu._rowIndex, comu);

      // Si avanzó a 05, inicializar estados manuales (igual que el endpoint /aceptar)
      if (avanzadoA05) {
        try {
          const D = app.locals.documentacion;
          if (D && D.inicializarEstadosFase) {
            await D.inicializarEstadosFase(comu, "05_DOCUMENTACION");
          }
        } catch (e) {
          console.warn("[presupuestos] inicializarEstadosFase 05 (desde mail) falló:", e.message);
        }
      }

      // Si avanzó a 08, inicializar estados manuales: marca como "F" los
      // documentos contrato y pago (CCPP y piso) que es lo que se solicita
      // en esta fase. El resto de docs ya estaban en OK desde fase 05.
      if (avanzadoA08) {
        try {
          const D = app.locals.documentacion;
          if (D && D.inicializarEstadosFase) {
            await D.inicializarEstadosFase(comu, "08_CYCP");
          }
        } catch (e) {
          console.warn("[presupuestos] inicializarEstadosFase 08 (desde mail) falló:", e.message);
        }
      }

      res.json({
        ok: true,
        envios: nuevoCount,
        max_envios: plantilla.max_envios,
        avanzado,
        avanzadoA05,
        avanzadoA06,
        avanzadoA08,
        cerradoFase08,
      });
    } catch (e) {
      console.error("[presupuestos] /enviar-mail:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/admin/actualizar — Propaga tel/email del administrador a todas sus CCPPs
  app.post("/presupuestos/admin/actualizar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const nombreAdmin = String(req.body.nombre_admin || "").trim();
      const campo       = String(req.body.campo || "").trim();          // "telefono" o "email"
      const valor       = String(req.body.valor || "").trim();
      if (!nombreAdmin) return res.status(400).json({ error: "nombre_admin requerido" });
      if (!["telefono", "email"].includes(campo)) {
        return res.status(400).json({ error: "campo debe ser 'telefono' o 'email'" });
      }
      // Mapear campo cliente → columna sheet
      const campoSheet = campo === "telefono" ? "telefono_administrador" : "email_administrador";
      const valorLimpio = campo === "telefono" ? valor.replace(/\D/g, "") : valor;

      const comunidades = await leerComunidades();
      const nombreNorm = nombreAdmin.toLowerCase();
      const afectadas = comunidades.filter(c =>
        String(c.administrador || "").trim().toLowerCase() === nombreNorm
      );
      let actualizadas = 0;
      for (const c of afectadas) {
        if (String(c[campoSheet] || "") === valorLimpio) continue; // ya tiene ese valor
        c[campoSheet] = valorLimpio;
        await actualizarComunidad(c._rowIndex, c);
        actualizadas++;
      }
      console.log(`[presupuestos] Admin "${nombreAdmin}" - ${campo} actualizado en ${actualizadas} CCPPs`);
      res.json({ ok: true, actualizadas, totalConEseAdmin: afectadas.length });
    } catch (e) {
      console.error("[presupuestos] /admin/actualizar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // CRON INTERNO: revisa fichas en 01_CONTACTO y 04_ACEPTACION_PTO para enviar mails automáticos
  // =================================================================
  // Filosofía:
  //  - Solo actúa sobre fichas en CRON_FASES_AUTO con al menos 1 envío manual previo
  //  - max_envios de la plantilla = nº máximo de REENVÍOS AUTOMÁTICOS (no de envíos totales)
  //  - Cuando se alcanza el tope: NO descarta automáticamente. Para los envíos y manda
  //    aviso al admin (administracion@instalacionesaraujo.com) para que decida manualmente.
  //  - Margen 7 días: si está vencido más de 7 días, NO se envía atrasado, se reanuda en próxima fecha
  //  - Para 01_CONTACTO: requiere primer envío manual; cuando llega al tope → para y avisa
  //  - Para 04_ACEPTACION_PTO: el primer envío manual lo hace el botón "Enviar presupuesto"
  //    de fase 03 que pasa a 04. El cron arranca la cadencia 'cadenciaInicialDias' (3) desde
  //    el último envío; siguientes cada 'dias_recurrente' (30); para al alcanzar max_envios.
  //    Si fecha_proximo_mail_manual está rellena, sustituye al cálculo: envía en esa fecha
  //    exacta y resetea solo los automáticos (los manuales se mantienen).
  const CRON_FASES_AUTO = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"];
  const CRON_MARGEN_DIAS = 7;
  const cronStatus = { ultimoTick: null, ultimoResumen: null, ultimoError: null, ultimosErrores: [] };

  async function ejecutarCronEnviosAutomaticos() {
    const inicio = new Date();
    const resumen = { revisadas: 0, enviadas: 0, descartadas: 0, omitidas_margen: 0, errores: 0, detalleErrores: [] };
    try {
      const comunidades = await leerComunidades();

      // v17.20: precargar las 4 plantillas que usa el cron UNA SOLA VEZ
      // (antes se leía la pestaña entera dentro del bucle por cada CCPP).
      // Con el caché de _leerFilasMailPlantillas esto ya solo dispara 1
      // lectura del Sheet aunque haya 50 CCPPs. Pasamos las plantillas
      // como mapa para evitar incluso esa lectura repetida.
      const _plantillasCron = {};
      try {
        const _fases = ["01_CONTACTO", "04_ACEPTACION_PTO", "05_SEGUIMIENTO_DOC", "08_SEGUIMIENTO_CYCP"];
        const _arr = await Promise.all(_fases.map(f => leerPlantillaMail(f).catch(() => null)));
        _fases.forEach((f, i) => { _plantillasCron[f] = _arr[i]; });
      } catch (_) { /* si falla la precarga, el bucle hará fallback a leerPlantillaMail por CCPP */ }

      for (const comu of comunidades) {
        const fase = normalizarFase(comu.fase_presupuesto);
        if (!CRON_FASES_AUTO.includes(fase)) continue;
        // Una 08_CYCP ya cerrada (con fecha_cycp_completa) no entra al cron:
        // su trabajo está hecho, no hay reenvíos que disparar.
        if (fase === "08_CYCP" && comu.fecha_cycp_completa) continue;
        const enviados = parsearMailJson(comu.mails_enviados);
        const manuales = parsearMailJson(comu.mails_manuales);
        const ultimo   = parsearMailJson(comu.mails_ultimo_envio);
        const numEnvios = enviados[fase] || 0;
        // Compat con CCPPs antiguos (sin tracking de manuales): asumimos que
        // el primer envío fue manual.
        let numManualesAct;
        if (manuales[fase] !== undefined) {
          numManualesAct = parseInt(manuales[fase]) || 0;
        } else {
          numManualesAct = numEnvios >= 1 ? 1 : 0;
        }
        const numAutomaticos = Math.max(0, numEnvios - numManualesAct);

        // ----- FASE 01: requiere primer envío manual previo -----
        if (fase === "01_CONTACTO") {
          if (numEnvios < 1) continue; // cron no activado (no hay envío manual previo)
          const fechaUltimo = ultimo[fase];
          if (!fechaUltimo) continue;
          resumen.revisadas++;
          // v17.20: plantilla precargada al inicio; si la precarga falló, fallback.
          let plantilla = _plantillasCron[fase];
          if (!plantilla) {
            try { plantilla = await leerPlantillaMail(fase); } catch (e) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error leyendo plantilla: " + e.message }); continue; }
          }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 0;
          const mx = plantilla.max_envios || 0; // tope de REENVÍOS AUTOMÁTICOS
          if (dr <= 0 || mx <= 0) continue;
          const hoy = new Date(); hoy.setHours(0,0,0,0);

          // Modo "fecha manual": si está rellena, sustituye a la cadencia
          // normal. Cuando hoy >= fm → envía y consume (resetea automáticos).
          // Cuando hoy < fm → no envía aún (espera).
          const fechaManual01 = (comu.fecha_proximo_mail_manual || "").trim();
          let debeEnviar01 = false;
          let consumirManual01 = false;
          if (fechaManual01) {
            const fm = new Date(fechaManual01); fm.setHours(0,0,0,0);
            if (isNaN(fm.getTime())) {
              // Fecha mal formada → limpiar y seguir con cadencia normal
              consumirManual01 = true;
            } else if (hoy >= fm) {
              debeEnviar01 = true;
              consumirManual01 = true;
            } else {
              // Hay fecha manual futura → bloquea cadencia normal, no enviar todavía
              continue;
            }
          } else {
            // Modo cadencia normal (comportamiento histórico)
            const fu = new Date(fechaUltimo); fu.setHours(0,0,0,0);
            const diasDesde = Math.floor((hoy - fu) / 86400000);
            if (diasDesde < dr) continue;
            // Margen
            const diasVencido = diasDesde - dr;
            if (diasVencido > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
            debeEnviar01 = true;
          }
          // ¿Ya estaba en tope de automáticos? El cron NO descarta
          // automáticamente: se queda esperando decisión humana (el aviso
          // ya se envió cuando se alcanzó el tope).
          // v17.29: nuevo concepto de "ciclo". Cada ciclo tiene mx reenvíos.
          // Si está en final de ciclo (numAutomaticos % mx === 0 con >0):
          //   - Si viene de fecha manual → SE PERMITE: arranca nuevo ciclo.
          //   - Si es cadencia normal → se para esperando decisión humana.
          const enCicloAgotado01 = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
          if (debeEnviar01 && enCicloAgotado01 && !consumirManual01) {
            continue;
          }
          if (!debeEnviar01 && !consumirManual01) continue;
          // Enviar automático
          try {
            let nuevosAuto = numAutomaticos;
            if (debeEnviar01) {
              const _d = _destinatariosCcpp(comu);
              const dest = _d.to;
              const destCc = _d.cc;
              if (!dest) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Falta email del administrador y del presidente" }); continue; }
              if (!plantilla.cuenta_envio) {
                console.warn(`[presupuestos][cron][01] plantilla sin cuenta_envio: ${comu.direccion}`);
                resumen.errores++;
                resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Plantilla sin cuenta de envío configurada" });
                continue;
              }
              const asuntoSus  = (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
              const mensajeSus = (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
              const msgIdEnviado = await enviarMailReal({
                cuentaId: plantilla.cuenta_envio,
                destinatario: dest,
                cc:  destCc,
                cco: plantilla.cco,
                asunto: asuntoSus,
                mensaje: mensajeSus,
                adjuntosUrls: String(plantilla.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
              });
              await registrarMailEnHistorico({
                fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                direccion: comu.direccion || comu.comunidad, fase,
                destinatario: dest,
                asunto: asuntoSus, mensaje: mensajeSus,
                adjuntos: plantilla.adjuntos_fijos || "", tipo: "automatico",
                message_id: msgIdEnviado,
              });
              // v17.29: NO reseteamos los automáticos al consumir fecha manual.
              // Sumamos siempre: así si max_envios=2 y luego ampliamos con otro
              // ciclo más, queda numAutomaticos=4 > 2 → detectable como ampliado
              // (para el badge "👎 Retrasado" permanente).
              enviados[fase] = numEnvios + 1;
              nuevosAuto = numAutomaticos + 1;
              // Sembrar manuales si era CCPP antiguo (compat)
              if (manuales[fase] === undefined) {
                manuales[fase] = numManualesAct;
                comu.mails_manuales = JSON.stringify(manuales);
              }
              ultimo[fase] = new Date().toISOString().slice(0, 10);
              comu.mails_enviados = JSON.stringify(enviados);
              comu.mails_ultimo_envio = JSON.stringify(ultimo);
              resumen.enviadas++;
            }
            if (consumirManual01) {
              comu.fecha_proximo_mail_manual = "";
            }
            await actualizarComunidad(comu._rowIndex, comu);
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
            resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error al enviar: " + e.message });
          }
          continue;
        }

        // ----- FASE 04: primer envío automático + tope opcional + fecha manual -----
        // Si la plantilla tiene max_envios > 0, el cron PARA al alcanzarlo y avisa
        // al admin (no descarta automáticamente: queda en fase 04 esperando que
        // se decida manualmente — aceptar / rechazar / descartar / reenviar).
        // Si max_envios == 0 → sin tope (comportamiento histórico).
        if (fase === "04_ACEPTACION_PTO" || fase === "05_DOCUMENTACION" || fase === "08_CYCP") {
          // v17.20: plantilla precargada al inicio; si la precarga falló, fallback.
          let plantilla = _plantillasCron[plantillaDeFase(fase)];
          if (!plantilla) {
            try { plantilla = await leerPlantillaMail(plantillaDeFase(fase)); } catch (e) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error leyendo plantilla: " + e.message }); continue; }
          }
          if (!plantilla || !plantilla.activo) continue;
          const dr = plantilla.dias_recurrente || 30;
          const di = plantilla.dias_primer_envio || 3;
          const mx = plantilla.max_envios || 0;

          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const fechaManual = (comu.fecha_proximo_mail_manual || "").trim();
          let debeEnviar = false;
          let consumirManual = false;

          if (fechaManual) {
            // Modo fecha manual: solo se envía cuando hoy >= fecha manual
            const fm = new Date(fechaManual); fm.setHours(0,0,0,0);
            if (isNaN(fm.getTime())) {
              // Fecha mal formada → ignorar y borrar
              consumirManual = true;
            } else if (hoy >= fm) {
              debeEnviar = true;
              consumirManual = true;
            }
          } else {
            // Modo cadencia normal: primer reenvío automático a 'di' días desde
            // el último envío manual; siguientes reenvíos cada 'dr' días.
            // v17.29: nuevo concepto de "ciclo". Cada ciclo permite hasta mx
            // reenvíos automáticos. Cuando se completa un ciclo (numAutomaticos
            // múltiplo de mx) y NO hay fecha manual nueva → para. Si se mete
            // fecha manual → arranca nuevo ciclo (el envío disparado por la
            // fecha manual cuenta como el primero del ciclo nuevo, y a partir
            // de ahí siguen cadencia 'dr' hasta completar mx más).
            const enCicloAgotado = mx > 0 && numAutomaticos > 0 && (numAutomaticos % mx === 0);
            if (enCicloAgotado) continue;
            let fechaBase, dias;
            if (numAutomaticos < 1) {
              // Aún no hay reenvíos automáticos → primer reenvío a 'di' días.
              // Base preferente: último envío (manual). Si no hay (CCPP nuevo
              // recién entrado en fase 04 sin envío inicial todavía),
              // fallback a fecha_ultimo_seguimiento_pto.
              fechaBase = ultimo[fase] || comu.fecha_ultimo_seguimiento_pto;
              dias = di;
            } else {
              // Ya hay reenvíos automáticos → 'dr' días desde el último envío
              fechaBase = ultimo[fase];
              dias = dr;
            }
            if (!fechaBase) continue;
            const fb = new Date(fechaBase); fb.setHours(0,0,0,0);
            if (isNaN(fb.getTime())) continue;
            const diasDesde = Math.floor((hoy - fb) / 86400000);
            if (diasDesde < dias) continue;
            const diasVencido = diasDesde - dias;
            if (diasVencido > CRON_MARGEN_DIAS) { resumen.omitidas_margen++; continue; }
            debeEnviar = true;
          }

          resumen.revisadas++;
          if (!debeEnviar && !consumirManual) continue;

          try {
            let nuevosAuto04 = null;
            if (debeEnviar) {
              const _d04 = _destinatariosCcpp(comu);
              const dest04 = _d04.to;
              const destCc04 = _d04.cc;
              if (!dest04) { resumen.errores++; resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Falta email del administrador y del presidente" }); continue; }
              if (!plantilla.cuenta_envio) {
                console.warn(`[presupuestos][cron][04] plantilla sin cuenta_envio: ${comu.direccion}`);
                resumen.errores++;
                resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Plantilla sin cuenta de envío configurada" });
                continue;
              }
              const asuntoSus04  = (await sustituirVariablesAsync(plantilla.asunto, comu))  || "";
              const mensajeSus04 = (await sustituirVariablesAsync(plantilla.mensaje, comu)) || "";
              const msgIdEnviado04 = await enviarMailReal({
                cuentaId: plantilla.cuenta_envio,
                destinatario: dest04,
                cc:  destCc04,
                cco: plantilla.cco,
                asunto: asuntoSus04,
                mensaje: mensajeSus04,
                adjuntosUrls: String(plantilla.adjuntos_fijos || "").split(/\|\||[\r\n]+/).map(s => s.trim()).filter(Boolean),
              });
              await registrarMailEnHistorico({
                fecha: new Date().toISOString(), ccpp_id: comu.ccpp_id || comu._rowIndex,
                direccion: comu.direccion || comu.comunidad, fase,
                destinatario: dest04,
                asunto: asuntoSus04, mensaje: mensajeSus04,
                adjuntos: plantilla.adjuntos_fijos || "", tipo: "automatico",
                message_id: msgIdEnviado04,
              });
              // v17.29: NO reseteamos los automáticos al consumir fecha manual.
              // Sumamos siempre: numAutomaticos crece más allá de max_envios,
              // lo que permite detectar ampliación (badge "👎 Retrasado" permanente).
              enviados[fase] = (enviados[fase] || 0) + 1;
              nuevosAuto04 = numAutomaticos + 1;
              // Sembrar manuales si era CCPP antiguo (compat)
              if (manuales[fase] === undefined) {
                manuales[fase] = numManualesAct;
                comu.mails_manuales = JSON.stringify(manuales);
              }
              ultimo[fase] = new Date().toISOString().slice(0, 10);
              comu.mails_enviados = JSON.stringify(enviados);
              comu.mails_ultimo_envio = JSON.stringify(ultimo);
              resumen.enviadas++;
            }
            if (consumirManual) {
              comu.fecha_proximo_mail_manual = "";
            }
            await actualizarComunidad(comu._rowIndex, comu);
          } catch (e) {
            console.error(`[presupuestos][cron] error enviando a ${comu.direccion}:`, e.message);
            resumen.errores++;
            resumen.detalleErrores.push({ direccion: comu.direccion || comu.comunidad, fase, motivo: "Error al enviar: " + e.message });
          }
          continue;
        }
      }
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoResumen = resumen;
      cronStatus.ultimoError = null;
      cronStatus.ultimosErrores = resumen.detalleErrores || [];
      console.log(`[presupuestos][cron] ${inicio.toISOString()} - revisadas:${resumen.revisadas} enviadas:${resumen.enviadas} descartadas:${resumen.descartadas} omitidas_margen:${resumen.omitidas_margen} errores:${resumen.errores}`);
      return resumen;
    } catch (e) {
      cronStatus.ultimoTick = inicio.toISOString();
      cronStatus.ultimoError = e.message;
      cronStatus.ultimosErrores = [{ direccion: "(global)", fase: "-", motivo: e.message }];
      console.error("[presupuestos][cron] error global:", e.message);
      throw e;
    }
  }

  // Programar el cron interno: 1 vez al día (24h)
  // Primera ejecución a los 60s del arranque (para que la app esté lista)
  if (typeof setInterval === "function") {
    setTimeout(() => {
      ejecutarCronEnviosAutomaticos().catch(() => {});
    }, 60 * 1000);
    setInterval(() => {
      ejecutarCronEnviosAutomaticos().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }

  // Job de verificación de adjuntos de plantillas CRON: cada hora comprueba
  // que los links de Drive de plantillas con cadencia automática (dr > 0)
  // siguen accesibles. Alimenta _adjuntosRotos para el botón HOY.
  // Es muy ligero (solo cabeceras HTTP), no descarga nada.
  async function verificarAdjuntosDePlantillasCron() {
    try {
      // v17.20: usa el caché compartido en vez de leer directamente
      const rows = await _leerFilasMailPlantillas();
      // Cabecera: A fase | B activo | C asunto | D mensaje | E adjuntos | F dpe | G dr | H max | ...
      const urls = new Set();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const fase = String(row[0]).trim();
        if (fase.startsWith("_")) continue;
        const activo = (row[1] || "SI").toUpperCase() === "SI";
        if (!activo) continue;
        const dr = parseInt(row[6], 10);
        if (!(dr > 0)) continue; // solo plantillas con cadencia automática
        const adj = row[4] || "";
        for (const e of parsearAdjuntosTexto(adj)) {
          if (e.url && extraerIdDrive(e.url)) urls.add(e.url);
        }
      }
      // Verificar cada URL
      for (const url of urls) {
        const { ok, motivo } = await verificarLinkDrive(url);
        if (ok) {
          _adjuntosRotos.delete(url);
        } else {
          _adjuntosRotos.set(url, { ultimaComprobacion: new Date(), motivo });
        }
      }
    } catch (e) {
      console.warn("[presupuestos] verificarAdjuntosDePlantillasCron falló:", e.message);
    }
  }
  if (typeof setInterval === "function") {
    setTimeout(() => { verificarAdjuntosDePlantillasCron().catch(() => {}); }, 90 * 1000);
    setInterval(() => { verificarAdjuntosDePlantillasCron().catch(() => {}); }, 60 * 60 * 1000);
  }

  // GET /presupuestos/cron-status — diagnóstico del cron
  // GET /presupuestos/adjuntos-rotos
  // Devuelve los links de Drive que han fallado en el último intento de envío
  // o en la última verificación periódica. Para el botón HOY.
  app.get("/presupuestos/adjuntos-rotos", async (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      ok: true,
      rotos: listarAdjuntosRotos(),
    });
  });

  app.get("/presupuestos/cron-status", async (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      ok: true,
      ultimoTick: cronStatus.ultimoTick,
      ultimoResumen: cronStatus.ultimoResumen,
      ultimoError: cronStatus.ultimoError,
      ultimosErrores: cronStatus.ultimosErrores || [],
      proximoTick: "cada 24h desde el arranque",
      fases_automaticas: CRON_FASES_AUTO,
      margen_dias: CRON_MARGEN_DIAS,
    });
  });

  // POST /presupuestos/cron-run — ejecutar cron manualmente (para pruebas).
  // Protegido contra doble disparo:
  //   - Mutex: si ya hay un cron corriendo, devuelve 409 sin lanzar otro.
  //   - Throttle: si el último cron terminó hace menos de 2 min, rebota con 429.
  let _cronEnMarcha = false;
  const _CRON_THROTTLE_MS = 2 * 60 * 1000;
  app.post("/presupuestos/cron-run", async (req, res) => {
    if (!checkToken(req, res)) return;
    if (_cronEnMarcha) {
      return res.status(409).json({ error: "Ya hay un cron en marcha. Espera a que termine." });
    }
    if (cronStatus.ultimoTick) {
      const dt = Date.now() - new Date(cronStatus.ultimoTick).getTime();
      if (dt < _CRON_THROTTLE_MS) {
        const seg = Math.ceil((_CRON_THROTTLE_MS - dt) / 1000);
        return res.status(429).json({ error: `El cron se ejecutó hace muy poco. Espera ${seg}s antes de volver a lanzarlo.` });
      }
    }
    _cronEnMarcha = true;
    try {
      const resumen = await ejecutarCronEnviosAutomaticos();
      res.json({ ok: true, resumen });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      _cronEnMarcha = false;
    }
  });

  // =================================================================
  // ENDPOINTS IMAP (mails entrantes)
  // =================================================================

  // POST /presupuestos/imap-run — ejecutar una pasada manual del IMAP.
  app.post("/presupuestos/imap-run", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const r = await ejecutarLecturaImap();
      res.json(r);
    } catch (e) {
      console.error("[presupuestos] /imap-run:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/imap-importar-drive — importar .eml sueltos de Drive.
  // Lee la carpeta DRIVE_FOLDER_EML_IMPORTAR, procesa cada .eml igual que
  // el cron IMAP (parseo, stripping, clasificación, adjuntos, pendientes)
  // y mueve cada .eml a la subcarpeta "Procesados".
  app.post("/presupuestos/imap-importar-drive", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const r = await importarEmlsDeDrive();
      res.json(r);
    } catch (e) {
      console.error("[presupuestos] /imap-importar-drive:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/mails-pendientes — devuelve los mails pendientes en JSON.
  app.get("/presupuestos/mails-pendientes", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const lista = await leerMailsPendientes();
      res.json({ ok: true, total: lista.length, mails: lista });
    } catch (e) {
      console.error("[presupuestos] /mails-pendientes:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-clasificar — asigna un mail pendiente a un expediente.
  // body: id (id del mail pendiente), ccpp_id (expediente destino)
  app.post("/presupuestos/mail-clasificar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      if (!id || !ccpp_id) return res.status(400).json({ error: "Faltan id o ccpp_id" });
      // Recuperar mail pendiente
      const pendientes = await leerMailsPendientes();
      const mail = pendientes.find(p => p.id === id);
      if (!mail) return res.status(404).json({ error: "Mail pendiente no encontrado" });
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      // Mover adjuntos a la subcarpeta "adjuntos" del expediente (si los hay).
      // No bloquea: si falla Drive, seguimos con la clasificación.
      let adjuntosFinales = mail.adjuntos;
      try {
        adjuntosFinales = await _moverAdjuntosACarpetaExpediente(mail.adjuntos, comu);
      } catch (eMov) {
        console.warn("[presupuestos] No se pudieron mover adjuntos al clasificar:", eMov.message);
      }
      // Detectar si es saliente (remitente = nuestra cuenta).
      // Si lo es: tipo "manual_externo", extraer destinatario real del prefijo
      // [TO:...] que añadió el importador al cuerpo, y limpiar ese prefijo del mensaje.
      const esSalienteCl = String(mail.remitente || "").toLowerCase().includes("administracion@instalacionesaraujo.com");
      let destinatarioCl = mail.remitente;
      let mensajeCl = mail.cuerpo || "";
      if (esSalienteCl) {
        const mTo = mensajeCl.match(/^\[TO:([^\]]+)\]\s*\n?/);
        if (mTo) {
          destinatarioCl = mTo[1].trim();
          mensajeCl = mensajeCl.slice(mTo[0].length);
        }
      }
      // Registrar en mail_historico
      await registrarMailEnHistorico({
        fecha: mail.fecha_recepcion,
        ccpp_id: comu.ccpp_id,
        direccion: comu.direccion,
        fase: normalizarFase(comu.fase_presupuesto),
        destinatario: destinatarioCl,
        asunto: mail.asunto,
        mensaje: mensajeCl,
        adjuntos: adjuntosFinales,
        tipo: esSalienteCl ? "manual_externo" : "manual_entrada",
        message_id: mail.message_id,
      });
      // Actualizar fila en mails_pendientes con estado=clasificado.
      // NO se borra: el mail sigue apareciendo en HOY hasta que el usuario
      // pulse el reloj para sacarlo. Esto es lo que permite "seguir trabajando
      // el mail desde HOY incluso después de clasificarlo".
      await _actualizarEstadoMailPendiente(id, "clasificado", ccpp_id);
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-clasificar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-descartar — borra físicamente el mail pendiente
  // (fila + adjuntos a papelera Drive). El nombre se mantiene por compat con
  // el frontend, pero ahora borra de verdad.
  app.post("/presupuestos/mail-descartar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const ok = await _borrarMailPendiente(id);
      if (!ok) return res.status(404).json({ error: "Mail pendiente no encontrado" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] /mail-descartar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /presupuestos/mail-toggle-hoy — alterna la presencia de un mail en HOY.
  // Hay dos puntos de entrada:
  //   - Desde HOY (con id de mails_pendientes): siempre quita de HOY (borra fila).
  //   - Desde Comunicaciones del expediente (con message_id de mail_historico):
  //       si el mail está en HOY → lo saca (borra fila de pendientes).
  //       si NO está → lo añade (crea fila nueva en pendientes con estado=clasificado).
  // body: message_id (preferente) o id (id de pendientes)
  app.post("/presupuestos/mail-toggle-hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      const messageId = String(req.body.message_id || "").trim();
      if (!id && !messageId) return res.status(400).json({ error: "Falta id o message_id" });

      // Buscar si existe ya una fila en mails_pendientes
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAILS_PENDIENTES,
      });
      const rows = r.data.values || [];
      let filaIdx = -1;
      let filaId = "";
      let adjuntosFila = "";
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const estado = String(row[10] || "pendiente");
        if (estado === "descartado") continue;
        if (id && String(row[0] || "") === id) { filaIdx = i; filaId = row[0]; adjuntosFila = row[8] || ""; break; }
        if (messageId && String(row[2] || "").trim() === messageId) { filaIdx = i; filaId = row[0]; adjuntosFila = row[8] || ""; break; }
      }

      if (filaIdx >= 0) {
        // Está en HOY → quitar. Borrar fila SIN papelear adjuntos
        // (porque están enlazados desde mail_historico del expediente).
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        const hoja = meta.data.sheets.find(s => s.properties.title === "mails_pendientes");
        if (!hoja) throw new Error("Pestaña mails_pendientes no encontrada");
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: hoja.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: filaIdx,
                  endIndex: filaIdx + 1,
                },
              },
            }],
          },
        });
        return res.json({ ok: true, accion: "quitado" });
      }

      // No está en HOY → añadir. Necesitamos los datos del mail desde mail_historico.
      if (!messageId) {
        return res.status(400).json({ error: "Para añadir a HOY se necesita message_id" });
      }
      const rH = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      const rowsH = rH.data.values || [];
      let filaH = null;
      for (let i = 1; i < rowsH.length; i++) {
        if (String(rowsH[i][9] || "").trim() === messageId) {
          filaH = rowsH[i];
          break;
        }
      }
      if (!filaH) return res.status(404).json({ error: "Mail no encontrado en mail_historico" });
      const idPendiente = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await _guardarMailPendiente({
        id: idPendiente,
        fecha_recepcion: filaH[0] || new Date().toISOString(),
        message_id: filaH[9] || "",
        in_reply_to: "",
        references: "",
        remitente: filaH[4] || "",   // en entrantes, destinatario es el remitente original
        asunto: filaH[5] || "",
        cuerpo: filaH[6] || "",
        adjuntos: filaH[7] || "",
        sugerencias: [],
        estado: "clasificado",
        clasificado_a: filaH[1] || "",
      });
      res.json({ ok: true, accion: "anadido" });
    } catch (e) {
      console.error("[presupuestos] /mail-toggle-hoy:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // PANTALLA HOY — bandejas de tareas pendientes
  // =================================================================
  // Tres cajitas: Mails pendientes, Decidir, Adjuntos rotos.
  app.get("/presupuestos/hoy", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      // 1) Mails pendientes
      const mailsPendientes = await leerMailsPendientes();
      // 2) Avisos de plazo: CCPPs en estado "decidir" o "retrasado"
      //    (incluye fases 01, 04, 05 y 08 — ver calcularEstadoPlazo).
      let avisosPlazo = [];
      // v17.31: estos dos se usan tanto para avisosPlazo como para las cajas de fase.
      // Por eso se declaran FUERA del try interno.
      const plantillasHoy = {};
      let f1MapHoy = {};
      try {
        // Cargar plantillas de las 4 fases con reenvíos (una sola vez)
        try {
          const arr = await Promise.all(FASES_CON_REENVIOS.map(f => leerPlantillaMail(plantillaDeFase(f)).catch(() => null)));
          FASES_CON_REENVIOS.forEach((f, i) => { plantillasHoy[f] = arr[i] || null; });
        } catch (_) { /* ignore */ }
        // v17.30: leer mail_historico completo UNA vez y construir índice F1
        // a partir de los CONTADORES de cada CCPP (no del histórico).
        const comus = await leerComunidades();
        try {
          const histo = await leerMailHistoricoCompleto();
          f1MapHoy = _indexarF1PorCcppFase(comus, histo, plantillasHoy);
        } catch (_) { /* ignore */ }
        for (const c of comus) {
          const fase = normalizarFase(c.fase_presupuesto);
          if (fase === "ZZ_RECHAZADO" || fase === "ZZ_DESCARTADO") continue;
          const ep = calcularEstadoPlazo(c, plantillasHoy[fase] || null, f1MapHoy);
          if (ep && (ep.estado === "decidir" || ep.estado === "retrasado")) {
            avisosPlazo.push({
              ccpp_id: c.ccpp_id,
              direccion: c.direccion || c.comunidad || "",
              tipo_via: c.tipo_via || "",
              fase,
              estado: ep.estado,
              fechaAviso: ep.fechaAviso,
              diasRetraso: ep.diasRetraso,
            });
          }
        }
        // Orden: más antiguos arriba (fechaAviso ascendente)
        avisosPlazo.sort((a, b) => String(a.fechaAviso).localeCompare(String(b.fechaAviso)));
      } catch (e) { console.warn("[presupuestos][hoy] avisos_plazo:", e.message); }
      // 3) Adjuntos rotos: usa la lista en memoria.
      let adjRotos = [];
      try { adjRotos = listarAdjuntosRotos(); } catch (_) { adjRotos = []; }

      // Helper para escapar HTML
      const _esc = s => String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

      // Para el desplegable "cambiar a otro expediente"
      let comusListado = [];
      try {
        comusListado = await leerComunidades();
      } catch (_) { comusListado = []; }
      const comusActivos = comusListado.filter(c => {
        const f = normalizarFase(c.fase_presupuesto);
        return f !== "ZZ_RECHAZADO" && f !== "ZZ_DESCARTADO";
      });
      // Ordenar alfabéticamente por dirección
      comusActivos.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
      const optsExpedientes = comusActivos
        .map(c => `<option value="${_esc(c.ccpp_id)}">${_esc(c.direccion || c.ccpp_id)}</option>`)
        .join("");
      // Mapa ccpp_id -> direccion (para resolver `clasificado_a` y mostrarlo).
      const mapaCcpp = {};
      for (const c of comusListado) {
        if (c.ccpp_id) mapaCcpp[c.ccpp_id] = c.direccion || c.ccpp_id;
      }

      // Formato fecha "dd-mm-aa hh:mm" zona Madrid (igual que cajita Comunicaciones)
      const fmtFechaHoy = (s) => {
        if (!s) return "";
        const t = Date.parse(s);
        if (isNaN(t)) return String(s);
        const d = new Date(t);
        const partes = new Intl.DateTimeFormat('es-ES', {
          timeZone: 'Europe/Madrid',
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        const dd = partes.day, mm = partes.month, aa = partes.year;
        const hh = partes.hour === '24' ? '00' : partes.hour;
        const mi = partes.minute;
        return `${dd}-${mm}-${aa} ${hh}:${mi}`;
      };

      const renderMailPendiente = (m, idx) => {
        const fechaTxt = fmtFechaHoy(m.fecha_recepcion);
        const remitenteTxt = String(m.remitente || "—").trim();
        const asuntoTxt = String(m.asunto || "").trim() || "(sin asunto)";
        const cuerpo = String(m.cuerpo || "");
        const adjTxt = String(m.adjuntos || "").trim();
        // Detectar si es saliente: el remitente coincide con nuestra cuenta.
        const esSaliente = remitenteTxt.toLowerCase().includes("administracion@instalacionesaraujo.com");
        const flechaTxt = esSaliente ? "▲" : "▼";
        const flechaColor = esSaliente ? "var(--ptl-brand)" : "var(--ptl-danger)";

        // Desplegable UNIFICADO (sin sugerencias automáticas):
        //   - Si el mail está ASIGNADO → fondo verde, "✓ <direccion>" seleccionado.
        //   - Si NO está asignado → fondo amarillo, "— elegir expediente —" seleccionado.
        // Al cambiar la selección a un expediente distinto, el JS confirma y
        // llama a /presupuestos/mail-clasificar.
        const dirAsignadaSel = m.clasificado_a ? mapaCcpp[m.clasificado_a] : null;
        let selectBgStyle;
        let opcionInicialHtml;
        let valorInicial = "";
        let excluirCcpp = "";
        if (m.clasificado_a && dirAsignadaSel) {
          selectBgStyle = "background:#D1FAE5;color:#065F46;font-weight:600";
          opcionInicialHtml = `<option value="${_esc(m.clasificado_a)}" selected>✓ ${_esc(dirAsignadaSel)}</option>`;
          valorInicial = m.clasificado_a;
          excluirCcpp = m.clasificado_a;
        } else {
          // Sin asignar: fondo amarillo y "— elegir expediente —".
          selectBgStyle = "background:#FEF3C7;color:#92400E;font-weight:600";
          opcionInicialHtml = `<option value="" selected>— elegir expediente —</option>`;
        }
        const optsFiltrados = comusActivos
          .filter(c => c.ccpp_id !== excluirCcpp)
          .map(c => `<option value="${_esc(c.ccpp_id)}">${_esc(c.direccion || c.ccpp_id)}</option>`)
          .join("");
        const selectAsignar = `<select class="hoy-select-unif" data-mail-id="${_esc(m.id)}" data-valor-inicial="${_esc(valorInicial)}" title="Asignar a expediente" style="padding:2px 4px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-size:11px;max-width:220px;${selectBgStyle}">${opcionInicialHtml}${optsFiltrados}</select>`;

        const renderAdj = adjTxt
          ? `<div style="margin-top:6px"><strong>Adjuntos:</strong><div style="font-size:11px;color:var(--ptl-gray-700);white-space:pre-wrap;word-break:break-word">${_esc(adjTxt).replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--ptl-brand);text-decoration:underline">$1</a>').replace(/ \|\| /g, "\n")}</div></div>`
          : "";

        const bgFilaMail = (idx % 2 === 1) ? "background:#E0E2E6;" : "background:#FFFFFF;";
        return `
          <div class="ptl-com-row" data-idx="${idx}" style="${bgFilaMail}border-bottom:1px solid var(--ptl-gray-100)">
            <div class="ptl-com-grid" style="display:grid;grid-template-columns:75px 18px 1fr auto 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px;padding:0 6px;line-height:1.1">
              <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${_esc(fechaTxt)}</div>
              <div style="text-align:center;color:${flechaColor};font-weight:600">${flechaTxt}</div>
              <div class="hoy-toggle-detail hoy-asunto-clic" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-800)" title="${_esc(remitenteTxt)} — ${_esc(asuntoTxt)}">${_esc(asuntoTxt)}</div>
              <div>${selectAsignar}</div>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-responder" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Responder (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↩</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reenviar" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Reenviar (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↪</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reloj" data-mail-id="${_esc(m.id)}" title="Quitar de HOY" style="background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold">⏰</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar hoy-descartar" data-mail-id="${_esc(m.id)}" title="Borrar este mail (incluidos sus adjuntos en Drive)">✕</button>
            </div>
            <div class="hoy-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
              <div style="margin-bottom:4px"><strong>Remitente:</strong> ${_esc(remitenteTxt)}</div>
              <div style="margin-bottom:4px"><strong>Asunto:</strong> ${_esc(asuntoTxt)}</div>
              <div style="margin-bottom:4px"><strong>Mensaje:</strong></div>
              <div style="white-space:pre-line;word-break:break-word;background:#fff;padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800);max-height:200px;overflow-y:auto">${_renderCuerpoMail(cuerpo, _esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
              ${renderAdj}
            </div>
          </div>
        `;
      };

      const cajaMails = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title" style="margin:0">📥 Mails pendientes (${mailsPendientes.length})</div>
            <div style="display:flex;gap:6px">
              <button type="button" id="hoy-imap-run" class="ptl-btn ptl-btn-secondary ptl-btn-sm">📥 Leer correo ahora</button>
              <button type="button" id="hoy-imap-importar-drive" class="ptl-btn ptl-btn-secondary ptl-btn-sm">📂 Importar correo de Drive</button>
            </div>
          </div>
          <style>
            .hoy-mails-list .ptl-vec-btn{width:18px;height:18px;font-size:9px}
          </style>
          ${mailsPendientes.length === 0
            ? `<div class="ptl-empty-msg">— Sin mails pendientes —</div>`
            : `<div class="hoy-mails-list" style="overflow:visible;border:1px solid var(--ptl-gray-200);border-radius:5px;background:#fff">${mailsPendientes.map((m, i) => renderMailPendiente(m, i)).join("")}</div>`
          }
        </div>
      `;

      // ============================================================
      // v17.51 — Caja "Expedientes en HOY"
      // v17.52 — Ampliada con sub-filas de pisos con reloj activo.
      //
      // Lista las CCPPs con campo en_hoy === "1". Para cada una, debajo,
      // muestra los pisos (de pestaña `pisos`) con en_hoy === "1" de esa CCPP.
      // Un expediente puede aparecer sin pisos (solo cabecera) si solo se
      // activó el reloj del expediente pero ningún piso.
      //
      // Filas:
      //   - Cabecera CCPP:  [tipo_via direccion] | [notas_pto editable] | [⏰]
      //   - Fila piso:      [   piso] [nombre] [tel] [docs N/M] [notas_piso editable] [⏰]
      //
      // El reloj del expediente "quita de HOY" la CCPP (en_hoy=""). NOTA: si
      // hay pisos con reloj activo, el código del cliente AVISARÁ antes de
      // quitar; no los desactiva en cascada (los pisos quedan con en_hoy="1"
      // y el expediente se reactivará automáticamente al pulsar cualquier reloj
      // de piso, o si tú lo reactivas).
      // El reloj del piso "quita ese piso de HOY".
      // ============================================================
      const expedientesEnHoy = comusListado
        .filter(c => String(c.en_hoy || "").trim() === "1")
        .sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));

      // v17.55 — Leer TODOS los pisos en una sola pasada. Además de
      // nombre/telefono/en_hoy/notas_piso, se extraen los estados manuales
      // (est_piso_*) y se calcula el contador docs N/M reusando _resumenManual
      // (la misma regla que calcularResumenManual de doc.cjs). Así evitamos
      // hacer una llamada a Sheets por cada CCPP en HOY.
      // Hace falta docsPiso (lista de documentos manuales nivel PISO) para
      // saber qué columnas extraer y aplicar _resumenManual con el orden correcto.
      const pisosEnHoyPorCcpp = {};
      try {
        const dm = await _leerDocsManuales();
        const docsPisoHoy = dm.docsPiso || [];
        const sheetsHoy = getSheetsClient();
        const r = await sheetsHoy.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
        const rowsP = r.data.values || [];
        if (rowsP.length >= 2) {
          const hdr = rowsP[0];
          const idxCom = hdr.indexOf("comunidad");
          const idxViv = hdr.indexOf("vivienda");
          const idxNom = hdr.indexOf("nombre");
          const idxTlf = hdr.indexOf("telefono");
          const idxEnHoy = hdr.indexOf("en_hoy");
          const idxNotasP = hdr.indexOf("notas_piso");
          // Columnas est_piso_* en el orden de docsPisoHoy. -1 si falta.
          const idxEstByCod = {};
          for (const d of docsPisoHoy) idxEstByCod[d.codigo] = hdr.indexOf("est_" + d.codigo);
          const normDir = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
          if (idxEnHoy >= 0) {
            for (let i = 1; i < rowsP.length; i++) {
              const f = rowsP[i];
              if (!f) continue;
              const enHoyV = String(f[idxEnHoy] || "").trim();
              if (enHoyV !== "1") continue;
              const dir = normDir(f[idxCom] || "");
              if (!pisosEnHoyPorCcpp[dir]) pisosEnHoyPorCcpp[dir] = [];
              // Extraer estados en el orden de docsPisoHoy.
              const estados = docsPisoHoy.map(d => {
                const ci = idxEstByCod[d.codigo];
                return ci >= 0 ? String(f[ci] || "").trim() : "";
              });
              // Reusar _resumenManual: misma lógica que doc.cjs.
              let docsTxt = "";
              try {
                const r2 = _resumenManual(estados);
                docsTxt = (r2.totalRel > 0) ? (r2.hechos + "/" + r2.totalRel) : "";
              } catch (_) {}
              pisosEnHoyPorCcpp[dir].push({
                vivienda: String(f[idxViv] || "").trim(),
                nombre:   idxNom >= 0 ? String(f[idxNom] || "").trim() : "",
                telefono: idxTlf >= 0 ? String(f[idxTlf] || "").trim() : "",
                notas_piso: idxNotasP >= 0 ? String(f[idxNotasP] || "").trim() : "",
                docs: docsTxt,
              });
            }
          }
        }
      } catch (e) {
        console.warn("[presupuestos][hoy] pisosEnHoy:", e.message);
      }
      const normDir2 = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

      // v17.55 — Estilo unificado con las cajitas 02/04/05/08:
      //   - font 11px, line-height 1.1, padding 0 6px, min-height 22px
      //   - cebra blanco / #E0E2E6
      //   - botones reloj tamaño estándar (igual que el de mails pendientes)
      //   - flex layout con celdas piso/nombre/teléfono/docs/notas/⏰
      // No usamos la clase ptl-lista-fila genérica para no chocar con la cebra
      // global; pegamos los mismos colores inline para que el orden visual sea
      // exp / piso / piso / exp / piso / ... y no orden de DOM par/impar.
      const renderFilaPiso = (p, ccppId, filaIdx) => {
        const notas = _esc(p.notas_piso || "");
        // v17.59 — Las filas de piso van SIEMPRE blancas. La cebra ya no
        // alterna por filaIdx; el color uniforme blanco contrasta con la
        // cabecera gris fija del bloque CCPP padre.
        const bgPiso = "#FFFFFF";
        return `
          <div class="hoy-piso-fila" data-ccpp-id="${_esc(ccppId)}" data-vivienda="${_esc(p.vivienda)}" style="display:flex;align-items:center;gap:4px;padding:0 6px 0 22px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgPiso}">
            <span class="hoy-piso-num" style="flex:0 0 50px;font-weight:600;color:#374151">${_esc(p.vivienda || "")}</span>
            <span class="hoy-piso-nombre" style="flex:0 0 170px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nombre || "")}</span>
            <span class="hoy-piso-tlf" style="flex:0 0 90px;color:#6B7280;white-space:nowrap">${_esc(p.telefono || "")}</span>
            <span class="hoy-piso-docs" style="flex:0 0 32px;color:#6B7280;text-align:center;font-weight:600">${_esc(p.docs || "")}</span>
            <textarea class="hoy-piso-notas"
                      data-ccpp-id="${_esc(ccppId)}"
                      data-vivienda="${_esc(p.vivienda)}"
                      data-orig="${notas}"
                      rows="1"
                      placeholder="(sin notas)"
                      style="flex:1;margin-left:8px;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>
            <button type="button"
                    class="ptl-vec-btn hoy-piso-reloj"
                    data-ccpp-id="${_esc(ccppId)}"
                    data-vivienda="${_esc(p.vivienda)}"
                    title="Quitar piso de HOY"
                    style="background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold;flex:0 0 auto;width:18px;height:18px;font-size:9px">⏰</button>
          </div>
        `;
      };

      const renderExpedienteEnHoy = (c, bloqueIdx) => {
        const titulo = `${_esc(c.tipo_via || "")} ${_esc(c.direccion || "")}`.trim();
        const notas = _esc(c.notas_pto || "");
        const urlFicha = `/presupuestos/expediente?id=${encodeURIComponent(c.ccpp_id)}&token=${encodeURIComponent(token)}`;
        const pisos = pisosEnHoyPorCcpp[normDir2(c.direccion || c.comunidad)] || [];
        const filasPisos = pisos.map((p, i) => renderFilaPiso(p, c.ccpp_id, i)).join("");
        // v17.59 — Cebra fija: TODAS las cabeceras de CCPP en gris #E0E2E6
        // (independiente del bloqueIdx). Las filas de piso van siempre blancas.
        // Decisión Guille: identificar el bloque por color uniforme.
        const bgCab = "#E0E2E6";
        return `
          <div class="hoy-exp-bloque" data-ccpp-id="${_esc(c.ccpp_id)}">
            <div class="hoy-exp-fila" data-ccpp-id="${_esc(c.ccpp_id)}" style="display:flex;align-items:center;gap:8px;padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgCab}">
              <a href="${_esc(urlFicha)}" class="hoy-exp-titulo" style="flex:0 0 160px;font-weight:700;color:var(--ptl-gray-700);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(titulo)}">${titulo}</a>
              <textarea class="hoy-exp-notas" data-ccpp-id="${_esc(c.ccpp_id)}" data-orig="${notas}" rows="1" placeholder="(sin notas)" style="flex:1;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>
              <button type="button"
                      class="ptl-vec-btn hoy-exp-reloj"
                      data-ccpp-id="${_esc(c.ccpp_id)}"
                      data-pisos-activos="${pisos.length}"
                      title="Quitar de HOY"
                      style="background:var(--ptl-warning-light);color:#4F46E5;border:1px solid var(--ptl-warning);box-shadow:0 0 6px rgba(245,158,11,0.6);font-weight:bold;flex:0 0 auto;width:18px;height:18px;font-size:9px">⏰</button>
            </div>
            ${filasPisos}
          </div>
        `;
      };

      const cajaExpedientesHoy = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title" style="margin:0">📋 Expedientes HOY (${expedientesEnHoy.length})</div>
          </div>
          ${expedientesEnHoy.length === 0
            ? `<div style="padding:8px 4px;color:var(--ptl-gray-500);font-size:11px;font-style:italic">— Sin expedientes marcados —</div>`
            : `<div class="hoy-exp-list" style="border:1px solid var(--ptl-gray-200);border-radius:5px;background:#fff;overflow:hidden">${expedientesEnHoy.map((c, i) => renderExpedienteEnHoy(c, i)).join("")}</div>`
          }
        </div>
      `;

      // Formato fecha aviso "DD/MM/AA"
      const fmtFechaAviso = (s) => {
        const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return "";
        return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
      };
      // Etiqueta corta de fase
      const labelFaseCorta = (f) => {
        if (f === "01_CONTACTO") return "01-Contacto";
        if (f === "04_ACEPTACION_PTO") return "04-Aceptación";
        if (f === "05_DOCUMENTACION") return "05-Documentación";
        if (f === "08_CYCP") return "08-CYCP";
        return f;
      };
      // v17.31: la caja "Avisos de plazo" ya no se usa; los badges se integran
      // dentro de las cajas 01/04/05/08. Se conserva el cálculo de avisosPlazo
      // arriba por si otra parte del código lo consume (no detectada hoy).


      // v17.39: cajita "DATOS ECONÓMICOS" — refinamiento visual + media mensual.
      // 4 cajas en UNA SOLA FILA, todas misma estructura (nº exp / importe / tiempo / beneficio).
      // Subconjuntos:
      //   1) TOTAL PRESUPUESTADO       → todos los expedientes (incl. ZZ_*) — sin beneficio
      //      + LÍNEA EXTRA: media mensual presupuestada (desde fecha_envio_pto más antigua a hoy)
      //   2) TOTAL ACEPTADO            → fases 05/06/07/08/09
      //   3) PENDIENTE DE TRAMITAR     → fases 05/06/07/08
      //   4) TOTAL TRAMITADO           → fase 09
      // Reglas "real si hay, si no previsto" para tiempo y beneficio.
      // Visual:
      //   - SUBTÍTULOS en negrita, VALORES sin negrita, todo en la misma línea
      //   - La coletilla de fases va dentro del paréntesis tras el título de la caja
      //   - La coletilla "(cuadrilla 5)" va dentro del paréntesis tras "Tiempo"
      const FASES_ACEPTADAS = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP","09_TRAMITADA"];
      const FASES_PENDIENTE_TRAMITAR = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
      const _num = (x) => {
        if (x == null || x === "") return 0;
        const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
        return isFinite(n) ? n : 0;
      };
      const _grupo = () => ({ n: 0, importe: 0, tiempo: 0, beneficio: 0 });
      const G = {
        presupuestado: _grupo(),
        aceptado: _grupo(),
        pendiente: _grupo(),
        tramitado: _grupo(),
        // v17.41: sub-grupos de tramitado según fecha_cobro rellena o no.
        // v17.42: además del importe, acumulan beneficio (real si > 0, si no
        // previsto — misma regla que el grupo padre).
        tramitadoCobrado:    { importe: 0, beneficio: 0 },
        tramitadoPorCobrar:  { importe: 0, beneficio: 0 },
      };
      // Para la media mensual: localizar la fecha_envio_pto más antigua.
      // El campo es ISO "YYYY-MM-DD" string; comparación lexicográfica funciona.
      let fechaEnvioMin = null;
      for (const c of comusListado) {
        const fase = normalizarFase(c.fase_presupuesto);
        const importe = _num(c.pto_total);
        const tprev   = _num(c.tiempo_previsto);
        const treal   = _num(c.tiempo_real);
        const bprev   = _num(c.beneficio_previsto);
        const breal   = _num(c.beneficio_real);
        const tiempoCuadrilla = ((treal > 0 ? treal : tprev) * 2) / 5;
        // v17.81 — Beneficio (Opción A acordada con Guille):
        //   - Si la obra YA tiene beneficio_real (campo no vacío): usar el real,
        //     pero si es NEGATIVO (pérdida) se cuenta como 0 (nunca resta del total).
        //   - Si aún NO tiene real (campo vacío): usar el previsto.
        // Distinguimos "real vacío" de "real = 0/negativo" mirando el dato CRUDO
        // (c.beneficio_real), porque _num convierte vacío en 0 y no permitiría
        // diferenciarlos. Antes la regla era (breal > 0 ? breal : bprev), que
        // ante un real negativo caía al previsto positivo y ocultaba la pérdida.
        const _tieneReal = !(c.beneficio_real == null || String(c.beneficio_real).trim() === "");
        const beneficio = _tieneReal ? Math.max(breal, 0) : bprev;
        // fecha_envio_pto más antigua (para el inicio del cómputo de la media)
        const fep = String(c.fecha_envio_pto || "").trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(fep)) {
          if (fechaEnvioMin == null || fep < fechaEnvioMin) fechaEnvioMin = fep;
        }
        // 1) Presupuestado: TODOS (incl. ZZ_*)
        G.presupuestado.n++;
        G.presupuestado.importe   += importe;
        G.presupuestado.tiempo    += tiempoCuadrilla;
        G.presupuestado.beneficio += beneficio;
        if (FASES_ACEPTADAS.includes(fase)) {
          G.aceptado.n++;
          G.aceptado.importe   += importe;
          G.aceptado.tiempo    += tiempoCuadrilla;
          G.aceptado.beneficio += beneficio;
        }
        if (FASES_PENDIENTE_TRAMITAR.includes(fase)) {
          G.pendiente.n++;
          G.pendiente.importe   += importe;
          G.pendiente.tiempo    += tiempoCuadrilla;
          G.pendiente.beneficio += beneficio;
        }
        if (fase === "09_TRAMITADA") {
          G.tramitado.n++;
          G.tramitado.importe   += importe;
          G.tramitado.tiempo    += tiempoCuadrilla;
          G.tramitado.beneficio += beneficio;
          // Sub-distribución: cobrado vs por cobrar (basado en fecha_cobro)
          const fco = String(c.fecha_cobro || "").trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(fco)) {
            G.tramitadoCobrado.importe   += importe;
            G.tramitadoCobrado.beneficio += beneficio;
          } else {
            G.tramitadoPorCobrar.importe   += importe;
            G.tramitadoPorCobrar.beneficio += beneficio;
          }
        }
      }
      // v17.81 — Tiempo mostrado en MESES (no días). g.tiempo viene en días de
      // cuadrilla-5 (ya con la fórmula ×2/5 aplicada). 1 mes = 22 días laborables.
      // 1 decimal. El sufijo " meses" deja claro la unidad (antes era " días").
      const fmtMeses = (n) => (n / 22).toFixed(1).replace(".", ",") + " meses";

      // Cálculo media mensual presupuestada.
      // mesesTranscurridos = diferencia en meses entre fechaEnvioMin y hoy.
      //   - Aproximación: días/30.4375 (días promedio del mes en año gregoriano).
      //   - Si <1 mes, ponemos 1 para evitar divisiones absurdas.
      let mediaMensual = 0;
      let labelFechaInicio = "";
      if (fechaEnvioMin) {
        const [yi, mi, di] = fechaEnvioMin.split("-").map(Number);
        const dIni = new Date(Date.UTC(yi, mi - 1, di));
        const dNow = new Date();
        const diasTrans = (dNow.getTime() - dIni.getTime()) / (1000 * 60 * 60 * 24);
        const mesesTrans = Math.max(1, diasTrans / 30.4375);
        mediaMensual = G.presupuestado.importe / mesesTrans;
        labelFechaInicio = `${String(di).padStart(2,"0")}-${String(mi).padStart(2,"0")}-${String(yi).slice(2)}`;
      }

      // Genera una caja con paleta de colores parametrizada y estructura uniforme.
      // - titulo: el nombre de la caja
      // - colFases: texto entre paréntesis bajo el título (2ª línea)
      // - g: objeto con n/importe/tiempo/beneficio
      // - paleta: colores
      // - opts: { showBeneficio?: boolean, extraHTML?: string }
      // v17.41: textos en negro (#111827) — solo los BORDES de cada caja
      // conservan el color identificativo de la paleta. El espacio del extra
      // de la caja 1 se compacta (sin border-top dashed para reducir hueco).
      const NEGRO = "#111827";
      const _cajaEconomica = (titulo, colFases, g, paleta, opts) => {
        opts = opts || {};
        const showBeneficio = opts.showBeneficio !== false;
        // v17.58 — sufijo opcional dentro del valor, p.ej. "(19,1%)"; se
        // renderiza más pequeño y a la izquierda del número para no confundirlo.
        const _linea = (label, valor, sufijo) => `
          <div style="display:flex;align-items:center;margin-top:5px;font-size:12px;color:${NEGRO};line-height:1.3;gap:6px">
            <strong style="white-space:nowrap">${label}</strong>
            <span class="ptl-hr-soft"></span>
            ${sufijo ? `<span style="white-space:nowrap;font-size:10px;font-style:italic;color:#6B7280">${sufijo}</span>` : ""}
            <span style="white-space:nowrap">${valor}</span>
          </div>`;
        // v17.56: la cajita es flex-column. extraHTML se empuja al fondo
        // (margin-top:auto en el wrapper) para que las cajitas alineen sus
        // bloques inferiores.
        // v17.57: opts.lineaSustitutivaBeneficio permite a la caja 1 (sin
        // beneficio) renderizar OTRA línea en el sitio donde iría "Beneficio"
        // (en caja 1 es "Media mensual"). Así las 4 cajitas tienen 4 líneas
        // de datos y el extraHTML arranca todas a la misma altura.
        const lineaCuarta = showBeneficio
          ? _linea("Beneficio", fmtMoneda(g.beneficio))
          : (opts.lineaSustitutivaBeneficio || "");
        return `
          <div style="background:#FFFFFF;border:1px solid ${paleta.border};border-radius:6px;padding:9px;color:${NEGRO};display:flex;flex-direction:column;min-height:100%">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700">
              ${titulo}
            </div>
            ${colFases ? `<div style="font-size:10px;margin-top:2px;font-weight:500">(${colFases})</div>` : ""}
            ${_linea("Nº expedientes", g.n, opts.pctN)}
            ${_linea("Importe", fmtMoneda(g.importe), opts.pctImporte)}
            ${_linea(`Tiempo <span style="font-weight:500">(cuadrilla 5)</span>`, fmtMeses(g.tiempo))}
            ${lineaCuarta}
            ${opts.extraHTML ? `<div style="margin-top:auto">${opts.extraHTML}</div>` : ""}
          </div>
        `;
      };
      const PAL = {
        gris:    { border:"#E5E7EB" },
        verde:   { border:"#A7F3D0" },
        azul:    { border:"#BFDBFE" },
        amarillo:{ border:"#FDE68A" },
      };
      // v17.57 — Caja 1: la línea "Media mensual" ocupa la posición de
      // "Beneficio" (las otras cajas tienen Beneficio ahí). Se pasa como
      // lineaSustitutivaBeneficio. El extra de la caja 1 queda reducido a
      // "inicio del cómputo" (anclado al fondo de la cajita).
      const lineaMediaMensualCaja1 = fechaEnvioMin ? `
        <div style="display:flex;align-items:center;margin-top:5px;font-size:12px;color:${NEGRO};line-height:1.3;gap:6px">
          <strong style="white-space:nowrap">Media mensual</strong>
          <span class="ptl-hr-soft"></span>
          <span style="white-space:nowrap">${fmtMoneda(mediaMensual)}</span>
        </div>
      ` : "";
      // v17.58 — Para que la línea separadora del extra de caja 1 quede a la
      // MISMA altura horizontal que las de cajas 2/3/4, el extra debe tener
      // la misma altura total. Las otras cajas tienen 3 líneas extra (Total +
      // Cobrado/hueco + Por cobrar/hueco), así que caja 1 añade 2 huecos
      // invisibles debajo de "inicio del cómputo".
      const extraPresupuestado = fechaEnvioMin ? `
        <div style="margin-top:7px;padding-top:5px;border-top:1px solid #D1D5DB">
          <div style="font-size:10px;font-style:italic;color:${NEGRO};line-height:1.3">
            inicio del cómputo: ${labelFechaInicio}
          </div>
          <div style="margin-top:2px;font-size:10px;line-height:1.3;visibility:hidden">·</div>
          <div style="margin-top:2px;font-size:10px;line-height:1.3;visibility:hidden">·</div>
        </div>
      ` : "";

      // v17.56 — Línea extra para la caja 4 (Total tramitado): 3 líneas Total/
      // Cobrado/Por cobrar con BENEFICIO × 20%. Tipografía igualada a la
      // línea "inicio del cómputo" de caja 1 (font-size:10px, itálica).
      const PCT_BENEF = 0.20;
      const _lineaExtra = (label, valor) => `
        <div style="display:flex;align-items:center;margin-top:2px;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
          <strong style="white-space:nowrap;font-style:normal">${label}</strong>
          <span class="ptl-hr-soft"></span>
          <span style="white-space:nowrap">${valor}</span>
        </div>
      `;
      // Hueco invisible con la misma altura que una línea extra (para alinear
      // cajas 2 y 3 con caja 4: ellas solo tienen Total (20%), caja 4 tiene
      // además Cobrado y Por cobrar).
      const _huecoExtra = `<div style="margin-top:2px;font-size:10px;line-height:1.3;visibility:hidden">·</div>`;
      const extraTramitado = `
        <div style="margin-top:7px;padding-top:5px;border-top:1px solid #D1D5DB">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span style="white-space:nowrap">${fmtMoneda(G.tramitado.beneficio * PCT_BENEF)}</span>
          </div>
          ${_lineaExtra("Cobrado", fmtMoneda(G.tramitadoCobrado.beneficio * PCT_BENEF))}
          ${_lineaExtra("Por cobrar", fmtMoneda(G.tramitadoPorCobrar.beneficio * PCT_BENEF))}
        </div>
      `;

      // v17.56 — Helper para extra "Total (20%)" en cajas 2 y 3.
      // v17.57 — Añade 2 huecos invisibles del mismo alto que Cobrado/Por cobrar
      // para que la caja completa tenga la misma altura que la caja 4 y los
      // "Total (20%)" queden a la misma altura horizontal.
      const _extraTotal20 = (g) => `
        <div style="margin-top:7px;padding-top:5px;border-top:1px solid #D1D5DB">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span style="white-space:nowrap">${fmtMoneda(g.beneficio * PCT_BENEF)}</span>
          </div>
          ${_huecoExtra}
          ${_huecoExtra}
        </div>
      `;
      const extraAceptado  = _extraTotal20(G.aceptado);
      const extraPendiente = _extraTotal20(G.pendiente);

      // v17.58 — Porcentajes para caja 2 (Aceptado): expedientes e importe
      // como fracción del Presupuestado (caja 1). Formato "(X,X%)" o "" si la
      // base es 0.
      const _fmtPct = (num, den) => {
        if (!den || den === 0) return "";
        const p = (num / den) * 100;
        const txt = p.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return "(" + txt + "%)";
      };
      const pctNAceptado       = _fmtPct(G.aceptado.n,       G.presupuestado.n);
      const pctImporteAceptado = _fmtPct(G.aceptado.importe, G.presupuestado.importe);

      const cajaAdjRotos = `
        <div class="ptl-card">
          <div class="ptl-card-title">💶 Datos económicos</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px">
            ${_cajaEconomica("Total presupuestado",   "todas las fases", G.presupuestado, PAL.gris,     { showBeneficio: false, extraHTML: extraPresupuestado, lineaSustitutivaBeneficio: lineaMediaMensualCaja1 })}
            ${_cajaEconomica("Total aceptado",        "fases 05-09",     G.aceptado,      PAL.verde,    { showBeneficio: true, extraHTML: extraAceptado, pctN: pctNAceptado, pctImporte: pctImporteAceptado })}
            ${_cajaEconomica("Pendiente de tramitar", "fases 05-08",     G.pendiente,     PAL.azul,     { showBeneficio: true, extraHTML: extraPendiente })}
            ${_cajaEconomica("Total tramitado",       "fase 09",         G.tramitado,     PAL.amarillo, { showBeneficio: true, extraHTML: extraTramitado })}
          </div>
        </div>
      `;

      // ============================================================
      // Cajitas 05-DOCUMENTACION y 08-CYCP en HOY.
      // Para cada CCPP de esas fases calculamos:
      //   - Faltan X de Y (basado en pisos del Sheet + documentos_manuales)
      //   - Info reenvíos automáticos (calcularInfoEnvioAuto con la plantilla)
      // ============================================================
      let cajaVisita = "";
      let cajaContacto = "";
      let cajaAceptacion = "";
      let cajaDoc = "";
      let cajaCycp = "";
      try {
        // Plantillas de reenvíos para 01, 04, 05 y 08
        const plt01 = await leerPlantillaMail(plantillaDeFase("01_CONTACTO")).catch(() => null);
        const plt04 = await leerPlantillaMail(plantillaDeFase("04_ACEPTACION_PTO")).catch(() => null);
        const plt05 = await leerPlantillaMail(plantillaDeFase("05_DOCUMENTACION")).catch(() => null);
        const plt08 = await leerPlantillaMail(plantillaDeFase("08_CYCP")).catch(() => null);
        const { docsCcpp, docsPiso } = await _leerDocsManuales();
        // Filtrar CCPPs por fase
        const en01 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "01_CONTACTO");
        const en02 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "02_VISITA");
        const en04 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "04_ACEPTACION_PTO");
        const en05 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "05_DOCUMENTACION");
        const en08 = comusListado.filter(c => {
          if (normalizarFase(c.fase_presupuesto) !== "08_CYCP") return false;
          return !c.fecha_cycp_completa; // solo los que NO tienen fecha rellena
        });
        // Ordenar por dirección
        en01.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
        en02.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
        en04.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
        en05.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));
        en08.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));

        // Helper común: calcula totalFilas + completas para una CCPP
        async function _calcFaltan(c) {
          try {
            const estadosCcpp = docsCcpp.map(d => String(c["est_" + d.codigo] || "").trim());
            const direccion = c.direccion || c.comunidad || "";
            const pisos = await _leerPisosDeCcpp(direccion, docsPiso);
            let totalFilas = 1; // la CCPP cuenta
            let completas = 0;
            const rCcpp = _resumenManual(estadosCcpp);
            if (rCcpp.totalRel > 0 && rCcpp.hechos >= rCcpp.totalRel) completas++;
            for (const p of pisos) {
              totalFilas++;
              const r = _resumenManual(p.estados);
              if (r.totalRel > 0 && r.hechos >= r.totalRel) completas++;
            }
            return { totalFilas, completas };
          } catch (_) { return { totalFilas: 0, completas: 0 }; }
        }

        // Renderiza una fila de expediente con su dirección + Faltan X/Y + badge plazo.
        // v17.31: ya no se muestra "📧 X+Y/Z - próximo reenvío DD/MM/YYYY".
        //          En su lugar, el badge 👍/⚠️/👎 calculado por calcularEstadoPlazo.
        function _renderFilaExp(c, plantilla, faltan, infoEnvio, idx, estadoPlazo) {
          const pendientes = faltan.totalFilas > 0 ? (faltan.totalFilas - faltan.completas) : 0;
          let pillFaltan;
          if (faltan.totalFilas === 0) {
            pillFaltan = `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#F3F4F6;color:#6B7280;white-space:nowrap">sin pisos</span>`;
          } else if (pendientes === 0) {
            pillFaltan = `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46;white-space:nowrap">✓ Completo</span>`;
          } else {
            pillFaltan = `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#FEE2E2;color:#991B1B;white-space:nowrap">Faltan ${pendientes} de ${faltan.totalFilas}</span>`;
          }
          const badgeHtml = renderBadgePlazo(estadoPlazo) || "";
          const url = urlT(token, "/presupuestos/expediente", { id: c.ccpp_id });
          const tipoVia = String(c.tipo_via || "").trim();
          const direccion = String(c.direccion || c.ccpp_id || "").trim();
          const tituloTxt = (tipoVia ? tipoVia + " " : "") + direccion;
          return `
            <div class="ptl-lista-fila">
              <a href="${url}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700" title="${_esc(tituloTxt)}">${_esc(tituloTxt)}</a>
              ${pillFaltan}
              ${badgeHtml}
            </div>
          `;
        }

        // Cálculo previo de datos para poder ordenar antes de renderizar.
        // Orden:
        //   1) fecha próximo reenvío ASC (más antiguo arriba).
        //      Sin fecha → al final.
        //   2) alfabético por dirección.
        async function _prepararListaFase(comus, plantilla) {
          const enriquecidos = await Promise.all(comus.map(async (c) => {
            const faltan = await _calcFaltan(c);
            let info = null;
            try {
              info = calcularInfoEnvioAuto(c, normalizarFase(c.fase_presupuesto), plantilla);
            } catch (_) { info = null; }
            // Extraer fecha próximo reenvío del texto "📧 X+Y/Z - próximo reenvío DD/MM/AAAA"
            // o devolver null si no hay.
            let fechaProx = null;
            if (info && info.texto) {
              const m = info.texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (m) fechaProx = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`).getTime();
            }
            return { c, faltan, info, fechaProx };
          }));
          enriquecidos.sort((a, b) => {
            // 1) fecha próximo reenvío ASC (null va al final)
            if (a.fechaProx == null && b.fechaProx == null) {
              return String(a.c.direccion || "").localeCompare(String(b.c.direccion || ""), "es");
            }
            if (a.fechaProx == null) return 1;
            if (b.fechaProx == null) return -1;
            if (a.fechaProx !== b.fechaProx) return a.fechaProx - b.fechaProx;
            // 2) alfabético dirección
            return String(a.c.direccion || "").localeCompare(String(b.c.direccion || ""), "es");
          });
          return enriquecidos;
        }

        // Formatea teléfono español a xxx-xxx-xxx (mantiene tal cual si no encajan 9 dígitos).
        function _fmtTel(tel) {
          const s = String(tel || "").replace(/\D/g, "");
          if (s.length === 9) return s.slice(0,3) + "-" + s.slice(3,6) + "-" + s.slice(6,9);
          return String(tel || "");
        }

        // Renderiza una fila de la cajita 02-VISITA:
        //   Línea 1: **tipo_via direccion** (negrita)
        //   Línea 2 (si hay admin): Nombre (admin) xxx-xxx-xxx
        //   Línea 3 (si hay presidente): Nombre (pres) xxx-xxx-xxx
        function _renderFilaExp02(c) {
          const url = urlT(token, "/presupuestos/expediente", { id: c.ccpp_id });
          const tipoVia = String(c.tipo_via || "").trim();
          const direccion = String(c.direccion || c.ccpp_id || "").trim();
          const tituloTxt = (tipoVia ? tipoVia + " " : "") + direccion;
          const admin = String(c.administrador || "").trim();
          const telAdmin = String(c.telefono_administrador || "").trim();
          const pres = String(c.presidente || "").trim();
          const telPres = String(c.telefono_presidente || "").trim();
          const lineas = [];
          if (admin) {
            lineas.push(`<div style="font-size:11px;color:var(--ptl-gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(admin)} (admin)${telAdmin ? " " + _esc(_fmtTel(telAdmin)) : ""}</div>`);
          }
          if (pres) {
            lineas.push(`<div style="font-size:11px;color:var(--ptl-gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(pres)} (presi)${telPres ? " " + _esc(_fmtTel(telPres)) : ""}</div>`);
          }
          return `
            <div class="ptl-lista-fila" style="display:block">
              <a href="${url}" style="font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(tituloTxt)}">${_esc(tituloTxt)}</a>
              ${lineas.join("")}
            </div>
          `;
        }

        const filas02 = en02.map(c => _renderFilaExp02(c));

        // v17.31: helper para obtener estadoPlazo de un CCPP (usa plantillasHoy y f1MapHoy
        // ya calculados arriba en el bloque "avisosPlazo")
        const _epFor = (c, plantilla) => {
          try { return calcularEstadoPlazo(c, plantilla, f1MapHoy); } catch (_) { return null; }
        };

        // CAJAS 05 y 08: TODOS los CCPPs de la fase con dirección + Faltan X/Y + badge
        const lista05 = await _prepararListaFase(en05, plt05);
        const lista08 = await _prepararListaFase(en08, plt08);
        const filas05 = lista05.map((x, i) => _renderFilaExp(x.c, plt05, x.faltan, x.info, i, _epFor(x.c, plt05)));
        const filas08 = lista08.map((x, i) => _renderFilaExp(x.c, plt08, x.faltan, x.info, i, _epFor(x.c, plt08)));

        // CAJAS 01 y 04: SOLO los CCPPs con badge accionable.
        //   01 → ⚠️ Decidir + 👎 Retrasado
        //   04 → solo ⚠️ Decidir
        // Sin "Faltan X/Y" en estas dos (no aplican docs).
        function _filtrarConBadge(arr, plantilla, estadosPermitidos) {
          const out = [];
          for (const c of arr) {
            const ep = _epFor(c, plantilla);
            if (ep && estadosPermitidos.includes(ep.estado)) {
              out.push({ c, ep });
            }
          }
          // Ordenar por gravedad: retrasado primero (más días arriba), luego decidir alfabético
          out.sort((a, b) => {
            const orden = { retrasado: 0, decidir: 1, en_plazo: 2 };
            const da = orden[a.ep.estado] !== undefined ? orden[a.ep.estado] : 9;
            const db = orden[b.ep.estado] !== undefined ? orden[b.ep.estado] : 9;
            if (da !== db) return da - db;
            if (a.ep.estado === "retrasado" && b.ep.estado === "retrasado") {
              return (b.ep.diasRetraso || 0) - (a.ep.diasRetraso || 0);
            }
            return String(a.c.direccion || "").localeCompare(String(b.c.direccion || ""), "es");
          });
          return out;
        }

        function _renderFilaFaseSimple(c, ep) {
          const url = urlT(token, "/presupuestos/expediente", { id: c.ccpp_id });
          const tipoVia = String(c.tipo_via || "").trim();
          const direccion = String(c.direccion || c.ccpp_id || "").trim();
          const tituloTxt = (tipoVia ? tipoVia + " " : "") + direccion;
          const badge = renderBadgePlazo(ep) || "";
          return `
            <div class="ptl-lista-fila">
              <a href="${url}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700" title="${_esc(tituloTxt)}">${_esc(tituloTxt)}</a>
              ${badge}
            </div>
          `;
        }

        const lista01 = _filtrarConBadge(en01, plt01, ["decidir", "retrasado"]);
        const lista04 = _filtrarConBadge(en04, plt04, ["decidir"]);
        const filas01 = lista01.map(x => _renderFilaFaseSimple(x.c, x.ep));
        const filas04 = lista04.map(x => _renderFilaFaseSimple(x.c, x.ep));

        cajaVisita = `
          <div class="ptl-card hoy-card-fase">
            <div class="ptl-card-title">🚪 02-VISITA (${en02.length})</div>
            ${en02.length === 0
              ? `<div class="ptl-empty-msg">— Sin expedientes en esta fase —</div>`
              : `<div class="ptl-lista-filas hoy-lista-02">${filas02.join("")}</div>`}
          </div>
        `;
        cajaContacto = `
          <div class="ptl-card hoy-card-fase">
            <div class="ptl-card-title">📞 01-CONTACTO (${lista01.length})</div>
            ${lista01.length === 0
              ? `<div class="ptl-empty-msg">— Sin avisos —</div>`
              : `<div class="ptl-lista-filas">${filas01.join("")}</div>`}
          </div>
        `;
        cajaAceptacion = `
          <div class="ptl-card hoy-card-fase">
            <div class="ptl-card-title">📋 04-ACEPTACION PTO (${lista04.length})</div>
            ${lista04.length === 0
              ? `<div class="ptl-empty-msg">— Sin avisos —</div>`
              : `<div class="ptl-lista-filas">${filas04.join("")}</div>`}
          </div>
        `;
        cajaDoc = `
          <div class="ptl-card hoy-card-fase">
            <div class="ptl-card-title">📄 05-DOCUMENTACION (${en05.length})</div>
            ${en05.length === 0
              ? `<div class="ptl-empty-msg">— Sin expedientes en esta fase —</div>`
              : `<div class="ptl-lista-filas">${filas05.join("")}</div>`}
          </div>
        `;
        cajaCycp = `
          <div class="ptl-card hoy-card-fase">
            <div class="ptl-card-title">📦 08-CYCP (${en08.length})</div>
            ${en08.length === 0
              ? `<div class="ptl-empty-msg">— Sin expedientes en esta fase —</div>`
              : `<div class="ptl-lista-filas">${filas08.join("")}</div>`}
          </div>
        `;
      } catch (eFases) {
        console.warn("[presupuestos][hoy] cajitas fases:", eFases.message);
        cajaVisita = `<div class="ptl-card"><div class="ptl-card-title">🚪 02-VISITA</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
        cajaContacto = `<div class="ptl-card"><div class="ptl-card-title">📞 01-CONTACTO</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
        cajaAceptacion = `<div class="ptl-card"><div class="ptl-card-title">📋 04-ACEPTACION PTO</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
        cajaDoc = `<div class="ptl-card"><div class="ptl-card-title">📄 05-DOCUMENTACION</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
        cajaCycp = `<div class="ptl-card"><div class="ptl-card-title">📦 08-CYCP</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
      }

      const body = `
        <style>
          /* Card 05/08: ocupa toda la altura de su celda del grid, así
             las dos cajitas quedan igualadas a la mayor. */
          .hoy-card-fase { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
          /* Wrapper de cada caja dentro de su columna apilada. Debe propagar
             la altura a la card interna para que el estirado por JS funcione. */
          .hoy-col-item { display: flex; flex-direction: column; }
          .hoy-col-item > .ptl-card { flex: 1; }
          /* Asunto clicable de Mails pendientes: hover azul + negrita,
             igual que los CCPP de las cajitas 05 y 08. */
          .hoy-asunto-clic:hover { color: #000; font-weight: 700; }
          /* Separación vertical entre filas de la cajita 02-VISITA
             (3 líneas por fila se agolpan). */
          .hoy-lista-02 .ptl-lista-fila { padding-bottom: 8px; }
        </style>
        <div class="hoy-page" style="display:grid;gap:4px;grid-template-columns:1fr 2fr;align-items:start">
          <div style="grid-column:1/3">${cajaExpedientesHoy}</div>
          <div style="grid-column:1/3">${cajaMails}</div>
          <div class="hoy-col hoy-col-izq" style="grid-column:1;display:flex;flex-direction:column;gap:4px">
            <div class="hoy-col-item">${cajaContacto}</div>
            <div class="hoy-col-item">${cajaVisita}</div>
          </div>
          <div class="hoy-col hoy-col-der" style="grid-column:2;display:flex;flex-direction:column;gap:4px">
            <div class="hoy-col-item">${cajaAceptacion}</div>
            <div class="hoy-col-item">${cajaDoc}</div>
            <div class="hoy-col-item">${cajaCycp}</div>
          </div>
          <div style="grid-column:1/3">${cajaAdjRotos}</div>
        </div>
        <script>
          // Igualador de alturas entre las dos columnas del HOY.
          // Mide ambas columnas (incluye gaps porque medimos clientHeight de la columna),
          // localiza la columna más corta, encuentra la caja más pequeña dentro de ella,
          // y le aplica un min-height para que las dos columnas igualen.
          // Se recalcula en resize porque el contenido reflowsea.
          (function igualarColumnasHoy() {
            function igualar() {
              try {
                var izq = document.querySelector('.hoy-col-izq');
                var der = document.querySelector('.hoy-col-der');
                if (!izq || !der) return;
                // Resetear cualquier min-height previo antes de medir
                var items = document.querySelectorAll('.hoy-col-item');
                items.forEach(function(it){ it.style.minHeight = ''; });
                // Medir alturas reales después del reset
                var hIzq = izq.getBoundingClientRect().height;
                var hDer = der.getBoundingClientRect().height;
                if (Math.abs(hIzq - hDer) < 1) return; // ya están igualadas
                var corta = hIzq < hDer ? izq : der;
                var diff = Math.abs(hIzq - hDer);
                // Localizar la caja más pequeña dentro de la columna corta
                var itemsCorta = corta.querySelectorAll(':scope > .hoy-col-item');
                if (!itemsCorta.length) return;
                var idxMin = 0;
                var hMin = itemsCorta[0].getBoundingClientRect().height;
                for (var i = 1; i < itemsCorta.length; i++) {
                  var h = itemsCorta[i].getBoundingClientRect().height;
                  if (h < hMin) { hMin = h; idxMin = i; }
                }
                // Estirar la más pequeña por la diferencia
                itemsCorta[idxMin].style.minHeight = (hMin + diff) + 'px';
              } catch(e) { console.warn('[hoy] igualar columnas:', e.message); }
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', igualar);
            } else {
              igualar();
            }
            // Recalcular en resize (con debounce simple)
            var rT;
            window.addEventListener('resize', function(){
              clearTimeout(rT);
              rT = setTimeout(igualar, 150);
            });
          })();
        </script>
        <script>
          (function(){
            var URL_CLASIF = ${JSON.stringify(urlT(token, "/presupuestos/mail-clasificar"))};
            var URL_DESC   = ${JSON.stringify(urlT(token, "/presupuestos/mail-descartar"))};
            var URL_IMAP_RUN = ${JSON.stringify(urlT(token, "/presupuestos/imap-run"))};
            var URL_IMAP_IMPORTAR_DRIVE = ${JSON.stringify(urlT(token, "/presupuestos/imap-importar-drive"))};

            // Acordeón: mostrar/ocultar detalle al pulsar 📄
            document.querySelectorAll('.hoy-toggle-detail').forEach(function(btn){
              btn.addEventListener('click', function(){
                var idx = btn.dataset.idx;
                var det = document.querySelector('.hoy-detail[data-idx="' + idx + '"]');
                if (!det) return;
                det.style.display = (det.style.display === 'none' || !det.style.display) ? 'block' : 'none';
              });
            });

            // Responder / Reenviar: redirige al expediente con un parámetro
            // que el frontend del expediente reconoce para abrir el modal
            // precargado. Si el mail no está clasificado, avisa.
            function _hoyAccionMail(btn, accion) {
              var ccpp = btn.dataset.ccpp || '';
              var mid = btn.dataset.mid || '';
              if (!ccpp) {
                alert('Este mail aún no está asignado a ningún expediente.\\n\\nUsa el desplegable "elegir expediente" para asignarlo primero, y luego entra al expediente para responder o reenviar.');
                return;
              }
              if (!mid) {
                alert('Este mail no tiene message_id (probablemente un mail antiguo). Entra al expediente y responde manualmente.');
                return;
              }
              var base = ${JSON.stringify(urlT(token, "/presupuestos/expediente"))};
              var sep = base.indexOf('?') >= 0 ? '&' : '?';
              window.location.href = base + sep + 'id=' + encodeURIComponent(ccpp) + '&accion_mail=' + accion + '&mid=' + encodeURIComponent(mid);
            }
            document.querySelectorAll('.hoy-responder').forEach(function(btn){
              btn.addEventListener('click', function(){ _hoyAccionMail(btn, 'responder'); });
            });
            document.querySelectorAll('.hoy-reenviar').forEach(function(btn){
              btn.addEventListener('click', function(){ _hoyAccionMail(btn, 'reenviar'); });
            });

            // Reloj: en HOY, siempre encendido. Al pulsar, lo quita de HOY.
            document.querySelectorAll('.hoy-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var mailId = btn.dataset.mailId;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId });
                  var res = await fetch('${urlT(token, "/presupuestos/mail-toggle-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v17.51 — Reloj de "Expedientes en HOY": quita la CCPP de HOY
            // (pone en_hoy = "" vía /presupuestos/expediente/campo).
            // v17.52 — Si la CCPP tiene pisos activos, avisa antes.
            document.querySelectorAll('.hoy-exp-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var ccppId = btn.dataset.ccppId;
                var nPisos = parseInt(btn.dataset.pisosActivos || '0', 10) || 0;
                if (nPisos > 0) {
                  var ok = confirm('Este expediente tiene ' + nPisos + ' piso(s) con reloj activo. Si quitas el expediente de HOY, los pisos seguirán marcados pero NO se verán hasta que reactives el expediente. ¿Continuar?');
                  if (!ok) return;
                }
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'en_hoy', valor: '' });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v17.78 — Helper unificado de feedback de guardado.
            // OK   → recuadro verde (borde+relleno) 5s y vuelve al normal.
            // FAIL → recuadro rojo PERMANENTE hasta el próximo guardado OK.
            // Usa las clases compartidas .ptl-guardado-ok / .ptl-guardado-error de
            // estilo-visual.cjs v1.16 (mismo aspecto que la ficha del expediente y
            // la tabla de documentación). Antes ponía el color con border inline,
            // solo borde y a 2s, por eso aquí no se veía el relleno.
            function _flashGuardado(el, ok) {
              if (el._flashTimer) { clearTimeout(el._flashTimer); el._flashTimer = null; }
              el.classList.remove('ptl-guardado-ok', 'ptl-guardado-error');
              if (ok) {
                el.classList.add('ptl-guardado-ok');
                el._flashTimer = setTimeout(function(){
                  el.classList.remove('ptl-guardado-ok');
                  el._flashTimer = null;
                }, 5000);
              } else {
                el.classList.add('ptl-guardado-error');
                // No timer: se queda rojo hasta el siguiente _flashGuardado(el, true).
              }
            }

            // v17.51 — Edición inline de notas_pto desde la caja "Expedientes en HOY"
            // Guarda en blur si el valor cambió (igual patrón que la ficha).
            // v17.67 — Usa _flashGuardado (verde 2s / rojo permanente).
            document.querySelectorAll('.hoy-exp-notas').forEach(function(ta){
              ta.addEventListener('blur', async function(){
                var ccppId = ta.dataset.ccppId;
                var nuevo = ta.value;
                var orig = ta.dataset.orig || '';
                if (nuevo === orig) return;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'notas_pto', valor: nuevo });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { _flashGuardado(ta, false); return; }
                  ta.dataset.orig = nuevo;
                  _flashGuardado(ta, true);
                } catch(e){ _flashGuardado(ta, false); }
              });
            });

            // v17.52 — Reloj de piso: quita el piso de HOY.
            document.querySelectorAll('.hoy-piso-reloj').forEach(function(btn){
              btn.addEventListener('click', async function(){
                var ccppId = btn.dataset.ccppId;
                var vivienda = btn.dataset.vivienda;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ ccpp_id: ccppId, vivienda: vivienda });
                  var res = await fetch('${urlT(token, "/presupuestos/piso/toggle-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // v17.52 — Edición inline de notas_piso.
            // v17.67 — Usa _flashGuardado (verde 2s / rojo permanente).
            document.querySelectorAll('.hoy-piso-notas').forEach(function(ta){
              ta.addEventListener('blur', async function(){
                var ccppId = ta.dataset.ccppId;
                var vivienda = ta.dataset.vivienda;
                var nuevo = ta.value;
                var orig = ta.dataset.orig || '';
                if (nuevo === orig) return;
                try {
                  var body = new URLSearchParams({ ccpp_id: ccppId, vivienda: vivienda, notas: nuevo });
                  var res = await fetch('${urlT(token, "/presupuestos/piso/guardar-notas-hoy")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { _flashGuardado(ta, false); return; }
                  ta.dataset.orig = nuevo;
                  _flashGuardado(ta, true);
                } catch(e){ _flashGuardado(ta, false); }
              });
            });

            // Desplegable unificado: combina chip+select de antes.
            // - Si el usuario no cambia la opción inicial → no se hace nada.
            // - Si cambia → confirma y asigna al expediente nuevo.
            document.querySelectorAll('.hoy-select-unif').forEach(function(sel){
              sel.addEventListener('change', async function(){
                var valorInicial = sel.dataset.valorInicial || '';
                if (sel.value === valorInicial) return; // no ha cambiado nada
                if (!sel.value) { sel.value = valorInicial; return; }
                var mailId = sel.dataset.mailId;
                var ccpp = sel.value;
                sel.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId, ccpp_id: ccpp });
                  var res = await fetch(URL_CLASIF, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); sel.disabled = false; sel.value = valorInicial; return; }
                  // v17.57 — En vez de location.reload(), actualizamos solo la
                  // fila en el DOM:
                  //  - select pasa a fondo verde con la opción seleccionada
                  //    marcada con "✓ " delante (como las filas ya clasificadas)
                  //  - los botones ↩/↪ ahora pueden funcionar (data-ccpp se rellena)
                  //  - el reloj sigue como estaba
                  // Esto evita la recarga completa de HOY que tardaba 1-3s.
                  var opt = sel.options[sel.selectedIndex];
                  var labelExp = (opt ? (opt.textContent || '') : '').replace(/^✓\\s*/, '');
                  // Mover la opción seleccionada al primer puesto con prefijo ✓.
                  // Limpiamos otros prefijos ✓ por si quedaba uno suelto.
                  Array.prototype.forEach.call(sel.options, function(o){
                    if (o.value && o.textContent.indexOf('✓ ') === 0 && o !== opt) {
                      o.textContent = o.textContent.replace(/^✓\\s*/, '');
                    }
                  });
                  if (opt && opt.textContent.indexOf('✓ ') !== 0) {
                    opt.textContent = '✓ ' + labelExp;
                  }
                  // Quitar opción "elegir expediente" si existe.
                  Array.prototype.forEach.call(sel.options, function(o){
                    if (!o.value && o.textContent.indexOf('elegir') >= 0) {
                      o.parentNode.removeChild(o);
                    }
                  });
                  sel.dataset.valorInicial = ccpp;
                  // Estilo "asignado": fondo verde claro.
                  sel.style.background = '#D1FAE5';
                  sel.style.color = '#065F46';
                  sel.style.fontWeight = '600';
                  // Actualizar data-ccpp de los botones ↩/↪ de esta fila para
                  // que puedan funcionar inmediatamente sin recargar.
                  var fila = sel.closest('.ptl-com-row');
                  if (fila) {
                    var btResp = fila.querySelector('.hoy-responder');
                    var btReen = fila.querySelector('.hoy-reenviar');
                    if (btResp) btResp.dataset.ccpp = ccpp;
                    if (btReen) btReen.dataset.ccpp = ccpp;
                  }
                  sel.disabled = false;
                } catch(e){ alert('Error: ' + e.message); sel.disabled = false; sel.value = valorInicial; }
              });
            });

            // Descartar = borrar el mail Y sus adjuntos en Drive
            document.querySelectorAll('.hoy-descartar').forEach(function(btn){
              btn.addEventListener('click', async function(){
                if (!confirm('¿Borrar este mail definitivamente?\\n\\nSe eliminará la fila y los adjuntos asociados (a la papelera de Drive).\\n\\nEsta acción no se puede deshacer desde aquí.')) return;
                var mailId = btn.dataset.mailId;
                btn.disabled = true;
                try {
                  var body = new URLSearchParams({ id: mailId });
                  var res = await fetch(URL_DESC, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
                  if (!res.ok) { var t = await res.text(); alert('Error: ' + t); btn.disabled = false; return; }
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btn.disabled = false; }
              });
            });

            // Botón "Leer IMAP ahora"
            var btnRun = document.getElementById('hoy-imap-run');
            if (btnRun) {
              btnRun.addEventListener('click', async function(){
                btnRun.disabled = true;
                var orig = btnRun.textContent;
                btnRun.textContent = '⏳ Leyendo IMAP...';
                try {
                  var res = await fetch(URL_IMAP_RUN, { method:'POST' });
                  var data = await res.json();
                  if (!res.ok) { alert('Error: ' + (data.error || res.status)); btnRun.disabled=false; btnRun.textContent=orig; return; }
                  alert('IMAP: procesados=' + data.procesados + ' errores=' + data.errores);
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btnRun.disabled=false; btnRun.textContent=orig; }
              });
            }

            // Botón "Importar mails de Drive"
            var btnImp = document.getElementById('hoy-imap-importar-drive');
            if (btnImp) {
              btnImp.addEventListener('click', async function(){
                btnImp.disabled = true;
                var orig = btnImp.textContent;
                btnImp.textContent = '⏳ Importando...';
                try {
                  var res = await fetch(URL_IMAP_IMPORTAR_DRIVE, { method:'POST' });
                  var data = await res.json();
                  if (!res.ok || data.ok === false) {
                    alert('Error: ' + (data.error || res.status));
                    btnImp.disabled=false; btnImp.textContent=orig;
                    return;
                  }
                  var msg = 'Drive: procesados=' + data.procesados + ' errores=' + data.errores;
                  if (data.errores > 0 && data.detalle_errores && data.detalle_errores.length) {
                    msg += '\\n\\n' + data.detalle_errores.join('\\n');
                  }
                  alert(msg);
                  location.reload();
                } catch(e){ alert('Error: ' + e.message); btnImp.disabled=false; btnImp.textContent=orig; }
              });
            }
          })();
        </script>
      `;

      // v17.64 — Cabecera unificada. Antes había ~95 líneas inline (count
      // de fases, _filtroBtnHoy, buscador con ptlFiltrarHoy, script del cron,
      // pestañas duplicadas). Ahora todo eso vive en renderCabeceraComun.
      // No pasamos filtroActivo: en HOY ninguna pestaña va resaltada.
      const cabecera = renderCabeceraComun(token, comusListado);

      sendHtml(res, pageHtml("HOY",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "HOY", url: "#" }],
        cabecera + body,
        token));
    } catch (e) {
      console.error("[presupuestos] /hoy:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // =================================================================
  // PANTALLA DE PLANTILLAS DE MAIL (CRUD via Sheet)
  // =================================================================
  // GET /presupuestos/plantillas — listado/edición
  app.get("/presupuestos/plantillas", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      // Construir filas: una por cada fase con botón de email (plantilla en PTO_FASES)
      // + 04_REENVIO (plantilla virtual, sin fase real, usada por el botón "Reenviar
      // presupuesto modificado" desde fase 04).
      // Si la plantilla no existe en el Sheet, mostramos una fila VACÍA para crearla.
      const fasesConPlantilla = ["01_CONTACTO", "02_PTE_VISITA_CON_ACTA", "02_PTE_VISITA_SIN_ACTA", "03_ENVIO_PTO", "04_ACEPTACION_PTO", "04_REENVIO", "05_ACEPTACION_PTO", "05_SEGUIMIENTO_DOC", "05_FIN_DOC", "08_INICIO_CYCP", "08_SEGUIMIENTO_CYCP", "08_FIN_CYCP"];
      // v17.20: paralelizar las 12 lecturas. Con el caché de filas
      // todas resuelven contra una sola lectura del Sheet (antes era
      // un for secuencial que disparaba 12 peticiones).
      const _plantillasArr = await Promise.all(
        fasesConPlantilla.map(f => leerPlantillaMail(f).catch(() => null))
      );
      const plantillas = fasesConPlantilla.map((f, i) => {
        const p = _plantillasArr[i];
        if (p) return p;
        // Plantilla no creada todavía: fila vacía para que el usuario la rellene
        return {
          fase: f,
          activo: true,
          asunto: "",
          mensaje: "",
          adjuntos_fijos: "",
          dias_primer_envio: 0,
          dias_recurrente: 0,
          max_envios: 0,
          cco: "",
        };
      });
      // Cargar cuentas configuradas en mail_cuentas para el selector "Enviar desde"
      const cuentas = await leerCuentasMail(true); // forzar lectura sin caché
      // Cargar pie de página global (fila especial _PIE_GLOBAL en mail_plantillas, col D=mensaje)
      const pieRow = await leerPlantillaMail("_PIE_GLOBAL");
      const pieGlobal = pieRow ? (pieRow.mensaje || "") : "";
      sendHtml(res, pageHtml("Plantillas de mail",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas", url: "#" }],
        vistaPlantillas(plantillas, token, cuentas, pieGlobal),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas/guardar — guarda una fila en mail_plantillas
  app.post("/presupuestos/plantillas/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const fase = String(req.body.fase || "").trim();
      if (!fase) return sendError(res, "Fase requerida");
      // Adjuntos: 3 campos separados (adjunto_1, adjunto_2, adjunto_3) que se
      // concatenan con '||' al guardar en la única columna `adjuntos_fijos`.
      const a1 = String(req.body.adjunto_1 || "").trim();
      const a2 = String(req.body.adjunto_2 || "").trim();
      const a3 = String(req.body.adjunto_3 || "").trim();
      const adjuntosFijos = [a1, a2, a3].join("||"); // siempre 3 trozos, vacío = ""
      // CCO: 3 campos separados (cco_1, cco_2, cco_3) que se concatenan con '||'
      // en la única columna `cco`.
      const c1 = String(req.body.cco_1 || "").trim();
      const c2 = String(req.body.cco_2 || "").trim();
      const c3 = String(req.body.cco_3 || "").trim();
      // Validar cada CCO individual (formato email, sin acentos)
      for (const [idx, val] of [[1, c1], [2, c2], [3, c3]]) {
        if (val && !esEmailValido(val)) {
          return sendError(res, `CCO ${idx} no válido. Debe ser un email correcto sin acentos ni espacios.`);
        }
      }
      const cco = [c1, c2, c3].join("||");
      const datos = {
        fase,
        activo:           (req.body.activo === "SI" || req.body.activo === "on" || req.body.activo === "true") ? "SI" : "NO",
        asunto:           String(req.body.asunto || "").trim(),
        mensaje:          String(req.body.mensaje || "").trim(),
        adjuntos_fijos:   adjuntosFijos,
        dias_primer_envio: parseInt(req.body.dias_primer_envio) || 0,
        dias_recurrente:  parseInt(req.body.dias_recurrente) || 0,
        max_envios:       parseInt(req.body.max_envios) || 0,
        cco,
        cuenta_envio:     String(req.body.cuenta_envio || "").trim(),
      };
      // Validaciones básicas
      if (datos.asunto.length < 1 || datos.asunto.length > 200) {
        return sendError(res, "Asunto debe tener entre 1 y 200 caracteres");
      }
      if (datos.mensaje.length < 1 || datos.mensaje.length > 5000) {
        return sendError(res, "Mensaje debe tener entre 1 y 5000 caracteres");
      }
      if (datos.dias_recurrente < 0 || datos.dias_recurrente > 365) {
        return sendError(res, "Días entre envíos debe estar entre 0 y 365");
      }
      if (datos.max_envios < 1 || datos.max_envios > 10) {
        return sendError(res, "Máximo de envíos debe estar entre 1 y 10");
      }
      await guardarPlantillaMail(datos);
      res.redirect(urlT(token, "/presupuestos/plantillas", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas/guardar-pie-global
  // Guarda el pie de página global en una fila especial _PIE_GLOBAL de mail_plantillas
  // (usa el campo `mensaje` para el texto del pie). El resto de columnas quedan vacías.
  app.post("/presupuestos/plantillas/guardar-pie-global", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      await guardarPlantillaMail({
        fase: "_PIE_GLOBAL",
        activo: "SI",
        asunto: "",
        mensaje: String(req.body.pie_global || "").trim(),
        adjuntos_fijos: "",
        dias_primer_envio: 0,
        dias_recurrente: 0,
        max_envios: 0,
        cco: "",
        cuenta_envio: "",
      });
      res.redirect(urlT(token, "/presupuestos/plantillas", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas/guardar-pie-global:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // =================================================================
  // PLANTILLAS DE DOCUMENTOS (v17.82) — pantalla de edición + guardado
  // Mismo esquema que /presupuestos/plantillas (mail) pero para la tab
  // doc_plantillas. Bloque 1 del Sprint A (no necesita pdfkit).
  // =================================================================

  // GET /presupuestos/plantillas-doc — pantalla de edición de plantillas de documento
  app.get("/presupuestos/plantillas-doc", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const plantillas = await leerPlantillasDoc();
      sendHtml(res, pageHtml("Plantillas de documentos",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas documentos", url: "#" }],
        vistaPlantillasDoc(plantillas, token),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas-doc:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-doc/guardar — guarda una fila en doc_plantillas
  app.post("/presupuestos/plantillas-doc/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const clave = String(req.body.clave || "").trim();
      if (!clave) return sendError(res, "Clave requerida");
      const titulo = String(req.body.titulo || "").trim();
      const cuerpo = String(req.body.cuerpo || "").trim();
      // Validaciones básicas (mismo espíritu que mail)
      if (cuerpo.length > 5000) {
        return sendError(res, "El cuerpo no puede superar los 5000 caracteres");
      }
      if (titulo.length > 200) {
        return sendError(res, "El título no puede superar los 200 caracteres");
      }
      await guardarPlantillaDoc({ clave, titulo, cuerpo });
      res.redirect(urlT(token, "/presupuestos/plantillas-doc", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-doc/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // =================================================================
  // IMPRIMIR DOCUMENTOS (Sprint A — Bloque 2, v17.83)
  // 3 endpoints que alimentan el flujo del modal:
  //  1) /docs/menu     -> lista de documentos disponibles + pisos del expediente
  //  2) /docs/huecos   -> para los documentos elegidos (y piso, si aplica), los
  //                       campos a rellenar con su valor precargado
  //  3) /docs/generar  -> genera el PDF (una página por documento) y lo descarga
  // =================================================================

  // 1) GET /presupuestos/docs/menu?id=<ccpp_id>
  app.get("/presupuestos/docs/menu", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.query.id || "").trim();
      if (!ccppId) return res.status(400).json({ error: "Falta id" });
      const plantillas = await leerPlantillasDoc();
      // Orden de presentación en el menú (decisión Guille):
      const ORDEN_DOCS = ["mantener_presion", "renunciar_presion", "usufructo", "piso_disidente", "contador_unico", "paso_instalaciones"];
      const _ordPos = c => { const i = ORDEN_DOCS.indexOf(c); return i === -1 ? 999 : i; };
      // documentos = todas las plantillas que NO son encabezado/pie
      const documentos = plantillas
        .filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL")
        .sort((a, b) => _ordPos(a.clave) - _ordPos(b.clave))
        .map(p => ({
          clave: p.clave,
          titulo: p.titulo || p.clave,
          tipo: DOCS_GENERALES.includes(p.clave) ? "general"
              : DOCS_PARTICULARES.includes(p.clave) ? "particular"
              : (DOC_HUECOS[p.clave] ? DOC_HUECOS[p.clave].tipo : "particular"),
        }));
      const { comu, pisos } = await _pisosParaDocumentos(ccppId);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      res.json({
        ccpp_id: ccppId,
        comunidad: (comu.tipo_via ? comu.tipo_via + " " : "") + (comu.direccion || ""),
        documentos,
        pisos: pisos.map(p => ({ vivienda: p.vivienda, propietario: p.nota_simple, usufructuario: p.nombre })),
      });
    } catch (e) {
      console.error("[presupuestos] GET /docs/menu:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 2) POST /presupuestos/docs/huecos  body: { id, claves:[], vivienda }
  // Devuelve, por documento, la lista de huecos con su valor precargado.
  app.post("/presupuestos/docs/huecos", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.body.id || "").trim();
      let claves = [];
      try { claves = JSON.parse(req.body.claves || "[]"); } catch (_) { claves = []; }
      if (!Array.isArray(claves)) claves = [];
      const vivienda = String(req.body.vivienda || "").trim();
      if (!ccppId || claves.length === 0) return res.status(400).json({ error: "Faltan datos" });
      const { comu, pisos } = await _pisosParaDocumentos(ccppId);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const piso = vivienda ? pisos.find(p => p.vivienda === vivienda) : null;
      // v17.90: el formulario muestra UNA SOLA LISTA de campos sin duplicar.
      // Se excluyen "comunidad" (la pone el programa) y "piso"/"pisos" (ya se
      // eligió el piso en el menú). Cada campo aparece una vez aunque lo usen
      // varios documentos; se recuerda qué claves de documento lo usan para
      // repartir el valor al generar.
      const OCULTOS = new Set(["comunidad", "piso", "pisos"]);
      const porCampo = new Map(); // clave_hueco -> { clave, label, valor, manual, docs:[] }
      claves.forEach(claveDoc => {
        const def = DOC_HUECOS[claveDoc];
        if (!def) return;
        def.huecos.forEach(h => {
          if (OCULTOS.has(h.clave)) return;
          if (!porCampo.has(h.clave)) {
            porCampo.set(h.clave, {
              clave: h.clave,
              label: h.label,
              valor: _valorHueco(h.origen, comu, piso),
              manual: h.origen === "manual",
              docs: [claveDoc],
            });
          } else {
            porCampo.get(h.clave).docs.push(claveDoc);
          }
        });
      });
      const campos = Array.from(porCampo.values());
      res.json({ campos });
    } catch (e) {
      console.error("[presupuestos] POST /docs/huecos:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 3) POST /presupuestos/docs/generar
  // body: { id, claves:[], vivienda, valores:{} }
  // valores = lista ÚNICA de campos rellenados por el usuario (sin piso ni
  // comunidad). El servidor reparte cada valor a los documentos que lo usan y
  // añade piso/pisos (del piso elegido) y comunidad (del expediente).
  app.post("/presupuestos/docs/generar", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccppId = String(req.body.id || "").trim();
      let claves = [];
      try { claves = JSON.parse(req.body.claves || "[]"); } catch (_) { claves = []; }
      if (!Array.isArray(claves)) claves = [];
      const vivienda = String(req.body.vivienda || "").trim();
      let valoresComunes = {};
      try { valoresComunes = JSON.parse(req.body.valores || "{}"); } catch (_) { valoresComunes = {}; }
      if (!valoresComunes || typeof valoresComunes !== "object") valoresComunes = {};
      if (claves.length === 0) return res.status(400).json({ error: "No hay documentos" });
      const plantillas = await leerPlantillasDoc();
      const encab = plantillas.find(p => p.clave === "_ENCABEZADO_GLOBAL");
      const pie   = plantillas.find(p => p.clave === "_PIE_GLOBAL");
      const porClave = {};
      plantillas.forEach(p => { porClave[p.clave] = p; });
      // Datos que NO vienen del formulario, los calcula el servidor:
      const comu = await buscarComunidadPorId(ccppId);
      const comunidadTxt = comu
        ? ((comu.tipo_via ? String(comu.tipo_via).trim() + " " : "") + String(comu.direccion || "").trim()).trim()
        : "";
      const { pisos } = await _pisosParaDocumentos(ccppId);
      const piso = vivienda ? pisos.find(p => p.vivienda === vivienda) : null;
      const pisoTxt = piso ? String(piso.vivienda || "") : "";
      // Para cada documento, reconstruir SUS valores: los comunes del formulario
      // + piso/pisos/comunidad según lo que cada documento necesite.
      const docs = claves.map(claveDoc => {
        const pl = porClave[claveDoc];
        const def = DOC_HUECOS[claveDoc];
        if (!pl || !def) return null;
        const valores = {};
        def.huecos.forEach(h => {
          if (h.clave === "comunidad") valores.comunidad = comunidadTxt;
          else if (h.clave === "piso" || h.clave === "pisos") valores[h.clave] = pisoTxt;
          else valores[h.clave] = (valoresComunes[h.clave] !== undefined) ? valoresComunes[h.clave] : "";
        });
        return { clave: claveDoc, cuerpo: pl.cuerpo, valores };
      }).filter(d => d && d.cuerpo);
      if (docs.length === 0) return res.status(400).json({ error: "Documentos no encontrados en plantillas" });
      const pdf = await generarPdfDocumentos(docs, encab ? encab.cuerpo : "", pie ? pie.cuerpo : "");
      // Nombre de archivo a partir de la comunidad
      const base = (comu ? (comu.direccion || "documentos") : "documentos")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="documentos_${base || "ccpp"}.pdf"`);
      res.send(pdf);
    } catch (e) {
      console.error("[presupuestos] POST /docs/generar:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // =================================================================
  // v17.26 — ENDPOINT DE SANEO ÚNICO DE LA PESTAÑA "comunidades"
  // =================================================================
  // GET /admin/sanear-comunidades?token=...&dryrun=1
  // Recorre las filas de "comunidades" y arregla 3 cosas:
  //   1) Numéricos guardados como string → Number nativo redondeado
  //      (W,X,Y,Z,AA con 2 dec; AE,AF con 1 dec).
  //   2) En columnas de fecha, los valores literales "---" se vacían.
  //   3) Cualquier celda en notas_pto (AH) que empiece por "=" (interpretada
  //      como fórmula por error de tecleo) se vacía.
  //
  // Idempotente: se puede ejecutar varias veces sin efecto adicional.
  // Con ?dryrun=1 informa qué tocaría sin escribir. Sin dryrun, aplica.
  // El saneo se hace EN BLOQUES de hasta 50 celdas por batchUpdate para no
  // saturar la cuota de Sheets API.
  // =================================================================
  app.get("/admin/sanear-comunidades", async (req, res) => {
    if (!checkToken(req, res)) return;
    const dryrun = String(req.query.dryrun || "") === "1";

    // Columnas (letras del Sheet) y su tipo de saneo.
    const COL_LETTER = {
      pto_total: "W", mano_obra_previsto: "X", mano_obra_real: "Y",
      material_previsto: "Z", material_real: "AA",
      tiempo_previsto: "AE", tiempo_real: "AF",
      notas_pto: "AH",
      fecha_contacto: "Q", fecha_visita: "R", fecha_envio_pto: "S",
      fecha_ultimo_seguimiento_pto: "T", fecha_aceptacion_pto: "V",
      fecha_proximo_mail_manual: "AK", fecha_ultimo_reenvio_pto: "AL",
      fecha_visita_emasesa: "AM", fecha_documentacion_completa: "AN",
      fecha_envio_contratos_pagos: "AZ", fecha_cycp_completa: "BA",
      fecha_limite_documentacion_vecinos: "BC",
      fecha_cobro: "BE",
    };
    const COL_IMPORTE = ["pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real"];
    const COL_TIEMPO  = ["tiempo_previsto","tiempo_real"];
    const COL_FECHA   = ["fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
                         "fecha_aceptacion_pto","fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto",
                         "fecha_visita_emasesa","fecha_documentacion_completa","fecha_envio_contratos_pagos",
                         "fecha_cycp_completa","fecha_limite_documentacion_vecinos","fecha_cobro"];

    function _saneaNumero(v, decimales) {
      if (v == null || v === "") return { tocar: false };
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      if (!isFinite(n)) return { tocar: false };
      const redondeado = Math.round(n * Math.pow(10, decimales)) / Math.pow(10, decimales);
      // Si el valor original ya era exactamente número y coincide con el redondeo, no tocar.
      if (typeof v === "number" && v === redondeado) return { tocar: false };
      return { tocar: true, valor: redondeado };
    }

    try {
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: RANGO_COMUNIDADES,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      const rows = r.data.values || [];
      // Mapa rapido nombre_columna → indice columnas en COLS
      const idx = {};
      for (let i = 0; i < COLS.length; i++) idx[COLS[i]] = i;

      const cambios = []; // { fila, col, letra, antes, despues, motivo }
      for (let i = 1; i < rows.length; i++) {
        const fila = i + 1; // 1-based
        const row = rows[i] || [];
        if (!row[0] && !row[1]) continue; // saltar vacías

        // 1) Importes (2 dec)
        for (const c of COL_IMPORTE) {
          const v = row[idx[c]];
          const s = _saneaNumero(v, 2);
          if (s.tocar) cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: s.valor, motivo: "num-2dec" });
        }
        // 2) Tiempos (1 dec)
        for (const c of COL_TIEMPO) {
          const v = row[idx[c]];
          const s = _saneaNumero(v, 1);
          if (s.tocar) cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: s.valor, motivo: "num-1dec" });
        }
        // 3) Fechas: solo limpiar "---"
        for (const c of COL_FECHA) {
          const v = row[idx[c]];
          if (typeof v === "string" && v.trim() === "---") {
            cambios.push({ fila, col: c, letra: COL_LETTER[c], antes: v, despues: "", motivo: "fecha-vacia" });
          }
        }
        // 4) notas_pto: limpiar cualquier celda que empiece por "="
        const vAH = row[idx["notas_pto"]];
        if (typeof vAH === "string" && vAH.startsWith("=")) {
          cambios.push({ fila, col: "notas_pto", letra: "AH", antes: vAH, despues: "", motivo: "formula-accidental" });
        }
      }

      // Resumen
      const resumen = { totalCambios: cambios.length, porMotivo: {}, porColumna: {} };
      for (const ch of cambios) {
        resumen.porMotivo[ch.motivo] = (resumen.porMotivo[ch.motivo] || 0) + 1;
        resumen.porColumna[ch.letra + " " + ch.col] = (resumen.porColumna[ch.letra + " " + ch.col] || 0) + 1;
      }

      if (dryrun) {
        // Devuelve resumen + los primeros 50 cambios como muestra
        return res.json({
          ok: true,
          dryrun: true,
          mensaje: "DRY-RUN: nada se ha escrito. Revisa los cambios propuestos y vuelve a llamar SIN &dryrun=1 para aplicar.",
          resumen,
          muestra: cambios.slice(0, 50),
        });
      }

      // APLICAR — batchUpdate en bloques de 50 celdas
      const CHUNK = 50;
      let aplicados = 0;
      for (let i = 0; i < cambios.length; i += CHUNK) {
        const bloque = cambios.slice(i, i + CHUNK);
        const data = bloque.map(ch => ({
          range: `comunidades!${ch.letra}${ch.fila}`,
          values: [[ch.despues]],
        }));
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: { valueInputOption: "RAW", data },
        });
        aplicados += bloque.length;
      }

      return res.json({
        ok: true,
        dryrun: false,
        mensaje: `Saneo completado. ${aplicados} celdas escritas.`,
        resumen,
      });
    } catch (e) {
      console.error("[presupuestos] /admin/sanear-comunidades:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ============================================================
  // CABECERA COMÚN (buscador + A-Z + Plantillas mail + Ejecutar cron
  // + filtros rápidos + filtros fase). Idéntica a la del HOY.
  // Usada en: HOY (en el propio handler), /presupuestos/expediente
  // y /documentacion/expediente.
  //
  // Devuelve un string HTML. Necesita `token` y la lista completa de
  // comunidades (`comusListado`) para calcular los contadores.
  // El buscador, al teclear, redirige a /presupuestos?q=...
  // ============================================================
  // v17.64 — Cabecera UNIFICADA. Antes había 3 cabeceras inline casi idénticas
  // (vistaListado, /presupuestos/hoy, ficha vía renderCabeceraComun). Ahora todas
  // las pantallas pasan por esta función.
  //
  // opts (todos opcionales):
  //   - filtroActivo: clave de la pestaña marcada como "on" (ej. "ACTIVOS",
  //     "TRAMITE", "05_DOCUMENTACION", "ZZ_RECHAZADO"). Si no se pasa, ninguna
  //     pestaña va resaltada (caso típico: estás en la ficha o en HOY).
  //   - busqueda: texto a precargar en el input. Por defecto "".
  //   - orden: estado actual del orden ("az", "za", "urg"). Influye en el
  //     botón de orden (próximo estado al pulsar) y se propaga en los links
  //     de pestañas para no perderlo al cambiar de filtro.
  //   - mostrarOrden: bool. true → muestra el botón de orden con el próximo
  //     estado. false → muestra solo "↑ A-Z" como link al listado. Por
  //     defecto false (que era el comportamiento de la cabecera común antes).
  //   - cuadra: bool. Si false → la pestaña Activos lleva borde rojo + ⚠.
  //     Por defecto true.
  function renderCabeceraComun(token, comusListado, opts) {
    const _opts = opts || {};
    const filtroActivo = _opts.filtroActivo || "";
    const busqueda = _opts.busqueda || "";
    const orden = _opts.orden || "";
    const mostrarOrden = !!_opts.mostrarOrden;
    const cuadra = _opts.cuadra !== false; // por defecto true
    const countsHoy = { todos: 0, activos: 0, en_tramite: 0 };
    const TODAS_FASES = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO",
      "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP",
      "09_TRAMITADA","ZZ_RECHAZADO","ZZ_DESCARTADO"];
    TODAS_FASES.forEach(f => countsHoy[f] = 0);
    const FASES_ACTIVAS = ["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO",
      "05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    const FASES_EN_TRAMITE = ["05_DOCUMENTACION","06_VISITA_EMASESA","07_PTE_CYCP","08_CYCP"];
    (comusListado || []).forEach(c => {
      const f = normalizarFase(c.fase_presupuesto);
      countsHoy.todos++;
      if (countsHoy[f] !== undefined) countsHoy[f]++;
      const ochoFin = (f === "08_CYCP" && !!c.fecha_cycp_completa);
      if (FASES_ACTIVAS.includes(f) && !ochoFin) countsHoy.activos++;
      if (FASES_EN_TRAMITE.includes(f) && !ochoFin) countsHoy.en_tramite++;
    });
    // v17.64 — los links de pestaña conservan busqueda/orden para no perderlos
    // al cambiar de filtro desde el listado.
    const _filtroBtn = (faseId, label, extra = "") => {
      const activo = filtroActivo === faseId ? "on" : "";
      const params = {};
      if (faseId) params.fase = faseId;
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      let n;
      if (faseId === "ACTIVOS") n = countsHoy.activos;
      else if (faseId === "TRAMITE") n = countsHoy.en_tramite;
      else if (faseId === "TODOS") n = countsHoy.todos;
      else n = faseId ? countsHoy[faseId] : countsHoy.todos;
      return `<a href="${url}" class="ptl-filtro ${activo} ${extra}">${label} <span style="opacity:.7;margin-left:3px">${n}</span></a>`;
    };
    // v17.64 — botón Activos especial: aviso ⚠ si los contadores no cuadran
    // (heredado de vistaListado: detecta fases mal escritas en el Sheet).
    const _btnActivos = (() => {
      const activo = filtroActivo === "ACTIVOS" ? "on" : "";
      const params = { fase: "ACTIVOS" };
      if (busqueda) params.q = busqueda;
      if (orden) params.orden = orden;
      const url = urlT(token, "/presupuestos", params);
      const aviso = cuadra ? "" : ` style="border-color:var(--ptl-danger);color:var(--ptl-danger)" title="No cuadra"`;
      return `<a href="${url}" class="ptl-filtro ptl-filtro-nuevo ${activo}"${aviso}>Activos <span style="opacity:.7;margin-left:3px">${countsHoy.activos}${cuadra ? '' : ' ⚠'}</span></a>`;
    })();
    // v17.64 — botón de orden. Si mostrarOrden=true (caso /presupuestos), gira
    // entre az/za/urg conservando filtro y búsqueda. Si false, es solo un link
    // a /presupuestos con la flecha A-Z (caso HOY/ficha).
    const _btnOrden = (() => {
      if (!mostrarOrden) {
        return `<a href="${urlT(token, "/presupuestos")}" class="ptl-btn-orden">↑ A-Z</a>`;
      }
      const params = {};
      if (filtroActivo) params.fase = filtroActivo;
      if (busqueda) params.q = busqueda;
      let proximo, label;
      if (orden === "az" || !orden) { proximo = "za"; label = "↓ Z-A"; }
      else if (orden === "za") { proximo = "urg"; label = "⏱ Urgencia"; }
      else { proximo = "az"; label = "↑ A-Z"; }
      if (proximo && proximo !== "az") params.orden = proximo;
      const url = urlT(token, "/presupuestos", params);
      return `<a href="${url}" class="ptl-btn-orden">${label}</a>`;
    })();
    return `
      <div class="ptl-lista-header">
        <div style="display:flex;gap:8px;align-items:stretch">
          <div class="ptl-search-wrap" style="flex:1">
            <span class="ptl-search-icon">🔍</span>
            <input class="ptl-search-input" id="ptl-buscador-comun" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(busqueda)}" oninput="ptlFiltrarComun()"/>
          </div>
          ${_btnOrden}
          <a href="${urlT(token, "/presupuestos/plantillas")}" class="ptl-btn-orden" style="background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE">📧 Plantillas mail</a>
          <a href="${urlT(token, "/presupuestos/plantillas-doc")}" class="ptl-btn-orden" style="background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE">📄 Plantillas documentos</a>
          <button type="button" id="ptl-btn-cron-manual" class="ptl-btn-orden" style="background:#D1FAE5;color:#065F46;border-color:#A7F3D0;cursor:pointer" title="Forzar la ejecución del cron de envíos automáticos ahora mismo">⚡ Ejecutar cron</button>
        </div>
        <script>
          (function(){
            var btn = document.getElementById('ptl-btn-cron-manual');
            if (!btn) return;
            var STATUS_URL = ${JSON.stringify(urlT(token, "/presupuestos/cron-status"))};
            var RUN_URL    = ${JSON.stringify(urlT(token, "/presupuestos/cron-run"))};
            var modo = 'verde';
            var erroresActuales = [];
            function pintarVerde() {
              modo = 'verde'; erroresActuales = [];
              btn.style.background = '#D1FAE5'; btn.style.color = '#065F46';
              btn.style.borderColor = '#A7F3D0'; btn.textContent = '⚡ Ejecutar cron';
            }
            function pintarRojo(nErrores, detalles) {
              modo = 'rojo'; erroresActuales = detalles || [];
              btn.style.background = '#FEE2E2'; btn.style.color = '#991B1B';
              btn.style.borderColor = '#FCA5A5';
              btn.textContent = '⚠️ ' + nErrores + ' error' + (nErrores === 1 ? '' : 'es') + ' · Ejecutar cron';
            }
            fetch(STATUS_URL).then(function(r){ return r.json(); }).then(function(data){
              if (!data || !data.ok) return;
              var r = data.ultimoResumen;
              if (r && r.errores > 0) pintarRojo(r.errores, data.ultimosErrores || r.detalleErrores || []);
              else pintarVerde();
            }).catch(function(){});
            btn.addEventListener('click', function(){
              if (modo === 'rojo') {
                var msg = '⚠️ Errores del último cron (' + erroresActuales.length + '):';
                if (erroresActuales.length) {
                  erroresActuales.forEach(function(e){
                    msg += '\\n• ' + (e.direccion || '?') + ' [' + (e.fase || '?') + ']: ' + (e.motivo || '?');
                  });
                } else { msg += '\\n(sin detalle disponible)'; }
                msg += '\\n\\nRevisa estas CCPPs y, cuando estén corregidas, vuelve a pulsar para ejecutar el cron.';
                alert(msg); pintarVerde(); return;
              }
              if (!confirm('¿Ejecutar el cron de envíos automáticos ahora?\\n\\nRevisará todas las CCPPs y enviará los mails que correspondan a hoy.')) return;
              btn.textContent = '⏳ Ejecutando...'; btn.disabled = true;
              fetch(RUN_URL, { method: 'POST' })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok && data.resumen) {
                    var r = data.resumen;
                    var msg = '✓ Cron ejecutado.\\n\\nRevisadas: ' + r.revisadas + '\\nEnviadas: ' + r.enviadas + '\\nOmitidas por margen: ' + r.omitidas_margen + '\\nErrores: ' + r.errores;
                    alert(msg);
                    if (r.errores > 0) pintarRojo(r.errores, r.detalleErrores || []);
                    else pintarVerde();
                  } else {
                    alert('✗ Error ejecutando cron:\\n' + (data && data.error ? data.error : 'desconocido'));
                    pintarRojo(1, [{ direccion: '(global)', fase: '-', motivo: (data && data.error) || 'desconocido' }]);
                  }
                })
                .catch(function(e){ alert('✗ Error de red: ' + e.message); })
                .finally(function(){ btn.disabled = false; });
            });
          })();
          // v17.64 — Buscador unificado con debounce 400ms. Redirige al
          // listado con q=... (también si ya estás en el listado: la propia
          // recarga aplica el filtro).
          var ptlTcomun;
          function ptlFiltrarComun() {
            clearTimeout(ptlTcomun);
            ptlTcomun = setTimeout(function(){
              var q = document.getElementById('ptl-buscador-comun').value;
              var base = ${JSON.stringify(urlT(token, "/presupuestos"))};
              var url = new URL(base, window.location.origin);
              if (q && q.trim()) url.searchParams.set('q', q.trim());
              window.location.href = url.toString();
            }, 400);
          }
        </script>
        <div class="ptl-filtros ptl-filtros-rapidos">
          <button type="button" class="ptl-filtro ptl-filtro-nuevo" style="cursor:pointer" onclick="location.reload(true)" title="Recargar (Ctrl+F5)">🔄 Ctrl+F5</button>
          <a href="${urlT(token, "/presupuestos/hoy")}" class="ptl-filtro" style="background:var(--ptl-warning-light);color:var(--ptl-warning);border-color:#FDE68A;font-weight:600">⏰ HOY</a>
          ${_btnActivos}
          ${_filtroBtn("TRAMITE", "En trámite", "ptl-filtro-en-tramite")}
          ${_filtroBtn("09_TRAMITADA", "Tramitados", "ptl-fase-tramitada")}
          ${_filtroBtn("ZZ_RECHAZADO", "ZZ-RECHAZADO", "ptl-fase-zz")}
          ${_filtroBtn("ZZ_DESCARTADO", "ZZ-DESCARTADO", "ptl-fase-zz")}
        </div>
        <div class="ptl-filtros ptl-filtros-fases">
          <a href="${urlT(token, "/presupuestos/nuevo")}" class="ptl-filtro ptl-filtro-nuevo">+ Nuevo</a>
          ${_filtroBtn("01_CONTACTO", "01-CONTACTO", "ptl-fase-activa")}
          ${_filtroBtn("02_VISITA", "02-VISITA", "ptl-fase-activa")}
          ${_filtroBtn("03_ENVIO_PTO", "03-ENVIO PTO", "ptl-fase-activa")}
          ${_filtroBtn("04_ACEPTACION_PTO", "04-ACEPTACION PTO", "ptl-fase-activa")}
          ${_filtroBtn("05_DOCUMENTACION", "05-DOCUMENTACION", "ptl-fase-activa")}
          ${_filtroBtn("06_VISITA_EMASESA", "06-VISITA EMASESA", "ptl-fase-activa")}
          ${_filtroBtn("07_PTE_CYCP", "07-PTE CYCP", "ptl-fase-activa")}
          ${_filtroBtn("08_CYCP", "08-CYCP", "ptl-fase-activa")}
        </div>
      </div>
    `;
  }

  console.log("[presupuestos] Módulo cargado. Rutas: /presupuestos, /presupuestos/nuevo, /presupuestos/expediente, /presupuestos/plantillas, /presupuestos/cron-status");

  // Exportar helpers internos para que documentacion.cjs reuse la vista de
  // ficha (ahora la ficha de un CCPP es la misma esté en presupuestos o en
  // documentación; cambia solo lo que se pinta encima/debajo).
  app.locals.presupuestos = {
    leerComunidades,
    buscarComunidadPorId,
    construirDatalists,
    vistaFicha,
    pageHtml,
    sendHtml,
    sendError,
    urlT,
    esc,
    normalizarFase,
    renderCabeceraComun,
    // Helpers para módulo documentación (plantilla de pisos)
    fmtTlf,
    actualizarComunidad,
    actualizarCampoComunidad,
    normalizarCodigoPiso,
    normalizarNombrePiso,
    normalizarTelefonoPiso,
    comparadorNaturalPiso,
    // Constantes que documentación necesita
    SHEET_ID,
    getSheetsClient,
    // Expuestos para sandbox de tests (no usados por otros módulos en producción)
    PTO_FASES,
    fechaHito,
    lineaTiempoHtml,
    COLS,
    rowToObj,
    objToRow,
  };

}; // end module.exports

// reinicio render 1778199437
