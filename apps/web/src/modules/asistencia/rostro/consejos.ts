// v2: con la guía del teléfono (DA-44) se vuelve a mostrar a todos.
const CLAVE = 'asistencia.consejosCamara.ocultar.v2';

/** Consejos para una buena foto (antes de abrir la cámara). */
export const CONSEJOS_CAMARA = [
  'Quítate los lentes: es obligatorio',
  'Quítate la gorra y el cubrebocas',
  'Busca buena luz, sin ventana detrás',
];

/** El guardia puede ocultar los consejos en su celular ("No volver a mostrar"). */
export function debeMostrarConsejos() {
  try {
    return localStorage.getItem(CLAVE) !== '1';
  } catch {
    return true;
  }
}

export function ocultarConsejos() {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento: se seguirán mostrando.
  }
}
