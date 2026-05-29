/**
 * .puppeteerrc.cjs · configuración de Puppeteer
 * --------------------------------------------------------------
 * Mueve la cache de Chromium DENTRO del árbol del proyecto. Por
 * defecto Puppeteer usa ~/.cache/puppeteer (en Render esto es
 * /opt/render/.cache/puppeteer) que NO se persiste entre deploys,
 * así que el binario de Chrome se "olvida" tras cada redeploy.
 *
 * Con cacheDirectory dentro de /opt/render/project/src/.cache/
 * el binario queda incluido en el filesystem del servicio y
 * Render lo conserva.
 *
 * Documentado en https://pptr.dev/guides/configuration
 * --------------------------------------------------------------
 */
const { join } = require("path");

module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
