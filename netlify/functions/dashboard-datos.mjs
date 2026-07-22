import { getStore } from '@netlify/blobs';
import { calcularPuntaje, generarRecomendaciones } from '../../src/utils/puntajeCompletitud.ts';
import { obtenerTodosLosNegocios } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Protección real de los datos: valida un token de sesión de corta duración
// (emitido por dashboard-auth al hacer login), no la contraseña en texto
// plano — así el navegador no reenvía DASHBOARD_SECRET en cada petición.
// Aunque alguien se salte la pantalla de login y llame esta función
// directo, sin un token de sesión vigente no recibe ningún dato.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  // Redundante con Netlify (ya fuerza HTTPS a nivel de plataforma) — respaldo.
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https') {
    return new Response(JSON.stringify({ ok: false, error: 'HTTPS requerido' }), { status: 403 });
  }

  const token = request.headers.get('x-session-token');
  // Solo rol "admin" — una sesión de colaborador (panel-anuncios) nunca
  // debe poder leer estos datos, aunque conozca este endpoint.
  const sesionValida = await validarSesion(token, ['admin']);
  if (!sesionValida) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o vencida' }), {
      status: 401,
    });
  }

  try {
    const negocios = await obtenerTodosLosNegocios();
    const store = getStore('estadisticas-negocios');

    const resultado = await Promise.all(
      negocios.map(async ({ slug, datos }) => {
        const stats = (await store.get(slug, { type: 'json' })) || {
          vistasTotal: 0,
          clicsTotal: 0,
          porMes: {},
        };
        return {
          slug,
          nombre: datos.nombre,
          categoria: datos.categoria,
          destacado: Boolean(datos.destacado),
          puntaje: calcularPuntaje(datos),
          recomendaciones: generarRecomendaciones(datos),
          stats,
        };
      }),
    );

    return new Response(JSON.stringify({ ok: true, negocios: resultado }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
