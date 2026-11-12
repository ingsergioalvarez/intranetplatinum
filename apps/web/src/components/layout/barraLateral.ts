import { create } from 'zustand';

/**
 * Estado de la barra lateral de escritorio: abierta o reducida a iconos. Se recuerda en este equipo. Sin elección
 * guardada, arranca abierta desde 1280 px de ancho y reducida en pantallas menores (laptops chicas).
 */
const CLAVE = 'ui.barra.reducida';
const ANCHO_MINIMO_ABIERTA = 1280;

function inicial(): boolean {
  try {
    const guardada = localStorage.getItem(CLAVE);
    if (guardada === '1' || guardada === '0') return guardada === '1';
  } catch {
    // Sin almacenamiento: se decide por el ancho de la pantalla.
  }
  return typeof window !== 'undefined' && window.innerWidth < ANCHO_MINIMO_ABIERTA;
}

interface BarraState {
  reducida: boolean;
  alternar: () => void;
}

export const useBarraLateral = create<BarraState>((set, get) => ({
  reducida: inicial(),
  alternar: () => {
    const reducida = !get().reducida;
    set({ reducida });
    try {
      localStorage.setItem(CLAVE, reducida ? '1' : '0');
    } catch {
      // No se pudo recordar: vale solo para esta sesión.
    }
  },
}));
