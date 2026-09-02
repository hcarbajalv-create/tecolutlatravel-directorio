import { getStore } from '@netlify/blobs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Bots cuyo consumo se muestra en el panel.
//
// Teco (el del sitio) escribe su uso desde netlify/functions/bot-teco.mjs.
// El bot de Xanath vive HOY fuera de este repo (Make.com + Chatwoot), así que
// todavía no tiene forma de reportar su consumo aquí. Cuando la tenga, basta
// agregar su entrada a esta lista: ni esta función ni la vista del panel
// tienen nada específico de Teco, recorren la lista tal cual.
//
// Para dar de alta un bot nuevo hacen falta dos cosas:
//   1. Que ese bot escriba en su store con la MISMA forma que Teco:
//      { porMes: { "2026-09": { "<modelo>": { entrada, salida, mensajes } } } }
//   2. Agregar aquí { id, nombre, store, clave }.
const BOTS = [
  { id: 'teco', nombre: 'Teco (sitio web)', store: 'bot-teco-uso', clave: 'uso' },
  // Pendiente: Xanath (WhatsApp) — ver nota de arriba.
  // { id: 'xanath', nombre: 'Xanath (WhatsApp)', store: 'bot-xanath-uso', clave: 'uso' },
];

const ALERTAS = { store: 'bot-teco-alertas', clave: 'log' };

// A diferencia del resto del panel, aquí se usa getStore directo y NO
// obtenerStoreDashboard: los stores del bot los ESCRIBE bot-teco.mjs con
// getStore normal (no está aislado por deploy). Si leyéramos con el store
// aislado, una vista previa mostraría siempre cero aunque el bot esté
// trabajando. Leer es seguro: esta función no escribe nada, así que una
// vista previa no puede ensuciar los datos reales.
function leerJson(nombreStore, clave) {
  return getStore({ name: nombreStore, consistency: 'strong' })
    .get(clave, { type: 'json' })
    .catch(() => null);
}

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
  // Mismo criterio que dashboard-datos/dashboard-busquedas: solo rol admin.
  // El consumo y las alertas de seguridad no los ve una sesión de colaborador.
  const sesionValida = await validarSesion(token, ['admin']);
  if (!sesionValida) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o vencida' }), {
      status: 401,
    });
  }

  try {
    const bots = await Promise.all(
      BOTS.map(async ({ id, nombre, store, clave }) => {
        const datos = await leerJson(store, clave);
        return {
          id,
          nombre,
          // "reportando: false" distingue un bot que todavía no manda datos
          // (store vacío) de uno que sí manda pero no tuvo actividad — para
          // no mostrar "0 pesos" como si fuera un dato medido.
          reportando: Boolean(datos && datos.porMes && Object.keys(datos.porMes).length > 0),
          porMes: datos?.porMes || {},
        };
      }),
    );

    const alertas = await leerJson(ALERTAS.store, ALERTAS.clave);

    return new Response(
      JSON.stringify({ ok: true, bots, eventos: alertas?.eventos || [] }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
