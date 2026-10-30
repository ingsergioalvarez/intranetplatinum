import type { DecisionCaso, EstadoHoraExtra, OrigenHoraExtra, SiguienteTurno } from '@platinum/shared';
import { fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { PrismaAsistenciaRepository } from '../asistencia/asistencia.repository';

/** La jornada del guardia que sigue en el sitio. */
export interface EntradaCaso {
  id: number;
  usuarioId: number;
  guardia: string;
  sitio: { id: number; nombre: string; supervisorId: number | null };
  registradaEn: Date;
  programadaEntrada: Date | null;
  programadaSalida: Date | null;
}

export interface HoraExtraCaso {
  id: number;
  estado: EstadoHoraExtra;
  origen: OrigenHoraExtra;
  desde: Date;
  /** El guardia avisó que no puede quedarse (A-35). */
  noPuedeEn: Date | null;
  noPuedeMotivo: string | null;
  noPuedeNota: string | null;
}

export interface CasoRow {
  id: number;
  entradaId: number;
  guardiaId: number;
  sitioId: number;
  relevoId: number | null;
  relevoInicio: Date | null;
  estado: 'en_espera' | 'resuelto' | 'cancelado';
  decision: DecisionCaso;
  siguiente: SiguienteTurno | null;
  descansoExtraHoras: number;
  finCubierto: Date | null;
  /** Cuándo se presenta de nuevo si descansa. */
  regresaEn: Date | null;
  limiteExtra: Date | null;
  coberturaId: number | null;
  resueltoPorId: number | null;
  reconsultarEn: Date | null;
  motivo: string | null;
  /** Ids de todas las coberturas que creó el plan, separados por coma. */
  coberturasIds: string | null;
  nota: string | null;
}

/** Una jornada con horas extra abiertas y, si ya hay, su caso. */
export interface Candidato {
  entrada: EntradaCaso;
  horaExtra: HoraExtraCaso;
  caso: CasoRow | null;
}

export type DatosCaso = Omit<CasoRow, 'id' | 'entradaId' | 'guardiaId' | 'sitioId'>;

export abstract class CasosCoberturaRepository {
  /** Jornadas con horas extra abiertas (el guardia sigue en el sitio), con su caso si ya lo hay. */
  abstract candidatos(): Promise<Candidato[]>;
  abstract candidato(entradaId: number): Promise<Candidato | null>;
  /** La jornada abierta (con horas extra abiertas) más reciente de un guardia. */
  abstract candidatoDe(usuarioId: number): Promise<Candidato | null>;
  /** Quien debía entrar a ese sitio después de la salida del guardia y no se ha presentado. */
  abstract relevoDe(
    sitioId: number,
    salidaProgramada: Date,
    excluirUsuarioId: number,
  ): Promise<{ id: number; nombre: string; inicio: Date } | null>;
  /** Crea o reemplaza el caso de esa jornada. */
  abstract guardarCaso(entrada: EntradaCaso, datos: DatosCaso): Promise<CasoRow>;
  abstract actualizarCaso(id: number, datos: Partial<DatosCaso>): Promise<CasoRow>;
  /** Borra el caso (y con él sus días de descanso en pausa): la jornada vuelve a "sin decidir". */
  abstract eliminarCaso(id: number): Promise<void>;
  /** Deja constancia de que el guardia no puede quedarse, con su motivo (A-35). */
  abstract registrarNoPuede(
    horaExtraId: number,
    datos: { en: Date; motivo: string; nota: string | null },
  ): Promise<void>;
  /** Días en que el guardia descansa por el plan (se pausa su turno de ese día). */
  abstract crearPausas(casoId: number, usuarioId: number, fechas: string[]): Promise<void>;
  /** Casos "viene en camino" que ya toca volver a preguntar. */
  abstract paraReconsultar(ahora: Date): Promise<Candidato[]>;
  abstract casoPorEntrada(entradaId: number): Promise<CasoRow | null>;
  abstract guardia(id: number): Promise<{ id: number; nombre: string } | null>;
  /** Marca un aviso como enviado; false si ya lo estaba. */
  abstract marcarEnviado(clave: string): Promise<boolean>;
  /** A quién avisar de un sitio: su supervisor; sin supervisor, los admin. */
  abstract revisoresDe(sitioId: number): Promise<number[]>;
}

const entradaSelect = {
  id: true,
  usuarioId: true,
  registradaEn: true,
  programadaEntrada: true,
  programadaSalida: true,
  usuario: { select: { nombre: true } },
  sitio: { select: { id: true, nombre: true, supervisorId: true } },
} as const;

const casoSelect = {
  id: true,
  entradaId: true,
  guardiaId: true,
  sitioId: true,
  relevoId: true,
  relevoInicio: true,
  estado: true,
  decision: true,
  siguiente: true,
  descansoExtraHoras: true,
  finCubierto: true,
  regresaEn: true,
  limiteExtra: true,
  coberturaId: true,
  resueltoPorId: true,
  reconsultarEn: true,
  motivo: true,
  coberturasIds: true,
  nota: true,
} as const;

type EntradaDb = {
  id: number;
  usuarioId: number;
  registradaEn: Date;
  programadaEntrada: Date | null;
  programadaSalida: Date | null;
  usuario: { nombre: string };
  sitio: { id: number; nombre: string; supervisorId: number | null } | null;
};

const aEntrada = (m: EntradaDb): EntradaCaso | null =>
  m.sitio
    ? {
        id: m.id,
        usuarioId: m.usuarioId,
        guardia: m.usuario.nombre,
        sitio: m.sitio,
        registradaEn: m.registradaEn,
        programadaEntrada: m.programadaEntrada,
        programadaSalida: m.programadaSalida,
      }
    : null;

export class PrismaCasosCoberturaRepository extends CasosCoberturaRepository {
  private async armar(
    rows: {
      entrada: EntradaDb | null;
      id: number;
      estado: EstadoHoraExtra;
      origen: OrigenHoraExtra;
      desde: Date;
      noPuedeEn: Date | null;
      noPuedeMotivo: string | null;
      noPuedeNota: string | null;
    }[],
  ): Promise<Candidato[]> {
    const ids = rows.flatMap((r) => (r.entrada ? [r.entrada.id] : []));
    const casos = ids.length
      ? await getPrisma().casoCobertura.findMany({ where: { entradaId: { in: ids } }, select: casoSelect })
      : [];
    const porEntrada = new Map(casos.map((c) => [c.entradaId, c]));
    const res: Candidato[] = [];
    for (const r of rows) {
      const entrada = r.entrada && aEntrada(r.entrada);
      if (!entrada) continue;
      res.push({
        entrada,
        horaExtra: {
          id: r.id,
          estado: r.estado,
          origen: r.origen,
          desde: r.desde,
          noPuedeEn: r.noPuedeEn,
          noPuedeMotivo: r.noPuedeMotivo,
          noPuedeNota: r.noPuedeNota,
        },
        caso: porEntrada.get(entrada.id) ?? null,
      });
    }
    return res;
  }

  private readonly extraSelect = {
    id: true,
    estado: true,
    origen: true,
    desde: true,
    noPuedeEn: true,
    noPuedeMotivo: true,
    noPuedeNota: true,
    entrada: { select: entradaSelect },
  } as const;

  async candidatos() {
    const rows = await getPrisma().horaExtra.findMany({
      where: { estado: 'abierta', entradaId: { not: null } },
      orderBy: { desde: 'asc' },
      select: this.extraSelect,
    });
    return this.armar(rows);
  }

  async candidato(entradaId: number) {
    const row = await getPrisma().horaExtra.findFirst({
      where: { entradaId, estado: { in: ['abierta', 'por_aprobar', 'sin_salida'] } },
      select: this.extraSelect,
    });
    return row ? ((await this.armar([row]))[0] ?? null) : null;
  }

  async candidatoDe(usuarioId: number) {
    const row = await getPrisma().horaExtra.findFirst({
      where: { usuarioId, estado: 'abierta', entradaId: { not: null } },
      orderBy: { desde: 'desc' },
      select: this.extraSelect,
    });
    return row ? ((await this.armar([row]))[0] ?? null) : null;
  }

  async relevoDe(sitioId: number, salidaProgramada: Date, excluirUsuarioId: number) {
    const fila = await getPrisma().turnoDia.findFirst({
      where: {
        sitioId,
        usuarioId: { not: excluirUsuarioId },
        entradaId: null,
        OR: [{ noSePresentoEn: { not: null } }, { faltaEn: { not: null } }],
        programadaEntrada: {
          gte: new Date(salidaProgramada.getTime() - 60 * 60_000),
          lte: new Date(salidaProgramada.getTime() + 14 * 3_600_000),
        },
      },
      orderBy: { programadaEntrada: 'asc' },
      select: { programadaEntrada: true, usuario: { select: { id: true, nombre: true } } },
    });
    return fila ? { id: fila.usuario.id, nombre: fila.usuario.nombre, inicio: fila.programadaEntrada } : null;
  }

  async guardarCaso(entrada: EntradaCaso, datos: DatosCaso) {
    return getPrisma().casoCobertura.upsert({
      where: { entradaId: entrada.id },
      create: { entradaId: entrada.id, guardiaId: entrada.usuarioId, sitioId: entrada.sitio.id, ...datos },
      update: datos,
      select: casoSelect,
    });
  }

  async actualizarCaso(id: number, datos: Partial<DatosCaso>) {
    return getPrisma().casoCobertura.update({ where: { id }, data: datos, select: casoSelect });
  }

  async registrarNoPuede(horaExtraId: number, { en, motivo, nota }: { en: Date; motivo: string; nota: string | null }) {
    await getPrisma().horaExtra.update({
      where: { id: horaExtraId },
      data: { noPuedeEn: en, noPuedeMotivo: motivo, noPuedeNota: nota },
    });
  }

  async eliminarCaso(id: number) {
    await getPrisma().casoCobertura.delete({ where: { id } });
  }

  async crearPausas(casoId: number, usuarioId: number, fechas: string[]) {
    for (const fecha of new Set(fechas)) {
      await getPrisma().pausaTurno.upsert({
        where: { usuarioId_fecha: { usuarioId, fecha: fechaADate(fecha) } },
        create: { usuarioId, fecha: fechaADate(fecha), casoId },
        update: { casoId, cambioId: null },
      });
    }
  }

  async paraReconsultar(ahora: Date) {
    const casos = await getPrisma().casoCobertura.findMany({
      where: { estado: 'en_espera', reconsultarEn: { lte: ahora } },
      select: { entradaId: true },
    });
    const res: Candidato[] = [];
    for (const c of casos) {
      const cand = await this.candidato(c.entradaId);
      if (cand) res.push(cand);
    }
    return res;
  }

  async casoPorEntrada(entradaId: number) {
    return getPrisma().casoCobertura.findUnique({ where: { entradaId }, select: casoSelect });
  }

  async guardia(id: number) {
    return getPrisma().usuario.findFirst({ where: { id, deletedAt: null }, select: { id: true, nombre: true } });
  }

  async marcarEnviado(clave: string) {
    try {
      await getPrisma().avisoEnviado.create({ data: { clave } });
      return true;
    } catch {
      return false;
    }
  }

  revisoresDe(sitioId: number) {
    return new PrismaAsistenciaRepository().revisoresDe({ sitioId, guardiaId: 0 });
  }
}
