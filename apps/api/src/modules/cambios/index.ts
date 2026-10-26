import { Router, type Request, type Response } from 'express';
import {
  ROLES,
  cambiosTurnoQuerySchema,
  idParamSchema,
  nuevoCambioTurnoSchema,
  resolverCambioTurnoSchema,
  type CambiosTurnoQuery,
  type IdParam,
  type NuevoCambioTurnoData,
  type ResolverCambioTurnoInput,
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
import { PrismaCoberturasRepository } from '../coberturas/coberturas.repository';
import { CoberturasService, type TurnosFn } from '../coberturas/coberturas.service';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { CambiosRepository, PrismaCambiosRepository } from './cambios.repository';
import { CambiosService, type CoberturasPuerto } from './cambios.service';

class CambiosController extends BaseController {
  constructor(
    private readonly service: CambiosService,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  opciones = async (req: Request, res: Response) =>
    this.ok(res, await this.service.opciones(this.currentUser(req), await this.alcance(req)));

  listar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.listar(this.query<CambiosTurnoQuery>(req), this.currentUser(req), await this.alcance(req)),
    );

  crear = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.crear(
        this.body<NuevoCambioTurnoData>(req),
        this.currentUser(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  resolver = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.resolver(
        this.params<IdParam>(req).id,
        this.body<ResolverCambioTurnoInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  cancelar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cancelar(
        this.params<IdParam>(req).id,
        this.currentUser(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );
}

interface CambiosModuleDeps {
  repo?: CambiosRepository;
  turnos?: TurnosFn;
  coberturas?: CoberturasPuerto;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
  hoy?: () => string;
  ahora?: () => Date;
}

/** Cambios de turno (TC-22, DA-54): el guardia pide, el supervisor aprueba; el supervisor también los hace. */
export function createCambiosModule({
  repo = new PrismaCambiosRepository(),
  turnos = (desde, hasta) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
  coberturas,
  alcance = alcanceConPrisma,
  hoy,
  ahora,
}: CambiosModuleDeps = {}): AppModule {
  const servicioCoberturas = new CoberturasService(
    new PrismaCoberturasRepository(),
    turnos,
    audit,
    avisar,
    bitacora,
    hoy,
    ahora,
  );
  const puerto: CoberturasPuerto = coberturas ?? {
    // Ya lo autorizó quien aprueba: la cobertura se crea sin límite de alcance.
    crear: (d, ctx) => servicioCoberturas.crear(d, ctx, null),
    cancelar: (id, ctx) => servicioCoberturas.cancelar(id, ctx, null),
  };
  const c = new CambiosController(new CambiosService(repo, turnos, puerto, audit, avisar, bitacora, hoy, ahora), alcance);
  const router = Router();
  // El guardia pide los suyos; admin y supervisor, todos los de su alcance.
  router.use(authenticate, requireRoles(ROLES.GUARDIA, ROLES.SUPERVISOR, ROLES.ADMIN));
  router.get('/opciones', c.opciones);
  router.get('/', validate({ query: cambiosTurnoQuerySchema }), c.listar);
  router.post('/', validate({ body: nuevoCambioTurnoSchema }), c.crear);
  router.post('/:id/resolver', validate({ params: idParamSchema, body: resolverCambioTurnoSchema }), c.resolver);
  router.post('/:id/cancelar', validate({ params: idParamSchema }), c.cancelar);
  return { name: 'cambios-turno', basePath: 'cambios-turno', router };
}

export const cambiosModule = createCambiosModule();
