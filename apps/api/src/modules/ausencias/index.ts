import { Router, type Request, type Response } from 'express';
import {
  ausenciaCreateSchema,
  cancelarAusenciaSchema,
  idParamSchema,
  resolverAusenciaSchema,
  vistaPreviaAusenciaQuerySchema,
  type AusenciaCreateData,
  type CancelarAusenciaInput,
  type IdParam,
  type ResolverAusenciaInput,
  type VistaPreviaAusenciaQuery,
  PERMISOS,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  LocalStorageService,
  PrismaAuditLogger,
  StorageService,
  authenticate,
  uploadImages,
  validate,
  type AppModule,
  requirePermission,
} from '../../core';
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { AusenciasRepository, PrismaAusenciasRepository } from './ausencias.repository';
import { AusenciasService, type ArchivoComprobante } from './ausencias.service';

class AusenciasController extends BaseController {
  constructor(
    private readonly service: AusenciasService,
    /** Supervisor: solo sus guardias. */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  listar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.listar(this.currentUser(req), await this.alcance(req)));

  vistaPrevia = async (req: Request, res: Response) => {
    const q = this.query<VistaPreviaAusenciaQuery>(req);
    return this.ok(res, await this.service.vistaPrevia(q.usuarioId, q.desde, q.hasta, await this.alcance(req)));
  };

  crear = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crear(
        this.body<AusenciaCreateData>(req),
        req.file as ArchivoComprobante | undefined,
        this.currentUser(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  resolver = async (req: Request, res: Response) =>
    this.ok(res, await this.service.resolver(this.params<IdParam>(req).id, this.body<ResolverAusenciaInput>(req), this.accionCtx(req)));

  cancelar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cancelar(
        this.params<IdParam>(req).id,
        this.body<CancelarAusenciaInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
      ),
    );
}

export interface AusenciasDeps {
  repo?: AusenciasRepository;
  storage?: StorageService;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
  atencion?: AvisosAtencion;
  alcance?: AlcanceFn;
  hoy?: () => string;
  ahora?: () => Date;
}

/**
 * Ausencias justificadas por adelantado (A-43). El guardia pide la suya, el supervisor la de un guardia
 * suyo y el admin las registra o las aprueba.
 */
export function createAusenciasModule({
  repo = new PrismaAusenciasRepository(),
  storage = new LocalStorageService(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
  atencion = atencionConPrisma,
  alcance = alcanceConPrisma,
  hoy,
  ahora,
}: AusenciasDeps = {}): AppModule {
  const c = new AusenciasController(new AusenciasService(repo, storage, audit, avisar, bitacora, atencion, hoy, ahora), alcance);
  const router = Router();
  const pedir = requirePermission(PERMISOS.AUSENCIAS_PEDIR);
  const resolver = requirePermission(PERMISOS.AUSENCIAS_RESOLVER);
  router.use(authenticate, pedir);
  router.get('/', c.listar);
  router.get(
    '/vista-previa',
    resolver,
    validate({ query: vistaPreviaAusenciaQuerySchema }),
    c.vistaPrevia,
  );
  // Comprobante opcional según el tipo: una sola foto; multer no hace nada si la petición no la trae.
  router.post('/', uploadImages.single('foto'), validate({ body: ausenciaCreateSchema }), c.crear);
  router.post('/:id/resolver', resolver, validate({ params: idParamSchema, body: resolverAusenciaSchema }), c.resolver);
  router.post('/:id/cancelar', validate({ params: idParamSchema, body: cancelarAusenciaSchema }), c.cancelar);
  return { name: 'ausencias', basePath: 'ausencias', router, modulo: 'ausencias' };
}

export const ausenciasModule = createAusenciasModule();
