import { create } from 'zustand';

/**
 * Tip que la notificación quiso mostrar (A-78): llega en el enlace `/?tip=<id>`. Se lee al arrancar, antes de que la
 * ruta pueda redirigir al login y perder el parámetro, y se quita de la barra de direcciones.
 */
interface TipState {
  id: string | null;
  cerrar: () => void;
}

export const useTipStore = create<TipState>((set) => ({ id: null, cerrar: () => set({ id: null }) }));

export function leerTipDelEnlace() {
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('tip');
    if (!id) return;
    useTipStore.setState({ id });
    url.searchParams.delete('tip');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // Sin enlace válido: no hay tip que mostrar.
  }
}
