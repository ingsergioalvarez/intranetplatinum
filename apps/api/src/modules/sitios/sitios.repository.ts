import type {
  Asignacion,
  AsignacionDeGuardia,
  DiasTurno,
  MiSitio,
  Rol,
  SupervisorOpcion,
  TipoAsignacion,
  Turno,
} from '@platinum/shared';
import { ROLES } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma, TurnoGuardia } from '../../generated/prisma/client';
import { asignadaA } from '../clientes/clientes.repository';
import { diasADb, diasDeDb, diasSelect } from '../turnos/dias';

export interface SitioEstado {
  id: number;
  nombre: string;
  clienteId: number;
  deletedAt: Date | null;
  clienteDeBaja: boolean;
  supervisorId: number | null;
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

/** Turno del catálogo (DA-37). */
export interface TurnoEstado {
  id: number;
  nombre: string;
  horas: number;
  horaEntrada: string;
  dias: DiasTurno;
  activo: boolean;
}

export type { AsignacionDeGuardia };

export interface GuardiaConFoto {
  id: number;
  nombre: string;
  email: string;
  fotoClave: string | null;
}

/** Asignación a guardar (fechas `AAAA-MM-DD`). Exactamente uno de usuarioId / grupoId. */
export interface AsignacionData {
  sitioId: number;
  usuarioId?: number | null;
  grupoId?: number | null;
  turnoId?: number | null;
  /** Copia del horario del turno del catálogo. */
  horas?: number | null;
  dias?: DiasTurno | null;
  tipo: TipoAsignacion;
  turno?: Turno | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  desde: string;
  hasta?: string | null;
  vigenteHasta: string | null;
}

export interface CambioAsignacion {
  turnoId?: number;
  horas?: number;
  dias?: DiasTurno;
  turno?: Turno | null;
  horaInicio?: string;
  horaFin?: string;
  hasta?: string | null;
  vigenteHasta?: string | null;
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
  /** Supervisores activos con cuántos sitios tienen (DA-45). */
  abstract supervisores(): Promise<SupervisorOpcion[]>;
  abstract setSupervisor(sitioId: number, supervisorId: number | null): Promise<void>;
  abstract findGuardia(usuarioId: number): Promise<GuardiaEstado | null>;
  abstract findGrupo(grupoId: number): Promise<GrupoEstado | null>;
  /** Guardias activos del grupo (para avisarles). */
  abstract integrantesGrupo(grupoId: number): Promise<number[]>;
  /** Vigentes y programadas; con `incluirTerminadas` también el historial. */
  abstract listAsignaciones(sitioId: number, hoy: string, incluirTerminadas: boolean): Promise<Asignacion[]>;
  abstract findAsignacion(
    id: number,
    hoy: string,
  ): Promise<(Asignacion & { vigenteHasta: string | null }) | null>;
  abstract haySolape(rango: RangoAsignacion, excluirId?: number): Promise<boolean>;
  abstract createAsignacion(data: AsignacionData, hoy: string): Promise<Asignacion>;
  abstract updateAsignacion(id: number, data: CambioAsignacion): Promise<void>;
  /** Sitios con asignación vigente hoy, directa o por grupo (sitio y cliente activos). */
  abstract misSitios(usuarioId: number, hoy: string): Promise<MiSitio[]>;
  abstract findTurno(id: number): Promise<TurnoEstado | null>;
  /** Asignaciones vigentes o programadas de cada guardia, directas o por sus grupos. */
  abstract asignacionesDeGuardias(
    usuarioIds: number[],
    hoy: string,
  ): Promise<Map<number, AsignacionDeGuardia[]>>;
  /** Guardias activos con la foto de su rostro (para elegir a quién asignar). */
  abstract guardiasActivos(): Promise<GuardiaConFoto[]>;
  /** Solo para asignaciones que aún no empiezan. */
  abstract eliminarAsignacion(id: number): Promise<void>;
}

// La BD guarda `24x24` y `12x12` como `t24x24` y `t12x12` en el enum de Prisma.
const turnoADb = (t: Turno) => (t === '24x24' || t === '12x12' ? `t${t}` : t) as TurnoGuardia;
export const turnoDeDb = (t: TurnoGuardia | null) => (t?.startsWith('t') ? t.slice(1) : t) as Turno | null;
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
  turnoCatalogo: { select: { id: true, nombre: true } },
  horas: true,
  ...diasSelect,
} satisfies Prisma.SitioGuardiaSelect;

type AsignacionRow = Prisma.SitioGuardiaGetPayload<{ select: typeof asignacionSelect }>;

function toAsignacion(
  {
    usuario,
    grupo,
    turno,
    desde,
    hasta,
    vigenteHasta,
    turnoCatalogo,
    diasTipo,
    diasTrabajo,
    diasDescanso,
    diasSemana,
    ...a
  }: AsignacionRow,
  hoy: string,
): Asignacion & { vigenteHasta: string | null } {
  const d = dateAFecha(desde);
  const vh = fecha(vigenteHasta);
  return {
    ...a,
    guardia: usuario,
    grupo: grupo && { id: grupo.id, nombre: grupo.nombre, integrantes: grupo._count.integrantes },
    turno: turnoDeDb(turno),
    turnoCatalogo,
    dias: diasDeDb({ diasTipo, diasTrabajo, diasDescanso, diasSemana }),
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
      select: {
        id: true,
        nombre: true,
        clienteId: true,
        deletedAt: true,
        supervisorId: true,
        cliente: { select: { deletedAt: true } },
      },
    });
    return (
      s && {
        id: s.id,
        nombre: s.nombre,
        clienteId: s.clienteId,
        deletedAt: s.deletedAt,
        clienteDeBaja: !!s.cliente.deletedAt,
        supervisorId: s.supervisorId,
      }
    );
  }

  async supervisores() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: ROLES.SUPERVISOR } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        _count: { select: { sitiosSupervisados: { where: { deletedAt: null } } } },
      },
    });
    return rows.map(({ _count, ...u }) => ({ ...u, sitios: _count.sitiosSupervisados }));
  }

  async setSupervisor(sitioId: number, supervisorId: number | null) {
    await getPrisma().sitio.update({ where: { id: sitioId }, data: { supervisorId } });
  }

  async integrantesGrupo(grupoId: number) {
    const rows = await getPrisma().grupoIntegrante.findMany({
      where: { grupoId, usuario: { activo: true, deletedAt: null } },
      select: { usuarioId: true },
    });
    return rows.map((r) => r.usuarioId);
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

  async createAsignacion({ turno, desde, hasta, vigenteHasta, dias, ...data }: AsignacionData, hoy: string) {
    const a = await getPrisma().sitioGuardia.create({
      data: {
        ...data,
        ...(dias && diasADb(dias)),
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
    { turnoId, horas, dias, turno, horaInicio, horaFin, hasta, vigenteHasta }: CambioAsignacion,
  ) {
    await getPrisma().sitioGuardia.update({
      where: { id },
      data: {
        ...(turnoId && { turnoId }),
        ...(horas && { horas }),
        ...(dias && diasADb(dias)),
        ...(turno !== undefined && { turno: turno ? turnoADb(turno) : null }),
        ...(horaInicio && { horaInicio }),
        ...(horaFin && { horaFin }),
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
        horas: true,
        ...diasSelect,
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
            radioM: true,
            cliente: { select: { id: true, nombreComercial: true } },
          },
        },
      },
      // Directas primero: si el sitio llega por guardia y por grupo, se muestra la directa.
      orderBy: [{ sitio: { nombre: 'asc' } }, { grupoId: 'asc' }],
    });

    // Si hoy cubre otro sitio (DA-39), solo ve ese: sus sitios propios quedan en pausa.
    const sitioSelect = {
      id: true,
      nombre: true,
      direccion: true,
      referencias: true,
      lat: true,
      lng: true,
      radioM: true,
      cliente: { select: { id: true, nombreComercial: true } },
    } as const;
    const coberturas = await getPrisma().cobertura.findMany({
      where: {
        usuarioId,
        canceladaEn: null,
        desde: { lte: fechaADate(hoy) },
        hasta: { gte: fechaADate(hoy) },
      },
      select: {
        id: true,
        desde: true,
        hasta: true,
        horaInicio: true,
        horas: true,
        motivo: true,
        cubreA: { select: { nombre: true } },
        sitio: { select: sitioSelect },
      },
    });
    if (coberturas.length) {
      return coberturas.map(
        ({
          id,
          desde,
          hasta,
          horaInicio,
          horas,
          motivo,
          cubreA,
          sitio: { cliente, lat, lng, ...sitio },
        }) => ({
          asignacionId: id,
          tipo: 'temporal' as const,
          grupo: null,
          turno: null,
          horaInicio,
          horaFin: null,
          horas,
          dias: { tipo: 'diario' as const },
          desde: dateAFecha(desde),
          hasta: dateAFecha(hasta),
          sitio: { ...sitio, lat: lat === null ? null : Number(lat), lng: lng === null ? null : Number(lng) },
          cliente,
          cobertura: { id, motivo, cubreA: cubreA?.nombre ?? null },
        }),
      );
    }

    const ayer = new Date(fechaADate(hoy).getTime() - 86_400_000);
    const enDosSemanas = new Date(fechaADate(hoy).getTime() + 15 * 86_400_000);
    const pausas = (
      await getPrisma().pausaTurno.findMany({
        where: { usuarioId, fecha: { gte: ayer, lte: enDosSemanas } },
        select: { fecha: true },
      })
    ).map((p) => dateAFecha(p.fecha));
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
          horas,
          diasTipo,
          diasTrabajo,
          diasDescanso,
          diasSemana,
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
          horas,
          dias: diasDeDb({ diasTipo, diasTrabajo, diasDescanso, diasSemana }),
          desde: dateAFecha(desde),
          hasta: fecha(hasta),
          sitio: { ...sitio, lat: lat === null ? null : Number(lat), lng: lng === null ? null : Number(lng) },
          cliente,
          pausas,
        }),
      );
  }

  async findTurno(id: number) {
    const t = await getPrisma().turno.findUnique({
      where: { id },
      select: { id: true, nombre: true, horas: true, horaEntrada: true, activo: true, ...diasSelect },
    });
    if (!t) return null;
    const { diasTipo, diasTrabajo, diasDescanso, diasSemana, ...turno } = t;
    return {
      ...turno,
      dias: diasDeDb({ diasTipo, diasTrabajo, diasDescanso, diasSemana }) ?? { tipo: 'diario' },
    };
  }

  async asignacionesDeGuardias(usuarioIds: number[], hoy: string) {
    const mapa = new Map<number, AsignacionDeGuardia[]>(usuarioIds.map((id) => [id, []]));
    if (usuarioIds.length === 0) return mapa;
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        AND: [
          { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaADate(hoy) } }] },
          {
            OR: [
              { usuarioId: { in: usuarioIds } },
              { grupo: { deletedAt: null, integrantes: { some: { usuarioId: { in: usuarioIds } } } } },
            ],
          },
          { sitio: { deletedAt: null } },
        ],
      },
      select: {
        id: true,
        tipo: true,
        turno: true,
        horaInicio: true,
        horaFin: true,
        horas: true,
        ...diasSelect,
        desde: true,
        hasta: true,
        usuarioId: true,
        turnoId: true,
        sitio: { select: { id: true, nombre: true } },
        grupo: { select: { nombre: true, integrantes: { select: { usuarioId: true } } } },
        turnoCatalogo: { select: { nombre: true } },
      },
      orderBy: { desde: 'asc' },
    });
    for (const r of rows) {
      const a: AsignacionDeGuardia = {
        asignacionId: r.id,
        tipo: r.tipo,
        turno: turnoDeDb(r.turno),
        horaInicio: r.horaInicio,
        horaFin: r.horaFin,
        horas: r.horas,
        dias: diasDeDb(r),
        desde: dateAFecha(r.desde),
        hasta: fecha(r.hasta),
        sitio: r.sitio,
        grupo: r.grupo?.nombre ?? null,
        turnoId: r.turnoId,
        turnoNombre: r.turnoCatalogo?.nombre ?? null,
      };
      const de = r.usuarioId ? [r.usuarioId] : (r.grupo?.integrantes.map((i) => i.usuarioId) ?? []);
      for (const id of de) mapa.get(id)?.push(a);
    }
    return mapa;
  }

  async guardiasActivos() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: 'guardia' } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        rostros: {
          where: { reemplazadoEn: null, estado: { not: 'rechazado' } },
          orderBy: { id: 'desc' },
          take: 1,
          select: { fotoClave: true },
        },
      },
    });
    return rows.map(({ rostros, ...g }) => ({ ...g, fotoClave: rostros[0]?.fotoClave ?? null }));
  }

  async eliminarAsignacion(id: number) {
    await getPrisma().sitioGuardia.delete({ where: { id } });
  }
}
