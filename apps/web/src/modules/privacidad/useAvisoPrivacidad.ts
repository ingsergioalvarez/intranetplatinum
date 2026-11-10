import { useQuery } from '@tanstack/react-query';
import { PERMISOS, ROLES } from '@platinum/shared';
import { hasPermission, hasRole, useAuthStore } from '../../core/auth/authStore';
import { privacidadService } from './privacidad.service';

/**
 * Cómo está el guardia con el aviso de privacidad (A-68). Solo aplica a quien checa. `sinAceptar` es verdad
 * únicamente cuando el servidor lo confirma: sin conexión o con error no se bloquea nada en pantalla (el
 * servidor es quien decide al recibir la checada).
 */
export function useAvisoPrivacidad() {
  const user = useAuthStore((s) => s.user);
  const aplica = hasRole(user, [ROLES.GUARDIA]) && hasPermission(user, PERMISOS.ASISTENCIA_MARCAR);
  const estado = useQuery({
    queryKey: privacidadService.keys.estado,
    queryFn: privacidadService.estado,
    enabled: aplica,
  });
  return {
    aplica,
    estado,
    /** Nunca aceptó ninguna versión: no puede checar. */
    sinAceptar: aplica && estado.data?.aceptada === false,
    /** Falta aceptar la versión vigente (puede ser que ya haya aceptado una anterior). */
    pendiente: aplica && !!estado.data && !estado.data.vigente,
  };
}
