import type { AppModule } from '../core';
import { authModule } from './auth';
import { healthModule } from './health';
import { usuariosModule } from './usuarios';

/** Registro de módulos. Para agregar uno: crear `modules/<nombre>/index.ts` y listarlo aquí. */
export const modules: AppModule[] = [healthModule, authModule, usuariosModule];
