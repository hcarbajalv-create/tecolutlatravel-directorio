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
// Devuelve { consultado, valor } en vez de solo el valor. La diferencia
// importa: si Blobs falla y se devolviera null a secas, el panel no podría
// distinguir "consulté y no hay nada" de "no pude consultar", y acabaría
// diciendo "sin eventos sospechosos" cuando en realidad no sabe. En una
// sección de seguridad esa afirmación falsa es peor que no mostrar nada.
async function leerJson(nombreStore, clave) {
  try {
    const valor = await getStore({ name: nombreStore, consistency: 'strong' }).get(clave, {
      type: 'json',
    });
    // valor null aquí sí significa "la clave todavía no existe", que es un
    // resultado legítimo: la consulta funcionó.
    return { consultado: true, valor };
  } catch (error) {
    console.error('dashboard-bot: no se pudo leer', nombreStore, String(error?.message || error));
    return { consultado: false, valor: null };
  }
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
        const { consultado, valor } = await leerJson(store, clave);
        return {
          id,
          nombre,
          // Mismo cuidado que con las alertas: si la lectura falló, el panel
          // no debe decir "todavía no reporta consumo" — no lo sabe.
          consultado,
          // "reportando: false" distingue un bot que todavía no manda datos
          // (store vacío) de uno que sí manda pero no tuvo actividad — para
          // no mostrar "0 pesos" como si fuera un dato medido.
          reportando: Boolean(valor && valor.porMes && Object.keys(valor.porMes).length > 0),
          porMes: valor?.porMes || {},
        };
      }),
    );

    const alertas = await leerJson(ALERTAS.store, ALERTAS.clave);

    return new Response(
      JSON.stringify({
        ok: true,
        bots,
        // Bandera explícita: una lista vacía de eventos puede significar "no
        // hubo intentos" o "no se pudo leer el registro", y el panel necesita
        // saber cuál de las dos para no afirmar lo que no sabe.
        alertasConsultadas: alertas.consultado,
        eventos: alertas.valor?.eventos || [],
      }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
