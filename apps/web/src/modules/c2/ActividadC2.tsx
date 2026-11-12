import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TIPO_EVENTO_C2_LABEL, PERMISOS } from '@platinum/shared';
import { Card, CardHeader, EmptyState, Spinner, cn } from '../../components/ui';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { formatHora } from '../asistencia/formato';
import { COLOR_EVENTO } from './c2.estilos';
import { c2Service } from './c2.service';

/**
 * Lo último que hizo el C2 hoy sobre los sitios de quien mira (A-82): notas, avisos, reportes y respuestas a SOS. El
 * supervisor y el admin se enteran sin entrar a la pantalla del C2; "Ver la bitácora" lleva al día completo.
 */
export function ActividadC2() {
  const user = useAuthStore((s) => s.user);
  const permitido = hasPermission(user, PERMISOS.C2_BITACORA);
  const actividad = useQuery({
    queryKey: c2Service.keys.actividad,
    queryFn: c2Service.actividad,
    enabled: permitido,
    refetchInterval: 60_000,
  });
  if (!permitido) return null;
  // El admin lee la bitácora dentro de la pantalla del C2; el supervisor, en su propia opción de menú.
  const bitacora = hasPermission(user, PERMISOS.C2_VER) ? '/c2?vista=bitacora' : '/bitacora-c2';
  const items = actividad.data?.items ?? [];

  return (
    <Card className="lg:col-span-5">
      <CardHeader
        title="Lo que hizo el C2 hoy"
        subtitle="Notas, avisos, reportes y respuestas a SOS sobre tus sitios"
        actions={
          <Link to={bitacora} className="text-sm font-medium text-brand-700">
            Ver la bitácora
          </Link>
        }
      />
      {actividad.isPending ? (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="El C2 no ha registrado nada hoy" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-600">{formatHora(e.createdAt)}</span>
              <div className="min-w-0 flex-1">
                <p className={cn('flex items-center gap-2 text-sm font-semibold', COLOR_EVENTO[e.tipo].texto)}>
                  <span className={cn('size-2 shrink-0 rounded-full', COLOR_EVENTO[e.tipo].punto)} aria-hidden />
                  {TIPO_EVENTO_C2_LABEL[e.tipo]}
                  {e.sitio && <span className="truncate font-normal text-slate-600">· {e.sitio.nombre}</span>}
                </p>
                {e.detalle && <p className="text-sm text-slate-700">{e.detalle}</p>}
                <p className="text-xs text-slate-500">
                  {e.usuario}
                  {e.entidad?.tipo === 'reporte' && (
                    <>
                      {' · '}
                      <Link to={`/reportes/${e.entidad.id}`} className="font-medium text-brand-700 hover:underline">
                        Ver el reporte
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
