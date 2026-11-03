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
  /** Super admin (A-65). */
  esSuperAdmin?: boolean;
  /** Admin dueño de este usuario (A-65); para un supervisor, el admin cuya cartera ve. */
  propietarioId?: number | null;
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
