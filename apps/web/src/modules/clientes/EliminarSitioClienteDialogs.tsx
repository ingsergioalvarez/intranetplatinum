import { TriangleAlert } from 'lucide-react';
import type { HistorialCliente, HistorialSitio } from '@platinum/shared';
import { EliminarDefinitivoDialog } from '../shared/EliminarDefinitivoDialog';

const ETIQUETAS_SITIO: Record<keyof HistorialSitio, [string, string]> = {
  asignaciones: ['asignación de guardias', 'asignaciones de guardias'],
  marcas: ['checada de asistencia (con sus fotos)', 'checadas de asistencia (con sus fotos)'],
  reportes: ['reporte (con seguimientos y fotos)', 'reportes (con seguimientos y fotos)'],
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
  // Los usuarios del portal no se borran: se avisa aparte.
  usuariosPortal: ['usuario del portal', 'usuarios del portal'],
};

/** Eliminación definitiva de un cliente con sus sitios, reportes y contactos (solo admin, DA-50). */
export function EliminarClienteDialog({
  cliente,
  onCancel,
  onEliminado,
}: {
  cliente: { id: number; nombre: string };
  onCancel: () => void;
  onEliminado: () => void;
}) {
  // Los usuarios del portal no se borran, así que no van en la lista de lo que se borra.
  const { usuariosPortal: _u, ...etiquetas } = ETIQUETAS_CLIENTE;
  return (
    <EliminarDefinitivoDialog<HistorialCliente>
      nombre={cliente.nombre}
      claveHistorial={['admin', 'cliente', cliente.id]}
      historialUrl={`/admin/clientes/${cliente.id}/historial`}
      eliminarUrl={`/admin/clientes/${cliente.id}`}
      etiquetas={etiquetas as Record<keyof HistorialCliente, [string, string]>}
      alternativa='Si dejó de ser cliente pero quieres conservar su historial, usa "Dar de baja".'
      nota={(h) =>
        h.usuariosPortal > 0 && (
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {h.usuariosPortal === 1
                ? '1 usuario del portal no se borra, pero queda sin cliente'
                : `${h.usuariosPortal} usuarios del portal no se borran, pero quedan sin cliente`}
              : dalos de baja si ya no deben entrar.
            </span>
          </p>
        )
      }
      onCancel={onCancel}
      onEliminado={onEliminado}
    />
  );
}
