import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROLES } from '@platinum/shared';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, CardHeader, EmptyState, Spinner } from '../../components/ui';
import { useAuthStore } from '../../core/auth/authStore';
import { formatFechaHora, hoyLocal } from '../../core/format/fechas';
import { asistenciaService } from '../asistencia/asistencia.service';
import { EstadoJornada } from '../asistencia/EstadoJornada';
import { formatDiaLargo } from '../asistencia/formato';
import { Avatar } from '../clientes/AsignarTurnoModal';
import { reportesService } from '../reportes/reportes.service';
import { TableroPage } from './TableroPage';

/**
 * Inicio según el rol (DA-51): el guardia entra directo al Checador; admin y supervisor ven el
 * tablero del día; el cliente, un resumen de sus reportes y de sus guardias hoy.
 */
export function InicioPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  if (rol === ROLES.GUARDIA) return <Navigate to="/marcar" replace />;
  if (rol === ROLES.CLIENTE) return <ResumenCliente />;
  return <TableroPage />;
}

/** Resumen del portal de clientes: reportes abiertos y asistencia de hoy de sus guardias. */
function ResumenCliente() {
  const user = useAuthStore((s) => s.user);
  const filtro = { estatus: 'abierto', page: 1, limit: 4 };
  const reportes = useQuery({
    queryKey: reportesService.keys.list(filtro),
    queryFn: () => reportesService.list(filtro),
  });
  const params = { fecha: hoyLocal(), page: 1, limit: 8 };
  const dia = useQuery({
    queryKey: asistenciaService.keys.dia(params),
    queryFn: () => asistenciaService.dia(params),
  });

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre ?? ''}`}
        subtitle={`${user?.clienteNombre ? `Portal de Cliente · ${user.clienteNombre} · ` : ''}${formatDiaLargo(new Date())}`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Reportes abiertos${reportes.data ? ` (${reportes.data.total})` : ''}`}
            actions={
              <Link to="/reportes" className="text-sm font-medium text-brand-700">
                Ver todos
              </Link>
            }
          />
          {reportes.isPending ? (
            <div className="flex justify-center py-8 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : !reportes.data?.items.length ? (
            <EmptyState title="Sin reportes abiertos" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reportes.data.items.map((r) => (
                <li key={r.id}>
                  <Link to={`/reportes/${r.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <p className="truncate font-medium text-slate-900">{r.titulo}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.folio} · {r.sitio.nombre} · {formatFechaHora(r.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Guardias hoy"
            actions={
              <Link to="/asistencia" className="text-sm font-medium text-brand-700">
                Ver asistencia
              </Link>
            }
          />
          {dia.isPending ? (
            <div className="flex justify-center py-8 text-brand-600">
              <Spinner className="size-6" />
            </div>
          ) : !dia.data?.items.length ? (
            <EmptyState title="Sin guardias hoy" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dia.data.items.map((f) => (
                <li
                  key={`${f.guardia.id}-${f.jornada?.entrada.id ?? 'sin'}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <Avatar foto={f.guardia.foto} nombre={f.guardia.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{f.guardia.nombre}</p>
                    <p className="truncate text-xs text-slate-500">{f.sitio?.nombre}</p>
                  </div>
                  <EstadoJornada jornada={f.jornada} turno={f.turno} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
