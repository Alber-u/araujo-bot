// Build: 2026-06-27 v18.187 (Sobre v18.186: en la ficha del expediente, los 4 importes PREVISTOS (pto_total, tiempo_previsto, mano_obra_previsto, material_previsto) se muestran BLOQUEADOS -gris calc-field, solo lectura- cuando el expediente TIENE Plan 5 (existe fila en plan5_toma_datos, congelado o no): esos valores los graba el boton Congelar, no se editan a mano. Nuevo helper _expedienteTienePlan5(comu) que lee plan5_toma_datos!A:B y casa por ccpp_id (col B) o, de respaldo, por direccion normalizada (col A); si falla devuelve false (no bloquea, no rompe). previstoEditable pasa a exigir ademas !tienePlan5. Coste: 1 lectura ligera A:B por apertura de ficha. No cambia el guardado (los readonly no se editan ni se escriben) ni toca el Sheet. Los expedientes SIN Plan 5 se comportan igual que antes. node --check OK, CRLF.)
// Build: 2026-06-27 v18.186 (Sobre v18.185: la ficha del expediente DEJA DE recalcular el beneficio_previsto en pantalla. La funcion recalc() del front lo recomputaba como pto-mano_obra-material-150 y pisaba (setCalc f_ben_prev) el valor que el campo ya trae del Sheet -> en los expedientes congelados por Plan 5 mostraba 150 EUR de menos (caso Sierra Vicaria 2: Sheet AB=5542,02 correcto, pantalla mostraba 5392,02). Ahora beneficio_previsto es SOLO lectura del Sheet: lo calcula la formula heredada en los antiguos y lo graba el boton Congelar en los nuevos; la ficha solo lo MUESTRA (ya se formatea en el bloque .campo-euros). El valor bp se lee del propio campo unicamente para el desvio en vivo. beneficio_real y desvio en vivo se mantienen igual. Solo pantalla: no escribe nada en el Sheet (el campo es readonly y actualizarCampoComunidad rechaza esa columna), no toca datos de ningun expediente. node --check OK, CRLF.)
// Build: 2026-06-27 v18.185 (Sobre v18.184: crearComunidad ya NO inyecta la formula de AB beneficio_previsto en los expedientes nuevos (decision Guille: todos los nuevos van por Plan 5, que escribe el beneficio plano en AB al congelar; la formula de AB no se usa). AB nace VACIA. Las otras tres formulas calculadas (AC beneficio_real, AD beneficio_desvio, AG tiempo_desvio) se MANTIENEN intactas. Unico cambio: se elimina la linea del range comunidades!AB del batchUpdate USER_ENTERED de crearComunidad. node --check OK, CRLF. No toca ninguna otra cosa.)
// Build: 2026-06-27 v18.184 (Sobre v18.183: menu hamburguesa. Se ELIMINA el item "VOLVER AL LISTADO" (y con el, el bloque if(opts.expedienteId) del menu, que ya solo contenia ese item). Era redundante con "LISTADO DE PRESUPUESTOS", que se muestra SIEMPRE arriba del menu (en todas las fases). El item "PRESUPUESTO PLAN 5" NO se ve afectado: sigue insertandose tras "LISTADO DE PRESUPUESTOS" via _plan5Item (condicionado a expedienteId && fase>=3), que es independiente de ese bloque. Resultado dentro de expediente: LISTADO DE PRESUPUESTOS, [PRESUPUESTO PLAN 5 si fase>=3], MAPA, sep, PLANTILLAS MAIL/DOC, FLUJO BOT. node --check OK, CRLF.)
// Build: 2026-06-27 v18.183 (Sobre v18.182: fase 03_ENVIO_PTO de la ficha. (1) Se ELIMINA la definicion muerta de botonPlan5 (y su dirExp, que solo servia para ese boton) que habia quedado inerte al quitar el boton de pantalla en v18.182 -> se limpia. (2) El grid de accion de la fase 03 (.ptl-next-action-grid) tenia 3 columnas (minmax(0,1fr) auto auto) pensadas para izquierda + boton Plan5 + boton enviar; al quitar el Plan5 quedaba la 3a columna vacia (hueco a la derecha). Se aplica la clase YA EXISTENTE .ptl-next-action-grid-2col (grid-template-columns: minmax(0,1fr) auto) para que el grid sea de 2 columnas y el boton "Enviar presupuesto y paso a 04" se pegue a la derecha sin hueco. (3) Acompana a estilo-visual.cjs: el boton enviar-avanzar pasa a ocupar TODA la altura de la cinta de fase (flex:1) en la variante 2col, en vez de los 32px fijos. node --check OK, CRLF.)
// Build: 2026-06-27 v18.182 (Sobre v18.181: MENU del expediente y DATOS ECONOMICOS. (1) Se ELIMINA el boton "Presupuesto Plan 5" que se dibujaba en la pantalla en fase 03_ENVIO_PTO (se quita la insercion del grid de accion; la definicion queda inerte). (2) El item "PRESUPUESTO PLAN 5" del menu hamburguesa pasa a 2a posicion, justo debajo de "LISTADO DE PRESUPUESTOS", y SOLO aparece desde la fase 03 en adelante: nuevo _plan5Item condicionado a opts.expedienteId && parseInt(opts.expedienteFase,10)>=3; pageHtml recibe ahora expedienteFase (=normalizarFase(comu.fase_presupuesto)) desde la ficha del expediente. En 01/02 y ZZ_* no sale. (3) Se ELIMINA el item "DOCUMENTACION" del menu hamburguesa (la pantalla /documentacion/expediente sigue accesible por sus otros ~15 accesos). (4) DATOS ECONOMICOS: la celda "PTO total" pasa de col 12 a col 4 (1/3, igual que las demas) con un relleno <div class="col-8"></div> para que quede arriba sola sin descuadrar el resto de filas. node --check OK, CRLF. Solo toca menu+cabecera y la rejilla economica; no cambia logica de negocio.)
// Build: 2026-06-12 v18.181 (Sobre v18.180: FORMULARIO NUEVO EXPEDIENTE - autorrelleno de administrador (lo que la ficha ya hacia y aqui faltaba). (1) construirDatalists ya generaba adminInfo {nombre -> {telefono,email,ccpps:[...]}}; ahora se PASA a vistaNuevo (nuevo parametro) desde los dos puntos que la renderizan (GET /presupuestos/nuevo y el errPage del POST). (2) En el script del formulario: al ELEGIR un administrador del menu de sugerencias (elegir() con data-ac=admins) o al SALIR del campo nombre con un administrador que existe (blur), se traen su telefono y email. El administrador MANDA: se SOBRESCRIBEN SIEMPRE ambos campos con los suyos, aunque ya hubiera algo escrito y aunque en la BD vengan vacios (helper rellenarAdmin + buscarAdminNuevo, exacto y case-insensitive; normaliza el nombre a la capitalizacion de BD). (3) PROPAGACION: si con un administrador puesto se edita a mano su telefono o email (blur con valor != dataset.orig), se pregunta -igual que en la ficha- '<admin> esta en N CCPPs, aplicar el cambio en TODAS?' y se manda al endpoint EXISTENTE POST /presupuestos/admin/actualizar (params nombre_admin/campo/valor -> {actualizadas}); como el expediente nuevo aun no existe, propaga a las CCPPs YA existentes del admin y la nueva se crea con el dato corregido al pulsar Crear. Si el administrador no esta en BD (nuevo), no se propaga nada. Se actualiza la cache local adminInfoNuevo y el dataset.orig tras propagar. node --check OK, CRLF. No toca el envio de correo (v18.180) ni el resto del formulario; solo anade el cableado del administrador.)
// Build: 2026-06-12 v18.180 (Sobre v18.179: SOLUCION DEFINITIVA al modal que se quedaba colgado en "Enviando...". CAUSA: los endpoints de envio (/enviar-mail de plantilla y /mail-enviar-manual) hacian TODO el trabajo (descargar adjuntos de Drive con enviarMailReal -> hasta 20s por adjunto, L1309; + envio SMTP SIN timeout, L2155) ANTES de responder. Con adjuntos eso tardaba 30-90s, la conexion del navegador caducaba y el await fetch del modal nunca se resolvia -> boton pegado en "Enviando..." aunque el mail SI salia (se registraba en historico y avanzaba de fase). Riesgo: reenvio accidental al ver el modal colgado = duplicado. ARQUITECTURA NUEVA (envio asincrono + idempotente): (1) Infra en servidor: _enviosJobs (Map en memoria, podada a 10min), _crearFakeRes (captura status/json/send), _envolverEnvioAsync(core) que -si el body trae envioId- responde AL INSTANTE {encolado:true,envioId}, ejecuta el core POR DETRAS con un fake-res y guarda el resultado en el job; si NO trae envioId ejecuta el core sincrono como siempre (compat: boton Saltar envio). Idempotente: el mismo envioId NO reenvia, devuelve el job existente (protege de duplicados por re-clic/reconexion). (2) Nuevo endpoint GET /presupuestos/expediente/envio-estado?envioId=... devuelve {estado:en_curso|ok|error_http|error|desconocido,status,isJson,payload}. (3) Los DOS endpoints pasan a core nombrado (_coreEnviarMail, _coreMailManual) registrado via _envolverEnvioAsync; su logica interna NO se toca (mismo envio, mismo registro en historico, mismo avance de fase). (4) Cliente: ambos modales (plantilla ptl-mm-enviar y manual sSend) generan un envioId unico, lo mandan, reciben {encolado} y SONDEAN con el nuevo helper global window.ptlSondearEnvio cada 1.5s hasta ok/error (tope 3 min). En ok usan el payload real (avanzado/avanzadoA05/etc, identico a antes: alert + cerrar + recarga). En error muestran el motivo y reactivan el boton. En TIMEOUT (3min sin respuesta) avisan "puede que ya se haya enviado, refresca y comprueba en COMUNICACIONES antes de reenviar" y recargan, sin afirmar exito en falso. El boton Saltar envio sigue sincrono (no manda envioId). (5) De paso: timeouts al transporter SMTP (connectionTimeout/greetingTimeout 20s, socketTimeout 30s) para que un SMTP atascado falle en vez de colgarse sin fin. Validado en arnes aislado: encolado instantaneo, idempotencia (sendCount=1 con re-POST), transiciones en_curso->ok con payload, errores 400 y excepcion bien clasificados, fallback sincrono y estado desconocido. node --check OK, CRLF. No cambia QUE se envia ni el avance de fase; solo COMO se espera la respuesta. Mantiene integra la v18.178 (boton Activar mail automatico).)
// Build: 2026-06-11 v18.179 (NO-OP sobre v18.178: bump de version SIN ningun cambio de codigo, logica ni estilo. Unico objetivo: generar un commit nuevo (hash distinto) para forzar un deploy LIMPIO en Render, que se ha quedado sirviendo v18.177 pese a estar v18.178 en GitHub (sintoma: la ficha de fase 01 sigue mostrando la casilla "Proximo mail" y NO el boton Activar mail automatico, aunque el codigo nuevo ya invierte el || en L4697). Mismo patron de diagnostico que las v18.43/v18.44 historicas. Si tras subir esta v18.179 la ficha de un expediente 01 en 0+0/3 sigue sin mostrar el boton, queda confirmado que el auto-deploy de Render esta atascado y Alberto debe lanzar Manual Deploy desde el panel. Mantiene integra la v18.178.)
// Build: 2026-06-11 v18.178 (Sobre v18.177: FIX visual fase 01_CONTACTO. El boton "📧 Activar mail automatico" (btnMailHtml, primer envio de la fase) NUNCA se pintaba porque en el hueco central (L4696) iba detras de miniBloqueHtml en un ||, y en la fase 01 miniBloqueHtml (la casilla "Proximo mail") SIEMPRE tiene contenido, asi que ganaba siempre y enterraba el boton. Se invierte la prioridad a btnMailHtml || miniBloqueHtml || '<div></div>': como btnMailHtml solo existe con numEnviosFase===0, queda: 0 envios -> sale el boton (la casilla Proximo mail no hace nada util aun, el cron de la 01 exige primer envio previo, L9123); tras el primer envio -> btnMailHtml vacio -> vuelve a salir "Proximo mail". Coherente con el comentario L4625-4626 ("Cuando ya hay envios, se oculta"). El boton abre el mismo modal/flujo que el aviso ¿Activar envios automaticos? de creacion (ptlAbrirModalMail('01_CONTACTO')): manda el 1er mail, registra 1+0/3 y NO avanza de fase, dejando el cron en marcha. Solo se reordena el || de una linea; ninguna logica, id ni endpoint cambia.)
// Build: 2026-06-09 v18.177 (Sobre v18.176: en los DOS modales de correo (Enviar mail manual ptlComSendModal y Enviar mail con plantilla ptl-modal-mail) el campo ASUNTO pasa a ser el PRIMER campo, encima de Destinatario/Para. Nuevo orden en ambos: Asunto, Destinatario/Para, CC, CCO, Cuerpo/Mensaje. Solo se reordenan los bloques HTML; los id de los campos, su precarga y la logica de envio no cambian.)
// Build: 2026-06-09 v18.176 (Sobre v18.175: pantalla HOY, ORDEN de las cajas. La caja "🔔 Avisos" (cajaSinRespuesta) sube a la PRIMERA posicion, encima de "Mails pendientes". Nuevo orden: Avisos, Mails pendientes, Expedientes HOY, Datos economicos, 02-VISITA. Solo se reordena el layout (.hoy-page); no cambia el contenido ni la logica de ninguna caja.)
// Build: 2026-06-08 v18.175 (Sobre v18.174: caja COMUNICACIONES de la ficha (todas las fases). (1) ALTURA LIBRE: .ptl-com-list deja de tener altura fija 138px + overflow-y:auto + resize:vertical; ahora crece segun los mails que tenga (sin tope, sin scroll interno, sin tirador). El script de auto-scroll al fondo se mantiene pero queda inerte (la caja ya no scrollea). (2) ACORDEON: al pinchar el asunto de un mail para abrir su detalle, se cierran TODOS los demas detalles abiertos (solo uno abierto a la vez). Antes cada uno se abria/cerraba por su cuenta y podia haber varios abiertos. Solo display; no toca datos ni logica.)
// Build: 2026-06-07 v18.174 (Sobre v18.173: la nota de la caja Avisos pasa a ser LA NOTA DEL PISO (pestana pisos, notas_piso), unica por piso: se lee de pisos y se guarda con el endpoint existente /piso/guardar-notas-hoy (clase hoy-piso-notas, ccpp_id+vivienda). Se elimina el guardado en columna AC (campo "notas") y su handler. Si no se resuelve el ccpp, la nota se muestra como solo lectura.)
// Build: 2026-06-07 v18.173 (Sobre v18.172: en la caja Avisos la DIRECCION es ahora un enlace a la ficha de documentacion con scroll al piso (#piso-<vivienda>), como en otras ventanas. Se resuelve el ccpp_id desde la comunidad del expediente (mapa normalizado direccion/comunidad -> ccpp_id de comusListado). Si no se resuelve, queda como texto.)
// Build: 2026-06-07 v18.172 (Sobre v18.171: nuevo aviso "faltan documentos" (badge ROJO) para expedientes con requiere_intervencion_humana="si" (3er fallo: el bot dejo seguir pero falta validar un doc). Tiene PRIORIDAD sobre "Documentacion completa". Check "Revisado" lo quita (flag en col AD). Lectura A:AC -> A:AD. Endpoint /hoy-bot-llamado acepta campo "revisado_faltan" -> col AD.)
// Build: 2026-06-07 v18.171 (Sobre v18.170: el aviso "Documentacion completa" desaparece al marcar "Revisado": (1) en la lectura se omiten los expedientes finalizados con AB="1"; (2) al marcar el check Revisado, la fila se quita al instante del DOM. El check "Llamado" de presentacion NO quita la fila.)
// Build: 2026-06-07 v18.170 (Sobre v18.169: caja Avisos: (1) el badge "Documentacion completa" pasa de verde a AMARILLO (ptl-fila-badge-decidir). (2) entre telefono y badge se anade un campo de NOTAS del piso (textarea), que se guarda en bot_expedientes columna AC (campo "notas" del endpoint /hoy-bot-llamado). Se autoguarda al salir del campo.)
// Build: 2026-06-07 v18.169 (Sobre v18.168: el aviso "Documentacion completa - revisar" solo sale cuando el expediente esta en paso "finalizado" (TODA la documentacion entregada, financiacion incluida). Antes salia tambien en "documentacion_base_completa" (base hecha pero financiacion pendiente), lo cual era prematuro.)
// Build: 2026-06-07 v18.168 (Sobre v18.167: caja Avisos: piso/nombre/telefono pasan a ancho natural (pegados entre si) en vez de anchos fijos 50/170/90, dejando hueco a la derecha para futuras notas del piso.)
// Build: 2026-06-07 v18.167 (Sobre v18.166: pantalla HOY: (1) "Mails pendientes" pasa a ir ARRIBA, encima de "Expedientes hoy". (2) Telefonos en TODAS las ventanas sin prefijo +34/34 y en formato xxx-xxx-xxx (helper _fmtTel; tambien el _fmtTel de admin/presidente de la caja visita deja de mostrar el +34). (3) La caja Avisos ahora incluye un 2o tipo: "Documentacion completa - revisar" (expedientes con paso finalizado o estado documentacion_base_completa), badge verde y check "Revisado" (col AB). El check se generaliza con data-campo (llamado->AA, revisado->AB); endpoint /hoy-bot-llamado acepta campo y amplia la cuadricula a la columna necesaria.)
// Build: 2026-06-07 v18.166 (Sobre v18.165: caja Avisos de HOY: (1) el badge quita "ptl-fila-badge-fijo" (ancho fijo 85px que descuadraba el texto largo); queda pill rojo de ancho natural alineado a la derecha. (2) el endpoint /hoy-bot-llamado ahora amplia la cuadricula de bot_expedientes a 27 columnas si hace falta (asi la columna AA existe y el guardado del check funciona) y devuelve errores en texto plano. Acompana a estilo-visual v1.95 (estilo del check identico).)
// Build: 2026-06-07 v18.165 (Sobre v18.164: titulo de la caja "Sin responder a la presentacion" -> "Avisos". Solo display.)
// Build: 2026-06-07 v18.164 (Sobre v18.163: la fila de "Sin responder a la presentacion" se reestructura: direccion (160px) + check (como la fila de expedientes, mismos tamanos) + piso + nombre + telefono + badge a la derecha con el estilo de "Faltan X de Y" (ptl-fila-badge-danger).)
// Build: 2026-06-07 v18.163 (Sobre v18.162: caja "Sin responder a la presentacion" de HOY: se quita el boton WhatsApp; la fila copia el orden de la linea de pisos de "Expedientes HOY" (vivienda/nombre/telefono) y termina con un badge rojo "X dias sin responder a presentacion". Se anade una casilla "Llamado" (mismo funcionamiento que el check visto_hoy) que se guarda en bot_expedientes columna AA (que el bot NO toca, A:Z) por telefono. Nuevo endpoint POST /presupuestos/hoy-bot-llamado.)
// Build: 2026-06-07 v18.162 (Sobre v18.161: pantalla HOY: nueva caja "Sin responder a la presentacion" ENTRE Mails pendientes y Datos economicos. Lista los pisos en paso pregunta_tipo que llevan >= t_presentacion_2 dias (def 5) sin elegir su situacion (1-5). Muestra vivienda, nombre, telefono, dias y enlace de WhatsApp. Se vacia sola cuando responden. Lectura defensiva de bot_expedientes/bot_plantillas en try/catch.)
// Build: 2026-06-07 v18.161 (Sobre v18.160: nueva tarjeta "Twilio - reenvio presentacion (X y Y dias)" (helper presentcard) ENCIMA de Twilio - Sleep: edita t_presentacion_1 y t_presentacion_2 (dias + on/off) + SID Twilio de la plantilla presentacion; texto Twilio solo lectura. Nuevo endpoint POST /presupuestos/plantillas-bot/presentacion. Acompana a bot v0.57.)
// Build: 2026-06-07 v18.160 (Sobre v18.159: limpieza de codigo muerto: se eliminan las constantes colOK/colREV/colREP del panel de flujo (definian de nuevo las tarjetas OK/REVISAR/REPETIR pero no se renderizaban; eran un duplicado que obligaba a editar etiquetas en dos sitios). Las tarjetas reales siguen en cols5. Sin cambio visual.)
// Build: 2026-06-07 v18.159 (Sobre v18.158: etiqueta "aviso - doc revisar ultimo" -> "aviso - doc revisar (ultimo)". Solo display.)
// Build: 2026-06-07 v18.158 (Sobre v18.157: etiqueta "aviso - doc ultimo ok" -> "aviso - doc ok (ultimo)". Solo display.)
// Build: 2026-06-07 v18.157 (Sobre v18.156: renombrados (display) los avisos REVISAR/REPETIR/ayuda a formato "aviso - doc ...": revisar, revisar ultimo, repetir, repetir 2, repetir 3 (en colREV/colREP y cols5). Solo display.)
// Build: 2026-06-07 v18.156 (Sobre v18.155: errores renombrados a "error - mensaje" y "error - doc"; "aviso - OK"->"aviso - doc ok"; "aviso - OK (ultimo)"->"aviso - doc ultimo ok" (en colOK y cols5). Solo display.)
// Build: 2026-06-07 v18.155 (Sobre v18.154: avisos de resultado renombrados a formato "aviso - ...": "Aviso OK"->"aviso - OK", "Aviso OK (ultimo)"->"aviso - OK (ultimo)", "Aviso REVISAR"->"aviso - REVISAR", "Aviso REVISAR (ultimo)"->"aviso - REVISAR (ultimo)", "Aviso REPETIR"->"aviso - REPETIR" (en las dos definiciones: colOK/REV/REP y cols5). Solo display.)
// Build: 2026-06-07 v18.154 (Sobre v18.153: etiqueta "doc - acuse recibo" -> "aviso - doc recibido". Solo display.)
// Build: 2026-06-07 v18.153 (Sobre v18.152: renombradas 5 etiquetas de tarjeta (display): "doc recibido - acuse"->"doc - acuse recibo"; "Continuar - pagina siguiente"->"doc - pagina siguiente"; "Falta por enviar"->"doc - falta enviar"; "Doc validado"->"doc - validado"; "Continuar sin el opcional"->"doc - seguir sin opcional". Solo display.)
// Build: 2026-06-07 v18.152 (Sobre v18.151: orden de la columna "A pisos": los dos Sleep juntos y el Wake up debajo -> sleepcard, plazocard, wakecard. Solo display.)
// Build: 2026-06-07 v18.151 (Sobre v18.150: columna "A pisos" mas agrupada: se quitan los 3 subtitulos. La tarjeta de plazo se renombra "Por plazo (X / Y / Z dias)" -> "Plazo - Sleep (X, Y y Z dias)". "Automatico - Wake up (sin dias)" -> "Automatico - Wake up". Solo display.)
// Build: 2026-06-07 v18.150 (Sobre v18.149: los 3 avisos de PLAZO se resumen en UNA tarjeta "Por plazo (X / Y / Z dias)" (helper plazocard): edita los tres plazos t_plazo_1/urgente/fuera (dias + on/off) y UN solo texto (msg_plazo_1, con {nombre} {lista} {dias}). Sustituye a las 3 avcards. Nuevo endpoint POST /presupuestos/plantillas-bot/plazo. Acompana a bot v0.52. Solo display + endpoint.)
// Build: 2026-06-07 v18.149 (Sobre v18.148: corregido el titulo del Sleep: "X e Y dias" -> "X y Y dias". Solo display.)
// Build: 2026-06-07 v18.148 (Sobre v18.147: columna de avisos a pisos reorganizada en 3 subgrupos por DISPARADOR y renombrada de "A pisos (por tiempo)" a "A pisos". Subgrupos: "Por inactividad (callado)" -> Twilio Sleep; "Por actividad (responde)" -> Automatico Wake up; "Por plazo (tiempo)" -> Plazo 10/18/20. Solo display.)
// Build: 2026-06-07 v18.147 (Sobre v18.146: (1) titulo de la tarjeta Sleep dinamico: "Twilio - Sleep (X e Y dias)" con X=t_inactividad_1 e Y=t_inactividad_2 (los dias programados), no fijo. (2) La tarjeta "Automatico - Wake up" pasa de card() a helper wakecard() que SI muestra y deja editar el texto (lee msg_inactividad_1 de plantillas con fallback) y guarda en /plantillas-bot/guardar; pista de variables {nombre} {lista} {dias}. Solo display.)
// Build: 2026-06-07 v18.146 (Sobre v18.145: panel Flujo bot, subgrupo inactividad reorganizado a 2 tarjetas. (1) Nueva tarjeta "Twilio - Sleep (1 y 3 dias)" (helper sleepcard): edita los DOS plazos t_inactividad_1 y t_inactividad_2 (dias + on/off) y el SID Twilio en un solo formulario; texto Twilio en solo lectura. (2) "Automatico - Wake up (sin dias)" pasa a tarjeta de solo texto (card msg_inactividad_1), sin campo de tiempo. (3) Se quita la tercera tarjeta "Inactividad - insistente" y el subtitulo vacio "Antes de responder". (4) Sin rastro de msg_inactividad_2: fuera de _AVDEF y del MAP de avisos-tiempos. (5) Nuevo endpoint POST /presupuestos/plantillas-bot/sleep que guarda los dos tiempos + SID. Solo display + endpoint.)
// Build: 2026-06-07 v18.145 (Sobre v18.144: panel Flujo bot, columna "A pisos", subgrupo "Despues (por inactividad)". Solo se renombran 2 etiquetas de tarjeta (display): "Twilio - recordatorio" -> "Twilio - Sleep (1 y 3 dias)"; "Inactividad - 1er recordatorio" -> "Automatico - Wake up (sin dias)". No se toca logica ni claves ni el Sheet.)
// Build: 2026-06-07 v18.144 (Sobre v18.143: panel Flujo bot, columna "A pisos". El Twilio - recordatorio se MUEVE del subgrupo "Antes de responder" a "Despues (por inactividad)" (es el aviso proactivo que se dispara por inactividad). El subtitulo "Antes de responder" se MANTIENE vacio (pendiente de decidir su contenido). Solo display.)
// Build: 2026-06-07 v18.143 (Sobre v18.142: los campos REALES de DATOS ECONOMICOS (tiempo_real, mano_obra_real, material_real) pasan a editarse SOLO en fase 09_TRAMITADA: realEditable cambia de (fase==="08_CYCP") a (fase==="09_TRAMITADA"). Quedan bloqueados en 01-08 (antes se abrian en 08). El fondo gris de bloqueado lo da estilo-visual v1.94 (.calc-field -> gray-400). Solo 1 condicion + comentario.)
// Build: 2026-06-07 v18.142 (Sobre v18.141: la altura inicial de la caja COMUNICACIONES baja un 40%: de 230px a 138px (resize:vertical, overflow-y:auto, min-height 80px y scroll al fondo se mantienen). Solo display.)
// Build: 2026-06-07 v18.141 (Sobre v18.140: caja COMUNICACIONES de la ficha del expediente (TODAS las fases). La lista .ptl-com-list deja de ser overflow:visible (crecia sin limite mostrando todos los mails) y pasa a altura fija 230px con overflow-y:auto + resize:vertical (tirador para que el usuario la agrande a mano; min-height 80px), aproximada a la altura de la caja DATOS ECONOMICOS. Al cargar la ficha se hace scroll automatico al fondo (id ptlComList, scrollTop=scrollHeight via requestAnimationFrame) para ver de entrada los ULTIMOS mails; subiendo con la rueda o agrandando se ven los primeros. NOTAS no se toca. El tamano al que se arrastre no se recuerda al recargar. Solo display.)
// Build: 2026-06-07 v18.140 (Sobre v18.139: panel Flujo bot. (A) GAP: las tarjetas .pbotflujo .ptl-card pasan de margin:0 a margin:0 0 var(--ptl-card-gap) (cogen el gap universal, 5px), y la rejilla .pbf-grid de gap:5px 7px a gap:0 7px para no duplicar el vertical (lo pone ya el margen de la card): el grid de Flujo se ve igual y los avisos pasan de pegados a 5px. (B) COLOR DE TITULOS: los 4 subtitulos _miniH que iban en azul invisible (Acuse de recibo, Antes de responder, Despues por inactividad, Despues por tiempo), las cabeceras de columna (_col / .pbf-av-h) y los titulos de seccion .pbf-grp pasan a color:var(--ptl-titulo) (= general-2). (C) las secciones FLUJO/AVISOS/EXIGENCIA (.pbf-grp) ganan una linea inferior border-bottom:2px solid var(--ptl-titulo) del mismo color. Va de la mano de estilo-visual v1.93. Solo display.)
// Build: 2026-06-07 v18.139 (Sobre v18.138: unificacion del gap entre tarjetas bajo una sola palanca (--ptl-card-gap, ahora 5px en estilo-visual v1.92). (1) Se quita el margin-bottom:4px inline de las 5 tarjetas de plantillas (mail: cada fase y PIE GLOBAL; doc: cada documento, ENCABEZADO GLOBAL y PIE GLOBAL) para que manden el .ptl-card global; en las que ademas tenian border-color se conserva el border-color. (2) Pantalla HOY: el gap de la rejilla .hoy-page pasa de 4px a 0, para que sus cajas separen SOLO por el margen de la card (= --ptl-card-gap) y no sumen el doble; asi HOY queda igual de compacto que el resto. No se tocan los .ptl-card-title/-title-row (margenes negativos de cabecera, intencionales). Va de la mano de estilo-visual v1.92. Solo display.)
// Build: 2026-06-07 v18.138 (Sobre v18.137: los adjuntos ENTRANTES por IMAP dejan de subirse directos a la carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES y pasan a una subcarpeta temporal "00 ARCHIVOS MAILS PENDIENTES" dentro de esa carpeta padre. Nuevo helper _getOrCreateCarpetaMailsPendientes() (busca/crea la subcarpeta, mismo patron que la subcarpeta adjuntos del expediente); _subirAdjuntosEntrantes la usa como destino. Al clasificar el mail, _moverAdjuntosACarpetaExpediente sigue igual (mueve por ID con add/removeParents), asi que los ficheros pasan de esa subcarpeta a la subcarpeta adjuntos del expediente sin tocar nada mas. node --check OK, CRLF.)
// Build: 2026-06-06 v18.137 (Sobre v18.136: (1) gap de la rejilla de Flujo (.pbf-grid) vuelve a su valor original "5px 7px" (se habia quitado en v18.131). (2) borde de la caja Exigencia igualado al de las plantillas (var(--ptl-gray-200)) en vez de blanco translucido. (3) boton Guardar de Exigencia pasa a ptl-btn-primary (el gris --ptl-general-2=gray-300 de estilo-visual, el mismo que ya usan los botones de mail y del resto del bot); era el unico distinto (lo habiamos puesto blanco). Solo display.)
// Build: 2026-06-06 v18.136 (Sobre v18.135: renombrados subgrupos de A pisos: "Despues . por inactividad" -> "Despues (por inactividad)" y "Despues . por plazo" -> "Despues (por tiempo)". Solo display.)
// Build: 2026-06-06 v18.135 (Sobre v18.134: ventana Exigencia (1) en azul de marca --ptl-general-1 con textos en blanco/claro (igual que el resto de titulos), boton Guardar en blanco; (2) el boton "Guardar" se sube a la cabecera arriba a la derecha (asociado al form via form=ex-form) y "Seleccionado: X" queda en una linea centrada, para que la ventana sea menos alta. Solo display.)
// Build: 2026-06-06 v18.134 (Sobre v18.133: texto de Exigencia corregido: la barra solo afecta a la calidad de los DNI (no a todas las fotos; PDFs y otros docs se saltan la prueba). "las fotos"->"los DNI". Solo texto.)
// Build: 2026-06-06 v18.133 (Sobre v18.132: renombradas dos columnas: "A pisos por tiempo" -> "A pisos (por tiempo)" y "Al equipo - por evento" -> "Al equipo (por evento)". Solo display.)
// Build: 2026-06-06 v18.132 (Sobre v18.131: las mini-cabeceras de subgrupo que NO son OK/REVISAR/REPETIR pasan todas al mismo color (azul de marca --ptl-general-1): Acuse de recibo, Antes de responder, Despues . por inactividad, Despues . por plazo. OK (verde), REVISAR (ambar) y REPETIR (rojo) conservan su color. Solo display.)
// Build: 2026-06-06 v18.131 (Sobre v18.130: reducido el gap de la rejilla de Flujo (.pbf-grid) de "5px 7px" a "0 8px": las tarjetas quedan pegadas en vertical (como las columnas de Avisos, donde se apilan sin separacion) y 8px entre columnas igual que .pbf-flujo5. Solo CSS.)
// Build: 2026-06-06 v18.130 (Sobre v18.129: unificado el color de los TITULOS al mismo que las cabeceras de tipo "01 Propietario" (.pbf-colhd): banda azul --ptl-general-1 con texto blanco. Afecta a (a) los titulos de las 5 columnas de avisos (_col / .pbf-av-h, antes texto gris) y (b) los titulos de seccion .pbf-grp (Flujo, Avisos...; antes texto gris con linea inferior). Las mini-cabeceras de subgrupo (Acuse/OK/REVISAR/REPETIR, Antes/Despues...) conservan su color. Solo CSS/display.)
// Build: 2026-06-06 v18.129 (Sobre v18.128: renombrados de claridad (documento->doc en titulos): "Documento completo"->"Doc validado" (para no confundir con el acuse), "Documento de varias paginas"->"Doc - varias paginas", "Error de documento"->"Error de doc", "Twilio - documento a revisar"->"Twilio - doc a revisar", "DOC_RECIBIDO . acuse"->"doc recibido - acuse", "Seguir expediente (guia)"->"Continuar - pagina siguiente", "Forma pago"->"Forma de pago". SUBGRUPOS visuales con mini-cabecera de color: en Resultado -> Acuse de recibo / OK / REVISAR / REPETIR; en A pisos por tiempo -> Antes de responder / Despues . por inactividad / Despues . por plazo. Reorden de Avisos de flujo: Continuar, Falta por enviar, Doc varias paginas, Doc validado, Continuar sin opcional. Solo display.)
// Build: 2026-06-06 v18.128 (Sobre v18.127: (1) orden de las 5 columnas: Avisos de flujo, Avisos de resultado, Avisos de error, A pisos por tiempo, Al equipo (equipo al final). (2) DOC_RECIBIDO deja de ser banda y pasa a ser la PRIMERA tarjeta de la columna Avisos de resultado (acuse -> OK/REVISAR/REPETIR). (3) Los titulos de las 5 columnas usan el color de los .pbf-grp (var(--ptl-gray-500)), no verde/azul/morado; las sub-etiquetas OK/REVISAR/REPETIR conservan su color. (4) Columna pisos: se quita el recuadro "El primer aviso..." y se anaden subtitulos "Antes de responder" (sobre Twilio - recordatorio) y "Despues de responder" (sobre los avisos por tiempo); renombrada a "A pisos por tiempo". Solo display.)
// Build: 2026-06-06 v18.127 (Sobre v18.126: GRAN reordenacion del panel de flujo. (1) Las plantillas sueltas (bandas) pasan a ancho completo como Tipo expediente (.pbf-banda-full 760->1000). (2) Las 4 secciones de avisos (flujo, resultado, error, automaticos) se funden en UNA sola seccion "Avisos" con 5 COLUMNAS verticales en .pbf-flujo5: 1 Avisos de flujo, 2 Avisos de resultado (con sus sub-etiquetas OK/REVISAR/REPETIR), 3 Al equipo, 4 A los pisos, 5 Avisos de error; cada una con cabecera de color. DOC_RECIBIDO (plantilla unica) queda como banda a lo ancho encima de las columnas. Se eliminan las cabeceras de seccion vacias. Flujo (rejilla de documentos) y Exigencia se mantienen. Sin cambios en el bot. Solo display.)
// Build: 2026-06-06 v18.126 (Sobre v18.125: (1) todas las tarjetas Twilio se nombran "Twilio - ...". (2) Twilio - presentacion sube al apartado Flujo, a todo el ancho, delante de Tipo expediente (pertenece a ese flujo). (3) Twilio - recordatorio pasa a la columna "A los pisos - por tiempo" (es el primer aviso al vecino callado). (4) Se ELIMINA la seccion "Mensajes aprobados por WhatsApp (Twilio)" y su const twilioCards. (5) "Avisos automaticos" pierde el recuadro blanco, el titulo del relojito y el renglon de descripcion: las dos columnas quedan directas sobre el fondo azul, igual que "Avisos de resultado". Sin cambios en el bot. Solo display.)
// Build: 2026-06-06 v18.125 (Sobre v18.124: la seccion "Avisos automaticos" adopta el MISMO formato visual que "Avisos de resultado": columnas .pbf-av-col con cabecera de TEXTO EN COLOR (sin banda), no el titulo sobre banda azul. "Al equipo - por evento" en azul (#2563eb) a la izquierda y "A los pisos - por tiempo" en morado (#7c3aed) a la derecha (orden normal, ya no row-reverse). Mismas tarjetas desplegables que en v18.124. Solo display.)
// Build: 2026-06-06 v18.124 (Sobre v18.123: reorganizada la seccion "Avisos automaticos" con el MISMO aspecto que "Avisos de resultado" (tarjetas desplegables). (1) Los 4 avisos al EQUIPO (equipo_revisar_documento/_intervencion/_atencion_humana/_expediente_completo) salen de la seccion Twilio y pasan a la columna "Al equipo - por evento" como tarjetas Twilio desplegables (SID + on/off); financiacion_lista queda como nota (es mensaje directo, no Twilio). La seccion Twilio se queda solo con presentacion y recordatorio (los del vecino). (2) La columna "A los pisos - por tiempo" pasa a tarjetas desplegables (nuevo avcard) que editan tiempo (dias) + texto + on/off, cada una con su propio guardado. (3) El endpoint avisos-tiempos guarda UN nivel por tarjeta (req.body.clave/val/on/msg). Sin cambios en el bot. Solo display + endpoint.)
// Build: 2026-06-06 v18.123 (Sobre v18.122: en "Avisos automaticos" / "A los pisos - por tiempo" cada nivel gana un TEXTAREA editable con el mensaje que se manda EN CONVERSACION (claves msg_inactividad_1/2, msg_plazo_1/urgente/fuera; admite {documento} y {extra}); se precarga con el texto actual o el de serie. Nota que separa los dos grupos: estos textos son para cuando el vecino ya escribe; el primer aviso al vecino callado es la plantilla Twilio recordatorio (texto en Twilio). El endpoint avisos-tiempos guarda ahora tambien los msg_* (texto, \r\n->\n) ademas del tiempo (dias) y on/off; defaults del endpoint corregidos a dias (1/3/10/18/20). Acompana a bot v0.46. Solo display + endpoint.)
// Build: 2026-06-06 v18.122 (Sobre v18.121: (1) las plantillas de DOCUMENTOS ya NO se pintan en rojo al estar inactivas (no se activan/desactivan desde el panel) -> se quita la marca. (2) FIX el rojo de las plantillas del BOT: en .pbotflujo el fondo #fff de la tarjeta tapaba el rojo; regla local .pbotflujo .ptl-acordeon-inactiva con !important. (3) En "Avisos automaticos" las columnas se invierten (flex row-reverse): EQUIPO a la izquierda, pisos a la derecha; la columna de pisos pasa a titularse "A los pisos - por tiempo". (4) Todos los tiempos en DIAS (antes inactividad en horas): inactividad def 1 y 3 dias, unidad dias; acompana a bot v0.45 que compara x24. Solo display.)
// Build: 2026-06-06 v18.121 (Sobre v18.120: (1) PLANTILLAS DESACTIVADAS en ROJO: cada tarjeta-acordeon inactiva (mail, doc y bot, incluidas las twilio) recibe la clase .ptl-acordeon-inactiva (estilo-visual v1.91) para verse en rojo plegada y no perderla. (2) NUEVA seccion "Avisos automaticos (tiempos)" en Flujo bot, tras "Avisos de error": dibuja el esquema (al vecino / al equipo) y permite EDITAR los 5 umbrales de los recordatorios proactivos (t_inactividad_1/2 en horas, t_plazo_1/urgente/fuera en dias) y activar/desactivar cada uno; se guardan como ajustes en bot_plantillas via guardarAjusteBot (ampliada con param activo) y endpoint POST .../avisos-tiempos. El bot (v0.44) los lee. Los avisos al equipo se listan informativos (son por evento). Solo display + 1 endpoint.)
// Build: 2026-06-05 v18.120 (Sobre v18.119: (0) ELIMINADO el apartado "Otros mensajes (por clasificar)" y su lista otrosCards: esos 25 flujo_* no estan en el Sheet del usuario; su texto vive a fuego en el bot (fallback de txtPlant), asi que se quitan las tarjetas vacias de la pantalla. (1) "Exigencia con las fotos" -> "Exigencia con los DNI en jpg" (panel y apartado): solo afecta a DNI enviados como imagen. (2) Avisos de resultado: las cabeceras OK/REVISAR/REPETIR pierden el fondo de color (background:none) y pasan a texto en su tono (verde/ambar/rojo). Solo display.)
// Build: 2026-06-05 v18.119 (Sobre v18.118: al cajon "Otros mensajes" se anaden las 3 frases de reconduccion recien externalizadas: flujo_guia_reintento, flujo_guia_paso y flujo_guia_paso_sin_prompt. Acompana a bot v0.36. Solo display.)
// Build: 2026-06-05 v18.118 (Sobre v18.117: REVERTIDO en pantalla lo no conversacional, en linea con bot v0.35. Avisos de error vuelve a error_mensaje/error_documento (los 3 errores de sistema dejan de ser editables). Del cajon "Otros mensajes" se quitan flujo_reintento_seguir, flujo_reintento_seguir_doc, flujo_mensaje_recibido y flujo_numero_no_listado. Quedan solo los mensajes conversacionales. Solo display.)
// Build: 2026-06-05 v18.117 (Sobre v18.116: completada la externalizacion. Avisos de error suma error_guardando_archivo/_archivo_grande/_procesando_archivo. El cajon "Otros mensajes (por clasificar)" recibe el resto de mensajes recien externalizados del bot (reintento, doc_no_corresponde, opcional_no_validado, cierres de expediente y numero_no_listado) para ir clasificandolos. No se tocan Flujo (rejilla) ni Twilio. Acompana a bot v0.34. Solo display.)
// Build: 2026-06-05 v18.116 (Sobre v18.115: (1) el titulo de la pantalla pasa de 🧭 a 🤖 (robot). (2) NUEVO apartado "Otros mensajes (por clasificar)" como cajon temporal para los mensajes que se van externalizando del bot; se iran reclasificando uno a uno. Primer grupo dentro: documento de varias paginas (flujo_pagina_recibida, flujo_largo_sin_archivo, flujo_largo_paginas_malas, flujo_largo_pagina_ajena). No se tocan los apartados Flujo (rejilla) ni Twilio. Acompana a bot v0.33. Solo display.)
// Build: 2026-06-05 v18.115 (Sobre v18.114: renombrados los apartados de la pantalla Flujo bot. La rejilla de documentos+financiacion pasa a tener cabecera "Flujo". Las 5 tarjetas de "mientras el vecino envia" (antes seccion "Flujo") pasan a "Avisos de flujo". "Errores" -> "Avisos de error". "Avisos de resultado", Twilio y Exigencia sin cambios. Solo display.)
// Build: 2026-06-05 v18.114 (Sobre v18.113: la tarjeta de la pantalla Flujo bot "Pasamos a financiacion" pasa a llamarse "Bienvenida financiacion". Solo cambia el TITULO visible; la clave de la plantilla sigue siendo flujo_estudiar_financiacion (no toca Sheet ni bot). Solo display.)
// ===================================================================
// MÓDULO PRESUPUESTOS — Araujo CCPP
// Build: 2026-06-05 v18.113 (Sobre v18.112: dentro del flujo de financiacion, "Pasamos a financiacion" (flujo_estudiar_financiacion) va ANTES de los documentos de pagador (orden real). Y se cierra el recorrido con "Expediente completo" (flujo_base_completo, renombrado) como banda a TODO el ancho = final comun de los 5 caminos. Esos dos mensajes se quitan de la seccion "Flujo" (que se queda solo con los 5 de "mientras envia") para no duplicar. Limpiado el CSS huerfano (.pbf-finrow/.pbf-flecha/.pbf-branch2/.pbf-bh). Concuerda con bot v0.31 (financiacion 09-12 bajo el tipo). Solo display.)
// Build: 2026-06-05 v18.112 (Sobre v18.111: financiacion INTEGRADA en la rejilla de documentos como continuacion: tras Empadronamiento van bandas a lo ancho de las columnas 1-4 (propietario/familiar/inquilino/local; Sociedad fuera porque no se financia) -> "Forma pago" (pregunta) + etiqueta "Si paga a plazos" + DNI pagador delante/detras, justificante, titularidad (mismo doc para los 4). Eliminada la seccion aparte "Forma de pago" y sus cajas (contado/plazos). Solo display: la numeracion de archivos de financiacion en el bot NO cambia (sigue 06-financiacion-01..04, serie compartida).)
// Build: 2026-06-05 v18.111 (Sobre v18.110: la seccion de financiacion se monta como FLUJO: tras los documentos (Empadronamiento) va la pregunta "Forma pago" (antes "Pago plazos") a todo el ancho, y debajo dos ramas -> Contado/comunitaria (sin mas documentos) y Plazos 6/12/18 (con sus documentos: DNI pagador delante/detras, justificante, titularidad), igual que los documentos. Quitado el CSS .pbf-fin ya sin uso. Solo display.)
// Build: 2026-06-05 v18.110 (Sobre v18.109: LIMPIEZA. Los helpers de la clasica (nombreArchivoDesdeClave, _TIPO_NUM_PL, twilioBox) estaban DENTRO de vistaPlantillasBot, asi que ya desaparecieron al quitar esa funcion; no queda codigo huerfano (verificado: 0 referencias). Se elimina ademas la regla CSS .pbf-sub que quedaba definida sin uso. Solo display.)
// Build: 2026-06-05 v18.109 (Sobre v18.108: ELIMINADA la pantalla clasica de Plantillas bot: fuera la funcion vistaPlantillasBot, su ruta GET /presupuestos/plantillas-bot y su boton de cabecera. Queda solo Flujo bot, que ahora luce el muñequito 🤖 (antes 🧭). Los guardados (texto/twilio/exigencia) redirigen siempre a la vista de flujo. Quedan inertes (para una limpieza posterior) helpers que solo usaba la clasica: nombreArchivoDesdeClave, _TIPO_NUM_PL, twilioBox. Solo display.)
// Build: 2026-06-05 v18.108 (Sobre v18.107: (1) etiquetas "Activa" y "Texto del mensaje"/"SID..." en negro (#111), antes gris ilegible. (2) los MENSAJES DE FLUJO se reordenan como mini-flujo (igual que documentos): banda "Mientras envia" con 5 tarjetas + bifurcacion final Contado/comunitaria (base completo) | Plazos (estudiar financiacion). (3) ese bloque se llama "Flujo" y va ANTES de los avisos; "avisos de resultado" pasa a llamarse asi a secas; "financiacion" idem. Solo display.)
// Build: 2026-06-05 v18.107 (Sobre v18.106: Flujo bot: (a) Licencia/declaracion y NIF sociedad bajan a la altura de Autorizacion/Contrato (fila 9); Escritura debajo de NIF (fila 10); Poderes debajo de Escritura (fila 11) -> coincide con la numeracion por nivel del bot. (b) el sello "compartida" ya no va bajo el titulo siempre: aparece DENTRO del acordeon al desplegar, como banda con fondo y letra de titulo (.pbf-compart). Solo display.)
// Build: 2026-06-05 v18.106 (Sobre v18.105: (1) en Flujo bot el texto de las plantillas Twilio se pinta en #111 (negro), antes heredaba un gris poco legible; (2) etiqueta visual "NIF empresa" -> "NIF sociedad". Solo display.)
// Build: 2026-06-05 v18.105 (Sobre v18.104: pantalla Flujo bot AMPLIADA a editor COMPLETO (para sustituir a la clasica): ademas del flujo de documentos trae AVISOS DE RESULTADO como mini-flujo (DOC_RECIBIDO + 3 columnas OK/REVISAR/REPETIR editables), mensajes de flujo, errores, Twilio (solo lectura del texto) y el panel de Exigencia. Reordenado por peticion: DNI administrador a la altura del DNI propietario (delante/detras) y NIF empresa a la altura de los DNI familiar/inquilino delante. En compartidas solo el sello compartida. Titulos mas pequenos (8.5px). Entrada/Solicitud/Financiacion a todo el ancho. La ruta /plantillas-bot-flujo ya carga el texto Twilio; exigencia vuelve a esta vista. Render probado. Solo display.)
// Build: 2026-06-05 v18.104 (Sobre v18.103: pantalla Flujo bot: (1) Entrada/Solicitud/Financiacion a TODO el ancho; (2) repuestas las BIENVENIDAS (una por columna); (3,4) titulos sin preposiciones y sin "del" en los DNI; (6) en las compartidas se deja solo el sello "compartida" (sin "el bot escribe: X", que ya va en el titulo); (7) letra de titulo mas pequena (9.5px); (8,9) cabeceras numeradas 01 Propietario / 02 Familiar / 03 Inquilino / 04 Local / 05 Sociedad. Solo display.)
// Build: 2026-06-05 v18.103 (Sobre v18.102: pantalla "Flujo bot" rehecha en REJILLA alineada: columnas reordenadas a Propietario/Familiar/Inquilino/Local/Sociedad y lo COMUN va en banda a lo ancho (Entrada, Solicitud, DNI del propietario delante/detras span 4 col, Empadronamiento span 3); lo propio de cada tipo en su columna, con huecos donde no aplica. Columnas mas estrechas (~140px), titulos en UN renglon (nowrap+ellipsis) y letra mas pequena. Quitados los enlaces cruzados nueva<->clasica (se navega por los botones de cabecera). Solo display.)
// Build: 2026-06-05 v18.102 (Sobre v18.101: NUEVA pantalla "Plantillas bot por FLUJO" (ruta /presupuestos/plantillas-bot-flujo, vistaPlantillasBotFlujo): muestra el recorrido real del vecino por tipo (5 columnas) + banda Solicitud comun + entrada y financiacion, reutilizando las MISMAS tarjetas-acordeon y el MISMO guardado (POST plantillas-bot/guardar con vista=flujo para volver aqui tras guardar). Refleja las plantillas pide_ UNIFICADAS del bot v0.25: las compartidas (Solicitud, DNI, empadronamiento) llevan sello compartida y muestran que persona escribe el bot. La pantalla clasica /plantillas-bot se MANTIENE intacta. Boton en cabecera + enlaces cruzados. Solo display.)
// Build: 2026-06-05 v18.101 (Sobre v18.98: RESTAURA el panel-esquema de Avisos de resultado a la version v18.100 (vinetas + plantilla Twilio de cada aviso: REVISAR -> equipo_revisar_documento; REPETIR 3er fallo -> equipo_intervencion), que un push externo habia revertido a la version en frases. Resto del archivo intacto. Solo display.)
// Build: 2026-06-04 v18.98 (Sobre v18.97: en Plantillas bot, bajo el titulo del grupo Avisos de resultado se dibuja un PANEL-ESQUEMA con la logica OK/REVISAR/REPETIR que sigue cada documento (recibido -> validacion -> guarda+avanza / guarda+avanza+revisa equipo / no guarda+no avanza, 3er fallo avisa equipo). Solo display.)
// Build: 2026-06-04 v18.97 (Sobre v18.96: en el orden de Avisos de resultado, la clave aviso_rechazado se renombra a aviso_repetir, en linea con bot v0.24 y con la clave del Sheet. Solo cambia el identificador; en pantalla se sigue mostrando como AVISO-REPETIR.)
// Build: 2026-06-04 v18.96 (Sobre v18.95: reordenado el grupo Avisos de resultado: doc_recibido, aviso_revisar, aviso_revisar_fin, aviso_ok, aviso_ok_fin, aviso_rechazado, aviso_ayuda_2, aviso_ayuda_3. Solo display.)
// Build: 2026-06-04 v18.95 (Sobre v18.94: en Plantillas bot, seguir_expediente pasa de Varios al grupo Preguntas/flujo (al final; es una reconduccion de flujo, no un error). El grupo Varios se renombra a Errores y queda con error_mensaje y error_documento. Solo display.)
// Build: 2026-06-04 v18.94 (Sobre v18.93: en Plantillas bot, doc_recibido pasa del grupo Varios al grupo Avisos de resultado, en PRIMERA posicion (es el acuse 'recibido, revisando' que precede a OK/revisar/rechazado). Solo display.)
// Build: 2026-06-04 v18.93 (Sobre v18.92: _FLUJOS_ORDEN (numeracion en pantalla y nombre de archivo mostrado) reordenado para familiar/inquilino/sociedad, igual que FLOWS del bot v0.23, para que el numero mostrado coincida con el orden de peticion y con el nombre del archivo en Drive.)
// Build: 2026-06-04 v18.92 (Sobre v18.91: en Plantillas bot se intercambia el orden de los dos primeros grupos: ahora Preguntas/flujo va PRIMERO y Bienvenidas DESPUES (antes de Peticiones). Solo display.)
// Build: 2026-06-04 v18.91 (Sobre v18.90: la pantalla Plantillas bot se ORDENA por fase de la conversacion con SEPARADORES de grupo (Bienvenidas / Preguntas-flujo / Peticiones de documentos / Avisos de resultado / Varios / Twilio) y SUBSEPARADORES por tipo dentro de Peticiones (Propietario, Familiar, Inquilino, Sociedad, Local, Financiacion). Twilio al final. Solo display: no toca el Sheet ni las claves; el orden se calcula al pintar.)
// Build: 2026-06-04 v18.90 (Sobre v18.89: en Plantillas bot, las plantillas de flujo (clave flujo_*) se MUESTRAN con prefijo FLUJO- (p.ej. FLUJO-PREGUNTA-TIPO), igual que AVISO- y TWILIO-. Solo display; la clave real no cambia. Va con bot-whatsapp v0.22.)
// Build: 2026-06-04 v18.89 (Sobre v18.88: en Plantillas bot, las plantillas de aviso (clave aviso_*) se MUESTRAN con prefijo AVISO- (p.ej. AVISO-OK, AVISO-REVISAR-FIN), igual que TWILIO- y 01-PROPIETARIO-. Solo display: la clave real del Sheet no cambia. Va con bot-whatsapp v0.21.)
// Build: 2026-06-04 v18.88 (Sobre v18.87: en Plantillas bot, la casilla ACTIVA sube a la CABECERA de cada tarjeta (todas, twilio y texto), a la izquierda del boton Guardar y visible solo al abrir; vive fuera del form pero se envia con el via form="formbot-CLAVE". En las tarjetas TWILIO el SID pasa ARRIBA del todo (antes del texto de solo lectura). Solo presentacion/UX, mismo guardado. Va con bot-whatsapp v0.18.)
// Build: 2026-06-04 v18.87 (Sobre v18.86: en Plantillas bot, las tarjetas TWILIO se distinguen a simple vista: el titulo lleva prefijo TWILIO- (p.ej. TWILIO-EQUIPO_INTERVENCION) y su CABECERA va con los colores INVERTIDos respecto al resto (fondo claro / texto oscuro) via .pbot-twilio. Solo visual. Va con bot-whatsapp v0.18. NOTA pendiente: arreglar buscarCarpeta del bot (tope 50 sin paginar -> crea carpetas de expediente duplicadas).)
// Build: 2026-06-04 v18.86 (Sobre v18.85: las 6 plantillas TWILIO pasan a ser acordeones EDITABLES como el resto (antes solo lectura en una caja al final, ahora eliminada). En su tarjeta se muestra el texto real (solo lectura, viene de Twilio) y se puede editar el SID (twilio_sid) y activar/desactivar. guardarPlantillaBot escribe la col E (SID) para tipo twilio (col D texto para el resto), conservando el resto. POST valida formato HX+32. Acompana a bot-whatsapp v0.18, que ya LEE ese SID del Sheet.)
// Build: 2026-06-04 v18.85 (Sobre v18.84: en Plantillas bot, tarjetas mas compactas en vertical via un <style> de ambito propio (.pbot-lista): .ptl-card padding 0 + overflow hidden, .ptl-card-title sin margenes y padding 4px 10px, quitando el hueco bajo cada cabecera. Scoped a la lista de plantillas: NO afecta a mail/doc/panel ni a estilo-visual.cjs. Va con bot-whatsapp v0.17.)
// Build: 2026-06-04 v18.84 (Sobre v18.83: en Plantillas bot, cada plantilla pide_* se MUESTRA con su nombre-archivo numerado (mismo esquema que el bot v0.17: {NN-tipo}-{MM-doc}-{codigo}) via nombreArchivoDesdeClave, para casarlas con los archivos de Drive. La clave real (la que se guarda) NO cambia. Ademas se quita el subtitulo "vecino - texto" de cada tarjeta (solo queda "(inactiva)" cuando aplica) para verlas mas compactas. Va con bot-whatsapp v0.17.)
// Build: 2026-06-04 v18.83 (Sobre v18.82: PUNTO 1 - en Plantillas bot, la caja de mensajes twilio MUESTRA EL TEXTO REAL de cada plantilla aprobada, leido de la Content API de Twilio (GET content.twilio.com/v1/Content/SID, auth basica con TWILIO_ACCOUNT_SID/AUTH_TOKEN ya en Render). Helper obtenerTextoTwilio(sid) con cache 10min + timeout 4s + fallback (si falla/faltan credenciales, solo el SID, como antes). Solo lectura: no toca el bot ni los envios. Va con bot-whatsapp v0.17.)
// Build: 2026-06-03 v18.82 (Sobre v18.81: CUADRO DE MANDOS en Plantillas bot: barrita de 5 topes (Muy tolerante..Muy estricto) que fija la EXIGENCIA con las fotos. Se guarda en la fila exigencia_fotos (tipo ajuste) de bot_plantillas via guardarAjusteBot (crea la fila si no existe) y ruta POST .../exigencia; el bot (v0.15) la lee y aplica el preset. La fila ajuste NO se pinta como plantilla editable. Va con bot-whatsapp v0.15.)
// Build: 2026-06-03 v18.81 (Sobre v18.80: en Plantillas bot, el aviso de twilio pasa de un texto arriba a una CAJA de solo lectura AL FINAL que lista los mensajes aprobados por WhatsApp (clave + destinatario + SID + variables), no editables. Arriba queda solo el intro de edicion.)
// Build: 2026-06-03 v18.80 (Sobre v18.79: pantalla Plantillas bot: se OCULTAN las filas tipo twilio (presentacion/recordatorio/avisos equipo) por ser plantillas aprobadas por WhatsApp que viven en Twilio; en su lugar un aviso arriba explicandolo y listandolas. Solo se editan las 42 de tipo texto.)
// Build: 2026-06-03 v18.79 (Sobre v18.78: NUEVA pantalla "Plantillas bot" (textos del bot WhatsApp en la tab bot_plantillas), calcada de plantillas-doc: RANGO_BOT_PLANTILLAS + leerPlantillasBot/guardarPlantillaBot (solo toca texto+activo, conserva el resto), vistaPlantillasBot (acordeon por clave, textarea texto + check Activa; filas twilio en solo-lectura), rutas GET /presupuestos/plantillas-bot y POST .../guardar. Boton nuevo en renderCabeceraComun y el de doc renombrado a "Plantillas doc". Va con bot-whatsapp v0.14.)
// Build: 2026-06-03 v18.78 (Sobre v18.77: POST /presupuestos/piso/modo-bot acepta enviar_presentacion; al activar el bot (M->W) y si se pide, envia la presentacion a ESE piso via app.locals.botWhatsapp (bot v0.10). Devuelve {presentacion:{estado}}. Va con documentacion v17.60.)
// Build: 2026-05-31 v18.77 (Sobre v18.76: soporte del switch del bot por PISO. _actualizarCampoPiso admite bot_piso_activo (col AV). Nueva ruta POST /presupuestos/piso/modo-bot {ccpp_id,vivienda,modo}. Va con documentacion v17.53 y estilo v1.90.)
// Build: 2026-05-31 v18.76 (Sobre v18.75: renombrada la columna AP modo_documentacion -> bot_comunidad_activo en COLS (interruptor del bot WhatsApp por comunidad). Valores MANUAL/BOT_WHATSAPP, vacio=MANUAL. Mismo sitio en el Sheet (AP), NO cambia rangos. Va con documentacion v17.52.)
// Build: 2026-05-31 v18.75 (Sobre v18.74: en las cabeceras de fase de HOY, el contador (X de Y) se pinta de rojo --ptl-danger cuando X != Y (faltan por sacar); si X == Y se queda en --ptl-general-2. Solo el contador; el titulo de la fase no cambia.)
// Build: 2026-05-31 v18.74 (Sobre v18.73: en HOY, el nombre del piso (sub-fila) pasa a ser un ENLACE a la ficha de documentacion (/documentacion/expediente) anclado a ese piso (#piso-<vivienda>). Al abrir, la pagina baja hasta la fila del piso. El piso solo existe en documentacion, no en presupuesto. Va junto con documentacion v17.51.)
// Build: 2026-05-31 v18.73 (Sobre v18.72: ajuste del orden en HOY (04/05/08). La X de "Faltan X de Y" pasa a ordenarse de MAS a MENOS en Decidir/En plazo/Sin badge (antes era de menos a mas). Retrasados siguen de mas a menos dias. Los que no tienen "Faltan" van al final de su grupo. Desempate alfabetico. Verificado con test.)
// Build: 2026-05-31 v18.72 (Sobre v18.71: ORDEN de expedientes en HOY dentro de las fases 04, 05 y 08. Por grupos: 1o Retrasado (mas a menos dias), 2o Decidir (menos a mas X de Faltan), 3o En plazo (menos a mas X), 4o sin badge (menos a mas X); desempate alfabetico por direccion en todos los grupos. Solo reordena, no anade/quita expedientes. Estado via calcularEstadoPlazo, X via faltanHoyPorCcpp. Verificado con test sobre los datos de la captura.)
// Build: 2026-05-31 v18.71 (Sobre v18.70: Fase 2 de la unificacion. Las listas de estados del conteo pasan a constantes UNICAS (_ESTADOS_IGNORA/_ESTADOS_HECHO) que usa _resumenManual y que se EXPONEN para que documentacion las inyecte en su JS cliente. Mismos valores de siempre; solo deja de estar la lista repetida. Cero cambio de numeros.)
// Build: 2026-05-31 v18.70 (Sobre v18.69: UNIFICACION DE LOGICA (Fase 1, servidor) — el conteo "Faltan X de Y" estaba duplicado en presupuestos (HOY) y documentacion (ficha). Ahora presupuestos EXPONE _resumenManual y _contarFaltan via app.locals.presupuestos como fuente UNICA; documentacion los consume (ver doc v17.49). Verificado con test: el conteo sale IDENTICO antes/despues (modo05, modo07, completo, sin-docs). Cero cambio de numeros; solo se elimina duplicacion.)
// Build: 2026-05-31 v18.69 (Sobre v18.68: NIVEL 2 (cont.) — se borran los style INLINE de: cabeceras de acordeon (x5, class .ptl-acordeon-cab), separadores de borde superior de las cajas economicas (x4 -> class .ptl-caja-sep) y huecos invisibles de alineado (x5 literales + el helper _huecoExtra -> class .ptl-hueco-extra). El aspecto sale ahora de estilo-visual v1.89. Cero cambio visual ni funcional.)
// Build: 2026-05-31 v18.68 (Sobre v18.67: NIVEL 2 — se borra el style INLINE (display/transition/font-size/color) de los 5 spans .ptl-acordeon-flecha; el aspecto ahora sale de la clase definida en estilo-visual v1.88. El span conserva su clase y su caracter. Cero cambio visual ni funcional.)
// Build: 2026-05-31 v18.67 (Sobre v18.66: limpieza de color de TEXTO en los popups del mapa: color:#666 -> var(--ptl-gray-500) (x2) y color:#999 -> var(--ptl-gray-400) (x1), grises que estaban fuera de la escala de la paleta. Tras esto, en presupuestos.cjs ya no queda ningun color a pelo salvo #fff/#000 (texto blanco/negro universal, sin variable en la paleta, dejados a proposito). Cambio de tono minimo, sin cambios de logica.)
// Build: 2026-05-31 v18.66 (Sobre v18.65: los 4 OVERLAYS (modal Rechazar, otro modal, popup ptlDocBox, buscador del mapa) pasan de white/#fff a var(--ptl-general-flotante) (nueva variable de estilo-visual v1.87, blanca a proposito). Con esto presupuestos.cjs ya NO tiene NINGUN background blanco a pelo: todos los fondos salen de la paleta. Sin cambios de logica.)
// Build: 2026-05-31 v18.65 (Sobre v18.64: zona FICHA a la paleta (cont. "todo a la paleta"). (1) COMUNICACIONES: fila impar #FFFFFF -> var(--ptl-general-3) y contenedor .ptl-com-list #FFFFFF -> var(--ptl-general-3) (queda zebra general-2/general-3). (2) Las 2 cajas de nota/mensaje (display, white-space:pre-line) #fff -> var(--ptl-general-3): detalle de comunicacion y detalle de mail en HOY. PENDIENTE de blancos: modales/popups (Rechazar, ptlDocBox, buscador mapa) e inputs (blancos a proposito). Sin cambios de logica.)
// Build: 2026-05-31 v18.64 (Re-version sobre v18.63, SIN cambio funcional: bump para que el .bat vuelva a detectar cambios tras un error de subida. Contenido identico a v18.63: zona HOY a la paleta —bgPiso y contenedor .hoy-exp-list a general-3—.)
// Build: 2026-05-31 v18.63 (Sobre v18.62: zona HOY a la paleta (decision Guille "todo apunte a la nueva paleta", cero hex a pelo). (1) bgPiso: "#FFFFFF" -> "var(--ptl-general-3)" -> las filas de PISO de HOY dejan de ser blanco fijo y entran en general-3 (antes blancas a proposito desde v17.59). (2) Contenedor .hoy-exp-list: background #fff -> var(--ptl-general-3). El campo de nota de piso (.hoy-piso-notas) ya iba a general-3 por la clase de estilo-visual v1.82. Pendiente migrar a la paleta (zonas siguientes): COMUNICACIONES (#FFFFFF inline), tabla DATOS DOCUMENTACION (documentacion.cjs), cajas de nota display (#fff) y modales. Sin cambios de logica.)
// Build: 2026-05-31 v18.62 (Sobre v18.61: aplicacion de general-3 (gris 200) a fondos marcados por Guille en captura 31-05. (1) Las 4 cajas de DATOS ECONOMICOS (helper _cajaEconomica): background #FFFFFF -> var(--ptl-general-3). (2) MAILS PENDIENTES: fila par #FFFFFF -> var(--ptl-general-3) (bgFilaMail; queda zebra general-2/general-3) y contenedor .hoy-mails-list #fff -> var(--ptl-general-3). Los campos de nota editables de las filas van por clase en estilo-visual v1.82. Sin cambios de logica.)
// Build: 2026-05-31 v18.61 (Sobre v18.60: acompana a estilo-visual v1.81. RENOMBRADO de la paleta de identidad en TODOS sus usos: var(--ptl-fondo-general-1/2/3) -> var(--ptl-general-1/2/3). Solo cambia el NOMBRE; sin cambios de logica ni de valor. Historico // Build: intacto.)
// Build: 2026-05-31 v18.60 (Sobre v18.59: acompana a estilo-visual v1.79. RENOMBRADO de las 2 variables de identidad en TODOS sus usos: var(--ptl-azul-oscuro) -> var(--ptl-fondo-general-1) y var(--ptl-azul-claro) -> var(--ptl-fondo-general-2). Solo cambia el NOMBRE de la variable (el valor de fondo-general-2 pasa de #cccccc a gris 300 via estilo-visual). Sin cambios de logica. Las lineas // Build: del historico se dejan con los nombres viejos a proposito.)
// Build: 2026-05-30 v18.59 (Sobre v18.58: parte de la CENTRALIZACION del boton reloj (ver estilo-visual.cjs v1.77). Los relojes de este archivo pasan a clases .ptl-btn-reloj/.ptl-btn-reloj-off (sin estilo on/off inline). Renders de la ficha (.ptl-exp-reloj) y de Comunicaciones (.ptl-com-hoy): clase segun en_hoy (ON->ptl-btn-reloj, OFF->ptl-btn-reloj-off). Relojes de HOY (hoy-reloj/hoy-piso-reloj/hoy-exp-reloj, siempre activos, recargan al clicar): .ptl-btn-reloj fijo conservando solo su tamaño 18px inline. El toggle JS de la ficha cambia el aspecto con classList.toggle (en vez de la antigua cssText con styleOn/styleOff, eliminadas). Sin cambios de logica. Acompana a estilo-visual.cjs v1.77 y documentacion.cjs v17.43.)
// Build: 2026-05-30 v18.58 (Sobre v18.57: parte del cambio azul->gris y unificacion de la zebra (ver estilo-visual.cjs v1.76). Los 3 usos de var(--ptl-zebra) de este archivo (com-list fila par, fila de mail alterna, cabecera de grupo) pasan a var(--ptl-azul-claro), porque la variable --ptl-zebra se elimina y se unifica al color general. Sin cambios de logica. Acompana a estilo-visual.cjs v1.76 y documentacion.cjs v17.42.)
// Build: 2026-05-30 v18.57 (Sobre v18.56: LIMPIEZA (regla 7) — se elimina la definicion a pelo de .ptl-btn-uniforme que vivia en un bloque <style> de este archivo (estaba DUPLICADA, tambien estaba en documentacion.cjs). Ahora la clase se define UNA sola vez en estilo-visual.cjs v1.74, con el mismo valor exacto -> CERO cambio visual. El HTML sigue usando class="...ptl-btn-uniforme" igual que antes. Acompana a estilo-visual.cjs v1.74 y documentacion.cjs v17.40.)
// Build: 2026-05-30 v18.56 (Sobre v18.55: DOS cosas. (A) La caja DATOS CCPP de la ficha pasa a formato COMPACTO (18px), igual que DATOS ECONOMICOS, de forma centralizada con la clase .ptl-card-compact de estilo-visual.cjs v1.64 (el <style> inline .ptl-card-econ-compact que vivia aqui se elimina; la caja economica y la CCPP usan ahora la clase comun). (B) La caja NOTAS de la ficha (fases 01-04) pasa de <input> de una linea a <textarea> que CRECE con el contenido, IGUAL que las notas de HOY — es la MISMA nota (notas_pto) mostrada en dos sitios, asi que debe comportarse igual (peticion de Guille). El textarea conserva name=notas_pto + data-orig, asi que el guardado por el formulario (ptlValor/ptlDiff, que leen .value y seleccionan por [name]) sigue funcionando sin cambios. Auto-grow por JS (ptlTextareaGrow: ajusta height al scrollHeight al cargar y al escribir). Acompaña a estilo-visual.cjs v1.64 (clase .ptl-textarea-grow + exencion de altura para todos los textarea, incl. textarea.ptl-input-modal) y documentacion.cjs v17.39. Sin cambios de logica de datos.)
// Build: 2026-05-30 v18.55 (Sobre v18.54: FIX definitivo de que el pill "Faltan X de Y" de la pantalla HOY coincida con la ficha — son el mismo expediente y deben contar lo mismo. El v18.54 ya excluía filas 0/0 pero HOY seguía dando "Faltan 4 de 11" mientras la ficha daba "4 de 10" (caso Sextante 4, fase 08). CAUSA: la ficha (documentacion.cjs) filtra los docs de cada fila SEGÚN LA FASE — en modo 08/09/ZZ la fila CCPP/piso solo cuenta contrato+pago; en modo 05/06/07 cuenta el resto MENOS contrato+pago — pero HOY contaba TODOS los docs CCPP sin filtrar, así que los 6 docs previos de Sextante (contrato_firmado/nif/actas/renuncia/factura en OK) hacían que su fila CCPP contara como una fila completa más (de ahí el +1 -> 11). FIX: nuevos helpers (regla 7, lógica única reutilizable) en presupuestos.cjs replicando EXACTO el filtro de la ficha: _FASES_MODO_07, _COD_CONTRATO_PAGO, _idxDocsVisibles(docs,fase), _resumenFase(estados,docs,fase) y _contarFaltan(estadosCcpp,docsCcpp,pisos,docsPiso,fase) -> {totalFilas, pend}. Los DOS bloques de cálculo de faltanHoyPorCcpp de /presupuestos/hoy ahora llaman a _contarFaltan con normalizarFase(c.fase_presupuesto). Verificado con el Sheet: Sextante 4 (fase 08) -> "Faltan 4 de 10" en HOY, idéntico a la ficha. Acompaña a documentacion.cjs v17.38 (sin cambios nuevos respecto a la entrega anterior). Solo lógica de conteo; estilo-visual.cjs en v1.65.)
// Build: 2026-05-30 v18.54 (Sobre v18.53: FIX del pill "Faltan X de Y" de la pantalla HOY para que coincida con la ficha: una fila CCPP/piso SIN documentación pedida (totalRel === 0) NO cuenta en el recuento (ni en total ni en pendientes). Antes el CCPP sumaba siempre (totalFilas empezaba en 1) y una fila 0/0 inflaba el total -> "Faltan 5 de 11" en vez de "Faltan 4 de 10" (caso Sextante 4, CCPP sin contrato ni pago). FIX en los DOS bloques de cálculo de faltanHoyPorCcpp de /presupuestos/hoy (el principal y el auto-05): totalFilas empieza en 0; la fila CCPP solo suma si rCcpp.totalRel > 0; cada piso con r.totalRel === 0 se ignora (continue). La fila individual X/Y de piso ya mostraba "" cuando totalRel===0 (no 0/0), se mantiene. Acompaña a documentacion.cjs v17.38 (misma regla en la ficha: badge de fila verde con 0/0 + pill global que excluye filas sin docs pedidos, servidor y cliente). Concepto (decisión Guille): fila sin documentación pedida = completa por definición (verde) pero fuera del recuento. Solo lógica de conteo; sin cambios de estilo. estilo-visual.cjs se mantiene en v1.65.)
// Build: 2026-05-30 v18.53 (Sobre v18.52 [la de "trabajo por delante", linea ~13 del historico; NOTA: en la cabecera hay una v18.52 ANTERIOR de una rama descartada -tooltip/badges- que se retrocedio; ese codigo NO esta activo, solo queda su Build como registro]: AÑADIDAS las lineas "Por delante" y "Sin trabajo" tambien a la caja TOTAL ACEPTADO, con el mismo criterio que Tramitado: descontar el trabajo de las obras ya TERMINADAS (consumido). Razonamiento: Aceptado (fases 05-09) por delante = TODO su tiempo MENOS lo consumido (Pte cobro + Cobrado, que solo existen en fase 09) = "pendiente de tramitar + tramitado en ejecucion". Responde a "si me pongo hoy con todo lo aceptado que aun no he hecho, hasta cuando tengo trabajo". CAMBIOS: (1) el calculo de fecha laborable se extrae a helper _fechaSinTrabajoDesde(dias) reutilizable (saltando sabados/domingos, festivos fuera). (2) se calcula _tiempoConsumido = tiempo de PteCobro+Cobrado, y de ahi _diasPorDelanteAcept = G.aceptado.tiempo - _tiempoConsumido. (3) la caja Aceptado pasa de _extraTotal20 (solo huecos) a extra propio: Total(20%) + 3 huecos + Por delante + Sin trabajo, alineada con Tramitado. (4) Pendiente de tramitar NO lleva estas lineas (su dato aislado no es escenario real; ya esta contenido en Aceptado-Tramitado); sigue con _extraTotal20. Verificado con el Sheet: Aceptado = 146 dias laborables no consumidos -> 21-12-2026 (= 119 pendiente + 27 en ejecucion). Tramitado se mantiene 27 dias -> 07-07-2026. Solo presupuestos.cjs; estilo-visual.cjs en v1.65.)
// Build: 2026-05-30 v18.52 (Sobre v18.51: TOOLTIP con el nombre completo del expediente al pasar por encima en el LISTADO. .ptl-fila-info recibe title con tipo_via + direccion (o comunidad) completos, de modo que cuando la direccion se ve cortada por el ancho fijo de la columna (ellipsis), el navegador muestra el nombre entero al posar el raton. Acompana a estilo-visual.cjs v1.48 (badges mas estrechos).)
// Build: 2026-05-29 v18.51 (Sobre v18.50: en el LISTADO el badge de Cobrado pierde la FECHA visible (peticion de Guille, para ahorrar ancho): "Cobrado DD-MM-AA" -> "Cobrado". La fecha sigue accesible en el tooltip (title="Cobrado el DD-MM-AA"). En la FICHA (cinta fase 09) se mantiene la fecha completa. Sin cambios de layout. Acompana a estilo-visual.cjs v1.40.)
// Build: 2026-05-29 v18.50 (Sobre v18.49: la FICHA de la fase 09 muestra el estado como BADGE (pildora), igual que el resto de fases, en vez de texto plano en el subtexto. Mismas clases que el listado: Cobrado -> ptl-fila-badge-en-plazo (verde); Pendiente de cobro -> ptl-fila-badge-decidir (ambar); En ejecucion -> ptl-fila-badge-ejecucion (azul claro). El badge se coloca en el mismo patron <div margin-top:4px><span ptl-fila-badge...> que usan las demas fases. Acompana a estilo-visual.cjs v1.38 (FIX badge de la cinta cortado por abajo + alineacion de badges del listado).)
// Build: 2026-05-29 v18.49 (Sobre v18.48: el LISTADO de expedientes muestra ahora el badge de estado para TODA la fase 09 con los TRES estados (antes solo salia "Cobrada" cuando habia fecha de cobro): Cobrado DD-MM-AA (clase ptl-fila-badge-en-plazo, verde) si hay fecha_cobro; Pte. cobro (ptl-fila-badge-decidir, ambar) si hay fecha_pte_cobro y no cobro; En ejecucion (ptl-fila-badge-ejecucion, AZUL CLARO nuevo) si no hay ninguna. Texto "Cobrada" -> "Cobrado" (peticion de Guille). Reutiliza las clases de estilo-visual.cjs v1.37 (que da forma de pildora a todos los badges y anade la variante -ejecucion en azul reusando las 2 variables canonicas). PENDIENTE (sigue): la caja TOTAL TRAMITADO del HOY aun reparte por cobrado/no-cobrado, no distingue En ejecucion vs Pendiente de cobro. Acompana a estilo-visual.cjs v1.37.)
// Build: 2026-05-29 v18.48 (Sobre v18.47: FASE 09 con TRES estados (En ejecucion / Pendiente de cobro / Cobrado) y SEGUNDA fecha. (1) NUEVA columna BH fecha_pte_cobro en Sheet comunidades (Guille YA la creo a mano). (2) COLS anade fecha_pte_cobro al final (rowToObj/objToRow la mapean por posicion -> BH). (3) RANGO_COMUNIDADES A:BG -> A:BH; rango de escritura tramoH AH:BG -> AH:BH (el slice(33) ya la incluye). (4) Saneador: fecha_pte_cobro en COL_LETTER (BH) y COL_FECHA. (5) actualizarCampoComunidad la acepta automaticamente (valida con COLS.includes; _colNumALetra->BH). (6) Bloque accionHtml de la fase 09 reescrito: estado calculado por las dos fechas -> sin ambas = 🔨 En ejecucion; con fecha_pte_cobro y sin cobro = ⏳ Pendiente de cobro desde DD-MM-AA; con fecha_cobro = 💶 Cobrado el DD-MM-AA. Dos cajitas de fecha en la cinta: PTE COBRO (fecha_pte_cobro) y COBRADO (antes Fecha cobro, fecha_cobro, solo cambia la etiqueta). Ambas guardan por el endpoint /campo via helper comun _ptlGuardarFecha09 y recargan limpio. PENDIENTE (no incluido aqui, sigue mirando solo fecha_cobro): la caja TOTAL TRAMITADO del HOY y el badge del listado no distinguen aun En ejecucion vs Pendiente de cobro (no rompen, solo no reflejan el estado intermedio). Acompana a estilo-visual.cjs v1.36 (altura de la cinta de fase unificada).)
// Build: 2026-05-29 v18.47 (Sobre v18.46: FIX del AVISO FANTASMA "Hay cambios sin guardar" al entrar y salir de una ficha SIN tocar nada (caso real C Agata 7, fase 09). CAUSA (cazada en consola con ptlDiff()): el campo tiempo_real valia 28.25 en el Sheet, pero el campo .campo-dias lo MUESTRA redondeado a 1 decimal -> "28,3". ptlValor devolvia ese 28.3 normalizado, mientras que ptlOrig (la foto del servidor) guardaba el 28.25 crudo; en ptlDiff la comparacion numerica 28.3 != 28.25 marcaba un cambio que no existia. Peligroso ademas: al "Guardar y salir" se habria escrito 28,3 pisando el 28.25 real (mismo patron de perdida de datos que v17.80/v18.36). FIX en ptlDiff: para campos numericos (campo-euros/campo-dias) el ORIGINAL se normaliza por el MISMO formateador del campo antes de comparar (origNorm = ptlValorPlano(ptlFmtDias|ptlFmtEuros(orig))), de modo que ambos lados quedan a la misma precision que se muestra (dias 1 decimal, euros 2) y un dato del Sheet con mas decimales no genera diff fantasma. Verificado en simulacion node con las funciones reales: caso 28.25 -> NO cambio; cambio real (30) -> SI; euros sin tocar -> NO; euros con 3 decimales en Sheet -> NO; vacio -> NO. No se toca el guardado real ni el resto de ptlDiff (guardas de input inexistente v17.80 y earth v18.02 intactas). Sin cambios en estilo-visual.cjs ni documentacion.cjs.)
// Build: 2026-05-29 v18.46 (Sobre v18.45: UNIFICACION del subtexto de la cinta de fase (segunda linea del bloque .ptl-next-action: indicador de reenvios en 01/04/05/08 y estado de cobro en 09). Los 5 bloques escribian el MISMO estilo inline a mano (font-size:10.5px;color:azul-claro;margin-top:1px;font-weight:600), salvo la fase 09 que ponia el color OSCURO condicional (success-dark si cobrado / warning-dark si pendiente), ILEGIBLE sobre la cinta azul oscuro -> ese era el sintoma reportado por Guille (Pendiente de cobro / COBRADO el no se leian). FIX/UNIFICACION: ese estilo se centraliza en la regla .ptl-next-action .sub de estilo-visual.cjs v1.35, y aqui se eliminan los 5 inline (mas 4 const colorTxt que ya no hacen falta), dejando solo class=sub. Ahora los 5 subtextos son identicos y se controlan desde un unico sitio. La fase 09 pierde el matiz verde/ambar de color, pero cobrado/pendiente se sigue distinguiendo por el texto y el icono (emoji COBRADO vs Pendiente), misma filosofia que v18.24. Los TITULOS de la cinta (.ptl-next-action .text) ya estaban unificados por CSS (azul claro 12px) y no se tocan. Los banners grises de RECHAZADO/DESCARTADO se dejan como estan a proposito. Sin cambios de logica. Acompana a estilo-visual.cjs v1.35.)
// Build: 2026-05-29 v18.45 (Sobre v18.44: FIX REAL del badge de plazo en la ficha de FASE 04. En v18.42 se anadio renderBadgePlazo(calcularEstadoPlazo(...)) al bloque accionHtml GENERICO de fases con reenvio (~4294, que en realidad solo lo usa la fase 01) y al bloque de documentacion (05+, ~4181), pero la fase 04_ACEPTACION_PTO tiene su PROPIO bloque accionHtml dedicado (~3968, el de los botones Reenviar presupuesto revisado / ACEPTADO / RECHAZADO), y a ese bloque se le olvido la linea del badge. Resultado: el badge salia en el listado y en HOY (otra ruta), y en la ficha de fases 01 y 05+, pero NUNCA en la ficha de un expediente en fase 04. FIX: anadida la misma linea del badge en el <div class=text> del bloque de fase 04, justo despues de infoEnvioAuto04Html, usando las variables plantillaFichaActual y f1MapFicha ya calculadas arriba (mismas que usan los otros dos bloques). Sin cambios de logica en calcularEstadoPlazo. NOTA HISTORICA: las v18.43 y v18.44 fueron bumps NO-OP para diagnosticar un supuesto problema de deploy en Render que resulto NO existir (Render desplegaba bien); el sintoma real era este olvido del badge en el bloque de fase 04. Sin cambios en estilo-visual.cjs ni documentacion.cjs.)
// Build: 2026-05-29 v18.44 (Sobre v18.43: NO-OP otra vez. Segundo bump de version SIN cambios de codigo/logica/estilo. Objetivo: forzar un deploy NUEVO en Render porque el anterior (commit 82e51d8, build "successful") no llego a pasar a Live / se quedo atascado en Deploying y el servidor seguia sirviendo codigo viejo (sin badge de plazo en la ficha de fase 04). Un commit nuevo cancela el deploy colgado y arranca uno limpio. Mantiene integra la v18.42 y v18.43.)
// Build: 2026-05-30 v18.52 (Sobre v18.51: NUEVO en la caja "Total tramitado": trabajo de cuadrilla por delante + dia en que se queda sin trabajo (peticion de Guille). Concepto: al pasar a fase 09 se CONSOLIDAN los dias de trabajo; las obras terminadas (Pte cobro + Cobrado) son dias CONSUMIDOS; lo que queda por delante = tiempo de las obras EN EJECUCION (tramitadas sin terminar). CAMBIOS: (1) los sub-grupos tramitadoEjecucion/PteCobro/Cobrado acumulan ahora tambien `tiempo` (en dias laborables de cuadrilla-5, ya con la conversion existente campo[cuadrilla-2] x2 /5). (2) Se calcula _diasPorDelante = tiempo de En ejecucion y _fechaSinTrabajo = HOY + esos dias LABORABLES saltando sabados y domingos (festivos NO se contemplan, decision Guille: insignificantes); el calculo es dinamico (se recalcula cada dia). (3) La caja muestra 2 lineas nuevas bajo el desglose del 20%: "Por delante: N dias (X,X meses)" y "Sin trabajo: DD-MM-AAAA". (4) Alineacion: las cajas Aceptado/Pendiente pasan a 5 huecos y Presupuestado a 5, para igualar las 6 lineas de extra de la caja tramitado (Total + En ejecucion/Pte cobro/Cobrado/Por delante/Sin trabajo). NOTA: el "X,X meses" sigue siendo dias/22 (magnitud aproximada); la FECHA es la que va por calendario real. No se toca el calculo de meses de las cajas (es solo magnitud). Verificado con el Sheet: 27 dias laborables por delante -> 07-07-2026. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.65. No toca datos del Sheet.)
// Build: 2026-05-30 v18.51 (Sobre v18.50: LOGICA de la caja "Total tramitado" (DATOS ECONOMICOS) alineada con los 3 estados de la fase 09. Antes la subdistribucion era binaria: Cobrado (con fecha_cobro) vs "Por cobrar" (todo lo demas), y "Por cobrar" MEZCLABA obras En ejecucion (sin fecha_pte_cobro) con obras Pendientes de cobro (con fecha_pte_cobro), dando una cifra de pendiente inflada. AHORA la caja muestra 4 lineas con el 20%% del beneficio: Total (20%) [los 18] + En ejecucion + Pte cobro + Cobrado, cumpliendo En ejecucion + Pte cobro + Cobrado = Total. CAMBIOS: (1) acumuladores G.tramitadoPorCobrar -> G.tramitadoEjecucion + G.tramitadoPteCobro (se mantiene G.tramitadoCobrado). (2) bucle: reparto en 3 ramas con la MISMA logica que la ficha (fecha_cobro->Cobrado; si no fecha_pte_cobro->Pte cobro; si no->En ejecucion). (3) extraTramitado: 4 lineas en orden de flujo (Total, En ejecucion, Pte cobro, Cobrado). (4) _extraTotal20 (cajas Aceptado/Pendiente): pasa de 2 a 3 huecos invisibles para igualar la altura nueva de la caja tramitado. Verificado contra el Sheet real: de 18 tramitadas, 4 en ejecucion (5.523,24), 11 pte cobro (6.342,11), 3 cobrado (1.760,49), suma 13.625,84 = Total. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.65. Toca presentacion de importes, no datos del Sheet.)
// Build: 2026-05-30 v18.50 (Sobre v18.49: LIMPIEZA de restos de los cambios de hoy. (1) La variable de la caja de datos economicos se RENOMBRA de `cajaAdjRotos` (nombre heredado y enganoso) a `cajaEconomicos` (2 sitios: declaracion + uso en layout). (2) Se actualizan comentarios obsoletos que aun mencionaban las cajas de fase 05/08/01/04 eliminadas en v18.48 o la funcion _calcFaltan ya borrada: el bloque de cabecera de cajaVisita (decia "Cajitas 05-DOCUMENTACION y 08-CYCP"), y 3 comentarios del auto-relleno de HOY (lineas ~8996, ~9283, ~9322). Sin cambios de codigo ejecutable salvo el renombrado de variable. node --check OK. NOTA: queda pendiente (trabajo grande, a futuro) migrar los muchos estilos inline de la pantalla HOY a clases en estilo-visual.cjs segun la regla 7; no se aborda ahora por volumen y riesgo. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.65.)
// Build: 2026-05-30 v18.49 (Sobre v18.48: REORDEN del layout de HOY: la caja "Datos economicos" sube a continuacion de "Mails pendientes", por encima de 02-VISITA (peticion de Guille). Nuevo orden: Expedientes HOY -> Mails pendientes -> Datos economicos -> 02-VISITA. Es solo intercambiar el orden de dos divs en el grid de la pantalla HOY. NOTA: la variable que contiene la caja de datos economicos se llama internamente `cajaAdjRotos` (nombre heredado y enganoso de una caja antigua de adjuntos rotos; su contenido real es "Datos economicos"); pendiente de renombrar si se quiere. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.65. Solo cambio de orden visual.)
// Build: 2026-05-30 v18.48 (Sobre v18.47: ELIMINADAS de la pantalla HOY las 4 cajas de fase 01-CONTACTO, 04-ACEPTACION PTO, 05-DOCUMENTACION y 08-CYCP (decision Guille: la info accionable ya la da "Expedientes HOY" arriba; esas cajas eran consulta y solapaban). La unica caja de fase que se conserva, 02-VISITA, SUBE a continuacion de "Mails pendientes" y pasa a ancho completo. El layout de HOY deja de ser 2 columnas y pasa a una sola columna apilada: Expedientes HOY -> Mails pendientes -> 02-VISITA -> Adjuntos rotos. LIMPIEZA asociada (todo lo que solo alimentaba las cajas eliminadas): se quitan las funciones _calcFaltan, _renderFilaExp, _prepararListaFase, _filtrarConBadge, _renderFilaFaseSimple y el helper _epFor; las listas lista01/04/05/08 y filas01/04/05/08; las lecturas de plantilla plt01/04/05/08 y la de _leerDocsManuales que solo usaban esas cajas; los filtros en01/04/05/08 (se conserva en02); el <script> igualador de alturas de las 2 columnas (ya no hay 2 columnas); y las reglas CSS .hoy-card-fase / .hoy-col-item (huerfanas). NOTA: _renderFilaExp02 y _fmtTel SE CONSERVAN (los usa la caja 02-VISITA). Verificado node --check OK y sin referencias rotas. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.65. Sin cambios de logica de datos ni del Sheet.)
// Build: 2026-05-30 v18.47 (Sobre v18.46: ANCHO FIJO de 85px para los pills "Faltan X de Y" / "Completo" / "sin pisos", para que queden alineados en columna. Se aade la clase .ptl-fila-badge-fijo (definida en estilo-visual.cjs v1.65) a los 4 puntos donde se pintan: caja "Expedientes HOY" (pillFaltanHoy) y los 3 casos de _renderFilaExp (sin pisos / Completo / Faltan) de las cajas de fase 05/08. NO se toca el badge de plazo/cobro/categoria (mantienen ancho natural). El ancho vive en UN solo sitio (la clase en estilo-visual): un cambio futuro = un numero, una vez. Antes HOY usaba 96px inline (Guille: muy anchos); ahora 85px centralizado. Solo cambio visual.)
// Build: 2026-05-30 v18.46 (Sobre v18.44: UNIFICACION TOTAL del espaciado de los pills "Faltan X de Y" / "Completo" / "sin pisos" (peticion de Guille: "los quiero en TODO el programa ajustados, unifica siempre, que los cambios futuros se hagan en un solo lugar"). En v18.44 las cajas de fase 05/08 ya quedaron ceidas (solo clase .ptl-fila-badge), pero la caja "Expedientes HOY" mantenia un style inline (flex:0 0 96px;text-align:center) que inflaba el pill y lo dejaba ancho con el texto flotando -> "sin ajustar" frente a los de abajo. (La v18.45 intento un contenedor wrapper de 96px para conservar la columna; se DESCARTA porque seguia siendo un caso especial con inline y rompia el "un solo lugar".) AHORA el pill de HOY usa EXACTAMENTE el mismo marcado que el de las cajas de fase: `<span class="ptl-fila-badge ${_cls}">texto</span>`, SIN ningun estilo inline. Resultado: TODOS los pills Faltan del programa son identicos (mismo span, misma clase) y su aspecto (forma, padding 2px 3px, color, borde) sale integro de .ptl-fila-badge en estilo-visual.cjs -> un cambio futuro se hace en UN SOLO sitio. CONTRAPARTIDA asumida: en "Expedientes HOY" los pills dejan de tener ancho fijo de 96px, asi que ya NO quedan alineados en columna vertical (cada uno toma su ancho natural, ceido al texto), igual que ya ocurria en las cajas de fase. Solo presupuestos.cjs; estilo-visual.cjs se mantiene en v1.64. Solo cambio visual.)
// Build: 2026-05-30 v18.44 (Sobre v18.43: UNIFICACION VISUAL de badges (peticion de Guille: "unifica, unifica, unifica"). Los pills "Faltan X de Y" / "✓ Completo" / "sin pisos" eran los UNICOS badges del programa que NO seguian la forma de PILDORA canonica: iban con estilo INLINE (border-radius:8px, padding:1px 6px, font-weight:600, sin borde) en TRES sitios. Ahora todos usan la clase .ptl-fila-badge (radius:999px, padding:2px 3px, weight:700, letter-spacing:.2px, borde 1px) + variante de color, igual que los badges de plazo/cobro. CAMBIOS: (1) _renderFilaExp (cajas de fase 05/08 de HOY): los 3 spans inline pasan a class="ptl-fila-badge ptl-fila-badge-{neutro|success|danger}". (2) caja "Expedientes HOY": el span con ternario de color inline pasa a class="ptl-fila-badge ptl-fila-badge-{success|neutro|danger}", conservando solo el flex:0 0 96px;text-align:center (layout de columna de esa caja, no estilo de badge). (3) badge de CATEGORIA de mail en la caja Comunicaciones de la ficha (Manual/Automatico): categoriaDe deja de devolver color/bg y devuelve una clase (.ptl-fila-badge-neutro para Manual/otros, .ptl-fila-badge-success para Automatico); el span inline pasa a class. El texto "Automatico" gana contraste (pasa de color success medio a success-dark, patron canonico fondo-light+texto-dark). Se ELIMINA todo el estilo inline obsoleto y duplicado de esos badges. Acompana a estilo-visual.cjs v1.64, que unifica las variantes de color del badge (agrupa nombre de estado -decidir/-en-plazo/-retrasado/-ejecucion con nombre de color -warning/-success/-danger/-azul en una sola regla por color, sin duplicar valores) y anade la variante .ptl-fila-badge-neutro (gris). Resultado: TODOS los badges del programa (plazo, fase, cobro 09, Faltan/Completo/sin pisos y categoria de mail) comparten forma, padding, espaciado y patron de color. Solo cambios visuales; ninguna logica ni dato del Sheet tocado.)
// Build: 2026-05-29 v18.43 (Sobre v18.42: NO-OP. Bump de version SIN cambios de codigo ni de logica ni de estilo. Unico objetivo: generar un commit nuevo (hash distinto) para forzar/comprobar el auto-deploy de Render, que se quedo sirviendo v18.39 y no subio v18.40/41/42. Si tras subir esta v18.43 el HTML en vivo sigue sin reflejar el badge de plazo en la ficha de fase 04, queda confirmado que el auto-deploy esta apagado/roto y Alberto debe lanzar Manual Deploy desde el dashboard. Mantiene integra la v18.42.)
// Build: 2026-05-29 v18.42 (Sobre v18.41: AFINADO de los BADGES de plazo (👍 En plazo / ⚠️ Decidir / 👎 Retrasado) en las 4 fases con cron (01, 04, 05, 08). Tras revisar con Guille la lógica contra su Excel de especificación, se detectaron y corrigieron 3 cosas en calcularEstadoPlazo + 1 visual. (1) FÓRMULA F-final: la "fecha teórica del último mail del cron" se calculaba como di + dr×mx, que da UN CICLO DE MÁS (con mx envíos, el último cae en di + dr×(mx-1): los envíos son +di, +di+dr, +di+2dr...). Ej fase 04 (di=3,dr=30,mx=4): envíos +3,+33,+63,+93 -> último=+93=di+dr×3, no +123. Corregido a di + dr×(mx-1) en los 2 puntos (cálculo del badge y _calcPlazoDesdePlantilla). Verificado que con las plantillas actuales la fórmula nueva coincide con el último envío real en las 4 fases (01:+60, 04:+93, 05:+20, 08:+10) y que 05/08 siguen cuadrando con el texto "(20/10 DÍAS NATURALES)" de sus mails. (2) ANCLA: F-final se anclaba a mails_ultimo_envio[fase], que SE MUEVE con cada reenvío del cron y cada ciclo nuevo -> el retraso se medía mal. Regla de Guille: el retraso se mide SIEMPRE desde la fecha teórica del último mail del PRIMER ciclo, fija, aunque después se metan fechas manuales o reenvíos. Ahora se ancla a la fecha de ENTRADA a la fase (= primer envío, fija): 04 fecha_envio_pto, 05 fecha_aceptacion_pto, 08 fecha_envio_contratos_pagos, 01 fecha_solicitud_pto con fallback. Sin ancla -> sin badge (coherente con "sin primer envío, sin badge"). (3) EN VIVO: se DEJA de leer la columna BC congelada (fecha_limite_documentacion_vecinos) para el badge; se calcula siempre desde la plantilla actual. Decisión de Guille: criterio único para todos los expedientes; si se cambia la plantilla (di/dr/mx), el badge de TODOS se reajusta solo (caso real: Guille subió max_envios de 3 a 4 en varias fases). NOTA: BC sigue usándose SOLO para la variable {{fecha_limite_doc_vecinos}} dentro de los mails de fase 05/08 (no la toca este cambio). (4) VISUAL: el badge ahora también se PINTA en la ficha del expediente en fases 01 y 04 (bloque accionHtml de fases con reenvío), donde faltaba; antes solo salía en el listado y en HOY. Mismo criterio en las 3 pantallas. Comportamiento de estados (sin cambios de concepto, solo de fórmula/ancla): sin envíos->sin badge; hoy<F-final->EN PLAZO; ciclo agotado sin fecha manual->DECIDIR; F-final pasada y cron reactivado (fecha manual/reenvío)->RETRASADO con días desde F-final (poner fecha manual NO saca del retraso). VALIDADO en sandbox: ciclo de vida completo + casos límite + distribución sobre los 46 expedientes reales de fase 04 (31 retrasado, 11 en plazo, 4 sin badge=los descuadrados pendientes de arreglo manual). Sin cambios en estilo-visual.cjs ni documentacion.cjs. Mantiene íntegra la v18.41.)
// Build: 2026-05-28 v18.41 (Sobre v18.40: FIX de la SECUENCIA DE SEGUIMIENTO de la fase 04. El mail del presupuesto (plantilla 03_ENVIO_PTO, enviado al pulsar "Enviar presupuesto y paso a 04") es conceptualmente el PRIMER MANUAL de la cadena de seguimiento de la fase 04, pero el código solo lo anotaba bajo la clave 03_ENVIO_PTO y dejaba la clave 04_ACEPTACION_PTO vacía. Consecuencias verificadas (caso real C Verano 2, Av Doctor Fedriani 54, Doctor Barraquer 1, los 3 pasados el 28/05): (a) el indicador nacía "0+0/3 - reenvío no iniciado" en vez de "1+0/3 - próximo a +3 días"; (b) cuando el cron disparaba el primer seguimiento, al no haber clave 04 lo contaba como AUTOMÁTICO -> el indicador iba a 0+1/3, 0+2/3, 0+3/3, perdiendo para siempre el "1" del presupuesto; (c) el cron arrancaba igualmente PERO de chiripa, apoyado en el fallback de fecha comu.fecha_ultimo_seguimiento_pto, no en la clave; (d) por ese mismo fallback, un expediente que entraba en 04 SIN enviar mail ("Saltar envío" o avance genérico) arrancaba el cron SOLO y mandaba seguimientos no deseados, en contra de la regla de negocio (sin primer mail NO hay seguimientos). CUATRO cambios quirúrgicos: (1) en /enviar-mail, rama del paso 03->04 por envío real: se SIEMBRA la clave 04 como manual nº1 (enviados/manuales[04]=1, ultimo[04]=fecha real del envío = ultimo[03]), idéntico patrón al que ya usan 04->05 y 07->08. Se mantiene también el registro bajo la clave 03 (rastro histórico, no rompe retroceso ni la columna BC). Resultado: nace 1+0/3 EN PLAZO. (2) en el cron de la fase 04 (rama cadencia normal, primer reenvío): se ELIMINA el fallback "ultimo[fase] || comu.fecha_ultimo_seguimiento_pto" -> ahora el cron de la 04 SOLO arranca si hay envío real registrado en la clave 04 (presupuesto, reenvío revisado o fecha manual). Sin clave 04 poblada queda en espera. Esto cierra de un solo punto las dos vías por las que "saltar"/"avanzar" disparaban el cron solos (el modo "fecha manual" del cron sigue intacto: marcar fecha SÍ arranca). (3) en calcularInfoEnvioAuto se elimina el fallback gemelo a fecha_ultimo_seguimiento_pto (era además código muerto tras la siembra) para coherencia indicador<->cron. (4) en /retroceder, al volver de 04 a 03 se borra también la clave huérfana 03_ENVIO_PTO en las tres columnas (antes solo se borraba la 04): así un reenvío posterior del presupuesto arranca limpio en 1 y no en 2. VALIDADO en sandbox contra los 45 expedientes reales de fase 04: indicador OLD vs NEW idéntico en los 45 (cero regresiones; ningún activo dependía del fallback), y las tres ramas (enviar / saltar / saltar+fecha-manual) producen la secuencia del Excel de especificación de Guille. Las otras fases con cron (01 ya exigía clave poblada sin fallback; 05 y 08 dependen de su propia clave y no del campo de seguimiento de la 04) NO se ven afectadas. PENDIENTE: corregir A MANO en el Sheet los 6 expedientes ya descuadrados por el bug histórico (su transición 03->04 ya ocurrió; el código solo arregla los futuros). Sin cambios en estilo-visual.cjs ni documentacion.cjs.)
// Build: 2026-05-27 v18.40 (Sobre v18.39: FIX CRÍTICO — TODO el JS de la ficha del expediente estaba ROTO desde la subida de v18.38. Síntomas: el reloj ⏰ "Añadir a HOY" de la caja NOTAS no hacía nada en fases 01-04 (sí funcionaba en 05+ porque ese reloj vive en documentacion.cjs); el feedback verde/rojo al guardar notas, email u otros campos no aparecía; el botón "Enviar mail manual" reventaba con "ptlRecargaLimpia is not a function" porque al fallar el script no se enganchaban handlers ni helpers. CAUSA: en v18.38 (subida esta mañana) se añadió un COMENTARIO con un "\\n" literal en mitad del texto ("notas_pto pierde sus \\n"), línea ~5624. Pero ese comentario vive DENTRO de una template string (la return de vistaExpediente), donde "\\n" se interpreta como SALTO DE LÍNEA REAL al renderizar el HTML. Resultado en el navegador: el "// comentario" quedaba partido en dos por el salto real; la SEGUNDA mitad ("o descoloca valores económicos. Al...") quedaba como código JS suelto -> Uncaught SyntaxError: expected expression, got ')'. Una excepción de sintaxis en mitad de un <script> ABORTA TODO el script desde ese punto, así que ninguno de los handlers (blur de inputs, click del reloj, ptlFlashGuardado, listeners de submit) llegaba a engancharse. Por eso TAMBIÉN dejaron de salir los colores verde/rojo de guardado: ptlOnCambio / ptlGuardarCampo nunca se enganchaban a los inputs. El bug aplica a TODAS las fases de la ficha (en 05+ algunas cosas seguían funcionando porque las maneja documentacion.cjs, que es otro <script> independiente). FIX: el "\\n" del comentario se sustituye por la palabra "saltos" (texto plano, sin caracteres especiales). El listener pageshow de v18.38 se mantiene intacto, era solo el comentario lo que rompía. Verificado en consola: ya no salta SyntaxError. Acompaña a estilo-visual.cjs v1.32.)
// Build: 2026-05-27 v18.39 (Sobre v18.38: FIX CRÍTICO del helper window.ptlRecargaLimpia. La v18.36 introdujo este helper para sustituir location.reload() en 6 puntos de la ficha y evitar la pérdida de datos económicos por form-restoration. La intención era definirlo "en el PRIMER script de la página" para que estuviera disponible en TODOS los handlers, pero por error la definición quedó DENTRO del bloque "else if (fase === '09_TRAMITADA')" de accionHtml. Resultado: el script con la definición SOLO se renderizaba para fichas en fase 09; en cualquier otra fase la función no existía y los handlers que la llaman reventaban con "ptlRecargaLimpia is not a function" (caso real 27/05: Arcangel San Miguel 6 en fase 02, al pulsar "Enviar mail manual" tras escribir todo el cuerpo, error en navegador y mail enviado a medias). Aplica a TODOS los reenvíos manuales y a borrar mail / rechazar / fecha cobro / toggle HOY / avanzar fase, que llevaban rotos en cualquier ficha que NO esté en 09. FIX: la definición se mueve al script global de helpers (junto a ptlMakeDraggable / ptlCentrarVentana, líneas ~4680), que se renderiza siempre dentro de vistaExpediente al margen de la fase. Se elimina la definición duplicada del bloque condicional. Las 6 llamadas existentes a window.ptlRecargaLimpia() se mantienen intactas. Acompaña a estilo-visual.cjs v1.32 (override de color para etiquetas dentro de ventanas flotantes: azul claro -> azul oscuro, para que se vean sobre el fondo blanco de los modales).)
// Build: 2026-05-27 v18.38 (Sobre v18.37: FIX adicional del form-restoration por VUELTA ATRÁS (bfcache). v18.36 cubría reloads disparados por JS (location.reload de borrar mail, enviar mail manual, etc.), pero NO el caso de que el usuario navegue fuera (al mapa, a otra pantalla) y vuelva con el botón "atrás": el navegador restaura la página entera desde su back-forward cache, trayendo los inputs con sus valores cacheados y NO con los value="" frescos del servidor. Esa restauración aplana saltos de línea (notas_pto pierde sus \n) y puede descolocar valores; ptlDiff lo ve como cambio y al salir lo escribe -> DAÑO (caso real Arcangel San Miguel 6 27/05: notas_pto se aplanó a una sola línea tras "abandonar página" al volver del mapa). FIX: listener pageshow que detecta event.persisted=true (página viene de bfcache) y dispara location.replace(location.href) para cargar HTML fresco. Cubre vuelta atrás desde cualquier pantalla, swipe back móvil, etc. Solo presupuestos.cjs (documentacion.cjs guarda campo a campo por blur, sin foto global, no necesita el mismo blindaje). Sin cambios en lógica de datos ni en el Sheet.)
// Build: 2026-05-27 v18.37 (Sobre v18.36: VISUAL — altura de fila en DATOS ECONÓMICOS igualada a las filas de COMUNICACIONES. Los inputs de .ptl-card-econ-compact bajan de height 22px a 18px (line-height 1.05->1.1), que es la altura efectiva de una fila de comunicaciones (.ptl-com-row, marcada por sus botones de 18px y padding vertical 0). Solo afecta a la caja económica (clase propia .ptl-card-econ-compact); la caja DATOS CCPP y el resto de .ptl-form-grid NO se tocan. Acompaña a documentacion.cjs v17.35 (misma igualación en la tabla de pisos). Sin cambios de lógica ni de datos.)
// Build: 2026-05-27 v18.36 (Sobre v18.35: FIX CRÍTICO de PÉRDIDA DE DATOS ECONÓMICOS. Caso real Doctores González Meneses 10: tras ENVIAR UN MAIL MANUAL, se borraron pto_total, material_previsto y beneficio_previsto, y saltó el aviso "tiempo_previsto fuera de rango: 2759.6". CAUSA RAÍZ (reproducida en sandbox jsdom, coincidencia EXACTA con el Sheet): el handler de envío de mail manual hacía location.reload() (igual que otros 5 puntos de la ficha). Una recarga por JS dispara el "form restoration" del navegador, que RESTAURA los valores cacheados de los inputs en vez de usar los value="" frescos del servidor; esa restauración dejó pto_total y material_previsto VACÍOS y descolocó el valor de mano_obra (2759.63) al input de tiempo_previsto. ptlDiff vio esos como cambios y al salir ptlGuardar los escribió: los vacíos se guardaron (borrando datos), y el 2759.6 en tiempo lo rechazó el rango (de ahí el aviso). FIX: nuevo helper window.ptlRecargaLimpia() (location.replace(location.href) + ptlReloading) definido en el primer <script> de la ficha; sustituye a location.reload() en los 6 puntos que recargan la FICHA del expediente (fecha_cobro, rechazar, borrar mail [ya era replace en v18.34, unificado], toggle-HOY de mail, ENVIAR MAIL MANUAL [causa de hoy], avanzar fase sin mail). location.replace fuerza carga fresca sin restauración -> ptlDiff no detecta cambios fantasma -> datos intactos (verificado en sandbox: 4/4 escenarios de restauración dañan datos con reload; 0 con replace). Los location.reload() de la pantalla HOY (/presupuestos/hoy) NO se tocan: esa pantalla no tiene formulario económico. (documentacion.cjs sube en paralelo a v17.34: sus 3 reloads de la pestaña de pisos -> location.replace por la misma razón, para no arriesgar borrado de notas de pisos.) NOTA: hay que RECUPERAR a mano los datos borrados de Doctores González Meneses 10 (pto_total, material_previsto). Sin cambios en el Sheet por el código.)
// Build: 2026-05-27 v18.35 (Sobre v18.34: FIX RAÍZ de los mails DUPLICADOS en el histórico. CAUSA: al clasificar un mail de la bandeja y asignarlo a un expediente, /mail-clasificar SIEMPRE insertaba una fila nueva en mail_historico sin comprobar si ese mail ya estaba clasificado; y como el mail NO se borra de la bandeja al clasificar (sigue en HOY hasta pulsar el reloj), el mismo correo se podía clasificar varias veces -> una fila por clasificación (caso real: el mail de Guanes de Teniente Rodríguez Carmona 5 acabó 3 veces: 2 en Teniente + 1 mal puesto en Alberto Durero 2). FIX: nuevo helper _reclasificarOInsertarHistorico(datos) que usa el Message-ID (único por correo): si ese message_id YA existe en el histórico, MUEVE la fila existente al nuevo expediente (actualiza ccpp_id, dirección, fase, adjuntos y todo el resto vía values.update) en lugar de añadir otra, y si por arrastres anteriores hubiera VARIAS filas con ese message_id deja UNA sola y borra las demás (limpieza de duplicados de paso, de abajo hacia arriba para no desplazar índices). Si el message_id está vacío o no existe, hace el append normal de siempre. /mail-clasificar pasa a usar este helper. Resultado: reclasificar un mail lo MUEVE entero (con adjuntos) sin duplicar ni dejar copias atrás. Sin cambios en datos del Sheet ni en estilo-visual/documentacion.)
// Build: 2026-05-27 v18.34 (Sobre v18.33: FIX aviso fantasma "Hay cambios sin guardar" al SALIR de la ficha tras BORRAR un mail de Comunicaciones (X roja). Sin borrar nada, la ficha sale limpia (F5 manual -> sin aviso); el problema solo aparecía tras borrar. CAUSA: el handler de borrado hacía location.reload(), y en recargas por JS el navegador RESTAURA los valores cacheados del formulario en vez de usar el HTML fresco del servidor; alguno quedaba descuadrado respecto a la foto ptlOrig (que viene del servidor) -> ptlDiff lo veía como cambio y al pulsar "Presupuestos"/salir saltaba el confirm de guardar/descartar pese a no haber tocado nada. FIX: location.reload() -> location.replace(location.href), que fuerza una carga fresca sin restauración de formulario. Se mantiene window.ptlReloading=true para el beforeunload. NO se toca el borrado en sí (el mail se borra igual) ni el detector de cambios. Sin cambios en datos del Sheet ni en estilo-visual/documentacion.)
// Build: 2026-05-27 v18.33 (Sobre v18.32: dos arreglos del MAPA. (1) FOCO DESDE LA FICHA — al pulsar "🗺️ Mapa" en la ficha de un expediente CON coordenada, el mapa abría igualmente en vista general (fitBounds de todas las chinchetas) "ignorando" el foco. CAUSA: el setView a la chincheta del foco y el fitBounds general se lanzaban en el MISMO tick; la animación del fitBounds (zoomAnimation:true, zoomSnap:0) pisaba/cancelaba al setView -> quedaba la vista general. FIX: si hay FOCUS_ID y su chincheta existe, se hace SOLO el setView(zoom 17) + abrir popup y se OMITE el fitBounds general (un único movimiento, sin carrera). El fitBounds general solo corre si NO hay foco o si el foco no tiene coordenada (en cuyo caso, además, se mantiene el alert "aún no está ubicada"). (2) ZOOM DE RUEDA con delay — wheelDebounceTime pasa de 60 a 20ms: los 60ms de "agrupado" de eventos de rueda se notaban como un retardo entre girar y reaccionar; a 20 responde casi al instante sin volver a saltar (zoomSnap 0 / zoomDelta 0.3 / wheelPxPerZoomLevel 30 intactos). Solo toca presupuestos.cjs; sin cambios en datos del Sheet ni en estilo-visual/documentacion.)
// Build: 2026-05-26 v18.32 (Sobre v18.31: LIMPIEZA final de grises — 41 colores gris a pelo (#6B7280, #9CA3AF, #374151, #111827, #E5E7EB, #F3F4F6, #F9FAFB) pasan a las variables de la escala (var(--ptl-gray-500/400/700/900/200/100/50)). Tras esto NO queda ningún color del sistema a pelo en el archivo: solo blancos puros #FFFFFF (correcto) y un par de #E0E2E6 que están en comentarios. Sin cambios de lógica ni visuales (los grises son los mismos, ahora por variable). Acompaña a estilo-visual.cjs v1.30 (repaso de borde de hovers) y documentacion.cjs v17.33.)
// Build: 2026-05-26 v18.31 (Sobre v18.30: SIMPLIFICACIÓN — el style inline de input repetido ~15 veces (modal de Comunicaciones: destinatario, CC, CCO, asunto, 6 cajas de adjuntos; y el campo notas_pto de DATOS CCPP) se sustituye por la clase .ptl-input-modal de estilo-visual v1.29. Mismo aspecto, definido en un solo sitio, con altura uniforme (26px) igual que el resto de campos. En las cajas de adjuntos se conserva solo el flex en style (el resto va por la clase). Sin cambios de lógica. Acompaña a estilo-visual.cjs v1.29 (altura uniforme de campos + borde azul claro de la cinta de fase).)
// Build: 2026-05-26 v18.30 (Sobre v18.29: SOLUCIÓN LIMPIA a los botones de cabecera para que se INVIERTAN al hover (su style inline lo impedía). Se quita el inline y pasan a clases (ver estilo-visual v1.28): Plantillas mail/documentos -> .ptl-btn-orden (azul); Ejecutar cron -> .ptl-btn-orden-verde, y su JS de estado (pintarVerde/pintarRojo) ahora togglea las CLASES .ptl-btn-orden-verde/.ptl-btn-orden-rojo en lugar de fijar estilos inline, para que el hover siga funcionando; Mapa -> .ptl-btn-orden-ambar; HOY -> .ptl-filtro-hoy. Acompaña a estilo-visual.cjs v1.28 (filas del listado con borde azul claro) y documentacion.cjs v17.32.)
// Build: 2026-05-26 v18.29 (Sobre v18.28: los BOTONES DE PASO/avance de fase pasan de azul (.ptl-btn-primary) a VERDE unificado (.ptl-btn-avanzar, definido en estilo-visual v1.27: verde claro + letra verde oscuro + borde verde). Afecta a los ~7 botones de avance: Paso a 06 (05_FIN_DOC), Paso a 08 (08_INICIO_CYCP), avanzar genérico, ✓ Tramitados (cierre 08), Enviar presupuesto (fase 03), Paso a 02 (fase 01) y el avanzar de fase 04. Los demás .ptl-btn-primary (Guardar, Crear expediente, Enviar mail, Generar PDF...) siguen azules (no son de paso de fase). Acompaña a estilo-visual.cjs v1.27 (fondo de pantalla azul oscuro + bordes de caja azul claro + barra superior oscura).)
// Build: 2026-05-26 v18.28 (Sobre v18.27: BORDES de botones de cabecera que estaban INVISIBLES porque su border-color inline era el mismo tono claro que su fondo. Ahora cada uno lleva borde del tono FUERTE de su familia: Plantillas mail y Plantillas documentos -> azul oscuro; Ejecutar cron -> verde (--ptl-success), también en el reset del JS; Mapa -> ámbar (--ptl-warning); HOY -> ámbar. Además HOY se UNIFICA con En trámite y Mapa al mismo ámbar exacto (fondo warning-light + letras warning-dark + borde warning). Acompaña a estilo-visual.cjs v1.26 (fechas del timeline al color de su fase).)
// Build: 2026-05-26 v18.27 (Sobre v18.26: parte de la GRAN UNIFICACIÓN de color (ver estilo-visual v1.25). Los tonos a pelo de las familias verde/ámbar/rojo y los grises sueltos pasan a las variables del sistema (var(--ptl-success/-light/-dark), var(--ptl-warning...), var(--ptl-danger...), var(--ptl-gray-300), etc.) — 81 reemplazos. El gris zebra #E0E2E6 (cabecera de CCPP en HOY, filas de Comunicaciones y Mails) pasa a var(--ptl-zebra). Sin cambios de lógica. Acompaña a estilo-visual.cjs v1.25 y documentacion.cjs v17.31.)
// Build: 2026-05-26 v18.26 (Sobre v18.25: se QUITAN los bordes gris claro que rodeaban las listas con fondo blanco dentro de las cajas oscuras y que se veían como una raya clara fea bajo la cabecera: borde de .hoy-exp-list (lista Expedientes HOY) y de .hoy-mails-list (Mails pendientes). Ya no hacían falta (cabecera y caja son del mismo azul oscuro, la línea no separaba nada). Acompaña a estilo-visual.cjs v1.23 que quita el mismo borde de .ptl-lista-filas (mini-listas de fase 02/05/08 de HOY).)
// Build: 2026-05-26 v18.25 (Sobre v18.24: UNIFICACIÓN TOTAL DE AZULES — ya NO existe ningún azul/cian/morado a pelo en el programa, SOLO los dos canónicos (oscuro #004079 / claro #B4DCFF). Se sustituyen los últimos colores que quedaban, todos del MAPA de expedientes: #2563EB (categoría "Presupuesto/aceptación" y enlace "Abrir ficha") y #9333EA (categoría "Otros") y #06B6D4 (cian del parpadeo "guardado OK" de chinchetas) -> var(--ptl-azul-oscuro); #BFDBFE (borde badge azul) -> var(--ptl-azul-claro). 9 reemplazos. NOTA: esto unifica el color de las chinchetas del mapa al esquema de 2 azules (decisión Guille: solo 2 tipos de azul en TODO el programa). Acompaña a estilo-visual.cjs v1.22 y documentacion.cjs v17.30.)
// Build: 2026-05-26 v18.24 (Sobre v18.23: REPASO de color (decisión Guille). (1) TEXTO DE REENVÍO de la cinta de fase ("1+3/3 - reenvío completado", "próximo reenvío...", etc.) en sus 4 puntos (fases 04, 05, 08 y fases activas con plantilla) pasa a AZUL CLARO fijo (var(--ptl-azul-claro)): antes usaba ámbar/azul-viejo/gris según estado, que sobre la cinta AZUL OSCURO se veían ilegibles. El estado se sigue entendiendo por el propio texto. (2) CAJA COMUNICACIONES: el texto de las filas va sobre fondo blanco/gris (zebra), así que se fuerza a NEGRO (.ptl-com-list{color:gray-900} + zebra impar blanca explícita). El asunto usaba color:var(--ptl-gray-800) — variable que NO existía (ver estilo-visual v1.22 que la añade) y por eso heredaba azul claro; corregido a gray-900. (3) BARRIDO: los últimos hex azules ANTIGUOS a pelo se sustituyen por las variables del sistema — #4F46E5 -> var(--ptl-azul-oscuro) (8 usos: botones reloj ⏰, enlaces ↩/↪, etc.) y #EEF2FF/#C7D2FE/#DBEAFE -> var(--ptl-azul-claro) (5 usos). El gris zebra #E0E2E6 se MANTIENE (no es azul). Acompaña a estilo-visual.cjs v1.22 y documentacion.cjs v17.30.)
// Build: 2026-05-26 v18.23 (Sobre v18.22: tres cambios en la caja "Expedientes HOY". (1) SUBCABECERAS DE FASE pasan a fondo AZUL OSCURO + texto AZUL CLARO (var(--ptl-azul-oscuro)/(--ptl-azul-claro) del nuevo sistema de 2 azules de estilo-visual v1.18), antes celeste #DBEAFE con texto azul. (2) El contador de cada subcabecera pasa de "(N)" a "(X de Y)": X = expedientes de esa fase MOSTRADOS en HOY, Y = total de expedientes de esa fase en el listado activo (mismo número que muestran los botones de fase de arriba; se calcula con comusListado.filter(_faseDe===clave).length y se guarda en g.total al construir _gruposHoy). (3) El check "visto hoy" pasa a CUADRO BLANCO con TICK NEGRO (antes cuadro negro/tick blanco): se le quita el accent-color inline y se estiliza vía nueva clase CSS .hoy-exp-visto en estilo-visual v1.18 (appearance:none + tick dibujado con ::after). Acompaña a estilo-visual.cjs v1.18 (sistema de 2 azules + clase del check). Mantiene v18.22 y anteriores.)
// Build: 2026-05-26 v18.22 (Sobre v18.21: el check "visto hoy" pasa a BLANCO Y NEGRO. Antes usaba el color de acento del navegador (azul al marcar); ahora lleva accent-color:#374151 (gris oscuro casi negro) para que al marcarlo se vea en gris/negro y no añada más color a la caja. Solo cambia ese estilo del checkbox. Sin más cambios.)
// Build: 2026-05-26 v18.21 (Sobre v18.20: NUEVO check "visto hoy" en la caja "Expedientes HOY". A la IZQUIERDA de las notas (entre la dirección y el textarea) de cada expediente aparece un checkbox para marcar los revisados durante el repaso diario. Se guarda al instante (sin recargar, sin botón de guardar) en la NUEVA columna BG "visto_hoy" del Sheet "comunidades" — "1" marcado / "" desmarcado — usando el endpoint existente /presupuestos/expediente/campo con el guardado seguro (solo-celda + releído). Al cargar la página el check sale marcado según lo que haya en BG (aguanta recargas). El DESMARCADO es MANUAL uno a uno (decisión Guille: son pocos, no hace falta limpieza automática ni botón de limpiar). Si el guardado falla, el check se revierte y avisa. CAMBIOS: (1) IMPORTANTE — Guille añadió a mano la cabecera "visto_hoy" en BG1 del Sheet (ya hecho y verificado). (2) COLS añade "visto_hoy" al final. (3) RANGO_COMUNIDADES A:BF -> A:BG; rango de escritura tramoH en actualizarComunidad AH:BF -> AH:BG (el slice(33) ya incluye la col nueva). (4) actualizarCampoComunidad y el endpoint /campo aceptan visto_hoy automáticamente (validan con COLS.includes; _colNumALetra(58)=BG verificado). (5) Front: checkbox .hoy-exp-visto en renderExpedienteEnHoy + handler change que hace POST a /campo. Mantiene v18.20 (subcabeceras sobresalen, AJUSTADO a 10px) y todo lo anterior.)
// Build: 2026-05-26 v18.20 (Sobre v18.19: las subcabeceras de fase de "Expedientes HOY" ahora SOBRESALEN 10px por la izquierda del recuadro (margin-left:-10px en _subcabFase), para que asomen como pestañas/cabeceras hacia fuera. Como la lista tenía overflow:hidden (que recortaría lo que sobresale), se le quita ese overflow:hidden a .hoy-exp-list. NOTA: quitar overflow:hidden puede hacer que las esquinas redondeadas (border-radius:5px) de la caja se vean un pelín menos limpias; si molesta, se revierte. Solo esos dos cambios. Mantiene v18.19 y anteriores.)
// Build: 2026-05-26 v18.19 (Sobre v18.18: ajuste visual menor — las subcabeceras de fase de "Expedientes HOY" acercan su texto al borde izquierdo (padding izquierdo 8px->3px) para que destaquen mejor como cabeceras. Solo cambia ese padding en _subcabFase. Sin más cambios.)
// Build: 2026-05-26 v18.18 (HOTFIX sobre v18.17: arregla el error "faseC is not defined" que rompía la pantalla /presupuestos/hoy (pantalla de Error). CAUSA: en v18.16 la variable faseC se declaró con const DENTRO de un try, pero se usaba también FUERA (en la condición del pill "Faltan X de Y") -> fuera del try no existía. node --check NO lo detecta (la sintaxis es válida; es un error de alcance en ejecución). FIX: faseC se declara una sola vez al inicio de renderExpedienteEnHoy, fuera del try, disponible para el badge y para el pill. Revisado el resto de la función: no quedan más variables fuera de alcance. Sin cambios de comportamiento respecto a v18.17 (auto-badge solo Decidir en 01/04/05/08, pill solo en 05/08, reloj manda). Es solo la corrección del fallo.)
// Build: 2026-05-26 v18.17 (Sobre v18.16: el auto-relleno por badge de "Expedientes HOY" ahora SOLO mete automáticamente los ⚠️ Decidir (ámbar); los 👎 Retrasado YA NO entran solos. Lógica (Guille): un Retrasado es un expediente que ya se decidió seguir empujando (se metió fecha / se reactivó el ciclo), así que no necesita volver a saltar a HOY hasta que su ciclo se agote y vuelva a estado "Decidir". Esto aplica a las 4 fases con auto-badge (01/04/05/08). IMPORTANTE: si el usuario marca con el reloj a mano un expediente Retrasado, SÍ sigue apareciendo (entra por la vía del reloj, no por el badge) — solo cambia el relleno AUTOMÁTICO. Un solo cambio: el filtro pasa de (decidir||retrasado) a (decidir) en el bucle de auto-relleno. Mantiene v18.16 (pill Faltan solo en 05/08), v18.15 (auto-badge 01/04/05/08) y todo lo anterior.)
// Build: 2026-05-26 v18.16 (Sobre v18.15: el pill "Faltan X de Y" de la caja "Expedientes HOY" pasa a mostrarse SOLO en las fases con documentación (05_DOCUMENTACION y 08_CYCP), donde se cuentan CCPP + pisos. En el resto de fases (01/02/03/04/06/07...) no hay docs que contar, así que ya NO se pinta — antes, si marcabas con reloj un expediente de p.ej. fase 03 (sin pisos metidos), salía un "Faltan 1 de 1" / "✓ Completo" sin sentido. Solo cambia la condición de pintado del pill en renderExpedienteEnHoy (faseC === 05 u 08). El badge de plazo 👍/⚠️/👎 NO se toca (ese sí aplica a todas las fases con cron). Mantiene v18.15 (auto-badge en 01/04/05/08) y todo lo anterior.)
// Build: 2026-05-26 v18.15 (Sobre v18.14: el auto-relleno por badge de "Expedientes HOY" se amplía a TODAS las fases que tienen badge de plazo: ahora _FASES_AUTO_BADGE = {01_CONTACTO, 04_ACEPTACION_PTO, 05_DOCUMENTACION, 08_CYCP}. En esos 4 grupos aparecen, además de los marcados con reloj, los expedientes con aviso ⚠️ Decidir / 👎 Retrasado (sin reloj). Las fases sin badge (02/03/06/07) siguen mostrando solo lo marcado con reloj. El cálculo del pill "Faltan X de Y" para automáticos se extiende a las fases con documentación (05 y 08) vía _FASES_CON_DOCS; 01 y 04 no llevan docs. La fase 08 excluye los ya cerrados (fecha_cycp_completa), igual que su cajita de abajo. Las cajitas de fase independientes de abajo SE MANTIENEN de momento (decisión Guille: validar arriba antes de eliminarlas). Reglas de v18.13/14 intactas (sin duplicar, marca manda, sin reloj = automático). Mantiene todo lo anterior.)
// Build: 2026-05-26 v18.14 (PRUEBA — Sobre v18.13: el auto-relleno por badge de "Expedientes HOY" se amplía a la fase 05_DOCUMENTACION (antes solo 01_CONTACTO). En el grupo 05 aparecen ahora, además de los marcados con reloj, los de fase 05 con aviso ⚠️ Decidir / 👎 Retrasado (sin reloj). Las reglas son las mismas que en v18.13 (sin duplicar, marca manda, sin reloj = automático). Como la fase 05 SÍ lleva documentación, se calcula también el pill "Faltan X de Y" para esos automáticos (la 01 no lo necesitaba). Config centralizada en _FASES_AUTO_BADGE = {01_CONTACTO, 05_DOCUMENTACION}; ampliar a 04/08 es añadirlas ahí. OBJETIVO: validar en 05 (que sí tiene badges activos ahora) antes de extender a todas y eliminar las cajitas de fase. Mantiene v18.12 (subcabeceras celestes) y todo lo anterior.)
// Build: 2026-05-26 v18.13 (PRUEBA — Sobre v18.12: la caja "Expedientes HOY", SOLO en el grupo 01·CONTACTO, ahora se comporta como la cajita independiente "01-CONTACTO": además de los expedientes marcados con reloj, MUESTRA AUTOMÁTICAMENTE los de fase 01 con aviso (badge ⚠️ Decidir / 👎 Retrasado) aunque no estén marcados. Reglas: (1) los automáticos por badge van SIN botón reloj (un hueco invisible mantiene la alineación); (2) los marcados con reloj van CON reloj como siempre; (3) si uno cumple las dos cosas (badge + reloj) sale UNA sola vez y CON reloj (la marca manda); (4) si se desmarca el reloj de uno con badge, se mantiene en la lista por el badge pero ya sin reloj. La ausencia de reloj es lo único que distingue automáticos de manuales. El contador del título y la condición de pintado pasan a contar el TOTAL real (marcados + automáticos). renderExpedienteEnHoy gana un 3er parámetro conReloj (default true, así el resto de grupos no cambian). OBJETIVO: si funciona, replicar el patrón al resto de cajas de fase (02/04/05/08) y ELIMINAR las cajitas de fase independientes, dejando solo "Expedientes HOY". De momento SOLO fase 01, para validar. Mantiene v18.12 (subcabeceras celestes) y todo lo anterior.)
// Build: 2026-05-26 v18.12 (Sobre v18.11: las subcabeceras de fase de la caja "Expedientes HOY" (01·CONTACTO, 05·DOCUMENTACIÓN, etc.) pasan a fondo CELESTE #DBEAFE — el mismo color de fondo de la cajita .ptl-card — en vez de transparente/blanco. Solo cambia el background de _subcabFase. Mantiene v18.11 (pill Faltan X de Y en HOY), v18.10 (banner plazo en HOY), v18.09 (agrupación por fase), v18.08 (Dirección 100%), v18.07 (fix fecha) y v18.06 (zoom + Fase 2 mapa).)
// Build: 2026-05-26 v18.11 (Sobre v18.10: la caja "Expedientes HOY" añade el pill "Faltan X de Y" / "✓ Completo" / "sin pisos" (mismo dato y misma lógica que las cajas de fase 05/08: CCPP + pisos, _resumenManual), colocado ENTRE el banner de plazo y el botón ⏰ — es decir, ORDEN INVERSO al de las cajas 05/08 (allí es dirección · Faltan · badge; aquí es notas · badge · Faltan · reloj), como pidió Guille. Todos los pills "Faltan" tienen ANCHO FIJO (96px, texto centrado) para que queden alineados en columna, igualados al caso más ancho ("Faltan 63 de 63"). El cálculo se hace una vez por adelantado (async, lee pisos de cada CCPP de HOY) y se cachea en un mapa por ccpp_id para leerlo en el render síncrono. Mantiene v18.10 (banner de plazo en HOY), v18.09 (agrupación por fase), v18.08 (Dirección 100%), v18.07 (fix fecha) y v18.06 (zoom + Fase 2 mapa).)
// Build: 2026-05-26 v18.10 (Sobre v18.09: la caja "Expedientes HOY" ahora muestra el MISMO banner de estado 👍 En plazo / ⚠️ Decidir / 👎 Retrasado (N días) que las cajas de fase de abajo, colocado ENTRE el campo de notas y el botón ⏰. Se calcula con calcularEstadoPlazo + renderBadgePlazo (las MISMAS funciones que usan las cajas de fase), reutilizando plantillasHoy y f1MapHoy ya cargados arriba en el handler de /hoy -> el badge sale idéntico, sin cálculos nuevos ni lecturas extra al Sheet. Si la fase del expediente no genera badge (p.ej. fases sin cron), no se muestra nada (no rompe la fila). Sin tocar el resto del render (notas, reloj, sub-filas de pisos, agrupación por fase de v18.09). Mantiene v18.09 (agrupación por fase + subcabeceras sin fondo), v18.08 (Dirección 100% + col-9/10/11), v18.07 (fix fecha) y v18.06 (zoom + Fase 2 mapa).)
// Build: 2026-05-26 v18.09 (Sobre v18.08: la caja "Expedientes HOY" de /presupuestos/hoy ahora AGRUPA los expedientes POR FASE, dentro de la MISMA caja (no se abren ventanas nuevas). Antes salían todos en una lista plana ordenada por dirección; ahora se reparten en grupos 01·Contacto / 02·Visita / 03·Envío PTO / 04·Aceptación PTO / 05·Documentación / 06·Visita EMASESA / 07·Pte CYCP / 08·CYCP / 09·Tramitados / ZZ, cada uno con una subcabecera fina (texto azul en mayúsculas, SIN fondo — hereda el de la caja —, con el contador del grupo). Dentro de cada grupo se mantienen ordenados por dirección y con TODO igual que antes: notas editables, reloj ⏰, sub-filas de pisos. Las fases sin expedientes hoy no muestran subcabecera. Cualquier fase no contemplada cae en un grupo "Otros" al final. Implementación: se agrupa expedientesEnHoy con normalizarFase(fase_presupuesto) según un orden fijo _ORDEN_FASES_HOY; renderExpedienteEnHoy NO se toca. Mantiene v18.08 (Dirección al 100% + col-9/10/11 en estilo-visual v1.17), v18.07 (fix fecha aceptación) y v18.06 (zoom + Fase 2 mapa). NOTA: esta versión NO requiere resubir estilo-visual.cjs salvo que no se subiera la v1.17 con v18.08.)
// Build: 2026-05-26 v18.08 (Sobre v18.07: FIX VISUAL — el campo DIRECCIÓN de la ficha del expediente ya ocupa todo el ancho de la fila (junto a Tipo vía), como se quería desde v18.03. CAUSA: el div de Dirección usa class="col-11", pero esa clase NO estaba definida en el CSS (estilo-visual.cjs solo tenía col-1..col-8 y col-12) -> el navegador la ignoraba y la columna se quedaba al ancho mínimo del texto (se veía "Alberche" y mucho hueco vacío a la derecha). SOLUCIÓN en 2 partes: (1) estilo-visual.cjs v1.17 añade las clases que faltaban col-9/col-10/col-11; (2) aquí, el input de direccion lleva style="width:100%" para llenar su columna (col-11). REQUIERE subir también estilo-visual.cjs v1.17. Sin más cambios. Mantiene todo lo de v18.07 (fix fecha aceptación) + v18.06 (zoom 30/0.3 + Fase 2 mapa).)
// Build: 2026-05-26 v18.07 (Sobre v18.06: FIX DEFINITIVO de la fecha que salía EN BLANCO en los mails de fase 05 (05_FIN_DOC y 05_SEGUIMIENTO_DOC: "con fecha ___ solicitamos a la CCPP..."). CAUSA RAÍZ: desajuste de nombre entre código y Sheet. La columna V se TITULABA "fecha_decision_pto" en el Sheet, pero el código la mapea (COLS) y la usa SIEMPRE como `fecha_aceptacion_pto` (lee por posición). El helper _fechaAceptacionPto leía comu.fecha_decision_pto —campo que NO existe en el objeto comu— y devolvía vacío aunque el Sheet tuviera la fecha. SOLUCIÓN (todo concordante): (1) helper ahora lee ult["05_ACEPTACION_PTO"] || comu.fecha_aceptacion_pto || comu.fecha_decision_pto (el del medio es el bueno; los otros, red de seguridad). (2) Comentario de aviso gordo en COLS para que nadie vuelva a tropezar. (3) {{fecha_aceptacion_pto}} pasa a ser la variable OFICIAL (nombre lógico, coincide con fase 04-ACEPTACIÓN PTO); {{fecha_decision_pto}} se mantiene como ALIAS (misma fecha, mismo helper). CAMBIOS EN SHEET/PLANTILLAS hechos por Guille y verificados: cabecera col V renombrada a "fecha_aceptacion_pto"; plantillas 05_FIN_DOC y 05_SEGUIMIENTO_DOC ahora usan {{fecha_aceptacion_pto}}. VERIFICADO con datos reales: Alberche 17 -> "con fecha 24/02/2026 solicitamos..." (antes en blanco). Sinaí 39 -> 07/05/2026. Caso sin dato en ningún sitio (Abogado Rafael Medina 1): queda en blanco a propósito (decisión de Guille: mejor hueco que fecha inventada). El hermano de fase 08 (_fechaInicioCycp / fecha_envio_contratos_pagos) se revisó y está SANO (mismo nombre en código y Sheet, sin desajuste). Sin más cambios. Mantiene todo lo de v18.06 (zoom 30/0.3 + Fase 2 del mapa).)
// Build: 2026-05-26 v18.06 (Sobre v18.05: ZOOM de rueda del mapa más rápido Y más suave a la vez: wheelPxPerZoomLevel 40->30 (cada giro hace algo más de zoom) y zoomDelta 0.4->0.3 (pasos más finos, para que ese extra de velocidad no se note a saltos). zoomSnap sigue en 0. Único cambio funcional. NOTA: esta subida también sirve para DESPERTAR a Render — el deploy de la v18.05 se quedó atascado (Render seguía sirviendo v18.03 pese a estar la v18.05 en GitHub); como Alberto no ve error en el panel, se re-sube un cambio real para forzar un deploy nuevo. Todo lo de la v18.05 sigue presente: Fase 2 del mapa (botón "Ubicar las que faltan", chinchetas amarillas con borde negro, grupo provisional filtrable). Sin cambios en datos del Sheet.)
// Build: 2026-05-26 v18.05 (Sobre v18.04: (A) ZOOM de rueda del mapa más rápido aún: wheelPxPerZoomLevel 50->40 (sigue sin saltos; zoomSnap 0/zoomDelta 0.4 intactos). (B) MAPA FASE 2 — GEOCODIFICACIÓN ("ubicar las que faltan"): nuevo botón "📍 Ubicar las que faltan (N)" en la cabecera del mapa (solo aparece si hay pendientes). Al pulsarlo, el NAVEGADOR de Guille geocodifica contra Nominatim/OpenStreetMap (el servidor de Render no sale a internet) las direcciones SIN coordenada, a 1 cada 1,1s (respeta el límite del servicio gratuito). Cada acierto se pinta como chincheta AMARILLA (#FACC15) con BORDE NEGRO, en un grupo nuevo de la leyenda "Sin confirmar (geolocalizada)" que se puede filtrar como los demás. El usuario la CONFIRMA arrastrándola a su sitio: al soltar (dragend) pide confirmación y guarda con el MISMO endpoint /mapa/guardar-coord de la Fase 1 (reutilizado, sin tocar); al confirmar, la chincheta deja de ser provisional (parpadeo cian) y el contador "sin coordenada" baja en 1. NUNCA se auto-guarda (Nominatim acierta calle pero falla portal y a veces pueblo) -> siempre confirma el usuario. Sirve IGUAL para las que faltan hoy (25 reales; las 9 'Z SIN DIRECCION' se excluyen porque no tienen dirección real) que para cualquier expediente NUEVO futuro: como el alta nace con earth="" (v18.02), al abrir el mapa aparecerá en el botón y se ubica igual. Municipio para la query: Sevilla capital por defecto, salvo pueblo entre paréntesis en tipo_via (Alcalá de Guadaíra, etc.); "(Bellavista)" se trata como Sevilla (es barrio). Backend: el bucle que construye 'puntos' arma además la lista 'pendientes' {id,dir,query}. REUSO MÁXIMO: el guardado/arrastre, el sistema de grupos y el filtro ya existían; lo único nuevo es el botón y el bucle de geocodificar. (Diagnóstico previo en v18.04: el "170 vs 171" era Doña Clarines 2, que no se perdió nada — nunca llegó a la col L; ahora se recupera por esta Fase 2. Su coord del KMZ: 37.370873, -5.974662.) Sin cambios en datos del Sheet.)
// Build: 2026-05-25 v18.03 (Sobre v18.02: retoques. (1) Ficha: quitado de la VISTA el campo "Comunidad (clave)" (no se edita aquí; lo usa el bot WhatsApp y pestañas vecinos_base/expedientes) — pasa a input hidden para no perder el dato al guardar la fila; Dirección se extiende a todo el ancho (col-11). (2) Zoom de rueda más rápido: wheelPxPerZoomLevel 100->65 (sigue sin saltos). (3) Botón "🗺️ Mapa" DESDE LA FICHA ahora abre el mapa centrado en la chincheta de ese expediente: renderCabeceraComun acepta opts.mapaId (solo lo pasa la ficha), el botón lleva ?focus=<ccpp_id>, y el endpoint /mapa lo lee (focusId) -> el front hace setView zoom 17 + abre el popup de esa chincheta. Si la dirección de la ficha NO tiene coordenada (no hay chincheta), avisa con un alert y abre el mapa normal. (4) Parpadeo de guardado ya en cian desde v18.02. Sin cambios en datos del Sheet. Pendiente: Fase 2 geocodificación (mañana), ajuste 19 aproximadas, chincheta 170vs171.)
// Build: 2026-05-25 v18.02 (Sobre v18.01: lote de 4 cosas. (1) FIX SERIO aviso fantasma + peligro de borrado: la ficha tenía un <select name="earth"> Sí/No (uso viejo de la columna, ya inútil) que ahora MACHACARÍA las coordenadas si se guardaba; y el alta de expediente nuevo ponía earth="NO" por defecto. SOLUCIÓN: quitado el select Earth de la ficha (4268) y del alta (6172); el expediente nuevo nace con earth="" (sin coordenada, se ubicará en el mapa); ptlDiff ignora siempre 'earth' (red de seguridad extra). La columna earth del Sheet intacta (solo se quita el control de pantalla). Esto elimina el "Hay cambios sin guardar" fantasma al salir de la ficha y el riesgo de borrar coordenadas. (2) BUSCADOR en el mapa: input que filtra por dirección (sin acentos, ignora mayúsculas), lista desplegable de coincidencias; al elegir, centra el mapa, zoom 17 y abre el globo. Enter va al primer resultado. (3) Parpadeo de guardado pasa de magenta a CIAN (#06B6D4) — el magenta se confundía con el rojo de Rechazado. (4) ZOOM de rueda más suave: zoomSnap 0, zoomDelta 0.4, wheelPxPerZoomLevel 100, wheelDebounceTime 60 (antes daba saltos de 3-4 niveles). Pendiente Fase 2 (geocodificar sin-coordenada y nuevos) y ajuste de las 19 aproximadas.)
// Build: 2026-05-25 v18.01 (Sobre v18.00: ajuste fino del ZOOM de rueda del mapa a un punto intermedio. v18.00 lo dejó demasiado lento (wheelPxPerZoomLevel 140, zoomSnap 0.25). Ahora: zoomSnap 0.5, zoomDelta 0.5, wheelPxPerZoomLevel 90, wheelDebounceTime 40 — ni brusco como el original (3-4 niveles de golpe) ni tan lento como v18.00. Solo cambia esos valores; resto igual.)
// Build: 2026-05-25 v18.00 (Sobre v17.99: retoques mapa. (1) ZOOM de rueda más fino/gradual: L.map con zoomSnap 0.25, zoomDelta 0.5, wheelPxPerZoomLevel 140, wheelDebounceTime 40 (antes una pasada de rueda daba 3-4 niveles de golpe). (2) FEEDBACK de guardado al arrastrar: antes era verde fijo 2s, que se confundía con las chinchetas verdes de fase "Tramitada". Ahora PARPADEA en MAGENTA (#EC4899) — color no usado por ninguna fase — 3 parpadeos (6 cambios cada 220ms) y vuelve a su color de fase. Sin cambios funcionales en el guardado (sigue urlencoded a /mapa/guardar-coord) ni en el resto.)
// Build: 2026-05-25 v17.99 (Sobre v17.98: FIX guardado de coordenada al arrastrar chincheta — daba "Falta id". Causa: el front enviaba el POST como FormData (multipart), pero el backend usa bodyParser.urlencoded y NO lee multipart -> req.body llegaba vacío -> id vacío -> "Falta id". Mismo tipo de fallo que el corregido en v17.84 con los POST de documentos. FIX: el dragend ahora envía los datos como application/x-www-form-urlencoded (id=...&lat=...&lng=...), igual que el resto del módulo. Sin cambios en el endpoint /mapa/guardar-coord ni en el resto del mapa.)
// Build: 2026-05-25 v17.98 (Sobre v17.97: MAPA Fase 1 — chinchetas arrastrables + hover + filtros + guardado. (1) Las chinchetas pasan de circleMarker a L.marker con divIcon de color (circleMarker NO soporta draggable; L.marker sí). El color por grupo de fase se mantiene vía el divIcon (círculo CSS coloreado). (2) Arrastrables SIEMPRE: al soltar (dragend) se pide confirmación con la nueva coordenada; si se acepta, POST a /presupuestos/mapa/guardar-coord y feedback verde 2s; si se cancela o falla, la chincheta vuelve a su posición original (_posOrig). (3) HOVER: bindTooltip muestra la dirección al pasar el ratón (identificar de qué expediente es cada chincheta sin clic). CLIC: popup completo (dirección + fase + enlace a ficha). (4) FILTROS por categoría: la leyenda con checkboxes muestra/oculta cada grupo de color. (5) Nuevo endpoint POST /presupuestos/mapa/guardar-coord {id,lat,lng}: valida (no 0,0, rango terrestre), resuelve la comunidad por ccpp_id y escribe "lat, lng" en la columna earth con actualizarCampoComunidad (escritura solo-celda + releído de verificación). (6) Cada punto lleva ahora su id (ccpp_id) para poder guardar. PENDIENTE Fase 2: geocodificar desde el navegador los expedientes SIN coordenada (que aún no salen en el mapa) y los expedientes nuevos al crear ficha. Sigue todo en presupuestos.cjs (decisión Guille: dejarlo aquí por ahora, extraer a ara-os-mapa.cjs en sesión futura; el código del mapa está agrupado para facilitar esa extracción). Sin cambios en envío de mails ni en el Sheet salvo la col earth que ya existía.)
// Build: 2026-05-25 v17.97 (Sobre v17.96: NUEVO mapa de expedientes geolocalizados. (1) Botón "🗺️ Mapa" en renderCabeceraComun, junto a "⚡ Ejecutar cron" (fondo ámbar suave), visible en listado, HOY y ficha. (2) Nuevo endpoint GET /presupuestos/mapa: lee la columna `earth` (col L, ya existente en COLS, formato "lat, lng") de cada comunidad y pinta una chincheta por expediente con coordenada usando Leaflet 1.9.4 + tiles de OpenStreetMap (gratis, sin API key). Las coordenadas se cargaron una vez desde el KMZ ARA.kmz (171 de 204 emparejadas: 152 exactas + 19 aproximadas con número de portal coincidente; 33 sin coordenada: 9 'Z SIN DIRECCION', 5 grupo B con número dudoso aparcado, ~19 no presentes en el KMZ). Volcado vía coordenadas_earth.xlsx pegado en col L (texto sin formato). (3) Chinchetas coloreadas por GRUPO de fase: contacto/visita (gris), presupuesto/aceptación (azul), tramitación 05-08 (ámbar), tramitada 09 (verde), rechazado/descartado (rojo). (4) Popup por chincheta: dirección (tipo_via+direccion), fase y enlace "Abrir ficha →" (usa ccpp_id ya calculado, que deriva de la DIRECCIÓN col B — NO de la col A, que queda libre para clave del bot WhatsApp). (5) Leyenda con checkboxes para mostrar/ocultar grupos. (6) parseEarth valida formato y descarta 0,0 y fuera de rango. El mapa NO geocodifica (problema de red en Render evitado): solo LEE las coordenadas ya guardadas. Las comunidades sin coordenada simplemente no salen (contador "X sin coordenada"). Sin cambios en el Sheet (la col earth ya existía y ya se leía), ni en rangos, ni en envío de mails.)
// Build: 2026-05-25 v17.96 (Sobre v17.95: el histórico de mails (mail_historico) ahora GUARDA el CC y el CCO, no solo el destinatario (Para). Decisión Guille: "todo junto" en la MISMA celda destinatario (col E), sin añadir columnas nuevas al Sheet. Formato nuevo: "Para: a@x.com | CC: b@y.com | CCO: c@z.com"; las partes vacías se omiten (sin CC -> no aparece "CC:"). (1) Nuevo helper _componerDestinatarioHist(dest,cc,cco): normaliza cada lista (acepta separadores ||, coma, ;, saltos) y compone el string; SI no hay cc ni cco devuelve solo el email (formato antiguo) -> retrocompatible. (2) registrarMailEnHistorico acepta datos.cc y datos.cco (opcionales) y compone la celda E con el helper. (3) Las 5 vías de ENVÍO pasan ya cc y cco al registro: mail manual_externo (cc/cco del modal), mail con plantilla (ccManual/ccoF), reenvío fase 04 (ccR/ccoR), cron normal (destCc/plantilla.cco) y cron fase 04 (destCc04/plantilla.cco). La clasificación de mails ENTRANTES no pasa cc/cco (es correo recibido) -> sigue guardando solo el remitente. (4) LECTURA: el botón Responder del historial usa un extractor _soloPara() que saca SOLO el email del "Para" del formato nuevo (o el email a secas del antiguo), para no meter "Para:"/CC/CCO como destinatario al responder. La vista del historial SÍ muestra el texto completo "Para:...|CC:...|CCO:..." (que es lo que se pidió: ver todo junto). IMPORTANTE: solo afecta a envíos DE AHORA EN ADELANTE; los mails antiguos se quedan con solo el email en col E (su CC/CCO no se guardó nunca y no se puede reconstruir). NO requiere tocar el Sheet (no hay columnas nuevas). Sin cambios en el envío real ni en enviarMailReal.)
// Build: 2026-05-25 v17.95 (Sobre v17.94: el modal "Enviar mail manual" abierto EN BLANCO (botón de la cabecera, no responder/reenviar) ahora precarga el PIE/firma global, que antes salía vacío. El PIE_GLOBAL ya estaba disponible en el modal y ya se usaba en Responder (línea ~4593) y Reenviar (~4614), pero el handler del botón "Enviar mail manual" llamaba a sAbrir() directo, que vacía el cuerpo vía sLimpiar() y nadie volvía a poner el pie. FIX: nuevo handler sAbrirNuevo() que hace sAbrir() y luego rellena el cuerpo con "\n\n" + PIE_GLOBAL, colocando el cursor arriba del todo (igual patrón que Responder). NO se toca sAbrir() (compartido por los 3 flujos) para no duplicar el pie en responder/reenviar, que lo ponen ellos al sobrescribir sCu.value después de sAbrir(). Sin cambios en el envío, en el endpoint, ni en los mails CON plantilla (esos ya llevan el pie incrustado en plantilla.mensaje al leerse). El pie se edita en Plantillas mail -> Pie de página global (fila _PIE_GLOBAL).)
// Build: 2026-05-25 v17.94 (Sobre v17.93: FIX — la variable {{fecha_decision_pto}} tampoco se sustituía (salía literal "{{fecha_decision_pto}}" en el cuerpo). La usan las plantillas 05_FIN_DOC y 05_SEGUIMIENTO_DOC ("Le comunicamos que con fecha {{fecha_decision_pto}} solicitamos a la CCPP la entrega de la documentación..."). Es la fecha de entrada en fase 05 (aceptación del presupuesto / petición de documentación), hermana de {{fecha_envio_contratos_pagos}} (fase 08). Verificado en código: presupuestos NO sella nunca la columna fecha_decision_pto; lo que sí sella al aceptar/avanzar a fase 05 es fecha_aceptacion_pto. Por eso {{fecha_decision_pto}} se resuelve con el helper fiable _fechaAceptacionPto (que ya alimenta {{fecha_aceptacion_pto}}: lee la fecha del último mail 05_ACEPTACION_PTO, con fallback a la columna fecha_decision_pto), en formato DD/MM/AAAA, en vez de leer a pelo una columna que el flujo actual no mantiene y que podría salir vacía. Añadido en sustituirVariablesAsync (necesita leer mails_ultimo_envio). En uso normal nunca sale en blanco (siempre hay fecha de aceptación al llegar a fase 05). Sin cambios en el Sheet ni en otras variables. NOTA: revisadas TODAS las variables {{...}} usadas por las plantillas; tras este fix y el de v17.93, las 9 que se usan (direccion, tipo_via, FECHA, DOC_CCPP, DOC_PISOS, PCT_PISOS, fecha_limite_doc_vecinos, fecha_envio_contratos_pagos, fecha_decision_pto) se sustituyen todas correctamente.)
// Build: 2026-05-25 v17.93 (Sobre v17.92: FIX — la variable {{fecha_envio_contratos_pagos}} no se sustituía en los mails: aparecía el texto literal "{{fecha_envio_contratos_pagos}}" en el cuerpo. Causa: sustituirVariables solo reemplazaba una lista cerrada de variables (direccion, comunidad, administrador, presidente, tipo_via, pto_total, fecha_limite_doc_vecinos, FECHA, FECHA+N) y esta no estaba en la lista, así que se quedaba sin tocar. El dato SÍ existe en el Sheet (col AZ fecha_envio_contratos_pagos, formato YYYY-MM-DD, sellado al pasar 07->08). FIX: añadida la sustitución de {{fecha_envio_contratos_pagos}} -> fecha en DD/MM/AAAA (mismo formato que el resto de fechas del programa). La usan las plantillas 08_FIN_CYCP y 08_SEGUIMIENTO_CYCP, ambas de fase 08, cuando la fecha ya está sellada (no sale en blanco en uso normal). Si estuviera vacía, se sustituye por "" (no deja el {{...}} literal). Sin cambios en el Sheet ni en otras variables.)
// Build: 2026-05-25 v17.92 (Sobre v17.91: FIX — el CCO de la plantilla NO se precargaba en el modal de mail con plantilla (ptl-modal-mail). Dos eslabones rotos a la vez desde v17.73 (cuando se añadió el input editable ptl-mm-cco): (1) el endpoint GET /presupuestos/plantilla-mail devolvía asunto/mensaje/adjuntos_fijos/dias_recurrente/max_envios pero NO incluía el cco de la plantilla en el objeto `plantilla` que manda al modal; (2) ptlAbrirModalMail rellenaba destinatario/cc/asunto/mensaje/adjuntos pero NO tenía línea para escribir el cco en la casilla (la dejaba con el '' de la limpieza inicial). Resultado: al abrir el modal desde cualquier botón de fase, la casilla CCO salía SIEMPRE vacía aunque la plantilla del Sheet tuviera CCO -> los envíos MANUALES desde el modal salían SIN la copia oculta (a comercial@) salvo que el usuario la escribiera a mano. Afectaba a las 6 fases con CCO en plantilla: 03_ENVIO_PTO, 04_REENVIO, 05_ACEPTACION_PTO, 05_FIN_DOC, 08_INICIO_CYCP, 08_FIN_CYCP. (Los reenvíos AUTOMÁTICOS del cron NO pasan por el modal y ya mandaban el cco bien.) FIX: (a) el endpoint añade `cco: plantilla.cco || ""` al objeto plantilla; (b) el modal pinta data.plantilla.cco en ptl-mm-cco, limpiando los separadores '||' del Sheet a una lista separada por comas (sin huecos vacíos). La edición a mano y el envío respetando el cco escrito ya funcionaban desde v17.73, no se tocan. Sin cambios en el Sheet, ni en el modal manual, ni en la lógica de envío/avance de fase.)
// Build: 2026-05-24 v17.91 (Sobre v17.90: la pantalla de PLANTILLAS DE DOCUMENTOS ahora muestra los 6 cuerpos en el MISMO ORDEN que el menú de impresión (Mantenimiento, Renuncia, Usufructo, Piso disidente, Contador único, Paso instalaciones), antes salían en el orden de la tab. Para ello ORDEN_DOCS se saca a constante de módulo (junto a DOCS_GENERALES/DOCS_PARTICULARES) con un helper _ordenDoc, y se usa tanto en vistaPlantillasDoc como en /docs/menu (se elimina la copia local que estaba dentro del endpoint). El encabezado general (arriba) y el pie general (abajo) se mantienen en su sitio; solo se reordenan los 6 de en medio. Un solo punto de orden para ambas pantallas. Sin cambios en datos.)
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
  const RANGO_COMUNIDADES = "comunidades!A:BJ"; // ... + fecha_limite_documentacion_vecinos (BC) + motivo_rechazo (BD) + fecha_cobro (BE) + en_hoy (BF) + visto_hoy (BG)
  const RANGO_MAIL_PLANTILLAS = "mail_plantillas!A:J"; // A..I como antes + J = cuenta_envio
  const RANGO_BOT_PLANTILLAS = "bot_plantillas!A:H"; // A clave|B destinatario|C tipo|D texto|E twilio_sid|F variables|G activo|H notas (textos del bot WhatsApp, v18.79)
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
  //  AP bot_comunidad_activo   (BOT_WHATSAPP = bot activo en esta comunidad | MANUAL/vacío = manual, defecto)
  //  AQ-AY estados manuales CCPP (gestionados por documentacion.cjs)
  //  AZ fecha_envio_contratos_pagos
  //  BA fecha_cycp_completa
  //  BB mails_manuales (JSON, paralelo a mails_enviados)

  const COLS = [
    "comunidad","direccion","presidente","telefono_presidente","email_presidente",
    "estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones",
    "tipo_via","earth","administrador","telefono_administrador","email_administrador",
    "fase_presupuesto","fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
    "decision_pto","fecha_aceptacion_pto",  // ⚠ OJO NOMBRE: la col V del Sheet se TITULA "fecha_decision_pto", pero el código la mapea y la usa SIEMPRE como `fecha_aceptacion_pto` (lee por posición, el título del Sheet da igual). Mismo dato. NO leer comu.fecha_decision_pto (no existe en el objeto) -> usar comu.fecha_aceptacion_pto.
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
    // AP — interruptor del bot WhatsApp a nivel de comunidad.
    //   "BOT_WHATSAPP" = el bot gestiona la documentación de esta comunidad.
    //   "MANUAL" o vacío = gestión manual (defecto). Reversible.
    //   (Antes se llamaba modo_documentacion con valores MANUAL/BOT, nunca llegó
    //   a usarse porque el bot estaba aparcado. Renombrado el 31-05-2026.)
    "bot_comunidad_activo",
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
    // BG visto_hoy: "1" si el expediente está marcado como REVISADO HOY (check
    // manual a la izquierda de las notas en la caja "Expedientes HOY"). Vacío si no.
    // Uso: repaso diario de expedientes; Guille marca los que va revisando y al
    // final del día ve de un vistazo los gestionados. Se DESMARCAN A MANO (uno a
    // uno) — no hay limpieza automática ni botón de limpiar (decisión Guille:
    // son pocos). Toggle 1/"" desde el endpoint /presupuestos/expediente/campo
    // (mismo que en_hoy y notas_pto, con releído de verificación).
    "visto_hoy",
    // BH fecha_pte_cobro: fecha en que la obra TERMINA y queda pendiente de
    // cobrar (fin de ejecucion). Junto con fecha_cobro (BE) define los 3
    // estados de la fase 09: sin ambas = En ejecucion; con esta y sin cobro =
    // Pendiente de cobro; con fecha_cobro = Cobrado. Formato YYYY-MM-DD.
    "fecha_pte_cobro",
    // BI poblacion / BJ cp: datos postales del expediente (los rellena Guille a
    // mano en la pestaña comunidades). Plan 5 los arrastra a la Toma de datos.
    "poblacion",
    "cp",
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
  // ¿Este expediente tiene ficha en Plan 5? (existe fila en plan5_toma_datos,
  // localizada por ccpp_id -col B- o, de respaldo, por direccion -col A-).
  // Se usa para BLOQUEAR en la ficha los 4 importes "previstos": cuando hay
  // Plan 5, esos valores los graba el boton Congelar y no se tocan a mano.
  // Lectura ligera (solo A:B). Si falla (sin pestaña/permeso) devuelve false:
  // no bloquea y no rompe la ficha.
  async function _expedienteTienePlan5(comu) {
    try {
      if (!comu) return false;
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: "plan5_toma_datos!A:B",
      });
      const rows = (r.data && r.data.values) || [];
      const id = String(comu.ccpp_id || "").trim();
      const norm = (x) => String(x == null ? "" : x).trim().toLowerCase().replace(/\s+/g, " ");
      const dirComu = norm(comu.direccion || ((comu.tipo_via ? comu.tipo_via + " " : "") + (comu.direccion_calle || "")));
      for (let i = 1; i < rows.length; i++) {
        const ri = rows[i] || [];
        if (id && String(ri[1] || "").trim() === id) return true;
        if (dirComu && norm(ri[0]) === dirComu) return true;
      }
    } catch (e) {
      console.error("[ficha] check Plan 5:", e.message);
    }
    return false;
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
    const tramoH  = row.slice(33);      // AH..BH (cols 33..59) — incluye en_hoy (BF), visto_hoy (BG) y fecha_pte_cobro (BH)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `comunidades!A${rowIndex}:AA${rowIndex}`,  values: [tramoA]  },
          { range: `comunidades!AE${rowIndex}:AF${rowIndex}`, values: [tramoEF] },
          { range: `comunidades!AH${rowIndex}:BJ${rowIndex}`, values: [tramoH]  },
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
  // Asegura la subcarpeta "00 imagenes" dentro de la carpeta del expediente (no debe bloquear).
  async function _ensureSubImagenes(drive, parentId) {
    try {
      const sub = "00 imagenes";
      const q = await drive.files.list({
        q: `name='${sub}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1,
      });
      if (q.data.files && q.data.files.length > 0) return q.data.files[0].id;
      const sc = await drive.files.create({
        requestBody: { name: sub, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id",
      });
      console.log(`[presupuestos] subcarpeta Drive creada: "${sub}" (id=${sc.data.id})`);
      return sc.data.id;
    } catch (e) {
      console.warn("[presupuestos] no se pudo crear la subcarpeta 00 imagenes:", e && e.message);
      return null;
    }
  }
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
      const _expId = busq.data.files[0].id; await _ensureSubImagenes(drive, _expId); return _expId;
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
    const _expId = nueva.data.id; await _ensureSubImagenes(drive, _expId); return _expId;
  }
  // Lee 01.png..11.png de la subcarpeta "00 imagenes" del expediente Plan 5 y las devuelve como data URLs (array de 11; null donde falte). Nunca lanza.
  async function getImagenesExpediente(tipoVia, direccion) {
    const out = new Array(11).fill(null);
    try {
      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) return out;
      const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
      if (!nombre) return out;
      const drive = getDriveClient();
      const findFolder = async (name, parent) => {
        const safe = String(name).replace(/'/g, "\\'");
        const r = await drive.files.list({
          q: `name='${safe}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id,name)", pageSize: 1,
        });
        return (r.data.files && r.data.files[0]) ? r.data.files[0].id : null;
      };
      const expId = await findFolder(nombre, parentId);
      if (!expId) return out;
      const imgId = await findFolder("00 imagenes", expId);
      if (!imgId) return out;
      const lst = await drive.files.list({
        q: `'${imgId}' in parents and trashed=false`,
        fields: "files(id,name)", pageSize: 100,
      });
      const byName = {};
      (lst.data.files || []).forEach(function (fl) { byName[String(fl.name).toLowerCase()] = fl.id; });
      for (let k = 1; k <= 11; k++) {
        const fid = byName[("0" + k).slice(-2) + ".png"];
        if (!fid) continue;
        try {
          const dl = await drive.files.get({ fileId: fid, alt: "media" }, { responseType: "arraybuffer" });
          out[k - 1] = "data:image/png;base64," + Buffer.from(dl.data).toString("base64");
        } catch (e2) { console.warn("[presupuestos] no se pudo descargar " + ("0"+k).slice(-2) + ".png:", e2 && e2.message); }
      }
      return out;
    } catch (e) {
      console.warn("[presupuestos] getImagenesExpediente:", e && e.message);
      return out;
    }
  }
  // Sirve UNA foto suelta (n=1..11) del expediente, para carga lazy en el navegador. Devuelve Buffer o null.
  async function getImagenExpediente(tipoVia, direccion, n) {
    try {
      const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES;
      if (!parentId) return null;
      const nombre = `${tipoVia || ""} ${direccion || ""}`.trim();
      if (!nombre) return null;
      const k = parseInt(n, 10); if (!(k >= 1 && k <= 12)) return null;
      const drive = getDriveClient();
      const findFolder = async (name, parent) => {
        const safe = String(name).replace(/'/g, "\\'");
        const r = await drive.files.list({ q: `name='${safe}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id,name)", pageSize: 1 });
        return (r.data.files && r.data.files[0]) ? r.data.files[0].id : null;
      };
      const expId = await findFolder(nombre, parentId); if (!expId) return null;
      const imgId = await findFolder("00 imagenes", expId); if (!imgId) return null;
      const fname = ("0" + k).slice(-2) + ".png";
      const safe = fname.replace(/'/g, "\\'");
      const lst = await drive.files.list({ q: `name='${safe}' and '${imgId}' in parents and trashed=false`, fields: "files(id,name)", pageSize: 1 });
      const fid = (lst.data.files && lst.data.files[0]) ? lst.data.files[0].id : null;
      if (!fid) return null;
      const dl = await drive.files.get({ fileId: fid, alt: "media" }, { responseType: "arraybuffer" });
      return Buffer.from(dl.data);
    } catch (e) { console.warn("[presupuestos] getImagenExpediente:", e && e.message); return null; }
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

  // [v18.138] Devuelve (o crea) la subcarpeta "00 ARCHIVOS MAILS PENDIENTES"
  // dentro de la carpeta padre DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES. Es el
  // destino temporal de los adjuntos entrantes hasta que se clasifica el mail.
  async function _getOrCreateCarpetaMailsPendientes() {
    const parentId = process.env.DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES || null;
    if (!parentId) return null;
    const NOMBRE = "00 ARCHIVOS MAILS PENDIENTES";
    const drive = getDriveClient();
    const busq = await drive.files.list({
      q: `name='${NOMBRE}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    if (busq.data.files && busq.data.files.length > 0) {
      return busq.data.files[0].id;
    }
    const nueva = await drive.files.create({
      requestBody: {
        name: NOMBRE,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    console.log(`[presupuestos][imap] Subcarpeta '${NOMBRE}' creada (id=${nueva.data.id})`);
    return nueva.data.id;
  }

  // [v17.13] Sube los adjuntos del mail a la carpeta padre
  // DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES. Las sugerencias automáticas se
  // eliminaron, así que SIEMPRE se sube a la carpeta padre (quedan "sueltos"
  // hasta que el usuario clasifique el mail manualmente).
  // Devuelve string formato "LABEL: url || LABEL: url" igual que mail_historico.
  async function _subirAdjuntosEntrantes(adjuntos) {
    if (!adjuntos || adjuntos.length === 0) return "";
    const carpetaId = await _getOrCreateCarpetaMailsPendientes();
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
      // Timeouts: si el SMTP se atasca, falla en vez de colgarse sin fin.
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
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
  // ---- bot_plantillas (textos del bot WhatsApp) — patron calcado de doc_plantillas (v18.79) ----
  // PUNTO 1 (v18.83): lee el TEXTO real de una plantilla aprobada de Twilio desde su
  // Content API. Cache 10min + timeout 4s + fallback a "" (si falla o faltan credenciales).
  // Solo lectura; no envia nada.
  const _twilioTextoCache = new Map();
  const _TWILIO_TEXTO_TTL = 10 * 60 * 1000;
  function _extraerBodyTwilio(content) {
    try {
      const types = (content && content.types) ? content.types : {};
      for (const k of Object.keys(types)) {
        const t = types[k];
        if (t && typeof t.body === "string" && t.body.trim()) return t.body;
      }
      for (const k of Object.keys(types)) {
        const t = types[k];
        if (t && typeof t.title === "string" && t.title.trim()) return t.title;
      }
    } catch (e) {}
    return "";
  }
  function obtenerTextoTwilio(sid) {
    return new Promise((resolve) => {
      const id = String(sid || "").trim();
      if (!id) return resolve("");
      const cached = _twilioTextoCache.get(id);
      if (cached && (Date.now() - cached.ts) < _TWILIO_TEXTO_TTL) return resolve(cached.texto);
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      if (!SID || !TOKEN) return resolve("");
      const auth = Buffer.from(SID + ":" + TOKEN).toString("base64");
      const opts = {
        hostname: "content.twilio.com",
        path: "/v1/Content/" + encodeURIComponent(id),
        method: "GET",
        headers: { Authorization: "Basic " + auth },
        timeout: 4000,
      };
      const reqT = https.request(opts, (resp) => {
        let data = "";
        resp.on("data", (c) => { data += c; });
        resp.on("end", () => {
          let texto = "";
          try { texto = _extraerBodyTwilio(JSON.parse(data)); } catch (e) {}
          _twilioTextoCache.set(id, { texto, ts: Date.now() });
          resolve(texto);
        });
      });
      reqT.on("error", () => resolve(""));
      reqT.on("timeout", () => { try { reqT.destroy(); } catch (e) {} resolve(""); });
      reqT.end();
    });
  }

  async function leerPlantillasBot() {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const act = (r[6] === undefined || r[6] === null || String(r[6]).trim() === "")
        ? true
        : ["SI", "1", "TRUE"].includes(String(r[6]).trim().toUpperCase());
      out.push({
        clave:        String(r[0]).trim(),
        destinatario: r[1] || "",
        tipo:         r[2] || "",
        texto:        r[3] || "",
        twilio_sid:   r[4] || "",
        variables:    r[5] || "",
        activo:       act,
        notas:        r[7] || "",
        _rowIndex:    i + 1,
      });
    }
    return out;
  }

  // Guarda una plantilla del bot por su clave. Para tipo 'twilio' toca el SID (E) y activo (G);
  // para el resto toca texto (D) y activo (G). Conserva las demas columnas. No crea filas.
  async function guardarPlantillaBot(datos) {
    const sheets = getSheetsClient();
    const clave = String(datos.clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    let fila = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) {
        rowIndex = i + 1; fila = rows[i]; break;
      }
    }
    if (rowIndex < 0) throw new Error("clave no encontrada: " + clave);
    const nueva = [];
    for (let c = 0; c < 8; c++) nueva[c] = (fila[c] != null ? fila[c] : "");
    nueva[0] = clave;
    if (String(datos.tipo || "").trim().toLowerCase() === "twilio") {
      nueva[4] = String(datos.twilio_sid != null ? datos.twilio_sid : ""); // col E: SID
    } else {
      nueva[3] = String(datos.texto != null ? datos.texto : ""); // col D: texto
    }
    nueva[6] = datos.activo ? "SI" : "NO";
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `bot_plantillas!A${rowIndex}:H${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [nueva] },
    });
  }

  // Guarda un AJUSTE del bot (fila tipo "ajuste") en bot_plantillas. Si la fila
  // (por clave) existe, actualiza su valor (col D); si no, la crea. v18.82
  async function guardarAjusteBot(clave, valor, activo) {
    const sheets = getSheetsClient();
    clave = String(clave || "").trim();
    if (!clave) throw new Error("clave requerida");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
    });
    const rows = res.data.values || [];
    let rowIndex = -1, fila = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0] || "").trim() === clave) { rowIndex = i + 1; fila = rows[i]; break; }
    }
    if (rowIndex > 0) {
      const nueva = [];
      for (let c = 0; c < 8; c++) nueva[c] = (fila[c] != null ? fila[c] : "");
      nueva[0] = clave;
      nueva[3] = String(valor);
      if (!String(nueva[2]).trim()) nueva[2] = "ajuste";
      if (!String(nueva[6]).trim()) nueva[6] = "SI";
      if (activo !== undefined) nueva[6] = activo ? "SI" : "NO";
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: `bot_plantillas!A${rowIndex}:H${rowIndex}`,
        valueInputOption: "RAW", requestBody: { values: [nueva] },
      });
    } else {
      const nueva = [clave, "", "ajuste", String(valor), "", "", (activo === undefined ? "SI" : (activo ? "SI" : "NO")), "control de la pantalla Plantillas bot"];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS,
        valueInputOption: "RAW", requestBody: { values: [nueva] },
      });
    }
  }

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
  // Orden de presentación de los documentos (compartido por el menú de
  // impresión y la pantalla de plantillas) — decisión Guille:
  const ORDEN_DOCS = ["mantener_presion", "renunciar_presion", "usufructo", "piso_disidente", "contador_unico", "paso_instalaciones"];
  const _ordenDoc = c => { const i = ORDEN_DOCS.indexOf(c); return i === -1 ? 999 : i; };

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

  // v17.96: compone el campo "destinatario" del histórico juntando Para + CC + CCO
  // en una sola celda (decisión Guille: "todo junto"). Formato:
  //   "Para: a@x.com | CC: b@y.com | CCO: c@z.com"
  // Las partes vacías se omiten (si no hay CC, no sale "CC:"). Normaliza cada lista
  // (acepta separadores ||, coma, ;, saltos de línea) a "x, y". Si NO se pasan cc ni
  // cco (llamadas antiguas), devuelve solo el destinatario tal cual -> compatible.
  function _componerDestinatarioHist(dest, cc, cco) {
    const norm = (v) => {
      if (!v) return "";
      if (Array.isArray(v)) return v.filter(Boolean).join(", ");
      return String(v).split(/\|\||[\r\n,;]+/).map(s => s.trim()).filter(Boolean).join(", ");
    };
    const para = norm(dest);
    const ccN  = norm(cc);
    const ccoN = norm(cco);
    // Si no hay CC ni CCO, mantener el formato simple de siempre (solo el email).
    if (!ccN && !ccoN) return para;
    const partes = [];
    if (para) partes.push("Para: " + para);
    if (ccN)  partes.push("CC: " + ccN);
    if (ccoN) partes.push("CCO: " + ccoN);
    return partes.join(" | ");
  }

  async function registrarMailEnHistorico(datos) {
    // datos: { fecha, ccpp_id, direccion, fase, destinatario, cc, cco, asunto, mensaje, adjuntos, tipo, message_id }
    // cc y cco son OPCIONALES; si se pasan, se guardan junto al destinatario en la
    // misma celda (ver _componerDestinatarioHist). Si no, se guarda solo el destinatario.
    const sheets = getSheetsClient();
    const fila = [
      datos.fecha || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      _componerDestinatarioHist(datos.destinatario, datos.cc, datos.cco),
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

  // v18.35 — Registra un mail en mail_historico EVITANDO DUPLICADOS por message_id.
  // Un mail entrante tiene un Message-ID único e irrepetible. Si ese message_id YA
  // está en el histórico (porque el mail se clasificó antes, quizá a otro expediente),
  // en vez de AÑADIR otra fila (que es lo que duplicaba), se MUEVE la fila existente
  // al nuevo expediente: se actualiza la fila entera (ccpp_id, dirección, fase,
  // adjuntos, etc.) y, si por arrastres anteriores hubiera VARIAS filas con ese mismo
  // message_id, se conserva una sola (la primera) y se borran las demás. Si el
  // message_id está vacío o no existe en el histórico, hace el append normal.
  // datos: mismas claves que registrarMailEnHistorico.
  async function _reclasificarOInsertarHistorico(datos) {
    const mid = String(datos.message_id || "").trim();
    // Sin message_id no podemos identificar el mail de forma fiable -> insertar normal.
    if (!mid) { await registrarMailEnHistorico(datos); return; }
    const sheets = getSheetsClient();
    let rows = [];
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: RANGO_MAIL_HISTORICO,
      });
      rows = r.data.values || [];
    } catch (e) {
      // Si no podemos leer, caemos al append normal (mejor registrar que perder).
      console.error("[presupuestos] _reclasificar: no se pudo leer histórico:", e.message);
      await registrarMailEnHistorico(datos);
      return;
    }
    // Índices (0-based dentro de rows; en el Sheet es i+1) de las filas con ese message_id.
    const idx = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][9] || "").trim() === mid) idx.push(i);
    }
    if (idx.length === 0) { await registrarMailEnHistorico(datos); return; }
    // Construir la fila nueva (mismo formato que registrarMailEnHistorico). Conserva
    // la fecha original si la fila existente la tenía y datos no trae una distinta.
    const filaExistente = rows[idx[0]] || [];
    const filaNueva = [
      datos.fecha || filaExistente[0] || new Date().toISOString(),
      datos.ccpp_id || "",
      datos.direccion || "",
      datos.fase || "",
      _componerDestinatarioHist(datos.destinatario, datos.cc, datos.cco),
      datos.asunto || filaExistente[5] || "",
      datos.mensaje || filaExistente[6] || "",
      datos.adjuntos || "",
      datos.tipo || filaExistente[8] || "manual",
      mid,
    ];
    // 1) Actualizar la PRIMERA fila existente con los datos nuevos (mover el mail).
    const filaSheet = idx[0] + 1; // 1-based
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `mail_historico!A${filaSheet}:J${filaSheet}`,
      valueInputOption: "RAW",
      requestBody: { values: [filaNueva] },
    });
    // 2) Si había duplicados (≥2 filas con el mismo message_id), borrar las demás.
    //    Se borran de ABAJO hacia ARRIBA para que los índices no se desplacen.
    const sobrantes = idx.slice(1).map(i => i + 1).sort((a, b) => b - a); // 1-based, desc
    if (sobrantes.length) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const hoja = meta.data.sheets.find(s => s.properties.title === "mail_historico");
      if (hoja) {
        const sheetId = hoja.properties.sheetId;
        const requests = sobrantes.map(f => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: f - 1, endIndex: f },
          },
        }));
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID, requestBody: { requests },
        });
      }
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
    // v18.77: añadido bot_piso_activo (columna AV) para el switch del bot.
    const CAMPOS_PERMITIDOS = new Set(["en_hoy", "notas_piso", "nota_simple", "bot_piso_activo"]);
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
  // v18.71 — Listas de estados del conteo como FUENTE ÚNICA. Las usa _resumenManual
  // (servidor: HOY y ficha) y se inyectan en la página para que el JS cliente de
  // documentacion lea de aquí en vez de tener su propia copia. Cambiar la regla
  // aquí la cambia en los tres sitios a la vez.
  const _ESTADOS_IGNORA = ["OP", "NP", ""];                       // no cuentan ni en total ni en hechos
  const _ESTADOS_HECHO  = ["OK", "6", "12", "18", "FFCC", "IPREM"]; // cuentan como hechos
  const _SET_IGNORA = new Set(_ESTADOS_IGNORA);
  const _SET_HECHO  = new Set(_ESTADOS_HECHO);
  function _resumenManual(estados) {
    let hechos = 0, totalRel = 0;
    for (const raw of estados) {
      const e = (raw || "").trim();
      if (_SET_IGNORA.has(e)) continue;
      totalRel++;
      if (_SET_HECHO.has(e)) hechos++;
    }
    return { hechos, totalRel };
  }

  // v18.55 — Conjuntos para el filtro de docs por fase (IDÉNTICOS a documentacion.cjs
  // v17.38, para que el contador "Faltan X de Y" de la ficha y de HOY cuenten lo
  // mismo: son el mismo expediente). En modo 08/09/ZZ la fila CCPP/piso solo
  // cuenta contrato+pago; en modo 05/06/07 esos se ocultan y cuenta el resto.
  const _FASES_MODO_07 = new Set(["08_CYCP", "09_TRAMITADA", "ZZ_RECHAZADO", "ZZ_DESCARTADO"]);
  const _COD_CONTRATO_PAGO = new Set(["ccpp_contrato", "ccpp_pago", "piso_contrato", "piso_pago"]);

  // Devuelve los índices de docs VISIBLES (los que cuentan en el pill) según la
  // fase. estados/docs vienen alineados; docs[i].codigo identifica el documento.
  function _idxDocsVisibles(docs, fase) {
    const modo07 = _FASES_MODO_07.has((fase || "").trim());
    const idx = [];
    for (let i = 0; i < docs.length; i++) {
      const esCP = _COD_CONTRATO_PAGO.has(docs[i].codigo);
      if (modo07) { if (esCP) idx.push(i); }      // modo 08/09/ZZ: solo contrato+pago
      else        { if (!esCP) idx.push(i); }      // modo 05/06/07: todo menos contrato+pago
    }
    return idx;
  }

  // _resumenManual aplicado SOLO a los docs visibles para la fase dada.
  function _resumenFase(estados, docs, fase) {
    const idx = _idxDocsVisibles(docs, fase);
    return _resumenManual(idx.map(i => estados[i]));
  }

  // Cuenta "Faltan X de Y" para un expediente igual que la ficha: filas (CCPP +
  // pisos) con docs filtrados por fase; una fila sin docs pedidos (totalRel===0)
  // NO cuenta. Devuelve { totalFilas, pend }.
  function _contarFaltan(estadosCcpp, docsCcpp, pisos, docsPiso, fase) {
    let totalFilas = 0, completas = 0;
    const rC = _resumenFase(estadosCcpp, docsCcpp, fase);
    if (rC.totalRel > 0) { totalFilas++; if (rC.hechos >= rC.totalRel) completas++; }
    for (const p of pisos) {
      const r = _resumenFase(p.estados, docsPiso, fase);
      if (r.totalRel === 0) continue;
      totalFilas++;
      if (r.hechos >= r.totalRel) completas++;
    }
    return { totalFilas, pend: totalFilas > 0 ? (totalFilas - completas) : 0 };
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
  // Devuelve la fecha de aceptación del presupuesto / entrada en fase 05
  // (el día en que se pidió la documentación a la CCPP), en formato DD/MM/AAAA.
  // OJO AL NOMBRE (causa del bug histórico del "mail con la fecha en blanco"):
  // la columna V del Sheet se TITULA "fecha_decision_pto", pero el código la
  // mapea (en COLS) como `fecha_aceptacion_pto` y la lee/escribe SIEMPRE con ese
  // nombre. Por eso aquí el campo bueno es comu.fecha_aceptacion_pto (que es
  // donde de verdad llega el valor de esa columna). Antes este helper leía
  // comu.fecha_decision_pto —nombre que NO existe en el objeto comu— y por eso
  // devolvía vacío aunque el Sheet tuviera la fecha. Se deja fecha_decision_pto
  // como último fallback por pura red de seguridad, pero el que funciona es el
  // primero. Orden: (1) fecha del mail 05_ACEPTACION_PTO si se registró;
  // (2) fecha_aceptacion_pto (la columna V, sellada al aceptar o al "saltar");
  // (3) fecha_decision_pto por si acaso.
  function _fechaAceptacionPto(comu) {
    try {
      const ult = comu.mails_ultimo_envio ? JSON.parse(comu.mails_ultimo_envio) : {};
      const f = ult["05_ACEPTACION_PTO"] || comu.fecha_aceptacion_pto || comu.fecha_decision_pto || "";
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    } catch { return comu.fecha_aceptacion_pto || comu.fecha_decision_pto || ""; }
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
    // {{fecha_aceptacion_pto}} → VARIABLE OFICIAL (nombre lógico: coincide con la
    // fase 04-ACEPTACIÓN PTO). Es el día en que se aceptó el presupuesto / se pidió
    // la documentación a la CCPP (entrada en fase 05). La usan las plantillas
    // 05_FIN_DOC y 05_SEGUIMIENTO_DOC.
    if (/\{\{fecha_aceptacion_pto\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_aceptacion_pto\}\}/g, _fechaAceptacionPto(comu));
    }
    // {{fecha_decision_pto}} → ALIAS de la anterior (MISMA fecha, mismo helper).
    // Se mantiene por compatibilidad / red de seguridad: es como se titula la
    // columna V en el Sheet y como estaban escritas las plantillas antes de
    // unificar a {{fecha_aceptacion_pto}}. Si alguna plantilla aún lo usa, sigue
    // funcionando igual. NO es una fecha distinta: aceptacion_pto == decision_pto.
    if (/\{\{fecha_decision_pto\}\}/.test(t)) {
      t = t.replace(/\{\{fecha_decision_pto\}\}/g, _fechaAceptacionPto(comu));
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
      // {{fecha_envio_contratos_pagos}} → fecha guardada en col AZ, sellada el día
      // que el expediente entra en fase 08 (07->08). En el Sheet está en formato
      // YYYY-MM-DD; aquí la convertimos a DD/MM/AAAA. La usan las plantillas
      // 08_FIN_CYCP y 08_SEGUIMIENTO_CYCP, que se envían cuando el expediente ya
      // está en fase 08 (la fecha ya está sellada). Si por lo que sea estuviera
      // vacía, se sustituye por cadena vacía (no deja el {{...}} literal).
      .replace(/\{\{fecha_envio_contratos_pagos\}\}/g, () => {
        const f = comu.fecha_envio_contratos_pagos || "";
        const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return f; // si no es YYYY-MM-DD, devolver tal cual (o "" si vacío)
        return `${m[3]}/${m[2]}/${m[1]}`;
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
    // y rojo según F-final.
    //
    // v18.42: F-FINAL = fecha del PRIMER envío de la fase + di + dr×(mx-1).
    // Cambios respecto a la versión anterior:
    //   (a) FÓRMULA: antes di + dr×mx (un ciclo de más). Con mx envíos del cron,
    //       el ÚLTIMO cae en di + dr×(mx-1) (envíos en +di, +di+dr, +di+2dr...).
    //       Ej fase 04 (di=3,dr=30,mx=4): envíos +3,+33,+63,+93 -> último=+93=di+dr×3.
    //   (b) ANCLA: antes mails_ultimo_envio[fase] (se MUEVE con cada cron/ciclo).
    //       Ahora la fecha de ENTRADA a la fase (= primer envío, fija): para 04
    //       fecha_envio_pto, 05 fecha_aceptacion_pto, 08 fecha_envio_contratos_pagos.
    //       Para 01 no hay columna fiable -> fallback al primer dato disponible;
    //       si no hay ancla, no se pinta badge (regla: sin primer envío, sin badge).
    //   (c) EN VIVO: se calcula siempre desde la plantilla actual, NO se lee la
    //       columna BC congelada. Así un cambio de plantilla (di/dr/mx) reajusta
    //       el badge de TODOS los expedientes con un único criterio.
    const _anclaFase = {
      "01_CONTACTO": comu.fecha_solicitud_pto,
      "04_ACEPTACION_PTO": comu.fecha_envio_pto,
      "05_DOCUMENTACION": comu.fecha_aceptacion_pto,
      "08_CYCP": comu.fecha_envio_contratos_pagos,
    };
    let fechaAncla = (_anclaFase[fase] || "").toString().trim();
    if (!fechaAncla) {
      // Fallback: primer (= único conocido) envío registrado en la clave de la fase.
      let ultimo;
      try { ultimo = JSON.parse(comu.mails_ultimo_envio || "{}"); } catch (_) { ultimo = {}; }
      fechaAncla = (ultimo[fase] || "").toString().trim();
    }
    if (!fechaAncla) return null; // sin ancla -> sin badge
    const tAncla = Date.parse(fechaAncla);
    if (isNaN(tAncla)) return null;
    const fFinal = new Date(tAncla); fFinal.setHours(0, 0, 0, 0);
    const sumDias = di + dr * Math.max(0, mx - 1); // fórmula corregida
    fFinal.setDate(fFinal.getDate() + sumDias);
    const fechaLimiteIso = fFinal.toISOString().slice(0, 10);

    const fLim = fFinal; // ya normalizada a 00:00

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
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ptl-danger);font-weight:700;font-size:9px;line-height:1.15;overflow:hidden;padding:0 6px;text-align:center" title="${esc(motivoRech)}">
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
  function pageHtml(titulo, breadcrumbs, content, token, opts) {
    opts = opts || {};
    const bc = breadcrumbs && breadcrumbs.length > 1
      ? `<div class="ptl-breadcrumb">${breadcrumbs.map((b, i) => {
          if (i < breadcrumbs.length - 1)
            return `<a href="${esc(b.url)}">${esc(b.label)}</a><span class="ptl-sep">/</span>`;
          return `<span>${esc(b.label)}</span>`;
        }).join("")}</div>`
      : "";
    const homeUrl = urlT(token, "/presupuestos");
    // Cabecera unificada (estilo Plan 5): nombre de pantalla + hamburguesa con las pantallas reales.
    const _navTop = [
      ["LISTADO DE PRESUPUESTOS", urlT(token, "/presupuestos")],
      ["🗺️ MAPA", urlT(token, "/presupuestos/mapa")],
    ];
    const _navPlant = [
      ["📧 PLANTILLAS MAIL", urlT(token, "/presupuestos/plantillas")],
      ["📄 PLANTILLAS DOC", urlT(token, "/presupuestos/plantillas-doc")],
      ["🤖 FLUJO BOT", urlT(token, "/presupuestos/plantillas-bot-flujo")],
    ];
    const _plan5Item = (opts.expedienteId && (parseInt(opts.expedienteFase, 10) >= 3))
      ? `<a class="menu-item" href="${esc(urlT(token, "/plan5", { dir: opts.expedienteDir || "", id: opts.expedienteId }))}">📋 PRESUPUESTO PLAN 5</a>`
      : "";
    let _menuItems = _navTop.map(([t, u], _i) => `<a class="menu-item" href="${esc(u)}">${esc(t)}</a>` + (_i === 0 ? _plan5Item : "")).join("")
      + `<div class="menu-sep"></div>`
      + _navPlant.map(([t, u]) => `<a class="menu-item menu-item-sm" href="${esc(u)}">${esc(t)}</a>`).join("");
    return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(titulo)} · Araujo Presupuestos</title>
  <style>${getThemeCss()}${CSS}</style>
  <style>
    .ptl-nav-search{flex:0 1 440px;min-width:0}
    .ptl-nav-search .ptl-search-input{width:100%}
    @media (max-width:640px){
      .ptl-nav{position:relative;flex-wrap:nowrap}
      .ptl-nav-search{flex:0 0 auto}
      .ptl-nav-search .ptl-search-input{display:none}
      .ptl-search-icon{cursor:pointer}
      .ptl-nav-search.ptl-search-open{position:static}
      .ptl-nav-search.ptl-search-open .ptl-search-input{display:block;position:absolute;left:8px;right:8px;top:100%;width:auto;margin-top:4px;z-index:60}
    }
  </style>
</head><body>
  <nav class="ptl-nav">
    <a href="${homeUrl}" class="ptl-nav-brand ptl-nav-brand-fix">
      <div class="ptl-logo">A</div>
      <div class="ptl-nav-text"><strong>Araujo Presupuestos</strong><span class="ptl-nav-screen">${esc(titulo)}</span></div>
    </a>
    ${opts.search ? `<div class="ptl-search-wrap ptl-nav-search"><span class="ptl-search-icon" onclick="ptlAbrirBuscador(this)">🔍</span><input class="ptl-search-input" id="ptl-buscador-comun" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(opts.searchValue||'')}" autocomplete="off" oninput="ptlFiltrarComun()"/></div>` : ''}
    <span class="ptl-nav-spacer"></span>
    ${opts.undo ? `<button id="ptlBtnUndo" class="menu-btn hdr-undo" type="button" onclick="ptlUndo()" title="Deshacer" disabled>↶</button><button id="ptlBtnRedo" class="menu-btn hdr-undo" type="button" onclick="ptlRedo()" title="Rehacer" disabled>↷</button>` : ''}
    ${opts.cron ? `<button id="ptl-btn-cron-manual" class="menu-btn hdr-cron" type="button" title="Ejecutar cron">⚡</button>` : ''}
    <button class="menu-btn hdr-reload" type="button" onclick="location.reload(true)" title="Recargar (Ctrl+F5)">🔄</button>
    <a class="menu-btn hdr-hoy" href="${urlT(token, "/presupuestos/hoy")}" title="HOY">⏰</a>
    <div class="menu-wrap">
      <button id="ptlMenuBtn" class="menu-btn" type="button" aria-label="Menú">&#9776;</button>
      <div id="ptlMenuList" class="menu-list" hidden>${_menuItems}</div>
    </div>
  </nav>
  <div class="ptl-page">
    ${content}
  </div>
  <script>function ptlAbrirBuscador(ic){var w=ic.closest('.ptl-nav-search');if(!w)return;var open=w.classList.toggle('ptl-search-open');if(open){var i=w.querySelector('.ptl-search-input');if(i)i.focus();}}(function(){var b=document.getElementById('ptlMenuBtn'),l=document.getElementById('ptlMenuList');if(b&&l){b.addEventListener('click',function(e){e.stopPropagation();l.hidden=!l.hidden;});document.addEventListener('click',function(e){if(e.target!==b&&!l.contains(e.target))l.hidden=true;});}})();</script>
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
    }
    // v18.41: ELIMINADO el fallback a comu.fecha_ultimo_seguimiento_pto que
    // existía aquí (gemelo del fallback del cron). Tras la siembra de la clave 04
    // (cambio en /enviar-mail), un expediente "en_curso" SIEMPRE tiene
    // fechaUltimo en su clave, así que la rama de fallback era además código
    // muerto. Coherencia total: si el cron no va a disparar (clave 04 vacía),
    // el indicador no debe inventar una fecha de "próximo" -> mostraría
    // "pendiente", pero en realidad ese caso ya devuelve "no iniciado" antes.
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
      const fechaPteCobroFila = String(c.fecha_pte_cobro || "").trim();
      // v18.49 — badge de estado para TODA la fase 09 (3 estados, mismas clases
      // que el resto): Cobrado (en-plazo/verde) > Pte. cobro (decidir/ambar) >
      // En ejecucion (ejecucion/azul claro). Antes solo salia el de Cobrada.
      let badgeCobroInner = "";
      if (faseFila === "09_TRAMITADA") {
        if (/^\d{4}-\d{2}-\d{2}/.test(fechaCobroFila)) {
          const fLab = formatearFechaDDMMYYYY(fechaCobroFila);
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-en-plazo" title="Cobrado el ${esc(fLab)}">💶 Cobrado</span>`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(fechaPteCobroFila)) {
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-decidir" title="Obra terminada, pendiente de cobro">⏳ Pte. cobro</span>`;
        } else {
          badgeCobroInner = `<span class="ptl-fila-badge ptl-fila-badge-ejecucion" title="Obra en ejecucion">🔨 En ejecución</span>`;
        }
      }
      return `
      <a href="${urlT(token, "/presupuestos/expediente", { id: c.ccpp_id })}" class="ptl-fila">
        <div class="ptl-fila-info" title="${esc(((c.tipo_via || '') + ' ' + (c.direccion || c.comunidad || '—')).trim())}">
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
        searchInHeader: true,
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
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a la fase en la que estaba antes de descartarlo (o a 01-CONTACTO si no consta).')">↻ Reactivar expediente</button>
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
            <button type="submit" class="ptl-btn ptl-btn-primary ptl-btn-sm" onclick="return confirm('¿Reactivar el expediente? Volverá a la fase en la que estaba antes de descartarlo (o a 01-CONTACTO si no consta).')">↻ Reactivar expediente</button>
          </form>
          <form method="POST" action="${urlT(token, "/presupuestos/expediente/eliminar")}" style="display:inline">
            <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
            <button type="submit" class="ptl-btn ptl-btn-danger ptl-btn-sm" onclick="return confirm('¿Eliminar definitivamente este expediente? Esta acción NO se puede deshacer.')">🗑 ELIMINAR</button>
          </form>
        </div>
      </div>`;
    } else if (fase === "09_TRAMITADA") {
      // v18.48: fase terminal con TRES estados, calculados por DOS fechas:
      //   - sin fecha_pte_cobro y sin fecha_cobro  -> En ejecucion (obra en curso)
      //   - con fecha_pte_cobro y sin fecha_cobro  -> Pendiente de cobro (obra fin)
      //   - con fecha_cobro                         -> Cobrado
      // Dos cajitas de fecha (PTE COBRO + COBRADO), mismo estilo que el resto.
      // fecha_cobro (BE) ya existia; fecha_pte_cobro (BH) es nueva.
      const fco = comu.fecha_cobro || '';
      const fpc = comu.fecha_pte_cobro || '';
      // v18.50 — el estado se muestra como BADGE (mismas clases que el resto de
      // fases), no como texto plano: Cobrado=en-plazo(verde), Pendiente=decidir
      // (ambar), En ejecucion=ejecucion(azul claro).
      let estado09Cls, estado09Txt;
      if (fco) {
        estado09Cls = 'ptl-fila-badge-en-plazo';
        estado09Txt = '💶 Cobrado el ' + esc(formatearFechaDDMMYYYY(fco));
      } else if (fpc) {
        estado09Cls = 'ptl-fila-badge-decidir';
        estado09Txt = '⏳ Pendiente de cobro desde ' + esc(formatearFechaDDMMYYYY(fpc));
      } else {
        estado09Cls = 'ptl-fila-badge-ejecucion';
        estado09Txt = '🔨 En ejecución';
      }
      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          <div class="ico" style="color:var(--ptl-success)">✓</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span>09-TRAMITADO</span>
            <div style="margin-top:4px"><span class="ptl-fila-badge ${estado09Cls}">${estado09Txt}</span></div>
          </div>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha en que la obra TERMINA y queda pendiente de cobrar. Dejala vacia mientras la obra esta en ejecucion.">
          <span class="ln ptl-label-mini">Pte cobro</span>
          <input type="date" id="ptl-mini-fecha-pte-cobro" value="${esc(fpc)}"
            onchange="ptlSyncFechaPteCobro(this.value)"
            class="ptl-input-num"/>
        </div>
        <div class="ptl-btn ptl-btn-secondary ptl-btn-mail-3l ptl-mini-fecha" title="Fecha en que se cobro la obra al cliente. Dejala vacia si todavia no se ha cobrado.">
          <span class="ln ptl-label-mini">Cobrado</span>
          <input type="date" id="ptl-mini-fecha-cobro" value="${esc(fco)}"
            onchange="ptlSyncFechaCobro(this.value)"
            class="ptl-input-num"/>
        </div>
      </div>
      <script>
        (function(){
          async function _ptlGuardarFecha09(campo, v) {
            try {
              const fd = new URLSearchParams();
              fd.append('id', ${JSON.stringify(comu.ccpp_id)});
              fd.append('campo', campo);
              fd.append('valor', v || '');
              const r = await fetch(${JSON.stringify(urlT(token, "/presupuestos/expediente/campo"))}, { method: 'POST', body: fd });
              if (r.ok) {
                window.ptlRecargaLimpia();
              } else {
                alert('Error guardando la fecha: ' + r.status);
              }
            } catch (e) {
              alert('Error de red: ' + e.message);
            }
          }
          window.ptlSyncFechaCobro    = function(v){ _ptlGuardarFecha09('fecha_cobro', v); };
          window.ptlSyncFechaPteCobro = function(v){ _ptlGuardarFecha09('fecha_pte_cobro', v); };
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
          infoEnvioAuto04Html = `<div class="sub">${esc(info.texto)}</div>`;
        }
      } catch (e) { /* si falla la lectura de plantilla, no se pinta el indicador */ }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span class="ptl-fase-titulo">${esc(labelFase04)}</span>
            ${infoEnvioAuto04Html}
            <div style="margin-top:4px">${renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha))}</div>
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
        <div style="background:var(--ptl-general-flotante);border-radius:8px;padding:20px;max-width:480px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2)">
          <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:var(--ptl-danger-dark)">✕ Rechazar presupuesto</h3>
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
              window.ptlRecargaLimpia(); // v18.36 — recarga limpia (NO reload)
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
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
              onclick="ptlAbrirModalMail('05_FIN_DOC', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de fin de documentación. Al confirmar, también pasa a fase 06-VISITA EMASESA.">${esc(labelSigDoc)}</button>`;
        } else if (fase === "07_PTE_CYCP") {
          // Al pulsar "→ Paso a 08-CYCP" se abre el modal del mail
          // 08_INICIO_CYCP. El avance a fase 08 lo hace el endpoint /enviar-mail
          // al confirmar el envío (caso especial avanzadoA08).
          botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
              onclick="ptlAbrirModalMail('08_INICIO_CYCP', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para enviar el mail de inicio de fase 08-CYCP (solicitud de contratos firmados y pagos). Al confirmar, también pasa a fase 08-CYCP.">${esc(labelSigDoc)}</button>`;
        } else {
          botonAvanzarHtml = `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-avanzar ptl-btn-sm">${esc(labelSigDoc)}</button>
            </form>`;
        }
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        // Cierre de fase 08: abre modal del mail 08_FIN_CYCP. El cierre real
        // (fecha_cycp_completa = hoy) lo hace el endpoint /enviar-mail al
        // confirmar el envío (caso especial cerradoFase08). El endpoint
        // legacy /cerrar-cycp se mantiene por compatibilidad pero ya no se
        // usa desde la UI.
        botonAvanzarHtml = `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
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
            infoEnvioAutoDocHtml = `<div class="sub">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla */ }
      } else if (fase === "08_CYCP" && !comu.fecha_cycp_completa) {
        try {
          const plantilla08 = await leerPlantillaMail("08_SEGUIMIENTO_CYCP");
          const info = calcularInfoEnvioAuto(comu, "08_CYCP", plantilla08);
          if (info.texto) {
            infoEnvioAutoDocHtml = `<div class="sub">${esc(info.texto)}</div>`;
          }
        } catch (e) { /* sin indicador si falla */ }
      }

      accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
        <div class="ptl-na-left">
          ${btnRetrocederHtml}
          <div class="ico">→</div>
          <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
            <span class="ptl-fase-titulo">${esc(labelFaseDoc)}</span>
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
            infoEnvioAutoHtml = `<div class="sub">${esc(info.texto)}</div>`;
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
              <span class="ptl-fase-titulo">${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
            </div>
          </div>
          <div class="ptl-na-right ptl-na-igual-altura">
            <button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm ptl-btn-enviar-avanzar"
              onclick="ptlIntentarEnviarFase03('${esc(fase)}', '${esc(comu.ccpp_id)}')"
              title="Abre el modal para revisar y enviar el presupuesto. Al confirmar, también pasa a fase 04-ACEPTACION PTO.">
              <span class="ln">📧 Enviar presupuesto</span>
              <span class="ln">Y paso a 04-ACEPTACION PTO</span>
            </button>
          </div>
        </div>`;
      } else {
        accionHtml = `<div class="ptl-next-action ptl-next-action-grid">
          <div class="ptl-na-left">
            ${btnRetrocederHtml}
            <div class="ico">→</div>
            <div class="text" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2">
              <span class="ptl-fase-titulo">${esc(labelFaseActual)}</span>
              ${infoEnvioAutoHtml}
              <div style="margin-top:4px">${renderBadgePlazo(calcularEstadoPlazo(comu, plantillaFichaActual, f1MapFicha))}</div>
            </div>
          </div>
          ${btnMailHtml || miniBloqueHtml || '<div></div>'}
          <div class="ptl-na-right ptl-na-igual-altura">
            ${ fase === "01_CONTACTO"
              ? `<button type="button" class="ptl-btn ptl-btn-avanzar ptl-btn-sm"
                  onclick="ptlPreguntarActaPaso02('${esc(comu.ccpp_id)}')"
                  title="Pregunta si han enviado el acta y abre el modal del mail correspondiente. Al confirmar, también pasa a fase 02-VISITA (pendiente de visita).">${esc(labelSig)}</button>`
              : `<form method="POST" action="${urlT(token, "/presupuestos/expediente/avanzar")}" style="display:inline">
              <input type="hidden" name="id" value="${esc(comu.ccpp_id)}"/>
              <button type="submit" class="ptl-btn ptl-btn-avanzar ptl-btn-sm">${esc(labelSig)}</button>
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
    // Si el expediente tiene Plan 5, los importes "previstos" (PTO total, tiempo,
    // mano de obra y material) los manda el boton Congelar -> en la ficha se
    // muestran BLOQUEADOS (gris calc-field), no se editan a mano. (sesion 27/06)
    const tienePlan5 = await _expedienteTienePlan5(comu);
    const previstoEditable = !tienePlan5 && !["01_CONTACTO","02_VISITA","ZZ_RECHAZADO","ZZ_DESCARTADO"].includes(fasePtl);
    // Los campos "real" se desbloquean SOLO en fase 09_TRAMITADA; bloqueados en
    // 01-08 (cambio sesion 07/06/2026: antes se abrian en 08_CYCP).
    const realEditable = (fasePtl === "09_TRAMITADA");
    const roPrevisto = !previstoEditable;
    const roReal = !realEditable;

    const expDataJson = JSON.stringify({
      direccion: comu.direccion || "", comunidad: comu.comunidad || "", tipo_via: comu.tipo_via || "", earth: comu.earth || "",
      poblacion: comu.poblacion || "", cp: comu.cp || "",
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

        <div class="ptl-card ptl-card-compact" style="padding:6px 12px">
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
              <label class="ptl-form-label">Tipo via</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" value="${esc(comu.tipo_via || '')}" data-orig="${esc(comu.tipo_via || '')}" placeholder="C" autocomplete="off"/>
              </div>
            </div>
            <div class="col-6">
              <label class="ptl-form-label">Direccion</label>
              <input name="direccion" value="${esc(comu.direccion || '')}" data-orig="${esc(comu.direccion || '')}" style="width:100%"/>
            </div>
            <div class="col-3">
              <label class="ptl-form-label">Poblacion</label>
              <input name="poblacion" value="${esc(comu.poblacion || '')}" data-orig="${esc(comu.poblacion || '')}" style="width:100%"/>
            </div>
            <div class="col-2">
              <label class="ptl-form-label">CP</label>
              <input name="cp" value="${esc(comu.cp || '')}" data-orig="${esc(comu.cp || '')}" style="width:100%"/>
            </div>
            <!-- v18.03: "Comunidad (clave)" se oculta de la vista (no se edita aquí;
                 la usa el bot de WhatsApp y pestañas vecinos_base/expedientes). Se
                 mantiene como hidden para no perder el dato al guardar la fila. -->
            <input type="hidden" name="comunidad" value="${esc(comu.comunidad || '')}" data-orig="${esc(comu.comunidad || '')}"/>
          </div>

          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Administrador</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" value="${esc(comu.administrador || '')}" data-orig="${esc(comu.administrador || '')}" autocomplete="off"/>
              </div>
            </div>
            ${inp("telefono_administrador", fmtTlf(comu.telefono_administrador), { col: 2, type: "tel", label: "Telefono" })}
            ${inp("email_administrador",    comu.email_administrador, { col: 4, type: "email", label: "Email" })}
          </div>

          <div class="ptl-form-grid" style="gap:2px 6px">
            <div class="col-6">
              <label class="ptl-form-label">Presidente</label>
              <input name="presidente" value="${esc(comu.presidente || '')}" data-orig="${esc(comu.presidente || '')}" autocomplete="off"/>
            </div>
            ${inp("telefono_presidente", fmtTlf(comu.telefono_presidente), { col: 2, type: "tel", label: "Telefono" })}
            ${inp("email_presidente",    comu.email_presidente, { col: 4, type: "email", label: "Email" })}
          </div>
        </div>

        ${["01_CONTACTO","02_VISITA","03_ENVIO_PTO","04_ACEPTACION_PTO"].includes(fase) ? `<div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="ptl-card-title" style="margin:0">Notas</div>
            <button type="button"
                    class="ptl-vec-btn ptl-exp-reloj ${(String(comu.en_hoy || '').trim() === '1') ? 'ptl-btn-reloj' : 'ptl-btn-reloj-off'}"
                    data-ccpp-id="${esc(comu.ccpp_id || '')}"
                    data-enhoy="${(String(comu.en_hoy || '').trim() === '1') ? '1' : '0'}"
                    title="${(String(comu.en_hoy || '').trim() === '1') ? 'Quitar de HOY' : 'Añadir a HOY'}">⏰</button>
          </div>
          <textarea name="notas_pto" data-orig="${esc(comu.notas_pto || '')}" rows="1" autocomplete="off" class="ptl-input-modal ptl-textarea-grow" style="resize:vertical;overflow:hidden">${esc(comu.notas_pto || '')}</textarea>
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
            /* v18.24 — el texto de las filas va sobre fondo blanco/gris (zebra),
               así que NO hereda el azul claro de la caja: se fuerza a NEGRO. */
            .ptl-com-list{color:var(--ptl-gray-900)}
            .ptl-com-list .ptl-vec-btn{width:18px;height:18px;font-size:9px}
            .ptl-com-list .ptl-com-grid{padding:0 6px;line-height:1.1}
            .ptl-com-list .ptl-com-row:nth-child(even){background:var(--ptl-general-2)}
            .ptl-com-list .ptl-com-row:nth-child(odd){background:var(--ptl-general-3)}
            .ptl-com-list .hoy-asunto-clic:hover{color:#000;font-weight:700}
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
              if (t.startsWith("manual") || t === "reenvio_fase04") return { label: "Manual", cls: "ptl-fila-badge-neutro" };
              if (t === "automatico") return { label: "Automático", cls: "ptl-fila-badge-success" };
              return { label: t || "—", cls: "ptl-fila-badge-neutro" };
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
                ? `<button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-hoy ${enHoy ? 'ptl-btn-reloj' : 'ptl-btn-reloj-off'}" data-mid="${esc(mid)}" data-enhoy="${enHoy ? '1' : '0'}" title="${enHoy ? 'Quitar de HOY' : 'Añadir a HOY'}">⏰</button>`
                : `<span class="ptl-vec-btn" style="visibility:hidden">⏰</span>`;
              // Datos para Responder/Reenviar (los pasamos al JS por data-*).
              // El cuerpo puede ser largo: lo codificamos en base64 para evitar
              // problemas con saltos de línea y comillas dentro del HTML.
              const cuerpoB64 = Buffer.from(String(m.mensaje || ""), "utf8").toString("base64");
              const asuntoB64 = Buffer.from(String(m.asunto || ""), "utf8").toString("base64");
              // v17.96: el campo destinatario del histórico puede venir en formato
              // nuevo "Para: x | CC: y | CCO: z" (todo junto) o en formato antiguo
              // (solo el email). Para el botón Responder necesitamos SOLO el email del
              // "Para" (no queremos meter CC/CCO ni la etiqueta como destinatario).
              const _soloPara = (txt) => {
                const s = String(txt || "");
                const m1 = s.match(/Para:\s*([^|]+)/i);   // formato nuevo
                if (m1) return m1[1].trim();
                // formato antiguo: si por si acaso trae " | CC:..." sin "Para:", corta antes del primer "|"
                return s.split("|")[0].trim();
              };
              const destB64   = Buffer.from(_soloPara(m.destinatario), "utf8").toString("base64");
              const dataRR = `data-fecha="${esc(m.fecha)}" data-dest="${destB64}" data-asunto="${asuntoB64}" data-cuerpo="${cuerpoB64}" data-entrante="${entrante ? '1' : '0'}" data-adjuntos="${esc(m.adjuntos || '')}" data-mid="${esc(mid)}"`;
              return `
                <div class="ptl-com-row" data-idx="${idx}" style="border-bottom:1px solid var(--ptl-gray-100)">
                  <div class="ptl-com-grid" style="display:grid;grid-template-columns:90px 18px 78px 1fr 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px">
                    <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${esc(fechaTxt)}</div>
                    <div style="text-align:center;color:${colorFlecha};font-weight:600">${flecha}</div>
                    <div style="text-align:center"><span class="ptl-fila-badge ${cat.cls}">${esc(cat.label)}</span></div>
                    <div class="hoy-asunto-clic ptl-com-toggle" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-900)" title="${esc(m.asunto || '')}">${asuntoHtml}</div>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-responder" ${dataRR} title="Responder" style="color:var(--ptl-brand);font-weight:bold">↩</button>
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon ptl-com-reenviar" ${dataRR} title="Reenviar" style="color:var(--ptl-brand);font-weight:bold">↪</button>
                    ${btnReloj}
                    <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar ptl-com-delete" ${dataAttrs} title="Borrar este registro">✕</button>
                  </div>
                  <div class="ptl-com-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
                    <div style="margin-bottom:4px"><strong>${labelDest}:</strong> ${esc(destTxt)}</div>
                    <div style="margin-bottom:4px"><strong>Plantilla:</strong> ${esc(fasePlantilla)}</div>
                    <div style="margin-bottom:4px"><strong>Mensaje:</strong></div>
                    <div style="white-space:pre-line;word-break:break-word;background:var(--ptl-general-3);padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800)">${_renderCuerpoMail(cuerpo, esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
                    ${renderAdjuntos(m.adjuntos)}
                  </div>
                </div>
              `;
            }).join("");
            return `
              <div class="ptl-com-list" id="ptlComList" style="border:1px solid var(--ptl-gray-200);border-radius:5px;background:var(--ptl-general-3)">
                ${filas}
              </div>
              <script>(function(){function f(){var el=document.getElementById('ptlComList');if(el)el.scrollTop=el.scrollHeight;}if(document.readyState!=='loading'){requestAnimationFrame(f);}else{document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(f);});}})();</script>
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
                <label class="ptl-form-label">Asunto</label>
                <input type="text" id="ptlComSasunto" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">Destinatario (email)</label>
                <input type="text" id="ptlComSdest" placeholder="ejemplo@dominio.com" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">CC (opcional)</label>
                <input type="text" id="ptlComScc" placeholder="separar con coma" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">CCO (opcional)</label>
                <input type="text" id="ptlComScco" placeholder="separar con coma" class="ptl-input-modal"/>
              </div>
              <div>
                <label class="ptl-form-label">Cuerpo del mensaje</label>
                <textarea id="ptlComScuerpo" rows="10" style="width:100%;padding:6px;border:1.5px solid var(--ptl-gray-200);border-radius:5px;font-family:inherit;font-size:12px;resize:vertical"></textarea>
              </div>
              <div>
                <label class="ptl-form-label">Adjuntos (links de Drive, hasta 3)</label>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj1url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
                  </div>
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj2lbl" placeholder="Etiqueta" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj2url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
                  </div>
                  <div style="display:flex;gap:6px">
                    <input type="text" id="ptlComSadj3lbl" placeholder="Etiqueta" class="ptl-input-modal" style="flex:0 0 200px;width:auto"/>
                    <input type="text" id="ptlComSadj3url" placeholder="https://drive.google.com/..." class="ptl-input-modal" style="flex:1;width:auto"/>
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
            // v18.39 — window.ptlRecargaLimpia se define AQUÍ (script global que
            // SIEMPRE se renderiza, sea cual sea la fase del expediente). En
            // v18.36 quedó por error dentro del bloque "else if (fase ===
            // '09_TRAMITADA')" -> en cualquier otra fase la función no
            // existía y los handlers que la llaman (envío de mail manual,
            // borrar mail, rechazar, toggle-HOY, avanzar fase, fecha cobro)
            // reventaban con "ptlRecargaLimpia is not a function" (caso real
            // 27/05: Arcangel San Miguel 6 en fase 02).
            //
            // QUÉ HACE: location.replace(href) fuerza carga FRESCA sin la
            // form-restoration del navegador (que en location.reload()
            // restaura los inputs cacheados y puede dejar vacíos campos
            // económicos -> ptlGuardar los escribe vacíos al salir ->
            // PÉRDIDA DE DATOS). Marca window.ptlReloading para que el
            // beforeunload no muestre el aviso de salida.
            window.ptlRecargaLimpia = window.ptlRecargaLimpia || function(){
              window.ptlReloading = true;
              location.replace(location.href);
            };
            // Sondeo del estado de un envío encolado (envío asíncrono anti-cuelgue).
            // Resuelve {ok:true, payload} cuando el servidor terminó el envío, o
            // {ok:false, payload} si dio error. Rechaza con Error('TIMEOUT') si tras
            // 3 min no hay respuesta (el mail puede haber salido igual: el usuario
            // refresca y comprueba en COMUNICACIONES antes de reenviar).
            window.ptlSondearEnvio = window.ptlSondearEnvio || function(envioId){
              return new Promise(function(resolve, reject){
                var base = '${urlT(token, "/presupuestos/expediente/envio-estado")}';
                var t0 = Date.now();
                var MAX = 3 * 60 * 1000;
                function tick(){
                  fetch(base + '&envioId=' + encodeURIComponent(envioId))
                    .then(function(r){ return r.json(); })
                    .then(function(j){
                      if (j.estado === 'ok') { resolve({ ok:true, status:j.status, isJson:j.isJson, payload:j.payload }); return; }
                      if (j.estado === 'error' || j.estado === 'error_http') { resolve({ ok:false, status:j.status, isJson:j.isJson, payload:j.payload }); return; }
                      if (Date.now() - t0 > MAX) { reject(new Error('TIMEOUT')); return; }
                      setTimeout(tick, 1500);
                    })
                    .catch(function(){
                      // Red intermitente: reintentar hasta el tope.
                      if (Date.now() - t0 > MAX) { reject(new Error('TIMEOUT')); return; }
                      setTimeout(tick, 1500);
                    });
                }
                tick();
              });
            };
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
                // Acordeon: cerrar TODOS los detalles antes de abrir el clicado
                document.querySelectorAll('.ptl-com-detail').forEach(d => { d.style.display = 'none'; });
                // Si el clicado estaba cerrado, abrirlo; si estaba abierto, queda cerrado
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
                  window.ptlRecargaLimpia(); // v18.36 — recarga limpia (NO reload)
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
                  // v18.34/v18.36 — recarga limpia (NO reload): evita que la
                  // restauración de formulario del navegador descuadre los inputs
                  // (cambio fantasma / borrado de datos al salir). Unificado en
                  // window.ptlRecargaLimpia (location.replace + ptlReloading).
                  window.ptlRecargaLimpia();
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
                  '<div id="ptlDocBox" style="position:fixed;top:8%;left:50%;transform:translateX(-50%);width:560px;max-width:94vw;max-height:86vh;background:var(--ptl-general-flotante);border:1px solid var(--ptl-gray-300);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden">'
                  + '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--ptl-warning-light);padding:10px 14px;border-bottom:1px solid var(--ptl-warning-light)">'
                  + '<strong style="color:var(--ptl-warning-dark)">📄 ' + escH(titulo) + '</strong>'
                  + '<button type="button" id="ptlDocClose" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--ptl-warning-dark);line-height:1">✕</button>'
                  + '</div>'
                  + '<div id="ptlDocBody" style="padding:14px;overflow-y:auto">' + contenidoHtml + '</div>'
                  + '</div>';
                document.body.appendChild(wrap);
                document.getElementById('ptlDocClose').addEventListener('click', cerrar);
              }

              // ---- PASO 1: menú de documentos + piso ----
              async function abrirMenu(){
                crearVentana('Imprimir documentos', '<div style="text-align:center;color:var(--ptl-gray-500);padding:20px">Cargando…</div>');
                let data;
                try {
                  const r = await fetch(URL_MENU + '&id=' + encodeURIComponent(CCPP_ID));
                  data = await r.json();
                  if (!r.ok) throw new Error(data.error || 'Error');
                } catch(e){
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:var(--ptl-danger)">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.menu = data;
                pintarMenu();
              }

              function pintarMenu(){
                const data = estado.menu;
                let html = '<div style="font-size:13px;color:var(--ptl-gray-700);margin-bottom:10px">Expediente: <strong>' + escH(data.comunidad) + '</strong></div>';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:6px">Marca los documentos a imprimir:</div>';
                html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
                data.documentos.forEach(d => {
                  const et = d.tipo === 'particular' ? ' <span style="font-size:11px;color:var(--ptl-warning-dark)">(de un piso)</span>' : ' <span style="font-size:11px;color:var(--ptl-gray-500)">(general)</span>';
                  html += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">'
                       + '<input type="checkbox" class="ptlDocChk" value="' + escH(d.clave) + '" data-tipo="' + escH(d.tipo) + '"/>'
                       + '<span>' + escH(d.titulo) + et + '</span></label>';
                });
                html += '</div>';
                // Selector de piso (solo si hay pisos). Se mostrará/ocultará según haga falta.
                html += '<div id="ptlDocPisoWrap" style="display:none;margin-bottom:12px">';
                html += '<div style="font-weight:600;font-size:13px;margin-bottom:4px">Piso (para los documentos de un piso):</div>';
                if (data.pisos && data.pisos.length){
                  html += '<select id="ptlDocPiso" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:13px">';
                  html += '<option value="">— Elige un piso —</option>';
                  data.pisos.forEach(p => {
                    const etq = p.vivienda + (p.propietario ? ' · ' + p.propietario : '');
                    html += '<option value="' + escH(p.vivienda) + '">' + escH(etq) + '</option>';
                  });
                  html += '</select>';
                } else {
                  html += '<div style="font-size:12px;color:var(--ptl-danger)">Este expediente no tiene pisos cargados. Los documentos de un piso saldrán con los datos en blanco.</div>';
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
                document.getElementById('ptlDocBody').innerHTML = '<div style="text-align:center;color:var(--ptl-gray-500);padding:20px">Cargando datos…</div>';
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
                  document.getElementById('ptlDocBody').innerHTML = '<div style="color:var(--ptl-danger)">Error: ' + escH(e.message) + '</div>';
                  return;
                }
                estado.campos = data.campos || [];
                let html = '<div style="font-size:13px;color:var(--ptl-gray-700);margin-bottom:10px">Revisa los datos. Los precargados puedes corregirlos; los vacíos puedes rellenarlos o dejarlos en blanco para rellenar a mano.</div>';
                if (estado.campos.length === 0){
                  html += '<div style="font-size:12px;color:var(--ptl-gray-500);margin-bottom:10px">Estos documentos no tienen datos que rellenar.</div>';
                }
                html += '<div style="border:1px solid var(--ptl-gray-200);border-radius:8px;padding:10px;margin-bottom:10px">';
                estado.campos.forEach(c => {
                  html += '<label style="display:block;font-size:12px;margin-bottom:8px">'
                       + '<span style="display:block;color:var(--ptl-gray-700);margin-bottom:2px">' + escH(c.label) + (c.manual ? ' <span style="color:var(--ptl-gray-400)">(a mano)</span>' : '') + '</span>'
                       + '<input type="text" data-hueco="' + escH(c.clave) + '" value="' + escH(c.valor) + '" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:13px"/>'
                       + '</label>';
                });
                html += '</div>';
                html += '<div style="display:flex;justify-content:space-between;gap:8px">'
                     + '<button type="button" id="ptlDocAtras" class="ptl-btn" style="padding:6px 14px;background:var(--ptl-gray-100);border:1px solid var(--ptl-gray-300)">← Atrás</button>'
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
            // v17.95: al abrir el compositor EN BLANCO desde el botón "Enviar mail
            // manual", precargamos el pie/firma global (igual que ya hacían Responder
            // y Reenviar). Escribes arriba y el pie queda debajo; el cursor se coloca
            // arriba del todo. No se toca sAbrir() (compartido) para no duplicar el pie
            // en responder/reenviar, que ya lo ponen ellos al sobrescribir el cuerpo.
            function sAbrirNuevo() {
              sAbrir();
              sCu.value = '\\n\\n' + (PIE_GLOBAL ? PIE_GLOBAL : '');
              setTimeout(() => { sCu.focus(); sCu.setSelectionRange(0, 0); }, 100);
            }
            if (sBtn) sBtn.addEventListener('click', sAbrirNuevo);
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
              const envioId = 'e' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
              try {
                const body = new URLSearchParams({
                  envioId: envioId,
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
                const d0 = await res.json().catch(() => null);
                if (d0 && d0.encolado) {
                  const r = await window.ptlSondearEnvio(envioId);
                  if (!r.ok) {
                    const t = (typeof r.payload === 'string') ? r.payload
                            : ((r.payload && r.payload.error) || ('HTTP ' + (r.status || '?')));
                    alert('No se pudo enviar:\\n\\n' + t);
                    sSend.disabled = false;
                    sSend.textContent = '📧 Enviar';
                    return;
                  }
                  // v18.36 — recarga limpia (NO reload).
                  window.ptlRecargaLimpia();
                  return;
                }
                // Compat síncrono (sin encolar).
                if (!res.ok) {
                  const t = (d0 && typeof d0 === 'object') ? JSON.stringify(d0) : await res.text();
                  alert('No se pudo enviar:\\n\\n' + t);
                  sSend.disabled = false;
                  sSend.textContent = '📧 Enviar';
                  return;
                }
                window.ptlRecargaLimpia();
              } catch(e) {
                if (e.message === 'TIMEOUT') {
                  alert('El envío está tardando más de lo normal. Puede que ya se haya enviado.\\n\\nCierra, refresca y comprueba en COMUNICACIONES antes de volver a enviar (para no duplicar).');
                  window.location.reload();
                  return;
                }
                alert('Error: ' + e.message);
                sSend.disabled = false;
                sSend.textContent = '📧 Enviar';
              }
            });
          })();
        </script>

        ${!["01_CONTACTO","02_VISITA"].includes(fase) ? `<div class="ptl-card ptl-card-compact">
          <div class="ptl-card-title">Datos económicos</div>
          <div class="ptl-form-grid">
            ${inp("pto_total", comu.pto_total, { type: "number", formato: "euros", col: 4, label: "PTO total (€)", readonly: roPrevisto })}
            <div class="col-8"></div>
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
        var ptlUH = [], ptlUP = -1, ptlUndoing = false;
        function ptlUhEditable(el){ return el && el.matches && el.matches('input,textarea,select') && !el.readOnly && !el.disabled && el.type!=='hidden' && el.type!=='button' && el.type!=='submit' && el.type!=='checkbox' && el.type!=='radio'; }
        document.addEventListener('focusin', function(e){ var el=e.target; if(ptlUhEditable(el) && el.dataset.uhorig===undefined) el.dataset.uhorig=el.value; }, true);
        function ptlUhRecord(el){ if(ptlUndoing || !ptlUhEditable(el)) return; var old=(el.dataset.uhorig===undefined?'':el.dataset.uhorig); if(el.value===old) return; ptlUH=ptlUH.slice(0,ptlUP+1); ptlUH.push({el:el, prev:old, next:el.value}); ptlUP=ptlUH.length-1; el.dataset.uhorig=el.value; ptlActUndo(); }
        document.addEventListener('change', function(e){ ptlUhRecord(e.target); }, true);
        document.addEventListener('focusout', function(e){ ptlUhRecord(e.target); }, true);
        function ptlUhApply(el, val){ ptlUndoing=true; try{ el.value=val; el.dataset.uhorig=val; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }finally{ ptlUndoing=false; } }
        let ptlIntercept = true;

        // v18.56 — Auto-grow de la caja Notas (textarea .ptl-textarea-grow): la
        // altura se ajusta al contenido al cargar y al escribir, como las notas
        // de HOY (es la misma nota notas_pto). El guardado lo sigue gestionando el
        // formulario (ptlDiff por name/data-orig), aquí solo la altura visual.
        (function ptlTextareaGrow(){
          const _grow = (ta) => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight) + 'px'; };
          ptlForm.querySelectorAll('.ptl-textarea-grow').forEach(function(ta){
            _grow(ta);
            ta.addEventListener('input', function(){ _grow(ta); });
          });
        })();

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
            // v18.02 — earth (coordenadas del mapa) NUNCA se edita desde la ficha:
            // se gestiona arrastrando en el mapa. No tiene input en la ficha, así
            // que el detector lo veía como "cambio fantasma" (leía '' vs la coord
            // real) y al "Guardar y salir" BORRABA las coordenadas. Lo ignoramos
            // siempre aquí.
            if (k === 'earth') continue;
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
              // v18.47 — normalizar el ORIGINAL por el MISMO formateador del campo
              // (dias=1 decimal, euros=2), igual que ptlValor normaliza el valor
              // actual. Asi un dato del Sheet con mas decimales (p.ej. tiempo_real
              // 28.25, que el campo muestra 28,3) NO se ve como cambio fantasma:
              // ambos lados pasan por ptlFmt*->ptlValorPlano y quedan a la misma
              // precision antes de comparar.
              const fmtNum = el.classList.contains('campo-dias') ? ptlFmtDias : ptlFmtEuros;
              const origNorm = ptlValorPlano(fmtNum(orig));
              if (v !== origNorm) d[k] = v;
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
          var bu = document.getElementById('ptlBtnUndo');
          var br = document.getElementById('ptlBtnRedo');
          if (bu) bu.disabled = (ptlUP < 0);
          if (br) br.disabled = (ptlUP >= ptlUH.length - 1);
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
          if (ptlUP < 0) return;
          var e = ptlUH[ptlUP]; ptlUP--; ptlActUndo();
          if (e.el) { try { e.el.focus(); } catch(_){} ptlUhApply(e.el, e.prev); }
        }
        function ptlRedo() {
          if (ptlUP >= ptlUH.length - 1) return;
          ptlUP++; var e = ptlUH[ptlUP]; ptlActUndo();
          if (e.el) { try { e.el.focus(); } catch(_){} ptlUhApply(e.el, e.next); }
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
        // v18.38 — FIX form-restoration por VUELTA ATRÁS / bfcache.
        // El navegador puede restaurar la página entera desde su back-forward cache
        // (bfcache) cuando el usuario pulsa "atrás" (p.ej. tras ir al mapa y volver).
        // Esa restauración trae los inputs con sus valores cacheados, NO con los
        // value="" frescos del servidor; en algunos campos esto APLANA los saltos
        // de línea (notas_pto pierde sus saltos) o descoloca valores económicos. Al
        // salir, ptlDiff lo ve como cambio y ptlGuardar lo escribe -> DAÑO.
        // event.persisted=true indica que la página viene de bfcache; en ese caso
        // forzamos una recarga limpia (location.replace) para traer el HTML fresco.
        // Casos cubiertos: vuelta atrás desde mapa, desde otra pantalla, swipe back
        // en móvil, etc. (El fix v18.36 solo cubría reloads disparados por JS.)
        window.addEventListener('pageshow', (ev) => {
          if (ev.persisted) {
            window.ptlReloading = true;
            location.replace(location.href);
          }
        });
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
          // beneficio_previsto NO se calcula en pantalla: lo pone el Sheet (formula
          // heredada en los expedientes antiguos) o el boton Congelar de Plan 5 (nuevos).
          // La ficha SOLO muestra el valor del Sheet (ya formateado arriba); aqui se lee
          // unicamente para el desvio en vivo, no se reescribe.
          const bp = n('beneficio_previsto');
          const br = (pto!=null && mor!=null && mar!=null) ? (pto - mor - mar) : null;
          setCalc('f_ben_real', br);
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
                  b.classList.toggle('ptl-btn-reloj', nuevoValor === '1');
                  b.classList.toggle('ptl-btn-reloj-off', nuevoValor !== '1');
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
                <div id="ptl-mm-aviso" style="display:none;padding:8px 12px;background:var(--ptl-warning-light);border-radius:6px;margin-bottom:12px;font-size:12px;color:var(--ptl-warning-dark)"></div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Asunto</label>
                  <input id="ptl-mm-asunto" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Para <span style="color:var(--ptl-gray-400);font-weight:normal">(varios separados por coma)</span></label>
                  <input id="ptl-mm-destinatario" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">CC <span style="color:var(--ptl-gray-400);font-weight:normal">(con copia visible — vacío si no procede)</span></label>
                  <input id="ptl-mm-cc" type="text" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">CCO <span style="color:var(--ptl-gray-400);font-weight:normal">(con copia oculta — separar con coma)</span></label>
                  <input id="ptl-mm-cco" type="text" placeholder="separar con coma" style="width:100%;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Mensaje</label>
                  <textarea id="ptl-mm-mensaje" rows="10" style="width:100%;padding:8px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
                </div>
                <div style="margin-bottom:10px">
                  <label class="ptl-label-2nd">Adjuntos (links de Drive, hasta 3)</label>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj1lbl" placeholder="Etiqueta (ej: PRESUPUESTO)" style="flex:0 0 200px;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj1url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                    </div>
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj2lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj2url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                    </div>
                    <div style="display:flex;gap:6px">
                      <input type="text" id="ptl-mm-adj3lbl" placeholder="Etiqueta" style="flex:0 0 200px;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                      <input type="text" id="ptl-mm-adj3url" placeholder="https://drive.google.com/..." style="flex:1;padding:7px 10px;border:1px solid var(--ptl-gray-300);border-radius:6px;font-size:13px"/>
                    </div>
                  </div>
                  <div style="font-size:11px;color:var(--ptl-gray-500);margin-top:4px">
                    Los archivos se descargan de Drive y se adjuntan al mail. En el histórico solo se guardan los links.
                  </div>
                </div>
                <div id="ptl-mm-estado" style="font-size:11px;color:var(--ptl-gray-500);margin-top:8px"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--ptl-gray-200)">
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
            // CCO: viene de la plantilla del Sheet con los 3 huecos separados por '||'
            // (p.ej. "comercial@...||||"). Lo limpiamos a una lista separada por comas
            // (sin huecos vacíos) para mostrarlo en la casilla. Si el usuario lo edita,
            // el envío respeta lo que quede escrito (ya soportado desde v17.73).
            document.getElementById('ptl-mm-cco').value = String(data.plantilla.cco || '')
              .split('||').map(function(s){ return s.trim(); }).filter(Boolean).join(', ');
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
                  // v18.36 — recarga limpia (NO reload)
                  window.ptlRecargaLimpia();
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
              const envioId = 'e' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
              try {
                const fd = new URLSearchParams();
                fd.append('envioId', envioId);
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
                const dd0 = await resp.json();
                if (!resp.ok) throw new Error(dd0.error || 'HTTP ' + resp.status);
                let dd;
                if (dd0 && dd0.encolado) {
                  const r = await window.ptlSondearEnvio(envioId);
                  if (!r.ok) {
                    const motivo = (r.isJson && r.payload && r.payload.error) ? r.payload.error
                                  : (typeof r.payload === 'string' ? r.payload : ('HTTP ' + (r.status || '?')));
                    throw new Error(motivo);
                  }
                  dd = r.payload || {};
                } else {
                  dd = dd0;
                }
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
                if (e.message === 'TIMEOUT') {
                  alert('El envío está tardando más de lo normal. Puede que ya se haya enviado.\\n\\nCierra esta ventana, refresca y comprueba en COMUNICACIONES antes de volver a enviar (para no duplicar).');
                  ptlCerrarModalMail();
                  window.location.reload();
                  return;
                }
                alert('Error: ' + e.message);
                btn.disabled = false; btn.textContent = esReenvio ? '📧 Confirmar reenvío' : '📧 Confirmar envío';
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
            <div style="background:var(--ptl-general-flotante);border-radius:10px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);padding:20px">
              <h3 style="margin:0 0 14px;font-size:16px;color:var(--ptl-gray-900)">¿Recibimos mail con acta?</h3>
              <p style="margin:0 0 18px;font-size:13px;color:var(--ptl-gray-700);line-height:1.4">
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
  function vistaNuevo(error, token, tiposVia, admins, presis, calles, direccionPrev, adminInfo) {
    const acDataNuevoJson = JSON.stringify({
      tipos:  tiposVia || [],
      admins: admins || [],
      presis: presis || [],
      calles: calles || [],
    }).replace(/</g, "\\u003c");
    const adminInfoNuevoJson = JSON.stringify(adminInfo || {}).replace(/</g, "\\u003c");
    const dirVal = esc(direccionPrev || "");
    return `
      <h1 style="font-size:22px;font-weight:700;margin-bottom:14px">+ Nuevo expediente</h1>
      ${error ? `<div class="ptl-next-action urgent"><div class="ico">⚠</div><div class="text">${esc(error)}</div></div>` : ''}
      <form method="POST" action="${urlT(token, "/presupuestos/nuevo")}" id="ptl-form-nuevo">
        <div class="ptl-card">
          <div class="ptl-card-title">Datos de la nueva CCPP</div>
          <div class="ptl-form-grid">
            <div class="col-2"><label class="ptl-form-label">Tipo via</label>
              <div class="ptl-ac-wrap">
                <input name="tipo_via" data-ac="tipos" autofocus placeholder="C" value="" autocomplete="off"/>
              </div>
            </div>
            <div class="col-10"><label class="ptl-form-label">Direccion *</label>
              <div class="ptl-ac-wrap">
                <input name="direccion" data-ac="calles" required placeholder="Ej. Doctor Fedriani 39" value="${dirVal}" autocomplete="off"/>
              </div>
            </div>
          </div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Administrador</label>
              <div class="ptl-ac-wrap">
                <input name="administrador" data-ac="admins" autocomplete="off"/>
              </div>
            </div>
            <div class="col-2"><label class="ptl-form-label">Telefono</label><input name="telefono_administrador" type="tel"/></div>
            <div class="col-4"><label class="ptl-form-label">Email</label><input name="email_administrador" type="email"/></div>
          </div>
          <div class="ptl-form-grid">
            <div class="col-6"><label class="ptl-form-label">Presidente</label>
              <input name="presidente" autocomplete="off"/>
            </div>
            <div class="col-2"><label class="ptl-form-label">Telefono</label><input name="telefono_presidente" type="tel"/></div>
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
          // Mapa administrador -> { telefono, email, ccpps:[...] } para autorrellenar.
          const adminInfoNuevo = ${adminInfoNuevoJson};
          const inpAdminNombre = form.querySelector('[name="administrador"]');
          const inpAdminTel    = form.querySelector('[name="telefono_administrador"]');
          const inpAdminEmail  = form.querySelector('[name="email_administrador"]');
          function buscarAdminNuevo(nombre) {
            const n = String(nombre || '').trim();
            if (!n) return null;
            if (adminInfoNuevo[n]) return Object.assign({ nombre: n }, adminInfoNuevo[n]);
            const nl = n.toLowerCase();
            for (const k of Object.keys(adminInfoNuevo)) {
              if (k.toLowerCase() === nl) return Object.assign({ nombre: k }, adminInfoNuevo[k]);
            }
            return null;
          }
          // El administrador manda: al elegirlo/cambiarlo se SOBRESCRIBEN siempre
          // teléfono y email con los suyos (aunque vengan vacíos en la BD).
          function rellenarAdmin(nombre) {
            const f = buscarAdminNuevo(nombre);
            if (!f) return;
            if (inpAdminNombre && inpAdminNombre.value !== f.nombre) inpAdminNombre.value = f.nombre;
            if (inpAdminTel)   { inpAdminTel.value   = f.telefono || ''; inpAdminTel.dataset.orig   = inpAdminTel.value; }
            if (inpAdminEmail) { inpAdminEmail.value = f.email    || ''; inpAdminEmail.dataset.orig = inpAdminEmail.value; }
          }
          // Propagar a las demás CCPPs del administrador cuando se edita su tel/email a mano.
          async function preguntarPropagarAdmin(campo) {
            const found = buscarAdminNuevo(inpAdminNombre ? inpAdminNombre.value : '');
            if (!found) return; // administrador nuevo (no en BD) -> nada que propagar
            const info = adminInfoNuevo[found.nombre];
            if (!info || !info.ccpps || info.ccpps.length < 1) return;
            const nuevoValor = (campo === 'telefono')
              ? (inpAdminTel.value.replace(/\\D/g, ''))
              : inpAdminEmail.value.trim();
            const r = confirm(
              'Has cambiado el ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + found.nombre + '.\\n\\n' +
              'Este administrador está en ' + info.ccpps.length + ' CCPP(s).\\n\\n' +
              '¿Aplicar el cambio en TODAS sus CCPPs?\\n\\n' +
              '  Aceptar = Actualizar todas\\n' +
              '  Cancelar = Dejarlo solo en este expediente nuevo'
            );
            if (!r) { return; }
            try {
              const fd = new URLSearchParams();
              fd.append('nombre_admin', found.nombre);
              fd.append('campo', campo);
              fd.append('valor', nuevoValor);
              const resp = await fetch('${urlT(token, "/presupuestos/admin/actualizar")}', { method: 'POST', body: fd });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const data = await resp.json();
              alert('Actualizado ' + (campo === 'telefono' ? 'teléfono' : 'email') + ' de ' + found.nombre + ' en ' + (data.actualizadas != null ? data.actualizadas : '?') + ' CCPP(s).');
              if (adminInfoNuevo[found.nombre]) {
                if (campo === 'telefono') adminInfoNuevo[found.nombre].telefono = nuevoValor;
                else adminInfoNuevo[found.nombre].email = nuevoValor;
              }
              if (campo === 'telefono' && inpAdminTel) inpAdminTel.dataset.orig = inpAdminTel.value;
              if (campo === 'email' && inpAdminEmail) inpAdminEmail.dataset.orig = inpAdminEmail.value;
            } catch (e) {
              alert('Error actualizando: ' + e.message);
            }
          }
          if (inpAdminNombre) {
            // Al salir del campo nombre con un administrador que existe, traer sus datos.
            inpAdminNombre.addEventListener('blur', () => { rellenarAdmin(inpAdminNombre.value); });
          }
          if (inpAdminTel) inpAdminTel.addEventListener('blur', () => {
            if (inpAdminTel.dataset.orig !== inpAdminTel.value) setTimeout(() => preguntarPropagarAdmin('telefono'), 100);
          });
          if (inpAdminEmail) inpAdminEmail.addEventListener('blur', () => {
            if (inpAdminEmail.dataset.orig !== inpAdminEmail.value) setTimeout(() => preguntarPropagarAdmin('email'), 100);
          });
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
              // Al elegir un ADMINISTRADOR, traer su teléfono y email de la BD.
              if (input.dataset.ac === 'admins') rellenarAdmin(val);
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
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-fase="${esc(fase)}">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha">▶</span>
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

        <div class="ptl-card ptl-acordeon" data-fase="_PIE_GLOBAL" style="border-color:var(--ptl-gray-300)">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha">▶</span>
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
  function vistaPlantillasBotFlujo(plantillas, token) {
    const P = {}; plantillas.forEach(p => { P[p.clave] = p; });
    function claveOf(code) {
      if (code === "solicitud_firmada") return "pide_solicitud_firmada";
      if (code === "empadronamiento") return "pide_empadronamiento";
      const m = String(code).match(/^dni_(?:([a-z]+)_)?(delante|detras)$/);
      if (m) return "pide_dni_" + m[2];
      if (code.indexOf("bienvenida_") === 0 || code.indexOf("flujo_") === 0 || code.indexOf("aviso_") === 0 || code.indexOf("error_") === 0 || code === "doc_recibido" || code === "seguir_expediente") return code;
      return "pide_" + code;
    }
    const COMPARTIDAS = { pide_solicitud_firmada:1, pide_dni_delante:1, pide_dni_detras:1, pide_empadronamiento:1 };
    let _i = 0;
    function card(code, titulo, opts) {
      opts = opts || {};
      const clave = claveOf(code);
      const p = P[clave] || { clave: clave, texto: "", activo: true };
      const id = "fbf-" + clave + "-" + (_i++);
      const checked = p.activo ? "checked" : "";
      const compart = COMPARTIDAS[clave] ? `<div class="pbf-compart">✏️ Plantilla compartida</div>` : "";
      const opc = opts.opcional ? ` <span class="pbf-opc">opcional</span>` : "";
      return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
                <span class="ptl-acordeon-flecha">▶</span>
                <span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}${opc}</span>
              </div>
            </div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap">
                <input type="checkbox" name="activo" value="1" form="${id}" ${checked}/><span>Activa</span>
              </label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="clave" value="${esc(clave)}"/>
            <input type="hidden" name="vista" value="flujo"/>
            ${compart}
            <label style="font-size:13px;display:block">
              <div style="margin-bottom:0;font-weight:600;line-height:1.2">Texto del mensaje</div>
              <textarea name="texto" rows="6" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical">${esc(p.texto || "")}</textarea>
            </label>
          </form>
        </div>`;
    }
    function twcard(clave, titulo) {
      const p = P[clave] || { clave: clave, twilio_sid:"", textoTwilio:"", activo:true, destinatario:"", variables:"" };
      const id = "fbf-tw-" + clave + "-" + (_i++);
      const checked = p.activo ? "checked" : "";
      return `
        <div class="ptl-card ptl-acordeon${p.activo ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="activo" value="1" form="${id}" ${checked}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="clave" value="${esc(clave)}"/>
            <input type="hidden" name="tipo" value="twilio"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:13px;display:block"><div style="font-weight:600;line-height:1.2">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 El texto lo gestiona Twilio (solo lectura).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : `<div style="color:var(--ptl-gray-400);font-style:italic;font-size:12px">(texto no disponible)</div>`}
          </form>
        </div>`;
    }
    const stack = (list) => list.map(([c,t]) => card(c, t, {})).join("");

    const HEAD = ["01 Propietario","02 Familiar","03 Inquilino","04 Local","05 Sociedad"];
    const ITEMS = [
      ["flujo_pregunta_tipo","Tipo expediente","1 / -1",2,{}],
      ["bienvenida_propietario","Bienvenida","1",3,{}],
      ["bienvenida_familiar","Bienvenida","2",3,{}],
      ["bienvenida_inquilino","Bienvenida","3",3,{}],
      ["bienvenida_local","Bienvenida","4",3,{}],
      ["bienvenida_sociedad","Bienvenida","5",3,{}],
      ["solicitud_firmada","Solicitud EMASESA","1 / -1",4,{}],
      ["dni_delante","DNI propietario · delante","1 / 5",5,{}],
      ["dni_detras","DNI propietario · detrás","1 / 5",6,{}],
      ["dni_administrador_delante","DNI administrador · delante","5",5,{}],
      ["dni_administrador_detras","DNI administrador · detrás","5",6,{}],
      ["dni_familiar_delante","DNI familiar · delante","2",7,{}],
      ["dni_inquilino_delante","DNI inquilino · delante","3",7,{}],
      ["licencia_o_declaracion","Licencia / declaración","4",9,{}],
      ["nif_sociedad","NIF sociedad","5",9,{}],
      ["dni_familiar_detras","DNI familiar · detrás","2",8,{}],
      ["dni_inquilino_detras","DNI inquilino · detrás","3",8,{}],
      ["escritura_constitucion","Escritura constitución","5",10,{}],
      ["autorizacion_familiar","Autorización familiar","2",9,{}],
      ["contrato_alquiler","Contrato alquiler","3",9,{}],
      ["poderes_representante","Poderes representante","5",11,{}],
      ["libro_familia","Libro familia","2",10,{}],
      ["empadronamiento","Empadronamiento","1 / 4",11,{opcional:true}],
    ];
    const heads = HEAD.map((h,idx) => `<div class="pbf-colhd" style="grid-column:${idx+1};grid-row:1">${esc(h)}</div>`).join("");
    const celdas = ITEMS.map(([code,titulo,col,row,opts]) =>
      `<div style="grid-column:${col};grid-row:${row}">${card(code, titulo, opts)}</div>`).join("");

    const finCards = [
      card("dni_pagador_delante","DNI pagador · delante",{}),
      card("dni_pagador_detras","DNI pagador · detrás",{}),
      card("justificante_ingresos","Justificante ingresos",{}),
      card("titularidad_bancaria","Titularidad bancaria",{}),
    ];
    // Financiacion integrada en la rejilla: bandas a lo ancho de 1-4 (Sociedad fuera: no se financia)
    const finFlujo = `
          <div style="grid-column:1 / 5;grid-row:12">${card("flujo_pregunta_financiacion","Forma de pago",{})}</div>
          <div style="grid-column:1 / 5;grid-row:13">${card("flujo_estudiar_financiacion","Bienvenida financiación",{})}</div>
          <div style="grid-column:1 / 5;grid-row:14">${finCards[0]}</div>
          <div style="grid-column:1 / 5;grid-row:15">${finCards[1]}</div>
          <div style="grid-column:1 / 5;grid-row:16">${finCards[2]}</div>
          <div style="grid-column:1 / 5;grid-row:17">${finCards[3]}</div>
          <div style="grid-column:1 / -1;grid-row:18">${card("flujo_base_completo","Expediente completo",{})}</div>`;

    const flujoEnvia = [
      card("seguir_expediente","doc - página siguiente",{}),
      card("flujo_falta_enviar","doc - falta enviar",{}),
      card("flujo_seguimos_largo","Doc - varias paginas",{}),
      card("flujo_documento_completo","doc - validado",{}),
      card("flujo_sin_opcional","doc - seguir sin opcional",{}),
    ].map(c => "<div>" + c + "</div>").join("");
    const erroresCards = stack([["error_mensaje","error - mensaje"],["error_documento","error - doc"]]);
    const _NIV = ["muy_tolerante","tolerante","normal","estricto","muy_estricto"];
    const _ETI = ["Muy tolerante","Tolerante","Normal","Estricto","Muy estricto"];
    const _filaEx = plantillas.find(p => p.clave === "exigencia_fotos");
    let _idxEx = _filaEx ? _NIV.indexOf(String(_filaEx.texto || "").trim().toLowerCase()) : 2;
    if (_idxEx < 0) _idxEx = 2;
    const exigencia = `
      <div style="border:1px solid var(--ptl-gray-200);border-radius:8px;background:var(--ptl-general-1,#1f3a5f);padding:12px 14px;max-width:760px;margin:0 auto;color:#fff">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="font-weight:600;font-size:14px">🎚️ Exigencia con los DNI en jpg</div>
          <button type="submit" form="ex-form" class="ptl-btn ptl-btn-primary" style="flex-shrink:0">💾 Guardar</button>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.85);margin:4px 0 12px">Cómo de exigente es el bot al revisar la calidad de los DNI. Si rechaza DNI que están bien, deslízalo hacia la izquierda.</div>
        <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/exigencia")}" id="ex-form">
          <input type="hidden" name="vista" value="flujo"/>
          <input type="hidden" name="nivel" id="ex-nivel" value="${esc(_NIV[_idxEx])}"/>
          <input type="range" min="0" max="4" step="1" value="${_idxEx}" id="ex-range" style="width:100%"/>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.7);margin-top:2px"><span>Muy tolerante</span><span>Tolerante</span><span>Normal</span><span>Estricto</span><span>Muy estricto</span></div>
          <div style="font-size:13px;text-align:center;margin-top:8px">Seleccionado: <strong id="ex-label">${esc(_ETI[_idxEx])}</strong></div>
        </form>
        <script>
          (function(){ var r=document.getElementById("ex-range"),lbl=document.getElementById("ex-label"),hid=document.getElementById("ex-nivel");
            var NN=["muy_tolerante","tolerante","normal","estricto","muy_estricto"],EE=["Muy tolerante","Tolerante","Normal","Estricto","Muy estricto"];
            if(r)r.addEventListener("input",function(){var i=parseInt(r.value,10)||0;if(lbl)lbl.textContent=EE[i];if(hid)hid.value=NN[i];}); })();
        </script>
      </div>`;

    // v18.121: tiempos + on/off de los avisos automaticos por plazo (ajustes en bot_plantillas)
    const _avVal = (clave, def) => { const f = plantillas.find(x => x.clave === clave); if (!f) return { val: def, on: true }; const n = parseFloat(String(f.texto || "").replace(",", ".").trim()); return { val: (isNaN(n) ? def : n), on: (f.activo !== false) }; };
    const _AVDEF = {
      msg_plazo_1: "Recordatorio - Tu expediente lleva varios dias esperando:\n\n• {documento}\n\nPuedes enviarlo directamente por aqui.{extra}",
      msg_plazo_urgente: "Aviso importante - Queda poco tiempo.\n\n• {documento}\n\nEnvialo ahora por este WhatsApp para no perder el plazo.",
      msg_plazo_fuera: "ULTIMO AVISO - El plazo para tu expediente ha finalizado.\n\n• {documento}\n\nEnvialo URGENTEMENTE por este WhatsApp o tu expediente puede quedar bloqueado.",
    };
    const _avMsg = (msgClave) => { const f = plantillas.find(x => x.clave === msgClave); return (f && String(f.texto || "").trim() !== "") ? f.texto : (_AVDEF[msgClave] || ""); };
    const avcard = (tClave, msgClave, titulo, unidad, def) => { const a = _avVal(tClave, def); const id = "fbf-av-" + tClave + "-" + (_i++); return `
        <div class="ptl-card ptl-acordeon${a.on ? "" : " ptl-acordeon-inactiva"}" data-clave="${esc(tClave)}">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="${esc(titulo)}">${esc(titulo)}</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="on" value="1" form="${id}" ${a.on ? "checked" : ""}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/avisos-tiempos")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="clave" value="${esc(tClave)}"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-weight:600">Cada</span><input type="number" name="val" value="${a.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-family:inherit;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">${unidad}</span></label>
            <label style="font-size:12px;display:block"><div style="font-weight:600;line-height:1.2">Texto del aviso</div>
              <textarea name="msg" rows="4" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(_avMsg(msgClave))}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {documento} (lo que falta) y {extra} (coletilla automatica).</div>
          </form>
        </div>`; };
    const presentcard = () => { const p = P["presentacion"] || { twilio_sid:"", textoTwilio:"", destinatario:"" }; const a1 = _avVal("t_presentacion_1", 2); const a2 = _avVal("t_presentacion_2", 4); const id = "fbf-present-" + (_i++); const inactiva = (!a1.on && !a2.on) ? " ptl-acordeon-inactiva" : ""; return `
        <div class="ptl-card ptl-acordeon${inactiva}" data-clave="presentacion">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Twilio - reenvío presentación (${a1.val} y ${a2.val} días)">Twilio - reenvío presentación (${a1.val} y ${a2.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/presentacion")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Reenvío a quien no responde a la presentación</div>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="on1" value="1" ${a1.on?"checked":""}/><span style="font-weight:600">1er reenvío a los</span><input type="number" name="val1" value="${a1.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">días</span></label>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><input type="checkbox" name="on3" value="1" ${a2.on?"checked":""}/><span style="font-weight:600">2º reenvío a los</span><input type="number" name="val3" value="${a2.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">días</span></label>
            <label style="font-size:13px;display:block;margin-bottom:4px"><div style="font-weight:600;line-height:1.2">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 Reenvía la misma plantilla de presentación (texto gestionado por Twilio).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : ``}
          </form>
        </div>`; };
    const sleepcard = () => { const p = P["recordatorio"] || { twilio_sid:"", textoTwilio:"", destinatario:"" }; const a1 = _avVal("t_inactividad_1", 1); const a3 = _avVal("t_inactividad_2", 3); const id = "fbf-sleep-" + (_i++); const inactiva = (!a1.on && !a3.on) ? " ptl-acordeon-inactiva" : ""; return `
        <div class="ptl-card ptl-acordeon${inactiva}" data-clave="recordatorio">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Twilio - Sleep (${a1.val} y ${a3.val} días)">Twilio - Sleep (${a1.val} y ${a3.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/sleep")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Plazos en que se manda al vecino callado</div>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="on1" value="1" ${a1.on?"checked":""}/><span style="font-weight:600">1er aviso a los</span><input type="number" name="val1" value="${a1.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">días</span></label>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px"><input type="checkbox" name="on3" value="1" ${a3.on?"checked":""}/><span style="font-weight:600">2º aviso a los</span><input type="number" name="val3" value="${a3.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">días</span></label>
            <label style="font-size:13px;display:block;margin-bottom:4px"><div style="font-weight:600;line-height:1.2">SID de la plantilla (Twilio)</div>
              <input type="text" name="twilio_sid" value="${esc(p.twilio_sid || "")}" placeholder="HX..." style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:monospace;font-size:12px"/></label>
            <div style="font-size:11px;color:var(--ptl-gray-500);margin:6px 0 4px">📲 El texto lo gestiona Twilio (solo lectura).${p.destinatario ? " Destinatario: <strong>" + esc(p.destinatario) + "</strong>." : ""}</div>
            ${p.textoTwilio ? `<div style="padding:6px 8px;background:#fff;border:1px solid var(--ptl-gray-200);border-radius:4px;white-space:pre-wrap;font-size:12px;line-height:1.35;color:#111">${esc(p.textoTwilio)}</div>` : `<div style="color:var(--ptl-gray-400);font-style:italic;font-size:12px">(texto no disponible)</div>`}
          </form>
        </div>`; };
    const wakecard = () => { const f = plantillas.find(x => x.clave === "msg_inactividad_1"); const texto = (f && String(f.texto || "").trim() !== "") ? f.texto : "Hola de nuevo {nombre},\n\npara completar tu expediente todavía faltan:\n{lista}\n\nRecuerda que quedan {dias} días para entregarlos.\n\nEnvíalos lo antes posible por este WhatsApp."; const on = !f || f.activo !== false; const id = "fbf-wake-" + (_i++); return `
        <div class="ptl-card ptl-acordeon${on ? "" : " ptl-acordeon-inactiva"}" data-clave="msg_inactividad_1">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Automático - Wake up">Automático - Wake up</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <label class="ptl-acordeon-activa" style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" name="activo" value="1" form="${id}" ${on ? "checked" : ""}/><span>Activa</span></label>
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/guardar")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="clave" value="msg_inactividad_1"/>
            <input type="hidden" name="vista" value="flujo"/>
            <label style="font-size:13px;display:block"><div style="font-weight:600;line-height:1.2">Texto del mensaje</div>
              <textarea name="texto" rows="6" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(texto)}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {nombre}, {lista} (lo que falta) y {dias} (dias que quedan hasta el plazo).</div>
          </form>
        </div>`; };
    const plazocard = () => { const a1 = _avVal("t_plazo_1", 10); const aU = _avVal("t_plazo_urgente", 18); const aF = _avVal("t_plazo_fuera", 20); const f = plantillas.find(x => x.clave === "msg_plazo_1"); const texto = (f && String(f.texto || "").trim() !== "") ? f.texto : "Recordatorio: tu expediente sigue pendiente.\n\n{lista}\n\nQuedan {dias} días para entregarlo todo.\nEnvíalo cuanto antes por este WhatsApp."; const on = (a1.on || aU.on || aF.on); const id = "fbf-plazo-" + (_i++); const fila = (lab, nval, nchk, a) => `<label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" name="${nchk}" value="1" ${a.on?"checked":""}/><span style="font-weight:600">${lab}</span><input type="number" name="${nval}" value="${a.val}" min="0" step="1" style="width:62px;padding:3px 5px;border:1px solid var(--ptl-gray-300);border-radius:4px;font-size:12px;text-align:right"/><span style="color:var(--ptl-gray-500)">días</span></label>`; return `
        <div class="ptl-card ptl-acordeon${on ? "" : " ptl-acordeon-inactiva"}" data-clave="t_plazo_1">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0"><div class="ptl-card-title" style="display:flex;align-items:center;gap:6px">
              <span class="ptl-acordeon-flecha">▶</span><span class="pbf-ttl" title="Plazo - Sleep (${a1.val}, ${aU.val} y ${aF.val} días)">Plazo - Sleep (${a1.val}, ${aU.val} y ${aF.val} días)</span></div></div>
            <div class="ptl-acordeon-acciones" style="display:none;align-items:center;gap:8px;margin:5px 8px 5px 0;flex-shrink:0">
              <button type="button" class="ptl-btn ptl-btn-primary ptl-acordeon-guardar" style="flex-shrink:0">💾</button>
            </div>
          </div>
          <form method="POST" action="${urlT(token, "/presupuestos/plantillas-bot/plazo")}" id="${id}" class="ptl-acordeon-cuerpo" style="display:none;padding:8px;border-top:1px solid var(--ptl-gray-200)">
            <input type="hidden" name="vista" value="flujo"/>
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Plazos (dias totales desde el inicio)</div>
            ${fila("Recordatorio a los", "val1", "on1", a1)}
            ${fila("Urgente a los", "valU", "onU", aU)}
            ${fila("Fuera de plazo a los", "valF", "onF", aF)}
            <label style="font-size:13px;display:block;margin-top:4px"><div style="font-weight:600;line-height:1.2">Texto del aviso</div>
              <textarea name="texto" rows="5" style="width:100%;padding:5px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:12px;resize:vertical;color:#111">${esc(texto)}</textarea></label>
            <div style="font-size:10px;color:var(--ptl-gray-500);margin-top:4px">Usa {nombre}, {lista} y {dias} (dias que quedan hasta el ultimo plazo). En chat es uno solo para los tres; al vecino callado lo manda Twilio.</div>
          </form>
        </div>`; };
    const _avFinanc = `<div style="font-size:11px;color:var(--ptl-gray-500);background:#fff;border:1px solid var(--ptl-gray-200);border-radius:6px;padding:6px 8px;margin-top:6px">&bull; <strong>Listo para financiacion</strong> (financiacion_lista): mensaje directo con enlace, no es plantilla Twilio.</div>`;
    const _col = (color, titulo, contenido) => `<div><div class="pbf-av-h" style="background:var(--ptl-general-1,#1f3a5f);color:var(--ptl-titulo)">${titulo}</div>${contenido}</div>`;
    const _miniH = (color, t) => `<div style="font-weight:700;font-size:10.5px;color:${color};margin:8px 0 3px">${t}</div>`;
    const cols5 =
      _col("var(--ptl-gray-500)", "📨 Avisos de flujo", flujoEnvia) +
      _col("var(--ptl-gray-500)", "📋 Avisos de resultado",
        _miniH("var(--ptl-titulo)", "📩 Acuse de recibo") + card("doc_recibido","aviso - doc recibido",{}) +
        _miniH("#2e9e5b", "✅ OK · válido") + stack([["aviso_ok","aviso - doc ok"],["aviso_ok_fin","aviso - doc ok (último)"]]) +
        _miniH("#d99a00", "⚠️ REVISAR · con dudas") + stack([["aviso_revisar","aviso - doc revisar"],["aviso_revisar_fin","aviso - doc revisar (último)"]]) +
        _miniH("#d23f3f", "❌ REPETIR · no válido") + stack([["aviso_repetir","aviso - doc repetir"],["aviso_ayuda_2","aviso - doc repetir 2"],["aviso_ayuda_3","aviso - doc repetir 3"]])) +
      _col("var(--ptl-gray-500)", "⚠️ Avisos de error", erroresCards) +
      _col("var(--ptl-gray-500)", "📲 A pisos",
        presentcard() + sleepcard() + plazocard() + wakecard()) +
      _col("var(--ptl-gray-500)", "🛟 Al equipo (por evento)",
        twcard("equipo_revisar_documento","Twilio - doc a revisar") + twcard("equipo_intervencion","Twilio - falla 3 veces") + twcard("equipo_atencion_humana","Twilio - necesita un humano") + twcard("equipo_expediente_completo","Twilio - expediente completo") + _avFinanc);

    return `
      <div class="pbotflujo" style="max-width:1000px;margin:0 auto;padding:8px">
        <h2 style="font-size:18px;margin:8px 0 4px">🤖 Plantillas del bot — por flujo</h2>
        <p style="font-size:13px;color:var(--ptl-gray-500);margin:0 0 10px">El recorrido real del vecino. Lo común va en banda a lo ancho; lo propio de cada tipo, en su columna. Cada casilla se abre y se edita aquí mismo; las marcadas <em>compartida</em> cambian en todos los caminos a la vez.</p>
        <style>
          .pbotflujo .ptl-card{padding:0;margin:0 0 var(--ptl-card-gap);overflow:hidden;border:1px solid var(--ptl-gray-200);border-radius:7px;background:#fff}
          .pbotflujo .ptl-card-title{margin:0;padding:5px 8px;border-radius:0}
          .pbotflujo .ptl-acordeon-cab{padding:0}
          .pbotflujo .ptl-acordeon-inactiva,.pbotflujo .ptl-acordeon-inactiva>.ptl-acordeon-cab{background:var(--ptl-danger-light)!important;border-color:var(--ptl-danger)}
          .pbotflujo .pbf-ttl{font-size:8.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;flex:1;min-width:0;letter-spacing:.2px}
          .pbotflujo .pbf-opc{font-size:8px;border:1px solid var(--ptl-gray-300);border-radius:20px;padding:0 5px;color:var(--ptl-gray-500);font-weight:500}
          .pbf-scroll{overflow-x:auto;padding-bottom:8px}
          .pbf-grid{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:0 7px;align-items:start;min-width:760px;max-width:1000px;margin:0 auto}
          .pbf-colhd{text-align:center;font-weight:700;font-size:11px;color:#fff;background:var(--ptl-general-1,#1f3a5f);border-radius:6px;padding:5px}
          .pbf-grp{max-width:980px;margin:20px auto 8px;font-weight:700;font-size:12px;color:var(--ptl-titulo);background:var(--ptl-general-1,#1f3a5f);text-transform:uppercase;letter-spacing:.05em;border-radius:6px;padding:6px 10px;border-bottom:2px solid var(--ptl-titulo)}
          .pbf-banda-full{max-width:1000px;margin:0 auto 8px}
          .pbf-avisos3{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;max-width:900px;margin:0 auto}
          .pbf-av-col{flex:1;min-width:230px}
          .pbf-av-h{color:var(--ptl-titulo);font-weight:700;font-size:11.5px;border-radius:6px;padding:5px 8px;margin-bottom:6px}
          .pbotflujo .pbf-compart{background:var(--ptl-general-1,#1f3a5f);color:#fff;font-weight:700;font-size:11px;padding:4px 8px;border-radius:5px;margin-bottom:8px;display:inline-block}
          .pbotflujo .ptl-acordeon-activa{color:#111}
          .pbotflujo .ptl-acordeon-cuerpo label>div{color:#111}
          .pbf-subband{background:var(--ptl-general-1,#1f3a5f);color:#fff;font-weight:700;font-size:12px;border-radius:7px;padding:7px 10px;margin:0 auto 10px;max-width:980px}
          .pbf-flujo5{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;max-width:980px;margin:0 auto}
          .pbf-flujo5>div{flex:1;min-width:160px}
        </style>

        <div class="pbf-grp">Flujo</div>
        <div class="pbf-banda-full">${twcard("presentacion","Twilio - presentación")}</div>
        <div class="pbf-scroll"><div class="pbf-grid">${heads}${celdas}${finFlujo}</div></div>

        <div class="pbf-grp">Avisos</div>
        <div class="pbf-flujo5">${cols5}</div>

        <div class="pbf-grp">Exigencia con los DNI en jpg</div>
        ${exigencia}

        <div style="font-size:12px;color:var(--ptl-gray-500);text-align:center;padding:14px">Todo se guarda en <code>bot_plantillas</code>.</div>

        <script>
          (function(){
            document.querySelectorAll('.pbotflujo .ptl-acordeon').forEach(function(card){
              var cab=card.querySelector('.ptl-acordeon-cab'),cuerpo=card.querySelector('.ptl-acordeon-cuerpo'),flecha=card.querySelector('.ptl-acordeon-flecha'),btnGuardar=card.querySelector('.ptl-acordeon-guardar'),acciones=card.querySelector('.ptl-acordeon-acciones');
              if(!cab||!cuerpo||!flecha||!btnGuardar)return;
              function toggle(f){var ab=(f!==undefined)?f:(cuerpo.style.display==='none');cuerpo.style.display=ab?'block':'none';flecha.textContent=ab?'▼':'▶';if(acciones)acciones.style.display=ab?'flex':'none';}
              cab.addEventListener('click',function(e){if(e.target.closest('.ptl-acordeon-guardar'))return;if(e.target.closest('.ptl-acordeon-activa'))return;toggle();});
              btnGuardar.addEventListener('click',function(){cuerpo.requestSubmit?cuerpo.requestSubmit():cuerpo.submit();});
            });
          })();
        </script>
      </div>`;
  }
  function vistaPlantillasDoc(plantillas, token) {
    // Reparte: encabezado, pie y el resto (cuerpos de documento) en su orden.
    const encab = plantillas.find(p => p.clave === "_ENCABEZADO_GLOBAL");
    const pie   = plantillas.find(p => p.clave === "_PIE_GLOBAL");
    const cuerpos = plantillas
      .filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL")
      .sort((a, b) => _ordenDoc(a.clave) - _ordenDoc(b.clave)); // v17.91: mismo orden que el menú

    const tarjetas = cuerpos.map(p => {
      const clave  = p.clave;
      const titulo = p.titulo || clave;
      return `
        <div class="ptl-card ptl-acordeon" data-clave="${esc(clave)}">
          <div class="ptl-acordeon-cab">
            <div style="flex:1;min-width:0">
              <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
                <span class="ptl-acordeon-flecha">▶</span>
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
      <div class="ptl-card ptl-acordeon" data-clave="_ENCABEZADO_GLOBAL" style="border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab">
          <div style="flex:1;min-width:0">
            <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
              <span class="ptl-acordeon-flecha">▶</span>
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
      <div class="ptl-card ptl-acordeon" data-clave="_PIE_GLOBAL" style="border-color:var(--ptl-gray-300)">
        <div class="ptl-acordeon-cab">
          <div style="flex:1;min-width:0">
            <div class="ptl-card-title" style="display:flex;align-items:center;gap:8px">
              <span class="ptl-acordeon-flecha">▶</span>
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
      const html = pageHtml("Listado de presupuestos",
        [{ label: "Presupuestos", url: "#" }],
        await vistaListado(comunidades, req.query, token),
        token, { search: true, searchValue: (req.query.q || ""), cron: true });
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
    let admins = [], presis = [], calles = [], adminInfo = {};
    try {
      const comunidades = await leerComunidades();
      const dl = construirDatalists(comunidades);
      const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
      tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
      admins = dl.admins;
      presis = dl.presis;
      calles = dl.calles;
      adminInfo = dl.adminInfo;
    } catch (e) {
      console.warn("[presupuestos] no se pudieron leer datos:", e.message);
    }
    sendHtml(res, pageHtml("Nuevo expediente",
      [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
      vistaNuevo(req.query.error || "", token, tiposVia, admins, presis, calles, req.query.dir || "", adminInfo),
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
        let admins = [], presis = [], calles = [], adminInfo = {};
        try {
          const comunidades = await leerComunidades();
          const dl = construirDatalists(comunidades);
          const ts = comunidades.map(c => c.tipo_via).filter(Boolean);
          tiposVia = Array.from(new Set([...tiposVia, ...ts])).filter(Boolean).sort();
          admins = dl.admins; presis = dl.presis; calles = dl.calles; adminInfo = dl.adminInfo;
        } catch (e) {}
        sendHtml(res, pageHtml("Nuevo expediente",
          [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Nuevo", url: "#" }],
          vistaNuevo(mensaje, token, tiposVia, admins, presis, calles, datos, adminInfo),
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
        earth: "",   // v18.02: nace SIN coordenada (antes ponía "NO"). Se geocodificará/ubicará en el mapa.
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
      const cabecera = renderCabeceraComun(token, comunidades, { mapaId: comu.ccpp_id, searchInHeader: true });
      sendHtml(res, pageHtml(titulo,
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: labelExp, url: "#" }],
        cabecera + (await vistaFicha(comu, datalists, token, reciencreado)),
        token, { expedienteId: comu.ccpp_id, expedienteDir: labelExp, expedienteFase: normalizarFase(comu.fase_presupuesto), search: true, searchValue: (req.query.q || ""), cron: true, undo: true }));
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

  // v18.77: POST /presupuestos/piso/modo-bot
  // Body: { ccpp_id, vivienda, modo }  (modo = "MANUAL" | "BOT_WHATSAPP")
  // Cambia el interruptor del bot WhatsApp de un piso (columna AV bot_piso_activo).
  app.post("/presupuestos/piso/modo-bot", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const ccpp_id = String(req.body.ccpp_id || "").trim();
      const vivienda = String(req.body.vivienda || "").trim();
      const modo = String(req.body.modo || "").toUpperCase();
      const enviarPresentacion = ["1","true","si","sí","on","yes"].includes(String(req.body.enviar_presentacion || "").toLowerCase());
      if (!ccpp_id) return res.status(400).json({ error: "Falta ccpp_id" });
      if (!vivienda) return res.status(400).json({ error: "Falta vivienda" });
      if (modo !== "MANUAL" && modo !== "BOT_WHATSAPP") {
        return res.status(400).json({ error: "Valor no válido (MANUAL | BOT_WHATSAPP)" });
      }
      const comu = await buscarComunidadPorId(ccpp_id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const rowIdx = await _buscarRowIndexPiso(comu.direccion || comu.comunidad, vivienda);
      if (!rowIdx) return res.status(404).json({ error: "Piso no encontrado" });
      await _actualizarCampoPiso(rowIdx, "bot_piso_activo", modo);

      // v18.78: si se activa el bot (M->W) y se pidio, enviar la presentacion a
      // ESE piso (lo hace bot-whatsapp.cjs via app.locals; no reenvia si ya hay ficha).
      let presentacion = null;
      if (modo === "BOT_WHATSAPP" && enviarPresentacion) {
        const bot = app.locals.botWhatsapp;
        if (bot && typeof bot.enviarPresentacionPiso === "function") {
          try {
            const sheetsP = getSheetsClient();
            const relP = await sheetsP.spreadsheets.values.get({
              spreadsheetId: SHEET_ID, range: `pisos!A${rowIdx}:E${rowIdx}`,
            });
            const filaP = (relP.data.values && relP.data.values[0]) || [];
            const telefono = filaP[0] || "";
            const nombre = filaP[4] || "";
            presentacion = await bot.enviarPresentacionPiso(telefono, {
              comunidad: comu.direccion || comu.comunidad, vivienda, nombre,
            });
          } catch (e) {
            presentacion = { ok: false, estado: "error", error: e.message };
          }
        } else {
          presentacion = { ok: false, estado: "bot_no_disponible" };
        }
      }
      res.json({ ok: true, modo, presentacion });
    } catch (e) {
      console.error("[presupuestos] /piso/modo-bot:", e.message);
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
          // v18.41: caso especial 04 -> 03. El envío del presupuesto siembra DOS
          // claves: 03_ENVIO_PTO (su etapa de origen, rastro histórico) y
          // 04_ACEPTACION_PTO (manual nº1 del seguimiento). Al retroceder de 04
          // borramos arriba la clave 04, pero la 03 quedaba huérfana: si luego se
          // reenviaba el presupuesto, nuevoCount = enviados["03"]+1 = 2 -> conteo
          // descuadrado. Al volver a 03 limpiamos también la clave 03 en las tres
          // columnas, para que el reenvío del presupuesto arranque limpio en 1.
          if (fase === "04_ACEPTACION_PTO") {
            if (enviados["03_ENVIO_PTO"] !== undefined) { delete enviados["03_ENVIO_PTO"]; comu.mails_enviados = JSON.stringify(enviados); }
            if (manuales["03_ENVIO_PTO"] !== undefined) { delete manuales["03_ENVIO_PTO"]; comu.mails_manuales = JSON.stringify(manuales); }
            if (ultimo["03_ENVIO_PTO"] !== undefined)   { delete ultimo["03_ENVIO_PTO"];   comu.mails_ultimo_envio = JSON.stringify(ultimo); }
          }
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
      // Guardar la fase en la que estaba para poder restaurarla al reactivar (col BK fase_antes_descarte)
      try {
        const _fa = normalizarFase(comu.fase_presupuesto);
        if (_fa && _fa !== "ZZ_DESCARTADO" && _fa !== "ZZ_RECHAZADO") {
          const _sh = getSheetsClient();
          await _sh.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `comunidades!BK${comu._rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [[_fa]] },
          });
        }
      } catch (_) {}
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
      // Leer la fase en la que estaba antes de descartar (col BK fase_antes_descarte)
      let _fasePrevia = "";
      try {
        const _sh = getSheetsClient();
        const _r = await _sh.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `comunidades!BK${comu._rowIndex}` });
        _fasePrevia = normalizarFase((((_r.data.values || [])[0] || [])[0]) || "");
      } catch (_) { _fasePrevia = ""; }
      if (_fasePrevia && _fasePrevia !== "ZZ_DESCARTADO" && _fasePrevia !== "ZZ_RECHAZADO") {
        // Restaurar al punto EXACTO en el que estaba: misma fase, SIN borrar fechas ni contadores de mail.
        comu.fase_presupuesto = _fasePrevia;
        await actualizarComunidad(comu._rowIndex, comu);
        // limpiar la marca ya restaurada
        try {
          const _sh2 = getSheetsClient();
          await _sh2.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `comunidades!BK${comu._rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [[""]] },
          });
        } catch (_) {}
      } else {
        // Sin marca (descartados antes de este cambio): comportamiento anterior -> 01_CONTACTO reseteando.
        comu.fase_presupuesto = "01_CONTACTO";
        comu.fecha_contacto = new Date().toISOString().slice(0, 10);
        comu.fecha_visita = "";
        comu.fecha_envio_pto = "";
        comu.fecha_ultimo_seguimiento_pto = "";
        comu.fecha_aceptacion_pto = "";
        comu.decision_pto = "";
        comu.mails_enviados = "";
        comu.mails_manuales = "";
        comu.mails_ultimo_envio = "";
        await actualizarComunidad(comu._rowIndex, comu);
      }
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
          cco: plantilla.cco || "",
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
  // =================================================================
  // ENVÍO ASÍNCRONO DE MAILS (anti-cuelgue + anti-duplicado)
  // -----------------------------------------------------------------
  // enviarMailReal descarga adjuntos de Drive y manda por SMTP; con
  // adjuntos eso tarda y el navegador perdía la respuesta -> el modal se
  // quedaba en "Enviando..." aunque el mail SÍ salía. Ahora el endpoint
  // responde al instante {encolado} con un envioId, hace el trabajo por
  // detrás y guarda el resultado en _enviosJobs; el modal sondea
  // /envio-estado hasta tener el resultado. Idempotente por envioId: el
  // mismo id NO reenvía, devuelve el resultado ya calculado (protege de
  // duplicados por re-clic o reconexión).
  // =================================================================
  const _enviosJobs = new Map(); // envioId -> { estado, status, isJson, payload, error, ts }

  function _podarEnviosJobs() {
    const lim = Date.now() - 10 * 60 * 1000; // 10 min
    for (const [k, v] of _enviosJobs.entries()) {
      if ((v.ts || 0) < lim) _enviosJobs.delete(k);
    }
  }

  // Res "falso" que captura status/json/send en vez de escribir a la red.
  function _crearFakeRes() {
    const r = { _status: 200, _payload: null, _isJson: false };
    r.status = (c) => { r._status = c; return r; };
    r.type = () => r;
    r.json = (o) => { r._payload = o; r._isJson = true; return r; };
    r.send = (t) => { r._payload = t; r._isJson = false; return r; };
    return r;
  }

  // Envuelve un core(req,res) para ejecutarlo en segundo plano con idempotencia.
  // Sin envioId en el body -> ejecuta el core de forma SÍNCRONA (compat: p.ej.
  // "Saltar envío", que no manda correo y es rápido).
  function _envolverEnvioAsync(coreFn) {
    return async function (req, res) {
      const envioId = String((req.body && req.body.envioId) || "").trim();
      if (!envioId) return coreFn(req, res);
      if (!checkToken(req, res)) return;
      _podarEnviosJobs();
      if (_enviosJobs.has(envioId)) {
        // Idempotente: NO se reenvía. El modal verá el resultado al sondear.
        return res.json({ encolado: true, envioId, yaExistia: true });
      }
      _enviosJobs.set(envioId, { estado: "en_curso", ts: Date.now() });
      res.json({ encolado: true, envioId }); // responde YA, sin esperar al envío
      (async () => {
        const fake = _crearFakeRes();
        try {
          await coreFn(req, fake);
          const st = fake._status || 200;
          _enviosJobs.set(envioId, {
            estado: st >= 200 && st < 300 ? "ok" : "error_http",
            status: st,
            isJson: fake._isJson,
            payload: fake._payload,
            ts: Date.now(),
          });
        } catch (e) {
          const m = String((e && e.message) || e);
          _enviosJobs.set(envioId, { estado: "error", status: 500, isJson: false, payload: m, error: m, ts: Date.now() });
        }
      })();
    };
  }

  // GET /presupuestos/expediente/envio-estado?envioId=...
  app.get("/presupuestos/expediente/envio-estado", (req, res) => {
    if (!checkToken(req, res)) return;
    const envioId = String(req.query.envioId || "").trim();
    const job = _enviosJobs.get(envioId);
    if (!job) return res.json({ estado: "desconocido" });
    res.json({
      estado: job.estado,
      status: job.status || null,
      isJson: !!job.isJson,
      payload: job.payload != null ? job.payload : null,
    });
  });

  const _coreMailManual = async (req, res) => {
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
        cc,
        cco,
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
  };
  app.post("/presupuestos/expediente/mail-enviar-manual", _envolverEnvioAsync(_coreMailManual));

  // POST /presupuestos/expediente/enviar-mail
  // body: id, fase, asunto, mensaje, destinatario, adjuntos, tipo
  // tipo: "manual_inicial" (1er envío del confirm) | "automatico" (cron) | "manual" (legacy)
  // Envío REAL via SMTP (nodemailer). La cuenta de salida la indica la plantilla
  // (col J `cuenta_envio` de mail_plantillas) referenciando una fila de mail_cuentas.
  // NOTA: el descarte por tope NO lo hace este endpoint — lo hace el cron diario 30 días después.
  const _coreEnviarMail = async (req, res) => {
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
          cc:  ccR,
          cco: ccoR,
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
        cc:  ccManual,
        cco: ccoF,
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
        // v18.41: SIEMBRA de la fase 04. El mail del presupuesto (plantilla 03)
        // es el PRIMER MANUAL de la cadena de seguimiento de la fase 04. Hasta
        // ahora solo se anotaba bajo la clave 03_ENVIO_PTO (su etapa de origen)
        // y la clave 04 quedaba vacía -> el indicador nacía 0+0/3 "no iniciado"
        // y el cron solo arrancaba de chiripa vía el fallback de fecha. Ahora
        // sembramos la clave 04 como manual nº1, con la MISMA fecha del envío
        // real (ultimo["03_ENVIO_PTO"]), idéntico patrón al de 04->05 y 07->08.
        // Resultado: nace 1+0/3 y el cron de la 04 arranca limpio desde la clave.
        // Las variables enviados/manuales/ultimo siguen vivas (se serializaron
        // arriba, líneas ~8047-8064); las reutilizamos y volvemos a serializar.
        enviados["04_ACEPTACION_PTO"] = 1;
        manuales["04_ACEPTACION_PTO"] = 1;
        ultimo["04_ACEPTACION_PTO"] = ultimo["03_ENVIO_PTO"] || hoy;
        comu.mails_enviados = JSON.stringify(enviados);
        comu.mails_manuales = JSON.stringify(manuales);
        comu.mails_ultimo_envio = JSON.stringify(ultimo);
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
  };
  app.post("/presupuestos/expediente/enviar-mail", _envolverEnvioAsync(_coreEnviarMail));

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
                cc:  destCc,
                cco: plantilla.cco,
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
              // Primer reenvío automático a 'di' días desde el último envío
              // MANUAL registrado en la clave de la fase. v18.41: ELIMINADO el
              // fallback a comu.fecha_ultimo_seguimiento_pto. Antes, un expediente
              // que entraba en 04 SIN enviar mail (botón "Saltar envío" o avance
              // genérico) tenía la fecha de seguimiento sellada y el cron
              // arrancaba SOLO, mandando seguimientos no deseados (la clave 04
              // estaba vacía pero el fallback la suplía). Regla acordada: el cron
              // de la 04 SOLO arranca si hay un envío real registrado en la clave
              // 04 (envío del presupuesto, reenvío revisado o fecha manual). Sin
              // clave 04 poblada -> ultimo[fase] es undefined -> no dispara
              // (queda en espera hasta que el usuario actúe). El modo "fecha
              // manual" de arriba sigue intacto: marcar fecha SÍ arranca el cron.
              fechaBase = ultimo[fase];
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
                cc:  destCc04,
                cco: plantilla.cco,
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
      // Registrar en mail_historico — v18.35: vía _reclasificarOInsertarHistorico,
      // que evita duplicados por message_id (si el mail ya estaba clasificado, MUEVE
      // la fila existente a este expediente en vez de añadir otra; y limpia copias
      // sobrantes si las hubiera de arrastres anteriores).
      await _reclasificarOInsertarHistorico({
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
      // v17.31: estos dos se usan para avisosPlazo y para los badges de plazo de HOY.
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
          selectBgStyle = "background:var(--ptl-success-light);color:var(--ptl-success-dark);font-weight:600";
          opcionInicialHtml = `<option value="${_esc(m.clasificado_a)}" selected>✓ ${_esc(dirAsignadaSel)}</option>`;
          valorInicial = m.clasificado_a;
          excluirCcpp = m.clasificado_a;
        } else {
          // Sin asignar: fondo amarillo y "— elegir expediente —".
          selectBgStyle = "background:var(--ptl-warning-light);color:var(--ptl-warning-dark);font-weight:600";
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

        const bgFilaMail = (idx % 2 === 1) ? "background:var(--ptl-general-2);" : "background:var(--ptl-general-3);";
        return `
          <div class="ptl-com-row" data-idx="${idx}" style="${bgFilaMail}border-bottom:1px solid var(--ptl-gray-100)">
            <div class="ptl-com-grid" style="display:grid;grid-template-columns:75px 18px 1fr auto 22px 22px 22px 22px;gap:4px;align-items:center;font-size:11px;padding:0 6px;line-height:1.1">
              <div style="color:var(--ptl-gray-700);white-space:nowrap;font-size:11px">${_esc(fechaTxt)}</div>
              <div style="text-align:center;color:${flechaColor};font-weight:600">${flechaTxt}</div>
              <div class="hoy-toggle-detail hoy-asunto-clic" data-idx="${idx}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--ptl-gray-800)" title="${_esc(remitenteTxt)} — ${_esc(asuntoTxt)}">${_esc(asuntoTxt)}</div>
              <div>${selectAsignar}</div>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-responder" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Responder (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↩</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reenviar" data-mail-id="${_esc(m.id)}" data-mid="${_esc(m.message_id || '')}" data-ccpp="${_esc(m.clasificado_a || '')}" title="Reenviar (requiere clasificar antes)" style="color:var(--ptl-brand);font-weight:bold">↪</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-acordeon hoy-reloj ptl-btn-reloj" data-mail-id="${_esc(m.id)}" data-enhoy="1" title="Quitar de HOY">⏰</button>
              <button type="button" class="ptl-vec-btn ptl-vec-btn-borrar hoy-descartar" data-mail-id="${_esc(m.id)}" title="Borrar este mail (incluidos sus adjuntos en Drive)">✕</button>
            </div>
            <div class="hoy-detail" data-idx="${idx}" style="display:none;padding:8px 12px 12px 12px;background:var(--ptl-gray-50);border-top:1px solid var(--ptl-gray-100);font-size:12px">
              <div style="margin-bottom:4px"><strong>Remitente:</strong> ${_esc(remitenteTxt)}</div>
              <div style="margin-bottom:4px"><strong>Asunto:</strong> ${_esc(asuntoTxt)}</div>
              <div style="margin-bottom:4px"><strong>Mensaje:</strong></div>
              <div style="white-space:pre-line;word-break:break-word;background:var(--ptl-general-3);padding:8px;border:1px solid var(--ptl-gray-200);border-radius:4px;color:var(--ptl-gray-800);max-height:200px;overflow-y:auto">${_renderCuerpoMail(cuerpo, _esc) || '<span style="color:var(--ptl-gray-400);font-style:italic">(sin cuerpo)</span>'}</div>
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
            : `<div class="hoy-mails-list" style="overflow:visible;border-radius:5px;background:var(--ptl-general-3)">${mailsPendientes.map((m, i) => renderMailPendiente(m, i)).join("")}</div>`
          }
        </div>
      `;

      // ============================================================
      // v18.162 — Caja "Sin responder a la presentacion": pisos en pregunta_tipo
      // que llevan >= t_presentacion_2 dias (def 5) sin elegir su situacion (1-5).
      // ============================================================
      const _fmtTel = (tel) => { let n = String(tel || "").replace(/[^0-9]/g, ""); if (n.length === 11 && n.startsWith("34")) n = n.slice(2); if (n.length === 13 && n.startsWith("0034")) n = n.slice(4); if (n.length === 9) return n.slice(0, 3) + "-" + n.slice(3, 6) + "-" + n.slice(6); return n || ""; };
      let _avisosArr = [];
      try {
        const _sheetsSR = getSheetsClient();
        let _umbralPresent = 5;
        try {
          const _pl = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_BOT_PLANTILLAS });
          const _plr = (_pl.data.values || []);
          for (let i = 1; i < _plr.length; i++) {
            if (_plr[i] && String(_plr[i][0] || "").trim() === "t_presentacion_2") {
              const _n = parseFloat(String(_plr[i][3] || "").replace(",", ".").trim());
              if (!isNaN(_n) && _n >= 0) _umbralPresent = _n;
              break;
            }
          }
        } catch (e) {}
        const _exp = await _sheetsSR.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:AD" });
        const _erows = (_exp.data.values || []);
        const _hoyMs = Date.now();
        for (let i = 1; i < _erows.length; i++) {
          const r = _erows[i]; if (!r || !r[0]) continue;
          const _paso = String(r[5] || "").trim();
          const _interv = String(r[23] || "").trim().toLowerCase() === "si";
          const _base = { comunidad: r[1] || "", vivienda: r[2] || "", nombre: r[3] || "", telefono: r[0] || "" };
          if (_interv) {
            // 3er fallo: falta validar un documento (tiene PRIORIDAD sobre "completa")
            if (String(r[29] || "").trim() === "1") continue; // ya revisado -> no mostrar
            _avisosArr.push(Object.assign({ tipo: "faltan", dias: 0, flag: false }, _base));
          } else if (_paso === "pregunta_tipo") {
            const _fUlt = r[10] || r[9] || "";
            const _d = new Date(_fUlt);
            const _dias = isNaN(_d.getTime()) ? 0 : Math.floor((_hoyMs - _d.getTime()) / 86400000);
            if (_dias < _umbralPresent) continue;
            _avisosArr.push(Object.assign({ tipo: "presentacion", dias: _dias, flag: String(r[26] || "").trim() === "1" }, _base));
          } else if (_paso === "finalizado") {
            if (String(r[27] || "").trim() === "1") continue; // ya revisado -> no mostrar
            _avisosArr.push(Object.assign({ tipo: "completo", dias: 0, flag: false }, _base));
          }
        }
        _avisosArr.sort((a, b) => { const _o = { presentacion: 0, faltan: 1, completo: 2 }; return (_o[a.tipo] !== _o[b.tipo]) ? (_o[a.tipo] - _o[b.tipo]) : ((b.dias || 0) - (a.dias || 0)); });
      } catch (e) { console.error("[presupuestos] HOY avisos:", e.message); _avisosArr = []; }

      const _normComu = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      const _ccppPorDir = {};
      try {
        for (const c of comusListado) {
          const cid = c.ccpp_id || "";
          if (!cid) continue;
          const k1 = _normComu(c.direccion || "");
          const k2 = _normComu(c.comunidad || "");
          if (k1 && !_ccppPorDir[k1]) _ccppPorDir[k1] = cid;
          if (k2 && !_ccppPorDir[k2]) _ccppPorDir[k2] = cid;
        }
      } catch (e) {}

      const _notaPorPiso = {};
      try {
        const _pr = await getSheetsClient().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGO_PISOS });
        const _prr = _pr.data.values || [];
        const _ph = _prr[0] || [];
        const _ic = _ph.indexOf("comunidad"), _iv = _ph.indexOf("vivienda"), _in = _ph.indexOf("notas_piso");
        if (_ic >= 0 && _iv >= 0 && _in >= 0) {
          for (let i = 1; i < _prr.length; i++) {
            const f = _prr[i]; if (!f) continue;
            _notaPorPiso[_normComu(f[_ic] || "") + "||" + String(f[_iv] || "").trim().toLowerCase()] = String(f[_in] || "");
          }
        }
      } catch (e) {}

      const renderAviso = (p) => {
        const _ccpp = _ccppPorDir[_normComu(p.comunidad)] || "";
        const _urlPiso = _ccpp ? (urlT(token, "/documentacion/expediente", { id: _ccpp }) + "#piso-" + encodeURIComponent(p.vivienda || "")) : "";
        const _dir = _esc(p.comunidad || "");
        const _dirSty = "flex:0 0 160px;font-weight:700;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        const _dirHtml = _urlPiso
          ? `<a href="${_esc(_urlPiso)}" class="hoy-exp-titulo" style="${_dirSty};text-decoration:none" title="${_dir}">${_dir}</a>`
          : `<span class="hoy-exp-titulo" style="${_dirSty}" title="${_dir}">${_dir}</span>`;
        const _nota = _esc(_notaPorPiso[_normComu(p.comunidad) + "||" + String(p.vivienda || "").trim().toLowerCase()] || "");
        const _notaHtml = _ccpp
          ? `<textarea class="hoy-piso-notas" data-ccpp-id="${_esc(_ccpp)}" data-vivienda="${_esc(p.vivienda || "")}" data-orig="${_nota}" rows="1" placeholder="(notas del piso)" style="flex:1;margin:0 8px;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${_nota}</textarea>`
          : `<span style="flex:1;margin:0 8px;color:var(--ptl-gray-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_nota}</span>`;
        let _campo, _chkTitle, _badge;
        if (p.tipo === "presentacion") {
          _campo = "llamado"; _chkTitle = "Marcar como llamado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-danger" style="flex:0 0 auto">${p.dias} días sin responder a presentación</span>`;
        } else if (p.tipo === "faltan") {
          _campo = "revisado_faltan"; _chkTitle = "Marcar como revisado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-danger" style="flex:0 0 auto">faltan documentos</span>`;
        } else {
          _campo = "revisado"; _chkTitle = "Marcar como revisado";
          _badge = `<span class="ptl-fila-badge ptl-fila-badge-decidir" style="flex:0 0 auto">Documentación completa · revisar</span>`;
        }
        return `
        <div class="hoy-exp-fila" style="display:flex;align-items:center;gap:8px;padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:var(--ptl-general-3)">
          ${_dirHtml}
          <input type="checkbox" class="hoy-bot-llamado" data-tel="${_esc(p.telefono || "")}" data-campo="${_campo}" title="${_chkTitle}"${p.flag ? " checked" : ""}>
          <span class="hoy-piso-num" style="flex:0 0 auto;font-weight:600;color:var(--ptl-gray-700)">${_esc(p.vivienda || "")}</span>
          <span class="hoy-piso-nombre" style="flex:0 1 auto;max-width:180px;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nombre || "")}</span>
          <span class="hoy-piso-tlf" style="flex:0 0 auto;color:var(--ptl-gray-500);white-space:nowrap">${_esc(_fmtTel(p.telefono))}</span>
          ${_notaHtml}
          ${_badge}
        </div>`;
      };
      const cajaSinRespuesta = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title" style="margin:0">🔔 Avisos (${_avisosArr.length})</div>
          </div>
          ${_avisosArr.length === 0
            ? `<div class="ptl-empty-msg">— Sin avisos —</div>`
            : `<div style="overflow:visible;border-radius:5px;background:var(--ptl-general-3)">${_avisosArr.map(renderAviso).join("")}</div>`
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
        const bgPiso = "var(--ptl-general-3)";
        // v18.74 — El nombre del piso es un enlace a la ficha de DOCUMENTACIÓN
        // (único sitio con el acordeón de pisos) anclado a ese piso: al abrir,
        // la página baja hasta la fila del piso (#piso-<vivienda>). El piso NO
        // existe en la ficha de presupuesto, por eso va a /documentacion.
        const _urlPisoDoc = urlT(token, "/documentacion/expediente", { id: ccppId })
                          + "#piso-" + encodeURIComponent(String(p.vivienda || ""));
        return `
          <div class="hoy-piso-fila" data-ccpp-id="${_esc(ccppId)}" data-vivienda="${_esc(p.vivienda)}" style="display:flex;align-items:center;gap:4px;padding:0 6px 0 22px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgPiso}">
            <a href="${_esc(_urlPisoDoc)}" class="hoy-piso-num" title="Ir a la documentación de este piso" style="flex:0 0 50px;font-weight:600;color:var(--ptl-gray-700);text-decoration:none">${_esc(p.vivienda || "")}</a>
            <span class="hoy-piso-nombre" style="flex:0 0 170px;color:var(--ptl-gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nombre || "")}</span>
            <span class="hoy-piso-tlf" style="flex:0 0 90px;color:var(--ptl-gray-500);white-space:nowrap">${_esc(_fmtTel(p.telefono))}</span>
            <span class="hoy-piso-docs" style="flex:0 0 32px;color:var(--ptl-gray-500);text-align:center;font-weight:600">${_esc(p.docs || "")}</span>
            <textarea class="hoy-piso-notas"
                      data-ccpp-id="${_esc(ccppId)}"
                      data-vivienda="${_esc(p.vivienda)}"
                      data-orig="${notas}"
                      rows="1"
                      placeholder="(sin notas)"
                      style="flex:1;margin-left:8px;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>
            <button type="button"
                    class="ptl-vec-btn hoy-piso-reloj ptl-btn-reloj"
                    data-ccpp-id="${_esc(ccppId)}"
                    data-vivienda="${_esc(p.vivienda)}"
                    data-enhoy="1"
                    title="Quitar piso de HOY"
                    style="flex:0 0 auto;width:18px;height:18px;font-size:9px">⏰</button>
          </div>
        `;
      };

      // v18.11 — Pre-cálculo de "Faltan X de Y" para los expedientes de HOY.
      // (CCPP cuenta como 1 fila + cada piso; "completa" = resumen manual con
      // hechos>=totalRel).
      // Se hace AQUÍ (antes de pintar la caja) porque el cálculo es async (lee
      // los pisos de cada CCPP) y el render del HTML es síncrono. Guardamos el
      // texto ya resuelto en un mapa ccpp_id -> {clase,texto} para leerlo en el render.
      const faltanHoyPorCcpp = {};
      try {
        const { docsCcpp: _dCc, docsPiso: _dPi } = await _leerDocsManuales();
        await Promise.all(expedientesEnHoy.map(async (c) => {
          try {
            const estadosCcpp = _dCc.map(d => String(c["est_" + d.codigo] || "").trim());
            const pisos = await _leerPisosDeCcpp(c.direccion || c.comunidad || "", _dPi);
            // v18.55 — Cuenta IGUAL que la ficha: filtro de docs por fase (helper
            // _contarFaltan), de modo que el mismo expediente da el mismo "Faltan
            // X de Y" en HOY y en la ficha. Antes HOY contaba TODOS los docs CCPP
            // (sin filtrar por fase), p.ej. Sextante 4 metía sus 6 docs previos en
            // la fila CCPP y daba "de 11" en vez de "de 10".
            const { totalFilas, pend } = _contarFaltan(estadosCcpp, _dCc, pisos, _dPi, normalizarFase(c.fase_presupuesto));
            if (totalFilas === 0)      faltanHoyPorCcpp[c.ccpp_id] = { clase: "sinpisos", texto: "sin pisos" };
            else if (pend === 0)       faltanHoyPorCcpp[c.ccpp_id] = { clase: "completo", texto: "✓ Completo" };
            else                       faltanHoyPorCcpp[c.ccpp_id] = { clase: "faltan",   texto: `Faltan ${pend} de ${totalFilas}` };
          } catch (_) { /* sin dato -> sin pill */ }
        }));
      } catch (e) { console.warn("[presupuestos][hoy] faltanHoy:", e.message); }

      const renderExpedienteEnHoy = (c, bloqueIdx, conReloj = true) => {
        const titulo = `${_esc(c.tipo_via || "")} ${_esc(c.direccion || "")}`.trim();
        const notas = _esc(c.notas_pto || "");
        const urlFicha = `/presupuestos/expediente?id=${encodeURIComponent(c.ccpp_id)}&token=${encodeURIComponent(token)}`;
        const pisos = pisosEnHoyPorCcpp[normDir2(c.direccion || c.comunidad)] || [];
        const filasPisos = pisos.map((p, i) => renderFilaPiso(p, c.ccpp_id, i)).join("");
        // v17.59 — Cebra fija: TODAS las cabeceras de CCPP en gris #E0E2E6
        // (independiente del bloqueIdx). Las filas de piso van siempre blancas.
        // Decisión Guille: identificar el bloque por color uniforme.
        const bgCab = "var(--ptl-general-2)";
        // v18.10 — Banner de plazo 👍/⚠️/👎. Se calcula con calcularEstadoPlazo +
        // renderBadgePlazo reutilizando plantillasHoy y f1MapHoy (ya cargados
        // arriba). Va ENTRE las notas
        // y el reloj. Si la fase no genera badge (null), no se muestra nada.
        // v18.18 — faseC se declara AQUÍ (fuera del try) para que esté disponible
        // tanto en el cálculo del badge como en la condición del pill de abajo.
        // (En v18.16/17 estaba dentro del try -> "faseC is not defined" al usarlo
        // fuera. Causaba pantalla de Error al cargar /presupuestos/hoy.)
        const faseC = normalizarFase(c.fase_presupuesto);
        let badgeHoy = "";
        try {
          const ep = calcularEstadoPlazo(c, plantillasHoy[faseC] || null, f1MapHoy);
          badgeHoy = renderBadgePlazo(ep) || "";
        } catch (_) { badgeHoy = ""; }
        // v18.16 — El pill "Faltan X de Y" SOLO tiene sentido en fases con
        // documentación (05_DOCUMENTACION y 08_CYCP), donde se cuentan CCPP + pisos.
        // En el resto de fases (01/02/03/04/06/07...) no hay docs que contar, así que
        // NO se muestra (antes salía "Faltan 1 de 1" / "✓ Completo" sin sentido, p.ej.
        // en un expediente de fase 03 marcado con reloj).
        let pillFaltanHoy = "";
        const _esFaseConDocs = (faseC === "05_DOCUMENTACION" || faseC === "08_CYCP");
        const _f = _esFaseConDocs ? faltanHoyPorCcpp[c.ccpp_id] : null;
        if (_f) {
          const _cls = _f.clase === "completo" ? "ptl-fila-badge-success"
                     : _f.clase === "sinpisos" ? "ptl-fila-badge-neutro"
                     : "ptl-fila-badge-danger";
          pillFaltanHoy = `<span class="ptl-fila-badge ptl-fila-badge-fijo ${_cls}">${_esc(_f.texto)}</span>`;
        }
        return `
          <div class="hoy-exp-bloque" data-ccpp-id="${_esc(c.ccpp_id)}">
            <div class="hoy-exp-fila" data-ccpp-id="${_esc(c.ccpp_id)}" style="display:flex;align-items:center;gap:8px;padding:0 6px;border-bottom:1px solid var(--ptl-gray-100);min-height:22px;font-size:11px;line-height:1.1;background:${bgCab}">
              <a href="${_esc(urlFicha)}" class="hoy-exp-titulo" style="flex:0 0 160px;font-weight:700;color:var(--ptl-gray-700);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(titulo)}">${titulo}</a>
              <input type="checkbox" class="hoy-exp-visto" data-ccpp-id="${_esc(c.ccpp_id)}" title="Marcar como revisado hoy"${String(c.visto_hoy || "").trim() === "1" ? " checked" : ""}>
              <textarea class="hoy-exp-notas" data-ccpp-id="${_esc(c.ccpp_id)}" data-orig="${notas}" rows="1" placeholder="(sin notas)" style="flex:1;padding:1px 6px;border:1px solid var(--ptl-gray-200);border-radius:4px;font-family:inherit;font-size:11px;line-height:1.2;resize:vertical;min-height:18px">${notas}</textarea>
              ${badgeHoy ? `<span style="flex:0 0 auto">${badgeHoy}</span>` : ""}
              ${pillFaltanHoy}
              ${conReloj
                ? `<button type="button"
                      class="ptl-vec-btn hoy-exp-reloj ptl-btn-reloj"
                      data-ccpp-id="${_esc(c.ccpp_id)}"
                      data-pisos-activos="${pisos.length}"
                      data-enhoy="1"
                      title="Quitar de HOY"
                      style="flex:0 0 auto;width:18px;height:18px;font-size:9px">⏰</button>`
                : `<span title="Aparece automáticamente por su aviso (no marcado a mano)" style="flex:0 0 auto;width:18px;height:18px;display:inline-block"></span>`}
            </div>
            ${filasPisos}
          </div>
        `;
      };

      // v18.09 — Agrupar los expedientes de HOY POR FASE, dentro de la MISMA caja.
      // Orden lógico de fases y su etiqueta legible. Cualquier fase no listada
      // (rara) cae en un grupo "Otros" al final. La clave se normaliza con
      // normalizarFase para tolerar variantes del Sheet.
      const _ORDEN_FASES_HOY = [
        ["01_CONTACTO",        "01 · Contacto"],
        ["02_VISITA",          "02 · Visita"],
        ["03_ENVIO_PTO",       "03 · Envío PTO"],
        ["04_ACEPTACION_PTO",  "04 · Aceptación PTO"],
        ["05_DOCUMENTACION",   "05 · Documentación"],
        ["06_VISITA_EMASESA",  "06 · Visita EMASESA"],
        ["07_PTE_CYCP",        "07 · Pte CYCP"],
        ["08_CYCP",            "08 · CYCP"],
        ["09_TRAMITADA",       "09 · Tramitados"],
        ["ZZ_RECHAZADO",       "ZZ · Rechazado"],
        ["ZZ_DESCARTADO",      "ZZ · Descartado"],
      ];
      const _faseDe = (c) => {
        try { return normalizarFase(c.fase_presupuesto) || ""; } catch { return String(c.fase_presupuesto || ""); }
      };
      // Construir los grupos en orden; cada expediente va a su fase.
      // Cada item lleva { c, conReloj }: conReloj=true si está marcado (en_hoy="1"),
      // false si entra automáticamente por su badge.
      // v18.15 — Fases que se AUTO-RELLENAN por badge (además de los marcados con reloj):
      // 01_CONTACTO, 04_ACEPTACION_PTO, 05_DOCUMENTACION y 08_CYCP — las cuatro que
      // tienen sistema de badge de plazo. Solo entran las que tienen aviso accionable
      // (⚠️ Decidir / 👎 Retrasado). Las fases sin badge (02/03/06/07) NO se auto-rellenan
      // (siguen mostrando solo lo marcado con reloj). Las cajitas de fase de abajo se
      // mantienen de momento (no se eliminan).
      const _FASES_AUTO_BADGE = new Set(["01_CONTACTO", "04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"]);
      const _gruposHoy = [];
      const _yaEnHoy = new Set(expedientesEnHoy.map(c => c.ccpp_id));
      for (const [clave, etiqueta] of _ORDEN_FASES_HOY) {
        // Marcados con reloj de esta fase (llevan reloj).
        let items = expedientesEnHoy.filter(c => _faseDe(c) === clave).map(c => ({ c, conReloj: true }));
        // Auto-relleno por badge en las fases configuradas.
        if (_FASES_AUTO_BADGE.has(clave)) {
          for (const c of comusListado) {
            if (_faseDe(c) !== clave) continue;
            if (_yaEnHoy.has(c.ccpp_id)) continue; // ya está (marcado) -> no duplicar
            // Fase 08: excluir los ya cerrados (fecha_cycp_completa), igual que la cajita 08 de abajo.
            if (clave === "08_CYCP" && c.fecha_cycp_completa) continue;
            let ep = null;
            try { ep = calcularEstadoPlazo(c, plantillasHoy[clave] || null, f1MapHoy); } catch (_) { ep = null; }
            // v18.17 — Solo entran AUTOMÁTICAMENTE los ⚠️ Decidir (ámbar). Los
            // 👎 Retrasado NO se auto-rellenan: un retrasado es uno que ya se
            // decidió seguir empujando, así que no necesita volver a saltar a HOY
            // hasta que su ciclo se agote y vuelva a "Decidir". (Si el usuario lo
            // marca con el reloj a mano, sí saldrá — eso entra por la otra vía.)
            if (ep && ep.estado === "decidir") {
              items.push({ c, conReloj: false });
            }
          }
        }
        if (items.length) {
          // v18.23 — total real de la fase (Y del "X de Y"): todos los expedientes
          // del listado activo que están en esta fase (mismo criterio que el número
          // de los botones de fase de arriba). X = items.length (los mostrados en HOY).
          const totalFase = comusListado.filter(c => _faseDe(c) === clave).length;
          _gruposHoy.push({ etiqueta, items, total: totalFase });
        }
      }
      // "Otros": cualquier fase que no esté en la lista de arriba (solo marcados).
      const _clavesConocidas = new Set(_ORDEN_FASES_HOY.map(x => x[0]));
      const _otros = expedientesEnHoy.filter(c => !_clavesConocidas.has(_faseDe(c))).map(c => ({ c, conReloj: true }));
      if (_otros.length) _gruposHoy.push({ etiqueta: "Otros", items: _otros, total: _otros.length });

      // v18.15 — Calcular "Faltan X de Y" también para los AUTOMÁTICOS de fases que
      // llevan documentación (05 y 08). Las fases 01 y 04 no llevan docs, así que no
      // necesitan este cálculo. Los marcados con reloj ya están en faltanHoyPorCcpp.
      const _FASES_CON_DOCS = new Set(["05_DOCUMENTACION", "08_CYCP"]);
      try {
        const _pendientesFaltan = [];
        for (const g of _gruposHoy) {
          for (const it of g.items) {
            if (!it.conReloj && _FASES_CON_DOCS.has(_faseDe(it.c)) && !faltanHoyPorCcpp[it.c.ccpp_id]) {
              _pendientesFaltan.push(it.c);
            }
          }
        }
        if (_pendientesFaltan.length) {
          const { docsCcpp: _dCc2, docsPiso: _dPi2 } = await _leerDocsManuales();
          await Promise.all(_pendientesFaltan.map(async (c) => {
            try {
              const estadosCcpp = _dCc2.map(d => String(c["est_" + d.codigo] || "").trim());
              const pisos = await _leerPisosDeCcpp(c.direccion || c.comunidad || "", _dPi2);
              // v18.55 — cuenta igual que la ficha (filtro por fase). Ver bloque arriba.
              const { totalFilas, pend } = _contarFaltan(estadosCcpp, _dCc2, pisos, _dPi2, normalizarFase(c.fase_presupuesto));
              if (totalFilas === 0)      faltanHoyPorCcpp[c.ccpp_id] = { clase: "sinpisos", texto: "sin pisos" };
              else if (pend === 0)       faltanHoyPorCcpp[c.ccpp_id] = { clase: "completo", texto: "✓ Completo" };
              else                       faltanHoyPorCcpp[c.ccpp_id] = { clase: "faltan",   texto: `Faltan ${pend} de ${totalFilas}` };
            } catch (_) {}
          }));
        }
      } catch (e) { console.warn("[presupuestos][hoy] faltanHoy auto-05:", e.message); }

      // v18.72 — ORDEN de los expedientes dentro de las fases 04, 05 y 08 (petición Guille).
      // Prioridad de grupos y, dentro de cada grupo, criterio de ordenación:
      //   1º Retrasado  -> de MÁS a MENOS días de retraso.
      //   2º Decidir    -> de MÁS a MENOS X de "Faltan X de Y".
      //   3º En plazo   -> de MÁS a MENOS X.
      //   4º Sin badge de estado -> de MÁS a MENOS X (sin "Faltan" -> al final).
      //   Desempate en CUALQUIER grupo: orden alfabético de la dirección.
      // El estado sale de calcularEstadoPlazo (mismo que pinta el badge) y la X
      // de faltanHoyPorCcpp (mismo "Faltan X de Y" que se muestra). Solo reordena;
      // no añade ni quita expedientes.
      const _FASES_ORDEN_BADGE = new Set(["04_ACEPTACION_PTO", "05_DOCUMENTACION", "08_CYCP"]);
      // rango de grupo: 0=retrasado, 1=decidir, 2=en plazo, 3=sin badge
      const _rangoEstadoHoy = (c, clave) => {
        let ep = null;
        try { ep = calcularEstadoPlazo(c, plantillasHoy[clave] || null, f1MapHoy); } catch (_) { ep = null; }
        if (ep && ep.estado === "retrasado") return { g: 0, dias: ep.diasRetraso || 0 };
        if (ep && ep.estado === "decidir")   return { g: 1, dias: 0 };
        if (ep && ep.estado === "en_plazo")  return { g: 2, dias: 0 };
        return { g: 3, dias: 0 };
      };
      // X de "Faltan X de Y" para ordenar. Devuelve null si la fila NO tiene
      // "Faltan X de Y" (completo / sin pisos / fase sin docs): esas van SIEMPRE
      // al final de su grupo, tanto en orden ascendente como descendente.
      const _faltanXHoy = (c) => {
        const f = faltanHoyPorCcpp[c.ccpp_id];
        if (!f || f.clase !== "faltan") return null;
        const m = /Faltan\s+(\d+)\s+de/.exec(f.texto || "");
        return m ? parseInt(m[1], 10) : null;
      };
      const _dirOrden = (c) => String(c.direccion || c.comunidad || "").toLowerCase();
      for (const g of _gruposHoy) {
        const clave = (_ORDEN_FASES_HOY.find(([, et]) => et === g.etiqueta) || [])[0]
                   || (g.items[0] ? _faseDe(g.items[0].c) : "");
        if (!_FASES_ORDEN_BADGE.has(clave)) continue;
        g.items.sort((A, B) => {
          const ra = _rangoEstadoHoy(A.c, clave), rb = _rangoEstadoHoy(B.c, clave);
          if (ra.g !== rb.g) return ra.g - rb.g;                 // grupo: retrasado < decidir < en plazo < sin badge
          if (ra.g === 0 && ra.dias !== rb.dias) return rb.dias - ra.dias; // retrasados: más días primero
          if (ra.g !== 0) {                                      // resto: MÁS X primero (de más a menos)
            const xa = _faltanXHoy(A.c), xb = _faltanXHoy(B.c);
            // los que no tienen "Faltan" (null) van al final del grupo
            if (xa === null && xb !== null) return 1;
            if (xa !== null && xb === null) return -1;
            if (xa !== null && xb !== null && xa !== xb) return xb - xa; // descendente
          }
          return _dirOrden(A.c).localeCompare(_dirOrden(B.c), "es"); // desempate alfabético
        });
      }

      // Cabecerita de grupo de fase (una línea fina, no es un expediente).
      // v18.23 — fondo AZUL OSCURO + texto AZUL CLARO (sistema de 2 azules). El
      // contador pasa a "X de Y": X = expedientes mostrados en HOY de esa fase,
      // Y = total de expedientes de esa fase (mismo número que el botón de fase).
      const _subcabFase = (etiqueta, n, total) => {
        // v18.75 — El contador "(X de Y)" se pinta de rojo (--ptl-danger) cuando
        // X != Y (faltan expedientes de esa fase por sacar a HOY). Si X == Y
        // (están todos) se queda en --ptl-general-2 como el título.
        const _colNum = (n === total) ? "var(--ptl-general-2)" : "var(--ptl-danger)";
        return `
        <div style="display:flex;align-items:center;gap:6px;margin-left:-10px;padding:5px 8px 2px 2px;background:var(--ptl-general-1);border-bottom:1px solid var(--ptl-gray-200);font-size:10px;font-weight:700;color:var(--ptl-general-2);text-transform:uppercase;letter-spacing:.4px">
          ${_esc(etiqueta)} <span style="font-weight:600;color:${_colNum};opacity:.85">(${n} de ${total})</span>
        </div>`;
      };

      // Pintar: por cada grupo, su subcabecera + sus expedientes (que mantienen
      // exactamente el mismo render de antes, con notas, reloj y sub-filas de pisos).
      let _bloqueIdx = 0;
      const _listaHoyHtml = _gruposHoy.map(g =>
        _subcabFase(g.etiqueta, g.items.length, g.total) +
        g.items.map(it => renderExpedienteEnHoy(it.c, _bloqueIdx++, it.conReloj)).join("")
      ).join("");

      // v18.13 — total real = suma de items de todos los grupos (marcados + automáticos por badge).
      const _totalHoy = _gruposHoy.reduce((acc, g) => acc + g.items.length, 0);
      const cajaExpedientesHoy = `
        <div class="ptl-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="ptl-card-title" style="margin:0">📋 Expedientes HOY (${_totalHoy})</div>
          </div>
          ${_totalHoy === 0
            ? `<div style="padding:8px 4px;color:var(--ptl-gray-500);font-size:11px;font-style:italic">— Sin expedientes marcados —</div>`
            : `<div class="hoy-exp-list" style="border-radius:5px;background:var(--ptl-general-3)">${_listaHoyHtml}</div>`
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
        // v18.51: sub-grupos de tramitado por los 3 estados de la fase 09
        // (En ejecución / Pendiente de cobro / Cobrado). Acumulan importe y
        // beneficio (real si > 0, si no previsto — misma regla que el grupo padre).
        tramitadoEjecucion:  { importe: 0, beneficio: 0, tiempo: 0 },
        tramitadoPteCobro:   { importe: 0, beneficio: 0, tiempo: 0 },
        tramitadoCobrado:    { importe: 0, beneficio: 0, tiempo: 0 },
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
          // Sub-distribución por los 3 estados de la fase 09 (misma lógica que
          // la ficha): fecha_cobro -> Cobrado; si no, fecha_pte_cobro -> Pte
          // cobro; si no -> En ejecución.
          const fco = String(c.fecha_cobro || "").trim();
          const fpc = String(c.fecha_pte_cobro || "").trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(fco)) {
            G.tramitadoCobrado.importe   += importe;
            G.tramitadoCobrado.beneficio += beneficio;
            G.tramitadoCobrado.tiempo    += tiempoCuadrilla;
          } else if (/^\d{4}-\d{2}-\d{2}/.test(fpc)) {
            G.tramitadoPteCobro.importe   += importe;
            G.tramitadoPteCobro.beneficio += beneficio;
            G.tramitadoPteCobro.tiempo    += tiempoCuadrilla;
          } else {
            G.tramitadoEjecucion.importe   += importe;
            G.tramitadoEjecucion.beneficio += beneficio;
            G.tramitadoEjecucion.tiempo    += tiempoCuadrilla;
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
      // v17.41: textos en negro (var(--ptl-gray-900)) — solo los BORDES de cada caja
      // conservan el color identificativo de la paleta. El espacio del extra
      // de la caja 1 se compacta (sin border-top dashed para reducir hueco).
      const NEGRO = "var(--ptl-gray-900)";
      const _cajaEconomica = (titulo, colFases, g, paleta, opts) => {
        opts = opts || {};
        const showBeneficio = opts.showBeneficio !== false;
        // v17.58 — sufijo opcional dentro del valor, p.ej. "(19,1%)"; se
        // renderiza más pequeño y a la izquierda del número para no confundirlo.
        const _linea = (label, valor, sufijo) => `
          <div style="display:flex;align-items:center;margin-top:5px;font-size:12px;color:${NEGRO};line-height:1.3;gap:6px">
            <strong style="white-space:nowrap">${label}</strong>
            <span class="ptl-hr-soft"></span>
            ${sufijo ? `<span style="white-space:nowrap;font-size:10px;font-style:italic;color:var(--ptl-gray-500)">${sufijo}</span>` : ""}
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
          <div style="background:var(--ptl-general-3);border:1px solid ${paleta.border};border-radius:6px;padding:9px;color:${NEGRO};display:flex;flex-direction:column;min-height:100%">
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
        gris:    { border:"var(--ptl-gray-200)" },
        verde:   { border:"var(--ptl-success-light)" },
        azul:    { border:"var(--ptl-general-2)" },
        amarillo:{ border:"var(--ptl-warning-light)" },
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
      // v17.58 / v18.52 — Para que el extra de caja 1 quede a la misma altura
      // que cajas 2/3/4, debe tener las mismas líneas. La caja 4 tiene 6 líneas
      // de extra (Total + 5), así que caja 1 = "inicio del cómputo" + 5 huecos.
      const extraPresupuestado = fechaEnvioMin ? `
        <div class="ptl-caja-sep">
          <div style="font-size:10px;font-style:italic;color:${NEGRO};line-height:1.3">
            inicio del cómputo: ${labelFechaInicio}
          </div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
          <div class="ptl-hueco-extra">·</div>
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
      const _huecoExtra = `<div class="ptl-hueco-extra">·</div>`;
      // v18.52 / v18.53 — Trabajo por delante y fecha "sin trabajo" (cuadrilla 5).
      // Días laborables de trabajo AÚN NO consumido. Se proyecta sobre el
      // calendario saltando sábados y domingos (festivos no se contemplan, son
      // insignificantes) para dar el día en que la cuadrilla se queda sin trabajo.
      // Helper: dado un nº de días laborables, devuelve la fecha DD-MM-AAAA
      // resultante de sumarlos a HOY saltando fines de semana.
      const _fechaSinTrabajoDesde = (dias) => {
        if (!(dias > 0)) return "—";
        const _d = new Date();
        let _restan = dias;
        while (_restan > 0) {
          _d.setDate(_d.getDate() + 1);
          const _dow = _d.getDay();          // 0=domingo, 6=sábado
          if (_dow !== 0 && _dow !== 6) _restan--;
        }
        const _dd = String(_d.getDate()).padStart(2, "0");
        const _mm = String(_d.getMonth() + 1).padStart(2, "0");
        return `${_dd}-${_mm}-${_d.getFullYear()}`;
      };
      // Tiempo ya CONSUMIDO = obras terminadas (Pte cobro + Cobrado), solo en 09.
      const _tiempoConsumido = G.tramitadoPteCobro.tiempo + G.tramitadoCobrado.tiempo;
      // TRAMITADO: por delante = solo lo EN EJECUCIÓN (lo tramitado no consumido).
      const _diasPorDelante  = Math.round(G.tramitadoEjecucion.tiempo);
      const _mesesPorDelante = (G.tramitadoEjecucion.tiempo / 22).toFixed(1).replace(".", ",");
      const _fechaSinTrabajo = _fechaSinTrabajoDesde(_diasPorDelante);
      // ACEPTADO (fases 05-09): por delante = TODO su tiempo MENOS lo consumido
      // (las obras terminadas, que están dentro de la fase 09). Equivale a
      // "pendiente de tramitar + tramitado en ejecución".
      const _diasPorDelanteAcept  = Math.round(G.aceptado.tiempo - _tiempoConsumido);
      const _mesesPorDelanteAcept = ((G.aceptado.tiempo - _tiempoConsumido) / 22).toFixed(1).replace(".", ",");
      const _fechaSinTrabajoAcept = _fechaSinTrabajoDesde(_diasPorDelanteAcept);
      const extraTramitado = `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span style="white-space:nowrap">${fmtMoneda(G.tramitado.beneficio * PCT_BENEF)}</span>
          </div>
          ${_lineaExtra("En ejecución", fmtMoneda(G.tramitadoEjecucion.beneficio * PCT_BENEF))}
          ${_lineaExtra("Pte cobro", fmtMoneda(G.tramitadoPteCobro.beneficio * PCT_BENEF))}
          ${_lineaExtra("Cobrado", fmtMoneda(G.tramitadoCobrado.beneficio * PCT_BENEF))}
          ${_lineaExtra("Por delante", `${_diasPorDelante} días (${_mesesPorDelante} meses)`)}
          ${_lineaExtra("Sin trabajo", _fechaSinTrabajo)}
        </div>
      `;

      // v17.57 / v18.52 — Huecos invisibles para que las cajas 2 y 3 igualen la
      // altura de la caja 4, que bajo "Total (20%)" lleva 5 líneas: En ejecución,
      // Pte cobro, Cobrado, Por delante y Sin trabajo.
      const _extraTotal20 = (g) => `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span style="white-space:nowrap">${fmtMoneda(g.beneficio * PCT_BENEF)}</span>
          </div>
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
        </div>
      `;
      // v18.53 — Aceptado: además del Total (20%), muestra "Por delante" y
      // "Sin trabajo" (mismo concepto que Tramitado pero con TODO el trabajo
      // aceptado no consumido). Lleva 3 huecos donde Tramitado tiene En
      // ejecución/Pte cobro/Cobrado, para que las 2 líneas queden alineadas.
      const extraAceptado = `
        <div class="ptl-caja-sep">
          <div style="display:flex;align-items:center;font-size:10px;color:${NEGRO};line-height:1.3;gap:6px;font-style:italic">
            <strong style="white-space:nowrap;font-style:normal">Total (20%)</strong>
            <span class="ptl-hr-soft"></span>
            <span style="white-space:nowrap">${fmtMoneda(G.aceptado.beneficio * PCT_BENEF)}</span>
          </div>
          ${_huecoExtra}
          ${_huecoExtra}
          ${_huecoExtra}
          ${_lineaExtra("Por delante", `${_diasPorDelanteAcept} días (${_mesesPorDelanteAcept} meses)`)}
          ${_lineaExtra("Sin trabajo", _fechaSinTrabajoAcept)}
        </div>
      `;
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

      const cajaEconomicos = `
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
      // Caja 02-VISITA en HOY (lista de expedientes en fase de visita).
      // ============================================================
      let cajaVisita = "";
      try {
        // Filtrar CCPPs de fase 02-VISITA (única caja de fase que queda en HOY)
        const en02 = comusListado.filter(c => normalizarFase(c.fase_presupuesto) === "02_VISITA");
        en02.sort((a, b) => String(a.direccion || "").localeCompare(String(b.direccion || ""), "es"));


        // Formatea teléfono español a xxx-xxx-xxx (mantiene tal cual si no encajan 9 dígitos).
        function _fmtTel(tel) {
          let s = String(tel || "").replace(/\D/g, "");
          if (s.length === 11 && s.startsWith("34")) s = s.slice(2);
          if (s.length === 13 && s.startsWith("0034")) s = s.slice(4);
          if (s.length === 9) return s.slice(0,3) + "-" + s.slice(3,6) + "-" + s.slice(6,9);
          return s || String(tel || "");
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


        cajaVisita = `
          <div class="ptl-card">
            <div class="ptl-card-title">🚪 02-VISITA (${en02.length})</div>
            ${en02.length === 0
              ? `<div class="ptl-empty-msg">— Sin expedientes en esta fase —</div>`
              : `<div class="ptl-lista-filas hoy-lista-02">${filas02.join("")}</div>`}
          </div>
        `;
      } catch (eFases) {
        console.warn("[presupuestos][hoy] cajitas fases:", eFases.message);
        cajaVisita = `<div class="ptl-card"><div class="ptl-card-title">🚪 02-VISITA</div><div class="ptl-error-msg">Error: ${_esc(eFases.message)}</div></div>`;
      }

      const body = `
        <style>
          /* Asunto clicable de Mails pendientes: hover azul + negrita. */
          .hoy-asunto-clic:hover { color: #000; font-weight: 700; }
          /* Separación vertical entre filas de la cajita 02-VISITA
             (3 líneas por fila se agolpan). */
          .hoy-lista-02 .ptl-lista-fila { padding-bottom: 8px; }
        </style>
        <div class="hoy-page" style="display:grid;gap:0;align-items:start">
          <div>${cajaSinRespuesta}</div>
          <div>${cajaMails}</div>
          <div>${cajaExpedientesHoy}</div>
          <div>${cajaEconomicos}</div>
          <div>${cajaVisita}</div>
        </div>
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

            // v18.21 — Check "visto hoy": al marcar/desmarcar guarda al instante
            // visto_hoy = "1" / "" vía /presupuestos/expediente/campo (mismo endpoint
            // y guardado seguro que el reloj y las notas). Sin recargar la página.
            // Desmarcado manual uno a uno (decisión Guille: no hay limpieza masiva).
            // Si el guardado falla, se revierte el check y se avisa.
            document.querySelectorAll('.hoy-exp-visto').forEach(function(chk){
              chk.addEventListener('change', async function(){
                var ccppId = chk.dataset.ccppId;
                var valor = chk.checked ? '1' : '';
                chk.disabled = true;
                try {
                  var body = new URLSearchParams({ id: ccppId, campo: 'visto_hoy', valor: valor });
                  var res = await fetch('${urlT(token, "/presupuestos/expediente/campo")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) {
                    chk.checked = !chk.checked;
                    var t = await res.text(); alert('No se pudo guardar: ' + t);
                  }
                } catch(e){
                  chk.checked = !chk.checked;
                  alert('No se pudo guardar: ' + e.message);
                } finally {
                  chk.disabled = false;
                }
              });
            });

            // v18.163 — Casilla "Llamado" de la caja Sin responder (guarda en bot_expedientes AA por telefono).
            document.querySelectorAll('.hoy-bot-llamado').forEach(function(chk){
              chk.addEventListener('change', async function(){
                var tel = chk.dataset.tel;
                var campo = chk.dataset.campo || 'llamado';
                var valor = chk.checked ? '1' : '';
                chk.disabled = true;
                try {
                  var body = new URLSearchParams({ tel: tel, campo: campo, valor: valor });
                  var res = await fetch('${urlT(token, "/presupuestos/hoy-bot-llamado")}', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body: body.toString()
                  });
                  if (!res.ok) { chk.checked = !chk.checked; var tx = await res.text(); alert('No se pudo guardar: ' + tx); }
                  else if ((campo === 'revisado' || campo === 'revisado_faltan') && chk.checked) { var _fila = chk.closest('.hoy-exp-fila'); if (_fila) _fila.remove(); }
                } catch(e){ chk.checked = !chk.checked; alert('No se pudo guardar: ' + e.message); }
                finally { chk.disabled = false; }
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
                  sel.style.background = 'var(--ptl-success-light)';
                  sel.style.color = 'var(--ptl-success-dark)';
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
      const cabecera = renderCabeceraComun(token, comusListado, { searchInHeader: true });

      sendHtml(res, pageHtml("HOY",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "HOY", url: "#" }],
        cabecera + body,
        token, { search: true, searchValue: (req.query.q || ""), cron: true }));
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
      sendHtml(res, pageHtml("Plantillas mail",
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

  // GET /presupuestos/mapa — mapa con los expedientes geolocalizados (Leaflet + OSM)
  // Lee la columna `earth` (col L) de cada comunidad, que contiene "lat, lng".
  // Pinta una chincheta por expediente con coordenada, coloreada por grupo de fase.
  // Las coordenadas se cargaron desde el KMZ (ver coordenadas_earth.xlsx, v17.97).
  app.get("/presupuestos/mapa", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    const focusId = String(req.query.focus || "").trim(); // v18.03: centrar en este ccpp_id si viene de la ficha
    try {
      const comunidades = await leerComunidades();
      // Agrupación de fases en bloques de color (para no marear con 11 colores).
      // Devuelve { grupo, color, label } para una fase normalizada.
      const grupoDeFase = (faseRaw) => {
        const f = normalizarFase(faseRaw);
        if (f === "01_CONTACTO" || f === "02_VISITA")
          return { grupo: "contacto", color: "var(--ptl-gray-500)", label: "Contacto / Visita" };
        if (f === "03_ENVIO_PTO" || f === "04_ACEPTACION_PTO")
          return { grupo: "presupuesto", color: "var(--ptl-general-1)", label: "Presupuesto enviado / aceptación" };
        if (f === "05_DOCUMENTACION" || f === "06_VISITA_EMASESA" || f === "07_PTE_CYCP" || f === "08_CYCP")
          return { grupo: "tramite", color: "var(--ptl-warning)", label: "En tramitación" };
        if (f === "09_TRAMITADA")
          return { grupo: "tramitada", color: "var(--ptl-success-dark)", label: "Tramitada" };
        if (f === "ZZ_RECHAZADO" || f === "ZZ_DESCARTADO")
          return { grupo: "rechazado", color: "var(--ptl-danger)", label: "Rechazado / Descartado" };
        return { grupo: "otro", color: "var(--ptl-general-1)", label: "Otros" };
      };
      // Parsear "lat, lng" de la columna earth. Devuelve [lat,lng] o null.
      const parseEarth = (val) => {
        if (!val) return null;
        const m = String(val).match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
        if (!m) return null;
        const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
        if (isNaN(lat) || isNaN(lng)) return null;
        // Sanidad: descartar 0,0 y valores fuera de rango terrestre
        if (lat === 0 && lng === 0) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return [lat, lng];
      };
      // v18.05 — municipio para geocodificar: por defecto Sevilla capital, salvo
      // que el tipo_via lleve el pueblo entre paréntesis (ej. "C (Alcalá de Guadaíra)",
      // "C (Dos Hermanas)", "C (S.Juan)"=San Juan de Aznalfarache). OJO: "(Bellavista)"
      // es barrio de Sevilla capital, no pueblo -> se trata como Sevilla.
      const _municipioGeo = (tipoVia) => {
        const m = String(tipoVia || "").match(/\(([^)]*)\)/);
        if (!m) return "Sevilla";
        let p = m[1].trim();
        if (/bellavista/i.test(p)) return "Sevilla";          // barrio de Sevilla capital
        if (/^s\.?\s*juan/i.test(p)) return "San Juan de Aznalfarache";
        return p; // Alcalá de Guadaíra, Dos Hermanas, etc.
      };
      // Construir los puntos para el front + la lista de PENDIENTES (sin coordenada)
      // que se pueden geocodificar (excluye los "Z SIN DIRECCION", que son relleno).
      const puntos = [];
      const pendientes = [];   // v18.05: para el botón "Ubicar las que faltan"
      let sinCoord = 0;
      for (const c of comunidades) {
        const ll = parseEarth(c.earth);
        const dirFull = (c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || c.comunidad || "");
        if (!ll) {
          sinCoord++;
          // Geocodificable solo si tiene dirección real (no los "Z SIN DIRECCION")
          const dirReal = String(c.direccion || "").trim();
          if (dirReal && !/^z\s+sin\s+direccion/i.test(dirReal)) {
            // Query para Nominatim. NO incluimos el prefijo de vía abreviado
            // (C/Pz/Av/Ur/Bª/NR...): Nominatim casa mejor con "calle número, ciudad"
            // que con la abreviatura delante. Limpiamos "???" y los "Bloque.." sobrantes.
            const dirLimpia = dirReal.replace(/\?+/g, "").replace(/,?\s*bloques?\b.*$/i, "").replace(/\s+/g, " ").trim();
            const muni = _municipioGeo(c.tipo_via);
            pendientes.push({
              id: c.ccpp_id,
              dir: dirFull,
              query: `${dirLimpia}, ${muni}, España`.replace(/\s+/g, " ").trim(),
            });
          }
          continue;
        }
        const g = grupoDeFase(c.fase_presupuesto);
        puntos.push({
          id: c.ccpp_id,
          lat: ll[0], lng: ll[1],
          dir: dirFull,
          fase: normalizarFase(c.fase_presupuesto),
          color: g.color, grupo: g.grupo,
          url: urlT(token, "/presupuestos/expediente", { id: c.ccpp_id }),
        });
      }
      // Leyenda: grupos presentes
      const leyenda = [
        { grupo: "contacto", color: "var(--ptl-gray-500)", label: "Contacto / Visita" },
        { grupo: "presupuesto", color: "var(--ptl-general-1)", label: "Presupuesto / aceptación" },
        { grupo: "tramite", color: "var(--ptl-warning)", label: "En tramitación" },
        { grupo: "tramitada", color: "var(--ptl-success-dark)", label: "Tramitada" },
        { grupo: "rechazado", color: "var(--ptl-danger)", label: "Rechazado / Descartado" },
        // v18.05 — chinchetas geocodificadas SIN confirmar (amarillo + borde negro):
        { grupo: "provisional", color: "var(--ptl-warning)", label: "Sin confirmar (geolocalizada)", borde: "#000" },
      ];
      const leyendaHtml = leyenda.map(l =>
        `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
           <input type="checkbox" checked data-grupo="${l.grupo}" class="mapa-filtro"/>
           <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${l.color};border:${l.borde ? "2px solid " + l.borde : "1px solid rgba(0,0,0,.2)"}"></span>
           ${esc(l.label)}
         </label>`).join("");

      const content = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <h2 style="margin:0">🗺️ Mapa de expedientes</h2>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--ptl-gray-600)">
              ${puntos.length} expedientes en el mapa · <span id="mapa-sincoord">${sinCoord}</span> sin coordenada
            </span>
            ${pendientes.length ? `<button id="mapa-ubicar" type="button"
              style="padding:6px 12px;border:1px solid var(--ptl-warning-dark);background:var(--ptl-warning-light);color:var(--ptl-warning-dark);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
              📍 Ubicar las que faltan (${pendientes.length})</button>` : ""}
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:8px 12px;background:var(--ptl-gray-50,var(--ptl-gray-50));border:1px solid var(--ptl-gray-200);border-radius:8px;margin-bottom:10px">
          ${leyendaHtml}
        </div>
        <div style="position:relative;margin-bottom:8px">
          <input id="mapa-buscar" type="text" autocomplete="off"
            placeholder="🔍 Buscar dirección en el mapa (ej: Doña Clarines)..."
            style="width:100%;max-width:420px;padding:8px 12px;border:1px solid var(--ptl-gray-300);border-radius:8px;font-size:14px"/>
          <div id="mapa-buscar-res" style="position:absolute;z-index:1000;background:var(--ptl-general-flotante);border:1px solid var(--ptl-gray-300);border-radius:8px;max-width:420px;width:100%;max-height:240px;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,.12);display:none"></div>
        </div>
        <div id="mapa-ara" style="width:100%;height:72vh;border:1px solid var(--ptl-gray-300);border-radius:8px"></div>
        <div style="font-size:12px;color:var(--ptl-gray-500);margin-top:6px">
          💡 Pasa el ratón por una chincheta para ver su dirección. Arrástrala para corregir su ubicación (se pedirá confirmación antes de guardar).
        </div>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
        <script>
          (function(){
            var PUNTOS = ${JSON.stringify(puntos)};
            var PENDIENTES = ${JSON.stringify(pendientes)};   // v18.05: sin coordenada, geocodificables
            var GUARDAR_URL = ${JSON.stringify(urlT(token, "/presupuestos/mapa/guardar-coord"))};
            var FOCUS_ID = ${JSON.stringify(focusId)};
            // Aviso si venimos de una ficha SIN coordenada (no se puede centrar).
            var FOCUS_SIN_COORD = ${JSON.stringify(
              focusId && !puntos.some(p => p.id === focusId)
                ? (() => {
                    const c = comunidades.find(x => x.ccpp_id === focusId);
                    return c ? ((c.tipo_via ? c.tipo_via + " " : "") + (c.direccion || c.comunidad || "")) : "";
                  })()
                : ""
            )};
            var map = L.map('mapa-ara', {
              zoomSnap: 0,               // sin "imán" a niveles enteros: zoom continuo
              zoomDelta: 0.3,            // v18.06: pasos más finos (era 0.4) -> más suave
              wheelPxPerZoomLevel: 30,   // v18.06: más rápido aún (era 40 en v18.05); con zoomDelta 0.3 sube rápido pero suave
              wheelDebounceTime: 20,     // v18.33: era 60 -> metía ~60ms de delay entre girar la rueda y reaccionar; a 20 responde casi al instante sin saltar
              zoomAnimation: true
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19, attribution: '© OpenStreetMap'
            }).addTo(map);
            var markersPorGrupo = {};
            var bounds = [];
            // Icono de color por fase: un círculo CSS dentro de un divIcon.
            // Usamos L.marker (no circleMarker) porque solo los marker normales
            // soportan draggable. El divIcon nos deja mantener el color por fase.
            function iconoColor(color, borde){
              // borde: color del borde (por defecto blanco). Las provisionales usan negro.
              var b = borde || '#fff';
              return L.divIcon({
                className: 'mapa-pin',
                html: '<span style="display:block;width:16px;height:16px;border-radius:50%;'
                  + 'background:'+color+';border:2px solid '+b+';box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
                iconSize: [16,16], iconAnchor: [8,8], popupAnchor: [0,-8], tooltipAnchor: [0,-8]
              });
            }
            PUNTOS.forEach(function(p){
              var marker = L.marker([p.lat, p.lng], {
                icon: iconoColor(p.color),
                draggable: true   // arrastrable siempre
              });
              // Hover: muestra la dirección sin hacer clic (tooltip permanente al pasar)
              marker.bindTooltip(p.dir || '(sin dirección)', { direction: 'top', offset: [0,-6] });
              // Clic: globo completo con fase y enlace a la ficha
              var html = '<div style="font-size:13px;line-height:1.5">'
                + '<strong>' + (p.dir || '(sin dirección)') + '</strong><br/>'
                + '<span style="color:var(--ptl-gray-500)">Fase: ' + (p.fase || '-') + '</span><br/>'
                + '<a href="' + p.url + '" style="color:var(--ptl-general-1);font-weight:600">Abrir ficha →</a>'
                + '</div>';
              marker.bindPopup(html);
              // Arrastre: al soltar, pedir confirmación y guardar (o revertir).
              marker._posOrig = [p.lat, p.lng];
              marker.on('dragend', function(){
                var ll = marker.getLatLng();
                var ok = confirm('¿Guardar nueva ubicación de "' + (p.dir||'') + '"?\\n\\n'
                  + 'Nueva coordenada:\\n' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6));
                if (!ok) { marker.setLatLng(marker._posOrig); return; }
                // El backend usa bodyParser.urlencoded (NO multipart/FormData),
                // así que enviamos los datos como x-www-form-urlencoded, igual que
                // el resto del módulo (ver fix análogo v17.84). Con FormData,
                // req.body llegaba vacío -> "Falta id".
                var body = 'id=' + encodeURIComponent(p.id)
                  + '&lat=' + encodeURIComponent(ll.lat)
                  + '&lng=' + encodeURIComponent(ll.lng);
                fetch(GUARDAR_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body
                })
                  .then(function(r){ return r.json(); })
                  .then(function(data){
                    if (data && data.ok) {
                      marker._posOrig = [ll.lat, ll.lng]; // nueva posición confirmada
                      // Parpadeo de "guardado OK": CIAN (var(--ptl-general-1)), color que NO
                      // usamos para ninguna fase (magenta de antes se confundía con
                      // el rojo de "Rechazado"). Parpadea 3 veces y vuelve a su color.
                      var destellos = 6; // 6 cambios = 3 parpadeos completos
                      var n = 0;
                      var iv = setInterval(function(){
                        marker.setIcon(iconoColor(n % 2 === 0 ? 'var(--ptl-general-1)' : p.color));
                        n++;
                        if (n >= destellos) { clearInterval(iv); marker.setIcon(iconoColor(p.color)); }
                      }, 220);
                    } else {
                      alert('No se pudo guardar: ' + (data && data.error ? data.error : 'error'));
                      marker.setLatLng(marker._posOrig);
                    }
                  })
                  .catch(function(e){
                    alert('Error de red al guardar: ' + e.message);
                    marker.setLatLng(marker._posOrig);
                  });
              });
              if (!markersPorGrupo[p.grupo]) markersPorGrupo[p.grupo] = [];
              markersPorGrupo[p.grupo].push(marker);
              p._marker = marker;   // referencia para el buscador
              marker.addTo(map);
              bounds.push([p.lat, p.lng]);
            });
            // v18.33: si venimos de una ficha (FOCUS_ID) y su chincheta existe,
            // centramos SOLO en ella (setView 17) y NOS SALTAMOS el fitBounds general.
            // Antes ambos se lanzaban en el mismo tick: la animación del fitBounds
            // (vista general) pisaba al setView y el mapa se quedaba en vista general
            // "ignorando" el foco. Ahora un único movimiento, sin carrera.
            var pf = FOCUS_ID ? PUNTOS.filter(function(p){ return p.id === FOCUS_ID; })[0] : null;
            if (pf) {
              map.setView([pf.lat, pf.lng], 17, { animate: true });
              if (pf._marker) setTimeout(function(){ pf._marker.openPopup(); }, 300);
            } else {
              if (bounds.length) map.fitBounds(bounds, { padding: [30,30] });
              else map.setView([37.3886, -5.9823], 12); // Sevilla por defecto
              // FOCUS_ID sin chincheta: la dirección de la ficha aún no tiene coordenada.
              if (FOCUS_ID && FOCUS_SIN_COORD) {
                setTimeout(function(){
                  alert('"' + FOCUS_SIN_COORD + '" aún no está ubicada en el mapa '
                    + '(no tiene coordenada). Puedes ubicarla cuando esté disponible la geolocalización automática.');
                }, 400);
              }
            }
            // Filtros por categoría (leyenda con checkboxes): muestra/oculta grupos
            document.querySelectorAll('.mapa-filtro').forEach(function(chk){
              chk.addEventListener('change', function(){
                var g = chk.dataset.grupo;
                (markersPorGrupo[g] || []).forEach(function(m){
                  if (chk.checked) m.addTo(map); else map.removeLayer(m);
                });
              });
            });
            // ---- BUSCADOR ----
            // Filtra los puntos por dirección (sin acentos, ignora mayúsculas) y
            // al elegir uno centra el mapa, hace zoom y abre su globo.
            var inp = document.getElementById('mapa-buscar');
            var box = document.getElementById('mapa-buscar-res');
            function quitarAcentos(s){
              return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
            }
            function irAPunto(p){
              box.style.display = 'none';
              inp.value = p.dir;
              map.setView([p.lat, p.lng], 17, { animate: true });
              if (p._marker) p._marker.openPopup();
            }
            inp.addEventListener('input', function(){
              var q = quitarAcentos(inp.value.trim());
              if (!q) { box.style.display='none'; return; }
              var matches = PUNTOS.filter(function(p){ return quitarAcentos(p.dir).indexOf(q) !== -1; }).slice(0, 12);
              if (!matches.length) { box.innerHTML = '<div style="padding:8px 12px;color:var(--ptl-gray-400);font-size:13px">Sin resultados</div>'; box.style.display='block'; return; }
              box.innerHTML = matches.map(function(p,i){
                return '<div class="mapa-res-item" data-i="'+PUNTOS.indexOf(p)+'" style="padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--ptl-gray-100)">'
                  + '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+p.color+';margin-right:6px"></span>'
                  + p.dir + '</div>';
              }).join('');
              box.style.display = 'block';
              box.querySelectorAll('.mapa-res-item').forEach(function(el){
                el.addEventListener('mouseenter', function(){ el.style.background='var(--ptl-general-2)'; });
                el.addEventListener('mouseleave', function(){ el.style.background='#fff'; });
                el.addEventListener('click', function(){ irAPunto(PUNTOS[parseInt(el.dataset.i)]); });
              });
            });
            // Enter: ir al primer resultado
            inp.addEventListener('keydown', function(ev){
              if (ev.key === 'Enter') {
                var q = quitarAcentos(inp.value.trim());
                var m = PUNTOS.filter(function(p){ return quitarAcentos(p.dir).indexOf(q) !== -1; });
                if (m.length) irAPunto(m[0]);
              }
            });
            // Cerrar la lista al hacer clic fuera
            document.addEventListener('click', function(ev){
              if (ev.target !== inp && !box.contains(ev.target)) box.style.display='none';
            });

            // ---- FASE 2: GEOCODIFICAR LAS QUE FALTAN ----
            // El servidor (Render) no puede salir a internet, así que geocodifica
            // el NAVEGADOR contra Nominatim (OpenStreetMap), 1 petición/segundo.
            // Cada resultado se pinta como chincheta AMARILLA con BORDE NEGRO en el
            // grupo "provisional" (filtrable). El usuario la confirma ARRASTRÁNDOLA:
            // al soltar se guarda igual que cualquier otra (mismo dragend/endpoint).
            // Nominatim acierta la calle pero falla el portal y a veces el pueblo,
            // por eso NUNCA se auto-guarda: solo se ubica y el usuario confirma.
            var btnUbicar = document.getElementById('mapa-ubicar');
            if (btnUbicar) {
              // Crea una chincheta provisional (amarilla, borde negro) ya arrastrable
              // y con el mismo guardado que las normales. Al confirmarla (dragend OK)
              // deja de ser provisional: borde blanco + parpadeo cian (se recolorea a
              // su fase real al recargar; aquí basta con marcarla como confirmada).
              function pinProvisional(item, lat, lng){
                var marker = L.marker([lat, lng], { icon: iconoColor('var(--ptl-warning)', '#000'), draggable: true });
                marker.bindTooltip('⚠ ' + (item.dir || '') + ' (sin confirmar)', { direction:'top', offset:[0,-6] });
                marker.bindPopup('<div style="font-size:13px;line-height:1.5">'
                  + '<strong>' + (item.dir || '') + '</strong><br/>'
                  + '<span style="color:var(--ptl-warning-dark)">⚠ Ubicación aproximada sin confirmar.</span><br/>'
                  + '<span style="color:var(--ptl-gray-500)">Arrástrala a su sitio para guardarla.</span></div>');
                marker._posOrig = [lat, lng];
                marker._confirmada = false;
                marker.on('dragend', function(){
                  var ll = marker.getLatLng();
                  var ok = confirm('¿Guardar ubicación de "' + (item.dir||'') + '"?\\n\\n'
                    + 'Coordenada:\\n' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6));
                  if (!ok) { marker.setLatLng(marker._posOrig); return; }
                  var body = 'id=' + encodeURIComponent(item.id)
                    + '&lat=' + encodeURIComponent(ll.lat) + '&lng=' + encodeURIComponent(ll.lng);
                  fetch(GUARDAR_URL, { method:'POST',
                    headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: body })
                    .then(function(r){ return r.json(); })
                    .then(function(data){
                      if (data && data.ok) {
                        marker._posOrig = [ll.lat, ll.lng];
                        if (!marker._confirmada) {
                          marker._confirmada = true;
                          marker.setIcon(iconoColor('var(--ptl-general-1)'));  // confirmada: borde blanco
                          marker.setTooltipContent(item.dir || '');
                          var s = document.getElementById('mapa-sincoord');
                          if (s) s.textContent = Math.max(0, (parseInt(s.textContent,10)||0) - 1);
                        } else {
                          marker.setIcon(iconoColor('var(--ptl-general-1)'));
                        }
                      } else {
                        alert('No se pudo guardar: ' + (data && data.error ? data.error : 'error'));
                        marker.setLatLng(marker._posOrig);
                      }
                    })
                    .catch(function(e){ alert('Error de red al guardar: ' + e.message); marker.setLatLng(marker._posOrig); });
                });
                if (!markersPorGrupo['provisional']) markersPorGrupo['provisional'] = [];
                markersPorGrupo['provisional'].push(marker);
                marker.addTo(map);
                return marker;
              }
              btnUbicar.addEventListener('click', function(){
                if (!PENDIENTES.length) return;
                if (!confirm('Voy a ubicar automáticamente ' + PENDIENTES.length + ' direccion(es) sin coordenada.\\n\\n'
                  + 'Tardaré ~1 segundo por cada una (servicio gratuito). Saldrán en AMARILLO con borde negro;\\n'
                  + 'luego arrástralas a su sitio exacto para guardarlas. ¿Empezar?')) return;
                btnUbicar.disabled = true;
                var i = 0, okN = 0, falloN = 0, primera = null;
                function siguiente(){
                  if (i >= PENDIENTES.length){
                    btnUbicar.textContent = '📍 Ubicadas: ' + okN + ' (revisa y arrastra)';
                    btnUbicar.style.background = 'var(--ptl-success-light)'; btnUbicar.style.borderColor = 'var(--ptl-success)'; btnUbicar.style.color = 'var(--ptl-success-dark)';
                    if (primera) map.setView(primera, 15, { animate:true });
                    if (falloN) alert('Listo. ' + okN + ' ubicadas. ' + falloN + ' no se encontraron (las ubicas a mano cuando quieras).');
                    return;
                  }
                  var item = PENDIENTES[i];
                  btnUbicar.textContent = '📍 Ubicando ' + (i+1) + '/' + PENDIENTES.length + '…';
                  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q='
                    + encodeURIComponent(item.query);
                  fetch(url, { headers: { 'Accept':'application/json' } })
                    .then(function(r){ return r.json(); })
                    .then(function(arr){
                      if (arr && arr.length){
                        var lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
                        if (!isNaN(lat) && !isNaN(lng)){
                          var mk = pinProvisional(item, lat, lng);
                          if (!primera) primera = [lat, lng];
                          okN++;
                        } else { falloN++; }
                      } else { falloN++; }
                    })
                    .catch(function(){ falloN++; })
                    .finally(function(){ i++; setTimeout(siguiente, 1100); });  // 1.1s: respeta el límite de Nominatim
                }
                siguiente();
              });
            }
          })();
        </script>
      `;
      sendHtml(res, pageHtml("Mapa",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Mapa", url: "#" }],
        content, token));
    } catch (e) {
      console.error("[presupuestos] GET /mapa:", e.message);
      sendError(res, "Error generando el mapa: " + e.message);
    }
  });

  // POST /presupuestos/mapa/guardar-coord — guarda la coordenada de un expediente
  // (se llama al soltar una chincheta arrastrada, tras confirmar). Body: { id, lat, lng }
  // Escribe "lat, lng" en la columna `earth` con la escritura segura (relee y verifica).
  app.post("/presupuestos/mapa/guardar-coord", async (req, res) => {
    if (!checkToken(req, res)) return;
    try {
      const id = String(req.body.id || "").trim();
      if (!id) return res.status(400).json({ error: "Falta id" });
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "Coordenadas no válidas" });
      // Sanidad geográfica: descartar 0,0 y fuera de rango terrestre
      if (lat === 0 && lng === 0) return res.status(400).json({ error: "Coordenada 0,0 no válida" });
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return res.status(400).json({ error: "Coordenada fuera de rango" });
      const comu = await buscarComunidadPorId(id);
      if (!comu) return res.status(404).json({ error: "Expediente no encontrado" });
      const valor = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      await actualizarCampoComunidad(comu._rowIndex, "earth", valor);
      res.json({ ok: true, earth: valor });
    } catch (e) {
      console.error("[presupuestos] /mapa/guardar-coord:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /presupuestos/plantillas-doc — pantalla de edición de plantillas de documento
  // GET /presupuestos/plantillas-bot — pantalla de edicion de textos del bot WhatsApp
  // GET /presupuestos/plantillas-bot-flujo — misma data, vista por flujo (5 caminos)
  app.get("/presupuestos/plantillas-bot-flujo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const plantillas = await leerPlantillasBot();
      await Promise.all(
        plantillas.filter(p => String(p.tipo).trim().toLowerCase() === "twilio")
          .map(async (p) => { p.textoTwilio = await obtenerTextoTwilio(p.twilio_sid); })
      );
      sendHtml(res, pageHtml("Flujo bot",
        [{ label: "Presupuestos", url: urlT(token, "/presupuestos") }, { label: "Plantillas bot (flujo)", url: "#" }],
        vistaPlantillasBotFlujo(plantillas, token),
        token));
    } catch (e) {
      console.error("[presupuestos] GET /plantillas-bot-flujo:", e.message);
      sendError(res, "Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/guardar — guarda texto + activo en bot_plantillas
  app.post("/presupuestos/plantillas-bot/guardar", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const clave = String(req.body.clave || "").trim();
      if (!clave) return sendError(res, "Clave requerida");
      const tipo = String(req.body.tipo || "").trim().toLowerCase();
      const texto = String(req.body.texto || "");
      if (texto.length > 5000) return sendError(res, "El texto no puede superar los 5000 caracteres");
      const twilio_sid = String(req.body.twilio_sid || "").trim();
      if (tipo === "twilio" && twilio_sid && !/^HX[0-9a-fA-F]{32}$/.test(twilio_sid)) {
        return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      }
      const activo = !!req.body.activo; // checkbox: presente => activa
      await guardarPlantillaBot({ clave, tipo, texto, twilio_sid, activo });
      const _destino = String(req.body.vista || "").trim() === "flujo" ? "/presupuestos/plantillas-bot-flujo" : "/presupuestos/plantillas-bot-flujo";
      res.redirect(urlT(token, _destino, { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/guardar:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/exigencia — fija el nivel de exigencia de fotos
  app.post("/presupuestos/plantillas-bot/exigencia", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const NIV = ["muy_tolerante", "tolerante", "normal", "estricto", "muy_estricto"];
      let nivel = String(req.body.nivel || "").trim().toLowerCase();
      if (!NIV.includes(nivel)) nivel = "normal";
      await guardarAjusteBot("exigencia_fotos", nivel);
      const _dx = String(req.body.vista || "").trim() === "flujo" ? "/presupuestos/plantillas-bot-flujo" : "/presupuestos/plantillas-bot-flujo";
      res.redirect(urlT(token, _dx, { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/exigencia:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/avisos-tiempos - guarda tiempos + on/off de los avisos por plazo (v18.121)
  app.post("/presupuestos/plantillas-bot/avisos-tiempos", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const MAP = { t_plazo_1: ["msg_plazo_1", 10], t_plazo_urgente: ["msg_plazo_urgente", 18], t_plazo_fuera: ["msg_plazo_fuera", 20] };
      const clave = String(req.body.clave || "").trim();
      if (MAP[clave]) {
        const [msgClave, def] = MAP[clave];
        let v = parseFloat(String(req.body.val || "").replace(",", ".").trim());
        if (isNaN(v) || v < 0) v = def;
        const on = req.body.on ? true : false;
        await guardarAjusteBot(clave, v, on);
        const msg = String(req.body.msg || "").replace(/\r\n/g, "\n").trim();
        if (msg !== "") await guardarAjusteBot(msgClave, msg);
      }
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/avisos-tiempos:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/sleep - guarda los DOS plazos del Sleep (t_inactividad_1/2) + SID Twilio (v18.146)
  app.post("/presupuestos/plantillas-bot/sleep", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_inactividad_1", parseDia(req.body.val1, 1), !!req.body.on1);
      await guardarAjusteBot("t_inactividad_2", parseDia(req.body.val3, 3), !!req.body.on3);
      const sid = String(req.body.twilio_sid || "").trim();
      if (sid && !/^HX[0-9a-fA-F]{32}$/.test(sid)) return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      if (sid) await guardarPlantillaBot({ clave: "recordatorio", tipo: "twilio", twilio_sid: sid, activo: true });
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/sleep:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/presentacion - guarda los DOS plazos del reenvio de presentacion (t_presentacion_1/2) + SID Twilio (v18.161)
  app.post("/presupuestos/plantillas-bot/presentacion", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_presentacion_1", parseDia(req.body.val1, 2), !!req.body.on1);
      await guardarAjusteBot("t_presentacion_2", parseDia(req.body.val3, 4), !!req.body.on3);
      const sid = String(req.body.twilio_sid || "").trim();
      if (sid && !/^HX[0-9a-fA-F]{32}$/.test(sid)) return sendError(res, "El SID de Twilio debe tener el formato HX seguido de 32 caracteres");
      if (sid) await guardarPlantillaBot({ clave: "presentacion", tipo: "twilio", twilio_sid: sid, activo: true });
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/presentacion:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  // POST /presupuestos/hoy-bot-llamado - marca "Llamado" de un piso (caja Sin responder) en bot_expedientes col AA, por telefono (v18.163)
  app.post("/presupuestos/hoy-bot-llamado", async (req, res) => {
    if (!checkToken(req, res)) return;
    const _err = (msg) => res.status(400).type("text/plain; charset=utf-8").send(String(msg || "error"));
    try {
      const tel = String(req.body.tel || "").trim();
      const valor = String(req.body.valor || "").trim();
      const campo = String(req.body.campo || "llamado").trim();
      if (!tel) return _err("tel requerido");
      // El bot solo usa A:Z; los flags de la caja Avisos se guardan en AA (llamado) y AB (revisado).
      const _col = campo === "revisado" ? "AB" : (campo === "revisado_faltan" ? "AD" : "AA");
      const _need = campo === "revisado" ? 28 : (campo === "revisado_faltan" ? 30 : 27);
      const sheets = getSheetsClient();
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))" });
        const sh = (meta.data.sheets || []).find(s => s.properties && s.properties.title === "bot_expedientes");
        const cc = (sh && sh.properties.gridProperties && sh.properties.gridProperties.columnCount) || 0;
        if (sh && cc > 0 && cc < _need) {
          await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ appendDimension: { sheetId: sh.properties.sheetId, dimension: "COLUMNS", length: _need - cc } }] } });
        }
      } catch (e2) { console.error("[presupuestos] hoy-bot-llamado expandir col:", e2.message); }
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "bot_expedientes!A:A" });
      const rows = r.data.values || [];
      const norm = (s) => String(s || "").replace(/[^0-9]/g, "");
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) { if (rows[i] && norm(rows[i][0]) === norm(tel)) { rowIndex = i + 1; break; } }
      if (rowIndex < 0) return _err("expediente no encontrado");
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: "bot_expedientes!" + _col + rowIndex, valueInputOption: "RAW", requestBody: { values: [[valor]] } });
      res.json({ ok: true });
    } catch (e) {
      console.error("[presupuestos] POST /hoy-bot-llamado:", e.message);
      _err("Error: " + e.message);
    }
  });

  // POST /presupuestos/plantillas-bot/plazo - guarda los 3 plazos (t_plazo_1/urgente/fuera) + el texto unico (msg_plazo_1) (v18.150)
  app.post("/presupuestos/plantillas-bot/plazo", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const parseDia = (v, def) => { let n = parseFloat(String(v || "").replace(",", ".").trim()); return (isNaN(n) || n < 0) ? def : n; };
      await guardarAjusteBot("t_plazo_1", parseDia(req.body.val1, 10), !!req.body.on1);
      await guardarAjusteBot("t_plazo_urgente", parseDia(req.body.valU, 18), !!req.body.onU);
      await guardarAjusteBot("t_plazo_fuera", parseDia(req.body.valF, 20), !!req.body.onF);
      const msg = String(req.body.texto || "").replace(/\r\n/g, "\n").trim();
      if (msg !== "") await guardarAjusteBot("msg_plazo_1", msg);
      res.redirect(urlT(token, "/presupuestos/plantillas-bot-flujo", { ok: "1" }));
    } catch (e) {
      console.error("[presupuestos] POST /plantillas-bot/plazo:", e.message);
      sendError(res, "Error guardando: " + e.message);
    }
  });

  app.get("/presupuestos/plantillas-doc", async (req, res) => {
    if (!checkToken(req, res)) return;
    const token = req.query.token || "";
    try {
      const plantillas = await leerPlantillasDoc();
      sendHtml(res, pageHtml("Plantillas doc",
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
      // documentos = todas las plantillas que NO son encabezado/pie
      const documentos = plantillas
        .filter(p => p.clave !== "_ENCABEZADO_GLOBAL" && p.clave !== "_PIE_GLOBAL")
        .sort((a, b) => _ordenDoc(a.clave) - _ordenDoc(b.clave))
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
      fecha_pte_cobro: "BH",
    };
    const COL_IMPORTE = ["pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real"];
    const COL_TIEMPO  = ["tiempo_previsto","tiempo_real"];
    const COL_FECHA   = ["fecha_contacto","fecha_visita","fecha_envio_pto","fecha_ultimo_seguimiento_pto",
                         "fecha_aceptacion_pto","fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto",
                         "fecha_visita_emasesa","fecha_documentacion_completa","fecha_envio_contratos_pagos",
                         "fecha_cycp_completa","fecha_limite_documentacion_vecinos","fecha_cobro","fecha_pte_cobro"];

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
    // v18.03: si se pasa mapaId (solo desde la ficha del expediente), el botón
    // Mapa lleva ?focus=<ccpp_id> para que el mapa abra centrado en esa chincheta.
    const mapaId = _opts.mapaId || "";
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
          ${_opts.searchInHeader ? "" : `<div class="ptl-search-wrap" style="flex:1">
            <span class="ptl-search-icon">🔍</span>
            <input class="ptl-search-input" id="ptl-buscador-comun" placeholder="Buscar dirección, comunidad, administrador, teléfono..." value="${esc(busqueda)}" oninput="ptlFiltrarComun()"/>
          </div>`}
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
              btn.classList.remove('hdr-cron-err');
              btn.textContent = '⚡'; btn.title = 'Ejecutar cron';
            }
            function pintarRojo(nErrores, detalles) {
              modo = 'rojo'; erroresActuales = detalles || [];
              btn.classList.add('hdr-cron-err');
              btn.textContent = '⚠️'; btn.title = nErrores + ' error' + (nErrores === 1 ? '' : 'es') + ' · Ejecutar cron';
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
    getImagenesExpediente,
    getImagenExpediente,
    // Expuestos para sandbox de tests (no usados por otros módulos en producción)
    PTO_FASES,
    fechaHito,
    lineaTiempoHtml,
    COLS,
    rowToObj,
    objToRow,
    // Conteo de docs "Faltan X de Y" — fuente ÚNICA compartida con documentacion.cjs
    // (antes la regla estaba duplicada; ver pendiente unificado v18.70).
    _resumenManual,
    _contarFaltan,
    // Listas de estados del conteo (para inyectar al cliente de documentacion)
    _ESTADOS_IGNORA,
    _ESTADOS_HECHO,
  };

}; // end module.exports

// reinicio render 1778199437
