import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, Input, Spinner } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { formatHora } from '../asistencia/formato';
import { c2Service } from './c2.service';

const duracion = (min: number) => (min < 60 ? `${min} m` : `${Math.floor(min / 60)} h ${min % 60} m`);

/** Cuánto tiempo estuvo sin guardia cada sitio en un día (A-61). Lo registra el sistema; el C2 no captura nada. */
export function HistorialC2() {
  const [fecha, setFecha] = useState(hoyLocal());
  const historial = useQuery({
    queryKey: c2Service.keys.historial(fecha),
    queryFn: () => c2Service.historial(fecha),
    refetchInterval: 30_000,
  });
  const datos = historial.data;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Día
          <Input type="date" value={fecha} max={hoyLocal()} onChange={(e) => e.target.value && setFecha(e.target.value)} className="w-44" />
        </label>
        {datos && datos.items.length > 0 && (
          <span className="text-sm text-slate-600">
            {datos.items.length} {datos.items.length === 1 ? 'vez' : 'veces'} · {duracion(datos.totalMinutos)} en total sin guardia
          </span>
        )}
      </div>
      <Card className="overflow-hidden">
        {historial.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : !datos || datos.items.length === 0 ? (
          <EmptyState title="Ningún sitio se quedó solo" description="Ese día todos los sitios tuvieron guardia." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {datos.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{i.sitio.nombre}</p>
                  <p className="text-xs text-slate-500">{i.cliente.nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-700">
                    {formatHora(i.inicio)} – {i.fin ? formatHora(i.fin) : 'ahora'}
                  </p>
                  <p className="text-sm font-semibold text-red-700">
                    {duracion(i.minutos)}
                    {!i.fin && ' · sigue solo'}
                    {i.fin && i.cubierto === false && ' · el turno acabó sin cubrirse'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
