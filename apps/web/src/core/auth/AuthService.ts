import type { AuthSession, CambiarPasswordInput, LoginInput } from '@platinum/shared';
import { api, queryClient, type ApiClient } from '../api';
import { useAuthStore } from './authStore';

/**
 * Sesión del lado del cliente. El access token vive en memoria (store) y el refresh token
 * en una cookie httpOnly que solo el backend lee (`/api/auth/*`).
 */
export class AuthService {
  private refreshing: Promise<boolean> | null = null;

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
      .catch(() => false)
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
      if (!(await this.refresh())) store.clear();
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
    useAuthStore.getState().logout();
    queryClient.clear();
  }

  private aplicar({ user, accessToken }: AuthSession) {
    useAuthStore.getState().setSession(user, accessToken);
  }
}

export const authService = new AuthService(api);
