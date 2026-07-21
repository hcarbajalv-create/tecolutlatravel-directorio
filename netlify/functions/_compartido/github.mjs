import { parseDocument } from 'yaml';

const GITHUB_API = 'https://api.github.com';
const OWNER = 'hcarbajalv-create';
const REPO = 'tecolutlatravel-directorio';
const RUTA_NEGOCIOS = 'src/content/negocios';

export function soloDigitos(telefono) {
  return (telefono || '').replace(/[^\d]/g, '');
}

export async function githubFetch(path, opciones = {}) {
  const respuesta = await fetch(`${GITHUB_API}${path}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opciones.headers,
    },
  });
  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new Error(`GitHub API ${respuesta.status}: ${texto}`);
  }
  return respuesta.json();
}

async function listarArchivosNegocios() {
  const archivos = await githubFetch(`/repos/${OWNER}/${REPO}/contents/${RUTA_NEGOCIOS}`);
  return archivos.filter((archivo) => archivo.name.endsWith('.yaml'));
}

async function obtenerDocumento(nombreArchivo) {
  const detalle = await githubFetch(
    `/repos/${OWNER}/${REPO}/contents/${RUTA_NEGOCIOS}/${nombreArchivo}`,
  );
  const contenido = Buffer.from(detalle.content, 'base64').toString('utf-8');
  return { documento: parseDocument(contenido), sha: detalle.sha };
}

export async function encontrarNegocioPorTelefono(telefonoDigitos) {
  const archivos = await listarArchivosNegocios();
  for (const archivo of archivos) {
    const { documento, sha } = await obtenerDocumento(archivo.name);
    const telefonoActual = documento.get('telefono');
    if (soloDigitos(telefonoActual) === telefonoDigitos) {
      return { archivo: archivo.name, documento, sha };
    }
  }
  return null;
}

export async function obtenerTodosLosNegocios() {
  const archivos = await listarArchivosNegocios();
  const resultado = [];
  for (const archivo of archivos) {
    const { documento } = await obtenerDocumento(archivo.name);
    resultado.push({
      slug: archivo.name.replace(/\.yaml$/, ''),
      datos: documento.toJSON(),
    });
  }
  return resultado;
}
