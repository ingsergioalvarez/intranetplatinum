import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  ROLES,
  bitacoraQuerySchema,
  comentarioBitacoraSchema,
  confirmarFaltaSchema,
  decidirFaltaSchema,
  idParamSchema,
  incidenciasMesQuerySchema,
  justificarBitacoraSchema,
  type BitacoraQuery,
  type IncidenciasMesQuery,
  type ComentarioBitacoraInput,
  type ConfirmarFaltaInput,
  type DecidirFaltaInput,
  type IdParam,
  type JustificarBitacoraInput,
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
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { medidasConPrisma, type MedidasPuerto } from '../medidas/medidas';
import { BitacoraRepository, PrismaBitacoraRepository } from './bitacora.repository';
import { BitacoraService } from './bitacora.service';

class BitacoraController extends BaseController {
  constructor(
    private readonly service: BitacoraService,
    /** Supervisor: solo sus guardias (DA-45). */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  private alcance(req: Request) {
    return this.alcanceDe(this.currentUser(req));
  }

  guardia = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.delGuardia(
        this.params<IdParam>(req).id,
        this.query<BitacoraQuery>(req).mes,
        await this.alcance(req),
      ),
    );

  incidenciasPorGuardia = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.incidenciasPorGuardia(this.query<BitacoraQuery>(req).mes, await this.alcance(req)),
    );

  incidencias = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.incidencias(this.query<IncidenciasMesQuery>(req), await this.alcance(req)),
    );

  decidir = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.decidir(
        this.params<IdParam>(req).id,
        this.body<DecidirFaltaInput>(req).decision,
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  comentar = async (req: Request, res: Response) =>
    this.created(
      res,
      await this.service.comentar(
        this.params<IdParam>(req).id,
        this.body<ComentarioBitacoraInput>(req).texto,
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  justificar = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.justificar(
        this.params<IdParam>(req).id,
        this.body<JustificarBitacoraInput>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  confirmarFalta = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.confirmarFalta(
        this.params<IdParam>(req).id,
        this.body<ConfirmarFaltaInput>(req),
        this.accionCtx(req),
        await this.alcance(req),
      ),
    );

  medidas = async (req: Request, res: Response) =>
    this.ok(res, await this.service.medidasDelGuardia(this.params<IdParam>(req).id, await this.alcance(req)));
}

interface BitacoraModuleDeps {
  repo?: BitacoraRepository;
  audit?: AuditLogger;
  ahora?: () => Date;
  alcance?: AlcanceFn;
  medidas?: MedidasPuerto;
}

/** Bitácora del guardia (DA-41): solo admin y supervisor (permiso de ver asistencia). */
export function createBitacoraModule({
  repo = new PrismaBitacoraRepository(),
  audit = new PrismaAuditLogger(),
  ahora,
  alcance = alcanceConPrisma,
  medidas = medidasConPrisma,
}: BitacoraModuleDeps = {}): AppModule {
  const c = new BitacoraController(new BitacoraService(repo, audit, ahora, medidas), alcance);
  const id = idParamSchema;

  const router = Router();
  // Control interno: solo admin y supervisor. El permiso de ver asistencia no basta porque el rol
  // cliente también lo tiene (portal de clientes, DA-48) y no debe ver la bitácora disciplinaria.
  router.use(
    authenticate,
    requireRoles(ROLES.ADMIN, ROLES.SUPERVISOR),
    requirePermission(PERMISOS.ASISTENCIA_VER),
  );
  // Incidencias de todos (DA-42): por guardia y lista general.
  router.get('/incidencias/guardias', validate({ query: bitacoraQuerySchema }), c.incidenciasPorGuardia);
  router.get('/incidencias', validate({ query: incidenciasMesQuerySchema }), c.incidencias);
  router.get('/guardias/:id', validate({ params: id, query: bitacoraQuerySchema }), c.guardia);
  router.get('/guardias/:id/medidas', validate({ params: id }), c.medidas);
  router.post(
    '/eventos/:id/confirmar-falta',
    validate({ params: id, body: confirmarFaltaSchema }),
    c.confirmarFalta,
  );
  router.post('/eventos/:id/decidir', validate({ params: id, body: decidirFaltaSchema }), c.decidir);
  router.post(
    '/eventos/:id/comentarios',
    validate({ params: id, body: comentarioBitacoraSchema }),
    c.comentar,
  );
  router.post(
    '/eventos/:id/justificar',
    validate({ params: id, body: justificarBitacoraSchema }),
    c.justificar,
  );

  return { name: 'bitacora', basePath: 'bitacora', router };
}

export const bitacoraModule = createBitacoraModule();
