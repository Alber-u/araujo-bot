// ============================================================
// AUTH · araujo-bot
// ============================================================
// Validación del token compartido que protege los endpoints
// administrativos (/api/ara-os/*, /api/personas, /panel, etc.).
//
// Diseñado para soportar rotación SIN downtime:
//
//   ADMIN_TOKEN         → token actual (el que mandan los clientes)
//   ADMIN_TOKEN_LEGACY  → opcional; token viejo aceptado durante
//                         el período de transición
//
// Flujo de rotación recomendado:
//   1. Estado normal: solo ADMIN_TOKEN definido en Render
//   2. Quieres rotar:
//      - Mueves valor actual a ADMIN_TOKEN_LEGACY
//      - Pones nuevo valor en ADMIN_TOKEN
//      - Backend acepta ambos → frontends pueden actualizarse
//        sin prisa, sin ventana de errores
//   3. Verificas que todos los frontends usan el nuevo
//   4. Borras ADMIN_TOKEN_LEGACY → rotación cerrada
//
// IMPORTANTE: el fallback `|| "araujo2026"` mantiene compat
// con el comportamiento histórico cuando la env var no está
// configurada. Cuando ADMIN_TOKEN sí está en Render (situación
// normal), el fallback es inalcanzable.
// ============================================================

function validToken(received) {
  if (!received) return false;
  const current = process.env.ADMIN_TOKEN || "araujo2026";
  const legacy = process.env.ADMIN_TOKEN_LEGACY;
  if (received === current) return true;
  if (legacy && received === legacy) return true;
  return false;
}

module.exports = { validToken };
