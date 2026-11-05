import { PERMISOS, ROLES } from '@platinum/shared';
import { esSuperAdmin, type AuthUser } from '../../core';
import { getPrisma } from '../../core/data/prisma';

/**
 * A quién puede ver una persona según las áreas (C-10, DC-016): ids de usuarios, o `null` = a todos.
 * - Super admin, admin de la empresa y quien tenga el permiso "ver a toda la empresa": a todos.
 * - Jefe: las personas de las áreas que encabeza y de todas sus subáreas.
 * - Supervisor: las personas de su propia área (sin subáreas).
 * - Siempre se ve a sí misma.
 */
export type PersonasVisibles = (user: AuthUser) => Promise<Set<number> | null>;

/** Para pruebas y módulos sin límite: todos ven a todos. */
export const todasLasPersonas: PersonasVisibles = async () => null;

export const personasVisiblesConPrisma: PersonasVisibles = async (user) => {
  if (esSuperAdmin(user) || user.rol === ROLES.ADMIN || user.permisos.includes(PERMISOS.ALCANCE_EMPRESA)) return null;

  const db = getPrisma();
  const [areas, yo] = await Promise.all([
    db.area.findMany({ where: { deletedAt: null }, select: { id: true, padreId: true, jefeId: true } }),
    db.usuario.findUnique({ where: { id: user.id }, select: { areaId: true } }),
  ]);

  const visibles = new Set<number>();
  const pendientes = areas.filter((a) => a.jefeId === user.id).map((a) => a.id);
  while (pendientes.length) {
    const id = pendientes.pop()!;
    if (visibles.has(id)) continue;
    visibles.add(id);
    for (const hija of areas) if (hija.padreId === id) pendientes.push(hija.id);
  }
  // Un supervisor ve su propia área; el jefe ya ve la suya (y sus subáreas) arriba.
  if (user.rol === ROLES.SUPERVISOR && yo?.areaId != null) visibles.add(yo.areaId);

  const personas = new Set<number>([user.id]);
  if (visibles.size > 0) {
    const usuarios = await db.usuario.findMany({ where: { areaId: { in: [...visibles] }, deletedAt: null }, select: { id: true } });
    usuarios.forEach((u) => personas.add(u.id));
  }
  return personas;
};
