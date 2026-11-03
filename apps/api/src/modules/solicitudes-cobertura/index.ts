import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  cancelarSolicitudSchema,
  idParamSchema,
  type CancelarSolicitudInput,
  type IdParam,
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
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { PrismaSolicitudesRepository, SolicitudesRepository } from './solicitudes.repository';
import { SolicitudesCoberturaService } from './solicitudes.service';

class SolicitudesController extends BaseController {
  constructor(private readonly service: SolicitudesCoberturaService) {
    super();
  }

  listar = async (req: Request, res: Response) => this.ok(res, await this.service.listar(this.currentUser(req)));

  cancelar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.cancelar(
        this.params<IdParam>(req).id,
        this.body<CancelarSolicitudInput>(req),
        this.currentUser(req),
        this.accionCtx(req),
      ),
    );
}

export interface SolicitudesDeps {
  repo?: SolicitudesRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  atencion?: AvisosAtencion;
  ahora?: () => Date;
}

/** El servicio con sus dependencias reales (lo usan las rutas, la asistencia, las coberturas y la vigilancia). */
export function crearServicioSolicitudes({
  repo = new PrismaSolicitudesRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  atencion = atencionConPrisma,
  ahora,
}: SolicitudesDeps = {}) {
  return new SolicitudesCoberturaService(repo, audit, avisar, atencion, ahora);
}

/** Solicitudes de cobertura (A-39): admin y supervisor; el supervisor solo ve las suyas. */
export function createSolicitudesCoberturaModule(deps: SolicitudesDeps = {}): AppModule {
  const c = new SolicitudesController(crearServicioSolicitudes(deps));
  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR), requirePermission(PERMISOS.ASISTENCIA_VER));
  router.get('/', c.listar);
  router.post('/:id/cancelar', validate({ params: idParamSchema, body: cancelarSolicitudSchema }), c.cancelar);
  return { name: 'solicitudes-cobertura', basePath: 'solicitudes-cobertura', router };
}

export const solicitudesCoberturaModule = createSolicitudesCoberturaModule();
