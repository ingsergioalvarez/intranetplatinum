const EVENTO = 'asistencia:bienvenida-rostro';

/** Pide abrir la ventana "registra tu rostro" (al checar o desde el aviso del Checador). */
export const pedirBienvenidaRostro = () => window.dispatchEvent(new Event(EVENTO));

export const alPedirBienvenidaRostro = (fn: () => void) => {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
};
