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
];

module.exports = { CASOS, scriptsRotos };
