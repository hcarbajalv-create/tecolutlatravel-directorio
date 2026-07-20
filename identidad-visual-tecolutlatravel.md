# Identidad visual de Tecolutla.Travel — especificación técnica implementada

Este documento registra la versión **final y exacta** de la identidad visual tal como quedó
implementada en el sitio (Astro), a partir del manual de marca en `branding pagina web.pdf`.
No sustituye el PDF — lo complementa con los valores exactos y el código fuente del ícono,
que el PDF no permite extraer directamente (es un render, no un archivo vectorial).

## Paleta de colores

| Rol | Variable CSS | Hex | Uso |
|---|---|---|---|
| Turquesa (primario) | `--color-turquesa` | `#0B6F7A` | Marca, navegación, enlaces, botones primarios |
| Turquesa claro | `--color-turquesa-claro` | `#4FD2C8` | Acentos, hover, decorativo (nunca texto sobre fondo claro) |
| Tinta | `--color-tinta` | `#0C2B2E` | Texto de cuerpo, fondos oscuros (footer), estado hover oscuro |
| Coral (secundario / CTA) | `--color-coral` | `#FF7A5C` | Solo fondos (botones CTA, insignias) — nunca como texto suelto |
| Coral claro | `--color-coral-claro` | `#FF9478` | Acentos secundarios, decorativo |
| Coral texto (derivado) | `--color-coral-texto` | `#A64F3C` | Variante seguro AA de coral: texto sobre fondo claro, hover de botones coral |
| Arena | `--color-arena` | `#F4E9D1` | Fondos claros/neutros |

**Regla de contraste (WCAG 2.1 AA) aplicada:** el Coral puro (`#FF7A5C`) falla como texto sobre
blanco/arena (2.1–2.6:1) y falla con texto blanco encima como fondo de botón. Por eso existe
`--color-coral-texto` (`#A64F3C`, 5.5:1 sobre blanco) para cualquier uso de coral como texto, y los
botones/insignias con fondo coral usan texto Tinta (`#0C2B2E`, 5.85:1) en vez de blanco.
Excepción: el wordmark de marca (".Travel" en coral) está exento por la regla WCAG SC 1.4.3
(texto que es parte de un logotipo).

## Tipografía

- **Títulos/encabezados:** Nunito, peso 900 (Black) — `--fuente-titulos`
- **Cuerpo de texto:** Work Sans, pesos 500 (Medium) y 600 (SemiBold) — `--fuente-cuerpo`
- Cargadas desde Google Fonts: `family=Nunito:wght@900&family=Work+Sans:wght@500;600`

## Ícono de marca — "pin + ola"

Concepto: un pin de mapa (ubicación) en Coral, con un corte en forma de ola en Blanco que lo
atraviesa horizontalmente, evocando la costa de Tecolutla. Reconstruido a mano en SVG (el PDF
del manual no es extraíble como vector), y ajustado con el usuario hasta la versión aprobada.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="4" y="4" width="92" height="92" rx="22" fill="#0B6F7A"/>
  <mask id="tt-ola" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect x="0" y="0" width="100" height="100" fill="#fff"/>
    <path d="M25,46 Q33,38 41,46 T57,46 T75,46 L75,54 Q67,62 59,54 T43,54 T25,54 Z" fill="#000"/>
  </mask>
  <path d="M50 20 C38 20 28 30 28 42 C28 58 50 82 50 82 C50 82 72 58 72 42 C72 30 62 20 50 20 Z" fill="#FF7A5C" mask="url(#tt-ola)"/>
</svg>
```

- **Favicon / ícono de app:** el bloque completo de arriba (cuadrado turquesa `#0B6F7A` con
  esquinas redondeadas + pin + ola). Archivo: `public/favicon.svg`.
- **Pin solo** (sin el cuadrado turquesa): mismo `<path>` y `<mask>`, sin el `<rect>` de fondo.
  Usado en el header del sitio (`src/components/Header.astro`), a la izquierda del wordmark.
- El pin siempre es Coral (`#FF7A5C`); la ola siempre corta en el color de fondo detrás del ícono
  (blanco si no hay fondo turquesa).

## Wordmark

`Tecolutla` en Tinta (`#0C2B2E`) + `.Travel` en Coral (`#FF7A5C`), ambos en Nunito 900.
El punto antes de "Travel" es literal (no decorativo) y forma parte del wordmark.

## Dónde vive cada pieza en el código

| Pieza | Archivo |
|---|---|
| Variables de color y tipografía | `src/styles/global.css` (bloque `:root`) |
| Ícono + wordmark del header | `src/components/Header.astro` |
| Favicon | `public/favicon.svg`, enlazado en `src/layouts/BaseLayout.astro` |
| Fuentes de Google | `src/layouts/BaseLayout.astro` (`<head>`) |

## Prompt para diseñador — vectorizar y pulir el ícono

Necesito vectorizar y pulir el ícono de marca de "Tecolutla.Travel", un directorio turístico de
Tecolutla, Veracruz. Ya existe una versión funcional en SVG que debe usarse como punto de partida
exacto (no reinventar el concepto, solo refinarlo):

**Concepto:** un pin de mapa (ubicación/destino) con un corte horizontal en forma de ola que lo
atraviesa, evocando la costa. El pin es sólido en coral; la ola es un corte limpio (no una línea
encima, sino un vacío que deja ver el fondo).

**Colores exactos (no cambiar):**
- Turquesa `#0B6F7A` (fondo del ícono cuando lleva cuadrado, marca primaria)
- Coral `#FF7A5C` (el pin)
- Blanco `#FFFFFF` (el corte de la ola, o el color de fondo detrás si no hay cuadrado)

**Tipografía del wordmark que acompaña al ícono:** Nunito, peso 900 (Black). "Tecolutla" en
Tinta `#0C2B2E`, ".Travel" en Coral `#FF7A5C` (el punto es parte del wordmark, no decorativo).

**Referencia de partida (SVG funcional, usar como base):**
```
<path d="M50 20 C38 20 28 30 28 42 C28 58 50 82 50 82 C50 82 72 58 72 42 C72 30 62 20 50 20 Z" fill="#FF7A5C"/>
<!-- corte de ola, vía máscara -->
<path d="M25,46 Q33,38 41,46 T57,46 T75,46 L75,54 Q67,62 59,54 T43,54 T25,54 Z" fill="black"/> <!-- (negro = área cortada) -->
```

**Lo que necesito que mejores (no que cambies el concepto):**
1. Curvas más pulidas/profesionales del pin (actualmente es una aproximación a mano con Bézier básicas).
2. Que se vea nítido y reconocible en tamaños muy chicos (16×16 y 32×32 px, para favicon).
3. Versión con fondo cuadrado turquesa redondeado (para ícono de app / favicon) y versión sin fondo (para usar junto al wordmark en el header del sitio).
4. Entregables: SVG editable de ambas versiones, en las medidas 16, 32, 64, 180 (apple-touch-icon) y 512 px.

No cambies la paleta de colores, ni el concepto de pin+ola, ni la tipografía — solo formaliza el trazo.

**Además, una vez que el ícono esté vectorizado**, por favor actualiza el documento maestro del
manual de marca (`branding pagina web.pdf`, adjunto) reemplazando las páginas donde aparece el
ícono/favicon actual por la nueva versión vectorizada, para que el PDF siga siendo la referencia
oficial única y quede sincronizado con lo que ya está publicado en el sitio. Los colores y la
tipografía del documento ya son correctos — no hace falta tocar esas páginas, solo el ícono.

## Nota sobre los tiles de categoría

La paleta de marca solo tiene 2 familias de color (turquesa y coral), pero el sitio tiene 4
categorías (hospedaje, gastronomía, actividades, servicios) que antes usaban naranja/verde/azul
fuera de marca para distinguirse visualmente. Se resolvió combinando las 2 familias de forma
distinta en cada tile (turquesa↔turquesa claro, coral↔coral claro, tinta↔turquesa, turquesa
claro↔coral claro) para mantener 100% de la paleta de marca. Es una decisión de diseño, no una
regla del manual — si en el futuro se agregan más categorías o se quiere más diferenciación
visual, este es el punto a revisar.
