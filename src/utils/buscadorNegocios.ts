// Lógica compartida del buscador de negocios — usada hoy por el buscador
// del 404 (src/pages/404.astro), que lee el índice completo del sitio
// (#datos-buscador, generado por Header.astro en cada página) y dibuja su
// propia lista de resultados. PaginaCategoria.astro y hospedaje.astro
// tienen su propio buscador que filtra tarjetas ya renderizadas en vez de
// mostrar una lista — por eso no usan buscarNegocios/resultadosHtml de
// aquí, pero sí reutilizan normalizarBusqueda y registrarBusqueda.

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

// Registra el término buscado para saber qué busca la gente (sección
// "Qué busca la gente" de /panel-interno-tt) — con debounce de 1s desde
// la última tecla, NO en cada keystroke, para no guardar "a", "al",
// "alb", "albe"... como si fueran búsquedas distintas. Los 3 puntos de
// búsqueda del sitio (404, PaginaCategoria, hospedaje) llaman esta misma
// función en vez de repetir la lógica de debounce/fetch cada uno.
const RETRASO_REGISTRO_BUSQUEDA_MS = 1000;
let temporizadorRegistroBusqueda: ReturnType<typeof setTimeout> | undefined;

export function registrarBusqueda(termino: string, huboResultados: boolean): void {
  if (temporizadorRegistroBusqueda) clearTimeout(temporizadorRegistroBusqueda);
  temporizadorRegistroBusqueda = setTimeout(() => {
    fetch('/.netlify/functions/registrar-busqueda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ termino, huboResultados }),
    }).catch(() => {
      // Best effort — no bloquea al visitante si falla (red caída,
      // función no disponible, etc.), igual que registrar-evento.
    });
  }, RETRASO_REGISTRO_BUSQUEDA_MS);
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
