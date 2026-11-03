import { ROLES } from '@platinum/shared';
import { HttpError, esSuperAdmin, fechaADate, hoyISO, type AuthUser } from '../../core';
import { getPrisma } from '../../core/data/prisma';

/**
 * Lo que un supervisor puede ver (DA-45): sus sitios y los guardias asignados a ellos (directo o
 * por grupo) en el último mes, para que pueda revisar lo reciente aunque ya los hayan movido.
 * Un admin que no es super admin ve los sitios de sus clientes y sus guardias (A-66), más quienes están asignados
 * a esos sitios. `null` = sin límite (super admin y otros roles).
 */
export interface Alcance {
  sitioIds: Set<number>;
  guardiaIds: Set<number>;
}

export type AlcanceFn = (user: AuthUser) => Promise<Alcance | null>;

/** Días hacia atrás en que un guardia sigue siendo "de" un sitio después de que lo quitan. */
const DIAS_RECIENTES = 31;

export const alcanceConPrisma: AlcanceFn = async (user) => {
  const esAdminDeCartera = user.rol === ROLES.ADMIN && !esSuperAdmin(user);
  if (user.rol !== ROLES.SUPERVISOR && user.rol !== ROLES.CLIENTE && !esAdminDeCartera) return null;
  const db = getPrisma();
  let sitios: { id: number }[] = [];
  /** Guardias que son suyos aunque aún no tengan sitio (A-66). */
  const propios: number[] = [];
  if (esAdminDeCartera) {
    sitios = await db.sitio.findMany({ where: { cliente: { propietarioId: user.id } }, select: { id: true } });
    const guardias = await db.usuario.findMany({
      where: { propietarioId: user.id, rol: { clave: ROLES.GUARDIA } },
      select: { id: true },
    });
    propios.push(...guardias.map((g) => g.id));
  } else if (user.rol === ROLES.SUPERVISOR) {
    sitios = await db.sitio.findMany({ where: { supervisorId: user.id }, select: { id: true } });
  } else if (user.rol === ROLES.CLIENTE) {
    if (!user.clienteId) return { sitioIds: new Set(), guardiaIds: new Set() };
    sitios = await db.sitio.findMany({ where: { clienteId: user.clienteId }, select: { id: true } });
  }
  const sitioIds = sitios.map((s) => s.id);
  if (sitioIds.length === 0) return { sitioIds: new Set(), guardiaIds: new Set(propios) };
  const hoy = fechaADate(hoyISO());
  const desde = new Date(hoy.getTime() - DIAS_RECIENTES * 86_400_000);
  const asignaciones = await db.sitioGuardia.findMany({
    where: {
      sitioId: { in: sitioIds },
      desde: { lte: hoy },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }],
    },
    select: { usuarioId: true, grupo: { select: { integrantes: { select: { usuarioId: true } } } } },
  });
  const guardiaIds = new Set<number>(propios);
  for (const a of asignaciones) {
    if (a.usuarioId) guardiaIds.add(a.usuarioId);
    a.grupo?.integrantes.forEach((i) => guardiaIds.add(i.usuarioId));
  }
  // Quien cubre uno de sus sitios (DA-39) también es "suyo" mientras tanto.
  const coberturas = await db.cobertura.findMany({
    where: { sitioId: { in: sitioIds }, canceladaEn: null, hasta: { gte: desde } },
    select: { usuarioId: true },
  });
  coberturas.forEach((c) => guardiaIds.add(c.usuarioId));
  return { sitioIds: new Set(sitioIds), guardiaIds };
};

/** Para pruebas y módulos sin límite: todos ven todo. */
export const sinAlcance: AlcanceFn = async () => null;

export const guardiaEnAlcance = (alcance: Alcance | null, guardiaId: number) =>
  !alcance || alcance.guardiaIds.has(guardiaId);

/** El guardia no es de sus sitios: se responde como si no existiera. */
export function exigirGuardia(alcance: Alcance | null, guardiaId: number) {
  if (!guardiaEnAlcance(alcance, guardiaId)) throw HttpError.notFound('Guardia no encontrado');
}
