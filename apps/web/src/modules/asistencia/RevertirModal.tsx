import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MOTIVOS_REVERTIR,
  MOTIVO_REVERTIR_LABEL,
  revertirDecisionSchema,
  type EventoBitacora,
  type MotivoRevertir,
} from '@platinum/shared';
import { FormModal, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { asistenciaService } from './asistencia.service';
import { MotivoLista } from './MotivoLista';

/**
 * Revertir una decisión ya tomada (A-52, solo admin): quita la justificación o la decisión y el evento
 * vuelve a quedar sin atender. Queda una nota en el evento y en la auditoría.
 */
export function RevertirModal({ evento, onClose }: { evento: EventoBitacora; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<MotivoRevertir | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const revertir = useMutation({
    mutationFn: () =>
      asistenciaService.revertirDecision(evento.id, {
        categoria: categoria as MotivoRevertir,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success('Decisión revertida: el evento volvió a quedar sin atender');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = revertirDecisionSchema.safeParse({ categoria: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    revertir.mutate();
  };

  return (
    <FormModal
      title="Revertir decisión"
      description={evento.detalle}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Revertir"
      loading={revertir.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>El evento vuelve a &quot;Sin atender&quot; para que el supervisor lo decida de nuevo.</li>
        <li>Queda una nota con tu motivo y el registro en la auditoría.</li>
        <li>Si se aplicó una medida disciplinaria, se queda en el historial del guardia.</li>
      </ul>
      <MotivoLista
        categorias={MOTIVOS_REVERTIR}
        etiquetas={MOTIVO_REVERTIR_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
    </FormModal>
  );
}
