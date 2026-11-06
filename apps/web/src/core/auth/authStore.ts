import { create } from 'zustand';
import type { Permiso, Rol, SessionUser } from '@platinum/shared';

export type { SessionUser };

interface AuthState {
  user: SessionUser | null;
  /** El access token vive solo en memoria; el refresh token va en cookie httpOnly. */
  accessToken: string | null;
  /** true mientras se intenta restaurar la sesión al abrir la app. */
  restoring: boolean;
  /** true tras un cierre de sesión voluntario: el login no regresa a la ruta anterior. */
  loggedOut: boolean;
  setSession: (user: SessionUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setRestoring: (value: boolean) => void;
  /** Sesión expirada o inválida: conserva la ruta para volver tras iniciar sesión. */
  clear: () => void;
  /** Cierre de sesión voluntario. */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  restoring: false,
  loggedOut: false,
  setSession: (user, accessToken) => set({ user, accessToken, loggedOut: false }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setRestoring: (restoring) => set({ restoring }),
  clear: () => set({ user: null, accessToken: null }),
  logout: () => set({ user: null, accessToken: null, loggedOut: true }),
}));

export function hasPermission(user: SessionUser | null, permiso?: Permiso) {
  if (!user) return false;
  if (!permiso || user.rol === 'admin') return true;
  return user.permisos.includes(permiso);
}

/**
 * ¿Es alguien cuyo día a día es marcar su asistencia, sin revisar la de otros? Es lo que antes se decidía por el rol
 * "guardia": ahora se decide por lo que puede hacer (marcar y no ver la asistencia de los demás), así que sirve igual
 * para un rol nuevo. El admin nunca lo es.
 */
export function esColaborador(user: SessionUser | null) {
  if (!user || user.rol === 'admin') return false;
  return user.permisos.includes('asistencia.marcar') && !user.permisos.includes('asistencia.ver');
}

export function hasRole(user: SessionUser | null, roles?: Rol[]) {
  if (!user) return false;
  return !roles?.length || roles.includes(user.rol);
}
