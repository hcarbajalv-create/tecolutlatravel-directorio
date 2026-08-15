import type { CollectionEntry } from 'astro:content';

/**
 * Único lugar donde vive la regla de qué negocios "existen" y cuáles
 * "se ven" — ver el comentario largo en content.config.ts (campos
 * borrador/disponible) para la explicación completa de cada estado.
 */

export function esBorrador(n: CollectionEntry<'negocios'>): boolean {
  return n.data.borrador === true;
}

export function estaDadoDeBaja(n: CollectionEntry<'negocios'>): boolean {
  return n.data.disponible === false;
}

// Negocios que existen en el sitio construido — todo excepto borrador.
// Es lo que debe usar getStaticPaths() de la ficha: un negocio dado de
// baja SIGUE generando página (200, nunca 404); uno en borrador no
// genera nada.
export function filtrarPublicados(
  todos: CollectionEntry<'negocios'>[],
): CollectionEntry<'negocios'>[] {
  return todos.filter((n) => !esBorrador(n));
}

// Negocios que deben aparecer en listados de categoría, destacados,
// "También en Tecolutla", el índice del buscador y el sitemap:
// publicados Y no dados de baja.
export function filtrarListables(
  todos: CollectionEntry<'negocios'>[],
): CollectionEntry<'negocios'>[] {
  return todos.filter((n) => !esBorrador(n) && !estaDadoDeBaja(n));
}
