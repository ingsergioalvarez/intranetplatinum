import { create } from 'zustand';

const CLAVE = 'empresa-elegida';

function leer(): number | null {
  try {
    const n = Number(sessionStorage.getItem(CLAVE));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

interface EmpresaState {
  /** Empresa a la que el super admin eligió entrar; null = la suya. Solo dura mientras la pestaña esté abierta. */
  empresaElegidaId: number | null;
  elegir: (id: number | null) => void;
}

export const useEmpresaStore = create<EmpresaState>((set) => ({
  empresaElegidaId: leer(),
  elegir: (id) => {
    try {
      if (id) sessionStorage.setItem(CLAVE, String(id));
      else sessionStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento: la elección vale solo en memoria */
    }
    set({ empresaElegidaId: id });
  },
}));
