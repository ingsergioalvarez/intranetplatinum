import { useQuery } from '@tanstack/react-query';
import type { HealthStatus } from '@platinum/shared';
import { api } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { PageHeader } from '../../components/layout/AppShell';
import { Link } from 'react-router-dom';
import { ClipboardPlus } from 'lucide-react';
import { ROLES } from '@platinum/shared';
import { Badge, Card, CardBody, CardHeader } from '../../components/ui';
import { MisSitiosCard } from './MisSitiosCard';

export function InicioPage() {
  const user = useAuthStore((s) => s.user);
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<HealthStatus>('/health') });

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre ?? ''}`}
        subtitle="Bienvenido a la intranet de Platinum Agency"
      />
      {user?.rol === ROLES.GUARDIA && (
        <div className="mb-4 space-y-4">
          <Link
            to="/reportes/nuevo"
            className="flex items-center justify-center gap-3 rounded-xl bg-brand-700 px-4 py-5 text-lg font-semibold text-white shadow-sm active:bg-brand-900"
          >
            <ClipboardPlus className="size-6" /> Nuevo reporte
          </Link>
          <MisSitiosCard />
        </div>
      )}
      <Card>
        <CardHeader title="Estado del sistema" />
        <CardBody className="flex items-center justify-between text-sm">
          <span className="text-slate-600">API</span>
          {health.isLoading ? (
            <Badge>Consultando…</Badge>
          ) : health.isError ? (
            <Badge tone="danger">Sin conexión</Badge>
          ) : (
            <Badge tone="success">En línea · v{health.data?.version}</Badge>
          )}
        </CardBody>
      </Card>
    </>
  );
}
