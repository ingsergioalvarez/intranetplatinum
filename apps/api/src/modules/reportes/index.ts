import { Router, type Request, type Response } from 'express';
import {
  MAX_FOTOS_REPORTE,
  PERMISOS,
  idParamSchema,
  reporteCreateSchema,
  reporteFiltroSchema,
  seguimientoCreateSchema,
  type IdParam,
  type ReporteCreateData,
  type ReporteFiltro,
  type SeguimientoCreateData,
} from '@platinum/shared';
import {
  BaseController,
  LocalStorageService,
  StorageService,
  authenticate,
  requirePermission,
  uploadImages,
  validate,
  type AppModule,
} from '../../core';
import { PrismaAvisosRepository } from '../avisos/avisos.repository';
import { NotificadorAvisos, type NotificadorReportes } from '../avisos/notificador';
import { PrismaReportesRepository, ReportesRepository } from './reportes.repository';
import { ReportesService, type ArchivoSubido } from './reportes.service';

const archivos = (req: Request) => (req.files as ArchivoSubido[] | undefined) ?? [];

class ReportesController extends BaseController {
  constructor(private readonly service: ReportesService) {
    super();
  }

  list = async (req: Request, res: Response) =>
    this.paginated(res, await this.service.list(this.currentUser(req), this.query<ReporteFiltro>(req)));

  get = async (req: Request, res: Response) =>
    this.ok(res, await this.service.detalle(this.currentUser(req), this.params<IdParam>(req).id));

  sitios = async (req: Request, res: Response) =>
    this.ok(res, await this.service.sitiosReportables(this.currentUser(req)));

  create = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crear(this.currentUser(req), this.body<ReporteCreateData>(req), archivos(req)),
    );

  seguimiento = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.agregarSeguimiento(
        this.currentUser(req),
        this.params<IdParam>(req).id,
        this.body<SeguimientoCreateData>(req),
        archivos(req),
      ),
    );
}

interface ReportesModuleDeps {
  repo?: ReportesRepository;
  storage?: StorageService;
  hoy?: () => string;
  avisos?: NotificadorReportes;
}

/** Reportes de guardias con fotos y seguimiento (F3-02..F3-06). */
export function createReportesModule({
  repo = new PrismaReportesRepository(),
  storage = new LocalStorageService(),
  hoy,
  avisos = new NotificadorAvisos(new PrismaAvisosRepository()),
}: ReportesModuleDeps = {}): AppModule {
  const c = new ReportesController(new ReportesService(repo, storage, hoy, avisos));
  const fotos = uploadImages.array('fotos', MAX_FOTOS_REPORTE);
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate);
  // La visibilidad fina (todos / sus sitios) la decide el servicio.
  router.get('/', validate({ query: reporteFiltroSchema }), c.list);
  router.get('/sitios', requirePermission(PERMISOS.REPORTES_CREAR), c.sitios);
  router.get('/:id', id, c.get);
  router.post(
    '/',
    requirePermission(PERMISOS.REPORTES_CREAR),
    fotos,
    validate({ body: reporteCreateSchema }),
    c.create,
  );
  router.post(
    '/:id/seguimientos',
    requirePermission(PERMISOS.REPORTES_SEGUIMIENTO),
    fotos,
    validate({ params: idParamSchema, body: seguimientoCreateSchema }),
    c.seguimiento,
  );

  return { name: 'reportes', basePath: 'reportes', router };
}

export const reportesModule = createReportesModule();
