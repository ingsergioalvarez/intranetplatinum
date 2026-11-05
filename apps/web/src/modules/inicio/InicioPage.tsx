import { Navigate } from 'react-router-dom';
import { ROLES } from '@platinum/shared';
import { useAuthStore } from '../../core/auth/authStore';
import { TableroPage } from './TableroPage';

/** Inicio según el rol (DA-51): el guardia entra directo al Checador; admin, jefe y supervisor ven el tablero del día. */
export function InicioPage() {
  const rol = useAuthStore((s) => s.user?.rol);
  if (rol === ROLES.GUARDIA) return <Navigate to="/marcar" replace />;
  return <TableroPage />;
}
