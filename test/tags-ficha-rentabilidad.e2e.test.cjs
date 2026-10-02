// Prueba de aceptación del "+ Crear tag" de la ficha → rentabilidad.
// Módulos reales (ara-os-tags-holded.cjs + ara-os-holded.cjs) sobre
// Express, con Google Sheets simulado en memoria. No llama a Holded.
// Uso: node test/tags-ficha-rentabilidad.e2e.test.cjs
const assert = require("assert");
const crypto = require("crypto");

process.env.ADMIN_TOKEN = "t";
process.env.GOOGLE_SHEETS_ID = "hoja";

// ── Google Sheets simulado ─────────────────────────────────────
const tabs = {};
let fallarEscrituraEtiquetas = false;
const colIdx = l => l.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function rango(r) {
  const [tab, ref = "A1:ZZ"] = r.split("!");
  const [a, b = a] = ref.split(":");
  const pa = a.match(/^([A-Z]+)(\d*)$/), pb = b.match(/^([A-Z]+)(\d*)$/);
  return { tab, c0: colIdx(pa[1]), r0: pa[2] ? +pa[2] - 1 : 0, c1: colIdx(pb[1]), r1: pb[2] ? +pb[2] - 1 : Infinity };
}
const escribe = tab => {
  if (fallarEscrituraEtiquetas && tab === "holded_etiquetas") throw new Error("Quota exceeded (simulado)");
};
const sheets = { spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(tabs).map(title => ({ properties: { title } })) } }),
  batchUpdate: async ({ requestBody }) => {
    for (const rq of requestBody.requests || []) if (rq.addSheet) tabs[rq.addSheet.properties.title] = [];
    return { data: {} };
  },
  values: {
    get: async ({ range }) => {
      const g = rango(range), t = tabs[g.tab];
      if (!t) throw new Error(`Unable to parse range: ${range}`);
      return { data: { values: t.slice(g.r0, g.r1 === Infinity ? undefined : g.r1 + 1).map(row => (row || []).slice(g.c0, g.c1 + 1)) } };
    },
    update: async ({ range, requestBody }) => {
      const g = rango(range); escribe(g.tab);
      const t = (tabs[g.tab] = tabs[g.tab] || []);
      requestBody.values.forEach((vals, i) => {
        const row = (t[g.r0 + i] = t[g.r0 + i] || []);
        vals.forEach((v, j) => { row[g.c0 + j] = v; });
      });
      return { data: {} };
    },
    append: async ({ range, requestBody }) => {
      const g = rango(range); escribe(g.tab);
      const t = (tabs[g.tab] = tabs[g.tab] || []);
      for (const v of requestBody.values) t.push([...v]);
      return { data: {} };
    },
  },
} };
require.cache[require.resolve("googleapis")] = {
  id: "googleapis", filename: "googleapis", loaded: true,
  exports: { google: { auth: { OAuth2: function () { this.setCredentials = () => {}; } }, sheets: () => sheets } },
};

// ── Datos de prueba (como en producción el 02/10) ──────────────
const ccpp = dir => {
  const slug = dir.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `ccpp_${slug}_${crypto.createHash("md5").update(dir).digest("hex").slice(0, 6)}`;
};
const OBRAS = {
  prueba: ["Prueba Tags 1", "CALLE PRUEBA TAGS, 1"],
  mandarinas: ["Mandarinas 2", "CALLE MANDARINAS, 2"],
  malvaloca: ["Malvaloca 1", "CALLE MALVALOCA, 1"],
  ardilla: ["Ardilla 9", "CALLE ARDILLA, 9"],
  gandia: ["Ciudad de Gandía 5", "CALLE CIUDAD DE GANDIA, 5"],
  pendiente: ["Pendiente Backfill 3", "CALLE PENDIENTE, 3"],
};
const id = k => ccpp(OBRAS[k][1]);
const filaCom = ([nombre, dir]) => { const r = Array(16).fill(""); r[0] = nombre; r[1] = dir; r[15] = "14_FINALIZADA"; return r; };
tabs.comunidades = [["comunidad"], ...Object.values(OBRAS).map(filaCom)];
const MAND = "o25ara00087_plan_cinco_ccpp_mandarinas_2_g|o25ara00087plancincoccppmandarinas2g";
tabs.holded_etiquetas = [
  ["obra_id", "etiqueta_holded", "nombre_comunidad", "tipo_obra", "fecha_asignacion", "activa", "notas"],
  [id("mandarinas"), MAND, "Mandarinas 2", "plan5", "2026-06-01", "TRUE", ""],
  // Arreglados a mano el 02/10 con POST /holded/etiquetas
  [id("malvaloca"), "plancincoccppmalvaloca1", "Malvaloca 1", "plan5", "2026-10-02", "TRUE", ""],
  [id("ardilla"), "plancincoccppardilla9", "Ardilla 9", "plan5", "2026-10-02", "TRUE", ""],
  [id("gandia"), "plancincoccppciudaddegandia5", "Ciudad de Gandía 5", "plan5", "2026-10-02", "TRUE", ""],
];
tabs.comunidades_tags_holded = [
  ["tag_id", "ccpp_id", "tag", "created_at", "created_by", "borrado"],
  ["TH-1", id("malvaloca"), "plancincoccppmalvaloca1", "", "ara-os", "FALSE"],
  ["TH-2", id("ardilla"), "PlanCincoCcppArdilla9", "", "ara-os", "FALSE"],     // otra capitalización
  ["TH-3", id("gandia"), "plancincoccppciudaddegandia5", "", "ara-os", "FALSE"],
  ["TH-4", id("pendiente"), "plancincoccpppendiente3", "", "ara-os", "FALSE"],   // falta en holded_etiquetas
  ["TH-5", id("pendiente"), "tag_borrado_no_va", "", "ara-os", "TRUE"],         // borrado: no se pasa
];

const express = require("express");
const app = express();
require("../ara-os-tags-holded.cjs")(app);
require("../ara-os-holded.cjs")(app);

(async () => {
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api/ara-os`;
  const call = async (method, p, body) => {
    const r = await fetch(`${base}${p}${p.includes("?") ? "&" : "?"}token=t`, {
      method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json() };
  };
  const etiquetasDe = async k => (await call("GET", "/holded/etiquetas")).json.obras.find(o => o.obra_id === id(k));
  const filasDe = k => tabs.holded_etiquetas.filter(r => r[0] === id(k));

  try {
    // 1) Obra sin etiquetas: la ficha avisa
    let g = await call("GET", `/comunidades/${id("prueba")}/tags-holded`);
    assert.strictEqual(g.json.rentabilidad.sin_etiquetas, true);
    assert.strictEqual(g.json.rentabilidad.aviso, "⚠️ La rentabilidad no ve ninguna etiqueta de esta obra");

    // 2) Guardar un tag desde la ficha → holded_etiquetas lo tiene, activo
    let p = await call("POST", `/comunidades/${id("prueba")}/tags-holded`, { tag: "plancincoccpppruebatags1" });
    assert.strictEqual(p.status, 200, JSON.stringify(p.json));
    assert.strictEqual(p.json.rentabilidad.accion, "creada");
    let e = await etiquetasDe("prueba");
    assert.deepStrictEqual(e.etiquetas, ["plancincoccpppruebatags1"]);
    assert.strictEqual(e.activa, true);
    assert.strictEqual(filasDe("prueba")[0][2], "Prueba Tags 1");     // nombre_comunidad
    assert.strictEqual(filasDe("prueba")[0][3], "plan5");
    g = await call("GET", `/comunidades/${id("prueba")}/tags-holded`);
    assert.strictEqual(g.json.rentabilidad.sin_etiquetas, false);
    assert.strictEqual(g.json.rentabilidad.aviso, "");

    // 3) Mandarinas 2: añadir desde la ficha no borra las dos variantes
    p = await call("POST", `/comunidades/${id("mandarinas")}/tags-holded`, { tag: "o25ara00087nuevo" });
    assert.strictEqual(p.status, 200, JSON.stringify(p.json));
    e = await etiquetasDe("mandarinas");
    assert.deepStrictEqual(e.etiquetas, [...MAND.split("|"), "o25ara00087nuevo"]);
    assert.strictEqual(filasDe("mandarinas").length, 1);

    // 4) Si falla la escritura en holded_etiquetas → error visible, no ok
    fallarEscrituraEtiquetas = true;
    p = await call("POST", `/comunidades/${id("prueba")}/tags-holded`, { tag: "segundo_tag_prueba" });
    assert.strictEqual(p.status, 500);
    assert.strictEqual(p.json.ok, false);
    assert.match(p.json.error, /NO en la rentabilidad/);
    fallarEscrituraEtiquetas = false;
    //    …y reintentar (mismo tag, ya en la ficha) lo arregla
    p = await call("POST", `/comunidades/${id("prueba")}/tags-holded`, { tag: "segundo_tag_prueba" });
    assert.strictEqual(p.status, 200, JSON.stringify(p.json));
    assert.strictEqual(p.json.ya_en_ficha, true);
    assert.strictEqual(p.json.rentabilidad.accion, "añadida");
    //    …y un tercer intento ya dice que está repetido
    p = await call("POST", `/comunidades/${id("prueba")}/tags-holded`, { tag: "SEGUNDO_TAG_PRUEBA" });
    assert.strictEqual(p.status, 400);

    // 5) Borrar desde la ficha NO lo quita de la rentabilidad
    const tagId = tabs.comunidades_tags_holded.find(r => r[2] === "plancincoccpppruebatags1")[0];
    const d = await call("DELETE", `/comunidades/tags-holded/${tagId}`);
    assert.strictEqual(d.status, 200);
    assert.ok((await etiquetasDe("prueba")).etiquetas.includes("plancincoccpppruebatags1"));

    // 6) Backfill: dry run lista sin escribir; luego escribe sólo lo que falta
    const antes = JSON.stringify(tabs.holded_etiquetas);
    let b = await call("POST", "/holded/etiquetas/backfill-desde-ficha?dry_run=1");
    assert.strictEqual(b.status, 200, JSON.stringify(b.json));
    assert.strictEqual(JSON.stringify(tabs.holded_etiquetas), antes);
    assert.deepStrictEqual(b.json.cambios.map(c => [c.obra_id, c.accion, c.añadidas]), [
      [id("pendiente"), "creada", ["plancincoccpppendiente3"]],
    ]);
    b = await call("POST", "/holded/etiquetas/backfill-desde-ficha");
    assert.strictEqual(b.json.obras_cambiadas, 1);
    assert.deepStrictEqual((await etiquetasDe("pendiente")).etiquetas, ["plancincoccpppendiente3"]);
    //    Malvaloca / Ardilla / Gandía siguen igual, sin duplicar
    assert.deepStrictEqual((await etiquetasDe("malvaloca")).etiquetas, ["plancincoccppmalvaloca1"]);
    assert.deepStrictEqual((await etiquetasDe("ardilla")).etiquetas, ["plancincoccppardilla9"]);
    assert.deepStrictEqual((await etiquetasDe("gandia")).etiquetas, ["plancincoccppciudaddegandia5"]);
    for (const k of ["malvaloca", "ardilla", "gandia", "mandarinas", "pendiente"]) assert.strictEqual(filasDe(k).length, 1, k);
    assert.ok(!JSON.stringify(tabs.holded_etiquetas).includes("tag_borrado_no_va"));
    //    Repetir el backfill no cambia nada
    const tras = JSON.stringify(tabs.holded_etiquetas);
    b = await call("POST", "/holded/etiquetas/backfill-desde-ficha");
    assert.strictEqual(b.json.obras_cambiadas, 0);
    assert.strictEqual(JSON.stringify(tabs.holded_etiquetas), tras);
    //    Sin token no entra
    const sinToken = await fetch(`${base}/holded/etiquetas/backfill-desde-ficha`, { method: "POST" });
    assert.strictEqual(sinToken.status, 401);

    console.log("OK tags ficha → rentabilidad (e2e)");
  } finally {
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
