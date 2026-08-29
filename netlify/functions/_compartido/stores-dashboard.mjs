import { getDeployStore, getStore } from '@netlify/blobs';

// Esta decisión responde dos preguntas separadas, en este orden:
//
// 1. ¿La función corre en la computadora del desarrollador? Netlify Dev
//    coloca NETLIFY_DEV=true incluso si se arranca con --context production.
//    En ese caso no se toca ningún Blob de datos: los registradores hacen
//    no-op y el dashboard recibe datos vacíos. SITE_ID, DEPLOY_ID y URL no
//    sirven para distinguirlo porque Netlify Dev puede cargar esos valores.
//
// 2. Si corre alojada en Netlify, ¿qué tipo de deploy es? Solo los contextos
//    que Netlify identifica positivamente como vista previa o rama usan un
//    store del deploy. Producción y un contexto ausente o desconocido usan
//    el store persistente: es preferible conservar datos reales a perderlos
//    silenciosamente por una detección incompleta.
const CONTEXTOS_AISLADOS = new Set(['deploy-preview', 'branch-deploy']);

export const CLAVE_METADATOS_DASHBOARD = '__metadatos_dashboard__';

export function obtenerStoreDashboard(nombre, { lecturaFuerte = false } = {}) {
  if (process.env.NETLIFY_DEV === 'true') return null;

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
