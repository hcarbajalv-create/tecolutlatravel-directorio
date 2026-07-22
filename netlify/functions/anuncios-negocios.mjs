import { obtenerTodosLosNegocios } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Lista de negocios para el selector del panel de anuncios. Acepta rol
// "admin" o "colaborador" — a diferencia de dashboard-datos, que es solo admin.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const token = request.headers.get('x-session-token');
  const sesionValida = await validarSesion(token, ['admin', 'colaborador']);
  if (!sesionValida) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o vencida' }), {
      status: 401,
    });
  }

  try {
    const negocios = await obtenerTodosLosNegocios();
    const resultado = negocios.map(({ slug, datos }) => ({
      slug,
      nombre: datos.nombre,
      categoria: datos.categoria,
      plan: datos.plan || 'gratuito',
      totalFotos: datos.fotos?.length ?? 0,
      video: datos.video || null,
    }));

    return new Response(JSON.stringify({ ok: true, negocios: resultado }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
