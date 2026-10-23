// ===================================================================
// BANCO DE PRUEBAS — simulador (de Guille/Claudia; Alberto no lo usa)
// ===================================================================
// Carga NUESTROS cuatro ficheros (presupuestos.cjs, presupuestos_plan5.cjs,
// documentacion.cjs y bot-whatsapp.cjs), en el mismo orden que index.cjs,
// con un Sheet simulado en memoria sacado del Excel de Guille. Sin red:
// Google, correo, Twilio y el resto de librerías externas están simulados,
// y los temporizadores largos (crons) no corren. Nada sale del ordenador.
//
// Se usa desde correr.cjs (cada caso en un proceso propio, con los datos
// recién cargados). Explicación completa: §7.3 del manual.
// ===================================================================
"use strict";
const Module = require("module");
const path = require("path");
const fs = require("fs");

const RAIZ = process.env.BANCO_RAIZ ? path.resolve(process.env.BANCO_RAIZ) : path.resolve(__dirname, "..");
const DATOS = process.env.BANCO_DATOS || path.join(__dirname, "datos", "sheet.json");

function crear() {
  if (!fs.existsSync(DATOS)) {
    throw new Error("Falta " + DATOS + ": baja el Excel del Sheet y pásalo por excel-a-json.py (§7.3 del manual).");
  }
  const DATA = JSON.parse(fs.readFileSync(DATOS, "utf8"));
  const LOG = [];    // lecturas y escrituras del Sheet, correos y WhatsApp, por orden
  const SENT = [];   // correos y WhatsApp que habrían salido
  // Sin red no se pueden comprobar los enlaces de Drive de los adjuntos fijos.
  { const mp = DATA.mail_plantillas || [], h = mp[0] || [], ia = h.indexOf("adjuntos_fijos"); mp.forEach((r, i) => { if (i && ia >= 0) r[ia] = ""; }); }

  // ---------- Sheet simulado ----------
  const colNum = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  function parseRange(r) {
    const m = String(r).match(/^'?([^'!]+)'?(?:!([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?)?$/);
    if (!m) throw new Error("rango raro " + r);
    return {
      tab: m[1],
      c1: m[2] ? colNum(m[2]) : 0,
      r1: m[3] ? +m[3] - 1 : 0,
      c2: m[4] ? colNum(m[4]) : (m[2] && !m[4] && m[3] ? colNum(m[2]) : 999),
      r2: m[5] ? +m[5] - 1 : (m[3] && !m[4] && !m[5] ? +m[3] - 1 : 999999),
    };
  }
  const tab = (t) => { if (!DATA[t]) DATA[t] = []; return DATA[t]; };
  function get(range) {
    const p = parseRange(range), rows = tab(p.tab), out = [];
    for (let i = p.r1; i <= Math.min(p.r2, rows.length - 1); i++) out.push((rows[i] || []).slice(p.c1, p.c2 + 1));
    while (out.length && !out[out.length - 1].some((x) => x !== "" && x != null)) out.pop();
    return out;
  }
  function put(range, values) {
    const p = parseRange(range), rows = tab(p.tab);
    LOG.push("PUT " + range);
    values.forEach((vr, i) => {
      const ri = p.r1 + i; while (rows.length <= ri) rows.push([]);
      vr.forEach((v, j) => { const ci = p.c1 + j; while (rows[ri].length <= ci) rows[ri].push(""); rows[ri][ci] = v == null ? "" : String(v); });
    });
  }
  const sheetsApi = {
    spreadsheets: {
      get: async () => ({ data: { sheets: Object.keys(DATA).map((t, i) => ({ properties: { title: t, sheetId: i } })) } }),
      batchUpdate: async () => ({ data: {} }),
      values: {
        get: async ({ range }) => { LOG.push("GET " + range); return { data: { values: get(range) } }; },
        batchGet: async ({ ranges }) => { ranges.forEach((r) => LOG.push("GET " + r)); return { data: { valueRanges: ranges.map((r) => ({ range: r, values: get(r) })) } }; },
        update: async ({ range, requestBody }) => { put(range, requestBody.values); return { data: {} }; },
        batchUpdate: async ({ requestBody }) => { (requestBody.data || []).forEach((d) => put(d.range, d.values)); return { data: {} }; },
        append: async ({ range, requestBody }) => { const p = parseRange(range); const rows = tab(p.tab); requestBody.values.forEach((v) => rows.push(v.map((x) => (x == null ? "" : String(x))))); LOG.push("APPEND " + p.tab); return { data: {} }; },
        clear: async ({ range }) => { LOG.push("CLEAR " + range); return { data: {} }; },
      },
    },
  };

  // ---------- Librerías externas simuladas ----------
  const stubAny = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : stubAny()), apply: () => stubAny(), construct: () => stubAny() });
  // Drive simulado: sin carpetas ni archivos (23/10/2026: con un objeto vacío, buscar los PDF de un piso no terminaba)
  //   Un caso puede poner sus carpetas y PDF con setDriveList(fn): fn(params de files.list) -> lista de archivos.
  let _driveList = () => [];
  const driveApi = new Proxy({}, { get: (t, k) => (k === "files" ? new Proxy({}, { get: (t2, k2) => (k2 === "list" ? async (p) => ({ data: { files: (await _driveList(p || {})) || [] } }) : (k2 === "get" ? async () => ({ data: Buffer.from("%PDF-banco") }) : stubAny())) }) : stubAny()) });
  const setDriveList = (fn) => { _driveList = fn || (() => []); };
  const googleapis = { google: { sheets: () => sheetsApi, drive: () => driveApi, auth: { OAuth2: function () { this.setCredentials = () => {}; }, GoogleAuth: function () { this.getClient = async () => ({}); } } } };
  const twilio = function () {
    return {
      messages: { create: async (m) => { SENT.push(Object.assign({ canal: "whatsapp" }, m)); LOG.push("TWILIO " + (m.contentSid || "texto")); return { sid: "SMbanco" + SENT.length }; } },
      content: { v1: { contents: () => ({ fetch: async () => ({ types: { "twilio/text": { body: "Hola {{1}}" } } }) }) } },
    };
  };
  twilio.twiml = { MessagingResponse: function () { this.message = () => ({}); this.toString = () => "<Response/>"; } };
  const nodemailer = { createTransport: () => ({ sendMail: async (o) => { LOG.push("MAIL " + o.subject); SENT.push(Object.assign({ canal: "correo" }, o)); return { messageId: "<banco" + SENT.length + "@banco>" }; }, verify: async () => true }) };
  const origLoad = Module._load;
  Module._load = function (req) {
    if (req === "googleapis") return googleapis;
    if (req === "nodemailer") return nodemailer;
    if (req === "twilio") return twilio;
    if (["imapflow", "mailparser", "axios", "multer", "pdf-lib", "express", "node-unrar-js", "sharp", "openai"].includes(req)) return stubAny();
    try { return origLoad.apply(this, arguments); }
    catch (e) { if (e && e.code === "MODULE_NOT_FOUND" && !req.startsWith(".")) return stubAny(); throw e; }
  };

  // ---------- Sin crons ----------
  const _st = global.setTimeout;
  global.setInterval = () => ({ unref() {} });
  global.setTimeout = (fn, ms, ...a) => (ms && ms > 5000 ? { unref() {} } : _st(fn, ms, ...a));

  Object.assign(process.env, {
    ADMIN_TOKEN: "t", GOOGLE_SHEETS_ID: "banco", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x",
    TWILIO_WHATSAPP_NUMBER: "+34600000000", OPENAI_API_KEY: "",
  });

  // ---------- app de Express simulada ----------
  const routes = {};
  const app = { locals: {}, use() {}, set() {}, get(p, ...h) { [].concat(p).forEach((x) => (routes["GET " + x] = h[h.length - 1])); }, post(p, ...h) { [].concat(p).forEach((x) => (routes["POST " + x] = h[h.length - 1])); } };
  // Mismo orden que index.cjs: presupuestos -> plan5 -> documentacion -> bot
  for (const f of ["presupuestos.cjs", "presupuestos_plan5.cjs", "documentacion.cjs", "bot-whatsapp.cjs"]) {
    require(path.join(RAIZ, f))(app);
  }

  function call(method, p, datos) {
    return new Promise((resolve) => {
      const h = routes[method + " " + p];
      if (!h) return resolve({ status: 404, body: "ruta no existe: " + method + " " + p });
      const res = {
        _s: 200, _h: {},
        status(s) { this._s = s; return this; }, json(o) { resolve({ status: this._s, body: o }); },
        send(o) { resolve({ status: this._s, body: o }); }, redirect(a, b) { resolve({ status: 302, body: b || a }); },
        setHeader(k, v) { this._h[k] = v; }, set() { return this; }, type() { return this; }, end(o) { resolve({ status: this._s, body: o }); },
        sendStatus(s) { resolve({ status: s, body: "" }); },
      };
      const req = { method, body: Object.assign({}, datos), query: Object.assign({ token: "t" }, method === "GET" ? datos : {}), headers: { accept: "application/json" }, get: () => "", params: {}, protocol: "https", originalUrl: p };
      Promise.resolve(h(req, res)).catch((e) => resolve({ status: 500, body: String((e && e.stack) || e) }));
    });
  }

  // Ayudas para los casos
  const P = () => app.locals.presupuestos;
  async function comunidades() { return P().leerComunidades(); }
  async function comunidad(fn) { const t = await comunidades(); return t.find(fn) || null; }
  function filaDe(tabla, fn) { const rows = DATA[tabla] || []; for (let i = 1; i < rows.length; i++) if (fn(rows[i], i)) return i; return -1; }
  function col(tabla, nombre) { return ((DATA[tabla] || [])[0] || []).indexOf(nombre); }
  const espera = (ms) => new Promise((r) => _st(r, ms));

  return { DATA, LOG, SENT, app, routes, call, P, comunidades, comunidad, filaDe, col, espera, RAIZ, setDriveList };
}

module.exports = { crear };
