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
    nombre: "Bot: con la ficha terminada no contesta «1» ni «ok»; «aquí les envío…» no se contesta; «mañana lo mando» sí",
    desde: "v149",
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
      return [
        [r1 === "", "ficha terminada + «1»: sin respuesta", r1],
        [r2 === "", "ficha terminada + «ok»: sin respuesta", r2],
        [r3 === "", "«Aquí les envío el documento pendiente»: sin respuesta", r3],
        [/De acuerdo/.test(r4), "«Mañana les mando el DNI»: aviso, como antes", r4],
      ];
    },
  },
];

module.exports = { CASOS, scriptsRotos };
