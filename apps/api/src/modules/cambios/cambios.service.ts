import {
  PERMISOS,
  ROLES,
  horaLegible,
  sumarDiasFecha,
  trabajaEl,
  type CambioTurno,
  type CambiosTurnoQuery,
  type NuevoCambioTurnoData,
  type OpcionesCambioTurno,
  type Paginated,
  type PatronTurno,
  type ResolverCambioTurnoInput,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseService,
  HttpError,
  hoyISO,
  tienePermiso,
  type AccionCtx,
  type AuthUser,
} from '../../core';
import type { TurnoProgramado } from '../asistencia/vigilancia';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import type { TurnosFn } from '../coberturas/coberturas.service';
import type { Alcance } from '../sitios/alcance';
import type { CambioRow, CambiosRepository } from './cambios.repository';

/** Lo que este módulo necesita de las coberturas (que son las que ponen al compañero en el turno). */
export interface CoberturasPuerto {
  crear(
    d: {
      usuarioId: number;
      sitioId: number;
      desde: string;
      horaInicio: string;
      horas: number;
      motivo: string;
      cubreAId?: number;
    },
    ctx: AccionCtx,
  ): Promise<{ cobertura: { id: number } }>;
  cancelar(id: number, ctx: AccionCtx): Promise<void>;
}

/** Hasta cuántos días adelante se puede pedir un cambio. */
const DIAS_MAX_ADELANTE = 60;
/** Días de turnos que se le muestran al guardia para elegir. */
const DIAS_MIS_TURNOS = 21;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

/** Horas del turno de un patrón (mismas reglas que el resto del sistema). */
function horasDe(p: PatronTurno): number {
  if (p.horas) return p.horas;
  if (p.turno === '24x24') return 24;
  if (p.turno === '12x12') return 12;
  if (p.horaInicio && p.horaFin) {
    const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    return ((m(p.horaFin) - m(p.horaInicio) + 1440) % 1440 || 1440) / 60;
  }
  return 12;
}

/** Turno normal (no cobertura) que le toca al guardia ese día y no está en pausa. */
const turnoDelDia = (turnos: TurnoProgramado[], guardiaId: number, fecha: string) =>
  turnos.find(
    (t) =>
      t.guardia.id === guardiaId &&
      !t.coberturaId &&
      !!t.patron.horaInicio &&
      trabajaEl(fecha, t.patron) &&
      !t.pausas?.some((p) => fecha >= p.desde && fecha <= p.hasta),
  );

const noEsDeEllos = () => HttpError.notFound('Cambio de turno no encontrado');

/**
 * Cambios de turno (TC-22, DA-54). El guardia pide y el supervisor aprueba; si lo hace el supervisor
 * (o el admin) queda aplicado al momento. Al aprobarse: el compañero cubre con una cobertura y el
 * turno cubierto (o el día de descanso movido) queda en pausa, sin falta.
 */
export class CambiosService extends BaseService {
  constructor(
    private readonly repo: CambiosRepository,
    private readonly turnos: TurnosFn,
    private readonly coberturas: CoberturasPuerto,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly ahora: () => Date = () => new Date(),
  ) {
    super();
  }

  private esGuardia = (user: AuthUser) => user.rol === ROLES.GUARDIA;

  private aCambio(r: CambioRow): CambioTurno {
    return {
      id: r.id,
      tipo: r.tipo,
      estado: r.estado,
      vencido: r.estado === 'pendiente' && (r.fecha < this.hoy() || (r.fechaNueva ?? r.fecha) < this.hoy()),
      guardia: r.guardia,
      solicitante: r.solicitante,
      sitio: { id: r.sitio.id, nombre: r.sitio.nombre },
      fecha: r.fecha,
      fechaNueva: r.fechaNueva,
      cubre: r.cubre,
      motivo: r.motivo,
      horario: `${horaLegible(r.horaInicio)} · ${r.horas} h`,
      resolucion: r.resueltoEn
        ? { por: r.resueltoPor, en: r.resueltoEn.toISOString(), nota: r.notaResolucion }
        : null,
      creadoEn: r.createdAt.toISOString(),
    };
  }

  /** Quien aprueba: el supervisor del sitio o, si no tiene, los admins. */
  private async aprobadores(r: CambioRow) {
    return r.sitio.supervisorId ? [r.sitio.supervisorId] : await this.repo.admins();
  }

  /** Guardias y turnos entre los que puede elegir quien pide. */
  async opciones(user: AuthUser, alcance: Alcance | null): Promise<OpcionesCambioTurno> {
    const hoy = this.hoy();
    const turnos = await this.turnos(hoy, sumarDiasFecha(hoy, DIAS_MIS_TURNOS));
    const todos = await this.repo.guardiasActivos();
    if (this.esGuardia(user)) {
      const misSitios = new Set(turnos.filter((t) => t.guardia.id === user.id).map((t) => t.sitio.id));
      const companeros = new Map(
        turnos
          .filter((t) => misSitios.has(t.sitio.id) && t.guardia.id !== user.id)
          .map((t) => [t.guardia.id, { id: t.guardia.id, nombre: t.guardia.nombre }]),
      );
      const misTurnos: OpcionesCambioTurno['misTurnos'] = [];
      for (let f = hoy; f <= sumarDiasFecha(hoy, DIAS_MIS_TURNOS); f = sumarDiasFecha(f, 1)) {
        const t = turnoDelDia(turnos, user.id, f);
        if (t) misTurnos.push({ fecha: f, sitio: t.sitio.nombre, horario: `${horaLegible(t.patron.horaInicio!)} · ${horasDe(t.patron)} h` });
      }
      return {
        companeros: [...companeros.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        guardias: [],
        misTurnos,
      };
    }
    const lista = todos.filter((g) => !alcance || alcance.guardiaIds.has(g.id));
    return { companeros: todos, guardias: lista, misTurnos: [] };
  }

  /** Pide o hace un cambio de turno. */
  async crear(
    data: NuevoCambioTurnoData,
    user: AuthUser,
    ctx: AccionCtx,
    alcance: Alcance | null,
  ): Promise<CambioTurno> {
    const guardia = this.esGuardia(user)
      ? { id: user.id }
      : data.guardiaId
        ? { id: data.guardiaId }
        : null;
    if (!guardia) throw HttpError.badRequest('Elige un guardia');
    if (this.esGuardia(user) && !tienePermiso(user, PERMISOS.ASISTENCIA_MARCAR)) throw HttpError.forbidden();
    const persona = await this.repo.findGuardia(guardia.id);
    if (!persona || !persona.activo || persona.rol !== ROLES.GUARDIA) {
      throw HttpError.badRequest('Elige un guardia activo');
    }
    if (!this.esGuardia(user) && alcance && !alcance.guardiaIds.has(persona.id)) throw noEsDeEllos();

    const hoy = this.hoy();
    const fechas = [data.fecha, ...(data.fechaNueva ? [data.fechaNueva] : [])];
    if (fechas.some((f) => f < hoy)) throw HttpError.badRequest('No se pueden cambiar días pasados');
    if (fechas.some((f) => f > sumarDiasFecha(hoy, DIAS_MAX_ADELANTE))) {
      throw HttpError.badRequest(`Solo se pueden pedir cambios dentro de los próximos ${DIAS_MAX_ADELANTE} días`);
    }

    const desde = sumarDiasFecha(fechas.slice().sort()[0], -1);
    const hasta = sumarDiasFecha(fechas.slice().sort().at(-1)!, 1);
    const turnos = await this.turnos(desde, hasta);
    const turno = turnoDelDia(turnos, persona.id, data.fecha);
    if (!turno) throw HttpError.badRequest(`${persona.nombre} no tiene turno el ${fechaCorta(data.fecha)}`);
    if (alcance && !alcance.sitioIds.has(turno.sitio.id) && !this.esGuardia(user)) throw noEsDeEllos();
    if (await this.repo.hayCambio(persona.id, data.fecha)) {
      throw HttpError.conflict('Ya hay un cambio pedido o aprobado para ese día');
    }

    let cubre: { id: number; nombre: string } | null = null;
    if (data.tipo === 'cubrir') {
      const c = await this.repo.findGuardia(data.cubreId!);
      if (!c || !c.activo || c.rol !== ROLES.GUARDIA || c.id === persona.id) {
        throw HttpError.badRequest('Elige a un compañero activo');
      }
      if (!this.esGuardia(user) && alcance && !alcance.guardiaIds.has(c.id)) throw noEsDeEllos();
      cubre = { id: c.id, nombre: c.nombre };
    } else {
      const nueva = data.fechaNueva!;
      const p = turno.patron;
      if (nueva < p.desde || (p.hasta && nueva > p.hasta)) {
        throw HttpError.badRequest('Ese día queda fuera de la vigencia de tu asignación');
      }
      if (turnoDelDia(turnos, persona.id, nueva) || trabajaEl(nueva, p)) {
        throw HttpError.badRequest(`${persona.nombre} ya trabaja el ${fechaCorta(nueva)}: elige un día de descanso`);
      }
    }

    const fila = await this.repo.crear({
      tipo: data.tipo,
      estado: 'pendiente',
      usuarioId: persona.id,
      solicitanteId: user.id,
      sitioId: turno.sitio.id,
      fecha: data.fecha,
      fechaNueva: data.tipo === 'descanso' ? data.fechaNueva! : null,
      cubreId: cubre?.id ?? null,
      motivo: data.motivo,
      horaInicio: turno.patron.horaInicio!,
      horas: horasDe(turno.patron),
    });
    await this.audit.registrarAccion(ctx, 'cambios_turno.crear', 'cambios_turno', fila.id, {
      tipo: data.tipo,
      guardia: persona.nombre,
      fecha: data.fecha,
      fechaNueva: data.fechaNueva ?? null,
      cubre: cubre?.nombre ?? null,
      motivo: data.motivo,
    });

    if (!this.esGuardia(user)) return this.aplicar(fila, ctx, user.id, null);

    // Lo pidió el guardia: espera al supervisor.
    const aprobadores = (await this.aprobadores(fila)).filter((id) => id !== user.id);
    await this.avisar(aprobadores, {
      tipo: 'asignacion',
      mensaje: `${persona.nombre} pide ${this.resumen(fila)}. Motivo: ${fila.motivo}`,
      ruta: '/asistencia/cambios',
    });
    return this.aCambio(fila);
  }

  /** Frase corta de lo que se cambia. */
  private resumen(r: CambioRow) {
    return r.tipo === 'cubrir'
      ? `que ${r.cubre?.nombre ?? 'un compañero'} lo cubra el ${fechaCorta(r.fecha)} en ${r.sitio.nombre}`
      : `descansar el ${fechaCorta(r.fecha)} y trabajar el ${fechaCorta(r.fechaNueva!)} en ${r.sitio.nombre}`;
  }

  /**
   * Pone el cambio en marcha: el compañero entra por una cobertura, y el guardia queda sin turno ese
   * día (pausa) para que no cuente como falta.
   */
  private async aplicar(
    r: CambioRow,
    ctx: AccionCtx,
    resueltoPorId: number | null,
    nota: string | null,
  ): Promise<CambioTurno> {
    const motivo = (r.tipo === 'cubrir' ? `Cambio de turno de ${r.guardia.nombre}: ` : 'Cambio de descanso: ') + r.motivo;
    const { cobertura } = await this.coberturas.crear(
      r.tipo === 'cubrir'
        ? {
            usuarioId: r.cubre!.id,
            sitioId: r.sitio.id,
            desde: r.fecha,
            horaInicio: r.horaInicio,
            horas: r.horas,
            motivo: motivo.slice(0, 255),
            cubreAId: r.guardia.id,
          }
        : {
            usuarioId: r.guardia.id,
            sitioId: r.sitio.id,
            desde: r.fechaNueva!,
            horaInicio: r.horaInicio,
            horas: r.horas,
            motivo: motivo.slice(0, 255),
          },
      ctx,
    );
    await this.repo.crearPausa(r.guardia.id, r.fecha, r.id);
    await this.repo.resolver(r.id, {
      estado: 'aprobado',
      resueltoPorId,
      en: this.ahora(),
      nota,
      coberturaId: cobertura.id,
    });
    await this.audit.registrarAccion(ctx, 'cambios_turno.aprobar', 'cambios_turno', r.id, {
      guardia: r.guardia.nombre,
      tipo: r.tipo,
      fecha: r.fecha,
      fechaNueva: r.fechaNueva,
    });
    const detalle = `Cambio de turno aprobado: ${this.resumen(r)}. Motivo: ${r.motivo}`;
    await this.bitacora({
      usuarioIds: [r.guardia.id, ...(r.cubre ? [r.cubre.id] : [])],
      tipo: 'asignacion_cambio',
      detalle,
      sitioId: r.sitio.id,
      actorId: ctx.actorId,
    });
    const quienes = new Set([r.guardia.id, r.solicitante.id]);
    quienes.delete(ctx.actorId);
    await this.avisar([...quienes], {
      tipo: 'asignacion',
      mensaje: `Se aprobó tu cambio de turno: ${this.resumen(r)}`,
      ruta: '/mis-sitios',
    });
    const actualizada = await this.repo.findById(r.id);
    return this.aCambio(actualizada!);
  }

  private async cargar(id: number, user: AuthUser, alcance: Alcance | null) {
    const r = await this.repo.findById(id);
    if (!r) throw noEsDeEllos();
    if (this.esGuardia(user)) {
      if (![r.guardia.id, r.solicitante.id, r.cubre?.id].includes(user.id)) throw noEsDeEllos();
    } else if (
      alcance &&
      !alcance.sitioIds.has(r.sitio.id) &&
      !alcance.guardiaIds.has(r.guardia.id) &&
      r.solicitante.id !== user.id
    ) {
      throw noEsDeEllos();
    }
    return r;
  }

  async listar(
    q: CambiosTurnoQuery,
    user: AuthUser,
    alcance: Alcance | null,
  ): Promise<Paginated<CambioTurno> & { pendientes: number }> {
    const { items, total } = await this.repo.listar({
      estado: q.estado,
      guardiaId: q.guardiaId,
      propios: this.esGuardia(user) ? user.id : undefined,
      alcance: alcance
        ? { sitioIds: [...alcance.sitioIds], guardiaIds: [...alcance.guardiaIds], usuarioId: user.id }
        : undefined,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    const pendientes = this.esGuardia(user) ? 0 : await this.repo.pendientes(alcance ? [...alcance.sitioIds] : null);
    return { items: items.map((r) => this.aCambio(r)), total, page: q.page, limit: q.limit, pendientes };
  }

  /** El supervisor (o admin) aprueba o rechaza lo que pidió un guardia. */
  async resolver(
    id: number,
    d: ResolverCambioTurnoInput,
    user: AuthUser,
    ctx: AccionCtx,
    alcance: Alcance | null,
  ): Promise<CambioTurno> {
    if (this.esGuardia(user)) throw HttpError.forbidden();
    const r = await this.cargar(id, user, alcance);
    if (alcance && !alcance.sitioIds.has(r.sitio.id)) throw noEsDeEllos();
    if (r.estado !== 'pendiente') throw HttpError.conflict('Este cambio ya se resolvió');
    const nota = d.nota?.trim() || null;
    if (d.decision === 'rechazar') {
      await this.repo.resolver(r.id, { estado: 'rechazado', resueltoPorId: user.id, en: this.ahora(), nota });
      await this.audit.registrarAccion(ctx, 'cambios_turno.rechazar', 'cambios_turno', r.id, {
        guardia: r.guardia.nombre,
        nota,
      });
      await this.avisar([r.solicitante.id], {
        tipo: 'asignacion',
        mensaje: `Se rechazó tu cambio de turno (${this.resumen(r)})${nota ? `: ${nota}` : ''}`,
        ruta: '/mis-sitios',
      });
      return this.aCambio((await this.repo.findById(r.id))!);
    }
    if ((r.fechaNueva ?? r.fecha) < this.hoy() || r.fecha < this.hoy()) {
      throw HttpError.conflict('La fecha de este cambio ya pasó');
    }
    return this.aplicar(r, ctx, user.id, nota);
  }

  /**
   * Cancela: el guardia su propia solicitud mientras está pendiente; el supervisor también un cambio
   * ya aprobado que aún no ocurre (se deshace la cobertura y vuelve su turno).
   */
  async cancelar(id: number, user: AuthUser, ctx: AccionCtx, alcance: Alcance | null): Promise<CambioTurno> {
    const r = await this.cargar(id, user, alcance);
    if (r.estado === 'pendiente') {
      if (this.esGuardia(user) && r.solicitante.id !== user.id) throw HttpError.forbidden();
    } else if (r.estado === 'aprobado') {
      if (this.esGuardia(user)) throw HttpError.forbidden('Pídele a tu supervisor que lo cancele');
      if (r.fecha < this.hoy() || (r.fechaNueva ?? r.fecha) < this.hoy()) {
        throw HttpError.conflict('El cambio ya ocurrió');
      }
      if (alcance && !alcance.sitioIds.has(r.sitio.id)) throw noEsDeEllos();
      if (r.coberturaId) await this.coberturas.cancelar(r.coberturaId, ctx).catch(() => undefined);
      await this.repo.borrarPausas(r.id);
    } else {
      throw HttpError.conflict('Este cambio ya no se puede cancelar');
    }
    await this.repo.resolver(r.id, {
      estado: 'cancelado',
      resueltoPorId: this.esGuardia(user) ? null : user.id,
      en: this.ahora(),
      nota: null,
    });
    await this.audit.registrarAccion(ctx, 'cambios_turno.cancelar', 'cambios_turno', r.id, {
      guardia: r.guardia.nombre,
      eraAprobado: r.estado === 'aprobado',
    });
    if (r.estado === 'aprobado') {
      await this.bitacora({
        usuarioIds: [r.guardia.id, ...(r.cubre ? [r.cubre.id] : [])],
        tipo: 'asignacion_cambio',
        detalle: `Se canceló el cambio de turno: ${this.resumen(r)}`,
        sitioId: r.sitio.id,
        actorId: ctx.actorId,
      });
    }
    const avisados = new Set([r.guardia.id, r.solicitante.id, ...(r.cubre && r.estado === 'aprobado' ? [r.cubre.id] : [])]);
    avisados.delete(user.id);
    if (!this.esGuardia(user) || r.estado === 'aprobado') {
      await this.avisar([...avisados], {
        tipo: 'asignacion',
        mensaje: `Se canceló el cambio de turno (${this.resumen(r)})`,
        ruta: '/mis-sitios',
      });
    } else {
      await this.avisar((await this.aprobadores(r)).filter((x) => x !== user.id), {
        tipo: 'asignacion',
        mensaje: `${r.guardia.nombre} canceló su solicitud de cambio (${this.resumen(r)})`,
        ruta: '/asistencia/cambios',
      });
    }
    return this.aCambio((await this.repo.findById(r.id))!);
  }
}
