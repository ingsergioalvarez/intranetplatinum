import { ALCANCE_POR_ROL, PERMISOS_POR_ROL, ROLES, ROL_DESCRIPCIONES, type Rol } from '@platinum/shared';
import type { PrismaClient } from '../../generated/prisma/client';

/**
 * Crea los roles de partida de una empresa (admin, jefe, supervisor y colaborador) con sus permisos de partida
 * (C-11, DC-019). Los permisos que todavía no existan en la base (el seed los crea) se omiten. Solo agrega lo que falta:
 * un rol que ya existe no se toca, para no pisar lo que el admin haya editado. Usar con el cliente sin filtro de
 * empresa (seed, plataforma). Devuelve clave → id del rol.
 */
export async function crearRolesBase(
  db: Pick<PrismaClient, 'rol' | 'permiso' | 'rolPermiso'>,
  empresaId: number,
): Promise<Record<Rol, number>> {
  const permisoId = new Map((await db.permiso.findMany({ select: { id: true, clave: true } })).map((p) => [p.clave, p.id]));
  const ids = {} as Record<Rol, number>;
  for (const clave of Object.values(ROLES) as Rol[]) {
    const existente = await db.rol.findFirst({ where: { empresaId, clave }, select: { id: true } });
    if (existente) {
      ids[clave] = existente.id;
      continue;
    }
    const rol = await db.rol.create({ data: { empresaId, clave, nombre: ROL_DESCRIPCIONES[clave], esBase: true, alcance: ALCANCE_POR_ROL[clave] }, select: { id: true } });
    ids[clave] = rol.id;
    const permisos = PERMISOS_POR_ROL[clave].map((p) => permisoId.get(p)).filter((id): id is number => id !== undefined);
    if (permisos.length) await db.rolPermiso.createMany({ data: permisos.map((permisoId) => ({ rolId: rol.id, permisoId })) });
  }
  return ids;
}

/**
 * Lo que hace el seed por cada empresa: crea los roles de partida que falten y otorga los permisos NUEVOS del catálogo
 * (los que acaban de crearse en la base) a los roles de partida que los llevan por defecto. El admin conserva siempre
 * todos los permisos. Nunca quita ni vuelve a dar un permiso que ya existía: lo que el admin editó se respeta.
 */
export async function sembrarRolesDeEmpresa(
  db: Pick<PrismaClient, 'rol' | 'permiso' | 'rolPermiso'>,
  empresaId: number,
  nuevos: string[],
): Promise<Record<Rol, number>> {
  const ids = await crearRolesBase(db, empresaId);
  const permisos = await db.permiso.findMany({ select: { id: true, clave: true } });
  const permisoId = new Map(permisos.map((p) => [p.clave, p.id]));
  for (const clave of Object.values(ROLES) as Rol[]) {
    const otorgar =
      clave === ROLES.ADMIN ? permisos.map((p) => p.clave) : nuevos.filter((p) => (PERMISOS_POR_ROL[clave] as string[]).includes(p));
    if (otorgar.length === 0) continue;
    await db.rolPermiso.createMany({
      data: otorgar.map((p) => ({ rolId: ids[clave], permisoId: permisoId.get(p)! })),
      skipDuplicates: true,
    });
  }
  return ids;
}
