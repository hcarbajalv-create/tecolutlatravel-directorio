import { getStore } from '@netlify/blobs';

const DURACION_SESION_MS = 3 * 60 * 60 * 1000; // 3 horas

/**
 * Sesiones de corta duración para el panel interno: en vez de que el
 * navegador reenvíe la contraseña real en cada petición de datos, el login
 * emite un token temporal que se valida y expira solo.
 */
export async function crearSesion() {
  const token = crypto.randomUUID();
  const store = getStore({ name: 'sesiones-panel', consistency: 'strong' });
  const ahora = Date.now();
  await store.setJSON(token, { creado: ahora, expira: ahora + DURACION_SESION_MS });
  return token;
}

export async function validarSesion(token) {
  if (!token) return false;
  const store = getStore({ name: 'sesiones-panel', consistency: 'strong' });
  const sesion = await store.get(token, { type: 'json' });
  if (!sesion) return false;

  if (Date.now() > sesion.expira) {
    await store.delete(token); // limpieza oportunista de sesiones vencidas
    return false;
  }

  return true;
}

export async function cerrarSesion(token) {
  if (!token) return;
  const store = getStore({ name: 'sesiones-panel', consistency: 'strong' });
  await store.delete(token);
}
