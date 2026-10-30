import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MOTIVOS_CANCELAR_PLAN,
  MOTIVO_CANCELAR_PLAN_LABEL,
  cancelarPlanSchema,
  type CasoCobertura,
  type MotivoCancelarPlan,
} from '@platinum/shared';
import { FormField, FormModal, Select, Textarea, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { casosService } from './casos.service';

/**
 * Cancelar un plan confirmado (A-45): pide el motivo, explica qué se deshace y deja el caso otra vez
 * "sin decidir" para que el supervisor defina uno nuevo.
 */
export function CancelarPlanModal({ caso, onClose }: { caso: CasoCobertura; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState<MotivoCancelarPlan | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const cancelar = useMutation({
    mutationFn: () =>
      casosService.cancelar(caso.entradaId, {
        motivo: motivo as MotivoCancelarPlan,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: casosService.keys.all });
      void qc.invalidateQueries({ queryKey: ['cobertura'] });
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra'] });
      toast.success('Plan cancelado: el caso quedó sin decidir y avisamos al guardia que siga en su puesto');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = cancelarPlanSchema.safeParse({ motivo: motivo || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    cancelar.mutate();
  };

  return (
    <FormModal
      title="¿Cancelar el plan?"
      description={`${caso.guardia.nombre} · ${caso.sitio.nombre}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Sí, cancelar plan"
      loading={cancelar.isPending}
      dirty={!!motivo || !!nota}
      size="sm"
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Se cancelan las coberturas que creó el plan y se quitan los descansos en pausa.</li>
        <li>El caso vuelve a &quot;Sin decidir&quot; para que definas uno nuevo.</li>
        <li>Se avisa al guardia que siga en su puesto. El motivo queda en su bitácora.</li>
      </ul>
      <FormField label="Motivo" required error={errores.motivo}>
        <Select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoCancelarPlan | '')}
          placeholder="Elige el motivo"
          options={MOTIVOS_CANCELAR_PLAN.map((m) => ({ value: m, label: MOTIVO_CANCELAR_PLAN_LABEL[m] }))}
        />
      </FormField>
      <FormField
        label={motivo === 'otro' ? 'Explica el motivo' : 'Detalle (opcional)'}
        required={motivo === 'otro'}
        error={errores.nota}
      >
        <Textarea rows={2} maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} />
      </FormField>
    </FormModal>
  );
}
