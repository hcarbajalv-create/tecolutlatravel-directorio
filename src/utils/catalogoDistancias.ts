// Fuente única de verdad para los destinos que puede usar el campo
// "distancias" de un negocio (content.config.ts) — agregar un destino
// nuevo es una línea aquí, no hace falta tocar ninguna plantilla.
export const CATALOGO_DISTANCIAS = {
  playa: { etiqueta: 'la playa', icono: '🏖️' },
  rio: { etiqueta: 'el río', icono: '🌊' },
  centro: { etiqueta: 'el centro', icono: '📍' },
  embarcadero: { etiqueta: 'el embarcadero', icono: '🛶' },
} as const;

export type DestinoDistancia = keyof typeof CATALOGO_DISTANCIAS;

export interface Distancia {
  a: DestinoDistancia;
  metros?: number;
  texto?: string;
}

// Ficha: línea completa ("527 m a la playa"). Si viene "texto" se muestra
// tal cual, sin agregarle "a <destino>" — ya es una frase completa
// redactada por quien dio de alta el negocio (ej. "A pie de río").
export function formatearDistancia(d: Distancia): string {
  if (d.metros === undefined) return d.texto ?? '';
  // "a" + "el centro" da "a el centro". En español se contrae a "al centro".
  // Pasaba en Restaurant El Manglar ("170 m a el centro") y en Hotel Nautilus.
  const etiqueta = CATALOGO_DISTANCIAS[d.a].etiqueta;
  const preposicion = etiqueta.startsWith('el ') ? `al ${etiqueta.slice(3)}` : `a ${etiqueta}`;
  return `${d.metros} m ${preposicion}`;
}

// Tarjeta: versión compacta, sin "a <destino>", para caber en la insignia
// sobre la foto (ej. "527m", "A pie de río").
export function formatearDistanciaCompacta(d: Distancia): string {
  // La insignia de la tarjeta debe conservar el contexto de la distancia:
  // "274m" aislado no indica si se trata de la playa, el río o el centro.
  // Usamos el mismo pictograma del catálogo para que se reconozca de un
  // vistazo y mantenemos el formato breve para no romper la tarjeta.
  return d.metros !== undefined
    ? `${CATALOGO_DISTANCIAS[d.a].icono} ${d.metros}m`
    : (d.texto ?? '');
}
