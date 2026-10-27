import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { capturaHoraExtraSchema } from '@platinum/shared';
import { FormField, FormModal, Input, Select, Textarea, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import { horasExtraService } from './horasExtra.service';

/**
 * Captura manual de horas extra (AS5-04): el supervisor o el admin registran las de un guardia
 * (por ejemplo, si no abrió la app). Quedan aprobadas, con motivo, en la bitácora y avisan al guardia.
 */
export function CapturaHorasModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [guardiaId, setGuardiaId] = useState('');
  const [sitioId, setSitioId] = useState('');
  const [fecha, setFecha] = useState(hoyLocal());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const opciones = useQuery({ queryKey: horasExtraService.keys.opciones, queryFn: horasExtraService.opciones });

  const capturar = useMutation({
    mutationFn: horasExtraService.capturar,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: horasExtraService.keys.all });
      toast.success('Horas extra registradas');
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors as Record<string, string>);
      else toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const entrada = {
      guardiaId: guardiaId ? Number(guardiaId) : undefined,
      sitioId: sitioId ? Number(sitioId) : null,
      fecha,
      desde,
      hasta,
      motivo,
    };
    const r = capturaHoraExtraSchema.safeParse(entrada);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    if (!guardiaId) e.guardiaId = 'Elige un guardia';
    if (!desde) e.desde = 'Pon la hora de inicio';
    if (!hasta) e.hasta = 'Pon la hora de fin';
    setErrores(e);
    if (Object.keys(e).length || !r.success) return;
    capturar.mutate(r.data);
  };

  return (
    <FormModal
      title="Capturar horas extra"
      description="Quedan aprobadas y se avisa al guardia. El motivo queda en la bitácora."
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Guardar"
      loading={capturar.isPending}
      dirty={motivo.trim() !== '' || guardiaId !== ''}
    >
      <FormField label="Guardia" required error={errores.guardiaId}>
        <Select
          value={guardiaId}
          onChange={(e) => setGuardiaId(e.target.value)}
          placeholder={opciones.isPending ? 'Cargando…' : 'Elige un guardia'}
          options={(opciones.data?.guardias ?? []).map((g) => ({ value: g.id, label: g.nombre }))}
        />
      </FormField>
      <FormField
        label="Sitio"
        error={errores.sitioId}
        hint="Si lo dejas vacío se usa el sitio que tenía asignado ese día."
      >
        <Select
          value={sitioId}
          onChange={(e) => setSitioId(e.target.value)}
          placeholder="El de su asignación"
          options={(opciones.data?.sitios ?? []).map((s) => ({ value: s.id, label: s.nombre }))}
        />
      </FormField>
      <FormField label="Día de la jornada" required error={errores.fecha}>
        <Input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Desde" required error={errores.desde}>
          <Input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </FormField>
        <FormField label="Hasta" required error={errores.hasta} hint="Si es después de medianoche, cuenta al día siguiente.">
          <Input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Motivo" required error={errores.motivo}>
        <Textarea rows={2} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </FormField>
    </FormModal>
  );
}
