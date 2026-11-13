import { hoyISO } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe } from '../avisos/duenos';
import { asignadaA } from '../clientes/clientes.repository';

/** Quién debe enterarse de algo de un guardia: el supervisor de su sitio de hoy y su admin dueño (A-86). */
export type ResponsablesDeGuardia = (guardiaId: number) => Promise<number[]>;

export const sinResponsables: ResponsablesDeGuardia = async () => [];

export const responsablesDeGuardiaConPrisma: ResponsablesDeGuardia = async (guardiaId) => {
  try {
    const db = getPrisma();
    const ids = new Set<number>();
    const a = await db.sitioGuardia.findFirst({
      where: { ...asignadaA(guardiaId, hoyISO()), sitio: { deletedAt: null } },
      orderBy: { desde: 'desc' },
      select: { sitio: { select: { id: true, supervisorId: true } } },
    });
    if (a?.sitio.supervisorId) ids.add(a.sitio.supervisorId);
    for (const admin of await adminsDe({ guardiaId, sitioId: a?.sitio.id ?? null })) ids.add(admin);
    // Sin supervisor ni dueño, que no se pierda: les llega a los super admin.
    if (ids.size === 0) {
      const supers = await db.usuario.findMany({ where: { esSuperAdmin: true, activo: true, deletedAt: null }, select: { id: true } });
      for (const u of supers) ids.add(u.id);
    }
    return [...ids];
  } catch (err) {
    console.error('[auth] No se pudo saber a quién avisar del bloqueo', err);
    return [];
  }
};
