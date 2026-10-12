import type { Router } from 'express';

/** Contrato de un módulo vertical: se monta en `/api/<basePath>`. */
export interface AppModule {
  name: string;
  basePath: string;
  router: Router;
}
