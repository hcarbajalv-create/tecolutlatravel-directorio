import { getStore } from '@netlify/blobs';
import { calcularPuntaje, generarRecomendaciones } from '../../src/utils/puntajeCompletitud.ts';
import { soloDigitos, encontrarNegocioPorTelefono } from './_compartido/github.mjs';
import {
  NOMBRES_CANAL,
  claveMesActual,
  nombreMes,
  claveMesAnterior,
  entradaPrincipal,
} from './_compartido/formato.mjs';

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
    const stats = (await store.get(slug, { type: 'json' })) || {
      vistasTotal: 0,
      clicsTotal: 0,
      porMes: {},
    };

    const mesClave = claveMesActual();
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

    // canales guarda { vistas, clics } por canal — el "principal" se mide
    // por volumen de vistas, no de clics.
    const vistasPorCanal = Object.fromEntries(
      Object.entries(statsMes.canales || {}).map(([canal, valores]) => [
        canal,
        valores?.vistas ?? 0,
      ]),
    );
    const canalTop = entradaPrincipal(vistasPorCanal);
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
