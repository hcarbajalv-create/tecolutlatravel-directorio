import { verificarLimite, registrarIntentoFallido, limpiarIntentos } from './_compartido/rateLimiter.mjs';
import { crearSesion } from './_compartido/sesiones.mjs';

// Login del panel de anuncios (/panel-anuncios): acepta la contraseña de
// administrador (DASHBOARD_SECRET, la misma del panel de resultados) O la
// de colaborador (DASHBOARD_SECRET_COLABORADOR, exclusiva de este panel).
// La sesión emitida queda marcada con el rol correspondiente — la de
// colaborador nunca sirve en dashboard-datos (panel-interno-tt), sin
// importar qué token se use ahí, porque ese endpoint solo acepta rol "admin".
export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https') {
    return new Response(JSON.stringify({ ok: false, error: 'HTTPS requerido' }), { status: 403 });
  }

  const { permitido, ip, minutosRestantes } = await verificarLimite(
    request,
    context,
    'intentos-login-anuncios',
  );
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
  let rol = null;
  if (process.env.DASHBOARD_SECRET && clave === process.env.DASHBOARD_SECRET) {
    rol = 'admin';
  } else if (
    process.env.DASHBOARD_SECRET_COLABORADOR &&
    clave === process.env.DASHBOARD_SECRET_COLABORADOR
  ) {
    rol = 'colaborador';
  }

  if (!rol) {
    await registrarIntentoFallido(ip, 'intentos-login-anuncios');
    return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta' }), {
      status: 401,
    });
  }

  await limpiarIntentos(ip, 'intentos-login-anuncios');
  const token = await crearSesion(rol);

  return new Response(JSON.stringify({ ok: true, token, rol }), { status: 200 });
};
