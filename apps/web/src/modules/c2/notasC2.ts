import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISOS, type NotaSitioC2 } from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { c2Service } from './c2.service';

/** Última nota del C2 de hoy en cada sitio, por id de sitio. Solo la piden quienes pueden ver la bitácora del C2. */
export function useNotasC2(): Map<number, NotaSitioC2> {
  const user = useAuthStore((s) => s.user);
  const notas = useQuery({
    queryKey: c2Service.keys.notas,
    queryFn: c2Service.notas,
    enabled: hasPermission(user, PERMISOS.C2_BITACORA),
    refetchInterval: 60_000,
  });
  return useMemo(() => new Map((notas.data ?? []).map((n) => [n.sitioId, n])), [notas.data]);
}
