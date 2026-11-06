import type { AlcanceRol, Rol } from '@platinum/shared';

export interface AuthUser {
  id: number;
  email: string;
  rol: Rol;
  permisos: string[];
  /** Hasta dónde llega su rol (C-11 parte 4). Sin él (pruebas, tokens viejos) rige el alcance de partida de su rol. */
  alcance?: AlcanceRol;
  /** Contraseña temporal pendiente de cambiar (D-012). */
  debeCambiarPassword?: boolean;
  /** Super admin (A-65). */
  esSuperAdmin?: boolean;
  /** Empresa a la que pertenece (C-08). Todo lo que haga se limita a ella. */
  empresaId?: number | null;
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
