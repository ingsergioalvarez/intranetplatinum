import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  GRUPOS_EVENTO_C2,
  GRUPO_EVENTO_C2_LABEL,
  TIPO_EVENTO_C2_LABEL,
  type EventoC2,
  type GrupoEventoC2,
} from '@platinum/shared';
import { Card, EmptyState, Input, Spinner, cn } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { formatHora } from '../asistencia/formato';
import { c2Service } from './c2.service';
import { COLOR_EVENTO as COLOR } from './c2.estilos';

const duracion = (min: number) => (min < 60 ? `${min} m` : `${Math.floor(min / 60)} h ${min % 60} m`);

function Evento({ e }: { e: EventoC2 }) {
  const c = COLOR[e.tipo];
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', c.texto)}>
      <span className={cn('size-2.5 shrink-0 rounded-full', c.punto)} aria-hidden />
      {TIPO_EVENTO_C2_LABEL[e.tipo]}
    </span>
  );
}

function Detalle({ e }: { e: EventoC2 }) {
  return (
    <>
      {e.detalle && <p className="text-sm text-slate-700">{e.detalle}</p>}
      {e.usuario && <p className="text-xs text-slate-500">{e.usuario}</p>}
      {e.entidad?.tipo === 'reporte' && (
        <Link to={`/reportes/${e.entidad.id}`} className="text-xs font-medium text-brand-700 hover:underline">
          Ver el reporte
        </Link>
      )}
    </>
  );
}

/**
 * Bitácora del C2 (A-80): una línea por cada cosa que pasó con los sitios, los SOS y lo que hizo el C2, de un día.
 * La llena el sistema en el momento; aquí solo se consulta.
 */
export function BitacoraC2() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [grupo, setGrupo] = useState<GrupoEventoC2>('todo');
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const consulta = { fecha, grupo, q: q || undefined };
  const bitacora = useQuery({
    queryKey: c2Service.keys.bitacora(consulta),
    queryFn: () => c2Service.bitacora(consulta),
    refetchInterval: 30_000,
  });
  const items = bitacora.data?.items ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Día
          <Input type="date" value={fecha} max={hoyLocal()} onChange={(e) => e.target.value && setFecha(e.target.value)} className="w-44" />
        </label>
        <div className="relative min-w-52 flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar sitio, cliente o persona…"
            aria-label="Buscar en la bitácora"
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tipo de evento">
          {GRUPOS_EVENTO_C2.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={grupo === g}
              onClick={() => setGrupo(g)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium',
                grupo === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {GRUPO_EVENTO_C2_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {bitacora.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin registros"
            description={q || grupo !== 'todo' ? 'No hay nada con ese filtro ese día.' : 'Ese día no se registró nada.'}
          />
        ) : (
          <>
            <table className="hidden w-full table-fixed text-left md:table">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-slate-900 text-xs font-semibold tracking-wide text-white uppercase">
                <tr>
                  {['Hora', 'Sitio', 'Evento', 'Detalle', 'Duración'].map((h, i) => (
                    <th key={h} className={cn('py-3', i === 0 ? 'pr-2 pl-4' : 'px-2')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 align-top">
                    <td className="py-2.5 pr-2 pl-4 text-sm font-semibold tabular-nums text-slate-700">{formatHora(e.createdAt)}</td>
                    <td className="px-2 py-2.5">
                      {e.sitio ? (
                        <>
                          <p className="text-sm font-semibold text-slate-900">{e.sitio.nombre}</p>
                          <p className="text-xs text-slate-500">{e.sitio.cliente}</p>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <Evento e={e} />
                    </td>
                    <td className="px-2 py-2.5">
                      <Detalle e={e} />
                    </td>
                    <td className="px-2 py-2.5 text-sm font-semibold tabular-nums text-slate-700">{e.minutos != null ? duracion(e.minutos) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((e) => (
                <li key={e.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Evento e={e} />
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{formatHora(e.createdAt)}</span>
                  </div>
                  {e.sitio && (
                    <p className="mt-0.5 text-sm text-slate-900">
                      {e.sitio.nombre} <span className="text-xs text-slate-500">· {e.sitio.cliente}</span>
                    </p>
                  )}
                  <Detalle e={e} />
                  {e.minutos != null && <p className="text-xs font-semibold text-slate-600">Duración: {duracion(e.minutos)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
