import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  PERMISOS,
  ROLES,
  emergenciaCerrarSchema,
  emergenciaRespuestaSchema,
  emergenciaCreateSchema,
  emergenciaTipoSchema,
  idParamSchema,
  type EmergenciaCerrarInput,
  type EmergenciaRespuestaInput,
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
  requirePermission,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { registrarEventoC2ConPrisma, respuestasConPrisma, type RegistrarEventoC2, type RespuestasDe } from '../c2/bitacora';
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
    this.ok(
      res,
      await this.service.listar(this.query<{ estado: 'activas' | 'todas' }>(req).estado === 'activas', this.currentUser(req)),
    );

  acusar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.acusar(this.params<IdParam>(req).id, this.currentUser(req), this.accionCtx(req)));

  responder = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.responder(
        this.params<IdParam>(req).id,
        this.body<EmergenciaRespuestaInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
      ),
    );

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
  /** Bitácora del C2 (A-80). */
  bitacoraC2?: RegistrarEventoC2;
  /** Lo que ya se hizo en cada emergencia (A-81). */
  respuestas?: RespuestasDe;
}

/** El servicio con sus dependencias reales (lo usan las rutas y la vigilancia, que escala las sin respuesta). */
export function crearServicioEmergencias({
  repo = new PrismaEmergenciasRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  atencion = atencionConPrisma,
  ahora,
  bitacoraC2 = registrarEventoC2ConPrisma,
  respuestas = respuestasConPrisma,
}: EmergenciasDeps = {}) {
  return new EmergenciasService(repo, audit, avisar, atencion, ahora, bitacoraC2, respuestas);
}

/**
 * Botón de pánico (A-60). Lo lanzan guardia, supervisor y admin (no el cliente); lo reciben, acusan y cierran
 * supervisor y admin; el C2 también la recibe y responde que la atiende (A-61). El guardia solo ve y cancela la suya.
 */
export function createEmergenciasModule(deps: EmergenciasDeps = {}): AppModule {
  const c = new EmergenciasController(crearServicioEmergencias(deps));
  const router = Router();
  const personal = requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.GUARDIA);
  const mando = requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR);
  // El C2 también responde que la está atendiendo (A-61); cerrarla sigue siendo de admin y supervisor.
  const atiende = requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.C2);
  router.use(authenticate);
  router.post('/', personal, rateLimit({ windowMin: 1, max: 10 }), validate({ body: emergenciaCreateSchema }), c.crear);
  router.get('/mia', personal, c.mia);
  router.post('/:id/tipo', personal, validate({ params: idParamSchema, body: emergenciaTipoSchema }), c.tipo);
  router.post('/:id/cancelar', personal, validate({ params: idParamSchema }), c.cancelar);
  router.get('/', atiende, validate({ query: listaQuerySchema }), c.listar);
  router.post('/:id/acusar', atiende, validate({ params: idParamSchema }), c.acusar);
  // El C2 registra lo que hizo con la emergencia (A-81): permiso de actuar del C2.
  router.post('/:id/respuesta', requirePermission(PERMISOS.C2_ACTUAR), validate({ params: idParamSchema, body: emergenciaRespuestaSchema }), c.responder);
  router.post('/:id/cerrar', mando, validate({ params: idParamSchema, body: emergenciaCerrarSchema }), c.cerrar);
  return { name: 'emergencias', basePath: 'emergencias', router };
}

export const emergenciasModule = createEmergenciasModule();
