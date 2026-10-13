import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import {
  PERMISOS,
  ROL_DESCRIPCIONES,
  ROLES,
  type EstadoUsuarioFiltro,
  type Rol,
  type Usuario,
  type UsuarioConPassword,
} from '@platinum/shared';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { formatFechaHora } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Select,
  type Column,
} from '../../components/ui';
import { estadoUsuario } from './estadoUsuario';
import { PasswordTemporalModal } from './PasswordTemporalModal';
import { UsuarioModal } from './UsuarioModal';
import { usuariosService } from './usuarios.service';

const LIMIT = 20;

const rolFiltro = [
  { value: '', label: 'Rol: todos' },
  ...(Object.values(ROLES) as Rol[]).map((r) => ({ value: r, label: ROL_DESCRIPCIONES[r] })),
];
const estadoFiltro: { value: EstadoUsuarioFiltro; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'baja', label: 'De baja' },
  { value: 'todos', label: 'Todos' },
];

/** Gestión de usuarios (F1-08): lista con filtros y modal de alta/edición. */
export function UsuariosPage() {
  const yo = useAuthStore((s) => s.user);
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<Rol | ''>('');
  const [estado, setEstado] = useState<EstadoUsuarioFiltro>('activos');
  const [page, setPage] = useState(1);
  /** undefined = cerrado, null = alta, Usuario = edición. */
  const [editando, setEditando] = useState<Usuario | null | undefined>(undefined);
  const [temporal, setTemporal] = useState<{ resultado: UsuarioConPassword; titulo: string } | null>(null);

  const q = useDebounced(busqueda.trim());
  useEffect(() => setPage(1), [q, rol, estado]);

  const params = { page, limit: LIMIT, q: q || undefined, rol: rol || undefined, estado };
  const lista = useQuery({
    queryKey: usuariosService.keys.list(params),
    queryFn: () => usuariosService.list(params),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Usuario>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      mobile: 'title',
      render: (u) => (
        <span className="font-medium text-slate-900">
          {u.nombre}
          {u.id === yo?.id && <span className="ml-1.5 text-xs font-normal text-slate-500">(tú)</span>}
        </span>
      ),
    },
    { key: 'email', header: 'Correo', mobile: 'subtitle', render: (u) => u.email },
    {
      key: 'rol',
      header: 'Rol',
      render: (u) => <Badge tone="brand">{ROL_DESCRIPCIONES[u.rol]}</Badge>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (u) => {
        const e = estadoUsuario(u);
        return <Badge tone={e.tone}>{e.label}</Badge>;
      },
    },
    {
      key: 'ultimoAcceso',
      header: 'Último acceso',
      className: 'whitespace-nowrap',
      render: (u) => <span className="text-slate-600">{formatFechaHora(u.ultimoAcceso)}</span>,
    },
  ];

  const hayFiltros = !!(q || rol || estado !== 'activos');

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={
          lista.data ? `${lista.data.total} ${lista.data.total === 1 ? 'usuario' : 'usuarios'}` : undefined
        }
        actions={
          hasPermission(yo, PERMISOS.USUARIOS_CREAR) && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setEditando(null)}>
              Nuevo usuario
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_200px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Nombre, correo o teléfono"
              aria-label="Buscar usuarios"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:contents">
            <Select
              aria-label="Filtrar por rol"
              options={rolFiltro}
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol | '')}
            />
            <Select
              aria-label="Filtrar por estado"
              options={estadoFiltro}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoUsuarioFiltro)}
            />
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
            rowKey={(u) => u.id}
            loading={lista.isPending}
            onRowClick={setEditando}
            emptyTitle={hayFiltros ? 'Sin resultados' : 'Aún no hay usuarios'}
            emptyDescription={hayFiltros ? 'Prueba con otros filtros o búsqueda.' : undefined}
          />
        )}

        {lista.data && (
          <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />
        )}
      </Card>

      {editando !== undefined && (
        <UsuarioModal
          key={editando?.id ?? 'nuevo'}
          usuario={editando}
          onClose={() => setEditando(undefined)}
          onPasswordTemporal={(resultado, titulo) => setTemporal({ resultado, titulo })}
        />
      )}

      <PasswordTemporalModal
        resultado={temporal?.resultado ?? null}
        titulo={temporal?.titulo ?? ''}
        onClose={() => setTemporal(null)}
      />
    </>
  );
}
