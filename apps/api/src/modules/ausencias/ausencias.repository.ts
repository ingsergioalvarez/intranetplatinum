import { sumarDiasFecha, type EstadoAusencia, type TipoAusencia } from '@platinum/shared';
import { dateAFecha, fechaADate, hoyISO, inicioDelDia } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { responsablesDe, type ContextoAviso } from '../avisos/cadena';
import { empresaActual } from '../../core/empresa/contexto';

export interface NuevaAusencia {
  usuarioId: number;
  tipo: TipoAusencia;
  desde: string;
  hasta: string;
  motivo: string | null;
  solicitanteId: number;
  comprobanteClave: string | null;
}

export interface AusenciaRow {
  id: number;
  estado: EstadoAusencia;
  tipo: TipoAusencia;
  guardia: { id: number; nombre: string };
  desde: string;
  hasta: string;
  motivo: string | null;
  solicitante: { id: number; nombre: string; rol: string };
  comprobanteClave: string | null;
  createdAt: Date;
  resueltaEn: Date | null;
  resueltaPor: string | null;
  resolucion: string | null;
  faltasJustificadas: number;
}

export interface ResolucionAusencia {
  estado: Exclude<EstadoAusencia, 'pendiente'>;
  resueltaEn: Date;
  resueltaPor: string | null;
  resolucion?: string | null;
  faltasJustificadas?: number;
}

export interface GuardiaAusencia {
  id: number;
  nombre: string;
  rol: string;
  activo: boolean;
}

/** Faltas y "No se presentó" que una ausencia justificaría sola. */
export interface EventoAfectado {
  id: number;
  fecha: string;
}

/** Acceso a datos de las ausencias justificadas (A-43). */
export abstract class AusenciasRepository {
  abstract crear(d: NuevaAusencia): Promise<AusenciaRow>;
  abstract findById(id: number): Promise<AusenciaRow | null>;
  /** De esos guardias (null = todos); las pendientes primero y lo más nuevo arriba. */
  abstract listar(usuarioIds: number[] | null, limite: number): Promise<AusenciaRow[]>;
  /** ¿Ya tiene una ausencia pendiente o aprobada que se cruce con esas fechas? */
  abstract hayTraslape(usuarioId: number, desde: string, hasta: string): Promise<boolean>;
  abstract resolver(id: number, r: ResolucionAusencia): Promise<void>;
  abstract guardia(id: number): Promise<GuardiaAusencia | null>;
  abstract nombreDe(usuarioId: number): Promise<string | null>;
  /** Faltas y "No se presentó" sin justificar de esos días. */
  abstract eventosAfectados(usuarioId: number, desde: string, hasta: string): Promise<EventoAfectado[]>;
  abstract justificarEventos(ids: number[], texto: string, porId: number, en: Date): Promise<void>;
  /** A quién avisar de algo de una persona: su jefe más cercano; sin jefe, RH; sin RH, los admin (DC-017). */
  abstract admins(contexto?: ContextoAviso): Promise<number[]>;
}

const select = {
  id: true,
  estado: true,
  tipo: true,
  desde: true,
  hasta: true,
  motivo: true,
  comprobanteClave: true,
  createdAt: true,
  resueltaEn: true,
  resueltaPor: true,
  resolucion: true,
  faltasJustificadas: true,
  usuario: { select: { id: true, nombre: true } },
  solicitante: { select: { id: true, nombre: true, rol: { select: { clave: true } } } },
} as const;

type Fila = {
  id: number;
  estado: string;
  tipo: string;
  desde: Date;
  hasta: Date;
  motivo: string | null;
  comprobanteClave: string | null;
  createdAt: Date;
  resueltaEn: Date | null;
  resueltaPor: string | null;
  resolucion: string | null;
  faltasJustificadas: number;
  usuario: { id: number; nombre: string };
  solicitante: { id: number; nombre: string; rol: { clave: string } };
};

const aRow = ({ usuario, solicitante, desde, hasta, estado, tipo, ...r }: Fila): AusenciaRow => ({
  ...r,
  estado: estado as EstadoAusencia,
  tipo: tipo as TipoAusencia,
  guardia: usuario,
  solicitante: { id: solicitante.id, nombre: solicitante.nombre, rol: solicitante.rol.clave },
  desde: dateAFecha(desde),
  hasta: dateAFecha(hasta),
});

export class PrismaAusenciasRepository extends AusenciasRepository {
  async crear(d: NuevaAusencia) {
    const r = await getPrisma().ausencia.create({
      data: { empresaId: empresaActual(), ...d, desde: fechaADate(d.desde), hasta: fechaADate(d.hasta), motivo: d.motivo?.slice(0, 255) ?? null },
      select,
    });
    return aRow(r);
  }

  async findById(id: number) {
    const r = await getPrisma().ausencia.findUnique({ where: { id }, select });
    return r && aRow(r);
  }

  async listar(usuarioIds: number[] | null, limite: number) {
    const rows = await getPrisma().ausencia.findMany({
      where: usuarioIds ? { usuarioId: { in: usuarioIds } } : {},
      orderBy: { createdAt: 'desc' },
      take: limite,
      select,
    });
    return rows.map(aRow).sort((a, b) => Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente'));
  }

  async hayTraslape(usuarioId: number, desde: string, hasta: string) {
    const n = await getPrisma().ausencia.count({
      where: {
        usuarioId,
        estado: { in: ['pendiente', 'aprobada'] },
        desde: { lte: fechaADate(hasta) },
        hasta: { gte: fechaADate(desde) },
      },
    });
    return n > 0;
  }

  async resolver(id: number, r: ResolucionAusencia) {
    await getPrisma().ausencia.update({
      where: { id },
      data: {
        estado: r.estado,
        resueltaEn: r.resueltaEn,
        resueltaPor: r.resueltaPor,
        resolucion: r.resolucion?.slice(0, 255) ?? null,
        ...(r.faltasJustificadas !== undefined && { faltasJustificadas: r.faltasJustificadas }),
      },
    });
  }

  async guardia(id: number) {
    const u = await getPrisma().usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true, deletedAt: true, rol: { select: { clave: true } } },
    });
    return u && { id: u.id, nombre: u.nombre, rol: u.rol.clave, activo: u.activo && !u.deletedAt };
  }

  async nombreDe(usuarioId: number) {
    return (await getPrisma().usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? null;
  }

  async eventosAfectados(usuarioId: number, desde: string, hasta: string) {
    const rows = await getPrisma().eventoBitacora.findMany({
      where: {
        usuarioId,
        tipo: { in: ['falta', 'no_se_presento'] },
        justificadoEn: null,
        ocurrioEn: { gte: inicioDelDia(desde), lt: inicioDelDia(sumarDiasFecha(hasta, 1)) },
      },
      select: { id: true, ocurrioEn: true },
    });
    return rows.map((r) => ({ id: r.id, fecha: hoyISO(undefined, r.ocurrioEn) }));
  }

  async justificarEventos(ids: number[], texto: string, porId: number, en: Date) {
    if (ids.length === 0) return;
    await getPrisma().eventoBitacora.updateMany({
      where: { id: { in: ids } },
      data: { justificacion: texto.slice(0, 255), justificadoPorId: porId, justificadoEn: en },
    });
  }

  admins(contexto?: ContextoAviso) {
    return responsablesDe(contexto);
  }
}
