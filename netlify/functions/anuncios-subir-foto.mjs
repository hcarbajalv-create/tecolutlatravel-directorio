import { obtenerNegocioPorSlug, subirFoto } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';

const TIPOS_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// 4MB decodificados por foto — el límite de Netlify es 6MB por petición
// (el body en base64 pesa ~33% más que el archivo original), así que
// subir una foto a la vez (no las 16 juntas) evita chocar con ese límite.
const TAMANO_MAXIMO_BYTES = 4 * 1024 * 1024;

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const token = request.headers.get('x-session-token');
  const sesionValida = await validarSesion(token, ['admin', 'colaborador']);
  if (!sesionValida) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida o vencida' }), {
      status: 401,
    });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400 });
  }

  const { slug, tipoMime, base64 } = cuerpo;
  if (!slug || !tipoMime || !base64) {
    return new Response(JSON.stringify({ ok: false, error: 'Faltan datos de la foto' }), {
      status: 400,
    });
  }

  const extension = TIPOS_PERMITIDOS[tipoMime];
  if (!extension) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Solo se aceptan fotos JPG, PNG o WEBP' }),
      { status: 400 },
    );
  }

  // El tamaño en bytes del original ≈ base64.length * 3/4.
  const tamanoAproximado = Math.floor((base64.length * 3) / 4);
  if (tamanoAproximado > TAMANO_MAXIMO_BYTES) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Cada foto debe pesar máximo 4MB' }),
      { status: 400 },
    );
  }

  try {
    const encontrado = await obtenerNegocioPorSlug(slug);
    if (!encontrado) {
      return new Response(JSON.stringify({ ok: false, error: 'Negocio no encontrado' }), {
        status: 404,
      });
    }

    const plan = encontrado.documento.get('plan') || 'gratuito';
    if (plan !== 'pago') {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `"${encontrado.documento.get('nombre')}" está en plan gratuito — la subida de fotos por este panel es exclusiva del plan de pago.`,
        }),
        { status: 403 },
      );
    }

    const nombreArchivo = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const rutaSrc = await subirFoto(
      slug,
      nombreArchivo,
      base64,
      `Sube foto de ${encontrado.documento.get('nombre')} vía panel de anuncios`,
    );

    return new Response(JSON.stringify({ ok: true, src: rutaSrc }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
