import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import { ALCANCE_LABEL, CATALOGO_PERMISOS, ROLES, type RolEmpresa } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, DataTable, EmptyState, type Column } from '../../components/ui';
import { NuevoRolModal } from './NuevoRolModal';
import { rolesService } from './roles.service';

const TOTAL_CATALOGO = CATALOGO_PERMISOS.length;

function tipoRol(rol: RolEmpresa) {
  if (rol.clave === ROLES.ADMIN) return { label: 'Base · fijo', tone: 'brand' as const };
  if (rol.esBase) return { label: 'Base', tone: 'neutral' as const };
  return { label: 'Creado por ti', tone: 'success' as const };
}

/** Pantalla principal de Roles y permisos por empresa (C-11 parte 5). */
export function RolesPage() {
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);

  const lista = useQuery({
    queryKey: rolesService.keys.list(),
    queryFn: () => rolesService.list(),
  });

  const columns: Column<RolEmpresa>[] = [
    {
      key: 'nombre',
      header: 'Rol',
      mobile: 'title',
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium text-slate-900">
          <ShieldCheck className="size-4 shrink-0 text-brand-700" />
          <span>{r.nombre}</span>
        </span>
      ),
    },
    {
      key: 'personas',
      header: 'Personas',
      mobile: 'subtitle',
      render: (r) => (
        <span className="text-slate-700">
          {r.personas} {r.personas === 1 ? 'persona' : 'personas'}
        </span>
      ),
    },
    {
      key: 'alcance',
      header: 'Alcance',
      mobile: 'field',
      render: (r) => <span className="text-slate-700">{ALCANCE_LABEL[r.alcance]}</span>,
    },
    {
      key: 'permisos',
      header: 'Permisos',
      mobile: 'field',
      render: (r) => (
        <span className="text-slate-600">
          {r.clave === ROLES.ADMIN ? `Todos (${TOTAL_CATALOGO})` : `${r.permisos.length} de ${TOTAL_CATALOGO}`}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      mobile: 'field',
      render: (r) => {
        const t = tipoRol(r);
        return <Badge tone={t.tone}>{t.label}</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        subtitle="Define qué puede hacer cada rol en tu empresa y a cuántas personas alcanza."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreando(true)} disabled={!lista.data}>
            Nuevo rol
          </Button>
        }
      />

      <Card>
        {lista.isError ? (
          <EmptyState
            title="No se pudieron cargar los roles"
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
            rows={lista.data ?? []}
            rowKey={(r) => r.id}
            loading={lista.isPending}
            onRowClick={(r) => navigate(`/roles/${r.id}`)}
            emptyTitle="Sin roles"
          />
        )}
      </Card>

      {creando && lista.data && (
        <NuevoRolModal
          roles={lista.data}
          onClose={() => setCreando(false)}
          onCreado={(nuevo) => {
            setCreando(false);
            navigate(`/roles/${nuevo.id}`);
          }}
        />
      )}
    </>
  );
}

