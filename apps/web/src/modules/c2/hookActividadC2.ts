import { useQuery } from '@tanstack/react-query';
import { PERMISOS } from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { c2Service } from './c2.service';

/**
 * Lo que hizo el C2 hoy sobre los sitios de quien consulta (A-82). Lo usan la tarjeta "Hoy en el C2" y la lista del
 * Inicio con la misma consulta (no se pide dos veces). Solo la piden quienes pueden leer la bitácora del C2.
 */
export function useActividadC2() {
  const user = useAuthStore((s) => s.user);
  const permitido = hasPermission(user, PERMISOS.C2_BITACORA);
  const actividad = useQuery({
    queryKey: c2Service.keys.actividad,
    queryFn: c2Service.actividad,
    enabled: permitido,
    refetchInterval: 60_000,
  });
  // El admin lee la bitácora dentro de la pantalla del C2; el supervisor, en su propia opción de menú.
  const bitacora = hasPermission(user, PERMISOS.C2_VER) ? '/c2?vista=bitacora' : '/bitacora-c2';
  return { permitido, actividad, bitacora };
}
