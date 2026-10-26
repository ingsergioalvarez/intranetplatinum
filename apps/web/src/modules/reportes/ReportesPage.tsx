import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Camera, ClipboardPlus, Filter, Search, X } from 'lucide-react';
import {
  ESTATUS_REPORTE,
  ESTATUS_REPORTE_LABEL,
  PERMISOS,
  PRIORIDAD_REPORTE,
  PRIORIDAD_REPORTE_LABEL,
  ROLES,
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
import { usuariosService } from '../usuarios/usuarios.service';
import { nombreCategoria } from './categoriaIconos';
import { EstatusBadge, PrioridadBadge } from './etiquetas';
import { categoriasService, reportesService } from './reportes.service';

const LIMIT = 20;

const PILDORAS_ESTATUS: { label: string; valor: EstatusReporte | '' }[] = [
  { label: 'Todos', valor: '' },
  { label: 'Abiertos', valor: 'abierto' },
  { label: 'En proceso', valor: 'en_proceso' },
  { label: 'Resueltos', valor: 'resuelto' },
  { label: 'Cerrados', valor: 'cerrado' },
];

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
  {
    key: 'reporto',
    header: 'Reportó',
    render: (r) => <span className="font-medium text-slate-800">{r.creadoPor.nombre}</span>,
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

/** Listado de reportes con filtros (F3-06). Supervisores y admin ven todos; guardias, los de sus sitios. */
export function ReportesPage() {
  const yo = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const verClientes = hasPermission(yo, PERMISOS.CLIENTES_VER);
  const verUsuarios = hasPermission(yo, PERMISOS.USUARIOS_VER);
  const soloPropios = !hasPermission(yo, PERMISOS.REPORTES_VER_TODOS);

  const [busqueda, setBusqueda] = useState('');
  const [estatus, setEstatus] = useState<EstatusReporte | ''>(() => {
    const e = searchParams.get('estatus');
    return e && ESTATUS_REPORTE.includes(e as EstatusReporte) ? (e as EstatusReporte) : '';
  });
  const [prioridad, setPrioridad] = useState<PrioridadReporte | ''>('');
  const [clienteId, setClienteId] = useState('');
  const [sitioId, setSitioId] = useState<string>(() => searchParams.get('sitioId') ?? '');
  const [categoriaId, setCategoriaId] = useState('');
  const [creadoPorId, setCreadoPorId] = useState<string>(() => searchParams.get('creadoPorId') ?? '');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tabGuardia, setTabGuardia] = useState<'mios' | 'sitio'>(() => {
    return searchParams.get('tab') === 'sitio' ? 'sitio' : 'mios';
  });
  const [mios, setMios] = useState(false);
  const [page, setPage] = useState(1);
  const [verFiltros, setVerFiltros] = useState(false);

  // Consultas de apoyo
  const sitios = useQuery({
    queryKey: reportesService.keys.sitios,
    queryFn: reportesService.sitios,
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
  const usuarios = useQuery({
    queryKey: usuariosService.keys.list({ estado: 'activos', limit: 100 }),
    queryFn: () => usuariosService.list({ estado: 'activos', limit: 100 }),
    enabled: verUsuarios,
  });

  // Sitio activo si se filtró por sitioId
  const sitioActivo = sitios.data?.find((s) => String(s.id) === sitioId);

  const cambiarSitio = (nuevoSitioId: string) => {
    setSitioId(nuevoSitioId);
    const p = new URLSearchParams(searchParams);
    if (nuevoSitioId) p.set('sitioId', nuevoSitioId);
    else p.delete('sitioId');
    setSearchParams(p, { replace: true });
  };

  const cambiarCreadoPor = (nuevoId: string) => {
    setCreadoPorId(nuevoId);
    const p = new URLSearchParams(searchParams);
    if (nuevoId) p.set('creadoPorId', nuevoId);
    else p.delete('creadoPorId');
    setSearchParams(p, { replace: true });
  };

  const cambiarEstatus = (nuevoEstatus: EstatusReporte | '') => {
    setEstatus(nuevoEstatus);
    const p = new URLSearchParams(searchParams);
    if (nuevoEstatus) p.set('estatus', nuevoEstatus);
    else p.delete('estatus');
    setSearchParams(p, { replace: true });
  };

  const cambiarTabGuardia = (tab: 'mios' | 'sitio') => {
    setTabGuardia(tab);
    const p = new URLSearchParams(searchParams);
    if (tab === 'sitio') p.set('tab', 'sitio');
    else p.delete('tab');
    setSearchParams(p, { replace: true });
  };

  const q = useDebounced(busqueda.trim());
  const esMio = soloPropios ? tabGuardia === 'mios' : mios;

  const filtros = {
    q: q || undefined,
    estatus,
    prioridad,
    clienteId: clienteId ? Number(clienteId) : undefined,
    sitioId: sitioId ? Number(sitioId) : undefined,
    categoriaId: categoriaId ? Number(categoriaId) : undefined,
    creadoPorId: creadoPorId ? Number(creadoPorId) : undefined,
    desde,
    hasta,
    mios: esMio || undefined,
  };

  const filtrosClave = JSON.stringify(filtros);
  useEffect(() => setPage(1), [filtrosClave]);

  const params = { ...filtros, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: reportesService.keys.list(params),
    queryFn: () => reportesService.list(params),
    placeholderData: keepPreviousData,
  });

  const secundarios = [
    prioridad,
    clienteId,
    sitioId,
    categoriaId,
    creadoPorId,
    desde,
    hasta,
    !soloPropios && mios,
  ].filter(Boolean).length;
  const hayFiltros = !!(q || estatus || secundarios);

  const limpiar = () => {
    setBusqueda('');
    setEstatus('');
    setPrioridad('');
    setClienteId('');
    setSitioId('');
    setCategoriaId('');
    setCreadoPorId('');
    setDesde('');
    setHasta('');
    if (!soloPropios) setMios(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const nombreSitioGuardia =
    sitios.data && sitios.data.length === 1
      ? `Del sitio: ${sitios.data[0].nombre}`
      : 'Del sitio';

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
              to={sitioId ? `/reportes/nuevo?sitioId=${sitioId}` : '/reportes/nuevo'}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 active:bg-brand-900"
            >
              <ClipboardPlus className="size-4" /> Nuevo reporte
            </Link>
          )
        }
      />

      {/* Pestañas para el rol guardia (F3-06): 'Mis reportes' vs 'Del sitio' */}
      {soloPropios && yo?.rol === ROLES.GUARDIA && (
        <div className="mb-4">
          <div role="tablist" className="flex rounded-xl bg-slate-100 p-1 sm:inline-flex">
            <button
              type="button"
              role="tab"
              aria-selected={tabGuardia === 'mios'}
              onClick={() => cambiarTabGuardia('mios')}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                tabGuardia === 'mios'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Mis reportes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tabGuardia === 'sitio'}
              onClick={() => cambiarTabGuardia('sitio')}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                tabGuardia === 'sitio'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {nombreSitioGuardia}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {tabGuardia === 'mios'
              ? 'Reportes que tú has generado y su seguimiento oficial.'
              : 'Novedades y reportes registrados en tu sitio de servicio asignado.'}
          </p>
        </div>
      )}

      {/* Encabezado contextual cuando se consulta un sitio específico */}
      {sitioActivo && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="size-4 text-brand-700" />
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">{sitioActivo.nombre}</h2>
              <span className="rounded-md border border-brand-200 bg-white px-2 py-0.5 text-xs font-medium text-brand-700">
                {sitioActivo.cliente.nombreComercial}
              </span>
            </div>
            {sitioActivo.direccion && (
              <p className="text-xs text-slate-600">{sitioActivo.direccion}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(yo, PERMISOS.REPORTES_CREAR) && (
              <Link
                to={`/reportes/nuevo?sitioId=${sitioActivo.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
              >
                <ClipboardPlus className="size-3.5" />
                Reportar aquí
              </Link>
            )}
            {!soloPropios && (
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="size-3.5" />}
                onClick={() => cambiarSitio('')}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Todos los sitios
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Folio, título o quien reportó"
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
              onChange={(e) => cambiarEstatus(e.target.value as EstatusReporte | '')}
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

          {/* Píldoras de estatus rápidas */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" role="group" aria-label="Filtro rápido por estatus">
            {PILDORAS_ESTATUS.map((p) => {
              const activo = estatus === p.valor;
              return (
                <button
                  key={p.valor || 'todos'}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiarEstatus(p.valor)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    activo
                      ? 'bg-brand-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Cajón de filtros secundarios */}
          <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', !verFiltros && 'hidden')}>
            <Select
              aria-label="Filtrar por estatus"
              className="md:hidden"
              options={[
                { value: '', label: 'Estatus: todos' },
                ...ESTATUS_REPORTE.map((e) => ({ value: e, label: ESTATUS_REPORTE_LABEL[e] })),
              ]}
              value={estatus}
              onChange={(e) => cambiarEstatus(e.target.value as EstatusReporte | '')}
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
            <Select
              aria-label="Filtrar por sitio"
              options={[
                { value: '', label: 'Sitio: todos' },
                ...(sitios.data ?? []).map((s) => ({
                  value: s.id,
                  label: yo?.rol === ROLES.CLIENTE ? s.nombre : `${s.nombre} (${s.cliente.nombreComercial})`,
                })),
              ]}
              value={sitioId}
              onChange={(e) => cambiarSitio(e.target.value)}
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
            {verUsuarios && (
              <Select
                aria-label="Filtrar por quien reportó"
                options={[
                  { value: '', label: 'Reportó: todos' },
                  ...(usuarios.data?.items ?? []).map((u) => ({
                    value: u.id,
                    label: `${u.nombre} (${u.rol})`,
                  })),
                ]}
                value={creadoPorId}
                onChange={(e) => cambiarCreadoPor(e.target.value)}
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
            {!soloPropios && (
              <Checkbox
                label="Solo los que yo creé"
                checked={mios}
                onChange={(e) => setMios(e.target.checked)}
                className="col-span-2 self-end md:col-span-1"
              />
            )}
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
