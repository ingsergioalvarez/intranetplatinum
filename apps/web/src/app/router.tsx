import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS } from '@platinum/shared';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { CambiarPasswordPage } from '../modules/auth/CambiarPasswordPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InicioPage } from '../modules/inicio/InicioPage';
import { UiShowcasePage } from '../modules/dev/UiShowcasePage';
import { UsuariosPage } from '../modules/usuarios/UsuariosPage';
import { NotFoundPage, PendientePage } from '../modules/shared/PendientePage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/cambiar-password',
    element: (
      <ProtectedRoute allowTemporaryPassword>
        <CambiarPasswordPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <InicioPage /> },
      {
        path: 'reportes',
        element: (
          <ProtectedRoute permiso={PERMISOS.REPORTES_CREAR}>
            <PendientePage title="Reportes" tareas="F3-01 a F3-08" />
          </ProtectedRoute>
        ),
      },
      {
        path: 'clientes',
        element: (
          <ProtectedRoute permiso={PERMISOS.CLIENTES_VER}>
            <PendientePage title="Clientes" tareas="F2-01 a F2-05" />
          </ProtectedRoute>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <ProtectedRoute permiso={PERMISOS.USUARIOS_VER}>
            <UsuariosPage />
          </ProtectedRoute>
        ),
      },
      ...(import.meta.env.DEV ? [{ path: 'ui', element: <UiShowcasePage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
