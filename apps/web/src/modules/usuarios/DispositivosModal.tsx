import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import type { Usuario } from '@platinum/shared';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  toast,
} from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { dispositivosService } from '../auth/dispositivos.service';

/**
 * Celulares con perfil rápido de un guardia (A-40). Solo el admin los ve y los quita (p. ej. si el
 * guardia perdió el celular). Queda en la auditoría.
 */
export function DispositivosModal({ guardia, onClose }: { guardia: Usuario; onClose: () => void }) {
  const qc = useQueryClient();
  const [quitando, setQuitando] = useState<number | 'todos' | null>(null);

  const lista = useQuery({
    queryKey: dispositivosService.keys.de(guardia.id),
    queryFn: () => dispositivosService.de(guardia.id),
  });

  const quitar = useMutation({
    mutationFn: (que: number | 'todos') =>
      que === 'todos'
        ? dispositivosService.quitarTodosDe(guardia.id).then(() => undefined)
        : dispositivosService.quitarDe(guardia.id, que),
    onSuccess: () => {
      toast.success('Listo: el celular ya no puede entrar con perfil rápido');
      setQuitando(null);
      void qc.invalidateQueries({ queryKey: dispositivosService.keys.de(guardia.id) });
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Celulares con acceso rápido"
      description={guardia.nombre}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {!!lista.data?.length && (
            <Button variant="danger" onClick={() => setQuitando('todos')}>
              Quitar todos
            </Button>
          )}
        </>
      }
    >
      {lista.isPending ? (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : lista.isError ? (
        <EmptyState title="No se pudo cargar" description="Revisa tu conexión." />
      ) : lista.data.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="size-10" />}
          title="Sin celulares"
          description="Este guardia no tiene perfil rápido en ningún celular."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <Smartphone className="size-5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-900">
                  {d.etiqueta}
                  {d.bloqueado && <Badge tone="danger">PIN bloqueado</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {d.tienePin ? 'Con PIN' : 'Sin PIN'}
                  {d.ultimoUso ? ` · Último uso ${formatFechaHora(d.ultimoUso)}` : ' · Sin uso'}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setQuitando(d.id)}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={quitando !== null}
        title={quitando === 'todos' ? 'Quitar todos los celulares' : 'Quitar este celular'}
        description={`${guardia.nombre} tendrá que entrar con su correo y contraseña ${
          quitando === 'todos' ? 'en cualquier celular' : 'en ese celular'
        }.`}
        confirmLabel="Quitar"
        variant="danger"
        loading={quitar.isPending}
        onConfirm={() => quitando !== null && quitar.mutate(quitando)}
        onCancel={() => setQuitando(null)}
      />
    </Modal>
  );
}
