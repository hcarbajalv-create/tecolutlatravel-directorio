import { calcularPuntaje, generarRecomendaciones } from '../../src/utils/puntajeCompletitud.ts';
import { obtenerTodosLosNegocios } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';
import {
  CLAVE_METADATOS_DASHBOARD,
  obtenerStoreDashboard,
} from './_compartido/stores-dashboard.mjs';

const ESTADISTICAS_VACIAS = {
  vistasTotal: 0,
  clicsTotal: 0,
  porMes: {},
};

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
    let store = null;
    try {
      store = obtenerStoreDashboard('estadisticas-negocios');
    } catch (error) {
      // Las estadísticas complementan al panel, pero no deben impedir que
      // se muestren los negocios si el servicio de métricas no responde.
      console.warn('No se pudo conectar el almacén de estadísticas:', error);
    }

    const resultado = await Promise.all(
      negocios.map(async ({ slug, datos }) => {
        let stats = ESTADISTICAS_VACIAS;
        if (store) {
          try {
            stats = (await store.get(slug, { type: 'json' })) || ESTADISTICAS_VACIAS;
          } catch (error) {
            console.warn(`No se pudieron leer las estadísticas de ${slug}:`, error);
          }
        }
        return {
          slug,
          nombre: datos.nombre,
          categoria: datos.categoria,
          destacado: Boolean(datos.destacado),
          plan: datos.plan || 'gratuito',
          puntaje: calcularPuntaje(datos),
          recomendaciones: generarRecomendaciones(datos),
          stats,
        };
      }),
    );

    let accionesRegistradasDesde = null;
    if (store) {
      try {
        const metadatos = await store.get(CLAVE_METADATOS_DASHBOARD, { type: 'json' });
        accionesRegistradasDesde = metadatos?.accionesRegistradasDesde || null;
      } catch (error) {
        console.warn('No se pudieron leer los metadatos de acciones:', error);
      }
    }

    return new Response(JSON.stringify({ ok: true, negocios: resultado, accionesRegistradasDesde }), { status: 200 });
  } catch (error) {
    console.error('No se pudieron cargar los datos del panel:', error);
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
