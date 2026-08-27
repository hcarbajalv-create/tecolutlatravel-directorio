import type { CollectionEntry } from 'astro:content';

type Negocio = CollectionEntry<'negocios'>;

// Criterio único de detección de amenidades "clave" — pet friendly,
// alberca, wifi — compartido entre los chips de filtro de /hospedaje
// y la línea compacta de amenidades que se muestra en las tarjetas en
// celular (NegocioCard.astro). Antes cada lugar tenía su propio
// criterio (uno usaba el campo real petFriendly, otro buscaba
// "alberca"/"wifi" como texto suelto dentro de "servicios"); un negocio
// que escribiera "Piscina" o "Internet" en vez de esas palabras exactas
// se quedaba sin su chip sin que nadie se diera cuenta. Los tres ahora
// leen un campo booleano dedicado (ver content.config.ts).
export const AMENIDADES_CLAVE = [
  {
    valor: 'pet-friendly',
    etiqueta: 'Pet-friendly',
    chip: 'Pet friendly',
    icono: 'mascota',
    prueba: (n: Negocio) => Boolean(n.data.petFriendly),
  },
  {
    valor: 'alberca',
    etiqueta: 'Con alberca',
    chip: 'Alberca',
    icono: 'alberca',
    prueba: (n: Negocio) => Boolean(n.data.alberca),
  },
  {
    valor: 'wifi',
    etiqueta: 'Con wifi',
    chip: 'Wifi',
    icono: 'wifi',
    prueba: (n: Negocio) => Boolean(n.data.wifi),
  },
] as const;

// Hasta 2 amenidades clave para la vista compacta de celular — no la
// lista completa, para eso está la ficha del negocio. Orden fijo
// (pet-friendly, alberca, wifi): pet-friendly es el dato que más cambia
// la decisión cuando aplica, así que gana el primer lugar si compite
// por espacio.
export function amenidadesClaveMovil(negocio: Negocio) {
  return AMENIDADES_CLAVE.filter((a) => a.prueba(negocio))
    .slice(0, 2)
    .map((a) => ({ icono: a.icono, texto: a.chip }));
}
