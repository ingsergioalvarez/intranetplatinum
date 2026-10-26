import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, MapPin, Navigation, Shuffle, UsersRound } from 'lucide-react';
import { TIPO_ASIGNACION_LABEL } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, EmptyState, Spinner } from '../../components/ui';
import { mapsUrl } from '../../core/format/mapas';
import { describirAsignacion } from '../clientes/asignaciones';
import { sitiosService } from '../clientes/clientes.service';

const accion =
  'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-slate-200 active:bg-slate-100';

/**
 * Sitios del guardia (F2-05, DA-51): donde está asignado hoy o cubre, con su turno, cómo llegar y sus
 * reportes. Es una pestaña aparte para que el Checador quede solo para checar.
 */
export function MisSitiosPage() {
  const mios = useQuery({ queryKey: sitiosService.keys.mios, queryFn: sitiosService.mios });

  return (
    <>
      <PageHeader title="Mis sitios" subtitle="Donde estás asignado hoy" />
      <div className="max-w-md space-y-3">
        {mios.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : mios.isError ? (
          <EmptyState title="No se pudieron cargar tus sitios" description="Revisa tu conexión." />
        ) : mios.data.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-9" />}
            title="Sin sitios asignados"
            description="Tu supervisor debe asignarte a un sitio para que puedas checar y generar reportes."
          />
        ) : (
          mios.data.map((m) => (
            <Card key={m.asignacionId} className="space-y-3 p-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{m.sitio.nombre}</p>
                <p className="text-sm text-slate-500">{m.cliente.nombreComercial}</p>
                {m.sitio.direccion && <p className="mt-1 text-sm text-slate-700">{m.sitio.direccion}</p>}
                {m.sitio.referencias && <p className="text-sm text-slate-500">Ref: {m.sitio.referencias}</p>}
              </div>

              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <Badge tone={m.tipo === 'eventual' ? 'warning' : 'brand'}>
                  {TIPO_ASIGNACION_LABEL[m.tipo]}
                </Badge>
                {describirAsignacion(m)}
              </p>
              {m.grupo && (
                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                  <UsersRound className="size-4" /> Grupo {m.grupo}
                </p>
              )}
              {m.cobertura && (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Shuffle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Cubres este sitio{m.cobertura.cubreA ? ` en lugar de ${m.cobertura.cubreA}` : ''}. Motivo:{' '}
                    {m.cobertura.motivo}
                  </span>
                </p>
              )}

              <div className="flex gap-2">
                {m.sitio.lat !== null && m.sitio.lng !== null && (
                  <a
                    href={mapsUrl(m.sitio.lat, m.sitio.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className={accion}
                  >
                    <Navigation className="size-4" /> Cómo llegar
                  </a>
                )}
                <Link to={`/reportes?sitioId=${m.sitio.id}`} className={accion}>
                  <ClipboardList className="size-4" /> Ver reportes
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
