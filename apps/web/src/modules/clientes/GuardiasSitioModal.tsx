import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, ShieldPlus, UserRound } from 'lucide-react';
import {
  ROLES,
  TURNOS,
  TURNO_LABEL,
  asignacionCreateSchema,
  type Asignacion,
  type Sitio,
} from '@platinum/shared';
import { mensajeDeError } from '../../core/api';
import { useForm } from '../../core/forms/useForm';
import { formatFecha, hoyLocal } from '../../core/format/fechas';
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
  toast,
  type BadgeTone,
} from '../../components/ui';
import { usuariosService } from '../usuarios/usuarios.service';
import { clientesService, sitiosService } from './clientes.service';

const turnoOptions = TURNOS.map((t) => ({ value: t, label: TURNO_LABEL[t] }));

function estadoAsignacion(a: Asignacion, hoy: string): { label: string; tone: BadgeTone } {
  if (a.vigente) return { label: 'Vigente', tone: 'success' };
  if (a.desde > hoy) return { label: 'Programada', tone: 'info' };
  return { label: 'Terminada', tone: 'neutral' };
}

/** Guardias asignados a un sitio: alta con turno y vigencia, y término (F2-05). */
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
  const hoy = hoyLocal();
  const [historial, setHistorial] = useState(false);
  const [terminar, setTerminar] = useState<Asignacion | null>(null);
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

  const form = useForm({ usuarioId: '', turno: '', desde: hoy, hasta: '' });

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: sitiosService.keys.all });
    void qc.invalidateQueries({ queryKey: clientesService.keys.all });
  };

  const asignar = useMutation({
    mutationFn: (data: ReturnType<typeof asignacionCreateSchema.parse>) =>
      sitiosService.asignar(sitio.id, data),
    onSuccess: () => {
      refrescar();
      form.set('usuarioId', '');
      toast.success('Guardia asignado');
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
    const data = form.validar(asignacionCreateSchema, { ...form.values, hasta: form.values.hasta || null });
    if (data) asignar.mutate(data);
  };

  const guardiaOptions = (guardias.data?.items ?? []).map((u) => ({ value: u.id, label: u.nombre }));
  const { errors, bind } = form;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={`Guardias · ${sitio.nombre}`}
        description={sitio.deletedAt ? 'Sitio dado de baja' : (sitio.direccion ?? undefined)}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        {editable && (
          <form onSubmit={onAsignar} noValidate className="mb-6 rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldPlus className="size-4 text-brand-600" /> Asignar guardia
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Guardia" required error={errors.usuarioId}>
                <Select
                  {...bind('usuarioId')}
                  options={guardiaOptions}
                  placeholder={guardias.isPending ? 'Cargando…' : 'Selecciona…'}
                />
              </FormField>
              <FormField label="Turno" required error={errors.turno}>
                <Select {...bind('turno')} options={turnoOptions} placeholder="Selecciona…" />
              </FormField>
              <FormField label="Desde" required error={errors.desde}>
                <Input {...bind('desde')} type="date" />
              </FormField>
              <FormField label="Hasta" error={errors.hasta} hint="Vacío = sin fecha de término.">
                <Input {...bind('hasta')} type="date" min={form.values.desde} />
              </FormField>
            </div>
            {guardias.data && guardiaOptions.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                No hay guardias activos. Créalos primero en Usuarios con el rol Guardia.
              </p>
            )}
            <Button type="submit" className="mt-4 w-full md:w-auto" loading={asignar.isPending}>
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
            title="Sin guardias asignados"
            description={editable ? 'Asigna el primero con el formulario de arriba.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {asignaciones.data.map((a) => {
              const estado = estadoAsignacion(a, hoy);
              const terminable = editable && a.vigente && a.hasta !== hoy;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{a.guardia.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {TURNO_LABEL[a.turno]} · {formatFecha(a.desde)} –{' '}
                      {a.hasta ? formatFecha(a.hasta) : 'sin término'}
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
          `${terminar.guardia.nombre} dejará de tener asignado ${sitio.nombre} a partir de mañana (la asignación termina hoy).`
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
