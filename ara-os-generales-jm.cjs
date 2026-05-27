// ============================================================
// ARA OS · Generales JM · v0.1.0 · 27/05/2026
//
// Contadores semanales para JM (pestana "Generales"):
//   - Leads recibidos        (fecha_solicitud_pto esta semana)
//   - Visitas para presup    (fecha_visita_pto    esta semana)
//   - Presupuestos entregados (fecha_envio_pto    esta semana)
//   - Certificaciones hechas (certif_visitas.fecha esta semana)
//
// Alertas:
//   - Sin registros de tiempo hoy (en dia laborable)
//
// GET /api/ara-os/generales/jm
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

  function inWeek(fechaStr, lunes, domingo) {
    const d = parseFecha(fechaStr);
    if (!d) return false;
    return d >= lunes && d <= domingo;
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

  async function contarComunidades(lunes, domingo) {
    const rows = await leerHojaSafe("comunidades!A1:BD");
    if (!rows || rows.length < 2) return { visitas: 0, entregados: 0, leads: 0 };
    const headers = rows[0] || [];
    const idxBy = {};
    headers.forEach((h, i) => { idxBy[String(h || "").trim()] = i; });

    const iVisita = idxBy["fecha_visita_pto"];
    const iEnvio  = idxBy["fecha_envio_pto"];
    const iSol    = idxBy["fecha_solicitud_pto"];

    let visitas = 0, entregados = 0, leads = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      if (iVisita != null && inWeek(row[iVisita], lunes, domingo)) visitas++;
      if (iEnvio  != null && inWeek(row[iEnvio],  lunes, domingo)) entregados++;
      if (iSol    != null && inWeek(row[iSol],    lunes, domingo)) leads++;
    }
    return { visitas, entregados, leads };
  }

  async function contarCertificaciones(lunes, domingo) {
    const rows = await leerHojaSafe("certif_visitas!A1:Z");
    if (!rows || rows.length < 2) return 0;
    const headers = rows[0] || [];
    const idxBy = {};
    headers.forEach((h, i) => { idxBy[String(h || "").trim()] = i; });
    const iFecha  = idxBy["fecha"]  != null ? idxBy["fecha"]  : 2;
    const iEstado = idxBy["estado"];

    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      if (iEstado != null) {
        const est = String(row[iEstado] || "").trim().toLowerCase();
        if (est && est !== "cerrada" && est !== "emitida" && est !== "ok") continue;
      }
      if (inWeek(row[iFecha], lunes, domingo)) cnt++;
    }
    return cnt;
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

      const [com, cert, reg] = await Promise.all([
        contarComunidades(lunes, domingo),
        contarCertificaciones(lunes, domingo),
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
        version: "0.1.0",
        semana: {
          desde: lunes.toISOString().slice(0, 10),
          hasta: domingo.toISOString().slice(0, 10),
        },
        hoy: hoy.toISOString().slice(0, 10),
        es_laborable: esDiaLaborable(hoy),
        contadores: {
          leads_recibidos: {
            valor: com.leads,
            label: "Leads recibidos",
            sub: "esta semana",
            icon: "📥",
          },
          visitas_presupuesto: {
            valor: com.visitas,
            label: "Visitas para presupuesto",
            sub: "esta semana",
            icon: "👁",
          },
          presupuestos_entregados: {
            valor: com.entregados,
            label: "Presupuestos entregados",
            sub: "esta semana",
            icon: "📤",
          },
          certificaciones: {
            valor: cert,
            label: "Certificaciones hechas",
            sub: "esta semana",
            icon: "📋",
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

  console.log("[generales-jm] v0.1.0 cargado · contadores semanales");
};
