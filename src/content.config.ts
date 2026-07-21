import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const negocios = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/negocios' }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      categoria: z.enum(['hospedaje', 'gastronomia', 'actividades', 'servicios']),
      descripcionCorta: z.string(),
      direccion: z.string(),
      coordenadas: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      telefono: z.string(),
      fotos: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
          }),
        )
        .min(3)
        .max(10),
      precioTemporada: z
        .array(
          z.object({
            temporada: z.string(),
            precio: z.number(),
          }),
        )
        .optional(),
      fechaActualizacion: z.coerce.date(),
      disponible: z.boolean(),
      servicios: z.array(z.string()).default([]),
      numeroHabitaciones: z.number().optional(),
      capacidadMaxima: z.number().optional(),
      petFriendly: z.boolean().optional(),
      distanciaPlayaMetros: z.number().optional(),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      verificado: z.boolean().default(false),
      resenas: z
        .array(
          z.object({
            autor: z.string(),
            calificacion: z.number().min(1).max(5),
            comentario: z.string(),
          }),
        )
        .default([]),
      destacado: z.boolean().default(false),
      // URL del video del negocio (recorrido, reportaje, etc.) — cuenta para
      // el puntaje de completitud (sección 8.1 del análisis de competencia).
      video: z.string().url().optional(),
      // Override manual del orden dentro de su grupo (destacado / no
      // destacado): si está presente, gana siempre sobre el puntaje
      // calculado. Menor número = aparece primero.
      ordenManual: z.number().optional(),
    }),
});

const reportajes = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/reportajes' }),
  schema: z.object({
    titulo: z.string(),
    categoria: z.enum(['reportaje', 'noticia', 'tip']),
    fecha: z.coerce.date(),
    // URL del video (YouTube/TikTok/Instagram). Opcional: si aún no se ha
    // grabado, la tarjeta muestra "Video próximamente" en vez de inventar un enlace.
    video: z.string().url().optional(),
    descripcionCorta: z.string(),
    // Solo aplica a categoria: 'reportaje' — enlaza de vuelta a la ficha del negocio.
    negocioRelacionado: reference('negocios').optional(),
  }),
});

export const collections = { negocios, reportajes };
