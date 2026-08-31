#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// generar-catalogo-bot.mjs
// 1) Lee todos los negocios de src/content/negocios/*.yaml.
// 2) Genera el catálogo limpio (JSON) con lo que el bot necesita para
//    recomendar, enlazar y mostrar TARJETA CON FOTO.
// 3) Crea la miniatura de la foto principal de cada negocio en /public/bot/.
//
// Uso:  node generar-catalogo-bot.mjs   (ideal como "prebuild" en package.json)
// Salidas:
//   - netlify/functions/_datos-bot/catalogo-negocios.json
//   - public/bot/<slug>.webp  (miniatura de la foto héroe, para las tarjetas)
//
// Regla de oro: el bot SOLO puede hablar de datos que estén en el catálogo.
// Nada de precios ni disponibilidad (no viven aquí, no se inventan).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = __dirname; // el script vive en la raíz del repo
const DIR_NEGOCIOS = join(RAIZ, 'src', 'content', 'negocios');
const DIR_SALIDA = join(RAIZ, 'netlify', 'functions', '_datos-bot');
const ARCHIVO_SALIDA = join(DIR_SALIDA, 'catalogo-negocios.json');
const DIR_FOTOS_BOT = join(RAIZ, 'public', 'bot');   // miniaturas servibles
const ANCHO_MINIATURA = 480;                          // px, suficiente para la tarjeta

const etiquetaCategoria = {
  hospedaje: 'Hospedaje',
  gastronomia: 'Gastronomía',
  actividades: 'Actividades ecoturísticas',
  servicios: 'Servicios',
};

const texto = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);

function distanciasLegibles(distancias) {
  if (!Array.isArray(distancias)) return [];
  return distancias.map((d) => {
    if (d.texto) return texto(d.texto);
    if (d.metros != null) return `${d.a}: ${d.metros} m`;
    return texto(d.a);
  });
}

// Resuelve la ruta física de la foto héroe (primera del yaml) dentro de src/.
function rutaHero(d) {
  if (!Array.isArray(d.fotos) || !d.fotos.length) return null;
  let src = d.fotos[0]?.src;
  if (typeof src !== 'string') return null;
  // Los src son relativos al archivo de contenido: "../../assets/fotos/<slug>/<file>"
  const idx = src.indexOf('assets/');
  if (idx === -1) return null;
  return join(RAIZ, 'src', src.slice(idx)); // src/assets/fotos/<slug>/<file>
}

// Chips cortos para la tarjeta (máx 3), según categoría y datos reales.
// Orden por poder de venta: capacidad/alberca/mascotas → cercanía → wifi.
function chipsDe(d) {
  const chips = [];
  const dist = distanciasLegibles(d.distancias);
  const cerca = dist.find((t) => /playa|r[íi]o|mar|centro/i.test(t));
  if (d.categoria === 'hospedaje') {
    if (d.capacidadMaxima) chips.push(`👥 ${d.capacidadMaxima}`);
    if (d.alberca === true) chips.push('🏊 Alberca');
    if (d.petFriendly === true) chips.push('🐾 Mascotas');
    if (cerca) chips.push(`📍 ${cerca}`);
    if (d.wifi === true) chips.push('📶 Wifi');
  } else if (d.categoria === 'gastronomia') {
    if (Array.isArray(d.tipoCocina) && d.tipoCocina.length) chips.push(`🍤 ${texto(d.tipoCocina[0])}`);
    if (cerca) chips.push(`📍 ${cerca}`);
  } else if (d.categoria === 'actividades') {
    chips.push('🚤 Paseo en lancha');
    if (d.capacidadMaxima) chips.push(`👥 ${d.capacidadMaxima}`);
    if (cerca) chips.push(`📍 ${cerca}`);
  }
  return chips.slice(0, 3);
}

async function miniatura(slug, heroPath) {
  if (!heroPath || !existsSync(heroPath)) return null;
  try {
    if (!existsSync(DIR_FOTOS_BOT)) mkdirSync(DIR_FOTOS_BOT, { recursive: true });
    const destino = join(DIR_FOTOS_BOT, `${slug}.webp`);
    await sharp(heroPath)
      .resize({ width: ANCHO_MINIATURA, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(destino);
    return `/bot/${slug}.webp`;
  } catch (e) {
    console.warn(`  aviso: no se pudo crear miniatura de ${slug}: ${e.message}`);
    return null;
  }
}

const archivos = readdirSync(DIR_NEGOCIOS).filter((f) => f.endsWith('.yaml'));
const catalogo = [];

for (const archivo of archivos) {
  const slug = archivo.replace(/\.yaml$/, '');
  const d = yaml.load(readFileSync(join(DIR_NEGOCIOS, archivo), 'utf8'));
  if (!d || !d.nombre || d.disponible === false) continue;

  const foto = await miniatura(slug, rutaHero(d));

  const ficha = {
    slug,
    nombre: texto(d.nombre),
    categoria: d.categoria,
    categoriaEtiqueta: etiquetaCategoria[d.categoria] || d.categoria,
    subtipo: texto(d.subtipo || d.tipo || ''),
    url: `/${d.categoria}/${slug}`,
    foto,                              // URL de la miniatura para la tarjeta
    chips: chipsDe(d),                 // etiquetas cortas para la tarjeta
    descripcion: texto(d.descripcionCorta || ''),
    capacidadMaxima: d.capacidadMaxima ?? null,
    numeroHabitaciones: d.numeroHabitaciones ?? null,
    alberca: d.alberca === true,
    petFriendly: d.petFriendly === true,
    wifi: d.wifi === true,
    servicios: Array.isArray(d.servicios) ? d.servicios.map(texto) : [],
    especialidades: Array.isArray(d.especialidades) ? d.especialidades.map(texto) : [],
    tipoCocina: Array.isArray(d.tipoCocina) ? d.tipoCocina.map(texto) : [],
    distancias: distanciasLegibles(d.distancias),
    telefono: d.telefono || null,
    destacado: d.destacado === true,
    plan: d.plan || 'gratuito',
  };

  for (const k of Object.keys(ficha)) {
    const v = ficha[k];
    if (v === null || (Array.isArray(v) && v.length === 0) || v === '') delete ficha[k];
  }

  catalogo.push(ficha);
}

catalogo.sort((a, b) => {
  if (!!b.destacado !== !!a.destacado) return b.destacado ? 1 : -1;
  if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
  return a.nombre.localeCompare(b.nombre);
});

if (!existsSync(DIR_SALIDA)) mkdirSync(DIR_SALIDA, { recursive: true });
writeFileSync(
  ARCHIVO_SALIDA,
  JSON.stringify({ generado: new Date().toISOString(), totalNegocios: catalogo.length, negocios: catalogo }, null, 2),
  'utf8',
);
console.log(`Catálogo generado: ${catalogo.length} negocios → ${ARCHIVO_SALIDA}`);
console.log(`Miniaturas: ${catalogo.filter((n) => n.foto).length} en public/bot/`);
