import { TIPOS_EVENTO_BITACORA, type InformeDatos, type TipoInforme } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaAsistenciaRepository, type MarcacionRow } from '../asistencia/asistencia.repository';
import type { TurnoProgramado } from '../asistencia/vigilancia';
import { PrismaVigilanciaRepository } from '../asistencia/vigilancia.repository';
import { PrismaBitacoraRepository, type EventoBitacoraRow } from '../bitacora/bitacora.repository';

export interface InformeRow {
  id: number;
  folio: string;
  tipo: TipoInforme;
  usuarioId: number | null;
  usuarioNombre: string | null;
  sitioId: number | null;
  desde: string;
  hasta: string;
  incluirDetalle: boolean;
  incluirFirmas: boolean;
  datos: InformeDatos;
  huella: string;
  hash: string;
  generadoPorId: number | null;
  generadoPor: string | null;
  reemplaza: { id: number; folio: string } | null;
  reemplazadoPor: { id: number; folio: string } | null;
  createdAt: Date;
}

export interface NuevoInformeRow {
  tipo: TipoInforme;
  usuarioId: number | null;
  sitioId: number | null;
  desde: string;
  hasta: string;
  incluirDetalle: boolean;
  incluirFirmas: boolean;
  datos: InformeDatos;
  huella: string;
  generadoPorId: number;
  reemplazaId: number | null;
}

/** Folio y hash oficiales; dependen del id y la hora que asigna la base de datos. */
export type Firmar = (id: number, creado: Date) => { folio: string; hash: string };

export interface FiltroInformes {
  q?: string;
  tipo?: TipoInforme;
  guardiaId?: number;
  /** `AAAA-MM`: reportes cuyo periodo toca ese mes. */
  mes?: string;
  /** Supervisor: solo reportes personales de sus guardias o los que él generó. */
  visible?: { guardiaIds: number[]; usuarioId: number };
  skip: number;
  take: number;
}

export interface Persona {
  id: number;
  nombre: string;
  email: string;
}

export abstract class InformesRepository {
  /** Guardias activos (o solo esos ids). */
  abstract guardias(ids: number[] | null): Promise<Persona[]>;
  abstract guardia(id: number): Promise<Persona | null>;
  abstract sitios(ids: number[] | null): Promise<{ id: number; nombre: string }[]>;
  abstract turnos(desde: string, hasta: string): Promise<TurnoProgramado[]>;
  /** Marcas de las jornadas que empezaron entre los dos instantes. */
  abstract marcas(desde: Date, hasta: Date): Promise<(MarcacionRow & { usuario: { id: number } })[]>;
  abstract eventos(desde: Date, hasta: Date): Promise<EventoBitacoraRow[]>;
  abstract supervisores(): Promise<Map<number, string>>;
  abstract buscarPorHuella(huella: string): Promise<InformeRow | null>;
  /** El último reporte vigente del mismo alcance y periodo (para marcar el reemplazo). */
  abstract ultimoDelAlcance(a: {
    tipo: TipoInforme;
    usuarioId: number | null;
    sitioId: number | null;
    desde: string;
    hasta: string;
  }): Promise<InformeRow | null>;
  abstract crear(data: NuevoInformeRow, firmar: Firmar): Promise<InformeRow>;
  abstract listar(f: FiltroInformes): Promise<{ items: InformeRow[]; total: number }>;
  abstract findById(id: number): Promise<InformeRow | null>;
  abstract findByFolio(folio: string): Promise<InformeRow | null>;
}

const select = {
  id: true,
  folio: true,
  tipo: true,
  usuarioId: true,
  sitioId: true,
  desde: true,
  hasta: true,
  incluirDetalle: true,
  incluirFirmas: true,
  datos: true,
  huella: true,
  hash: true,
  generadoPorId: true,
  createdAt: true,
  usuario: { select: { nombre: true } },
  generadoPor: { select: { nombre: true } },
  reemplaza: { select: { id: true, folio: true } },
  reemplazadoPor: { select: { id: true, folio: true }, orderBy: { id: 'desc' }, take: 1 },
} as const;

type Fila = Prisma.InformeAsistenciaGetPayload<{ select: typeof select }>;

const aRow = (r: Fila): InformeRow => ({
  id: r.id,
  folio: r.folio ?? '',
  tipo: r.tipo,
  usuarioId: r.usuarioId,
  usuarioNombre: r.usuario?.nombre ?? null,
  sitioId: r.sitioId,
  desde: dateAFecha(r.desde),
  hasta: dateAFecha(r.hasta),
  incluirDetalle: r.incluirDetalle,
  incluirFirmas: r.incluirFirmas,
  datos: r.datos as unknown as InformeDatos,
  huella: r.huella,
  hash: r.hash,
  generadoPorId: r.generadoPorId,
  generadoPor: r.generadoPor?.nombre ?? null,
  reemplaza: r.reemplaza && { id: r.reemplaza.id, folio: r.reemplaza.folio ?? '' },
  reemplazadoPor: r.reemplazadoPor[0] && { id: r.reemplazadoPor[0].id, folio: r.reemplazadoPor[0].folio ?? '' },
  createdAt: r.createdAt,
});

export class PrismaInformesRepository extends InformesRepository {
  private readonly asistencia = new PrismaAsistenciaRepository();
  private readonly vigilancia = new PrismaVigilanciaRepository();
  private readonly bitacora = new PrismaBitacoraRepository();

  async guardias(ids: number[] | null) {
    return getPrisma().usuario.findMany({
      where: {
        deletedAt: null,
        rol: { clave: 'guardia' },
        ...(ids ? { id: { in: ids } } : { activo: true }),
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, email: true },
    });
  }

  async guardia(id: number) {
    return getPrisma().usuario.findFirst({
      where: { id, deletedAt: null, rol: { clave: 'guardia' } },
      select: { id: true, nombre: true, email: true },
    });
  }

  async sitios(ids: number[] | null) {
    return getPrisma().sitio.findMany({
      where: { deletedAt: null, cliente: { deletedAt: null }, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
  }

  turnos(desde: string, hasta: string) {
    return this.vigilancia.turnosVigentes(desde, hasta);
  }

  marcas(desde: Date, hasta: Date) {
    return this.asistencia.jornadasDeTodos(desde, hasta);
  }

  eventos(desde: Date, hasta: Date) {
    return this.bitacora.eventosDeTodos(TIPOS_EVENTO_BITACORA, desde, hasta);
  }

  async supervisores() {
    const rows = await getPrisma().sitio.findMany({
      where: { supervisorId: { not: null } },
      select: { id: true, supervisor: { select: { nombre: true } } },
    });
    return new Map(rows.flatMap((r) => (r.supervisor ? [[r.id, r.supervisor.nombre] as const] : [])));
  }

  async buscarPorHuella(huella: string) {
    const r = await getPrisma().informeAsistencia.findFirst({
      where: { huella, folio: { not: null } },
      orderBy: { id: 'desc' },
      select,
    });
    return r && aRow(r);
  }

  async ultimoDelAlcance(a: Parameters<InformesRepository['ultimoDelAlcance']>[0]) {
    const r = await getPrisma().informeAsistencia.findFirst({
      where: {
        tipo: a.tipo,
        usuarioId: a.usuarioId,
        sitioId: a.sitioId,
        desde: fechaADate(a.desde),
        hasta: fechaADate(a.hasta),
        folio: { not: null },
        reemplazadoPor: { none: {} },
      },
      orderBy: { id: 'desc' },
      select,
    });
    return r && aRow(r);
  }

  async crear(data: NuevoInformeRow, firmar: Firmar) {
    const db = getPrisma();
    const id = await db.$transaction(async (tx) => {
      const creado = await tx.informeAsistencia.create({
        data: {
          tipo: data.tipo,
          usuarioId: data.usuarioId,
          sitioId: data.sitioId,
          desde: fechaADate(data.desde),
          hasta: fechaADate(data.hasta),
          incluirDetalle: data.incluirDetalle,
          incluirFirmas: data.incluirFirmas,
          datos: data.datos as unknown as Prisma.InputJsonValue,
          huella: data.huella,
          hash: data.huella,
          generadoPorId: data.generadoPorId,
          reemplazaId: data.reemplazaId,
        },
        select: { id: true, createdAt: true },
      });
      const { folio, hash } = firmar(creado.id, creado.createdAt);
      await tx.informeAsistencia.update({ where: { id: creado.id }, data: { folio, hash } });
      return creado.id;
    });
    return (await this.findById(id))!;
  }

  async listar({ q, tipo, guardiaId, mes, visible, skip, take }: FiltroInformes) {
    const and: Prisma.InformeAsistenciaWhereInput[] = [{ folio: { not: null } }];
    if (tipo) and.push({ tipo });
    if (guardiaId) and.push({ usuarioId: guardiaId });
    if (q) {
      and.push({
        OR: [{ folio: { contains: q } }, { usuario: { nombre: { contains: q } } }, { sitio: { nombre: { contains: q } } }],
      });
    }
    if (mes) {
      const ini = fechaADate(`${mes}-01`);
      const fin = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 1, 0));
      and.push({ desde: { lte: fin }, hasta: { gte: ini } });
    }
    if (visible) {
      and.push({
        OR: [{ usuarioId: { in: visible.guardiaIds } }, { generadoPorId: visible.usuarioId }],
      });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      getPrisma().informeAsistencia.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        select,
      }),
      getPrisma().informeAsistencia.count({ where }),
    ]);
    return { items: rows.map(aRow), total };
  }

  async findById(id: number) {
    const r = await getPrisma().informeAsistencia.findFirst({ where: { id, folio: { not: null } }, select });
    return r && aRow(r);
  }

  async findByFolio(folio: string) {
    const r = await getPrisma().informeAsistencia.findUnique({ where: { folio }, select });
    return r && aRow(r);
  }
}
