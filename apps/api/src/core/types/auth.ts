import type { Rol } from '@platinum/shared';

export interface AuthUser {
  id: number;
  email: string;
  rol: Rol;
  permisos: string[];
  /** Contraseña temporal pendiente de cambiar (D-012). */
  debeCambiarPassword?: boolean;
  clienteId?: number | null;
  clienteNombre?: string | null;
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
