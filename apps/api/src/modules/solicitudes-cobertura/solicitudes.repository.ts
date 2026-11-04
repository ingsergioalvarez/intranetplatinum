import type { EstadoSolicitud, SolicitudCobertura } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { adminsDe, type ContextoDueno } from '../avisos/duenos';
import { empresaActual } from '../../core/empresa/contexto';

export interface NuevaSolicitud {
  sitioId: number;
  solicitanteId: number;
  guardiaId: number | null;
  fecha: string;
  motivo: string;
}

export type SolicitudRow = Omit<SolicitudCobertura, 'createdAt' | 'cerradaEn'> & {
  /** Admin dueño del cliente del sitio (A-66). */
  sitioDueno: number | null;
  createdAt: Date;
  cerradaEn: Date | null;
  recordadaEn: Date | null;
};

export interface CierreSolicitud {
  estado: Exclude<EstadoSolicitud, 'pendiente'>;
  cerradaEn: Date;
  cerradaPor: string | null;
  resolucion: string;
  coberturaId?: number | null;
}

/** Acceso a datos de las solicitudes de cobertura (A-39). */
export abstract class SolicitudesRepository {
  abstract crear(d: NuevaSolicitud): Promise<SolicitudRow>;
  abstract findById(id: number): Promise<SolicitudRow | null>;
  /**
   * Todas (super admin), solo las de ese solicitante o, con `cartera`, las de los clientes de ese admin (A-66); las
   * pendientes primero y lo más nuevo arriba.
   */
  abstract listar(solicitanteId: number | null, limite: number, cartera?: number): Promise<SolicitudRow[]>;
  /** Pendientes de un sitio. */
  abstract pendientesDelSitio(sitioId: number): Promise<SolicitudRow[]>;
  abstract cerrar(id: number, c: CierreSolicitud): Promise<void>;
  /** Pendientes que llevan tiempo sin atenderse y toca recordarlas. */
  abstract porRecordar(creadasAntes: Date, recordadasAntes: Date): Promise<SolicitudRow[]>;
  abstract marcarRecordada(id: number, en: Date): Promise<void>;
  /** Usuarios admin activos. */
  abstract admins(contexto?: ContextoDueno): Promise<number[]>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
}

const select = {
  id: true,
  estado: true,
  fecha: true,
  motivo: true,
  createdAt: true,
  cerradaEn: true,
  cerradaPor: true,
  resolucion: true,
  recordadaEn: true,
  sitio: { select: { id: true, nombre: true, cliente: { select: { propietarioId: true } } } },
  solicitante: { select: { id: true, nombre: true } },
  guardia: { select: { id: true, nombre: true } },
} as const;

type Fila = {
  id: number;
  estado: string;
  fecha: Date;
  motivo: string;
  createdAt: Date;
  cerradaEn: Date | null;
  cerradaPor: string | null;
  resolucion: string | null;
  recordadaEn: Date | null;
  sitio: { id: number; nombre: string; cliente: { propietarioId: number | null } };
  solicitante: { id: number; nombre: string };
  guardia: { id: number; nombre: string } | null;
};

const aRow = ({ sitio, ...r }: Fila): SolicitudRow => ({
  ...r,
  sitio: { id: sitio.id, nombre: sitio.nombre },
  sitioDueno: sitio.cliente.propietarioId,
  estado: r.estado as EstadoSolicitud,
  fecha: dateAFecha(r.fecha),
});

export class PrismaSolicitudesRepository extends SolicitudesRepository {
  async crear(d: NuevaSolicitud) {
    const r = await getPrisma().solicitudCobertura.create({
      data: { empresaId: empresaActual(), ...d, fecha: fechaADate(d.fecha), motivo: d.motivo.slice(0, 255) },
      select,
    });
    return aRow(r);
  }

  async findById(id: number) {
    const r = await getPrisma().solicitudCobertura.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async listar(solicitanteId: number | null, limite: number, cartera?: number) {
    const rows = await getPrisma().solicitudCobertura.findMany({
      where: {
        ...(solicitanteId ? { solicitanteId } : {}),
        ...(cartera !== undefined && { sitio: { cliente: { propietarioId: cartera } } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select,
    });
    // Las pendientes primero; dentro de cada grupo, lo más nuevo arriba.
    return rows.map(aRow).sort((a, b) => Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente'));
  }

  async pendientesDelSitio(sitioId: number) {
    const rows = await getPrisma().solicitudCobertura.findMany({ where: { sitioId, estado: 'pendiente' }, select });
    return rows.map(aRow);
  }

  async cerrar(id: number, c: CierreSolicitud) {
    await getPrisma().solicitudCobertura.update({
      where: { id },
      data: {
        estado: c.estado,
        cerradaEn: c.cerradaEn,
        cerradaPor: c.cerradaPor,
        resolucion: c.resolucion.slice(0, 255),
        coberturaId: c.coberturaId ?? null,
      },
    });
  }

  async porRecordar(creadasAntes: Date, recordadasAntes: Date) {
    const rows = await getPrisma().solicitudCobertura.findMany({
      where: {
        estado: 'pendiente',
        createdAt: { lte: creadasAntes },
        OR: [{ recordadaEn: null }, { recordadaEn: { lte: recordadasAntes } }],
      },
      select,
    });
    return rows.map(aRow);
  }

  async marcarRecordada(id: number, en: Date) {
    await getPrisma().solicitudCobertura.update({ where: { id }, data: { recordadaEn: en } });
  }

  admins(contexto?: ContextoDueno) {
    return adminsDe(contexto);
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }
}
