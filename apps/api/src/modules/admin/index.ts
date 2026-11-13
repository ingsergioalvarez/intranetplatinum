import { Router, type Request, type RequestHandler, type Response } from 'express';
import { ROLES, idParamSchema, type IdParam } from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  HttpError,
  LocalStorageService,
  PrismaAuditLogger,
  StorageService,
  authenticate,
  esSuperAdmin,
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
    return this.ok(res, await this.service.historial(this.params<IdParam>(req).id, this.currentUser(req)));
  };

  historialSitio = async (req: Request, res: Response) =>
    this.ok(res, await this.service.historialSitio(this.params<IdParam>(req).id, this.currentUser(req)));

  historialCliente = async (req: Request, res: Response) =>
    this.ok(res, await this.service.historialCliente(this.params<IdParam>(req).id, this.currentUser(req)));

  eliminarSitio = async (req: Request, res: Response) => {
    await this.service.eliminarSitio(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  eliminarCliente = async (req: Request, res: Response) => {
    await this.service.eliminarCliente(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
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

/** Solo el super admin pasa: borrar de forma definitiva no se delega por defecto (A-86). */
const soloSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!esSuperAdmin(req.user!)) {
    return next(HttpError.forbidden('Solo el super administrador puede eliminar definitivamente. Puedes dar de baja.'));
  }
  next();
};

/**
 * Eliminar usuarios, sitios y clientes definitivamente: solo el super admin (A-86). Un admin normal da de baja (se puede
 * revertir). Más adelante, con la pantalla de Roles, se podrá conceder este permiso a alguien más.
 */
export function createAdminModule({
  repo = new PrismaAdminRepository(),
  storage = new LocalStorageService(),
  audit = new PrismaAuditLogger(),
}: AdminModuleDeps = {}): AppModule {
  const c = new AdminController(new AdminService(repo, storage, audit));
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN), soloSuperAdmin);
  router.get('/usuarios/:id/historial', id, c.historial);
  router.delete('/usuarios/:id', id, c.eliminarUsuario);
  // Sitios y clientes: borrado definitivo con su historial (DA-50).
  router.get('/sitios/:id/historial', id, c.historialSitio);
  router.delete('/sitios/:id', id, c.eliminarSitio);
  router.get('/clientes/:id/historial', id, c.historialCliente);
  router.delete('/clientes/:id', id, c.eliminarCliente);

  return { name: 'admin', basePath: 'admin', router };
}

export const adminModule = createAdminModule();
