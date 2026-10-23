export interface Ubicacion {
  lat: number;
  lng: number;
  /** Precisión reportada por el GPS, en metros. */
  precisionM: number;
}

export type MotivoSinUbicacion = 'denegada' | 'no_disponible' | 'tiempo';

export class SinUbicacionError extends Error {
  constructor(public readonly motivo: MotivoSinUbicacion) {
    super(MENSAJES_SIN_UBICACION[motivo]);
  }
}

export const MENSAJES_SIN_UBICACION: Record<MotivoSinUbicacion, string> = {
  denegada: 'Permite el acceso a tu ubicación en el navegador para poder checar.',
  no_disponible: 'No se pudo obtener tu ubicación. Activa el GPS del celular e intenta de nuevo.',
  tiempo: 'La ubicación tardó demasiado. Intenta de nuevo en un lugar más despejado.',
};

/**
 * Ubicación actual del dispositivo (GPS obligatorio para marcar, DA-02).
 * Requiere HTTPS o localhost: en otros orígenes el navegador la bloquea.
 */
export function obtenerUbicacion({ fresca = false } = {}): Promise<Ubicacion> {
  if (!navigator.geolocation) return Promise.reject(new SinUbicacionError('no_disponible'));
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lat: Number(coords.latitude.toFixed(7)),
          lng: Number(coords.longitude.toFixed(7)),
          precisionM: Math.round(coords.accuracy),
        }),
      (err) =>
        reject(
          new SinUbicacionError(
            err.code === err.PERMISSION_DENIED
              ? 'denegada'
              : err.code === err.TIMEOUT
                ? 'tiempo'
                : 'no_disponible',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: fresca ? 0 : 30_000 },
    ),
  );
}

/** UUID v4 para identificar la marca (funciona también fuera de HTTPS, a diferencia de `crypto.randomUUID`). */
export function nuevoIdMarca(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
