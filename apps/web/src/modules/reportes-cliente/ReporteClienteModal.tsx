import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MAX_FOTOS_REPORTE_CLIENTE,
  TIPOS_REPORTE_CLIENTE,
  TIPO_REPORTE_CLIENTE_LABEL,
  reporteClienteCreateSchema,
  type TipoReporteCliente,
} from '@platinum/shared';
import { Checkbox, FormField, FormModal, Input, PhotoUploader, Select, Textarea, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { reportesClienteService } from './reportesCliente.service';

/**
 * El cliente reporta algo del servicio o de un guardia concreto (A-59). Le llega al supervisor del sitio y al
 * administrador; el guardia no se entera.
 */
export function ReporteClienteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoReporteCliente | ''>('');
  const [sitioId, setSitioId] = useState('');
  const [guardiaId, setGuardiaId] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const opciones = useQuery({ queryKey: reportesClienteService.keys.opciones, queryFn: reportesClienteService.opciones });
  const sitios = opciones.data?.sitios ?? [];
  const sitio = sitios.find((s) => String(s.id) === sitioId);

  // Con un solo sitio no hay nada que elegir.
  if (sitios.length === 1 && !sitioId) setSitioId(String(sitios[0].id));

  const guardar = useMutation({
    mutationFn: () =>
      reportesClienteService.crear(
        {
          tipo: tipo as TipoReporteCliente,
          sitioId,
          guardiaId: tipo === 'guardia' ? guardiaId : undefined,
          urgente,
          asunto,
          descripcion,
        },
        fotos,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportesClienteService.keys.all });
      toast.success('Reporte enviado: lo revisan el supervisor y el administrador');
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors);
      else toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const r = reporteClienteCreateSchema.safeParse({
      tipo: tipo || undefined,
      sitioId: sitioId || undefined,
      guardiaId: tipo === 'guardia' ? guardiaId || undefined : undefined,
      urgente,
      asunto,
      descripcion,
    });
    const nuevos = r.success ? {} : erroresDeCampos(r.error);
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;
    guardar.mutate();
  };

  return (
    <FormModal
      title="Nuevo reporte"
      description="Cuéntanos qué pasó con el servicio o con un guardia. Lo ven el supervisor y el administrador, y te respondemos aquí."
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Enviar reporte"
      loading={guardar.isPending}
      dirty={!!tipo || !!asunto || !!descripcion || fotos.length > 0}
      size="md"
    >
      <FormField label="¿De qué trata?" required error={errores.tipo}>
        <Select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoReporteCliente | '');
            setGuardiaId('');
          }}
          placeholder="Elige una opción"
          options={TIPOS_REPORTE_CLIENTE.map((t) => ({ value: t, label: TIPO_REPORTE_CLIENTE_LABEL[t] }))}
        />
      </FormField>
      {sitios.length !== 1 && (
        <FormField label="Sitio" required error={errores.sitioId}>
          <Select
            value={sitioId}
            onChange={(e) => {
              setSitioId(e.target.value);
              setGuardiaId('');
            }}
            placeholder="Elige el sitio"
            options={sitios.map((s) => ({ value: String(s.id), label: s.nombre }))}
          />
        </FormField>
      )}
      {tipo === 'guardia' && (
        <FormField
          label="Guardia"
          required
          error={errores.guardiaId}
          hint={sitio && sitio.guardias.length === 0 ? 'Este sitio no tiene guardias asignados hoy.' : undefined}
        >
          <Select
            value={guardiaId}
            onChange={(e) => setGuardiaId(e.target.value)}
            placeholder={sitio ? 'Elige al guardia' : 'Primero elige el sitio'}
            options={(sitio?.guardias ?? []).map((g) => ({ value: String(g.id), label: g.nombre }))}
            disabled={!sitio}
          />
        </FormField>
      )}
      <FormField label="Asunto" required error={errores.asunto}>
        <Input value={asunto} maxLength={150} onChange={(e) => setAsunto(e.target.value)} />
      </FormField>
      <FormField label="¿Qué pasó?" required error={errores.descripcion}>
        <Textarea rows={4} maxLength={2000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </FormField>
      <FormField
        label="Fotos"
        error={errores.fotos}
        hint={`Opcional: hasta ${MAX_FOTOS_REPORTE_CLIENTE} fotos que ayuden a entender lo que pasó.`}
      >
        <PhotoUploader value={fotos} onChange={setFotos} max={MAX_FOTOS_REPORTE_CLIENTE} error={errores.fotos} />
      </FormField>
      <Checkbox
        checked={urgente}
        onChange={(e) => setUrgente(e.target.checked)}
        label="Es urgente"
        description="Úsalo solo si necesita atención de inmediato: se avisa al momento al administrador."
      />
    </FormModal>
  );
}
