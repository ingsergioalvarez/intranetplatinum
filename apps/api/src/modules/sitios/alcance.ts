import { ROLES } from '@platinum/shared';
import { HttpError, type AuthUser } from '../../core';
import { personasVisiblesConPrisma } from '../areas/alcance';

/**
 * Lo que cada quien puede ver (C-10): admin y super admin, todo; jefe y supervisor, las personas de su área
 * (el jefe también las de sus subáreas). `null` = sin límite.
 */
export interface Alcance {
  sitioIds: Set<number>;
  guardiaIds: Set<number>;
  /** El alcance sale de las áreas (C-10): se decide por la persona y no por el sitio. */
  porPersonas?: boolean;
}

export type AlcanceFn = (user: AuthUser) => Promise<Alcance | null>;

export const alcanceConPrisma: AlcanceFn = async (user) => {
  // Admin ve toda la empresa, el jefe su área y subáreas, el supervisor su área (C-10).
  if (user.rol === ROLES.ADMIN || user.rol === ROLES.JEFE || user.rol === ROLES.SUPERVISOR) {
    const personas = await personasVisiblesConPrisma(user);
    return personas ? { sitioIds: new Set(), guardiaIds: personas, porPersonas: true } : null;
  }
  return null;
};

/** Para pruebas y módulos sin límite: todos ven todo. */
export const sinAlcance: AlcanceFn = async () => null;

/** ¿Esta fila (de un sitio y de una persona) está dentro del alcance? Con alcance por áreas decide la persona. */
export const filaEnAlcance = (alcance: Alcance | null, sitioId: number | null | undefined, guardiaId: number) =>
  !alcance ||
  (alcance.porPersonas || sitioId == null ? alcance.guardiaIds.has(guardiaId) : alcance.sitioIds.has(sitioId));

export const guardiaEnAlcance = (alcance: Alcance | null, guardiaId: number) =>
  !alcance || alcance.guardiaIds.has(guardiaId);

/** El guardia no es de sus sitios: se responde como si no existiera. */
export function exigirGuardia(alcance: Alcance | null, guardiaId: number) {
  if (!guardiaEnAlcance(alcance, guardiaId)) throw HttpError.notFound('Guardia no encontrado');
}
