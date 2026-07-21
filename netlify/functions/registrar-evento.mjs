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
  };
}

// Conteo simple de eventos (vista de ficha / clic a WhatsApp), sin cookies
// ni datos personales — solo fecha, negocio, canal de origen (referrer) y
// tipo de dispositivo. Es "best effort": si Blobs falla, no bloquea al
// visitante porque se llama desde el navegador sin esperar la respuesta.
export default async (request) => {
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

    const canalSeguro = typeof canal === 'string' && canal ? canal : 'otro';
    const dispositivoSeguro = dispositivo === 'movil' ? 'movil' : 'escritorio';

    if (tipo === 'vista') {
      actual.vistasTotal += 1;
      actual.porMes[mes].vistas += 1;
    } else {
      actual.clicsTotal += 1;
      actual.porMes[mes].clics += 1;
    }

    actual.porMes[mes].canales[canalSeguro] = (actual.porMes[mes].canales[canalSeguro] || 0) + 1;
    actual.porMes[mes].dispositivos[dispositivoSeguro] += 1;

    await store.setJSON(slug, actual);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
