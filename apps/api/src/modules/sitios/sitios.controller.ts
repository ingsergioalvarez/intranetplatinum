import type { Request, Response } from 'express';
import type { AsignacionCreateData, AsignacionUpdate, IdParam } from '@platinum/shared';
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
}
