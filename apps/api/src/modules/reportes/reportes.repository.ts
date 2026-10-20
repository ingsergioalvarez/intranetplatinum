import type {
  EstatusReporte,
  Paginated,
  PaginationQuery,
  Persona,
  ReporteCreateData,
  ReporteFiltro,
  ReporteResumen,
  SitioReportable,
} from '@platinum/shared';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { asignadaA } from '../clientes/clientes.repository';

/** Qué reportes puede ver el usuario. */
export type Visibilidad =
  | { tipo: 'todos' }
  /** Reportes de sus sitios con asignación vigente hoy + los que él creó. */
  | { tipo: 'guardia'; usuarioId: number; hoy: string }
  | { tipo: 'ninguno' };

export type ReporteFiltroData = Omit<ReporteFiltro, 'page' | 'limit' | 'desde' | 'hasta' | 'mios'> & {
  creadoPorId?: number;
  /** Rango de fechas ya convertido a instantes en la zona del negocio. */
  creadoEntre?: { desde?: Date; hasta?: Date };
};

export interface FotoNueva {
  archivo: string;
  mime: string;
  tamano: number;
}

/** Evidencia tal como está en BD (el servicio la convierte a URL firmada). */
export interface EvidenciaRow {
  id: number;
  archivo: string;
  mime: string;
  tamano: number;
  createdAt: Date;
  subidaPor: Persona;
}

export interface ReporteDetalleRow extends ReporteResumen {
  descripcion: string;
  ubicacionDetalle: string | null;
  lat: number | null;
  lng: number | null;
  evidencias: EvidenciaRow[];
  seguimientos: {
    id: number;
    usuario: Persona;
    comentario: string | null;
    estatusAnterior: EstatusReporte | null;
    estatusNuevo: EstatusReporte | null;
    createdAt: Date;
    evidencias: EvidenciaRow[];
  }[];
}

export interface NuevoSeguimiento {
  usuarioId: number;
  comentario: string | null;
  estatusAnterior: EstatusReporte | null;
  estatusNuevo: EstatusReporte | null;
}

export abstract class ReportesRepository {
  /** Crea el reporte con folio consecutivo del año y sus fotos, en una sola transacción. */
  abstract crear(
    data: ReporteCreateData & { clienteId: number; creadoPorId: number },
    fotos: FotoNueva[],
    anio: number,
  ): Promise<{ id: number; folio: string }>;
  abstract findPaged(
    filtro: ReporteFiltroData,
    visibilidad: Visibilidad,
    pagination: PaginationQuery,
  ): Promise<Paginated<ReporteResumen>>;
  abstract findDetalle(id: number): Promise<ReporteDetalleRow | null>;
  abstract puedeVer(id: number, visibilidad: Visibilidad): Promise<boolean>;
  abstract agregarSeguimiento(
    reporteId: number,
    seguimiento: NuevoSeguimiento,
    fotos: FotoNueva[],
  ): Promise<number>;
  /** Sitio activo de cliente vigente; con `guardiaId`, además asignado hoy a ese guardia. */
  abstract sitioParaReportar(
    sitioId: number,
    guardia: { usuarioId: number; hoy: string } | null,
  ): Promise<{ id: number; clienteId: number } | null>;
  abstract sitiosReportables(guardia: { usuarioId: number; hoy: string } | null): Promise<SitioReportable[]>;
  abstract categoriaActiva(id: number): Promise<boolean>;
}

// ---------- Mapeos ----------

const personaSelect = { select: { id: true, nombre: true } } as const;

const resumenSelect = {
  id: true,
  folio: true,
  titulo: true,
  prioridad: true,
  estatus: true,
  createdAt: true,
  cerradoEn: true,
  sitio: { select: { id: true, nombre: true } },
  cliente: { select: { id: true, nombreComercial: true } },
  categoria: { select: { id: true, nombre: true, padre: { select: { nombre: true } } } },
  creadoPor: personaSelect,
  _count: { select: { evidencias: true } },
} satisfies Prisma.ReporteSelect;

type ResumenRow = Prisma.ReporteGetPayload<{ select: typeof resumenSelect }>;

function toResumen({ _count, categoria, createdAt, cerradoEn, ...r }: ResumenRow): ReporteResumen {
  return {
    ...r,
    createdAt: createdAt.toISOString(),
    cerradoEn: cerradoEn?.toISOString() ?? null,
    categoria: { id: categoria.id, nombre: categoria.nombre, padre: categoria.padre?.nombre ?? null },
    totalFotos: _count.evidencias,
  };
}

const evidenciaSelect = {
  id: true,
  archivo: true,
  mime: true,
  tamano: true,
  createdAt: true,
  subidaPor: personaSelect,
} satisfies Prisma.ReporteEvidenciaSelect;

function whereVisibilidad(v: Visibilidad): Prisma.ReporteWhereInput {
  switch (v.tipo) {
    case 'todos':
      return {};
    case 'ninguno':
      return { id: -1 };
    case 'guardia':
      return {
        OR: [
          { creadoPorId: v.usuarioId },
          { sitio: { asignaciones: { some: asignadaA(v.usuarioId, v.hoy) } } },
        ],
      };
  }
}

function whereFiltro(f: ReporteFiltroData): Prisma.ReporteWhereInput {
  return {
    ...(f.estatus && { estatus: f.estatus }),
    ...(f.prioridad && { prioridad: f.prioridad }),
    ...(f.clienteId && { clienteId: f.clienteId }),
    ...(f.sitioId && { sitioId: f.sitioId }),
    // Una categoría principal incluye sus subcategorías.
    ...(f.categoriaId && { OR: [{ categoriaId: f.categoriaId }, { categoria: { padreId: f.categoriaId } }] }),
    ...(f.creadoPorId && { creadoPorId: f.creadoPorId }),
    ...(f.creadoEntre && {
      createdAt: {
        ...(f.creadoEntre.desde && { gte: f.creadoEntre.desde }),
        ...(f.creadoEntre.hasta && { lt: f.creadoEntre.hasta }),
      },
    }),
    ...(f.q && { AND: [{ OR: [{ folio: { contains: f.q } }, { titulo: { contains: f.q } }] }] }),
  };
}

const sitioReportableWhere = (
  guardia: { usuarioId: number; hoy: string } | null,
): Prisma.SitioWhereInput => ({
  deletedAt: null,
  cliente: { deletedAt: null, estatus: 'activo' },
  ...(guardia && { asignaciones: { some: asignadaA(guardia.usuarioId, guardia.hoy) } }),
});

// ---------- Implementación Prisma ----------

export class PrismaReportesRepository extends ReportesRepository {
  async crear(
    { lat, lng, ...data }: ReporteCreateData & { clienteId: number; creadoPorId: number },
    fotos: FotoNueva[],
    anio: number,
  ) {
    return getPrisma().$transaction(async (tx) => {
      // Consecutivo atómico: el UPDATE bloquea la fila del año hasta el commit.
      await tx.$executeRaw`INSERT INTO folios_reporte (anio, ultimo) VALUES (${anio}, 1)
        ON DUPLICATE KEY UPDATE ultimo = ultimo + 1`;
      const [{ ultimo }] = await tx.$queryRaw<
        { ultimo: number }[]
      >`SELECT ultimo FROM folios_reporte WHERE anio = ${anio}`;
      const folio = `PLT-${anio}-${String(ultimo).padStart(6, '0')}`;

      const reporte = await tx.reporte.create({
        data: {
          ...data,
          folio,
          lat: lat ?? null,
          lng: lng ?? null,
          evidencias: { create: fotos.map((f) => ({ ...f, subidaPorId: data.creadoPorId })) },
        },
        select: { id: true, folio: true },
      });
      return reporte;
    });
  }

  async findPaged(filtro: ReporteFiltroData, visibilidad: Visibilidad, { page, limit }: PaginationQuery) {
    const where: Prisma.ReporteWhereInput = { AND: [whereVisibilidad(visibilidad), whereFiltro(filtro)] };
    const prisma = getPrisma();
    const [rows, total] = await prisma.$transaction([
      prisma.reporte.findMany({
        where,
        select: resumenSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reporte.count({ where }),
    ]);
    return { items: rows.map(toResumen), total, page, limit };
  }

  async findDetalle(id: number): Promise<ReporteDetalleRow | null> {
    const r = await getPrisma().reporte.findUnique({
      where: { id },
      select: {
        ...resumenSelect,
        descripcion: true,
        ubicacionDetalle: true,
        lat: true,
        lng: true,
        evidencias: { where: { seguimientoId: null }, select: evidenciaSelect, orderBy: { id: 'asc' } },
        seguimientos: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            usuario: personaSelect,
            comentario: true,
            estatusAnterior: true,
            estatusNuevo: true,
            createdAt: true,
            evidencias: { select: evidenciaSelect, orderBy: { id: 'asc' } },
          },
        },
      },
    });
    if (!r) return null;
    const { descripcion, ubicacionDetalle, lat, lng, evidencias, seguimientos, ...resumen } = r;
    return {
      ...toResumen(resumen),
      descripcion,
      ubicacionDetalle,
      lat: lat === null ? null : Number(lat),
      lng: lng === null ? null : Number(lng),
      evidencias,
      seguimientos,
    };
  }

  async puedeVer(id: number, visibilidad: Visibilidad) {
    return (await getPrisma().reporte.count({ where: { id, ...whereVisibilidad(visibilidad) } })) > 0;
  }

  async agregarSeguimiento(reporteId: number, s: NuevoSeguimiento, fotos: FotoNueva[]) {
    return getPrisma().$transaction(async (tx) => {
      const seguimiento = await tx.reporteSeguimiento.create({
        data: {
          reporteId,
          ...s,
          evidencias: { create: fotos.map((f) => ({ ...f, reporteId, subidaPorId: s.usuarioId })) },
        },
        select: { id: true },
      });
      if (s.estatusNuevo) {
        await tx.reporte.update({
          where: { id: reporteId },
          data: { estatus: s.estatusNuevo, cerradoEn: s.estatusNuevo === 'cerrado' ? new Date() : null },
        });
      }
      return seguimiento.id;
    });
  }

  async sitioParaReportar(sitioId: number, guardia: { usuarioId: number; hoy: string } | null) {
    return getPrisma().sitio.findFirst({
      where: { id: sitioId, ...sitioReportableWhere(guardia) },
      select: { id: true, clienteId: true },
    });
  }

  async sitiosReportables(guardia: { usuarioId: number; hoy: string } | null) {
    return getPrisma().sitio.findMany({
      where: sitioReportableWhere(guardia),
      select: {
        id: true,
        nombre: true,
        direccion: true,
        cliente: { select: { id: true, nombreComercial: true } },
      },
      orderBy: [{ cliente: { nombreComercial: 'asc' } }, { nombre: 'asc' }],
      take: 500,
    });
  }

  async categoriaActiva(id: number) {
    // La subcategoría y su principal deben estar activas.
    const n = await getPrisma().categoriaReporte.count({
      where: { id, activo: true, OR: [{ padreId: null }, { padre: { activo: true } }] },
    });
    return n > 0;
  }
}
