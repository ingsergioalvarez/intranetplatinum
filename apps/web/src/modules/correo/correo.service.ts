import type { CorreoConfig, CorreoConfigInput, CorreoPruebaInput, ResultadoPruebaCorreo } from '@platinum/shared';
import { api } from '../../core/api';

/** Correo saliente (A-87): solo el super admin. */
export const correoService = {
  keys: { config: ['correo', 'config'] as const },
  obtener: () => api.get<CorreoConfig>('/correo'),
  guardar: (input: CorreoConfigInput) => api.put<CorreoConfig>('/correo', input),
  probar: (input: CorreoPruebaInput) => api.post<ResultadoPruebaCorreo>('/correo/prueba', input),
};
