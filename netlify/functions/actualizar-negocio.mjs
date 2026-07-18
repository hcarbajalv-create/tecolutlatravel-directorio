import { parseDocument } from 'yaml';

const GITHUB_API = 'https://api.github.com';
const OWNER = 'hcarbajalv-create';
const REPO = 'tecolutlatravel-directorio';
const RUTA_NEGOCIOS = 'src/content/negocios';

function soloDigitos(telefono) {
  return (telefono || '').replace(/[^\d]/g, '');
}

async function githubFetch(path, opciones = {}) {
  const respuesta = await fetch(`${GITHUB_API}${path}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opciones.headers,
    },
  });
  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new Error(`GitHub API ${respuesta.status}: ${texto}`);
  }
  return respuesta.json();
}

async function encontrarNegocioPorTelefono(telefonoDigitos) {
  const archivos = await githubFetch(`/repos/${OWNER}/${REPO}/contents/${RUTA_NEGOCIOS}`);
  for (const archivo of archivos) {
    if (!archivo.name.endsWith('.yaml')) continue;
    const detalle = await githubFetch(
      `/repos/${OWNER}/${REPO}/contents/${RUTA_NEGOCIOS}/${archivo.name}`,
    );
    const contenido = Buffer.from(detalle.content, 'base64').toString('utf-8');
    const documento = parseDocument(contenido);
    const telefonoActual = documento.get('telefono');
    if (soloDigitos(telefonoActual) === telefonoDigitos) {
      return { archivo: archivo.name, sha: detalle.sha, documento };
    }
  }
  return null;
}

function aplicarCambios(documento, cambios) {
  if (cambios.precioTemporada) {
    documento.set('precioTemporada', cambios.precioTemporada);
  }
  if (typeof cambios.disponible === 'boolean') {
    documento.set('disponible', cambios.disponible);
  }
  if (cambios.descripcionCorta) {
    documento.set('descripcionCorta', cambios.descripcionCorta);
  }
  documento.set('fechaActualizacion', new Date().toISOString().slice(0, 10));
  return documento;
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  const secretoRecibido = request.headers.get('x-webhook-secret');
  if (!process.env.WEBHOOK_SECRET || secretoRecibido !== process.env.WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), { status: 401 });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400 });
  }

  const { telefono, ...cambios } = cuerpo;
  if (!telefono) {
    return new Response(JSON.stringify({ ok: false, error: 'Falta el teléfono' }), {
      status: 400,
    });
  }

  try {
    const encontrado = await encontrarNegocioPorTelefono(soloDigitos(telefono));
    if (!encontrado) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No reconozco ese número como el contacto registrado de ningún negocio',
        }),
        { status: 404 },
      );
    }

    const documentoActualizado = aplicarCambios(encontrado.documento, cambios);
    const nombreNegocio = documentoActualizado.get('nombre');
    const nuevoContenidoYaml = String(documentoActualizado);

    await githubFetch(`/repos/${OWNER}/${REPO}/contents/${RUTA_NEGOCIOS}/${encontrado.archivo}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Actualiza ${nombreNegocio} vía bot de WhatsApp`,
        content: Buffer.from(nuevoContenidoYaml, 'utf-8').toString('base64'),
        sha: encontrado.sha,
      }),
    });

    return new Response(JSON.stringify({ ok: true, negocio: nombreNegocio, mensaje: 'Actualizado' }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
