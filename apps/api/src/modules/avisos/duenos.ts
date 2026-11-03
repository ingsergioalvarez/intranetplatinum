import { ROLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** De qué cosa hay que saber quién es el admin dueño (A-65). */
export interface ContextoDueno {
  guardiaId?: number | null;
  sitioId?: number | null;
}

/**
 * Admins a los que les toca enterarse de algo de este guardia o sitio (A-65): el dueño del guardia y el dueño del
 * cliente del sitio. Solo activos. Si lo que importa no tiene dueño (sin asignar) no hay a quién avisar: el aviso
 * queda pendiente en la pantalla y llega al admin que lo reciba cuando se asigne. Sin contexto, todos los admin.
 */
export async function adminsDe(contexto?: ContextoDueno): Promise<number[]> {
  const db = getPrisma();
  const activos = { activo: true, deletedAt: null, rol: { clave: ROLES.ADMIN } };
  if (!contexto) return (await db.usuario.findMany({ where: activos, select: { id: true } })).map((u) => u.id);

  const duenos = new Set<number>();
  if (contexto.guardiaId) {
    const g = await db.usuario.findUnique({ where: { id: contexto.guardiaId }, select: { propietarioId: true } });
    if (g?.propietarioId) duenos.add(g.propietarioId);
  }
  if (contexto.sitioId) {
    const s = await db.sitio.findUnique({
      where: { id: contexto.sitioId },
      select: { cliente: { select: { propietarioId: true } } },
    });
    if (s?.cliente.propietarioId) duenos.add(s.cliente.propietarioId);
  }
  if (duenos.size === 0) return [];
  const admins = await db.usuario.findMany({ where: { ...activos, id: { in: [...duenos] } }, select: { id: true } });
  return admins.map((a) => a.id);
}
