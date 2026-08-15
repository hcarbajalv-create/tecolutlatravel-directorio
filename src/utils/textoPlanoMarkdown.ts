// Extrae texto plano aproximado de un cuerpo Markdown, para el
// "articleBody"/"wordCount" del schema Article de un reportaje — no es
// un parser real (no hace falta agregar una dependencia solo para
// esto), quita la sintaxis Markdown más común para que no aparezcan
// símbolos sueltos como # o ** en los datos estructurados.
export function textoPlanoMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '') // encabezados
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // imágenes: se quitan enteras
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // enlaces [texto](url) -> texto
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // negritas/itálicas
    .replace(/^[-*+]\s+/gm, '') // viñetas de lista
    .replace(/^\d+\.\s+/gm, '') // listas numeradas
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function contarPalabras(textoPlano: string): number {
  return textoPlano.length === 0 ? 0 : textoPlano.split(/\s+/).filter(Boolean).length;
}
