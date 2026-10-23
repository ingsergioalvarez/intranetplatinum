import { Router, type Request, type Response } from 'express';
import { ROLES, idParamSchema, type IdParam } from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  LocalStorageService,
  PrismaAuditLogger,
  StorageService,
  authenticate,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { AdminRepository, PrismaAdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

class AdminController extends BaseController {
  constructor(private readonly service: AdminService) {
    super();
  }

  historial = async (req: Request, res: Response) => {
    return this.ok(res, await this.service.historial(this.params<IdParam>(req).id));
  };

  eliminarUsuario = async (req: Request, res: Response) => {
    await this.service.eliminarUsuario(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };
}

interface AdminModuleDeps {
  repo?: AdminRepository;
  storage?: StorageService;
  audit?: AuditLogger;
}

/** Acciones exclusivas del rol admin (no del supervisor): eliminar usuarios definitivamente. */
export function createAdminModule({
  repo = new PrismaAdminRepository(),
  storage = new LocalStorageService(),
  audit = new PrismaAuditLogger(),
}: AdminModuleDeps = {}): AppModule {
  const c = new AdminController(new AdminService(repo, storage, audit));
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN));
  router.get('/usuarios/:id/historial', id, c.historial);
  router.delete('/usuarios/:id', id, c.eliminarUsuario);

  return { name: 'admin', basePath: 'admin', router };
}

export const adminModule = createAdminModule();
