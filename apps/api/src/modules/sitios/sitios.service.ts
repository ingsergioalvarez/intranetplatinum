import {
  ROLES,
  TURNO_LABEL,
  calcularVigenteHasta,
  esTurnoJornada,
  horaLegible,
  horaSalida,
  horaSalidaTurno,
  mismoHorario,
  seCruzan,
  sumarDiasFecha,
  textoDias,
  type Asignacion,
  type AsignacionCreateData,
  type AsignacionUpdate,
  type AsignarTurnoData,
  type GuardiaDisponible,
  type MiSitio,
  type PatronTurno,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, firmarArchivo, hoyISO, type AccionCtx } from '../../core';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { AsignacionData, CambioAsignacion, SitiosRepository, TurnoEstado } from './sitios.repository';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** `2026-10-22` → `22 oct` */
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

/**
 * "12 h · entrada 8:00 a.m. (todos los días)"; en eventos, "6:00 p.m. a 2:00 a.m."; en asignaciones
 * anteriores al catálogo, "Turno de 24 h · entrada 8:00 a.m.".
 */
function horario(a: Pick<Asignacion, 'tipo' | 'turno' | 'horaInicio' | 'horaFin' | 'horas' | 'dias'>) {
  if (a.tipo === 'eventual' && a.horaInicio && a.horaFin) {
    return `${horaLegible(a.horaInicio)} a ${horaLegible(a.horaFin)}`;
  }
  if (a.horas && a.horaInicio) {
    return `${a.horas} h · entrada ${horaLegible(a.horaInicio)}${a.dias ? ` (${textoDias(a.dias).toLowerCase()})` : ''}`;
  }
  const turno = a.turno ? `Turno de ${TURNO_LABEL[a.turno]}` : null;
  return [turno, a.horaInicio && `entrada ${horaLegible(a.horaInicio)}`].filter(Boolean).join(' · ');
}

const solape = (quien: 'guardia' | 'grupo') =>
  HttpError.conflict(`El ${quien} ya tiene asignado este sitio en esas fechas`, [
    { path: 'desde', message: `Se cruza con otra asignación del mismo ${quien} en este sitio` },
  ]);

const invalido = (path: string, message: string) =>
  HttpError.badRequest('Datos inválidos', [{ path, message }]);

/** Asignación de sitios a guardias o grupos (F2-05, F2-07, D-017) y "mis sitios" del guardia. */
export class SitiosService extends BaseService {
  constructor(
    private readonly repo: SitiosRepository,
    private readonly audit: AuditLogger,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly bitacora: RegistrarBitacora = sinBitacora,
  ) {
    super();
  }

  /** A quién avisar de una asignación: el guardia o los integrantes del grupo (DA-34). */
  private async destinatarios(a: { guardia?: { id: number } | null; grupo?: { id: number } | null }) {
    if (a.guardia) return [a.guardia.id];
    return a.grupo ? this.repo.integrantesGrupo(a.grupo.id) : [];
  }

  async listAsignaciones(sitioId: number, incluirTerminadas: boolean): Promise<Asignacion[]> {
    await this.sitio(sitioId);
    return this.repo.listAsignaciones(sitioId, this.hoy(), incluirTerminadas);
  }

  async asignar(sitioId: number, data: AsignacionCreateData, ctx: AccionCtx): Promise<Asignacion> {
    const sitio = await this.sitio(sitioId);
    if (sitio.deletedAt || sitio.clienteDeBaja) {
      throw HttpError.conflict('No se pueden asignar guardias a un sitio o cliente dado de baja');
    }

    let destinatario: string;
    if (data.usuarioId) {
      const guardia = await this.repo.findGuardia(data.usuarioId);
      if (!guardia || guardia.deletedAt || guardia.rol !== ROLES.GUARDIA) {
        throw invalido('usuarioId', 'Selecciona un guardia activo');
      }
      destinatario = guardia.nombre;
    } else {
      const grupo = await this.repo.findGrupo(data.grupoId!);
      if (!grupo || grupo.deletedAt) throw invalido('grupoId', 'Selecciona un grupo activo');
      destinatario = `Grupo ${grupo.nombre}`;
    }

    const nueva = {
      sitioId,
      ...data,
      // Eventual: horario de inicio y término. Fija/temporal: turno de 24 o 12 h desde la hora de
      // entrada; la salida se calcula (DA-32).
      turno: data.tipo === 'eventual' ? null : data.turno,
      horaInicio: data.horaInicio,
      horaFin:
        data.tipo === 'eventual'
          ? data.horaFin
          : esTurnoJornada(data.turno) && data.horaInicio
            ? horaSalidaTurno(data.turno, data.horaInicio)
            : null,
      vigenteHasta: calcularVigenteHasta(data),
    };
    if (await this.repo.haySolape(nueva)) throw solape(data.usuarioId ? 'guardia' : 'grupo');

    const asignacion = await this.repo.createAsignacion(nueva, this.hoy());
    await this.audit.registrarAccion(ctx, 'sitios.asignar', 'sitio_guardia', asignacion.id, {
      sitioId,
      clienteId: sitio.clienteId,
      destinatario,
      tipo: data.tipo,
      desde: data.desde,
      hasta: data.hasta ?? null,
    });
    const quien = asignacion.grupo ? `Tu grupo ${asignacion.grupo.nombre} fue asignado` : 'Te asignaron';
    const quienes = await this.destinatarios(asignacion);
    await this.bitacora({
      usuarioIds: quienes,
      tipo: 'asignacion',
      detalle: `Asignado a ${sitio.nombre}${asignacion.grupo ? ` con el grupo ${asignacion.grupo.nombre}` : ''}: ${[
        horario(asignacion),
        `desde el ${fechaCorta(asignacion.desde)}`,
        asignacion.hasta && `hasta el ${fechaCorta(asignacion.hasta)}`,
      ]
        .filter(Boolean)
        .join(' · ')}`,
      sitioId,
      actorId: ctx.actorId,
    });
    await this.avisar(quienes, {
      tipo: 'asignacion',
      titulo: asignacion.grupo ? 'Tu grupo fue asignado a un sitio' : 'Te asignaron a un sitio',
      mensaje: `${quien} a ${sitio.nombre}: ${[
        horario(asignacion),
        `desde el ${fechaCorta(asignacion.desde)}`,
      ]
        .filter(Boolean)
        .join(' · ')}`,
      ruta: '/mis-sitios',
    });
    return asignacion;
  }

  /** Cambia turno, hora de entrada o fecha de término (terminar = `hasta` hoy; `null` = sin término). */
  async actualizarAsignacion(
    sitioId: number,
    asignacionId: number,
    data: AsignacionUpdate,
    ctx: AccionCtx,
  ): Promise<Asignacion> {
    const hoy = this.hoy();
    const actual = await this.repo.findAsignacion(asignacionId, hoy);
    if (!actual || actual.sitioId !== sitioId) throw HttpError.notFound('Asignación no encontrada');

    let vigenteHasta: string | null | undefined;
    if (data.hasta !== undefined) {
      if (data.hasta && data.hasta < actual.desde) {
        throw invalido('hasta', 'Debe ser igual o posterior a la fecha de inicio');
      }
      if (data.hasta === null && actual.tipo !== 'fija') {
        throw invalido('hasta', 'Solo las asignaciones fijas pueden quedar sin fecha de término');
      }
      vigenteHasta = calcularVigenteHasta({ ...actual, hasta: data.hasta });
      const rango = {
        sitioId,
        usuarioId: actual.guardia?.id,
        grupoId: actual.grupo?.id,
        desde: actual.desde,
        vigenteHasta,
      };
      if (await this.repo.haySolape(rango, asignacionId)) throw solape(actual.guardia ? 'guardia' : 'grupo');
    }

    // Turno y hora de entrada solo en fija/temporal; la salida se recalcula (DA-32). Con un turno
    // del catálogo se copia su horario (DA-37).
    let horario_: CambioAsignacion = {};
    if (actual.tipo !== 'eventual' && data.turnoId) {
      const turno = await this.repo.findTurno(data.turnoId);
      if (!turno || !turno.activo) throw invalido('turnoId', 'Elige un turno activo');
      horario_ = {
        turnoId: turno.id,
        horas: turno.horas,
        dias: turno.dias,
        turno: null,
        horaInicio: turno.horaEntrada,
        horaFin: horaSalida(turno.horas, turno.horaEntrada),
      };
    } else if (actual.tipo !== 'eventual' && (data.turno || data.horaInicio)) {
      const turno = data.turno ?? (esTurnoJornada(actual.turno) ? actual.turno : '24x24');
      const horaInicio = data.horaInicio ?? actual.horaInicio;
      if (!horaInicio) throw invalido('horaInicio', 'Indica la hora de entrada');
      horario_ = { turno, horaInicio, horaFin: horaSalidaTurno(turno, horaInicio) };
    }

    await this.repo.updateAsignacion(asignacionId, { ...horario_, hasta: data.hasta, vigenteHasta });
    const { vigenteHasta: _vh, ...asignacion } = (await this.repo.findAsignacion(asignacionId, hoy))!;
    await this.audit.registrarAccion(ctx, 'sitios.editar_asignacion', 'sitio_guardia', asignacionId, {
      sitioId,
      antes: { turno: actual.turno, horaInicio: actual.horaInicio, hasta: actual.hasta },
      despues: { turno: asignacion.turno, horaInicio: asignacion.horaInicio, hasta: asignacion.hasta },
    });

    const sitio = await this.sitio(sitioId);
    const cambios = [
      horario_.horaInicio && `nuevo horario: ${horario(asignacion)}`,
      data.hasta !== undefined &&
        data.hasta !== actual.hasta &&
        data.hasta &&
        `termina el ${fechaCorta(data.hasta)}`,
    ].filter(Boolean);
    const quienes = await this.destinatarios(asignacion);
    const enSitio = `${sitio.nombre}${asignacion.grupo ? ` (grupo ${asignacion.grupo.nombre})` : ''}`;
    if (horario_.horaInicio) {
      await this.bitacora({
        usuarioIds: quienes,
        tipo: 'asignacion_cambio',
        detalle: `Nuevo horario en ${enSitio}: ${horario(asignacion)}`,
        sitioId,
        actorId: ctx.actorId,
      });
    }
    if (data.hasta !== undefined && data.hasta !== actual.hasta) {
      await this.bitacora({
        usuarioIds: quienes,
        tipo: data.hasta ? 'asignacion_fin' : 'asignacion_cambio',
        detalle: data.hasta
          ? `Su asignación en ${enSitio} termina el ${fechaCorta(data.hasta)}`
          : `Su asignación en ${enSitio} quedó sin fecha de término`,
        sitioId,
        actorId: ctx.actorId,
      });
    }
    if (cambios.length) {
      await this.avisar(quienes, {
        tipo: 'asignacion',
        titulo: horario_.horaInicio
          ? asignacion.grupo
            ? 'Cambió el horario de tu grupo'
            : 'Cambió tu horario'
          : asignacion.grupo
            ? 'Cambió la asignación de tu grupo'
            : 'Cambió la fecha de término',
        mensaje: `${asignacion.grupo ? `Tu grupo ${asignacion.grupo.nombre} en` : 'Tu asignación en'} ${sitio.nombre}: ${cambios.join(' · ')}`,
        ruta: '/mis-sitios',
      });
    }
    return asignacion;
  }

  /** Guardias activos con su foto y lo que ya tienen asignado (para elegir a quién asignar). */
  async guardiasDisponibles(): Promise<GuardiaDisponible[]> {
    const guardias = await this.repo.guardiasActivos();
    const asignaciones = await this.repo.asignacionesDeGuardias(
      guardias.map((g) => g.id),
      this.hoy(),
    );
    return guardias.map(({ fotoClave, ...g }) => ({
      ...g,
      foto: fotoClave ? firmarArchivo(fotoClave) : null,
      asignaciones: asignaciones.get(g.id) ?? [],
    }));
  }

  /**
   * Asigna un turno del catálogo en el sitio a varios guardias y/o grupos a la vez (DA-37), cada
   * uno con su primer día de turno. Todo o nada. Reglas con lo que ya tiene cada guardia:
   * - Mismo sitio y mismo horario (p. ej. pasa a una cuadrilla con su mismo turno): su asignación
   *   individual se reemplaza por la nueva, sin aviso de horario (no le cambia nada).
   * - Mismo sitio y otro horario: solo si viene en `reemplazar` (el supervisor eligió cambiarlo);
   *   su asignación anterior termina un día antes. Si no, se rechaza para que lo decida.
   * - Otro sitio: se rechaza solo si los horarios se enciman.
   * Avisa a cada guardia de su nuevo sitio u horario.
   */
  async asignarTurno(sitioId: number, data: AsignarTurnoData, ctx: AccionCtx) {
    const sitio = await this.sitio(sitioId);
    if (sitio.deletedAt || sitio.clienteDeBaja) {
      throw HttpError.conflict('No se pueden asignar guardias a un sitio o cliente dado de baja');
    }
    const turno = await this.repo.findTurno(data.turnoId);
    if (!turno || !turno.activo) throw invalido('turnoId', 'Elige un turno activo');
    const hoy = this.hoy();
    const tipo = data.hasta ? ('temporal' as const) : ('fija' as const);
    const patron = (desde: string): PatronTurno => ({
      tipo,
      horas: turno.horas,
      dias: turno.dias,
      horaInicio: turno.horaEntrada,
      horaFin: horaSalida(turno.horas, turno.horaEntrada),
      desde,
      hasta: data.hasta ?? null,
    });

    // A quién: guardias sueltos y grupos (sus integrantes).
    const nuevas: {
      data: AsignacionData;
      quienes: number[];
      nombre: string;
      path: string;
      grupo: string | null;
      /** Integrantes a los que no les cambia el horario (no se les avisa de horario). */
      sinCambio: Set<number>;
    }[] = [];
    for (const [i, g] of data.guardias.entries()) {
      const guardia = await this.repo.findGuardia(g.usuarioId);
      if (!guardia || guardia.deletedAt || guardia.rol !== ROLES.GUARDIA) {
        throw invalido(`guardias.${i}.usuarioId`, 'Selecciona guardias activos');
      }
      nuevas.push({
        data: this.nuevaDeTurno(sitioId, turno, tipo, g.desde, data.hasta, { usuarioId: g.usuarioId }),
        quienes: [g.usuarioId],
        nombre: guardia.nombre,
        path: `guardias.${i}.desde`,
        grupo: null,
        sinCambio: new Set(),
      });
    }
    for (const [i, g] of data.grupos.entries()) {
      const grupo = await this.repo.findGrupo(g.grupoId);
      if (!grupo || grupo.deletedAt) throw invalido(`grupos.${i}.grupoId`, 'Selecciona grupos activos');
      nuevas.push({
        data: this.nuevaDeTurno(sitioId, turno, tipo, g.desde, data.hasta, { grupoId: g.grupoId }),
        quienes: await this.repo.integrantesGrupo(g.grupoId),
        nombre: `Grupo ${grupo.nombre}`,
        path: `grupos.${i}.desde`,
        grupo: grupo.nombre,
        sinCambio: new Set(),
      });
    }

    const existentes = await this.repo.asignacionesDeGuardias(
      [...new Set(nuevas.flatMap((n) => n.quienes))],
      hoy,
    );
    /** Asignaciones individuales en este sitio que se reemplazan, con el primer día de la nueva. */
    const reemplazos = new Map<number, { desde: string; inicio: string }>();
    const nombreDe = async (n: (typeof nuevas)[number], q: number) =>
      n.grupo ? `${(await this.repo.findGuardia(q))?.nombre ?? 'Un integrante'} (de ${n.nombre})` : n.nombre;
    const rechazo = (n: (typeof nuevas)[number], mensaje: string) =>
      HttpError.conflict(mensaje, [{ path: n.path, message: mensaje }]);

    for (const [i, n] of nuevas.entries()) {
      const nuevo = patron(n.data.desde);
      for (const q of n.quienes) {
        for (const e of existentes.get(q) ?? []) {
          if (e.sitio.id === sitioId) {
            if (e.grupo === null && n.data.usuarioId && e.turnoId === turno.id && mismoHorario(nuevo, e)) {
              throw rechazo(n, `${n.nombre} ya está en este turno`);
            }
            if (e.grupo !== null) {
              // Ya lo cubre con otro grupo de este sitio: se arregla desde los integrantes del grupo.
              if (n.grupo === e.grupo) continue;
              throw rechazo(n, `${await nombreDe(n, q)} ya está en este sitio con el grupo ${e.grupo}`);
            }
            if (mismoHorario(nuevo, e)) {
              n.sinCambio.add(q);
            } else if (!data.reemplazar.includes(q)) {
              throw rechazo(
                n,
                `${await nombreDe(n, q)} ya tiene otro horario en este sitio (${e.turnoNombre ?? horario({ ...e, turno: e.turno ?? null })}). Elige si lo cambias a este horario.`,
              );
            }
            reemplazos.set(e.asignacionId, { desde: e.desde, inicio: n.data.desde });
          } else if (seCruzan(nuevo, e)) {
            throw rechazo(
              n,
              `${await nombreDe(n, q)}: el horario se cruza con su turno en ${e.sitio.nombre}`,
            );
          }
        }
        const otra = nuevas.find(
          (o, j) => j !== i && o.quienes.includes(q) && seCruzan(nuevo, patron(o.data.desde)),
        );
        if (otra)
          throw rechazo(
            n,
            `${await nombreDe(n, q)}: está dos veces en esta asignación con horarios que se cruzan`,
          );
      }
      // Mismo guardia o grupo con fechas encimadas en el sitio (salvo lo que se reemplaza).
      const reemplazaSuya =
        n.data.usuarioId &&
        (existentes.get(n.data.usuarioId) ?? []).some((e) => reemplazos.has(e.asignacionId));
      if (!reemplazaSuya && (await this.repo.haySolape({ ...n.data })))
        throw solape(n.grupo ? 'grupo' : 'guardia');
    }

    // Lo que se reemplaza termina un día antes de la nueva (o se cancela si aún no empezaba). Sin aviso:
    // el aviso es el de su nuevo horario.
    for (const [id, r] of reemplazos) {
      if (r.desde >= r.inicio) {
        await this.repo.eliminarAsignacion(id);
      } else {
        const hasta = sumarDiasFecha(r.inicio, -1);
        await this.repo.updateAsignacion(id, { hasta, vigenteHasta: hasta });
      }
      await this.audit.registrarAccion(ctx, 'sitios.reasignar', 'sitio_guardia', id, {
        sitioId,
        nuevoDesde: r.inicio,
      });
    }

    const creadas = [];
    for (const n of nuevas) {
      const asignacion = await this.repo.createAsignacion(n.data, hoy);
      creadas.push(asignacion);
      await this.audit.registrarAccion(ctx, 'sitios.asignar', 'sitio_guardia', asignacion.id, {
        sitioId,
        clienteId: sitio.clienteId,
        destinatario: n.nombre,
        turno: turno.nombre,
        desde: n.data.desde,
        hasta: n.data.hasta ?? null,
      });
      const avisar = n.quienes.filter((q) => !n.sinCambio.has(q));
      const conGrupo = n.grupo ? ` con el grupo ${n.grupo}` : '';
      if (avisar.length) {
        await this.bitacora({
          usuarioIds: avisar,
          tipo: 'asignacion',
          detalle: `Asignado a ${sitio.nombre}${conGrupo}: ${horario(asignacion)} · desde el ${fechaCorta(n.data.desde)}${
            n.data.hasta ? ` hasta el ${fechaCorta(n.data.hasta)}` : ''
          }`,
          sitioId,
          actorId: ctx.actorId,
        });
      }
      if (n.sinCambio.size) {
        await this.bitacora({
          usuarioIds: [...n.sinCambio],
          tipo: 'asignacion_cambio',
          detalle: `Sigue en ${sitio.nombre} con el mismo horario${conGrupo} desde el ${fechaCorta(n.data.desde)}`,
          sitioId,
          actorId: ctx.actorId,
        });
      }
      const quien = n.grupo ? `Tu grupo ${n.grupo} fue asignado` : 'Te asignaron';
      await this.avisar(avisar, {
        tipo: 'asignacion',
        titulo: n.grupo ? 'Tu grupo fue asignado a un sitio' : 'Te asignaron a un sitio',
        mensaje: `${quien} a ${sitio.nombre}: ${horario(asignacion)} · desde el ${fechaCorta(n.data.desde)}`,
        ruta: '/mis-sitios',
      });
    }
    return creadas;
  }

  private nuevaDeTurno(
    sitioId: number,
    turno: TurnoEstado,
    tipo: 'fija' | 'temporal',
    desde: string,
    hasta: string | null | undefined,
    quien: { usuarioId?: number; grupoId?: number },
  ): AsignacionData {
    return {
      sitioId,
      ...quien,
      turnoId: turno.id,
      tipo,
      turno: null,
      horas: turno.horas,
      dias: turno.dias,
      horaInicio: turno.horaEntrada,
      horaFin: horaSalida(turno.horas, turno.horaEntrada),
      desde,
      hasta: hasta ?? null,
      vigenteHasta: calcularVigenteHasta({ tipo, desde, hasta, horaInicio: null, horaFin: null }),
    };
  }

  /**
   * Cancela una asignación que aún no empieza (las que ya empezaron se terminan). El admin puede
   * borrar cualquiera al momento, aunque ya haya empezado o termine hoy; las marcas que hizo el
   * guardia no se pierden. Se avisa si el guardia la tenía vigente o programada.
   */
  async cancelarAsignacion(sitioId: number, asignacionId: number, ctx: AccionCtx, esAdmin = false) {
    const hoy = this.hoy();
    const actual = await this.repo.findAsignacion(asignacionId, hoy);
    if (!actual || actual.sitioId !== sitioId) throw HttpError.notFound('Asignación no encontrada');
    const programada = actual.desde > hoy;
    if (!programada && !esAdmin) throw HttpError.conflict('Ya empezó: termínala en lugar de cancelarla');
    const sitio = await this.sitio(sitioId);
    const quienes = await this.destinatarios(actual);
    await this.repo.eliminarAsignacion(asignacionId);
    await this.audit.registrarAccion(
      ctx,
      programada ? 'sitios.cancelar_asignacion' : 'sitios.eliminar_asignacion',
      'sitio_guardia',
      asignacionId,
      {
        sitioId,
        destinatario: actual.grupo ? `Grupo ${actual.grupo.nombre}` : actual.guardia?.nombre,
        desde: actual.desde,
        hasta: actual.hasta,
      },
    );
    const deQuien = actual.grupo ? `la asignación de tu grupo ${actual.grupo.nombre}` : 'tu asignación';
    const enSitio = `${sitio.nombre}${actual.grupo ? ` (grupo ${actual.grupo.nombre})` : ''}`;
    await this.bitacora({
      usuarioIds: quienes,
      tipo: 'asignacion_fin',
      detalle: programada
        ? `Se canceló su asignación en ${enSitio} que empezaba el ${fechaCorta(actual.desde)}`
        : `Lo quitaron de ${enSitio}`,
      sitioId,
      actorId: ctx.actorId,
    });
    if (programada) {
      await this.avisar(quienes, {
        tipo: 'asignacion',
        titulo: 'Se canceló una asignación',
        mensaje: `Se canceló ${deQuien} en ${sitio.nombre} que empezaba el ${fechaCorta(actual.desde)}`,
        ruta: '/mis-sitios',
      });
    } else if (actual.vigente) {
      await this.avisar(quienes, {
        tipo: 'asignacion',
        titulo: actual.grupo ? 'Tu grupo ya no está en el sitio' : 'Ya no estás asignado a un sitio',
        mensaje: `Ya no estás asignado a ${sitio.nombre}${actual.grupo ? ` (grupo ${actual.grupo.nombre})` : ''}`,
        ruta: '/mis-sitios',
      });
    }
  }

  /** Supervisores que se pueden asignar a un sitio (DA-45). */
  supervisores() {
    return this.repo.supervisores();
  }

  /**
   * Asigna (o quita, con null) el supervisor del sitio (DA-45): recibe los avisos del sitio y revisa a
   * sus guardias. Se avisa al nuevo y al anterior.
   */
  async asignarSupervisor(sitioId: number, supervisorId: number | null, ctx: AccionCtx) {
    const sitio = await this.sitio(sitioId);
    const anterior = sitio.supervisorId;
    if (anterior === supervisorId) return;
    let nombre: string | null = null;
    if (supervisorId !== null) {
      const sup = await this.repo.findGuardia(supervisorId);
      if (!sup || sup.deletedAt || sup.rol !== ROLES.SUPERVISOR) {
        throw invalido('supervisorId', 'Elige un supervisor activo');
      }
      nombre = sup.nombre;
    }
    await this.repo.setSupervisor(sitioId, supervisorId);
    await this.audit.registrarAccion(ctx, 'sitios.supervisor', 'sitios', sitioId, {
      antes: anterior,
      despues: supervisorId,
      supervisor: nombre,
    });
    const ruta = '/asistencia';
    if (supervisorId !== null) {
      await this.avisar([supervisorId], {
        tipo: 'asignacion',
        titulo: 'Ahora supervisas un sitio',
        mensaje: `Ahora supervisas ${sitio.nombre}: te llegarán sus avisos y verás a sus guardias`,
        ruta,
      });
    }
    if (anterior !== null) {
      await this.avisar([anterior], {
        tipo: 'asignacion',
        titulo: 'Ya no supervisas un sitio',
        mensaje: `Ya no supervisas ${sitio.nombre}`,
        ruta,
      });
    }
  }

  /** Sitios que el guardia tiene asignados hoy, directos o por grupo (el guardia ve solo esos). */
  misSitios(usuarioId: number): Promise<MiSitio[]> {
    return this.repo.misSitios(usuarioId, this.hoy());
  }

  private async sitio(id: number) {
    const sitio = await this.repo.findSitio(id);
    if (!sitio) throw HttpError.notFound('Sitio no encontrado');
    return sitio;
  }
}
