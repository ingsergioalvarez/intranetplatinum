import { Link } from 'react-router-dom';
import { TIPO_EVENTO_C2_LABEL } from '@platinum/shared';
import { Card, CardHeader, EmptyState, Spinner, cn } from '../../components/ui';
import { formatHora } from '../asistencia/formato';
import { COLOR_EVENTO } from './c2.estilos';
import { useActividadC2 } from './hookActividadC2';

/**
 * Lo último que hizo el C2 hoy sobre los sitios de quien mira (A-82): notas, avisos, reportes y respuestas a SOS. El
 * supervisor y el admin se enteran sin entrar a la pantalla del C2; "Ver la bitácora" lleva al día completo.
 */
export function ActividadC2() {
  const { permitido, actividad, bitacora } = useActividadC2();
  if (!permitido) return null;
  const items = actividad.data?.items ?? [];

  return (
    // En el celular sube justo después de "Requiere tu atención"; en escritorio queda abajo, a lo ancho.
    <Card className="order-2 lg:order-3 lg:col-span-5">
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

/**
 * Tarjeta de acceso rápido de arriba (A-83): cuántas cosas registró el C2 hoy sobre los sitios de quien mira, y un
 * toque lleva a la bitácora. Usa la misma consulta que la lista de abajo.
 */
export function TarjetaHoyC2() {
  const { permitido, actividad, bitacora } = useActividadC2();
  if (!permitido) return null;
  const total = actividad.data?.total;
  const hay = !!total;
  return (
    <Link
      to={bitacora}
      className={cn(
        'rounded-xl p-4 ring-1 ring-inset transition-colors',
        hay ? 'bg-brand-50 text-brand-900 ring-brand-200 hover:bg-brand-100' : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50',
      )}
    >
      <span className="block text-3xl font-bold tabular-nums">{total ?? '…'}</span>
      <span className={cn('block text-sm', hay ? 'text-brand-800' : 'text-slate-600')}>Hoy en el C2</span>
    </Link>
  );
}
