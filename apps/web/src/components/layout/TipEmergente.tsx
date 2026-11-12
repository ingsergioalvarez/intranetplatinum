import { Lightbulb } from 'lucide-react';
import { tipPorId } from '@platinum/shared';
import { Button, Modal } from '../ui';
import { useTipStore } from '../../core/tips/tipPendiente';

/**
 * Ventana con el tip completo (A-78): se abre al tocar la notificación de un tip, esté o no abierta la sesión. Un
 * enlace con un tip que ya no existe no muestra nada.
 */
export function TipEmergente() {
  const { id, cerrar } = useTipStore();
  const tip = id ? tipPorId(id) : undefined;
  return (
    <Modal
      open={!!tip}
      onClose={cerrar}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" aria-hidden /> {tip?.titulo}
        </span>
      }
      footer={<Button onClick={cerrar}>Entendido</Button>}
    >
      <p className="text-sm leading-relaxed text-slate-700">{tip?.texto}</p>
    </Modal>
  );
}
