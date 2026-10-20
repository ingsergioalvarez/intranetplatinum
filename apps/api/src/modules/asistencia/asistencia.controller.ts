import type { Request, Response } from 'express';
import type { AsistenciaDiaQuery, IdParam, MarcacionCreate } from '@platinum/shared';
import { BaseController, requestContext } from '../../core';
import type { AsistenciaService } from './asistencia.service';

export class AsistenciaController extends BaseController {
  constructor(private readonly service: AsistenciaService) {
    super();
  }

  estado = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.estado(this.currentUser(req).id));
  };

  marcar = async (req: Request, res: Response) => {
    const marca = await this.service.marcar(
      this.currentUser(req).id,
      this.body<MarcacionCreate>(req),
      requestContext(req),
    );
    return this.created(res, marca);
  };

  mias = async (req: Request, res: Response) => {
    const { mes } = this.query<{ mes: string }>(req);
    return this.ok(res, await this.service.misJornadas(this.currentUser(req).id, mes));
  };

  dia = async (req: Request, res: Response) => {
    return this.paginated(res, await this.service.dia(this.query<AsistenciaDiaQuery>(req)));
  };

  guardia = async (req: Request, res: Response) => {
    const { mes } = this.query<{ mes: string }>(req);
    return this.ok(res, await this.service.guardia(this.params<IdParam>(req).id, mes));
  };
}
