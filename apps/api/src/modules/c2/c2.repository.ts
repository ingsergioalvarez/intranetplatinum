import { ROLES, TIPOS_EVENTO_C2, telefonoDeContacto, type TipoEventoC2 } from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe } from '../avisos/duenos';
import { registrarEventoC2ConPrisma, type NuevoEventoC2 } from './bitacora';
import type { SitioBase } from './estado';

/** Una línea de la bitácora tal como se guardó. */
export interface EventoRow {
  id: number;
  tipo: TipoEventoC2;
  sitioId: number | null;
  sitioNombre: string | null;
  clienteNombre: string | null;
  detalle: string | null;
  usuarioNombre: string | null;
  minutos: number | null;
  entidad: string | null;
  entidadId: number | null;
  createdAt: Date;
}

/** El sitio sobre el que actúa el C2. */
export interface SitioInfo {
  id: number;
  nombre: string;
  cliente: { id: number; nombre: string };
  supervisorId: number | null;
}

/** Datos del monitoreo del C2 (A-61, A-80). */
export abstract class C2Repository {
  /** Sitios activos de clientes activos, con su cliente y supervisor. */
  abstract sitios(): Promise<SitioBase[]>;
  /** Cuentas activas con rol C2: a quienes les llegan los avisos de sitios solos. */
  abstract usuariosC2(): Promise<number[]>;
  abstract episodiosAbiertos(): Promise<{ id: number; sitioId: number; inicio: Date }[]>;
  abstract abrirEpisodio(sitioId: number, inicio: Date): Promise<number>;
  abstract cerrarEpisodio(id: number, fin: Date, cubierto: boolean): Promise<void>;

  // ---- Bitácora ----
  abstract registrarEvento(evento: NuevoEventoC2): Promise<void>;
  /** Último estado registrado de cada sitio (solo, parcial, cubierto o cierre): para detectar cuándo cambia. */
  abstract ultimosEstados(): Promise<Map<number, { tipo: TipoEventoC2; createdAt: Date }>>;
  /** Eventos del rango, los más nuevos primero. */
  abstract eventos(desde: Date, hasta: Date, filtro: { tipos?: readonly TipoEventoC2[]; q?: string }): Promise<EventoRow[]>;
  /** Última nota del C2 de cada sitio desde ese instante. */
  abstract ultimasNotas(desde: Date): Promise<Map<number, { texto: string; autor: string; en: Date }>>;

  // ---- Acciones ----
  abstract sitioInfo(id: number): Promise<SitioInfo | null>;
  /** A quién avisar de un sitio: su supervisor y los admin dueños; sin ellos, los super admin. */
  abstract destinatariosDeSitio(sitioId: number): Promise<number[]>;
}

const ESTADOS_REGISTRADOS: TipoEventoC2[] = ['sitio_solo', 'sitio_parcial', 'sitio_cubierto', 'sitio_cierre'];

export class PrismaC2Repository extends C2Repository {
  async sitios(): Promise<SitioBase[]> {
    const rows = await getPrisma().sitio.findMany({
      where: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } },
      select: {
        id: true,
        nombre: true,
        cliente: { select: { id: true, nombreComercial: true } },
        supervisor: { select: { nombre: true, telefono: true, telefonoPersonal: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      cliente: { id: s.cliente.id, nombre: s.cliente.nombreComercial },
      supervisor: s.supervisor
        ? {
            nombre: s.supervisor.nombre,
            ...telefonoDeContacto(s.supervisor),
            telefonos: [
              ...(s.supervisor.telefonoPersonal ? [{ numero: s.supervisor.telefonoPersonal, etiqueta: 'personal' as const }] : []),
              ...(s.supervisor.telefono && s.supervisor.telefono !== s.supervisor.telefonoPersonal
                ? [{ numero: s.supervisor.telefono, etiqueta: 'empresa' as const }]
                : []),
            ],
          }
        : null,
    }));
  }

  async usuariosC2() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: ROLES.C2 } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async episodiosAbiertos() {
    return getPrisma().sitioSoloEpisodio.findMany({ where: { fin: null }, select: { id: true, sitioId: true, inicio: true } });
  }

  async abrirEpisodio(sitioId: number, inicio: Date) {
    return (await getPrisma().sitioSoloEpisodio.create({ data: { sitioId, inicio }, select: { id: true } })).id;
  }

  async cerrarEpisodio(id: number, fin: Date, cubierto: boolean) {
    await getPrisma().sitioSoloEpisodio.update({ where: { id }, data: { fin, cubierto } });
  }

  registrarEvento(evento: NuevoEventoC2) {
    return registrarEventoC2ConPrisma(evento);
  }

  async ultimosEstados() {
    // Por orden de registro (id), no por hora: las líneas de "solo" y "parcial" se guardan con la hora del turno.
    const rows = await getPrisma().c2Evento.findMany({
      where: { tipo: { in: ESTADOS_REGISTRADOS }, sitioId: { not: null } },
      orderBy: { id: 'desc' },
      distinct: ['sitioId'],
      select: { sitioId: true, tipo: true, createdAt: true },
    });
    return new Map(rows.map((r) => [r.sitioId!, { tipo: r.tipo as TipoEventoC2, createdAt: r.createdAt }]));
  }

  async eventos(desde: Date, hasta: Date, { tipos, q }: { tipos?: readonly TipoEventoC2[]; q?: string }): Promise<EventoRow[]> {
    const rows = await getPrisma().c2Evento.findMany({
      where: {
        createdAt: { gte: desde, lt: hasta },
        ...(tipos && { tipo: { in: [...tipos] } }),
        ...(q && {
          OR: [
            { sitioNombre: { contains: q } },
            { clienteNombre: { contains: q } },
            { usuarioNombre: { contains: q } },
            { detalle: { contains: q } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      tipo: (TIPOS_EVENTO_C2 as readonly string[]).includes(r.tipo) ? (r.tipo as TipoEventoC2) : 'nota',
      sitioId: r.sitioId,
      sitioNombre: r.sitioNombre,
      clienteNombre: r.clienteNombre,
      detalle: r.detalle,
      usuarioNombre: r.usuarioNombre,
      minutos: r.minutos,
      entidad: r.entidad,
      entidadId: r.entidadId,
      createdAt: r.createdAt,
    }));
  }

  async ultimasNotas(desde: Date) {
    const rows = await getPrisma().c2Evento.findMany({
      where: { tipo: 'nota', sitioId: { not: null }, createdAt: { gte: desde } },
      orderBy: { id: 'desc' },
      distinct: ['sitioId'],
      select: { sitioId: true, detalle: true, usuarioNombre: true, createdAt: true },
    });
    return new Map(rows.map((r) => [r.sitioId!, { texto: r.detalle ?? '', autor: r.usuarioNombre ?? 'C2', en: r.createdAt }]));
  }

  async sitioInfo(id: number): Promise<SitioInfo | null> {
    const s = await getPrisma().sitio.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, nombre: true, supervisorId: true, cliente: { select: { id: true, nombreComercial: true } } },
    });
    return s && { id: s.id, nombre: s.nombre, supervisorId: s.supervisorId, cliente: { id: s.cliente.id, nombre: s.cliente.nombreComercial } };
  }

  async destinatariosDeSitio(sitioId: number) {
    const db = getPrisma();
    const ids = new Set<number>();
    const s = await db.sitio.findUnique({ where: { id: sitioId }, select: { supervisorId: true } });
    if (s?.supervisorId) ids.add(s.supervisorId);
    for (const a of await adminsDe({ sitioId })) ids.add(a);
    // Sin supervisor ni dueño, que no se pierda: le llega al super admin.
    if (ids.size === 0) {
      const supers = await db.usuario.findMany({ where: { esSuperAdmin: true, activo: true, deletedAt: null }, select: { id: true } });
      for (const u of supers) ids.add(u.id);
    }
    return [...ids];
  }
}
