import type { HistorialUsuario } from '@platinum/shared';
import { EliminarDefinitivoDialog } from '../shared/EliminarDefinitivoDialog';

const ETIQUETAS: Record<keyof HistorialUsuario, [string, string]> = {
  marcas: ['marca de asistencia', 'marcas de asistencia'],
  rostros: ['rostro registrado', 'rostros registrados'],
  reportes: ['reporte', 'reportes'],
  seguimientos: ['seguimiento en reportes', 'seguimientos en reportes'],
  asignaciones: ['asignación a sitios', 'asignaciones a sitios'],
};

/**
 * Eliminación definitiva de un usuario con todo su historial (solo admin). Pensado para
 * limpiar cuentas de prueba; para personal real se usa "Dar de baja". Pide escribir ELIMINAR.
 */
export function EliminarUsuarioDialog({
  usuario,
  onCancel,
  onEliminado,
}: {
  usuario: { id: number; nombre: string };
  onCancel: () => void;
  onEliminado: () => void;
}) {
  return (
    <EliminarDefinitivoDialog<HistorialUsuario>
      nombre={usuario.nombre}
      claveHistorial={['admin', 'usuario', usuario.id]}
      historialUrl={`/admin/usuarios/${usuario.id}/historial`}
      eliminarUrl={`/admin/usuarios/${usuario.id}`}
      etiquetas={ETIQUETAS}
      alternativa='Para personal real usa "Dar de baja".'
      onCancel={onCancel}
      onEliminado={onEliminado}
    />
  );
}
