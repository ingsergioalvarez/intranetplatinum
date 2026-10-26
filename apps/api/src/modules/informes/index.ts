import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  PERMISOS,
  ROLES,
  idParamSchema,
  informesQuerySchema,
  nuevoInformeSchema,
  type IdParam,
  type InformesQuery,
  type NuevoInformeData,
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
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { InformesRepository, PrismaInformesRepository } from './informes.repository';
import { InformesService } from './informes.service';

const verificarParams = z.object({ folio: z.string().trim().regex(/^ASIS-\d{4}-\d{6}$/, 'Folio inválido') });
const verificarQuery = z.object({ c: z.string().trim().max(20).optional() });

class InformesController extends BaseController {
  constructor(
    private readonly service: InformesService,
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  opciones = async (req: Request, res: Response) => this.ok(res, await this.service.opciones(await this.alcance(req)));

  listar = async (req: Request, res: Response) =>
    this.paginated(
      res,
      await this.service.listar(this.query<InformesQuery>(req), this.currentUser(req), await this.alcance(req)),
    );

  emitir = async (req: Request, res: Response) => {
    const r = await this.service.emitir(this.body<NuevoInformeData>(req), this.accionCtx(req), await this.alcance(req));
    return this.ok(res, r, r.existente ? 200 : 201);
  };

  obtener = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.obtener(this.params<IdParam>(req).id, this.currentUser(req), await this.alcance(req)),
    );

  archivo = (formato: 'pdf' | 'excel') => async (req: Request, res: Response) => {
    const f = await this.service.archivo(
      this.params<IdParam>(req).id,
      formato,
      this.currentUser(req),
      await this.alcance(req),
    );
    res
      .status(200)
      .set({
        'Content-Type': f.tipo,
        'Content-Disposition': `attachment; filename="${f.nombre}"`,
        'Cache-Control': 'private, no-store',
      })
      .send(f.buffer);
  };

  verificar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.verificar(this.params<{ folio: string }>(req).folio, this.query<{ c?: string }>(req).c),
    );
}

interface InformesModuleDeps {
  repo?: InformesRepository;
  audit?: AuditLogger;
  ahora?: () => Date;
  alcance?: AlcanceFn;
}

/** Reporte oficial de asistencia (DA-52). Interno: admin y supervisor; el QR abre una verificación pública limitada. */
export function createInformesModule({
  repo = new PrismaInformesRepository(),
  audit = new PrismaAuditLogger(),
  ahora,
  alcance = alcanceConPrisma,
}: InformesModuleDeps = {}): AppModule {
  const c = new InformesController(new InformesService(repo, audit, ahora), alcance);
  const id = idParamSchema;
  const router = Router();

  // Verificación pública (QR del PDF): sin sesión, con límite de intentos; solo dice si es auténtico y sus totales.
  router.get(
    '/verificar/:folio',
    rateLimit({ windowMin: 1, max: 30 }),
    validate({ params: verificarParams, query: verificarQuery }),
    c.verificar,
  );

  router.use(
    authenticate,
    requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR),
    requirePermission(PERMISOS.ASISTENCIA_VER),
  );
  router.get('/opciones', c.opciones);
  router.get('/', validate({ query: informesQuerySchema }), c.listar);
  router.post('/', validate({ body: nuevoInformeSchema }), c.emitir);
  router.get('/:id', validate({ params: id }), c.obtener);
  router.get('/:id/pdf', validate({ params: id }), c.archivo('pdf'));
  router.get('/:id/excel', validate({ params: id }), c.archivo('excel'));

  return { name: 'informes', basePath: 'informes', router };
}

export const informesModule = createInformesModule();
