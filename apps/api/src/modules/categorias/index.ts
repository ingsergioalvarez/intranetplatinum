import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  PERMISOS,
  categoriaCreateSchema,
  categoriaUpdateSchema,
  idParamSchema,
  type Categoria,
  type IdParam,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  HttpError,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  tienePermiso,
  validate,
  type AppModule,
} from '../../core';
import {
  CategoriasRepository,
  PrismaCategoriasRepository,
  type CategoriaCreateData,
} from './categorias.repository';
import { CategoriasService } from './categorias.service';

class CategoriasController extends BaseController {
  constructor(private readonly service: CategoriasService) {
    super();
  }

  /** Activas para todos; `?todas=true` (incluye inactivas) solo para quien administra el catálogo. */
  list = async (req: Request, res: Response) => {
    const todas = this.query<{ todas?: boolean }>(req).todas ?? false;
    if (todas && !tienePermiso(this.currentUser(req), PERMISOS.CATALOGOS_ADMINISTRAR)) {
      throw HttpError.forbidden();
    }
    return this.ok(res, await this.service.arbol(todas));
  };

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<CategoriaCreateData>(req), this.accionCtx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizar(
        this.params<IdParam>(req).id,
        this.body<Partial<Categoria>>(req),
        this.accionCtx(req),
      ),
    );
}

/** Catálogo de categorías de reporte (F3-01). */
export function createCategoriasModule({
  repo = new PrismaCategoriasRepository(),
  audit = new PrismaAuditLogger(),
}: { repo?: CategoriasRepository; audit?: AuditLogger } = {}): AppModule {
  const c = new CategoriasController(new CategoriasService(repo, audit));
  const administrar = requirePermission(PERMISOS.CATALOGOS_ADMINISTRAR);

  const router = Router();
  router.use(authenticate);
  router.get('/', validate({ query: z.object({ todas: z.stringbool().optional() }) }), c.list);
  router.post('/', administrar, validate({ body: categoriaCreateSchema }), c.create);
  router.patch(
    '/:id',
    administrar,
    validate({ params: idParamSchema, body: categoriaUpdateSchema }),
    c.update,
  );

  return { name: 'categorias', basePath: 'categorias', router };
}

export const categoriasModule = createCategoriasModule();
