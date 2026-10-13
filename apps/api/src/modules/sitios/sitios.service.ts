import {
  ROLES,
  type Asignacion,
  type AsignacionCreate,
  type AsignacionUpdate,
  type MiSitio,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import type { SitiosRepository } from './sitios.repository';

const solape = () =>
  HttpError.conflict('El guardia ya está asignado a este sitio en esas fechas', [
    { path: 'desde', message: 'Se cruza con otra asignación del mismo guardia en este sitio' },
  ]);

export class SitiosService extends BaseService {
  constructor(
    private readonly repo: SitiosRepository,
    private readonly audit: AuditLogger,
    private readonly hoy: () => string = () => hoyISO(),
  ) {
    super();
  }

  async listAsignaciones(sitioId: number, incluirTerminadas: boolean): Promise<Asignacion[]> {
    await this.sitio(sitioId);
    return this.repo.listAsignaciones(sitioId, this.hoy(), incluirTerminadas);
  }

  async asignar(sitioId: number, data: AsignacionCreate, ctx: AccionCtx): Promise<Asignacion> {
    const sitio = await this.sitio(sitioId);
    if (sitio.deletedAt || sitio.clienteDeBaja) {
      throw HttpError.conflict('No se pueden asignar guardias a un sitio o cliente dado de baja');
    }
    const guardia = await this.repo.findGuardia(data.usuarioId);
    if (!guardia || guardia.deletedAt || guardia.rol !== ROLES.GUARDIA) {
      throw HttpError.badRequest('Datos inválidos', [
        { path: 'usuarioId', message: 'Selecciona un guardia activo' },
      ]);
    }

    const nueva = { sitioId, ...data };
    if (await this.repo.haySolape(nueva)) throw solape();
    const asignacion = await this.repo.createAsignacion(nueva, this.hoy());
    await this.audit.registrarAccion(ctx, 'sitios.asignar_guardia', 'sitio_guardia', asignacion.id, {
      sitioId,
      clienteId: sitio.clienteId,
      guardia: guardia.nombre,
      turno: data.turno,
      desde: data.desde,
      hasta: data.hasta ?? null,
    });
    return asignacion;
  }

  /** Cambia turno o fecha de término (terminar = `hasta` hoy; `null` = sin término). */
  async actualizarAsignacion(
    sitioId: number,
    asignacionId: number,
    data: AsignacionUpdate,
    ctx: AccionCtx,
  ): Promise<Asignacion> {
    const hoy = this.hoy();
    const actual = await this.repo.findAsignacion(asignacionId, hoy);
    if (!actual || actual.sitioId !== sitioId) throw HttpError.notFound('Asignación no encontrada');

    if (data.hasta !== undefined) {
      if (data.hasta && data.hasta < actual.desde) {
        throw HttpError.badRequest('Datos inválidos', [
          { path: 'hasta', message: 'Debe ser igual o posterior a la fecha de inicio' },
        ]);
      }
      const rango = {
        sitioId,
        usuarioId: actual.usuarioId,
        turno: actual.turno,
        desde: actual.desde,
        hasta: data.hasta,
      };
      if (await this.repo.haySolape(rango, asignacionId)) throw solape();
    }

    await this.repo.updateAsignacion(asignacionId, data);
    const asignacion = (await this.repo.findAsignacion(asignacionId, hoy))!;
    await this.audit.registrarAccion(ctx, 'sitios.editar_asignacion', 'sitio_guardia', asignacionId, {
      sitioId,
      antes: { turno: actual.turno, hasta: actual.hasta },
      despues: { turno: asignacion.turno, hasta: asignacion.hasta },
    });
    return asignacion;
  }

  /** Sitios que el guardia tiene asignados hoy (F2-05: "el guardia ve solo sus sitios"). */
  misSitios(usuarioId: number): Promise<MiSitio[]> {
    return this.repo.misSitios(usuarioId, this.hoy());
  }

  private async sitio(id: number) {
    const sitio = await this.repo.findSitio(id);
    if (!sitio) throw HttpError.notFound('Sitio no encontrado');
    return sitio;
  }
}
