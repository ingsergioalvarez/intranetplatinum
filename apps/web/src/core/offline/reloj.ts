/**
 * Reloj corregido (AS2-04). Sin señal no se puede confiar en la hora del celular (alguien pudo
 * cambiarla), así que en cada respuesta del servidor se guarda cuánto se aparta el reloj del celular
 * de la hora del servidor, y las checadas sin conexión usan esa hora corregida. El servidor además
 * recibe la hora cruda del celular y alerta si no coinciden.
 */
const CLAVE = 'offline.reloj';

/** Se llama con el encabezado `Date` de cada respuesta del servidor. */
export function registrarHoraServidor(fecha: string | null) {
  const servidor = fecha ? Date.parse(fecha) : NaN;
  if (Number.isNaN(servidor)) return;
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ offsetMs: servidor - Date.now(), en: Date.now() }));
  } catch {
    // Sin almacenamiento: se usa la hora del celular tal cual.
  }
}

function offsetMs() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { offsetMs: number } | null;
    return guardado?.offsetMs ?? 0;
  } catch {
    return 0;
  }
}

/** Hora actual según el último contacto con el servidor. */
export const horaEstimada = () => new Date(Date.now() + offsetMs());
