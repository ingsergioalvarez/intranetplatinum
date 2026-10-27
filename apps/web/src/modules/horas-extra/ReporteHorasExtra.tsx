import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { duracionExtra, ESTADO_HORA_EXTRA_LABEL, ORIGEN_HORA_EXTRA_LABEL } from '@platinum/shared';
import { Badge, Card, FormField, Input, Spinner, cn } from '../../components/ui';
import { formatFecha, hoyLocal } from '../../core/format/fechas';
import { rangoHoraExtra } from './formato';
import { horasExtraService } from './horasExtra.service';

const minutos = (n: number) => (n > 0 ? duracionExtra(n) : '—');

/** Horas extra por guardia y periodo (AS5-05): solo cuenta lo aprobado; lo pendiente va aparte. */
export function ReporteHorasExtra() {
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [abierto, setAbierto] = useState<number | null>(null);
  const valido = desde !== '' && hasta !== '' && desde <= hasta;
  const reporte = useQuery({
    queryKey: horasExtraService.keys.reporte({ desde, hasta }),
    queryFn: () => horasExtraService.reporte({ desde, hasta }),
    enabled: valido,
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
        <FormField label="Desde">
          <Input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </FormField>
        <FormField label="Hasta">
          <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </FormField>
      </div>

      {!valido ? (
        <p className="text-sm text-slate-500">Elige un periodo válido.</p>
      ) : reporte.isPending ? (
        <div className="flex justify-center py-10 text-brand-600">
          <Spinner className="size-7" />
        </div>
      ) : (
        <Card>
          <div className="grid grid-cols-2 gap-px bg-slate-100 text-center">
            <div className="bg-white p-4">
              <p className="text-xs text-slate-500">Aprobadas</p>
              <p className="text-xl font-semibold text-slate-900">{minutos(reporte.data!.aprobadasMin)}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs text-slate-500">Por aprobar</p>
              <p className="text-xl font-semibold text-amber-700">{minutos(reporte.data!.pendientesMin)}</p>
            </div>
          </div>
          {reporte.data!.guardias.length === 0 ? (
            <p className="px-4 py-10 text-center text-slate-500">No hay horas extra en este periodo.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {reporte.data!.guardias.map((g) => {
                const abre = abierto === g.guardia.id;
                return (
                  <li key={g.guardia.id}>
                    <button
                      type="button"
                      aria-expanded={abre}
                      onClick={() => setAbierto(abre ? null : g.guardia.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{g.guardia.nombre}</span>
                      <span className="text-right text-sm">
                        <span className="block font-semibold text-slate-900">{minutos(g.aprobadasMin)}</span>
                        {g.pendientesMin > 0 && (
                          <span className="block text-xs text-amber-700">+ {duracionExtra(g.pendientesMin)} por aprobar</span>
                        )}
                      </span>
                      <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', abre && 'rotate-180')} />
                    </button>
                    {abre && (
                      <ul className="space-y-2 bg-slate-50 px-4 py-3">
                        {g.registros.map((r) => (
                          <li key={r.id} className="text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-800">
                                {formatFecha(r.fecha)} · {r.sitio.nombre}
                              </span>
                              <Badge
                                tone={
                                  r.estado === 'aprobada' ? 'success' : r.estado === 'rechazada' ? 'danger' : 'warning'
                                }
                              >
                                {ESTADO_HORA_EXTRA_LABEL[r.estado]}
                              </Badge>
                            </div>
                            <p className="text-slate-600">{rangoHoraExtra(r)}</p>
                            <p className="text-xs text-slate-500">{ORIGEN_HORA_EXTRA_LABEL[r.origen]}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
