import type { AppModule } from '../core';
import { archivosModule } from './archivos';
import { asistenciaModule } from './asistencia';
import { authModule } from './auth';
import { avisosModule } from './avisos';
import { categoriasModule } from './categorias';
import { clientesModule } from './clientes';
import { gruposModule } from './grupos';
import { healthModule } from './health';
import { reportesModule } from './reportes';
import { sitiosModule } from './sitios';
import { usuariosModule } from './usuarios';

/** Registro de módulos. Para agregar uno: crear `modules/<nombre>/index.ts` y listarlo aquí. */
export const modules: AppModule[] = [
  healthModule,
  authModule,
  usuariosModule,
  clientesModule,
  sitiosModule,
  gruposModule,
  categoriasModule,
  reportesModule,
  archivosModule,
  avisosModule,
  asistenciaModule,
];
