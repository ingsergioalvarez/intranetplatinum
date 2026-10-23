import { horaLegible, textoDias, type TurnoCatalogo, type TurnoData } from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import { sinBitacora, type RegistrarBitacora } from '../bitacora/registrar';
import { sinAvisos, type AvisarUsuarios } from '../avisos/avisar';
import type { TurnosRepository } from './turnos.repository';

const nombreRepetido = () =>
  HttpError.conflict('Ya existe un turno con ese nombre', [
    { path: 'nombre', message: 'Ya existe un turno con ese nombre' },
  ]);

/** "12 h · entrada 8:00 a.m. (todos los días)" */
export const horarioTexto = (t: { horas: number; horaEntrada: string; dias: TurnoData['dias'] }) =>
  `${t.horas} h · entrada ${horaLegible(t.horaEntrada)} (${textoDias(t.dias).toLowerCase()})`;

/**
 * Catálogo de turnos (DA-37). Editar el horario de un turno lo cambia en todas sus asignaciones
 * vigentes o programadas (de ahí en adelante: las marcas ya hechas guardan su copia) y avisa a sus
 * guardias. Borrarlo (solo admin) no afecta a los guardias: siguen con su copia del horario.
 */
export class TurnosService extends BaseService {
  constructor(
    private readonly repo: TurnosRepository,
    private readonly audit: AuditLogger,
    private readonly avisar: AvisarUsuarios = sinAvisos,
    private readonly hoy: () => string = () => hoyISO(),
    private readonly bitacora: RegistrarBitacora = sinBitacora,
  ) {
    super();
  }

  listar() {
    return this.repo.listar(this.hoy());
  }

  async getById(id: number): Promise<TurnoCatalogo> {
    const t = await this.repo.findById(id, this.hoy());
    if (!t) throw HttpError.notFound('Turno no encontrado');
    return t;
  }

  async crear(data: TurnoData, ctx: AccionCtx): Promise<TurnoCatalogo> {
    if (await this.repo.nombreOcupado(data.nombre)) throw nombreRepetido();
    const id = await this.repo.crear(data);
    await this.audit.registrarAccion(ctx, 'turnos.crear', 'turnos', id, { ...data });
    return this.getById(id);
  }

  async actualizar(id: number, data: TurnoData, ctx: AccionCtx): Promise<TurnoCatalogo> {
    const actual = await this.getById(id);
    if (data.nombre !== actual.nombre && (await this.repo.nombreOcupado(data.nombre, id))) {
      throw nombreRepetido();
    }
    const antes = {
      nombre: actual.nombre,
      horas: actual.horas,
      horaEntrada: actual.horaEntrada,
      dias: actual.dias,
    };
    const cambiaHorario =
      data.horas !== actual.horas ||
      data.horaEntrada !== actual.horaEntrada ||
      JSON.stringify(data.dias) !== JSON.stringify(actual.dias);
    if (!cambiaHorario && data.nombre === actual.nombre) return actual;
    await this.repo.actualizar(id, data);

    if (cambiaHorario) {
      const hoy = this.hoy();
      const usos = await this.repo.usos(id, hoy);
      await this.repo.copiarHorario(id, hoy, data);
      // Un aviso por guardia y sitio con su nuevo horario.
      const porSitio = new Map<string, Set<number>>();
      for (const u of usos) {
        const ids = porSitio.get(u.sitio) ?? new Set<number>();
        for (const g of u.usuarioId ? [u.usuarioId] : u.integrantes) ids.add(g);
        porSitio.set(u.sitio, ids);
      }
      for (const [sitio, ids] of porSitio) {
        await this.bitacora({
          usuarioIds: [...ids],
          tipo: 'asignacion_cambio',
          detalle: `Nuevo horario en ${sitio} (cambió el turno "${actual.nombre}"): ${horarioTexto(data)}`,
          actorId: ctx.actorId,
        });
        await this.avisar([...ids], {
          tipo: 'asignacion',
          mensaje: `Cambió tu horario en ${sitio}: ${horarioTexto(data)}`,
          ruta: '/',
        });
      }
    }
    await this.audit.registrarAccion(ctx, 'turnos.editar', 'turnos', id, { antes, despues: data });
    return this.getById(id);
  }

  /** Se desactiva solo si nadie lo usa (vigente o programado). */
  async darDeBaja(id: number, ctx: AccionCtx) {
    const t = await this.getById(id);
    if (!t.activo) return;
    if (t.enUso > 0) {
      throw HttpError.conflict(
        `El turno está asignado ${t.enUso === 1 ? 'una vez' : `${t.enUso} veces`}. Quítalo de los sitios primero.`,
      );
    }
    await this.repo.setActivo(id, false);
    await this.audit.registrarAccion(ctx, 'turnos.baja', 'turnos', id, { nombre: t.nombre });
  }

  async reactivar(id: number, ctx: AccionCtx) {
    const t = await this.getById(id);
    if (t.activo) return;
    await this.repo.setActivo(id, true);
    await this.audit.registrarAccion(ctx, 'turnos.reactivar', 'turnos', id, { nombre: t.nombre });
  }

  /**
   * Borra el turno (solo admin), aunque esté asignado. Los guardias no se enteran ni cambian nada:
   * siguen con su copia del horario hasta que se les asigne otro (eso sí se les avisa).
   */
  async eliminar(id: number, ctx: AccionCtx) {
    const t = await this.getById(id);
    await this.repo.eliminar(id);
    await this.audit.registrarAccion(ctx, 'turnos.eliminar', 'turnos', id, {
      nombre: t.nombre,
      horas: t.horas,
      horaEntrada: t.horaEntrada,
      dias: t.dias,
      asignacionesQueLoUsaban: t.enUso,
    });
  }
}
