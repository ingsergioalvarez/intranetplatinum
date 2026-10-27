import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  capturaHoraExtraSchema,
  cortarHoraExtraSchema,
  extenderHorarioSchema,
  horasExtraQuerySchema,
  idParamSchema,
  reporteHorasExtraQuerySchema,
  resolverHoraExtraSchema,
  type CapturaHoraExtraInput,
  type CortarHoraExtraInput,
  type ExtenderHorarioInput,
  type HorasExtraQuery,
  type IdParam,
  type ReporteHorasExtraQuery,
  type ResolverHoraExtraInput,
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
import type { MisSitiosFn } from '../asistencia/asistencia.service';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import type { TurnosFn } from '../coberturas/coberturas.service';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { PrismaSitiosRepository } from '../sitios/sitios.repository';
import { HorasExtraRepository, PrismaHorasExtraRepository } from './horasExtra.repository';
import { HorasExtraService } from './horasExtra.service';

class HorasExtraController extends BaseController {
  constructor(
    private readonly service: HorasExtraService,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  opciones = async (req: Request, res: Response) => this.ok(res, await this.service.opciones(await this.alcance(req)));

  listar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.listar(this.query<HorasExtraQuery>(req), await this.alcance(req)));

  reporte = async (req: Request, res: Response) =>
    this.ok(res, await this.service.reporte(this.query<ReporteHorasExtraQuery>(req), await this.alcance(req)));

  capturar = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.capturar(this.body<CapturaHoraExtraInput>(req), this.accionCtx(req), await this.alcance(req)),
    );

  resolver = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.resolver(
        this.params<IdParam>(req).id,
        this.body<ResolverHoraExtraInput>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  cortar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cortar(
        this.params<IdParam>(req).id,
        this.body<CortarHoraExtraInput>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  extender = async (req: Request, res: Response) =>
    this.ok(res, await this.service.extender(this.currentUser(req).id, this.body<ExtenderHorarioInput>(req)));
}

export interface HorasExtraDeps {
  repo?: HorasExtraRepository;
  turnos?: TurnosFn;
  misSitios?: MisSitiosFn;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
  ahora?: () => Date;
}

/** El servicio con sus dependencias reales (lo usan las rutas, la asistencia y la vigilancia). */
export function crearServicioHorasExtra({
  repo = new PrismaHorasExtraRepository(),
  turnos = (desde, hasta) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  misSitios = (usuarioId, hoy) => new PrismaSitiosRepository().misSitios(usuarioId, hoy),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
  ahora,
}: HorasExtraDeps = {}) {
  return new HorasExtraService(repo, turnos, misSitios, audit, avisar, bitacora, ahora);
}

/**
 * Horas extra (AS5, DA-55): el guardia dice que sigue en turno; admin y supervisor las revisan,
 * las cortan o las capturan. El guardia no ve la sección.
 */
export function createHorasExtraModule({ alcance = alcanceConPrisma, ...deps }: HorasExtraDeps = {}): AppModule {
  const c = new HorasExtraController(crearServicioHorasExtra(deps), alcance);
  const router = Router();
  router.use(authenticate);
  router.post(
    '/extender',
    requireRoles(ROLES.GUARDIA),
    requirePermission(PERMISOS.ASISTENCIA_MARCAR),
    validate({ body: extenderHorarioSchema }),
    c.extender,
  );
  const revision = [requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR), requirePermission(PERMISOS.ASISTENCIA_VER)];
  router.get('/opciones', ...revision, c.opciones);
  router.get('/reporte', ...revision, validate({ query: reporteHorasExtraQuerySchema }), c.reporte);
  router.get('/', ...revision, validate({ query: horasExtraQuerySchema }), c.listar);
  router.post('/', ...revision, validate({ body: capturaHoraExtraSchema }), c.capturar);
  router.post('/:id/resolver', ...revision, validate({ params: idParamSchema, body: resolverHoraExtraSchema }), c.resolver);
  router.post('/:id/cortar', ...revision, validate({ params: idParamSchema, body: cortarHoraExtraSchema }), c.cortar);
  return { name: 'horas-extra', basePath: 'horas-extra', router };
}

export const horasExtraModule = createHorasExtraModule();
