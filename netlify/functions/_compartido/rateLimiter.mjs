import { getStore } from '@netlify/blobs';

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const MAX_INTENTOS = 5;

function obtenerIp(request, context) {
  return (
    context?.ip ||
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'desconocida'
  );
}

function almacen(nombre) {
  return getStore({ name: nombre, consistency: 'strong' });
}

/**
 * Protección contra fuerza bruta en logins de paneles internos: máximo
 * 5 intentos fallidos por IP cada 15 minutos. Se guarda en Netlify Blobs
 * (no hay estado persistente entre invocaciones de una función serverless).
 * `nombreAlmacen` separa el conteo por endpoint (panel de resultados vs.
 * panel de anuncios), para que no compartan el mismo contador.
 */
export async function verificarLimite(request, context, nombreAlmacen) {
  const ip = obtenerIp(request, context);
  const registro = await almacen(nombreAlmacen).get(ip, { type: 'json' });

  if (!registro) return { permitido: true, ip };

  const transcurrido = Date.now() - registro.primerIntento;
  if (transcurrido > VENTANA_MS) return { permitido: true, ip };

  if (registro.intentos >= MAX_INTENTOS) {
    const minutosRestantes = Math.ceil((VENTANA_MS - transcurrido) / 60000);
    return { permitido: false, ip, minutosRestantes };
  }

  return { permitido: true, ip };
}

export async function registrarIntentoFallido(ip, nombreAlmacen) {
  const store = almacen(nombreAlmacen);
  const registro = await store.get(ip, { type: 'json' });
  const ahora = Date.now();

  if (!registro || ahora - registro.primerIntento > VENTANA_MS) {
    await store.setJSON(ip, { intentos: 1, primerIntento: ahora });
  } else {
    await store.setJSON(ip, { intentos: registro.intentos + 1, primerIntento: registro.primerIntento });
  }
}

export async function limpiarIntentos(ip, nombreAlmacen) {
  await almacen(nombreAlmacen).delete(ip);
}
