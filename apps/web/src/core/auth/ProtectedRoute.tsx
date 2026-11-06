import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { ModuloOpcionalClave, Permiso, Rol } from '@platinum/shared';
import { EmptyState, Spinner } from '../../components/ui';
import { useContextoEmpresa } from '../empresa/useContextoEmpresa';
import { esColaborador, hasPermission, hasRole, useAuthStore } from './authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Permiso granular requerido (el admin pasa siempre). */
  permiso?: Permiso;
  /** Roles permitidos; vacío = cualquier rol con sesión. */
  roles?: Rol[];
  /** Solo quien vive de marcar su asistencia (pantallas del colaborador). */
  soloColaborador?: boolean;
  /** Solo el super admin (A-65). */
  superAdmin?: boolean;
  /** Módulo de producto requerido: si la empresa lo tiene apagado, no se puede entrar (C-09). */
  modulo?: ModuloOpcionalClave;
  /** Admite usuarios con contraseña temporal (solo la pantalla para cambiarla, D-012). */
  allowTemporaryPassword?: boolean;
}

/** Exige sesión (y opcionalmente permiso/rol). Sin sesión redirige a /login conservando el destino. */
export function ProtectedRoute({ children, permiso, roles, soloColaborador, superAdmin, modulo, allowTemporaryPassword }: ProtectedRouteProps) {
  const { user, restoring, loggedOut } = useAuthStore();
  const contexto = useContextoEmpresa();
  const location = useLocation();

  if (restoring) return <FullScreenSpinner />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={loggedOut ? undefined : { from: location.pathname + location.search }}
      />
    );
  }

  if (user.debeCambiarPassword && !allowTemporaryPassword) {
    return <Navigate to="/cambiar-password" replace />;
  }

  if (!hasRole(user, roles) || !hasPermission(user, permiso) || (soloColaborador && !esColaborador(user)) || (superAdmin && !user.esSuperAdmin)) {
    return <EmptyState title="Sin acceso" description="No tienes permiso para ver esta sección." />;
  }

  if (modulo) {
    if (contexto.isPending) return <FullScreenSpinner />;
    if (contexto.data?.modulos[modulo] !== true) {
      return <EmptyState title="No disponible" description="Tu empresa no tiene activado este módulo." />;
    }
  }

  return <>{children}</>;
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-brand-600">
      <Spinner className="size-8" />
    </div>
  );
}
