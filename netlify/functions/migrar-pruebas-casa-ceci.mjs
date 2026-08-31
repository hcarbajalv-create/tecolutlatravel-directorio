import { getStore } from '@netlify/blobs';
import { validarSesion } from './_compartido/sesiones.mjs';
import { actualizarJsonConReintentos, fetchConConflictoNormalizado } from './_compartido/stores-dashboard.mjs';

const MARCA_MIGRACION = 'migracionAccionesPruebaCasaCeci20260830';
const SLUG = 'casa-ceci';
const MES = '2026-08';
const DESCUENTO_LLEGAR = 3;
const DESCUENTO_COMPARTIR = 1;
const CONTEXTOS_PREVIA = new Set(['deploy-preview', 'branch-deploy']);

function respuesta(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function numeroSeguro(valor) {
  return Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

// Ruta de un solo uso para retirar pruebas que una vista previa antigua escribió
// antes de que existiera el aislamiento. No recibe claves, slugs ni cantidades
// del cliente: solo puede modificar esta ficha y estos cuatro contadores.
export default async (request, context) => {
  if (request.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405);
  if (!CONTEXTOS_PREVIA.has(context?.deploy?.context)) {
    return respuesta({ error: 'Esta operación solo puede iniciarse desde una vista previa.' }, 403);
  }

  const token = request.headers.get('x-session-token');
  if (!await validarSesion(token, ['admin'])) return respuesta({ error: 'Sesión no válida.' }, 401);

  // getStore se usa de forma deliberada: esta operación limpia el almacén real
  // de una prueba previa. La ruta nunca se fusionará a producción.
  const store = getStore({
    name: 'estadisticas-negocios',
    consistency: 'strong',
    fetch: fetchConConflictoNormalizado,
  });

  try {
    const resultado = await actualizarJsonConReintentos(store, SLUG, () => null, (estadistica) => {
      if (!estadistica || typeof estadistica !== 'object') {
        throw new Error('No se encontraron las estadísticas de Casa Ceci.');
      }
      if (estadistica.migraciones?.[MARCA_MIGRACION]) return false;

      const porMes = estadistica.porMes?.[MES];
      const llegarTotal = numeroSeguro(estadistica.comoLlegarTotal);
      const compartirTotal = numeroSeguro(estadistica.compartirTotal);
      const llegarMes = numeroSeguro(porMes?.comoLlegar);
      const compartirMes = numeroSeguro(porMes?.compartir);

      // Si los importes esperados no están presentes, no se toca nada: evita
      // descontar actividad legítima o aplicar una limpieza parcial.
      if (llegarTotal < DESCUENTO_LLEGAR || compartirTotal < DESCUENTO_COMPARTIR
        || llegarMes < DESCUENTO_LLEGAR || compartirMes < DESCUENTO_COMPARTIR) {
        throw new Error('Los contadores no coinciden con la prueba autorizada; no se aplicó ningún cambio.');
      }

      estadistica.comoLlegarTotal = llegarTotal - DESCUENTO_LLEGAR;
      estadistica.compartirTotal = compartirTotal - DESCUENTO_COMPARTIR;
      porMes.comoLlegar = llegarMes - DESCUENTO_LLEGAR;
      porMes.compartir = compartirMes - DESCUENTO_COMPARTIR;
      estadistica.migraciones ??= {};
      estadistica.migraciones[MARCA_MIGRACION] = {
        aplicadaEn: new Date().toISOString(),
        accionesRetiradas: { comoLlegar: DESCUENTO_LLEGAR, compartir: DESCUENTO_COMPARTIR },
      };
      return true;
    });

    return respuesta({
      ok: true,
      aplicada: resultado.modificado,
      negocio: 'Casa Ceci',
      ajuste: { comoLlegar: DESCUENTO_LLEGAR, compartir: DESCUENTO_COMPARTIR, mes: MES },
    });
  } catch (error) {
    return respuesta({ error: error instanceof Error ? error.message : 'No se pudo aplicar la limpieza.' }, 409);
  }
};
