import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  CLASES_INCIDENCIA,
  CLASE_INCIDENCIA_LABEL,
  ESTADOS_INCIDENCIA,
  ESTADO_INCIDENCIA_LABEL,
  type IncidenciasDeGuardia,
} from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  cn,
  type Column,
} from '../../components/ui';
import { hoyLocal } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { asistenciaService } from './asistencia.service';
import { Chips, ListaEventos } from './BitacoraGuardia';
import { formatMes, moverMes } from './formato';
import { IncidenciaModal } from './IncidenciaModal';

const LIMIT = 20;

type Vista = 'guardias' | 'todas';

const columnas: Column<IncidenciasDeGuardia>[] = [
  {
    key: 'guardia',
    header: 'Guardia',
    mobile: 'title',
    render: ({ guardia }) => (
      <span className="flex items-center gap-3">
        <Avatar foto={guardia.foto} nombre={guardia.nombre} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-900">{guardia.nombre}</span>
          <span className="block truncate text-xs text-slate-500">{guardia.email}</span>
        </span>
      </span>
    ),
  },
  {
    key: 'asistencia',
    header: 'De asistencia',
    className: 'tabular-nums',
    render: (f) => <Numero n={f.asistencia} />,
  },
  { key: 'rostro', header: 'De rostro', className: 'tabular-nums', render: (f) => <Numero n={f.rostro} /> },
  {
    key: 'pendientes',
    header: 'Sin atender',
    render: (f) =>
      f.pendientes > 0 ? (
        <Badge tone="danger">{f.pendientes}</Badge>
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
];

function Numero({ n }: { n: number }) {
  return <span className={n > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}>{n}</span>;
}

/**
 * Incidencias (DA-42): todo lo que salió mal con los guardias, de asistencia (retardos, salidas
 * antes, comida fuera, faltas) y de rostro (intentos rechazados). Por guardia (toca uno para ver
 * las suyas en su bitácora) o todas juntas con filtros. `?id=` abre una de rostro (la campanita).
 */
export function IncidenciasPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mesActual = hoyLocal().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesActual;
  const vista: Vista = params.get('vista') === 'todas' ? 'todas' : 'guardias';
  const clase = CLASES_INCIDENCIA.find((c) => c === params.get('clase')) ?? null;
  const estado = ESTADOS_INCIDENCIA.find((e) => e === params.get('estado')) ?? null;
  const abierta = Number(params.get('id')) || null;
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(busqueda.trim());

  const porGuardia = useQuery({
    queryKey: asistenciaService.keys.incidenciasPorGuardia(mes),
    queryFn: () => asistenciaService.incidenciasPorGuardia(mes),
    placeholderData: keepPreviousData,
    enabled: vista === 'guardias',
  });
  const filtros = { mes, clase: clase ?? undefined, estado: estado ?? undefined, q, page, limit: LIMIT };
  const todas = useQuery({
    queryKey: asistenciaService.keys.incidenciasMes(filtros),
    queryFn: () => asistenciaService.incidenciasMes(filtros),
    placeholderData: keepPreviousData,
    enabled: vista === 'todas',
  });

  /** Cambia parámetros de la URL conservando los demás (null los quita); vuelve a la página 1. */
  const cambiar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
    setPage(1);
  };

  // Enlaces viejos `?guardia=` llevan a las incidencias en la bitácora del guardia.
  const guardiaViejo = Number(params.get('guardia'));
  if (guardiaViejo) {
    return <Navigate to={`/asistencia/guardias/${guardiaViejo}?vista=bitacora&cat=incidencias`} replace />;
  }

  const texto = busqueda.trim().toLowerCase();
  const guardias = (porGuardia.data ?? []).filter(
    (f) =>
      !texto ||
      f.guardia.nombre.toLowerCase().includes(texto) ||
      f.guardia.email.toLowerCase().includes(texto),
  );

  return (
    <>
      <Link
        to="/asistencia"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Asistencia
      </Link>
      <PageHeader
        title="Incidencias"
        subtitle="Lo que salió mal con los guardias: asistencia y rostro"
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 ring-inset">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Mes anterior"
              onClick={() => cambiar({ mes: moverMes(mes, -1) })}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-36 text-center font-medium text-slate-800">{formatMes(mes)}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Mes siguiente"
              disabled={mes >= mesActual}
              onClick={() => cambiar({ mes: moverMes(mes, 1) })}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
      />

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr] md:items-center">
            <div role="tablist" aria-label="Vista" className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  ['guardias', 'Por guardia'],
                  ['todas', 'Todas'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={vista === v}
                  onClick={() => cambiar({ vista: v === 'guardias' ? null : v })}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-2 text-sm font-medium md:flex-none',
                    vista === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder={vista === 'guardias' ? 'Buscar guardia' : 'Guardia o sitio'}
                aria-label="Buscar"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
          {vista === 'todas' && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Chips
                label="Tipo de incidencia"
                opciones={CLASES_INCIDENCIA.map((c) => [c, CLASE_INCIDENCIA_LABEL[c]] as const)}
                valor={clase}
                onChange={(c) => cambiar({ clase: c })}
              />
              <Chips
                label="Estado"
                todas="Cualquier estado"
                opciones={ESTADOS_INCIDENCIA.map((s) => [s, ESTADO_INCIDENCIA_LABEL[s]] as const)}
                valor={estado}
                onChange={(s) => cambiar({ estado: s })}
              />
            </div>
          )}
        </div>

        {vista === 'guardias' ? (
          porGuardia.isError ? (
            <EmptyState title="No se pudieron cargar las incidencias" description="Revisa tu conexión." />
          ) : (
            <DataTable
              columns={columnas}
              rows={guardias}
              rowKey={(f) => f.guardia.id}
              loading={porGuardia.isPending}
              onRowClick={(f) =>
                navigate(`/asistencia/guardias/${f.guardia.id}?mes=${mes}&vista=bitacora&cat=incidencias`)
              }
              emptyTitle="Sin guardias"
              emptyDescription={texto ? 'Prueba con otro nombre.' : undefined}
            />
          )
        ) : todas.isError ? (
          <EmptyState title="No se pudieron cargar las incidencias" description="Revisa tu conexión." />
        ) : (
          <>
            <div className="p-4">
              <ListaEventos
                eventos={todas.data?.items ?? []}
                cargando={todas.isPending}
                vacio={
                  q || clase || estado ? 'Nada con estos filtros en el mes.' : 'Sin incidencias en este mes.'
                }
                conGuardia
              />
            </div>
            {todas.data && todas.data.total > 0 && (
              <Pagination page={page} limit={LIMIT} total={todas.data.total} onPageChange={setPage} />
            )}
          </>
        )}
      </Card>

      <IncidenciaModal id={abierta} onClose={() => cambiar({ id: null })} />
    </>
  );
}
