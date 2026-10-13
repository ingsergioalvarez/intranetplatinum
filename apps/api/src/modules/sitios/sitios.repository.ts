import type { Asignacion, MiSitio, Rol, Turno } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma, TurnoGuardia } from '../../generated/prisma/client';
import { vigenteEn } from '../clientes/clientes.repository';

export interface SitioEstado {
  id: number;
  clienteId: number;
  deletedAt: Date | null;
  clienteDeBaja: boolean;
}

export interface GuardiaEstado {
  id: number;
  nombre: string;
  rol: Rol;
  deletedAt: Date | null;
}

export interface AsignacionData {
  sitioId: number;
  usuarioId: number;
  turno: Turno;
  desde: string;
  hasta?: string | null;
}

/** Asignaciones de guardias a sitios (F2-05). Fechas `AAAA-MM-DD`. */
export abstract class SitiosRepository {
  abstract findSitio(id: number): Promise<SitioEstado | null>;
  abstract findGuardia(usuarioId: number): Promise<GuardiaEstado | null>;
  /** Vigentes y programadas; con `incluirTerminadas` también el historial. */
  abstract listAsignaciones(sitioId: number, hoy: string, incluirTerminadas: boolean): Promise<Asignacion[]>;
  abstract findAsignacion(id: number, hoy: string): Promise<Asignacion | null>;
  /** ¿El guardia ya tiene en el sitio una asignación que se cruce con [desde, hasta]? */
  abstract haySolape(data: AsignacionData, excluirId?: number): Promise<boolean>;
  abstract createAsignacion(data: AsignacionData, hoy: string): Promise<Asignacion>;
  abstract updateAsignacion(id: number, data: { turno?: Turno; hasta?: string | null }): Promise<void>;
  /** Sitios con asignación vigente hoy del guardia (sitio y cliente activos). */
  abstract misSitios(usuarioId: number, hoy: string): Promise<MiSitio[]>;
}

// La BD guarda `24x24` como `t24x24` en el enum de Prisma.
const turnoADb = (t: Turno) => (t === '24x24' ? 't24x24' : t) as TurnoGuardia;
const turnoDeDb = (t: TurnoGuardia) => (t === 't24x24' ? '24x24' : t) as Turno;

const asignacionSelect = {
  id: true,
  sitioId: true,
  usuarioId: true,
  turno: true,
  desde: true,
  hasta: true,
  usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
} satisfies Prisma.SitioGuardiaSelect;

type AsignacionRow = Prisma.SitioGuardiaGetPayload<{ select: typeof asignacionSelect }>;

function toAsignacion({ usuario, turno, desde, hasta, ...a }: AsignacionRow, hoy: string): Asignacion {
  const d = dateAFecha(desde);
  const h = hasta ? dateAFecha(hasta) : null;
  return {
    ...a,
    guardia: usuario,
    turno: turnoDeDb(turno),
    desde: d,
    hasta: h,
    vigente: d <= hoy && (h === null || h >= hoy),
  };
}

export class PrismaSitiosRepository extends SitiosRepository {
  async findSitio(id: number) {
    const s = await getPrisma().sitio.findUnique({
      where: { id },
      select: { id: true, clienteId: true, deletedAt: true, cliente: { select: { deletedAt: true } } },
    });
    return (
      s && { id: s.id, clienteId: s.clienteId, deletedAt: s.deletedAt, clienteDeBaja: !!s.cliente.deletedAt }
    );
  }

  async findGuardia(usuarioId: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, deletedAt: true, rol: { select: { clave: true } } },
    });
    return u && { id: u.id, nombre: u.nombre, deletedAt: u.deletedAt, rol: u.rol.clave as Rol };
  }

  async listAsignaciones(sitioId: number, hoy: string, incluirTerminadas: boolean) {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        sitioId,
        ...(!incluirTerminadas && { OR: [{ hasta: null }, { hasta: { gte: fechaADate(hoy) } }] }),
      },
      select: asignacionSelect,
      orderBy: [{ desde: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => toAsignacion(r, hoy));
  }

  async findAsignacion(id: number, hoy: string) {
    const a = await getPrisma().sitioGuardia.findUnique({ where: { id }, select: asignacionSelect });
    return a && toAsignacion(a, hoy);
  }

  async haySolape({ sitioId, usuarioId, desde, hasta }: AsignacionData, excluirId?: number) {
    const n = await getPrisma().sitioGuardia.count({
      where: {
        sitioId,
        usuarioId,
        ...(excluirId && { id: { not: excluirId } }),
        // Se cruzan si: existente.desde <= nueva.hasta  y  existente.hasta >= nueva.desde
        ...(hasta && { desde: { lte: fechaADate(hasta) } }),
        OR: [{ hasta: null }, { hasta: { gte: fechaADate(desde) } }],
      },
    });
    return n > 0;
  }

  async createAsignacion({ turno, desde, hasta, ...data }: AsignacionData, hoy: string) {
    const a = await getPrisma().sitioGuardia.create({
      data: {
        ...data,
        turno: turnoADb(turno),
        desde: fechaADate(desde),
        hasta: hasta ? fechaADate(hasta) : null,
      },
      select: asignacionSelect,
    });
    return toAsignacion(a, hoy);
  }

  async updateAsignacion(id: number, { turno, hasta }: { turno?: Turno; hasta?: string | null }) {
    await getPrisma().sitioGuardia.update({
      where: { id },
      data: {
        ...(turno && { turno: turnoADb(turno) }),
        ...(hasta !== undefined && { hasta: hasta ? fechaADate(hasta) : null }),
      },
    });
  }

  async misSitios(usuarioId: number, hoy: string): Promise<MiSitio[]> {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        usuarioId,
        ...vigenteEn(hoy),
        sitio: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } },
      },
      select: {
        id: true,
        turno: true,
        desde: true,
        hasta: true,
        sitio: {
          select: {
            id: true,
            nombre: true,
            direccion: true,
            referencias: true,
            lat: true,
            lng: true,
            cliente: { select: { id: true, nombreComercial: true } },
          },
        },
      },
      orderBy: { sitio: { nombre: 'asc' } },
    });
    return rows.map(({ id, turno, desde, hasta, sitio: { cliente, lat, lng, ...sitio } }) => ({
      asignacionId: id,
      turno: turnoDeDb(turno),
      desde: dateAFecha(desde),
      hasta: hasta ? dateAFecha(hasta) : null,
      sitio: { ...sitio, lat: lat === null ? null : Number(lat), lng: lng === null ? null : Number(lng) },
      cliente,
    }));
  }
}
