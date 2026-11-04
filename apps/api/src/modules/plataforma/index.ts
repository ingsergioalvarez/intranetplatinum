import { Router, type Request, type Response } from 'express';
import {
  empresaAdminCreateSchema,
  empresaCreateSchema,
  empresaFiltroSchema,
  empresaMarcaSchema,
  empresaModulosSchema,
  empresaUpdateSchema,
  idParamSchema,
  type EmpresaAdminCreate,
  type EmpresaCreate,
  type EmpresaFiltro,
  type EmpresaMarca,
  type EmpresaModulosInput,
  type EmpresaUpdate,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  HttpError,
  LocalStorageService,
  PrismaAuditLogger,
  StorageService,
  authenticate,
  esSuperAdmin,
  sinFiltroDeEmpresa,
  uploadLogo,
  validate,
  type AppModule,
} from '../../core';
import { PlataformaRepository, PrismaPlataformaRepository } from './plataforma.repository';
import { PlataformaService } from './plataforma.service';

class PlataformaController extends BaseController {
  constructor(private readonly service: PlataformaService) {
    super();
  }

  private id = (req: Request) => this.params<{ id: number }>(req).id;

  list = async (req: Request, res: Response) =>
    this.ok(res, await this.service.list(this.query<EmpresaFiltro>(req), this.currentUser(req)));

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.create(this.body<EmpresaCreate>(req), this.accionCtx(req)));

  get = async (req: Request, res: Response) => this.ok(res, await this.service.getById(this.id(req)));

  update = async (req: Request, res: Response) =>
    this.ok(res, await this.service.update(this.id(req), this.body<EmpresaUpdate>(req), this.accionCtx(req)));

  marca = async (req: Request, res: Response) =>
    this.ok(res, await this.service.marca(this.id(req), this.body<EmpresaMarca>(req), this.accionCtx(req)));

  entrar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.entrar(this.id(req), this.accionCtx(req)));

  desactivar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.desactivar(this.id(req), this.accionCtx(req)));

  reactivar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.reactivar(this.id(req), this.accionCtx(req)));

  modulos = async (req: Request, res: Response) => this.ok(res, await this.service.modulos(this.id(req)));

  actualizarModulos = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizarModulos(this.id(req), this.body<EmpresaModulosInput>(req), this.accionCtx(req)),
    );

  administradores = async (req: Request, res: Response) =>
    this.ok(res, await this.service.administradores(this.id(req)));

  crearAdministrador = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crearAdministrador(this.id(req), this.body<EmpresaAdminCreate>(req), this.accionCtx(req)),
    );

  subirLogo = async (req: Request, res: Response) =>
    this.ok(res, await this.service.subirLogo(this.id(req), req.file, this.accionCtx(req)));

  quitarLogo = async (req: Request, res: Response) =>
    this.ok(res, await this.service.quitarLogo(this.id(req), this.accionCtx(req)));
}

export interface PlataformaDeps {
  repo?: PlataformaRepository;
  audit?: AuditLogger;
  storage?: StorageService;
}

/** Plataforma (C-07): empresas, marca, módulos y administradores. Solo el super admin. */
export function createPlataformaModule({
  repo = new PrismaPlataformaRepository(),
  audit = new PrismaAuditLogger(),
  storage = new LocalStorageService(),
}: PlataformaDeps = {}): AppModule {
  const c = new PlataformaController(new PlataformaService(repo, audit, storage));
  const id = validate({ params: idParamSchema });
  const router = Router();
  router.use(authenticate, (req, _res, next) =>
    esSuperAdmin(req.user ?? {}) ? next() : next(HttpError.forbidden('Solo el super admin puede usar la plataforma')),
  );
  // La plataforma opera sobre todas las empresas: sin filtro (C-08). Cada alta indica su empresa de forma explícita.
  router.use((_req, _res, next) => sinFiltroDeEmpresa(() => next()));

  router.get('/empresas', validate({ query: empresaFiltroSchema }), c.list);
  router.post('/empresas', validate({ body: empresaCreateSchema }), c.create);
  router.get('/empresas/:id', id, c.get);
  router.patch('/empresas/:id', validate({ params: idParamSchema, body: empresaUpdateSchema }), c.update);
  router.patch('/empresas/:id/marca', validate({ params: idParamSchema, body: empresaMarcaSchema }), c.marca);
  router.post('/empresas/:id/logo', id, uploadLogo.single('logo'), c.subirLogo);
  router.delete('/empresas/:id/logo', id, c.quitarLogo);
  router.post('/empresas/:id/entrar', id, c.entrar);
  router.patch('/empresas/:id/baja', id, c.desactivar);
  router.patch('/empresas/:id/reactivar', id, c.reactivar);
  router.get('/empresas/:id/modulos', id, c.modulos);
  router.put('/empresas/:id/modulos', validate({ params: idParamSchema, body: empresaModulosSchema }), c.actualizarModulos);
  router.get('/empresas/:id/administradores', id, c.administradores);
  router.post(
    '/empresas/:id/administradores',
    validate({ params: idParamSchema, body: empresaAdminCreateSchema }),
    c.crearAdministrador,
  );

  return { name: 'plataforma', basePath: 'plataforma', router };
}

export const plataformaModule = createPlataformaModule();
