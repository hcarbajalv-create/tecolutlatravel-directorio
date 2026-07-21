import type { CollectionEntry } from 'astro:content';

/**
 * Sistema de puntaje de completitud del listado gratuito — sección 8.1 de
 * analisis_competencia_tecolutla.docx. Máximo 100 pts:
 *   20 datos básicos + 30 fotos + 15 video + 20 precio + 10 servicios + 5 reseñas.
 */
export function calcularPuntaje(negocio: CollectionEntry<'negocios'>['data']): number {
  let puntaje = 0;

  // Datos básicos completos (20 pts): el schema ya exige nombre, categoría,
  // descripción, dirección, coordenadas, teléfono y mínimo 3 fotos para que
  // una ficha exista — cualquier entrada publicada los cumple siempre.
  puntaje += 20;

  // Fotos: es un tramo, no acumulable (3-5 = 20, 6-10 = 30).
  puntaje += negocio.fotos.length >= 6 ? 30 : 20;

  if (negocio.video) puntaje += 15;
  if (negocio.precioTemporada && negocio.precioTemporada.length > 0) puntaje += 20;
  if (negocio.servicios.length > 0) puntaje += 10;
  if (negocio.resenas.length > 0) puntaje += 5;

  return puntaje;
}

/**
 * Compara dos negocios dentro del mismo grupo (destacado o no destacado):
 * el orden manual, si está presente, siempre gana sobre el puntaje calculado
 * — así el dueño del sitio puede mover una ficha a mano cuando lo necesite.
 * Entre fichas sin orden manual, gana el puntaje más alto.
 */
export function compararDentroDeGrupo(
  a: CollectionEntry<'negocios'>,
  b: CollectionEntry<'negocios'>,
): number {
  const manualA = a.data.ordenManual;
  const manualB = b.data.ordenManual;

  if (manualA !== undefined && manualB !== undefined) return manualA - manualB;
  if (manualA !== undefined) return -1;
  if (manualB !== undefined) return 1;

  return calcularPuntaje(b.data) - calcularPuntaje(a.data);
}
