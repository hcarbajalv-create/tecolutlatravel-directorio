import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { esUrlVideoValida } from './utils/embedVideo';
import { CATALOGO_DISTANCIAS } from './utils/catalogoDistancias';

const destinosDistancia = Object.keys(CATALOGO_DISTANCIAS) as [string, ...string[]];

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
      // Plan gratuito: máximo 12 fotos, sin video. Plan de pago: hasta 16
      // fotos y video propio habilitado. Límites exactos validados abajo
      // en superRefine — el máximo de 16 aquí es el techo absoluto (plan
      // de pago); el límite de 12 para gratuito se aplica ahí, no en .max().
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
      // ESTADOS DE PUBLICACIÓN DE UN NEGOCIO — "borrador" y "disponible"
      // son campos independientes, no confundir uno con otro. Ver
      // src/utils/negociosPublicados.ts para dónde se aplican.
      //
      // - borrador: true -> el negocio NO EXISTE para el sitio construido.
      //   No genera página (visitar su URL da 404 real), no aparece en
      //   ningún listado, destacados, buscador ni sitemap. Úsalo para
      //   fichas de prueba o altas a medio armar — nunca subas una
      //   prueba sin este campo (así fue como "zzz-prueba-panel-anuncios"
      //   llegó a indexarse en Google, Lote 3 de la auditoría SEO).
      //
      // - disponible: false -> el negocio se dio de baja (cerró, dejó de
      //   pagar, pidió salir). Política del proyecto: NUNCA borrar una
      //   ficha ya publicada — una URL borrada queda en 404 y Google
      //   tarda meses en limpiarla del índice, perdiendo el
      //   posicionamiento acumulado. Su página sigue existiendo y
      //   responde 200, pero sale de todo listado/destacados/buscador/
      //   sitemap, lleva noindex, y muestra un aviso de que ya no está
      //   disponible en vez del contenido normal.
      //
      // Un negocio puede estar en borrador (no existe), dado de baja
      // (existe pero fuera de circulación) o publicado normal — nunca
      // los dos primeros a la vez tiene sentido, pero el schema no lo
      // impide porque "borrador" ya gana primero en la práctica (ver
      // filtrarPublicados, que se aplica antes que filtrarListables).
      borrador: z.boolean().optional(),
      disponible: z.boolean(),
      servicios: z.array(z.string()).default([]),
      // Platillos/especialidades del negocio — separado de "servicios"
      // porque son cosas distintas (un platillo no es una amenidad). Hoy
      // solo lo usa gastronomía, pero no se restringe por categoría, igual
      // que "servicios".
      especialidades: z.array(z.string()).default([]),
      // Campos de gastronomía (todos opcionales, sin forzar por categoría
      // — misma filosofía que "tipo"/"numeroHabitaciones" de hospedaje).
      // "horario" es texto libre (ej. "Lunes a domingo, 9:00 a 20:00") en
      // vez de una estructura por día porque hoy no hay ningún negocio que
      // necesite horarios distintos por día — si hace falta más adelante,
      // se puede migrar sin romper lo ya publicado.
      horario: z.string().optional(),
      rangoPrecios: z.enum(['$', '$$', '$$$']).optional(),
      formasPago: z.array(z.string()).optional(),
      tipoCocina: z.array(z.string()).optional(),
      // Solo aplica a categoria: 'hospedaje' — habilita el filtro por tipo
      // en /hospedaje (casas completas, hoteles, cuartos independientes).
      tipo: z.enum(['casa', 'hotel', 'cuarto']).optional(),
      // Etiqueta específica que se muestra en las tarjetas donde antes
      // decía "HOSPEDAJE" — distinto de "tipo" (que solo alimenta el
      // filtro de /hospedaje). Opcional: solo se pone cuando el nombre o
      // la descripción del propio negocio ya lo dejan claro; si no,
      // se deja sin poner en vez de adivinar.
      subtipo: z.enum(['Casa vacacional', 'Hotel', 'Habitaciones', 'Posada', 'Bungalows']).optional(),
      numeroHabitaciones: z.number().optional(),
      capacidadMaxima: z.number().optional(),
      petFriendly: z.boolean().optional(),
      // Lista de distancias a puntos de referencia (playa, río, centro,
      // embarcadero...) — catálogo de destinos válidos en
      // utils/catalogoDistancias.ts, agregar uno nuevo es una línea ahí.
      // Cada entrada trae "a" + exactamente uno de "metros" (número, se
      // muestra formateado "527 m") o "texto" (frase corta ya redactada,
      // se muestra tal cual, ej. "A pie de río").
      // REGLA DE ORDEN: la PRIMERA entrada es la que se muestra en la
      // tarjeta de listado — pon primero la distancia que sea el
      // verdadero gancho del negocio (ej. el río para un restaurante
      // frente al malecón, aunque la playa esté más cerca), no
      // necesariamente la más corta.
      distancias: z
        .array(
          z
            .object({
              a: z.enum(destinosDistancia),
              metros: z.number().optional(),
              texto: z.string().optional(),
            })
            .refine((d) => (d.metros !== undefined) !== (d.texto !== undefined), {
              message: 'Cada distancia debe traer "metros" o "texto", exactamente uno de los dos.',
            }),
        )
        .optional(),
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
      // Mes y año en que se confirmaron los datos directamente con el
      // dueño (texto libre, ej. "ago 2026") — se usa en la tarjeta
      // compacta y en la tarjeta grande. Opcional: se omite la línea si
      // no está, nunca se inventa una fecha.
      confirmadoFecha: z.string().optional(),
    })
    .superRefine((datos, ctx) => {
      // Límite de fotos por plan: gratuito 12, pago 16 (sección 7-8 del
      // análisis de competencia). Error de build claro si un .yaml lo excede.
      const limiteFotos = datos.plan === 'pago' ? 16 : 12;
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
  // Markdown en vez de yaml — a diferencia de negocios/reportajes de
  // antes, un reportaje puede tener cuerpo de artículo largo (párrafos,
  // subtítulos, listas, enlaces) además del frontmatter. El cuerpo es
  // opcional: un archivo con frontmatter y nada debajo sigue siendo
  // válido, se renderiza sin sección de cuerpo — ver render(reportaje)
  // en reportajes-y-noticias/[reportaje].astro.
  loader: glob({ pattern: '**/*.md', base: './src/content/reportajes' }),
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
