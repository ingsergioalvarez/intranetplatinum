import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Camera, ClipboardPlus, Filter, Search } from 'lucide-react';
import {
  ESTATUS_REPORTE,
  ESTATUS_REPORTE_LABEL,
  PERMISOS,
  PRIORIDAD_REPORTE,
  PRIORIDAD_REPORTE_LABEL,
  type EstatusReporte,
  type PrioridadReporte,
  type ReporteResumen,
} from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { formatFechaHora } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Select,
  cn,
  type Column,
} from '../../components/ui';
import { clientesService } from '../clientes/clientes.service';
import { nombreCategoria } from './categoriaIconos';
import { EstatusBadge, PrioridadBadge } from './etiquetas';
import { categoriasService, reportesService } from './reportes.service';

const LIMIT = 20;

const columns: Column<ReporteResumen>[] = [
  {
    key: 'folio',
    header: 'Folio',
    mobile: 'subtitle',
    className: 'whitespace-nowrap',
    render: (r) => <span className="font-mono text-xs text-slate-500">{r.folio}</span>,
  },
  {
    key: 'titulo',
    header: 'Reporte',
    mobile: 'title',
    render: (r) => <span className="font-medium text-slate-900">{r.titulo}</span>,
  },
  {
    key: 'sitio',
    header: 'Sitio',
    render: (r) => (
      <span className="text-slate-700">
        {r.sitio.nombre}
        <span className="block text-xs text-slate-500">{r.cliente.nombreComercial}</span>
      </span>
    ),
  },
  { key: 'categoria', header: 'Categoría', mobile: 'hidden', render: (r) => nombreCategoria(r.categoria) },
  { key: 'prioridad', header: 'Prioridad', render: (r) => <PrioridadBadge prioridad={r.prioridad} /> },
  { key: 'estatus', header: 'Estatus', render: (r) => <EstatusBadge estatus={r.estatus} /> },
  {
    key: 'fecha',
    header: 'Fecha',
    className: 'whitespace-nowrap',
    render: (r) => (
      <span className="text-slate-600">
        {formatFechaHora(r.createdAt)}
        <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-slate-400">
          <Camera className="size-3" />
          {r.totalFotos}
        </span>
      </span>
    ),
  },
];

/** Listado de reportes con filtros (F3-06). Supervisores ven todos; guardias, los de sus sitios. */
export function ReportesPage() {
  const yo = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const verClientes = hasPermission(yo, PERMISOS.CLIENTES_VER);

  const [busqueda, setBusqueda] = useState('');
  const [estatus, setEstatus] = useState<EstatusReporte | ''>('');
  const [prioridad, setPrioridad] = useState<PrioridadReporte | ''>('');
  const [clienteId, setClienteId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [mios, setMios] = useState(false);
  const [page, setPage] = useState(1);
  const [verFiltros, setVerFiltros] = useState(false);

  const q = useDebounced(busqueda.trim());
  const filtros = {
    q: q || undefined,
    estatus,
    prioridad,
    clienteId,
    categoriaId,
    desde,
    hasta,
    mios: mios || undefined,
  };
  const filtrosClave = JSON.stringify(filtros);
  useEffect(() => setPage(1), [filtrosClave]);

  const params = { ...filtros, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: reportesService.keys.list(params),
    queryFn: () => reportesService.list(params),
    placeholderData: keepPreviousData,
  });
  const categorias = useQuery({
    queryKey: categoriasService.keys.arbol(false),
    queryFn: () => categoriasService.arbol(false),
  });
  const clientes = useQuery({
    queryKey: clientesService.keys.list({ limit: 100 }),
    queryFn: () => clientesService.list({ limit: 100 }),
    enabled: verClientes,
  });

  const secundarios = [prioridad, clienteId, categoriaId, desde, hasta, mios].filter(Boolean).length;
  const hayFiltros = !!(q || estatus || secundarios);
  const limpiar = () => {
    setBusqueda('');
    setEstatus('');
    setPrioridad('');
    setClienteId('');
    setCategoriaId('');
    setDesde('');
    setHasta('');
    setMios(false);
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={
          lista.data ? `${lista.data.total} ${lista.data.total === 1 ? 'reporte' : 'reportes'}` : undefined
        }
        actions={
          hasPermission(yo, PERMISOS.REPORTES_CREAR) && (
            <Link
              to="/reportes/nuevo"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 active:bg-brand-900"
            >
              <ClipboardPlus className="size-4" /> Nuevo reporte
            </Link>
          )
        }
      />

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Folio o título"
                aria-label="Buscar reportes"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filtrar por estatus"
              className="hidden md:block"
              options={[
                { value: '', label: 'Estatus: todos' },
                ...ESTATUS_REPORTE.map((e) => ({ value: e, label: ESTATUS_REPORTE_LABEL[e] })),
              ]}
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as EstatusReporte | '')}
            />
            <Button
              variant="secondary"
              icon={<Filter className="size-4" />}
              onClick={() => setVerFiltros((v) => !v)}
              aria-expanded={verFiltros}
              aria-label={secundarios ? `Filtros (${secundarios} activos)` : 'Filtros'}
            >
              <span className="hidden sm:inline">Filtros</span>
              {secundarios > 0 && (
                <span className="rounded-full bg-brand-700 px-1.5 text-xs text-white">{secundarios}</span>
              )}
            </Button>
          </div>

          <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', !verFiltros && 'hidden')}>
            <Select
              aria-label="Filtrar por estatus"
              className="md:hidden"
              options={[
                { value: '', label: 'Estatus: todos' },
                ...ESTATUS_REPORTE.map((e) => ({ value: e, label: ESTATUS_REPORTE_LABEL[e] })),
              ]}
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as EstatusReporte | '')}
            />
            <Select
              aria-label="Filtrar por prioridad"
              options={[
                { value: '', label: 'Prioridad: todas' },
                ...PRIORIDAD_REPORTE.map((p) => ({ value: p, label: PRIORIDAD_REPORTE_LABEL[p] })),
              ]}
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadReporte | '')}
            />
            <Select
              aria-label="Filtrar por categoría"
              options={[
                { value: '', label: 'Categoría: todas' },
                ...(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nombre })),
              ]}
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            />
            {verClientes && (
              <Select
                aria-label="Filtrar por cliente"
                options={[
                  { value: '', label: 'Cliente: todos' },
                  ...(clientes.data?.items ?? []).map((c) => ({ value: c.id, label: c.nombreComercial })),
                ]}
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              />
            )}
            <label className="text-xs text-slate-500">
              Desde
              <Input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Hasta
              <Input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
            <Checkbox
              label="Solo los que yo creé"
              checked={mios}
              onChange={(e) => setMios(e.target.checked)}
              className="col-span-2 self-end md:col-span-1"
            />
            {hayFiltros && (
              <Button variant="ghost" onClick={limpiar} className="col-span-2 md:col-span-1">
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {lista.isError ? (
          <EmptyState
            title="No se pudo cargar la lista"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button variant="secondary" onClick={() => void lista.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={lista.data?.items ?? []}
            rowKey={(r) => r.id}
            loading={lista.isPending}
            onRowClick={(r) => navigate(`/reportes/${r.id}`)}
            emptyTitle={hayFiltros ? 'Sin resultados' : 'Aún no hay reportes'}
            emptyDescription={hayFiltros ? 'Prueba con otros filtros.' : undefined}
          />
        )}

        {lista.data && (
          <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />
        )}
      </Card>
    </>
  );
}
