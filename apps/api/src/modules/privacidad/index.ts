import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  aceptarAvisoSchema,
  type AceptarAvisoData,
  type FiltroAvisoPrivacidad,
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
import { PrismaPrivacidadRepository, PrivacidadRepository } from './privacidad.repository';
import { PrivacidadService } from './privacidad.service';

class PrivacidadController extends BaseController {
  constructor(private readonly service: PrivacidadService) {
    super();
  }

  estado = async (req: Request, res: Response) => this.ok(res, await this.service.estado(this.currentUser(req)));

  aceptar = async (req: Request, res: Response) =>
    this.ok(res, await this.service.aceptar(this.currentUser(req), this.body<AceptarAvisoData>(req), this.accionCtx(req)));

  guardias = async (req: Request, res: Response) => {
    const filtro: FiltroAvisoPrivacidad = req.query.filtro === 'pendientes' ? 'pendientes' : 'todos';
    return this.ok(res, await this.service.guardias(this.currentUser(req), filtro));
  };
}

export interface PrivacidadDeps {
  repo?: PrivacidadRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  atencion?: AvisosAtencion;
}

/**
 * Aviso de privacidad por el uso del rostro (A-68): el guardia consulta y acepta; admin y supervisor ven quién
 * falta (dentro de su cartera). El candado que impide checar sin aceptar vive en `aceptado.ts`.
 */
export function createPrivacidadModule({
  repo = new PrismaPrivacidadRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  atencion = atencionConPrisma,
}: PrivacidadDeps = {}): AppModule {
  const c = new PrivacidadController(new PrivacidadService(repo, audit, avisar, atencion));
  const router = Router();
  router.use(authenticate);
  router.get('/estado', requirePermission(PERMISOS.ASISTENCIA_MARCAR), c.estado);
  router.post('/aceptar', requirePermission(PERMISOS.ASISTENCIA_MARCAR), validate({ body: aceptarAvisoSchema }), c.aceptar);
  router.get('/guardias', requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR), c.guardias);
  return { name: 'privacidad', basePath: 'privacidad', router };
}

export const privacidadModule = createPrivacidadModule();
