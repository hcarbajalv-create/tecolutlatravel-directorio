import { cerrarSesion } from './_compartido/sesiones.mjs';

// Invalida el token de sesión del lado del servidor al cerrar sesión —
// simple higiene, no crítico ya que las sesiones expiran solas a las 3h.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const token = request.headers.get('x-session-token');
  await cerrarSesion(token);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
