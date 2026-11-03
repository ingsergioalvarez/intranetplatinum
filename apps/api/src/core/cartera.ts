import { ROLES } from '@platinum/shared';
import type { AuthUser } from './types/auth';

/**
 * Carteras de los admin (A-65). Cada admin ve y administra lo que él creó (sus usuarios, clientes, sitios y
 * grupos) y lo que cuelga de ello; el super admin ve todo. Lo que no tiene dueño ("sin asignar") solo lo ve el
 * super admin. Un supervisor ve la cartera de su admin.
 */
export const esSuperAdmin = (u: Pick<AuthUser, 'esSuperAdmin'>) => u.esSuperAdmin === true;

/** Cartera que no coincide con ningún dueño: el supervisor sin admin asignado no ve nada de ella. */
export const SIN_CARTERA = 0;

/**
 * Admin dueño por el que se filtra lo que ve este usuario: el propio admin, o el admin del supervisor.
 * `undefined` = sin límite de dueño: el super admin y los roles con sus propios límites por sitio (guardia, cliente).
 */
export function carteraDe(u: Pick<AuthUser, 'id' | 'rol' | 'esSuperAdmin' | 'propietarioId'>): number | undefined {
  if (esSuperAdmin(u)) return undefined;
  if (u.rol === ROLES.ADMIN) return u.id;
  if (u.rol === ROLES.SUPERVISOR) return u.propietarioId ?? SIN_CARTERA;
  return undefined;
}

/** Dueño que se anota en lo que crea este usuario: él mismo (admin) o el admin de su supervisor. */
export function propietarioParaCrear(u: Pick<AuthUser, 'id' | 'rol' | 'esSuperAdmin' | 'propietarioId'>): number | null {
  if (u.rol === ROLES.SUPERVISOR) return u.propietarioId ?? null;
  return u.id;
}

/** ¿Algo con este dueño está dentro de lo que ve el usuario? (`undefined` = sin límite) */
export function enCartera(u: Pick<AuthUser, 'id' | 'rol' | 'esSuperAdmin' | 'propietarioId'>, propietarioId: number | null) {
  const cartera = carteraDe(u);
  return cartera === undefined || propietarioId === cartera;
}
