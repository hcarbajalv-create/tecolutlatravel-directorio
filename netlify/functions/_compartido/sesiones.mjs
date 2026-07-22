import { getStore } from '@netlify/blobs';

const DURACION_SESION_MS = 3 * 60 * 60 * 1000; // 3 horas

function almacen() {
  return getStore({ name: 'sesiones-panel', consistency: 'strong' });
}

/**
 * Sesiones de corta duración con rol ("admin" | "colaborador"): el rol
 * queda fijo en el token desde que se crea, según qué contraseña se usó
 * para entrar. Cada endpoint de datos decide qué roles acepta — así una
 * sesión de colaborador nunca puede usarse donde solo debe entrar admin,
 * sin importar por dónde se haya iniciado sesión.
 */
export async function crearSesion(rol) {
  const token = crypto.randomUUID();
  const ahora = Date.now();
  await almacen().setJSON(token, { creado: ahora, expira: ahora + DURACION_SESION_MS, rol });
  return token;
}

export async function obtenerSesion(token) {
  if (!token) return null;
  const store = almacen();
  const sesion = await store.get(token, { type: 'json' });
  if (!sesion) return null;

  if (Date.now() > sesion.expira) {
    await store.delete(token); // limpieza oportunista de sesiones vencidas
    return null;
  }

  return sesion;
}

export async function validarSesion(token, rolesPermitidos) {
  const sesion = await obtenerSesion(token);
  if (!sesion) return false;
  if (Array.isArray(rolesPermitidos) && !rolesPermitidos.includes(sesion.rol)) return false;
  return true;
}

export async function cerrarSesion(token) {
  if (!token) return;
  await almacen().delete(token);
}
