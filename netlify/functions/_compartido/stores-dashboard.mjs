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
  constructor(intentos = MAX_INTENTOS, conflictos = 0) {
    super('No se pudo guardar el evento por actividad simultánea.');
    this.name = 'ConflictoDeEscrituraError';
    this.status = 409;
    this.intentos = intentos;
    this.conflictos = conflictos;
  }
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
    const opciones = { name: nombre, deployID: deployId };
    return {
      store: lecturaFuerte ? getDeployStore({ ...opciones, consistency: 'strong' }) : getDeployStore(opciones),
      modo: 'prueba', deployId,
    };
  }
  return {
    store: lecturaFuerte ? getStore({ name: nombre, consistency: 'strong' }) : getStore(nombre),
    modo: 'produccion', deployId,
  };
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function actualizarJsonConReintentos(store, clave, crear, cambiar) {
  const inicio = Date.now();
  let conflictos = 0;
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    if (Date.now() - inicio >= PRESUPUESTO_MS) throw new ConflictoDeEscrituraError(intento - 1, conflictos);
    const existente = await store.getWithMetadata(clave, { type: 'json', consistency: 'strong' });
    const siguiente = existente?.data ?? crear();
    if (cambiar(siguiente) === false) return { data: siguiente, modificado: false, intentos: intento, conflictos };
    // @netlify/blobs 10.7.9 tiene un defecto en setJSON: desparrama las
    // conditions en vez de pasarlas como `conditions` al cliente interno,
    // por lo que no envía If-Match/If-None-Match aunque diga modified:true.
    // set sí las transmite correctamente. No sustituir por setJSON hasta que
    // la versión instalada corrija ese comportamiento y se vuelva a verificar.
    const resultado = existente
      ? await store.set(clave, JSON.stringify(siguiente), { onlyIfMatch: existente.etag })
      : await store.set(clave, JSON.stringify(siguiente), { onlyIfNew: true });
    if (resultado.modified) return { data: siguiente, modificado: true, intentos: intento, conflictos };
    conflictos += 1;
    if (intento < MAX_INTENTOS) {
      const restante = PRESUPUESTO_MS - (Date.now() - inicio);
      if (restante <= 0) break;
      await esperar(Math.min(restante, 20 * 2 ** (intento - 1) + Math.floor(Math.random() * 20)));
    }
  }
  throw new ConflictoDeEscrituraError(MAX_INTENTOS, conflictos);
}
