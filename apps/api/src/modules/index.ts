import type { AppModule } from '../core';
import { adminModule } from './admin';
import { areasModule } from './areas';
import { archivosModule } from './archivos';
import { asistenciaModule } from './asistencia';
import { authModule } from './auth';
import { avisosModule } from './avisos';
import { bitacoraModule } from './bitacora';
import { cambiosModule } from './cambios';
import { clientesModule } from './clientes';
import { casosCoberturaModule } from './casos-cobertura';
import { coberturaModule } from './cobertura';
import { coberturasModule } from './coberturas';
import { gruposModule } from './grupos';
import { healthModule } from './health';
import { horasExtraModule } from './horas-extra';
import { informesModule } from './informes';
import { horariosModule } from './horarios';
import { solicitudesCoberturaModule } from './solicitudes-cobertura';
import { ausenciasModule } from './ausencias';
import { emergenciasModule } from './emergencias';
import { miEmpresaModule } from './mi-empresa';
import { plataformaModule } from './plataforma';
import { pushModule } from './push';
import { rolesModule } from './roles';
import { sitiosModule } from './sitios';
import { turnosModule } from './turnos';
import { usuariosModule } from './usuarios';

/** Registro de módulos. Para agregar uno: crear `modules/<nombre>/index.ts` y listarlo aquí. */
export const modules: AppModule[] = [
  healthModule,
  authModule,
  usuariosModule,
  rolesModule,
  areasModule,
  clientesModule,
  sitiosModule,
  coberturasModule,
  coberturaModule,
  casosCoberturaModule,
  cambiosModule,
  turnosModule,
  gruposModule,
  archivosModule,
  avisosModule,
  pushModule,
  asistenciaModule,
  bitacoraModule,
  informesModule,
  horariosModule,
  solicitudesCoberturaModule,
  ausenciasModule,
  emergenciasModule,
  horasExtraModule,
  adminModule,
  miEmpresaModule,
  plataformaModule,
];
