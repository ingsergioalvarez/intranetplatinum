/**
 * Detector de pantalla o foto (anti-spoofing pasivo, DA-30): MiniFASNetV2 de
 * Silent-Face-Anti-Spoofing (Apache-2.0), convertido a `/modelos/antispoof` (grafo JSON + pesos
 * NHWC) y ejecutado con el TensorFlow.js que ya trae face-api (sin descargas extra).
 * Mira la textura, los reflejos y el marco alrededor de la cara: una pantalla o una foto impresa
 * da una probabilidad de "real" cercana a 0.
 */
import { cajaRostro } from './calidad';
import type { Punto } from './motor';

interface Tensor {
  dispose(): void;
  data(): Promise<Float32Array>;
}

/** Lo que se usa del TensorFlow.js incluido en face-api. */
export interface Tf {
  tidy<T extends Tensor>(fn: () => T): T;
  tensor(valores: Float32Array, forma: number[]): Tensor;
  pad(x: Tensor, relleno: number[][]): Tensor;
  conv2d(x: Tensor, filtro: Tensor, pasos: number, relleno: 'valid'): Tensor;
  depthwiseConv2d(x: Tensor, filtro: Tensor, pasos: number, relleno: 'valid'): Tensor;
  add(a: Tensor, b: Tensor): Tensor;
  mul(a: Tensor, b: Tensor): Tensor;
  prelu(x: Tensor, alfa: Tensor): Tensor;
  reshape(x: Tensor, forma: number[]): Tensor;
  matMul(a: Tensor, b: Tensor): Tensor;
  softmax(x: Tensor): Tensor;
}

type Nodo =
  | { op: 'conv' | 'dw'; in: string; w: string; b: string | null; pad: number; stride: number; out: string }
  | { op: 'prelu'; in: string; a: string; out: string }
  | { op: 'add'; in: string; in2: string; out: string }
  | { op: 'flatten'; in: string; out: string }
  | { op: 'matmul'; in: string; w: string; out: string }
  | { op: 'affine'; in: string; escala: string; desp: string; out: string };

interface Grafo {
  entrada: [number, number, number];
  escalaRecorte: number;
  nodos: Nodo[];
  tensores: Record<string, { shape: number[]; offset: number }>;
}

export interface Antispoof {
  /** Probabilidad (0..1) de que la cara sea de una persona real y no de una pantalla o foto. */
  real(imagen: HTMLCanvasElement, puntos: Punto[]): Promise<number>;
}

const BASE = '/modelos/antispoof';

export async function cargarAntispoof(tf: Tf): Promise<Antispoof> {
  const [grafo, buffer] = await Promise.all([
    fetch(`${BASE}/antispoof.json`).then((r) => r.json() as Promise<Grafo>),
    fetch(`${BASE}/antispoof.bin`).then((r) => r.arrayBuffer()),
  ]);
  const todos = new Float32Array(buffer);
  const pesos = new Map<string, Tensor>();
  for (const [nombre, { shape, offset }] of Object.entries(grafo.tensores)) {
    const n = shape.reduce((a, b) => a * b, 1);
    pesos.set(nombre, tf.tensor(todos.subarray(offset, offset + n), shape));
  }
  const peso = (nombre: string) => pesos.get(nombre)!;
  const [alto, ancho] = grafo.entrada;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;

  /** Probabilidad de "real" de una imagen BGR (0-255) del tamaño de entrada del modelo. */
  async function inferir(bgr: Float32Array) {
    const salida = tf.tidy(() => {
      const t = new Map<string, Tensor>([['input', tf.tensor(bgr, [1, alto, ancho, 3])]]);
      for (const n of grafo.nodos) {
        const x = t.get(n.in)!;
        let y: Tensor;
        switch (n.op) {
          case 'conv':
          case 'dw': {
            const entrada = n.pad
              ? tf.pad(x, [
                  [0, 0],
                  [n.pad, n.pad],
                  [n.pad, n.pad],
                  [0, 0],
                ])
              : x;
            y =
              n.op === 'conv'
                ? tf.conv2d(entrada, peso(n.w), n.stride, 'valid')
                : tf.depthwiseConv2d(entrada, peso(n.w), n.stride, 'valid');
            if (n.b) y = tf.add(y, peso(n.b));
            break;
          }
          case 'prelu':
            y = tf.prelu(x, peso(n.a));
            break;
          case 'add':
            y = tf.add(x, t.get(n.in2)!);
            break;
          case 'flatten':
            y = tf.reshape(x, [1, -1]);
            break;
          case 'matmul':
            y = tf.matMul(x, peso(n.w));
            break;
          case 'affine':
            y = tf.add(tf.mul(x, peso(n.escala)), peso(n.desp));
            break;
        }
        t.set(n.out, y);
      }
      return tf.softmax(t.get('output')!);
    });
    const prob = await salida.data();
    salida.dispose();
    // Clases del modelo: 1 = real; 0 y 2 = falsas (foto o pantalla).
    return prob[1];
  }

  // Primera ejecución en vacío: prepara la GPU para que el primer análisis real no tarde.
  await inferir(new Float32Array(alto * ancho * 3));

  return {
    async real(imagen, puntos) {
      // Recorte amplio alrededor de la cara (incluye el marco de una pantalla, si lo hay).
      const { width: w, height: h } = imagen;
      const c = cajaRostro(puntos, w, h);
      const bw = c.maxX - c.minX;
      const bh = c.maxY - c.minY;
      const escala = Math.min((h - 1) / bh, (w - 1) / bw, grafo.escalaRecorte);
      const cx = c.minX + bw / 2;
      const cy = c.minY + bh / 2;
      const x1 = Math.max(0, Math.floor(cx - (bw * escala) / 2));
      const y1 = Math.max(0, Math.floor(cy - (bh * escala) / 2));
      const x2 = Math.min(w - 1, Math.floor(cx + (bw * escala) / 2));
      const y2 = Math.min(h - 1, Math.floor(cy + (bh * escala) / 2));
      ctx.drawImage(imagen, x1, y1, x2 - x1 + 1, y2 - y1 + 1, 0, 0, ancho, alto);
      const rgba = ctx.getImageData(0, 0, ancho, alto).data;

      // El modelo espera BGR de 0 a 255, sin normalizar.
      const bgr = new Float32Array(ancho * alto * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        bgr[j] = rgba[i + 2];
        bgr[j + 1] = rgba[i + 1];
        bgr[j + 2] = rgba[i];
      }

      return inferir(bgr);
    },
  };
}
