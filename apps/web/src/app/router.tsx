import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS, ROLES } from '@platinum/shared';
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
import { TurnosPage } from '../modules/catalogos/TurnosPage';
import { GruposPage } from '../modules/grupos/GruposPage';
import { NuevoReportePage } from '../modules/reportes/NuevoReportePage';
import { ReporteDetallePage } from '../modules/reportes/ReporteDetallePage';
import { ReportesPage } from '../modules/reportes/ReportesPage';
import { NotFoundPage } from '../modules/shared/PendientePage';
import { AsistenciaGuardiaPage } from '../modules/asistencia/AsistenciaGuardiaPage';
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage';
import { RostrosPendientesPage } from '../modules/asistencia/RostrosPendientesPage';
import { IncidenciasPage } from '../modules/asistencia/IncidenciasPage';
import { MarcarPage } from '../modules/asistencia/MarcarPage';
import { MisMarcasPage } from '../modules/asistencia/MisMarcasPage';

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
        path: 'marcar',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} roles={[ROLES.GUARDIA]}>
            <MarcarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER}>
            <AsistenciaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/rostros',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_ROSTROS}>
            <RostrosPendientesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/incidencias',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_ROSTROS}>
            <IncidenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/guardias/:id',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER}>
            <AsistenciaGuardiaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'marcar/historial',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} roles={[ROLES.GUARDIA]}>
            <MisMarcasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reportes',
        element: (
          <ProtectedRoute permiso={PERMISOS.REPORTES_VER_PROPIOS}>
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
        path: 'grupos',
        element: (
          <ProtectedRoute permiso={PERMISOS.GRUPOS_ADMINISTRAR}>
            <GruposPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catalogos/categorias',
        element: (
          <ProtectedRoute permiso={PERMISOS.CATALOGOS_ADMINISTRAR}>
            <CategoriasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catalogos/turnos',
        element: (
          <ProtectedRoute permiso={PERMISOS.CATALOGOS_ADMINISTRAR}>
            <TurnosPage />
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
