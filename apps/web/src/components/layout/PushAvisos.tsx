import { BellRing, BellOff } from 'lucide-react';
import type { usePush } from '../../core/push/usePush';
import { Button, toast } from '../ui';

/**
 * Interruptor de las notificaciones push de este celular (A-20), arriba de la bandeja de avisos.
 * Si el navegador o el servidor no las admiten, no se muestra nada.
 */
export function PushAvisos({ push: { estado, trabajando, activar, desactivar } }: { push: ReturnType<typeof usePush> }) {
  if (estado === 'cargando' || estado === 'no_disponible') return null;

  const avisoDeError = (error: string | null) => {
    if (error) toast.error(error);
  };

  if (estado === 'bloqueado') {
    return (
      <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        <BellOff className="mt-0.5 size-4 shrink-0" />
        Las notificaciones están bloqueadas en este navegador. Para recibirlas fuera de la app, permítelas en los
        permisos del sitio.
      </p>
    );
  }

  if (estado === 'activo') {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        <span className="flex items-center gap-2">
          <BellRing className="size-4 shrink-0" /> Recibes los avisos en este celular aunque la app esté cerrada.
        </span>
        <Button size="sm" variant="secondary" loading={trabajando} onClick={() => void desactivar().then(avisoDeError)}>
          Desactivar
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
      <span className="flex items-center gap-2">
        <BellRing className="size-4 shrink-0" /> Recibe los avisos en este celular aunque la app esté cerrada.
      </span>
      <Button size="sm" loading={trabajando} onClick={() => void activar().then(avisoDeError)}>
        Activar
      </Button>
    </div>
  );
}
