import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { esUrlVideoValida } from './utils/embedVideo';

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
      // Botones opcionales de contacto adicionales en la ficha — se
      // muestran solo si el negocio los proporciona.
      facebook: z.string().url().optional(),
      messenger: z.string().url().optional(),
      // Logo propio del negocio — opcional. Si no existe, la ficha sigue
      // mostrando el ícono genérico de la categoría (sin inventar un logo).
      logo: image().optional(),
      // Plan gratuito: máximo 8 fotos, sin video. Plan de pago: hasta 16
      // fotos y video propio habilitado. Límites exactos validados abajo
      // en superRefine — el máximo de 16 aquí es el techo absoluto (plan
      // de pago); el límite de 8 para gratuito se aplica ahí, no en .max().
      plan: z.enum(['gratuito', 'pago']).default('gratuito'),
      fotos: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
          }),
        )
        .min(3)
        .max(16),
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
      // Solo aplica a categoria: 'hospedaje' — habilita el filtro por tipo
      // en /hospedaje (casas completas, hoteles, cuartos independientes).
      tipo: z.enum(['casa', 'hotel', 'cuarto']).optional(),
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
      // URL del video del negocio — solo YouTube/Vimeo embebido (nunca
      // archivo subido directo, para no afectar la velocidad del sitio en
      // móvil). Cuenta para el puntaje de completitud (sección 8.1).
      video: z
        .string()
        .url()
        .refine(esUrlVideoValida, {
          message:
            'El campo "video" debe ser un link de YouTube (youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/..., youtube.com/shorts/...) o Vimeo (vimeo.com/..., player.vimeo.com/video/...) — no se aceptan archivos subidos ni otras URLs.',
        })
        .optional(),
      // Override manual del orden dentro de su grupo (destacado / no
      // destacado): si está presente, gana siempre sobre el puntaje
      // calculado. Menor número = aparece primero.
      ordenManual: z.number().optional(),
    })
    .superRefine((datos, ctx) => {
      // Límite de fotos por plan: gratuito 8, pago 16 (sección 7-8 del
      // análisis de competencia). Error de build claro si un .yaml lo excede.
      const limiteFotos = datos.plan === 'pago' ? 16 : 8;
      if (datos.fotos.length > limiteFotos) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fotos'],
          message: `El plan "${datos.plan}" permite máximo ${limiteFotos} fotos, pero "${datos.nombre}" tiene ${datos.fotos.length}. Quita fotos o cambia el plan a "pago".`,
        });
      }

      // El video propio es un beneficio exclusivo del plan de pago.
      if (datos.plan === 'gratuito' && datos.video) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['video'],
          message: `"${datos.nombre}" tiene el campo "video" pero está en plan "gratuito" — el video es exclusivo del plan "pago". Quita el video o cambia el plan.`,
        });
      }
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
