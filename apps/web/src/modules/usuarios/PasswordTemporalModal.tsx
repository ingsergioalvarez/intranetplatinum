import { Copy, MessageCircle, TriangleAlert } from 'lucide-react';
import type { Usuario } from '@platinum/shared';
import { Button, Modal, toast } from '../../components/ui';

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
  }
}

/**
 * Muestra la contraseña temporal una sola vez (D-012) para entregarla al usuario,
 * por ejemplo por WhatsApp. Al cerrar ya no se puede volver a consultar.
 */
export function PasswordTemporalModal({
  resultado,
  titulo,
  onClose,
}: {
  resultado: { usuario: Pick<Usuario, 'nombre' | 'email'>; passwordTemporal: string } | null;
  titulo: string;
  onClose: () => void;
}) {
  if (!resultado) return null;
  const { usuario, passwordTemporal } = resultado;
  const url = window.location.origin;
  const mensaje =
    `Hola ${usuario.nombre}, tu acceso a Platinum Intranet:\n` +
    `Página: ${url}\nCorreo: ${usuario.email}\nContraseña temporal: ${passwordTemporal}\n` +
    `Al entrar te pedirá crear una contraseña nueva.`;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={false}
      size="sm"
      title={titulo}
      description={`${usuario.nombre} · ${usuario.email}`}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Contraseña temporal</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code
              className="flex-1 select-all rounded-lg bg-slate-100 px-3 py-2.5 text-center font-mono text-lg tracking-wider text-slate-900"
              aria-label="Contraseña temporal"
            >
              {passwordTemporal}
            </code>
            <Button
              variant="secondary"
              onClick={() => void copiar(passwordTemporal, 'Contraseña copiada')}
              aria-label="Copiar contraseña"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>

        <Button
          variant="secondary"
          fullWidth
          icon={<MessageCircle className="size-4" />}
          onClick={() => void copiar(mensaje, 'Mensaje copiado, pégalo en WhatsApp')}
        >
          Copiar mensaje para enviar
        </Button>

        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Esta contraseña solo se muestra ahora. Al entrar, el usuario deberá crear una nueva.
        </p>
      </div>
    </Modal>
  );
}
