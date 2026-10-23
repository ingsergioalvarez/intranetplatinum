import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2, TriangleAlert } from 'lucide-react';
import type { HistorialUsuario } from '@platinum/shared';
import { api } from '../../core/api';
import { Button, FormField, Input, Modal, Spinner, toast } from '../../components/ui';

const CONFIRMACION = 'ELIMINAR';

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
  const [texto, setTexto] = useState('');
  const historial = useQuery({
    queryKey: ['admin', 'historial', usuario.id],
    queryFn: () => api.get<HistorialUsuario>(`/admin/usuarios/${usuario.id}/historial`),
  });
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/admin/usuarios/${usuario.id}`),
    onSuccess: () => {
      toast.success(`${usuario.nombre} se eliminó definitivamente`);
      onEliminado();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'),
  });

  const conHistorial = historial.data
    ? (Object.entries(historial.data) as [keyof HistorialUsuario, number][]).filter(([, n]) => n > 0)
    : [];

  return (
    <Modal
      open
      onClose={eliminar.isPending ? () => undefined : onCancel}
      size="sm"
      title="Eliminar definitivamente"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={eliminar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" />}
            disabled={texto.trim().toUpperCase() !== CONFIRMACION}
            loading={eliminar.isPending}
            onClick={() => eliminar.mutate()}
          >
            Eliminar
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="flex gap-2 rounded-lg bg-red-50 p-3 text-red-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Se borrará <strong>{usuario.nombre}</strong> y todo su historial.{' '}
            <strong>No se puede deshacer.</strong> Para personal real usa "Dar de baja".
          </span>
        </p>
        {historial.isPending ? (
          <div className="flex justify-center py-2 text-brand-600">
            <Spinner className="size-5" />
          </div>
        ) : conHistorial.length > 0 ? (
          <div>
            <p className="font-medium text-slate-800">También se borrará:</p>
            <ul className="mt-1 list-inside list-disc text-slate-600">
              {conHistorial.map(([clave, n]) => (
                <li key={clave}>
                  {n} {ETIQUETAS[clave][n === 1 ? 0 : 1]}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-slate-600">No tiene historial.</p>
        )}
        <FormField label={`Escribe ${CONFIRMACION} para confirmar`}>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </FormField>
      </div>
    </Modal>
  );
}
