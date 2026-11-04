import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { transferirCarteraSchema, type TransferirCarteraInput } from '@platinum/shared';
import {
  AuditLogger,
  BaseController,
  HttpError,
  PrismaAuditLogger,
  authenticate,
  esSuperAdmin,
  validate,
  type AppModule,
} from '../../core';
import { avisarConPrisma, type AvisarUsuarios } from '../avisos/avisar';
import { CarterasRepository, PrismaCarterasRepository } from './carteras.repository';
import { CarterasService } from './carteras.service';

/** `sin-asignar` o el id de un admin. */
const propietarioParam = z.object({
  propietario: z.string().regex(/^(sin-asignar|\d+)$/, 'Admin inválido'),
});

class CarterasController extends BaseController {
  constructor(private readonly service: CarterasService) {
    super();
  }

  resumen = async (_req: Request, res: Response) => this.ok(res, await this.service.resumen());

  arbol = async (req: Request, res: Response) => {
    const { propietario } = this.params<{ propietario: string }>(req);
    return this.ok(res, await this.service.arbol(propietario === 'sin-asignar' ? null : Number(propietario)));
  };

  transferir = async (req: Request, res: Response) =>
    this.ok(res, await this.service.transferir(this.body<TransferirCarteraInput>(req), this.accionCtx(req)));
}

export interface CarterasDeps {
  repo?: CarterasRepository;
  audit?: AuditLogger;
  avisar?: AvisarUsuarios;
  hoy?: () => string;
}

/** Carteras de los admin (A-65): solo el super admin. */
export function createCarterasModule({
  repo = new PrismaCarterasRepository(),
  audit = new PrismaAuditLogger(),
  avisar = avisarConPrisma,
  hoy,
}: CarterasDeps = {}): AppModule {
  const c = new CarterasController(new CarterasService(repo, audit, avisar, hoy));
  const router = Router();
  router.use(authenticate, (req, _res, next) =>
    esSuperAdmin(req.user ?? {}) ? next() : next(HttpError.forbidden('Solo el super admin puede ver las carteras')),
  );
  router.get('/', c.resumen);
  router.get('/:propietario', validate({ params: propietarioParam }), c.arbol);
  router.post('/transferir', validate({ body: transferirCarteraSchema }), c.transferir);
  return { name: 'carteras', basePath: 'carteras', router, modulo: 'carteras' };
}

export const carterasModule = createCarterasModule();
