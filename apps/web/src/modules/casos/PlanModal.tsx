import { useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import {
  DESCANSO_EXTRA_MAX_HORAS,
  HORAS_RECONSULTA_CASO,
  horaLegible,
  type CandidatoCobertura,
  type CasoCobertura,
  type DecisionCaso,
  type SiguienteTurno,
} from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { FormField, FormModal, Input, Spinner, Textarea, cn, toast } from '../../components/ui';
import { casosService } from './casos.service';
import { ElegirCubridor } from './ElegirCubridor';
import { aInputLocal, cuando, fechaLocal, hora24 } from './formato';

/** Una opción que se elige con un toque (con su explicación). */
function Opcion({
  activa,
  titulo,
  children,
  onClick,
}: {
  activa: boolean;
  titulo: string;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left ring-1 ring-inset',
        activa ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50',
      )}
    >
      <span className="block font-medium text-slate-900">{titulo}</span>
      {children && <span className="mt-0.5 block text-sm text-slate-600">{children}</span>}
    </button>
  );
}

/**
 * El plan del supervisor (AS6-05, AS6-06): qué pasa con el relevo que no llegó, con el siguiente
 * turno del guardia que se queda y quién cubre el hueco. Lo deja todo listo desde el inicio.
 */
export function PlanModal({ caso, onClose }: { caso: CasoCobertura; onClose: () => void }) {
  const qc = useQueryClient();
  const { guardia, sitio, relevo } = caso;
  const [decision, setDecision] = useState<DecisionCaso | null>(null);
  const [siguiente, setSiguiente] = useState<SiguienteTurno | null>(null);
  const [extra, setExtra] = useState('0');
  const [cubridor, setCubridor] = useState<CandidatoCobertura | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Hasta cuándo se queda (hora local). `null` = sin tocar: se usa la que propone el sistema.
  const [hastaEditado, setHastaEditado] = useState<string | null>(null);
  const [errorHasta, setErrorHasta] = useState<string | null>(null);

  const extraValido = /^\d+$/.test(extra) && Number(extra) <= DESCANSO_EXTRA_MAX_HORAS;
  const horasExtra = siguiente === 'descansa' && extraValido ? Number(extra) : 0;
  const hastaIso = hastaEditado && !Number.isNaN(new Date(hastaEditado).getTime()) ? new Date(hastaEditado).toISOString() : undefined;
  const vista = useQuery({
    queryKey: casosService.keys.vistaPrevia(caso.entradaId, horasExtra, hastaIso),
    queryFn: () => casosService.vistaPrevia(caso.entradaId, horasExtra, hastaIso),
    enabled: decision === 'no_llegara',
    placeholderData: keepPreviousData,
  });
  const v = vista.data;
  // La hora propuesta (fin del turno del relevo) puede haber pasado ya: entonces hay que elegir otra.
  const propuestaPasada = !!v && !hastaIso && new Date(v.finCubierto).getTime() <= Date.now();
  const hasta = hastaEditado ?? (v && !propuestaPasada ? aInputLocal(v.finCubierto) : '');
  const hueco = decision === 'no_llegara' && siguiente === 'descansa' ? (v?.huecos[0] ?? null) : null;
  const tramoRelevo = relevo
    ? { fecha: fechaLocal(relevo.inicio), horaInicio: hora24(relevo.inicio), horas: Math.min(24, Math.max(1, Math.ceil(relevo.horas))) }
    : null;
  const tramo = decision === 'otro_cubre' ? tramoRelevo : hueco;

  const quien = relevo ? `el turno de ${relevo.nombre}` : 'ese turno';
  const guardar = useMutation({
    mutationFn: () =>
      casosService.resolver(caso.entradaId, {
        decision: decision!,
        ...(decision === 'no_llegara'
          ? { siguiente: siguiente!, descansoExtraHoras: horasExtra, ...(hasta ? { finCubierto: new Date(hasta).toISOString() } : {}) }
          : {}),
        ...(cubridor && tramo ? { cubridorId: cubridor.guardia.id } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: casosService.keys.all });
      void qc.invalidateQueries({ queryKey: ['cobertura'] });
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
      void qc.invalidateQueries({ queryKey: ['horas-extra'] });
      toast.success('Plan guardado; avisamos a los guardias');
      onClose();
    },
    onError: (e) => {
      const campo = e instanceof ApiError ? e.fieldErrors.finCubierto : undefined;
      if (campo) setErrorHasta(campo);
      else setError(mensajeDeError(e));
    },
  });

  const confirmar = () => {
    setError(null);
    setErrorHasta(null);
    if (!decision) return setError('Elige qué pasa con el relevo');
    if (decision === 'otro_cubre' && !cubridor) return setError('Elige quién cubre');
    if (decision === 'no_llegara') {
      if (!hasta) return setErrorHasta('Indica hasta qué hora se queda');
      if (new Date(hasta).getTime() <= Date.now()) return setErrorHasta('Esa hora ya pasó: elige una que aún no llegue');
      if (!siguiente) return setError('Elige qué pasa con su siguiente turno');
      if (siguiente === 'descansa' && !extraValido) return setError('Revisa las horas de descanso');
    }
    guardar.mutate();
  };

  return (
    <FormModal
      title={`Plan para ${sitio.nombre}`}
      description={
        relevo
          ? `${guardia.nombre} sigue en el sitio y ${relevo.nombre} no llegó (le tocaba a las ${horaLegible(hora24(relevo.inicio))})`
          : `${guardia.nombre} sigue en el sitio después de su hora`
      }
      onClose={onClose}
      onSubmit={confirmar}
      submitLabel="Confirmar plan"
      loading={guardar.isPending}
      dirty
      size="lg"
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          1. ¿Qué pasa con {relevo ? relevo.nombre : 'el relevo'}?
        </p>
        <div className="space-y-1.5" role="radiogroup" aria-label="Qué pasa con el relevo">
          <Opcion activa={decision === 'en_camino'} titulo="Viene en camino" onClick={() => setDecision('en_camino')}>
            {guardia.nombre} se queda mientras llega. Si pasan {HORAS_RECONSULTA_CASO} h te volvemos a preguntar.
          </Opcion>
          <Opcion activa={decision === 'no_llegara'} titulo={`No llegará: ${guardia.nombre} cubre ${quien}`} onClick={() => setDecision('no_llegara')}>
            {relevo ? `Cubre hasta las ${horaLegible(hora24(relevo.fin))}; sus` : 'Sus'} horas extra se aprueban solas con este plan.
          </Opcion>
          <Opcion
            activa={decision === 'otro_cubre'}
            titulo="Mando a otro guardia"
            onClick={() => {
              setDecision('otro_cubre');
              setCubridor(null);
            }}
          >
            Se crea la cobertura de ese turno y {guardia.nombre} entrega y marca su salida.
          </Opcion>
        </div>
      </div>

      {decision === 'no_llegara' && (
        <FormField
          label={`¿Hasta qué hora se queda ${guardia.nombre}?`}
          required
          error={errorHasta ?? undefined}
          hint={
            propuestaPasada
              ? 'La hora del turno que cubre ya pasó: elige hasta cuándo se queda. Pasada esa hora se le avisa que marque su salida y lo que se pase queda por aprobar.'
              : 'Hasta esa hora sus horas extra se aprueban solas. Pasada esa hora se le avisa que marque su salida y lo que se pase queda por aprobar.'
          }
        >
          <Input
            type="datetime-local"
            value={hasta}
            onChange={(e) => {
              setHastaEditado(e.target.value);
              setErrorHasta(null);
            }}
          />
        </FormField>
      )}

      {decision === 'no_llegara' && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">2. ¿Qué pasa con el siguiente turno de {guardia.nombre}?</p>
          {!v ? (
            <div className="flex justify-center py-4 text-brand-600">
              <Spinner className="size-5" />
            </div>
          ) : (
            <div className="space-y-1.5" role="radiogroup" aria-label="Siguiente turno">
              <Opcion
                activa={siguiente === 'normal'}
                titulo="Lo trabaja normal"
                onClick={() => {
                  setSiguiente('normal');
                  setCubridor(null);
                }}
              >
                {v.limiteExtra
                  ? `Las horas extra terminan ${cuando(v.limiteExtra)} y empieza su turno de siempre, sin falta ni retardo.`
                  : 'No tiene un turno próximo: las horas extra terminan cuando marque su salida.'}
              </Opcion>
              <Opcion activa={siguiente === 'descansa'} titulo="Descansa" onClick={() => setSiguiente('descansa')}>
                {v.siguienteTurno ? (
                  <>
                    Descansa {v.descansoPatronHoras ?? '—'} h como marca su patrón
                    {horasExtra ? ` + ${horasExtra} h que agregas` : ''}. Se presenta {v.vuelveA ? cuando(v.vuelveA) : 'sin turno próximo'}.
                  </>
                ) : (
                  'No tiene un turno próximo: solo se registra su descanso.'
                )}
              </Opcion>
            </div>
          )}

          {siguiente === 'descansa' && v && (
            <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
              <FormField label="Horas de descanso que agregas (opcional)" hint={`El patrón ya marca ${v.descansoPatronHoras ?? '—'} h; solo puedes agregar, no quitar.`}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={DESCANSO_EXTRA_MAX_HORAS}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  invalid={!extraValido}
                />
              </FormField>
              {v.entraTarde && (
                <p className="text-sm text-slate-700">
                  Regresa a la mitad de un turno: entra {cuando(v.entraTarde.inicio)} y termina a la hora original ({cuando(v.entraTarde.fin)}).
                </p>
              )}
              {v.huecos.length === 0 ? (
                <p className="text-sm text-emerald-700">Con este descanso no queda ningún turno sin cubrir.</p>
              ) : (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-800">3. Queda sin cubrir:</p>
                  <ul className="mb-2 space-y-0.5 text-sm text-slate-700">
                    {v.huecos.map((h) => (
                      <li key={h.inicio}>
                        {cuando(h.inicio)} a {cuando(h.fin)}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-sm font-medium text-slate-800">¿Quién lo cubre?</p>
                  <ElegirCubridor sitioId={sitio.id} tramo={v.huecos[0]} elegido={cubridor} onElegir={setCubridor} excluir={[guardia.id]} />
                  {!cubridor && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      Si no eliges a nadie, el sitio queda en rojo en el calendario hasta que alguien lo cubra.
                    </p>
                  )}
                  {v.huecos.length > 1 && cubridor && <p className="mt-1 text-xs text-slate-500">Cubre todos los tramos de arriba.</p>}
                </div>
              )}
            </div>
          )}

          {v && v.advertencias.length > 0 && (
            <ul className="mt-3 space-y-1">
              {v.advertencias
                .filter((a) => siguiente !== 'descansa' || a.startsWith('Para cubrir'))
                .map((a) => (
                  <li key={a} className="flex items-start gap-1.5 text-sm text-amber-700">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {a}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {decision === 'otro_cubre' && tramoRelevo && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">2. ¿Quién cubre {quien}?</p>
          <ElegirCubridor sitioId={sitio.id} tramo={tramoRelevo} elegido={cubridor} onElegir={setCubridor} excluir={[guardia.id, ...(relevo ? [relevo.id] : [])]} />
        </div>
      )}
      {decision === 'otro_cubre' && !tramoRelevo && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No se sabe de quién era el turno que queda sin cubrir. Usa &quot;Enviar a cubrir&quot; desde Asistencia para elegir la hora.
        </p>
      )}

      <FormField label="Nota (opcional)">
        <Textarea rows={2} maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Queda en la bitácora del guardia" />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </FormModal>
  );
}
