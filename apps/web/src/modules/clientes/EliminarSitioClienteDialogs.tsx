import type { HistorialCliente, HistorialSitio } from '@platinum/shared';
import { EliminarDefinitivoDialog } from '../shared/EliminarDefinitivoDialog';

const ETIQUETAS_SITIO: Record<keyof HistorialSitio, [string, string]> = {
  asignaciones: ['asignación de guardias', 'asignaciones de guardias'],
  marcas: ['checada de asistencia (con sus fotos)', 'checadas de asistencia (con sus fotos)'],
  coberturas: ['cobertura', 'coberturas'],
};

/** Eliminación definitiva de un sitio con su historial (solo admin, DA-50). */
export function EliminarSitioDialog({
  sitio,
  onCancel,
  onEliminado,
}: {
  sitio: { id: number; nombre: string };
  onCancel: () => void;
  onEliminado: () => void;
}) {
  return (
    <EliminarDefinitivoDialog<HistorialSitio>
      nombre={sitio.nombre}
      claveHistorial={['admin', 'sitio', sitio.id]}
      historialUrl={`/admin/sitios/${sitio.id}/historial`}
      eliminarUrl={`/admin/sitios/${sitio.id}`}
      etiquetas={ETIQUETAS_SITIO}
      alternativa='Si dejó de atenderse pero quieres conservar su historial, usa "Dar de baja".'
      onCancel={onCancel}
      onEliminado={onEliminado}
    />
  );
}

const ETIQUETAS_CLIENTE: Record<keyof HistorialCliente, [string, string]> = {
  ...ETIQUETAS_SITIO,
  sitios: ['sitio', 'sitios'],
  contactos: ['contacto', 'contactos'],
};

/** Eliminación definitiva de un cliente con sus sitios y contactos (solo admin, DA-50). */
export function EliminarClienteDialog({
  cliente,
  onCancel,
  onEliminado,
}: {
  cliente: { id: number; nombre: string };
  onCancel: () => void;
  onEliminado: () => void;
}) {
  return (
    <EliminarDefinitivoDialog<HistorialCliente>
      nombre={cliente.nombre}
      claveHistorial={['admin', 'cliente', cliente.id]}
      historialUrl={`/admin/clientes/${cliente.id}/historial`}
      eliminarUrl={`/admin/clientes/${cliente.id}`}
      etiquetas={ETIQUETAS_CLIENTE}
      alternativa='Si dejó de ser cliente pero quieres conservar su historial, usa "Dar de baja".'
      onCancel={onCancel}
      onEliminado={onEliminado}
    />
  );
}
