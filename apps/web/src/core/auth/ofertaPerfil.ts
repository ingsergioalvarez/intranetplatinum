import { create } from 'zustand';

/**
 * Tras entrar con contraseña, admin, supervisor y cliente deciden si guardan su perfil en este celular
 * (A-40). El servidor lo indica con `ofrecerPerfil`; la pregunta se muestra ya dentro de la app.
 */
export const useOfertaPerfil = create<{ pendiente: boolean; ofrecer: () => void; cerrar: () => void }>((set) => ({
  pendiente: false,
  ofrecer: () => set({ pendiente: true }),
  cerrar: () => set({ pendiente: false }),
}));
