import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Star } from 'lucide-react';
import type { EmpresaResumen } from '@platinum/shared';
import { useDebounced } from '../../core/hooks/useDebounced';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Button, Card, DataTable, Input, Select, type Column } from '../../components/ui';
import { NuevaEmpresaModal } from './NuevaEmpresaModal';
import { plataformaService, type EstadoEmpresas } from './plataforma.service';

/** Plataforma > Empresas (C-07): solo el super admin. */
export function EmpresasPage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoEmpresas>('activas');
  const [nueva, setNueva] = useState(false);
  const q = useDebounced(busqueda.trim());

  const empresas = useQuery({
    queryKey: plataformaService.keys.empresas(estado, q),
    queryFn: () => plataformaService.listar(estado, q || undefined),
  });

  const abrir = (e: EmpresaResumen) => navigate(`/plataforma/empresas/${e.id}`);

  const columnas: Column<EmpresaResumen>[] = [
    {
      key: 'nombre',
      header: 'Empresa',
      mobile: 'title',
      render: (e) => (
        <span className="inline-flex items-center gap-2 font-medium text-slate-900">
          {e.nombre}
          {e.esMiEmpresa && (
            <span title="Tu empresa" className="text-amber-500">
              <Star className="size-4 fill-current" aria-label="Tu empresa" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      mobile: 'subtitle',
      render: (e) => <Badge tone={e.activa ? 'success' : 'neutral'}>{e.activa ? 'Activa' : 'Inactiva'}</Badge>,
    },
    {
      key: 'modulos',
      header: 'Módulos opcionales',
      render: (e) => `${e.modulosActivos} de ${e.modulosOpcionales} activos`,
    },
    { key: 'admins', header: 'Administradores', render: (e) => e.administradores },
  ];

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Las empresas que usan la plataforma, con su marca y sus módulos"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setNueva(true)}>
            Nueva empresa
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar empresa"
            aria-label="Buscar empresas"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filtrar por estado"
          options={[
            { value: 'activas', label: 'Activas' },
            { value: 'inactivas', label: 'Inactivas' },
            { value: 'todas', label: 'Todas' },
          ]}
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoEmpresas)}
        />
      </div>

      <Card>
        <DataTable
          columns={columnas}
          rows={empresas.data ?? []}
          rowKey={(e) => e.id}
          loading={empresas.isPending}
          emptyTitle={q || estado !== 'activas' ? 'Sin resultados' : 'Aún no hay empresas'}
          onRowClick={abrir}
          actions={(e) => (
            <Button variant="ghost" size="sm" aria-label={`Abrir ${e.nombre}`} onClick={() => abrir(e)}>
              <span className="hidden sm:inline">Abrir</span>
              <ChevronRight className="size-4" />
            </Button>
          )}
        />
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Star className="size-3.5 fill-amber-500 text-amber-500" /> Tu empresa
      </p>

      {nueva && <NuevaEmpresaModal onClose={() => setNueva(false)} />}
    </>
  );
}
