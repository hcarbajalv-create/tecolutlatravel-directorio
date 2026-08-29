import { getDeployStore, getStore } from '@netlify/blobs';

// Solo los contextos que Netlify identifica de forma positiva como no
// productivos se aíslan. Ante cualquier valor desconocido o ausente se usa
// producción: es preferible conservar la continuidad de los datos reales a
// perderlos silenciosamente por una detección incompleta.
const CONTEXTOS_AISLADOS = new Set(['deploy-preview', 'branch-deploy']);

export const CLAVE_METADATOS_DASHBOARD = '__metadatos_dashboard__';

export function obtenerStoreDashboard(nombre, { lecturaFuerte = false } = {}) {
  if (CONTEXTOS_AISLADOS.has(process.env.CONTEXT)) {
    // Netlify asocia este store únicamente al deploy actual. Así, una vista
    // previa puede registrar y consultar sus propias pruebas sin tocar el
    // store persistente del sitio.
    return getDeployStore(nombre);
  }

  // Producción (y cualquier contexto no reconocido) conserva los stores
  // persistentes de siempre. La lectura fuerte se solicita solo aquí.
  return lecturaFuerte ? getStore({ name: nombre, consistency: 'strong' }) : getStore(nombre);
}
