import { useQuery } from '@tanstack/react-query';
import type { HealthStatus } from '@platinum/shared';
import { api } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, CardBody, CardHeader } from '../../components/ui';

export function InicioPage() {
  const user = useAuthStore((s) => s.user);
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<HealthStatus>('/health') });

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre ?? ''}`}
        subtitle="Bienvenido a la intranet de Platinum Agency"
      />
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
