import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cerrarJornadaSchema, type Jornada } from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { FormField, FormModal, Input, Textarea, toast } from '../../components/ui';
import { asistenciaService } from './asistencia.service';
import { formatDia, formatHora } from './formato';

/** `AAAA-MM-DDTHH:MM` en la hora local del navegador (lo que pide un campo datetime-local). */
const paraCampo = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Salida por omisión: la programada si ya pasó; si no, ahora. */
const salidaInicial = (j: Jornada) => {
  const programada = j.programada ? new Date(j.programada.salida) : null;
  return paraCampo(programada && programada.getTime() <= Date.now() ? programada : new Date());
};

/**
 * Cerrar la jornada de un guardia que no pudo checar su salida (DA-49): admin o supervisor registran
 * la salida con la hora y un motivo obligatorio. Las checadas no se editan: se agrega esta salida,
 * marcada "cerrada por un supervisor", y se le avisa al guardia.
 */
export function CerrarJornadaModal({
  jornada,
  guardia,
  onClose,
}: {
  jornada: Jornada;
  guardia: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [salida, setSalida] = useState(() => salidaInicial(jornada));
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cerrar = useMutation({
    mutationFn: () =>
      asistenciaService.cerrarJornada(jornada.entrada.id, {
        motivo: motivo.trim(),
        salidaEn: new Date(salida).toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success(`Jornada de ${guardia} cerrada`);
      onClose();
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) setErrores(campos as Record<string, string>);
      else toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const r = cerrarJornadaSchema.safeParse({ motivo, salidaEn: new Date(salida).toISOString() });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    cerrar.mutate();
  };

  return (
    <FormModal
      title="Cerrar jornada"
      description={`${guardia} · entró ${formatDia(jornada.entrada.registradaEn)}, ${formatHora(jornada.entrada.registradaEn)}${
        jornada.sitio ? ` · ${jornada.sitio.nombre}` : ''
      }`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Cerrar jornada"
      loading={cerrar.isPending}
      dirty={motivo.trim() !== ''}
      size="sm"
    >
      <FormField
        label="Hora de salida"
        required
        error={errores.salidaEn}
        hint="Por omisión, su salida programada si ya pasó. No puede ser antes de su última checada ni en el futuro."
      >
        <Input type="datetime-local" value={salida} onChange={(e) => setSalida(e.target.value)} />
      </FormField>
      <FormField
        label="Motivo"
        required
        error={errores.motivo}
        hint="Queda en su bitácora y se le avisa al guardia. La jornada se cierra con una salida marcada 'cerrada por un supervisor'."
      >
        <Textarea
          rows={3}
          maxLength={255}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Se le descompuso el teléfono; se olvidó de checar"
          autoFocus
        />
      </FormField>
    </FormModal>
  );
}
