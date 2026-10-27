import type { AppModule } from '../core';
import { adminModule } from './admin';
import { archivosModule } from './archivos';
import { asistenciaModule } from './asistencia';
import { authModule } from './auth';
import { avisosModule } from './avisos';
import { bitacoraModule } from './bitacora';
import { cambiosModule } from './cambios';
import { categoriasModule } from './categorias';
import { clientesModule } from './clientes';
import { casosCoberturaModule } from './casos-cobertura';
import { coberturaModule } from './cobertura';
import { coberturasModule } from './coberturas';
import { gruposModule } from './grupos';
import { healthModule } from './health';
import { horasExtraModule } from './horas-extra';
import { informesModule } from './informes';
import { reportesModule } from './reportes';
import { sitiosModule } from './sitios';
import { turnosModule } from './turnos';
import { usuariosModule } from './usuarios';

/** Registro de módulos. Para agregar uno: crear `modules/<nombre>/index.ts` y listarlo aquí. */
export const modules: AppModule[] = [
  healthModule,
  authModule,
  usuariosModule,
  clientesModule,
  sitiosModule,
  coberturasModule,
  coberturaModule,
  casosCoberturaModule,
  cambiosModule,
  turnosModule,
  gruposModule,
  categoriasModule,
  reportesModule,
  archivosModule,
  avisosModule,
  asistenciaModule,
  bitacoraModule,
  informesModule,
  horasExtraModule,
  adminModule,
];
