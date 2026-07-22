import { obtenerNegocioPorSlug, actualizarYaml } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';
import { esUrlVideoValida } from '../../src/utils/embedVideo.ts';

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

  const { slug, fotos, video } = cuerpo;
  if (!slug || !Array.isArray(fotos)) {
    return new Response(JSON.stringify({ ok: false, error: 'Faltan datos' }), { status: 400 });
  }

  if (fotos.length < 3 || fotos.length > 16) {
    return new Response(
      JSON.stringify({ ok: false, error: 'La ficha necesita entre 3 y 16 fotos' }),
      { status: 400 },
    );
  }

  if (video && !esUrlVideoValida(video)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'El video debe ser un link de YouTube o Vimeo válido',
      }),
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
          error: `"${encontrado.documento.get('nombre')}" está en plan gratuito — este panel es exclusivo del plan de pago.`,
        }),
        { status: 403 },
      );
    }

    const nombreNegocio = encontrado.documento.get('nombre');
    encontrado.documento.set(
      'fotos',
      fotos.map((f) => ({ src: f.src, alt: f.alt || nombreNegocio })),
    );

    if (video) {
      encontrado.documento.set('video', video);
    } else {
      encontrado.documento.delete('video');
    }

    encontrado.documento.set('fechaActualizacion', new Date().toISOString().slice(0, 10));

    const nuevoContenidoYaml = String(encontrado.documento);
    await actualizarYaml(
      encontrado.archivo,
      encontrado.sha,
      nuevoContenidoYaml,
      `Actualiza fotos/video de ${nombreNegocio} vía panel de anuncios`,
    );

    return new Response(JSON.stringify({ ok: true, negocio: nombreNegocio }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
