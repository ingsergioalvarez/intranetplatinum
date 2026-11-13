import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import type { Aviso, BandejaAvisos } from '@platinum/shared';
import { api } from '../../core/api';
import { Button } from '../ui';
import { avisosDeLaSeccion, destinoDeAviso, ofreceVer } from './avisosSeccion';
import { horaRelativa } from './tiempoAviso';

const MAX_VISIBLES = 3;

/**
 * "Nuevo en esta sección" (A-85): en la pantalla principal de una sección con burbuja roja, dice qué avisos son. "Entendido"
 * lo marca como leído (baja la burbuja y el contador de la campanita) y "Ver" abre el lugar al que se refiere el aviso.
 * Abrir la sección por sí solo no marca nada como leído. Usa la misma consulta que la campanita.
 */
export function FranjaAvisos({ rutas }: { rutas: string[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bandeja = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<BandejaAvisos>('/avisos'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const marcar = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.patch(`/avisos/${id}/leido`))),
    onSettled: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });

  const nuevos = avisosDeLaSeccion(bandeja.data?.items ?? [], rutas, pathname);
  if (nuevos.length === 0) return null;
  const visibles = nuevos.slice(0, MAX_VISIBLES);
  const ocultos = nuevos.length - visibles.length;
  const ahora = new Date();

  const ver = (a: Aviso) => {
    marcar.mutate([a.id]);
    const destino = destinoDeAviso(a);
    if (destino) navigate(destino);
  };

  return (
    <section
      role="region"
      aria-label="Avisos nuevos de esta sección"
      className="mb-4 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200 ring-inset md:p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
        <BellRing className="size-4" aria-hidden /> Nuevo en esta sección
        {nuevos.length > 1 && <span className="font-normal text-brand-700">· {nuevos.length}</span>}
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-2">
        {visibles.map((a) => (
          <li key={a.id} className="rounded-xl bg-white p-3 ring-1 ring-brand-100 ring-inset">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{a.titulo}</p>
              <span className="shrink-0 text-xs text-slate-500">{horaRelativa(a.createdAt, ahora)}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-700">{a.mensaje}</p>
            {a.atendido && (
              <p className="mt-0.5 text-xs font-medium text-emerald-700">
                {a.atendido.resultado}
                {a.atendido.por ? ` · ${a.atendido.por}` : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              {ofreceVer(a, pathname) && (
                <Button size="sm" variant="secondary" onClick={() => ver(a)}>
                  Ver
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={marcar.isPending} onClick={() => marcar.mutate([a.id])}>
                Entendido
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {(ocultos > 0 || nuevos.length > 1) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-brand-800">
          <span>{ocultos > 0 ? `y ${ocultos} más` : ''}</span>
          <Button size="sm" variant="ghost" disabled={marcar.isPending} onClick={() => marcar.mutate(nuevos.map((a) => a.id))}>
            Marcar todos como leídos
          </Button>
        </div>
      )}
    </section>
  );
}
