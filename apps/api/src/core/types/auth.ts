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
  /** Empresa a la que pertenece (C-08). Todo lo que haga se limita a ella. */
  empresaId?: number | null;
  /**
   * La empresa tiene apagado el módulo Carteras (C-10): el alcance sale de las áreas y no de los dueños. Lo calcula
   * `authenticate` en cada petición; sin él (pruebas, tareas) rige la cartera de siempre.
   */
  sinCarteras?: boolean;
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}
