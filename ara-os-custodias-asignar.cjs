/**
 * ara-os-custodias-asignar.cjs
 * ---------------------------------------------------------------
 * CUSTODIAS POR ASIGNAR · v0.1.0 (09/09/2026)
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Los cobros de los vecinos entran en el banco todos iguales:
 *
 *   "TRANSFERENCIA DE SABADELL CONSUMER FINANCE S.A.U., ."
 *
 * Sin concepto, sin nombre, sin comunidad. Por eso la regla de
 * conciliación de Holded los manda todos a la cuenta 56100018
 * (Custodia Plan Cinco · PENDIENTE DE ASIGNAR): así el dinero no
 * identificado queda contado y visible en vez de disolverse.
 *
 * Identificarlos a mano significa entrar en la web de Sabadell
 * Consumer, ver de qué cliente es cada cobro, y buscarlo en el
 * listado de vecinos de la comunidad. Método de Alberto, 09/09/2026:
 *
 *   "LOS COBROS DE SABADELL LOCALIZO DE QUIEN SON POR LA PAGINA DE
 *    SABADELL CONSUMER Y QUE EL CLIENTE ESTE EN EL LISTADO DE ESA
 *    COMUNIDAD O QUE EL IMPORTE COINCIDA CON LA CUOTA POR VECINO
 *    DEL PRESUPUESTO"
 *
 * Ese segundo camino —el importe— sí lo puede hacer ARA-OS solo,
 * porque ARA-OS tiene el censo que Holded no tiene: la hoja
 * `financiaciones_sabadell`, con una fila por vecino financiado
 * (comunidad, vivienda, titular e importe).
 *
 * POR QUÉ AQUÍ Y NO EN HOLDED
 * ---------------------------
 * Se valoró crear una regla de conciliación por comunidad basada en
 * el importe. Se descartó (decisión de Alberto, 09/09/2026):
 *
 *   "PERO CLARO CADA COMUNIDAD NUEVA TIENE SUS PROPIOS IMPORTES"
 *
 * Una regla por cuota obligaría a crear reglas nuevas a mano con
 * cada obra, con un tope de 50, y a quedarse desactualizado en
 * silencio. Aquí no: cada comunidad nueva es un presupuesto nuevo
 * en ARA-OS y entra sola en el cruce.
 *
 * REPARTO DE TRABAJO
 * ------------------
 *   Holded → qué dinero entró y cuánto            (verdad)
 *   ARA-OS → quién debía pagar cuánto             (censo)
 *   El cruce por importe → una PROPUESTA          (no una verdad)
 *
 * ESTE MÓDULO NO ESCRIBE NADA. Ni en Holded ni en la hoja.
 * Propone; Alberto confirma. Un importe que coincide es un indicio
 * fuerte, no una prueba: un vecino que adelanta o paga a plazos no
 * cuadra con su cuota, y dos vecinos distintos pueden tener la
 * misma. Por eso cada línea dice su grado de confianza y las que no
 * están claras se quedan sin proponer, que es lo honesto.
 *
 * Endpoint:
 *   GET /api/ara-os/custodias/por-asignar?token=…
 *       &desde=YYYY-MM-DD   (opcional, por defecto 2025-01-01)
 *       &hasta=YYYY-MM-DD   (opcional, por defecto hoy)
 *       &cuenta=56100018    (opcional)
 * ---------------------------------------------------------------
 */

const HOLDED_V2 = "https://api.holded.com/api/v2";

// Cuenta donde la regla de conciliación deja lo no identificado.
const CUENTA_SIN_ASIGNAR = 56100018;

// Techo real de la API: limit máximo 100 por página (doc oficial).
const LIMITE_PAGINA = 100;

// Cortafuegos: si algo se descontrola, no pedimos páginas sin fin.
const MAX_PAGINAS = 50;

module.exports = function (app) {
  const VERSION = "0.1.0";

  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Mismo control que el resto de ARA-OS: lib/auth.cjs. No inventar
  // aquí una validación propia — el token es uno y vive en un sitio.
  const { validToken } = require("./lib/auth.cjs");
  function tokenValido(req) { return validToken(req.query.token); }

  function eur(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function hoyISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // OJO: hay DOS formatos de número en juego y confundirlos multiplica
  // por cien. La hoja de Google escribe a la española ("1.234,56": el
  // punto es separador de miles); la API de Holded devuelve strings a la
  // inglesa ("843.11": el punto es el decimal). Una función para cada
  // sitio, y nunca la de la hoja sobre un dato de la API.

  // Formato hoja: "1.234,56" → 1234.56
  function numES(v) {
    if (typeof v === "number") return v;
    const s = String(v || "").trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  // Formato API Holded: "843.11" → 843.11
  function numAPI(v) {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v || "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  // -------------------------------------------------------------
  // Holded · apuntes de una cuenta contable.
  //
  // /api/v2/ledger-entries exige start_date Y end_date. Si mandas
  // solo uno, el otro llega vacío y responde 400 "Invalid date
  // format" — un error que parece de formato y es de parámetro que
  // falta. Autenticación: Bearer con el API Token v2; la API Key v1
  // da 403 en toda la v2, con el plan que sea.
  // -------------------------------------------------------------
  async function apuntesDeCuenta(cuenta, desde, hasta) {
    const tok = process.env.HOLDED_API_TOKEN || "";
    if (!tok) {
      return {
        ok: false,
        error: "Falta HOLDED_API_TOKEN en el entorno",
        pista: "Es el API Token v2 de Holded. La API Key v1 no sirve para /api/v2.",
      };
    }

    const items = [];
    let cursor = null;
    let paginas = 0;

    while (paginas < MAX_PAGINAS) {
      const qs = new URLSearchParams({
        start_date: desde,
        end_date: hasta,
        account: String(cuenta),
        limit: String(LIMITE_PAGINA),
      });
      if (cursor) qs.append("cursor", cursor);

      const r = await fetch(`${HOLDED_V2}/ledger-entries?${qs}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
      });
      const text = await r.text();

      if (!r.ok) {
        return {
          ok: false,
          status: r.status,
          error: `Holded respondió ${r.status}`,
          body_raw: text.slice(0, 300),
        };
      }

      let j = null;
      try { j = JSON.parse(text); } catch { /* no-JSON */ }
      const lote = (j && j.items) || [];
      items.push(...lote);

      paginas += 1;
      if (!j || !j.has_more || !j.cursor) break;
      cursor = j.cursor;
    }

    return { ok: true, items, paginas };
  }

  // -------------------------------------------------------------
  // ARA-OS · el censo de vecinos financiados.
  // Hoja `financiaciones_sabadell`, columnas (FS_COLS):
  //   0 n_operacion · 1 tipo · 2 comunidad · 3 vivienda
  //   4 titular · 5 importe · 6 fecha · 9 n_transferencia
  // -------------------------------------------------------------
  async function censoVecinos() {
    try {
      const { google } = require("googleapis");
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const sheets = google.sheets({ version: "v4", auth });
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: "financiaciones_sabadell!A2:L",
      });

      const filas = [];
      for (const row of r.data.values || []) {
        const tipo = String(row[1] || "").trim();
        // entrega_emasesa es una salida de dinero, no un cobro de vecino.
        if (tipo !== "piso" && tipo !== "comunidad") continue;
        const comunidad = String(row[2] || "").trim();
        if (!comunidad) continue;
        filas.push({
          n_operacion: String(row[0] || "").trim(),
          tipo,
          comunidad,
          vivienda: String(row[3] || "").trim(),
          titular: String(row[4] || "").trim(),
          importe: eur(numES(row[5])),
          fecha: String(row[6] || "").trim(),
        });
      }
      return { ok: true, filas };
    } catch (e) {
      return { ok: false, error: e.message, filas: [] };
    }
  }

  // -------------------------------------------------------------
  // El cruce.
  //
  // Un apunte se empareja con las filas del censo cuyo importe es
  // idéntico al céntimo. Nada de tolerancias: si el importe no es
  // exacto no es la cuota de ese vecino, y un emparejamiento
  // aproximado sería peor que ninguno.
  //
  // Cada fila del censo se "gasta" al usarse, para que dos cobros
  // iguales no señalen dos veces al mismo vecino: dos vecinos de la
  // misma comunidad con la misma cuota son dos filas distintas.
  // -------------------------------------------------------------
  function cruzar(apuntes, censo) {
    const porImporte = new Map();
    for (const f of censo) {
      const k = f.importe.toFixed(2);
      if (!porImporte.has(k)) porImporte.set(k, []);
      porImporte.get(k).push({ ...f, usada: false });
    }

    const lineas = [];
    for (const a of apuntes) {
      // Un cobro de vecino entra al HABER de la cuenta de custodia.
      const haber = eur(numAPI(a.credit));
      const debe = eur(numAPI(a.debit));
      const importe = haber > 0 ? haber : -debe;

      const candidatas = (porImporte.get(Math.abs(importe).toFixed(2)) || []);
      const libres = candidatas.filter(c => !c.usada);
      const comunidades = [...new Set(libres.map(c => c.comunidad))];

      let confianza = "sin_propuesta";
      let propuesta = null;

      if (libres.length === 1) {
        // Un único vecino en todo el censo con esa cuota exacta.
        confianza = "alta";
        propuesta = libres[0];
        propuesta.usada = true;
      } else if (libres.length > 1 && comunidades.length === 1) {
        // Varios vecinos, pero todos de la misma comunidad: la
        // comunidad es segura aunque el vecino concreto no lo sea.
        confianza = "media";
        propuesta = libres[0];
        propuesta.usada = true;
      } else if (libres.length > 1) {
        // Mismo importe en comunidades distintas: no se propone.
        // Proponer una al azar aquí sería mandar dinero a la
        // comunidad equivocada sin que nadie se entere.
        confianza = "ambigua";
      }

      lineas.push({
        fecha: a.date || null,
        descripcion: a.description || "",
        cuenta: a.account,
        importe: eur(importe),
        confianza,
        comunidad_propuesta: propuesta ? propuesta.comunidad : null,
        vivienda: propuesta ? propuesta.vivienda : null,
        titular: propuesta ? propuesta.titular : null,
        n_operacion: propuesta ? propuesta.n_operacion : null,
        // En las ambiguas, decir entre qué comunidades hay que elegir
        // ahorra la mitad del trabajo aunque no resuelva el caso.
        candidatas: confianza === "ambigua"
          ? libres.map(c => ({
              comunidad: c.comunidad,
              vivienda: c.vivienda,
              titular: c.titular,
            }))
          : undefined,
      });
    }
    return lineas;
  }

  // =============================================================
  // GET /api/ara-os/custodias/por-asignar
  // =============================================================
  app.options("/api/ara-os/custodias/por-asignar", (req, res) => {
    cors(res); res.status(204).end();
  });

  app.get("/api/ara-os/custodias/por-asignar", async (req, res) => {
    cors(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token inválido" });

    const desde  = String(req.query.desde || "2025-01-01");
    const hasta  = String(req.query.hasta || hoyISO());
    const cuenta = Number(req.query.cuenta || CUENTA_SIN_ASIGNAR);

    try {
      const [hold, censo] = await Promise.all([
        apuntesDeCuenta(cuenta, desde, hasta),
        censoVecinos(),
      ]);

      if (!hold.ok) {
        return res.status(502).json({
          ok: false,
          version: VERSION,
          error: "No se ha podido leer la contabilidad de Holded",
          detalle: hold.error,
          status: hold.status || null,
          body_raw: hold.body_raw || null,
          pista: "Prueba /api/ara-os/custodias/diagnostico para ver qué API responde.",
        });
      }

      const lineas = cruzar(hold.items, censo.filas);

      const suma = (f) => eur(lineas.filter(f).reduce((a, x) => a + x.importe, 0));
      const cuenta_de = (c) => lineas.filter(x => x.confianza === c).length;

      // Agrupado por comunidad: lo que hay que mover si se aceptan
      // las propuestas altas y medias.
      const porComunidad = {};
      for (const l of lineas) {
        if (!l.comunidad_propuesta) continue;
        if (l.confianza !== "alta" && l.confianza !== "media") continue;
        porComunidad[l.comunidad_propuesta] =
          eur((porComunidad[l.comunidad_propuesta] || 0) + l.importe);
      }

      res.json({
        ok: true,
        version: VERSION,
        generated_at: new Date().toISOString(),
        periodo: { desde, hasta },
        cuenta_leida: cuenta,
        aviso_censo: censo.ok ? null
          : `No se ha podido leer el censo de ARA-OS: ${censo.error}. Sin censo no hay propuestas, solo el listado de apuntes.`,
        vecinos_en_censo: censo.filas.length,
        apuntes: lineas.length,
        total_por_asignar: suma(() => true),
        resumen: {
          alta:          { n: cuenta_de("alta"),          importe: suma(x => x.confianza === "alta") },
          media:         { n: cuenta_de("media"),         importe: suma(x => x.confianza === "media") },
          ambigua:       { n: cuenta_de("ambigua"),       importe: suma(x => x.confianza === "ambigua") },
          sin_propuesta: { n: cuenta_de("sin_propuesta"), importe: suma(x => x.confianza === "sin_propuesta") },
        },
        propuesta_por_comunidad: porComunidad,
        lineas,
        // Recordatorio deliberado: esto no ha tocado nada.
        nota: "Propuesta de asignación. No se ha escrito nada en Holded ni en la hoja.",
      });
    } catch (e) {
      res.status(500).json({ ok: false, version: VERSION, error: e.message });
    }
  });

  console.log(`[ara-os-custodias-asignar] v${VERSION} · /api/ara-os/custodias/por-asignar`);
};
