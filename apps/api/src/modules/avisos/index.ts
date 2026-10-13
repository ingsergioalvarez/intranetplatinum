import { Router, type Request, type Response } from 'express';
import { idParamSchema, type BandejaAvisos, type IdParam } from '@platinum/shared';
import { BaseController, HttpError, authenticate, validate, type AppModule } from '../../core';
import { AvisosRepository, PrismaAvisosRepository } from './avisos.repository';

const LIMITE = 30;

class AvisosController extends BaseController {
  constructor(private readonly repo: AvisosRepository) {
    super();
  }

  /** Bandeja de la campanita: últimos avisos y total sin leer. */
  bandeja = async (req: Request, res: Response) => {
    const { id } = this.currentUser(req);
    const [items, noLeidos] = await Promise.all([this.repo.listar(id, LIMITE), this.repo.contarNoLeidos(id)]);
    const data: BandejaAvisos = { items, noLeidos };
    return this.ok(res, data);
  };

  leido = async (req: Request, res: Response) => {
    if (!(await this.repo.marcarLeido(this.params<IdParam>(req).id, this.currentUser(req).id))) {
      throw HttpError.notFound('Aviso no encontrado');
    }
    return this.noContent(res);
  };

  todos = async (req: Request, res: Response) => {
    await this.repo.marcarTodos(this.currentUser(req).id);
    return this.noContent(res);
  };
}

/** Avisos en la app (F3-10). Cada usuario solo ve y marca los suyos. */
export function createAvisosModule({
  repo = new PrismaAvisosRepository(),
}: { repo?: AvisosRepository } = {}): AppModule {
  const c = new AvisosController(repo);
  const router = Router();
  router.use(authenticate);
  router.get('/', c.bandeja);
  router.patch('/leidos', c.todos);
  router.patch('/:id/leido', validate({ params: idParamSchema }), c.leido);
  return { name: 'avisos', basePath: 'avisos', router };
}

export const avisosModule = createAvisosModule();
