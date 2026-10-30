import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MOTIVOS_FALTA,
  MOTIVO_FALTA_LABEL,
  confirmarFaltaSchema,
  type EventoBitacora,
  type MotivoFalta,
  type OpcionMedida,
} from '@platinum/shared';
import { FormModal, toast } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { asistenciaService } from './asistencia.service';
import { MedidaCampo } from './MedidaCampo';
import { MotivoLista } from './MotivoLista';

/**
 * Confirmar una falta (A-48): lo contrario de justificarla. Cuenta como falta; el motivo es obligatorio
 * y se puede aplicar una medida disciplinaria.
 */
export function ConfirmarFaltaModal({ evento, onClose }: { evento: EventoBitacora; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<MotivoFalta | ''>('');
  const [nota, setNota] = useState('');
  const [medida, setMedida] = useState<OpcionMedida>('ninguna');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const confirmar = useMutation({
    mutationFn: () =>
      asistenciaService.confirmarFalta(evento.id, {
        categoria: categoria as MotivoFalta,
        nota: nota.trim() || undefined,
        medida,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success(medida === 'ninguna' ? 'Falta confirmada' : 'Falta confirmada y medida aplicada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = confirmarFaltaSchema.safeParse({ categoria: categoria || undefined, nota: nota.trim() || undefined, medida });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    confirmar.mutate();
  };

  return (
    <FormModal
      title="Confirmar falta"
      description={evento.detalle}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Confirmar falta"
      loading={confirmar.isPending}
      dirty={!!categoria || !!nota || medida !== 'ninguna'}
      size="sm"
    >
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Cuenta como falta en el resumen y en los reportes. Queda en la bitácora con el motivo.
      </p>
      <MotivoLista
        categorias={MOTIVOS_FALTA}
        etiquetas={MOTIVO_FALTA_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
      />
      <MedidaCampo value={medida} onChange={setMedida} />
    </FormModal>
  );
}
