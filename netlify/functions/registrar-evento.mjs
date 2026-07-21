import { getStore } from '@netlify/blobs';

function mesActual() {
  return new Date().toISOString().slice(0, 7); // "2026-07"
}

function estadoVacio() {
  return {
    vistasTotal: 0,
    clicsTotal: 0,
    porMes: {},
  };
}

function mesVacio() {
  return {
    vistas: 0,
    clics: 0,
    canales: {},
    dispositivos: { movil: 0, escritorio: 0 },
    estados: {},
    diaSemana: {},
    hora: {},
  };
}

// Día de la semana y hora en zona horaria de México, no UTC del servidor —
// para que los patrones de tráfico reflejen la hora real del visitante.
function diaYHoraLocal() {
  const formateador = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  });
  const partes = formateador.formatToParts(new Date());
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? 'desconocido';
  const horaCruda = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  // Algunos motores ICU devuelven "24" para medianoche con hour12:false.
  return { dia, hora: String(horaCruda % 24) };
}

// Conteo simple de eventos (vista de ficha / clic a WhatsApp), sin cookies
// ni datos personales — solo fecha, negocio, canal de origen (referrer),
// tipo de dispositivo, estado/ciudad aproximados (geolocalización nativa
// de Netlify por IP, no un servicio externo) y día/hora locales. Es "best
// effort": si Blobs falla, no bloquea al visitante porque se llama desde
// el navegador sin esperar la respuesta.
export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400 });
  }

  const { slug, tipo, canal, dispositivo } = cuerpo;
  if (typeof slug !== 'string' || !slug || (tipo !== 'vista' && tipo !== 'clic')) {
    return new Response(JSON.stringify({ ok: false, error: 'Datos incompletos' }), {
      status: 400,
    });
  }

  try {
    const store = getStore('estadisticas-negocios');
    const actual = (await store.get(slug, { type: 'json' })) || estadoVacio();

    const mes = mesActual();
    if (!actual.porMes[mes]) actual.porMes[mes] = mesVacio();
    // Entradas guardadas antes de este cambio no tienen estos campos todavía.
    if (!actual.porMes[mes].estados) actual.porMes[mes].estados = {};
    if (!actual.porMes[mes].diaSemana) actual.porMes[mes].diaSemana = {};
    if (!actual.porMes[mes].hora) actual.porMes[mes].hora = {};

    const canalSeguro = typeof canal === 'string' && canal ? canal : 'otro';
    const dispositivoSeguro = dispositivo === 'movil' ? 'movil' : 'escritorio';

    if (tipo === 'vista') {
      actual.vistasTotal += 1;
      actual.porMes[mes].vistas += 1;

      // Geolocalización nativa de Netlify (por IP, sin servicio externo).
      // Solo en "vista" — el usuario pidió "estado/ciudad de las visitas".
      const ciudad = context.geo?.city;
      const estadoGeo = context.geo?.subdivision?.name;
      const ubicacion = [ciudad, estadoGeo].filter(Boolean).join(', ') || 'Desconocido';
      actual.porMes[mes].estados[ubicacion] = (actual.porMes[mes].estados[ubicacion] || 0) + 1;
    } else {
      actual.clicsTotal += 1;
      actual.porMes[mes].clics += 1;
    }

    // Por canal se cuentan vistas y clics por separado (no un solo número)
    // para poder calcular la tasa de conversión (clics ÷ vistas) por canal.
    if (!actual.porMes[mes].canales[canalSeguro]) {
      actual.porMes[mes].canales[canalSeguro] = { vistas: 0, clics: 0 };
    }
    actual.porMes[mes].canales[canalSeguro][tipo === 'vista' ? 'vistas' : 'clics'] += 1;
    actual.porMes[mes].dispositivos[dispositivoSeguro] += 1;

    const { dia, hora } = diaYHoraLocal();
    actual.porMes[mes].diaSemana[dia] = (actual.porMes[mes].diaSemana[dia] || 0) + 1;
    actual.porMes[mes].hora[hora] = (actual.porMes[mes].hora[hora] || 0) + 1;

    await store.setJSON(slug, actual);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
