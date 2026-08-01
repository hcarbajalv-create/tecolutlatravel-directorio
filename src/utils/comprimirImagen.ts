// Comprime una foto en el navegador (canvas, sin dependencias) cuando pesa
// más del límite dado, en vez de solo rechazarla — prueba resoluciones y
// calidades decrecientes hasta que quepa, o devuelve null si de plano no se
// puede (muy raro con fotos normales de celular). Compartido por /anunciate
// (límite total de envío de Netlify Forms: 8MB) y /panel-anuncios (límite del
// payload de la función serverless: 4MB) — cada uno pasa su propio maxBytes.
export async function comprimirImagen(archivo: File, maxBytes: number): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    return null;
  }

  const anchosMaximos = [2000, 1600, 1200, 900];
  const calidades = [0.85, 0.7, 0.55, 0.4];

  for (const anchoMax of anchosMaximos) {
    let ancho = bitmap.width;
    let alto = bitmap.height;
    if (Math.max(ancho, alto) > anchoMax) {
      const escala = anchoMax / Math.max(ancho, alto);
      ancho = Math.round(ancho * escala);
      alto = Math.round(alto * escala);
    }

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    for (const calidad of calidades) {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', calidad),
      );
      if (blob && blob.size <= maxBytes) {
        const nombre = archivo.name.replace(/\.\w+$/, '') + '.jpg';
        return new File([blob], nombre, { type: 'image/jpeg' });
      }
    }
  }

  return null;
}
