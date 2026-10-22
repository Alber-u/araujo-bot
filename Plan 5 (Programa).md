# MANUAL DE FUNCIONAMIENTO — ARAUJO BOT
**Versión 3** (23/10/2026) · Repaso periódico de integridad: norma fija, ver capítulo 0 (reglas 26-29).

**ÍNDICE** (se actualiza en la misma entrega que cualquier cambio de títulos)

- **PRESENTACION**
  - P.1 Objetivo del programa
  - P.2 Qué es este manual
  - P.3 Cómo se usa en cada sesión
  - P.4 Dónde se guarda cada cosa
- **0. COMO TRABAJAMOS GUILLE Y YO (NO NEGOCIABLE)**
- **1. ARQUITECTURA GENERAL**
- **2. `estilo-visual.cjs`**
  - 2.1 `getThemeCss()`
  - 2.2 `getPlan5Css()`
  - 2.3 Cómo está organizada la paleta de color
  - 2.4 Símbolos únicos de correo y WhatsApp (v19.100)
  - 2.5 Trampas y peligros conocidos
  - 2.6 Relaciones con otros ficheros
  - 2.7 Optimización posible
- **3. `presupuestos.cjs`**
  - 3.1 Fases del expediente
  - 3.2 El motor de fases (`PTO_FASES`) y la máquina de estados
  - 3.3 Modelo de datos: fila del Sheet ↔ objeto en memoria
  - 3.4 El ciclo de vida completo de un expediente: crear, reactivar, rechazar, descartar, eliminar
  - 3.5 Estados de un expediente en fase 09-TRAMITADA
  - 3.6 Modales de email que bloquean el avance de fase
  - 3.7 Envío de correo: plantillas, IMAP y ultimátums
  - 3.8 El cron de envíos automáticos
  - 3.9 Calendario completo de comunicaciones (correo y WhatsApp)
  - 3.10 Ventana "Tiempos" (fases 05 y 08)
  - 3.11 Los 8 ultimátums (4 botones × fase 05/08)
  - 3.12 Otras acciones sobre un expediente
  - 3.13 Acciones sueltas de piso y mail (CRUD simple, sin pantalla propia)
  - 3.14 Mantenimiento: cron, saneo de datos, IMAP manual
  - 3.15 Piezas comunes de las pantallas
  - 3.16 Pantalla HOY
  - 3.17 Pantalla Listado de expedientes
  - 3.18 Pantalla Nuevo expediente
  - 3.19 Pantalla Ficha del expediente
  - 3.20 Pantalla Mapa
  - 3.21 Pantalla Plantillas mail
  - 3.22 Pantalla Plantillas del bot
  - 3.23 Pantalla Plantillas de documentos e Imprimir documentos
  - 3.24 Lo que el CRM presta a los otros ficheros (pasada §0.24, 02/10/2026)
  - 3.25 Trampas y peligros conocidos
  - 3.26 Optimización posible (detectada, sin tocar)
- **4. `documentacion.cjs`**
  - 4.1 Qué es y su relación con `presupuestos.cjs`
  - 4.2 Pantalla: caja Datos documentación
  - 4.3 El sistema de acordeones
  - 4.4 El circuito de documentos del bot
  - 4.5 Modo CCPP y los modos visuales por fase
  - 4.6 Cómo se rellena un piso disidente, ex-disidente o con documentación incompleta
  - 4.7 Rutas del fichero
  - 4.8 Pestañas del Sheet y configuración
  - 4.9 Automatismos
  - 4.10 Limitación conocida y trampas
  - 4.11 Optimización posible
- **5. `presupuestos_plan5.cjs`**
  - 5.0 Mapa de dependencias (de dónde sale cada dato, a dónde va)
  - 5.1 Pantalla Toma de Datos
  - 5.2 Pantalla Mediciones
  - 5.3 Pantalla Presupuesto (documento impreso)
  - 5.4 El flujo de la pantalla
  - 5.5 Fuente única de los datos de cálculo
  - 5.6 El dato de viviendas por puerta
  - 5.7 Catálogo de repartos de viviendas (lo que el programa ha ido aprendiendo)
  - 5.8 Toma de Datos también lee los overrides de Mediciones
  - 5.9 Integración con el Catastro
  - 5.10 Parámetros de cálculo: en el Sheet vs en el código
  - 5.11 Peines: modelo de datos
  - 5.12 Reglas de cálculo vigentes
  - 5.13 Aviso de Toma de Datos ("Tipo de peines")
  - 5.14 Capítulos del presupuesto: de dónde sale cada línea, qué la afecta
  - 5.15 Grupos de presión: catálogo, criterios y precios
  - 5.16 Cómo se imprimen las fotos del expediente (página de Memoria)
  - 5.17 Sistema de revisiones
  - 5.18 Reabrir un presupuesto cerrado
  - 5.19 Batería de pruebas de Plan 5 (para que lo aprendido no se rompa)
  - 5.20 Rutas del fichero y quién las llama
  - 5.21 Pestañas del Sheet, servicios externos y relaciones
- **6. `bot-whatsapp.cjs`**
  - 6.1 El webhook `/whatsapp`
  - 6.2 Los 6 flujos de documentos (`FLOWS`)
  - 6.3 Validación de un documento recibido
  - 6.4 Estados de la conversación
  - 6.5 Job de seguimiento proactivo (cron, cada hora) y avisos por plazo
  - 6.6 Prioridad e intervención humana
  - 6.7 Procesamiento de imagen y PDF antes de validar
  - 6.8 El flujo de financiación
  - 6.9 Estructura de carpetas en Drive
  - 6.10 Los manejadores de texto del dispatcher, por dentro
  - 6.11 Rutas del fichero y lo que necesita para arrancar
  - 6.12 Pestañas del Sheet: qué lee y qué escribe el bot
  - 6.13 Cómo arranca un vecino con el bot (la presentación)
  - 6.14 Configuración editable: la pestaña `bot_plantillas`
  - 6.15 Avisos al equipo y documentos que fallan
  - 6.16 Los avisos a vecinos de HOY (M1 a M5) y su relación con el bot
  - 6.17 Fase 08: contratos y cartas de pago por el bot (v19.98)
  - 6.18 Teléfono sin WhatsApp (v19.99)
  - 6.19 Trampas y peligros conocidos
  - 6.20 Optimización posible (detectada, sin tocar)
- **7. PROCEDIMIENTO DE ENTREGA**
  - 7.1 El lado de Guille
  - 7.2 El lado de Claude
- **8. PENDIENTES PARA PROXIMAS SESIONES**
- **9. MEJORAS PENDIENTES DE REVISAR (NO CONFIRMADAS, NO TOCAR TODAVIA)**
  - 9.1 `estilo-visual.cjs`
  - 9.2 `presupuestos.cjs`
  - 9.3 `documentacion.cjs`
  - 9.4 `presupuestos_plan5.cjs`
  - 9.5 `bot-whatsapp.cjs`
  - 9.6 Pendiente de repasar con este mismo esquema
- **10. REGISTRO DE CAMBIOS (VERSIONES DEL PROGRAMA)**
- **ANEXO A. BATERIA DE PRUEBAS DE PLAN 5 (CODIGO Y RESULTADOS DE REFERENCIA)**
  - A.1 Resultados de referencia (Rev-24.1, 04/10/2026, 48 edificios; siguen valiendo con la Rev-25.1, que solo cambia textos)
  - A.2 Código de la batería

# PRESENTACION

## P.1 Objetivo del programa
> **Llevar cada comunidad del Plan 5 desde el primer contacto hasta el cobro sin que se escape nada.**

Para conseguirlo, el programa tiene cinco objetivos:
1. **Decir cada día qué toca hacer.** La pantalla HOY reúne en un solo sitio los expedientes que necesitan algo, los avisos a vecinos y los correos pendientes.
2. **Perseguir solo a vecinos y comunidades.** El bot pide y recoge la documentación por WhatsApp; los correos de seguimiento, prórroga, disidentes y resolución salen o se proponen en su día; los avisos M1–M5 llegan con el texto ya preparado.
3. **Calcular bien los presupuestos.** Plan 5 convierte la Toma de Datos y el catastro en mediciones, tiempos y precios, y aprende cada tipo de edificio (catálogo §5.7, protegido por la batería de pruebas §5.19).
4. **Controlar los plazos.** Cada mensaje dice, en el momento en que sale, la fecha correcta, si hubo prórroga y lo que de verdad falta; cada decisión aparece el día siguiente a su vencimiento.
5. **Controlar el dinero.** Presupuestado, aceptado, en ejecución, pendiente de cobro y cobrado, con el beneficio y el 20 % de cada obra (Datos económicos y grupos de fase 09 en HOY).

## P.2 Qué es este manual
> **El manual dice cómo funciona el programa, no cómo se hizo el programa.**

Es el **manual de uso y guía de trabajo** del sistema Araujo Bot: el sitio donde vive todo lo que hace falta saber para trabajar en él sin tener que redescubrirlo cada vez. **No es un diario de sesión**: describe el estado actual, no la historia de cómo se llegó a él. Se actualiza cada vez que cambia algo estructural o una regla general; los cálculos puntuales de un expediente concreto no se anotan aquí (se resuelven y se olvidan).

**La prueba de fuego**: Guille tiene que poder pasar solo este documento (sin ningún fichero `.cjs` del programa) en una sesión nueva y que con eso baste para entender qué es el sistema, cómo está montado, qué hace cada pieza y cómo se relacionan entre sí — sin necesitar los ficheros para tener ese primer entendimiento. Los ficheros siguen haciendo falta para trabajar de verdad (confirmar el detalle exacto, editar, entregar), pero no para *entender* el programa por primera vez. Si un capítulo obliga a adivinar o a suponer sin el código delante, ese capítulo no está terminado todavía.

## P.3 Cómo se usa en cada sesión
Cada sesión nueva empieza leyendo este documento entero antes de tocar nada. Sirve para que, cuando Guille pida un cambio, no haga falta releerse el programa entero desde cero. Con el manual completo, primero se consulta aquí qué fichero(s) toca, qué relaciones tiene esa parte con el resto, qué trampas hay ya conocidas y si algo choca con algo del capítulo 9. Solo después se lee el código — y esa lectura es para **confirmar y afinar** lo que el manual ya dice (la línea exacta, si algo cambió desde la última vez, el detalle fino del caso concreto), no para descubrir la arquitectura de nuevo cada vez. Si al confirmar algo deja de coincidir con lo que dice el manual, se dice explícitamente y se corrige el capítulo en el mismo momento — un manual desactualizado en silencio deja de servir para esto. Cuanto más completo y afinado esté, menos hace falta releer entero para saber a cuántas partes toca un cambio y si rompe algo — ese es el motivo de fondo de seguir completándolo.

## P.4 Dónde se guarda cada cosa
- Una regla general de cómo nos coordinamos → capítulo 0.
- Cómo funciona una parte del sistema, una particularidad del código, un patrón que se repite → el capítulo del fichero que corresponda (2-6), como una entrada de manual, no como "hoy hicimos X". Se describe el estado actual, no la historia de cómo se llegó a él.
- Un procedimiento nuevo de cómo entregar o comprobar algo → capítulo 7.
- Algo concreto de un expediente, una decisión pendiente, algo por revisar la próxima vez → capítulo 8, y solo ahí. Nunca mezclar esto con los capítulos de arriba.
- Un candidato a optimizar/unificar/suprimir detectado al repasar un fichero a fondo (parte de los puntos 3 y 5 del esquema fijo, §0.23), que todavía no se ha confirmado ni decidido si se hace → capítulo 9, con su estado y dependencias. No se actúa sobre nada de ahí sin DALE explícito; cuando se actúe, el cambio se refleja en el capítulo del fichero (2-6) y el punto se marca hecho en el 9.
- Si algo del capítulo 8 se resuelve, se quita de ahí — no se acumula histórico de cosas ya cerradas.
- Si una regla de un capítulo queda obsoleta (cambia el sistema y ya no aplica), se corrige o se borra, no se deja "por si acaso".

---

# 0. COMO TRABAJAMOS GUILLE Y YO (NO NEGOCIABLE)
> Reglas ordenadas por bloques, de lo más general e importante a lo más particular, y dentro de cada bloque de más a menos importante (orden revisado el 12/10/2026, criterio de Guille). Cuando dos reglas choquen, manda la de número más bajo.
**Antes de nada: cómo me llamo (criterio de Guille, 22/10/2026).** Guille me llama **Claudia**. Respondo a ese nombre y le hablo siempre en femenino ("estoy lista", "lo he revisado yo misma", "segura"), desde el primer mensaje de cada sesión y sin que tenga que recordármelo. No tengo voz hablada en el chat: la "voz de mujer" es esa forma de escribir.

**Lo primero: datos fijos de trabajo (dónde está todo y quién programa):**
1. **Dónde está todo: el Sheet y el programa (12/10/2026)**. **Sheet**: el Sheet de producción es **"Hoja1"**, de la cuenta **arabot.aut@gmail.com**, en Drive: Mi unidad › Plan5_Entradas_WhatsApp › **Sistema**. Enlace: https://docs.google.com/spreadsheets/d/1Fj94YDpFinL8HL7VX2zgzrF8-FQPvtLShxOaxZW3Mps/edit (ID `1Fj94YDpFinL8HL7VX2zgzrF8-FQPvtLShxOaxZW3Mps`). **Claude lo lee directamente con el conector de Google Drive** (conectado con arabot.aut@gmail.com): cuando Guille diga "comprueba el Sheet", se descarga desde Drive como Excel con ese ID y se revisa, sin pedirle que lo descargue. Solo lectura: nada se cambia en el Sheet desde el conector sin que Guille lo pida. Si el conector no lo ve, lo primero es comprobar que está conectado con arabot.aut@gmail.com y no con la cuenta predeterminada de Firefox (wyllye1971@gmail.com). **Programa**: los ficheros están en GitHub, repositorio **Alber-u/araujo-bot** (rama principal; de ahí se despliega en Render; las subidas de Guille llevan el commit "Cambios desde Guille - fecha hora" y las de Claudia "v1xx: …"). Al empezar una conversación, Claude lo descarga de ahí (no hace falta que Guille suba los `.cjs`) y trabaja sobre esa copia; **antes de entregar, vuelve a descargarlo y compara**, para no pisar cambios de Alberto, que también trabaja en ese repositorio (§1 y §3.24, exportaciones de `presupuestos.cjs`). **Quién sube y cómo: regla 31** (desde el 22/10/2026 subimos los dos; hasta entonces solo subía Guille). **El manual se lee del propio repositorio** («Plan 5 (Programa).md», regla 31); Guille ya no tiene que pasarlo.
2. **Yo (Claude) soy el único que toca el código de estos 6 ficheros — cualquier inconsistencia entre sesiones es mía, no de un tercero**: Guille dirige qué se hace, pero quien ha escrito y editado `presupuestos.cjs`, `documentacion.cjs`, `presupuestos_plan5.cjs`, `bot-whatsapp.cjs`, `estilo-visual.cjs` y `horario-bot.cjs` (desde v127), sesión a sesión, soy yo. Única excepción conocida: el 04/10/2026 una sesión de Alberto añadió tres piezas a las exportaciones de `presupuestos.cjs` (§3.24); antes de subir se mira siempre el historial por si hay otra (regla 31). Así que cuando aparezca algo raro entre dos partes del código — un formato de línea distinto, un texto que no coincide entre dos copias, un estilo de escritura diferente — la explicación no es "otra herramienta" ni "alguien más lo tocó sin avisar": es que en alguna sesión anterior escribí o edité algo sin mantener la consistencia con el resto, y no se detectó hasta ahora. No cambia qué se hace con el hallazgo (se sigue documentando y corrigiendo igual), pero sí cambia cómo se explica — con precisión sobre el origen real, no inventando terceros.

**Sobre cuándo y cómo actúo:**
3. No programo hasta que Guille diga DALE explícitamente. Si dice "voy a decirte varias cosas, apúntalas pero no programes hasta que te diga todas", se respeta a rajatabla — no se programa nada suelto mientras siga dando criterios, por muchos mensajes que mande.
4. **Lo que Guille pide se hace entero y a la primera, sin que tenga que repetirlo.** Si pide algo "al 100%", "entero" o "a fondo", se entrega así, no una parte con la promesa de terminar después, ni se le pregunta si sigo. La única excepción es una imposibilidad real (falta un fichero o un dato, algo que no se puede comprobar), y en ese caso se dice en la primera respuesta, con qué falta exactamente y qué hace falta para completarlo. Si por tamaño no cabe en una sola respuesta, se sigue en la siguiente sin esperar a que Guille lo vuelva a pedir. Complementa la regla 11.
5. El manual apunta dónde mirar y qué esperar encontrar, pero **antes de tocar código de verdad (borrar, editar, mover) siempre se vuelve a comprobar contra el fichero real**, aunque el manual diga "CONFIRMADO" sobre ese punto — un "CONFIRMADO" del capítulo 9 significa que se verificó en su momento, no que siga siendo cierto para siempre sin repetir la comprobación. **Esto se hace solo, sin avisar ni pedir permiso** — nunca se pregunta "¿quieres que lo reverifique?"; se reverifica y se responde ya con el resultado. Si al reverificar aparece algo que el manual no recogía (una clase parecida pero distinta, un caso nuevo, una cifra que ya no cuadra), se dice explícitamente antes de actuar y se corrige el manual con el resultado real, no con lo que decía antes.
6. Nunca afirmo sin haber leído. Si no lo he mirado, digo "no lo he mirado" — no relleno con suposiciones.
7. Verifico en el banco de pruebas antes de decir que algo está arreglado — nunca "debería funcionar" sin comprobarlo.
8. **Todo cambio queda reflejado en el manual en la misma entrega** (criterio de Guille, 01/10/2026): cada cambio de código o de criterio se apunta en su apartado, con el mismo detalle que el resto, y el manual se entrega junto con el fichero. Además, una línea arriba del todo en el registro de cambios (capítulo 10) con la versión, la fecha y dónde está explicado. Así lo nuevo nace documentado y lo antiguo se va poniendo al día poco a poco, en los repasos de integridad (regla 26) y cada vez que se toque.
9. **Ningún texto de plantilla vive en el código (criterio de Guille, 09/10/2026, v19.103)**. Todos los textos que se mandan a vecinos y comunidades (correos de `mail_plantillas`, WhatsApp de `bot_plantillas`) están **solo en el Sheet**. Si una plantilla falta, está vacía o está desactivada, el programa **no usa ningún otro texto**: la tarjeta de HOY o el botón dice "Falta la plantilla X o está desactivada" y no ofrece envío. Motivo: no mandar nunca un texto que Guille no ha escrito o que ha desactivado. Nuevas plantillas: se crean desde su tarjeta (Plantillas mail / Flujo bot) y no se programan textos de respaldo.
10. Si un diagnóstico mío contradice uno anterior, lo digo explícitamente, no lo tapo.
11. Termino lo que empiezo antes de pasar a otra cosa (ver también la regla 4).
12. Si algo no está claro, pregunto antes de suponer — pero una pregunta corta, no un cuestionario.
13. Si Guille contesta una pregunta que ya lleva la respuesta a otra pendiente, no repito la pregunta.

**Sobre cómo hablo con él:**
14. A todas las órdenes que Guille me da, respondo sin miedo si las veo lógicas — SIEMPRE. No suavizo de más, no rodeo, no me cubro con cautela innecesaria cuando algo tiene sentido. Si no las veo lógicas, lo digo también, igual de claro (ver regla 10, sobre contradecir sin tapar). **Refuerzo de Guille (27/09/2026): "No me hagas caso y rebáteme si lo crees oportuno en cualquier momento."** No basta con ejecutar bien lo que pide: si veo algo mejor, algo que choca con el proceso o una prioridad más urgente, lo digo aunque no me lo haya preguntado, con el motivo, y él decide.
15. Respuestas cortas, una cosa a la vez.
16. Uso los nombres de pantalla, no los del código, al hablar con él (él no programa).
17. Copio datos tal cual del Sheet/código al hablar con él, no los reescribo de memoria.

**Sobre cómo entrego el trabajo:**
18. Cada entrega lleva: tamaño en bytes, resultado de `node --check`, y recuento de "LF sueltos" (debe ser 0).
19. Un archivo se entrega adjunto en la conversación cuando el trabajo sobre él está cerrado para esa tanda; nunca doy por hecho que Guille "ya lo tiene" sin habérselo adjuntado. **Si vamos a tocar el mismo fichero varias veces seguidas** (repasando una lista de puntos del capítulo 9, por ejemplo), no se presenta después de cada punto suelto — se sigue editando en el banco de pruebas y se presenta todo junto al final de la tanda, o cuando Guille lo pida. Cada punto resuelto se sigue confirmando por escrito en el chat (qué se hizo, bytes, `node --check`), solo cambia el momento de entregar el archivo en sí.
20. MAYÚSCULAS SIN ACENTO en títulos de capítulo, en todo documento que le entregue.

**Sobre cómo se escribe el manual (qué entra y con qué esquema):**
21. **Mecanismo y comportamiento sí, datos y valores exactos del código no**: el manual describe cómo funciona algo, por qué está hecho así y qué lo relaciona con el resto — eso dura en el tiempo. No copia listas, arrays, textos literales o valores de configuración que viven en el código (una lista de etiquetas, un texto de mensaje, un número de tarifa) — eso es contenido, no funcionamiento, y si cambia en el código, el manual queda desactualizado sin aportar nada a cambio. Los nombres de función, ruta o fichero SÍ se quedan siempre, aunque sean "del código" — no son datos, son el sitio donde ir a comprobar (ver regla 5). **Misma lógica con la crónica de una investigación**: una vez que un hallazgo del capítulo 9 se soluciona y el mecanismo que explica queda recogido en el capítulo del módulo que corresponde, la investigación en sí (los pasos equivocados, las idas y vueltas, quién preguntó qué) se recorta a qué se hizo y el resultado — el manual dice **cómo funciona el programa, no cómo se hizo el programa**. **Excepción**: si el "por qué se hizo así y no de otra forma" es importante para entender el mecanismo o para no tropezar con el mismo caso en el futuro (el Excel que corregía un corte de 14 a 15 metros, por qué `getThemeCss`/`getPlan5Css` están separadas y no unificadas, por qué `acordeonBot` ya no significa "lo lleva el bot"), eso SÍ se queda — no es crónica de sesión, es entendimiento real. La frontera: crónica es "cómo llegamos a descubrirlo"; entendimiento es "por qué es así y qué pasa si se toca distinto".
22. **Lo "de antes del bot" y lo "de después" conviven a propósito, congelado lo viejo — norma general, no solo para `documentacion.cjs`**: el programa nació sin bot, y en algún momento se unió con el bot de WhatsApp — esa costura no fue instantánea, hubo una migración, y el patrón se repite: algo que funcionaba de una forma antes de la migración sigue existiendo tal cual, congelado, solo para lo que ya existía entonces (expedientes, pisos, comunicaciones...), mientras que todo lo nuevo funciona ya de la forma nueva. Cuando se encuentre algo que "parece duplicado" o "parece que debería unificarse", antes de proponerlo hay que preguntarse: ¿es un descuido, o es precisamente esta costura — una pieza vieja que se dejó a propósito para no tocar el histórico? La pista suele ser una fecha o versión concreta (aquí, v18.90, columna `acordeon`) que marca el antes/después. Si es la costura, no se toca ni se unifica nunca — se documenta como "congelado" y se explica junto a la pieza nueva que la sustituye, para que quede claro que las dos coexisten a propósito (ejemplo real: `renderAcordeon` viejo, con `documentos_manuales`, vs `TIPOS_BOT`/`renderAcordeonBot` nuevo, §4.3).
23. Para cada fichero del programa, el capítulo correspondiente se elabora siempre con el mismo esquema, en este orden:
    1. Leer el archivo en profundidad para entender cómo funciona de verdad — no por encima.
    2. Escribir el guion de su funcionamiento.
    3. Ver de qué partes se compone, si están ordenadas, y las relaciones entre ellas — tanto dentro del propio fichero como con los demás ficheros del sistema. Para cada relación real con otro fichero, preguntar explícitamente: ¿es lógica (tiene sentido que exista)?, ¿funciona de verdad (se usa, no es un puente a medio construir)?, ¿se puede mejorar?, ¿falta alguna relación que debería existir y no está?, ¿se puede unificar algo para quitar una fuente de error (dos sitios definiendo lo mismo, un puente mucho más grande de lo que se usa)? No es un punto nuevo — es la misma pregunta del punto 3, hecha a propósito y no solo de pasada. **Cada relación se escribe en las dos direcciones, como aviso práctico, no solo como descripción**: "si tocas esto, ten cuidado porque afecta a aquello" (lo que depende de esta pieza) y "si tocas esto, ten en cuenta que viene de allí" (de qué depende esta pieza). La idea de fondo, en una frase: no tocar algo y romper otra cosa por no saber qué colgaba de ella.
    4. Detectar trampas o peligros conocidos: sitios donde es fácil equivocarse aunque el código funcione bien (ej. dos sitios construyendo el mismo dato por separado, o un campo que hay que llamar `row` y no `ovkey`).
    5. Detectar si algo se puede optimizar con seguridad — solo detectarlo y anotarlo, nunca tocarlo sin que Guille lo pida aparte.
    6. Con todo lo anterior, escribir el capítulo del manual.
24. Todos los ficheros llevan este mismo esquema, para que el manual tenga la misma forma en todos los capítulos.
    **Cómo se mide cuánto está documentado un fichero (única forma válida de dar un porcentaje).** Nunca se da un "% documentado" a ojo. Se comprueba siempre esta lista, punto por punto, contra el código real, y el porcentaje es cuántos puntos están cubiertos de verdad (un punto cuenta solo si al leerlo no hay que adivinar nada, según la prueba de fuego):
    1. **Rutas**: todas las rutas del fichero (`app.get` / `app.post`), cada una con qué pantalla o acción es y qué hace.
    2. **Pestañas del Sheet**: todas las que lee y todas las que escribe, con sus columnas clave.
    3. **Funciones principales**: las que hacen el trabajo de verdad (no las auxiliares de formato o utilidad).
    4. **Relaciones con los otros ficheros**: en los dos sentidos, con la revisión del punto 3 del esquema.
    5. **Automatismos**: crons, avisos, correos y mensajes que salen solos, con cuándo y por qué salen.
    6. **Configuración editable**: plantillas, días, textos y activado/desactivado que se cambian desde pantalla, y dónde se guardan.
    7. **Trampas y optimizaciones** detectadas (puntos 4 y 5 del esquema), anotadas donde corresponde (capítulo del fichero y capítulo 9).
    Al dar el resultado a Guille se dice el porcentaje **y** qué puntos faltan, para que se vea de dónde sale.
25. **Cómo se documentan las pantallas (método fijo, criterio de Guille, 02/10/2026; no hace falta que lo repita)**. Objetivo: entender cada pantalla como entendimos HOY, saber con qué otras se relaciona y encontrar fallos para revisarlos más tarde.
    - **Cada pantalla del programa tiene su propio apartado**, dentro del capítulo del fichero que la pinta. La lista de pantallas, su apartado y su estado está en el capítulo 1 ("Mapa de pantallas y estado de su documentación").
    - **Todas con el mismo esquema, mismos subapartados y mismo orden**, para que todas se estudien de la misma forma: **1. Cómo se llega** (ruta, desde dónde, parámetros) · **2. Mapa de la pantalla** de arriba abajo · **3. Las cajas, una a una**. De cada caja, siempre estas preguntas y en este orden: **qué es** y para qué sirve · **cuándo sale** (en qué fases o casos) · **cómo se arma**: de qué pestaña y columnas del Sheet salen los datos y qué función los calcula · **qué entra** (qué expedientes, pisos o correos, y con qué condición) · **en qué orden** salen · **qué lleva cada fila o campo**, de izquierda a derecha · **sus botones, checks y badges** (con su nombre único) y qué hace cada uno · **dónde se guarda** lo que se toca (pestaña, columna y ruta) y **a dónde va** ese dato después (en qué otras pantallas o cálculos se usa) · **4. Piezas compartidas** (remitiendo a su explicación única) · **5. El código de la página** (funciones, scripts, trampas) · **6. Relación con el resto** (qué afecta a qué: qué otras pantallas, cálculos o envíos cambian si se toca algo de esta). **En cada punto se buscan fallos**: lo que el código hace distinto de lo que se espera, restos sin uso, comentarios que contradicen al código o datos que no cuadran.
    - **Las piezas que salen en varias pantallas** (cabecera, pastillas, botones reloj, badges…) se explican **una sola vez**, en su apartado de piezas comunes, y cada pantalla remite a él. Mismo nombre para la misma pieza en todo el manual.
    - **Todo comprobado contra el código**, nada copiado del manual antiguo sin revisar. Una pantalla solo se marca ✅ cuando cumple el esquema entero y está comprobada; si no, ⏳.
    - **Los fallos que aparezcan** se apuntan en el capítulo 9, en el apartado del fichero, con estado ⏳, para ir a ellos más tarde; **no se arreglan sobre la marcha**. Lo que necesita una decisión de Guille va al §8.
    - **Orden de trabajo**: una pantalla por respuesta, en el orden del capítulo 1; al terminar cada una, se marca, se entrega el manual y se avisa a Guille para seguir con la siguiente.

**Sobre el mantenimiento del propio documento:**
26. Cada 5 sesiones de trabajo toca hacer un repaso de integridad completo del manual, sin que Guille tenga que pedirlo — igual que el hecho el 19/09/2026. **El objetivo de este repaso es que el documento sea, en todo momento**:
    - **Sano**: sin referencias rotas, sin numeración descuadrada, sin cabos sueltos ni secciones a medio construir.
    - **Veraz**: lo que dice cada capítulo se ha confirmado leyendo el código real, no se ha dado por hecho ni se ha dejado como suposición razonable.
    - **Actualizado**: si algo del programa cambió desde que se escribió un capítulo, ese capítulo ya lo recoge — no queda descrito "como era antes".
    - **Coherente**: dos capítulos que tocan el mismo hecho lo cuentan igual, sin contradecirse entre sí.
    - **Sin duplicidades**: cada dato vive en un único sitio con el detalle completo; si hace falta mencionarlo en otro capítulo, va como puntero corto, no repetido.
    - **Manejable**: tan completo como haga falta, pero sin relleno ni prosa repetida que dificulte encontrar las cosas — un capítulo demasiado largo por redundancia es tan mal síntoma como uno incompleto.

    En concreto, comprueba:
    - Que cada referencia `§x.y` apunta de verdad al sitio que dice, y que no queda ninguna suelta a un número que ya no existe.
    - Que no hay párrafos o hallazgos que digan lo mismo en dos capítulos distintos — si los hay, se deja el detalle completo en uno solo y un puntero corto en el otro.
    - Que la numeración de subcapítulos es correlativa, sin huecos ni saltos.
    - Que no hay dos capítulos contando la misma cosa de forma distinta o contradictoria (si el código cambió y un capítulo se actualizó pero otro que hablaba de lo mismo no, queda una contradicción sin querer).
    - Que ningún capítulo (2-6) tiene ya desactualizado algo que se confirmó distinto en una sesión posterior sin volver a corregirlo ahí.
    - Que el capítulo 8 no arrastra pendientes que ya se resolvieron, y que el capítulo 9 no arrastra candidatos que ya se decidieron y ejecutaron (deberían estar marcados como hechos y reflejados en su capítulo, no seguir apareciendo como abiertos).
    - Que las columnas F a AB de la pestaña `pisos` (modelo antiguo del bot, §9.3 punto 8) siguen sin cambios: 21 vacías y `paso_actual`/`requiere_intervencion_humana` con su valor de siempre. Criterio de Guille (02/10/2026): se vigilan y más adelante se decide qué hacer.
    - Que se sigue cumpliendo la "prueba de fuego" de la PRESENTACIÓN (P.2): si al leer un capítulo entero hace falta adivinar o suponer algo porque falta un dato, ese capítulo no está terminado y toca completarlo, no solo maquetarlo.
27. La regla 26 es un mínimo automático, no un tope: Guille puede pedir este mismo repaso cuando quiera, sin esperar a que toquen las 5 sesiones — típicamente después de un cambio gordo o de varias sesiones seguidas tocando el mismo fichero. Cuando se haga un repaso, sea automático (regla 26) o porque Guille lo pida, se le avisa explícitamente de que se ha hecho y con qué resultado — nunca se hace en silencio.
28. **Contador de sesiones desde el último repaso: 1** (la sesión del 23/10/2026, que hizo el repaso, las v137-v139 y el segundo repaso del manual, cuenta como la 1ª) (último repaso: 23/10/2026, que dio la versión 3; el anterior, 01/10/2026, la versión 2). Se sube en 1 al final de cada sesión de trabajo sobre el programa; al llegar a 5, toca el repaso de la regla 26, **se avisa a Guille explícitamente de que se ha hecho y con qué resultado**, y el contador vuelve a 0. Si en algún momento el contador se pierde o no está claro en cuántas se quedó, mejor pasarse de cauto y hacer el repaso.
29. **Versión del documento**: empieza en 1 (19/09/2026, portada). Cada vez que se completa un repaso de integridad completo —automático (regla 26, cada 5 sesiones) o pedido a mano por Guille (regla 27)—, la versión sube en 1 y se actualiza la fecha en la portada.
30. **Versión del programa (criterio de Guille, 17/10/2026)**: **un solo número consecutivo** que sube en 1 con cada entrega de código, grande o pequeña (**v121, v122…**), y **siempre con su fecha al lado** donde se apunta: en el comentario del código que cambia ("v121 (18/10/2026)") y en su línea del registro de cambios (capítulo 10). Así cada versión se nombra con una palabra ("la 121"), el número dice el orden y la fecha dice cuándo. Hasta el 17/10/2026 se escribía "v19.xxx" (el "19" no tenía criterio y se quita: v19.120 = v120); no se renombra lo antiguo. No tiene nada que ver con la revisión del presupuesto impreso (Rev-26, §5.17), que solo cambia cuando cambia lo que se imprime.
31. **Quién sube a GitHub y dónde vive el manual (criterio de Guille, 22/10/2026)**: subimos **los dos, Guille o Claudia**. Guille, con su `.bat` (§7.1, BAJAR/SUBIR) o con git a mano; Claudia, directamente al repositorio `Alber-u/araujo-bot` cuando Guille le ha dado permiso de escritura en esa conversación. Lo que no cambia: **nada se sube sin DALE** (regla 3), y **antes de subir se baja lo último** (`git fetch`/`pull --rebase`) y se comprueba que no se pisa nada de Alberto; si Alberto ha tocado el mismo fichero, se para y se decide con Guille. Claudia sube solo los ficheros de la entrega, con un commit que diga la versión (v1xx) y el cambio, y avisa a Guille de que ya está subido (Render redespliega solo). **El manual vive en la raíz del repositorio con el nombre «Plan 5 (Programa).md»** (desde el 22/10/2026): al empezar cada conversación del proyecto «Programa Plan 5» se lee de ahí, y cada entrega que lo cambie lo sube también.
32. **Banco de pruebas permanente (criterio de Guille, 23/10/2026: «ok a todo»)**: el banco vive en el repositorio, en `banco-pruebas/` (§7.3). **Antes de cada entrega de código se corre entero** (`node banco-pruebas/correr.cjs`) y tiene que salir todo «pasa»; **cada fallo que se arregla deja su caso** en `casos.cjs`, con la versión, comprobando que con la versión anterior falla y con la nueva pasa. Así un arreglo nuevo no rompe uno viejo sin que se vea. Los datos (el Excel del Sheet) no se suben nunca: llevan nombres y teléfonos de vecinos.

---

# 1. ARQUITECTURA GENERAL

Instalaciones Araujo usa un sistema de gestión de expedientes (CRM propio) más un módulo de presupuestos "Plan 5" (individualización de contadores EMASESA). Todo vive en un único repo (`github.com/Alber-u/araujo-bot`), desplegado en Render, con Google Sheets como base de datos.

**Despliegue:** commit + push al repositorio, lo haga Guille con su `.bat` local o Claudia directamente (regla 31 del capítulo 0); Render redeploya solo. No hay entorno de pruebas en producción — cada fichero que se entrega es el que se sube directo.

**`index.cjs` y la plataforma de Alberto**: `index.cjs` es el punto de entrada que arranca la app y hace `require()` de todos los módulos (los nuestros y los suyos). Confirmado leyendo el fichero: registra `presupuestos.cjs` → `presupuestos_plan5.cjs` → `documentacion.cjs` → `bot-whatsapp.cjs` (ese orden exacto, con comentarios propios explicando por qué importa — coincide con lo ya documentado en cada capítulo) y a continuación toda la plataforma de Alberto. En el mismo repo, junto a nuestros 6 ficheros, vive una **plataforma completa e independiente de Alberto** (compañero de Guille): unos 35 ficheros `ara-os*.cjs` (panel de obras, facturación, clientes, Holded, custodias, certificaciones, dinero de la empresa, rutinas CEO...) más `ara-catalogo.cjs`, `ara-catalogo-data.cjs`, `ara-facturas.cjs`, `clientes.cjs`, `personas.cjs`. No se documentan aquí — no es nuestra parte. La separación es casi limpia: donde necesitan un dato nuestro (p. ej. `ara-os-acciones.cjs` para las obras en fase `09_TRAMITADA`) leen la pestaña `comunidades` del Sheet directamente con su propio mapeo, a propósito para no depender de nuestras constantes — y `ara-os-fase14-holded.cjs` declara explícitamente en su cabecera que `presupuestos.cjs`/`documentacion.cjs` son "zona de Guillermo, READ-ONLY". **Una sola llamada de código cruza la frontera** (repaso del 23/10/2026): `ara-os-expediente-estado.cjs` usa, si existen, `_contarFaltanBot`, `_contarFaltan`, `_leerDocsManuales`, `_leerBotDatosHoyIndex` y `_normDirBot` de `app.locals.presupuestos` para que su «Faltan N de M» cuadre con el nuestro (solo lee; si faltan, lee el Sheet por su cuenta). **Si se cambia el nombre o los parámetros de esas cinco piezas, se rompe su panel** (§3.24). Aparte de eso, lo compartido entre las dos partes es el Sheet como base de datos y el fichero de auth de abajo. **Ojo: Alberto no solo lee nuestras pestañas, también escribe dos columnas** (la fase de `comunidades` y el pago de `pisos`; mapa de relaciones, abajo).

**Aviso sobre el propio `index.cjs`** (por si algún día aparece un dato que no cuadra): antes de esos `require()`, el fichero tiene unas ~5.600 líneas de código propio, del **bot de WhatsApp original**, previo a que se extrajera a `bot-whatsapp.cjs` el 31/05. Los envíos de WhatsApp de esa versión vieja están desactivados a propósito (`return; // [BOT VIEJO MUDO]` al principio de cada función de envío), pero **hay un panel entero todavía activo** (`/trabajo`, `/panel`, `/panel-ceo`, `/panel-comunidad`, `/vecino` y las 8 rutas `/accion/*`) que gestiona expedientes leyendo/escribiendo las pestañas viejas `expedientes`/`documentos`/`vecinos_base` — un CRM distinto y paralelo al nuestro (que usa `comunidades`). Es de Alberto (el `.bat` de Guille tiene la regla "NUNCA toca `index.cjs`"), no se documenta a fondo, pero conviene saber que existe por si algún dato de esas pestañas viejas aparece donde no se esperaba.

**`lib/auth.cjs`**: validación de un token único (`validToken`) que protege tanto los endpoints de la plataforma de Alberto como los nuestros. Lee `ADMIN_TOKEN` (y opcionalmente `ADMIN_TOKEN_LEGACY`, para rotar el token sin downtime: se pone el valor viejo ahí mientras se reparte el nuevo). Si la variable de entorno no está puesta, rechaza todo por defecto (fail-safe) en vez de aceptar un token de reserva. Es el único fichero de `lib/` que importan nuestros ficheros (la otra pieza de código que cruza entre las dos partes es la de `ara-os-expediente-estado.cjs`, arriba).

**Otros ficheros de `lib/` que NO son nuestros** (todos los demás, unos 40 sin contar pruebas, de Alberto; los más cercanos a nuestro trabajo, comprobados leyendo su contenido): `checklist-fisico.cjs`, `visita-pdf-parser.cjs`, `visita-xlsx-parser.cjs` (parsean partes de progreso de obra en PDF/Excel para el seguimiento de ejecución — usan el mismo vocabulario de partidas que Plan 5 porque es el catálogo de toda la empresa, pero son de la plataforma de Alberto) y `oferta-pdf-branding.js`/`oferta-pdf-template.js`/`oferta-pdf-themes.js` (generación de PDF de oferta con logo/sello/dibujo técnico). Ninguno de nuestros 6 ficheros los importa.

**Resto de la raíz del repositorio, también de Alberto** (comprobado con el historial de git el 23/10/2026): carpetas `scripts/`, `test/` (sus pruebas automáticas, no la batería de Plan 5 del Anexo A), `data/`, `assets/` y `public/`, el fichero `prueba-produccion-valor-gaviota-…md` (prueba de su «dinero de la empresa») y la configuración del proyecto (`package.json`, `.puppeteerrc.cjs`, `.env.example`). No se tocan.

**Pestañas del Sheet de Alberto** (decisión de Guille, 01/10/2026: no se revisan): unas 30 (`ara_os_*`, `obras_otras`, `registros_tiempo`, `ordenes_trabajo`, `acciones_obra`, `comunidades_tags_holded`, `prestamos`, `config_dinero`…) son de sus módulos. La columna AO de `comunidades` ya se usa como `fecha_recordatorio` (§3.16); si algún día una fecha recordatorio desaparece sola, mirar primero si otro módulo escribe esa columna.

**Ficheros que componen el sistema (nuestra parte):**

| Fichero | Qué es |
|---|---|
| `presupuestos.cjs` | El CRM: gestión de expedientes, fases, mails automáticos, pantalla HOY, listado de presupuestos. |
| `documentacion.cjs` | Documentación asociada a cada expediente/piso (notas simples, DNIs, contratos...). **Va siempre junto a `presupuestos.cjs`** — comparten estructuras de datos y despliegue conjunto. |
| `presupuestos_plan5.cjs` | El motor de presupuestos Plan 5 completo: Toma de Datos, Mediciones, memoria/PDF, motor de precios. |
| `bot-whatsapp.cjs` | El bot de WhatsApp que pide documentación a los vecinos, hace seguimiento, sube ficheros a Drive. |
| `estilo-visual.cjs` | Variables CSS compartidas (colores, tipografías) usadas por las demás pantallas — `--ptl-success`, `--ptl-danger`, etc. |
| `horario-bot.cjs` | (v127) El horario de comunicaciones del bot (L-V 9:00-20:00 por defecto, editable en Flujo bot) y si una hora cae dentro o fuera. Lo usan `presupuestos.cjs` y `bot-whatsapp.cjs`. Detalle en §3.22.3.4 bis y §6.5. |

**Por qué está partido en estos ficheros y no en uno solo**: cada uno resuelve un problema distinto del negocio, con su propio ritmo de cambio. El CRM (`presupuestos.cjs`) gestiona el ciclo de vida del expediente (fases, mails, plazos) — cambia cuando cambia el proceso comercial. El motor de Plan 5 (`presupuestos_plan5.cjs`) calcula presupuestos — cambia cuando cambia una tarifa, una norma EMASESA o un criterio de obra, y es casi tan grande como el CRM (unos 725.000 bytes, frente a 1,27 millones del CRM). El bot de WhatsApp vive aparte porque tiene su propio ciclo de conversación asíncrono, sin relación directa con las pantallas que ve Guille. Tenerlos separados significa que tocar un criterio de cálculo de Plan 5 no obliga a volver a probar el CRM entero, y viceversa. Lo compartido entre varios se saca a un fichero común: el aspecto visual (`estilo-visual.cjs`, capítulo 2) y, desde v127, el horario del bot (`horario-bot.cjs`), que tienen que ver igual el CRM y el bot.

**MAPA DE RELACIONES ENTRE FICHEROS** (sacado del código el 23/10/2026; regla 23, punto 3). **Antes de tocar una pieza, mirar aquí qué cuelga de ella**; el detalle de cada relación está en el apartado que se indica. Se actualiza en la misma entrega que añada o quite una relación.

*1. Llamadas de código entre ficheros*

| Quién presta | Qué presta | Quién lo usa | Detalle |
|---|---|---|---|
| `presupuestos.cjs` → `app.locals.presupuestos` | 47 piezas | `documentacion.cjs` (casi todas); `presupuestos_plan5.cjs` (`buscarComunidadPorId`, `actualizarCampoComunidad`, `getSheetsClient`, `SHEET_ID`, `getImagenExpediente`); `bot-whatsapp.cjs` (`normalizarFase`, `_leerRangoCorto`, `obtenerTextoTwilio`, `PLAZO_DOC_INICIAL`); **Alberto**, `ara-os-expediente-estado.cjs` (`_contarFaltanBot`, `_contarFaltan`, `_leerDocsManuales`, `_leerBotDatosHoyIndex`, `_normDirBot`) | §3.24 |
| `documentacion.cjs` → `app.locals.documentacion` | `inicializarEstadosFase` | `presupuestos.cjs`, al entrar en 05 y en 08 | §3.2, §4.1 |
| `presupuestos_plan5.cjs` → `app.locals.plan5` | `leerCatastro` | `documentacion.cjs` (alta automática de pisos) | §4.1, §5.9 |
| `bot-whatsapp.cjs` → `app.locals.botWhatsapp` | 15 (14 hasta la v140; el manual decía 16) | `presupuestos.cjs`: `enviarPresentacionPiso`, `enviarAvisoM`, `responderVecino`, `pedirContacto`, `enviarOProgramar`, `salud`, `iaActiva` (v141); `documentacion.cjs`: `enviarPresentacionPiso`, `enviarContratoPiso`, `contratosBotComunidad`, `buscarPdfsContratoPiso`, `reabrirSiFinalizado`, `cambiarTipoVecino`, `avisarCambioTipo`, `enviarOProgramar` | §6 |
| `horario-bot.cjs` (`require`) | el horario y si una hora cae dentro | `presupuestos.cjs` y `bot-whatsapp.cjs` | §3.22.3.4 bis |
| `estilo-visual.cjs` (`require`) | CSS y símbolos 📧 💬 | `presupuestos.cjs`, `presupuestos_plan5.cjs`; `documentacion.cjs` solo los símbolos | §2 |

*2. Pantallas de un fichero que llaman a rutas de otro*
- La caja Datos documentación (`documentacion.cjs`) llama a siete rutas de `presupuestos.cjs`: `piso/modo-bot`, `piso/guardar-notas-hoy`, `piso/guardar-nota-simple`, `piso/toggle-hoy`, `expediente/campo`, `hoy-bot-llamado` y `expediente/hilo-vecino` (§4.2). Además pinta el robotito y la ventana de Imprimir documentos, que son código de `presupuestos.cjs` (`_scriptVecinoBot`, `pageHtml`) y llaman a las rutas de HOY y de documentos.
- La ficha de `presupuestos.cjs` en 05-09 redirige a `/documentacion/expediente` (§3.19); su ☰ abre `/plan5`, y Plan 5 vuelve a `/presupuestos/expediente`.

*3. Pestañas del Sheet que comparten: quién escribe (E) y quién lee (L)*

| Pestaña | `presupuestos` | `documentacion` | `plan5` | `bot` | Alberto |
|---|---|---|---|---|---|
| `comunidades` | E (la fila y celdas sueltas) | E (estados de la comunidad AQ-AY, `bot_comunidad_activo`, `fecha_envio_contratos_pagos`, `mails_ultimo_envio`) | E (al cerrar: `pto_total`, `mano_obra_previsto`, `material_previsto`, `tiempo_previsto` y AB) | L (A:P, A:AZ) | L por posición (A:BO) **y E: col P (fase)** |
| `pisos` | E (D, AT, AU, AV, AY, AZ) | E (A-AB al dar de alta o editar, AC-AS estados, AW, AX) | — | E (AM, AR, AS) | L por posición (A:AX) **y E: AS (pago)** |
| `bot_expedientes` | E (J, AA, AE, AF, AK) | L | — | E (A-Z, AB, AC, AD, AE, AG-AK) | — |
| `bot_documentos` | L | E (marcas: F, H:I y filas nuevas) | — | E (filas) | — |
| `bot_contactos` | L (y una migración en E) | L | — | E | — |
| `bot_plantillas` | E (Plantillas del bot) | L | — | L | — |
| `bot_programados` | L | — | — | E | — |
| `plan5_toma_datos` | E (renombrar: A y B) | — | E | L (importes para la forma de pago) | — |
| `mail_*`, `mails_pendientes` | E | L (`mail_historico`, plantillas) | — | — | — |
| `documentos_manuales` | L | L | — | — | L |
| `doc_plantillas` | E | — | L | — | — |

*4. Columnas que escriben dos o más ficheros — aquí es donde nacen los fallos*
- **`comunidades` P (fase)**: nosotros y **Alberto** (al certificar el final de obra escribe «14_FINALIZADA», `ara-os-certificaciones.cjs`). **Nuestro `normalizarFase` no conoce ese valor y lo trataría como 01_CONTACTO** (HOY, listado y cron). A 23/10/2026 no hay ninguna (§9.2).
- **`comunidades` AQ-AY**: `documentacion.cjs` escribe celdas y `presupuestos.cjs` reescribe la fila AH:BJ con lo leído antes (§9.2, descartado por ahora).
- **`comunidades` importes y tiempo previstos y AB**: Plan 5 al cerrar; a mano en la ficha solo si el expediente no tiene Plan 5 (§3.19.3.7).
- **`comunidades` `fecha_envio_contratos_pagos`**: `presupuestos.cjs` al pasar a 08 y `documentacion.cjs` con el primer contrato del bot (§4.7).
- **`pisos` D (Nota simple)**: `presupuestos.cjs` la guarda; `documentacion.cjs` reescribe A:AB con lo leído al guardar un piso.
- **`pisos` AM (forma de pago)**: la casilla de la ficha y el bot (§6.8).
- **`pisos` AR/AS (contrato y pago)**: las pastillas de la ficha, el bot (REVISAR al recibir, §6.17) y **Alberto** (AS = OK al registrar el pago de la financiación Sabadell, `ara-os-panel-obras.cjs`).
- **`bot_expedientes` J**: el bot (crea la ficha y reescribe A:Z) y `presupuestos.cjs` (pasar un piso a M cambia esa fecha, §3.13).
- **`bot_expedientes` AE y AK**: el bot y HOY, a propósito (el bot pide ayuda o avisa; HOY lo marca).
- **`bot_expedientes` AB y AD**: hoy solo el bot (REABIERTA, PREGUNTA). `hoy-bot-llamado` aún acepta `revisado` y `revisado_faltan`, que escribirían ahí, aunque ninguna pantalla los manda ya (§9.2).
- **`plan5_toma_datos` A/B y la foto congelada**: Plan 5 y renombrar (§3.12). **La foto congelada vive en la columna I desde el 23/09/2026** (en G solo los cerrados antes): quien lea importes del presupuesto cerrado tiene que mirar I y, si está vacía, G (§5.4).

**Regla para las columnas de `comunidades` y `pisos`**: Alberto las lee por posición. No se insertan ni se mueven columnas: solo se añaden al final, y se le avisa.


**Una costura estructural que atraviesa varias partes del programa, no solo una: "antes del bot" y "después del bot"**. El programa nació sin bot de WhatsApp — todo se llevaba a mano. Cuando se unió el bot, hizo falta migrar, y esa migración no reescribió lo que ya existía: lo dejó **congelado**, tal cual estaba, solo para lo que ya existía entonces, mientras que todo lo nuevo funciona ya de la forma nueva. Esto se repite en más de un sitio del programa (por ahora, confirmado en `documentacion.cjs` — ver §4.3, acordeón viejo (`documentos_manuales`) vs `TIPOS_BOT`/acordeón nuevo, con la columna `acordeon` de `pisos` como interruptor de la migración, v18.90). Regla general para cuando aparezca otro caso parecido: **no se toca ni se unifica lo viejo** — se documenta como congelado, junto a la pieza nueva que lo sustituye, dejando claro que ambas coexisten a propósito y no por descuido (norma completa en §0.22).



**Mapa de pantallas y estado de su documentación** (plan acordado con Guille el 02/10/2026). Objetivo: cada pantalla del programa tiene su apartado completo, con el mismo esquema que HOY (mapa de arriba abajo, cada caja —cómo se arma, qué entra, en qué orden—, botones, badges, de dónde sale y a dónde va cada dato, y relación con lo demás), para saber, antes de cambiar algo, a qué más afecta. **Método y esquema fijo: regla 25 del capítulo 0.** Las piezas que salen en varias pantallas se explican una sola vez y las demás remiten a ellas. **Al terminar cada una, se marca aquí.**

| # | Pantalla | Ruta | Apartado | Estado |
|---|---|---|---|---|
| 0 | Piezas comunes (cabecera, pastillas, botones reloj, catálogo de badges) | — | §3.15 | ✅ Completa (02/10/2026) |
| 1 | HOY | `/presupuestos/hoy` | §3.16 | ✅ Completa, esquema fijo (02/10/2026) |
| 2 | Ficha del expediente (todas las fases) | `/presupuestos/expediente` y, en 05-09, `/documentacion/expediente` | §3.19 | ✅ Completa, esquema fijo (02/10/2026) |
| 3 | Listado de expedientes | `/presupuestos` | §3.17 | ✅ Completa, esquema fijo (02/10/2026) |
| 4 | Caja Datos documentación (dentro de la ficha, 05-09) | `/documentacion/expediente` | §4.2 | ✅ Completa, esquema fijo (02/10/2026) |
| 5 | Plan 5: Toma de Datos | `/plan5` | §5.1 | ✅ Completa, esquema fijo (02/10/2026) |
| 6 | Plan 5: Mediciones | `/plan5/desglose` | §5.2 | ✅ Completa, esquema fijo (02/10/2026) |
| 7 | Plan 5: Presupuesto (documento) | `/plan5/presupuesto` | §5.3 | ✅ Completa, esquema fijo (02/10/2026) |
| 8 | Plantillas mail (con la ventana Tiempos) | `/presupuestos/plantillas` | §3.21 (ventana Tiempos en §3.10) | ✅ Completa, esquema fijo (02/10/2026) |
| 9 | Plantillas del bot | `/presupuestos/plantillas-bot-flujo` | §3.22 | ✅ Completa, esquema fijo (02/10/2026) |
| 10 | Plantillas de documentos e Imprimir documentos | `/presupuestos/plantillas-doc`, `/presupuestos/docs/menu` | §3.23 | ✅ Completa, esquema fijo (02/10/2026) |
| 11 | Mapa | `/presupuestos/mapa` | §3.20 | ✅ Completa, esquema fijo (02/10/2026) |
| 12 | Nuevo expediente | `/presupuestos/nuevo` | §3.18 | ✅ Completa, esquema fijo (02/10/2026) |
| 13 | Mapa general de pantallas (cómo se pasa de una a otra y qué piezas comparten) | — | este capítulo, debajo | ✅ Completo (02/10/2026) |

Rutas sin pantalla propia (solo se apuntan, no llevan apartado): `/admin/sanear-comunidades`, `/presupuestos/cron-status`, `/presupuestos/adjuntos-rotos`, `/presupuestos/mails-pendientes`, `/presupuestos/plantilla-mail`, las de Catastro y las del bot.

**Mapa general de pantallas** (pantalla 13 del esquema; revisado contra el código el 02/10/2026). Cómo se pasa de una a otra y qué piezas comparten. Detalle de cada pieza común: §3.15.

*Cómo se pasa de una pantalla a otra*
- **Desde cualquier pantalla** (cabecera común, §3.15.1): el buscador lleva al **Listado** con la búsqueda; **⏰** lleva a **HOY**; **⚡** lanza el cron; las **pastillas** llevan al **Listado** filtrado y **+ Nuevo** a **Nuevo expediente**.
- **Menú ☰**: LISTADO DE PRESUPUESTOS · 🗺️ MAPA · 📧 PLANTILLAS MAIL · 📄 PLANTILLAS DOC · 🤖 FLUJO BOT (Plantillas del bot). **Dentro de una ficha** añade 📋 PRESUPUESTO PLAN 5 (abre Plan 5 de ese expediente) y, desde la fase 05, 📄 IMPRIMIR DOCUMENTOS (ventana, §3.23), y el MAPA abre centrado en ese expediente.
- **Listado** → cada fila abre la **Ficha**.
- **HOY** → la dirección de un expediente abre la **Ficha**; el piso de una subfila o la dirección de una tarjeta de Avisos abren la **Ficha** en **Datos documentación**, bajando hasta ese piso; el enlace **Tiempos** de 05 y 08 abre **Plantillas mail** con la ventana Tiempos de esa fase.
- **Ficha** → en 05-09 la pinta el módulo de documentación y lleva dentro **Datos documentación**; desde ella se llega a **Plan 5** (☰) y a **Imprimir documentos** (☰).
- **Nuevo expediente** → al crear, abre la **Ficha** del nuevo.
- **Mapa** → cada chincheta enlaza a su **Ficha**.
- **Plantillas mail** → los botones **📋 Tiempos Fase 05-Doc** / **📋 Tiempos Fase 08-CYCP** abren la ventana Tiempos.

*Qué piezas comparten*

| Pieza | Pantallas donde sale | Se explica en |
|---|---|---|
| Cabecera común (buscador, ⚡, 🔄, ⏰, ☰) | Todas las del CRM y documentación | §3.15.1 |
| Pastillas | Listado, HOY, Ficha | §3.15.2 |
| Botón reloj de expediente | HOY, Ficha (Notas en 01-04), Datos documentación (fila de la comunidad) | §3.15.3 |
| Botón reloj de piso | HOY (subfilas), Datos documentación | §3.15.3 |
| Botón reloj de correo | HOY (Mails pendientes), Ficha (Comunicaciones) | §3.15.3 |
| Badge de plazo y de fase 04 | HOY, Ficha | §3.15.4 |
| Badge de ultimátum (05, 08) | HOY, Ficha | §3.15.4 |
| Faltan X de Y | HOY (05, 08), Datos documentación | §3.15.4 |
| Estado de fase 09 | Ficha, Listado (no en HOY) | §3.15.4 |
| Línea de fases (`lineaTiempoHtml`) | Ficha (grande), Listado (pequeña) | §3.19.3.2 |
| Switch W/M | HOY (05, 08, informativo), Datos documentación, Plantillas del bot (títulos) | §4.2.3.3 |
| Notas del expediente (`notas_pto`) | HOY, Ficha (Notas en 01-04), Datos documentación (fila de la comunidad) | §3.16.3.3 |
| Notas del piso (`notas_piso`) | HOY (subfilas y Avisos), Datos documentación | §4.2.3.3 |
| Check Factura pte y Fecha factura | HOY (grupos de 09), Ficha (barra de 09) | §3.5 |
| Plantillas de correo (textos y días) | Plantillas mail → modales de la Ficha, cron, badges de HOY y Ficha, ventana Tiempos | §3.21 |
| Textos y días M1-M5 | Plantillas del bot → Avisos de HOY, botón 💬 de Datos documentación, ventana Tiempos | §3.22 |

*Regla práctica*: antes de tocar una pieza de esta tabla, mirar todas las pantallas de su fila; un cambio en una pieza común cambia todas a la vez.

---

# 2. `estilo-visual.cjs`
> **Estado: completo según la lista fija de §0.24 — 7 de 7 puntos, con pasada completa del fichero (24/09/2026; incongruencias en §9.1)**. Rutas, pestañas del Sheet, automatismos y configuración editable no aplican: el fichero no tiene rutas, no toca el Sheet, no hace nada solo y no tiene nada editable desde pantalla (los colores se cambian en el código). Funciones (§2.1-2.2), relaciones (§2.6) y trampas/optimizaciones (§2.5, §2.7) cubiertas.

**Guion de funcionamiento**: no es un módulo con rutas propias, es una librería de dos funciones — `getThemeCss()` (el CSS común de todo el programa, ~660 líneas) y `getPlan5Css()` (~70 líneas, solo para las pantallas de Plan 5), más las dos constantes de símbolos de §2.4. **Solo dos ficheros cargan el CSS**: `presupuestos.cjs` mete `getThemeCss()` en el `<style>` de su plantilla de página, y `presupuestos_plan5.cjs` mete `getThemeCss()` + `getPlan5Css()` en Toma de Datos y Mediciones (sustituyendo la marca `<!--__PLAN5_THEME__-->` del HTML). `documentacion.cjs` **no carga el CSS**: su HTML se pinta dentro de las pantallas de `presupuestos.cjs` (la caja de documentación de la ficha, §4.1) y hereda de ahí el tema; del fichero solo coge `ICONO_MAIL` e `ICONO_WHATSAPP` (§2.4). Ningún otro fichero (ni `horario-bot.cjs` ni los de Alberto) lo usa. El presupuesto impreso de Plan 5 tampoco la usa: lleva su propio CSS de impresión.

**Por qué existe como fichero aparte**: para que cambiar un color/tipografía lo cambie en TODO el programa a la vez, en vez de tener que tocar 3 sitios y arriesgarse a que queden distintos. Regla escrita en la cabecera del propio fichero: aquí solo va lo que comparten TODOS los módulos; si una clase es de una sola pantalla, se queda en esa pantalla. Ante la duda, mejor dejarla en el módulo — sacar algo de aquí más tarde es fácil, quitar algo de aquí porque "no aplicaba a todos" es más lioso.

## 2.1 `getThemeCss()` — el CSS común, con prefijo `ptl-`
De qué partes se compone, en orden:
1. Reset y base (`*`, `body`, `a`).
2. Variables de color (`:root`): la paleta entera (§2.3 más abajo).
3. Placeholder global (gris claro + cursiva, para que nunca se confunda con contenido real).
4. Navegación superior (`.ptl-nav`).
5. Estructura de página (`.ptl-page`, breadcrumb).
6. Cards (`.ptl-card`) — el componente más usado del programa.
7. Inputs/altura única (`--ptl-input-h`).
8. Acordeones, checkboxes a medida, filtros, listas.

Casi todo lleva el prefijo `ptl-` (`.ptl-card`, `.ptl-badge`...) a propósito — pensado para convivir con el HTML de cualquier pantalla del programa sin chocar con nada que ya exista ahí.

## 2.2 `getPlan5Css()` — solo para Plan 5, con nombres SIN prefijo
Un mini-framework de formulario propio, solo para las pantallas de Plan 5 (Toma de Datos, Mediciones): `.card`, `.page`, `.grid`, `.toggle`, `.derived`, `.vrow`... — nombres cortos y genéricos, deliberadamente **sin** el prefijo `ptl-`.

**Por qué está separada de `getThemeCss()`**: porque esas clases solo las usa Plan 5, y la regla del fichero es que en `getThemeCss()` va solo lo compartido. **No hay choque de nombres con el CRM**: contando los atributos `class` reales, ni `presupuestos.cjs` ni `documentacion.cjs` usan ninguna clase de `getPlan5Css()` (comprobado de nuevo el 01/10/2026). Ojo al contar: la palabra suelta aparece dentro de nombres más largos (`ptl-com-grid`) o en código (`doc.page.width`), y eso no es usar la clase. El riesgo existiría solo si en el futuro se usaran esos nombres en el CRM; la separación es lo correcto por la regla de "solo lo compartido".

`getPlan5Css()` depende internamente de `getThemeCss()` (reutiliza dos de sus variables con nombres cortos, `--titulo`/`--g200` — ver §2.5), así que si `getThemeCss()` no se ha cargado antes, esos dos alias quedarían sin valor.

## 2.3 Cómo está organizada la paleta de color
- **`--ptl-general-1/2/3`**: identidad del programa: el azul corporativo (`--ptl-general-1`, también el del circulito «te toca a ti») y dos grises de superficies (`-2` y `-3` apuntan a `--ptl-gray-300` y `--ptl-gray-200`). Regla fija de uso, decisión de Guille: **botones = fondo claro + texto oscuro; ventanas = fondo oscuro + texto claro** — nunca al revés.
- **Familias de estado, cada una en trío fuerte/light/dark**: `--ptl-success` (verde), `--ptl-warning` (ámbar), `--ptl-danger` (rojo), `--ptl-orange`. **Desde v128 el verde y el rojo fuertes son los corporativos** (criterio de Guille: los del robotito): cambiarlos cambia a la vez W/M, pastillas, ✕ de borrar, filtros, avisos y robotitos, que ya no llevan colores puestos a mano (verde/rojo/gris = `--ptl-success` / `--ptl-danger` / `--ptl-gray-400`). Cualquier badge/pill nuevo debe usar una de estas, no un color suelto (los badges "En ejecución" y "Pte. cobro" de §3.5 ya las usan). Los botones de ultimátum también (desde v19.93).
- **Escala de grises `--ptl-gray-50` a `--ptl-gray-900`**: de más claro a más oscuro, uso libre para texto/fondos neutros.
- **Alias de compatibilidad**: solo quedan `--ptl-brand`, `--ptl-brand-light` y `--ptl-brand-dark`, que apuntan a `--ptl-general-1/2`. Los nombres más viejos (`--ptl-azul-oscuro`, `--ptl-azul-claro`) **ya no existen**: se renombraron sin dejar alias y ya no los usa nadie (§9.1, punto 1).

## 2.4 Símbolos únicos de correo y WhatsApp (v19.100)
Criterio de Guille (07/10/2026): en todo el programa el correo se pinta con **📧** y el WhatsApp con **💬**, siempre los mismos. Están definidos una sola vez aquí, `ICONO_MAIL` e `ICONO_WHATSAPP` (exportados junto a `getThemeCss`), y `presupuestos.cjs` y `documentacion.cjs` los usan en todos sus textos y botones (unos 65 sitios) en vez de escribirlos a mano. **Regla**: cualquier botón, título o texto nuevo con símbolo de correo o WhatsApp usa estas dos constantes; nunca otro emoji (✉️ salió como un rectángulo en blanco). Cambiar el símbolo aquí lo cambia en todas las pantallas. Comprobado al hacerlo: las 20 pantallas del banco salen idénticas.

## 2.5 Trampas y peligros conocidos
- **`getPlan5Css()` define solo 2 alias cortos** (`--titulo`, `--g200` — desde que se borraron los 16 sin uso el 19/09/2026, ver §9.1) que **apuntan a las mismas variables de `getThemeCss()`**, no son una paleta distinta. Si se ve `var(--titulo)` o `var(--g200)` en el HTML de Plan 5, son alias de `var(--ptl-titulo)`/`var(--ptl-general-3)` — tocar el valor real siempre en `getThemeCss()`, nunca redefinir el alias en `getPlan5Css()` (se desincronizaría de las demás pantallas).
- **`.ptl-card` tiene fondo oscuro + texto claro por decisión explícita de Guille (v1.19), con excepciones que NO heredan ese estilo**: inputs/textarea (siguen blancos), badges/pills de color de estado, y las listas de fondo blanco propio (Mails Pendientes, Expedientes HOY) — estas último llevan texto NEGRO a propósito (`.hoy-mails-list, .hoy-exp-list`). Si se añade una lista nueva de fondo blanco dentro de una card, hay que acordarse de meterla en ese selector o el texto saldrá con el color claro sobre fondo blanco (ilegible).
- **Los checkboxes personalizados** (`.hoy-exp-visto`, `.hoy-bot-llamado`) son al revés de lo normal: caja BLANCA con check NEGRO al marcar, decisión explícita de Guille — si se copia un checkbox de otro sitio del programa (o de fuera) sin esta clase, saldrá con el estilo por defecto del navegador, no el de la app.
- **`--ptl-input-h` es la ÚNICA variable que controla la altura de TODOS los campos de entrada del programa** (texto, número, select, los de las tablas de peines/pisos, la barra de búsqueda) — cambiar ese único número cambia todos a la vez. Los `textarea` están exentos a propósito (crecen con el contenido).
- **Usar una variable que no existe no da error**: el navegador simplemente ignora ese color y deja el heredado. Así pasaron desapercibidos `var(--ptl-azul-oscuro)` y `var(--ptl-text)` (ya quitados, §9.1); y `var(--ptl-general-4)` en el CSS de Mediciones (quitado en v138, §9.1 punto 9). Antes de usar una variable, comprobar que está en el `:root` de `getThemeCss()`.
- **`.ptl-search-input` sale en dos reglas de `getThemeCss()`, a propósito**: la regla común de altura de todos los campos (§2.5, `--ptl-input-h`) y la suya propia (relleno, borde, foco). Si se toca el buscador, se toca la suya; la altura, en `--ptl-input-h`.
- **Tarjeta de plantilla desactivada = borde y cabecera en rojo** (`.ptl-acordeon-inactiva`), para que no pase desapercibida aunque esté plegada — convención visual a mantener si se añaden plantillas nuevas.

## 2.6 Relaciones con otros ficheros — ¿son lógicas, funcionan, faltan, se pueden unificar?
- **Con `presupuestos.cjs` y `presupuestos_plan5.cjs`**: relación lógica y viva, los dos cargan el tema de verdad. **Con `documentacion.cjs`**: el CSS le llega indirectamente (su HTML vive dentro de las pantallas de `presupuestos.cjs`); lo único que importa del fichero son los dos símbolos de §2.4. Si se renombran `ICONO_MAIL`/`ICONO_WHATSAPP`, hay que tocar los dos ficheros.
- **Con `bot-whatsapp.cjs`**: no hay relación, y es correcto que no la haya — el bot no pinta pantallas propias (todo su HTML, cuando lo tiene, son mensajes de WhatsApp en texto plano), así que no necesita CSS. No es un hueco, es una ausencia lógica.
- **El puente de alias `getPlan5Css()` → `getThemeCss()`**: ya resuelto (§2.5, §9.1) — solo quedan los 2 alias con uso real.
- **`getThemeCss()` vs `getPlan5Css()` — ¿se pueden unificar?**: no, por la regla del fichero (en `getThemeCss()` solo va lo que comparten todos los módulos, §2.2). No es por choque de nombres, que hoy no existe: es que unirlas metería en todas las pantallas un mini-framework que solo usa Plan 5.

## 2.7 Optimización posible
Ver §9.1: las rondas del 19/09/2026 y del 02/10/2026 (clases sin uso, reset duplicado, colores que no existían y botones de ultimátum en la paleta) están hechas. El punto 9 (`--ptl-general-4`, encontrado en el repaso del 23/10/2026) se hizo en v138.

---

# 3. `presupuestos.cjs` — EL CRM

**Guion de funcionamiento**: gestiona el expediente de cada comunidad (CCPP) desde el primer contacto hasta que queda tramitado — es una máquina de estados (la fase) más todo lo que cuelga de cada fase: envíos de mail automáticos/manuales, plantillas, lectura de correo entrante (IMAP), pantalla HOY, mapa, listado. Vive entero (~18.570 líneas) dentro de un único `module.exports = function(app) {...}` — no hay clases, todo son funciones y constantes en el mismo cierre, y las rutas (`app.get`/`app.post`) se registran ahí mismo.

**Relación con Plan 5**: el CRM gestiona el expediente y sus fases; Plan 5 (capítulo 5) calcula el presupuesto. Se enlazan por la dirección (y el `ccpp_id`), **y no son independientes** (corregido en el segundo repaso del 23/10/2026): Plan 5 usa cinco piezas de este fichero (`buscarComunidadPorId`, `actualizarCampoComunidad`, `getSheetsClient`, `SHEET_ID`, `getImagenExpediente`) y al cerrar escribe en la ficha los importes y el tiempo previstos; este fichero lee `plan5_toma_datos` para saber si el expediente tiene Plan 5 (y entonces bloquea esos importes en la ficha, `_expedienteTienePlan5`) y la reescribe al renombrar (§3.12). **Si se cambia una de esas piezas, o cómo guarda Plan 5 la dirección, se rompe el otro lado.** Mapa completo en el capítulo 1.

**Relación con `documentacion.cjs`**: es la MÁS estrecha de todo el programa — no es solo "comparten pantalla" (§4.1), es que `documentacion.cjs` no podría arrancar sin esto. Al final del fichero, `presupuestos.cjs` publica un objeto `app.locals.presupuestos` con unas 47 piezas (funciones + constantes; lista y quién usa cada una en §3.24) que `documentacion.cjs` (y en parte Plan 5, §5.21) usan como si fueran suyas: `vistaFicha`, `pageHtml`, `actualizarCampoComunidad`, `normalizarCodigoPiso`, `leerPlantillaMail`, `PLAZO_DOC_INICIAL`/`PLAZO_CYCP_INICIAL`, los conteos `_contarFaltan`/`_contarFaltanBot`, `PTO_FASES`, `rowToObj`/`objToRow`... En sentido contrario, `presupuestos.cjs` también llama a `documentacion.cjs` en un sitio muy concreto: al entrar en fase `05_DOCUMENTACION` u `08_CYCP` llama, a través de `_dispararInicializacionDocumentacion`, a `D.inicializarEstadosFase(comu, faseNueva)` para que documentación arranque sus contadores. Se dispara desde `/avanzar`, `/aceptar` y `/enviar-mail` (este último es el camino real de entrada en 05 y en 08, porque el botón de avance abre la ventana del correo); ver §3.2.

## 3.1 Fases del expediente
`01_CONTACTO → 02_VISITA → 03_ENVIO_PTO → 04_ACEPTACION_PTO → 05_DOCUMENTACION → 06_VISITA_EMASESA → 07_PTE_CYCP → 08_CYCP → 09_TRAMITADA` (más `ZZ-RECHAZADO`/`ZZ-DESCARTADO`).

| En pantalla | En código |
|---|---|
| 05-INICIO DOC | `05_ACEPTACION_PTO` |
| 05-SEGUIMIENTO LISTADO | bloque `05_SEG_ESPERA` |
| 05-SEGUIMIENTO DOC | bloque `05_SEG_FECHA` |
| 05-Ultimátum doc | `05_ULTIMATUM_DOC` + `05_ULT_AVISO` + `05_ULT_RESOLUCION` |
| 08-INICIO CYCP | `08_INICIO_CYCP` |
| 08-CIERRE / "✓ Tramitados" | `08_FIN_CYCP` |

## 3.2 El motor de fases (`PTO_FASES`) y la máquina de estados
Cada fase vive como una entrada de un objeto `PTO_FASES`, con su código, nombre, color, **la fase siguiente** (`siguiente`) y, si tiene, la plantilla de mail asociada y la cadencia de seguimiento en días. La ruta `POST /presupuestos/expediente/avanzar` es genérica: mira `PTO_FASES[faseActual].siguiente`, cambia la fase, y aplica un puñado de **efectos secundarios cableados a mano por fase** — por ejemplo, al salir de `02_VISITA` sin `fecha_visita` rellenada pone la de hoy como respaldo; al salir de `07_PTE_CYCP` limpia las fechas y marcas del ultimátum de fase 05 (BL/BM/BN, `__SKIP` y `__HASTA`) para reutilizarlas en el de fase 08. **Desde v137 la limpieza vive en una sola función** (`_limpiarUltimatum05EnMemoria` + `_escribirLimpiezaUltimatum05`, que escribe BL/BM/BN celda a celda) y la usan los tres caminos de paso a 08: `/avanzar` y las dos ramas de `/enviar-mail` (enviar el correo 08-INICIO CYCP o «Saltar envío»), que es el camino normal porque desde la 07 el botón de avance abre esa ventana. Antes de v137 solo limpiaba `/avanzar` y las marcas de la 05 pasaban a la 08 (el cron no mandaba el 08-SEGUIMIENTO CYCP). **Si se añade otro camino de paso a 08, tiene que llamar a esas dos funciones.** Las fases `05_DOCUMENTACION`/`06_VISITA_EMASESA`/`07_PTE_CYCP`/`08_CYCP` NO están en `PTO_FASES` sino en una tabla paralela, `FASES_DOCUMENTACION_DEF` — presupuestos.cjs solo las usa para pintar la barra de acción y el botón de avanzar cuando un expediente está ahí; la lógica real de qué pasa en esas fases vive en `documentacion.cjs`.

**Migración automática de fases antiguas** (trampa a conocer, no a tocar): existe una tabla `MAPA_ESTADO_FASE` con decenas de nombres de fase viejos (del Excel SEGUIMIENTO.xlsm original y de renombrados anteriores del propio programa: `03_ENVIO`→`03_ENVIO_PTO`, `07_CONTRATOS_PAGOS`→`08_CYCP`...). `normalizarFase()` traduce cualquiera de esos nombres viejos al actual cada vez que se lee una fila del Sheet. **Un nombre que no conoce lo convierte en `01_CONTACTO`**: por eso es peligroso que otro módulo escriba en la columna de fase un valor nuevo (caso real posible: «14_FINALIZADA» de la parte de Alberto, §9.2). Si algún día se ve una fase con nombre raro en el Sheet, es normal: se traduce sola en memoria y se reescribe con el nombre bueno la próxima vez que ese expediente se guarde — nunca hace falta un script de migración aparte. La misma idea se repite para `08_CYCP`→`09_TRAMITADA`: si `fecha_cycp_completa` está rellena, `rowToObj()` la trata como tramitada en memoria aunque el Sheet todavía diga `08_CYCP`.

## 3.3 Modelo de datos: fila del Sheet ↔ objeto en memoria
Toda comunidad es una fila de la pestaña `comunidades`, con columnas fijas en `COLS`. `rowToObj(row)` convierte la fila en un objeto (rellenando alias de compatibilidad como `o.tipo`, `o.fase`, `o.importe`, `o.notas` para código antiguo) y calcula `ccpp_id` a partir de la dirección. `objToRow(o)` hace el camino inverso al guardar, con una trampa importante: **hay columnas que se fuerzan a número nativo** (`pto_total`, `mano_obra_previsto/real`, `material_previsto/real` con 2 decimales; `tiempo_previsto/real` con 1 decimal) — si se añade una columna nueva de importe o tiempo y no se mete en `COLS_NUM_IMPORTE`/`COLS_NUM_TIEMPO`, se guardará como texto y algunas fórmulas o comparaciones que esperan número pueden fallar en silencio.

## 3.4 El ciclo de vida completo de un expediente: crear, reactivar, rechazar, descartar, eliminar
El cuadro completo:
- **Crear** (§3.18): nace en `01_CONTACTO`, en modo bot por defecto.
- **Rechazar** / **Descartar**: dos destinos distintos para un expediente que no sigue adelante — `ZZ_RECHAZADO` (el cliente dice que no) vs `ZZ_DESCARTADO` (Instalaciones Araujo decide no seguir). Cada uno tiene su propio botón y su propia fase de aparcamiento, sin fecha de vuelta automática.
- **Reactivar**: **dos modos, con consecuencias muy distintas** — "último estado" (vuelve a la fase en la que estaba, **conservando** todas las fechas y contadores de mail ya acumulados) o "desde el principio" (vuelve a `01_CONTACTO` y **borra** fechas y contadores — empieza de cero de verdad). La pantalla pide confirmación explícita en los dos casos, con el aviso de qué se pierde en cada uno.
- **Eliminar**: solo desde `ZZ_DESCARTADO` (no se puede borrar un expediente activo directamente) — con el paso previo de `eliminar-analisis` (§3.12) que enseña qué se va a borrar antes de confirmar. Lo hace `_barrerExpediente`, que recorre **todas** las pestañas del Sheet buscando el expediente por `comunidad`, `direccion` o `ccpp_id` (y la forma "TIPO_VIA DIRECCIÓN" de `plan5_toma_datos`); en modo "contar" solo mira, en modo "borrar" elimina las filas de abajo arriba (para que no se desplacen los números de fila). Además manda a la papelera la carpeta de Drive del expediente.

**Piezas de infraestructura que hacen falta para todo esto**:
- **`crearComunidad`**: añade la fila nueva a `comunidades`.
- **`getOrCreateCarpetaExpediente(tipoVia, direccion)`**: crea (o encuentra si ya existe) la carpeta de Drive del expediente — **es la misma carpeta "nivel 1" que luego busca el bot** (`buscarCarpeta`/`getOrCreateCarpetaVivienda`, §6.9) para colgar dentro sus documentos — construida con el mismo nombre (`tipo_vía dirección`), así que las dos partes del programa siempre coinciden en qué carpeta es la del expediente, sin tener que coordinarse aparte.
- **`calcularResumenDocumentacion`**: el resumen en vivo que alimenta las variables `{{DOC_CCPP}}`/`{{DOC_PISOS}}`/`{{PCT_PISOS}}` de las plantillas de mail (§3.7) — bot-aware desde v18.171 (mismo arreglo que `_contarFaltanBot`, §9.2), para no marcar como pendiente lo que el vecino ya entregó por WhatsApp.

## 3.5 Estados de un expediente en fase 09-TRAMITADA
Tres estados, según dos columnas de `comunidades`, `fecha_pte_cobro` y `fecha_cobro` (col BE):
- Las dos vacías → **🔨 En ejecución** (clase `ptl-fila-badge-ejecucion`).
- `fecha_pte_cobro` con valor y `fecha_cobro` vacía → **⏳ Factura pte**: la empresa ya ha cobrado la obra y falta la factura de Guille, su 20 % del beneficio (clase `ptl-fila-badge-decidir`).
- `fecha_cobro` con valor → **💶 Facturado el dd/mm/aaaa** (clase `ptl-fila-badge-en-plazo`).

**Cómo se pone cada dato**:
- `fecha_pte_cobro` se pone con un **check titulado "Factura pte"**. Es un solo dato que aparece en dos sitios: la cabecera de la ficha y la primera columna de las filas de los grupos En ejecución y Factura pte de HOY (marcarlo en uno lo marca en el otro). Al marcarlo se guarda la fecha del día; al desmarcarlo se borra. La fecha no se muestra (el badge dice solo "⏳ Factura pte"), pero se guarda porque de ella dependen el estado, los grupos de HOY y las cajitas de Datos económicos.
- `fecha_cobro` se pone en la casilla **"Fecha factura"** de la cabecera de la ficha: el día en que Guille hace su factura, no el día en que la cobra. La columna conserva el nombre `fecha_cobro` (su comentario en el código ya lo explica).

## 3.6 Modales de email que bloquean el avance de fase
**Depende de**: la lista `fasesSaltables` (cliente) y su bloque `if (skip) {...}` correspondiente (servidor) — **los dos tienen que estar sincronizados**; añadir una fase a uno sin el otro rompe el botón (da error "no disponible") o no hace nada.

Cuatro transiciones de fase abren un modal de email en vez de avanzar directo: **05_ACEPTACION_PTO** ("✓ ACEPTADO"), **05_FIN_DOC** (fin de fase 05), **08_INICIO_CYCP** (fin de fase 07), **08_FIN_CYCP** ("✓ Tramitados", cierre de fase 08). En los cuatro, el avance solo ocurre al confirmar el envío — "Cancelar" no avanza nada.

**Todos** estos modales (y también `02_PTE_VISITA_CON_ACTA`/`SIN_ACTA` y `03_ENVIO_PTO`, que no bloquean fase pero también tienen el mismo botón) tienen la opción **"→ Saltar envío"**, que avanza la fase sin mandar el correo.

## 3.7 Envío de correo: plantillas, IMAP y ultimátums
- **Plantillas por fase**: `leerPlantillaMail(fase)`/`guardarPlantillaMail`, cacheadas (`_leerFilasMailPlantillas`, con invalidación manual `_invalidarCacheMailPlantillas`). El texto admite huecos `{{...}}` que rellena `sustituirVariables`/`sustituirVariablesAsync` (esta última cuando el hueco necesita ir a buscar un dato fuera del propio objeto `comu`, p.ej. a otra pestaña).
- **Las variables reales del motor** (`sustituirVariables`, la base síncrona): datos simples del CCPP (`{{direccion}}`, `{{comunidad}}`, `{{administrador}}`, `{{presidente}}`, `{{tipo_via}}`, `{{pto_total}}`), `{{compensacion}}` (calculada: 10% del total CON IVA, no de la base guardada — hay que multiplicar ×1,10 antes de sacar el 10%), fechas relativas `{{FECHA+N}}`/`{{FECHA-N}}` (hoy más/menos N días, para plazos), `{{fecha_envio_contratos_pagos}}` (columna AZ, convertida de `YYYY-MM-DD` a `DD/MM/AAAA`), y `{{FECHA}}` (hoy). **Encima de esa base**, `sustituirVariablesAsync` añade variables que necesitan ir a buscar datos fuera: `{{bloque_seguimiento}}` (un sub-texto que cambia según si el bot ya ha contactado con la CCPP o no — dos plantillas anidadas distintas, `05_SEG_ESPERA`/`05_SEG_FECHA`), `{{DOC_CCPP}}`/`{{DOC_PISOS}}`/`{{PCT_PISOS}}`/`{{DOC_PISOS_SIN_MOVIL}}` (resumen en vivo de qué falta, calculado en el momento de mandar el correo — si el renglón "sin móvil" sale vacío, se come también el guion y el salto de línea para no dejar una viñeta huérfana), y `{{fecha_aceptacion_pto}}`. **v19.106**: `{{fecha_limite_ultimatum}}` / `_limpia` / `_cycp` / `_cycp_limpia` (y por tanto `{{prorroga_frase}}`) dan la fecha de la prórroga **enviada** si la hay (no se recalcula con la casilla); sin fecha quedan vacías, sin texto de respaldo. **`{{resumen_comunicaciones}}`** (v19.106, para 05/08-RESOLUCIÓN DE CONTRATO): la lista de la cadena del protocolo, ver §3.11.1. **`{{si_financiacion}}`** (v130, criterio de Guille 22/10/2026, en 08-FIN CYCP): marca al principio de una línea de la plantilla; si algún piso de la comunidad tiene Forma de pago 6, 12, 18 o IPREM (pisos col AM; **FFCC no cuenta**), la línea sale sin la marca; si no, desaparece la línea entera. El texto de la línea sigue en el Sheet (regla 9). Plantilla: «     - {{si_financiacion}}estudio y aprobación de la financiación de los vecinos que la han solicitado».
- **Envío real**: `enviarMailReal()` (nodemailer) + registro en histórico (`registrarMailEnHistorico`). Los envíos largos (con adjuntos grandes) se lanzan como job async con `_envolverEnvioAsync`, consultable por `GET /envio-estado` — evita que una petición HTTP se quede colgada esperando.
- **Lectura de correo entrante (IMAP)**: `ejecutarLecturaImap()` corre por cron (`_arrancarCronImap`) y por botón manual; busca los correos **no leídos** de la bandeja de entrada (solo la primera cuenta configurada en `mail_cuentas`, la de administración), los descarga y analiza (`mailparser`), sube los adjuntos a una carpeta propia (`"00 ARCHIVOS MAILS PENDIENTES"`, dentro de la misma raíz de Drive que usa el bot para las carpetas de expediente, §6.9 — comparten raíz, no carpeta) y guarda cada uno como "pendiente" (`_guardarMailPendiente`, cuerpo recortado a 5.000 caracteres) para que alguien lo clasifique a mano contra un expediente — **no hay sugerencia automática de a qué CCPP pertenece**, se guarda siempre sin asignar. Tras procesarlo, lo marca como leído y lo **mueve a la carpeta "Descargados a plataforma" del propio servidor de correo** (no solo en el Sheet) — así el buzón real no se queda lleno de mails ya tratados. `_extraerIdsDriveDeTexto` saca los ID de Drive de la cadena de adjuntos del pendiente (`"ETIQUETA: url || …"`), para mandarlos a la papelera al descartar o moverlos a la carpeta del expediente al clasificar.
- **Rutas de envío** (pasada §0.24, 02/10/2026):
  - **`POST /presupuestos/expediente/enviar-mail`**: envía el correo de una **plantilla** desde su ventana (el modal que bloquea el avance de fase, §3.6). El cron no pasa por esta ruta: llama directamente a `enviarMailReal` (§3.8). Recibe expediente, fase, asunto, mensaje, destinatario, adjuntos y tipo (`manual_inicial` = primer envío desde el modal; `automatico` es el que apunta el cron en el historial; `manual` = antiguo). La cuenta de salida la dice la plantilla (columna J `cuenta_envio` de `mail_plantillas` → una fila de `mail_cuentas`). El descarte por tope no lo hace esta ruta: lo hace el cron.
  - **`POST /presupuestos/expediente/mail-enviar-manual`**: el envío del compositor **"Enviar mail manual"** de la caja Comunicaciones (texto libre, sin plantilla). Desde v19.100 admite `fase_plantilla` (`05_DOC_VECINO`, `08_CYCP_VECINO` y, para los recordatorios, `05_REC_M1_VECINO`, `05_REC_M2_VECINO`, `08_REC_M1_VECINO`, `08_REC_M3_VECINO`): el correo a un vecino se apunta en el historial con esa fase (sale con su nombre en Comunicaciones) y sale de la cuenta de envío de la plantilla, si la tiene. El compositor se abre ya relleno con `window.ptlAbrirMailPrellenado` (lo llama el botón 📧 de la caja de documentación). Desde v19.116, si la fase es un recordatorio (`05_REC_*` / `08_REC_*`), el envío lleva las cabeceras `In-Reply-To` y `References` del hilo del vecino (`_hiloVecino`, ver §4.2.3.3) para que salga como respuesta en la misma conversación.
  - **`GET /presupuestos/expediente/hilo-vecino?id=&email=&fase=`** (v19.116): devuelve `{ok, asunto:"Re: <asunto del correo inicial>", n, cita}` para precargar el recordatorio (`cita`, v126: el correo anterior citado como Gmail); `ok:false` si no hay correo inicial registrado.
  - **`GET /presupuestos/expediente/envio-estado`** y **`GET /presupuestos/expediente/envio-verificar`**: los envíos con adjuntos grandes van en segundo plano (`_envolverEnvioAsync`) y la pantalla pregunta por `envio-estado` cómo va. Si el servidor se ha reiniciado entre medias, ese estado se pierde; entonces la pantalla pregunta a `envio-verificar`, que mira en `mail_historico` si hay una fila de ese correo (esa fila solo se escribe cuando el servidor de correo ya lo ha aceptado, así que "hay fila" = "salió"). Recibe "hace cuánto se pulsó Enviar" como duración, para no depender del reloj del navegador.
- **Cada cuánto lee el correo**: la lectura IMAP corre **al minuto de arrancar el servidor y después cada 30 minutos** (`_arrancarCronImap`, con candado `_imapCronEnMarcha` para no solaparse). (Los comentarios del código ya lo dicen así desde v19.94.)
- **Ultimátums** (fase 05 y fase 08, mismo mecanismo duplicado con distinto flag) — mecanismo completo en §3.11.

## 3.8 El cron de envíos automáticos — la cadencia real de fase 05/08
Función `ejecutarCronEnviosAutomaticos`. Recorre todas las comunidades, se queda solo con las que están en una fase con automatismo (`CRON_FASES_AUTO`) y, dentro de esas, salta las `08_CYCP` que ya tienen `fecha_cycp_completa` (su trabajo ya está hecho). Precarga las 4 plantillas que puede necesitar de una vez (antes se leía el Sheet entero dentro del bucle por cada CCPP — con el caché ya solo hace falta una lectura).

**La cadencia de las fases 05 y 08 no está escrita en el código**: los días salen de las casillas de Plantillas mail (`dias_primer_envio`, `dias_recurrente`, `max_envios`) y el calendario completo, con lo que sale cada día, está en §3.9. El comentario del cron llevaba una tabla con el antiguo "esquema de la fase 05" (recordatorio automático a +30, disidentes a +40, resolución a +45) que ya no correspondía a nada; se quitó en v138.

## 3.9 Calendario completo de comunicaciones (correo y WhatsApp) — fases 05 y 08
Revisado el 25/09/2026 contra el código y las plantillas del Sheet; **avisos a vecinos (M1-M4) puestos al día el 17/10/2026**; **días y nombres de plantilla comprobados otra vez contra el código y el Sheet el 23/10/2026** (coinciden todos) con la cadena de avisos de §6.16 y las casillas del Sheet de ese día (los días que se citan son los de entonces: mandan las casillas de Plantillas del bot y de Plantillas mail). **Criterio de Guille: cada mensaje tiene que ser coherente, en el momento en que sale, con las fechas, la prórroga y lo que de verdad falta.** Tres canales: correos a la comunidad (plantillas de `mail_plantillas`, §3.7 y §3.21), WhatsApp automáticos del bot a cada vecino (§6.5) y WhatsApp manuales de Guille M1–M5 (§6.16). Los días de los correos se configuran en cada plantilla (`dias_primer_envio`, `dias_recurrente`, `max_envios`).

**Fase 05 — documentación (días contados desde el primer WhatsApp del bot; antes de eso, desde el correo 05-INICIO DOC)**

| Día | Correo a la comunidad | WhatsApp del bot (vecino) | WhatsApp de Guille (vecino) |
|---|---|---|---|
| 0 | 05-INICIO DOC: pide presupuesto firmado y listado; dice "20 días naturales" | — | — |
| cada 5 días hasta que el bot contacta | SEGUIMIENTO LISTADO (`05_SEG_ESPERA`) | — | — |
| 0 (piso a W) | — | Presentación; reenvíos días 2 y 5 si no contesta | — |
| 5, 10, 15 | SEGUIMIENTO DOC (`05_SEG_FECHA`): estado de la documentación + fecha límite (sin "20 días", solo la fecha) | Inactividad (1 y 3 días sin escribir) y plazo (10, 18, 20): recordatorio de lo que falta, **sin días** | M1 (amable), desde el día `t_wa_m1` (hoy 10), a todo vecino con algo pendiente, mientras el plazo está vivo (§6.16) |
| 21 (día siguiente al vencimiento) | PRÓRROGA (`05_ULT_AVISO`, 1er envío): nueva fecha = límite + `dias_primer_envio` de esa plantilla (**10 desde v19.106**, antes 20); al enviarla queda guardada la fecha que dice el correo (§3.11.1) | Recordatorio "fuera de plazo" (sin días) | M2: **espera a la decisión** (§6.16): al **conceder la prórroga**, amable con la fecha ampliada; al **pedir los disidentes** (con o sin prórroga), duro ("Al haber vencido el plazo…"). Plazo vencido sin decidir: no sale nada. Mínimo, el día `t_wa_m2` (21) |
| — | RECORDATORIO de prórroga: **ninguno desde v19.106** (casilla Recordatorio a 0; antes día 30) | — | — |
| 31 con prórroga (día siguiente a la fecha ampliada) / 21 sin ella | DISIDENTES (`05_ULT_RESOLUCION`): pide disidentes con fecha = día de envío + 5 | — | M2 duro al pedir los disidentes, a quien siga sin entregar (aunque ya tuviera el amable de la prórroga) |
| disidentes + 6 (día siguiente a los 5 días del correo) | RESOLUCIÓN (`05_ULT_RESOLVER`): compensación, 15 días naturales para pagarla | — | — |
| al completar | 05-FIN DOC: "con fecha {{fecha_contacto_vecinos}} solicitamos a los vecinos…" | — | — |

**Fase 08 — contratos y cartas de pago (días desde la fecha de envío de contratos, AZ: el correo 08-INICIO CYCP o, si no se envió, el paso a fase 08; desde v19.98, si el bot manda contratos, el día del primero, §4.7). El bot manda los contratos y recoge lo firmado (§6.17), pero no lleva estos plazos: no manda recordatorios.**

| Día | Correo a la comunidad | WhatsApp de Guille (vecino) |
|---|---|---|
| 0 | 08-INICIO CYCP: contratos y cartas enviados, qué necesitamos, forma de pago (sin banca online), "FECHA LIMITE … (10 DÍAS NATURALES)" | **Contrato por el bot** (v19.98, botón W de cada piso en fase 08, §6.17): plantilla Twilio con el PDF y la fecha límite; o, a mano, **M4 (envío CyCP)** a cada vecino, mandado **en fase 07 justo antes de pasar a 08** (v19.68) con su contrato y carta: mismo contenido, en singular, fecha límite vigente (sin "10 días") |
| 5 | 08-SEGUIMIENTO CYCP: estado + fecha límite (sin "10 días"); **un solo envío desde v19.106** (casillas 5/0/1; antes días 4 y 7) | **M1 de la fase 08** (amable, v19.110), desde el día `t_wa_m1c` (5; la casilla no está todavía en el Sheet y vale el 5 por defecto), a quien le falte contrato o carta, mientras el plazo está vivo; solo en comunidades con contratos enviados desde el 13/10/2026 (§6.16) |
| 11 (día siguiente al vencimiento) | PRÓRROGA (`08_ULT_AVISO`): nueva fecha = límite + **5 desde v19.106** (antes 10); queda guardada al enviarla (§3.11.1) | **M3** a cada vecino al que le falte contrato o pago, **esperando a la decisión** como el M2 (§6.16): al conceder la prórroga, amable con la fecha ampliada; al pedir los disidentes, duro ("venció el…"). `{pendiente}` dice exactamente qué le falta. Mínimo, el día `t_wa_m3` (11) |
| — | RECORDATORIO de prórroga: **ninguno desde v19.106** (antes día 15) | (el M3 sigue en HOY hasta marcarlo o hasta que entregue) |
| 16 con prórroga / 11 sin ella | DISIDENTES (`08_ULT_RESOLUCION`): pide los documentos de disidente **firmados por el Presidente y abonados por la CCPP** en {{plazo_resolucion_cycp}} días. Desde el 26/09/2026 indica además el **importe a abonar por cada vivienda disidente**: el de su Carta de Pago **menos 3,01 €** (el contrato, que no se formaliza), con pago solo por transferencia (cuenta y concepto: ver "Cuenta de EMASESA" más abajo) — no por cajero ni oficina, porque el código de barras de la carta cobra el importe completo y no permite descontar los 3,01 € | M3 duro al pedir los disidentes, a quien siga sin entregar |
| disidentes + 6 | RESOLUCIÓN (`08_ULT_RESOLVER`) | — |
| al completar | 08-FIN CYCP: "con fecha {{fecha_envio_contratos_pagos}} solicitamos…" | — |

**Con el bot (v19.98)**: los contratos se mandan **en fase 08**, piso a piso, con el botón W (§4.2.3.3, §6.17). Orden recomendado: pasar a 08 y mandar los contratos por el bot **el mismo día**, para que la fecha límite del correo 08-INICIO CYCP y la del WhatsApp coincidan (el primer contrato del bot fija la fecha de envío de contratos). El camino de abajo (M4 en fase 07) sigue para los vecinos sin bot.

**Envío de contratos y cartas de pago a los vecinos: en la fase 07 (v19.68, criterio de Guille, 01/10/2026)**. Orden de trabajo: (1) llegan de EMASESA los contratos y cartas; (2) **en fase 07** se manda a cada vecino su **M4** con sus documentos (botón 💬 de su fila → menú M4 / M5; el M4 sale también en 07); (3) se pasa a **fase 08** el **mismo día**, y el correo **08-INICIO CYCP** dice la verdad ("hemos enviado los contratos y cartas de pago a todos los vecinos"); en el modal, antes de enviarlo, se añaden las **incidencias** para que las resuelva el administrador (vecinos sin móvil, sin WhatsApp, teléfono erróneo…). En fase 07 el M4 pone como fecha límite **hoy + 10 días**, que es la que tendrá el correo si se pasa a 08 ese mismo día; si se pasa otro día, las fechas no coincidirían. En fase 08 el M4 sigue disponible y usa la fecha del paso a 08. Desde v19.102 el M4 queda apuntado por vecino (`pisos` col AZ); mejora posible no hecha (§8): que el correo 08-INICIO CYCP liste solo los que faltan.

**Cartas de pago de disidentes: dos casos distintos (criterio de Guille, 30/09/2026)**. (1) **Disidentes ya declarados antes de la fase 08** (en la documentación, fase 05): EMASESA emite su carta de pago **ya sin contrato**, con el importe correcto; el correo **08-INICIO CYCP** solo dice que no hay contrato y que su abono corresponde a la CCPP, **sin descuento**. (2) **Disidentes nombrados en la fase 08** (correo de disidentes de 08): sus cartas de pago se emitieron a nombre del vecino **incluyendo los 3,01 € del contrato**; para no retrasar el expediente pidiendo a EMASESA una carta nueva de disidente, se pide a la CCPP que la abone **descontando esos 3,01 €**, solo por transferencia. Además, el 08-INICIO CYCP va a la comunidad (administrador o presidente): no lleva la frase de financiación de los vecinos, que ya va en su WhatsApp M4.

**Cuenta de EMASESA para pagar las cartas de pago (29/09/2026)**: en todos los mensajes que dan la cuenta se escribe igual, en una línea: "Mediante transferencia bancaria a la cuenta de LA CAIXA - Nº ES11 2100 1683 1002 0003 1492 - TITULAR EMASESA EMPR. METRO. ABAST. SANEA. AGUAS SEVILLA (indicando siempre el concepto …)". Está en tres plantillas: correo **08-INICIO CYCP** y WhatsApp **M4** (concepto: PLAN 5, nombre, dirección y piso del ordenante; además de oficina y cajero) y correo de **disidentes de fase 08** (bloque "*** FORMA DE PAGO ***" justo después del importe, **solo transferencia**, concepto "PLAN 5, DISIDENTE, dirección y piso"). Si la cuenta o el titular cambian, hay que cambiarlos en las tres.

**Diferencia entre los correos de disidentes de 05 y 08 (criterio de Guille)**: en fase 05 los documentos de disidente solo se devuelven firmados por el Presidente (aún no hay nada que pagar); en fase 08 además abonados por la CCPP, porque la carta de pago del piso disidente la paga la comunidad (lo dice también 08-INICIO CYCP), con el descuento de 3,01 € explicado arriba.

**Aviso amable, luego aviso duro (v19.58-19.59, criterio de Guille: "al que no responde a uno suave no le sirve otro suave")**: a cada vecino le llegan dos avisos manuales de plazo. El 1º es amable y sale en plazo (en 05, M1 desde el día `t_wa_m1`, hoy 10; en 08, M4 el día 0 con los contratos y M1 de la 08 desde el día `t_wa_m1c`, 5). El 2º (M2 en 05, M3 en 08) **espera a la decisión de la prórroga** (v19.102, §6.16): **al concederla sale amable** (fecha ampliada) y **al pedir los disidentes sale duro** (texto de `{consecuencia}`), también a quien ya tuviera el amable. Con las casillas de hoy (prórroga de 10 días en 05 y de 5 en 08), el duro llega el día 31 en 05 y el 16 en 08 si se concede la prórroga, o el 21 / 11 si no. Así, tras un aviso amable siempre llega uno duro. El día 21/11 hay que decidir primero la prórroga (y, si no se concede, mandar el correo de disidentes) y después el M2/M3, porque el texto duro dice "ya hemos comunicado a su comunidad…". Marcado: el M2 guarda la fecha (col AF de `bot_expedientes`; los marcados antes de v19.59 tienen "1" y cuentan como aviso amable) y el M3 la suya (col AY de `pisos`); si esa fecha es anterior o igual al fin de la prórroga, se entiende que fue el aviso amable y el duro vuelve a salir. En el texto del M2 conviene decir "Le hemos enviado varios mensajes…" (no "3 automáticos y otro manual"), porque puede llegar más de una vez.

**Línea de reenvíos bajo el título de la ficha (v19.63, criterio de Guille: "en todos los sitios iguales, que funcione igual")**: en las cuatro fases con cron (01, 04, 05 y 08) aparece la misma línea, calculada por una sola función (`infoReenvioLinea`) que reproduce la regla del cron de cada fase:
- Formato común: **"📧 X+Y/Z - próximo reenvío DD-MM-AA"**, con X = envíos manuales (el correo de inicio o de presupuesto), Y = seguimientos automáticos que ya mandó el cron y Z = tope de la plantilla. Variantes: "- reenvío no iniciado", "- reenvío completado", "reenvío desactivado". **Fase 04, desde v19.94 (criterio de Guille)**: en vez de "1+5/4" dice el ciclo del cron: primer ciclo "📧 1er ciclo · 1+3/4 · próximo dd/mm" (el envío manual delante), siguientes "📧 2º ciclo · 1/4 · próximo dd/mm", terminado "… · completado", sin empezar "📧 reenvío no iniciado". El badge "Presupuesto enviado hace X d" cuenta siempre desde `fecha_envio_pto`. **Desde v19.96 (criterio de Guille) el badge (HOY y ficha) dice también el ciclo**: "👍 Presupuesto enviado hace 14 d - 1er Cron 1+1/4 (24/10)", "… - 2º Cron 1/4 (07/10)"; reactivado a mano con el ciclo agotado, "… - 2º Cron 0/4 (dd/mm)" (si se reactivó antes de agotarlo, sigue en su ciclo: "1er Cron 1+3/4"); agotado sin fecha, "⚠️ … - Reactivar Cron" como siempre. La fecha es la del próximo envío. Comprobado 05/10/2026 en los 67 de fase 04: 33 en primer ciclo, 30 en segundo y 4 "Reactivar Cron"; los 54 que no salen en HOY tienen todos el cron en marcha.
- **Fase 05 con bot**: dice además el tramo, "seguimiento listado" (antes de que el bot escriba al primer vecino; cuenta desde la aceptación) o "seguimiento documentación" (después; cuenta desde el primer WhatsApp del bot). Ej.: "📧 1+1/3 seguimiento listado - próximo reenvío 04-10-26".
- **Fases 05 y 08 con el ultimátum empezado** (prórroga, disidentes o resolución ya sellados): "📧 reenvío parado · ultimátum en curso (lo llevan los botones)", porque el cron deja de mandar seguimientos. En 08 con CyCP completa: "📧 reenvío terminado (CyCP completa)".
- En 05 y 08 la línea busca la plantilla de seguimiento (`05_SEGUIMIENTO_DOC`, `08_SEGUIMIENTO_CYCP`), no la que tiene el nombre de la fase.
- **Listado sin recibir (v19.64)**: cuando se agotan los seguimientos del listado (con 5/5/3: días 5, 10 y 15) el cron ya no manda nada y no corre ningún plazo, porque todo arranca con el primer WhatsApp del bot. Desde el día siguiente al hueco del último (primer envío + recurrente × tope = día 20), el badge de HOY y de la ficha pasa de verde "👍 Listado solicitado · hace X d" a **ámbar "⚠️ Listado sin recibir · hace X d"**: toca llamar al administrador o al presidente.
- En la lista de Comunicaciones de la ficha, "Automático" = lo mandó el cron; "Manual" = lo mandó Guille o es una respuesta. En la línea de tiempo, "(ML)" = por mail y "(WH)" = por WhatsApp (no significa manual).

**Regla del día siguiente (v19.56, criterio de Guille, 27/09/2026)**: el último día de cada plazo es entero de la comunidad y de los vecinos, así que **cada decisión sale el día siguiente a su vencimiento**: el botón "¿Conceder prórroga?" (día 21 en 05 / 11 en 08), "Solicitar disidentes" (el día siguiente al fin de la prórroga, o en el acto si no se concede) y "Resolver el contrato" (el día siguiente a los 5 días que da el correo de disidentes). Los avisos de vencimiento a los vecinos van el mismo día que el botón, para no confundir qué se mandó a quién: **M2 = 21** y **M3 = 11** (días de sus tarjetas en Plantillas del bot; su texto dice entonces "venció el…" y "Al haber vencido el plazo…"). Los recordatorios a mitad de plazo no cambian: M1 (día `t_wa_m1`, hoy 10, en 05; `t_wa_m1c`, 5, en 08) y seguimientos por correo. El recordatorio de prórroga existe solo si su casilla es mayor que 0 (desde v19.106 está a 0: no hay). La línea de tiempo y la ventana de Tiempos muestran ya estos días. Las fechas que dicen los correos (fecha límite, ampliada, plazo de disidentes) no cambian.

**Reglas de texto que mantienen la coherencia**:
- "X días naturales" **solo en los correos de inicio** (05-INICIO DOC, SEGUIMIENTO LISTADO, 08-INICIO CYCP) y en el pago de la compensación (RESOLVER). En los de seguimiento y en todos los WhatsApp, solo la fecha: durante la prórroga ya no son 20 ni 10 días.
- Los WhatsApp de Guille usan siempre variables, no texto fijo: `{pendiente}` (lo que falta), `{vence_el}` (vence / vence hoy / venció), `{prorroga_nota}` y `{consecuencia}` (§6.16).
- El bot no da días (§6.5): los plazos los comunica Guille.

**Prórroga concedida u omitida**: en el paso "Prórroga" del ultimátum (fase 05 día 21, fase 08 día 11: el día siguiente al vencimiento) el botón amarillo de HOY y de la ficha dice **"¿Conceder prórroga?"** (es una pregunta: la decisión se toma en el modal), y el modal tiene tres salidas (criterio de Guille; los días de la prórroga son siempre los de la plantilla): a la derecha, arriba en **verde "✓ Conceder prórroga de X días y enviar"** y debajo en **rojo "✗ No conceder prórroga y solicitar disidentes"**; a la izquierda, en gris como en el resto de modales, **"→ Continuar sin enviar (sin prórroga)"**: no manda nada, anota que no hay prórroga y deja el botón "Solicitar disidentes" en HOY. **No conceder es avanzar el procedimiento**: no sale correo de prórroga, el plazo sigue siendo el inicial y **se abre en ese mismo momento el modal de "Solicitar disidentes"**; si se cancela, el botón "Solicitar disidentes" queda en HOY y en la ficha desde ese día. En la línea de tiempo, Recordatorio "omitido", Disidentes "toca el [día del vencimiento]" y Resolución a los 5 días del envío de disidentes. **Todo entregado**: si la comunidad y todos los pisos están completos, el badge de HOY y de la ficha deja de proponer pasos de ultimátum y dice "✓ Todo entregado · pasar de fase" (el paso de fase lo da Guille con el botón de la ficha, que corta la cadena de avisos). Tras resolver el contrato el badge dice "📛 Contrato resuelto · pago dd/mm" y, pasado ese día, "📛 Pago vencido dd/mm · reclamar" (v19.109, §3.15.4). Al conceder o no conceder, se sella `fecha_ultimatum_ampliado`; si se omite, además se anota `fecha_ultimatum_ampliado__SKIP` en `mails_enviados`. **Regla única** (`_p5ProrrogaConcedida`): hay prórroga solo si está sellada y no omitida. La aplican: los correos (`{{prorroga_frase}}`, `{{prorroga_frase_limpia}}` y `{{y_su_ampliacion}}`, que vale " y su ampliación" o vacío, en la frase "una vez vencido el plazo{{y_su_ampliacion}}" de ULTIMÁTUM DISIDENTES: **en uso en la plantilla de fase 08 desde el 29/09/2026** (dice "y su ampliación" solo si hubo prórroga concedida); en la de fase 05, a 29/09/2026, la frase sigue fija), los WhatsApp M1-M5 (fecha vigente y `{prorroga_nota}`), el badge de HOY ("⏭ Sin prórroga" en vez de "📨 Prórroga concedida", y sin botón "Recordar prórroga") y la línea de tiempo (el Recordatorio aparece como "omitido" con la misma fecha).

**Comprobación del proceso (25/09/2026, banco de pruebas con el código real y el Excel)**: se simularon día a día, pulsando los botones de verdad, los dos caminos (con y sin prórroga) en fase 05 y en fase 08, más el vecino que entrega todo; badges de HOY y ficha, línea de tiempo, correos y WhatsApp salieron coherentes entre sí. No comprobable en el banco de pruebas: el envío real (Gmail/Twilio) y las plantillas del Sheet de producción si difieren del Excel. Los fallos que salieron están en §9.2. La prueba es anterior a la regla del día siguiente (v19.56), que solo movió días, no textos ni mecanismo.

**Una sola fecha límite y unos solos días de prórroga para todos (v19.36, criterio de Guille)**: en fase 05, los correos, los WhatsApp M1-M5 y el botón de cada vecino usan la misma fecha límite, la de la comunidad (primer WhatsApp del bot a cualquier vecino + 20, `_fechaLimiteDocBot`), aunque el bot haya escrito a cada vecino un día distinto. Las comunidades que no lleva el bot (`bot_comunidad_activo` distinto de BOT_WHATSAPP, expedientes antiguos) siguen con su fecha de siempre, `fecha_limite_documentacion_vecinos` (col BC). Los días de prórroga salen siempre de la casilla de la plantilla de prórroga (`05_ULT_AVISO` / `08_ULT_AVISO`), tanto en correos como en WhatsApp y badges.

## 3.10 Ventana "Tiempos" (fases 05 y 08)
Se abre desde el botón **📋 Tiempos** de las cabeceras 05 y 08 de HOY (que lleva a Plantillas mail con `?tiempos=05` / `?tiempos=08` y la abre sola) o desde los botones **📋 Tiempos Fase 05-Doc / 08-CYCP** de las tarjetas 05-ACEPTACIÓN PTO y 08-INICIO CYCP de Plantillas mail. Es **solo informativa**: no manda nada ni cambia ningún dato. Código: `vistaPlantillas` (filas `_esqRows` / `_esqRows8`) y las funciones de cliente `ptlAbrirEsquema05` / `ptlAbrirEsquemaCycp`.

**De dónde sale cada número** (si se cambia en su sitio, la tabla se recalcula sola):
- Seguimientos (listado y documentación en 05; CyCP en 08): `dias_primer_envio`, `dias_recurrente` y `max_envios` de las plantillas `05_SEGUIMIENTO_DOC` y `08_SEGUIMIENTO_CYCP` (hoy 5/5/3 y 5/0/1: en la 08 un solo seguimiento el día 5, desde el 12/10/2026). Las filas `05_SEG_ESPERA` y `05_SEG_FECHA` solo guardan textos; sus días están a 0 a propósito.
- Plazo inicial: constantes del código `PLAZO_DOC_INICIAL` (20) y `PLAZO_CYCP_INICIAL` (10).
- Prórroga y recordatorio: `dias_primer_envio` y `dias_recurrente` de `05_ULT_AVISO` / `08_ULT_AVISO` (desde el 12/10/2026: 10/0 y 5/0, la mitad del plazo inicial y sin recordatorio; antes 20/10 y 10/5). Son los mismos días que usan los correos, los badges y los WhatsApp (v19.36) **para las prórrogas que aún no se han enviado**: la ya enviada conserva la fecha que dijo su correo (v19.106, §3.11.1). Recordatorio 0 = sin recordatorio (v19.106: antes el 0 se tomaba como 10). Se cambian en la tarjeta **05 · Ultimátum doc / 08 · Ultimátum CYCP**; al guardar, la casilla de días de `*_ULT_RESOLUCION` toma el mismo valor que la ampliación.
- Resolución: `dias_primer_envio` de `05_ULT_RESOLVER` / `08_ULT_RESOLVER` (5), contados desde que se **envía** el correo de disidentes.
- WhatsApp M1, M2 y M3: `t_wa_m1`, `t_wa_m2`, `t_wa_m3` de Plantillas del bot (21 y 11 para M2 y M3; el M1 de la 05 pasa a 10 por decisión de Guille del 13/10/2026, porque el último reenvío del bot es el día 5). M1 de la 08: `t_wa_m1c` (5).

**Qué muestra**: una fila por paso, en orden de días, con qué sale (correo, WhatsApp o botón), cómo sale (manual, cron, aviso en HOY) y el badge que se ve en HOY con su texto actual. La prórroga aparece con sus **dos caminos**: con prórroga (recordatorio y disidentes al final de la prórroga) y sin prórroga (disidentes en el acto, sin recordatorio). La resolución se muestra como "disidentes +6" (el día siguiente a los 5 días del correo). El cuadro amarillo da el tiempo máximo hasta resolver **con y sin prórroga** (con la regla del día siguiente: fase 05, 47 y 27 días desde el contacto del bot, más el tramo del listado; fase 08, 27 y 17 días desde el envío de contratos; con los días del 12/10/2026: 05, 37 y 27; 08, 22 y 17). Las notas al pie explican de qué fecha cuenta cada cosa y recuerdan las reglas: no conceder es avanzar, "todo entregado" corta la cadena, se puede no conceder en 05 y sí en 08, el bot no lleva los plazos de 08, y al entrar en 08 se limpian las fechas y marcas del ultimátum de 05.

**Tarjetas de ultimátum de Plantillas mail**: sus textos de ayuda no llevan días fijos: calculan el día con la plantilla y la regla del día siguiente.

## 3.11 Los 8 ultimátums (4 botones × fase 05/08) — mecanismo completo
**Rutas** (pasada §0.24, 02/10/2026): una por botón y fase. Fase 05: **`POST /presupuestos/ultimatum/ampliar`** (Ampliar plazo / ¿Conceder prórroga?), **`/ultimatum/recordar`** (Recordar prórroga), **`/ultimatum/disidentes`** (Solicitar disidentes) y **`/ultimatum/resolver`** (Resolver el contrato). Fase 08: las mismas con `ultimatum8/`. Todas mandan su plantilla por el camino del envío manual (tipo `manual`, para no tocar los contadores del cron) y después sellan su marca (columnas BL/BM/BN, o una clave en `mails_enviados` para "Recordar prórroga"). Si se pulsa "Continuar sin enviar", el sello es el mismo pero se apunta como omitido. El sellado nunca rompe el envío: si falla, el correo ya ha salido y solo se avisa.

Los 4 botones de ultimátum (**¿Conceder prórroga?** —antes "Ampliar plazo"—, Solicitar disidentes, Resolver el contrato, Recordar prórroga) existen por duplicado, uno para fase `05_DOCUMENTACION` y otro para `08_CYCP` (8 rutas en total, todas de una línea, delegando en las mismas dos funciones core `_coreBotonUltimatum`/`_sellarUltimatum`).

**Cada botón dispara una plantilla de mail concreta y sella una fecha concreta al enviarla**:
- **Ampliar plazo** → plantilla `05_ULT_AVISO`/`08_ULT_AVISO`, sella `fecha_ultimatum_ampliado`.
- **Solicitar disidentes** → plantilla `05_ULT_RESOLUCION`/`08_ULT_RESOLUCION`, sella `fecha_disidentes_solicitados`.
- **Resolver el contrato** → plantilla `05_ULT_RESOLVER`/`08_ULT_RESOLVER`, sella `fecha_contrato_resuelto`.
- **Recordatorio** → reutiliza la MISMA plantilla que "Ampliar plazo" (`05_ULT_AVISO`/`08_ULT_AVISO`), pero **no sella una columna de fecha propia** — no existe esa columna en el Sheet. Desde v19.106 el botón "Recordar prórroga" solo sale si la casilla Recordatorio es mayor que 0 (hoy está a 0). En vez de eso, `_sellarUltimatum` guarda una marca dentro del JSON `mails_enviados` (clave `05_ULT_RECORDATORIO` u `08_ULT_RECORDATORIO`; `@flag:` es solo el prefijo con el que se le pasa a la función), el mismo campo que usa el sistema de seguimiento de mails automáticos (§3.7).

**Candado de fase**: cada ruta comprueba que el expediente esté EXACTAMENTE en la fase que le corresponde (`05_DOCUMENTACION` para las 4 de "05", `08_CYCP` para las de "8") — si no, rechaza con error 400. No se puede disparar un ultimátum de fase 08 desde un expediente que sigue en fase 05.

**"Continuar sin enviar" (`skip=1`)**: cada botón admite marcar la fecha como sellada SIN mandar el correo, y anota además `<campo>__SKIP` en `mails_enviados` para que la línea de tiempo lo pinte como "omitido". En disidentes y resolución significa "ya se avisó por otra vía". **En la prórroga significa "no se concede"** (v19.29-19.31): el botón se llama "✗ No conceder prórroga y solicitar disidentes", no hay ampliación para nadie (correos y WhatsApp usan el plazo inicial), no aparece "Recordar prórroga" y se abre en el acto el modal de disidentes. El flujo completo, con y sin prórroga, y lo que dice cada correo y WhatsApp en cada momento: §3.9.

**Herencia de plantilla contenedora**: los sub-mails de ultimátum (AVISO y RESOLUCION) heredan del "contenedor" (`05_ULTIMATUM_DOC`/`08_ULTIMATUM_CYCP`) el asunto, la cuenta de envío, el CCO y los adjuntos fijos si no tienen los suyos propios en el Sheet — así no hace falta rellenar 4 plantillas casi idénticas a mano. Detalle fino: al heredar el asunto para el correo de RESOLUCION (disidentes), se le cambia automáticamente la coletilla final de "(PRÓRROGA...)" a "(SOLICITUD DISIDENTES)", porque el contenedor solo tiene un asunto pensado para el aviso de prórroga y no encaja tal cual para pedir disidentes.

**`_sellarUltimatum` solo sella la primera vez** — si el campo de fecha ya tiene algo escrito, no lo pisa (protege contra un doble clic o un reenvío accidental que borre la fecha real del primer aviso).

### 3.11.1 Prórroga guardada, recordatorio a 0, resumen de comunicaciones y correos fuera del protocolo (v19.106)
**Criterio de Guille**: los expedientes siguen el protocolo de plazos; la prórroga es la mitad del plazo inicial (05: 20 + 10; 08: 10 + 5), sin recordatorio de prórroga, y en la 08 un solo seguimiento a los 5 días. Los días son casillas del Sheet (Plantillas mail, tarjetas **05 · Ultimátum doc**, **08 · Ultimátum CYCP** y **08-SEGUIMIENTO CYCP**). **Sin respaldos en los correos (v139)**: si la casilla de Ampliación o de Resolución está vacía (o a 0), `{{plazo_ampliacion}}`, `{{plazo_ampliacion_cycp}}`, `{{plazo_resolucion}}` y `{{plazo_resolucion_cycp}}` no inventan un número: la ventana del correo dice «Falta el número de días de … en Plantillas mail» y no se prepara (`_FALTA_CASILLA`). Los badges de HOY (`_badgeUltimatumHoy`) conservan sus respaldos internos (20/10 de ampliación, 10 de recordatorio): solo dibujan en qué paso va, no mandan nada.

**Calendario resultante**: tabla completa día a día en §3.9 (05: prórroga hasta el día 30, disidentes el 31 o el 21 sin prórroga; 08: prórroga hasta el 15, disidentes el 16 o el 11).
La prórroga cuenta sobre la fecha límite (no depende del día en que se pulsa); los disidentes cuentan desde el día en que se **envían**.

**Fecha de la prórroga guardada (v19.106)**: antes la fecha ampliada se recalculaba siempre con la casilla, y cambiar la casilla movía la fecha de prórrogas ya comunicadas. Ahora:
1. Al enviar la prórroga (`_coreBotonUltimatum`, campo `fecha_ultimatum_ampliado`) se guarda en `mails_enviados` la clave **`fecha_ultimatum_ampliado__HASTA`** con la fecha que dice el correo enviado ("ampliamos el plazo hasta el…"; si el texto no la trae, la de la casilla). Se borra al pasar a 08 con las demás marcas del ultimátum, por cualquiera de los tres caminos (v137, §3.2).
2. Prórrogas enviadas antes de v19.106: la fecha se lee del propio correo de prórroga en `mail_historico` (el primero que salió desde el día sellado, con "PRORROGA" en el asunto o plantilla `*_ULT_AVISO`; caché de 2 minutos, `_cargarProrrogasHist`). Comprobado: Otelo 8 → 17/08/2026, Diego Puerta 5 → 21/09/2026 (antes el programa calculaba 01/07 para Diego Puerta 5, que no era lo que se le dijo).
3. Sin prórroga enviada: fecha límite + casilla (lo que propone la ventana de prórroga).
La usan: las variables de fecha ampliada y `{{prorroga_frase}}`, el badge de HOY y de la ficha (los disidentes tocan el día siguiente a esa fecha), la línea de comunicaciones, los M2/M3 y la cadena de avisos de HOY, el botón W/M de la ficha (`prorrogaDias.hasta`) y el envío de contratos por el bot. Helpers: `_p5ProrrogaHasta` (síncrono), `_fechaProrrogaIso`, exportados como `prorrogaHasta` y `cargarProrrogasHist`.

**Recordatorio a 0 = sin recordatorio (v19.106)**: el badge no ofrece "Recordar prórroga", la línea de comunicaciones no pinta el punto Recordatorio (salvo que ya se enviara uno) y la ventana Tiempos no tiene esa fila. Antes el 0 se tomaba como "sin dato" y valía 10. La casilla del editor admite 0.

**`{{resumen_comunicaciones}}` (v19.106)**: en 05/08-RESOLUCIÓN DE CONTRATO, bajo "Le recordamos las comunicaciones realizadas:". Solo lo que consta en Comunicaciones (correos que salieron, nunca WhatsApp), con su fecha real; un paso no enviado o con "Continuar sin enviar" no sale. Formato de cada línea: `- dd/mm/aaaa: qué (plazo dd/mm/aaaa).`
- 05: `solicitud del listado de vecinos (recibido dd/mm/aaaa)` (correo 05-INICIO DOC; recibido = día común: primer bot o, sin bot, primer 05-DOC VECINO) · `solicitud de la documentación a los vecinos (plazo …)` · `ampliación del plazo, por cortesía (plazo …)` · `solicitud del nombramiento como "DISIDENTES" de los vecinos faltantes (plazo …)` (el plazo, el que dice su correo; si no, envío + casilla de `05_ULT_RESOLVER`).
- 08: `solicitud de los Contratos firmados y los Justificantes de pago a los vecinos (plazo …)` · prórroga · disidentes (igual que en 05).
- Las ampliaciones extraordinarias escritas a mano (Otelo 8: 22/09 y 28/09-01/10) no salen: Guille las añade en la ventana o pide el texto a medida.
Código: `_resumenComunicaciones`.

**Aviso de correos fuera del protocolo (v19.106)**: al abrir la ventana de **Resolver el contrato**, si hay correos escritos a mano (`00_MANUAL` o `manual_externo`) a la comunidad **después de la fecha límite inicial**, sale arriba "⚠ Hay N correos manuales… que no están en el resumen de comunicaciones: dd/mm, …". Ruta `GET /presupuestos/plantilla-mail` (campo `aviso_manual`, solo para `*_ULT_RESOLVER`); código `_correosFueraProtocolo`.


## 3.12 Otras acciones sobre un expediente
- **`POST /presupuestos/expediente/eliminar`**, con **`eliminar-analisis`** como paso previo: antes de borrar, `eliminar-analisis` devuelve un resumen de **todo lo que se va a borrar** (cuántas filas en cada pestaña afectada) para que el modal de confirmación se lo enseñe a Guille por escrito antes del botón definitivo — no es un simple "¿seguro?", es un listado real de lo que desaparece.
- **`POST /presupuestos/expediente/renombrar`**: cambia el tipo de vía y/o la dirección de un expediente. Como el `ccpp_id` no se guarda sino que se calcula de la dirección, hay que arrastrar todo lo que la usa como enlace. Funciona en dos pasos:
  1. **Análisis** (siempre): cuenta las filas que cambiará en `comunidades`, `mail_historico` y `plan5_toma_datos` (aquí busca la forma "TIPO_VIA DIRECCIÓN" en mayúsculas, localizando las columnas `direccion`/`ccpp_id` por su cabecera), y revisa **todas las demás pestañas** (`_renomOtrasHojas`) por si tienen filas de ese expediente. No deja poner una dirección que ya tenga otro expediente.
  2. **Cambio** (al confirmar): renombra `mail_historico` y `plan5_toma_datos`, después la carpeta de Drive (`_renombrarCarpetaExpediente`, dentro de `DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES`; si no existe, no crea nada) y al final la fila de `comunidades`. **Si solo cambia el tipo de vía** (v138): se renombran la carpeta, `tipo_via` y también la fila de `plan5_toma_datos`, que guarda "TIPO_VIA DIRECCIÓN" y por la que Plan 5 encuentra la obra (antes de v138 no se tocaba y Plan 5 no la encontraba desde la ficha). Si algo se corta, en pantalla sigue el nombre viejo y se puede reintentar.
  - **Las demás pestañas no se tocan** (`pisos`, `bot_*`…): si tienen filas, se avisa para cambiarlas a mano. Por eso, **desde v19.94 (criterio de Guille) la dirección no se puede cambiar a partir de la fase 05** (05 a 09): el servidor responde "Este expediente ya está en documentación: la dirección ya no se puede cambiar, porque los pisos y el bot dependen de ella" y la ficha deja el valor viejo. El tipo de vía sí se puede cambiar (los pisos guardan solo la dirección).
  - Es la forma correcta de cambiar una dirección: cambiarla escribiendo en la Toma de Datos de Plan 5 crea un presupuesto nuevo (§9.4, punto 10).
- **Cambios de estado** (los botones de la barra de acción, §3.19.3.1; ciclo completo en §3.4):
  - **`POST /presupuestos/expediente/aceptar`**: pasa el expediente a `05_DOCUMENTACION` y arranca la documentación (`_dispararInicializacionDocumentacion`, que llama a `documentacion.cjs`).
  - **`POST /presupuestos/expediente/rechazar`** y **`POST /presupuestos/expediente/descartar`**: pasan a `ZZ_RECHAZADO` o `ZZ_DESCARTADO` y guardan la fase en la que estaba (columna BK `fase_antes_descarte`) para poder volver.
  - **`POST /presupuestos/expediente/reactivar`**: saca de ZZ con dos modos: **"último"** vuelve a la fase guardada en BK conservando fechas y contadores; **"principio"** vuelve a `01_CONTACTO` borrando fechas y contadores. En expedientes antiguos sin BK, adivina la fase por las fechas que tenga (`_inferirFaseDesdeData`; nunca borra datos). **Corregido en v19.104 (09/10/2026, caso Génova 10)**: si BK está vacía (expedientes rechazados antes de existir esa columna), "último" deduce la fase por las fechas (envío del presupuesto → 04, visita → 03, si no 01; y las de fases posteriores). Antes, BK vacía se convertía en 01-CONTACTO sin mirar las fechas, y además la fecha de visita se buscaba con un nombre de columna que no existe (`fecha_visita_pto` en lugar de `fecha_visita`). Probado en el banco con los datos de Génova 10: vuelve a 04.
- **`POST /presupuestos/expediente/retroceder`**: vuelve el expediente a la fase anterior — lleva un campo `conservar` (por defecto "1", conservar) para decidir si se guardan o se limpian ciertos datos de la fase que se abandona.
- **`POST /presupuestos/expediente/cerrar-cycp`**: cierra el CyCP (fase 08) marcándolo como completado y pasa el expediente directamente a `09_TRAMITADA`.
- **`POST /presupuestos/expediente/campo`**: guardado genérico de un campo suelto de la ficha (fechas y similares) sin pasar por el formulario completo — usado en varios sitios del `<script>` de `vistaFicha`.

## 3.13 Acciones sueltas de piso y mail (CRUD simple, sin pantalla propia)
Rutas cortas que no tienen pantalla propia — las llama el JS de HOY o de la ficha para guardar un campo suelto sin recargar la página:
- **`POST /presupuestos/piso/guardar-nota-simple`** / **`guardar-notas-hoy`**: guardan, respectivamente, el campo "Nota Simple" (titular registral) y las notas libres de un piso — las mismas notas que se editan desde la fila de HOY o desde `documentacion.cjs`.
- **`POST /presupuestos/piso/modo-bot`**: cambia un piso individual entre manual y bot — **aquí es donde nace el disparo real de `enviarPresentacionPiso`** (§6.13): trae un flag `enviar_presentacion` que, si viene activado, es lo que hace que el bot le mande el primer mensaje al vecino al pasar su switch a W.
- **`POST /presupuestos/piso/toggle-hoy`**: añade/quita un piso concreto del marcado "en HOY" (el reloj ⏰, pero a nivel de piso, no de CCPP).
- **`POST /presupuestos/mail-clasificar`** / **`mail-descartar`**: de la caja "Mails Pendientes" de HOY — clasificar cuelga el mail entrante de un CCPP concreto (y mueve sus adjuntos a la carpeta del expediente); descartar lo borra y manda sus adjuntos de Drive a la papelera.
- **`POST /presupuestos/mail-toggle-hoy`** / **`expediente/mail-borrar`**: marcar/quitar un mail del reloj de HOY, o borrarlo del histórico de comunicaciones de la ficha.
- **`GET /presupuestos/hoy/conversacion?tel=`** (v125): todos los mensajes con ese vecino por el bot, en JSON (`quien` vecino/bot/equipo, `fecha`, `texto`). Desde v126 empieza en la **primera presentación** (apuntada por el bot, o la fecha de la col J de `bot_expedientes` si es anterior) e incluye lo escrito por vecinos con los que el bot no trabaja (`texto_fuera`; el archivo sale como "📎 Ha mandado un archivo (no se guarda…)") y los avisos M enviados por el bot. La usan HOY y la ficha (§4.2.3.3).
- **`POST /presupuestos/hoy/aviso-bot`** (v126): body `tel`, `clave` (nombre de la plantilla Twilio), `nombre`, `comunidad`, `piso`, `pendiente`, `fecha`, `etiqueta`. Manda el aviso M al vecino por el bot (`app.locals.botWhatsapp.enviarAvisoM`).
- **`POST /presupuestos/hoy/responder-bot`** (v122): body `tel`, `texto`. v127: con adjunto llega en JSON con `archivo` = `{nombre, mime, b64}` o `{fijo: "solicitud"|"autorizacion"}` (límite 15 MB en esta ruta). Manda la respuesta de Guille al vecino por el bot (`app.locals.botWhatsapp.responderVecino`); error si han pasado más de 24 h desde el último mensaje del vecino al bot. Desde v126 cuenta también lo escrito por vecinos con los que el bot no trabaja (`texto_fuera`) y acepta el teléfono con 9 cifras (lo pone con +34; así llega desde la ficha).
- **`POST /presupuestos/hoy-bot-llamado`** (v19.102: además `campo` = `az:INI` / `az:M1` / `az:M2` / `az:M4` / `az:C1` (C1 = M1 de la fase 08, v19.110) / `az:R` ("Ha respondido" visto, v126: guarda fecha **y hora**) con `comunidad` y `vivienda`, que escribe la clave con la fecha de hoy —o la quita con valor vacío— en `pisos` col AZ `aviso_manual`, creando la columna y su título si faltan): marca los checks de las tarjetas de la caja Avisos de HOY que salen de `bot_expedientes` (§6.16), cada una en su columna: M1 (`llamado`, col AA, guarda la fecha), M2 (`llamado2`, col AF, guarda la fecha), Pide ayuda (`revisado_ayuda`, col AE) y Sin WhatsApp visto (`sin_wa_visto`, col AK, v19.99). Aún acepta `revisado` (col AB) y `revisado_faltan` (col AD), que ya no manda ninguna pantalla y que hoy son columnas del bot (REABIERTA y la pausa «PREGUNTA», §6.10): §9.2, punto 7 del repaso. Si la pestaña no tiene todavía esas columnas, las añade. El M3 también pasa por aquí (`campo=aviso_m3`), pero se guarda en `pisos` col AY (§6.16).

## 3.14 Mantenimiento: cron, saneo de datos, IMAP manual
- **`GET /presupuestos/cron-status`** / **`POST /presupuestos/cron-run`**: estado y disparo manual del cron general (el mismo que corre solo por `setInterval`). Tiene un candado propio (`_cronEnMarcha`) y un margen mínimo de 2 minutos entre ejecuciones (`_CRON_THROTTLE_MS`) para no lanzar dos pasadas encimadas — este candado evita solapes dentro de una misma vida del proceso; lo de no repetir la ronda el mismo día al reiniciarse Render lo resuelve la marca «Hoy ya pasé» (abajo, v19.95).
- **`GET /admin/sanear-comunidades`**: utilidad de limpieza — repasa las columnas que deben forzarse a número nativo (`pto_total`, mano de obra, material, tiempos — la misma lista `COLS_NUM_IMPORTE`/`COLS_NUM_TIEMPO` de §3.3) y corrige las que se guardaron mal como texto. Admite `?dryrun=1` para ver qué cambiaría sin tocar nada.
- **`POST /presupuestos/admin/actualizar`**: actualiza el teléfono o email de un administrador **en todas las CCPPs donde aparece a la vez** — como un mismo administrador de fincas suele llevar varias comunidades, evita tener que editarlas una a una.
- **`GET /presupuestos/adjuntos-rotos`**: lista los enlaces de Drive que fallaron en el último envío o verificación periódica — alimenta un aviso en HOY.
- **Ventana 02 · Visita de HOY (v19.97, criterio de Guille)**: sale **entera** ("17 de 17"), con o sin reloj, igual que la 03 y las fases 05 a 08 (`_FASES_HOY_SIEMPRE`). Primero los marcados con reloj y después el resto. En la 02 el reloj ya no sirve para quitar de HOY.
- **Avisos de sistema en HOY (v19.96, criterio de Guille)**: si un automatismo deja de funcionar, sale arriba en la caja **🔔 Avisos** de HOY, en rojo y antes de los avisos de vecinos (y suma en el contador):
  - **Lectura del correo**: si no ha ido bien en las últimas 2 horas (con el servidor arrancado hace más de 40 minutos). Cuenta como fallo también que falten las cuentas o el `host_imap` en `mail_cuentas`. Dice desde cuándo y el último error.
  - **Ronda automática de correos (cron)**: si no se ha completado en las últimas 26 horas (servidor arrancado hace más de 15 minutos).
  - **Repaso automático del bot** (recordatorios por WhatsApp, `bot-whatsapp.cjs`, cada hora): si no ha terminado en las últimas 3 horas. El bot deja su estado en `app.locals.botWhatsapp.salud`.
  - **IA del bot (v141)**: si OpenAI ha fallado **3 o más veces seguidas** y la IA está encendida (`iaActiva`, interruptor de Plantillas del bot): «La IA del bot no responde: N fallos seguidos desde… · último error: …», con «(falta saldo en OpenAI)» si el error es `insufficient_quota` y «(la clave de OpenAI no vale)» si es `invalid_api_key`. La primera llamada que responde lo pone a cero. Con la IA dormida no sale. Lo apuntan las cuatro llamadas a OpenAI del bot (`_iaMarca`). Habría cazado el 25/08/2026 lo que se vio el 17/10 (§8).
  - **Presupuestos cerrados sin importes (v141)**: los de Plan 5 cerrados (`estado` = cerrado en G) en los que el bot no encuentra la foto con importes ni en I ni en G; los apunta `_cargarImportesP5`, que el repaso horario del bot refresca. Habría cazado el fallo de la v140 el primer día.
  - **Plantillas que faltan (v141)**: las de correo que el programa ha pedido (`leerPlantillaMail`) y no están en `mail_plantillas`, y los textos del bot que ha necesitado (`txtPlant` sin texto de respaldo) y no están o están vacíos en `bot_plantillas`. **Las desactivadas a propósito no avisan.** Sale en cuanto alguna pantalla o el bot la pide, y se quita sola al crearla. El 23/10/2026 avisa de `08_REC_M1_VECINO` (§8).
  - **Columnas fuera de su sitio (v142)**: a los 2 minutos de arrancar y cada 6 horas, `_comprobarColumnas` compara la fila 1 de `comunidades` con `COLS` y la de `pisos` con `_CABECERA_PISOS` (la cabecera del 23/10/2026, 52 columnas, A-AZ). Si alguien inserta, borra o mueve una columna, sale «¡Columnas fuera de su sitio en el Sheet!» con la primera columna descuadrada. Importa porque `comunidades` se lee por posición, `documentacion.cjs` lee `pisos` por posición y la plataforma de Alberto también. Dos columnas de `comunidades` se llaman distinto en el Sheet y en el código desde siempre y no avisan: Q (`fecha_solicitud_pto` / `fecha_contacto`) y R (`fecha_visita_pto` / `fecha_visita`). Al añadir una columna nueva al final, hay que añadirla también a `COLS` o a `_CABECERA_PISOS` en la misma entrega.
  - El estado se guarda en memoria (`_salud` y `app.locals.botWhatsapp.salud`): al reiniciar el servidor se empieza de cero, y por eso hay esos márgenes, para no avisar recién arrancado. Antes, estos fallos solo quedaban en el registro de Render. Casos del banco: §7.3.
- **"Hoy ya pasé" (v19.95, criterio de Guille)**: la ronda automática (al minuto de arrancar y cada 24 h) la lanza `_cronDiarioAuto`, que antes mira la fila **`cron_ultima_ronda`** de `bot_plantillas` (una marca del programa, como `mig_avisos_v1960`; no sale en ninguna pantalla) y, si ya pasó ese día (hora de España), no repite. Apunta la fecha solo al **terminar** la ronda; si se corta, al reiniciar se repite. El botón manual (`cron-run`) no mira la marca. Arregla que al reiniciar Render (al subir cambios) la ronda se repitiera el mismo día.
- **Piezas del cron y del histórico que no tienen ruta** (pasada §0.24, 02/10/2026):
  - **`calcularEstadoPlazo`**: decide, para cada expediente y plantilla, en qué punto del calendario de seguimiento está (cuántos envíos lleva, cuándo toca el siguiente, si ya pasó el tope). Lleva el **freno del ultimátum**: en fases 05 y 08, si ya se entró en el circuito de ultimátum (prórroga, disidentes o resuelto sellados), el seguimiento automático se para.
  - **`_indexarF1PorCcppFase`**: averigua la fecha del primer envío de cada expediente en cada fase, mirando `mails_enviados` y `mail_historico`, para que el calendario cuente desde ahí.
  - **`_reclasificarOInsertarHistorico`**: al asignar un correo a otro expediente, **mueve** su fila de `mail_historico` en vez de añadir otra (antes se duplicaba); si hubiera varias con el mismo `message_id`, deja una.
  - **`importarEmlsDeDrive`**: el trabajo de `imap-importar-drive` (lee los `.eml` de una carpeta de Drive, los pasa a `mails_pendientes` y los mueve a procesados).
- **`POST /presupuestos/imap-importar-drive`** / **`imap-run`**: disparo manual del mecanismo de lectura de correo entrante (§3.7) — importa `.eml` sueltos desde una carpeta de Drive, o fuerza una pasada de IMAP fuera de su cron normal.

## 3.15 Piezas comunes de las pantallas
Las piezas que salen en varias pantallas, explicadas una sola vez (regla 25). Cada pantalla remite aquí.

### 3.15.0 Ventana Cancelar / Enviar de los envíos por el bot (v126, criterio de Guille 18/10/2026: "UNIFICADOS todos los mensajes de ese tipo")
Todo envío que hace el bot al pulsar Guille pregunta antes con **la misma ventana**: título "Enviar por el bot", el texto (qué, a quién; en los avisos M, lo que falta y la fecha límite) y dos botones, **Cancelar** y **Enviar** (Esc o pulsar fuera = Cancelar). La usan: la presentación al pasar un piso a W y al cambiar el teléfono de un piso en W (§4.2.3.3), el contrato y la carta de pago de la 08 (botón W, §6.17) y los avisos M de HOY (robotito verde de la tarjeta, §3.16.3.1). **Con la conversación** (v126, criterio de Guille: "que además se vea la conversación"): en los avisos M, el contrato de la 08 y la presentación al cambiar el teléfono, la ventana enseña arriba la conversación de ese vecino con el bot (como el 🤖💬, con scroll y abierta en lo último); si no hay mensajes, no sale el recuadro (al pasar a W no lo hay). **Fuera del horario del bot** (v127, §3.22.3.4 bis) sale un tercer botón «⏰ Programar para…» y «Enviar» pasa a «Enviar ahora». Función `window.ptlConfirmarEnvio(texto, titulo, opciones)` (opciones `tel`, `preview`, `editable`, `libre`, `programable`, `noProg`; devuelve sí/no, o `{programar:true}` / `{texto, programar}` cuando hay texto editable o se puede programar), que `pageHtml` mete en todas las páginas (`_clienteConfirmarEnvio` de `presupuestos.cjs`). Las demás preguntas (pasar a M, borrar…) siguen con el Aceptar/Cancelar del navegador.

### 3.15.1 Cabecera común y botón HOY
**App en el móvil** (pasada §0.24, 02/10/2026): el programa se puede instalar en el móvil como una aplicación (icono en la pantalla de inicio, sin barra del navegador). Para eso sirven tres rutas sin pantalla: **`GET /manifest.webmanifest`** (nombre, colores e iconos de la app) y **`GET /araujo-icon-192.png`** / **`/araujo-icon-512.png`** (los iconos).

La pinta `pageHtml` en todas las pantallas del CRM y de documentación:
- **Buscador** 🔍: al escribir, a los 0,4 s **lleva al listado** (`/presupuestos?q=…`, §3.17); no filtra la pantalla en la que se está.
- **↶ Deshacer / ↷ Rehacer**: solo en la ficha (§3.19).
- **⚡ Ejecutar cron**: lanza a mano el cron de correos (`/presupuestos/cron-run`). Si la última pasada tuvo errores, sale como ⚠️ rojo y su texto dice cuántos.
- **🔄 Recargar**.
- **⏰ Botón HOY**: enlace a HOY (§3.16). No marca nada; no confundir con los botones reloj (§3.15.3).
- **☰ Menú**: enlaces al resto de pantallas. Dentro de una ficha añade "📋 PRESUPUESTO PLAN 5" y, desde la fase 05, "Imprimir documentos" (§3.19.1).

### 3.15.2 Pastillas
Las pinta `renderCabeceraComun` en el listado, en HOY y en la ficha. Fila 1: **Activos** · **En trámite** · **Tramitados** · **ZZ-RECHAZADO** · **ZZ-DESCARTADO**. Fila 2: **+ Nuevo** y una por fase, de **01-CONTACTO** a **08-CYCP**. Cada una con su número, contado sobre todo el Sheet. Llevan al listado con ese filtro, conservando la búsqueda (qué entra en cada una y el aviso ⚠ "No cuadra" de Activos: §3.17.3). Solo en el listado sale resaltada la del filtro aplicado.

### 3.15.3 Botones reloj
**Botón reloj** ⏰ (nombre fijo, criterio de Guille, 02/10/2026): marca algo para que salga en HOY. Encendido, color normal; apagado, gris (`ptl-btn-reloj` / `ptl-btn-reloj-off`). Títulos "Añadir a HOY" / "Quitar de HOY". Hay **6 botones reloj sobre 3 datos**:

| Qué marca | Dónde está | Dato |
|---|---|---|
| Expediente | Caja Notas de la ficha (fases 01-04 y ZZ, §3.19) · fila de la comunidad en Datos documentación (§4.2) · fila del expediente en HOY | `comunidades.en_hoy` (col BF) |
| Piso | Fila del piso en Datos documentación (§4.2) · fila del piso en HOY | `pisos.en_hoy` |
| Correo | Cajita Comunicaciones de la ficha (solo entrantes, §3.19) · fila del correo en Mails pendientes | fila en `mails_pendientes` |

Reglas:
- Un expediente marcado sale en HOY en su grupo, con su botón reloj para quitarlo. Uno sin marcar solo sale si su grupo lo mete solo (tabla de §3.16.3.3).
- **Excepción**: en 02, 03 (desde v19.97 y v19.99), 05, 06, 07, 08 y 09 el botón reloj del expediente no decide nada: salen todos (`_FASES_HOY_SIEMPRE`; los grupos de 09 aparte). Apagarlo guarda el dato igual, y vuelve a mandar si el expediente pasa a una fase donde sí cuenta.
- Los pisos marcados salen debajo de su comunidad aunque la comunidad no esté marcada; marcar un piso enciende también el botón reloj de su comunidad. Al quitar una comunidad con pisos marcados, avisa antes y no apaga los pisos.
- Desde HOY, quitar con el botón reloj recarga la página.

**No confundir con**: el **botón HOY** de la cabecera (mismo icono ⏰, solo abre esta pantalla) ni con la **fecha de arranque de la fase 05** (primer WhatsApp del bot a la comunidad, §6.13), que antes este manual llamaba también "reloj".

### 3.15.4 Catálogo de badges
Un badge es la etiqueta de color que resume el estado de algo. Todos usan la clase `ptl-fila-badge` y uno de sus colores: `en-plazo` y `success` (verde), `decidir` (ámbar), `danger` (rojo), `ejecucion` (azul claro), `neutro` (gris). Este catálogo es la referencia única: el resto del manual remite aquí.

| Badge | Textos | Colores | Cuándo | Función | Dónde sale |
|---|---|---|---|---|---|
| **Plazo de reenvíos** (01) | 👍 En plazo · ⚠️ Decidir · 👎 Retrasado | verde · ámbar · rojo | Según el cron de reenvíos de la fase (abajo) | `renderBadgePlazo` | HOY (columna derecha) · ficha del expediente |
| **Presupuesto enviado** (04) | "👍 Presupuesto enviado hace N d - 1er Cron 1+1/4 (dd/mm)" · "… - 2º Cron 1/4 (dd/mm)" · reactivado con el ciclo agotado "… - 2º Cron 0/4 (dd/mm)" · "⚠️ … - Reactivar Cron" (sin datos del ciclo, "Cron activo" / "Cron reactivado") | verde · verde · verde · ámbar | Según el cron de reenvíos (abajo) | `renderBadgePlazo` | HOY (ocupa las dos columnas) · ficha |
| **Ultimátum** (05, 08) | El paso del calendario: plazo, "¿Conceder prórroga?", recordatorio, disidentes, resolver, "📛 Contrato resuelto · pago dd/mm" (rojo claro; fecha tope de la compensación = envío de la resolución + 15 días, v19.109) y, desde el día siguiente, "📛 Pago vencido dd/mm · reclamar" (rojo fuerte, `ptl-ubtn-rojo`; se quita al pasar a ZZ-DESCARTADO)… | según el paso | Calendario de la fase (§3.9) | `_badgeUltimatumHoy` | HOY (columna izquierda) · ficha |
| **Faltan X de Y** (solo 05 y 08) | "Faltan X de Y" · "✓ Completo" · "sin pisos" | rojo · verde · gris | Documentos marcados de la comunidad y sus pisos | `_contarFaltanBot` en HOY y en la ficha (cuenta también lo del bot); la caja de documentación lo recalcula en el navegador (`refrescarContadores`, §4.2) | HOY (columna derecha) · ficha de documentación |
| **Esperando EMASESA** (06) | "Documentación enviada el dd/mm/aaaa - hace N d" | verde | Desde `fecha_documentacion_completa` | Dentro de HOY | Solo HOY (dos columnas) |
| **Esperando CyCP** (07) | "Visita técnico el dd/mm/aaaa - hace N d" | verde | Desde `fecha_visita_emasesa` | Dentro de HOY | Solo HOY (dos columnas) |
| **Estado de fase 09** | 🔨 En ejecución · ⏳ Factura pte · 💶 Facturado | azul claro · ámbar · verde | §3.5 | `badgeEstado09` (una sola, v19.92) | Ficha ("💶 Facturado el dd/mm/aaaa") · listado de fases ("💶 Facturado", fecha al pasar el ratón). **En HOY no sale**: el grupo ya dice el estado (el código lo calcula pero las filas de 09 pintan hitos e importes en su lugar) |
| **Avisos a vecinos** | Inicio pendiente · Recordatorio-M1/M2 (05) y M1/M3 (08) pendiente · Pide ayuda · Ha respondido · Sin WhatsApp · Completo · revisar (05 y 08) | rojo · rojo · rojo · rojo · rojo · ámbar | §3.16.3.1 | `renderAviso`, dentro de HOY | Solo caja Avisos |

**Cómo se colocan en la fila de HOY** (dos columnas alineadas a la derecha): los badges largos (04, 06, 07) ocupan las dos; en 05 y 08, el ultimátum va a la izquierda y "Faltan X de Y" a la derecha; en 01, el de plazo va a la derecha. Un solo badge de estado por fila.

**Reglas del badge de plazo de reenvíos** (`calcularDisparador`, para las fases con reenvíos automáticos: 01, 04, 05 y 08; en 05 y 08 manda el ultimátum y este queda de reserva): calcula cuándo vence el plazo según la cadencia de la fase (`PTO_FASES[fase].cadenciaDias`; en 04 la primera espera usa `cadenciaInicialDias`, más corta). Sin reenvíos todavía → sin badge; reenvíos agotados → Decidir; dentro de plazo → En plazo; vencido con fecha de reenvío manual pactada → Retrasado; vencido sin nada pactado → Decidir.

**Badge de fase 04** (`renderBadgePlazo`): dice cuánto lleva enviado el presupuesto y qué hace el cron. Verde mientras al cron le quedan reenvíos o hay fecha de próximo mail manual pactada; **desde v19.96 dice el ciclo** ("1er Cron 1+1/4", "2º Cron 1/4"; reactivado a mano con el ciclo agotado, "2º Cron 0/4"), y solo si no hay datos del ciclo dice "Cron activo" / "Cron reactivado"; ámbar "Reactivar Cron" cuando agotó su ciclo y no hay fecha. **El "(dd/mm)"** (v19.87, criterio de Guille) es el día del siguiente envío del cron: el próximo reenvío automático o la fecha pactada; sale del mismo cálculo que el "📧 x+y/z - próximo reenvío" de la ficha (`calcularInfoEnvioAuto`, `fechaProxIso`); al pasar el ratón, con año. El ámbar no lleva fecha.

## 3.16 Pantalla HOY
La pantalla de trabajo diario: reúne en una sola página lo que hay que atender hoy. Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 3.16.1 Cómo se llega
Ruta `GET /presupuestos/hoy` (`presupuestos.cjs`). Como pantalla no lleva parámetros; con `?soloAvisosM=1` no pinta nada y devuelve en JSON los avisos M, correos y WhatsApp pendientes de una comunidad, que usa la ficha (§3.16.3.1). Se abre con el **botón HOY** de la cabecera (§3.15.1), desde cualquier pantalla. Todo se lee del Sheet al abrirla; no guarda nada entre visitas.

### 3.16.2 Mapa de la pantalla, de arriba abajo
1. **Cabecera común** (§3.15.1). En HOY no lleva deshacer/rehacer.
2. **Pastillas** (§3.15.2). En HOY ninguna sale resaltada.
3. **🔔 Avisos (N)** (§3.16.3.1).
4. **📥 Mails pendientes (N)** (§3.16.3.2).
5. **📋 Expedientes HOY (N)** (§3.16.3.3).
6. **💶 Datos económicos** (§3.16.3.4).

### 3.16.3 Las cajas, una a una

#### 3.16.3.1 Caja 🔔 Avisos
- **Qué es**: los puntos en los que Guille tiene que intervenir con un vecino concreto; una tarjeta por vecino y aviso. Qué dice cada aviso y sus días: §6.16; calendario completo: §3.9.
- **Cuándo sale**: siempre; vacía si no hay avisos.
- **Cómo se arma**: lee `bot_expedientes` (A:AK desde v19.99), `pisos`, `comunidades` y los días y textos de `bot_plantillas` (`t_wa_m1`…`t_wa_m3` y `t_wa_m1c`, `msg_wa_m1`…`msg_wa_m5` y `msg_wa_m1c`) y de las plantillas de prórroga.
- **Qué entra**:
  - **Cadena de avisos (v19.102, §6.16)**: **Inicio pendiente**, **Recordatorio-M1/M2** (05) y **Recordatorio-M1/M3** (08; el M1 de la 08 desde v19.110) a todo vecino con algo pendiente, por su camino (💬 bot, 📧, 💬 manual o solo check), con "(amable)" / "(duro)". Además, de `bot_expedientes`: **Completo · revisar**, **Pide ayuda** y **Sin WhatsApp** (como antes).
  - **Ha respondido (v126, criterio de Guille 18/10/2026: "como el aviso de WhatsApp de mensaje nuevo")**: un vecino de un piso con el que el bot **no** trabaja (en M, o su comunidad fuera de la 05) ha escrito al número del bot —lo normal, contestando a un aviso M que salió por el bot—. El bot no le contesta pero lo guarda (§6.1). Sale "dd/mm/aa · Ha respondido (lo que ha escrito)" con todo lo escrito desde la última vez que se marcó (los archivos como "📎 archivo": no se guardan, hay que pedírselos por otra vía), el 🤖💬 (verde < 24 h para contestar por el bot; rojo, solo leer) y check **"Marcar como visto"** (pisos col AZ `R=<fecha y hora>`); si vuelve a escribir, vuelve a salir. Contestar por el 🤖💬 lo marca solo. Un aviso por teléfono.
  - **Completo · revisar (fase 08)** (v19.107, criterio de Guille 12/10/2026: "siempre que haya algo completo por revisar, en cualquiera de las dos fases, tiene que salir el aviso"): piso de una comunidad en 08, no disidente, con el contrato en REV u OK, el pago que no esté en F (o comunidad FFCC) y algo en REV. Dice qué hay que revisar ("contrato", "pago" o "contrato y pago"). **Sin check**: se va al pasar las pastillas de REV a OK. Sale de `pisos` (AR/AS), no de `bot_expedientes`.


- **Orden**: por fecha, la más antigua arriba (envío de la presentación, fecha del paso o envío de contratos); **Completo · revisar (fase 08)** no tiene fecha y va siempre al final. **Pide ayuda y Ha respondido** se fechan y se ordenan por el **último mensaje del vecino al bot** (v127, criterio de Guille 19/10/2026: "veo números en los círculos más altos arriba que abajo"): es el mismo que da las horas del circulito, así que arriba queda siempre lo que antes se pasa de las 24 h ("!" primero, luego de menos a más horas). Antes el Pide ayuda usaba la fecha de cuando pidió ayuda y, si el vecino volvía a escribir, salía arriba con muchas horas (Ardilla 9 2-30). (Solo se cambia a la del último mensaje si es posterior a la de la petición.)
- **Cada tarjeta**, de izquierda a derecha (comprobado en el repaso del 23/10/2026): dirección de la comunidad (160 px, enlace a la ficha de documentación, abierta en ese piso) · **check** de hecho (las que no llevan check, un hueco) · piso · nombre · teléfono · notas del piso (editables) · badges del aviso (mitad derecha) · columna de botones (64 px): **💬 WhatsApp** (abre WhatsApp Web con el chat del vecino y el texto del aviso ya escrito, desde el número de Guille) o 📧, y el 🤖💬. Las tarjetas **Sin WhatsApp** llevan además el botón **Pasar a M** junto al badge (v19.99; el check, en cambio, lo deja en W como visto). **Desde v123 (criterio de Guille, 17/10/2026)** el aviso ocupa siempre la **mitad derecha** de la línea, todos alineados y en **un solo renglón** (cortado con "…"); al pasar el ratón se ve entero. Los botones 💬 y 🤖💬 van en una columna fija al final.
- **Robotito verde 🤖💬 de los avisos M (v126, criterio de Guille 18/10/2026)**: las tarjetas Recordatorio-M1/M2 (05) y M1/M3 (08) de todo vecino **con móvil** (en W o en M, tenga o no email) llevan el **mismo robotito**, **en lugar del 💬 blanco o del 📧**; sin móvil, siguen por correo. Sale **siempre en verde** mientras el aviso esté pendiente, porque el color dice si se le puede escribir por WhatsApp y el M sí se puede (va con plantilla, aunque hayan pasado las 24 h); y **siempre con circulito azul**, porque te toca a ti (enviarle el M); el circulito significa en todas partes "te toca a ti": contestarle o enviarle el aviso. Al pulsarlo sale la ventana **Cancelar / Enviar** con su conversación (a quién, lo que falta y la fecha límite); con **Enviar** lo manda **por el bot** con su plantilla de Twilio (§6.16), se marca su check y la tarjeta se va. Marcando solo el check no se envía nada y la tarjeta se va (ya avisado por otra vía). **La ventana enseña el mensaje exacto** que va a salir (el texto de la plantilla en Twilio con sus datos ya puestos, ruta `GET /presupuestos/hoy/aviso-texto`): fuera de las 24 h, solo lectura (las plantillas no se pueden cambiar; se cambian en Twilio); **dentro de las 24 h**, se puede editar y, si se cambia, sale como mensaje normal (`responder-bot`) en vez de la plantilla. **También en la ficha** (Datos documentación): el robotito del vecino con un M pendiente sale verde con punto y lo envía igual (pide los avisos M a HOY con `GET /presupuestos/hoy?soloAvisosM=1`); al enviarlo se marca como en HOY (`hoy-bot-llamado` con su campo) y el robotito vuelve a su color de siempre (gris si nunca ha escrito). Queda en la conversación del vecino **con su título** ("Recordatorio M1 por el bot (plantilla …)") **y el texto entero** que se le envió (criterio de Guille: "saber lo que se le envió exactamente"): `aviso-bot` lee el texto de la plantilla en Twilio, le pone los datos y lo guarda con el envío (`bot_contactos`, col E); los M enviados el 18/10 antes de este cambio, que solo guardaban "falta … ; fecha límite …", se completaron **una sola vez** al arrancar con la plantilla y los datos del vecino y quedaron guardados así (`_migAvisosMV126`, marca `mig_avisos_m_v126`), para que no cambien aunque la plantilla cambie. Los de correo siguen con su 📧. **Móvil sin WhatsApp (v127, criterio de Guille 19/10/2026)**: si Twilio marcó ese teléfono como **sin WhatsApp** (`bot_expedientes` col AJ de la ficha de ese mismo teléfono), cuenta como **sin móvil**: con correo, el aviso sale con el 📧 y va por correo en el mismo hilo; sin correo, «sin móvil ni correo: llamar». Si se cambia el teléfono del piso, la ficha del bot es otra y vuelve a probarse. Caso que lo motivó: Ardilla 9 2-24, que salía con el robotito y el mensaje no le habría llegado.
- **Regla única del circulito azul (v127, criterio de Guille 19/10/2026: "unifica esta filosofía en todo el programa")**: en HOY y en la ficha, **el circulito azul va en el botón con el que se resuelve lo que te toca hacer con ese vecino**, sea cual sea el canal; el **color** del robotito sigue diciendo solo si se le puede hablar por el bot. Dónde sale: **🤖💬 de contestar** (Pide ayuda / Ha respondido sin marcar; con horas, "<1" o "!"); **🤖💬 verde de un aviso M** por el bot; **📧** de un aviso por correo (inicio o M), en HOY y en el sobre del vecino en la ficha; **💬 blanco** cuando el aviso de la cadena (inicio o M) va por WhatsApp manual, en HOY y en la ficha. En la ficha: el 📧 con punto abre ya escrito ese correo (`data-recfase` → `__ptlMailVecino`) y al enviarlo la ficha se recarga sin punto; el 💬 con punto abre el chat con el mensaje y pregunta "¿Le has enviado el WhatsApp?" para marcarlo como el check de HOY (`hoy-bot-llamado`, mismo campo). Datos: `GET /presupuestos/hoy?soloAvisosM=1` devuelve `avisos` (bot), `mails` y `was`. Al añadir un botón nuevo que mande algo a un vecino, debe seguir esta regla. **Sin robotito cuando el bot no puede hablarle (v127, criterio de Guille: "al llevar el sobre, el robotito gris le sobraría")**: en la ficha no sale el 🤖💬 si el teléfono es **fijo** (no empieza por 6 o 7) o Twilio lo marcó **sin WhatsApp**, y el vecino nunca ha escrito al bot; queda solo el 📧 o el 💬 (casos: Ardilla 9 0-4, fijo del Ayuntamiento, y 2-24, sin WhatsApp).
- **Colores del 🤖💬 (v126, criterio de Guille 18/10/2026)**: depende solo de lo que **el vecino** ha mandado al bot. **El color dice si se le puede hablar por el bot**: **verde**, escribió hace menos de 24 h (se le puede contestar con texto libre); **rojo**, más de 24 h (solo leer); **gris** (solo en la ficha), nunca ha escrito al bot. **Un circulito azul en la esquina** (v126 bis, 19/10/2026: más grande y con número: las **horas que quedan** para contestar por el bot, "<1" si queda menos de una hora y "!" si ya se pasó; en los avisos M, sin número) (criterio de Guille, como el numerito de mensajes sin leer de WhatsApp) dice que **le espera una respuesta tuya** (un Pide ayuda o un Ha respondido sin marcar): en verde, contéstale que estás a tiempo; en rojo, se pasó el plazo, contéstale por otra vía y marca el check. Los documentos y las respuestas al flujo ("1", "No"…) no ponen circulito: los contesta el bot. (Primero se probó un quinto color, azul, y se cambió por el circulito para no tener tantos colores.) En los avisos M el robotito sale en verde mientras el aviso esté pendiente: el M se puede enviar siempre (va con plantilla). **Contestar por el robotito** (en HOY o en la ficha) lo da por contestado: marca su Pide ayuda (col AE = 1) y su Ha respondido (pisos col AZ `R=` ahora) (`_marcarContestado`, ruta `responder-bot`).
- **Fuera del horario de comunicaciones (v127)**: al enviar algo por el bot (robotito de aviso M o de contestar) o abrir un 💬 blanco fuera del horario, el programa avisa y deja programarlo o enviarlo ahora (§3.22.3.4 bis).
- **📨 Pedir contacto (v128, criterio de Guille 21/10/2026: "un mensaje para cuando queremos ponernos en contacto con un vecino")**: en la ventana del robotito **rojo o gris** (no hay 24 h para escribirle), botón **📨 Pedir contacto**: manda por el bot la plantilla de Twilio **plan5_contacto** (Utility; {{1}} nombre de la Nota simple o el de arriba, {{2}} vivienda «C Malvaloca 1 (1D)»; código HX en Flujo bot → «Twilio - Pedir contacto (robotito)»), con la ventana de confirmación y el horario de siempre. Texto aprobado por Guille: «Hola {{1}}, somos Instalaciones Araujo. / Estamos gestionando en su comunidad el Plan 5 de EMASESA para la individualización de contadores de agua de su vivienda {{2}}. / Necesitamos hablar con usted sobre la documentación de su vivienda. / Responda *HOLA* a este mensaje y le escribiremos lo antes posible.» (HOLA porque «sí» y «ok» los entiende el bot como respuesta). **Lo primero que escriba el vecino después no lo contesta ni lo interpreta el bot** (`_contactoPendiente`, hasta 7 días): se guarda (abre las 24 h, el robotito pasa a verde) y llega a Guille como **Pide ayuda** en HOY; lo siguiente ya va al bot como siempre. Los pisos en M o fuera de la 05 ya iban siempre a Guille («Ha respondido»). En la conversación queda «Pedir contacto (plantilla plan5_contacto)» con el texto. Ruta `POST /presupuestos/hoy/pedir-contacto` → `pedirContacto` del bot. Sin el código HX avisa «falta el código Twilio de la plantilla plan5_contacto (Flujo bot) o está desactivada».
- **Botón 🤖💬 contestar por el bot (v122, criterio de Guille 17/10/2026)**: en las tarjetas **Pide ayuda**, **Ha respondido** (v126) y **Completo · revisar** de la fase 05 (la de la 08 no lo lleva), a la derecha del 💬 blanco. **Verde** si el vecino escribió al bot (texto o documento) hace menos de 24 h: abre un recuadro, se escribe la respuesta y **Enviar** la manda **desde el número del bot** (no desde el WhatsApp de la empresa, que WhatsApp capa si se escribe a muchos); en Pide ayuda y en Ha respondido marca además el check y la tarjeta se va. **Rojo** si han pasado más de 24 h (WhatsApp solo deja contestar con texto libre dentro de ese plazo): al pulsarlo abre la conversación en solo lectura, con el motivo en rojo y el botón **📨 Pedir contacto** (arriba); para escribirle con texto libre, el 💬 blanco. Las horas salen al pasar el ratón. Ruta `POST /presupuestos/hoy/responder-bot` → `responderVecino` del bot, que vuelve a comprobar las 24 h y apunta la respuesta en `bot_contactos` (tipo `equipo`). Si el vecino contesta, vuelve a escribir al bot y sale otra vez en Avisos. **Con archivo (v127, criterio de Guille 19/10/2026)**: debajo del texto, **📎 Adjuntar** (un PDF, JPG o PNG del PC, hasta 10 MB), el atajo **toma datos** (el PDF que ya manda el bot) y **📄 documento** (v128: abre el menú de Imprimir documentos con el piso ya elegido; se rellena, se puede ver con 👁 Ver y se adjunta el PDF ya relleno con el nombre del documento, §3.23.2; sustituye al atajo «autorizacion usufructo», que mandaba el PDF de EMASESA en blanco, y que el bot sigue mandando él solo en el flujo de familiar); uno por envío, se ve en una pastilla con ✕ para quitarlo. El texto va con el archivo (puede ir sin texto). Solo dentro de las 24 h, como el texto. El archivo del PC se guarda 2 h en la memoria del servidor (`/media-tmp/<id>/<nombre>`, enlace secreto) para que Twilio lo descargue; los fijos salen de `/media/solicitud/toma datos.pdf` y `/media/autorizacion/autorizacion usufructo.pdf`. En la conversación queda "📎 nombre del archivo" y el texto.
- **Conversación con el vecino (v125, criterio de Guille 18/10/2026)**: al pulsar el 🤖💬 (verde **o rojo**) o el **texto del aviso** de esas tarjetas se abre un recuadro con la conversación por el bot: **todos** los mensajes, como un chat, con scroll y abierta por el final (lo último) (vecino a la izquierda; bot y "Tú (desde el programa)" a la derecha), con fecha y hora; los documentos salen como "📎 Dni propietario delante"; **desde v126 es un espejo** de lo que vio el vecino: los mensajes normales del bot salen enteros y los enviados con plantilla salen con su título («📋 … ▸»), que al pincharlo enseña el texto exacto. **Lo programado** (v127/v128) sale como una sola burbuja: mientras espera, el texto con «⏰ Programado para …» arriba; al salir desaparece y queda el envío normal; si se anula, desaparece; si falla, «⚠️ No se pudo enviar: motivo». En verde, debajo está el recuadro para contestar; en rojo solo se lee (para contestar con el 💬 blanco sabiendo de qué iba). No sale lo hablado por el WhatsApp de la empresa ni por teléfono (el programa no lo ve: apuntarlo en las notas del piso). Ruta `GET /presupuestos/hoy/conversacion?tel=`: lee `bot_contactos`, `bot_documentos`, `bot_expedientes` (col J, la primera presentación) y `bot_programados`, y devuelve también la hora del último mensaje del vecino (`ultVecino`).
- **Dónde se guarda y a dónde va**: el check guarda en `bot_expedientes` (M1 col AA y M2 col AF con la fecha; Pide ayuda col AE; Sin WhatsApp col AK; "Completo · revisar" ya no lleva check desde v19.111: se va al dejar el piso en OK, y la col AB queda sin uso) por la ruta `hoy-bot-llamado` (§3.13), o el M3 en `pisos` col AY, o (v19.102) las marcas de la cadena de los vecinos sin ficha del bot en `pisos` col **AZ `aviso_manual`** (`INI`, `M1`, `M2`, `M4` y `C1` —el M1 de la 08, v19.110— con su fecha; `R` —Ha respondido visto, v126— con fecha y hora); la tarjeta desaparece. Abrir el 💬 de una tarjeta "Inicio pendiente" también lo apunta (col AZ). Esas fechas deciden si después toca el aviso duro (§3.9). Las notas del piso van a `pisos.notas_piso`, las mismas de la ficha de documentación (§4.2).

#### 3.16.3.2 Caja 📥 Mails pendientes
- **Qué es**: los correos que hay que clasificar o tener a la vista.
- **Cuándo sale**: siempre; "— Sin mails pendientes —" si no hay.
- **Cómo se arma**: lee la pestaña `mails_pendientes` (`leerMailsPendientes`), que llena la lectura de correo (§3.7).
- **Qué entra**: los correos con `estado` pendiente (llegados, sin asignar) y los clasificados que se quieren tener en HOY (marcados con el botón reloj desde la cajita Comunicaciones de la ficha). Nunca los descartados.
- **Orden**: por fecha de recepción, el más antiguo arriba.
- **Botones de la caja**: **📥 Leer correo ahora** (lectura IMAP a mano) y **📂 Importar correo de Drive** (importa `.eml` sueltos de una carpeta de Drive), §3.14.
- **Cada fila**, de izquierda a derecha: fecha y hora · flecha (▲ azul saliente, ▼ roja entrante) · asunto (al pinchar despliega remitente, asunto, mensaje y adjuntos) · **desplegable de expediente** (verde "✓ dirección" si está asignado; amarillo "— elegir expediente —" si no; abajo, los rechazados y descartados, para asignarles un correo sin reactivarlos) · Responder · Reenviar · **botón reloj** · borrar.
- **Dónde se guarda y a dónde va**: asignar cuelga el correo del historial del expediente, que es lo que muestra la cajita Comunicaciones de su ficha (`mail-clasificar`); el botón reloj borra la fila de `mails_pendientes` sin tocar sus adjuntos, que siguen enlazados desde el historial (`mail-toggle-hoy`); borrar elimina el correo y sus adjuntos de Drive (`mail-descartar`).

#### 3.16.3.3 Caja 📋 Expedientes HOY
- **Qué es**: los expedientes en seguimiento, agrupados por fase. El número del título es el total de filas de todos los grupos.
- **Cuándo sale**: siempre; "— Sin expedientes marcados —" si no hay.
- **Cómo se arma**: lee `comunidades` (fase, `en_hoy`, notas, fechas, importes, hitos), `pisos` (pisos marcados y su documentación), `bot_expedientes` (fecha de arranque de la fase 05) y las plantillas de las fases con reenvío y de los ultimátums (para los badges). Grupos en el orden de `_ORDEN_FASES_HOY`; un grupo solo sale si tiene alguna fila.
- **Qué entra y en qué orden**:

| Grupo | Qué expedientes entran | Orden dentro del grupo |
|---|---|---|
| 01 · Contacto | Los marcados con el botón reloj y, además, los que tienen el badge ⚠️ Decidir | Primero los marcados, por dirección; luego los de Decidir, en el orden del Sheet |
| 02 · Visita | **Todos** los de la fase, siempre (v19.97, criterio de Guille) | Primero los marcados, luego el resto en el orden del Sheet |
| 03 · Envío PTO | **Todos** los de la fase, siempre (v19.99, criterio de Guille 07/10/2026; antes solo los marcados con reloj) | Primero los marcados, luego el resto en el orden del Sheet |
| 04 · Aceptación PTO | Los marcados y los que tienen badge ámbar (⚠️ "Reactivar Cron") | Por días desde el envío del presupuesto, de más a menos; sin días, al final; a igualdad, por dirección |
| 05 · Documentación | **Todos** los de la fase, siempre | **Por el paso de la línea de tiempo de la fase (ventana Tiempos, §3.10), el más avanzado arriba** (v19.101, criterio de Guille 08/10/2026), en este orden: 1 ✓ Todo entregado · 2 📛 Contrato resuelto · 3 ⚠️ Resolver el contrato · 4 📛 Disidentes · resolver el dd/mm · 5 ⚠️ Solicitar disidentes · 6 ⚠️ Recordar prórroga · 7 📨 Prórroga concedida · 8 ⏭ Sin prórroga · 9 ⚠️ ¿Conceder prórroga? · 10 👍 Doc solicitada · 11 ⚠️ Listado sin recibir · 12 👍 Listado solicitado · 13 Pendiente de iniciar. El paso se saca del mismo badge que pinta la fila (`_badgeUltimatumHoy`). A igual paso, el que más días lleva: fecha del primer WhatsApp del bot o, si aún no hay, fecha de aceptación (la más antigua arriba; sin fecha, al final); luego por dirección. Antes de la v19.101: solo por fecha de aceptación |
| 06 · Visita EMASESA | **Todos**, siempre | Por fecha de documentación enviada, la más antigua arriba; igual con los que no tienen fecha |
| 07 · Pte CYCP | **Todos**, siempre | Por fecha de visita del técnico, la más antigua arriba; igual con los que no tienen fecha |
| 08 · CYCP | **Todos**, siempre, salvo los que ya tienen el CyCP completo | **Igual que la 05, por el paso de la línea de tiempo, el más avanzado arriba** (v19.101, criterio de Guille 08/10/2026): 1 ✓ Todo entregado · 2 📛 Contrato resuelto · 3 ⚠️ Resolver el contrato · 4 📛 Disidentes · resolver el dd/mm · 5 ⚠️ Solicitar disidentes · 6 ⚠️ Recordar prórroga · 7 📨 Prórroga concedida · 8 ⏭ Sin prórroga · 9 ⚠️ ¿Conceder prórroga? · 10 👍 CyCP solicitados · 11 Pendiente de iniciar (en 08 no hay pasos de listado). A igual paso, por fecha de envío de contratos y cartas de pago, la más antigua arriba; luego por dirección. Antes de la v19.101: solo por esa fecha. Probado en el banco con un expediente en cada paso |
| En ejecución | Todas las obras de fase 09 sin Factura pte ni Fecha factura | Más hitos marcados arriba; a igualdad, la que entró antes en ejecución (cierre de fase 08); luego por dirección |
| Factura pte | Obras de 09 con el check Factura pte y sin Fecha factura | Por dirección |
| Total facturado | Obras de 09 con Fecha factura | Por Fecha factura, la más antigua arriba; a igualdad, por dirección |
| ZZ · Rechazado / ZZ · Descartado | Solo los marcados con el botón reloj | Por dirección |
| Otros | Marcados de una fase desconocida (no debería pasar) | Por dirección |

  En 02, 03, 05, 06, 07, 08 y los grupos de 09 el botón reloj no decide nada: salen todos igualmente (§3.15.3). Los grupos de 04 a 08 se leen igual: "el que más espera, arriba".
- **Cabecera de cada grupo**: fondo azul oscuro y texto azul claro, con el nombre y "(X de Y)": X filas en HOY de esa fase, Y expedientes que tiene la fase (el mismo número de su pastilla); el recuento sale **en rojo** cuando X ≠ Y. En 05 y 08, a la derecha, el enlace **Tiempos** a la ventana de tiempos de esa fase (§3.10). Los tres grupos de 09 cuentan solo "(N)", llevan la flecha ▾/▸ para plegar sus obras (abren desplegados; los totales se ven siempre) y títulos de columna (ver Grupos de fase 09, más abajo).
- **Fila de cada expediente**, de izquierda a derecha:
   1. En 05 y 08, el **switch W/M** (gestión por bot o manual), solo informativo.
   2. **Dirección**, enlace a la ficha.
   3. Un **check**: en 01-08 y ZZ es **"revisado hoy"** (col BG `visto_hoy`): Guille lo marca al repasar el expediente y lo desmarca a mano; no se limpia solo. En En ejecución y Factura pte es el check **Factura pte** (§3.5), que mueve la obra de grupo. En Total facturado no hay check.
   4. Solo en 02, 04, 05 y 08, la **fecha recordatorio** (más abajo).
   5. **Notas** del expediente (`notas_pto`), editables; se guardan al salir de la casilla (al guardar, el recuadro se pone verde).
   6. A la derecha, en dos columnas fijas (175 px y 125 px), los **badges** (§3.15.4). En 09, en su lugar, los hitos y los importes.
   7. El **botón reloj**, solo si el expediente está marcado.
- **Debajo de cada expediente, sus pisos marcados** con el botón reloj de piso (`pisos.en_hoy`), estén o no marcados la comunidad. Cada fila de piso: piso (enlace a la ficha de documentación, abierta en ese piso) · nombre · teléfono · documentos "N/M" · notas del piso (editables) · botón reloj. Las filas de piso van en blanco, bajo la cabecera gris de su expediente.
- **Diseño**: la columna de la dirección es `calc(25% - 40.5px)` en todos los grupos (criterio de Guille: 30 px más estrecha que el reparto original, para dar sitio a las notas). No afecta a las tarjetas de Avisos ni a las filas de piso.
- **Check "revisado hoy"** (col BG `visto_hoy`): solo en las filas de expediente de 01-08 y ZZ. Es una marca de trabajo del día: no cambia nada más y no se borra sola (criterio de Guille: se desmarcan a mano, son pocos). Se guarda al instante sin recargar.
- **Fecha recordatorio** (v19.83-19.87, criterio de Guille): cajita delante de las notas, **solo en 02, 04, 05 y 08**. Es solo un recordatorio visual: no cambia correos, avisos ni el orden, y no sale en la ficha. Se ve solo "dd/mm" (el año se guarda y sale al pasar el ratón): es una cajita con el texto y, encima, una casilla de fecha invisible; al pinchar se abre su calendario (`showPicker`), que trae "Borrar". Ancho fijo de 52 px. Vacía: "dd/mm" en el gris claro y cursiva de los textos de ejemplo, como "(sin notas)"; con fecha futura, normal; **desde ese día** (hora de España) y mientras no se borre, amarillo del badge Decidir en negrita. Se guarda al elegirla o borrarla, en la columna **AO `fecha_recordatorio`** de `comunidades` (ruta `/presupuestos/expediente/campo`, solo esa casilla). La AO era `fecha_contratos_pagos_completa`, legacy de la antigua fase 07_CONTRATOS_PAGOS, vacía y sin uso; el título de la columna del Sheet ya está cambiado. Probada en navegador.
- **Grupos de fase 09 (En ejecución, Factura pte, Total facturado)**: columnas de importes de 70 px con 2 px de separación y títulos abreviados.
  - **En ejecución**: antes de los importes, el check **Factura pte** (§3.5; su título va centrado encima, en la cabecera) y 5 checks de **hitos de la obra** de 40 px: FINANC. · INICIO · FIN · ARMARIO · DOC. Importes: PTO. TOTAL, Bº PTO, 20% Bº PTO. Pie: 🔨 Total en ejecución. Cada hito guarda la fecha del día (hora de España) en la columna **BO `hitos_obra`**, como JSON `{"financ":"AAAA-MM-DD",…}`; al desmarcarlo se borra; al pasar el ratón dice "marcado el dd/mm/aaaa". Un hito no cambia la obra de grupo, pero **FIN** la da por terminada en "Por delante" (§3.16.3.4). Ruta: `POST /presupuestos/expediente/hito`. La obra se recoloca al marcar o desmarcar, sin recargar.
  - **Factura pte** (pseudo-clave `09_PTE_COBRO`): importes PTO. TOTAL, Bº REAL, 20% Bº REAL — **solo datos reales**: una obra sin datos reales sale a 0,00 €. Desmarcar el check la devuelve a En ejecución. Pie: ⏳ Total factura pte.
  - **Total facturado** (pseudo-clave `09_COBRADO`): columnas FECHA FACTURA, PTO. TOTAL, Bº TOTAL y 20% Bº TOTAL, con la regla de la cajita Total tramitado (real si lo hay; si no, previsto). Su pie resume toda la fase 09 con esa misma regla: 💶 Total facturado, ⏳ Total factura pte, 🔨 Total en ejecución, **Total** (azul, cuadra al céntimo con la cajita Total tramitado) y **Media** (Total entre el número de obras de fase 09). Su "Total factura pte" puede no coincidir con el del grupo Factura pte, que usa solo reales.
- **Dónde se guarda y a dónde va** (todo por `POST /presupuestos/expediente/campo`, que escribe solo esa casilla, salvo lo indicado):
  - Notas → `comunidades.notas_pto`: las mismas de la caja Notas de la ficha en 01-04 y de la fila de la comunidad de Datos documentación en 05-09 (§4.2.3.2).
  - Revisado hoy → col BG `visto_hoy`: solo se usa aquí.
  - Fecha recordatorio → col AO `fecha_recordatorio`: solo se usa aquí.
  - Check Factura pte → `fecha_pte_cobro`: cambia el grupo, el estado de fase 09 de la ficha y del listado y las cajitas de Datos económicos (§3.5).
  - Hitos → col BO `hitos_obra` (ruta `expediente/hito`): orden de En ejecución y, el FIN, "Por delante" de Datos económicos.
  - Botón reloj → `comunidades.en_hoy` (col BF), o `pisos.en_hoy` en los pisos (§3.15.3).
  - Notas de piso → `pisos.notas_piso`, las mismas de la ficha de documentación (§4.2).

#### 3.16.3.4 Caja 💶 Datos económicos
- **Qué es**: el resumen económico de todos los expedientes, en cuatro cajitas. Solo lectura: no se toca nada.
- **Cuándo sale**: siempre, al final.
- **Cómo se arma**: lee `comunidades` (fase, importes, tiempos, beneficios, `fecha_envio_pto`, `fecha_pte_cobro`, `fecha_cobro`, `hitos_obra`).
Cuatro cajitas. Todo sale de la pestaña `comunidades`.
- **Las cuatro cajitas**: Total presupuestado (**fases 04-09 y rechazados**, v19.88: los expedientes con presupuesto hecho y enviado; fuera 01, 02, 03 —presupuesto en elaboración— y ZZ-DESCARTADO aunque alguno tenga presupuesto; su "inicio del cómputo" de la media mensual es el envío más antiguo de esos mismos expedientes), Total aceptado (fases 05-09), Pendiente de tramitar (05-08) y Total tramitado (09). **Total aceptado = Pendiente de tramitar + Total tramitado**, exacto en expedientes, importe, tiempo, beneficio y 20%.
- **Regla de beneficio de las cajitas**: de cada obra, el beneficio real si la celda tiene valor (si es negativo cuenta 0) y, si está vacía, el previsto. El beneficio real no se escribe: es una fórmula del Sheet (col AC = PTO total − mano de obra real − material real), que solo da resultado si esos tres datos están rellenos. La mano de obra real, el material real y el tiempo real solo se pueden escribir en la ficha en fase 09. **Origen del beneficio previsto (col AB)** (comprobado el 02/10/2026): en los expedientes antiguos es la fórmula del Sheet `pto_total − mano_obra_previsto − material_previsto − 150`; en los hechos con Plan 5, al congelar, Plan 5 sustituye la fórmula por su propio beneficio (`bP5`), sin ese −150 aparte. El real nunca resta los 150 €. **Criterio de Guille**: está bien así; los 150 € son costes que luego entran o no en el real según aparezcan, y lo que interesa es el real.
- **Objetivo de las dos reglas (criterio de Guille)**: que las cifras se vayan afinando solas a medida que se cierran obras. Cada obra entra con sus datos reales en cuanto los tiene (beneficio: al estar metidos la mano de obra real y el material real; tiempo: al tener tiempo real > 0) y, mientras no, con los previstos. A 02/10/2026, 14 obras tienen datos reales, las 14 con beneficio y tiempo.
- **Regla de tiempo**: el real si existe y, si no, el previsto, pasado de cuadrilla de 2 a cuadrilla de 5 (× 2 / 5); los meses son de 22 días laborables.
- **"Por delante"** (en Total aceptado y en Total tramitado): el trabajo que queda, en días laborables de una plantilla de 5 trabajadores (cuadrilla de 5) a jornada completa en Plan 5. **Obra terminada (v19.88, criterio de Guille)** = está en Total facturado, en Factura pte o en En ejecución con el hito **FIN** marcado (`hitos_obra.fin`). En **Total tramitado**, por delante = tiempo de las obras de En ejecución **sin FIN**; en **Total aceptado** = tiempo de todas las aceptadas (05-09) menos el de las terminadas, es decir, fases 05-08 enteras más En ejecución sin FIN. Una obra sin FIN cuenta entera aunque esté a medias (los demás hitos no restan). **"Sin trabajo"**: la fecha a la que se acaba ese tiempo contando solo días de lunes a viernes, sin descontar festivos ni vacaciones.
- **Líneas del 20 % bajo Total tramitado**: Total (20 %), En ejecución, Factura pte y Facturado (con la regla de beneficio de las cajitas), más Por delante y Sin trabajo. Por eso su cifra de Factura pte no coincide con la del grupo Factura pte de HOY, que usa solo reales.

### 3.16.4 Piezas compartidas
- Cabecera común y botón HOY: §3.15.1. Pastillas: §3.15.2.
- Botones reloj (expediente, piso y correo): §3.15.3.
- Badges de las filas (plazo, ultimátum, Faltan X de Y, Esperando EMASESA y CyCP) y de las tarjetas de Avisos: catálogo §3.15.4.

### 3.16.5 El código de la página
- **Ruta y montaje**: `app.get("/presupuestos/hoy")` arma cuatro trozos de HTML (`cajaSinRespuesta`, `cajaMails`, `cajaExpedientesHoy`, `cajaEconomicos`) y los une con la cabecera (`renderCabeceraComun`) en `pageHtml`. Cada fila de expediente la pinta `renderExpedienteEnHoy`, y cada tarjeta de aviso, `renderAviso`.
- **Carga defensiva**: cada lectura va en su propio `try/catch`; si una falla, solo esa caja sale vacía.
- **Lecturas del Sheet al abrir** (medidas en el banco de pruebas con el Excel del 02/10/2026): desde la v19.89 la ruta lee cada rango una sola vez y lo reutiliza (`_leerHoy`, caché por rango durante la petición; `_comunidadesHoy`, una sola `leerComunidades`). Quedan: `comunidades` 2 (la compartida y una lectura directa `A:BL` para el tipo de vía), `bot_expedientes` 4 y `pisos` 29, porque las funciones auxiliares `_leerPisosDeCcpp` (una lectura de `pisos` **por cada expediente** al calcular "Faltan X de Y" y el verde de los avisos) y `_leerBotDatosHoyIndex` leen por su cuenta (§9.2). Antes de la v19.89: `comunidades` 5, `bot_expedientes` 5, `pisos` 31.
- **Un solo `<script>` al final** con los manejadores: guardar notas al salir de la casilla, checks (revisado hoy, Factura pte, hitos), botones reloj, fecha recordatorio, acordeones de 09, desplegable y botones de los correos, WhatsApp. Algunos guardados recargan la página (botones reloj, asignar correo); el resto no.
- **Restos quitados en la v19.89**: la ordenación general por badge que nunca se ejecutaba, la lista `avisosPlazo` y `adjRotos` (se calculaban y no se usaban), el pintado del aviso "Atascado" y dos comentarios que contradecían al código. Comprobado en el banco de pruebas: HOY sale idéntica antes y después (la única diferencia es la media mensual, que cambia sola cada segundo porque cuenta el tiempo exacto transcurrido).

### 3.16.6 Relación con el resto
- Comparte con la ficha (§3.19) y el listado (§3.17) la cabecera, las pastillas y los badges: un cambio en `renderCabeceraComun`, `renderBadgePlazo` o `_badgeUltimatumHoy` se ve en las tres.
- Los datos que se tocan aquí (notas, Factura pte, hitos, botones reloj, notas de piso) son los mismos de la ficha y de la ficha de documentación: tocarlos en un sitio cambia el otro.
- Calendario de avisos y ultimátums: §3.9. Ventana Tiempos (enlace de 05 y 08): §3.10. Rutas: §3.13. Lectura de correo y cron ⚡: §3.7 y §3.14. Avisos M1-M5: §6.16. Estados de fase 09: §3.5. Reglas de las cajitas económicas: las usa solo esta pantalla.

## 3.17 Pantalla Listado de expedientes
La pantalla base del CRM: todos los expedientes en filas, con filtros por grupo y por fase. Es distinta de HOY (§3.16), aunque comparten cabecera y pastillas. Esquema fijo de la regla 25. Revisada contra el código y probada en el banco de pruebas con el Excel el 02/10/2026 (Activos 125, como en la pantalla real).

### 3.17.1 Cómo se llega
Ruta `GET /presupuestos` (`presupuestos.cjs`, función `vistaListado`). Se llega desde cualquier pastilla (§3.15.2), desde "Presupuestos" en la ruta de navegación, o al escribir en el buscador de la cabecera, que desde cualquier pantalla trae aquí a los 0,4 s (§3.15.1). Parámetros de la URL: `fase` (filtro: `ACTIVOS`, `TRAMITE`, `TODOS` o una fase) y `q` (búsqueda). Desde la v19.90 ya no hay parámetro `orden` ni filtro `HOY`.

### 3.17.2 Mapa de la pantalla, de arriba abajo
1. **Cabecera común** (§3.15.1), sin deshacer.
2. **Pastillas** (§3.17.3.1), con la del filtro aplicado resaltada.
3. **Filas de expedientes** (§3.17.3.2), o "Sin resultados" si no hay ninguno.

### 3.17.3 Las cajas, una a una

#### 3.17.3.1 Pastillas y filtro
- **Qué es**: los botones de filtro, con el número de expedientes de cada uno (descripción común en §3.15.2).
- **Cuándo sale**: siempre.
- **Cómo se arma**: `renderCabeceraComun` cuenta sobre **todas** las filas de `comunidades`, por fase normalizada (`normalizarFase`).
- **Qué entra en cada filtro**:

| Filtro | Qué expedientes |
|---|---|
| **Activos** (el que se aplica si no se elige ninguno) | Fases 01 a 08, salvo las de 08 con el CyCP completo (`fecha_cycp_completa`) |
| **En trámite** | Fases 05 a 08, con la misma excepción |
| **Tramitados** | Fase 09 |
| **ZZ-RECHAZADO / ZZ-DESCARTADO** | Esa fase |
| **Una fase (01 a 08)** | Solo esa fase (la 08 incluye las que tienen el CyCP completo) |
| `TODOS` (solo por la URL, sin pastilla) | Todos |

- **Búsqueda**: si hay texto en `q`, **se ignora el filtro** y se busca en **todos** los expedientes, en dirección, comunidad, administrador, presidente, teléfono del administrador y teléfono del presidente (no en correos ni notas), sin distinguir mayúsculas ni tildes (`_normTexto`: "brujula" encuentra "Brújula 4", comprobado).
- **Aviso ⚠ "No cuadra"**: si la suma de expedientes de todas las fases no coincide con el total de filas (algún expediente con una fase que el programa no reconoce), la pastilla Activos sale en rojo con ⚠.
- **Botones**: cada pastilla es un enlace al listado con su filtro; conserva la búsqueda. **+ Nuevo** abre Nuevo expediente (§3.18).
- **Dónde se guarda y a dónde va**: nada; el filtro solo vive en la URL.

#### 3.17.3.2 Filas de expedientes
- **Qué es**: un expediente por fila.
- **Cuándo sale**: siempre; "Sin resultados" si el filtro o la búsqueda no dejan ninguno.
- **Cómo se arma**: una sola lectura de `comunidades` (`leerComunidades`).
- **Qué entra**: los del filtro o la búsqueda (§3.17.3.1).
- **Orden**: siempre **por calle**: primero el nombre de la calle sin número (`extraerNombreCalle`), luego el tipo de vía y luego la dirección completa (número, escalera…), sin distinguir mayúsculas y con los números en orden natural. (v19.90: quitados el botón de orden, que no se pintaba, y los órdenes Z-A y Urgencia por URL; criterio de Guille: el orden por urgencia ya lo da HOY.)
- **Cada fila**, de izquierda a derecha: **tipo de vía y dirección** (al pasar el ratón, completa) · **hueco de badge**: solo en fase 09, el **estado de fase 09** (🔨 En ejecución · ⏳ Factura pte · 💶 Facturado, con la fecha al pasar el ratón; catálogo §3.15.4); en el resto, vacío pero con su ancho, para que las filas queden alineadas · **línea de fases en pequeño** (`lineaTiempoHtml` en modo compacto, la misma de la ficha): las etapas con la actual marcada · **importe** del presupuesto (`pto_total`).
- **Botones**: toda la fila es un enlace a la ficha del expediente (§3.19).
- **Dónde se guarda y a dónde va**: nada; es solo lectura.

### 3.17.4 Piezas compartidas
- Cabecera común: §3.15.1. Pastillas: §3.15.2.
- Badge de estado de fase 09: catálogo §3.15.4 (la misma función `badgeEstado09` que la ficha).
- Línea de fases: `lineaTiempoHtml`, la misma función que la tarjeta de línea de tiempo de la ficha (§3.19.3.2), aquí en modo compacto.

### 3.17.5 El código de la página
- **Ruta y montaje**: `app.get("/presupuestos")` lee `comunidades` y llama a `vistaListado`, que cuenta, filtra, ordena y pinta las filas, y añade arriba `renderCabeceraComun`.
- **Lecturas del Sheet al abrir** (banco de pruebas): solo `comunidades`, 1 vez (v19.90; antes, además, 4 de `mail_plantillas` para un badge que ya no se pintaba).
- **Restos quitados en la v19.90**: la carga de plantillas sin uso, el filtro `HOY` y su contador, y el botón de orden con los órdenes Z-A y Urgencia. Comprobado en el banco de pruebas: el listado sale idéntico con Activos, con una fase, con ZZ y con una búsqueda (la única diferencia es que los enlaces de las pastillas ya no llevan `&orden=az`), y HOY también sale idéntica. `calcularDisparador` se conserva: la usa la ficha.

### 3.17.6 Relación con el resto
- Cambiar `renderCabeceraComun` (pastillas, contadores, aviso ⚠) afecta al listado, a HOY y a la ficha.
- Cambiar `lineaTiempoHtml` afecta a las filas del listado y a la tarjeta de línea de tiempo de la ficha.
- Cambiar qué es "CyCP completo" o la lista de fases (§3.1, §3.5) cambia los números de Activos y En trámite aquí y en todas las pantallas.
- La búsqueda es la que usa el buscador de la cabecera en todas las pantallas.

## 3.18 Pantalla Nuevo expediente
El formulario para dar de alta una comunidad. Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 3.18.1 Cómo se llega
Ruta `GET /presupuestos/nuevo` (`vistaNuevo`), desde la pastilla **+ Nuevo** (§3.15.2) de cualquier pantalla. Acepta `?dir=` para traer la dirección ya escrita.

### 3.18.2 Mapa
Cabecera común (§3.15.1) · el formulario (§3.18.3.1) · botones **Crear expediente** y **Cancelar** (vuelve al listado).

### 3.18.3 Las cajas, una a una

#### 3.18.3.1 Formulario
- **Campos**: **tipo de vía** (con autocompletado: los tipos fijos de `TIPOS_VIA_FIJOS` —C, Av, Bª, Pz, Rª, Ur desde el 15/10/2026, en que Guille quitó Pza, Cm, Pje, Bda y Crta porque no los usaba ningún expediente— más los ya usados en el Sheet, como "Av de", "Pz de los" o "NR"; un tipo nuevo se escribe a mano una vez y desde entonces sale en la lista) · **dirección** (obligatoria; autocompletado con las calles ya usadas) · población · CP · **administrador** (autocompletado: al elegir uno conocido rellena su teléfono y correo) · teléfono y correo del administrador · presidente · teléfono y correo del presidente.
- **Comprobaciones al pulsar Crear**: que la dirección **no exista ya** (sin distinguir tildes, mayúsculas ni espacios de más; si existe, avisa con la dirección encontrada y pide añadir número, escalera o portal) y que los dos correos tengan formato válido y sin tildes. Si algo falla, vuelve a enseñar el formulario con lo escrito y el aviso.

#### 3.18.3.2 Qué pasa al crear
- **Dónde se guarda**: una fila nueva en `comunidades` (`POST /presupuestos/nuevo`), con su identificador sacado de la dirección (`ccppId`), en fase **01_CONTACTO**, con fecha de contacto de hoy y **sin coordenada** (sale en "Ubicar las que faltan" del Mapa, §3.20).
- **Carpeta en Drive**: la crea en el mismo momento; si Drive falla, el expediente se crea igual y solo queda apuntado en el registro del servidor.
- **Modo bot**: nace con `bot_comunidad_activo = BOT_WHATSAPP`. **Aquí es donde nace la regla de §4.3 y §1** ("todos los expedientes nuevos nacen con el sistema nuevo del bot"): el campo `bot_comunidad_activo` se fija explícitamente a `"BOT_WHATSAPP"` para cualquier expediente nuevo — nunca nace vacío. El propio comentario del código (v19.01) explica el porqué: antes, si esa celda quedaba vacía, el código la interpretaba como modo manual, y el cron que atiende la fase 05 (el que sigue el listado/documentación) nunca los recogía — caían en un camino de código compartido con las fases 04/08 que no distingue si ya hubo contacto con los vecinos. Se decidió que **nacer en automático es el comportamiento por defecto**, y el modo manual pasó a ser una excepción que se activa a mano, apagando el interruptor en la ficha.
- **Después**: abre la ficha del expediente recién creado (§3.19), con el aviso de creado.

### 3.18.4 Piezas compartidas
Cabecera común: §3.15.1. Los autocompletados son los mismos de la caja Datos CCPP de la ficha (§3.19.3.4).

### 3.18.5 El código
`app.get("/presupuestos/nuevo")` lee `comunidades` para los autocompletados (`construirDatalists`) y pinta `vistaNuevo`; `app.post("/presupuestos/nuevo")` valida, crea la fila y la carpeta y redirige a la ficha.

### 3.18.6 Relación con el resto
- El expediente nace en 01: sale en el listado (Activos y 01-CONTACTO) y entra en HOY cuando su badge pase a Decidir o se marque con el botón reloj (§3.16.3.3).
- La dirección decide su identificador: cambiarla luego en la ficha lo renombra todo (§3.19.3.4).
- El modo bot con el que nace decide cómo lo tratan HOY y el cron en la fase 05 (§4.5, §6).

## 3.19 Pantalla Ficha del expediente
La pantalla de un expediente entero, en todas sus fases. La pinta una sola función, `vistaFicha` (`presupuestos.cjs`, ~2.740 líneas), que también usa `documentacion.cjs` (§4.1). Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 3.19.1 Cómo se llega
- Desde el listado (§3.17), desde HOY (§3.16) o desde cualquier enlace a un expediente, se abre `GET /presupuestos/expediente?id=…`.
- **Fases 01, 02, 03, 04 y ZZ**: la pinta esa ruta.
- **Fases 05, 06, 07, 08 y 09**: esa ruta **redirige** a `GET /documentacion/expediente`, que pinta la misma `vistaFicha` y le añade arriba el aviso **"Faltan pisos por crear"** (si no hay vecinos) y abajo la caja **Datos documentación** (§4.2). Excepción: si la URL lleva `accion_mail` (se abre para lanzar un correo), no redirige.
- La cabecera común lleva aquí **↶ Deshacer / ↷ Rehacer**, y el ☰ añade "Imprimir documentos" y "📋 PRESUPUESTO PLAN 5" (§3.15.1).

### 3.19.2 Mapa de la pantalla, de arriba abajo
1. **Barra de acción** (§3.19.3.1).
2. **Línea de tiempo** y, en 05 y 08, **línea de comunicaciones** (§3.19.3.2).
3. Solo en 05-09 y sin vecinos: aviso **Faltan pisos por crear** (§3.19.3.3).
4. **Datos CCPP** (§3.19.3.4), siempre.
5. **Notas** (§3.19.3.5), solo en 01-04 y ZZ.
6. **Comunicaciones** (§3.19.3.6), siempre.
7. **Datos económicos** (§3.19.3.7), desde la 03.
8. **Datos documentación** (§3.19.3.8), solo en 05-09.

### 3.19.3 Las cajas, una a una

#### 3.19.3.1 Barra de acción
- **Qué es**: la fase actual, su badge y los botones para avanzar o cambiar de estado.
- **Cuándo sale**: siempre; su contenido cambia con la fase (`accionHtml`, un `if/else` por fase).
- **Cómo se arma**: de `comunidades` (fase, fechas, contadores de correo) y de las plantillas de correo de la fase (badges y contador del cron).
- **Qué lleva**: A la izquierda: el botón **↶ retroceder** (cuadrado rojo; vuelve a la fase anterior tras confirmar; no sale en 01, 09 ni ZZ), la flecha → y el nombre de la fase, y debajo su badge (catálogo en §3.15.4). En 01 y 04, además, el contador del cron, "📧 x+y/z - próximo reenvío dd-mm-aa" (`calcularInfoEnvioAuto`). A la derecha, los botones:

| Fase | Botones de la derecha | Qué hacen |
|---|---|---|
| 01 Contacto | Correo de la fase | Abre el modal del correo de contacto; al enviar, el cron hace el resto |
| 02 Visita | Casilla **Fecha visita** · avanzar | Guarda el día real de la visita · pasa a 03 |
| 03 Envío PTO | Correo de la fase | Abre el modal de envío del presupuesto; al enviar, pasa a 04 |
| 04 Aceptación PTO | **📧 Reenviar presupuesto revisado** · **✓ ACEPTADO** · **✕ RECHAZADO** | Modal `04_REENVIO` · modal `05_ACEPTACION_PTO`, que envía y pasa a 05 · modal de rechazo con dos motivos ("por precio más bajo de la competencia", "porque no se va a hacer de momento"), que pasa a ZZ-RECHAZADO |
| 05 Documentación | Botones del **ultimátum** (§3.11) · correo de fin de documentación · **✕ A ZZ-DESCARTADOS** | Calendario de §3.9 · modal `05_FIN_DOC`, que envía y pasa a 06 · descarta tras confirmar |
| 06 Visita EMASESA | Casilla **Fecha visita** (de EMASESA) · avanzar · ✕ A ZZ-DESCARTADOS | Guarda el día real de la visita del técnico · pasa a 07 |
| 07 Pte CYCP | Correo de inicio de CyCP · ✕ A ZZ-DESCARTADOS | Modal `08_INICIO_CYCP`, que envía y pasa a 08 |
| 08 CYCP | Botones del ultimátum · **✓ Tramitados** · ✕ A ZZ-DESCARTADOS | Calendario de §3.9 · modal `08_FIN_CYCP`, que envía, cierra la fase (`fecha_cycp_completa`) y pasa a 09 |
| 09 Tramitada | Check **Factura pte** · casilla **Fecha factura** | Los dos datos de §3.5; se guardan al instante y son los mismos que en HOY |
| ZZ Rechazado | **↻ Reactivar (último estado)** · **⟲ Reactivar (desde el principio)** · **→ A ZZ-DESCARTADOS** | Vuelve a su fase conservando fechas y contadores · vuelve a 01 borrándolos · descarta. Todos piden confirmación (§3.4) |
| ZZ Descartado | Los dos Reactivar · **🗑 Eliminar** | Igual · borra el expediente del Sheet (§3.4) |

Qué correo envía cada modal, sus variables y qué fase deja: §3.6 y §3.7.
- **Dónde se guarda y a dónde va**: cada botón llama a su ruta (§3.13, §3.12) y cambia la fase y sus fechas en `comunidades`; eso mueve el expediente de grupo en HOY y de pastilla en el listado. Las casillas Fecha visita (02 y 06), Factura pte y Fecha factura (09) se guardan al instante por `expediente/campo`; las de 09 son las mismas que en HOY.

#### 3.19.3.2 Línea de tiempo y línea de comunicaciones
- **Qué es**: arriba, las etapas del expediente con su fecha, en dos tramos, PRESUPUESTO (01 a 04) y DOCUMENTACIÓN (05 a 08), con la actual marcada (`lineaTiempoHtml`, la misma función que la línea pequeña del listado). Debajo, solo en 05 y 08, los pasos del calendario de correos y WhatsApp de la fase, con el día de cada uno y "hoy: día N" (`lineaComunicacionesHtml`, §3.9).
- **Cuándo sale**: siempre la de tiempo; la de comunicaciones, solo en 05 y 08.
- **Cómo se arma**: fechas de fase de `comunidades`; contadores de correo y días de las plantillas.
- **Botones**: ninguno. Solo lectura.

#### 3.19.3.3 Aviso "Faltan pisos por crear"
- **Qué es**: un aviso amarillo: "Esta comunidad está en fase de documentación pero no tiene vecinos cargados. Añádelos antes de que empiece el seguimiento."
- **Cuándo sale**: en 05-09, si la comunidad no tiene ningún piso en `pisos`. Lo añade `documentacion.cjs`.
- **Botones**: ninguno; los pisos se añaden en Datos documentación.

#### 3.19.3.4 Caja Datos CCPP
- **Qué es**: los datos de la comunidad.
- **Cuándo sale**: siempre.
- **Campos**: tipo de vía (con autocompletado de los tipos usados) · dirección · población · CP · administrador (con autocompletado: al elegir uno conocido rellena su teléfono y correo) · teléfono y correo del administrador · presidente (con autocompletado) · teléfono y correo del presidente. Botón **Carpeta Drive** (`GET /presupuestos/expediente/carpeta-drive`, abre la carpeta del expediente en Drive en otra pestaña).
- **Dónde se guarda y a dónde va**: cada campo se guarda **al salir de la casilla** en su columna de `comunidades` (`expediente/campo`, §3.19.5). **Excepción: la dirección y el tipo de vía** piden confirmación y **renombran el expediente**, porque de la dirección cuelgan el identificador, el historial de correos y el Plan 5 (`ptlRenombrar`, §3.4). Los correos y teléfonos son los destinatarios de los correos a la comunidad (§3.7); la dirección sale en todas las pantallas.

#### 3.19.3.5 Caja Notas
- **Qué es**: un campo libre de notas del expediente (`notas_pto`) con el **botón reloj** del expediente (§3.15.3).
- **Cuándo sale**: solo en 01, 02, 03, 04 y ZZ. Desde la 05 esa caja no sale, pero las mismas notas siguen en la ficha: en la fila de la comunidad de Datos documentación (§4.2.3.2). También se editan en la fila del expediente en HOY (§3.16.3.3).
- **Dónde se guarda y a dónde va**: `comunidades.notas_pto`, al salir de la casilla; son las mismas notas de HOY y de la fila de la comunidad en Datos documentación.

#### 3.19.3.6 Caja Comunicaciones
- **Qué es**: el historial de correos del expediente.
- **Cuándo sale**: siempre; "— Sin comunicaciones registradas —" si no hay.
- **Cómo se arma**: lee `mail_historico` (`leerMailHistoricoDeCcpp`): las filas con el `ccpp_id` del expediente o, si no tienen, con su misma dirección. Y `mails_pendientes`, para saber qué correos están en HOY.
- **Orden**: por fecha, el más antiguo arriba; las fechas que no se entienden, al final.
- **Cada fila**, de izquierda a derecha: fecha y hora (hora de España; sin hora si son las 00:00) · flecha (▲ azul enviado, ▼ roja recibido, según el tipo) · categoría (**Manual**, gris, o **Automático**, verde) · asunto, sin el prefijo "C [vía] [dirección] -" que pone el programa (al pinchar despliega destinatario o remitente, plantilla, mensaje y adjuntos con enlaces) · ↩ Responder · ↪ Reenviar · **botón reloj** (solo en los recibidos) · ✕ borrar.
- **Botón de la caja**: **Enviar mail manual** abre el compositor (ventana flotante arrastrable). **El compositor dice en el título qué se está haciendo** (v129-v130): «Responder mail» (↩, también al llegar desde Responder de HOY), «Reenviar mail» (↪) o «Enviar mail manual» (este botón y los correos a vecinos). Lleva el desplegable **«Insertar respuesta tipo»** (v19.113, 28 px de alto), que mete el texto elegido arriba del cuerpo (la firma y la cita quedan debajo); las respuestas tipo se editan en Plantillas mail (§3.21.3.3). En las ventanas de correo con plantilla, la nota «el cron mandará hasta N reenvíos» solo sale en 01-Contacto y 03-Envío presupuesto (las únicas con reenvíos automáticos); en las demás, solo «Envíos previos: N».
- **Dónde se guarda y a dónde va**: lo enviado desde aquí se apunta en `mail_historico` y sale después en esta misma caja. El botón reloj mete o saca el correo de la caja Mails pendientes de HOY (`mail-toggle-hoy`, §3.15.3). Borrar quita la fila del historial (`expediente/mail-borrar`).

#### 3.19.3.7 Caja Datos económicos
- **Qué es**: los importes y tiempos del presupuesto y, al final, los reales.
- **Cuándo sale**: desde la 03 (no en 01 ni 02).
- **Campos**, según la fase:
  - **Hasta la 08 y en ZZ**: PTO total · tiempo previsto (días de cuadrilla de 2) · mano de obra prevista · material previsto · beneficio previsto (gris, solo lectura).
  - **En 09**: cada previsto con su **real** al lado (tiempo, mano de obra, material y beneficio real) y los dos **desvíos** (tiempo y beneficio), en gris.
- **Cuándo se pueden editar**: los **previstos**, solo si el expediente **no tiene Plan 5** y no está en 01, 02 ni ZZ (si tiene Plan 5, los pone Plan 5 al congelar y salen en gris). Los **reales**, solo en 09. Los calculados, nunca.
- **Las fórmulas reales de los campos calculados**: `tiempo_desvio = 1 − (tiempo_real / tiempo_previsto)` (en %, negativo si se tardó más de lo previsto); `beneficio_real = pto_total − mano_obra_real − material_real`; `beneficio_desvio = beneficio_real − beneficio_previsto`. **Los tres viven como fórmulas del Sheet** (cols AG, AC y AD de `comunidades`, desde v17.21): el programa no los escribe nunca (`actualizarComunidad` se salta esas columnas para no borrar las fórmulas); el navegador solo los recalcula en pantalla, en vivo, mientras se editan los demás. **`beneficio_previsto` es el único que NO se calcula aquí** — lo trae ya puesto el Sheet: en expedientes antiguos, una fórmula heredada de la hoja de cálculo original; en los nuevos, **es el mismo dato que congela el botón "Congelar" de Plan 5 al cerrar el presupuesto** (§5.4) — una relación real y directa entre los dos módulos.
- **Dónde se guarda y a dónde va**: cada campo en su columna de `comunidades`, al salir de la casilla. Son los datos de las cuatro cajitas de Datos económicos de HOY (§3.16.3.4), de los importes de los grupos de 09 y del importe del listado. Al meter mano de obra y material reales, el beneficio real pasa a contar en vez del previsto.

#### 3.19.3.8 Caja Datos documentación
Solo en 05-09: la caja de vecinos y documentos. La pinta `documentacion.cjs`; su apartado es el §4.2.

### 3.19.4 Piezas compartidas
- Cabecera común, deshacer/rehacer y ☰: §3.15.1. Pastillas: §3.15.2.
- Botones reloj (expediente en Notas y en Datos documentación; correos en Comunicaciones): §3.15.3.
- Badges de la barra (plazo, ultimátum, estado de fase 09): catálogo §3.15.4.
- Línea de tiempo: la misma función que la línea pequeña del listado (§3.17.3.2).

### 3.19.5 El código de la página
- **Carga defensiva de datos auxiliares** al principio (histórico de mails, plantillas, índice F1 de reenvíos...), cada uno en su propio `try/catch` con fallback a vacío — **si una de estas piezas falla, la ficha no se rompe entera**, solo esa sección sale vacía o sin badge. Patrón a repetir si se añade una carga nueva aquí.
- **Un único `<script>` grande al final** con toda la interactividad de cliente: ventanas flotantes arrastrables reutilizables (`ptlMakeDraggable`, usadas por el modal de mail manual y el de mail con plantilla), el modal "Imprimir documentos" en 3 pasos (`GET /presupuestos/docs/menu` → elegir documentos+piso, `POST /presupuestos/docs/huecos` → formulario de huecos precargados/editables, `POST /presupuestos/docs/generar` → genera y descarga el PDF), el modal "Enviar mail manual" tipo Gmail, autocompletado de direcciones/administrador, y el manejador del reloj "Añadir a HOY". Mismo tipo de bloque JS embebido que el TOMA_DATOS_HTML/DESGLOSE_HTML de Plan 5 (§5) — **requiere el mismo doble check al editarlo** (verificación aparte del bloque interno, escapes `\uXXXX` para tildes).
- Otras piezas del `<script>`: autocompletado propio de tipo de vía, administrador y presidente (al elegir un administrador rellena su teléfono y correo); botones reloj del expediente (dos en la ficha: caja Notas y fila de la comunidad en Datos documentación, sincronizados); confirmación de ↶ retroceder (`ptlRetroceder`) y de 🗑 eliminar.
- **Guardado de los campos**: cada campo se guarda solo **al salir de él** (o al cambiar un desplegable), uno a uno, por `POST /presupuestos/expediente/campo`; una etiqueta dice "N cambios sin guardar" mientras tanto, y si se pincha un enlace con cambios pendientes, se guardan antes de salir. ↶/↷ deshacen y rehacen los cambios de los campos.
- **Lecturas al abrir**: `comunidades`, el historial de correos de la comunidad, los correos en HOY, la lista de plantillas, las plantillas de la fase y si tiene Plan 5. Cada una con su `try/catch`.
**Trampa**: al tocar esta función hay que buscar TODAS las llamadas relacionadas antes de cambiar algo — mismo aviso que con `_p5Entrada` en Plan 5 (§5.5) — porque el HTML y el script están entrelazados y una variable del lado servidor (p.ej. `comu.ccpp_id`) se vuelca directamente dentro del script con `${JSON.stringify(...)}`.

### 3.19.6 Relación con el resto
- Lo que se cambie aquí afecta a las **dos rutas** (presupuestos y documentación), porque pintan la misma `vistaFicha`.
- Notas, botón reloj, Factura pte y Fecha factura son **los mismos datos que en HOY**: cambiarlos aquí cambia HOY y al revés.
- Datos económicos alimenta las cajitas económicas de HOY, los grupos de 09 y el importe del listado; si el expediente tiene Plan 5, los previstos los pone Plan 5 (§5.4).
- Renombrar la dirección arrastra el historial de correos y el Plan 5 (§3.4).
- Modales de correo y avance de fase: §3.6 y §3.7. Ultimátums: §3.11 y §3.9. Reactivar, rechazar, descartar, eliminar: §3.4. Rutas: §3.13 y §3.12.

## 3.20 Pantalla Mapa
Un mapa de Sevilla con una chincheta por expediente, coloreada por fase. Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 3.20.1 Cómo se llega
Ruta `GET /presupuestos/mapa` (`presupuestos.cjs`), desde el ☰. Desde una ficha, el enlace lleva `?focus=<ccpp_id>` y el mapa abre centrado en ese expediente (zoom de calle) en vez de en la vista general.

### 3.20.2 Mapa de la pantalla, de arriba abajo
1. **Cabecera común** (§3.15.1).
2. **Leyenda con filtros** y botones **✓ Mostrar todas / ✗ Ocultar todas** (§3.20.3.1).
3. **📍 Ubicar las que faltan (N)**, desplegable (§3.20.3.3).
4. **Buscador** "Buscar dirección en el mapa" (§3.20.3.4).
5. **El mapa** con las chinchetas (§3.20.3.2).

### 3.20.3 Las cajas, una a una

#### 3.20.3.1 Leyenda y filtros
- **Qué es**: los 5 grupos de color, cada uno con su casilla para mostrarlo u ocultarlo: **gris** Contacto / Visita (01-02) · **azul** Presupuesto enviado / aceptación (03-04) · **ámbar** En tramitación (05-08) · **verde** Tramitada (09) · **rojo** Rechazado / Descartado (ZZ). Lo que no encaje, "Otros", en azul (`grupoDeFase`).
- **Botones**: Mostrar todas · Ocultar todas. Solo cambian lo que se ve; no se guarda nada.

#### 3.20.3.2 Chinchetas
- **Qué entra**: todos los expedientes de `comunidades` que tienen coordenada válida en la columna `earth` (texto "lat, lng"; se descartan 0,0 y las que están fuera del planeta).
- **Cada chincheta**: su color de grupo; al pulsarla, una ventanita con la dirección (enlace a la ficha, §3.19) y la fase.
- **Se pueden arrastrar**: soltar una chincheta en otro sitio guarda su nueva coordenada.
- **Vista al abrir**: encuadra todas las chinchetas; si no hay ninguna, Sevilla; con `?focus`, centra en esa.
- **Dónde se guarda y a dónde va**: `comunidades.earth` (`POST /presupuestos/mapa/guardar-coord`, con 6 decimales, rechazando 0,0 y coordenadas imposibles). Solo lo usa esta pantalla.

#### 3.20.3.3 Ubicar las que faltan
- **Qué es**: la lista de expedientes **sin coordenada**. Los "Z SIN DIRECCION" (relleno) salen en la lista y cuentan en el número, marcados "(sin dirección)", pero la búsqueda automática se los salta.
- **Botón "📍 Ubicar"**: busca todas las que faltan en **Nominatim** (el buscador de direcciones gratuito de OpenStreetMap), de una en una. Prepara la dirección: quita la abreviatura de vía, "Bloque…" y los "???", y añade el municipio (Sevilla, salvo que el tipo de vía lleve el pueblo entre paréntesis, como "C (Dos Hermanas)"; "(Bellavista)" cuenta como Sevilla). Cada resultado sale como chincheta **provisional** (amarilla con borde negro, "⚠ Ubicación aproximada sin confirmar"): **no se guarda hasta que se arrastra** a su sitio.
- **Botón "📍 A mano"** (en cada una): pone una chincheta en el centro del mapa para arrastrarla a su sitio; al soltarla se guarda.

#### 3.20.3.4 Buscador del mapa
- Busca entre las chinchetas por dirección mientras se escribe ("Sin resultados" si no hay) y, al elegir una, centra el mapa en ella. Es distinto del buscador de la cabecera, que lleva al listado.

### 3.20.4 Piezas compartidas
Cabecera común: §3.15.1. Sin botones reloj ni badges.

### 3.20.5 El código de la página
- `app.get("/presupuestos/mapa")` lee `comunidades`, calcula grupo, color y coordenada de cada expediente y la lista de los que faltan, y pinta la página. El mapa usa **Leaflet** (librería cargada de internet) y los mapas de **OpenStreetMap**; la ubicación automática, **Nominatim**. Si no hay internet, el mapa no carga.
- Trampa resuelta en el código: con `?focus` se centra solo en esa chincheta y se salta el encuadre general (antes la animación de uno pisaba al otro).

### 3.20.6 Relación con el resto
- Usa la fase de cada expediente (§3.1): si cambian los grupos de fases, hay que revisar `grupoDeFase`.
- La coordenada (`earth`) solo la usa esta pantalla. Un expediente nuevo nace sin ella (§3.18) y sale en "Ubicar las que faltan".
- Desde la ficha se llega con `?focus`.

## 3.21 Pantalla Plantillas mail
Los textos y tiempos de todos los correos del programa. Pantalla de configuración: no trabaja con un expediente concreto. Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026. (Las otras dos pantallas de plantillas tienen su propio apartado: Plantillas del bot, §3.22; Plantillas de documentos, §3.23.)

### 3.21.1 Cómo se llega
Ruta `GET /presupuestos/plantillas` (`presupuestos.cjs`, función `vistaPlantillas`). Desde el ☰ de la cabecera, o desde el enlace **Tiempos** de los grupos 05 y 08 de HOY, que llega con `?tiempos=05` o `?tiempos=08` y abre sola la ventana Tiempos de esa fase.

### 3.21.2 Mapa de la pantalla, de arriba abajo
1. **Cabecera común** (§3.15.1).
2. **Una tarjeta por correo**, plegada (▶), en el orden del ciclo del expediente (§3.21.3.1). Algunas tarjetas reúnen varias plantillas (§3.21.3.2).
3. **Pie de página global** (§3.21.3.3).
4. **Ventana Tiempos**, flotante, cuando se abre (§3.21.3.4).

### 3.21.3 Las cajas, una a una

#### 3.21.3.1 Tarjeta de un correo
- **Qué es**: la plantilla de un correo: su texto y cuándo y cuántas veces sale.
- **Cómo se arma**: lee la pestaña `mail_plantillas` (`leerPlantillaMail`, con caché), las cuentas de `mail_cuentas` (sin caché) y los días de los WhatsApp M1-M3 de `bot_plantillas`. Si una plantilla no existe todavía en el Sheet, sale la tarjeta vacía para crearla.
- **Qué entra y en qué orden**: 17 tarjetas (20 plantillas desde v19.102), en este orden fijo (`fasesConPlantilla`): 01_CONTACTO · 02_PTE_VISITA (con y sin acta) · 03_ENVIO_PTO · 04_ACEPTACION_PTO · 04_REENVIO (reenvío de presupuesto modificado, sin fase propia) · 05_ACEPTACION_PTO · 05_SEGUIMIENTO_DOC · 05_ULTIMATUM_DOC · 05_ULT_RESOLVER · 05_FIN_DOC · 08_INICIO_CYCP · 08_SEGUIMIENTO_CYCP · 08_ULTIMATUM_CYCP · 08_ULT_RESOLVER · 08_FIN_CYCP. **v19.100**: **05_DOC_VECINO** ("05-INICIO DOC (VECINO)", justo detrás de 05_ACEPTACION_PTO) y **08_CYCP_VECINO** ("08-INICIO CYCP (VECINO)", justo detrás de 08_INICIO_CYCP), los correos a un vecino en M (§4.2.3.3). **v19.102**: **05_REC_M1_VECINO** y **05_REC_M2_VECINO** ("05-RECORDATORIO M1/M2 (VECINO)") y **08_REC_M3_VECINO** ("08-RECORDATORIO M3 (VECINO)") no tienen tarjeta propia: van **dentro** de la tarjeta de inicio (VECINO) de su fase (§3.21.3.2). Son los recordatorios por correo de los avisos de HOY (§6.16), con los textos de los WhatsApp M1-M3 adaptados (09/10/2026), sin adjuntos y con la misma CCO y cuenta que las de inicio. Ya están guardadas en el Sheet (09/10/2026: Guille añadió en las dos "o WhatsApp al 634-379-632", el WhatsApp de envíos manuales, en la línea de recepción de documentación). Desde la v19.103 no hay texto de respaldo en el código (regla 9): si la fila no existe, su tarjeta sale vacía para escribirla. Usan las variables de los WhatsApp M ({nombre}, {tipo_via}, {comunidad}, {piso}, {fecha_limite_vigente}, {prorroga_nota}…), no las {{…}} de los correos a la comunidad.
- **Campos** de la tarjeta normal: **activo** · **asunto** · **mensaje** · **adjuntos** fijos (3 casillas, enlaces de Drive; se guardan juntos en `adjuntos_fijos` separados por "||") · **CCO** (3 casillas; deben ser correos válidos y sin tildes) · **cuenta de envío** (desplegable con las cuentas de `mail_cuentas`) · **días**: primer envío, cada cuántos días se repite y máximo de envíos (los que usa el cron, §3.8).
- **Aviso**: **⚠️ Adjunto roto** (rojo) junto al título si algún adjunto de la plantilla no se abre (§3.21.5).
- **Botones**: abrir y plegar (▶) · **Guardar**. En 05_ACEPTACION_PTO y 08_INICIO_CYCP, además, **📋 Tiempos Fase 05-Doc** / **📋 Tiempos Fase 08-CYCP** (abre la ventana Tiempos de esa fase).
- **Dónde se guarda y a dónde va**: en su fila de `mail_plantillas` (`POST /presupuestos/plantillas/guardar`). Lo usan los modales de correo de la ficha (§3.19.3.1), el cron de reenvíos (§3.8), los badges de plazo y la línea de comunicaciones (§3.15.4, §3.19.3.2) y la ventana Tiempos. Cambiar unos días cambia a la vez cuándo salen los correos y lo que dicen los badges.

#### 3.21.3.2 Tarjetas que reúnen varias plantillas
- **02 · Pte visita**: un solo correo con dos mensajes, **con acta** y **sin acta** (`02_PTE_VISITA_CON_ACTA` y `02_PTE_VISITA_SIN_ACTA`).
- **05 · Seguimiento doc**: el seguimiento y sus dos variantes de texto (`05_SEG_ESPERA`, `05_SEG_FECHA`, que solo guardan textos; sus días están a 0 a propósito).
- **05 · Ultimátum doc** y **08 · Ultimátum CYCP**: el correo del ultimátum, el de la prórroga (`*_ULT_AVISO`, con las casillas **Ampliación de plazo de N días** y **Recordatorio de N días**, que admite 0 = sin recordatorio desde v19.106) y el de disidentes (`*_ULT_RESOLUCION`). Sus textos de ayuda calculan el día con la plantilla y la regla del día siguiente.
- **05-INICIO DOC (VECINO)** y **08-INICIO CYCP (VECINO)** (v19.102, criterio de Guille 09/10/2026, para no llenar la pantalla de tarjetas): el correo de inicio (bloque INICIO, con sus adjuntos) y debajo sus recordatorios, cada uno con su asunto y su texto: **RECORDATORIO M1** y **RECORDATORIO M2** (`05_REC_M1_VECINO`, `05_REC_M2_VECINO`) en la de 05 y **RECORDATORIO M3** (`08_REC_M3_VECINO`) en la de 08. Cada título dice el día del aviso de HOY (de Plantillas del bot). **Enviar desde**, **CCO** y **Activa** son de toda la tarjeta; los recordatorios no llevan adjuntos. Un solo Guardar escribe todas sus filas (`rec_asunto__FASE` / `rec_mensaje__FASE` en `POST /presupuestos/plantillas/guardar`). Las tres filas de recordatorio están en el Sheet desde el 09/10/2026; si faltaran, sus cuadros saldrían vacíos (sin texto de respaldo, regla 9) y la tarjeta de HOY avisaría.
- **05 · Resolución de contrato** y **08 · Resolución de contrato**: `*_ULT_RESOLVER`, con los días contados desde que se envía el correo de disidentes.
- Qué hace cada uno y cuándo sale: §3.11 y §3.9.

#### 3.21.3.3 Pie de página global
- **Qué es**: el texto que se añade al final de todos los correos.
- **Dónde se guarda**: fila especial `_PIE_GLOBAL` de `mail_plantillas`, columna del mensaje (`POST /presupuestos/plantillas/guardar-pie-global`). Va a todos los correos que manda el programa.
- **Tarjeta 💬 Respuestas tipo** (v19.113): textos para insertar en los correos manuales (desplegable «Insertar respuesta tipo» del compositor de la ficha, §3.19.3.6). Siempre hay un hueco vacío para añadir una; para borrar una, se deja su nombre vacío. Se guardan en la fila especial `_RESPUESTAS_TIPO` de `mail_plantillas` (col D, JSON `[{nombre, texto}]`) por `POST /presupuestos/plantillas/guardar-respuestas-tipo`.

#### 3.21.3.4 Ventana Tiempos (fases 05 y 08)
Ventana flotante, solo informativa: los pasos de la fase en orden de días, qué sale en cada uno y el tiempo máximo hasta resolver, con y sin prórroga. Se abre con los botones **📋 Tiempos Fase 05-Doc / 08-CYCP** o llegando con `?tiempos=05/08`. Explicación completa, y de dónde sale cada número: §3.10.

### 3.21.4 Piezas compartidas
Cabecera común: §3.15.1. No tiene botones reloj ni badges propios (los badges que salen en la ventana Tiempos son los del catálogo, §3.15.4).

### 3.21.5 El código de la página
- `app.get("/presupuestos/plantillas")` lee las 17 plantillas a la vez (con caché), las cuentas, el pie y las plantillas extra de las tarjetas especiales, y llama a `vistaPlantillas`. La ventana Tiempos la pintan en el navegador `ptlAbrirEsquema05` / `ptlAbrirEsquemaCycp`.
- **Vigilante de adjuntos** (v19.91, criterio de Guille): comprueba que los enlaces de Drive de los adjuntos fijos de **todas las plantillas activas que tengan adjuntos** siguen abiertos (solo pregunta a Drive, no descarga nada). Corre a los 90 s de arrancar el servidor, **cada 6 horas** y, para la plantilla que se guarda, **al pulsar Guardar** (en paralelo, como mucho unos 10 s). El resultado se guarda en memoria (`_adjuntosRotos`, se pierde al reiniciar y se rehace a los 90 s) y sale como **⚠️ Adjunto roto** en la tarjeta de la plantilla, con el título del adjunto y el motivo al pasar el ratón. Antes de la v19.91 solo miraba las plantillas de reenvío automático, que no tienen adjuntos: no vigilaba nada. Probado en el banco de pruebas con un enlace roto simulado: el aviso sale en las tres tarjetas que usan ese enlace (03, 05-inicio doc y 08-inicio CyCP) y en ninguna si todos están bien.

### 3.21.6 Relación con el resto
- Cambiar una plantilla cambia lo que envían los modales de la ficha y el cron, los días de los badges de HOY y de la ficha, la línea de comunicaciones de 05 y 08 y la ventana Tiempos.
- Los días de M1-M3 que muestra la ventana Tiempos vienen de Plantillas del bot (§3.22).
- Variables que se pueden usar en asunto y mensaje: §3.7.

## 3.22 Pantalla Plantillas del bot
Los mensajes del bot de WhatsApp y los ajustes de sus avisos, ordenados como los vive el vecino. Pantalla de configuración: no trabaja con un expediente concreto. Esquema fijo de la regla 25. Revisada contra el código y pintada en el banco de pruebas el 02/10/2026 (58 tarjetas).

### 3.22.1 Cómo se llega
Ruta `GET /presupuestos/plantillas-bot-flujo` (`presupuestos.cjs`, función `vistaPlantillasBotFlujo`), desde el ☰ de la cabecera. Sin parámetros.

### 3.22.2 Mapa de la pantalla, de arriba abajo
1. **Cabecera común** (§3.15.1) y el título "🤖 Plantillas del bot — por flujo".
2. **Banda FLUJO** (§3.22.3.1): la presentación a lo ancho y, debajo, una rejilla de 5 columnas, una por tipo de vecino.
3. **Banda AVISOS** (§3.22.3.2): 5 columnas de avisos.
4. **Banda EXIGENCIA CON LOS DNI EN JPG** (§3.22.3.3).
5. **Banda IA DEL BOT** (§3.22.3.4, v19.118).
6. **Banda HORARIO DE COMUNICACIONES** (§3.22.3.4 bis, v127).
7. Pie: "Todo se guarda en `bot_plantillas`".

### 3.22.3 Las cajas, una a una
Todas las tarjetas son acordeones plegados (▶): al abrir uno se ven su texto y sus casillas, y se guarda con **💾**. Una tarjeta desactivada sale en rojo. Hay dos clases de tarjeta:
- **De texto libre**: el texto que manda el bot, con su casilla **Activa**. Se guarda en `bot_plantillas` (`plantillas-bot/guardar`).
- **De Twilio** (las que empiezan por "Twilio -"): plantillas oficiales de WhatsApp, aprobadas por Meta. Aquí solo se guarda su identificador (`HX…`, se comprueba el formato); **el texto que se ve lo trae de Twilio** (`obtenerTextoTwilio`, con caché) y es de solo lectura: para cambiarlo hay que hacerlo en el panel de Twilio.

#### 3.22.3.1 Banda Flujo
- **Qué es**: el recorrido del bot con el vecino, paso a paso.
- **Qué lleva, en orden**: **Twilio - presentación** (el primer WhatsApp a un vecino), a lo ancho · **Tipo expediente** (la pregunta de qué tipo de vecino es), a lo ancho · la rejilla de 5 columnas, **01 Propietario · 02 Familiar · 03 Inquilino · 04 Local · 05 Sociedad**, con sus tarjetas en el orden en que el bot pide las cosas (bienvenida, Solicitud EMASESA, DNI por delante y por detrás de cada persona, licencia, NIF y escritura de la sociedad, autorización, contrato de alquiler, poderes, libro de familia, empadronamiento) · y al final, comunes a todos, la parte de financiación (forma de pago, bienvenida financiación, DNI del pagador, justificante de ingresos, titularidad bancaria) y **Expediente completo**.
- **A dónde va**: son los textos que manda el bot en cada paso (§6.2). Cambiarlos cambia lo que lee el vecino desde el siguiente mensaje.

#### 3.22.3.2 Banda Avisos
- **Qué es**: los mensajes que no son un paso del flujo, en 5 columnas.
- **Qué lleva**:
  - **📨 Avisos de flujo**: doc - página siguiente, doc - falta enviar, doc - varias páginas, doc - validado, doc - seguir sin opcional y las tarjetas añadidas después: las de v19.118 (abajo), **falta antes de cerrar** (`flujo_falta_antes_de_cerrar`, v127) y, desde v128, **pregunta del vecino** (`flujo_pregunta_espera`), **aviso del vecino** (`flujo_aviso_vecino`) y **«1» sin páginas** (`flujo_largo_sin_paginas`) (§6.10).
  - **📋 Avisos de resultado** (lo que contesta el bot al recibir un documento): acuse de recibo; ✅ OK (y el último); ⚠️ REVISAR (y el último); ❌ REPETIR (tres intentos).
  - **⚠️ Avisos de error**: error de mensaje y error de documento.
  - **📲 A pisos**: con el switch **W** (los que manda el bot solo): **Twilio - reenvío presentación** (con los días de sus dos reenvíos, `t_presentacion_1/2`), **Twilio - Sleep** (recordatorios por inactividad, `t_inactividad_1/2`), **Plazo - Sleep** (los tres avisos por plazo total, con sus días y su on/off), **Automático - Wake up** y, al final (v19.107: después de los de la 05), **Twilio - contrato CyCP (fase 08, botón W)** (v19.98: el HX de la plantilla con el contrato y la carta de pago, clave `contrato_cycp`, §6.17). HX aprobado el 12/10/2026: `HX22a990386a0f263b0ca05c2e15eaa1ec` (plan5_contrato_carta_pago, Utility), pegado en su casilla SID. Con el switch **M** (los que manda Guille desde HOY o desde la ficha): **Inicio doc** (`ini05`, el 💬 de inicio de la 05), **Aviso M1** (fase 05; desde v19.110 Guille lo pasa al día 10), **M2** (día 21, fase 05), **M1 de la 08** (`m1c`, día 5, v19.110), **M3** (día 11, fase 08), **M4** (envío de CyCP, fase 08) y **M5** (WhatsApp manual); la ruta `wa-manual` guarda además los textos neutros `msg_wa_m1n` / `msg_wa_m2n`. Cada M lleva su texto y, M1-M3, su día; abajo, las variables que admite ({nombre}, {piso}, {pendiente}, {vence_el}, {consecuencia}…). **Debajo (v126, criterio de Guille 18/10/2026)**, las 4 tarjetas Twilio con las que los M1/M2/M3 de HOY salen **por el bot** (§6.16): **Twilio - M1 amable (05 y 08)** (`plan5_recordatorio_m1`), **Twilio - M2/M3 amable (prórroga)** (`plan5_recordatorio_prorroga`), **Twilio - M2 duro (05)** (`plan5_aviso_vencido_doc`) y **Twilio - M3 duro (08)** (`plan5_aviso_vencido_cycp`). Mismo criterio que el contrato CyCP: **el código HX solo vive en el Sheet**; se pega en la casilla SID de su tarjeta y al guardar se crea su fila en `bot_plantillas` (`_CLAVES_NUEVAS`, variables {{1}} nombre, {{2}} vía y comunidad, {{3}} piso, {{4}} lo que falta, {{5}} fecha límite). Sin código o desactivada, la tarjeta de HOY sale con "⚠ Falta la plantilla Twilio …" y sin botón. Y la tarjeta **Twilio - Pedir contacto (robotito)** (`plan5_contacto`, v128, §3.16.3.1). Códigos que dio Alberto el 18/10/2026 (Utility, español): m1 `HX8e387bf11346cba465137643bc58dc42`, prórroga `HX0cca3e75a7d0404163394dd139da3011`, vencido_doc `HX5c9cd8134e5fd9fd6adc849841d52baa`, vencido_cycp `HX3c8abf85303545e0f3fbb1cc7c17a76b`.
  - **🛟 Al equipo** (avisos de Twilio a Guille por evento): documento a revisar, falla 3 veces, necesita un humano, expediente completo.
- **A dónde va**: los de las tres primeras columnas, a los mensajes del bot (§6). Los días de W, a los trabajos automáticos del bot (§6.5). Los M1-M5, a las tarjetas de Avisos de HOY (§3.16.3.1), al botón 💬 de cada vecino (§4.2.3.3), a la ventana Tiempos (§3.21.3.4) y a la línea de comunicaciones de la ficha. Qué hace cada M: §6.16.

#### 3.22.3.3 Banda Exigencia con los DNI en jpg
- **Qué es**: el nivel de exigencia al validar las fotos de los DNI (los 5 niveles de `EXIGENCIA_PRESETS` de `bot-whatsapp.cjs`, §6.3).
- **Dónde se guarda**: `bot_plantillas` (`plantillas-bot/exigencia`). Lo lee el bot al revisar cada foto.

#### 3.22.3.4 Banda IA del bot (v19.118, criterio de Guille 17/10/2026)
- **Qué es**: el interruptor de la IA (OpenAI) del bot: **🤖 IA del bot: DORMIDA / ENCENDIDA**, con un botón **⚡ Encender / 😴 Dormir**. Fila `ia_activa` de `bot_plantillas` (texto SI/NO; ruta `POST /presupuestos/plantillas-bot/ia`). Sin fila = dormida. El bot la lee con la caché de plantillas (tarda hasta 1 minuto en notarse).
- **Dormida** (así quedó el 17/10/2026, porque OpenAI no respondía desde el 25/08): el bot no llama a OpenAI; cada documento se acepta, queda en **REVISAR** para Guille y el vecino recibe el aviso normal de recibido (`aviso_ok`), sin mensajes de "posible problema"; no sale el aviso al equipo por cada documento; el texto libre del vecino va a **Pide ayuda** de HOY (y aviso al equipo) y, **desde v128**, el bot lo clasifica (`handleTextoLibreVecino`, §6.10): si es una pregunta o una queja contesta `flujo_pregunta_espera` y se para hasta que Guille conteste; si es un aviso («mañana lo mando») contesta `flujo_aviso_vecino` y sigue; si es corto, calla. `flujo_sin_ia` queda solo como respaldo dentro de la llamada a la IA. Se mantiene la comprobación de foto oscura/borrosa del DNI (no usa IA), y el aviso "Expediente completo" al equipo.
- **Encendida**: todo como antes (clasificación, análisis, IA de texto). Se enciende cuando Alberto confirme que la cuenta de OpenAI tiene saldo y clave válida (ver capítulo 8).
- **Tarjetas nuevas en "Avisos de flujo"** (v19.118): **doc - página recibida** (`flujo_pagina_recibida`, respuesta a cada página de un documento de varias páginas), **doc - contador** (`flujo_progreso`, variables `{n}` y `{total}`; desactivada, no sale) y **texto del vecino con la IA dormida** (`flujo_sin_ia`, variable `{siguiente}`; desde v128 la pantalla la marca como sustituida por las dos de v128). Si se borrara la fila de cualquiera de las claves de `_CLAVES_NUEVAS` (estas tres, `contrato_cycp`, las de v127/v128 y las de los avisos M por el bot, incluida `plan5_contacto`), se recrea al guardar la tarjeta.

#### 3.22.3.4 bis Banda Horario de comunicaciones (v127, criterio de Guille 20/10/2026: "el bot debería estar calladito a horas intempestivas")
- **Qué es**: **🌙 Horario de comunicaciones: L-V 9:00-20:00** (por defecto), con casillas de días (L M X J V S D), hora de inicio y de fin y **💾 Guardar**. Filas `horario_dias` (1 = lunes … 7 = domingo, separados por comas), `horario_inicio` y `horario_fin` (HH:MM) de `bot_plantillas`; ruta `POST /presupuestos/plantillas-bot/horario` (exige un día al menos e inicio antes que fin). Hora de España. Sin filas = L-V 9:00-20:00.
- **Qué hace fuera del horario**:
  - **Lo que manda el bot por su cuenta** (presentaciones y recordatorios del job de cada hora, avisos por plazo, inactividad) **no sale**: el job no hace nada y lo manda en la primera pasada con el horario abierto (§6.5).
  - **Lo que mandas tú por el bot** (aviso M con el robotito, contestar con el robotito, presentación al pasar a W o al cambiar el teléfono, contrato y carta de pago de la 08, aviso de cambio de tipo): la ventana de envío (`ptlConfirmarEnvio`) sale con una franja amarilla «🌙 Estamos fuera del horario de comunicaciones» y tres botones: **Cancelar**, **⏰ Programar para <próxima apertura>** y **Enviar ahora**. Programado, sale abajo a la derecha «⏰ Programado para …» y el aviso de HOY se da por hecho igual que al enviarlo.
  - **Texto libre** (contestar con el robotito, o un aviso M con el texto cambiado): solo se puede programar si su **ventana de 24 h sigue abierta** cuando abra el horario (la ventana lo mira con el último mensaje del vecino, `ultVecino` de `/presupuestos/hoy/conversacion`); si no, solo «Enviar ahora». Con un **archivo del PC** tampoco se puede programar (los botones toma datos y autorizacion usufructo sí). El bot lo vuelve a comprobar al programar.
  - **WhatsApp blanco** (cualquier 💬 de HOY o de la ficha): sale «🌙 Fuera del horario de comunicaciones» con **Cancelar** / **Abrir igualmente** (durante 2 minutos no vuelve a preguntar).
  - **Número del WhatsApp blanco: 634 37 96 32**. Es el que se da al vecino que pide hablar con una persona: el número del bot (Twilio) es solo WhatsApp y no admite llamadas. No aparece en el Sheet porque lo que sale del WhatsApp blanco no pasa por él.
  - **No cambian**: las respuestas del bot cuando un vecino le escribe (salen siempre), los correos y la reapertura de una ficha al marcar una F (sale en el momento).
- **Envíos programados**: pestaña **`bot_programados`** del Sheet (la crea el bot la primera vez): A id · B creado · C enviar_desde · D función · E argumentos (JSON) · F estado (pendiente / enviado / error) · G resultado · H teléfono · I descripción. El bot la mira cada 5 minutos (`procesarProgramados`) y, con el horario abierto, manda lo pendiente cuya hora ha llegado. En la conversación del vecino queda «⏰ Programado para …» al programarlo (v128: en las respuestas, con el texto entero y el nombre del adjunto, para revisar lo escrito; antes solo los primeros 80 caracteres) y, si luego falla, «⚠️ No se pudo enviar lo programado (…)». Para anular uno: poner en F cualquier cosa distinta de `pendiente`.
- **Código**: `horario-bot.cjs` (nuevo; `normalizarHorario`, `calcHorario`, que también se copia a cada página, y `textoHorario`); bot: `horarioBot`, `programarEnvio`, `enviarOProgramar`, `procesarProgramados`; presupuestos: `_refrescarHorarioP` (horario en memoria, cada 3 minutos y al guardar), `window.__ptlHorario` en `pageHtml`, `ptlConfirmarEnvio`, `ptlEsProgramar`, `ptlAvisoProgramado`. Las rutas de envío aceptan `programar=1`.

#### 3.22.3.5 Rutas de guardado
- **`plantillas-bot/guardar`**: guarda el texto de una plantilla de flujo (la que se ve por tipo: propietario/familiar/inquilino/sociedad/local) o el HX de una tarjeta de Twilio. Exige que la fila exista en `bot_plantillas`, salvo las claves de `_CLAVES_NUEVAS` (`contrato_cycp` desde v19.98 y las añadidas después, ver arriba), que se crean al guardar por primera vez.
- **`plantillas-bot/presentacion`**: la plantilla Twilio de presentación (el primer WhatsApp del bot a un vecino) y los días de sus dos reenvíos si no contesta (`t_presentacion_1/2`, §6.5).
- **`plantillas-bot/plazo`**: los tres avisos por plazo total desde el primer contacto (`t_plazo_1`, `t_plazo_urgente`, `t_plazo_fuera`, cada uno con su on/off) y su texto único `msg_plazo_1` (§6.5).
- (`plantillas-bot/avisos-tiempos` ya no existe: era una ruta sin formulario que la llamara y se quitó en v138, junto con su tarjeta `avcard`; los avisos por plazo se guardan con `plazo`.)
- **`plantillas-bot/exigencia`**: el nivel de exigencia de validación de imágenes (los 5 presets `EXIGENCIA_PRESETS` de `bot-whatsapp.cjs`, §6.3 — se configuran desde aquí, no tocando código).
- **`plantillas-bot/sleep`**: los dos recordatorios por inactividad (días sin que el vecino escriba, `t_inactividad_1/2`) y la plantilla Twilio `recordatorio` que manda el job (§6.5). No tiene nada que ver con la pausa entre envíos, que es fija en el código.
- **`plantillas-bot/wa-manual`**: texto y día de los avisos manuales a vecinos M1, M2 y M3, y texto de M4 y M5 (sin día). Qué hace cada uno, en §6.16.

### 3.22.4 Piezas compartidas
Cabecera común: §3.15.1. Switch W/M: el mismo de HOY y de Datos documentación (§4.2.3.3). No tiene botones reloj ni badges.

### 3.22.5 El código de la página
- `app.get("/presupuestos/plantillas-bot-flujo")` lee `bot_plantillas` una vez (banco de pruebas: 1 lectura), pide a Twilio el texto de las plantillas de Twilio (con caché) y llama a `vistaPlantillasBotFlujo`, que arma las tarjetas con funciones pequeñas (`card` para texto libre, `twcard` para Twilio, `wamanualcard` para M1-M5 y las de presentación, sleep, plazo y wake).
- Los días de M2 y M3 por defecto, si falta su fila, son 21 y 11 (v19.91).

### 3.22.6 Relación con el resto
- **Con el bot** (§6): todo lo de esta pantalla lo lee el bot; es su configuración.
- **Con HOY y la ficha**: los textos y días M1-M5 deciden cuándo salen las tarjetas de Avisos de HOY, qué texto abre el botón WhatsApp y qué se ve en la ventana Tiempos y en la línea de comunicaciones.
- Calendario completo de avisos: §3.9.

## 3.23 Pantalla Plantillas de documentos e Imprimir documentos
Los documentos que se imprimen para firmar (solicitudes y declaraciones de la comunidad o de un vecino): dónde se escriben sus textos (Plantillas de documentos) y cómo se rellenan e imprimen desde un expediente (Imprimir documentos). Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 3.23.1 Cómo se llega
- **Plantillas de documentos**: `GET /presupuestos/plantillas-doc` (`vistaPlantillasDoc`), desde el ☰ de la cabecera.
- **Imprimir documentos**: no es una página, es una ventana dentro de la ficha (§3.19): ☰ → "Imprimir documentos" (solo funciona estando en una ficha). Usa tres rutas: `GET /presupuestos/docs/menu`, `POST /presupuestos/docs/huecos` y `POST /presupuestos/docs/generar`.

### 3.23.2 Mapa
- **Plantillas de documentos**: cabecera común · **Encabezado global** · una tarjeta por documento, en el orden fijo de abajo · **Pie global**.
- **Imprimir documentos**: ventana en tres pasos: 1) elegir **un** documento (y el piso, si es de piso) → 2) rellenar los campos → 3) generar el PDF.
- **v128 (21/10/2026, criterio de Guille: "que ambos funcionen igual... uno imprime en pdf y otro envía por bot")**: el menú es **uno solo** para la ficha y para el robotito (`_clienteDocsModal` en `pageHtml`, `window.ptlDocsModal`). **Un documento cada vez** (antes se podían marcar varios en un PDF). En el paso 2, **👁 Ver** enseña el documento dentro de la ventana antes de imprimirlo o enviarlo (en la tablet, Chrome puede descargarlo en vez de enseñarlo). Lo que se deja en blanco sale con raya larga para rellenar a mano. **Nombre del archivo** = el del documento: «Autorización de usufructo - Tharsis 5 3IZ.pdf»; si es general, sin piso: «Mantenimiento del grupo de presión - Tharsis 5.pdf» (`generar` lo manda en `Content-Disposition` y en la cabecera `X-Nombre-Archivo`). Desde la ficha, el último botón **descarga** el PDF; desde el robotito (botón **📄 documento**, §3.16.3.1) lo **adjunta** al mensaje. Las tres rutas aceptan `comunidad` (nombre) en lugar de `id`, porque en HOY el robotito solo sabe la comunidad (`_ccppIdDocs`).

### 3.23.3 Las cajas, una a una

#### 3.23.3.1 Tarjetas de Plantillas de documentos
- **Qué es**: el texto de cada documento, con sus huecos (campos que se rellenan al imprimir).
- **Cómo se arma**: lee la pestaña `doc_plantillas` (`leerPlantillasDoc`).
- **Orden** (`ORDEN_DOCS`, el mismo que en Imprimir documentos, decisión de Guille): mantener presión · renunciar presión · usufructo · contador único · paso de instalaciones · piso disidente · piso sin documentación · piso vacío sin contrato (8 en total). Lo que no esté en esa lista va al final.
- **Campos**: **Título** (máx. 200 caracteres) · **Cuerpo del documento** (máx. 5.000) · **💾 Guardar**. Más el **Encabezado global** y el **Pie global** (filas `_ENCABEZADO_GLOBAL` y `_PIE_GLOBAL`), que van en todos los documentos.
- **Dónde se guarda y a dónde va**: en su fila de `doc_plantillas` (`POST /presupuestos/plantillas-doc/guardar`). Es el texto que sale en el PDF de Imprimir documentos.

#### 3.23.3.2 Paso 1 de Imprimir documentos: elegir
- **Qué entra**: todos los documentos de `doc_plantillas` salvo encabezado y pie, en el orden de arriba, marcados como **generales** (de la comunidad: mantener y renunciar presión) o **particulares** (de un piso). Y la lista de pisos del expediente, con propietario (nota simple) y nombre.
- Si se elige algún documento particular, hay que elegir el piso.

#### 3.23.3.3 Paso 2: rellenar los campos
- **Cómo se arma**: cada documento declara sus huecos en el código (`DOC_HUECOS`): de dónde sale su valor (comunidad, piso, datos del Sheet) o si se escribe a mano. Desde v128 se elige **un documento cada vez** (el servidor todavía aceptaría varios y pediría una sola lista de campos, sin repetir); la comunidad y el piso no se piden (los pone el programa).
- Los campos llegan **precargados** con lo que hay en el Sheet; se pueden cambiar. El campo **género** (H/M/S) cambia las palabras que dependen de él en el texto (el/la, interesado/interesada…).

#### 3.23.3.4 Paso 3: generar
- **Qué hace**: arma el **PDF del documento elegido**, con el encabezado y el pie globales, y lo descarga **con el nombre del documento** («Autorización de usufructo - Tharsis 5 3IZ.pdf»; va en `filename*` y en la cabecera `X-Nombre-Archivo`; `documentos_<comunidad>.pdf` queda solo como respaldo). No guarda nada en el Sheet ni en Drive.

### 3.23.4 Piezas compartidas
Cabecera común: §3.15.1. Imprimir documentos se abre desde el ☰ de la ficha y desde el 📄 documento del robotito; la ventana es común a todas las páginas (`pageHtml`).

### 3.23.5 El código
- Pantalla: `vistaPlantillasDoc`. Ventana: `_clienteDocsModal` (`window.ptlDocsModal`), que `pageHtml` mete en todas las páginas; `vistaFicha` solo tiene una función de una línea que la abre.
- **Qué sabe rellenar el programa**: los 8 documentos de `DOC_HUECOS` (paso de instalaciones, usufructo, mantener presión, renunciar presión, contador único, piso disidente, piso sin documentación y, desde v19.93, piso vacío sin contrato, con los mismos huecos que paso de instalaciones). Un documento que esté en `doc_plantillas` pero no en `DOC_HUECOS` sale en el menú y en la pantalla, pero no se puede generar (§9.2).

### 3.23.6 Relación con el resto
- Los datos precargados salen de la ficha del expediente (`comunidades`) y de `pisos` (nota simple, nombre): si están mal ahí, el documento sale mal.
- Cambiar un texto aquí cambia lo que se imprime desde todas las fichas. Añadir un documento nuevo **no basta con crearlo en el Sheet**: hay que declarar sus huecos en el código (`DOC_HUECOS`) y su sitio en `ORDEN_DOCS`.

## 3.24 Lo que el CRM presta a los otros ficheros (pasada §0.24, 02/10/2026)
`presupuestos.cjs` deja en `app.locals.presupuestos` **47 piezas** (recontadas en el repaso del 23/10/2026). Quién usa cada una:
- **`documentacion.cjs`** (casi todas): el acceso al Sheet (`getSheetsClient`, `SHEET_ID`), leer y escribir comunidades (`leerComunidades`, `buscarComunidadPorId`, `actualizarCampoComunidad`), `normalizarFase`, la ficha y la página (`vistaFicha`, `pageHtml`, `renderCabeceraComun`, `construirDatalists`, `sendHtml`, `sendError`, `urlT`, `esc`), pisos (`normalizarCodigoPiso`, `normalizarNombrePiso`, `normalizarTelefonoPiso`, `comparadorNaturalPiso`, `fmtTlf`), plazos y prórrogas (`PLAZO_DOC_INICIAL`/`PLAZO_CYCP_INICIAL`, `leerPlantillaMail`, `prorrogaHasta`, `cargarProrrogasHist`, `_textoPlazoBot`, `_plazoTxt05`, `_fechaContactoBot`), el resumen de documentación (`_resumenManual`, `_contarFaltan`, `_ESTADOS_IGNORA`, `_ESTADOS_HECHO`), el robotito (`_scriptVecinoBot`, v126), el nombre de la Nota simple (`_p5NombreDirigido`, v127) y `_leerRangoCorto`.
- **`bot-whatsapp.cjs`**: `normalizarFase` (filtro de fase, v19.92), `_leerRangoCorto` y `obtenerTextoTwilio` (v126, para guardar el texto exacto de cada plantilla enviada).
- **`presupuestos_plan5.cjs`**: `getImagenExpediente` (las fotos del presupuesto, §5.16) y, al cerrar un presupuesto, `buscarComunidadPorId`, `actualizarCampoComunidad`, `getSheetsClient` y `SHEET_ID` (vuelca los importes en la ficha, §5.21). (Corregido en el segundo repaso del 23/10/2026: el primero solo contó `getImagenExpediente`.)
- **`ara-os-expediente-estado.cjs` (Alberto)**: `_contarFaltanBot`, `_contarFaltan`, `_leerDocsManuales`, `_leerBotDatosHoyIndex` y `_normDirBot` (§1).
- **Nadie**: `PTO_FASES`, `fechaHito`, `lineaTiempoHtml`, `COLS`, `rowToObj`, `objToRow` (el comentario del código dice que son para el banco de pruebas) y `_migAvisosV1960` (para lanzarla a mano). `index.cjs` solo carga el módulo.

En sentido contrario, usa `app.locals.documentacion` (al entrar en 05/08, §3.2) y `app.locals.botWhatsapp` (presentación, contrato, avisos M, contestar, pedir contacto, programar…, §6). **`_leerRangoCorto`** (v19.95) es la **lectura compartida**. Una pestaña pedida por varias partes en la misma ventana de 3 s (60 s en el job del bot) se lee una sola vez; **cualquier POST del programa vacía esa memoria antes de nada** (un `app.use` registrado al principio de `presupuestos.cjs`), así que después de escribir nunca se lee un dato de antes. La usan HOY (`pisos`, `bot_documentos`, `bot_expedientes`, `documentos_manuales`: de 26 lecturas de `pisos` a 2 en el banco de pruebas), la ficha de documentación (solo para pintar; las rutas que escriben leen directo) y el filtro del bot (`pisoActivoParaBot`). Desde el 04/10/2026 los módulos de Alberto (`ara-os-expediente-estado.cjs`, Planificación) usan además `_leerDocsManuales`, `_leerBotDatosHoyIndex` y `_normDirBot`, para contar "Faltan N de M" igual que HOY (solo lectura). **Ojo al entregar `presupuestos.cjs`: Alberto también lo toca en GitHub; antes de subir, comprobar que no se pisa ningún cambio suyo** (el 04/10/2026 había añadido esas 3 líneas a la lista de exportaciones). **Cambiar el nombre o lo que devuelve cualquiera de estas piezas rompe a los otros ficheros.**

## 3.25 Trampas y peligros conocidos
- **`fasesSaltables` (cliente) y el bloque `if(fase===...)` de "Saltar envío" (servidor) deben ir sincronizados a mano** — ver §3.6. Es el mismo patrón de "dos sitios que tienen que estar de acuerdo" que en Plan 5 con `row:`/`ovkey:` (§5.10).
- **`app.locals.presupuestos` es la única puerta de entrada de `documentacion.cjs` a este fichero.** Si se renombra o se quita algo de esa lista sin avisar al capítulo de documentación, se rompe con un error de "no es función" en tiempo de ejecución, no al arrancar — no siempre salta a la vista en pruebas rápidas.
- **`objToRow` fuerza a número solo las columnas que están explícitamente en `COLS_NUM_IMPORTE`/`COLS_NUM_TIEMPO`** (§3.3) — cualquier columna de dinero/tiempo nueva hay que darla de alta ahí a mano.
- **Un envío de correo puede atascarse sin salir** (caso: presupuesto de López de Gómara 35, 14/10/2026, causa desconocida, no hay acceso a los registros de Render). La ventana espera 3 minutos y avisa de que "puede que ya se haya enviado". Qué hacer: cerrar, recargar la ficha y mirar Comunicaciones (o `mail_historico`): la fila solo existe si el correo salió. Si no está, se vuelve a enviar; en ese caso el segundo intento salió bien y quedó un solo envío.
- **`normalizarFase()` esconde toda la migración histórica de nombres de fase** (§3.2) — no hay que "limpiar" el Sheet a mano ni preocuparse por fases con nombre viejo; se resuelven solas.

## 3.26 Optimización posible (detectada, sin tocar)
Con `vistaFicha` ya revisada, lo único que llama la atención es su tamaño (~2.740 líneas en una sola función) — pero está internamente bien separada por bloques (carga de datos → acción por fase → cajas → script), así que dividirla en funciones más pequeñas sería solo orden interno, no cambiaría nada de fuera visible. No se toca sin DALE aparte, y no es urgente.

---

# 4. `documentacion.cjs`
> **Estado: completo según la lista fija de §0.24 — 7 de 7 puntos, con pasada completa del fichero, incluida toda la pantalla de la caja (filas, contadores, tipos de vecino y rutas que llama) (24/09/2026; incongruencias en §9.3)**: rutas (§4.7), pestañas del Sheet (§4.8), funciones principales (§4.1-4.5), relaciones (§4.1, §4.4, §4.8), automatismos (§4.9), configuración editable (§4.8, `documentos_manuales`) y trampas/optimizaciones (§4.10, §4.11, §9.3). La cabecera del fichero resume este capítulo (reescrita el 02/10/2026).

## 4.1 Qué es y su relación con `presupuestos.cjs`
Módulo "plug-in" sin pantalla de listado propia (el listado vive en `/presupuestos`; lo dice la cabecera del propio fichero). Toma el relevo de un expediente en cuanto pasa de `04_ACEPTACION_PTO` a `05_DOCUMENTACION`, y sigue siendo el que manda en `06_VISITA_EMASESA`, `07_PTE_CYCP`, `08_CYCP` y `09_TRAMITADA` (la ficha de un expediente en 09 también se abre por aquí).

**Relación en un sentido — `documentacion.cjs` depende de `presupuestos.cjs`**: su única ruta de pantalla, `GET /documentacion/expediente`, **reutiliza `vistaFicha` de `presupuestos.cjs`** (vía `app.locals.presupuestos`, ver §3) y le cuelga, con los parámetros `opts.extraHtmlInicial`/`extraHtmlFinal` que `vistaFicha` ya admite para eso, un banner de aviso (si faltan pisos por crear en fase 05) arriba y la caja **"DATOS DOCUMENTACION"** al final.

**Relación en el sentido contrario — `presupuestos.cjs` depende de `documentacion.cjs`**: al entrar un expediente en `05_DOCUMENTACION` o en `08_CYCP` (por `/aceptar`, `/enviar-mail` o `/avanzar`, todas por `_dispararInicializacionDocumentacion`; ver §3.2), `presupuestos.cjs` invoca `D.inicializarEstadosFase(comu, faseNueva)` (vía `app.locals.documentacion`), que rellena de oficio el estado inicial de cada documento (columnas AQ-AY de `comunidades` para los documentos de CCPP, y las correspondientes de `pisos` para los de piso) **solo si esa celda está vacía** — nunca pisa un valor ya puesto a mano.

**Reglas exactas de siembra** (`reglaCcpp`/`reglaPiso`):
- **CCPP, entrando en fase 05**: todos los documentos arrancan en "F" (falta) EXCEPTO `ccpp_contrato`/`ccpp_pago`, que se dejan sin tocar (`null`) porque en fase 05 ni se muestran.
- **CCPP, entrando en fase 08**: al revés — `ccpp_contrato`/`ccpp_pago` arrancan en "F" (ahora sí se piden), el resto se deja sin tocar.
- **Piso, entrando en fase 05**: solo 3 documentos concretos arrancan en "F" (`piso_toma_datos`, `piso_nif_toma_datos`, `piso_titularidad`) — **el resto de documentos de piso arrancan en "OP"**, no en "F" (`piso_contrato`/`piso_pago` se dejan sin tocar, igual que en CCPP).
- **Piso, entrando en fase 08**: `piso_contrato` arranca en "F"; `piso_pago` **hereda el valor de `piso_meses_financiar`** si ese campo ya tiene algo escrito, y si no, arranca en "F" — es una siembra cruzada entre dos documentos distintos, fácil de no esperar si no se conoce.

**Relación con el bot** (las dos direcciones): `documentacion.cjs` llama a ocho funciones de `app.locals.botWhatsapp` (presentación al cambiar el teléfono de un piso en W —la de pasar un piso a W la manda `presupuestos.cjs`, en `/presupuestos/piso/modo-bot`—, contrato de la 08 y sus PDF, reabrir la ficha al marcar F/INCORRECTO, cambiar el tipo de vecino, programar fuera de horario; §4.7). **Si se cambia el nombre o lo que devuelve una de ellas en el bot, se rompen los botones de esta caja.** En sentido contrario, el bot lee lo que esta caja escribe en `pisos` (estados AC-AS, tipo AW, W/M en AV) y en `bot_documentos` (marcas manuales, col H): cambiar el formato de esas celdas cambia lo que el bot pide. Columnas que escriben los dos (AM, AR, AS) y el resto de relaciones: **mapa de relaciones del capítulo 1**.

**Orden de carga obligatorio**: `documentacion.cjs` debe registrarse en `index.cjs` DESPUÉS de `presupuestos.cjs`, precisamente porque depende de `app.locals.presupuestos` (relación de arriba). Si se cambia el orden de `require()`, se rompe con el mensaje de error que el propio código deja preparado ("el módulo presupuestos no está cargado...").

**Alta automática de pisos desde el catastro de Plan 5 (al entrar en fase 05).** Dentro de `inicializarEstadosFase`, antes de sembrar los estados de piso, si la fase es `05_DOCUMENTACION` y el CCPP **no tiene ningún piso** en la pestaña `pisos`, se leen las filas del catastro de Toma de Datos (vía `app.locals.plan5.leerCatastro`, §5.9) y se da de alta un piso por cada fila **residencial** (locales y garajes se quedan fuera, se añaden a mano). Nombre: planta + puerta con el criterio de §5.9 (0A, 1DR, 1-5). Cada fila es la misma que crea "+ Añadir piso" (`guardarPiso`): comunidad, vivienda, sin nombre ni teléfono, piso en M, acordeón BOT, toma de datos y NIF en F. Justo después, el bloque normal de siembra de estados les rellena el resto de documentos como a cualquier piso.
- **Se escriben todos en una sola llamada** (`append` con todas las filas), no piso a piso: el camino de `guardarPiso` lee la pestaña entera antes de cada alta, y con 20-30 pisos seguidos podía agotar el cupo de llamadas por minuto del Sheet.
- **Nunca duplica ni pisa**: si ya hay algún piso de esa comunidad (creado a mano o por una pasada anterior), no hace nada. Retroceder a 04 y volver a pulsar ACEPTADO no crea pisos de nuevo.
- Se dispara por los tres caminos del botón ACEPTADO (enviar el correo 05-INICIO DOC, "Saltar envío", avanzar sin envío), porque todos pasan por `_dispararInicializacionDocumentacion` (§3.2). Si falla (sin catastro, dirección que no casa con Toma de Datos, error del Sheet), se registra en el log y el paso de fase sigue igual: el aviso "Faltan pisos por crear" sigue avisando y se crean a mano.

## 4.2 Pantalla: caja Datos documentación
La caja de vecinos y documentos de un expediente. No es una pantalla suelta: va dentro de la ficha del expediente (§3.19) en las fases 05 a 09. Una sola función la pinta entera, `cajitaManualHtml` (~1.600 líneas), con una fila por la comunidad y una por cada piso, todo en la misma tabla (no hay una caja de documentos y otra de vecinos). Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 4.2.1 Cómo se llega
Abriendo la ficha de un expediente en fase 05, 06, 07, 08 o 09: `GET /presupuestos/expediente` redirige a `GET /documentacion/expediente`, que pinta la ficha (`vistaFicha`) y le añade esta caja al final (§3.19.1). Desde HOY, el nombre de un piso o la dirección de un aviso llevan aquí, abierta en ese piso (`#piso-…`).

### 4.2.2 Mapa de la caja, de arriba abajo
1. **Cabecera de la caja**: título DATOS DOCUMENTACION, badge **Faltan X de Y** y botón **+ Añadir piso** (§4.2.3.1).
2. **Títulos de columna**: PISO · NOMBRE · NOTAS · TELÉFONO · DOCS.
3. **Fila de la comunidad** (§4.2.3.2), en amarillo.
4. **Filas de los pisos** (§4.2.3.3).
5. Debajo de la fila que se abra, su **acordeón de documentos** (§4.2.3.4).

### 4.2.3 Las cajas, una a una

#### 4.2.3.1 Cabecera de la caja
- **Qué es**: el resumen de la documentación de todo el expediente.
- **Cómo se arma**: el badge **Faltan X de Y** (rojo) o **✓ Completo** (verde) lo pinta el servidor con `P._contarFaltan` de `presupuestos.cjs` y el navegador lo corrige al abrir con `refrescarContadores`, que cuenta como el `_contarFaltanBot` de HOY (§3.15.4, §4.2.3.4): cuenta la comunidad y cada piso, y una fila está completa cuando tiene todos sus documentos marcados (los disidentes cuentan como hechos). **Ojo (repaso 23/10/2026, §9.3)**: al marcar un documento en el acordeón viejo o en la fila de la comunidad, el badge lo recalcula otra función más antigua (`recalcularPill`) que cuenta todos los pisos por las columnas manuales; hasta recargar puede no coincidir con HOY.
- **+ Añadir piso**: añade una fila nueva editable (piso, nombre, teléfono); se guarda con su botón ＋ (`POST /documentacion/piso/guardar`) y recarga.

#### 4.2.3.2 Fila de la comunidad
- **Qué es**: la fila "Comunidad de propietarios", con los documentos de la comunidad.
- **Cuándo sale**: siempre, la primera.
- **Qué lleva**, de izquierda a derecha: **switch W/M** de la comunidad (`bot_comunidad_activo`, §4.5) · **📄** abre su acordeón · nombre fijo · **notas del expediente** (`comunidades.notas_pto`: las mismas de HOY y de la caja Notas de la ficha en 01-04) · **docs N/M** · **botón reloj** del expediente (§3.15.3). No tiene teléfono, WhatsApp ni borrar.
- **Dónde se guarda y a dónde va**: las notas en `comunidades.notas_pto` (salen en HOY); el botón reloj en `comunidades.en_hoy`; el switch en `comunidades.bot_comunidad_activo` (`POST /documentacion/ccpp/modo`); los documentos de la comunidad en `comunidades` (columnas AQ-AY).

#### 4.2.3.3 Filas de los pisos
- **Qué es**: un vecino por fila.
- **Cómo se arma**: todos los pisos salen de la pestaña `pisos`. La cabecera del fichero lo dice: `vecinos_base` y `expedientes` **ya no se usan** — los pisos se leen todos de la pestaña `pisos` (rango `pisos!A:AX`, función `leerExpedientes()`, pese al nombre de la función; y `pisos!A:AZ` para el globo del W/M, que necesita AY y AZ). `vecinos_base` sigue viva solo para el panel viejo de `index.cjs` (§1).
- **Qué entra**: los pisos de la pestaña `pisos` de esta comunidad (`listarPisosDeCcpp`).
- **Orden**: por piso, en orden natural (`comparadorNaturalPiso`: 0A, 0B, 1A… 10A, no 1, 10, 2).
- **Qué lleva**, de izquierda a derecha: **piso** · **switch W/M** del piso (`bot_piso_activo`: W lo lleva el bot de WhatsApp, M a mano) · **📄** abre su acordeón · **nombre** · **notas del piso** (`notas_piso`, las mismas de HOY) · **teléfono** · **💬 WhatsApp** (abre WhatsApp desde el número de empresa; en 05, 07 y 08 abre un menú —en la 05 **Inicio doc** y **M5**; en 07 y 08 **M4 · Envío CyCP** y **M5 · WhatsApp manual**—, en el resto el M5 directamente, §4.8) · **🤖💬 robotito** (v126, abajo) · **docs N/M** (documentos hechos de ese piso) · **botón reloj** del piso · **＋** guardar cambios · **✕** eliminar piso.
- **Anchos (v126, criterio de Guille 18/10/2026)**: Nombre 180 px y **Notas se lleva el resto** (antes al revés: Notas 390 px fijos y Nombre el resto, con mucho hueco); la columna del 💬 pasa a 84 px para que quepa el robotito entero en la misma línea.
- **🤖💬 Robotito (v126, criterio de Guille 18/10/2026: "así tendré acceso a las conversaciones de cada vecino")**: detrás del 💬 blanco, en cada piso con teléfono. Abre el mismo recuadro que en HOY (§3.16.3.1) con **toda la conversación de ese vecino con el bot**. **Circulito azul** en la esquina: le espera una respuesta tuya (Pide ayuda sin marcar, o un mensaje suyo fuera del flujo —tipo `…_fuera` en `bot_contactos`— posterior a su última marca R de la col AZ); se quita al contestarle o al marcar el check. **Verde**: escribió al bot hace menos de 24 h; debajo se le puede contestar por el bot. **Rojo**: más de 24 h; solo leer (para decidir otra vía: llamada, correo, WhatsApp de la empresa). **Gris**: nunca ha escrito al bot; solo se ve lo que le ha mandado el bot, si algo. Las horas que quedan de las 24 h salen en el circulito («<1» o «!»). Sirve aunque en HOY ya se haya marcado el aviso. **No sale** (v127) si el teléfono es fijo (no empieza por 6 o 7) o está marcado sin WhatsApp (`bot_expedientes` col AJ) y el vecino nunca ha escrito al bot. El último mensaje de cada teléfono se lee de `bot_contactos` al abrir la ficha; el código del recuadro es el de HOY (`_clienteVecinoBot` de `presupuestos.cjs`, exportado como `_scriptVecinoBot`).
- **📧 Correo al vecino (v19.100, criterio de Guille)**: al lado del 💬, en pisos en **M** y pensado para las fases **05, 07 y 08**. **Ojo (repaso 23/10/2026, §9.3)**: en 06 y 09 también sale si hay email en las notas (y esconde el 💬), y al pulsarlo solo avisa «Falta la plantilla 08-INICIO CYCP (VECINO)». Abre el compositor de correo de la ficha ("Enviar mail manual") ya relleno con la plantilla de su fase — 05_DOC_VECINO en la 05; 08_CYCP_VECINO en 07 y 08 (§3.21) — y las mismas fechas que el 💬 (fase 05: la de la comunidad; 07: hoy + 10; 08: envío de contratos + 10, o la ampliada). El **email** se saca de las **notas del piso** (el primero que haya). **Un solo botón por piso** (criterio de Guille): con email en las notas sale solo el 📧 (se le escribe por correo; el teléfono queda para llamar) y sin email solo el 💬; cambia en el acto al escribir o borrar el email. En 07/08 adjunta solos el **contrato y la carta de pago** del piso desde Drive (`POST /documentacion/piso/pdfs-contrato`, mismas reglas de nombre que el bot, §6.17; solo el contrato si la comunidad es FFCC) y avisa si falta alguno. El compositor admite 3 adjuntos. Se revisa y se envía a mano; queda en Comunicaciones y la respuesta entra en Mails pendientes. Desde v19.102 sí hay avisos por correo en HOY: M1/M2 en 05 y M1/M3 en 08 (el M1 de la 08 desde v19.110, plantilla `08_REC_M1_VECINO`; §6.16); al pulsar su 📧 se abre esta misma ficha con el recordatorio ya escrito.
  - **Recordatorio en el mismo hilo (v19.116, criterio de Guille 17/10/2026)**: los recordatorios por correo (M1/M2 de la 05, M1/M3 de la 08) salen **como respuesta en la conversación del correo inicial** a ese vecino (el correo de vecino `05_DOC_VECINO` o `08_CYCP_VECINO` —«05-INICIO DOC (VECINO)» / «08-INICIO CYCP (VECINO)»—, el último que se le mandó a ese email en esa comunidad, con su message_id). Asunto **"Re: <asunto del inicial>"** (ya puesto al abrir el compositor; se puede cambiar) y cabeceras `In-Reply-To` = **el último correo de la conversación** y `References` = todos desde el inicial. Lo normal es que no haya contestado y vayan inicial → M1 → M2 seguidos; **si ha contestado**, el recordatorio contesta a **su contestación** (las respuestas cuentan si están clasificadas en Comunicaciones de esa comunidad, con su message_id). Sin correo inicial registrado sale como correo nuevo, como antes. Código: `_hiloVecino` y `GET /presupuestos/expediente/hilo-vecino` (presupuestos.cjs); el asunto lo pide `__ptlMailVecino` (documentacion.cjs). **v126 (criterio de Guille 19/10/2026, "como hace Gmail")**: además el cuerpo lleva **citado el correo al que contesta**, igual que la flechita ↩ Responder de Comunicaciones: debajo del texto, *"El 9 de octubre de 2026 a las 08:30, escribió:"* y el correo anterior con `> ` delante de cada línea. `_hiloVecino` devuelve `cita` {fecha, mensaje} del último correo del hilo.
- **Menú del 💬 en fase 05 (v19.102)**: como en 07/08, el 💬 del piso abre un menú: **Inicio documentación** (texto `msg_wa_ini05` con su fecha límite) y **M5**. Elegir Inicio documentación (05) o **M4** (07/08) **apunta la fecha** en `pisos` col AZ (`INI` / `M4`): así el vecino entra en la cadena de avisos y sale en el globo. Se apunta al **abrir** el WhatsApp (el programa no ve si al final se envía).
- **Globo del switch W/M (v19.102, criterio de Guille 09/10/2026)**: al pasar el ratón, **todas las comunicaciones que el programa tiene registradas con ese vecino**, por fecha (dd/mm/aa): 🤖 Presentación del bot (col J de `bot_expedientes`; si el piso está en M, "Bot apagado y pasado a manual (M)", porque al pulsar M esa fecha se machaca) · ⚠️ Sin WhatsApp (col AJ) · 💬 Recordatorio M1 / M2 marcado en HOY (cols AA / AF) · 🤖 Contrato y carta de pago por el bot (col AG) · 💬 Recordatorio M3 marcado en HOY (`pisos` col AY) · 💬 Inicio documentación / Contrato M4 (WhatsApp manual) y Recordatorio M1/M2 y M1 de la fase 08 marcados, de `pisos` col AZ · 📧 los correos al vecino de `mail_historico` (05-INICIO DOC (VECINO), Recordatorio M1/M2, 08-INICIO CYCP (VECINO), Recordatorio M3 y los correos manuales), reconocidos por "(piso)" en el asunto o, si no, por el email de sus notas cuando es de un único piso. La ficha del bot de un teléfono anterior no cuenta (como en HOY). Si no hay nada: **"Contacto no iniciado"**. Siempre termina con **"Sin registro: WhatsApp manuales (💬 M4, M5…) ni llamadas"**, porque esos no dejan rastro. En fase 08 va debajo de la frase del contrato. Al cambiar el switch sin recargar, el globo dice solo "Bot WhatsApp activo" / "Pasado a manual" hasta recargar. **Globo del switch de la comunidad**: su frase de siempre más el resumen "N vecinos: X con bot · Y por correo · W por WhatsApp manual · Z sin contacto" (con bot = tiene presentación del bot; por correo = sin bot pero con algún correo registrado; por WhatsApp manual = inicio o M4 apuntado en col AZ; sin contacto = el resto). Las fechas de la comunidad no van aquí: ya están en la línea de tiempo y la de comunicaciones de la ficha (criterio de Guille).
- **Switch W/M en fase 08 (v19.98, criterio de Guille)**: manda el contrato por el bot (§6.17). **Pulsar W**: pregunta "¿Enviar AHORA por el bot el contrato y la carta de pago del 34-0A?" (solo "el contrato" si la comunidad es FFCC; si ya se le mandó, antes dice "Ya se le envió por el bot el dd/mm/aaaa"); si se cancela, pregunta si pasarlo a M. **Pulsar M**: lo pasa a W (sin presentación) y pregunta si enviar el contrato. Globo: "Contrato enviado por bot: dd/mm/aaaa (…)", "Contrato sin enviar por bot (pulsa W para enviarlo)" o "Manual (pulsa para activar el bot y enviar el contrato)". La fecha sale de `bot_expedientes` col AG. Al terminar avisa con el texto de plazo común (v19.107, abajo), o con el motivo por el que no se envió.
- **Aviso de plazo al mandar por el bot, igual en 05 y 08 (v19.107, criterio de Guille)**: tras la presentación (05, también al cambiar el teléfono) y tras el contrato (08) sale: si es el primer envío del bot en la comunidad, "Es el primero de la comunidad: el plazo de 20 (10) días cuenta desde hoy. Fecha límite: dd/mm/aaaa."; si no, "El plazo de la comunidad empezó el dd/mm/aaaa. Fecha límite vigente: dd/mm/aaaa" y "(con prórroga)" si la hay. Una sola función, `_textoPlazoBot` de `presupuestos.cjs` (la 05 la calcula `_plazoTxt05`), exportadas en `app.locals.presupuestos`. En fase 08 tampoco se ofrece la presentación al cambiar el teléfono de un piso en W. En el resto de fases el switch hace lo de siempre.
- **Dónde se guarda y a dónde va**: cada dato en su columna de `pisos` (`POST /documentacion/piso/guardar`; eliminar, `piso/borrar`). Nombre, teléfono, notas y botón reloj son los mismos que ve HOY en las subfilas de pisos y en las tarjetas de Avisos; el teléfono es al que escribe el bot.
- **Cambiar el teléfono de un piso NO toca nada del bot** (corrección 24/09/2026: el manual decía que se sincronizaba con la pestaña del bot; ese código era del modelo antiguo y ya no existe). Solo se cambia la fila de `pisos`. **Desde v19.61 (criterio de Guille: el teléfono antiguo se olvida y se sigue con el nuevo, como un vecino nuevo)**: si el piso está en W y el teléfono cambia, al pulsar ＋ el programa pregunta, igual que al pasar a W, "¿Enviar AHORA el mensaje de presentación al teléfono nuevo?"; si se acepta, el bot presenta al número nuevo (si ese número ya tenía ficha, no la repite). La ficha del teléfono antiguo queda como historial: el bot ya no le contesta (no está en ningún piso) y HOY no le saca avisos (M1, M2, pide ayuda, completo solo salen si el teléfono de la ficha es el actual del piso). Para el bot el nuevo es un vecino nuevo: le pedirá la documentación desde el principio; lo ya entregado sigue en la caja de la ficha. Caso que lo motivó: Otelo 8, 1DCHA (Desiré 627 100 844 → Guillermo 605 939 475), que salía dos veces en Avisos.
- **Detección de cambios sin guardar**: en todas las filas de piso (piso, nombre y teléfono son casillas editables, también en las que vienen del Sheet), `actualizarDirty(fila)` compara el texto actual del formulario contra una foto guardada al abrir la fila (`filaToString` vs `originalToString`); si difieren, marca la fila como "sucia" (`ptl-vec-dirty`) y activa el botón guardar. En cuanto hay alguna fila sucia en toda la tabla, `actualizarFlagSalir` engancha un aviso del navegador (`beforeunload`) para que salir de la página sin guardar pida confirmación. **Trampa real ya corregida en el código (v18.36)**: recargar la página tras guardar usa `location.replace` de la misma dirección con `_r=<hora>` añadido, nunca un `reload()` normal — un `reload()` deja que el navegador intente "restaurar" el formulario con lo que había antes de recargar, y eso podía borrar las notas de otros pisos sin querer.

#### 4.2.3.4 Acordeón de documentos
- **Qué es**: la lista de documentos de la comunidad o del piso, cada uno con su pastilla de estado.
- **Cuándo sale**: al pulsar 📄 en una fila.
- **Qué documentos salen, según la fase**: en **05, 06 y 07** se ocultan los 4 de contrato y carta de pago; en **08 y 09** esos 4 salen arriba como bloque principal (en ZZ-RECHAZADO y ZZ-DESCARTADO la caja no se pinta, `FASES_SIN_CAJITA`) y el resto debajo, en estilo tenue (consultivo, pero editable). Detalle en §4.5. **Desde v19.98 también en el acordeón nuevo**: en 08/09/ZZ los pisos del acordeón nuevo muestran arriba Contrato y Pago (las mismas pastillas y columnas AR/AS que el viejo) y debajo, tras "Documentación previa", lo de la 05; y su "docs N/M" y el "Faltan X de Y" cuentan contrato y pago, como los del viejo (en la caja, `refrescarContadores`, que corrige en el navegador el badge que pinta el servidor con `P._contarFaltan`; en HOY, `_contarFaltanBot` de `presupuestos.cjs`). Antes no salían y contaban los documentos de la 05: no se notaba porque las comunidades que habían llegado a 08 eran todas del acordeón viejo.
- **Dos acordeones distintos**: el **nuevo** (todo lo que nace desde la migración, se lleve a mano o por el bot) muestra solo los documentos del tipo de vecino elegido; el **viejo** (pisos anteriores a la migración) muestra el checklist completo. Cuál sale y por qué: §4.3.
- **Estados y cómo se corrigen**: pastillas verde OK, ámbar REV, rojo INC/F; cada una tiene un menú **solo con sus estados** (desde v19.93 no hay "Ver" ni "Adjuntar", criterio de Guille). Obligatorios: OK · Revisar · Incorrecto · F; opcionales: OK · Revisar · Incorrecto · vacío; Nota simple: Pte · OK · F; Disidente: vacío · OK; Forma de pago: Contado · 6 · 12 · 18 · FFCC · IPREM (Contado = casilla vacía en `pisos` col AM). **Contrato y Pago** (pastillas del bloque de 08): Contrato OK · REVISAR · F · vacío; Pago OK · REVISAR · F · 6 · 12 · 18 · FFCC · IPREM · vacío. **REVISAR** (v19.98) se ve como **REV** en ámbar: lo pone el bot al recibir el contrato firmado o el justificante (§6.17); no cuenta como hecho en "Faltan X de Y" (hasta que Guille lo pase a OK), pero el M3 y el texto `{pendiente}` lo dan por recibido (§6.16). De dónde salen los estados (`bot_documentos`) y cómo se escriben: §4.4.
- **Campos que siempre son a mano**: Nota simple (titular), Disidente y meses de financiación (`POST /documentacion/manual/marcar`, directo en `pisos`). Cómo se rellena un disidente, ex-disidente o documentación incompleta: §4.6.
- **Piso añadido estando ya en 08 (v19.107)**: nace con Contrato y Pago en F, como los que existían al pasar a 08. Antes nacía con las dos vacías: el bot no le pedía el justificante y no salía el aviso de revisar (caso del piso PRUEBA, 12/10/2026).
- **Dónde se guarda y a dónde va**: estados de documentos del bot en `bot_documentos` (`bot/marcar`); tipo de vecino en `pisos.piso_tipo` (`piso/tipo`); los manuales en `pisos` o `comunidades`. De estos estados salen el "Faltan X de Y" de aquí y de HOY, los avisos M3 de HOY (contrato y carta de pago, §3.16.3.1) y lo que el bot le sigue pidiendo al vecino (§6).

### 4.2.4 Piezas compartidas
- Botones reloj (expediente y piso): §3.15.3.
- Badge Faltan X de Y: catálogo §3.15.4 (misma fuente que HOY).
- Switch W/M: el mismo de HOY en 05 y 08 (allí solo informativo, §3.16.3.3).

### 4.2.5 El código de la caja
- `cajitaManualHtml` arma la caja; `filaManualHtml` pinta cada fila (comunidad y pisos); un `<script>` propio maneja acordeones, pastillas, guardados y el menú de WhatsApp.
- **Lecturas al abrir**: `pisos` de la comunidad (y `A:AZ` para el globo), `bot_expedientes` (datos del bot por piso y, `A:AE`, el circulito de Pide ayuda), `bot_documentos` (estados), `documentos_manuales` (lista de documentos), `bot_contactos` (último mensaje de cada teléfono, para el robotito), `mail_historico`, `bot_plantillas` y las plantillas de correo. **Desde v19.93 ya no borra duplicados** de `bot_documentos`: se quedan todos los documentos que suba el vecino y la pastilla enseña la fila más reciente (§4.4).
- **Trampa de estilo**: el código de esta caja usa nombres de clase con sufijo `-manual` (`ptl-vec-card-manual`, `ptl-vec-doc-btn-manual`, `ptl-vec-tbody-manual`, `ptl-vec-btn-anadir-manual`) que **no están en `estilo-visual.cjs`** — tienen su propio `<style>` local dentro de este mismo fichero (buscar `ptl-vec-card-manual` en el fichero), scoped solo a esta caja. Es correcto y funciona bien, pero al buscar dónde se define el estilo de algo de esta tabla, mirar aquí primero, no en `estilo-visual.cjs` (§2).

### 4.2.6 Relación con el resto
- **Con HOY**: el Faltan X de Y de 05 y 08, las notas del expediente y de los pisos, los botones reloj, el verde de los avisos M1/M2 (piso con toda su documentación) y los avisos M3 salen de estos mismos datos.
- **Con el bot** (§6): comparten `bot_documentos` y el switch W/M; el bot pide al vecino lo que aquí falta.
- **Con la ficha** (§3.19): va dentro de ella; cambiar `vistaFicha` afecta a esta caja y al revés.
- Avisos a vecinos M1-M5: §6.16. Cómo se rellena un disidente: §4.6.

## 4.3 El sistema de acordeones — viejo (histórico) vs nuevo
El acordeón 📄 de cada fila es en realidad DOS sistemas distintos. **OJO, la distinción real NO es "modo MANUAL vs modo BOT" del piso**, es "acordeón VIEJO (histórico) vs acordeón NUEVO (todo lo que nace desde la migración)". Es un ejemplo real de la costura "antes/después del bot" que se documenta como norma general en §1 y §0.22.

**El disparador**, `acordeonBot`, se calcula así (variable `acordeonBot`): es `true` si se cumple CUALQUIERA de estas 4 condiciones —
- (a) la columna `acordeon` del piso en el Sheet vale literalmente `"BOT"` (columna AX de `pisos`, añadida en v18.90 — **el interruptor de migración en sí**),
- (b) el piso está de verdad gestionado por el bot de WhatsApp (`bot_piso_activo === "BOT_WHATSAPP"`),
- (c) el piso ya tiene un `piso_tipo` elegido (propietario/familiar/inquilino/sociedad/local — el desplegable "Tipo" del acordeón nuevo),
- (d) ya hay datos del bot para ese piso aunque hoy no esté activo.

Es decir: **el nombre "Bot" del interruptor es heredado de cuando nació, pero hoy ya no significa "lo lleva el bot" — significa "usa el acordeón nuevo"**. Confirmado con Guille: desde la migración, **todos los expedientes nuevos nacen con el acordeón nuevo**, se vayan a llevar luego a mano o por el bot — el acordeón viejo (`DOC_LABELS`/`renderAcordeon`) ya no se usa para nada nuevo, solo lo conservan los pisos que ya lo tenían antes de la migración, como registro histórico.

**Acordeón VIEJO** (histórico, de antes de v18.90) → `renderAcordeon()` (cliente) pinta `dataDocsPiso`, que llega ya preparado **desde el servidor**, construido con la pestaña **`documentos_manuales`** (§4.8). *(Corregido en el repaso del 23/10/2026: el manual, y el comentario de cabecera del código, decían que salía de `DOC_LABELS`; esa tabla de `documentacion.cjs` ya no la usa nada.)* Es el checklist completo y genérico: todos los documentos posibles (propietario, alquiler, empresa, financiación...) juntos en la misma tarjeta (así se ve en la primera captura que compartió Guille, expediente "Diego Puerta 5" — un expediente anterior a la migración).

**Acordeón NUEVO** (todos los que nacen ya, manuales o bot) → `renderAcordeonBot()` (cliente) pinta `TIPOS_BOT`, una lista **aparte**, definida dentro del propio `<script>` de este fichero , que refleja **exactamente** los mismos flujos y textos que usa el bot de verdad (`FLOWS`/`REQUIRED_DOCS` de `bot-whatsapp.cjs`, §6.2) — solo el documento que corresponda al tipo elegido, no todo junto. Comprobado que su texto para `dni_administrador` (`"DNI representante"`) coincide con el de `bot-whatsapp.cjs`, no con el de `DOC_LABELS` del propio `documentacion.cjs` (que dice `"administrador"`) — es decir, `TIPOS_BOT` está sincronizada a propósito con el texto del bot, aunque el piso en cuestión se acabe llevando a mano.

**Traducción de códigos entre los dos mundos**: el bot separa cada DNI en dos fotos con códigos distintos (`dni_administrador_delante`/`dni_administrador_detras`), mientras que `TIPOS_BOT` los trata como una sola fila con `faces:true`. La tabla `BOT_FACE_CODES` (justo debajo de `TIPOS_BOT`) hace esa traducción para los 5 casos de DNI (propietario, inquilino, familiar, administrador, pagador) — con un matiz: el DNI del propio propietario en el flujo `propietario` usa los códigos "pelados" `dni_delante`/`dni_detras` en el bot (sin `_propietario`), mientras que en los demás flujos (familiar, inquilino) el propietario sí lleva el prefijo — `BOT_FACE_CODES` contempla ese caso especial con dos alternativas por código.

**Consecuencia práctica**: la divergencia de `DOC_LABELS` que se documenta en §9.3 (entre `documentacion.cjs`, `bot-whatsapp.cjs` e `index.cjs`) **no es la misma cosa** que el texto que se ve en el acordeón nuevo — ese pasa por `TIPOS_BOT`, no por `DOC_LABELS`. `DOC_LABELS` de `documentacion.cjs` ya no alimenta nada (ni el acordeón viejo, que sale de `documentos_manuales`): es código muerto. Tocarla pensando en igualarla al bot no tendría ningún efecto. **Lo que sí son copias que deben ir a la par** es `TIPOS_BOT`/`BOT_FACE_CODES`/`botContarPiso` de esta caja y su réplica en `presupuestos.cjs` (`_TIPOS_BOT`, `_BOT_FACE_CODES` y la cuenta de `_contarFaltanBot`, que usa HOY; su comentario dice «reflejarlo aquí»): cambiar una sin la otra separa el «Faltan X de Y» de HOY del de la ficha (§9.2).

## 4.4 El circuito de documentos del bot — de "se pide" a "Guille lo ve"
Leído y confirmado a fondo (19/09/2026). Esto es la relación más profunda con `bot-whatsapp.cjs` (§6), más allá de compartir los flujos (`FLOWS`, reflejados en `TIPOS_BOT`).

1. **Origen del reparto de trabajo**: el bot y `documentacion.cjs` nacieron como dos módulos separados, cada uno con su propia forma de nombrar los documentos (el bot separa cada DNI en `_delante`/`_detras`; `documentacion.cjs` lo trata como una fila única con `faces:true`). Al unirlos hizo falta una tabla de traducción entre los dos idiomas — `BOT_FACE_CODES` (§4.3) es esa tabla.
2. **Dónde vive el estado real**: ni en `pisos` ni en `comunidades` — hay una pestaña de Sheet dedicada solo a esto, **`bot_documentos`** (columnas A:L), con una fila por cada documento de cada piso: comunidad, vivienda, código de documento, fecha, url del archivo en Drive, de dónde vino (col H: el origen que pone el bot al clasificar —p. ej. `bot_fase08` en la 08—, o `manual` cuando la fila la escribe la ficha al marcar Guille un estado; la ruta antigua que adjuntaba archivos a mano, `bot/adjuntar`, ya no existe), y el estado (OK/REVISAR/INCORRECTO...). **Confirmado que `bot-whatsapp.cjs` lee y escribe esta misma pestaña** (lecturas con `A:L`, `A:K`, `A:I`, `A:F` y `A:D`, y el alta de cada documento con `append`; col A teléfono, E nombre del archivo) — es la tabla compartida real entre los dos módulos, no `DOC_LABELS` ni ninguna otra.
3. **Cómo lo lee `documentacion.cjs`**: cuando se abre el acordeón de un piso con el sistema nuevo, `indexBotDocs(dp)` coge el array `dp.botDocs` (ya cargado de esa pestaña) más `dp.descartadosBot`, y arma un índice por código de documento, quedándose con el registro más reciente si hay varios, **salvo que Guille lo haya dado por bueno a mano (OK o "no aplica"): esa marca manda sobre todo lo que llegue después por el bot y sobre las caras sueltas del DNI (v19.112)**. `estadoSwitchBot`/`TXT_BOT`/`COL_BOT` traducen ese estado a la pastilla de color que se ve en pantalla (verde OK, ámbar REV, rojo INC/F).
4. **Guille puede corregir el estado de CUALQUIER documento a mano, incluso en un piso del bot**: cada pastilla tiene un menú con los estados (ruta `POST /documentacion/bot/marcar`). Si ya hay fila de ese documento, cambia su estado, le pone la fecha del momento y la marca como `manual` en la col H (desde v19.112); si no, añade una con `fuente="manual"`. Desde v19.93 no se pueden adjuntar ni ver archivos desde aquí (criterio de Guille).
5. **Ojo, no todo lo del acordeón nuevo pasa por `bot_documentos`**: la "Nota Simple" (`piso_titularidad`), el switch "Disidente" y la elección de financiación (`piso_meses_financiar`) son campos que **siempre se llevan a mano**, esté el piso en el sistema que esté — el bot nunca los pregunta por WhatsApp. Estos van por otra ruta (`POST /documentacion/manual/marcar`), que escribe directo en las columnas de la pestaña `pisos`, no en `bot_documentos`.
6. **Varias filas del mismo documento** (criterio de Guille, v19.93): se quedan todas, buenas y malas; Guille las revisa. Ya no hay limpieza automática (antes, al abrir la ficha, se borraban todas menos la más reciente, y podía borrarse la buena). La pastilla y el "Faltan X de Y" de HOY usan la fila **más reciente** (`indexBotDocs` / `_indexBotDocs`).

## 4.5 Modo CCPP y los modos visuales por fase
**Modo CCPP**: `MANUAL` o `BOT_WHATSAPP` (`POST /documentacion/ccpp/modo`, función `cambiarModoCcpp`). Los expedientes nuevos nacen en `BOT_WHATSAPP` (§3.18), y pasar cualquier piso a W pone también la comunidad en W. **El bot no mira este interruptor**: solo mira el del piso y la fase (§6.1). El de la comunidad solo cambia cómo la tratan HOY, los badges y alguna variable de correo (§3). No es irreversible sin más — se puede volver de `BOT` a `MANUAL` sin problema **mientras ningún vecino concreto esté ya en modo bot (W)**; el candado real salta solo cuando al menos un piso ya está en W (`bot_piso_activo === "BOT_WHATSAPP"`), porque en ese punto el bot ya le está escribiendo a ese vecino y no tiene sentido echarse atrás. Con el CCPP marcado BOT pero cero pisos aún en W, sí se puede deshacer.

**Dos "modos visuales" de la caja según la fase**, controlados dentro de `cajitaManualHtml` (no son dos funciones, es la misma con una rama interna): **modo 05** (fases 05/06/07_PTE_CYCP) esconde los 4 documentos de contrato/pago; **modo 07** (fase 08_CYCP en adelante) los saca arriba como bloque principal y manda el resto de documentos abajo en estilo "tenue" (consultivo, pero editable).

## 4.6 Cómo se rellena un piso disidente, ex-disidente o con documentación incompleta
Criterio de Guille (01/10/2026), para que se haga siempre igual. Se rellena en la caja DATOS DOCUMENTACION de la ficha (§4.2): el nombre del piso, la pastilla **Disidente** del acordeón y las Notas.

| Caso | Nombre del piso | Pastilla Disidente | Notas |
|---|---|---|---|
| **Disidente**: no entra en el expediente | `DISIDENTE` (solo esa palabra, nada más) | OK | libre |
| **Ex-disidente**: se declaró disidente y después entregó la documentación y se le tramita | el nombre del vecino, como cualquier otro piso | **sin marcar** | `EX-DISIDENTE` (sin fecha: un ex-disidente siempre es tardío) |
| **Documentación incompleta**: falta algo, pero no se ha declarado disidente | el nombre del vecino | **sin marcar** | `DOCUMENTACION INCOMPLETA`, con el detalle que haga falta entre paréntesis |

**Regla de comprobación**: la pastilla Disidente en OK y el nombre `DISIDENTE` van siempre juntos; nunca uno sin el otro.

**Por qué el ex-disidente va sin marca**: el programa trata a los marcados como disidentes de forma distinta. No les saca el aviso M3 de fase 08 ni les reclama contrato y carta de pago (§6.16), y su carta de pago la abona la comunidad (§3.9). Un ex-disidente se tramita como un vecino normal, así que necesita todo eso. El historial queda en Notas.

**Cómo revisarlo en el Sheet** (cuando Guille lo pida): en la pestaña `pisos`, cruzar la columna E (`nombre`) con la AQ (`est_piso_disidente`, la pastilla Disidente) y mirar la AU (`notas_piso`). Hay que listar:
- los pisos con AQ = OK cuyo nombre no sea exactamente `DISIDENTE`;
- los pisos llamados `DISIDENTE` sin AQ = OK;
- los pisos con `EX-DISIDENTE` o `DOCUMENTACION INCOMPLETA` en Notas que tengan AQ = OK.

Cada caso se resuelve preguntando a Guille cuál de los tres es.

## 4.7 Rutas del fichero
Todas exigen token (`checkToken`: en la URL o en el cuerpo del envío).
- **`GET /documentacion/expediente`**: la ficha de un expediente en fase 05 o posterior. Es la ficha de `presupuestos.cjs` (`vistaFicha`) con el aviso "Faltan pisos por crear" arriba (fase 05 sin pisos) y la caja DATOS DOCUMENTACION al final.
- **`POST /documentacion/piso/guardar`**: alta o edición de un piso (número, nombre, teléfono). Normaliza con las reglas de `presupuestos.cjs` y rechaza un número repetido en la misma comunidad.
- **`POST /documentacion/piso/borrar`**: borra la fila del piso en `pisos`. No borra nada del bot ni de Drive.
- **`POST /documentacion/ccpp/modo`**: interruptor M/W de la comunidad (§4.5).
- **`POST /documentacion/bot/marcar`**: cambiar el estado de un documento del acordeón nuevo, en `bot_documentos` (§4.4). Si el estado es INCORRECTO o F y el vecino ya había terminado con el bot, **reabre su ficha** (`reabrirSiFinalizado`, v19.114): vuelve a pedirle ese documento con sus recordatorios; desde v19.118 además le manda en el acto la plantilla Twilio "recordatorio" con lo que le falta (solo si el piso está en W y en fase 05) y marca la col AB de `bot_expedientes` (`REABIERTA <fecha>`) para que siga saliendo "Completo · revisar" en HOY mientras le quede algo en REVISAR. **v127 (criterio de Guille 19/10/2026, caso Ardilla 9 0-7)**: si el vecino **aún no había terminado** (sigue en el flujo) no hay nada que reabrir; por eso el bot, **antes de cerrar la ficha** (respuesta a la forma de pago), vuelve a mirar lo recibido: si falta algún documento **obligatorio** (Guille lo puso en F o INCORRECTO mientras tanto), **no la cierra ni avisa de "Expediente completo"**: le dice en el acto qué falta (texto `flujo_falta_antes_de_cerrar` de Flujo bot, variable `{falta}`) y debajo la petición de ese documento. Los opcionales no frenan el cierre. (`bot/adjuntar` se quitó en v19.93.)
- **`POST /documentacion/manual/marcar`**: estado de un documento que se lleva siempre a mano (CCPP, nota simple, disidente, financiación, contrato, pago), en `comunidades` o `pisos`.
- **`POST /documentacion/piso/tipo`**: tipo de vecino del acordeón nuevo (propietario, familiar…), en `pisos` col AW. **Desde v126** (criterio de Guille: "quiero poder cambiar yo el tipo y que se actualice lo que necesita") además, si el vecino tiene ficha del bot, el **bot pasa a ese tipo** (`cambiarTipoVecino`): recalcula lo que le falta con lo ya recibido (lo mandado no se vuelve a pedir; los DNI del propietario cuentan en cualquier tipo) y sigue por el siguiente documento; si ya había pasado la pregunta de financiación y con el tipo nuevo no le falta nada, se queda donde estaba. Vacío o "disidente" no cambian el bot. Devuelve lo que le falta y la página ofrece, con la ventana común **Cancelar / Enviar** (con su conversación), avisarle por el bot.
- **`POST /documentacion/piso/tipo-aviso`** (v126): manda al vecino lo que le falta tras el cambio de tipo, con la plantilla Twilio `recordatorio` (vale dentro y fuera de las 24 h; `avisarCambioTipo`); queda en su conversación.
- **`POST /documentacion/piso/pdfs-contrato`** (v19.100): body `ccpp_id`, `vivienda`. Devuelve los enlaces de Drive del contrato y la carta de pago de ese piso (`buscarPdfsContratoPiso` del bot) y avisos si falta alguno o hay dos. Lo usa el botón 📧 en 07/08.
- **`POST /documentacion/piso/enviar-contrato`** (v19.98): el botón W en fase 08 (§4.2.3.3). Body `ccpp_id`, `vivienda`. Solo en `08_CYCP` (si no, 400). Calcula la fecha límite del mensaje: si es el **primer contrato del bot en la comunidad** (`contratosBotComunidad`, col AG de `bot_expedientes`), hoy + `PLAZO_CYCP_INICIAL` (10); si no, fecha de envío de contratos (AZ) + 10, o la ampliada si hay prórroga concedida (`_p5ProrrogaConcedida` + días de `08_ULT_AVISO`), igual que M3/M4. Llama a `enviarContratoPiso` del bot (solo contrato si `est_ccpp_pago` = FFCC). **Si el envío sale y es el primero de la comunidad** (punto 7 del diseño, criterio de Guille: el plazo cuenta desde el primer contrato del bot, como la 05 desde el primer mensaje): pone `fecha_envio_contratos_pagos` (AZ) = hoy y, si el cron de la 08 aún no ha mandado ningún seguimiento automático (`mails_enviados` − `mails_manuales` de `08_CYCP` = 0), pone también `mails_ultimo_envio["08_CYCP"]` = hoy, para que los seguimientos cuenten desde ahí. Como todo lo de la 08 cuenta desde AZ (correos, badges, M3, M4, prórroga, Tiempos, línea de tiempo), todo se mueve a la vez. Si no hay ningún contrato del bot, todo sigue como antes (AZ = paso a 08). **Ojo**: si el correo 08-INICIO CYCP salió otro día, su fecha límite no coincidirá con la del WhatsApp; los contratos por el bot conviene mandarlos el mismo día que se pasa a 08.

La caja usa también estas rutas de `presupuestos.cjs`: `/presupuestos/piso/guardar-notas-hoy` y `/presupuestos/piso/guardar-nota-simple` (notas y Nota simple), `/presupuestos/piso/modo-bot` (switch W/M del piso), `/presupuestos/expediente/campo` (notas y reloj de la comunidad), `/presupuestos/piso/toggle-hoy` (reloj del piso), `/presupuestos/hoy-bot-llamado` (marcas de la col AZ) y `/presupuestos/expediente/hilo-vecino` (cita del correo anterior). **Programar (v127)**: `piso/guardar`, `piso/tipo-aviso` y `piso/enviar-contrato` aceptan `programar=1` y pasan por `bot.enviarOProgramar`, para dejar el envío programado fuera del horario del bot (§3.22.3.4 bis).

## 4.8 Pestañas del Sheet y configuración
- **`pisos`**: la lee entera (`A:AX`) para la caja, y `A:AZ` para el globo del W/M; escribe el alta y edición de pisos (editar reescribe `A:AB` entera con lo leído justo antes; el alta pone además AV=MANUAL, AX=BOT y, si la comunidad está en 08 o 09, AR/AS=F), la siembra, los estados manuales (AC-AS), `piso_tipo` (AW) y el alta automática desde catastro. Todavía tiene columnas del modelo antiguo del bot (estado, documentos recibidos/pendientes, AA/AB) que ya no usa nadie (§9.3, punto 8).
- **`comunidades`**: lee `A:AY` y escribe los estados de documentos de la comunidad (AQ-AY), el modo M/W y, al mandar el contrato por el bot (`piso/enviar-contrato`), `fecha_envio_contratos_pagos` (AZ) y `mails_ultimo_envio` (§4.7).
- **También lee al abrir la ficha**: `bot_contactos!A:D` (último mensaje de cada teléfono, para el robotito), `mail_historico!A:F` (correos al vecino, para el globo) y las plantillas de correo de vecino con `P.leerPlantillaMail`.
- **`bot_documentos`**: lee los documentos que ha recibido el bot (por comunidad + vivienda) y escribe los ajustes a mano (`bot/marcar`); desde v19.93 no borra nada (§4.4).
- **`bot_expedientes`**: solo lectura (`A:AK` desde v19.102, para el globo del W/M; `A:AI` desde v19.98): tipo de vecino, opcionales descartados, fecha del primer WhatsApp de cada piso (fecha de arranque de la fase 05 para el mensaje del botón de WhatsApp) y fecha del contrato enviado por el bot (col AG, globo del botón W en 08).
- **`bot_plantillas`**: solo lectura, los textos del botón de WhatsApp de cada vecino (§6.16): **M5** (WhatsApp manual, en cualquier fase; desde v19.103 sin textos de respaldo: si falta, el botón avisa), **Inicio doc** en la 05 y, **en fases 07 y 08, también M4** (envío de contrato y carta de pago). En la 05 el botón abre un menú con **Inicio doc** y **M5**; en 07 y 08, con **M4 · Envío CyCP** y **M5 · WhatsApp manual**; en el resto de fases abre directamente el M5. El M3 **no** va en el menú (se probó en v19.34 y se quitó en v19.35 por criterio de Guille): es el aviso automático de fase 08 en HOY, igual que M1/M2 en fase 05 (ver tabla en §6.16). Los textos se rellenan en el servidor con las variables de §6.16 (`{pendiente}` sale de los estados de contrato y pago del piso; `{vence_el}` y `{prorroga_nota}` de la fase y de si la prórroga se concedió de verdad).
- **`documentos_manuales`**: **la configuración editable de la caja**, directamente en el Sheet (no hay pantalla): qué documentos se piden a la comunidad y a cada piso, con su código, nivel (CCPP/PISO), texto, orden, si admite financiación y si está activo. Se guarda en memoria 1 minuto (v19.92; antes 15). Si la pestaña falla, la caja lo dice ("configura documentos_manuales"). **Trampa (repaso 23/10/2026)**: la columna de `pisos`/`comunidades` de cada documento es **su posición en la lista de activos ordenada** (AC + n para pisos, AQ + n para la comunidad): reordenar o desactivar una fila de esta pestaña corre todas las de detrás. Y la casilla «activo» vacía cuenta como activa en esta caja pero como no activa en HOY (`_leerDocsManuales` solo acepta «SI»), §9.3.

## 4.9 Automatismos
- **Siembra de estados y alta de pisos al entrar en 05 u 08** (`inicializarEstadosFase`, §4.1): la dispara `presupuestos.cjs` al cambiar de fase.
- No tiene temporizadores propios: todo lo que hace solo ocurre al abrir una ficha o al cambiar de fase.

## 4.10 Limitación conocida y trampas
- **Los dos acordeones permiten cambiar estados, por rutas distintas**: el viejo con sus botones (`ptl-vec-doc-btn-manual` → menú → `POST /documentacion/manual/marcar`, estados OK / F / vacío y los menús de contrato, pago y meses); el nuevo con `bot/marcar` (§4.4). Corregido en el repaso del 23/10/2026: el manual decía que el viejo era solo de ver. La ruta que nunca se llegó a conectar (`documento/marcar`) se borró el 02/10/2026.
- **Ya no hay limpieza automática de duplicados** (desde v19.93, §4.4 punto 6): `bot_documentos` crece con cada documento que llega; la pastilla manda la fila más reciente (o la marca manual, v19.112).
- **La lista de documentos (`documentos_manuales`) se guarda en memoria 1 minuto** en esta caja; HOY (`presupuestos.cjs`, `_leerDocsManuales`) la lee con una memoria de 3 segundos (la lectura compartida de la petición). Un cambio en esa pestaña tarda como mucho un minuto en verse en la caja (§4.8).
- **La siembra cruzada `piso_pago` ← `piso_meses_financiar`** al entrar en fase 08 (§4.1) — fácil de no esperar si se toca `inicializarEstadosFase` sin conocerla.
- **El JS de la caja va dentro de un texto del servidor** (plantilla con comillas invertidas): un salto de línea dentro de un `alert`/`confirm` se escribe `\\n` en el fichero, no `\n` (con `\n` el navegador recibe un salto real dentro de la cadena y la página entera deja de funcionar). Comprobar siempre pintando la ficha y pasando `node --check` a sus `<script>` por separado (§7.2).

## 4.11 Optimización posible
Ver §9.3 — análisis completo con estado y dependencias de cada punto.

---

# 5. `presupuestos_plan5.cjs` — EL MOTOR DE PLAN 5
> **Estado: completo según la lista fija de §0.24 — 7 de 7 puntos, con pasada completa del fichero, incluido todo el código de las dos pantallas (croquis y catastro incluidos) (24/09/2026; incongruencias en §9.4)**: rutas (§5.20), pestañas del Sheet y servicios externos (§5.21), funciones principales (§5.0-5.19), relaciones (§5.21), automatismos (§5.21: no tiene; lo único que ocurre solo es el volcado de datos económicos al congelar), configuración editable (§5.10, §5.21) y trampas/optimizaciones (§5.18, §9.4).

## 5.0 Mapa de dependencias (de dónde sale cada dato, a dónde va)

```
CATASTRO (Toma de Datos, tabla planta/puerta)
   │
   ▼ se cuenta al importar y al recalcular
zonas.resto[].n  (nº de plantas real que alcanza cada puerta)
   │
   ├──▶ Nº de viviendas en pantalla (Toma de Datos)
   ├──▶ Aviso amarillo "los peines suman X, se esperan Y"
   ├──▶ Altura real de cada PEINE (_alturaPeine, mira qué puerta tiene el peine)
   │        │
   │        ├──▶ Días de peine vertical (Corte 1/2 por plantas, §5.10 y §5.12)
   │        ├──▶ Días de enganche exterior / interior fácil (Corte 1/2 por plantas, §5.10 y §5.12)
   │        └──▶ Metros de tubo/codos/chapa reales del peine (geomPeine/vivPeine)
   │
   └──▶ _p5Entrada(saved)  ← FUNCIÓN ÚNICA, la llaman los dos de abajo:
            │
            ├──▶ Mediciones en vivo (pantalla, tabla de costes editable)
            └──▶ PDF impreso (Memoria, Análisis de Subvención, Presupuesto)
                     (el PDF, para los EUROS, en realidad no recalcula nada:
                      llama por dentro al mismo motor de Mediciones — por
                      eso los dos SIEMPRE dan el mismo número, es diseño)

plan5_mediciones (Sheet, columna "valor")
   │  gm(concepto, parametro) y similares (§5.10), con valor de repuesto si no existe la fila
   ▼
Factores de coste (tiempos, tramos, Corte 1/2...)
   │
   └──▶ calcConexion / calcAlimentacion / calcCuarto / calcMontantes
            (si Guille cambia un valor aquí, afecta a TODOS los presupuestos
             nuevos o recalculados; NO afecta a uno ya cerrado)

columna H del Sheet (overridesCantidad / overridesDato)
   │  por presupuesto, no global
   ├──▶ Mediciones (pinta la casilla en ámbar, manda sobre el cálculo)
   └──▶ Toma de Datos (§5.8, SOLO overridesCantidad — lee esto para saber
        si un peine ya está "puesto a mano" y pintarlo verde en el aviso)
```

**Para saber dónde tocar algo**: si el problema es "un número está mal", primero mirar si depende del catastro (arriba del todo) o de un factor del Sheet (bloque de en medio) — son fuentes distintas y no se corrigen igual. Si el problema es "esto no se ve igual en pantalla que en el PDF", casi seguro es que alguien construye el dato sin pasar por `_p5Entrada` (ver §5.5).

## 5.1 Pantalla Toma de Datos
El formulario donde se recogen los datos del edificio para hacer el presupuesto de Plan 5. **De aquí sale todo** el cálculo (mapa de dependencias, §5.0). Las otras pantallas de Plan 5 tienen su propio apartado: Mediciones (§5.2) y el documento del presupuesto (§5.3). Esquema fijo de la regla 25. Revisada contra el código el 02/10/2026.

### 5.1.1 Cómo se llega
Ruta `GET /plan5?dir=<dirección>&id=<ccpp_id>` (`presupuestos_plan5.cjs`; la página es el texto `TOMA_DATOS_HTML`, que se pinta en el navegador). Desde la ficha del expediente: ☰ → **📋 PRESUPUESTO PLAN 5** (§3.19.1). Desde Mediciones, con su menú.

### 5.1.2 Mapa de la pantalla, de arriba abajo
1. **Barra propia de Plan 5** (no es la cabecera del CRM): título de la pantalla · ↶ deshacer · ↷ rehacer · 🔄 recargar · **☰ menú de Plan 5**: TOMA DE DATOS · MEDICIONES · IMPORTAR CATASTRO (solo en Toma de Datos) · IMPRIMIR PRESUPUESTO · ← Volver al expediente. Y el **candado** 🔓/🔒 (§5.1.3.1).
2. Si el presupuesto está cerrado: aviso **"🔒 PRESUPUESTO CERRADO · fecha. Edición bloqueada. Pulsa el candado para abrirlo."**
3. Siete cajas, en este orden: **Datos del presupuesto** · **Datos económicos** · **Tipo de edificio** · **Tipo de instalación** · **Tipo de peines** · **Condiciones particulares** · **Catastro y croquis**.

### 5.1.3 Las cajas, una a una
Todas guardan **solas al cambiar un campo** (`plan5GuardarTodo` → `POST /plan5/guardar`), con un destello en el campo; todo va a la fila de la obra en `plan5_toma_datos` (por dirección), columna **G** (`datos_json`). Con el presupuesto cerrado, todo queda bloqueado.

#### 5.1.3.1 Datos del presupuesto
- **Campos**: Nº de presupuesto · Fecha · revisión **congelada** y revisión **actual** del motor (`p5revCong` / `p5revAct`, §5.17) · tipo de vía, dirección, población, CP · administrador (teléfono, correo) · presidente (teléfono, correo).
- **De dónde salen**: los datos de la comunidad vienen de la ficha del expediente (`comunidades`, §3.19.3.4).
- **Candado**: 🔓 abierto (verde) / 🔒 cerrado (rojo). Cerrar congela una foto del desglose y del cuadro económico y bloquea la edición; abrir tiene tres modos (§5.4, §5.18).

#### 5.1.3.2 Datos económicos
- **Qué es**: el cuadro de importes del presupuesto, en dos columnas: **Tradicional** y **Plan 5** (con subvención de EMASESA).
- **Cómo se arma**: lo calcula el motor a partir de Mediciones (`/plan5/desglose?format=json`, `actualizarCuadro`), cada vez que cambia algo.
- **Qué lleva**: tiempo de ejecución · **% Bº tradicional s/venta** (el único editable, por defecto 25 %; desde v132 admite 8 caracteres y enseña hasta 5 decimales, para cuadrar al céntimo presupuestos pasados del Excel antiguo) · % Bº materiales y mano de obra · coste total, mano de obra, materiales, albañilería, grupo de presión · presupuesto total y total con IVA, beneficio, % beneficio y €/hora de mano de obra, de cada columna · subvención total · total con subvención e IVA · importe por comunero · cuotas a 6, 12 y 18 meses · importe financiable.
- **Columnas**: se ven las dos, pero **no se elige**: el cuadro de abajo (subvención, total, comunero) y el volcado al expediente usan siempre **Plan 5** (02/10/2026, criterio de Guille: se quitó la elección, que no se guardaba ni llegaba al expediente).
- **A dónde va**: al **cerrar** el presupuesto (candado), Plan 5 escribe en la ficha del expediente (`comunidades`) el PTO total (columna Plan 5), la mano de obra, el material y el tiempo previstos, y el beneficio previsto (columna AB). Por eso, con Plan 5, esos campos salen en gris en la ficha (§3.19.3.7) y alimentan las cajitas económicas de HOY.

#### 5.1.3.3 Tipo de edificio
- **Campos**: Nº de plantas · altura de planta · **Nº de suministros** · tipo de edificio · locales con y sin suministro, número y tipo · viviendas con más de una entrada y cuántas · reparto de viviendas por zona (baja, resto, ático) · puntos de agua de comunidad, número y tipo.
- **Cómo se cuentan las viviendas**: §5.6 y el catálogo de repartos, §5.7.

#### 5.1.3.4 Tipo de instalación
- **Campos**, por bloques: **acometida** (situación de la llave en acerado, ubicación y número del contador, llaves de corte) · **tubo de conexión** (longitud propuesta, material y diámetro actuales, con la pastilla de válido) · **tubo de alimentación** (longitud o "solo piecería", montaje, codos de termofusión, material) · **cuarto de contadores** (ubicación, tipo de armario, batería 1 y batería 2) · **grupo de presión** actual y nuevo (motores, potencia, calderín, depósitos, ubicación, tiempo de montaje, tubo de expulsión) · **tiempos** (montaje de peines, otros tiempos con su explicación, otros trabajos en euros).
- **Reglas de cálculo que usan**: tubo de conexión y alimentación, §5.14.1-§5.14.2 y diámetros, §5.21; cuarto y armario, §5.14.3; grupo de presión y su catálogo, §5.14.5 y §5.15; otros tiempos, §5.14.6.

#### 5.1.3.5 Tipo de peines
- El aviso de peines (`avPeines`, §5.13) y la lista de peines del edificio. Modelo y reglas: §5.11-§5.12 y §5.14.4.

#### 5.1.3.6 Condiciones particulares
- Un texto libre que sale en el documento del presupuesto (§5.3).

#### 5.1.3.7 Catastro y croquis
- **Catastro**: la lista de viviendas del edificio (puerta, equipamiento, número, tipo), traída del Catastro (☰ IMPORTAR CATASTRO, §5.9) y editable.
- **Croquis**: un lienzo con herramientas (lápiz, línea, goma, símbolos y **Borrar todo**) para dibujar el edificio, los peines y los símbolos (baterías…). Cada peine lleva su tipo, giros extra, enganche, interior/exterior y recorrido. Detalle: §5.11 (modelo de los peines) y §5.21 (símbolos del croquis). "Borrar todo" pide confirmación antes de borrar (v19.92). Con el presupuesto cerrado, el lienzo y todos sus botones, Símbolos incluido, quedan bloqueados.

### 5.1.4 Piezas compartidas
- No usa la cabecera del CRM: tiene su barra y su menú propios, comunes a las pantallas de Plan 5 (`PLAN5_MENU_JS`).
- Estilos propios de Plan 5 (`getPlan5Css`, §2.2).

### 5.1.5 El código de la página
- La página es un texto enorme dentro del fichero (`TOMA_DATOS_HTML`, ~113.000 caracteres) que el servidor rellena con los datos guardados (`window.__PLAN5_SAVED__`) y el menú. Al tocarlo, comprobar también su `<script>` aparte (§7.2, punto 3).
- Guardado: `POST /plan5/guardar` (columna G); cierre y apertura: `/plan5/cerrar` y `/plan5/abrir`; cálculo: `/plan5/desglose?format=json`. Columnas G, H, I y su modelo: §5.4.

### 5.1.6 Relación con el resto
- **Con la ficha del expediente**: se entra desde ella, se vuelve a ella, toma de ella los datos de la comunidad y, al cerrar, le escribe los importes previstos (que luego ven HOY y el listado).
- **Con Mediciones**: Mediciones parte de lo que hay aquí (`_p5Entrada`, §5.5) y aquí se ve su cuadro económico.
- **Con el documento del presupuesto**: lo que se imprime sale de estas dos pantallas.

## 5.2 Pantalla Mediciones
La tabla de costes del presupuesto: cada partida con su cantidad, precio y total, por capítulos, editable línea a línea para esta obra. Es el mismo cálculo que da el cuadro económico de Toma de Datos (§5.1.3.2) y los euros del documento impreso (§5.3). Esquema fijo de la regla 25. Revisada contra el código y pintada en el banco de pruebas con el Excel (C Virgen de Loreto 9, cerrada y reabierta con “Editar a mano”) el 02/10/2026.

### 5.2.1 Cómo se llega
Ruta `GET /plan5/desglose?dir=<dirección>&id=<ccpp_id>` (`presupuestos_plan5.cjs`, función `p5DesgloseHandler`; la página es el texto `DESGLOSE_HTML`). Desde el ☰ de Plan 5 → **MEDICIONES** (en Toma de Datos o en la propia Mediciones). La obra se busca por la dirección (`dir`), no por el id (§9.4, punto 1); el id solo sirve para el enlace “← Volver al expediente”. Con `format=json` la misma ruta no pinta la página: devuelve el desglose, el cuadro económico, el estado y el cierre (así la usan Toma de Datos, el candado y el impreso).

### 5.2.2 Mapa de la pantalla, de arriba abajo
1. **Barra propia de Plan 5** (la misma de Toma de Datos, §5.1.2): título MEDICIONES · ↶ deshacer · ↷ rehacer · 🔄 recargar · ☰ menú de Plan 5. **No tiene candado**: se cierra y se abre desde Toma de Datos.
2. **Avisos** (§5.2.3.1): solo si el presupuesto está cerrado.
3. **La tabla** (§5.2.3.2), con los títulos de columna fijos al bajar: CONCEPTO · DATO · CANTIDAD · UD · DETALLE · PRECIO · TOTAL.

### 5.2.3 Las cajas, una a una

#### 5.2.3.1 Avisos
- **Presupuesto cerrado**: “🔒 PRESUPUESTO CERRADO · fecha y hora. Edición bloqueada (ábrelo desde Toma de datos).”, y todas las casillas de la tabla quedan desactivadas.
- **No sale** la lista de avisos del motor (peines sin valorar, tipos de peine no reconocidos…): el servidor la manda (`dsg.avisos`), pero se pinta en el aviso de Tipo de peines de Toma de Datos (§5.13), no aquí.

#### 5.2.3.2 Tabla de partidas
- **Qué es**: todas las partidas del presupuesto, con su cálculo.
- **Cuándo sale**: siempre. Si a la Toma de Datos le falta el nº de suministros, el tipo de edificio o la longitud del tubo de conexión, sale vacía con el texto “El motor de calculo aun no esta conectado. Rellena viviendas y longitud en Toma de datos.”
- **Cómo se arma**, según el estado del presupuesto:
  - **Abierto**: se calcula en el momento con el motor (`calcular` sobre `_p5Entrada(saved)`, §5.5), los precios de `plan5_precios` y los parámetros de `plan5_mediciones` con los valores propios de la obra (columna H) encima. Después se aplican las cantidades y precios propios de la obra y se rehace el total de cada capítulo y el cuadro económico (`paso5_agregacionYMargenes`, `paso6_emasesaNeto`) con las cantidades que se ven, para que cuadren con la tabla.
  - **Cerrado**: se sirve la foto congelada (columna I, §5.4) tal cual, sin calcular nada. Lo único que se refresca de la foto es el nombre de capítulo de presupuesto de cada línea, que se lee siempre de `plan5_mediciones`.
- **Qué entra y en qué orden**: los capítulos en este orden fijo, y cada uno solo si tiene alguna línea (salvo 1.1, que sale siempre): **1.1 TUBO DE CONEXION** · **1.2 TUBO DE ALIMENTACION** · **1.3 CUARTO DE CONTADORES** · **1.4 MONTANTES** · **3 GRUPO DE PRESION** · **OTROS TIEMPOS / TRABAJOS**. Dentro de cada capítulo, en el orden en que las crea su función de cálculo (§5.14), salvo **1.4**, que se reordena solo a la vista para que el material y la mano de obra del mismo trabajo vayan juntos (tubo, codos, sujeciones, llaves, peines H, V-INT, V-EXT, aislamiento y chapa, y al final los enganches). Salen también las líneas a 0 (sacos, segunda batería cuando no la hay…), igual que en el cálculo. Cada capítulo acaba con su fila **TOTAL**.
- **Cada fila**, de izquierda a derecha:
  1. **Concepto**. Al pasar el ratón, el capítulo del presupuesto impreso al que va (“1.3.4 Accesorios y pequeño material”…).
  2. **Dato** (solo en algunas líneas, abajo): el parámetro con que se calcula esa línea.
  3. **Cantidad**, editable.
  4. **Ud** (de `plan5_precios`).
  5. **Detalle** (la variante: diámetro, modelo, tipo). A los números sueltos se les añade “mm”.
  6. **Precio**, editable.
  7. **Total** = cantidad × precio.
- **La columna Dato**, tres formas:
  - **Factor**: un número con su unidad, o una frase (“incremento de medición en un 10 %”, “1 sujección cada 2 m”, “un agujero cada 4 m”). Sacos y losa por metro (1.1 y 1.2), metros por agujero del falso techo (1.2 y peine H), % de accesorios y desmontaje del contador (1.3), y en 1.4 merma del tubo, sujeciones, guías, tornillos, albañilería de peine H, V-INT, doblado de chapa y enganches interior medio y difícil.
  - **Tramos**: la escala entera en una línea, “0 → [días] → tope → [días] → tope…”, con el tramo que aplica a esta obra en **verde**. En metros: fontanero y albañil del tubo de conexión y del de alimentación. En plantas (con “X plantas o más” al final): peines V-EXT y enganches exterior e interior fácil (§5.12).
  - **Texto**: el modelo del grupo de presión (solo lectura).
  - Algunos se muestran en otra unidad que la guardada: los días en **horas** (× 8) y el % de accesorios en % (× 100); al guardar se vuelven a pasar a días o a fracción.
- **Colores**:
  - **Ámbar en Cantidad**: la obra tiene una cantidad propia para esa línea (aunque coincida con la calculada).
  - **Ámbar en Precio**: la obra tiene un precio propio **distinto** del de la tarifa de hoy. Como al cerrar se congelan todos los precios (§5.4), al reabrir solo salen en ámbar los que han cambiado en la tarifa desde entonces.
  - **Ámbar en Dato**: el parámetro de la obra es **distinto** del general de hoy de `plan5_mediciones`.
- **Cómo se edita**:
  - **Cantidad y Precio**: al entrar en la casilla se ve el número sin formato; al salir (o con Intro), si cambió, se guarda. **Vaciarla borra el valor propio** y la línea vuelve a lo calculado o a la tarifa de hoy.
  - **Dato**: igual, al salir de la casilla. Vaciarlo vuelve al general de hoy.
  - Tras guardar, se vuelve a pedir el desglose entero al servidor (`format=json`) y se repinta la tabla; la casilla se pone verde (guardado) o roja (error).
  - **↶ / ↷ deshacen y rehacen los cambios de Dato, Cantidad y Precio** (v19.92). Deshacer el primer cambio de una casilla que no tenía valor propio la deja vacía: vuelve a lo calculado o a la tarifa de hoy.
- **Dónde se guarda y a dónde va**: todo en la columna **H** de la fila de la obra en `plan5_toma_datos`, cada cosa en su cajón (§5.4): Cantidad → `POST /plan5/mediciones/override` (`cantidad`), Precio → `/precio-override` (`precio`), Dato → `/dato-override` (`dato`). Se guarda solo para esta obra; los valores generales están en el Sheet (§5.10). De aquí salen el cuadro económico de Toma de Datos, el aviso de peines de Toma de Datos (lee las cantidades propias, §5.8 y §5.13), la foto que se congela al cerrar y, a través de ella, los datos que Plan 5 vuelca en la ficha del expediente (§5.21) y el documento impreso.

### 5.2.4 Piezas compartidas
- Barra y menú de Plan 5 (`PLAN5_MENU_JS`): los mismos de Toma de Datos (§5.1.4). Desde Mediciones el menú no ofrece IMPORTAR CATASTRO (solo tiene sentido en Toma de Datos).
- Estilos: `getThemeCss` + `getPlan5Css` (§2) y un `<style>` propio de la tabla.
- Pintado verde/rojo de guardado: las mismas clases `ptl-guardado-ok` / `ptl-guardado-error` del resto del programa.

### 5.2.5 El código de la página
- **Servidor**: `p5DesgloseHandler` hace todo: lee la fila (`leerFila`, con `_p5Propios` para la columna H y `_p5MergeSnap` para la I), decide foto o cálculo, arma las líneas capítulo a capítulo con funciones pequeñas (`pintarCapAli`, `pintarCapCuarto`, `pintarCapMont`, `pintarCapGP`, `pintarCap`; la 1.1 va suelta) y les pone su Dato, aplica los valores propios, calcula el cuadro y pinta o devuelve JSON. El enlace entre una casilla Dato y su fila de `plan5_mediciones` va por `row` → `med.keyOf` (trampa de §5.10); la 1.1 lleva ya la clave escrita.
- **Lecturas del Sheet al abrir** (banco de pruebas): abierto, `plan5_toma_datos`, `plan5_precios` y `plan5_mediciones`, una vez cada una; cerrado, `plan5_toma_datos` y `plan5_mediciones` (solo para los nombres). Cada cambio de una casilla añade una lectura y una escritura de la fila, más un desglose completo.
- **Cliente**: un `<script>` dentro de `DESGLOSE_HTML` (`render`, `datoCell`, y los guardados `commit`, `commitQty`, `commitPrecio`). Al tocarlo, comprobar su bloque aparte (§7.2, punto 3).
- **Fallos** pendientes: §9.4, puntos 17, 23 y 24. Los restos encontrados se quitaron el 02/10/2026.

### 5.2.6 Relación con el resto
- **Con Toma de Datos**: se calcula con lo que hay allí (`_p5Entrada`) y su cuadro económico es el de aquí; el aviso de peines de Toma de Datos lee las cantidades propias de aquí. Cerrar y abrir (el candado de Toma de Datos) cambian lo que se ve aquí: foto o cálculo, y qué valores propios se conservan (§5.18.1).
- **Con el documento impreso** (§5.3): saca sus euros llamando a esta misma ruta (`format=json`), así que los dos dan siempre el mismo número.
- **Con la ficha del expediente**: lo que se cambia aquí llega a la ficha solo al volver a cerrar (§5.21).
- **Con el Sheet**: los generales (`plan5_mediciones`, `plan5_precios`) afectan a todas las obras abiertas; los valores propios de aquí, solo a esta. Cambiar el nombre de un concepto en `plan5_mediciones` rompe su enlace con el código (§9.4, punto 23).

## 5.3 Pantalla Presupuesto (documento impreso)
El presupuesto completo para imprimir o guardar en PDF y mandar a la comunidad: portada, memoria, tabla de precios, condiciones, subvención, fotos, documentación que se pide e impresos. Esquema fijo de la regla 25. Revisada contra el código y pintada en el banco de pruebas con el Excel (C Virgen de Loreto 9, cerrado) el 02/10/2026.

### 5.3.1 Cómo se llega
Ruta `GET /plan5/presupuesto?dir=<dirección>&id=<ccpp_id>` (`presupuestos_plan5.cjs`; la página la arma `renderPresupuesto`). Desde el ☰ de Plan 5 → **IMPRIMIR PRESUPUESTO**, que la abre en otra pestaña. Existe también `/plan5/presupuesto/<nombre>`, igual (el nombre no se usa). Sin `id` no hay datos de la comunidad ni fotos (§5.3.3.1 y §5.3.3.5).

### 5.3.2 Mapa del documento, de arriba abajo
1. **Barra de pantalla** (no se imprime): “Presupuesto - Nº” y el botón **🖨 Imprimir / Guardar PDF** (`window.print()`).
2. En **todas las hojas**, arriba el logo y abajo la línea “Presupuesto Nº … (fecha)(revisión)”.
3. Las hojas, en este orden fijo (algunas solo si toca):
   1. **Portada** (§5.3.3.1).
   2. **1.- Memoria de la Instalación** (§5.3.3.2), una o más hojas.
   3. **2.- Presupuesto general de la Obra** (§5.3.3.3).
   4. **Condiciones, firma y formas de pago**, apartados 3 a 8 (§5.3.3.4).
   5. **Análisis de Subvención** (§5.3.3.5), si el motor tiene datos.
   6. **Fotos** (§5.3.3.6).
   7. **9.- DOCUMENTACIÓN (de la Comunidad)** (§5.3.3.7).
   8. **Impreso para toma de datos** de EMASESA (§5.3.3.7).
   9. **Documento del grupo de presión**: mantenimiento o renuncia, si toca (§5.3.3.8).
   10. **Autorización de paso de instalaciones**, si toca (§5.3.3.8).
   11. **Anexo de financiación de Prodinamia**, dos hojas, sin la cabecera y el pie comunes (§5.3.3.9).

### 5.3.3 Las cajas, una a una
Ninguna se edita aquí: todo es solo lectura. Lo que se quiera cambiar se cambia en Toma de Datos, en Mediciones, en la ficha del expediente o en las plantillas.

#### 5.3.3.1 Portada
- **Qué lleva**: el título del Plan 5 · ficha con Nº de presupuesto, fecha, dirección, nº del edificio, población, C.P., provincia (siempre Sevilla), nombre, correo y teléfono · los datos de la empresa (fijos en el código).
- **De dónde sale**: Nº, fecha y dirección, de la fila de la obra en `plan5_toma_datos` (columnas C, D y A); el resto, de la ficha del expediente (`comunidades`, por el `id`). **Nombre, correo y teléfono son del administrador si lo hay; si no, del presidente.** Un dato vacío sale como “— (pendiente del expediente)”.

#### 5.3.3.2 1.- Memoria de la Instalación
- **Qué lleva**: **A) Descripción del edificio** (plantas, altura del último receptor, toma de comunidad, edificio, distribución e identificación de las viviendas, acometida, tubo de conexión, contador, abastecimiento actual, grupo y aljibe) · **B) Descripción del abastecimiento propuesto** (grupo nuevo, diámetros, longitudes, materiales y trazado de los tubos, llave general de corte, y una descripción por partidas: acometida, conexión, alimentación, batería, montantes, grupos, aislamiento, albañilería) · **C) Plazo de ejecución**.
- **De dónde sale**: de la Toma de Datos guardada (columna G) y del catastro (`_p5memoria`). Reglas de texto: “ABASTECIMIENTO ACTUAL” e “IDENTIFICACIÓN DE LAS VIVIENDAS”, §5.6; grupo de presión y depósitos, §5.15; llaves de corte, §5.12.
- **Frase del armario de la batería** (`armarioTxt`): “Se colocará(n) [en nuevo armario de obra / de aluminio / en cuarto existente, según el tipo de cuarto], [ubicación, en minúscula], con puertas de acceso [de hierro / de aluminio, salvo cuarto existente] dotadas de rejillas de ventilación y cerradura normalizada por Emasesa.” Desde la **Rev-25.1** lleva siempre una segunda frase fija que cubre el caso de EMASESA sin tener que preguntar nada en la Toma de Datos: si el armario queda en un recinto con puerta de acceso cerrada, la cerradura va en esa puerta y el armario lleva pestillo. Si algún día EMASESA exige que el presupuesto diga cuál de los dos casos es, haría falta una casilla nueva en la Toma de Datos.
- **Plantas de la batería 1** (`_p5plantasBatM`, v133): con locales declarados, las filas del catastro de uso no residencial no añaden su planta a la frase de la batería 1, que ya dice «locales» (Sánchez Pizjuán 6: «para las plantas 1ª, 2ª, 3ª, locales y toma de comunidad»).
- **Grupo de presión en la Memoria** (Rev-25.1, 15/10/2026, criterio de Guille): **A) describe lo que hay y B) lo que se hace.**
  - **A) "TIENE GRUPO HIDRONEUMÁTICO"**: "Sí." seguido de las características del grupo actual (motores, potencia, calderín y depósitos o aljibe, `_gpCaractAct`), o "No.". El Sí/No se decide, como siempre, por si la casilla de motores actuales tiene algo escrito (Guille la deja vacía cuando no hay grupo; se decidió no cambiar ese criterio). Si la casilla de potencia ya trae "KW", no se duplica.
  - **B) "GRUPOS DE PRESIÓN"**: si se mantiene, solo "Se mantiene el existente (se adjunta documento de mantenimiento)."; si se instala uno nuevo, sus características como siempre (`_gpDescNuevo`, con "reutilizando…" cuando se aprovechan los depósitos existentes); si se renuncia, la frase de renuncia con su documento. Los documentos de mantenimiento y renuncia que se adjuntan no cambian (§5.3.3.8).

#### 5.3.3.3 2.- Presupuesto general de la Obra
- **Qué lleva**: la tabla por capítulos del presupuesto (1 Fontanería exterior, 2 Albañilería y varios, 3 Grupo de Presión, 4 Aislamiento térmico de montantes, 5 Estudio, medidas y elementos de seguridad) con sus subcapítulos y partidas: denominación, material, diámetro, precio, cantidad y suma. Al final, Total, 10 % de IVA y Total Presupuesto.
- **De dónde sale**: **de Mediciones** (se llama por dentro a `/plan5/desglose?format=json`, §5.2): si está cerrado, de la foto; si está abierto, del cálculo de ese momento. Por eso el total coincide siempre con Mediciones y con Toma de Datos. Los precios salen **en venta**: cada línea con el margen de material o de mano de obra (`_p5tablaPresupuesto`; por qué un cambio en una línea mueve las demás, §5.18.2, causa 3). Los nombres de capítulo, de `plan5_mediciones`.
- **Textos de la columna material** (en minúscula desde la Rev-25.1; en la Memoria las mismas frases siguen en mayúscula porque allí abren frase): tubo de conexión “el existente de … es válido.” o “no existe.” según la longitud propuesta; alimentación “no existe.” si es solo piecería; armario “cuarto existente” (o “obra, puertas hierro”, etc.); **1.5.1 cerradura “homologada por EMASESA”** (desde v128 con su **cantidad y precio unitario de venta** —coste de la tarifa + % Bº materiales—: 2 cerraduras → «65,00 € — 2 ud — 130,00 €»; antes, como partida de albañilería, salía el total como precio y «1 ud»; las demás partidas 2.x siguen así; `celdasLinea`); grupo y depósitos, con su descripción (§5.15). **Ojo con los textos largos**: esa columna no parte líneas; un texto largo (por ejemplo, en “2.6 Otros trabajos extra”) ensancha la tabla y Firefox encoge todo el presupuesto para que quepa (caso López de Gómara 35, 14/10/2026). Las explicaciones largas van en Condiciones particulares.
- **Nombre impreso distinto del capítulo interno** (`_NOMBRE_IMP` en `_p5tablaPresupuesto`, Rev-25.1): la línea 1.5.1 se imprime como “Cerradura”, pero su capítulo interno sigue siendo “1.5.1 Cerradura homologada armario-batería”, porque es la clave que la une con `plan5_mediciones` y `CAPS_PRESUPUESTO`. Si se renombrara el capítulo, los presupuestos ya guardados perderían la línea de la cerradura. Para cambiar cómo se imprime una línea, se toca `_NOMBRE_IMP`, nunca el capítulo.

#### 5.3.3.4 Condiciones, firma y formas de pago
- **Qué lleva**: apartados **3.- Documentación**, **4.- Normas de aplicación**, **5.- Personal**, **6.- Seguro de responsabilidad civil**, **7.- Garantía de los trabajos** y **8.- Validez del presupuesto** (textos fijos del código, `_p5paginasLegales`; el 8.6 con la compensación del 10 % y la cuenta). **APAÑO TEMPORAL (v134 y v136)**: solo el presupuesto **O25-ARA/00213 (Sánchez Pizjuán 6)** imprime la cláusula 8 antigua de la Rev-18, en un párrafo (`_cl8antigua` / `_cl8`), y sin la línea inclinada `fhueco` antes del recuadro de importes y firmas, para que quepa en la misma hoja. Se quita cuando Guille diga (§8). Después, las **Condiciones particulares** de la Toma de Datos (§5.1.3.6; si están vacías, unas por defecto). Firma: “Conforme Presupuesto”, con subvención, importe por comunero, fecha, y las casillas de firma del presidente (“NO ADMINISTRADOR”) y de la empresa. **Formas de pago**: contado por comunero; financiado por comunero a 6, 12 y 18 meses; financiado por la comunidad (máximo 120 meses).
- **De dónde sale**: los importes, del cuadro económico de Mediciones (§5.14.7).

#### 5.3.3.5 Análisis de Subvención
- **Cuándo sale**: si el cuadro tiene los datos de EMASESA (no sale con la Toma de Datos sin completar).
- **Qué lleva**: dirección de la finca · nº de viviendas y locales (suministros menos la toma de comunidad) · importe del presupuesto, de la acometida y de las cuotas y fianzas · subvención y bonificaciones · importe neto · reparto por comunero por tipo de contador (13, 15, 20 mm y comunidad; el motor solo rellena 13 mm) · resumen al contado · fecha. Fórmulas: §5.14.7.
- **Desde v19.93**: el "Suministro nº" sale en blanco (al hacer el presupuesto no se conoce; si EMASESA lo necesita, lo rellena). La columna de **13 mm** cuenta los contadores que se instalan: viviendas + locales **sin** suministro (los que tienen suministro no se instalan ni entran en el reparto); es el mismo número entre el que se reparte el importe por comunero. La nota del pie dice "previstos para el año …" con el **año de la fecha del presupuesto** (las tarifas siguen siendo las de 2026).

#### 5.3.3.6 Fotos
- **Qué lleva** (desde la Rev-26): 9 fotos y el croquis. Arriba, a la derecha del catastro, las fotos 1 a 6; abajo, el **croquis ocupando el sitio de dos casillas** y a su derecha las fotos 7, 8 y 9 (las tres con etiqueta PEINE). La casilla DISTRIBUCIÓN sale siempre; el dibujo del croquis, solo si la obra tiene croquis (`_hasCroq`). **Desde v135 la hoja cabe siempre en una página**: la caja del catastro lleva `contain:size` (su alto lo marcan las fotos; las filas en blanco de relleno que no caben se recortan) y, si ni las filas con datos caben (Sierpes 46, 64 pisos), un script baja la letra de la tabla de 0,25 en 0,25 px hasta que entra la última (`tr.p5last`). Cada foto la pide el navegador a `/plan5/imagen` con el `id` del expediente, que la trae de Drive. Mecanismo completo: §5.16.

#### 5.3.3.7 Documentación de la comunidad e impreso de EMASESA
- **9.- DOCUMENTACIÓN (de la Comunidad)**: lo que se pide a la comunidad (presupuesto firmado por el presidente, listado de pisos, solicitud a EMASESA, NIF, acta de nombramiento, aprobación del presupuesto en acta con la redacción sugerida, impreso del grupo de presión, última factura, autorización de paso si procede), con el Nº, la fecha y el importe ya escritos en la redacción del acta.
- **Impreso para toma de datos** (“Plan Cinco”): el impreso de EMASESA a nombre de la COMUNIDAD DE PROPIETARIOS, con la dirección y la fecha ya puestas, para que lo firme el presidente.

#### 5.3.3.8 Documentos del grupo de presión y de paso de instalaciones
- **Grupo de presión**: con grupo actual y sin grupo nuevo, el de **mantenimiento**; sin grupo actual ni nuevo, el de **renuncia**; si se instala grupo nuevo, ninguno. Textos de `doc_plantillas` (`mantener_presion`, `renunciar_presion`), con el encabezado y el pie globales, los mismos de Plantillas de documentos (§3.23). Si la plantilla está desactivada, no sale.
- **Paso de instalaciones**: solo si las Condiciones particulares contienen la frase “paso de instalaciones a través de su propiedad.” (sin distinguir tildes ni mayúsculas). Texto de `doc_plantillas` (`paso_instalaciones`).

#### 5.3.3.9 Anexo de Prodinamia
- Dos hojas sobre la financiación de la comunidad con Prodinamia (quién es, cómo funciona, condiciones válidas por encima de 5.000 €), con los importes del presupuesto (`_p5anexoProdinamia`).

### 5.3.4 Piezas compartidas
- Números: los de Mediciones (§5.2) y el cuadro económico de Toma de Datos (§5.1.3.2), por la misma función.
- Textos de `doc_plantillas`: los mismos de Plantillas de documentos (§3.23).
- Fotos de Drive: la misma carpeta del expediente que usan el CRM y el bot (§5.16, §6.9).

### 5.3.5 El código de la página
- **Ruta**: lee la fila de la obra (`leerFila`), los datos de la comunidad (`buscarComunidadPorId`), el desglose y el cuadro (llamando a `p5DesgloseHandler` con `format=json`) y `doc_plantillas`, y llama a `renderPresupuesto`, que une las hojas (`_p5memoria`, `_p5tablaPresupuesto`, `_p5paginasLegales`, `_p5paginaSubvencion`, `_p5paginaImagenes`, `_p5paginaDocumentacion`, `_p5paginaImpresoEmasesa`, `_p5paginaGrupoPresion`, `_p5anexoProdinamia`).
- **Lecturas del Sheet** (banco de pruebas, cerrado): `plan5_toma_datos` 2 (la ruta y Mediciones), `plan5_mediciones` 1, `doc_plantillas` 1, más la búsqueda en `comunidades`; abierto, además `plan5_precios`. Y 9 peticiones de fotos a Drive desde el navegador (el croquis se dibuja, no se pide).
- **Revisión en el pie**: un presupuesto **cerrado** imprime la revisión con la que se cerró (`cierre.motorRev`); uno abierto, o cerrado antes de que se guardara ese dato, la actual (`_P5_REVISION`). Qué se congela y qué no al reimprimir un cerrado, y cómo se trabaja con un presupuesto firmado: §5.17.1.
- **Nombre del PDF**: el título de la página, que el navegador propone al guardar: “Presupuesto Nº … - dirección (Rev-26) (presupuesto)(FALTA FIRMA)”: desde la Rev-26 un número entero; los cerrados con una revisión antigua conservan su forma «Rev-X.Y».
- **Impresión**: cabecera y pie se repiten en cada hoja con una tabla (`thead`/`tfoot`); cada hoja empieza en página nueva y los títulos de la memoria no se quedan solos al pie (`.memgrp`).
- **Reparto fijo de la Memoria** (16/10/2026, criterio de Guille, dentro de la Rev-25.1 por decisión suya): la Memoria son tres bloques, cada uno en hoja nueva. **Hoja 2: A) Descripción del edificio**; **hoja 3: B) Descripción del abastecimiento propuesto**, hasta "Dispondrá de un sumidero…"; **hoja 4: el cuadro de baterías**, y detrás MONTANTES, GRUPOS DE PRESIÓN, AISLAMIENTO, ALBAÑILERÍA y C). Antes, A y B iban seguidas y el cuadro cerraba la B: si la B crecía (por ejemplo, con dos baterías, Pz Pepe Hillo 1), el cuadro saltaba solo a una hoja casi vacía, porque MONTANTES empieza siempre en hoja nueva. Comprobado en los 62 presupuestos del banco: la A cabe siempre en la hoja 2 y la B en la 3, y el número total de hojas no cambia en ninguno. En edificios con muchos peines (Ardilla 9, Bartolomé de Medina 21) el bloque de MONTANTES ya ocupaba más de una hoja y sigue igual. Ventaja: un cambio de texto en una parte ya no mueve las demás, lo que facilita sustituir hojas en un presupuesto firmado (§5.17.1).
- **Se imprime con Firefox ("Guardar como PDF")**, con "Ajustar al ancho de la página", márgenes "Predeterminado" (respeta los del `@page`) e "Imprimir fondos" marcado; sin encabezados ni pies del navegador. Dos cosas que no dependen del programa (14/10/2026):
  - **Si una columna de la tabla se ensancha** (la columna material no parte líneas, §5.3.3.3), "Ajustar al ancho" encoge el presupuesto entero: letra más pequeña y la tabla en dos hojas (caso López de Gómara 35, con un texto largo en "2.6 Otros trabajos extra").
  - **Firefox cambió su motor de PDF** entre el 08/10 y el 14/10/2026 (de cairo a Skia; se ve en las propiedades del PDF, "Producer"). El PDF tiene la misma letra, tamaño y posición, y en papel sale igual (comprobado midiendo la tinta), pero en pantalla algunos visores la pintan más gruesa. No hay ajuste en `about:config` para volver al motor anterior. Si algún día hace falta que el PDF no dependa del navegador, la salida sería generarlo en el servidor (no está hecho).
- **Cerrado**: los números salen de la foto y los textos (memoria, viviendas, peines, catastro) de la copia de la Toma de Datos congelada al cerrar (`snapshot.toma`), igual que en la pantalla (v19.92). Abierto: de la Toma de Datos guardada (columna G).

### 5.3.6 Relación con el resto
- **Con Mediciones y Toma de Datos**: todos los euros salen de Mediciones; los textos, de Toma de Datos. Cambiar algo allí cambia el impreso del presupuesto abierto.
- **Con la ficha del expediente**: los datos de contacto de la portada salen de ella; si están mal allí, salen mal aquí.
- **Con Plantillas de documentos** (§3.23): los documentos de grupo de presión y de paso de instalaciones y el encabezado y pie globales se cambian allí.
- **Con el candado**: cerrado, los números quedan fijos y la revisión es la del cierre.

## 5.4 El flujo de la pantalla — abrir, calcular, guardar, cerrar
- **`POST /plan5/abrir`**: abrir el candado de un presupuesto cerrado: pone `estado="abierto"`, borra `snapshot` y `cierre` y aplica el modo elegido (manual / precios / todo, §5.18.1). Los datos guardados (columna G) los carga la propia pantalla al entrar (`GET /plan5`).
- **`POST /plan5/guardar`**: guarda el `datos_json` de Toma de Datos (columna G). Importante: ni los valores **propios** de la obra (overrides de cantidad/dato/precio, columna H) ni el **snapshot congelado** (columna I) viajan en este payload — se conservan tal cual estuvieran, esta ruta no los toca. **Con el presupuesto cerrado, esta ruta y las tres de valores propios de Mediciones lo rechazan** ("Presupuesto cerrado: ábrelo con el candado", v19.92): el candado ya no es solo de pantalla. **Aviso al cerrar (v19.94, criterio de Guille)**: si al pulsar el candado la casilla "Nº de suministros" está en rojo (los peines no cuadran con las viviendas), la pregunta de cerrar empieza con "OJO: el Num. de suministros esta en ROJO… Si cierras ahora, se congelara asi" y acaba con "Cerrar igualmente?". No impide cerrar.
- **`POST /plan5/cerrar`**: **congela el presupuesto** — la obra deja de depender de los parámetros generales (los que viven en el Sheet compartido, §5.10) y se queda con **su propia copia congelada** de todos los datos de cálculo y de cada precio de línea (el snapshot, guardado en su propia columna I — ver más abajo), como si Guille los hubiera tecleado todos a mano. Así, si mañana cambia una tarifa general, esta obra cerrada no se entera ni cambia sola. El propio comentario del código lo explica: *"al descongelar él decide qué deja entrar (nada / solo precios / todo)"* — es decir, existe la opción inversa de "descongelar" con distintos niveles de qué recuperar del general.

**Modelo de 3 columnas (G / H / I), cada una con su propio límite de 50.000 caracteres — arreglado 23/09/2026, antes G e I compartían la misma celda.** Motivo encontrado en el propio código y confirmado con Ardilla 9 (30 viviendas, 11 peines): al cerrar, `/plan5/cerrar` no congela solo lo que el usuario tocó a mano — congela **todos** los parámetros de `plan5_mediciones` (aunque no tengan override real) y **el precio de cada línea del presupuesto**, uno por uno (46 parámetros + 89 precios de línea en el caso de Ardilla 9). Antes de hoy, todo eso (más el propio desglose congelado, `dsg`+`cuadro`) se guardaba dentro de la columna G, junto con la Toma de Datos — en un edificio grande eso se plantaba justo en el límite de la celda (47.045 de 50.000 caracteres medido en Ardilla 9) y el cierre fallaba con "supera el número máximo de 50000 caracteres".
- **Columna G** — Toma de Datos (viviendas, peines, catastro, croquis, `estado`, `cierre`). Ya NO lleva el snapshot dentro.
- **Columna H** — valores propios de la obra: `overridesDato`/`overrides`/`overridesPrecio` (sin cambios respecto a antes).
- **Columna I (nueva)** — el snapshot congelado (`{dsg, cuadro}`) que antes vivía dentro de G. `_p5FilaCon` (la función que construye la fila a escribir) ahora excluye `snapshot` de G y lo añade como 9º valor de la fila, en su propia celda.
- **Lectura**: `_p5MergeSnap(row, saved)` mezcla el contenido de la columna I sobre `saved.snapshot` cuando hace falta (pantalla de Toma de Datos y `p5DesgloseHandler`). Si la columna I está vacía (obra cerrada **antes** de este cambio, con el snapshot todavía embebido en G), no se toca nada — `saved.snapshot` ya viene relleno del propio parseo de G, y se migra solo a la columna I la próxima vez que esa obra se cierre o se le toque un override, sin script de migración aparte (mismo patrón que la migración de la columna H, ver justo debajo).
- **Resultado medido en Ardilla 9** (mismos datos, antes y después del cambio): G pasa de "toda la Toma de Datos + 47.045 caracteres del resto" a **20.388 caracteres** (solo Toma de Datos); I queda en **26.645 caracteres** (solo el snapshot) — las dos muy por debajo del límite, con margen de sobra incluso para edificios bastante más grandes que Ardilla 9.

**Por qué los overrides propios viven en una columna aparte (H), no dentro de `datos_json` (G)** — explicación encontrada en un comentario del código: si el snapshot todavía viviera dentro de G (modelo antiguo, ver arriba), meter ahí también los overrides propios la haría rozar el límite de la celda todavía más rápido. Por eso se separaron desde el principio: **H manda siempre** sobre lo que hubiera en G. Una obra antigua que todavía tenga sus valores propios dentro de `datos_json` se lee de ahí como respaldo y se migra sola a la columna H la primera vez que se guarda — sin script de migración aparte, igual que `normalizarFase()` en `presupuestos.cjs` (§3.2).

**Los 3 tipos de override de Mediciones, cada uno con su propia ruta y su propio cajón en `saved`** (conecta con la trampa `row:`/`ovkey:` de §5.10):
- **`POST /plan5/mediciones/override`** — cambia la **cantidad** de una línea (`saved.overrides[ovkey]`).
- **`POST /plan5/mediciones/dato-override`** — cambia un **parámetro/factor** de cálculo (`saved.overridesDato[ovkey]`) — es este cajón el que se congela al cerrar (§5.4, arriba).
- **`POST /plan5/mediciones/precio-override`** — cambia el **precio** de una línea concreta (`saved.overridesPrecio[ovkey]`).
En los tres, dejar el campo vacío borra el override y la línea vuelve a usar el valor general de HOY (Sheet compartido) — no es "poner a cero", es "dejar de tener una excepción propia".

**Las dos piezas que cierran el círculo**:
- **`GET /plan5/desglose`** (`p5DesgloseHandler`) es la propia pantalla de Mediciones. Confirma el mecanismo de cierre de arriba: si la obra tiene un `snapshot` guardado (está cerrada — mezclado desde la columna I vía `_p5MergeSnap`, con respaldo automático en la columna G para obras cerradas antes del 23/09/2026), **sirve directamente esos datos congelados** sin volver a calcular nada; si está abierta, calcula en vivo con los parámetros generales de hoy. Es la prueba de que "cerrar" no es solo una etiqueta, cambia de verdad qué datos ve la pantalla.
- **Los valores generales** (columna F de `plan5_mediciones`) no tienen ruta ni pantalla: se cambian en el Sheet directamente (§5.10).

## 5.5 Fuente única de los datos de cálculo — `_p5Entrada(saved)`
Tanto la pantalla de Mediciones en vivo como el PDF impreso necesitan construir el mismo objeto `entrada` (nsum, viviendas, peines, zonas, grupo de presión...) a partir de lo guardado. **Los dos llaman a la misma función**, `_p5Entrada(saved)`, para evitar que un campo se añada en un sitio y se olvide en el otro. Si se añade un campo nuevo al motor, se añade aquí una vez, no en dos sitios.

**Precaución permanente**: antes de dar por corregido algo que toque esta construcción, buscar TODAS las llamadas relacionadas (puede haber más de un punto de entrada con nombres de variable parecidos pero no iguales — ya ha pasado que se arregla uno y el otro queda rezagado).

## 5.6 El dato de viviendas por puerta — cómo se cuenta de verdad
Cada puerta de "resto de plantas" puede llegar a una altura distinta (edificios escalonados). El número real de plantas que alcanza cada puerta se cuenta contra el **catastro** (`saved.catastro`, filas planta/puerta), nunca asumiendo que todas llegan hasta el total de plantas del edificio. Ese número se guarda en `zonas.resto[].n` cada vez que se recalcula en Toma de Datos, y **todo lo demás lee ese dato guardado** (memoria, motor de precios, peines) en vez de recalcularlo cada uno por su cuenta — es el mismo patrón de "fuente única" del §5.5.

Esto también determina cuántas plantas sube cada **peine vertical** — la altura real de un peine se obtiene mirando qué puerta(s) tiene asignadas y buscando su `zonas.resto[].n`.

**Cuándo la puerta NO se repite igual en cada planta.** El conteo por `_p5ContarResto()` busca en el catastro una fila con el **mismo texto** de puerta en una planta intermedia — funciona bien si el catastro repite la letra/número de la puerta igual en cada piso (ej. Malvaloca 1: A, B, C, D se repiten literalmente en cada planta que los tiene, aunque A/B suban más alto que C/D — el sistema cuenta bien 9, 9, 4, 4 porque el texto SÍ coincide entre plantas). Pero si el catastro numera cada vivienda de forma **única y correlativa por planta** (ej. Ardilla 9: planta 1 = puertas 11-20, planta 2 = puertas 21-30 — nunca se repite el mismo número), la búsqueda por texto no encuentra ninguna coincidencia entre plantas y cuenta de menos (cada fila sale como 1 en vez de las 2-3 plantas reales).

**Varias puertas en una fila:** en el campo Puerta de "Viviendas en resto de plantas" ahora se puede escribir **más de un código separado por coma** (ej. `11, 21`) para indicar directamente que esa fila representa esa vivienda en esas plantas concretas. Si el campo tiene más de un valor, la fila cuenta tantas viviendas como códigos se hayan puesto (2, en el ejemplo) — sin pasar por el catastro. Si el campo tiene un único valor (como siempre), sigue funcionando exactamente igual que antes (búsqueda por coincidencia de texto en el catastro), así que edificios normales no se ven afectados.

*Regla práctica: si las puertas del catastro NO se repiten igual en cada planta (numeración correlativa única por planta), hay que rellenar el campo Puerta de "resto de plantas" con los códigos de cada planta separados por coma (ej. `11, 21` para una vivienda que está en planta 1 con el nº 11 y en planta 2 con el nº 21). Si sí se repiten (A, B, C... igual en cada piso), se deja tal cual, con un solo valor por fila.*

Se descartó la alternativa de repartir el total de filas del catastro entre el nº de líneas escritas (ej. 20 filas ÷ 10 líneas = 2 cada una): funciona en edificios simétricos como Ardilla 9, pero rompe edificios irregulares como Malvaloca 1, donde daría 6,5 por línea en vez de los 9/9/4/4 reales.

**Locales "sin suministro" (criterio de Guille, 30/09/2026)**: en la Toma de Datos significa que el local **no tiene agua hoy**, y **se le monta**: lleva contador en la batería (se marca en la columna BAT del catastro), cuenta en el nº de suministros y cobra la subvención de EMASESA (160 €, más 52 € si hay grupo nuevo) igual que una vivienda. Caso: C Virgen de Loreto 9 (2 locales comerciales en baja). La subvención se calcula sobre todos los suministros menos la toma de comunidad.

**Plantas de un peine con ático (v22.3, criterio de Guille)**: el sufijo del tipo de peine (**"+1"**, "+2") son los áticos que ese peine sube por encima de su puerta en Resto de plantas. Por eso Resto de plantas NO debe incluir el ático: en C Virgen de Loreto 9 (4 plantas + ático en la puerta A) la puerta A cuenta 4 en Resto de plantas y el peine V1 es "SIMPLE +1" = **5 plantas**. La geometría (tubo y viviendas del peine) ya sumaba el "+1"; desde v22.3 también lo suman los **días** del peine V-EXT y del enganche (antes miraban solo las plantas de la puerta), y el aviso de Toma de Datos dice "Peine V1: 5 plantas". Nota: hasta v22.2, con el ático numerado, Resto de plantas A contaba 5 y el "+1" sumaba otro: la geometría del peine V1 salía con 6 plantas (tubo y viviendas de más).

**Revisión del presupuesto impreso** (regla vigente desde la Rev-26, 22/10/2026: un solo número que sube con cualquier cambio de lo impreso, §5.17; lo que sigue es la historia hasta la Rev-25.1) **(criterio de Guille, 28/09/2026)**: la revisión (`_P5_REVISION`, en el pie de cada hoja) **solo cambia cuando lo que se imprime cambia respecto a presupuestos CERRADOS** con la revisión anterior; si no hay ninguno cerrado con ella, se sigue con la misma. Por eso se pasó directamente de la **Rev-22.1** (con la que se cerraron C Ardilla 9 y C Ciudad de Gandía 5) a la **Rev-23.1**: las 22.2-22.5 fueron pasos intermedios sin ningún presupuesto cerrado. Un presupuesto **cerrado imprime la revisión con la que se cerró** (`cierre.motorRev`), porque sus números son de esa versión; los abiertos imprimen la actual. **Rev-24.1 (02/10/2026, la X la sube Guille: cambia lo que se imprime)**: cambia el Análisis de Subvención impreso ("Suministro nº" en blanco, contadores de 13 mm con los locales sin suministro y el año de la nota según la fecha del presupuesto); los importes no cambian. **Rev-25.1 (15/10/2026, la X la sube Guille: cambia lo que se imprime; ya había 4 presupuestos cerrados con la 24.1: López de Gómara 35, Hytasa 37, Tambre 12 y Candelario 13)**: por un criterio nuevo de EMASESA sobre la cerradura (si el armario está detrás de una puerta que debe ir cerrada, la cerradura va en esa puerta y el armario lleva pestillo), cambian la frase del armario de la Memoria (§5.3.3.2) y la línea 1.5.1 de la tabla, y los textos de la columna material pasan a minúscula (§5.3.3.3); en la misma revisión (sin presupuestos cerrados con ella todavía), las características del grupo de presión actual pasan de B) a A) de la Memoria (§5.3.3.2); los importes no cambian (comprobado con los 59 presupuestos de `plan5_toma_datos`: solo cambian esos textos y el pie). **Al reimprimir un cerrado** salen ya los textos nuevos con el pie y los precios del cierre: cómo funciona y cómo se trabaja, en §5.17.1.

**Memoria: "ABASTECIMIENTO ACTUAL" (Rev-23.1, 28/09/2026)**: la frase de los montantes va en **singular o plural según el número de peines** de cada grupo (exterior/interior + cocinas/baños), no según las comas de la casilla Puerta: un peine "DR, IZ, ATICO" es un solo montante → "El de las puertas DR, IZ y del ático es exterior y engancha en cocinas." "ATICO"/"AT" se escribe "del ático"; "puertas" en minúscula; las "Y"/"E" escritas en la casilla se convierten en comas. La primera frase también: con un solo peine, "El montante actual es de cobre."; con varios, "Los montantes actuales son de…". En la casilla Puerta del peine, separar con comas ("DR, IZ, ATICO"): el guion no separa, porque forma parte de nombres de puerta reales ("A-B", "ESC.DR-DR"). Solo cambia el texto; los cálculos no.

**Memoria: "IDENTIFICACIÓN DE LAS VIVIENDAS" (Rev-23.1, 28/09/2026)**: solo nombra las filas del catastro que son **viviendas** (uso residencial); los locales, garajes, etc. no salen en esa frase aunque cuenten para la batería (caso C Asunción 34: bajos comerciales DR e IZ). El ático sale con sus puertas reales del catastro, también cuando viene numerado por encima del "Nº de plantas", y en singular si solo hay una ("el ático tiene la puerta IZ").

**Cómo lee el catastro cada planta (y por qué el ático se escribe "Ático")**. La columna Planta del catastro se traduce a un orden (`catPlantaRank` en pantalla, `_p5CatPlantaRank` en el servidor): sótanos (empiezan por "sot"/"sót" o por "-") van por debajo de 0; **baja** es "0", "B", "BJ", "PB" o cualquier cosa que empiece por "baj"; **ático** es lo que empiece por "átic"/"atic" o sea exactamente "AT" ("AT1" o "ATA" no cuentan como ático; la baja admite también "00"); el resto se lee como número de planta. La zona **Resto de plantas cuenta solo las filas con planta de 1 en adelante que NO sean ático**; la zona **Ático** cuenta aparte. **Desde el 26/09/2026, si hay zona Ático, las filas con planta por encima del "Nº de plantas" se tratan también como ático**, aunque vengan con número (ej. "5" en un edificio de 4 plantas): no hace falta tocar el catastro. Antes había que cambiar ese número por "Ático" en la tabla; si no, esa vivienda se cuenta dos veces (en Resto de plantas y en Ático) y salta el aviso "No coinciden los suministros con la tabla del catastro". El número de Resto de plantas es automático y no se puede corregir a mano: se corrige arreglando la planta en el catastro. Caso real: **C Virgen de Loreto 9** (26/09/2026) — 4 plantas + ático; el catastro traía el ático como planta 5, Resto de plantas A contaba 5 en vez de 4 y el aviso decía 12 declarados frente a 11 en BAT; se arregló escribiendo "Ático" en la planta de 5A. Consecuencia al crear los pisos automáticamente en fase 05 (planta + puerta): ese piso se llamará "ÁTICOA" (o "ATA" si se escribe "AT"); se puede renombrar en la caja de documentación.

## 5.7 Catálogo de repartos de viviendas (lo que el programa ha ido aprendiendo)
Cada tipo de edificio que nos hemos encontrado, cómo se reconoce en el catastro, cómo se rellena la Toma de Datos y cómo lo cuenta el programa. **Cuando llega un edificio que no encaja en ninguna ficha: se estudia, se decide cómo tratarlo, se añade su ficha aquí y se añade a la batería de pruebas (§5.19).** Repaso hecho el 26/09/2026 sobre los 41 edificios con Toma de Datos del Sheet; **revisado otra vez el 23/10/2026 contra los 66 de la pestaña**: los 49 que tienen peines encajan todos en las fichas A-H (tipos de peine en uso: SIMPLE, DOBLE, 1-SIMPLE, 1-DOBLE, 2-DOBLE, 1+SIMPLE, 1+DOBLE, SIMPLE+1, 1-SIMPLE+1, 1+DOBLE+1 y 1-SIMPLE-1); los 17 sin peines siguen pendientes (abajo).

**Recordatorio del tipo de peine** (`parsePeine` / `alturasPeine`): la base es SIMPLE (una vivienda por planta) o DOBLE (dos). **Prefijo** "1-"/"2-": faltan 1-2 viviendas abajo (planta baja sin vivienda en ese montante); "1+"/"2+"/"3+": se suman 1-3 tubos cortos en baja (locales). **Sufijo** "-1"/"-2": faltan 1-2 viviendas arriba; "+1"/"+2": áticos por encima de la última planta de la puerta. Las plantas que sube el peine para decidir sus días y los del enganche son las de su puerta en Resto de plantas más los áticos del sufijo (v22.3).

**A. Simétrico, puertas con letra que se repite en cada planta.** Catastro: mismas letras (A, B, C…) en todas las plantas. Toma de Datos: una fila por letra en Resto de plantas; el número sale solo contando el catastro. Peines: uno por puerta ("SIMPLE"), o "DOBLE" si un montante da a dos puertas. Ejemplos: C Nescania 25, C Puerto de Viella 5, C Cruz del Sur 13 (DOBLE "A y B").

**B. Derecha / Izquierda (y Centro).** Igual que A con DCHA/IZDA (expedientes antiguos: C Peñalara 16, Pz Alegre 16, Pz de los Duendes de Sevilla) o DR/CT/IZ (criterio nuevo desde Rev-22.2: C Ballena 6, todavía sin peines; C Marqués del Nervión 114-1 ya no está en la pestaña). Los pisos antiguos con DCHA/IZDA no se renombran (§5.9).

**C. Escalonado: no todas las puertas llegan arriba.** Catastro: unas letras aparecen en más plantas que otras. Toma de Datos: cada puerta cuenta solo las plantas donde existe en el catastro, así que cada peine sube solo hasta donde llega su puerta. Ejemplo: C Malvaloca 1 (A y B hasta la 9; C y D hasta la 4).

**D. Numeración correlativa: cada vivienda tiene un número distinto en cada planta.** Catastro: números seguidos (1, 2, 3… 30) sin repetirse. Toma de Datos: en Resto de plantas, cada fila lleva en Puerta **los números de esa vertical separados por comas**; el nº de viviendas es cuántos códigos hay. Ejemplos: C Ardilla 9 (baja 1-10; resto "11, 21", "12, 22"…; peines "1, 11 Y 21"), C Ciudad de Gandía 5 (resto "5, 9, 13, 17, 21"…).

**E. Planta baja sin viviendas en ese montante (locales, portal).** El peine lleva prefijo "1-" (falta la vivienda de abajo). Ejemplos: C Tharsis 5, Av de la Calesera 8, C Don Fadrique 53. Si en baja hay tubos cortos de locales en el mismo peine, prefijo "1+" (Av de Sánchez Pizjuán 11, Pz Pintor Amalio García del Moral "1+SIMPLE").

**F. Ático con nombre en el catastro.** Catastro: la planta del ático pone "ÁTICO"/"AT". Toma de Datos: zona Ático con su puerta; Resto de plantas no lo cuenta. Peine de esa vertical con sufijo "+1". Ejemplos: C Asunción 34 (DR e IZ con 5 plantas + ático; peine "1+DOBLE+1" = 6 plantas), C Bartolomé de Medina 21 (peine "1-SIMPLE+1" en la puerta ESC.IZ-CT con ático), C Doctor Jaime Marcos 3 ("1-SIMPLE+1").

**G. Ático que el catastro trae con número.** Catastro: la planta del ático viene como un número por encima del "Nº de plantas" (ej. "5" en un edificio de 4). Toma de Datos: no hace falta tocar nada desde v22.3 — si hay zona Ático, Resto de plantas no cuenta las plantas por encima del "Nº de plantas". Peine con "+1". Ejemplo: C Virgen de Loreto 9 (A: 4 + ático = 5 plantas; B: 4).

**H. Plantas con nombre compuesto (escalera en la planta).** Catastro con plantas tipo "DR1", "IZ2", "IZ-ATICO" (escalera + planta) y puertas DR/CT/IZ. Se rellena a mano, una fila por escalera y puerta ("ESC.DR-CT", "ESC.IZ-IZ"…). Ejemplo único hasta hoy: C Bartolomé de Medina 21. Caso a vigilar: si aparece otro, conviene revisar si el programa cuenta bien las plantas de esos códigos.

**Plantas con nombre que el programa no conoce** ("PR" principal, "EN" entresuelo, "OD"…): `_p5CatPlantaRank` las pone al final (9000) y **cuentan como una planta más de Resto de plantas**. Caso real: C Beatriz de Suabia 85 (plantas 1-4 + "PR" → 5 por puerta), cerrado así. Si una de estas plantas no fuera de viviendas, habría que corregirla en el catastro.

**Pendientes de ficha** (sin peines, a 23/10/2026; no se pueden clasificar todavía): C Felipe II 20, Av Ciudad de Chiva 9, C Cueva de la Pileta 2 (catastro sin planta 1), C Ballena 6, Av Cruz del Campo 9 (planta "OD"), C Sierpes 46 (plantas "+1", "EN" y puertas repetidas), C Francisco Palacios "El Pali" 2, NR Santa Isabel 5, C Ciudad de Ayora 4, C Bolonia 9, C Pepe Hillo 1, C Coimbra 26, C Carpa 3, Av de Hytasa 133, Pz de las Tendillas 12, C Mijares 1 y C Zapardiel 2. Ya clasificados desde el 26/09: C Eva Cervantes 5 y C Beatriz de Suabia 85; C Opalo 5 y C Marqués del Nervión 114-1 ya no están en la pestaña.

## 5.8 Toma de Datos también lee los overrides de Mediciones
La ruta `/plan5` (Toma de Datos) lee tanto la columna G (formulario) como la columna H (overrides de Mediciones) del Sheet, y mete los overrides de cantidad en `window.__PLAN5_SAVED__.overridesCantidad`. Esto permite que el aviso de Toma de Datos sepa si algo ya está "puesto a mano" en Mediciones sin tener que abrir esa pantalla.

## 5.9 Integración con el Catastro — de dónde sale el listado de viviendas
Plan 5 se conecta en directo con el **servicio oficial del Catastro** (`ovc.catastro.meh.es`, el callejero SOAP/XML público) para traer automáticamente el listado de plantas/puertas de un edificio, en vez de que Guille lo teclee a mano. Tres rutas, pensadas como una cadena de intentos:
1. **`GET /plan5/catastro/vias`** — autocompletado: dado lo que se va escribiendo en el campo de calle, busca coincidencias en el callejero oficial del municipio, probando varias formas del nombre (variantes) si la exacta no encuentra nada.
2. **`GET /plan5/catastro`** — con la vía ya resuelta y un número de calle, pide al Catastro **todos los inmuebles de ese portal**: para cada uno, planta, puerta, uso (vivienda/local/garaje...) y superficie. De paso intenta traer también el plano de la parcela y los edificios/patios, si el Catastro lo tiene digitalizado.
3. **`GET /plan5/catastro/porref`** — alternativa cuando la búsqueda por calle no encuentra el edificio: se busca directamente por **Referencia Catastral** (el código de 14 caracteres que identifica cualquier inmueble en España), sin pasar por el callejero.
**Qué hace la pantalla al recibir la importación (`window.catImport`, en Toma de Datos; criterio de Guille, 15/10/2026)**, en este orden:
1. **Unifica las puertas de lado a DR / CT / IZ** (`_catLados`), **planta por planta** y solo con las viviendas: si todas las puertas de esa planta son variantes de derecha/centro/izquierda (D, DR, DCHA, DERECHA… / C, CT, CTRO, CENTRO… / I, IZ, IZDA, IZQUIERDA…), se reescriben; si en la planta hay letras (A, B…) o números, no se toca nada. Para evitar confundir letras con lados, una planta con solo "C" y/o "D" (sin ninguna I ni ninguna forma larga) se deja como está: pueden ser las puertas C y D de un edificio A-B-C-D. Así los pisos que luego da de alta la fase 05 nacen ya como 1DR, 1IZ… Solo se aplica al importar; lo ya guardado no cambia.
2. **Asigna la BAT** (`_catAsignaBat`), como siempre: BAT 2 desde la planta 4 solo si hay grupo de presión (actual o nuevo); si no, todo BAT 1. Guille (15/10/2026) decidió mantener esta regla.
3. **Rellena las filas de viviendas** (baja, resto y ático) **solo con las viviendas** (uso que empieza por «Residencial», v131): lo que el Catastro no marca como Residencial (locales, garajes…) se queda en la tabla del catastro pero no entra en las filas; los locales se ponen a mano en Tipo de edificio como "locales con/sin suministro" (como en López de Gómara 35). Cada fila nace con el equipamiento **"Cocina + Lavadero + baño"**, editable. Un inmueble sin uso (si el Catastro no lo dio) se trata como vivienda.
4. **Nº de plantas y Altura de planta**, solo si están vacías: Nº de plantas = la planta numerada más alta de las viviendas (Baja + X; el ático va aparte, como lo cuenta el programa); Altura = 3. Si el Catastro numera el ático como una planta más (pasa en C Virgen de Loreto 9 y C Asunción 34), saldrá una de más y se corrige a mano.
Probado (15/10/2026) en el navegador con importaciones simuladas tipo Tharsis (D/I → DR/IZ, locales fuera), Nescania (A-B-C-D sin tocar), López de Gómara (números), un edificio con DCHA/CTRO/IZDA y ático, y una planta solo con C y D (sin tocar); y que no pisa plantas ni altura ya escritas.

**Croquis: líneas de los volúmenes del edificio (15/10/2026)**. Además del contorno del edificio y los patios (consulta `GetBuildingByParcel` del servicio INSPIRE del Catastro), `_p5catCoordEdificios` pide **las partes del edificio** (`GetBuildingPartByParcel`): cada volumen con distinto número de plantas (castilletes, zonas de una planta…). Se guardan en el fondo del croquis (`croquis.bg.partes`, en la columna G, junto a `edificios` y `patios`) y se dibujan como **líneas finas, sin relleno y sin rótulos** (Guille no quiere los números de plantas), en la pantalla (`croqDrawBg`) y en el croquis del impreso (`_P5_DIST_JS`). Solo aparecen en los edificios que se importen (o reimporten) desde ese día. **Sin comprobar contra el Catastro real**: desde el entorno del asistente el Catastro no es accesible, así que el nombre de la consulta y si trae también voladizos y terrazas (en la web salen como "IXTZA") se confirman en la primera importación real; si la consulta falla, el croquis sale como antes. **Comprobado por Guille (15/10/2026): los voladizos y terrazas no salen**, porque para el Catastro no son partes del edificio (en su web salen porque pintan el mapa, que es una imagen). La única forma de tenerlos sería poner de fondo la imagen del mapa del Catastro (capa de construcciones, sin rótulos), pedida cada vez porque no cabe en el Sheet. **Decisión de Guille: se queda así**; los voladizos se dibujan a mano cuando hagan falta.

**Esto es el origen real del dato "viviendas por puerta"** que se documenta en §5.6 — antes de que llegue como número al motor de cálculo, sale de esta consulta en vivo al Catastro (o, si el edificio no está bien catastrado, de lo que Guille corrija a mano encima).

**El catastro se puede leer desde fuera de Plan 5**: `presupuestos_plan5.cjs` expone `app.locals.plan5.leerCatastro(direccion)`, que devuelve las filas `{planta, puerta, uso, sup, bat}` guardadas en Toma de Datos (columna G). El catastro no va dentro de la foto congelada, así que se lee igual con el presupuesto abierto o cerrado. Hoy solo lo usa el alta automática de pisos de `documentacion.cjs` (§4.1).

**Nomenclatura de puertas y pisos (criterio de Guille, 24/09/2026).** Lados de planta con dos letras: **DR / CT / IZ** (derecha, centro, izquierda), que es además como las devuelve el propio Catastro. El símbolo "PISOS" del croquis sigue ese criterio (pedir DR pinta DR, CT, IZ). El nombre de un piso es siempre **planta + puerta**, con la baja como 0: pegado si la puerta es letra o texto (0A, 1DR, 2IZ), con guion si la puerta es un número (0-1, 1-5). Los pisos antiguos con DCHA/IZDA no se renombran: su nombre es lo que los enlaza con el bot y con sus documentos. **El alta automática copia el catastro tal cual** (no traduce letras): si la columna Puerta del catastro de la Toma de Datos viene como D/I, los pisos nacen como 1D, 1I… (caso C Tharsis 5, 14/10/2026). Hay que revisar esa columna antes de pulsar ACEPTADO; Guille decidió (14/10/2026) vigilarlo a mano y no convertir D→DR / I→IZ en el código.

**Cómo se renombra un piso que ya tiene bot y documentos (procedimiento probado en C Tharsis 5, 14/10/2026).** El nombre del piso (columna C, `vivienda`) es la clave que une tres pestañas, así que **no basta con cambiarlo en la caja** de Datos documentación: la caja busca los documentos del bot por el nombre exacto (`docsByPiso`) y el bot guarda cada documento nuevo con el nombre de su ficha. El bot reconoce al vecino por el teléfono, así que la conversación no se rompe, pero los documentos sí se desenganchan. Se cambia a la vez, en el Sheet, con el mismo nombre nuevo:
1. `pisos`, columna C (las filas de la comunidad).
2. `bot_expedientes`, columna C (la ficha del bot de cada vecino; el orden de las filas puede no coincidir con el de `pisos`).
3. `bot_documentos`, columna C, filtrando por la columna B = comunidad (no usar "reemplazar todo": hay filas de otras comunidades con los mismos nombres).
4. Opcional: las carpetas de Drive "01 DOCUMENTACION BOT › <piso>". Los enlaces ya guardados siguen abriendo aunque no se renombren (van por identificador), pero lo nuevo se guardaría en una carpeta con el nombre nuevo y el piso quedaría con dos.
5. Comprobar en la caja que cada piso conserva sus documentos (en Tharsis: 2DR 5/5, 4DR 6/6, 4IZ 4/4).
Las notas, avisos de HOY y correos no dependen del nombre (van por teléfono o email). Los PDF de "01 DOCUMENTACION" y "03 CARTAS DE PAGO" que se mandan en la fase 08 deben llevar el piso exacto entre paréntesis, "(4DR)", sin nada más dentro (`_pdfsDelPiso` en `bot-whatsapp.cjs`, ruta `POST /documentacion/piso/pdfs-contrato` §4.7; mismo problema que el pendiente de Diego Puerta 1 en §8): "(4DR-financiado 12)" no lo encuentra.

## 5.10 Parámetros de cálculo: en el Sheet vs en el código
La mayoría de los factores de coste (tiempos, tramos por metros, etc.) viven en `plan5_mediciones` (columnas: capitulo, concepto, tipo_coste, capitulo_presupuesto, parametro, valor, unidad), y el código los lee con un valor de repuesto si la fila no existe: `gm(concepto, parametro)` para el capítulo MONTANTES y `g`/`gcu` y similares para los demás. Guille puede tocar estos valores directamente en el Sheet, y afecta a los presupuestos nuevos sin tener que tocar código.

**Patrón "Corte 1 / Corte 2"** (usado para tubo de alimentación y para los criterios de peines/enganches por plantas): dos tramos con un punto de corte configurable — "Corte 1 · hasta (X)", "Corte 1 · días", "Corte 2 · días". En Mediciones se ve con formato de flechas: `0 X → valor1 → corte X → valor2 → (corte+1) X o más`. Cada casilla es editable con override por obra (columna H), independiente del valor general del Sheet.

**Al añadir una casilla editable nueva de este tipo**, el campo que apunta a la fila del Sheet se debe llamar `row` (no `ovkey`) en la construcción del objeto `dato.tramos[]] — el sistema traduce automáticamente `row` → la clave real de guardado (`med.keyOf[row]`). Usar `ovkey` directamente salta esa traducción y el valor se guarda mal (se ve "aceptado" pero vuelve en blanco al recargar).

## 5.11 Peines: modelo de datos
Cada peine tiene: `puerta(s)` (qué letra(s) sirve), `tipo` (SIMPLE/DOBLE, con posibles prefijos/sufijos "1-", "2+", etc. para ajustes), `peineV` (V-EXT o V-INT — si el montante en sí es interior o exterior al edificio), `enganche` (EXT / INT-FACIL / INT-MEDIO / INT-DIFICIL — cómo se conecta cada vivienda, un concepto distinto de `peineV`), `giros`, y `tramos[]` (longitud + tipo de protección de cada segmento, medidos a mano por Guille — estos alimentan los metros de tubo/aislante/chapa reales, no dependen de plantas ni de ninguna fórmula automática).

## 5.12 Reglas de cálculo vigentes — peines, enganches, llaves, armario
Estas son las reglas de negocio actuales del motor (no una lista de cambios, es cómo funciona hoy):

**Días de peine vertical (V-EXT)** — según la altura real del peine (§5.6):
- Hasta 4 plantas → 3 días automáticos.
- Más de 4 plantas → nada automático, pide valorarlo a mano en Mediciones.
- Igual para SIMPLE y DOBLE.
- Parámetros en Sheet: `plan5_mediciones`, concepto "Fontanero (PEINE V-EXT -1)", parámetros "Corte 1 · hasta (plantas)" / "Corte 1 · días plantas" / "Corte 2 · días plantas" (esta última vacía a propósito = pedir a mano).

**Días de enganche** — según la altura real del peine que tiene asignado ese enganche:
- **Exterior**: hasta 4 plantas → 1 día. Más de 4 → 2 días.
- **Interior fácil**: hasta 4 plantas → 1,5 días. Más de 4 → 3 días.
- **Interior medio**: por vivienda (no por plantas), 0,25 días/vivienda, en horas (÷8). No tiene tramos.
- **Interior difícil**: por vivienda, 0,5 días/vivienda, en horas (÷8). No tiene tramos.
- Los **materiales** de las 4 líneas de enganche (entronque, manguito, codo) van siempre por vivienda, nunca por plantas ni por peine — solo los días de exterior/interior fácil cambiaron de base de cálculo.
- Parámetros en Sheet para exterior/interior fácil: mismo patrón Corte 1/Corte 2 que los peines, conceptos "Fontanero (ENGANCHE - exterior)" y "Fontanero (ENGANCHE - interior fácil)".

**Nº de llaves de corte general** (Tubo de Alimentación, campo bloqueado, se calcula solo):
- 1 llave por cada batería de contadores, siempre.
- + 1 llave más (la de fachada), salvo que "Tubo de alimentación → Longitud propuesta" = "SOLO PIECERIA" — en ese caso no se pone la de fachada.
- Ejemplos: 1 batería normal = 2. 2 baterías normal = 3. 1 batería + piecería = 1. 2 baterías + piecería = 2.
- El texto de la Memoria ("SITUACIÓN DE LA LLAVE GENERAL DE CORTE") distingue estos casos aunque el número de llaves coincida (ej. "2" puede ser "fachada + 1 batería" o "1 en cada batería sin fachada", según si es piecería).

**Armario de contadores con 2 baterías** (vs. 1 batería):
- Batería de contadores: 1 línea de coste por batería (no se duplica el precio de una, se listan las dos con su modelo).
- Armario ALUMINIO (prefabricado): 2 unidades (1 con una sola batería).
- Puerta (armario de OBRA, P.ALUMINIO o P.HIERRO): 2 unidades (1 con una sola batería).
- Fontanero (montaje batería contadores): 1,5 días (1 con una sola batería).
- Albañil (ejecución cuarto, solo si es de obra): 2 (1 con una sola batería).
- Albañilería (tabique + enfoscado): siempre 1, no se duplica — se asume el mismo cuarto para las dos baterías.

## 5.13 Aviso de Toma de Datos ("Tipo de peines")
Muestra, sin tener que entrar en Mediciones: el peine horizontal (Peines H, siempre puesto a mano) y cada peine vertical con su altura real, sus días (calculado o puesto a mano) y, si tiene enganche seleccionado, los días de enganche correspondientes. Verde = resuelto, rojo = pendiente (falta valorar a mano, sin enganche seleccionado, o puerta no reconocida en catastro). Los valores de enganche salen del Sheet: la pantalla los recibe en `window.__P5_PARM` (`param5` de `/plan5/desglose?format=json`) y los lee con `_P5V(...)`; el cálculo fijo del navegador solo se usa si esa lectura falla (corregido en el repaso del 23/10/2026: antes decía que nunca leía el Sheet, y §5.21 ya decía lo contrario).

**Enganche con override — reparto por peine (añadido 23/09/2026, caso Ardilla 9 §5.18.5).** El override de enganche (`saved.overrides["Fontanero (ENGANCHE - exterior)||cuadrilla x2"]`, por ejemplo) es un **único número por obra**, el total de días de ese tipo de enganche en todo el edificio — no hay un cajón separado por peine. Antes de hoy, el aviso ignoraba ese matiz: si había override, cambiaba la etiqueta a "(total puesto a mano)" pero seguía enseñando el mismo "1 día"/"1,5 días" fijo de siempre en cada peine, dando una imagen falsa de "cada peine vale eso" cuando en realidad ese número era el AUTOMÁTICO, no el override.

**Arreglado así**: antes de recorrer los peines, se cuentan cuántos peines V-EXT hay de cada tipo de enganche (`_cntEXT`, `_cntFAC`). Al pintar cada peine con override activo, en vez del "1"/"1,5" fijo, se muestra **el total del override dividido entre el nº de peines de ese mismo tipo** — el reparto proporcional que ya se usó a mano para calcular los valores de Ardilla 9 (§5.18.5: 1,25 días ÷ 4 peines EXT = 0,3125 días/peine; 2,625 días ÷ 7 peines INT-FACIL = 0,375 días/peine). La etiqueta pasa a decir "reparto del total puesto a mano entre N peines", para dejar claro que no es un valor propio de ESE peine, es su parte del total de la obra.

**Sigue siendo solo de pantalla, no cambia el cálculo real**: el presupuesto real sigue sumando el override como un único total en la línea de Mediciones (§5.14.4/§5.18) — este reparto es únicamente para que el aviso no mienta sobre cuánto "pesa" cada peine.

## 5.14 Capítulos del presupuesto: de dónde sale cada línea, qué la afecta

Cada capítulo del presupuesto lo calcula una función propia (`calc...`), que recibe datos de Toma de Datos + factores del Sheet y devuelve una lista de líneas de coste. Todas construyen sus líneas igual: `add(concepto, variante, cantidad, tipoCoste, capítulo)`, y el precio de cada línea se busca aparte en `plan5_precios` por `concepto+variante` (función `precioDe`). **Si una línea sale a 0 € con cantidad > 0, casi siempre es que falta esa combinación exacta de concepto+variante en `plan5_precios`**, no un fallo del cálculo.

### 5.14.1 Tubo de conexión (`calcConexion`) — capítulo 1.1
- **Depende de**: `nsum` (nº suministros), `tipoSuministro` (TIPO A-E), `longitud propuesta` (Toma de Datos).
- **Diámetro** (`diametroConexion`): sale de una tabla normativa EMASESA por nº de suministros y tipo, con recargos si la longitud pasa de 6 m (+10mm) o de 15 m (+10mm más, total +20mm). Está en `NORMATIVA.acometida`. **Corrección respecto al Excel original, anotada en el propio comentario del código**: el Excel viejo ponía el segundo corte en 14 m, que estaba mal — aquí está corregido a 15 m (norma real). Si algún día se compara un cálculo nuevo contra uno del Excel antiguo para una acometida entre 14 y 15 m, es esperable que no coincidan — el nuevo es el correcto.
- **Pasante** (`pasanteConexion`): el doble del diámetro de conexión, con mínimo comercial 90 — si `2×diam ≤ 90` sale 90, si no, 110.
- **Días de fontanero/albañil**: por tramos de metros (`diasPorTramo`, factores en `obra.conexion.tiempo` — Sheet), 3-4 escalones con un día distinto cada uno.
- **Aviso ya previsto en el código para un caso de 0€**: si el diámetro calculado sale 110mm, no hay precio de "Codo fitting" para ese diámetro en `plan5_precios` — esa línea saldrá a 0€ a propósito, y el propio cálculo genera un aviso explicándolo (no es un fallo, es un hueco conocido de la tarifa).
- Si "Longitud propuesta" = VALIDO o NO EXISTE, no se calcula nada de esto (cantidad 0 en todo).
- **Si se toca**: cualquier cambio aquí solo afecta a la acometida — no toca tubo de alimentación ni cuarto de contadores, son capítulos independientes.

### 5.14.2 Tubo de alimentación (`calcAlimentacion`) — capítulo 1.2
- **Depende de**: `nsum`, `tipoSuministro`, `longitud propuesta`, `montaje propuesto` (ENTERRADO/B.FORJADO/CANALETA/F.VIGA/F.TECHO), `codos termofusión`, **`llaves`** (viene ya calculado desde fuera, ver §5.12), **`dosBaterias`** (booleano, viene de si hay batería 2).
- **Diámetro** (`diametroAlimentacion`): igual que conexión pero con cortes en 15 m y 40 m.
- **SOLO PIECERIA**: en pantalla es una opción de **Longitud propuesta** (no del montaje); se activa con ella o si la longitud es menor de 2,5 m (la opción se lee como 0 m) (aunque no lo hayas marcado tú, si pones menos de 2,5 m se comporta igual). En este caso NO hay tramo de tubo real, solo una "pieza" de fontanero (`piezaFont`, por defecto 0,5 días).
- **Días de fontanero**: por tramos de metros (`diasAli`), distinto tramo según si es ENTERRADO o F.VIGA/F.TECHO.
- Cantidades que dependen de si hay 1 o 2 baterías (`dosN` = 1 o 2): Válvula de retención, Filtro, Te, Codo, Terminal fitting — todas × `dosN`. Un detalle menor: "Tuerca reducción 3' a ®" no se añade si el diámetro sale 90mm, porque 90mm ya ES 3' — no hace falta reducir nada.
- **Si se toca**: la llave de corte general (§5.12) se calcula FUERA de esta función y se le pasa ya hecha — si el número de llaves está mal, el fallo no está aquí, está en el cálculo de Toma de Datos (`con_llaves`).

### 5.14.3 Cuarto de contadores / armario (`calcCuarto`) — capítulo 1.3
- **Depende de**: `nsum`, tipo de armario (`b39`: ALUMINIO / OBRA - P.HIERRO / OBRA - P.ALUMINIO), batería 1 y 2.
- **Reglas de baterías**: ver §5.12, tabla completa (armario, puerta, fontanero montaje, albañil ejecución — todo depende de `baterias = (bat1?1:0)+(bat2?1:0)`).
- **Accesorios**: es un % (`pctAccesorios`, Sheet, 10% por defecto) sobre la suma de baterías+llaves+flexo — si cambia el precio de las baterías, este importe sube solo, no hay que tocarlo a mano.
- **Si se toca**: cualquier cambio aquí es solo de este capítulo — no afecta a tubo de conexión/alimentación ni a los peines.

### 5.14.4 Montantes / Peines (`paso2_peines` + `calcMontantes`) — capítulo 1.4
El más complejo de todos, ver §5.0 (mapa), §5.6 (altura real por plantas) y §5.12 (reglas de días vigentes).
- **Geometría de cada peine** (`geomPeine`/`alturasPeine`, modelo físico explicado en comentario del código): un peine SIMPLE = un montante por vivienda, que sale del cuarto de contadores y sube hasta encima de su vivienda; la vivienda de la planta *p* mide *(p+1)* alturas de planta de tubo. DOBLE = dos montantes por planta (dobla tubo y viviendas, misma altura). Prefijos `1-`/`2-` quitan viviendas de la planta baja (montantes más cortos, quitan poco tubo). Sufijos `-1`/`-2` quitan viviendas de arriba (montantes más largos, quitan mucho tubo y SÍ bajan la altura del peine). Sufijos `+1`/`+2` añaden viviendas de ático (montantes nuevos, altura *n+2*); **`+3` no existe** (`parsePeine` no lo reconoce y la tabla de tipos tampoco lo ofrece). **Cuarto caso**: prefijos `1+`/`2+`/`3+` (distintos de los sufijos `+1`/`+2` de arriba, ojo a no confundirlos) añaden **locales en planta baja** — cada uno suma un montante corto, de una sola altura de planta (`parsePeine` los distingue como el caso `d`, "sumadas en baja").
- **Metros de tubo de un peine (comprobado el 30/09/2026 con C Virgen de Loreto 9)**: cada vivienda lleva su propio tubo desde la batería, y su longitud tiene dos partes: **(1) el recorrido común** — la suma de los tramos que se escriben en el peine (`tramos[]`: subida, canaleta, techo…) — que **recorre cada vivienda entero**, así que se multiplica por el nº de viviendas del peine; y **(2) la parte vertical propia** de cada vivienda (`geomPeine`). **Peine que sube** ("RECORRIDO (BAJA)" = NO BAJA): la vivienda de la planta *p* lleva *(p+1)* alturas de planta. **Peine en bajada** ("BAJA POR…"): el peine nace arriba (azotea) y la cuenta se invierte — la vivienda más alta (ático) lleva 1 altura y la de planta baja la más larga (`top = n + áticos + 2`, altura = top − la de subida). La suma de verticales **solo es la misma subiendo o bajando en los peines completos** (SIMPLE, DOBLE y con áticos "+1"/"+2"); **cuando faltan o sobran viviendas abajo o arriba** (prefijos "1-", "2-", "1+", "2+", "3+" y sufijos "-1", "-2") **cambia**, porque la vivienda que falta o sobra es la del tubo corto en un sentido y la del largo en el otro. Comprobado con el código (4 plantas, en alturas de planta): SIMPLE 15/15, SIMPLE+1 21/21, DOBLE 30/30; 1-SIMPLE 14 subiendo / 10 bajando, SIMPLE-1 10/14, 1+SIMPLE 16/20, 1-SIMPLE+1 20/15. Por eso la casilla "RECORRIDO (BAJA)" hay que ponerla bien. **Obligatorio en los peines en bajada**: poner la **subida hasta la azotea como un tramo** (en Loreto, 21 m); el programa no la añade sola, y si falta, faltan esos metros por cada vivienda. Al total se le suma el **incremento de medición** de la línea "Tubo distribución (PERT)" (hoy 10 %). Ejemplo Loreto (planta 3 m): peine 1 (A, SIMPLE +1, 6 viv.) 6 × 28 m de tramos + 63 m de verticales = 231 m; peine 2 (B, SIMPLE, 5 viv.) 5 × 31 + 45 = 200 m; 431 m + 10 % = 474,1 m, lo que sale en Mediciones.
- **Reparto de diámetro (25mm/32mm)**: el tubo de los primeros 4 "escalones" de altura siempre se calcula aparte con un "4" fijo (umbral de fontanería, NO relacionado con el "4 plantas" de los criterios de días) — la diferencia entre el total y ese cálculo de referencia es el tubo de 32mm (más caro). Si un peine no supera esas 4 plantas de recorrido, todo su tubo cae en el tramo barato.
- **Materiales de los tramos** (entronque, manguito, codo, chapa, aislamiento): salen de lo que Guille mide a mano por peine (`tramos[]`, longitud + protección), NUNCA de una fórmula automática — no dependen de plantas ni de ninguna regla de días.
- **Si se toca**: casi cualquier cambio aquí tiene efecto en cadena — revisar siempre el mapa de §5.0 antes de tocar nada de peines, porque el mismo dato (`zonas.resto[].n`) alimenta 3 cálculos distintos (días verticales, días de enganche, geometría del tubo).

### 5.14.5 Grupo de presión (`calcGrupoPresion`) — capítulo 3
- **Depende de**: si hay motor actual (`gpMotAct`) y/o se instala uno nuevo (`gpInstala`), modelo elegido (`gpModeloNew`, desplegable — el `MODELO_POR_DEFECTO` solo es de respaldo para expedientes antiguos sin modelo guardado), depósito actual/nuevo, longitud de tubo de expulsión (`gpLongExp`), días de montaje (`gpDias`).
- **Bomba**: si se instala nueva, con precio real; si solo hay actual (se mantiene), aparece a precio 0 (ya está pagada); si no hay ninguna, no aparece la línea.
- **By-pass**: aparece (1 ud) si hay CUALQUIER grupo (actual o nuevo); si no hay ninguno, no aparece.
- **Depósito**: mismo patrón que la bomba — nuevo con precio, solo-actual a 0, ninguno no aparece.
- **Si se toca**: es el capítulo más autocontenido — no comparte datos con ningún otro capítulo salvo el diámetro de alimentación (reaprovechado para el tubo de expulsión).

### 5.14.6 Otros tiempos / trabajos (`calcOtros`) — capítulo 2.6 / 5.1
- **Depende de**: `otrosTiempos` (días sueltos de fontanero, campo libre), `otrosEur` (importe suelto, campo libre), y **`viviendas`** (para la línea de "Nota Simple", 1 por vivienda, Registro de la Propiedad — el mismo dato de viviendas de §5.6, así que si ese número está mal, esta línea también sale mal).
- **Línea fija que no depende de nada del expediente**: "Seguridad y Salud" (1 ud, precio de tarifa) — se añade siempre, en todos los presupuestos, sin condición.
- **Si se toca**: capítulo simple, sin más dependencias que el nº de viviendas y la línea fija de Seguridad y Salud.

### 5.14.7 EMASESA / Subvención (`calcEmasesa`) y financiación
Es el capítulo más complejo de los 7 en cuanto a fórmula, aunque no dependa de geometría como los peines. Recibe el coste total ya calculado (todos los capítulos anteriores) más las tarifas EMASESA (`TARIFAS`, siempre las de 2026: el código lee `F.TARIFAS[2026]` fijo, la fecha del presupuesto no interviene) y calcula, en cuatro bloques, lo que Plan 5 le ahorra a la comunidad frente a contratar por libre:

1. **Subvención base**: viviendas × tarifa base, más tres añadidos condicionales que se suman solo si aplican — si se instala grupo de presión (viviendas × tarifa GP), si hay más de una entrada a la finca (cantidad × tarifa), y si lleva proyecto técnico (viviendas × tarifa proyecto).
2. **Derechos completos de contratación**: lo que costaría el trámite SIN Plan 5 — se calcula por cada diámetro de contador por separado (13/15/20mm, cada uno con su propia tarifa) más, si hay tomas de comunidad, una cuota y fianza fijas de comunidad.
3. **Bonificación de cuotas y fianzas**: lo que Plan 5 aporta gratis — misma lógica por diámetro de contador (cuota + fianza de cada uno, sumadas).
4. **Bonificación de acometida**: una tarifa fija según el diámetro de conexión que salió del capítulo 1.1 (§5.14.1) — aquí se ve la única dependencia real entre este capítulo y los anteriores, más allá de la suma de costes.

**Con esos cuatro bloques ya calculados**, el resultado final se arma así: al coste total con IVA se le suma la acometida y los derechos completos de contratación (lo que costaría "a pelo"); a eso se le restan todas las ayudas (subvención + acometida + bonificación de cuotas) para sacar el importe neto que paga la comunidad. Por último, el **importe por comunero** reparte ese neto entre las viviendas, restando lo que ya se haya ingresado a cuenta, y le suma la cuota y fianza fijas de Plan 5 (no las de la contratación normal — esas ya están bonificadas al 100%).

**Financiación — dos sistemas distintos**: cuando el vecino elige financiar (los plazos 6/12/18 meses o FFCC que ya vimos en `bot-whatsapp.cjs`, §6.8), el precio real de cada opción sale de aquí:
- **Financiación individual** (`pmt`, en el HTML del presupuesto impreso): una tabla fija de plazos de 24 a 120 meses, con un tipo de interés (TIN) del 5,5% hasta 84 meses y 5,75% a partir de ahí, aplicado sobre el importe + 1% de comisión de apertura financiada. Es la fórmula clásica de amortización de un préstamo (cuota constante). Se calcula la cuota para cada plazo y también dividida entre el número de viviendas.
- **Financiación comunitaria (FFCC)** (`finanComunitaria`): no es un préstamo con interés — es un **recargo porcentual escalonado** sobre el importe, que baja cuanto mayor es el importe financiado (del 3% para obras de menos de 10.000€ hasta el 1% para obras de más de 1.000.000€). Solo aplica a partir de 5.000€; por debajo, no es financiable por esta vía.
- **Comparativa "tradicional"** (`_finanTradicional`, con su propio `_pmt`): calcula lo mismo pero sobre el presupuesto **sin** la subvención EMASESA (como si se contratara por libre, sin Plan 5) — es lo que alimenta la columna de comparación "esto costaría sin nosotros" que se ve junto a la del Plan 5 en el presupuesto impreso.

- **Depende de**: el coste total ya calculado (todos los capítulos 1.1-3 sumados, §5.14.1-5.14.5) + el diámetro de conexión del capítulo 1.1 + las tarifas EMASESA del año + el nº de viviendas/locales + cuántos contadores hay de cada diámetro.
- Es el ÚLTIMO paso — no se puede tocar sin haber calculado antes todo lo demás. Si algo de los capítulos 1-3 cambia, esto cambia solo, no hay que tocarlo aparte.

## 5.15 Grupos de presión: catálogo, criterios y precios
Fichas técnicas de Aquatubo (distribuidor de ESPA) recibidas el 29/09/2026. Sirven para elegir el grupo y para saber qué incluye.

**Criterios de Guille (29/09/2026)**:
- **Solo grupos trifásicos, sin la "M"** en el nombre (la "M" = monofásico). La diferencia de precio entre monofásico y trifásico es pequeña (35-5: 1.602,61 € frente a 1.652,06 €, un 3 %), así que no se distinguen en ningún sitio: si una obra admite los dos, en la tabla de precios va el del **trifásico**. Ojo técnico: el monofásico solo existe hasta 2,2 kW; de 3 kW en adelante solo trifásico.
- **Calderín nuevo: se declara 8 L** (casilla "Tamaño calderín nuevo" de la Toma de Datos, automática). La ficha dice que el CKE trae **tanque hidroneumático de 20 L**, pero se deja 8 L a propósito: si se instala uno mayor, la propiedad no puede reclamar nada. El Agualectric 2CV declara 100 L.
- **Cómo sale en el presupuesto**: la memoria dice "…2 motores de 2,2KW y calderín de 8L, con lo que cumple…" (con depósitos: "…2,2KW, calderín de 8L y 1 depósito de 1000L…") y el punto 3.1 "2 bombas de 2,2Kw con calderín de 8L". El modelo no se imprime (solo sirve para buscar el precio), así que la "M" nunca aparece. Corregido el 29/09/2026 un "y ," suelto cuando no había depósitos (solo afectaba a Virgen de Loreto 9).
- **Depósitos (criterio de Guille, 29/09/2026)**: si en la Toma de Datos **no se ponen depósitos nuevos** y el grupo actual **tiene depósitos**, se entiende que **se mantienen los existentes**: en el presupuesto salen a **0 €** (no se valoran) y la memoria lo dice: "…2 motores de 2,2KW y calderín de 8L, **reutilizando los 2 depósitos de 500L existentes**, con lo que cumple…" (o "el depósito…", "el aljibe existente"). Si se ponen depósitos nuevos, se valoran como nuevos con el precio de su tamaño en `plan5_precios` (hoy solo hay precio para 750 L y 2000 L: otro tamaño saldría a 0 €). Caso: C Virgen de Loreto 9.
- La **hidrosfera de 24 L** (41,30 €, oferta del 24/06/2025) es un extra opcional: el grupo ya trae su tanque de 20 L.

**Qué incluye un CKE2 (doble, velocidad variable)**: 2 bombas, 2 Speedrive V2, colector de impulsión (el de aspiración es opcional), cuadro de control y maniobra, válvulas, conexiones, válvulas de retención, tanque hidroneumático de 20 L, transductor de presión y base. Protecciones: trabajo en seco, fallo de transductor, sobreintensidad y cortocircuito, tensión, sobretemperatura, derivación a tierra y fallo de fase, error de comunicación (con rearme automático). El **CKE1** es el mismo equipo con una sola bomba.

**Gama CKE2 Multi trifásica (la que usa el programa)**:

| Modelo | Altura máx. (m) | Caudal máx. (m³/h) | P2 (kW) | Speedrive | Colector | A × B × C (mm) | Peso (kg) |
|---|---|---|---|---|---|---|---|
| CKE 2 Multi 25 4 | 59 | 10 | 0,75 | T22 | 2" | 640 × 440 × 975 | 56 |
| CKE 2 Multi 25 5 | 74 | 10 | 0,92 | T22 | 2" | 640 × 440 × 994 | 57 |
| CKE 2 Multi 35 4 | 55 | 21 | 1,1 | T22 | 2" | 640 × 464 × 1022 | 66 |
| CKE 2 Multi 35 5 | 67 | 21 | 1,5 | T22 | 2" | 640 × 464 × 1045 | 72 |
| CKE 2 Multi 35 6 | 83 | 21 | 2,2 | T22 | 2" | 640 × 464 × 1071 | 73 |
| CKE 2 Multi 35 8 | 110 | 21 | 3 | T55 | 2" | 640 × 500 × 1120 | 87 |
| CKE 2 Multi 35 10 | 138 | 21 | 4 | T55 | 2" | 640 × 500 × 1170 | 106 |
| CKE 2 Multi 55 4 | 51 | 36 | 2,2 | T22 | 3" | 640 × 500 × 1127 | 79 |
| CKE 2 Multi 55 6 | 79 | 36 | 3 | T55 | 3" | 640 × 533 × 1206 | 97 |
| CKE 2 Multi 55 7 | 93 | 36 | 4 | T55 | 3" | 640 × 533 × 1250 | 106 |

Existen además los CKE2 **VE** (121 3 y 121 5, 4 y 5,5 kW, 54,5 m³/h, colector 4") y la serie **Multi VS** (VS4 a VS25, hasta 70 m³/h y 216 m), para edificios mucho mayores; no están en el programa. Serie 25 = poco caudal (10 m³/h); serie 35 = la habitual (21 m³/h); serie 55 = más caudal (36 m³/h) con menos altura.

**Qué ofrece el programa** (desplegable "Potencia nueva" de la Toma de Datos): un modelo por potencia, todos de la serie 35 trifásica, más el Agualectric: 1,1 kW CKE 2 Multi 35 4 · 1,5 kW CKE 2 Multi 35 5 · 1,5 kW AGUALECTRIC (2cv) · 2,2 kW CKE 2 Multi 35 6 · 3 kW CKE 2 Multi 35 8 · 4 kW CKE 2 Multi 35 10. Las series 25 y 55 y los monofásicos **no se pueden elegir y no tienen fila en `plan5_precios`** (comprobado el 01/10/2026); si hiciera falta uno (edificio pequeño o de mucho caudal), habría que añadirlo al desplegable (código de Toma de Datos + `MODELO_POR_DEFECTO`/`ETIQUETA_GRUPO` del servidor) y darle su fila de precio.

**Precios (pestaña `plan5_precios` del Sheet)** — el precio del grupo se busca por **concepto = potencia** ("2x1,1Kw", "2x1,5Kw", "2x2,2Kw", "2x3Kw", "2x4Kw") y **detalle = modelo exacto** ("CKE 2 Multi 35 5"). Si la celda de precio está vacía, el grupo sale a 0 € en el presupuesto. Situación en el Sheet a 01/10/2026 (precios netos sin IVA, ofertas de Aquatubo; el dato que manda es siempre el del Sheet):

| Potencia | Modelo (trifásico) | Precio | Oferta |
|---|---|---|---|
| 2x1,1Kw | CKE 2 Multi 35 4 | sin precio | — |
| 2x1,5Kw | CKE 2 Multi 35 5 | 1.652,06 € | 26AVO24073-1, 28/09/2026, válida hasta 13/10/2026 |
| 2x1,5Kw | AGUALECTRIC 2CV | 2.676,00 € | — |
| 2x2,2Kw | CKE 2 Multi 35 6 | 1.692,91 € | 25AVO21842-2, 23/09/2025 (caducada: pedir actualización) |
| 2x3Kw | CKE 2 Multi 35 8 | 2.028,74 € | 25AVO14152-1, 24/06/2025 (caducada: pedir actualización) |
| 2x4Kw | CKE 2 Multi 35 10 | sin precio | — |

Partidas que acompañan al grupo (misma pestaña): by-pass + llaves + v. antirretorno + pequeño material 450,00 €; depósito 750 L 211,00 €; depósito 2000 L 506,69 € (oferta 25AVO21842-2); montaje del grupo (fontanero, cuadrilla x2) 446,00 €/día.

**Cómo actualizar un precio**: en el Sheet, pestaña `plan5_precios`, buscar la fila cuyo **concepto** es la potencia (columna B, por ejemplo "2x1,5Kw") y cuyo **detalle** es el modelo (columna C, por ejemplo "CKE 2 Multi 35 5"), y escribir el precio neto sin IVA en la columna D ("precio"), con coma decimal. No cambiar los textos de las columnas B y C: el programa busca por ellos exactamente. El nuevo precio se aplica en el siguiente cálculo de cualquier presupuesto **abierto**; los **cerrados con el candado** conservan el precio con el que se cerraron. Conviene anotar en la nota de la fila (o aquí) el número y la fecha de la oferta, para saber cuándo pedir actualización.

## 5.16 Cómo se imprimen las fotos del expediente (página de Memoria)
La hoja de fotos lleva **9 fotos** del edificio (01.png a 09.png de la carpeta «00 imagenes» del expediente en Drive), cada una con una etiqueta fija que describe qué debe fotografiarse ahí (llave de acerado, contador, peines...) — el texto exacto de cada etiqueta vive en una lista del propio código (`ETIQ`), no se repite aquí porque es contenido, no funcionamiento. Además, el **croquis de distribución** (el de la pizarra de Toma de Datos), en la fila de abajo a la izquierda, del tamaño de dos casillas.

**Rev-26 (22/10/2026, criterio de Guille)**: antes eran 10 fotos + el croquis en la última casilla (pequeño). Repasadas las 65 obras de Plan 5 contra Drive: la foto 10 no se había usado nunca y la 8 y la 9 casi nunca, así que salían comodines ARA en casi todas. Se quitó la foto 10 del código, el croquis pasó a ocupar el sitio de las antiguas 7 y 8 y las fotos 7, 8 y 9 pasaron a su derecha. El croquis se dibuja al tamaño del hueco (`_P5_DIST_JS` mide el lienzo al pintar), con los símbolos y la leyenda al mismo tamaño que antes y la leyenda centrada abajo. Un 10.png u 11.png que haya en Drive no se imprime (hoy hay 11.png en Ardilla 9, Pz Sella 4, Sánchez Pizjuán 11, Don Fadrique 53 y Sierra Vicaría 2, de antes).

**Mecanismo — comprobado en el código, no solo supuesto (19/09/2026)**: no se generan las 9 fotos de golpe en el servidor. Cada casilla es una etiqueta `<img>` normal con `src="/plan5/imagen?id=...&n=01"` (…`n=02`, `n=03`...) — el propio navegador dispara **9 peticiones HTTP independientes** al renderizar la página, una por foto, en el orden en que el HTML las va pintando. Cada petición llega a la ruta `GET /plan5/imagen` (en `presupuestos_plan5.cjs`), que llama a `P().getImagenExpediente(tipoVia, direccion, n)` — la versión **singular**, que trae una sola foto de Drive por llamada — y la devuelve como PNG. Si una foto no existe en Drive, esa casilla cae en el `onerror` del `<img>` y muestra una imagen de "sin foto" en su lugar, sin romper el resto de la cuadrícula.

**Por qué es así y no de otra forma**: un comentario del propio código lo confirma — *"fotos: ahora lazy en el navegador via /plan5/imagen"* — es decir, hubo un diseño anterior (probablemente construir todas de golpe en el servidor y mandarlas ya incrustadas) que se cambió a este de "una petición por foto" para que la página cargue rápido y no se quede esperando a todas antes de mostrar nada. Por eso `getImagenesExpediente` (plural, la que traía todas de golpe) se quedó sin uso y **se borró** (§9.2); hoy solo existe la singular.

## 5.17 Sistema de revisiones — `_P5_REVISION`
Constante global (`const _P5_REVISION = "Rev-N fecha";`, cerca de la línea 945). Se imprime en el pie de cada PDF y en la ficha de Toma de Datos ("Actual: Rev-N"). **Regla vigente (criterio de Guille, 22/10/2026), desde la Rev-26**:
- **Un solo número entero, sin decimales** (Rev-26, Rev-27…).
- **Sube en 1 con cualquier cambio que haga que el presupuesto salga impreso distinto**: textos, diseño o cálculo (números). El número lo confirma Guille.
- **Si la impresión sale igual** (Toma de Datos, mapa, arreglos internos): no sube.
- Hasta la Rev-25.1 se usaba "X.Y" (la X para lo impreso, la Y para el cálculo); las antiguas no se renombran.
- El pie del PDF (`(fecha)(Rev-N fecha)`): un presupuesto **abierto** imprime la revisión actual; uno **cerrado**, la revisión con la que se cerró (`cierre.motorRev`, desde la Rev-23.1), porque sus números son de esa versión. Los cerrados antes de que existiera ese dato imprimen la actual (§5.3.5).

### 5.17.1 Cómo se imprime un presupuesto cuando cambian las revisiones (criterio de Guille, 15/10/2026)
**La idea clave**: al cerrar un presupuesto se congelan **los datos y los euros**, no **la redacción**. El número de revisión del pie dice de qué versión son los números, no los textos. Por eso, al reimprimir un cerrado con un código más nuevo, sale una **mezcla a propósito**: números y pie de cuando se cerró, y textos de hoy.

**Qué se congela al cerrar** (`POST /plan5/cerrar`, §5.4):
- **La foto de Mediciones** (`snapshot.dsg` y `snapshot.cuadro`, columna I): todas las líneas, cantidades, precios y el cuadro económico. De ahí salen la tabla del presupuesto, el total, el importe por comunero, la financiación, el 8.6 (10 % del total) y el Análisis de Subvención.
- **La copia de la Toma de Datos** (`snapshot.toma`: `v`, `vkv`, `zonas`, `peines`, `catastro`): los datos con los que se escriben las frases (viviendas, peines, tubos, armario…). Si alguien cambiara después la Toma de Datos viva, el impreso seguiría usando esta copia.
- **La revisión del motor** (`cierre.motorRev`): la que sale en el pie de todas las hojas.
- Las **Condiciones particulares** no están en la copia, pero un cerrado no se puede editar (candado, §5.4), así que no cambian.

**Qué NO se congela (sale siempre del código o del Sheet de hoy)**:
- **La redacción de la Memoria y de la tabla**: las frases que monta el código con esos datos (`_p5memoria`, `armarioTxt`, la columna material de `_p5tablaPresupuesto`, los nombres impresos de `_NOMBRE_IMP`). Ejemplo: la frase de la cerradura de la Rev-25.1 sale en todos los cerrados al reimprimirlos.
- **Los textos fijos del contrato**: apartados 3 a 8 (`_p5paginasLegales`), incluida la cláusula 8 entera. Si se reescribió después del cierre (le pasó a todo lo cerrado con la Rev-20.2), la reimpresión lleva la cláusula nueva, **no la que firmó la comunidad**.
- **La maqueta del Análisis de Subvención** y sus reglas de presentación (por ejemplo, las de la Rev-24.1: "Suministro nº" en blanco, contadores de 13 mm con los locales sin suministro). Los importes sí son los de la foto.
- **Los documentos de `doc_plantillas`** (mantenimiento o renuncia del grupo de presión, paso de instalaciones…): el texto sale del Sheet de hoy y **la fecha es la de hoy** (`_fechaHoy`), no la de la firma.
- **El corte de las hojas**: con un texto más largo o más corto, el programa puede cortar las hojas en otro sitio (Nescania 25: el título "EMPLAZAMIENTO DEL NUEVO GRUPO:" pasó de la hoja 2 a la 3).

**Resumen de los tres casos**:

| | Precios | Revisión del pie | Textos, cláusulas y fechas de cartas |
|---|---|---|---|
| **Abierto** | De hoy | La actual | De hoy |
| **Cerrado, reimpreso sin descongelar** | Los del cierre | La del cierre | De hoy |
| **Cerrado y descongelado** ("Editar a mano", §5.18) | Recalculados con el motor de hoy | La actual (y la nueva al volver a cerrar) | De hoy |

**Cómo se trabaja con un presupuesto ya firmado** (criterio de Guille, 15/10/2026):
1. **Si EMASESA pide cambiar algo concreto**: se parte del **PDF firmado** y se sustituyen a mano **solo las hojas afectadas**, sacadas de una reimpresión **sin descongelar** (mismos precios y mismo pie). El resto del documento sigue siendo exactamente el firmado: cláusulas, cartas, fechas y firmas. Si al sustituir queda un título repetido o cortado entre una hoja vieja y una nueva, se acepta o se sustituye también la hoja de al lado. **Desde el 16/10/2026 la Memoria tiene un reparto fijo** (A en la hoja 2, B en la 3, cuadro de baterías y MONTANTES en la 4; §5.3.5), así que en los presupuestos impresos desde entonces un cambio de texto solo mueve la hoja de su parte. En los firmados antes, con el reparto antiguo, sigue valiendo lo que viene a continuación. **Si el cambio mueve texto de la Memoria, se sustituyen todas sus hojas seguidas**, desde la primera que cambia hasta la tabla: al añadir o quitar líneas en una hoja, las siguientes empiezan y acaban en otro sitio, y una hoja nueva suelta al lado de una vieja deja líneas repetidas o perdidas. La tabla del presupuesto empieza siempre en hoja nueva, así que lo que hay de ella en adelante no se mueve por cambios de la Memoria. Caso real: C Nescania 25 (15/10/2026). Con solo la cerradura cambiaban las hojas 3 y 5 (y quedó repetido "EMPLAZAMIENTO DEL NUEVO GRUPO:" entre la 2 vieja y la 3 nueva); con el cambio del grupo de presión de la misma Rev-25.1, que sube texto a la hoja 2 y lo quita de la 4, hay que sustituir **las hojas 2, 3, 4 y 5**, y con eso desaparece también el título repetido. Las hojas 1 y de la 6 en adelante siguen siendo las firmadas.
2. **No se manda la reimpresión entera de un cerrado como si fuera el firmado**: llevaría las cláusulas y las fechas de hoy.
3. **Descongelar solo si se quiere rehacer el presupuesto de verdad**, con números nuevos. Mueve los importes: con la Rev-25.1, Nescania 25 sube 767,07 € (de 32.814,23 a 33.581,30) y Beatriz de Suabia 85 baja 2.698,30 € (de 27.309,13 a 24.610,83), los dos cerrados con la Rev-20.2. Antes de descongelar, ver §5.18.3; si hay que reabrir sin mover importes, el procedimiento está en §5.18.4.
4. **Para saber qué cambiaría en un cerrado**: el asistente lo pinta en el banco de pruebas de las dos formas (congelado y como si se descongelara) y lo compara con el PDF firmado, hoja a hoja.

**Por qué se deja así y no se congela también la redacción**: se valoró (15/10/2026) guardar los textos de cada presupuesto al cerrarlo, para que un cerrado se reimprimiera idéntico al firmado. Es lo más limpio, pero es un cambio grande, y con el procedimiento de sustituir hojas no hace falta. Tampoco se pone en el pie la versión de los textos ("textos Rev-25.1"), porque confundiría más de lo que aclara. Si estos casos empezaran a ser frecuentes, se volvería a plantear.

## 5.18 Reabrir un presupuesto cerrado — qué cambia, por qué, y procedimiento para dejarlo exactamente como estaba

**Principio de fondo: no existe ningún "sello de versión" del motor de cálculo por expediente.** El candado (§5.4) protege mientras el presupuesto sigue cerrado: se sirve el `snapshot` tal cual y ni el Sheet ni el código le afectan. Pero en cuanto se reabre, con **cualquiera** de los 3 modos, se tira la foto y el presupuesto vuelve a calcularse **con el código de HOY**. Solo se congelan los importes ya calculados, nunca las fórmulas. Cualquier cambio de criterio hecho en el código entre la fecha de cierre y la de reapertura se cuela automáticamente, aunque quien reabre solo quisiera tocar una casilla sin relación.

### 5.18.1 Qué hace de verdad cada modo del candado (`POST /plan5/abrir`)
Los tres modos borran `snapshot` y `cierre`; se diferencian solo en qué valores propios de la obra (columna H, §5.4) conservan:
- **Editar a mano** (`manual`): conserva los tres cajones (dato, cantidad, precio). La foto no se conserva: se recalcula en vivo con esos valores propios encima (el diálogo lo dice así desde el 02/10/2026).
- **Actualizar solo precios** (`precios`): conserva dato y cantidad; tira los precios propios, así cada línea coge el precio de hoy de `plan5_precios`.
- **Actualizar todo** (`full`): tira los tres cajones; todo vuelve al general de hoy.

Por eso "Editar a mano" es siempre el modo para reabrir sin mover importes: es el único que no tira nada propio.

**Trampa al volver a cerrar**: el botón del candado, antes de congelar, **guarda el formulario entero de Toma de Datos tal como lo está pintando la pantalla** (`plan5GuardarTodo`). Si la pantalla está calculando mal algún dato (el caso típico es el recuento de viviendas por puerta, §5.6, que se ve con "Nº de suministros" en rojo), al cerrar se guarda ese dato malo y se congela el presupuesto ya estropeado. Lo mismo pasa al tocar cualquier casilla de Toma de Datos (cada cambio guarda el formulario completo).

### 5.18.2 Por qué cambian los números al reabrir — las tres causas conocidas
1. **Cambio de fórmula en el código.** Una línea se calcula hoy de otra forma que el día del cierre (ej. el paso de enganches "por vivienda" a "por peine", §5.12).
2. **Valores propios de dato congelados con nombres de parámetro que ya no existen.** Al cerrar se congelan todos los parámetros de `plan5_mediciones` en `overridesDato`, con su clave `CAPITULO|concepto|parámetro`. Si después se cambió el criterio y el parámetro pasó a llamarse de otra forma (ej. "Corte 1 · hasta (m)" → "Corte 1 · hasta (plantas)", o "Días por vivienda" → "Corte 1 · días"), la clave vieja ya no casa con nada y el motor usa el valor general de hoy. En la pantalla parece que el dato está "puesto a mano", pero no se aplica.
3. **Arrastre del margen global de mano de obra.** El PDF imprime cada línea multiplicada por un margen (`_p5tablaPresupuesto`): `bMo` para mano de obra, que se calcula sobre el **total** de mano de obra del presupuesto (`paso5_agregacionYMargenes`). Si cambian las cantidades de mano de obra de alguna línea, cambia `bMo`, y con él el importe impreso de **todas** las líneas de mano de obra, aunque su propio cálculo no haya cambiado. Estas diferencias se arreglan solas en cuanto se corrigen las cantidades de verdad (causas 1 y 2): no hay que tocarlas una a una.

### 5.18.3 Antes de descongelar: ¿hace falta?
- **Para reimprimir, no.** Un presupuesto cerrado se imprime con sus números congelados y con la revisión con la que se cerró (§5.17). Para que lleve la revisión actual hay que reabrirlo y volver a cerrarlo.
- **Para cambiar la fecha, sí** (Toma de Datos está bloqueada mientras está cerrado). Cambiar la fecha **no mueve ningún importe**: las tarifas EMASESA son fijas del año (§5.14.7) y la fecha no entra en el cálculo. Solo cambian los textos donde aparece (portada, pie, firma, análisis de subvención, acta sugerida, impreso de EMASESA, validez de Prodinamia).
- Para cambiar un dato de verdad (viviendas, peines...), sí, y entonces el presupuesto cambiará a propósito.

### 5.18.4 Procedimiento paso a paso para reabrir sin mover importes
1. **Guardar la referencia antes de tocar nada**: el PDF impreso congelado (o, mejor, el `snapshot.dsg.lineas` y el `snapshot.cuadro` de la columna I; en obras cerradas antes del 23/09/2026 el snapshot está todavía dentro de la columna G) y una captura de Mediciones cerrado.
2. **Reabrir con "Editar a mano"** (§5.18.1).
3. **Revisar Toma de Datos antes de tocar nada**. Si "Nº de suministros" sale en rojo o el aviso de peines dice que no concuerdan, casi siempre es el recuento de viviendas por puerta con numeración correlativa del catastro: se arregla escribiendo en "Viviendas en resto de plantas" los números de cada columna separados por comas (§5.6). Comprobar que "Nº de suministros" vuelve a coincidir con el del cierre **antes** de tocar cualquier otra casilla (cualquier cambio guarda el formulario, §5.18.1).
4. **Comparar Mediciones línea a línea contra la referencia** y separar las diferencias por causa (§5.18.2): las de cantidad real (causas 1 y 2) se corrigen; las de arrastre de margen (causa 3) no se tocan.
5. **Fijar a mano solo las cantidades que cambiaron**, escribiendo el valor exacto de antes en la columna **Cantidad** de Mediciones (override de cantidad, `saved.overrides["concepto||variante"]`, columna H, §5.4). No usar la columna Dato: en una obra descongelada con valores propios antiguos, el Dato puede no aplicarse (causa 2).
6. **Comprobar que cuadra de verdad**: el total con IVA, la mano de obra (`cMo`) y el margen de mano de obra (`bMo`) deben coincidir al céntimo con los del cierre. Si esos tres coinciden, el resto cuadra solo.
7. **Reimprimir y comparar el texto del PDF** con el de la referencia: salvo fecha y revisión, no debe cambiar nada (importes, cuotas de financiación, análisis de subvención, tabla de Prodinamia).
8. **Volver a cerrar con el candado** solo cuando los pasos 3 y 6 estén bien (por la trampa de §5.18.1). Queda congelado con la revisión actual.

**Es un parche manual, expediente a expediente — no una solución automática.** Cada vez que se cambie un criterio de cálculo, cualquier presupuesto cerrado antes de ese cambio necesitará este mismo procedimiento al reabrirlo. La protección automática sería el "sello de criterio" apuntado en §9.4 (punto 21).

### 5.18.5 Casos en los que se ha aplicado
- **Ardilla 9** (cerrado con Rev-20.1, reabierto con Rev-22.1, 23/09/2026): causas 1 y 3 — el cambio de enganches a "por peine" subió la mano de obra, bajó `bMo` y movió líneas impresas sin relación ("Desmontaje contador", "Armario batería", "Regolas y taladros", "Canaleta"). Además, un peine con sufijo (`1-SIMPLE-1`) recalculó su altura distinta. Se arregló con cantidades a mano en enganches y en ese peine. Es el caso que originó el reparto por peine del aviso de Toma de Datos (§5.13).
- **Ciudad de Gandía 5** (cerrado con Rev-21.1, reabierto con Rev-22.1, 24/09/2026): causas 1, 2 y 3 — los días de peine V-EXT pasaron a "pendiente de valorar a mano" (más de 4 plantas) y el enganche exterior pasó a calcularse por peine, porque sus datos congelados tenían los nombres de parámetro antiguos. Además, trampa de §5.18.1: catastro con numeración correlativa, la pantalla contaba 9 suministros en vez de 25; se arregló con las puertas separadas por comas (§5.6) antes de tocar nada más. Resultado comprobado: mismo total al céntimo y PDF idéntico salvo fecha y revisión.


## 5.19 Batería de pruebas de Plan 5 (para que lo aprendido no se rompa)
**Qué es**: antes de entregar cualquier cambio de `presupuestos_plan5.cjs`, se recalculan **todos los edificios con Toma de Datos del Sheet** con la versión anterior y con la nueva, y se comparan. Lo que cambie sin buscarlo se ve antes de entregar. Criterio de Guille (26/09/2026): el programa tiene que ir aprendiendo los repartos de pisos y los cálculos tienen que salir correctos; cada caso aprendido queda protegido por la batería.

**Qué compara de cada edificio**: (1) en la pantalla Toma de Datos, abierta en un navegador de verdad: el nº de viviendas de cada zona (baja, resto, ático) y todo el aviso (suministros, plantas y días de cada peine, enganches); (2) en el servidor, con esos datos: total con IVA del presupuesto Plan 5, coste, tiempo de ejecución y las líneas clave (peines, enganches, tubos, viviendas, contadores, baterías).

**Cómo se pasa** (lo hace el asistente, en el banco de pruebas): `correr.sh <plan5 anterior> ant`, `correr.sh <plan5 nuevo> nue`, `comparar.py ant nue`. El código completo y los resultados de referencia están en el **Anexo A** del manual: en una sesión nueva basta con el manual, el Excel del Sheet y los `.cjs`, aunque el banco de pruebas se borre entre sesiones.

**Primera pasada (26/09/2026, Rev-22.2 → Rev-22.3)**: 41 edificios, 0 errores. Cambian 3, los tres buscados: **C Virgen de Loreto 9** (Resto A 5 → 4; desaparece el aviso de suministros; tubo PERT 528 → 474,1 m y coquilla 480 → 431 m, porque antes el ático se contaba dos veces; el total baja en consecuencia), **C Asunción 34** (el aviso dice "Peine V1: 6 plantas" en vez de 5 — 5 + ático; días y dinero iguales) y **C Bartolomé de Medina 21** (aviso "Peine V5: 3 plantas" en vez de 2; días y dinero iguales). Los otros 38 salen idénticos.

## 5.20 Rutas del fichero y quién las llama
Todas piden token.
- **`GET /plan5`** (y su alias `/plan5/toma-datos`): pantalla Toma de Datos. Se entra desde el menú de la ficha del expediente ("📋 PRESUPUESTO PLAN 5"), con la dirección y el id del expediente.
- **`POST /plan5/guardar`**: guarda Toma de Datos (columna G). Lo llama la pantalla en cada cambio.
- **`GET /plan5/desglose`**: pantalla Mediciones; con `format=json` devuelve el desglose, y así lo usan Toma de Datos (para el cuadro económico) y el propio candado al cerrar.
- **`POST /plan5/mediciones/override`, `/precio-override`, `/dato-override`**: los tres tipos de valor propio de la obra (columna H, §5.4). Los llama Mediciones.
- **`POST /plan5/cerrar`** y **`POST /plan5/abrir`**: el candado (§5.4). Los llama Toma de Datos.
- **`GET /plan5/catastro/vias`**, **`/plan5/catastro`** y **`/plan5/catastro/porref`**: importar el catastro (§5.9). Los llama la opción "IMPORTAR CATASTRO" del menú de Plan 5.
- **`GET /plan5/presupuesto`** (también `/plan5/presupuesto/:nombre`): el presupuesto para imprimir. Lo abre la opción "IMPRIMIR PRESUPUESTO" del menú.
- **`GET /plan5/imagen`**: sirve cada foto del expediente para la página de Memoria (§5.16).


## 5.21 Pestañas del Sheet, servicios externos y relaciones
- **`plan5_toma_datos`**: una fila por presupuesto. A dirección, B id del expediente, C nº de presupuesto, D fecha, E revisión, F actualizado, G datos de Toma de Datos (JSON), H valores propios de la obra, I foto congelada. **La fila se busca por la dirección (A), no por el id (B)**: ver §9.4.
- **`plan5_precios`** y **`plan5_mediciones`**: la **configuración editable** del motor, directamente en el Sheet: precios por concepto, y parámetros de cálculo por línea (§5.10). Afectan a todos los presupuestos abiertos; los cerrados no, porque sirven su foto.
- **`doc_plantillas`**: solo lectura, para los documentos del grupo de presión que van en el impreso (mantenimiento o renuncia).
- **`comunidades`**: **al congelar** (`/plan5/cerrar`) se escriben en la ficha del expediente cinco datos económicos: `pto_total`, `mano_obra_previsto`, `material_previsto` (materiales + albañilería + grupo de presión), `tiempo_previsto` y `beneficio_previsto` (col AB). Esta última se escribe como número encima de la fórmula que tuviera la celda. Es el único momento en que Plan 5 toca la ficha del CRM: si se reabre y se cambia algo, la ficha no se actualiza hasta volver a congelar.
- **Catastro (servicio público externo)**: `ovc.catastro.meh.es` — el callejero (para encontrar la vía) y los servicios INSPIRE de parcelas y edificios. Sin clave; si el servicio de Hacienda no responde, la importación falla y se rellena a mano.
- **Relaciones**: usa de `presupuestos.cjs` el cliente del Sheet, la búsqueda de expedientes, `actualizarCampoComunidad` y las fotos de Drive (`getImagenExpediente`); expone `app.locals.plan5.leerCatastro` a `documentacion.cjs` (alta automática de pisos, §4.1). Carga el tema de `estilo-visual.cjs` (§2). **Quién más toca su pestaña** (las dos direcciones): `presupuestos.cjs` reescribe A y B al renombrar un expediente (§3.12), y **el bot lee la foto congelada para poner los importes en la pregunta de la forma de pago** (§6.4): si cambia dónde o cómo se guarda la foto (hoy, columna I; G en los cerrados antes del 23/09/2026), hay que cambiar también el bot. Mapa completo en el capítulo 1.
- **Automatismos**: ninguno propio (no tiene temporizadores). Lo único que ocurre sin pedirlo es el volcado de datos económicos al congelar.

**Diámetros de conexión y alimentación: una sola regla (30/09/2026, criterio de unificar)**. Norma EMASESA (Reglamento de Abastecimiento, art. 26 del Reglamento de Suministro; Recomendaciones Técnicas Plan Cinco): el diámetro sale de la tabla por nº de suministros y tipo; el **tubo de conexión** (igual que la acometida) sube **+10 mm entre 6 y 15 m** y **+20 mm por encima de 15 m**; el **tubo de alimentación**, **+10 mm entre 15 y 40 m** y **+20 mm por encima de 40 m**. Tras sumar se **redondea al tamaño comercial inmediato superior** (32, 40, 50, 63, 75, 90, 110 mm en PE); por ejemplo 63 + 20 = 83 → 90 mm. Esta regla vive **solo** en las funciones del servidor `diametroConexion` / `diametroAlimentacion` (tablas en `NORMATIVA`), y la pantalla de Toma de Datos **usa esas mismas funciones**: el servidor inyecta su código en la página como `window.__P5DIAM`, y `dAco` (validación del tubo de conexión, abajo) solo la llama. No volver a copiar la regla en la pantalla: la copia antigua no redondeaba y daba tamaños que no existen ("70 mm"). Comprobado al unificarlo: pantalla y presupuesto coinciden en los 42 edificios y la batería no cambia ninguno. Si cambia la norma o un tamaño comercial, se toca en un solo sitio.

**Tubo de conexión: validación (30/09/2026)**: el aviso de la Toma de Datos compara el **diámetro actual (exterior)** con el que hace falta según la tabla de acometidas (nº de suministros y tipo de edificio; en PE, nominal 40 = 50 mm exterior, nominal 50 = 63 mm). Antes, al elegir "VALIDO" en "Longitud propuesta", salía siempre "TUBO DE CONEXIÓN VÁLIDO" sin mirar el diámetro. Ahora, si el diámetro no llega, sale en **rojo "NO VÁLIDO: hace falta 63 mm"** (o el que corresponda) y hay que poner la longitud del tramo nuevo. Caso: C Eva Cervantes 5 (PE 50 mm para 40 suministros tipo C → hacen falta 63 mm). Revisados los 41 edificios: los 17 marcados como "VALIDO" lo son de verdad.

**Croquis: símbolos de batería (29/09/2026, criterio de Guille)**: el menú "Símbolos" del croquis tiene **BATERIA 1** y **BATERIA 2** (antes una sola "NUEVA BATERIA"): el mismo cuadrado verde con el número en blanco dentro, para los edificios con dos baterías ("Tipo de batería 1" y "Tipo de batería 2" de la Toma de Datos). Los croquis antiguos se numeran solos por orden de colocación: la primera batería que se puso sale con "1" y la segunda con "2" (en el Sheet, a 01/10/2026, tienen las dos Av de Sánchez Pizjuán 11, C Eva Cervantes 5, C Eva Cervantes 13 y Av de la Calesera 31). Si el orden no es el bueno, se borra y se vuelve a poner con BATERIA 1 / BATERIA 2. Se ve igual en el editor y en el croquis impreso; la leyenda del impreso sigue diciendo "NUEVA BATERIA". A los edificios con segunda batería que aún no tienen la BATERIA 2 en el croquis (C Nescania 25, C Cruz del Sur 13, C Sierpes 46, C Malvaloca 1 y C Cueva de la Pileta 2, a 01/10/2026) se les deja así (decisión de Guille, 04/10/2026) y se ponen si hay que retocar su presupuesto. Nota: el croquis se vuelve a pintar al imprimir, así que el número aparece también en los presupuestos cerrados (Guille lo acepta).

**Cambios de v19.95 en Toma de Datos (criterio de Guille, 04/10/2026):**
- **El aviso de peines y enganches lee los días del Sheet**: `/plan5/desglose?format=json` devuelve `param5` (cortes y días de peines V-EXT, enganches exterior e interior fácil, y días por vivienda de interior medio y difícil, de `plan5_mediciones` con los valores propios de la obra; congelados si está cerrada) y el aviso los usa (`window.__P5_PARM`, `_P5V`). Si se cambia un valor en el Sheet, el presupuesto y el aviso dicen lo mismo. Si hay "Corte 2" de peines, el aviso lo aplica en vez de "pendiente de valorar a mano".
- **El desplegable de baterías sale de `plan5_precios`** (las filas "Batería de contadores (PPR)", ordenadas por tomas): un modelo nuevo dado de alta allí aparece para elegirlo. Las medidas de cada batería siguen en el código (`BATMED`). Si la lectura falla, se usa la lista fija de respaldo. **Los precios de las baterías (10 € la 4T-2F, de 10 en 10 hasta 270 € la 45T-3F) son correctos** (confirmado por Guille, 04/10/2026).
- **Aviso si el grupo o el depósito nuevo no tiene precio** en `plan5_precios` ("…saldría a 0 €. Pide la oferta y ponlo antes de cerrar."), en la caja de avisos de Toma de Datos. Al probarlo salieron dos casos reales: **C Sierpes 46 y C Cardenal Ilundain 18, Portal 2, con depósito de 1000 L sin precio**. Los grupos y depósitos reutilizados van a 0 a propósito y no avisan.
- **Quitada la lectura de parámetros viejos** (cortes de V-EXT por metros y días por vivienda de enganche exterior e interior fácil): no estaban en el Sheet ni los usaba ninguna fórmula.

---

# 6. `bot-whatsapp.cjs`
> **Estado: completo según la lista fija de §0.24 — 7 de 7 puntos, con pasada completa del fichero, incluidos el tratamiento de imagen/PDF y las llamadas a la IA (24/09/2026; incongruencias en §9.5)**: rutas (§6.11), pestañas del Sheet (§6.12), funciones principales (§6.1-6.10, §6.13, §6.17 contratos en fase 08), relaciones con los otros ficheros (§6.12 y §6.16), automatismos (§6.5, §6.13, §6.15), configuración editable (§6.14) y trampas/optimizaciones (§6.19-6.20). Las funciones auxiliares (formato de fechas, etiquetas, listas) no se nombran una a una: están cubiertas por el mecanismo que las usa.

**Guion de funcionamiento**: bot conversacional por WhatsApp (vía Twilio) que pide documentación a los vecinos según el tipo de piso que tengan asignado, valida lo que mandan con IA (imagen/PDF), hace seguimiento proactivo y sube los ficheros aceptados a Google Drive. Fue extraído de `index.cjs` el 2026-05-31 (antes vivía todo junto). Es el fichero con más funciones sueltas de todo el programa (~130), pero la mayoría son piezas pequeñas y autocontenidas — el tamaño viene de la cantidad de casos a cubrir, no de unas pocas funciones gigantes como en `presupuestos.cjs`.

**Relación real con `presupuestos.cjs` y `documentacion.cjs`**: expone `app.locals.botWhatsapp.enviarPresentacionPiso`, y `presupuestos.cjs` la usa al activar el switch M→W de un piso (pasar un piso de manual a bot) — es el disparador del primer mensaje de presentación al vecino. Desde v19.98 expone además `enviarContratoPiso` y `contratosBotComunidad`, que usa `documentacion.cjs` para mandar el contrato en fase 08 (§6.17). **Desde v19.114-v128 expone bastantes más** (recontado en el repaso del 23/10/2026; todas en `app.locals.botWhatsapp`): `reabrirSiFinalizado` (ficha reabierta, §6.16), `responderVecino` (contestar por el robotito), `enviarAvisoM` (avisos M por el bot), `pedirContacto` (v128), `programarEnvio` / `enviarOProgramar` / `horarioBot` (horario, v127), `cambiarTipoVecino` / `avisarCambioTipo` (v126), `buscarPdfsContratoPiso` (el 📧 de la 08) y `salud` (estado del job para el aviso de sistema de HOY). Las usan `presupuestos.cjs` (HOY) y `documentacion.cjs` (caja de la ficha). **Cambiar el nombre o los parámetros de cualquiera rompe esas pantallas.** El resto de la coordinación entre el CRM y el bot va por el Sheet (fases, `bot_piso_activo`). **En sentido contrario, el bot depende de** `presupuestos.cjs` (`normalizarFase`, la lectura compartida `_leerRangoCorto`, `obtenerTextoTwilio` y, desde v139, `PLAZO_DOC_INICIAL`), de `horario-bot.cjs` (el horario, §3.22.3.4 bis) y de lo que escriben los demás en el Sheet: W/M y estados de `pisos` (AV, AC-AS, AW, marcas manuales de `bot_documentos`), la fase de `comunidades` y la foto congelada de Plan 5 (importes de la forma de pago). **Escribe en pestañas ajenas** `pisos` AM (forma de pago, §6.8) y AR/AS (REVISAR en la 08, §6.17). Columnas compartidas y riesgos: mapa de relaciones del capítulo 1.

## 6.1 El webhook `/whatsapp` — cómo entra un mensaje
1. **Deduplicación** por `MessageSid` (mapa en memoria con TTL, limpiado cada 5 minutos) — si Twilio reintenta el mismo webhook (les pasa si tardamos en responder), se ignora.
2. **Filtro bot** (`modoBotTelefono`): se atiende si el piso del vecino tiene `bot_piso_activo=BOT_WHATSAPP` y su comunidad está en fase `05_DOCUMENTACION` (modo "05", `pisoActivoParaBot`, el flujo de documentación de siempre), **o** si está en `08_CYCP` y el bot ya le mandó el contrato (col AG de su ficha rellena; modo "08", §6.17). Un vecino de fase 08 al que el bot no le ha mandado el contrato no recibe respuesta, como desde v19.93. El modo viaja con el mensaje (`req._modoBot`, también al trabajo en segundo plano) y, si es "08", el mensaje va entero a `manejarFase08` y no pasa por los 7 manejadores de la 05. La fase se normaliza con `normalizarFase` del CRM. Si no, el bot **guarda silencio total**, no contesta nada. **Desde v126** (criterio de Guille 18/10/2026), si el teléfono es de algún piso de `pisos` (`_telEnPisos`), lo que escribe se **guarda** en `bot_contactos` con tipo `texto_fuera` (o `archivo_fuera` si manda un archivo, que no se descarga) para el aviso **Ha respondido** de HOY (§3.16.3.1); sigue sin contestarle. Un teléfono que no está en ningún piso se sigue ignorando sin guardar.
3. **Mensajes de solo texto**: se procesan síncronos, pero encolados por teléfono con `withLock` — una cola de promesas encadenadas por número (no un `Set`/mutex simple): si llegan 3 mensajes seguidos del mismo vecino, se procesan en orden uno detrás de otro, ninguno se descarta ni se pisa.
4. **Mensajes con archivo adjunto**: se responde a Twilio DE INMEDIATO con un ack ("documento recibido") para no arriesgarse a que Twilio dé timeout esperando la respuesta, y el procesamiento real (bajar el archivo, validarlo con IA, subirlo a Drive) ocurre después en segundo plano (`setImmediate` + `withLock`); la respuesta de verdad al vecino se manda aparte, como un mensaje saliente nuevo (`enviarWhatsApp`), no como respuesta al webhook.

## 6.2 Los 6 flujos de documentos (`FLOWS`)
Cada tipo de expediente (`propietario`, `familiar`, `inquilino`, `sociedad`, `local`, `financiacion`) tiene su propia lista ordenada de documentos a pedir (`FLOWS[tipo]`, cada paso con su `code` y el texto exacto — con emoji y formato WhatsApp — que se manda al vecino). `REQUIRED_DOCS` marca cuáles son obligatorios y cuáles opcionales (solo `empadronamiento` es opcional en casi todos). Hay además una tabla de numeración (`TIPO_NUM` + `NIVEL_DOC`) que decide el nombre de archivo con el que cada documento se sube a Drive, agrupando por "nivel" visual (p.ej. las dos caras del DNI del propietario comparten nivel con las del DNI del administrador en `sociedad`, aunque sean flujos distintos) para que el orden de las carpetas sea consistente entre tipos de expediente.

**Dónde se guarda el resultado y cómo lo ve Guille**: cada documento recibido y clasificado se escribe en la pestaña de Sheet `bot_documentos` — la misma que lee `documentacion.cjs` para pintar el acordeón de un piso BOT. El circuito completo (de qué código usa el bot a qué código usa la pantalla, la tabla de traducción, y cómo Guille puede corregir algo a mano) está documentado en §4.4, no se repite aquí.

## 6.3 Validación de un documento recibido — dos comprobaciones independientes
> **v19.118 — con la IA dormida** (banda "IA del bot", §3.22.3.4): de lo que sigue solo funciona la validación técnica (foto del DNI); la IA no se llama (`iaActiva()` corta `llamarIAconImagen`, `llamarGPT4oConImagen`, `responderConIA` y `detectarNecesidadHumano`) y el documento queda en REVISAR con motivo `[sin_ia]`, que al vecino se le dice como recibido (`mensajeParaVecino`).
Cuando llega un archivo, pasan DOS análisis por separado que luego se combinan:
1. **Validación técnica** (`validarImagenTecnica`): calidad de la imagen — tamaño, nitidez, brillo, contraste — contra unos umbrales configurables por Sheet (5 niveles de exigencia: `muy_tolerante` a `muy_estricto`, ver `EXIGENCIA_PRESETS`). **Solo se aplica a fotos de DNI** mandadas como imagen: al resto de documentos y a los PDF no se les mide la calidad (medir un documento escaneado como si fuera una foto daba falsos "borrosa").
2. **Clasificación por IA, independiente del paso actual** (`clasificarDocumentoConIA`; las llamadas a la IA con imagen tienen un tiempo máximo de 15 s (`IA_TIMEOUT_IMAGEN_MS`, van en segundo plano) y las de texto, de 7 s; los análisis del DNI —qué cara es y si vienen las dos caras en una misma foto, §6.7— usan GPT-4o, y todo lo demás —clasificación, solicitud, documentos largos, genéricos y las respuestas de texto libre— GPT-4o-mini): identifica QUÉ documento es en realidad, sin dar por hecho que es el que tocaba pedir — esta es la pieza central de la "lógica anti-confusión documental" (comentario textual del propio código). **`analizarDocumentoConIA` enruta cada tipo a un analizador especializado distinto**, no es un único prompt genérico: DNI tiene su propio analizador (`analizarDNIconIA`), la solicitud de EMASESA el suyo (`analizarSolicitudFirmadaConIA`), los documentos largos de varias páginas (contrato de alquiler, escritura, poderes, licencia, libro de familia) otro (`analizarDocumentoLargoConIA`), y el resto cae en un analizador genérico.

`decidirContextoDocumento` cruza el tipo detectado con el que se esperaba y decide entre **3 resultados**: **coincide** (es el documento correcto — incluye el caso "es el DNI correcto pero la cara que no tocaba", que también cuenta como coincidencia, con un aviso de qué cara hacía falta), **diferente_flujo** (es un documento reconocido que SÍ pertenece a algún paso de este mismo flujo, solo que no es el que se estaba pidiendo ahora mismo — p.ej. manda el contrato de alquiler cuando tocaba el DNI), **ajeno** (no se reconoce como ningún documento de este flujo, o no se pudo identificar). `determinarEstadoFinal` combina el resultado técnico con el de la IA con prioridad fija: **REPETIR** (mala calidad) siempre gana sobre **REVISAR** (dudoso, requiere ojo humano), que gana sobre **OK**. **REVISAR se guarda internamente con 4 subtipos** (para trazabilidad en el Sheet, sin cambiar lo que ve el vecino): `revisar_calidad` (imagen técnicamente dudosa), `revisar_contenido` (documento identificado pero con algún problema, p.ej. de firma), `revisar_clasificacion` (la IA no pudo identificar bien el tipo), `revisar_pdf` (un PDF que no se puede clasificar visualmente).

## 6.4 Estados de la conversación
Cada expediente tiene `paso_actual` (dónde está en la conversación: `pregunta_tipo`, `recogida_documentacion`, `pregunta_financiacion`, `recogida_financiacion`, `finalizado`...) y `documento_actual` (qué se le está pidiendo ahora mismo, uno de los `code` de `FLOWS`). `obtenerSiguienteDocumentoReal` decide cuál toca a continuación mirando lo ya recibido y los opcionales descartados; `getPromptPasoActual` construye el texto a enviar.

**Forma de pago (v128, 21/10/2026, criterio de Guille)**:
- **Cómo funciona (igual que siempre)**: al terminar los papeles el bot pregunta la forma de pago. «De una vez» deja la casilla vacía (`pisos` col AM), que la ficha enseña como **Contado**, y cierra; 6, 12 o 18 meses se guardan y el bot pide los papeles de la financiación. En la ficha, Contado es la casilla vacía (por defecto).
- **Sin opción FFCC**: un vecino no elige la financiación comunitaria por su cuenta, la decide la comunidad y la pone Guille en la ficha, piso a piso. La pregunta va de 1 a 4; un «5» o «comunitaria» no vale y se le repite la pregunta (`mapFinanciacion`, `plazoFinanciacion`).
- **Con lo que le toca pagar**: la plantilla `flujo_pregunta_financiacion` (de Guille, en Flujo bot) lleva las marcas `{pago_1}`, `{pago_6}`, `{pago_12}` y `{pago_18}`, que el bot cambia por « (1.168 €)» (de una vez, sin «unos») y « (unos 199 €/mes)» (plazos); todo sin céntimos (criterio de Guille). Salen de la **foto del presupuesto Plan 5 cerrado** de su comunidad (`plan5_toma_datos`: la foto de la columna I y, si está vacía —cerrados antes del 23/09/2026—, la de dentro de G, `datos_json.snapshot`; de ella, `cuadro.comunero`, `fin6`, `fin12`, `fin18`; desde la v140, antes solo miraba G; caché 10 minutos; `_cargarImportesP5`, `importesComunidad`, `buildPreguntaFinanciacion`). Sin presupuesto cerrado con importes (el 21/10/2026 los tenían 25 de 66), las marcas quedan vacías y la pregunta sale sin cantidades. La comunidad se enlaza por la dirección sin el tipo de vía («C MALVALOCA 1» → «Malvaloca 1»).
- **Sin preguntar cuando ya se sabe** (criterio de Guille: "ya sabemos la forma de pago y no hay que preguntar ni pedir nada"; `preguntaOFinFinanciacion`, en todos los sitios donde el bot iba a hacer la pregunta): si la ficha tiene **FFCC o IPREM** → cierra («Documentación recibida correctamente» y aviso al equipo); **6, 12 o 18** → pide los papeles de la financiación que falten (si ya los tiene, cierra); **vacía (Contado)**: la primera vez pregunta, como siempre; con la ficha **reabierta** (`bot_expedientes` col AB «REABIERTA …»: ya contestó en su día) la da por Contado y cierra sin volver a preguntar. Para que a un vecino no se le pregunte, la forma de pago tiene que estar puesta **antes** de que termine los papeles.
- Los que contestaron «5» antes de este cambio se quedan con FFCC (Malvaloca 1 4C, 7B, 9B y Doctor Fedriani 17 0-4, 1-4, 3-2, 3-3, 3-4): Guille los corrige a mano en la ficha si no es FFCC.

**El router real de cada mensaje entrante — cadena de responsabilidad, no un switch por estado** (`manejarMensajeWhatsApp`): antes de nada, comprueba que el teléfono esté en `pisos` (`buscarVecinoPorTelefono`). Si no está, **el bot guarda silencio** (criterio de Guille, 02/10/2026); en la práctica no llega a pasar, porque el filtro bot del webhook (§6.1) ya ha descartado cualquier teléfono que no esté en `pisos`. Si el teléfono es conocido, busca su expediente y, si es la primera vez que escribe, lo crea sobre la marcha (`crearExpedienteInicial`). Con el expediente ya en mano, el mensaje pasa por **8 manejadores en un orden fijo**, cada uno devolviendo la respuesta si le toca a él, o `undefined` para que se pruebe el siguiente:
1. `handlePreguntaTipo` — si el vecino está en el paso de decir qué es (propietario/familiar/...).
2. `handleListoDocumentoLargo` — si contesta que ya ha mandado todas las páginas de un documento de varias páginas. Desde v19.118 vale "1" (lo que pide `flujo_pagina_recibida`), "listo", "sí", "ya", "ok", "vale", "todas"…; con cualquiera que no sea "listo" y sin páginas recibidas, sigue el flujo normal.
3. `handleTextoLibreVecino` (v128) — con la IA dormida, clasifica el texto con contenido en pregunta/queja, aviso o corto, y decide si el bot se para (detalle en §6.10).
4. `handleTextoRecogidaDocumentacion` — texto suelto mientras se están pidiendo documentos (p.ej. "no tengo ese documento").
5. `handlePreguntaFinanciacion` — si está en el paso de decidir si financia.
6. `handleTextoFinanciacion` — texto suelto durante la recogida de datos de financiación.
7. `handleArchivos` — si el mensaje trae una foto o PDF adjunto (y quita la pausa de una pregunta, §6.10).
8. `handleRespuestaGenerica` — el que responde a todo lo que ningún manejador anterior entendió (el catch-all).

**Si ninguno de los 8 se hace cargo** (no debería pasar, pero el orden importa: cambiar la secuencia puede hacer que un manejador "robe" un mensaje que le tocaba a otro más adelante en la cadena), no hay respuesta y el vecino se queda sin contestación — por eso `handleRespuestaGenerica` va siempre el último, como red de seguridad.

## 6.5 Job de seguimiento proactivo (cron, cada hora) y avisos por plazo
**v128: no le manda nada a quien espera respuesta** (col AD = "PREGUNTA …" sin contestar, §6.10): ni recordatorios ni reenvíos hasta que Guille conteste o el vecino mande un archivo. **v127: solo dentro del horario de comunicaciones** (Flujo bot, §3.22.3.4 bis; por defecto L-V 9:00-20:00): fuera de él no manda nada y lo deja para la primera pasada con el horario abierto; esa pasada callada cuenta como **repaso bien hecho** para el aviso de sistema de HOY («El repaso automático del bot no ha terminado…», que salió la primera noche, 20/10/2026, por arrancar el servidor fuera de horario). `ejecutarJobSeguimiento` arranca a los 2 minutos de encender el servidor y después cada hora (también se puede lanzar a mano con `/ejecutar-job`, §6.11). Recorre todos los expedientes de `bot_expedientes` y, solo para pisos que pasan el filtro bot (`pisoActivoParaBot`: piso en W y comunidad en fase 05; desde v19.93 solo 05; **en fase 08 el job no hace nada**, tampoco con los contratos del bot: los plazos de la 08 los lleva Guille con M3/M4), trabaja en dos pistas:
- **Recordatorio de presentación**: vecino que recibió la presentación y sigue en `pregunta_tipo` sin contestar. Dos niveles por días sin respuesta (`t_presentacion_1`, `t_presentacion_2`); en cada nivel se reenvía la plantilla Twilio `presentacion`. Si no existe ninguna de las dos filas en `bot_plantillas`, esta pista no hace nada.
- **Recordatorio de documentos pendientes** (pasos de recogida o financiación, con `documentos_pendientes`): `construirAvisoPorPlazo` decide el nivel. Primero mira la **inactividad** —días sin que el vecino escriba, `t_inactividad_1`/`t_inactividad_2`, lo que en Plantillas del bot se llama "Sleep"—; si no toca, mira el **plazo total** desde el primer contacto —`t_plazo_1`, `t_plazo_urgente`, `t_plazo_fuera`—. Desde el job siempre se manda la plantilla Twilio `recordatorio` con la lista de lo que falta (en una línea, separada con " · ": las variables de Twilio no admiten saltos de línea): fuera de la ventana de 24 h de WhatsApp no se puede mandar texto libre, solo plantillas aprobadas.

**Desde qué día cuentan los avisos por plazo: el día común de la comunidad (v19.117, criterio de Guille 17/10/2026)**: los días de los avisos por plazo (10/18/20), la prioridad y la intervención humana (§6.6), el "quedan X días" del Wake up y la IA de texto no cuentan desde el primer contacto del propio vecino, sino desde el **día común** de su comunidad: la `fecha_primer_contacto` (col J de `bot_expedientes`) más antigua de esa comunidad, la misma que usa el CRM para la fecha límite (`_fechaContactoBot` / `_fechaLimiteDocBot`). Así un vecino que entra tarde (piso vendido, teléfono nuevo; caso Fernando Romero, Ardilla 9 2-26, 17/10/2026) **se comporta como si el bot le hubiera escrito el primer día**: sus avisos salen los mismos días que a los demás y, si entra pasado un nivel, al contestar recibe directamente el nivel que toca (uno solo, nunca los atrasados). Su propia col J **no se toca**: con ella siguen funcionando la presentación, sus dos reenvíos y la detección de "primera respuesta" (vídeo). La fecha límite que se guarda al crear la ficha (col L) también sale del día común + 20. Código: `_anclaPlazoBot` (lee `bot_expedientes!A:J` con la lectura compartida de 60 s); sin comunidad o sin datos usa la propia.

**Documentos de varias páginas sin cerrar (v19.118/v19.119)**: antes de los avisos, el job cierra el documento largo de un vecino que mandó páginas y no contestó en 15 minutos (`autoCerrarDocumentoLargo`, que también lanza un temporizador en memoria al recibir cada página). Cuentan las páginas de los últimos 7 días (`VENTANA_PAGINAS_MS`; antes 4 h y no cerraba nada pasado ese tiempo). El mensaje ("documento recibido completo" + lo siguiente) solo se manda si el vecino escribió hace menos de 23 h (ventana de WhatsApp); si no, se cierra sin mensaje. El job carga las plantillas del Sheet al empezar (`cargarPlantillas`, v19.119): antes, si desde el arranque no había entrado ningún mensaje, salía sin textos ni recordatorios.

**Cómo no se repite un aviso**: el nivel mandado se guarda en `alerta_plazo` (columna O de `bot_expedientes`); el job solo manda si el nivel que toca es distinto del guardado, y nunca baja de nivel. Cada envío se apunta en `bot_avisos` y en `bot_contactos` (§6.12). Pausa de 1,5 s entre envíos para no saturar Twilio.

**La otra mitad, dentro de la conversación** (`revisarYAvisarPorPlazo`, se ejecuta cuando el vecino escribe): si el vecino estaba "dormido" por inactividad y vuelve a escribir, se le manda una vez el texto `msg_inactividad_1` ("Wake up"), se limpia `alerta_plazo` y el ciclo puede volver a empezar. Si en ese momento ha entrado un nivel nuevo de plazo total, se le añade el texto `msg_plazo_1` (con los días que le quedan). Estos sí son textos libres porque el vecino acaba de escribir.

**Sin textos ni días por defecto en el código**: si una fila de tiempo no existe en `bot_plantillas`, ese aviso no se manda (a propósito, para que todo se controle desde Plantillas del bot).

**Textos sin días (criterio de Guille, 25/09/2026)**: `msg_inactividad_1` (Wake up) y `msg_plazo_1` ya no llevan `{dias}`. El bot cuenta siempre 20 días fijos y no conoce la prórroga de la comunidad; con los días en el texto, durante la prórroga le decía al vecino "quedan 0 días" mientras el M2 de Guille le daba la fecha ampliada. Criterio: **los plazos se los comunica Guille con M1-M4 (que sí conocen la prórroga); el bot solo recuerda qué documentos faltan.** Si se vuelve a poner `{dias}` en esos textos, reaparece la contradicción. Ojo también con el texto de la plantilla Twilio `recordatorio`, que vive en Twilio (no en el Sheet): no debe mencionar días ni "fuera de plazo".

**Filas sobrantes en `bot_plantillas`**: `msg_plazo_urgente` y `msg_plazo_fuera` tienen texto pero **nadie las lee**: el bot usa un único texto (`msg_plazo_1`) para los tres niveles y la pantalla solo muestra ese. Son restos del sistema anterior; se pueden desactivar o borrar sin efecto.

## 6.6 Prioridad e intervención humana — la relación real con la caja "Avisos" de HOY
El bot calcula, para cada expediente, dos indicadores que **se escriben en `bot_expedientes`** (columnas `prioridad_expediente` y `requiere_intervencion_humana`) y que **`presupuestos.cjs` lee directamente para construir la caja "🔔 Avisos" de la pantalla HOY** — es la relación de código más directa entre `bot-whatsapp.cjs` y HOY, más allá de `enviarPresentacionPiso` (§3.13).

**`requiere_intervencion_humana` se pone a "sí" si se cumple CUALQUIERA de estas condiciones** (`calcularRequiereIntervencion`):
- Han pasado ≥18 días desde el día común de la comunidad (§6.5, v19.117) y todavía hay documentos pendientes (plazo ya crítico).
- Han pasado ≥10 días con pendientes Y la prioridad ya era "alta".
- La prioridad ya es "alta", sin más condición.
- Un documento considerado crítico (`solicitud_firmada`, `justificante_ingresos`, `titularidad_bancaria`) llegó como PDF y se quedó sin clasificar (`subtipo === "revisar_pdf"`).
- Un mismo tipo de documento ha fallado la validación (`REPETIR`) **3 veces o más** (v19.92: el mismo umbral que el aviso al equipo "falla 3 veces", §6.15).

**`prioridad_expediente`** empieza en un valor base (`calcularPrioridadExpediente`, por documentos) y sube dinámicamente solo por cercanía de plazo: a partir de 18 días con pendientes sube siempre a "alta"; a partir de 10 días, si estaba en "baja", sube a "media".

**Cuándo se recalculan**: solo en memoria dentro de `calcularIndicadoresOperativosEnMemoria` — no escriben nada por sí mismas, es `recalcularYActualizarTodo` quien hace la escritura final a Sheet. Esto alimenta el aviso "Faltan documentos" de HOY (hoy retirado de la caja de Avisos, ver §6.16; las columnas se siguen calculando).

## 6.7 Procesamiento de imagen y PDF antes de validar
Lo que pasa con un archivo entre que llega de WhatsApp y que se manda a la IA a clasificar.

**`normalizarImagenDocumento`**: pipeline con la librería `sharp` en 3 pasos, cada uno con su propio motivo — (1) auto-rotación según los metadatos EXIF de la foto (un móvil puede mandar la foto "tumbada" aunque se vea bien en la pantalla), (2) recorte del margen blanco/uniforme sobrante (frecuente cuando alguien fotografía media hoja de A4 con mucho margen), (3) redimensionado a máximo 1800×1800 + realce en dos capas: normalización por percentiles (ignora los píxeles sueltos totalmente negros o blancos, que hacían inútil la normalización clásica) y **CLAHE** (contraste local — es lo que saca a la luz texto tenue, como el código MRZ del DNI, sin sobre-exponer el resto de la imagen). Si la versión de `sharp` no soporta CLAHE, cae a una versión más simple sin romperse.

**`recortarCaraDNISiCombinada`**: caso especial y bastante ingenioso — si el vecino fotografía **las dos caras del DNI juntas en una sola foto** (anverso y reverso en el mismo encuadre), se le manda la imagen a GPT-4o con un prompt específico que detecta si hay 1 o 2 caras, cómo están dispuestas (horizontal/vertical) y en qué mitad está la cara con la foto de la persona. Con esa respuesta, se **recorta automáticamente solo la mitad que toca** (el anverso si se está pidiendo "delante", el reverso si se pide "detrás") usando `sharp().extract()` sobre la región calculada. Si la IA no está segura de la disposición, no se recorta nada y se marca `combinada: true` para que el flujo lo sepa.

**PDFs de varias páginas**: `renderizarPaginasPDF`/`renderizarPrimeraPaginaPDF` convierten páginas de un PDF a imagen (para poder pasarlas por el mismo análisis de IA que una foto), con un tope de páginas (20 por defecto) y un tiempo máximo de 60 s (`pdftoppm` a 200 ppp, v19.92). Si el PDF tiene varias páginas, la primera se guarda como `…_p01.jpg` y las demás van detrás como páginas extra del mismo documento.


## 6.8 El flujo de financiación — la única excepción que escribe directo en `pisos`
Tras terminar los documentos obligatorios de un flujo con `fin:true` (§6.2), el bot pregunta si el vecino quiere financiar el pago. Dos lecturas distintas de la misma respuesta:
- **`mapFinanciacion`**: la reduce a un sí/no simple (reconoce números 2-4, "sí", o palabras como "plazos"/"interesa"/"mes" → sí; "1", "no", "una vez", "contado" → no). Desde v128 **"5" y "comunitario" ya no valen**: devuelve nada y se repite la pregunta (§6.4, sin opción FFCC).
- **`plazoFinanciacion`**: la traduce al plazo exacto elegido — "" (pago único/contado), `"6"`, `"12"`, `"18"` (meses). FFCC (financiación comunitaria) e IPREM ya no los elige el vecino: los pone Guille en la ficha, y el bot entonces no pregunta (§6.4).

**Dato arquitectónico importante**: `guardarFinanciacionEnPiso` escribe ese plazo directamente en `pisos!AM`, localizando la fila por teléfono. **En la fase 05 es la única celda que el bot escribe directamente en la pestaña `pisos`** — todo lo demás del bot (documentos, estados, tipos) pasa por las pestañas propias `bot_documentos`/`bot_expedientes` (§6.6, §4.4). **En la fase 08 (v19.98) escribe además `pisos!AR` (contrato) y `pisos!AS` (pago)**, siempre con el valor `REVISAR`, buscando la fila por comunidad + vivienda (§6.17).

## 6.9 Estructura de carpetas en Drive — dónde acaba cada archivo
Cuando un vecino manda un documento, acaba en una estructura de **3 niveles** dentro de la misma carpeta raíz que ya usa Plan 5 para las fotos del edificio (`DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES`, §5.16 — es una relación real entre los dos módulos, comparten la misma raíz de Drive):

```
<raíz Plan 5>
 └─ "<tipo_vía dirección>"          (nivel 1 — la carpeta del expediente, la crea el programa)
     └─ "01 DOCUMENTACION BOT"       (nivel 2 — fija, siempre el mismo nombre)
         └─ "<vivienda>"             (nivel 3 — una por piso, nombre saneado)
```

**`getOrCreateCarpetaVivienda`** monta esta ruta buscando cada nivel (`buscarCarpeta`) y creándolo si no existe (`crearCarpeta`) — nunca duplica una carpeta ya creada. El nombre de la carpeta de expediente se arma buscando la dirección de la comunidad del vecino en la pestaña `comunidades` (`getTipoViaPorDireccion`: columna B dirección → columna K `tipo_via`) para sacar el `tipo_vía` real, no solo la dirección. Los archivos de la fase 08 (contrato y pago firmados) van a la misma carpeta del piso. **`sanitizarNombreCarpeta`** limpia el nombre de la vivienda antes de usarlo como carpeta: quita acentos, deja solo alfanumérico, espacios, guiones, `_` y puntos, cambia espacios por `_`, y corta a 60 caracteres (vacío → "sin_nombre") — evita nombres de carpeta que Drive rechazaría o que den problemas con caracteres raros.

**El estado del documento NO se refleja en la carpeta** — todos los archivos de una vivienda van a la misma carpeta plana, sea cual sea su estado (OK/REVISAR/INCORRECTO); el estado solo se añade al **nombre del archivo** (ver `nombreConEstado`), no a dónde se guarda.

**Confirmación cruzada**: `buscarVecinoPorTelefono` (el filtro de "número reconocido" del webhook, §6.1) lee de la pestaña **`pisos`**, no de `vecinos_base` — mismo patrón que ya vimos en `documentacion.cjs` (§4.2): `vecinos_base` está muerta en los dos módulos, no solo en uno.

## 6.10 Los manejadores de texto del dispatcher, por dentro
Completa el router de 8 pasos de §6.4:
- **`handleTextoLibreVecino`** (v128, criterio de Guille: «si alguien pregunta algo, que el bot pida ayuda y se pare»): solo con la IA dormida y en los pasos `recogida_documentacion`, `recogida_financiacion`, `pregunta_financiacion` y `finalizado`. **Todo texto con contenido llega a Pide ayuda** y se clasifica:
  - **Pregunta o queja** (lleva "?" o palabras como qué, cómo, cuándo, necesito, no entiendo, ya lo mandé, hablar con una persona, revisen…; sin tilde, "que/como/cuando…" solo al principio): contesta `flujo_pregunta_espera` y **el bot se para**: marca `bot_expedientes` col AD = "PREGUNTA <fecha>" y ni repite ni manda recordatorios (el job de cada hora se salta a quien espera). Lo que escriba en los 30 minutos siguientes llega a Guille sin nueva respuesta.
  - **Aviso** ("mañana lo mando"): contesta `flujo_aviso_vecino` y sigue.
  - **Corto** ("ok", "1", "gracias", saludos): como antes; mientras el bot espera, silencio.
  - Lo que sí es la respuesta del paso (forma de pago, saltar un opcional, el "1" de las páginas) sigue su camino y quita la espera.
  - **El bot sigue** cuando Guille contesta (robotito, o marcar el Pide ayuda: col AE = 1) o cuando el vecino manda un archivo.
  - **"1" sin ninguna página**: `flujo_largo_sin_paginas` («Todavía no nos ha llegado ninguna página de…») en vez de repetir la petición en bucle.
  - Con la IA despierta (`ia_activa` = SI) no actúa: manda la IA. **Se revisa el 29/10/2026 con los datos reales** (§8).
- **`handleTextoRecogidaDocumentacion`**: solo actúa si no hay archivo adjunto y el vecino está en el paso de recogida. **Desde v128, primero recalcula** qué le falta (marcas de la ficha y lo ya recibido, `resolverEstadoConversacional`): no le pide algo que ya entregó o que Guille marcó, y si ya lo tiene todo pasa a la forma de pago (un documento de varias páginas a medias no se toca). Después comprueba si toca un aviso de plazo; luego detecta si el vecino quiere **saltar un documento opcional** (`esIntencionSaltarOpcional`) — si es opcional de verdad y quiere saltarlo, marca el documento como descartado y avanza el estado. Si está en medio de un documento "largo" (varias páginas), solo le recuerda que siga mandando páginas. Si el mensaje es ambiguo o suena a que está confundido sobre en qué punto va (`esMensajeAmbiguo`/`esMensajeDeConfusionSobreEstado`), **recarga los datos frescos del Sheet** antes de responder (para no contestar con un estado en caché desincronizado) y da una respuesta guiada. Si nada de eso aplica, cae en una respuesta libre generada por IA (`responderConIA`).
- **`handleArchivoFueraDeFlujo`**: cuando llega un archivo que no encaja en ningún flujo reconocido, **no se rechaza** — se sube a Drive igual (carpeta de la vivienda, §6.9), se guarda en `bot_documentos` con el tipo `"adicional"` y la fuente `"fuera_flujo"`, y al vecino se le confirma que se ha añadido a su expediente "para revisión". Queda marcado para que alguien lo revise a mano, no se pierde.
- **`handleRespuestaGenerica`**: el catch-all final — según el paso en el que esté el expediente, recuerda qué documento falta, repite la pregunta de financiación, o (si ya está `finalizado`) interpreta frases sueltas típicas ("¿me falta algo?", "te mando otro") para responder con el estado real o esperar el archivo que anuncia que va a mandar.

**Detección de atención humana con IA** (`detectarNecesidadHumano`, disparada desde dentro de `handleArchivos` cuando el mensaje trae texto de más de 3 caracteres, no es un manejador aparte del dispatcher): manda el mensaje del vecino y el paso actual a GPT-4o-mini con un prompt que busca 4 señales — frustración/enfado, preguntas sobre plazos/costes/temas técnicos, situaciones especiales (propietario fallecido, disputa, hipoteca), o confusión grave que el bot no puede resolver. Si detecta alguna, **avisa al equipo** (`notificarEquipo`) y marca el expediente (`marcarAtencionHumana`) — sin interrumpir el flujo normal del bot, que sigue respondiendo con normalidad en paralelo. **Con la IA dormida (v19.118)** no se llama a OpenAI: todo texto del vecino con contenido (no saludos, números ni "ok") va a "Pide ayuda" y al equipo, y el bot contesta con `flujo_sin_ia`. Desde v121 `marcarAtencionHumana` añade cada mensaje nuevo detrás del anterior sin revisar (hasta 1000 caracteres) en vez de borrarlo.

## 6.11 Rutas del fichero y lo que necesita para arrancar
- **`POST /whatsapp`**: el webhook de Twilio, por donde entra cada mensaje de un vecino (§6.1).
- **`GET /enviar-presentacion`** (con token): envío masivo de la presentación. Recorre `pisos` y la manda a cada piso en W, con comunidad en fase 05 (v19.93), que todavía no tenga ficha en `bot_expedientes`. No lo usa ninguna pantalla: solo se lanza a mano por URL. Lo normal es la presentación de un solo piso al pasarlo de M a W (§6.13).
- **`GET /media/:tipo`** y **`/media/:tipo/:nombre`** (v127): hace de intermediario para servir los adjuntos que el bot manda al vecino (la solicitud de EMASESA, la autorización de usufructo y un vídeo) desde Drive con una URL fija que Twilio acepta. El nombre va en la dirección (`NOMBRE_MEDIA`, `urlMedia`: «toma datos», «autorizacion usufructo»), que es lo que enseña WhatsApp. Los tipos admitidos están en la tabla `MEDIA_DRIVE`; cualquier otro da 404.
- **`GET /media-tmp/:id/:nombre`** (v127, sin token; el id es secreto): sirve a Twilio el archivo que Guille adjunta al contestar por el robotito (o el PDF relleno de 📄 documento, v128). Vive 2 h en memoria y conserva el nombre con espacios y acentos.
- **`GET /ejecutar-job`** (con token): lanza el job de seguimiento (§6.5) sin esperar a la hora.
- **`POST /twilio-estado`** (v19.99, sin token; firma de Twilio como `/whatsapp`): Twilio avisa del estado de cada plantilla mandada a un vecino (§6.18).
- **`GET /media-contrato/:clave/:nombre`** (v19.98, sin token; la clave es aleatoria de 24 caracteres): sirve a Twilio el PDF del contrato (y la carta de pago) que se acaba de mandar a un vecino (§6.17). Vive en memoria 48 h: si se reinicia el servidor entre el envío y la descarga de Twilio (segundos), el envío falla. Hay además un PDF de ejemplo fijo, `/media-contrato/ejemplo/EJEMPLO.pdf` (registrado antes que la ruta general para que no lo tape), que es el ejemplo de {{4}} que pide Twilio para aprobar la plantilla.

**Variables de entorno de las que depende**: Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` — sin ellas arranca pero no envía nada; con `TWILIO_AUTH_TOKEN` y `BASE_URL` comprueba además la firma de cada mensaje que entra: mientras `TWILIO_VALIDAR_FIRMA` no valga `1` solo lo apunta en el registro, con `1` rechaza los que no cuadren), `WHATSAPP_EQUIPO` (teléfonos del equipo, separados por comas, para los avisos de §6.15; vacío = no se avisa), `OPENAI_API_KEY` (sin ella las funciones de IA no clasifican nada y devuelven vacío), Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_SHEETS_ID`), la raíz de Drive (`DRIVE_FOLDER_PLAN5_ENTRADAS_MANUALES`, o `GOOGLE_DRIVE_FOLDER_ID` si falta, §6.9), y `BASE_URL`/`ADMIN_TOKEN` para montar enlaces.

## 6.12 Pestañas del Sheet: qué lee y qué escribe el bot
- **`bot_expedientes`** — la ficha de cada vecino en el bot, **una fila por teléfono** (columna A). El bot usa las columnas A a Z y, desde v19.98, **AG `contrato_bot_enviado`** (fecha del primer contrato mandado por el bot), **AH `contrato_bot_hojas`** (hojas del contrato firmado recibidas y aún sin juntar, `idDrive:páginas,…`) y **AI `contrato_bot_ultimo`** (último envío del contrato); si la pestaña no llega a la AI, el bot la amplía (§6.17). Desde v19.99, **AJ `sin_whatsapp`** (fecha en que Twilio dijo que el número no tiene WhatsApp; la borra una entrega posterior) y **AK `sin_whatsapp_visto`** ("1" al marcar el check o pasar a M desde HOY), §6.18. Las columnas A a Z: datos del vecino, `tipo_expediente`, `paso_actual`, `documento_actual`, fechas (`fecha_primer_contacto` J, `fecha_ultimo_contacto` K, `fecha_limite_documentacion` L), `alerta_plazo` O, listas de documentos recibidos y pendientes, fallos y reintentos, `motivo_bloqueo_actual` V, `prioridad_expediente` W, `requiere_intervencion_humana` X. Las columnas AA a AF son marcas de los avisos de HOY que escribe `presupuestos.cjs` (§6.16), salvo las que escribe el bot: AC (texto del Pide ayuda), AE (se pone a vacío al pedir ayuda), AB (`REABIERTA`, v19.118) y AD (desde v128, la pausa "PREGUNTA <fecha>", §6.10; antes era la marca del retirado «Faltan documentos»). La leen también `presupuestos.cjs` (HOY, badges y avisos) y `documentacion.cjs` (fecha del primer WhatsApp de cada piso, para los plazos de fase 05).
- **`bot_documentos`** — una fila por archivo recibido, con su tipo, estado y enlace de Drive. La escribe el bot; `documentacion.cjs` la lee para el acordeón BOT de cada piso y la corrige a mano (§4.4).
- **`bot_avisos`** — registro de cada aviso mandado a un vecino (teléfono, tipo, fecha, origen: job, conversación o botón W). Es un cuaderno de lo enviado; no se usa para decidir nada.
- **`bot_contactos`** — registro de cada mensaje (fecha, teléfono, lo que escribió el vecino, tipo, lo que contestó el bot; desde v126, col E con el texto exacto de cada plantilla enviada, para la conversación espejo). Es el historial que enseña el robotito; también decide los colores del robotito (último mensaje del vecino) y los tipos `texto_fuera` / `archivo_fuera` de «Ha respondido» (§6.1).
- **`bot_programados`** (v127) — envíos programados para cuando abra el horario del bot (columnas A-I: cuándo, a quién, qué función, datos, estado —pendiente, enviado, error, `anulado`—…). La revisa `procesarProgramados` cada 5 minutos (§3.22.3.4 bis).
- **`bot_plantillas`** — toda la configuración editable (§6.14). El bot solo la lee; la escribe la pantalla Plantillas del bot de `presupuestos.cjs`.
- **`pisos`** — la lee para saber si un teléfono es de un vecino conocido, su comunidad y si su piso está en W (`bot_piso_activo`, col AV); en fase 08 lee también disidente (AQ), contrato (AR) y pago (AS). Escribe el plazo de financiación en la col AM (§6.8) y, en fase 08, `REVISAR` en AR/AS (§6.17).
- **`bot_plantillas`**, fila **`contrato_cycp`** (v19.98): el código HX de la plantilla Twilio del contrato; la crea la pantalla Plantillas del bot al guardar su HX por primera vez (§3.22).
- **`comunidades`** — la lee para la fase de la comunidad (filtro bot) y el tipo de vía (carpeta de Drive); en fase 08, también `est_ccpp_pago` (AY: si es FFCC, solo se manda y se pide el contrato). No la escribe: el cambio de la fecha de envío de contratos al mandar el primero lo hace `documentacion.cjs` (§4.7).

## 6.13 Cómo arranca un vecino con el bot (la presentación)
1. **Pasar el piso de M a W** en la caja de documentación. `presupuestos.cjs` llama a `app.locals.botWhatsapp.enviarPresentacionPiso` (una de las funciones que el bot expone, §6). Si el teléfono ya tiene ficha en `bot_expedientes`, no hace nada ("ya presentado"): **la presentación solo se manda una vez por teléfono**, aunque se vuelva a M y a W. **Desde v139**, si la plantilla `presentacion` de Flujo bot está desactivada o sin código, no se manda nada, no se crea la ficha y se devuelve `sin_plantilla` (la caja de documentación lo avisa); lo mismo en la tanda de presentaciones y en los reenvíos del job.
2. Si no tiene ficha, manda la plantilla Twilio `presentacion` (el hueco {{1}} lleva el nombre limpio, ver abajo) y crea la ficha (`crearExpedienteInicial`): paso `pregunta_tipo`, fechas de inicio, primer y último contacto = ahora, y `fecha_limite_documentacion` = ahora + 20 días. También deja creada en Drive la carpeta de esa vivienda (§6.9; la función se llama `crearCarpetaNotaSimple` por su uso antiguo, pero hoy crea la carpeta de la vivienda), y apunta el envío en `bot_avisos`.
3. **Cuando el vecino contesta por primera vez**, recibe el vídeo explicativo y la pregunta de qué es (propietario, familiar, inquilino, sociedad, local).
4. **Al elegir tipo**, recibe el texto de bienvenida de su tipo y, 1 s después, los PDFs que le tocan por `/media` (la solicitud de EMASESA; y si es familiar, también la autorización del propietario). A partir de ahí empieza la recogida de documentos (§6.2-6.4).

**Nombre limpio en las plantillas de Twilio (v19.98, criterio de Guille)**: `limpiarNombreVecino` quita del nombre de la pestaña `pisos` los prefijos entre paréntesis ("(T) ", "(U) ", "(?) "), lo que va detrás de " / " y los paréntesis del final ("(HIJO DE …)"); si no queda nada, "vecino". Se usa en los tres envíos de la presentación (botón W, reenvíos del job y `/enviar-presentacion`) y en el {{1}} del recordatorio del job. No cambia lo guardado (ni en `pisos` ni en la ficha), solo lo que se envía. **Desde v127/v128 el nombre de partida es otro** (`nombreDirigido` / `nombreParaPiso`): el primer titular de la Nota simple (pisos col D); para los de tipo familiar, el nombre de arriba (col E); sin Nota simple, el de arriba. `limpiarNombreVecino` se aplica después.

La fecha del primer contacto (col J) es la **fecha de arranque de la fase 05**: de ella cuentan los plazos de documentación de la ficha y de HOY (§3) y los avisos M1 y M2 (§6.16).

## 6.14 Configuración editable: la pestaña `bot_plantillas`
Todo lo que se cambia desde la pantalla Plantillas del bot (§3.22) acaba en una fila de `bot_plantillas` con una **clave** (columna A), un texto o número (D), un SID de plantilla Twilio (E) y activo SI/NO (G). El bot la lee en una caché que se refresca como mucho cada 60 s, así que un cambio tarda hasta un minuto en notarse. Cuatro formas de leerla, cada una con su regla:
- **Textos** (`txtPlant`): si la fila existe, está activa y tiene texto, se usa ese; si no, el texto que haya en el código como respaldo (en los avisos por plazo no hay respaldo: sin fila, no se manda).
- **Plantillas Twilio** (`sidPlant`): si la fila está desactivada, **no se envía nada**; si no tiene SID, se usa el que hay en el código.
- **Días** (`tiempoAviso`) y **on/off** (`avisoActivo`): de las filas `t_...`; sin fila, el aviso se considera activo pero sin días, así que no salta. Excepciones con días de respaldo: los reenvíos de la presentación (`t_presentacion_1/2`: 1 y 3 si falta una de las dos filas) y la cuenta atrás del Wake up (`t_plazo_fuera`: 20).
- **Exigencia de fotos**: la fila `exigencia_fotos` elige uno de los 5 niveles de §6.3 (por defecto, normal).

Familias de claves: textos de la conversación (`flujo_...`, `bienvenida_<tipo>`, `doc_recibido`, `aviso_ok`, `aviso_revisar`, `error_...`, `seguir_expediente`), tiempos de avisos (`t_presentacion_1/2`, `t_inactividad_1/2`, `t_plazo_1`, `t_plazo_urgente`, `t_plazo_fuera`) y sus textos (`msg_inactividad_1`, `msg_plazo_1`), plantillas Twilio (`presentacion`, `recordatorio`, `equipo_...`) y los avisos manuales a vecinos `msg_wa_m1`…`msg_wa_m5` con sus días `t_wa_m1`…`t_wa_m3` (M4 y M5 no tienen día). **Estos últimos no los lee el bot**, sino `presupuestos.cjs` (HOY) y `documentacion.cjs` (botón de WhatsApp de cada vecino), ver §6.16.

## 6.15 Avisos al equipo y documentos que fallan
**Avisos al equipo** (`notificarEquipo`): WhatsApp a los teléfonos de `WHATSAPP_EQUIPO`, cada uno con su plantilla Twilio desactivable desde Plantillas del bot:
- **Documento a revisar** (`equipo_revisar_documento`): un documento queda en REVISAR con un motivo.
- **Intervención** (`equipo_intervencion`): un mismo documento llega a 3 fallos (REPETIR). Se avisa una sola vez: la primera vez que el vecino pasa a `requiere_intervencion_humana = si`.
- **Necesita un humano** (`equipo_atencion_humana`): la IA detecta frustración, dudas de plazos o costes o una situación especial en un mensaje (§6.10). Además guarda el mensaje en `bot_expedientes` (col AC) para que salga como "Pide ayuda" en HOY.
- **Expediente completo** (`equipo_expediente_completo`): el vecino ha entregado todo lo obligatorio.
- **Listo para financiación**: texto directo (sin plantilla) con el enlace a la ficha del vecino, cuando completa también la documentación de financiación.

**Cuando un documento falla** (REPETIR): se guarda cuál fue (`ultimo_documento_fallido`), cuándo, y hasta cuándo se le espera para repetirlo (`reintento_hasta`); mientras esa ventana está abierta, `motivo_bloqueo_actual` (col V) dice "documento_a_repetir". `motivo_bloqueo_actual` se recalcula siempre antes de guardar la ficha y resume en una palabra por qué está parado ese vecino (esperando documento, repetir, revisión interna, financiación, completo…). Los fallos repetidos del mismo documento son los que disparan el aviso de intervención y suben la prioridad (§6.6).

## 6.16 Los avisos a vecinos de HOY (M1 a M5) y su relación con el bot
Estos avisos salen en la caja "🔔 Avisos" de HOY (`presupuestos.cjs`) para que Guille escriba al vecino desde su propio WhatsApp, con el texto ya preparado. **Desde v126** los M1/M2/M3 que van por WhatsApp pueden salir **por el bot**, también solo al pulsar (ver "M por el bot" al final de este apartado). Cada uno se configura en Plantillas del bot (texto y, salvo el M4, día de aparición):
- **M1, M2 y M3 — cadena de avisos (v19.102)**: ver el bloque **CADENA DE AVISOS UNIFICADA** justo debajo. (Antes: M1/M2 solo a vecinos del bot en `pregunta_tipo`, días desde la presentación de cada vecino; M3 desde el día 11 sin mirar la prórroga.)

- **M4 — envío CyCP (fases 07 y 08, manual, sin día).** Texto con el contrato y la carta de pago para cada vecino (lo que necesitamos, formas de pago, a dónde mandarlo y fecha límite). No sale como aviso: en fase 08, el botón de WhatsApp de cada vecino abre un menú con "M4 · Envío CyCP" y "M5 · WhatsApp manual". **Desde v19.68 también en fase 07**, que es cuando se manda (justo antes de pasar a 08, el mismo día): fecha límite = hoy + 10; en fase 08 usa la fecha del paso a 08.
- **M5 — WhatsApp manual (sin día).** El mensaje personal (plantilla con "***** TEXTO PERSONALIZADO *****"). Es el que abre el botón de WhatsApp de cada vecino en cualquier fase (en fase 08, eligiéndolo en el menú) y el que llevan ya escrito las tarjetas "Pide ayuda" y "Completo" de HOY. **Renumeración v19.28**: el M5 es el antiguo M4. **Desde v19.103 sin respaldo** (regla 9): el botón personal usa solo `msg_wa_m5` y el envío CyCP solo `msg_wa_m4`; si falta o está desactivado, el botón avisa "Falta la plantilla Aviso M5 / Aviso M4 o está desactivada" (antes el M5 vacío tomaba el texto del M4 o del M3). Las tarjetas "Pide ayuda" y "Completo" de HOY llevan el M5 (sin él, el 💬 abre el chat sin texto).

**CADENA DE AVISOS UNIFICADA (v19.102, criterio de Guille 09/10/2026: "que ningún vecino se quede sin aviso inicial ni sin sus avisos, entre como entre, todo coordinado en fechas y avisos")**. Sustituye a las reglas anteriores de M1/M2 (solo vecinos del bot que no contestan) y de M3 (desde el día 11 sin mirar decisiones). La calcula un único bloque de HOY (`presupuestos.cjs`, "CADENA DE AVISOS UNIFICADA"), para las comunidades en **05** y en **08** (en 08, mientras no tengan el CyCP completo; **en ninguna de las dos si el contrato está resuelto** —col BN `fecha_contrato_resuelto`—: v19.105, criterio de Guille 10/10/2026, el expediente se cierra y no se avisa a ningún vecino):
1. **Día común por comunidad**: 05 = primer WhatsApp del bot a cualquier vecino (respaldo si no hubiera bot: el primer 05-INICIO DOC (VECINO) o el primer inicio por WhatsApp manual); 08 = envío de contratos (`fecha_envio_contratos_pagos`; respaldo, el correo 08-INICIO CYCP). Fecha límite = día común + 20 (05) / + 10 (08); con prórroga concedida, + los días de la prórroga. Mismas fechas para todos los vecinos.
2. **Nadie sin inicio**: vecino con algo pendiente del que no conste inicio → tarjeta **"Inicio pendiente"**. Inicio en 05 = presentación del bot (col J), correo 05-INICIO DOC (VECINO) o **WhatsApp manual de inicio** (pisos col AZ `INI`); en 08 = contrato por el bot (col AG), correo 08-INICIO CYCP (VECINO) o **M4** (col AZ `M4`). Botón: correo si está en M con email; 💬 con el texto de inicio (05) o el M4 (08) si va por WhatsApp manual (al abrirlo **queda apuntado** y la tarjeta se va); en W de la 05 sin presentación, sin botón ("presentación del bot sin enviar"). Check: "ya se le envió por otra vía" (col AZ). **Legado**: en comunidades que empezaron la 05 antes del 07/10/2026 o pasaron a 08 antes del 10/10/2026 el inicio se da por hecho (antes el WhatsApp manual no dejaba registro).
3. **Nadie sin avisos**: a **todo** vecino con algo pendiente (05: documentación no en verde; 08: contrato o pago pendiente; nunca a disidentes), esté en W o en M y haya contestado o no:
   - **05 · M1** (amable): mientras el plazo está vivo, desde el día `t_wa_m1` (10 desde el 13/10/2026), si no tiene M1.
   - **05 · M2 / 08 · M3**: **esperan a la decisión**. Al **conceder la prórroga**: amable, con la fecha ampliada (si no tiene ya un M2/M3). Al **pedir los disidentes** (con o sin prórroga; "Continuar sin enviar" cuenta): **duro** (si no tiene un M2/M3 de ese día o posterior). Plazo vencido sin decidir, o prórroga terminada sin pedir disidentes: **no sale nada** (no se dice nada que no sea verdad). Mínimo, los días `t_wa_m2` (21) / `t_wa_m3` (11).
   - El tono lo pone `{vence_el}` / `{consecuencia}` con la fecha vigente: en plazo, amable; vencida (solo ocurre ya con los disidentes pedidos), duro. La tarjeta dice "(amable)" o "(duro)".
4. **Cada uno por su camino**: **W** → 💬 con el texto del bot ("Le hemos enviado 3 mensajes automáticos…") si no contestó a la presentación, o con el **neutro** si ya contestó; **M con email en notas** → 📧 (abre la ficha con el correo 05-RECORDATORIO M1/M2 (VECINO) o 08-RECORDATORIO M3 (VECINO) ya escrito); **M sin email con móvil** → 💬 con el texto neutro; **sin móvil ni email** → sin botón ("llamar"), solo check.
5. **Marcado** (cualquiera vale): W con ficha del bot → cols AA (M1) / AF (M2); M3 → pisos col AY; el resto → pisos col **AZ `aviso_manual`** (`INI=fecha;M1=…;M2=…;M4=…`, ruta `hoy-bot-llamado` con campo `az:CLAVE`; si falta la columna AZ, la ruta la crea con su título); o el correo enviado (mail_historico). La tarjeta se quita al marcar.
Textos: M1/M2 del bot (Flujo bot, "Aviso M1/M2", primer cuadro); **neutros** en el segundo cuadro de esas tarjetas (`msg_wa_m1n`, `msg_wa_m2n`): punto 3 "Le recordamos que necesitamos {pendiente} para tramitar su contrato con EMASESA (…)" / "Aún no hemos recibido {pendiente} (…)"; **inicio por WhatsApp manual**: tarjeta "Inicio doc (WhatsApp manual · fase 05)" (`msg_wa_ini05`); M3 y M4 sin cambios. Los correos (tarjetas VECINO de Plantillas mail) llevan los mismos neutros con "(si necesita ayuda, puede responder a este Mail o escribirnos por WhatsApp al 634-379-632)". Todas estas filas están en el Sheet desde el 09/10/2026. **Sin respaldo (v19.103, regla 9)**: si un texto falta o está desactivado (col G de `bot_plantillas` distinta de SI; `activo` NO en `mail_plantillas`), la tarjeta de HOY sale igual pero **sin botón** y con "⚠ Falta la plantilla X o está desactivada"; en la ficha, el 💬 / el menú / el 📧 avisan con el mismo texto y no abren nada. Probado en el banco quitando y desactivando cada plantilla. **Probado en el banco** (09/10/2026) día a día con seis vecinos tipo (W sin contestar, W que contestó, M con correo, M con WhatsApp, M con fijo, M sin inicio) en 05 y 08: en plazo, M1, M1 enviado, vencido sin decidir, prórroga concedida, M2 enviado, fin de prórroga sin disidentes, disidentes pedidos, duro enviado, sin prórroga, vecino que entra tarde; fechas, tono y consecuencia correctos en cada caso.

**Dónde sale cada uno (criterio de Guille, 25/09/2026)**: los avisos **con fecha** salen solos en la caja Avisos de HOY; los **manuales** van en el botón 💬 de cada vecino en la ficha. Nunca se mezclan:

| | Automático en Avisos de HOY | Botón 💬 del vecino en la ficha |
|---|---|---|
| **Fase 05** | Inicio pendiente, M1 y M2 a todo vecino con algo pendiente (v19.102) | menú con **Inicio documentación** (apunta la fecha) y M5 (v19.102) |
| **Fase 08** | Inicio pendiente (contrato sin enviar) y M3 a todo vecino con contrato o pago pendiente (v19.102) | menú con M4 (envío CyCP; apunta la fecha desde v19.102) y M5 |
| **Fase 07** | — | **menú M4 + M5** (v19.68): el M4 se manda en la 07, antes de pasar a 08 |
| **Resto de fases** | — | abre directamente el M5 |

Las tarjetas "Pide ayuda" y "Completo" de Avisos llevan también el M5.

**M por el bot (v126, criterio de Guille 18/10/2026: "los mensajes siguen saliendo cuando yo pulso, pero ahora por el bot")**. Las tarjetas de la cadena de todo vecino con móvil (W o M, aunque tenga email; sin móvil, correo) llevan el robotito verde 🤖💬 en vez del 💬 blanco y el aviso sale por el número del bot con una plantilla de Twilio (vale fuera de las 24 h):

| Aviso de HOY | Plantilla | {{5}} fecha límite |
|---|---|---|
| 05 · M1 (amable, en plazo) y 08 · M1 | `plan5_recordatorio_m1` | la del plazo inicial |
| 05 · M2 y 08 · M3 amables (prórroga concedida) | `plan5_recordatorio_prorroga` | la de la prórroga |
| 05 · M2 duro (disidentes pedidos) | `plan5_aviso_vencido_doc` | la vigente (con prórroga, la suya) |
| 08 · M3 duro (disidentes pedidos) | `plan5_aviso_vencido_cycp` | la vigente |

{{4}} lo que falta: en 05 "la documentación de su vivienda"; en 08 el contrato y/o la carta de pago. Envío: `enviarAvisoM` de `bot-whatsapp.cjs` (código HX solo de `bot_plantillas`, pegado en Flujo bot; sin él o desactivada, no se envía), que lo apunta en `bot_contactos` (tipo `bot`, sale en la conversación) y `bot_avisos`. Encendido, al enviar se marca el check de la tarjeta como siempre (cols AA/AF, AY o AZ), así que la cadena sigue igual. Si el vecino contesta al bot: si el bot trabaja con él (W en 05) le sale a Guille como **Pide ayuda**; si no, como **Ha respondido** (§3.16.3.1).

**M1 y M2 por correo (v19.102)**: forman parte de la cadena unificada (arriba). El 📧 de la tarjeta abre la ficha de documentación en ese piso con el correo ya escrito (`/documentacion/expediente?id=…&mailaviso=FASE&piso=VIV`).

**Comunidad sin ningún bot (decisión de Guille, 09/10/2026: se deja así, "siempre va a haber un bot")**: el paso de "Listado solicitado" a "Doc solicitada" y la fecha límite de la ficha cuelgan del primer WhatsApp del bot de la comunidad; un 📧 o un WhatsApp manual a un vecino no los mueven. Si alguna vez una comunidad fuera sin bot, el badge se quedaría en Listado solicitado (la cadena de avisos sí tiene respaldo: el primer inicio por correo o WhatsApp manual).

**Hueco conocido (25/09/2026)**: **cerrado en la v19.102** — los vecinos en M (con o sin correo) entran en la cadena unificada.

**Estructura común de los mensajes M1 a M5 (criterio de Guille, 27/09/2026)**: todos **empiezan igual** ("Hola {nombre}, somos Instalaciones Araujo." + "Estamos gestionando en su comunidad el Plan 5 de EMASESA para la individualización de contadores de agua de su vivienda {tipo_via}{comunidad} ({piso}).") y **terminan igual** ("Comuníquenos cualquier duda que le pueda surgir."). Los tres avisos de plazo (M1, M2, M3) tienen además el cuerpo en el mismo orden: **1. situación** (M1: "Le hemos enviado 3 mensajes automáticos a los que aún no ha dado respuesta (si necesita ayuda…)"; M2: "Le hemos enviado varios mensajes a los que aún no ha dado respuesta (si necesita ayuda…)"; M3: "Aún no hemos recibido {pendiente} de su vivienda (si necesita ayuda…)") — sin "le rogamos", porque chocaba con la frase dura del segundo aviso —; **2. plazo** ("El plazo para entregarnos {pendiente} {vence_el}{prorroga_nota}."); **3. consecuencia** ("{consecuencia}", amable en plazo, dura vencido). El M4 (envío de contrato y carta de pago: qué necesitamos, forma de pago, recepción y fecha límite) y el M5 (texto personalizado) tienen su propio cuerpo, pero el mismo principio y final. Los textos viven en `bot_plantillas` (se editan en Plantillas del bot); cualquier texto nuevo debe seguir esta estructura.

**Ajuste único v19.60**: al arrancar, el servidor dejó una sola vez el M1 sin "por lo que le rogamos que los atienda" (igual que el M2) y los días M2 = 21 y M3 = 11, solo si seguían con los valores antiguos. Deja la marca `mig_avisos_v1960` en `bot_plantillas` (con la fecha y lo que cambió) y no se repite, así que si luego se cambian esos valores a mano se respetan.

**Variables de los textos M1 a M5**: `{nombre}` (sin el prefijo entre paréntesis que se pone en los pisos: "(T) ", "(I) ", "(?) "…), `{tipo_via}`, `{comunidad}`, `{piso}`, `{fecha_limite}` (plazo inicial), `{fecha_prorroga}`, `{fecha_limite_vigente}` (la ampliada si la comunidad tiene prórroga, si no la inicial), `{prorroga_nota}` (" (fecha ampliada por la prórroga concedida a su comunidad)", o vacío) y **`{vence_el}`** (v19.26): la fecha vigente con el verbo según el día en que se manda, con la hora de España — "vence el 22/07/2026", "vence hoy, 22/07/2026" o "venció el 22/07/2026". Sirve para que un aviso mandado tarde no diga "vence" con una fecha ya pasada. **`{pendiente}`** (v19.27): lo que le falta al vecino — en fase 05, "la documentación de su vivienda"; en fase 08, según los estados de su caja: "el Contrato firmado y la Carta de pago", "el Contrato firmado" o "la Carta de pago" (si no le falta nada, "la documentación de su vivienda"; `REVISAR` cuenta como recibido, v19.98, igual en HOY que en el botón 💬 de la caja). **`{consecuencia}`** (v19.27): la frase final, que cambia según el día — antes o el mismo día del vencimiento, "Pasada esa fecha, dejaremos de gestionar su expediente…"; después (v19.66, criterio de Guille: el segundo aviso es duro y sin plazo de gracia) — **M2 (fase 05)**: "Al haber vencido el plazo, ya hemos comunicado a su comunidad que su vivienda queda fuera del expediente, y la individualización de su contador deberá tramitarla usted mismo directamente con EMASESA. Si aún desea incluirla, envíenos {pendiente} sin más demora."; **M3 (fase 08)**: "Al haber vencido el plazo, ya hemos comunicado a su comunidad que su vivienda queda fuera del expediente y que debe abonar su Carta de pago. Si desea mantener su vivienda en el expediente, envíenos {pendiente} sin más demora; de lo contrario, la individualización de su contador deberá tramitarla usted mismo directamente con EMASESA." ("su comunidad" y no "su administrador", porque el correo de disidentes va unas veces al administrador y otras al presidente). **Orden obligatorio ese día**: primero el correo de disidentes a la comunidad (botón "¿Conceder prórroga?" → No conceder y solicitar disidentes) y después el M2/M3, para que "ya hemos comunicado a su comunidad" sea verdad. Cuándo sale cada versión (amable o dura): §3.9. Criterio de Guille: **el texto de cada aviso tiene que ser coherente con las fechas, la prórroga y lo que de verdad le falta al vecino en el momento en que se manda**; por eso M1-M3 usan `{pendiente}`, `{vence_el}`, `{prorroga_nota}` y `{consecuencia}` en lugar de texto fijo. Los plazos (v19.36, iguales a los de los correos): en fase 05, **primer WhatsApp del bot a cualquier vecino de la comunidad** + 20 días, la misma fecha para todos (los días de aparición de M1/M2 sí cuentan desde el primer WhatsApp de cada vecino); en fase 08, envío de contratos + 10. Con prórroga se suman los días de la casilla de la plantilla de prórroga (`05_ULT_AVISO` / `08_ULT_AVISO`, hoy 20 y 10), la misma que usan los correos. Las variables antiguas siguen funcionando: usar `{vence_el}` es cambiar el texto de la plantilla.

**Otras tarjetas de HOY que salen de datos del bot**: "Pide ayuda" (col AC, con el texto del vecino entre paréntesis y entero al pasar el ratón, v121; se quita marcando, col AE) y "Completo · revisar" (vecino en `finalizado` cuyo piso tiene algo en REVISAR, v19.111/v19.114; sin check). Desde v19.118 también sale para la ficha **reabierta** (col AB `REABIERTA <fecha>`, la pone `reabrirSiFinalizado`) mientras le quede algo en REVISAR: antes, al reabrirse, el vecino dejaba de estar en `finalizado` y la tarjeta desaparecía. El antiguo aviso "Faltan documentos" está retirado de la caja; su columna AD la usa desde v128 la pausa de una pregunta (§6.10).

## 6.17 Fase 08: contratos y cartas de pago por el bot (v19.98)
Criterio de Guille (06/10/2026): copiar el mecanismo de la presentación de la fase 05, cambiando los archivos. Motivo: WhatsApp restringió el número de Guille por mandar a mano 59 contratos; la vía oficial es el número del bot (Twilio).

**Envío (`enviarContratoPiso`, lo llama `documentacion.cjs` con el botón W de cada piso, §4.2.3.3)**
1. Comprueba, por este orden: plantilla Twilio `contrato_cycp` con HX (si no: "Falta la plantilla de Twilio para enviar contratos"), piso, teléfono, que no sea disidente (AQ en OK) y que ese teléfono no lo lleve ya el bot en otra vivienda.
2. Busca los PDF en la carpeta de Drive del expediente (`<tipo_vía dirección>`, en la raíz de Plan 5, §6.9) y en sus subcarpetas hasta dos niveles, **menos `01 DOCUMENTACION BOT`**: el contrato es el PDF cuyo nombre empieza por `CONTRATO` y lleva `(<piso>)`; la carta, el que empieza por `CARTA` y lleva `(<piso>)` (sin distinguir mayúsculas ni tildes). Si falta alguno: "No encuentro la carta de pago del 34-0A" (o el contrato, o los dos) y no se manda nada; si hay dos: "Hay 2 contratos del 34-0A en Drive: deja solo uno". El listado se guarda 60 s para mandar seguido a muchos pisos, pero si falta algo se vuelve a mirar en el acto (por si se acaba de subir).
3. Une contrato + carta en un PDF con pdf-lib. **Si la comunidad es FFCC** (`est_ccpp_pago`, AY), solo el contrato. Si el contrato no tiene 4 páginas, lo dice en el aviso pero lo manda.
4. Lo deja en memoria y lo sirve en `/media-contrato/<clave>/<nombre>.pdf` (§6.11). Manda la plantilla con **{{1}}** tipo de vía + comunidad ("C Tarfia 53"), **{{2}}** piso, **{{3}}** fecha límite (la calcula `documentacion.cjs`, §4.7) y **{{4}}** `<clave>/<nombre>.pdf`. **La plantilla de Twilio necesita ese cuarto hueco** en la dirección del documento de la cabecera: `https://araujo-bot.onrender.com/media-contrato/{{4}}` (Twilio exige que la dirección del documento sea una variable del final de la URL y que termine en el tipo de archivo).
5. Ficha: usa la del teléfono (la de la 05). Si no tiene (vecino que fue en M en la 05), crea una con paso `fase08` y **sin fecha de primer contacto** (col J vacía), para no mover los plazos ni los avisos de la 05. Apunta AG (fecha del primer envío; no se pisa al reenviar), vacía AH y pone AI (último envío). Apunta el envío en `bot_avisos` (`contrato_cycp`, `manual_boton`) y en `bot_contactos`.
6. Se puede **reenviar** (mismo botón): manda otra vez el PDF y la fecha vigente; la fecha de AG no cambia.

**Recogida (`manejarFase08`)** — solo para pisos en W, comunidad en 08 y AG relleno (§6.1). **Desde v19.108 (criterio de Guille, 12/10/2026: "la IA falla mucho; ya ordeno yo") cada archivo se guarda tal cual llega**: 5 fotos son 5 JPG, 2 PDF son 2 PDF, sin juntar hojas, sin convertir y sin IA.
- Nombre: `08-DOC <tipo vía> <comunidad> (<piso>)_<fecha y hora con milisegundos>.<ext>`, en la carpeta de la vivienda (§6.9). Fila en `bot_documentos` con código `documento_fase08`, estado REVISAR.
- **Pastillas**: las que estaban pendientes (Contrato si no estaba en OK ni REV; Pago si estaba en F y la comunidad no es FFCC) pasan a **REV**. Lo que ya estaba en OK no se toca (v19.112, "mando yo"). Con eso sale en HOY "Completo · revisar" (§3.16.3.1) y Guille deja en OK lo bueno y en F lo que falte.
- Aviso al equipo (`equipo_revisar_documento`) por cada mensaje con archivos. Al vecino: "✅ Hemos recibido sus archivos. Los revisaremos y, si falta algo, le avisaremos. Gracias." No hay "hoja 1 de 4" ni LISTO.
- **Texto**: si contesta con texto, responde con lo que le falta según las pastillas ("*NECESITAMOS* - El contrato firmado (LAS 4 HOJAS), en fotos o en PDF." / "- El justificante de abono de la Carta de pago.") o "Hemos recibido toda la documentación…"; pasa el mensaje por la IA de "necesita un humano" (§6.10). Los textos están en el código (decisión de §9.5, punto 8).
- Restos de la recogida antigua: `_procesarArchivo08`, `_finalizarContrato08`, `_clasificarDoc08` e `_imagenAJpeg08` **borrados en v19.112**. Queda sin uso la col AH (`contrato_bot_hojas`) de `bot_expedientes`.

**Plazo**: lo mueve `documentacion.cjs` al mandar el primer contrato de la comunidad (§4.7). El bot no manda recordatorios en 08 (§6.5).

**Probado en real el 12/10/2026** (piso PRUEBA en Tarfia 53, móvil de Guille): el envío llega con el PDF (contrato + carta juntos) y el texto aprobado; pastillas a REV y avisos al equipo correctos. (En esa prueba, con la versión de entonces, las fotos del contrato se juntaban en un PDF; desde la v19.108 se guardan tal cual, arriba.) Comportamientos a saber:
- La versión v19.98-19.107 juntaba las hojas y clasificaba con IA: en las dos pruebas metió la carta de pago (sin sellar) como hoja del contrato y una hoja del contrato como justificante. Por eso la v19.108 guarda los archivos tal cual (arriba).
- **La primera tanda de 5 fotos (19:44) no llegó al servidor** (ni respuesta ni rastro en el Sheet); la segunda sí. Causa desconocida (Twilio/WhatsApp); si se repite con un vecino, mirar el registro de Twilio.

**Relación con el resto**: pastillas Contrato/Pago de la caja (§4.2.3.4) → "Faltan X de Y" de HOY y de la ficha y "Lista para empezar" de Alberto (lee AR/AS: REVISAR no es OK, así que el piso no cuenta como listo hasta que Guille lo pase a OK); M3 de HOY (§6.16); correos y badges de la 08 por la fecha de envío de contratos (§3.9).

## 6.18 Teléfono sin WhatsApp (v19.99)
Criterio de Guille (07/10/2026): saber cuándo un vecino no recibe el WhatsApp porque su número no tiene WhatsApp, y decidir él si pasarlo a M.
- **Envío**: `enviarWhatsAppPlantilla` pide a Twilio que avise del estado (`statusCallback` → `/twilio-estado`) en todas las plantillas a vecinos (presentación por botón W, reenvíos, envío masivo, recordatorio, contrato de la 08). No en los avisos al equipo (`notificarEquipo`, 4º parámetro `false`).
- **Aviso de Twilio**: si el mensaje queda `failed`/`undelivered` con error **63024** (destinatario no válido: sin WhatsApp, sin aceptar las condiciones o versión vieja) o **63003**, se apunta la fecha en la col AJ de la ficha del teléfono y se vacía AK. Si la ficha aún no existe (se crea justo después del envío), lo reintenta hasta 3 veces cada 20 s. Si llega `delivered`/`read` y había marca, se borra AJ. Otros errores solo se apuntan en el registro de Render.
- **HOY**: tarjeta **Sin WhatsApp** en Avisos (§3.16.3.1).


## 6.19 Trampas y peligros conocidos
- Los PDF firmados digitalmente (`solicitud_firmada`) se guardan **siempre como PDF original**, nunca convertidos a imagen — convertir a imagen le hacía perder la firma (fallo ya arreglado en sesiones anteriores, no repetir el error).
- Alias de documento en una sola pieza (`DNI_ALIAS_UNA_PIEZA`): si alguien sube a mano un `dni_propietario` (una sola foto) en un flujo que espera `dni_delante`/`dni_detras` por separado, hay una tabla de alias que lo traduce — si se añade un tipo de documento nuevo que pueda subirse "de una pieza", hay que dar de alta también su alias aquí o el job proactivo seguirá pidiéndolo aunque ya esté.
- **`withLock` es una cola de promesas por clave (número de teléfono), no un semáforo simple** — si se toca este mecanismo, hay que conservar la propiedad de que encola en vez de descartar, porque de eso depende que no se pierdan mensajes que llegan seguidos.
- **Un teléfono = un vecino para el bot.** La ficha de `bot_expedientes` y el filtro bot buscan por teléfono y se quedan con el primer piso que encuentran. Si el mismo teléfono está en dos pisos (un propietario con dos viviendas), el bot solo gestiona uno; el otro hay que llevarlo a mano.
- **La presentación no se repite nunca por el botón W**: si un vecino ya tiene ficha (aunque sea de otra comunidad o de una prueba), pasar su piso a W no le manda nada. Para volver a presentarlo hay que borrar su fila de `bot_expedientes`.
- **El filtro de fase compara nombres de comunidad sin quitar tildes** (`pisoActivoParaBot` y `/enviar-presentacion` comparan la columna B de `pisos` con la B de `comunidades` en minúsculas). Si los dos nombres no están escritos igual, el bot da la comunidad por "fuera de fase" y guarda silencio.
- **`fecha_limite_documentacion` se fija a +20 días al crear la ficha** y no se mueve con la prórroga; los plazos que se ven en la ficha y en HOY no salen de esa columna sino del primer contacto (§6.13), así que no hay que fiarse de ella.
- **Fase 08 (v19.98), contratos por el bot** (§6.17): (1) los PDF se encuentran por el nombre — el piso entre paréntesis y escrito igual que en la caja (`(34-0A)`), y el nombre empezando por `CONTRATO` o `CARTA`; uno con otro nombre no se ve, y dos del mismo piso dan error a propósito. (2) Si EMASESA mandara PDF protegidos, juntar contrato y carta podría fallar ("No se pueden juntar los PDF") o salir mal: no se ha podido comprobar con uno real. (3) El PDF que se manda vive solo en memoria (§6.11). (4) Un teléfono que el bot ya lleva en otra vivienda no recibe el contrato de la segunda: se avisa y se manda a mano (M4). (5) Ya no hay clasificación por IA entre hoja de contrato y justificante: se quitó en v19.108/v19.112 y los archivos de la 08 se guardan tal cual (§6.17).
- **La respuesta al webhook y la respuesta real al vecino pueden ser mensajes distintos** cuando hay archivo de por medio (§6.1, punto 4) — no asumir que "lo que se manda a `res`" es lo mismo que "lo que recibe el vecino en WhatsApp".

## 6.20 Optimización posible (detectada, sin tocar)
- **El job lee `pisos` y `comunidades` enteras por cada vecino** (`pisoActivoParaBot` se llama dentro del bucle). Con muchos vecinos activos son muchas lecturas seguidas del Sheet cada hora, cerca del cupo de llamadas por minuto de Google. Se podría leer una sola vez al principio del job y consultar en memoria. Anotado en §9.5.
Dentro del propio fichero, ninguna encontrada que merezca la pena mover — el tamaño viene de la cantidad real de casos (6 flujos × varios documentos cada uno, más las piezas de IA/validación), no de duplicación evidente. Pendiente, si algún día se añade un 7º tipo de expediente, sería el momento de revisar si `FLOWS`/`REQUIRED_DOCS`/`NIVEL_DOC` se pueden generar desde una única tabla en vez de mantener las tres a mano. **Aparte de esto**: si se busca duplicación de estas mismas tablas, el hallazgo real está en §9.5 — no es dentro del fichero, es entre `bot-whatsapp.cjs` e `index.cjs` (dos copias completas de `FLOWS`/`REQUIRED_DOCS`, ya divergidas).

---

# 7. PROCEDIMIENTO DE ENTREGA

## 7.1 El lado de Guille — `bajar-resturar-subir.bat`
Script de Windows que hace de puente entre GitHub y el chat de Claude. Menú con dos opciones:
- **BAJAR**: comprueba que no haya cambios locales sin subir en "mis" 6 archivos (`presupuestos.cjs`, `documentacion.cjs`, `estilo-visual.cjs`, `bot-whatsapp.cjs`, `presupuestos_plan5.cjs` y, desde v5, `horario-bot.cjs` — la lista real de la variable `MIS_ARCHIVOS`). **Corregido el 16/10/2026**: la parte de BAJAR que clasifica los cambios locales como "tuyos" o "ajenos" tenía apuntados solo 4 archivos y trataba `presupuestos_plan5.cjs` como ajeno (proponía descartarlo); además, varios textos decían "3" o "4 archivos". Ahora están todos en las dos listas (seis desde v5, abajo). Los archivos que no están en GitHub (el propio .bat) también salen como "ajenos" en ese aviso; descartarlos no les hace nada, descarta cualquier cambio local en ficheros que no son de Guille, avisa si Alberto ha subido algo nuevo (mostrando su log y los ficheros tocados) antes de traerlo, hace `git pull --rebase`, y por seguridad fuerza que esos archivos en disco queden idénticos al historial (`git checkout HEAD --`) — blindaje contra un descuadre real que ya pasó una vez. Termina copiando los archivos a la carpeta Descargas, listos para subir aquí al chat (ya no hace falta: Claudia los baja de GitHub, regla 1).
- **SUBIR**: detecta qué de esos archivos hay en Descargas, pregunta uno a uno si mover cada uno al proyecto, valida la sintaxis de cada uno con `node --check` (si falla, no sube nada), comprueba que Alberto no haya subido nada nuevo entre medias (si lo hizo, **para y no continúa automáticamente** — pide traer la info a Claude para decidir cómo integrar sin pisar su trabajo), y solo entonces hace `git add` (nunca `-A`, para no arrastrar `.env` u otros), commit con fecha automática y `push`.
- **`index.cjs` nunca se toca** — está explícitamente excluido de `MIS_ARCHIVOS`, es de Alberto.
- **v5 (20/10/2026)**: con el horario de comunicaciones del bot (v127) entra un **sexto archivo, `horario-bot.cjs`**, que usan `bot-whatsapp.cjs` y `presupuestos.cjs` (sin él, el programa no arranca). Está en `MIS_ARCHIVOS` y en la lista de "tuyos" de BAJAR, y los textos dicen 6. El `git checkout HEAD --` de después de BAJAR va **archivo a archivo** y solo con los que ya están en GitHub (`git cat-file -e`): antes iba de golpe y, si uno aún no estaba subido, git fallaba con todos y no sincronizaba nada. `horario-bot.cjs` ya está en GitHub (subido el 20/10/2026). Al añadir otro archivo nuevo de Guille, ponerlo en esas dos listas. El .bat no está en GitHub: la copia buena es la que Claude entregó el 20/10/2026.
- Tras el `push`, Render redespliega solo (1-2 minutos).

## 7.2 El lado de Claude — banco de pruebas y entrega
1. Partir de lo último de GitHub (clonarlo al empezar, regla 1) y editar sobre esa copia. El banco (`banco-pruebas/`, §7.3) usa la propia copia del repositorio, con `lib/` y `horario-bot.cjs`, que nuestros ficheros cargan al arrancar.
2. `node --check` del fichero completo, y **el banco entero** (`node banco-pruebas/correr.cjs`, §7.3): todo tiene que salir «pasa»; si el cambio arregla un fallo, se añade su caso (regla 32).
3. Si se tocó `TOMA_DATOS_HTML`/`DESGLOSE_HTML` (JS embebido dentro de un string gigante): comprobar SIEMPRE dos cosas por separado — (a) `node --check` del fichero `.cjs` completo, (b) extraer el bloque `<script>` interno (evaluando el string) y hacer `node --check` de ESE bloque aparte. El primero no detecta errores de sintaxis dentro del string.
4. Al escribir tildes/símbolos especiales dentro de ese JS embebido, usar el mismo formato que ya usa el resto del fichero: escape unicode `\uXXXX` (ej. `d\u00edas`), nunca bytes UTF-8 crudos ni, sobre todo, escribir literalmente los caracteres `\xc3\xad` como texto (pasa si se usa `\\x` en vez de `\x` al construir el parche en Python — cuidado con la doble escapada).
   **Banco de pruebas**: desde el 23/10/2026 está en el repositorio (`banco-pruebas/`, §7.3, regla 32); antes era un script que se rehacía en cada conversación y se perdía al cerrarla.
5. Antes de dar una fila/celda concreta de una hoja Excel/Sheet a Guille ("pega esto en A132"), comprobar primero en una captura o export reciente cuál es la última fila real — nunca asumir el número de fila sin comprobarlo.
6. Contar LF sueltos (debe ser 0) y bytes totales.
7. Entregar: o se manda el archivo a Guille en la conversación para que lo suba con su `.bat`, o, **con DALE y permiso de escritura en esa conversación, lo sube Claudia** (regla 31), así:
   - `git fetch` y `git pull --rebase` justo antes; mirar `git log` de cada fichero de la entrega desde la última subida conocida y comprobar que **no hay commits de Alberto** (ni de sesiones suyas) en esos ficheros. Si los hay, parar y decidir con Guille.
   - Subir **solo los ficheros de la entrega** (más el manual, si cambia), nunca `git add -A`.
   - Commit con la versión y el cambio («v137: …») y `push` a la rama principal; Render redespliega solo.
   - Avisar a Guille de que está subido.
8. Decir a Guille el tamaño en bytes y el resultado de las comprobaciones.

## 7.3 El banco de pruebas (`banco-pruebas/`, desde el 23/10/2026)
Carpeta nuestra en el repositorio (no es la `test/` de Alberto). Prueba el programa entero sin red y sin mandar nada a nadie.
- **`simulador.cjs`**: carga nuestros cuatro ficheros (`presupuestos.cjs`, `presupuestos_plan5.cjs`, `documentacion.cjs`, `bot-whatsapp.cjs`) en el mismo orden que `index.cjs`, con el Sheet en memoria sacado del Excel. Google, correo (nodemailer), Twilio y el resto de librerías de fuera están simulados; los crons no corren. Apunta cada lectura y escritura del Sheet (`LOG`) y cada correo o WhatsApp que habría salido (`SENT`).
- **`casos.cjs`**: los casos fijos. Cada uno prepara en memoria el estado que necesita (por ejemplo, «una comunidad en 07 con el ultimátum de la 05 sellado»), así no depende de que un expediente concreto siga en una fase. Hoy: las pantallas principales (HOY, listado, plantillas mail, de documentos y del bot, mapa, nuevo expediente y una ficha de cada fase) se pintan y **sus `<script>` se pueden leer** (caza la trampa del salto de línea dentro del JS, §4.10), HOY lee `pisos` como mucho 2 veces y el listado `comunidades` 1; y un caso por cada arreglo de las v137-v142 (21 casos el 23/10/2026).
- **`correr.cjs`**: corre todos los casos, cada uno en su propio proceso con los datos recién cargados, y dice «✓ pasa» o «✗ FALLA» con lo que se esperaba. `node banco-pruebas/correr.cjs v139` corre solo los de esa versión. Con `BANCO_RAIZ=<otra copia del programa>` se prueba otra versión (así se comprueba que un caso nuevo falla con la versión de antes).
- **`excel-a-json.py`**: pasa el Excel a `banco-pruebas/datos/sheet.json`. **Los datos no se suben** (`banco-pruebas/.gitignore`): Claudia baja el Excel del Sheet de producción del Drive de Guille (solo lectura) al empezar a probar.
- **Comprobado el 23/10/2026**: con la versión de antes de la v137 fallan 8 casos (los de los arreglos de hoy; el de `/avanzar` pasa, porque eso ya lo limpiaba la v19.33) y con la v140 pasan los 18, en unos 7 segundos.
- **La batería de Plan 5** (Anexo A) sigue aparte: compara los presupuestos de 48 edificios con los resultados de referencia.


---

# 8. PENDIENTES PARA PROXIMAS SESIONES
> Cosas concretas a revisar, decidir o definir — no reglas generales del sistema (eso va en los capítulos de arriba). Se van tachando/actualizando sesión a sesión.
- **Decisiones que dejó el repaso de integridad del 23/10/2026** (detalle en §9 y capítulo 10):
  - **Números de versión repetidos** (capítulo 10): la v128 se usó para ocho entregas y la v127 para dos, y el código lleva esos mismos números en sus comentarios. Propuesta: no renumerar lo pasado (desajustaría unos 60 comentarios) y cumplir la regla 30 desde la v137.
  - **Cambios sin línea en el registro**: Rev-25.1 de Plan 5 (15-16/10) y `TIPOS_VIA_FIJOS` a 6 (15/10) están explicados en su capítulo pero no tienen línea en el capítulo 10; y no hay líneas para v19.92-v19.99. Propuesta: dejarlo así (son anteriores a la regla 30) salvo que Guille quiera completarlo.
  - **Falta en el Sheet la plantilla de correo `08_REC_M1_VECINO`** (08-RECORDATORIO M1 (VECINO), v19.110): en `mail_plantillas` no hay fila. Desde la v141 HOY lo avisa en rojo hasta que se cree. Con la regla 9, el M1 de la 08 por correo saldría con «Falta la plantilla». Se crea desde su tarjeta en Plantillas mail (dentro de 08-INICIO CYCP (VECINO)).
  - Lo demás que encontró el repaso está en §9.2 (puntos 1-7 de «Encontrado en el repaso de integridad») y §9.5: los arreglados llevan ✅ (v137-v139); quedan sin tocar el 6 (`14_FINALIZADA`, hablarlo con Alberto), el 7 (restos de `hoy-bot-llamado`); el fallo de los importes de la forma de pago del bot está arreglado (v140, §9.5).
- **Quitar el apaño de Sánchez Pizjuán 6 (v134 + v136)**: cuando Guille diga que «anulamos la particularidad de hoy» (presupuesto O25-ARA/00213 ya impreso), borrar `_cl8antigua`/`_cl8` de `_p5paginasLegales` y la condición que quita la línea inclinada (`fhueco`): vuelven la cláusula 8 nueva y la línea para todos y apuntarlo en el Registro. Ojo: una reimpresión posterior saldrá ya con la cláusula nueva.
- **Pendientes que dejó la conversación anterior (22/10/2026, 14:01)**:
  - **Malvaloca 1 4C**: falta que Jorge Bravo Anarte conteste por qué en la nota simple figura *Honeykiss SL* y no él. Según lo que diga, se le pide la documentación (si es la sociedad: NIF/CIF, escritura de constitución, DNI del administrador y, opcionales, poderes). El texto que se le mandó queda como respuesta tipo para otros casos: "Titular de la nota simple distinto".
  - **Malvaloca 1 9B**: sigue con FFCC (contestó «5» antes de quitar esa opción); Guille lo corrige a mano si no es FFCC.
  - **Ciudad de Gandía 5**: pasar sus pisos de W a M (23 en W; el 2-11 ya en M) y después el botón de la comunidad. Los correos de seguimiento al administrador van aparte.
  - **Respuestas tipo en «Contestar por el bot»**: propuesto el mismo desplegable «Insertar respuesta tipo» de los correos, con la misma lista. Sin DALE.
  - **El aviso del 29/10 a las 9:00** (revisar el v128 del bot: preguntas → Pide ayuda) llegará a la conversación anterior, no a esta: cuando salte, pedir aquí «revisa el v128 del bot».
- **Recuento de vecinos a medias (pedido por Guille el 17/10/2026, tras v19.118)**: repetir en 1-2 semanas el recuento de vecinos con bot en fase 05 que han mandado documentos y no han llegado al final (el 17/10 eran 6: Ardilla 9 0-3, 1-13 y 1-15; Malvaloca 1 2C y 9B; Otelo 8 0IZDA-LOCAL). Si bajan, ver los que quedan y arreglar los últimos flecos.
- **⚠ La IA del bot no responde desde el 25/08/2026 (detectado el 17/10/2026)**: en el chat de avisos del bot todos los documentos llegan con "no se pudo verificar el DNI / analizar la solicitud / el documento automáticamente" (56 en septiembre, 54 en octubre; en julio 0). Eso es que `llamarIAconImagen` / `llamarGPT4oConImagen` devuelven null (§6.3): falla la cuenta de OpenAI (saldo o clave), no un documento. **Desde la v141, en cuanto se encienda la IA, si OpenAI sigue fallando sale un aviso de sistema en HOY con el motivo (§3.14).** Decisión de Guille: **IA dormida hasta que Alberto lo arregle** (v19.118, interruptor en Plantillas del bot); Alberto mira el saldo en platform.openai.com y en Render los logs `Error IA` (`insufficient_quota` = saldo, `invalid_api_key` = clave). Los documentos ya en REVISAR se validan a mano. Propuesto sin DALE: un solo aviso "la IA no responde" cuando falle varias veces seguidas.
- **Nombres de los PDF de EMASESA en Diego Puerta 1**: vienen como `34-(0C)` y el bot busca `(34-0C)`. No afecta a Tarfia 53 (`(1DCHA)`). Si los próximos expedientes vienen como Diego Puerta 1, hay que decidir si el programa acepta los dos formatos.
- **Colores de 💬 y 📧 (idea de Guille, 07/10/2026, aparcada)**: poner en verde/rojo el 💬 (tiene teléfono y no "Sin WhatsApp") y el 📧 (hay email en notas) para saber de un vistazo por dónde ir. Se deja para más adelante si hace falta.
- **Contratos por el bot en fase 08** (en marcha desde el 12/10/2026, §6.17). Queda, de Guille y sin comprobar desde aquí:
  - **Mail 08_INICIO_CYCP igualado** (lo cambia Guille en Plantillas mail): "- Remitan el contrato firmado (LAS 4 HOJAS)." y las 3 formas de pago: "- En las oficinas de EMASESA, C/ Escuelas Pías 1, en el cajero habilitado." · "- En su cajero, con el código de barras del documento." · "- Transferencia a LA CAIXA ES11 2100 1683 1002 0003 1492, titular EMPR. METRO. ABAST. SANEA. AGUAS SEVILLA, indicando PLAN 5, nombre, dirección y piso." Igualar también el M4 de Plantillas del bot.
- **Restos de la sesión del 26/09 – 01/10/2026** (sin revisar desde entonces; Guille dice cuáles siguen):
  - **C Cardenal Ilundain 18, Portal 2 (cerrado)**: tiene la forma antigua de "aprovechar el existente" (depósito 1000 L puesto como actual Y como nuevo, y grupo nuevo a 0 €), por eso el impreso dice "Se instala uno nuevo… 1 depósito de 1000L" a 0 €. Es el único de los 48 (comprobado 04/10/2026). Si lo aceptan y hay que retocarlo: al reabrir, vaciar los depósitos nuevos (dejar solo el actual) y, si se mantiene el grupo, poner a 0 "Instala grupo nuevo". Hoy, para aprovechar lo existente, los campos de "nuevo" se dejan vacíos.
  - Precios de grupos que faltan en `plan5_precios`: Guille los pide cuando hace falta (no son frecuentes). Desde v19.95 Toma de Datos avisa en rojo si el grupo o depósito elegido no tiene precio. Pendiente: precio del depósito de 1000 L (Sierpes 46 y Cardenal Ilundain 18 lo llevan a 0 €).
  - Mejora posible no hecha: que el correo 08-INICIO CYCP liste solo los vecinos a los que no se ha mandado el M4 (desde v19.102 el M4 ya queda apuntado por vecino en `pisos` col AZ).
  - "Plazo · Sleep" del bot a 21 (opcional, Plantillas del bot).
  - Expedientes en seguimiento (no son reglas, solo para retomar): **C Diego Puerta 5** — correo cordial a Juan Luis el 01/10 pidiéndole que proponga la fecha tope (faltan 15 pisos + toma de datos y renuncia GP de la CCPP); PDF de disidentes ordenado. **C Malvaloca 1** — faltan 9 contactos (0A, 0B, 2D, 3A, 3D, 4D, 6B, 8A, 8B); tras el automático del 02/10, WhatsApp a Juan Manuel con la lista. **C Moncayo 6** — plazo de 4IZDA vencido el 28/09: decidir prórroga / disidentes y M3. **C José Arpa 6** — próximo mail 01/06/2027 intencionado (la comunidad reúne fondos un año).
- **Pendiente (12/10/2026)**: pisos que siguen a otro ("=(0-4)" del Ayuntamiento en Ardilla 9) para no repetir tarjetas (propuesto, sin DALE).
- Confirmar con el motor real (no a mano) el caso de Diego Puerta 1, ya comprobado a mano como referencia.
- **Jesús del Gran Poder 73**: Guille corrige en el Sheet la fecha de visita (R109 → 2025-10-17; criterio de fechas de contacto y visita del 04/10/2026, el resto son correctas).

---

# 9. MEJORAS PENDIENTES DE REVISAR (NO CONFIRMADAS, NO TOCAR TODAVIA)
> Distinto del capítulo 8: esto no son tareas sueltas, es lo que vamos encontrando al repasar cada fichero a fondo
> con el esquema de §0.23 punto 3 (relaciones lógicas/funcionan/mejorables/faltan/unificables) y punto 5 (optimización).
> Nada de aquí se toca sin un DALE explícito, y no se decide qué hacer con ello hasta haber repasado el programa
> entero — un cambio que parece seguro visto un fichero suelto puede no serlo visto el conjunto. Cuando se actúe
> sobre algo de aquí: se tacha/mueve a "hecho" con la fecha, y el cambio en sí se refleja en el capítulo del
> fichero que corresponda (§2-6), porque a partir de ahí es "cómo funciona ahora".
>
> Cada punto lleva: **Estado** (`CONFIRMADO` = comprobado con grep/lectura, sin ambigüedad · `A CONFIRMAR` = indicio fuerte, pendiente de revisar a mano), **Depende de** (si tocar esto a solas es seguro o hay que hacerlo junto con otro punto), **Riesgo si se toca solo**.

## 9.1 `estilo-visual.cjs`

**28 clases CSS atadas a código muerto de `documentacion.cjs`** — Estado: **✅ HECHO (19/09/2026)**.
`.ptl-vec-doc-menu`, `.ptl-vec-doc-menu-item(-disabled)`, `.ptl-vec-doc-noaplica`, `.ptl-vec-doc-pendiente`, `.ptl-vec-doc-recibido(-sinarchivo)`, `.ptl-vec-doc-label`, `.ptl-vec-doc-btn`, `.ptl-vec-empty`, `.ptl-vec-cabecera(-derecha)`, `.ptl-vec-card`, `.ptl-vec-cambiar-modo`, `.ptl-vec-btn-modo(-bot/-manual)`, `.ptl-vec-tabla-wrap`, `.ptl-vec-tbody`, `.ptl-vec-th-*` (acciones/docs/estado/nombre/telefono/vivienda), `.ptl-vec-ac-cab`, `.ptl-vec-ac-cab-info`, `.ptl-vec-ac-sinexp` — borradas de `estilo-visual.cjs` junto con `cajitaVecinosHtml`/`filaPisoHtml` de `documentacion.cjs` (§9.3), en la misma entrega. Re-verificado a mano cada una contra el código real antes de borrar (no solo contra lo que decía este manual) — una de las 28 apuntadas originalmente, `.ptl-vec-btn-anadir`, resultó no tener ninguna regla CSS definida (nunca existió como clase con estilo propio, no hacía falta tocar nada de ella). `estilo-visual.cjs`: 70.184 → 66.654 bytes. `documentacion.cjs`: 221.237 → 181.466 bytes.

**Dos huérfanas más, encontradas de paso** — Estado: **✅ HECHO (19/09/2026)**. `.ptl-vec-toolbar` y `.ptl-vec-total`, cero uso confirmado en los 4 ficheros. Borradas. `estilo-visual.cjs`: 66.257 → 65.951 bytes.

**`.ptl-error-msg` huérfana** — Estado: **✅ HECHO (19/09/2026)**. Cero usos confirmados. Borrada. `estilo-visual.cjs`: 66.654 → 66.488 bytes.

**Comentario desactualizado ("v1.10... NO USAR todavía")** — Estado: **✅ HECHO (19/09/2026)**. Las 7 clases del bloque están en uso real y masivo (93 usos, todos en `presupuestos.cjs`, nunca en `documentacion.cjs` pese a lo que decía el comentario viejo). Comentario reescrito. `estilo-visual.cjs`: 66.488 → 66.524 bytes.

**Alias de `getPlan5Css()` sobredimensionado** — Estado: **✅ HECHO (19/09/2026)**. De 18 alias definidos, solo 2 en uso real (`--titulo`, `--g200`). Borrados los 16 restantes. `estilo-visual.cjs`: 66.488 → 66.257 bytes.

**Incongruencias encontradas en la pasada completa (24/09/2026)** — Estado: **todas hechas** (la 9 en v138). Ninguna se arregla sin DALE.
1. **✅ HECHO (02/10/2026)**: quitadas las dos declaraciones, así el aspecto sigue siendo el de hoy (el color heredado). **Dos variables de color que no existen, en uso.** `documentacion.cjs` usa `var(--ptl-azul-oscuro)` en el selector de tipo de vecino del acordeón BOT (nombre renombrado sin alias), y `presupuestos.cjs` usa `var(--ptl-text)` en el pie de una pantalla (marcado "v18.159: legible"). Ninguna está definida, así que ese color no se aplica y sale el heredado. Arreglo: cambiarlas por `--ptl-general-1` y la variable de texto que toque.
2. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: pasar a la paleta (cambio 5 de las decisiones del 02/10/2026, programadas en v19.93). **Los botones de ultimátum usan colores sueltos** (`.ptl-ubtn-amarillo`, `-naranja`, `-rojo`: `#fbc02d`, `#f57c00`, `#e53935`…) en vez de las familias de la paleta, y a la vez **la familia naranja de la paleta (`--ptl-orange`, `-light`, `-dark`) no la usa nadie**. Arreglo: que los botones usen `--ptl-warning`, `--ptl-orange` y `--ptl-danger`. Cambia ligeramente el tono de esos botones: decidir con Guille.
3. **✅ HECHO (02/10/2026).** **19 clases sin uso en `getThemeCss()`**: `.col-5`, `.col-7`, `.col-9`, `.col-10`, `.col-11`, `.col-12` (solo se usan 2, 3, 4 y 8), `.ptl-btn-orden-ambar/-rojo/-verde`, `.ptl-btn-undo`, `.ptl-filtro-hoy`, `.ptl-filtro-tramite`, `.ptl-form-section-title`, `.ptl-lista-filas` (y sus reglas hijas), `.ptl-num-cell`, `.ptl-stat-pill` y `.ptl-stat-azul/-gris/-naranja/-rojo/-verde`, `.ptl-tabla-vecinos`, `.ptl-vec-ac-aviso`, `.ptl-vec-estado`, `.ptl-vecinos-stats`. Comprobado contra las clases construidas por partes (`ptl-badge-${color}`, `col-${n}`). Arreglo: borrarlas.
4. **✅ HECHO (02/10/2026).** **10 clases sin uso en `getPlan5Css()`**: `.addp`, `.delp`, `.prow`, `.pout`, `.combo`, `.combo-list`, `.empty`, `.note`, `.g8`, `.span2`. Arreglo: borrarlas.
5. **✅ HECHO (v19.93, 02/10/2026).** **Corregido al reverificar (02/10/2026): no es una definición doble.** La primera regla es la común de altura de todos los campos (a propósito, §2.5) y la segunda la propia del buscador. Solo queda que su `:focus` usa un tono índigo (`rgba(79,70,229,…)`) que no es de la paleta: es una decisión de color, va junto al punto 2.
6. **✅ HECHO (02/10/2026).** **`getPlan5Css()` repite el reset (`*`) y el `body`** que ya pone `getThemeCss()`, y Plan 5 carga siempre las dos. Sin efecto visible; limpieza.
7. **El manual daba por buenas tres cosas que no lo eran** (ya corregido en el capítulo 2): que `documentacion.cjs` carga el tema, que existe el alias `--ptl-azul-oscuro`, y que unir las dos funciones produciría choques de nombre con el CRM.
8. **✅ HECHO (02/10/2026).** **Comentario de columnas desactualizado en `presupuestos_plan5.cjs`** (visto de paso al revisar cómo carga el tema): encima de `RANGO_PLAN5` dice "Columnas: A … G datos_json", y el rango ya llega a la I (valores propios en H, foto congelada en I). Se anotará también en la pasada de ese fichero.
9. **✅ HECHO (v138, 23/10/2026)**: quitadas las declaraciones, así el aspecto sigue siendo el mismo (el color heredado, igual que en el punto 1). **`var(--ptl-general-4)` no existía** y se usa varias veces en el CSS de Mediciones (`DESGLOSE_HTML` de `presupuestos_plan5.cjs`: `.cap`, `.dsg-empty`, `.dunit`, `.tarr`, `.ttope`). El navegador lo ignora y deja el color heredado (§2.5). Arreglo posible: quitar las declaraciones (como en el punto 1) o apuntarlas a un color de la paleta; decide Guille.
10. **Visto en el repaso del 23/10/2026, sin efecto**: `.ptl-badge-naranja` usa los colores de aviso (`--ptl-warning`), no la familia naranja. Solo se anota.

## 9.2 `presupuestos.cjs`

**¿Pie de página doble en "Enviar mail manual"?** — Estado: **✅ CONFIRMADO Y ARREGLADO (v139, 23/10/2026)**: en `mail_historico` había 406 correos manuales con el pie ya escrito en el cuerpo, que salieron con el pie dos veces. Desde v139 `enviarMailReal` no añade el pie si el cuerpo ya lo lleva. Historia: Al abrir el compositor en blanco se escribe el pie global en el cuerpo (`sAbrirNuevo`) y `enviarMailReal` vuelve a añadir el pie al enviar: según el código, el correo llevaría el pie dos veces. Comprobar en un correo real enviado así. El correo a un vecino (📧) no lo escribe en el cuerpo, así que lleva uno. **Reverificado en el código el 23/10/2026**: sigue igual (`sAbrirNuevo` lo escribe y `enviarMailReal` lo añade otra vez); falta solo verlo en un correo real.

**`app.locals.presupuestos` exportaba piezas que ningún otro módulo consumía** — Estado: **✅ HECHO (19/09/2026)**.
`actualizarComunidad`: sobraba solo la línea de exportación (la función sigue viva, 26 usos internos) — borrada. `getImagenesExpediente` (plural): resultó ser función muerta entera (~40 líneas, sustituida por carga perezosa foto a foto, ver §5.16) — borrada del todo. `presupuestos.cjs`: 1.044.903 → 1.042.802 bytes.
*(`PTO_FASES`, `fechaHito`, `lineaTiempoHtml`, `COLS`, `rowToObj`, `objToRow` también salen con 0 usos externos pero son export deliberado para sandbox de tests — no tocar.)*

**`_contarFaltanBot` — investigado a fondo, sin bug activo (19/09/2026)** — Estado: **✅ COMPROBADO, SIN ACCIÓN**.
El recuerdo de Guille (badges "Faltan X de Y" distintos entre HOY y la ficha) era un bug histórico ya arreglado en julio (v18.90) — HOY era "ciego al bot" y no veía lo entregado por WhatsApp; el arreglo hizo que HOY *replicara* la misma regla que la ficha (no puede "leerla": el badge de la ficha se calcula en el navegador, no se guarda). Confirmado también que el badge solo se pinta en fases 05 y 08 (nunca en 01-CONTACTO, aunque el servidor lo calcule de más ahí — desperdicio mínimo, sin efecto visible). Y el badge propio de `documentacion.cjs` sí usa la fórmula vieja en el primer render del servidor, pero `refrescarContadores()` lo sobreescribe sola en cuanto carga el JS (línea ~1657) — el usuario siempre ve el número correcto.

**Único cabo suelto real, no urgente**: hay **tres copias** de "qué documentos hace falta por tipo de flujo bot" — `bot-whatsapp.cjs` (`FLOWS`/`REQUIRED_DOCS`), `documentacion.cjs` (`TIPOS_BOT`/`BOT_FACE_CODES`), `presupuestos.cjs` (`_TIPOS_BOT`/`_BOT_FACE_CODES`, para que HOY calcule igual que la ficha) — mantenidas a mano, con el propio código avisando del riesgo de desincronización. Candidato para una sesión dedicada aparte.

**Avisos M1 y M2 sin filtro de fase** — Estado: **✅ HECHO (v19.92, 02/10/2026)**. Las tarjetas M1/M2 de HOY se calculan sobre `bot_expedientes` sin mirar la fase de la comunidad, aunque sus títulos dicen "fase 05". Si una comunidad pasa a 06 o más con algún vecino sin contestar a la presentación, sus M1/M2 siguen saliendo. Arreglo: limitarlos a comunidades en fase 05. Se revisará en la pasada completa de `presupuestos.cjs`.

**Comunicaciones: fecha de comunidad frente a fecha de cada vecino (fase 05)** — Estado: **✅ HECHO (v19.36)**. Todos usan la fecha de la comunidad (§3.9).

**Duración de la prórroga duplicada** — Estado: **✅ HECHO (v19.36)**. Los WhatsApp leen los días de las mismas plantillas que los correos (§3.9).

**Retroceder "conservando datos" no protege la fecha de aceptación** — Estado: **⏳ DETECTADO (25/09/2026), sin tocar (decisión de Guille: no arriesgar)**. Al retroceder, la pregunta dice que con "Aceptar" los datos "se quedan por si avanzas otra vez". Es cierto mientras el expediente está atrás, pero al volver a pulsar ✓ ACEPTADO (enviando el correo o con "Saltar envío") se escribe siempre la fecha de hoy en `fecha_aceptacion_pto` y se reinicia el reloj de los seguimientos del listado. Consecuencia práctica: no sirve atrasar y volver a aceptar para que se creen los pisos automáticos sin perder fechas (caso Malvaloca 1, 25/09/2026: se crearon a mano). Arreglo posible: que ✓ ACEPTADO solo escriba la fecha si está vacía; o corregir el texto de la pregunta.

**Contador de seguimientos por encima del máximo** — Estado: **⏳ ANOTADO (25/09/2026), sin tocar**. En la línea de tiempo puede salir "Seguim. doc (5 de 3)": compara los seguimientos enviados cuando el máximo era mayor con el máximo actual de la plantilla. Histórico; en expedientes nuevos no pasa.

**Comprobación del proceso de avisos (25/09/2026): 4 fallos + 1 encontrado al arreglarlos** — Estado: **1 y 3 ✅ ARREGLADOS (v19.33)**; 2 y 4 anotados, decisión de Guille.
1. **Las marcas de "omitido" se arrastran de la fase 05 a la 08 (importante).** Al entrar en 08 se limpian las tres fechas del ultimátum (`fecha_ultimatum_ampliado`, `fecha_disidentes_solicitados`, `fecha_contrato_resuelto`), que son las mismas columnas en las dos fases, pero **no** las marcas `…__SKIP` de `mails_enviados`. Si en fase 05 la prórroga se omitió, en fase 08 una prórroga **concedida y enviada** se trata como no concedida: badge "Solicitar disidentes" en vez de "Prórroga concedida", WhatsApp sin la fecha ampliada, línea de tiempo "omitido". Reproducido en el banco de pruebas. Hoy no afecta a ningún expediente (ninguno en 06-07 lleva una marca así), pero afectará al primero que omita la prórroga en 05 y llegue a 08. **✅ Arreglado (v19.33)**: al entrar en 08 se borran esas marcas, y al sellar un paso enviando su correo se borra cualquier marca de omitido de ese paso. *(Repaso del 23/10/2026: la v19.33 solo lo hacía en `/avanzar`; el paso de 07 a 08 por el correo 08-INICIO CYCP no limpiaba nada. Arreglado del todo en la v137, punto 1 de abajo.)* Criterio de Guille: se puede no conceder en 05 y sí conceder en 08.
5. **(Encontrado al arreglar el 1, más grave) La limpieza del ultimátum al entrar en 08 nunca llegaba al Sheet.** `actualizarComunidad` solo escribe hasta la columna BJ y las tres fechas del ultimátum están en BL, BM y BN: al pasar de 07 a 08 se "borraban" en memoria pero en el Sheet seguían las de la fase 05, y el ultimátum de 08 arrancaba con la prórroga (y hasta los disidentes) de la fase 05 ya sellados. **✅ Arreglado (v19.33)**: se escriben celda a celda. Afecta a los expedientes que hoy están en 06-07 con fechas de ultimátum de la 05: **Doctor Fedriani 17** y **Nescania 25** (prórroga y disidentes sellados en 05); con v19.33 se limpiarán al pasar a 08.
2. **Retroceder "borrando datos" desde 05 u 08 no limpia el ultimátum.** Borra fechas de la fase y contadores de correos, pero deja las tres fechas del ultimátum y sus marcas. Al volver a avanzar, el ultimátum empieza ya "a medias". Arreglo posible: que la vuelta limpia desde 05/08 limpie también el ultimátum (celda a celda, por lo del punto 5). **Decisión de Guille (25/09/2026)**: no tocar; piensa dejar de usar retroceder o usarlo en contadas ocasiones.
3. **La ruta de "Recordar prórroga" acepta la orden aunque la prórroga no se concediera.** La pantalla ya no ofrece el botón en ese caso, pero el servidor no lo impide; si se llamara, mandaría el correo "ampliamos el plazo hasta…". **✅ Arreglado (v19.33)**: el servidor rechaza "Recordar prórroga" si la prórroga no está concedida ("No hay prórroga concedida: no hay nada que recordar. El siguiente paso es solicitar disidentes.").
4. **Hora del servidor (UTC) frente a hora de España.** Los badges, los días de los avisos y la fecha que se sella al pulsar un botón usan la fecha UTC del servidor; `{vence_el}` y `{consecuencia}` usan la de España. Entre las 00:00 y las 02:00 (hora de España, en verano) el servidor sigue en el día anterior: un aviso que toca "hoy" aparece 2 horas tarde y un botón pulsado a esa hora sella la fecha del día anterior. Poco impacto; arreglo posible: una única función de "fecha de hoy en España" para todo. **Decisión de Guille (25/09/2026)**: no tocar, no trabaja a esas horas.

**Decisiones de Guille del 25/09/2026 sobre el proceso de avisos**: (1) en fase 05 el vecino ve **la fecha de la comunidad** (primer WhatsApp del bot a cualquier vecino + 20), no la suya — **✅ hecho (v19.36)**; (2) la duración de la prórroga de los WhatsApp se lee de la misma casilla de días que los correos — **✅ hecho (v19.36)**; (3) retroceder que no limpia el ultimátum: se deja para más adelante; (4) desfase horario 00:00-02:00: no se toca; (5) vecinos en M sin avisos automáticos en fase 05: se deja así por ahora (§6.16).

**Botón gris "Continuar sin enviar (sin prórroga)" y el aviso duro** — Estado: **⏳ ANOTADO (29/09/2026), para cuando se use ese botón**. Si en el modal de la prórroga se pulsa el gris, no sale el correo de disidentes a la comunidad, pero el M2/M3 duro dirá igualmente "ya hemos comunicado a su comunidad que su vivienda queda fuera del expediente…", que no sería verdad. Mientras tanto, criterio de Guille: usar el botón gris solo si a la comunidad ya se le ha comunicado por otra vía (teléfono, en persona). Arreglo posible si se empieza a usar: que la frase dura cambie cuando la comunidad no ha recibido el correo de disidentes (por ejemplo, "vamos a comunicar a su comunidad…").

**Días por defecto de M2 y M3 desfasados en el código** — Estado: **✅ HECHO (v19.91, 02/10/2026)**: los valores de repuesto son ya 21 y 11 en los siete sitios (HOY, línea de tiempo, ventana Tiempos, tarjetas de Plantillas del bot y su guardado). Texto original: Si falta la fila `t_wa_m2` o `t_wa_m3` en `bot_plantillas`, el código usa 20 y 10, que son los días de antes de la regla del día siguiente; los vigentes son 21 y 11 (§3.9). Esos valores de repuesto están escritos en varios sitios (HOY, línea de tiempo, ventana Tiempos, tarjetas de Plantillas del bot). Hoy no afecta, porque las filas existen. Arreglo: cambiarlos a 21 y 11, mejor en una sola constante.

**Comentario de `fecha_cobro` desfasado** — Estado: **✅ HECHO (02/10/2026)**. El comentario de la columna BE en el código dice "fecha en que Instalaciones Araujo cobró la obra al cliente", pero en pantalla es la **Fecha factura** de Guille (§3.5). Solo es un comentario; arreglo: reescribirlo.

**Restos sin uso y comentarios desfasados en la ruta de HOY** — Estado: **✅ HECHO** (HOY en v19.89, el listado en v19.90 y la lectura de `pisos` por expediente en v19.95; comprobado en el repaso del 23/10/2026). No cambian nada de lo que se ve; solo confunden al leer el código:
- ✅ (v19.89) La ordenación general por estado del badge (v18.72) que no se ejecutaba nunca: quitada.
- ✅ (v19.89) `avisosPlazo` y `adjRotos`, calculados sin uso: quitados.
- ✅ (v19.89) Pintado del tipo "Atascado" (`faltan`) en la caja Avisos: quitado.
- ✅ (v19.89) Comentario del orden de 05 y 08: corregido (el más antiguo arriba).
- ✅ (v19.89) Comentario de los automáticos de 01 y 04: corregido (solo Decidir).
- ✅ (v19.90) En el **listado** (§3.17): quitadas la carga de plantillas sin uso, el filtro `fase=HOY` con su contador y el botón de orden (con los órdenes Z-A y Urgencia). Decisión de Guille: el botón no hace falta.
- **Lecturas repetidas al abrir HOY**: ✅ (v19.89) las de la propia ruta se hacen una vez (`comunidades` 5 → 2, `bot_expedientes` 5 → 4, `pisos` 31 → 29). ✅ (v19.95, lectura compartida: `pisos` 26 → 2, HOY idéntica) **Lo más gordo**: `_leerPisosDeCcpp` lee la pestaña `pisos` entera **una vez por cada expediente** (28 lecturas con el Sheet actual) al calcular "Faltan X de Y" y el verde de los avisos, y `_leerBotDatosHoyIndex` lee `bot_expedientes` por su cuenta. Arreglo propuesto: leer `pisos` una vez y filtrar por comunidad. Ojo: `_contarFaltan` es la fuente única que comparte con documentación (§4.2), así que hay que hacerlo sin cambiar su resultado.

**Fallos de la ficha del expediente** — Estado: dos ✅ y uno **⏳ sin tocar** (el de las fechas del historial); detectados el 02/10/2026 al rehacer §3.19. Ninguno cambia lo que se ve hoy:
- ✅ (v19.92) **El badge de estado de fase 09 está pintado en dos sitios con código propio** (ficha y listado) y con textos distintos: la ficha dice "💶 Facturado el dd/mm/aaaa" y el listado "💶 Facturado" (la fecha, al pasar el ratón). Si se cambia uno, hay que acordarse del otro. Arreglo: una sola función para los dos.
- ✅ (02/10/2026) **Comentario desfasado en los campos económicos**: dice que los campos reales "siguen bloqueados de momento", pero el código los abre en 09.
- **Fechas del historial de correos en formato dd/mm/aaaa** (latente): el orden y la fecha mostrada usan `Date.parse`, que lee "01/04/2025" como 4 de enero. Hoy no afecta: las 1.891 filas de `mail_historico` están en formato ISO.

**Fallos de Plantillas mail** — Estado: **✅ HECHOS los tres (v19.91-v19.92)**; detectados el 02/10/2026 al rehacer §3.21.
- ✅ (v19.91) **La comprobación de adjuntos rotos trabajaba para nadie**: ahora vigila todas las plantillas con adjuntos, cada 6 horas y al guardar, y el aviso sale en la tarjeta (§3.21.5).
- ✅ (v19.91) **Días por defecto de los WhatsApp en la ventana Tiempos**: corregidos con el resto (abajo).
- ✅ (v19.92: si ya hay una lectura en marcha, se espera a esa; banco de pruebas: 15 → 1) **Plantillas mail lee `mail_plantillas` 15 veces al abrirse si la caché está fría** (las 15 lecturas salen a la vez y ninguna encuentra la caché llena todavía). Con la caché ya llena, 1. Solo lentitud. Arreglo: leer la pestaña una vez antes de pedir las 15.

**Fallos de Plantillas de documentos e Imprimir documentos** — Estado: **✅ HECHO (v19.93)**; detectado el 02/10/2026 al rehacer §3.23.
- **✅ HECHO (v19.93)** **El documento `piso_vacio_sin_contrato` no se puede imprimir** — **Decidido (Guille, 02/10/2026)**: se declara en el código (cambio 6 de las decisiones del 02/10/2026, programadas en v19.93).: está en la pestaña `doc_plantillas` (sale en la pantalla y en el menú de Imprimir documentos, al final), pero el código no tiene declarados sus huecos (`DOC_HUECOS`) ni su sitio en `ORDEN_DOCS`. Si se elige, no pide ningún campo y no sale en el PDF, sin avisar. Decidir con Guille: o se declara en el código (qué campos lleva y de dónde salen) o se quita del Sheet.

**Fallos de Nuevo expediente** — Estado: **✅ HECHO (v19.92)**; detectado el 02/10/2026 al rehacer §3.18.
- ✅ (v19.92, `TIPOS_VIA_FIJOS`) **La lista fija de tipos de vía no es la misma en todos los sitios**: al abrir el formulario son 11 (C, Av, Bª, Pz, Pza, Rª, Ur, Cm, Pje, Bda, Crta); si se vuelve a enseñar por un error (dirección repetida, correo mal) y en la ficha, solo 7 (faltan Cm, Pje, Bda y Crta, salvo que ya estén usados en el Sheet). Arreglo: una sola lista para todos.

**El cron y otros guardados reescriben la fila entera con datos leídos antes** — Estado: **⏸️ DESCARTADO POR AHORA (Guille, 01/10/2026)**: en todo el tiempo de uso no ha dado problemas, y en el peor caso es un dato que no se queda guardado y se vuelve a poner. `actualizarComunidad` escribe de golpe las columnas A-AA, AE-AF y AH-BJ de `comunidades` con lo que se leyó al empezar. El caso con más riesgo es el cron de correos: arranca 60 s después de cada arranque del servidor (Render lo reinicia a veces en plena jornada) y cada 24 h, lee todas las comunidades una vez y luego va enviando y guardando una a una. Si mientras tanto Guille cambia un dato de ese mismo expediente (notas, fechas, fase…), el cron lo devuelve al valor antiguo. Solo afecta a los expedientes a los que el cron envía en esa pasada. Los campos sueltos que se editan en pantalla (incluida la fecha recordatorio) no tienen este problema porque escriben solo su casilla. Arreglo propuesto: que el cron guarde solo las casillas que cambia, con la función que ya escribe casilla a casilla.

**Encontrado en la pasada completa de `presupuestos.cjs` (§0.24, 02/10/2026)**, sin tocar:
- ✅ (v19.94) **Comentarios de la lectura de correo desfasados**: dicen "cron interno cada 5 minutos" y "después cada 5 min", pero corre cada 30 minutos (`INTERVALO_MS = 30 * 60 * 1000`). Arreglo: corregir los dos comentarios.
- ✅ (v19.94, decidido por Guille: no dejar cambiar la dirección desde la fase 05) **Renombrar un expediente no arrastra `pisos` ni las pestañas del bot** (`bot_expedientes`, `bot_documentos`): solo cambia `comunidades`, `mail_historico`, `plan5_toma_datos` y la carpeta de Drive, y del resto avisa para cambiarlo a mano. Desde la fase 05, con pisos creados, renombrar deja esos pisos y sus documentos colgando de la dirección vieja si no se cambian a mano. Decidir con Guille: añadir `pisos` y las del bot al renombrado automático, o no dejar renombrar a partir de la fase 05.

**Encontrado en el repaso de integridad (23/10/2026)**, sin tocar (ninguno se arregla sin DALE):
1. **✅ ARREGLADO (v137, 23/10/2026; detalle en §3.2).** **FALLO: las marcas del ultimátum de 05 pasaban a la 08.** **Consecuencia más seria** (vista al revisar §3.9 el 23/10/2026): con BL/BM/BN rellenas el cron **no manda el 08-SEGUIMIENTO CYCP** (`if (BL08 || BM08 || BN08) continue;`) y la línea de la ficha dice «reenvío parado · ultimátum en curso». **En el Sheet del 23/10/2026** ninguna comunidad en 08/09 lo sufre (todas sus BL son posteriores al envío de contratos, o sea, de su propio ultimátum de 08), pero **cinco llegarán con marcas de la 05**: Doctor Fedriani 17 y Nescania 25 (en 07), Manuel Casana 7 (en 06), Diego Puerta 5 y Otelo 8 (en 05). Con la v137 se limpian solas al pasar a 08. Probado en el banco con los datos del 23/10 (Nescania 25 y Doctor Fedriani 17, por «Saltar envío», enviando el correo y por `/avanzar`; y con marcas `__SKIP`/`__HASTA` en el JSON, que se borran sin tocar el resto). La limpieza de BL/BM/BN, sus `__SKIP` y `__HASTA` al pasar de 07 a 08 solo está en `/avanzar`, pero desde la 07 el botón de avance abre la ventana del correo 08-INICIO CYCP, y `/enviar-mail` pasa a 08 (enviando o con «Saltar envío») sin limpiar nada. Efecto posible: en la 08 los botones y badges del ultimátum pueden salir como si la prórroga o los disidentes ya estuvieran hechos (o no concedidos) por lo que pasó en la 05. Arreglo propuesto: hacer la misma limpieza en las dos ramas de `/enviar-mail` (mejor, sacarla a una función común). Antes conviene mirar en el Sheet qué expedientes en 08 tienen BL/BM/BN rellenas de la 05 (Claudia puede hacerlo con el conector).
2. **✅ HECHO en los correos (v139; los badges conservan los suyos, que no mandan nada; §3.11).** **Respaldos con los días antiguos en el código**: con la casilla vacía, `{{plazo_ampliacion}}` = 20 y `{{plazo_ampliacion_cycp}}` = 10, y `_badgeUltimatumHoy` usa 20/10 de ampliación y 10 de recordatorio. Choca con la idea de que los días solo viven en las casillas (§3.11). Con las casillas rellenas no se usan.
3. **✅ HECHO (v138).** **Tabla de la cadencia en el comentario del cron, desfasada** (recordatorio a +30, fechas +40/+45, retirados en v18.137). No decide nada, pero confunde. Arreglo: borrarla o remitir a §3.9.
4. **✅ HECHO (v138).** **Renombrar solo el tipo de vía no arrastraba `plan5_toma_datos`**, que guarda "TIPO_VIA DIRECCIÓN": la carpeta y `comunidades` cambian, la Toma de Datos se queda con el tipo viejo (§3.12).
5. **✅ HECHO (v138).** **Ruta muerta `plantillas-bot/avisos-tiempos`**: su formulario (`avcard`) no se pinta en ningún sitio; lo hace `plazo` (§3.22.3.5). Arreglo: borrar la ruta y `avcard`.
6. **⏳ RIESGO con la parte de Alberto (segundo repaso, 23/10/2026), sin tocar.** `ara-os-certificaciones.cjs` escribe en `comunidades` col P (fase) el valor «14_FINALIZADA» al certificar el final de una obra (`actualizarFaseObra`; su comentario dice «12_FINALIZADA»). **Nuestro `normalizarFase` no conoce ese valor y lo convierte en «01_CONTACTO»**: el expediente saldría en la fase 01 en HOY y en el listado y entraría en el cron de 01 (que no le mandaría nada si ya agotó sus reenvíos, pero lo trataría como un contacto). A 23/10/2026 no hay ninguno en el Sheet. Arreglo propuesto: que `normalizarFase` entienda «12_FINALIZADA»/«14_FINALIZADA» como 09 (y hablarlo con Alberto). Decide Guille.
7. **⏳ Restos en `hoy-bot-llamado` (segundo repaso, 23/10/2026)**: la ruta aún acepta `campo=revisado` (escribe `bot_expedientes` AB) y `revisado_faltan` (AD). Ninguna pantalla los manda ya, pero AB y AD son ahora del bot (REABIERTA, PREGUNTA): si algo los volviera a mandar, pisaría sus marcas. Arreglo: quitar esas dos ramas.
8. **⏳ El badge de plazo de la 01 nunca usa la fecha de contacto (segundo repaso, 23/10/2026, al hacer la v142).** `renderBadgePlazo` ancla la 01 en `comu.fecha_solicitud_pto`, que es el nombre de la columna Q **en el Sheet**, pero en el programa esa columna se llama `fecha_contacto` (`COLS`): el campo siempre está vacío y el badge cae siempre al respaldo (el último envío apuntado de la 01 en `mails_ultimo_envio`). Arreglo: usar `comu.fecha_contacto`. Ojo: cambiaría la fecha del badge de la 01 en los expedientes que tengan fecha de contacto; decide Guille.

## 9.3 `documentacion.cjs`

**Función muerta `cajitaVecinosHtml` + su helper `filaPisoHtml`** — Estado: **✅ HECHO (19/09/2026)**. ~718 líneas borradas (filaPisoHtml 673-724 + cajitaVecinosHtml y sus blancos 2549-3214) junto con las 28 clases de §9.1, en la misma entrega. `documentacion.cjs`: 3.916 → 3.198 líneas, 221.237 → 181.466 bytes. `node --check` OK. Grep final de confirmación tras el borrado: sin referencias cruzadas rotas.

**41 "LF sueltos" preexistentes en `documentacion.cjs`, normalizados** — Estado: **✅ HECHO (19/09/2026)**.
Eran 41 líneas consecutivas (3073-3113), exactamente el cuerpo de la ruta `POST /documentacion/bot/adjuntar` — de una entrega mía anterior que las dejó en LF en vez de CRLF (ver §0.18). Sin efecto funcional, solo cosmético. Normalizadas. `documentacion.cjs`: 181.466 → 181.507 bytes.

**`DOC_LABELS` — reclasificado, NO es un bug** — Estado: **✅ SIN ACCIÓN (19/09/2026)**. No son "3 copias que hay que unificar": `documentacion.cjs` tiene, aparte, un sistema deliberado y ya sincronizado con el bot (`TIPOS_BOT`+`BOT_FACE_CODES`, §4.3); `DOC_LABELS` de `documentacion.cjs` no alimenta ya nada (repaso 23/10/2026: el acordeón viejo sale de `documentos_manuales`; es código muerto, punto 14 de abajo; ver §4.3 y §1). La clave `adicional` que le falta no tiene efecto — no se usa en ningún sitio. La copia de `index.cjs` no importa (Guille confirmó que no la usa).

**Patrón repetido 4 veces (`inicializarEstadosFase`)** — Estado: **✅ HECHO (19/09/2026)**. Los 4 sitios que disparaban el avance a fase 05/08 tenían el mismo bloque `try/catch` copiado. Unificado en `_dispararInicializacionDocumentacion(comu, fase, contexto)` (línea ~383). `presupuestos.cjs`: 1.042.802 → 1.042.549 bytes.

**Incongruencias encontradas en la pasada completa (24/09/2026)** — Estado (repaso del 23/10/2026): **todas hechas, resueltas o decididas**. Ninguna se arregla sin DALE.
1. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: no borrar nunca filas; se quita la limpieza (cambio 9 de las decisiones del 02/10/2026, programadas en v19.93). **La limpieza de duplicados puede borrar el documento bueno.** `limpiarDuplicadosBotDocs` se queda con la fila más reciente de cada documento y borra el resto. Si un vecino mandó un DNI válido (OK) y después otro borroso (REPETIR), se borra el OK: la pastilla pasa a rojo y el bot puede volver a pedirlo. El bot, en cambio, elige el mejor estado reciente (OK antes que REVISAR antes que REPETIR). Además, borrar filas al abrir una ficha es escribir en una simple consulta. Arreglo: aplicar la misma regla que el bot (quedarse con el mejor, y a igualdad el más reciente), y valorar hacerlo solo después de escribir un documento, no al abrir la ficha.
2. **Cerrado (04/10/2026)**: lo habitual es que el teléfono cambie porque la gestión pasa a un hijo y aún no hay nada entregado, así que empezar de cero es lo correcto; se queda como en la v19.61. **El bot y la caja identifican los documentos por claves distintas**: el bot por teléfono, la caja por comunidad + vivienda. Cambiar el teléfono de un piso ya en W hace que el bot no encuentre la ficha ni los documentos del vecino (le abre ficha nueva y le vuelve a pedir todo) mientras la caja los sigue viendo. No hay ninguna sincronización (el manual decía que sí; corregido en §4.2). Arreglo: al cambiar el teléfono de un piso, actualizarlo también en `bot_expedientes` y `bot_documentos`, o avisar de que no se puede si está en W. **Resuelto en parte (v19.61)**: al cambiar el teléfono de un piso en W se ofrece la presentación al número nuevo y HOY olvida la ficha antigua; el nuevo empieza como vecino nuevo en el bot (decisión de Guille).
3. **✅ HECHO (02/10/2026).** **Ruta muerta y peligrosa `POST /documentacion/documento/marcar`** (con `marcarDocumento`, `buscarExpedientePorPiso`, `buscarExpedientePorTelefono` y sus ayudantes): ninguna pantalla la llama; es del acordeón viejo. Si se llamara, escribe en `pisos` con el esquema del modelo antiguo y, si no encuentra el piso, **añade una fila nueva a `pisos`**. Arreglo: borrarla.
4. **✅ HECHO (02/10/2026)** en `badgeEstadoVecino` y `normTlfKey`. Queda `invalidarCacheDocsManuales`, a propósito, para el punto 6.
5. **✅ HECHO (02/10/2026).** **Cabecera del fichero obsoleta**: habla de `vecinos_base`, de la pestaña `expedientes`, del bot en `index.cjs`, de "modo BOT irreversible" y de botones sin conectar. Arreglo: reescribirla con lo del capítulo 4.
6. **✅ HECHO (02/10/2026, v19.92).** **`documentos_manuales` se queda 15 minutos en memoria sin forma de refrescarla**: existe `invalidarCacheDocsManuales` pero nadie la llama. Arreglo: un botón "recargar" o bajar el tiempo.
7. **✅ HECHO (v19.95, 04/10/2026).** (lectura compartida) **Abrir una ficha hace muchas lecturas del Sheet**: `pisos` entera dos veces (`listarPisosDeCcpp` y `leerExpedientes` leen lo mismo), `bot_documentos` dos veces (limpieza y lectura), `comunidades` varias, más `bot_expedientes`, `bot_plantillas` y `documentos_manuales`. Arreglo: leer cada pestaña una vez por petición.
8. **Decidido (Guille, 02/10/2026)**: se dejan como están y se vigilan en cada repaso de integridad (regla 26). **Columnas del modelo antiguo en `pisos`** (estado del expediente, documentos recibidos/pendientes, AA/AB): ya no las usa nadie salvo la ruta muerta del punto 3. Decidir si se vacían o se dejan como histórico (no se borran columnas del Sheet sin Guille).
9. **✅ HECHO (02/10/2026).** **Comentario de `RANGO_EXPEDIENTES` desfasado**: dice "ampliado a AV" y el rango es `A:AX` (y ya existe la AY, `aviso_m3`, que esta caja no necesita leer).
10. **Corregido al reverificar (02/10/2026): el texto es correcto casi siempre.** Al pasar un piso a M, `piso/modo-bot` (`presupuestos.cjs`) machaca la fecha del primer mensaje (col J de `bot_expedientes`) con la del día, así que "Bot apagado y pasado a manual: <fecha>" dice la verdad. Solo falla si ese piso es el último de la comunidad con la fecha más antigua: entonces no se machaca (para no mover el plazo de la comunidad) y el texto muestra la fecha del primer mensaje. Caso raro; sin tocar.

**Encontrado en el segundo repaso (23/10/2026)**, sin tocar (ninguno se arregla sin DALE; ninguno cambia nada hoy de forma grave):
11. **⏳ El 📧 del piso sale también en 06 y 09.** `mailVecino` solo devuelve plantilla en 05, 07 y 08, pero en el resto de fases devuelve «falta la plantilla 08-INICIO CYCP (VECINO)» en vez de nada: si el piso está en M y tiene email en las notas, sale el 📧 (y se esconde el 💬) y al pulsarlo solo avisa. Arreglo: que fuera de 05/07/08 no haya 📧 (§4.2).
12. **⏳ Dos cuentas del «Faltan X de Y» en la caja.** Al abrir manda `refrescarContadores` (cuenta como HOY), pero al marcar un documento en el acordeón viejo o en la fila de la comunidad el badge lo recalcula `recalcularPill`, que cuenta todos los pisos por las columnas manuales. Hasta recargar puede no coincidir con HOY. Arreglo: que las dos llamen a `refrescarContadores` (§4.2.3.1).
13. **⏳ La casilla «activo» de `documentos_manuales` se lee distinto.** Vacía = activa en la caja (`!== "NO"`) y = no activa en HOY (`=== "SI"`). Como la columna de cada documento es su posición entre los activos, una casilla vacía descuadraría las columnas entre HOY y la ficha. **Hoy no pasa**: en el Excel del 23/10/2026 las 26 filas dicen «SI». Arreglo: la misma regla en los dos sitios (§4.8).
14. **⏳ `DOC_LABELS` y `DOCS_UNIVERSAL` son código muerto** en `documentacion.cjs` (nada los usa; el acordeón viejo sale de `documentos_manuales`), y el comentario de cabecera dice lo contrario. Arreglo: borrarlos y corregir el comentario (§4.3).

## 9.4 `presupuestos_plan5.cjs`

**La columna elegida en Datos económicos (Tradicional / Plan 5) no se guarda ni llega al expediente** — Estado: **✅ RESUELTO (02/10/2026)**: decisión de Guille, se quita la elección; siempre Plan 5. Texto original: Al pinchar el título de una columna, la pantalla dice "Clic para usar esta columna en el expediente" y cambia lo que se ve, pero esa elección no entra en lo que se guarda (`motor.colActiva` no está en el guardado): al recargar vuelve a Plan 5, y al cerrar el presupuesto el volcado al expediente usa siempre la columna Plan 5 (`totP5`). Decidir con Guille: si la elección debe valer (guardarla y usarla al volcar) o quitar el texto que promete que se usa.

**Alias de `getPlan5Css()` sobredimensionado** — Estado: **✅ HECHO (19/09/2026)**. Ver detalle completo en §9.1 — 16 alias sin uso borrados (no 13, cifra corregida al reverificar con el método correcto), quedan solo `--titulo`/`--g200` en el `:root` de `getPlan5Css()`.

**`validToken` fallaba "abierto" en Plan 5** — Estado: **✅ HECHO (19/09/2026)**. Único de los 4 ficheros con `try/catch` al cargar `lib/auth.cjs`, aceptando cualquier token si la carga fallaba (§1). Comprobado que, por el orden de carga real (`presupuestos.cjs` primero, sin red de seguridad, cacheado por Node), ese `try/catch` nunca podía llegar a dispararse en la práctica — pero corregido igualmente por higiene y consistencia con los otros 3. Probado en sandbox aislada antes de tocar el real: cero diferencia en el caso normal, más estricto en el caso límite. `presupuestos_plan5.cjs`: 711.590 → 711.531 bytes.

**Incongruencias encontradas en la pasada completa (24/09/2026)** — Estado (repaso del 23/10/2026): **abiertos solo el 21 (mejora, sin DALE) y el 24 (de Guille, en el Sheet)**; el resto, hechos o decididos. Ninguna se arregla sin DALE.
1. **Resuelto sin cambios (04/10/2026)**: la casilla Dirección de Toma de Datos ya es de solo lectura (la rellena la ficha); el único riesgo es cambiar la dirección escribiendo en el Sheet, y la regla es cambiarla siempre desde la ficha (desde la fase 05, ni eso). **Cada presupuesto se encuentra por su dirección escrita, no por el id del expediente.** `leerFila` compara la columna A (dirección en mayúsculas, con el tipo de vía) aunque la B guarda el id. Si se cambia la dirección del expediente en el CRM (una tilde, un "C/" por "C"), Toma de Datos no encuentra su fila y abre un presupuesto vacío; el viejo queda huérfano en el Sheet. Arreglo: buscar por id y, solo si no hay, por dirección.
2. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: las tarifas se quedan (EMASESA no saca otras); solo el año del texto sale de la fecha del presupuesto (cambio 1 de las decisiones del 02/10/2026, programadas en v19.93). **Tarifas de EMASESA y texto del año fijos en 2026.** El cálculo usa `TARIFAS[2026]` y el impreso dice "previstos para el año 2026". A partir del 1/1/2027 seguirá igual hasta que alguien lo cambie a mano. Arreglo: elegir el año por la fecha del presupuesto (con la tabla de 2027 cuando exista) o, al menos, un aviso visible al cambiar de año.
3. **✅ HECHO (02/10/2026).** **`POST /plan5/calcular` sin token y sin uso.** Cualquiera que conozca la URL puede usar el motor de cálculo. Arreglo: borrarla (ninguna pantalla la llama) o ponerle token.
4. **✅ HECHO (02/10/2026).** **`POST /plan5/mediciones/guardar` sin uso.** Escribe el valor general de un parámetro para todas las obras, pero ninguna pantalla la llama. Decidir si se borra o si se quiere una pantalla para editar los generales.
5. **Decidido (Guille, 02/10/2026)**: **se queda así**: la ficha refleja el último presupuesto cerrado, que para eso está el candado. **El volcado al congelar machaca la fórmula de `beneficio_previsto`** (col AB de `comunidades`) con un número. Es a propósito, pero si luego se reabre el presupuesto la ficha del CRM se queda con los números viejos hasta volver a congelar. Decidir si se vuelca también al guardar, o se avisa en la ficha de que los datos son del último cierre.
6. **✅ HECHO (02/10/2026).** **Código sin uso**: en el servidor `_p5tramosLong`, `_p5protTxt`, `_p5ContarPuertaResto` y `calderinDe`; en Toma de Datos `dAli`, `pTubo` y `pViv`; en Mediciones (`p5DesgloseHandler`, 02/10/2026) `pintarBloqueSheet`, `nViv`, `puntosCom`, `sinVar` y `esCuadrilla`; en el impreso, `renderMateriales` y `renderTareas`. Arreglo: borrarlos.
7. **✅ HECHO (02/10/2026).** **Menú con una opción sin hacer**: "IMPRIMIR DATOS" solo muestra "en construcción". Y el menú comprueba una opción "IMPORTAR IMAGENES" que ya no existe. Decidir si se quita la opción o se hace.
8. **✅ HECHO (02/10/2026).** **Comentarios de cabecera desfasados**: "Build: 2026-07-16" (la revisión viva es la Rev-23.1 del 28/09) y "Columnas: A … G" encima de `RANGO_PLAN5`, que ya llega a la I.
9. **✅ HECHO (v19.95, 04/10/2026).** **El aviso de Toma de Datos repite las reglas de cálculo con los números escritos a mano.** El servidor lee del Sheet los umbrales de peines y enganches (hasta 4 plantas, 3 días; enganche exterior 1 y 2 días; interior fácil 1,5 y 3; interior medio y difícil por vivienda), pero el aviso de la pantalla los tiene fijos en su código. Si se cambian en `plan5_mediciones`, el presupuesto cambia y el aviso sigue diciendo lo de antes. Además el aviso no conoce el "Corte 2" de peines: aunque se configure en el Sheet, sigue diciendo "pendiente de valorar a mano". Arreglo: que el aviso use los valores que ya calcula el servidor (el desglose que la pantalla ya pide).
10. **Resuelto (04/10/2026)**: ver punto 1. **Cambiar la dirección en Toma de Datos crea un presupuesto nuevo.** La pantalla guarda con la dirección que haya escrita en sus propios campos; si se edita el tipo de vía o la dirección, el siguiente guardado ya no encuentra su fila y **crea otra**, sin los valores propios (H) ni la foto congelada (I). El presupuesto bueno se queda en la fila vieja. Arreglo: guardar siempre contra la fila original (por id, punto 1) y que cambiar la dirección solo cambie el texto.
11. **✅ HECHO (02/10/2026, v19.92).** **El candado solo existe en la pantalla.** Las rutas que guardan Toma de Datos y los valores propios de Mediciones no comprueban si el presupuesto está cerrado. Una pestaña del navegador abierta desde antes de cerrar puede seguir escribiendo: la foto congelada no cambia, pero esos valores se aplicarían al reabrir con "Editar a mano". Arreglo: que el servidor rechace escrituras en un presupuesto cerrado.
12. **✅ HECHO (30/09/2026, §5.21). El diámetro que calcula la pantalla no era el mismo que el del servidor.** Para la pastilla "válido" del tubo de conexión, la pantalla suma el ajuste por longitud al diámetro teórico y luego busca el comercial; el servidor busca primero el comercial y luego suma y redondea. En algunos casos la pantalla da un diámetro que no existe (por ejemplo 35 mm). Solo afecta a esa pastilla, no al presupuesto. Se unificó: la pantalla usa las funciones del servidor.
13. **✅ RESUELTO (02/10/2026)**, es el mismo fallo que el primero de este apartado (se quitó la elección). **La elección de columna "Tradicional / Plan 5" no llega a ningún sitio.** En Toma de Datos se puede pinchar la columna tradicional ("Clic para usar esta columna en el expediente") y se guarda, pero el impreso, el volcado a la ficha del CRM y el resto del programa usan siempre Plan 5. Solo cambia el recuadro de subvención de la propia pantalla. Decidir si debe tener efecto o quitar el texto que lo promete.
14. **✅ Textos del diálogo HECHOS (02/10/2026)**: ahora dicen que se recalcula con el programa de hoy y qué se conserva. Aviso al cerrar con "Nº de suministros" en rojo: **✅ HECHO (v19.94)**. Texto original: **Textos del diálogo del candado que no dicen lo que pasa**: "Editar a mano — Deja la foto tal cual" (ya anotado en §5.18.1) y "Actualizar solo precios — Mantiene las cantidades de la foto" (mantiene las cantidades puestas a mano, pero el resto se recalcula con el código de hoy). Además, el candado guarda Toma de Datos antes de congelar y puede congelar un dato que la pantalla calcula mal (§5.18.1). Arreglo: cambiar los textos y valorar un aviso al cerrar cuando "Nº de suministros" esté en rojo.
15. **✅ HECHO (v19.95, 04/10/2026).** **Catálogo de baterías y tablas de diámetros fijos en la pantalla.** La lista de baterías (4T-2F … 30T-3F) y sus medidas están escritas en el código de Toma de Datos, (las tablas de diámetros ya no: se unificaron el 30/09/2026, §5.21). Un modelo de batería nuevo en `plan5_precios` no aparece en el desplegable. Arreglo: sacar el catálogo al Sheet.
16. **✅ HECHO (v19.95, 04/10/2026).** **Parámetros viejos que se siguen leyendo**: el servidor aún lee "Corte 1/2 · hasta (m)" y "Corte 1/2 · días" de los peines V-EXT (criterio por metros), que ya no usa ninguna fórmula. Arreglo: dejar de leerlos y decidir si se borran esas filas del Sheet.
17. **✅ HECHO (02/10/2026, v19.92).** **En Mediciones, deshacer solo funciona en la columna Dato**: los cambios de cantidad y de precio no se pueden deshacer con los botones. Arreglo: meterlos en el mismo historial.
18. **✅ HECHO (02/10/2026, v19.92)**: la tabla del catastro ordena DR, CT, IZ (y DCHA/CENTRO/IZDA). **Corregido**: el servidor no tenía otra copia; la memoria usa el orden en que la pantalla guarda el catastro, así que basta con este arreglo (se aplica al volver a guardar cada Toma de Datos).
19. **✅ HECHO (02/10/2026, v19.92).** **Con el presupuesto cerrado se pueden seguir añadiendo cosas al croquis.** El bloqueo de "cerrado" desactiva el lienzo y casi todos los botones, pero no el botón "Símbolos": sus opciones (peines, textos, PISOS, portal, batería…) se colocan en el centro sin tocar el lienzo y guardan al momento. El croquis no forma parte de la foto congelada, así que **el croquis que se imprime de un presupuesto cerrado puede cambiar**. Arreglo: incluir ese botón en el bloqueo (y que el servidor rechace el guardado, punto 11).
20. **✅ HECHO (02/10/2026, v19.92).** **"Borrar todo" del croquis no pide confirmación y no se puede deshacer.** Un clic borra trazos, peines, textos, símbolos y líneas y guarda al instante; el deshacer de Toma de Datos no cubre el croquis. Arreglo: pedir confirmación.
21. **Sello de criterio por expediente (mejora de arquitectura, no implementar sin DALE explícito).** Guardar en cada obra con qué versión del motor de cálculo se hicieron sus números, para que al reabrir se pudiera respetar ese criterio en vez de aplicar siempre el de hoy (§5.18). No es una casilla suelta: afecta a `_p5Entrada`, `calcMontantes` y a qué significa "reabrir".
22. **✅ HECHO (02/10/2026).** **Mediciones tiene una rama para un “presupuesto descongelado sobre la foto” que ya no puede darse** (02/10/2026). `p5DesgloseHandler` aplica cantidades y precios propios encima de la foto si la obra tiene foto y no está cerrada (con su cuadro aparte, `_p5CuadroDesdeLineas`), y la pantalla tiene para ese caso un aviso (“ábrelo en modo Recalcular”, un modo que no existe) y la columna Dato bloqueada. Pero abrir el candado borra siempre la foto (§5.18.1), y en el Excel ninguna obra está abierta con foto. Es el resto de una versión anterior del candado. Arreglo: borrar la rama, el aviso y `_p5CuadroDesdeLineas`.
23. **✅ HECHO (v19.93, 02/10/2026).** **Cambio de criterio (Guille, 02/10/2026)**: no se toca el Sheet; lo ajusta el código (cambio 2 de las decisiones del 02/10/2026, programadas en v19.93). (Lo que se había pensado antes, que Guille cambiara en el Sheet la fila 22 de `plan5_mediciones`, columna B → `Accesorios, pequeño material y comprobación`, quedó sustituido por ese cambio.) **El % de accesorios del cuarto de contadores no se lee del Sheet** (02/10/2026). El código busca el concepto “Accesorios, pequeño material y comprobación” y en `plan5_mediciones` está escrito “Accesorios, p.material y comprobación”. Por eso se usa siempre el 10 % escrito en el código, cambiar ese valor en el Sheet no hace nada y en Mediciones la línea no tiene casilla Dato. Hoy los dos valen 10 %: no cambia ningún importe. Arreglo: escribir el mismo nombre en los dos sitios.
24. **⏳ Lo hace Guille en el Sheet (02/10/2026)**: añadir al final las filas de los tramos 3 y 4 del fontanero y 1 a 4 del albañil (mismos valores que hoy da el código: 0,25 · 0,375 · 1 · 2 días). **Tramos del tubo de conexión sin fila en el Sheet** (02/10/2026). Mediciones muestra 4 tramos de días para el fontanero y 4 para el albañil, pero `plan5_mediciones` solo tiene los tramos 1 y 2 del fontanero: el resto son números del código. Se pueden cambiar para una obra, pero no en general, y al cerrar no se congelan (solo se congela lo que hay en el Sheet), así que un cambio en el código los movería en una obra cerrada que se reabra. Arreglo: dar de alta esas filas en el Sheet.
25. **✅ HECHO (02/10/2026).** **IMPORTAR CATASTRO desde Mediciones no funciona** (02/10/2026). La opción está en el menú de las dos pantallas, pero toma la dirección de los campos de Toma de Datos; en Mediciones no los hay y acaba en “No se pudo cargar la lista” o en un error del Catastro (tampoco comprueba si está cerrado). Arreglo: mostrarla solo en Toma de Datos.
26. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: en blanco (cambio 3 de las decisiones del 02/10/2026, programadas en v19.93). **En el Análisis de Subvención el “Suministro nº” sale siempre 0** (02/10/2026). La página lo lee de `meta.suministro`, que la ruta nunca rellena. Decidir con Guille: quitarlo o sacar el número de algún sitio (no hay columna para él).
27. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: el cálculo ya era correcto (locales sin suministro sí se instalan y entran; con suministro, no); solo se corrige el número de la tabla (cambio 4 de las decisiones del 02/10/2026, programadas en v19.93). **El reparto por comunero del Análisis de Subvención no cuenta los locales** (02/10/2026). La fila dice “N de 13 mm” con solo las viviendas (`viviendas`), pero el importe por comunero se divide entre viviendas y locales (suministros menos la toma de comunidad). Caso C Virgen de Loreto 9: dice “9 de 13 mm” y divide entre 11 (los 2 locales sin suministro que se montan, §5.6). Decidir con Guille cómo debe salir.
28. **✅ HECHO (02/10/2026, v19.92).** **El impreso de un presupuesto cerrado lee los textos de la Toma de Datos viva** (02/10/2026). Los euros salen de la foto, pero la memoria, las condiciones, el grupo de presión y la identificación de viviendas salen de la columna G tal como esté hoy, no de la copia congelada al cerrar (`snapshot.toma`, que solo usa Toma de Datos). Normalmente da igual porque cerrado no se puede editar, pero puede cambiar por los huecos de los puntos 11 y 19. Arreglo: que el impreso use la copia congelada si está cerrado.

**El ático numerado en el catastro se cuenta dos veces** — Estado: **✅ ARREGLADO (26/09/2026)**: si hay zona Ático, Resto de plantas no cuenta las filas del catastro con planta por encima del "Nº de plantas" declarado (`_p5ContarResto` en Toma de Datos). Ya no hace falta escribir "Ático" en la planta, aunque sigue funcionando (§5.6).

## 9.5 `bot-whatsapp.cjs`

**Duplicación con `index.cjs`** — Estado: **✅ SIN ACCIÓN, decisión de Guille (19/09/2026)**. `FLOWS`/`REQUIRED_DOCS` duplicados entre `bot-whatsapp.cjs` y el bot viejo mudo de `index.cjs`, ya divergidos en regla de negocio real (§9.3 tiene el mismo patrón con `DOC_LABELS`). Guille confirmó que esa copia no la usa — no se toca.

**Respuestas del bot sin "por aquí" (v19.108, criterio de Guille, 12/10/2026)** — el programa no escribe solo al vecino cuando Guille revisa: si falta algo, Guille le avisa por su WhatsApp de empresa. Por eso las respuestas del bot dicen "si falta algo, le avisaremos", nunca "se lo diremos por aquí" ni "le avisaremos cuando esté todo en orden" (fase 05 y 08, en el código). La plantilla del Sheet `flujo_base_completo` ("…te avisará si necesitamos algo más") ya cumple y se deja. Mejora apuntada y no hecha: botón "Pedir lo que falta por el bot" (texto libre dentro de las 24 h; fuera, plantilla de Twilio).

**Restos de la recogida antigua de la fase 08** — Estado: **✅ BORRADOS (v19.112, 13/10/2026)**: `_procesarArchivo08`, `_finalizarContrato08` y `_clasificarDoc08` ya no existen: se borraron (queda solo un comentario en su sitio; los archivos se guardan tal cual, §6.17).

**El job lee `pisos` y `comunidades` por cada vecino** — Estado: **✅ HECHO (v19.95)**: lectura compartida (60 s en el job; el webhook siempre fresco). `ejecutarJobSeguimiento` llama a `pisoActivoParaBot` dentro del bucle, y cada llamada lee las dos pestañas enteras. Con muchos vecinos activos, son muchas lecturas del Sheet cada hora, cerca del cupo por minuto de Google. Propuesta: leer las dos pestañas una vez al empezar el job y consultar en memoria. Depende solo de `bot-whatsapp.cjs`. No se toca sin DALE.

**Incongruencias encontradas en la pasada completa (24/09/2026)** — Estado (repaso del 23/10/2026): **todas hechas o decididas** (el 2, el 11 y el 13 en v139). Ordenadas de más a menos importantes. Ninguna se arregla sin DALE.
1. **✅ HECHO (02/10/2026, v19.92).** **El aviso al equipo "falla 3 veces" prácticamente nunca sale.** `calcularRequiereIntervencion` pone `requiere_intervencion_humana = si` en cuanto un documento acumula 2 REPETIR, y se recalcula tras cada documento. El aviso de `handleArchivos` salta a los 3 fallos solo si la marca no estaba puesta, y a los 3 fallos ya lo está desde el segundo. Arreglo: un único umbral, y avisar al equipo en el momento en que la marca pasa de no a sí, sea cual sea el motivo.
2. **✅ HECHO (v139).** Ahora, sin plantilla `presentacion` activa, no se manda nada, no se crea la ficha ni se marca el reenvío, y la caja de documentación avisa «NO se pudo enviar la presentación (sin_plantilla…)»; además las plantillas se cargan antes, así que una plantilla desactivada ya no sale por el código de respaldo (antes, si el bot no las había cargado aún, salía igual). **Presentación "enviada" sin mensaje.** Si la plantilla Twilio `presentacion` está desactivada o sin SID en `bot_plantillas`, `enviarWhatsAppPlantilla` no envía nada y no da error; `enviarPresentacionPiso` crea igualmente la ficha (fija la fecha de arranque de la fase 05) y apunta el envío en `bot_avisos`. Lo mismo en el job: marca el nivel de aviso como mandado aunque no salga. Arreglo: que el envío devuelva si salió o no, y no crear ficha ni apuntar aviso si no salió.
3. **✅ HECHO (v19.93, 02/10/2026).** **Decidido (Guille, 02/10/2026)**: el bot solo en fase 05 (cambio 7 de las decisiones del 02/10/2026, programadas en v19.93). **El bot sigue activo en fase 08 pidiendo documentos de fase 05.** El filtro bot admite 05 y 08, pero los flujos no tienen contrato ni pago: en 08 el bot solo puede seguir pidiendo la documentación de 05 que le falte al vecino, y el job le manda recordatorios de esa documentación. Choca con el criterio de que en fase 08 no hay bot (plazos, M3…). Arreglo propuesto: dejar el filtro solo en 05, o decidir qué debe hacer el bot en 08.
4. **✅ Resuelto sin cambio (02/10/2026)**: desde el 25/09 los textos del bot no llevan días; los plazos los da Guille con M1-M4. **Los plazos que el bot comunica ignoran la prórroga.** El aviso de plazo (`msg_plazo_1`, días restantes, "fuera de plazo") cuenta desde el primer contacto con `t_plazo_fuera` fijo; si el CRM ha concedido la prórroga (`fecha_ultimatum_ampliado`), el bot le sigue diciendo al vecino que está fuera de plazo, mientras HOY y los M1-M4 ya usan la fecha ampliada. Arreglo: que el bot lea la prórroga de la comunidad. **Mitigado el 25/09/2026 sin tocar código**: se quitó `{dias}` de los textos del bot (§6.5), así que el bot ya no dice cuántos días quedan; los plazos solo los comunica Guille con M1-M4. Queda pendiente solo si se quisiera que el bot volviera a dar días.
5. (modo aviso hasta poner `TWILIO_VALIDAR_FIRMA=1` en Render) **✅ HECHO (02/10/2026, v19.92).** **Webhook sin comprobar la firma de Twilio.** `POST /whatsapp` no valida la cabecera `X-Twilio-Signature`: quien conozca la URL podría simular mensajes de un vecino. Arreglo: `twilio.validateRequest` al principio del webhook.
6. **✅ HECHO (02/10/2026, v19.92).** **Mensajes vacíos si falta una fila de texto.** `error_mensaje`, `error_documento` y `doc_recibido` se leen con respaldo vacío; si la fila no existe o está desactivada se intenta mandar un mensaje en blanco, que Twilio rechaza, y el vecino se queda sin respuesta. Arreglo: respaldo de texto en el código, como el resto.
7. **✅ HECHO (02/10/2026, v19.92).** **La lista del recordatorio llega en una sola línea.** Al mandar una plantilla Twilio se cambian los saltos de línea de las variables por espacios, así que la lista de documentos pendientes del recordatorio sale todo seguido. Arreglo: separar con comas o " · " en vez de saltos de línea.
8. **Decidido (Guille, 02/10/2026)**: **se quedan en el código**; si hay que cambiar uno, lo cambia el asistente. **Los textos de petición de cada documento no se pueden editar.** Los textos de `FLOWS` (lo que el bot pide en cada paso) están fijos en el código; en Plantillas del bot solo se editan la bienvenida y los avisos. También queda fija la respuesta de último recurso "Mensaje recibido.". Decidir si se pasan a `bot_plantillas`.
9. **✅ HECHO (02/10/2026).** **Respuesta de "número no reconocido" inalcanzable** (§6.4): el filtro bot va antes. O se quita, o se decide contestar a los desconocidos.
10. **✅ HECHO (02/10/2026).** **Restos de código retirado**: títulos de secciones sin código (revisión de nota simple, panel, endpoints CRM, PDF expediente EMASESA, diagnóstico temporal), un aviso "DEPRECATED" sin función debajo, y un comentario que habla de `getNextStep`, que ya no existe. Además `getFirstStep` está marcado como obsoleto pero se usa al elegir tipo y al empezar la financiación. Limpieza sin efecto en el funcionamiento.
11. **✅ HECHO (v139)**: `buscarVecinoPorTelefono` usa la misma lectura compartida que `pisoActivoParaBot`, así que en el webhook `pisos` se lee una vez por esas dos (en el banco, 3 lecturas de `pisos` por mensaje en vez de 4; las otras dos son de otras partes del flujo). **Cada mensaje entrante lee `pisos` dos veces y `comunidades` una** (`pisoActivoParaBot` y `buscarVecinoPorTelefono`). Se puede leer una vez. Sigue abierto (comprobado el 23/10/2026: dos lecturas separadas en el webhook); la optimización del job con la que iba se hizo en v19.95 sin incluirlo.
12. **✅ HECHO (02/10/2026, v19.92).** **La fase se compara sin normalizar** (`"05_DOCUMENTACION"` literal), mientras el CRM tolera variantes con `normalizarFase`. Si en el Sheet hubiera una variante, el bot callaría.
13. **✅ HECHO (v139)**: el bot coge el plazo de `PLAZO_DOC_INICIAL` de `presupuestos.cjs` (`_plazoDocInicial`). **El plazo de 20 días está en dos sitios**: el bot fija `fecha_limite_documentacion` a +20 al crear la ficha, y el CRM usa su constante `PLAZO_DOC_INICIAL`. Si se cambia uno, no cambia el otro.
14. **✅ HECHO (02/10/2026, v19.92).** **La IA con imagen tiene solo 7 segundos** (`IA_TIMEOUT_MS`). Con documentos largos o fotos grandes, si OpenAI tarda más, la llamada se corta y el documento queda "sin clasificar" (REVISAR) aunque fuera correcto. Arreglo: más tiempo para los análisis con imagen, o un reintento.
15. **✅ HECHO (02/10/2026, v19.92).** **La conversión de PDF a imagen no tiene tiempo máximo.** Si `pdftoppm` se queda colgado con un PDF raro, la cola de ese vecino se queda parada (el siguiente mensaje suyo espera detrás). Arreglo: tiempo máximo en la llamada.

**Encontrado en el segundo repaso (23/10/2026), con el mapa de relaciones**:
1. **✅ ARREGLADO (v140, 23/10/2026).** **FALLO: la pregunta de la forma de pago salía sin importes en los presupuestos cerrados desde el 23/09/2026.** `_cargarImportesP5` lee solo `plan5_toma_datos!A:G` y busca la foto congelada dentro de G (`datos_json.snapshot.cuadro`), pero desde el 23/09/2026 Plan 5 la guarda en la columna I (§5.4). En el Sheet del 23/10/2026: Ardilla 9, Ciudad de Gandía 5, Tharsis 5 y Sánchez Pizjuán 6 tienen la foto en I y les sale la pregunta sin «(… €)» ni «unos … €/mes»; Malvaloca 1 (cerrado antes, foto en G) sí los tiene, y fue con la que se probó la v128. Arreglo: leer A:I y coger la foto de I y, si está vacía, de G. Hecho en la v140 (probado con una fila con la foto en I, otra en G y otra abierta: salen los importes de las dos primeras y nada en la tercera).

## 9.6 Pendiente de repasar con este mismo esquema
**Pasada completa con la lista fija de §0.24 (medir los 7 puntos contra el código y apuntar incongruencias como arreglos)**: hecha en `bot-whatsapp.cjs` (24/09/2026, resultado en §9.5) en `estilo-visual.cjs` (§9.1), `documentacion.cjs` (§9.3) y `presupuestos_plan5.cjs` (§9.4), todos el 24/09/2026. `presupuestos.cjs`, el 02/10/2026: **hecha, 7 de 7 puntos** (rutas: las 18 que no salían, añadidas en §3.7, §3.12, §3.11 y §3.15.1; pestañas: las 13; funciones principales: las del cron, histórico, renombrado y barrido añadidas; relaciones: §3.24; automatismos: frecuencia de la lectura de correo añadida en §3.7; configuración editable: ya estaba; trampas: dos nuevas en §9.2). **Ya están los cinco ficheros.** **Criterio de Guille: las mejoras apuntadas no se atacan hasta haber hecho la pasada de los cinco módulos**; después se repasan todas juntas y se decide el orden.
**Falta**: `horario-bot.cjs` (nuevo en v127) no ha tenido su pasada con la lista fija ni capítulo propio; hoy se explica dentro de §3.22.3.4 bis y §6.5, y en el repaso del 23/10/2026 se comprobó que lo que dicen esos apartados es cierto. Es pequeño (exporta cuatro cosas: el horario por defecto `HORARIO_DEFECTO` y las funciones `normalizarHorario`, `calcHorario` y `textoHorario`; lo cargan con `require` `bot-whatsapp.cjs` y `presupuestos.cjs`): basta con hacerle la pasada la próxima vez que se toque.

---

# 10. REGISTRO DE CAMBIOS (VERSIONES DEL PROGRAMA)
> Desde el 17/10/2026 las versiones son un número consecutivo con su fecha al lado ("v121 (18/10/2026)"; regla 30 del capítulo 0); las de abajo conservan su nombre antiguo (v19.120 = v120).
> Qué cambió, cuándo y dónde está explicado; **la más nueva arriba**. Aquí solo se apunta el cambio y la referencia: cómo funciona se explica en su capítulo (2-6). Cada entrega añade su línea arriba (regla 8 del capítulo 0).
> **Aviso del repaso del 23/10/2026**: entre el 19 y el 22/10/2026 se repitieron números (la **v128** son ocho entregas distintas del 21-22/10 y la **v127** dos, del 19 y del 20/10), y el código lleva esos mismos números en sus comentarios (unos 60 «v128»), así que no se renumeran: para citar una, se dice el número y el cambio («la v128 de la cerradura»). Además, en el código los títulos del compositor de la v130 están marcados «v129», y la v129 y la v133 están marcadas «Rev-26». Desde la v137, un número por entrega (regla 30).

- **v142 (23/10/2026; Guille: «ok a todo» y «Dale», punto 4)**: **aviso en HOY si una columna de `comunidades` o `pisos` se mueve** (`_comprobarColumnas`, al arrancar y cada 6 h; §3.14). Se exporta `_comprobarColumnas` en `app.locals.presupuestos` para el banco. Un caso nuevo en el banco (21). Solo `presupuestos.cjs`.
- **v141 (23/10/2026; Guille: «ok a todo» y «Dale»)**: **tres avisos de sistema más en HOY** (§3.14, «Avisos de sistema en HOY»): la IA del bot que falla seguido (con la IA encendida), presupuestos de Plan 5 cerrados en los que el bot no encuentra importes, y plantillas de correo o del bot que el programa ha necesitado y no están. En `bot-whatsapp.cjs`, `_saludBot` sube al principio del fichero y se exporta `iaActiva`. Dos casos nuevos en el banco (20 en total). `presupuestos.cjs` y `bot-whatsapp.cjs`.
- **Banco de pruebas permanente (23/10/2026, Guille: «ok a todo» y «Dale»; no cambia el programa)**: nueva carpeta `banco-pruebas/` con el simulador, 18 casos fijos (20 con la v141) y el conversor del Excel; los datos no se suben. Regla 32 y §7.3.
- **v140 (23/10/2026, segundo repaso; Guille: «Ok dale»)**: **la pregunta de la forma de pago del bot vuelve a llevar los importes** en los presupuestos cerrados desde el 23/09/2026: `_cargarImportesP5` lee ya la foto de la columna I y, si está vacía, la de G, como Plan 5 (§6.4, §9.5). Afectaba a Ardilla 9, Ciudad de Gandía 5, Tharsis 5 y Sánchez Pizjuán 6. Solo `bot-whatsapp.cjs`.
- **v139 (23/10/2026, repaso de integridad, tanda 3; Guille: «Dale»)**: (1) **pie doble en los correos manuales**: `enviarMailReal` ya no añade el pie si el cuerpo lo lleva (el compositor lo escribe al abrirse); confirmado con 406 correos de `mail_historico` que salieron con el pie dos veces (§3.7, §9.2). (2) **Los días de prórroga y de resolución de los correos ya no tienen respaldo en el código**: con la casilla vacía, la ventana del correo avisa de que falta en vez de poner 20/10/5 (§3.11). (3) **Presentación con la plantilla desactivada**: no se manda, no se crea la ficha y se avisa; antes se daba por presentada (y, si el bot no había cargado las plantillas, salía igual con el código de respaldo) (§6.13, §9.5 punto 2). (4) El webhook lee `pisos` una vez menos por mensaje (§9.5 punto 11). (5) El plazo de 20 días del bot sale de `PLAZO_DOC_INICIAL` (§9.5 punto 13). `presupuestos.cjs` y `bot-whatsapp.cjs`. Probado en el banco con el Sheet del 23/10: correo manual con el pie en el cuerpo → 1 pie (antes 2); ventana del correo de disidentes con la casilla Resolución vacía → aviso (antes «5 días»); presentación con la plantilla en NO → no sale ni crea ficha (antes salía); webhook de un vecino de Malvaloca 1 → 3 lecturas de `pisos` (antes 4); fecha límite de la ficha nueva igual que antes; HOY y Plantillas del bot idénticas.
- **v138 (23/10/2026, repaso de integridad; Guille: «arregla y sube, lo dejo a tu criterio»)**: cuatro arreglos pequeños que no cambian nada de lo que se ve. (1) **Renombrar solo el tipo de vía** arrastra ya la fila de `plan5_toma_datos` (antes Plan 5 dejaba de encontrar la obra desde la ficha; §3.12). (2) Quitada la ruta muerta `plantillas-bot/avisos-tiempos` y su tarjeta `avcard`, que no se pintaba (§3.22.3.5). (3) Quitada la tabla del "esquema de la fase 05" del comentario del cron, que ya no correspondía a nada (§3.8). (4) Quitado `var(--ptl-general-4)`, un color que no existe, del CSS de Mediciones (§2.5, §9.1 punto 9). `presupuestos.cjs` y `presupuestos_plan5.cjs`. Probado en el banco con el Sheet del 23/10: HOY, Plantillas mail y Plantillas del bot salen idénticas carácter a carácter antes y después; renombrar Ardilla 9 de «C» a «Av» cambia su fila de Plan 5 a «Av Ardilla 9» (antes se quedaba «C ARDILLA 9»). Mediciones no se pudo pintar en el banco: el cambio de color se razonó (con la variable inexistente el navegador ya usaba el color heredado, que es el mismo que queda ahora).
- **v137 (23/10/2026, repaso de integridad; Guille: «arregla y sube, lo dejo a tu criterio»)**: **las marcas del ultimátum de la 05 ya no pasan a la 08**. La limpieza de BL/BM/BN y de sus `__SKIP`/`__HASTA` solo la hacía `/avanzar`, pero desde la 07 se pasa a 08 por la ventana del correo 08-INICIO CYCP (`/enviar-mail`, enviando o con «Saltar envío»), que no limpiaba: en la 08 el cron no mandaba el 08-SEGUIMIENTO CYCP y los badges del ultimátum salían con lo de la 05. Ahora es una sola función que usan los tres caminos (§3.2). Afectaba a Doctor Fedriani 17 y Nescania 25 (en 07), Manuel Casana 7 (06), Diego Puerta 5 y Otelo 8 (05); ninguna estaba aún en 08. Solo `presupuestos.cjs`. Probado en el banco con el Sheet del 23/10: con el código anterior «Saltar envío» y «Enviar» dejaban BL/BM en la 08; con la v137 los tres caminos las dejan vacías y del JSON de correos solo quitan las marcas del ultimátum.
- **v136 (22/10/2026, criterio de Guille: "solo para Sánchez Pizjuán y hasta que te diga que anulamos la particularidad de hoy") — APAÑO TEMPORAL, dentro de la Rev-26**: en el presupuesto **O25-ARA/00213 (Sánchez Pizjuán 6)**, y solo en ese, no sale la línea inclinada (`fhueco`, hueco fijo de 113 mm antes del recuadro de importes y firmas), para que el recuadro quepa en la hoja de la cláusula 8 como en la Rev-18 (con el hueco, hueco y recuadro saltaban juntos a una hoja casi en blanco). Va con el apaño de la v134 (misma condición `_cl8antigua`) y se quita con él. Probado en el banco: Sánchez Pizjuán 6 con el recuadro en la hoja de la cláusula 8; Doctor Jaime Marcos 3 sigue con su línea.
- **v135 (22/10/2026, criterio de Guille: "antes, en la revisión 25.1, salía todo en una página") — dentro de la Rev-26 (Guille: "seguimos en rev 26")**: la hoja de fotos vuelve a caber en una página. Causa: el alto de las dos primeras filas lo marcaba la tabla del catastro (62 filas fijas); con usos largos que ocupan varias líneas («Almacén-Estacionamiento.Uso Residencial», planta 0 puerta 6 de Sánchez Pizjuán 6) la tabla crecía, empujaba las fotos y la última fila (croquis + fotos 7-9) saltaba de página. No venía del cambio de orden de la v129: la v128 (Rev-25.1) lo partía igual en el banco. Arreglo en `_p5paginaImagenes`: (1) la caja del catastro lleva `contain:size`, así que su alto lo marcan las fotos y las filas en blanco de relleno que no caben se recortan; (2) si ni las filas con datos caben (Sierpes 46: 64 pisos; Sánchez Pizjuán 11: 62), un script baja la letra de la tabla de 0,25 en 0,25 px hasta que entra la última (`tr.p5last`). Probado en el banco: Sánchez Pizjuán 6, Doctor Jaime Marcos 3, Av de la Calesera 31, Cruz del Sur 13, Sánchez Pizjuán 11 y Sierpes 46, todos con la hoja de fotos en una sola página y todas las filas con datos visibles.
- **v134 (22/10/2026, criterio de Guille: "quiero que aparezca como en la revisión 18… solo va a pasar con este presupuesto") — APAÑO TEMPORAL**: el presupuesto **O25-ARA/00213 (Av. Sánchez Pizjuán 6)**, y solo ese, imprime la **cláusula 8 antigua** tal como salió en la Rev-18 (un párrafo: validez 1 mes, 20 y 10 días naturales, el 10 % —3.640,44 €— en la cuenta del Santander, 15 días). Todos los demás siguen con la cláusula 8 nueva (8.1–8.6). En el código: `_cl8antigua` / `_cl8` en `_p5paginasLegales`, marcado «APAÑO TEMPORAL v134». Motivo: el presupuesto se pasó del Excel (Rev-18) a Plan 5 y Guille no quiere tener que defender ante la comunidad un cambio de cláusula. **Se quita en la versión siguiente**, en cuanto Guille confirme que ya está impreso (§8). Probado en el banco: la cláusula 8 de Sánchez Pizjuán 6 sale letra por letra igual que en el PDF de la Rev-18; Ardilla 9 (O25-ARA/00219) sigue con la nueva.
- **v133 (22/10/2026, criterio de Guille, dentro de la Rev-26)**: en la Memoria, la frase de la batería 1 ya no nombra la planta baja cuando en ella solo hay locales y la frase ya dice «locales» (`_p5plantasBatM`: en la batería 1, con locales declarados, las filas del catastro de uso no residencial no añaden su planta). Sánchez Pizjuán 6: «para las plantas 1ª, 2ª, 3ª, locales y toma de comunidad», como el Excel. Revisadas las 66 obras de Plan 5: cambia solo en Sánchez Pizjuán 6, Av de la Calesera 31 (cerrada con Rev-23.1) y Doctor Jaime Marcos 3 (cerrada con Rev-26); importes sin cambios.
- **v132 (22/10/2026, criterio de Guille)**: la casilla «% Bº tradicional s/venta» de Toma de Datos admite 8 caracteres (antes 5) y enseña hasta 5 decimales (antes 1). Motivo: pasar presupuestos del Excel antiguo al Plan 5 con los mismos importes impresos. Caso Sánchez Pizjuán 6: el Excel cobraba el «Estudio, medidas y seguridad» (150 + 3 × viviendas) fuera del coste y el Plan 5 lo mete en el coste (Seguridad y Salud + Nota simple), lo que mueve el margen de la mano de obra; se cuadra con Nota simple a 0, Seguridad y Salud a 198,46 € (capítulo 5 = 258,00 €) y % Bº tradicional 24,98238. Probado en el banco escribiendo el valor en la pantalla: las 50 líneas con importe iguales al PDF antiguo (33.094,87 €; 36.404,36 € con IVA). No cambia lo impreso por sí mismo (sin revisión nueva).
- **v131 (22/10/2026)**: en Plantillas mail, la ayuda de la tarjeta 08-FIN CYCP dice ya «✓ Tramitados» (decía «✓ Cerrar fase 08-CYCP», que no es el nombre del botón). Y al importar el Catastro en Toma de Datos, solo va a las filas de viviendas el inmueble cuyo uso **empieza** por «Residencial» (`_catEsViv`); antes valía cualquier uso que lo contuviera y «Almacen-Estacionamiento.Uso Residencial» (planta 0 puerta 6 de Sánchez Pizjuán 6, un almacén) entraba como vivienda en baja. Es la misma regla que ya usaban el alta automática de pisos (§4.1) y la comprobación de la columna BAT. Solo afecta a importaciones nuevas; no cambia lo impreso (sin revisión nueva).
- **v130 (22/10/2026, criterio de Guille)**: además, (a) la marca `{{si_financiacion}}` de 08-FIN CYCP (§3.7): la línea de la financiación solo sale si algún vecino tiene 6, 12, 18 o IPREM (probado en el banco: Tarfia 53 sin ella, Abogado Rafael Medina 1 con ella); (b) en las ventanas de correo de la ficha, la nota «el cron mandará hasta N reenvíos» solo sale en 01-Contacto y 03-Envío presupuesto, las únicas con reenvíos automáticos (en las demás salía sin sentido; ahora sale solo «Envíos previos: N»). Y el escritor de correos de la ficha dice en el título qué se está haciendo: «Responder mail» (↩, también al llegar desde Responder de HOY), «Reenviar mail» (↪) o «Enviar mail manual» (botón de Comunicaciones y correos a vecinos); y el desplegable «Insertar respuesta tipo» pasa a 28 px de alto (con la altura común de 18 px salía recortado). Solo `presupuestos.cjs`. Probado en el banco con Pz de los Luceros 4: los tres títulos, el desplegable entero y la respuesta tipo insertada arriba del cuerpo.
- **v129 (22/10/2026, criterio de Guille) — Rev-26 del presupuesto impreso**: hoja de fotos con 9 fotos (la 10 fuera del código) y el croquis el doble de ancho en el sitio de las antiguas 7 y 8; las fotos 7, 8 y 9 a su derecha (§5.3.3.6, §5.16). Revisión del presupuesto: desde ahora un solo número que sube con cualquier cambio de lo impreso (§5.17). Probado en el banco con Virgen de Loreto 9 y Ardilla 9 (pantalla e impresión, fotos de prueba numeradas): las 10 casillas de 133 × 236 px y el croquis de 272 × 236, alineado con las demás. En Chromium la fila de etiquetas de abajo pasa a la hoja siguiente, igual que antes del cambio (en Firefox cabe, como en la captura de Guille).
- **v128 (22/10/2026, criterio de Guille: "tendrá que salir 2 x 65 = 130"; caso Doctor Jaime Marcos 3)**: en el PDF del presupuesto, la línea **1.5.1 Cerradura** sale con su **cantidad y su precio unitario de venta** (coste de la tarifa + % Bº materiales): 2 cerraduras a 50 € de coste → «65,00 € — 2 ud — 130,00 €». Antes, como es una partida de albañilería (ALB), salía «130,00 € — 1 ud» (el total como precio). El importe no cambia; las demás partidas de albañilería (2.x) siguen como estaban (`celdasLinea` en `_p5tablaPresupuesto`, presupuestos_plan5.cjs). Ojo: un presupuesto ya cerrado con 2 cerraduras, si se vuelve a imprimir, sale con el formato nuevo (mismo total).
- **v128 (22/10/2026, criterio de Guille: "si alguien pregunta algo, que el bot pida ayuda y se pare... la gente quiere respuestas antes de seguir"; repaso de todas las conversaciones)**: el repaso vio que muchos textos de los vecinos **no llegaban a Pide ayuda**: el bot repetía su mensaje y nadie se enteraba (durante un documento de varias páginas, en la forma de pago, al volver a escribir tras unos días callado, al decir "ya lo mandé" y con la ficha cerrada; p. ej. Malvaloca 1 0C "Quiero hablar con una persona", Tharsis 5 3IZ "Por favor revisen la documentación"). Ahora, con la IA dormida, **todo texto con contenido llega a Pide ayuda** y el bot lo clasifica (`handleTextoLibreVecino`, va justo después del cierre de páginas; pasos recogida_documentacion, recogida_financiacion, pregunta_financiacion y finalizado):
  - **Pregunta o queja** (lleva "?" o palabras como qué, cómo, cuándo, cuánto, necesito, no entiendo, ya lo mandé, otra vez, hablar con una persona, llamar, revisen, no tengo…; sin tilde, "que/como/cuando…" solo al principio): contesta **«Gracias por su mensaje. Lo vemos y le contestamos lo antes posible.»** (plantilla `flujo_pregunta_espera`) y **el bot se para**: no le repite nada ni le manda recordatorios automáticos. Marca en `bot_expedientes` **col AD = "PREGUNTA fecha"**. Si escribe más cosas en los 30 minutos siguientes, te llegan pero el bot no contesta otra vez.
  - **Aviso** ("mañana lo mando", "estamos en ello"): contesta **«De acuerdo, gracias por avisarnos. Cuando lo tenga, envíenoslo por aquí.»** (`flujo_aviso_vecino`) y **no se para**.
  - **Corto** ("ok", "1", "gracias", saludos): como antes; mientras el bot espera, silencio. ("muchas gracias", "ok gracias": silencio siempre.)
  - Lo que **sí es la respuesta del paso** sigue su camino y quita la espera: la forma de pago (1 a 4, "contado", "6 meses"; sin "?"), saltar un opcional, el "1" de las páginas.
  - **El bot sigue** cuando contestas (Contestar por el bot, o marcas el Pide ayuda como revisado si contestaste por el WhatsApp blanco: col AE = 1) o cuando el vecino manda un archivo.
  - Con la IA despierta (`ia_activa` = SI) no se usa: manda la IA, como antes. La tarjeta `flujo_sin_ia` queda sustituida por las dos nuevas.
  - **"1" sin ninguna página** (caso Malvaloca 1 1D): en vez de repetir "Envía libro de familia…" en bucle, dice «Todavía no nos ha llegado ninguna página de: *Libro de familia*. Envíela primero… Si no lo tiene, escríbanoslo y lo vemos.» (`flujo_largo_sin_paginas`).
  - **Saltar el padrón** también con "empadronamiento no", "no estoy empadronado", "no vivo allí", "apartamento vacacional", "no tengo el padrón" (casos Ardilla 9 1-17 y 0-7; `esIntencionSaltarOpcional`).
  - Las tres plantillas nuevas se crean solas al arrancar (una vez) y se cambian en Flujo bot → Avisos de flujo.
  - Probado en el banco con conversaciones reales (1D, 0C, 3IZ…): la pregunta va a Pide ayuda y el bot calla; "2" en la forma de pago sigue y quita la espera; al contestar Guille (AE = 1) vuelve a guiar; un archivo quita la espera; el repaso automático no le manda el recordatorio a quien espera (3IZ: 0 con espera, 1 sin ella). Clasificados los 161 textos de octubre: 45 preguntas, 37 avisos, 79 cortos.
  - **Se revisa el 29/10/2026** con los datos reales: cuántas preguntas y avisos, aciertos, cuánto tarda en seguir y si alguien se quedó parado.
- **v128 (21/10/2026, criterio de Guille: "tiene que salir en verde y quedarse después en verde desde ya... mientras esté programado sin salir muestra arriba ⏰ Programado para... y cuando haya salido se borra y sabemos que se ha enviado")**: en la conversación con el bot (robotito de HOY y de la ficha), lo programado sale como **una sola burbuja**. Mientras espera: la burbuja con el texto completo (**verde** si es una respuesta tuya; los avisos M, pedir contacto, etc. siguen en azul) y arriba «⏰ Programado para jue 22/10 a las 9:00». Cuando sale: esa burbuja desaparece y queda la del envío, verde, con la cabecera normal «Tú (desde el programa) · fecha»; así se sabe que se envió. Si se anula (`bot_programados` col F = `anulado`) desaparece. Si falla: la misma burbuja con «⚠️ No se pudo enviar: motivo» (ya no sale además el aviso suelto del error). Se cruza la fila de `bot_contactos` con la de `bot_programados` (mismo teléfono, apuntadas a la vez); vale también para lo programado antes de este cambio (ruta `/presupuestos/hoy/conversacion`). Probado en el banco con el mensaje programado a Malvaloca 1 3B en los cuatro estados (pendiente, enviado, error, anulado).
- **v128 (21/10/2026, criterio de Guille: "lo marqué como F para que se lo volviese a pedir, pero no eternamente"; caso Malvaloca 1 3B)**: el bot decide qué ha recibido con **lo más reciente** (fecha de `bot_documentos`), como la pastilla de la ficha: si Guille puso un documento en **F** y después el vecino lo manda, vale lo nuevo (REVISAR) y el bot no se lo vuelve a pedir; lo que Guille da por bueno a mano (**OK**, o **vacío**, que para el bot es "no se le pide") no lo cambia nada que llegue después (`reconstruirDocsRecibidosDesdeSheets`; antes la marca manual ganaba siempre y el bot pedía en bucle lo que el vecino acababa de mandar). Además, cuando el vecino **escribe** mientras se le piden documentos, el bot **recalcula antes de contestar** qué le falta (marcas de la ficha y lo ya recibido): no le pide algo que ya entregó o que Guille marcó, y si ya lo tiene todo pasa a la forma de pago (`handleTextoRecogidaDocumentacion`; un documento de varias páginas a medias no se toca). Probado con el 3B (pasa de pedir otra vez la autorización a los papeles de la financiación, porque eligió 6 meses) y el 1D (sigue pidiendo la solicitud, en F sin nada nuevo).
- **v128 (21/10/2026, criterio de Guille: "cuando el piso sea en usufructo, deberíamos comunicarnos con el usufructuario... con los inquilinos quiero tratar directamente con el dueño")**: el nombre con el que se saluda al vecino (v127) cambia para los pisos de **tipo familiar**: se usa el **nombre de arriba** (pisos col E), no el titular de la Nota simple. Inquilinos y demás tipos siguen con el primero de la Nota simple; sin Nota simple, el de arriba (en todos). El tipo sale de la ficha (pisos col AW) y, si está vacío, de la ficha del bot (bot_expedientes col E). Vale para todos los mensajes: bot (presentación, recordatorios, reapertura…), avisos M, WhatsApp blanco, correos y Pedir contacto (`_p5NombreDirigido(nota, nombre, tipo)` en presupuestos; `nombreParaPiso` / `nombreDirigido` en el bot). Probado: Malvaloca 1 1D (familiar) → «Aliseda Muñoz Velázquez» en el recordatorio y en Pedir contacto; 4C (inquilino) → el dueño de la Nota simple.
- **v128 (21/10/2026, criterio de Guille: "unificar el verde y rojo corporativo... me gustan más los del robotito; el azul del botón, como el azul corporativo del fondo")**: en la paleta (`estilo-visual.cjs`) el **verde** `--ptl-success` pasa de #10B981 a **#1f9d55** y el **rojo** `--ptl-danger` de #EF4444 a **#c0392b** (cambian a la vez los botones W/M, pastillas, ✕ de borrar, filtros, avisos…; los tonos light/dark no cambian). Los robotitos dejan de llevar colores puestos a mano: verde/rojo/gris = `--ptl-success` / `--ptl-danger` / `--ptl-gray-400`, y el **circulito azul** («te toca a ti») = **`--ptl-general-1`** (#004079, el azul del fondo). Probado en el banco: ficha y HOY sin errores de script; W/M y robotitos con los mismos colores.
- **v128 (21/10/2026, criterio de Guille: "nos vendría genial un mensaje WhatsApp para cuando queremos ponernos en contacto con un vecino")**: botón **📨 Pedir contacto** en el robotito rojo o gris, plantilla Twilio nueva **plan5_contacto** (la crea Alberto; el HX se pega en Flujo bot) y la respuesta del vecino va a Guille sin que el bot la conteste (§3.16.3.1). Probado en el banco: envío con las dos variables (Malvaloca 1 1D: «Mª Teresa Velázquez Gutiérrez», «C Malvaloca 1 (1D)»), un «Sí» en plena forma de pago no se toma como financiar y llega a Pide ayuda; el mensaje siguiente vuelve al bot; botón en el robotito rojo de la ficha y tarjeta en Flujo bot.
- **v128 (21/10/2026, criterio de Guille: "que ambos funcionen igual... uno imprime en pdf y otro envía por bot")**: **menú de Imprimir documentos común** a la ficha (descarga) y al robotito (botón **📄 documento**, adjunta el PDF relleno; sustituye a «autorizacion usufructo»); **un documento cada vez**, con **👁 Ver** antes de imprimir o enviar, y el archivo **con el nombre del documento** («Autorización de usufructo - Tharsis 5 3IZ.pdf»; general, sin piso) (§3.23.2). El adjunto que manda el bot conserva su nombre con espacios y acentos (`/media-tmp`). Probado en el banco y en el navegador (Tharsis 5 3IZ): menú, piso ya elegido, datos, vista previa y adjunto «Autorización de usufructo - Tharsis 5 3IZ.pdf»; páginas sin errores de script.
- **v128 (21/10/2026, criterio de Guille: "lo que habría que quitar es la opción FFCC de la pregunta, porque un vecino no elige FFCC de por sí, sino la comunidad")**: la pregunta de la forma de pago **sin FFCC** (1 a 4), **con lo que le toca pagar** (marcas `{pago_1}`…`{pago_18}` con los importes del presupuesto Plan 5 cerrado: de una vez «1.168 €», plazos «unos … €/mes», sin céntimos) y **sin preguntar cuando ya se sabe** (FFCC/IPREM puestos por Guille → cierra; 6/12/18 → papeles de financiación; ficha reabierta con Contado → cierra sin volver a preguntar) (§6, forma de pago). Contado sigue siendo la casilla vacía, como siempre (se probó a guardarlo como `CONTADO` y Guille lo descartó: "estaba funcionando bien así"). Caso que lo motivó: Malvaloca 1 4C, que contestó 5 (FFCC) sin serlo. **Guille pega el texto nuevo de la plantilla en Flujo bot después de subir esta versión** (antes, el vecino vería las marcas tal cual). Probado en el banco: vacía la primera vez pregunta con los importes de Malvaloca 1 (1.168 €; unos 199/101/69 €/mes); reabierta con Contado y con FFCC cierra; con 6 pide los papeles de financiación; «5» repite la pregunta; «1» deja la casilla vacía y cierra; páginas sin errores de script.
- **v127 (20/10/2026, criterio de Guille: "el bot debería estar calladito a horas intempestivas... L-V 9:00 a 20:00")**: **horario de comunicaciones del bot**, editable en Flujo bot (§3.22.3.4 bis). Fuera de él el bot no manda nada por su cuenta (§6.5); lo que mandas tú por el bot pregunta «Enviar ahora» o «⏰ Programar para <apertura>» (pestaña nueva `bot_programados`, revisada cada 5 minutos; el texto libre solo si sus 24 h siguen abiertas, nunca con un archivo del PC); el WhatsApp blanco pregunta «Abrir igualmente» / «Cancelar». Las respuestas del bot a un vecino que escribe y los correos no cambian. **Archivo nuevo `horario-bot.cjs`** (hay que subirlo con los demás; el .bat pasa a v5 para subirlo, §7.1). Corregido esa misma noche: fuera del horario el repaso callado no se apuntaba como terminado y HOY avisaba de que el repaso automático no funcionaba (§6.5). Probado en el banco: páginas sin errores de script, guardado del horario, programar y enviar después (aviso M), rechazo del texto libre con las 24 h cerradas y del archivo del PC; en el navegador con la hora puesta en domingo noche: ventana con los tres botones, sin «Programar» cuando las 24 h se cierran antes, y aviso del WhatsApp blanco.
- **v127 (19/10/2026, criterio de Guille: "y si en la respuesta en bot le quiero adjuntar un archivo?")**: **adjuntos al contestar por el bot** (🤖💬 verde, en HOY o en la ficha): 📎 Adjuntar (PDF, JPG o PNG del PC, hasta 10 MB) y atajos toma datos / autorizacion usufructo; solo dentro de las 24 h; en la conversación queda "📎 nombre" (§3.16.3.1; `responderVecino(tel, texto, archivo)` del bot, ruta `/media-tmp/<id>/<nombre>`). Además los recordatorios M por correo **citan el correo anterior** como Gmail y la flechita ↩ (§4.2.3.3). Además, **regla única del circulito azul** (te toca a ti) en todos los botones de vecino de HOY y de la ficha: robotito, 📧 y 💬 blanco (§3.16.3.1). El Pide ayuda de HOY se fecha y ordena por el último mensaje del vecino al bot (§3.16.3.1). El bot ya no cierra una ficha con un documento obligatorio en F o INCORRECTO: se lo pide antes (§4.7 `bot/marcar`, texto `flujo_falta_antes_de_cerrar`; caso Ardilla 9 0-7). **Los dos PDF del bot se llaman toma datos y autorizacion usufructo en todos lados** (criterio de Guille, 19/10/2026): así le llegan al vecino (el nombre va en la dirección `/media/<tipo>/<nombre>.pdf`, que es lo que enseña WhatsApp), en el texto que los acompaña en el flujo, en los botones del robotito y en la conversación (`NOMBRE_MEDIA`, `urlMedia` del bot). La autorización apuntaba a un PDF de Drive que daba error (`12y2WBse…`); ahora es IMPRESO autorizacion usufructo.pdf (`1ZNbZpag…`, público con enlace), así que vuelve a llegar a los familiares. **Nombre con el que se saluda al vecino (v127, criterio de Guille 20/10/2026: "en todas las comunicaciones vamos a poner el nombre de la Nota simple")**: en todos los mensajes al vecino (bot: presentación, pregunta de tipo, recordatorios, reapertura, cambio de tipo, aviso de inactividad; avisos M; WhatsApp manual de HOY y de la ficha; correos de inicio y recordatorio) va el **primer nombre de la Nota simple** (pisos col D; si hay varios separados por «/», el primero), que es el propietario, también en inquilinos (en familiares, desde v128, el nombre de arriba). Se quitan «(T)» delante y «(…)» detrás; si la Nota simple está vacía o es una anotación ("Mismo propietario…", "Piso sin registrar…"), el **nombre de arriba** (col E). La ficha y HOY siguen enseñando el nombre de arriba. Funciones: `_p5NombreDirigido` (presupuestos, también para la ficha) y `nombreDeNota` / `nombreDirigido` (bot, con la lista de pisos en memoria 5 min). Para dirigirse a otro de los propietarios, se pone el primero en la Nota simple. Los textos ya enviados (espejo) no cambian. Y en los avisos M, un móvil marcado **sin WhatsApp** cuenta como sin móvil: va por correo (📧) si tiene, y si no, «llamar» (§3.16.3.1; caso Ardilla 9 2-24). Probado en el banco (envío con archivo del PC, con fijo, tipo no válido, solo texto, descarga del archivo por Twilio; navegador: ventana con la pastilla del adjunto y envío en JSON).
- **v126 (18/10/2026, criterio de Guille)**: (1) **avisos M1/M2/M3 de HOY por el bot** con las 4 plantillas Twilio de Alberto (`plan5_recordatorio_m1`, `plan5_recordatorio_prorroga`, `plan5_aviso_vencido_doc`, `plan5_aviso_vencido_cycp`; 5 variables): siguen saliendo solo al pulsar, con el robotito verde 🤖💬 en vez del 💬 blanco; sus códigos HX se pegan en sus 4 tarjetas de Flujo bot, columna A pisos (§3.22.3.2), como el resto de plantillas Twilio (sin código, "Falta la plantilla"). **Con móvil, por el bot** (también un vecino en M con email); sin móvil, por correo (criterio de Guille). Sin interruptor ni modo prueba (criterio de Guille: "tiene que funcionar; veré si se han enviado en el chat de cada vecino"); (2) **"Ha respondido"** en Avisos: lo que escribe al número del bot un vecino con el que el bot no trabaja (en M o fuera de la 05) ya no se pierde: el bot lo guarda sin contestar (`bot_contactos` tipo `texto_fuera` / `archivo_fuera`) y sale en HOY con su texto, el 🤖💬 y check de visto (pisos col AZ `R=`) (§3.16.3.1, §6.1); (3) **robotito 🤖💬 en la caja Datos documentación** de la ficha, detrás del 💬 blanco: conversación de cada vecino siempre a mano (verde / rojo / gris) (§4.2.3.3); el código del recuadro pasa a ser compartido por HOY y la ficha (`_clienteVecinoBot`); (4) en esa caja, **Nombre más estrecho (180 px) y Notas más anchas**; (5) **conversación completa desde la presentación**: la primera presentación (al pasar a W, al cambiar el teléfono o por la tanda) ahora se apunta en `bot_contactos` (`presentacion`); para las anteriores, la conversación la saca de la ficha del bot (col J) y la pone en su fecha (antes solo salían los reenvíos); (6) **robotito: color + circulito** (criterio de Guille: "como el mensaje nuevo de WhatsApp"): el color dice si se le puede hablar por el bot (verde < 24 h, rojo > 24 h, gris nunca ha escrito, solo ficha) y un circulito azul en la esquina, que le espera una respuesta (Pide ayuda o Ha respondido sin marcar). Contestar por el robotito, desde HOY o desde la ficha, lo da por contestado (`_marcarContestado`: col AE = 1 y AZ `R=` ahora) (§3.16.3.1); (7) **cambiar el tipo del vecino desde la ficha cambia también el del bot** y le pide lo que le falta del tipo nuevo, con opción de avisarle por el bot (§4.7, `piso/tipo`); caso que lo motivó: Malvaloca 1 3B, inquilina sin contrato que es familiar; (8) **avisos M también desde la ficha** (robotito verde con punto mientras esté pendiente) y **la ventana enseña el mensaje** que va a salir, editable dentro de las 24 h (§3.16.3.1); (9) **conversación espejo** (criterio de Guille: "un espejo de lo que el vecino ha visto"): los envíos con plantilla salen con su **título** y, al pincharlo, el **texto exacto** que le llegó; los mensajes normales salen **enteros**. El bot guarda desde ahora el texto exacto de cada plantilla al enviarla (título + línea en blanco + texto, `bot_contactos` col E); para lo anterior, foto única de las plantillas presentacion y recordatorio (`espejo_presentacion` / `espejo_recordatorio`, `_migEspejoV126`) con los datos del vecino; en los recordatorios automáticos antiguos la lista de ese día no se guardaba: el 19/10/2026 se reconstruyó **una vez** (lo que pedía su tipo de vecino menos lo recibido hasta ese momento según `bot_documentos`) y se guardó en `bot_contactos` col E (`_migListasRecordatorioV126` del bot, marca `mig_listas_v126`; si después se le cambió el tipo al vecino, la lista sale con el tipo actual); (10) **ventana única Cancelar / Enviar** para todo envío por el bot (presentación al pasar a W o al cambiar el teléfono, contrato de la 08, avisos M): `window.ptlConfirmarEnvio` en todas las páginas (`pageHtml`), en vez del Aceptar/Cancelar del navegador (§3.15). Probado en el banco (bot: mensaje de piso en M guardado sin contestar, plantilla con sus 5 variables, respuesta a un teléfono de 9 cifras; CRM: 23 robotitos de aviso M, envío al vecino, plantilla dura con disidentes pedidos, "Ha respondido" y su check, conversación; navegador: ficha de Malvaloca 1 y HOY).
- **v125 (18/10/2026, criterio de Guille: "si me contestan fuera de contexto estoy perdido")**: la **conversación con el vecino** (todos los mensajes por el bot, con scroll) en el recuadro del 🤖💬, también en rojo (solo lectura) y al pulsar el texto del aviso (§3.16.3.1). Probado en el navegador del banco con Ardilla 9 1-19 (rojo) y Malvaloca 1 3B (verde).
- **v124 (18/10/2026)**: la v123 ensanchaba la pantalla HOY (los avisos largos en un renglón empujaban el borde derecho hasta ~1840 px). Ahora la columna de avisos no cuenta para el ancho (`contain:inline-size`): la pantalla queda con sus límites de siempre y los avisos, todos del mismo ancho dentro de ellos.
- **v123 (17/10/2026, criterio de Guille)**: caja Avisos de HOY ordenada: cada aviso en la mitad derecha de la línea, alineados, en un renglón y entero al pasar el ratón; los botones en una columna fija al final (§3.16.3.1).
- **v122 (17/10/2026, criterio de Guille)**: botón **🤖💬 contestar por el bot** en las tarjetas Pide ayuda y Completo · revisar de HOY: verde si el vecino escribió al bot hace menos de 24 h (la respuesta sale del número del bot y la tarjeta de ayuda se marca sola), rojo si no (usar el 💬 blanco). Motivo: el WhatsApp de la empresa se capa por "propaganda" si se contesta a muchos. §3.16.3.1; `responderVecino` del bot; ruta `POST /presupuestos/hoy/responder-bot`. Probado en el navegador del banco (envío, cierre del recuadro, check de la ayuda y aviso del rojo).
- **v121 (17/10/2026, criterio de Guille: "que me entere de lo que dicen")**: la tarjeta **Pide ayuda** de HOY enseña el texto del vecino **entre paréntesis**, hasta 180 caracteres, con los enlaces cambiados por 📎 y en varias líneas si hace falta; al pasar el ratón, el texto entero (`_txtAyuda`). El bot ya no borra la petición anterior sin revisar: añade el mensaje nuevo detrás (" · "), hasta 1000 caracteres (`marcarAtencionHumana`). Las dudas recuperadas por la v19.120, que se guardaron cortadas por el centro (200 caracteres) y perdían justo la pregunta (Ardilla 9 1-19), se completan una sola vez al arrancar (`_migAyudaV121`, marca `mig_ayuda_v121`; 8 vecinos con los datos del 17/10).
- **v19.120 (17/10/2026, criterio de Guille: "solo leo Avisos")**: **dudas perdidas recuperadas en "Pide ayuda"**. Desde el 25/08 (IA caída) los textos de los vecinos no llegaban a "Pide ayuda" de HOY. Una sola vez al arrancar (`_migAyudaV19120`, marca `mig_ayuda_v19120`): a cada vecino con bot en fase 05, con su teléfono actual en `pisos` (en W) y sin "Pide ayuda" pendiente, se le ponen en la col AC sus textos desde el 25/08 (sin saludos, números ni "ok"; varios unidos con " · ", máx. 200 caracteres). Con los datos del 17/10 salen 17 vecinos (algunos con textos sin importancia, que se quitan con el check). Desde v19.118 los textos nuevos ya llegan solos.
- **v19.119 (17/10/2026)**: dos fallos de la v19.118 vistos con el caso real (Ardilla 9 1-13, contrato mandado a las 12:52 sin contestar): (1) las páginas de un documento de varias páginas solo contaban si eran de las **últimas 4 horas** (`RECENT_FILE_WINDOW_MS`), así que el cierre automático no lo cerraba por la tarde; ahora cuentan 7 días (`VENTANA_PAGINAS_MS`, solo documentos largos: `existeArchivoParaDocumento` y `obtenerMejorEstadoArchivoReciente`); (2) el job de cada hora no cargaba las plantillas del Sheet si desde el arranque no había entrado ningún mensaje (textos vacíos, sin recordatorios); ahora `ejecutarJobSeguimiento`, `autoCerrarDocumentoLargo` y `reabrirSiFinalizado` llaman a `cargarPlantillas()`. Probado en el banco con el Sheet del 17/10 20:34: el job cierra el contrato del 1-13 y le pide el empadronamiento (documento 7 de 7).
- **v19.118 (17/10/2026, criterio de Guille)**: para que ningún vecino se quede a medias sin que Guille se entere: (1) **IA del bot dormida** con interruptor en Plantillas del bot (§3.22.3.4); (2) **documentos de varias páginas sin "LISTO"**: tras cada página el bot dice "responde 1 si ya están todas" (`flujo_pagina_recibida`) y vale 1/sí/ya/ok/listo; si no contesta, a los **15 minutos** de la última página lo da por terminado y sigue (temporizador + repaso en el job de cada hora, `autoCerrarDocumentoLargo`); (3) **contador "📍 Documento X de N"** encima de cada petición (`flujo_progreso`); (4) **ficha reabierta**: al marcar Guille algo en F/INCORRECTO de un vecino terminado, el bot le manda en el acto la plantilla Twilio "recordatorio" con lo que le falta y la ficha queda marcada (col AB `REABIERTA`) para que siga saliendo "Completo · revisar" en HOY mientras tenga algo en REVISAR (§6.16). Puesta en marcha única en `bot_plantillas` al arrancar (`_migBotV19118`, marca `mig_bot_v19118`): `ia_activa` = NO, los tres textos nuevos y "escribe LISTO" → "responde 1" en `flujo_seguimos_largo` y los `pide_` de documentos largos. Probado en el banco con conversaciones completas (propietario e inquilino, con IA dormida y encendida). Caso que lo motivó: Ardilla 9 1-13 (contrato de alquiler en fotos sin "LISTO").
- **v19.117 (17/10/2026, criterio de Guille)**: un vecino que entra tarde en una comunidad (piso vendido, teléfono nuevo) cuenta sus plazos del bot desde el **día común** de la comunidad, como si se le hubiera escrito el primer día (§6.5, `_anclaPlazoBot`). Caso: Ardilla 9 2-26, Enrique Pujalte sustituido por Fernando Romero Gavilán (ficha del administrador del 16/10).
- **v19.116 (17/10/2026, criterio de Guille)**: los **recordatorios por correo al vecino** salen como **respuesta en el hilo** de su correo inicial (asunto "Re: …", contestando al último correo de la conversación, que es su respuesta si ha contestado). Detalle en §4.2.3.3 (📧 Correo al vecino). Sin correo inicial, correo nuevo.
- **v19.115 (14/10/2026)**: las marcas que Guille añadía desde la ficha (fila nueva en `bot_documentos`) se guardaban **sin teléfono** y el bot no las veía: por eso marcar INCORRECTO el DNI del 0-2 de Ardilla 9 no reabrió su ficha. Ahora la fila nueva lleva el teléfono del piso, y el bot reconoce también las antiguas sin teléfono por comunidad + vivienda.
- **v19.114 (14/10/2026, criterio de Guille)**: "Completo · revisar" (05) sale **solo mientras el piso tenga algún documento en REVISAR**. Revisado todo: si está todo OK, terminado; si algo queda en F o INCORRECTO, vuelve a la cadena normal (M1/M2). Además, al marcar en la ficha un documento en INCORRECTO o F de un vecino que el bot había dado por terminado, el bot **reabre su ficha** (`reabrirSiFinalizado`: paso `recogida_documentacion` con ese documento, recordatorios desde hoy) y se lo vuelve a pedir hasta que lo entregue y se marque OK. El bot cuenta ya las marcas `manual` de la ficha como manuales. Caso: Ardilla 9 0-3.
- **v19.113 (14/10/2026, criterio de Guille)**: **Respuestas tipo** para correos manuales. Se guardan en una fila especial `_RESPUESTAS_TIPO` de `mail_plantillas` (col D, JSON `[{nombre, texto}]`) y se editan en Plantillas mail, tarjeta "💬 Respuestas tipo" (siempre hay un hueco vacío para añadir una; para borrar, se deja el nombre vacío; ruta `POST /presupuestos/plantillas/guardar-respuestas-tipo`). En la ficha, el compositor (Enviar mail manual, Responder, Reenviar) lleva el desplegable "Insertar respuesta tipo", que mete el texto arriba del cuerpo (la firma y la cita quedan debajo). Guardada (22/10/2026): "Derivar a José Manuel" ("…póngase en contacto con nuestro compañero José Manuel en el 640-527-426"); el "Derivar a comercial" que se propuso el 14/10 no llegó a guardarse. Además: Génova 10 recuperada a 04 a mano (14/10/2026; su "próximo seguimiento" quedó en el 10/05/2025 y conviene fijarlo a mano).
- **v19.112 (13/10/2026, criterio de Guille: "mando yo")**: una pastilla que Guille deja en **OK** (o "no aplica") no la cambia nada que llegue después por el bot, en ningún documento: la marca de la ficha guarda `manual` en la col H de `bot_documentos` y esa fila manda sobre las del bot (y sobre las caras sueltas del DNI). Si la pastilla está en F, REV o repetir, lo que llegue nuevo sí la pone en REV. En la 08, el bot ya no vuelve a poner el contrato en REV si estaba en OK. Las marcas OK anteriores a v19.112 no llevan `manual`: valen como antes (gana lo más reciente) hasta que se vuelvan a tocar.
- **v19.111 (13/10/2026, criterio de Guille)**: "Completo · revisar" de la fase 05 funciona como el de la 08: sale mientras el piso del vecino finalizado no tenga toda su documentación en OK (el contador verde de la ficha) y se quita sola al dejarlo todo en OK; si se vuelve a poner algo en F o REV, vuelve a salir. Ya no lleva check (la col AB de `bot_expedientes` deja de usarse). Caso: Malvaloca 1 7A.
- **v19.110 (13/10/2026, criterio de Guille)**: M1 también en la fase 08, a mitad del plazo de los contratos: aviso en HOY a cada vecino con contrato o carta pendientes, una vez, por su camino (bot/WhatsApp manual: texto `msg_wa_m1c`; correo: plantilla `08_REC_M1_VECINO` "08-RECORDATORIO M1 (VECINO)", dentro de la tarjeta 08-INICIO CYCP (VECINO)). Día en FLUJO BOT, tarjeta "Aviso M1 (día 5 · fase 08)" (`t_wa_m1c`, 5 por defecto). Marca: `pisos` col AZ, clave `C1`. Sale solo mientras la comunidad está en plazo (después, M3). Solo en comunidades cuyo envío de contratos es del 13/10/2026 o posterior (`AVISOS_LEGADO_M1C`): Diego Puerta 1 y Tarfia 53 van por el canal manual y no lo ven (criterio de Guille). El M1 de la 05 pasa al día 10 (Guille lo cambia en FLUJO BOT: el último reenvío del bot es el día 5).
- **v19.109 (13/10/2026, criterio de Guille)**: el badge de contrato resuelto lleva la fecha tope de pago de la compensación (envío de la resolución + 15 días, la misma que `{{FECHA+15}}` del correo): "📛 Contrato resuelto · pago dd/mm" en rojo claro; desde el día siguiente, "📛 Pago vencido dd/mm · reclamar" en rojo fuerte (clase `ptl-ubtn-rojo`). El programa no sabe si han pagado: se quita al pasar el expediente a ZZ-DESCARTADO. Igual en 05 y 08, en HOY y en la ficha (`_badgeUltimatumHoy`).
- **Resoluciones (13/10/2026)**: párrafo de la compensación de 05/08-RESOLUCIÓN DE CONTRATO cambiado por Guille en el Sheet: "La cantidad por compensación, tal y como se especifica en dicha cláusula, asciende a {{compensacion}} IVA incluido y deberá ser abonada en un plazo máximo de quince días naturales a contar desde la fecha de la presente comunicación (hasta el {{FECHA+15}}), en la cuenta …, tras lo cual emitiremos la correspondiente factura." Otelo 8 resuelto el 13/10/2026 con el texto a medida (pago hasta el 28/10/2026; el 25/09 respaldado por WhatsApp).
- **v19.107-19.108 (12/10/2026)**: aviso "Completo · revisar" en fase 08, pisos nuevos en 08 con Contrato y Pago en F, mismo aviso de plazo en 05 y 08 al mandar por el bot, tarjeta del contrato debajo de Wake up y archivos de la 08 guardados tal cual (§6.17, §3.16.3.1, §4.2.3.3).
- **v19.106 (12/10/2026)**: prórroga a la mitad, sin recordatorio, un solo seguimiento en 08, fecha de la prórroga guardada, resumen de comunicaciones en la resolución y aviso de correos fuera del protocolo: §3.11.1. Detalle en §3.11.1 y calendario en §3.9.
  - **Expedientes al 12/10/2026**: Tarfia 53 (08) tenía la prórroga pendiente de decidir (contratos el 01/10, vencido el 11/10): con 5 días, hasta el 16/10. Otelo 8 y Diego Puerta 5 (05, prórroga ya enviada) conservan sus fechas. Ardilla 9, Ciudad de Gandía 5, Tharsis 5 y Diego Puerta 1 aún no han llegado a la prórroga. **Otelo 8 resuelto el 13/10/2026**; Diego Puerta 5 necesitará texto a medida cuando se resuelva (expediente antiguo, sin correo de inicio).
  - **Comprobación (banco, Excel del 11/10/2026)**: Otelo 8, Diego Puerta 5 y Tarfia 53 con las casillas viejas y nuevas (mismas fechas en las prórrogas ya enviadas; Tarfia 21/10 → 16/10 y guardada al enviar); simulación día a día en 05 (21, 26, 30, 31, 31 con disidentes, 37) y 08 (5, 11, 12, 16, 16 con disidentes, 22): botones, badges, línea de comunicaciones, M2/M3, resumen y aviso; ventana Tiempos; guardado de la casilla a 0; pantallas HOY, Plantillas, Listado y fichas sin errores de JavaScript; simulación anterior de la cadena de avisos sin cambios.
- **v19.100-19.105 (09-10/10/2026)**:
  - **Orden de HOY en 05 y 08 (v19.101)**: por el paso de la línea de tiempo, el más avanzado arriba (§3.16, tabla de grupos).
  - **Correos a vecinos (v19.100-19.102)**: inicio y recordatorios M1/M2/M3 por correo, agrupados en las tarjetas (VECINO) de Plantillas mail (§3.21.3.2); el 📧 de HOY abre la ficha con el correo escrito (`?mailaviso=FASE&piso=VIV`).
  - **Cadena de avisos unificada (v19.102)**: día común por comunidad, Inicio pendiente, M1/M2 (05) y M3 (08) a todo vecino con algo pendiente por su camino (bot, correo, WhatsApp manual o llamar), el segundo aviso esperando la decisión de prórroga / disidentes (amable / duro), marcas en AA/AF, AY y la nueva **AZ `aviso_manual`** (§6.16, bloque CADENA DE AVISOS UNIFICADA; §3.16.3.1).
  - **WhatsApp manuales que quedan registrados (v19.102)**: menú del 💬 en 05 (Inicio documentación / M5) y M4 en 07/08 apuntan la fecha en AZ al abrirse (§4.2.3.3).
  - **Globo del W/M (v19.102)**: todas las comunicaciones registradas del vecino y "Sin registro: WhatsApp manuales ni llamadas"; en la comunidad, el resumen de vecinos por camino (§4.2.3.3).
  - **Sin textos de respaldo en el código (v19.103)**: regla 9 del capítulo 0.
  - **Decisiones que se dejan así**: comunidad sin ningún bot (§6.16); vecinos de comunidades antiguas (legado: inicio dado por hecho antes del 07/10 en 05 y del 10/10 en 08).
  - **Contrato resuelto (v19.105)**: con la resolución enviada, la cadena de avisos no saca nada de esa comunidad (§6.16). El expediente sigue en 05/08 con el badge "📛 Contrato resuelto" hasta que Guille lo pase a ZZ.
  - **Reactivar "último estado" (v19.104)**: con BK vacía deduce la fase por las fechas (§3.13, ruta reactivar). Caso Génova 10: había vuelto a 01 en vez de 04.

---

# ANEXO A. BATERIA DE PRUEBAS DE PLAN 5 (CODIGO Y RESULTADOS DE REFERENCIA)
> Todo lo necesario para volver a montar la batería de §5.19 en una sesión nueva, sin ficheros aparte: con este anexo, el Excel del Sheet y los `.cjs` del programa se reconstruye entera. El asistente copia estos bloques a su banco de pruebas y la pasa antes de entregar cualquier cambio de `presupuestos_plan5.cjs`.

## A.1 Resultados de referencia (Rev-24.1, 04/10/2026, 48 edificios; siguen valiendo con la Rev-25.1, que solo cambia textos)
**Repaso del 23/10/2026**: desde el 04/10 los cambios de `presupuestos_plan5.cjs` son de impresión (Memoria, tabla, fotos, cláusula 8), del croquis (partes del edificio del Catastro), de la importación del Catastro (`_catEsViv`, solo importaciones nuevas) y de la casilla % Bº tradicional; ninguno toca el cálculo de cantidades, costes ni márgenes, así que la tabla sigue valiendo. **No se ha vuelto a pasar la batería** para confirmarlo con números. En la pestaña hay ya 49 edificios con peines (no 48): falta añadir los nuevos la próxima vez que se pase.
Zonas: B = planta baja, R = resto de plantas, A = ático, con el nº de viviendas de cada fila tal como las cuenta la pantalla de Toma de Datos (B1 = primera fila de baja, etc.). Total = PTO Plan 5 con IVA; coste y tiempo de ejecución según el banco de pruebas, con el Excel del Sheet del 03/10/2026.

**Cómo se calculan**: cada edificio **sin su foto congelada**, es decir, como si se reabriera con "Editar a mano" (cálculo del motor de hoy con los valores propios de la obra encima). Por eso, en los presupuestos cerrados con una revisión anterior, el total de esta tabla puede no coincidir con el impreso: en esta tabla salen distintos 20 de los 35 cerrados, porque el motor ha cambiado desde que se cerraron (por ejemplo, la unificación de diámetros o el calderín, Rev-23.1). Los 15 restantes coinciden con su foto. C Marqués del Nervión 114-1 sale sin total porque su Toma de Datos está incompleta.

**Para qué sirve**: antes de entregar un cambio de `presupuestos_plan5.cjs`, se vuelven a calcular los 48 y se compara con la versión anterior; si algo se mueve sin que debiera, se ve aquí. **Actualizarla es sencillo**: se pasa la batería con la versión nueva y se cambia esta tabla (unos minutos).

| Edificio | Viviendas por zona | Total con IVA (€) | Coste (€) | Tiempo (días) |
|---|---|---|---|---|
| AV CIUDAD DE CHIVA 9 | B1=1 · B2=1 · R1=1 · R2=1 | 3.157,15 | 1.934,42 | 2,25 |
| AV CRUZ DEL CAMPO 9 | B1=1 · B2=1 · R1=4 · R2=3 | 3.124,88 | 1.912,42 | 2,25 |
| AV DE LA CALESERA 31 | R1=9 · R2=9 · R3=9 · R4=9 | 46.319,41 | 27.326,87 | 39,977 |
| AV DE LA CALESERA 8 | R1=4 · R2=4 | 18.251,01 | 11.571,14 | 19,012 |
| AV DE SÁNCHEZ PIZJUÁN 11 | B1=1 · B2=1 · B3=1 · B4=1 · R1=14 · R2=14 · R3=14 · R4=14 | 56.008,83 | 31.424,20 | 37,013 |
| Bª LA PALMILLA 11 | B1=1 · B2=1 · R1=4 · R2=4 · R3=4 · R4=4 | 28.535,90 | 17.492,66 | 28,75 |
| C AGUAMARINA 8 | B1=1 · B2=1 · R1=4 · R2=4 · R3=4 · R4=4 | 31.696,89 | 19.647,88 | 30,793 |
| C AGUILA BLANCA 6 | B1=1 · B2=1 · B3=1 · B4=1 · R1=3 · R2=3 · R3=3 · R4=3 | 28.289,88 | 17.543,10 | 29 |
| C ARDILLA 9 | B1=1 · B2=1 · B3=1 · B4=1 · B5=1 · B6=1 · B7=1 · B8=1 · B9=1 · B10=1 · R1=2 · R2=2 · R3=2 · R4=2 · R5=2 · R6=2 · R7=2 · R8=2 · R9=2 · R10=2 | 36.526,12 | 21.549,63 | 29,475 |
| C ASUNCIÓN 34 | R1=5 · R2=5 · A1=1 | 17.616,97 | 10.484,30 | 13,975 |
| C BALLENA 6 | B1=1 · B2=1 · R1=4 · R2=4 | 3.124,88 | 1.912,42 | 2,25 |
| C BARTOLOMÉ DE MEDINA 21 | R1=2 · R2=2 · R3=2 · R4=2 · R5=2 · R6=2 · A1=1 | 34.939,42 | 22.404,15 | 41 |
| C BEATRIZ DE SUABIA 148 | R1=4 · R2=4 | 15.391,12 | 9.621,22 | 13,975 |
| C BEATRIZ DE SUABIA 85 | B1=1 · B2=1 · R1=4 · R2=4 · R3=4 · R4=4 | 24.610,83 | 14.380,11 | 18,9 |
| C CARDENAL ILUNDAIN 18, PORTAL 2 | B1=1 · B2=1 · R1=6 · R2=6 | 17.569,34 | 9.955,46 | 13,988 |
| C CIUDAD DE AYORA 4 | B1=1 · B2=1 · B3=1 · B4=1 · R1=5 · R2=5 · R3=5 · R4=5 | 9.681,06 | 3.982,54 | 2,25 |
| C CIUDAD DE GANDÍA 5 | B1=1 · B2=1 · B3=1 · B4=1 · R1=5 · R2=5 · R3=5 · R4=5 | 38.605,54 | 22.852,87 | 27,188 |
| C CRUZ DEL SUR 13 | B1=1 · B2=1 · B3=1 · B4=1 · B5=1 · B6=1 · R1=7 · R2=7 · R3=7 · R4=7 · R5=7 · R6=7 | 52.388,37 | 30.482,98 | 35,825 |
| C CUEVA DE LA PILETA 2, BLOQUE 10 | R1=6 · R2=6 · R3=6 | 11.051,50 | 5.571,48 | 2,75 |
| C DOCTOR MARAÑÓN 13 | B1=1 · B2=1 · B3=1 · B4=1 · R1=4 · R2=4 · R3=4 · R4=4 | 29.074,68 | 17.641,83 | 28,5 |
| C DON FADRIQUE 53 | R1=4 · R2=4 · R3=4 | 20.602,80 | 12.738,27 | 17,35 |
| C EVA CERVANTES 13 | B1=1 · B2=1 · R1=9 · R2=9 · R3=9 · R4=9 | 45.919,49 | 27.163,29 | 37,008 |
| C EVA CERVANTES 5 | B1=1 · B2=1 · B3=1 · R1=9 · R2=9 · R3=9 · R4=9 | 45.148,72 | 26.528,67 | 35,032 |
| C FELIPE II 20 | B1=1 · B2=1 · B3=1 · R1=9 · R2=9 | 3.538,92 | 2.085,63 | 2,25 |
| C FRANCISCO MENESES 4 | B1=1 · B2=1 · B3=1 · B4=1 · R1=2 · R2=2 · R3=2 · R4=2 · A1=1 | 6.363,00 | 2.920,23 | 2,25 |
| C FRANCISCO PALACIOS "EL PALI" 2 | B1=1 · R1=4 | 3.811,14 | 2.053,05 | 2,25 |
| C JOSÉ SARAMAGO 8 | B1=1 · B2=1 · B3=1 · B4=1 · R1=3 · R2=3 · R3=3 · R4=3 | 23.526,54 | 14.295,37 | 23,25 |
| C MALLÉN 8, ESCALERA 1 | R1=3 · R2=3 · R3=3 · R4=3 | 27.351,31 | 17.339,53 | 27,975 |
| C MALVALOCA 1 | B1=1 · B2=1 · B3=1 · B4=1 · R1=9 · R2=9 · R3=4 · R4=4 | 39.738,07 | 23.821,41 | 33,038 |
| C MARQUÉS DEL NERVIÓN 114-1 | R1=10 · R2=10 | — | — | — |
| C NESCANIA 25 | B1=1 · B2=1 · B3=1 · R1=7 · R2=7 · R3=7 · R4=7 | 33.581,30 | 19.405,43 | 25,45 |
| C OPALO 5 | B1=1 · B2=1 · B3=1 · B4=1 · B5=1 · B6=1 · R1=4 · R2=4 · R3=4 · R4=4 | 8.951,24 | 3.703,12 | 2,25 |
| C PELAY CORREA 73 | B1=1 · B2=1 · R1=2 · R2=2 | 16.722,24 | 10.746,98 | 16,625 |
| C PELAY CORREA 75 | B1=1 · B2=1 · B3=1 · B4=1 · R1=2 · R2=2 · R3=2 · R4=2 | 28.788,23 | 18.319,25 | 28,562 |
| C PELAY CORREA 77 | B1=1 · B2=1 · R1=2 · R2=2 | 14.636,83 | 9.325,11 | 14,062 |
| C PEÑALARA 16 | B1=1 · B2=1 · R1=4 · R2=4 | 17.945,63 | 11.144,75 | 16,562 |
| C PUERTO DE VIELLA 5 | B1=1 · B2=1 · B3=1 · B4=1 · R1=4 · R2=4 · R3=4 · R4=4 | 29.482,95 | 17.920,19 | 27,975 |
| C SIERPES 46 | B1=1 · B2=1 · B3=1 · B4=1 · B5=1 · B6=1 · B7=1 · B8=1 · B9=1 · B10=1 · B11=1 · B12=1 · B13=1 · B14=1 · B15=1 · B16=1 · R1=4 · R2=4 · R3=4 · R4=4 · R5=4 · R6=4 · R7=4 · R8=4 | 23.466,92 | 9.061,99 | 3,75 |
| C SIERRA VICARÍA 2 | B1=1 · B2=1 · B3=1 · B4=1 · R1=2 · R2=2 · R3=2 · R4=2 | 20.099,77 | 12.395,30 | 21,038 |
| C SOR GREGORIA DE SANTA TERESA 2 | B1=1 · B2=1 · R1=3 · R2=3 | 13.805,63 | 8.540,20 | 13 |
| C THARSIS 5 | R1=4 · R2=4 | 16.587,81 | 10.437,14 | 15,037 |
| C VIRGEN DE LORETO 9 | R1=4 · R2=4 · A1=1 | 24.905,98 | 15.391,35 | 20 |
| NR SANTA ISABEL 5, A | B1=1 · R1=7 · R2=7 | 7.127,29 | 3.223,15 | 2,25 |
| PZ ALEGRE 16 | B1=1 · B2=1 · R1=4 · R2=4 | 15.442,25 | 9.437,90 | 13,963 |
| PZ DE LOS DUENDES DE SEVILLA 2 | B1=1 · B2=1 · R1=4 · R2=4 | 12.126,82 | 7.177,38 | 9,812 |
| PZ PINTOR AMALIO GARCÍA DEL MORAL 8 | R1=4 · R2=4 | 17.453,88 | 10.700,37 | 15,988 |
| PZ SELLA 4 | B1=1 · R1=4 · R2=4 | 14.041,44 | 8.591,89 | 11,337 |
| UR MACARENA TRES HUERTAS 16 | R1=7 · R2=7 | 15.243,91 | 8.866,30 | 10,2 |

## A.2 Código de la batería
Los ficheros van en dos carpetas del banco de pruebas: `regresion/` (los 5 primeros) y `sbv/` (los 3 últimos, junto a los `.cjs` del programa **y lo que estos cargan: la carpeta `lib/` (por `lib/auth.cjs`) y `horario-bot.cjs`**, que `presupuestos.cjs` y `bot-whatsapp.cjs` piden al arrancar; sin ellos la prueba falla antes de empezar — aviso del repaso del 23/10/2026, sin probar). El código de la batería **no está en el repositorio** (la carpeta `test/` es de Alberto): se monta copiando el de A.2. Además hace falta el `sheet_real.json` (el Excel del Sheet convertido a JSON, que el asistente genera al subirlo).

**`LEEME.txt`**
```text
Batería de pruebas de Plan 5 (26/09/2026)
- paso_a.py : abre la Toma de Datos de cada edificio en un navegador y lee zonas y aviso.
- paso_b.js : con esos datos calcula el desglose en el servidor (total, coste, tiempo, líneas clave).
- correr.sh : correr.sh <presupuestos_plan5.cjs> <etiqueta>  -> A_<etiqueta>.json y B_<etiqueta>.json
- comparar.py : comparar.py <etiqueta_antes> <etiqueta_despues>
- A_v223.json / B_v223.json : resultados de referencia de la Rev-22.3 (41 edificios).
Necesita el banco de pruebas (sbv) y el Excel del Sheet. Ver §5.19 del manual.
Nota (04/10/2026): el paso B de una sola vez se puede atascar con 48 edificios; si pasa, se calcula por tandas de 8 (reabriendo cada presupuesto con "Editar a mano" en el banco y leyendo el cuadro), que da lo mismo y tarda segundos.
```

**`correr.sh`**
```bash
#!/bin/bash
# Uso: correr.sh <plan5.cjs> <etiqueta>
cd /home/claude/sbv
cp "$1" presupuestos_plan5.cjs
pkill -f "node server_real.js" 2>/dev/null; sleep 1
(node server_real.js > srv_real.log 2>&1 &); sleep 8
python3 /home/claude/regresion/paso_a.py /home/claude/regresion/A_$2.json
pkill -f "node server_real.js"; sleep 1
timeout 300 node /home/claude/regresion/paso_b.js /home/claude/regresion/A_$2.json /home/claude/regresion/B_$2.json >/dev/null 2>&1
echo "hecho $2"; wc -c /home/claude/regresion/A_$2.json /home/claude/regresion/B_$2.json
```

**`paso_a.py`**
```python
# Paso A: abre la Toma de Datos de cada edificio en un navegador y lee lo que calcula la pantalla.
import asyncio, json, sys, urllib.parse
from playwright.async_api import async_playwright
dirs=json.load(open('/home/claude/regresion/dirs.json'))
async def main():
    out={}
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1100,'height':1400})
        for d in dirs:
            try:
                await pg.goto('http://localhost:4567/plan5?token=t&dir='+urllib.parse.quote(d), wait_until='load', timeout=60000)
                await pg.wait_for_timeout(700)
                z=await pg.evaluate("Object.fromEntries([...document.querySelectorAll('.vn-disp')].map(e=>[e.dataset.z+'/'+e.dataset.i, e.textContent.trim()]))")
                av=await pg.evaluate("(()=>{const t=document.body.innerText.split('\\n');return t.filter(l=>/No coinciden|Peine V\\d|Peines H|no reconocido|Revísalo/.test(l)).map(l=>l.trim())})()")
                out[d]={'zonas':z,'aviso':av}
            except Exception as e:
                out[d]={'error':str(e)[:120]}
        await b.close()
    json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)
asyncio.run(main())
```

**`paso_b.js`**
```javascript
// Paso B: con los n de zonas recalculados en pantalla (paso A), calcula el desglose en el servidor.
const path='/home/claude/sbv/';
process.chdir(path);
const T=require(path+'harness_real');
const fs=require('fs');
const A=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{
 const out={};
 const rows=T.S.plan5_toma_datos;
 for(const dir of Object.keys(A)){
   const i=rows.findIndex(r=>r[0]===dir); if(i<0) continue;
   const g=JSON.parse(rows[i][6]);
   // 04/10/2026: sin la foto, para que calcule el motor (los cerrados servirian su foto congelada).
   delete g.snapshot; g.estado='abierto'; if(rows[i].length>8) rows[i][8]='';
   const zn=A[dir].zonas||{};
   ['baja','resto','atico'].forEach(z=>(g.zonas&&g.zonas[z]||[]).forEach((v,k)=>{ const key=z+'/'+k; if(key in zn) v.n=+zn[key]; }));
   rows[i][6]=JSON.stringify(g);
   const r=await T.call('get','/plan5/desglose',{dir,format:'json'});
   const j=r.json||{}; const d=j.dsg||{};
   const lineas=(d.L||d.lineas||[]);
   const s=JSON.stringify(j);
   const pick=(re)=>{const m=s.match(re);return m?m[1]:null;};
   const clave={};
   for (const m of s.matchAll(/"concepto":"([^"]+)","variante":"([^"]*)","cantidad":(-?[0-9.]+)/g)){
     if(/PEINE|ENGANCHE|Tubo|TUBO|vivienda|Viviendas|Contador|BATER/i.test(m[1])) clave[m[1]+(m[2]?' | '+m[2]:'')]=+m[3];
   }
   const c=j.cuadro||{}; out[dir]={ total: c.totP5Iva!=null?Math.round(c.totP5Iva*100)/100:null, coste: c.cTot!=null?Math.round(c.cTot*100)/100:null, tiempo: c.tEjec!=null?Math.round(c.tEjec*1000)/1000:null, clave };
 }
 fs.writeFileSync(process.argv[3],JSON.stringify(out)); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
```

**`comparar.py`**
```python
import json,sys
a,b=sys.argv[1],sys.argv[2]
A2=json.load(open(f'A_{a}.json'));A3=json.load(open(f'A_{b}.json'))
B2=json.load(open(f'B_{a}.json'));B3=json.load(open(f'B_{b}.json'))
print('edificios:',len(A3),'| errores pantalla:',[d for d in A3 if 'error' in A3[d]],'| sin desglose:',[d for d in A3 if d not in B3])
cambios=0
for d in A3:
    dif=[]
    if A2.get(d,{}).get('zonas')!=A3[d].get('zonas'): dif.append(('viviendas por zona',A2.get(d,{}).get('zonas'),A3[d].get('zonas')))
    if A2.get(d,{}).get('aviso')!=A3[d].get('aviso'): dif.append(('aviso',A2.get(d,{}).get('aviso'),A3[d].get('aviso')))
    b2=B2.get(d,{});b3=B3.get(d,{})
    for kk in ('total','coste','tiempo'):
        if b2.get(kk)!=b3.get(kk): dif.append((kk.upper(),b2.get(kk),b3.get(kk)))
    for k in sorted(set(b2.get('clave',{}))|set(b3.get('clave',{}))):
        if b2.get('clave',{}).get(k)!=b3.get('clave',{}).get(k): dif.append((k,b2.get('clave',{}).get(k),b3.get('clave',{}).get(k)))
    if dif:
        cambios+=1; print('==',d)
        for x in dif: print('   ',x[0],'|',x[1],'->',x[2])
print('edificios con cambios:',cambios)
```

**`harness_real.js`**
```javascript
process.env.GOOGLE_SHEETS_ID='x';process.env.ADMIN_TOKEN='t';
const fs=require('fs');
const {S,api}=require('./fakesheet_real');
const g=require('googleapis');g.google.sheets=()=>api;g.google.drive=()=>({files:{list:async()=>({data:{files:[]}}),get:async()=>({data:{}})}});
g.google.gmail=()=>({users:{messages:{send:async()=>({data:{id:'x'}})}}});
g.google.auth={OAuth2:function(){this.setCredentials=()=>{}},GoogleAuth:function(){}};
const routes={get:{},post:{}};
const app={locals:{},get(p,...h){[].concat(p).forEach(x=>routes.get[x]=h[h.length-1])},post(p,...h){[].concat(p).forEach(x=>routes.post[x]=h[h.length-1])},use(){},set(){}};
global.setInterval=()=>0;
const _log=console.log; console.log=(...a)=>{ if(String(a[0]).startsWith('[')) return; _log(...a); };
require('./presupuestos.cjs')(app); require('./presupuestos_plan5.cjs')(app); require('./documentacion.cjs')(app);
function call(kind,path,q,b){return new Promise(res=>{const r={statusCode:200,status(c){this.statusCode=c;return this},set(){return this},type(){return this},send(x){res({code:this.statusCode,html:String(x)})},json(x){res({code:this.statusCode,json:x})},redirect(u){res({code:302,redir:u})},end(){res({code:this.statusCode})}};routes[kind][path]({query:Object.assign({token:'t'},q||{}),body:b||{},headers:{},cookies:{}},r)})}
const H=()=>S.comunidades[0];
const row=(name)=>S.comunidades.find(x=>x[0]===name);
function setC(name,obj){const r=row(name);for(const k in obj){let i=H().indexOf(k);if(i<0){console.error('no col',k);continue;}while(r.length<=i)r.push('');r[i]=obj[k];}}
function getC(name,k){return row(name)[H().indexOf(k)]||''}
const iso=(d)=>{const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)};
const txt=(h)=>require('html-entities')?h:h;
function strip(h){return String(h).replace(/<style[\s\S]*?<\/style>/g,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' | ').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/(\s*\|\s*)+/g,' | ');}
async function hoyBadge(name,id){const r=await call('get','/presupuestos/hoy');const h=r.html;const k=h.indexOf('class="hoy-exp-visto" data-ccpp-id="'+id+'"');if(k<0){const k2=h.indexOf('data-ccpp-id="'+id+'"');if(k2<0)return '(no está en HOY)';}const i=h.indexOf('grid-template-columns:175px 125px',h.indexOf('data-ccpp-id="'+id+'"',h.indexOf('hoy-exp-titulo')));const _p0=h.indexOf('class="hoy-exp-visto" data-ccpp-id="'+id+'"')>=0?h.indexOf('class="hoy-exp-visto" data-ccpp-id="'+id+'"'):h.indexOf('data-ptecobro="1" data-ccpp-id="'+id+'"');const seg=h.slice(_p0,_p0+6000);const j=seg.indexOf('175px 125px');if(j<0)return '(sin badge)';return strip(seg.slice(j,j+900)).split(' | ').filter(x=>x.trim()&&!/grid-template|175px/.test(x)).slice(0,2).join(' | ');}
async function avisosM(){const r=await call('get','/presupuestos/hoy');return [...r.html.matchAll(/text=([^"'&]+)/g)].map(m=>decodeURIComponent(m[1].replace(/&amp;/g,'&'))).filter(s=>/^Hola|^M\d/.test(s));}
async function timeline(id){const r=await call('get','/documentacion/expediente',{id});const t=strip(r.html);const i=t.indexOf('COMUNICACIONES');return t.slice(i,i+520).replace(/\s+/g,' ');}
async function mail(fase,id){const r=await call('get','/presupuestos/plantilla-mail',{fase,id});return r.json&&r.json.plantilla?r.json.plantilla.mensaje:JSON.stringify(r);}
async function ult(path,id,skip){const b={id};if(skip)b.skip='1';else{b.destinatario='a@b.c';b.asunto='x';b.mensaje='x';}const r=await call('post',path,{},b);return r.json||r;}
async function botonWA(id){const r=await call('get','/documentacion/expediente',{id});return [...r.html.matchAll(/text=([^"'&]+)/g)].map(m=>decodeURIComponent(m[1].replace(/&amp;/g,'&')));}
module.exports={S,call,setC,getC,iso,hoyBadge,avisosM,timeline,mail,ult,botonWA,row,H};
```

**`fakesheet_real.js`**
```javascript
const S=JSON.parse(require('fs').readFileSync(__dirname+'/../sheet_real.json','utf8'));
function col(s){let n=0;for(const c of s)n=n*26+(c.charCodeAt(0)-64);return n-1;}
function parse(range){const [tab,r]=range.split('!');const m=/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(r);return {tab,c0:col(m[1]),r0:m[2]?+m[2]-1:0,c1:m[3]?col(m[3]):col(m[1]),r1:m[4]?+m[4]-1:(m[2]&&!m[3]?+m[2]-1:null)};}
const log=[];
const api={spreadsheets:{get:async()=>({data:{sheets:Object.keys(S).map((k,i)=>({properties:{sheetId:i,title:k,gridProperties:{columnCount:60}}}))}}),batchUpdate:async()=>({}),values:{batchGet:async({ranges})=>({data:{valueRanges:await Promise.all(ranges.map(async r=>({range:r,values:(await api.spreadsheets.values.get({range:r})).data.values})))}}),
 get:async({range})=>{const p=parse(range);const T=S[p.tab]||[];const r1=p.r1==null?T.length-1:p.r1;const out=[];for(let i=p.r0;i<=r1&&i<T.length;i++){const row=(T[i]||[]).slice(p.c0,p.c1+1);while(row.length&&row[row.length-1]==='')row.pop();out.push(row);}return {data:{values:out}};},
 update:async({range,requestBody})=>{const p=parse(range);const T=S[p.tab];requestBody.values.forEach((v,k)=>{const i=p.r0+k;T[i]=T[i]||[];v.forEach((x,j)=>{while(T[i].length<=p.c0+j)T[i].push('');T[i][p.c0+j]=x==null?'':String(x);});});log.push(['update',range]);return {};},
 batchUpdate:async({requestBody})=>{for(const d of (requestBody.data||[])){await api.spreadsheets.values.update({range:d.range,requestBody:{values:d.values}});}return {};},
 append:async({range,requestBody})=>{const p=parse(range);requestBody.values.forEach(v=>S[p.tab].push(v.map(x=>x==null?'':String(x))));log.push(['append',range]);return {};},
}}};
module.exports={S,api,log};
```

**`server_real.js`**
```javascript
process.env.GOOGLE_SHEETS_ID='x';process.env.ADMIN_TOKEN='t';
const {S,api}=require('./fakesheet_real');
const g=require('googleapis');g.google.sheets=()=>api;g.google.drive=()=>({files:{list:async()=>({data:{files:[]}}),get:async()=>({data:{}})}});
g.google.auth={OAuth2:function(){this.setCredentials=()=>{}},GoogleAuth:function(){}};
const routes={get:{},post:{}};
const app={locals:{},get(p,...h){[].concat(p).forEach(x=>routes.get[x]=h[h.length-1])},post(p,...h){[].concat(p).forEach(x=>routes.post[x]=h[h.length-1])},use(){},set(){}};
const _si=setInterval; global.setInterval=()=>0;
require('./presupuestos.cjs')(app); require('./presupuestos_plan5.cjs')(app); require('./documentacion.cjs')(app);
// Moncayo: envio contratos hace 12 dias -> toca "¿Conceder prorroga?"
const h=S.comunidades[0]; const iE=h.indexOf('fecha_envio_contratos_pagos'); const iM=h.indexOf('mails_ultimo_envio');

const log=[];
require('http').createServer((rq,rs)=>{
  const u=new URL(rq.url,'http://x'); const q=Object.fromEntries(u.searchParams);
  let body='';rq.on('data',c=>body+=c);rq.on('end',async()=>{
    const b=Object.fromEntries(new URLSearchParams(body));
    const fn=routes[rq.method.toLowerCase()][u.pathname];
    if(rq.method==='POST') log.push(u.pathname+' '+JSON.stringify(b).slice(0,120));
    if(!fn){rs.writeHead(404);return rs.end('nf');}
    const res={statusCode:200,status(c){this.statusCode=c;return this},set(){return this},type(){return this},
      send(x){rs.writeHead(this.statusCode,{'Content-Type':'text/html; charset=utf-8'});rs.end(String(x))},
      json(x){rs.writeHead(this.statusCode,{'Content-Type':'application/json'});rs.end(JSON.stringify(x))},
      redirect(x){rs.writeHead(302,{Location:x});rs.end()},end(){rs.end()}};
    try{await fn({query:q,body:b,headers:rq.headers,cookies:{}},res);}catch(e){rs.writeHead(500);rs.end(e.message)}
  });
}).listen(4567,()=>console.log('listo'));
process.on('SIGTERM',()=>{require('fs').writeFileSync('postlog.txt',log.join('\n'));process.exit(0)});
setTimeout(()=>{require('fs').writeFileSync('postlog.txt',log.join('\n'));process.exit(0)},200000);
```

