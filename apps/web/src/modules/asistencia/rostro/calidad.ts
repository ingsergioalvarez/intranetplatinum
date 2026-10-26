import type { Punto } from './motor';

/**
 * Reglas de calidad de la captura (portadas de Optometrista `PacientesView.jsx`) y detección
 * de parpadeo para la prueba de vida. Coordenadas de MediaPipe normalizadas (0..1).
 */

export type Luz = 'ok' | 'oscuro' | 'reflejo' | 'cara_oscura';
export type Posicion = 'ok' | 'ajustar' | 'obstruido';
export type Mirada = 'ok' | 'desviada';

/** Luminancia promedio del cuadro (muestreo cada 16 píxeles). */
export function luminanciaPromedio(img: ImageData) {
  let total = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 64) {
    total += img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
    n++;
  }
  return n ? total / n : 0;
}

export function cajaRostro(puntos: Punto[], w: number, h: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of puntos) {
    minX = Math.min(minX, p.x * w);
    maxX = Math.max(maxX, p.x * w);
    minY = Math.min(minY, p.y * h);
    maxY = Math.max(maxY, p.y * h);
  }
  return { minX, minY, maxX, maxY };
}

/** Contraluz o reflejo que "quema" una porción del rostro (más del 12 % de píxeles casi blancos). */
export function rostroSobreexpuesto(img: ImageData, puntos: Punto[]) {
  const { width: w, height: h } = img;
  const c = cajaRostro(puntos, w, h);
  let muestras = 0;
  let quemados = 0;
  for (let y = Math.max(0, Math.floor(c.minY)); y < Math.min(h, c.maxY); y += 4) {
    for (let x = Math.max(0, Math.floor(c.minX)); x < Math.min(w, c.maxX); x += 4) {
      const i = (y * w + x) * 4;
      muestras++;
      if (img.data[i] > 248 && img.data[i + 1] > 248 && img.data[i + 2] > 248) quemados++;
    }
  }
  return muestras > 0 && quemados / muestras > 0.12;
}

/**
 * La cara en sí se ve oscura aunque el cuadro no (cámaras de gama baja, luz detrás). Medido: con
 * buena luz ≈ 150; oscura ≈ 45.
 */
export const LUZ_ROSTRO_MIN = 65;
/** Contraste mínimo dentro de los ojos para distinguirlos. Medido: bien ≈ 34; oscuro ≈ 10. */
export const CONTRASTE_OJOS_MIN = 14;

export function evaluarLuz(img: ImageData, puntos: Punto[] | null): Luz {
  if (luminanciaPromedio(img) < 20) return 'oscuro';
  if (puntos && rostroSobreexpuesto(img, puntos)) return 'reflejo';
  if (puntos && luminanciaRostro(img, puntos) < LUZ_ROSTRO_MIN) return 'cara_oscura';
  return 'ok';
}

/**
 * Pose que se pide en cada foto. `lado` con `signo` exige girar hacia un lado concreto
 * (1 = a su izquierda, -1 = a su derecha); sin `signo`, hacia cualquiera. `vertical` pide mirar
 * un poco hacia arriba o bajar un poco la cabeza, comparado con su foto de frente (`base`).
 */
export type Objetivo =
  | { tipo: 'frente' }
  | { tipo: 'lado'; signo?: 1 | -1 }
  | { tipo: 'vertical'; sentido: 'arriba' | 'abajo'; base: number | null };

/**
 * Altura de la nariz entre los ojos y la barbilla (0..1): baja al mirar hacia arriba y sube al
 * bajar la cabeza. Se compara contra la de la foto de frente de la misma persona.
 */
export function cabeceo(p: Punto[], h: number) {
  const ojos = ((p[33].y + p[263].y) / 2) * h;
  return (p[1].y * h - ojos) / (p[152].y * h - ojos || 1);
}

/** Cabeceo típico de frente (medido ≈ 0.29), si aún no hay foto de frente con qué comparar. */
const CABECEO_FRENTE = 0.29;

/**
 * Por debajo de este cabeceo la cara se ve claramente desde abajo: el teléfono está abajo apuntando
 * hacia arriba (o la cabeza muy echada para atrás). Se pide subir el teléfono (DA-44). Es un respaldo
 * conservador (de frente ≈ 0.29) para cuando no hay sensor de inclinación; ajustar con pruebas reales.
 */
export const CABECEO_DESDE_ABAJO = 0.18;
/** Por encima, la cara se ve claramente desde arriba: el teléfono está muy arriba apuntando hacia abajo. */
export const CABECEO_DESDE_ARRIBA = 0.45;

export interface Pose {
  posicion: Posicion;
  mirada: Mirada;
  instruccion: string | null;
  /** Hacia dónde está girada la cabeza (1 / -1; 0 de frente). Sirve para pedir el lado contrario. */
  giro: -1 | 0 | 1;
}

// Simetría nariz-ojos: 1 = de frente; baja al girar la cabeza.
const FRENTE_MIN = 0.72;
const LADO_MIN = 0.3;
const LADO_MAX = 0.65;

/**
 * Mirada y obstrucción según la pose pedida (el encuadre se revisa aparte contra el óvalo). `confianza` es la del detector de face-api: MediaPipe
 * dibuja una malla "válida" aunque una mano tape la cara, así que se usa como señal cruzada.
 */
export function evaluarPose(
  puntos: Punto[],
  w: number,
  h: number,
  confianza: number,
  objetivo: Objetivo = { tipo: 'frente' },
): Pose {
  const nariz = puntos[1];
  const ojoIzq = puntos[33];
  const ojoDer = puntos[263];
  const bocaIzq = puntos[61];
  const bocaDer = puntos[291];
  const deLado = objetivo.tipo === 'lado';
  // Girada o inclinada la cabeza, la nariz se adelanta y el detector confía menos: más tolerancia.
  const conMovimiento = objetivo.tipo !== 'frente';
  const anchoBoca = Math.hypot((bocaDer.x - bocaIzq.x) * w, (bocaDer.y - bocaIzq.y) * h);
  const obstruido =
    anchoBoca < w * 0.02 ||
    Math.abs(nariz.z) > (conMovimiento ? 0.25 : 0.18) ||
    confianza < (conMovimiento ? 0.25 : 0.4);

  const dIzq = Math.abs(nariz.x - ojoIzq.x);
  const dDer = Math.abs(ojoDer.x - nariz.x);
  const simetria = Math.min(dIzq, dDer) / (Math.max(dIzq, dDer) || 1);
  const giro: Pose['giro'] = simetria >= FRENTE_MIN ? 0 : dIzq > dDer ? 1 : -1;
  const inclinacion = Math.abs((Math.atan2(ojoDer.y - ojoIzq.y, ojoDer.x - ojoIzq.x) * 180) / Math.PI);

  let posicion: Posicion = 'ok';
  let instruccion: string | null = null;
  if (obstruido) {
    posicion = 'obstruido';
    instruccion = 'Quítate la gorra o retira la mano de tu cara';
  }

  let mirada: Mirada = 'ok';
  if (inclinacion > 15) {
    mirada = 'desviada';
    instruccion ??= 'Endereza la cabeza';
  } else if (!deLado && simetria < FRENTE_MIN) {
    mirada = 'desviada';
    instruccion ??= 'Mira de frente a la cámara';
  } else if (objetivo.tipo === 'lado') {
    const haciaDonde = 'hacia la flecha';
    if (simetria > LADO_MAX) {
      mirada = 'desviada';
      instruccion ??= `Gira un poco la cabeza ${haciaDonde}`;
    } else if (simetria < LADO_MIN) {
      mirada = 'desviada';
      instruccion ??= 'No tanto: gira un poco menos';
    } else if (objetivo.signo && giro !== objetivo.signo) {
      mirada = 'desviada';
      instruccion ??= `Al otro lado: gira ${haciaDonde}`;
    }
  } else if (objetivo.tipo === 'vertical') {
    // Relativo a su foto de frente: arriba ≈ 15-45 % menos; abajo ≈ 15-50 % más.
    const relativo = cabeceo(puntos, h) / (objetivo.base ?? CABECEO_FRENTE);
    const arriba = objetivo.sentido === 'arriba';
    if (arriba ? relativo > 0.85 : relativo < 1.15) {
      mirada = 'desviada';
      instruccion ??= arriba ? 'Inclina la cabeza un poco hacia arriba' : 'Baja un poco la cabeza';
    } else if (arriba ? relativo < 0.55 : relativo > 1.5) {
      mirada = 'desviada';
      instruccion ??= arriba ? 'No tanto: inclina la cabeza un poco menos' : 'No tanto: baja un poco menos';
    }
  }
  return { posicion, mirada, instruccion, giro };
}

/**
 * Apertura de los ojos (promedio de ambos) medida en píxeles: los puntos vienen normalizados
 * por separado al ancho y al alto del video, así que hay que llevarlos a píxeles antes de
 * comparar distancias verticales con horizontales (si no, en un celular vertical la medida
 * sale deformada).
 */
export function aperturaOjos(p: Punto[], w: number, h: number) {
  const d = (a: number, b: number) => Math.hypot((p[a].x - p[b].x) * w, (p[a].y - p[b].y) * h);
  const ear = (arriba: number, abajo: number, ext: number, int: number) =>
    d(arriba, abajo) / (d(ext, int) || 1);
  return (ear(159, 145, 33, 133) + ear(386, 374, 263, 362)) / 2;
}

/**
 * Detector de parpadeo adaptado a cada persona: aprende la apertura normal de los ojos y
 * cuenta un parpadeo cuando baja a menos del 70 % y vuelve a más del 85 % (un parpadeo normal
 * dura ~100-150 ms y con lentes la caída se nota menos, así que no se exige cerrar del todo).
 * Prueba de vida simple: una foto impresa o en otra pantalla no parpadea.
 */
export class DetectorParpadeo {
  private abiertos: number | null = null;
  private cerrados = false;

  /** Apertura normal de los ojos de esta persona (null hasta el primer cuadro). */
  get apertura() {
    return this.abiertos;
  }

  reiniciar() {
    this.cerrados = false;
  }

  /** Devuelve true en el cuadro en que se completa el parpadeo. */
  actualizar(apertura: number) {
    if (this.abiertos === null) {
      this.abiertos = apertura;
      return false;
    }
    if (!this.cerrados) {
      if (apertura < this.abiertos * 0.7) {
        this.cerrados = true;
      } else if (apertura > this.abiertos * 0.85) {
        // Promedio móvil de la apertura con ojos abiertos.
        this.abiertos = this.abiertos * 0.9 + apertura * 0.1;
      }
      return false;
    }
    if (apertura > this.abiertos * 0.85) {
      this.cerrados = false;
      return true;
    }
    return false;
  }
}

/**
 * Posibles lentes (heurístico de Optometrista): el puente nasal (punto 168, por donde pasa el
 * armazón) se ve más oscuro que la piel de mejillas y frente. Es relativo a la piel de la propia
 * persona; puede fallar con armazones muy delgados. Solo sirve para sugerir quitárselos.
 */
export function pareceTenerLentes(img: ImageData, puntos: Punto[]) {
  const { width: w, height: h } = img;
  const luminancia = (idx: number) => {
    const cx = Math.round(puntos[idx].x * w);
    const cy = Math.round(puntos[idx].y * h);
    let total = 0;
    let n = 0;
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        total += img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
        n++;
      }
    }
    return n ? total / n : null;
  };
  const puente = luminancia(168);
  const piel = [luminancia(234), luminancia(454), luminancia(10)].filter((v): v is number => v !== null);
  if (puente === null || piel.length === 0) return false;
  return piel.reduce((a, b) => a + b, 0) / piel.length - puente > 28;
}

/** Luminancia promedio de la caja del rostro (la cara en sí, no todo el cuadro). */
export function luminanciaRostro(img: ImageData, puntos: Punto[]) {
  const { width: w, height: h } = img;
  const c = cajaRostro(puntos, w, h);
  let total = 0;
  let n = 0;
  for (let y = Math.max(0, Math.floor(c.minY)); y < Math.min(h, c.maxY); y += 3) {
    for (let x = Math.max(0, Math.floor(c.minX)); x < Math.min(w, c.maxX); x += 3) {
      const i = (y * w + x) * 4;
      total += img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
      n++;
    }
  }
  return n ? total / n : 0;
}

/** Puntos que rodean cada ojo (MediaPipe): esquinas y párpados. */
const OJOS = [
  [33, 133, 159, 145, 160, 144],
  [263, 362, 386, 374, 387, 373],
];

/**
 * Qué tanto se distinguen los ojos: desviación de la luminancia dentro de cada ojo (el blanco, el
 * iris y las pestañas dan contraste). Con poca luz, sombra, reflejo en los lentes o una cámara mala
 * baja mucho. Devuelve la del ojo que peor se ve.
 */
export function contrasteOjos(img: ImageData, puntos: Punto[]) {
  const { width: w, height: h } = img;
  let peor = Infinity;
  for (const ojo of OJOS) {
    const xs = ojo.map((i) => puntos[i].x * w);
    const ys = ojo.map((i) => puntos[i].y * h);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - 1));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys) + 1));
    let suma = 0;
    let suma2 = 0;
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        const l = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
        suma += l;
        suma2 += l * l;
        n++;
      }
    }
    if (n < 4) continue;
    const media = suma / n;
    peor = Math.min(peor, Math.sqrt(Math.max(0, suma2 / n - media * media)));
  }
  return peor === Infinity ? 0 : peor;
}

/**
 * Recorte del rostro (con margen) antes de pasarlo a face-api: evita leer la cara de otra
 * persona que aparezca al fondo del cuadro.
 */
export function recortarRostro(origen: HTMLCanvasElement, puntos: Punto[], margen = 0.4) {
  const { width: w, height: h } = origen;
  const c = cajaRostro(puntos, w, h);
  const mx = (c.maxX - c.minX) * margen;
  const my = (c.maxY - c.minY) * margen;
  const sx = Math.max(0, Math.floor(c.minX - mx));
  const sy = Math.max(0, Math.floor(c.minY - my));
  const ex = Math.min(w, Math.ceil(c.maxX + mx));
  const ey = Math.min(h, Math.ceil(c.maxY + my));
  const recorte = document.createElement('canvas');
  recorte.width = Math.max(1, ex - sx);
  recorte.height = Math.max(1, ey - sy);
  recorte
    .getContext('2d')!
    .drawImage(origen, sx, sy, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
  return recorte;
}

// ---------- Encuadre: la cara debe estar dentro del óvalo que se ve en pantalla ----------

export interface Ovalo {
  cx: number;
  cy: number;
  /** Semiejes en píxeles de pantalla. */
  rx: number;
  ry: number;
}

/** Óvalo guía (proporción 3:4, 70 % del alto, máximo 80 % del ancho) centrado en el visor. */
export function geometriaOvalo(ancho: number, alto: number): Ovalo {
  let h = alto * 0.7;
  let w = h * 0.75;
  if (w > ancho * 0.8) {
    w = ancho * 0.8;
    h = w / 0.75;
  }
  return { cx: ancho / 2, cy: alto / 2, rx: w / 2, ry: h / 2 };
}

/**
 * ¿La cara está dentro del óvalo? Lleva los puntos del video a la pantalla (el video se muestra
 * con `object-cover` y en espejo) y exige que al menos el 85 % esté dentro y que la cara llene
 * el óvalo (ni muy lejos ni cortada).
 */
export function evaluarEncuadre(
  puntos: Punto[],
  video: { ancho: number; alto: number },
  visor: { ancho: number; alto: number },
): { ok: boolean; instruccion: string | null } {
  const escala = Math.max(visor.ancho / video.ancho, visor.alto / video.alto);
  const dw = video.ancho * escala;
  const dh = video.alto * escala;
  const ox = (visor.ancho - dw) / 2;
  const oy = (visor.alto - dh) / 2;
  const ov = geometriaOvalo(visor.ancho, visor.alto);

  let dentro = 0;
  let total = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < puntos.length; i += 3) {
    const x = visor.ancho - (ox + puntos[i].x * dw); // espejo
    const y = oy + puntos[i].y * dh;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    total++;
    if (((x - ov.cx) / ov.rx) ** 2 + ((y - ov.cy) / ov.ry) ** 2 <= 1) dentro++;
  }
  const alturaRelativa = (maxY - minY) / (ov.ry * 2);
  // Primero el tamaño: una cara muy grande también se sale del óvalo, pero hay que alejarse.
  if (alturaRelativa > 1.05) return { ok: false, instruccion: 'Aléjate un poco' };
  if (total === 0 || dentro / total < 0.85)
    return { ok: false, instruccion: 'Coloca tu cara dentro del óvalo' };
  if (alturaRelativa < 0.55) return { ok: false, instruccion: 'Acércate un poco más' };
  return { ok: true, instruccion: null };
}
