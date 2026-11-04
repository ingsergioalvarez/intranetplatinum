import { aHex, rgbAHsl, type Rgb } from './paleta';

/**
 * Colores de la marca de una empresa tomados de su ícono o logo (C-14).
 * `principal` es el color dominante; `acento` es un segundo color distinto, o null si la imagen no tiene otro.
 */
export interface ColoresLogo {
  principal: string;
  acento: string | null;
}

const CUBETAS = 24; // 15° de tono cada una
const ANCHO_CUBETA = 360 / CUBETAS;
/** Mínimo de píxeles con color para fiarse de la imagen. */
const MIN_PIXELES = 8;
/** El segundo color debe pesar al menos esto respecto al principal. */
const PESO_MIN_ACENTO = 0.1;

interface Cubeta {
  peso: number;
  n: number;
  r: number;
  g: number;
  b: number;
}

const vacia = (): Cubeta => ({ peso: 0, n: 0, r: 0, g: 0, b: 0 });

/**
 * Colores dominantes de una imagen a partir de sus píxeles RGBA (4 valores por píxel).
 * Ignora lo transparente, el blanco, el negro y los grises: solo cuentan los colores. Los tonos parecidos
 * (±15°) se agrupan, y el segundo color debe estar a más de 30° del principal. Devuelve null si la imagen
 * no tiene colores aprovechables (por ejemplo, un logo solo en negro o gris).
 */
export function coloresDominantes(rgba: ArrayLike<number>): ColoresLogo | null {
  const cubetas = Array.from({ length: CUBETAS }, vacia);
  let validos = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3] ?? 0;
    if (a < 128) continue;
    const rgb: Rgb = [rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0];
    const [h, s, l] = rgbAHsl(rgb);
    if (l > 90 || l < 10 || s < 20) continue;
    const c = cubetas[Math.floor(h / ANCHO_CUBETA) % CUBETAS]!;
    c.peso += 1 + s / 100;
    c.n += 1;
    c.r += rgb[0];
    c.g += rgb[1];
    c.b += rgb[2];
    validos++;
  }
  if (validos < MIN_PIXELES) return null;

  /** Una cubeta junto con sus dos vecinas (el tono es circular). */
  const vecindad = (centro: number) => [-1, 0, 1].map((d) => (centro + d + CUBETAS) % CUBETAS);
  const pesoDe = (centro: number, usadas: Set<number>) =>
    vecindad(centro).reduce((t, i) => t + (usadas.has(i) ? 0 : cubetas[i]!.peso), 0);

  const elegir = (usadas: Set<number>) => {
    let mejor = -1;
    let pesoMejor = 0;
    for (let c = 0; c < CUBETAS; c++) {
      const p = pesoDe(c, usadas);
      if (p > pesoMejor) {
        pesoMejor = p;
        mejor = c;
      }
    }
    if (mejor < 0) return null;
    const incluidas = vecindad(mejor).filter((i) => !usadas.has(i));
    const total = incluidas.reduce((t, i) => ({ n: t.n + cubetas[i]!.n, r: t.r + cubetas[i]!.r, g: t.g + cubetas[i]!.g, b: t.b + cubetas[i]!.b }), { n: 0, r: 0, g: 0, b: 0 });
    const color = aHex([total.r / total.n, total.g / total.n, total.b / total.n]);
    return { color, peso: pesoMejor, usadas: vecindad(mejor) };
  };

  const usadas = new Set<number>();
  const primero = elegir(usadas);
  if (!primero) return null;
  primero.usadas.forEach((i) => usadas.add(i));
  const segundo = elegir(usadas);
  return {
    principal: primero.color,
    acento: segundo && segundo.peso >= primero.peso * PESO_MIN_ACENTO ? segundo.color : null,
  };
}
