// ============================================================
// ARA OS · Generales JM · v0.1.2 · 27/05/2026
//
// v0.1.2 — Doble ventana: contadores devuelven valor_semana y valor_30d.
// v0.1.1 — Anade ?debug=1 con muestra de fechas.
// v0.1.0 — Contadores semanales + alerta sin registros hoy.
// ============================================================

module.exports = function setupGeneralesJM(app) {
  const { google } = require("googleapis");
  const { validToken } = require("./lib/auth.cjs");

  function tokenValido(req) { return validToken(req.query.token); }

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  function getSheets() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.sheets({ version: "v4", auth });
  }

  async function leerHojaSafe(rango) {
    try {
      const sheets = getSheets();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: rango,
      });
      return r.data.values || [];
    } catch (err) {
      console.warn("[generales-jm/leerHojaSafe]", rango, err.message);
      return [];
    }
  }

  function parseFecha(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;
    let d;
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let dd = m[1]; let mm = m[2]; let yy = m[3];
      if (yy.length === 2) yy = "20" + yy;
      d = new Date(yy + "-" + mm.padStart(2,"0") + "-" + dd.padStart(2,"0") + "T12:00:00Z");
    } else {
      d = new Date(str);
    }
    return isNaN(d.getTime()) ? null : d;
  }

  function inicioSemanaLunes(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function finSemanaDomingo(date) {
    const d = inicioSemanaLunes(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  function hace30Dias(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function inRango(fechaStr, desde, hasta) {
    const d = parseFecha(fechaStr);
    if (!d) return false;
    return d >= desde && d <= hasta;
  }
  function isToday(fechaStr, today) {
    const d = parseFecha(fechaStr);
    if (!d) return false;
    return d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  }
  function esDiaLaborable(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  async function contarComunidades(lunes, domingo, hace30, hoy) {
    const rows = await leerHojaSafe("comunidades!A1:BD");
    if (!rows || rows.length < 2) {
      return {
        visitas: { semana: 0, m30: 0 }, entregados: { semana: 0, m30: 0 }, leads: { semana: 0, m30: 0 },
      };
    }
    const headers = rows[0] || [];
    const idxBy = {};
    headers.forEach((h, i) => { idxBy[String(h || "").trim()] = i; });

    const iVisita = idxBy["fecha_visita_pto"];
    const iEnvio  = idxBy["fecha_envio_pto"];
    const iSol    = idxBy["fecha_solicitud_pto"];

    const out = {
      visitas:    { semana: 0, m30: 0 },
      entregados: { semana: 0, m30: 0 },
      leads:      { semana: 0, m30: 0 },
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      if (iVisita != null && row[iVisita]) {
        if (inRango(row[iVisita], lunes, domingo)) out.visitas.semana++;
        if (inRango(row[iVisita], hace30, hoy))    out.visitas.m30++;
      }
      if (iEnvio != null && row[iEnvio]) {
        if (inRango(row[iEnvio], lunes, domingo)) out.entregados.semana++;
        if (inRango(row[iEnvio], hace30, hoy))    out.entregados.m30++;
      }
      if (iSol != null && row[iSol]) {
        if (inRango(row[iSol], lunes, domingo)) out.leads.semana++;
        if (inRango(row[iSol], hace30, hoy))    out.leads.m30++;
      }
    }
    return out;
  }

  async function contarCertificaciones(lunes, domingo, hace30, hoy) {
    const rows = await leerHojaSafe("certif_visitas!A1:Z");
    if (!rows || rows.length < 2) return { semana: 0, m30: 0 };
    const headers = rows[0] || [];
    const idxBy = {};
    headers.forEach((h, i) => { idxBy[String(h || "").trim()] = i; });
    const iFecha  = idxBy["fecha"]  != null ? idxBy["fecha"]  : 2;
    const iEstado = idxBy["estado"];

    let semana = 0, m30 = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      if (iEstado != null) {
        const est = String(row[iEstado] || "").trim().toLowerCase();
        if (est && est !== "cerrada" && est !== "emitida" && est !== "ok") continue;
      }
      if (inRango(row[iFecha], lunes, domingo)) semana++;
      if (inRango(row[iFecha], hace30, hoy))    m30++;
    }
    return { semana, m30 };
  }

  async function registrosHoy() {
    const rows = await leerHojaSafe("registros_tiempo!A1:N");
    if (!rows || rows.length < 2) return { count: 0, personas: 0, personas_lista: [] };
    const headers = rows[0] || [];
    const idxBy = {};
    headers.forEach((h, i) => { idxBy[String(h || "").trim()] = i; });
    const iFecha   = idxBy["fecha"]      != null ? idxBy["fecha"]      : 1;
    const iPersona = idxBy["persona_id"] != null ? idxBy["persona_id"] : 2;
    const iBorrado = idxBy["borrado"];

    const hoy = new Date();
    const personas = new Set();
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      if (iBorrado != null && String(row[iBorrado] || "").toUpperCase() === "TRUE") continue;
      if (isToday(row[iFecha], hoy)) {
        count++;
        const p = String(row[iPersona] || "").trim();
        if (p) personas.add(p);
      }
    }
    return { count, personas: personas.size, personas_lista: Array.from(personas) };
  }

  app.options("/api/ara-os/generales/jm", (req, res) => {
    responderCORS(res); res.status(204).end();
  });

  app.get("/api/ara-os/generales/jm", async (req, res) => {
    responderCORS(res);
    if (!tokenValido(req)) return res.status(401).json({ error: "Token invalido" });
    try {
      const hoy = new Date();
      const lunes = inicioSemanaLunes(hoy);
      const domingo = finSemanaDomingo(hoy);
      const hace30 = hace30Dias(hoy);

      const [com, cert, reg] = await Promise.all([
        contarComunidades(lunes, domingo, hace30, hoy),
        contarCertificaciones(lunes, domingo, hace30, hoy),
        registrosHoy(),
      ]);

      const alertas = [];
      if (esDiaLaborable(hoy) && reg.count === 0) {
        alertas.push({
          tipo: "sin_registros_hoy",
          criticidad: "critico",
          mensaje: "Hoy nadie ha registrado horas",
          detalle: "Acuerdate de registrar el parte de los trabajadores",
        });
      } else if (esDiaLaborable(hoy) && reg.personas < 2) {
        alertas.push({
          tipo: "pocos_registros_hoy",
          criticidad: "aviso",
          mensaje: `Solo ${reg.personas} persona${reg.personas === 1 ? "" : "s"} con registro hoy`,
          detalle: "Revisa si falta alguien por registrar",
        });
      }

      res.json({
        ok: true,
        version: "0.1.2",
        semana: {
          desde: lunes.toISOString().slice(0, 10),
          hasta: domingo.toISOString().slice(0, 10),
        },
        hoy: hoy.toISOString().slice(0, 10),
        es_laborable: esDiaLaborable(hoy),
        contadores: {
          leads_recibidos: {
            valor: com.leads.semana,
            valor_30d: com.leads.m30,
            label: "Leads recibidos",
          },
          visitas_presupuesto: {
            valor: com.visitas.semana,
            valor_30d: com.visitas.m30,
            label: "Visitas para presupuesto",
          },
          presupuestos_entregados: {
            valor: com.entregados.semana,
            valor_30d: com.entregados.m30,
            label: "Presupuestos entregados",
          },
          certificaciones: {
            valor: cert.semana,
            valor_30d: cert.m30,
            label: "Certificaciones hechas",
          },
        },
        registros_hoy: {
          total:    reg.count,
          personas: reg.personas,
          lista:    reg.personas_lista,
        },
        alertas,
      });
    } catch (err) {
      console.error("[generales-jm]", err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[generales-jm] v0.1.2 cargado · doble ventana");
};
