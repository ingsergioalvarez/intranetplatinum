import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Handshake, House } from 'lucide-react';
import { RESPONSABILIDADES_SITIO, type EventoBitacora, type ResponsabilidadSitio } from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { Button, FormField, FormModal, Textarea, toast } from '../../components/ui';
import { asistenciaService } from './asistencia.service';
import { formatHora } from './formato';

const RESPONSABILIDAD_LABEL: Record<ResponsabilidadSitio, { titulo: string; detalle: string }> = {
  queda_solo: {
    titulo: 'El sitio se queda sin guardia hasta el siguiente turno',
    detalle: 'Bajo mi responsabilidad. Se avisa a los administradores.',
  },
  cubrire: {
    titulo: 'Mandaré a alguien a cubrir',
    detalle: 'Uno de mis guardias. Se avisa a los administradores.',
  },
  pedir_a_admin: {
    titulo: 'Necesito un guardia de otro supervisor',
    detalle: 'Se envía la solicitud a los administradores para que elijan quién cubre y quede registrado.',
  },
};

/**
 * Qué hacer con un retardo sin atender (A-25): justificarlo, aceptarlo (se queda y el retardo sigue
 * contando) o mandar al guardia a casa (solo si sigue en el sitio; cuenta como falta).
 */
export function DecisionRetardo({ evento: e, onJustificar }: { evento: EventoBitacora; onJustificar: () => void }) {
  const qc = useQueryClient();
  const [mandando, setMandando] = useState(false);
  const aceptar = useMutation({
    mutationFn: () => asistenciaService.decidirRetardo(e.id, { decision: 'aceptado' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success('Retardo aceptado: el guardia sigue en su turno');
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  });

  return (
    <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
      <p>
        <strong>¿Qué haces con este retardo?</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-4" />} onClick={onJustificar}>
          Justificar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Handshake className="size-4" />}
          loading={aceptar.isPending}
          disabled={aceptar.isPending}
          onClick={() => aceptar.mutate()}
        >
          Aceptar con retardo
        </Button>
        <Button size="sm" variant="danger" icon={<House className="size-4" />} onClick={() => setMandando(true)}>
          Mandar a casa
        </Button>
      </div>
      <p className="text-xs text-amber-800">
        Justificar: no cuenta. Aceptar: se queda y el retardo cuenta. Mandar a casa: cuenta como falta.
      </p>
      {mandando && <MandarACasaModal evento={e} onClose={() => setMandando(false)} />}
    </div>
  );
}

/** Lo ya decidido sobre un retardo, para la línea de tiempo. */
export function NotaDecisionRetardo({ evento: e }: { evento: EventoBitacora }) {
  if (!e.decision || e.tipo !== 'retardo') return null;
  const casa = e.decision.tipo === 'enviado_a_casa';
  return (
    <p
      className={
        casa
          ? 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800'
          : 'rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600'
      }
    >
      <strong>{casa ? 'Mandado a casa' : 'Aceptado con retardo'}</strong> por {e.decision.por ?? 'alguien'} ·{' '}
      {formatFechaHora(e.decision.en)}
      <span className="block text-slate-700">
        {casa ? 'Cuenta como falta; sus horas de ese día no cuentan.' : 'Se quedó en su turno; el retardo cuenta.'}
      </span>
    </p>
  );
}

/**
 * Confirmación de "Mandar a casa": explica lo que pasará, pide el motivo y, si el sitio se quedaría
 * sin guardia, quién se hace cargo (el servidor lo avisa con SITIO_QUEDARIA_SOLO).
 */
function MandarACasaModal({ evento: e, onClose }: { evento: EventoBitacora; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [soloAviso, setSoloAviso] = useState<string | null>(null);
  const [responsabilidad, setResponsabilidad] = useState<ResponsabilidadSitio | null>(null);
  const [entiendo, setEntiendo] = useState(false);

  const mandar = useMutation({
    mutationFn: () =>
      asistenciaService.decidirRetardo(e.id, {
        decision: 'enviado_a_casa',
        motivo: motivo.trim(),
        ...(responsabilidad && { responsabilidad }),
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success(
        r.sitioSolo ? 'Mandado a casa. Se avisó a los administradores que el sitio quedó solo' : 'Mandado a casa',
      );
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'SITIO_QUEDARIA_SOLO') return setSoloAviso(err.message);
      toast.error(mensajeDeError(err));
    },
  });

  const faltaResponsable = !!soloAviso && (!responsabilidad || !entiendo);

  const onSubmit = () => {
    if (motivo.trim().length < 3) return setError('Escribe el motivo');
    setError(undefined);
    if (faltaResponsable) return;
    mandar.mutate();
  };

  return (
    <FormModal
      title="Mandar a casa"
      description={`${e.guardia.nombre} · ${e.detalle}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Mandar a casa"
      loading={mandar.isPending}
      submitDisabled={faltaResponsable}
      dirty={motivo.trim() !== ''}
      size="sm"
    >
      <div className="space-y-4">
        <ul className="list-disc space-y-1 rounded-lg bg-red-50 py-3 pr-4 pl-8 text-sm text-red-900">
          <li>Se cierra su jornada ahora ({formatHora(new Date().toISOString())}).</li>
          <li>
            Cuenta como <strong>falta</strong> y sus horas de hoy no cuentan.
          </li>
          <li>Se le avisa al guardia.</li>
          <li>No se puede deshacer.</li>
        </ul>

        <FormField label="Motivo" required error={error} hint="El guardia lo verá en su aviso.">
          <Textarea
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej. Llegó tarde sin avisar"
            autoFocus
          />
        </FormField>

        {soloAviso && (
          <fieldset className="space-y-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200 ring-inset">
            <legend className="px-1 text-sm font-semibold text-amber-900">{soloAviso}</legend>
            {RESPONSABILIDADES_SITIO.map((r) => (
              <label key={r} className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name="responsabilidad"
                  className="mt-1"
                  checked={responsabilidad === r}
                  onChange={() => setResponsabilidad(r)}
                />
                <span>
                  <span className="block font-medium">{RESPONSABILIDAD_LABEL[r].titulo}</span>
                  <span className="block text-xs text-slate-600">{RESPONSABILIDAD_LABEL[r].detalle}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 pt-1 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={entiendo}
                onChange={(ev) => setEntiendo(ev.target.checked)}
              />
              <span>Entiendo que me hago responsable del sitio y que se avisará a los administradores.</span>
            </label>
          </fieldset>
        )}
      </div>
    </FormModal>
  );
}
