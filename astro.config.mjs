// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO: reemplazar por el dominio final una vez que se elija y se confirme en Netlify
export default defineConfig({
  site: 'https://tecolutla-travel.netlify.app',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/anunciate/gracias'),
    }),
  ],
});
