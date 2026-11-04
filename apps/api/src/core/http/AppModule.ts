import type { Router } from 'express';
import type { ModuloOpcionalClave } from '@platinum/shared';

/** Contrato de un módulo vertical: se monta en `/api/<basePath>`. */
export interface AppModule {
  name: string;
  basePath: string;
  router: Router;
  /** Módulo de producto al que pertenece: si la empresa lo tiene apagado, sus rutas responden 403 (C-09). Sin esto, es núcleo. */
  modulo?: ModuloOpcionalClave;
}
