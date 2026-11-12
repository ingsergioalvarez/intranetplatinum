import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RESPUESTAS_C2_SOS,
  RESPUESTA_C2_SOS_LABEL,
  emergenciaRespuestaSchema,
  type Emergencia,
  type RespuestaC2Sos,
} from '@platinum/shared';
import { FormField, FormModal, Input, Select, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { emergenciasService } from '../emergencias/emergencias.service';
import { c2Service } from './c2.service';

/**
 * Lo que el C2 hizo con un SOS (A-81): una respuesta de la lista, y si pidió apoyo externo, a quién (obligatorio) y
 * el número (opcional). Queda en la bitácora con su nombre y la hora, y les llega a supervisor y admin. No cierra el SOS.
 */
export function RespuestaSosModal({ emergencia, onClose }: { emergencia: Emergencia; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<RespuestaC2Sos | ''>('');
  const [institucion, setInstitucion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});

  const guardar = useMutation({
    mutationFn: () => emergenciasService.responder(emergencia.id, { tipo: tipo as RespuestaC2Sos, institucion, telefono, texto }),
    onSuccess: () => {
      toast.success('Respuesta registrada');
      void queryClient.invalidateQueries({ queryKey: c2Service.keys.all });
      void queryClient.invalidateQueries({ queryKey: emergenciasService.keys.all });
      onClose();
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) setErrores(campos);
      else toast.error(mensajeDeError(e));
    },
  });

  const enviar = () => {
    const r = emergenciaRespuestaSchema.safeParse({ tipo, institucion, telefono, texto });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    guardar.mutate();
  };
  const quitar = (campo: string) => setErrores((e) => ({ ...e, [campo]: undefined }));

  return (
    <FormModal
      title="Registrar respuesta"
      description={`SOS de ${emergencia.usuario.nombre}${emergencia.sitio ? ` · ${emergencia.sitio.nombre}` : ''}`}
      onClose={onClose}
      onSubmit={enviar}
      submitLabel="Registrar"
      loading={guardar.isPending}
      dirty={tipo !== ''}
      size="md"
    >
      <FormField label="¿Qué se hizo?" required error={errores.tipo}>
        <Select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as RespuestaC2Sos | '');
            setErrores({});
          }}
          options={RESPUESTAS_C2_SOS.map((t) => ({ value: t, label: RESPUESTA_C2_SOS_LABEL[t] }))}
          placeholder="Elige una respuesta"
        />
      </FormField>
      {tipo === 'apoyo_externo' && (
        <>
          <FormField label="¿A quién se pidió apoyo?" required error={errores.institucion}>
            <Input
              value={institucion}
              onChange={(e) => {
                setInstitucion(e.target.value);
                quitar('institucion');
              }}
              maxLength={120}
              placeholder="Policía municipal, Cruz Roja, ambulancia…"
              autoFocus
            />
          </FormField>
          <FormField label="Número al que se llamó (opcional)" error={errores.telefono} hint="Por ejemplo 911">
            <Input
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value);
                quitar('telefono');
              }}
              maxLength={30}
              inputMode="tel"
            />
          </FormField>
        </>
      )}
      {tipo === 'otro' && (
        <FormField label="¿Qué se hizo?" required error={errores.texto}>
          <Input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              quitar('texto');
            }}
            maxLength={300}
            placeholder="Describe brevemente qué hicieron"
            autoFocus
          />
        </FormField>
      )}
    </FormModal>
  );
}
