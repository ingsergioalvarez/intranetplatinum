import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, Pagination, Spinner, cn } from '../../components/ui';
import { CapturaHorasModal } from './CapturaHorasModal';
import { HorasExtraLista } from './HorasExtraLista';
import { ReporteHorasExtra } from './ReporteHorasExtra';
import { horasExtraService } from './horasExtra.service';

const LIMIT = 15;
const VISTAS = [
  ['pendientes', 'Por aprobar'],
  ['todas', 'Todas'],
  ['reporte', 'Reporte'],
] as const;
type Vista = (typeof VISTAS)[number][0];

/** Horas extra de admin y supervisor (AS5-04): aprobar, rechazar, fijar la hora de salida o capturarlas. */
export function HorasExtraPage() {
  const [vista, setVista] = useState<Vista>('pendientes');
  const [page, setPage] = useState(1);
  const [capturando, setCapturando] = useState(false);
  const params = { estado: vista === 'pendientes' ? ('pendientes' as const) : undefined, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: horasExtraService.keys.list(params),
    queryFn: () => horasExtraService.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    enabled: vista !== 'reporte',
  });
  // El contador sale de la misma consulta; en "Reporte" se pide aparte para no perderlo.
  const contador = useQuery({
    queryKey: horasExtraService.keys.list({ estado: 'pendientes', page: 1, limit: 1 }),
    queryFn: () => horasExtraService.list({ estado: 'pendientes', page: 1, limit: 1 }),
    refetchInterval: 60_000,
  });
  const pendientes = contador.data?.pendientes ?? 0;

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Horas extra"
        subtitle="Nada cuenta hasta que se aprueba. Cada decisión queda en la bitácora del guardia."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCapturando(true)}>
            Capturar horas
          </Button>
        }
      />
      <div role="tablist" aria-label="Vista" className="mb-3 flex gap-1 rounded-xl bg-slate-200/60 p-1 sm:inline-flex">
        {VISTAS.map(([v, etiqueta]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => {
              setVista(v);
              setPage(1);
            }}
            className={cn(
              'flex-1 rounded-lg px-5 py-2 text-sm font-medium sm:flex-none',
              vista === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {etiqueta}
            {v === 'pendientes' && pendientes > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {vista === 'reporte' ? (
        <ReporteHorasExtra />
      ) : (
        <Card>
          {lista.isPending ? (
            <div className="flex justify-center py-12 text-brand-600">
              <Spinner className="size-7" />
            </div>
          ) : (
            <>
              <HorasExtraLista items={lista.data?.items ?? []} />
              {lista.data && <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />}
            </>
          )}
        </Card>
      )}
      {capturando && <CapturaHorasModal onClose={() => setCapturando(false)} />}
    </>
  );
}
