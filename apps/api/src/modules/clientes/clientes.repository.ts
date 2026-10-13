import type {
  ClienteCreateData,
  ClienteFiltro,
  ClienteResumen,
  Contacto,
  ContactoData,
  Paginated,
  PrioridadReporte,
  ReglasAviso,
  PaginationQuery,
  Sitio,
  SitioData,
} from '@platinum/shared';
import { BaseRepository, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

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

  abstract listContactos(clienteId: number): Promise<Contacto[]>;
  abstract findContacto(id: number): Promise<Contacto | null>;
  abstract createContacto(clienteId: number, data: ContactoData): Promise<Contacto>;
  abstract updateContacto(id: number, data: ContactoData): Promise<Contacto>;
  abstract softDeleteContacto(id: number): Promise<void>;

  /** Sitios del cliente; `guardiasVigentes` se calcula a la fecha `hoy`. */
  abstract listSitios(clienteId: number, hoy: string, incluirBaja?: boolean): Promise<Sitio[]>;
  abstract findSitio(id: number, hoy: string): Promise<Sitio | null>;
  abstract createSitio(clienteId: number, data: SitioData): Promise<Sitio>;
  abstract updateSitio(id: number, data: Partial<SitioData>): Promise<void>;
  /** Baja del sitio y término (al día `hoy`) de sus asignaciones vigentes. */
  abstract softDeleteSitio(id: number, hoy: string): Promise<void>;
  abstract restoreSitio(id: number): Promise<void>;

  abstract getReglasAviso(clienteId: number): Promise<ReglasAviso>;
  /** Reemplaza la regla por defecto y todas las excepciones por prioridad. */
  abstract setReglasAviso(clienteId: number, reglas: ReglasAviso): Promise<void>;
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
      contactos: { where: { deletedAt: null } },
    },
  },
  contactos: {
    where: { deletedAt: null, esResponsable: true },
    orderBy: [{ prioridad: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { nombre: true },
  },
} satisfies Prisma.ClienteSelect;

type ClienteRow = Prisma.ClienteGetPayload<{ select: typeof clienteSelect }>;

function toCliente({ _count, contactos, createdAt, deletedAt, ...c }: ClienteRow): ClienteResumen {
  return {
    ...c,
    createdAt: createdAt.toISOString(),
    deletedAt: deletedAt?.toISOString() ?? null,
    totalSitios: _count.sitios,
    totalContactos: _count.contactos,
    responsable: contactos[0]?.nombre ?? null,
  };
}

const contactoSelect = {
  id: true,
  clienteId: true,
  nombre: true,
  puesto: true,
  telefono: true,
  celular: true,
  email: true,
  esResponsable: true,
  recibeNotificaciones: true,
  prioridad: true,
} satisfies Prisma.ClienteContactoSelect;

/** Condición de asignación vigente a la fecha `hoy`. */
export function vigenteEn(hoy: string): Prisma.SitioGuardiaWhereInput {
  const d = fechaADate(hoy);
  return { desde: { lte: d }, OR: [{ hasta: null }, { hasta: { gte: d } }] };
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
    deletedAt: true,
    _count: { select: { asignaciones: { where: vigenteEn(hoy) } } },
  }) satisfies Prisma.SitioSelect;

type SitioRow = Prisma.SitioGetPayload<{ select: ReturnType<typeof sitioSelect> }>;

function toSitio({ _count, lat, lng, deletedAt, ...s }: SitioRow): Sitio {
  return {
    ...s,
    lat: lat === null ? null : Number(lat),
    lng: lng === null ? null : Number(lng),
    deletedAt: deletedAt?.toISOString() ?? null,
    guardiasVigentes: _count.asignaciones,
  };
}

// ---------- Implementación Prisma ----------

export class PrismaClientesRepository extends ClientesRepository {
  async findById(id: number) {
    const c = await getPrisma().cliente.findUnique({ where: { id }, select: clienteSelect });
    return c && toCliente(c);
  }

  async findByRfc(rfc: string) {
    const c = await getPrisma().cliente.findUnique({ where: { rfc }, select: clienteSelect });
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
    return toCliente(await getPrisma().cliente.create({ data, select: clienteSelect }));
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

  // ----- Contactos -----

  async listContactos(clienteId: number) {
    return getPrisma().clienteContacto.findMany({
      where: { clienteId, deletedAt: null },
      select: contactoSelect,
      orderBy: [{ esResponsable: 'desc' }, { prioridad: 'asc' }, { nombre: 'asc' }],
    });
  }

  async findContacto(id: number) {
    return getPrisma().clienteContacto.findFirst({ where: { id, deletedAt: null }, select: contactoSelect });
  }

  async createContacto(clienteId: number, data: ContactoData) {
    return getPrisma().clienteContacto.create({ data: { ...data, clienteId }, select: contactoSelect });
  }

  async updateContacto(id: number, data: ContactoData) {
    return getPrisma().clienteContacto.update({ where: { id }, data, select: contactoSelect });
  }

  async softDeleteContacto(id: number) {
    await getPrisma().clienteContacto.update({ where: { id }, data: { deletedAt: new Date() } });
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
      await getPrisma().sitio.create({ data: { ...data, clienteId }, select: sitioSelect('1970-01-01') }),
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
          OR: [{ hasta: null }, { hasta: { gt: fechaADate(hoy) } }],
        },
        data: { hasta: fechaADate(hoy) },
      }),
    ]);
  }

  async restoreSitio(id: number) {
    await getPrisma().sitio.update({ where: { id }, data: { deletedAt: null } });
  }

  // ----- Reglas de aviso (F3-09) -----

  async getReglasAviso(clienteId: number): Promise<ReglasAviso> {
    const c = await getPrisma().cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { avisoPorDefecto: true, reglasAviso: { select: { prioridad: true, destino: true } } },
    });
    return {
      porDefecto: c.avisoPorDefecto,
      porPrioridad: Object.fromEntries(c.reglasAviso.map((r) => [r.prioridad, r.destino])),
    };
  }

  async setReglasAviso(clienteId: number, { porDefecto, porPrioridad }: ReglasAviso) {
    const prisma = getPrisma();
    const excepciones = Object.entries(porPrioridad).filter(([, d]) => d) as [
      PrioridadReporte,
      ReglasAviso['porDefecto'],
    ][];
    await prisma.$transaction([
      prisma.cliente.update({ where: { id: clienteId }, data: { avisoPorDefecto: porDefecto } }),
      prisma.clienteReglaAviso.deleteMany({ where: { clienteId } }),
      prisma.clienteReglaAviso.createMany({
        data: excepciones.map(([prioridad, destino]) => ({ clienteId, prioridad, destino })),
      }),
    ]);
  }
}
