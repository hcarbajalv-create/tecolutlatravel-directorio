import { validarSesion } from './_compartido/sesiones.mjs';
import { obtenerStoreDashboard } from './_compartido/stores-dashboard.mjs';

const TERMINO_DE_PRUEBA = 'prueba-deploy-conversion-busquedas';
const MARCA_LIMPIEZA_PRUEBA = 'limpiezaPruebaDeployV1';

function eliminarTerminoDePrueba(registro) {
  if (registro.mantenimiento?.[MARCA_LIMPIEZA_PRUEBA]) return false;

  for (const datosMes of Object.values(registro.porMes || {})) {
    for (const campo of ['terminos', 'sinResultado']) {
      if (datosMes[campo] && Object.hasOwn(datosMes[campo], TERMINO_DE_PRUEBA)) {
        delete datosMes[campo][TERMINO_DE_PRUEBA];
      }
    }
  }
  if (!registro.mantenimiento) registro.mantenimiento = {};
  // La marca vuelve esta migración de una sola vez: después de limpiar el
  // dato conocido no se vuelve a escribir el store al abrir el dashboard.
  registro.mantenimiento[MARCA_LIMPIEZA_PRUEBA] = true;
  return true;
}

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
    const store = obtenerStoreDashboard('busquedas', { lecturaFuerte: true });
    // Netlify Dev no consulta el historial real: el panel local muestra una
    // sección vacía, igual que una vista previa recién creada.
    if (!store) return new Response(JSON.stringify({ ok: true, porMes: {} }), { status: 200 });
    const registro = (await store.get('registro', { type: 'json' })) || { porMes: {} };
    // El término se creó durante una prueba controlada de despliegue. Esta
    // migración se ejecuta una sola vez y usa lectura fuerte para no reescribir
    // una versión vieja que pudiera borrar búsquedas reales.
    if (eliminarTerminoDePrueba(registro)) await store.setJSON('registro', registro);

    return new Response(JSON.stringify({ ok: true, porMes: registro.porMes }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
