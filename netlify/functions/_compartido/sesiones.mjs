const DURACION_SESION_MS = 3 * 60 * 60 * 1000; // 3 horas
const codificador = new TextEncoder();
const decodificador = new TextDecoder();

function aBase64Url(valor) {
  return Buffer.from(valor).toString('base64url');
}

function desdeBase64Url(valor) {
  return Buffer.from(valor, 'base64url');
}

async function llaveDeFirma() {
  const secreto = process.env.DASHBOARD_SECRET;
  if (!secreto) throw new Error('Falta la configuración del acceso al panel');

  return crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function firmar(contenido) {
  const firma = await crypto.subtle.sign('HMAC', await llaveDeFirma(), codificador.encode(contenido));
  return aBase64Url(firma);
}

/**
 * Sesiones firmadas de corta duración con rol ("admin" | "colaborador").
 *
 * El token no contiene la contraseña y su firma HMAC impide que alguien
 * cambie el rol o la fecha de vencimiento. Así cualquier función puede
 * comprobarlo por sí misma, sin depender de una lectura compartida de
 * Netlify Blobs entre invocaciones distintas.
 */
export async function crearSesion(rol) {
  const ahora = Date.now();
  const carga = aBase64Url(JSON.stringify({
    creado: ahora,
    expira: ahora + DURACION_SESION_MS,
    rol,
    nonce: crypto.randomUUID(),
  }));
  const firma = await firmar(carga);
  return `${carga}.${firma}`;
}

export async function obtenerSesion(token) {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

  try {
    const firmaValida = await crypto.subtle.verify(
      'HMAC',
      await llaveDeFirma(),
      desdeBase64Url(partes[1]),
      codificador.encode(partes[0]),
    );
    if (!firmaValida) return null;

    const sesion = JSON.parse(decodificador.decode(desdeBase64Url(partes[0])));
    if (!sesion || typeof sesion.expira !== 'number' || typeof sesion.rol !== 'string') return null;
    if (Date.now() > sesion.expira) return null;

    return sesion;
  } catch {
    return null;
  }
}

export async function validarSesion(token, rolesPermitidos) {
  const sesion = await obtenerSesion(token);
  if (!sesion) return false;
  if (Array.isArray(rolesPermitidos) && !rolesPermitidos.includes(sesion.rol)) return false;
  return true;
}

// El cierre elimina el token del navegador. Al ser una sesión firmada y de
// corta duración no hay una entrada remota que borrar; así se evita volver a
// depender de un almacenamiento que no se comparte entre funciones.
export async function cerrarSesion() {}
