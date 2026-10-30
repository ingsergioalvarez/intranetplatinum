import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MOTIVOS_SALIDA_SIN_MARCAR,
  MOTIVO_SALIDA_SIN_MARCAR_LABEL,
  SALIDAS_SIN_MARCAR_SUGERIR,
  cerrarJornadaSchema,
  type Jornada,
  type MotivoSalidaSinMarcar,
  type OpcionMedida,
} from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { FormField, FormModal, Input, toast } from '../../components/ui';
import { asistenciaService } from './asistencia.service';
import { formatDia, formatHora } from './formato';
import { MedidaCampo } from './MedidaCampo';
import { MotivoLista } from './MotivoLista';

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
 * marcada "cerrada por un supervisor", y se le avisa al guardia. Cuenta como "salida sin marcar" del
 * guardia y puede llevar una medida disciplinaria (A-49).
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
  const [categoria, setCategoria] = useState<MotivoSalidaSinMarcar | ''>('');
  const [nota, setNota] = useState('');
  const [medida, setMedida] = useState<OpcionMedida>('ninguna');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});

  const cerrar = useMutation({
    mutationFn: () =>
      asistenciaService.cerrarJornada(jornada.entrada.id, {
        categoria: categoria as MotivoSalidaSinMarcar,
        nota: nota.trim() || undefined,
        salidaEn: new Date(salida).toISOString(),
        medida,
      }),
    onSuccess: ({ salidasSinMarcarMes }) => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success(`Jornada de ${guardia} cerrada`);
      if (salidasSinMarcarMes >= SALIDAS_SIN_MARCAR_SUGERIR && medida !== 'amonestacion') {
        toast.warning(
          `${guardia} lleva ${salidasSinMarcarMes} salidas sin marcar este mes: considera una amonestación.`,
        );
      }
      onClose();
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) setErrores(campos as Record<string, string>);
      else toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const r = cerrarJornadaSchema.safeParse({
      categoria: categoria || undefined,
      nota: nota.trim() || undefined,
      salidaEn: new Date(salida).toISOString(),
      medida,
    });
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
      dirty={!!categoria || !!nota || medida !== 'ninguna'}
      size="sm"
    >
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
        Cuenta como <strong>salida sin marcar</strong> del guardia. Queda en su bitácora y se le avisa; la
        jornada se cierra con una salida marcada &quot;cerrada por un supervisor&quot;.
      </p>
      <FormField
        label="Hora de salida"
        required
        error={errores.salidaEn}
        hint="Por omisión, su salida programada si ya pasó. No puede ser antes de su última checada ni en el futuro."
      >
        <Input type="datetime-local" value={salida} onChange={(e) => setSalida(e.target.value)} />
      </FormField>
      <MotivoLista
        categorias={MOTIVOS_SALIDA_SIN_MARCAR}
        etiquetas={MOTIVO_SALIDA_SIN_MARCAR_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
        placeholderNota="Ej. Se fue corriendo porque lo esperaban en su casa"
      />
      <MedidaCampo value={medida} onChange={setMedida} />
    </FormModal>
  );
}
