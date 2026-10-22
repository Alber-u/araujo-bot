// ===================================================================
// BANCO DE PRUEBAS — correr todos los casos
// ===================================================================
// Uso (desde la carpeta del programa):
//   node banco-pruebas/correr.cjs            -> todos los casos
//   node banco-pruebas/correr.cjs v139       -> solo los que contienen "v139"
// Variables opcionales: BANCO_RAIZ (otra copia del programa, p. ej. la versión
// anterior para comparar) y BANCO_DATOS (otro sheet.json).
// Cada caso corre en su propio proceso, con los datos recién cargados, para
// que lo que escribe un caso no influya en el siguiente.
// Sale con código 1 si algún caso falla.
// ===================================================================
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");

if (process.argv[2] === "--uno") {
  // proceso hijo: corre un solo caso y devuelve el resultado en JSON por la salida
  const { CASOS } = require("./casos.cjs");
  const caso = CASOS[+process.argv[3]];
  const log = console.log; console.log = () => {}; console.error = () => {}; console.warn = () => {};
  (async () => {
    let res;
    try {
      const S = require("./simulador.cjs").crear();
      await S.espera(50);
      S.LOG.length = 0; S.SENT.length = 0;
      res = { checks: await caso.prueba(S) };
    } catch (e) { res = { error: String((e && e.stack) || e).slice(0, 800) }; }
    log("@@RES@@" + JSON.stringify(res));
    process.exit(0);
  })();
  return;
}

const { CASOS } = require("./casos.cjs");
const filtro = process.argv[2] || "";
let pasan = 0, fallan = 0;
const t0 = Date.now();
CASOS.forEach((c, i) => {
  if (filtro && !(c.nombre + " " + c.desde).includes(filtro)) return;
  const r = spawnSync(process.execPath, [__filename, "--uno", String(i)], { encoding: "utf8", env: process.env, timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const linea = String(r.stdout || "").split("\n").find((l) => l.startsWith("@@RES@@"));
  let res; try { res = JSON.parse(linea.slice(7)); } catch (e) { res = { error: "el caso no terminó: " + String(r.stderr || "").slice(-600) }; }
  const malos = res.error ? [["", res.error]] : res.checks.filter((k) => !k[0]).map((k) => [k[1], k[2]]);
  if (malos.length) {
    fallan++;
    console.log("✗ FALLA  " + c.nombre + "  [" + c.desde + "]");
    for (const [que, det] of malos) console.log("     se esperaba: " + que + (det !== "" && det != null ? "  →  " + String(det).slice(0, 300) : ""));
  } else {
    pasan++;
    console.log("✓ pasa   " + c.nombre + "  [" + c.desde + "]");
  }
});
console.log("\n" + pasan + " pasan, " + fallan + " fallan (" + Math.round((Date.now() - t0) / 1000) + " s)");
process.exit(fallan ? 1 : 0);
