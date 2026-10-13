/** Tipos de imagen aceptados como evidencia. */
export const MIME_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export type MimeImagen = (typeof MIME_IMAGEN)[number];

const EXTENSION: Record<MimeImagen, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const extensionDe = (mime: string) => EXTENSION[mime as MimeImagen] ?? 'bin';

/**
 * Detecta el tipo real por la firma de los primeros bytes (no confía en el
 * `Content-Type` que manda el navegador). Devuelve null si no es una imagen aceptada.
 */
export function detectarImagen(b: Buffer): MimeImagen | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (
    b.toString('ascii', 4, 8) === 'ftyp' &&
    /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(b.toString('ascii', 8, 12))
  ) {
    return 'image/heic';
  }
  return null;
}
