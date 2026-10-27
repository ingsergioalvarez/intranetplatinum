import { sumarDiasFecha } from '@platinum/shared';
import { dateAFecha, fechaADate, inicioDelDia } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { PrismaAsistenciaRepository } from '../asistencia/asistencia.repository';
import type { RealesCobertura } from './cobertura.calculo';

/** Datos que el cálculo de cobertura necesita además de los turnos programados. */
export abstract class CoberturaRepository {
  abstract sitio(id: number): Promise<{ id: number; nombre: string } | null>;
  /** Entradas, faltas y horas extra del sitio entre dos días (inclusive). */
  abstract reales(sitioId: number, desde: string, hasta: string): Promise<RealesCobertura>;
  /** Marca un aviso como enviado; false si ya lo estaba (para no repetirlo). */
  abstract marcarEnviado(clave: string): Promise<boolean>;
  /** A quién avisar de un sitio: su supervisor; sin supervisor, los admin. */
  abstract revisoresDe(sitioId: number): Promise<number[]>;
}

/** Margen antes de la primera hora del rango para las entradas de quien llega temprano. */
const MARGEN_MS = 3 * 3_600_000;

export class PrismaCoberturaRepository extends CoberturaRepository {
  async sitio(id: number) {
    return getPrisma().sitio.findFirst({ where: { id, deletedAt: null }, select: { id: true, nombre: true } });
  }

  async reales(sitioId: number, desde: string, hasta: string): Promise<RealesCobertura> {
    const db = getPrisma();
    const inicio = inicioDelDia(desde);
    const fin = inicioDelDia(sumarDiasFecha(hasta, 1));
    const [turnosDia, entradas, extras] = await Promise.all([
      db.turnoDia.findMany({
        where: { sitioId, programadaEntrada: { gte: inicio, lt: fin } },
        select: { usuarioId: true, programadaEntrada: true, entradaId: true, noSePresentoEn: true, faltaEn: true },
      }),
      db.marcacion.findMany({
        where: {
          sitioId,
          tipo: 'entrada',
          registradaEn: { gte: new Date(inicio.getTime() - MARGEN_MS), lt: fin },
        },
        select: { usuarioId: true, registradaEn: true },
      }),
      db.horaExtra.findMany({
        where: { sitioId, estado: { not: 'rechazada' }, fecha: { gte: fechaADate(desde), lte: fechaADate(hasta) } },
        select: { usuarioId: true, fecha: true },
      }),
    ]);
    return {
      turnosDia,
      entradas,
      extras: extras.map((x) => ({ usuarioId: x.usuarioId, fecha: dateAFecha(x.fecha) })),
    };
  }

  async marcarEnviado(clave: string) {
    try {
      await getPrisma().avisoEnviado.create({ data: { clave } });
      return true;
    } catch {
      // Ya existía: el aviso se envió antes.
      return false;
    }
  }

  revisoresDe(sitioId: number) {
    return new PrismaAsistenciaRepository().revisoresDe({ sitioId, guardiaId: 0 });
  }
}
