import {
  DESCANSO_MIN_HORAS,
  horaLegible,
  sumarDiasFecha,
  trabajaEl,
  type CandidatoCobertura,
  type CandidatosCoberturaQuery,
  type Cobertura,
  type CoberturaCreada,
  type CoberturaData,
  type CoberturasQuery,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  firmarArchivo,
  hoyISO,
  inicioDelDia,
  type AccionCtx,
} from '../../core';
import type { TurnoProgramado } from '../asistencia/vigilancia';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { Alcance } from '../sitios/alcance';
import type { CoberturasRepository } from './coberturas.repository';

/** Turnos (con sus pausas) de todos los guardias en un rango de fechas. */
export type TurnosFn = (desde: string, hasta: string) => Promise<TurnoProgramado[]>;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** `2026-10-22` → `22 oct` */
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
/** "el 24 oct" o "del 24 al 26 oct". */
const rangoTexto = (desde: string, hasta: string) =>
  desde === hasta ? `el ${fechaCorta(desde)}` : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;

type Intervalo = { inicio: number; fin: number };

const intervalo = (fecha: string, hora: string, horas: number): Intervalo => {
  const inicio =
    inicioDelDia(fecha).getTime() + (Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))) * 60_000;
  return { inicio, fin: inicio + horas * 3_600_000 };
};

function fechasEntre(desde: string, hasta: string) {
  const fechas: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDiasFecha(f, 1)) fechas.push(f);
  return fechas;
}

const prohibido = () => HttpError.forbidden('Solo puedes enviar guardias de tus sitios a tus sitios');

/**
 * Cubrir otro sitio (DA-39, DA-46). El supervisor envía a guardias de sus sitios a sus sitios; el
 * admin, a cualquiera. Se advierte si descansaría menos de 12 h (se puede enviar y queda registrado).
 */
export class CoberturasService extends BaseService {
  constructor(
    private readonly repo: CoberturasRepository,
    private readonly turnos: TurnosFn,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  /**
   * Qué hace cada guardia esos días y cuánto descansaría: primero quienes descansan, luego quienes
   * trabajan (su sitio quedaría en pausa) y al final quienes ya cubren otro sitio.
   */
  async candidatos(q: CandidatosCoberturaQuery, alcance: Alcance | null): Promise<CandidatoCobertura[]> {
    if (alcance && !alcance.sitioIds.has(q.sitioId)) throw prohibido();
    const hasta = q.hasta ?? q.desde;
    const [guardias, turnos] = await Promise.all([
      this.repo.guardiasActivos(),
      this.turnos(sumarDiasFecha(q.desde, -1), sumarDiasFecha(hasta, 1)),
    ]);
    const orden = { descansa: 0, trabaja: 1, cubre: 2 };
    return guardias
      .filter((g) => !alcance || alcance.guardiaIds.has(g.id))
      .map((g) => ({
        guardia: {
          id: g.id,
          nombre: g.nombre,
          email: g.email,
          foto: g.fotoClave && firmarArchivo(g.fotoClave),
        },
        ...this.situacion(g.id, q.desde, hasta, q.horaInicio, q.horas, turnos, q.sitioId),
      }))
      .sort(
        (a, b) =>
          orden[a.estado] - orden[b.estado] ||
          (b.descansoHoras ?? Infinity) - (a.descansoHoras ?? Infinity) ||
          a.guardia.nombre.localeCompare(b.guardia.nombre, 'es'),
      );
  }

  /** Estado del guardia esos días y horas de descanso respecto de sus otros turnos. */
  private situacion(
    usuarioId: number,
    desde: string,
    hasta: string,
    hora: string,
    horas: number,
    turnos: TurnoProgramado[],
    sitioId: number,
  ): Omit<CandidatoCobertura, 'guardia'> {
    const nuevos = fechasEntre(desde, hasta).map((f) => intervalo(f, hora, horas));
    const otros: (Intervalo & { turno: TurnoProgramado })[] = [];
    for (const t of turnos) {
      if (t.guardia.id !== usuarioId || !t.patron.horaInicio) continue;
      const horasTurno = t.patron.horas ?? 12;
      for (const f of fechasEntre(sumarDiasFecha(desde, -1), sumarDiasFecha(hasta, 1))) {
        if (!trabajaEl(f, t.patron)) continue;
        if (!t.coberturaId && t.pausas?.some((p) => f >= p.desde && f <= p.hasta)) continue;
        otros.push({ ...intervalo(f, t.patron.horaInicio, horasTurno), turno: t });
      }
    }
    const cruza = (o: Intervalo) => nuevos.some((n) => o.inicio < n.fin && n.inicio < o.fin);
    const cruces = otros.filter(cruza);
    const cubre = cruces.find((o) => o.turno.coberturaId);
    const trabaja = cruces.find((o) => !o.turno.coberturaId && o.turno.sitio.id !== sitioId);
    // Descanso: lo más corto entre la cobertura y sus otros turnos (los que se cruzan quedan en pausa).
    let descanso: number | null = null;
    for (const o of otros.filter((x) => !cruza(x))) {
      for (const n of nuevos) {
        const gap = o.fin <= n.inicio ? n.inicio - o.fin : o.inicio >= n.fin ? o.inicio - n.fin : null;
        if (gap !== null && (descanso === null || gap < descanso)) descanso = gap;
      }
    }
    const descansoHoras = descanso === null ? null : Math.floor(descanso / 3_600_000);
    if (cubre) return { estado: 'cubre', detalle: `Cubre ${cubre.turno.sitio.nombre}`, descansoHoras };
    if (trabaja) {
      return {
        estado: 'trabaja',
        detalle: `Trabaja en ${trabaja.turno.sitio.nombre} ${horaLegible(trabaja.turno.patron.horaInicio!)}`,
        descansoHoras,
      };
    }
    return { estado: 'descansa', detalle: null, descansoHoras };
  }

  async crear(data: CoberturaData, ctx: AccionCtx, alcance: Alcance | null): Promise<CoberturaCreada> {
    const hasta = data.hasta ?? data.desde;
    if (hasta < this.hoy()) throw HttpError.badRequest('No se puede enviar a cubrir días pasados');
    const sitio = await this.repo.findSitio(data.sitioId);
    if (!sitio || !sitio.activo) throw HttpError.badRequest('Elige un sitio activo');
    const guardia = await this.repo.findGuardia(data.usuarioId);
    if (!guardia || !guardia.activo || guardia.rol !== 'guardia')
      throw HttpError.badRequest('Elige un guardia activo');
    if (alcance && (!alcance.sitioIds.has(sitio.id) || !alcance.guardiaIds.has(guardia.id)))
      throw prohibido();
    if (await this.repo.haySolape(guardia.id, data.desde, hasta)) {
      throw HttpError.conflict(`${guardia.nombre} ya cubre otro sitio esos días`);
    }
    const turnos = await this.turnos(sumarDiasFecha(data.desde, -1), sumarDiasFecha(hasta, 1));
    const sit = this.situacion(guardia.id, data.desde, hasta, data.horaInicio, data.horas, turnos, sitio.id);
    const cubreA = data.cubreAId ? await this.repo.findGuardia(data.cubreAId) : null;

    const cobertura = await this.repo.crear({
      usuarioId: guardia.id,
      sitioId: sitio.id,
      cubreAId: cubreA?.id ?? null,
      desde: data.desde,
      hasta,
      horaInicio: data.horaInicio,
      horas: data.horas,
      motivo: data.motivo,
      descansoHoras: sit.descansoHoras,
      creadaPorId: ctx.actorId,
    });
    const pocoDescanso = sit.descansoHoras !== null && sit.descansoHoras < DESCANSO_MIN_HORAS;
    const advertencia = pocoDescanso ? `${guardia.nombre} descansaría solo ${sit.descansoHoras} h` : null;
    const rango = rangoTexto(data.desde, hasta);
    const horario = `${horaLegible(data.horaInicio)} · ${data.horas} h`;

    await this.audit.registrarAccion(ctx, 'coberturas.crear', 'coberturas', cobertura.id, {
      guardia: guardia.nombre,
      sitio: sitio.nombre,
      desde: data.desde,
      hasta,
      horario,
      motivo: data.motivo,
      cubreA: cubreA?.nombre ?? null,
      descansoHoras: sit.descansoHoras,
      enPausa: sit.estado === 'trabaja' ? sit.detalle : null,
    });
    await this.bitacora({
      usuarioIds: [guardia.id],
      tipo: 'cobertura',
      detalle: `Enviado a cubrir ${sitio.nombre} ${rango} (${horario})${cubreA ? ` en lugar de ${cubreA.nombre}` : ''}. Motivo: ${data.motivo}${
        pocoDescanso ? `. Descansaba solo ${sit.descansoHoras} h` : ''
      }`,
      sitioId: sitio.id,
      actorId: ctx.actorId,
    });
    await this.avisar([guardia.id], {
      tipo: 'asignacion',
      mensaje: `Cubrirás ${sitio.nombre} ${rango}: entras a las ${horaLegible(data.horaInicio)} (${data.horas} h). Motivo: ${data.motivo}`,
      ruta: '/marcar',
    });
    // Supervisores del sitio cubierto y del sitio del guardia (si no fueron ellos quienes lo enviaron).
    const supervisores = new Set([
      ...(sitio.supervisorId ? [sitio.supervisorId] : []),
      ...(await this.repo.supervisoresDeGuardia(guardia.id, this.hoy())),
    ]);
    supervisores.delete(ctx.actorId);
    if (supervisores.size) {
      await this.avisar([...supervisores], {
        tipo: 'asignacion',
        mensaje: `${guardia.nombre} cubrirá ${sitio.nombre} ${rango}${
          sit.estado === 'trabaja'
            ? `; su turno (${sit.detalle?.replace('Trabaja en ', '')}) queda en pausa`
            : ''
        }`,
        ruta: `/asistencia/guardias/${guardia.id}?vista=bitacora`,
      });
    }
    return { cobertura, advertencia };
  }

  async listar(q: CoberturasQuery, alcance: Alcance | null): Promise<Cobertura[]> {
    const lista = await this.repo.listar({ ...q, desde: this.hoy() });
    return lista.filter(
      (c) => !alcance || alcance.sitioIds.has(c.sitio.id) || alcance.guardiaIds.has(c.guardia.id),
    );
  }

  /** Cancela una cobertura vigente o próxima; se avisa al guardia y queda en su bitácora. */
  async cancelar(id: number, ctx: AccionCtx, alcance: Alcance | null) {
    const c = await this.repo.findById(id);
    if (!c || c.canceladaEn) throw HttpError.notFound('Cobertura no encontrada');
    if (alcance && !alcance.sitioIds.has(c.sitio.id)) throw prohibido();
    if (c.hasta < this.hoy()) throw HttpError.conflict('La cobertura ya terminó');
    await this.repo.cancelar(id, this.ahora());
    const rango = rangoTexto(c.desde, c.hasta);
    await this.audit.registrarAccion(ctx, 'coberturas.cancelar', 'coberturas', id, {
      guardia: c.guardia.nombre,
      sitio: c.sitio.nombre,
      desde: c.desde,
      hasta: c.hasta,
    });
    await this.bitacora({
      usuarioIds: [c.guardia.id],
      tipo: 'cobertura_cancelada',
      detalle: `Se canceló su cobertura en ${c.sitio.nombre} ${rango}`,
      sitioId: c.sitio.id,
      actorId: ctx.actorId,
    });
    await this.avisar([c.guardia.id], {
      tipo: 'asignacion',
      mensaje: `Se canceló tu cobertura en ${c.sitio.nombre} ${rango}: regresas a tu sitio`,
      ruta: '/marcar',
    });
  }
}
