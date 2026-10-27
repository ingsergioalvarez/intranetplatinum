import { Router, type Request, type Response } from 'express';
import {
  PERMISOS,
  eliminarTurnoSchema,
  idParamSchema,
  turnoSchema,
  type EliminarTurnoData,
  type IdParam,
  type TurnoData,
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
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { alcanceConPrisma, type AlcanceFn } from '../sitios/alcance';
import { PrismaTurnosRepository, TurnosRepository } from './turnos.repository';
import { TurnosService } from './turnos.service';

class TurnosController extends BaseController {
  constructor(
    private readonly service: TurnosService,
    /** Supervisor: solo cambia sus sitios. */
    private readonly alcanceDe: AlcanceFn,
  ) {
    super();
  }

  list = async (_req: Request, res: Response) => this.ok(res, await this.service.listar());

  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.crear(this.body<TurnoData>(req), this.accionCtx(req)));

  update = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizar(
        this.params<IdParam>(req).id,
        this.body<TurnoData>(req),
        this.accionCtx(req),
      ),
    );

  baja = async (req: Request, res: Response) => {
    await this.service.darDeBaja(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  uso = async (req: Request, res: Response) =>
    this.ok(res, await this.service.uso(this.params<IdParam>(req).id, await this.alcanceDe(this.currentUser(req))));

  eliminar = async (req: Request, res: Response) => {
    await this.service.eliminar(
      this.params<IdParam>(req).id,
      this.body<EliminarTurnoData>(req),
      this.accionCtx(req),
      await this.alcanceDe(this.currentUser(req)),
    );
    return this.noContent(res);
  };

  reactivar = async (req: Request, res: Response) => {
    await this.service.reactivar(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };
}

interface TurnosModuleDeps {
  repo?: TurnosRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  hoy?: () => string;
  bitacora?: RegistrarBitacora;
  alcance?: AlcanceFn;
}

/** Catálogo de turnos (DA-37): lo consulta quien ve clientes; lo administra quien los edita. */
export function createTurnosModule({
  repo = new PrismaTurnosRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  hoy,
  bitacora = bitacoraConPrisma,
  alcance = alcanceConPrisma,
}: TurnosModuleDeps = {}): AppModule {
  const c = new TurnosController(new TurnosService(repo, audit, avisar, hoy, bitacora), alcance);
  const editar = requirePermission(PERMISOS.CLIENTES_EDITAR);
  const baja = requirePermission(PERMISOS.CLIENTES_BAJA);
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate);
  router.get('/', requirePermission(PERMISOS.CLIENTES_VER), c.list);
  router.post('/', editar, validate({ body: turnoSchema }), c.create);
  router.put('/:id', editar, validate({ params: idParamSchema, body: turnoSchema }), c.update);
  router.patch('/:id/baja', editar, id, c.baja);
  router.patch('/:id/reactivar', editar, id, c.reactivar);
  // Borrar: supervisor o admin. Si está asignado hay que elegir un turno nuevo por cada sitio activo.
  router.get('/:id/uso', baja, id, c.uso);
  router.delete('/:id', baja, validate({ params: idParamSchema, body: eliminarTurnoSchema }), c.eliminar);

  return { name: 'turnos', basePath: 'turnos', router };
}

export const turnosModule = createTurnosModule();
