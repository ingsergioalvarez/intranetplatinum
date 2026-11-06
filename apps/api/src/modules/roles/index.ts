import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  idParamSchema,
  rolCreateSchema,
  rolUpdateSchema,
  type IdParam,
  type RolCreate,
  type RolUpdate,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  validate,
  type AppModule,
} from '../../core';
import { PrismaRolesRepository, RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

class RolesController extends BaseController {
  constructor(private readonly service: RolesService) {
    super();
  }

  private id = (req: Request) => this.params<IdParam>(req).id;

  list = async (_req: Request, res: Response) => this.ok(res, await this.service.list());

  get = async (req: Request, res: Response) => this.ok(res, await this.service.getById(this.id(req)));

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<RolCreate>(req), this.accionCtx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(res, await this.service.actualizar(this.id(req), this.body<RolUpdate>(req), this.accionCtx(req)));

  remove = async (req: Request, res: Response) => {
    await this.service.eliminar(this.id(req), this.accionCtx(req));
    return this.noContent(res);
  };
}

interface RolesModuleDeps {
  repo?: RolesRepository;
  audit?: AuditLogger;
}

/**
 * Roles y permisos por empresa (C-11 parte 5, DC-019).
 * Todas las rutas requieren `roles.administrar` y están acotadas a la empresa actual.
 */
export function createRolesModule({
  repo = new PrismaRolesRepository(),
  audit = new PrismaAuditLogger(),
}: RolesModuleDeps = {}): AppModule {
  const c = new RolesController(new RolesService(repo, audit));
  const id = validate({ params: idParamSchema });
  const administrar = requirePermission(PERMISOS.ROLES_ADMINISTRAR);

  const router = Router();
  router.use(authenticate);
  router.get('/', administrar, c.list);
  router.get('/:id', administrar, id, c.get);
  router.post('/', administrar, validate({ body: rolCreateSchema }), c.create);
  router.patch('/:id', administrar, validate({ params: idParamSchema, body: rolUpdateSchema }), c.update);
  router.delete('/:id', administrar, id, c.remove);

  return { name: 'roles', basePath: 'roles', router };
}

export const rolesModule = createRolesModule();

