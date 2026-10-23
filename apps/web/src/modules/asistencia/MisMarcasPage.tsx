import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, EmptyState, Spinner } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';
import { formatMes, moverMes } from './formato';
import { JornadaCard } from './JornadaCard';

/** Historial de marcas del guardia por mes (A-17, AS1-06). */
export function MisMarcasPage() {
  const mesActual = hoyLocal().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const jornadas = useQuery({
    queryKey: asistenciaService.keys.mias(mes),
    queryFn: () => asistenciaService.mias(mes),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Mis checadas"
        actions={
          <Link
            to="/marcar"
            className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <ArrowLeft className="size-4" /> Checador
          </Link>
        }
      />

      <div className="max-w-md space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-white px-2 py-1.5 ring-1 ring-inset ring-slate-200">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mes anterior"
            onClick={() => setMes(moverMes(mes, -1))}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="font-medium text-slate-800">{formatMes(mes)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mes siguiente"
            disabled={mes >= mesActual}
            onClick={() => setMes(moverMes(mes, 1))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {jornadas.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : jornadas.isError ? (
          <EmptyState title="No se pudieron cargar tus checadas" description="Revisa tu conexión." />
        ) : jornadas.data.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-10" />} title="Sin checadas en este mes" />
        ) : (
          jornadas.data.map((j) => <JornadaCard key={j.entrada.id} jornada={j} />)
        )}
      </div>
    </>
  );
}
