import { Router, type Request, type Response } from 'express';
import {
  correoConfigSchema,
  correoPruebaSchema,
  type CorreoConfigInput,
  type CorreoPruebaInput,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  HttpError,
  PrismaAuditLogger,
  authenticate,
  esSuperAdmin,
  rateLimit,
  validate,
  type AppModule,
} from '../../core';
import { CorreoRepository, PrismaCorreoRepository } from './correo.repository';
import { CorreoService } from './correo.service';
import { enviarPorSmtp, type EnviarPorSmtp } from './transporte';

class CorreoController extends BaseController {
  constructor(private readonly service: CorreoService) {
    super();
  }

  obtener = async (_req: Request, res: Response) => this.ok(res, await this.service.obtener());

  guardar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.guardar(this.body<CorreoConfigInput>(req), this.accionCtx(req)));

  probar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.probar(this.body<CorreoPruebaInput>(req), this.accionCtx(req)));
}

export interface CorreoDeps {
  repo?: CorreoRepository;
  audit?: AuditLogger;
  enviarSmtp?: EnviarPorSmtp;
}

/** Servicio para que otros módulos envíen correo con la configuración guardada (A-87). */
export const correoService = new CorreoService(new PrismaCorreoRepository(), new PrismaAuditLogger());

/** Configuración del correo saliente (A-87): solo el super admin. */
export function createCorreoModule({
  repo = new PrismaCorreoRepository(),
  audit = new PrismaAuditLogger(),
  enviarSmtp = enviarPorSmtp,
}: CorreoDeps = {}): AppModule {
  const c = new CorreoController(new CorreoService(repo, audit, enviarSmtp));
  const router = Router();
  router.use(authenticate, (req, _res, next) =>
    esSuperAdmin(req.user ?? {})
      ? next()
      : next(HttpError.forbidden('Solo el super administrador puede configurar el correo')),
  );
  router.get('/', c.obtener);
  router.put('/', validate({ body: correoConfigSchema }), c.guardar);
  // Cada prueba abre una conexión al servidor de correo: se limita para que no se use de más.
  router.post('/prueba', rateLimit({ windowMin: 5, max: 10 }), validate({ body: correoPruebaSchema }), c.probar);
  return { name: 'correo', basePath: 'correo', router };
}

export const correoModule = createCorreoModule();
