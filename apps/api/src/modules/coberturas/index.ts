import { Router, type Request, type Response } from 'express';
import {
  ROLES,
  candidatosCoberturaQuerySchema,
  coberturaCreateSchema,
  coberturasQuerySchema,
  idParamSchema,
  type CandidatosCoberturaQuery,
  type CoberturaData,
  type CoberturasQuery,
  type IdParam,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  PrismaAuditLogger,
  authenticate,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { PrismaVigilanciaRepository } from '../asistencia/vigilancia.repository';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { CoberturasRepository, PrismaCoberturasRepository } from './coberturas.repository';
import { CoberturasService, type TurnosFn } from './coberturas.service';

class CoberturasController extends BaseController {
  constructor(
    private readonly service: CoberturasService,
    /** Supervisor: solo sus sitios y sus guardias (DA-46). */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  candidatos = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.candidatos(this.query<CandidatosCoberturaQuery>(req), await this.alcance(req)),
    );

  listar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.listar(this.query<CoberturasQuery>(req), await this.alcance(req)));

  crear = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crear(this.body<CoberturaData>(req), this.accionCtx(req), await this.alcance(req)),
    );

  cancelar = async (req: Request, res: Response) => {
    await this.service.cancelar(this.params<IdParam>(req).id, this.accionCtx(req), await this.alcance(req));
    return this.noContent(res);
  };
}

interface CoberturasModuleDeps {
  repo?: CoberturasRepository;
  turnos?: TurnosFn;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
  hoy?: () => string;
  ahora?: () => Date;
}

/** Cubrir otro sitio (DA-39, DA-46): solo admin y supervisor. */
export function createCoberturasModule({
  repo = new PrismaCoberturasRepository(),
  turnos = (desde, hasta) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
  alcance = alcanceConPrisma,
  hoy,
  ahora,
}: CoberturasModuleDeps = {}): AppModule {
  const c = new CoberturasController(
    new CoberturasService(repo, turnos, audit, avisar, bitacora, hoy, ahora),
    alcance,
  );
  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR));
  router.get('/candidatos', validate({ query: candidatosCoberturaQuerySchema }), c.candidatos);
  router.get('/', validate({ query: coberturasQuerySchema }), c.listar);
  router.post('/', validate({ body: coberturaCreateSchema }), c.crear);
  router.delete('/:id', validate({ params: idParamSchema }), c.cancelar);
  return { name: 'coberturas', basePath: 'coberturas', router };
}

export const coberturasModule = createCoberturasModule();
