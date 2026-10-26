import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Card, Pagination, Spinner, cn } from '../../components/ui';
import { cambiosService } from './cambios.service';
import { ListaCambios } from './ListaCambios';
import { SolicitarCambioModal } from './SolicitarCambioModal';

const LIMIT = 15;
const VISTAS = [
  ['pendiente', 'Por aprobar'],
  ['', 'Todos'],
] as const;

/** Cambios de turno de admin y supervisor (TC-22): aprobar lo que piden los guardias o hacerlos directo. */
export function CambiosTurnoPage() {
  const [estado, setEstado] = useState<'pendiente' | ''>('pendiente');
  const [page, setPage] = useState(1);
  const [nuevo, setNuevo] = useState(false);
  const params = { estado: estado || undefined, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: cambiosService.keys.list(params),
    queryFn: () => cambiosService.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Cambios de turno"
        subtitle="Lo que piden los guardias se aprueba aquí; lo que haces tú queda aplicado."
        actions={
          <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => setNuevo(true)}>
            Nuevo cambio
          </Button>
        }
      />
      <div role="tablist" aria-label="Vista" className="mb-3 flex gap-1 rounded-xl bg-slate-200/60 p-1 sm:inline-flex">
        {VISTAS.map(([v, etiqueta]) => (
          <button
            key={etiqueta}
            type="button"
            role="tab"
            aria-selected={estado === v}
            onClick={() => {
              setEstado(v);
              setPage(1);
            }}
            className={cn(
              'flex-1 rounded-lg px-5 py-2 text-sm font-medium sm:flex-none',
              estado === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {etiqueta}
            {v === 'pendiente' && !!lista.data?.pendientes && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                {lista.data.pendientes}
              </span>
            )}
          </button>
        ))}
      </div>
      <Card>
        {lista.isPending ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner className="size-7" />
          </div>
        ) : (
          <>
            <ListaCambios cambios={lista.data?.items ?? []} />
            {lista.data && <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />}
          </>
        )}
      </Card>
      {nuevo && <SolicitarCambioModal comoGuardia={false} onClose={() => setNuevo(false)} />}
    </>
  );
}
