import type { AuthSession, CambiarPasswordInput, LoginInput } from '@platinum/shared';
import { ApiError, api, queryClient, type ApiClient } from '../api';
import { useAuthStore } from './authStore';
import { useOfertaPerfil } from './ofertaPerfil';
import {
  actualizarPerfil,
  guardarPerfil as guardarTarjeta,
  perfilPorCorreo,
  reiniciarAvisoPin,
  type PerfilRapido,
} from './perfiles';

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
    // Si este celular ya tiene perfil rápido de ese correo, manda su clave para reutilizarlo (A-40).
    const previo = perfilPorCorreo(input.email);
    const sesion = await this.http.post<AuthSession>(
      '/auth/login',
      { ...input, ...(previo && { dispositivoToken: previo.token }) },
      { skipAuthRefresh: true },
    );
    this.recordarPerfil(sesion, previo);
    this.aplicar(sesion);
    // Admin, supervisor y cliente deciden si guardan su perfil en este celular (A-40).
    if (sesion.ofrecerPerfil) useOfertaPerfil.getState().ofrecer();
    return sesion.user;
  }

  /** Guarda este celular para el usuario en sesión (la respuesta a "¿Guardar tu perfil en este celular?"). */
  async guardarPerfilEnEsteCelular() {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const d = await this.http.post<NonNullable<AuthSession['dispositivo']>>('/auth/dispositivos');
    if (!d.token) return;
    guardarTarjeta({
      usuarioId: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      dispositivoId: d.id,
      token: d.token,
      tienePin: false,
      bloqueado: false,
    });
  }

  /** Entra con la tarjeta de un perfil guardado en este celular y su PIN (A-40). */
  async loginConPin(perfil: PerfilRapido, pin: string) {
    const sesion = await this.http.post<AuthSession>(
      '/auth/perfil-rapido',
      { token: perfil.token, pin },
      { skipAuthRefresh: true },
    );
    actualizarPerfil(perfil.usuarioId, { tienePin: true, bloqueado: false, nombre: sesion.user.nombre, rol: sesion.user.rol });
    this.aplicar(sesion);
    return sesion.user;
  }

  /** El celular recuerda al guardia sin preguntar: guarda su tarjeta con el estado que dice el servidor. */
  private recordarPerfil(sesion: AuthSession, previo: PerfilRapido | undefined) {
    const d = sesion.dispositivo;
    const token = d?.token ?? previo?.token;
    if (!d || !token) return;
    guardarTarjeta({
      usuarioId: sesion.user.id,
      nombre: sesion.user.nombre,
      email: sesion.user.email,
      rol: sesion.user.rol,
      dispositivoId: d.id,
      token,
      tienePin: d.tienePin,
      bloqueado: false,
    });
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
    reiniciarAvisoPin();
    useAuthStore.getState().logout();
    queryClient.clear();
  }

  private aplicar({ user, accessToken }: AuthSession) {
    guardarPerfil(user);
    useAuthStore.getState().setSession(user, accessToken);
  }
}

export const authService = new AuthService(api);
