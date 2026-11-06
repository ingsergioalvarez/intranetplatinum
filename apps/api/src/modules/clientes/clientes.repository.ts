import type {
  ClienteCreateData,
  ClienteFiltro,
  ClienteResumen,
  Paginated,
  PaginationQuery,
  Sitio,
  SitioData,
} from '@platinum/shared';
import { BaseRepository, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { empresaActual } from '../../core/empresa/contexto';

export type ClienteFiltroData = Omit<ClienteFiltro, 'page' | 'limit'>;
export type ClienteUpdateData = Partial<ClienteCreateData>;

/** Clientes y lo que cuelga de ellos (contactos y sitios). */
export abstract class ClientesRepository extends BaseRepository<
  ClienteResumen,
  ClienteCreateData,
  ClienteUpdateData,
  ClienteFiltroData
> {
  /** Incluye clientes dados de baja (el RFC es único en toda la tabla). */
  abstract findByRfc(rfc: string): Promise<ClienteResumen | null>;

  /** Sitios del cliente; `asignacionesVigentes` se calcula a la fecha `hoy`. */
  abstract listSitios(clienteId: number, hoy: string, incluirBaja?: boolean): Promise<Sitio[]>;
  abstract findSitio(id: number, hoy: string): Promise<Sitio | null>;
  abstract createSitio(clienteId: number, data: SitioData): Promise<Sitio>;
  abstract updateSitio(id: number, data: Partial<SitioData>): Promise<void>;
  /** Baja del sitio y término (al día `hoy`) de sus asignaciones vigentes. */
  abstract softDeleteSitio(id: number, hoy: string): Promise<void>;
  abstract restoreSitio(id: number): Promise<void>;
}

// ---------- Mapeos ----------

const clienteSelect = {
  id: true,
  nombreComercial: true,
  razonSocial: true,
  rfc: true,
  giro: true,
  direccionFiscal: true,
  telefono: true,
  email: true,
  logoUrl: true,
  estatus: true,
  notas: true,
  createdAt: true,
  deletedAt: true,
  _count: {
    select: {
      sitios: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.ClienteSelect;

type ClienteRow = Prisma.ClienteGetPayload<{ select: typeof clienteSelect }>;

function toCliente({ _count, createdAt, deletedAt, ...c }: ClienteRow): ClienteResumen {
  return {
    ...c,
    createdAt: createdAt.toISOString(),
    deletedAt: deletedAt?.toISOString() ?? null,
    totalSitios: _count.sitios,
  };
}

/** Asignación vigente a la fecha `hoy` (usa `vigenteHasta`, que ya considera eventos que cruzan medianoche). */
export function vigenteEn(hoy: string): Prisma.SitioGuardiaWhereInput {
  const d = fechaADate(hoy);
  return { desde: { lte: d }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: d } }] };
}

/** Asignación vigente hoy de este guardia: directa o por un grupo activo al que pertenece (D-017). */
export function asignadaA(usuarioId: number, hoy: string): Prisma.SitioGuardiaWhereInput {
  return {
    AND: [
      vigenteEn(hoy),
      {
        OR: [
          { usuarioId, usuario: { activo: true, deletedAt: null } },
          { grupo: { deletedAt: null, integrantes: { some: { usuarioId } } } },
        ],
      },
    ],
  };
}

const sitioSelect = (hoy: string) =>
  ({
    id: true,
    clienteId: true,
    nombre: true,
    direccion: true,
    referencias: true,
    lat: true,
    lng: true,
    radioM: true,
    deletedAt: true,
    supervisor: { select: { id: true, nombre: true } },
    _count: { select: { asignaciones: { where: vigenteEn(hoy) } } },
  }) satisfies Prisma.SitioSelect;

type SitioRow = Prisma.SitioGetPayload<{ select: ReturnType<typeof sitioSelect> }>;

function toSitio({ _count, lat, lng, deletedAt, ...s }: SitioRow): Sitio {
  return {
    ...s,
    lat: lat === null ? null : Number(lat),
    lng: lng === null ? null : Number(lng),
    deletedAt: deletedAt?.toISOString() ?? null,
    asignacionesVigentes: _count.asignaciones,
  };
}

// ---------- Implementación Prisma ----------

export class PrismaClientesRepository extends ClientesRepository {
  async findById(id: number) {
    const c = await getPrisma().cliente.findUnique({ where: { id }, select: clienteSelect });
    return c && toCliente(c);
  }

  async findByRfc(rfc: string) {
    const c = await getPrisma().cliente.findFirst({ where: { rfc }, select: clienteSelect });
    return c && toCliente(c);
  }

  async findPaged(
    { q, estatus, estado }: ClienteFiltroData,
    { page, limit }: PaginationQuery,
  ): Promise<Paginated<ClienteResumen>> {
    const where: Prisma.ClienteWhereInput = {
      ...(estado === 'activos' && { deletedAt: null }),
      ...(estado === 'baja' && { deletedAt: { not: null } }),
      ...(estatus && { estatus }),
      ...(q && {
        OR: [
          { nombreComercial: { contains: q } },
          { razonSocial: { contains: q } },
          { rfc: { contains: q } },
        ],
      }),
    };
    const prisma = getPrisma();
    const [rows, total] = await prisma.$transaction([
      prisma.cliente.findMany({
        where,
        select: clienteSelect,
        orderBy: [{ deletedAt: 'asc' }, { nombreComercial: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cliente.count({ where }),
    ]);
    return { items: rows.map(toCliente), total, page, limit };
  }

  async create(data: ClienteCreateData) {
    return toCliente(
      await getPrisma().cliente.create({
        data: {
          ...data,
          empresa: { connect: { id: empresaActual() } },
        },
        select: clienteSelect,
      }),
    );
  }

  async update(id: number, data: ClienteUpdateData) {
    return toCliente(await getPrisma().cliente.update({ where: { id }, data, select: clienteSelect }));
  }

  async softDelete(id: number) {
    await getPrisma().cliente.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: number) {
    await getPrisma().cliente.update({ where: { id }, data: { deletedAt: null } });
  }

  // ----- Sitios -----

  async listSitios(clienteId: number, hoy: string, incluirBaja = false) {
    const rows = await getPrisma().sitio.findMany({
      where: { clienteId, ...(!incluirBaja && { deletedAt: null }) },
      select: sitioSelect(hoy),
      orderBy: [{ deletedAt: 'asc' }, { nombre: 'asc' }],
    });
    return rows.map(toSitio);
  }

  async findSitio(id: number, hoy: string) {
    const s = await getPrisma().sitio.findUnique({ where: { id }, select: sitioSelect(hoy) });
    return s && toSitio(s);
  }

  async createSitio(clienteId: number, data: SitioData) {
    // Recién creado no tiene asignaciones: la fecha del conteo es irrelevante.
    return toSitio(
      await getPrisma().sitio.create({ data: { ...data, clienteId, empresaId: empresaActual() }, select: sitioSelect('1970-01-01') }),
    );
  }

  async updateSitio(id: number, data: Partial<SitioData>) {
    await getPrisma().sitio.update({ where: { id }, data });
  }

  async softDeleteSitio(id: number, hoy: string) {
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.sitio.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.sitioGuardia.updateMany({
        // Solo las que ya iniciaron; las programadas a futuro quedan sin efecto con el sitio de baja.
        where: {
          sitioId: id,
          desde: { lte: fechaADate(hoy) },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: fechaADate(hoy) } }],
        },
        data: { hasta: fechaADate(hoy), vigenteHasta: fechaADate(hoy) },
      }),
    ]);
  }

  async restoreSitio(id: number) {
    await getPrisma().sitio.update({ where: { id }, data: { deletedAt: null } });
  }
}
