import { Router, type Request, type Response } from 'express';
import {
  quitarSuscripcionPushSchema,
  suscripcionPushSchema,
  type QuitarSuscripcionPushInput,
  type SuscripcionPushInput,
} from '@platinum/shared';
import { BaseController, authenticate, validate, type AppModule } from '../../core';
import { pushService } from './enviar';
import type { PushService } from './push.service';

class PushController extends BaseController {
  constructor(private readonly service: PushService) {
    super();
  }

  clave = async (_req: Request, res: Response) => this.ok(res, this.service.clave());

  suscribir = async (req: Request, res: Response) => {
    await this.service.suscribir(
      this.currentUser(req).id,
      this.body<SuscripcionPushInput>(req),
      req.get('user-agent') ?? null,
    );
    return this.noContent(res);
  };

  quitar = async (req: Request, res: Response) => {
    await this.service.quitar(this.currentUser(req).id, this.body<QuitarSuscripcionPushInput>(req));
    return this.noContent(res);
  };
}

/** Notificaciones push (A-20): cada usuario registra o quita sus propios celulares. */
export function createPushModule({ service = pushService }: { service?: PushService } = {}): AppModule {
  const c = new PushController(service);
  const router = Router();
  router.use(authenticate);
  router.get('/clave', c.clave);
  router.post('/suscripciones', validate({ body: suscripcionPushSchema }), c.suscribir);
  router.delete('/suscripciones', validate({ body: quitarSuscripcionPushSchema }), c.quitar);
  return { name: 'push', basePath: 'push', router };
}

export const pushModule = createPushModule();
