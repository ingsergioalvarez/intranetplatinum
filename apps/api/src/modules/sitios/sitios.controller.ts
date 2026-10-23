import type { Request, Response } from 'express';
import { ROLES } from '@platinum/shared';
import type {
  AsignacionCreateData,
  AsignacionUpdate,
  AsignarTurnoData,
  IdParam,
  SupervisorSitioInput,
} from '@platinum/shared';
import { BaseController } from '../../core';
import type { SitiosService } from './sitios.service';

export class SitiosController extends BaseController {
  constructor(private readonly service: SitiosService) {
    super();
  }

  mios = async (req: Request, res: Response) =>
    this.ok(res, await this.service.misSitios(this.currentUser(req).id));

  listAsignaciones = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.listAsignaciones(
        this.params<IdParam>(req).id,
        this.query<{ historial?: boolean }>(req).historial ?? false,
      ),
    );

  asignar = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.asignar(
        this.params<IdParam>(req).id,
        this.body<AsignacionCreateData>(req),
        this.accionCtx(req),
      ),
    );

  actualizarAsignacion = async (req: Request, res: Response) => {
    const { id, asignacionId } = this.params<{ id: number; asignacionId: number }>(req);
    return this.ok(
      res,
      await this.service.actualizarAsignacion(
        id,
        asignacionId,
        this.body<AsignacionUpdate>(req),
        this.accionCtx(req),
      ),
    );
  };

  guardiasDisponibles = async (_req: Request, res: Response) =>
    this.ok(res, await this.service.guardiasDisponibles());

  asignarTurno = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.asignarTurno(
        this.params<IdParam>(req).id,
        this.body<AsignarTurnoData>(req),
        this.accionCtx(req),
      ),
    );

  supervisores = async (_req: Request, res: Response) => this.ok(res, await this.service.supervisores());

  asignarSupervisor = async (req: Request, res: Response) => {
    await this.service.asignarSupervisor(
      this.params<IdParam>(req).id,
      this.body<SupervisorSitioInput>(req).supervisorId,
      this.accionCtx(req),
    );
    return this.noContent(res);
  };

  cancelarAsignacion = async (req: Request, res: Response) => {
    const { id, asignacionId } = this.params<{ id: number; asignacionId: number }>(req);
    const esAdmin = this.currentUser(req).rol === ROLES.ADMIN;
    await this.service.cancelarAsignacion(id, asignacionId, this.accionCtx(req), esAdmin);
    return this.noContent(res);
  };
}
