import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarX,
  CircleCheck,
  Clock,
  Plus,
  Trash2,
  TriangleAlert,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  ROLES,
  asignacionCreateSchema,
  esUnoYUno,
  horaLegible,
  huecosDelDia,
  letraDia,
  patronDe,
  sumarDiasFecha,
  textoDias,
  trabajaEl,
  type Asignacion,
  type Sitio,
  type TurnoCatalogo,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { formatFecha, hoyLocal } from '../../core/format/fechas';
import { useForm } from '../../core/forms/useForm';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Spinner,
  cn,
  toast,
  type BadgeTone,
} from '../../components/ui';
import { TurnoModal } from '../catalogos/TurnoModal';
import { textoHorario } from '../catalogos/turnos.texto';
import { turnosService } from '../catalogos/turnos.service';
import { gruposService } from '../grupos/grupos.service';
import { AsignarTurnoModal, Avatar } from './AsignarTurnoModal';
import { clientesService, sitiosService } from './clientes.service';
import { CoberturasDelSitio } from './CoberturasDelSitio';

function estadoAsignacion(a: Asignacion, hoy: string): { label: string; tone: BadgeTone } {
  if (a.vigente) return { label: 'Vigente', tone: 'success' };
  if (a.desde > hoy) return { label: 'Programada', tone: 'info' };
  return { label: 'Terminada', tone: 'neutral' };
}

const nombreDe = (a: Asignacion) => (a.grupo ? a.grupo.nombre : (a.guardia?.nombre ?? '—'));
const primerNombre = (a: Asignacion) => (a.grupo ? a.grupo.nombre : (a.guardia?.nombre.split(' ')[0] ?? '—'));
const diaCorto = (f: string) =>
  new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' }).format(new Date(`${f}T12:00:00`));

interface GrupoTurno {
  clave: string;
  turno: TurnoCatalogo | null;
  asignaciones: Asignacion[];
}

/**
 * Cobertura del sitio (DA-37): turnos del catálogo asignados a guardias o grupos (Día A / Día B
 * en 24 h), eventos y calendario de los próximos días con las horas sin cubrir. Reemplaza al modal
 * de "Asignaciones".
 */
export function CoberturaSitioModal({
  sitio,
  puedeEditar,
  onClose,
}: {
  sitio: Sitio;
  puedeEditar: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const hoy = hoyLocal();
  const editable = puedeEditar && !sitio.deletedAt;
  const [pestana, setPestana] = useState<'turnos' | 'eventos' | 'coberturas'>('turnos');
  const [historial, setHistorial] = useState(false);
  const [asignando, setAsignando] = useState<{ turno: TurnoCatalogo; existentes: Asignacion[] } | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [legado, setLegado] = useState<Asignacion | null>(null);
  const [quitar, setQuitar] = useState<Asignacion | null>(null);
  const [eliminar, setEliminar] = useState<Asignacion | null>(null);
  const esAdmin = useAuthStore((s) => s.user?.rol === ROLES.ADMIN);

  const asignaciones = useQuery({
    queryKey: sitiosService.keys.guardias(sitio.id, historial),
    queryFn: () => sitiosService.asignaciones(sitio.id, historial),
  });
  const turnos = useQuery({ queryKey: turnosService.keys.all, queryFn: turnosService.list });
  const disponibles = useQuery({
    queryKey: sitiosService.keys.disponibles,
    queryFn: sitiosService.guardiasDisponibles,
    enabled: editable,
  });
  const fotos = new Map((disponibles.data ?? []).map((g) => [g.id, g.foto]));
  const turnoPorId = new Map((turnos.data ?? []).map((t) => [t.id, t]));

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
    void qc.invalidateQueries({ queryKey: clientesService.keys.all });
    void qc.invalidateQueries({ queryKey: gruposService.keys.all });
    void qc.invalidateQueries({ queryKey: turnosService.keys.all });
  };

  const eliminarAsignacion = useMutation({
    mutationFn: (a: Asignacion) => sitiosService.cancelarAsignacion(sitio.id, a.id),
    onSuccess: () => {
      refrescar();
      setEliminar(null);
      toast.success('Asignación eliminada');
    },
    onError: (e) => {
      setEliminar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const quitarAsignacion = useMutation({
    mutationFn: async (a: Asignacion) => {
      if (a.desde > hoy) await sitiosService.cancelarAsignacion(sitio.id, a.id);
      else await sitiosService.actualizarAsignacion(sitio.id, a.id, { hasta: hoy });
    },
    onSuccess: (_r, a) => {
      refrescar();
      setQuitar(null);
      toast.success(a.desde > hoy ? 'Asignación cancelada' : 'Asignación terminada');
    },
    onError: (e) => {
      setQuitar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const lista = asignaciones.data ?? [];
  const deTurno = lista.filter((a) => a.tipo !== 'eventual');
  const eventos = lista.filter((a) => a.tipo === 'eventual');

  // Agrupadas por turno del catálogo; las anteriores al catálogo, aparte.
  const gruposTurno = useMemo<GrupoTurno[]>(() => {
    const mapa = new Map<string, GrupoTurno>();
    for (const a of deTurno) {
      const clave = a.turnoCatalogo ? String(a.turnoCatalogo.id) : 'sin';
      const g = mapa.get(clave) ?? {
        clave,
        turno: a.turnoCatalogo ? (turnoPorId.get(a.turnoCatalogo.id) ?? null) : null,
        asignaciones: [],
      };
      g.asignaciones.push(a);
      mapa.set(clave, g);
    }
    return [...mapa.values()].sort((x, y) => (x.clave === 'sin' ? 1 : y.clave === 'sin' ? -1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones.data, turnos.data]);

  // Próximos 7 días: quién entra cada día y horas sin cubrir (solo turnos y eventos vigentes o programados).
  const activas = lista.filter((a) => a.vigente || a.desde > hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDiasFecha(hoy, i));

  const renglon = (a: Asignacion, referencia: string | null) => {
    const estado = estadoAsignacion(a, hoy);
    const terminable = editable && ((a.vigente && a.hasta !== hoy) || a.desde > hoy);
    const elegible = editable && !a.turnoCatalogo && a.tipo !== 'eventual' && (a.vigente || a.desde > hoy);
    return (
      <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <Avatar foto={a.guardia ? fotos.get(a.guardia.id) : null} nombre={nombreDe(a)} grupo={!!a.grupo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">
            {nombreDe(a)}
            {a.grupo && <span className="text-xs font-normal text-slate-500"> ({a.grupo.integrantes})</span>}
          </p>
          <p className="text-xs text-slate-500">
            {referencia && (esUnoYUno(a.dias) || a.turno === '24x24') && (
              <span className="font-semibold text-brand-700">Día {letraDia(a.desde, referencia)} · </span>
            )}
            {a.tipo === 'eventual' &&
              a.horaInicio &&
              a.horaFin &&
              `${horaLegible(a.horaInicio)} a ${horaLegible(a.horaFin)} · `}
            desde {formatFecha(a.desde)}
            {a.hasta && ` hasta ${formatFecha(a.hasta)}`}
          </p>
        </div>
        <Badge tone={estado.tone}>{estado.label}</Badge>
        {(elegible || terminable || (esAdmin && editable)) && (
          // En celular los botones van en su propio renglón para no apretar el nombre.
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            {elegible && (
              <Button variant="secondary" size="sm" onClick={() => setLegado(a)}>
                Elegir turno
              </Button>
            )}
            {terminable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<CalendarX className="size-4" />}
                onClick={() => setQuitar(a)}
              >
                Quitar
              </Button>
            )}
            {esAdmin && editable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="size-4" />}
                className="text-red-700"
                onClick={() => setEliminar(a)}
              >
                Eliminar
              </Button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={`Cobertura · ${sitio.nombre}`}
        description={
          sitio.deletedAt
            ? 'Sitio dado de baja'
            : 'Turnos y eventos del sitio. Solo quien lo tiene asignado lo ve en su celular.'
        }
        footer={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
            {(['turnos', 'eventos', 'coberturas'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pestana === p}
                onClick={() => setPestana(p)}
                className={cn(
                  'rounded-md px-4 py-2',
                  pestana === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                )}
              >
                {p === 'turnos'
                  ? 'Turnos'
                  : p === 'coberturas'
                    ? 'Coberturas'
                    : `Eventos${eventos.length ? ` (${eventos.length})` : ''}`}
              </button>
            ))}
          </div>
          <Checkbox
            label="Ver terminadas"
            checked={historial}
            onChange={(e) => setHistorial(e.target.checked)}
            className="py-0"
          />
        </div>

        {pestana === 'coberturas' ? (
          <CoberturasDelSitio sitio={sitio} editable={editable} />
        ) : asignaciones.isPending ? (
          <div className="flex justify-center py-8 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : pestana === 'turnos' ? (
          <div className="space-y-4">
            {gruposTurno.length === 0 && (
              <EmptyState
                icon={<Clock className="size-9" />}
                title="Sin turnos en este sitio"
                description={
                  editable ? 'Agrega un turno del catálogo y asígnalo a guardias o grupos.' : undefined
                }
              />
            )}
            {gruposTurno.map((g) => {
              const t = g.turno;
              const referencia = g.asignaciones.map((a) => a.desde).sort()[0] ?? null;
              return (
                <section key={g.clave} className="rounded-xl border border-slate-200">
                  <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        {t ? t.nombre : 'Sin turno del catálogo'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t
                          ? `${textoHorario(t.horas, t.horaEntrada)} · ${textoDias(t.dias).toLowerCase()}`
                          : 'Asignaciones anteriores al catálogo: elige su turno para controlar días y horarios.'}
                      </p>
                    </div>
                    {editable && t?.activo && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="size-4" />}
                        onClick={() => setAsignando({ turno: t, existentes: g.asignaciones })}
                      >
                        Guardias o grupo
                      </Button>
                    )}
                  </header>
                  <ul className="divide-y divide-slate-100">
                    {g.asignaciones.map((a) => renglon(a, referencia))}
                  </ul>
                </section>
              );
            })}
            {editable && (
              <Button
                variant="secondary"
                fullWidth
                icon={<Plus className="size-4" />}
                onClick={() => setEligiendo(true)}
              >
                Agregar turno al sitio
              </Button>
            )}

            {activas.some((a) => a.horaInicio) && (
              <section className="rounded-xl bg-slate-50 p-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <CalendarDays className="size-4" /> Próximos 7 días
                </h3>
                <ul className="space-y-2">
                  {dias.map((f) => {
                    const entran = activas.filter((a) => trabajaEl(f, patronDe(a)));
                    const huecos = huecosDelDia(f, activas.map(patronDe));
                    return (
                      <li key={f} className="grid grid-cols-[4.5rem_1fr] gap-2 text-sm">
                        <span className="font-medium text-slate-700 capitalize">{diaCorto(f)}</span>
                        <span className="min-w-0 space-y-1">
                          <span className="flex flex-wrap gap-1">
                            {entran.length === 0 && <span className="text-slate-400">Nadie entra</span>}
                            {entran.map((a) => (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                              >
                                {a.grupo ? (
                                  <UsersRound className="size-3" />
                                ) : (
                                  <UserRound className="size-3" />
                                )}
                                {primerNombre(a)}
                                {a.horaInicio && (
                                  <span className="text-slate-400">{horaLegible(a.horaInicio)}</span>
                                )}
                              </span>
                            ))}
                          </span>
                          {huecos.length === 0 ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-700">
                              <CircleCheck className="size-3.5" /> Cubierto las 24 h
                            </span>
                          ) : (
                            <span className="flex items-start gap-1 text-xs font-medium text-amber-700">
                              <TriangleAlert className="mt-px size-3.5 shrink-0" />
                              {huecos.length === 1 &&
                              huecos[0].desde === '00:00' &&
                              huecos[0].hasta === '00:00'
                                ? 'Sin cubrir todo el día'
                                : `Sin cubrir: ${huecos
                                    .map((h) => `${horaLegible(h.desde)} a ${horaLegible(h.hasta)}`)
                                    .join(', ')}`}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {editable && <NuevoEvento sitio={sitio} onCreado={refrescar} />}
            {eventos.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-9" />} title="Sin eventos" />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {eventos.map((a) => renglon(a, null))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {eligiendo && (
        <ElegirTurnoModal
          titulo="Agregar turno al sitio"
          onClose={() => setEligiendo(false)}
          onElegido={(t) => {
            setEligiendo(false);
            setAsignando({ turno: t, existentes: deTurno.filter((a) => a.turnoCatalogo?.id === t.id) });
          }}
        />
      )}
      {legado && (
        <ElegirTurnoModal
          titulo={`Turno de ${nombreDe(legado)}`}
          onClose={() => setLegado(null)}
          onElegido={async (t) => {
            try {
              await sitiosService.actualizarAsignacion(sitio.id, legado.id, { turnoId: t.id });
              toast.success('Turno actualizado');
              refrescar();
            } catch (e) {
              toast.error(mensajeDeError(e));
            }
            setLegado(null);
          }}
        />
      )}
      {asignando && (
        <AsignarTurnoModal
          sitio={sitio}
          turno={asignando.turno}
          existentes={asignando.existentes}
          onClose={() => setAsignando(null)}
        />
      )}

      <ConfirmDialog
        open={eliminar !== null}
        title="Eliminar asignación"
        description={
          eliminar &&
          `Se borra al momento la asignación de ${nombreDe(eliminar)} en ${sitio.nombre}. Sus marcas de asistencia no se pierden.${
            eliminar.vigente || eliminar.desde > hoy ? ' Se le avisará.' : ''
          }`
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarAsignacion.isPending}
        onConfirm={() => eliminar && eliminarAsignacion.mutate(eliminar)}
        onCancel={() => setEliminar(null)}
      />
      <ConfirmDialog
        open={quitar !== null}
        title={quitar && quitar.desde > hoy ? 'Cancelar asignación' : 'Quitar del sitio'}
        description={
          quitar &&
          (quitar.desde > hoy
            ? `${nombreDe(quitar)} ya no empezará el ${formatFecha(quitar.desde)}. Se le avisará.`
            : `${nombreDe(quitar)} dejará de ver ${sitio.nombre} a partir de mañana (la asignación termina hoy). Se le avisará.`)
        }
        confirmLabel={quitar && quitar.desde > hoy ? 'Cancelar asignación' : 'Terminar hoy'}
        variant="danger"
        loading={quitarAsignacion.isPending}
        onConfirm={() => quitar && quitarAsignacion.mutate(quitar)}
        onCancel={() => setQuitar(null)}
      />
    </>
  );
}

/** Elige un turno activo del catálogo o crea uno nuevo ahí mismo. */
function ElegirTurnoModal({
  titulo,
  onClose,
  onElegido,
}: {
  titulo: string;
  onClose: () => void;
  onElegido: (t: TurnoCatalogo) => void;
}) {
  const turnos = useQuery({ queryKey: turnosService.keys.all, queryFn: turnosService.list });
  const [elegido, setElegido] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const activos = (turnos.data ?? []).filter((t) => t.activo);

  if (nuevo) return <TurnoModal turno={null} onClose={() => setNuevo(false)} onGuardado={onElegido} />;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={titulo}
      description="Elige un turno del catálogo"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={elegido === null}
            onClick={() => onElegido(activos.find((t) => t.id === elegido)!)}
          >
            Continuar
          </Button>
        </>
      }
    >
      {turnos.isPending ? (
        <div className="flex justify-center py-6 text-brand-600">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="space-y-2">
          {activos.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={elegido === t.id}
              onClick={() => setElegido(t.id)}
              className={cn(
                'w-full rounded-lg border-2 px-3 py-2.5 text-left',
                elegido === t.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200',
              )}
            >
              <span className="block font-medium text-slate-900">{t.nombre}</span>
              <span className="block text-xs text-slate-500">
                {textoHorario(t.horas, t.horaEntrada)} · {textoDias(t.dias).toLowerCase()}
              </span>
            </button>
          ))}
          {activos.length === 0 && (
            <p className="text-sm text-slate-500">Aún no hay turnos en el catálogo.</p>
          )}
          <Button variant="ghost" fullWidth icon={<Plus className="size-4" />} onClick={() => setNuevo(true)}>
            Nuevo turno
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Evento puntual (uno o pocos días con horario) para un guardia o un grupo. */
function NuevoEvento({ sitio, onCreado }: { sitio: Sitio; onCreado: () => void }) {
  const hoy = hoyLocal();
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState<'guardia' | 'grupo'>('guardia');
  const disponibles = useQuery({
    queryKey: sitiosService.keys.disponibles,
    queryFn: sitiosService.guardiasDisponibles,
    enabled: abierto,
  });
  const grupos = useQuery({
    queryKey: gruposService.keys.list('activos'),
    queryFn: () => gruposService.list('activos'),
    enabled: abierto,
  });
  const form = useForm({ usuarioId: '', grupoId: '', desde: hoy, hasta: '', horaInicio: '', horaFin: '' });
  const crear = useMutation({
    mutationFn: (data: ReturnType<typeof asignacionCreateSchema.parse>) =>
      sitiosService.asignar(sitio.id, data),
    onSuccess: () => {
      toast.success('Evento agregado');
      onCreado();
      setAbierto(false);
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });
  const v = form.values;
  const cruza = v.horaInicio && v.horaFin && v.horaFin <= v.horaInicio;

  if (!abierto) {
    return (
      <Button
        variant="secondary"
        fullWidth
        icon={<Plus className="size-4" />}
        onClick={() => setAbierto(true)}
      >
        Nuevo evento
      </Button>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = form.validar(asignacionCreateSchema, {
          usuarioId: destino === 'guardia' ? v.usuarioId || null : null,
          grupoId: destino === 'grupo' ? v.grupoId || null : null,
          tipo: 'eventual',
          turno: null,
          desde: v.desde,
          hasta: v.hasta || null,
          horaInicio: v.horaInicio || null,
          horaFin: v.horaFin || null,
        });
        if (data) crear.mutate(data);
      }}
      className="space-y-3 rounded-xl border border-slate-200 p-3"
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Para">
        {(['guardia', 'grupo'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={destino === d}
            onClick={() => setDestino(d)}
            className={cn(
              'rounded-lg border-2 px-3 py-2 text-sm font-medium',
              destino === d
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-slate-200 text-slate-600',
            )}
          >
            {d === 'guardia' ? 'Un guardia' : 'Un grupo'}
          </button>
        ))}
      </div>
      {destino === 'guardia' ? (
        <FormField label="Guardia" required error={form.errors.usuarioId}>
          <Select
            {...form.bind('usuarioId')}
            options={(disponibles.data ?? []).map((g) => ({ value: g.id, label: g.nombre }))}
            placeholder={disponibles.isPending ? 'Cargando…' : 'Selecciona…'}
          />
        </FormField>
      ) : (
        <FormField label="Grupo" required error={form.errors.grupoId ?? form.errors.usuarioId}>
          <Select
            {...form.bind('grupoId')}
            options={(grupos.data ?? []).map((g) => ({
              value: g.id,
              label: `${g.nombre} (${g.integrantes.length})`,
            }))}
            placeholder={grupos.isPending ? 'Cargando…' : 'Selecciona…'}
          />
        </FormField>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Día" required error={form.errors.desde}>
          <Input {...form.bind('desde')} type="date" min={hoy} />
        </FormField>
        <FormField label="Hasta (opcional)" error={form.errors.hasta}>
          <Input {...form.bind('hasta')} type="date" min={v.desde} />
        </FormField>
        <FormField label="Inicio" required error={form.errors.horaInicio}>
          <Input {...form.bind('horaInicio')} type="time" />
        </FormField>
        <FormField label="Término" required error={form.errors.horaFin}>
          <Input {...form.bind('horaFin')} type="time" />
        </FormField>
      </div>
      {cruza && (
        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <Clock className="size-4" /> Termina al día siguiente
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button type="submit" loading={crear.isPending}>
          Agregar evento
        </Button>
      </div>
    </form>
  );
}
