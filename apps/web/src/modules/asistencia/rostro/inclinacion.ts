/**
 * Inclinación del teléfono (DA-44): `beta` del sensor de orientación, en grados (90 = vertical,
 * 0 = acostado). Por debajo de este valor el teléfono está abajo apuntando hacia arriba a la cara.
 */
export const INCLINACION_MIN = 50;
/** Por encima, el teléfono está muy arriba apuntando hacia abajo a la cara. */
export const INCLINACION_MAX = 120;

/**
 * En iPhone hay que pedir permiso para leer el sensor y solo se puede al tocar un botón; en
 * Android no hace falta. Si no se concede, se usa solo la detección por la cara.
 */
export function pedirSensorInclinacion() {
  const D = (globalThis as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent;
  D?.requestPermission?.().catch(() => undefined);
}
