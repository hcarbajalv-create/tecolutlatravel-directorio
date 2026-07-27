import { obtenerNegocioPorSlug, actualizarYaml } from './_compartido/github.mjs';
import { validarSesion } from './_compartido/sesiones.mjs';

// Cambia el plan de un negocio (gratuito <-> pago) desde el panel interno,
// para que Hector no dependa de pedir un commit manual cada vez que un
// negocio paga. "destacado" siempre se sincroniza con el plan (pago =
// destacado, gratuito = no destacado), tal como se definió en el plan de
// negocio original — no son campos independientes en la práctica.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const token = request.headers.get('x-session-token');
  // Solo admin — un colaborador (panel-anuncios) nunca debe poder cambiar
  // el plan de un negocio, aunque conozca este endpoint.
  const sesionValida = await validarSesion(token, ['admin']);
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

  const { slug, plan } = cuerpo;
  if (!slug || (plan !== 'gratuito' && plan !== 'pago')) {
    return new Response(JSON.stringify({ ok: false, error: 'Faltan datos o plan inválido' }), {
      status: 400,
    });
  }

  try {
    const encontrado = await obtenerNegocioPorSlug(slug);
    if (!encontrado) {
      return new Response(JSON.stringify({ ok: false, error: 'Negocio no encontrado' }), {
        status: 404,
      });
    }

    const nombreNegocio = encontrado.documento.get('nombre');
    const datosActuales = encontrado.documento.toJSON();

    if (plan === 'gratuito' && Array.isArray(datosActuales.fotos) && datosActuales.fotos.length > 8) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `"${nombreNegocio}" tiene ${datosActuales.fotos.length} fotos — el plan gratuito permite máximo 8. Quítale fotos desde el panel de anuncios antes de bajarlo de plan.`,
        }),
        { status: 400 },
      );
    }

    encontrado.documento.set('plan', plan);
    encontrado.documento.set('destacado', plan === 'pago');
    if (plan === 'gratuito' && datosActuales.video) {
      encontrado.documento.delete('video');
    }
    encontrado.documento.set('fechaActualizacion', new Date().toISOString().slice(0, 10));

    const nuevoContenidoYaml = String(encontrado.documento);
    await actualizarYaml(
      encontrado.archivo,
      encontrado.sha,
      nuevoContenidoYaml,
      `Cambia a "${nombreNegocio}" a plan ${plan} vía panel interno`,
    );

    return new Response(JSON.stringify({ ok: true, negocio: nombreNegocio, plan }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
