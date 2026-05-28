/**
 * ara-os-ia-descripcion.cjs · v0.1.0 (28/05/2026)
 * --------------------------------------------------------------
 * Endpoint que redacta una descripción profesional para el
 * presupuesto a partir del nombre, tipo y partidas detalladas.
 *
 * POST /api/ara-os/ia/redactar-descripcion-presupuesto
 *   Body:
 *     { nombre, tipo, partidas: [{concepto, horas, ...}], hint? }
 *   Respuesta:
 *     { ok: true, descripcion: "..." }   ← markdown ligero, listo
 *                                          para meter en notas/factura
 *
 * Usa OpenAI gpt-4o-mini (ya configurado en index.cjs para visión).
 * Protegido por PIN como el resto de endpoints administrativos.
 * --------------------------------------------------------------
 */

const axios = require("axios");
const { validToken } = require("./lib/auth.cjs");

module.exports = function(app) {
  const express = require("express");
  const jsonBodyParser = express.json({ limit: "256kb" });

  function responderCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  const SYSTEM_PROMPT = `Eres un redactor técnico de presupuestos de fontanería e instalaciones para Instalaciones Araujo (Sevilla). Recibes el nombre del trabajo, el tipo y las partidas detalladas que se van a ejecutar, y devuelves una descripción profesional para enviar al cliente.

REGLAS:
- Tono: profesional, claro, en español de España.
- Estructura: un párrafo de apertura (1-2 frases) que resuma el alcance, seguido de un listado con guion "-" de las actuaciones concretas en orden lógico (demolición → instalación → acabado → retirada).
- No inventes garantías, plazos ni precios. Sólo describe lo que se va a hacer en base a las partidas.
- Si una partida ya viene clara, reescríbela mejor; no la copies literal.
- Si hay partidas relacionadas (p.ej. demolición + alicatado), agrúpalas.
- Menciona materiales concretos cuando estén en las partidas (PVC, fibrocemento, etc.).
- Termina con una línea sobre la gestión de residuos / certificados si aplica al tipo de obra.
- Longitud objetivo: 8-14 líneas en total.
- NO uses markdown (ni *, ni #, ni **). Texto plano con guiones para los puntos.
- NO incluyas precios, totales ni IVA.
- NO te despidas ("Quedamos a su disposición..."). Esto va aparte.`;

  function construirInput(body) {
    const nombre = String(body.nombre || "").trim() || "(sin nombre)";
    const tipo = String(body.tipo || "").trim() || "otros";
    const hint = String(body.hint || "").trim();
    const partidas = Array.isArray(body.partidas) ? body.partidas : [];

    const lineas = partidas
      .filter(p => p && p.concepto)
      .map(p => {
        const horas = Number(p.horas) || 0;
        const mat = Number(p.material_eur ?? p.material_coste) || 0;
        const ph = Number(p.precio_hora) || 0;
        const det = [];
        if (horas > 0)  det.push(`${horas}h`);
        if (ph > 0)     det.push(`${ph}€/h`);
        if (mat > 0)    det.push(`material ${mat}€`);
        return `- ${String(p.concepto).trim()}${det.length ? ` (${det.join(", ")})` : ""}`;
      })
      .join("\n");

    return [
      `NOMBRE: ${nombre}`,
      `TIPO: ${tipo}`,
      "",
      "PARTIDAS:",
      lineas || "(sin partidas detalladas)",
      hint ? `\nINDICACIONES DEL USUARIO: ${hint}` : "",
    ].filter(Boolean).join("\n");
  }

  app.options("/api/ara-os/ia/redactar-descripcion-presupuesto", (req, res) => {
    responderCORS(res); res.status(204).end();
  });

  app.post("/api/ara-os/ia/redactar-descripcion-presupuesto", jsonBodyParser, async (req, res) => {
    responderCORS(res);
    try {
      if (!validToken(req.query.token)) {
        return res.status(403).json({ ok: false, error: "PIN inválido" });
      }
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ ok: false, error: "Falta OPENAI_API_KEY en el servidor" });
      }

      const userPrompt = construirInput(req.body || {});

      const r = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: userPrompt },
          ],
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type":  "application/json",
          },
          timeout: 25000,
        }
      );

      const descripcion = String(r.data?.choices?.[0]?.message?.content || "").trim();
      if (!descripcion) {
        return res.status(502).json({ ok: false, error: "La IA no devolvió texto" });
      }
      res.json({ ok: true, descripcion });
    } catch (e) {
      console.error("[ia redactar-descripcion]", e.response?.data || e.message);
      res.status(500).json({ ok: false, error: e.response?.data?.error?.message || e.message });
    }
  });

  console.log("[ara-os-ia-descripcion v0.1.0] montado");
};
