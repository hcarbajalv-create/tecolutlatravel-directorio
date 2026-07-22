/**
 * Valida y extrae información de links de video de YouTube/Vimeo — el
 * campo "video" del schema de negocios solo acepta estas dos plataformas
 * (nunca archivos subidos directo, para no afectar la velocidad del sitio).
 * Sin dependencias de Astro: lo usa tanto content.config.ts como el
 * componente VideoEmbed.astro.
 */
export interface InfoVideo {
  proveedor: 'youtube' | 'vimeo';
  id: string;
}

const PATRON_YOUTUBE =
  /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?][^\s]*)?$/;

const PATRON_VIMEO = /^https:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)(?:[/?][^\s]*)?$/;

export function extraerInfoVideo(url: string): InfoVideo | null {
  const coincidenciaYoutube = url.match(PATRON_YOUTUBE);
  if (coincidenciaYoutube) return { proveedor: 'youtube', id: coincidenciaYoutube[1] };

  const coincidenciaVimeo = url.match(PATRON_VIMEO);
  if (coincidenciaVimeo) return { proveedor: 'vimeo', id: coincidenciaVimeo[1] };

  return null;
}

export function esUrlVideoValida(url: string): boolean {
  return extraerInfoVideo(url) !== null;
}
