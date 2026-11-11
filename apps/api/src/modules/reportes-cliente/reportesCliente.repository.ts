import type {
  EstatusReporteCliente,
  OpcionesReporteCliente,
  ReporteCliente,
  TipoReporteCliente,
} from '@platinum/shared';
import { fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe, type ContextoDueno } from '../avisos/duenos';
import { vigenteEn } from '../clientes/clientes.repository';

/** Quién puede ver cuáles reportes del cliente (A-59). */
export type VisibilidadReporteCliente =
  | { tipo: 'todos' }
  /** Admin: los de los clientes de los que es dueño. */
  | { tipo: 'cartera'; propietarioId: number }
  /** Supervisor: los de sus sitios. */
  | { tipo: 'supervisor'; usuarioId: number }
  /** Cliente: los de su empresa. */
  | { tipo: 'cliente'; clienteId: number };

/** Foto tal como está en BD (el servicio la convierte a URL firmada). */
export interface FotoReporteClienteRow {
  id: number;
  archivo: string;
}

export interface FotoNueva {
  archivo: string;
  mime: string;
  tamano: number;
}

export type ReporteClienteRow = Omit<ReporteCliente, 'createdAt' | 'atendidoEn' | 'fotos'> & {
  createdAt: Date;
  atendidoEn: Date | null;
  fotos: FotoReporteClienteRow[];
};

export interface NuevoReporteCliente {
  clienteId: number;
  sitioId: number;
  guardiaId: number | null;
  creadoPorId: number;
  tipo: TipoReporteCliente;
  urgente: boolean;
  asunto: string;
  descripcion: string;
  /** Fotos ya guardadas en el almacenamiento (A-67). */
  fotos: FotoNueva[];
}

export interface AtencionReporteCliente {
  estatus: Exclude<EstatusReporteCliente, 'abierto'>;
  atendidoEn: Date;
  atendidoPor: string | null;
  respuesta: string | null;
}

export interface SitioDeCliente {
  id: number;
  nombre: string;
  /** Supervisor activo del sitio, si tiene. */
  supervisorId: number | null;
}

/** Acceso a datos de los reportes del cliente (A-59). */
export abstract class ReportesClienteRepository {
  abstract crear(d: NuevoReporteCliente): Promise<ReporteClienteRow>;
  abstract findById(id: number, v: VisibilidadReporteCliente): Promise<ReporteClienteRow | null>;
  /** Lo más nuevo primero. */
  abstract listar(v: VisibilidadReporteCliente, limite: number): Promise<ReporteClienteRow[]>;
  abstract atender(id: number, a: AtencionReporteCliente): Promise<void>;
  /** Sitios del cliente con los guardias que tienen hoy (asignados o cubriendo). */
  abstract opciones(clienteId: number, hoy: string): Promise<OpcionesReporteCliente>;
  /** El sitio, si es de ese cliente y no está dado de baja. */
  abstract sitioDelCliente(sitioId: number, clienteId: number): Promise<SitioDeCliente | null>;
  /** El guardia, si estuvo asignado o cubriendo ese sitio en el último mes (puede haber cambiado de sitio hace poco). */
  abstract guardiaReciente(sitioId: number, guardiaId: number, hoy: string): Promise<{ id: number; nombre: string } | null>;
  abstract adminsDe(contexto: ContextoDueno): Promise<number[]>;
  abstract superAdmins(): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
}

/** Días hacia atrás en que un guardia sigue contando como "del sitio" para reportarlo. */
const DIAS_RECIENTES = 31;

const select = {
  id: true,
  tipo: true,
  urgente: true,
  asunto: true,
  descripcion: true,
  estatus: true,
  createdAt: true,
  atendidoEn: true,
  atendidoPor: true,
  respuesta: true,
  sitio: { select: { id: true, nombre: true } },
  cliente: { select: { id: true, nombreComercial: true } },
  guardia: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  fotos: { select: { id: true, archivo: true }, orderBy: { id: 'asc' } },
} as const;

const dondeVisible = (v: VisibilidadReporteCliente) => {
  switch (v.tipo) {
    case 'todos':
      return {};
    case 'cartera':
      return { cliente: { propietarioId: v.propietarioId } };
    case 'supervisor':
      return { sitio: { supervisorId: v.usuarioId } };
    case 'cliente':
      return { clienteId: v.clienteId };
  }
};

const activo = { activo: true, deletedAt: null } as const;
type Persona = { id: number; nombre: string; activo: boolean; deletedAt: Date | null };
const personaSelect = { id: true, nombre: true, activo: true, deletedAt: true } as const;
const vigente = (p: Persona | null) => (p && p.activo && !p.deletedAt ? { id: p.id, nombre: p.nombre } : null);

export class PrismaReportesClienteRepository extends ReportesClienteRepository {
  async crear({ fotos, ...d }: NuevoReporteCliente) {
    return getPrisma().reporteCliente.create({ data: { ...d, fotos: { create: fotos } }, select });
  }

  findById(id: number, v: VisibilidadReporteCliente) {
    return getPrisma().reporteCliente.findFirst({ where: { id, ...dondeVisible(v) }, select });
  }

  async listar(v: VisibilidadReporteCliente, limite: number) {
    return getPrisma().reporteCliente.findMany({
      where: dondeVisible(v),
      orderBy: { createdAt: 'desc' },
      take: limite,
      select,
    });
  }

  async atender(id: number, a: AtencionReporteCliente) {
    await getPrisma().reporteCliente.update({ where: { id }, data: a });
  }

  async opciones(clienteId: number, hoy: string): Promise<OpcionesReporteCliente> {
    const db = getPrisma();
    const sitios = await db.sitio.findMany({
      where: { clienteId, deletedAt: null },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    const ids = sitios.map((s) => s.id);
    const d = fechaADate(hoy);
    const [asigs, coberturas] = await Promise.all([
      db.sitioGuardia.findMany({
        where: { sitioId: { in: ids }, ...vigenteEn(hoy) },
        select: {
          sitioId: true,
          usuario: { select: personaSelect },
          grupo: { select: { deletedAt: true, integrantes: { select: { usuario: { select: personaSelect } } } } },
        },
      }),
      db.cobertura.findMany({
        where: { sitioId: { in: ids }, canceladaEn: null, desde: { lte: d }, hasta: { gte: d } },
        select: { sitioId: true, usuario: { select: personaSelect } },
      }),
    ]);
    const porSitio = new Map<number, Map<number, string>>();
    const sumar = (sitioId: number, p: Persona | null) => {
      const g = vigente(p);
      if (g) porSitio.set(sitioId, (porSitio.get(sitioId) ?? new Map()).set(g.id, g.nombre));
    };
    for (const a of asigs) {
      sumar(a.sitioId, a.usuario);
      if (a.grupo && !a.grupo.deletedAt) for (const i of a.grupo.integrantes) sumar(a.sitioId, i.usuario);
    }
    for (const c of coberturas) sumar(c.sitioId, c.usuario);
    return {
      sitios: sitios.map((s) => ({
        ...s,
        guardias: [...(porSitio.get(s.id) ?? [])]
          .map(([id, nombre]) => ({ id, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      })),
    };
  }

  async sitioDelCliente(sitioId: number, clienteId: number) {
    const s = await getPrisma().sitio.findFirst({
      where: { id: sitioId, clienteId, deletedAt: null },
      select: { id: true, nombre: true, supervisor: { select: personaSelect } },
    });
    return s && { id: s.id, nombre: s.nombre, supervisorId: vigente(s.supervisor)?.id ?? null };
  }

  async guardiaReciente(sitioId: number, guardiaId: number, hoy: string) {
    const db = getPrisma();
    const g = await db.usuario.findFirst({
      where: { id: guardiaId, ...activo, rol: { clave: 'guardia' } },
      select: { id: true, nombre: true },
    });
    if (!g) return null;
    const hoyD = fechaADate(hoy);
    const desde = new Date(hoyD.getTime() - DIAS_RECIENTES * 86_400_000);
    const [asignado, cubriendo] = await Promise.all([
      db.sitioGuardia.count({
        where: {
          sitioId,
          desde: { lte: hoyD },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }],
          AND: [{ OR: [{ usuarioId: guardiaId }, { grupo: { deletedAt: null, integrantes: { some: { usuarioId: guardiaId } } } }] }],
        },
      }),
      db.cobertura.count({ where: { sitioId, usuarioId: guardiaId, canceladaEn: null, hasta: { gte: desde } } }),
    ]);
    return asignado + cubriendo > 0 ? g : null;
  }

  adminsDe(contexto: ContextoDueno) {
    return adminsDe(contexto);
  }

  async superAdmins() {
    const rows = await getPrisma().usuario.findMany({ where: { esSuperAdmin: true, ...activo }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }
}
