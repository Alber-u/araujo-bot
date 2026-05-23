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
// IMPORTANTE: cuando ADMIN_TOKEN no está configurada (env var
// ausente), `current` es undefined y validToken retorna `false`
// para todo (fail-safe). Esto es deliberado: si Render pierde la
// env var, el backend rechaza todas las peticiones administrativas
// en vez de aceptar un token hardcoded. Es preferible un 403
// visible a una vulnerabilidad silenciosa.
// ============================================================

function validToken(received) {
  if (!received) return false;
  const current = process.env.ADMIN_TOKEN;
  const legacy = process.env.ADMIN_TOKEN_LEGACY;
  if (current && received === current) return true;
  if (legacy && received === legacy) return true;
  return false;
}

module.exports = { validToken };
