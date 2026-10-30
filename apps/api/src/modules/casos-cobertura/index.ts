import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  cancelarPlanSchema,
  entradaIdParamSchema,
  noPuedoQuedarmeSchema,
  resolverCasoSchema,
  vistaPreviaCasoQuerySchema,
  type CancelarPlanData,
  type EntradaIdParam,
  type NoPuedoQuedarmeData,
  type ResolverCasoData,
  type VistaPreviaCasoQuery,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { PrismaVigilanciaRepository } from '../asistencia/vigilancia.repository';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { PrismaCoberturasRepository } from '../coberturas/coberturas.repository';
import { CoberturasService, type TurnosFn } from '../coberturas/coberturas.service';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { CasosCoberturaRepository, PrismaCasosCoberturaRepository } from './casos.repository';
import { CasosCoberturaService, type CancelarCoberturaFn, type CubrirFn } from './casos.service';

class CasosCoberturaController extends BaseController {
  constructor(
    private readonly service: CasosCoberturaService,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  listar = async (req: Request, res: Response) => this.ok(res, await this.service.listar(await this.alcance(req)));

  vistaPrevia = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.vistaPrevia(
        this.params<EntradaIdParam>(req).entradaId,
        this.query<VistaPreviaCasoQuery>(req),
        await this.alcance(req),
      ),
    );

  resolver = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.resolver(
        this.params<EntradaIdParam>(req).entradaId,
        this.body<ResolverCasoData>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  cambiar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cambiarPlan(
        this.params<EntradaIdParam>(req).entradaId,
        this.body<ResolverCasoData>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  cancelar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cancelarPlan(
        this.params<EntradaIdParam>(req).entradaId,
        this.body<CancelarPlanData>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  noPuedo = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.noPuedoQuedarme(this.currentUser(req).id, this.body<NoPuedoQuedarmeData>(req), this.accionCtx(req)),
    );
}

export interface CasosCoberturaDeps {
  repo?: CasosCoberturaRepository;
  turnos?: TurnosFn;
  cubrir?: CubrirFn;
  cancelarCobertura?: CancelarCoberturaFn;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
  ahora?: () => Date;
}

/** El servicio con sus dependencias reales (lo usan las rutas y la vigilancia). */
export function crearServicioCasos({
  repo = new PrismaCasosCoberturaRepository(),
  turnos = (desde, hasta) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
  cubrir,
  cancelarCobertura,
  ahora,
}: CasosCoberturaDeps = {}) {
  const coberturas = new CoberturasService(new PrismaCoberturasRepository(), turnos, audit, avisar, bitacora);
  return new CasosCoberturaService(
    repo,
    turnos,
    cubrir ?? ((data, ctx, alcance) => coberturas.crear(data, ctx, alcance)),
    audit,
    avisar,
    bitacora,
    ahora,
    cancelarCobertura ?? ((id, ctx, alcance) => coberturas.cancelar(id, ctx, alcance)),
  );
}

/**
 * Casos de cobertura (AS6-05, AS6-06): admin y supervisor dejan el plan cuando un guardia sigue en
 * el sitio porque su relevo no llega; el guardia solo puede avisar que no puede quedarse.
 */
export function createCasosCoberturaModule({ alcance = alcanceConPrisma, ...deps }: CasosCoberturaDeps = {}): AppModule {
  const c = new CasosCoberturaController(crearServicioCasos(deps), alcance);
  const router = Router();
  router.use(authenticate);
  router.post(
    '/no-puedo',
    requireRoles(ROLES.GUARDIA),
    requirePermission(PERMISOS.ASISTENCIA_MARCAR),
    validate({ body: noPuedoQuedarmeSchema }),
    c.noPuedo,
  );
  const revision = [requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR), requirePermission(PERMISOS.ASISTENCIA_VER)];
  router.get('/', ...revision, c.listar);
  router.get('/:entradaId/vista-previa', ...revision, validate({ params: entradaIdParamSchema, query: vistaPreviaCasoQuerySchema }), c.vistaPrevia);
  router.post('/:entradaId/resolver', ...revision, validate({ params: entradaIdParamSchema, body: resolverCasoSchema }), c.resolver);
  router.post('/:entradaId/cambiar', ...revision, validate({ params: entradaIdParamSchema, body: resolverCasoSchema }), c.cambiar);
  router.post('/:entradaId/cancelar', ...revision, validate({ params: entradaIdParamSchema, body: cancelarPlanSchema }), c.cancelar);
  return { name: 'casos-cobertura', basePath: 'casos-cobertura', router };
}

export const casosCoberturaModule = createCasosCoberturaModule();
