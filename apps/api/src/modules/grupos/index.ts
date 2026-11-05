import { bitacoraConPrisma, type RegistrarBitacora } from '../bitacora/registrar';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  PERMISOS,
  grupoSchema,
  idParamSchema,
  integrantesSchema,
  type GrupoData,
  type IdParam,
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
import { GruposRepository, PrismaGruposRepository, type GrupoFiltro } from './grupos.repository';
import { GruposService } from './grupos.service';

const filtroSchema = z.object({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(['activos', 'baja', 'todos']).default('activos'),
});

/** Alta: datos del grupo + integrantes iniciales (opcional). */
const crearSchema = grupoSchema.extend({ usuarioIds: integrantesSchema.shape.usuarioIds.default([]) });

class GruposController extends BaseController {
  constructor(private readonly service: GruposService) {
    super();
  }

  list = async (req: Request, res: Response) =>
    this.ok(res, await this.service.listar(this.query<GrupoFiltro>(req)));

  get = async (req: Request, res: Response) =>
    this.ok(res, await this.service.getById(this.params<IdParam>(req).id));

  create = async (req: Request, res: Response) => {
    const { usuarioIds, ...data } = this.body<GrupoData & { usuarioIds: number[] }>(req);
    return this.created(res, await this.service.crear(data, usuarioIds, this.accionCtx(req)));
  };

  update = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.actualizar(
        this.params<IdParam>(req).id,
        this.body<Partial<GrupoData>>(req),
        this.accionCtx(req),
      ),
    );

  integrantes = async (req: Request, res: Response) =>
    this.ok(
      res,
      await this.service.setIntegrantes(
        this.params<IdParam>(req).id,
        this.body<{ usuarioIds: number[] }>(req).usuarioIds,
        this.accionCtx(req),
      ),
    );

  baja = async (req: Request, res: Response) => {
    await this.service.darDeBaja(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };

  reactivar = async (req: Request, res: Response) => {
    await this.service.reactivar(this.params<IdParam>(req).id, this.accionCtx(req));
    return this.noContent(res);
  };
}

interface GruposModuleDeps {
  repo?: GruposRepository;
  audit?: AuditLogger;
  hoy?: () => string;
  avisar?: AvisarUsuarios;
  bitacora?: RegistrarBitacora;
}

/** Grupos de guardias (F2-06). Los administra quien tenga `grupos.administrar`. */
export function createGruposModule({
  repo = new PrismaGruposRepository(),
  audit = new PrismaAuditLogger(),
  hoy,
  avisar = avisarConPrisma,
  bitacora = bitacoraConPrisma,
}: GruposModuleDeps = {}): AppModule {
  const c = new GruposController(new GruposService(repo, audit, hoy, avisar, bitacora));
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate, requirePermission(PERMISOS.GRUPOS_ADMINISTRAR));
  router.get('/', validate({ query: filtroSchema }), c.list);
  router.get('/:id', id, c.get);
  router.post('/', validate({ body: crearSchema }), c.create);
  router.patch('/:id', validate({ params: idParamSchema, body: grupoSchema.partial() }), c.update);
  router.put('/:id/integrantes', validate({ params: idParamSchema, body: integrantesSchema }), c.integrantes);
  router.patch('/:id/baja', id, c.baja);
  router.patch('/:id/reactivar', id, c.reactivar);

  return { name: 'grupos', basePath: 'grupos', router };
}

export const gruposModule = createGruposModule();
