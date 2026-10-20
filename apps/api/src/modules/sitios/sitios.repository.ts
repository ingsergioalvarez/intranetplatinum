import type { Asignacion, MiSitio, Rol, TipoAsignacion, Turno } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma, TurnoGuardia } from '../../generated/prisma/client';
import { asignadaA } from '../clientes/clientes.repository';

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

export interface GrupoEstado {
  id: number;
  nombre: string;
  deletedAt: Date | null;
}

/** Asignación a guardar (fechas `AAAA-MM-DD`). Exactamente uno de usuarioId / grupoId. */
export interface AsignacionData {
  sitioId: number;
  usuarioId?: number | null;
  grupoId?: number | null;
  tipo: TipoAsignacion;
  turno?: Turno | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  desde: string;
  hasta?: string | null;
  vigenteHasta: string | null;
}

/** Rango a revisar para solapes del mismo guardia o grupo en el mismo sitio. */
export interface RangoAsignacion {
  sitioId: number;
  usuarioId?: number | null;
  grupoId?: number | null;
  desde: string;
  vigenteHasta: string | null;
}

/** Asignaciones de sitios a guardias o grupos (F2-05, F2-07). */
export abstract class SitiosRepository {
  abstract findSitio(id: number): Promise<SitioEstado | null>;
  abstract findGuardia(usuarioId: number): Promise<GuardiaEstado | null>;
  abstract findGrupo(grupoId: number): Promise<GrupoEstado | null>;
  /** Vigentes y programadas; con `incluirTerminadas` también el historial. */
  abstract listAsignaciones(sitioId: number, hoy: string, incluirTerminadas: boolean): Promise<Asignacion[]>;
  abstract findAsignacion(
    id: number,
    hoy: string,
  ): Promise<(Asignacion & { vigenteHasta: string | null }) | null>;
  abstract haySolape(rango: RangoAsignacion, excluirId?: number): Promise<boolean>;
  abstract createAsignacion(data: AsignacionData, hoy: string): Promise<Asignacion>;
  abstract updateAsignacion(
    id: number,
    data: { turno?: Turno; hasta?: string | null; vigenteHasta?: string | null },
  ): Promise<void>;
  /** Sitios con asignación vigente hoy, directa o por grupo (sitio y cliente activos). */
  abstract misSitios(usuarioId: number, hoy: string): Promise<MiSitio[]>;
}

// La BD guarda `24x24` como `t24x24` en el enum de Prisma.
const turnoADb = (t: Turno) => (t === '24x24' ? 't24x24' : t) as TurnoGuardia;
const turnoDeDb = (t: TurnoGuardia | null) => (t === 't24x24' ? '24x24' : t) as Turno | null;
const fecha = (d: Date | null) => (d ? dateAFecha(d) : null);

const asignacionSelect = {
  id: true,
  sitioId: true,
  tipo: true,
  turno: true,
  horaInicio: true,
  horaFin: true,
  desde: true,
  hasta: true,
  vigenteHasta: true,
  usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
  grupo: { select: { id: true, nombre: true, _count: { select: { integrantes: true } } } },
} satisfies Prisma.SitioGuardiaSelect;

type AsignacionRow = Prisma.SitioGuardiaGetPayload<{ select: typeof asignacionSelect }>;

function toAsignacion(
  { usuario, grupo, turno, desde, hasta, vigenteHasta, ...a }: AsignacionRow,
  hoy: string,
): Asignacion & { vigenteHasta: string | null } {
  const d = dateAFecha(desde);
  const vh = fecha(vigenteHasta);
  return {
    ...a,
    guardia: usuario,
    grupo: grupo && { id: grupo.id, nombre: grupo.nombre, integrantes: grupo._count.integrantes },
    turno: turnoDeDb(turno),
    desde: d,
    hasta: fecha(hasta),
    vigenteHasta: vh,
    vigente: d <= hoy && (vh === null || vh >= hoy),
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

  findGrupo(grupoId: number) {
    return getPrisma().grupoGuardias.findUnique({
      where: { id: grupoId },
      select: { id: true, nombre: true, deletedAt: true },
    });
  }

  async listAsignaciones(sitioId: number, hoy: string, incluirTerminadas: boolean) {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        sitioId,
        ...(!incluirTerminadas && {
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaADate(hoy) } }],
        }),
      },
      select: asignacionSelect,
      orderBy: [{ desde: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => {
      const { vigenteHasta: _vh, ...a } = toAsignacion(r, hoy);
      return a;
    });
  }

  async findAsignacion(id: number, hoy: string) {
    const a = await getPrisma().sitioGuardia.findUnique({ where: { id }, select: asignacionSelect });
    return a && toAsignacion(a, hoy);
  }

  async haySolape({ sitioId, usuarioId, grupoId, desde, vigenteHasta }: RangoAsignacion, excluirId?: number) {
    const n = await getPrisma().sitioGuardia.count({
      where: {
        sitioId,
        ...(usuarioId ? { usuarioId } : { grupoId }),
        ...(excluirId && { id: { not: excluirId } }),
        // Se cruzan si: existente.desde <= nueva.fin  y  existente.fin >= nueva.desde
        ...(vigenteHasta && { desde: { lte: fechaADate(vigenteHasta) } }),
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaADate(desde) } }],
      },
    });
    return n > 0;
  }

  async createAsignacion({ turno, desde, hasta, vigenteHasta, ...data }: AsignacionData, hoy: string) {
    const a = await getPrisma().sitioGuardia.create({
      data: {
        ...data,
        usuarioId: data.usuarioId ?? null,
        grupoId: data.grupoId ?? null,
        turno: turno ? turnoADb(turno) : null,
        horaInicio: data.horaInicio ?? null,
        horaFin: data.horaFin ?? null,
        desde: fechaADate(desde),
        hasta: hasta ? fechaADate(hasta) : null,
        vigenteHasta: vigenteHasta ? fechaADate(vigenteHasta) : null,
      },
      select: asignacionSelect,
    });
    const { vigenteHasta: _vh, ...asignacion } = toAsignacion(a, hoy);
    return asignacion;
  }

  async updateAsignacion(
    id: number,
    { turno, hasta, vigenteHasta }: { turno?: Turno; hasta?: string | null; vigenteHasta?: string | null },
  ) {
    await getPrisma().sitioGuardia.update({
      where: { id },
      data: {
        ...(turno && { turno: turnoADb(turno) }),
        ...(hasta !== undefined && { hasta: hasta ? fechaADate(hasta) : null }),
        ...(vigenteHasta !== undefined && { vigenteHasta: vigenteHasta ? fechaADate(vigenteHasta) : null }),
      },
    });
  }

  async misSitios(usuarioId: number, hoy: string): Promise<MiSitio[]> {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        AND: [
          asignadaA(usuarioId, hoy),
          { sitio: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } } },
        ],
      },
      select: {
        id: true,
        tipo: true,
        turno: true,
        horaInicio: true,
        horaFin: true,
        desde: true,
        hasta: true,
        grupo: { select: { nombre: true } },
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
      // Directas primero: si el sitio llega por guardia y por grupo, se muestra la directa.
      orderBy: [{ sitio: { nombre: 'asc' } }, { grupoId: 'asc' }],
    });

    const vistos = new Set<number>();
    return rows
      .filter((r) => (vistos.has(r.sitio.id) ? false : (vistos.add(r.sitio.id), true)))
      .map(
        ({
          id,
          tipo,
          turno,
          horaInicio,
          horaFin,
          desde,
          hasta,
          grupo,
          sitio: { cliente, lat, lng, ...sitio },
        }) => ({
          asignacionId: id,
          tipo,
          grupo: grupo?.nombre ?? null,
          turno: turnoDeDb(turno),
          horaInicio,
          horaFin,
          desde: dateAFecha(desde),
          hasta: fecha(hasta),
          sitio: { ...sitio, lat: lat === null ? null : Number(lat), lng: lng === null ? null : Number(lng) },
          cliente,
        }),
      );
  }
}
