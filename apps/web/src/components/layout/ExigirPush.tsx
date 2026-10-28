import { BellRing, LogOut } from 'lucide-react';
import { authService } from '../../core/auth/AuthService';
import { usePush } from '../../core/push/usePush';
import { Button, Modal, toast } from '../ui';

/**
 * Las notificaciones push son obligatorias (A-20): mientras este celular no las tenga activas, la app
 * pide activarlas y no deja seguir. No hay forma de apagarlas desde la app. Si el navegador o el
 * servidor no las admiten (`no_disponible`) no se pide nada.
 */
export function ExigirPush() {
  const { estado, trabajando, activar, revisar } = usePush();
  const pendiente = estado === 'apagado' || estado === 'bloqueado';

  return (
    <Modal
      open={pendiente}
      onClose={() => undefined}
      cerrable={false}
      dismissible={false}
      size="sm"
      title="Activa las notificaciones"
      footer={
        <>
          <Button variant="ghost" icon={<LogOut className="size-4" />} onClick={() => void authService.logout()}>
            Cerrar sesión
          </Button>
          {estado === 'bloqueado' ? (
            <Button onClick={() => void revisar()}>Ya las permití</Button>
          ) : (
            <Button
              icon={<BellRing className="size-4" />}
              loading={trabajando}
              onClick={() =>
                void activar().then((error) => {
                  if (error) toast.error(error);
                })
              }
            >
              Activar notificaciones
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Es obligatorio para usar la app: así te llegan los avisos de tu turno, aunque la app esté cerrada o el
        teléfono bloqueado.
      </p>
      {estado === 'bloqueado' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Las notificaciones están bloqueadas en este navegador.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Toca el candado (o los tres puntos) junto a la dirección de la página.</li>
            <li>Entra a Permisos y elige Notificaciones.</li>
            <li>Cámbialas a Permitir y regresa aquí.</li>
          </ol>
        </div>
      )}
    </Modal>
  );
}
