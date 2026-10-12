import { Router } from 'express';
import {
  PERMISOS,
  idParamSchema,
  usuarioCreateSchema,
  usuarioFiltroSchema,
  usuarioUpdateSchema,
} from '@platinum/shared';
import {
  AuditLogger,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  validate,
  type AppModule,
} from '../../core';
import { UsuariosController } from './usuarios.controller';
import { PrismaUsuariosRepository, UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

interface UsuariosModuleDeps {
  repo?: UsuariosRepository;
  audit?: AuditLogger;
}

/** Gestión de usuarios (F1-07..F1-10). Fábrica para inyectar dobles en pruebas. */
export function createUsuariosModule({
  repo = new PrismaUsuariosRepository(),
  audit = new PrismaAuditLogger(),
}: UsuariosModuleDeps = {}): AppModule {
  const c = new UsuariosController(new UsuariosService(repo, audit));
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate);
  router.get('/', requirePermission(PERMISOS.USUARIOS_VER), validate({ query: usuarioFiltroSchema }), c.list);
  router.get('/:id', requirePermission(PERMISOS.USUARIOS_VER), id, c.get);
  router.post(
    '/',
    requirePermission(PERMISOS.USUARIOS_CREAR),
    validate({ body: usuarioCreateSchema }),
    c.create,
  );
  router.patch(
    '/:id',
    requirePermission(PERMISOS.USUARIOS_EDITAR),
    validate({ params: idParamSchema, body: usuarioUpdateSchema }),
    c.update,
  );
  router.patch('/:id/baja', requirePermission(PERMISOS.USUARIOS_BAJA), id, c.baja);
  router.patch('/:id/reactivar', requirePermission(PERMISOS.USUARIOS_BAJA), id, c.reactivar);
  router.post('/:id/reset-password', requirePermission(PERMISOS.USUARIOS_EDITAR), id, c.resetPassword);

  return { name: 'usuarios', basePath: 'usuarios', router };
}

export const usuariosModule = createUsuariosModule();
