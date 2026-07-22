import { verificarLimite, registrarIntentoFallido, limpiarIntentos } from './_compartido/rateLimiter.mjs';
import { crearSesion } from './_compartido/sesiones.mjs';

// Valida la contraseña del dashboard interno y, si es correcta, emite un
// token de sesión de corta duración (el navegador ya no reenvía la
// contraseña real en cada petición de datos). Variable separada de
// WEBHOOK_SECRET a propósito, para no mezclar la credencial del bot de
// WhatsApp con la del panel interno.
export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  // Redundante con Netlify (ya fuerza HTTPS a nivel de plataforma antes de
  // que la petición llegue aquí) — solo como respaldo explícito.
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https') {
    return new Response(JSON.stringify({ ok: false, error: 'HTTPS requerido' }), { status: 403 });
  }

  const { permitido, ip, minutosRestantes } = await verificarLimite(request, context);
  if (!permitido) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`,
      }),
      { status: 429 },
    );
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400 });
  }

  const { clave } = cuerpo;
  if (!process.env.DASHBOARD_SECRET || clave !== process.env.DASHBOARD_SECRET) {
    await registrarIntentoFallido(ip);
    return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta' }), {
      status: 401,
    });
  }

  await limpiarIntentos(ip);
  const token = await crearSesion();

  return new Response(JSON.stringify({ ok: true, token }), { status: 200 });
};
