import {
  actualizarJsonConReintentos,
  ConflictoDeEscrituraError,
  obtenerStoreDashboard,
} from './_compartido/stores-dashboard.mjs';

const ANCLAS_POR_ESTADO = {
  'Estado de México': 'desde-edomex',
  'Ciudad de México': 'desde-cdmx',
  Hidalgo: 'desde-hidalgo',
  Puebla: 'desde-puebla',
  Veracruz: 'desde-veracruz',
};

const ESTADOS_VALIDOS = new Set([
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro',
  'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala',
  'Veracruz', 'Yucatán', 'Zacatecas',
]);

function estadoVacio() {
  return { total: 0, porEstado: {}, porMes: {} };
}

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

async function registrar(estado, context) {
  if (!ESTADOS_VALIDOS.has(estado)) return false;
  const { store } = obtenerStoreDashboard(context, 'origen-estado');
  if (!store) return true;
  const mes = mesActual();
  await actualizarJsonConReintentos(store, 'selecciones', estadoVacio, (actual) => {
    actual.total = (actual.total || 0) + 1;
    actual.porEstado ??= {};
    actual.porMes ??= {};
    actual.porEstado[estado] = (actual.porEstado[estado] || 0) + 1;
    actual.porMes[mes] ??= {};
    actual.porMes[mes][estado] = (actual.porMes[mes][estado] || 0) + 1;
  });
  return true;
}

// GET da un recorrido útil sin JavaScript: cuenta y redirige al H2 escrito,
// o al catálogo cuando aún no hay una guía para ese estado. POST es el mismo
// contador, usado por la interfaz para mostrar el aviso sin recargar.
export default async (request, context) => {
  const url = new URL(request.url);
  let estado;
  if (request.method === 'GET') {
    estado = url.searchParams.get('estado');
  } else if (request.method === 'POST') {
    try {
      ({ estado } = await request.json());
    } catch {
      return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
    }
  } else {
    return Response.json({ ok: false, error: 'Método no permitido' }, { status: 405 });
  }

  if (typeof estado !== 'string' || !ESTADOS_VALIDOS.has(estado)) {
    return Response.json({ ok: false, error: 'Estado inválido' }, { status: 400 });
  }

  try {
    await registrar(estado, context);
  } catch (error) {
    // La ruta sin JS sigue llevando al visitante a contenido útil aunque
    // el contador tenga una colisión; la métrica nunca bloquea su viaje.
    if (!(error instanceof ConflictoDeEscrituraError)) console.error(error);
  }

  const ancla = ANCLAS_POR_ESTADO[estado];
  if (request.method === 'GET') {
    return Response.redirect(new URL(ancla ? `/como-llegar-a-tecolutla#${ancla}` : '/hospedaje', url), 302);
  }
  return Response.json({ ok: true, ancla: ancla ?? null });
};
