import type { EstadoHoraExtra, OrigenHoraExtra, Rol } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface Persona {
  id: number;
  nombre: string;
}

export interface GuardiaExtra extends Persona {
  rol: Rol;
  activo: boolean;
}

export interface SitioExtra extends Persona {
  supervisorId: number | null;
}

export interface HoraExtraRow {
  id: number;
  guardia: Persona;
  sitio: SitioExtra;
  entradaId: number | null;
  fecha: string;
  desde: Date;
  hasta: Date | null;
  minutos: number | null;
  origen: OrigenHoraExtra;
  estado: EstadoHoraExtra;
  motivo: string | null;
  resueltoPor: string | null;
  resueltoEn: Date | null;
  notaResolucion: string | null;
  escaladaEn: Date | null;
  createdAt: Date;
}

export interface NuevaHoraExtra {
  usuarioId: number;
  sitioId: number;
  entradaId: number | null;
  fecha: string;
  desde: Date;
  hasta: Date | null;
  minutos: number | null;
  origen: OrigenHoraExtra;
  estado: EstadoHoraExtra;
  motivo?: string | null;
  resueltoPorId?: number | null;
  resueltoEn?: Date | null;
  notaResolucion?: string | null;
}

export type CambiosHoraExtra = Partial<
  Pick<
    HoraExtraRow,
    'desde' | 'hasta' | 'minutos' | 'origen' | 'estado' | 'resueltoEn' | 'notaResolucion' | 'escaladaEn' | 'motivo'
  > & { resueltoPorId: number | null }
>;

/** Una entrada de asistencia con lo que hace falta para sus horas extra. */
export interface EntradaExtra {
  id: number;
  usuarioId: number;
  guardia: string;
  sitio: SitioExtra | null;
  registradaEn: Date;
  programadaEntrada: Date | null;
  programadaSalida: Date | null;
}

export interface FiltroHorasExtra {
  estados?: EstadoHoraExtra[];
  guardiaId?: number;
  /** Fechas de la jornada, inclusive. */
  desde?: string;
  hasta?: string;
  /** Supervisor: solo sus sitios y guardias. */
  alcance?: { sitioIds: number[]; guardiaIds: number[] };
  skip?: number;
  take?: number;
}

export abstract class HorasExtraRepository {
  abstract findGuardia(id: number): Promise<GuardiaExtra | null>;
  abstract guardiasActivos(): Promise<Persona[]>;
  abstract sitiosActivos(): Promise<Persona[]>;
  /** Admins activos (a quienes sube el aviso si el sitio no tiene supervisor o no responde). */
  abstract admins(): Promise<number[]>;
  abstract crear(d: NuevaHoraExtra): Promise<HoraExtraRow>;
  abstract findById(id: number): Promise<HoraExtraRow | null>;
  abstract porEntrada(entradaId: number): Promise<HoraExtraRow | null>;
  abstract actualizar(id: number, c: CambiosHoraExtra): Promise<HoraExtraRow>;
  abstract eliminar(id: number): Promise<void>;
  abstract listar(f: FiltroHorasExtra): Promise<{ items: HoraExtraRow[]; total: number }>;
  /** Las que esperan una decisión (por aprobar, abiertas y sin salida). */
  abstract pendientes(alcance?: FiltroHorasExtra['alcance']): Promise<number>;
  /** ¿Ya hay horas extra (no rechazadas) del guardia que se empalmen con ese rango? */
  abstract solapa(usuarioId: number, desde: Date, hasta: Date, excluirId?: number): Promise<boolean>;
  /** Abiertas (el guardia no ha marcado su salida final). */
  abstract abiertas(): Promise<HoraExtraRow[]>;
  /** Por aprobar o sin salida desde antes de `antes` y sin haber avisado a los admins. */
  abstract sinResponder(antes: Date): Promise<HoraExtraRow[]>;
  // ---- Marcas de asistencia ----
  abstract findEntrada(id: number): Promise<EntradaExtra | null>;
  abstract ultimaEntrada(usuarioId: number): Promise<EntradaExtra | null>;
  /** Hora de la salida normal de la jornada; null si no la ha marcado. */
  abstract salidaDe(entradaId: number): Promise<Date | null>;
  /** Jornadas con salida programada ya pasada, sin salida marcada y sin horas extra registradas. */
  abstract jornadasSinSalida(programadaHasta: Date, entradaDesde: Date): Promise<EntradaExtra[]>;
  abstract coordenadasSitio(sitioId: number): Promise<{ lat: number; lng: number; radioM: number } | null>;
  /** ¿Tiene un cambio de descanso aprobado que le hace trabajar ese día? */
  abstract descansoMovidoA(usuarioId: number, fecha: string): Promise<boolean>;
}

const persona = { select: { id: true, nombre: true } } as const;
const select = {
  id: true,
  entradaId: true,
  fecha: true,
  desde: true,
  hasta: true,
  minutos: true,
  origen: true,
  estado: true,
  motivo: true,
  resueltoEn: true,
  notaResolucion: true,
  escaladaEn: true,
  createdAt: true,
  usuario: persona,
  resueltoPor: { select: { nombre: true } },
  sitio: { select: { id: true, nombre: true, supervisorId: true } },
} as const;

type Fila = Prisma.HoraExtraGetPayload<{ select: typeof select }>;

const aRow = (r: Fila): HoraExtraRow => ({
  id: r.id,
  guardia: r.usuario,
  sitio: r.sitio,
  entradaId: r.entradaId,
  fecha: dateAFecha(r.fecha),
  desde: r.desde,
  hasta: r.hasta,
  minutos: r.minutos,
  origen: r.origen,
  estado: r.estado,
  motivo: r.motivo,
  resueltoPor: r.resueltoPor?.nombre ?? null,
  resueltoEn: r.resueltoEn,
  notaResolucion: r.notaResolucion,
  escaladaEn: r.escaladaEn,
  createdAt: r.createdAt,
});

const PENDIENTES: EstadoHoraExtra[] = ['por_aprobar', 'abierta', 'sin_salida'];

const entradaSelect = {
  id: true,
  usuarioId: true,
  registradaEn: true,
  programadaEntrada: true,
  programadaSalida: true,
  usuario: { select: { nombre: true } },
  sitio: { select: { id: true, nombre: true, supervisorId: true } },
} as const;
type FilaEntrada = Prisma.MarcacionGetPayload<{ select: typeof entradaSelect }>;
const aEntrada = (r: FilaEntrada): EntradaExtra => ({
  id: r.id,
  usuarioId: r.usuarioId,
  guardia: r.usuario.nombre,
  sitio: r.sitio,
  registradaEn: r.registradaEn,
  programadaEntrada: r.programadaEntrada,
  programadaSalida: r.programadaSalida,
});

function donde(f: FiltroHorasExtra): Prisma.HoraExtraWhereInput {
  const and: Prisma.HoraExtraWhereInput[] = [];
  if (f.estados) and.push({ estado: { in: f.estados } });
  if (f.guardiaId) and.push({ usuarioId: f.guardiaId });
  if (f.desde) and.push({ fecha: { gte: fechaADate(f.desde) } });
  if (f.hasta) and.push({ fecha: { lte: fechaADate(f.hasta) } });
  if (f.alcance) {
    and.push({
      OR: [{ sitioId: { in: f.alcance.sitioIds } }, { usuarioId: { in: f.alcance.guardiaIds } }],
    });
  }
  return { AND: and };
}

export class PrismaHorasExtraRepository extends HorasExtraRepository {
  async findGuardia(id: number) {
    const u = await getPrisma().usuario.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, nombre: true, activo: true, rol: { select: { clave: true } } },
    });
    return u && { id: u.id, nombre: u.nombre, activo: u.activo, rol: u.rol.clave as Rol };
  }

  async guardiasActivos() {
    return getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: 'guardia' } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
  }

  async sitiosActivos() {
    return getPrisma().sitio.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
  }

  async admins() {
    const r = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: 'admin' } },
      select: { id: true },
    });
    return r.map((u) => u.id);
  }

  async crear(d: NuevaHoraExtra) {
    const r = await getPrisma().horaExtra.create({
      data: {
        usuarioId: d.usuarioId,
        sitioId: d.sitioId,
        entradaId: d.entradaId,
        fecha: fechaADate(d.fecha),
        desde: d.desde,
        hasta: d.hasta,
        minutos: d.minutos,
        origen: d.origen,
        estado: d.estado,
        motivo: d.motivo ?? null,
        resueltoPorId: d.resueltoPorId ?? null,
        resueltoEn: d.resueltoEn ?? null,
        notaResolucion: d.notaResolucion ?? null,
      },
      select,
    });
    return aRow(r);
  }

  async findById(id: number) {
    const r = await getPrisma().horaExtra.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async porEntrada(entradaId: number) {
    const r = await getPrisma().horaExtra.findUnique({ where: { entradaId }, select });
    return r && aRow(r);
  }

  async actualizar(id: number, c: CambiosHoraExtra) {
    const r = await getPrisma().horaExtra.update({ where: { id }, data: c, select });
    return aRow(r);
  }

  async eliminar(id: number) {
    await getPrisma().horaExtra.delete({ where: { id } });
  }

  async listar(f: FiltroHorasExtra) {
    const where = donde(f);
    const [rows, total] = await Promise.all([
      getPrisma().horaExtra.findMany({
        where,
        orderBy: [{ desde: 'desc' }, { id: 'desc' }],
        skip: f.skip,
        take: f.take,
        select,
      }),
      getPrisma().horaExtra.count({ where }),
    ]);
    return { items: rows.map(aRow), total };
  }

  async pendientes(alcance?: FiltroHorasExtra['alcance']) {
    return getPrisma().horaExtra.count({ where: donde({ estados: PENDIENTES, alcance }) });
  }

  async solapa(usuarioId: number, desde: Date, hasta: Date, excluirId?: number) {
    const n = await getPrisma().horaExtra.count({
      where: {
        usuarioId,
        estado: { not: 'rechazada' },
        ...(excluirId ? { id: { not: excluirId } } : {}),
        desde: { lt: hasta },
        // Sin `hasta` (abierta): se toma como abierta hasta ahora.
        OR: [{ hasta: { gt: desde } }, { hasta: null }],
      },
    });
    return n > 0;
  }

  async abiertas() {
    const rows = await getPrisma().horaExtra.findMany({ where: { estado: 'abierta' }, select });
    return rows.map(aRow);
  }

  async sinResponder(antes: Date) {
    const rows = await getPrisma().horaExtra.findMany({
      where: { estado: { in: ['por_aprobar', 'sin_salida'] }, escaladaEn: null, updatedAt: { lt: antes } },
      select,
    });
    return rows.map(aRow);
  }

  async findEntrada(id: number) {
    const r = await getPrisma().marcacion.findFirst({ where: { id, tipo: 'entrada' }, select: entradaSelect });
    return r && aEntrada(r);
  }

  async ultimaEntrada(usuarioId: number) {
    const r = await getPrisma().marcacion.findFirst({
      where: { usuarioId, tipo: 'entrada' },
      orderBy: { registradaEn: 'desc' },
      select: entradaSelect,
    });
    return r && aEntrada(r);
  }

  async salidaDe(entradaId: number) {
    const r = await getPrisma().marcacion.findFirst({
      where: { entradaId, tipo: 'salida' },
      orderBy: { registradaEn: 'desc' },
      select: { registradaEn: true },
    });
    return r?.registradaEn ?? null;
  }

  async jornadasSinSalida(programadaHasta: Date, entradaDesde: Date) {
    const candidatas = await getPrisma().marcacion.findMany({
      where: {
        tipo: 'entrada',
        programadaSalida: { lte: programadaHasta },
        registradaEn: { gte: entradaDesde },
        horaExtra: null,
        sitioId: { not: null },
      },
      select: entradaSelect,
    });
    if (candidatas.length === 0) return [];
    const conSalida = await getPrisma().marcacion.findMany({
      where: { tipo: 'salida', entradaId: { in: candidatas.map((c) => c.id) } },
      select: { entradaId: true },
    });
    const cerradas = new Set(conSalida.map((s) => s.entradaId));
    return candidatas.filter((c) => !cerradas.has(c.id)).map(aEntrada);
  }

  async coordenadasSitio(sitioId: number) {
    const s = await getPrisma().sitio.findUnique({
      where: { id: sitioId },
      select: { lat: true, lng: true, radioM: true },
    });
    if (!s || s.lat === null || s.lng === null) return null;
    return { lat: Number(s.lat), lng: Number(s.lng), radioM: s.radioM };
  }

  async descansoMovidoA(usuarioId: number, fecha: string) {
    const n = await getPrisma().cambioTurno.count({
      where: { usuarioId, tipo: 'descanso', estado: 'aprobado', fechaNueva: fechaADate(fecha) },
    });
    return n > 0;
  }
}
