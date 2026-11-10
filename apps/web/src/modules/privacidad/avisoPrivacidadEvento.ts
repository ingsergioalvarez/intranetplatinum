const EVENTO = 'privacidad:aviso';

/** Pide abrir la ventana del aviso de privacidad (desde el aviso del Checador). */
export const pedirAvisoPrivacidad = () => window.dispatchEvent(new Event(EVENTO));

export const alPedirAvisoPrivacidad = (fn: () => void) => {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
};
