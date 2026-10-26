import { useSyncExternalStore } from 'react';

const suscribir = (f: () => void) => {
  window.addEventListener('online', f);
  window.addEventListener('offline', f);
  return () => {
    window.removeEventListener('online', f);
    window.removeEventListener('offline', f);
  };
};

/** El navegador cree que hay conexión (puede haber señal y aun así no llegar al servidor). */
export const useEnLinea = () => useSyncExternalStore(suscribir, () => navigator.onLine);
