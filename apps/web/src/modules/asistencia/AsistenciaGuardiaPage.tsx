import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, EmptyState, Spinner } from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';
import { formatMes, moverMes } from './formato';
import { JornadaCard } from './JornadaCard';

/** Ficha de asistencia de un guardia: sus jornadas del mes, solo lectura (AS1-07). */
export function AsistenciaGuardiaPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const mesActual = hoyLocal().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesActual;

  const ficha = useQuery({
    queryKey: asistenciaService.keys.guardia(id, mes),
    queryFn: () => asistenciaService.guardia(id, mes),
    placeholderData: keepPreviousData,
  });
  const cambiarMes = (delta: number) => setParams({ mes: moverMes(mes, delta) }, { replace: true });

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader title={ficha.data?.guardia.nombre ?? 'Guardia'} subtitle={ficha.data?.guardia.email} />

      <div className="max-w-md space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-white px-2 py-1.5 ring-1 ring-inset ring-slate-200">
          <Button variant="ghost" size="sm" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <span className="font-medium text-slate-800">{formatMes(mes)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mes siguiente"
            disabled={mes >= mesActual}
            onClick={() => cambiarMes(1)}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {ficha.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : ficha.isError ? (
          <EmptyState title="No se pudo cargar la asistencia del guardia" description="Revisa tu conexión." />
        ) : ficha.data.jornadas.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-10" />} title="Sin marcas en este mes" />
        ) : (
          ficha.data.jornadas.map((j) => <JornadaCard key={j.entrada.id} jornada={j} detalle />)
        )}

        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="size-3.5" /> Las marcas no se pueden modificar ni borrar.
        </p>
      </div>
    </>
  );
}
