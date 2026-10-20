import {
  ROLES,
  calcularVigenteHasta,
  type Asignacion,
  type AsignacionCreateData,
  type AsignacionUpdate,
  type MiSitio,
} from '@platinum/shared';
import { AuditLogger, BaseService, HttpError, hoyISO, type AccionCtx } from '../../core';
import type { SitiosRepository } from './sitios.repository';

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
  ) {
    super();
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
      // El turno no aplica a eventuales (usan horario) y el horario no aplica a fija/temporal.
      turno: data.tipo === 'eventual' ? null : data.turno,
      horaInicio: data.tipo === 'eventual' ? data.horaInicio : null,
      horaFin: data.tipo === 'eventual' ? data.horaFin : null,
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

    await this.repo.updateAsignacion(asignacionId, {
      turno: actual.tipo === 'eventual' ? undefined : data.turno,
      hasta: data.hasta,
      vigenteHasta,
    });
    const { vigenteHasta: _vh, ...asignacion } = (await this.repo.findAsignacion(asignacionId, hoy))!;
    await this.audit.registrarAccion(ctx, 'sitios.editar_asignacion', 'sitio_guardia', asignacionId, {
      sitioId,
      antes: { turno: actual.turno, hasta: actual.hasta },
      despues: { turno: asignacion.turno, hasta: asignacion.hasta },
    });
    return asignacion;
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
