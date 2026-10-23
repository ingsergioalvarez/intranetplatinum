import { dateAFecha, fechaADate } from '../../core';
import { getPrisma } from '../../core/data/prisma';
import { turnoDeDb } from '../sitios/sitios.repository';
import { diasDeDb, diasSelect } from '../turnos/dias';
import { PrismaAsistenciaRepository, type DestinoRevision } from './asistencia.repository';
import {
  VigilanciaRepository,
  type EventoVigilancia,
  type TurnoDiaRow,
  type TurnoProgramado,
} from './vigilancia';

const turnoDiaSelect = {
  id: true,
  usuarioId: true,
  sitioId: true,
  programadaEntrada: true,
  avisoGuardiaEn: true,
  noSePresentoEn: true,
  faltaEn: true,
  faltaEventoId: true,
  entradaId: true,
} as const;

export class PrismaVigilanciaRepository extends VigilanciaRepository {
  private readonly asistencia = new PrismaAsistenciaRepository();

  async turnosVigentes(desde: string, hasta: string) {
    const activo = { activo: true, deletedAt: null };
    const rows = await getPrisma().sitioGuardia.findMany({
      where: {
        horaInicio: { not: null },
        desde: { lte: fechaADate(hasta) },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaADate(desde) } }],
        sitio: { deletedAt: null, cliente: { deletedAt: null, estatus: 'activo' } },
        AND: [{ OR: [{ usuario: activo }, { grupo: { deletedAt: null } }] }],
      },
      select: {
        id: true,
        tipo: true,
        turno: true,
        horas: true,
        horaInicio: true,
        horaFin: true,
        desde: true,
        hasta: true,
        ...diasSelect,
        sitio: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
        grupo: {
          select: {
            integrantes: {
              where: { usuario: activo },
              select: { usuario: { select: { id: true, nombre: true } } },
            },
          },
        },
      },
    });
    const turnos: TurnoProgramado[] = [];
    for (const r of rows) {
      const patron = {
        tipo: r.tipo,
        turno: turnoDeDb(r.turno),
        horas: r.horas,
        dias: diasDeDb(r),
        horaInicio: r.horaInicio,
        horaFin: r.horaFin,
        desde: dateAFecha(r.desde),
        hasta: r.hasta && dateAFecha(r.hasta),
      };
      const guardias = r.usuario ? [r.usuario] : (r.grupo?.integrantes.map((i) => i.usuario) ?? []);
      for (const guardia of guardias) turnos.push({ asignacionId: r.id, sitio: r.sitio, guardia, patron });
    }
    // Coberturas (DA-39): se vigilan como un turno más, y pausan el turno normal de quien cubre.
    const coberturas = await getPrisma().cobertura.findMany({
      where: { canceladaEn: null, desde: { lte: fechaADate(hasta) }, hasta: { gte: fechaADate(desde) } },
      select: {
        id: true,
        desde: true,
        hasta: true,
        horaInicio: true,
        horas: true,
        sitio: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
      },
    });
    const pausas = new Map<number, { desde: string; hasta: string }[]>();
    for (const c of coberturas) {
      const dias = { desde: dateAFecha(c.desde), hasta: dateAFecha(c.hasta) };
      pausas.set(c.usuario.id, [...(pausas.get(c.usuario.id) ?? []), dias]);
      turnos.push({
        asignacionId: null,
        coberturaId: c.id,
        sitio: c.sitio,
        guardia: c.usuario,
        patron: {
          tipo: 'temporal',
          horas: c.horas,
          dias: { tipo: 'diario' },
          horaInicio: c.horaInicio,
          horaFin: null,
          ...dias,
        },
      });
    }
    for (const t of turnos) if (!t.coberturaId) t.pausas = pausas.get(t.guardia.id);
    return turnos;
  }

  async huboEntrada(usuarioId: number, desde: Date, hasta: Date) {
    const n = await getPrisma().marcacion.count({
      where: { usuarioId, tipo: 'entrada', registradaEn: { gte: desde, lte: hasta } },
    });
    return n > 0;
  }

  async findTurnoDia(usuarioId: number, programadaEntrada: Date) {
    return getPrisma().turnoDia.findUnique({
      where: { usuarioId_programadaEntrada: { usuarioId, programadaEntrada } },
      select: turnoDiaSelect,
    });
  }

  async crearTurnoDia(data: {
    usuarioId: number;
    sitioId: number;
    asignacionId: number | null;
    programadaEntrada: Date;
  }) {
    return getPrisma().turnoDia.create({ data, select: turnoDiaSelect });
  }

  async actualizarTurnoDia(id: number, data: Partial<Omit<TurnoDiaRow, 'id'>>) {
    await getPrisma().turnoDia.update({ where: { id }, data });
  }

  async sinEntrada(usuarioId: number, desde: Date) {
    const rows = await getPrisma().turnoDia.findMany({
      where: { usuarioId, entradaId: null, programadaEntrada: { gte: desde } },
      select: { ...turnoDiaSelect, sitio: { select: { nombre: true } } },
    });
    return rows.map(({ sitio, ...r }) => ({ ...r, sitio: sitio.nombre }));
  }

  async crearEvento({ usuarioId, tipo, detalle, sitioId, ocurrioEn, datos }: EventoVigilancia) {
    const e = await getPrisma().eventoBitacora.create({
      data: { usuarioId, tipo, detalle, sitioId, ocurrioEn, datos },
      select: { id: true },
    });
    return e.id;
  }

  async completarEvento(id: number, datos: Record<string, string | number | boolean | null>) {
    const e = await getPrisma().eventoBitacora.findUnique({ where: { id }, select: { datos: true } });
    const previos = (e?.datos ?? {}) as Record<string, string | number | boolean | null>;
    await getPrisma().eventoBitacora.update({ where: { id }, data: { datos: { ...previos, ...datos } } });
  }

  revisoresDe(destino: DestinoRevision) {
    return this.asistencia.revisoresDe(destino);
  }
}
