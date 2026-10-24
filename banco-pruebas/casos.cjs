// ===================================================================
// BANCO DE PRUEBAS — casos fijos
// ===================================================================
// Cada caso prepara en memoria el estado que necesita (no depende de que un
// expediente concreto siga en una fase), hace lo que haría Guille y comprueba
// el resultado. Si un caso falla, algo que funcionaba se ha roto.
//
// Regla: cada fallo que se arregla deja aquí su caso (§7.3 del manual), para
// que no vuelva. Cada caso dice de qué versión viene.
//
// Un caso es: { nombre, desde, prueba: async (S) => [ [condición, "qué se esperaba", detalle], ... ] }
// ===================================================================
"use strict";
const vm = require("vm");

// ---------- utilidades ----------
function fijar(S, comu, campos) {
  // escribe campos en la fila de la comunidad del Sheet simulado
  const fila = S.DATA.comunidades[comu._rowIndex - 1];
  for (const [k, v] of Object.entries(campos)) {
    const c = S.col("comunidades", k);
    if (c < 0) throw new Error("columna no encontrada en comunidades: " + k);
    while (fila.length <= c) fila.push("");
    fila[c] = v;
  }
}
async function preparar07ConMarcas05(S) {
  // Cualquier comunidad, puesta en 07 con el ultimátum de la 05 sellado y sus marcas.
  const c = await S.comunidad((x) => x.direccion && x.ccpp_id);
  const me = { fecha_ultimatum_ampliado__SKIP: "2026-08-03", fecha_ultimatum_ampliado__HASTA: "2026-08-13", fecha_disidentes_solicitados__SKIP: "2026-08-14", fecha_contrato_resuelto__SKIP: "2026-08-20" };
  fijar(S, c, {
    fase_presupuesto: "07_PTE_CYCP", fecha_ultimatum_ampliado: "2026-08-03", fecha_disidentes_solicitados: "2026-08-14",
    fecha_contrato_resuelto: "2026-08-20", mails_enviados: JSON.stringify(me), fecha_cycp_completa: "",
  });
  return c;
}
async function comprobarLimpio08(S, c) {
  const d = await S.comunidad((x) => x.ccpp_id === c.ccpp_id);
  const marcas = Object.keys(JSON.parse(d.mails_enviados || "{}")).filter((k) => /__SKIP|__HASTA/.test(k) && /ultimatum|disidentes|contrato_resuelto/.test(k));
  return [
    [String(d.fase_presupuesto) === "08_CYCP", "pasa a 08_CYCP", d.fase_presupuesto],
    [!d.fecha_ultimatum_ampliado && !d.fecha_disidentes_solicitados && !d.fecha_contrato_resuelto, "BL, BM y BN vacías en el Sheet", [d.fecha_ultimatum_ampliado, d.fecha_disidentes_solicitados, d.fecha_contrato_resuelto].join(" / ")],
    [marcas.length === 0, "sin marcas __SKIP/__HASTA del ultimátum", marcas.join(", ")],
  ];
}
function scriptsRotos(html) {
  // Comprueba que cada <script> en línea de la página se puede leer (no ejecuta nada).
  const rotos = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    const js = m[1];
    if (!js.trim() || /^\s*\{[\s\S]*\}\s*$/.test(js) && /application\/(ld\+)?json/i.test(m[0])) continue;
    try { new vm.Script(js); } catch (e) { rotos.push("script " + n + ": " + e.message); }
  }
  return rotos;
}

// ---------- casos ----------
const CASOS = [
  // ===== pantallas =====
  ...[
    ["/presupuestos/hoy", { pisos: 2 }],
    ["/presupuestos", { comunidades: 1 }],
    ["/presupuestos/plantillas", null],
    ["/presupuestos/plantillas-doc", null],
    ["/presupuestos/plantillas-bot-flujo", null],
    ["/presupuestos/mapa", null],
    ["/presupuestos/nuevo", null],
  ].map(([ruta, maxLect]) => ({
    nombre: "Pantalla " + ruta + " se pinta entera y sus scripts se leen",
    desde: "v140 (banco permanente)",
    prueba: async (S) => {
      const r = await S.call("GET", ruta, {});
      const html = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
      const rotos = scriptsRotos(html);
      const out = [
        [r.status === 200, "responde 200", r.status + " " + html.slice(0, 200)],
        [html.length > 2000, "trae página (más de 2.000 caracteres)", html.length],
        [rotos.length === 0, "todos los <script> se pueden leer", rotos.join(" | ")],
      ];
      if (maxLect) for (const [t, max] of Object.entries(maxLect)) {
        const n = S.LOG.filter((x) => x.startsWith("GET " + t + "!") || x === "GET " + t).length;
        out.push([n <= max, "lee " + t + " como mucho " + max + " vez/veces", n]);
      }
      return out;
    },
  })),
  {
    nombre: "Ficha del expediente y de documentación se pintan (una comunidad de cada fase)",
    desde: "v140 (banco permanente)",
    prueba: async (S) => {
      const out = [], vistas = new Set();
      for (const c of await S.comunidades()) {
        const f = S.P().normalizarFase(c.fase_presupuesto);
        if (vistas.has(f) || !c.ccpp_id) continue;
        vistas.add(f);
        const ruta = ["05_DOCUMENTACION", "06_VISITA_EMASESA", "07_PTE_CYCP", "08_CYCP", "09_TRAMITADA"].includes(f) ? "/documentacion/expediente" : "/presupuestos/expediente";
        const r = await S.call("GET", ruta, { id: c.ccpp_id });
        let html = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
        if (r.status === 302) { const r2 = await S.call("GET", String(r.body).split("?")[0].replace(/^https?:\/\/[^/]+/, ""), { id: c.ccpp_id }); html = String(r2.body); }
        const rotos = scriptsRotos(html);
        out.push([html.length > 2000 && !/Error interno|TypeError|ReferenceError/.test(html.slice(0, 3000)), f + " (" + c.direccion + "): se pinta", html.slice(0, 160)]);
        out.push([rotos.length === 0, f + ": todos los <script> se leen", rotos.join(" | ")]);
      }
      return out;
    },
  },

  // ===== v137: el ultimátum de la 05 no pasa a la 08 =====
  {
    nombre: "07 → 08 con «Saltar envío» limpia el ultimátum de la 05",
    desde: "v137",
    prueba: async (S) => {
      const c = await preparar07ConMarcas05(S);
      await S.call("POST", "/presupuestos/expediente/enviar-mail", { id: c.ccpp_id, fase: "08_INICIO_CYCP", skip: "1" });
      return comprobarLimpio08(S, c);
    },
  },
  {
    nombre: "07 → 08 enviando el correo 08-INICIO CYCP limpia el ultimátum de la 05",
    desde: "v137",
    prueba: async (S) => {
      const c = await preparar07ConMarcas05(S);
      await S.call("POST", "/presupuestos/expediente/enviar-mail", { id: c.ccpp_id, fase: "08_INICIO_CYCP", destinatario: "prueba@banco.test", asunto: "Prueba", mensaje: "Prueba" });
      return comprobarLimpio08(S, c);
    },
  },
  {
    nombre: "07 → 08 con /avanzar limpia el ultimátum de la 05",
    desde: "v137",
    prueba: async (S) => {
      const c = await preparar07ConMarcas05(S);
      await S.call("POST", "/presupuestos/expediente/avanzar", { id: c.ccpp_id });
      return comprobarLimpio08(S, c);
    },
  },

  // ===== v138: renombrar solo el tipo de vía arrastra Plan 5 =====
  {
    nombre: "Renombrar solo el tipo de vía cambia también la fila de plan5_toma_datos",
    desde: "v138",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      let c = null, fila = -1;
      for (const x of await S.comunidades()) {
        const clave = ((x.tipo_via || "") + " " + (x.direccion || "")).trim().toUpperCase();
        const i = p5.findIndex((r, j) => j > 0 && String(r[0] || "").trim().toUpperCase() === clave);
        if (i > 0 && x.tipo_via && x.tipo_via !== "Av") { c = x; fila = i; break; }
      }
      if (!c) return [[false, "hay una comunidad con fila en plan5_toma_datos", "ninguna"]];
      await S.call("POST", "/presupuestos/expediente/renombrar", { id: c.ccpp_id, tipo_via: "Av", direccion: c.direccion, confirmar: "1" });
      const ahora = String(p5[fila][0] || "");
      return [[/^AV\s/i.test(ahora), "plan5_toma_datos empieza ya por «Av»", ahora]];
    },
  },

  // ===== v139 =====
  {
    nombre: "Correo manual con el pie ya escrito no sale con el pie dos veces",
    desde: "v139",
    prueba: async (S) => {
      const c = await S.comunidad((x) => x.ccpp_id && x.direccion);
      const pieF = (S.DATA.mail_plantillas || []).find((r) => r[0] === "_PIE_GLOBAL");
      if (!pieF || !pieF[3]) return [[false, "existe la plantilla _PIE_GLOBAL", "no"]];
      const pie = String(pieF[3]).trim();
      const trozo = pie.split("\n").map((l) => l.trim()).filter((l) => !/^-+$/.test(l)).sort((x, y) => y.length - x.length)[0];   // la línea más larga del pie, que sale una vez
      await S.call("POST", "/presupuestos/expediente/mail-enviar-manual", { id: c.ccpp_id, asunto: "Banco pie", mensaje: "Hola,\n\nPrueba.\n\n" + pie, destinatario: "prueba@banco.test" });
      await S.call("POST", "/presupuestos/expediente/mail-enviar-manual", { id: c.ccpp_id, asunto: "Banco sin pie", mensaje: "Hola, sin pie", destinatario: "prueba@banco.test" });
      const veces = (asunto) => { const m = S.SENT.find((x) => x.subject === asunto) || {}; return String(m.text || m.html || "").split(trozo).length - 1; };
      return [
        [veces("Banco pie") === 1, "con el pie en el cuerpo: sale 1 vez", veces("Banco pie")],
        [veces("Banco sin pie") === 1, "sin el pie en el cuerpo: lo añade 1 vez", veces("Banco sin pie")],
      ];
    },
  },
  {
    nombre: "Con la casilla de días vacía, el correo del ultimátum avisa y no inventa días",
    desde: "v139",
    prueba: async (S) => {
      const c = await S.comunidad((x) => x.ccpp_id && x.direccion);
      const mp = S.DATA.mail_plantillas, idp = S.col("mail_plantillas", "dias_primer_envio");
      const f = mp.find((r) => r[0] === "05_ULT_RESOLVER");
      if (!f) return [[false, "existe la plantilla 05_ULT_RESOLVER", "no"]];
      f[idp] = "";
      const r = await S.call("GET", "/presupuestos/plantilla-mail", { fase: "05_ULT_RESOLUCION", id: c.ccpp_id });
      const b = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
      return [
        [/Falta|casilla/i.test(b), "avisa de que falta la casilla", b.slice(0, 200)],
        [!/\b5 d[ií]as/.test(b), "no pone «5 días» por su cuenta", ""],
      ];
    },
  },
  {
    nombre: "Presentación del bot con la plantilla desactivada: no se manda ni se crea ficha",
    desde: "v139",
    prueba: async (S) => {
      const bp = S.DATA.bot_plantillas, fila = bp.find((r) => r[0] === "presentacion");
      if (!fila) return [[false, "existe la fila presentacion en bot_plantillas", "no"]];
      fila[6] = "NO";
      const n = S.DATA.bot_expedientes.length;
      const res = await S.app.locals.botWhatsapp.enviarPresentacionPiso("+34611222333", { comunidad: "Banco 1", vivienda: "9Z", nombre: "Vecina Prueba" });
      return [
        [res && res.ok === false, "devuelve ok:false", JSON.stringify(res)],
        [S.SENT.filter((m) => m.canal === "whatsapp").length === 0, "no sale ningún WhatsApp", S.SENT.length],
        [S.DATA.bot_expedientes.length === n, "no crea ficha en bot_expedientes", S.DATA.bot_expedientes.length - n],
      ];
    },
  },
  {
    nombre: "Presentación del bot con la plantilla activa: sale el WhatsApp y se crea la ficha",
    desde: "v139",
    prueba: async (S) => {
      const fila = S.DATA.bot_plantillas.find((r) => r[0] === "presentacion");
      if (!fila || String(fila[6] || "").toUpperCase() === "NO" || !/HX/.test(fila.join(" "))) return [[true, "(la plantilla está desactivada en el Sheet: caso no aplicable)", ""]];
      const n = S.DATA.bot_expedientes.length;
      const res = await S.app.locals.botWhatsapp.enviarPresentacionPiso("+34611222333", { comunidad: "Banco 1", vivienda: "9Z", nombre: "Vecina Prueba" });
      return [
        [res && res.ok !== false, "devuelve ok", JSON.stringify(res)],
        [S.SENT.filter((m) => m.canal === "whatsapp").length === 1, "sale 1 WhatsApp", S.SENT.length],
        [S.DATA.bot_expedientes.length === n + 1, "crea 1 ficha en bot_expedientes", S.DATA.bot_expedientes.length - n],
      ];
    },
  },
  {
    nombre: "Un mensaje que entra por el webhook lee la pestaña pisos una sola vez",
    desde: "v139",
    prueba: async (S) => {
      const iA = S.col("pisos", "bot_piso_activo");
      const f = S.DATA.pisos.find((x, i) => i > 0 && x[0] && String(x[iA >= 0 ? iA : 47]) === "BOT_WHATSAPP");
      if (!f) return [[true, "(no hay pisos en W: caso no aplicable)", ""]];
      S.LOG.length = 0;
      const req = { method: "POST", body: { From: "whatsapp:" + f[0], Body: "hola", NumMedia: "0", MessageSid: "SMbanco" + Date.now() }, query: {}, headers: {}, get: () => "", protocol: "https", originalUrl: "/whatsapp" };
      await new Promise((ok) => { const rr = { status() { return this; }, type() { return this; }, set() { return this; }, send() { ok(); }, end() { ok(); }, json() { ok(); }, sendStatus() { ok(); } }; Promise.resolve(S.routes["POST /whatsapp"](req, rr)).catch(() => ok()); });
      await S.espera(1500);
      const n = S.LOG.filter((x) => /^GET pisos/.test(x)).length;
      return [[n <= 1, "pisos leída como mucho 1 vez", n + ": " + S.LOG.filter((x) => /^GET pisos/.test(x)).join(", ")]];
    },
  },

  // ===== v140: importes de la forma de pago =====
  {
    nombre: "La pregunta de la forma de pago lleva los importes (foto en la columna I y en la G)",
    desde: "v140",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos;
      p5.push(["C BANCO NUEVA 1", "", "", "", "", "", JSON.stringify({ estado: "cerrado" }), "", JSON.stringify({ dsg: {}, cuadro: { comunero: 1168.4, fin6: 199, fin12: 101, fin18: 70 } })]);
      p5.push(["C BANCO VIEJA 2", "", "", "", "", "", JSON.stringify({ snapshot: { cuadro: { comunero: 900, fin6: 150, fin12: 80, fin18: 55 } } })]);
      p5.push(["C BANCO ABIERTA 3", "", "", "", "", "", JSON.stringify({ estado: "abierto" })]);
      p5.push(["C BANCO CERRADA SIN FOTO 4", "", "", "", "", "", JSON.stringify({ estado: "cerrado" })]);
      // importesComunidad no está exportada: se saca su código del fichero del bot y se corre
      // contra el Sheet simulado (mismo código, sin copiarlo aquí).
      const src = require("fs").readFileSync(require("path").join(S.RAIZ, "bot-whatsapp.cjs"), "utf8");
      const a0 = src.indexOf("let _importesP5 = null"), b0 = src.indexOf("function _eurosP5");
      if (a0 < 0 || b0 < 0) return [[false, "encuentro _cargarImportesP5 en bot-whatsapp.cjs", "no está"]];
      const ctx = { getSheetsClient: () => require("googleapis").google.sheets(), process, console, Date, JSON, Object, String, Math, _saludBot: { p5SinImportes: null } };
      vm.createContext(ctx);
      vm.runInContext(src.slice(a0, b0) + "\n;this.importesComunidad = importesComunidad;", ctx);
      const a = await ctx.importesComunidad("Banco Nueva 1"), v = await ctx.importesComunidad("Banco Vieja 2"), x = await ctx.importesComunidad("Banco Abierta 3");
      return [
        [!!a && Math.round(a.comunero) === 1168 && a.fin6 === 199, "cerrado con foto en I: 1.168 € y 199 €/mes", JSON.stringify(a)],
        [!!v && v.comunero === 900, "cerrado con foto en G: 900 €", JSON.stringify(v)],
        [x === null, "abierto: sin importes", JSON.stringify(x)],
        [JSON.stringify(ctx._saludBot.p5SinImportes || []).includes("C BANCO CERRADA SIN FOTO 4"), "v141: el cerrado sin foto queda apuntado para el aviso de HOY", JSON.stringify(ctx._saludBot.p5SinImportes)],
        [!JSON.stringify(ctx._saludBot.p5SinImportes || []).includes("C BANCO NUEVA 1"), "v141: los cerrados con importes no se apuntan", ""],
      ];
    },
  },

  // ===== v141: avisos de sistema en HOY =====
  {
    nombre: "HOY avisa de una plantilla de correo que el programa necesita y no está",
    desde: "v141",
    prueba: async (S) => {
      const mp = S.DATA.mail_plantillas, i = mp.findIndex((r) => r[0] === "05_REC_M1_VECINO");
      if (i > 0) mp.splice(i, 1);
      await S.call("GET", "/presupuestos/hoy", {});
      const r = await S.call("GET", "/presupuestos/hoy", {});
      const avisos = [...String(r.body).matchAll(/⚠ ([^<]{0,400})/g)].map((m) => m[1]).filter((x) => /Plantillas mail/.test(x)).join(" | ");
      return [[/05_REC_M1_VECINO/.test(avisos), "el aviso nombra 05_REC_M1_VECINO", avisos || "(no sale el aviso)"]];
    },
  },
  {
    nombre: "HOY avisa cuando la IA del bot falla seguido (solo con la IA encendida)",
    desde: "v141",
    prueba: async (S) => {
      const b = S.app.locals.botWhatsapp;
      b.salud.ia.fallos = 4; b.salud.ia.desde = Date.now() - 3600000; b.salud.ia.err = "insufficient_quota";
      const ia = (txt) => [...txt.matchAll(/⚠ ([^<]{0,400})/g)].map((m) => m[1]).filter((x) => /La IA del bot/.test(x)).join(" | ");
      b.iaActiva = () => false;
      const apagada = ia(String((await S.call("GET", "/presupuestos/hoy", {})).body));
      b.iaActiva = () => true;
      const encendida = ia(String((await S.call("GET", "/presupuestos/hoy", {})).body));
      return [
        [apagada === "", "con la IA dormida no avisa", apagada],
        [/4 fallos/.test(encendida) && /saldo/.test(encendida), "con la IA encendida avisa (4 fallos, falta saldo)", encendida || "(no sale el aviso)"],
      ];
    },
  },
  // ===== v142: columnas en su sitio =====
  {
    nombre: "Con el Sheet bien no avisa de columnas; si se inserta una columna, avisa y HOY lo dice",
    desde: "v142",
    prueba: async (S) => {
      const bien = await S.P()._comprobarColumnas();
      // se inserta una columna vacía en comunidades delante de la P (fase) y otra en pisos delante de la AU
      S.DATA.comunidades.forEach((r, i) => r.splice(15, 0, i === 0 ? "columna_nueva" : ""));
      S.DATA.pisos.forEach((r, i) => r.splice(46, 0, i === 0 ? "otra" : ""));
      const mal = await S.P()._comprobarColumnas();
      const r = await S.call("GET", "/presupuestos/hoy", {});
      const aviso = [...String(r.body).matchAll(/⚠ ([^<]{0,500})/g)].map((m) => m[1]).filter((x) => /Columnas fuera/.test(x)).join(" | ");
      return [
        [bien.length === 0, "con el Sheet de hoy: ninguna columna descuadrada", bien.join(" | ")],
        [mal.some((x) => /comunidades columna P/.test(x)), "detecta comunidades desde la P", mal.join(" | ")],
        [mal.some((x) => /pisos columna AU/.test(x)), "detecta pisos desde la AU", mal.join(" | ")],
        [/comunidades columna P/.test(aviso), "HOY lo avisa en rojo", aviso || "(no sale)"],
      ];
    },
  },
  // ===== v143: fuera el apaño de Sánchez Pizjuán 6 (v134 y v136) =====
  {
    nombre: "Sánchez Pizjuán 6 (O25-ARA/00213) imprime la cláusula 8 nueva y la línea inclinada, como los demás",
    desde: "v143",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      const fila = (n) => p5.find((r, j) => j > 0 && String(r[2] || "").trim() === n);
      const imp = async (n) => { const r = fila(n); return r ? String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body) : ""; };
      const sp = await imp("O25-ARA/00213"), ot = await imp("O25-ARA/00219");
      if (!sp || !ot) return [[false, "están en plan5_toma_datos O25-ARA/00213 y O25-ARA/00219", "falta alguno"]];
      const ver = (h) => ({ nueva: /8\.1\. Este presupuesto/.test(h), antigua: /plazo de validez de 1 mes\. En caso/.test(h), linea: /class="fhueco"/.test(h) });
      const a = ver(sp), b = ver(ot);
      return [
        [a.nueva && !a.antigua, "Sánchez Pizjuán 6: cláusula 8 nueva (8.1-8.6), no la antigua", JSON.stringify(a)],
        [a.linea, "Sánchez Pizjuán 6: lleva la línea inclinada", JSON.stringify(a)],
        [b.nueva && !b.antigua && b.linea, "Ardilla 9 sigue igual (cláusula nueva y línea)", JSON.stringify(b)],
      ];
    },
  },
  // ===== v144: menús de Toma de Datos (puntos de agua y ubicación del contador) =====
  {
    nombre: "Toma de Datos: puntos de agua y ubicación del contador con los nombres nuevos; lo viejo se abre e imprime con lo nuevo",
    desde: "v144",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      const r = p5.find((x, j) => j > 0 && /ALBERCHE 6C/i.test(String(x[0] || "")));
      const html = String((await S.call("GET", "/plan5", { dir: r ? r[0] : "C Alberche 6C" })).body);
      const sel = (id) => ((html.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>')) || [])[1] || "");
      const ops = (id) => [...sel(id).matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]).filter(Boolean).join(" · ");
      const pa = ops("comPunto1"), pb = ops("comPunto2"), ub = ops("ac_ubic");
      // la función que pasa lo guardado con el nombre viejo al nuevo, sacada de la propia página
      const m = html.match(/function _p5Renombra\(id,v\)\{[^\n]*\}/);
      let ren = null; try { ren = m ? new Function(m[0] + "; return _p5Renombra;")() : null; } catch (e) { ren = null; }
      // un presupuesto guardado con C.CONTADORES se imprime con «armario de contadores»
      const viejo = p5.find((x, j) => { if (!j) return false; try { const v = (JSON.parse(x[6] || "{}").v) || []; return v[8] === "C.CONTADORES" || v[9] === "C.CONTADORES"; } catch (e) { return false; } });
      const imp = viejo ? String((await S.call("GET", "/plan5/presupuesto", { dir: viejo[0] })).body) : "";
      const rotos = scriptsRotos(html);
      return [
        [rotos.length === 0, "los scripts de Toma de Datos se leen", rotos.join(" | ")],
        [/ARMARIO DE CONTADORES · CUARTO DE MOTORES · CUARTO DE SERVICIO/.test(pa) && pa === pb && !/C\.CONTADORES/.test(pa), "las dos casillas de puntos de agua con ARMARIO DE CONTADORES, CUARTO DE MOTORES y CUARTO DE SERVICIO (sin C.CONTADORES)", pa + " / " + pb],
        [/CUARTO DE SERVICIO/.test(ub) && !/EN CUARTO DE SERVICIO/.test(ub), "Ubicación del contador: «CUARTO DE SERVICIO» sin «EN»", ub],
        [!!ren && ren("comPunto1", "C.CONTADORES") === "ARMARIO DE CONTADORES" && ren("comPunto2", "C.CONTADORES") === "ARMARIO DE CONTADORES" && ren("ac_ubic", "EN CUARTO DE SERVICIO") === "CUARTO DE SERVICIO" && ren("comPunto1", "PORTAL") === "PORTAL" && ren("ac_llave", "EN CUARTO DE SERVICIO") === "EN CUARTO DE SERVICIO", "lo guardado con el nombre viejo se abre con el nuevo (y solo en esas casillas)", m ? m[0].slice(0, 80) : "(no está la función)"],
        [!!viejo && /armario de contadores/.test(imp) && !/cuarto de contadores/.test(imp), "un presupuesto guardado con C.CONTADORES imprime «armario de contadores»", viejo ? viejo[0] : "(ninguno guardado con C.CONTADORES)"],
        [/id="vatico"><\/div>\s*<div class="gv" style="margin-top:12px">/.test(html), "hueco entre Viviendas en ático y Puntos de agua", ""],
      ];
    },
  },
  // ===== v145: patios y fachadas laterales como en los peines; delantero y trasero primero =====
  {
    nombre: "Menús de ubicación con los 5 patios y las 2 fachadas laterales; el armario imprime igual sin el «EN» del menú",
    desde: "v145",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      const r = p5.find((x, j) => j > 0 && /ALBERCHE 6C/i.test(String(x[0] || "")));
      const html = String((await S.call("GET", "/plan5", { dir: r ? r[0] : "C Alberche 6C" })).body);
      const ops = (id) => [...(((html.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>')) || [])[1]) || "").matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]).filter(Boolean).join(" · ");
      const PAT = "PATIO DELANTERO · PATIO TRASERO · PATIO DERECHO · PATIO CENTRAL · PATIO IZQUIERDO";
      const FAC = "FACHADA DELANTERA · FACHADA TRASERA · FACHADA DERECHA · FACHADA IZQUIERDA";   // v146: sin «LATERAL»
      const quiero = {
        comPunto1: "PORTAL · ARMARIO DE CONTADORES · CUARTO DE MOTORES · CUARTO DE SERVICIO · AZOTEA · " + PAT,
        comPunto2: "PORTAL · ARMARIO DE CONTADORES · CUARTO DE MOTORES · CUARTO DE SERVICIO · AZOTEA · " + PAT,
        ac_ubic: FAC + " · ZONAS COMUNES · CUARTO DE MOTORES · CUARTO DE SERVICIO · " + PAT,
        cc_ubic: FAC + " · PORTAL · BAJO ESCALERA · CUARTO DE MOTORES · CUARTO DE SERVICIO · " + PAT,
        ac_llave: "DELANTERA · TRASERA · LATERAL · DELANTERA-TRASLADAR · TRASERA-TRASLADAR · LATERAL-TRASLADAR",
      };
      const out = Object.keys(quiero).map((id) => [ops(id) === quiero[id], id + ": " + quiero[id], ops(id)]);
      const sube = (html.match(/const OPT_SUBE=\[([^\]]*)\]/) || [])[1] || "";
      out.push([/FACHADA DELANTERA.*FACHADA TRASERA.*FACHADA DERECHA.*FACHADA IZQUIERDA.*PATIO DELANTERO.*PATIO TRASERO.*PATIO DERECHO.*PATIO CENTRAL.*PATIO IZQUIERDO.*SCHUNT/.test(sube), "peines: «Sube por» con delantero y trasero primero", sube.slice(0, 160)]);
      const m = html.match(/function _p5Renombra\(id,v\)\{[^\n]*\}/);
      let ren = null; try { ren = m ? new Function(m[0] + "; return _p5Renombra;")() : null; } catch (e) { ren = null; }
      out.push([!!ren && ren("cc_ubic", "EN PORTAL") === "PORTAL" && ren("cc_ubic", "EN PATIO INTERIOR") === "" && ren("cc_ubic", "BAJO ESCALERA") === "BAJO ESCALERA" && ren("comPunto1", "PATIO") === "" && ren("ac_ubic", "FACHADA LATERAL") === "" && ren("ac_ubic", "FACHADA TRASERA") === "FACHADA TRASERA", "lo guardado: «EN …» pasa al nombre nuevo y lo que ya no existe sale vacío", m ? "" : "(no está la función)"]);
      // la frase del armario en el impreso: igual con lo viejo («EN PORTAL») que con lo nuevo («PORTAL»)
      const cerr = p5.find((x, j) => j > 0 && String(x[2] || "").trim() === "O25-ARA/00213");
      // se cambia la casilla en todas las copias guardadas (columna G y foto congelada de la I, con su copia de la Toma de Datos)
      const pon = (o, valor) => { if (!o || typeof o !== "object") return; if (Array.isArray(o.vkv)) o.vkv.forEach((p) => { if (p && p[0] === "cc_ubic") p[1] = valor; }); if (Array.isArray(o.v) && o.v.length > 21) o.v[21] = valor; Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === "object" && k !== "v" && k !== "vkv") pon(o[k], valor); }); };
      const frase = async (valor) => {
        const viejo6 = cerr[6], viejo8 = cerr[8];
        for (const c of [6, 8]) { if (!cerr[c]) continue; const g = JSON.parse(cerr[c]); pon(g, valor); cerr[c] = JSON.stringify(g); }
        const h = String((await S.call("GET", "/plan5/presupuesto", { dir: cerr[0] })).body); cerr[6] = viejo6; cerr[8] = viejo8;
        return ((h.replace(/<[^>]+>/g, " ").match(/Se colocar[^,]*,[^,]*,/) || [])[0] || "").replace(/\s+/g, " ");
      };
      const fv = await frase("EN PORTAL"), fn = await frase("PORTAL"), fp = await frase("PATIO TRASERO"), fb = await frase("BAJO ESCALERA");
      out.push([/, en portal,$/.test(fv) && fv === fn, "armario: «EN PORTAL» (guardado) y «PORTAL» (nuevo) imprimen lo mismo", fv + " | " + fn]);
      out.push([/, en patio trasero,$/.test(fp) && /, bajo escalera,$/.test(fb), "armario: «en patio trasero» y «bajo escalera»", fp + " | " + fb]);
      return out;
    },
  },
  // ===== v146: FACHADA DERECHA / IZQUIERDA, sin «LATERAL» =====
  {
    nombre: "Sin «LATERAL» en menús y peines; un peine nuevo imprime «la fachada izquierda» y uno guardado con «lateral» imprime como antes",
    desde: "v146",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      const r = p5.find((x, j) => j > 0 && /ALBERCHE 6C/i.test(String(x[0] || "")));
      const html = String((await S.call("GET", "/plan5", { dir: r ? r[0] : "C Alberche 6C" })).body);
      const menus = (html.match(/<select id="(ac_ubic|cc_ubic)">[\s\S]*?<\/select>/g) || []).join(" ") + (html.match(/const OPT_(SUBE|BAJA)=\[[^\]]*\]/g) || []).join(" ");
      const m = html.match(/function _p5RenombraPeine\(v\)\{[^\n]*\}/);
      let ren = null; try { ren = m ? new Function(m[0] + "; return _p5RenombraPeine;")() : null; } catch (e) { ren = null; }
      // Sánchez Pizjuán 6 (enviado) tiene un peine «SUBE POR FACHADA LATERAL IZQUIERDA»: se imprime igual; con el nombre nuevo, sin «lateral»
      const sp = p5.find((x, j) => j > 0 && String(x[2] || "").trim() === "O25-ARA/00213");
      const texto = async () => String((await S.call("GET", "/plan5/presupuesto", { dir: sp[0] })).body).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const antes = await texto();
      const v6 = sp[6], v8 = sp[8];
      for (const c of [6, 8]) if (sp[c]) sp[c] = sp[c].split("SUBE POR FACHADA LATERAL IZQUIERDA").join("SUBE POR FACHADA IZQUIERDA");
      const nuevo = await texto(); sp[6] = v6; sp[8] = v8;
      return [
        [/FACHADA DERECHA/.test(menus) && /FACHADA IZQUIERDA/.test(menus) && !/LATERAL/.test(menus), "contador, armario y peines sin «LATERAL»", menus.match(/[A-Z ]*LATERAL[A-Z ]*/g) || ""],
        [!!ren && ren("SUBE POR FACHADA LATERAL IZQUIERDA") === "SUBE POR FACHADA IZQUIERDA" && ren("BAJA POR FACHADA LATERAL DERECHA") === "BAJA POR FACHADA DERECHA" && ren("SUBE POR PATIO TRASERO") === "SUBE POR PATIO TRASERO", "al reabrir, el peine pasa al nombre nuevo", m ? "" : "(no está la función)"],
        [/fachada lateral izquierda para subir/.test(antes), "Sánchez Pizjuán 6, guardado: imprime como antes («la fachada lateral izquierda»)", ""],
        [/buscando la fachada izquierda para subir/.test(nuevo) && !/fachada lateral izquierda/.test(nuevo), "con el nombre nuevo imprime «la fachada izquierda»", ""],
      ];
    },
  },
  // ===== banco (23/10/2026): los decimales del Sheet llegan con coma, como en producción =====
  {
    nombre: "Mediciones lee bien los precios con decimales (tubo PERT 32 a 1,5 €/m, sujeción a 0,22 €)",
    desde: "banco 23/10/2026",
    prueba: async (S) => {
      const p5 = S.DATA.plan5_toma_datos || [];
      const r = p5.find((x, j) => j > 0 && /ALBERCHE 6C/i.test(String(x[0] || "")));
      if (!r) return [[false, "está Alberche 6C en plan5_toma_datos", "no está"]];
      const j = (await S.call("GET", "/plan5/desglose", { dir: r[0], format: "json" })).body;
      const L = ((j && j.dsg && j.dsg.lineas) || []);
      const pr = (c, v) => { const l = L.find((x) => x.concepto === c && String(x.variante) === v); return l ? l.precio : "(no está)"; };
      const tubo = pr("Tubo distribución (PERT)", "32mm"), suj = pr("Sujección tuberías (PERT)", "32mm");
      return [
        [tubo === 1.5, "Tubo distribución (PERT) 32mm a 1,5", tubo],
        [suj === 0.22, "Sujección tuberías (PERT) 32mm a 0,22", suj],
      ];
    },
  },
  // ===== v149: Pedir contacto con su texto, verde lo de Guille, silencio a cortos y a «se lo mando ahora» =====
  {
    nombre: "Pedir contacto: la ventana enseña el mismo texto que sale por WhatsApp",
    desde: "v149",
    prueba: async (S) => {
      const iA = S.col("pisos", "bot_piso_activo");
      const f = S.DATA.pisos.find((x, i) => i > 0 && x[0] && x[1] && x[2] && String(x[iA >= 0 ? iA : 47]) === "BOT_WHATSAPP");
      if (!f) return [[false, "hay un piso en W", "ninguno"]];
      const q = { tel: f[0], comunidad: f[1], vivienda: f[2] };
      // sin red: Twilio contesta con el texto aprobado de plan5_contacto (lo que trae obtenerTextoTwilio)
      const https = require("https"), { EventEmitter } = require("events"), _req0 = https.request;
      const TXT = "Hola {{1}}, somos Instalaciones Araujo. Estamos gestionando en su comunidad el Plan 5 de EMASESA para la individualización de contadores de agua de su vivienda {{2}}. Responda *HOLA* a este mensaje.";
      https.request = (o, cb) => { if (!o || o.hostname !== "content.twilio.com") return _req0.apply(https, arguments); const rq = new EventEmitter(); rq.end = () => { const rs = new EventEmitter(); cb(rs); rs.emit("data", JSON.stringify({ types: { "twilio/text": { body: TXT } } })); rs.emit("end"); }; rq.setTimeout = () => rq; rq.destroy = () => {}; return rq; };
      const pv = (await S.call("GET", "/presupuestos/hoy/pedir-contacto-texto", q)).body || {};
      S.SENT.length = 0;
      const env = (await S.call("POST", "/presupuestos/hoy/pedir-contacto", q)).body || {};
      const m = S.SENT.find((x) => x.canal === "whatsapp");
      let vars = {}; try { vars = JSON.parse((m && m.contentVariables) || "{}"); } catch (e) {}
      return [
        [pv.ok === true && !!pv.texto, "la ruta devuelve el texto de la plantilla", JSON.stringify(pv)],
        [env.ok === true && !!m, "Pedir contacto se envía", JSON.stringify(env)],
        [!!m && pv.texto === TXT.replace("{{1}}", vars["1"]).replace("{{2}}", vars["2"]), "la ventana enseña exactamente lo que sale (nombre y vivienda)", (pv.texto || "") + " | enviado: " + JSON.stringify(vars)],
        [!!vars["2"] && /\(/.test(vars["2"]), "la vivienda va como «C Comunidad (piso)»", JSON.stringify(vars)],
      ];
    },
  },
  {
    nombre: "Conversación: lo que sale por decisión de Guille va en verde; lo del bot, en azul",
    desde: "v149",
    prueba: async (S) => {
      const tel = "+34600111222";
      const ahora = Date.now(), iso = (m) => new Date(ahora - m * 60000).toISOString();
      const bc = S.DATA.bot_contactos;
      bc.push([iso(50), tel, "presentacion", "bot", "Presentación del bot (plantilla presentacion)\n\nHola"]);
      bc.push([iso(40), tel, "job_presentacion", "bot", "reenvio presentacion"]);
      bc.push([iso(30), tel, "aviso_m:plan5_recordatorio_m1", "bot", "Recordatorio M1 (plantilla plan5_recordatorio_m1)\n\nHola"]);
      bc.push([iso(20), tel, "contacto_pedido", "bot", "Pedir contacto (plantilla plan5_contacto)\n\nHola"]);
      bc.push([iso(10), tel, "job_proactivo", "bot", "Recordatorio automático (plantilla recordatorio)\n\nHola"]);
      bc.push([iso(5), tel, "respuesta_equipo", "equipo", "Buenas"]);
      const r = (await S.call("GET", "/presupuestos/hoy/conversacion", { tel })).body || {};
      const it = (r.items || r.mensajes || []);
      const q = it.map((x) => x.quien).join(",");
      return [
        [q === "equipo,bot,equipo,equipo,bot,equipo", "presentación, aviso M, Pedir contacto y respuesta en verde; reenvío y recordatorio del bot en azul", q || JSON.stringify(r).slice(0, 300)],
      ];
    },
  },
  {
    nombre: "Bot (v158): con la ficha terminada solo contesta preguntas; «Estupendo, gracias» no se contesta nunca; «mañana lo mando» sí",
    desde: "v158",
    prueba: async (S) => {
      const iA = S.col("pisos", "bot_piso_activo");
      const f = S.DATA.pisos.find((x, i) => i > 0 && x[0] && String(x[iA >= 0 ? iA : 47]) === "BOT_WHATSAPP");
      const be = S.DATA.bot_expedientes, h = be[0];
      const fila = be.findIndex((x, i) => i > 0 && String(x[0]).replace(/\D/g, "").slice(-9) === String(f[0]).replace(/\D/g, "").slice(-9));
      if (!f || fila < 0) return [[false, "hay un vecino en W con ficha del bot", "ninguno"]];
      const iPaso = h.indexOf("paso_actual"), iDoc = h.indexOf("documento_actual"), iAD = 29, iAE = 30;
      const manda = async (texto, paso) => {
        be[fila][iPaso] = paso; if (paso === "recogida_documentacion" && !be[fila][iDoc]) be[fila][iDoc] = "dni_propietario_delante";
        be[fila][iAD] = ""; be[fila][iAE] = "";
        S.SENT.length = 0; let resp = "";
        const req = { method: "POST", body: { From: "whatsapp:" + f[0], Body: texto, NumMedia: "0", MessageSid: "SMb" + Math.random() }, query: {}, headers: {}, get: () => "", protocol: "https", originalUrl: "/whatsapp" };
        await new Promise((ok) => { const rr = { status() { return this; }, type() { return this; }, set() { return this; }, send(x) { resp = String(x || ""); ok(); return this; }, end() { ok(); return this; }, json() { ok(); }, sendStatus() { ok(); } }; Promise.resolve(S.routes["POST /whatsapp"](req, rr)).catch(() => ok()); });
        await S.espera(600);
        const bc = S.DATA.bot_contactos, u = bc[bc.length - 1] || [];
        return String(u[4] || "") + (S.SENT.length ? " [+" + S.SENT.length + " envío]" : "");
      };
      const r1 = await manda("1", "finalizado"), r2 = await manda("ok", "finalizado");
      const r3 = await manda("Aquí les envío el documento pendiente", "recogida_documentacion");
      const r4 = await manda("Mañana les mando el DNI", "recogida_documentacion");
      const r5 = await manda("Estupendo, gracias", "finalizado");   // caso Tharsis 5 3IZ
      const r6 = await manda("Estupendo, gracias", "recogida_documentacion");
      const r7 = await manda("El lunes paso por la oficina", "finalizado");
      const r8 = await manda("¿Cuándo empiezan las obras?", "finalizado");
      return [
        [r1 === "", "ficha terminada + «1»: sin respuesta", r1],
        [r2 === "", "ficha terminada + «ok»: sin respuesta", r2],
        [r3 === "", "«Aquí les envío el documento pendiente»: sin respuesta", r3],
        [/De acuerdo/.test(r4), "«Mañana les mando el DNI»: aviso, como antes", r4],
        [r5 === "", "ficha terminada + «Estupendo, gracias»: sin respuesta", r5],
        [r6 === "", "ficha sin terminar + «Estupendo, gracias»: sin respuesta", r6],
        [r7 === "", "ficha terminada + un aviso: sin «De acuerdo… cuando lo tenga»", r7],
        [/Lo vemos/.test(r8), "ficha terminada + pregunta: «Gracias por su mensaje. Lo vemos…»", r8],
      ];
    },
  },
  // ===== v150: firma del equipo en lo que escribe Guille por el bot =====
  {
    nombre: "Contestar por el bot: la firma viene escrita en el recuadro y se envía exactamente lo que hay en él (v150, cambiado en la v155)",
    desde: "v155",
    prueba: async (S) => {
      const FIRMA = "👨‍🔧 *Este mensaje es personalizado (no automático)*";
      const bp = S.DATA.bot_plantillas;
      bp.push(["firma_equipo", "vecino", "texto", FIRMA, "", "", "SI", "banco"]);
      const fila = bp[bp.length - 1];
      const tel = "+34600333444";
      S.DATA.bot_contactos.push([new Date(Date.now() - 3600 * 1000).toISOString(), tel, "Hola", "texto", ""]);   // escribio hace 1 h
      const bot = S.app.locals.botWhatsapp;
      const ultimo = () => { const bc = S.DATA.bot_contactos; return bc[bc.length - 1] || []; };
      S.SENT.length = 0;
      const r1 = await bot.responderVecino(tel, FIRMA + "\n\nLo tenemos todo, gracias");   // la firma ya va en el recuadro
      S.SENT.length = 0; await bot.responderVecino(tel, "Sin firma, la he borrado");
      const env0 = (S.SENT.find((m) => m.canal === "whatsapp") || {}).body || "";
      S.SENT.length = 0; await bot.responderVecino(tel, FIRMA + "\n\nLo tenemos todo, gracias");
      const env1 = (S.SENT.find((m) => m.canal === "whatsapp") || {}).body || "";
      const reg1 = String(ultimo()[4] || "");
      const conv = (await S.call("GET", "/presupuestos/hoy/conversacion", { tel })).body || {};
      fila[6] = "NO";
      await bot.pedirContacto(tel, { nombre: "Banco", vivienda: "C Banco (1A)" });   // relee las plantillas del Sheet (cache de 60 s)
      S.SENT.length = 0;
      const r2 = await bot.responderVecino(tel, "Otra prueba");
      const env2 = (S.SENT.find((m) => m.canal === "whatsapp") || {}).body || "";
      const flujo = String((await S.call("GET", "/presupuestos/plantillas-bot-flujo", {})).body || "");
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const iF = flujo.indexOf('data-clave="firma_equipo"'), trozo = iF >= 0 ? flujo.slice(iF, iF + 3000) : "";
      return [
        [r1 && r1.ok && env1 === FIRMA + "\n\nLo tenemos todo, gracias", "con la firma en el recuadro, sale una sola vez", JSON.stringify(env1)],
        [env0 === "Sin firma, la he borrado", "si la borras, sale sin firma (el bot no añade nada)", JSON.stringify(env0)],
        [/ta\.value = d\.firma \+/.test(hoy) && !/Se a\\u00f1ade arriba/.test(hoy), "la ventana pone la firma dentro del recuadro (no en una línea gris aparte)", ""],
        [trozo.indexOf("Este mensaje es personalizado") >= 0, "la tarjeta Firma del equipo de Flujo bot enseña su texto", iF < 0 ? "no está la tarjeta" : "vacía"],
        [reg1 === env1, "en la conversación queda igual que le llegó", JSON.stringify(reg1)],
        [conv.firma === FIRMA, "la ventana de contestar recibe la firma para escribirla en el recuadro", JSON.stringify(conv.firma)],
        [r2 && r2.ok && env2 === "Otra prueba", "con la firma apagada sale sin firma", JSON.stringify(env2)],
        [/firma_equipo/.test(flujo) && /Firma del equipo/.test(flujo), "Flujo bot tiene la tarjeta «Firma del equipo»", ""],
      ];
    },
  },
  // ===== v151: lo que sale por WhatsApp se ve antes, tal cual =====
  {
    nombre: "Vistas previas (presentación, cambio de tipo, contrato): enseñan el mensaje exacto y no envían nada",
    desde: "v151",
    prueba: async (S) => {
      const https = require("https"), { EventEmitter } = require("events"), _req0 = https.request;
      const TXT = "Hola {{1}} · {{2}} · {{3}}";
      https.request = (o, cb) => { if (!o || o.hostname !== "content.twilio.com") return _req0.apply(https, arguments); const rq = new EventEmitter(); rq.end = () => { const rs = new EventEmitter(); cb(rs); rs.emit("data", JSON.stringify({ types: { "twilio/text": { body: TXT } } })); rs.emit("end"); }; rq.setTimeout = () => rq; rq.destroy = () => {}; return rq; };
      const bot = S.app.locals.botWhatsapp, P = S.P();
      const be = S.DATA.bot_expedientes, t9 = (x) => String(x || "").replace(/\D/g, "").slice(-9);
      const conFicha = new Set(be.slice(1).map((r) => t9(r[0])));
      // un piso de una comunidad en 05, sin ficha del bot, y otro con ficha
      const comus = await P.leerComunidades();
      const c05 = comus.find((c) => P.normalizarFase(c.fase_presupuesto) === "05_DOCUMENTACION");
      const pis = S.DATA.pisos.slice(1).filter((r) => r && r[0] && (String(r[1]).trim() === String(c05.direccion).trim() || String(r[1]).trim() === String(c05.comunidad).trim()));
      const sin = pis.find((r) => !conFicha.has(t9(r[0]))), con = pis.find((r) => conFicha.has(t9(r[0])));
      S.SENT.length = 0; const antesLog = S.LOG.filter((x) => /^APPEND|^UPDATE/.test(x)).length;
      const out = [];
      if (sin) {
        const v = (await S.call("POST", "/documentacion/piso/vista-presentacion", { ccpp_id: c05.ccpp_id, vivienda: sin[2] })).body || {};
        out.push([v.ok === true && /^Hola /.test(v.vista || ""), "presentación: enseña el mensaje con su nombre", JSON.stringify(v)]);
      }
      if (con) {
        const v2 = (await S.call("POST", "/documentacion/piso/vista-presentacion", { ccpp_id: c05.ccpp_id, vivienda: con[2] })).body || {};
        out.push([v2.estado === "ya_presentado", "presentación: si ya tiene ficha lo dice (no se le volvería a mandar)", JSON.stringify(v2)]);
        const vt = (await S.call("POST", "/documentacion/piso/tipo-aviso", { ccpp_clave: c05.direccion, vivienda: con[2], ver: "1" })).body || {};
        out.push([vt.ok === true ? /^Hola /.test(vt.vista || "") : !!vt.error, "cambio de tipo: enseña el mensaje (o dice por qué no se puede)", JSON.stringify(vt)]);
        // la vista del cambio de tipo es la misma que el envio: se comparan las variables
        if (vt.ok) {
          S.SENT.length = 0;
          await bot.avisarCambioTipo({ comunidad: String(con[1]), vivienda: con[2] });
          const m = S.SENT.find((x) => x.canal === "whatsapp"); let vv = {}; try { vv = JSON.parse((m && m.contentVariables) || "{}"); } catch (e) {}
          out.push([vt.vista === TXT.replace("{{1}}", vv["1"]).replace("{{2}}", vv["2"]).replace("{{3}}", vv["3"]), "cambio de tipo: lo que se ve es lo que sale", vt.vista + " | " + JSON.stringify(vv)]);
          S.SENT.length = 0;
        }
      }
      const c08 = comus.find((c) => P.normalizarFase(c.fase_presupuesto) === "08_CYCP");
      if (c08) {
        // carpeta del expediente con el contrato y la carta de pago de un piso (Drive simulado)
        const pc = S.DATA.pisos.slice(1).find((r) => r && r[0] && (String(r[1]).trim() === String(c08.direccion).trim() || String(r[1]).trim() === String(c08.comunidad).trim()) && String(r[42] || "").toUpperCase() !== "OK" && !conFicha.has(t9(r[0])));
        if (pc) {
          const nomExp = ((c08.tipo_via ? c08.tipo_via + " " : "") + c08.direccion).trim();
          S.setDriveList((q) => /'CARP08' in parents/.test(q.q || "") ? [{ id: "PDF1", name: "CONTRATO (" + pc[2] + ").pdf", mimeType: "application/pdf" }, { id: "PDF2", name: "CARTA DE PAGO (" + pc[2] + ").pdf", mimeType: "application/pdf" }]
            : /google-apps\.folder/.test(q.q || "") ? [{ id: "CARP08", name: nomExp, mimeType: "application/vnd.google-apps.folder" }] : []);
          const vv8 = (await S.call("POST", "/documentacion/piso/enviar-contrato", { ccpp_id: c08.ccpp_id, vivienda: pc[2], ver: "1" })).body || {};
          const e8 = vv8.envio || {};
          out.push([e8.ok === true && /^Hola /.test(e8.vista || "") && /CONTRATO/.test(e8.archivo || ""), "contrato: enseña el mensaje y el PDF que va", JSON.stringify(e8).slice(0, 200)]);
          out.push([S.SENT.filter((x) => x.canal === "whatsapp").length === 0, "contrato: la vista no manda nada", S.SENT.length]);
          // el envio real necesita la libreria que junta los PDF (el banco no la tiene); vista y envio usan la misma cuenta (_varsC)
          S.SENT.length = 0; S.setDriveList(null);
        }
        const p8 = S.DATA.pisos.slice(1).find((r) => r && r[0] && (String(r[1]).trim() === String(c08.direccion).trim() || String(r[1]).trim() === String(c08.comunidad).trim()));
        const azAntes = c08.fecha_envio_contratos_pagos;
        const vc = (await S.call("POST", "/documentacion/piso/enviar-contrato", { ccpp_id: c08.ccpp_id, vivienda: p8 ? p8[2] : "", ver: "1" })).body || {};
        const c08b = (await P.leerComunidades()).find((c) => c.ccpp_id === c08.ccpp_id);
        out.push([!!vc.envio && (vc.envio.ok === true || !!vc.envio.error), "contrato: devuelve el mensaje o el motivo (sin enviar)", JSON.stringify(vc).slice(0, 200)]);
        out.push([String(c08b.fecha_envio_contratos_pagos || "") === String(azAntes || ""), "contrato: la vista no toca la fecha de envío de contratos", ""]);
      }
      out.push([S.SENT.filter((x) => x.canal === "whatsapp").length === 0, "ninguna vista manda un WhatsApp", S.SENT.length]);
      return out.length ? out : [[false, "hay comunidades en 05 con pisos", "no"]];
    },
  },
  // ===== v152: el M1/M2 de la 05 dice lo que falta =====
  {
    nombre: "Aviso M de la 05: el {{4}} dice qué documentos faltan",
    desde: "v152",
    prueba: async (S) => {
      let j = (await S.call("GET", "/presupuestos/hoy", { soloAvisosM: "1" })).body || {};
      let m05 = (j.avisos || []).filter((a) => /^plan5_recordatorio_m[12]$/.test(a.clave || "") && a.pendiente !== undefined);
      if (!m05.length) {   // con el Sheet de un día sin M1 pendientes: se quitan las marcas de M1 (en memoria) para que salgan
        S.DATA.bot_expedientes.slice(1).forEach((r) => { if (r) r[26] = ""; });
        const iAZ = 51; S.DATA.pisos.slice(1).forEach((r) => { if (r && r[iAZ]) r[iAZ] = String(r[iAZ]).replace(/(^|;)\s*M1=[^;]*/g, ""); });
        j = (await S.call("GET", "/presupuestos/hoy", { soloAvisosM: "1" })).body || {};
        m05 = (j.avisos || []).filter((a) => /^plan5_recordatorio_m[12]$/.test(a.clave || "") && a.pendiente !== undefined);
      }
      if (!m05.length) return [[false, "hay avisos M1/M2 por el bot", "ninguno"]];
      const conLista = m05.filter((a) => /^la documentación que falta de su vivienda \(.+\)$/.test(a.pendiente || ""));
      const NOMBRES = /^(Impreso toma datos|DNI del (propietario|familiar|inquilino|representante|pagador)|Impreso autorización usufructo|Libro de familia|Contrato de alquiler completo y firmado|Certificado de empadronamiento|NIF\/CIF de la sociedad|Escritura de constitución|Poderes del representante|Licencia de apertura o declaración responsable|Justificante de ingresos|Documento de titularidad bancaria)$/;
      const raros = [];
      conLista.forEach((a) => { const l = a.pendiente.replace(/^[^(]*\(/, "").replace(/\)$/, ""); l.split(/, | y (?=[A-ZÁÉÍÓÚ])/).forEach((n) => { if (!NOMBRES.test(n)) raros.push(a.vivienda + ": " + n); }); });
      const malos = m05.filter((a) => !/\(/.test(a.pendiente || "") && a.pendiente !== "la documentación de su vivienda");
      return [
        [conLista.length > 0, "algún aviso M lleva la lista de lo que falta", m05.map((a) => a.vivienda + "=" + a.pendiente).join(" | ").slice(0, 300)],
        [raros.length === 0, "la lista solo lleva nombres de documentos (con tildes)", raros.join(" | ")],
        [malos.length === 0 && m05.every((a) => !/[\n\r]/.test(a.pendiente || "")), "sin lista, el texto de siempre; nunca saltos de línea", malos.map((a) => a.pendiente).join(" | ")],
      ];
    },
  },
  // ===== v153: los documentos se llaman como su archivo (carpeta 000 PLANTILLA DOC P5) =====
  {
    nombre: "Los dos impresos se llaman como su archivo: aviso M, bot, ficha y adjunto",
    desde: "v153",
    prueba: async (S) => {
      const B = S.app.locals.botWhatsapp || {};
      const et = typeof B.etiquetaDocVecino === "function" ? B.etiquetaDocVecino : () => "(sin función)";
      const comus = await S.P().leerComunidades();
      const c05 = comus.find((c) => S.P().normalizarFase(c.fase_presupuesto) === "05_DOCUMENTACION");
      const html = c05 ? String((await S.call("GET", "/documentacion/expediente", { id: c05.ccpp_id })).body || "") : "";
      const fuente = require("fs").readFileSync(require("path").join(S.RAIZ, "bot-whatsapp.cjs"), "utf8");
      return [
        [et("solicitud_firmada") === "Impreso toma datos", "solicitud = «Impreso toma datos»", et("solicitud_firmada")],
        [et("autorizacion_familiar") === "Impreso autorización usufructo", "autorización = «Impreso autorización usufructo»", et("autorizacion_familiar")],
        [/label:'Impreso toma datos'/.test(html) && /label:'Impreso autorización usufructo'/.test(html) && !/Solicitud EMASESA/.test(html), "las pastillas de la ficha con los mismos nombres", c05 ? c05.direccion : "sin 05"],
        [/NOMBRE_MEDIA = \{ solicitud: "Impreso toma datos", autorizacion: "Impreso autorización usufructo" \}/.test(fuente), "el adjunto que manda el bot se llama igual", ""],
      ];
    },
  },
  // ===== v154: tampoco quedan «la solicitud» en lo que el bot le dice al vecino al rechazar =====
  {
    nombre: "Bot: los motivos de rechazo y la IA llaman «Impreso toma datos» al impreso",
    desde: "v154",
    prueba: async (S) => {
      const src = require("fs").readFileSync(require("path").join(S.RAIZ, "bot-whatsapp.cjs"), "utf8");
      const motivos = (src.match(/motivo(FinalPDF)?\s*[:=]\s*"[^"]*"/g) || []).filter((m) => /solicitud/i.test(m));
      return [
        [motivos.length === 0, "ningún motivo para el vecino dice «solicitud»", motivos.join(" | ").slice(0, 300)],
        [/AYUDA CON EL IMPRESO TOMA DATOS/.test(src) && !/AYUDA CON LA SOLICITUD/.test(src), "la IA llama al impreso por su nombre", ""],
      ];
    },
  },
  // ===== v156: horario de comunicaciones en dos tramos =====
  {
    nombre: "Horario de comunicaciones en dos tramos (9-15 y 17-20): el bot calla en medio y se guarda desde Flujo bot",
    desde: "v156",
    prueba: async (S) => {
      const M = require(require("path").join(S.RAIZ, "horario-bot.cjs"));
      const H = M.normalizarHorario("1,2,3,4,5", "09:00", "15:00", "17:00", "20:00");
      const en = (iso) => M.calcHorario(H, new Date(iso));   // 2026-10-23 es viernes; Madrid = UTC+2
      const a = en("2026-10-23T12:30:00Z"), b = en("2026-10-23T13:30:00Z"), c = en("2026-10-23T15:10:00Z"), e = en("2026-10-23T18:30:00Z");   // 14:30, 15:30, 17:10 y 20:30 en Madrid
      const uno = M.normalizarHorario("1,2,3,4,5", "09:00", "20:00", "", "");
      // guardado desde Flujo bot
      await S.call("POST", "/presupuestos/plantillas-bot/horario", { dias: ["1", "2", "3", "4", "5"], inicio: "09:00", fin: "15:00", inicio2: "17:00", fin2: "20:00" });
      const v = (k) => { const f = S.DATA.bot_plantillas.find((x) => x && x[0] === k); return f ? String(f[3]) : "(no está)"; };
      const flujo = String((await S.call("GET", "/presupuestos/plantillas-bot-flujo", {})).body || "");
      return [
        [a.dentro === true, "14:30 → dentro (primer tramo)", JSON.stringify(a)],
        [b.dentro === false && /a las 17:00/.test(b.texto), "15:30 → fuera, abre a las 17:00", JSON.stringify(b)],
        [c.dentro === true, "17:10 → dentro (segundo tramo)", JSON.stringify(c)],
        [e.dentro === false && /lun 26\/10 a las 9:00/.test(e.texto), "20:30 del viernes → fuera, abre el lunes a las 9:00", JSON.stringify(e)],
        [M.textoHorario(H) === "L-V 9:00-15:00 y 17:00-20:00", "el título dice los dos tramos", M.textoHorario(H)],
        [!uno.ini2 && M.textoHorario(uno) === "L-V 9:00-20:00", "sin segundo tramo, como antes", M.textoHorario(uno)],
        [v("horario_inicio2") === "17:00" && v("horario_fin2") === "20:00" && v("horario_fin") === "15:00", "Flujo bot guarda los dos tramos", v("horario_fin") + " / " + v("horario_inicio2") + "-" + v("horario_fin2")],
        [/name="inicio2"/.test(flujo) && /9:00-15:00 y 17:00-20:00/.test(flujo), "la tarjeta enseña los dos tramos", ""],
      ];
    },
  },
  // ===== v157: seguimiento de la fase como respuesta tipo, con los datos del momento =====
  {
    nombre: "Responder mail: «05-SEGUIMIENTO DOC» en el desplegable, con los datos de ahora y la fecha de la prórroga si la hay",
    desde: "v157",
    prueba: async (S) => {
      const P = S.P(), comus = await P.leerComunidades();
      const c05 = comus.find((c) => P.normalizarFase(c.fase_presupuesto) === "05_DOCUMENTACION");
      if (!c05) return [[false, "hay una comunidad en 05", "no"]];
      const html = String((await S.call("GET", "/documentacion/expediente", { id: c05.ccpp_id })).body || "");
      const sin = (await S.call("GET", "/presupuestos/plantilla-mail", { id: c05.ccpp_id, fase: "05_SEGUIMIENTO_DOC", manual: "1" })).body || {};
      const tSin = String((sin.plantilla || {}).mensaje || "");
      // prórroga concedida hasta el 20/11/2026
      const iF = S.col("comunidades", "fecha_ultimatum_ampliado"), iM = S.col("comunidades", "mails_enviados");
      const fila = S.DATA.comunidades.find((r, i) => i > 0 && r && String(r[1] || "").trim() === String(c05.direccion || "").trim());
      const antesF = fila[iF], antesM = fila[iM];
      let je = {}; try { je = JSON.parse(antesM || "{}") || {}; } catch (e) {}
      je.fecha_ultimatum_ampliado__HASTA = "2026-11-20"; delete je.fecha_ultimatum_ampliado__SKIP;
      fila[iF] = "2026-10-28"; fila[iM] = JSON.stringify(je);
      const con = (await S.call("GET", "/presupuestos/plantilla-mail", { id: c05.ccpp_id, fase: "05_SEGUIMIENTO_DOC", manual: "1" })).body || {};
      const auto = (await S.call("GET", "/presupuestos/plantilla-mail", { id: c05.ccpp_id, fase: "05_SEGUIMIENTO_DOC" })).body || {};
      fila[iF] = antesF; fila[iM] = antesM;
      const tCon = String((con.plantilla || {}).mensaje || ""), tAuto = String((auto.plantilla || {}).mensaje || "");
      return [
        [/<option value="seg">05-SEGUIMIENTO DOC<\/option>/.test(html), "la ficha en 05 tiene «05-SEGUIMIENTO DOC» en Insertar respuesta tipo", c05.direccion],
        [/hemos recibido el \d+%/.test(tSin) && !/\{\{/.test(tSin), "sale el correo con los datos de ahora, sin variables sin rellenar", tSin.slice(0, 120)],
        [/20\/11\/2026/.test(tCon), "con la prórroga, la fecha vigente (la de la prórroga)", (tCon.match(/Fecha l[ií]mite[^\n]*/) || [""])[0]],
        [!/20\/11\/2026/.test(tAuto), "el automático no cambia (sigue con el plazo inicial)", (tAuto.match(/Fecha l[ií]mite[^\n]*/) || [""])[0]],
      ];
    },
  },
  // ===== v159: todas las ventanas de envío por el bot dicen con quién se habla =====
  {
    nombre: "Ventanas de envío por el bot: debajo del título, «Comunidad Piso · Nombre» como en el ro-botón",
    desde: "v159",
    prueba: async (S) => {
      const iA = S.col("pisos", "bot_piso_activo");
      const f = S.DATA.pisos.find((x, i) => i > 0 && x[0] && x[1] && x[2] && x[4] && String(x[iA >= 0 ? iA : 47]) === "BOT_WHATSAPP");
      if (!f) return [[false, "hay un piso en W con nombre", "ninguno"]];
      const d = (await S.call("GET", "/presupuestos/hoy/conversacion", { tel: f[0] })).body || {};
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const v = d.vecino || {};
      return [
        [v.comunidad === String(f[1]).trim() && v.vivienda === String(f[2]).trim() && !!v.nombre, "la conversación dice comunidad, piso y nombre de la ficha", JSON.stringify(v)],
        [/data-sub="1"[^>]*min-height/.test(hoy) && /d\.vecino\.comunidad \+ ' ' \+ d\.vecino\.vivienda/.test(hoy), "la ventana común de envío tiene la línea y la rellena", ""],
      ];
    },
  },
  // ===== v160: ventanas de envío iguales, sin texto que repita el mensaje =====
  {
    nombre: "Ventanas de envío: título, con quién, conversación y mensaje; sin la pregunta que repite lo que ya dice el mensaje",
    desde: "v160",
    prueba: async (S) => {
      const P = S.P(), comus = await P.leerComunidades();
      const c05 = comus.find((c) => P.normalizarFase(c.fase_presupuesto) === "05_DOCUMENTACION");
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const ficha = c05 ? String((await S.call("GET", "/documentacion/expediente", { id: c05.ccpp_id })).body || "") : "";
      const repes = (hoy + ficha).match(/[¿\\u00bf]+Enviar (AHORA )?por el bot[^']{0,60}/g) || [];
      return [
        [repes.length === 0, "ninguna ventana de envío pregunta «¿Enviar AHORA por el bot…?»", repes.slice(0, 3).join(" | ")],
        [/ptlConfirmarEnvio\('', 'Pedir contacto'/.test(hoy), "Pedir contacto: sin texto extra", ""],
        [/'Aviso de cambio de tipo'/.test(ficha) && /'Presentación'/.test(ficha), "cada ventana de la ficha lleva su título", ""],
      ];
    },
  },
  // ===== v161: saludo «Hola <de arriba> (Titular - <Nota simple>)», una regla para todos =====
  {
    nombre: "Saludo al vecino: el de arriba y, si no es el titular, «(Titular - …[ y otros])»; igual en HOY y en el bot",
    desde: "v161",
    prueba: async (S) => {
      const P = S.P(), B = S.app.locals.botWhatsapp || {};
      const dir = (n, b, t) => (P._p5NombreDirigido ? P._p5NombreDirigido(n, b, t) : "(sin función)");
      const fuente = require("fs").readFileSync(require("path").join(S.RAIZ, "bot-whatsapp.cjs"), "utf8");
      const a = fuente.indexOf("function limpiarNombreVecino"), b = fuente.indexOf("\n}", a);
      const limpiar = new Function(fuente.slice(a, b + 2) + "; return limpiarNombreVecino;")();
      const d1 = dir("Enrique José Pérez de la Rosa Ruiz / José Antonio Pérez de la Rosa Ruiz", "David", "propietario");
      const d2 = dir("José Luis Silva Isla", "Raquel Silva León", "familiar");
      const d3 = dir("Carlos Blanco Molina / Alejandra del Rocío Crego Molina", "Carlos Blanco", "propietario");
      const d4 = dir("", "David", "");
      return [
        [d1 === "David (Titular - Enrique José Pérez de la Rosa Ruiz y otros)", "no titular, varios titulares", d1],
        [d2 === "Raquel Silva León (Titular - José Luis Silva Isla)", "familiar (usufructo): también con el titular", d2],
        [d3 === "Carlos Blanco", "el de arriba es el titular: solo su nombre", d3],
        [d4 === "David", "sin Nota simple: el de arriba", d4],
        [limpiar(d1) === d1, "el bot no le quita el «(Titular - …)» al limpiar el nombre", limpiar(d1)],
      ];
    },
  },
  // ===== v162: mientras habla Guille, el bot no se mete =====
  {
    nombre: "Bot: si lo último que recibió el vecino es de Guille (< 24 h), el bot no contesta a lo que escribe; va a Pide ayuda",
    desde: "v162",
    prueba: async (S) => {
      const iA = S.col("pisos", "bot_piso_activo");
      const f = S.DATA.pisos.find((x, i) => i > 0 && x[0] && String(x[iA >= 0 ? iA : 47]) === "BOT_WHATSAPP");
      const be = S.DATA.bot_expedientes, h = be[0];
      const fila = be.findIndex((x, i) => i > 0 && String(x[0]).replace(/\D/g, "").slice(-9) === String(f[0]).replace(/\D/g, "").slice(-9));
      if (!f || fila < 0) return [[false, "hay un vecino en W con ficha del bot", "ninguno"]];
      const iPaso = h.indexOf("paso_actual"), iDoc = h.indexOf("documento_actual");
      const bc = S.DATA.bot_contactos;
      const manda = async (texto) => {
        be[fila][iPaso] = "recogida_documentacion"; if (!be[fila][iDoc]) be[fila][iDoc] = "dni_propietario_delante";
        be[fila][28] = ""; be[fila][29] = ""; be[fila][30] = "";
        S.SENT.length = 0;
        const req = { method: "POST", body: { From: "whatsapp:" + f[0], Body: texto, NumMedia: "0", MessageSid: "SMg" + Math.random() }, query: {}, headers: {}, get: () => "", protocol: "https", originalUrl: "/whatsapp" };
        await new Promise((ok) => { const rr = { status() { return this; }, type() { return this; }, set() { return this; }, send() { ok(); return this; }, end() { ok(); return this; }, json() { ok(); }, sendStatus() { ok(); } }; Promise.resolve(S.routes["POST /whatsapp"](req, rr)).catch(() => ok()); });
        await S.espera(600);
        const u = bc[bc.length - 1] || [];
        return { resp: String(u[4] || ""), ayuda: String(be[fila][28] || "") };
      };
      const guille = (horas) => bc.push([new Date(Date.now() - horas * 3600 * 1000).toISOString(), f[0], "respuesta_equipo", "equipo", "Buenas, ¿qué necesita?"]);
      guille(0.1);
      const r1 = await manda("¿Qué necesita usted?");
      guille(0.1);
      const r2 = await manda("Ok");
      guille(0.1);
      const r3 = await manda("Mañana se lo mando");
      for (let i = bc.length - 1; i > 0; i--) if (bc[i] && bc[i][2] === "respuesta_equipo" && String(bc[i][1]) === String(f[0])) bc.splice(i, 1);
      guille(30);   // el único mensaje de Guille, hace más de 24 h
      const r4 = await manda("¿Cuándo empiezan las obras?");
      return [
        [r1.resp === "" && /Qué necesita usted/.test(r1.ayuda), "pregunta tras un mensaje de Guille: sin respuesta del bot y a Pide ayuda", JSON.stringify(r1)],
        [r2.resp === "", "«Ok» tras un mensaje de Guille: sin respuesta", JSON.stringify(r2)],
        [r3.resp === "" && /Mañana/.test(r3.ayuda), "aviso tras un mensaje de Guille: sin «De acuerdo…» y a Pide ayuda", JSON.stringify(r3)],
        [/Lo vemos/.test(r4.resp), "si el mensaje de Guille tiene más de 24 h, el bot vuelve a contestar", JSON.stringify(r4)],
      ];
    },
  },
  // ===== v163: puertas de los montantes actuales respetando cada peine =====
  {
    nombre: "Presupuesto: «Los de las puertas A-D y B-C…» respeta las puertas de cada peine tal como se escriben (Francisco Meneses 4: un peine A-D y otro B-C); Sánchez Pizjuán 6 igual",
    desde: "v163",
    prueba: async (S) => {
      const abast = async (re) => { const r = S.DATA.plan5_toma_datos.find((x, j) => j > 0 && re.test(String(x[0] || ""))); if (!r) return "(no está)"; const h = String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body || ""); const m = h.match(/ABASTECIMIENTO ACTUAL:<\/b><br>([^<]*)/); return m ? m[1].replace(/\s+/g, " ").trim() : "?"; };
      const fm = await abast(/FRANCISCO MENESES 4/i), sp = await abast(/S[AÁ]NCHEZ PIZJU[AÁ]N 6/i);
      return [
        [/Los de las puertas A-D y B-C son exteriores y enganchan en cocinas\./.test(fm), "Francisco Meneses 4: puertas por peine", fm],
        [/Los de las puertas 1, 2, 3 y 4 son exteriores y enganchan en cocinas\./.test(sp), "Sánchez Pizjuán 6 (enviado) no cambia", sp],
      ];
    },
  },
  // ===== v164: condiciones particulares justificadas =====
  {
    nombre: "Presupuesto: las condiciones particulares (en rojo) van justificadas, como las cláusulas",
    desde: "v164",
    prueba: async (S) => {
      const r = S.DATA.plan5_toma_datos.find((x, j) => j > 0 && /FRANCISCO MENESES 4/i.test(String(x[0] || "")));
      if (!r) return [[false, "está Francisco Meneses 4 en plan5_toma_datos", "no"]];
      const h = String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body || "");
      const css = (h.match(/\.condpart\{[^}]*\}/) || [""])[0];
      return [
        [/text-align:\s*justify/.test(css), "el estilo de las condiciones particulares justifica el texto", css],
        [/class="condpart">[^<]*supeditado/.test(h), "las condiciones de Francisco Meneses 4 salen en el impreso", ""],
      ];
    },
  },
  // ===== v165: autorización de paso aunque la frase no acabe en punto =====
  {
    nombre: "Presupuesto: sale la «Autorización paso de instalaciones» aunque detrás de «su propiedad» no haya punto (Francisco Meneses 4 «(garage)»)",
    desde: "v165",
    prueba: async (S) => {
      const docs = async (re) => { const r = S.DATA.plan5_toma_datos.find((x, j) => j > 0 && re.test(String(x[0] || ""))); if (!r) return -1; const h = String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body || ""); return (h.match(/class="sheet legal gpdoc"/g) || []).length; };
      const fm = await docs(/FRANCISCO MENESES 4/i), sp = await docs(/S[AÁ]NCHEZ PIZJU[AÁ]N 6/i), bl = await docs(/BALLENA 6/i);
      return [
        [fm === 2, "Francisco Meneses 4: grupo de presión + autorización de paso (2 documentos)", fm],
        [sp === 1, "Sánchez Pizjuán 6 (enviado) no cambia", sp],
        [bl === 2, "Ballena 6 (frase con punto) sigue igual", bl],
      ];
    },
  },
  // ===== v166: grupo de presión más corto y tabla más compacta =====
  {
    nombre: "Presupuesto: «2 bombas 2,53Kw + calderín 300L» (más corto); filas de la tabla con su medida de siempre (Doctor Jaime Marcos 3)",
    desde: "v166",
    prueba: async (S) => {
      const r = S.DATA.plan5_toma_datos.find((x, j) => j > 0 && /JAIME MARCOS 3/i.test(String(x[0] || "")));
      if (!r) return [[false, "está Doctor Jaime Marcos 3 en plan5_toma_datos", "no"]];
      const h = String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body || "");
      const gp = (h.match(/\d+ bombas? [^<]*/) || [""])[0];
      return [
        [gp === "2 bombas 2,53Kw + calderín 300L", "texto corto del grupo de presión", gp],
        [/table\.ptab td\{ padding:0\.8px 4px/.test(h) && /table\.ptab\{[^}]*line-height:1\.05;/.test(h), "las filas de la tabla con la medida de siempre (v167: Guille no quiso juntarlas)", ""],
      ];
    },
  },
  // ===== v168: depósitos reutilizados con cantidad 0 =====
  {
    nombre: "Presupuesto: los depósitos que se reutilizan salen con cantidad 0, como el grupo actual (Doctor Jaime Marcos 3: «2 depósitos de 1000L»)",
    desde: "v168",
    prueba: async (S) => {
      const r = S.DATA.plan5_toma_datos.find((x, j) => j > 0 && /JAIME MARCOS 3/i.test(String(x[0] || "")));
      if (!r) return [[false, "está Doctor Jaime Marcos 3 en plan5_toma_datos", "no"]];
      // Por si la copia del Sheet lo tiene cerrado (sirve la foto guardada): se quita la foto en memoria para calcularlo de nuevo
      const antes = r[6], antes8 = r[8]; let sv = {}; try { sv = JSON.parse(r[6]); } catch (e) {}
      delete sv.snapshot; sv.estado = "abierto"; r[6] = JSON.stringify(sv); r[8] = "";
      let h = ""; try { h = String((await S.call("GET", "/plan5/presupuesto", { dir: r[0] })).body || ""); } finally { r[6] = antes; r[8] = antes8; }
      const i = h.indexOf("3.4 Dep"), fila = i < 0 ? "" : h.slice(i, h.indexOf("</tr>", i));
      const celdas = fila.replace(/<[^>]*>/g, "|").split("|").map(x => x.trim()).filter(Boolean);
      return [
        [celdas.indexOf("2 depósitos de 1000L") >= 0, "la descripción sigue diciendo lo que hay", celdas.join(" / ")],
        [celdas.indexOf("0 ud") >= 0, "cantidad «0 ud», no «2 ud»", celdas.join(" / ")],
      ];
    },
  },
  // ===== v170: botón «💬 Respuestas tipo» en Contestar por el bot; «📧 Respuestas tipo» en el correo =====
  {
    nombre: "Contestar por el bot: botón «💬 Respuestas tipo» con «Nota simple (titular distinto)» ya relleno (Malvaloca 1 5A); el correo dice «📧 Respuestas tipo»",
    desde: "v170",
    prueba: async (S) => {
      const fs = require("fs"), path = require("path");
      const f = S.DATA.pisos.find((x, i) => i > 0 && /malvaloca 1/i.test(String(x[1] || "")) && String(x[2] || "").trim().toUpperCase() === "5A");
      if (!f) return [[false, "está Malvaloca 1 5A en pisos", "no"]];
      const d = (await S.call("GET", "/presupuestos/hoy/conversacion", { tel: f[0] })).body || {};
      const rt = (d.respTipo || [])[0] || {};
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const src = fs.readFileSync(path.join(S.RAIZ, "presupuestos.cjs"), "utf8");
      const iBtn = hoy.indexOf("data-rtipo"), iAdj = hoy.indexOf("data-adjbtn=") > 0 ? hoy.indexOf("data-adjbtn=") : hoy.indexOf("data-adjpc=");
      return [
        [rt.nombre === "Nota simple (titular distinto)", "la respuesta tipo se llama «Nota simple (titular distinto)»", JSON.stringify(rt.nombre)],
        [/figura a nombre de Rafael Santisteban Conejo y M\S* Esperanza Nogales Delgado\./.test(rt.texto || "") && /^Buenas Rosa/.test(rt.texto || "") && /Muchas gracias\.$/.test(rt.texto || ""), "texto relleno con su nombre y los dos titulares (v174: ya sin «con ellos»)", rt.texto],
        [iBtn > 0 && iAdj > 0 && iBtn < iAdj && hoy.indexOf('"icoWa":"💬"') > 0, "el botón va a la izquierda de Adjuntar, con el 💬 de estilo-visual", iBtn + " / " + iAdj],
        [src.indexOf('<label class="ptl-form-label">${ICONO_MAIL} Respuestas tipo</label>') > 0 && src.indexOf("Insertar respuesta tipo</label>") < 0, "en el correo, «📧 Respuestas tipo» (antes «Insertar respuesta tipo»)", ""],
      ];
    },
  },
  // ===== v171: un solo «📎 Adjuntar» con su lista =====
  {
    nombre: "Contestar por el bot: un solo botón «📎 Adjuntar» con «Desde mi PC… / Impreso toma datos / Documento personalizado…» (antes 3 botones)",
    desde: "v171",
    prueba: async (S) => {
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const i = hoy.indexOf("data-amenu"), menu = i < 0 ? "" : hoy.slice(i, hoy.indexOf("</div></span>", i));
      const op = (menu.match(/data-aitem="1"[^>]*>[^<]*</g) || []).map(x => x.replace(/^[^>]*>|<$/g, ""));
      return [
        [/data-adjbtn="1"[^>]*>\\uD83D\\uDCCE Adjuntar</.test(hoy), "hay un botón «📎 Adjuntar»", ""],
        [JSON.stringify(op) === JSON.stringify([hoy.indexOf("Desde mi dispositivo o Drive") > 0 ? "Desde mi dispositivo o Drive\\u2026" : "Desde mi PC\\u2026", "Impreso toma datos", "Documento personalizado\\u2026"]), "su lista, en este orden: Desde mi PC… / Impreso toma datos / Documento personalizado…", JSON.stringify(op)],
        [!/class="ptl-btn[^"]*"[^>]*data-fijo=/.test(hoy) && !/\\uDCC4 documento<\/button>/.test(hoy), "ya no están los botones sueltos «Impreso toma datos» y «📄 documento»", ""],
      ];
    },
  },
  // ===== v172: la respuesta tipo de la Nota simple, con espacios =====
  {
    nombre: "Respuesta tipo «Nota simple (titular distinto)» con una línea en blanco entre cada parte (Malvaloca 1 5A)",
    desde: "v172",
    prueba: async (S) => {
      const f = S.DATA.pisos.find((x, i) => i > 0 && /malvaloca 1/i.test(String(x[1] || "")) && String(x[2] || "").trim().toUpperCase() === "5A");
      if (!f) return [[false, "está Malvaloca 1 5A en pisos", "no"]];
      const rt = (((await S.call("GET", "/presupuestos/hoy/conversacion", { tel: f[0] })).body || {}).respTipo || [])[0] || {};
      const partes = String(rt.texto || "").split("\n\n");
      return [
        [partes.length >= 4 && /^Buenas Rosa.*,$/.test(partes[0]) && /^Gracias por la documentaci/.test(partes[1]) && /^¿Nos p/.test(partes[2]) && partes[partes.length - 1] === "Muchas gracias.", "en párrafos: saludo / lo que pasa / la pregunta / … / Muchas gracias.", JSON.stringify(rt.texto)],
      ];
    },
  },
  // ===== v173: «Desde mi dispositivo o Drive…» sin filtro de tipo en el selector =====
  {
    nombre: "Adjuntar: «Desde mi dispositivo o Drive…» abre el selector completo (sin accept, para que la tablet enseñe Drive) y el tipo se comprueba al elegir",
    desde: "v173",
    prueba: async (S) => {
      const hoy = String((await S.call("GET", "/presupuestos/hoy", {})).body || "");
      const i = hoy.indexOf("data-amenu"), menu = i < 0 ? "" : hoy.slice(i, hoy.indexOf("</div></span>", i));
      return [
        [/data-adjpc="1"[^>]*>Desde mi dispositivo o Drive\\u2026</.test(menu), "la primera opción se llama «Desde mi dispositivo o Drive…»", ""],
        [/<input type="file" style="display:none">/.test(hoy) && !/<input type="file" accept=".pdf,.jpg/.test(hoy), "el selector de archivos no lleva filtro de tipo", ""],
        [/\}\)\[_ext\]/.test(hoy), "si el selector no da el tipo, lo saca de la extensión", ""],
      ];
    },
  },
  // ===== v174: pregunta con pistas; otra si el titular es una sociedad =====
  {
    nombre: "Respuesta tipo «Nota simple (titular distinto)»: «familiar suyo, heredero, inquilino o compra reciente» (Malvaloca 1 5A) y, si el titular es una sociedad, «administrador o representante» (Malvaloca 1 4C, Honeykiss SL)",
    desde: "v174",
    prueba: async (S) => {
      const piso = (v) => S.DATA.pisos.find((x, i) => i > 0 && /malvaloca 1/i.test(String(x[1] || "")) && String(x[2] || "").trim().toUpperCase() === v);
      const rt = async (f) => f ? ((((await S.call("GET", "/presupuestos/hoy/conversacion", { tel: f[0] })).body || {}).respTipo || [])[0] || {}).texto || "" : "";
      const a = await rt(piso("5A")), b = await rt(piso("4C"));
      let NV = {}; try { NV = require(require("path").join(S.RAIZ, "nombre-vecino.cjs")); } catch (e) {}
      const soc = typeof NV.esSociedad === "function" ? ["Honeykiss SL", "Inmo Momentos, S.L.", "Building Center S.A.", "Promontoria MACC RE SOCIMI, S.A."].every(NV.esSociedad) && !["Rafael Santisteban Conejo", "Mª Esperanza Nogales Delgado", "Ana Sala Salas", "Luis Casal"].some(NV.esSociedad) : false;
      return [
        [/¿Nos podría comentar si es usted familiar suyo, heredero, inquilino o si ha comprado la vivienda hace poco\? Así le indicamos qué documentación hace falta\./.test(a), "persona: la pregunta con pistas", JSON.stringify(a)],
        [/a nombre de la sociedad Honeykiss SL\./.test(b) && /administrador o representante de la sociedad, o inquilino\?/.test(b), "sociedad: «a nombre de la sociedad…» y «administrador o representante»", JSON.stringify(b)],
        [soc, "reconoce las sociedades (S.L., S.A., SOCIMI) y no confunde a las personas", ""],
      ];
    },
  },
];

module.exports = { CASOS, scriptsRotos };
