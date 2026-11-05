import { Router, type Request, type Response } from 'express';
import {
  ROLES,
  atenderReporteClienteSchema,
  idParamSchema,
  reporteClienteCreateSchema,
  type AtenderReporteClienteData,
  type IdParam,
  type ReporteClienteCreateData,
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
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { PrismaReportesClienteRepository, ReportesClienteRepository } from './reportesCliente.repository';
import { ReportesClienteService } from './reportesCliente.service';

class ReportesClienteController extends BaseController {
  constructor(private readonly service: ReportesClienteService) {
    super();
  }

  listar = async (req: Request, res: Response) => this.ok(res, await this.service.listar(this.currentUser(req)));

  opciones = async (req: Request, res: Response) => this.ok(res, await this.service.opciones(this.currentUser(req)));

  crear = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.currentUser(req), this.body<ReporteClienteCreateData>(req), this.accionCtx(req)));

  atender = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.atender(
        this.params<IdParam>(req).id,
        this.currentUser(req),
        this.body<AtenderReporteClienteData>(req),
        this.accionCtx(req),
      ),
    );
}

export interface ReportesClienteDeps {
  repo?: ReportesClienteRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  atencion?: AvisosAtencion;
  hoy?: () => string;
  ahora?: () => Date;
}

/**
 * Reportes del cliente sobre el servicio o un guardia (A-59). El cliente los levanta; el supervisor del sitio y el
 * admin dueño del cliente los atienden. El guardia no tiene acceso.
 */
export function createReportesClienteModule({
  repo = new PrismaReportesClienteRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  atencion = atencionConPrisma,
  hoy,
  ahora,
}: ReportesClienteDeps = {}): AppModule {
  const c = new ReportesClienteController(new ReportesClienteService(repo, audit, avisar, atencion, hoy, ahora));
  const router = Router();
  router.use(authenticate);
  router.get('/', requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE, ROLES.CLIENTE), c.listar);
  router.get('/opciones', requireRoles(ROLES.CLIENTE), c.opciones);
  router.post('/', requireRoles(ROLES.CLIENTE), validate({ body: reporteClienteCreateSchema }), c.crear);
  router.post(
    '/:id/atender',
    requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE),
    validate({ params: idParamSchema, body: atenderReporteClienteSchema }),
    c.atender,
  );
  return { name: 'reportes-cliente', basePath: 'reportes-cliente', router, modulo: 'quejas' };
}

export const reportesClienteModule = createReportesClienteModule();
