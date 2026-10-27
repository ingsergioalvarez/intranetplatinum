import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  coberturaQuerySchema,
  resumenCoberturaQuerySchema,
  type CoberturaQuery,
  type ResumenCoberturaQuery,
} from '@platinum/shared';
import { BaseController, authenticate, requirePermission, requireRoles, validate, type AppModule } from '../../core';
import { PrismaVigilanciaRepository } from '../asistencia/vigilancia.repository';
import type { TurnosFn } from '../coberturas/coberturas.service';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { AvisosHuecos } from './huecos';
import { CoberturaRepository, PrismaCoberturaRepository } from './cobertura.repository';
import { CoberturaService } from './cobertura.service';

class CoberturaController extends BaseController {
  constructor(
    private readonly service: CoberturaService,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  sitio = async (req: Request, res: Response) =>
    this.ok(res, await this.service.sitio(this.query<CoberturaQuery>(req), await this.alcanceDe(this.currentUser(req))));

  resumen = async (req: Request, res: Response) =>
    this.ok(res, await this.service.resumen(this.query<ResumenCoberturaQuery>(req), await this.alcanceDe(this.currentUser(req))));
}

export interface CoberturaDeps {
  repo?: CoberturaRepository;
  turnos?: TurnosFn;
  alcance?: AlcanceFn;
  ahora?: () => Date;
}

/** Calendario de cobertura de sitios (AS6, DA-56): admin y supervisor (solo sus sitios). */
export function createCoberturaModule({
  repo = new PrismaCoberturaRepository(),
  turnos = (desde, hasta) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  alcance = alcanceConPrisma,
  ahora,
}: CoberturaDeps = {}): AppModule {
  const c = new CoberturaController(new CoberturaService(repo, turnos, ahora), alcance);
  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR), requirePermission(PERMISOS.ASISTENCIA_VER));
  router.get('/', validate({ query: coberturaQuerySchema }), c.sitio);
  router.get('/resumen', validate({ query: resumenCoberturaQuerySchema }), c.resumen);
  return { name: 'cobertura', basePath: 'cobertura', router };
}

/** Revisión periódica: avisa al supervisor de los turnos sin cubrir de los próximos días (AS6-04). */
export function crearAvisosHuecos({
  repo = new PrismaCoberturaRepository(),
  turnos = (desde: string, hasta: string) => new PrismaVigilanciaRepository().turnosVigentes(desde, hasta),
  avisar = avisarConPrisma,
  ahora,
}: { repo?: CoberturaRepository; turnos?: TurnosFn; avisar?: AvisarUsuarios; ahora?: () => Date } = {}) {
  return new AvisosHuecos(new CoberturaService(repo, turnos, ahora), repo, avisar, ahora);
}

export const coberturaModule = createCoberturaModule();
