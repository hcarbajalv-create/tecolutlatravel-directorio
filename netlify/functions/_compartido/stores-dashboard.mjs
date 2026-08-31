import { getDeployStore, getStore } from '@netlify/blobs';

// Dos preguntas separadas: NETLIFY_DEV=true identifica la computadora local,
// donde no se toca Blob alguno. Ya en Netlify, context.deploy.context identifica
// positivamente previews/rama; solo esas usan el sandbox del deploy. Contexto
// ausente/desconocido conserva producción para no perder datos reales en silencio.
// context es obligatorio: una ruta olvidada falla visiblemente en revisión.
const CONTEXTOS_AISLADOS = new Set(['deploy-preview', 'branch-deploy']);
const MAX_INTENTOS = 6;
const PRESUPUESTO_MS = 1200;

export class ConflictoDeEscrituraError extends Error {
  constructor() {
    super('No se pudo guardar el evento por actividad simultánea.');
    this.name = 'ConflictoDeEscrituraError';
    this.status = 409;
  }
}

function tieneCondicionDeEscritura(encabezados) {
  if (encabezados instanceof Headers) {
    return encabezados.has('if-match') || encabezados.has('if-none-match');
  }
  return Boolean(encabezados?.['if-match'] || encabezados?.['if-none-match']);
}

async function fetchConConflictoNormalizado(entrada, opciones) {
  const respuesta = await fetch(entrada, opciones);
  const esPut = String(opciones?.method).toUpperCase() === 'PUT';
  if (esPut && respuesta.status === 409 && tieneCondicionDeEscritura(opciones?.headers)) {
    // @netlify/blobs 10.7.9 solo reconoce 412 como conflicto condicional y
    // reporta 409 como modified:true. Blobs devuelve 409 para esta misma
    // colisión; se normaliza para que el cliente reintente honestamente.
    // Al actualizar la librería, comprobar si ya maneja 409 en set/setJSON:
    // si lo hace, retirar este envoltorio. No aplica a PUT sin condición.
    return new Response(respuesta.body, { status: 412, statusText: 'Precondition Failed', headers: respuesta.headers });
  }
  return respuesta;
}

export function obtenerStoreDashboard(contextoFuncion, nombre, { lecturaFuerte = false } = {}) {
  if (!contextoFuncion || typeof contextoFuncion !== 'object') {
    throw new Error('Se requiere el context de Netlify para elegir el almacén de datos.');
  }
  if (process.env.NETLIFY_DEV === 'true') return { store: null, modo: 'local', deployId: null };

  const contextoDeploy = contextoFuncion.deploy?.context;
  const deployId = typeof contextoFuncion.deploy?.id === 'string' ? contextoFuncion.deploy.id : null;
  if (CONTEXTOS_AISLADOS.has(contextoDeploy)) {
    if (!deployId) throw new Error('La vista previa no proporcionó su ID de deploy.');
    const opciones = { name: nombre, deployID: deployId, fetch: fetchConConflictoNormalizado };
    return {
      store: lecturaFuerte ? getDeployStore({ ...opciones, consistency: 'strong' }) : getDeployStore(opciones),
      modo: 'prueba', deployId,
    };
  }
  return {
    store: lecturaFuerte
      ? getStore({ name: nombre, consistency: 'strong', fetch: fetchConConflictoNormalizado })
      : getStore({ name: nombre, fetch: fetchConConflictoNormalizado }),
    modo: 'produccion', deployId,
  };
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function actualizarJsonConReintentos(store, clave, crear, cambiar) {
  const inicio = Date.now();
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    if (Date.now() - inicio >= PRESUPUESTO_MS) throw new ConflictoDeEscrituraError();
    const existente = await store.getWithMetadata(clave, { type: 'json', consistency: 'strong' });
    const siguiente = existente?.data ?? crear();
    if (cambiar(siguiente) === false) return { data: siguiente, modificado: false };
    // @netlify/blobs 10.7.9 tiene un defecto en setJSON: desparrama las
    // conditions en vez de pasarlas como `conditions` al cliente interno,
    // por lo que no envía If-Match/If-None-Match aunque diga modified:true.
    // set sí las transmite correctamente. No sustituir por setJSON hasta que
    // la versión instalada corrija ese comportamiento y se vuelva a verificar.
    const resultado = existente
      ? await store.set(clave, JSON.stringify(siguiente), { onlyIfMatch: existente.etag })
      : await store.set(clave, JSON.stringify(siguiente), { onlyIfNew: true });
    if (resultado.modified) return { data: siguiente, modificado: true };
    if (intento < MAX_INTENTOS) {
      const restante = PRESUPUESTO_MS - (Date.now() - inicio);
      if (restante <= 0) break;
      await esperar(Math.min(restante, 20 * 2 ** (intento - 1) + Math.floor(Math.random() * 20)));
    }
  }
  throw new ConflictoDeEscrituraError();
}
