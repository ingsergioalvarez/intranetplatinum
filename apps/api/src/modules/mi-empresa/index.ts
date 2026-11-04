import { Router, type Request, type Response } from 'express';
import type { ContextoEmpresa } from '@platinum/shared';
import {
  BaseController,
  HttpError,
  authenticate,
  empresaActual,
  estadoDeModulos,
  firmarArchivo,
  type AppModule,
} from '../../core';
import { MiEmpresaRepository } from './mi-empresa.repository';

class MiEmpresaController extends BaseController {
  constructor(private readonly repo = new MiEmpresaRepository()) {
    super();
  }

  /** Marca y módulos de la empresa de la sesión (o de la que el super admin eligió). */
  contexto = async (_req: Request, res: Response) => {
    const empresaId = empresaActual();
    const e = await this.repo.findEmpresa(empresaId);
    if (!e || !e.activa) throw HttpError.notFound('Empresa no encontrada');
    const contexto: ContextoEmpresa = {
      empresa: {
        id: e.id,
        nombre: e.nombre,
        zonaHoraria: e.zonaHoraria,
        colorModo: e.colorModo as ContextoEmpresa['empresa']['colorModo'],
        colorPrincipal: e.colorPrincipal,
        colorAcento: e.colorAcento,
        logoUrl: e.logoClave ? firmarArchivo(e.logoClave) : null,
      },
      modulos: await estadoDeModulos(empresaId),
    };
    this.ok(res, contexto);
  };
}

/** Datos de la empresa en la que trabaja la sesión (C-09): la web arma con ellos su marca y su menú. */
export function createMiEmpresaModule(): AppModule {
  const c = new MiEmpresaController();
  const router = Router();
  router.get('/', authenticate, c.contexto);
  return { name: 'mi-empresa', basePath: 'mi-empresa', router };
}

export const miEmpresaModule = createMiEmpresaModule();
