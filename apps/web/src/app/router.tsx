import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS } from '@platinum/shared';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { CambiarPasswordPage } from '../modules/auth/CambiarPasswordPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InicioPage } from '../modules/inicio/InicioPage';
import { UiShowcasePage } from '../modules/dev/UiShowcasePage';
import { UsuariosPage } from '../modules/usuarios/UsuariosPage';
import { ClienteDetallePage } from '../modules/clientes/ClienteDetallePage';
import { ClientesPage } from '../modules/clientes/ClientesPage';
import { CategoriasPage } from '../modules/catalogos/CategoriasPage';
import { NuevoReportePage } from '../modules/reportes/NuevoReportePage';
import { ReporteDetallePage } from '../modules/reportes/ReporteDetallePage';
import { ReportesPage } from '../modules/reportes/ReportesPage';
import { NotFoundPage } from '../modules/shared/PendientePage';

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
            <ReportesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reportes/nuevo',
        element: (
          <ProtectedRoute permiso={PERMISOS.REPORTES_CREAR}>
            <NuevoReportePage />
          </ProtectedRoute>
        ),
      },
      // El servidor decide si puede verlo (todos / sus sitios).
      { path: 'reportes/:id', element: <ReporteDetallePage /> },
      {
        path: 'catalogos/categorias',
        element: (
          <ProtectedRoute permiso={PERMISOS.CATALOGOS_ADMINISTRAR}>
            <CategoriasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'clientes',
        element: (
          <ProtectedRoute permiso={PERMISOS.CLIENTES_VER}>
            <ClientesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'clientes/:id',
        element: (
          <ProtectedRoute permiso={PERMISOS.CLIENTES_VER}>
            <ClienteDetallePage />
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
