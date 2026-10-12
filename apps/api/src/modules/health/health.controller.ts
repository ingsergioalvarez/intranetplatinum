import type { Request, Response } from 'express';
import { BaseController } from '../../core';
import type { HealthService } from './health.service';

export class HealthController extends BaseController {
  constructor(private readonly service: HealthService) {
    super();
  }

  status = (_req: Request, res: Response) => {
    return this.ok(res, this.service.getStatus());
  };

  /** Ruta protegida de prueba: verifica el middleware `authenticate`. */
  me = (req: Request, res: Response) => {
    return this.ok(res, this.currentUser(req));
  };
}
