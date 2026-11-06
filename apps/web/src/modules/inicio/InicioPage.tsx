import { Navigate } from 'react-router-dom';
import { esColaborador, useAuthStore } from '../../core/auth/authStore';
import { TableroPage } from './TableroPage';

/** Inicio según el rol (DA-51): el guardia entra directo al Checador; admin, jefe y supervisor ven el tablero del día. */
export function InicioPage() {
  const colaborador = useAuthStore((s) => esColaborador(s.user));
  if (colaborador) return <Navigate to="/marcar" replace />;
  return <TableroPage />;
}
