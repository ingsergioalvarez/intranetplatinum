import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2, TriangleAlert } from 'lucide-react';
import { api } from '../../core/api';
import { Button, FormField, Input, Modal, Spinner, toast } from '../../components/ui';

const CONFIRMACION = 'ELIMINAR';

/**
 * Eliminación definitiva (solo admin): muestra qué se borraría junto con el elemento y pide escribir
 * ELIMINAR. Pensado para limpiar pruebas o errores de captura; para algo real se usa "Dar de baja".
 * `historialUrl` devuelve un objeto con contadores y `etiquetas` los nombra (singular / plural).
 */
export function EliminarDefinitivoDialog<H extends object>({
  nombre,
  claveHistorial,
  historialUrl,
  eliminarUrl,
  etiquetas,
  alternativa,
  nota,
  onCancel,
  onEliminado,
}: {
  nombre: string;
  claveHistorial: readonly unknown[];
  historialUrl: string;
  eliminarUrl: string;
  etiquetas: Record<keyof H, [string, string]>;
  /** Qué usar si es algo real, p. ej. 'Para personal real usa "Dar de baja".' */
  alternativa: string;
  /** Aviso adicional sobre lo que NO se borra. */
  nota?: (historial: H) => ReactNode;
  onCancel: () => void;
  onEliminado: () => void;
}) {
  const [texto, setTexto] = useState('');
  const historial = useQuery({
    queryKey: [...claveHistorial, 'historial'],
    queryFn: () => api.get<H>(historialUrl),
  });
  const eliminar = useMutation({
    mutationFn: () => api.delete(eliminarUrl),
    onSuccess: () => {
      toast.success(`${nombre} se eliminó definitivamente`);
      onEliminado();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'),
  });

  const conHistorial = historial.data
    ? (Object.entries(historial.data) as [keyof H, number][]).filter(
        ([clave, n]) => n > 0 && clave in etiquetas,
      )
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
            Se borrará <strong>{nombre}</strong> y todo su historial. <strong>No se puede deshacer.</strong>{' '}
            {alternativa}
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
                <li key={String(clave)}>
                  {n} {etiquetas[clave][n === 1 ? 0 : 1]}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-slate-600">No tiene historial.</p>
        )}
        {historial.data && nota?.(historial.data)}
        <FormField label={`Escribe ${CONFIRMACION} para confirmar`}>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </FormField>
      </div>
    </Modal>
  );
}
