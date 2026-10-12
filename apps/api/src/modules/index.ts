import type { AppModule } from '../core';
import { healthModule } from './health';

/** Registro de módulos. Para agregar uno: crear `modules/<nombre>/index.ts` y listarlo aquí. */
export const modules: AppModule[] = [healthModule];
