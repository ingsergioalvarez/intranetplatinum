import { ROLES } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';

/** Lo que hay en la cartera de un admin (o sin asignar), sin armar todavía. */
export interface DatosCartera {
  propietario: { id: number; nombre: string; activo: boolean } | null;
  /** Usuarios que no son admin. */
  usuarios: { id: number; nombre: string; rol: string; activo: boolean; clienteId: number | null }[];
  clientes: { id: number; nombre: string }[];
  grupos: { id: number; nombre: string; integrantes: number }[];
  /** Sitios de esos clientes. */
  sitios: { id: number; nombre: string; clienteId: number; supervisorId: number | null }[];
  /** Guardias asignados hoy a esos sitios (directo o por grupo). */
  asignaciones: { sitioId: number; guardiaId: number }[];
}

export interface AdminCartera {
  id: number;
  nombre: string;
  activo: boolean;
  esSuperAdmin: boolean;
}

export interface MovimientoCartera {
  usuarioIds: number[];
  clienteIds: number[];
  grupoIds: number[];
  destinoId: number | null;
}

/** Acceso a datos de las carteras (A-65). */
export abstract class CarterasRepository {
  /** Admins (activos o de baja) y cuánto tiene cada uno. */
  abstract resumen(): Promise<{
    admins: (AdminCartera & { usuarios: number; clientes: number; grupos: number })[];
    sinAsignar: { usuarios: number; clientes: number; grupos: number };
  }>;
  abstract cartera(propietarioId: number | null, hoy: string): Promise<DatosCartera | null>;
  /** Admin por id (null si no existe o no es admin). */
  abstract admin(id: number): Promise<AdminCartera | null>;
  /** Pasa todo en un solo paso: se hace completo o no se hace. */
  abstract mover(m: MovimientoCartera): Promise<void>;
  /**
   * Avisos que seguían sin atender de esos guardias y sitios pasan del admin anterior (o de los admin de baja,
   * si venían sin asignar) al nuevo. Devuelve cuántos.
   */
  abstract moverAvisosPendientes(d: {
    desde: number | null;
    hacia: number;
    guardiaIds: number[];
    sitioIds: number[];
  }): Promise<number>;
}

const noAdmin = { rol: { clave: { not: ROLES.ADMIN } }, esSuperAdmin: false };

export class PrismaCarterasRepository extends CarterasRepository {
  async resumen() {
    const db = getPrisma();
    const admins = await db.usuario.findMany({
      where: { rol: { clave: ROLES.ADMIN } },
      orderBy: [{ deletedAt: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        activo: true,
        deletedAt: true,
        esSuperAdmin: true,
        _count: { select: { cartera: { where: { ...noAdmin } }, clientesPropios: true, gruposPropios: true } },
      },
    });
    const [usuarios, clientes, grupos] = await Promise.all([
      db.usuario.count({ where: { ...noAdmin, propietarioId: null } }),
      db.cliente.count({ where: { propietarioId: null } }),
      db.grupoGuardias.count({ where: { propietarioId: null } }),
    ]);
    return {
      admins: admins.map(({ _count, deletedAt, activo, ...a }) => ({
        ...a,
        activo: activo && !deletedAt,
        usuarios: _count.cartera,
        clientes: _count.clientesPropios,
        grupos: _count.gruposPropios,
      })),
      sinAsignar: { usuarios, clientes, grupos },
    };
  }

  async cartera(propietarioId: number | null, hoy: string) {
    const db = getPrisma();
    let propietario: DatosCartera['propietario'] = null;
    if (propietarioId !== null) {
      const a = await db.usuario.findFirst({
        where: { id: propietarioId, rol: { clave: ROLES.ADMIN } },
        select: { id: true, nombre: true, activo: true, deletedAt: true },
      });
      if (!a) return null;
      propietario = { id: a.id, nombre: a.nombre, activo: a.activo && !a.deletedAt };
    }
    const donde = { propietarioId };
    const [usuarios, clientes, grupos] = await Promise.all([
      db.usuario.findMany({
        where: { ...noAdmin, ...donde },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, activo: true, deletedAt: true, clienteId: true, rol: { select: { clave: true } } },
      }),
      db.cliente.findMany({ where: donde, orderBy: { nombreComercial: 'asc' }, select: { id: true, nombreComercial: true } }),
      db.grupoGuardias.findMany({
        where: donde,
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, _count: { select: { integrantes: true } } },
      }),
    ]);
    const sitios = await db.sitio.findMany({
      where: { clienteId: { in: clientes.map((c) => c.id) }, deletedAt: null },
      select: { id: true, nombre: true, clienteId: true, supervisorId: true },
    });
    const d = new Date(`${hoy}T00:00:00.000Z`);
    const asigs = await db.sitioGuardia.findMany({
      where: {
        sitioId: { in: sitios.map((s) => s.id) },
        desde: { lte: d },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: d } }],
      },
      select: { sitioId: true, usuarioId: true, grupo: { select: { integrantes: { select: { usuarioId: true } } } } },
    });
    const asignaciones = asigs.flatMap((a) => [
      ...(a.usuarioId ? [{ sitioId: a.sitioId, guardiaId: a.usuarioId }] : []),
      ...(a.grupo?.integrantes ?? []).map((i) => ({ sitioId: a.sitioId, guardiaId: i.usuarioId })),
    ]);
    return {
      propietario,
      usuarios: usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol.clave,
        activo: u.activo && !u.deletedAt,
        clienteId: u.clienteId,
      })),
      clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombreComercial })),
      grupos: grupos.map((g) => ({ id: g.id, nombre: g.nombre, integrantes: g._count.integrantes })),
      sitios,
      asignaciones,
    };
  }

  async admin(id: number) {
    const a = await getPrisma().usuario.findFirst({
      where: { id, rol: { clave: ROLES.ADMIN } },
      select: { id: true, nombre: true, activo: true, deletedAt: true, esSuperAdmin: true },
    });
    return a && { id: a.id, nombre: a.nombre, activo: a.activo && !a.deletedAt, esSuperAdmin: a.esSuperAdmin };
  }

  async mover({ usuarioIds, clienteIds, grupoIds, destinoId }: MovimientoCartera) {
    const db = getPrisma();
    const data = { propietarioId: destinoId };
    await db.$transaction([
      db.usuario.updateMany({ where: { id: { in: usuarioIds }, ...noAdmin }, data }),
      db.cliente.updateMany({ where: { id: { in: clienteIds } }, data }),
      db.grupoGuardias.updateMany({ where: { id: { in: grupoIds } }, data }),
    ]);
  }

  async moverAvisosPendientes({ desde, hacia, guardiaIds, sitioIds }: {
    desde: number | null;
    hacia: number;
    guardiaIds: number[];
    sitioIds: number[];
  }) {
    const db = getPrisma();
    const de = desde !== null ? desde : { in: (await db.usuario.findMany({ where: { rol: { clave: ROLES.ADMIN }, deletedAt: { not: null } }, select: { id: true } })).map((u) => u.id) };
    const candidatos = await db.aviso.findMany({
      where: { usuarioId: de, atendidoEn: null, entidad: { not: null }, entidadId: { not: null } },
      select: { id: true, entidad: true, entidadId: true },
    });
    if (candidatos.length === 0) return 0;
    const porTipo = new Map<string, number[]>();
    for (const c of candidatos) porTipo.set(c.entidad!, [...(porTipo.get(c.entidad!) ?? []), c.entidadId!]);
    const delGuardia = (campo: string) => ({ [campo]: { in: guardiaIds } });
    const delSitio = { sitioId: { in: sitioIds } };
    const mios = async (tipo: string, buscar: (ids: number[]) => Promise<number[]>) => {
      const ids = porTipo.get(tipo);
      return ids ? new Set(await buscar(ids)) : new Set<number>();
    };
    const idsDe = async (rows: Promise<{ id: number }[]>) => (await rows).map((r) => r.id);
    const coinciden: Record<string, Set<number>> = {
      rostro: await mios('rostro', (ids) =>
        idsDe(db.rostroGuardia.findMany({ where: { id: { in: ids }, ...delGuardia('usuarioId') }, select: { id: true } })),
      ),
      incidencia: await mios('incidencia', (ids) =>
        idsDe(
          db.incidenciaRostro.findMany({
            where: { id: { in: ids }, OR: [delGuardia('usuarioId'), delSitio] },
            select: { id: true },
          }),
        ),
      ),
      bitacora: await mios('bitacora', (ids) =>
        idsDe(
          db.eventoBitacora.findMany({
            where: { id: { in: ids }, OR: [delGuardia('usuarioId'), delSitio] },
            select: { id: true },
          }),
        ),
      ),
      marca: await mios('marca', (ids) =>
        idsDe(
          db.marcacion.findMany({ where: { id: { in: ids }, OR: [delGuardia('usuarioId'), delSitio] }, select: { id: true } }),
        ),
      ),
      cambio: await mios('cambio', (ids) =>
        idsDe(
          db.cambioTurno.findMany({ where: { id: { in: ids }, OR: [delGuardia('usuarioId'), delSitio] }, select: { id: true } }),
        ),
      ),
      hora_extra: await mios('hora_extra', (ids) =>
        idsDe(db.horaExtra.findMany({ where: { id: { in: ids }, OR: [delGuardia('usuarioId'), delSitio] }, select: { id: true } })),
      ),
      // El aviso de un caso de cobertura lleva el id de la entrada (la marca) del guardia.
      caso: await mios('caso', async (ids) =>
        (
          await db.casoCobertura.findMany({
            where: { entradaId: { in: ids }, OR: [delGuardia('guardiaId'), delSitio] },
            select: { entradaId: true },
          })
        ).map((r) => r.entradaId),
      ),
      solicitud: await mios('solicitud', (ids) =>
        idsDe(
          db.solicitudCobertura.findMany({
            where: { id: { in: ids }, OR: [delGuardia('guardiaId'), delSitio] },
            select: { id: true },
          }),
        ),
      ),
      ausencia: await mios('ausencia', (ids) =>
        idsDe(db.ausencia.findMany({ where: { id: { in: ids }, ...delGuardia('usuarioId') }, select: { id: true } })),
      ),
    };
    const mover = candidatos.filter((c) => coinciden[c.entidad!]?.has(c.entidadId!)).map((c) => c.id);
    if (mover.length === 0) return 0;
    const { count } = await db.aviso.updateMany({ where: { id: { in: mover } }, data: { usuarioId: hacia } });
    return count;
  }
}
