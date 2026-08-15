// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Se leen los .yaml de negocios directo con Node (astro:content no está
// disponible en este archivo) para poder excluir del sitemap las fichas
// "dadas de baja" (disponible:false) — su página SIGUE existiendo y
// respondiendo 200, solo no debe aparecer en el sitemap. Las fichas en
// borrador ni siquiera generan página (getStaticPaths las excluye, ver
// src/utils/negociosPublicados.ts), así que nunca llegan a tener una
// URL que el sitemap pudiera ver — no hace falta excluirlas aquí.
const dirNegocios = fileURLToPath(new URL('./src/content/negocios/', import.meta.url));

let totalNegocios = 0;
let totalBorrador = 0;
let totalDadosDeBaja = 0;
const slugsDadosDeBaja = new Set();

for (const archivo of readdirSync(dirNegocios)) {
  if (!archivo.endsWith('.yaml')) continue;
  totalNegocios++;
  const datos = parse(readFileSync(path.join(dirNegocios, archivo), 'utf8'));
  if (datos.borrador === true) {
    totalBorrador++;
  } else if (datos.disponible === false) {
    totalDadosDeBaja++;
    slugsDadosDeBaja.add(archivo.replace(/\.yaml$/, ''));
  }
}

// Informa en cada build cuántos negocios quedaron fuera por cada
// estado, para que no se olvide ninguno en silencio.
console.log(
  `[negocios] ${totalNegocios} en total — ${totalBorrador} en borrador (sin página) — ` +
    `${totalDadosDeBaja} dados de baja (con página, fuera de listados/buscador/sitemap)`,
);

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
        !page.includes('/panel-anuncios') &&
        ![...slugsDadosDeBaja].some((slug) => page.endsWith(`/${slug}`)),
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
