import type { AuthSession, CambiarPasswordInput, LoginInput } from '@platinum/shared';
import { ApiError, api, queryClient, type ApiClient } from '../api';
import { useAuthStore } from './authStore';

const PERFIL = 'offline.perfil';

/** Perfil del guardia para abrir el Checador sin señal (AS2-01); las checadas se envían al volver la red. */
const guardarPerfil = (user: AuthSession['user']) => {
  try {
    if (user.rol === 'guardia') localStorage.setItem(PERFIL, JSON.stringify(user));
    else localStorage.removeItem(PERFIL);
  } catch {
    // Sin almacenamiento: sin modo sin señal.
  }
};
const leerPerfil = (): AuthSession['user'] | null => {
  try {
    return JSON.parse(localStorage.getItem(PERFIL) ?? 'null');
  } catch {
    return null;
  }
};

/**
 * Sesión del lado del cliente. El access token vive en memoria (store) y el refresh token
 * en una cookie httpOnly que solo el backend lee (`/api/auth/*`).
 */
export class AuthService {
  private refreshing: Promise<boolean> | null = null;
  /** El último intento de renovar falló por falta de red (no porque la sesión expiró). */
  private sinRed = false;

  constructor(private readonly http: ApiClient) {
    http.setRefreshSession(() => this.refresh());
  }

  async login(input: LoginInput) {
    const sesion = await this.http.post<AuthSession>('/auth/login', input, { skipAuthRefresh: true });
    this.aplicar(sesion);
    return sesion.user;
  }

  /** Cambia la contraseña propia; el servidor cierra las demás sesiones y entrega una nueva. */
  async cambiarPassword(input: CambiarPasswordInput) {
    const sesion = await this.http.post<AuthSession>('/auth/cambiar-password', input);
    this.aplicar(sesion);
    return sesion.user;
  }

  /** Renueva el access token con la cookie. Llamadas simultáneas comparten una sola petición. */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.http
      .post<AuthSession>('/auth/refresh', undefined, { skipAuthRefresh: true })
      .then((sesion) => {
        this.aplicar(sesion);
        return true;
      })
      .catch((e) => {
        this.sinRed = e instanceof ApiError && e.code === 'NETWORK_ERROR';
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  /** Al abrir la app: recupera la sesión si la cookie sigue vigente. */
  async restore() {
    const store = useAuthStore.getState();
    store.setRestoring(true);
    try {
      if (!(await this.refresh())) {
        // Sin señal al abrir: el guardia entra con su perfil guardado para poder checar; la sesión real
        // se renueva sola cuando vuelva la red (las checadas pendientes se envían entonces).
        const perfil = this.sinRed ? leerPerfil() : null;
        if (perfil) store.setSession(perfil, '');
        else store.clear();
      }
    } finally {
      store.setRestoring(false);
    }
  }

  /** Cierre voluntario: revoca la sesión en el servidor aunque falle la red, y limpia el cliente. */
  async logout() {
    try {
      await this.http.post('/auth/logout', undefined, { skipAuthRefresh: true });
    } catch {
      // Sin red: la cookie expira sola; la sesión local se cierra igual.
    }
    try {
      localStorage.removeItem(PERFIL);
    } catch {
      // Nada que limpiar.
    }
    useAuthStore.getState().logout();
    queryClient.clear();
  }

  private aplicar({ user, accessToken }: AuthSession) {
    guardarPerfil(user);
    useAuthStore.getState().setSession(user, accessToken);
  }
}

export const authService = new AuthService(api);
