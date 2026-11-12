import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NOTA_C2_MAX, avisoSupervisorC2Schema, notaC2Schema, type EstadoSitioC2 } from '@platinum/shared';
import { FormField, FormModal, Input, Textarea, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { c2Service } from './c2.service';

interface Destino {
  id: number;
  nombre: string;
  cliente: string;
}

/** Nota libre sobre un sitio (A-80): queda en la bitácora con quién la escribió. */
export function NotaModal({ sitio, onClose }: { sitio: Destino; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const guardar = useMutation({
    mutationFn: () => c2Service.nota(sitio.id, { texto }),
    onSuccess: () => {
      toast.success('Nota guardada');
      void queryClient.invalidateQueries({ queryKey: c2Service.keys.all });
      onClose();
    },
    onError: (e) => (e instanceof ApiError && e.fieldErrors.texto ? setError(e.fieldErrors.texto) : toast.error(mensajeDeError(e))),
  });
  const enviar = () => {
    const r = notaC2Schema.safeParse({ texto });
    if (!r.success) return setError(erroresDeCampos(r.error).texto);
    guardar.mutate();
  };
  return (
    <FormModal
      title="Nota"
      description={`${sitio.cliente} · ${sitio.nombre}`}
      onClose={onClose}
      onSubmit={enviar}
      submitLabel="Guardar nota"
      loading={guardar.isPending}
      dirty={texto.trim().length > 0}
      size="md"
    >
      <FormField label="Nota" required error={error} hint={`${texto.length}/${NOTA_C2_MAX}`}>
        <Textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(undefined);
          }}
          rows={4}
          maxLength={NOTA_C2_MAX}
          placeholder="Qué pasó o qué hiciste en este sitio."
          autoFocus
        />
      </FormField>
    </FormModal>
  );
}

/** Frase que lleva el aviso según cómo está el sitio (la misma que arma el servidor). */
const SITUACION: Partial<Record<EstadoSitioC2, string>> = {
  solo: 'no tiene guardia',
  parcial: 'tiene la guardia incompleta',
  por_llegar: 'está por recibir a su guardia',
};

/** Avisar al supervisor (A-80): pide confirmar, muestra el texto que se manda y deja agregar algo más. */
export function AvisarModal({ sitio, estado, supervisor, onClose }: { sitio: Destino; estado: EstadoSitioC2; supervisor: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | undefined>();
  const avisar = useMutation({
    mutationFn: () => c2Service.avisar(sitio.id, { mensaje: mensaje.trim() || undefined }),
    onSuccess: ({ avisados }) => {
      toast.success(avisados === 1 ? 'Se avisó a 1 persona' : `Se avisó a ${avisados} personas`);
      void queryClient.invalidateQueries({ queryKey: c2Service.keys.all });
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const enviar = () => {
    const r = avisoSupervisorC2Schema.safeParse({ mensaje: mensaje.trim() || undefined });
    if (!r.success) return setError(erroresDeCampos(r.error).mensaje);
    avisar.mutate();
  };
  return (
    <FormModal
      title="Avisar al supervisor"
      onClose={onClose}
      onSubmit={enviar}
      submitLabel="Avisar"
      loading={avisar.isPending}
      dirty={mensaje.trim().length > 0}
      size="md"
    >
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
        Le llega {supervisor ? <strong>a {supervisor}</strong> : 'al supervisor'} y al administrador del sitio:
        <span className="mt-1 block font-medium text-slate-900">
          "El C2 reporta que {sitio.nombre} ({sitio.cliente}) {SITUACION[estado] ?? 'necesita atención'}"
        </span>
      </p>
      <FormField label="Agregar un mensaje (opcional)" error={error}>
        <Input
          value={mensaje}
          onChange={(e) => {
            setMensaje(e.target.value);
            setError(undefined);
          }}
          maxLength={200}
          placeholder="Por ejemplo: no contesta el guardia"
        />
      </FormField>
    </FormModal>
  );
}
