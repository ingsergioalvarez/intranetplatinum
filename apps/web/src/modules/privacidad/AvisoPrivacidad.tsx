import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { AVISO_PRIVACIDAD, AVISO_PRIVACIDAD_ES_BORRADOR, AVISO_PRIVACIDAD_VERSION } from '@platinum/shared';
import { Badge, Button, Checkbox, Modal, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { alPedirAvisoPrivacidad } from './avisoPrivacidadEvento';
import { AvisoPrivacidadTexto } from './AvisoPrivacidadTexto';
import { privacidadService } from './privacidad.service';
import { useAvisoPrivacidad } from './useAvisoPrivacidad';

/** Tras "Ahora no" vuelve a salir pasado este tiempo (o al refrescar la página). */
const VUELVE_A_SALIR_MS = 30 * 60_000;

/**
 * Aviso de privacidad por el uso del rostro (A-68). Le sale al guardia que aún no acepta la versión vigente, antes
 * de registrar su rostro o de checar. "Ahora no" la oculta 30 minutos; mientras no acepte, el Checador queda
 * bloqueado (y el servidor rechaza la checada). Si ya había aceptado una versión anterior, no se le bloquea nada.
 */
export function AvisoPrivacidad() {
  const { pendiente, estado } = useAvisoPrivacidad();
  const qc = useQueryClient();
  const [cerrada, setCerrada] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [acepto, setAcepto] = useState(false);

  // Desde el aviso del Checador.
  useEffect(() => alPedirAvisoPrivacidad(() => setCerrada(false)), []);
  // Tras "Ahora no" vuelve a salir pasado un rato.
  useEffect(() => {
    if (!cerrada) return;
    const t = setTimeout(() => setCerrada(false), VUELVE_A_SALIR_MS);
    return () => clearTimeout(t);
  }, [cerrada]);

  const aceptar = useMutation({
    mutationFn: () => privacidadService.aceptar(AVISO_PRIVACIDAD_VERSION),
    onSuccess: (nuevo) => {
      qc.setQueryData(privacidadService.keys.estado, nuevo);
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      toast.success('Gracias, quedó registrado');
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  if (!pendiente || cerrada) return null;
  const cambio = estado.data?.aceptada === true;

  return (
    <Modal
      open
      onClose={() => setCerrada(true)}
      size="md"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Aviso de privacidad
          {AVISO_PRIVACIDAD_ES_BORRADOR && <Badge tone="warning">Borrador</Badge>}
        </span>
      }
      description={
        cambio
          ? 'El aviso cambió. Léelo y acéptalo cuando puedas; mientras tanto puedes seguir checando.'
          : 'Para checar usamos tu rostro. Léelo y acéptalo para poder checar.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setCerrada(true)}>
            Ahora no
          </Button>
          <Button
            icon={<ShieldCheck className="size-4" />}
            disabled={!acepto}
            loading={aceptar.isPending}
            onClick={() => aceptar.mutate()}
          >
            Aceptar y continuar
          </Button>
        </>
      }
    >
      <p className="text-sm font-medium text-slate-900">En corto:</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {AVISO_PRIVACIDAD.resumen.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setCompleto((v) => !v)}
        aria-expanded={completo}
        className="mt-4 flex h-11 w-full items-center justify-between rounded-lg bg-slate-50 px-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-slate-200 active:bg-slate-100"
      >
        {completo ? 'Ocultar el aviso completo' : 'Leer el aviso completo'}
        <ChevronDown className={`size-4 transition-transform ${completo ? 'rotate-180' : ''}`} />
      </button>
      {completo && (
        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-200 p-3">
          <AvisoPrivacidadTexto />
        </div>
      )}

      <Checkbox
        className="mt-3"
        checked={acepto}
        onChange={(e) => setAcepto(e.target.checked)}
        label="Leí el aviso de privacidad y acepto el uso de mi rostro para checar mi asistencia"
      />
    </Modal>
  );
}
