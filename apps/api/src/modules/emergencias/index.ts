import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  ROLES,
  emergenciaCerrarSchema,
  emergenciaCreateSchema,
  emergenciaTipoSchema,
  idParamSchema,
  type EmergenciaCerrarInput,
  type EmergenciaCreateInput,
  type EmergenciaTipoInput,
  type IdParam,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  PrismaAuditLogger,
  authenticate,
  rateLimit,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { EmergenciasRepository, PrismaEmergenciasRepository } from './emergencias.repository';
import { EmergenciasService } from './emergencias.service';

const listaQuerySchema = z.object({ estado: z.enum(['activas', 'todas']).default('activas') });

class EmergenciasController extends BaseController {
  constructor(private readonly service: EmergenciasService) {
    super();
  }

  crear = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<EmergenciaCreateInput>(req), this.currentUser(req), this.accionCtx(req)));

  mia = async (req: Request, res: Response) => this.ok(res, await this.service.mia(this.currentUser(req)));

  tipo = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.fijarTipo(
        this.params<IdParam>(req).id,
        this.body<EmergenciaTipoInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
      ),
    );

  cancelar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.cancelar(this.params<IdParam>(req).id, this.currentUser(req), this.accionCtx(req)));

  listar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.listar(this.query<{ estado: 'activas' | 'todas' }>(req).estado === 'activas'));

  acusar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.acusar(this.params<IdParam>(req).id, this.currentUser(req), this.accionCtx(req)));

  cerrar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cerrar(
        this.params<IdParam>(req).id,
        this.body<EmergenciaCerrarInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
      ),
    );
}

export interface EmergenciasDeps {
  repo?: EmergenciasRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  atencion?: AvisosAtencion;
  ahora?: () => Date;
}

/** El servicio con sus dependencias reales (lo usan las rutas y la vigilancia, que escala las sin respuesta). */
export function crearServicioEmergencias({
  repo = new PrismaEmergenciasRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  atencion = atencionConPrisma,
  ahora,
}: EmergenciasDeps = {}) {
  return new EmergenciasService(repo, audit, avisar, atencion, ahora);
}

/**
 * Botón de pánico (A-60). Lo lanzan guardia, supervisor y admin (no el cliente); lo reciben, acusan y cierran
 * supervisor y admin. El guardia solo ve y cancela la suya.
 */
export function createEmergenciasModule(deps: EmergenciasDeps = {}): AppModule {
  const c = new EmergenciasController(crearServicioEmergencias(deps));
  const router = Router();
  const personal = requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.GUARDIA);
  const mando = requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR);
  router.use(authenticate);
  router.post('/', personal, rateLimit({ windowMin: 1, max: 10 }), validate({ body: emergenciaCreateSchema }), c.crear);
  router.get('/mia', personal, c.mia);
  router.post('/:id/tipo', personal, validate({ params: idParamSchema, body: emergenciaTipoSchema }), c.tipo);
  router.post('/:id/cancelar', personal, validate({ params: idParamSchema }), c.cancelar);
  router.get('/', mando, validate({ query: listaQuerySchema }), c.listar);
  router.post('/:id/acusar', mando, validate({ params: idParamSchema }), c.acusar);
  router.post('/:id/cerrar', mando, validate({ params: idParamSchema, body: emergenciaCerrarSchema }), c.cerrar);
  return { name: 'emergencias', basePath: 'emergencias', router };
}

export const emergenciasModule = createEmergenciasModule();
