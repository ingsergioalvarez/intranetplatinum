import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  bitacoraQuerySchema,
  comentarioBitacoraSchema,
  confirmarFaltaSchema,
  decidirFaltaSchema,
  idParamSchema,
  incidenciasMesQuerySchema,
  justificarBitacoraSchema,
  revertirDecisionSchema,
  type BitacoraQuery,
  type IncidenciasMesQuery,
  type ComentarioBitacoraInput,
  type ConfirmarFaltaInput,
  type DecidirFaltaInput,
  type IdParam,
  type JustificarBitacoraInput,
  type RevertirDecisionInput,
} from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  validate,
  type AppModule,
} from '../../core';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { atencionConPrisma, type AvisosAtencion } from '../avisos/atencion';
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

  revertir = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.revertir(
        this.params<IdParam>(req).id,
        this.body<RevertirDecisionInput>(req),
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
  atencion?: AvisosAtencion;
}

/** Bitácora del guardia (DA-41): solo admin y supervisor (permiso de ver asistencia). */
export function createBitacoraModule({
  repo = new PrismaBitacoraRepository(),
  audit = new PrismaAuditLogger(),
  ahora,
  alcance = alcanceConPrisma,
  medidas = medidasConPrisma,
  atencion = atencionConPrisma,
}: BitacoraModuleDeps = {}): AppModule {
  const c = new BitacoraController(new BitacoraService(repo, audit, ahora, medidas, atencion), alcance);
  const id = idParamSchema;

  const router = Router();
  // Control interno: ver la bitácora y anotar en ella son permisos distintos (el colaborador no tiene ninguno de los dos
  // sobre otras personas).
  const ver = requirePermission(PERMISOS.BITACORA_VER);
  const anotar = requirePermission(PERMISOS.BITACORA_ANOTAR);
  router.use(authenticate);
  router.get('/incidencias/guardias', ver, validate({ query: bitacoraQuerySchema }), c.incidenciasPorGuardia);
  router.get('/incidencias', ver, validate({ query: incidenciasMesQuerySchema }), c.incidencias);
  router.get('/guardias/:id', ver, validate({ params: id, query: bitacoraQuerySchema }), c.guardia);
  router.get('/guardias/:id/medidas', ver, validate({ params: id }), c.medidas);
  router.post(
    '/eventos/:id/confirmar-falta',
    anotar,
    validate({ params: id, body: confirmarFaltaSchema }),
    c.confirmarFalta,
  );
  // Revertir una decisión ya tomada: lo delicado, por defecto solo el admin (A-52).
  router.post(
    '/eventos/:id/revertir',
    requirePermission(PERMISOS.ASISTENCIA_ADMINISTRAR),
    validate({ params: id, body: revertirDecisionSchema }),
    c.revertir,
  );
  router.post('/eventos/:id/decidir', anotar, validate({ params: id, body: decidirFaltaSchema }), c.decidir);
  router.post(
    '/eventos/:id/comentarios',
    anotar,
    validate({ params: id, body: comentarioBitacoraSchema }),
    c.comentar,
  );
  router.post(
    '/eventos/:id/justificar',
    anotar,
    validate({ params: id, body: justificarBitacoraSchema }),
    c.justificar,
  );

  return { name: 'bitacora', basePath: 'bitacora', router, modulo: 'bitacora' };
}

export const bitacoraModule = createBitacoraModule();
