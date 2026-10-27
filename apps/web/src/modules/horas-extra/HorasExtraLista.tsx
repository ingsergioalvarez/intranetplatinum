import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Scissors, X } from 'lucide-react';
import {
  ESTADO_HORA_EXTRA_LABEL,
  ORIGEN_HORA_EXTRA_LABEL,
  type EstadoHoraExtra,
  type HoraExtra,
} from '@platinum/shared';
import { Badge, Button, ConfirmDialog, FormField, FormModal, Input, Textarea, toast, type BadgeTone } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { formatFecha, formatFechaHora } from '../../core/format/fechas';
import { formatHora } from '../asistencia/formato';
import { rangoHoraExtra } from './formato';
import { horasExtraService } from './horasExtra.service';

const TONO: Record<EstadoHoraExtra, BadgeTone> = {
  abierta: 'warning',
  por_aprobar: 'warning',
  aprobada: 'success',
  rechazada: 'danger',
  sin_salida: 'danger',
};

/** Valor para un `datetime-local` (hora del dispositivo). */
const paraInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function HoraExtraItem({ h }: { h: HoraExtra }) {
  const qc = useQueryClient();
  const [aprobando, setAprobando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [cortando, setCortando] = useState(false);
  const [nota, setNota] = useState('');
  const [hasta, setHasta] = useState(() => paraInput(h.hasta ? new Date(h.hasta) : new Date()));
  const [motivoCorte, setMotivoCorte] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const terminar = () => void qc.invalidateQueries({ queryKey: horasExtraService.keys.all });
  const resolver = useMutation({
    mutationFn: (decision: 'aprobar' | 'rechazar') =>
      horasExtraService.resolver(h.id, { decision, nota: decision === 'rechazar' ? nota.trim() : null }),
    onSuccess: (r) => {
      toast.success(r.estado === 'aprobada' ? 'Horas extra aprobadas' : 'Horas extra rechazadas');
      setAprobando(false);
      setRechazando(false);
      terminar();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors.nota) setErrores({ nota: String(e.fieldErrors.nota) });
      else toast.error(mensajeDeError(e));
    },
  });
  const cortar = useMutation({
    mutationFn: () =>
      horasExtraService.cortar(h.id, { hasta: new Date(hasta).toISOString(), nota: motivoCorte.trim() }),
    onSuccess: () => {
      toast.success('Hora de salida fijada');
      setCortando(false);
      terminar();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors as Record<string, string>);
      else toast.error(mensajeDeError(e));
    },
  });

  const pendiente = h.estado === 'por_aprobar' || h.estado === 'abierta' || h.estado === 'sin_salida';

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{h.guardia.nombre}</p>
          <p className="text-sm text-slate-600">
            {h.sitio.nombre} · {formatFecha(h.fecha)}
          </p>
        </div>
        <Badge tone={TONO[h.estado]}>{ESTADO_HORA_EXTRA_LABEL[h.estado]}</Badge>
      </div>
      <p className="text-sm font-medium text-slate-800">{rangoHoraExtra(h)}</p>
      <p className="text-sm text-slate-600">{ORIGEN_HORA_EXTRA_LABEL[h.origen]}</p>
      {h.motivo && <p className="text-sm text-slate-700">Motivo: {h.motivo}</p>}
      {h.resolucion && (
        <p className="text-xs text-slate-500">
          {ESTADO_HORA_EXTRA_LABEL[h.estado]}
          {h.resolucion.por ? ` por ${h.resolucion.por}` : ''} · {formatFechaHora(h.resolucion.en)}
          {h.resolucion.nota && ` — ${h.resolucion.nota}`}
        </p>
      )}
      {pendiente && (
        <div className="flex flex-wrap gap-2 pt-1">
          {h.estado === 'por_aprobar' && (
            <Button size="sm" icon={<Check className="size-4" />} onClick={() => setAprobando(true)}>
              Aprobar
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<X className="size-4" />} onClick={() => setRechazando(true)}>
            Rechazar
          </Button>
          <Button size="sm" variant="secondary" icon={<Scissors className="size-4" />} onClick={() => setCortando(true)}>
            {h.estado === 'por_aprobar' ? 'Cambiar hora de salida' : 'Fijar hora de salida'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={aprobando}
        title="Aprobar horas extra"
        description={`${h.guardia.nombre} · ${formatFecha(h.fecha)} · ${rangoHoraExtra(h)}. Se avisa al guardia.`}
        confirmLabel="Aprobar"
        loading={resolver.isPending}
        onConfirm={() => resolver.mutate('aprobar')}
        onCancel={() => setAprobando(false)}
      />
      {rechazando && (
        <FormModal
          title="Rechazar horas extra"
          description={`${h.guardia.nombre} · ${formatFecha(h.fecha)} · ${rangoHoraExtra(h)}`}
          onClose={() => setRechazando(false)}
          onSubmit={() => {
            if (!nota.trim()) return setErrores({ nota: 'Escribe el motivo del rechazo' });
            setErrores({});
            resolver.mutate('rechazar');
          }}
          submitLabel="Rechazar"
          loading={resolver.isPending}
          dirty={nota.trim() !== ''}
          size="sm"
        >
          <FormField label="Motivo del rechazo" required error={errores.nota}>
            <Textarea rows={3} maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          </FormField>
        </FormModal>
      )}
      {cortando && (
        <FormModal
          title="Hora en que terminaron"
          description={`${h.guardia.nombre} · ${formatFecha(h.fecha)} · empezaron a las ${formatHora(h.desde)}`}
          onClose={() => setCortando(false)}
          onSubmit={() => {
            if (!motivoCorte.trim()) return setErrores({ nota: 'Escribe el motivo' });
            setErrores({});
            cortar.mutate();
          }}
          submitLabel="Guardar"
          loading={cortar.isPending}
          dirty={motivoCorte.trim() !== ''}
          size="sm"
        >
          <FormField label="Terminaron" required error={errores.hasta}>
            <Input type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </FormField>
          <FormField label="Motivo" required error={errores.nota} hint="Queda en la bitácora del guardia.">
            <Textarea rows={2} maxLength={255} value={motivoCorte} onChange={(e) => setMotivoCorte(e.target.value)} />
          </FormField>
        </FormModal>
      )}
    </li>
  );
}

export function HorasExtraLista({ items }: { items: HoraExtra[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-slate-500">No hay horas extra.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((h) => (
        <HoraExtraItem key={h.id} h={h} />
      ))}
    </ul>
  );
}
