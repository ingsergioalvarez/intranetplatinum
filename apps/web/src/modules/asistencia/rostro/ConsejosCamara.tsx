import { useState } from 'react';
import { Camera, Glasses, Lightbulb, UserRoundX } from 'lucide-react';
import { Button, Checkbox, Modal } from '../../../components/ui';
import { CONSEJOS_CAMARA, ocultarConsejos } from './consejos';
import { GuiaTelefono } from './GuiaTelefono';
import { pedirSensorInclinacion } from './inclinacion';

const ICONOS = [Glasses, UserRoundX, Lightbulb];

/** Lista de consejos para una buena foto; se reutiliza dentro de otros modales. */
export function ListaConsejos() {
  return (
    <ul className="space-y-3">
      {CONSEJOS_CAMARA.map((texto, i) => {
        const Icono = ICONOS[i];
        return (
          <li key={texto} className="flex items-center gap-3 text-slate-700">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icono className="size-5" />
            </span>
            {texto}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Ventana previa a la cámara del guardia con consejos para que el reconocimiento sea preciso.
 * Con "No volver a mostrar" no vuelve a salir en ese celular.
 */
export function ConsejosCamara({
  onCancelar,
  onContinuar,
}: {
  onCancelar: () => void;
  onContinuar: () => void;
}) {
  const [noMostrar, setNoMostrar] = useState(false);
  return (
    <Modal
      open
      onClose={onCancelar}
      size="sm"
      title="Antes de abrir la cámara"
      description="Sostén el teléfono así para que te reconozca a la primera:"
      footer={
        <>
          <Button variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            icon={<Camera className="size-4" />}
            onClick={() => {
              if (noMostrar) ocultarConsejos();
              pedirSensorInclinacion();
              onContinuar();
            }}
          >
            Entendido, abrir cámara
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <GuiaTelefono />
        <ListaConsejos />
        <Checkbox
          label="No volver a mostrar"
          checked={noMostrar}
          onChange={(e) => setNoMostrar(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
