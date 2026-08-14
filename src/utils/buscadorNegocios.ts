// Lógica compartida del buscador de negocios — la usa el panel del Header
// (src/components/Header.astro) y el buscador píldora del hero del home
// (src/pages/index.astro). Ambos leen el mismo índice ya presente en el
// DOM (#datos-buscador, generado por Header.astro en cada página) y cada
// uno dibuja sus propios resultados en su propio contenedor.

export interface NegocioIndice {
  nombre: string;
  categoria: string;
  slug: string;
}

export const ETIQUETAS_CATEGORIA_BUSQUEDA: Record<string, string> = {
  hospedaje: 'Hospedaje',
  gastronomia: 'Gastronomía',
  actividades: 'Actividades',
  servicios: 'Servicios',
};

export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function escaparHtmlBusqueda(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export function leerIndiceBuscador(): NegocioIndice[] {
  const el = document.getElementById('datos-buscador');
  return el ? JSON.parse(el.textContent || '[]') : [];
}

export function buscarNegocios(
  indice: NegocioIndice[],
  consulta: string,
  limite = 8,
): NegocioIndice[] {
  const normalizada = normalizarBusqueda(consulta);
  if (!normalizada) return [];
  return indice.filter((n) => normalizarBusqueda(n.nombre).includes(normalizada)).slice(0, limite);
}

export function resultadosHtml(coincidencias: NegocioIndice[]): string {
  return coincidencias
    .map(
      (n) => `
        <li class="buscador__resultado">
          <a href="/${n.categoria}/${n.slug}">
            <span>${escaparHtmlBusqueda(n.nombre)}</span>
            <span class="buscador__resultado-categoria">${escaparHtmlBusqueda(
              ETIQUETAS_CATEGORIA_BUSQUEDA[n.categoria] ?? n.categoria,
            )}</span>
          </a>
        </li>
      `,
    )
    .join('');
}
