// ─────────────────────────────────────────────────────────────────────────
// bot-teco-token.mjs — Entrega un "pase" temporal (token) al cargar la página.
// El widget lo pide y lo manda con cada mensaje; bot-teco.mjs lo verifica.
// Así, quien no cargó la página (scripts automáticos que golpean la API en seco)
// no puede usar el bot. No expone la llave: el token se firma con HMAC en el
// servidor usando un secreto que nunca sale de aquí.
// ─────────────────────────────────────────────────────────────────────────
import { createHmac } from 'node:crypto';

const VIGENCIA_MS = 30 * 60 * 1000; // el pase dura 30 minutos

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Firma un token: payload (con expiración) + firma HMAC. El secreto es la propia
// llave de la API (ya vive en el servidor, nunca se expone).
export function firmarToken(secreto) {
  const payload = b64url(JSON.stringify({ exp: Date.now() + VIGENCIA_MS }));
  const firma = b64url(createHmac('sha256', secreto).update(payload).digest());
  return `${payload}.${firma}`;
}

export default async (request) => {
  const secreto = process.env.ANTHROPIC_API_KEY_TECO;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!secreto) {
    // Sin llave, el bot no está encendido: devolvemos un token "vacío" inofensivo.
    return new Response(JSON.stringify({ token: '' }), { status: 200, headers });
  }
  return new Response(JSON.stringify({ token: firmarToken(secreto) }), { status: 200, headers });
};
