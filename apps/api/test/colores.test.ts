import { describe, expect, it } from 'vitest';
import { coloresDominantes, hexARgb, rgbAHsl } from '@platinum/shared';

/** Imagen sintética: `n` píxeles opacos de cada color, en orden. */
const imagen = (...tramos: [string, number][]) => {
  const datos: number[] = [];
  for (const [hex, n] of tramos) {
    const [r, g, b] = hexARgb(hex);
    for (let i = 0; i < n; i++) datos.push(r, g, b, 255);
  }
  return Uint8ClampedArray.from(datos);
};

const tono = (hex: string) => rgbAHsl(hexARgb(hex))[0];

describe('colores dominantes de un logo', () => {
  it('toma el color que más aparece como principal y un segundo color distinto como acento', () => {
    const r = coloresDominantes(imagen(['#1f4fd0', 600], ['#e87722', 200], ['#ffffff', 2000]))!;
    expect(r).not.toBeNull();
    expect(tono(r.principal)).toBeGreaterThan(210);
    expect(tono(r.principal)).toBeLessThan(235);
    expect(r.acento).not.toBeNull();
    expect(tono(r.acento!)).toBeGreaterThan(20);
    expect(tono(r.acento!)).toBeLessThan(40);
  });

  it('ignora el fondo transparente, el blanco, el negro y los grises', () => {
    const transparente = Uint8ClampedArray.from([255, 0, 0, 0].flatMap((v, i) => (i === 3 ? [0] : [v])));
    const r = coloresDominantes(
      new Uint8ClampedArray([
        ...Array.from({ length: 500 }, () => [...transparente]).flat(),
        ...imagen(['#1f4fd0', 100], ['#ffffff', 300], ['#000000', 300], ['#808080', 300]),
      ]),
    )!;
    expect(tono(r.principal)).toBeGreaterThan(210);
    expect(tono(r.principal)).toBeLessThan(235);
    expect(r.acento).toBeNull();
  });

  it('devuelve null si el logo solo tiene blanco, negro o grises', () => {
    expect(coloresDominantes(imagen(['#000000', 400], ['#ffffff', 400], ['#7a7a7a', 400]))).toBeNull();
  });

  it('devuelve null si casi no hay píxeles con color', () => {
    expect(coloresDominantes(imagen(['#1f4fd0', 3], ['#ffffff', 1000]))).toBeNull();
  });

  it('un logo de un solo color no trae acento', () => {
    const r = coloresDominantes(imagen(['#0b6e4f', 500], ['#ffffff', 500]))!;
    expect(r.acento).toBeNull();
  });

  it('agrupa tonos parecidos, también los que cruzan el rojo (350° y 5°)', () => {
    const r = coloresDominantes(imagen(['#e6143c', 300], ['#e61e14', 300]))!;
    expect(r.acento).toBeNull();
  });

  it('ignora un segundo color que casi no aparece', () => {
    const r = coloresDominantes(imagen(['#1f4fd0', 1000], ['#e87722', 40]))!;
    expect(r.acento).toBeNull();
  });

  it('el principal es el que más pesa aunque aparezca después', () => {
    const r = coloresDominantes(imagen(['#e87722', 100], ['#1f4fd0', 900]))!;
    expect(tono(r.principal)).toBeGreaterThan(210);
    expect(tono(r.acento!)).toBeLessThan(40);
  });
});
