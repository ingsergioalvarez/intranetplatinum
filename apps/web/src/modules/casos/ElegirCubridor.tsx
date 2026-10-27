import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Moon, TriangleAlert } from 'lucide-react';
import { DESCANSO_MIN_HORAS, type CandidatoCobertura } from '@platinum/shared';
import { Badge, EmptyState, Spinner, cn } from '../../components/ui';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { coberturasService } from '../clientes/coberturas.service';

/** Quién puede cubrir un tramo: primero quienes descansan (el mismo criterio que "Enviar a cubrir"). */
export function ElegirCubridor({
  sitioId,
  tramo,
  elegido,
  onElegir,
  excluir,
}: {
  sitioId: number;
  tramo: { fecha: string; horaInicio: string; horas: number };
  elegido: CandidatoCobertura | null;
  onElegir: (c: CandidatoCobertura | null) => void;
  /** Guardias que no pueden cubrir (p. ej. el que no llegó). */
  excluir?: number[];
}) {
  const consulta = { sitioId, desde: tramo.fecha, horaInicio: tramo.horaInicio, horas: tramo.horas };
  const candidatos = useQuery({
    queryKey: coberturasService.keys.candidatos(consulta),
    queryFn: () => coberturasService.candidatos(consulta),
    placeholderData: keepPreviousData,
  });
  const lista = (candidatos.data ?? []).filter((c) => !excluir?.includes(c.guardia.id));

  if (candidatos.isPending) {
    return (
      <div className="flex justify-center py-4 text-brand-600">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (lista.length === 0) return <EmptyState title="Sin guardias disponibles" />;
  return (
    <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Quién cubre">
      {lista.map((c) => {
        const activo = elegido?.guardia.id === c.guardia.id;
        const deshabilitado = c.estado === 'cubre';
        const poco = c.descansoHoras !== null && c.descansoHoras < DESCANSO_MIN_HORAS;
        return (
          <li key={c.guardia.id}>
            <button
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={deshabilitado}
              onClick={() => onElegir(activo ? null : c)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 ring-inset',
                activo ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50',
                deshabilitado && 'cursor-not-allowed opacity-50',
              )}
            >
              <Avatar foto={c.guardia.foto} nombre={c.guardia.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{c.guardia.nombre}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  {c.estado === 'descansa' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Moon className="size-3.5" /> Descansa
                    </span>
                  ) : c.estado === 'trabaja' ? (
                    <span className="text-amber-700">{c.detalle}: su sitio queda en pausa</span>
                  ) : (
                    <span>{c.detalle}</span>
                  )}
                  {c.descansoHoras !== null && (
                    <span className={cn(poco && 'font-medium text-red-700')}>
                      {poco && <TriangleAlert className="mr-0.5 inline size-3.5" />}
                      Descansaría {c.descansoHoras} h
                    </span>
                  )}
                </span>
              </span>
              {activo && <Badge tone="brand">Elegido</Badge>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
