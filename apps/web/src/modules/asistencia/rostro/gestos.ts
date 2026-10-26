import { DetectorParpadeo, aperturaOjos } from './calidad';
import type { Punto } from './motor';

/**
 * Gesto al azar al marcar (DA-29): un video grabado no puede adivinar cuál se pedirá.
 * Todos se miden con los puntos de FaceMesh, relativos a las medidas normales de la persona
 * (aprendidas mientras estaba quieta de frente), así que no dependen de la distancia a la cámara.
 */
export const GESTOS = [
  'parpadear',
  'sonreir',
  'abrir_boca',
  'girar_izq',
  'girar_der',
  'mirar_arriba',
  'asentir',
] as const;
export type Gesto = (typeof GESTOS)[number];

export const TEXTO_GESTO: Record<Gesto, string> = {
  parpadear: 'Cierra y abre los ojos',
  sonreir: 'Sonríe',
  abrir_boca: 'Abre la boca',
  girar_izq: 'Gira la cabeza hacia la flecha',
  girar_der: 'Gira la cabeza hacia la flecha',
  mirar_arriba: 'Inclina la cabeza hacia arriba',
  asentir: 'Baja la cabeza',
};

/** Gestos que se completan al regresar a la posición normal. */
const CON_REGRESO: Gesto[] = ['abrir_boca', 'girar_izq', 'girar_der', 'mirar_arriba', 'asentir'];

const ULTIMO = 'asistencia.ultimoGesto';

/** Sortea un gesto distinto de los de `evitar` y del de la marca anterior (guardado en el celular). */
export function sortearGesto(evitar: Gesto[] = []): Gesto {
  let ultimo: string | null = null;
  try {
    ultimo = localStorage.getItem(ULTIMO);
  } catch {
    // Sin almacenamiento (modo privado): solo se evita repetir dentro de esta marca.
  }
  const opciones = GESTOS.filter((g) => g !== ultimo && !evitar.includes(g));
  const gesto = opciones[Math.floor(Math.random() * opciones.length)];
  try {
    localStorage.setItem(ULTIMO, gesto);
  } catch {
    // Igual que arriba.
  }
  return gesto;
}

/** Medidas del rostro relativas a su propio tamaño. */
export interface Medidas {
  /** Ancho de la boca / distancia entre ojos (crece al sonreír). */
  sonrisa: number;
  /** Separación de los labios / ancho de la boca (crece al abrir la boca). */
  boca: number;
  /** Desplazamiento horizontal de la nariz respecto al centro de los ojos (+ = gira a su izquierda). */
  giro: number;
  /** Altura de la nariz entre ojos y barbilla (baja al mirar arriba, sube al bajar la cabeza). */
  cabeceo: number;
}

export function medidasRostro(p: Punto[], w: number, h: number): Medidas {
  const px = (i: number) => ({ x: p[i].x * w, y: p[i].y * h });
  const d = (a: number, b: number) => Math.hypot(px(a).x - px(b).x, px(a).y - px(b).y);
  const ojos = d(33, 263) || 1;
  const centroOjos = { x: (px(33).x + px(263).x) / 2, y: (px(33).y + px(263).y) / 2 };
  const nariz = px(1);
  const barbilla = px(152);
  const anchoBoca = d(61, 291) || 1;
  return {
    sonrisa: anchoBoca / ojos,
    boca: d(13, 14) / anchoBoca,
    giro: (nariz.x - centroOjos.x) / ojos,
    cabeceo: (nariz.y - centroOjos.y) / (barbilla.y - centroOjos.y || 1),
  };
}

/** Promedio móvil de las medidas normales (mientras la persona está quieta de frente). */
export function mezclarMedidas(base: Medidas | null, m: Medidas): Medidas {
  if (!base) return m;
  return {
    sonrisa: base.sonrisa * 0.8 + m.sonrisa * 0.2,
    boca: base.boca * 0.8 + m.boca * 0.2,
    giro: base.giro * 0.8 + m.giro * 0.2,
    cabeceo: base.cabeceo * 0.8 + m.cabeceo * 0.2,
  };
}

/** Cuadros seguidos con el gesto hecho para darlo por bueno (evita falsos por ruido). */
const CUADROS_SEGUIDOS = 2;

/**
 * Detecta un gesto. `actualizar` devuelve true en el cuadro en que se completa; en los gestos
 * de movimiento (girar, mirar arriba, bajar la cabeza, abrir la boca) además hay que regresar a la
 * posición normal, para que la foto salga de frente.
 */
export class DetectorGesto {
  private seguidos = 0;
  private hecho = false;

  constructor(
    readonly gesto: Gesto,
    private readonly base: Medidas,
    private readonly parpadeo: DetectorParpadeo,
  ) {
    parpadeo.reiniciar();
  }

  /** Ya hizo el movimiento y falta regresar al frente. */
  get regresando() {
    return this.hecho && CON_REGRESO.includes(this.gesto);
  }

  actualizar(p: Punto[], w: number, h: number): boolean {
    if (this.gesto === 'parpadear') return this.parpadeo.actualizar(aperturaOjos(p, w, h));
    const m = medidasRostro(p, w, h);
    const b = this.base;
    const giro = m.giro - b.giro;
    const cabeceo = m.cabeceo / (b.cabeceo || 1);
    const [logrado, normal] = (
      {
        sonreir: [m.sonrisa > b.sonrisa * 1.12, true],
        abrir_boca: [m.boca > b.boca + 0.25, m.boca < b.boca + 0.1],
        girar_izq: [giro > 0.25, Math.abs(giro) < 0.1],
        girar_der: [giro < -0.25, Math.abs(giro) < 0.1],
        mirar_arriba: [cabeceo < 0.8, Math.abs(cabeceo - 1) < 0.1],
        asentir: [cabeceo > 1.2, Math.abs(cabeceo - 1) < 0.1],
      } satisfies Record<Exclude<Gesto, 'parpadear'>, [boolean, boolean]>
    )[this.gesto];

    if (!this.hecho) {
      this.seguidos = logrado ? this.seguidos + 1 : 0;
      if (this.seguidos >= CUADROS_SEGUIDOS) this.hecho = true;
      return this.hecho && !CON_REGRESO.includes(this.gesto);
    }
    return normal;
  }
}
