import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS, ROLES } from '@platinum/shared';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AccesoRapidoPage } from '../modules/auth/AccesoRapidoPage';
import { MisGuardiasPage } from '../modules/guardias/MisGuardiasPage';
import { CambiarPasswordPage } from '../modules/auth/CambiarPasswordPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InicioPage } from '../modules/inicio/InicioPage';
import { MisSitiosPage } from '../modules/inicio/MisSitiosPage';
import { UsuariosPage } from '../modules/usuarios/UsuariosPage';
import { ClienteDetallePage } from '../modules/clientes/ClienteDetallePage';
import { AreasPage } from '../modules/areas/AreasPage';
import { ClientesPage } from '../modules/clientes/ClientesPage';
import { CategoriasPage } from '../modules/catalogos/CategoriasPage';
import { TurnosPage } from '../modules/catalogos/TurnosPage';
import { GruposPage } from '../modules/grupos/GruposPage';
import { NuevoReportePage } from '../modules/reportes/NuevoReportePage';
import { ReporteDetallePage } from '../modules/reportes/ReporteDetallePage';
import { ReportesPage } from '../modules/reportes/ReportesPage';
import { ReportesClientePage } from '../modules/reportes-cliente/ReportesClientePage';
import { NotFoundPage } from '../modules/shared/PendientePage';
import { AsistenciaGuardiaPage } from '../modules/asistencia/AsistenciaGuardiaPage';
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage';
import { RostrosPendientesPage } from '../modules/asistencia/RostrosPendientesPage';
import { IncidenciasPage } from '../modules/asistencia/IncidenciasPage';
import { MarcarPage } from '../modules/asistencia/MarcarPage';
import { CambiosTurnoPage } from '../modules/cambios/CambiosTurnoPage';
import { CasosPage } from '../modules/casos/CasosPage';
import { SolicitudesPage } from '../modules/solicitudes/SolicitudesPage';
import { CarterasPage } from '../modules/carteras/CarterasPage';
import { EmpresaDetallePage } from '../modules/plataforma/EmpresaDetallePage';
import { EmpresasPage } from '../modules/plataforma/EmpresasPage';
import { EmergenciasPage } from '../modules/emergencias/EmergenciasPage';
import { AusenciasPage } from '../modules/ausencias/AusenciasPage';
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
          <ProtectedRoute>
            <AccesoRapidoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'guardias',
        element: (
          <ProtectedRoute modulo="clientes" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.CLIENTE]}>
            <MisGuardiasPage />
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
          <ProtectedRoute modulo="bitacora" permiso={PERMISOS.ASISTENCIA_ROSTROS}>
            <IncidenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/cambios',
        element: (
          <ProtectedRoute modulo="cambios_turno" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CambiosTurnoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/casos',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CasosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/ausencias',
        element: (
          <ProtectedRoute modulo="ausencias" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <AusenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mis-ausencias',
        element: (
          <ProtectedRoute modulo="ausencias" permiso={PERMISOS.ASISTENCIA_MARCAR} roles={[ROLES.GUARDIA]}>
            <AusenciasPage propias />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/emergencias',
        element: (
          <ProtectedRoute modulo="emergencias" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <EmergenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/solicitudes',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <SolicitudesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/calendario',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <CalendarioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/horas-extra',
        element: (
          <ProtectedRoute modulo="horas_extra" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <HorasExtraPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes',
        element: (
          <ProtectedRoute modulo="reporte_asistencia" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <ReportesEmitidosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes/:id',
        element: (
          <ProtectedRoute modulo="reporte_asistencia" permiso={PERMISOS.ASISTENCIA_VER} roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
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
          <ProtectedRoute modulo="reportes" permiso={PERMISOS.REPORTES_VER_PROPIOS}>
            <ReportesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reportes/nuevo',
        element: (
          <ProtectedRoute modulo="reportes" permiso={PERMISOS.REPORTES_CREAR}>
            <NuevoReportePage />
          </ProtectedRoute>
        ),
      },
      // El servidor decide si puede verlo (todos / sus sitios).
      {
        path: 'reportes/:id',
        element: (
          <ProtectedRoute modulo="reportes">
            <ReporteDetallePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reportes-cliente',
        element: (
          <ProtectedRoute modulo="quejas" roles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CLIENTE]}>
            <ReportesClientePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'grupos',
        element: (
          <ProtectedRoute modulo="grupos" permiso={PERMISOS.GRUPOS_ADMINISTRAR}>
            <GruposPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catalogos/categorias',
        element: (
          <ProtectedRoute modulo="reportes" permiso={PERMISOS.CATALOGOS_ADMINISTRAR}>
            <CategoriasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catalogos/turnos',
        element: (
          <ProtectedRoute modulo="turnos" permiso={PERMISOS.CATALOGOS_ADMINISTRAR}>
            <TurnosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'areas',
        element: (
          <ProtectedRoute roles={[ROLES.ADMIN]}>
            <AreasPage />
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
        path: 'carteras',
        element: (
          <ProtectedRoute modulo="carteras" superAdmin>
            <CarterasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'plataforma/empresas',
        element: (
          <ProtectedRoute superAdmin>
            <EmpresasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'plataforma/empresas/:id',
        element: (
          <ProtectedRoute superAdmin>
            <EmpresaDetallePage />
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
