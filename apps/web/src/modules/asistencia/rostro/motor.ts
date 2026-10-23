/**
 * Motor de reconocimiento facial (adaptado del proyecto Optometrista):
 * - MediaPipe FaceMesh: malla de 468 puntos en vivo (guía de calidad, parpadeo y gestos).
 * - face-api.js: vector de identidad de 128 valores.
 * - Detector de pantalla o foto (antispoof.ts) sobre el TensorFlow.js de face-api.
 * Se carga solo al abrir la cámara, desde `/modelos` (sin depender de CDN).
 */
import { cargarAntispoof, type Tf } from './antispoof';

export interface Punto {
  x: number;
  y: number;
  z: number;
}

interface FaceMeshInstance {
  setOptions(o: Record<string, unknown>): void;
  onResults(cb: (r: { multiFaceLandmarks?: Punto[][] }) => void): void;
  send(i: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
}

interface Deteccion {
  descriptor: Float32Array;
}

interface ConsultaRostro extends PromiseLike<{ score: number } | undefined> {
  withFaceLandmarks(): { withFaceDescriptor(): Promise<Deteccion | undefined> };
}

interface Red {
  loadFromUri(url: string): Promise<void>;
  // Para calentar cada red una vez antes de abrir la cámara.
  detectLandmarks?(input: HTMLCanvasElement): Promise<unknown>;
  computeFaceDescriptor?(input: HTMLCanvasElement): Promise<unknown>;
}

interface FaceApi {
  nets: Record<'ssdMobilenetv1' | 'tinyFaceDetector' | 'faceLandmark68Net' | 'faceRecognitionNet', Red>;
  detectSingleFace(input: HTMLVideoElement | HTMLCanvasElement, opciones: unknown): ConsultaRostro;
  SsdMobilenetv1Options: new (o: { minConfidence: number }) => unknown;
  tf: Tf;
  TinyFaceDetectorOptions: new (o: { inputSize: number; scoreThreshold: number }) => unknown;
}

declare global {
  interface Window {
    FaceMesh?: new (cfg: { locateFile: (f: string) => string }) => FaceMeshInstance;
    faceapi?: FaceApi;
  }
}

const BASE = '/modelos';

function cargarScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

export interface Motor {
  /** Puntos del rostro en la imagen (normalizados 0..1), o null si no hay rostro. */
  analizar(imagen: HTMLVideoElement | HTMLCanvasElement): Promise<Punto[] | null>;
  /** Confianza del detector ligero (señal cruzada de obstrucción). */
  confianza(imagen: HTMLVideoElement | HTMLCanvasElement): Promise<number>;
  /** Vector de identidad de 128 valores del recorte del rostro, o null si no se pudo leer. */
  vector(recorte: HTMLCanvasElement): Promise<number[] | null>;
  /** Probabilidad (0..1) de que sea una persona real y no una pantalla o foto (DA-30). */
  vida(imagen: HTMLCanvasElement, puntos: Punto[]): Promise<number>;
}

let motor: Promise<Motor> | null = null;

type Progreso = (hechos: number, total: number) => void;
const TOTAL_PASOS = 8;
/** Avance compartido: la carga puede haber empezado antes (precarga) y la barra la retoma. */
let avance = 0;
const oyentes = new Set<Progreso>();

/**
 * Corre cada motor una vez en vacío: la primera ejecución prepara memoria y tarjeta gráfica y en
 * un celular tarda 1-3 s. Así sucede durante la barra de carga y no con la cámara ya abierta.
 */
async function calentar(faceapi: FaceApi, faceMesh: FaceMeshInstance) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 192;
  lienzo.height = 192;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  await faceMesh.send({ image: lienzo });
  await faceapi.detectSingleFace(
    lienzo,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }),
  );
  await faceapi.detectSingleFace(lienzo, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }));
  await faceapi.nets.faceLandmark68Net.detectLandmarks?.(lienzo);
  await faceapi.nets.faceRecognitionNet.computeFaceDescriptor?.(lienzo);
}

/**
 * Carga (una sola vez) librerías y modelos y los calienta. `onProgreso(hechos, total)` para la
 * barra de avance (también si la carga ya iba en curso por la precarga).
 */
export function cargarMotor(onProgreso?: Progreso): Promise<Motor> {
  if (onProgreso) {
    oyentes.add(onProgreso);
    onProgreso(avance, TOTAL_PASOS);
  }
  motor ??= (async () => {
    const total = TOTAL_PASOS;
    const paso = <T>(p: Promise<T>) =>
      p.then((v) => {
        avance++;
        oyentes.forEach((f) => f(avance, total));
        return v;
      });

    await Promise.all([
      paso(cargarScript(`${BASE}/mediapipe/face_mesh.js`)),
      paso(cargarScript(`${BASE}/face-api/face-api.js`)),
    ]);
    const faceapi = window.faceapi;
    if (!faceapi || !window.FaceMesh)
      throw new Error('No se pudieron cargar las librerías de reconocimiento');

    const url = `${BASE}/face-api`;
    await Promise.all([
      paso(faceapi.nets.ssdMobilenetv1.loadFromUri(url)),
      paso(faceapi.nets.tinyFaceDetector.loadFromUri(url)),
      paso(faceapi.nets.faceLandmark68Net.loadFromUri(url)),
      paso(faceapi.nets.faceRecognitionNet.loadFromUri(url)),
    ]);
    const antispoof = await paso(cargarAntispoof(faceapi.tf));

    // Una sola instancia de FaceMesh para toda la sesión (recrearla rompe el WASM).
    const faceMesh = new window.FaceMesh({ locateFile: (f) => `${BASE}/mediapipe/${f}` });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });
    let ultimo: Punto[] | null = null;
    faceMesh.onResults((r) => {
      ultimo = r.multiFaceLandmarks?.[0] ?? null;
    });
    // Si el calentamiento falla no pasa nada: solo tardará más el primer cuadro.
    await paso(calentar(faceapi, faceMesh).catch(() => undefined));

    return {
      async analizar(imagen) {
        ultimo = null;
        await faceMesh.send({ image: imagen });
        return ultimo;
      },
      async confianza(imagen) {
        const det = await faceapi.detectSingleFace(
          imagen,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }),
        );
        return det?.score ?? 0;
      },
      async vector(recorte) {
        // Primero el detector preciso; si no encuentra el rostro, el ligero (como en Optometrista).
        const det =
          (await faceapi
            .detectSingleFace(recorte, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor()) ??
          (await faceapi
            .detectSingleFace(
              recorte,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }),
            )
            .withFaceLandmarks()
            .withFaceDescriptor());
        return det ? Array.from(det.descriptor) : null;
      },
      vida: (imagen, puntos) => antispoof.real(imagen, puntos),
    };
  })();
  // Si falla, permitir reintentar en la siguiente apertura.
  motor.catch(() => {
    motor = null;
    avance = 0;
  });
  if (onProgreso) {
    motor.then(
      () => oyentes.delete(onProgreso),
      () => oyentes.delete(onProgreso),
    );
  }
  return motor;
}

/**
 * Precarga en segundo plano (al entrar al "Checador"): cuando el guardia toca Entrada o Salida la
 * cámara abre casi al instante. Los archivos quedan en la caché del navegador.
 */
export function precargarMotor() {
  cargarMotor().catch(() => undefined);
}
