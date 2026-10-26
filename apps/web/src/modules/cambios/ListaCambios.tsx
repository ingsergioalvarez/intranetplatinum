import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Check, X } from 'lucide-react';
import {
  ESTADO_CAMBIO_TURNO_LABEL,
  type CambioTurno,
  type EstadoCambioTurno,
} from '@platinum/shared';
import { Badge, Button, ConfirmDialog, FormField, FormModal, Textarea, toast, type BadgeTone } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { cambiosService } from './cambios.service';
import { descripcionCambio } from './descripcion';

const TONO: Record<EstadoCambioTurno | 'vencido', BadgeTone> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'danger',
  cancelado: 'neutral',
  vencido: 'neutral',
};

/** Un cambio de turno con lo que se puede hacer con él (aprobar, rechazar, cancelar). */
function CambioItem({ c, esGuardia }: { c: CambioTurno; esGuardia: boolean }) {
  const qc = useQueryClient();
  const [rechazando, setRechazando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [nota, setNota] = useState('');
  const estado = c.vencido ? 'vencido' : c.estado;

  const terminar = () => {
    void qc.invalidateQueries({ queryKey: cambiosService.keys.all });
    void qc.invalidateQueries({ queryKey: ['asistencia'] });
    void qc.invalidateQueries({ queryKey: ['coberturas'] });
  };
  const resolver = useMutation({
    mutationFn: (decision: 'aprobar' | 'rechazar') =>
      cambiosService.resolver(c.id, { decision, nota: decision === 'rechazar' ? nota.trim() || null : null }),
    onSuccess: (r) => {
      toast.success(r.estado === 'aprobado' ? 'Cambio aprobado' : 'Cambio rechazado');
      setAprobando(false);
      setRechazando(false);
      terminar();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });
  const cancelar = useMutation({
    mutationFn: () => cambiosService.cancelar(c.id),
    onSuccess: () => {
      toast.success('Cambio cancelado');
      setCancelando(false);
      terminar();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const puedeResolver = !esGuardia && c.estado === 'pendiente' && !c.vencido;
  const puedeCancelar = c.estado === 'pendiente' ? true : !esGuardia && c.estado === 'aprobado' && !c.vencido;
  const esFuturo = c.estado !== 'aprobado' || (c.fechaNueva ?? c.fecha) >= new Date().toISOString().slice(0, 10);

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-900">{descripcionCambio(c)}</p>
        <Badge tone={TONO[estado]}>{ESTADO_CAMBIO_TURNO_LABEL[estado]}</Badge>
      </div>
      <p className="text-sm text-slate-600">
        {c.sitio.nombre} · {c.horario}
        {c.solicitante.id !== c.guardia.id && ` · lo hizo ${c.solicitante.nombre}`}
      </p>
      <p className="text-sm text-slate-700">Motivo: {c.motivo}</p>
      <p className="text-xs text-slate-500">
        {formatFechaHora(c.creadoEn)}
        {c.resolucion && ` · ${ESTADO_CAMBIO_TURNO_LABEL[c.estado]}${c.resolucion.por ? ` por ${c.resolucion.por}` : ''}`}
        {c.resolucion?.nota && ` — ${c.resolucion.nota}`}
      </p>
      {(puedeResolver || (puedeCancelar && esFuturo && c.estado !== 'rechazado')) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {puedeResolver && (
            <>
              <Button size="sm" icon={<Check className="size-4" />} onClick={() => setAprobando(true)}>
                Aprobar
              </Button>
              <Button size="sm" variant="secondary" icon={<X className="size-4" />} onClick={() => setRechazando(true)}>
                Rechazar
              </Button>
            </>
          )}
          {puedeCancelar && esFuturo && (
            <Button size="sm" variant="secondary" onClick={() => setCancelando(true)}>
              {c.estado === 'aprobado' ? 'Cancelar cambio' : esGuardia ? 'Cancelar solicitud' : 'Cancelar'}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={aprobando}
        title="Aprobar cambio de turno"
        description={`${descripcionCambio(c)}. Se avisará al guardia${c.cubre ? ' y a quien cubre' : ''}.`}
        confirmLabel="Aprobar"
        loading={resolver.isPending}
        onConfirm={() => resolver.mutate('aprobar')}
        onCancel={() => setAprobando(false)}
      />
      <ConfirmDialog
        open={cancelando}
        title={c.estado === 'aprobado' ? 'Cancelar cambio aprobado' : 'Cancelar solicitud'}
        description={
          c.estado === 'aprobado'
            ? 'Se deshace la cobertura y el guardia vuelve a su turno normal. Se avisará a los involucrados.'
            : 'La solicitud ya no llegará a tu supervisor.'
        }
        confirmLabel="Cancelar cambio"
        variant="danger"
        loading={cancelar.isPending}
        onConfirm={() => cancelar.mutate()}
        onCancel={() => setCancelando(false)}
      />
      {rechazando && (
        <FormModal
          title="Rechazar cambio de turno"
          description={descripcionCambio(c)}
          onClose={() => setRechazando(false)}
          onSubmit={() => resolver.mutate('rechazar')}
          submitLabel="Rechazar"
          loading={resolver.isPending}
          dirty={nota.trim() !== ''}
          size="sm"
        >
          <FormField label="Motivo del rechazo" hint="Opcional; se le muestra al guardia.">
            <Textarea rows={3} maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          </FormField>
        </FormModal>
      )}
    </li>
  );
}

/** Lista de cambios de turno; `esGuardia` limita las acciones a cancelar sus solicitudes. */
export function ListaCambios({ cambios, esGuardia = false }: { cambios: CambioTurno[]; esGuardia?: boolean }) {
  if (cambios.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-slate-500">
        <ArrowRightLeft className="size-8 text-slate-300" />
        <p>No hay cambios de turno.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {cambios.map((c) => (
        <CambioItem key={c.id} c={c} esGuardia={esGuardia} />
      ))}
    </ul>
  );
}
