import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, UsersRound } from 'lucide-react';
import { TIPO_ASIGNACION_LABEL } from '@platinum/shared';
import { mapsUrl } from '../../core/format/mapas';
import { Badge, Card, CardHeader, EmptyState, Spinner } from '../../components/ui';
import { describirAsignacion } from '../clientes/asignaciones';
import { sitiosService } from '../clientes/clientes.service';

/** Sitios asignados hoy al guardia en sesión (F2-05). */
export function MisSitiosCard() {
  const mios = useQuery({ queryKey: sitiosService.keys.mios, queryFn: sitiosService.mios });

  return (
    <Card>
      <CardHeader title="Mis sitios" subtitle="Donde estás asignado hoy" />
      {mios.isPending ? (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : mios.isError ? (
        <EmptyState title="No se pudieron cargar tus sitios" description="Revisa tu conexión." />
      ) : mios.data.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-9" />}
          title="Sin sitios asignados"
          description="Tu supervisor debe asignarte a un sitio para que puedas generar reportes."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {mios.data.map((m) => (
            <li key={m.asignacionId} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{m.sitio.nombre}</p>
                <p className="text-sm text-slate-500">{m.cliente.nombreComercial}</p>
                {m.sitio.direccion && <p className="mt-0.5 text-sm text-slate-500">{m.sitio.direccion}</p>}
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone={m.tipo === 'eventual' ? 'warning' : 'brand'}>
                    {TIPO_ASIGNACION_LABEL[m.tipo]}
                  </Badge>
                  {describirAsignacion(m)}
                </p>
                {m.grupo && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <UsersRound className="size-3.5" /> Grupo {m.grupo}
                  </p>
                )}
              </div>
              {m.sitio.lat !== null && m.sitio.lng !== null && (
                <a
                  href={mapsUrl(m.sitio.lat, m.sitio.lng)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${m.sitio.nombre} en el mapa`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-brand-700 ring-1 ring-inset ring-slate-200 active:bg-slate-100"
                >
                  <Navigation className="size-5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
