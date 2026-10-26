import { useQuery } from '@tanstack/react-query';
import type { HealthStatus } from '@platinum/shared';
import { api } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { PageHeader } from '../../components/layout/AppShell';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, ClipboardList, ClipboardPlus } from 'lucide-react';
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
        subtitle={
          user?.rol === ROLES.CLIENTE && user?.clienteNombre
            ? `Portal de Cliente · ${user.clienteNombre}`
            : 'Bienvenido a la intranet de Platinum Agency'
        }
      />
      {user?.rol === ROLES.CLIENTE && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Link
            to="/reportes"
            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <ClipboardList className="size-5" />
                </span>
                <span className="font-semibold text-slate-900 group-hover:text-brand-700">Reportes de tus sitios</span>
              </div>
              <p className="text-xs text-slate-500">
                Consulta los reportes oficiales generados en tus instalaciones, fotos de evidencia y seguimiento en tiempo real.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              Ver reportes <ArrowRight className="size-3.5" />
            </span>
          </Link>

          <Link
            to="/asistencia"
            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ClipboardCheck className="size-5" />
                </span>
                <span className="font-semibold text-slate-900 group-hover:text-emerald-700">Monitoreo de Asistencia</span>
              </div>
              <p className="text-xs text-slate-500">
                Supervisa las entradas, salidas y comidas de los guardias asignados a tus sitios, con foto y puntualidad.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              Ver asistencia <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </div>
      )}
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
