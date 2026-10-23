import { Router, type Request, type Response } from 'express';
import { PERMISOS, ROLES, idParamSchema, turnoSchema, type IdParam, type TurnoData } from '@platinum/shared';
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
import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { PrismaTurnosRepository, TurnosRepository } from './turnos.repository';
import { TurnosService } from './turnos.service';

class TurnosController extends BaseController {
  constructor(private readonly service: TurnosService) {
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

  eliminar = async (req: Request, res: Response) => {
    await this.service.eliminar(this.params<IdParam>(req).id, this.accionCtx(req));
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
}

/** Catálogo de turnos (DA-37): lo consulta quien ve clientes; lo administra quien los edita. */
export function createTurnosModule({
  repo = new PrismaTurnosRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  hoy,
  bitacora = bitacoraConPrisma,
}: TurnosModuleDeps = {}): AppModule {
  const c = new TurnosController(new TurnosService(repo, audit, avisar, hoy, bitacora));
  const editar = requirePermission(PERMISOS.CLIENTES_EDITAR);
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate);
  router.get('/', requirePermission(PERMISOS.CLIENTES_VER), c.list);
  router.post('/', editar, validate({ body: turnoSchema }), c.create);
  router.put('/:id', editar, validate({ params: idParamSchema, body: turnoSchema }), c.update);
  router.patch('/:id/baja', editar, id, c.baja);
  router.patch('/:id/reactivar', editar, id, c.reactivar);
  // Borrar un turno aunque esté asignado: solo el admin (los guardias siguen con su horario copiado).
  router.delete('/:id', requireRoles(ROLES.ADMIN), id, c.eliminar);

  return { name: 'turnos', basePath: 'turnos', router };
}

export const turnosModule = createTurnosModule();
