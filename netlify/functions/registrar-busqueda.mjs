import { actualizarJsonConReintentos, ConflictoDeEscrituraError, obtenerStoreDashboard } from './_compartido/stores-dashboard.mjs';

function mesActual() {
  return new Date().toISOString().slice(0, 7); // "2026-08"
}

// Misma normalización que src/utils/buscadorNegocios.ts (normalizarBusqueda)
// — duplicada aquí porque esta función corre en el runtime de Netlify
// Functions, no puede importar directo un módulo de src/ pensado para el
// navegador sin arrastrar dependencias de Astro.
const RANGO_DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizarBusqueda(texto) {
  return texto.normalize('NFD').replace(RANGO_DIACRITICOS, '').toLowerCase().trim();
}

function mesVacio() {
  return { terminos: {}, sinResultado: {} };
}

// Conteo de términos buscados en el sitio — separado de
// 'estadisticas-negocios' (que es por negocio) porque esto es por
// término, sin negocio asociado. Best effort igual que registrar-evento:
// sin cookies ni datos personales, y si Blobs falla no bloquea al
// visitante (se llama con keepalive y .catch vacío desde el front).
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

  const { termino, huboResultados } = cuerpo;
  if (typeof termino !== 'string') {
    return new Response(JSON.stringify({ ok: false, error: 'Datos incompletos' }), {
      status: 400,
    });
  }

  // Ignora términos vacíos o de 1 sola letra — ruido de tecleo, no
  // intención de búsqueda real.
  const normalizado = normalizarBusqueda(termino);
  if (normalizado.length < 2) {
    return new Response(JSON.stringify({ ok: true, ignorado: true }), { status: 200 });
  }

  try {
    const { store } = obtenerStoreDashboard(context, 'busquedas');
    // Localmente la búsqueda sigue funcionando para el visitante, pero no
    // genera datos analíticos ni toca el store real del sitio.
    if (!store) return new Response(JSON.stringify({ ok: true, ignorado: true }), { status: 200 });
    const mes = mesActual();
    await actualizarJsonConReintentos(store, 'registro', () => ({ porMes: {} }), (actual) => {
    if (!actual.porMes[mes]) actual.porMes[mes] = mesVacio();

    actual.porMes[mes].terminos[normalizado] = (actual.porMes[mes].terminos[normalizado] || 0) + 1;
    if (huboResultados === false) {
      actual.porMes[mes].sinResultado[normalizado] =
        (actual.porMes[mes].sinResultado[normalizado] || 0) + 1;
    }

    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    if (error instanceof ConflictoDeEscrituraError) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 409 });
    }
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      status: 500,
    });
  }
};
