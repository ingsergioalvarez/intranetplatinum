import { Router } from 'express';
import { z } from 'zod';
import {
  PERMISOS,
  ROLES,
  accesoClienteSchema,
  clienteCreateSchema,
  clienteFiltroSchema,
  clienteUpdateSchema,
  contactoSchema,
  idParamSchema,
  reglasAvisoSchema,
  sitioSchema,
} from '@platinum/shared';
import {
  AuditLogger,
  PrismaAuditLogger,
  authenticate,
  requirePermission,
  requireRoles,
  validate,
  type AppModule,
} from '../../core';
import { ClientesController } from './clientes.controller';
import { ClientesRepository, PrismaClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';

const contactoParams = idParamSchema.extend({ contactoId: z.coerce.number().int().positive() });
const sitioParams = idParamSchema.extend({ sitioId: z.coerce.number().int().positive() });

interface ClientesModuleDeps {
  repo?: ClientesRepository;
  audit?: AuditLogger;
  hoy?: () => string;
}

/** Clientes, contactos y sitios (F2-02..F2-04). Fábrica para inyectar dobles en pruebas. */
export function createClientesModule({
  repo = new PrismaClientesRepository(),
  audit = new PrismaAuditLogger(),
  hoy,
}: ClientesModuleDeps = {}): AppModule {
  const c = new ClientesController(new ClientesService(repo, audit, hoy));
  const ver = requirePermission(PERMISOS.CLIENTES_VER);
  const editar = requirePermission(PERMISOS.CLIENTES_EDITAR);
  const id = validate({ params: idParamSchema });

  const router = Router();
  router.use(authenticate);

  router.get('/', ver, validate({ query: clienteFiltroSchema }), c.list);
  router.get('/:id', ver, id, c.get);
  router.post(
    '/',
    requirePermission(PERMISOS.CLIENTES_CREAR),
    validate({ body: clienteCreateSchema }),
    c.create,
  );
  router.patch('/:id', editar, validate({ params: idParamSchema, body: clienteUpdateSchema }), c.update);
  router.patch('/:id/baja', requirePermission(PERMISOS.CLIENTES_BAJA), id, c.baja);
  router.patch('/:id/reactivar', requirePermission(PERMISOS.CLIENTES_BAJA), id, c.reactivar);

  // El acceso y los avisos del cliente los define solo un administrador (A-29, A-30).
  router.post(
    '/:id/accesos',
    requireRoles(ROLES.ADMIN),
    validate({ params: idParamSchema, body: accesoClienteSchema }),
    c.createAcceso,
  );

  router.put(
    '/:id/avisos',
    requireRoles(ROLES.ADMIN),
    validate({ params: idParamSchema, body: reglasAvisoSchema }),
    c.reglasAviso,
  );

  router.post(
    '/:id/contactos',
    editar,
    validate({ params: idParamSchema, body: contactoSchema }),
    c.createContacto,
  );
  router.put(
    '/:id/contactos/:contactoId',
    editar,
    validate({ params: contactoParams, body: contactoSchema }),
    c.updateContacto,
  );
  router.delete('/:id/contactos/:contactoId', editar, validate({ params: contactoParams }), c.deleteContacto);

  router.post('/:id/sitios', editar, validate({ params: idParamSchema, body: sitioSchema }), c.createSitio);
  router.put(
    '/:id/sitios/:sitioId',
    editar,
    validate({ params: sitioParams, body: sitioSchema }),
    c.updateSitio,
  );
  router.patch('/:id/sitios/:sitioId/baja', editar, validate({ params: sitioParams }), c.bajaSitio);
  router.patch('/:id/sitios/:sitioId/reactivar', editar, validate({ params: sitioParams }), c.reactivarSitio);

  return { name: 'clientes', basePath: 'clientes', router };
}

export const clientesModule = createClientesModule();
