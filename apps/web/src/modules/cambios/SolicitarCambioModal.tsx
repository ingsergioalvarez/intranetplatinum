import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIPOS_CAMBIO_TURNO, nuevoCambioTurnoSchema, type TipoCambioTurno } from '@platinum/shared';
import { FormField, FormModal, Input, Select, Textarea, cn, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { hoyLocal } from '../../core/format/fechas';
import { cambiosService } from './cambios.service';

const diaLargo = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const fechaLegible = (f: string) => diaLargo.format(new Date(`${f}T12:00:00`));

/**
 * Pedir (guardia) o hacer (supervisor / admin) un cambio de turno (TC-22, DA-54): que un compañero
 * cubra o mover el descanso, siempre con motivo. Lo del guardia espera la aprobación del supervisor;
 * lo del supervisor queda aplicado al momento.
 */
export function SolicitarCambioModal({
  comoGuardia,
  onClose,
}: {
  /** El guardia pide para sí mismo; si no, el supervisor elige a quién se le cambia. */
  comoGuardia: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoCambioTurno>('cubrir');
  const [guardiaId, setGuardiaId] = useState('');
  const [fecha, setFecha] = useState('');
  const [cubreId, setCubreId] = useState('');
  const [fechaNueva, setFechaNueva] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const opciones = useQuery({ queryKey: cambiosService.keys.opciones, queryFn: cambiosService.opciones });
  const hoy = hoyLocal();

  const crear = useMutation({
    mutationFn: cambiosService.crear,
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: cambiosService.keys.all });
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
      void qc.invalidateQueries({ queryKey: ['coberturas'] });
      toast.success(comoGuardia ? 'Solicitud enviada a tu supervisor' : `Cambio aplicado (${c.estado})`);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors as Record<string, string>);
      else toast.error(mensajeDeError(e));
    },
  });

  const compas = (opciones.data?.companeros ?? []).filter((c) => String(c.id) !== guardiaId);

  const onSubmit = () => {
    const entrada = {
      tipo,
      guardiaId: comoGuardia ? null : guardiaId ? Number(guardiaId) : null,
      fecha,
      cubreId: tipo === 'cubrir' && cubreId ? Number(cubreId) : null,
      fechaNueva: tipo === 'descanso' && fechaNueva ? fechaNueva : null,
      motivo,
    };
    const r = nuevoCambioTurnoSchema.safeParse(entrada);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    if (!comoGuardia && !guardiaId) e.guardiaId = 'Elige un guardia';
    if (!fecha) e.fecha = comoGuardia ? 'Elige el turno' : 'Elige el día';
    setErrores(e);
    if (Object.keys(e).length) return;
    crear.mutate(entrada);
  };

  return (
    <FormModal
      title={comoGuardia ? 'Solicitar cambio de turno' : 'Cambio de turno'}
      description={
        comoGuardia
          ? 'Tu supervisor lo revisa; hasta que lo apruebe, nada cambia.'
          : 'Queda aplicado al momento y se avisa al guardia.'
      }
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={comoGuardia ? 'Enviar solicitud' : 'Aplicar cambio'}
      loading={crear.isPending}
      dirty={motivo.trim() !== '' || fecha !== ''}
    >
      <div role="tablist" aria-label="Tipo de cambio" className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {TIPOS_CAMBIO_TURNO.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipo === t}
            onClick={() => setTipo(t)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tipo === t ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t === 'cubrir' ? (comoGuardia ? 'Que me cubran' : 'Cubrir a un guardia') : 'Mover descanso'}
          </button>
        ))}
      </div>

      {!comoGuardia && (
        <FormField label="Guardia" required error={errores.guardiaId}>
          <Select
            value={guardiaId}
            onChange={(e) => setGuardiaId(e.target.value)}
            placeholder="Elige un guardia"
            options={(opciones.data?.guardias ?? []).map((g) => ({ value: g.id, label: g.nombre }))}
          />
        </FormField>
      )}

      {comoGuardia ? (
        <FormField
          label={tipo === 'cubrir' ? 'Turno que no podrás cubrir' : 'Día que descansarás (hoy te toca trabajar)'}
          required
          error={errores.fecha}
        >
          <Select
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            placeholder={opciones.isPending ? 'Cargando…' : 'Elige tu turno'}
            options={(opciones.data?.misTurnos ?? []).map((t) => ({
              value: t.fecha,
              label: `${fechaLegible(t.fecha)} · ${t.sitio} · ${t.horario}`,
            }))}
          />
        </FormField>
      ) : (
        <FormField
          label={tipo === 'cubrir' ? 'Día del turno' : 'Día que descansará (hoy le toca trabajar)'}
          required
          error={errores.fecha}
        >
          <Input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />
        </FormField>
      )}

      {tipo === 'cubrir' ? (
        <FormField label="Quién lo cubrirá" required error={errores.cubreId}>
          <Select
            value={cubreId}
            onChange={(e) => setCubreId(e.target.value)}
            placeholder="Elige a un compañero"
            options={compas.map((c) => ({ value: c.id, label: c.nombre }))}
          />
        </FormField>
      ) : (
        <FormField
          label="Día que trabajará en su lugar"
          required
          error={errores.fechaNueva}
          hint="Debe ser un día en que normalmente descansa."
        >
          <Input type="date" value={fechaNueva} min={hoy} onChange={(e) => setFechaNueva(e.target.value)} />
        </FormField>
      )}

      <FormField label="Motivo" required error={errores.motivo}>
        <Textarea
          rows={3}
          maxLength={255}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Cita médica, trámite, evento familiar"
        />
      </FormField>
    </FormModal>
  );
}
