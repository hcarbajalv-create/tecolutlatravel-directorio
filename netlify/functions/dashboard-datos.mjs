import { getStore } from '@netlify/blobs';
import { calcularPuntaje, generarRecomendaciones } from '../../src/utils/puntajeCompletitud.ts';
import { obtenerTodosLosNegocios } from './_compartido/github.mjs';

// Esta función es la protección real de los datos (no solo dashboard-auth):
// valida el mismo DASHBOARD_SECRET en cada llamada, así que aunque alguien
// se salte la pantalla de login y llame esta función directo, sin la clave
// correcta no recibe ningún dato.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const secretoRecibido = request.headers.get('x-dashboard-secret');
  if (!process.env.DASHBOARD_SECRET || secretoRecibido !== process.env.DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), { status: 401 });
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
