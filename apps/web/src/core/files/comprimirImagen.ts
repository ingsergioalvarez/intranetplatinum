const LADO_MAXIMO = 1600;
const CALIDAD = 0.8;

/**
 * Reduce la foto antes de subirla (datos móviles de los guardias): lado mayor ≤ 1600 px, JPEG 80 %.
 * Si el navegador no puede decodificarla (p. ej. HEIC en Chrome) o no ahorra espacio, se envía la original.
 */
export async function comprimirImagen(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', CALIDAD));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return archivo;
  }
}

/** Comprime en paralelo y arma el FormData con campos de texto + `fotos`. */
export async function formularioConFotos(campos: Record<string, unknown>, fotos: File[]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  }
  for (const f of await Promise.all(fotos.map(comprimirImagen))) form.append('fotos', f, f.name);
  return form;
}
