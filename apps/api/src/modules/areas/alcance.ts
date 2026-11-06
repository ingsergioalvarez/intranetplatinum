import { PERMISOS, ROLES } from '@platinum/shared';
import { alcanceDe, esSuperAdmin, type AuthUser } from '../../core';
import { getPrisma } from '../../core/data/prisma';

/**
 * A quién puede ver una persona según el alcance de su rol (C-11 parte 4): ids de usuarios, o `null` = a todos.
 * - Super admin, admin de la empresa, un rol con alcance "toda la empresa" y quien tenga el permiso "ver a toda la
 *   empresa": a todos.
 * - "Su área y sus subáreas": las personas de su área, de las que encabeza o supervisa, y de todas sus subáreas.
 * - "Solo su área": las personas de su área y de las que encabeza o supervisa (sin subáreas).
 * - "Solo ella o él": solo a sí misma.
 * - Siempre se ve a sí misma.
 */
export type PersonasVisibles = (user: AuthUser) => Promise<Set<number> | null>;

/** Para pruebas y módulos sin límite: todos ven a todos. */
export const todasLasPersonas: PersonasVisibles = async () => null;

export const personasVisiblesConPrisma: PersonasVisibles = async (user) => {
  const alcance = alcanceDe(user);
  if (esSuperAdmin(user) || user.rol === ROLES.ADMIN || alcance === 'empresa' || user.permisos.includes(PERMISOS.ALCANCE_EMPRESA)) return null;
  const personas = new Set<number>([user.id]);
  if (alcance === 'propio') return personas;

  const db = getPrisma();
  const [areas, yo, supervisadas] = await Promise.all([
    db.area.findMany({ where: { deletedAt: null }, select: { id: true, padreId: true, jefeId: true } }),
    db.usuario.findUnique({ where: { id: user.id }, select: { areaId: true } }),
    db.areaSupervisor.findMany({ where: { usuarioId: user.id }, select: { areaId: true } }),
  ]);

  // Sus áreas: la suya, las que encabeza y las que supervisa.
  const base = new Set<number>();
  if (yo?.areaId != null) base.add(yo.areaId);
  for (const a of areas) if (a.jefeId === user.id) base.add(a.id);
  for (const s of supervisadas) base.add(s.areaId);

  const visibles = new Set<number>();
  const pendientes = [...base];
  while (pendientes.length) {
    const id = pendientes.pop()!;
    if (visibles.has(id)) continue;
    visibles.add(id);
    if (alcance === 'area_subareas') for (const hija of areas) if (hija.padreId === id) pendientes.push(hija.id);
  }
  if (visibles.size > 0) {
    const usuarios = await db.usuario.findMany({ where: { areaId: { in: [...visibles] }, deletedAt: null }, select: { id: true } });
    usuarios.forEach((u) => personas.add(u.id));
  }
  return personas;
};
