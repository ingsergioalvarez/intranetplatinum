import { Router, type Request, type Response } from 'express';
import {
  areaCreateSchema,
  areaFiltroSchema,
  areaUpdateSchema,
  asignarAreaSchema,
  candidatosAreaFiltroSchema,
  idParamSchema,
  type AreaCreate,
  type AreaFiltro,
  type AreaUpdate,
  type AsignarArea,
  type CandidatosAreaFiltro,
  PERMISOS,
} from '@platinum/shared';
import { z } from 'zod';
import {
  AuditLogger,
  BaseController,
  HttpError,
  PrismaAuditLogger,
  authenticate,
  esSuperAdmin,
  validate,
  type AppModule,
  requirePermission,
} from '../../core';
import { AreasRepository, PrismaAreasRepository } from './areas.repository';
import { AreasService } from './areas.service';

const usuarioParam = z.object({ usuarioId: idParamSchema.shape.id });

class AreasController extends BaseController {
  constructor(private readonly service: AreasService) {
    super();
  }

  private id = (req: Request) => this.params<{ id: number }>(req).id;

  list = async (req: Request, res: Response) => this.ok(res, await this.service.list(this.query<AreaFiltro>(req)));

  get = async (req: Request, res: Response) => this.ok(res, await this.service.getById(this.id(req)));

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<AreaCreate>(req), this.accionCtx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(res, await this.service.actualizar(this.id(req), this.body<AreaUpdate>(req), this.accionCtx(req)));

  baja = async (req: Request, res: Response) => {
    await this.service.darDeBaja(this.id(req), this.accionCtx(req));
    this.noContent(res);
  };

  eliminar = async (req: Request, res: Response) => {
    await this.service.eliminar(this.id(req), this.accionCtx(req));
    this.noContent(res);
  };

  reactivar = async (req: Request, res: Response) => {
    await this.service.reactivar(this.id(req), this.accionCtx(req));
    this.noContent(res);
  };

  personas = async (req: Request, res: Response) => this.ok(res, await this.service.personas(this.id(req)));

  candidatos = async (req: Request, res: Response) =>
    this.ok(res, await this.service.candidatos(this.query<CandidatosAreaFiltro>(req).q));

  asignar = async (req: Request, res: Response) => {
    const { usuarioId } = this.params<{ usuarioId: number }>(req);
    await this.service.asignar(usuarioId, this.body<AsignarArea>(req).areaId, this.accionCtx(req));
    this.noContent(res);
  };
}

interface AreasModuleDeps {
  repo?: AreasRepository;
  audit?: AuditLogger;
}

/**
 * Áreas de la empresa (C-10): estructura con subáreas, una por persona y su jefe. Parte de la estructura mínima (núcleo).
 * Por ahora solo la administra el admin de la empresa; los permisos finos llegan con C-11.
 */
export function createAreasModule({ repo = new PrismaAreasRepository(), audit = new PrismaAuditLogger() }: AreasModuleDeps = {}): AppModule {
  const c = new AreasController(new AreasService(repo, audit));
  const id = validate({ params: idParamSchema });

  const router = Router();
  const ver = requirePermission(PERMISOS.AREAS_VER);
  const administrar = requirePermission(PERMISOS.AREAS_ADMINISTRAR);
  router.use(authenticate);
  router.get('/', ver, validate({ query: areaFiltroSchema }), c.list);
  router.post('/', administrar, validate({ body: areaCreateSchema }), c.create);
  // Antes de '/:id' para que "candidatos" no se tome por un id.
  router.get('/candidatos', ver, validate({ query: candidatosAreaFiltroSchema }), c.candidatos);
  router.put('/personas/:usuarioId', administrar, validate({ params: usuarioParam, body: asignarAreaSchema }), c.asignar);
  router.get('/:id', ver, id, c.get);
  router.patch('/:id', administrar, validate({ params: idParamSchema, body: areaUpdateSchema }), c.update);
  router.get('/:id/personas', ver, id, c.personas);
  router.patch('/:id/baja', administrar, id, c.baja);
  router.patch('/:id/reactivar', administrar, id, c.reactivar);
  // Borrado definitivo: solo el super admin (el admin de empresa solo da de baja, que se puede revertir).
  router.delete('/:id', administrar, id, (req, _res, next) =>
    esSuperAdmin(req.user ?? {}) ? next() : next(HttpError.forbidden('Solo el super admin puede eliminar áreas definitivamente')),
  c.eliminar);

  return { name: 'areas', basePath: 'areas', router };
}

export const areasModule = createAreasModule();
