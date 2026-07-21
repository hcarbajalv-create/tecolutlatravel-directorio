/**
 * Sistema de puntaje de completitud del listado gratuito — sección 8.1 de
 * analisis_competencia_tecolutla.docx. Máximo 100 pts:
 *   20 datos básicos + 30 fotos + 15 video + 20 precio + 10 servicios + 5 reseñas.
 *
 * Sin dependencias de Astro a propósito: este archivo también lo importa
 * netlify/functions/resultados-negocio.mjs (Node plano, fuera del pipeline
 * de build de Astro) para no duplicar la fórmula en dos lugares.
 */
export interface DatosPuntajeNegocio {
  fotos: unknown[];
  video?: string;
  precioTemporada?: unknown[];
  servicios: string[];
  resenas: unknown[];
  destacado?: boolean;
}

export function calcularPuntaje(negocio: DatosPuntajeNegocio): number {
  // Datos básicos completos (20 pts): el schema ya exige nombre, categoría,
  // descripción, dirección, coordenadas, teléfono y mínimo 3 fotos para que
  // una ficha exista — cualquier entrada publicada los cumple siempre.
  let puntaje = 20;

  // Fotos: es un tramo, no acumulable (3-5 = 20, 6-10 = 30).
  puntaje += (negocio.fotos?.length ?? 0) >= 6 ? 30 : 20;

  if (negocio.video) puntaje += 15;
  if (negocio.precioTemporada && negocio.precioTemporada.length > 0) puntaje += 20;
  if (negocio.servicios && negocio.servicios.length > 0) puntaje += 10;
  if (negocio.resenas && negocio.resenas.length > 0) puntaje += 5;

  return puntaje;
}

/**
 * Recomendaciones automáticas basadas en qué le falta a la ficha para subir
 * de puntaje — compartida entre el reporte de WhatsApp (resultados-negocio)
 * y el dashboard interno.
 */
export function generarRecomendaciones(negocio: DatosPuntajeNegocio): string[] {
  const recomendaciones: string[] = [];
  const totalFotos = negocio.fotos?.length ?? 0;

  if (totalFotos < 6) {
    recomendaciones.push(`📸 Sube ${6 - totalFotos} foto(s) más (tienes ${totalFotos}) → +10 pts`);
  }
  if (!negocio.video) {
    recomendaciones.push('🎥 Agrega un video corto → +15 pts');
  }
  if (!negocio.precioTemporada || negocio.precioTemporada.length === 0) {
    recomendaciones.push('💰 Publica tu precio de temporada → +20 pts');
  }
  if (!negocio.servicios || negocio.servicios.length === 0) {
    recomendaciones.push('🏷️ Marca tus servicios y amenidades → +10 pts');
  }
  if (!negocio.destacado) {
    recomendaciones.push('⭐ Con Destacado tu ficha sube al top de tu categoría');
  }
  return recomendaciones;
}

// Hash determinista simple (djb2) — no necesita ser criptográfico, solo
// repartir empates de forma estable a lo largo del mismo día.
function hashDiario(semilla: string): number {
  let hash = 5381;
  for (let i = 0; i < semilla.length; i++) {
    hash = (hash * 33) ^ semilla.charCodeAt(i);
  }
  return hash >>> 0;
}

interface NegocioOrdenable {
  id: string;
  data: {
    ordenManual?: number;
    [clave: string]: unknown;
  };
}

/**
 * Compara dos negocios dentro del mismo grupo (destacado o no destacado):
 * 1. El orden manual, si está presente, siempre gana sobre el puntaje
 *    calculado — así el dueño del sitio puede mover una ficha a mano.
 * 2. Si no hay orden manual, gana el puntaje más alto.
 * 3. Si empatan en puntaje (sección 12.3): se revuelve el orden con una
 *    semilla basada en el día — estable durante el mismo día, pero
 *    distinta al día siguiente. Nota: como el sitio es estático, este
 *    "día siguiente" solo se refleja cuando el sitio se reconstruye
 *    (deploy nuevo), no automáticamente a medianoche sin un rebuild.
 */
export function compararDentroDeGrupo<T extends NegocioOrdenable>(a: T, b: T): number {
  const manualA = a.data.ordenManual;
  const manualB = b.data.ordenManual;

  if (manualA !== undefined && manualB !== undefined) return manualA - manualB;
  if (manualA !== undefined) return -1;
  if (manualB !== undefined) return 1;

  const puntajeA = calcularPuntaje(a.data as unknown as DatosPuntajeNegocio);
  const puntajeB = calcularPuntaje(b.data as unknown as DatosPuntajeNegocio);
  if (puntajeA !== puntajeB) return puntajeB - puntajeA;

  const hoy = new Date().toISOString().slice(0, 10);
  return hashDiario(`${hoy}-${a.id}`) - hashDiario(`${hoy}-${b.id}`);
}
