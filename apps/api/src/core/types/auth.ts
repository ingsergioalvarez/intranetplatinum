import type { Rol } from '@platinum/shared';

export interface AuthUser {
  id: number;
  email: string;
  rol: Rol;
  permisos: string[];
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
