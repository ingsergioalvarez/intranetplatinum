import { coloresDominantes, type ColoresLogo } from '@platinum/shared';

export interface AnalisisImagen {
  /** Colores de la marca sacados de la imagen; null si no tiene colores aprovechables (blanco, negro o gris). */
  colores: ColoresLogo | null;
  ancho: number;
  alto: number;
}

/** La imagen se reduce a este lado largo antes de contar píxeles: basta y es rápido. */
const LADO_MUESTRA = 64;

/** Carga la imagen (misma dirección que la app, así el navegador deja leer sus píxeles) y saca sus colores. */
export async function analizarImagen(url: string): Promise<AnalisisImagen> {
  const img = new Image();
  await new Promise<void>((listo, fallo) => {
    img.onload = () => listo();
    img.onerror = () => fallo(new Error('No se pudo leer la imagen'));
    img.src = url;
  });
  // Un SVG sin tamaño propio puede reportar 0: se trata como cuadrado.
  const ancho = img.naturalWidth || LADO_MUESTRA;
  const alto = img.naturalHeight || LADO_MUESTRA;
  const escala = LADO_MUESTRA / Math.max(ancho, alto);
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { colores: null, ancho, alto };
  ctx.drawImage(img, 0, 0, w, h);
  return { colores: coloresDominantes(ctx.getImageData(0, 0, w, h).data), ancho, alto };
}

/** Un logo con letras suele ser mucho más ancho que alto: en el menú se vería diminuto. */
export const pareceHorizontal = ({ ancho, alto }: Pick<AnalisisImagen, 'ancho' | 'alto'>) => {
  const razon = ancho / alto;
  return razon > 1.4 || razon < 0.7;
};
