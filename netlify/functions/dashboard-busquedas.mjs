import { getStore } from '@netlify/blobs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Lectura del store 'busquedas' (ver registrar-busqueda.mjs) para la
// sección "Qué busca la gente" de /panel-interno-tt. Mismo esquema de
// protección que dashboard-datos.mjs: solo rol admin, con token de sesión
// de corta duración — sin sesión válida no se devuelve ningún dato.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https') {
    return new Response(JSON.stringify({ ok: false, error: 'HTTPS requerido' }), { status: 403 });
  }

  const token = request.headers.get('x-session-token');
  const sesionValida = await validarSesion(token, ['admin']);
  if (!sesionValida) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o vencida' }), {
      status: 401,
    });
  }

  try {
    const store = getStore('busquedas');
    const registro = (await store.get('registro', { type: 'json' })) || { porMes: {} };

    return new Response(JSON.stringify({ ok: true, porMes: registro.porMes }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
