import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Clock, ShieldPlus, UserRound, UsersRound } from 'lucide-react';
import {
  PERMISOS,
  ROLES,
  TIPOS_ASIGNACION,
  TIPO_ASIGNACION_DESCRIPCION,
  TIPO_ASIGNACION_LABEL,
  TURNOS,
  TURNO_LABEL,
  asignacionCreateSchema,
  type Asignacion,
  type Sitio,
  type TipoAsignacion,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { useForm } from '../../core/forms/useForm';
import { hoyLocal } from '../../core/format/fechas';
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
import { gruposService } from '../grupos/grupos.service';
import { usuariosService } from '../usuarios/usuarios.service';
import { describirAsignacion } from './asignaciones';
import { clientesService, sitiosService } from './clientes.service';

const turnoOptions = TURNOS.map((t) => ({ value: t, label: TURNO_LABEL[t] }));

function estadoAsignacion(a: Asignacion, hoy: string): { label: string; tone: BadgeTone } {
  if (a.vigente) return { label: 'Vigente', tone: 'success' };
  if (a.desde > hoy) return { label: 'Programada', tone: 'info' };
  return { label: 'Terminada', tone: 'neutral' };
}

/** Asignaciones del sitio a guardias o grupos: fija, temporal o eventual (F2-05, F2-07). */
export function GuardiasSitioModal({
  sitio,
  puedeEditar,
  onClose,
}: {
  sitio: Sitio;
  puedeEditar: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const yo = useAuthStore((s) => s.user);
  const hoy = hoyLocal();
  const [historial, setHistorial] = useState(false);
  const [terminar, setTerminar] = useState<Asignacion | null>(null);
  const verGrupos = hasPermission(yo, PERMISOS.GRUPOS_ADMINISTRAR);
  const [destino, setDestino] = useState<'guardia' | 'grupo'>(verGrupos ? 'grupo' : 'guardia');
  const editable = puedeEditar && !sitio.deletedAt;

  const asignaciones = useQuery({
    queryKey: sitiosService.keys.guardias(sitio.id, historial),
    queryFn: () => sitiosService.asignaciones(sitio.id, historial),
  });
  const guardias = useQuery({
    queryKey: usuariosService.keys.list({ rol: ROLES.GUARDIA, estado: 'activos', limit: 100 }),
    queryFn: () => usuariosService.list({ rol: ROLES.GUARDIA, estado: 'activos', limit: 100 }),
    enabled: editable,
  });
  const grupos = useQuery({
    queryKey: gruposService.keys.list('activos'),
    queryFn: () => gruposService.list('activos'),
    enabled: editable && verGrupos,
  });

  const form = useForm({
    usuarioId: '',
    grupoId: '',
    tipo: 'fija' as TipoAsignacion,
    turno: '',
    desde: hoy,
    hasta: '',
    horaInicio: '',
    horaFin: '',
  });
  const tipo = form.values.tipo;

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
    void qc.invalidateQueries({ queryKey: clientesService.keys.all });
    void qc.invalidateQueries({ queryKey: gruposService.keys.all });
  };

  const asignar = useMutation({
    mutationFn: (data: ReturnType<typeof asignacionCreateSchema.parse>) =>
      sitiosService.asignar(sitio.id, data),
    onSuccess: () => {
      refrescar();
      form.set('usuarioId', '');
      form.set('grupoId', '');
      toast.success('Sitio asignado');
    },
    onError: (e) => {
      if (!form.aplicarErrorApi(e)) toast.error(mensajeDeError(e));
    },
  });

  const terminarAsignacion = useMutation({
    mutationFn: (a: Asignacion) => sitiosService.actualizarAsignacion(sitio.id, a.id, { hasta: hoy }),
    onSuccess: () => {
      refrescar();
      setTerminar(null);
      toast.success('Asignación terminada');
    },
    onError: (e) => {
      setTerminar(null);
      toast.error(mensajeDeError(e));
    },
  });

  const onAsignar = (e: React.FormEvent) => {
    e.preventDefault();
    const v = form.values;
    const data = form.validar(asignacionCreateSchema, {
      usuarioId: destino === 'guardia' ? v.usuarioId || null : null,
      grupoId: destino === 'grupo' ? v.grupoId || null : null,
      tipo: v.tipo,
      turno: v.tipo === 'eventual' ? null : v.turno || null,
      desde: v.desde,
      hasta: v.tipo === 'fija' ? null : v.hasta || null,
      horaInicio: v.tipo === 'eventual' ? v.horaInicio || null : null,
      horaFin: v.tipo === 'eventual' ? v.horaFin || null : null,
    });
    if (data) asignar.mutate(data);
  };

  const { errors, bind } = form;
  // El esquema reporta "elige guardia o grupo" en usuarioId; se muestra en el campo visible.
  const errorDestino = destino === 'guardia' ? errors.usuarioId : (errors.grupoId ?? errors.usuarioId);
  const cruzaMedianoche =
    tipo === 'eventual' &&
    form.values.horaInicio &&
    form.values.horaFin &&
    form.values.horaFin <= form.values.horaInicio;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={`Asignaciones · ${sitio.nombre}`}
        description={
          sitio.deletedAt ? 'Sitio dado de baja' : 'Solo quien tiene el sitio asignado lo ve en su celular.'
        }
        footer={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        {editable && (
          <form
            onSubmit={onAsignar}
            noValidate
            className="mb-6 space-y-4 rounded-xl border border-slate-200 p-4"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldPlus className="size-4 text-brand-600" /> Asignar sitio
            </h3>

            {verGrupos && (
              <div role="radiogroup" aria-label="Asignar a" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['grupo', 'A un grupo', UsersRound],
                    ['guardia', 'A un guardia', UserRound],
                  ] as const
                ).map(([d, label, Icono]) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={destino === d}
                    onClick={() => setDestino(d)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium',
                      destino === d
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 text-slate-600',
                    )}
                  >
                    <Icono className="size-4" /> {label}
                  </button>
                ))}
              </div>
            )}
            {destino === 'grupo' ? (
              <FormField label="Grupo" required error={errorDestino}>
                <Select
                  {...bind('grupoId')}
                  options={(grupos.data ?? []).map((g) => ({
                    value: g.id,
                    label: `${g.nombre} (${g.integrantes.length})`,
                  }))}
                  placeholder={grupos.isPending ? 'Cargando…' : 'Selecciona…'}
                />
              </FormField>
            ) : (
              <FormField label="Guardia" required error={errorDestino}>
                <Select
                  {...bind('usuarioId')}
                  options={(guardias.data?.items ?? []).map((u) => ({ value: u.id, label: u.nombre }))}
                  placeholder={guardias.isPending ? 'Cargando…' : 'Selecciona…'}
                />
              </FormField>
            )}
            {destino === 'grupo' && grupos.data?.length === 0 && (
              <p className="text-sm text-amber-700">No hay grupos activos. Créalos en el menú Grupos.</p>
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Tipo de asignación</p>
              <div role="radiogroup" aria-label="Tipo de asignación" className="grid grid-cols-3 gap-2">
                {TIPOS_ASIGNACION.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t}
                    onClick={() => form.set('tipo', t)}
                    className={cn(
                      'rounded-lg border-2 px-2 py-2 text-sm font-medium',
                      tipo === t
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 text-slate-600',
                    )}
                  >
                    {TIPO_ASIGNACION_LABEL[t]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-sm text-slate-500">{TIPO_ASIGNACION_DESCRIPCION[tipo]}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={tipo === 'eventual' ? 'Día' : 'Desde'} required error={errors.desde}>
                <Input {...bind('desde')} type="date" />
              </FormField>
              {tipo !== 'fija' && (
                <FormField
                  label={tipo === 'eventual' ? 'Hasta (opcional)' : 'Hasta'}
                  required={tipo === 'temporal'}
                  error={errors.hasta}
                >
                  <Input {...bind('hasta')} type="date" min={form.values.desde} />
                </FormField>
              )}
              {tipo === 'eventual' ? (
                <>
                  <FormField label="Hora de inicio" required error={errors.horaInicio}>
                    <Input {...bind('horaInicio')} type="time" />
                  </FormField>
                  <FormField label="Hora de término" required error={errors.horaFin}>
                    <Input {...bind('horaFin')} type="time" />
                  </FormField>
                </>
              ) : (
                <FormField label="Turno" required error={errors.turno}>
                  <Select {...bind('turno')} options={turnoOptions} placeholder="Selecciona…" />
                </FormField>
              )}
            </div>
            {cruzaMedianoche && (
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Clock className="size-4" /> Termina al día siguiente; también se verá esa madrugada.
              </p>
            )}

            <Button type="submit" className="w-full md:w-auto" loading={asignar.isPending}>
              Asignar
            </Button>
          </form>
        )}

        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Asignaciones</h3>
          <Checkbox
            label="Ver terminadas"
            checked={historial}
            onChange={(e) => setHistorial(e.target.checked)}
            className="py-0"
          />
        </div>

        {asignaciones.isPending ? (
          <div className="flex justify-center py-8 text-brand-600">
            <Spinner className="size-6" />
          </div>
        ) : !asignaciones.data?.length ? (
          <EmptyState
            icon={<UserRound className="size-9" />}
            title="Sin asignaciones"
            description={editable ? 'Asigna el sitio a un grupo o a un guardia.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {asignaciones.data.map((a) => {
              const estado = estadoAsignacion(a, hoy);
              const terminable = editable && a.vigente && a.hasta !== hoy;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                      {a.grupo ? (
                        <>
                          <UsersRound className="size-4 shrink-0 text-brand-600" />
                          {a.grupo.nombre}
                          <span className="text-xs font-normal text-slate-500">({a.grupo.integrantes})</span>
                        </>
                      ) : (
                        <>
                          <UserRound className="size-4 shrink-0 text-slate-400" />
                          {a.guardia?.nombre}
                        </>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {TIPO_ASIGNACION_LABEL[a.tipo]} · {describirAsignacion(a)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                    {terminable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<CalendarX className="size-4" />}
                        onClick={() => setTerminar(a)}
                      >
                        Terminar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={terminar !== null}
        title="Terminar asignación"
        description={
          terminar &&
          `${terminar.grupo ? `El grupo ${terminar.grupo.nombre}` : terminar.guardia?.nombre} dejará de ver ${sitio.nombre} a partir de mañana (la asignación termina hoy).`
        }
        confirmLabel="Terminar hoy"
        variant="danger"
        loading={terminarAsignacion.isPending}
        onConfirm={() => terminar && terminarAsignacion.mutate(terminar)}
        onCancel={() => setTerminar(null)}
      />
    </>
  );
}
