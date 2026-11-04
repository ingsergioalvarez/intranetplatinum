/**
 * Paleta de una empresa (C-07): a partir de uno o dos colores se genera la escala completa que usa la app
 * (`brand-50` … `brand-950`). El color principal queda como `brand-700` (botones, ítem activo, enlaces); se oscurece
 * solo lo necesario para que el texto blanco se lea sobre él (contraste mínimo AA, 4.5:1).
 * `brand-900` y `brand-950` siempre son oscuros: el menú lateral nunca se aclara aunque el color sea claro.
 */
export const CONTRASTE_MINIMO = 4.5;

export type EscalaBrand = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>;

export interface PaletaGenerada {
  /** Escala `brand-*`. */
  brand: EscalaBrand;
  /** Acento para fondos oscuros: tonos 300 (claro) y 400. */
  acento: { '300': string; '400': string };
  /** El color principal se oscureció para cumplir el contraste con texto blanco. */
  ajustado: boolean;
  /** Contraste (texto blanco sobre `brand-700`). */
  contraste: number;
}

const HEX = /^#[0-9a-f]{6}$/i;
export const esColorHex = (v: string) => HEX.test(v);

export type Rgb = [number, number, number];
export type Hsl = [number, number, number];

export function hexARgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const aHex = ([r, g, b]: Rgb) =>
  '#' +
  [r, g, b]
    .map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0'))
    .join('');

export function rgbAHsl([r, g, b]: Rgb): Hsl {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
}

function hslARgb([h, s, l]: Hsl): Rgb {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const hsl = (h: number, s: number, l: number) => aHex(hslARgb([h, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l))]));

function luminancia([r, g, b]: Rgb) {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contraste WCAG entre dos colores hex (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(hexARgb(a));
  const lb = luminancia(hexARgb(b));
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Genera la paleta a partir del color principal y, si se da, el de acento. */
export function generarPaleta(principal: string, acento?: string | null): PaletaGenerada {
  const [h, s, l0] = rgbAHsl(hexARgb(principal));
  let l = l0;
  let ajustado = false;
  while (l > 4 && contraste(hsl(h, s, l), '#ffffff') < CONTRASTE_MINIMO) {
    l -= 1;
    ajustado = true;
  }
  const base = hsl(h, s, l);
  const haciaClaro = (fraccion: number, satFactor: number) => hsl(h, s * satFactor, l + (96 - l) * fraccion);
  const haciaOscuro = (fraccion: number, tope: number) => hsl(h, s, Math.min(tope, l - (l - 6) * fraccion));

  const brand: EscalaBrand = {
    '50': haciaClaro(1, 0.7),
    '100': haciaClaro(0.93, 0.75),
    '200': haciaClaro(0.82, 0.8),
    '300': haciaClaro(0.7, 0.85),
    '400': haciaClaro(0.55, 0.9),
    '500': haciaClaro(0.38, 0.95),
    '600': haciaClaro(0.2, 1),
    '700': base,
    '800': haciaOscuro(0.3, 30),
    '900': haciaOscuro(0.62, 13),
    '950': haciaOscuro(0.85, 7),
  };

  const hayAcento = !!acento && esColorHex(acento);
  const [ha, sa, la] = hayAcento ? rgbAHsl(hexARgb(acento)) : [h, s, Math.max(l, 50)];
  return {
    brand,
    acento: { '300': hsl(ha, sa, Math.min(la + 14, 92)), '400': hayAcento ? acento.toLowerCase() : hsl(ha, sa, la) },
    ajustado,
    contraste: Math.round(contraste(base, '#ffffff') * 100) / 100,
  };
}
