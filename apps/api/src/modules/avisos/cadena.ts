import { PERMISOS, ROLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** De quién trata el aviso. Hoy solo importa la persona; el sitio queda por si se vuelve a necesitar. */
export interface ContextoAviso {
  guardiaId?: number | null;
  sitioId?: number | null;
}

const activo = { activo: true, deletedAt: null } as const;

/**
 * Cadena de mando de una persona (DC-017): los jefes que hay por encima de ella en el árbol de áreas, del más
 * cercano al más lejano. El primero es el jefe de su área o, si el área no tiene jefe, el del área de arriba. Un jefe
 * no es parte de su propia cadena (empieza en el área de arriba). Los jefes dados de baja se saltan.
 */
export async function cadenaDe(personaId: number): Promise<number[]> {
  const db = getPrisma();
  const [areas, persona] = await Promise.all([
    db.area.findMany({
      where: { deletedAt: null },
      select: { id: true, padreId: true, jefe: { select: { id: true, activo: true, deletedAt: true } } },
    }),
    db.usuario.findUnique({ where: { id: personaId }, select: { areaId: true } }),
  ]);
  const porId = new Map(areas.map((a) => [a.id, a]));
  const cadena: number[] = [];
  const vistas = new Set<number>();
  let actual = persona?.areaId != null ? porId.get(persona.areaId) : undefined;
  while (actual && !vistas.has(actual.id)) {
    vistas.add(actual.id);
    const jefe = actual.jefe;
    if (jefe && jefe.activo && !jefe.deletedAt && jefe.id !== personaId && !cadena.includes(jefe.id)) cadena.push(jefe.id);
    actual = actual.padreId != null ? porId.get(actual.padreId) : undefined;
  }
  return cadena;
}

/**
 * RH: las personas a las que se les dio el permiso "Recibe las emergencias de la empresa" (se da por persona; la
 * pantalla para darlo llega con C-11). Solo activas.
 */
export async function rhDeLaEmpresa(): Promise<number[]> {
  const rows = await getPrisma().usuario.findMany({
    where: { ...activo, permisosPropios: { some: { permiso: { clave: PERMISOS.EMERGENCIAS_RECIBIR } } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Admins activos de la empresa: último recurso cuando no hay a quién más avisar. */
export async function adminsActivos(): Promise<number[]> {
  const rows = await getPrisma().usuario.findMany({
    where: { ...activo, rol: { clave: ROLES.ADMIN } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * A quién le toca enterarse de algo de una persona (ausencia, retardo, falta, cambio de turno, horas extra,
 * solicitud de cobertura): su jefe más cercano. Si no hay nadie arriba, RH; si tampoco hay RH, los admin (DC-017).
 * Sin persona (no hay de quién colgar el aviso), los admin.
 */
export async function responsablesDe(contexto?: ContextoAviso): Promise<number[]> {
  const personaId = contexto?.guardiaId;
  if (personaId) {
    const [jefe] = await cadenaDe(personaId);
    if (jefe) return [jefe];
    const rh = (await rhDeLaEmpresa()).filter((id) => id !== personaId);
    if (rh.length) return rh;
  }
  return (await adminsActivos()).filter((id) => id !== personaId);
}
