import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Search } from 'lucide-react';
import {
  ESTATUS_CLIENTE,
  ESTATUS_CLIENTE_LABEL,
  PERMISOS,
  type ClienteResumen,
  type EstatusCliente,
} from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { useDebounced } from '../../core/hooks/useDebounced';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Select,
  type Column,
} from '../../components/ui';
import { useModulo } from '../../core/empresa/useContextoEmpresa';
import { carterasService } from '../carteras/carteras.service';
import { ClienteModal } from './ClienteModal';
import { EstatusClienteBadge } from './EstatusClienteBadge';
import { clientesService } from './clientes.service';

const LIMIT = 20;
type Estado = 'activos' | 'baja' | 'todos';

const estatusFiltro = [
  { value: '', label: 'Estatus: todos' },
  ...ESTATUS_CLIENTE.map((e) => ({ value: e, label: ESTATUS_CLIENTE_LABEL[e] })),
];
const estadoFiltro: { value: Estado; label: string }[] = [
  { value: 'activos', label: 'Vigentes' },
  { value: 'baja', label: 'De baja' },
  { value: 'todos', label: 'Todos' },
];

const columns: Column<ClienteResumen>[] = [
  {
    key: 'nombre',
    header: 'Cliente',
    mobile: 'title',
    render: (c) => <span className="font-medium text-slate-900">{c.nombreComercial}</span>,
  },
  {
    key: 'razon',
    header: 'Razón social',
    mobile: 'subtitle',
    render: (c) => <span className="text-slate-600">{c.razonSocial}</span>,
  },
  { key: 'responsable', header: 'Responsable', render: (c) => c.responsable ?? '—' },
  {
    key: 'sitios',
    header: 'Sitios',
    render: (c) => (
      <span className="inline-flex items-center gap-1 text-slate-700">
        <MapPin className="size-3.5 text-slate-400" />
        {c.totalSitios}
      </span>
    ),
  },
  { key: 'estatus', header: 'Estatus', render: (c) => <EstatusClienteBadge cliente={c} /> },
];

/** Lista de clientes (F2-02). Al tocar uno se abre su ficha. */
export function ClientesPage() {
  const yo = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [estatus, setEstatus] = useState<EstatusCliente | ''>('');
  const [estado, setEstado] = useState<Estado>('activos');
  /** Solo el super admin: los clientes de un admin o los sin asignar (A-65). */
  const [dueno, setDueno] = useState('');
  const esSuper = !!useAuthStore((s) => s.user?.esSuperAdmin);
  const conCarteras = useModulo('carteras');
  const carteras = useQuery({ queryKey: carterasService.keys.resumen, queryFn: carterasService.resumen, enabled: esSuper && conCarteras });
  const [page, setPage] = useState(1);
  const [creando, setCreando] = useState(false);

  const q = useDebounced(busqueda.trim());
  useEffect(() => setPage(1), [q, estatus, estado, dueno]);

  const params = {
    page,
    limit: LIMIT,
    q: q || undefined,
    estatus: estatus || undefined,
    estado,
    ...(esSuper && dueno === 'sin-asignar' && { sinAsignar: true }),
    ...(esSuper && dueno && dueno !== 'sin-asignar' && { propietarioId: Number(dueno) }),
  };
  const lista = useQuery({
    queryKey: clientesService.keys.list(params),
    queryFn: () => clientesService.list(params),
    placeholderData: keepPreviousData,
  });

  const hayFiltros = !!(q || estatus || estado !== 'activos' || dueno);
  const columnas: Column<ClienteResumen>[] = esSuper
    ? [
        ...columns.slice(0, 3),
        {
          key: 'dueno',
          header: 'Administrador',
          render: (c) => c.propietario?.nombre ?? <span className="text-amber-700">Sin asignar</span>,
        },
        ...columns.slice(3),
      ]
    : columns;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={
          lista.data ? `${lista.data.total} ${lista.data.total === 1 ? 'cliente' : 'clientes'}` : undefined
        }
        actions={
          hasPermission(yo, PERMISOS.CLIENTES_CREAR) && (
            <Button icon={<Building2 className="size-4" />} onClick={() => setCreando(true)}>
              Nuevo cliente
            </Button>
          )
        }
      />

      <Card>
        <div
          className={
            esSuper
              ? 'grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_200px_180px_200px]'
              : 'grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_200px_180px]'
          }
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Nombre, razón social o RFC"
              aria-label="Buscar clientes"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:contents">
            <Select
              aria-label="Filtrar por estatus"
              options={estatusFiltro}
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as EstatusCliente | '')}
            />
            <Select
              aria-label="Filtrar por vigencia"
              options={estadoFiltro}
              value={estado}
              onChange={(e) => setEstado(e.target.value as Estado)}
            />
            {esSuper && (
              <Select
                aria-label="Filtrar por administrador"
                value={dueno}
                onChange={(e) => setDueno(e.target.value)}
                options={[
                  { value: '', label: 'Administrador: todos' },
                  { value: 'sin-asignar', label: 'Sin asignar' },
                  ...(carteras.data?.admins ?? []).map((a) => ({ value: String(a.id), label: a.nombre })),
                ]}
              />
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
            columns={columnas}
            rows={lista.data?.items ?? []}
            rowKey={(c) => c.id}
            loading={lista.isPending}
            onRowClick={(c) => navigate(`/clientes/${c.id}`)}
            emptyTitle={hayFiltros ? 'Sin resultados' : 'Aún no hay clientes'}
            emptyDescription={
              hayFiltros
                ? 'Prueba con otros filtros o búsqueda.'
                : 'Registra el primer cliente con "Nuevo cliente".'
            }
          />
        )}

        {lista.data && (
          <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />
        )}
      </Card>

      {creando && (
        <ClienteModal
          cliente={null}
          onClose={() => setCreando(false)}
          onCreated={(c) => navigate(`/clientes/${c.id}`)}
        />
      )}
    </>
  );
}
