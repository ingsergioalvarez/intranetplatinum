import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS, ROLES } from '@platinum/shared';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AccesoRapidoPage } from '../modules/auth/AccesoRapidoPage';
import { CambiarPasswordPage } from '../modules/auth/CambiarPasswordPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InicioPage } from '../modules/inicio/InicioPage';
import { MisSitiosPage } from '../modules/inicio/MisSitiosPage';
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
import { CambiosTurnoPage } from '../modules/cambios/CambiosTurnoPage';
import { CasosPage } from '../modules/casos/CasosPage';
import { CalendarioPage } from '../modules/cobertura/CalendarioPage';
import { HorasExtraPage } from '../modules/horas-extra/HorasExtraPage';
import { InformeVerPage } from '../modules/informes/InformeVerPage';
import { ReportesEmitidosPage } from '../modules/informes/ReportesEmitidosPage';
import { VerificarInformePage } from '../modules/informes/VerificarInformePage';
import { MisMarcasPage } from '../modules/asistencia/MisMarcasPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Pública: la abre el QR del reporte de asistencia (DA-52).
  { path: '/verificar/:folio', element: <VerificarInformePage /> },
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
        path: 'acceso-rapido',
        element: (
          <ProtectedRoute roles={[ROLES.GUARDIA]}>
            <AccesoRapidoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mis-sitios',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} roles={[ROLES.GUARDIA]}>
            <MisSitiosPage />
          </ProtectedRoute>
        ),
      },
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
        path: 'asistencia/cambios',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CambiosTurnoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/casos',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CasosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/calendario',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CalendarioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/horas-extra',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <HorasExtraPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <ReportesEmitidosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes/:id',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <InformeVerPage />
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
