import { createBrowserRouter } from 'react-router-dom';
import { PERMISOS } from '@platinum/shared';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AccesoRapidoPage } from '../modules/auth/AccesoRapidoPage';
import { CambiarPasswordPage } from '../modules/auth/CambiarPasswordPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InicioPage } from '../modules/inicio/InicioPage';
import { MisSitiosPage } from '../modules/inicio/MisSitiosPage';
import { UsuariosPage } from '../modules/usuarios/UsuariosPage';
import { ClienteDetallePage } from '../modules/clientes/ClienteDetallePage';
import { AreasPage } from '../modules/areas/AreasPage';
import { ClientesPage } from '../modules/clientes/ClientesPage';
import { TurnosPage } from '../modules/catalogos/TurnosPage';
import { GruposPage } from '../modules/grupos/GruposPage';
import { NotFoundPage } from '../modules/shared/PendientePage';
import { AsistenciaGuardiaPage } from '../modules/asistencia/AsistenciaGuardiaPage';
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage';
import { RostrosPendientesPage } from '../modules/asistencia/RostrosPendientesPage';
import { IncidenciasPage } from '../modules/asistencia/IncidenciasPage';
import { MarcarPage } from '../modules/asistencia/MarcarPage';
import { CambiosTurnoPage } from '../modules/cambios/CambiosTurnoPage';
import { CasosPage } from '../modules/casos/CasosPage';
import { SolicitudesPage } from '../modules/solicitudes/SolicitudesPage';
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
        path: 'mis-sitios',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} soloColaborador>
            <MisSitiosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'marcar',
        element: (
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} soloColaborador>
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
          <ProtectedRoute modulo="cambios_turno" permiso={PERMISOS.CAMBIOS_RESOLVER}>
            <CambiosTurnoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/casos',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.COBERTURA_ASIGNAR}>
            <CasosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/ausencias',
        element: (
          <ProtectedRoute modulo="ausencias" permiso={PERMISOS.AUSENCIAS_RESOLVER}>
            <AusenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mis-ausencias',
        element: (
          <ProtectedRoute modulo="ausencias" permiso={PERMISOS.AUSENCIAS_PEDIR} soloColaborador>
            <AusenciasPage propias />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/emergencias',
        element: (
          <ProtectedRoute modulo="emergencias" permiso={PERMISOS.EMERGENCIAS_ATENDER}>
            <EmergenciasPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/solicitudes',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.COBERTURA_ASIGNAR}>
            <SolicitudesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/calendario',
        element: (
          <ProtectedRoute modulo="cobertura" permiso={PERMISOS.COBERTURA_VER}>
            <CalendarioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/horas-extra',
        element: (
          <ProtectedRoute modulo="horas_extra" permiso={PERMISOS.HORAS_EXTRA_RESOLVER}>
            <HorasExtraPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes',
        element: (
          <ProtectedRoute modulo="reporte_asistencia" permiso={PERMISOS.INFORMES_VER}>
            <ReportesEmitidosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'asistencia/reportes/:id',
        element: (
          <ProtectedRoute modulo="reporte_asistencia" permiso={PERMISOS.INFORMES_VER}>
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
          <ProtectedRoute permiso={PERMISOS.ASISTENCIA_MARCAR} soloColaborador>
            <MisMarcasPage />
          </ProtectedRoute>
        ),
      },
      // El servidor decide si puede verlo (todos / sus sitios).
      {
        path: 'grupos',
        element: (
          <ProtectedRoute modulo="grupos" permiso={PERMISOS.GRUPOS_ADMINISTRAR}>
            <GruposPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catalogos/turnos',
        element: (
          <ProtectedRoute modulo="turnos" permiso={PERMISOS.TURNOS_ADMINISTRAR}>
            <TurnosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'areas',
        element: (
          <ProtectedRoute permiso={PERMISOS.AREAS_VER}>
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
