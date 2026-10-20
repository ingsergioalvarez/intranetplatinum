import { Router } from 'express';
import {
  PERMISOS,
  asistenciaDiaQuerySchema,
  idParamSchema,
  marcacionCreateSchema,
  misMarcasQuerySchema,
} from '@platinum/shared';
import { authenticate, requirePermission, validate, type AppModule } from '../../core';
import { PrismaSitiosRepository } from '../sitios/sitios.repository';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaRepository, PrismaAsistenciaRepository } from './asistencia.repository';
import { AsistenciaService, type MisSitiosFn } from './asistencia.service';

interface AsistenciaModuleDeps {
  repo?: AsistenciaRepository;
  misSitios?: MisSitiosFn;
  ahora?: () => Date;
  hoy?: () => string;
}

/** Control de asistencia: el guardia marca y consulta las suyas; admin/supervisor consultan todas (A-17). */
export function createAsistenciaModule({
  repo = new PrismaAsistenciaRepository(),
  misSitios = (usuarioId, hoy) => new PrismaSitiosRepository().misSitios(usuarioId, hoy),
  ahora,
  hoy,
}: AsistenciaModuleDeps = {}): AppModule {
  const c = new AsistenciaController(new AsistenciaService(repo, misSitios, ahora, hoy));

  const marcar = requirePermission(PERMISOS.ASISTENCIA_MARCAR);

  const router = Router();
  router.use(authenticate);
  // Guardia
  router.get('/estado', marcar, c.estado);
  router.post('/marcas', marcar, validate({ body: marcacionCreateSchema }), c.marcar);
  router.get('/mias', marcar, validate({ query: misMarcasQuerySchema }), c.mias);
  // Admin / supervisor: solo lectura (DA-08)
  const ver = requirePermission(PERMISOS.ASISTENCIA_VER);
  router.get('/dia', ver, validate({ query: asistenciaDiaQuerySchema }), c.dia);
  router.get(
    '/guardias/:id',
    ver,
    validate({ params: idParamSchema, query: misMarcasQuerySchema }),
    c.guardia,
  );

  return { name: 'asistencia', basePath: 'asistencia', router };
}

export const asistenciaModule = createAsistenciaModule();
