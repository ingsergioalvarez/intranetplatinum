import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS, asignacionCreateSchema, asignacionUpdateSchema, idParamSchema } from '@platinum/shared';
import {
  AuditLogger,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  validate,
  type AppModule,
} from '../../core';
import { SitiosController } from './sitios.controller';
import { PrismaSitiosRepository, SitiosRepository } from './sitios.repository';
import { SitiosService } from './sitios.service';

const asignacionParams = idParamSchema.extend({ asignacionId: z.coerce.number().int().positive() });
const historialQuery = z.object({ historial: z.stringbool().optional() });

interface SitiosModuleDeps {
  repo?: SitiosRepository;
  audit?: AuditLogger;
  hoy?: () => string;
}

/** Asignación de guardias a sitios y "mis sitios" del guardia (F2-05). */
export function createSitiosModule({
  repo = new PrismaSitiosRepository(),
  audit = new PrismaAuditLogger(),
  hoy,
}: SitiosModuleDeps = {}): AppModule {
  const c = new SitiosController(new SitiosService(repo, audit, hoy));
  const editar = requirePermission(PERMISOS.CLIENTES_EDITAR);

  const router = Router();
  router.use(authenticate);

  router.get('/mios', c.mios);
  router.get(
    '/:id/guardias',
    requirePermission(PERMISOS.CLIENTES_VER),
    validate({ params: idParamSchema, query: historialQuery }),
    c.listAsignaciones,
  );
  router.post(
    '/:id/guardias',
    editar,
    validate({ params: idParamSchema, body: asignacionCreateSchema }),
    c.asignar,
  );
  router.patch(
    '/:id/guardias/:asignacionId',
    editar,
    validate({ params: asignacionParams, body: asignacionUpdateSchema }),
    c.actualizarAsignacion,
  );

  return { name: 'sitios', basePath: 'sitios', router };
}

export const sitiosModule = createSitiosModule();
