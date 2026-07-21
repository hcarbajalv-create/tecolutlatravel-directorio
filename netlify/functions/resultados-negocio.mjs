import { parseDocument } from 'yaml';
import { getStore } from '@netlify/blobs';
import { calcularPuntaje } from '../../src/utils/puntajeCompletitud.ts';

const GITHUB_API = 'https://api.github.com';
const OWNER = 'hcarbajalv-create';
const REPO = 'tecolutlatravel-directorio';
const RUTA_NEGOCIOS = 'src/content/negocios';

const NOMBRES_CANAL = {
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  directo: 'directo',
  interno: 'el sitio',
  otro: 'otros canales',
};

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
      return { archivo: archivo.name, documento };
    }
  }
  return null;
}

function nombreMes(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long' });
}

function claveMesAnterior(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function canalPrincipal(canales) {
  const entradas = Object.entries(canales || {});
  if (entradas.length === 0) return null;
  entradas.sort((a, b) => b[1] - a[1]);
  return entradas[0][0];
}

function generarRecomendaciones(datos) {
  const recomendaciones = [];
  const totalFotos = datos.fotos?.length ?? 0;

  if (totalFotos < 6) {
    recomendaciones.push(`📸 Sube ${6 - totalFotos} foto(s) más (tienes ${totalFotos}) → +10 pts`);
  }
  if (!datos.video) {
    recomendaciones.push('🎥 Agrega un video corto → +15 pts');
  }
  if (!datos.precioTemporada || datos.precioTemporada.length === 0) {
    recomendaciones.push('💰 Publica tu precio de temporada → +20 pts');
  }
  if (!datos.servicios || datos.servicios.length === 0) {
    recomendaciones.push('🏷️ Marca tus servicios y amenidades → +10 pts');
  }
  if (!datos.destacado) {
    recomendaciones.push('⭐ Con Destacado tu ficha sube al top de tu categoría');
  }
  return recomendaciones;
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

  const { telefono } = cuerpo;
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

    const datos = encontrado.documento.toJSON();
    const slug = encontrado.archivo.replace(/\.yaml$/, '');
    const puntaje = calcularPuntaje(datos);
    const recomendaciones = generarRecomendaciones(datos);

    const store = getStore('estadisticas-negocios');
    const stats = (await store.get(slug, { type: 'json' })) || { vistasTotal: 0, clicsTotal: 0, porMes: {} };

    const mesClave = new Date().toISOString().slice(0, 7);
    const statsMes = stats.porMes[mesClave] || { vistas: 0, clics: 0, canales: {}, dispositivos: {} };
    const statsMesAnterior = stats.porMes[claveMesAnterior(mesClave)];

    let comparacionMensual = null;
    if (statsMesAnterior && statsMesAnterior.vistas > 0) {
      const diferencia = statsMes.vistas - statsMesAnterior.vistas;
      const porcentaje = Math.round((Math.abs(diferencia) / statsMesAnterior.vistas) * 100);
      comparacionMensual =
        diferencia >= 0
          ? `📈 ${porcentaje}% más vistas que el mes pasado`
          : `📉 ${porcentaje}% menos vistas que el mes pasado`;
    }

    const canalTop = canalPrincipal(statsMes.canales);
    const movil = statsMes.dispositivos?.movil ?? 0;
    const escritorio = statsMes.dispositivos?.escritorio ?? 0;
    const totalDispositivos = movil + escritorio;
    const porcentajeMovil =
      totalDispositivos > 0 ? Math.round((movil / totalDispositivos) * 100) : null;

    const lineas = [];
    lineas.push(`📊 Resultados de ${datos.nombre} — ${nombreMes(mesClave)}`);
    lineas.push(`${statsMes.vistas} vistas · ${statsMes.clics} clics a WhatsApp`);
    if (comparacionMensual) lineas.push(comparacionMensual);
    if (canalTop) lineas.push(`La mayoría llega desde ${NOMBRES_CANAL[canalTop] || canalTop}`);
    if (porcentajeMovil !== null) lineas.push(`${porcentajeMovil}% desde celular`);
    lineas.push(`Puntaje de tu ficha: ${puntaje}/100`);
    if (recomendaciones.length > 0) {
      lineas.push('');
      lineas.push('Cómo subir tu puntaje:');
      lineas.push(...recomendaciones);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        negocio: datos.nombre,
        mensaje: lineas.join('\n'),
        datos: {
          puntaje,
          vistasMes: statsMes.vistas,
          clicsMes: statsMes.clics,
          vistasTotal: stats.vistasTotal,
          clicsTotal: stats.clicsTotal,
          canalPrincipal: canalTop,
          porcentajeMovil,
          recomendaciones,
        },
      }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
