import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarX,
  CheckCircle2,
  Gavel,
  Clock,
  LogOut,
  MapPin,
  MessageSquare,
  Repeat,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Users,
  Utensils,
  X,
  Shuffle,
} from 'lucide-react';
import {
  CATEGORIAS_BITACORA,
  CATEGORIA_BITACORA_LABEL,
  CLASES_INCIDENCIA,
  CLASE_INCIDENCIA_LABEL,
  ESTADOS_INCIDENCIA,
  ESTADO_INCIDENCIA_LABEL,
  claseIncidencia,
  incidenciaPendiente,
  type ClaseIncidencia,
  type EstadoIncidencia,
  CONCLUSION_INCIDENCIA_LABEL,
  TIPOS_JUSTIFICABLES,
  TIPO_EVENTO_BITACORA_LABEL,
  categoriaDeEvento,
  comentarioBitacoraSchema,
  MOTIVOS_JUSTIFICAR,
  MOTIVO_JUSTIFICAR_LABEL,
  justificarBitacoraSchema,
  type CategoriaBitacora,
  type MotivoJustificar,
  type DecisionFalta,
  type EventoBitacora,
  type TipoEventoBitacora,
} from '@platinum/shared';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  FormModal,
  Spinner,
  Textarea,
  VisorFotos,
  cn,
  toast,
} from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFechaHora } from '../../core/format/fechas';
import { asistenciaService } from './asistencia.service';
import { formatDia, formatHora } from './formato';
import { DecisionRetardo, NotaDecisionRetardo } from './DecisionRetardo';
import { ConfirmarFaltaModal } from './ConfirmarFaltaModal';
import { IncidenciaModal } from './IncidenciaModal';
import { MotivoLista } from './MotivoLista';

const ICONO: Record<TipoEventoBitacora, typeof Clock> = {
  retardo: Clock,
  salida_anticipada: LogOut,
  comida_fuera: Utensils,
  racha: Repeat,
  falta: CalendarX,
  no_se_presento: UserX,
  incidencia_rostro: ShieldAlert,
  rostro_registrado: ScanFace,
  rostro_aprobado: ShieldCheck,
  rostro_rechazado: ScanFace,
  rostro_eliminado: ScanFace,
  asignacion: MapPin,
  asignacion_cambio: MapPin,
  asignacion_fin: MapPin,
  grupo_alta: Users,
  grupo_baja: Users,
  cobertura: Shuffle,
  cobertura_cancelada: Shuffle,
  comida_sin_cierre: Utensils,
  sin_comida: Utensils,
  jornada_cerrada: LogOut,
  horas_extra: Clock,
  medida_disciplinaria: Gavel,
};

/** Color del ícono: rojo lo grave, ámbar lo de asistencia, verde lo bueno, gris lo administrativo. */
const COLOR: Partial<Record<TipoEventoBitacora, string>> = {
  retardo: 'bg-amber-100 text-amber-700',
  salida_anticipada: 'bg-amber-100 text-amber-700',
  comida_fuera: 'bg-amber-100 text-amber-700',
  racha: 'bg-red-100 text-red-700',
  falta: 'bg-red-100 text-red-700',
  no_se_presento: 'bg-red-100 text-red-700',
  incidencia_rostro: 'bg-red-100 text-red-700',
  rostro_rechazado: 'bg-red-100 text-red-700',
  rostro_aprobado: 'bg-emerald-100 text-emerald-700',
  medida_disciplinaria: 'bg-red-100 text-red-700',
};

/** Filtro de la bitácora (en la URL de la ficha). `tipo` viene del resumen del mes. */
export interface FiltroBitacora {
  categoria: CategoriaBitacora | null;
  clase: ClaseIncidencia | null;
  estado: EstadoIncidencia | null;
  tipo: TipoEventoBitacora | null;
}

/** Fila de botones tipo "chip" para elegir una opción (null = todas). */
export function Chips<T extends string>({
  opciones,
  valor,
  onChange,
  todas = 'Todas',
  label,
}: {
  opciones: readonly (readonly [T, string])[];
  valor: T | null;
  onChange: (v: T | null) => void;
  todas?: string;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {([[null, todas], ...opciones] as const).map(([v, texto]) => (
        <button
          key={v ?? 'todas'}
          type="button"
          aria-pressed={valor === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset',
            valor === v
              ? 'bg-brand-700 text-white ring-brand-700'
              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Aplica el filtro a los eventos del mes. */
function filtrarEventos(eventos: EventoBitacora[], f: FiltroBitacora) {
  return eventos.filter((e) => {
    if (f.tipo) return e.tipo === f.tipo;
    if (f.categoria && categoriaDeEvento(e.tipo) !== f.categoria) return false;
    if (f.categoria !== 'incidencias') return true;
    if (f.clase && claseIncidencia(e.tipo) !== f.clase) return false;
    return !f.estado || incidenciaPendiente(e) === (f.estado === 'pendientes');
  });
}

/**
 * Bitácora del guardia (DA-41, DA-42): línea de tiempo del mes. Incidencias (lo que salió mal: de
 * asistencia o de rostro) y movimientos (rostro, sitios, horarios, grupos).
 */
export function BitacoraGuardia({
  eventos,
  cargando,
  filtro,
  onFiltro,
}: {
  eventos: EventoBitacora[] | undefined;
  cargando: boolean;
  filtro: FiltroBitacora;
  onFiltro: (f: FiltroBitacora) => void;
}) {
  const sinFiltro: FiltroBitacora = { categoria: null, clase: null, estado: null, tipo: null };
  const visibles = filtrarEventos(eventos ?? [], filtro);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {filtro.tipo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-700 py-1 pr-1 pl-3 text-sm font-medium text-white">
            {TIPO_EVENTO_BITACORA_LABEL[filtro.tipo]}
            <button
              type="button"
              onClick={() => onFiltro({ ...sinFiltro, categoria: 'incidencias' })}
              className="rounded-full p-1 hover:bg-white/20"
              aria-label="Quitar filtro"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <>
            <Chips
              label="Qué ver"
              todas="Todo"
              opciones={CATEGORIAS_BITACORA.map((c) => [c, CATEGORIA_BITACORA_LABEL[c]] as const)}
              valor={filtro.categoria}
              onChange={(categoria) => onFiltro({ ...sinFiltro, categoria })}
            />
            {filtro.categoria === 'incidencias' && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl bg-slate-100/70 p-2">
                <Chips
                  label="Tipo de incidencia"
                  opciones={CLASES_INCIDENCIA.map((c) => [c, CLASE_INCIDENCIA_LABEL[c]] as const)}
                  valor={filtro.clase}
                  onChange={(clase) => onFiltro({ ...filtro, clase })}
                />
                <Chips
                  label="Estado"
                  todas="Cualquier estado"
                  opciones={ESTADOS_INCIDENCIA.map((s) => [s, ESTADO_INCIDENCIA_LABEL[s]] as const)}
                  valor={filtro.estado}
                  onChange={(estado) => onFiltro({ ...filtro, estado })}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ListaEventos
        eventos={visibles}
        cargando={cargando}
        vacio={
          filtro.categoria === 'incidencias' && !filtro.clase && !filtro.estado
            ? 'Sin incidencias en este mes.'
            : filtro.tipo || filtro.categoria
              ? 'Nada con este filtro en el mes.'
              : 'Nada registrado en este mes.'
        }
      />
    </div>
  );
}

/**
 * Eventos agrupados por día, con notas, justificar, ver foto y revisar la incidencia de rostro.
 * `conGuardia` muestra de quién es cada uno (lista general de incidencias).
 */
export function ListaEventos({
  eventos,
  cargando,
  vacio,
  conGuardia = false,
}: {
  eventos: EventoBitacora[];
  cargando: boolean;
  vacio: string;
  conGuardia?: boolean;
}) {
  const [comentando, setComentando] = useState<EventoBitacora | null>(null);
  const [justificando, setJustificando] = useState<EventoBitacora | null>(null);
  const [confirmando, setConfirmando] = useState<EventoBitacora | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [incidencia, setIncidencia] = useState<number | null>(null);

  // Agrupados por día (local), del más nuevo al más viejo.
  const dias: [string, EventoBitacora[]][] = [];
  for (const e of eventos) {
    const dia = new Date(e.ocurrioEn).toDateString();
    const ultimo = dias[dias.length - 1];
    if (ultimo?.[0] === dia) ultimo[1].push(e);
    else dias.push([dia, [e]]);
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-12 text-brand-600">
        <Spinner className="size-7" />
      </div>
    );
  }
  return (
    <>
      {dias.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-10" />} title="Sin eventos" description={vacio} />
      ) : (
        <div className="space-y-4">
          {dias.map(([dia, lista]) => (
            <section key={dia}>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {formatDia(lista[0].ocurrioEn)}
              </h3>
              <ol className="space-y-2">
                {lista.map((e) => (
                  <Evento
                    key={e.id}
                    evento={e}
                    conGuardia={conGuardia}
                    onFoto={setFoto}
                    onComentar={() => setComentando(e)}
                    onJustificar={() => setJustificando(e)}
                    onConfirmarFalta={() => setConfirmando(e)}
                    onIncidencia={setIncidencia}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {comentando && <NotaModal evento={comentando} onClose={() => setComentando(null)} />}
      {justificando && <JustificarModal evento={justificando} onClose={() => setJustificando(null)} />}
      {confirmando && <ConfirmarFaltaModal evento={confirmando} onClose={() => setConfirmando(null)} />}
      <VisorFotos
        fotos={foto ? [{ url: foto }] : []}
        indice={foto ? 0 : null}
        onClose={() => setFoto(null)}
        espejo
      />
      <IncidenciaModal id={incidencia} onClose={() => setIncidencia(null)} />
    </>
  );
}

function Evento({
  evento: e,
  conGuardia,
  onFoto,
  onComentar,
  onJustificar,
  onConfirmarFalta,
  onIncidencia,
}: {
  evento: EventoBitacora;
  conGuardia: boolean;
  onFoto: (url: string) => void;
  onComentar: () => void;
  onJustificar: () => void;
  onConfirmarFalta: () => void;
  onIncidencia: (id: number) => void;
}) {
  const Icono = ICONO[e.tipo];
  const justificable =
    TIPOS_JUSTIFICABLES.includes(e.tipo) &&
    !e.justificacion &&
    e.decision?.tipo !== 'asistencia' &&
    e.decision?.tipo !== 'enviado_a_casa' &&
    e.decision?.tipo !== 'superado';
  // Falta sin atender (A-48): además de justificarla se puede confirmar. Si el guardia llegó tarde, eso
  // lo ofrece el bloque "¿Aceptas la asistencia?".
  const confirmable = e.tipo === 'falta' && !e.justificacion && !e.decision && typeof e.datos?.llegoEn !== 'string';
  // Retardo sin atender: justificar / aceptar / mandar a casa en un solo bloque (A-25).
  const decidirRetardo = e.tipo === 'retardo' && !e.justificacion && !e.decision;
  const sinAtender = claseIncidencia(e.tipo) === 'asistencia' && incidenciaPendiente(e);

  return (
    <li className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 ring-inset">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          e.justificacion ? 'bg-slate-100 text-slate-400' : (COLOR[e.tipo] ?? 'bg-slate-100 text-slate-600'),
        )}
      >
        <Icono className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          {conGuardia && (
            <Link
              to={`/asistencia/guardias/${e.guardia.id}?mes=${e.ocurrioEn.slice(0, 7)}&vista=bitacora&cat=incidencias`}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              {e.guardia.nombre}
            </Link>
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">{TIPO_EVENTO_BITACORA_LABEL[e.tipo]}</span>
            <span className="text-slate-500 tabular-nums">{formatHora(e.ocurrioEn)}</span>
            {e.justificacion && <Badge tone="success">Justificado</Badge>}
            {sinAtender && <Badge tone="warning">Sin atender</Badge>}
          </p>
          <p className={cn('text-sm text-slate-700', e.justificacion && 'text-slate-500')}>{e.detalle}</p>
          {e.actor && <p className="text-xs text-slate-500">Por {e.actor}</p>}
        </div>

        {(e.foto || e.incidencia) && (
          <div className="flex items-start gap-3">
            {e.foto && (
              <button
                type="button"
                onClick={() => onFoto(e.foto!)}
                aria-label="Ver foto"
                className="shrink-0"
              >
                <img
                  src={e.foto}
                  alt=""
                  loading="lazy"
                  className="size-14 -scale-x-100 rounded-lg object-cover ring-1 ring-slate-200"
                />
              </button>
            )}
            {e.incidencia && (
              <div className="min-w-0 space-y-1 text-sm">
                {e.incidencia.revisadaEn ? (
                  <p className="text-slate-700">
                    <Badge tone={e.incidencia.conclusion === 'confirmada' ? 'danger' : 'neutral'}>
                      {e.incidencia.conclusion
                        ? CONCLUSION_INCIDENCIA_LABEL[e.incidencia.conclusion]
                        : 'Revisada'}
                    </Badge>{' '}
                    <span className="text-xs text-slate-500">
                      {e.incidencia.revisadaPor ?? 'Alguien'} · {formatFechaHora(e.incidencia.revisadaEn)}
                    </span>
                  </p>
                ) : (
                  <Badge tone="warning">Sin atender</Badge>
                )}
                {e.incidencia.nota && <p className="text-slate-600">“{e.incidencia.nota}”</p>}
                {e.incidencia.revisadaEn ? (
                  <button
                    type="button"
                    onClick={() => onIncidencia(e.incidencia!.id)}
                    className="block text-sm font-medium text-brand-700 hover:underline"
                  >
                    Ver incidencia
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">
                      Una nota no la cierra: revísala y marca si fue falsa alarma o confirmada.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => onIncidencia(e.incidencia!.id)}>
                      Revisar y atender
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {e.tipo === 'falta' && typeof e.datos?.llegoEn === 'string' && (
          <DecisionLlegada evento={e} onConfirmarFalta={onConfirmarFalta} />
        )}
        {e.tipo === 'falta' && e.decision?.tipo === 'falta' && typeof e.datos?.llegoEn !== 'string' && (
          <Nota>
            <strong>Falta confirmada</strong> por {e.decision.por ?? 'alguien'} · {formatFechaHora(e.decision.en)}
            {e.decision.motivo && <span className="block text-slate-700">{e.decision.motivo}</span>}
          </Nota>
        )}
        {e.tipo === 'no_se_presento' && e.decision?.tipo === 'superado' && (
          <Nota>
            Cerrado solo: el guardia llegó o el turno pasó a falta.
          </Nota>
        )}
        {decidirRetardo && <DecisionRetardo evento={e} onJustificar={onJustificar} />}
        <NotaDecisionRetardo evento={e} />

        {e.justificacion && (
          <Nota tono="verde">
            <strong>Justificado</strong> por {e.justificacion.por ?? 'alguien'} ·{' '}
            {formatFechaHora(e.justificacion.en)}
            <span className="block text-slate-700">{e.justificacion.motivo}</span>
          </Nota>
        )}

        {e.comentarios.map((c) => (
          <Nota key={c.id}>
            <span className="text-xs text-slate-500">
              Nota · {c.autor ?? 'Alguien'} · {formatFechaHora(c.createdAt)}
            </span>
            <span className="block text-slate-700">{c.texto}</span>
          </Nota>
        ))}

        <div className="-ml-3 flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" icon={<MessageSquare className="size-4" />} onClick={onComentar}>
            Agregar nota
          </Button>
          {confirmable && (
            <Button variant="ghost" size="sm" icon={<CalendarX className="size-4" />} onClick={onConfirmarFalta}>
              Confirmar falta
            </Button>
          )}
          {justificable && !decidirRetardo && (
            <Button
              variant="ghost"
              size="sm"
              icon={<CheckCircle2 className="size-4" />}
              onClick={onJustificar}
            >
              Justificar
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Falta en la que el guardia llegó después (DA-45): el supervisor acepta la asistencia (la falta deja
 * de contar; el retardo se queda) o deja la falta.
 */
function DecisionLlegada({
  evento: e,
  onConfirmarFalta,
}: {
  evento: EventoBitacora;
  onConfirmarFalta: () => void;
}) {
  const qc = useQueryClient();
  const decidir = useMutation({
    mutationFn: (d: DecisionFalta) => asistenciaService.decidirFalta(e.id, d),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success(r.decision?.tipo === 'asistencia' ? 'Asistencia aceptada' : 'Se dejó la falta');
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  });
  const llego = String(e.datos!.llegoEn);
  const min = Number(e.datos!.retardoMin ?? 0);
  const tarde =
    min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  if (e.decision) {
    return (
      <Nota tono={e.decision.tipo === 'asistencia' ? 'verde' : undefined}>
        <strong>{e.decision.tipo === 'asistencia' ? 'Asistencia aceptada' : 'Falta confirmada'}</strong> por{' '}
        {e.decision.por ?? 'alguien'} · {formatFechaHora(e.decision.en)}
        {e.decision.motivo && <span className="block text-slate-700">{e.decision.motivo}</span>}
        <span className="block text-slate-700">
          Llegó a las {formatHora(llego)} ({tarde} tarde)
          {e.decision.tipo === 'asistencia' && '; el retardo se queda salvo que se justifique.'}
        </span>
      </Nota>
    );
  }
  return (
    <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
      <p>
        <strong>Llegó a las {formatHora(llego)}</strong> ({tarde} tarde). ¿Aceptas la asistencia?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={decidir.isPending && decidir.variables === 'asistencia'}
          disabled={decidir.isPending}
          onClick={() => decidir.mutate('asistencia')}
        >
          Aceptar asistencia
        </Button>
        <Button size="sm" variant="secondary" disabled={decidir.isPending} onClick={onConfirmarFalta}>
          Dejar la falta
        </Button>
      </div>
    </div>
  );
}

function Nota({ tono, children }: { tono?: 'verde'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        tono === 'verde' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600',
      )}
    >
      {children}
    </p>
  );
}

/** Justificar un evento (A-48): motivo de la lista; con "otro", el detalle es obligatorio. */
function JustificarModal({ evento, onClose }: { evento: EventoBitacora; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<MotivoJustificar | ''>('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const guardar = useMutation({
    mutationFn: () =>
      asistenciaService.justificarEvento(evento.id, {
        categoria: categoria as MotivoJustificar,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success('Justificado');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = justificarBitacoraSchema.safeParse({ categoria: categoria || undefined, nota: nota.trim() || undefined });
    if (!r.success) return setErrores(erroresDeCampos(r.error));
    setErrores({});
    guardar.mutate();
  };

  return (
    <FormModal
      title={`Justificar ${TIPO_EVENTO_BITACORA_LABEL[evento.tipo].toLowerCase()}`}
      description={evento.detalle}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Justificar"
      loading={guardar.isPending}
      dirty={!!categoria || !!nota}
      size="sm"
    >
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Ya no contará en el resumen ni en reportes. No se puede deshacer.
      </p>
      <MotivoLista
        categorias={MOTIVOS_JUSTIFICAR}
        etiquetas={MOTIVO_JUSTIFICAR_LABEL}
        categoria={categoria}
        nota={nota}
        onCategoria={setCategoria}
        onNota={setNota}
        errores={errores}
        placeholderNota="Ej. Cita médica con comprobante"
      />
    </FormModal>
  );
}

/** Agregar una nota a un evento; al guardar se recargan bitácora, ficha e incidencias. */
function NotaModal({ evento, onClose }: { evento: EventoBitacora; onClose: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (t: string) => asistenciaService.comentarEvento(evento.id, t),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asistenciaService.keys.all });
      toast.success('Nota guardada');
      onClose();
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  });

  const onSubmit = () => {
    const r = comentarioBitacoraSchema.safeParse({ texto });
    if (!r.success) return setError(r.error.issues[0].message);
    setError(null);
    guardar.mutate(texto.trim());
  };

  return (
    <FormModal
      title="Agregar nota"
      description={evento.detalle}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Guardar nota"
      loading={guardar.isPending}
      dirty={texto.trim() !== ''}
      size="sm"
    >
      <FormField
        label="Nota"
        required
        error={error ?? undefined}
        hint={
          TIPOS_JUSTIFICABLES.includes(evento.tipo)
            ? 'Nota interna, solo la ven supervisores y admin. No cambia nada: el evento sigue contando. Para que deje de contar, usa Justificar.'
            : 'Nota interna, solo la ven supervisores y admin.'
        }
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ej. Se habló con él; dice que hubo tráfico"
          autoFocus
        />
      </FormField>
    </FormModal>
  );
}
