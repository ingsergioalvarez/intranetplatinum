import { useMutation } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Button, Modal, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { authService } from '../../core/auth/AuthService';
import { useAuthStore } from '../../core/auth/authStore';
import { useOfertaPerfil } from '../../core/auth/ofertaPerfil';

/**
 * Admin, supervisor y cliente deciden si este celular recuerda su perfil (A-40). Con la cuenta guardada,
 * quien tenga el celular y el PIN puede entrar: por eso se pregunta, y solo conviene guardarla en un
 * celular personal.
 */
export function OfertaPerfil() {
  const { pendiente, cerrar } = useOfertaPerfil();
  const user = useAuthStore((s) => s.user);

  const guardar = useMutation({
    mutationFn: () => authService.guardarPerfilEnEsteCelular(),
    onSuccess: () => {
      toast.success('Perfil guardado. Crea tu PIN en Acceso rápido para entrar más rápido.');
      cerrar();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  if (!user) return null;
  return (
    <Modal
      open={pendiente}
      onClose={cerrar}
      title="¿Guardar tu perfil en este celular?"
      size="sm"
      cerrable={false}
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardar.isPending}>
            No, solo esta vez
          </Button>
          <Button onClick={() => guardar.mutate()} loading={guardar.isPending}>
            Sí, guardar mi perfil
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Hazlo <strong>solo si es tu celular personal</strong>. Si no lo es, quien tenga este teléfono y tu
            PIN podría entrar a tu cuenta.
          </span>
        </p>
        <p>
          Si guardas tu perfil, la próxima vez entrarás tocando tu nombre y escribiendo tu PIN de 4 dígitos.
          Si no, entrarás con correo y contraseña. Puedes cambiarlo cuando quieras en Acceso rápido.
        </p>
      </div>
    </Modal>
  );
}
