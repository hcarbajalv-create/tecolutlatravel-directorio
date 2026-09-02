import { getStore } from '@netlify/blobs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Gasto REAL de la cuenta de Anthropic, leído de la Admin API (Usage & Cost).
//
// Por qué existe: la pestaña "Bot" también muestra un costo calculado a partir
// de los tokens que reporta cada respuesta, con una tabla de precios escrita a
// mano. Eso es un ESTIMADO y se desfasa en cuanto cambian los precios. Esto de
// aquí es lo que Anthropic va a facturar de verdad, y además cubre al bot de
// Xanath, que vive fuera de este repo (Make.com) y por eso nunca podría
// reportar sus tokens al store del sitio.
//
// Separar el gasto por bot: cada bot usa su propia llave de API, así que se
// pide el uso agrupado por api_key_id y se cruza con la lista de llaves para
// mostrar el nombre de cada una ("Teco-bot-web", la de Xanath, etc.). No hace
// falta configurar IDs a mano.
//
// La llave de administración NUNCA sale de aquí: vive en la variable de
// entorno de Netlify, el navegador solo recibe los números ya procesados.
// Es una llave distinta y más poderosa que la del bot — da acceso a datos de
// toda la organización — por eso este endpoint exige sesión de admin.

const API = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';
// La documentación pide no consultar más de una vez por minuto y cachear el
// resultado en tableros. Se guarda 10 minutos: los datos tardan ~5 minutos en
// aparecer del lado de Anthropic, así que consultar más seguido no traería
// nada nuevo y sí gastaría llamadas.
const CACHE_MINUTOS = 10;
// Tope de páginas por consulta: evita que un rango grande deje la función
// dando vueltas hasta agotar su tiempo.
const MAX_PAGINAS = 5;

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function pedirAnthropic(ruta, params, adminKey) {
  const url = new URL(`${API}${ruta}`);
  for (const [clave, valor] of Object.entries(params)) {
    if (Array.isArray(valor)) valor.forEach((v) => url.searchParams.append(clave, v));
    else if (valor !== undefined) url.searchParams.set(clave, valor);
  }

  const respuesta = await fetch(url, {
    headers: {
      'x-api-key': adminKey,
      'anthropic-version': VERSION,
      // La documentación pide identificar integraciones propias.
      'User-Agent': 'TecolutlaTravel-Panel/1.0 (https://tecolutlatravel.mx)',
    },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    // El detalle puede traer datos de la organización: se registra en los logs
    // de Netlify (privados) pero al navegador solo va el código de estado.
    console.error('Admin API', ruta, respuesta.status, detalle.slice(0, 300));
    const error = new Error(`Admin API respondió ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

// Recorre las páginas mientras la API diga que hay más (has_more / next_page).
async function pedirTodo(ruta, params, adminKey) {
  const filas = [];
  let page;
  for (let i = 0; i < MAX_PAGINAS; i += 1) {
    const datos = await pedirAnthropic(ruta, { ...params, page }, adminKey);
    filas.push(...(datos.data || []));
    if (!datos.has_more || !datos.next_page) return { filas, completo: true };
    page = datos.next_page;
  }
  // Se avisa cuando el rango no cupo, en vez de mostrar un total incompleto
  // como si fuera el total real.
  return { filas, completo: false };
}

function inicioDeMesUTC() {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString();
}

// Los importes vienen como cadenas decimales en CENTAVOS de dólar (así lo
// documenta la Admin API: "decimal strings in lowest units (cents)"), no como
// número ni como dólares. Se convierte una sola vez, aquí, para que el resto
// del código trabaje siempre en dólares.
//
// VERIFICAR LA PRIMERA VEZ que haya datos reales: comparar el total que
// muestra el panel contra la página de Cost de la consola de Anthropic. Si
// sale 100 veces más grande o más chico, la unidad no era la que dice la
// documentación y lo único que hay que corregir es esta división.
function centavosADolares(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero / 100 : 0;
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Método no permitido' }, 405);
  }

  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https') {
    return json({ ok: false, error: 'HTTPS requerido' }, 403);
  }

  // Datos de facturación de toda la organización: solo admin, nunca
  // colaborador — mismo criterio que dashboard-datos.
  const sesionValida = await validarSesion(request.headers.get('x-session-token'), ['admin']);
  if (!sesionValida) {
    return json({ ok: false, error: 'Sesión inválida o vencida' }, 401);
  }

  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) {
    // Todavía sin configurar: el panel muestra instrucciones en vez de un
    // error rojo, porque no es una falla sino un paso pendiente.
    return json({ ok: true, configurado: false });
  }

  const cache = getStore({ name: 'gasto-anthropic', consistency: 'strong' });
  try {
    const guardado = await cache.get('ultimo', { type: 'json' });
    if (guardado && Date.now() - guardado.consultadoEn < CACHE_MINUTOS * 60 * 1000) {
      return json({ ...guardado.datos, ok: true, configurado: true, desdeCache: true });
    }
  } catch {
    // Sin caché se consulta de nuevo; no es motivo para fallar.
  }

  const desde = inicioDeMesUTC();
  const hasta = new Date().toISOString();

  try {
    // Las tres consultas son independientes entre sí.
    const [costo, uso, llaves] = await Promise.all([
      pedirTodo('/organizations/cost_report', {
        starting_at: desde,
        ending_at: hasta,
        'group_by[]': ['description'],
      }, adminKey),
      pedirTodo('/organizations/usage_report/messages', {
        starting_at: desde,
        ending_at: hasta,
        bucket_width: '1d',
        'group_by[]': ['api_key_id'],
      }, adminKey),
      // Para traducir apikey_01... al nombre que Hector le puso en la consola.
      pedirAnthropic('/organizations/api_keys', { limit: 100 }, adminKey)
        .then((d) => d.data || [])
        .catch(() => []), // sin nombres se muestran los IDs, no es fatal
    ]);

    const nombrePorLlave = new Map(llaves.map((k) => [k.id, k.name]));

    // Costo total del mes y desglose por concepto.
    let totalUsd = 0;
    const porConcepto = {};
    for (const bucket of costo.filas) {
      for (const item of bucket.results || []) {
        const usd = centavosADolares(item.amount);
        totalUsd += usd;
        const concepto = item.description || 'Otro';
        porConcepto[concepto] = (porConcepto[concepto] || 0) + usd;
      }
    }

    // Tokens por llave = por bot (cada bot tiene la suya).
    const porLlave = {};
    for (const bucket of uso.filas) {
      for (const item of bucket.results || []) {
        // El uso del playground de la consola no trae llave asociada.
        const id = item.api_key_id || 'sin-llave';
        const nombre = item.api_key_id
          ? nombrePorLlave.get(item.api_key_id) || item.api_key_id
          : 'Consola / playground';
        if (!porLlave[id]) porLlave[id] = { nombre, entrada: 0, salida: 0 };
        porLlave[id].entrada +=
          (item.uncached_input_tokens || 0) +
          (item.cache_read_input_tokens || 0) +
          (item.cache_creation_input_tokens || 0);
        porLlave[id].salida += item.output_tokens || 0;
      }
    }

    const datos = {
      desde,
      hasta,
      totalUsd,
      porConcepto,
      porLlave: Object.values(porLlave).sort((a, b) => b.salida - a.salida),
      // Si alguna consulta se quedó a medias, el panel lo dice en vez de
      // presentar un total parcial como si fuera el definitivo.
      completo: costo.completo && uso.completo,
    };

    await cache.setJSON('ultimo', { consultadoEn: Date.now(), datos }).catch(() => {});

    return json({ ...datos, ok: true, configurado: true, desdeCache: false });
  } catch (error) {
    // 401 aquí significa llave de administración inválida o revocada, que es
    // muy distinto de "la sesión del panel venció" — conviene distinguirlo.
    if (error.status === 401 || error.status === 403) {
      return json({ ok: false, error: 'llave-admin-invalida' }, 502);
    }
    return json({ ok: false, error: 'No se pudo consultar el gasto en Anthropic' }, 502);
  }
};
