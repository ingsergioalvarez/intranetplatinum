import type { Request, Response } from 'express';
import type { IdParam, UsuarioCreate, UsuarioFiltro, UsuarioUpdate } from '@platinum/shared';
import { BaseController, requestContext } from '../../core';
import type { AccionCtx, UsuariosService } from './usuarios.service';

export class UsuariosController extends BaseController {
  constructor(private readonly service: UsuariosService) {
    super();
  }

  list = async (req: Request, res: Response) =>
    this.paginated(res, await this.service.list(this.query<UsuarioFiltro>(req)));

  get = async (req: Request, res: Response) =>
    this.ok(res, await this.service.getById(this.params<IdParam>(req).id));

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<UsuarioCreate>(req), this.ctx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizar(
        this.params<IdParam>(req).id,
        this.body<UsuarioUpdate>(req),
        this.ctx(req),
      ),
    );

  baja = async (req: Request, res: Response) => {
    await this.service.darDeBaja(this.params<IdParam>(req).id, this.ctx(req));
    return this.noContent(res);
  };

  reactivar = async (req: Request, res: Response) => {
    await this.service.reactivar(this.params<IdParam>(req).id, this.ctx(req));
    return this.noContent(res);
  };

  resetPassword = async (req: Request, res: Response) =>
    this.ok(res, await this.service.resetPassword(this.params<IdParam>(req).id, this.ctx(req)));

  private ctx(req: Request): AccionCtx {
    return { actorId: this.currentUser(req).id, ...requestContext(req) };
  }
}
