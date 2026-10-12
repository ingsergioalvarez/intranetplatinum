import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permiso } from '@platinum/shared';
import { EmptyState, Spinner } from '../../components/ui';
import { hasPermission, useAuthStore } from './authStore';

/** Exige sesión (y opcionalmente un permiso). Sin sesión redirige a /login conservando el destino. */
export function ProtectedRoute({ children, permiso }: { children: ReactNode; permiso?: Permiso }) {
  const { user, restoring, loggedOut } = useAuthStore();
  const location = useLocation();

  if (restoring) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location.pathname }} />;
  }

  if (!hasPermission(user, permiso)) {
    return <EmptyState title="Sin acceso" description="No tienes permiso para ver esta sección." />;
  }

  return <>{children}</>;
}
