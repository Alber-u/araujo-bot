// Prueba de extremo a extremo de fase 14 con una obra nueva:
//   subir PDF EMASESA → subir foto rótulo → abrir Certificados → generar
// usando el módulo real (ara-os-fase14-certificados.cjs) sobre Express,
// con Google Sheets/Drive simulados en memoria y la lectura IA de la foto
// simulada (devuelve lo que pone físicamente en la foto de JP17).
// Uso: node test/fase14-relacion-tomas.e2e.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

process.env.ADMIN_TOKEN = "t";
process.env.GOOGLE_SHEETS_ID = "hoja";
process.env.DRIVE_FOLDER_FASE14_FIRMADAS = "carpeta";
process.env.ANTHROPIC_API_KEY = "x";
process.env.ARA_INSTALADOR_NOMBRE = "INSTALADOR PRUEBA";
process.env.ARA_INSTALADOR_NIF = "00000000T";

// ── Google simulado ────────────────────────────────────────────
const tabs = {};
const subidos = [];
const colIdx = l => l.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function rango(r) {
  const [tab, ref = "A1:ZZ"] = r.split("!");
  const [a, b = a] = ref.split(":");
  const pa = a.match(/^([A-Z]+)(\d*)$/), pb = b.match(/^([A-Z]+)(\d*)$/);
  return { tab, c0: colIdx(pa[1]), r0: pa[2] ? +pa[2] - 1 : 0, c1: colIdx(pb[1]), r1: pb[2] ? +pb[2] - 1 : Infinity };
}
const sheets = {
  spreadsheets: {
    get: async () => ({ data: { sheets: Object.keys(tabs).map(title => ({ properties: { title } })) } }),
    batchUpdate: async ({ requestBody }) => {
      for (const rq of requestBody.requests || []) if (rq.addSheet) tabs[rq.addSheet.properties.title] = [];
      return { data: {} };
    },
    values: {
      get: async ({ range }) => {
        const g = rango(range), t = tabs[g.tab] || [];
        const values = t.slice(g.r0, g.r1 === Infinity ? undefined : g.r1 + 1).map(row => row.slice(g.c0, g.c1 + 1));
        return { data: { values } };
      },
      update: async ({ range, requestBody }) => {
        const g = rango(range); const t = (tabs[g.tab] = tabs[g.tab] || []);
        requestBody.values.forEach((vals, i) => {
          const row = (t[g.r0 + i] = t[g.r0 + i] || []);
          vals.forEach((v, j) => { row[g.c0 + j] = v; });
        });
        return { data: {} };
      },
      append: async ({ range, requestBody }) => {
        const g = rango(range); const t = (tabs[g.tab] = tabs[g.tab] || []);
        for (const v of requestBody.values) t.push([...v]);
        return { data: {} };
      },
      batchUpdate: async ({ requestBody }) => {
        for (const d of requestBody.data) await sheets.spreadsheets.values.update({ range: d.range, requestBody: { values: d.values } });
        return { data: {} };
      },
    },
  },
};
const drive = {
  files: {
    list: async () => ({ data: { files: [{ id: "sub", name: "x" }] } }),
    create: async ({ requestBody, media }) => {
      const id = "f" + subidos.length;
      if (media && media.body) {
        const chunks = []; for await (const c of media.body) chunks.push(Buffer.from(c));
        subidos.push({ name: requestBody.name, buffer: Buffer.concat(chunks) });
      }
      return { data: { id, name: requestBody.name, webViewLink: "https://drive/" + id } };
    },
    get: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
  },
  permissions: { create: async () => ({ data: {} }) },
};
const googleapis = { google: {
  auth: { OAuth2: function () { this.setCredentials = () => {}; } },
  sheets: () => sheets,
  drive: () => drive,
} };
require.cache[require.resolve("googleapis")] = { id: "googleapis", filename: "googleapis", loaded: true, exports: googleapis };

// IA de la foto: devuelve lo que se lee en la foto (configurable)
let celdasFoto = ["3ºB", "2ºB", "0ºB", "1ºA", "0ºA", "2ºA", "1ºB", "3ºA", "C", "X"];
const fetchReal = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes("api.anthropic.com")) {
    const text = JSON.stringify({ num_filas: 2, num_cols: 5, celdas: celdasFoto });
    return { ok: true, json: async () => ({ content: [{ type: "text", text }] }), text: async () => text };
  }
  return fetchReal(url, opts);
};

// ── Obra nueva en fase 14 ──────────────────────────────────────
const COMUNIDAD = "CDAD PRUEBA FASE 14";
const DIRECCION = "CALLE PRUEBA, 5";
const ccpp = (() => {
  const slug = DIRECCION.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `ccpp_${slug}_${crypto.createHash("md5").update(DIRECCION).digest("hex").slice(0, 6)}`;
})();
tabs.comunidades = [["comunidad"], [COMUNIDAD, DIRECCION, "PRESIDENTA PRUEBA", "600000000", "presi@example.com"]];
const ot = Array(37).fill(""); ot[0] = COMUNIDAD; ot[1] = "14_FINALIZADA"; ot[28] = "H00000000";
tabs.ordenes_trabajo = [["comunidad"], ot];

const express = require("express");
const app = express();
require("../ara-os-fase14-certificados.cjs")(app);

(async () => {
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api/ara-os/fase14`;
  const get = async p => (await fetchReal(`${base}/${p}${p.includes("?") ? "&" : "?"}token=t`)).json();
  const post = async (p, body) => {
    const r = await fetchReal(`${base}/${p}?token=t`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  };
  const subir = async (p, fichero, tipo) => {
    const fd = new FormData();
    fd.append("ccpp_id", ccpp);
    fd.append("bateria_orden", "1");
    fd.append("file", new Blob([fs.readFileSync(fichero)], { type: tipo }), path.basename(fichero));
    const r = await fetchReal(`${base}/${p}?token=t`, { method: "POST", body: fd });
    return { status: r.status, json: await r.json() };
  };
  const pinta = d => {
    const b = d.baterias[0];
    const out = [];
    for (let f = 1; f <= +b.bateria_num_filas; f++) {
      const fila = [];
      for (let c = 1; c <= +b.bateria_num_columnas; c++) fila.push(`${b[`toma_${f}_${c}_senal`]} ${b[`toma_${f}_${c}_destino`]} ${b[`toma_${f}_${c}_caudal`]}`);
      out.push(fila.join(" | "));
    }
    return out;
  };
  const FIX = path.join(__dirname, "fixtures");

  try {
    // 1) PDF EMASESA
    const rPdf = await subir("subir-relacion-emasesa", path.join(FIX, "jp17-relacion-tomas.pdf"), "application/pdf");
    assert.strictEqual(rPdf.status, 200, JSON.stringify(rPdf.json));
    const t0202 = rPdf.json.datos.tomas.find(t => t.toma === "02-02");
    assert.strictEqual(t0202.puerta, "A");
    assert.strictEqual(t0202.ampliacion, "UNIDO AL PISO 3ºB");

    // Sin foto todavía: no deja generar
    let d = await get(`datos-certificado?ccpp_id=${ccpp}`);
    assert.strictEqual(d.puede_generar, false);
    let g = await post("generar-certificados", { ccpp_id: ccpp });
    assert.strictEqual(g.status, 422);
    assert.match(g.json.error, /foto del rótulo/);

    // 2) Foto del rótulo
    const rFoto = await subir("subir-rotulo-bateria", path.join(FIX, "jp17-rotulo.jpg"), "image/jpeg");
    assert.strictEqual(rFoto.status, 200, JSON.stringify(rFoto.json));
    assert.strictEqual(rFoto.json.cuadricula.ok, true, rFoto.json.aviso);

    // 3) Certificados: la cuadrícula es la foto
    d = await get(`datos-certificado?ccpp_id=${ccpp}`);
    assert.strictEqual(d.puede_generar, true, JSON.stringify(d.errores_cuadricula));
    assert.deepStrictEqual(pinta(d), [
      "3ºB V 1,70 | 2ºB V 1,70 | BºB V 1,70 | 1ºA V 1,70 | BºA V 1,70",
      "2ºA V 1,70 | 1ºB V 1,70 | 3ºA V 1,70 | C C 0,40 | X X 0,00",
    ]);
    assert.strictEqual(d.certificados_desactualizados, false);
    // NIF/tel/email del titular salen de la obra; sólo falta el nº de registro
    assert.deepStrictEqual(d.avisos_generar, ["Nº de registro de la instalación"]);

    // 4) Generar
    g = await post("generar-certificados", { ccpp_id: ccpp });
    assert.strictEqual(g.status, 200, JSON.stringify(g.json));
    const pdf080 = subidos.find(s => /^CO_080_/.test(s.name));
    assert.ok(pdf080, "no se subió el CO 080");
    // El CO 080 es un formulario (no se aplana): leer los campos
    const { PDFDocument } = require("pdf-lib");
    const form = (await PDFDocument.load(pdf080.buffer)).getForm();
    assert.strictEqual(form.getTextField("Text2").getText(), "H00000000");            // CIF de la OT
    assert.strictEqual(form.getTextField("Teléfono").getText(), "600000000");         // presidente
    assert.strictEqual(form.getTextField("Correo Electrónico").getText(), "presi@example.com");

    // 5) Se sube otra foto DESPUÉS de generar → desactualizados
    await new Promise(r => setTimeout(r, 15));
    celdasFoto = ["3ºB", "2ºB", "0ºB", "1ºA", "0ºA", "2ºA", "1ºB", "3ºA", "C", "X"];
    await subir("subir-rotulo-bateria", path.join(FIX, "jp17-rotulo.jpg"), "image/jpeg");
    d = await get(`datos-certificado?ccpp_id=${ccpp}`);
    assert.strictEqual(d.certificados_desactualizados, true);
    assert.match(d.certificados_desactualizados_motivo, /foto del rótulo/);
    const ep = await get(`estado-pasos?ccpp_id=${ccpp}`);
    assert.strictEqual(ep.resumen.certificados_desactualizados, true);

    // 6) Foto que no cuadra: celda roja y no deja generar
    celdasFoto = ["3ºB", "2ºB", "0ºB", "1ºA", "0ºA", "2ºA", "1ºB", "3ºB", "C", "X"];
    const rMal = await subir("subir-rotulo-bateria", path.join(FIX, "jp17-rotulo.jpg"), "image/jpeg");
    assert.match(rMal.json.aviso, /repetida/);
    d = await get(`datos-certificado?ccpp_id=${ccpp}`);
    assert.strictEqual(d.puede_generar, false);
    assert.strictEqual(d.baterias[0].cuadricula.filas[1][2].estado, "error");
    g = await post("generar-certificados", { ccpp_id: ccpp });
    assert.strictEqual(g.status, 422);
    assert.match(g.json.error, /3ºA/);

    console.log("OK fase14 relación de tomas e2e (obra nueva)");
  } finally {
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
