// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tecolutlatravel.mx',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/anunciate/gracias') &&
        !page.includes('/panel-interno-tt') &&
        !page.includes('/panel-anuncios'),
      // Nota: @astrojs/sitemap le quita la barra final a la URL de la
      // home de forma fija (write-sitemap.js hace un reemplazo de texto
      // sobre el XML ya generado) cuando trailingSlash:'never' o
      // build.format:'file' — ambos ciertos aquí. No es configurable via
      // "serialize" (ese paso corre antes del recorte). BaseLayout.astro
      // ajusta su canonical de la home para coincidir con esto, en vez
      // de pelear contra el comportamiento fijo de la librería.
    }),
  ],
});
