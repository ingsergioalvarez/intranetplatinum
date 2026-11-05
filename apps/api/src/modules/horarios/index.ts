import { Router, type Request, type Response } from 'express';
import { PERMISOS, ROLES, horarioPdfQuerySchema, type HorarioPdfQuery } from '@platinum/shared';
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
import { InformesRepository, PrismaInformesRepository } from '../informes/informes.repository';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { HorariosService } from './horarios.service';

class HorariosController extends BaseController {
  constructor(
    private readonly service: HorariosService,
    /** Supervisor: solo sus guardias y sitios. */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  pdf = async (req: Request, res: Response) => {
    const f = await this.service.pdf(
      this.query<HorarioPdfQuery>(req),
      this.accionCtx(req),
      await this.alcanceDe(this.currentUser(req)),
    );
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${f.nombre}"`,
        'Cache-Control': 'private, no-store',
      })
      .send(f.buffer);
  };
}

interface HorariosModuleDeps {
  repo?: InformesRepository;
  audit?: AuditLogger;
  alcance?: AlcanceFn;
  ahora?: () => Date;
}

/** Horario de guardias en PDF (A-55): solo admin y supervisor, nunca el guardia ni el cliente. */
export function createHorariosModule({
  repo = new PrismaInformesRepository(),
  audit = new PrismaAuditLogger(),
  alcance = alcanceConPrisma,
  ahora,
}: HorariosModuleDeps = {}): AppModule {
  const c = new HorariosController(new HorariosService(repo, audit, ahora), alcance);
  const router = Router();
  router.use(authenticate, requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.JEFE), requirePermission(PERMISOS.ASISTENCIA_VER));
  router.get('/pdf', validate({ query: horarioPdfQuerySchema }), c.pdf);
  return { name: 'horarios', basePath: 'horarios', router };
}

export const horariosModule = createHorariosModule();
