import type { EstadoCambioTurno, Rol, TipoCambioTurno } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';

export interface Persona {
  id: number;
  nombre: string;
}

export interface GuardiaCambio extends Persona {
  rol: Rol;
  activo: boolean;
}

export interface CambioRow {
  id: number;
  tipo: TipoCambioTurno;
  estado: EstadoCambioTurno;
  guardia: Persona;
  solicitante: Persona;
  sitio: Persona & { supervisorId: number | null };
  fecha: string;
  fechaNueva: string | null;
  cubre: Persona | null;
  motivo: string;
  horaInicio: string;
  horas: number;
  resueltoPor: string | null;
  resueltoEn: Date | null;
  notaResolucion: string | null;
  coberturaId: number | null;
  createdAt: Date;
}

export interface NuevoCambio {
  tipo: TipoCambioTurno;
  estado: EstadoCambioTurno;
  usuarioId: number;
  solicitanteId: number;
  sitioId: number;
  fecha: string;
  fechaNueva: string | null;
  cubreId: number | null;
  motivo: string;
  horaInicio: string;
  horas: number;
}

export interface FiltroCambios {
  estado?: EstadoCambioTurno;
  guardiaId?: number;
  /** Guardia: solo los suyos (como afectado, solicitante o quien cubre). */
  propios?: number;
  /** Supervisor: solo sus sitios y guardias, o los que él pidió. */
  alcance?: { sitioIds: number[]; guardiaIds: number[]; usuarioId: number };
  skip: number;
  take: number;
}

export abstract class CambiosRepository {
  abstract findGuardia(id: number): Promise<GuardiaCambio | null>;
  abstract guardiasActivos(): Promise<Persona[]>;
  /** Admins activos (a quienes se avisa si el sitio no tiene supervisor). */
  abstract admins(): Promise<number[]>;
  /** ¿Ya hay un cambio pendiente o aprobado de ese guardia ese día? */
  abstract hayCambio(usuarioId: number, fecha: string): Promise<boolean>;
  abstract crear(data: NuevoCambio): Promise<CambioRow>;
  abstract findById(id: number): Promise<CambioRow | null>;
  abstract listar(f: FiltroCambios): Promise<{ items: CambioRow[]; total: number }>;
  abstract resolver(
    id: number,
    d: {
      estado: EstadoCambioTurno;
      resueltoPorId: number | null;
      en: Date;
      nota: string | null;
      coberturaId?: number | null;
    },
  ): Promise<void>;
  abstract crearPausa(usuarioId: number, fecha: string, cambioId: number): Promise<void>;
  abstract borrarPausas(cambioId: number): Promise<void>;
  /** Pendientes por aprobar en esos sitios (None = todos). */
  abstract pendientes(sitioIds: number[] | null): Promise<number>;
}

const persona = { select: { id: true, nombre: true } } as const;
const select = {
  id: true,
  tipo: true,
  estado: true,
  fecha: true,
  fechaNueva: true,
  motivo: true,
  horaInicio: true,
  horas: true,
  resueltoEn: true,
  notaResolucion: true,
  coberturaId: true,
  createdAt: true,
  usuario: persona,
  solicitante: persona,
  cubre: persona,
  resueltoPor: { select: { nombre: true } },
  sitio: { select: { id: true, nombre: true, supervisorId: true } },
} as const;

type Fila = Prisma.CambioTurnoGetPayload<{ select: typeof select }>;

const aRow = (r: Fila): CambioRow => ({
  id: r.id,
  tipo: r.tipo,
  estado: r.estado,
  guardia: r.usuario,
  solicitante: r.solicitante,
  sitio: r.sitio,
  fecha: dateAFecha(r.fecha),
  fechaNueva: r.fechaNueva && dateAFecha(r.fechaNueva),
  cubre: r.cubre,
  motivo: r.motivo,
  horaInicio: r.horaInicio,
  horas: r.horas,
  resueltoPor: r.resueltoPor?.nombre ?? null,
  resueltoEn: r.resueltoEn,
  notaResolucion: r.notaResolucion,
  coberturaId: r.coberturaId,
  createdAt: r.createdAt,
});

export class PrismaCambiosRepository extends CambiosRepository {
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

  async admins() {
    const r = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: 'admin' } },
      select: { id: true },
    });
    return r.map((u) => u.id);
  }

  async hayCambio(usuarioId: number, fecha: string) {
    const n = await getPrisma().cambioTurno.count({
      where: { usuarioId, fecha: fechaADate(fecha), estado: { in: ['pendiente', 'aprobado'] } },
    });
    return n > 0;
  }

  async crear(d: NuevoCambio) {
    const r = await getPrisma().cambioTurno.create({
      data: {
        tipo: d.tipo,
        estado: d.estado,
        usuarioId: d.usuarioId,
        solicitanteId: d.solicitanteId,
        sitioId: d.sitioId,
        fecha: fechaADate(d.fecha),
        fechaNueva: d.fechaNueva ? fechaADate(d.fechaNueva) : null,
        cubreId: d.cubreId,
        motivo: d.motivo,
        horaInicio: d.horaInicio,
        horas: d.horas,
      },
      select,
    });
    return aRow(r);
  }

  async findById(id: number) {
    const r = await getPrisma().cambioTurno.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async listar({ estado, guardiaId, propios, alcance, skip, take }: FiltroCambios) {
    const and: Prisma.CambioTurnoWhereInput[] = [];
    if (estado) and.push({ estado });
    if (guardiaId) and.push({ usuarioId: guardiaId });
    if (propios) and.push({ OR: [{ usuarioId: propios }, { solicitanteId: propios }, { cubreId: propios }] });
    if (alcance) {
      and.push({
        OR: [
          { sitioId: { in: alcance.sitioIds } },
          { usuarioId: { in: alcance.guardiaIds } },
          { solicitanteId: alcance.usuarioId },
        ],
      });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      getPrisma().cambioTurno.findMany({ where, orderBy: { id: 'desc' }, skip, take, select }),
      getPrisma().cambioTurno.count({ where }),
    ]);
    return { items: rows.map(aRow), total };
  }

  async resolver(
    id: number,
    d: { estado: EstadoCambioTurno; resueltoPorId: number | null; en: Date; nota: string | null; coberturaId?: number | null },
  ) {
    await getPrisma().cambioTurno.update({
      where: { id },
      data: {
        estado: d.estado,
        resueltoPorId: d.resueltoPorId,
        resueltoEn: d.en,
        notaResolucion: d.nota,
        ...(d.coberturaId !== undefined ? { coberturaId: d.coberturaId } : {}),
      },
    });
  }

  async crearPausa(usuarioId: number, fecha: string, cambioId: number) {
    await getPrisma().pausaTurno.upsert({
      where: { usuarioId_fecha: { usuarioId, fecha: fechaADate(fecha) } },
      create: { usuarioId, fecha: fechaADate(fecha), cambioId },
      update: { cambioId },
    });
  }

  async borrarPausas(cambioId: number) {
    await getPrisma().pausaTurno.deleteMany({ where: { cambioId } });
  }

  async pendientes(sitioIds: number[] | null) {
    return getPrisma().cambioTurno.count({
      where: { estado: 'pendiente', ...(sitioIds ? { sitioId: { in: sitioIds } } : {}) },
    });
  }
}
