// Test del parser contra los 4 PDFs de muestra.
// Uso: node lib/visita-pdf-parser.test.cjs <dir_con_pdfs>
const fs = require("fs");
const path = require("path");
const { parsearVisitaPDF } = require("./visita-pdf-parser.cjs");

const ESPERADO = {
  "b0eebb97-12_05_2026.pdf": {
    tipo_visita: "INICIO",
    obra_nombre: "PALMA DEL RIO 12",
    fecha_iso: "2026-05-12",
    min_filas: 20, // hay ~27 partidas en el PDF
    progreso_max: 0, // INICIO → todo a 0%
  },
  "b71955a4-15_05_2026.pdf": {
    tipo_visita: "SEGUIMIENTO",
    obra_nombre: "PALMA DEL RIO 12",
    fecha_iso: "2026-05-15",
    min_filas: 20,
    progreso_max: 100, // hay partidas al 100%
  },
  "aad9e002-19_02_2026.pdf": {
    tipo_visita: "SEGUIMIENTO",
    obra_nombre: "PALMA DEL RIO 12",
    fecha_iso: "2026-05-19", // OJO: el nombre de archivo dice "02" pero la fecha interna del PDF es 19/05/2026
    min_filas: 20,
    progreso_max: 100,
  },
  "43c78964-25_05_2026.pdf": {
    tipo_visita: "FINAL",
    obra_nombre: "PALMA DEL RIO 12",
    fecha_iso: "2026-05-25",
    min_filas: 20,
    progreso_max: 100,
    debe_contener_motivo: ["VIGA", "CHAPAS"],
  },
};

(async () => {
  const dir = process.argv[2] || "/tmp/pdf-test";
  let fallos = 0;
  for (const [fname, esp] of Object.entries(ESPERADO)) {
    const fpath = path.join(dir, fname);
    if (!fs.existsSync(fpath)) {
      console.log(`SKIP ${fname} (no existe en ${dir})`);
      continue;
    }
    console.log(`\n=== ${fname} ===`);
    try {
      const r = await parsearVisitaPDF(fs.readFileSync(fpath));
      console.log(`  tipo_visita: ${r.tipo_visita}        ${r.tipo_visita === esp.tipo_visita ? "OK" : "FAIL (esperado " + esp.tipo_visita + ")"}`);
      console.log(`  obra: ${r.obra_nombre}              ${r.obra_nombre === esp.obra_nombre ? "OK" : "FAIL (esperado " + esp.obra_nombre + ")"}`);
      console.log(`  fecha: ${r.fecha_iso}                ${r.fecha_iso === esp.fecha_iso ? "OK" : "FAIL (esperado " + esp.fecha_iso + ")"}`);
      console.log(`  filas extraídas: ${r.filas.length}    ${r.filas.length >= esp.min_filas ? "OK" : "FAIL (esperado >= " + esp.min_filas + ")"}`);
      if (esp.progreso_max != null) {
        const max = Math.max(...r.filas.map((f) => f.progreso_pct));
        console.log(`  progreso máx: ${max}%                ${max === esp.progreso_max ? "OK" : "FAIL (esperado " + esp.progreso_max + ")"}`);
        if (max !== esp.progreso_max) fallos++;
      }
      if (esp.debe_contener_motivo) {
        for (const m of esp.debe_contener_motivo) {
          const hit = r.filas.some((f) => f.motivo.includes(m));
          console.log(`  motivo "${m}":                     ${hit ? "OK" : "FAIL (no encontrado)"}`);
          if (!hit) fallos++;
        }
      }
      if (r.tipo_visita !== esp.tipo_visita) fallos++;
      if (r.obra_nombre !== esp.obra_nombre) fallos++;
      if (r.fecha_iso !== esp.fecha_iso) fallos++;
      if (r.filas.length < esp.min_filas) fallos++;

      // Muestra de filas
      console.log(`  --- muestra (primeras 3 filas con progreso > 0):`);
      const conProgreso = r.filas.filter((f) => f.progreso_pct > 0).slice(0, 3);
      for (const f of conProgreso) {
        console.log(`    ${f.nombre.padEnd(50)} prev=${f.previsto} ${f.progreso_pct}% certif=${f.certif} real=${f.real} rest=${f.restante}${f.motivo ? " · " + f.motivo : ""}`);
      }
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      fallos++;
    }
  }
  console.log(`\n${fallos === 0 ? "TODO OK ✓" : `FALLOS: ${fallos}`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
