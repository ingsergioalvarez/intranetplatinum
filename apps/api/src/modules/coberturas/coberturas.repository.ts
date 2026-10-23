import { ROLES, type Cobertura, type Rol } from '@platinum/shared';
import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { asignadaA } from '../clientes/clientes.repository';

export interface SitioCobertura {
  id: number;
  nombre: string;
  supervisorId: number | null;
  activo: boolean;
}

export interface GuardiaCobertura {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  fotoClave: string | null;
}

export interface NuevaCobertura {
  usuarioId: number;
  sitioId: number;
  cubreAId: number | null;
  desde: string;
  hasta: string;
  horaInicio: string;
  horas: number;
  motivo: string;
  descansoHoras: number | null;
  creadaPorId: number;
}

export type CoberturaRow = Cobertura & { canceladaEn: Date | null };

/** Coberturas de sitios (DA-39, DA-46). */
export abstract class CoberturasRepository {
  abstract findSitio(id: number): Promise<SitioCobertura | null>;
  abstract findGuardia(id: number): Promise<GuardiaCobertura | null>;
  abstract guardiasActivos(): Promise<GuardiaCobertura[]>;
  /** ¿El guardia ya cubre otro sitio en alguno de esos días? */
  abstract haySolape(usuarioId: number, desde: string, hasta: string): Promise<boolean>;
  abstract crear(data: NuevaCobertura): Promise<Cobertura>;
  abstract findById(id: number): Promise<CoberturaRow | null>;
  abstract cancelar(id: number, en: Date): Promise<void>;
  /** Vigentes o próximas (hasta >= `desde`), no canceladas. */
  abstract listar(filtro: { sitioId?: number; usuarioId?: number; desde: string }): Promise<Cobertura[]>;
  /** Supervisores de los sitios propios del guardia hoy (para avisarles que su guardia cubre otro). */
  abstract supervisoresDeGuardia(usuarioId: number, hoy: string): Promise<number[]>;
}

const nombre = { select: { id: true, nombre: true } } as const;
const select = {
  id: true,
  desde: true,
  hasta: true,
  horaInicio: true,
  horas: true,
  motivo: true,
  descansoHoras: true,
  createdAt: true,
  canceladaEn: true,
  usuario: nombre,
  sitio: nombre,
  cubreA: nombre,
  creadaPor: { select: { nombre: true } },
} satisfies Prisma.CoberturaSelect;

type Fila = Prisma.CoberturaGetPayload<{ select: typeof select }>;

const aCobertura = (r: Fila): CoberturaRow => ({
  id: r.id,
  guardia: r.usuario,
  sitio: r.sitio,
  cubreA: r.cubreA,
  desde: dateAFecha(r.desde),
  hasta: dateAFecha(r.hasta),
  horaInicio: r.horaInicio,
  horas: r.horas,
  motivo: r.motivo,
  descansoHoras: r.descansoHoras,
  creadaPor: r.creadaPor?.nombre ?? null,
  createdAt: r.createdAt.toISOString(),
  canceladaEn: r.canceladaEn,
});

export class PrismaCoberturasRepository extends CoberturasRepository {
  async findSitio(id: number) {
    const s = await getPrisma().sitio.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        supervisorId: true,
        deletedAt: true,
        cliente: { select: { deletedAt: true } },
      },
    });
    return (
      s && {
        id: s.id,
        nombre: s.nombre,
        supervisorId: s.supervisorId,
        activo: !s.deletedAt && !s.cliente.deletedAt,
      }
    );
  }

  private guardiaSelect = {
    id: true,
    nombre: true,
    email: true,
    activo: true,
    deletedAt: true,
    rol: { select: { clave: true } },
    rostros: {
      where: { reemplazadoEn: null, estado: { not: 'rechazado' } },
      orderBy: { id: 'desc' },
      take: 1,
      select: { fotoClave: true },
    },
  } satisfies Prisma.UsuarioSelect;

  private aGuardia(u: Prisma.UsuarioGetPayload<{ select: PrismaCoberturasRepository['guardiaSelect'] }>) {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol.clave as Rol,
      activo: u.activo && !u.deletedAt,
      fotoClave: u.rostros[0]?.fotoClave ?? null,
    };
  }

  async findGuardia(id: number) {
    const u = await getPrisma().usuario.findUnique({ where: { id }, select: this.guardiaSelect });
    return u && this.aGuardia(u);
  }

  async guardiasActivos() {
    const rows = await getPrisma().usuario.findMany({
      where: { activo: true, deletedAt: null, rol: { clave: ROLES.GUARDIA } },
      orderBy: { nombre: 'asc' },
      select: this.guardiaSelect,
    });
    return rows.map((u) => this.aGuardia(u));
  }

  async haySolape(usuarioId: number, desde: string, hasta: string) {
    const n = await getPrisma().cobertura.count({
      where: {
        usuarioId,
        canceladaEn: null,
        desde: { lte: fechaADate(hasta) },
        hasta: { gte: fechaADate(desde) },
      },
    });
    return n > 0;
  }

  async crear({ desde, hasta, ...data }: NuevaCobertura) {
    const r = await getPrisma().cobertura.create({
      data: { ...data, desde: fechaADate(desde), hasta: fechaADate(hasta) },
      select,
    });
    return aCobertura(r);
  }

  async findById(id: number) {
    const r = await getPrisma().cobertura.findUnique({ where: { id }, select });
    return r && aCobertura(r);
  }

  async cancelar(id: number, en: Date) {
    await getPrisma().cobertura.update({ where: { id }, data: { canceladaEn: en } });
  }

  async listar({ sitioId, usuarioId, desde }: { sitioId?: number; usuarioId?: number; desde: string }) {
    const rows = await getPrisma().cobertura.findMany({
      where: {
        canceladaEn: null,
        hasta: { gte: fechaADate(desde) },
        ...(sitioId && { sitioId }),
        ...(usuarioId && { usuarioId }),
      },
      orderBy: [{ desde: 'asc' }, { id: 'asc' }],
      select,
    });
    return rows.map(aCobertura);
  }

  async supervisoresDeGuardia(usuarioId: number, hoy: string) {
    const rows = await getPrisma().sitioGuardia.findMany({
      where: { ...asignadaA(usuarioId, hoy), sitio: { supervisor: { activo: true, deletedAt: null } } },
      select: { sitio: { select: { supervisorId: true } } },
    });
    return [...new Set(rows.map((r) => r.sitio.supervisorId!))];
  }
}
