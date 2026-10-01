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
let llamadasIAconPDF = 0;
global.fetch = async (url, opts) => {
  if (String(url).includes("api.anthropic.com")) {
    if (String(opts && opts.body).includes('"type":"document"')) llamadasIAconPDF++;
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
  const subir = async (p, fichero, tipo, nombre) => {
    const fd = new FormData();
    fd.append("ccpp_id", ccpp);
    fd.append("bateria_orden", "1");
    const contenido = Buffer.isBuffer(fichero) ? fichero : fs.readFileSync(fichero);
    fd.append("file", new Blob([contenido], { type: tipo }), nombre || path.basename(fichero));
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

    // Lo que se guarda: 9 tomas y caudal 14
    let rtG = await get(`datos-emasesa-rt?ccpp_id=${ccpp}&bateria_orden=1`);
    assert.strictEqual(rtG.datos.tomas.filter(t => t.piso || t.cliente).length, 9);   // "Tomas detectadas"
    assert.strictEqual(rtG.datos.caudal_total, 14);
    assert.strictEqual(tabs.emasesa_relacion_tomas[1][9], "9");                       // num_tomas

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

    // El modal ("Tomas · vecinos") ve la ampliación como nombre del 3ºB
    const t0203 = d.baterias[0].emasesa.tomas.find(t => t.toma === "02-03");
    assert.strictEqual(t0203.nombre, "UNIDO AL PISO 3ºA");
    const rtModal = await get(`datos-emasesa-rt?ccpp_id=${ccpp}&bateria_orden=1`);
    assert.strictEqual(rtModal.datos.tomas.find(t => t.toma === "02-03").nombre, "UNIDO AL PISO 3ºA");

    // "¿Tiene grupo?" = Sí en el formulario
    const gd = await post("guardar-datos-tecnicos", { ccpp_id: ccpp, bateria_orden: 1, datos: { tiene_grupo_presion: "si" } });
    assert.strictEqual(gd.status, 200, JSON.stringify(gd.json));

    // Datos guardados como los dejó la lectura IA en producción (JP17):
    // libre 02-05 con "X" y caudal 13.999999999999998
    const filaRT = tabs.emasesa_relacion_tomas[1];
    const iaTomas = JSON.parse(filaRT[10]).map(t => t.toma === "02-05" ? { ...t, puerta: "X" } : t);
    const filaRTOriginal = [...filaRT];
    filaRT[10] = JSON.stringify(iaTomas);
    filaRT[8] = "13.999999999999998";
    rtG = await get(`datos-emasesa-rt?ccpp_id=${ccpp}&bateria_orden=1`);
    assert.strictEqual(rtG.datos.caudal_total, 14);                                     // no 13,999…
    assert.strictEqual(rtG.datos.tomas.filter(t => t.piso || t.cliente).length, 9);
    let dIA = await get(`datos-certificado?ccpp_id=${ccpp}`);
    assert.strictEqual(dIA.puede_generar, true, JSON.stringify(dIA.errores_cuadricula));  // sin "02-05 · X"
    assert.deepStrictEqual(pinta(dIA)[1].split(" | ")[4], "X X 0,00");
    tabs.emasesa_relacion_tomas[1] = filaRTOriginal;

    // 4) Generar
    g = await post("generar-certificados", { ccpp_id: ccpp });
    assert.strictEqual(g.status, 200, JSON.stringify(g.json));

    // CO 073: "Abastece a" del 3ºB = la ampliación
    const pdf073 = subidos.filter(s => /^CO_073_/.test(s.name)).pop();
    const txt073 = (await require("pdf-parse")(pdf073.buffer)).text;
    assert.ok(txt073.includes("UNIDO AL PISO 3ºA"), "CO 073 sin 'UNIDO AL PISO 3ºA'");
    assert.ok(txt073.includes("BOHM FONT,MARGARITA"));

    // CO 051 (Relación de tomas): ¿Tiene grupo presión? = SÍ
    const pdf051 = subidos.filter(s => /^Relacion_tomas_\d/.test(s.name)).pop();
    const txt051 = (await require("pdf-parse")(pdf051.buffer)).text;
    assert.ok(txt051.includes("SÍ"), "CO 051 sin '¿Tiene grupo presión?'");
    const pdf080 = subidos.find(s => /^CO_080_/.test(s.name));
    assert.ok(pdf080, "no se subió el CO 080");
    // El CO 080 es un formulario (no se aplana): leer los campos
    const { PDFDocument } = require("pdf-lib");
    const form = (await PDFDocument.load(pdf080.buffer)).getForm();
    assert.strictEqual(form.getTextField("Text2").getText(), "H00000000");            // CIF de la OT
    assert.strictEqual(form.getTextField("Teléfono").getText(), "600000000");         // presidente
    assert.strictEqual(form.getTextField("Correo Electrónico").getText(), "presi@example.com");
    assert.strictEqual(form.getTextField("num Baterias").getText(), "1");               // 1 batería
    // Letra uniforme: ningún campo en tamaño automático (0) ni fuera de 6-9 pt
    const tam = nombre => +String(form.getTextField(nombre).acroField.getDefaultAppearance()).match(/([\d.]+) Tf/)[1];
    for (const c of ["Razon Social", "Dirección", "Domicilio", "Empresa Instaladora", "num Baterias"]) {
      assert.ok(tam(c) >= 6 && tam(c) <= 9, `${c}: ${tam(c)} pt`);
    }
    assert.strictEqual(tam("num Baterias"), 9);

    // ── Las tomas del PDF no se tocan nunca salvo al subir un PDF nuevo ──
    const tomasPDF = () => tabs.emasesa_relacion_tomas[1][10];
    const fotoPDF = tomasPDF();
    const conNombres = JSON.parse(fotoPDF).filter(t => t.cliente).length;
    assert.strictEqual(conNombres, 8);                                   // 01-01…02-04 menos el 3ºB
    const listaModal = async () => (await get(`datos-emasesa-rt?ccpp_id=${ccpp}&bateria_orden=1`)).datos.tomas;
    const esLaDelPDF = ts => {
      assert.deepStrictEqual(ts.map(t => t.toma), ["01-01", "01-02", "01-03", "01-04", "01-05", "02-01", "02-02", "02-03", "02-04", "02-05"]);
      assert.strictEqual(ts[0].piso + " " + ts[0].puerta, "Bajo A");
      assert.strictEqual(ts[0].cliente, "DOMINGUEZ DOMINGUEZ ADAME,MARÍA");
      assert.strictEqual(ts[8].cliente, "CDAD PROP CL JUAN PABLOS 17");
    };

    // Regenerar dos veces
    for (let i = 0; i < 2; i++) {
      const r = await post("generar-certificados", { ccpp_id: ccpp });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(tomasPDF(), fotoPDF, `tomas del PDF cambiadas al regenerar (${i + 1})`);
    }
    esLaDelPDF(await listaModal());

    // El modal manda la lista en orden de rótulo y sin nombres (lo que se vio en JP17)
    const listaRotulo = ["3ºB", "2ºB", "BºB", "1ºA", "BºA", "2ºA", "1ºB", "3ºA"].map((sen, i) => ({
      toma: `0${Math.floor(i / 5) + 1}-0${(i % 5) + 1}`, piso: sen.slice(0, 2), puerta: sen.slice(2), cliente: "", caudal: "1,70",
    }));
    let gt = await post("guardar-tomas-emasesa", { ccpp_id: ccpp, bateria_orden: 1, tomas: listaRotulo });
    assert.strictEqual(gt.status, 200);
    assert.strictEqual(tomasPDF(), fotoPDF, "guardar-tomas-emasesa ha machacado las tomas del PDF");
    esLaDelPDF(await listaModal());
    assert.strictEqual((await get(`datos-certificado?ccpp_id=${ccpp}`)).puede_generar, true);

    // Una corrección a mano de verdad (nombre del 3ºB) sí se ve, sin tocar el PDF
    const corregida = (await listaModal()).map(t => t.toma === "02-03" ? { ...t, cliente: "PEREZ RUIZ,LUIS" } : t);
    gt = await post("guardar-tomas-emasesa", { ccpp_id: ccpp, bateria_orden: 1, tomas: corregida });
    assert.strictEqual(gt.status, 200);
    assert.strictEqual(tomasPDF(), fotoPDF);
    assert.strictEqual((await listaModal()).find(t => t.toma === "02-03").cliente, "PEREZ RUIZ,LUIS");

    // Subir nuestra propia Relación de tomas (CO 051) como "PDF EMASESA": se rechaza
    // sin llamar a la IA y sin tocar nada (con su nombre y renombrada)
    const co051 = subidos.filter(x => /^Relacion_tomas_\d/.test(x.name)).pop().buffer;
    const iaAntes = llamadasIAconPDF;
    for (const nombre of ["Relacion_tomas_2026-10-01.pdf", "relacion de tomas.pdf"]) {
      const r = await subir("subir-relacion-emasesa", co051, "application/pdf", nombre);
      assert.strictEqual(r.status, 400, nombre);
      assert.match(r.json.error, /no es la Relación de tomas de EMASESA|generado por ARA/);
      assert.strictEqual(tomasPDF(), fotoPDF);
    }
    assert.strictEqual(llamadasIAconPDF, iaAntes, "se mandó el certificado a la IA");
    esLaDelPDF(await listaModal());

    // Regenerar: la fecha que pinta el modal es la de la última generación
    const filaCert = tabs.ara_os_estado_certificados.find(r => r[0] === COMUNIDAD);
    filaCert[2] = "2026-07-23T10:00:00.000Z"; filaCert[3] = "2026-07-23T10:00:00.000Z";
    g = await post("generar-certificados", { ccpp_id: ccpp });
    assert.strictEqual(g.status, 200);
    const ep0 = await get(`estado-pasos?ccpp_id=${ccpp}`);
    assert.notStrictEqual(ep0.certificados.certificados_fecha.slice(0, 10), "2026-07-23");
    assert.strictEqual(ep0.certificados.certificados_primera_fecha.slice(0, 10), "2026-07-23");
    assert.strictEqual(ep0.resumen.certificados_desactualizados, false);

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

    // E2E_OUT=<carpeta> guarda los PDFs generados para revisarlos a ojo
    if (process.env.E2E_OUT) {
      fs.mkdirSync(process.env.E2E_OUT, { recursive: true });
      for (const s of subidos) if (/\.pdf$/.test(s.name)) fs.writeFileSync(path.join(process.env.E2E_OUT, s.name), s.buffer);
    }
    console.log("OK fase14 relación de tomas e2e (obra nueva)");
  } finally {
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
