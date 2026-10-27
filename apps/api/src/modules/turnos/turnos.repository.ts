import { horaSalida, type DiasTurno, type TurnoCatalogo, type TurnoData } from '@platinum/shared';
import { fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { diasADb, diasDeDb, diasSelect, type DiasDb } from './dias';

/** Asignación que usa un turno (para copiarle el horario nuevo y avisar a sus guardias). */
export interface UsoDelTurno {
  asignacionId: number;
  sitio: string;
  usuarioId: number | null;
  /** Integrantes activos si la asignación es de un grupo. */
  integrantes: number[];
  grupo: string | null;
}

/** Una asignación que usa el turno, con su sitio (para decir a dónde está asignado). */
export interface UsoDetalle {
  asignacionId: number;
  sitio: { id: number; nombre: string; supervisorId: number | null };
  /** Sitio y cliente activos. */
  activo: boolean;
  /** Nombre del guardia o del grupo. */
  asignado: string;
  usuarioId: number | null;
  integrantes: number[];
}

/** Horario de un turno (lo que se copia a sus asignaciones). */
export interface HorarioTurno {
  horas: number;
  horaEntrada: string;
  dias: DiasTurno;
}

/** Catálogo de turnos (DA-37). */
export abstract class TurnosRepository {
  abstract listar(hoy: string): Promise<TurnoCatalogo[]>;
  abstract findById(id: number, hoy: string): Promise<TurnoCatalogo | null>;
  abstract nombreOcupado(nombre: string, excluirId?: number): Promise<boolean>;
  abstract crear(data: TurnoData): Promise<number>;
  abstract actualizar(id: number, data: TurnoData): Promise<void>;
  abstract setActivo(id: number, activo: boolean): Promise<void>;
  /** Asignaciones vigentes o programadas que usan el turno. */
  abstract usos(id: number, hoy: string): Promise<UsoDelTurno[]>;
  /** Asignaciones vigentes o programadas que usan el turno, con su sitio. */
  abstract usosDetalle(id: number, hoy: string): Promise<UsoDetalle[]>;
  /** Pasa las asignaciones de un sitio de este turno a otro (con el horario del nuevo). */
  abstract reasignar(id: number, hoy: string, sitioId: number, nuevo: TurnoCatalogo): Promise<void>;
  /** Copia el horario del turno a sus asignaciones vigentes o programadas. */
  abstract copiarHorario(id: number, hoy: string, horario: HorarioTurno): Promise<void>;
  /**
   * Borra el turno del catálogo. Sus asignaciones siguen con su copia del horario (quedan "sin
   * turno del catálogo").
   */
  abstract eliminar(id: number): Promise<void>;
}

const vigentes = (hoy: string) => ({
  OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaADate(hoy) } }],
});

const select = (hoy: string) => ({
  id: true,
  nombre: true,
  horas: true,
  horaEntrada: true,
  activo: true,
  ...diasSelect,
  _count: { select: { asignaciones: { where: vigentes(hoy) } } },
});

function toTurno(
  t: DiasDb & {
    id: number;
    nombre: string;
    horas: number;
    horaEntrada: string;
    activo: boolean;
    _count: { asignaciones: number };
  },
): TurnoCatalogo {
  return {
    id: t.id,
    nombre: t.nombre,
    horas: t.horas,
    horaEntrada: t.horaEntrada,
    horaSalida: horaSalida(t.horas, t.horaEntrada),
    dias: diasDeDb(t) ?? { tipo: 'diario' },
    activo: t.activo,
    enUso: t._count.asignaciones,
  };
}

export class PrismaTurnosRepository extends TurnosRepository {
  async listar(hoy: string) {
    const rows = await getPrisma().turno.findMany({
      orderBy: [{ activo: 'desc' }, { horaEntrada: 'asc' }, { nombre: 'asc' }],
      select: select(hoy),
    });
    return rows.map(toTurno);
  }

  async findById(id: number, hoy: string) {
    const t = await getPrisma().turno.findUnique({ where: { id }, select: select(hoy) });
    return t && toTurno(t);
  }

  async nombreOcupado(nombre: string, excluirId?: number) {
    const n = await getPrisma().turno.count({
      where: { nombre, ...(excluirId && { id: { not: excluirId } }) },
    });
    return n > 0;
  }

  async crear({ dias, ...data }: TurnoData) {
    const { id } = await getPrisma().turno.create({
      data: { ...data, ...diasADb(dias), diasTipo: diasADb(dias).diasTipo! },
      select: { id: true },
    });
    return id;
  }

  async actualizar(id: number, { dias, ...data }: TurnoData) {
    await getPrisma().turno.update({
      where: { id },
      data: { ...data, ...diasADb(dias), diasTipo: diasADb(dias).diasTipo! },
    });
  }

  async setActivo(id: number, activo: boolean) {
    await getPrisma().turno.update({ where: { id }, data: { activo } });
  }

  async usos(id: number, hoy: string) {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: { turnoId: id, ...vigentes(hoy) },
      select: {
        id: true,
        usuarioId: true,
        sitio: { select: { nombre: true } },
        grupo: {
          select: {
            nombre: true,
            integrantes: {
              where: { usuario: { activo: true, deletedAt: null } },
              select: { usuarioId: true },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      asignacionId: r.id,
      sitio: r.sitio.nombre,
      usuarioId: r.usuarioId,
      integrantes: r.grupo?.integrantes.map((i) => i.usuarioId) ?? [],
      grupo: r.grupo?.nombre ?? null,
    }));
  }

  async usosDetalle(id: number, hoy: string) {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: { turnoId: id, ...vigentes(hoy) },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { nombre: true } },
        sitio: {
          select: {
            id: true,
            nombre: true,
            supervisorId: true,
            deletedAt: true,
            cliente: { select: { deletedAt: true, estatus: true } },
          },
        },
        grupo: {
          select: {
            nombre: true,
            integrantes: { where: { usuario: { activo: true, deletedAt: null } }, select: { usuarioId: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      asignacionId: r.id,
      sitio: { id: r.sitio.id, nombre: r.sitio.nombre, supervisorId: r.sitio.supervisorId },
      activo: !r.sitio.deletedAt && !r.sitio.cliente.deletedAt && r.sitio.cliente.estatus === 'activo',
      asignado: r.usuario?.nombre ?? r.grupo?.nombre ?? 'Sin nombre',
      usuarioId: r.usuarioId,
      integrantes: r.grupo?.integrantes.map((i) => i.usuarioId) ?? [],
    }));
  }

  async reasignar(id: number, hoy: string, sitioId: number, nuevo: TurnoCatalogo) {
    await getPrisma().sitioGuardia.updateMany({
      where: { turnoId: id, sitioId, ...vigentes(hoy) },
      data: {
        turnoId: nuevo.id,
        horas: nuevo.horas,
        horaInicio: nuevo.horaEntrada,
        horaFin: horaSalida(nuevo.horas, nuevo.horaEntrada),
        ...diasADb(nuevo.dias),
        turno: null,
      },
    });
  }

  async copiarHorario(id: number, hoy: string, { horas, horaEntrada, dias }: HorarioTurno) {
    await getPrisma().sitioGuardia.updateMany({
      where: { turnoId: id, ...vigentes(hoy) },
      data: {
        horas,
        horaInicio: horaEntrada,
        horaFin: horaSalida(horas, horaEntrada),
        ...diasADb(dias),
        turno: null,
      },
    });
  }

  async eliminar(id: number) {
    // La FK de las asignaciones queda en null (ON DELETE SET NULL): conservan su copia del horario.
    await getPrisma().turno.delete({ where: { id } });
  }
}
